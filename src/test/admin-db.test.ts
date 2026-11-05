// Directory management rules against the connected database. Skipped without backend credentials.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const ready = !!(url && service && anonKey);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const PW = "Test-Pass#2026x";
const tag = crypto.randomUUID().slice(0, 8);
let db: SupabaseClient;
const users: Record<string, { id: string; client: SupabaseClient }> = {};
const advocates: string[] = []; const locations: string[] = []; const appts: string[] = [];

async function makeUser(role: "admin" | "staff" | "advocate") {
  const email = `t-${role}-${tag}@example.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  await db.from("staff_profiles").insert({ user_id: data.user.id, full_name: `Test ${role}`, username: `t-${role}-${tag}`, email });
  await db.from("user_roles").insert({ user_id: data.user.id, role });
  const client = createClient(url!, anonKey!, opts);
  await client.auth.signInWithPassword({ email, password: PW });
  users[role] = { id: data.user.id, client };
}
const advData = (n: string) => ({ name: `Test Adv ${n} ${tag}`, email: `adv-${n}-${tag}@example.test`, bar_number: `T-${n}-${tag}`, slot_minutes: 30, buffer_minutes: 0, years_experience: 1, active: true });

describe.skipIf(!ready)("admin directory management (database)", () => {
  beforeAll(async () => {
    db = createClient(url!, service!, opts);
    await makeUser("admin"); await makeUser("staff"); await makeUser("advocate");
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    for (const id of appts) await db.from("notifications").delete().eq("appointment_id", id);
    if (appts.length) await db.from("appointments").delete().in("id", appts);
    for (const id of advocates) { await db.from("availability").delete().eq("advocate_id", id); await db.from("advocate_locations").delete().eq("advocate_id", id); await db.from("advocates").delete().eq("id", id); }
    if (locations.length) await db.from("locations").delete().in("id", locations);
    for (const u of Object.values(users)) { await db.from("user_roles").delete().eq("user_id", u.id).neq("role", "admin"); }
    for (const u of Object.values(users)) { await db.from("staff_profiles").delete().eq("user_id", u.id); await db.from("user_roles").delete().eq("user_id", u.id); await db.auth.admin.deleteUser(u.id); }
    await db.from("audit_log").delete().like("after->>name", `%${tag}%`);
  }, 30000);

  it("rejects staff and advocates from managing advocates and locations (forbidden)", async () => {
    for (const r of ["staff", "advocate"]) {
      const a = await users[r].client.rpc("admin_save_advocate", { _id: null, _data: advData(r), _locations: [], _hours: [] });
      expect(a.error?.message).toContain("FORBIDDEN");
      const l = await users[r].client.rpc("admin_save_location", { _id: null, _data: { name: `Nope ${tag}`, kind: "virtual", timezone: "UTC" } });
      expect(l.error?.message).toContain("FORBIDDEN");
    }
  });

  it("lets an Administrator create a location and advocate, and writes audit entries", async () => {
    const l = await users.admin.client.rpc("admin_save_location", { _id: null, _data: { name: `Test Office ${tag}`, kind: "virtual", timezone: "UTC", active: true } });
    expect(l.error).toBeNull(); locations.push(l.data);
    const a = await users.admin.client.rpc("admin_save_advocate", { _id: null, _data: advData("a"), _locations: [l.data], _hours: [{ location_id: l.data, weekday: 1, start: "09:00", end: "12:00" }] });
    expect(a.error).toBeNull(); advocates.push(a.data);
    const { data: audit } = await db.from("audit_log").select("action,actor_id,entity").eq("entity_id", a.data);
    expect(audit).toContainEqual({ action: "insert", actor_id: users.admin.id, entity: "advocates" });
  });

  it("enforces unique email and bar number with friendly messages", async () => {
    const dupEmail = await users.admin.client.rpc("admin_save_advocate", { _id: null, _data: { ...advData("a"), bar_number: `X-${tag}` }, _locations: [], _hours: [] });
    expect(dupEmail.error?.hint).toBe("Another advocate already uses this email.");
    const dupBar = await users.admin.client.rpc("admin_save_advocate", { _id: null, _data: { ...advData("b"), bar_number: `t-a-${tag}` }, _locations: [], _hours: [] });
    expect(dupBar.error?.hint).toBe("Another advocate already uses this bar/license number.");
    const dupLoc = await users.admin.client.rpc("admin_save_location", { _id: null, _data: { name: `test office ${tag}`, kind: "virtual", timezone: "UTC" } });
    expect(dupLoc.error?.hint).toBe("A location with this name already exists.");
  });

  it("blocks deleting an advocate with future appointments, soft-deletes with only past ones, hard-deletes without any", async () => {
    const [adv] = advocates; const [loc] = locations;
    const { data: svc } = await db.from("services").select("id").limit(1).single();
    const insert = (start: Date) => db.from("appointments").insert({ booking_ref: `T-${tag}-${start.getTime()}`, advocate_id: adv, location_id: loc, service_id: svc!.id, client_name: "T", client_phone: "+1 212 555 0100", client_email: "t@example.test", starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 18e5).toISOString(), access_token_hash: crypto.randomUUID() }).select("id").single();
    const fut = await insert(new Date(Date.now() + 20 * 864e5)); appts.push(fut.data!.id);
    const blocked = await users.admin.client.rpc("admin_delete_advocate", { _id: adv });
    expect(blocked.error?.message).toContain("HAS_FUTURE");
    const cancel = await users.admin.client.rpc("admin_resolve_appointment", { _id: fut.data!.id, _action: "cancel" });
    expect(cancel.error).toBeNull();
    const past = await insert(new Date(Date.now() - 20 * 864e5)); appts.push(past.data!.id);
    const soft = await users.admin.client.rpc("admin_delete_advocate", { _id: adv });
    expect(soft.data).toBe("soft");
    const { data: row } = await db.from("advocates").select("is_deleted,active").eq("id", adv).single();
    expect(row).toEqual({ is_deleted: true, active: false });
    const linked = await users.admin.client.rpc("admin_delete_location", { _id: loc });
    expect(linked.error?.message).toContain("LINKED");
    const fresh = await users.admin.client.rpc("admin_save_advocate", { _id: null, _data: advData("c"), _locations: [], _hours: [] });
    advocates.push(fresh.data);
    const hard = await users.admin.client.rpc("admin_delete_advocate", { _id: fresh.data });
    expect(hard.data).toBe("hard");
    expect((await db.from("advocates").select("id").eq("id", fresh.data)).data).toEqual([]);
  }, 30000);

  it("hides deactivated advocates from public booking reads", async () => {
    const pub = createClient(url!, anonKey!, opts);
    const a = await users.admin.client.rpc("admin_save_advocate", { _id: null, _data: advData("d"), _locations: [], _hours: [] });
    advocates.push(a.data);
    expect((await pub.from("advocates").select("id").eq("id", a.data)).data).toHaveLength(1);
    await users.admin.client.rpc("admin_set_active", { _entity: "advocate", _id: a.data, _active: false });
    expect((await pub.from("advocates").select("id").eq("id", a.data)).data).toHaveLength(0);
  });

  it("never removes the last active Administrator", async () => {
    const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const others = (admins ?? []).filter((r) => r.user_id !== users.admin.id).map((r) => r.user_id);
    // Temporarily deactivate every other admin so the test admin is the last one.
    await db.from("staff_profiles").update({ status: "inactive" }).in("user_id", others);
    try {
      const del = await db.from("user_roles").delete().eq("user_id", users.admin.id).eq("role", "admin");
      expect(del.error?.message).toContain("LAST_ADMIN");
      const deact = await db.from("staff_profiles").update({ status: "inactive" }).eq("user_id", users.admin.id);
      expect(deact.error?.message).toContain("LAST_ADMIN");
    } finally {
      await db.from("staff_profiles").update({ status: "active" }).in("user_id", others);
    }
  });

  it("only an Administrator can change the staff directory permission toggle", async () => {
    const s = await users.staff.client.from("booking_settings").update({ staff_can_manage_directory: true }).eq("id", 1).select();
    expect(s.error?.message).toContain("FORBIDDEN");
  });

  it("refuses data access while a password change is pending", async () => {
    await db.from("staff_profiles").update({ must_change_password: true }).eq("user_id", users.staff.id);
    const { data } = await users.staff.client.rpc("is_firm_staff", { _user_id: users.staff.id });
    expect(data).toBe(false);
    await db.from("staff_profiles").update({ must_change_password: false }).eq("user_id", users.staff.id);
  });
  it("allows administrators to access the calendar with a pending password change", async () => {
    await db.from("staff_profiles").update({ must_change_password: true }).eq("user_id", users.admin.id);
    try {
      const { data, error } = await users.admin.client.rpc("is_firm_staff", { _user_id: users.admin.id });
      expect(error).toBeNull();
      expect(data).toBe(true);
    } finally {
      await db.from("staff_profiles").update({ must_change_password: false }).eq("user_id", users.admin.id);
    }
  });
});
