# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Online booking & demo staff login

- Public booking at `/` reads locations, services, advocates, working hours, leave and bookings from the database. Requests are saved as **Awaiting Confirmation** with a Booking ID (`APX-YYYY-NNNNNN`) and a private link to view the appointment.
- Turn bookings on/off in **Settings → Booking Settings → Accept Online Bookings** (Admin and Staff only).
- Email/SMS messages use a stub provider that logs to the server console (`src/lib/notifications.server.ts`); plug a real provider in via `setNotificationProvider`.
- Limits: 5 booking requests per hour per network address, plus a hidden honeypot field and minimum fill time. These are app-level limits, not full bot/DDoS protection.

### Demo staff account

> **Demo credentials for testing only. Change or delete before going live.**

- Email: `staff@apexlegal.test` · Password: `Staff@12345` · Role: Staff
- Create it (safe to re-run, refuses in production): `APP_ENV=development bun ./scripts/seed-demo-staff.ts`
- Sample locations, advocates, services and weekly hours come from the database migration.

### Tests

`bunx vitest run` — includes booking submission, double-booking rejection, the booking-off switch and staff permissions (database tests skip without backend credentials).

## Date & time booking layout

- Two steps followed by confirmation: **Choose Appointment** (Online / In-person / Phone, optional advocate, date/time together) → **Your Details** (required name/mobile, optional email, fee summary and submission) → confirmation. No practice-area, service-category, opposing-party or matter-description questions.
- The first active service in display order supplies duration and fee (currently Initial Consultation); fee is displayed without a currency because none is configured. Online and Phone use the virtual location's availability; Phone falls back to an active office if no virtual location exists. In-person retains the physical office choice.
- `AdvocateChooser.tsx` filters cards against month/date/instant availability, shows Select/Selected, and retains explicit selection when mode/date/time changes. The client must choose a replacement or automatic assignment if that advocate becomes unavailable.
- `AppointmentConfirmation.tsx`, the private appointment page, and `booking-choice.ts` share mode, fee, meeting and change information. The existing contact details are used for change/cancellation requests; no cancellation terms or meeting links are invented.
- `DateTimePicker.tsx` and `ConsultationSummary.tsx` are reusable presentation components; `use-booking-availability.ts` contains directory and monthly/day queries. `booking-time.ts` centralizes display/navigation helpers.
- Migration `drizzle/migrations/0001_monthly_booking_availability_and_holds.sql` adds month/day RPCs, hashed temporary holds, transactional hold consumption, and appointment-write guards. Hold expiry is enforced on every read/write; expired rows are pruned when that advocate receives another hold.
- Booking Settings retains default 12/24-hour display, visitor time-zone changes and hold duration. Automatic assignment is always optional in the new flow (the legacy first-available visibility switch no longer requires explicit selection). Availability respects working hours, leave, blocks, buffers, notice/window and configured location holidays.
- `drizzle/migrations/0005_two_step_consultation_booking.sql` adds service-only mode/intent-bound capacity holds, final transactional advocate assignment, fee snapshots, optional-email validation, safe advocate-option queries and extended private-token details. Legacy booking functions remain compatible; empty email is stored as an empty string without fabricating an address. Confirmation is available on screen via the reference and private link; email/SMS remains a stub and is not delivered.
- Holds are protected by a separate 60-selection/hour network-address limit and basic bot checks; they do not replace production CAPTCHA or DDoS protection. Month highlights are a snapshot; hold acquisition and submission always re-check availability.

### Manual QA

- Desktop: mode, advocate cards and calendar are together in Step 1; fee and summary remain visible in Step 2; Back retains entered name/mobile/email.
- Tablet: summary strip above calendar and slots. Mobile: stacked calendar/slots, 44px day targets, automatic scroll and sticky Next; no page overflow at 360px/390px.
- Time zones: compare New York, UTC and India; verify displayed date/time matches review and confirmation, and spring/autumn DST conversions.
- Fully booked/leave/blocked day: unavailable date cannot be selected; if availability changes after selecting, show no times or friendly reservation error.
- Holds: two visitors select the same advocate/time; only one succeeds. Wait the configured hold duration, then select again. Automatic assignment resolves at final submission; explicitly selected advocates must never be silently replaced, including after mode/date/time changes.
- Submit a request and sign in as staff: check the Booking ID under Awaiting Confirmation and the updated counter.

Verification: explicit Online and automatic Phone requests with no email were submitted through the two-step UI and read back under Awaiting Confirmation in the signed-in staff calendar. Desktop and 390px mobile rendering, private details and retained contact details were checked; browser errors were absent. Database tests cover assignment intent, expired holds, selected-advocate conflicts, fee snapshots and double booking. Run integration suites serially because they share mutable booking settings.

## Administrator & directory management

> **Demo credentials for testing only. Change the password immediately and never use these in production.**

- Username: `admin` (or `admin@apexlegal.test`) · Password: `Admin@12345` · Role: Administrator · opens Calendar directly; change password in Settings → General Settings.
- Seed (dev/staging only, safe to re-run): `APP_ENV=development bun ./scripts/seed-admin.ts`
- Production first admin (only when none exists): `APP_ENV=production FIRST_ADMIN_EMAIL=… FIRST_ADMIN_USERNAME=… FIRST_ADMIN_PASSWORD=… bun ./scripts/seed-admin.ts`
- Sign-in accepts username or email; 5 failures lock that account for 15 minutes, 30 failures/hour per network address are refused; every attempt is audited. Staff sessions end after 12 hours. Pending password changes block non-admin staff data; administrators change passwords voluntarily in Settings → General Settings.
- Settings → Advocates, Staff & Users, Locations (Administrator only; Booking Settings → Permissions can let Staff manage advocates and locations). Every change is written to the audit log with before/after values.
- Delete rules: advocates — none if upcoming appointments (reassign/cancel shown), soft delete with past ones, permanent otherwise; locations — deactivate only when linked; users — soft delete with history; never yourself or the last active Administrator.
- New sign-up passwords are checked against known leaked passwords; choose strong temporary passwords.

### QA checklist
- Sign in as `admin` / `Admin@12345` → Calendar, Settings visible; Settings → General Settings offers Change password.
- Add, edit, deactivate, delete an advocate, a location and a staff member; check `/` and Our Advocates update.
- Delete an advocate with an upcoming booking → blocked with Reassign/Cancel list.
- Sign in as staff → Staff & Users shows "Only an Administrator…"; Advocates/Locations likewise unless the permission toggle is on.
- Five wrong passwords → lockout message. Mobile: tables become cards.
