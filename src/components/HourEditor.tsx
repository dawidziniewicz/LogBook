import { useState } from 'react';
import { useStore, useVoyage } from '../store';
import { CLOUDS, DOUGLAS, HOUR_FIELDS, PRECIP, RHUMBS, RHUMBS_16, VISIBILITY, BEAUFORT } from '../data/reference';
import { autoFillHour, copyPrevious } from '../lib/actions';
import { fmtLat, fmtLon } from '../lib/geo';
import { fmtDate, hourLabel, weekday } from '../lib/time';
import type { HourField, HourRow } from '../types';
import { AsyncButton, Chips, Field, Sheet, toast } from './ui';

const p2 = (n: number) => String(n).padStart(2, '0');

function parseWind(s = '') {
  const m = s.trim().match(/^([A-Za-z]+)?\s*(\d+)?(?:\s*-\s*(\d+))?/);
  return { dir: m?.[1]?.toUpperCase().replace('T', 't') ?? '', f1: m?.[2] ?? '', f2: m?.[3] ?? '' };
}
const composeWind = (dir: string, f1: string, f2: string) => [dir, f1 && (f2 && f2 !== f1 ? `${f1}-${f2}` : f1)].filter(Boolean).join(' ');

function parseSky(s = '') {
  const t = s.trim().split(/[\s,]+/).filter(Boolean);
  const cloud = t[0] && CLOUDS.some((c) => c.v === t[0].toUpperCase()) ? t.shift()!.toUpperCase() : '';
  return { cloud, precip: t.map((x) => x.toUpperCase()) };
}

function parseSails(s = '') {
  const map = new Map<string, number>();
  for (const tok of s.split(/[\s,]+/).filter(Boolean)) {
    const m = tok.match(/^([^\d]+)(\d*)$/);
    if (m) map.set(m[1], m[2] ? parseInt(m[2], 10) : 0);
  }
  return map;
}
const composeSails = (map: Map<string, number>) => [...map].map(([c, r]) => (r ? `${c}${r}` : c)).join(', ');

