import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { abmelden, liveAbgleich, synchronisieren } from '../lib/sync'
import { setAktuellesLager, setNutzer } from '../lib/aktuell'
import { useStammdaten } from '../lib/hooks'
import { lagerAnlegen } from '../lib/ops'

export default function Anmeldung({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>()
  const [fehler, setFehler] = useState<string>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const nutzer = session?.user.id
  useEffect(() => {
    setNutzer(nutzer)
    if (!nutzer) return
    synchronisieren().then(() => setFehler(undefined), (e) => setFehler((e as Error).message))
    return liveAbgleich()
  }, [nutzer])

  if (session === undefined) return null
  if (!session) return <Login />
  return <Freigabe fehler={fehler}>{children}</Freigabe>
}

function Freigabe({ children, fehler }: { children: ReactNode; fehler?: string }) {
  const s = useStammdaten()
  const [name, setName] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    if (!s?.ich || s.aktuell || !s.lager.length) return
    setAktuellesLager((s.lager.find((l) => l.verantwortlich === s.ich!.id) ?? s.lager[0]).id)
  }, [s])

  if (!s) return null
  if (!s.ich) return <div className="mitte">{fehler ? <p className="fehler">Keine Verbindung: {fehler}</p> : <p>Lade…</p>}<button type="button" onClick={abmelden}>Abmelden</button></div>
  if (!s.ich.freigegeben) {
    return (
      <div className="mitte">
        <h1>Fast geschafft</h1>
        <p>Hallo {s.ich.name}! Dein Zugang muss noch von einem Admin freigeschaltet werden. Sag kurz Bescheid und lade die Seite danach neu.</p>
        <button type="button" className="primaer" onClick={() => location.reload()}>Neu laden</button>
        <button type="button" onClick={abmelden}>Abmelden</button>
      </div>
    )
  }
  if (!s.lager.some((l) => l.verantwortlich === s.ich!.id) && !sessionStorage.getItem('ohneLager')) {
    return (
      <form className="mitte formular" onSubmit={async (ev: FormEvent) => {
        ev.preventDefault()
        setLaeuft(true)
        try {
          setAktuellesLager(await lagerAnlegen(name.trim() || `Lager ${s.ich!.name}`))
        } finally {
          setLaeuft(false)
        }
      }}>
        <h1>Dein Lager</h1>
        <p>Für welches Lager bist du verantwortlich? Es bekommt automatisch einen Ort „Container“ und „Kofferraum“.</p>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Lager ${s.ich.name}`} /></label>
        <button type="submit" className="primaer gross" disabled={laeuft}>Lager anlegen</button>
        {s.lager.length > 0 && <button type="button" onClick={() => { sessionStorage.setItem('ohneLager', '1'); location.reload() }}>Überspringen – nur in fremden Lagern arbeiten</button>}
      </form>
    )
  }
  return <>{children}</>
}

function Login() {
  const [modus, setModus] = useState<'login' | 'neu'>('login')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [name, setName] = useState('')
  const [meldung, setMeldung] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)

  async function absenden(ev: FormEvent) {
    ev.preventDefault()
    setMeldung(undefined)
    setLaeuft(true)
    const { error } = modus === 'login'
      ? await supabase.auth.signInWithPassword({ email, password: passwort })
      : await supabase.auth.signUp({ email, password: passwort, options: { data: { name: name.trim() } } })
    setLaeuft(false)
    if (error) setMeldung(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort falsch' : error.message)
  }

  return (
    <form className="mitte formular" onSubmit={absenden}>
      <h1>FeliStore</h1>
      <p className="hinweis">Lagerverwaltung von Feline Systems Ltd.</p>
      {modus === 'neu' && <label>Dein Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>}
      <label>E-Mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Passwort<input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} required minLength={6}
        autoComplete={modus === 'login' ? 'current-password' : 'new-password'} /></label>
      {meldung && <p className="fehler">{meldung}</p>}
      <button type="submit" className="primaer gross" disabled={laeuft}>{modus === 'login' ? 'Anmelden' : 'Registrieren'}</button>
      <button type="button" className="link" onClick={() => setModus(modus === 'login' ? 'neu' : 'login')}>
        {modus === 'login' ? 'Noch kein Zugang? Registrieren' : 'Schon registriert? Anmelden'}
      </button>
    </form>
  )
}
