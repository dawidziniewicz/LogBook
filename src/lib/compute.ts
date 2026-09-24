import type { Day, HourRow, Tally, Voyage } from '../types';
import { WATCH_SLOTS } from '../data/reference';
import { dateKey } from './time';

export const num = (s?: string) => {
  if (!s) return NaN;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};
export const fmt1 = (n: number, intDigits = 1) => {
  const [i, d] = n.toFixed(1).split('.');
  return `${i.padStart(intDigits, '0')},${d}`;
};

const isDash = (s?: string) => !s || /^[\s\-–—0]*$/.test(s);

export const sortedDays = (v: Voyage) => Object.keys(v.days).sort();

export function voyageDayIndex(v: Voyage, date: string) {
  const first = [v.embarkDate, ...sortedDays(v)].filter(Boolean).sort()[0] ?? date;
  return Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 86_400_000);
}

const ROMAN = ['I', 'II', 'III'];
export function watchAt(v: Voyage, date: string, time: string) {
  const h = parseInt(time.slice(0, 2), 10) || 0;
  const slot = WATCH_SLOTS.findIndex(([a, b]) => h >= a && h < b);
  const idx = Math.max(0, voyageDayIndex(v, date)) * WATCH_SLOTS.length + Math.max(0, slot);
  return ROMAN[idx % 3];
}
export const galleyWatch = (v: Voyage, date: string) => ROMAN[(Math.max(0, voyageDayIndex(v, date)) + 2) % 3];

export function maxWindForce(wind?: string) {
  if (!wind) return NaN;
  const nums = wind.match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : NaN;
}

export type RowKind = 'sail' | 'engine' | 'port' | 'empty';
export function rowKind(r?: HourRow): RowKind {
  if (!r) return 'empty';
  if (!isDash(r.engine)) return 'engine';
  if (!isDash(r.sails)) return 'sail';
  const hasAny = Object.entries(r).some(([k, val]) => !['auto', 'lat', 'lon', 'fixAt'].includes(k) && val);
  return hasAny ? 'port' : 'empty';
}

/** zliczenie bieżącej doby (pole 17) – na podstawie wpisów godzinowych */
export function dayTally(day: Day, prevLog: number, isPast: (hour: number) => boolean, firstDay = false): Tally {
  const t: Tally = { port: 0, sail: 0, engine: 0, total: 0, above6: 0, miles: 0 };
  let lastLog = prevLog;
  let speedMiles = 0;
  // pierwszy dzień rejsu: licz od pierwszego wpisu / zdarzenia
  let start = 1;
  if (firstDay) {
    const filled = Object.keys(day.hours).map(Number).filter((h) => rowKind(day.hours[h]) !== 'empty');
    const ev = day.events.map((e) => (parseInt(e.time.slice(0, 2), 10) || 0) + 1);
    start = Math.min(25, ...filled, ...ev);
  }
  for (let h = start; h <= 24; h++) {
    const r = day.hours[h];
    const k = rowKind(r);
    if (k === 'empty' && !isPast(h)) continue;
    if (k === 'engine') t.engine++;
    else if (k === 'sail') t.sail++;
    else t.port++;
    if (k === 'engine' || k === 'sail') {
      if (maxWindForce(r?.wind) > 6) t.above6++;
      const sp = num(r?.speed);
      if (!isNaN(sp)) speedMiles += sp;
    }
    const lg = num(r?.log);
    if (!isNaN(lg)) lastLog = lg;
  }
  t.total = t.sail + t.engine;
  const byLog = lastLog - prevLog;
  t.miles = +(byLog > 0 ? byLog : speedMiles).toFixed(1);
  return { ...t, ...stripUndef(day.tallyOverride) };
}

const stripUndef = <T extends object>(o?: T) =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v))) as Partial<T>;

export const addTally = (a: Tally, b: Tally): Tally => ({
  port: a.port + b.port,
  sail: a.sail + b.sail,
  engine: a.engine + b.engine,
  total: a.total + b.total,
  above6: a.above6 + b.above6,
  miles: +(a.miles + b.miles).toFixed(1),
});
export const ZERO: Tally = { port: 0, sail: 0, engine: 0, total: 0, above6: 0, miles: 0 };

/** ostatni wpis LOG przed daną godziną (w całym rejsie) */
export function lastLogBefore(v: Voyage, date: string, hour: number) {
  const days = sortedDays(v).filter((d) => d <= date).reverse();
  for (const d of days) {
    for (let h = d === date ? hour - 1 : 24; h >= 1; h--) {
      const lg = num(v.days[d].hours[h]?.log);
      if (!isNaN(lg)) return lg;
    }
  }
  return NaN;
}

/** zliczenia dla wszystkich dni: z przeniesienia / bieżąca doba / do przeniesienia */
export function allTallies(v: Voyage, now = new Date()) {
  const out: Record<string, { carry: Tally; today: Tally; total: Tally }> = {};
  let carry = ZERO;
  let prevLog = 0;
  const nowKey = dateKey(now);
  const days = sortedDays(v);
  for (const d of days) {
    const day = v.days[d];
    const isPast = (h: number) => (d < nowKey ? true : d > nowKey ? false : h <= now.getHours());
    const today = dayTally(day, prevLog, isPast, d === days[0]);
    const total = addTally(carry, today);
    out[d] = { carry, today, total };
    carry = total;
    const lg = lastLogBefore(v, d, 25);
    if (!isNaN(lg)) prevLog = lg;
  }
  return out;
}

/** pola wymagane, których brakuje w wierszu */
export const missingFields = (r: HourRow | undefined, required: string[]) =>
  required.filter((k) => !(r as Record<string, unknown> | undefined)?.[k]);
