import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createUserSchema, loginSchema, passwordSchema, updateUserSchema } from "./admin-schema";
import { IP_FAILURES_PER_HOUR, lockoutMinutesLeft, requiresPasswordChange } from "./login-policy";

type Ctx = { supabase: any; userId: string };

function fail(status: number, message: string): never {
  setResponseStatus(status);
  throw new Error(message);
}
function clientIp() {
  return getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
/** Server-side role check through the caller's own session; returns 403 for anyone but an active Administrator. */
async function requireAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) fail(403, "Forbidden: only an Administrator can do this.");
}
async function audit(actor: string | null, action: string, entity: string, entityId: string | null, before: unknown, after: unknown) {
  const db = await admin();
  await db.from("audit_log").insert({ actor_id: actor, action, entity, entity_id: entityId, before: before as never, after: after as never });
}
async function snapshot(userId: string) {
  const db = await admin();
  const [p, r, s] = await Promise.all([
    db.from("staff_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("staff_scopes").select("location_id,advocate_id").eq("user_id", userId),
  ]);
  return p.data ? { ...p.data, roles: (r.data ?? []).map((x) => x.role), scopes: s.data ?? [] } : null;
}
async function endSessions(userId: string) {
  const db = await admin();
  await db.rpc("revoke_user_sessions", { _user: userId });
}
async function setBan(userId: string, banned: boolean) {
  const db = await admin();
  await db.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
}
async function writeScopes(userId: string, locationIds: string[], advocateIds: string[]) {
  const db = await admin();
  await db.from("staff_scopes").delete().eq("user_id", userId);
  const rows = [...locationIds.map((l) => ({ user_id: userId, location_id: l })), ...advocateIds.map((a) => ({ user_id: userId, advocate_id: a }))];
  if (rows.length) { const { error } = await db.from("staff_scopes").insert(rows); if (error) throw new Error("Could not save assigned locations."); }
}
function friendlyDup(msg?: string) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("staff_profiles_username_key")) return "This username is already taken.";
  if (msg.includes("staff_profiles_email_key") || /already (been )?registered/i.test(msg)) return "This email is already used by another user.";
  if (msg.includes("LAST_ADMIN")) return "The last active Administrator cannot be removed or deactivated.";
  return "Something went wrong. Please try again.";
}

/* ---------------- Sign-in (public) ---------------- */

/** Username-or-email sign-in with lockout, IP throttling and an audit entry for every attempt. */
export const signInStaff = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const ip = clientIp();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [{ data: attempts }, { count: ipFails }] = await Promise.all([
      db.from("login_attempts").select("success,created_at").eq("identifier", data.identifier).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
      db.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("success", false).gte("created_at", since),
    ]);
    const locked = lockoutMinutesLeft(attempts ?? []);
    if (locked) {
      await audit(null, "login_locked", "auth", null, null, { identifier: data.identifier, ip });
      return { ok: false as const, message: `Too many failed attempts. Try again in ${locked} minute${locked === 1 ? "" : "s"}.` };
    }
    if ((ipFails ?? 0) >= IP_FAILURES_PER_HOUR) return { ok: false as const, message: "Too many sign-in attempts from this network. Please try again later." };

    const record = async (success: boolean, userId: string | null, reason?: string) => {
      await db.from("login_attempts").insert({ identifier: data.identifier, ip, success });
      await audit(userId, success ? "login" : "login_failed", "auth", userId, null, { identifier: data.identifier, ip, reason });
    };
    let email = data.identifier;
    if (!email.includes("@")) {
      const { data: p } = await db.from("staff_profiles").select("email").ilike("username", data.identifier).maybeSingle();
      if (!p) { await record(false, null, "unknown"); return { ok: false as const, message: "Username, email or password is incorrect." }; }
      email = p.email;
    }
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s, error } = await pub.auth.signInWithPassword({ email, password: data.password });
    if (error || !s.session) { await record(false, null, "password"); return { ok: false as const, message: "Username, email or password is incorrect." }; }
    const uid = s.user.id;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      db.from("staff_profiles").select("status,is_deleted,must_change_password").eq("user_id", uid).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (!roles?.length || profile?.is_deleted || profile?.status === "inactive") {
      await pub.auth.signOut();
      await record(false, uid, "inactive");
      return { ok: false as const, message: "This account does not have active staff access." };
    }
    await record(true, uid);
    await db.from("staff_profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", uid);
    return { ok: true as const, accessToken: s.session.access_token, refreshToken: s.session.refresh_token, mustChangePassword: requiresPasswordChange(!!profile?.must_change_password, (roles ?? []).map((r) => r.role)) };
  });

