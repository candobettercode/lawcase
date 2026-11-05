import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";

// Policy wording is independent of editable contact information.
export const appointmentChangesPolicy = "Contact Apex Legal Partners and quote your appointment reference to request a change or cancellation. The firm will confirm the applicable terms.";

export const appointmentContactSchema = z.object({
  phone: z.string().trim().max(40).refine((value) => {
    if (!value) return true;
    if (!/^\+[0-9\s().-]+$/.test(value)) return false;
    return parsePhoneNumberFromString(value)?.isValid() === true;
  }, "Enter a valid international phone number, including the country code."),
  email: z.string().trim().max(255).refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid email address."),
});

export function appointmentContactLinks(phone: string | null | undefined, email: string | null | undefined) {
  const values = appointmentContactSchema.shape;
  const validPhone = values.phone.safeParse(phone ?? "");
  const validEmail = values.email.safeParse(email ?? "");
  return {
    phone: validPhone.success && validPhone.data ? { text: validPhone.data, href: `tel:${validPhone.data.replace(/[^+\d]/g, "")}` } : null,
    email: validEmail.success && validEmail.data ? { text: validEmail.data, href: `mailto:${validEmail.data}` } : null,
  };
}