import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addEvent, useCurrentUser, useStore, type EventKind, type State } from "@/lib/store";
import { dowOf, fmtDate, fmtTime, fromMin, overlaps, shiftDate, toMin, todayIn, tzParts, zonedToUtc } from "@/lib/time";
import { DetailsSheet, type Selection } from "@/components/app/DetailsSheet";
import { QuickBookDialog, Field, Pick, type QuickBookPrefill } from "@/components/app/QuickBookDialog";
import { StatusBadge, eventLabel, eventVar, statusVar, toneVar } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AdvocateTimeline } from "@/components/calendar/AdvocateTimeline";



type View = "timeline" | "day" | "week" | "month" | "agenda";
interface Item { key: string; sel: NonNullable<Selection>; start: string; end: string; title: string; sub: string; color: string; advocateIds: string[]; status?: keyof typeof statusVar; isEvent: boolean; kind?: EventKind }

const H0 = 7, H1 = 20, PX = 52;

function buildItems(s: State, f: { loc: string; adv: string; svc: string; status: string }): Item[] {
  const out: Item[] = [];
  for (const a of s.appointments) {
    if (f.loc !== "all" && a.locationId !== f.loc) continue;
    if (f.adv !== "all" && a.advocateId !== f.adv) continue;
    if (f.svc !== "all" && a.serviceId !== f.svc) continue;
    if (f.status !== "all" && a.status !== f.status) continue;
    const svc = s.services.find((x) => x.id === a.serviceId);
    if (!svc) continue;
    out.push({ key: a.id, sel: { type: "appt", id: a.id }, start: a.start, end: a.end, title: s.clients.find((c) => c.id === a.clientId)?.name ?? "Appointment", sub: `${svc.name} · ${s.locations.find((x) => x.id === a.locationId)?.name ?? ""}`, color: toneVar(svc.tone), status: a.status, isEvent: false, advocateIds: [a.advocateId] });
  }
  for (const e of s.events) {
    if (f.svc !== "all" && f.svc !== `event:${e.kind}`) continue;
    if (f.adv !== "all" && !e.advocateIds.includes(f.adv)) continue;
    if (f.loc !== "all" && e.locationId && e.locationId !== f.loc) continue;
    const who = e.advocateIds.length > 2 ? "All advocates" : e.advocateIds.map((id) => s.advocates.find((x) => x.id === id)?.name.split(" ")[0]).join(", ");
    out.push({ key: e.id, sel: { type: "event", id: e.id }, start: e.start, end: e.end, title: e.title, sub: `${eventLabel[e.kind]} · ${who}`, color: eventVar[e.kind], isEvent: true, kind: e.kind, advocateIds: e.advocateIds });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function CalendarPage() {
  const s = useStore();
  const me = useCurrentUser();
  const [view, setView] = useState<View>("timeline");
  const tzLoc = s.locations[0];
  const [anchor, setAnchor] = useState(() => todayIn(tzLoc.tz));
  const [f, setF] = useState({ loc: "all", adv: me.advocateId ?? "all", svc: "all", status: "all" });
  const [lastUser, setLastUser] = useState(me.id);
  if (lastUser !== me.id) { setLastUser(me.id); setF((x) => ({ ...x, adv: me.advocateId ?? "all" })); }
  const [sel, setSel] = useState<Selection>(null);
  const [qb, setQb] = useState<QuickBookPrefill | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const tz = (f.loc !== "all" ? s.locations.find((l) => l.id === f.loc) : tzLoc)?.tz ?? "Asia/Dhaka";
  const items = useMemo(() => buildItems(s, f), [s, f]);
  const visibleAdvocates = s.advocates.filter((a) => (f.adv === "all" || a.id === f.adv) && (!me.advocateId || a.id === me.advocateId) && (f.loc === "all" || a.schedule.some((range) => range.locationId === f.loc)));

  const monday = shiftDate(anchor, -((dowOf(anchor) + 6) % 7));
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const step = view === "day" || view === "timeline" ? 1 : view === "month" ? 30 : 7;
  const go = (n: number) => setAnchor(view === "month" ? shiftDate(anchor.slice(0, 8) + "15", n * 30).slice(0, 8) + "01" : shiftDate(anchor, n * step));
  const title = view === "month" ? fmtDate(anchor, "MMMM yyyy") : view === "day" || view === "timeline" ? fmtDate(anchor, "EEEE, MMMM d, yyyy") : `${fmtDate(days[0], "MMM d")} – ${fmtDate(days[6], "MMM d, yyyy")}`;
  const canBook = me.role !== "client";

  const todays = items.filter((i) => !i.isEvent && tzParts(i.start, tz).date === todayIn(tz) && i.status !== "cancelled");
  const pending = items.filter((i) => i.status === "pending" && i.start > new Date().toISOString()).length;
  const courts = items.filter((i) => i.kind === "court" && i.end > new Date().toISOString()).length;

  return (
    <div className="page-gutter w-full py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{me.role === "advocate" ? "My calendar" : "Firm calendar"}</p>
          <h1 className="text-2xl">{title}</h1>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat n={todays.length} label="Today" /><Stat n={pending} label="Awaiting confirmation" /><Stat n={courts} label="Upcoming hearings" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous date" onClick={() => go(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" onClick={() => setAnchor(todayIn(tz))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next date" onClick={() => go(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)}>
          {(["timeline", "day", "week", "month", "agenda"] as View[]).map((v) => <ToggleGroupItem key={v} value={v} className="px-3 capitalize">{v}</ToggleGroupItem>)}
        </ToggleGroup>
        <div className="flex flex-wrap gap-2">
          <div className="w-44"><Pick value={f.loc} onChange={(v) => setF({ ...f, loc: v })} items={[["all", "All locations"], ...s.locations.map((l) => [l.id, l.name] as [string, string])]} /></div>
          <div className="w-40"><Pick value={f.adv} onChange={(v) => setF({ ...f, adv: v })} items={[["all", "All advocates"], ...s.advocates.map((a) => [a.id, a.name] as [string, string])]} /></div>
          <div className="w-48"><Pick value={f.svc} onChange={(v) => setF({ ...f, svc: v })} items={[["all", "All types"], ...s.services.map((a) => [a.id, a.name] as [string, string]), ...Object.entries(eventLabel).map(([k, label]) => [`event:${k}`, label] as [string, string])]} /></div>
          <div className="w-36"><Pick value={f.status} onChange={(v) => setF({ ...f, status: v })} items={[["all", "All statuses"], ...Object.keys(statusVar).map((k) => [k, k] as [string, string])]} /></div>
        </div>
        {canBook && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setBlockOpen(true)}><Ban className="size-4" /> Block time</Button>
            <Button onClick={() => setQb({ date: anchor, time: "10:00", advocateId: me.advocateId, locationId: f.loc !== "all" ? f.loc : undefined })}><Plus className="size-4" /> New booking</Button>
          </div>
        )}
      </div>
      <Legend s={s} />

      <div className="mt-3 overflow-hidden rounded-lg border bg-card">
        {view === "timeline" && <AdvocateTimeline advocates={visibleAdvocates} entries={items} date={anchor} timezone={tz} onPick={(key) => setSel(items.find((i) => i.key === key)?.sel ?? null)} onSlot={canBook ? (advocateId, time) => {
          const advocate = s.advocates.find((a) => a.id === advocateId);
          const locationId = f.loc !== "all" ? f.loc : advocate?.schedule.find((range) => range.dow === dowOf(anchor) && toMin(range.start) <= toMin(time) && toMin(range.end) > toMin(time))?.locationId;
          if (!locationId) { toast.error("Choose a location with working hours for this advocate."); return; }
          const location = s.locations.find((l) => l.id === locationId);
          if (!location) return;
          const instant = zonedToUtc(anchor, time, tz), local = tzParts(instant, location.tz);
          setQb({ advocateId, locationId, date: local.date, time: fromMin(local.h * 60 + local.m) });
        } : undefined} />}
        {(view === "week" || view === "day") && (
          <TimeGrid days={days} items={items} tz={tz} onPick={setSel}
            onEmpty={canBook ? (date, time) => setQb({ date, time, advocateId: f.adv !== "all" ? f.adv : undefined, locationId: f.loc !== "all" ? f.loc : undefined }) : undefined} />
        )}
        {view === "month" && <MonthGrid anchor={anchor} items={items} tz={tz} onPick={setSel} onDay={(d) => { setAnchor(d); setView("day"); }} />}
        {view === "agenda" && <Agenda from={anchor} items={items} tz={tz} onPick={setSel} />}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{f.loc === "all" ? "All locations · Reference time zone: " : "Time zone: "}{tz.replace("_", " ")} ({new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(zonedToUtc(anchor, "12:00", tz))).find((p) => p.type === "timeZoneName")?.value})</p>

      <DetailsSheet sel={sel} onClose={() => setSel(null)} />
      <QuickBookDialog open={!!qb} onOpenChange={(o) => !o && setQb(null)} prefill={qb} />
      <BlockDialog open={blockOpen} onOpenChange={setBlockOpen} date={anchor} defaultAdv={me.advocateId} />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="text-right"><div className="font-serif text-2xl leading-none">{n}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function Legend({ s }: { s: State }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {s.services.map((x) => <span key={x.id} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: toneVar(x.tone) }} />{x.name}</span>)}
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: eventVar.court }} />Court</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: eventVar.leave }} />Leave</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: eventVar.meeting }} />Meeting</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: eventVar.travel }} />Travel buffer</span>
      <span className="opacity-60">· left edge = status</span>
    </div>
  );
}

