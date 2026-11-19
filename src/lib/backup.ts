import { db, TABELLEN } from '../db'

const FORMAT = 'lagerverwaltung-backup'
const LETZTES_BACKUP = 'letztesBackup'

export async function exportieren(): Promise<void> {
  const daten: Record<string, unknown[]> = {}
  await db.transaction('r', TABELLEN.map((t) => db.table(t)), async () => {
    for (const t of TABELLEN) daten[t] = await db.table(t).toArray()
  })
  const json = JSON.stringify({ format: FORMAT, version: 1, erstellt: new Date().toISOString(), daten }, null, 1)
  const datum = new Date().toISOString().slice(0, 10)
  const datei = new File([json], `lager-backup-${datum}.json`, { type: 'application/json' })
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Lager-Backup' })
      localStorage.setItem(LETZTES_BACKUP, String(Date.now()))
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(datei)
  const a = document.createElement('a')
  a.href = url
  a.download = datei.name
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem(LETZTES_BACKUP, String(Date.now()))
}

export async function importieren(datei: File): Promise<void> {
  const inhalt = JSON.parse(await datei.text())
  if (inhalt?.format !== FORMAT || typeof inhalt.daten !== 'object') {
    throw new Error('Das ist keine Lagerverwaltung-Backup-Datei')
  }
  await db.transaction('rw', TABELLEN.map((t) => db.table(t)), async () => {
    for (const t of TABELLEN) {
      await db.table(t).clear()
      const zeilen = inhalt.daten[t]
      if (Array.isArray(zeilen)) await db.table(t).bulkAdd(zeilen)
    }
  })
}

export function letztesBackup(): number | null {
  const v = localStorage.getItem(LETZTES_BACKUP)
  return v ? Number(v) : null
}
