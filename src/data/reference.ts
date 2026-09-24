import type { HourField } from '../types';

export const HOUR_FIELDS: { key: HourField; no: number; label: string; short: string; unit?: string; hint: string }[] = [
  { key: 'kk', no: 4, label: 'Kurs kompasowy', short: 'KK', unit: '°', hint: 'Zapytaj sternika (000–359)' },
  { key: 'kd', no: 5, label: 'Kurs nad dnem', short: 'KD', unit: '°', hint: 'COG z GPS, lub „KPL” dla kursów pilotowych' },
  { key: 'speed', no: 6, label: 'Szybkość', short: 'SZYBK.', unit: 'w', hint: 'Średnia z ostatniej godziny, 1 miejsce po przecinku' },
  { key: 'log', no: 7, label: 'Log', short: 'LOG', unit: 'Mm', hint: 'Droga od początku rejsu, np. 02,4' },
  { key: 'depth', no: 8, label: 'Głębokość', short: 'GŁĘB.', unit: 'm', hint: 'Z echosondy lub mapy' },
  { key: 'sails', no: 9, label: 'Żagle', short: 'ŻAGLE', hint: 'Skróty ze spisu ożaglowania, np. F, G1; brak = —' },
  { key: 'engine', no: 10, label: 'Silnik', short: 'SILNIK', unit: 'obr', hint: 'Obroty; brak pracy / luz = —' },
  { key: 'sea', no: 11, label: 'Stan morza', short: 'MORZE', hint: 'Skala Douglasa 0–9' },
  { key: 'wind', no: 12, label: 'Wiatr', short: 'WIATR', hint: 'Kierunek (skąd wieje) i siła °B, np. NNE 4-5' },
  { key: 'sky', no: 13, label: 'Stan nieba, opady', short: 'NIEBO', hint: 'Zachmurzenie 0–3/X + skróty opadów' },
  { key: 'vis', no: 14, label: 'Widzialność', short: 'WIDZ.', hint: 'Skala 0–9' },
  { key: 'pressure', no: 15, label: 'Ciśnienie', short: 'hPa', unit: 'hPa', hint: 'Aktualne ciśnienie' },
  { key: 'temp', no: 16, label: 'Temperatura', short: '°C', unit: '°C', hint: 'Temperatura powietrza' },
];

export const DEFAULT_REQUIRED: HourField[] = [
  'kk', 'kd', 'speed', 'log', 'sails', 'engine', 'sea', 'wind', 'sky', 'vis', 'pressure', 'temp',
];

export const RIGS = ['KET', 'SLUP', 'SLUTER', 'JOL', 'KECZ', 'SZKUNER'];

export const RHUMBS = [
  'N', 'NtE', 'NNE', 'NEtN', 'NE', 'NEtE', 'ENE', 'EtN',
  'E', 'EtS', 'ESE', 'SEtE', 'SE', 'SEtS', 'SSE', 'StE',
  'S', 'StW', 'SSW', 'SWtS', 'SW', 'SWtW', 'WSW', 'WtS',
  'W', 'WtN', 'WNW', 'NWtW', 'NW', 'NWtN', 'NNW', 'NtW',
];
export const RHUMBS_16 = RHUMBS.filter((_, i) => i % 2 === 0);

export const BEAUFORT: { b: number; kn: string; ms: string; pl: string; sea: string }[] = [
  { b: 0, kn: '0', ms: '0–0,2', pl: 'Flauta', sea: 'Gładkie' },
  { b: 1, kn: '1–3', ms: '0,3–1,5', pl: 'Powiew', sea: 'Zmarszczki na wodzie' },
  { b: 2, kn: '4–6', ms: '1,6–3,3', pl: 'Słaby wiatr', sea: 'Małe falki' },
  { b: 3, kn: '7–10', ms: '3,4–5,4', pl: 'Łagodny wiatr', sea: 'Duże falki, grzbiety szkliste' },
  { b: 4, kn: '11–16', ms: '5,5–7,9', pl: 'Umiarkowany wiatr', sea: 'Małe fale, piana na grzbietach' },
  { b: 5, kn: '17–21', ms: '8,0–10,7', pl: 'Dość silny wiatr', sea: 'Fale umiarkowane, gęste białe grzebienie' },
  { b: 6, kn: '22–27', ms: '10,8–13,8', pl: 'Silny wiatr', sea: 'Grzywacze, długa wysoka fala, bryzgi' },
  { b: 7, kn: '28–33', ms: '13,9–17,1', pl: 'Bardzo silny wiatr', sea: 'Piana układa się w pasma' },
  { b: 8, kn: '34–40', ms: '17,2–20,7', pl: 'Sztorm / wicher', sea: 'Duże fale, pasma piany' },
  { b: 9, kn: '41–47', ms: '20,8–24,4', pl: 'Silny sztorm', sea: 'Bardzo duże fale, gęsta piana' },
  { b: 10, kn: '48–55', ms: '24,5–28,4', pl: 'Bardzo silny sztorm', sea: 'Wielkie fale, morze białe' },
  { b: 11, kn: '56–63', ms: '28,5–32,6', pl: 'Gwałtowny sztorm', sea: 'Nadzwyczaj wielkie fale' },
  { b: 12, kn: '63+', ms: '32,6+', pl: 'Huragan', sea: 'Olbrzymie fale, powietrze pełne piany' },
];
/** górne granice w węzłach dla 0..11 °B */
const BF_LIMITS = [1, 3.5, 6.5, 10.5, 16.5, 21.5, 27.5, 33.5, 40.5, 47.5, 55.5, 63.5];
export const knotsToBeaufort = (kn: number) => {
  const i = BF_LIMITS.findIndex((l) => kn < l);
  return i === -1 ? 12 : i;
};

