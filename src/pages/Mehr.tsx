import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, vergleiche } from '../db'
import { useStammdaten } from '../lib/hooks'
import { alteDatenAufGeraet, altesBackupLesen, exportieren, inLagerUebernehmen } from '../lib/backup'
import { lagerAnlegen, lagerUmbenennen, profilAendern } from '../lib/ops'
import { setAktuellesLager } from '../lib/aktuell'
import { abmelden } from '../lib/sync'
import { Verlauf } from './EintragDetail'

export default function Mehr() {
  const s = useStammdaten()
  const verlauf = useLiveQuery(() => db.bewegungen.orderBy('zeit').reverse().limit(50).toArray())
  const altAufGeraet = useLiveQuery(() => alteDatenAufGeraet().catch(() => undefined))
  const datei = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string }>()
  const [laeuft, setLaeuft] = useState(false)
  const [nurHier, setNurHier] = useState(true)
  useEffect(() => setMeldung(undefined), [s?.aktuell?.id])
  if (!s || !verlauf || !s.ich) return null
  const ich = s.ich

  async function uebernehmen(quelle: () => Promise<Parameters<typeof inLagerUebernehmen>[1]>) {
    if (!s?.aktuell || laeuft) return
    if (!confirm(`Alte Daten in „${s.aktuell.name}“ übernehmen?`)) return
    setLaeuft(true)
    setMeldung(undefined)
    try {
      const r = await inLagerUebernehmen(s.aktuell.id, await quelle())
      setMeldung({ ok: true, text: `${r.eintraege} Einträge übernommen ✓${r.uebersprungen.length ? ` – übersprungen (Seriennummer schon vorhanden): ${r.uebersprungen.join(', ')}` : ''}` })
    } catch (e) {
      setMeldung({ ok: false, text: (e as Error).message })
    } finally {
      setLaeuft(false)
    }
  }

  const liste = nurHier && s.aktuell
    ? verlauf.filter((b) => [b.vonOrtId, b.nachOrtId].some((o) => o != null && s.ort.get(o)?.lagerId === s.aktuell!.id))
    : verlauf
  const profile = [...s.profil.values()].sort((a, b) => Number(a.freigegeben) - Number(b.freigegeben) || vergleiche(a.name, b.name))

  return (
    <>
      <h1>Mehr</h1>
      <nav className="menue">
        <Link to="/orte">Orte &amp; Plätze</Link>
        <Link to="/artikel">Artikel &amp; Kofferraum-Mindestmengen</Link>
        <Link to="/etiketten">QR-Etiketten drucken</Link>
      </nav>

      <section className="karte formular">
        <h2>Lager</h2>
        <ul className="liste">
          {[...s.lager].sort((a, b) => vergleiche(a.name, b.name)).map((l) => (
            <li key={l.id} className="eintrag">
              <div>
                <strong>{l.name}</strong>
                <small>verantwortlich: {(l.verantwortlich && s.profil.get(l.verantwortlich)?.name) || '–'}</small>
              </div>
              {(l.verantwortlich === ich.id || ich.admin) && (
                <button type="button" onClick={async () => { const n = prompt('Name', l.name)?.trim(); if (n) await lagerUmbenennen(l.id, n) }}>Umbenennen</button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={async () => { const n = prompt('Name des neuen Lagers')?.trim(); if (n) setAktuellesLager(await lagerAnlegen(n)) }}>+ Neues Lager</button>
      </section>

      {ich.admin && (
        <section className="karte formular">
          <h2>Kollegen</h2>
          <p className="hinweis">Neue Kollegen registrieren sich selbst unter dem App-Link und erscheinen dann hier. Erst nach „Freischalten“ sehen sie etwas.</p>
          <ul className="liste">
            {profile.map((p) => (
              <li key={p.id} className="eintrag">
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.freigegeben ? (p.admin ? 'Admin' : 'freigeschaltet') : 'wartet auf Freischaltung'}</small>
                </div>
                {p.id !== ich.id && (
                  <button type="button" onClick={() => profilAendern(p.id, { freigegeben: !p.freigegeben })}>
                    {p.freigegeben ? 'Sperren' : 'Freischalten'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="karte formular">
        <h2>Daten</h2>
        <p className="hinweis">Alle Daten liegen zentral und werden automatisch gesichert. Hier kannst du sie zusätzlich als Datei exportieren oder Daten der alten Handy-Version übernehmen.</p>
        <button type="button" onClick={exportieren}>Alles exportieren (JSON)</button>
        {s.aktuell && (
          <>
            {altAufGeraet && (
              <button type="button" className="primaer" disabled={laeuft} onClick={() => uebernehmen(async () => altAufGeraet)}>
                Alte Daten von diesem Handy nach „{s.aktuell.name}“ übernehmen
              </button>
            )}
            <button type="button" disabled={laeuft} onClick={() => datei.current?.click()}>Altes Backup nach „{s.aktuell.name}“ übernehmen…</button>
            <input ref={datei} type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) uebernehmen(() => altesBackupLesen(f))
            }} />
          </>
        )}
        {meldung && <p className={meldung.ok ? 'ok' : 'fehler'}>{meldung.text}</p>}
      </section>

      <section className="karte formular">
        <h2>Konto</h2>
        <label>Dein Name<input defaultValue={ich.name} onBlur={(e) => e.target.value.trim() && e.target.value !== ich.name && profilAendern(ich.id, { name: e.target.value.trim() })} /></label>
        <button type="button" onClick={abmelden}>Abmelden</button>
      </section>

      <h2>Letzte Bewegungen</h2>
      {s.aktuell && <label className="check"><input type="checkbox" checked={nurHier} onChange={(e) => setNurHier(e.target.checked)} /> Nur {s.aktuell.name}</label>}
      <Verlauf s={s} liste={liste} />

      <section className="ueber">
        <strong>FeliStore</strong>
        <small>Lagerverwaltung von Feline Systems Ltd.</small>
      </section>
    </>
  )
}
