import { Link } from 'react-router-dom'
import type { Eintrag } from '../db'
import { ortText, type Stammdaten } from '../lib/hooks'

export default function EintragZeile({ s, e, ohneOrt }: { s: Stammdaten; e: Eintrag; ohneOrt?: boolean }) {
  const art = s.art.get(e.artikelId)
  const projekt = e.projektId != null ? s.projekt.get(e.projektId) : undefined
  return (
    <li>
      <Link to={`/eintrag/${e.id}`} className="eintrag">
        <div>
          <strong>{art?.name ?? '?'}</strong>
          <small>
            {e.seriennummer ? <>SN <code>{e.seriennummer}</code></> : <>{e.menge} Stk.</>}
            {!ohneOrt && <> · {ortText(s, e)}</>}
          </small>
        </div>
        {projekt && <span className="tag">{projekt.name}</span>}
      </Link>
    </li>
  )
}
