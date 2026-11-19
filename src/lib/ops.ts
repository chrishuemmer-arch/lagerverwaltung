import { db, normSN, type Eintrag } from '../db'

function pruefeMenge(menge: number) {
  if (!Number.isInteger(menge) || menge < 1) throw new Error('Menge muss eine ganze Zahl ab 1 sein')
}

interface Ziel {
  ortId: number
  platzId?: number
  projektId?: number
}

export async function einlagern(daten: {
  artikelId: number
  menge: number
  seriennummer?: string
  notiz?: string
} & Ziel): Promise<number> {
  return db.transaction('rw', db.eintraege, db.bewegungen, db.artikel, async () => {
    const artikel = await db.artikel.get(daten.artikelId)
    if (!artikel) throw new Error('Artikel nicht gefunden')
    const sn = daten.seriennummer ? normSN(daten.seriennummer) || undefined : undefined
    if (artikel.mitSeriennummer && !sn) throw new Error('Seriennummer fehlt')
    if (!sn) pruefeMenge(daten.menge)
    let id: number
    if (sn) {
      const vorhanden = await db.eintraege.where('seriennummer').equals(sn).first()
      if (vorhanden) throw new Error(`Seriennummer ${sn} ist schon im Bestand`)
      id = await db.eintraege.add({
        artikelId: daten.artikelId, ortId: daten.ortId, platzId: daten.platzId,
        projektId: daten.projektId, seriennummer: sn, menge: 1, notiz: daten.notiz || undefined,
        geaendert: Date.now(),
      })
    } else {
      const gleich = await findeGleichen(daten.artikelId, daten)
      if (gleich) {
        await db.eintraege.update(gleich.id, { menge: gleich.menge + daten.menge, geaendert: Date.now() })
        id = gleich.id
      } else {
        id = await db.eintraege.add({
          artikelId: daten.artikelId, ortId: daten.ortId, platzId: daten.platzId,
          projektId: daten.projektId, menge: daten.menge, notiz: daten.notiz || undefined,
          geaendert: Date.now(),
        })
      }
    }
    await db.bewegungen.add({
      zeit: Date.now(), typ: 'einlagern', artikelId: daten.artikelId, menge: sn ? 1 : daten.menge,
      seriennummer: sn, nachOrtId: daten.ortId, nachPlatzId: daten.platzId, projektId: daten.projektId,
      notiz: daten.notiz || undefined,
    })
    return id
  })
}

async function findeGleichen(artikelId: number, z: Ziel, ausser?: number): Promise<Eintrag | undefined> {
  const liste = await db.eintraege.where('artikelId').equals(artikelId).toArray()
  return liste.find((e) => e.id !== ausser && !e.seriennummer && e.ortId === z.ortId
    && (e.platzId ?? null) === (z.platzId ?? null) && (e.projektId ?? null) === (z.projektId ?? null))
}

export async function entnehmen(eintragId: number, menge: number, notiz?: string) {
  pruefeMenge(menge)
  await db.transaction('rw', db.eintraege, db.bewegungen, async () => {
    const e = await db.eintraege.get(eintragId)
    if (!e) throw new Error('Eintrag nicht gefunden')
    const m = Math.min(menge, e.menge)
    if (m >= e.menge) await db.eintraege.delete(e.id)
    else await db.eintraege.update(e.id, { menge: e.menge - m, geaendert: Date.now() })
    await db.bewegungen.add({
      zeit: Date.now(), typ: 'entnehmen', artikelId: e.artikelId, menge: m, seriennummer: e.seriennummer,
      vonOrtId: e.ortId, vonPlatzId: e.platzId, projektId: e.projektId, notiz: notiz || undefined,
    })
  })
}

export async function umlagern(eintragId: number, menge: number, ziel: Ziel, notiz?: string) {
  pruefeMenge(menge)
  await db.transaction('rw', db.eintraege, db.bewegungen, async () => {
    const e = await db.eintraege.get(eintragId)
    if (!e) throw new Error('Eintrag nicht gefunden')
    const m = Math.min(menge, e.menge)
    if (e.seriennummer || m >= e.menge) {
      const gleich = e.seriennummer ? undefined : await findeGleichen(e.artikelId, ziel, e.id)
      if (gleich) {
        await db.eintraege.update(gleich.id, { menge: gleich.menge + e.menge, geaendert: Date.now() })
        await db.eintraege.delete(e.id)
      } else {
        await db.eintraege.update(e.id, {
          ortId: ziel.ortId, platzId: ziel.platzId, projektId: ziel.projektId, geaendert: Date.now(),
        })
      }
    } else {
      await db.eintraege.update(e.id, { menge: e.menge - m, geaendert: Date.now() })
      const gleich = await findeGleichen(e.artikelId, ziel)
      if (gleich) await db.eintraege.update(gleich.id, { menge: gleich.menge + m, geaendert: Date.now() })
      else await db.eintraege.add({
        artikelId: e.artikelId, ortId: ziel.ortId, platzId: ziel.platzId, projektId: ziel.projektId,
        menge: m, notiz: e.notiz, geaendert: Date.now(),
      })
    }
    await db.bewegungen.add({
      zeit: Date.now(), typ: 'umlagern', artikelId: e.artikelId, menge: m, seriennummer: e.seriennummer,
      vonOrtId: e.ortId, vonPlatzId: e.platzId, nachOrtId: ziel.ortId, nachPlatzId: ziel.platzId,
      projektId: ziel.projektId, notiz: notiz || undefined,
    })
  })
}

export async function artikelLoeschen(artikelId: number) {
  await db.transaction('rw', db.artikel, db.eintraege, db.bewegungen, async () => {
    await db.eintraege.where('artikelId').equals(artikelId).delete()
    await db.bewegungen.where('artikelId').equals(artikelId).delete()
    await db.artikel.delete(artikelId)
  })
}
