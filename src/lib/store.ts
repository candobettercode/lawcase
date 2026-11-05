import { useSyncExternalStore } from "react";
import { dowOf, fmtDateTime, overlaps, shiftDate, toMin, todayIn, zonedToUtc, fromMin, tzParts } from "./time";

export type Role = "admin" | "advocate" | "staff" | "client";
export type Status = "pending" | "confirmed" | "completed" | "no-show" | "cancelled";
export type Mode = "in-person" | "phone" | "video";
export type EventKind = "court" | "leave" | "meeting" | "travel" | "block";

export interface Location { id: string; tenantId: string; name: string; address: string; tz: string; hours: Record<number, [string, string] | null>; holidays: string[] }
export interface Room { id: string; tenantId: string; locationId: string; name: string; capacity: number }
export interface Advocate {
  id: string; tenantId: string; name: string; email: string; title: string; specializations: string[]; languages: string[];
  fee: number; bufferBefore: number; bufferAfter: number;
  schedule: { locationId: string; dow: number; start: string; end: string }[];
}
export interface User { id: string; tenantId: string; name: string; role: Role; advocateId?: string }
export interface Client { id: string; tenantId: string; name: string; email: string; phone: string; notes: string; createdAt: string }
export interface Service { id: string; tenantId: string; name: string; duration: number; fee: number; modes: Mode[]; locationIds: string[]; tone: number; description: string }
export interface Appointment {
  id: string; tenantId: string; serviceId: string; advocateId: string; clientId: string; locationId: string; roomId?: string;
  start: string; end: string; mode: Mode; status: Status; opposingParty: string; intake: string; createdBy: string;
}
export interface CalEvent { id: string; tenantId: string; kind: EventKind; title: string; advocateIds: string[]; locationId?: string; start: string; end: string }
export interface Notification { id: string; tenantId: string; to: string; subject: string; body: string; kind: string; createdAt: string; appointmentId?: string }
export interface Audit { id: string; tenantId: string; actor: string; action: string; at: string }

export interface State {
  tenant: { id: string; name: string; slug: string };
  locations: Location[]; rooms: Room[]; advocates: Advocate[]; users: User[]; clients: Client[];
  services: Service[]; appointments: Appointment[]; events: CalEvent[]; notifications: Notification[]; audit: Audit[];
  currentUserId: string;
}

