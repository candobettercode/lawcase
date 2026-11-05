import { z } from "zod";

/** Shared client/server validation for admin directory management. */
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Use 3-30 letters, numbers, dots, dashes or underscores.");
export const passwordSchema = z.string()
  .min(10, "Use at least 10 characters.").max(72)
  .regex(/[a-z]/, "Include a lowercase letter.").regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.").regex(/[^A-Za-z0-9]/, "Include a symbol.");
export const roleSchema = z.enum(["admin", "staff", "advocate"]);

export const userFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(255),
  username: usernameSchema,
  phone: z.string().trim().max(30).regex(/^[+\d ()-]*$/, "Use digits, spaces, + ( ) or -."),
  role: roleSchema,
  status: z.enum(["active", "inactive"]),
  locationIds: z.array(z.string().uuid()).max(50),
  advocateIds: z.array(z.string().uuid()).max(100),
});
export const createUserSchema = userFormSchema.extend({ tempPassword: passwordSchema });
export const updateUserSchema = userFormSchema.extend({ userId: z.string().uuid() });

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(3).max(255),
  password: z.string().min(1).max(200),
});

export const hourRangeSchema = z.object({
  location_id: z.string().uuid(), weekday: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((r) => r.end > r.start, { message: "End time must be after start time." });

export const advocateFormSchema = z.object({
  name: z.string().trim().min(2, "Full name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: z.string().trim().max(30).regex(/^[+\d ()-]*$/, "Use digits, spaces, + ( ) or -."),
  designation: z.string().trim().max(100),
  bar_number: z.string().trim().max(40),
  specializations: z.array(z.string().trim().min(1).max(60)).max(20),
  years_experience: z.number().int().min(0).max(80),
  bio: z.string().max(2000),
  photo_url: z.string().max(2000),
  slot_minutes: z.number().int().min(10).max(240),
  buffer_minutes: z.number().int().min(0).max(120),
  active: z.boolean(),
  locationIds: z.array(z.string().uuid()),
  hours: z.array(hourRangeSchema),
});

export const locationFormSchema = z.object({
  name: z.string().trim().min(2, "Location name is required.").max(120),
  kind: z.enum(["physical", "virtual"]),
  address: z.string().trim().max(300),
  city: z.string().trim().max(100),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(255).refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email."),
  timezone: z.string().min(1),
  active: z.boolean(),
  default_hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: z.string(), end: z.string() })),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
}).refine((l) => l.kind === "virtual" || l.address.length > 0, { message: "Address is required for physical locations.", path: ["address"] });

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export function photoProblem(file: { type: string; size: number }) {
  if (!PHOTO_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > PHOTO_MAX_BYTES) return "Photos must be 2 MB or smaller.";
  return null;
}
