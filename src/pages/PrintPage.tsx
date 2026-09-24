import { useMemo } from 'react';
import { useVoyage } from '../store';
import { BASIC_CHECKS, DAY_CHECKS, HOUR_FIELDS } from '../data/reference';
import { allTallies, sortedDays } from '../lib/compute';
import { fmtLat, fmtLon } from '../lib/geo';
import { fmtDate, hourLabel, weekday } from '../lib/time';
import type { Tally } from '../types';

const T: { k: keyof Tally; l: string }[] = [
  { k: 'port', l: 'Na postoju' },
  { k: 'sail', l: 'Pod żaglami' },
  { k: 'engine', l: 'Na silniku' },
  { k: 'total', l: 'Łącznie żeglugi' },
  { k: 'above6', l: 'W tym >6°B' },
  { k: 'miles', l: 'Przebyto Mm' },
];
const c = (n: number) => String(n).replace('.', ',');

export function PrintPage() {
  const v = useVoyage();
  const tallies = useMemo(() => (v ? allTallies(v) : {}), [v]);
  if (!v) return null;
  return (
    <div className="print">
      <div className="no-print row gap print-bar">
        <button className="btn primary" onClick={() => window.print()}>
          🖨 Drukuj / zapisz jako PDF
        </button>
        <a className="btn ghost" href="#/settings">
          ← Wróć
        </a>
      </div>

      <section className="p-page">
        <h1>DZIENNIK JACHTOWY</h1>
        <table className="p-kv">
          <tbody>
            <tr><th>Nazwa rejsu</th><td>{v.name}</td></tr>
            <tr><th>Akwen</th><td>{v.area}</td></tr>
            <tr><th>Nazwa jachtu</th><td>{v.yachtName}</td></tr>
            <tr><th>Armator</th><td>{v.owner}</td></tr>
            <tr><th>Port macierzysty</th><td>{v.homePort}</td></tr>
            <tr><th>Wywoływanie UKF</th><td>{v.vhfCall}</td></tr>
            <tr><th>MMSI</th><td>{v.mmsi}</td></tr>
            <tr><th>Zaokrętowanie</th><td>{v.embarkDate && fmtDate(v.embarkDate)} {v.embarkPort}</td></tr>
            <tr><th>Wyokrętowanie</th><td>{v.disembarkDate && fmtDate(v.disembarkDate)} {v.disembarkPort}</td></tr>
          </tbody>
        </table>
        <h2>Podstawowe dane jachtu</h2>
        <table className="p-kv">
          <tbody>
            <tr><th>Rodzaj jachtu</th><td>{v.yacht.rig}</td></tr>
            <tr><th>Producent i typ</th><td>{v.yacht.maker}</td></tr>
            <tr><th>LC / LW [m]</th><td>{v.yacht.loa} / {v.yacht.lwl}</td></tr>
            <tr><th>Bmax / Tmax [m]</th><td>{v.yacht.beam} / {v.yacht.draft}</td></tr>
            <tr><th>Masa / balast [t]</th><td>{v.yacht.mass} / {v.yacht.ballast}</td></tr>
            <tr><th>GT</th><td>{v.yacht.gt}</td></tr>
            <tr><th>Wysokość masztu [m]</th><td>{v.yacht.mast}</td></tr>
            <tr><th>Silnik</th><td>{v.yacht.engine}</td></tr>
            <tr><th>Silnik pomocniczy</th><td>{v.yacht.auxEngine}</td></tr>
          </tbody>
        </table>
        <h2>Spis ożaglowania</h2>
        <table className="p-grid">
          <thead><tr><th>Lp.</th><th>Nazwa</th><th>Oznaczenie</th><th>Refy</th><th>Pow.</th><th>Uwagi</th></tr></thead>
          <tbody>{v.sails.map((s, i) => <tr key={s.id}><td>{i + 1}</td><td>{s.name}</td><td>{s.code}</td><td>{s.reefs}</td><td>{s.area}</td><td>{s.notes}</td></tr>)}</tbody>
        </table>
        <h2>Podstawowe informacje</h2>
        <table className="p-grid">
          <tbody>
            {BASIC_CHECKS.map((b) => (
              <tr key={b.key}><th>{b.label}</th><td>{(v.checks[b.key]?.value ?? '').replace('|', ' / ')}</td><td>{v.checks[b.key]?.note}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {sortedDays(v).map((d) => {
        const day = v.days[d];
        const t = tallies[d];
        return (
          <section className="p-page" key={d}>
            <div className="p-dayhead">
              <span>1. DZIEŃ TYGODNIA: <b>{weekday(d)}</b></span>
              <span>2. DATA: <b>{fmtDate(d)}</b></span>
            </div>
            <table className="p-grid p-hours">
              <thead>
                <tr>
                  <th>3. GODZ.</th>
                  {HOUR_FIELDS.map((f) => <th key={f.key}>{f.no}. {f.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <tr key={h}>
                    <th>{hourLabel(h)}</th>
                    {HOUR_FIELDS.map((f) => <td key={f.key}>{day.hours[h]?.[f.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {t && (
              <table className="p-grid">
                <thead><tr><th>17. Zliczenie</th>{T.map((x) => <th key={x.k}>{x.l}</th>)}</tr></thead>
                <tbody>
                  <tr><th>Z przeniesienia</th>{T.map((x) => <td key={x.k}>{c(t.carry[x.k])}</td>)}</tr>
                  <tr><th>Z bieżącej doby</th>{T.map((x) => <td key={x.k}>{c(t.today[x.k])}</td>)}</tr>
                  <tr><th>Do przeniesienia</th>{T.map((x) => <td key={x.k}>{c(t.total[x.k])}</td>)}</tr>
                </tbody>
              </table>
            )}
            <div className="p-break" />
            <table className="p-grid">
              <tbody>
                <tr><th>18A. Port wyjścia</th><td>{day.portOut}</td><th>18B. Port wejścia</th><td>{day.portIn}</td></tr>
                <tr><th>18C. Postój w porcie</th><td colSpan={3}>{day.portStay}</td></tr>
              </tbody>
            </table>
            <table className="p-grid p-events">
              <thead><tr><th>Godz.</th><th>19. Wachta</th><th>20. Przebieg żeglugi oraz uwagi</th><th>21. Φ</th><th>Λ</th><th>22. Podpis</th></tr></thead>
              <tbody>
                {day.events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.time.replace(':', '')}</td><td>{e.watch}</td><td className="left">{e.text}</td>
                    <td>{e.lat != null ? fmtLat(e.lat) : ''}</td><td>{e.lon != null ? fmtLon(e.lon) : ''}</td><td>{e.officer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="p-grid">
              <tbody>
                {DAY_CHECKS.map((cc) => (
                  <tr key={cc.key}><th>{cc.no}. {cc.label}</th><td>{day.checks[cc.key]?.time}</td><td>{day.checks[cc.key]?.note}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="p-sigs">
              <div>29. I oficer: {day.firstOfficer?.name} {day.firstOfficer?.image && <img src={day.firstOfficer.image} alt="" />}</div>
              <div>Kapitan: {day.captain?.name} {day.captain?.image && <img src={day.captain.image} alt="" />}</div>
            </div>
          </section>
        );
      })}

      <section className="p-page">
        <h2>Crew list</h2>
        <table className="p-grid">
          <thead><tr><th>Lp.</th><th>Imię</th><th>Nazwisko</th><th>Stopień</th><th>Nr patentu</th><th>Funkcja</th><th>Narodowość</th><th>Nr dokumentu</th><th>Data i miejsce ur.</th><th>Telefon</th><th>Dodatkowe</th></tr></thead>
          <tbody>
            {v.crew.map((m, i) => (
              <tr key={m.id}><td>{i + 1}</td><td>{m.firstName}</td><td>{m.lastName}</td><td>{m.grade}</td><td>{m.patent}</td><td>{m.role}</td><td>{m.nationality}</td><td>{m.docNo}</td><td>{m.birth}</td><td>{m.phone}</td><td>{m.info}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
