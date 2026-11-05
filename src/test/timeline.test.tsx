import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdvocateTimeline } from "@/components/calendar/AdvocateTimeline";
import { layoutTimeline } from "@/lib/timeline";

afterEach(cleanup);
const date = "2026-03-08", tz = "America/New_York";
const item = { key: "court", start: "2026-03-08T13:00:00Z", end: "2026-03-08T14:00:00Z", title: "Court hearing", sub: "Court", advocateIds: ["sarah", "david"], color: "var(--ev-court)", kind: "court" };
describe("Advocate timeline", () => {
  it("positions after DST change using local clock", () => {
    expect(layoutTimeline([item], date, tz)[0]?.startMinute).toBe(9 * 60);
    expect(layoutTimeline([item], date, "Europe/London")[0]?.startMinute).toBe(13 * 60);
  });
  it("assigns overlap lanes per collision group", () => {
    const result = layoutTimeline([item, { ...item, key: "overlap", start: "2026-03-08T13:30:00Z" }, { ...item, key: "later", start: "2026-03-08T15:00:00Z", end: "2026-03-08T16:00:00Z" }], date, tz);
    expect(result.map((x) => x.lanes)).toEqual([2, 2, 1]);
    expect(layoutTimeline([item], "2026-03-09", tz)).toHaveLength(0);
  });
  it("renders shared events in both advocate columns and prefills slots", () => {
    const onSlot = vi.fn(), onPick = vi.fn();
    render(<AdvocateTimeline advocates={[{ id: "sarah", name: "Sarah Jenkins", title: "Partner" }, { id: "david", name: "David Ross", title: "Partner" }]} entries={[item]} date={date} timezone={tz} onSlot={onSlot} onPick={onPick} />);
    expect(screen.getAllByRole("button", { name: /Court hearing,/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: `Book Sarah Jenkins at 10:30 on ${date}` }));
    expect(onSlot).toHaveBeenCalledWith("sarah", "10:30");
    fireEvent.click(screen.getAllByRole("button", { name: /Court hearing,/ })[0]);
    expect(onPick).toHaveBeenCalledWith("court");
  });
});