import { describe, expect, it } from "vitest";
import { appointmentRequestSchema, bookingRequestSchema, contactSchema, friendlyBookingError } from "@/lib/booking-schema";
import { defaultPublicConsultationMode, publicConsultationModes, locationsForMode } from "@/lib/booking-choice";

const valid = { name: "Jane Doe", phone: "+1 212 555 0123", email: "jane@example.com", locationId: crypto.randomUUID(), advocateId: crypto.randomUUID(), serviceId: crypto.randomUUID(), startsAt: new Date(Date.now() + 864e5).toISOString(), opposingParty: "", matterDescription: "", consent: true, website: "", startedAt: Date.now() };

describe("booking request validation", () => {
  it("accepts a complete request", () => expect(bookingRequestSchema.safeParse(valid).success).toBe(true));
  it("requires a phone number with country code", () => expect(bookingRequestSchema.safeParse({ ...valid, phone: "2125550123" }).success).toBe(false));
  it("rejects past times", () => expect(bookingRequestSchema.safeParse({ ...valid, startsAt: new Date(Date.now() - 6e4).toISOString() }).success).toBe(false));
  it("requires consent", () => expect(bookingRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false));
  it("maps the booking-off error to the friendly message", () => {
    expect(friendlyBookingError({ message: "BOOKING_CLOSED", hint: "Online booking is temporarily unavailable. Please contact us." }))
      .toEqual({ code: "BOOKING_CLOSED", message: "Online booking is temporarily unavailable. Please contact us." });
  });
});

describe("simplified appointment rules", () => {
  it("offers only In-person and Online for new public appointments", () => {
    expect(publicConsultationModes.map((mode) => mode.value)).toEqual(["in_person", "online"]);
  });
  it("defaults public appointments to In-person", () => {
    expect(defaultPublicConsultationMode).toBe("in_person");
  });
  const request = { ...valid, mode: "online", holdToken: "a".repeat(64) };
  it("allows optional email with on-screen confirmation", () => {
    expect(contactSchema.parse({ name: "Jane Doe", phone: "+1 212 555 0123" }).email).toBe("");
    expect(appointmentRequestSchema.safeParse({ ...request, email: "" }).success).toBe(true);
  });
  it("validates email when supplied", () => expect(appointmentRequestSchema.safeParse({ ...request, email: "not-email" }).success).toBe(false));
  it("requires full name", () => expect(appointmentRequestSchema.safeParse({ ...request, name: "" }).success).toBe(false));
  it("requires mobile number", () => expect(appointmentRequestSchema.safeParse({ ...request, phone: "" }).success).toBe(false));
  it("supports optional advocate selection", () => expect(appointmentRequestSchema.parse({ ...request, advocateId: null }).advocateId).toBeNull());
  it("retains explicit advocate choice", () => expect(appointmentRequestSchema.parse(request).advocateId).toBe(valid.advocateId));
  it.each(["online", "in_person", "phone"])("accepts %s consultation", (mode) => expect(appointmentRequestSchema.safeParse({ ...request, mode }).success).toBe(true));
  it("rejects unknown consultation mode", () => expect(appointmentRequestSchema.safeParse({ ...request, mode: "other" }).success).toBe(false));
  it("requires a hold for confirmation", () => expect(appointmentRequestSchema.safeParse({ ...request, holdToken: undefined }).success).toBe(false));
  it("routes Online to virtual and In-person to physical locations", () => {
    const locations = [{ id: "office", kind: "physical" }, { id: "virtual", kind: "virtual" }];
    expect(locationsForMode(locations, "online").map((l) => l.id)).toEqual(["virtual"]);
    expect(locationsForMode(locations, "in_person").map((l) => l.id)).toEqual(["office"]);
    expect(locationsForMode(locations, "phone").map((l) => l.id)).toEqual(["virtual"]);
  });
});
