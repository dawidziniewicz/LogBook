import { useMemo } from 'react';
import { useStore, useVoyage } from '../store';
import { allTallies, sortedDays } from '../lib/compute';
import { fmtDate } from '../lib/time';
import { Card, Field, Stat } from '../components/ui';
import { VoyageMap } from '../components/VoyageMap';

const c = (n: number) => String(n).replace('.', ',');

export function SummaryPage() {
  const v = useVoyage();
  const mutate = useStore((s) => s.mutate);
  const tallies = useMemo(() => (v ? allTallies(v) : {}), [v]);
  if (!v) return null;
  const days = sortedDays(v);
  const total = days.length ? tallies[days[days.length - 1]].total : undefined;
  const ports = [...new Set(days.flatMap((d) => [v.days[d].portOut, v.days[d].portStay, v.days[d].portIn]).flatMap((p) => (p ? p.split(',') : [])).map((p) => p.trim()).filter(Boolean))];
  const setCard = (k: keyof typeof v.card) => (x: string) => mutate((vv) => void (vv.card[k] = x));
  const captain = v.crew.find((m) => /kapitan/i.test(m.role));

  return (
    <div className="page">
      <Card title="Karta rejsu">
        <div className="stats">
          <Stat label="dni rejsu" value={days.length} />
          <Stat label="Mm przebyto" value={total ? c(total.miles) : 0} />
          <Stat label="h żeglugi" value={total?.total ?? 0} sub={total ? `⛵ ${total.sail} · ⚙️ ${total.engine}` : undefined} />
          <Stat label="h postoju" value={total?.port ?? 0} />
          <Stat label="h > 6°B" value={total?.above6 ?? 0} />
          <Stat label="porty" value={ports.length} />
        </div>
        <div className="grid">
          <Field label="Kapitan jachtu" value={v.card.captain || (captain ? `${captain.firstName} ${captain.lastName}` : '')} onChange={setCard('captain')} />
          <Field label="Stopień żeglarski" value={v.card.grade || captain?.grade} onChange={setCard('grade')} />
          <Field label="Nr patentu" value={v.card.patent || captain?.patent} onChange={setCard('patent')} />
          <Field label="Telefon" value={v.card.phone || captain?.phone} onChange={setCard('phone')} type="tel" />
          <Field label="E-mail" value={v.card.email} onChange={setCard('email')} type="email" />
          <Field label="Liczba odwiedzonych portów pływowych" value={v.card.tidalPorts} onChange={setCard('tidalPorts')} inputMode="numeric" />
          <Field label="Mile po wodach pływowych" value={v.card.tidalMiles} onChange={setCard('tidalMiles')} inputMode="decimal" />
        </div>
        <dl className="kv">
          <dt>Jacht</dt>
          <dd>
            {v.yachtName || '—'} {v.yacht.maker && `(${v.yacht.maker})`} · długość {v.yacht.loa || '—'} m · silnik {v.yacht.engine || '—'} · GT {v.yacht.gt || '—'}
          </dd>
          <dt>Zaokrętowanie</dt>
          <dd>
            {v.embarkDate ? fmtDate(v.embarkDate) : '—'} {v.embarkPort}
          </dd>
          <dt>Wyokrętowanie</dt>
          <dd>
            {v.disembarkDate ? fmtDate(v.disembarkDate) : '—'} {v.disembarkPort}
          </dd>
          <dt>Odwiedzane porty</dt>
          <dd>{ports.join(', ') || '—'}</dd>
          <dt>Uczestnicy rejsu</dt>
          <dd>{v.crew.map((m) => `${m.firstName} ${m.lastName}${m.role ? ` (${m.role})` : ''}`).join(', ') || '—'}</dd>
        </dl>
      </Card>

      <Card title="Ślad rejsu" actions={<a className="btn small ghost" href="#/map">Otwórz mapę →</a>}>
        <VoyageMap className="summary-map" />
      </Card>

      <Card title="Zestawienie dobowe">
        <div className="table-wrap">
          <table className="tally">
            <thead>
              <tr>
                <th>Data</th>
                <th>Trasa</th>
                <th>Postój</th>
                <th>Żagle</th>
                <th>Silnik</th>
                <th>Łącznie</th>
                <th>&gt;6°B</th>
                <th>Mm</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const t = tallies[d].today;
                const day = v.days[d];
                return (
                  <tr key={d}>
                    <th>
                      <a href={`#/day/${d}`}>{fmtDate(d)}</a>
                    </th>
                    <td className="left">{[day.portOut, day.portStay, day.portIn].filter(Boolean).join(' → ')}</td>
                    <td>{t.port}</td>
                    <td>{t.sail}</td>
                    <td>{t.engine}</td>
                    <td>{t.total}</td>
                    <td>{t.above6}</td>
                    <td>{c(t.miles)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
