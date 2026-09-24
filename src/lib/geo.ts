import { RHUMBS } from '../data/reference';

const R_NM = 3440.065; // promień Ziemi w milach morskich
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type Fix = { lat: number; lon: number; t: number; speed?: number | null; heading?: number | null; accuracy?: number };

/** odległość w milach morskich */
export function distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** kurs rzeczywisty (0–359) z punktu a do b */
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export const fmtCourse = (c: number) => String(Math.round(c) % 360).padStart(3, '0');

function dm(v: number, degDigits: number) {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = +((a - d) * 60).toFixed(3);
  if (m >= 60) { d += 1; m = 0; }
  return `${String(d).padStart(degDigits, '0')}°${m.toFixed(3).padStart(6, '0')}′`;
}
export const fmtLat = (lat: number) => `${dm(lat, 2)}${lat >= 0 ? 'N' : 'S'}`;
export const fmtLon = (lon: number) => `${dm(lon, 3)}${lon >= 0 ? 'E' : 'W'}`;
export const fmtPos = (lat: number, lon: number) => `${fmtLat(lat)} ${fmtLon(lon)}`;

export const toRhumb = (dirDeg: number) => RHUMBS[Math.round(((dirDeg % 360) + 360) % 360 / 11.25) % 32];

export const msToKn = (ms: number) => ms * 1.943844;

export function getPosition(timeout = 20000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Urządzenie nie udostępnia lokalizacji'));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          t: p.timestamp || Date.now(),
          speed: p.coords.speed,
          heading: p.coords.heading,
          accuracy: p.coords.accuracy,
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Brak zgody na lokalizację – włącz ją w ustawieniach przeglądarki/telefonu'
              : e.code === e.TIMEOUT
                ? 'Nie udało się ustalić pozycji (limit czasu)'
                : 'Pozycja niedostępna',
          ),
        ),
      { enableHighAccuracy: true, timeout, maximumAge: 5000 },
    );
  });
}

/** odległość po śladzie od czasu `from` do `to` */
export function trackDistance(track: Fix[], from: number, to: number) {
  let d = 0;
  let prev: Fix | undefined;
  for (const p of track) {
    if (p.t < from || p.t > to) continue;
    if (prev) d += distanceNm(prev, p);
    prev = p;
  }
  return d;
}
