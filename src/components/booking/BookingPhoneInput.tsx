import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bookingCountries, pastedBookingPhone, type CountryCode } from "@/lib/booking-phone";

export function BookingPhoneInput({ country, number, error, disabled, onCountry, onNumber }: {
  country: CountryCode; number: string; error?: string; disabled: boolean;
  onCountry: (country: CountryCode) => void; onNumber: (number: string) => void;
}) {
  const selected = bookingCountries.find((item) => item.country === country);
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor="phone">Mobile number *</Label>
    <div className="grid min-w-0 grid-cols-[116px_minmax(0,1fr)] gap-2">
      <Select value={country} disabled={disabled} onValueChange={(value) => {
        const next = bookingCountries.find((item) => item.country === value);
        if (next) onCountry(next.country);
      }}>
        <SelectTrigger id="phone-country" aria-label="Country code" className="h-12 min-w-0 bg-card shadow-none">
          <SelectValue>{selected ? `${selected.country} +${selected.callingCode}` : "Country"}</SelectValue>
        </SelectTrigger>
        <SelectContent>{bookingCountries.map((item) => <SelectItem key={item.country} value={item.country} className="min-h-11">{item.name} (+{item.callingCode})</SelectItem>)}</SelectContent>
      </Select>
      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Mobile number" className="h-12 min-w-0" maxLength={20} value={number} required aria-invalid={!!error} aria-describedby={error ? "phone-error" : undefined} disabled={disabled} onChange={(event) => {
        const pasted = pastedBookingPhone(event.target.value);
        if (pasted) { onCountry(pasted.country); onNumber(pasted.number); }
        else onNumber(event.target.value);
      }} />
    </div>
    {error && <p id="phone-error" role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}