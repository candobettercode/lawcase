import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { errorText } from "@/lib/staff";
import { createUserSchema, passwordSchema, userFormSchema } from "@/lib/admin-schema";
import { createStaffUser, deleteStaffUser, forceLogoutStaff, resetStaffPassword, updateStaffUser } from "@/lib/admin.functions";
import { AdminOnlyNotice, SettingsHeader } from "@/components/settings/SettingsShell";
import { ConfirmDialog, EmptyState, Field, FormDrawer, ListSkeleton, Pager, StatusBadge, selectClass, useDirectoryAccess, usePaged } from "@/components/settings/admin-ui";

export const Route = createFileRoute("/_authenticated/settings/staff")({ head: () => pageHead("Staff & Users Settings", "Manage staff, advocate and administrator accounts.", true), component: Page });

const roleLabel: Record<string, string> = { admin: "Administrator", staff: "Staff", advocate: "Advocate" };
type Row = { user_id: string; full_name: string; username: string; email: string; phone: string; status: string; is_deleted: boolean; last_login_at: string | null; roles: string[]; locationIds: string[]; advocateIds: string[] };
type Form = { fullName: string; email: string; username: string; phone: string; role: "admin" | "staff" | "advocate"; status: "active" | "inactive"; locationIds: string[]; advocateIds: string[]; tempPassword: string };
const blank: Form = { fullName: "", email: "", username: "", phone: "", role: "staff", status: "active", locationIds: [], advocateIds: [], tempPassword: "" };

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r, s, l, a, me] = await Promise.all([
        supabase.from("staff_profiles").select("user_id,full_name,username,email,phone,status,is_deleted,last_login_at").eq("is_deleted", false).order("full_name"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("staff_scopes").select("user_id,location_id,advocate_id"),
        supabase.from("locations").select("id,name").eq("is_deleted", false).order("sort_order"),
        supabase.from("advocates").select("id,name").eq("is_deleted", false).order("name"),
        supabase.auth.getUser(),
      ]);
      if (p.error) throw p.error;
      const rows: Row[] = (p.data ?? []).map((x) => ({ ...x,
        roles: (r.data ?? []).filter((y) => y.user_id === x.user_id).map((y) => y.role),
        locationIds: (s.data ?? []).filter((y) => y.user_id === x.user_id && y.location_id).map((y) => y.location_id!),
        advocateIds: (s.data ?? []).filter((y) => y.user_id === x.user_id && y.advocate_id).map((y) => y.advocate_id!) }));
      return { rows, locations: l.data ?? [], advocates: a.data ?? [], me: me.data.user?.id };
    },
  });
}

