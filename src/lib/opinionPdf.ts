import type { jsPDF } from 'jspdf';
import type { CrewMember, Voyage } from '../types';
import { DEFAULT_CLUB_HEADER } from '../data/opinion';
import { allTallies, num, sortedDays } from './compute';
import type { Fix } from './geo';
import { newPdfDoc, pdfText as t, renderTrackImage } from './pdf';
import { cropToRatio } from './photo';
import logoUrl from '../assets/akz-logo.png';

const NAVY: [number, number, number] = [31, 43, 110];
const INK: [number, number, number] = [23, 27, 63];
const MUTED: [number, number, number] = [98, 103, 140];
const BLUSH: [number, number, number] = [251, 234, 235];
const PT = 0.3528; // mm na punkt

const dot = (d?: string) => (d ? d.split('-').reverse().join('.') : '');
const c = (n: number) => String(n).replace('.', ',');

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

export const captainOf = (v: Voyage) => v.crew.find((m) => /kapitan/i.test(m.role));

/** dane wspólne dla wszystkich opinii z rejsu */
function voyageFacts(v: Voyage) {
  const days = sortedDays(v);
  const tallies = allTallies(v);
  const total = days.length ? tallies[days[days.length - 1]].total : undefined;
  const ports = [...new Set(days.flatMap((d) => [v.days[d].portOut, v.days[d].portStay, v.days[d].portIn]).flatMap((p) => (p ? p.split(',') : [])).map((p) => p.trim()).filter(Boolean))];
  const sailSum = v.sails.reduce((s, x) => s + (isNaN(num(x.area)) ? 0 : num(x.area)), 0);
  const cap = captainOf(v);
  const captain = {
    name: v.card.captain || (cap ? `${cap.firstName} ${cap.lastName}` : ''),
    patent: v.card.patent || cap?.patent || '',
    phone: v.card.phone || cap?.phone || '',
    email: v.card.email || '',
  };
  return {
    total,
    ports,
    sailArea: v.opinion?.sailArea || (sailSum ? c(+sailSum.toFixed(1)) : ''),
    crewNames: v.crew.map((m) => `${m.firstName} ${m.lastName}`.trim()).filter(Boolean),
    captain,
    embarkDate: v.embarkDate || days[0],
    disembarkDate: v.disembarkDate || days[days.length - 1],
  };
}

type Assets = { logo?: string; map?: string; photo?: string };

