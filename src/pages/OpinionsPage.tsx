import { useEffect, useRef, useState } from 'react';
import { useStore, useVoyage } from '../store';
import { DEFAULT_CLUB_HEADER, DUTIES, GRADES, RESILIENCE, ROLES, SEASICK, TRAINING_FOR } from '../data/opinion';
import { RIGS } from '../data/reference';
import {
  buildOpinionsPdf,
  captainOf,
  DEFAULT_ACCENT,
  DEFAULT_TILE,
  logDays,
  logPorts,
  logTotals,
  opinionFileName,
  opinionTotals,
  suggestedStay,
  voyageDurationHours,
  type OpinionImages,
} from '../lib/opinionPdf';
import { dateKey } from '../lib/time';
import { deleteAsset, loadAsset, resizeImage, saveAsset, type AssetKind } from '../lib/photo';
import { FileActions } from '../components/FileActions';
import { PdfPreview } from '../components/PdfPreview';
import { getTrack } from '../lib/tracker';
import { voyageLine } from '../lib/voyageTrack';
import { RouteDrawer } from '../components/RouteDrawer';
import { num } from '../lib/compute';
import { uid } from '../lib/time';
import { Area, Card, Chips, Field, SignaturePad, toast } from '../components/ui';
import type { CrewMember, OpinionHours, OpinionLang, OpinionSettings, Voyage } from '../types';
import akzLogoUrl from '../assets/akz-logo.png';

const emptyOpinion = (): OpinionSettings => ({ series: '', remarks: '', clubHeader: DEFAULT_CLUB_HEADER, sailArea: '' });
const filled = (m: CrewMember) => [m.duties, m.seasick, m.resilience, m.trainingFor, m.verdict].filter(Boolean).length;
const fmt = (n: number) => String(n).replace('.', ',');

