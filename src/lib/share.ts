type SavePicker = (opts: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iP(hone|ad|od)/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || /Android/i.test(ua);
const isStandalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

/** czy urządzenie potrafi udostępnić plik (Web Share z plikami) */
export function canShareFiles() {
  try {
    const probe = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

/** systemowe okno „Udostępnij” (AirDrop, Mail, komunikatory, drukowanie…) */
export async function shareFile(file: File): Promise<'shared' | 'cancelled'> {
  if (!canShareFiles()) throw new Error('To urządzenie lub przeglądarka nie obsługuje udostępniania plików – użyj „Zapisz”');
  try {
    await navigator.share({ files: [file], title: file.name });
    return 'shared';
  } catch (e) {
    if (isAbort(e)) return 'cancelled';
    throw new Error('Nie udało się udostępnić pliku');
  }
}

/**
 * Zapis pliku na dysku:
 * - komputer (Chrome/Edge): okno „Zapisz jako” z wyborem folderu,
 * - iPhone/iPad w aplikacji z ekranu głównego: arkusz z opcją „Zachowaj w Plikach” (iOS nie pozwala tam pobierać),
 * - pozostałe (Safari, Firefox, Android): pobranie do folderu Pobrane.
 */
export async function saveFile(file: File): Promise<'saved' | 'downloaded' | 'files-sheet' | 'cancelled'> {
  const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker && !isMobile) {
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const handle = await picker({
        suggestedName: file.name,
        types: [{ description: file.type === 'application/pdf' ? 'Dokument PDF' : 'Plik', accept: { [file.type || 'application/octet-stream']: ext ? [ext] : [] } }],
      });
      const w = await handle.createWritable();
      await w.write(file);
      await w.close();
      return 'saved';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // np. brak uprawnień – spróbuj zwykłego pobrania
    }
  }
  if (isIOS && isStandalone() && canShareFiles()) {
    try {
      await navigator.share({ files: [file] });
      return 'files-sheet';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

/** czy „Zapisz” na tym urządzeniu otworzy arkusz iOS zamiast pobrania */
export const saveUsesShareSheet = () => isIOS && isStandalone() && canShareFiles();
