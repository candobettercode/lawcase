/** Login throttling rules shared by the sign-in server function and its tests. */
export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;
export const IP_FAILURES_PER_HOUR = 30;
/** Absolute staff session lifetime; the interface signs out after this even if tokens refresh. */
export const SESSION_MAX_HOURS = 12;

/** Administrators change passwords voluntarily in Settings, not during login. */
export function requiresPasswordChange(pending: boolean, roles: readonly string[]) {
  return pending && !roles.includes("admin");
}

export interface Attempt { success: boolean; created_at: string }

/** Locked when the last N attempts inside the window are all failures. Returns minutes remaining or 0. */
export function lockoutMinutesLeft(attempts: Attempt[], now = Date.now()): number {
  const windowStart = now - LOCKOUT_MINUTES * 60_000;
  const recent = attempts.filter((a) => Date.parse(a.created_at) >= windowStart)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const failures: Attempt[] = [];
  for (const a of recent) { if (a.success) break; failures.push(a); }
  if (failures.length < LOCKOUT_FAILURES) return 0;
  const unlockAt = Date.parse(failures[0].created_at) + LOCKOUT_MINUTES * 60_000;
  return Math.max(1, Math.ceil((unlockAt - now) / 60_000));
}

export function sessionExpired(lastLoginAt: string | null | undefined, now = Date.now()) {
  return !!lastLoginAt && now - Date.parse(lastLoginAt) > SESSION_MAX_HOURS * 3600_000;
}
