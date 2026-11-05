import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Lock } from "lucide-react";
import { updateClientNotes, useCurrentUser, useStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/time";
import { StatusBadge } from "@/components/app/ui-bits";
import { DetailsSheet, type Selection } from "@/components/app/DetailsSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";



export function ClientsPage() {
  const s = useStore();
  const me = useCurrentUser();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [appt, setAppt] = useState<Selection>(null);
  const [notes, setNotes] = useState("");
  const visible = s.clients.filter((c) => (me.role !== "advocate" || s.appointments.some((a) => a.clientId === c.id && a.advocateId === me.advocateId)) && (c.name + c.email + c.phone).toLowerCase().includes(q.toLowerCase()));
  const c = s.clients.find((x) => x.id === sel) ?? visible[0];
  const history = c ? s.appointments.filter((a) => a.clientId === c.id).sort((a, b) => b.start.localeCompare(a.start)) : [];
  const pick = (id: string) => { setSel(id); setNotes(s.clients.find((x) => x.id === id)?.notes ?? ""); };
  const currentNotes = sel === c?.id ? notes : c?.notes ?? "";

  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 md:grid-cols-[340px_1fr]">
      <div>
        <h1 className="mb-3 text-2xl">Clients</h1>
        <div className="relative mb-3"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {visible.map((x) => {
            const n = s.appointments.filter((a) => a.clientId === x.id).length;
            return (
              <button key={x.id} onClick={() => pick(x.id)} className={cn("flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50", c?.id === x.id && "bg-secondary")}>
                <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.email}</div></div>
                <span className="text-xs text-muted-foreground">{n} appt{n === 1 ? "" : "s"}</span>
              </button>
            );
          })}
          {!visible.length && <p className="p-4 text-sm text-muted-foreground">No clients found.</p>}
        </div>
      </div>
      {c && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-xl">{c.name}</h2>
          <p className="text-sm text-muted-foreground">{c.email} · {c.phone} · client since {new Date(c.createdAt).toLocaleDateString()}</p>
          <div className="mt-5">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Lock className="size-3.5" /> Private notes <span className="font-normal text-muted-foreground">(internal only, never sent to client)</span></p>
            <Textarea rows={3} value={currentNotes} onChange={(e) => { setSel(c.id); setNotes(e.target.value); }} />
            <Button size="sm" className="mt-2" onClick={() => { updateClientNotes(c.id, currentNotes); toast.success("Notes saved"); }}>Save notes</Button>
          </div>
          <h3 className="mb-2 mt-6 text-lg">Appointment history</h3>
          <div className="divide-y rounded-md border">
            {history.map((a) => {
              const loc = s.locations.find((l) => l.id === a.locationId)!;
              return (
                <button key={a.id} onClick={() => setAppt({ type: "appt", id: a.id })} className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
                  <span className="w-56 text-muted-foreground">{fmtDateTime(a.start, loc.tz)}</span>
                  <span className="flex-1">{s.services.find((x) => x.id === a.serviceId)?.name} · {s.advocates.find((x) => x.id === a.advocateId)?.name}</span>
                  <StatusBadge status={a.status} />
                </button>
              );
            })}
            {!history.length && <p className="p-3 text-sm text-muted-foreground">No appointments yet.</p>}
          </div>
        </div>
      )}
      <DetailsSheet sel={appt} onClose={() => setAppt(null)} />
    </div>
  );
}