function Page() {
  const access = useDirectoryAccess();
  const qc = useQueryClient();
  const q = useUsers();
  const create = useServerFn(createStaffUser), update = useServerFn(updateStaffUser), del = useServerFn(deleteStaffUser), reset = useServerFn(resetStaffPassword), logout = useServerFn(forceLogoutStaff);
  const [search, setSearch] = useState(""); const [role, setRole] = useState("all"); const [status, setStatus] = useState("all"); const [loc, setLoc] = useState("all");
  const [editing, setEditing] = useState<{ id: string | null; form: Form; initial: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null); const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (q.data?.rows ?? []).filter((u) => (role === "all" || u.roles.includes(role)) && (status === "all" || u.status === status) && (loc === "all" || u.locationIds.includes(loc)) &&
    `${u.full_name} ${u.email} ${u.username}`.toLowerCase().includes(search.trim().toLowerCase())), [q.data, search, role, status, loc]);
  const paged = usePaged(rows);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const locName = (id: string) => q.data?.locations.find((l) => l.id === id)?.name ?? "";

  if (!access.loading && !access.isAdmin) return <><SettingsHeader title="Staff & Users" /><AdminOnlyNotice what="staff and user accounts" /></>;

  const open = (u: Row | null) => {
    const form: Form = u ? { fullName: u.full_name, email: u.email, username: u.username, phone: u.phone, role: (u.roles[0] ?? "staff") as Form["role"], status: u.status as Form["status"], locationIds: u.locationIds, advocateIds: u.advocateIds, tempPassword: "" } : blank;
    setErrors({}); setEditing({ id: u?.user_id ?? null, form, initial: JSON.stringify(form) });
  };
  async function save() {
    if (!editing) return;
    const parsed = (editing.id ? userFormSchema : createUserSchema).safeParse(editing.form);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setBusy(true);
    try {
      if (editing.id) await update({ data: { ...(parsed.data as Form), userId: editing.id } });
      else await create({ data: parsed.data as Form });
      toast.success(editing.id ? "User updated" : "User added — they must change the temporary password at first login");
      setEditing(null); await refresh();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function run(fn: () => Promise<unknown>, ok: string) { try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(errorText(e)); } }
  const f = editing?.form; const set = (p: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...p } });
  const toggleIn = (list: string[], id: string) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  function Actions({ u }: { u: Row }) {
    const self = u.user_id === q.data?.me;
    return <div className="flex flex-wrap justify-end gap-1 xl:flex-nowrap">
      <Button variant="ghost" className="h-11" onClick={() => open(u)} aria-label={`Edit ${u.full_name}`}>Edit</Button>
      {!self && <Button variant="ghost" className="h-11" onClick={() => run(() => update({ data: { userId: u.user_id, fullName: u.full_name, email: u.email, username: u.username, phone: u.phone, role: (u.roles[0] ?? "staff") as Form["role"], status: u.status === "active" ? "inactive" : "active", locationIds: u.locationIds, advocateIds: u.advocateIds } }), u.status === "active" ? "User deactivated and signed out" : "User activated")}>{u.status === "active" ? "Deactivate" : "Activate"}</Button>}
      <Button variant="ghost" className="h-11" onClick={() => { setNewPw(""); setResetting(u); }}>Reset Password</Button>
      {!self && <Button variant="ghost" className="h-11" onClick={() => run(() => logout({ data: { userId: u.user_id } }), "User signed out of all sessions")}>Force logout</Button>}
      {!self && <Button variant="ghost" className="h-11 text-destructive" onClick={() => setDeleting(u)} aria-label={`Delete ${u.full_name}`}>Delete</Button>}
    </div>;
  }

  return <>
    <SettingsHeader title="Staff & Users" description="Accounts for staff, advocates and administrators." action={<Button className="h-11" onClick={() => open(null)}><Plus /> Add Staff</Button>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_160px_200px]">
      <Input aria-label="Search users" placeholder="Search name, email or username" className="h-11 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter by role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}><option value="all">All roles</option><option value="staff">Staff</option><option value="advocate">Advocate</option><option value="admin">Administrator</option></select>
      <select aria-label="Filter by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select aria-label="Filter by location" className={selectClass} value={loc} onChange={(e) => setLoc(e.target.value)}><option value="all">All locations</option>{q.data?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </div>
    {q.isLoading ? <ListSkeleton /> : !rows.length ? <EmptyState action={<Button onClick={() => open(null)}>Add Staff</Button>}>No users match. Add your first staff member.</EmptyState> : <>
      <div className="hidden overflow-x-auto rounded-md border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Username</th><th className="p-3">Role</th><th className="p-3">Locations</th><th className="p-3">Status</th><th className="p-3">Last login</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{paged.items.map((u) => <tr key={u.user_id} className="border-b last:border-0">
            <td className="p-3 font-medium">{u.full_name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.username}</td><td className="p-3">{u.roles.map((r) => roleLabel[r]).join(", ")}</td>
            <td className="p-3">{u.locationIds.length ? u.locationIds.map(locName).join(", ") : "All"}</td><td className="p-3"><StatusBadge active={u.status === "active"} /></td>
            <td className="p-3">{u.last_login_at ? new Date(u.last_login_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never"}</td><td className="p-3"><Actions u={u} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="grid gap-3 lg:hidden">{paged.items.map((u) => <li key={u.user_id} className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{u.full_name}</p><p className="truncate text-sm text-muted-foreground">{u.email} · @{u.username}</p><p className="text-sm text-muted-foreground">{u.roles.map((r) => roleLabel[r]).join(", ")} · last login {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}</p></div><StatusBadge active={u.status === "active"} /></div>
        <div className="mt-3"><Actions u={u} /></div>
      </li>)}</ul>
      <Pager {...paged} />
    </>}

    <FormDrawer open={!!editing} title={editing?.id ? "Edit user" : "Add staff member"} dirty={!!editing && JSON.stringify(editing.form) !== editing.initial} onClose={() => setEditing(null)}>
      {f && <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <Field id="u-name" label="Full Name" required error={errors.fullName}><Input id="u-name" className="h-11" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="u-email" label="Email" required error={errors.email}><Input id="u-email" type="email" className="h-11" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field id="u-username" label="Username" required error={errors.username}><Input id="u-username" autoCapitalize="none" className="h-11" value={f.username} onChange={(e) => set({ username: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="u-phone" label="Phone" error={errors.phone}><Input id="u-phone" type="tel" className="h-11" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field id="u-role" label="Role"><select id="u-role" className={selectClass} value={f.role} disabled={editing?.id === q.data?.me} onChange={(e) => set({ role: e.target.value as Form["role"] })}><option value="staff">Staff</option><option value="advocate">Advocate</option><option value="admin">Administrator</option></select></Field>
        </div>
        <fieldset className="grid gap-2"><legend className="text-sm font-medium">Assigned locations</legend><p className="text-xs text-muted-foreground">Limits what this person sees in the calendar. None selected = all locations.</p>
          <div className="flex flex-wrap gap-2">{q.data?.locations.map((l) => <label key={l.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={f.locationIds.includes(l.id)} onChange={() => set({ locationIds: toggleIn(f.locationIds, l.id) })} />{l.name}</label>)}</div></fieldset>
        <fieldset className="grid gap-2"><legend className="text-sm font-medium">Assigned advocates (optional)</legend>
          <div className="flex flex-wrap gap-2">{q.data?.advocates.map((a) => <label key={a.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={f.advocateIds.includes(a.id)} onChange={() => set({ advocateIds: toggleIn(f.advocateIds, a.id) })} />{a.name}</label>)}</div></fieldset>
        {!editing?.id && <Field id="u-pw" label="Temporary password" required error={errors.tempPassword} hint="They will be asked to choose a new password at first login."><Input id="u-pw" type="password" autoComplete="new-password" className="h-11" value={f.tempPassword} onChange={(e) => set({ tempPassword: e.target.value })} /></Field>}
        <div className="flex items-center justify-between rounded-md border p-3"><label htmlFor="u-active" className="text-sm font-medium">Active</label><Switch id="u-active" disabled={editing?.id === q.data?.me} checked={f.status === "active"} onCheckedChange={(v) => set({ status: v ? "active" : "inactive" })} /></div>
        <Button type="submit" className="h-11" disabled={busy}>{busy ? "Saving…" : "Save user"}</Button>
      </form>}
    </FormDrawer>

    <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.full_name}?`} description="Users with activity history are deactivated and hidden instead of being permanently removed. Their sessions end immediately."
      onConfirm={async () => { if (!deleting) return; try { const r = await del({ data: { userId: deleting.user_id } }); toast.success(r.mode === "soft" ? "User deactivated and hidden (history kept)" : "User deleted"); await refresh(); } catch (e) { toast.error(errorText(e)); } setDeleting(null); }} />
    <ConfirmDialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)} title={`Reset password for ${resetting?.full_name}`} description="Their sessions end and they must choose a new password at next login." confirmLabel="Reset password" destructive={false}
      onConfirm={async () => { if (!resetting) return; const p = passwordSchema.safeParse(newPw); if (!p.success) return void toast.error(p.error.issues[0].message); await run(() => reset({ data: { userId: resetting.user_id, tempPassword: newPw } }), "Password reset"); setResetting(null); }}>
      <Field id="reset-pw" label="New temporary password" required><Input id="reset-pw" type="password" autoComplete="new-password" className="h-11" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
    </ConfirmDialog>
  </>;
}
