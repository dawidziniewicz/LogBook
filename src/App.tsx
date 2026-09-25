import { useEffect, useState } from 'react';
import { useStore, useVoyage } from './store';
import { go, useRoute } from './lib/router';
import { dateKey, fmtDate, hourLabel } from './lib/time';
import { onReminder, startReminderLoop, type ReminderEvent } from './lib/reminders';
import { loadTrack, startTracking, stopTracking } from './lib/tracker';
import { HOUR_FIELDS } from './data/reference';
import { Toasts } from './components/ui';
import { HomePage } from './pages/HomePage';
import { DayPage } from './pages/DayPage';
import { VoyagePage } from './pages/VoyagePage';
import { CrewPage } from './pages/CrewPage';
import { SummaryPage } from './pages/SummaryPage';
import { ReferencePage } from './pages/ReferencePage';
import { SettingsPage } from './pages/SettingsPage';
import { PrintPage } from './pages/PrintPage';
import { MapPage } from './pages/MapPage';
import { OpinionsPage } from './pages/OpinionsPage';

const NAV = [
  { to: '/', icon: '⌂', label: 'Start', match: (p: string[]) => p.length === 0 },
  { to: `/day`, icon: '✎', label: 'Dziennik', match: (p: string[]) => p[0] === 'day' },
  { to: '/map', icon: '🗺', label: 'Mapa', match: (p: string[]) => p[0] === 'map' },
  { to: '/voyage', icon: '⛵', label: 'Rejs i jacht', match: (p: string[]) => p[0] === 'voyage' },
  { to: '/crew', icon: '👥', label: 'Załoga', match: (p: string[]) => p[0] === 'crew' },
  { to: '/opinions', icon: '📝', label: 'Opinie z rejsu', match: (p: string[]) => p[0] === 'opinions' },
  { to: '/summary', icon: 'Σ', label: 'Karta rejsu', match: (p: string[]) => p[0] === 'summary' },
  { to: '/ref', icon: '📻', label: 'UKF i skale', match: (p: string[]) => p[0] === 'ref' },
  { to: '/settings', icon: '⚙', label: 'Ustawienia', match: (p: string[]) => p[0] === 'settings' },
];
const MOBILE_NAV = ['/', '/day', '/map', '/voyage', '/settings'];

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const color = theme === 'night' ? '#000000' : theme === 'dark' ? '#0E1230' : '#3447AA';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [theme]);
}

export function App() {
  const hydrated = useStore((s) => s.hydrated);
  const v = useVoyage();
  const route = useRoute();
  const [reminder, setReminder] = useState<ReminderEvent>();
  useTheme();

  useEffect(() => {
    if (!hydrated) return;
    startReminderLoop();
    const off = onReminder(setReminder);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open' && typeof e.data.url === 'string') window.location.hash = e.data.url.split('#')[1] ?? '/';
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      off();
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, [hydrated]);

  // ślad GPS: wczytaj dla aktywnego rejsu i wznów zapis, jeśli jesteśmy w morzu
  const trackAtSea = useStore((s) => s.settings.trackAtSea);
  useEffect(() => {
    if (!v) return;
    void loadTrack(v.id).then(() => {
      if (v.status === 'sea' && trackAtSea) startTracking();
      else stopTracking();
    });
  }, [v?.id, v?.status, trackAtSea]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return <div className="splash">⛵</div>;
  if (!v) return <Welcome />;

  const [p0, p1] = route.parts;
  let page;
  if (p0 === 'day') {
    const h = route.query.get('h');
    page = <DayPage key={p1 ?? 'today'} date={p1 ?? dateKey()} hour={h ? +h : undefined} />;
  } else if (p0 === 'map') page = <MapPage />;
  else if (p0 === 'voyage') page = <VoyagePage />;
  else if (p0 === 'crew') page = <CrewPage />;
  else if (p0 === 'opinions') page = <OpinionsPage />;
  else if (p0 === 'summary') page = <SummaryPage />;
  else if (p0 === 'ref') page = <ReferencePage />;
  else if (p0 === 'settings') page = <SettingsPage />;
  else if (p0 === 'print') return <PrintPage />;
  else page = <HomePage />;

  const title = NAV.find((n) => n.match(route.parts))?.label ?? '';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <div>
            <b>Dziennik jachtowy</b>
            <small>{v.yachtName ? `s/y ${v.yachtName}` : v.name || 'Nowy rejs'}</small>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={n.match(route.parts) ? 'on' : ''}>
              <span className="ico">{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className={`main${p0 === 'map' ? ' main-map' : ''}`}>
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-right">
            <a href="#/ref" className="top-link" aria-label="UKF i skale">📻</a>
            <a href="#/crew" className="top-link" aria-label="Załoga">👥</a>
            <a href="#/summary" className="top-link" aria-label="Karta rejsu">Σ</a>
          </div>
        </header>
        {reminder && (
          <div className="reminder-banner" role="alert">
            <div>
              <b>⏰ Czas na wpis {hourLabel(reminder.hour)}</b>
              <small>
                {fmtDate(reminder.date)} · brak: {reminder.missing.map((k) => HOUR_FIELDS.find((f) => f.key === k)?.short).join(', ')}
              </small>
            </div>
            <div className="row gap-s">
              <button
                className="btn small"
                onClick={() => {
                  go(`/day/${reminder.date}?h=${reminder.hour}`);
                  setReminder(undefined);
                }}
              >
                Uzupełnij
              </button>
              <button className="icon-btn" onClick={() => setReminder(undefined)} aria-label="Zamknij">
                ✕
              </button>
            </div>
          </div>
        )}
        <main>{page}</main>
      </div>
      <nav className="tabbar">
        {NAV.filter((n) => MOBILE_NAV.includes(n.to)).map((n) => (
          <a key={n.to} href={`#${n.to}`} className={n.match(route.parts) ? 'on' : ''}>
            <span className="ico">{n.icon}</span>
            <span>{n.label.split(' ')[0]}</span>
          </a>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}

function Welcome() {
  const createVoyage = useStore((s) => s.createVoyage);
  return (
    <div className="welcome">
      <img src="/favicon.svg" alt="" width={96} height={96} />
      <h1>Dziennik jachtowy</h1>
      <p>Wygodny, elektroniczny dziennik – wpisy godzinowe, pozycja z GPS, automatyczne wyliczenia i przypomnienia. Działa bez internetu.</p>
      <button
        className="btn primary big"
        onClick={() => {
          createVoyage();
          go('/voyage');
        }}
      >
        + Rozpocznij nowy rejs
      </button>
      <p className="muted small">Dane są przechowywane wyłącznie na tym urządzeniu. Kopię zapasową zrobisz w Ustawieniach.</p>
      <Toasts />
    </div>
  );
}
