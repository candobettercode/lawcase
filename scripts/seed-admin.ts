/**
 * Administrator seed — safe to run more than once (no duplicates).
 *
 *   Demo credentials for testing only. Change the password immediately and never use these in production.
 *   Username: admin   Password: Admin@12345   Role: Administrator   (must change password on first login)
 *
 * Development / staging:
 *   APP_ENV=development bun scripts/seed-admin.ts
 * Production (first-admin setup from environment variables, only when no Administrator exists yet):
 *   APP_ENV=production FIRST_ADMIN_EMAIL=... FIRST_ADMIN_USERNAME=... FIRST_ADMIN_PASSWORD=... bun scripts/seed-admin.ts
 * Passwords are sent to the managed auth service, which stores only a secure hash.
 */
import { createClient } from "@supabase/supabase-js";

const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const isProd = !["development", "staging", "test"].includes(env);
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

let EMAIL = "admin@apexlegal.test", USERNAME = "admin", PASSWORD = "Admin@12345"; // Demo credentials for testing only.
if (isProd) {
  const e = process.env.FIRST_ADMIN_EMAIL, u = process.env.FIRST_ADMIN_USERNAME, p = process.env.FIRST_ADMIN_PASSWORD;
  if (!e || !u || !p || p.length < 12) { console.error("Production: set FIRST_ADMIN_EMAIL, FIRST_ADMIN_USERNAME and FIRST_ADMIN_PASSWORD (12+ chars). The demo admin is never created in production."); process.exit(1); }
  EMAIL = e.toLowerCase(); USERNAME = u.toLowerCase(); PASSWORD = p;
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

if (isProd) {
  const { count } = await db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) > 0) { console.log("An Administrator already exists; first-admin setup skipped."); process.exit(0); }
}

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit || data.users.length < 200) return hit;
  }
}

let user = await findUser(EMAIL);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { name: "Administrator" } });
  if (error) throw error;
  user = data.user;
  console.log("Created administrator", USERNAME);
  const { error: pe } = await db.from("staff_profiles").insert({ user_id: user.id, full_name: "Administrator", username: USERNAME, email: EMAIL, must_change_password: false });
  if (pe) throw pe;
} else {
  console.log("Administrator already exists", USERNAME, "(password left unchanged)");
  await db.from("staff_profiles").upsert({ user_id: user.id, full_name: "Administrator", username: USERNAME, email: EMAIL, must_change_password: false }, { onConflict: "user_id" });
}
const { error: re } = await db.from("user_roles").upsert({ user_id: user!.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (re) throw re;
console.log("Administrator role ensured.");
