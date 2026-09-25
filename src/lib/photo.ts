import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

/**
 * Obrazy rejsu trzymane osobno w IndexedDB (duże): zdjęcie załogi, własne zdjęcie trasy, logo rejsu.
 * Zapisywane jako data URL.
 */
export type AssetKind = 'photo' | 'route' | 'vlogo';
export const ASSET_KINDS: AssetKind[] = ['photo', 'route', 'vlogo'];
const key = (kind: AssetKind, voyageId: string) => `${kind}:${voyageId}`;
export const loadAsset = (kind: AssetKind, voyageId: string) => idbGet<string>(key(kind, voyageId));
export const saveAsset = (kind: AssetKind, voyageId: string, dataUrl: string) => idbSet(key(kind, voyageId), dataUrl);
export const deleteAsset = (kind: AssetKind, voyageId: string) => idbDel(key(kind, voyageId));
export const loadPhoto = (voyageId: string) => loadAsset('photo', voyageId);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Nie udało się wczytać obrazu'));
    img.src = src;
  });
}

/** zmniejsza obraz z aparatu/galerii; PNG zachowuje przezroczystość (logo) */
export async function resizeImage(file: File, max = 1600, type: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(type, 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** kadruje obraz do proporcji ramki (wypełnienie, jak object-fit: cover) */
export async function cropToRatio(dataUrl: string, ratio: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  let sw = w, sh = h;
  if (w / h > ratio) sw = h * ratio;
  else sh = w / ratio;
  const c = document.createElement('canvas');
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext('2d')!.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}

/** wpasowuje cały obraz w ramkę (jak object-fit: contain) – nic nie zostaje ucięte */
export async function containToRatio(dataUrl: string, ratio: number, bg = '#ffffff'): Promise<string> {
  const img = await loadImage(dataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  const cw = Math.max(w, h * ratio);
  const ch = cw / ratio;
  const c = document.createElement('canvas');
  c.width = Math.round(cw);
  c.height = Math.round(ch);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2);
  return c.toDataURL('image/jpeg', 0.88);
}

/** wymiary obrazu (do zachowania proporcji w PDF) */
export async function imageSize(dataUrl: string) {
  const img = await loadImage(dataUrl);
  return { w: img.naturalWidth, h: img.naturalHeight };
}
