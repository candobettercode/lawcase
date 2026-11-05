import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Bell, CalendarDays, Download, Trash2 } from "lucide-react";
import { checkConflicts, deleteEvent, downloadIcs, freeRoom, sendReminder, updateAppointment, useStore, type Status } from "@/lib/store";
import { fmtDateTime, fromMin, toMin, tzParts, zonedToUtc } from "@/lib/time";
import { StatusBadge, eventLabel, eventVar } from "./ui-bits";
import { toast } from "sonner";

export type Selection = { type: "appt" | "event"; id: string } | null;

export function DetailsSheet({ sel, onClose }: { sel: Selection; onClose: () => void }) {
  const s = useStore();
  const a = sel?.type === "appt" ? s.appointments.find((x) => x.id === sel.id) : undefined;
  const e = sel?.type === "event" ? s.events.find((x) => x.id === sel.id) : undefined;
  const loc = s.locations.find((l) => l.id === (a?.locationId ?? e?.locationId)) ?? s.locations[0];
  const [rs, setRs] = useState({ date: "", time: "" });
  useEffect(() => { if (a) { const p = tzParts(a.start, loc.tz); setRs({ date: p.date, time: fromMin(p.h * 60 + p.m) }); } }, [a?.id, a?.start]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode = null;
  if (a) {
    const svc = s.services.find((x) => x.id === a.serviceId)!;
    const adv = s.advocates.find((x) => x.id === a.advocateId)!;
    const cl = s.clients.find((x) => x.id === a.clientId)!;
    const room = s.rooms.find((r) => r.id === a.roomId);
    const newStart = rs.date ? zonedToUtc(rs.date, rs.time, loc.tz) : a.start;
    const newEnd = rs.date ? zonedToUtc(rs.date, fromMin(toMin(rs.time) + svc.duration), loc.tz) : a.end;
    const changed = newStart !== a.start;
    const newRoom = a.mode === "in-person" ? freeRoom(s, a.locationId, newStart, newEnd, a.id) : undefined;
    const conflicts = changed ? checkConflicts(s, { advocateId: a.advocateId, locationId: a.locationId, start: newStart, end: newEnd, ignoreId: a.id, roomId: newRoom?.id }) : [];
    const liveConflicts = !changed && a.status !== "cancelled" ? checkConflicts(s, { advocateId: a.advocateId, locationId: a.locationId, start: a.start, end: a.end, ignoreId: a.id }).filter((c) => c.level === "error") : [];
    body = (
      <div className="space-y-5 px-4 pb-6 text-sm">
        <div className="flex items-center justify-between"><StatusBadge status={a.status} /><span className="capitalize text-muted-foreground">{a.mode}</span></div>
        {liveConflicts.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
            {liveConflicts.map((c, i) => <p key={i} className="flex gap-2"><AlertTriangle className="size-4 shrink-0" />{c.message}</p>)}
          </div>
        )}
        <dl className="grid grid-cols-[110px_1fr] gap-y-2">
          <dt className="text-muted-foreground">When</dt><dd>{fmtDateTime(a.start, loc.tz)} · {svc.duration}m</dd>
          <dt className="text-muted-foreground">Client</dt><dd>{cl.name}<br /><span className="text-muted-foreground">{cl.email} · {cl.phone}</span></dd>
          <dt className="text-muted-foreground">Advocate</dt><dd>{adv.name}</dd>
          <dt className="text-muted-foreground">Location</dt><dd>{loc.name}{room ? ` · ${room.name}` : ""}</dd>
          <dt className="text-muted-foreground">Fee</dt><dd>${svc.fee}</dd>
          {a.opposingParty && <><dt className="text-muted-foreground">Opposing party</dt><dd>{a.opposingParty}</dd></>}
          {a.intake && <><dt className="text-muted-foreground">Intake</dt><dd className="whitespace-pre-wrap">{a.intake}</dd></>}
        </dl>
        <Separator />
        <div>
          <p className="mb-2 font-medium">Change status</p>
          <div className="flex flex-wrap gap-2">
            {(["pending", "confirmed", "completed", "no-show", "cancelled"] as Status[]).map((st) => (
              <Button key={st} size="sm" variant={a.status === st ? "default" : "outline"} className="capitalize" onClick={() => { updateAppointment(a.id, { status: st }); toast.success(`Marked ${st}`); }}>{st}</Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-medium">Reschedule</p>
          <div className="flex gap-2">
            <Input type="date" value={rs.date} onChange={(ev) => setRs({ ...rs, date: ev.target.value })} />
            <Input type="time" step={900} value={rs.time} onChange={(ev) => setRs({ ...rs, time: ev.target.value })} />
          </div>
          {conflicts.map((c, i) => <p key={i} className={`mt-1 flex gap-1.5 text-xs ${c.level === "error" ? "text-destructive" : "text-muted-foreground"}`}><AlertTriangle className="size-3.5 shrink-0" />{c.message}</p>)}
          <Button size="sm" className="mt-2" disabled={!changed || conflicts.some((c) => c.level === "error")}
            onClick={() => { updateAppointment(a.id, { start: newStart, end: newEnd, roomId: newRoom?.id }); toast.success("Rescheduled — client notified"); }}>
            <CalendarDays className="size-4" /> Save new time
          </Button>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { sendReminder(a.id); toast.success("Reminder queued"); }}><Bell className="size-4" /> Send reminder</Button>
          <Button size="sm" variant="outline" onClick={() => downloadIcs(s, a)}><Download className="size-4" /> .ics</Button>
        </div>
      </div>
    );
  } else if (e) {
    body = (
      <div className="space-y-4 px-4 pb-6 text-sm">
        <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium text-primary-foreground" style={{ background: eventVar[e.kind] }}>{eventLabel[e.kind]}</span>
        <dl className="grid grid-cols-[110px_1fr] gap-y-2">
          <dt className="text-muted-foreground">From</dt><dd>{fmtDateTime(e.start, loc.tz)}</dd>
          <dt className="text-muted-foreground">To</dt><dd>{fmtDateTime(e.end, loc.tz)}</dd>
          <dt className="text-muted-foreground">Advocates</dt><dd>{e.advocateIds.map((id) => s.advocates.find((x) => x.id === id)?.name).join(", ")}</dd>
          {e.locationId && <><dt className="text-muted-foreground">Location</dt><dd>{loc.name}</dd></>}
        </dl>
        {e.kind === "court" && <p className="rounded-md bg-muted p-2 text-xs">Court hearings take priority: the advocate's calendar is blocked and overlapping bookings are flagged.</p>}
        <Button size="sm" variant="outline" onClick={() => { deleteEvent(e.id); onClose(); }}><Trash2 className="size-4" /> Remove</Button>
      </div>
    );
  }
  return (
    <Sheet open={!!sel && !!(a || e)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{a ? s.services.find((x) => x.id === a.serviceId)?.name : e?.title}</SheetTitle></SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
