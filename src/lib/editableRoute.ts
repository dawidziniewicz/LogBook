import L from 'leaflet';

export type Pt = { lat: number; lon: number };

type Options = {
  color: string;
  /** linia przerywana (linijka) */
  dashed?: boolean;
  /** biała obwódka pod linią (trasa na mapie) */
  halo?: boolean;
  /** zielony start i czerwony koniec */
  ends?: boolean;
  /** tryb usuwania: dotknięcie punktu od razu go usuwa (bez przeciągania i „+”) */
  deleteMode?: boolean;
};

const vertexIcon = (fill: string) =>
  L.divIcon({ className: 'route-vertex', html: `<span style="background:${fill}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
const midIcon = () => L.divIcon({ className: 'route-mid', html: '<span>+</span>', iconSize: [26, 26], iconAnchor: [13, 13] });

/**
 * Rysuje trasę do edycji:
 * - punkt można przeciągnąć (palcem lub myszą), linia przesuwa się na bieżąco,
 * - znacznik „+” w połowie odcinka: przeciągnij albo dotknij, aby wstawić nowy punkt,
 * - dotknięcie punktu pokazuje przycisk „Usuń punkt”.
 * Po każdej zmianie wywołuje onChange z nową listą punktów.
 */
export function drawEditableRoute(layer: L.LayerGroup, pts: Pt[], onChange: (p: Pt[]) => void, opt: Options) {
  layer.clearLayers();
  const ll = pts.map((p) => L.latLng(p.lat, p.lon));
  const lines: L.Polyline[] = [];
  if (ll.length > 1) {
    if (opt.halo) lines.push(L.polyline(ll, { color: '#ffffff', weight: 7, opacity: 0.85, interactive: false }).addTo(layer));
    lines.push(L.polyline(ll, { color: opt.color, weight: opt.halo ? 4 : 3, dashArray: opt.dashed ? '8 8' : undefined, interactive: false }).addTo(layer));
  }
  const preview = (arr: L.LatLng[]) => lines.forEach((l) => l.setLatLngs(arr));

  // „+” w połowie każdego odcinka – wstawianie punktów pośrednich (poza trybem usuwania)
  for (let i = 0; !opt.deleteMode && i < ll.length - 1; i++) {
    const mid = L.latLng((ll[i].lat + ll[i + 1].lat) / 2, (ll[i].lng + ll[i + 1].lng) / 2);
    const m = L.marker(mid, { draggable: true, icon: midIcon(), zIndexOffset: -500, title: 'Dodaj punkt' }).addTo(layer);
    m.on('drag', () => {
      const a = ll.slice();
      a.splice(i + 1, 0, m.getLatLng());
      preview(a);
    });
    const insert = (p: L.LatLng) => {
      const n = pts.slice();
      n.splice(i + 1, 0, { lat: p.lat, lon: p.lng });
      onChange(n);
    };
    m.on('dragend', () => insert(m.getLatLng()));
    m.on('click', () => insert(mid));
  }

  // punkty trasy – przeciąganie i usuwanie
  ll.forEach((p, i) => {
    const fill = opt.ends && i === 0 ? '#2c8a68' : opt.ends && i === ll.length - 1 && ll.length > 1 ? '#d6546a' : opt.color;
    if (opt.deleteMode) {
      const d = L.marker(p, { icon: L.divIcon({ className: 'route-vertex del', html: `<span style="background:${fill}">×</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(layer);
      d.on('click', () => {
        const n = pts.slice();
        n.splice(i, 1);
        onChange(n);
      });
      return;
    }
    const m = L.marker(p, { draggable: true, icon: vertexIcon(fill), autoPan: true }).addTo(layer);
    m.on('drag', () => {
      const a = ll.slice();
      a[i] = m.getLatLng();
      preview(a);
    });
    m.on('dragend', () => {
      const q = m.getLatLng();
      const n = pts.slice();
      n[i] = { lat: q.lat, lon: q.lng };
      onChange(n);
    });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small danger';
    btn.textContent = 'Usuń punkt';
    btn.onclick = () => {
      m.closePopup();
      const n = pts.slice();
      n.splice(i, 1);
      onChange(n);
    };
    m.bindPopup(btn, { closeButton: false, offset: [0, -8], className: 'route-popup' });
  });
}
