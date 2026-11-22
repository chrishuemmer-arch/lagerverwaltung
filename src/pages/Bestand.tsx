import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode, vergleiche } from '../db'
import { useStammdaten } from '../lib/hooks'
import { scanZiel } from '../lib/scan'
import EintragZeile from '../components/EintragZeile'

const Scanner = lazy(() => import('../components/Scanner'))

export default function Bestand() {
  const s = useStammdaten()
  const eintraege = useLiveQuery(() => db.eintraege.toArray())
  const [params, setParams] = useSearchParams()
  const [suche, setSuche] = useState('')
  const [scannen, setScannen] = useState(false)
  const navigate = useNavigate()
  const projektId = Number(params.get('projekt')) || undefined
  const ortId = Number(params.get('ort')) || undefined
  const lagerId = Number(params.get('lager')) || undefined

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
      .filter((e) => (!projektId || e.projektId === projektId) && (!ortId || e.ortId === ortId)
        && (!lagerId || s.ort.get(e.ortId)?.lagerId === lagerId))
      .filter((e) => {
        if (!q) return true
        const art = s.art.get(e.artikelId)
        const p = e.platzId != null ? s.platz.get(e.platzId) : undefined
        const felder = [art?.name, art?.kategorie, e.seriennummer, e.notiz, p && platzCode(p),
          e.projektId != null ? s.projekt.get(e.projektId)?.name : undefined]
        return felder.some((f) => f?.toLowerCase().includes(q))
      })
      .sort((a, b) => vergleiche(s.art.get(a.artikelId)?.name ?? '', s.art.get(b.artikelId)?.name ?? ''))
  }, [s, eintraege, suche, projektId, ortId, lagerId])

  if (!s || !eintraege) return null
  const summe = liste.reduce((n, e) => n + e.menge, 0)

  return (
    <>
      <div className="suche">
        <input type="search" placeholder="Suchen: Name, SN, Platz, Projekt…" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <button type="button" className="primaer" onClick={() => setScannen(true)}>Scannen</button>
      </div>
      <div className="zeile">
        <select value={projektId ?? ''} onChange={(e) => setFilter('projekt', Number(e.target.value))}>
          <option value="">Alle Projekte</option>
          {s.projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={lagerId ?? ''} onChange={(e) => { const p = new URLSearchParams(params); p.delete('ort'); if (e.target.value) p.set('lager', e.target.value); else p.delete('lager'); setParams(p, { replace: true }) }}>
          <option value="">Alle Lager</option>
          {[...s.lager].sort((a, b) => vergleiche(a.name, b.name)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {lagerId && (
          <select value={ortId ?? ''} onChange={(e) => setFilter('ort', Number(e.target.value))}>
            <option value="">Alle Orte</option>
            {s.orte.filter((o) => o.lagerId === lagerId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
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
