import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vergleiche, type Artikel } from '../db'
import { useStammdaten } from '../lib/hooks'
import { artikelLoeschen } from '../lib/ops'
import EintragZeile from '../components/EintragZeile'

export function ArtikelListe() {
  const s = useStammdaten()
  const summen = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const e of await db.eintraege.toArray()) m.set(e.artikelId, (m.get(e.artikelId) ?? 0) + e.menge)
    return m
  })
  const [suche, setSuche] = useState('')
  if (!s || !summen) return null
  const q = suche.toLowerCase()
  const liste = s.artikel.filter((a) => !q || a.name.toLowerCase().includes(q) || a.kategorie?.toLowerCase().includes(q))
    .sort((a, b) => vergleiche(a.kategorie ?? '', b.kategorie ?? '') || vergleiche(a.name, b.name))
  return (
    <>
      <h1>Artikel</h1>
      <input type="search" placeholder="Suchen…" value={suche} onChange={(e) => setSuche(e.target.value)} />
      <ul className="liste">
        {liste.map((a) => (
          <li key={a.id}>
            <Link to={`/artikel/${a.id}`} className="eintrag">
              <div>
                <strong>{a.name}</strong>
                <small>{a.kategorie ?? 'ohne Kategorie'} · {summen.get(a.id) ?? 0} Stk.{a.mitSeriennummer ? ' · mit SN' : ''}</small>
              </div>
              {a.kofferraumMin > 0 && <span className="tag">Kofferraum ≥ {a.kofferraumMin}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {!s.artikel.length && <p className="leer">Artikel entstehen beim <Link to="/einlagern">Einlagern</Link>.</p>}
    </>
  )
}

export function ArtikelDetail() {
  const id = Number(useParams().id)
  const s = useStammdaten()
  const eintraege = useLiveQuery(() => db.eintraege.where('artikelId').equals(id).toArray(), [id])
  const navigate = useNavigate()
  const [gespeichert, setGespeichert] = useState(false)
  if (!s || !eintraege) return null
  const a = s.art.get(id)
  if (!a) return <p className="leer">Artikel nicht gefunden.</p>
  const kategorien = [...new Set(s.artikel.map((x) => x.kategorie).filter(Boolean))] as string[]

  async function aendern(felder: Partial<Artikel>) {
    await db.artikel.update(id, felder)
    setGespeichert(true)
    setTimeout(() => setGespeichert(false), 1200)
  }

  return (
    <>
      <h1>{a.name}</h1>
      <div className="formular karte">
        <label>Name<input defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && aendern({ name: e.target.value.trim() })} /></label>
        <label>
          Kategorie
          <input defaultValue={a.kategorie} list="kat" onBlur={(e) => e.target.value !== (a.kategorie ?? '') && aendern({ kategorie: e.target.value.trim() || undefined })} />
          <datalist id="kat">{kategorien.map((k) => <option key={k} value={k} />)}</datalist>
        </label>
        <label>
          Mindestmenge im Kofferraum
          <input type="number" min={0} defaultValue={a.kofferraumMin} onBlur={(e) => Number(e.target.value) !== a.kofferraumMin && aendern({ kofferraumMin: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={a.mitSeriennummer} onChange={(e) => aendern({ mitSeriennummer: e.target.checked })} />
          Hat Seriennummern
        </label>
        {gespeichert && <p className="ok">Gespeichert ✓</p>}
      </div>
      <p><Link to={`/einlagern?artikel=${id}`}>+ Einlagern</Link></p>
      <h2>Bestand ({eintraege.reduce((n, e) => n + e.menge, 0)} Stk.)</h2>
      <ul className="liste">{eintraege.map((e) => <EintragZeile key={e.id} s={s} e={e} />)}</ul>
      <button type="button" className="gefahr" onClick={async () => {
        const stk = eintraege.reduce((n, e) => n + e.menge, 0)
        const frage = stk
          ? `„${a.name}“ komplett löschen? Damit werden auch ${stk} Stk. aus dem Bestand und der Verlauf gelöscht.`
          : `„${a.name}“ löschen?`
        if (!confirm(frage)) return
        await artikelLoeschen(id)
        navigate('/artikel', { replace: true })
      }}>Artikel löschen</button>
    </>
  )
}