const HOURS: { k: keyof OpinionHours; label: string; unit: string }[] = [
  { k: 'sail', label: 'Pod żaglami', unit: 'h' },
  { k: 'engine', label: 'Na silniku', unit: 'h' },
  { k: 'total', label: 'Razem (żagle + silnik)', unit: 'h' },
  { k: 'tidal', label: 'Po wodach pływowych', unit: 'h' },
  { k: 'port', label: 'Postój (porty, kotwica)', unit: 'h' },
  { k: 'above6', label: 'Powyżej 6°B', unit: 'h' },
  { k: 'miles', label: 'Przebyto', unit: 'Mm' },
];
const LANGS: [OpinionLang, string][] = [
  ['pl', 'PL'],
  ['en', 'EN'],
  ['plen', 'PL / EN'],
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
  const [preview, setPreview] = useState(false);

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
  const duration = voyageDurationHours(v);
  const hasTrack = voyageLine(v, getTrack()).length > 1;

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
      setPreview(true);
    } catch (e) {
      toast(`Nie udało się utworzyć opinii: ${(e as Error).message}`, 'err', 6000);
    } finally {
      setBusy(undefined);
    }
  };
  const PdfButton = ({ k, members, label }: { k: string; members: CrewMember[]; label: string }) =>
    ready?.key === k ? (
      <div className="row gap-s wrap">
        <button className="btn" onClick={() => setPreview(true)}>
          👁 Podgląd
        </button>
        <FileActions file={ready.file} />
      </div>
    ) : (
      <button className="btn primary" disabled={!!busy} onClick={() => void generate(k, members)}>
        {busy?.key === k ? busy.step : label}
      </button>
    );

  return (
    <div className="page">
      {preview && ready && (
        <PdfPreview
          file={ready.file}
          title={ready.key === 'all' ? `Podgląd – wszystkie opinie (${v.crew.length})` : `Podgląd – ${ready.file.name.replace(/\.pdf$/, '').replace(/_/g, ' ')}`}
          onClose={() => setPreview(false)}
        />
      )}
      <Card title="Opinie z rejsu" actions={<PdfButton k="all" members={v.crew} label={`📄 Wszystkie opinie (${v.crew.length})`} />}>
        <div className="field wide">
          <span className="field-label">Język opinii</span>
          <div className="seg">
            {LANGS.map(([k, l]) => (
              <button key={k} className={(op.lang ?? 'pl') === k ? 'on' : ''} onClick={() => setOp({ lang: k })}>
                {l}
              </button>
            ))}
          </div>
          <span className="field-hint">
            {(op.lang ?? 'pl') === 'pl'
              ? 'Opinia po polsku.'
              : (op.lang ?? 'pl') === 'en'
                ? 'Crew Member’s Certificate of Passage – etykiety i wartości z list po angielsku. Uwagi wpisuj po angielsku.'
                : 'Dwujęzyczna, jak wzór PZŻ: „polski / English”. Wartości z list tłumaczą się same.'}
          </span>
        </div>
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
          <Field label="Nr rejestracyjny" value={v.yacht.regNo} onChange={(x) => setV((vv) => void (vv.yacht.regNo = x))} />
          <Field label="Port macierzysty" value={v.homePort} onChange={(x) => setV((vv) => void (vv.homePort = x))} />
          <Field
            label="Długość kadłuba Lh [m]"
            value={v.yacht.hullLength}
            onChange={(x) => setV((vv) => void (vv.yacht.hullLength = x))}
            inputMode="decimal"
            placeholder={v.yacht.loa ? `${v.yacht.loa} (LC)` : ''}
          />
          <Field label="Moc silnika [kW]" value={v.yacht.enginePower} onChange={(x) => setV((vv) => void (vv.yacht.enginePower = x))} inputMode="decimal" />
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
          <Field label="Nr pływania (wg dziennika jachtowego)" value={op.voyageNo} onChange={(x) => setOp({ voyageNo: x })} hint="Jeśli dziennik był prowadzony" />
          <Field label="Port zaokrętowania (nazwa i kraj)" value={v.embarkPort} onChange={(x) => setV((vv) => void (vv.embarkPort = x))} placeholder="np. Split, Chorwacja" />
          <Field label="Data zaokrętowania" type="date" value={v.embarkDate} onChange={(x) => setV((vv) => void (vv.embarkDate = x))} />
          <Field label="Godzina zaokrętowania" type="time" value={v.embarkTime} onChange={(x) => setV((vv) => void (vv.embarkTime = x))} />
          <Field label="Port wyokrętowania (nazwa i kraj)" value={v.disembarkPort} onChange={(x) => setV((vv) => void (vv.disembarkPort = x))} />
          <Field label="Data wyokrętowania" type="date" value={v.disembarkDate} onChange={(x) => setV((vv) => void (vv.disembarkDate = x))} />
          <Field label="Godzina wyokrętowania" type="time" value={v.disembarkTime} onChange={(x) => setV((vv) => void (vv.disembarkTime = x))} />
          <Field
            label="Odwiedzone porty (nazwa i kraj)"
            value={op.ports}
            onChange={(x) => setOp({ ports: x })}
            placeholder={logPorts(v).join(', ') || 'np. Hvar, Vis, Komiža'}
            hint="Oddziel przecinkami"
            wide
          />
          <Field
            label="W tym porty pływowe o średnim skoku pływu ≥ 1,5 m"
            value={op.tidalPorts}
            onChange={(x) => setOp({ tidalPorts: x })}
            hint="Oddziel przecinkami; puste = brak"
            wide
          />
          <Field label="Liczba dni rejsu" value={op.days} onChange={(x) => setOp({ days: x })} inputMode="numeric" placeholder={String(logDays(v))} />
        </div>
        <label className="check">
          <input type="checkbox" checked={!!op.embarkTidal} onChange={(e) => setOp({ embarkTidal: e.target.checked })} /> Port zaokrętowania jest portem pływowym (skok ≥ 1,5 m)
        </label>
        <label className="check">
          <input type="checkbox" checked={!!op.disembarkTidal} onChange={(e) => setOp({ disembarkTidal: e.target.checked })} /> Port wyokrętowania jest portem pływowym (skok ≥ 1,5 m)
        </label>
      </Card>

      <Card title="Zestawienie godzinowe rejsu">
        <div className="hours-grid">
          {HOURS.map((h) => {
            const auto = h.k === 'total' && !op.hours?.total?.trim() && (op.hours?.sail?.trim() || op.hours?.engine?.trim());
            // postój: podpowiedź z czasu rejsu (zaokrętowanie → wyokrętowanie) minus żegluga
            const stay = h.k === 'port' ? suggestedStay(v, totals.total) : undefined;
            const base = h.k === 'tidal' ? 0 : stay ?? log[h.k];
            return (
              <Field
                key={h.k}
                label={`${h.label} [${h.unit}]`}
                value={op.hours?.[h.k]}
                inputMode="decimal"
                placeholder={fmt(auto ? totals.total : base)}
                onChange={(x) => setOp({ hours: { ...op.hours, [h.k]: x } })}
              />
            );
          })}
        </div>
        <p className="muted small">
          Puste pole = podpowiedź (szara). „Razem” liczy się samo z żagli i silnika.{' '}
          {duration != null
            ? `Postój = czas rejsu ${fmt(Math.round(duration))} h (zaokrętowanie → wyokrętowanie) minus ${fmt(totals.total)} h żeglugi.`
            : 'Podaj godziny zaokrętowania i wyokrętowania, a postój policzy się sam.'}{' '}
          Na opinii: żagle {fmt(totals.sail)} h · silnik {fmt(totals.engine)} h · razem{' '}
          {fmt(totals.total)} h · pływowe {fmt(totals.tidal)} h · postój {fmt(totals.port)} h · {fmt(totals.miles)} Mm · {totals.days} dni.
        </p>
      </Card>

      <Card title="Kapitan i uwagi">
        <div className="grid">
          <Field label="Kapitan" value={v.card.captain} onChange={(x) => setV((vv) => void (vv.card.captain = x))} placeholder={cap ? `${cap.firstName} ${cap.lastName}` : ''} />
          <Field label="Stopień żeglarski kapitana" value={v.card.grade} onChange={(x) => setV((vv) => void (vv.card.grade = x))} placeholder={cap?.grade} suggestions={GRADES} />
          <Field label="Nr patentu kapitana" value={v.card.patent} onChange={(x) => setV((vv) => void (vv.card.patent = x))} placeholder={cap?.patent} />
          <Field label="Telefon" type="tel" value={v.card.phone} onChange={(x) => setV((vv) => void (vv.card.phone = x))} placeholder={cap?.phone} />
          <Field label="E-mail" type="email" value={v.card.email} onChange={(x) => setV((vv) => void (vv.card.email = x))} placeholder={cap?.email} />
          <Field label="Miejscowość (wystawienia opinii)" value={op.place} onChange={(x) => setOp({ place: x })} placeholder="np. Kraków" />
          <Field label="Data wystawienia" type="date" value={op.issueDate || dateKey()} onChange={(x) => setOp({ issueDate: x })} />
          <Area label="Uwagi kapitana o przebiegu rejsu" value={op.remarks} onChange={(x) => setOp({ remarks: x })} rows={3} />
          <Area label="Nagłówek (klub, adres)" value={op.clubHeader} onChange={(x) => setOp({ clubHeader: x })} rows={3} />
        </div>
        <SignaturePad label="Podpis kapitana (na opiniach)" value={op.signature} onChange={(sig) => setOp({ signature: sig })} />
      </Card>

      <Card title="Kolory opinii">
        <div className="color-rows">
          <ColorChoice
            label="Kolor wiodący (tytuł, nagłówki, liczby)"
            value={op.accentColor ?? DEFAULT_ACCENT}
            presets={ACCENTS}
            onChange={(c) => setOp({ accentColor: c })}
          />
          <ColorChoice label="Kolor kafelków zestawienia" value={op.tileColor ?? DEFAULT_TILE} presets={TILES} onChange={(c) => setOp({ tileColor: c })} />
        </div>
        <div className="color-preview" style={{ ['--acc' as string]: op.accentColor ?? DEFAULT_ACCENT, ['--tile' as string]: op.tileColor ?? DEFAULT_TILE }}>
          <b className="cp-title">OPINIA Z REJSU</b>
          <span className="cp-section">ZESTAWIENIE REJSU</span>
          <div className="cp-tiles">
            {['24 h', '6 h', '120 Mm'].map((x, i) => (
              <span key={x} className="cp-tile">
                <b>{x}</b>
                <small>{['Pod żaglami', 'Na silniku', 'Przebyto'][i]}</small>
              </span>
            ))}
          </div>
        </div>
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
                  ['drawn', 'Narysuj na mapie'],
                  ['image', 'Własne zdjęcie'],
                  ['none', 'Bez trasy'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={routeMode === k ? 'on' : ''} onClick={() => setOp({ routeMode: k })}>
                  {l}
                </button>
              ))}
            </div>
            {routeMode === 'track' && (
              <span className="field-hint">
                {hasTrack ? 'Mapa OpenSeaMap ze śladem GPS i pozycjami z dziennika.' : 'Brak śladu w dzienniku – wybierz „Narysuj na mapie”, żeby dodać trasę ręcznie.'}
              </span>
            )}
            {routeMode === 'drawn' && <span className="field-hint">Mapa z trasą narysowaną poniżej.</span>}
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

        {routeMode === 'drawn' && (
          <div className="field wide route-field">
            <span className="field-label">Trasa narysowana ręcznie</span>
            <RouteDrawer
              value={op.drawnRoute ?? []}
              onChange={(pts) => setOp({ drawnRoute: pts })}
              startPlace={v.embarkPort || undefined}
              fallback={getTrack().at(-1)}
            />
          </div>
        )}

        <div className="field wide">
          <span className="field-label">Kolejność obrazów na opinii (prawa kolumna)</span>
          <div className="seg wide-seg">
            <button className={(op.imageOrder ?? 'route') === 'route' ? 'on' : ''} onClick={() => setOp({ imageOrder: 'route' })}>
              🗺 Trasa, potem 📷 zdjęcie
            </button>
            <button className={op.imageOrder === 'photo' ? 'on' : ''} onClick={() => setOp({ imageOrder: 'photo' })}>
              📷 Zdjęcie, potem 🗺 trasa
            </button>
          </div>
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
                  <span className={`badge${n === 5 ? ' ok' : ''}`}>{n}/5</span>
                </button>
                {isOpen && (
                  <div className="crew-body">
                    <div className="grid">
                      <Field label="Imię" value={m.firstName} onChange={(x) => setM(i, { firstName: x })} />
                      <Field label="Nazwisko" value={m.lastName} onChange={(x) => setM(i, { lastName: x })} />
                      <Field label="Stopień żeglarski" value={m.grade} onChange={(x) => setM(i, { grade: x })} suggestions={GRADES} />
                      <Field label="Numer patentu" value={m.patent} onChange={(x) => setM(i, { patent: x })} />
                      <Field label="Pełniona funkcja" value={m.role} onChange={(x) => setM(i, { role: x })} suggestions={ROLES} />
                      <Field label="Telefon" type="tel" value={m.phone} onChange={(x) => setM(i, { phone: x })} />
                      <Field label="E-mail" type="email" value={m.email} onChange={(x) => setM(i, { email: x })} />
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
                    <div className="field wide">
                      <span className="field-label">Opinia kapitana (PZŻ)</span>
                      <Chips
                        options={[
                          { v: 'positive', label: '✓ pozytywna' },
                          { v: 'negative', label: '✗ negatywna' },
                        ]}
                        value={m.verdict}
                        onChange={(x) => setM(i, { verdict: m.verdict === x ? undefined : (x as CrewMember['verdict']) })}
                      />
                    </div>
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

const ACCENTS = ['#1f2b6e', '#3447aa', '#0f5e8c', '#1b6e6a', '#2c6e3f', '#8a1c3b', '#b4532a', '#222222'];
const TILES = ['#fbeaeb', '#e8ecfa', '#e3f1f8', '#e3f2ec', '#f6eedc', '#f1f1f4', '#fff4d6', '#ffffff'];

function ColorChoice(props: { label: string; value: string; presets: string[]; onChange: (c: string) => void }) {
  return (
    <div className="field wide">
      <span className="field-label">{props.label}</span>
      <div className="swatches">
        {props.presets.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${props.value.toLowerCase() === c ? ' on' : ''}`}
            style={{ background: c }}
            aria-label={c}
            onClick={() => props.onChange(c)}
          />
        ))}
        <label className="swatch custom" title="Własny kolor">
          <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
          <span>＋</span>
        </label>
      </div>
    </div>
  );
}
