-- Staff directory, scopes, audit and login attempts
CREATE TABLE public.staff_profiles (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  username text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  sessions_revoked_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_profiles_username_key ON public.staff_profiles (lower(username));
CREATE UNIQUE INDEX staff_profiles_email_key ON public.staff_profiles (lower(email));
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.staff_profiles(user_id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  advocate_id uuid REFERENCES public.advocates(id) ON DELETE CASCADE,
  CHECK (location_id IS NOT NULL OR advocate_id IS NOT NULL)
);
GRANT SELECT ON public.staff_scopes TO authenticated;
GRANT ALL ON public.staff_scopes TO service_role;
ALTER TABLE public.staff_scopes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  ip text NOT NULL DEFAULT '',
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_ident_idx ON public.login_attempts (identifier, created_at DESC);
CREATE INDEX login_attempts_ip_idx ON public.login_attempts (ip, created_at DESC);
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Advocate / location / settings columns
ALTER TABLE public.advocates ADD COLUMN email text, ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN bar_number text,
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false, ADD COLUMN deleted_by uuid;
UPDATE public.advocates SET is_deleted = true WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX advocates_email_key ON public.advocates (lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX advocates_bar_number_key ON public.advocates (upper(bar_number)) WHERE bar_number IS NOT NULL AND bar_number <> '';
ALTER TABLE public.locations ADD COLUMN is_deleted boolean NOT NULL DEFAULT false, ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid,
  ADD COLUMN default_hours jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN holidays date[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX locations_name_key ON public.locations (lower(name)) WHERE NOT is_deleted;
ALTER TABLE public.booking_settings ADD COLUMN staff_can_manage_directory boolean NOT NULL DEFAULT false;

-- Backfill directory rows for existing role holders
INSERT INTO public.staff_profiles (user_id, full_name, username, email)
SELECT DISTINCT ON (u.id) u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), lower(split_part(u.email,'@',1)) || CASE WHEN EXISTS (SELECT 1 FROM auth.users u2 WHERE u2.id <> u.id AND lower(split_part(u2.email,'@',1)) = lower(split_part(u.email,'@',1))) THEN '-' || left(u.id::text, 4) ELSE '' END, lower(u.email)
FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
ON CONFLICT DO NOTHING;

-- Account state checks used by every role check
CREATE OR REPLACE FUNCTION public.staff_account_ok(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.staff_profiles p WHERE p.user_id = _user_id AND (
    p.status <> 'active' OR p.is_deleted OR p.must_change_password OR
    (_user_id = auth.uid() AND p.sessions_revoked_at IS NOT NULL AND coalesce((auth.jwt()->>'iat')::bigint, 0) < floor(extract(epoch FROM p.sessions_revoked_at)))))
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) AND public.staff_account_ok(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_firm_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff')) AND public.staff_account_ok(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_own_advocate(_advocate_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.advocates WHERE id = _advocate_id AND user_id = auth.uid()) AND public.staff_account_ok(auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_manage_directory(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR (public.has_role(_user_id, 'staff') AND (SELECT staff_can_manage_directory FROM public.booking_settings WHERE id = 1))
$$;
CREATE OR REPLACE FUNCTION public.staff_can_see(_location uuid, _advocate uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.staff_scopes s WHERE s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_scopes s WHERE s.user_id = auth.uid() AND (s.location_id = _location OR s.advocate_id = _advocate))
$$;

-- Policies
CREATE POLICY "Own profile read" ON public.staff_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own scopes read" ON public.staff_scopes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY "Staff manage advocates" ON public.advocates;
CREATE POLICY "Directory managers manage advocates" ON public.advocates FOR ALL TO authenticated USING (public.can_manage_directory(auth.uid())) WITH CHECK (public.can_manage_directory(auth.uid()));
DROP POLICY "Staff manage locations" ON public.locations;
CREATE POLICY "Directory managers manage locations" ON public.locations FOR ALL TO authenticated USING (public.can_manage_directory(auth.uid())) WITH CHECK (public.can_manage_directory(auth.uid()));
DROP POLICY "Staff manage advocate locations" ON public.advocate_locations;
CREATE POLICY "Directory managers manage advocate locations" ON public.advocate_locations FOR ALL TO authenticated USING (public.can_manage_directory(auth.uid())) WITH CHECK (public.can_manage_directory(auth.uid()));
DROP POLICY "Staff manage availability" ON public.availability;
CREATE POLICY "Directory managers manage availability" ON public.availability FOR ALL TO authenticated USING (public.can_manage_directory(auth.uid())) WITH CHECK (public.can_manage_directory(auth.uid()));
DROP POLICY "Staff or own advocate read appointments" ON public.appointments;
CREATE POLICY "Scoped staff or own advocate read appointments" ON public.appointments FOR SELECT TO authenticated USING ((public.is_firm_staff(auth.uid()) AND public.staff_can_see(location_id, advocate_id)) OR public.is_own_advocate(advocate_id));

-- Only admins may flip the directory permission toggle
CREATE OR REPLACE FUNCTION public.guard_directory_toggle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.staff_can_manage_directory IS DISTINCT FROM OLD.staff_can_manage_directory AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can change this permission.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_settings_directory_toggle BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION public.guard_directory_toggle();

-- Never remove the last active administrator
CREATE OR REPLACE FUNCTION public.guard_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r LEFT JOIN public.staff_profiles p ON p.user_id = r.user_id
    WHERE r.role = 'admin' AND r.user_id <> OLD.user_id AND coalesce(p.status,'active') = 'active' AND NOT coalesce(p.is_deleted,false)) THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING HINT = 'The last active Administrator cannot be removed.';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER user_roles_last_admin BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

CREATE OR REPLACE FUNCTION public.guard_last_admin_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status <> 'active' OR NEW.is_deleted) AND OLD.status = 'active' AND NOT OLD.is_deleted
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.staff_profiles p ON p.user_id = r.user_id
       WHERE r.role = 'admin' AND r.user_id <> OLD.user_id AND p.status = 'active' AND NOT p.is_deleted) THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING HINT = 'The last active Administrator cannot be deactivated.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_profiles_last_admin BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin_profile();

