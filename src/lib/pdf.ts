import type { jsPDF } from 'jspdf';
import type { Voyage, Tally, Signature } from '../types';
import { BASIC_CHECKS, DAY_CHECKS, HOUR_FIELDS, TRAINING } from '../data/reference';
import { allTallies, sortedDays } from './compute';
import { distanceNm, fmtLat, fmtLon, type Fix } from './geo';
import { fmtDate, hourLabel, weekday } from './time';
import { logWaypoints, voyageLine } from './voyageTrack';
import { fitBox, signatureForPdf } from './signature';
import robotoRegularUrl from '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?url';
import robotoBoldUrl from '@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf?url';

const NAVY: [number, number, number] = [31, 43, 110];
const BLUSH: [number, number, number] = [251, 234, 235];
const LINE: [number, number, number] = [90, 90, 90];

/** usuwa znaki, których nie ma w czcionce (emoji itp.) */
const t = (s?: string | number | null) =>
  String(s ?? '')
    .replace(/⚓/g, 'Kotw.')
    .replace(/[^\u0000-\u024F\u0370-\u03FF\u2000-\u206F\u2190-\u21FF\u2260-\u2265°′″]/gu, '')
    .trim();
const c = (n: number) => String(n).replace('.', ',');

async function fontBase64(url: string) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ---------- mapa śladu jako obraz (Web Mercator + kafelki) ---------- */

const TILE = 256;
const worldX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => res(null), 8000);
    img.onload = () => (clearTimeout(timer), res(img));
    img.onerror = () => (clearTimeout(timer), res(null));
    img.src = url;
  });
}

/** mapa śladu jako obraz; `custom` = trasa narysowana ręcznie zamiast śladu z dziennika */
export async function renderTrackImage(v: Voyage, track: Fix[], W = 1100, H = 820, custom?: { lat: number; lon: number }[]) {
  const line = custom ?? voyageLine(v, track);
  const wps = custom ? [] : logWaypoints(v);
  const pts = [...line, ...wps];
  if (!pts.length) return undefined;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const pad = Math.round(Math.min(W, H) * 0.09);
  // płynne dopasowanie: kafelki z najbliższego wyższego poziomu, przeskalowane w dół
  const spanX = Math.max(worldX(maxLon, 0) - worldX(minLon, 0), 1e-9);
  const spanY = Math.max(worldY(minLat, 0) - worldY(maxLat, 0), 1e-9);
  let zf = Math.log2(Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY));
  if (pts.length === 1 || !isFinite(zf)) zf = 13;
  zf = Math.max(2, Math.min(15, zf));
  const z = Math.ceil(zf);
  const k = 2 ** (zf - z); // ≤ 1
  const VW = W / k;
  const VH = H / k;
  const cx = (worldX(minLon, z) + worldX(maxLon, z)) / 2;
  const cy = (worldY(maxLat, z) + worldY(minLat, z)) / 2;
  const x0 = cx - VW / 2;
  const y0 = cy - VH / 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#aad3df';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.scale(k, k);

  const n = 2 ** z;
  const jobs: Promise<void>[] = [];
  const tiles: { img: HTMLImageElement | null; x: number; y: number; layer: number }[] = [];
  for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + VW) / TILE); tx++) {
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + VH) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      const pos = { x: tx * TILE - x0, y: ty * TILE - y0 };
      jobs.push(loadTile(`https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`).then((img) => void tiles.push({ img, ...pos, layer: 0 })));
      jobs.push(loadTile(`https://tiles.openseamap.org/seamark/${z}/${wx}/${ty}.png`).then((img) => void tiles.push({ img, ...pos, layer: 1 })));
    }
  }
  await Promise.all(jobs);
  for (const layer of [0, 1]) for (const tl of tiles) if (tl.layer === layer && tl.img) ctx.drawImage(tl.img, tl.x, tl.y, TILE + 0.5, TILE + 0.5);
  ctx.restore();

  const px = (p: { lat: number; lon: number }) => [(worldX(p.lon, z) - x0) * k, (worldY(p.lat, z) - y0) * k] as const;
  if (line.length > 1) {
    for (const [color, width] of [['#ffffff', 9], ['#3447aa', 5]] as const) {
      ctx.beginPath();
      line.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  const dot = (p: { lat: number; lon: number }, r: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(...px(p), r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  };
  for (const w of wps) dot(w, w.kind === 'port' ? 9 : 5, w.kind === 'port' ? '#d6546a' : '#3447aa');
  if (line.length) {
    dot(line[0], 9, '#2c8a68');
    dot(line[line.length - 1], 11, '#d6546a');
  }
  ctx.font = '16px sans-serif';
  const credit = '© OpenStreetMap · © OpenSeaMap';
  const cw = ctx.measureText(credit).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(W - cw - 16, H - 28, cw + 16, 28);
  ctx.fillStyle = '#333';
  ctx.fillText(credit, W - cw - 8, H - 9);

  let length = 0;
  for (let i = 1; i < line.length; i++) length += distanceNm(line[i - 1], line[i]);
  let dataUrl: string | undefined;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    dataUrl = undefined; // kafelki bez CORS „brudzą” canvas – wtedy bez mapy
  }
  return dataUrl ? { dataUrl, length, W, H } : undefined;
}

/* ---------- dokument ---------- */

export type AutoTable = (doc: jsPDF, opts: Record<string, unknown>) => void;

/** jsPDF + autotable z czcionką Roboto (polskie znaki) – ładowane dopiero przy eksporcie */
export async function newPdfDoc() {
  const [{ jsPDF }, atMod, reg, bold] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    fontBase64(robotoRegularUrl),
    fontBase64(robotoBoldUrl),
  ]);
  const autoTable = (atMod.default ?? (atMod as unknown as { autoTable: AutoTable }).autoTable) as unknown as AutoTable;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Roboto-Regular.ttf', reg);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', bold);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');
  return { doc, autoTable };
}

