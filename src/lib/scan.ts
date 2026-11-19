import { db, normSN } from '../db'

export const PLATZ_PREFIX = 'LV-PLATZ:'

export async function scanZiel(text: string): Promise<string> {
  const t = text.trim()
  if (t.startsWith(PLATZ_PREFIX)) {
    const id = Number(t.slice(PLATZ_PREFIX.length))
    if (await db.plaetze.get(id)) return `/platz/${id}`
  }
  const e = await db.eintraege.where('seriennummer').equals(normSN(t)).first()
  if (e) return `/eintrag/${e.id}`
  return `/einlagern?sn=${encodeURIComponent(t)}`
}
