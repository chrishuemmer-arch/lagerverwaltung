import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vergleiche, type Eintrag } from '../db'
import { kofferraumIds, ortText, useStammdaten } from '../lib/hooks'
import { umlagern } from '../lib/ops'
import EintragZeile from '../components/EintragZeile'

export default function Kofferraum() {
  const s = useStammdaten()
  const eintraege = useLiveQuery(() => db.eintraege.toArray())
  const [laeuft, setLaeuft] = useState(false)
  const sperre = useRef(false)
  if (!s || !eintraege) return null
  const kIds = kofferraumIds(s)
  const kofferraum = s.orte.find((o) => o.typ === 'kofferraum')
  if (!kofferraum) return <p className="leer">Kein Ort vom Typ „Kofferraum“ angelegt. <Link to="/orte">Orte verwalten</Link></p>

  const soll = s.artikel.filter((a) => a.kofferraumMin > 0).sort((a, b) => vergleiche(a.name, b.name))
  const zeilen = soll.map((a) => {
    const ist = eintraege.filter((e) => e.artikelId === a.id && kIds.has(e.ortId)).reduce((n, e) => n + e.menge, 0)
    const nachschub = eintraege.filter((e) => e.artikelId === a.id && !kIds.has(e.ortId))
    return { a, ist, fehlt: Math.max(0, a.kofferraumMin - ist), nachschub }
  })
  const fehlend = zeilen.filter((z) => z.fehlt > 0)
  const imKofferraum = eintraege.filter((e) => kIds.has(e.ortId))
    .sort((a, b) => vergleiche(s.art.get(a.artikelId)?.name ?? '', s.art.get(b.artikelId)?.name ?? ''))

  async function einpacken(e: Eintrag, menge: number) {
    if (sperre.current) return
    sperre.current = true
    setLaeuft(true)
    try {
      await umlagern(e.id, menge, { ortId: kofferraum!.id, projektId: e.projektId }, 'Kofferraum aufgefüllt')
    } finally {
      sperre.current = false
      setLaeuft(false)
    }
  }

  return (
    <>
      <h1>Kofferraum</h1>
      {soll.length === 0 ? (
        <p className="leer">Noch keine Mindestmengen festgelegt. Öffne einen <Link to="/artikel">Artikel</Link> und trag ein, wie viele davon immer im Kofferraum sein sollen.</p>
      ) : fehlend.length === 0 ? (
        <p className="ok gross-text">Alles da ✓</p>
      ) : (
        <p className="fehler gross-text">{fehlend.length} {fehlend.length === 1 ? 'Artikel fehlt' : 'Artikel fehlen'}</p>
      )}
      <ul className="liste">
        {zeilen.map(({ a, ist, fehlt, nachschub }) => (
          <li key={a.id} className={fehlt ? 'karte fehlt' : 'karte'}>
            <div className="eintrag">
              <div>
                <Link to={`/artikel/${a.id}`}><strong>{a.name}</strong></Link>
                <small>{ist} von {a.kofferraumMin} an Bord</small>
              </div>
              <span className={fehlt ? 'tag rot' : 'tag gruen'}>{fehlt ? `−${fehlt}` : 'OK'}</span>
            </div>
            {fehlt > 0 && (nachschub.length ? (
              <ul className="nachschub">
                {nachschub.map((e) => (
                  <li key={e.id}>
                    <span>{ortText(s, e)} {e.seriennummer ? <code>{e.seriennummer}</code> : `(${e.menge} Stk.)`}</span>
                    <button type="button" disabled={laeuft} onClick={() => einpacken(e, Math.min(fehlt, e.menge))}>
                      {e.seriennummer ? 'Eingepackt' : `${Math.min(fehlt, e.menge)} eingepackt`}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="hinweis">Kein Nachschub im Lager – nachkaufen!</p>)}
          </li>
        ))}
      </ul>
      <h2>Aktuell im Kofferraum</h2>
      {imKofferraum.length ? <ul className="liste">{imKofferraum.map((e) => <EintragZeile key={e.id} s={s} e={e} />)}</ul> : <p className="hinweis">Leer.</p>}
    </>
  )
}
