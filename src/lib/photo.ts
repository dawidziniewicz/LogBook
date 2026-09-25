import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

/** zdjęcie załogi – trzymane osobno w IndexedDB (duże), jako JPEG data URL */
const key = (voyageId: string) => `photo:${voyageId}`;
export const loadPhoto = (voyageId: string) => idbGet<string>(key(voyageId));
export const savePhoto = (voyageId: string, dataUrl: string) => idbSet(key(voyageId), dataUrl);
export const deletePhoto = (voyageId: string) => idbDel(key(voyageId));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Nie udało się wczytać zdjęcia'));
    img.src = src;
  });
}

/** zmniejsza zdjęcie z aparatu/galerii do rozsądnego rozmiaru */
export async function resizePhoto(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** kadruje zdjęcie do proporcji ramki (wypełnienie, jak object-fit: cover) */
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
