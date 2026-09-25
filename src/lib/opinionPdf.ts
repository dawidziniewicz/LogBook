import type { jsPDF } from 'jspdf';
import type { CrewMember, OpinionLang, Tally, Voyage } from '../types';
import { DEFAULT_CLUB_HEADER } from '../data/opinion';
import { allTallies, num, sortedDays } from './compute';
import type { Fix } from './geo';
import { newPdfDoc, pdfText as t, renderTrackImage } from './pdf';
import { containToRatio, cropToRatio, imageSize } from './photo';
import { dateKey } from './time';
import { fitBox, signatureForPdf } from './signature';
import logoUrl from '../assets/akz-logo.png';

const NAVY: [number, number, number] = [31, 43, 110];
const INK: [number, number, number] = [23, 27, 63];
const MUTED: [number, number, number] = [98, 103, 140];
const BLUSH: [number, number, number] = [251, 234, 235];
const PT = 0.3528; // mm na punkt

const dot = (d?: string) => (d ? d.split('-').reverse().join('.') : '');
const c = (n: number) => String(n).replace('.', ',');
const list = (s?: string) => (s ?? '').split(',').map((p) => p.trim()).filter(Boolean);

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

/* ---------- tłumaczenia (opinia PL / EN / PL+EN, wg dwujęzycznego wzoru PZŻ) ---------- */

/** angielskie odpowiedniki wartości z list wyboru (porównanie bez wielkości liter) */
const VALUES_EN: Record<string, string> = {
  'bardzo dobrze': 'Very good',
  dobrze: 'Good',
  miernie: 'Fair',
  niewłaściwie: 'Inadequately',
  'nie podlegał': 'Not affected',
  'nie podlegała': 'Not affected',
  'chorował, ale mógł pracować': 'Seasick, but able to work',
  'chorowała, ale mogła pracować': 'Seasick, but able to work',
  'chorował, co wykluczało pracę': 'Seasick, unable to work',
  'chorowała, co wykluczało pracę': 'Seasick, unable to work',
  dobra: 'Good',
  średnia: 'Average',
  słaba: 'Poor',
  'sternika jachtowego': 'Yacht Skipper',
  'jachtowego sternika morskiego': 'Offshore Yacht Skipper',
  'kapitana jachtowego': 'Yacht Captain',
  'nie dotyczy': 'Not applicable',
  brak: 'None',
  'żeglarz jachtowy': 'Yacht Sailor',
  'sternik jachtowy': 'Yacht Skipper',
  'jachtowy sternik morski': 'Offshore Yacht Skipper',
  'kapitan jachtowy': 'Yacht Captain',
  kapitan: 'Captain',
  'pierwszy oficer': 'First Mate',
  'drugi oficer': 'Second Mate',
  'trzeci oficer': 'Third Mate',
  'oficer wachtowy': 'Watch Officer',
  załoga: 'Crew',
  kuk: 'Cook',
  mechanik: 'Engineer',
  bosman: 'Boatswain',
  ket: 'Cat',
  slup: 'Sloop',
  sluter: 'Cutter',
  jol: 'Yawl',
  kecz: 'Ketch',
  szkuner: 'Schooner',
  tak: 'Yes',
  nie: 'No',
};

function i18n(lang: OpinionLang) {
  /** etykieta: PL, EN albo „PL / EN” */
  const L = (pl: string, en: string) => (lang === 'pl' ? pl : lang === 'en' ? en : `${pl} / ${en}`);
  /** wartość z listy wyboru przetłumaczona, gdy znamy odpowiednik; tekst wpisany ręcznie bez zmian */
  const V = (x?: string) => {
    if (!x) return '';
    const en = VALUES_EN[x.trim().toLowerCase()];
    if (!en || lang === 'pl') return x;
    return lang === 'en' ? en : `${x} / ${en}`;
  };
  return { L, V };
}

/* ---------- dane ---------- */

