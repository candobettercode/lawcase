/**
 * Demo staff seed — safe to run more than once (no duplicates).
 *
 *   Demo credentials for testing only. Change or delete before going live.
 *   Email: staff@apexlegal.test   Password: Staff@12345   Role: Staff
 *
 * The password is sent to the managed auth service, which stores only a secure hash.
 * Refuses to run when APP_ENV/NODE_ENV is "production". Run with:
 *   APP_ENV=development bun scripts/seed-demo-staff.ts
 * Sample locations, advocates, services and weekly hours are created by the database migration.
 */
import { createClient } from "@supabase/supabase-js";

const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
if (!["development", "staging", "test"].includes(env)) {
  console.error(`Refusing to create the demo staff account in "${env}". Allowed: development, staging.`);
  process.exit(1);
}
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

const EMAIL = "staff@apexlegal.test";
const PASSWORD = "Staff@12345"; // Demo credentials for testing only. Change or delete before going live.
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit || data.users.length < 200) return hit;
  }
}

let user = await findUser(EMAIL);
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { name: "Demo Staff", status: "active", demo: true } });
  if (error) throw error;
  user = data.user;
  console.log("Created demo staff account", EMAIL);
} else {
  await admin.auth.admin.updateUserById(user.id, { user_metadata: { name: "Demo Staff", status: "active", demo: true }, ban_duration: "none" });
  console.log("Demo staff account already exists", EMAIL);
}
const { error: roleError } = await admin.from("user_roles").upsert({ user_id: user!.id, role: "staff" }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (roleError) throw roleError;
const { count } = await admin.from("locations").select("id", { count: "exact", head: true });
console.log(`Staff role ensured. Locations in database: ${count ?? 0}.`);
