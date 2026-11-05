import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { can, errorText, useMyRoles } from "@/lib/staff";
import { SettingsHeader } from "@/components/settings/SettingsShell";
import { AppointmentContactSettings } from "@/components/settings/AppointmentContactSettings";

export const Route = createFileRoute("/_authenticated/settings/booking")({ head: () => pageHead("Booking Settings", "Firm booking settings.", true), component: Page });

function Page() {
  const qc = useQueryClient();
  const roles = useMyRoles();
  const s = useQuery({ queryKey: ["booking-settings"], queryFn: async () => (await supabase.from("booking_settings").select("*").eq("id", 1).single()).data });
  const allowed = can.manageBookingSettings(roles.data ?? []);
  const isAdmin = (roles.data ?? []).includes("admin");
  const [meetingDuration, setMeetingDuration] = useState(30);
  useEffect(() => { if (s.data?.default_meeting_minutes) setMeetingDuration(s.data.default_meeting_minutes); }, [s.data?.default_meeting_minutes]);
  async function toggle(v: boolean) {
    const { error } = await supabase.from("booking_settings").update({ accept_online_bookings: v, updated_at: new Date().toISOString() }).eq("id", 1).select().single();
    if (error) return toast.error("Only Admin and Staff can change this setting.");
    qc.invalidateQueries({ queryKey: ["booking-settings"] }); qc.invalidateQueries({ queryKey: ["booking-directory"] });
    toast.success(v ? "Online bookings are on" : "Online bookings are off");
  }
  async function updatePreference(values: { time_format?: string; allow_timezone_change?: boolean; show_first_available?: boolean; slot_hold_minutes?: number; staff_can_manage_directory?: boolean; default_meeting_minutes?: number }) {
    const { error } = await supabase.from("booking_settings").update({ ...values, updated_at: new Date().toISOString() }).eq("id", 1).select().single();
    if (error) return toast.error(errorText(error));
    await qc.invalidateQueries({ queryKey: ["booking-settings"] });
    await qc.invalidateQueries({ queryKey: ["booking-directory"] });
    toast.success("Settings updated");
  }
  return <>
    <SettingsHeader title="Booking Settings" />
    <section className="max-w-2xl rounded-md border bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div><Label htmlFor="accept" className="text-base">Accept Online Bookings</Label><p className="mt-1 text-sm text-muted-foreground">When off, the public booking page shows a contact message and new requests are rejected.</p></div>
        <Switch id="accept" checked={!!s.data?.accept_online_bookings} disabled={!allowed || !s.data} onCheckedChange={toggle} />
      </div>
      {!allowed && roles.data && <p className="mt-4 text-sm text-muted-foreground">Only Admin and Staff can change this setting.</p>}
      {s.data && <div className="mt-6 grid gap-5 border-t pt-6">
        <div className="grid gap-2"><Label htmlFor="time-format">Time format</Label><select id="time-format" disabled={!allowed} className="h-11 rounded-md border bg-card px-3" value={s.data.time_format} onChange={(e) => updatePreference({ time_format: e.target.value })}><option value="12">12-hour</option><option value="24">24-hour</option></select></div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><Label htmlFor="timezone-change">Allow visitors to change time zone</Label><Switch id="timezone-change" disabled={!allowed} checked={s.data.allow_timezone_change} onCheckedChange={(v) => updatePreference({ allow_timezone_change: v })} /></div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><Label htmlFor="first-available">Show First available advocate</Label><Switch id="first-available" disabled={!allowed} checked={s.data.show_first_available} onCheckedChange={(v) => updatePreference({ show_first_available: v })} /></div>
        <div className="grid gap-2"><Label htmlFor="hold-minutes">Time hold duration (minutes)</Label><Input id="hold-minutes" type="number" min={1} max={30} disabled={!allowed} defaultValue={s.data.slot_hold_minutes} onBlur={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 1 && v <= 30 && v !== s.data?.slot_hold_minutes) updatePreference({ slot_hold_minutes: v }); }} /></div>
      </div>}
      {s.data && <p className="mt-6 text-sm text-muted-foreground">Minimum notice {s.data.min_notice_hours} h · bookable up to {s.data.max_advance_days} days ahead</p>}
    </section>
    {isAdmin && <AppointmentContactSettings />}
    {isAdmin && s.data && <section className="mt-6 max-w-2xl rounded-md border bg-card p-6">
      <h2 className="text-lg">Appointment Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">This duration applies only to newly created appointments. Existing appointments keep their current duration.</p>
      <div className="mt-5 grid gap-2">
        <Label htmlFor="meeting-duration">Default Meeting Duration</Label>
        <select id="meeting-duration" className="h-11 rounded-md border bg-card px-3" value={meetingDuration} onChange={(e) => setMeetingDuration(Number(e.target.value))}>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </div>
      <Button className="mt-5" onClick={() => updatePreference({ default_meeting_minutes: meetingDuration })}>Save Changes</Button>
    </section>}
    {s.data && <section className="mt-6 max-w-2xl rounded-md border bg-card p-6">
      <h2 className="text-lg">Permissions</h2>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div><Label htmlFor="staff-directory">Staff may manage advocates and locations</Label><p className="mt-1 text-sm text-muted-foreground">Off by default: only Administrators can add, edit, deactivate or delete advocates and locations. Staff can never manage staff or Administrator accounts.</p></div>
        <Switch id="staff-directory" disabled={!isAdmin} checked={s.data.staff_can_manage_directory} onCheckedChange={(v) => updatePreference({ staff_can_manage_directory: v })} />
      </div>
      {!isAdmin && <p className="mt-3 text-sm text-muted-foreground">Only an Administrator can change permissions.</p>}
    </section>}
  </>;
}
