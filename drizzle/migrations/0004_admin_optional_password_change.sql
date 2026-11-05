CREATE OR REPLACE FUNCTION public.staff_account_ok(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.staff_profiles p WHERE p.user_id = _user_id AND (
    p.status <> 'active' OR p.is_deleted OR
    (p.must_change_password AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = 'admin')) OR
    (_user_id = auth.uid() AND p.sessions_revoked_at IS NOT NULL AND coalesce((auth.jwt()->>'iat')::bigint, 0) < floor(extract(epoch FROM p.sessions_revoked_at)))))
$$;