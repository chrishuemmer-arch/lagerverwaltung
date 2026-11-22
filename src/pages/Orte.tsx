import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, platzCode, sortierePlaetze, vergleiche, type Ort, type OrtTyp } from '../db'
import { meineOrte, useStammdaten } from '../lib/hooks'
import { ortAnlegen, ortLoeschen, ortUmbenennen, plaetzeAnlegen, plaetzeLoeschen } from '../lib/ops'

export default function Orte() {
  const s = useStammdaten()
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<OrtTyp>('lager')
  if (!s) return null
  if (!s.aktuell) return <p className="leer">Wähle oben ein Lager.</p>
  const lagerId = s.aktuell.id

  async function neu(ev: FormEvent) {
    ev.preventDefault()
    if (!name.trim()) return
    await ortAnlegen(lagerId, name.trim(), typ)
    setName('')
  }

  return (
    <>
      <h1>Orte &amp; Plätze</h1>
      <p className="hinweis">{s.aktuell.name}</p>
      {meineOrte(s).map((o) => <OrtKarte key={o.id} ort={o} />)}
      <form onSubmit={neu} className="formular karte">
        <h2>Neuer Ort</h2>
        <div className="zeile">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Keller" />
          <select value={typ} onChange={(e) => setTyp(e.target.value as OrtTyp)}>
            <option value="lager">Lager</option>
            <option value="kofferraum">Kofferraum</option>
          </select>
          <button type="submit">Anlegen</button>
        </div>
      </form>
    </>
  )
}

function OrtKarte({ ort }: { ort: Ort }) {
  const plaetze = useLiveQuery(() => db.plaetze.where('ortId').equals(ort.id).toArray(), [ort.id])
  const belegt = useLiveQuery(async () => {
    const liste = await db.eintraege.where('ortId').equals(ort.id).toArray()
    const m = new Map<number, number>()
    for (const e of liste) if (e.platzId != null) m.set(e.platzId, (m.get(e.platzId) ?? 0) + e.menge)
    return { m, gesamt: liste.length }
  }, [ort.id])
  const [regal, setRegal] = useState('')
  const [von, setVon] = useState(1)
  const [bis, setBis] = useState(10)
  const [offen, setOffen] = useState(false)
  if (!plaetze || !belegt) return null

  const regale = new Map<string, typeof plaetze>()
  for (const p of sortierePlaetze(plaetze)) regale.set(p.regal, [...(regale.get(p.regal) ?? []), p])

  async function anlegen(ev: FormEvent) {
    ev.preventDefault()
    const r = regal.trim()
    const bisher = plaetze!.filter((p) => p.regal === r)
    const vorhanden = new Set(bisher.map((p) => Number(p.nummer)))
    const neue = []
    const breite = Math.max(String(bis).length, ...bisher.map((p) => p.nummer.length))
    for (let n = von; n <= bis; n++) {
      if (!vorhanden.has(n)) neue.push({ ortId: ort.id, regal: r, nummer: String(n).padStart(breite, '0') })
    }
    if (neue.length) await plaetzeAnlegen(neue)
    setRegal('')
  }

  async function umbenennen() {
    const n = prompt('Neuer Name', ort.name)?.trim()
    if (n) await ortUmbenennen(ort.id, n)
  }

  async function loeschen() {
    if (belegt!.gesamt) return alert('Ort ist nicht leer – erst umlagern.')
    if (confirm(`„${ort.name}“ mit allen Plätzen löschen?`)) {
      await ortLoeschen(ort.id)
    }
  }

  async function regalLoeschen(r: string) {
    const ps = regale.get(r) ?? []
    if (ps.some((p) => belegt!.m.get(p.id))) return alert('Im Regal liegen noch Sachen – erst umlagern.')
    if (confirm(`Regal „${r || 'ohne Name'}“ mit ${ps.length} Plätzen löschen?`)) await plaetzeLoeschen(ps.map((p) => p.id))
  }

  return (
    <section className="karte">
      <div className="eintrag">
        <div>
          <strong>{ort.name}</strong>
          <small>{ort.typ === 'kofferraum' ? 'Kofferraum' : 'Lager'} · {plaetze.length} Plätze · {belegt.gesamt} Einträge</small>
        </div>
        <button type="button" onClick={() => setOffen(!offen)}>{offen ? 'Zu' : 'Bearbeiten'}</button>
      </div>
      {[...regale.entries()].sort(([a], [b]) => vergleiche(a, b)).map(([r, ps]) => (
        <div key={r} className="regal">
          <div className="regal-kopf">
            <span>Regal {r || '–'}</span>
            {offen && <button type="button" className="link" onClick={() => regalLoeschen(r)}>löschen</button>}
          </div>
          <div className="plaetze">
            {ps.map((p) => (
              <Link key={p.id} to={`/platz/${p.id}`} className={belegt.m.get(p.id) ? 'platz belegt' : 'platz'}>
                {platzCode(p)}
              </Link>
            ))}
          </div>
        </div>
      ))}
      {offen && (
        <>
          <form onSubmit={anlegen} className="formular">
            <h3>Plätze anlegen</h3>
            <div className="zeile">
              <label>Regal<input value={regal} onChange={(e) => setRegal(e.target.value)} placeholder="z. B. A" /></label>
              <label>von<input type="number" min={0} value={von} onChange={(e) => setVon(Number(e.target.value))} /></label>
              <label>bis<input type="number" min={von} value={bis} onChange={(e) => setBis(Number(e.target.value))} /></label>
            </div>
            <button type="submit">{bis - von + 1} Plätze anlegen</button>
          </form>
          <div className="zeile">
            <Link to={`/etiketten?ort=${ort.id}`} className="knopf">QR-Etiketten drucken</Link>
            <button type="button" onClick={umbenennen}>Umbenennen</button>
            <button type="button" onClick={loeschen}>Ort löschen</button>
          </div>
        </>
      )}
    </section>
  )
}
