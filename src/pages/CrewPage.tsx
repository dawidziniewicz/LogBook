import { useState } from 'react';
import { useStore, useVoyage } from '../store';
import { WATCH_SLOTS } from '../data/reference';
import { galleyWatch, sortedDays, watchAt } from '../lib/compute';
import { addDays, dateKey, fmtDate, uid } from '../lib/time';
import { Card, Field } from '../components/ui';
import type { CrewMember } from '../types';
import { GRADES, ROLES } from '../data/opinion';

const emptyMember = (): CrewMember => ({
  id: uid(), firstName: '', lastName: '', grade: '', patent: '', role: '', nationality: 'PL', docNo: '', birth: '', phone: '', info: '', watch: '',
});
const p2 = (n: number) => String(n).padStart(2, '0');

export function CrewPage() {
  const v = useVoyage();
  const mutate = useStore((s) => s.mutate);
  const [open, setOpen] = useState<string | undefined>();
  if (!v) return null;

  const days = (() => {
    const known = sortedDays(v);
    const start = v.embarkDate || known[0] || dateKey();
    const end = v.disembarkDate || [known[known.length - 1] ?? start, addDays(start, 6)].sort()[1];
    const out: string[] = [];
    for (let d = start; d <= end && out.length < 60; d = addDays(d, 1)) out.push(d);
    return out;
  })();
  const today = dateKey();

  return (
    <div className="page">
      <Card
        title={`Crew list (${v.crew.length})`}
        actions={
          <div className="row gap-s">
          <a className="btn small ghost" href="#/opinions">
            📝 Opinie
          </a>
          <button
            className="btn small"
            onClick={() => {
              const m = emptyMember();
              mutate((vv) => void vv.crew.push(m));
              setOpen(m.id);
            }}
          >
            + Osoba
          </button>
          </div>
        }
      >
        {v.crew.length === 0 && <p className="muted">Dodaj członków załogi – dane trafią do crew listy i karty rejsu.</p>}
        <ul className="crew">
          {v.crew.map((c, i) => {
            const upd = (k: keyof CrewMember) => (x: string) => mutate((vv) => void ((vv.crew[i] as Record<string, string>)[k] = x));
            const isOpen = open === c.id;
            return (
              <li key={c.id} className={`crew-item${isOpen ? ' open' : ''}`}>
                <button className="crew-head" onClick={() => setOpen(isOpen ? undefined : c.id)}>
                  <span className="lp">{i + 1}</span>
                  <span className="crew-name">
                    {c.firstName || c.lastName ? `${c.firstName} ${c.lastName}` : <span className="muted">Nowa osoba</span>}
                    <small>{[c.role, c.grade].filter(Boolean).join(' · ')}</small>
                  </span>
                  {c.watch && <span className="badge">W {c.watch}</span>}
                </button>
                {isOpen && (
                  <div className="crew-body">
                    <div className="grid">
                      <Field label="Imię" value={c.firstName} onChange={upd('firstName')} />
                      <Field label="Nazwisko" value={c.lastName} onChange={upd('lastName')} />
                      <Field label="Funkcja na jachcie" value={c.role} onChange={upd('role')} suggestions={ROLES} />
                      <label className="field">
                        <span className="field-label">Wachta</span>
                        <select value={c.watch} onChange={(e) => upd('watch')(e.target.value)}>
                          <option value="">—</option>
                          <option value="I">I</option>
                          <option value="II">II</option>
                          <option value="III">III</option>
                        </select>
                      </label>
                      <Field label="Stopień żeglarski" value={c.grade} onChange={upd('grade')} suggestions={GRADES} />
                      <Field label="Numer patentu" value={c.patent} onChange={upd('patent')} />
                      <Field label="Narodowość" value={c.nationality} onChange={upd('nationality')} />
                      <Field label="Nr dokumentu (paszport/ID)" value={c.docNo} onChange={upd('docNo')} />
                      <Field label="Data i miejsce urodzenia" value={c.birth} onChange={upd('birth')} />
                      <Field label="Telefon" type="tel" value={c.phone} onChange={upd('phone')} />
                      <Field label="E-mail" type="email" value={c.email ?? ''} onChange={upd('email')} />
                      <Field label="Dodatkowe informacje" value={c.info} onChange={upd('info')} wide />
                    </div>
                    <div className="row gap">
                      <button className="btn ghost small" disabled={i === 0} onClick={() => mutate((vv) => void vv.crew.splice(i - 1, 0, vv.crew.splice(i, 1)[0]))}>
                        ↑ W górę
                      </button>
                      <button
                        className="btn ghost small danger"
                        onClick={() => confirm('Usunąć tę osobę z listy?') && mutate((vv) => void vv.crew.splice(i, 1))}
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Wachty">
        <div className="watch-teams">
          {(['I', 'II', 'III'] as const).map((w) => (
            <div key={w} className="watch-team">
              <h3>Wachta {w}</h3>
              <ul>
                {v.crew.filter((c) => c.watch === w).map((c) => (
                  <li key={c.id}>
                    {c.firstName} {c.lastName} {c.role && <small className="muted">({c.role})</small>}
                  </li>
                ))}
                {!v.crew.some((c) => c.watch === w) && <li className="muted small">przypisz osoby powyżej</li>}
              </ul>
            </div>
          ))}
        </div>
        <div className="table-wrap">
          <table className="watch-table">
            <thead>
              <tr>
                <th>Dzień \ godz.</th>
                {WATCH_SLOTS.map(([a, b]) => (
                  <th key={a}>
                    {p2(a)}00–{p2(b % 24)}00
                  </th>
                ))}
                <th>Kambuz</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d} className={d === today ? 'now' : ''}>
                  <th>{fmtDate(d).slice(0, 5)}</th>
                  {WATCH_SLOTS.map(([a]) => {
                    const w = watchAt(v, d, `${p2(a)}:00`);
                    return (
                      <td key={a} className={`w w-${w}`}>
                        {w}
                      </td>
                    );
                  })}
                  <td className={`w w-${galleyWatch(v, d)}`}>{galleyWatch(v, d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Posiłki: 0815 śniadanie · 1500 obiad · 2015 kolacja. Przekazanie wachty 10 minut przed rozpoczęciem wachty pokładowej. Numer wachty jest wpisywany automatycznie do pola 19.
        </p>
      </Card>
    </div>
  );
}
