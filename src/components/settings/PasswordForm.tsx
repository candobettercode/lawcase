import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSchema } from "@/lib/admin-schema";
import { changeOwnPassword, signInStaff } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export function PasswordForm({ required = false }: { required?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const change = useServerFn(changeOwnPassword);
  const login = useServerFn(signInStaff);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (pw !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      await change({ data: { password: pw } });
      const r = await login({ data: { identifier: u.user?.email ?? "", password: pw } });
      if (!r.ok) { toast.success("Password updated. Please sign in again."); await navigate({ to: "/auth" }); return; }
      const { error: sessionError } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
      if (sessionError) { await navigate({ to: "/auth" }); return; }
      await qc.invalidateQueries();
      setPw(""); setConfirm(""); toast.success("Password updated");
      if (required) await navigate({ to: "/calendar" });
    } catch (err) { setError((err as Error).message || "Could not update the password."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid max-w-md gap-5" noValidate>
    <KeyRound className="size-7 text-primary" />
    <div><h2 className="text-2xl">{required ? "Choose a new password" : "Change password"}</h2><p className="mt-2 text-sm text-muted-foreground">{required && "For security, set your own password before continuing. "}Use at least 10 characters with upper and lower case letters, a number and a symbol.</p></div>
    <div className="grid gap-2"><Label htmlFor="new-pw">New password</Label><Input id="new-pw" type="password" autoComplete="new-password" className="h-12" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="confirm-pw">Confirm new password</Label><Input id="confirm-pw" type="password" autoComplete="new-password" className="h-12" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="h-12" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
  </form>;
}