ALTER TABLE public.appointments ADD COLUMN consultation_mode text CHECK (consultation_mode IN ('online','in_person','phone')), ADD COLUMN consultation_fee numeric;
ALTER TABLE public.booking_holds ADD COLUMN consultation_mode text CHECK (consultation_mode IN ('online','in_person','phone')), ADD COLUMN explicit_advocate_id uuid REFERENCES public.advocates(id), ADD COLUMN simplified_booking boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.appointments.consultation_fee IS 'Fee snapshot from the active consultation service at booking confirmation; NULL means not configured.';

CREATE OR REPLACE FUNCTION public.booking_day_slots(_location uuid, _service uuid, _advocate uuid, _date date, _zone text)
RETURNS TABLE(starts_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH settings AS (SELECT * FROM booking_settings WHERE id=1 AND accept_online_bookings), loc AS (SELECT timezone FROM locations WHERE id=_location AND active AND NOT is_deleted), svc AS (SELECT duration_minutes FROM services WHERE id=_service AND active), days AS (SELECT ((_date::timestamp AT TIME ZONE _zone) AT TIME ZONE loc.timezone)::date+n AS day FROM loc,generate_series(-1,2) n)
 SELECT DISTINCT sl.starts_at FROM advocates a JOIN advocate_locations al ON al.advocate_id=a.id AND al.location_id=_location CROSS JOIN days CROSS JOIN svc CROSS JOIN settings CROSS JOIN LATERAL public.available_slots(a.id,_location,days.day,svc.duration_minutes) sl WHERE a.active AND NOT a.is_deleted AND a.deleted_at IS NULL AND (_advocate IS NULL OR a.id=_advocate) AND (sl.starts_at AT TIME ZONE _zone)::date=_date ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.booking_day_slots(uuid,uuid,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_day_slots(uuid,uuid,uuid,date,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.acquire_booking_hold(_client_key text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_previous_token text DEFAULT NULL)
RETURNS TABLE(ok boolean,token text,advocate_id uuid,expires_at timestamptz,message text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s booking_settings; dur int; a record; tok text; expiry timestamptz; hits_now int; chosen uuid;
BEGIN
 SELECT * INTO s FROM booking_settings WHERE id=1;
 IF s.id IS NULL OR NOT s.accept_online_bookings THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Online booking is temporarily unavailable. Please contact us.'; RETURN; END IF;
 INSERT INTO request_limits(key,window_start,hits) VALUES('hold:'||_client_key,date_trunc('hour',now()),1) ON CONFLICT(key,window_start) DO UPDATE SET hits=request_limits.hits+1 RETURNING hits INTO hits_now;
 IF hits_now>60 THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Too many time selections. Please try again later.'; RETURN; END IF;
 SELECT duration_minutes INTO dur FROM services WHERE id=_service AND active;
 IF dur IS NULL OR _start IS NULL THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,'Choose a valid consultation and time.'; RETURN; END IF;
 -- Deterministic locks are shared by holds and confirmation.
 PERFORM av.id FROM advocates av JOIN advocate_locations al ON al.advocate_id=av.id AND al.location_id=_location WHERE av.active AND NOT av.is_deleted AND av.deleted_at IS NULL ORDER BY av.id FOR UPDATE OF av;
 FOR a IN SELECT av.id FROM advocates av JOIN advocate_locations al ON al.advocate_id=av.id AND al.location_id=_location WHERE av.active AND NOT av.is_deleted AND av.deleted_at IS NULL AND (_advocate IS NULL OR av.id=_advocate) ORDER BY av.id LOOP
  DELETE FROM booking_holds h WHERE h.advocate_id=a.id AND (h.expires_at<=now() OR h.token_hash=encode(digest(coalesce(_previous_token,''),'sha256'),'hex'));
  IF EXISTS(SELECT 1 FROM public.available_slots(a.id,_location,(_start AT TIME ZONE (SELECT timezone FROM locations WHERE id=_location))::date,dur) sl WHERE sl.starts_at=_start) THEN chosen:=a.id; EXIT; END IF;
 END LOOP;
 IF chosen IS NULL THEN RETURN QUERY SELECT false,NULL::text,NULL::uuid,NULL::timestamptz,CASE WHEN _advocate IS NULL THEN 'That time was just taken. Please choose another time.' ELSE 'Your selected advocate is no longer available. Choose another time, another available advocate, or automatic assignment.' END; RETURN; END IF;
 tok:=encode(gen_random_bytes(32),'hex'); expiry:=now()+make_interval(mins=>s.slot_hold_minutes);
 INSERT INTO booking_holds(token_hash,advocate_id,location_id,service_id,starts_at,ends_at,expires_at) VALUES(encode(digest(tok,'sha256'),'hex'),chosen,_location,_service,_start,_start+make_interval(mins=>dur),expiry);
 DELETE FROM booking_holds h WHERE h.token_hash=encode(digest(coalesce(_previous_token,''),'sha256'),'hex');
 RETURN QUERY SELECT true,tok,chosen,expiry,NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.acquire_booking_hold(text,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_booking_hold(text,uuid,uuid,uuid,timestamptz,text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_public_booking(_client_key text,_name text,_phone text,_email text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_opposing text,_matter text,_consent boolean)
RETURNS TABLE(booking_ref text,access_token text,appointment_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s booking_settings; dur int; problem text; tok text; ref text; new_id uuid; hits_now int; adv_name text; em text:=lower(trim(coalesce(_email,'')));
BEGIN
 SELECT * INTO s FROM booking_settings WHERE id=1;
 IF s.id IS NULL OR NOT s.accept_online_bookings THEN RAISE EXCEPTION 'BOOKING_CLOSED' USING HINT='Online booking is temporarily unavailable. Please contact us.'; END IF;
 INSERT INTO request_limits(key,window_start,hits) VALUES(_client_key,date_trunc('hour',now()),1) ON CONFLICT(key,window_start) DO UPDATE SET hits=request_limits.hits+1 RETURNING hits INTO hits_now;
 DELETE FROM request_limits WHERE window_start<now()-interval '1 day';
 IF hits_now>5 THEN RAISE EXCEPTION 'RATE_LIMITED' USING HINT='Too many booking requests. Please try again later or contact us.'; END IF;
 IF _name IS NULL OR length(trim(_name))<2 OR length(_name)>100 OR (em<>'' AND em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') OR length(em)>255 OR _phone IS NULL OR _phone !~ '^\+[1-9][\d ()-]{6,20}$' OR _consent IS DISTINCT FROM true OR length(coalesce(_opposing,''))>200 OR length(coalesce(_matter,''))>2000 THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT='Please check your details and try again.'; END IF;
 SELECT duration_minutes INTO dur FROM services WHERE id=_service AND active;
 IF dur IS NULL OR _start IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT='Please choose a valid consultation and time.'; END IF;
 IF _start<now()+make_interval(hours=>s.min_notice_hours) OR _start>=now()+make_interval(days=>s.max_advance_days+1) THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT='Please choose a future date within the booking window.'; END IF;
 PERFORM 1 FROM advocates WHERE id=_advocate FOR UPDATE;
 problem:=public.slot_problem(_advocate,_location,_start,_start+make_interval(mins=>dur));
 IF problem IS NOT NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT=problem; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.available_slots(_advocate,_location,(_start AT TIME ZONE (SELECT timezone FROM locations WHERE id=_location))::date,dur) sl WHERE sl.starts_at=_start) THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='That time is no longer available. Please choose another time.'; END IF;
 tok:=encode(gen_random_bytes(32),'hex'); ref:='APX-'||to_char(now(),'YYYY')||'-'||lpad(nextval('booking_ref_seq')::text,6,'0');
 BEGIN
 INSERT INTO appointments(booking_ref,advocate_id,location_id,service_id,client_name,client_phone,client_email,opposing_party,matter_description,starts_at,ends_at,access_token_hash,consent_at) VALUES(ref,_advocate,_location,_service,trim(_name),trim(_phone),em,coalesce(trim(_opposing),''),coalesce(trim(_matter),''),_start,_start+make_interval(mins=>dur),encode(digest(tok,'sha256'),'hex'),now()) RETURNING id INTO new_id;
 EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='That time slot was just taken. Please choose another time.'; END;
 SELECT name INTO adv_name FROM advocates WHERE id=_advocate;
 INSERT INTO notifications(audience,advocate_id,appointment_id,title,body) VALUES('staff',_advocate,new_id,'New booking request '||ref,'A new consultation request for '||adv_name||' is awaiting confirmation.'),('advocate',_advocate,new_id,'New booking request '||ref,'A new consultation request assigned to you is awaiting confirmation.');
 RETURN QUERY SELECT ref,tok,new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_public_booking(text,text,text,text,uuid,uuid,uuid,timestamptz,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text,text,text,text,uuid,uuid,uuid,timestamptz,text,text,boolean) TO service_role;

CREATE FUNCTION public.acquire_appointment_hold(_client_key text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_mode text,_previous_token text DEFAULT NULL)
RETURNS TABLE(ok boolean,token text,expires_at timestamptz,message text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r record;
BEGIN
 IF _mode IS NULL OR _mode NOT IN ('online','in_person','phone') OR NOT EXISTS(SELECT 1 FROM locations l WHERE l.id=_location AND l.active AND NOT l.is_deleted AND (_mode<>'online' OR l.kind='virtual') AND (_mode<>'in_person' OR l.kind='physical')) THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT='Choose an available consultation mode and location.'; END IF;
 SELECT * INTO r FROM public.acquire_booking_hold(_client_key,_location,_service,_advocate,_start,_previous_token);
 IF r.ok THEN UPDATE booking_holds SET consultation_mode=_mode,explicit_advocate_id=_advocate,simplified_booking=true WHERE token_hash=encode(digest(r.token,'sha256'),'hex'); END IF;
 -- Capacity is reserved privately; automatic advocate assignment is finalized only on submit.
 RETURN QUERY SELECT r.ok,r.token,r.expires_at,r.message;
END $$;
REVOKE ALL ON FUNCTION public.acquire_appointment_hold(text,uuid,uuid,uuid,timestamptz,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_appointment_hold(text,uuid,uuid,uuid,timestamptz,text,text) TO service_role;

CREATE FUNCTION public.submit_appointment_booking(_hold_token text,_client_key text,_name text,_phone text,_email text,_location uuid,_service uuid,_advocate uuid,_start timestamptz,_mode text,_consent boolean)
RETURNS TABLE(booking_ref text,access_token text,appointment_id uuid,assigned_advocate_id uuid,consultation_fee numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE h booking_holds; a record; chosen uuid; dur int; fee numeric; r record;
BEGIN
 -- All eligible rows are locked in the same order as hold acquisition.
 PERFORM av.id FROM advocates av JOIN advocate_locations al ON al.advocate_id=av.id AND al.location_id=_location ORDER BY av.id FOR UPDATE OF av;
 SELECT * INTO h FROM booking_holds WHERE token_hash=encode(digest(_hold_token,'sha256'),'hex') FOR UPDATE;
 IF h.id IS NULL OR h.expires_at<=now() OR NOT h.simplified_booking OR h.explicit_advocate_id IS DISTINCT FROM _advocate OR h.location_id IS DISTINCT FROM _location OR h.service_id IS DISTINCT FROM _service OR h.starts_at IS DISTINCT FROM _start OR h.consultation_mode IS DISTINCT FROM _mode THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='Your time selection has changed or expired. Please select a time again.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM locations l WHERE l.id=_location AND l.active AND NOT l.is_deleted AND (_mode<>'online' OR l.kind='virtual') AND (_mode<>'in_person' OR l.kind='physical')) THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT='This consultation location is no longer available.'; END IF;
 SELECT s.duration_minutes,s.fee INTO dur,fee FROM services s WHERE s.id=_service AND s.active FOR SHARE;
 IF dur IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING HINT='This consultation is no longer available.'; END IF;
 DELETE FROM booking_holds WHERE id=h.id;
 FOR a IN SELECT av.id FROM advocates av JOIN advocate_locations al ON al.advocate_id=av.id AND al.location_id=_location WHERE av.active AND NOT av.is_deleted AND av.deleted_at IS NULL AND (_advocate IS NULL OR av.id=_advocate) ORDER BY av.id LOOP
 IF EXISTS(SELECT 1 FROM public.available_slots(a.id,_location,(_start AT TIME ZONE (SELECT timezone FROM locations WHERE id=_location))::date,dur) sl WHERE sl.starts_at=_start) THEN chosen:=a.id; EXIT; END IF;
 END LOOP;
 IF chosen IS NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT=CASE WHEN _advocate IS NULL THEN 'No advocate is available at that time. Please choose another time.' ELSE 'Your selected advocate is no longer available. Choose another time, another available advocate, or automatic assignment.' END; END IF;
 SELECT * INTO r FROM public.create_public_booking(_client_key,_name,_phone,_email,_location,_service,chosen,_start,'','',_consent);
 UPDATE appointments SET consultation_mode=_mode,consultation_fee=fee WHERE id=r.appointment_id;
 RETURN QUERY SELECT r.booking_ref,r.access_token,r.appointment_id,chosen,fee;
END $$;
REVOKE ALL ON FUNCTION public.submit_appointment_booking(text,text,text,text,text,uuid,uuid,uuid,timestamptz,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_appointment_booking(text,text,text,text,text,uuid,uuid,uuid,timestamptz,text,boolean) TO service_role;

CREATE FUNCTION public.booking_advocate_options(_location uuid,_service uuid,_month date,_date date,_start timestamptz,_zone text,_hold_token text DEFAULT NULL)
RETURNS TABLE(advocate_id uuid,slot_count integer,first_slot timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
 WITH days AS (SELECT d::date AS day FROM generate_series(COALESCE(_date,date_trunc('month',_month::timestamp)::date)::timestamp,COALESCE(_date,(date_trunc('month',_month::timestamp)+interval '1 month - 1 day')::date)::timestamp,interval '1 day') d), candidates AS (SELECT a.id FROM advocates a JOIN advocate_locations al ON al.advocate_id=a.id WHERE al.location_id=_location AND a.active AND NOT a.is_deleted AND a.deleted_at IS NULL), slots AS (
 SELECT c.id,sl.starts_at FROM candidates c CROSS JOIN days CROSS JOIN LATERAL public.booking_day_slots(_location,_service,c.id,days.day,_zone) sl WHERE _start IS NULL OR sl.starts_at=_start
 UNION SELECT h.advocate_id,h.starts_at FROM booking_holds h JOIN candidates c ON c.id=h.advocate_id JOIN locations l ON l.id=h.location_id AND l.active AND NOT l.is_deleted WHERE h.token_hash=encode(digest(coalesce(_hold_token,''),'sha256'),'hex') AND h.expires_at>now() AND h.location_id=_location AND h.service_id=_service AND (_date IS NULL OR (h.starts_at AT TIME ZONE _zone)::date=_date) AND (_start IS NULL OR h.starts_at=_start)
 ) SELECT slots.id,count(*)::integer,min(slots.starts_at) FROM slots GROUP BY slots.id ORDER BY slots.id;
$$;
REVOKE ALL ON FUNCTION public.booking_advocate_options(uuid,uuid,date,date,timestamptz,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_advocate_options(uuid,uuid,date,date,timestamptz,text,text) TO anon,authenticated,service_role;

CREATE FUNCTION public.appointment_details_by_token(_token text)
RETURNS TABLE(booking_ref text,client_name text,advocate_name text,advocate_photo_url text,location_name text,location_address text,location_kind text,timezone text,service_name text,starts_at timestamptz,ends_at timestamptz,status public.appointment_status,consultation_mode text,consultation_fee numeric,contact_phone text,contact_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
 SELECT ap.booking_ref,ap.client_name,a.name,a.photo_url,l.name,l.address,l.kind,l.timezone,sv.name,ap.starts_at,ap.ends_at,ap.status,coalesce(ap.consultation_mode,CASE WHEN l.kind='virtual' THEN 'online' ELSE 'in_person' END),ap.consultation_fee,bs.contact_phone,bs.contact_email FROM appointments ap JOIN advocates a ON a.id=ap.advocate_id JOIN locations l ON l.id=ap.location_id JOIN services sv ON sv.id=ap.service_id CROSS JOIN booking_settings bs WHERE bs.id=1 AND length(_token)=64 AND ap.access_token_hash=encode(digest(_token,'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION public.appointment_details_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.appointment_details_by_token(text) TO anon,authenticated,service_role;