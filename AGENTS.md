<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Public routes import only the safe public directory module, never the legacy private store or archived management views; this prevents private demo data entering visitor bundles.
- Preserved legacy management views live outside the route tree until real authenticated access and tenant-scoped data are available; unavailable route leaves expose no management data.
- Shared public layout lives in the root route, with header/footer omitted on booking, login and matched authenticated pages; the existing signed-in layout mounts StaffNav once while preserving its managed guard, preventing duplicate or visitor-facing dashboard navigation. A dedicated booking layout owns the responsive brand panel and booking workspace.
- Route metadata uses the shared public metadata factory with unique leaf titles and descriptions; private and access surfaces are noindex.
- Public booking uses a two-step database-backed wizard with focused appointment-summary, lawyer-assignment and confirmation views; the first active service in display order supplies stored service snapshots without requiring legal categorization, while public presentation independently controls their visibility.
- Public booking phone entry uses a separate country selector and national number; shared calling-code metadata composes the international number before existing client/server validation, preserving both inputs across steps.
- Public consultation choices are separate from stored appointment modes, preserving historical phone appointments while limiting new homepage selections; booking workspace container queries govern calendar and advocate layouts so split-screen widths remain usable.
- The reusable advocate timeline receives normalized entries and callbacks without reading a store; its archived calendar adapter stays outside public routes until authenticated shared data is ready.
- Timeline positioning uses location wall-clock minutes and an explicitly labelled reference zone for all-location views; quick booking converts the selected instant into the booking location zone.
- Slot generation, slot validation and booking creation live in database functions shared by public booking and staff rescheduling; an exclusion constraint is the final double-booking guard.
- Public booking writes go only through the server booking function (honeypot, rate limit, service-only database function); visitors read the active directory and token lookups directly under row-level security.
- Staff pages live under the signed-in layout; permissions are enforced by database policies and role checks, the interface only mirrors them.
- Notifications go through a swappable provider interface; messages never include matter details.
- Appointment contact details use the existing booking settings fields, admin-checked writes and a database guard; customer rescheduling sections share a focused polling query instead of appointment snapshots, while policy text stays independent.
- The public date/time card is presentational; separate query hooks fetch monthly/day availability in the visitor zone through database functions, so calendar highlights and displayed dates agree across DST.
- Temporary slot holds are service-only token-hashed capacity reservations; the public details step automatically binds an eligible lawyer through a replacement explicit hold before displaying their name, and optional lawyer changes update only after successful reservation, preventing silent substitution while deterministic locks and the overlap constraint protect bookings across locations.
- Directory writes (advocates, locations) go through role-checked SQL functions called with the user's session so audit triggers capture the actor; account changes needing the auth admin API go through admin-checked server functions that return 403.
- Staff sign-in runs through a server function (username lookup, lockout, audit) and the client adopts the returned session; account state and role-specific password requirements are enforced inside role-check SQL functions and mirrored by a shared login policy.
- Run test files serially because database integration suites temporarily change shared booking settings; parallel suites would invalidate each other's availability tests.
