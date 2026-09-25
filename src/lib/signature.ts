/** kolor „tuszu” podpisu – zawsze granatowy, niezależnie od motywu aplikacji */
export const SIGNATURE_INK = '#1f2b6e';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Nie udało się wczytać podpisu'));
    img.src = src;
  });
}

/**
 * Przygotowuje podpis do PDF: przekolorowuje kreski na granat (także podpisy złożone
 * wcześniej jasnym tuszem w ciemnym motywie), przycina do samego podpisu i zapisuje
 * jako JPEG na białym tle – bez przezroczystości, którą jsPDF na Safari obsługuje zawodnie.
 */
export async function signatureForPdf(dataUrl?: string): Promise<{ data: string; w: number; h: number } | undefined> {
  if (!dataUrl) return undefined;
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    // obszar kresek (piksele nieprzezroczyste i niebiałe)
    const px = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const ink = px[i + 3] > 40 && px[i] + px[i + 1] + px[i + 2] < 3 * 250;
        if (ink) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return undefined; // pusty podpis
    // kreski na granat
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = SIGNATURE_INK;
    ctx.fillRect(0, 0, w, h);
    const pad = Math.round(Math.max(w, h) * 0.02);
    const cw = Math.min(w, x1 - x0 + 1 + 2 * pad);
    const ch = Math.min(h, y1 - y0 + 1 + 2 * pad);
    const out = document.createElement('canvas');
    const k = Math.min(1, 900 / cw);
    out.width = Math.max(1, Math.round(cw * k));
    out.height = Math.max(1, Math.round(ch * k));
    const o = out.getContext('2d')!;
    o.fillStyle = '#ffffff';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), cw, ch, 0, 0, out.width, out.height);
    return { data: out.toDataURL('image/jpeg', 0.92), w: out.width, h: out.height };
  } catch {
    return undefined;
  }
}

/** wpasowuje obraz w ramkę z zachowaniem proporcji (wyrównanie do lewej i dołu) */
export function fitBox(w: number, h: number, bw: number, bh: number) {
  const k = Math.min(bw / w, bh / h);
  return { w: w * k, h: h * k };
}
