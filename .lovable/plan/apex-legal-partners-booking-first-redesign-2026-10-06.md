# Apex Legal Partners — booking-first redesign

## Review: keep, refactor, replace

**Keep:** the existing React/TanStack application, reusable form/dialog controls, calendar views and appointment drawer, legal visual language, calendar exports, and the scheduling concepts already handling working hours, buffers, blocks, holidays and rooms.

**Refactor:** extract the calendar from the homepage; split the large browser store into focused scheduling, booking, settings and client modules; upgrade time-zone calculations and scheduling tests; replace narrow containers with fluid layouts. Existing models are useful starting points, not the final database schema.

**Replace:** the “Viewing as” demo selector, browser-only persistence, UI-only permissions, current booking order, generated demo IDs and notification claims without actual delivery.

**Current state:** the app compiles, but available telemetry shows a server/client rendering mismatch. There is no connected shared database or real authentication. None of the current role filtering is a security boundary.

## Experience and design

- `/` opens the actual seven-step booking experience, not a marketing landing page.
- Navy full-width header, white/warm off-white surfaces, subtle gray borders, gold branding, Libre Baskerville key titles and a clean sans-serif body. Centralized color, typography, spacing and radius tokens; minimal shadows and motion.
- Desktop layouts use 24–40px side spacing. Calendar and tables stay fluid; text and forms have only generous readability limits.
- Public navigation: Book Appointment, How It Works, Our Advocates, Locations, Contact and Login. Mobile has a hamburger menu.
- Internal navigation is role-aware and separate. The calendar remains the first screen after login.
- Public advocate cards use real uploaded photos when supplied, otherwise initials; no invented people photos or decorative artwork.

## Approval-gated delivery

Each stage ends with a short summary, verification results and an approval request before the next stage.

### A. Design system and application shells
Define tokens and full-width public/internal shells, create public navigation and its pages, establish the booking-first homepage and relocate the calendar. Remove visitor-accessible client/settings/calendar pages in this stage: until real authentication lands, internal pages are unavailable, not protected by a pretend login. Preserve calendar code for stage E.

### B. Database and availability
Enable Lovable Cloud after approval. Create schema, explicit grants, tenant-scoped policies and literal demo-row migrations. Extract one reusable availability engine and test it. Add transactional booking and hold functions with concurrency protection. Provide authenticated operations only when their server authentication exists; never temporarily expose private queries.

### C. Public booking and confirmation
Build Client Information → Date and Location → Available Advocates → Time Slots → Matter Details → Review → Confirmation. Load active resources, show fetching/empty/error states, validate inputs, retain earlier entries, add expiring holds and secure appointment access. Changing service duration at step 5 rechecks availability and replaces the hold; return to slot selection if the longer service cannot fit. Notification success is never claimed while the provider is a stub.

### D. Authentication and roles
Use managed staff email/password login, forgot-password and public reset-password page, expiring sessions, server-checked roles and safe sign-out. No extra user-profile table: staff identity comes from managed accounts; advocate directory information remains its own required business entity. Disable open staff registration. Store roles separately from advocates/users. Add optional authenticator-based 2FA and verify availability before claiming it works. Document permission matrix and sensitive-action audits.

### E. Internal calendar and appointments
Reconnect the existing calendar to authenticated data. Add full-width counters, day/week/month/agenda, all filters/statuses, multi-advocate view, service/type legend, appointment drawer and permitted actions, conflict-checked drag rescheduling, private notes and a mobile day/agenda experience. Advocates see assigned records; staff/admin see their firm’s records.

### F. Settings
Implement the nine requested sections with role checks. Full advocate/location/service management; photos; recurring working ranges; duration/buffers; leave, blocks and holidays; booking notice/window/holds; cancellation/rescheduling and reminder settings. Historical relationships survive deactivation; future bookings require explicit reassignment or a warning workflow.

### G. Notifications, reports and release checks
Implement a template-driven email/SMS notification interface with a stub provider and durable outbox; privacy-safe messages and configurable triggers. Add basic firm appointment/status/utilization reports, retention controls, audit review, accessibility and responsive checks. Deliver setup instructions, environment-variable inventory, isolated demo-account access instructions and a requirement-by-requirement QA checklist. Real message delivery requires a later provider connection.

## Technical design

### Stack
Reuse React 19, TanStack Start/Router/Query, TypeScript, Tailwind v4, shadcn/Radix, React Hook Form, Zod, date-fns, Lucide and Vitest. Add Lovable Cloud for PostgreSQL, managed auth and private file storage. Use TanStack server functions on the Cloudflare runtime for application operations; raw server routes only for external callbacks. Use a tested time-zone library and a proven drag-and-drop library rather than rebuilding their core behavior.

### Route map

| Public URL | Purpose |
|---|---|
| `/` | Booking wizard |
| `/book` | Compatibility redirect to `/` |
| `/how-it-works` | Booking process |
| `/advocates` | Active public advocate directory |
| `/locations` | Active office/virtual directory |
| `/contact` | Firm contact information |
| `/booking/confirmation` | Confirmation using a secure booking capability |
| `/appointment` | Token-authorized appointment view |
| `/auth` | Staff login and forgotten password |
| `/reset-password` | Recovery password form |

Protected URLs live under the integration-managed pathless `_authenticated` layout: `/calendar`, `/appointments`, `/clients`, `/notifications`, `/settings` and its firm/advocates/users/locations/services/availability/notifications/booking/general children, plus `/reports`. Legacy `/admin` redirects to protected settings. There is only one `/` route. Each content page has unique metadata; private/confirmation/access pages are `noindex`.

