/**
 * Podgląd PDF jako obrazy stron (pdf.js, wersja „legacy” – działa też na starszych iOS).
 * Ładowany dopiero przy pierwszym podglądzie.
 */
export async function renderPdfPages(file: Blob, cssWidth: number): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const out: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth * dpr) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // intent „print”: renderowanie bez requestAnimationFrame – w trybie „display” pdf.js czeka na
      // klatki animacji, które przeglądarka wstrzymuje, gdy uzna kartę za niewidoczną (podgląd „wisiał”)
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport, intent: 'print' }).promise;
      out.push(canvas.toDataURL('image/jpeg', 0.9));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}
