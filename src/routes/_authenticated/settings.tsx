import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsSidebar } from "@/components/settings/SettingsShell";
import { pageHead } from "@/lib/public-content";

export const Route = createFileRoute("/_authenticated/settings")({ head: () => pageHead("Practice Settings", "Configure Apex Legal Partners practice and booking settings.", true), component: Layout });

function Layout() {
  return <><div className="page-gutter grid gap-6 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
    <SettingsSidebar />
    <main className="min-w-0"><Outlet /></main>
  </div></>;
}
