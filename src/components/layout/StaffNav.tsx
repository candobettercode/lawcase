import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import { CompactFirmBrand } from "@/components/branding/FirmBrand";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRoles } from "@/lib/staff";
import { sessionExpired, requiresPasswordChange } from "@/lib/login-policy";
import { firmName } from "@/lib/public-content";

const links = [
  { to: "/calendar", label: "Calendar" },
  { to: "/notifications", label: "Notifications" },
  { to: "/settings", label: "Settings" },
  { to: "/", label: "Public Booking" },
] as const;

export function StaffNav() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useMyProfile();
  const roles = useMyRoles();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const userName = profile.data?.full_name || profile.data?.username;
  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }, [qc, navigate]);
  // Forced password change and absolute session lifetime; the database also refuses data until the password is changed.
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    if (sessionExpired(p.last_login_at) || p.status !== "active" || p.is_deleted) void signOut();
    else if (roles.data && requiresPasswordChange(p.must_change_password, roles.data)) navigate({ to: "/change-password" });
  }, [profile.data, roles.data, navigate, signOut]);

  return <header className="border-b border-header-border bg-header text-header-foreground">
    <div className="page-gutter grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
      <Link to="/calendar" onClick={() => setOpen(false)} aria-label={firmName} className="flex min-w-0 items-center gap-3 justify-self-start">
        <CompactFirmBrand />
      </Link>
      <nav id="dashboard-navigation" aria-label="Staff navigation" onKeyDown={(e) => {
        if (e.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); }
      }} className={`${open ? "flex" : "hidden"} col-span-2 row-start-2 flex-col border-t border-header-border pb-3 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:pb-0 xl:gap-5`}>
        {links.map(({ to, label }) => <Link key={to} to={to} onClick={() => setOpen(false)}
          activeOptions={{ exact: to !== "/settings" }}
          className="flex min-h-11 items-center border-b-2 px-2 text-sm transition-colors hover:bg-header-hover hover:text-header-foreground"
          inactiveProps={{ className: "border-transparent text-header-muted" }}
          activeProps={{ className: "border-brand font-semibold text-header-foreground", "aria-current": "page" }}>{label}</Link>)}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-header-border pt-3 lg:hidden">
          {userName && <span className="flex min-w-0 items-center gap-2 text-sm"><UserRound className="size-4 shrink-0 text-brand" /><span className="break-words">{userName}</span></span>}
          <Button variant="ghost" className="h-11 text-header-foreground hover:bg-header-hover hover:text-header-foreground" disabled={signingOut} onClick={signOut}><LogOut />{signingOut ? "Signing out…" : "Sign out"}</Button>
        </div>
      </nav>
      <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-3 lg:col-start-3 xl:gap-4">
        {userName && <span title={userName} className="hidden min-w-0 items-center gap-2 text-sm lg:flex"><UserRound className="size-4 shrink-0 text-brand" /><span className="truncate">{userName}</span></span>}
        <Button variant="ghost" className="hidden h-11 shrink-0 text-header-foreground hover:bg-header-hover hover:text-header-foreground lg:inline-flex" disabled={signingOut} onClick={signOut}><LogOut />{signingOut ? "Signing out…" : "Sign out"}</Button>
        <Button ref={menuButton} variant="ghost" size="icon" className="size-11 shrink-0 text-header-foreground hover:bg-header-hover hover:text-header-foreground lg:hidden" aria-label={open ? "Close dashboard menu" : "Open dashboard menu"} aria-expanded={open} aria-controls="dashboard-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</Button>
      </div>
    </div>
  </header>;
}
