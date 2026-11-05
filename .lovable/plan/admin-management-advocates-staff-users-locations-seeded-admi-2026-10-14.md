# Admin management: Advocates, Staff & Users, Locations + seeded Admin

## What exists today
- Staff sign-in (email only) at `/auth`, roles table (admin / staff / advocate), demo staff seed script (dev/staging only).
- One Settings page with Booking Settings only; no sidebar, no management screens.
- Advocates, locations, services, hours, leave and blocks are in the database; public booking reads only active, non-deleted records (already automatic, nothing hardcoded).
- Database rules currently let **Staff and Admin** manage advocates and locations.
- Advocates already have a soft-delete date; locations only have active/inactive.

## What is missing
- Admin account, username login, forced password change, lockout, login audit.
- Audit log of any kind.
- Add / view / edit / deactivate / delete screens and server actions for advocates, staff and locations.
- Advocate email, phone, bar number, photo upload; staff directory (name, username, phone, scope, last login).
- Delete safety (past vs future appointments, reassign/cancel), last-admin protection, conflict flagging after hours changes.

## What I will build

### 1. Admin account and sign-in
- Seed script (dev/staging only, repeatable): username `admin`, password `Admin@12345`, Administrator, Active, must change password. README + code note exactly as requested. Production: first admin created only from environment variables (`FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD`) via the same script with a production flag.
- Sign-in accepts username or email (username resolved on the server, never exposed to visitors).
- Rate limit + 15-minute lockout after 5 failures, audit entry for every success/failure, session expiry, "Choose a new password" screen enforced before any staff page.
- Admin lands on Calendar; Settings visible in navigation.

### 2. Permissions
- Admin-only for advocates, staff and locations by default; a "Staff may manage advocates and locations" toggle (off) in Booking/General settings preserves the old behaviour if wanted.
- Every action is a signed-in server action that checks the role in the database and returns 403 otherwise; database rules tightened to match.
- Audit log records who, what, when, before and after for create, update, activate/deactivate, delete, password reset, force logout, logins.

### 3. Settings sidebar
Firm Information, Advocates, Staff & Users, Locations, Appointment Types, Availability, Notifications, Booking Settings, General Settings. Sections not in scope show a short "coming soon" state.

### 4. Advocates
- Table (photo, name, designation, email, phone, locations, status, actions), search, filters (status, location, specialization), sorting, pagination; stacked cards on mobile; empty state and skeletons.
- Side drawer form with all requested fields, weekly hours with multiple ranges per day per location, duration, buffer; photo upload with preview, type (JPG/PNG/WebP) and 2 MB limit, initials fallback; unsaved-changes warning.
- Creating an advocate also creates their login with an admin-set temporary password and forced change (invite email needs an email sender set up; offered later).
- Delete: no appointments → removed; only past → soft delete (hidden from public, history kept); any future → blocked with list of affected appointments and Reassign / Cancel-with-notification actions.
- After hours/location changes, future appointments that no longer fit are flagged in the drawer.

### 5. Staff & Users
- Table (name, email, username, role, locations, status, last login, actions), search, filters, pagination.
- Form: name, email, username, phone, role, assigned locations and optional advocates (calendar scope), status; temporary password; Reset Password and Force logout actions.
- Deactivate ends sessions immediately; soft delete when history exists, hard delete otherwise; cannot remove/deactivate yourself or the last active Administrator.

### 6. Locations
- Table (name, type, city, contact, advocate count, status, actions), search, filters.
- Form: name (unique), type, address (hidden for virtual), city, contact, time zone, optional default hours and holidays, status.
- Delete only with no linked data; otherwise offer Deactivate with explanation and list future appointments there for reassign/cancel.

### 7. Testing and delivery
- Automated tests: 403 for staff and advocate, soft vs hard delete, blocked deletion with future appointments, last-admin protection, unique email/username/bar number, login lockout, audit entries.
- End-to-end as admin: forced password change, then add/edit/deactivate/delete each record type and check the public booking page reflects it. Test records removed afterwards.
- Summary of changed files, seed instructions, QA checklist.

## Assumptions / open points
- Invites by email are deferred (no email sender configured); temporary password + forced change is used.
- "Firm Information", "Appointment Types", "Availability", "Notifications", "General Settings" sidebar items are placeholders in this release except where needed (permission toggle).
- After your end-to-end test I will reset the admin password back to the demo value so you can repeat the check.

## Technical details
- Migration: `staff_profiles` (user_id, full_name, username unique citext, phone, status, must_change_password, last_login_at, deleted_at/by, is_deleted), `staff_scopes` (locations/advocates), `audit_log`, `login_attempts`; advocates gain email unique, phone, bar_number unique, is_deleted, deleted_by; locations gain is_deleted, deleted_at, deleted_by, unique lower(name), default hours/holidays; `booking_settings.staff_can_manage_directory boolean default false`; RLS for advocates/locations/availability rewritten to admin OR (staff AND toggle).
- Transactional SQL functions (security definer, role-checked) for multi-table writes (advocate + locations + hours, delete/reassign/cancel, last-admin guard); auth user creation/ban/sign-out via service client inside role-checked server functions; private storage bucket `advocate-photos` with size/type limits served via signed/public read of active photos only.
- Username login: server function resolves username → email and performs password sign-in server-side with lockout counting, returning the session to the client.