### Folder structure

````text
src/
  routes/                  public leaves and _authenticated children
  components/layout/       PublicHeader, InternalHeader, fluid shells
  components/booking/      stepper, step forms, advocate cards, summary
  components/calendar/     grids, toolbar, legend, event drawer
  components/settings/     resource forms and settings navigation
  lib/scheduling/          pure slot/time/conflict logic and schemas
  lib/booking/             *.functions.ts wrappers, *.server.ts helpers
  lib/management/          authenticated operations and query options
  lib/security/            role checks, token exchange, request limits
  lib/notifications/       provider interface, templates, outbox
  integrations/            Cloud-managed auth/database clients
  test/                    unit, integration and authorization tests
supabase/migrations/       schema, grants, policies and demo rows
docs/                      permissions, setup, demo access and QA
````

Server-only helpers never ship to the browser; no client-facing server functions are placed under `src/server/`. Structural implementation rules are recorded in `AGENTS.md` as they are introduced.

### Relational schema

All firm-owned rows are tenant-scoped, with tenant-consistent foreign keys and server-derived tenant/user identity.

| Tables | Key data |
|---|---|
| `tenants`, `tenant_memberships`, `user_roles` | Firm identity, managed-auth membership, separately stored admin/staff/advocate roles |
| `advocates`, `advocate_locations` | Linked managed user, public profile/business fields, assignment, active/soft-delete state |
| `locations` | Address/city/contact, physical or virtual type, IANA time zone, active flag |
| `services`, `service_locations`, `service_advocates` | Duration, fee/currency, modes, ordering, restrictions, active flag |
| `clients`, `appointments` | Private client contact, reference, UTC interval, resource links, status, consent, encrypted matter/opposing-party content |
| `availability`, `leave`, `blocked_times`, `holidays` | Location-specific weekday ranges, duration/buffers and calendar exclusions |
| `schedule_reservations`, `slot_holds`, `appointment_access_tokens` | Cross-location occupied ranges, expiring holds and hashed/revocable public capabilities |
| `notifications`, `notification_templates`, `notification_outbox` | Privacy-safe messages, trigger configuration and delivery attempts |
| `audit_logs`, `settings`, `request_limits` | Immutable sensitive-action trail, firm/booking/retention settings and approved custom request counters |
| `rooms` (if retained) | Existing consultation-room capacity and assignments |

Appointment statuses: Awaiting Confirmation, Confirmed, Completed, Cancelled, Declined and No Show. Human-facing labels map to stable database values.

### Booking correctness

- A PostgreSQL exclusion constraint protects overlapping advocate appointment ranges in the required active statuses.
- A shared reservation layer also protects holds/blocks and buffered intervals. All mutation paths lock the advocate schedule, remove expired holds, revalidate working hours/leave/blocks/other-location bookings and insert within one transaction.
- Availability changes and internal rescheduling use the same locking discipline. Cancelled/declined appointments release occupancy.
- Public/internal callers use the same slot computation. Transactional validation repeats the rules against current database state; no client-computed availability is trusted.
- Slots before service selection use the configured base duration; service selection recomputes duration/restrictions and hold validity.
- UTC storage, IANA location zones and explicit DST gap/overlap tests replace assumptions based on the visitor’s browser zone.

### Security and privacy

- Staff-only auth, per-handler authentication/role checks, explicit grants and RLS; anonymous reads project only safe active directory fields. No public access to client/appointment tables.
- Public appointment lookup uses a high-entropy token stored hashed. Email links exchange the token from a URL fragment for a short-lived secure HttpOnly capability cookie, then remove it from the address bar. Lookup is `no-store`, `noindex` and never exposes another appointment; no matter text in links or messages.
- Public mutations verify bot checks and the approved custom database-backed request limit. This is an application-level measure, not a claim of infrastructure-grade rate limiting or DDoS protection.
- Use platform-managed password hashing and expiring auth tokens; add origin/CSRF controls for cookie-authorized actions. Never store auth credentials or private encryption keys in source.
- Encrypt sensitive legal content with authenticated encryption using a managed secret, document key rotation and retention. Infrastructure encryption, residency, backups and legal compliance require verification before a production-readiness claim.
- Standard Cloud authentication uses bearer validation; secure HttpOnly cookies are used for guest capabilities. Do not describe managed staff sessions as cookie-only unless that architecture is explicitly implemented and tested.
- Test direct unauthenticated and wrong-role endpoint calls, cross-tenant reads, tampered tokens and concurrency, not just hidden navigation.

## Resolved decisions and assumptions

- You selected **no extra user profiles** and approved **custom request limits** alongside bot protection.
- Default booking status is Awaiting Confirmation; a five-minute hold is the initial configurable demo value.
- Demonstration offices can use the Mumbai/Andheri/Vile Parle/virtual examples in `Asia/Kolkata`; original New York/D.C. cases remain useful time-zone fixtures. All names, addresses, fees, hours and account details not supplied are clearly labelled sample data.
- Seed business records in migrations. Provision test logins separately through managed authentication; no production hardcoded passwords and no public demo-user switcher. Temporary access instructions are kept out of source and require password change.
- Stage A’s shell is not a claim that the whole application is secure or production-ready. Release requires successful database, authentication, concurrency, privacy and device tests.
- No Cloud activation, product-code redesign or schema changes occur until you approve this plan.