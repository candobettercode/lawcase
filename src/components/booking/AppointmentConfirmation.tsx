import { Button } from "@/components/ui/button";
import { advocateDisplayName, consultationModeLabel, meetingInformation } from "@/lib/booking-choice";
import { fmtDateTime } from "@/lib/time";
import { AdvocatePhoto } from "./ConsultationSummary";
import { useAppointmentContact } from "@/hooks/use-appointment-contact";
import { appointmentContactLinks } from "@/lib/appointment-contact";

export function AppointmentChanges() {
  const contact = useAppointmentContact();
  const links = appointmentContactLinks(contact.data?.contact_phone, "");
  return <div className="mt-6 border-t pt-5">
    <h3 className="text-base">Rescheduling &amp; cancellation</h3>
    {links.phone && <a className="mt-3 block w-fit text-base font-semibold underline underline-offset-4" href={links.phone.href}>{links.phone.text}</a>}
  </div>;
}

export type ConfirmedAppointment = { bookingRef: string; accessToken: string; clientName: string; advocateName: string; advocatePhoto?: string | null; mode: string; startsAt: string; zone: string; fee: number | null; location: { name: string; address?: string } };
export function AppointmentConfirmation({ appointment: a }: { appointment: ConfirmedAppointment }) {
  return <section className="max-w-3xl" aria-labelledby="confirmation-heading">
    <h2 id="confirmation-heading" className="text-2xl">Appointment Request Submitted</h2>
    <p className="mt-3 text-sm text-muted-foreground">Your appointment request has been successfully submitted.</p>
    <div className="my-6 flex items-center gap-4"><AdvocatePhoto name={a.advocateName} url={a.advocatePhoto} /><div className="min-w-0"><h3 className="break-words text-lg">{advocateDisplayName(a.advocateName)}</h3><p className="mt-1 text-sm text-muted-foreground">Awaiting Confirmation</p></div></div>
    <dl className="divide-y border-y">{[["Appointment reference", a.bookingRef], ["Client", a.clientName], ["Consultation mode", consultationModeLabel(a.mode)], ["Date & time", fmtDateTime(a.startsAt, a.zone)], ["Time zone", a.zone.replaceAll("_", " ")], ["Location / instructions", meetingInformation(a.mode, a.location)]].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)]"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words text-sm">{value}</dd></div>)}</dl>
    <AppointmentChanges />
    <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="outline" className="h-12"><a href="/">Back to Home</a></Button><Button asChild className="h-12"><a href={`/appointment#${a.accessToken}`}>View Appointment Details</a></Button></div>
  </section>;
}