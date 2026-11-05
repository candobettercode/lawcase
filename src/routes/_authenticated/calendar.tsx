import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdvocateTimeline, type TimelineEntry } from "@/components/calendar/AdvocateTimeline";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { DEFAULT_TIME_ZONE, fmtDate, fmtDateTime, fmtTime, shiftDate, todayIn, tzParts, zonedToUtc } from "@/lib/time";
import { rpcMessage, statusLabel } from "@/lib/staff";

export const Route = createFileRoute("/_authenticated/calendar")({ head: () => pageHead("Calendar", "Firm calendar and booking requests.", true), component: Page });

const TZ = DEFAULT_TIME_ZONE;
const kindColor: Record<string, string> = { court: "var(--ev-court)", travel: "var(--ev-travel)", meeting: "var(--ev-meeting)", block: "var(--ev-leave)", leave: "var(--ev-leave)" };
const lawyerPastels = ["#7C9CBF", "#9B7BB8", "#D28A8A", "#6FA7A1", "#D2A86A", "#7FA66B", "#C27F9A", "#7D91C8", "#A08A68", "#5F9FBD", "#A579A8", "#BD8B73"];

function lawyerColor(advocateId: string | null, advocates: { id: string; name: string }[] = []) {
  const orderedIndex = advocateId ? advocates.findIndex((advocate) => advocate.id === advocateId) : -1;
  if (orderedIndex >= 0) return lawyerPastels[orderedIndex % lawyerPastels.length];
  const fallback = advocateId ? Array.from(advocateId).reduce((total, character) => total + character.charCodeAt(0), 0) : 0;
  return lawyerPastels[fallback % lawyerPastels.length];
}