-- Row audit for directory tables (writes go through user sessions, so auth.uid() is the actor)
CREATE OR REPLACE FUNCTION public.audit_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text; b jsonb; a jsonb;
BEGIN
  b := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  a := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  act := lower(TG_OP);
  IF TG_OP = 'UPDATE' THEN
    IF (b->>'is_deleted')::boolean IS DISTINCT FROM (a->>'is_deleted')::boolean AND (a->>'is_deleted')::boolean THEN act := 'soft_delete';
    ELSIF (b->>'active')::boolean AND NOT (a->>'active')::boolean THEN act := 'deactivate';
    ELSIF NOT (b->>'active')::boolean AND (a->>'active')::boolean THEN act := 'activate';
    ELSIF b = a THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, before, after)
  VALUES (auth.uid(), act, TG_TABLE_NAME, coalesce(a->>'id', b->>'id'), b, a);
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER advocates_audit AFTER INSERT OR UPDATE OR DELETE ON public.advocates FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER locations_audit AFTER INSERT OR UPDATE OR DELETE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- Location holidays close the office for bookings
CREATE OR REPLACE FUNCTION public.slot_problem(_advocate uuid, _location uuid, _start timestamp with time zone, _end timestamp with time zone, _exclude uuid DEFAULT NULL::uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE tz text; buf int; local_start timestamp; local_end timestamp; hol date[];
BEGIN
  SELECT l.timezone, l.holidays INTO tz, hol FROM locations l WHERE l.id = _location AND l.active AND NOT l.is_deleted;
  IF tz IS NULL THEN RETURN 'That location is not available.'; END IF;
  SELECT a.buffer_minutes INTO buf FROM advocates a JOIN advocate_locations al ON al.advocate_id = a.id AND al.location_id = _location WHERE a.id = _advocate AND a.active AND a.deleted_at IS NULL;
  IF buf IS NULL THEN RETURN 'That advocate is not available at this location.'; END IF;
  local_start := _start AT TIME ZONE tz; local_end := _end AT TIME ZONE tz;
  IF local_start::date <> (local_end - interval '1 second')::date THEN RETURN 'Appointments must start and end on the same day.'; END IF;
  IF local_start::date = ANY(hol) THEN RETURN 'The office is closed that day.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM availability av WHERE av.advocate_id = _advocate AND av.location_id = _location AND av.weekday = extract(dow FROM local_start)::int AND av.start_time <= local_start::time AND av.end_time >= local_end::time) THEN RETURN 'That time is outside the advocate''s working hours.'; END IF;
  IF EXISTS (SELECT 1 FROM leaves lv WHERE lv.advocate_id = _advocate AND local_start::date BETWEEN lv.start_date AND lv.end_date) THEN RETURN 'The advocate is on leave that day.'; END IF;
  IF EXISTS (SELECT 1 FROM blocked_times b WHERE b.advocate_id = _advocate AND tstzrange(b.starts_at,b.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'The advocate has another commitment at that time.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments ap WHERE ap.advocate_id = _advocate AND ap.id IS DISTINCT FROM _exclude AND ap.status IN ('awaiting_confirmation','confirmed','completed') AND tstzrange(ap.starts_at,ap.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'That time slot was just taken. Please choose another time.'; END IF;
  IF EXISTS (SELECT 1 FROM booking_holds h WHERE h.advocate_id = _advocate AND h.expires_at > now() AND tstzrange(h.starts_at,h.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'That time is temporarily held. Please choose another time.'; END IF;
  RETURN NULL;
END $function$;

-- Friendly unique-constraint messages
CREATE OR REPLACE FUNCTION public.unique_hint(_constraint text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _constraint
    WHEN 'advocates_email_key' THEN 'Another advocate already uses this email.'
    WHEN 'advocates_bar_number_key' THEN 'Another advocate already uses this bar/license number.'
    WHEN 'locations_name_key' THEN 'A location with this name already exists.'
    WHEN 'staff_profiles_username_key' THEN 'This username is already taken.'
    WHEN 'staff_profiles_email_key' THEN 'This email is already used by another user.'
    ELSE 'This value is already in use.' END
$$;

-- Advocates: save (advocate + locations + hours in one transaction)
CREATE OR REPLACE FUNCTION public.admin_save_advocate(_id uuid, _data jsonb, _locations uuid[], _hours jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid := _id; cname text; nm text := trim(coalesce(_data->>'name','')); em text := lower(trim(coalesce(_data->>'email','')));
BEGIN
  IF NOT public.can_manage_directory(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can manage advocates.'; END IF;
  IF length(nm) < 2 OR length(nm) > 100 THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Full name is required.'; END IF;
  IF em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'A valid email is required.'; END IF;
  IF coalesce((_data->>'slot_minutes')::int, 30) NOT BETWEEN 10 AND 240 OR coalesce((_data->>'buffer_minutes')::int, 0) NOT BETWEEN 0 AND 120
     OR coalesce((_data->>'years_experience')::int, 0) NOT BETWEEN 0 AND 80 THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Check duration, buffer and experience values.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(_hours,'[]')) h WHERE (h->>'end')::time <= (h->>'start')::time OR (h->>'weekday')::int NOT BETWEEN 0 AND 6 OR NOT ((h->>'location_id')::uuid = ANY(_locations))) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Each working-hours range needs an assigned location and an end time after its start.'; END IF;
  BEGIN
    IF _id IS NULL THEN
      INSERT INTO advocates (name, email, phone, designation, bar_number, specializations, years_experience, bio, photo_url, slot_minutes, buffer_minutes, active)
      VALUES (nm, em, left(trim(coalesce(_data->>'phone','')),30), left(trim(coalesce(_data->>'designation','')),100), nullif(upper(trim(coalesce(_data->>'bar_number',''))),''),
        coalesce(ARRAY(SELECT left(trim(x),60) FROM jsonb_array_elements_text(coalesce(_data->'specializations','[]')) x WHERE trim(x) <> ''), '{}'),
        coalesce((_data->>'years_experience')::int,0), left(coalesce(_data->>'bio',''),2000), nullif(_data->>'photo_url',''),
        coalesce((_data->>'slot_minutes')::int,30), coalesce((_data->>'buffer_minutes')::int,0), coalesce((_data->>'active')::boolean,true))
      RETURNING id INTO new_id;
    ELSE
      PERFORM 1 FROM advocates WHERE id = _id AND NOT is_deleted FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Advocate not found.'; END IF;
      UPDATE advocates SET name = nm, email = em, phone = left(trim(coalesce(_data->>'phone','')),30), designation = left(trim(coalesce(_data->>'designation','')),100),
        bar_number = nullif(upper(trim(coalesce(_data->>'bar_number',''))),''),
        specializations = coalesce(ARRAY(SELECT left(trim(x),60) FROM jsonb_array_elements_text(coalesce(_data->'specializations','[]')) x WHERE trim(x) <> ''), '{}'),
        years_experience = coalesce((_data->>'years_experience')::int,0), bio = left(coalesce(_data->>'bio',''),2000), photo_url = nullif(_data->>'photo_url',''),
        slot_minutes = coalesce((_data->>'slot_minutes')::int,30), buffer_minutes = coalesce((_data->>'buffer_minutes')::int,0), active = coalesce((_data->>'active')::boolean,true)
      WHERE id = _id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
    RAISE EXCEPTION 'DUPLICATE' USING HINT = public.unique_hint(cname);
  END;
  DELETE FROM availability WHERE advocate_id = new_id;
  DELETE FROM advocate_locations WHERE advocate_id = new_id;
  INSERT INTO advocate_locations (advocate_id, location_id) SELECT new_id, l.id FROM locations l WHERE l.id = ANY(_locations) AND NOT l.is_deleted;
  INSERT INTO availability (advocate_id, location_id, weekday, start_time, end_time)
  SELECT new_id, (h->>'location_id')::uuid, (h->>'weekday')::int, (h->>'start')::time, (h->>'end')::time FROM jsonb_array_elements(coalesce(_hours,'[]')) h;
  RETURN new_id;
END $$;

-- Future appointments that no longer fit the advocate's hours/locations
CREATE OR REPLACE FUNCTION public.advocate_conflicts(_advocate uuid)
RETURNS TABLE(id uuid, booking_ref text, client_name text, starts_at timestamptz, location_name text, problem text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ap.id, ap.booking_ref, ap.client_name, ap.starts_at, l.name, public.slot_problem(ap.advocate_id, ap.location_id, ap.starts_at, ap.ends_at, ap.id)
  FROM appointments ap JOIN locations l ON l.id = ap.location_id
  WHERE public.is_firm_staff(auth.uid()) AND ap.advocate_id = _advocate AND ap.starts_at > now() AND ap.status IN ('awaiting_confirmation','confirmed')
    AND public.slot_problem(ap.advocate_id, ap.location_id, ap.starts_at, ap.ends_at, ap.id) IS NOT NULL
    AND public.slot_problem(ap.advocate_id, ap.location_id, ap.starts_at, ap.ends_at, ap.id) NOT LIKE '%temporarily held%'
  ORDER BY ap.starts_at
$$;

CREATE OR REPLACE FUNCTION public.admin_set_active(_entity text, _id uuid, _active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_directory(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can change this.'; END IF;
  IF _entity = 'advocate' THEN UPDATE advocates SET active = _active WHERE id = _id AND NOT is_deleted;
  ELSIF _entity = 'location' THEN UPDATE locations SET active = _active WHERE id = _id AND NOT is_deleted;
  ELSE RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Unknown record type.'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Record not found.'; END IF;
END $$;

-- Advocates: delete (hard when no history, soft when only past, blocked with future)
CREATE OR REPLACE FUNCTION public.admin_delete_advocate(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_directory(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can delete advocates.'; END IF;
  PERFORM 1 FROM advocates WHERE id = _id AND NOT is_deleted FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Advocate not found.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments WHERE advocate_id = _id AND starts_at > now() AND status IN ('awaiting_confirmation','confirmed')) THEN
    RAISE EXCEPTION 'HAS_FUTURE' USING HINT = 'This advocate has upcoming appointments. Reassign or cancel them first.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments WHERE advocate_id = _id) THEN
    UPDATE advocates SET is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), active = false WHERE id = _id;
    DELETE FROM booking_holds WHERE advocate_id = _id;
    RETURN 'soft';
  END IF;
  DELETE FROM booking_holds WHERE advocate_id = _id; DELETE FROM availability WHERE advocate_id = _id; DELETE FROM advocate_locations WHERE advocate_id = _id;
  DELETE FROM leaves WHERE advocate_id = _id; DELETE FROM blocked_times WHERE advocate_id = _id; DELETE FROM notifications WHERE advocate_id = _id;
  DELETE FROM advocates WHERE id = _id;
  RETURN 'hard';
END $$;

-- Reassign or cancel an affected future appointment
CREATE OR REPLACE FUNCTION public.admin_resolve_appointment(_id uuid, _action text, _target uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ap appointments; problem text;
BEGIN
  IF NOT public.is_firm_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission for this appointment.'; END IF;
  SELECT * INTO ap FROM appointments WHERE id = _id FOR UPDATE;
  IF ap.id IS NULL OR ap.status NOT IN ('awaiting_confirmation','confirmed') THEN RAISE EXCEPTION 'INVALID_STATE' USING HINT = 'This appointment can no longer be changed.'; END IF;
  IF _action = 'reassign' THEN
    PERFORM 1 FROM advocates WHERE id = _target FOR UPDATE;
    problem := public.slot_problem(_target, ap.location_id, ap.starts_at, ap.ends_at, ap.id);
    IF problem IS NOT NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT = problem; END IF;
    UPDATE appointments SET advocate_id = _target, updated_at = now() WHERE id = _id;
    INSERT INTO notifications (audience, advocate_id, appointment_id, title, body) VALUES ('advocate', _target, _id, 'Appointment reassigned ' || ap.booking_ref, 'An appointment has been reassigned to you.');
  ELSIF _action = 'cancel' THEN
    UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE id = _id;
    INSERT INTO notifications (audience, advocate_id, appointment_id, title, body) VALUES
      ('staff', ap.advocate_id, _id, 'Appointment cancelled ' || ap.booking_ref, 'An appointment was cancelled by the firm. Please inform the client.'),
      ('advocate', ap.advocate_id, _id, 'Appointment cancelled ' || ap.booking_ref, 'An appointment assigned to you was cancelled.');
  ELSE RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Unknown action.'; END IF;
  INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after) VALUES (auth.uid(), _action, 'appointments', _id::text, jsonb_build_object('advocate_id', ap.advocate_id, 'status', ap.status), jsonb_build_object('advocate_id', coalesce(_target, ap.advocate_id), 'status', CASE WHEN _action = 'cancel' THEN 'cancelled' ELSE ap.status::text END));
END $$;

-- Locations
CREATE OR REPLACE FUNCTION public.admin_save_location(_id uuid, _data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid := _id; cname text; nm text := trim(coalesce(_data->>'name','')); k text := coalesce(_data->>'kind','physical'); tz text := coalesce(_data->>'timezone','Asia/Dhaka');
BEGIN
  IF NOT public.can_manage_directory(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can manage locations.'; END IF;
  IF length(nm) < 2 OR length(nm) > 120 THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Location name is required.'; END IF;
  IF k NOT IN ('physical','virtual') THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Choose physical or virtual.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz) THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Choose a valid time zone.'; END IF;
  BEGIN
    IF _id IS NULL THEN
      INSERT INTO locations (name, kind, address, city, phone, email, timezone, active, default_hours, holidays, sort_order)
      VALUES (nm, k, CASE WHEN k = 'virtual' THEN '' ELSE left(trim(coalesce(_data->>'address','')),300) END, left(trim(coalesce(_data->>'city','')),100),
        left(trim(coalesce(_data->>'phone','')),30), left(lower(trim(coalesce(_data->>'email',''))),255), tz, coalesce((_data->>'active')::boolean,true),
        coalesce(_data->'default_hours','[]'), coalesce(ARRAY(SELECT x::date FROM jsonb_array_elements_text(coalesce(_data->'holidays','[]')) x), '{}'),
        coalesce((SELECT max(sort_order)+1 FROM locations),0))
      RETURNING id INTO new_id;
    ELSE
      UPDATE locations SET name = nm, kind = k, address = CASE WHEN k = 'virtual' THEN '' ELSE left(trim(coalesce(_data->>'address','')),300) END,
        city = left(trim(coalesce(_data->>'city','')),100), phone = left(trim(coalesce(_data->>'phone','')),30), email = left(lower(trim(coalesce(_data->>'email',''))),255),
        timezone = tz, active = coalesce((_data->>'active')::boolean,true), default_hours = coalesce(_data->'default_hours','[]'),
        holidays = coalesce(ARRAY(SELECT x::date FROM jsonb_array_elements_text(coalesce(_data->'holidays','[]')) x), '{}')
      WHERE id = _id AND NOT is_deleted;
      IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Location not found.'; END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS cname = CONSTRAINT_NAME;
    RAISE EXCEPTION 'DUPLICATE' USING HINT = public.unique_hint(cname);
  END;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_location(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_directory(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can delete locations.'; END IF;
  PERFORM 1 FROM locations WHERE id = _id AND NOT is_deleted FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Location not found.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments WHERE location_id = _id) OR EXISTS (SELECT 1 FROM advocate_locations WHERE location_id = _id) OR EXISTS (SELECT 1 FROM availability WHERE location_id = _id) THEN
    RAISE EXCEPTION 'LINKED' USING HINT = 'This location is linked to advocates or appointments, so it cannot be deleted. Deactivate it instead to hide it from public booking.'; END IF;
  DELETE FROM booking_holds WHERE location_id = _id; UPDATE blocked_times SET location_id = NULL WHERE location_id = _id;
  DELETE FROM locations WHERE id = _id;
  RETURN 'hard';
END $$;

-- Ends all refresh sessions for a user (service role only)
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE staff_profiles SET sessions_revoked_at = now() WHERE user_id = _user;
  BEGIN DELETE FROM auth.sessions WHERE user_id = _user; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;

-- Advocate photo storage policies (bucket created separately)
CREATE POLICY "Directory managers upload advocate photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'advocate-photos' AND public.can_manage_directory(auth.uid()));
CREATE POLICY "Directory managers update advocate photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'advocate-photos' AND public.can_manage_directory(auth.uid()));
CREATE POLICY "Directory managers delete advocate photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'advocate-photos' AND public.can_manage_directory(auth.uid()));