/** Forced (or voluntary) password change for the signed-in user. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ password: passwordSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(context.userId, { password: data.password });
    if (error) fail(400, /same|different/i.test(error.message) ? "Choose a password different from the current one." : /weak|pwned|leaked/i.test(error.message) ? "This password is too common. Choose another." : "Could not update the password.");
    await db.from("staff_profiles").update({ must_change_password: false, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    await audit(context.userId, "password_change", "staff_profiles", context.userId, null, null);
    return { ok: true };
  });

/* ---------------- Staff & users (admin only) ---------------- */

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { data: clash } = await db.from("staff_profiles").select("username,email").or(`username.ilike.${data.username},email.ilike.${data.email}`);
    if (clash?.some((c) => c.username.toLowerCase() === data.username)) fail(409, "This username is already taken.");
    if (clash?.length) fail(409, "This email is already used by another user.");
    const { data: created, error } = await db.auth.admin.createUser({ email: data.email, password: data.tempPassword, email_confirm: true, user_metadata: { name: data.fullName } });
    if (error || !created.user) fail(409, friendlyDup(error?.message));
    const uid = created.user.id;
    try {
      const { error: pe } = await db.from("staff_profiles").insert({ user_id: uid, full_name: data.fullName, username: data.username, email: data.email, phone: data.phone, status: data.status, must_change_password: true });
      if (pe) throw new Error(friendlyDup(pe.message));
      const { error: re } = await db.from("user_roles").insert({ user_id: uid, role: data.role });
      if (re) throw new Error("Could not assign the role.");
      await writeScopes(uid, data.locationIds, data.advocateIds);
      if (data.status === "inactive") await setBan(uid, true);
    } catch (e) {
      // Compensate so a half-created login never remains.
      await db.from("staff_profiles").delete().eq("user_id", uid);
      await db.auth.admin.deleteUser(uid);
      fail(409, (e as Error).message);
    }
    await audit(context.userId, "create", "staff_profiles", uid, null, await snapshot(uid));
    return { userId: uid };
  });

export const updateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    const before = await snapshot(data.userId);
    if (!before || before.is_deleted) fail(404, "User not found.");
    if (data.userId === context.userId && (data.status !== "active" || data.role !== "admin")) fail(400, "You cannot deactivate your own account or remove your own Administrator role.");
    if (data.email !== before.email) {
      const { error } = await db.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
      if (error) fail(409, friendlyDup(error.message));
    }
    const { error: pe } = await db.from("staff_profiles").update({ full_name: data.fullName, username: data.username, email: data.email, phone: data.phone, status: data.status, updated_at: new Date().toISOString() }).eq("user_id", data.userId);
    if (pe) fail(409, friendlyDup(pe.message));
    if (!before.roles.includes(data.role)) {
      const { error: ie } = await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (ie) fail(400, "Could not change the role.");
      const { error: de } = await db.from("user_roles").delete().eq("user_id", data.userId).neq("role", data.role);
      if (de) { await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role); fail(400, friendlyDup(de.message)); }
    }
    await writeScopes(data.userId, data.locationIds, data.advocateIds);
    if (data.status === "inactive" && before.status === "active") { await setBan(data.userId, true); await endSessions(data.userId); }
    if (data.status === "active" && before.status !== "active") await setBan(data.userId, false);
    const after = await snapshot(data.userId);
    await audit(context.userId, data.status !== before.status ? (data.status === "active" ? "activate" : "deactivate") : "update", "staff_profiles", data.userId, before, after);
    return { ok: true };
  });

