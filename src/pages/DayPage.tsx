import { useEffect, useMemo, useState } from 'react';
import { emptyDay, useStore, useVoyage } from '../store';
import { DAY_CHECKS, HOUR_FIELDS, QUICK_EVENTS } from '../data/reference';
import { addDays, dateKey, fmtDate, hhmm, hourLabel, weekday, currentRow } from '../lib/time';
import { allTallies, missingFields, rowKind, watchAt } from '../lib/compute';
import { autoFillHour } from '../lib/actions';
import { fmtLat, fmtLon, getPosition } from '../lib/geo';
import { go } from '../lib/router';
import { HourEditor } from '../components/HourEditor';
import { AsyncButton, Card, Field, SignaturePad, toast } from '../components/ui';
import type { Tally } from '../types';

const TALLY_COLS: { k: keyof Tally; label: string }[] = [
  { k: 'port', label: 'Na postoju' },
  { k: 'sail', label: 'Pod żaglami' },
  { k: 'engine', label: 'Na silniku' },
  { k: 'total', label: 'Łącznie żeglugi' },
  { k: 'above6', label: 'W tym > 6°B' },
  { k: 'miles', label: 'Przebyto Mm' },
];

const fmtT = (n: number) => String(n).replace('.', ',');

export function DayPage(props: { date: string; hour?: number }) {
  const v = useVoyage();
  const { mutateDay, settings } = useStore();
  const [edit, setEdit] = useState<number | undefined>(props.hour);
  const [wideTable, setWideTable] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setWideTable(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => setEdit(props.hour), [props.hour, props.date]);

  const date = props.date;
  const day = v?.days[date] ?? emptyDay(date);
  const tallies = useMemo(() => (v ? allTallies(v) : {}), [v]);
  const cur = currentRow();
  const isToday = date === dateKey();

  useEffect(() => {
    if (isToday && props.hour === undefined) document.getElementById(`h-${cur.hour}`)?.scrollIntoView({ block: 'center' });
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!v) return null;
  const tally = tallies[date];
  const table = settings.view === 'table' || (settings.view === 'auto' && wideTable);
  const required = settings.reminders.required;

  const status = (h: number) => {
    const r = day.hours[h];
    if (rowKind(r) === 'empty') return 'empty';
    return missingFields(r, required).length ? 'partial' : 'full';
  };
  const closeEditor = () => {
    setEdit(undefined);
    if (props.hour !== undefined) go(`/day/${date}`);
  };

  return (
    <div className="page">
      <div className="day-nav">
        <button className="icon-btn" onClick={() => go(`/day/${addDays(date, -1)}`)} aria-label="Poprzedni dzień">
          ‹
        </button>
        <label className="day-pick">
          <span className="weekday">
            <span className="fno">1.</span> {weekday(date)}
          </span>
          <span className="date">
            <span className="fno">2.</span> {fmtDate(date)}
          </span>
          <input type="date" value={date} onChange={(e) => e.target.value && go(`/day/${e.target.value}`)} aria-label="Wybierz datę" />
        </label>
        <button className="icon-btn" onClick={() => go(`/day/${addDays(date, 1)}`)} aria-label="Następny dzień">
          ›
        </button>
      </div>
      {!isToday && (
        <button className="link center" onClick={() => go(`/day/${dateKey()}`)}>
          ↩ Dzisiaj
        </button>
      )}

      <Card
        title="Wpisy godzinowe (3–16)"
        actions={
          <div className="seg">
            <button className={!table ? 'on' : ''} onClick={() => useStore.getState().setSettings((s) => void (s.view = 'cards'))}>
              Karty
            </button>
            <button className={table ? 'on' : ''} onClick={() => useStore.getState().setSettings((s) => void (s.view = 'table'))}>
              Tabela
            </button>
          </div>
        }
      >
        {table ? (
          <div className="table-wrap log-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th className="sticky">
                    <span className="fno">3.</span>
                    <br />
                    GODZ.
                  </th>
                  {HOUR_FIELDS.map((f) => (
                    <th key={f.key} title={f.label}>
                      <span className="fno">{f.no}.</span>
                      <br />
                      {f.short}
                    </th>
                  ))}
                  <th>Φ / Λ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
                  const r = day.hours[h] ?? {};
                  const auto = new Set(r.auto ?? []);
                  return (
                    <tr key={h} id={`h-${h}`} className={`st-${status(h)}${isToday && h === cur.hour ? ' now' : ''}`} onClick={() => setEdit(h)}>
                      <th className="sticky">{hourLabel(h)}</th>
                      {HOUR_FIELDS.map((f) => (
                        <td key={f.key} className={auto.has(f.key) ? 'is-auto' : required.includes(f.key) && status(h) === 'partial' && !r[f.key] ? 'is-miss' : ''}>
                          {r[f.key]}
                        </td>
                      ))}
                      <td className="pos small">{r.lat != null && r.lon != null ? <>{fmtLat(r.lat)}<br />{fmtLon(r.lon)}</> : ''}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <AsyncButton className="icon-btn gps" title="Pobierz pozycję i wylicz" onClick={async () => toast(`📍 ${(await autoFillHour(date, h)).message}`, 'ok', 6000)}>
                          📍
                        </AsyncButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ol className="hour-list">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
              const r = day.hours[h] ?? {};
              const summary = HOUR_FIELDS.filter((f) => r[f.key]).map((f) => `${f.short} ${r[f.key]}`);
              const miss = status(h) === 'partial' ? missingFields(r, required).length : 0;
              return (
                <li key={h} id={`h-${h}`} className={`hour-item st-${status(h)}${isToday && h === cur.hour ? ' now' : ''}`}>
                  <button className="hour-main" onClick={() => setEdit(h)}>
                    <span className="hour-no">{hourLabel(h)}</span>
                    <span className="hour-sum">
                      {summary.length ? summary.join(' · ') : <span className="muted">Dotknij, aby uzupełnić</span>}
                      {miss > 0 && <span className="miss-badge">brak {miss}</span>}
                    </span>
                  </button>
                  <AsyncButton className="icon-btn gps" title="Pobierz pozycję i wylicz" onClick={async () => toast(`📍 ${(await autoFillHour(date, h)).message}`, 'ok', 6000)}>
                    📍
                  </AsyncButton>
                </li>
              );
            })}
          </ol>
        )}
        <p className="legend muted small">
          <span className="dot full" /> kompletny <span className="dot partial" /> brakuje pól wymaganych <span className="auto-tag">auto</span> wypełnione automatycznie – zweryfikuj
        </p>
      </Card>

      {tally && (
        <Card no="17." title="Zliczenie">
          <div className="table-wrap">
            <table className="tally">
              <thead>
                <tr>
                  <th></th>
                  {TALLY_COLS.map((c) => (
                    <th key={c.k}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Z przeniesienia</th>
                  {TALLY_COLS.map((c) => (
                    <td key={c.k}>{fmtT(tally.carry[c.k])}</td>
                  ))}
                </tr>
                <tr className="edit">
                  <th>Z bieżącej doby</th>
                  {TALLY_COLS.map((c) => (
                    <td key={c.k}>
                      <input
                        inputMode="decimal"
                        className={day.tallyOverride?.[c.k] != null ? 'overridden' : ''}
                        value={day.tallyOverride?.[c.k] != null ? fmtT(day.tallyOverride[c.k]!) : ''}
                        placeholder={fmtT(tally.today[c.k])}
                        onChange={(e) =>
                          mutateDay(date, (d) => {
                            const n = parseFloat(e.target.value.replace(',', '.'));
                            d.tallyOverride = { ...d.tallyOverride, [c.k]: isNaN(n) ? undefined : n };
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Do przeniesienia</th>
                  {TALLY_COLS.map((c) => (
                    <td key={c.k}>
                      <b>{fmtT(tally.total[c.k])}</b>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted small">Liczone automatycznie z wpisów godzinowych (silnik → na silniku, żagle → pod żaglami, reszta → postój). Wpisz wartość, aby ją nadpisać.</p>
        </Card>
      )}

      <Card title="Trasa">
        <div className="grid">
          <Field label={<><span className="fno">18A.</span> Port wyjścia</>} value={day.portOut} onChange={(x) => mutateDay(date, (d) => void (d.portOut = x))} />
          <Field label={<><span className="fno">18B.</span> Port wejścia</>} value={day.portIn} onChange={(x) => mutateDay(date, (d) => void (d.portIn = x))} hint="Wpisuj dopiero po zacumowaniu" />
          <Field label={<><span className="fno">18C.</span> Postój w porcie</>} value={day.portStay} onChange={(x) => mutateDay(date, (d) => void (d.portStay = x))} wide />
        </div>
      </Card>

      <EventsCard date={date} />

      <Card title="Światła i kontrole (23–28)">
        <div className="checks">
          {DAY_CHECKS.map((c) => {
            const e = day.checks[c.key] ?? {};
            return (
              <div key={c.key} className="check-row">
                <div className="check-label">
                  <span className="fno">{c.no}.</span> {c.label}
                </div>
                <div className="check-inputs">
                  <input type="time" value={e.time ?? ''} aria-label="Godzina" onChange={(ev) => mutateDay(date, (d) => void (d.checks[c.key] = { ...e, time: ev.target.value }))} />
                  <button className="btn ghost small" onClick={() => mutateDay(date, (d) => void (d.checks[c.key] = { ...e, time: hhmm() }))}>
                    Teraz
                  </button>
                  <input placeholder={c.noteLabel} value={e.note ?? ''} onChange={(ev) => mutateDay(date, (d) => void (d.checks[c.key] = { ...e, note: ev.target.value }))} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card no="29." title="Dziennik za dzień bieżący sprawdzono i zamknięto">
        <div className="grid">
          <SignaturePad label="I oficer" value={day.firstOfficer} onChange={(s) => mutateDay(date, (d) => void (d.firstOfficer = s))} />
          <SignaturePad label="Kapitan" value={day.captain} onChange={(s) => mutateDay(date, (d) => void (d.captain = s))} />
        </div>
      </Card>

      {edit !== undefined && (
        <HourEditor
          date={date}
          hour={edit}
          onClose={closeEditor}
          onNav={(h) => setEdit(h)}
        />
      )}
    </div>
  );
}

function EventsCard({ date }: { date: string }) {
  const v = useVoyage()!;
  const { addEvent, mutateDay } = useStore();
  const day = v.days[date] ?? emptyDay(date);
  const [time, setTime] = useState(hhmm());
  const [text, setText] = useState('');
  const [officer, setOfficer] = useState('');
  const [withPos, setWithPos] = useState(false);

  const submit = async () => {
    if (!text.trim()) return toast('Wpisz treść zdarzenia', 'err');
    let lat: number | undefined, lon: number | undefined;
    if (withPos) {
      const f = await getPosition();
      lat = f.lat;
      lon = f.lon;
    }
    addEvent(date, { time, text: text.trim(), officer, lat, lon, watch: watchAt(v, date, time) });
    setText('');
    setTime(hhmm());
  };

  return (
    <Card title="Przebieg żeglugi oraz uwagi (19–22)">
      <ul className="events">
        {day.events.length === 0 && <li className="muted">Brak wpisów. Zdarzenia z przycisków „Wypływamy/Wchodzimy” pojawią się tu automatycznie.</li>}
        {day.events.map((e) => (
          <li key={e.id} className="event">
            <div className="event-time">
              <input
                type="time"
                value={e.time}
                aria-label="Godzina"
                onChange={(ev) =>
                  mutateDay(date, (d) => {
                    const x = d.events.find((y) => y.id === e.id)!;
                    x.time = ev.target.value;
                  })
                }
              />
              <span className="watch" title="19. Wachta">
                W {e.watch ?? '–'}
              </span>
            </div>
            <div className="event-body">
              <textarea
                rows={1}
                value={e.text}
                onChange={(ev) =>
                  mutateDay(date, (d) => {
                    d.events.find((y) => y.id === e.id)!.text = ev.target.value;
                  })
                }
              />
              <div className="event-meta">
                {e.lat != null && e.lon != null && (
                  <span className="pos">
                    Φ {fmtLat(e.lat)} · Λ {fmtLon(e.lon)}
                  </span>
                )}
                <input
                  className="officer"
                  placeholder="22. Podpis oficera"
                  value={e.officer ?? ''}
                  onChange={(ev) =>
                    mutateDay(date, (d) => {
                      d.events.find((y) => y.id === e.id)!.officer = ev.target.value;
                    })
                  }
                />
                <button
                  className="link danger"
                  onClick={() => {
                    if (confirm('Usunąć ten wpis?')) mutateDay(date, (d) => void (d.events = d.events.filter((y) => y.id !== e.id)));
                  }}
                >
                  usuń
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="event-add">
        <div className="row gap">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Godzina zdarzenia" />
          <span className="watch">W {watchAt(v, date, time)}</span>
          <label className="check">
            <input type="checkbox" checked={withPos} onChange={(e) => setWithPos(e.target.checked)} /> 📍 dodaj pozycję
          </label>
        </div>
        <textarea rows={2} placeholder="Treść zdarzenia, np. 0620/03,5 Lm Rozewie Δ = 2,0 Mm" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="chips small">
          {QUICK_EVENTS.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => setText((t) => (t ? `${t}; ${q}` : q))}>
              {q}
            </button>
          ))}
        </div>
        <div className="row gap">
          <input placeholder="Podpis oficera (opcjonalnie)" value={officer} onChange={(e) => setOfficer(e.target.value)} />
          <AsyncButton className="btn primary" onClick={submit}>
            Dodaj wpis
          </AsyncButton>
        </div>
      </div>
    </Card>
  );
}
