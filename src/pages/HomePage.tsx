import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useStore, useVoyage } from '../store';
import { HOUR_FIELDS } from '../data/reference';
import { arrivePort, autoFillHour, departPort, dropAnchor } from '../lib/actions';
import { allTallies, missingFields, sortedDays, watchAt } from '../lib/compute';
import { distanceNm, fmtLat, fmtLon } from '../lib/geo';
import { go } from '../lib/router';
import { nextReminder, requestNotificationPermission, setWakeLock, unlockAudio, wakeLockActive } from '../lib/reminders';
import { currentRow, dateKey, fmtDate, hhmm, hourLabel } from '../lib/time';
import { getTrack, isTracking, subscribeTrack } from '../lib/tracker';
import { AsyncButton, Card, Stat, toast } from '../components/ui';
import { VoyageMap } from '../components/VoyageMap';

const STATUS_LABEL = { port: 'W porcie', sea: 'W morzu', anchor: 'Na kotwicy' } as const;

export function HomePage() {
  const v = useVoyage();
  const settings = useStore((s) => s.settings);
  const [, force] = useState(0);
  const [portName, setPortName] = useState('');
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [wake, setWake] = useState(wakeLockActive());
  const trackLen = useSyncExternalStore(subscribeTrack, () => getTrack().length);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const tallies = useMemo(() => (v ? allTallies(v) : {}), [v]);
  const trackToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const pts = getTrack().filter((p) => p.t >= start.getTime());
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += distanceNm(pts[i - 1], pts[i]);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackLen]);

  if (!v) return null;
  const now = new Date();
  const cur = currentRow(now);
  const row = v.days[cur.date]?.hours[cur.hour];
  const missing = missingFields(row, settings.reminders.required);
  const next = nextReminder(settings, v.status, now);
  const lastDay = sortedDays(v).slice(-1)[0];
  const totals = lastDay ? tallies[lastDay]?.total : undefined;
  const title = v.name || v.yachtName || 'Nowy rejs';
  const lastPos = getTrack().slice(-1)[0];

  return (
    <div className="page">
      <section className={`hero status-${v.status}`}>
        <div className="hero-top">
          <div>
            <div className="hero-kicker">{v.yachtName ? `s/y ${v.yachtName}` : 'Dziennik jachtowy'}</div>
            <h1>{title}</h1>
          </div>
          <div className="status-pill">
            <span className="pulse" /> {STATUS_LABEL[v.status]}
            {v.statusSince && <small> od {hhmm(new Date(v.statusSince))}</small>}
          </div>
        </div>

        {v.status === 'port' ? (
          <div className="hero-actions">
            <input className="hero-input" placeholder="Nazwa portu (puste = z GPS)" value={portName} onChange={(e) => setPortName(e.target.value)} />
            <AsyncButton
              className="btn hero-btn"
              busyText="Ustalam pozycję…"
              onClick={async () => {
                unlockAudio();
                const name = await departPort(portName);
                setPortName('');
                toast(`⛵ Wypłynięto z: ${name}. Wpisano do 18A i przebiegu żeglugi.`, 'ok', 6000);
              }}
            >
              ⛵ Wypływamy z portu
            </AsyncButton>
          </div>
        ) : (
          <div className="hero-actions">
            <input className="hero-input" placeholder="Nazwa portu (puste = z GPS)" value={portName} onChange={(e) => setPortName(e.target.value)} />
            <AsyncButton
              className="btn hero-btn"
              busyText="Ustalam pozycję…"
              onClick={async () => {
                const name = await arrivePort(portName);
                setPortName('');
                toast(`⚓ Zacumowano: ${name}. Wpisano do 18B.`, 'ok', 6000);
              }}
            >
              🏁 Wchodzimy do portu
            </AsyncButton>
            {v.status === 'sea' ? (
              <AsyncButton className="btn hero-btn ghost" onClick={async () => { await dropAnchor(); toast('⚓ Zakotwiczenie zapisane'); }}>
                ⚓ Kotwica
              </AsyncButton>
            ) : (
              <AsyncButton className="btn hero-btn ghost" onClick={async () => { await departPort(); toast('Odejście z kotwicy zapisane'); }}>
                ⛵ Z kotwicy
              </AsyncButton>
            )}
          </div>
        )}
        {lastPos && (
          <div className="hero-pos">
            📍 {fmtLat(lastPos.lat)} · {fmtLon(lastPos.lon)} <span>({hhmm(new Date(lastPos.t))})</span>
            {isTracking() && <span className="rec">● zapis śladu</span>}
          </div>
        )}
      </section>

      <Card
        title={
          <>
            Bieżący wiersz <b className="mono">{hourLabel(cur.hour)}</b>
          </>
        }
        actions={<span className="muted small">Wachta {watchAt(v, cur.date, hhmm(now))}</span>}
      >
        {missing.length ? (
          <p>
            Brakuje: <b>{missing.map((k) => HOUR_FIELDS.find((f) => f.key === k)?.short).join(', ')}</b>
          </p>
        ) : (
          <p className="ok-text">✓ Wiersz kompletny</p>
        )}
        <div className="row gap wrap">
          <AsyncButton
            className="btn primary"
            busyText="Ustalam pozycję…"
            onClick={async () => {
              const r = await autoFillHour(cur.date, cur.hour);
              toast(`📍 ${r.message}`, 'ok', 6000);
            }}
          >
            📍 Pozycja + wyliczenia
          </AsyncButton>
          <button className="btn" onClick={() => go(`/day/${cur.date}?h=${cur.hour}`)}>
            ✏️ Uzupełnij wiersz
          </button>
          <button className="btn ghost" onClick={() => go(`/day/${dateKey()}`)}>
            Cały dzień →
          </button>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Przypomnienia">
          {settings.reminders.enabled ? (
            <p>
              Następne: <b className="mono">{hhmm(next)}</b> <span className="muted">(co {v.status === 'port' ? settings.reminders.intervalPort : settings.reminders.intervalSea} h)</span>
            </p>
          ) : (
            <p className="muted">Wyłączone</p>
          )}
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              className="btn primary"
              onClick={async () => {
                unlockAudio();
                const p = await requestNotificationPermission();
                setPerm(p);
                if (p === 'denied') toast('Powiadomienia zablokowane – włącz je w ustawieniach telefonu', 'err', 6000);
              }}
            >
              🔔 Włącz powiadomienia
            </button>
          )}
          {perm === 'unsupported' && <p className="muted small">Ta przeglądarka nie wspiera powiadomień. Na iPhonie dodaj aplikację do ekranu początkowego (Udostępnij → Do ekranu początkowego).</p>}
          <label className="check">
            <input
              type="checkbox"
              checked={wake}
              onChange={async (e) => {
                unlockAudio();
                const ok = await setWakeLock(e.target.checked);
                setWake(ok);
                if (e.target.checked && !ok) toast('Urządzenie nie pozwala blokować wygaszania ekranu', 'err');
              }}
            />
            Tryb wachty – ekran nie gaśnie (pewne przypomnienia)
          </label>
          <button className="link" onClick={() => go('/settings')}>
            Ustaw godziny przypomnień →
          </button>
        </Card>

        <Card title="Rejs w liczbach">
          <div className="stats">
            <Stat label="Mm łącznie" value={totals ? String(totals.miles).replace('.', ',') : '0'} />
            <Stat label="h żeglugi" value={totals?.total ?? 0} sub={totals ? `⛵ ${totals.sail} · ⚙️ ${totals.engine}` : undefined} />
            <Stat label="Mm dziś (ślad)" value={trackToday.toFixed(1).replace('.', ',')} />
            <Stat label="dni" value={sortedDays(v).length} />
          </div>
          <VoyageMap className="home-map" />
        </Card>
      </div>

      <Card title="Dni rejsu">
        <div className="day-chips">
          {sortedDays(v)
            .slice()
            .reverse()
            .map((d) => (
              <button key={d} className={`day-chip${d === dateKey() ? ' on' : ''}`} onClick={() => go(`/day/${d}`)}>
                <b>{fmtDate(d).slice(0, 5)}</b>
                <small>{v.days[d].portOut || v.days[d].portIn || '—'}</small>
              </button>
            ))}
          <button className="day-chip add" onClick={() => go(`/day/${dateKey()}`)}>
            + dziś
          </button>
        </div>
      </Card>
    </div>
  );
}
