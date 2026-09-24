import { WEEKDAYS } from '../data/reference';

const p2 = (n: number) => String(n).padStart(2, '0');

export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hhmm = (d: Date = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-');
  return `${d}-${m}-${y}`;
};
export const weekday = (key: string) => WEEKDAYS[new Date(`${key}T12:00:00`).getDay()];
export const hourLabel = (h: number) => `${p2(h)}00`;

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/**
 * Wers „0100” obejmuje 00:00–01:00. Dla danej chwili zwraca wiersz, którego dotyczy
 * najbliższa pełna godzina (np. 13:55 i 14:05 -> dzień, 14).
 */
export function rowForTime(t: Date = new Date()) {
  const r = new Date(t.getTime() + 30 * 60_000);
  r.setMinutes(0, 0, 0);
  let h = r.getHours();
  if (h === 0) {
    r.setDate(r.getDate() - 1);
    h = 24;
  }
  return { date: dateKey(r), hour: h };
}

/** wiersz, w którym trwa aktualna godzina (13:20 -> 14) */
export function currentRow(t: Date = new Date()) {
  const h = t.getHours() + 1;
  return { date: dateKey(t), hour: h };
}

/** koniec godziny wiersza jako timestamp */
export function rowEnd(date: string, hour: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
