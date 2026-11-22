import type { Artikel, OrtTyp } from '../db'
import { pruefe, supabase } from './supabase'
import { synchronisieren } from './sync'

interface Ziel {
  ortId: number
  platzId?: number
  projektId?: number
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = pruefe(await supabase.rpc(fn, args))
  await synchronisieren()
  return r as T
}

async function fertig(r: { error: { message: string } | null }) {
  pruefe({ data: null, error: r.error })
  await synchronisieren()
}

export const einlagern = (d: { artikelId: number; menge: number; seriennummer?: string; notiz?: string } & Ziel) =>
  rpc<number>('einlagern', {
    p_artikel: d.artikelId, p_ort: d.ortId, p_menge: d.menge, p_seriennummer: d.seriennummer ?? null,
    p_platz: d.platzId ?? null, p_projekt: d.projektId ?? null, p_notiz: d.notiz || null,
  })

export const entnehmen = (eintragId: number, menge: number, notiz?: string) =>
  rpc('entnehmen', { p_eintrag: eintragId, p_menge: menge, p_notiz: notiz || null })

export const umlagern = (eintragId: number, menge: number, z: Ziel, notiz?: string) =>
  rpc('umlagern', {
    p_eintrag: eintragId, p_menge: menge, p_ort: z.ortId, p_platz: z.platzId ?? null,
    p_projekt: z.projektId ?? null, p_notiz: notiz || null,
  })

export const lagerAnlegen = (name: string) => rpc<number>('lager_anlegen', { p_name: name })

export async function artikelAnlegen(a: { name: string; kategorie?: string; mitSeriennummer: boolean }): Promise<number> {
  const vorhanden = pruefe(await supabase.from('artikel').select('id, mit_seriennummer').ilike('name', a.name.replace(/[%_\\]/g, '\\$&')).limit(1))
  if (vorhanden.length) return vorhanden[0].id
  const r = pruefe(await supabase.from('artikel').insert({ name: a.name, kategorie: a.kategorie ?? null, mit_seriennummer: a.mitSeriennummer }).select('id').single())
  await synchronisieren()
  return r.id
}

export const artikelAendern = async (id: number, f: Partial<Omit<Artikel, 'id'>>) => fertig(await supabase.from('artikel').update({
  ...('name' in f && { name: f.name }), ...('kategorie' in f && { kategorie: f.kategorie ?? null }),
  ...('mitSeriennummer' in f && { mit_seriennummer: f.mitSeriennummer }),
}).eq('id', id))

export const artikelLoeschen = async (id: number) => fertig(await supabase.from('artikel').delete().eq('id', id))

export const sollSetzen = async (lagerId: number, artikelId: number, menge: number) => fertig(menge > 0
  ? await supabase.from('kofferraum_soll').upsert({ lager_id: lagerId, artikel_id: artikelId, menge })
  : await supabase.from('kofferraum_soll').delete().eq('lager_id', lagerId).eq('artikel_id', artikelId))

export const eintragNotiz = async (id: number, notiz?: string) =>
  fertig(await supabase.from('eintraege').update({ notiz: notiz || null, geaendert: new Date().toISOString() }).eq('id', id))

export const ortAnlegen = async (lagerId: number, name: string, typ: OrtTyp) =>
  fertig(await supabase.from('orte').insert({ lager_id: lagerId, name, typ }))
export const ortUmbenennen = async (id: number, name: string) => fertig(await supabase.from('orte').update({ name }).eq('id', id))
export const ortLoeschen = async (id: number) => fertig(await supabase.from('orte').delete().eq('id', id))

export const plaetzeAnlegen = async (neue: { ortId: number; regal: string; nummer: string }[]) =>
  fertig(await supabase.from('plaetze').insert(neue.map((p) => ({ ort_id: p.ortId, regal: p.regal, nummer: p.nummer }))))
export const plaetzeLoeschen = async (ids: number[]) => fertig(await supabase.from('plaetze').delete().in('id', ids))
export const platzNotiz = async (id: number, notiz?: string) => fertig(await supabase.from('plaetze').update({ notiz: notiz || null }).eq('id', id))

export const projektAnlegen = async (name: string) => fertig(await supabase.from('projekte').insert({ name }))
export const projektAendern = async (id: number, f: { name?: string; archiviert?: boolean }) =>
  fertig(await supabase.from('projekte').update(f).eq('id', id))

export const lagerUmbenennen = async (id: number, name: string) => fertig(await supabase.from('lager').update({ name }).eq('id', id))

export const profilAendern = async (id: string, f: { name?: string; freigegeben?: boolean; admin?: boolean }) =>
  fertig(await supabase.from('profile').update(f).eq('id', id))
