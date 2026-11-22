import { platzCode, sortierePlaetze } from '../db'
import { meineOrte, type Stammdaten } from '../lib/hooks'

export interface OrtWert {
  ortId?: number
  platzId?: number
}

export default function OrtWahl({ s, wert, onChange }: { s: Stammdaten; wert: OrtWert; onChange: (w: OrtWert) => void }) {
  const plaetze = sortierePlaetze(s.plaetze.filter((p) => p.ortId === wert.ortId))
  return (
    <div className="zeile">
      <label>
        Ort
        <select value={wert.ortId ?? ''} onChange={(e) => onChange({ ortId: Number(e.target.value) || undefined })} required>
          <option value="">– wählen –</option>
          {meineOrte(s).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <label>
        Platz
        <select
          value={wert.platzId ?? ''}
          onChange={(e) => onChange({ ...wert, platzId: Number(e.target.value) || undefined })}
          disabled={!plaetze.length}
        >
          <option value="">{plaetze.length ? '– ohne –' : 'keine Plätze'}</option>
          {plaetze.map((p) => <option key={p.id} value={p.id}>{platzCode(p)}</option>)}
        </select>
      </label>
    </div>
  )
}

export function ProjektWahl({ s, wert, onChange }: { s: Stammdaten; wert?: number; onChange: (id?: number) => void }) {
  return (
    <label>
      Projekt
      <select value={wert ?? ''} onChange={(e) => onChange(Number(e.target.value) || undefined)}>
        <option value="">– kein Projekt –</option>
        {s.projekte.filter((p) => !p.archiviert || p.id === wert).map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  )
}
