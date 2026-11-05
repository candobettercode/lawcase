import { describe, expect, it } from "vitest";
import { checkConflicts, type State, type EventKind } from "@/lib/store";

const proposal = { advocateId: "a", locationId: "ny", start: "2026-10-07T14:00:00Z", end: "2026-10-07T14:30:00Z" };
const state: State = {
  tenant: { id: "t", name: "Test", slug: "test" }, currentUserId: "u",
  advocates: [{ id: "a", tenantId: "t", name: "Advocate", email: "", title: "Partner", specializations: [], languages: [], fee: 0, bufferBefore: 15, bufferAfter: 15, schedule: [{ locationId: "ny", dow: 3, start: "09:00", end: "17:00" }] }],
  locations: [{ id: "ny", tenantId: "t", name: "New York", address: "", tz: "America/New_York", hours: {}, holidays: [] }],
  rooms: [], users: [], clients: [], services: [], appointments: [], events: [], notifications: [], audit: [],
};
describe("Timeline booking conflicts", () => {
  it.each(["court", "travel", "leave", "meeting", "block"] as EventKind[])("detects %s even at another location", (kind) => {
    expect(checkConflicts({ ...state, events: [{ id: "event", tenantId: "t", kind, title: "Unavailable", advocateIds: ["a"], locationId: "other", start: proposal.start, end: proposal.end }] }, proposal)).toHaveLength(1);
  });
  it("detects appointments at another location and frees cancellations", () => {
    const appointment = { id: "existing", tenantId: "t", serviceId: "s", advocateId: "a", clientId: "c", locationId: "other", start: proposal.start, end: proposal.end, mode: "phone" as const, status: "confirmed" as const, opposingParty: "", intake: "", createdBy: "u" };
    expect(checkConflicts({ ...state, appointments: [appointment] }, proposal)[0]?.level).toBe("error");
    expect(checkConflicts({ ...state, appointments: [{ ...appointment, status: "cancelled" }] }, proposal)).toHaveLength(0);
  });
});