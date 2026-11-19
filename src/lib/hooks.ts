import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode, type Artikel, type Ort, type Platz, type Projekt, type Eintrag } from '../db'

export interface Stammdaten {
  orte: Ort[]
  plaetze: Platz[]
  projekte: Projekt[]
  artikel: Artikel[]
  ort: Map<number, Ort>
  platz: Map<number, Platz>
  projekt: Map<number, Projekt>
  art: Map<number, Artikel>
}

export function useStammdaten(): Stammdaten | undefined {
  return useLiveQuery(async () => {
    const [orte, plaetze, projekte, artikel] = await Promise.all([
      db.orte.toArray(), db.plaetze.toArray(), db.projekte.toArray(), db.artikel.toArray(),
    ])
    return {
      orte, plaetze, projekte, artikel,
      ort: new Map(orte.map((o) => [o.id, o])),
      platz: new Map(plaetze.map((p) => [p.id, p])),
      projekt: new Map(projekte.map((p) => [p.id, p])),
      art: new Map(artikel.map((a) => [a.id, a])),
    }
  })
}

export function ortText(s: Stammdaten, e: Pick<Eintrag, 'ortId' | 'platzId'>): string {
  const ort = s.ort.get(e.ortId)?.name ?? '?'
  const p = e.platzId != null ? s.platz.get(e.platzId) : undefined
  return p ? `${ort} · ${platzCode(p)}` : ort
}

export function kofferraumIds(s: Stammdaten): Set<number> {
  return new Set(s.orte.filter((o) => o.typ === 'kofferraum').map((o) => o.id))
}
