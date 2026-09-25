import { useEffect, useRef, useState } from 'react';
import { renderPdfPages } from '../lib/pdfPreview';
import { FileActions } from './FileActions';
import { Sheet } from './ui';

/** podgląd gotowego PDF (strony jako obrazy) z przyciskami Udostępnij / Zapisz */
export function PdfPreview(props: { file: File; title: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPages(undefined);
    setError(undefined);
    const width = Math.min(820, (box.current?.clientWidth ?? 700) - 4);
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('przekroczono czas')), 25_000));
    Promise.race([renderPdfPages(props.file, Math.max(300, width)), timeout])
      .then((p) => !cancelled && setPages(p))
      .catch((e) => !cancelled && setError((e as Error).message || 'Nie udało się wyświetlić podglądu'));
    return () => {
      cancelled = true;
    };
  }, [props.file, attempt]);

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={props.title}
      footer={
        <div className="row gap wrap preview-actions">
          <FileActions file={props.file} />
          <button className="btn ghost" onClick={props.onClose}>
            Zamknij
          </button>
        </div>
      }
    >
      <div ref={box} className="pdf-preview">
        {error ? (
          <div className="preview-loading column">
            <p className="muted">Podgląd niedostępny ({error}). Plik jest gotowy – możesz go udostępnić albo zapisać.</p>
            <button className="btn small" onClick={() => setAttempt((a) => a + 1)}>
              ↻ Spróbuj ponownie
            </button>
          </div>
        ) : !pages ? (
          <div className="preview-loading">
            <span className="spinner" /> Przygotowuję podgląd…
          </div>
        ) : (
          pages.map((src, i) => (
            <figure key={i} className="preview-page">
              <img src={src} alt={`Strona ${i + 1}`} />
              {pages.length > 1 && (
                <figcaption>
                  Strona {i + 1} z {pages.length}
                </figcaption>
              )}
            </figure>
          ))
        )}
      </div>
    </Sheet>
  );
}
