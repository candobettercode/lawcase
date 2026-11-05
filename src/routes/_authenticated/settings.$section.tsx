import { createFileRoute, notFound } from "@tanstack/react-router";
import { settingsSections, SettingsHeader } from "@/components/settings/SettingsShell";
import { pageHead } from "@/lib/public-content";
import { PasswordForm } from "@/components/settings/PasswordForm";

export const Route = createFileRoute("/_authenticated/settings/$section")({
  beforeLoad: ({ params }) => { if (!settingsSections.some(([s]) => s === params.section)) throw notFound(); },
  head: ({ params }) => pageHead(`${settingsSections.find(([s]) => s === params.section)?.[1] ?? "Settings"} Settings`, "Firm settings section.", true),
  component: Page,
});

function Page() {
  const { section } = Route.useParams();
  const label = settingsSections.find(([s]) => s === section)?.[1] ?? "Settings";
  if (section === "general") return <><SettingsHeader title={label} /><PasswordForm /></>;
  return <><SettingsHeader title={label} /><div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">This section is planned for a later release. Advocates, Staff & Users, Locations and Booking Settings are available now.</div></>;
}
