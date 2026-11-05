import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "admin" | "staff" | "advocate";
export const statusLabel: Record<string, string> = {
  awaiting_confirmation: "Awaiting Confirmation", confirmed: "Confirmed", completed: "Completed",
  cancelled: "Cancelled", declined: "Declined", no_show: "No Show",
};

/** Permission matrix (enforced in the database; this mirrors it for the interface). */
export const can = {
  manageBookingSettings: (r: StaffRole[]) => r.includes("admin") || r.includes("staff"),
  manageAppointments: (r: StaffRole[]) => r.length > 0,
  manageAdministrators: (r: StaffRole[]) => r.includes("admin"),
  manageDirectory: (r: StaffRole[], staffAllowed = false) => r.includes("admin") || (staffAllowed && r.includes("staff")),
};

export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as StaffRole[];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as StaffRole);
    },
  });
}

export function rpcMessage(e: { message?: string; hint?: string } | null) {
  return e?.hint || "Something went wrong. Please try again.";
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("staff_profiles").select("full_name,username,status,is_deleted,must_change_password,last_login_at").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });
}

/** Error text from a failed server action or database rule. */
export function errorText(e: unknown) {
  const err = e as { hint?: string; message?: string } | null;
  return err?.hint || err?.message?.replace(/^Forbidden: /, "") || "Something went wrong. Please try again.";
}
