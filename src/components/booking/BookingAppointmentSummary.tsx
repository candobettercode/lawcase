import { CalendarDays, Clock3, MapPin, Video } from "lucide-react";
import { consultationModeLabel, type ConsultationMode } from "@/lib/booking-choice";
import { slotLabel } from "@/lib/booking-time";

export function BookingAppointmentSummary({ startsAt, zone, mode }: {
  startsAt: string; zone: string; mode: ConsultationMode;
}) {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" }).format(new Date(startsAt));
  return <aside aria-label="Appointment summary" className="rounded-md border bg-card p-5">
    <p className="mb-2 text-xs font-medium text-muted-foreground">Appointment Summary</p>
    <h3 className="text-lg leading-relaxed">Initial Consultation</h3>
    <dl className="mt-3 grid gap-3 @min-[560px]/booking:grid-cols-3">
      <div className="flex items-center gap-2.5 text-sm"><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><dt className="sr-only">Date</dt><dd className="font-medium">{date}</dd></div>
      <div className="flex items-center gap-2.5 text-sm"><Clock3 className="size-4 shrink-0 text-muted-foreground" /><dt className="sr-only">Time</dt><dd className="font-medium">{slotLabel(startsAt, zone, "12")}</dd></div>
      <div className="flex items-center gap-2.5 text-sm">{mode === "online" ? <Video className="size-4 shrink-0 text-muted-foreground" /> : <MapPin className="size-4 shrink-0 text-muted-foreground" />}<dt className="sr-only">Mode</dt><dd className="font-medium">{consultationModeLabel(mode)}</dd></div>
    </dl>
  </aside>;
}