import { useEffect, useState } from 'react';
import { useVoyage } from '../store';
import { BEAUFORT, CLOUDS, DOUGLAS, EVENT_SYMBOLS, PHONETIC, PRECIP, VISIBILITY } from '../data/reference';
import { fmtLat, fmtLon, getPosition } from '../lib/geo';
import { lastFix, subscribeTrack } from '../lib/tracker';
import { AsyncButton, Card } from '../components/ui';

type Tab = 'ukf' | 'skale' | 'symbole' | 'alfabet';

export function ReferencePage() {
  const [tab, setTab] = useState<Tab>('ukf');
  return (
    <div className="page">
      <div className="seg wide-seg">
        {(
          [
            ['ukf', 'Wywołania UKF'],
            ['skale', 'Skale'],
            ['symbole', 'Symbole'],
            ['alfabet', 'Alfabet'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'ukf' && <Vhf />}
      {tab === 'skale' && <Scales />}
      {tab === 'symbole' && (
        <Card title="Symbole do przebiegu żeglugi">
          <table className="ref">
            <tbody>
              {EVENT_SYMBOLS.map((s) => (
                <tr key={s.v}>
                  <th>{s.v}</th>
                  <td>{s.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {tab === 'alfabet' && (
        <Card title="Alfabet fonetyczny">
          <div className="phonetic">
            {PHONETIC.map(([a, b]) => (
              <div key={a}>
                <b>{a}</b> {b}
              </div>
            ))}
          </div>
          <table className="ref">
            <tbody>
              <tr><th>Kanał 16</th><td>Wywołanie i łączność w niebezpieczeństwie – obowiązkowy nasłuch</td></tr>
              <tr><th>Kanał 06</th><td>Bezpieczeństwo operacji</td></tr>
              <tr><th>Kanał 09</th><td>Ogólny kanał wywoławczy</td></tr>
              <tr><th>Kanał 13</th><td>Statek – statek, mostek</td></tr>
              <tr><th>Kanał 70</th><td>Alarmy DSC (tylko cyfrowo)</td></tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Vhf() {
  const v = useVoyage();
  const [pos, setPos] = useState<{ lat: number; lon: number } | undefined>(lastFix());
  useEffect(() => {
    const off = subscribeTrack(() => setPos((p) => p ?? lastFix()));
    return () => void off();
  }, []);
  const name = v?.yachtName ? `S/Y ${v.yachtName.toUpperCase()}` : '[NAZWA JACHTU]';
  const call = `${name}${v?.vhfCall ? `, ${v.vhfCall}` : ''}${v?.mmsi ? `, MMSI ${v.mmsi}` : ''}`;
  const p = pos ? `${fmtLat(pos.lat)} ${fmtLon(pos.lon)}` : '[POZYCJA]';
  const crew = v?.crew.length ? `${v.crew.length} PERSONS ON BOARD` : '[LICZBA OSÓB NA POKŁADZIE]';
  return (
    <>
      <Card title="Pozycja do komunikatu">
        <p className="mono big-pos">{p}</p>
        <AsyncButton
          className="btn primary"
          onClick={async () => {
            const f = await getPosition();
            setPos(f);
          }}
        >
          📍 Aktualna pozycja
        </AsyncButton>
      </Card>
      <Card title="MAYDAY – zagrożenie życia" className="alert-card">
        <p className="muted small">Najpierw naciśnij raz czerwony przycisk DISTRESS (DSC). Następnie kanał 16, mów WOLNO i WYRAŹNIE:</p>
        <pre className="script">{`MAYDAY, MAYDAY, MAYDAY
THIS IS ${name}, ${name}, ${name}${v?.mmsi ? `, MMSI ${v.mmsi}` : ''}
MAYDAY ${call}
MY POSITION IS ${p}
MY VESSEL IS [RODZAJ ZAGROŻENIA]
I NEED [RODZAJ POMOCY]
I HAVE ${crew}, [INNE INFORMACJE]
OVER`}</pre>
      </Card>
      <Card title="PAN-PAN – pilna pomoc">
        <p className="muted small">Najpierw URGENCY ALERT przez DSC, następnie kanał 16:</p>
        <pre className="script">{`PAN-PAN, PAN-PAN, PAN-PAN
ALL STATIONS, ALL STATIONS, ALL STATIONS
THIS IS ${name}, ${name}, ${name}${v?.mmsi ? `, MMSI ${v.mmsi}` : ''}
MY POSITION IS ${p}
I HAVE [POWÓD]
I NEED [RODZAJ POMOCY]
OVER`}</pre>
      </Card>
      <Card title="SECURITE – bezpieczeństwo żeglugi">
        <pre className="script">{`SECURITE, SECURITE, SECURITE
ALL STATIONS, ALL STATIONS, ALL STATIONS
THIS IS ${name}, ${name}, ${name}
FOR URGENT WARNING GO TO CHANNEL [67]
OVER`}</pre>
      </Card>
      <Card title="MAYDAY RELAY">
        <pre className="script">{`MAYDAY RELAY, MAYDAY RELAY, MAYDAY RELAY
THIS IS ${name}, ${name}, ${name}
MAYDAY [NAZWA JEDNOSTKI W NIEBEZPIECZEŃSTWIE]
POSITION [JEJ POZYCJA]
THEY HAVE [CHARAKTER NIEBEZPIECZEŃSTWA / POTRZEBNA POMOC]
OVER`}</pre>
      </Card>
      <Card title="SEELONCE MAYDAY / SEELONCE FEENEE">
        <pre className="script">{`MAYDAY
ALL STATIONS, ALL STATIONS, ALL STATIONS
THIS IS [JEDNOSTKA PROWADZĄCA AKCJĘ]
MAYDAY [NAZWA JEDNOSTKI WZYWAJĄCEJ POMOCY]
SEELONCE MAYDAY  (lub po akcji: SEELONCE FEENEE)
TIME [GODZINA]
OVER`}</pre>
      </Card>
    </>
  );
}

function Scales() {
  return (
    <>
      <Card title="Siła wiatru – skala Beauforta">
        <div className="table-wrap">
          <table className="ref">
            <thead>
              <tr><th>°B</th><th>w</th><th>m/s</th><th>Opis</th><th>Na morzu</th></tr>
            </thead>
            <tbody>
              {BEAUFORT.map((b) => (
                <tr key={b.b} className={b.b > 6 ? 'hot' : ''}>
                  <th>{b.b}</th><td>{b.kn}</td><td>{b.ms}</td><td>{b.pl}</td><td>{b.sea}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Stan morza – skala Douglasa">
        <table className="ref">
          <thead><tr><th>Stan</th><th>Wysokość fali [m]</th></tr></thead>
          <tbody>{DOUGLAS.map((d) => <tr key={d.s}><th>{d.s}</th><td>{d.h}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Widzialność (STCW)">
        <div className="table-wrap">
          <table className="ref">
            <thead><tr><th>St.</th><th>Określenie</th><th>Przyczyna</th><th>Zasięg</th></tr></thead>
            <tbody>{VISIBILITY.map((x) => <tr key={x.s}><th>{x.s}</th><td>{x.word}</td><td>{x.cause}</td><td>{x.range}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Stan nieba i opady">
        <table className="ref">
          <tbody>{CLOUDS.map((x) => <tr key={x.v}><th>{x.v}</th><td>{x.d}</td></tr>)}</tbody>
        </table>
        <div className="phonetic">
          {PRECIP.map((x) => <div key={x.v}><b>{x.v}</b> {x.d}</div>)}
        </div>
      </Card>
    </>
  );
}
