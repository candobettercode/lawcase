import { createFileRoute, redirect } from "@tanstack/react-router";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { pageHead } from "@/lib/public-content";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/change-password")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (data?.some((r) => r.role === "admin")) throw redirect({ to: "/calendar" });
  },
  head: () => pageHead("Choose a New Password", "Set a new password for your staff account.", true),
  component: () => <div className="page-gutter py-12"><div className="mx-auto max-w-md"><PasswordForm required /></div></div>,
});
