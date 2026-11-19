import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

interface Props {
  onResult: (text: string) => void
  onClose: () => void
  titel?: string
}

export default function Scanner({ onResult, onClose, titel = 'Code scannen' }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [fehler, setFehler] = useState<string>()
  const ergebnis = useRef(onResult)
  ergebnis.current = onResult

  useEffect(() => {
    let controls: IScannerControls | undefined
    let beendet = false
    const reader = new BrowserMultiFormatReader()
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res, _err, c) => {
        if (res && !beendet) {
          beendet = true
          c.stop()
          navigator.vibrate?.(80)
          ergebnis.current(res.getText())
        }
      })
      .then((c) => {
        controls = c
        if (beendet) c.stop()
      })
      .catch((e: Error) => setFehler(e.name === 'NotAllowedError'
        ? 'Kein Kamerazugriff. Bitte in den Browser-Einstellungen erlauben.'
        : `Kamera nicht verfügbar: ${e.message}`))
    return () => {
      beendet = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="scanner">
      <div className="scanner-kopf">
        <strong>{titel}</strong>
        <button type="button" onClick={onClose}>Schließen</button>
      </div>
      {fehler ? <p className="fehler">{fehler}</p> : <video ref={video} playsInline muted />}
      <p className="hinweis">QR-Code eines Platzes oder Barcode einer Seriennummer in den Rahmen halten.</p>
    </div>
  )
}