const T = "apex";
const TZ = "Asia/Dhaka";
const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): State {
  const today = todayIn(TZ);
  const monday = shiftDate(today, -((dowOf(today) + 6) % 7));
  const wk = (h: [string, string]) => ({ 0: null, 1: h, 2: h, 3: h, 4: h, 5: h, 6: null });
  const locations: Location[] = [
    { id: "loc-dt", tenantId: T, name: "Downtown Chambers", address: "120 Broadway, Suite 3400, New York, NY 10271", tz: TZ, hours: wk(["08:00", "19:00"]), holidays: [] },
    { id: "loc-sc", tenantId: T, name: "Supreme Court Office", address: "1 First St NE (adjacent), Washington, DC 20543", tz: TZ, hours: wk(["08:00", "18:00"]), holidays: [] },
  ];
  const rooms: Room[] = [
    { id: "rm-1", tenantId: T, locationId: "loc-dt", name: "Liberty Room", capacity: 6 },
    { id: "rm-2", tenantId: T, locationId: "loc-dt", name: "Hudson Room", capacity: 4 },
    { id: "rm-3", tenantId: T, locationId: "loc-sc", name: "Marshall Room", capacity: 8 },
  ];
  const s = (locationId: string, dows: number[], start: string, end: string) => dows.map((dow) => ({ locationId, dow, start, end }));
  const advocates: Advocate[] = [
    { id: "adv-sj", tenantId: T, name: "Sarah Jenkins", email: "s.jenkins@apexlegal.com", title: "Senior Partner", specializations: ["Criminal Defense", "Constitutional Law"], languages: ["English", "Spanish"], fee: 650, bufferBefore: 15, bufferAfter: 15, schedule: [...s("loc-dt", [1, 2, 4], "09:00", "17:00"), ...s("loc-sc", [3, 5], "09:00", "17:00")] },
    { id: "adv-dr", tenantId: T, name: "David Ross", email: "d.ross@apexlegal.com", title: "Partner", specializations: ["Corporate Litigation"], languages: ["English"], fee: 550, bufferBefore: 0, bufferAfter: 15, schedule: s("loc-dt", [1, 2, 3, 4, 5], "09:00", "18:00") },
    { id: "adv-ps", tenantId: T, name: "Priya Sharma", email: "p.sharma@apexlegal.com", title: "Associate Partner", specializations: ["Intellectual Property", "Technology Law"], languages: ["English", "Hindi"], fee: 480, bufferBefore: 10, bufferAfter: 10, schedule: [...s("loc-dt", [1, 3, 5], "10:00", "18:00"), ...s("loc-sc", [2, 4], "10:00", "18:00")] },
  ];
  const users: User[] = [
    { id: "u-admin", tenantId: T, name: "Margaret Cole", role: "admin" },
    { id: "u-sj", tenantId: T, name: "Sarah Jenkins", role: "advocate", advocateId: "adv-sj" },
    { id: "u-dr", tenantId: T, name: "David Ross", role: "advocate", advocateId: "adv-dr" },
    { id: "u-ps", tenantId: T, name: "Priya Sharma", role: "advocate", advocateId: "adv-ps" },
    { id: "u-staff", tenantId: T, name: "Tom Becker", role: "staff" },
    { id: "u-client", tenantId: T, name: "Public visitor", role: "client" },
  ];
  const services: Service[] = [
    { id: "svc-pc", tenantId: T, name: "Preliminary Consultation", duration: 30, fee: 150, modes: ["in-person", "phone", "video"], locationIds: ["loc-dt", "loc-sc"], tone: 1, description: "A short first meeting to understand your situation and options." },
    { id: "svc-cmr", tenantId: T, name: "Comprehensive Matter Review", duration: 60, fee: 450, modes: ["in-person", "video"], locationIds: ["loc-dt", "loc-sc"], tone: 2, description: "An in-depth review of documents and strategy with your advocate." },
    { id: "svc-vss", tenantId: T, name: "Virtual Strategy Session", duration: 45, fee: 300, modes: ["video"], locationIds: ["loc-dt", "loc-sc"], tone: 3, description: "A focused planning session held over secure video." },
    { id: "svc-upt", tenantId: T, name: "Urgent Pre-Trial Prep", duration: 90, fee: 900, modes: ["in-person"], locationIds: ["loc-dt", "loc-sc"], tone: 4, description: "Priority preparation ahead of an imminent hearing or trial." },
  ];
  const names = [
    ["Michael Alvarez", "m.alvarez@mail.com", "(212) 555-0142"], ["Linda Chen", "linda.chen@mail.com", "(917) 555-0187"],
    ["Robert Okafor", "rokafor@mail.com", "(646) 555-0110"], ["Emily Hart", "emily.hart@mail.com", "(202) 555-0163"],
    ["Northwind Robotics LLC", "legal@northwind.io", "(415) 555-0199"], ["James Whitfield", "jwhitfield@mail.com", "(718) 555-0121"],
    ["Aisha Rahman", "aisha.r@mail.com", "(202) 555-0177"], ["Carlos Mendes", "cmendes@mail.com", "(347) 555-0134"],
  ];
  const clients: Client[] = names.map(([name, email, phone], i) => ({
    id: `cl-${i}`, tenantId: T, name, email, phone, createdAt: shiftDate(monday, -30 + i) + "T14:00:00.000Z",
    notes: i === 0 ? "Prefers Spanish-language summaries. Referred by J. Whitfield." : i === 4 ? "Corporate client — invoices to legal@ address." : "",
  }));
  const mk = (day: number, time: string, adv: string, svc: string, cl: number, status: Status, mode: Mode, loc: string, room: string | undefined, opp = ""): Appointment => {
    const sv = services.find((x) => x.id === svc)!;
    const date = shiftDate(monday, day);
    const start = zonedToUtc(date, time, TZ);
    return { id: uid(), tenantId: T, serviceId: svc, advocateId: adv, clientId: `cl-${cl}`, locationId: loc, roomId: mode === "in-person" ? room : undefined, start, end: zonedToUtc(date, fromMin(toMin(time) + sv.duration), TZ), mode, status, opposingParty: opp, intake: "", createdBy: "u-staff" };
  };
  const appointments: Appointment[] = [
    mk(-7, "10:00", "adv-sj", "svc-cmr", 0, "completed", "in-person", "loc-dt", "rm-1", "State of New York"),
    mk(-6, "14:00", "adv-dr", "svc-pc", 4, "completed", "video", "loc-dt", undefined),
    mk(-4, "11:00", "adv-ps", "svc-vss", 4, "no-show", "video", "loc-dt", undefined, "Acme Devices Inc."),
    mk(0, "09:30", "adv-sj", "svc-pc", 2, "confirmed", "in-person", "loc-dt", "rm-1"),
    mk(0, "11:00", "adv-dr", "svc-cmr", 5, "confirmed", "in-person", "loc-dt", "rm-2", "Harbor Freight Partners"),
    mk(0, "14:00", "adv-ps", "svc-pc", 7, "pending", "phone", "loc-dt", undefined),
    mk(1, "10:00", "adv-sj", "svc-upt", 0, "confirmed", "in-person", "loc-dt", "rm-1", "State of New York"),
    mk(1, "13:30", "adv-ps", "svc-cmr", 4, "confirmed", "in-person", "loc-sc", "rm-3", "Acme Devices Inc."),
    mk(1, "15:00", "adv-dr", "svc-vss", 1, "pending", "video", "loc-dt", undefined),
    mk(2, "14:30", "adv-sj", "svc-pc", 6, "confirmed", "in-person", "loc-sc", "rm-3"),
    mk(2, "10:00", "adv-dr", "svc-pc", 3, "confirmed", "phone", "loc-dt", undefined),
    mk(3, "09:00", "adv-dr", "svc-upt", 5, "confirmed", "in-person", "loc-dt", "rm-2", "Harbor Freight Partners"),
    mk(3, "11:00", "adv-sj", "svc-cmr", 2, "pending", "in-person", "loc-dt", "rm-1"),
    mk(4, "10:00", "adv-sj", "svc-vss", 3, "confirmed", "video", "loc-sc", undefined),
    mk(7, "10:00", "adv-ps", "svc-pc", 1, "pending", "in-person", "loc-dt", "rm-2"),
    mk(8, "13:00", "adv-dr", "svc-cmr", 7, "confirmed", "in-person", "loc-dt", "rm-1"),
    mk(9, "11:00", "adv-sj", "svc-cmr", 6, "confirmed", "in-person", "loc-sc", "rm-3", "District of Columbia"),
  ];
  const ev = (kind: EventKind, title: string, advs: string[], day: number, from: string, to: string, loc?: string, days = 0): CalEvent => ({
    id: uid(), tenantId: T, kind, title, advocateIds: advs, locationId: loc,
    start: zonedToUtc(shiftDate(monday, day), from, TZ), end: zonedToUtc(shiftDate(monday, day + days), to, TZ),
  });
  const events: CalEvent[] = [
    ev("court", "U.S. Supreme Court — Oral Argument", ["adv-sj"], 2, "10:00", "13:00", "loc-sc"),
    ev("travel", "Travel NYC → DC", ["adv-sj"], 1, "17:00", "19:00"),
    ev("leave", "Annual leave", ["adv-ps"], 4, "00:00", "23:59"),
    ev("leave", "Annual leave", ["adv-dr"], 10, "00:00", "23:59", undefined, 1),
    ev("meeting", "Partners' weekly meeting", ["adv-sj", "adv-dr", "adv-ps"], 0, "08:30", "09:15", "loc-dt"),
    ev("court", "S.D.N.Y. — Status conference", ["adv-dr"], 8, "09:30", "11:00", "loc-dt"),
  ];
  return {
    tenant: { id: T, name: "Apex Legal Partners", slug: "apex" },
    locations, rooms, advocates, users, clients, services, appointments, events, notifications: [], audit: [], currentUserId: "u-staff",
  };
}

