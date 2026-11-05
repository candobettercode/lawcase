import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, XCircle } from "lucide-react";
import { checkConflicts, createAppointment, freeRoom, upsertClient, useStore, type Mode } from "@/lib/store";
import { fromMin, toMin, zonedToUtc } from "@/lib/time";
import { toast } from "sonner";

export interface QuickBookPrefill { date: string; time: string; advocateId?: string; locationId?: string }

export function QuickBookDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill: QuickBookPrefill | null }) {
  const s = useStore();
  const [f, setF] = useState({ date: "", time: "", locationId: "", advocateId: "", serviceId: "svc-pc", mode: "in-person" as Mode, clientId: "", newName: "", newEmail: "", newPhone: "", opposing: "" });
  useEffect(() => {
    if (open && prefill) setF((x) => ({ ...x, date: prefill.date, time: prefill.time, advocateId: prefill.advocateId ?? s.advocates[0].id, locationId: prefill.locationId ?? s.locations[0].id, clientId: "", newName: "", newEmail: "", newPhone: "", opposing: "" }));
  }, [open, prefill]); // eslint-disable-line react-hooks/exhaustive-deps
  const svc = s.services.find((x) => x.id === f.serviceId)!;
  const loc = s.locations.find((l) => l.id === f.locationId);
  const times = useMemo(() => {
    if (!f.date || !f.time || !loc) return null;
    return { start: zonedToUtc(f.date, f.time, loc.tz), end: zonedToUtc(f.date, fromMin(toMin(f.time) + svc.duration), loc.tz) };
  }, [f.date, f.time, loc, svc]);
  const room = times && f.mode === "in-person" ? freeRoom(s, f.locationId, times.start, times.end) : undefined;
  const conflicts = times ? checkConflicts(s, { advocateId: f.advocateId, locationId: f.locationId, start: times.start, end: times.end, roomId: room?.id }) : [];
  if (times && f.mode === "in-person" && !room) conflicts.push({ level: "error", message: "No consultation room is free at this time." });
  const hasError = conflicts.some((c) => c.level === "error");
  const modes = svc.modes;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!times || hasError) return;
    if (conflicts.length) return toast.error("Choose an available time outside working-hour, travel, meeting and appointment conflicts.");
    if (!f.clientId && !f.newName) return toast.error("Choose a client or enter a new client's name");
    const clientId = f.clientId || upsertClient({ name: f.newName, email: f.newEmail, phone: f.newPhone, notes: "" });
    createAppointment({ serviceId: f.serviceId, advocateId: f.advocateId, clientId, locationId: f.locationId, roomId: room?.id, start: times.start, end: times.end, mode: f.mode, status: "confirmed", opposingParty: f.opposing, intake: "" });
    toast.success("Appointment saved in the local preview", { description: "No confirmation message has been sent." });
    onOpenChange(false);
  }
  const up = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v, ...(k === "serviceId" ? { mode: s.services.find((y) => y.id === v)!.modes[0] } : {}) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Quick booking</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => up("date")(e.target.value)} /></Field>
            <Field label="Start time"><Input type="time" step={900} value={f.time} onChange={(e) => up("time")(e.target.value)} /></Field>
            <Field label="Service"><Pick value={f.serviceId} onChange={up("serviceId")} items={s.services.map((x) => [x.id, `${x.name} (${x.duration}m)`])} /></Field>
            <Field label="Mode"><Pick value={f.mode} onChange={up("mode")} items={modes.map((m) => [m, m])} /></Field>
            <Field label="Advocate"><Pick value={f.advocateId} onChange={up("advocateId")} items={s.advocates.map((a) => [a.id, a.name])} /></Field>
            <Field label="Location"><Pick value={f.locationId} onChange={up("locationId")} items={s.locations.map((l) => [l.id, l.name])} /></Field>
          </div>
          <Field label="Existing client">
            <Pick value={f.clientId || "new"} onChange={(v) => up("clientId")(v === "new" ? "" : v)} items={[["new", "+ New client"], ...s.clients.map((c) => [c.id, c.name] as [string, string])]} />
          </Field>
          {!f.clientId && (
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Full name" value={f.newName} onChange={(e) => up("newName")(e.target.value)} />
              <Input placeholder="Email" type="email" value={f.newEmail} onChange={(e) => up("newEmail")(e.target.value)} />
              <Input placeholder="Phone" value={f.newPhone} onChange={(e) => up("newPhone")(e.target.value)} />
            </div>
          )}
          <Field label="Opposing party (for conflict check)"><Input value={f.opposing} onChange={(e) => up("opposing")(e.target.value)} placeholder="Optional" /></Field>
          {room && <p className="text-xs text-muted-foreground">Room auto-assigned: <b>{room.name}</b></p>}
          {conflicts.length > 0 && (
            <ul className="space-y-1 rounded-md border bg-muted/50 p-2 text-sm">
              {conflicts.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  {c.level === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--status-pending)" }} />}
                  {c.message}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={conflicts.length > 0}>Book appointment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
export function Pick({ value, onChange, items, placeholder }: { value: string; onChange: (v: string) => void; items: [string, string][]; placeholder?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="capitalize"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v} className="capitalize">{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
