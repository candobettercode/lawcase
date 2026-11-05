import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { can, errorText, statusLabel, useMyRoles } from "@/lib/staff";

/** Mirrors the database permission: Administrator, or Staff when the firm toggle allows it. */
export function useDirectoryAccess() {
  const roles = useMyRoles();
  const settings = useQuery({ queryKey: ["booking-settings"], queryFn: async () => (await supabase.from("booking_settings").select("*").eq("id", 1).single()).data });
  const r = roles.data ?? [];
  return { loading: roles.isLoading || settings.isLoading, isAdmin: r.includes("admin"), canManage: can.manageDirectory(r, !!settings.data?.staff_can_manage_directory) };
}

export function StatusBadge({ active, deleted }: { active: boolean; deleted?: boolean }) {
  const label = deleted ? "Deleted" : active ? "Active" : "Inactive";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${active && !deleted ? "border-status-confirmed text-foreground" : "border-border text-muted-foreground"}`}>
    <span aria-hidden className={`size-1.5 rounded-full ${active && !deleted ? "bg-status-confirmed" : "bg-muted-foreground"}`} />{label}
  </span>;
}

export function Initials({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return url
    ? <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border object-cover" style={{ width: size, height: size }} />
    : <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-foreground" style={{ width: size, height: size, fontSize: size / 2.6 }}>{initials}</span>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="grid place-items-center gap-4 rounded-md border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{children}{action}</div>;
}

export function ListSkeleton() {
  return <div className="grid gap-2" aria-busy="true" aria-label="Loading">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
}

export function usePaged<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  return { items: rows.slice(current * pageSize, current * pageSize + pageSize), page: current, pages, setPage, total: rows.length };
}

export function Pager({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (p: number) => void }) {
  if (total === 0) return null;
  return <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
    <span>{total} record{total === 1 ? "" : "s"}</span>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="size-11" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
      <span aria-live="polite">Page {page + 1} of {pages}</span>
      <Button variant="outline" size="icon" className="size-11" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
    </div>
  </div>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", destructive = true, onConfirm, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle>{description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}</AlertDialogHeader>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
        <AlertDialogAction className={`h-11 ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`} disabled={busy}
          onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy ? "Working…" : confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

/** Side drawer that asks before discarding unsaved changes. */
export function FormDrawer({ open, title, description, dirty, onClose, children }: { open: boolean; title: string; description?: string; dirty: boolean; onClose: () => void; children: ReactNode }) {
  return <Sheet open={open} onOpenChange={(o) => { if (!o && (!dirty || window.confirm("Discard unsaved changes?"))) onClose(); }}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader><SheetTitle className="font-serif text-xl">{title}</SheetTitle>{description && <SheetDescription>{description}</SheetDescription>}</SheetHeader>
      <div className="mt-6">{children}</div>
    </SheetContent>
  </Sheet>;
}

export type FutureAppointment = { id: string; booking_ref: string; client_name: string; starts_at: string; status: string; advocate_id: string; location_id: string };

export function useFutureAppointments(filter: { advocateId?: string; locationId?: string } | null) {
  return useQuery({
    queryKey: ["future-appointments", filter],
    enabled: !!filter,
    queryFn: async () => {
      let q = supabase.from("appointments").select("id,booking_ref,client_name,starts_at,status,advocate_id,location_id").gt("starts_at", new Date().toISOString()).in("status", ["awaiting_confirmation", "confirmed"]).order("starts_at");
      if (filter?.advocateId) q = q.eq("advocate_id", filter.advocateId);
      if (filter?.locationId) q = q.eq("location_id", filter.locationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FutureAppointment[];
    },
  });
}

/** Lists affected future appointments with Reassign (to an eligible advocate) and Cancel-with-notification actions. */
export function FutureAppointmentsPanel({ rows, advocates, excludeAdvocate, onChanged }: { rows: FutureAppointment[]; advocates: { id: string; name: string; active: boolean }[]; excludeAdvocate?: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Record<string, string>>({});
  const choices = useMemo(() => advocates.filter((a) => a.active && a.id !== excludeAdvocate), [advocates, excludeAdvocate]);
  async function act(id: string, action: "reassign" | "cancel") {
    const { error } = await supabase.rpc("admin_resolve_appointment", { _id: id, _action: action, _target: action === "reassign" ? target[id] : (null as unknown as string) });
    if (error) return toast.error(errorText(error));
    toast.success(action === "cancel" ? "Appointment cancelled; staff and advocate notified" : "Appointment reassigned");
    await qc.invalidateQueries({ queryKey: ["future-appointments"] });
    await qc.invalidateQueries({ queryKey: ["staff-calendar"] });
    onChanged();
  }
  if (!rows.length) return <p className="text-sm text-muted-foreground">No upcoming appointments are affected.</p>;
  return <ul className="grid max-h-80 gap-2 overflow-y-auto">
    {rows.map((r) => <li key={r.id} className="grid gap-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{r.booking_ref}</span><span className="text-muted-foreground">{statusLabel[r.status]}</span></div>
      <div>{r.client_name} · {new Date(r.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`re-${r.id}`}>Reassign {r.booking_ref} to</label>
        <select id={`re-${r.id}`} className="h-11 min-w-0 flex-1 rounded-md border bg-card px-2" value={target[r.id] ?? ""} onChange={(e) => setTarget({ ...target, [r.id]: e.target.value })}>
          <option value="">Choose advocate…</option>{choices.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Button variant="outline" className="h-11" disabled={!target[r.id]} onClick={() => act(r.id, "reassign")}>Reassign</Button>
        <Button variant="outline" className="h-11 text-destructive" onClick={() => act(r.id, "cancel")}>Cancel</Button>
      </div>
    </li>)}
  </ul>;
}

export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return <div className="grid gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{label}{required && <span aria-hidden className="text-destructive"> *</span>}{required && <span className="sr-only"> (required)</span>}</label>
    {children}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

export const selectClass = "h-11 w-full rounded-md border bg-card px-3 text-sm";
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