// ---------- store ----------
const KEY = "apex-scheduler-v1";
let state: State = seed();
let hydrated = false;
const listeners = new Set<() => void>();
const serverSnap = state;

function emit() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); queueMicrotask(() => listeners.forEach((x) => x())); }
    } catch { /* ignore */ }
  }
  return () => listeners.delete(l);
}
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => serverSnap);
}
export const getState = () => state;
function set(fn: (s: State) => Partial<State>) { state = { ...state, ...fn(state) }; emit(); }

export function resetDemo() { state = seed(); emit(); }
export function setCurrentUser(id: string) { set(() => ({ currentUserId: id })); }

function actor(s: State) { return s.users.find((u) => u.id === s.currentUserId)?.name ?? "System"; }
function log(s: State, action: string): Audit[] { return [{ id: uid(), tenantId: T, actor: actor(s), action, at: new Date().toISOString() }, ...s.audit]; }

/** Notifications never include the matter, opposing party, intake or service details. */
function notify(s: State, a: Appointment, kind: "confirmation" | "reschedule" | "cancellation" | "reminder" | "status"): Notification {
  const client = s.clients.find((c) => c.id === a.clientId)!;
  const loc = s.locations.find((l) => l.id === a.locationId)!;
  const when = fmtDateTime(a.start, loc.tz);
  const where = a.mode === "in-person" ? `at our ${loc.name} office (${loc.address})` : a.mode === "phone" ? "by phone — we will call you at the number on file" : "by secure video — a link will be sent separately";
  const subjects = { confirmation: "Your appointment is confirmed", reschedule: "Your appointment has been rescheduled", cancellation: "Your appointment has been cancelled", reminder: "Reminder: upcoming appointment", status: "Update about your appointment" };
  const lead = { confirmation: "This confirms your appointment", reschedule: "Your appointment has been moved to a new time", cancellation: "Your appointment has been cancelled", reminder: "This is a friendly reminder of your appointment", status: "There is an update to your appointment" };
  return {
    id: uid(), tenantId: T, to: client.email, kind, createdAt: new Date().toISOString(), appointmentId: a.id,
    subject: `${subjects[kind]} — ${s.tenant.name}`,
    body: `Dear ${client.name.split(" ")[0]},\n\n${lead[kind]} with ${s.tenant.name} on ${when}, ${where}.\n\nFor your privacy, this message does not contain details about your matter. To make changes, please call our office.\n\nKind regards,\n${s.tenant.name}`,
  };
}

