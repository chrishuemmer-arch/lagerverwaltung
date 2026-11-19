import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { platzCode, sortierePlaetze } from '../db'
import { useStammdaten } from '../lib/hooks'
import { PLATZ_PREFIX } from '../lib/scan'

export default function Etiketten() {
  const s = useStammdaten()
  const [params, setParams] = useSearchParams()
  const ortId = Number(params.get('ort')) || s?.orte[0]?.id
  const regal = params.get('regal') ?? ''
  const [bilder, setBilder] = useState<Map<number, string>>(new Map())

  const plaetze = s ? sortierePlaetze(s.plaetze.filter((p) => p.ortId === ortId && (!regal || p.regal === regal))) : []
  const regale = s ? [...new Set(s.plaetze.filter((p) => p.ortId === ortId).map((p) => p.regal))].sort() : []
  const schluessel = plaetze.map((p) => p.id).join(',')

  useEffect(() => {
    let aktiv = true
    Promise.all(schluessel.split(',').filter(Boolean).map(async (id) =>
      [Number(id), await QRCode.toDataURL(PLATZ_PREFIX + id, { margin: 1, width: 240 })] as const,
    )).then((x) => aktiv && setBilder(new Map(x)))
    return () => { aktiv = false }
  }, [schluessel])

  if (!s) return null
  const setP = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }

  return (
    <>
      <div className="nicht-drucken">
        <h1>QR-Etiketten</h1>
        <div className="zeile">
          <select value={ortId ?? ''} onChange={(e) => setP('ort', e.target.value)}>
            {s.orte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={regal} onChange={(e) => setP('regal', e.target.value)}>
            <option value="">Alle Regale</option>
            {regale.map((r) => <option key={r} value={r}>Regal {r || '–'}</option>)}
          </select>
          <button type="button" className="primaer" onClick={() => window.print()}>Drucken</button>
        </div>
        <p className="hinweis">{plaetze.length} Etiketten. Tipp: Auf Etikettenpapier oder normales Papier drucken, ausschneiden und mit Klebeband/Folie am Regalplatz befestigen.</p>
      </div>
      <div className="etiketten">
        {plaetze.map((p) => (
          <div key={p.id} className="etikett">
            {bilder.get(p.id) && <img src={bilder.get(p.id)} alt="" />}
            <strong>{platzCode(p)}</strong>
            <small>{s.ort.get(p.ortId)?.name}</small>
          </div>
        ))}
      </div>
    </>
  )
}
