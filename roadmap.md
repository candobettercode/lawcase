# Booking-first platform roadmap

- [x] Authenticated dashboard top navigation: one shared Apex bar with centered links, actual user name, secure sign-out, active states and mobile menu. 28 regression tests passed; real staff/admin login, dashboard links, public booking, 1560/1280/1024/768/390/360px layouts, sign-out/back protection and unchanged public/login pages verified without runtime errors.

- [x] Admin-managed appointment contact details in Booking Settings: admin-checked saving and database guard, validated phone/email, shared automatically refreshed customer links, cleared known fake defaults, and separate policy text. 37 regression tests passed; real booking, signed-in admin saving, updates on both open appointment pages, empty-contact guidance, phone layout and cleanup verified with no browser errors.

- [x] Your Details redesign: compact appointment summary, available automatic lawyer assignment and optional Change modal, aligned contact fields, concise consent and gated confirmation. 92 serial tests passed; desktop/phone layouts, real booking and matching assigned lawyer read back through private details; test appointments removed.

- [x] Booking header row: "Book an Appointment" is the first line with the Login button immediately to its right, bottom-aligned to the heading and compact on phones. 85 serial tests passed; 1560/1024/768/414/390/375/360px verified one line with no horizontal overflow.

- [x] Booking presentation update: consultation fees hidden in booking/confirmation/private details; advocate names prefixed with Adv and designation/experience hidden; country-code dropdown before mobile number with retained inputs. 33 regression tests passed; real visitor booking and private details verified on desktop/mobile with no browser errors; synthetic appointment removed.

- [x] Booking homepage redesign: fixed 40/60 branding and booking split, no top navigation, Login within booking, In-person/Online only with In-person default. 56 automated tests and six desktop/tablet/mobile widths passed; visitor In-person booking, retained details, private summary and staff Awaiting Confirmation verified. Synthetic booking removed.

- [x] Requested two-step booking: mode, optional availability-filtered advocate and date/time together; minimal contact details; explicit-selection protection and assignment at confirmation; fee and full confirmation. 75 full-suite regressions passed plus 3 new state tests; explicit Online and automatic Phone bookings verified in staff Awaiting Confirmation, private details and desktop/mobile views. Synthetic bookings removed; email/SMS remains a stub and fee currency remains unconfigured.

- [x] Admin login goes directly to Calendar; password change remains in Settings → General Settings; 16 tests and browser login/redirect/settings validation passed.

- [x] Requested date/time upgrade: six-step wizard, reusable monthly calendar and slots, month availability, expiring holds/first-available assignment and settings; 40 automated tests and desktop/tablet/mobile browser checks passed; visitor submission read back in staff Awaiting Confirmation.

- [x] Architecture plan approval
- [x] A. Design tokens, full-width shells and public navigation — verified desktop/mobile, contact validation, retained entries, private route isolation and seven route tests
- [x] B. Shared database, availability functions, transactional booking with double-booking constraint
- [x] C. Public booking wizard, confirmation and secure appointment view
- [~] D. Staff email login, roles and demo staff account done; password reset and 2FA still open
- [ ] E. Internal calendar and appointment management — Phase 2 starts with a side-by-side advocate timeline, location/advocate/type/status filters, all event kinds, location time zones and conflict-checked quick booking (requires B and D first)
  - [x] Requested now: multi-advocate timeline implemented in the preserved internal calendar with four filters, combined event kinds, location-zone positioning and column-prefilled conflict-checked local booking; 16 tests pass and isolated browser rendering/booking verified.
  - [ ] Live timeline access and concurrent shared booking protection — blocked by shared-data Stage B and secure staff-access Stage D approval/implementation.
- [~] F. Settings modules — Advocates, Staff & Users, Locations, Booking Settings done with admin seed, lockout and audit log; Firm Information, Appointment Types, Availability, Notifications, General Settings remain placeholders
- [ ] G. Notification stub, reports, accessibility, tests and setup/QA documentation

Each implementation stage starts only after approval of the previous stage.