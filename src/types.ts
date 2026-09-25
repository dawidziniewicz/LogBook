export type HourField =
  | 'kk' | 'kd' | 'speed' | 'log' | 'depth' | 'sails' | 'engine'
  | 'sea' | 'wind' | 'sky' | 'vis' | 'pressure' | 'temp';

export type HourRow = Partial<Record<HourField, string>> & {
  lat?: number;
  lon?: number;
  fixAt?: number;
  /** pola wypełnione automatycznie (GPS / prognoza) */
  auto?: HourField[];
};

export type LogEvent = {
  id: string;
  time: string; // HH:MM
  watch?: string;
  text: string;
  lat?: number;
  lon?: number;
  officer?: string;
};

export type CheckEntry = { time?: string; note?: string };

export type Signature = { name?: string; image?: string; at?: number };

export type Tally = {
  port: number;
  sail: number;
  engine: number;
  total: number;
  above6: number;
  miles: number;
};

export type DayCheckKey = 'lightsOn' | 'lightsOff' | 'oil' | 'bilge' | 'water' | 'battery';

export type Day = {
  date: string; // YYYY-MM-DD
  hours: Record<number, HourRow>; // 1..24
  portOut?: string;
  portIn?: string;
  portStay?: string;
  events: LogEvent[];
  checks: Partial<Record<DayCheckKey, CheckEntry>>;
  firstOfficer?: Signature;
  captain?: Signature;
  tallyOverride?: Partial<Tally>;
};

export type Sail = { id: string; name: string; code: string; reefs: string; area: string; notes: string };

export type CrewMember = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  patent: string;
  role: string;
  nationality: string;
  docNo: string;
  birth: string;
  phone: string;
  info: string;
  watch: '' | 'I' | 'II' | 'III';
  /** opinia z rejsu */
  duties?: string;
  seasick?: string;
  resilience?: string;
  trainingFor?: string;
  opinionNotes?: string;
  /** forma gramatyczna w opinii: „uczestniczył” / „uczestniczyła” */
  form?: 'm' | 'f';
};

export type OpinionHours = Partial<Record<keyof Tally, string>>;

export type OpinionSettings = {
  series: string;
  remarks: string;
  clubHeader: string;
  sailArea: string;
  signature?: Signature;
  /** trasa na opinii: ślad z dziennika, własne zdjęcie trasy albo brak */
  routeMode?: 'track' | 'image' | 'none';
  /** logo AKŻ w nagłówku */
  akzLogo?: boolean;
  /** ręczne zestawienie godzin (puste = z dziennika) */
  hours?: OpinionHours;
  /** ręczna lista portów (pusta = z dziennika) */
  ports?: string;
};

export type YachtData = {
  rig: string;
  maker: string;
  loa: string;
  lwl: string;
  beam: string;
  draft: string;
  mass: string;
  ballast: string;
  gt: string;
  mast: string;
  engine: string;
  auxEngine: string;
};

export type VoyageStatus = 'port' | 'sea' | 'anchor';

export type Voyage = {
  id: string;
  createdAt: number;
  name: string;
  area: string;
  yachtName: string;
  owner: string;
  homePort: string;
  vhfCall: string;
  mmsi: string;
  embarkDate: string;
  embarkPort: string;
  disembarkDate: string;
  disembarkPort: string;
  yacht: YachtData;
  sails: Sail[];
  checks: Record<string, { value: string; note: string }>;
  crew: CrewMember[];
  training: { done: Record<string, boolean>; by: string; confirmed: string };
  card: { captain: string; grade: string; patent: string; phone: string; email: string; tidalPorts: string; tidalMiles: string };
  opinion?: OpinionSettings;
  status: VoyageStatus;
  statusSince?: number;
  days: Record<string, Day>;
};

export type ReminderSettings = {
  enabled: boolean;
  /** minuta godziny, o której ma przyjść przypomnienie (np. 55 = 5 min przed pełną) */
  minute: number;
  intervalSea: number;
  intervalPort: number;
  repeatMin: number;
  required: HourField[];
  sound: boolean;
};

export type Settings = {
  theme: 'auto' | 'light' | 'dark' | 'night';
  reminders: ReminderSettings;
  autoWeather: boolean;
  trackAtSea: boolean;
  view: 'auto' | 'table' | 'cards';
};