export function upsertClient(c: Omit<Client, "id" | "tenantId" | "createdAt"> & { id?: string }): string {
  const existing = c.id ? state.clients.find((x) => x.id === c.id) : state.clients.find((x) => x.email && x.email.toLowerCase() === c.email.toLowerCase());
  if (existing) { set((s) => ({ clients: s.clients.map((x) => (x.id === existing.id ? { ...x, ...c, id: existing.id } : x)) })); return existing.id; }
  const id = uid();
  set((s) => ({ clients: [...s.clients, { ...c, id, tenantId: T, createdAt: new Date().toISOString() }], audit: log(s, `Created client ${c.name}`) }));
  return id;
}

export function createAppointment(a: Omit<Appointment, "id" | "tenantId" | "createdBy">) {
  const appt: Appointment = { ...a, id: uid(), tenantId: T, createdBy: state.currentUserId };
  set((s) => ({
    appointments: [...s.appointments, appt],
    notifications: [notify({ ...s, appointments: [...s.appointments, appt] }, appt, "confirmation"), ...s.notifications],
    audit: log(s, `Booked ${s.services.find((x) => x.id === a.serviceId)?.name} for ${s.clients.find((c) => c.id === a.clientId)?.name}`),
  }));
  return appt;
}
export function updateAppointment(id: string, patch: Partial<Appointment>) {
  set((s) => {
    const prev = s.appointments.find((x) => x.id === id)!;
    const next = { ...prev, ...patch };
    const kind = patch.start && patch.start !== prev.start ? "reschedule" : patch.status === "cancelled" ? "cancellation" : patch.status && patch.status !== prev.status ? "status" : null;
    const desc = kind === "reschedule" ? "Rescheduled" : patch.status ? `Status → ${patch.status}` : "Updated";
    return {
      appointments: s.appointments.map((x) => (x.id === id ? next : x)),
      notifications: kind && (kind !== "status" || patch.status === "confirmed") ? [notify(s, next, kind), ...s.notifications] : s.notifications,
      audit: log(s, `${desc}: appointment for ${s.clients.find((c) => c.id === prev.clientId)?.name}`),
    };
  });
}
export function sendReminder(id: string) {
  set((s) => ({ notifications: [notify(s, s.appointments.find((x) => x.id === id)!, "reminder"), ...s.notifications], audit: log(s, "Sent reminder") }));
}
export function addEvent(e: Omit<CalEvent, "id" | "tenantId">) {
  set((s) => ({ events: [...s.events, { ...e, id: uid(), tenantId: T }], audit: log(s, `Added ${e.kind}: ${e.title}`) }));
}
export function deleteEvent(id: string) { set((s) => ({ events: s.events.filter((e) => e.id !== id), audit: log(s, "Removed calendar block") })); }
export function updateClientNotes(id: string, notes: string) { set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, notes } : c)) })); }
export function updateAdvocate(id: string, patch: Partial<Advocate>) { set((s) => ({ advocates: s.advocates.map((a) => (a.id === id ? { ...a, ...patch } : a)), audit: log(s, "Updated advocate profile") })); }
export function addHoliday(locId: string, date: string) { set((s) => ({ locations: s.locations.map((l) => (l.id === locId ? { ...l, holidays: [...new Set([...l.holidays, date])].sort() } : l)), audit: log(s, `Added holiday ${date}`) })); }
export function removeHoliday(locId: string, date: string) { set((s) => ({ locations: s.locations.map((l) => (l.id === locId ? { ...l, holidays: l.holidays.filter((d) => d !== date) } : l)) })); }

