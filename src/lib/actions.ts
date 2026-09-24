import { useStore } from '../store';
import type { HourField, HourRow, Voyage, VoyageStatus } from '../types';
import { bearing, distanceNm, fmtCourse, fmtPos, getPosition, msToKn, trackDistance, type Fix } from './geo';
import { addFix, getTrack, startTracking, stopTracking } from './tracker';
import { fetchWeather, reverseGeocode } from './weather';
import { fmt1, lastLogBefore, sortedDays, watchAt } from './compute';
import { dateKey, hhmm, rowEnd } from './time';

/** ostatnia znana pozycja przed chwilą `t` – z wpisów godzinowych i zdarzeń */
function previousReference(v: Voyage, t: number): { lat: number; lon: number; t: number } | undefined {
  let best: { lat: number; lon: number; t: number } | undefined;
  const consider = (lat?: number, lon?: number, ts?: number) => {
    if (lat == null || lon == null || ts == null) return;
    if (ts >= t - 60_000) return;
    if (!best || ts > best.t) best = { lat, lon, t: ts };
  };
  for (const d of sortedDays(v).reverse().slice(0, 3)) {
    const day = v.days[d];
    for (const r of Object.values(day.hours)) consider(r.lat, r.lon, r.fixAt);
    for (const e of day.events) consider(e.lat, e.lon, new Date(`${d}T${e.time}:00`).getTime());
  }
  return best;
}

export type AutoFillResult = { filled: HourField[]; weather: boolean; message: string };

/**
 * Przycisk „📍” przy godzinie: pobiera pozycję i wylicza kurs nad dnem, prędkość
 * (średnia od poprzedniego wpisu), log, a przy dostępnym internecie – pogodę z modelu.
 */
export async function autoFillHour(date: string, hour: number): Promise<AutoFillResult> {
  const st = useStore.getState();
  const v = st.active();
  if (!v) throw new Error('Brak aktywnego rejsu');

  const fix = await getPosition();
  addFix(fix);

  const patch: Partial<HourRow> = { lat: fix.lat, lon: fix.lon, fixAt: fix.t };
  const filled: HourField[] = [];
  const prev = previousReference(v, fix.t);
  const track = getTrack();

  let dist = 0;
  let hours = 0;
  if (prev) {
    const straight = distanceNm(prev, fix);
    const byTrack = trackDistance(track, prev.t, fix.t + 1000);
    dist = Math.max(straight, byTrack);
    hours = (fix.t - prev.t) / 3_600_000;
  }

  // SZYBKOŚĆ – średnia z ostatniej godziny (lub od poprzedniej pozycji)
  let speedKn: number | undefined;
  if (prev && hours >= 5 / 60 && hours <= 6) speedKn = dist / hours;
  else if (fix.speed != null && fix.speed >= 0) speedKn = msToKn(fix.speed);
  if (speedKn != null) {
    patch.speed = fmt1(speedKn);
    filled.push('speed');
  }

  // KD – kurs nad dnem: z GPS przy ruchu, w przeciwnym razie z ostatnich ~10 min śladu
  let cog: number | undefined;
  if (fix.heading != null && !isNaN(fix.heading) && (fix.speed ?? 0) > 0.3) cog = fix.heading;
  else {
    const recent = [...track].reverse().find((p: Fix) => p.t <= fix.t - 8 * 60_000 && p.t >= fix.t - 30 * 60_000);
    const ref = recent && distanceNm(recent, fix) > 0.05 ? recent : prev && distanceNm(prev, fix) > 0.05 ? prev : undefined;
    if (ref) cog = bearing(ref, fix);
  }
  if (cog != null && (speedKn ?? 1) >= 0.3) {
    patch.kd = fmtCourse(cog);
    filled.push('kd');
  }

  // LOG – droga od początku rejsu
  const prevLog = lastLogBefore(v, date, hour);
  const logVal = (isNaN(prevLog) ? 0 : prevLog) + dist;
  patch.log = fmt1(logVal, 2);
  filled.push('log');

  // pogoda z modelu – tylko do pustych pól
  let weather = false;
  const row = v.days[date]?.hours[hour] ?? {};
  if (st.settings.autoWeather && navigator.onLine) {
    try {
      const w = await fetchWeather(fix.lat, fix.lon);
      for (const [k, val] of Object.entries(w) as [HourField, string][]) {
        if (!row[k] && val) {
          patch[k] = val;
          filled.push(k);
          weather = true;
        }
      }
    } catch {
      /* brak sieci – trudno */
    }
  }

  st.setHour(date, hour, patch, filled);
  const parts = [fmtPos(fix.lat, fix.lon)];
  if (prev) parts.push(`${fmt1(dist)} Mm od poprzedniej pozycji`);
  if (weather) parts.push('pogoda z modelu Open‑Meteo – sprawdź!');
  return { filled, weather, message: parts.join(' · ') };
}

