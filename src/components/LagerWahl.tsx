import { vergleiche } from '../db'
import { setAktuellesLager } from '../lib/aktuell'
import { useStammdaten } from '../lib/hooks'

export default function LagerWahl() {
  const s = useStammdaten()
  if (!s?.ich || !s.lager.length) return null
  const fremd = s.aktuell && s.aktuell.verantwortlich !== s.ich.id
  return (
    <header className={fremd ? 'kopf fremd' : 'kopf'}>
      <label>
        {fremd ? 'Fremdes Lager:' : 'Aktuelles Lager:'}
        <select value={s.aktuell?.id ?? ''} onChange={(e) => setAktuellesLager(Number(e.target.value) || undefined)}>
          {!s.aktuell && <option value="">– wählen –</option>}
          {[...s.lager].sort((a, b) => vergleiche(a.name, b.name)).map((l) => (
            <option key={l.id} value={l.id}>{l.name}{l.verantwortlich === s.ich!.id ? ' (meins)' : ''}</option>
          ))}
        </select>
      </label>
    </header>
  )
}

export function Wechseln({ s, ortId }: { s: NonNullable<ReturnType<typeof useStammdaten>>; ortId: number }) {
  const l = s.lagerMap.get(s.ort.get(ortId)?.lagerId ?? 0)
  if (!l) return null
  return (
    <p className="hinweis">
      Liegt im Lager „{l.name}“. Ändern geht nur im aktuellen Lager.{' '}
      <button type="button" className="link" onClick={() => setAktuellesLager(l.id)}>Zu „{l.name}“ wechseln</button>
    </p>
  )
}
