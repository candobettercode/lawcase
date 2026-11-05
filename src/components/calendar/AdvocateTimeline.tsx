import { CalendarDays, Car, Gavel, LockKeyhole, Palmtree, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { layoutTimeline } from "@/lib/timeline";
import { fmtTime, fromMin } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  key: string; start: string; end: string; title: string; sub: string;
  advocateIds: string[]; kind?: string; status?: string; color: string;
}
interface TimelineAdvocate { id: string; name: string; title: string }
const icons = { court: Gavel, travel: Car, leave: Palmtree, meeting: Users, block: LockKeyhole };
const START = 10 * 60, END = 22 * 60, SCALE = 1.6;
const formatClock12 = (minutes: number) => {
  const hour24 = Math.floor(minutes / 60) % 24;
  const hour = hour24 % 12 || 12;
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute} ${hour24 < 12 ? "AM" : "PM"}`;
};

export function AdvocateTimeline({ advocates, entries, date, timezone, onPick, onSlot }: {
  advocates: TimelineAdvocate[]; entries: TimelineEntry[]; date: string; timezone: string;
  onPick: (key: string) => void; onSlot?: (advocateId: string, time: string) => void;
}) {
  if (!advocates.length) return <p className="p-8 text-center text-muted-foreground">No advocates match these filters.</p>;
  return (
    <div className="max-h-[75vh] overflow-auto" role="region" aria-label="Multi-advocate timeline" tabIndex={0}>
      <div className="grid" style={{ gridTemplateColumns: `72px repeat(${advocates.length}, minmax(260px, 1fr))`, minWidth: 72 + advocates.length * 260 }}>
        <div className="sticky left-0 top-0 z-30 flex items-center justify-center border-b bg-card text-xs text-muted-foreground">Time</div>
        {advocates.map((adv) => <div key={adv.id} className="sticky top-0 z-20 grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 border-b border-l bg-card px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft text-sm font-semibold text-foreground">{adv.name.split(" ").map((n) => n[0]).join("")}</span>
          <div className="min-w-0"><div className="truncate text-sm font-semibold">{adv.name}</div><div className="truncate text-xs text-muted-foreground">{adv.title}</div></div>
        </div>)}
        <div className="sticky left-0 z-10 bg-card" style={{ height: (END - START) * SCALE }}>
          {Array.from({ length: 13 }, (_, i) => <span key={i} className="absolute inset-x-0 z-[21] bg-card px-1 pt-1 text-right text-xs tabular-nums text-muted-foreground" style={{ top: i * 60 * SCALE }}>{formatClock12(START + i * 60)}</span>)}
        </div>
        {advocates.map((adv) => <div key={adv.id} className="relative border-l" data-advocate={adv.id} style={{ height: (END - START) * SCALE }}>
          {Array.from({ length: 24 }, (_, i) => <Button key={i} variant="ghost" disabled={!onSlot} aria-label={`Book ${adv.name} at ${fromMin(START + i * 30)} on ${date}`} onClick={() => onSlot?.(adv.id, fromMin(START + i * 30))} className={cn("absolute inset-x-0 w-full justify-start rounded-none border-t px-3 text-xs text-muted-foreground", i % 2 ? "border-dashed border-border/60" : "border-border")} style={{ top: i * 30 * SCALE, height: 30 * SCALE }} />)}
          {layoutTimeline(entries.filter((e) => e.advocateIds.includes(adv.id)), date, timezone, START, END).map(({ item, startMinute, endMinute, lane, lanes }) => {
            const Icon = icons[item.kind as keyof typeof icons] ?? CalendarDays;
            const height = (endMinute - startMinute) * SCALE - 2;
            const cancelled = item.status === "cancelled" || item.status === "declined";
            const completed = item.status === "completed";
            return <Button key={item.key} variant="outline" onClick={() => onPick(item.key)} title={`${item.title}\n${fmtTime(item.start, timezone)} – ${fmtTime(item.end, timezone)}\n${item.sub}`} aria-label={`${item.title}, ${fmtTime(item.start, timezone)} to ${fmtTime(item.end, timezone)}${item.status ? `, ${item.status}` : ""}`} className={cn("absolute z-10 block overflow-hidden whitespace-normal rounded-md border-l-4 px-2 py-1 text-left text-foreground shadow-sm transition hover:z-20 hover:-translate-y-px hover:shadow-md", cancelled && "opacity-55", completed && "ring-1 ring-emerald-300")} style={{ top: (startMinute - START) * SCALE, height, left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, borderLeftColor: item.color, background: `color-mix(in oklab, ${item.color} 14%, var(--card))` }}>
              <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold"><Icon className="size-3 shrink-0" /><span className={`truncate ${cancelled ? "line-through" : ""}`}>{item.title}</span></div>
              {height >= 38 && <div className="truncate text-xs tabular-nums">{fmtTime(item.start, timezone)} – {fmtTime(item.end, timezone)}</div>}
              {height >= 60 && <div className="truncate text-xs text-muted-foreground">{item.sub}</div>}
              {item.status && height >= 80 && <div className="mt-1 truncate text-xs font-medium">{item.status === "pending" ? "Awaiting confirmation" : item.status === "no-show" ? "No show" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}</div>}
            </Button>;
          })}
        </div>)}
      </div>
    </div>
  );
}