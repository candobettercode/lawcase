import { addDays, format, parseISO } from "date-fns";

export const DEFAULT_TIME_ZONE = "Asia/Dhaka";

export function tzParts(iso: string | number | Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(iso))) p[x.type] = x.value;
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    h: Number(p.hour), m: Number(p.minute),
    dow: dows.indexOf(p.weekday),
  };
}

function tzOffset(ts: number, tz: string) {
  const p = tzParts(ts, tz);
  const [y, mo, d] = p.date.split("-").map(Number);
  return Date.UTC(y, mo - 1, d, p.h, p.m) - Math.floor(ts / 60000) * 60000;
}

/** Wall-clock date + "HH:mm" in a time zone -> UTC ISO string */
export function zonedToUtc(date: string, hhmm: string, tz: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - tzOffset(guess, tz);
  ts = guess - tzOffset(ts, tz);
  return new Date(ts).toISOString();
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const shiftDate = (date: string, n: number) => format(addDays(parseISO(date), n), "yyyy-MM-dd");
export const dowOf = (date: string) => parseISO(date).getDay();
export const fmtDate = (date: string, f = "EEE, MMM d") => format(parseISO(date), f);

export function fmtTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
export function fmtDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(iso));
}
export const todayIn = (tz: string) => tzParts(Date.now(), tz).date;
export const overlaps = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;
