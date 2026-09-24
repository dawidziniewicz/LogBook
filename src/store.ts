import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Day, HourField, HourRow, LogEvent, Settings, Voyage } from './types';
import { DEFAULT_REQUIRED } from './data/reference';
import { dateKey, uid } from './lib/time';

/** zapis do IndexedDB z opóźnieniem, żeby nie zapisywać przy każdym znaku */
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const flush = () => {
  timer = undefined;
  for (const [k, v] of pending) void idbSet(k, v);
  pending.clear();
};
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}
const idbStorage: StateStorage = {
  getItem: async (k) => pending.get(k) ?? (await idbGet<string>(k)) ?? null,
  setItem: (k, v) => {
    pending.set(k, v);
    if (!timer) timer = setTimeout(flush, 400);
  },
  removeItem: (k) => {
    pending.delete(k);
    return idbDel(k);
  },
};

export const emptyDay = (date: string): Day => ({ date, hours: {}, events: [], checks: {} });

export function newVoyage(): Voyage {
  return {
    id: uid(),
    createdAt: Date.now(),
    name: '',
    area: '',
    yachtName: '',
    owner: '',
    homePort: '',
    vhfCall: '',
    mmsi: '',
    embarkDate: dateKey(),
    embarkPort: '',
    disembarkDate: '',
    disembarkPort: '',
    yacht: { rig: '', maker: '', loa: '', lwl: '', beam: '', draft: '', mass: '', ballast: '', gt: '', mast: '', engine: '', auxEngine: '' },
    sails: [
      { id: uid(), name: 'Grot', code: 'G', reefs: '2', area: '', notes: '' },
      { id: uid(), name: 'Fok', code: 'F', reefs: '', area: '', notes: '' },
    ],
    checks: {},
    crew: [],
    training: { done: {}, by: '', confirmed: '' },
    card: { captain: '', grade: '', patent: '', phone: '', email: '', tidalPorts: '', tidalMiles: '' },
    status: 'port',
    days: {},
  };
}

export const defaultSettings: Settings = {
  theme: 'auto',
  reminders: { enabled: true, minute: 0, intervalSea: 1, intervalPort: 4, repeatMin: 10, required: DEFAULT_REQUIRED, sound: true },
  autoWeather: true,
  trackAtSea: true,
  view: 'auto',
};

type State = {
  voyages: Voyage[];
  activeId?: string;
  settings: Settings;
  /** klucz ostatnio wysłanego przypomnienia (data+godzina+nr powtórzenia) */
  lastReminder?: string;
  hydrated: boolean;

  active: () => Voyage | undefined;
  createVoyage: () => string;
  setActive: (id: string) => void;
  deleteVoyage: (id: string) => void;
  importVoyage: (v: Voyage) => void;
  mutate: (fn: (v: Voyage) => void) => void;
  mutateDay: (date: string, fn: (d: Day) => void) => void;
  setHour: (date: string, hour: number, patch: Partial<HourRow>, auto?: HourField[]) => void;
  addEvent: (date: string, ev: Omit<LogEvent, 'id'>) => void;
  setSettings: (fn: (s: Settings) => void) => void;
  setLastReminder: (k: string) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      voyages: [],
      settings: defaultSettings,
      hydrated: false,

      active: () => get().voyages.find((v) => v.id === get().activeId),
      createVoyage: () => {
        const v = newVoyage();
        set((s) => ({ voyages: [...s.voyages, v], activeId: v.id }));
        return v.id;
      },
      setActive: (id) => set({ activeId: id }),
      deleteVoyage: (id) =>
        set((s) => {
          const voyages = s.voyages.filter((v) => v.id !== id);
          return { voyages, activeId: s.activeId === id ? voyages[voyages.length - 1]?.id : s.activeId };
        }),
      importVoyage: (v) =>
        set((s) => {
          const exists = s.voyages.some((x) => x.id === v.id);
          const voyage = exists ? { ...v, id: uid(), name: `${v.name} (kopia)` } : v;
          return { voyages: [...s.voyages, voyage], activeId: voyage.id };
        }),
      mutate: (fn) =>
        set((s) => {
          const i = s.voyages.findIndex((v) => v.id === s.activeId);
          if (i < 0) return {};
          const copy = structuredClone(s.voyages[i]);
          fn(copy);
          const voyages = s.voyages.slice();
          voyages[i] = copy;
          return { voyages };
        }),
      mutateDay: (date, fn) =>
        get().mutate((v) => {
          const d = (v.days[date] ??= emptyDay(date));
          fn(d);
        }),
      setHour: (date, hour, patch, auto) =>
        get().mutateDay(date, (d) => {
          const row = (d.hours[hour] ??= {});
          Object.assign(row, patch);
          const autoSet = new Set(row.auto ?? []);
          for (const k of Object.keys(patch) as HourField[]) autoSet.delete(k);
          for (const k of auto ?? []) autoSet.add(k);
          row.auto = [...autoSet];
        }),
      addEvent: (date, ev) =>
        get().mutateDay(date, (d) => {
          d.events.push({ ...ev, id: uid() });
          d.events.sort((a, b) => a.time.localeCompare(b.time));
        }),
      setSettings: (fn) =>
        set((s) => {
          const settings = structuredClone(s.settings);
          fn(settings);
          return { settings };
        }),
      setLastReminder: (k) => set({ lastReminder: k }),
    }),
    {
      name: 'logbook-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ voyages: s.voyages, activeId: s.activeId, settings: s.settings, lastReminder: s.lastReminder }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: {
            ...defaultSettings,
            ...p.settings,
            reminders: { ...defaultSettings.reminders, ...p.settings?.reminders },
          },
        };
      },
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const useVoyage = () => useStore((s) => s.voyages.find((v) => v.id === s.activeId));
