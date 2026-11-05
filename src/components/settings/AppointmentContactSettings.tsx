import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppointmentContact } from "@/hooks/use-appointment-contact";
import { appointmentContactSchema } from "@/lib/appointment-contact";
import { saveAppointmentContact } from "@/lib/appointment-contact.functions";
import { errorText } from "@/lib/staff";

export function AppointmentContactSettings() {
  const contact = useAppointmentContact();
  const qc = useQueryClient();
  const save = useServerFn(saveAppointmentContact);
  const [draft, setDraft] = useState<{ phone: string; email: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const values = draft ?? { phone: contact.data?.contact_phone ?? "", email: contact.data?.contact_email ?? "" };
  const missing = !contact.data?.contact_phone ? ["mobile number"] : [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = appointmentContactSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setErrors({}); setBusy(true);
    try {
      const saved = await save({ data: parsed.data });
      qc.setQueryData(["appointment-contact-details"], saved);
      setDraft(null);
      await Promise.all(["appointment-contact-details", "booking-settings", "booking-directory", "appointment-token"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success("Appointment contact details saved");
    } catch (error) { setErrors({ save: errorText(error) }); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 max-w-2xl border-t pt-6" aria-labelledby="appointment-contact-heading">
    <h2 id="appointment-contact-heading" className="text-lg">Appointment Contact Details</h2>
    {contact.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading contact details…</p> : contact.error ? <p role="alert" className="mt-4 text-sm text-destructive">Contact details could not be loaded. Please reload this page.</p> : <form onSubmit={submit} noValidate className="mt-4 grid gap-5">
      {missing.length > 0 && <p role="status" className="border-l-2 border-brand bg-brand-soft p-3 text-sm">Rescheduling &amp; cancellation mobile number is not configured. Add it below; the number is shown to customers only in the appointment confirmation and details.</p>}
      <div className="grid gap-2"><Label htmlFor="rescheduling-phone">Rescheduling &amp; Cancellation Mobile Number</Label><Input id="rescheduling-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={40} value={values.phone} disabled={busy} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "rescheduling-phone-error" : undefined} onChange={(e) => setDraft({ ...values, phone: e.target.value })} />{errors.phone && <p id="rescheduling-phone-error" role="alert" className="text-sm text-destructive">{errors.phone}</p>}</div>
      {errors.save && <p role="alert" className="text-sm text-destructive">{errors.save}</p>}
      <Button type="submit" className="h-11 justify-self-start" disabled={busy || !draft}><Save />{busy ? "Saving…" : "Save Changes"}</Button>
    </form>}
  </section>;
}