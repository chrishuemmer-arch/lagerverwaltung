import { db } from '../db'
import { supabase } from './supabase'
import { setAktuellesLager } from './aktuell'

type Zeile = Record<string, unknown>

const camel = (k: string) => k.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())

function umwandeln(z: Zeile): Zeile {
  const r: Zeile = {}
  for (const [k, v] of Object.entries(z)) {
    if (v === null) continue
    r[camel(k)] = (k === 'zeit' || k === 'geaendert') && typeof v === 'string' ? Date.parse(v) : v
  }
  return r
}

async function alle(tabelle: string): Promise<Zeile[]> {
  const zeilen: Zeile[] = []
  for (let von = 0; ; von += 1000) {
    const { data, error } = await supabase.from(tabelle).select('*').range(von, von + 999)
    if (error) throw new Error(error.message)
    zeilen.push(...data.map(umwandeln))
    if (data.length < 1000) return zeilen
  }
}

const TABELLEN = {
  profile: 'profile', lager: 'lager', orte: 'orte', plaetze: 'plaetze', projekte: 'projekte',
  artikel: 'artikel', soll: 'kofferraum_soll', eintraege: 'eintraege', bewegungen: 'bewegungen',
} as const

let laufend: Promise<void> | null = null
let nochmal = false

async function holen() {
  const daten = await Promise.all(Object.values(TABELLEN).map(alle))
  const namen = Object.keys(TABELLEN) as (keyof typeof TABELLEN)[]
  await db.transaction('rw', namen.map((n) => db.table(n)), async () => {
    for (const [i, n] of namen.entries()) {
      await db.table(n).clear()
      await db.table(n).bulkAdd(daten[i])
    }
  })
}

export async function synchronisieren(): Promise<void> {
  if (laufend) {
    nochmal = true
    return laufend
  }
  laufend = (async () => {
    try {
      do {
        nochmal = false
        await holen()
      } while (nochmal)
    } finally {
      laufend = null
    }
  })()
  return laufend
}

export function liveAbgleich(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const spaeter = () => { clearTimeout(timer); timer = setTimeout(() => synchronisieren().catch(console.error), 300) }
  const kanal = supabase.channel('aenderungen')
    .on('postgres_changes', { event: '*', schema: 'public' }, spaeter)
    .subscribe()
  const sichtbar = () => document.visibilityState === 'visible' && spaeter()
  document.addEventListener('visibilitychange', sichtbar)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', sichtbar)
    supabase.removeChannel(kanal)
  }
}

export async function cacheLeeren() {
  await Promise.all(Object.keys(TABELLEN).map((n) => db.table(n).clear()))
}

export async function abmelden() {
  await supabase.auth.signOut()
  await cacheLeeren()
  setAktuellesLager(undefined)
}
