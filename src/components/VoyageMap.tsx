import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useVoyage } from '../store';
import { getTrack, subscribeTrack } from '../lib/tracker';
import { logWaypoints, voyageLine } from '../lib/voyageTrack';
import { bearing, distanceNm, fmtCourse, fmtLat, fmtLon, getPosition } from '../lib/geo';
import { num, sortedDays } from '../lib/compute';
import { AsyncButton, toast } from './ui';

type Pt = { lat: number; lon: number };
type Mode = 'boat' | 'ruler';

const fmtNm = (d: number) => `${d.toFixed(d < 10 ? 2 : 1).replace('.', ',')} Mm`;
const fmtEta = (h: number) => {
  const m = Math.round(h * 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

/** margines dopasowania – przy panelu pomiaru zostaw miejsce na dole */
const fitPad = (panel: boolean): L.FitBoundsOptions => ({ paddingTopLeft: [30, 30], paddingBottomRight: [30, panel ? 190 : 30] });

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#3447aa';
}

/** mapa rejsu: OpenStreetMap + znaki nawigacyjne OpenSeaMap, ślad i pomiar odległości */
export function VoyageMap(props: {
  measure?: boolean;
  /** wersja do druku: bez przycisków i interakcji, zgłasza gotowość po wczytaniu kafelków */
  print?: boolean;
  onReady?: () => void;
  className?: string;
}) {
  const v = useVoyage();
  const trackLen = useSyncExternalStore(subscribeTrack, () => getTrack().length);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>(null);
  const dataLayer = useRef<L.LayerGroup>(null);
  const measureLayer = useRef<L.LayerGroup>(null);
  const boatMarker = useRef<L.CircleMarker>(null);
  const userMoved = useRef(false);
  const programmatic = useRef(false);
  const osmRef = useRef<L.TileLayer>(null);
  const readyFired = useRef(false);
  const [mode, setMode] = useState<Mode>('boat');
  const [boat, setBoat] = useState<Pt>();
  const [target, setTarget] = useState<Pt>();
  const [ruler, setRuler] = useState<Pt[]>([]);

  const line = useMemo(() => (v ? voyageLine(v, getTrack()) : []), [v, trackLen]); // eslint-disable-line react-hooks/exhaustive-deps
  const waypoints = useMemo(() => (v ? logWaypoints(v) : []), [v]);
  const lastSpeed = useMemo(() => {
    if (!v) return NaN;
    for (const d of sortedDays(v).reverse())
      for (let h = 24; h >= 1; h--) {
        const s = num(v.days[d].hours[h]?.speed);
        if (!isNaN(s)) return s;
      }
    return NaN;
  }, [v]);
  const boatPos: Pt | undefined = boat ?? line[line.length - 1];

  // inicjalizacja mapy
  useEffect(() => {
    // w podsumowaniu mapa nie może „łapać” przewijania strony palcem ani kółkiem
    const embedded = !props.measure;
    const still = !!props.print;
    const map = L.map(divRef.current!, {
      zoomControl: !still,
      worldCopyJump: true,
      zoomSnap: still ? 0.25 : 1,
      dragging: !still && !(embedded && L.Browser.mobile),
      touchZoom: !still,
      doubleClickZoom: !still,
      boxZoom: !still,
      keyboard: !still,
      scrollWheelZoom: !embedded,
    }).setView([54.6, 18.6], 8);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: 'anonymous',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const seamarks = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      crossOrigin: 'anonymous',
      attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a>',
    }).addTo(map);
    osmRef.current = osm;
    if (!still) L.control.layers({ 'Mapa (OSM)': osm }, { 'Znaki nawigacyjne (OpenSeaMap)': seamarks }, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
    // dopasowuj widok do śladu, dopóki użytkownik sam nie przesunie mapy
    map.on('dragstart', () => (userMoved.current = true));
    map.on('zoomstart', () => {
      if (!programmatic.current) userMoved.current = true;
    });
    dataLayer.current = L.layerGroup().addTo(map);
    measureLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(divRef.current!);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ślad i punkty z dziennika
  useEffect(() => {
    const map = mapRef.current;
    const layer = dataLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const primary = css('--primary');
    const coral = css('--coral');
    const ok = css('--ok');
    const latlngs = line.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: '#ffffff', weight: 7, opacity: 0.8 }).addTo(layer);
      L.polyline(latlngs, { color: primary, weight: 4 }).addTo(layer);
    }
    for (const w of waypoints) {
      const port = w.kind === 'port';
      L.circleMarker([w.lat, w.lon], {
        radius: port ? 7 : 4,
        color: '#fff',
        weight: 2,
        fillColor: port ? coral : primary,
        fillOpacity: 1,
      })
        .bindPopup(`<b>${w.label}</b><br>${fmtLat(w.lat)} ${fmtLon(w.lon)}`)
        .addTo(layer);
    }
    if (line.length) {
      L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: ok, fillOpacity: 1 }).bindTooltip('Start').addTo(layer);
    }
    if (!userMoved.current && latlngs.length) {
      programmatic.current = true;
      if (latlngs.length === 1) map.setView(latlngs[0], 13, { animate: false });
      else map.fitBounds(L.latLngBounds(latlngs), { ...fitPad(!!props.measure), maxZoom: 14, animate: false });
      programmatic.current = false;
    }
    // druk: gotowe, gdy kafelki dla widoku ze śladem się wczytają (lub po limicie czasu – np. offline)
    if (props.print && props.onReady && !readyFired.current) {
      const fire = () => {
        if (readyFired.current) return;
        readyFired.current = true;
        props.onReady?.();
      };
      osmRef.current?.once('load', () => setTimeout(fire, 300));
      setTimeout(fire, 10_000);
    }
  }, [line, waypoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // pozycja jachtu
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    boatMarker.current?.remove();
    if (!boatPos) return;
    boatMarker.current = L.circleMarker([boatPos.lat, boatPos.lon], { radius: 9, color: '#fff', weight: 3, fillColor: css('--coral'), fillOpacity: 1 })
      .bindTooltip('Jacht')
      .addTo(map);
  }, [boatPos?.lat, boatPos?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // kliknięcie w mapę = pomiar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.measure) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const p = { lat: e.latlng.lat, lon: e.latlng.lng };
      if (mode === 'boat') setTarget(p);
      else setRuler((r) => [...r, p]);
    };
    map.on('click', onClick);
    return () => void map.off('click', onClick);
  }, [mode, props.measure]);

  // rysowanie pomiaru
  const result = useMemo(() => {
    if (mode === 'boat' && boatPos && target) {
      const d = distanceNm(boatPos, target);
      return { d, brg: bearing(boatPos, target), pts: [boatPos, target] };
    }
    if (mode === 'ruler' && ruler.length) {
      let d = 0;
      for (let i = 1; i < ruler.length; i++) d += distanceNm(ruler[i - 1], ruler[i]);
      const n = ruler.length;
      return { d, brg: n > 1 ? bearing(ruler[n - 2], ruler[n - 1]) : undefined, pts: ruler };
    }
    return undefined;
  }, [mode, boatPos, target, ruler]);

  useEffect(() => {
    const layer = measureLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (!result) return;
    const ll = result.pts.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    const color = css('--coral');
    if (ll.length > 1) L.polyline(ll, { color, weight: 3, dashArray: '8 8' }).addTo(layer);
    ll.forEach((p, i) => {
      if (mode === 'boat' && i === 0) return;
      L.circleMarker(p, { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(layer);
    });
    const last = ll[ll.length - 1];
    L.tooltip({ permanent: true, direction: 'top', offset: [0, -8], className: 'measure-tip' })
      .setLatLng(last)
      .setContent(`<b>${fmtNm(result.d)}</b>`)
      .addTo(layer);
  }, [result, mode]);

  const fitTrack = () => {
    const map = mapRef.current;
    if (!map || !line.length) return toast('Brak śladu do pokazania', 'info');
    map.fitBounds(L.latLngBounds(line.map((p) => [p.lat, p.lon] as L.LatLngTuple)), { ...fitPad(!!props.measure), maxZoom: 14 });
    userMoved.current = false;
  };

  return (
    <div className={`voyage-map${props.print ? ' print-map' : ''} ${props.className ?? ''}`}>
      <div ref={divRef} className="map-canvas" />
      {!props.measure && line.length > 1 && !props.print && (
        <div className="map-foot">
          Długość śladu: <b>{fmtNm(line.reduce((d, p, i) => (i ? d + distanceNm(line[i - 1], p) : 0), 0))}</b>
          <span className="muted"> · {line.length} punktów</span>
        </div>
      )}
      {props.measure && (
        <div className="map-panel">
          <div className="seg">
            <button className={mode === 'boat' ? 'on' : ''} onClick={() => setMode('boat')}>
              Od jachtu
            </button>
            <button className={mode === 'ruler' ? 'on' : ''} onClick={() => setMode('ruler')}>
              Linijka
            </button>
          </div>
          <div className="map-result">
            {result ? (
              <>
                <b>{fmtNm(result.d)}</b>
                {result.brg != null && <span> · kurs {fmtCourse(result.brg)}°</span>}
                {mode === 'boat' && lastSpeed > 0.3 && <span className="muted"> · ~{fmtEta(result.d / lastSpeed)} przy {String(lastSpeed).replace('.', ',')} w</span>}
                {mode === 'ruler' && <span className="muted"> · {ruler.length} pkt</span>}
              </>
            ) : (
              <span className="muted">
                {mode === 'boat'
                  ? boatPos
                    ? 'Dotknij mapy, aby zmierzyć odległość od jachtu'
                    : 'Brak pozycji jachtu – użyj „Moja pozycja”'
                  : 'Dotykaj kolejnych punktów trasy'}
              </span>
            )}
          </div>
          <div className="row gap-s wrap">
            <AsyncButton
              className="btn small"
              onClick={async () => {
                const f = await getPosition();
                setBoat(f);
                mapRef.current?.setView([f.lat, f.lon], Math.max(mapRef.current.getZoom(), 12));
              }}
            >
              📍 Moja pozycja
            </AsyncButton>
            <button className="btn small ghost" onClick={fitTrack}>
              Cały ślad
            </button>
            {mode === 'ruler' && ruler.length > 0 && (
              <button className="btn small ghost" onClick={() => setRuler((r) => r.slice(0, -1))}>
                ↶ Cofnij
              </button>
            )}
            {(target || ruler.length > 0) && (
              <button
                className="btn small ghost"
                onClick={() => {
                  setTarget(undefined);
                  setRuler([]);
                }}
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
