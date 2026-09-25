import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { distanceNm } from '../lib/geo';
import { drawEditableRoute } from '../lib/editableRoute';
import { AsyncButton, toast } from './ui';

type Pt = { lat: number; lon: number };

async function geocode(q: string): Promise<Pt | undefined> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pl&q=${encodeURIComponent(q)}`);
  const j = await r.json();
  return j?.[0] ? { lat: +j[0].lat, lon: +j[0].lon } : undefined;
}

/** ręczne rysowanie trasy rejsu na mapie – dotknięcie dodaje kolejny punkt */
export function RouteDrawer(props: { value: Pt[]; onChange: (pts: Pt[]) => void; startPlace?: string; fallback?: Pt }) {
  const div = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>(null);
  const layer = useRef<L.LayerGroup>(null);
  const pts = useRef(props.value);
  pts.current = props.value;
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;
  const [delMode, setDelMode] = useState(false);
  const del = useRef(false);
  del.current = delMode;

  useEffect(() => {
    const m = L.map(div.current!, { attributionControl: false, worldCopyJump: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: 'anonymous' }).addTo(m);
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, crossOrigin: 'anonymous' }).addTo(m);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    // w trybie usuwania dotknięcie mapy nie dodaje punktów
    m.on('click', (e: L.LeafletMouseEvent) => !del.current && onChange.current([...pts.current, { lat: e.latlng.lat, lon: e.latlng.lng }]));
    const p = pts.current;
    if (p.length > 1) m.fitBounds(L.latLngBounds(p.map((x) => [x.lat, x.lon] as L.LatLngTuple)), { padding: [30, 30] });
    else if (p.length === 1) m.setView([p[0].lat, p[0].lon], 11);
    else if (props.fallback) m.setView([props.fallback.lat, props.fallback.lon], 10);
    else m.setView([54.6, 18.6], 7);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(div.current!);
    // bez punktów i bez pozycji: spróbuj wycentrować na porcie zaokrętowania
    if (!p.length && !props.fallback && props.startPlace && navigator.onLine) {
      void geocode(props.startPlace)
        .then((g) => g && m.setView([g.lat, g.lon], 10))
        .catch(() => {});
    }
    return () => {
      ro.disconnect();
      m.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const l = layer.current;
    if (!l) return;
    drawEditableRoute(l, props.value, (p) => onChange.current(p), { color: '#3447aa', halo: true, ends: true, deleteMode: delMode });
  }, [props.value, delMode]);

  let nm = 0;
  for (let i = 1; i < props.value.length; i++) nm += distanceNm(props.value[i - 1], props.value[i]);

  return (
    <div className="route-drawer">
      <div className="voyage-map">
        <div ref={div} className="map-canvas route-canvas" />
      </div>
      <div className="row gap-s wrap">
        <span className="route-info">
          <b>{props.value.length}</b> pkt · <b>{nm.toFixed(1).replace('.', ',')} Mm</b>
        </span>
        <button className="btn small ghost" disabled={!props.value.length} onClick={() => props.onChange(props.value.slice(0, -1))}>
          ↶ Cofnij
        </button>
        <button className={`btn small${delMode ? ' danger-on' : ' ghost'}`} disabled={!props.value.length && !delMode} onClick={() => setDelMode(!delMode)}>
          🗑 {delMode ? 'Zakończ usuwanie' : 'Usuwaj punkty'}
        </button>
        <button className="btn small ghost" disabled={props.value.length < 2} onClick={() => props.onChange([...props.value, props.value[0]])}>
          ⟲ Wróć do startu
        </button>
        <button
          className="btn small ghost danger"
          disabled={!props.value.length}
          onClick={() => confirm('Usunąć narysowaną trasę?') && props.onChange([])}
        >
          Wyczyść
        </button>
        {props.startPlace && (
          <AsyncButton
            className="btn small ghost"
            onClick={async () => {
              const g = await geocode(props.startPlace!).catch(() => undefined);
              if (g) map.current?.setView([g.lat, g.lon], 10);
              else toast('Nie znaleziono portu na mapie', 'err');
            }}
          >
            ⌖ Port zaokrętowania
          </AsyncButton>
        )}
      </div>
      <span className="field-hint">
        {delMode
          ? 'Tryb usuwania: dotknij punktu (×), aby go usunąć.'
          : 'Dotykaj mapy w kolejnych punktach trasy (porty, zwroty). Punkty możesz przeciągać, „+” w połowie odcinka wstawia punkt pośredni, a „🗑 Usuwaj punkty” pozwala je usuwać.'}
      </span>
    </div>
  );
}
