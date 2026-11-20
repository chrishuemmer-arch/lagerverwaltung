import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode, type Artikel, type Eintrag, type Lager, type Ort, type Platz, type Profil, type Projekt, type Soll } from '../db'
import { useAktuellesLager, useNutzer } from './aktuell'

export interface Stammdaten {
  lager: Lager[]
  orte: Ort[]
  plaetze: Platz[]
  projekte: Projekt[]
  artikel: Artikel[]
  soll: Soll[]
  lagerMap: Map<number, Lager>
  ort: Map<number, Ort>
  platz: Map<number, Platz>
  projekt: Map<number, Projekt>
  art: Map<number, Artikel>
  profil: Map<string, Profil>
  /** Lager, in dem gerade geändert werden darf */
  aktuell?: Lager
  ich?: Profil
}

export function useStammdaten(): Stammdaten | undefined {
  const aktuellId = useAktuellesLager()
  const nutzer = useNutzer()
  return useLiveQuery(async () => {
    const [lager, orte, plaetze, projekte, artikel, soll, profile] = await Promise.all([
      db.lager.toArray(), db.orte.toArray(), db.plaetze.toArray(), db.projekte.toArray(),
      db.artikel.toArray(), db.soll.toArray(), db.profile.toArray(),
    ])
    const lagerMap = new Map(lager.map((l) => [l.id, l]))
    return {
      lager, orte, plaetze, projekte, artikel, soll, lagerMap,
      ort: new Map(orte.map((o) => [o.id, o])),
      platz: new Map(plaetze.map((p) => [p.id, p])),
      projekt: new Map(projekte.map((p) => [p.id, p])),
      art: new Map(artikel.map((a) => [a.id, a])),
      profil: new Map(profile.map((p) => [p.id, p])),
      aktuell: aktuellId ? lagerMap.get(aktuellId) : undefined,
      ich: nutzer ? profile.find((p) => p.id === nutzer) : undefined,
    }
  }, [aktuellId, nutzer])
}

/** Orte des aktuellen Lagers */
export const meineOrte = (s: Stammdaten) => s.orte.filter((o) => o.lagerId === s.aktuell?.id)

export const imAktuellen = (s: Stammdaten, ortId: number) => s.ort.get(ortId)?.lagerId === s.aktuell?.id

export function ortName(s: Stammdaten, ortId: number): string {
  const o = s.ort.get(ortId)
  if (!o) return '?'
  return o.lagerId === s.aktuell?.id ? o.name : `${s.lagerMap.get(o.lagerId)?.name ?? '?'} · ${o.name}`
}

export function ortText(s: Stammdaten, e: Pick<Eintrag, 'ortId' | 'platzId'>): string {
  const p = e.platzId != null ? s.platz.get(e.platzId) : undefined
  return p ? `${ortName(s, e.ortId)} · ${platzCode(p)}` : ortName(s, e.ortId)
}

export const kofferraumVon = (s: Stammdaten, lagerId?: number) => s.orte.find((o) => o.lagerId === lagerId && o.typ === 'kofferraum')

export const sollMenge = (s: Stammdaten, artikelId: number, lagerId = s.aktuell?.id) =>
  s.soll.find((x) => x.lagerId === lagerId && x.artikelId === artikelId)?.menge ?? 0