export const DOUGLAS: { s: number; h: string; max: number }[] = [
  { s: 0, h: '0,0', max: 0.01 },
  { s: 1, h: '0,0–0,1', max: 0.1 },
  { s: 2, h: '0,1–0,5', max: 0.5 },
  { s: 3, h: '0,5–1,25', max: 1.25 },
  { s: 4, h: '1,25–2,5', max: 2.5 },
  { s: 5, h: '2,5–4,0', max: 4 },
  { s: 6, h: '4,0–6,0', max: 6 },
  { s: 7, h: '6,0–9,0', max: 9 },
  { s: 8, h: '9,0–14,0', max: 14 },
  { s: 9, h: 'powyżej 14', max: Infinity },
];
export const waveToDouglas = (m: number) => DOUGLAS.find((d) => m <= d.max)!.s;

export const CLOUDS: { v: string; d: string }[] = [
  { v: '0', d: 'Brak zachmurzenia lub niewielkie' },
  { v: '1', d: '1/4 nieba zachmurzone' },
  { v: '2', d: '1/2 nieba zachmurzone' },
  { v: '3', d: '3/4 nieba zachmurzone' },
  { v: 'X', d: 'Niebo niewidoczne' },
];

export const PRECIP: { v: string; d: string }[] = [
  { v: 'D', d: 'Deszcz' },
  { v: 'MŻ', d: 'Mżawka' },
  { v: 'U', d: 'Ulewa' },
  { v: 'MG', d: 'Mgła' },
  { v: 'ŚN', d: 'Śnieg' },
  { v: 'ŚD', d: 'Śnieg z deszczem' },
  { v: 'GD', d: 'Grad' },
  { v: 'KR', d: 'Krupy śnieżne' },
  { v: 'SZK', d: 'Szkwał' },
  { v: 'GRZ', d: 'Grzmoty' },
  { v: 'BŁ', d: 'Błyskawice' },
  { v: 'OB', d: 'Odległa burza' },
  { v: 'NC', d: 'Niezwykła cisza' },
  { v: 'R', d: 'Rosa / refrakcja' },
  { v: 'SZR', d: 'Szron' },
  { v: 'HK', d: 'Halo wokół Księżyca' },
  { v: 'HS', d: 'Halo wokół Słońca' },
];

export const VISIBILITY: { s: number; word: string; cause: string; range: string; minM: number }[] = [
  { s: 0, word: 'Bardzo zła', cause: 'Wyjątkowo gęsta mgła', range: '0 – 50 m', minM: 0 },
  { s: 1, word: 'Bardzo zła', cause: 'Gęsta mgła, bardzo gęsty śnieg', range: '50 m – 0,1 Mm', minM: 50 },
  { s: 2, word: 'Zła', cause: 'Umiarkowana mgła, gęsty śnieg, intensywny deszcz', range: '0,1 – 0,3 Mm', minM: 185 },
  { s: 3, word: 'Obniżona', cause: 'Umiarkowany śnieg, silny deszcz, zamglenie', range: '0,3 – 0,5 Mm', minM: 556 },
  { s: 4, word: 'Słaba', cause: 'Słaby śnieg, umiarkowany deszcz, gęsta mżawka', range: '0,5 – 1,0 Mm', minM: 926 },
  { s: 5, word: 'Słaba', cause: 'Słaby śnieg, umiarkowany deszcz, gęsta mżawka', range: '1,0 – 2,0 Mm', minM: 1852 },
  { s: 6, word: 'Umiarkowana', cause: 'Słaby deszcz, mżawka, słabe zamglenie', range: '2,0 – 5,0 Mm', minM: 3704 },
  { s: 7, word: 'Dobra', cause: 'Zazwyczaj bez opadów i zamgleń, zmętnienie', range: '5 – 11 Mm', minM: 9260 },
  { s: 8, word: 'Bardzo dobra', cause: 'Bez opadów i zmętnień', range: '11 – 28 Mm', minM: 20372 },
  { s: 9, word: 'Niezwykle dobra', cause: 'Powietrze wyjątkowo przezroczyste', range: '> 28 Mm', minM: 51856 },
];
export const metersToVisibility = (m: number) => {
  let s = 0;
  for (const v of VISIBILITY) if (m >= v.minM) s = v.s;
  return s;
};

