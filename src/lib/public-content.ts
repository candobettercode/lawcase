// Safe demonstration directory only. Never import the legacy private store here.
export const firmName = "Apex Legal Partners";
export const publicAdvocates = [
  { id: "sarah", name: "Sarah Jenkins", initials: "SJ", designation: "Senior Partner", specializations: ["Criminal Defense", "Constitutional Law"], languages: "English, Spanish", location: "New York · Washington, D.C." },
  { id: "david", name: "David Ross", initials: "DR", designation: "Partner", specializations: ["Corporate Litigation"], languages: "English", location: "New York" },
  { id: "priya", name: "Priya Sharma", initials: "PS", designation: "Associate Partner", specializations: ["Intellectual Property", "Technology Law"], languages: "English, Hindi", location: "New York · Washington, D.C." },
];
export const publicLocations = [
  { id: "downtown", name: "Downtown Chambers", city: "New York", address: "120 Broadway, Suite 3400, New York, NY 10271", type: "physical" },
  { id: "supreme", name: "Supreme Court Office", city: "Washington, D.C.", address: "1 First St NE (adjacent), Washington, DC 20543", type: "physical" },
  { id: "virtual", name: "Virtual Consultation", city: "Online", address: "", type: "virtual" },
];
export function pageHead(title: string, description: string, privatePage = false) {
  return { meta: [
    { title: `${title} — ${firmName}` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — ${firmName}` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    ...(privatePage ? [{ name: "robots", content: "noindex, nofollow" }] : []),
  ] };
}