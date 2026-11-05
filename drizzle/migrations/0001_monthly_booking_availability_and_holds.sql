ALTER TABLE public.booking_settings ADD COLUMN slot_hold_minutes integer NOT NULL DEFAULT 5 CHECK (slot_hold_minutes BETWEEN 1 AND 30), ADD COLUMN time_format text NOT NULL DEFAULT '12' CHECK (time_format IN ('12','24')), ADD COLUMN allow_timezone_change boolean NOT NULL DEFAULT true, ADD COLUMN show_first_available boolean NOT NULL DEFAULT true;
CREATE TABLE public.booking_holds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, advocate_id uuid NOT NULL REFERENCES public.advocates(id), location_id uuid NOT NULL REFERENCES public.locations(id), service_id uuid NOT NULL REFERENCES public.services(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, CHECK (ends_at > starts_at));
GRANT ALL ON public.booking_holds TO service_role;
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
CREATE INDEX booking_holds_advocate_idx ON public.booking_holds(advocate_id, expires_at);
CREATE OR REPLACE FUNCTION public.slot_problem(_advocate uuid, _location uuid, _start timestamptz, _end timestamptz, _exclude uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tz text; buf int; local_start timestamp; local_end timestamp;
BEGIN
  SELECT l.timezone INTO tz FROM locations l WHERE l.id = _location AND l.active;
  IF tz IS NULL THEN RETURN 'That location is not available.'; END IF;
  SELECT a.buffer_minutes INTO buf FROM advocates a JOIN advocate_locations al ON al.advocate_id = a.id AND al.location_id = _location WHERE a.id = _advocate AND a.active AND a.deleted_at IS NULL;
  IF buf IS NULL THEN RETURN 'That advocate is not available at this location.'; END IF;
  local_start := _start AT TIME ZONE tz; local_end := _end AT TIME ZONE tz;
  IF local_start::date <> (local_end - interval '1 second')::date THEN RETURN 'Appointments must start and end on the same day.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM availability av WHERE av.advocate_id = _advocate AND av.location_id = _location AND av.weekday = extract(dow FROM local_start)::int AND av.start_time <= local_start::time AND av.end_time >= local_end::time) THEN RETURN 'That time is outside the advocate''s working hours.'; END IF;
  IF EXISTS (SELECT 1 FROM leaves lv WHERE lv.advocate_id = _advocate AND local_start::date BETWEEN lv.start_date AND lv.end_date) THEN RETURN 'The advocate is on leave that day.'; END IF;
  IF EXISTS (SELECT 1 FROM blocked_times b WHERE b.advocate_id = _advocate AND tstzrange(b.starts_at,b.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'The advocate has another commitment at that time.'; END IF;
  IF EXISTS (SELECT 1 FROM appointments ap WHERE ap.advocate_id = _advocate AND ap.id IS DISTINCT FROM _exclude AND ap.status IN ('awaiting_confirmation','confirmed','completed') AND tstzrange(ap.starts_at,ap.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'That time slot was just taken. Please choose another time.'; END IF;
  IF EXISTS (SELECT 1 FROM booking_holds h WHERE h.advocate_id = _advocate AND h.expires_at > now() AND tstzrange(h.starts_at,h.ends_at) && tstzrange(_start - make_interval(mins => buf),_end + make_interval(mins => buf))) THEN RETURN 'That time is temporarily held. Please choose another time.'; END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.booking_day_slots(_location uuid, _service uuid, _advocate uuid, _date date, _zone text)
RETURNS TABLE(starts_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH settings AS (SELECT * FROM booking_settings WHERE id=1 AND accept_online_bookings AND (_advocate IS NOT NULL OR show_first_available)), loc AS (SELECT timezone FROM locations WHERE id=_location AND active), svc AS (SELECT duration_minutes FROM services WHERE id=_service AND active), days AS (SELECT ((_date::timestamp AT TIME ZONE _zone) AT TIME ZONE loc.timezone)::date + n AS day FROM loc, generate_series(-1,2) n)
  SELECT DISTINCT sl.starts_at FROM advocates a JOIN advocate_locations al ON al.advocate_id=a.id AND al.location_id=_location CROSS JOIN days CROSS JOIN svc CROSS JOIN settings CROSS JOIN LATERAL public.available_slots(a.id,_location,days.day,svc.duration_minutes) sl WHERE a.active AND a.deleted_at IS NULL AND (_advocate IS NULL OR a.id=_advocate) AND (sl.starts_at AT TIME ZONE _zone)::date=_date ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.booking_day_slots(uuid,uuid,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_day_slots(uuid,uuid,uuid,date,text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.booking_month_availability(_location uuid, _service uuid, _advocate uuid, _month date, _zone text)
RETURNS TABLE(date date, slot_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.day::date, count(sl.starts_at)::integer FROM generate_series(date_trunc('month',_month::timestamp),date_trunc('month',_month::timestamp)+interval '1 month - 1 day',interval '1 day') d(day) CROSS JOIN LATERAL public.booking_day_slots(_location,_service,_advocate,d.day::date,_zone) sl GROUP BY d.day ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.booking_month_availability(uuid,uuid,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_month_availability(uuid,uuid,uuid,date,text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.acquire_booking_hold(_client_key text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_previous_token text DEFAULT NULL)
RETURNS TABLE(ok boolean,token text,advocate_id uuid,expires_at timestamptz,message text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s booking_settings; dur int; a record; tok text; expiry timestamptz; hits_now int; chosen uuid;
BEGIN
 SELECT * INTO s FROM booking_settings WHERE id=1;
 IF NOT s.accept_online_bookings THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Online booking is temporarily unavailable. Please contact us.'; RETURN; END IF;
 INSERT INTO request_limits(key,window_start,hits) VALUES ('hold:'||_client_key,date_trunc('hour',now()),1) ON CONFLICT(key,window_start) DO UPDATE SET hits=request_limits.hits+1 RETURNING hits INTO hits_now;
 IF hits_now>60 THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Too many time selections. Please try again later.'; RETURN; END IF;
 IF _advocate IS NULL AND NOT s.show_first_available THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Please choose an advocate.'; RETURN; END IF;
 SELECT duration_minutes INTO dur FROM services WHERE id=_service AND active;
 IF dur IS NULL OR _start IS NULL THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Choose a valid service and time.'; RETURN; END IF;
 -- All writers serialize on the advocate row, including staff appointment changes.
 FOR a IN SELECT av.id FROM advocates av JOIN advocate_locations al ON al.advocate_id=av.id AND al.location_id=_location WHERE av.active AND av.deleted_at IS NULL AND (_advocate IS NULL OR av.id=_advocate) ORDER BY av.id FOR UPDATE OF av LOOP
   DELETE FROM booking_holds h WHERE h.advocate_id=a.id AND (h.expires_at<=now() OR h.token_hash=encode(digest(coalesce(_previous_token,''),'sha256'),'hex'));
   IF EXISTS(SELECT 1 FROM public.available_slots(a.id,_location,(_start AT TIME ZONE (SELECT timezone FROM locations WHERE id=_location))::date,dur) sl WHERE sl.starts_at=_start) THEN chosen:=a.id; EXIT; END IF;
 END LOOP;
 IF chosen IS NULL THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'That time was just taken. Please choose another time.'; RETURN; END IF;
 tok:=encode(gen_random_bytes(32),'hex'); expiry:=now()+make_interval(mins=>s.slot_hold_minutes);
 INSERT INTO booking_holds(token_hash,advocate_id,location_id,service_id,starts_at,ends_at,expires_at) VALUES(encode(digest(tok,'sha256'),'hex'),chosen,_location,_service,_start,_start+make_interval(mins=>dur),expiry);
 -- Release a previous selection at another advocate only after the new hold succeeds.
 DELETE FROM booking_holds h WHERE h.token_hash=encode(digest(coalesce(_previous_token,''),'sha256'),'hex');
 RETURN QUERY SELECT true,tok,chosen,expiry,NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.acquire_booking_hold(text,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_booking_hold(text,uuid,uuid,uuid,timestamptz,text) TO service_role;
CREATE OR REPLACE FUNCTION public.submit_held_booking(_hold_token text,_client_key text,_name text,_phone text,_email text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_opposing text,_matter text,_consent boolean)
RETURNS TABLE(booking_ref text,access_token text,appointment_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE h booking_holds;
BEGIN
 PERFORM 1 FROM advocates WHERE id=_advocate FOR UPDATE;
 SELECT * INTO h FROM booking_holds WHERE token_hash=encode(digest(_hold_token,'sha256'),'hex') FOR UPDATE;
 IF h.id IS NULL OR h.expires_at<=now() OR h.advocate_id IS DISTINCT FROM _advocate OR h.location_id IS DISTINCT FROM _location OR h.service_id IS DISTINCT FROM _service OR h.starts_at IS DISTINCT FROM _start THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='Your time hold has expired. Please select a time again.'; END IF;
 DELETE FROM booking_holds WHERE id=h.id;
 RETURN QUERY SELECT * FROM public.create_public_booking(_client_key,_name,_phone,_email,_location,_service,_advocate,_start,_opposing,_matter,_consent);
END $$;
REVOKE ALL ON FUNCTION public.submit_held_booking(text,text,text,text,text,uuid,uuid,uuid,timestamptz,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_held_booking(text,text,text,text,text,uuid,uuid,uuid,timestamptz,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_appointment_holds() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE buf integer;
BEGIN
 IF NEW.status IN ('awaiting_confirmation','confirmed','completed') THEN
  PERFORM 1 FROM advocates WHERE id=NEW.advocate_id FOR UPDATE;
  SELECT buffer_minutes INTO buf FROM advocates WHERE id=NEW.advocate_id;
  IF EXISTS(SELECT 1 FROM booking_holds h WHERE h.advocate_id=NEW.advocate_id AND h.expires_at>now() AND tstzrange(h.starts_at,h.ends_at) && tstzrange(NEW.starts_at-make_interval(mins=>buf),NEW.ends_at+make_interval(mins=>buf))) THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='That time is temporarily held. Please choose another time.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER appointments_guard_holds BEFORE INSERT OR UPDATE OF starts_at,ends_at,status,advocate_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_holds();