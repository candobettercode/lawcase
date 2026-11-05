// Integration tests against the connected database. Skipped when backend credentials are absent.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const ready = !!(url && service && anonKey);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const created: string[] = [];
let admin: SupabaseClient;
let slot: { advocate: string; location: string; service: string; start: string };

const book = (overrides: Record<string, unknown> = {}) => admin.rpc("create_public_booking", {
  _client_key: `test:${crypto.randomUUID()}`, _name: "Test Visitor", _phone: "+1 212 555 0199", _email: "visitor@example.test",
  _location: slot.location, _service: slot.service, _advocate: slot.advocate, _start: slot.start,
  _opposing: "", _matter: "", _consent: true, ...overrides,
});

describe.skipIf(!ready)("public booking (database)", () => {
  beforeAll(async () => {
    admin = createClient(url!, service!, opts);
    const { data: svc } = await admin.from("services").select("id,duration_minutes").eq("active", true).order("duration_minutes").limit(1).single();
    const { data: links } = await admin.from("advocate_locations").select("advocate_id,location_id");
    for (let i = 1; i < 30 && !slot; i++) {
      const date = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
      for (const l of links ?? []) {
        const { data } = await admin.rpc("available_slots", { _advocate: l.advocate_id, _location: l.location_id, _date: date, _duration: svc!.duration_minutes });
        if (data?.length) { slot = { advocate: l.advocate_id, location: l.location_id, service: svc!.id, start: data.at(-1)!.starts_at }; break; }
      }
    }
    expect(slot).toBeTruthy();
  });
  afterAll(async () => {
    if (created.length) await admin.from("appointments").delete().in("id", created);
    await admin.from("booking_settings").update({ accept_online_bookings: true }).eq("id", 1);
  });

  it("saves a request as Awaiting Confirmation with a Booking ID, token and staff notifications", async () => {
    const { data, error } = await book();
    expect(error).toBeNull();
    const row = data![0]; created.push(row.appointment_id);
    expect(row.booking_ref).toMatch(/^APX-\d{4}-\d{6}$/);
    expect(row.access_token).toMatch(/^[0-9a-f]{64}$/);
    const { data: ap } = await admin.from("appointments").select("status,access_token_hash").eq("id", row.appointment_id).single();
    expect(ap!.status).toBe("awaiting_confirmation");
    expect(ap!.access_token_hash).not.toBe(row.access_token);
    const { data: notes } = await admin.from("notifications").select("audience,body").eq("appointment_id", row.appointment_id);
    expect(notes!.map((n) => n.audience).sort()).toEqual(["advocate", "staff"]);
    const anon = createClient(url!, anonKey!, opts);
    const { data: view } = await anon.rpc("appointment_by_token", { _token: row.access_token });
    expect(view![0].status).toBe("awaiting_confirmation");
  });

  it("rejects a second booking for the same advocate and time", async () => {
    const { error } = await book();
    expect(error?.message).toContain("SLOT_UNAVAILABLE");
  });

  it("database constraint blocks overlapping rows even when the app check is bypassed", async () => {
    const { data: ap } = await admin.from("appointments").select("*").eq("id", created[0]).single();
    const { error } = await admin.from("appointments").insert({ ...ap, id: undefined, booking_ref: `APX-TEST-${Date.now()}`, access_token_hash: crypto.randomUUID() });
    expect(error?.code).toBe("23P01");
  });

  it("rejects new requests when online booking is switched off", async () => {
    await admin.from("booking_settings").update({ accept_online_bookings: false }).eq("id", 1);
    const { error } = await book({ _start: new Date(new Date(slot.start).getTime() - 864e5 * 365).toISOString() });
    expect(error?.message).toContain("BOOKING_CLOSED");
    await admin.from("booking_settings").update({ accept_online_bookings: true }).eq("id", 1);
  });

  it("visitors cannot call the booking function directly or read appointments", async () => {
    const anon = createClient(url!, anonKey!, opts);
    expect((await anon.rpc("create_public_booking", {} as never)).error).not.toBeNull();
    const { data } = await anon.from("appointments").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

describe.skipIf(!ready)("demo staff permissions", () => {
  let staff: SupabaseClient;
  beforeAll(async () => {
    staff = createClient(url!, anonKey!, opts);
    const { error } = await staff.auth.signInWithPassword({ email: "staff@apexlegal.test", password: "Staff@12345" });
    expect(error).toBeNull();
  });

  it("has the Staff role and not Admin", async () => {
    const { data: u } = await staff.auth.getUser();
    const { data } = await staff.from("user_roles").select("role").eq("user_id", u.user!.id);
    expect(data!.map((r) => r.role)).toEqual(["staff"]);
  });

  it("can read the firm calendar and change the booking switch", async () => {
    expect((await staff.from("appointments").select("id").limit(1)).error).toBeNull();
    const { data, error } = await staff.from("booking_settings").update({ accept_online_bookings: true }).eq("id", 1).select();
    expect(error).toBeNull(); expect(data).toHaveLength(1);
  });

  it("cannot grant roles or manage administrator accounts", async () => {
    const { data: u } = await staff.auth.getUser();
    const { error } = await staff.from("user_roles").insert({ user_id: u.user!.id, role: "admin" });
    expect(error).not.toBeNull();
  });

  it("visitors cannot change the booking switch", async () => {
    const anon = createClient(url!, anonKey!, opts);
    const { data } = await anon.from("booking_settings").update({ accept_online_bookings: false }).eq("id", 1).select();
    expect(data ?? []).toHaveLength(0);
  });
});
