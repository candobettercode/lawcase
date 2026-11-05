import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { DateTimePicker, type DateTimePickerProps } from "@/components/booking/DateTimePicker";
import { calendarKeyTarget, dateKey, holdExpired, slotLabel } from "@/lib/booking-time";
import { zonedToUtc } from "@/lib/time";
afterEach(cleanup);
describe("date/time conversion", () => {
 it("handles spring DST in New York", () => { expect(zonedToUtc("2026-03-07", "09:00", "America/New_York")).toBe("2026-03-07T14:00:00.000Z"); expect(zonedToUtc("2026-03-08", "09:00", "America/New_York")).toBe("2026-03-08T13:00:00.000Z"); });
 it("disambiguates repeated autumn times with their UTC instant", () => { expect(slotLabel("2026-11-01T05:30:00Z", "America/New_York", "24")).toBe("01:30"); expect(slotLabel("2026-11-01T06:30:00Z", "America/New_York", "24")).toBe("01:30"); });
 it("expires at the exact hold deadline", () => { expect(holdExpired("2026-10-14T12:05:00Z", Date.parse("2026-10-14T12:04:59Z"))).toBe(false); expect(holdExpired("2026-10-14T12:05:00Z", Date.parse("2026-10-14T12:05:00Z"))).toBe(true); });
});
const props = (): DateTimePickerProps => ({ month: "2026-10-01", date: "", today: "2026-10-12", maxDate: "2026-11-12", availableDates: ["2026-10-14", "2026-10-16"], slots: [], selectedSlot: "", zone: "UTC", zones: ["UTC", "Asia/Kolkata"], clock: Date.parse("2026-10-12T12:00:00Z"), timeFormat: "12", allowZoneChange: true, loadingMonth: false, loadingSlots: false, holding: false, onMonth: vi.fn(), onDate: vi.fn(), onZone: vi.fn(), onFormat: vi.fn(), onSlot: vi.fn(), onNext: vi.fn() });
describe("calendar navigation", () => {
 it("moves a week with ArrowDown and a month with PageDown", () => { const day = new Date(2026, 9, 14); expect(dateKey(calendarKeyTarget(day, "ArrowDown"))).toBe("2026-10-21"); expect(dateKey(calendarKeyTarget(day, "PageDown"))).toBe("2026-11-14"); });
 it("moves focus using arrows and selects with a click/Enter activation", () => { const p = props(); render(<DateTimePicker {...p} />); const day = screen.getByRole("button", { name: "Wednesday, October 14, 2026, available" }); day.focus(); fireEvent.keyDown(day, { key: "ArrowRight" }); expect(screen.getByRole("button", { name: "Thursday, October 15, 2026, unavailable" })).toHaveFocus(); fireEvent.click(day); expect(p.onDate).toHaveBeenCalledWith("2026-10-14"); });
 it("prevents unavailable days selecting a slot date", () => { const p = props(); render(<DateTimePicker {...p} />); fireEvent.click(screen.getByRole("button", { name: "Thursday, October 15, 2026, unavailable" })); expect(p.onDate).not.toHaveBeenCalled(); });
});
