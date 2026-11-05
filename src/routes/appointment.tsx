import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PublicPage } from "@/components/layout/PublicPage";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { fmtDateTime } from "@/lib/time";
import { statusLabel } from "@/lib/staff";
import { advocateDisplayName, consultationModeLabel, meetingInformation } from "@/lib/booking-choice";
import { AdvocatePhoto } from "@/components/booking/ConsultationSummary";
import { AppointmentChanges } from "@/components/booking/AppointmentConfirmation";

export const Route = createFileRoute("/appointment")({ head: () => pageHead("Your Appointment", "View your Apex Legal Partners appointment request.", true), component: Page });

function Page() {
  // The access token travels in the URL fragment, which browsers never send to servers or logs.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(window.location.hash.slice(1)); }, []);
  const q = useQuery({
    enabled: token !== null,
    queryKey: ["appointment-token", token],
    queryFn: async () => { const { data, error } = await supabase.rpc("appointment_details_by_token", { _token: token ?? "" }); if (error) throw error; return data?.[0] ?? null; },
  });
  const a = q.data;
  return <PublicPage eyebrow="Appointment details" title={a ? `Booking ${a.booking_ref}` : "Your Appointment"} description="Keep this link private. It gives access to your appointment summary.">
    {q.isLoading || token === null ? <p className="text-muted-foreground">Loading…</p> : !a ? <p role="alert">We couldn't find an appointment for this link. Please check the link or contact us.</p> :
      <div className="max-w-3xl"><div className="mb-6 flex items-center gap-4"><AdvocatePhoto name={a.advocate_name} url={a.advocate_photo_url} /><h2 className="text-xl">{advocateDisplayName(a.advocate_name)}</h2></div><dl className="divide-y border-y text-sm">
        {[["Status", statusLabel[a.status]], ["Client", a.client_name], ["Consultation mode", consultationModeLabel(a.consultation_mode)], ["When", fmtDateTime(a.starts_at, a.timezone)], ["Location / instructions", meetingInformation(a.consultation_mode, { name: a.location_name, address: a.location_address })]].map(([k, v]) => <div key={k} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}
      </dl><AppointmentChanges /></div>}
    <Button asChild variant="outline" className="mt-6 h-12"><Link to="/">Back to Home</Link></Button>
  </PublicPage>;
}
