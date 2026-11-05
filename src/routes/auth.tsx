import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";
import { signInStaff } from "@/lib/admin.functions";
import { FirmBrandPanel } from "@/components/branding/FirmBrand";

export const Route = createFileRoute("/auth")({ head: () => pageHead("Staff Access", "Staff-only access to the Masurkar Law Associates calendar and practice management.", true), component: Page });

function Page() {
  const navigate = useNavigate();
  const login = useServerFn(signInStaff);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await login({ data: { identifier: identifier.trim(), password } });
      if (!r.ok) { setError(r.message); return; }
      const { error: se } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
      if (se) { setError("Could not start your session. Please try again."); return; }
      navigate({ to: r.mustChangePassword ? "/change-password" : "/calendar" });
    } catch {
      setError("Could not sign in. Please try again.");
    } finally { setBusy(false); }
  }
  return (
    <div className="booking-page min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,17fr)_minmax(0,33fr)]">
      <FirmBrandPanel />
      <section aria-label="Staff sign in" className="min-w-0 lg:col-start-2">
        <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10 sm:px-8 lg:px-9 xl:px-12 2xl:px-14">
          <div className="w-full max-w-md">
            <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Welcome Back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to access your account and manage your appointments.</p>
            <form onSubmit={signIn} className="mt-8 grid gap-5" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="identifier">Username or email</Label>
                <Input id="identifier" autoComplete="username" autoCapitalize="none" className="h-12 bg-card" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 bg-card pr-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="h-12" disabled={busy || !identifier || !password}>{busy ? "Signing in…" : "Login"}</Button>
              <p className="text-xs text-muted-foreground">Staff accounts are created by the firm. There is no public registration. Repeated failed attempts lock sign-in for 15 minutes.</p>
            </form>
            <div className="mt-8 flex items-center justify-center">
              <Button asChild variant="outline" size="lg" className="border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground">
                <Link to="/">Book an appointment</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
