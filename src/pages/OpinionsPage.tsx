import { useEffect, useRef, useState } from 'react';
import { useStore, useVoyage } from '../store';
import { DEFAULT_CLUB_HEADER, DUTIES, GRADES, RESILIENCE, ROLES, SEASICK, TRAINING_FOR } from '../data/opinion';
import { RIGS } from '../data/reference';
import { buildOpinionsPdf, captainOf, logPorts, logTotals, opinionFileName, opinionTotals, type OpinionImages } from '../lib/opinionPdf';
import { deleteAsset, loadAsset, resizeImage, saveAsset, type AssetKind } from '../lib/photo';
import { sharePdf } from '../lib/share';
import { getTrack } from '../lib/tracker';
import { num } from '../lib/compute';
import { uid } from '../lib/time';
import { Area, Card, Chips, Field, SignaturePad, toast } from '../components/ui';
import type { CrewMember, OpinionSettings, Tally, Voyage } from '../types';
import akzLogoUrl from '../assets/akz-logo.png';

const emptyOpinion = (): OpinionSettings => ({ series: '', remarks: '', clubHeader: DEFAULT_CLUB_HEADER, sailArea: '' });
const filled = (m: CrewMember) => [m.duties, m.seasick, m.resilience, m.trainingFor].filter(Boolean).length;
const fmt = (n: number) => String(n).replace('.', ',');

const HOURS: { k: keyof Tally; label: string; unit: string }[] = [
  { k: 'port', label: 'Postój', unit: 'h' },
  { k: 'sail', label: 'Na żaglach', unit: 'h' },
  { k: 'engine', label: 'Na silniku', unit: 'h' },
  { k: 'total', label: 'Suma godzin', unit: 'h' },
  { k: 'above6', label: 'Powyżej 6°B', unit: 'h' },
  { k: 'miles', label: 'Przebyto', unit: 'Mm' },
];

const newMember = (): CrewMember => ({
  id: uid(), firstName: '', lastName: '', grade: '', patent: '', role: 'Załoga', nationality: 'PL', docNo: '', birth: '', phone: '', info: '', watch: '',
});