export const EVENT_SYMBOLS: { v: string; d: string }[] = [
  { v: '⚓', d: 'Zakotwiczenie' },
  { v: 'ZAC.', d: 'Zacumowanie' },
  { v: 'ODEJ.', d: 'Odejście od nabrzeża / z kotwicy' },
  { v: 'PR', d: 'Prawa burta' },
  { v: 'LB', d: 'Lewa burta' },
  { v: 'RF', d: 'Rufa' },
  { v: 'NB', d: 'Namiar burtowy' },
  { v: 'NK', d: 'Namiar kompasowy' },
  { v: 'NR', d: 'Namiar rzeczywisty' },
  { v: 'NRd', d: 'Namiar radiowy' },
  { v: 'NBż', d: 'Nabieżnik' },
  { v: '↑', d: 'Postawienie żagli' },
  { v: '↓', d: 'Zrzucenie żagli' },
  { v: 'X', d: 'Pozycja zliczona' },
  { v: '*', d: 'Pozycja z namiarów' },
  { v: 'Lm', d: 'Latarnia morska' },
  { v: 'Mm', d: 'Mila morska' },
  { v: 'Smg', d: 'Sygnał mgłowy' },
];

export const QUICK_EVENTS = [
  'Postawiono żagle ↑',
  'Zrzucono żagle ↓',
  'Refowanie grota',
  'Zwrot przez sztag',
  'Zwrot przez rufę',
  'Uruchomiono silnik',
  'Wyłączono silnik',
  'Zmiana kursu',
  'Zmiana wachty',
  'Pompowanie zęz',
  'Alarm „człowiek za burtą” – ćwiczenia',
  'Alarm opuszczenia jachtu – ćwiczenia',
  'Odebrano prognozę pogody',
];

export const BASIC_CHECKS: { key: string; label: string; split?: [string, string] }[] = [
  { key: 'insurance', label: 'Ubezpieczenie jachtu' },
  { key: 'bilge', label: 'Stan zęz' },
  { key: 'vhf', label: 'Działanie radiostacji VHF' },
  { key: 'safety', label: 'Ważność środków ratunkowych i pirotechnicznych' },
  { key: 'maxCrew', label: 'Dopuszczalna ilość załogi' },
  { key: 'health', label: 'Stan zdrowia załogi' },
  { key: 'crewlist', label: 'Uzupełniono crewlistę' },
  { key: 'forecast', label: 'Godziny nadawania prognozy pogody / kanał' },
  { key: 'phone', label: 'Telefon alarmowy bosmana / armatora' },
  { key: 'engineHours', label: 'Motogodziny jachtu', split: ['Początek', 'Koniec'] },
  { key: 'shipTime', label: 'Czas okrętowy' },
  { key: 'sounder', label: 'Wskazanie sondy', split: ['Poniżej kilu', 'Poniżej linii wody'] },
];

export const DAY_CHECKS: { key: 'lightsOn' | 'lightsOff' | 'oil' | 'bilge' | 'water' | 'battery'; no: number; label: string; noteLabel: string }[] = [
  { key: 'lightsOn', no: 23, label: 'Zapalenie świateł nawigacyjnych', noteLabel: 'Uwagi' },
  { key: 'lightsOff', no: 24, label: 'Zgaszenie świateł nawigacyjnych', noteLabel: 'Uwagi' },
  { key: 'oil', no: 25, label: 'Sprawdzenie poziomu oleju', noteLabel: 'III oficer' },
  { key: 'bilge', no: 26, label: 'Sprawdzenie stanu zęzy', noteLabel: 'III oficer' },
  { key: 'water', no: 27, label: 'Uzupełnienie wody', noteLabel: 'III oficer' },
  { key: 'battery', no: 28, label: 'Ładowanie akumulatora', noteLabel: 'III oficer' },
];

export const WATCH_SLOTS: [number, number][] = [
  [0, 4], [4, 8], [8, 12], [12, 14], [14, 16], [16, 20], [20, 24],
];

