/** udostępnia plik (iOS/Android: systemowe okno „Udostępnij”), a na komputerze pobiera go */
export async function sharePdf(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // użytkownik zamknął okno udostępniania
    }
  }
  // komputer / brak Web Share – zwykłe pobranie pliku
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
