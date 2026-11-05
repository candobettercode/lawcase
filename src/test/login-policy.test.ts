import { describe, expect, it } from "vitest";
import { lockoutMinutesLeft, sessionExpired, requiresPasswordChange } from "@/lib/login-policy";

const now = Date.parse("2026-10-13T10:00:00Z");
const at = (minAgo: number, success = false) => ({ success, created_at: new Date(now - minAgo * 60_000).toISOString() });

describe("login lockout", () => {
  it("does not force administrators to change passwords after login", () => {
    expect(requiresPasswordChange(true, ["admin"])).toBe(false);
    expect(requiresPasswordChange(true, ["staff", "admin"])).toBe(false);
  });
  it("keeps temporary password requirements for other staff", () => {
    expect(requiresPasswordChange(true, ["staff"])).toBe(true);
    expect(requiresPasswordChange(true, ["advocate"])).toBe(true);
    expect(requiresPasswordChange(false, ["staff"])).toBe(false);
  });
  it("locks after 5 consecutive failures within 15 minutes", () => {
    expect(lockoutMinutesLeft([at(1), at(2), at(3), at(4), at(5)], now)).toBe(14);
  });
  it("does not lock after 4 failures", () => {
    expect(lockoutMinutesLeft([at(1), at(2), at(3), at(4)], now)).toBe(0);
  });
  it("a successful login resets the failure streak", () => {
    expect(lockoutMinutesLeft([at(1), at(2), at(3, true), at(4), at(5), at(6)], now)).toBe(0);
  });
  it("unlocks 15 minutes after the latest failure", () => {
    expect(lockoutMinutesLeft([at(16), at(17), at(18), at(19), at(20)], now)).toBe(0);
  });
  it("expires staff sessions after 12 hours", () => {
    expect(sessionExpired(new Date(now - 13 * 3600_000).toISOString(), now)).toBe(true);
    expect(sessionExpired(new Date(now - 11 * 3600_000).toISOString(), now)).toBe(false);
  });
});