export { t as pdfText };

export async function buildVoyagePdf(v: Voyage, track: Fix[], onStep?: (s: string) => void): Promise<Blob> {
  onStep?.('Wczytuję czcionki…');
  const { doc, autoTable } = await newPdfDoc();

  const M = 12;
  const PW = 210;
  const base = {
    theme: 'grid',
    margin: { left: M, right: M, top: M, bottom: 16 },
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 1.4, lineColor: LINE, lineWidth: 0.15, textColor: [20, 20, 20], valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: BLUSH, textColor: NAVY, halign: 'center' },
  };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const h2 = (text: string, y: number) => {
    if (y > 270) {
      doc.addPage();
      y = M + 4;
    }
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(t(text), M, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('Roboto', 'normal');
    return y + 3;
  };
  const kv = (rows: [string, string][], startY: number) =>
    autoTable(doc, {
      ...base,
      startY,
      body: rows.map(([k, val]) => [t(k), t(val)]),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70, fillColor: [253, 245, 246] } },
    });

  /* --- strona tytułowa --- */
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('DZIENNIK JACHTOWY', PW / 2, 24, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('Roboto', 'normal');
  if (v.yachtName) doc.text(t(`s/y ${v.yachtName}`), PW / 2, 32, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  kv(
    [
      ['Nazwa rejsu', v.name],
      ['Akwen', v.area],
      ['Nazwa jachtu', v.yachtName],
      ['Armator', v.owner],
      ['Port macierzysty', v.homePort],
      ['Wywoływanie UKF', v.vhfCall],
      ['MMSI', v.mmsi],
      ['Zaokrętowanie', `${v.embarkDate ? fmtDate(v.embarkDate) : ''} ${v.embarkPort}`],
      ['Wyokrętowanie', `${v.disembarkDate ? fmtDate(v.disembarkDate) : ''} ${v.disembarkPort}`],
    ],
    40,
  );
  kv(
    [
      ['Rodzaj jachtu', v.yacht.rig],
      ['Producent i typ jachtu', v.yacht.maker],
      ['Długość LC / LW [m]', `${v.yacht.loa} / ${v.yacht.lwl}`],
      ['Szerokość Bmax / zanurzenie Tmax [m]', `${v.yacht.beam} / ${v.yacht.draft}`],
      ['Masa całkowita / balast [t]', `${v.yacht.mass} / ${v.yacht.ballast}`],
      ['Pojemność brutto GT', v.yacht.gt],
      ['Wysokość masztu od linii wody [m]', v.yacht.mast],
      ['Silnik (producent, typ, moc)', v.yacht.engine],
      ['Silnik pomocniczy', v.yacht.auxEngine],
    ],
    h2('Podstawowe dane jachtu', lastY() + 9),
  );
  autoTable(doc, {
    ...base,
    startY: h2('Spis ożaglowania', lastY() + 9),
    head: [['Lp.', 'Nazwa żagla', 'Oznaczenie', 'Refy', 'Powierzchnia', 'Uwagi']],
    body: v.sails.map((s, i) => [i + 1, t(s.name), t(s.code), t(s.reefs), t(s.area), t(s.notes)]),
  });
  autoTable(doc, {
    ...base,
    startY: h2('Podstawowe informacje – sprawdzenie stanu jachtu i załogi', lastY() + 9),
    head: [['Pozycja', 'Stan', 'Uwagi']],
    body: BASIC_CHECKS.map((b) => [t(b.label), t((v.checks[b.key]?.value ?? '').replace('|', ' / ')), t(v.checks[b.key]?.note)]),
    columnStyles: { 0: { cellWidth: 75 } },
  });
  const trainingDone = TRAINING.flatMap((g) => g.items).filter((i) => v.training.done[i.id]).length;
  const trainingAll = TRAINING.flatMap((g) => g.items).length;
  kv(
    [
      ['Omówione tematy', `${trainingDone} / ${trainingAll}`],
      ['Szkolenie przeprowadził', v.training.by],
      ['Potwierdzam udział w szkoleniu', v.training.confirmed],
    ],
    h2('Szkolenie z obsługi jachtu i bezpieczeństwa', lastY() + 9),
  );

  /* --- karta rejsu + mapa --- */
  onStep?.('Rysuję mapę śladu…');
  const tallies = allTallies(v);
  const days = sortedDays(v);
  const total: Tally | undefined = days.length ? tallies[days[days.length - 1]].total : undefined;
  const ports = [...new Set(days.flatMap((d) => [v.days[d].portOut, v.days[d].portStay, v.days[d].portIn]).flatMap((p) => (p ? p.split(',') : [])).map((p) => p.trim()).filter(Boolean))];
  doc.addPage();
  kv(
    [
      ['Liczba dni rejsu', String(days.length)],
      ['Przebyto mil morskich', total ? c(total.miles) : '0'],
      ['Godziny żeglugi (pod żaglami / na silniku)', total ? `${total.total} (${total.sail} / ${total.engine})` : '0'],
      ['Godziny postoju', String(total?.port ?? 0)],
      ['Godziny żeglugi przy wietrze > 6°B', String(total?.above6 ?? 0)],
      ['Odwiedzane porty', ports.join(', ')],
      ['Porty pływowe / mile po wodach pływowych', `${v.card.tidalPorts || '—'} / ${v.card.tidalMiles || '—'}`],
      ['Uczestnicy rejsu', v.crew.map((m) => `${m.firstName} ${m.lastName}${m.role ? ` (${m.role})` : ''}`).join(', ')],
    ],
    h2('Karta rejsu', M + 4),
  );
  const map = await renderTrackImage(v, track);
  if (map) {
    let y = h2('Ślad rejsu', lastY() + 9);
    const w = PW - 2 * M;
    const h = (w * map.H) / map.W;
    if (y + h > 285) {
      doc.addPage();
      y = h2('Ślad rejsu', M + 4);
    }
    doc.addImage(map.dataUrl, 'JPEG', M, y + 1, w, h);
    doc.setDrawColor(...LINE);
    doc.rect(M, y + 1, w, h);
    doc.setFontSize(8);
    doc.text(t(`Długość śladu: ${map.length.toFixed(1).replace('.', ',')} Mm`), M, y + h + 5);
  }

  /* --- dni --- */
  onStep?.('Składam strony dziennika…');
  for (const d of days) {
    const day = v.days[d];
    const tl = tallies[d];
    doc.addPage();
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.text(t(`1. DZIEŃ TYGODNIA: ${weekday(d)}`), M, M + 2);
    doc.text(t(`2. DATA: ${fmtDate(d)}`), PW - M, M + 2, { align: 'right' });
    doc.setFont('Roboto', 'normal');
    autoTable(doc, {
      ...base,
      startY: M + 5,
      styles: { ...base.styles, fontSize: 7, cellPadding: 0.9, halign: 'center', minCellHeight: 7.6 },
      headStyles: { ...base.headStyles, fontSize: 6.5 },
      head: [['3. GODZ.', ...HOUR_FIELDS.map((f) => `${f.no}. ${f.short}`)]],
      body: Array.from({ length: 24 }, (_, i) => i + 1).map((h) => [hourLabel(h), ...HOUR_FIELDS.map((f) => t(day.hours[h]?.[f.key]))]),
      columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY, fillColor: [253, 245, 246] } },
    });
    if (tl) {
      const cols: [keyof Tally, string][] = [['port', 'Na postoju'], ['sail', 'Pod żaglami'], ['engine', 'Na silniku'], ['total', 'Łącznie żeglugi'], ['above6', 'W tym > 6°B'], ['miles', 'Przebyto Mm']];
      autoTable(doc, {
        ...base,
        startY: lastY() + 4,
        styles: { ...base.styles, halign: 'center' },
        head: [['17. Zliczenie', ...cols.map(([, l]) => l)]],
        body: [
          ['Z przeniesienia', ...cols.map(([k]) => c(tl.carry[k]))],
          ['Z bieżącej doby', ...cols.map(([k]) => c(tl.today[k]))],
          ['Do przeniesienia', ...cols.map(([k]) => c(tl.total[k]))],
        ],
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
      });
    }
    doc.addPage();
    autoTable(doc, {
      ...base,
      startY: M,
      body: [
        [{ content: '18A. Port wyjścia', styles: { fontStyle: 'bold' } }, t(day.portOut), { content: '18B. Port wejścia', styles: { fontStyle: 'bold' } }, t(day.portIn)],
        [{ content: '18C. Postój w porcie', styles: { fontStyle: 'bold' } }, { content: t(day.portStay), colSpan: 3 }],
      ],
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 57 }, 2: { cellWidth: 36 }, 3: { cellWidth: 57 } },
    });
    autoTable(doc, {
      ...base,
      startY: lastY() + 4,
      head: [['Godz.', '19. Wachta', '20. Przebieg żeglugi oraz uwagi', '21. Φ', 'Λ', '22. Podpis oficera']],
      body: day.events.length
        ? day.events.map((e) => [e.time.replace(':', ''), t(e.watch), t(e.text), e.lat != null ? fmtLat(e.lat) : '', e.lon != null ? fmtLon(e.lon) : '', t(e.officer)])
        : [['', '', 'Brak wpisów', '', '', '']],
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 24 }, 4: { cellWidth: 26 }, 5: { cellWidth: 26 } },
    });
    autoTable(doc, {
      ...base,
      startY: lastY() + 4,
      head: [['', 'Godzina', 'Uwagi / III oficer']],
      body: DAY_CHECKS.map((k) => [`${k.no}. ${k.label}`, t(day.checks[k.key]?.time), t(day.checks[k.key]?.note)]),
      columnStyles: { 0: { cellWidth: 75, fontStyle: 'bold' }, 1: { cellWidth: 22, halign: 'center' } },
    });
    // 29. podpisy
    let y = lastY() + 8;
    if (y > 250) {
      doc.addPage();
      y = M + 4;
    }
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9);
    doc.text('29. Dziennik jachtowy za dzień bieżący sprawdzono i zamknięto', M, y);
    doc.setFont('Roboto', 'normal');
    const sigW = (PW - 2 * M - 8) / 2;
    const sigs: [string, Signature | undefined][] = [['I oficer', day.firstOfficer], ['Kapitan', day.captain]];
    const prepared = await Promise.all(sigs.map(([, sig]) => signatureForPdf(sig?.image)));
    sigs.forEach(([label, sig], i) => {
      const x = M + i * (sigW + 8);
      doc.setDrawColor(...LINE);
      doc.rect(x, y + 3, sigW, 28);
      doc.setFontSize(8);
      doc.text(t(`${label}: ${sig?.name ?? ''}`), x + 2, y + 7);
      const img = prepared[i];
      if (img) {
        const fb = fitBox(img.w, img.h, sigW - 4, 20);
        doc.addImage(img.data, 'JPEG', x + 2, y + 9, fb.w, fb.h);
      }
    });
  }

  /* --- crew list --- */
  doc.addPage();
  autoTable(doc, {
    ...base,
    startY: h2('Crew list', M + 4),
    styles: { ...base.styles, fontSize: 7 },
    headStyles: { ...base.headStyles, fontSize: 6.5 },
    head: [['Lp.', 'Imię', 'Nazwisko', 'Stopień', 'Nr patentu', 'Funkcja', 'Narodowość', 'Nr dokumentu', 'Data i miejsce ur.', 'Telefon', 'Dodatkowe']],
    body: v.crew.map((m, i) => [i + 1, t(m.firstName), t(m.lastName), t(m.grade), t(m.patent), t(m.role), t(m.nationality), t(m.docNo), t(m.birth), t(m.phone), t(m.info)]),
  });

  /* --- stopki --- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(t(`${v.yachtName ? `s/y ${v.yachtName} · ` : ''}${v.name || 'Dziennik jachtowy'}`), M, 290);
    doc.text(`${i} / ${pages}`, PW - M, 290, { align: 'right' });
  }
  return doc.output('blob');
}

export const pdfFileName = (v: Voyage) =>
  `Dziennik-${(v.yachtName || v.name || 'rejs').replace(/[^\p{L}\p{N}]+/gu, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
