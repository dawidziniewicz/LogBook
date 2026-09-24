import type { Voyage } from '../types';
import type { Fix } from './geo';
import { sortedDays } from './compute';

export type Waypoint = { lat: number; lon: number; t: number; label: string; kind: 'hour' | 'event' | 'port' };

/** pozycje zapisane w dzienniku: wpisy godzinowe i zdarzenia z pozycją */
export function logWaypoints(v: Voyage): Waypoint[] {
  const out: Waypoint[] = [];
  for (const d of sortedDays(v)) {
    const day = v.days[d];
    for (const [h, r] of Object.entries(day.hours)) {
      if (r.lat != null && r.lon != null) {
        out.push({ lat: r.lat, lon: r.lon, t: r.fixAt ?? new Date(`${d}T00:00:00`).getTime() + +h * 3_600_000, label: `${d} · wiersz ${String(h).padStart(2, '0')}00`, kind: 'hour' });
      }
    }
    for (const e of day.events) {
      if (e.lat != null && e.lon != null) {
        const port = /^(ODEJ\.|ZAC\.|⚓)/.test(e.text);
        out.push({ lat: e.lat, lon: e.lon, t: new Date(`${d}T${e.time}:00`).getTime(), label: `${d} ${e.time} · ${e.text}`, kind: port ? 'port' : 'event' });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** pełny ślad: zapis GPS, uzupełniony pozycjami z dziennika tam, gdzie ślad nie był nagrywany */
export function voyageLine(v: Voyage, track: Fix[]): { lat: number; lon: number; t: number }[] {
  const GAP = 20 * 60_000;
  const times = track.map((p) => p.t);
  const covered = (t: number) => {
    let lo = 0, hi = times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return (lo < times.length && times[lo] - t <= GAP) && (lo > 0 && t - times[lo - 1] <= GAP);
  };
  const extra = logWaypoints(v).filter((w) => !covered(w.t));
  const pts = [...track.map((p) => ({ lat: p.lat, lon: p.lon, t: p.t })), ...extra];
  pts.sort((a, b) => a.t - b.t);
  return pts.filter((p, i) => i === 0 || p.lat !== pts[i - 1].lat || p.lon !== pts[i - 1].lon);
}
