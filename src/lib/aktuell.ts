import { useSyncExternalStore } from 'react'

// Gewähltes "aktuelles Lager" und angemeldeter Nutzer – nur in diesem Browser gespeichert.

const SCHLUESSEL = 'aktuellesLager'
const hoerer = new Set<() => void>()
let lagerId: number | undefined = Number(localStorage.getItem(SCHLUESSEL)) || undefined
let nutzerId: string | undefined

const melden = () => hoerer.forEach((h) => h())
const abo = (h: () => void) => { hoerer.add(h); return () => { hoerer.delete(h) } }

export function setAktuellesLager(id?: number) {
  lagerId = id
  if (id) localStorage.setItem(SCHLUESSEL, String(id))
  else localStorage.removeItem(SCHLUESSEL)
  melden()
}

export function setNutzer(id?: string) {
  nutzerId = id
  melden()
}

export const useAktuellesLager = () => useSyncExternalStore(abo, () => lagerId)
export const useNutzer = () => useSyncExternalStore(abo, () => nutzerId)
