import { set as idbSet } from 'idb-keyval';
import { useStore } from '../store';
import { ASSET_KINDS } from './photo';
import { uid } from './time';
import type { Voyage } from '../types';

/**
 * Wczytuje plik kopii rejsu (JSON z eksportu). Najpierw zapisuje ślad i obrazy pod docelowym id,
 * dopiero potem przełącza aplikację na rejs – inaczej wczytałaby pusty ślad i brak zdjęć.
 * Zwraca krótki opis zawartości.
 */
export async function importBackupFile(f: File): Promise<string> {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(await f.text());
  } catch {
    throw new Error('To nie jest poprawny plik dziennika');
  }
  const v = j.voyage as Voyage | undefined;
  if (!v?.id || !v.days) throw new Error('To nie jest poprawny plik dziennika');
  const exists = useStore.getState().voyages.some((x) => x.id === v.id);
  const final = exists ? { ...v, id: uid(), name: `${v.name} (kopia)` } : v;
  const track = Array.isArray(j.track) ? j.track : [];
  if (track.length) await idbSet(`track:${final.id}`, track);
  for (const k of ASSET_KINDS) if (typeof j[k] === 'string') await idbSet(`${k}:${final.id}`, j[k]);
  useStore.getState().importVoyage(final);
  return describeBackup(final, track, j, f.size);
}

/** krótki opis zawartości pliku kopii */
export function describeBackup(v: Voyage, track: unknown[], assets: Record<string, unknown>, size: number) {
  const days = Object.values(v.days);
  const sigs =
    days.reduce((n, d) => n + (d.firstOfficer?.image ? 1 : 0) + (d.captain?.image ? 1 : 0), 0) + (v.opinion?.signature?.image ? 1 : 0);
  const has = (k: string) => (typeof assets[k] === 'string' ? '✓' : '—');
  const mb = size / 1024 / 1024;
  return [
    `${days.length} dni`,
    `${v.crew.length} os. załogi`,
    `${sigs} podpis${sigs === 1 ? '' : sigs < 5 && sigs > 1 ? 'y' : 'ów'}`,
    `ślad ${track.length} pkt`,
    `zdjęcie załogi ${has('photo')}`,
    `zdjęcie trasy ${has('route')}`,
    `logo rejsu ${has('vlogo')}`,
    mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(size / 1024))} kB`,
  ].join(' · ');
}
