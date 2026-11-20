import Dexie, { type EntityTable } from 'dexie'

// Lokale Kopie der zentralen Supabase-Datenbank. Wird nur von sync.ts beschrieben.

export type OrtTyp = 'lager' | 'kofferraum'

export interface Profil {
  id: string
  name: string
  freigegeben: boolean
  admin: boolean
}

export interface Lager {
  id: number
  name: string
  verantwortlich?: string
}

export interface Ort {
  id: number
  lagerId: number
  name: string
  typ: OrtTyp
}

export interface Platz {
  id: number
  ortId: number
  regal: string
  nummer: string
  notiz?: string
}

export interface Projekt {
  id: number
  name: string
  archiviert?: boolean
}

export interface Artikel {
  id: number
  name: string
  kategorie?: string
  mitSeriennummer: boolean
}

export interface Soll {
  lagerId: number
  artikelId: number
  menge: number
}

export interface Eintrag {
  id: number
  artikelId: number
  ortId: number
  platzId?: number
  projektId?: number
  seriennummer?: string
  menge: number
  notiz?: string
  geaendert: number
}

export type BewegungTyp = 'einlagern' | 'entnehmen' | 'umlagern' | 'korrektur'

export interface Bewegung {
  id: number
  zeit: number
  typ: BewegungTyp
  artikelId: number
  menge: number
  seriennummer?: string
  vonOrtId?: number
  vonPlatzId?: number
  nachOrtId?: number
  nachPlatzId?: number
  projektId?: number
  notiz?: string
  userId?: string
}

export const db = new Dexie('lager-cache') as Dexie & {
  profile: EntityTable<Profil, 'id'>
  lager: EntityTable<Lager, 'id'>
  orte: EntityTable<Ort, 'id'>
  plaetze: EntityTable<Platz, 'id'>
  projekte: EntityTable<Projekt, 'id'>
  artikel: EntityTable<Artikel, 'id'>
  soll: Dexie.Table<Soll, [number, number]>
  eintraege: EntityTable<Eintrag, 'id'>
  bewegungen: EntityTable<Bewegung, 'id'>
}

db.version(1).stores({
  profile: 'id',
  lager: 'id',
  orte: 'id, lagerId',
  plaetze: 'id, ortId',
  projekte: 'id',
  artikel: 'id, name',
  soll: '[lagerId+artikelId], lagerId',
  eintraege: 'id, artikelId, ortId, platzId, projektId, seriennummer',
  bewegungen: 'id, zeit, artikelId',
})

export function platzCode(p: Pick<Platz, 'regal' | 'nummer'>): string {
  return p.regal ? `${p.regal}-${p.nummer}` : p.nummer
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })
export const vergleiche = (a: string, b: string) => collator.compare(a, b)

export function sortierePlaetze(plaetze: Platz[]): Platz[] {
  return [...plaetze].sort((a, b) => vergleiche(a.regal, b.regal) || vergleiche(a.nummer, b.nummer))
}

export function normSN(sn: string): string {
  return sn.trim().toUpperCase()
}
