import { useStore } from '../store';
import { HOUR_FIELDS } from '../data/reference';
import { missingFields } from './compute';
import { hourLabel, rowForTime, fmtDate } from './time';
import type { Settings, VoyageStatus } from '../types';

export type ReminderEvent = { date: string; hour: number; missing: string[] };
const listeners = new Set<(e: ReminderEvent) => void>();
export const onReminder = (l: (e: ReminderEvent) => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const MAX_REPEATS = 6;

const interval = (s: Settings, status: VoyageStatus) =>
  Math.max(1, status === 'port' ? s.reminders.intervalPort : s.reminders.intervalSea);

/** czy przypomnienie o danej chwili pasuje do interwału (np. co 4h: wiersze 0400, 0800…) */
function matches(t: Date, s: Settings, status: VoyageStatus) {
  const { hour } = rowForTime(t);
  return hour % interval(s, status) === 0;
}

/** najbliższe przyszłe przypomnienie */
export function nextReminder(s: Settings, status: VoyageStatus, from = new Date()) {
  const t = new Date(from);
  t.setSeconds(0, 0);
  t.setMinutes(s.reminders.minute);
  if (t <= from) t.setHours(t.getHours() + 1);
  for (let i = 0; i < 48; i++) {
    if (matches(t, s, status)) return t;
    t.setHours(t.getHours() + 1);
  }
  return t;
}

/** ostatnie przypomnienie, które już minęło (<= now) */
function lastDue(s: Settings, status: VoyageStatus, now: Date) {
  const t = new Date(now);
  t.setSeconds(0, 0);
  t.setMinutes(s.reminders.minute);
  if (t > now) t.setHours(t.getHours() - 1);
  for (let i = 0; i < 48; i++) {
    if (matches(t, s, status)) return t;
    t.setHours(t.getHours() - 1);
  }
  return t;
}

let audioCtx: AudioContext | undefined;
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* brak dźwięku */
  }
}
export function beep() {
  try {
    unlockAudio();
    const ctx = audioCtx!;
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.2);
    });
  } catch {
    /* ignore */
  }
}

export async function showSystemNotification(title: string, body: string, url: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body,
      tag: 'logbook-hourly',
      renotify: true,
      requireInteraction: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url },
    };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const;
  if (Notification.permission === 'default') return await Notification.requestPermission();
  return Notification.permission;
}

export function checkReminders(now = new Date()) {
  const st = useStore.getState();
  const v = st.active();
  const s = st.settings;
  if (!v || !s.reminders.enabled) return;
  const due = lastDue(s, v.status, now);
  const elapsed = now.getTime() - due.getTime();
  if (elapsed < 0 || elapsed > 55 * 60_000) return;
  // nie przypominaj o godzinach sprzed rozpoczęcia rejsu
  if (v.embarkDate && rowForTime(due).date < v.embarkDate) return;
  // po zmianie statusu (wyjście/wejście) interwał się zmienia – nie przypominaj wstecz
  if (v.statusSince && due.getTime() < v.statusSince) return;
  const { date, hour } = rowForTime(due);
  const missing = missingFields(v.days[date]?.hours[hour], s.reminders.required);
  if (!missing.length) return;
  const n = s.reminders.repeatMin > 0 ? Math.min(MAX_REPEATS, Math.floor(elapsed / (s.reminders.repeatMin * 60_000))) : 0;
  const key = `${v.id}|${date}|${hour}|${n}`;
  if (st.lastReminder === key) return;
  // po ponownym otwarciu aplikacji nie wysyłaj powtórek, których już nie było – tylko bieżącą
  st.setLastReminder(key);

  const labels = missing.map((k) => HOUR_FIELDS.find((f) => f.key === k)?.short ?? k);
  const body = `Uzupełnij wiersz ${hourLabel(hour)} (${fmtDate(date)}): ${labels.join(', ')}`;
  void showSystemNotification('⏰ Wpis do dziennika', body, `/#/day/${date}?h=${hour}`);
  if (s.reminders.sound) beep();
  if ('vibrate' in navigator) navigator.vibrate?.([300, 150, 300]);
  listeners.forEach((l) => l({ date, hour, missing }));
}

let started = false;
export function startReminderLoop() {
  if (started) return;
  started = true;
  const tick = () => checkReminders();
  setInterval(tick, 15_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
  setTimeout(tick, 2000);
}

/** Wake Lock – ekran nie gaśnie w trybie wachty, dzięki czemu przypomnienia działają pewnie */
let wakeLock: WakeLockSentinel | null = null;
export async function setWakeLock(on: boolean) {
  try {
    if (on && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      return true;
    }
    await wakeLock?.release();
    wakeLock = null;
  } catch {
    /* nieobsługiwane */
  }
  return false;
}
export const wakeLockActive = () => !!wakeLock && !wakeLock.released;
