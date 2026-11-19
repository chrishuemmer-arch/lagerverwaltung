import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode, vergleiche } from '../db'
import { useStammdaten } from '../lib/hooks'
import { letztesBackup } from '../lib/backup'
import { scanZiel } from '../lib/scan'
import EintragZeile from '../components/EintragZeile'

const Scanner = lazy(() => import('../components/Scanner'))

const TAG = 24 * 60 * 60 * 1000

export default function Bestand() {
  const s = useStammdaten()
  const eintraege = useLiveQuery(() => db.eintraege.toArray())
  const [params, setParams] = useSearchParams()
  const [suche, setSuche] = useState('')
  const [scannen, setScannen] = useState(false)
  const navigate = useNavigate()
  const projektId = Number(params.get('projekt')) || undefined
  const ortId = Number(params.get('ort')) || undefined

  const setFilter = (key: string, v?: number) => {
    const p = new URLSearchParams(params)
    if (v) p.set(key, String(v))
    else p.delete(key)
    setParams(p, { replace: true })
  }

  const liste = useMemo(() => {
    if (!s || !eintraege) return []
    const q = suche.trim().toLowerCase()
    return eintraege
      .filter((e) => (!projektId || e.projektId === projektId) && (!ortId || e.ortId === ortId))
      .filter((e) => {
        if (!q) return true
        const art = s.art.get(e.artikelId)
        const p = e.platzId != null ? s.platz.get(e.platzId) : undefined
        const felder = [art?.name, art?.kategorie, e.seriennummer, e.notiz, p && platzCode(p),
          e.projektId != null ? s.projekt.get(e.projektId)?.name : undefined]
        return felder.some((f) => f?.toLowerCase().includes(q))
      })
      .sort((a, b) => vergleiche(s.art.get(a.artikelId)?.name ?? '', s.art.get(b.artikelId)?.name ?? ''))
  }, [s, eintraege, suche, projektId, ortId])

  if (!s || !eintraege) return null
  const backup = letztesBackup()
  const backupFaellig = eintraege.length > 0 && (!backup || Date.now() - backup > 14 * TAG)
  const summe = liste.reduce((n, e) => n + e.menge, 0)

  return (
    <>
      {backupFaellig && (
        <Link to="/mehr" className="banner">
          {backup ? `Letztes Backup vor ${Math.floor((Date.now() - backup) / TAG)} Tagen.` : 'Noch kein Backup gemacht.'} Jetzt sichern →
        </Link>
      )}
      <div className="suche">
        <input type="search" placeholder="Suchen: Name, SN, Platz, Projekt…" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <button type="button" className="primaer" onClick={() => setScannen(true)}>Scannen</button>
      </div>
      <div className="zeile">
        <select value={projektId ?? ''} onChange={(e) => setFilter('projekt', Number(e.target.value))}>
          <option value="">Alle Projekte</option>
          {s.projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={ortId ?? ''} onChange={(e) => setFilter('ort', Number(e.target.value))}>
          <option value="">Alle Orte</option>
          {s.orte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <p className="hinweis">{liste.length} Einträge · {summe} Stück</p>
      {eintraege.length === 0 ? (
        <div className="leer">
          <p>Noch nichts im Lager.</p>
          <p>Leg zuerst unter <Link to="/orte">Orte &amp; Plätze</Link> deine Regale an und dann geht's los mit <Link to="/einlagern">Einlagern</Link>.</p>
        </div>
      ) : (
        <ul className="liste">{liste.map((e) => <EintragZeile key={e.id} s={s} e={e} />)}</ul>
      )}
      {scannen && (
        <Suspense fallback={null}><Scanner onClose={() => setScannen(false)} onResult={async (t) => navigate(await scanZiel(t))} /></Suspense>
      )}
    </>
  )
}
