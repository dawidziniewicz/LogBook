import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { HOUR_FIELDS, DEFAULT_REQUIRED } from '../data/reference';
import { beep, nextReminder, requestNotificationPermission, showSystemNotification, unlockAudio } from '../lib/reminders';
import { hhmm, dateKey, uid } from '../lib/time';
import { go } from '../lib/router';
import { Card, toast } from '../components/ui';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Voyage } from '../types';
import { ASSET_KINDS } from '../lib/photo';
import { FileActions } from '../components/FileActions';

const MINUTES = [45, 50, 55, 0, 5, 10, 15];
const minuteLabel = (m: number) => (m === 0 ? 'o pełnej (:00)' : m > 30 ? `${60 - m} min przed (:${m})` : `${m} min po (:${String(m).padStart(2, '0')})`);

/** aplikacja uruchomiona z ekranu głównego iPhone'a/iPada */
const isIosApp = typeof document !== 'undefined' && document.documentElement.classList.contains('ios-standalone');

export function SettingsPage() {
  const { settings, setSettings, voyages, activeId, setActive, createVoyage, deleteVoyage, importVoyage } = useStore();
  const active = voyages.find((v) => v.id === activeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customMin, setCustomMin] = useState(!MINUTES.includes(settings.reminders.minute));
  const [backup, setBackup] = useState<File>();
  const [backupInfo, setBackupInfo] = useState<string>();
  // po zmianie rejsu przygotowana kopia jest nieaktualna
  useEffect(() => {
    setBackup(undefined);
    setBackupInfo(undefined);
  }, [active]);
  const r = settings.reminders;
  const setR = (fn: (x: typeof r) => void) => setSettings((s) => fn(s.reminders));

  const exportVoyage = async () => {
    if (!active) return;
    const track = (await idbGet(`track:${active.id}`)) ?? [];
    const assets: Record<string, string | undefined> = {};
    for (const k of ASSET_KINDS) assets[k] = await idbGet(`${k}:${active.id}`);
    const name = `dziennik-${(active.yachtName || active.name || 'rejs').replace(/\s+/g, '_')}-${dateKey()}.json`;
    const file = new File([JSON.stringify({ app: 'logbook', version: 1, voyage: active, track, ...assets }, null, 2)], name, { type: 'application/json' });
    setBackup(file);
    setBackupInfo(describeBackup(active, track as unknown[], assets, file.size));
    toast('Kopia gotowa – udostępnij ją albo zapisz');
  };

  return (
    <div className="page">
      <Card
        title="Rejsy"
        actions={
          <div className="row gap-s wrap">
            <button className="btn small ghost" onClick={() => { createVoyage(); go('/opinions'); }}>+ Tylko opinie</button>
            <button className="btn small" onClick={() => { createVoyage(); go('/voyage'); }}>+ Nowy rejs</button>
          </div>
        }
      >
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
            <span className="field-label">W morzu / na kotwicy</span>
            <select value={r.intervalSea} onChange={(e) => setR((x) => void (x.intervalSea = +e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>co {n} h</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">W porcie</span>
            <select value={r.intervalPort} onChange={(e) => setR((x) => void (x.intervalPort = +e.target.value))}>
              {[1, 2, 4, 6, 8, 12, 24].map((n) => <option key={n} value={n}>co {n} h</option>)}
            </select>
            <span className="field-hint">Instrukcja: w porcie raz na 4 h.</span>
          </label>
          <label className="field">
            <span className="field-label">Powtarzaj, gdy niekompletny</span>
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
        {(isIosApp || settings.topExtra != null) && (
          <div className="field wide top-extra">
            <span className="field-label">
              Odstęp od góry (iPhone / iPad): <b>{settings.topExtra ?? 12} pt</b>
            </span>
            <input
              type="range"
              min={0}
              max={48}
              step={2}
              value={settings.topExtra ?? 12}
              onChange={(e) => setSettings((s) => void (s.topExtra = +e.target.value))}
            />
            <span className="field-hint">
              Zmniejsz, jeśli nad tytułem jest pusty pasek; zwiększ, jeśli tytuł wpada w rozmycie pod paskiem statusu.{' '}
              <button className="link" onClick={() => setSettings((s) => void delete s.topExtra)}>
                domyślnie
              </button>
            </span>
          </div>
        )}
      </Card>

      <Card title="Kopia zapasowa i druk">
        <p className="muted small">
          Dane są zapisywane w pamięci urządzenia i działają offline. Regularnie eksportuj kopię (np. na koniec dnia). Plik kopii zawiera cały rejs: wpisy, podpisy, załogę, opinie, ślad
          GPS, zdjęcie załogi, zdjęcie trasy i logo rejsu.
        </p>
        <div className="row gap wrap">
          <button className="btn" onClick={exportVoyage} disabled={!active}>
            🗂 Przygotuj kopię rejsu (JSON)
          </button>
          {backup && <FileActions file={backup} />}
        </div>
        {backupInfo && <p className="small backup-info">🗂 {backupInfo}</p>}
        <div className="row gap wrap" style={{ marginTop: 10 }}>
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
              // najpierw ślad i obrazy (pod docelowym id), dopiero potem przełączenie na rejs –
              // inaczej aplikacja wczytałaby pusty ślad i brak zdjęć
              const exists = useStore.getState().voyages.some((x) => x.id === v.id);
              const final = exists ? { ...v, id: uid(), name: `${v.name} (kopia)` } : v;
              if (Array.isArray(j.track)) await idbSet(`track:${final.id}`, j.track);
              for (const k of ASSET_KINDS) if (typeof j[k] === 'string') await idbSet(`${k}:${final.id}`, j[k]);
              importVoyage(final);
              toast(`Zaimportowano: ${describeBackup(final, Array.isArray(j.track) ? j.track : [], j, f.size)}`, 'ok', 7000);
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

/** krótki opis zawartości pliku kopii */
function describeBackup(v: Voyage, track: unknown[], assets: Record<string, unknown>, size: number) {
  const days = Object.values(v.days);
  const sigs =
    days.reduce((n, d) => n + (d.firstOfficer?.image ? 1 : 0) + (d.captain?.image ? 1 : 0), 0) + (v.opinion?.signature?.image ? 1 : 0);
  const has = (k: string) => (typeof assets[k] === 'string' ? '✓' : '—');
  const mb = size / 1024 / 1024;
  return [
    `${days.length} dni`,
    `${v.crew.length} os. załogi`,
    `${sigs} podpis${sigs === 1 ? '' : sigs < 5 && sigs > 1 ? 'y' : 'ów'}`,
    `ślad ${track.length} pkt`,
    `zdjęcie załogi ${has('photo')}`,
    `zdjęcie trasy ${has('route')}`,
    `logo rejsu ${has('vlogo')}`,
    mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(size / 1024))} kB`,
  ].join(' · ');
}
