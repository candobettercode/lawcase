import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { errorText } from "@/lib/staff";
import { advocateFormSchema, passwordSchema, photoProblem } from "@/lib/admin-schema";
import { createAdvocateLogin, deleteAdvocate } from "@/lib/admin.functions";
import { AdminOnlyNotice, SettingsHeader } from "@/components/settings/SettingsShell";
import { ConfirmDialog, EmptyState, Field, FormDrawer, FutureAppointmentsPanel, Initials, ListSkeleton, Pager, StatusBadge, WEEKDAYS, selectClass, useDirectoryAccess, useFutureAppointments, usePaged } from "@/components/settings/admin-ui";

export const Route = createFileRoute("/_authenticated/settings/advocates")({ head: () => pageHead("Advocates Settings", "Manage advocate profiles, locations and working hours.", true), component: Page });

type Hour = { location_id: string; weekday: number; start: string; end: string };
type Adv = { id: string; name: string; email: string | null; phone: string; designation: string; bar_number: string | null; specializations: string[]; years_experience: number; bio: string; photo_url: string | null; slot_minutes: number; buffer_minutes: number; active: boolean; user_id: string | null };
type Form = { name: string; email: string; phone: string; designation: string; bar_number: string; specializations: string[]; years_experience: number; bio: string; photo_url: string; slot_minutes: number; buffer_minutes: number; active: boolean; locationIds: string[]; hours: Hour[]; tempPassword: string };
const blank: Form = { name: "", email: "", phone: "", designation: "", bar_number: "", specializations: [], years_experience: 0, bio: "", photo_url: "", slot_minutes: 30, buffer_minutes: 0, active: true, locationIds: [], hours: [], tempPassword: "" };
type SortKey = "name" | "designation" | "status";

function useAdvocates() {
  return useQuery({
    queryKey: ["admin-advocates"],
    queryFn: async () => {
      const [a, al, l, h] = await Promise.all([
        supabase.from("advocates").select("id,name,email,phone,designation,bar_number,specializations,years_experience,bio,photo_url,slot_minutes,buffer_minutes,active,user_id").eq("is_deleted", false).order("name"),
        supabase.from("advocate_locations").select("advocate_id,location_id"),
        supabase.from("locations").select("id,name,active,default_hours").eq("is_deleted", false).order("sort_order"),
        supabase.from("availability").select("advocate_id,location_id,weekday,start_time,end_time"),
      ]);
      if (a.error) throw a.error;
      return { advocates: (a.data ?? []) as Adv[], links: al.data ?? [], locations: l.data ?? [], hours: h.data ?? [] };
    },
  });
}

