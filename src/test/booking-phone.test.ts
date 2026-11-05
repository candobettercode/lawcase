import { describe, expect, it } from "vitest";
import { internationalBookingPhone, pastedBookingPhone } from "@/lib/booking-phone";
import { contactSchema } from "@/lib/booking-schema";

describe("booking country code and mobile number", () => {
  it("prepends the chosen country's calling code before submission", () => {
    expect(internationalBookingPhone("IN", "98765 43210")).toBe("+91 98765 43210");
    expect(internationalBookingPhone("US", "212 555 0123")).toBe("+1 212 555 0123");
  });
  it("keeps a blank mobile number invalid even with a selected country", () => {
    expect(contactSchema.safeParse({ name: "Jane Doe", phone: internationalBookingPhone("IN", " "), email: "" }).success).toBe(false);
  });
  it("splits a pasted international number without duplicating its country code", () => {
    const phone = pastedBookingPhone("+91 98765 43210");
    expect(phone).toEqual({ country: "IN", number: "9876543210" });
    if (!phone) throw new Error("Expected an international number");
    expect(internationalBookingPhone(phone.country, phone.number)).toBe("+91 9876543210");
  });
  it("leaves national input associated with the selected country", () => {
    expect(pastedBookingPhone("212 555 0123")).toBeNull();
  });
});