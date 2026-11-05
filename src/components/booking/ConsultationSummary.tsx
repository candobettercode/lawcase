import { useState } from "react";
import { Clock, Phone, Video } from "lucide-react";
import { advocateDisplayName, consultationModeLabel, meetingInformation, type ConsultationMode } from "@/lib/booking-choice";

export type ConsultationInfo = {
  advocate?: { name: string; photo_url: string | null; bio: string };
  service: { name: string; description: string; duration_minutes: number; fee?: number | null };
  location: { name: string; kind: string; address?: string };
  mode?: ConsultationMode;
};
export function AdvocatePhoto({ name, url }: { name: string; url?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-serif text-lg text-primary">{url && failedUrl !== url ? <img src={url} alt={name} className="size-full object-cover" onError={() => setFailedUrl(url)} /> : name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>;
}
export function ConsultationSummary({ advocate, service, location, mode = location.kind === "virtual" ? "online" : "in_person" }: ConsultationInfo) {
  return <aside className="consultation-summary min-w-0 border-b p-5 md:p-7">
    <div className="flex min-w-0 items-center gap-4">
      <AdvocatePhoto name={advocate?.name ?? "Apex Legal"} url={advocate?.photo_url} />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{advocate ? advocateDisplayName(advocate.name) : "Automatic assignment"}</p><h2 className="mt-1 break-words text-lg leading-relaxed">{service.name}</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-3.5 shrink-0" />{service.duration_minutes} min · {consultationModeLabel(mode)}{mode === "in_person" && <> · {meetingInformation(mode, location)}</>}</p></div></div>
    </div>
    {mode !== "in_person" && <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">{mode === "online" ? <Video className="mt-0.5 size-3.5 shrink-0" /> : <Phone className="mt-0.5 size-3.5 shrink-0" />}{meetingInformation(mode, location)}</p>}
  </aside>;
}
