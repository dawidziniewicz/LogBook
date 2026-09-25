import { useRef, useState } from 'react';
import { useStore } from '../store';
import { HOUR_FIELDS, DEFAULT_REQUIRED } from '../data/reference';
import { beep, nextReminder, requestNotificationPermission, showSystemNotification, unlockAudio } from '../lib/reminders';
import { hhmm, dateKey } from '../lib/time';
import { go } from '../lib/router';
import { Card, toast } from '../components/ui';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Voyage } from '../types';

const MINUTES = [45, 50, 55, 0, 5, 10, 15];
const minuteLabel = (m: number) => (m === 0 ? 'o pełnej godzinie (:00)' : m > 30 ? `${60 - m} min przed pełną (:${m})` : `${m} min po pełnej (:${String(m).padStart(2, '0')})`);

export function SettingsPage() {
  const { settings, setSettings, voyages, activeId, setActive, createVoyage, deleteVoyage, importVoyage } = useStore();
  const active = voyages.find((v) => v.id === activeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customMin, setCustomMin] = useState(!MINUTES.includes(settings.reminders.minute));
  const r = settings.reminders;
  const setR = (fn: (x: typeof r) => void) => setSettings((s) => fn(s.reminders));

  const exportVoyage = async () => {
    if (!active) return;
    const track = (await idbGet(`track:${active.id}`)) ?? [];
    const blob = new Blob([JSON.stringify({ app: 'logbook', version: 1, voyage: active, track }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dziennik-${(active.yachtName || active.name || 'rejs').replace(/\s+/g, '_')}-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="page">
      <Card title="Rejsy" actions={<button className="btn small" onClick={() => { createVoyage(); go('/voyage'); }}>+ Nowy rejs</button>}>
        <ul className="voyages">
          {voyages.map((v) => (
            <li key={v.id} className={v.id === activeId ? 'on' : ''}>
              <button className="voyage-pick" onClick={() => setActive(v.id)}>
                <b>{v.name || v.yachtName || 'Bez nazwy'}</b>
                <small>
                  {v.yachtName && `s/y ${v.yachtName} · `}
                  {Object.keys(v.days).length} dni · od {v.embarkDate}
                </small>
              </button>
              <button
                className="icon-btn danger"
                aria-label="Usuń rejs"
                onClick={() => {
                  if (confirm(`Usunąć rejs „${v.name || v.yachtName || 'bez nazwy'}” wraz ze wszystkimi wpisami? Najpierw zrób kopię zapasową!`)) deleteVoyage(v.id);
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Przypomnienia o wpisie">
        <label className="check">
          <input type="checkbox" checked={r.enabled} onChange={(e) => setR((x) => void (x.enabled = e.target.checked))} /> Przypominaj o uzupełnieniu wpisu godzinowego
        </label>
        <div className="grid">
          <label className="field">
            <span className="field-label">Kiedy przypominać</span>
            {customMin ? (
              <input type="number" min={0} max={59} value={r.minute} onChange={(e) => setR((x) => void (x.minute = Math.max(0, Math.min(59, +e.target.value || 0))))} />
            ) : (
              <select value={r.minute} onChange={(e) => (e.target.value === 'c' ? setCustomMin(true) : setR((x) => void (x.minute = +e.target.value)))}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {minuteLabel(m)}
                  </option>
                ))}
                <option value="c">inna minuta…</option>
              </select>
            )}
            <span className="field-hint">Wiersz dotyczy najbliższej pełnej godziny (np. 13:55 → wiersz 1400).</span>
          </label>
          <label className="field">
            <span className="field-label">W morzu / na kotwicy – co ile godzin</span>
            <select value={r.intervalSea} onChange={(e) => setR((x) => void (x.intervalSea = +e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>co {n} h</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">W porcie – co ile godzin</span>
            <select value={r.intervalPort} onChange={(e) => setR((x) => void (x.intervalPort = +e.target.value))}>
              {[1, 2, 4, 6, 8, 12, 24].map((n) => <option key={n} value={n}>co {n} h</option>)}
            </select>
            <span className="field-hint">Instrukcja: w porcie raz na 4 h.</span>
          </label>
          <label className="field">
            <span className="field-label">Powtarzaj, dopóki wiersz niekompletny</span>
            <select value={r.repeatMin} onChange={(e) => setR((x) => void (x.repeatMin = +e.target.value))}>
              <option value={0}>nie powtarzaj</option>
              {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>co {n} min</option>)}
            </select>
          </label>
        </div>
        <div className="field wide">
          <span className="field-label">Pola wymagane (przypomnienie wymienia brakujące)</span>
          <div className="chips small">
            {HOUR_FIELDS.map((f) => (
              <button
                key={f.key}
                className={`chip${r.required.includes(f.key) ? ' on' : ''}`}
                onClick={() => setR((x) => void (x.required = x.required.includes(f.key) ? x.required.filter((k) => k !== f.key) : [...x.required, f.key]))}
              >
                {f.no}. {f.label}
              </button>
            ))}
            <button className="link" onClick={() => setR((x) => void (x.required = DEFAULT_REQUIRED))}>domyślne</button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={r.sound} onChange={(e) => setR((x) => void (x.sound = e.target.checked))} /> Sygnał dźwiękowy
        </label>
        {active && <p className="muted small">Następne przypomnienie: <b>{hhmm(nextReminder(settings, active.status))}</b></p>}
        <button
          className="btn"
          onClick={async () => {
            unlockAudio();
            const p = await requestNotificationPermission();
            if (r.sound) beep();
            const ok = await showSystemNotification('⏰ Test przypomnienia', 'Tak będzie wyglądać przypomnienie o wpisie.', '/#/');
            toast(ok ? 'Wysłano powiadomienie testowe' : `Powiadomienia systemowe niedostępne (${p}) – przypomnienia pokażą się w aplikacji`, ok ? 'ok' : 'info', 6000);
          }}
        >
          🔔 Testuj powiadomienie
        </button>
        <details className="help">
          <summary>Jak działają przypomnienia?</summary>
          <p>
            Aplikacja webowa wysyła przypomnienia, gdy jest otwarta lub działa w tle. System może uśpić ją po dłuższym czasie w tle – dlatego podczas wachty włącz <b>Tryb wachty</b> na
            ekranie Start (ekran nie gaśnie). Na iPhonie powiadomienia działają tylko po dodaniu aplikacji do ekranu początkowego (Safari → Udostępnij → „Do ekranu początkowego”), iOS 16.4+.
            W wersji ze sklepu (App Store / Google Play) przypomnienia będą planowane przez system i zadziałają zawsze.
          </p>
        </details>
      </Card>

      <Card title="Automatyczne dane">
        <label className="check">
          <input type="checkbox" checked={settings.autoWeather} onChange={(e) => setSettings((s) => void (s.autoWeather = e.target.checked))} />
          Uzupełniaj puste pola pogody z modelu (Open‑Meteo) przy „📍” – wymaga internetu, oznaczane jako „auto”
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.trackAtSea} onChange={(e) => setSettings((s) => void (s.trackAtSea = e.target.checked))} />
          Zapisuj ślad GPS w morzu (dokładniejsza prędkość i log)
        </label>
      </Card>

      <Card title="Wygląd">
        <div className="seg wide-seg">
          {(
            [
              ['auto', 'Systemowy'],
              ['light', 'Jasny'],
              ['dark', 'Ciemny'],
              ['night', 'Nocny (czerwony)'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={settings.theme === k ? 'on' : ''} onClick={() => setSettings((s) => void (s.theme = k))}>
              {l}
            </button>
          ))}
        </div>
        <p className="muted small">Tryb nocny chroni adaptację wzroku w ciemności na wachcie.</p>
      </Card>

      <Card title="Kopia zapasowa i druk">
        <p className="muted small">Dane są zapisywane w pamięci urządzenia i działają offline. Regularnie eksportuj kopię (np. na koniec dnia).</p>
        <div className="row gap wrap">
          <button className="btn" onClick={exportVoyage} disabled={!active}>
            ⬇️ Eksportuj rejs (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆️ Importuj rejs
          </button>
          <button className="btn" onClick={() => go('/print')} disabled={!active}>
            📄 Eksport PDF / druk
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const j = JSON.parse(await f.text());
              const v = j.voyage as Voyage;
              if (!v?.id || !v.days) throw new Error();
              importVoyage(v);
              const id = useStore.getState().activeId!;
              if (Array.isArray(j.track)) await idbSet(`track:${id}`, j.track);
              toast('Zaimportowano rejs');
            } catch {
              toast('To nie jest poprawny plik dziennika', 'err');
            }
          }}
        />
      </Card>
      <p className="muted small center">Dziennik jachtowy · wersja {__APP_VERSION__}</p>
    </div>
  );
}