export function HourEditor(props: { date: string; hour: number; onClose: () => void; onNav: (h: number) => void }) {
  const { date, hour } = props;
  const v = useVoyage();
  const setHour = useStore((s) => s.setHour);
  const required = useStore((s) => s.settings.reminders.required);
  const [all32, setAll32] = useState(false);
  if (!v) return null;
  const row: HourRow = v.days[date]?.hours[hour] ?? {};
  const set = (k: HourField, val: string) => setHour(date, hour, { [k]: val });
  const auto = new Set(row.auto ?? []);
  const miss = (k: HourField) => required.includes(k) && !row[k];
  const meta = (k: HourField) => HOUR_FIELDS.find((f) => f.key === k)!;
  const lbl = (k: HourField) => (
    <>
      <span className="fno">{meta(k).no}.</span> {meta(k).label}
      {miss(k) && <span className="req">wymagane</span>}
    </>
  );
  const F = (k: HourField, extra: Partial<Parameters<typeof Field>[0]> = {}) => (
    <Field
      label={lbl(k)}
      value={row[k]}
      onChange={(x) => set(k, x)}
      auto={auto.has(k)}
      placeholder={meta(k).unit}
      hint={meta(k).hint}
      {...extra}
    />
  );

  const wind = parseWind(row.wind);
  const sky = parseSky(row.sky);
  const sails = parseSails(row.sails);
  const sailCodes = v.sails.filter((s) => s.code.trim());

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={
        <div className="hour-title">
          <button className="icon-btn" disabled={hour <= 1} onClick={() => props.onNav(hour - 1)} aria-label="Poprzednia godzina">
            ‹
          </button>
          <div>
            <div className="big">{hourLabel(hour)}</div>
            <div className="sub">
              {p2(hour - 1)}:00–{p2(hour)}:00 · {weekday(date)} {fmtDate(date)}
            </div>
          </div>
          <button className="icon-btn" disabled={hour >= 24} onClick={() => props.onNav(hour + 1)} aria-label="Następna godzina">
            ›
          </button>
        </div>
      }
      footer={
        <button className="btn wide" onClick={props.onClose}>
          Gotowe
        </button>
      }
    >
      <div className="hour-actions">
        <AsyncButton
          className="btn primary big"
          busyText="Ustalam pozycję…"
          onClick={async () => {
            const r = await autoFillHour(date, hour);
            toast(`📍 ${r.message}`, 'ok', 6000);
          }}
        >
          📍 Pobierz pozycję i wylicz
        </AsyncButton>
        <button
          className="btn ghost"
          onClick={() => toast(copyPrevious(date, hour) ? 'Skopiowano z poprzedniego wpisu' : 'Brak danych do skopiowania', 'info')}
        >
          ⎘ Kopiuj poprzednią
        </button>
      </div>
      {row.lat != null && row.lon != null && (
        <div className="pos-pill">
          Φ {fmtLat(row.lat)} &nbsp; Λ {fmtLon(row.lon)}
          {row.fixAt && <span className="muted"> · {new Date(row.fixAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      )}

      <h3 className="group">Nawigacja</h3>
      <div className="grid">
        {F('kk', { inputMode: 'numeric', placeholder: '000' })}
        {F('kd', {
          placeholder: '000',
          after: (
            <button type="button" className={`chip${row.kd === 'KPL' ? ' on' : ''}`} onClick={() => set('kd', row.kd === 'KPL' ? '' : 'KPL')}>
              KPL
            </button>
          ),
        })}
        {F('speed', { inputMode: 'decimal', placeholder: '0,0' })}
        {F('log', { inputMode: 'decimal', placeholder: '00,0' })}
        {F('depth', { inputMode: 'decimal', placeholder: 'm' })}
      </div>

      <h3 className="group">Napęd</h3>
      <div className="field wide">
        <span className="field-label">{lbl('sails')}</span>
        <div className="chips">
          {sailCodes.map((s) => {
            const on = sails.has(s.code);
            const reefs = parseInt(s.reefs, 10) || 0;
            return (
              <span key={s.id} className="sail-chip">
                <button
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  title={s.name}
                  onClick={() => {
                    const m = new Map(sails);
                    m.delete('—');
                    if (on) m.delete(s.code);
                    else m.set(s.code, 0);
                    set('sails', composeSails(m));
                  }}
                >
                  {s.code} <small>{s.name}</small>
                </button>
                {on && reefs > 0 && (
                  <select
                    aria-label={`Refy ${s.name}`}
                    value={sails.get(s.code) ?? 0}
                    onChange={(e) => {
                      const m = new Map(sails);
                      m.set(s.code, +e.target.value);
                      set('sails', composeSails(m));
                    }}
                  >
                    {Array.from({ length: reefs + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i ? `ref ${i}` : 'cały'}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            );
          })}
          <button type="button" className={`chip${row.sails === '—' ? ' on' : ''}`} onClick={() => set('sails', '—')}>
            — brak
          </button>
        </div>
        <input className={auto.has('sails') ? 'is-auto' : ''} value={row.sails ?? ''} onChange={(e) => set('sails', e.target.value)} placeholder="np. F, G1" />
      </div>
      <div className="grid">
        {F('engine', {
          inputMode: 'numeric',
          after: (
            <button type="button" className={`chip${row.engine === '—' ? ' on' : ''}`} onClick={() => set('engine', row.engine === '—' ? '' : '—')}>
              —
            </button>
          ),
        })}
      </div>

      <h3 className="group">Pogoda i morze</h3>
      <div className="field wide">
        <span className="field-label">
          {lbl('wind')} {auto.has('wind') && <span className="auto-tag">auto</span>}
        </span>
        <div className="wind-dir">
          <Chips small options={(all32 ? RHUMBS : RHUMBS_16).map((r) => ({ v: r }))} value={wind.dir} onChange={(d) => set('wind', composeWind(d, wind.f1, wind.f2))} />
          <button type="button" className="link" onClick={() => setAll32(!all32)}>
            {all32 ? '16 kierunków' : '32 rumby'}
          </button>
        </div>
        <div className="row wrap gap-s">
          <span className="muted small">Siła °B</span>
          <Chips
            small
            options={BEAUFORT.map((b) => ({ v: String(b.b), title: `${b.pl} · ${b.kn} w` }))}
            value={wind.f1}
            onChange={(f) => set('wind', composeWind(wind.dir, f, wind.f2 && +wind.f2 > +f ? wind.f2 : ''))}
          />
        </div>
        {wind.f1 && (
          <div className="row wrap gap-s">
            <span className="muted small">w porywach do</span>
            <Chips
              small
              options={BEAUFORT.filter((b) => b.b > +wind.f1).slice(0, 4).map((b) => ({ v: String(b.b) }))}
              value={wind.f2}
              onChange={(f) => set('wind', composeWind(wind.dir, wind.f1, wind.f2 === f ? '' : f))}
            />
          </div>
        )}
        <input className={auto.has('wind') ? 'is-auto' : ''} value={row.wind ?? ''} onChange={(e) => set('wind', e.target.value)} placeholder="np. NNE 4-5" />
        {wind.f1 && <span className="field-hint">{BEAUFORT[+wind.f1]?.pl} – {BEAUFORT[+wind.f1]?.sea}</span>}
      </div>

      <div className="field wide">
        <span className="field-label">
          {lbl('sea')} {auto.has('sea') && <span className="auto-tag">auto</span>}
        </span>
        <Chips options={DOUGLAS.map((d) => ({ v: String(d.s), title: `${d.h} m` }))} value={row.sea} onChange={(x) => set('sea', x)} />
        {row.sea && <span className="field-hint">Wysokość fali: {DOUGLAS[+row.sea]?.h} m</span>}
      </div>

      <div className="field wide">
        <span className="field-label">
          {lbl('sky')} {auto.has('sky') && <span className="auto-tag">auto</span>}
        </span>
        <Chips
          options={CLOUDS.map((c) => ({ v: c.v, title: c.d }))}
          value={sky.cloud}
          onChange={(c) => set('sky', [c, ...sky.precip].join(' '))}
        />
        <Chips
          small
          options={PRECIP.map((p) => ({ v: p.v, title: p.d }))}
          value={sky.precip}
          onChange={(p) => {
            const list = sky.precip.includes(p) ? sky.precip.filter((x) => x !== p) : [...sky.precip, p];
            set('sky', [sky.cloud, ...list].filter(Boolean).join(' '));
          }}
        />
        {sky.cloud && <span className="field-hint">{CLOUDS.find((c) => c.v === sky.cloud)?.d}{sky.precip.length ? ` · ${sky.precip.map((p) => PRECIP.find((x) => x.v === p)?.d ?? p).join(', ')}` : ''}</span>}
      </div>

      <div className="field wide">
        <span className="field-label">
          {lbl('vis')} {auto.has('vis') && <span className="auto-tag">auto</span>}
        </span>
        <Chips options={VISIBILITY.map((x) => ({ v: String(x.s), title: `${x.word} · ${x.range}` }))} value={row.vis} onChange={(x) => set('vis', x)} />
        {row.vis && <span className="field-hint">{VISIBILITY[+row.vis]?.word} · {VISIBILITY[+row.vis]?.range}</span>}
      </div>

      <div className="grid">
        {F('pressure', { inputMode: 'numeric', placeholder: '1013' })}
        {F('temp', { inputMode: 'decimal', placeholder: '°C' })}
      </div>
    </Sheet>
  );
}
