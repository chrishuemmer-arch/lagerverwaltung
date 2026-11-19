import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vergleiche } from '../db'
import { useStammdaten } from '../lib/hooks'

export default function Projekte() {
  const s = useStammdaten()
  const zaehler = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const e of await db.eintraege.toArray()) if (e.projektId != null) m.set(e.projektId, (m.get(e.projektId) ?? 0) + e.menge)
    return m
  })
  const [name, setName] = useState('')
  const [archivZeigen, setArchivZeigen] = useState(false)
  if (!s || !zaehler) return null

  async function neu(ev: FormEvent) {
    ev.preventDefault()
    if (name.trim()) await db.projekte.add({ name: name.trim() })
    setName('')
  }

  const liste = s.projekte.filter((p) => archivZeigen || !p.archiviert).sort((a, b) => vergleiche(a.name, b.name))
  return (
    <>
      <h1>Projekte</h1>
      <form onSubmit={neu} className="suche">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neues Projekt" />
        <button type="submit" className="primaer">Anlegen</button>
      </form>
      <ul className="liste">
        {liste.map((p) => (
          <li key={p.id} className="karte">
            <div className="eintrag">
              <Link to={`/?projekt=${p.id}`}>
                <strong>{p.name}</strong>
                <small>{zaehler.get(p.id) ?? 0} Stück{p.archiviert ? ' · archiviert' : ''}</small>
              </Link>
              <span className="zeile eng">
                <button type="button" onClick={async () => { const n = prompt('Name', p.name)?.trim(); if (n) await db.projekte.update(p.id, { name: n }) }}>Umbenennen</button>
                <button type="button" onClick={() => db.projekte.update(p.id, { archiviert: !p.archiviert })}>{p.archiviert ? 'Reaktivieren' : 'Archivieren'}</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {s.projekte.some((p) => p.archiviert) && (
        <label className="check"><input type="checkbox" checked={archivZeigen} onChange={(e) => setArchivZeigen(e.target.checked)} /> Archivierte zeigen</label>
      )}
    </>
  )
}
