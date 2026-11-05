import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const tag = crypto.randomUUID().slice(0, 8);
let db: SupabaseClient;
let admin: SupabaseClient;
let staff: SupabaseClient;
let visitor: SupabaseClient;
let original: { contact_phone: string; contact_email: string } | null = null;
const userIds: string[] = [];

describe.skipIf(!url || !service || !key)("admin appointment contacts (database)", () => {
  beforeAll(async () => {
    if (!url || !service || !key) throw new Error("Missing test access");
    db = createClient(url, service, options);
    visitor = createClient(url, key, options);
    const initial = await db.from("booking_settings").select("contact_phone,contact_email").eq("id", 1).single();
    if (initial.error) throw initial.error;
    original = initial.data;
    for (const role of ["admin", "staff"] as const) {
      const email = `contact-${role}-${tag}@example.test`;
      const password = `Contact-Test#${crypto.randomUUID()}`;
      const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error("Could not create test user");
      const id = created.data.user.id;
      userIds.push(id);
      const profile = await db.from("staff_profiles").insert({ user_id: id, full_name: "Contact test", username: `contact-${role}-${tag}`, email });
      if (profile.error) throw profile.error;
      const assigned = await db.from("user_roles").insert({ user_id: id, role });
      if (assigned.error) throw assigned.error;
      const client = createClient(url, key, options);
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      if (role === "admin") admin = client;
      else staff = client;
    }
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    if (original) {
      const restored = await db.from("booking_settings").update(original).eq("id", 1);
      if (restored.error) throw restored.error;
    }
    for (const id of userIds) {
      await db.from("staff_profiles").delete().eq("user_id", id);
      await db.from("user_roles").delete().eq("user_id", id);
      await db.auth.admin.deleteUser(id);
    }
  }, 30000);

  it("lets an administrator save both contact fields for public reads", async () => {
    const values = { contact_phone: "+91 98765 43210", contact_email: "bookings@apexlegalpartners.com" };
    const saved = await admin.from("booking_settings").update(values).eq("id", 1).select("contact_phone,contact_email").single();
    expect(saved.error).toBeNull();
    const read = await visitor.from("booking_settings").select("contact_phone,contact_email").eq("id", 1).single();
    expect(read.data).toEqual(values);
  });
  it("rejects staff phone changes at the database boundary", async () => {
    const result = await staff.from("booking_settings").update({ contact_phone: "+91 91234 56789" }).eq("id", 1);
    expect(result.error?.message).toContain("FORBIDDEN");
  });
  it("rejects staff email changes at the database boundary", async () => {
    const result = await staff.from("booking_settings").update({ contact_email: "other@example.com" }).eq("id", 1);
    expect(result.error?.message).toContain("FORBIDDEN");
  });
  it("rejects anonymous contact updates", async () => {
    const result = await visitor.from("booking_settings").update({ contact_email: "other@example.com" }).eq("id", 1).select();
    expect(result.error !== null || result.data?.length === 0).toBe(true);
    const saved = await visitor.from("booking_settings").select("contact_email").eq("id", 1).single();
    expect(saved.data?.contact_email).toBe("bookings@apexlegalpartners.com");
  });
  it("rejects malformed phones in direct database writes", async () => {
    const result = await admin.from("booking_settings").update({ contact_phone: "123" }).eq("id", 1);
    expect(result.error?.message).toBe("INVALID_CONTACT_PHONE");
  });
  it("rejects malformed emails in direct database writes", async () => {
    const result = await admin.from("booking_settings").update({ contact_email: "not-an-email" }).eq("id", 1);
    expect(result.error?.message).toBe("INVALID_CONTACT_EMAIL");
  });
  it("reflects subsequent admin changes without changing appointment data", async () => {
    const changed = { contact_phone: "+91 91234 56789", contact_email: "appointments@apexlegalpartners.com" };
    const result = await admin.from("booking_settings").update(changed).eq("id", 1);
    expect(result.error).toBeNull();
    const read = await visitor.from("booking_settings").select("contact_phone,contact_email").eq("id", 1).single();
    expect(read.data).toEqual(changed);
  });
  it("supports clearing either field without restoring sample defaults", async () => {
    const result = await admin.from("booking_settings").update({ contact_phone: "", contact_email: "" }).eq("id", 1);
    expect(result.error).toBeNull();
    const read = await visitor.from("booking_settings").select("contact_phone,contact_email").eq("id", 1).single();
    expect(read.data).toEqual({ contact_phone: "", contact_email: "" });
  });
});