export const captainOf = (v: Voyage) => v.crew.find((m) => /kapitan|captain/i.test(m.role));

const ZERO: Tally = { port: 0, sail: 0, engine: 0, total: 0, above6: 0, miles: 0 };

/** zestawienie z dziennika (bez ręcznych poprawek) */
export function logTotals(v: Voyage): Tally {
  const days = sortedDays(v);
  return days.length ? allTallies(v)[days[days.length - 1]].total : ZERO;
}
export function logPorts(v: Voyage) {
  const days = sortedDays(v);
  return [...new Set(days.flatMap((d) => [v.days[d].portOut, v.days[d].portStay, v.days[d].portIn]).flatMap((p) => list(p)))];
}
/** liczba dni rejsu: z dat zaokrętowania/wyokrętowania, a bez nich – z dni w dzienniku */
export function logDays(v: Voyage) {
  if (v.embarkDate && v.disembarkDate && v.disembarkDate >= v.embarkDate) {
    return Math.round((new Date(`${v.disembarkDate}T12:00:00`).getTime() - new Date(`${v.embarkDate}T12:00:00`).getTime()) / 86_400_000) + 1;
  }
  return sortedDays(v).length;
}

export type OpinionTotals = Tally & { tidal: number; days: number };

/** zestawienie do opinii: wartości wpisane ręcznie mają pierwszeństwo przed dziennikiem */
export function opinionTotals(v: Voyage): OpinionTotals {
  const log = logTotals(v);
  const h = v.opinion?.hours ?? {};
  const has = (k: keyof typeof h) => !!h[k]?.trim() && !isNaN(num(h[k]));
  const pick = (k: keyof Tally) => (has(k) ? num(h[k]) : log[k]);
  const sail = pick('sail');
  const engine = pick('engine');
  const total = has('total') ? num(h.total) : has('sail') || has('engine') ? sail + engine : log.total;
  const days = v.opinion?.days?.trim() && !isNaN(num(v.opinion.days)) ? num(v.opinion.days) : logDays(v);
  return { port: pick('port'), sail, engine, total, above6: pick('above6'), miles: pick('miles'), tidal: has('tidal') ? num(h.tidal) : 0, days };
}

/** dane wspólne dla wszystkich opinii z rejsu */
function voyageFacts(v: Voyage) {
  const days = sortedDays(v);
  const manualPorts = list(v.opinion?.ports);
  const ports = manualPorts.length ? manualPorts : logPorts(v);
  const tidalPorts = list(v.opinion?.tidalPorts);
  const sailSum = v.sails.reduce((s, x) => s + (isNaN(num(x.area)) ? 0 : num(x.area)), 0);
  const cap = captainOf(v);
  return {
    total: opinionTotals(v),
    ports,
    tidalPorts,
    tidalCount: tidalPorts.length || (num(v.card.tidalPorts) || 0),
    sailArea: v.opinion?.sailArea || (sailSum ? c(+sailSum.toFixed(1)) : ''),
    crewNames: v.crew.map((m) => `${m.firstName} ${m.lastName}`.trim()).filter(Boolean),
    captain: {
      name: v.card.captain || (cap ? `${cap.firstName} ${cap.lastName}` : ''),
      grade: v.card.grade || cap?.grade || '',
      patent: v.card.patent || cap?.patent || '',
      phone: v.card.phone || cap?.phone || '',
      email: v.card.email || cap?.email || '',
    },
    embarkDate: v.embarkDate || days[0],
    disembarkDate: v.disembarkDate || days[days.length - 1],
  };
}

type Img = { data: string; w: number; h: number };
type Assets = { logo?: string; vlogo?: Img; map?: string; photo?: string; sig?: Img };

