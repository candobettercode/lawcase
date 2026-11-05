import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { advocateDisplayName } from "@/lib/booking-choice";
import { AdvocatePhoto } from "./ConsultationSummary";

export type BookingLawyer = {
  id: string; name: string; designation: string; years_experience: number; photo_url: string | null;
};
export function BookingLawyerAssignment({ lawyer, lawyers, manual, busy, loading, error, available, onSelect }: {
  lawyer?: BookingLawyer; lawyers: BookingLawyer[]; manual: boolean; busy: boolean; loading: boolean;
  error?: string; available: boolean; onSelect: (id: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  async function select(id: string) {
    setSelecting(id);
    try { if (await onSelect(id)) setOpen(false); }
    finally { setSelecting(null); }
  }
  return <section aria-labelledby="your-lawyer-heading" className="min-w-0 border-b py-5">
    <h3 id="your-lawyer-heading" className="mb-3 font-sans text-base font-semibold">Your Lawyer</h3>
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4" aria-live="polite">
        {lawyer && <AdvocatePhoto name={lawyer.name} url={lawyer.photo_url} />}
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{manual && <Check className="size-3.5 text-status-confirmed" />}{manual ? "Selected" : "Automatically assigned"}</p>
          <p className="break-words text-base font-semibold">{lawyer ? advocateDisplayName(lawyer.name) : "Checking available lawyers…"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{available ? "Available for your selected appointment" : "This lawyer is no longer available. Please choose another lawyer."}</p>
        </div>
      </div>
      <Dialog open={open} onOpenChange={(next) => { if (!selecting) setOpen(next); }}>
        <DialogTrigger asChild><Button type="button" variant="outline" className="h-10 shrink-0 bg-card" disabled={busy}>Change</Button></DialogTrigger>
        <DialogContent className="max-h-[85svh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-md p-5 sm:p-6">
          <DialogHeader className="pr-6 text-left"><DialogTitle className="font-serif text-xl leading-relaxed tracking-normal">Choose a Lawyer</DialogTitle><DialogDescription>Select from the lawyers available for your appointment.</DialogDescription></DialogHeader>
          <div className="grid gap-3" aria-busy={loading || busy}>
            {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Checking availability…</p> : !lawyers.length ? <p role="status" className="py-4 text-sm text-muted-foreground">No lawyers are available for this time. Please go back and select another time.</p> : lawyers.map((item) => <article key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-card p-4">
              <div className="min-w-0"><h3 className="break-words font-sans text-base font-semibold">{advocateDisplayName(item.name)}</h3><p className="mt-1 text-sm text-muted-foreground">{item.designation} · {item.years_experience} {item.years_experience === 1 ? "year" : "years"} experience</p><p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-status-confirmed"><span className="size-1.5 rounded-full bg-status-confirmed" />Available</p></div>
              <Button type="button" variant={item.id === lawyer?.id ? "outline" : "default"} className="h-10 shrink-0" disabled={busy || !!selecting} aria-label={`Select ${advocateDisplayName(item.name)}`} onClick={() => void select(item.id)}>{selecting === item.id ? "Selecting…" : "Select"}</Button>
            </article>)}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </section>;
}