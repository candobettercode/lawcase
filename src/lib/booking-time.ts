import { addDays, addMonths, format, parseISO, startOfMonth } from "date-fns";

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export function calendarKeyTarget(date: Date, key: string) {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (key in offsets) return addDays(date, offsets[key]);
  if (key === "PageUp" || key === "PageDown") return addMonths(date, key === "PageUp" ? -1 : 1);
  return date;
}
export const monthDate = (date: string) => startOfMonth(parseISO(date));
export const slotLabel = (iso: string, zone: string, format: "12" | "24") => new Intl.DateTimeFormat("en-US", {
  timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle: format === "24" ? "h23" : "h12",
}).format(new Date(iso));
export const holdExpired = (expiresAt: string, now: number) => new Date(expiresAt).getTime() <= now;