function drawOpinion(doc: jsPDF, v: Voyage, m: CrewMember, f: ReturnType<typeof voyageFacts>, a: Assets, s: number) {
  const M = 13;
  const PW = 210;
  const W = PW - 2 * M;
  const f_ = m.form === 'f';
  const set = (size: number, bold = false, color: [number, number, number] = INK) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal');
    doc.setFontSize(size * s);
    doc.setTextColor(...color);
  };
  const lh = (size: number) => size * s * PT * 1.32;

  /* nagłówek klubu */
  if (a.logo) doc.addImage(a.logo, 'PNG', M, 10, 17, 17.6);
  set(9.5, false, INK);
  const club = (v.opinion?.clubHeader || DEFAULT_CLUB_HEADER).split('\n').map((l) => t(l)).filter(Boolean);
  club.forEach((l, i) => doc.text(l, M + 20, 14 + i * 4.3));

  /* prawa kolumna: mapa śladu i zdjęcie załogi */
  const RX = 115;
  const RW = PW - M - RX;
  let ry = 10;
  const box = (img: string, h: number) => {
    doc.addImage(img, 'JPEG', RX, ry, RW, h);
    doc.setDrawColor(220, 210, 216);
    doc.setLineWidth(0.3);
    doc.rect(RX, ry, RW, h);
    ry += h + 3;
  };
  if (a.map) box(a.map, RW / 1.46);
  if (a.photo) box(a.photo, RW / 1.5);
  const hasRight = ry > 10;
  const rightBottom = hasRight ? ry : 0;

  /* tytuł */
  let y = 38;
  set(21, true, NAVY);
  doc.text('OPINIA Z REJSU', M, y);
  doc.setDrawColor(...BLUSH);
  doc.setLineWidth(1.2);
  doc.line(M, y + 2.5, M + 70, y + 2.5);
  y += 10;

  let colW = hasRight ? RX - M - 5 : W;
  const widen = () => {
    if (hasRight && y > rightBottom) colW = W;
  };
  const section = (title: string) => {
    widen();
    set(10, true, NAVY);
    doc.text(t(title).toUpperCase(), M, y);
    y += 1.4;
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
    doc.text(lab, M, y);
    y += lh(9.5);
    set(9.5, true, INK);
    const lines = doc.splitTextToSize(val, colW) as string[];
    doc.text(lines, M, y);
    y += lh(9.5) * lines.length;
  };
  const gap = (mm = 3) => (y += mm * s);

  /* załogant */
  section('Informacje o załogancie');
  set(11, true, INK);
  const who = [`Kol. ${m.firstName} ${m.lastName}`.trim(), m.grade, m.patent].map((x) => t(x)).filter(Boolean).join(', ');
  const whoLines = doc.splitTextToSize(who, colW) as string[];
  doc.text(whoLines, M, y);
  y += lh(11) * whoLines.length;
  const series = v.opinion?.series?.trim();
  field(series ? `${f_ ? 'Uczestniczyła' : 'Uczestniczył'} w rejsie z cyklu` : `${f_ ? 'Uczestniczyła' : 'Uczestniczył'} w rejsie`, series || v.name);
  field('Pełniona funkcja', m.role);
  field(`Z obowiązków ${f_ ? 'wywiązywała' : 'wywiązywał'} się`, m.duties);
  field('Chorobie morskiej', m.seasick);
  field('Odporność w trudnych warunkach', m.resilience);
  field('Nadaje się do szkolenia na stopień', m.trainingFor);
  if (m.opinionNotes?.trim()) field('Uwagi kapitana', m.opinionNotes);
  gap();

  /* jacht */
  section('Informacje o jachcie');
  if (v.yacht.rig) field('Typ jachtu', v.yacht.rig.charAt(0) + v.yacht.rig.slice(1).toLowerCase());
  field('Klasa jachtu', v.yacht.maker);
  field('Nazwa jachtu', v.yachtName);
  field('Długość całkowita jachtu', v.yacht.loa ? `${v.yacht.loa.replace('.', ',')} m` : '');
  field('Powierzchnia ożaglowania', f.sailArea ? `${f.sailArea} m²` : '');
  gap();

  /* rejs */
  section('Podstawowe informacje o rejsie');
  field('Zaokrętowano', [v.embarkPort, dot(f.embarkDate)].filter(Boolean).join(', '));
  field('Wyokrętowano', [v.disembarkPort, dot(f.disembarkDate)].filter(Boolean).join(', '));
  field('Odwiedzono porty', f.ports.join(', '));
  gap(4);

  /* od tego miejsca zawsze cała szerokość */
  y = Math.max(y, rightBottom + 3);
  colW = W;

  /* zestawienie godzinowe – kafelki */
  section('Zestawienie godzinowe rejsu');
  const tot = f.total;
  const tiles: [string, string][] = [
    ['Postój', `${tot?.port ?? 0} h`],
    ['Żagle', `${tot?.sail ?? 0} h`],
    ['Silnik', `${tot?.engine ?? 0} h`],
    ['Suma godzin', `${tot?.total ?? 0} h`],
    ['Powyżej 6°B', `${tot?.above6 ?? 0} h`],
    ['Przebyto', `${c(tot?.miles ?? 0)} Mm`],
  ];
  const tw = (W - 5 * 2.5) / 6;
  const th = 14 * s;
  tiles.forEach(([lab, val], i) => {
    const x = M + i * (tw + 2.5);
    doc.setFillColor(...BLUSH);
    doc.roundedRect(x, y - 3, tw, th, 1.8, 1.8, 'F');
    set(12.5, true, NAVY);
    doc.text(t(val), x + tw / 2, y + 3.2 * s, { align: 'center' });
    set(7.5, false, MUTED);
    doc.text(t(lab), x + tw / 2, y + 8 * s, { align: 'center' });
  });
  y += th + 3;

  /* skład załogi */
  section('Skład załogi');
  set(9.5, true, INK);
  const crew = doc.splitTextToSize(t(f.crewNames.join(', ')) || '—', W) as string[];
  doc.text(crew, M, y);
  y += lh(9.5) * crew.length + 3 * s;

  /* uwagi kapitana o rejsie */
  if (v.opinion?.remarks?.trim()) {
    section('Uwagi kapitana o przebiegu rejsu');
    set(9.5, false, INK);
    const rem = doc.splitTextToSize(t(v.opinion.remarks), W) as string[];
    doc.text(rem, M, y);
    y += lh(9.5) * rem.length + 3 * s;
  }

  /* kapitan + podpis */
  section('Kapitan');
  set(9.5, true, INK);
  const cap = [f.captain.name, f.captain.patent, f.captain.phone && `tel. ${f.captain.phone}`, f.captain.email && `e-mail: ${f.captain.email}`].map((x) => t(x || '')).filter(Boolean).join(', ');
  const capLines = doc.splitTextToSize(cap || '—', W) as string[];
  doc.text(capLines, M, y);
  y += lh(9.5) * capLines.length + 2;

  const sigW = 62;
  const sigH = 20 * s;
  const sx = PW - M - sigW;
  set(8.5, false, MUTED);
  doc.text('Podpis kapitana:', sx, y + 1);
  const sig = v.opinion?.signature?.image;
  if (sig) {
    try {
      doc.addImage(sig, 'PNG', sx, y + 2, sigW, sigH, undefined, 'FAST');
    } catch {
      /* uszkodzony podpis */
    }
  }
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(sx, y + 2 + sigH, sx + sigW, y + 2 + sigH);
  y += 2 + sigH;

  /* stopka */
  set(7, false, MUTED);
  doc.text(t(`${v.yachtName ? `s/y ${v.yachtName} · ` : ''}${v.name}`), M, 290);
  return y;
}

