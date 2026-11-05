import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BookingFoundation } from "@/components/booking/BookingFoundation";

const mocks = vi.hoisted(() => {
  const start = new Date(Date.now() + 2 * 864e5); start.setUTCHours(12, 0, 0, 0);
  return {
    start: start.toISOString(), day: start.toISOString().slice(0, 10),
    reserve: vi.fn(), submit: vi.fn(), invalidate: vi.fn(),
    advocate: "22222222-0000-0000-0000-000000000001",
    otherAdvocate: "22222222-0000-0000-0000-000000000002",
    directory: {
      locations: [{ id: "11111111-0000-0000-0000-000000000002", kind: "physical", name: "Downtown Chambers", address: "", timezone: "UTC" }, { id: "11111111-0000-0000-0000-000000000001", kind: "virtual", name: "Virtual Consultation", address: "", timezone: "UTC" }],
      services: [{ id: "33333333-0000-0000-0000-000000000001", name: "Initial Consultation", duration_minutes: 30, fee: 150, description: "" }],
      advocates: [{ id: "22222222-0000-0000-0000-000000000001", name: "Available Advocate", designation: "Partner", years_experience: 8, bio: "", photo_url: null }, { id: "22222222-0000-0000-0000-000000000002", name: "Other Advocate", designation: "Associate Partner", years_experience: 2, bio: "", photo_url: null }, { id: "22222222-0000-0000-0000-000000000003", name: "Unavailable Advocate", designation: "Partner", years_experience: 12, bio: "", photo_url: null }],
      settings: { accept_online_bookings: true, time_format: "12", max_advance_days: 30, allow_timezone_change: true, contact_phone: "", contact_email: "" },
    },
  };
});
vi.mock("@tanstack/react-query", () => ({ useSuspenseQuery: () => ({ data: mocks.directory }), useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/booking/BookingPageLayout", () => ({ BookingPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/booking.functions", () => ({ confirmAppointment: mocks.submit, reserveAppointmentTime: mocks.reserve }));
vi.mock("@/hooks/use-appointment-contact", () => ({ useAppointmentContact: () => ({ data: { contact_phone: "", contact_email: "" } }) }));
vi.mock("@/hooks/use-booking-availability", () => ({
  bookingDirectoryOptions: {},
  useBookingAvailability: () => ({ monthQuery: { data: [{ date: mocks.day }], isFetching: false }, slotsQuery: { data: [mocks.start], isFetching: false } }),
  useAvailableBookingAdvocates: () => ({ data: [{ advocate_id: mocks.advocate }, { advocate_id: mocks.otherAdvocate }], isLoading: false, isFetching: false }),
}));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function proceed() {
  mocks.reserve.mockResolvedValue({ ok: true, token: "a".repeat(64), expiresAt: new Date(Date.now() + 5 * 60000).toISOString() });
  if (!screen.queryByRole("button", { name: /, available/ })) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  const day = await screen.findByRole("button", { name: /, available/ });
  fireEvent.click(day);
  fireEvent.click(screen.getByRole("button", { name: /12:00/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "Change" });
}
function fillDetails() {
  fireEvent.change(screen.getByLabelText("Full name *"), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Mobile number *"), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("checkbox"));
}
describe("two-step booking selection state", () => {
  it("reserves in-person at a physical location by default", async () => {
    render(<BookingFoundation />); await proceed();
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mode: "in_person", locationId: "11111111-0000-0000-0000-000000000002" }) }));
  });
  it("has no advocate selection and disables Continue until a time is chosen", () => {
    render(<BookingFoundation />);
    expect(screen.queryByRole("button", { name: /Select Adv/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
  it("keeps contact data when navigating back and forward", async () => {
    render(<BookingFoundation />); await proceed();
    fireEvent.change(screen.getByLabelText("Full name *"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Mobile number *"), { target: { value: "+91 98765 43210" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: "Change" });
    expect(screen.getByLabelText("Full name *")).toHaveValue("Jane Doe");
    expect(screen.getByLabelText("Mobile number *")).toHaveValue("9876543210");
    expect(screen.getByRole("combobox", { name: "Country code" })).toHaveAttribute("data-state", "closed");
    mocks.submit.mockResolvedValue({ ok: true, bookingRef: "APX-2026-000123", accessToken: "b".repeat(64), advocateId: mocks.advocate, fee: 150 });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: "+91 9876543210" }) })));
  });
  it("automatically reserves the displayed lawyer and submits without email or manual selection", async () => {
    mocks.submit.mockResolvedValue({ ok: true, bookingRef: "APX-2026-000123", accessToken: "b".repeat(64), advocateId: mocks.advocate, fee: 150 });
    render(<BookingFoundation />); await proceed();
    fireEvent.change(screen.getByLabelText("Full name *"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Mobile number *"), { target: { value: "+1 212 555 0123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    expect(mocks.reserve).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.advocate, startsAt: mocks.start, mode: "in_person", previousToken: "a".repeat(64) }) }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.advocate, email: "", name: "Jane Doe", phone: "+1 2125550123" }) })));
  });
  it("requires a full name before confirmation", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    fireEvent.change(screen.getByLabelText("Full name *"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeDisabled();
  });
  it("requires a mobile number before confirmation", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    fireEvent.change(screen.getByLabelText("Mobile number *"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeDisabled();
  });
  it("requires consent before confirmation", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeDisabled();
  });
  it("does not require manual lawyer selection or email to enable confirmation", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeEnabled();
    expect(mocks.reserve).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.advocate }) }));
  });
  it("preserves the automatic assignment when the modal is dismissed", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    mocks.submit.mockResolvedValue({ ok: true, bookingRef: "APX-2026-000123", accessToken: "b".repeat(64), advocateId: mocks.advocate, fee: 150 });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.advocate }) })));
    expect(mocks.reserve).toHaveBeenCalledTimes(2);
  });
  it("offers only available lawyers and binds a changed lawyer before submission", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.queryByRole("button", { name: "Select Adv Unavailable Advocate" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select Adv Other Advocate" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.reserve).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.otherAdvocate, startsAt: mocks.start, previousToken: "a".repeat(64) }) }));
    mocks.submit.mockResolvedValue({ ok: true, bookingRef: "APX-2026-000123", accessToken: "b".repeat(64), advocateId: mocks.otherAdvocate, fee: 150 });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.otherAdvocate, name: "Jane Doe", phone: "+91 9876543210" }) })));
  });
  it("keeps the previous lawyer and entered details when a change cannot be reserved", async () => {
    render(<BookingFoundation />); await proceed(); fillDetails();
    mocks.reserve.mockResolvedValueOnce({ ok: false, message: "This lawyer is no longer available." });
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Adv Other Advocate" }));
    await waitFor(() => expect(mocks.reserve).toHaveBeenCalledTimes(3));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    mocks.submit.mockResolvedValue({ ok: true, bookingRef: "APX-2026-000123", accessToken: "b".repeat(64), advocateId: mocks.advocate, fee: 150 });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ advocateId: mocks.advocate, name: "Jane Doe", phone: "+91 9876543210" }) })));
  });
});