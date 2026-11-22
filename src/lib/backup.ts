import Dexie from 'dexie'
import { db, normSN } from '../db'
import { pruefe, supabase } from './supabase'
import { synchronisieren } from './sync'

const FORMAT = 'lagerverwaltung-backup'
const ALT_TABELLEN = ['orte', 'plaetze', 'projekte', 'artikel', 'eintraege', 'bewegungen'] as const
type Alt = Record<(typeof ALT_TABELLEN)[number], Record<string, any>[]> // eslint-disable-line @typescript-eslint/no-explicit-any

export async function exportieren(): Promise<void> {
  const daten: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) daten[t.name] = await t.toArray()
  })
  const json = JSON.stringify({ format: FORMAT, version: 2, erstellt: new Date().toISOString(), daten }, null, 1)
  const datei = new File([json], `lager-export-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      return await navigator.share({ files: [datei], title: 'Lager-Export' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(datei)
  const a = document.createElement('a')
  a.href = url
  a.download = datei.name
  a.click()
  URL.revokeObjectURL(url)
}

/** Daten der alten, nur lokalen Version auf diesem Gerät (falls vorhanden) */
export async function alteDatenAufGeraet(): Promise<Alt | undefined> {
  if (!(await Dexie.exists('lagerverwaltung'))) return
  const alt = new Dexie('lagerverwaltung')
  await alt.open()
  try {
    const daten = {} as Alt
    for (const t of ALT_TABELLEN) daten[t] = alt.tables.some((x) => x.name === t) ? await alt.table(t).toArray() : []
    return daten.eintraege.length || daten.plaetze.length ? daten : undefined
  } finally {
    alt.close()
  }
}

export async function altesBackupLesen(datei: File): Promise<Alt> {
  const inhalt = JSON.parse(await datei.text())
  if (inhalt?.format !== FORMAT || inhalt.version !== 1 || !ALT_TABELLEN.every((t) => Array.isArray(inhalt.daten?.[t]))) {
    throw new Error('Das ist kein Backup der alten (lokalen) Version')
  }
  return inhalt.daten
}

/** Übernimmt Daten der alten lokalen Version in ein Lager der zentralen Datenbank. */
export async function inLagerUebernehmen(lagerId: number, alt: Alt): Promise<{ eintraege: number; uebersprungen: string[] }> {
  await synchronisieren()
  const orte = await db.orte.where('lagerId').equals(lagerId).toArray()
  const ortMap = new Map<number, number>()
  for (const o of alt.orte) {
    const da = orte.find((x) => x.name === o.name && x.typ === o.typ)
    ortMap.set(o.id, da?.id ?? pruefe(await supabase.from('orte').insert({ lager_id: lagerId, name: o.name, typ: o.typ }).select('id').single()).id)
  }

  const plaetze = await db.plaetze.toArray()
  const platzMap = new Map<number, number>()
  for (const p of alt.plaetze) {
    const ortId = ortMap.get(p.ortId)!
    const da = plaetze.find((x) => x.ortId === ortId && x.regal === p.regal && x.nummer === p.nummer)
    platzMap.set(p.id, da?.id ?? pruefe(await supabase.from('plaetze')
      .insert({ ort_id: ortId, regal: p.regal, nummer: p.nummer, notiz: p.notiz ?? null }).select('id').single()).id)
  }

  const projekte = await db.projekte.toArray()
  const projektMap = new Map<number, number>()
  for (const p of alt.projekte) {
    const da = projekte.find((x) => x.name.toLowerCase() === p.name.toLowerCase())
    projektMap.set(p.id, da?.id ?? pruefe(await supabase.from('projekte')
      .insert({ name: p.name, archiviert: !!p.archiviert }).select('id').single()).id)
  }

  const artikel = await db.artikel.toArray()
  const artikelMap = new Map<number, number>()
  for (const a of alt.artikel) {
    const da = artikel.find((x) => x.name.toLowerCase() === a.name.toLowerCase())
    const id = da?.id ?? pruefe(await supabase.from('artikel')
      .insert({ name: a.name, kategorie: a.kategorie ?? null, mit_seriennummer: !!a.mitSeriennummer }).select('id').single()).id
    artikelMap.set(a.id, id)
    if (a.kofferraumMin > 0) pruefe(await supabase.from('kofferraum_soll').upsert({ lager_id: lagerId, artikel_id: id, menge: a.kofferraumMin }))
  }

  const vorhandeneSN = new Set((await db.eintraege.toArray()).map((e) => e.seriennummer).filter(Boolean))
  const uebersprungen: string[] = []
  const neu = []
  for (const e of alt.eintraege) {
    const sn = e.seriennummer ? normSN(e.seriennummer) : null
    if (sn && vorhandeneSN.has(sn)) { uebersprungen.push(sn); continue }
    if (sn) vorhandeneSN.add(sn)
    neu.push({
      artikel_id: artikelMap.get(e.artikelId), ort_id: ortMap.get(e.ortId), platz_id: e.platzId != null ? platzMap.get(e.platzId) : null,
      projekt_id: e.projektId != null ? projektMap.get(e.projektId) : null, seriennummer: sn, menge: e.menge, notiz: e.notiz ?? null,
      geaendert: new Date(e.geaendert ?? Date.now()).toISOString(),
    })
  }
  if (neu.length) pruefe(await supabase.from('eintraege').insert(neu))

  const map = (m: Map<number, number>, v?: number) => (v != null ? m.get(v) ?? null : null)
  const bewegungen = alt.bewegungen.map((b) => ({
    zeit: new Date(b.zeit).toISOString(), typ: b.typ, artikel_id: artikelMap.get(b.artikelId), menge: b.menge,
    seriennummer: b.seriennummer ?? null, von_ort_id: map(ortMap, b.vonOrtId), von_platz_id: map(platzMap, b.vonPlatzId),
    nach_ort_id: map(ortMap, b.nachOrtId), nach_platz_id: map(platzMap, b.nachPlatzId),
    projekt_id: map(projektMap, b.projektId), notiz: b.notiz ?? null,
  })).filter((b) => b.artikel_id)
  for (let i = 0; i < bewegungen.length; i += 500) pruefe(await supabase.from('bewegungen').insert(bewegungen.slice(i, i + 500)))

  await synchronisieren()
  return { eintraege: neu.length, uebersprungen }
}
