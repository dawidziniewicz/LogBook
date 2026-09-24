import { get as idbGet, set as idbSet } from 'idb-keyval';
import { distanceNm, type Fix } from './geo';

/**
 * Ślad GPS rejsu. Trzymany osobno od głównego stanu (może mieć tysiące punktów),
 * zapisywany do IndexedDB co kilka punktów.
 */
let voyageId: string | undefined;
let track: Fix[] = [];
let watchId: number | undefined;
let dirty = 0;
const listeners = new Set<() => void>();

const key = (id: string) => `track:${id}`;
const MAX_POINTS = 50_000;

export async function loadTrack(id: string) {
  if (voyageId === id) return track;
  voyageId = id;
  track = (await idbGet<Fix[]>(key(id))) ?? [];
  listeners.forEach((l) => l());
  return track;
}

export const getTrack = () => track;
export const lastFix = () => track[track.length - 1];
export const subscribeTrack = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function save(force = false) {
  if (!voyageId) return;
  if (force || dirty >= 5) {
    dirty = 0;
    void idbSet(key(voyageId), track);
  }
}

export function addFix(f: Fix) {
  if (f.accuracy && f.accuracy > 150) return;
  const last = track[track.length - 1];
  if (last) {
    const moved = distanceNm(last, f) * 1852;
    // zapisuj punkt co ~25 m lub co 5 min
    if (moved < 25 && f.t - last.t < 5 * 60_000) return;
  }
  track.push({ lat: f.lat, lon: f.lon, t: f.t, speed: f.speed ?? null, heading: f.heading ?? null });
  if (track.length > MAX_POINTS) track = track.slice(-MAX_POINTS);
  dirty++;
  save();
  listeners.forEach((l) => l());
}

export function startTracking() {
  if (watchId !== undefined || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (p) =>
      addFix({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        t: p.timestamp || Date.now(),
        speed: p.coords.speed,
        heading: p.coords.heading,
        accuracy: p.coords.accuracy,
      }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 10_000 },
  );
}

export function stopTracking() {
  if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
  watchId = undefined;
  save(true);
}

export const isTracking = () => watchId !== undefined;

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save(true));
}