function weekday(date: string, offset = 0) {
  const value = new Date(`${date}T12:00:00Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - mondayOffset + offset);
  return value.toISOString().slice(0, 10);
}

function shiftMonth(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 10);
}

function entriesForDay(entries: TimelineEntry[], day: string, timezone: string) {
  return entries.filter((entry) => tzParts(entry.start, timezone).date === day).sort((a, b) => a.start.localeCompare(b.start));
}

const appointmentPastel = (lawyerColorValue: string, cancelled = false) => cancelled
  ? "color-mix(in oklab, var(--status-cancelled) 18%, var(--card))"
  : `color-mix(in oklab, ${lawyerColorValue} 14%, var(--card))`;

function formatClockLabel(minutes: number) {
  const hour24 = Math.floor(minutes / 60) % 24;
  return `${hour24 % 12 || 12}:00 ${hour24 < 12 ? "AM" : "PM"}`;
}

function calendarDateFromString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function calendarDateToString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function layoutWeekAppointments<T extends { entry: TimelineEntry; startPos: number; endPos: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startPos - b.startPos || b.endPos - a.endPos);
  const output: Array<T & { lane: number; lanes: number }> = [];
  let group: Array<T & { lane: number }> = [];
  let groupEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    output.push(...group.map((item) => ({ ...item, lanes })));
    group = [];
  };
  sorted.forEach((item) => {
    if (item.startPos >= groupEnd) { flush(); groupEnd = -1; }
    let lane = 0;
    while (group.some((placed) => placed.lane === lane && placed.endPos > item.startPos)) lane++;
    group.push({ ...item, lane });
    groupEnd = Math.max(groupEnd, item.endPos);
  });
  flush();
  return output;
}

function clockLabelTo24(label: string) {
  const match = label.match(/^(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) return "08:00";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function CalendarGrid({ entries, date, timezone, view, onOpenDay, onOpenEntry, onEmptySlot }: {
  entries: TimelineEntry[]; date: string; timezone: string; view: "week" | "month";
  onOpenDay: (day: string) => void; onOpenEntry: (key: string) => void; onEmptySlot: (day: string, time: string) => void;
}) {
  const isMonth = view === "month";
  const start = isMonth ? `${date.slice(0, 7)}-01` : weekday(date);
  const monthStart = isMonth ? weekday(`${date.slice(0, 7)}-01`, 0) : start;
  const gridStart = isMonth ? monthStart : start;
  const count = isMonth ? 42 : 7;
  const days = Array.from({ length: count }, (_, index) => shiftDate(gridStart, index));
  const month = date.slice(0, 7);
  const today = todayIn(timezone);
  if (!isMonth) {
    const hourHeight = 72;
    const startMinute = 10 * 60;
    const endMinute = 22 * 60;
    const height = (endMinute - startMinute) / 60 * hourHeight;
    return <div className="max-h-[calc(100vh-230px)] overflow-auto rounded-md border bg-card">
      <div className="sticky top-0 z-30 grid min-w-[980px] grid-cols-[72px_repeat(7,minmax(128px,1fr))] border-b bg-card">
        <div className="sticky left-0 z-40 border-r bg-card" />
        {days.map((day) => {
          const dateNumber = Number(day.slice(-2)); const active = day === today;
          return <div key={day} className="grid h-[76px] place-items-center border-r text-center last:border-r-0"><button onClick={() => onOpenDay(day)} className="flex flex-col items-center gap-1"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{fmtDate(day, "EEE")}</span><span className={`grid size-10 place-items-center text-lg font-bold ${active ? "rounded-full bg-[#172554] text-white" : ""}`}>{dateNumber}</span></button></div>;
        })}
      </div>
      <div className="grid min-w-[980px] grid-cols-[72px_repeat(7,minmax(128px,1fr))]" style={{ height }}>
        <div className="sticky left-0 z-20 border-r bg-card">
          {Array.from({ length: 13 }, (_, i) => { const minutes = startMinute + i * 60; const hour = Math.floor(minutes / 60); const label = `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`; return <div key={minutes} className="absolute z-[21] w-full bg-card pr-2 pt-1 text-right text-[11px] font-medium tabular-nums text-muted-foreground" style={{ top: i * hourHeight }}>{label}</div>; })}
        </div>
        {days.map((day) => {
          const dayEntries = entriesForDay(entries, day, timezone).filter((entry) => !entry.kind);
          const positioned = dayEntries.map((entry) => { const p = tzParts(entry.start, timezone); const e = tzParts(entry.end, timezone); const rawStartPos = p.h * 60 + p.m; const rawEndPos = e.h * 60 + e.m; return { entry, startPos: rawStartPos < startMinute ? startMinute : Math.min(rawStartPos, endMinute), endPos: rawEndPos <= startMinute ? startMinute : Math.max(Math.min(rawEndPos, endMinute), rawStartPos < startMinute ? startMinute : rawStartPos + 30) }; }).filter((x) => x.endPos > x.startPos || x.entry.kind == null);
          const positionedWithLanes = layoutWeekAppointments(positioned);
          return <div key={day} className="relative border-r last:border-r-0" style={{ height }}>
            {Array.from({ length: 13 }, (_, i) => <button key={i} aria-label={`New appointment ${day} at ${formatClockLabel(startMinute + i * 60)}`} onClick={() => onEmptySlot(day, formatClockLabel(startMinute + i * 60))} className="absolute inset-x-0 border-t border-border/70 text-transparent hover:bg-primary/5" style={{ top: i * hourHeight, height: hourHeight }} />)}
            {positionedWithLanes.map((x) => {
              const width = 100 / x.lanes;
              const top = (x.startPos - startMinute) / 60 * hourHeight; const heightPx = Math.max(32, (x.endPos - x.startPos) / 60 * hourHeight - 3);
              const cancelled = x.entry.status === "cancelled" || x.entry.status === "declined";
              const completed = x.entry.status === "completed";
              const clientName = x.entry.title.split(" · ")[0];
              return <button key={x.entry.key} title={`${clientName}\n${fmtTime(x.entry.start, timezone)} – ${fmtTime(x.entry.end, timezone)}\n${x.entry.sub}`} onClick={(event) => { event.stopPropagation(); onOpenEntry(x.entry.key); }} className={`absolute z-10 overflow-hidden rounded-md border-l-[4px] px-2 py-1 text-left text-[11px] shadow-sm transition hover:z-20 hover:-translate-y-px hover:shadow-md ${cancelled ? "opacity-55" : ""} ${completed ? "ring-1 ring-emerald-300" : ""}`} style={{ top, height: heightPx, left: `calc(${x.lane * width}% + 3px)`, width: `calc(${width}% - 6px)`, borderLeftColor: x.entry.color, background: appointmentPastel(x.entry.color, cancelled) }}>
                <span className={`block truncate font-bold ${cancelled ? "line-through" : ""}`}>{fmtTime(x.entry.start, timezone)} {clientName}</span>{heightPx >= 48 && <span className="block truncate text-muted-foreground">{x.entry.sub}</span>}
              </button>;
            })}
          </div>;
        })}
      </div>
    </div>;
  }
  return <div className="overflow-auto rounded-md border bg-card">
    <div className="grid min-w-[760px] grid-cols-7 border-b text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}</div>
    <div className="grid min-w-[760px] grid-cols-7">{days.map((day, index) => { const dayEntries = entriesForDay(entries, day, timezone); return <div key={day} className={`min-h-32 border-b border-r p-2 ${(index + 1) % 7 === 0 ? "border-r-0" : ""} ${day.slice(0, 7) !== month ? "bg-muted/30 text-muted-foreground" : ""}`}><button className="mb-2 text-sm font-semibold hover:underline" onClick={() => onOpenDay(day)}>{Number(day.slice(-2))}</button><div className="space-y-1">{dayEntries.map((entry) => <button key={entry.key} onClick={() => onOpenEntry(entry.key)} className={`w-full rounded border-l-4 px-2 py-1 text-left text-xs ${(entry.status === "cancelled" || entry.status === "declined") ? "opacity-55 line-through" : ""} ${entry.status === "completed" ? "ring-1 ring-emerald-300" : ""}`} style={{ borderLeftColor: entry.color, background: `color-mix(in oklab, ${entry.color} 12%, var(--card))` }}><span className="block truncate font-medium">{fmtTime(entry.start, timezone)} {entry.title}</span></button>)}</div></div>; })}</div>
  </div>;
}

function useCalendarData() {
  return useQuery({
    queryKey: ["staff-calendar"],
    queryFn: async () => {
      const [ap, adv, loc, svc, blk, lv] = await Promise.all([
        supabase.from("appointments").select("id,booking_ref,advocate_id,location_id,service_id,client_name,client_email,client_phone,opposing_party,starts_at,ends_at,status,consultation_mode,decline_reason,created_at,matter_description").order("starts_at"),
        supabase.from("advocates").select("id,name,designation").is("deleted_at", null).order("name"),
        supabase.from("locations").select("id,name,timezone").order("sort_order"),
        supabase.from("services").select("id,name,duration_minutes,fee,active").order("sort_order"),
        supabase.from("blocked_times").select("*"),
        supabase.from("leaves").select("*"),
      ]);
      const err = ap.error ?? adv.error ?? loc.error ?? svc.error ?? blk.error ?? lv.error;
      if (err) throw err;
      return { appointments: ap.data!, advocates: adv.data!, locations: loc.data!, services: svc.data!, blocks: blk.data!, leaves: lv.data! };
    },
  });
}

function Page() {
  const qc = useQueryClient();
  const q = useCalendarData();
  const [date, setDate] = useState(() => todayIn(TZ));
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [f, setF] = useState({ loc: "all", adv: "all", svc: "all", status: "all", type: "all", search: "", dateFrom: "", dateTo: "" });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newAppointment, setNewAppointment] = useState<{ day: string; time: string } | null>(null);
  const [decline, setDecline] = useState<{ id: string; reason: string } | null>(null);
  const [resched, setResched] = useState<{ id: string; date: string; time: string; tz: string } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // New bookings appear immediately: listen for appointment changes.
  useEffect(() => {
    const ch = supabase.channel("staff-appointments").on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => qc.invalidateQueries({ queryKey: ["staff-calendar"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const d = q.data;
  const name = (list: { id: string; name: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? "";
  const tzOf = (locId: string) => d?.locations.find((l) => l.id === locId)?.timezone ?? TZ;
  const awaiting = useMemo(() => (d?.appointments ?? []).filter((a) => a.status === "awaiting_confirmation").sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [d]);
  const now = new Date().toISOString();
  const counters = d ? {
    today: d.appointments.filter((a) => tzParts(a.starts_at, TZ).date === todayIn(TZ) && ["awaiting_confirmation", "confirmed", "completed"].includes(a.status)).length,
    awaiting: awaiting.length,
    hearings: d.blocks.filter((b) => b.kind === "court" && b.ends_at > now).length,
    advocates: d.advocates.length,
  } : null;

  const entries: TimelineEntry[] = useMemo(() => {
    if (!d) return [];
    const out: TimelineEntry[] = [];
    for (const a of d.appointments) {
      if (f.loc !== "all" && a.location_id !== f.loc) continue;
      if (f.adv !== "all" && a.advocate_id !== f.adv) continue;
      if (f.svc !== "all" && a.service_id !== f.svc) continue;
      if (f.status !== "all" && a.status !== f.status) continue;
      if (f.search && !a.client_name.toLowerCase().includes(f.search.toLowerCase())) continue;
      const appointmentDay = tzParts(a.starts_at, TZ).date;
      if (f.dateFrom && appointmentDay < f.dateFrom) continue;
      if (f.dateTo && appointmentDay > f.dateTo) continue;
      const mode = (a.consultation_mode ?? "in_person").toLowerCase();
      const type = mode === "online" || mode === "video" ? "online" : "in_person";
      if (f.type !== "all" && type !== f.type) continue;
      const advocateName = name(d.advocates, a.advocate_id);
      out.push({ key: `a:${a.id}`, start: a.starts_at, end: a.ends_at, title: a.client_name, sub: `${advocateName}${name(d.locations, a.location_id) ? ` · ${name(d.locations, a.location_id)}` : ""} · ${type === "online" ? "Online" : "In-person"}`, advocateIds: [a.advocate_id], status: a.status === "awaiting_confirmation" ? "pending" : a.status.replace("_", "-"), color: lawyerColor(a.advocate_id, d.advocates) });
    }
    if (f.svc === "all" && f.status === "all") {
      for (const b of d.blocks) if (f.loc === "all" || !b.location_id || b.location_id === f.loc) out.push({ key: `b:${b.id}`, start: b.starts_at, end: b.ends_at, title: b.title, sub: b.kind === "court" ? "Court hearing" : b.kind, advocateIds: [b.advocate_id], kind: b.kind, color: kindColor[b.kind] });
      for (const l of d.leaves) if (date >= l.start_date && date <= l.end_date) out.push({ key: `l:${l.id}`, start: zonedToUtc(date, "07:00", TZ), end: zonedToUtc(date, "20:00", TZ), title: l.reason, sub: "Leave", advocateIds: [l.advocate_id], kind: "leave", color: kindColor.leave });
    }
    return out;
  }, [d, f, date]);
  const advocates = (d?.advocates ?? []).filter((a) => f.adv === "all" || a.id === f.adv).map((a) => ({ id: a.id, name: a.name, title: a.designation }));

  async function act(id: string, action: "confirm" | "decline" | "reschedule", extra: { _reason?: string; _new_start?: string } = {}) {
    const { error } = await supabase.rpc("staff_appointment_action", { _id: id, _action: action, ...extra });
    if (error) { toast.error(rpcMessage(error)); return false; }
    toast.success(action === "confirm" ? "Appointment confirmed" : action === "decline" ? "Request declined" : "Appointment rescheduled");
    qc.invalidateQueries({ queryKey: ["staff-calendar"] });
    return true;
  }

  return <><div className="page-gutter w-full py-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Firm calendar</p><h1 className="text-2xl">{view === "month" ? fmtDate(date, "MMMM yyyy") : view === "week" ? `${fmtDate(weekday(date), "MMM d")} – ${fmtDate(shiftDate(weekday(date), 6), "MMM d, yyyy")}` : fmtDate(date, "EEEE, MMMM d, yyyy")}</h1></div>
      {counters && <dl className="flex flex-wrap gap-6 text-sm">{([["Today's Appointments", counters.today], ["Awaiting Confirmation", counters.awaiting], ["Upcoming Hearings", counters.hearings], ["Advocates", counters.advocates]] as const).map(([l, n]) => <div key={l}><dt className="text-muted-foreground">{l}</dt><dd className="font-serif text-2xl" data-testid={l === "Awaiting Confirmation" ? "awaiting-count" : undefined}>{n}</dd></div>)}</dl>}
    </div>

    <section aria-labelledby="awaiting-h" className="mb-8 rounded-md border bg-card">
      <h2 id="awaiting-h" className="border-b p-4 text-lg">Awaiting Confirmation</h2>
      {q.isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : !awaiting.length ? <p className="p-4 text-sm text-muted-foreground">No requests are waiting.</p> :
        <ul className="divide-y">{awaiting.map((a) => <li key={a.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 text-sm"><p className="font-semibold">{a.client_name}</p><p className="text-muted-foreground">{fmtDateTime(a.starts_at, tzOf(a.location_id))} · {name(d?.advocates, a.advocate_id)} · {name(d?.services, a.service_id)} · {name(d?.locations, a.location_id)}</p><p className="text-muted-foreground">{a.client_email} · {a.client_phone}{a.opposing_party ? ` · Opposing party: ${a.opposing_party}` : ""}</p></div>
          <div className="flex flex-wrap gap-2"><Button className="h-11" onClick={() => act(a.id, "confirm")}>Confirm</Button><Button variant="outline" className="h-11" onClick={() => { const tz = tzOf(a.location_id); const p = tzParts(a.starts_at, tz); setResched({ id: a.id, date: p.date, time: `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`, tz }); }}>Reschedule</Button><Button variant="outline" className="h-11" onClick={() => setDecline({ id: a.id, reason: "" })}>Decline</Button></div>
        </li>)}</ul>}
    </section>

    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button variant="outline" className="h-11" onClick={() => setDate(todayIn(TZ))}>Today</Button>
      <Button variant="outline" size="icon" className="size-11" aria-label={`Previous ${view}`} onClick={() => setDate(view === "month" ? shiftMonth(date, -1) : shiftDate(date, view === "week" ? -7 : -1))}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" className="size-11" aria-label={`Next ${view}`} onClick={() => setDate(view === "month" ? shiftMonth(date, 1) : shiftDate(date, view === "week" ? 7 : 1))}><ChevronRight /></Button>
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-11 min-w-[140px] justify-start gap-2 px-3" aria-label="Choose calendar date">
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">{fmtDate(date, "MMM d, yyyy")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            key={date}
            mode="single"
            selected={calendarDateFromString(date)}
            onSelect={(selected) => {
              if (!selected) return;
              setDate(calendarDateToString(selected));
              setDatePickerOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <div role="group" aria-label="Calendar view" className="flex h-11 items-center rounded-md border bg-card p-1">
        {(["day", "week", "month"] as const).map((option) => <Button key={option} type="button" variant={view === option ? "default" : "ghost"} className="h-9 px-4" aria-pressed={view === option} onClick={() => setView(option)}>{option[0].toUpperCase() + option.slice(1)}</Button>)}
      </div>
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" className="h-11"><Filter className="size-4" /> Filters</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          <div className="grid gap-1.5"><Label htmlFor="filter-status">Appointment status</Label><select id="filter-status" className="h-10 rounded-md border bg-card px-3 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="all">All statuses</option>{Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="grid gap-1.5"><Label htmlFor="filter-advocate">Advocate / Lawyer</Label><select id="filter-advocate" className="h-10 rounded-md border bg-card px-3 text-sm" value={f.adv} onChange={(e) => setF({ ...f, adv: e.target.value })}><option value="all">All advocates</option>{d?.advocates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="grid gap-1.5"><Label htmlFor="filter-type">Appointment type</Label><select id="filter-type" className="h-10 rounded-md border bg-card px-3 text-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="all">All types</option><option value="in_person">In-person</option><option value="online">Online</option></select></div>
          <div className="grid grid-cols-2 gap-2"><div className="grid gap-1.5"><Label htmlFor="filter-from">From</Label><Input id="filter-from" type="date" value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value })} /></div><div className="grid gap-1.5"><Label htmlFor="filter-to">To</Label><Input id="filter-to" type="date" value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} /></div></div>
          <div className="grid gap-1.5"><Label htmlFor="filter-search">Search by client name</Label><Input id="filter-search" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Client name" /></div>
          <Button variant="ghost" className="w-full" onClick={() => setF({ loc: "all", adv: "all", svc: "all", status: "all", type: "all", search: "", dateFrom: "", dateTo: "" })}>Clear filters</Button>
        </PopoverContent>
      </Popover>
      <select aria-label="Location" className="h-11 rounded-md border bg-card px-3 text-sm" value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })}><option value="all">All locations</option>{d?.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    </div>
    {q.isLoading ? <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Loading calendar…</div> : q.isError ? <div role="alert" className="rounded-md border border-destructive/30 bg-card p-8 text-center text-sm text-destructive">Could not load calendar appointments. Please refresh and try again.</div> : view === "day" ? <><div className="rounded-md border bg-card"><AdvocateTimeline advocates={advocates} entries={entries.map((entry) => entry.kind ? entry : { ...entry, key: entry.key })} date={date} timezone={f.loc !== "all" ? tzOf(f.loc) : TZ} onPick={(key) => setDetailId(key.startsWith("a:") ? key.slice(2) : null)} /></div>
    <p className="mt-2 text-xs text-muted-foreground">Times shown in {(f.loc !== "all" ? tzOf(f.loc) : TZ).replace("_", " ")}.</p></> : <CalendarGrid entries={entries} date={date} timezone={f.loc !== "all" ? tzOf(f.loc) : TZ} view={view} onOpenDay={(day) => { setDate(day); setView("day"); }} onOpenEntry={(key) => setDetailId(key.startsWith("a:") ? key.slice(2) : null)} onEmptySlot={(day, time) => setNewAppointment({ day, time })} />}

    <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}><DialogContent><DialogHeader><DialogTitle>Appointment details</DialogTitle></DialogHeader>{(() => { const appointment = d?.appointments.find((item) => item.id === detailId); if (!appointment) return <p className="text-sm text-muted-foreground">Appointment not found.</p>; const mode = (appointment.consultation_mode ?? "in_person").toLowerCase(); return <div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><b>{appointment.booking_ref}</b><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{statusLabel[appointment.status]}</span></div><dl className="divide-y border-y">{[["Client", appointment.client_name],["Advocate", name(d?.advocates, appointment.advocate_id)],["Location", name(d?.locations, appointment.location_id)],["Type", mode === "online" || mode === "video" ? "Online" : "In-person"],["When", fmtDateTime(appointment.starts_at, tzOf(appointment.location_id))],["Phone", appointment.client_phone],["Email", appointment.client_email],["Matter", appointment.matter_description || "—"]].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl><DialogFooter><Button variant="outline" onClick={() => { const tz = tzOf(appointment.location_id); const p = tzParts(appointment.starts_at, tz); setResched({ id: appointment.id, date: p.date, time: `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`, tz }); }}>Reschedule</Button>{appointment.status !== "cancelled" && <Button variant="destructive" onClick={async () => { if (window.confirm("Cancel this appointment?")) { const { error } = await supabase.rpc("admin_resolve_appointment", { _id: appointment.id, _action: "cancel" }); if (error) toast.error(rpcMessage(error)); else { toast.success("Appointment cancelled"); qc.invalidateQueries({ queryKey: ["staff-calendar"] }); setDetailId(null); } } }}>Cancel appointment</Button>}</DialogFooter></div>; })()}</DialogContent></Dialog>

    <Dialog open={!!newAppointment} onOpenChange={(open) => !open && setNewAppointment(null)}><DialogContent><DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>{newAppointment && <form className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const advocate = String(form.get("advocate")); const location = String(form.get("location")); const service = String(form.get("service")); const clientName = String(form.get("clientName")); const clientPhone = String(form.get("clientPhone") || ""); const clientEmail = String(form.get("clientEmail") || ""); const mode = String(form.get("mode")); const timezone = d?.locations.find((item) => item.id === location)?.timezone ?? TZ; const start = zonedToUtc(newAppointment.day, clockLabelTo24(newAppointment.time), timezone);  const { error } = await supabase.rpc("staff_create_appointment", { _advocate: advocate, _location: location, _service: service, _client_name: clientName, _client_phone: clientPhone, _client_email: clientEmail, _start: start, _mode: mode }); if (error) { toast.error(rpcMessage(error)); return; } toast.success("Appointment created"); qc.invalidateQueries({ queryKey: ["staff-calendar"] }); setNewAppointment(null); }}>
      <div className="grid gap-1.5"><Label>Client name</Label><Input name="clientName" required /></div><div className="grid gap-1.5"><Label>Phone</Label><Input name="clientPhone" required /></div><div className="grid gap-1.5"><Label>Email</Label><Input name="clientEmail" type="email" /></div><div className="grid gap-1.5"><Label>Advocate</Label><select name="advocate" className="h-10 rounded-md border bg-card px-3 text-sm" required><option value="">Select advocate</option>{d?.advocates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-1.5"><Label>Location</Label><select name="location" className="h-10 rounded-md border bg-card px-3 text-sm" required><option value="">Select location</option>{d?.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-1.5"><Label>Service</Label><select name="service" className="h-10 rounded-md border bg-card px-3 text-sm" required><option value="">Select service</option>{d?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-1.5"><Label>Appointment type</Label><select name="mode" className="h-10 rounded-md border bg-card px-3 text-sm"><option value="in_person">In-person</option><option value="online">Online</option></select></div><p className="text-sm text-muted-foreground">{fmtDate(newAppointment.day, "EEEE, MMMM d, yyyy")} at {newAppointment.time}</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setNewAppointment(null)}>Cancel</Button><Button type="submit">Create appointment</Button></DialogFooter></form>}</DialogContent></Dialog>

    <Dialog open={!!decline} onOpenChange={(o) => !o && setDecline(null)}><DialogContent><DialogHeader><DialogTitle>Decline request</DialogTitle></DialogHeader>
      <Label htmlFor="reason">Reason (kept internal)</Label><Input id="reason" value={decline?.reason ?? ""} onChange={(e) => decline && setDecline({ ...decline, reason: e.target.value })} />
      <DialogFooter><Button variant="ghost" onClick={() => setDecline(null)}>Cancel</Button><Button disabled={(decline?.reason.trim().length ?? 0) < 3} onClick={async () => { if (decline && await act(decline.id, "decline", { _reason: decline.reason })) setDecline(null); }}>Decline request</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!resched} onOpenChange={(o) => !o && setResched(null)}><DialogContent><DialogHeader><DialogTitle>Reschedule</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="rd">Date</Label><Input id="rd" type="date" value={resched?.date ?? ""} onChange={(e) => resched && setResched({ ...resched, date: e.target.value })} /></div><div className="grid gap-1.5"><Label htmlFor="rt">Start time ({resched?.tz.replace("_", " ")})</Label><Input id="rt" type="time" step={900} value={resched?.time ?? ""} onChange={(e) => resched && setResched({ ...resched, time: e.target.value })} /></div></div>
      <p className="text-xs text-muted-foreground">Working hours, leave, court hearings and other bookings are checked before saving.</p>
      <DialogFooter><Button variant="ghost" onClick={() => setResched(null)}>Cancel</Button><Button onClick={async () => { if (resched && await act(resched.id, "reschedule", { _new_start: zonedToUtc(resched.date, resched.time, resched.tz) })) setResched(null); }}>Save new time</Button></DialogFooter>
    </DialogContent></Dialog>
  </div></>;
}
