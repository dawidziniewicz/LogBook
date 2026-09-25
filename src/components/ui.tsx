import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SIGNATURE_INK } from '../lib/signature';

export function Field(props: {
  label: ReactNode;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  hint?: ReactNode;
  auto?: boolean;
  /** podpowiedzi rozwijane pod polem (działają też na iOS, w odróżnieniu od <datalist>) */
  suggestions?: string[];
  wide?: boolean;
  after?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const value = props.value ?? '';
  const q = value.trim().toLowerCase();
  const exact = props.suggestions?.some((o) => o.toLowerCase() === q);
  // pełna lista, gdy pole puste albo zawiera już jedną z podpowiedzi; w innym razie – pasujące
  const shown = (props.suggestions ?? []).filter((o) => !q || exact || o.toLowerCase().includes(q));
  return (
    <label className={`field${props.wide ? ' wide' : ''}${props.auto ? ' is-auto' : ''}`}>
      <span className="field-label">
        {props.label}
        {props.auto && <span className="auto-tag" title="Wypełnione automatycznie – sprawdź">auto</span>}
      </span>
      <span className="field-row suggest-row">
        <input
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          value={value}
          placeholder={props.placeholder}
          autoComplete={props.suggestions ? 'off' : undefined}
          onChange={(e) => {
            props.onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => props.suggestions && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        />
        {props.after}
        {open && shown.length > 0 && (
          <span className="suggest-list" role="listbox">
            {shown.map((o) => (
              <button
                type="button"
                role="option"
                aria-selected={o.toLowerCase() === q}
                key={o}
                className={`suggest-item${o.toLowerCase() === q ? ' on' : ''}`}
                // mousedown/pointerdown przed blur – wybór nie gubi się przy zamykaniu listy
                onPointerDown={(e) => {
                  e.preventDefault();
                  props.onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            ))}
          </span>
        )}
      </span>
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Area(props: { label: ReactNode; value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="field wide">
      <span className="field-label">{props.label}</span>
      <textarea rows={props.rows ?? 3} value={props.value ?? ''} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

export function Card(props: { title?: ReactNode; no?: string | number; children: ReactNode; actions?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${props.className ?? ''}`} id={props.id}>
      {(props.title || props.actions) && (
        <header className="card-head">
          <h2>
            {props.no !== undefined && <span className="no">{props.no}</span>}
            {props.title}
          </h2>
          {props.actions && <div className="card-actions">{props.actions}</div>}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Chips<T extends string>(props: {
  options: { v: T; label?: ReactNode; title?: string }[];
  value: T | T[] | undefined;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  const sel = Array.isArray(props.value) ? props.value : props.value !== undefined ? [props.value] : [];
  return (
    <div className={`chips${props.small ? ' small' : ''}`}>
      {props.options.map((o) => (
        <button
          type="button"
          key={o.v}
          title={o.title}
          className={`chip${sel.includes(o.v) ? ' on' : ''}`}
          onClick={() => props.onChange(o.v)}
        >
          {o.label ?? o.v}
        </button>
      ))}
    </div>
  );
}

export function Sheet(props: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{props.title}</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="Zamknij">
            ✕
          </button>
        </header>
        <div className="sheet-body">{props.children}</div>
        {props.footer && <footer className="sheet-foot">{props.footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- toasty ---------- */
type Toast = { id: number; text: string; kind: 'ok' | 'err' | 'info' };
const toastListeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];
export function toast(text: string, kind: Toast['kind'] = 'ok', ms = 3500) {
  const t = { id: Date.now() + Math.random(), text, kind };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, ms);
}
export function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    toastListeners.add(setList);
    return () => void toastListeners.delete(setList);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** przycisk z obsługą stanu „w toku” dla akcji asynchronicznych */
export function AsyncButton(props: {
  onClick: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  busyText?: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title={props.title}
      className={`${props.className ?? 'btn'}${busy ? ' busy' : ''}`}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await props.onClick();
        } catch (e) {
          toast((e as Error).message || 'Błąd', 'err', 5000);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (props.busyText ?? <span className="spinner" />) : props.children}
    </button>
  );
}

export function SignaturePad(props: { label: ReactNode; value?: { name?: string; image?: string; at?: number }; onChange: (v: { name?: string; image?: string; at?: number }) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [editing, setEditing] = useState(false);
  const drawing = useRef(false);
  const v = props.value ?? {};

  useEffect(() => {
    if (!editing) return;
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = SIGNATURE_INK;
  }, [editing]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="sig">
      <div className="sig-top">
        <span className="field-label">{props.label}</span>
        <input className="sig-name" placeholder="Imię i nazwisko" value={v.name ?? ''} onChange={(e) => props.onChange({ ...v, name: e.target.value })} />
      </div>
      {editing ? (
        <>
          <canvas
            ref={ref}
            className="sig-canvas"
            onPointerDown={(e) => {
              drawing.current = true;
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
              const ctx = ref.current!.getContext('2d')!;
              ctx.beginPath();
              ctx.moveTo(...pos(e));
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = ref.current!.getContext('2d')!;
              ctx.lineTo(...pos(e));
              ctx.stroke();
            }}
            onPointerUp={() => (drawing.current = false)}
          />
          <div className="row gap">
            <button className="btn ghost" onClick={() => setEditing(false)}>
              Anuluj
            </button>
            <button
              className="btn"
              onClick={() => {
                props.onChange({ ...v, image: ref.current!.toDataURL('image/png'), at: Date.now() });
                setEditing(false);
              }}
            >
              Zatwierdź podpis
            </button>
          </div>
        </>
      ) : v.image ? (
        <div className="sig-view">
          <div className="sig-paper">
            <img src={v.image} alt="podpis" />
          </div>
          <div className="sig-meta">
            {v.at && new Date(v.at).toLocaleString('pl-PL')}
            <button className="link" onClick={() => props.onChange({ name: v.name })}>
              usuń
            </button>
          </div>
        </div>
      ) : (
        <button className="btn ghost sig-empty" onClick={() => setEditing(true)}>
          ✍️ Podpisz
        </button>
      )}
    </div>
  );
}

export function Stat(props: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-v">{props.value}</div>
      <div className="stat-l">{props.label}</div>
      {props.sub && <div className="stat-s">{props.sub}</div>}
    </div>
  );
}