function ItemBox({ it, tz, compact, style, onPick }: { it: Item; tz: string; compact?: boolean; style?: React.CSSProperties; onPick: (s: Selection) => void }) {
  const cancelled = it.status === "cancelled";
  const solid = it.isEvent && it.kind !== "leave";
  return (
    <button onClick={(e) => { e.stopPropagation(); onPick(it.sel); }} style={{
      ...style,
      background: solid ? it.color : it.kind === "leave" ? `repeating-linear-gradient(45deg, color-mix(in oklab, ${it.color} 30%, transparent) 0 6px, color-mix(in oklab, ${it.color} 15%, transparent) 6px 12px)` : `color-mix(in oklab, ${it.color} 16%, var(--card))`,
      borderLeftColor: it.status ? statusVar[it.status] : it.color,
    }} className={cn("overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-xs shadow-sm transition hover:brightness-95", solid && "text-primary-foreground", cancelled && "line-through opacity-50")}>
      <div className="truncate font-medium">{compact ? `${fmtTime(it.start, tz)} ` : ""}{it.title}</div>
      {!compact && <div className="truncate opacity-75">{fmtTime(it.start, tz)} · {it.sub}</div>}
    </button>
  );
}

function TimeGrid({ days, items, tz, onPick, onEmpty }: { days: string[]; items: Item[]; tz: string; onPick: (s: Selection) => void; onEmpty?: (d: string, t: string) => void }) {
  const today = todayIn(tz);
  const nowP = tzParts(Date.now(), tz);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="border-b" />
        {days.map((d) => (
          <div key={d} className={cn("border-b border-l px-2 py-2 text-center", d === today && "bg-accent/10")}>
            <div className="text-xs uppercase text-muted-foreground">{fmtDate(d, "EEE")}</div>
            <div className={cn("font-serif text-lg", d === today && "text-accent-foreground")}>{fmtDate(d, "d")}</div>
          </div>
        ))}
        <div className="relative" style={{ height: (H1 - H0) * PX }}>
          {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="absolute right-2 -translate-y-2 text-[10px] text-muted-foreground" style={{ top: i * PX }}>{i ? fromMin((H0 + i) * 60).replace(/^0/, "") : ""}</div>)}
        </div>
        {days.map((d) => {
          const dayStart = +new Date(zonedToUtc(d, "00:00", tz)), dayEnd = +new Date(zonedToUtc(shiftDate(d, 1), "00:00", tz));
          const its = items.filter((i) => overlaps(+new Date(i.start), +new Date(i.end), dayStart, dayEnd));
          const lanes: number[] = []; const placed = its.map((it) => {
            const st = Math.max(+new Date(it.start), dayStart), en = Math.min(+new Date(it.end), dayEnd);
            let top = ((st - dayStart) / 60000 - H0 * 60) / 60 * PX, h = (en - st) / 3600000 * PX;
            if (top < 0) { h += top; top = 0; } h = Math.min(h, (H1 - H0) * PX - top);
            let lane = lanes.findIndex((end) => end <= st); if (lane < 0) { lane = lanes.length; lanes.push(en); } else lanes[lane] = en;
            return { it, top, h: Math.max(h, 18), lane };
          });
          const n = Math.max(1, lanes.length);
          return (
            <div key={d} className={cn("relative border-l", d === today && "bg-accent/5")} style={{ height: (H1 - H0) * PX }}
              onClick={(e) => { if (!onEmpty) return; const y = e.clientY - e.currentTarget.getBoundingClientRect().top; onEmpty(d, fromMin(H0 * 60 + Math.floor(y / PX * 2) * 30)); }}>
              {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * PX }} />)}
              {d === today && nowP.h >= H0 && nowP.h < H1 && <div className="absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: (nowP.h - H0 + nowP.m / 60) * PX }} />}
              {placed.map(({ it, top, h, lane }) => (
                <ItemBox key={it.key} it={it} tz={tz} onPick={onPick} compact={h < 34} style={{ position: "absolute", top, height: h - 2, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ anchor, items, tz, onPick, onDay }: { anchor: string; items: Item[]; tz: string; onPick: (s: Selection) => void; onDay: (d: string) => void }) {
  const first = anchor.slice(0, 8) + "01";
  const start = shiftDate(first, -((dowOf(first) + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
  const today = todayIn(tz);
  return (
    <div className="grid grid-cols-7">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b px-2 py-1.5 text-xs uppercase text-muted-foreground">{d}</div>)}
      {cells.map((d) => {
        const ds = +new Date(zonedToUtc(d, "00:00", tz)), de = +new Date(zonedToUtc(shiftDate(d, 1), "00:00", tz));
        const its = items.filter((i) => overlaps(+new Date(i.start), +new Date(i.end), ds, de));
        return (
          <div key={d} onClick={() => onDay(d)} className={cn("min-h-28 cursor-pointer border-b border-l p-1 hover:bg-muted/50", d.slice(0, 7) !== first.slice(0, 7) && "bg-muted/30 text-muted-foreground")}>
            <div className={cn("mb-1 text-right text-xs", d === today && "font-bold text-destructive")}>{fmtDate(d, "d")}</div>
            <div className="grid gap-0.5">
              {its.slice(0, 3).map((it) => <ItemBox key={it.key} it={it} tz={tz} compact onPick={onPick} />)}
              {its.length > 3 && <span className="text-[11px] text-muted-foreground">+{its.length - 3} more</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Agenda({ from, items, tz, onPick }: { from: string; items: Item[]; tz: string; onPick: (s: Selection) => void }) {
  const startTs = zonedToUtc(from, "00:00", tz);
  const upcoming = items.filter((i) => i.end >= startTs).slice(0, 80);
  const groups = new Map<string, Item[]>();
  upcoming.forEach((i) => { const d = tzParts(i.start, tz).date; groups.set(d, [...(groups.get(d) ?? []), i]); });
  if (!upcoming.length) return <p className="p-8 text-center text-muted-foreground">Nothing scheduled from this date.</p>;
  return (
    <div className="divide-y">
      {[...groups].map(([d, its]) => (
        <div key={d} className="grid gap-2 p-3 md:grid-cols-[160px_1fr]">
          <div className="font-serif">{fmtDate(d, "EEE, MMM d")}</div>
          <div className="divide-y rounded-md border">
            {its.map((it) => (
              <button key={it.key} onClick={() => onPick(it.sel)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
                <span className="w-32 shrink-0 text-muted-foreground">{fmtTime(it.start, tz)} – {fmtTime(it.end, tz)}</span>
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
                <span className="min-w-0 flex-1 truncate"><b className="font-medium">{it.title}</b> <span className="text-muted-foreground">· {it.sub}</span></span>
                {it.status && <StatusBadge status={it.status} />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockDialog({ open, onOpenChange, date, defaultAdv }: { open: boolean; onOpenChange: (o: boolean) => void; date: string; defaultAdv?: string }) {
  const s = useStore();
  const [b, setB] = useState({ kind: "court" as EventKind, title: "", adv: defaultAdv ?? s.advocates[0].id, loc: s.locations[0].id, date, from: "09:00", to: "12:00" });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setB((x) => ({ ...x, date, adv: defaultAdv ?? x.adv })); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Block calendar time</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Pick value={b.kind} onChange={(v) => setB({ ...b, kind: v as EventKind })} items={(Object.keys(eventLabel) as EventKind[]).map((k) => [k, eventLabel[k]])} /></Field>
          <Field label="Advocate"><Pick value={b.adv} onChange={(v) => setB({ ...b, adv: v })} items={s.advocates.map((a) => [a.id, a.name])} /></Field>
          <div className="col-span-2"><Field label="Title"><Input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder={b.kind === "court" ? "e.g. NY Supreme Court — Motion hearing" : "Title"} /></Field></div>
          <Field label="Location"><Pick value={b.loc} onChange={(v) => setB({ ...b, loc: v })} items={s.locations.map((l) => [l.id, l.name])} /></Field>
          <Field label="Date"><Input type="date" value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })} /></Field>
          <Field label="From"><Input type="time" value={b.from} onChange={(e) => setB({ ...b, from: e.target.value })} /></Field>
          <Field label="To"><Input type="time" value={b.to} onChange={(e) => setB({ ...b, to: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            if (toMin(b.to) <= toMin(b.from)) return toast.error("End must be after start");
            const tz = s.locations.find((l) => l.id === b.loc)!.tz;
            const start = zonedToUtc(b.date, b.from, tz), end = zonedToUtc(b.date, b.to, tz);
            addEvent({ kind: b.kind, title: b.title || eventLabel[b.kind], advocateIds: [b.adv], locationId: b.loc, start, end });
            const clash = s.appointments.filter((a) => a.advocateId === b.adv && a.status !== "cancelled" && overlaps(+new Date(start), +new Date(end), +new Date(a.start), +new Date(a.end))).length;
            if (clash) toast.warning(`${clash} existing appointment(s) overlap this block — review and reschedule.`); else toast.success("Time blocked");
            onOpenChange(false);
          }}>Save block</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
