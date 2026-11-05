import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { addHoliday, removeHoliday, updateAdvocate, useCurrentUser, useStore } from "@/lib/store";
import { fmtDate } from "@/lib/time";
import { toneVar } from "@/components/app/ui-bits";



const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminPage() {
  const s = useStore();
  const me = useCurrentUser();
  const [hol, setHol] = useState<Record<string, string>>({});
  if (me.role !== "admin") return <div className="p-10 text-center text-muted-foreground">Firm settings are available to Firm Admins. Switch view to <b>Margaret Cole</b>, or go <Link to="/" className="underline">back to the calendar</Link>.</div>;
  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-5">
      <h1 className="text-2xl">Firm settings · {s.tenant.name}</h1>
      <section>
        <h2 className="mb-3 text-lg">Locations & rooms</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {s.locations.map((l) => (
            <div key={l.id} className="rounded-lg border bg-card p-4 text-sm">
              <p className="font-serif text-base">{l.name}</p>
              <p className="text-muted-foreground">{l.address}</p>
              <p className="mt-1 text-muted-foreground">Time zone: {l.tz} · Hours Mon–Fri {l.hours[1]?.join("–")}</p>
              <p className="mt-3 font-medium">Rooms</p>
              <ul className="text-muted-foreground">{s.rooms.filter((r) => r.locationId === l.id).map((r) => <li key={r.id}>{r.name} · seats {r.capacity}</li>)}</ul>
              <p className="mt-3 font-medium">Holidays (office closed)</p>
              <div className="my-1.5 flex flex-wrap gap-1">{l.holidays.map((d) => <Badge key={d} variant="secondary" className="gap-1">{fmtDate(d, "MMM d, yyyy")}<button onClick={() => removeHoliday(l.id, d)}><X className="size-3" /></button></Badge>)}{!l.holidays.length && <span className="text-muted-foreground">None</span>}</div>
              <div className="flex gap-2"><Input type="date" value={hol[l.id] ?? ""} onChange={(e) => setHol({ ...hol, [l.id]: e.target.value })} /><Button size="sm" variant="outline" disabled={!hol[l.id]} onClick={() => addHoliday(l.id, hol[l.id])}>Add</Button></div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg">Advocates & availability</h2>
        <div className="grid gap-4">
          {s.advocates.map((a) => (
            <div key={a.id} className="grid gap-4 rounded-lg border bg-card p-4 text-sm md:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="font-serif text-base">{a.name} <span className="font-sans text-xs text-muted-foreground">· {a.title}</span></p>
                <div className="my-1.5 flex flex-wrap gap-1">{a.specializations.map((x) => <Badge key={x} variant="outline">{x}</Badge>)}</div>
                <p className="text-muted-foreground">Languages: {a.languages.join(", ")} · ${a.fee}/hr</p>
                <div className="mt-3 flex gap-3">
                  <label className="grid gap-1 text-xs text-muted-foreground">Buffer before (min)<Input type="number" min={0} step={5} className="w-24" value={a.bufferBefore} onChange={(e) => updateAdvocate(a.id, { bufferBefore: Number(e.target.value) })} /></label>
                  <label className="grid gap-1 text-xs text-muted-foreground">Buffer after (min)<Input type="number" min={0} step={5} className="w-24" value={a.bufferAfter} onChange={(e) => updateAdvocate(a.id, { bufferAfter: Number(e.target.value) })} /></label>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1">Day</th><th>Location</th><th>Hours</th></tr></thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((d) => {
                    const blk = a.schedule.find((x) => x.dow === d);
                    return (
                      <tr key={d} className="border-t">
                        <td className="py-1.5">{DOW[d]}</td>
                        <td>
                          <select className="rounded border bg-background px-1 py-0.5" value={blk?.locationId ?? ""} onChange={(e) => {
                            const rest = a.schedule.filter((x) => x.dow !== d);
                            updateAdvocate(a.id, { schedule: e.target.value ? [...rest, { dow: d, locationId: e.target.value, start: blk?.start ?? "09:00", end: blk?.end ?? "17:00" }] : rest });
                          }}>
                            <option value="">Not working</option>
                            {s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </td>
                        <td>{blk ? (
                          <span className="flex items-center gap-1">
                            <input type="time" className="rounded border bg-background px-1" value={blk.start} onChange={(e) => updateAdvocate(a.id, { schedule: a.schedule.map((x) => (x === blk ? { ...x, start: e.target.value } : x)) })} />–
                            <input type="time" className="rounded border bg-background px-1" value={blk.end} onChange={(e) => updateAdvocate(a.id, { schedule: a.schedule.map((x) => (x === blk ? { ...x, end: e.target.value } : x)) })} />
                          </span>) : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg">Services</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {s.services.map((x) => (
            <div key={x.id} className="flex gap-3 rounded-lg border bg-card p-4 text-sm">
              <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: toneVar(x.tone) }} />
              <div><p className="font-medium">{x.name}</p><p className="text-muted-foreground">{x.duration} min · ${x.fee} · <span className="capitalize">{x.modes.join(", ")}</span></p><p className="text-muted-foreground">{x.description}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
