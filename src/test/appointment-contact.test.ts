import { describe, expect, it } from "vitest";
import { appointmentContactLinks, appointmentContactSchema } from "@/lib/appointment-contact";

describe("appointment contact rules", () => {
  it("accepts the specified international phone example", () => {
    expect(appointmentContactSchema.parse({ phone: "+91 98765 43210", email: "" }).phone).toBe("+91 98765 43210");
  });
  it("rejects a phone without an international country code", () => {
    expect(appointmentContactSchema.safeParse({ phone: "9876543210", email: "" }).success).toBe(false);
  });
  it("rejects an invalid international phone", () => {
    expect(appointmentContactSchema.safeParse({ phone: "+91 123", email: "" }).success).toBe(false);
  });
  it("accepts the specified email example", () => {
    expect(appointmentContactSchema.parse({ phone: "", email: "bookings@apexlegalpartners.com" }).email).toBe("bookings@apexlegalpartners.com");
  });
  it("rejects a malformed email before saving", () => {
    expect(appointmentContactSchema.safeParse({ phone: "", email: "not-an-email" }).success).toBe(false);
  });
  it("allows contacts to be unconfigured without adding defaults", () => {
    expect(appointmentContactSchema.parse({ phone: "", email: "" })).toEqual({ phone: "", email: "" });
    expect(appointmentContactLinks(undefined, null)).toEqual({ phone: null, email: null });
  });
  it("creates a callable international phone link", () => {
    expect(appointmentContactLinks("+91 98765 43210", "").phone?.href).toBe("tel:+919876543210");
  });
  it("creates a mail link for the configured email", () => {
    expect(appointmentContactLinks("", "bookings@apexlegalpartners.com").email?.href).toBe("mailto:bookings@apexlegalpartners.com");
  });
  it("returns changed settings rather than a contact snapshot", () => {
    const first = appointmentContactLinks("+91 98765 43210", "bookings@apexlegalpartners.com");
    const second = appointmentContactLinks("+91 91234 56789", "appointments@apexlegalpartners.com");
    expect(second.phone?.href).not.toBe(first.phone?.href);
    expect(second.email?.href).toBe("mailto:appointments@apexlegalpartners.com");
  });
});