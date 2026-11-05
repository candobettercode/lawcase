import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  phone: z.string().trim().regex(/^\+[1-9][\d ()-]{6,20}$/, "Include your country code, for example +1 212 555 0123."),
  email: z.union([z.string().trim().email("Enter a valid email address.").max(255), z.literal("")]).optional().default(""),
});

export const bookingRequestSchema = contactSchema.extend({
  locationId: z.string().uuid("Choose a location."),
  advocateId: z.string().uuid("Choose an advocate."),
  serviceId: z.string().uuid("Choose a service."),
  startsAt: z.string().datetime({ offset: true }).refine((v) => new Date(v).getTime() > Date.now(), "Choose a future time."),
  opposingParty: z.string().trim().max(200).default(""),
  matterDescription: z.string().trim().max(2000).default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Please accept the consent statement." }) }),
  website: z.string().max(200).default(""), // honeypot, must stay empty
  startedAt: z.number(),
  holdToken: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const holdSchema = z.object({
  locationId: z.string().uuid(), serviceId: z.string().uuid(), advocateId: z.string().uuid().nullable(),
  startsAt: z.string().datetime({ offset: true }), previousToken: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  website: z.string().max(200).default(""), startedAt: z.number(),
});

export const consultationModeSchema = z.enum(["online", "in_person", "phone"]);
export const appointmentHoldSchema = holdSchema.extend({ mode: consultationModeSchema });
export const appointmentRequestSchema = contactSchema.extend({
  locationId: z.string().uuid("Choose a location."),
  serviceId: z.string().uuid(),
  advocateId: z.string().uuid().nullable(),
  startsAt: z.string().datetime({ offset: true }).refine((v) => Date.parse(v) > Date.now(), "Choose a future time."),
  mode: consultationModeSchema,
  consent: z.literal(true, { errorMap: () => ({ message: "Please accept the consent statement." }) }),
  website: z.string().max(200).default(""),
  startedAt: z.number().finite(),
  holdToken: z.string().regex(/^[0-9a-f]{64}$/),
});

const codes = ["BOOKING_CLOSED", "RATE_LIMITED", "INVALID_INPUT", "SLOT_UNAVAILABLE"] as const;
export function friendlyBookingError(error: { message?: string; hint?: string } | null) {
  const code = codes.find((c) => error?.message?.includes(c)) ?? "UNKNOWN";
  const message = error?.hint || (code === "UNKNOWN" ? "We couldn't save your request. Please try again or contact us." : "Please try again.");
  return { code, message };
}
