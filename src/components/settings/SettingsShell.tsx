import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const settingsSections = [
  ["firm", "Firm Information"], ["advocates", "Advocates"], ["staff", "Staff & Users"], ["locations", "Locations"],
  ["appointment-types", "Appointment Types"], ["availability", "Availability"], ["notifications", "Notifications"],
  ["booking", "Booking Settings"], ["general", "General Settings"],
] as const;
const dedicated = new Set(["advocates", "staff", "locations", "booking"]);

export function SettingsSidebar() {
  return <nav aria-label="Settings sections" className="lg:sticky lg:top-4 lg:self-start">
    <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {settingsSections.map(([slug, label]) => <li key={slug} className="shrink-0">
        {dedicated.has(slug)
          ? <Link to={`/settings/${slug}` as "/settings/advocates"} className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2" activeProps={{ className: "bg-muted font-semibold text-foreground" }}>{label}</Link>
          : <Link to="/settings/$section" params={{ section: slug }} className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2" activeProps={{ className: "bg-muted font-semibold text-foreground" }}>{label}</Link>}
      </li>)}
    </ul>
  </nav>;
}

export function SettingsHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Settings</p><h1 className="text-2xl">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
    {action}
  </div>;
}

export function AdminOnlyNotice({ what }: { what: string }) {
  return <div role="status" className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Only an Administrator can manage {what}.</div>;
}
