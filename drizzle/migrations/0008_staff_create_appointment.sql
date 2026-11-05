CREATE OR REPLACE FUNCTION public.staff_create_appointment(
  _advocate uuid,
  _location uuid,
  _service uuid,
  _client_name text,
  _client_phone text,
  _client_email text,
  _start timestamptz,
  _mode text DEFAULT 'in_person'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  svc public.services;
  ap_id uuid;
  end_at timestamptz;
  problem text;
BEGIN
  IF NOT public.is_firm_staff(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission to create appointments.';
  END IF;
  IF btrim(_client_name) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Client name is required.';
  END IF;
  SELECT * INTO svc FROM public.services WHERE id = _service AND active = true;
  IF svc.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING HINT = 'Select an active service.';
  END IF;
  end_at := _start + make_interval(mins => svc.duration_minutes);
  problem := public.slot_problem(_advocate, _location, _start, end_at);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING HINT = problem;
  END IF;
  INSERT INTO public.appointments (
    booking_ref, advocate_id, location_id, service_id, client_name, client_phone, client_email,
    starts_at, ends_at, status, consultation_mode, consultation_fee, access_token_hash, source,
    matter_description, opposing_party
  ) VALUES (
    'APX-' || upper(substr(gen_random_uuid()::text, 1, 8)), _advocate, _location, _service,
    btrim(_client_name), coalesce(nullif(btrim(_client_phone), ''), ''), coalesce(nullif(btrim(_client_email), ''), ''),
    _start, end_at, 'awaiting_confirmation',
    CASE WHEN lower(_mode) = 'online' THEN 'online' ELSE 'in_person' END,
    svc.fee, gen_random_uuid()::text, 'staff', '', ''
  ) RETURNING id INTO ap_id;
  RETURN ap_id;
END $$;

REVOKE ALL ON FUNCTION public.staff_create_appointment(uuid,uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_create_appointment(uuid,uuid,uuid,text,text,text,timestamptz,text) TO authenticated;
