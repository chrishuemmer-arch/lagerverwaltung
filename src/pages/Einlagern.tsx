import { lazy, Suspense, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { normSN, vergleiche } from '../db'
import { imAktuellen, meineOrte, useStammdaten } from '../lib/hooks'
import { artikelAnlegen, einlagern } from '../lib/ops'
import { Wechseln } from '../components/LagerWahl'
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
  const [speichert, setSpeichert] = useState(false)
  const sperre = useRef(false)

  if (!s) return null
  if (!s.aktuell) return <p className="leer">Wähle oben ein Lager, in das eingelagert werden soll.</p>
  const startOrt = startPlatz ? s.platz.get(startPlatz)?.ortId : undefined
  if (startOrt && !imAktuellen(s, startOrt)) return <Wechseln s={s} ortId={startOrt} />
  const effOrt: OrtWert = ort.ortId && imAktuellen(s, ort.ortId) ? ort : startOrt
    ? { ortId: startOrt, platzId: startPlatz }
    : { ortId: meineOrte(s).find((o) => o.typ === 'lager')?.id ?? meineOrte(s)[0]?.id }
  const gewaehlt = artikelId && artikelId !== NEU ? s.art.get(artikelId) : undefined
  const mitSN = artikelId === NEU ? neuMitSN : !!gewaehlt?.mitSeriennummer
  const kategorien = [...new Set(s.artikel.map((a) => a.kategorie).filter(Boolean))] as string[]

  async function speichern(ev: FormEvent) {
    ev.preventDefault()
    if (sperre.current) return
    sperre.current = true
    setSpeichert(true)
    setMeldung(undefined)
    try {
      let aid = artikelId
      let snPflicht = mitSN
      if (aid === NEU) {
        const name = neuName.trim()
        aid = await artikelAnlegen({ name, kategorie: neuKategorie.trim() || undefined, mitSeriennummer: neuMitSN })
        snPflicht = s!.art.get(aid)?.mitSeriennummer ?? neuMitSN
        setArtikelId(aid)
      }
      if (!aid || !effOrt.ortId) return
      const id = await einlagern({
        artikelId: aid, ortId: effOrt.ortId, platzId: effOrt.platzId, projektId,
        seriennummer: snPflicht ? sn : undefined, menge: snPflicht ? 1 : menge, notiz,
      })
      if (serie && snPflicht) {
        setMeldung({ ok: true, text: `${normSN(sn)} gespeichert. Nächste Seriennummer:` })
        setSn('')
        setOrt(effOrt)
      } else {
        navigate(`/eintrag/${id}`, { replace: true })
      }
    } catch (e) {
      setMeldung({ ok: false, text: (e as Error).message })
    } finally {
      sperre.current = false
      setSpeichert(false)
    }
  }

  return (
    <form onSubmit={speichern} className="formular">
      <h1>Einlagern</h1>
      <p className="hinweis">in {s.aktuell.name}</p>
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
      {mitSN && (
        <label className="check">
          <input type="checkbox" checked={serie} onChange={(e) => setSerie(e.target.checked)} />
          Danach weitere Seriennummern erfassen (gleicher Artikel, Platz und Projekt)
        </label>
      )}
      {meldung && <p className={meldung.ok ? 'ok' : 'fehler'}>{meldung.text}</p>}
      <button type="submit" className="primaer gross" disabled={speichert}>Einlagern</button>
      {scannen && (
        <Suspense fallback={null}><Scanner titel="Seriennummer scannen" onClose={() => setScannen(false)} onResult={(t) => { setSn(t); setScannen(false) }} /></Suspense>
      )}
    </form>
  )
}
