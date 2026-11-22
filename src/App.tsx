import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Bestand from './pages/Bestand'
import Einlagern from './pages/Einlagern'
import EintragDetail from './pages/EintragDetail'
import Kofferraum from './pages/Kofferraum'
import Orte from './pages/Orte'
import PlatzDetail from './pages/PlatzDetail'
import Etiketten from './pages/Etiketten'
import Projekte from './pages/Projekte'
import { ArtikelDetail, ArtikelListe } from './pages/ArtikelSeiten'
import Mehr from './pages/Mehr'
import Anmeldung from './components/Anmeldung'
import LagerWahl from './components/LagerWahl'

export default function App() {
  return (
    <Anmeldung>
    <HashRouter>
      <LagerWahl />
      <main>
        <Routes>
          <Route path="/" element={<Bestand />} />
          <Route path="/einlagern" element={<Einlagern />} />
          <Route path="/eintrag/:id" element={<EintragDetail />} />
          <Route path="/kofferraum" element={<Kofferraum />} />
          <Route path="/orte" element={<Orte />} />
          <Route path="/platz/:id" element={<PlatzDetail />} />
          <Route path="/etiketten" element={<Etiketten />} />
          <Route path="/projekte" element={<Projekte />} />
          <Route path="/artikel" element={<ArtikelListe />} />
          <Route path="/artikel/:id" element={<ArtikelDetail />} />
          <Route path="/mehr" element={<Mehr />} />
        </Routes>
      </main>
      <nav className="tabs">
        <NavLink to="/" end>Bestand</NavLink>
        <NavLink to="/kofferraum">Kofferraum</NavLink>
        <NavLink to="/einlagern" className="plus" aria-label="Einlagern">+</NavLink>
        <NavLink to="/projekte">Projekte</NavLink>
        <NavLink to="/mehr">Mehr</NavLink>
      </nav>
    </HashRouter>
    </Anmeldung>
  )
}