async function placeName(fix: Fix) {
  const name = navigator.onLine ? await reverseGeocode(fix.lat, fix.lon) : undefined;
  return name ?? fmtPos(fix.lat, fix.lon);
}

function logStatusEvent(status: VoyageStatus, text: string, fix: Fix) {
  const st = useStore.getState();
  const v = st.active()!;
  const now = new Date(fix.t);
  const date = dateKey(now);
  const time = hhmm(now);
  st.addEvent(date, { time, text, lat: fix.lat, lon: fix.lon, watch: watchAt(v, date, time) });
  st.mutate((vv) => {
    vv.status = status;
    vv.statusSince = fix.t;
  });
  return date;
}

/** „Wypływamy” – pozycja, nazwa portu do 18A, wpis do przebiegu żeglugi, start śladu */
export async function departPort(port?: string) {
  const st = useStore.getState();
  const v = st.active();
  if (!v) throw new Error('Brak aktywnego rejsu');
  const fix = await getPosition();
  addFix(fix);
  const name = port?.trim() || (await placeName(fix));
  const fromAnchor = v.status === 'anchor';
  const date = logStatusEvent('sea', fromAnchor ? `ODEJ. z kotwicy – ${name}` : `ODEJ. Odejście od nabrzeża – ${name}`, fix);
  if (!fromAnchor) {
    st.mutateDay(date, (d) => {
      if (d.portIn) {
        d.portStay = [d.portStay, d.portIn].filter(Boolean).join(', ');
        d.portIn = undefined;
      }
      if (!d.portOut) d.portOut = name;
    });
  }
  if (st.settings.trackAtSea) startTracking();
  return name;
}

/** „Wchodzimy do portu” – pozycja, 18B, wpis zacumowania */
export async function arrivePort(port?: string, how?: string) {
  const st = useStore.getState();
  if (!st.active()) throw new Error('Brak aktywnego rejsu');
  const fix = await getPosition();
  addFix(fix);
  const name = port?.trim() || (await placeName(fix));
  const date = logStatusEvent('port', `ZAC. Zacumowanie – ${name}${how ? `, ${how}` : ''}`, fix);
  st.mutateDay(date, (d) => {
    d.portIn = name;
  });
  stopTracking();
  return name;
}

export async function dropAnchor() {
  const st = useStore.getState();
  if (!st.active()) throw new Error('Brak aktywnego rejsu');
  const fix = await getPosition();
  addFix(fix);
  logStatusEvent('anchor', `⚓ Zakotwiczenie – ${fmtPos(fix.lat, fix.lon)}`, fix);
  stopTracking();
}

/** kopiuje trwałe pola z poprzedniej godziny (żagle, silnik, kursy, pogoda) do pustych */
export function copyPrevious(date: string, hour: number) {
  const st = useStore.getState();
  const v = st.active();
  if (!v) return false;
  let src: HourRow | undefined;
  const days = sortedDays(v).filter((d) => d <= date).reverse();
  outer: for (const d of days) {
    for (let h = d === date ? hour - 1 : 24; h >= 1; h--) {
      const r = v.days[d].hours[h];
      if (r && Object.keys(r).some((k) => !['auto', 'lat', 'lon', 'fixAt'].includes(k))) {
        src = r;
        break outer;
      }
    }
  }
  if (!src) return false;
  const cur = v.days[date]?.hours[hour] ?? {};
  const keys: HourField[] = ['kk', 'kd', 'sails', 'engine', 'sea', 'wind', 'sky', 'vis', 'pressure', 'temp', 'depth'];
  const patch: Partial<HourRow> = {};
  for (const k of keys) if (!cur[k] && src[k]) patch[k] = src[k];
  st.setHour(date, hour, patch);
  return Object.keys(patch).length > 0;
}

export const isRowPast = (date: string, hour: number) => rowEnd(date, hour) - 30 * 60_000 <= Date.now();
