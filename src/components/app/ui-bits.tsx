import type { EventKind, Status } from "@/lib/store";
import { cn } from "@/lib/utils";

export const statusVar: Record<Status, string> = {
  pending: "var(--status-pending)", confirmed: "var(--status-confirmed)", completed: "var(--status-completed)",
  "no-show": "var(--status-noshow)", cancelled: "var(--status-cancelled)",
};
export const toneVar = (n: number) => `var(--chart-${n})`;
export const eventVar: Record<EventKind, string> = {
  court: "var(--ev-court)", leave: "var(--ev-leave)", meeting: "var(--ev-meeting)", travel: "var(--ev-travel)", block: "var(--ev-leave)",
};
export const eventLabel: Record<EventKind, string> = { court: "Court hearing", leave: "Leave", meeting: "Internal meeting", travel: "Travel", block: "Personal block" };

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize", className)}
      style={{ borderColor: `color-mix(in oklab, ${statusVar[status]} 50%, transparent)`, background: `color-mix(in oklab, ${statusVar[status]} 14%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: statusVar[status] }} />
      {status}
    </span>
  );
}
