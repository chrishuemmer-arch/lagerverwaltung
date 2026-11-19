import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useStammdaten } from '../lib/hooks'
import { exportieren, importieren, letztesBackup } from '../lib/backup'
import { Verlauf } from './EintragDetail'

export default function Mehr() {
  const s = useStammdaten()
  const verlauf = useLiveQuery(() => db.bewegungen.orderBy('zeit').reverse().limit(50).toArray())
  const datei = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string }>()
  const [dauerhaft, setDauerhaft] = useState<boolean>()
  const [, setTick] = useState(0)

  useEffect(() => { navigator.storage?.persisted?.().then(setDauerhaft) }, [])
  if (!s || !verlauf) return null
  const backup = letztesBackup()

  async function sichern() {
    await exportieren()
    setTick((t) => t + 1)
  }

  async function laden(f?: File) {
    if (!f) return
    if (!confirm('Achtung: Der aktuelle Bestand auf diesem Gerät wird durch das Backup ersetzt. Fortfahren?')) return
    try {
      await importieren(f)
      setMeldung({ ok: true, text: 'Backup wiederhergestellt ✓' })
    } catch (e) {
      setMeldung({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <>
      <h1>Mehr</h1>
      <nav className="menue">
        <Link to="/orte">Orte &amp; Plätze</Link>
        <Link to="/artikel">Artikel &amp; Kofferraum-Mindestmengen</Link>
        <Link to="/etiketten">QR-Etiketten drucken</Link>
      </nav>

      <section className="karte formular">
        <h2>Backup</h2>
        <p className="hinweis">
          Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig, z. B. in iCloud/Google Drive oder per Mail an dich selbst.
          {backup ? ` Letztes Backup: ${new Date(backup).toLocaleDateString('de-DE')}.` : ' Noch kein Backup gemacht.'}
        </p>
        <button type="button" className="primaer gross" onClick={sichern}>Backup erstellen</button>
        <button type="button" onClick={() => datei.current?.click()}>Backup wiederherstellen…</button>
        <input ref={datei} type="file" accept="application/json,.json" hidden onChange={(e) => { laden(e.target.files?.[0]); e.target.value = '' }} />
        {meldung && <p className={meldung.ok ? 'ok' : 'fehler'}>{meldung.text}</p>}
        {dauerhaft === false && (
          <button type="button" className="link" onClick={async () => setDauerhaft(await navigator.storage.persist())}>
            Browser bitten, die Daten dauerhaft zu behalten
          </button>
        )}
      </section>

      <h2>Letzte Bewegungen</h2>
      <Verlauf s={s} liste={verlauf} />
    </>
  )
}
