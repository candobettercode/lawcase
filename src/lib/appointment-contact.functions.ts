import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appointmentContactSchema } from "./appointment-contact";

export const saveAppointmentContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => appointmentContactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) {
      setResponseStatus(403);
      throw new Error("Only an Administrator can change appointment contact details.");
    }
    const { data: saved, error } = await context.supabase.from("booking_settings")
      .update({ contact_phone: data.phone, contact_email: data.email, updated_at: new Date().toISOString() })
      .eq("id", 1).select("contact_phone,contact_email").single();
    if (error || !saved) throw new Error("Appointment contact details could not be saved. Please try again.");
    return saved;
  });