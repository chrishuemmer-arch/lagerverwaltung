import { lazy, Suspense, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, normSN, vergleiche } from '../db'
import { useStammdaten } from '../lib/hooks'
import { einlagern } from '../lib/ops'
import OrtWahl, { ProjektWahl, type OrtWert } from '../components/OrtWahl'

const Scanner = lazy(() => import('../components/Scanner'))

const NEU = -1

export default function Einlagern() {
  const s = useStammdaten()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const startPlatz = Number(params.get('platz')) || undefined
  const [artikelId, setArtikelId] = useState<number | undefined>(Number(params.get('artikel')) || undefined)
  const [neuName, setNeuName] = useState('')
  const [neuKategorie, setNeuKategorie] = useState('')
  const [neuMitSN, setNeuMitSN] = useState(true)
  const [sn, setSn] = useState(params.get('sn') ?? '')
  const [menge, setMenge] = useState(1)
  const [ort, setOrt] = useState<OrtWert>({})
  const [projektId, setProjektId] = useState<number>()
  const [notiz, setNotiz] = useState('')
  const [serie, setSerie] = useState(false)
  const [scannen, setScannen] = useState(false)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string }>()

  if (!s) return null
  const effOrt: OrtWert = ort.ortId ? ort : startPlatz && s.platz.get(startPlatz)
    ? { ortId: s.platz.get(startPlatz)!.ortId, platzId: startPlatz }
    : { ortId: s.orte[0]?.id }
  const gewaehlt = artikelId && artikelId !== NEU ? s.art.get(artikelId) : undefined
  const mitSN = artikelId === NEU ? neuMitSN : !!gewaehlt?.mitSeriennummer
  const kategorien = [...new Set(s.artikel.map((a) => a.kategorie).filter(Boolean))] as string[]

  async function speichern(ev: FormEvent) {
    ev.preventDefault()
    setMeldung(undefined)
    try {
      let aid = artikelId
      if (aid === NEU) {
        const name = neuName.trim()
        const doppelt = s!.artikel.find((a) => a.name.toLowerCase() === name.toLowerCase())
        aid = doppelt?.id ?? await db.artikel.add({
          name, kategorie: neuKategorie.trim() || undefined, mitSeriennummer: neuMitSN, kofferraumMin: 0,
        })
        setArtikelId(aid)
      }
      if (!aid || !effOrt.ortId) return
      const id = await einlagern({
        artikelId: aid, ortId: effOrt.ortId, platzId: effOrt.platzId, projektId,
        seriennummer: mitSN ? sn : undefined, menge: mitSN ? 1 : menge, notiz,
      })
      if (serie) {
        setMeldung({ ok: true, text: mitSN ? `${normSN(sn)} gespeichert. Nächste Seriennummer:` : 'Gespeichert.' })
        setSn('')
        setOrt(effOrt)
      } else {
        navigate(`/eintrag/${id}`, { replace: true })
      }
    } catch (e) {
      setMeldung({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <form onSubmit={speichern} className="formular">
      <h1>Einlagern</h1>
      <label>
        Artikel
        <select value={artikelId ?? ''} onChange={(e) => setArtikelId(Number(e.target.value) || undefined)} required>
          <option value="">– wählen –</option>
          <option value={NEU}>+ Neuer Artikel…</option>
          {[...s.artikel].sort((a, b) => vergleiche(a.name, b.name)).map((a) => (
            <option key={a.id} value={a.id}>{a.name}{a.kategorie ? ` (${a.kategorie})` : ''}</option>
          ))}
        </select>
      </label>
      {artikelId === NEU && (
        <fieldset>
          <label>Name<input value={neuName} onChange={(e) => setNeuName(e.target.value)} required placeholder="z. B. Samsung 870 EVO 1TB" /></label>
          <label>
            Kategorie
            <input value={neuKategorie} onChange={(e) => setNeuKategorie(e.target.value)} list="kategorien" placeholder="z. B. SSD, RAM, Kabel" />
            <datalist id="kategorien">{kategorien.map((k) => <option key={k} value={k} />)}</datalist>
          </label>
          <label className="check">
            <input type="checkbox" checked={neuMitSN} onChange={(e) => setNeuMitSN(e.target.checked)} />
            Hat Seriennummern (jedes Stück einzeln erfassen)
          </label>
        </fieldset>
      )}
      {mitSN ? (
        <label>
          Seriennummer
          <div className="suche">
            <input value={sn} onChange={(e) => setSn(e.target.value)} required autoCapitalize="characters" autoComplete="off" />
            <button type="button" onClick={() => setScannen(true)}>Scannen</button>
          </div>
        </label>
      ) : (
        <label>Menge<input type="number" min={1} value={menge} onChange={(e) => setMenge(Number(e.target.value))} required /></label>
      )}
      <OrtWahl s={s} wert={effOrt} onChange={setOrt} />
      <ProjektWahl s={s} wert={projektId} onChange={setProjektId} />
      <label>Notiz<input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="optional" /></label>
      <label className="check">
        <input type="checkbox" checked={serie} onChange={(e) => setSerie(e.target.checked)} />
        Danach weitere erfassen (gleicher Artikel, Platz und Projekt)
      </label>
      {meldung && <p className={meldung.ok ? 'ok' : 'fehler'}>{meldung.text}</p>}
      <button type="submit" className="primaer gross">Einlagern</button>
      {scannen && (
        <Suspense fallback={null}><Scanner titel="Seriennummer scannen" onClose={() => setScannen(false)} onResult={(t) => { setSn(t); setScannen(false) }} /></Suspense>
      )}
    </form>
  )
}
