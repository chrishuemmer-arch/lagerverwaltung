import Dexie, { type EntityTable } from 'dexie'

export type OrtTyp = 'lager' | 'kofferraum'

export interface Ort {
  id: number
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
  kofferraumMin: number
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
}

export const db = new Dexie('lagerverwaltung') as Dexie & {
  orte: EntityTable<Ort, 'id'>
  plaetze: EntityTable<Platz, 'id'>
  projekte: EntityTable<Projekt, 'id'>
  artikel: EntityTable<Artikel, 'id'>
  eintraege: EntityTable<Eintrag, 'id'>
  bewegungen: EntityTable<Bewegung, 'id'>
}

db.version(1).stores({
  orte: '++id, typ',
  plaetze: '++id, ortId',
  projekte: '++id',
  artikel: '++id, name',
  eintraege: '++id, artikelId, ortId, platzId, projektId, seriennummer',
  bewegungen: '++id, zeit, artikelId',
})

db.on('populate', async (tx) => {
  await tx.table('orte').bulkAdd([
    { name: 'Container', typ: 'lager' },
    { name: 'Kofferraum', typ: 'kofferraum' },
  ])
})

export const TABELLEN = ['orte', 'plaetze', 'projekte', 'artikel', 'eintraege', 'bewegungen'] as const

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
