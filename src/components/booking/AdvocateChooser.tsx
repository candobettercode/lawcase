import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { advocateDisplayName } from "@/lib/booking-choice";
import { AdvocatePhoto } from "./ConsultationSummary";

type Advocate = { id: string; name: string; designation: string; years_experience: number; bio: string; photo_url: string | null };
export function AdvocateChooser({ advocates, selectedId, selectedName, loading, busy, error, onSelect }: {
  advocates: Advocate[]; selectedId: string | null; selectedName?: string; loading: boolean; busy: boolean;
  error?: string; onSelect: (id: string | null) => void;
}) {
  const selectionUnavailable = selectedId && !loading && !error && !advocates.some((a) => a.id === selectedId);
  return <section aria-labelledby="advocate-choice-heading" className="mb-8 border-t pt-6">
    <div className="mb-5 grid min-w-0 gap-3 @min-[560px]/booking:grid-cols-[minmax(0,1fr)_auto] @min-[560px]/booking:items-center">
      <h2 id="advocate-choice-heading" className="min-w-0 font-sans text-base font-semibold">Select Advocate <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
      <Button variant={selectedId ? "outline" : "secondary"} className="min-h-11 justify-self-start text-xs @min-[560px]/booking:justify-self-end" aria-pressed={!selectedId} disabled={busy} onClick={() => onSelect(null)}>{!selectedId && <Check className="size-4" />}Automatic assignment</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading ? <div className="grid gap-4 @min-[560px]/booking:grid-cols-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52" />)}</div> : <>
      {selectionUnavailable && <p role="alert" className="mb-4 border-l-2 border-destructive bg-card p-4 text-sm">{selectedName ? advocateDisplayName(selectedName) : "Your selected advocate"} is not available for this selection. Choose another date or time, another available advocate, or automatic assignment. We will not replace your selection.</p>}
      <div className="grid gap-4 @min-[560px]/booking:grid-cols-2">{advocates.map((a) => <article key={a.id} className={cn("flex min-w-0 flex-col rounded-md border bg-card p-5", a.id === selectedId && "border-primary ring-1 ring-primary")}>
        <div className="flex min-w-0 items-start gap-3"><AdvocatePhoto name={a.name} url={a.photo_url} /><div className="min-w-0"><h3 className="break-words font-sans text-base font-semibold">{advocateDisplayName(a.name)}</h3></div></div>
        {a.bio && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.bio}</p>}
        <div className="mt-auto pt-5"><Button className="min-h-11 w-full" variant={a.id === selectedId ? "default" : "outline"} aria-label={`${a.id === selectedId ? "Selected" : "Select"} ${advocateDisplayName(a.name)}`} aria-pressed={a.id === selectedId} disabled={busy} onClick={() => onSelect(a.id)}>{a.id === selectedId && <Check className="size-4" />}{a.id === selectedId ? "Selected" : "Select"}</Button></div>
      </article>)}</div>
      {!advocates.length && !selectionUnavailable && <p role="status" className="border-l-2 border-brand bg-brand-soft p-5 text-sm">No advocates are available for this selection. Please choose another date, time or consultation mode.</p>}
    </>}
  </section>;
}