/** rysuje jedną opinię; zwraca true, gdy treść zmieściła się nad przypisami */
function drawOpinion(doc: jsPDF, v: Voyage, m: CrewMember, f: ReturnType<typeof voyageFacts>, a: Assets, s: number): boolean {
  const lang: OpinionLang = v.opinion?.lang ?? 'pl';
  const { L, V } = i18n(lang);
  const M = 13;
  const PW = 210;
  const W = PW - 2 * M;
  const fem = m.form === 'f';
  const set = (size: number, bold = false, color: [number, number, number] = INK) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal');
    doc.setFontSize(size * s);
    doc.setTextColor(...color);
  };
  const lh = (size: number) => size * s * PT * 1.32;

  /* przypisy PZŻ na dole strony – liczone najpierw, żeby wiedzieć, ile miejsca zostaje */
  const voyageNo = v.opinion?.voyageNo?.trim();
  const notes = [
    voyageNo ? L('* jeżeli był prowadzony', '* if concerns') : '',
    L(
      '** wymagane na podstawie § 4 pkt 3 Rozporządzenia Ministra Sportu i Turystyki z dnia 9 kwietnia 2013 r. w sprawie uprawiania turystyki wodnej',
      '** required pursuant to § 4 point 3 of the Regulation of the Minister of Sport and Tourism of April 9, 2013 on water tourism',
    ),
  ].filter(Boolean);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(6.5);
  const noteLines = notes.flatMap((n) => doc.splitTextToSize(t(n), W) as string[]);
  const noteH = noteLines.length * 6.5 * PT * 1.25;
  const limit = 288 - noteH - 3;

  /* prawa kolumna: trasa i zdjęcie załogi */
  const RX = 115;
  const RW = PW - M - RX;
  const hasRight = !!(a.map || a.photo);

  /* nagłówek: logo AKŻ, klub, logo rejsu */
  if (a.logo) doc.addImage(a.logo, 'PNG', M, 9, 18, 18.6);
  const clubX = a.logo ? M + 21 : M;
  let vlogoX = PW - M;
  if (a.vlogo) {
    const box = 23;
    const k = Math.min(box / a.vlogo.w, box / a.vlogo.h);
    const w = a.vlogo.w * k;
    const h = a.vlogo.h * k;
    vlogoX = (hasRight ? RX - 4 : PW - M) - w;
    doc.addImage(a.vlogo.data, a.vlogo.data.startsWith('data:image/png') ? 'PNG' : 'JPEG', vlogoX, 9 + (box - h) / 2, w, h);
  }
  const clubW = (a.vlogo ? vlogoX - 2 : hasRight ? RX - 4 : PW - M) - clubX;
  const clubLines = (v.opinion?.clubHeader || DEFAULT_CLUB_HEADER).split('\n').map((l) => t(l)).filter(Boolean);
  // mniejsza czcionka zamiast łamania nazwy klubu (do 7,5 pt), dopiero potem zawijanie
  let clubSize = 9.5;
  set(clubSize, false, INK);
  while (clubSize > 7.5 && Math.max(0, ...clubLines.map((l) => doc.getTextWidth(l))) > clubW) {
    clubSize -= 0.25;
    set(clubSize, false, INK);
  }
  const club = clubLines.flatMap((l) => doc.splitTextToSize(l, clubW) as string[]).slice(0, 5);
  const clubLh = clubSize * s * PT * 1.3;
  club.forEach((l, i) => doc.text(l, clubX, 13.5 + i * clubLh));

  let ry = 10;
  const box = (img: string, h: number) => {
    doc.addImage(img, 'JPEG', RX, ry, RW, h);
    doc.setDrawColor(220, 210, 216);
    doc.setLineWidth(0.3);
    doc.rect(RX, ry, RW, h);
    ry += h + 3;
  };
  const order = v.opinion?.imageOrder === 'photo' ? (['photo', 'map'] as const) : (['map', 'photo'] as const);
  for (const k of order) {
    if (k === 'map' && a.map) box(a.map, RW / 1.46);
    if (k === 'photo' && a.photo) box(a.photo, RW / 1.5);
  }
  const rightBottom = hasRight ? ry : 0;
  let colW = hasRight ? RX - M - 5 : W;

  /* tytuł (dopasowany do szerokości kolumny) */
  let y = Math.max(38, 13.5 + club.length * clubLh + 9);
  const fitTitle = (text: string, size: number, color: [number, number, number]) => {
    let sz = size;
    set(sz, true, color);
    while (sz > 10 && doc.getTextWidth(text) > colW) set((sz -= 0.5), true, color);
    doc.text(text, M, y);
    return sz;
  };
  if (lang === 'plen') {
    fitTitle('OPINIA Z REJSU', 21, NAVY);
    y += 6.5 * s;
    fitTitle("CREW MEMBER'S CERTIFICATE OF PASSAGE", 11, MUTED);
  } else {
    fitTitle(lang === 'en' ? "CREW MEMBER'S CERTIFICATE OF PASSAGE" : 'OPINIA Z REJSU', 21, NAVY);
  }
  doc.setDrawColor(...BLUSH);
  doc.setLineWidth(1.2);
  doc.line(M, y + 2.5, M + 70, y + 2.5);
  y += 10;

  const widen = () => {
    if (hasRight && y > rightBottom) colW = W;
  };
  const section = (title: string) => {
    widen();
    set(10, true, NAVY);
    const lines = doc.splitTextToSize(t(title).toUpperCase(), colW) as string[];
    doc.text(lines, M, y);
    y += lh(10) * (lines.length - 1) + 1.4;
    doc.setDrawColor(...BLUSH);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + Math.min(colW, 60), y);
    y += lh(10) * 0.95;
  };
  /** „Etykieta: wartość” – w jednej linii, a gdy się nie mieści: etykieta nad zawijaną wartością */
  const field = (label: string, value?: string) => {
    widen();
    const val = t(value) || '—';
    set(9.5, false, MUTED);
    const lab = `${t(label)}: `;
    const lw = doc.getTextWidth(lab);
    set(9.5, true, INK);
    const vw = doc.getTextWidth(val);
    if (lw + vw <= colW) {
      set(9.5, false, MUTED);
      doc.text(lab, M, y);
      set(9.5, true, INK);
      doc.text(val, M + lw, y);
      y += lh(9.5);
      return;
    }
    set(9.5, false, MUTED);
    const labLines = doc.splitTextToSize(lab, colW) as string[];
    doc.text(labLines, M, y);
    y += lh(9.5) * labLines.length;
    set(9.5, true, INK);
    const lines = doc.splitTextToSize(val, colW) as string[];
    doc.text(lines, M, y);
    y += lh(9.5) * lines.length;
  };
  const gap = (mm = 3) => (y += mm * s);
  const yesNo = (b?: boolean) => V(b ? 'Tak' : 'Nie');
  const partPl = fem ? 'Uczestniczyła w rejsie' : 'Uczestniczył w rejsie';

  /* uczestnik rejsu */
  section(L('Informacje o uczestniku rejsu', 'Cruise participant'));
  set(11, true, INK);
  const who = [`${lang === 'en' ? '' : 'Kol. '}${m.firstName} ${m.lastName}`.trim(), V(m.grade), m.patent && `${L('nr pat.', 'cert. no.')} ${m.patent}`]
    .map((x) => t(x || ''))
    .filter(Boolean)
    .join(', ');
  const whoLines = doc.splitTextToSize(who, colW) as string[];
  doc.text(whoLines, M, y);
  y += lh(11) * whoLines.length;
  if (m.phone || m.email) field([m.phone && L('Tel.', 'Phone'), m.email && 'E-mail'].filter(Boolean).join(' / '), [m.phone, m.email].filter(Boolean).join(' / '));
  const series = v.opinion?.series?.trim();
  field(series ? L(`${partPl} z cyklu`, 'Took part in the cruise series') : L(partPl, 'Took part in the cruise'), series || v.name);
  field(L('Pełniona funkcja', 'Rank on board'), V(m.role));
  field(L(`Z obowiązków ${fem ? 'wywiązywała' : 'wywiązywał'} się`, 'Performance of duties'), V(m.duties));
  field(L('Chorobie morskiej', 'Seasickness'), V(m.seasick));
  field(L('Odporność w trudnych warunkach', 'Resilience in hard conditions'), V(m.resilience));
  field(L('Nadaje się do szkolenia na stopień', 'Suitable for training towards'), V(m.trainingFor));
  if (m.opinionNotes?.trim()) field(L('Uwagi kapitana', "Captain's comments"), m.opinionNotes);
  gap();

  /* jacht */
  const y_ = v.yacht;
  section(L('Informacje o jachcie żaglowym', 'Sailing yacht'));
  field(L('Nazwa jachtu', 'Name'), [v.yachtName, y_.regNo && `${L('nr rej.', 'reg. no.')} ${y_.regNo}`].filter(Boolean).join(', '));
  field(L('Typ konstrukcyjny jachtu', 'Type of the yacht design'), [y_.maker, y_.rig && V(y_.rig.charAt(0) + y_.rig.slice(1).toLowerCase())].filter(Boolean).join(', '));
  if (v.homePort) field(L('Port macierzysty', 'Home port'), v.homePort);
  const hull = y_.hullLength || y_.loa;
  field(
    L('Długość kadłuba (Lh)', 'Length of hull (Lh)'),
    [hull && `${hull.replace('.', ',')} m`, y_.enginePower && `${L('moc silnika', 'engine power')} ${y_.enginePower.replace('.', ',')} kW`].filter(Boolean).join(', '),
  );
  field(L('Powierzchnia ożaglowania', 'Sail area'), f.sailArea ? `${f.sailArea} m²` : '');
  gap();

  /* rejs */
  section(L('Informacje o rejsie', 'Cruise information'));
  if (voyageNo) field(L('Na podstawie dziennika jachtowego*, nr pływania', 'Based on Vessel Log Book*, voyage no'), voyageNo);
  const tidal = L('port pływowy ≥ 1,5 m', 'tidal port ≥ 1.5 m');
  field(L('Port zaokrętowania', 'Port of embarkation'), [v.embarkPort, dot(f.embarkDate), `${tidal}: ${yesNo(v.opinion?.embarkTidal)}`].filter(Boolean).join(', '));
  field(L('Port wyokrętowania', 'Port of disembarkation'), [v.disembarkPort, dot(f.disembarkDate), `${tidal}: ${yesNo(v.opinion?.disembarkTidal)}`].filter(Boolean).join(', '));
  field(L('Odwiedzone porty', 'Visited ports'), f.ports.join(', '));
  if (f.tidalPorts.length) field(L('W tym porty pływowe (skok ≥ 1,5 m)', 'Including tidal ports (range ≥ 1.5 m)'), f.tidalPorts.join(', '));
  gap(4);

  /* od tego miejsca zawsze cała szerokość */
  y = Math.max(y, rightBottom + 3);
  colW = W;

  /* zestawienie – kafelki jak w tabeli PZŻ */
  section(L('Zestawienie rejsu', 'Cruise summary'));
  const tot = f.total;
  const tiles: [string, string, string][] = [
    [`${c(tot.sail)} h`, 'Pod żaglami', 'Under sails'],
    [`${c(tot.engine)} h`, 'Na silniku', 'Using engine'],
    [`${c(tot.total)} h`, 'Razem żeglugi', 'Total underway'],
    [`${c(tot.tidal)} h`, 'Po wodach pływowych', 'On tidal waters'],
    [`${c(tot.port)} h`, 'Postój (porty, kotwica)', 'Mooring hours'],
    [`${c(tot.above6)} h`, 'Powyżej 6°B', 'Above 6°B'],
    [String(f.ports.length), 'Porty odwiedzone', 'Ports visited'],
    [String(f.tidalCount), 'W tym pływowe', 'Tidal ports'],
    [`${c(tot.miles)} Mm`, 'Przebyto mil morskich', 'Nautical miles'],
    [String(tot.days), 'Dni rejsu', 'Cruise days'],
  ];
  const per = 5;
  const tw = (W - (per - 1) * 2.5) / per;
  const two = lang === 'plen';
  const th = (two ? 16.5 : 13.5) * s;
  tiles.forEach(([val, pl, en], i) => {
    const x = M + (i % per) * (tw + 2.5);
    const ty = y + Math.floor(i / per) * (th + 2.5);
    doc.setFillColor(...BLUSH);
    doc.roundedRect(x, ty - 3, tw, th, 1.8, 1.8, 'F');
    set(12.5, true, NAVY);
    doc.text(t(val), x + tw / 2, ty + 3.2 * s, { align: 'center' });
    set(7, false, MUTED);
    const labels = lang === 'pl' ? [pl] : lang === 'en' ? [en] : [pl, en];
    labels.forEach((l, j) => doc.text(t(l), x + tw / 2, ty + (7.6 + j * 3.1) * s, { align: 'center', maxWidth: tw - 2 }));
  });
  y += 2 * th + 2.5 + 3;

  /* opinia kapitana (PZŻ) */
  widen();
  set(10, true, NAVY);
  const verdictLabel = `${t(L('Opinia kapitana', "Captain's opinion")).toUpperCase()}**`;
  doc.text(verdictLabel, M, y);
  let vx = M + doc.getTextWidth(verdictLabel) + 5;
  const check = (label: string, on: boolean) => {
    const bs = 3.4 * s;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.rect(vx, y - bs + 0.4, bs, bs);
    if (on) {
      doc.setLineWidth(0.5);
      doc.line(vx + 0.6, y - bs + 1, vx + bs - 0.6, y - 0.2);
      doc.line(vx + bs - 0.6, y - bs + 1, vx + 0.6, y - 0.2);
    }
    set(9.5, on, INK);
    doc.text(t(label), vx + bs + 1.5, y);
    vx += bs + 1.5 + doc.getTextWidth(t(label)) + 6;
  };
  check(L('pozytywna', 'positive'), m.verdict === 'positive');
  check(L('negatywna', 'negative'), m.verdict === 'negative');
  y += lh(10) + 3 * s;

  /* skład załogi */
  section(L('Skład załogi', 'Crew'));
  set(9.5, true, INK);
  const crew = doc.splitTextToSize(t(f.crewNames.join(', ')) || '—', W) as string[];
  doc.text(crew, M, y);
  y += lh(9.5) * crew.length + 3 * s;

  /* uwagi kapitana o rejsie */
  if (v.opinion?.remarks?.trim()) {
    section(L('Uwagi kapitana o przebiegu rejsu', "Captain's comments on the cruise"));
    set(9.5, false, INK);
    const rem = doc.splitTextToSize(t(v.opinion.remarks), W) as string[];
    doc.text(rem, M, y);
    y += lh(9.5) * rem.length + 3 * s;
  }

  /* kapitan + podpis */
  section(L('Informacje o kapitanie', 'Captain'));
  set(9.5, true, INK);
  const cp = f.captain;
  const cap = [
    cp.name,
    V(cp.grade),
    cp.patent && `${L('nr pat.', 'cert. no.')} ${cp.patent}`,
    cp.phone && `${L('tel.', 'phone')} ${cp.phone}`,
    cp.email && `e-mail: ${cp.email}`,
  ]
    .map((x) => t(x || ''))
    .filter(Boolean)
    .join(', ');
  const capLines = doc.splitTextToSize(cap || '—', W) as string[];
  doc.text(capLines, M, y);
  y += lh(9.5) * capLines.length + 2;

  const sigW = 62;
  const sigH = 18 * s;
  const sx = PW - M - sigW;
  const place = [v.opinion?.place?.trim(), dot(v.opinion?.issueDate || dateKey())].filter(Boolean).join(', ');
  set(8.5, false, MUTED);
  doc.text(t(`${L('Miejscowość, data', 'Place and date')}:`), M, y + 1);
  set(9.5, true, INK);
  doc.text(t(place), M, y + 1 + lh(9.5));
  set(8.5, false, MUTED);
  doc.text(t(`${L('Czytelny podpis kapitana', "Captain's legible signature")}:`), sx, y + 1);
  if (a.sig) {
    const fb = fitBox(a.sig.w, a.sig.h, sigW, sigH - 1);
    doc.addImage(a.sig.data, 'JPEG', sx, y + 2 + (sigH - 1 - fb.h), fb.w, fb.h);
  }
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(sx, y + 2 + sigH, sx + sigW, y + 2 + sigH);
  y += 2 + sigH;

  /* przypisy + stopka */
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(noteLines, M, 288 - noteH + 6.5 * PT);
  doc.setFontSize(7);
  doc.text(t(`${v.yachtName ? `s/y ${v.yachtName} · ` : ''}${v.name}`), M, 292);
  return y <= limit;
}

