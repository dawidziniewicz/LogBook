import { knotsToBeaufort, metersToVisibility, waveToDouglas } from '../data/reference';
import { toRhumb } from './geo';
import type { HourField } from '../types';

async function getJson(url: string, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** kod pogody WMO -> skróty opadów z dziennika */
function precipFromCode(code: number): string {
  if (code === 45 || code === 48) return 'MG';
  if (code >= 51 && code <= 57) return 'MŻ';
  if (code === 65 || code === 82) return 'U';
  if ((code >= 61 && code <= 64) || code === 80 || code === 81) return 'D';
  if (code === 66 || code === 67) return 'ŚD';
  if (code === 77) return 'KR';
  if ((code >= 71 && code <= 75) || code === 85 || code === 86) return 'ŚN';
  if (code === 95) return 'GRZ BŁ';
  if (code === 96 || code === 99) return 'GRZ GD';
  return '';
}

function cloudsToScale(pct: number, code: number) {
  if (code === 45 || code === 48) return 'X';
  if (pct < 20) return '0';
  if (pct < 45) return '1';
  if (pct < 70) return '2';
  return '3';
}

/**
 * Szacunkowe dane pogodowe z modelu Open-Meteo dla pozycji.
 * Wymaga internetu – na morzu bez zasięgu po prostu nic nie zwraca.
 */
export async function fetchWeather(lat: number, lon: number): Promise<Partial<Record<HourField, string>>> {
  const out: Partial<Record<HourField, string>> = {};
  const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`;
  const [wx, marine] = await Promise.allSettled([
    getJson(
      `https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,weather_code&wind_speed_unit=kn`,
    ),
    getJson(`https://marine-api.open-meteo.com/v1/marine?${q}&current=wave_height`),
  ]);
  if (wx.status === 'fulfilled' && wx.value?.current) {
    const c = wx.value.current;
    if (typeof c.temperature_2m === 'number') out.temp = c.temperature_2m.toFixed(1).replace('.', ',');
    if (typeof c.pressure_msl === 'number') out.pressure = String(Math.round(c.pressure_msl));
    if (typeof c.wind_speed_10m === 'number' && typeof c.wind_direction_10m === 'number') {
      const b = knotsToBeaufort(c.wind_speed_10m);
      const g = typeof c.wind_gusts_10m === 'number' ? knotsToBeaufort(c.wind_gusts_10m) : b;
      out.wind = `${toRhumb(c.wind_direction_10m)} ${g > b ? `${b}-${g}` : b}`;
    }
    const code = typeof c.weather_code === 'number' ? c.weather_code : 0;
    if (typeof c.cloud_cover === 'number') out.sky = [cloudsToScale(c.cloud_cover, code), precipFromCode(code)].filter(Boolean).join(' ');
    if (typeof c.visibility === 'number') out.vis = String(metersToVisibility(c.visibility));
  }
  if (marine.status === 'fulfilled' && typeof marine.value?.current?.wave_height === 'number') {
    out.sea = String(waveToDouglas(marine.value.current.wave_height));
  }
  return out;
}

/** nazwa miejsca (port / miejscowość) dla pozycji */
export async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const j = await getJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=pl&lat=${lat}&lon=${lon}`,
      6000,
    );
    const a = j?.address ?? {};
    return a.harbour || a.marina || a.city || a.town || a.village || a.hamlet || a.municipality || j?.name || undefined;
  } catch {
    return undefined;
  }
}