export function OpinionsPage() {
  const v = useVoyage();
  const mutate = useStore((s) => s.mutate);
  const [imgs, setImgs] = useState<OpinionImages>({});
  const [open, setOpen] = useState<string>();
  const [busy, setBusy] = useState<{ key: string; step: string }>();
  const [ready, setReady] = useState<{ key: string; file: File }>();

  useEffect(() => {
    if (!v) return;
    void Promise.all((['photo', 'route', 'vlogo'] as AssetKind[]).map((k) => loadAsset(k, v.id))).then(([photo, route, vlogo]) => setImgs({ photo, route, vlogo }));
  }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // po każdej zmianie danych gotowy PDF jest nieaktualny
  useEffect(() => setReady(undefined), [v, imgs]);

  if (!v) return null;
  const op = { ...emptyOpinion(), ...v.opinion };
  const setOp = (patch: Partial<OpinionSettings>) => mutate((vv) => void (vv.opinion = { ...emptyOpinion(), ...vv.opinion, ...patch }));
  const setV = (fn: (vv: Voyage) => void) => mutate(fn);
  const setM = (i: number, patch: Partial<CrewMember>) => mutate((vv) => void Object.assign(vv.crew[i], patch));
  const sailSum = v.sails.reduce((s, x) => s + (isNaN(num(x.area)) ? 0 : num(x.area)), 0);
  const log = logTotals(v);
  const totals = opinionTotals(v);
  const cap = captainOf(v);
  const routeMode = op.routeMode ?? 'track';

  const setImg = async (kind: AssetKind, data?: string) => {
    if (data) await saveAsset(kind, v.id, data);
    else await deleteAsset(kind, v.id);
    setImgs((x) => ({ ...x, [kind]: data }));
  };

  const generate = async (key: string, members: CrewMember[]) => {
    if (!members.length) return toast('Dodaj przynajmniej jedną osobę do załogi', 'err');
    setReady(undefined);
    setBusy({ key, step: 'Przygotowuję…' });
    try {
      const blob = await buildOpinionsPdf(v, members, getTrack(), imgs, (step) => setBusy({ key, step }));
      const file = new File([blob], opinionFileName(v, members.length === 1 ? members[0] : undefined), { type: 'application/pdf' });
      setReady({ key, file });
      toast('PDF gotowy – dotknij „Udostępnij / zapisz”');
    } catch (e) {
      toast(`Nie udało się utworzyć opinii: ${(e as Error).message}`, 'err', 6000);
    } finally {
      setBusy(undefined);
    }
  };
  const PdfButton = ({ k, members, label }: { k: string; members: CrewMember[]; label: string }) =>
    ready?.key === k ? (
      <button className="btn primary" onClick={() => void sharePdf(ready.file)}>
        📤 Udostępnij / zapisz
      </button>
    ) : (
      <button className="btn primary" disabled={!!busy} onClick={() => void generate(k, members)}>
        {busy?.key === k ? busy.step : label}
      </button>
    );

  return (
    <div className="page">
      <Card title="Opinie z rejsu" actions={<PdfButton k="all" members={v.crew} label={`📄 Wszystkie opinie (${v.crew.length})`} />}>
        <p className="muted small">
          Każda opinia mieści się na jednej stronie A4. Wszystko możesz wpisać tutaj ręcznie – dziennik godzinowy nie jest potrzebny. Jeśli prowadzisz dziennik, puste pola uzupełnią się z
          niego same (podpowiedzi w szarym kolorze).
        </p>
      </Card>

      <Card title="Rejs i jacht">
        <div className="grid">
          <Field label="Nazwa rejsu" value={v.name} onChange={(x) => setV((vv) => void (vv.name = x))} />
          <Field label="Rejs z cyklu" value={op.series} onChange={(x) => setOp({ series: x })} placeholder="np. AGH Winter Sail Expedition" />
          <Field label="Nazwa jachtu" value={v.yachtName} onChange={(x) => setV((vv) => void (vv.yachtName = x))} />
          <Field label="Klasa jachtu (producent i typ)" value={v.yacht.maker} onChange={(x) => setV((vv) => void (vv.yacht.maker = x))} placeholder="np. Oceanis 45" />
          <Field label="Długość całkowita [m]" value={v.yacht.loa} onChange={(x) => setV((vv) => void (vv.yacht.loa = x))} inputMode="decimal" />
          <Field
            label="Powierzchnia ożaglowania [m²]"
            value={op.sailArea}
            onChange={(x) => setOp({ sailArea: x })}
            inputMode="decimal"
            placeholder={sailSum ? fmt(sailSum) : ''}
          />
        </div>
        <div className="field wide">
          <span className="field-label">Typ jachtu</span>
          <Chips small options={RIGS.map((r) => ({ v: r }))} value={v.yacht.rig} onChange={(r) => setV((vv) => void (vv.yacht.rig = vv.yacht.rig === r ? '' : r))} />
        </div>
        <div className="grid">
          <Field label="Port zaokrętowania" value={v.embarkPort} onChange={(x) => setV((vv) => void (vv.embarkPort = x))} />
          <Field label="Data zaokrętowania" type="date" value={v.embarkDate} onChange={(x) => setV((vv) => void (vv.embarkDate = x))} />
          <Field label="Port wyokrętowania" value={v.disembarkPort} onChange={(x) => setV((vv) => void (vv.disembarkPort = x))} />
          <Field label="Data wyokrętowania" type="date" value={v.disembarkDate} onChange={(x) => setV((vv) => void (vv.disembarkDate = x))} />
          <Field
            label="Odwiedzone porty"
            value={op.ports}
            onChange={(x) => setOp({ ports: x })}
            placeholder={logPorts(v).join(', ') || 'np. Gdynia, Hel, Władysławowo'}
            hint="Oddziel przecinkami"
            wide
          />
        </div>
      </Card>

      <Card title="Zestawienie godzinowe rejsu">
        <div className="hours-grid">
          {HOURS.map((h) => {
            const auto = h.k === 'total' && !op.hours?.total?.trim() && (op.hours?.sail?.trim() || op.hours?.engine?.trim());
            return (
              <Field
                key={h.k}
                label={`${h.label} [${h.unit}]`}
                value={op.hours?.[h.k]}
                inputMode="decimal"
                placeholder={fmt(auto ? totals.total : log[h.k])}
                onChange={(x) => setOp({ hours: { ...op.hours, [h.k]: x } })}
              />
            );
          })}
        </div>
        <p className="muted small">
          Puste pole = wartość z dziennika. „Suma godzin” liczy się sama z żagli i silnika. Na opinii: postój {fmt(totals.port)} h · żagle {fmt(totals.sail)} h · silnik{' '}
          {fmt(totals.engine)} h · suma {fmt(totals.total)} h · &gt;6°B {fmt(totals.above6)} h · {fmt(totals.miles)} Mm.
        </p>
      </Card>

      <Card title="Kapitan i uwagi">
        <div className="grid">
          <Field label="Kapitan" value={v.card.captain} onChange={(x) => setV((vv) => void (vv.card.captain = x))} placeholder={cap ? `${cap.firstName} ${cap.lastName}` : ''} />
          <Field label="Nr patentu kapitana" value={v.card.patent} onChange={(x) => setV((vv) => void (vv.card.patent = x))} placeholder={cap?.patent} />
          <Field label="Telefon" type="tel" value={v.card.phone} onChange={(x) => setV((vv) => void (vv.card.phone = x))} placeholder={cap?.phone} />
          <Field label="E-mail" type="email" value={v.card.email} onChange={(x) => setV((vv) => void (vv.card.email = x))} />
          <Area label="Uwagi kapitana o przebiegu rejsu" value={op.remarks} onChange={(x) => setOp({ remarks: x })} rows={3} />
          <Area label="Nagłówek (klub, adres)" value={op.clubHeader} onChange={(x) => setOp({ clubHeader: x })} rows={3} />
        </div>
        <SignaturePad label="Podpis kapitana (na opiniach)" value={op.signature} onChange={(sig) => setOp({ signature: sig })} />
      </Card>

      <Card title="Grafika na opinii">
        <label className="check logo-check">
          <input type="checkbox" checked={op.akzLogo !== false} onChange={(e) => setOp({ akzLogo: e.target.checked })} />
          <img src={akzLogoUrl} alt="" width={36} height={37} />
          <span>Dodaj logo AKŻ AGH w nagłówku</span>
        </label>

        <div className="img-grid">
          <ImagePicker
            label="Logo rejsu (opcjonalnie)"
            value={imgs.vlogo}
            contain
            onPick={async (f) => setImg('vlogo', await resizeImage(f, 800, 'image/png'))}
            onClear={() => setImg('vlogo')}
          />

          <div className="field">
            <span className="field-label">Trasa rejsu</span>
            <div className="seg wide-seg">
              {(
                [
                  ['track', 'Ślad z dziennika'],
                  ['image', 'Własne zdjęcie'],
                  ['none', 'Bez trasy'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={routeMode === k ? 'on' : ''} onClick={() => setOp({ routeMode: k })}>
                  {l}
                </button>
              ))}
            </div>
            {routeMode === 'track' && <span className="field-hint">Mapa OpenSeaMap ze śladem GPS i pozycjami z dziennika. Bez śladu – opinia bez mapy.</span>}
            {routeMode === 'image' && (
              <ImagePicker
                label=""
                value={imgs.route}
                contain
                onPick={async (f) => setImg('route', await resizeImage(f, 1800))}
                onClear={() => setImg('route')}
                hint="Np. zrzut ekranu trasy z Google Earth, Navionics lub plotera."
              />
            )}
          </div>

          <ImagePicker label="Zdjęcie załogi" value={imgs.photo} onPick={async (f) => setImg('photo', await resizeImage(f, 1600))} onClear={() => setImg('photo')} />
        </div>
      </Card>

      <Card
        title={`Załoganci (${v.crew.length})`}
        actions={
          <button
            className="btn small"
            onClick={() => {
              const m = newMember();
              mutate((vv) => void vv.crew.push(m));
              setOpen(m.id);
            }}
          >
            + Załogant
          </button>
        }
      >
        {v.crew.length === 0 && <p className="muted">Dodaj osoby, dla których chcesz wystawić opinię.</p>}
        <ul className="crew">
          {v.crew.map((m, i) => {
            const isOpen = open === m.id;
            const n = filled(m);
            const form = m.form ?? 'm';
            return (
              <li key={m.id} className={`crew-item${isOpen ? ' open' : ''}`}>
                <button className="crew-head" onClick={() => setOpen(isOpen ? undefined : m.id)}>
                  <span className="lp">{i + 1}</span>
                  <span className="crew-name">
                    {`${m.firstName} ${m.lastName}`.trim() || <span className="muted">Nowa osoba</span>}
                    <small>{[m.role, m.grade].filter(Boolean).join(' · ')}</small>
                  </span>
                  <span className={`badge${n === 4 ? ' ok' : ''}`}>{n}/4</span>
                </button>
                {isOpen && (
                  <div className="crew-body">
                    <div className="grid">
                      <Field label="Imię" value={m.firstName} onChange={(x) => setM(i, { firstName: x })} />
                      <Field label="Nazwisko" value={m.lastName} onChange={(x) => setM(i, { lastName: x })} />
                      <Field label="Stopień żeglarski" value={m.grade} onChange={(x) => setM(i, { grade: x })} list="grades" />
                      <Field label="Numer patentu" value={m.patent} onChange={(x) => setM(i, { patent: x })} />
                      <Field label="Pełniona funkcja" value={m.role} onChange={(x) => setM(i, { role: x })} list="roles-op" />
                    </div>
                    <div className="field wide">
                      <span className="field-label">Forma w opinii</span>
                      <div className="seg">
                        <button className={form === 'm' ? 'on' : ''} onClick={() => setM(i, { form: 'm', seasick: m.seasick && SEASICK.f.includes(m.seasick) ? SEASICK.m[SEASICK.f.indexOf(m.seasick)] : m.seasick })}>
                          uczestniczył
                        </button>
                        <button className={form === 'f' ? 'on' : ''} onClick={() => setM(i, { form: 'f', seasick: m.seasick && SEASICK.m.includes(m.seasick) ? SEASICK.f[SEASICK.m.indexOf(m.seasick)] : m.seasick })}>
                          uczestniczyła
                        </button>
                      </div>
                    </div>
                    <ChoiceField label={`Z obowiązków ${form === 'f' ? 'wywiązywała' : 'wywiązywał'} się`} options={DUTIES} value={m.duties} onChange={(x) => setM(i, { duties: x })} />
                    <ChoiceField label="Chorobie morskiej" options={SEASICK[form]} value={m.seasick} onChange={(x) => setM(i, { seasick: x })} />
                    <ChoiceField label="Odporność w trudnych warunkach" options={RESILIENCE} value={m.resilience} onChange={(x) => setM(i, { resilience: x })} />
                    <ChoiceField label="Nadaje się do szkolenia na stopień" options={TRAINING_FOR} value={m.trainingFor} onChange={(x) => setM(i, { trainingFor: x })} free />
                    <Area label="Uwagi kapitana o załogancie" value={m.opinionNotes} onChange={(x) => setM(i, { opinionNotes: x })} rows={3} />
                    <div className="row gap wrap">
                      <PdfButton k={m.id} members={[m]} label="📄 Opinia PDF" />
                      <button
                        className="btn ghost danger small"
                        onClick={() => confirm(`Usunąć ${`${m.firstName} ${m.lastName}`.trim() || 'tę osobę'} z załogi?`) && mutate((vv) => void vv.crew.splice(i, 1))}
                      >
                        Usuń osobę
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <datalist id="grades">
          {GRADES.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <datalist id="roles-op">
          {ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Card>
    </div>
  );
}

function ChoiceField(props: { label: string; options: string[]; value?: string; onChange: (v: string) => void; free?: boolean }) {
  return (
    <div className="field wide">
      <span className="field-label">{props.label}</span>
      <Chips small options={props.options.map((o) => ({ v: o }))} value={props.value} onChange={(o) => props.onChange(props.value === o ? '' : o)} />
      {props.free && <input value={props.value ?? ''} placeholder="lub wpisz inny" onChange={(e) => props.onChange(e.target.value)} />}
    </div>
  );
}

function ImagePicker(props: { label: string; value?: string; onPick: (f: File) => Promise<void>; onClear: () => void; contain?: boolean; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      {props.value ? (
        <img className={`crew-photo${props.contain ? ' contain' : ''}`} src={props.value} alt={props.label} />
      ) : (
        <div className="crew-photo empty">Brak obrazu</div>
      )}
      {props.hint && <span className="field-hint">{props.hint}</span>}
      <div className="row gap wrap">
        <button className="btn small" onClick={() => ref.current?.click()}>
          📷 {props.value ? 'Zmień' : 'Dodaj'}
        </button>
        {props.value && (
          <button className="btn small ghost danger" onClick={props.onClear}>
            Usuń
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await props.onPick(f);
          } catch (err) {
            toast((err as Error).message, 'err');
          }
        }}
      />
    </div>
  );
}
