import { shiftDate, tzParts, zonedToUtc } from "./time";

export interface TimelineInterval { key: string; start: string; end: string }

/** Lay out by local wall-clock minutes, not elapsed minutes since midnight (DST). */
export function layoutTimeline<T extends TimelineInterval>(items: T[], date: string, tz: string, from = 7 * 60, to = 20 * 60) {
  const dayStart = Date.parse(zonedToUtc(date, "00:00", tz));
  const dayEnd = Date.parse(zonedToUtc(shiftDate(date, 1), "00:00", tz));
  const visible = items.flatMap((item) => {
    const start = Date.parse(item.start), end = Date.parse(item.end);
    if (start >= dayEnd || end <= dayStart) return [];
    const sp = tzParts(Math.max(start, dayStart), tz), ep = tzParts(Math.min(end, dayEnd), tz);
    const a = Math.max(from, start <= dayStart ? 0 : sp.h * 60 + sp.m);
    const b = Math.min(to, end >= dayEnd ? 1440 : ep.h * 60 + ep.m);
    return b > a ? [{ item, startMinute: a, endMinute: b }] : [];
  }).sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
  const result: Array<{ item: T; startMinute: number; endMinute: number; lane: number; lanes: number }> = [];
  let group: typeof result = [], groupEnd = -1;
  const flush = () => { const lanes = Math.max(1, ...group.map((x) => x.lane + 1)); result.push(...group.map((x) => ({ ...x, lanes }))); group = []; };
  for (const entry of visible) {
    if (entry.startMinute >= groupEnd) { flush(); groupEnd = -1; }
    let lane = 0;
    while (group.some((x) => x.lane === lane && x.endMinute > entry.startMinute)) lane++;
    group.push({ ...entry, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, entry.endMinute);
  }
  flush();
  return result;
}