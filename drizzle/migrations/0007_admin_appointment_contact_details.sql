ALTER TABLE public.booking_settings ALTER COLUMN contact_phone SET DEFAULT '', ALTER COLUMN contact_email SET DEFAULT '';
COMMENT ON COLUMN public.booking_settings.contact_phone IS 'Administrator-managed rescheduling and cancellation contact phone. Empty means not configured.';
COMMENT ON COLUMN public.booking_settings.contact_email IS 'Administrator-managed rescheduling and cancellation contact email. Empty means not configured.';

CREATE OR REPLACE FUNCTION public.guard_appointment_contact_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone AND NEW.contact_email IS NOT DISTINCT FROM OLD.contact_email THEN
      RETURN NEW;
    END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only an Administrator can change appointment contact details.';
  END IF;
  NEW.contact_phone := trim(coalesce(NEW.contact_phone, ''));
  NEW.contact_email := trim(coalesce(NEW.contact_email, ''));
  IF NEW.contact_phone <> '' AND (length(NEW.contact_phone) > 40 OR NEW.contact_phone !~ '^\+[0-9[:space:]().-]+$' OR length(regexp_replace(NEW.contact_phone, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15) THEN
    RAISE EXCEPTION 'INVALID_CONTACT_PHONE' USING HINT = 'Enter a valid international phone number, including the country code.';
  END IF;
  IF NEW.contact_email <> '' AND (length(NEW.contact_email) > 255 OR NEW.contact_email !~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$') THEN
    RAISE EXCEPTION 'INVALID_CONTACT_EMAIL' USING HINT = 'Enter a valid email address.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_settings_appointment_contact_guard BEFORE INSERT OR UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_contact_details();