export const TRAINING: { id: string; title: string; items: { id: string; text: string }[] }[] = [
  {
    id: '1', title: 'Środki asekuracyjne i ratunkowe', items: [
      { id: '1.1', text: 'Pasy/kamizelki ratunkowe – gdzie się znajdują, kiedy i jak używać, budowa i wyposażenie.' },
      { id: '1.2', text: 'Szelki/kamizelki asekuracyjne – gdzie trzymać, jak używać, gdzie wpinać wąsy.' },
      { id: '1.3', text: 'Koło ratunkowe i lampka sygnalizacyjna.' },
      { id: '1.4', text: 'Lajfliny – czy przygotowano i jak używać.' },
      { id: '1.5', text: 'Tratwa ratunkowa – gdzie się znajduje, kiedy i jak używać.' },
    ],
  },
  {
    id: '2', title: 'Środki sygnalizacyjne', items: [
      { id: '2.1', text: 'Pirotechnika – lokalizacja i sposób użycia.' },
      { id: '2.2', text: 'Radiostacja VHF – podstawowe funkcje, kanał 16, moc Hi/Lo, przycisk DISTRESS.' },
      { id: '2.3', text: 'Radiopława EPIRB, SART, PLB – gdzie się znajdują, kiedy i jak używać.' },
      { id: '2.4', text: 'Inne dostępne środki łączności.' },
    ],
  },
  {
    id: '3', title: 'Alarmy – odpowiedzialność członków załogi', items: [
      { id: '3.1', text: 'Alarm „człowiek za burtą” (+ ćwiczenia po wyjściu w morze).' },
      { id: '3.2', text: 'Alarm opuszczenia statku (+ ćwiczenia po wyjściu w morze).' },
      { id: '3.3', text: 'Alarm pożarowy – środki gaśnicze, zasady postępowania.' },
      { id: '3.4', text: 'Alarm wodny – tamowanie przecieków.' },
      { id: '3.5', text: 'Odpowiedzialność oficerów za środki ratunkowe i zapasy w razie ewakuacji.' },
    ],
  },
  {
    id: '4', title: 'Obsługa jachtu', items: [
      { id: '4.1', text: 'Podstawowe węzły.' },
      { id: '4.2', text: 'Ożaglowanie i olinowanie – wybieranie i luzowanie.' },
      { id: '4.3', text: 'Bezpieczna obsługa kabestanu, korby i knag.' },
      { id: '4.4', text: 'Bezpieczeństwo podczas manewrów portowych.' },
      { id: '4.5', text: 'Praca na sterze, trzymanie kursu.' },
      { id: '4.6', text: 'Praca na żaglach – stawianie, zrzucanie, trymowanie.' },
      { id: '4.7', text: 'Praca na kotwicy – winda, oznaczenia łańcucha.' },
      { id: '4.8', text: 'Podstawowe funkcje chartplottera, przycisk MOB.' },
      { id: '4.9', text: 'Obserwacja widnokręgu, weryfikacja pozycji.' },
      { id: '4.10', text: 'Autopilot – kiedy i jak używać, jak wyłączyć.' },
      { id: '4.11', text: 'Obsługa silnika – uruchomienie, olej, manetka.' },
    ],
  },
  {
    id: '5', title: 'Tematy ogólne', items: [
      { id: '5.1', text: 'Poinformowanie kapitana o stanie zdrowia załogantów.' },
      { id: '5.2', text: 'System wachtowy – podział wacht, podwachta i nadwachta.' },
      { id: '5.3', text: 'Instalacje: kingston i prysznic, kuchenka gazowa, elektryczna, lodówka.' },
      { id: '5.4', text: 'Małe, ważne szczegóły: zabezpieczenie przed wilgocią, sztauowanie, ekwipunek w kokpicie, palenie.' },
      { id: '5.5', text: 'Bezpieczne poruszanie się na jachcie.' },
    ],
  },
  {
    id: '6', title: 'Odpowiedzialność za szkody', items: [
      { id: '6.1', text: 'Każdy uczestnik ponosi współodpowiedzialność za szkody wyrządzone na jachcie.' },
    ],
  },
];

export const PHONETIC = [
  ['A', 'Alpha'], ['B', 'Bravo'], ['C', 'Charlie'], ['D', 'Delta'], ['E', 'Echo'], ['F', 'Foxtrot'],
  ['G', 'Golf'], ['H', 'Hotel'], ['I', 'India'], ['J', 'Juliet'], ['K', 'Kilo'], ['L', 'Lima'],
  ['M', 'Mike'], ['N', 'November'], ['O', 'Oscar'], ['P', 'Papa'], ['Q', 'Quebec'], ['R', 'Romeo'],
  ['S', 'Sierra'], ['T', 'Tango'], ['U', 'Uniform'], ['V', 'Victor'], ['W', 'Whisky'], ['X', 'X-ray'],
  ['Y', 'Yankee'], ['Z', 'Zulu'], ['0', 'Zero'], ['1', 'One'], ['2', 'Two'], ['3', 'Tree'], ['4', 'Fower'],
  ['5', 'Fife'], ['6', 'Six'], ['7', 'Seven'], ['8', 'Eight'], ['9', 'Niner'],
];

export const WEEKDAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