// ---------- scheduling engine ----------
const active = (a: Appointment) => a.status !== "cancelled";

export interface Conflict { level: "error" | "warning"; message: string }

export function checkConflicts(s: State, p: { advocateId: string; locationId: string; roomId?: string; start: string; end: string; ignoreId?: string; serviceId?: string }): Conflict[] {
  const out: Conflict[] = [];
  const adv = s.advocates.find((a) => a.id === p.advocateId);
  const loc = s.locations.find((l) => l.id === p.locationId);
  if (!adv || !loc) return out;
  const st = +new Date(p.start), en = +new Date(p.end);
  const parts = tzParts(p.start, loc.tz);
  if (loc.holidays.includes(parts.date)) out.push({ level: "error", message: `${loc.name} is closed for a holiday on this day.` });
  const sm = parts.h * 60 + parts.m, em = sm + (en - st) / 60000;
  const sched = adv.schedule.filter((x) => x.dow === parts.dow);
  const here = sched.find((x) => x.locationId === p.locationId && toMin(x.start) <= sm && toMin(x.end) >= em);
  if (!here) {
    const elsewhere = sched.find((x) => x.locationId !== p.locationId);
    out.push({ level: "warning", message: elsewhere ? `${adv.name} works at ${s.locations.find((l) => l.id === elsewhere.locationId)?.name} on this day.` : `Outside ${adv.name}'s working hours.` });
  }
  const bb = adv.bufferBefore * 60000, ba = adv.bufferAfter * 60000;
  for (const a of s.appointments) {
    if (a.id === p.ignoreId || !active(a)) continue;
    if (a.advocateId === p.advocateId && overlaps(st - bb, en + ba, +new Date(a.start), +new Date(a.end))) {
      const hard = overlaps(st, en, +new Date(a.start), +new Date(a.end));
      out.push({ level: hard ? "error" : "warning", message: hard ? `${adv.name} already has an appointment at ${fmtDateTime(a.start, loc.tz)}.` : `Inside ${adv.name}'s buffer time around another appointment.` });
    }
    if (p.roomId && a.roomId === p.roomId && overlaps(st, en, +new Date(a.start), +new Date(a.end)))
      out.push({ level: "error", message: `${s.rooms.find((r) => r.id === p.roomId)?.name} is already booked.` });
  }
  for (const e of s.events) {
    if (!e.advocateIds.includes(p.advocateId)) continue;
    if (overlaps(st, en, +new Date(e.start), +new Date(e.end))) {
      const label = e.kind === "court" ? "Court hearing takes priority" : e.kind === "leave" ? `${adv.name} is on leave` : `Conflicts with "${e.title}"`;
      out.push({ level: e.kind === "court" || e.kind === "leave" ? "error" : "warning", message: `${label}: ${e.title}.` });
    }
  }
  return out;
}

