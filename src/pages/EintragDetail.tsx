import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Bewegung } from '../db'
import { ortText, useStammdaten, type Stammdaten } from '../lib/hooks'
import { entnehmen, umlagern } from '../lib/ops'
import OrtWahl, { ProjektWahl, type OrtWert } from '../components/OrtWahl'

export default function EintragDetail() {
  const id = Number(useParams().id)
  const s = useStammdaten()
  const e = useLiveQuery(() => db.eintraege.get(id), [id])
  const verlauf = useLiveQuery(async () => {
    const x = await db.eintraege.get(id)
    if (!x) return []
    const alle = await db.bewegungen.where('artikelId').equals(x.artikelId).reverse().sortBy('zeit')
    return x.seriennummer ? alle.filter((b) => b.seriennummer === x.seriennummer) : alle.slice(0, 20)
  }, [id])
  const navigate = useNavigate()
  const [modus, setModus] = useState<'umlagern' | 'entnehmen'>()
  const [menge, setMenge] = useState(1)
  const [ziel, setZiel] = useState<OrtWert>({})
  const [zielProjekt, setZielProjekt] = useState<number | null>(null)
  const [notiz, setNotiz] = useState('')
  const [notizBearbeiten, setNotizBearbeiten] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const sperre = useRef(false)

  if (!s || e === undefined) return e === undefined && s ? <p className="leer">Eintrag nicht (mehr) vorhanden. <Link to="/">Zum Bestand</Link></p> : null
  const art = s.art.get(e.artikelId)
  const projekt = e.projektId != null ? s.projekt.get(e.projektId) : undefined

  async function ausfuehren() {
    if (sperre.current) return
    sperre.current = true
    setLaeuft(true)
    try {
      await bewegen()
    } catch (x) {
      alert((x as Error).message)
    } finally {
      sperre.current = false
      setLaeuft(false)
    }
  }

  async function bewegen() {
    if (modus === 'entnehmen') {
      const rest = e!.menge - menge
      await entnehmen(e!.id, menge, notiz)
      if (rest <= 0) navigate('/', { replace: true })
    } else if (modus === 'umlagern' && ziel.ortId) {
      await umlagern(e!.id, menge, { ...ziel, ortId: ziel.ortId, projektId: zielProjekt === null ? e!.projektId : zielProjekt || undefined }, notiz)
      if (!e!.seriennummer && menge < e!.menge) setModus(undefined)
      else if (!(await db.eintraege.get(e!.id))) navigate('/', { replace: true })
    }
    setModus(undefined)
    setNotiz('')
    setMenge(1)
  }

  return (
    <>
      <h1>{art?.name}</h1>
      <dl className="details">
        {art?.kategorie && <><dt>Kategorie</dt><dd>{art.kategorie}</dd></>}
        {e.seriennummer ? <><dt>Seriennummer</dt><dd><code>{e.seriennummer}</code></dd></> : <><dt>Menge</dt><dd>{e.menge} Stk.</dd></>}
        <dt>Ort</dt>
        <dd>{e.platzId != null ? <Link to={`/platz/${e.platzId}`}>{ortText(s, e)}</Link> : ortText(s, e)}</dd>
        <dt>Projekt</dt>
        <dd>{projekt ? <Link to={`/?projekt=${projekt.id}`}>{projekt.name}</Link> : '–'}</dd>
        <dt>Notiz</dt>
        <dd>
          {notizBearbeiten === undefined ? (
            <button type="button" className="link" onClick={() => setNotizBearbeiten(e.notiz ?? '')}>{e.notiz || 'hinzufügen'}</button>
          ) : (
            <span className="suche">
              <input value={notizBearbeiten} onChange={(x) => setNotizBearbeiten(x.target.value)} autoFocus />
              <button type="button" onClick={async () => {
                await db.eintraege.update(e.id, { notiz: notizBearbeiten.trim() || undefined, geaendert: Date.now() })
                setNotizBearbeiten(undefined)
              }}>OK</button>
            </span>
          )}
        </dd>
      </dl>

      {!modus && (
        <div className="zeile">
          <button type="button" className="primaer gross" onClick={() => { setModus('umlagern'); setZiel({ ortId: e.ortId, platzId: e.platzId }); setZielProjekt(null) }}>Umlagern</button>
          <button type="button" className="gross" onClick={() => setModus('entnehmen')}>Entnehmen</button>
        </div>
      )}
      {modus && (
        <div className="formular karte">
          <h2>{modus === 'umlagern' ? 'Umlagern' : 'Entnehmen'}</h2>
          {e.menge > 1 && (
            <label>Menge (von {e.menge})<input type="number" min={1} max={e.menge} value={menge} onChange={(x) => setMenge(Number(x.target.value))} /></label>
          )}
          {modus === 'umlagern' && (
            <>
              <OrtWahl s={s} wert={ziel} onChange={setZiel} />
              <ProjektWahl s={s} wert={zielProjekt ?? e.projektId} onChange={(p) => setZielProjekt(p ?? 0)} />
            </>
          )}
          <label>Notiz<input value={notiz} onChange={(x) => setNotiz(x.target.value)} placeholder={modus === 'entnehmen' ? 'z. B. verbaut bei Kunde X' : 'optional'} /></label>
          <div className="zeile">
            <button type="button" className="primaer" onClick={ausfuehren} disabled={laeuft}>Bestätigen</button>
            <button type="button" onClick={() => setModus(undefined)}>Abbrechen</button>
          </div>
        </div>
      )}

      <p><Link to={`/einlagern?artikel=${e.artikelId}${e.platzId != null ? `&platz=${e.platzId}` : ''}`}>+ Weitere von diesem Artikel einlagern</Link> · <Link to={`/artikel/${e.artikelId}`}>Artikel bearbeiten</Link></p>

      <h2>Verlauf</h2>
      <Verlauf s={s} liste={verlauf ?? []} />
    </>
  )
}

export function Verlauf({ s, liste }: { s: Stammdaten; liste: Bewegung[] }) {
  if (!liste.length) return <p className="hinweis">Keine Bewegungen.</p>
  const ort = (o?: number, p?: number) => (o != null ? ortText(s, { ortId: o, platzId: p }) : '')
  return (
    <ul className="verlauf">
      {liste.map((b) => (
        <li key={b.id}>
          <small>{new Date(b.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small>
          <span>
            <strong>{b.typ}</strong> {s.art.get(b.artikelId)?.name} {b.seriennummer ? `(${b.seriennummer})` : `×${b.menge}`}
            {b.vonOrtId != null && <> von {ort(b.vonOrtId, b.vonPlatzId)}</>}
            {b.nachOrtId != null && <> nach {ort(b.nachOrtId, b.nachPlatzId)}</>}
            {b.notiz && <em> – {b.notiz}</em>}
          </span>
        </li>
      ))}
    </ul>
  )
}
