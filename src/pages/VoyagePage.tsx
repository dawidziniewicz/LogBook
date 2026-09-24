import { useStore, useVoyage } from '../store';
import { BASIC_CHECKS, RIGS, TRAINING } from '../data/reference';
import { uid } from '../lib/time';
import { Area, Card, Chips, Field } from '../components/ui';
import type { Voyage, YachtData } from '../types';

export function VoyagePage() {
  const v = useVoyage();
  const mutate = useStore((s) => s.mutate);
  if (!v) return null;
  const set = <K extends keyof Voyage>(k: K) => (x: Voyage[K]) => mutate((vv) => void (vv[k] = x));
  const setY = (k: keyof YachtData) => (x: string) => mutate((vv) => void (vv.yacht[k] = x));

  return (
    <div className="page">
      <nav className="toc">
        <a href="#/voyage#rejs" onClick={(e) => { e.preventDefault(); document.getElementById('rejs')?.scrollIntoView(); }}>Rejs</a>
        <a href="#/voyage#jacht" onClick={(e) => { e.preventDefault(); document.getElementById('jacht')?.scrollIntoView(); }}>Jacht</a>
        <a href="#/voyage#zagle" onClick={(e) => { e.preventDefault(); document.getElementById('zagle')?.scrollIntoView(); }}>Żagle</a>
        <a href="#/voyage#info" onClick={(e) => { e.preventDefault(); document.getElementById('info')?.scrollIntoView(); }}>Sprawdzenie</a>
        <a href="#/voyage#szkolenie" onClick={(e) => { e.preventDefault(); document.getElementById('szkolenie')?.scrollIntoView(); }}>Szkolenie</a>
      </nav>

      <Card title="Dziennik jachtowy – rejs" id="rejs">
        <div className="grid">
          <Field label="Nazwa rejsu" value={v.name} onChange={set('name')} />
          <Field label="Akwen" value={v.area} onChange={set('area')} />
          <Field label="Nazwa jachtu" value={v.yachtName} onChange={set('yachtName')} />
          <Field label="Armator" value={v.owner} onChange={set('owner')} />
          <Field label="Port macierzysty" value={v.homePort} onChange={set('homePort')} />
          <Field label="Wywoływanie UKF <pseudonim>" value={v.vhfCall} onChange={set('vhfCall')} />
          <Field label="MMSI" value={v.mmsi} onChange={set('mmsi')} inputMode="numeric" />
          <Field label="Zaokrętowanie – data" type="date" value={v.embarkDate} onChange={set('embarkDate')} />
          <Field label="Zaokrętowanie – port" value={v.embarkPort} onChange={set('embarkPort')} />
          <Field label="Wyokrętowanie – data" type="date" value={v.disembarkDate} onChange={set('disembarkDate')} />
          <Field label="Wyokrętowanie – port" value={v.disembarkPort} onChange={set('disembarkPort')} />
        </div>
      </Card>

      <Card title="Podstawowe dane jachtu" id="jacht">
        <div className="field wide">
          <span className="field-label">Rodzaj jachtu</span>
          <Chips options={RIGS.map((r) => ({ v: r }))} value={v.yacht.rig} onChange={(r) => setY('rig')(v.yacht.rig === r ? '' : r)} />
        </div>
        <div className="grid">
          <Field label="Producent i typ jachtu" value={v.yacht.maker} onChange={setY('maker')} wide />
          <Field label="Długość całkowita LC [m]" value={v.yacht.loa} onChange={setY('loa')} inputMode="decimal" />
          <Field label="Długość linii wodnej LW [m]" value={v.yacht.lwl} onChange={setY('lwl')} inputMode="decimal" />
          <Field label="Szerokość maks. Bmax [m]" value={v.yacht.beam} onChange={setY('beam')} inputMode="decimal" />
          <Field label="Zanurzenie maks. Tmax [m]" value={v.yacht.draft} onChange={setY('draft')} inputMode="decimal" />
          <Field label="Masa całkowita [t]" value={v.yacht.mass} onChange={setY('mass')} inputMode="decimal" />
          <Field label="Masa balastu [t]" value={v.yacht.ballast} onChange={setY('ballast')} inputMode="decimal" />
          <Field label="Pojemność brutto GT" value={v.yacht.gt} onChange={setY('gt')} inputMode="decimal" />
          <Field label="Maks. wysokość masztu od linii wody [m]" value={v.yacht.mast} onChange={setY('mast')} inputMode="decimal" />
          <Field label="Producent, typ i moc silnika" value={v.yacht.engine} onChange={setY('engine')} wide />
          <Field label="Silnik pomocniczy" value={v.yacht.auxEngine} onChange={setY('auxEngine')} wide />
        </div>
      </Card>

      <Card
        title="Spis ożaglowania"
        id="zagle"
        actions={
          <button className="btn small" onClick={() => mutate((vv) => void vv.sails.push({ id: uid(), name: '', code: '', reefs: '', area: '', notes: '' }))}>
            + Żagiel
          </button>
        }
      >
        <p className="muted small">Oznaczenia (np. G, F, K, S) pojawią się jako przyciski przy wpisie godzinowym „Żagle”. Liczba refów pozwala wybrać G1, G2…</p>
        <div className="rows">
          {v.sails.map((s, i) => (
            <div key={s.id} className="row-card">
              <span className="lp">{i + 1}.</span>
              <div className="grid tight">
                <Field label="Nazwa żagla" value={s.name} onChange={(x) => mutate((vv) => void (vv.sails[i].name = x))} />
                <Field label="Oznaczenie" value={s.code} onChange={(x) => mutate((vv) => void (vv.sails[i].code = x.toUpperCase()))} />
                <Field label="Ilość refów" value={s.reefs} onChange={(x) => mutate((vv) => void (vv.sails[i].reefs = x))} inputMode="numeric" />
                <Field label="Powierzchnia [m²]" value={s.area} onChange={(x) => mutate((vv) => void (vv.sails[i].area = x))} inputMode="decimal" />
                <Field label="Uwagi" value={s.notes} onChange={(x) => mutate((vv) => void (vv.sails[i].notes = x))} wide />
              </div>
              <button className="icon-btn danger" aria-label="Usuń żagiel" onClick={() => mutate((vv) => void vv.sails.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Podstawowe informacje – sprawdzenie stanu jachtu i załogi" id="info">
        <div className="checklist">
          {BASIC_CHECKS.map((c) => {
            const e = v.checks[c.key] ?? { value: '', note: '' };
            const upd = (patch: Partial<typeof e>) => mutate((vv) => void (vv.checks[c.key] = { ...e, ...patch }));
            const parts = c.split ? e.value.split('|') : [];
            return (
              <div key={c.key} className="check-item">
                <div className="check-label">{c.label}</div>
                {c.split ? (
                  <div className="row gap">
                    {c.split.map((lab, j) => (
                      <input
                        key={lab}
                        placeholder={lab}
                        value={parts[j] ?? ''}
                        onChange={(ev) => {
                          const p = [parts[0] ?? '', parts[1] ?? ''];
                          p[j] = ev.target.value;
                          upd({ value: p.join('|') });
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <input placeholder="Stan / wartość" value={e.value} onChange={(ev) => upd({ value: ev.target.value })} />
                )}
                <input placeholder="Uwagi" value={e.note} onChange={(ev) => upd({ note: ev.target.value })} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Szkolenie z obsługi jachtu i bezpieczeństwa" id="szkolenie">
        {TRAINING.map((t) => {
          const done = t.items.filter((i) => v.training.done[i.id]).length;
          return (
            <details key={t.id} className="training" open={done < t.items.length}>
              <summary>
                <span>
                  {t.id}. {t.title}
                </span>
                <span className={`badge${done === t.items.length ? ' ok' : ''}`}>
                  {done}/{t.items.length}
                </span>
              </summary>
              {t.items.map((i) => (
                <label key={i.id} className="check">
                  <input type="checkbox" checked={!!v.training.done[i.id]} onChange={(e) => mutate((vv) => void (vv.training.done[i.id] = e.target.checked))} />
                  <span>
                    <b>{i.id}</b> {i.text}
                  </span>
                </label>
              ))}
            </details>
          );
        })}
        <div className="grid">
          <Field label="Szkolenie przeprowadził" value={v.training.by} onChange={(x) => mutate((vv) => void (vv.training.by = x))} />
          <Area label="Potwierdzam udział w szkoleniu (uczestnicy)" value={v.training.confirmed} onChange={(x) => mutate((vv) => void (vv.training.confirmed = x))} rows={2} />
        </div>
      </Card>
    </div>
  );
}
