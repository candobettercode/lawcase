import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { errorText } from "@/lib/staff";
import { locationFormSchema } from "@/lib/admin-schema";
import { AdminOnlyNotice, SettingsHeader } from "@/components/settings/SettingsShell";
import { ConfirmDialog, EmptyState, Field, FormDrawer, FutureAppointmentsPanel, ListSkeleton, Pager, StatusBadge, WEEKDAYS, selectClass, useDirectoryAccess, useFutureAppointments, usePaged } from "@/components/settings/admin-ui";

export const Route = createFileRoute("/_authenticated/settings/locations")({ head: () => pageHead("Locations Settings", "Manage firm offices and virtual consultation locations.", true), component: Page });

type Loc = { id: string; name: string; kind: string; address: string; city: string; phone: string; email: string; timezone: string; active: boolean; default_hours: unknown; holidays: string[] };
type Form = { name: string; kind: "physical" | "virtual"; address: string; city: string; phone: string; email: string; timezone: string; active: boolean; default_hours: { weekday: number; start: string; end: string }[]; holidays: string[] };
const blank: Form = { name: "", kind: "physical", address: "", city: "", phone: "", email: "", timezone: "Asia/Dhaka", active: true, default_hours: [], holidays: [] };
const zones = typeof Intl.supportedValuesOf === "function" ? [...new Set(["Asia/Dhaka", ...Intl.supportedValuesOf("timeZone")])] : ["Asia/Dhaka", "UTC"];

function useLocations() {
  return useQuery({
    queryKey: ["admin-locations"],
    queryFn: async () => {
      const [l, al, adv] = await Promise.all([
        supabase.from("locations").select("id,name,kind,address,city,phone,email,timezone,active,default_hours,holidays").eq("is_deleted", false).order("sort_order"),
        supabase.from("advocate_locations").select("location_id,advocate_id"),
        supabase.from("advocates").select("id,name,active").eq("is_deleted", false).order("name"),
      ]);
      if (l.error) throw l.error;
      const counts = new Map<string, number>();
      (al.data ?? []).forEach((r) => counts.set(r.location_id, (counts.get(r.location_id) ?? 0) + 1));
      return { locations: (l.data ?? []) as Loc[], counts, advocates: adv.data ?? [] };
    },
  });
}

