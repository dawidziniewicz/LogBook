import { useEffect, useRef, useState } from 'react';
import { useStore, useVoyage } from '../store';
import { DEFAULT_CLUB_HEADER, DUTIES, GRADES, RESILIENCE, ROLES, SEASICK, TRAINING_FOR } from '../data/opinion';
import { buildOpinionsPdf, opinionFileName } from '../lib/opinionPdf';
import { deletePhoto, loadPhoto, resizePhoto, savePhoto } from '../lib/photo';
import { sharePdf } from '../lib/share';
import { getTrack } from '../lib/tracker';
import { num } from '../lib/compute';
import { Area, Card, Chips, Field, SignaturePad, toast } from '../components/ui';
import type { CrewMember, OpinionSettings } from '../types';

const emptyOpinion = (): OpinionSettings => ({ series: '', remarks: '', clubHeader: DEFAULT_CLUB_HEADER, sailArea: '' });
const filled = (m: CrewMember) => [m.duties, m.seasick, m.resilience, m.trainingFor].filter(Boolean).length;

export function OpinionsPage() {
  const v = useVoyage();
  const mutate = useStore((s) => s.mutate);
  const [photo, setPhoto] = useState<string>();
  const [open, setOpen] = useState<string>();
  const [busy, setBusy] = useState<{ key: string; step: string }>();
  const [ready, setReady] = useState<{ key: string; file: File }>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (v) void loadPhoto(v.id).then(setPhoto);
  }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // po każdej zmianie danych gotowy PDF jest nieaktualny
  useEffect(() => setReady(undefined), [v]);

  if (!v) return null;
  const op = { ...emptyOpinion(), ...v.opinion };
  const setOp = (patch: Partial<OpinionSettings>) => mutate((vv) => void (vv.opinion = { ...emptyOpinion(), ...vv.opinion, ...patch }));
  const setM = (i: number, patch: Partial<CrewMember>) => mutate((vv) => void Object.assign(vv.crew[i], patch));
  const sailSum = v.sails.reduce((s, x) => s + (isNaN(num(x.area)) ? 0 : num(x.area)), 0);

  const generate = async (key: string, members: CrewMember[]) => {
    if (!members.length) return toast('Dodaj załogę w zakładce Załoga', 'err');
    setReady(undefined);
    setBusy({ key, step: 'Przygotowuję…' });
    try {
      const blob = await buildOpinionsPdf(v, members, getTrack(), photo, (step) => setBusy({ key, step }));
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
          Każda opinia mieści się na jednej stronie A4: dane załoganta, jachtu i rejsu, zestawienie godzin z dziennika, ślad rejsu na mapie i zdjęcie załogi. Godziny, mile, porty i skład
          załogi uzupełniają się same z dziennika.
        </p>
      </Card>

      <Card title="Wspólne dla wszystkich opinii">
        <div className="grid">
          <Field label="Rejs z cyklu" value={op.series} onChange={(x) => setOp({ series: x })} placeholder={v.name || 'np. AGH Winter Sail Expedition'} />
          <Field
            label="Powierzchnia ożaglowania [m²]"
            value={op.sailArea}
            onChange={(x) => setOp({ sailArea: x })}
            inputMode="decimal"
            placeholder={sailSum ? String(sailSum).replace('.', ',') : 'z spisu żagli'}
            hint="Puste = suma ze spisu ożaglowania"
          />
          <Area label="Uwagi kapitana o przebiegu rejsu" value={op.remarks} onChange={(x) => setOp({ remarks: x })} rows={3} />
          <Area label="Nagłówek (klub, adres)" value={op.clubHeader} onChange={(x) => setOp({ clubHeader: x })} rows={3} />
        </div>

        <div className="photo-row">
          <div className="field wide">
            <span className="field-label">Zdjęcie załogi</span>
            {photo ? <img className="crew-photo" src={photo} alt="Zdjęcie załogi" /> : <div className="crew-photo empty">Brak zdjęcia</div>}
            <div className="row gap wrap">
              <button className="btn" onClick={() => fileRef.current?.click()}>
                📷 {photo ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
              </button>
              {photo && (
                <button
                  className="btn ghost danger"
                  onClick={async () => {
                    await deletePhoto(v.id);
                    setPhoto(undefined);
                    setReady(undefined);
                  }}
                >
                  Usuń
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const data = await resizePhoto(f);
                  await savePhoto(v.id, data);
                  setPhoto(data);
                  setReady(undefined);
                } catch (err) {
                  toast((err as Error).message, 'err');
                }
              }}
            />
          </div>
          <SignaturePad label="Podpis kapitana (na opiniach)" value={op.signature} onChange={(sig) => setOp({ signature: sig })} />
        </div>
      </Card>

      <Card title={`Załoganci (${v.crew.length})`}>
        {v.crew.length === 0 && (
          <p className="muted">
            Najpierw dodaj załogę w zakładce <a href="#/crew">Załoga</a>.
          </p>
        )}
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
                    {`${m.firstName} ${m.lastName}`.trim() || <span className="muted">Bez nazwiska</span>}
                    <small>{[m.role, m.grade].filter(Boolean).join(' · ')}</small>
                  </span>
                  <span className={`badge${n === 4 ? ' ok' : ''}`}>{n}/4</span>
                </button>
                {isOpen && (
                  <div className="crew-body">
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
                    <div className="grid">
                      <Field label="Stopień żeglarski" value={m.grade} onChange={(x) => setM(i, { grade: x })} list="grades" />
                      <Field label="Numer patentu" value={m.patent} onChange={(x) => setM(i, { patent: x })} />
                      <Field label="Pełniona funkcja" value={m.role} onChange={(x) => setM(i, { role: x })} list="roles-op" />
                    </div>
                    <ChoiceField label={`Z obowiązków ${form === 'f' ? 'wywiązywała' : 'wywiązywał'} się`} options={DUTIES} value={m.duties} onChange={(x) => setM(i, { duties: x })} />
                    <ChoiceField label="Chorobie morskiej" options={SEASICK[form]} value={m.seasick} onChange={(x) => setM(i, { seasick: x })} />
                    <ChoiceField label="Odporność w trudnych warunkach" options={RESILIENCE} value={m.resilience} onChange={(x) => setM(i, { resilience: x })} />
                    <ChoiceField label="Nadaje się do szkolenia na stopień" options={TRAINING_FOR} value={m.trainingFor} onChange={(x) => setM(i, { trainingFor: x })} free />
                    <Area label="Uwagi kapitana o załogancie" value={m.opinionNotes} onChange={(x) => setM(i, { opinionNotes: x })} rows={3} />
                    <div className="row gap wrap">
                      <PdfButton k={m.id} members={[m]} label="📄 Opinia PDF" />
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
