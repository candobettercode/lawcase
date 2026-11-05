
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('admin','staff','advocate');
CREATE TYPE public.appointment_status AS ENUM ('awaiting_confirmation','confirmed','completed','cancelled','declined','no_show');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_firm_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'physical' CHECK (kind IN ('physical','virtual')),
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.advocates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text NOT NULL, designation text NOT NULL DEFAULT '',
  specializations text[] NOT NULL DEFAULT '{}', years_experience int NOT NULL DEFAULT 0,
  bio text NOT NULL DEFAULT '', photo_url text,
  slot_minutes int NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 240),
  buffer_minutes int NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  active boolean NOT NULL DEFAULT true, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.advocate_locations (
  advocate_id uuid REFERENCES public.advocates(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  PRIMARY KEY (advocate_id, location_id)
);
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text NOT NULL DEFAULT '',
  duration_minutes int NOT NULL CHECK (duration_minutes BETWEEN 10 AND 480),
  fee numeric(10,2), active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advocate_id uuid NOT NULL REFERENCES public.advocates(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL, end_time time NOT NULL CHECK (end_time > start_time)
);
CREATE TABLE public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advocate_id uuid NOT NULL REFERENCES public.advocates(id) ON DELETE CASCADE,
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  reason text NOT NULL DEFAULT 'Leave'
);
CREATE TABLE public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advocate_id uuid NOT NULL REFERENCES public.advocates(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  kind text NOT NULL DEFAULT 'block' CHECK (kind IN ('court','travel','meeting','block')),
  title text NOT NULL DEFAULT 'Blocked'
);

CREATE SEQUENCE public.booking_ref_seq START 1;
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text NOT NULL UNIQUE,
  advocate_id uuid NOT NULL REFERENCES public.advocates(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL,
  opposing_party text NOT NULL DEFAULT '', matter_description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status public.appointment_status NOT NULL DEFAULT 'awaiting_confirmation',
  decline_reason text, access_token_hash text NOT NULL UNIQUE,
  consent_at timestamptz, source text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_no_double_booking EXCLUDE USING gist (
    advocate_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('awaiting_confirmation','confirmed','completed'))
);
CREATE INDEX appointments_status_idx ON public.appointments(status, starts_at);