const idSchema = z.object({ userId: z.string().uuid() });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.extend({ tempPassword: passwordSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.userId, { password: data.tempPassword });
    if (error) fail(400, /weak|pwned|leaked/i.test(error.message) ? "This password is too common. Choose another." : "Could not reset the password.");
    await db.from("staff_profiles").update({ must_change_password: true }).eq("user_id", data.userId);
    await endSessions(data.userId);
    await audit(context.userId, "password_reset", "staff_profiles", data.userId, null, { must_change_password: true });
    return { ok: true };
  });

export const forceLogoutStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    await endSessions(data.userId);
    await audit(context.userId, "force_logout", "staff_profiles", data.userId, null, null);
    return { ok: true };
  });

/** Hard delete only without history; otherwise soft delete (inactive, hidden, sessions ended). */
export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) fail(400, "You cannot delete your own account.");
    const db = await admin();
    const before = await snapshot(data.userId);
    if (!before || before.is_deleted) fail(404, "User not found.");
    const [{ count: history }, { count: linked }] = await Promise.all([
      db.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_id", data.userId).not("action", "in", "(login,login_failed,login_locked,password_change)"),
      db.from("advocates").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
    ]);
    if ((history ?? 0) > 0 || (linked ?? 0) > 0) {
      const { error } = await db.from("staff_profiles").update({ is_deleted: true, status: "inactive", deleted_at: new Date().toISOString(), deleted_by: context.userId }).eq("user_id", data.userId);
      if (error) fail(400, friendlyDup(error.message));
      await setBan(data.userId, true); await endSessions(data.userId);
      await audit(context.userId, "soft_delete", "staff_profiles", data.userId, before, { ...before, is_deleted: true, status: "inactive" });
      return { mode: "soft" as const };
    }
    const { error: re } = await db.from("user_roles").delete().eq("user_id", data.userId);
    if (re) fail(400, friendlyDup(re.message));
    await db.from("staff_profiles").delete().eq("user_id", data.userId);
    await db.auth.admin.deleteUser(data.userId);
    await audit(context.userId, "delete", "staff_profiles", data.userId, before, null);
    return { mode: "hard" as const };
  });

/* ---------------- Advocate logins ---------------- */

/** Creates the advocate's login (temporary password, forced change) and links it to the advocate record. */
export const createAdvocateLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ advocateId: z.string().uuid(), tempPassword: passwordSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { data: adv } = await db.from("advocates").select("id,name,email,phone,user_id").eq("id", data.advocateId).single();
    if (!adv?.email) fail(400, "The advocate needs an email first.");
    if (adv.user_id) fail(409, "This advocate already has a login.");
    const base = adv.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24) || "advocate";
    const { data: taken } = await db.from("staff_profiles").select("username").ilike("username", `${base}%`);
    const username = taken?.length ? `${base}${taken.length + 1}` : base;
    const { data: created, error } = await db.auth.admin.createUser({ email: adv.email, password: data.tempPassword, email_confirm: true, user_metadata: { name: adv.name } });
    if (error || !created.user) fail(409, friendlyDup(error?.message));
    const uid = created.user.id;
    const { error: pe } = await db.from("staff_profiles").insert({ user_id: uid, full_name: adv.name, username, email: adv.email, phone: adv.phone, must_change_password: true });
    if (pe) { await db.auth.admin.deleteUser(uid); fail(409, friendlyDup(pe.message)); }
    await db.from("user_roles").insert({ user_id: uid, role: "advocate" });
    await db.from("advocates").update({ user_id: uid }).eq("id", adv.id);
    await audit(context.userId, "create", "staff_profiles", uid, null, { username, role: "advocate", advocate_id: adv.id });
    return { username };
  });

/** Deletes an advocate via the transactional database rule, then disables their login. */
export const deleteAdvocate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ advocateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: adv } = await db.from("advocates").select("user_id").eq("id", data.advocateId).maybeSingle();
    const { data: mode, error } = await context.supabase.rpc("admin_delete_advocate", { _id: data.advocateId });
    if (error) fail(error.message.includes("FORBIDDEN") ? 403 : 409, error.hint || "Could not delete the advocate.");
    if (adv?.user_id) {
      await db.from("staff_profiles").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("user_id", adv.user_id);
      await setBan(adv.user_id, true); await endSessions(adv.user_id);
    }
    return { mode: mode as "soft" | "hard" };
  });