function Page() {
  const access = useDirectoryAccess();
  const qc = useQueryClient();
  const q = useAdvocates();
  const makeLogin = useServerFn(createAdvocateLogin); const removeFn = useServerFn(deleteAdvocate);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [loc, setLoc] = useState("all"); const [spec, setSpec] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [editing, setEditing] = useState<{ id: string | null; form: Form; initial: string; view?: boolean; hasLogin?: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Adv | null>(null);
  const [blocked, setBlocked] = useState<Adv | null>(null);
  const [conflicts, setConflicts] = useState<{ booking_ref: string; client_name: string; starts_at: string; problem: string }[] | null>(null);
  const future = useFutureAppointments(blocked ? { advocateId: blocked.id } : null);

  const locsOf = (id: string) => (q.data?.links ?? []).filter((l) => l.advocate_id === id).map((l) => l.location_id);
  const locName = (id: string) => q.data?.locations.find((l) => l.id === id)?.name ?? "";
  const allSpecs = useMemo(() => [...new Set((q.data?.advocates ?? []).flatMap((a) => a.specializations))].sort(), [q.data]);
  const rows = useMemo(() => (q.data?.advocates ?? []).filter((a) =>
    (status === "all" || (status === "active") === a.active) && (loc === "all" || locsOf(a.id).includes(loc)) && (spec === "all" || a.specializations.includes(spec)) &&
    `${a.name} ${a.email ?? ""} ${a.designation}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((x, y) => sort.dir * (sort.key === "status" ? Number(y.active) - Number(x.active) : String(x[sort.key]).localeCompare(String(y[sort.key])))), [q.data, search, status, loc, spec, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(rows);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["admin-advocates"] }); await qc.invalidateQueries({ queryKey: ["booking-directory"] }); };

  if (!access.loading && !access.canManage) return <><SettingsHeader title="Advocates" /><AdminOnlyNotice what="advocates" /></>;

  const open = (a: Adv | null, view = false) => {
    const form: Form = a ? { name: a.name, email: a.email ?? "", phone: a.phone, designation: a.designation, bar_number: a.bar_number ?? "", specializations: a.specializations, years_experience: a.years_experience, bio: a.bio, photo_url: a.photo_url ?? "", slot_minutes: a.slot_minutes, buffer_minutes: a.buffer_minutes, active: a.active,
      locationIds: locsOf(a.id), hours: (q.data?.hours ?? []).filter((h) => h.advocate_id === a.id).map((h) => ({ location_id: h.location_id, weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })), tempPassword: "" } : blank;
    setErrors({}); setEditing({ id: a?.id ?? null, form, initial: JSON.stringify(form), view, hasLogin: !!a?.user_id });
  };

  async function save() {
    if (!editing) return;
    const f = editing.form;
    const parsed = advocateFormSchema.safeParse(f);
    const errs: Record<string, string> = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    if (f.hours.some((h) => !f.locationIds.includes(h.location_id))) errs.hours = "Each working-hours range needs one of the assigned locations.";
    const needsLogin = !editing.hasLogin && f.tempPassword !== "";
    if (!editing.id && !f.tempPassword) errs.tempPassword = "Set a temporary password for the advocate's login.";
    if (f.tempPassword) { const p = passwordSchema.safeParse(f.tempPassword); if (!p.success) errs.tempPassword = p.error.issues[0].message; }
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    setBusy(true);
    try {
      const { locationIds, hours, ...data } = parsed.data;
      const { data: id, error } = await supabase.rpc("admin_save_advocate", { _id: editing.id as string, _data: data as never, _locations: locationIds, _hours: hours as never });
      if (error) throw error;
      if (needsLogin) {
        try { const r = await makeLogin({ data: { advocateId: id as string, tempPassword: f.tempPassword } }); toast.success(`Login created — username ${r.username}`); }
        catch (e) { toast.error(`Advocate saved, but the login could not be created: ${errorText(e)}`); }
      }
      toast.success(editing.id ? "Advocate updated" : "Advocate added");
      setEditing(null); await refresh();
      const { data: c } = await supabase.rpc("advocate_conflicts", { _advocate: id as string });
      if (c?.length) setConflicts(c);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function setActive(a: Adv, active: boolean) {
    const { error } = await supabase.rpc("admin_set_active", { _entity: "advocate", _id: a.id, _active: active });
    if (error) return toast.error(errorText(error));
    toast.success(active ? "Advocate activated" : "Advocate deactivated — removed from public booking");
    await refresh();
  }
  async function remove(a: Adv) {
    try {
      const r = await removeFn({ data: { advocateId: a.id } });
      toast.success(r.mode === "soft" ? "Advocate deleted from the directory; appointment history kept" : "Advocate permanently deleted");
      await refresh();
    } catch (e) {
      const msg = errorText(e);
      if (/upcoming appointments/i.test(msg)) setBlocked(a); else toast.error(msg);
    }
    setDeleting(null);
  }
  async function uploadPhoto(file: File) {
    const problem = photoProblem(file);
    if (problem) return toast.error(problem);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("advocate-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return toast.error("Photo upload failed. Only Administrators can upload photos.");
    const { data, error } = await supabase.storage.from("advocate-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (error || !data) return toast.error("Could not prepare the photo link.");
    set({ photo_url: data.signedUrl });
  }

  const f = editing?.form; const set = (p: Partial<Form>) => editing && setEditing((e) => e && { ...e, form: { ...e.form, ...p } });
  const sortBtn = (key: SortKey, label: string) => <button type="button" className="font-semibold uppercase" aria-label={`Sort by ${label}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>{label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</button>;

  function Actions({ a }: { a: Adv }) {
    return <div className="flex flex-wrap justify-end gap-1 xl:flex-nowrap">
      <Button variant="ghost" className="h-11" onClick={() => open(a, true)} aria-label={`View ${a.name}`}>View</Button>
      <Button variant="ghost" className="h-11" onClick={() => open(a)} aria-label={`Edit ${a.name}`}>Edit</Button>
      <Button variant="ghost" className="h-11" onClick={() => setActive(a, !a.active)}>{a.active ? "Deactivate" : "Activate"}</Button>
      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setDeleting(a)} aria-label={`Delete ${a.name}`}>Delete</Button>
    </div>;
  }

  return <>
    <SettingsHeader title="Advocates" description="Active advocates appear automatically in public booking for their assigned locations." action={<Button className="h-11" onClick={() => open(null)}><Plus /> Add Advocate</Button>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_150px_200px_200px]">
      <Input aria-label="Search advocates" placeholder="Search name, email or designation" className="h-11 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select aria-label="Filter by location" className={selectClass} value={loc} onChange={(e) => setLoc(e.target.value)}><option value="all">All locations</option>{q.data?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select aria-label="Filter by specialization" className={selectClass} value={spec} onChange={(e) => setSpec(e.target.value)}><option value="all">All specializations</option>{allSpecs.map((s) => <option key={s}>{s}</option>)}</select>
    </div>
    {q.isLoading ? <ListSkeleton /> : !q.data?.advocates.length ? <EmptyState action={<Button onClick={() => open(null)}>Add Advocate</Button>}>No advocates yet. Add your first advocate.</EmptyState> : !rows.length ? <EmptyState>No advocates match these filters.</EmptyState> : <>
      <div className="hidden overflow-x-auto rounded-md border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs tracking-wider text-muted-foreground"><tr><th className="p-3"><span className="sr-only">Photo</span></th><th className="p-3">{sortBtn("name", "Name")}</th><th className="p-3">{sortBtn("designation", "Designation")}</th><th className="p-3 uppercase">Email</th><th className="p-3 uppercase">Phone</th><th className="p-3 uppercase">Locations</th><th className="p-3">{sortBtn("status", "Status")}</th><th className="p-3 text-right uppercase">Actions</th></tr></thead>
          <tbody>{paged.items.map((a) => <tr key={a.id} className="border-b last:border-0">
            <td className="p-3"><Initials name={a.name} url={a.photo_url} /></td><td className="p-3 font-medium">{a.name}</td><td className="p-3">{a.designation || "—"}</td><td className="p-3">{a.email || "—"}</td><td className="p-3">{a.phone || "—"}</td>
            <td className="p-3">{locsOf(a.id).map(locName).join(", ") || "—"}</td><td className="p-3"><StatusBadge active={a.active} /></td><td className="p-3"><Actions a={a} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="grid gap-3 lg:hidden">{paged.items.map((a) => <li key={a.id} className="rounded-md border bg-card p-4">
        <div className="flex items-start gap-3"><Initials name={a.name} url={a.photo_url} size={48} /><div className="min-w-0 flex-1"><p className="font-semibold">{a.name}</p><p className="text-sm text-muted-foreground">{a.designation}</p><p className="truncate text-sm text-muted-foreground">{locsOf(a.id).map(locName).join(", ")}</p></div><StatusBadge active={a.active} /></div>
        <div className="mt-3"><Actions a={a} /></div>
      </li>)}</ul>
      <Pager {...paged} />
    </>}

    <FormDrawer open={!!editing} title={editing?.view ? "Advocate details" : editing?.id ? "Edit advocate" : "Add advocate"} dirty={!!editing && !editing.view && JSON.stringify(editing.form) !== editing.initial} onClose={() => setEditing(null)}>
      {f && <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <fieldset disabled={editing?.view} className="grid gap-4">
          <div className="flex items-center gap-4"><Initials name={f.name || "?"} url={f.photo_url || null} size={72} />
            <div className="grid gap-1"><label htmlFor="a-photo" className="text-sm font-medium">Profile Photo</label><input id="a-photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.target.value = ""; }} /><p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB. Initials are shown without a photo.</p>
              {f.photo_url && <Button type="button" variant="ghost" className="h-9 justify-start px-0 text-destructive" onClick={() => set({ photo_url: "" })}>Remove photo</Button>}</div></div>
          <Field id="a-name" label="Full Name" required error={errors.name}><Input id="a-name" className="h-11" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="a-email" label="Email" required error={errors.email}><Input id="a-email" type="email" className="h-11" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field id="a-phone" label="Phone" error={errors.phone}><Input id="a-phone" type="tel" className="h-11" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field id="a-desig" label="Designation"><Input id="a-desig" className="h-11" value={f.designation} onChange={(e) => set({ designation: e.target.value })} /></Field>
            <Field id="a-bar" label="Bar/License Number" error={errors.bar_number}><Input id="a-bar" className="h-11" value={f.bar_number} onChange={(e) => set({ bar_number: e.target.value })} /></Field>
          </div>
          <TagInput value={f.specializations} onChange={(specializations) => set({ specializations })} suggestions={allSpecs} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="a-years" label="Years of Experience" error={errors.years_experience}><Input id="a-years" type="number" min={0} max={80} className="h-11" value={f.years_experience} onChange={(e) => set({ years_experience: Number(e.target.value) })} /></Field>
            <Field id="a-dur" label="Appointment Duration (min)" error={errors.slot_minutes}><Input id="a-dur" type="number" min={10} max={240} step={5} className="h-11" value={f.slot_minutes} onChange={(e) => set({ slot_minutes: Number(e.target.value) })} /></Field>
            <Field id="a-buf" label="Buffer Time (min)" error={errors.buffer_minutes}><Input id="a-buf" type="number" min={0} max={120} step={5} className="h-11" value={f.buffer_minutes} onChange={(e) => set({ buffer_minutes: Number(e.target.value) })} /></Field>
          </div>
          <Field id="a-bio" label="Bio"><Textarea id="a-bio" rows={4} value={f.bio} onChange={(e) => set({ bio: e.target.value })} /></Field>
          <fieldset className="grid gap-2"><legend className="text-sm font-medium">Assigned Locations</legend>
            <div className="flex flex-wrap gap-2">{q.data?.locations.filter((l) => l.active || f.locationIds.includes(l.id)).map((l) => <label key={l.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" checked={f.locationIds.includes(l.id)} onChange={() => set(f.locationIds.includes(l.id) ? { locationIds: f.locationIds.filter((x) => x !== l.id), hours: f.hours.filter((h) => h.location_id !== l.id) } : { locationIds: [...f.locationIds, l.id] })} />{l.name}</label>)}</div></fieldset>
          <HoursEditor hours={f.hours} locations={(q.data?.locations ?? []).filter((l) => f.locationIds.includes(l.id))} onChange={(hours) => set({ hours })} error={errors.hours} />
          {!editing?.hasLogin && <Field id="a-pw" label={editing?.id ? "Create login — temporary password" : "Login temporary password"} required={!editing?.id} error={errors.tempPassword} hint="Creates the advocate's sign-in with this email. They must change it at first login."><Input id="a-pw" type="password" autoComplete="new-password" className="h-11" value={f.tempPassword} onChange={(e) => set({ tempPassword: e.target.value })} /></Field>}
          <div className="flex items-center justify-between rounded-md border p-3"><label htmlFor="a-active" className="text-sm font-medium">Active (bookable online)</label><Switch id="a-active" checked={f.active} onCheckedChange={(active) => set({ active })} /></div>
        </fieldset>
        {editing?.view ? <Button type="button" className="h-11" onClick={() => setEditing({ ...editing, view: false })}>Edit</Button> : <Button type="submit" className="h-11" disabled={busy}>{busy ? "Saving…" : "Save advocate"}</Button>}
      </form>}
    </FormDrawer>

    <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Are you sure you want to delete this advocate?" description={<>
      <p><strong>{deleting?.name}</strong> will be removed from public booking.</p><p className="mt-2">Advocates with past appointments are kept in history (soft delete). Advocates with upcoming appointments cannot be deleted until those are reassigned or cancelled.</p></>} onConfirm={async () => { if (deleting) await remove(deleting); }} />
    <ConfirmDialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)} title={`${blocked?.name} has upcoming appointments`} description="Reassign each appointment to another advocate or cancel it (staff and the advocate are notified). Then delete again." confirmLabel="Done" destructive={false} onConfirm={() => setBlocked(null)}>
      <FutureAppointmentsPanel rows={future.data ?? []} advocates={q.data?.advocates ?? []} excludeAdvocate={blocked?.id} onChanged={() => void future.refetch()} />
    </ConfirmDialog>
    <ConfirmDialog open={!!conflicts} onOpenChange={(o) => !o && setConflicts(null)} title="Upcoming appointments now conflict" description="These appointments no longer fit the advocate's locations or hours. Reschedule or reassign them from the calendar." confirmLabel="OK" destructive={false} onConfirm={() => setConflicts(null)}>
      <ul className="grid max-h-72 gap-2 overflow-y-auto text-sm">{conflicts?.map((c) => <li key={c.booking_ref} className="rounded-md border p-3"><strong>{c.booking_ref}</strong> · {c.client_name} · {new Date(c.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}<p className="text-muted-foreground">{c.problem}</p></li>)}</ul>
    </ConfirmDialog>
  </>;
}

function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(""); };
  return <div className="grid gap-2">
    <label htmlFor="a-spec" className="text-sm font-medium">Specializations</label>
    <div className="flex gap-2"><Input id="a-spec" list="spec-list" className="h-11" value={t} placeholder="Type and press Enter" onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><Button type="button" variant="outline" className="h-11" onClick={add}>Add</Button></div>
    <datalist id="spec-list">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    {value.length > 0 && <ul className="flex flex-wrap gap-2">{value.map((s) => <li key={s} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{s}<button type="button" aria-label={`Remove ${s}`} className="grid size-6 place-items-center" onClick={() => onChange(value.filter((x) => x !== s))}><X className="size-3" /></button></li>)}</ul>}
  </div>;
}

function HoursEditor({ hours, locations, onChange, error }: { hours: Hour[]; locations: { id: string; name: string; default_hours: unknown }[]; onChange: (h: Hour[]) => void; error?: string }) {
  if (!locations.length) return <p className="text-sm text-muted-foreground">Assign a location to set working hours.</p>;
  return <fieldset className="grid gap-3"><legend className="text-sm font-medium">Working Days and Hours</legend>
    <p className="text-xs text-muted-foreground">Add several ranges per day for breaks (for example 09:00–12:30 and 13:30–17:00).</p>
    {locations.map((l) => <div key={l.id} className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{l.name}</p>
        {Array.isArray(l.default_hours) && l.default_hours.length > 0 && <Button type="button" variant="ghost" className="h-9 text-xs" onClick={() => onChange([...hours.filter((h) => h.location_id !== l.id), ...(l.default_hours as { weekday: number; start: string; end: string }[]).map((d) => ({ location_id: l.id, ...d }))])}>Use location defaults</Button>}</div>
      {WEEKDAYS.map((d, wd) => { const ranges = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.location_id === l.id && h.weekday === wd); return <div key={d} className="grid grid-cols-[44px_1fr] items-start gap-2 text-sm">
        <span className="pt-3">{d}</span>
        <div className="grid gap-1">{ranges.map(({ h, i }) => <div key={i} className="flex items-center gap-1">
          <Input aria-label={`${l.name} ${d} start`} type="time" className="h-11" value={h.start} onChange={(e) => onChange(hours.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
          <span aria-hidden>–</span>
          <Input aria-label={`${l.name} ${d} end`} type="time" className="h-11" value={h.end} onChange={(e) => onChange(hours.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Remove ${d} range`} onClick={() => onChange(hours.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>)}
          <Button type="button" variant="ghost" className="h-9 justify-start px-0 text-xs" onClick={() => onChange([...hours, { location_id: l.id, weekday: wd, start: "09:00", end: "17:00" }])}>{ranges.length ? "+ Add range" : "+ Add hours (closed)"}</Button></div>
      </div>; })}
    </div>)}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </fieldset>;
}