CREATE TABLE public.booking_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  accept_online_bookings boolean NOT NULL DEFAULT true,
  min_notice_hours int NOT NULL DEFAULT 2,
  max_advance_days int NOT NULL DEFAULT 30,
  contact_phone text NOT NULL DEFAULT '+1 212 555 0100',
  contact_email text NOT NULL DEFAULT 'bookings@apexlegal.test',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.booking_settings (id) VALUES (1);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('staff','advocate')),
  advocate_id uuid REFERENCES public.advocates(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL,
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.request_limits (
  key text NOT NULL, window_start timestamptz NOT NULL, hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

GRANT SELECT ON public.locations, public.advocates, public.advocate_locations, public.services, public.booking_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.locations, public.advocates, public.advocate_locations, public.services, public.availability, public.leaves, public.blocked_times TO authenticated;
GRANT SELECT ON public.availability, public.leaves, public.blocked_times, public.appointments, public.notifications TO authenticated;
GRANT UPDATE ON public.booking_settings, public.notifications TO authenticated;
GRANT ALL ON public.locations, public.advocates, public.advocate_locations, public.services, public.availability, public.leaves, public.blocked_times, public.appointments, public.booking_settings, public.notifications, public.request_limits TO service_role;
GRANT USAGE ON SEQUENCE public.booking_ref_seq TO service_role;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocate_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active locations" ON public.locations FOR SELECT TO anon, authenticated USING (active OR public.is_firm_staff(auth.uid()));
CREATE POLICY "Public reads active advocates" ON public.advocates FOR SELECT TO anon, authenticated USING ((active AND deleted_at IS NULL) OR public.is_firm_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Public reads advocate locations" ON public.advocate_locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public reads active services" ON public.services FOR SELECT TO anon, authenticated USING (active OR public.is_firm_staff(auth.uid()));
CREATE POLICY "Public reads booking settings" ON public.booking_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff update booking settings" ON public.booking_settings FOR UPDATE TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));

CREATE POLICY "Staff manage locations" ON public.locations FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff manage advocates" ON public.advocates FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff manage advocate locations" ON public.advocate_locations FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff manage services" ON public.services FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_own_advocate(_advocate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.advocates WHERE id = _advocate_id AND user_id = auth.uid())
$$;

CREATE POLICY "Staff or own advocate read availability" ON public.availability FOR SELECT TO authenticated USING (public.is_firm_staff(auth.uid()) OR public.is_own_advocate(advocate_id));
CREATE POLICY "Staff manage availability" ON public.availability FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff or own advocate read leaves" ON public.leaves FOR SELECT TO authenticated USING (public.is_firm_staff(auth.uid()) OR public.is_own_advocate(advocate_id));
CREATE POLICY "Staff manage leaves" ON public.leaves FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff or own advocate read blocks" ON public.blocked_times FOR SELECT TO authenticated USING (public.is_firm_staff(auth.uid()) OR public.is_own_advocate(advocate_id));
CREATE POLICY "Staff manage blocks" ON public.blocked_times FOR ALL TO authenticated USING (public.is_firm_staff(auth.uid())) WITH CHECK (public.is_firm_staff(auth.uid()));
CREATE POLICY "Staff or own advocate read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_firm_staff(auth.uid()) OR public.is_own_advocate(advocate_id));
CREATE POLICY "Staff read staff notifications" ON public.notifications FOR SELECT TO authenticated USING ((audience = 'staff' AND public.is_firm_staff(auth.uid())) OR (audience = 'advocate' AND public.is_own_advocate(advocate_id)));
CREATE POLICY "Recipients mark notifications read" ON public.notifications FOR UPDATE TO authenticated USING ((audience = 'staff' AND public.is_firm_staff(auth.uid())) OR (audience = 'advocate' AND public.is_own_advocate(advocate_id)));

CREATE OR REPLACE FUNCTION public.slot_problem(_advocate uuid, _location uuid, _start timestamptz, _end timestamptz, _exclude uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tz text; buf int; local_start timestamp; local_end timestamp;
BEGIN
  SELECT l.timezone INTO tz FROM locations l WHERE l.id = _location AND l.active;
  IF tz IS NULL THEN RETURN 'That location is not available.'; END IF;
  SELECT a.buffer_minutes INTO buf FROM advocates a JOIN advocate_locations al ON al.advocate_id = a.id AND al.location_id = _location
    WHERE a.id = _advocate AND a.active AND a.deleted_at IS NULL;
  IF buf IS NULL THEN RETURN 'That advocate is not available at this location.'; END IF;
  local_start := _start AT TIME ZONE tz; local_end := _end AT TIME ZONE tz;
  IF local_start::date <> (local_end - interval '1 second')::date THEN RETURN 'Appointments must start and end on the same day.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM availability av WHERE av.advocate_id = _advocate AND av.location_id = _location
      AND av.weekday = extract(dow FROM local_start)::int AND av.start_time <= local_start::time AND av.end_time >= local_end::time) THEN
    RETURN 'That time is outside the advocate''s working hours.'; END IF;
  IF EXISTS (SELECT 1 FROM leaves lv WHERE lv.advocate_id = _advocate AND local_start::date BETWEEN lv.start_date AND lv.end_date) THEN
    RETURN 'The advocate is on leave that day.'; END IF;
  IF EXISTS (SELECT 1 FROM blocked_times b WHERE b.advocate_id = _advocate
      AND tstzrange(b.starts_at, b.ends_at) && tstzrange(_start - make_interval(mins => buf), _end + make_interval(mins => buf))) THEN
    RETURN 'The advocate has another commitment at that time.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments ap WHERE ap.advocate_id = _advocate AND ap.id IS DISTINCT FROM _exclude
      AND ap.status IN ('awaiting_confirmation','confirmed','completed')
      AND tstzrange(ap.starts_at, ap.ends_at) && tstzrange(_start - make_interval(mins => buf), _end + make_interval(mins => buf))) THEN
    RETURN 'That time slot was just taken. Please choose another time.'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.available_slots(_advocate uuid, _location uuid, _date date, _duration int)
RETURNS TABLE (starts_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (SELECT bs.min_notice_hours, bs.max_advance_days FROM booking_settings bs WHERE id = 1),
  loc AS (SELECT timezone FROM locations WHERE id = _location AND active),
  adv AS (SELECT slot_minutes FROM advocates WHERE id = _advocate AND active AND deleted_at IS NULL),
  cand AS (
    SELECT ((_date + av.start_time) + make_interval(mins => g * adv.slot_minutes)) AT TIME ZONE loc.timezone AS st
    FROM availability av, loc, adv,
      generate_series(0, (extract(epoch FROM (av.end_time - av.start_time)) / 60 / adv.slot_minutes)::int) g
    WHERE av.advocate_id = _advocate AND av.location_id = _location AND av.weekday = extract(dow FROM _date)::int
      AND g * adv.slot_minutes + _duration <= extract(epoch FROM (av.end_time - av.start_time)) / 60
  )
  SELECT DISTINCT c.st FROM cand c, s
  WHERE c.st >= now() + make_interval(hours => s.min_notice_hours)
    AND c.st < now() + make_interval(days => s.max_advance_days + 1)
    AND public.slot_problem(_advocate, _location, c.st, c.st + make_interval(mins => _duration)) IS NULL
  ORDER BY 1
$$;
GRANT EXECUTE ON FUNCTION public.available_slots(uuid, uuid, date, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.available_advocates(_location uuid, _date date, _duration int)
RETURNS TABLE (advocate_id uuid, slot_count int, first_slot timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, count(s.starts_at)::int, min(s.starts_at)
  FROM advocates a JOIN advocate_locations al ON al.advocate_id = a.id AND al.location_id = _location
  CROSS JOIN LATERAL public.available_slots(a.id, _location, _date, _duration) s
  WHERE a.active AND a.deleted_at IS NULL
  GROUP BY a.id
$$;
GRANT EXECUTE ON FUNCTION public.available_advocates(uuid, date, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(
  _client_key text, _name text, _phone text, _email text, _location uuid, _service uuid, _advocate uuid,
  _start timestamptz, _opposing text, _matter text, _consent boolean)
RETURNS TABLE (booking_ref text, access_token text, appointment_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s booking_settings; dur int; problem text; tok text; ref text; new_id uuid; hits_now int; adv_name text;
BEGIN
  SELECT * INTO s FROM booking_settings WHERE id = 1;
  IF NOT s.accept_online_bookings THEN RAISE EXCEPTION 'BOOKING_CLOSED' USING HINT = 'Online booking is temporarily unavailable. Please contact us.'; END IF;
  INSERT INTO request_limits (key, window_start, hits) VALUES (_client_key, date_trunc('hour', now()), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = request_limits.hits + 1 RETURNING hits INTO hits_now;
  DELETE FROM request_limits WHERE window_start < now() - interval '1 day';
  IF hits_now > 5 THEN RAISE EXCEPTION 'RATE_LIMITED' USING HINT = 'Too many booking requests. Please try again later or contact us.'; END IF;
  IF length(trim(_name)) < 2 OR length(_name) > 100 OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 255
     OR _phone !~ '^\+[1-9][\d ()-]{6,20}$' OR NOT _consent OR length(_opposing) > 200 OR length(_matter) > 2000 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Please check your details and try again.'; END IF;
  SELECT duration_minutes INTO dur FROM services WHERE id = _service AND active;
  IF dur IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Please choose a valid service.'; END IF;
  IF _start < now() + make_interval(hours => s.min_notice_hours) OR _start > now() + make_interval(days => s.max_advance_days + 1) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Please choose a future date within the booking window.'; END IF;
  PERFORM 1 FROM advocates WHERE id = _advocate FOR UPDATE;
  problem := public.slot_problem(_advocate, _location, _start, _start + make_interval(mins => dur));
  IF problem IS NOT NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT = problem; END IF;
  tok := encode(gen_random_bytes(32), 'hex');
  ref := 'APX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('booking_ref_seq')::text, 6, '0');
  BEGIN
    INSERT INTO appointments (booking_ref, advocate_id, location_id, service_id, client_name, client_phone, client_email,
      opposing_party, matter_description, starts_at, ends_at, access_token_hash, consent_at)
    VALUES (ref, _advocate, _location, _service, trim(_name), trim(_phone), lower(trim(_email)), coalesce(trim(_opposing), ''),
      coalesce(trim(_matter), ''), _start, _start + make_interval(mins => dur), encode(digest(tok, 'sha256'), 'hex'), now())
    RETURNING id INTO new_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT = 'That time slot was just taken. Please choose another time.';
  END;
  SELECT name INTO adv_name FROM advocates WHERE id = _advocate;
  INSERT INTO notifications (audience, advocate_id, appointment_id, title, body) VALUES
    ('staff', _advocate, new_id, 'New booking request ' || ref, 'A new consultation request for ' || adv_name || ' is awaiting confirmation.'),
    ('advocate', _advocate, new_id, 'New booking request ' || ref, 'A new consultation request assigned to you is awaiting confirmation.');
  RETURN QUERY SELECT ref, tok, new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_public_booking FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking TO service_role;

CREATE OR REPLACE FUNCTION public.appointment_by_token(_token text)
RETURNS TABLE (booking_ref text, client_name text, advocate_name text, location_name text, location_address text,
  timezone text, service_name text, starts_at timestamptz, ends_at timestamptz, status public.appointment_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT ap.booking_ref, ap.client_name, a.name, l.name, l.address, l.timezone, sv.name, ap.starts_at, ap.ends_at, ap.status
  FROM appointments ap JOIN advocates a ON a.id = ap.advocate_id JOIN locations l ON l.id = ap.location_id JOIN services sv ON sv.id = ap.service_id
  WHERE length(_token) = 64 AND ap.access_token_hash = encode(digest(_token, 'sha256'), 'hex')
$$;
GRANT EXECUTE ON FUNCTION public.appointment_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_appointment_action(_id uuid, _action text, _reason text DEFAULT NULL, _new_start timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ap appointments; problem text; dur interval;
BEGIN
  SELECT * INTO ap FROM appointments WHERE id = _id FOR UPDATE;
  IF ap.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Appointment not found.'; END IF;
  IF NOT (public.is_firm_staff(auth.uid()) OR public.is_own_advocate(ap.advocate_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission for this appointment.'; END IF;
  IF _action = 'confirm' THEN
    IF ap.status <> 'awaiting_confirmation' THEN RAISE EXCEPTION 'INVALID_STATE' USING HINT = 'Only awaiting requests can be confirmed.'; END IF;
    UPDATE appointments SET status = 'confirmed', updated_at = now() WHERE id = _id;
  ELSIF _action = 'decline' THEN
    IF ap.status NOT IN ('awaiting_confirmation','confirmed') THEN RAISE EXCEPTION 'INVALID_STATE' USING HINT = 'This request cannot be declined.'; END IF;
    IF coalesce(length(trim(_reason)), 0) < 3 THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Please give a reason for declining.'; END IF;
    UPDATE appointments SET status = 'declined', decline_reason = left(trim(_reason), 500), updated_at = now() WHERE id = _id;
  ELSIF _action = 'reschedule' THEN
    IF _new_start IS NULL OR _new_start < now() THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Choose a future time.'; END IF;
    PERFORM 1 FROM advocates WHERE id = ap.advocate_id FOR UPDATE;
    dur := ap.ends_at - ap.starts_at;
    problem := public.slot_problem(ap.advocate_id, ap.location_id, _new_start, _new_start + dur, ap.id);
    IF problem IS NOT NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT = problem; END IF;
    UPDATE appointments SET starts_at = _new_start, ends_at = _new_start + dur, updated_at = now() WHERE id = _id;
  ELSE RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Unknown action.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.staff_appointment_action FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_appointment_action TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

INSERT INTO public.locations (id, name, address, city, phone, email, kind, timezone, sort_order) VALUES
 ('11111111-0000-0000-0000-000000000001','Downtown Chambers','120 Broadway, Suite 3400, New York, NY 10271','New York','+1 212 555 0100','downtown@apexlegal.test','physical','Asia/Dhaka',1),
 ('11111111-0000-0000-0000-000000000002','Supreme Court Office','1 First St NE (adjacent), Washington, DC 20543','Washington, D.C.','+1 202 555 0100','dc@apexlegal.test','physical','Asia/Dhaka',2),
 ('11111111-0000-0000-0000-000000000003','Virtual Consultation','','Online','+1 212 555 0100','virtual@apexlegal.test','virtual','Asia/Dhaka',3);
INSERT INTO public.advocates (id, name, designation, specializations, years_experience, slot_minutes, buffer_minutes) VALUES
 ('22222222-0000-0000-0000-000000000001','Sarah Jenkins','Senior Partner','{"Criminal Defense","Constitutional Law"}',18,30,15),
 ('22222222-0000-0000-0000-000000000002','David Ross','Partner','{"Corporate Litigation"}',12,30,0),
 ('22222222-0000-0000-0000-000000000003','Priya Sharma','Associate Partner','{"Intellectual Property","Technology Law"}',8,30,10);
INSERT INTO public.advocate_locations VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001'),
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002'),
 ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001'),
 ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000003'),
 ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002'),
 ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003');
INSERT INTO public.services (name, description, duration_minutes, fee, sort_order) VALUES
 ('Initial Consultation','First meeting to understand your situation.',30,150,1),
 ('Case Review','Review of an existing matter or documents.',60,300,2),
 ('Contract Review','Review of a commercial or employment contract.',60,275,3),
 ('Litigation Strategy Session','Detailed planning for an active dispute.',90,450,4),
 ('Follow-up Meeting','Short follow-up with your advocate.',30,100,5);
INSERT INTO public.availability (advocate_id, location_id, weekday, start_time, end_time)
SELECT '22222222-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000001'::uuid, d, '09:00'::time, '13:00'::time FROM unnest(ARRAY[1,3,5]) d
UNION ALL SELECT '22222222-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000002'::uuid, d, '10:00'::time, '16:00'::time FROM unnest(ARRAY[2,4]) d
UNION ALL SELECT '22222222-0000-0000-0000-000000000002'::uuid, '11111111-0000-0000-0000-000000000001'::uuid, d, '09:00'::time, '12:30'::time FROM unnest(ARRAY[1,2,3,4,5]) d
UNION ALL SELECT '22222222-0000-0000-0000-000000000002'::uuid, '11111111-0000-0000-0000-000000000001'::uuid, d, '13:30'::time, '17:00'::time FROM unnest(ARRAY[1,2,3,4,5]) d
UNION ALL SELECT '22222222-0000-0000-0000-000000000002'::uuid, '11111111-0000-0000-0000-000000000003'::uuid, 6, '10:00'::time, '13:00'::time
UNION ALL SELECT '22222222-0000-0000-0000-000000000003'::uuid, '11111111-0000-0000-0000-000000000002'::uuid, d, '11:00'::time, '18:00'::time FROM unnest(ARRAY[1,2,3]) d
UNION ALL SELECT '22222222-0000-0000-0000-000000000003'::uuid, '11111111-0000-0000-0000-000000000003'::uuid, d, '08:00'::time, '14:00'::time FROM unnest(ARRAY[4,5]) d;
INSERT INTO public.leaves (advocate_id, start_date, end_date, reason) VALUES
 ('22222222-0000-0000-0000-000000000003', current_date + 10, current_date + 12, 'Annual leave');
INSERT INTO public.blocked_times (advocate_id, location_id, starts_at, ends_at, kind, title) VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002', ((current_date + 2) + time '10:00') AT TIME ZONE 'Asia/Dhaka', ((current_date + 2) + time '12:00') AT TIME ZONE 'Asia/Dhaka', 'court', 'Court hearing');
