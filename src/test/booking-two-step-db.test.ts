import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let db: SupabaseClient;
let slot: { location: string; service: string; advocate: string; start: string; day: string; fee: number | null };
const appointmentIds: string[] = [], tokenHashes: string[] = [], blockIds: string[] = [];
const hash = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), (v) => v.toString(16).padStart(2, "0")).join("");
async function acquire(advocate: string | null, mode = "online") {
  const result = await db.rpc("acquire_appointment_hold", { _client_key: `two-step:${crypto.randomUUID()}`, _location: slot.location, _service: slot.service, _advocate: advocate, _start: slot.start, _mode: mode });
  if (result.data?.[0]?.token) tokenHashes.push(await hash(result.data[0].token));
  return result;
}
async function release(token: string) { await db.from("booking_holds").delete().eq("token_hash", await hash(token)); }
async function submit(token: string, advocate: string | null, mode = "online") {
  const result = await db.rpc("submit_appointment_booking", { _hold_token: token, _client_key: `two-step:${crypto.randomUUID()}`, _name: "Two Step QA", _phone: "+1 212 555 0199", _email: "", _location: slot.location, _service: slot.service, _advocate: advocate, _start: slot.start, _mode: mode, _consent: true });
  if (result.data?.[0]?.appointment_id) appointmentIds.push(result.data[0].appointment_id);
  return result;
}
describe.skipIf(!url || !key)("two-step transactional booking", () => {
  beforeAll(async () => {
    if (!url || !key) return;
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "two-step-db-test" } });
    const { data: service } = await db.from("services").select("id,fee").eq("active", true).order("sort_order").limit(1).single();
    const { data: location } = await db.from("locations").select("id").eq("active", true).eq("kind", "virtual").eq("is_deleted", false).limit(1).single();
    if (!service || !location) throw new Error("Missing online consultation configuration");
    const { data: links } = await db.from("advocate_locations").select("advocate_id").eq("location_id", location.id);
    for (let i = 23; i < 29 && !slot; i++) {
      const day = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
      for (const link of links ?? []) {
        const { data } = await db.rpc("booking_day_slots", { _location: location.id, _service: service.id, _advocate: link.advocate_id, _date: day, _zone: "UTC" });
        const first = data?.[0];
        if (first) { slot = { location: location.id, service: service.id, advocate: link.advocate_id, start: first.starts_at, day, fee: service.fee }; break; }
      }
    }
    expect(slot).toBeTruthy();
  }, 30000);
  afterAll(async () => {
    if (appointmentIds.length) await db.from("appointments").delete().in("id", appointmentIds);
    if (tokenHashes.length) await db.from("booking_holds").delete().in("token_hash", tokenHashes);
    if (blockIds.length) await db.from("blocked_times").delete().in("id", blockIds);
  });
  it("reserves capacity without publicly assigning an advocate", async () => {
    const { data, error } = await acquire(null);
    expect(error).toBeNull(); const h = data?.[0]; expect(h?.ok).toBe(true); if (!h) throw new Error("Missing hold");
    expect(h).not.toHaveProperty("advocate_id");
    const { data: hold } = await db.from("booking_holds").select("explicit_advocate_id,consultation_mode").eq("token_hash", await hash(h.token)).single();
    expect(hold?.explicit_advocate_id).toBeNull(); expect(hold?.consultation_mode).toBe("online"); await release(h.token);
  });
  it("does not accept automatic intent for an explicit advocate hold", async () => {
    const { data } = await acquire(slot.advocate); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    expect((await submit(h.token, null)).error?.message).toContain("SLOT_UNAVAILABLE");
    await release(h.token);
  });
  it("returns only available advocates for a selected instant including the visitor's own hold", async () => {
    const { data } = await acquire(slot.advocate); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    const args = { _location: slot.location, _service: slot.service, _month: slot.day.slice(0, 7) + "-01", _date: slot.day, _start: slot.start, _zone: "UTC" };
    const { data: own, error } = await db.rpc("booking_advocate_options", { ...args, _hold_token: h.token }); expect(error).toBeNull();
    expect(own?.some((a: { advocate_id: string }) => a.advocate_id === slot.advocate)).toBe(true);
    const { data: other } = await db.rpc("booking_advocate_options", args); expect(other?.some((a: { advocate_id: string }) => a.advocate_id === slot.advocate)).toBe(false);
    await release(h.token);
  });
  it("rejects expired holds", async () => {
    const { data } = await acquire(null); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    await db.from("booking_holds").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", await hash(h.token));
    expect((await submit(h.token, null)).error?.message).toContain("SLOT_UNAVAILABLE"); await release(h.token);
  });
  it("never substitutes when the selected advocate becomes unavailable", async () => {
    const { data } = await acquire(slot.advocate); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    const { data: block, error } = await db.from("blocked_times").insert({ advocate_id: slot.advocate, starts_at: slot.start, ends_at: new Date(Date.parse(slot.start) + 30 * 60000).toISOString(), title: "Two-step QA conflict" }).select("id").single();
    expect(error).toBeNull(); if (!block) throw new Error("Missing QA block"); blockIds.push(block.id);
    const { data: options } = await db.rpc("booking_advocate_options", { _location: slot.location, _service: slot.service, _month: slot.day.slice(0, 7) + "-01", _date: slot.day, _start: slot.start, _zone: "UTC", _hold_token: h.token });
    expect(options?.some((a: { advocate_id: string }) => a.advocate_id === slot.advocate)).toBe(false);
    const rejected = await submit(h.token, slot.advocate); expect(rejected.error?.message).toContain("SLOT_UNAVAILABLE"); expect(rejected.error?.hint).toContain("selected advocate");
    await db.from("blocked_times").delete().eq("id", block.id); await release(h.token);
  });
  it("confirms automatic assignment with optional email, fee snapshot and private details", async () => {
    const { data } = await acquire(null, "phone"); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    const { data: booked, error } = await submit(h.token, null, "phone"); expect(error).toBeNull(); const row = booked?.[0]; if (!row) throw new Error("Missing appointment");
    const { data: a } = await db.from("appointments").select("advocate_id,status,client_email,consultation_mode,consultation_fee").eq("id", row.appointment_id).single();
    expect(a?.advocate_id).toBe(row.assigned_advocate_id); expect(a?.status).toBe("awaiting_confirmation"); expect(a?.client_email).toBe(""); expect(a?.consultation_mode).toBe("phone"); expect(a?.consultation_fee).toBe(slot.fee);
    const { data: privateView } = await db.rpc("appointment_details_by_token", { _token: row.access_token }); expect(privateView?.[0].consultation_mode).toBe("phone"); expect(privateView?.[0].consultation_fee).toBe(slot.fee);
    await db.from("appointments").delete().eq("id", row.appointment_id);
  });
  it("preserves explicit selection and rejects double booking", async () => {
    const { data } = await acquire(slot.advocate); const h = data?.[0]; if (!h?.ok) throw new Error("Missing hold");
    const { data: booked, error } = await submit(h.token, slot.advocate); expect(error).toBeNull(); expect(booked?.[0].assigned_advocate_id).toBe(slot.advocate);
    const duplicate = await acquire(slot.advocate); expect(duplicate.data?.[0].ok).toBe(false);
  });
});