import { useEffect, useRef, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { contactSchema } from "@/lib/booking-schema";
import { confirmAppointment, reserveAppointmentTime } from "@/lib/booking.functions";
import { bookingDirectoryOptions, useAvailableBookingAdvocates, useBookingAvailability } from "@/hooks/use-booking-availability";
import { defaultPublicConsultationMode, publicConsultationModes, locationsForMode, type ConsultationMode } from "@/lib/booking-choice";
import { internationalBookingPhone, type CountryCode } from "@/lib/booking-phone";
import { DEFAULT_TIME_ZONE, shiftDate, todayIn, tzParts } from "@/lib/time";
import { dateKey, holdExpired, monthDate } from "@/lib/booking-time";
import { cn } from "@/lib/utils";
import { BookingAppointmentSummary } from "./BookingAppointmentSummary";
import { BookingLawyerAssignment } from "./BookingLawyerAssignment";
import { DateTimePicker } from "./DateTimePicker";
import { AppointmentConfirmation } from "./AppointmentConfirmation";
import { BookingPageLayout } from "./BookingPageLayout";
import { BookingPhoneInput } from "./BookingPhoneInput";

const steps = ["Choose Appointment", "Your Details"];
type Hold = { token: string; expiresAt: string; startsAt: string; advocateId: string | null };
export function BookingFoundation() {
  const { data: d } = useSuspenseQuery(bookingDirectoryOptions);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [startedAt] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  const [zone, setZone] = useState(DEFAULT_TIME_ZONE);
  const [zones, setZones] = useState([DEFAULT_TIME_ZONE]);
  const [timeFormat, setTimeFormat] = useState<"12" | "24">(d.settings?.time_format === "24" ? "24" : "12");
  const [month, setMonth] = useState(dateKey(monthDate(todayIn(DEFAULT_TIME_ZONE))));
  const [mode, setMode] = useState<ConsultationMode>(defaultPublicConsultationMode);
  const initialLocations = locationsForMode(d.locations, defaultPublicConsultationMode);
  const [locationId, setLocationId] = useState(initialLocations[0]?.id ?? "");
  const [choice, setChoice] = useState<string | null>(null);
  const [manualLawyer, setManualLawyer] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("IN");
  const [form, setForm] = useState({ date: "", startsAt: "", name: "", phone: "", email: "", consent: false, website: "" });
  const [hold, setHold] = useState<Hold | null>(null);
  // Invalidated holds are retained privately so a new selection can release them atomically.
  const previousToken = useRef<string | undefined>(undefined);
  const requestVersion = useRef(0);
  const reservationPending = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ bookingRef: string; accessToken: string; advocateId: string; fee: number | null } | null>(null);
  const submit = useServerFn(confirmAppointment);
  const reserve = useServerFn(reserveAppointmentTime);
  const service = d.services[0];
  const location = d.locations.find((l) => l.id === locationId);
  const selectedAdvocate = d.advocates.find((a) => a.id === choice);
  const modeLocations = locationsForMode(d.locations, mode);
  const today = todayIn(zone);
  const maxDate = shiftDate(today, (d.settings?.max_advance_days ?? 30) + 1);
  const context = { locationId, serviceId: service?.id ?? "", advocateId: choice, zone };
  const enabled = step === 0 && !!location && !!service;
  const availability = useBookingAvailability(context, month, form.date, enabled);
  const options = useAvailableBookingAdvocates(context, month, form.date, form.startsAt, hold?.token, step < 2 && !!location && !!service && !!form.startsAt);
  const availableAdvocates = d.advocates.filter((a) => options.data?.some((row) => row.advocate_id === a.id));
  const selectionAvailable = !choice || availableAdvocates.some((a) => a.id === choice);
  const selectionReady = !!hold && !!form.startsAt && availableAdvocates.length > 0 && selectionAvailable && !holding && !options.isFetching && !options.error;
  const contactValid = contactSchema.safeParse({ ...form, phone: internationalBookingPhone(phoneCountry, form.phone) }).success;
  const confirmReady = contactValid && form.consent && !!choice && !!hold && hold.advocateId === choice && selectionAvailable && !holding && !options.isLoading && !options.error && !holdExpired(hold.expiresAt, clock);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const detailsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const browserZones = Intl.supportedValuesOf("timeZone");
    setZones([...new Set([DEFAULT_TIME_ZONE, ...browserZones])]);
    setZone(DEFAULT_TIME_ZONE); setMonth(dateKey(monthDate(todayIn(DEFAULT_TIME_ZONE))));
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { if (step === 1) detailsHeading.current?.focus(); }, [step]);
  useEffect(() => {
    if (hold && !holding && !result && holdExpired(hold.expiresAt, clock)) {
      setHold(null); set("startsAt", ""); setErrors({ time: "Your time hold has expired. Please select a time again." });
      setStep(0); refreshAvailability();
    }
  }, [clock, hold, result, holding]);
  function refreshAvailability() {
    void queryClient.invalidateQueries({ queryKey: ["booking-month"] });
    void queryClient.invalidateQueries({ queryKey: ["booking-day"] });
    void queryClient.invalidateQueries({ queryKey: ["booking-advocate-options"] });
  }
  function invalidateTime() {
    requestVersion.current += 1;
    if (hold) previousToken.current = hold.token;
    setHold(null); set("startsAt", "");
    setChoice(null); setManualLawyer(false);
  }
  function changeMode(next: ConsultationMode) {
    if (reservationPending.current) return;
    invalidateTime(); setMode(next); set("date", ""); setErrors({});
    setLocationId(locationsForMode(d.locations, next)[0]?.id ?? "");
  }
  async function selectSlot(startsAt: string, advocateChoice = choice, preserveOnFailure = false): Promise<boolean> {
    if (!service || !location || reservationPending.current) return false;
    reservationPending.current = true;
    const version = ++requestVersion.current;
    setHolding(true); setErrors({});
    try {
      const r = await reserve({ data: { locationId, serviceId: service.id, advocateId: advocateChoice, startsAt, mode, previousToken: hold?.token ?? previousToken.current, website: form.website, startedAt } });
      if (version !== requestVersion.current) { if (r.ok) previousToken.current = r.token; return false; }
      if (r.ok) { previousToken.current = r.token; setHold({ token: r.token, expiresAt: r.expiresAt, startsAt, advocateId: advocateChoice }); set("startsAt", startsAt); return true; }
      if (preserveOnFailure) setErrors({ lawyer: r.message });
      else { invalidateTime(); setErrors({ time: r.message }); }
      refreshAvailability(); return false;
    } catch {
      if (version === requestVersion.current) {
        if (preserveOnFailure) setErrors({ lawyer: "That lawyer couldn't be reserved. Please try again." });
        else { invalidateTime(); setErrors({ time: "That time couldn't be reserved. Please try again." }); }
        refreshAvailability();
      }
      return false;
    } finally { reservationPending.current = false; setHolding(false); }
  }
  async function enterDetails() {
    if (!selectionReady) return;
    if (choice && hold?.advocateId === choice) { setStep(1); return; }
    // Bind the automatically chosen lawyer before showing a name, so confirmation
    // cannot silently replace the lawyer the visitor sees.
    const automatic = [...availableAdvocates].sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!automatic) return;
    if (await selectSlot(form.startsAt, automatic.id)) { setChoice(automatic.id); setManualLawyer(false); setStep(1); }
  }
  async function chooseAdvocate(id: string): Promise<boolean> {
    if (reservationPending.current || submitting || !availableAdvocates.some((a) => a.id === id)) return false;
    if (id === choice) { setManualLawyer(true); return true; }
    if (await selectSlot(form.startsAt, id, true)) { setChoice(id); setManualLawyer(true); return true; }
    return false;
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || holding) return;
    const phone = internationalBookingPhone(phoneCountry, form.phone);
    const parsed = contactSchema.safeParse({ ...form, phone });
    const e: Record<string, string> = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    if (e.phone) e.phone = "Enter a valid mobile number for the selected country code.";
    if (!form.consent) e.consent = "Please accept the consent statement.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!choice || !selectionAvailable || options.error || hold?.advocateId !== choice) { setErrors({ lawyer: "Please choose an available lawyer for your appointment." }); return; }
    if (!hold || holdExpired(hold.expiresAt, Date.now()) || !service || !location || !form.startsAt) { setErrors({ time: "Please select a time again." }); setStep(0); return; }
    setSubmitting(true);
    try {
      const r = await submit({ data: { name: form.name, phone, email: form.email, locationId, serviceId: service.id, advocateId: choice, startsAt: form.startsAt, mode, consent: true, website: form.website, startedAt, holdToken: hold.token } });
      if (r.ok) { setResult(r); setStep(2); }
      else if (r.code === "SLOT_UNAVAILABLE") { invalidateTime(); setStep(0); setErrors({ time: r.message }); refreshAvailability(); }
      else setErrors({ submit: r.message });
    } catch { setErrors({ submit: "We couldn't submit your request. Please check your details and try again." }); }
    finally { setSubmitting(false); }
  }
  const heading = <h1 className="text-[clamp(18px,4.8vw,26px)] leading-snug sm:text-3xl md:text-4xl">Book an Appointment</h1>;
  const intro = <p className={cn("max-w-2xl text-sm leading-relaxed text-muted-foreground", step === 1 ? "mb-4" : "mb-8")}>Find an available advocate and schedule a consultation at a convenient date, time, and location.</p>;
  if (!d.settings?.accept_online_bookings) return <BookingPageLayout heading={heading}>{intro}<Notice>Online booking is temporarily unavailable. Please contact us.</Notice><p className="mt-4">{d.settings?.contact_phone} · {d.settings?.contact_email}</p><Link to="/contact" className="underline">Contact details</Link></BookingPageLayout>;
  if (!d.locations.length || !service || !d.advocates.length) return <BookingPageLayout heading={heading}>{intro}<Notice>Online booking is not configured yet. Please contact us to arrange a consultation.</Notice></BookingPageLayout>;
  const validHeldSlot = hold && form.startsAt === hold.startsAt && !holdExpired(hold.expiresAt, clock) ? form.startsAt : "";
  const heldDate = validHeldSlot ? tzParts(validHeldSlot, zone).date : "";
  const assigned = d.advocates.find((a) => a.id === result?.advocateId);
  return <BookingPageLayout heading={heading}>{intro}
    {step < 2 && <ol aria-label="Booking progress" className={cn("grid grid-cols-2 gap-3 border-b", step === 1 ? "mb-5 pb-4" : "mb-8 pb-6")}>{steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className="flex min-w-0 items-center gap-3 text-sm"><span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs", i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary bg-booking-available text-primary" : "text-muted-foreground")}>{i < step ? <Check className="size-4" /> : String(i + 1).padStart(2, "0")}</span><span className={i === step ? "font-semibold" : "text-muted-foreground"}>{label}</span></li>)}</ol>}
    {step === 0 && <>
      <section className="mb-8" aria-labelledby="mode-heading"><h2 id="mode-heading" className="mb-2 font-sans text-base font-semibold">Consultation Mode</h2><div className="grid items-end gap-5 @min-[650px]/booking:grid-cols-2"><div className="grid min-w-0 gap-2"><span aria-hidden="true" className="hidden text-xs font-medium select-none @min-[650px]/booking:block">&nbsp;</span><div className="grid grid-cols-2 gap-3" role="group" aria-label="Consultation mode">{publicConsultationModes.map((item) => <Button key={item.value} variant="outline" className={cn("h-12 min-w-0 gap-2 bg-card", mode === item.value && "border-primary bg-booking-available text-primary ring-1 ring-primary")} aria-pressed={mode === item.value} disabled={holding} onClick={() => changeMode(item.value)}>{item.value === "online" ? <Video /> : <MapPin />}{item.label}{mode === item.value && <Check className="ml-auto size-3.5" />}</Button>)}</div></div>
        {mode === "in_person" && modeLocations.length > 0 && <div className="grid min-w-0 gap-2"><Label htmlFor="booking-location" className="text-xs text-muted-foreground">Location</Label><select id="booking-location" className="h-12 w-full min-w-0 rounded-md border bg-card px-3 text-sm" value={locationId} disabled={holding} onChange={(e) => { invalidateTime(); setLocationId(e.target.value); set("date", ""); setErrors({}); }}>{modeLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
        </div>
      </section>
      {!location ? <Notice>This consultation mode is not currently configured. Please choose another mode or contact us.</Notice> : <>
        <div className="min-w-0">
          <DateTimePicker month={month} date={form.date} today={today} maxDate={maxDate} availableDates={[...new Set([...(availability.monthQuery.data?.map((row) => row.date) ?? []), ...(heldDate ? [heldDate] : [])])]} slots={[...new Set([...(availability.slotsQuery.data ?? []), ...(validHeldSlot && heldDate === form.date ? [validHeldSlot] : [])])].sort()} selectedSlot={form.startsAt} zone={zone} zones={zones} clock={clock} timeFormat={timeFormat} allowZoneChange={d.settings.allow_timezone_change} loadingMonth={availability.monthQuery.isLoading} loadingSlots={availability.slotsQuery.isLoading} holding={holding} nextDisabled={!selectionReady} error={errors.time || (availability.monthQuery.error || availability.slotsQuery.error ? "Availability couldn't be loaded. Please try another date." : undefined)} onMonth={(next) => { if (!reservationPending.current) setMonth(next); }} onDate={(date) => { if (reservationPending.current) return; invalidateTime(); set("date", date); setErrors({}); }} onZone={(next) => { if (reservationPending.current) return; setZone(next); setMonth(dateKey(monthDate(form.date || todayIn(next)))); if (form.startsAt) set("date", tzParts(form.startsAt, next).date); }} onFormat={setTimeFormat} onSlot={selectSlot} onNext={() => void enterDetails()} />
        </div>
        <div className="mt-4 flex justify-center border-t pt-3"><Button className="h-12 w-1/2 text-base" disabled={!selectionReady} onClick={() => void enterDetails()}>Continue <ArrowRight /></Button></div>
      </>}
    </>}
    {step === 1 && location && <section className="min-w-0"><h2 ref={detailsHeading} tabIndex={-1} className="mb-4 text-2xl outline-none">Your Details</h2>
      <BookingAppointmentSummary startsAt={form.startsAt} zone={zone} mode={mode} />
      <BookingLawyerAssignment lawyer={selectedAdvocate} lawyers={availableAdvocates} manual={manualLawyer} busy={holding || submitting} loading={options.isLoading} available={selectionAvailable} error={errors.lawyer || (options.error ? "Lawyer availability couldn't be checked. Please try again." : undefined)} onSelect={chooseAdvocate} />
      <form onSubmit={confirm} noValidate className="pt-5"><h3 className="mb-4 font-sans text-base font-semibold">Your Details</h3>
      <div className="grid gap-5 @min-[560px]/booking:grid-cols-2">
        <div className="grid gap-2 @min-[560px]/booking:col-span-2"><Label htmlFor="name">Full name *</Label><Input id="name" type="text" autoComplete="name" placeholder="Enter your full name" className="h-12 bg-card" maxLength={100} value={form.name} required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} disabled={submitting} onChange={(e) => set("name", e.target.value)} />{errors.name && <p id="name-error" role="alert" className="text-sm text-destructive">{errors.name}</p>}</div>
        <BookingPhoneInput country={phoneCountry} number={form.phone} error={errors.phone} disabled={submitting} onCountry={setPhoneCountry} onNumber={(number) => set("phone", number)} />
        <div className="grid min-w-0 gap-2"><Label htmlFor="email">Email address <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="email" type="email" autoComplete="email" placeholder="Enter your email address" className="h-12 bg-card" maxLength={255} value={form.email} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} disabled={submitting} onChange={(e) => set("email", e.target.value)} />{errors.email && <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email}</p>}</div>
      </div>
      <div className="mt-5 flex items-start gap-3"><Checkbox id="consent" className="mt-1 shrink-0" checked={form.consent} disabled={submitting} aria-invalid={!!errors.consent} onCheckedChange={(value) => set("consent", value === true)} /><Label htmlFor="consent" className="text-sm font-normal leading-relaxed">I agree that Apex Legal Partners may contact me regarding this appointment request.</Label></div>{errors.consent && <p role="alert" className="mt-3 text-sm text-destructive">{errors.consent}</p>}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
      {errors.submit && <p role="alert" className="mt-5 text-sm text-destructive">{errors.submit}</p>}<div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4"><Button variant="outline" className="h-12 bg-card" disabled={submitting || holding} type="button" onClick={() => setStep(0)}><ArrowLeft />Back</Button><Button className="h-12" disabled={submitting || !confirmReady} type="submit">{submitting ? "Submitting…" : "Confirm Appointment"}<ArrowRight /></Button></div>
    </form></section>}
    {step === 2 && result && location && <AppointmentConfirmation appointment={{ ...result, clientName: form.name, advocateName: assigned?.name ?? "Assigned advocate", advocatePhoto: assigned?.photo_url, mode, startsAt: form.startsAt, zone, location }} />}
  </BookingPageLayout>;
}
function Notice({ children }: { children: React.ReactNode }) { return <p role="status" className="border-l-2 border-brand bg-brand-soft p-5 text-sm">{children}</p>; }
