export const consultationModes = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "phone", label: "Phone" },
] as const;
export type ConsultationMode = (typeof consultationModes)[number]["value"];
// Public choices are intentionally narrower than stored/historical appointment modes.
export const publicConsultationModes = [consultationModes[1], consultationModes[0]] as const;
export const defaultPublicConsultationMode = "in_person" as const satisfies ConsultationMode;
export function consultationModeLabel(mode: string) {
  return consultationModes.find((item) => item.value === mode)?.label ?? mode;
}
export function advocateDisplayName(name: string) {
  return `Adv ${name.replace(/^adv\.?\s+/i, "").trim()}`;
}
export function consultationFeeLabel(fee: number | null | undefined) {
  return fee == null ? "Please contact the firm for the fee" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(fee);
}
export function meetingInformation(mode: string, location: { name: string; address?: string }) {
  if (mode === "online") return "Online meeting details will be provided by the firm upon confirmation.";
  if (mode === "phone") return "The firm will call the mobile number you provide upon confirmation.";
  return `${location.name}${location.address ? ` — ${location.address}` : ""}`;
}
export function locationsForMode<T extends { kind: string }>(locations: T[], mode: ConsultationMode): T[] {
  if (mode === "in_person") return locations.filter((location) => location.kind === "physical");
  const virtual = locations.filter((location) => location.kind === "virtual");
  return mode === "online" || virtual.length ? virtual : locations;
}