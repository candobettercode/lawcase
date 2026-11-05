import { useQuery, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const bookingDirectoryOptions = queryOptions({
  queryKey: ["booking-directory"],
  queryFn: async () => {
    const [loc, svc, adv, links, settings] = await Promise.all([
      supabase.from("locations").select("id,name,address,city,kind,timezone").eq("active", true).eq("is_deleted", false).order("sort_order"),
      supabase.from("services").select("id,name,description,duration_minutes,fee").eq("active", true).order("sort_order"),
      supabase.from("advocates").select("id,name,designation,specializations,years_experience,photo_url,bio").eq("active", true).eq("is_deleted", false).is("deleted_at", null),
      supabase.from("advocate_locations").select("advocate_id,location_id"),
      supabase.from("booking_settings").select("*").eq("id", 1).single(),
    ]);
    const error = loc.error ?? svc.error ?? adv.error ?? links.error ?? settings.error;
    if (error) throw error;
    const defaultDuration = settings.data?.default_meeting_minutes ?? 30;
    const services = (svc.data ?? []).map((service) => ({ ...service, duration_minutes: defaultDuration }));
    return { locations: loc.data ?? [], services, advocates: adv.data ?? [], links: links.data ?? [], settings: settings.data };
  },
});
export type AvailabilityChoice = { locationId: string; serviceId: string; advocateId: string | null; zone: string };
export function useBookingAvailability(choice: AvailabilityChoice, month: string, date: string, enabled: boolean) {
  // Generated RPC types omit SQL argument nullability; SQL NULL means any eligible advocate.
  const args = { _location: choice.locationId, _service: choice.serviceId, _advocate: choice.advocateId ?? (null as unknown as string), _zone: choice.zone };
  const monthQuery = useQuery({
    queryKey: ["booking-month", choice, month], enabled, staleTime: 0, placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booking_month_availability", { ...args, _month: month });
      if (error) throw error;
      return data ?? [];
    },
  });
  const slotsQuery = useQuery({
    queryKey: ["booking-day", choice, date], enabled: enabled && !!date, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booking_day_slots", { ...args, _date: date });
      if (error) throw error;
      return (data ?? []).map((slot) => new Date(slot.starts_at).toISOString());
    },
  });
  return { monthQuery, slotsQuery };
}

export function useAvailableBookingAdvocates(choice: AvailabilityChoice, month: string, date: string, startsAt: string, holdToken: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["booking-advocate-options", choice.locationId, choice.serviceId, choice.zone, month, date, startsAt, holdToken],
    enabled, staleTime: 0, refetchInterval: 30_000,
    // A replacement hold changes the token, not the appointment. Retain the
    // same-instant list while checking its new token to avoid false unavailability.
    placeholderData: (previous, query) => {
      const sameAppointment = [choice.locationId, choice.serviceId, choice.zone, month, date, startsAt].every((value, i) => query?.queryKey[i + 1] === value);
      return sameAppointment ? previous : undefined;
    },
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booking_advocate_options", {
        _location: choice.locationId, _service: choice.serviceId, _month: month,
        _date: date || (null as unknown as string), _start: startsAt || (null as unknown as string),
        _zone: choice.zone, _hold_token: holdToken,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}