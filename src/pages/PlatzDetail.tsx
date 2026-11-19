import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode } from '../db'
import { useStammdaten } from '../lib/hooks'
import EintragZeile from '../components/EintragZeile'

export default function PlatzDetail() {
  const id = Number(useParams().id)
  const s = useStammdaten()
  const eintraege = useLiveQuery(() => db.eintraege.where('platzId').equals(id).toArray(), [id])
  const navigate = useNavigate()
  const [notiz, setNotiz] = useState<string>()
  if (!s || !eintraege) return null
  const p = s.platz.get(id)
  if (!p) return <p className="leer">Platz nicht gefunden. <Link to="/orte">Orte</Link></p>

  return (
    <>
      <p className="hinweis"><Link to="/orte">{s.ort.get(p.ortId)?.name}</Link></p>
      <h1>Platz {platzCode(p)}</h1>
      {notiz === undefined ? (
        <p><button type="button" className="link" onClick={() => setNotiz(p.notiz ?? '')}>{p.notiz || 'Beschreibung hinzufügen'}</button></p>
      ) : (
        <div className="suche">
          <input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. oben links, Kiste blau" autoFocus />
          <button type="button" onClick={async () => { await db.plaetze.update(id, { notiz: notiz.trim() || undefined }); setNotiz(undefined) }}>OK</button>
        </div>
      )}
      <button type="button" className="primaer gross" onClick={() => navigate(`/einlagern?platz=${id}`)}>Hier einlagern</button>
      <h2>Inhalt ({eintraege.length})</h2>
      {eintraege.length ? <ul className="liste">{eintraege.map((e) => <EintragZeile key={e.id} s={s} e={e} ohneOrt />)}</ul> : <p className="hinweis">Leer.</p>}
    </>
  )
}
