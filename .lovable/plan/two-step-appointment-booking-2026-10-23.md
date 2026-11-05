# Two-step appointment booking

## What will change
- **Choose Appointment:** show Online, In-person and Phone, optional advocate cards, and the existing calendar/time picker together. In-person bookings retain the office choice.
- Show only advocates available in the displayed month, selected date, or selected time. Selected cards say **Selected**; clients can return to automatic assignment.
- **Your Details:** collect full name, mobile number and optional email only. Show the appointment summary, fee, contact/booking consent and **Confirm Appointment** here—no separate review step.
- Keep every entered detail when moving back. Never replace an explicitly chosen advocate; show a clear availability error instead.
- Confirmation and the private appointment link show the assigned advocate/photo, mode, date/time, fee and office/meeting information. Changes and cancellations direct clients to the firm; no invented deadlines or charges.
- Retain the current branding, typography, colors, calendar, mobile layout and keyboard controls.

## Defaults and limitations
- Use the first active appointment type in the existing display order, currently **Initial Consultation (30 minutes, fee 150)**. Clients will not choose a legal category.
- Show the stored fee without inventing a currency; no currency is configured in the current data.
- Email is optional because the on-screen reference and private appointment link provide confirmation. Email/SMS delivery remains a stub, not a promise of delivery.
- Online uses the virtual location. Phone uses the virtual location when available, otherwise an active office; availability still follows that location's schedule.

## Technical approach
- Reuse the current database availability engine, temporary hashed holds, transaction locks, overlap constraint and booking limits.
- A hold privately reserves eligible capacity; automatic assignment is resolved at final submission. Explicit selections remain bound throughout.
- Add mode and fee snapshots to appointments and mode/selection intent to holds. Preserve older booking functions and callers.
- Keep availability queries separate from the presentation. Refresh cards and slots together when mode/date/time changes; include only the visitor's own valid held slot.

## Verification
- Add and run tests for optional email, modes, explicit-selection protection, automatic assignment, fee snapshots, expired holds and conflicts.
- Verify explicit and automatic visitor bookings, back-navigation preservation, private confirmation details and the staff Awaiting Confirmation list.
- Check desktop and mobile rendering and existing scheduling/security regression tests.