export type OpinionImages = { photo?: string; route?: string; vlogo?: string };

export async function buildOpinionsPdf(v: Voyage, members: CrewMember[], track: Fix[], imgs: OpinionImages, onStep?: (s: string) => void) {
  onStep?.('Wczytuję czcionki…');
  const { doc } = await newPdfDoc();
  const mode = v.opinion?.routeMode ?? 'track';
  onStep?.(mode === 'track' || mode === 'drawn' ? 'Rysuję mapę trasy…' : 'Przygotowuję obrazy…');
  const route =
    mode === 'image' && imgs.route
      ? containToRatio(imgs.route, 1.46).catch(() => undefined)
      : mode === 'track'
        ? renderTrackImage(v, track, 876, 600, undefined, false).then((r) => r?.dataUrl).catch(() => undefined)
        : mode === 'drawn' && (v.opinion?.drawnRoute?.length ?? 0) > 1
          ? renderTrackImage(v, [], 876, 600, v.opinion!.drawnRoute, false).then((r) => r?.dataUrl).catch(() => undefined)
          : Promise.resolve(undefined);
  const [logo, map, photo, vlogoSize] = await Promise.all([
    v.opinion?.akzLogo === false ? Promise.resolve(undefined) : toDataUrl(logoUrl).catch(() => undefined),
    route,
    imgs.photo ? cropToRatio(imgs.photo, 1.5).catch(() => undefined) : Promise.resolve(undefined),
    imgs.vlogo ? imageSize(imgs.vlogo).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const sig = await signatureForPdf(v.opinion?.signature?.image);
  const assets: Assets = { logo, map, photo, sig, vlogo: imgs.vlogo && vlogoSize ? { data: imgs.vlogo, ...vlogoSize } : undefined };
  const facts = voyageFacts(v);
  onStep?.('Składam opinie…');
  for (const m of members) {
    // największa czcionka, przy której opinia mieści się na jednej stronie
    for (let s = 1.2; s >= 0.55; s -= 0.05) {
      doc.addPage();
      const fits = drawOpinion(doc, v, m, facts, assets, s);
      if (fits || s - 0.05 < 0.55) break;
      doc.deletePage(doc.getNumberOfPages());
    }
  }
  doc.deletePage(1); // pusta strona startowa jsPDF
  return doc.output('blob');
}

export const opinionFileName = (v: Voyage, m?: CrewMember) => {
  const word = v.opinion?.lang === 'en' ? 'Certificate' : 'Opinia';
  return `${word}-${m ? `${m.firstName}_${m.lastName}` : 'zaloga'}-${v.yachtName || v.name || 'rejs'}.pdf`.replace(/[^\p{L}\p{N}._-]+/gu, '_');
};
