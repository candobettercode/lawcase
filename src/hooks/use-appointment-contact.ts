import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const appointmentContactOptions = queryOptions({
  queryKey: ["appointment-contact-details"],
  staleTime: 0,
  refetchInterval: 10_000,
  refetchOnWindowFocus: "always",
  queryFn: async () => {
    const { data, error } = await supabase.from("booking_settings").select("contact_phone,contact_email").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function useAppointmentContact() {
  return useQuery(appointmentContactOptions);
}