function Page() {
  const access = useDirectoryAccess();
  const qc = useQueryClient();
  const q = useLocations();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [kind, setKind] = useState("all");
  const [editing, setEditing] = useState<{ id: string | null; form: Form; initial: string; view?: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Loc | null>(null);
  const [blocked, setBlocked] = useState<{ loc: Loc; message: string } | null>(null);
  const [affected, setAffected] = useState<Loc | null>(null);
  const future = useFutureAppointments(affected ? { locationId: affected.id } : null);

  const rows = useMemo(() => (q.data?.locations ?? []).filter((l) =>
    (status === "all" || (status === "active") === l.active) && (kind === "all" || l.kind === kind) &&
    `${l.name} ${l.city}`.toLowerCase().includes(search.trim().toLowerCase())), [q.data, search, status, kind]);
  const paged = usePaged(rows);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["admin-locations"] }); await qc.invalidateQueries({ queryKey: ["booking-directory"] }); };

  if (!access.loading && !access.canManage) return <><SettingsHeader title="Locations" /><AdminOnlyNotice what="locations" /></>;

  const open = (l: Loc | null, view = false) => {
    const form: Form = l ? { name: l.name, kind: l.kind as Form["kind"], address: l.address, city: l.city, phone: l.phone, email: l.email, timezone: l.timezone, active: l.active, default_hours: (l.default_hours as Form["default_hours"]) ?? [], holidays: l.holidays ?? [] } : blank;
    setErrors({}); setEditing({ id: l?.id ?? null, form, initial: JSON.stringify(form), view });
  };
  async function save() {
    if (!editing) return;
    const parsed = locationFormSchema.safeParse(editing.form);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    const wasActive = q.data?.locations.find((l) => l.id === editing.id)?.active;
    const { error } = await supabase.rpc("admin_save_location", { _id: editing.id as string, _data: parsed.data as never });
    if (error) return toast.error(errorText(error));
    toast.success(editing.id ? "Location updated" : "Location added");
    const saved = q.data?.locations.find((l) => l.id === editing.id);
    setEditing(null); await refresh();
    if (saved && wasActive && !parsed.data.active) setAffected(saved);
  }
  async function setActive(l: Loc, active: boolean) {
    const { error } = await supabase.rpc("admin_set_active", { _entity: "location", _id: l.id, _active: active });
    if (error) return toast.error(errorText(error));
    toast.success(active ? "Location activated" : "Location deactivated — hidden from public booking");
    await refresh();
    if (!active) setAffected(l);
  }
  async function remove(l: Loc) {
    const { error } = await supabase.rpc("admin_delete_location", { _id: l.id });
    setDeleting(null);
    if (error) { if (error.message.includes("LINKED")) return setBlocked({ loc: l, message: errorText(error) }); return toast.error(errorText(error)); }
    toast.success("Location deleted"); await refresh();
  }
  const f = editing?.form; const set = (patch: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });

  return <>
    <SettingsHeader title="Locations" description="Active locations appear automatically in the public booking form." action={<Button className="h-11" onClick={() => open(null)}><Plus /> Add Location</Button>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
      <Input aria-label="Search locations" placeholder="Search by name or city" className="h-11 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select aria-label="Filter by type" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All types</option><option value="physical">Physical</option><option value="virtual">Virtual</option></select>
    </div>
    {q.isLoading ? <ListSkeleton /> : !q.data?.locations.length ? <EmptyState action={<Button onClick={() => open(null)}>Add Location</Button>}>No locations yet. Add your first location.</EmptyState> : !rows.length ? <EmptyState>No locations match these filters.</EmptyState> : <>
      <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">City</th><th className="p-3">Contact</th><th className="p-3">Advocates</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{paged.items.map((l) => <tr key={l.id} className="border-b last:border-0">
            <td className="p-3 font-medium">{l.name}</td><td className="p-3 capitalize">{l.kind}</td><td className="p-3">{l.city || "—"}</td><td className="p-3">{l.phone || "—"}</td>
            <td className="p-3">{q.data.counts.get(l.id) ?? 0}</td><td className="p-3"><StatusBadge active={l.active} /></td>
            <td className="p-3"><RowActions l={l} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">{paged.items.map((l) => <li key={l.id} className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{l.name}</p><p className="text-sm capitalize text-muted-foreground">{l.kind} · {l.city || "No city"} · {q.data.counts.get(l.id) ?? 0} advocates</p></div><StatusBadge active={l.active} /></div>
        <div className="mt-3"><RowActions l={l} /></div>
      </li>)}</ul>
      <Pager {...paged} />
    </>}

    <FormDrawer open={!!editing} title={editing?.view ? "Location details" : editing?.id ? "Edit location" : "Add location"} dirty={!!editing && !editing.view && JSON.stringify(editing.form) !== editing.initial} onClose={() => setEditing(null)}>
      {f && <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <fieldset disabled={editing?.view} className="grid gap-4">
          <Field id="l-name" label="Location Name" required error={errors.name}><Input id="l-name" className="h-11" value={f.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} /></Field>
          <Field id="l-kind" label="Type"><select id="l-kind" className={selectClass} value={f.kind} onChange={(e) => set({ kind: e.target.value as Form["kind"] })}><option value="physical">Physical</option><option value="virtual">Virtual</option></select></Field>
          {f.kind === "physical" && <Field id="l-address" label="Address" required error={errors.address}><Input id="l-address" className="h-11" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="l-city" label="City"><Input id="l-city" className="h-11" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field id="l-phone" label="Contact Number"><Input id="l-phone" type="tel" className="h-11" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          </div>
          <Field id="l-email" label="Contact Email" error={errors.email}><Input id="l-email" type="email" className="h-11" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field id="l-tz" label="Time Zone"><select id="l-tz" className={selectClass} value={f.timezone} onChange={(e) => set({ timezone: e.target.value })}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select></Field>
          <div className="grid gap-2"><p className="text-sm font-medium">Default working hours (optional)</p>
            {WEEKDAYS.map((d, wd) => { const h = f.default_hours.find((x) => x.weekday === wd); return <div key={d} className="grid grid-cols-[48px_auto_1fr_1fr] items-center gap-2 text-sm">
              <span>{d}</span><Switch aria-label={`Open on ${d}`} checked={!!h} onCheckedChange={(on) => set({ default_hours: on ? [...f.default_hours, { weekday: wd, start: "09:00", end: "17:00" }] : f.default_hours.filter((x) => x.weekday !== wd) })} />
              {h ? <><Input aria-label={`${d} opens`} type="time" className="h-11" value={h.start} onChange={(e) => set({ default_hours: f.default_hours.map((x) => x.weekday === wd ? { ...x, start: e.target.value } : x) })} />
                <Input aria-label={`${d} closes`} type="time" className="h-11" value={h.end} onChange={(e) => set({ default_hours: f.default_hours.map((x) => x.weekday === wd ? { ...x, end: e.target.value } : x) })} /></> : <span className="col-span-2 text-muted-foreground">Closed</span>}
            </div>; })}
            <p className="text-xs text-muted-foreground">Used as the starting point for advocate hours at this location.</p>
          </div>
          <HolidayEditor value={f.holidays} onChange={(holidays) => set({ holidays })} />
          <div className="flex items-center justify-between rounded-md border p-3"><label htmlFor="l-active" className="text-sm font-medium">Active (shown in public booking)</label><Switch id="l-active" checked={f.active} onCheckedChange={(active) => set({ active })} /></div>
        </fieldset>
        {editing?.view ? <Button type="button" className="h-11" onClick={() => setEditing({ ...editing, view: false })}>Edit</Button> : <Button type="submit" className="h-11">Save location</Button>}
      </form>}
    </FormDrawer>

    <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this location?" description={`"${deleting?.name}" will be permanently removed. Locations with linked advocates or appointments can only be deactivated.`} onConfirm={async () => { if (deleting) await remove(deleting); }} />
    <ConfirmDialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)} title="This location can't be deleted" description={blocked?.message} confirmLabel="Deactivate instead" destructive={false} onConfirm={async () => { if (blocked) { await setActive(blocked.loc, false); setBlocked(null); } }} />
    <ConfirmDialog open={!!affected && (future.data?.length ?? 0) > 0} onOpenChange={(o) => !o && setAffected(null)} title="Upcoming appointments at this location" description="The location is now hidden from public booking. Reassign or cancel these appointments; to move them to another office, reschedule them from the calendar." confirmLabel="Done" destructive={false} onConfirm={() => setAffected(null)}>
      <FutureAppointmentsPanel rows={future.data ?? []} advocates={q.data?.advocates ?? []} onChanged={() => void future.refetch()} />
    </ConfirmDialog>
  </>;

  function RowActions({ l }: { l: Loc }) {
    return <div className="flex flex-wrap justify-end gap-1 xl:flex-nowrap">
      <Button variant="ghost" className="h-11" onClick={() => open(l, true)} aria-label={`View ${l.name}`}>View</Button>
      <Button variant="ghost" className="h-11" onClick={() => open(l)} aria-label={`Edit ${l.name}`}>Edit</Button>
      <Button variant="ghost" className="h-11" onClick={() => setActive(l, !l.active)}>{l.active ? "Deactivate" : "Activate"}</Button>
      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setDeleting(l)} aria-label={`Delete ${l.name}`}>Delete</Button>
    </div>;
  }
}

function HolidayEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [d, setD] = useState("");
  return <div className="grid gap-2">
    <label htmlFor="l-holiday" className="text-sm font-medium">Holidays (office closed)</label>
    <div className="flex gap-2"><Input id="l-holiday" type="date" className="h-11" value={d} onChange={(e) => setD(e.target.value)} /><Button type="button" variant="outline" className="h-11" disabled={!d || value.includes(d)} onClick={() => { onChange([...value, d].sort()); setD(""); }}>Add</Button></div>
    {value.length > 0 && <ul className="flex flex-wrap gap-2">{value.map((h) => <li key={h} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{h}<button type="button" aria-label={`Remove holiday ${h}`} className="grid size-6 place-items-center" onClick={() => onChange(value.filter((x) => x !== h))}><X className="size-3" /></button></li>)}</ul>}
  </div>;
}