export async function buildOpinionsPdf(v: Voyage, members: CrewMember[], track: Fix[], photo: string | undefined, onStep?: (s: string) => void) {
  onStep?.('Wczytuję czcionki…');
  const { doc } = await newPdfDoc();
  onStep?.('Rysuję mapę śladu…');
  const [logo, mapImg, photoImg] = await Promise.all([
    toDataUrl(logoUrl).catch(() => undefined),
    renderTrackImage(v, track, 876, 600).catch(() => undefined),
    photo ? cropToRatio(photo, 1.5).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const assets: Assets = { logo, map: mapImg?.dataUrl, photo: photoImg };
  const facts = voyageFacts(v);
  onStep?.('Składam opinie…');
  for (const m of members) {
    // zmieść na jednej stronie: w razie potrzeby zmniejsz czcionkę
    // największa czcionka, przy której opinia mieści się na jednej stronie
    for (let s = 1.2; s >= 0.6; s -= 0.05) {
      doc.addPage();
      const bottom = drawOpinion(doc, v, m, facts, assets, s);
      if (bottom <= 282 || s - 0.05 < 0.6) break;
      doc.deletePage(doc.getNumberOfPages());
    }
  }
  doc.deletePage(1); // pusta strona startowa jsPDF
  return doc.output('blob');
}

export const opinionFileName = (v: Voyage, m?: CrewMember) =>
  `Opinia-${m ? `${m.firstName}_${m.lastName}` : 'zaloga'}-${v.yachtName || v.name || 'rejs'}.pdf`.replace(/[^\p{L}\p{N}._-]+/gu, '_');
