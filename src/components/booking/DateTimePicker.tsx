import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { calendarKeyTarget, dateKey, slotLabel } from "@/lib/booking-time";

export type DateTimePickerProps = {
  month: string; date: string; today: string; maxDate: string; availableDates: string[];
  slots: string[]; selectedSlot: string; zone: string; zones: string[]; clock: number;
  timeFormat: "12" | "24"; allowZoneChange: boolean; loadingMonth: boolean; loadingSlots: boolean;
  holding: boolean; nextDisabled?: boolean; error?: string; onMonth: (month: string) => void; onDate: (date: string) => void;
  onZone: (zone: string) => void; onFormat: (format: "12" | "24") => void; onSlot: (slot: string) => void; onNext: () => void;
};
export function DateTimePicker(p: DateTimePickerProps) {
  const month = startOfMonth(parseISO(p.month));
  const [focusDate, setFocusDate] = useState(p.date || p.today);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const slotsPanel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const available = new Set(p.availableDates);
  useEffect(() => { if (pendingFocus.current && !p.loadingMonth) { buttons.current.get(focusDate)?.focus(); pendingFocus.current = false; } }, [focusDate, p.month, p.loadingMonth]);
  useEffect(() => { if (p.date && window.matchMedia("(max-width: 767px)").matches) slotsPanel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }, [p.date]);
  const firstCell = startOfWeek(month, { weekStartsOn: 0 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(firstCell, i));
  function keyDown(event: React.KeyboardEvent, day: Date) {
    const next = calendarKeyTarget(day, event.key);
    if (next.getTime() === day.getTime()) return;
    event.preventDefault();
    const key = dateKey(next);
    if (key < dateKey(startOfMonth(parseISO(p.today))) || key > dateKey(endOfMonth(parseISO(p.maxDate)))) return;
    pendingFocus.current = true; setFocusDate(key);
    if (dateKey(startOfMonth(next)) !== p.month) p.onMonth(dateKey(startOfMonth(next)));
  }
  function selectDate(key: string) {
    p.onDate(key); setFocusDate(key);
    if (window.matchMedia("(max-width: 767px)").matches) slotsPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return <div className="booking-date-time grid min-w-0 gap-y-4 @min-[620px]/booking:grid-cols-[minmax(308px,1fr)_minmax(0,1fr)] @min-[620px]/booking:gap-x-6">
    <section aria-labelledby="date-time-heading" className="min-w-0">
      <h2 id="date-time-heading" className="font-sans text-base font-semibold">Select Date</h2>
      <div>
      <div className="my-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Previous month" title="Previous month" disabled={p.month <= dateKey(startOfMonth(parseISO(p.today)))} onClick={() => p.onMonth(dateKey(addMonths(month, -1)))}><ChevronLeft /></Button>
        <h3 className="text-center font-sans text-base font-medium" aria-live="polite">{format(month, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Next month" title="Next month" disabled={p.month >= dateKey(startOfMonth(parseISO(p.maxDate)))} onClick={() => p.onMonth(dateKey(addMonths(month, 1)))}><ChevronRight /></Button>
      </div>
      <div role="grid" aria-label={format(month, "MMMM yyyy")} aria-busy={p.loadingMonth} className="booking-calendar overflow-x-auto [&>div]:min-w-[308px]">
        <div role="row" className="grid grid-cols-7">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span role="columnheader" key={day} className="py-2 text-center text-xs text-muted-foreground">{day}</span>)}</div>
        {Array.from({ length: 6 }, (_, row) => <div role="row" key={row} className="grid grid-cols-7">{cells.slice(row * 7, row * 7 + 7).map((day) => {
          const key = dateKey(day); const inMonth = day.getMonth() === month.getMonth(); const enabled = available.has(key) && !p.loadingMonth; const selected = p.date === key;
          return <div role="gridcell" aria-selected={selected} key={key} className="grid min-w-0 place-items-center py-0.5">
            {!inMonth ? <span className="size-11" /> : p.loadingMonth ? <Skeleton className="size-11 rounded-full" /> : <Button ref={(el) => { if (el) buttons.current.set(key, el); else buttons.current.delete(key); }} variant="ghost" size="icon" tabIndex={focusDate === key || (dateKey(startOfMonth(parseISO(focusDate))) !== p.month && day.getDate() === 1) ? 0 : -1} aria-disabled={!enabled} aria-label={`${format(day, "EEEE, MMMM d, yyyy")}, ${enabled ? "available" : "unavailable"}${selected ? ", selected" : ""}`} onKeyDown={(e) => keyDown(e, day)} onClick={() => enabled && selectDate(key)} className={cn("relative size-11 rounded-full text-sm", enabled ? "bg-booking-available font-bold text-primary hover:bg-booking-available" : "cursor-default font-normal text-muted-foreground", selected && "bg-primary text-primary-foreground outline outline-2 outline-offset-2 outline-primary hover:bg-primary hover:text-primary-foreground")}>{day.getDate()}{key === p.today && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}</Button>}
          </div>;
        })}</div>)}
      </div>
      </div>
    </section>
    <section ref={slotsPanel} aria-labelledby="time-heading" className="min-w-0 scroll-mt-5 border-t pt-4 @min-[620px]/booking:border-l @min-[620px]/booking:border-t-0 @min-[620px]/booking:pl-6 @min-[620px]/booking:pt-0">
      <h2 id="time-heading" className="mb-2 font-sans text-base font-semibold">Available Time{p.date && <span className="mt-1 block font-normal text-sm text-muted-foreground"> {format(parseISO(p.date), "EEEE, MMMM d")}</span>}</h2>
      <p className="sr-only" role="status" aria-live="polite">{p.date && !p.loadingSlots ? `${p.slots.length} times available on ${format(parseISO(p.date), "EEEE, MMMM d")}` : ""}</p>
      <div className="grid max-h-[42vh] grid-cols-3 gap-2 overflow-y-auto pr-1 @min-[620px]/booking:grid-cols-2 @min-[820px]/booking:grid-cols-3">
        {p.loadingSlots ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-28" />) : !p.date ? <p className="text-sm text-muted-foreground">Select a date to see available times</p> : !p.slots.length ? <p className="text-sm text-muted-foreground">No times available on this date. Please choose another date.</p> : p.slots.map((slot) => <Button key={slot} variant={slot === p.selectedSlot ? "default" : "outline"} className={cn("h-12 w-full font-semibold", slot === p.selectedSlot ? "text-primary-foreground" : "border-primary/40 text-primary hover:border-primary")} aria-pressed={p.selectedSlot === slot} onClick={() => !p.holding && p.onSlot(slot)}>{slotLabel(slot, p.zone, "12")}</Button>)}
      </div>
      {p.error && <p role="alert" className="mt-4 text-sm text-destructive">{p.error}</p>}
    </section>
  </div>;
}