export function freeRoom(s: State, locationId: string, start: string, end: string, ignoreId?: string) {
  const st = +new Date(start), en = +new Date(end);
  return s.rooms.find((r) => r.locationId === locationId && !s.appointments.some((a) => a.id !== ignoreId && active(a) && a.roomId === r.id && overlaps(st, en, +new Date(a.start), +new Date(a.end))));
}

export interface Slot { start: string; end: string; advocateId: string; time: string }
export function getSlots(s: State, date: string, locationId: string, serviceId: string, advocateId: string | null, mode: Mode): Slot[] {
  const loc = s.locations.find((l) => l.id === locationId)!;
  const svc = s.services.find((x) => x.id === serviceId)!;
  if (!loc || !svc || loc.holidays.includes(date)) return [];
  const dow = dowOf(date);
  const now = Date.now() + 60 * 60000;
  const advs = s.advocates.filter((a) => !advocateId || a.id === advocateId);
  const byTime = new Map<string, Slot>();
  for (const adv of advs) {
    for (const blk of adv.schedule.filter((x) => x.dow === dow && x.locationId === locationId)) {
      for (let m = toMin(blk.start); m + svc.duration <= toMin(blk.end); m += 15) {
        const time = fromMin(m);
        if (byTime.has(time) && !advocateId) continue;
        const start = zonedToUtc(date, time, loc.tz), end = zonedToUtc(date, fromMin(m + svc.duration), loc.tz);
        if (+new Date(start) < now) continue;
        if (checkConflicts(s, { advocateId: adv.id, locationId, start, end }).length) continue;
        if (mode === "in-person" && !freeRoom(s, locationId, start, end)) continue;
        if (m % 30 !== 0) continue;
        byTime.set(time, { start, end, advocateId: adv.id, time });
      }
    }
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function buildIcs(s: State, a: Appointment) {
  const loc = s.locations.find((l) => l.id === a.locationId)!;
  const z = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Apex Legal Partners//Scheduler//EN", "BEGIN:VEVENT",
    `UID:${a.id}@apexlegal`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(a.start)}`, `DTEND:${z(a.end)}`,
    `SUMMARY:Appointment — ${s.tenant.name}`,
    `LOCATION:${a.mode === "in-person" ? loc.address.replace(/,/g, "\\,") : a.mode === "phone" ? "Phone call" : "Secure video"}`,
    "DESCRIPTION:Appointment with your advocate. Matter details intentionally omitted.", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
export function downloadIcs(s: State, a: Appointment) {
  const blob = new Blob([buildIcs(s, a)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url; el.download = "appointment.ics"; el.click();
  URL.revokeObjectURL(url);
}

export function useCurrentUser() {
  const s = useStore();
  return s.users.find((u) => u.id === s.currentUserId)!;
}
