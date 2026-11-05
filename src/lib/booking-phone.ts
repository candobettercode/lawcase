import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export const bookingCountries = getCountries().map((country) => ({
  country,
  name: countryNames.of(country) ?? country,
  callingCode: getCountryCallingCode(country),
})).sort((a, b) => a.name.localeCompare(b.name));

export type { CountryCode };

export function internationalBookingPhone(country: CountryCode, number: string) {
  return number.trim() ? `+${getCountryCallingCode(country)} ${number.trim()}` : "";
}

export function pastedBookingPhone(value: string) {
  if (!value.trim().startsWith("+")) return null;
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.country ? { country: parsed.country, number: parsed.nationalNumber.toString() } : null;
}