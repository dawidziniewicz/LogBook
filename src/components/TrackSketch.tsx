import { useSyncExternalStore } from 'react';
import { useVoyage } from '../store';
import { getTrack, subscribeTrack } from '../lib/tracker';
import { voyageLine } from '../lib/voyageTrack';

/** szkic śladu rejsu w SVG (bez kafelków mapy – działa offline i w druku) */
export function TrackSketch(props: { height?: number }) {
  const v = useVoyage();
  useSyncExternalStore(subscribeTrack, () => getTrack().length);
  const pts = v ? voyageLine(v, getTrack()) : [];
  if (pts.length < 2) return <p className="muted small">Ślad pojawi się po wypłynięciu z portu.</p>;
  const step = Math.max(1, Math.floor(pts.length / 1500));
  const sample = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  const lats = sample.map((p) => p.lat);
  const lons = sample.map((p) => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const minX = Math.min(...lons) * k, maxX = Math.max(...lons) * k;
  const minY = Math.min(...lats), maxY = Math.max(...lats);
  const span = Math.max(maxX - minX, maxY - minY, 0.002);
  const W = 300, H = props.height ?? 160, pad = 10;
  const sc = Math.min((W - 2 * pad) / span, (H - 2 * pad) / span);
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const xy = (p: { lat: number; lon: number }) => [ox + (p.lon * k - minX) * sc, H - (oy + (p.lat - minY) * sc)];
  const d = sample.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map((n) => n.toFixed(1)).join(' ')}`).join('');
  const [ex, ey] = xy(sample[sample.length - 1]);
  const [sx, sy] = xy(sample[0]);
  return (
    <svg className="track" viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="Szkic śladu rejsu">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r="4" className="track-start" />
      <circle cx={ex} cy={ey} r="5" className="track-end" />
    </svg>
  );
}
