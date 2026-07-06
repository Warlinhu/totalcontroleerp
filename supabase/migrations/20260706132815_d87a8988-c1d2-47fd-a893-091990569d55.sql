CREATE OR REPLACE FUNCTION public.accept_company_invite(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.company_invites%ROWTYPE;
  current_user_id UUID := auth.uid();
  current_user_email TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO current_user_email
  FROM auth.users
  WHERE id = current_user_id;

  SELECT * INTO invite_row
  FROM public.company_invites
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  IF lower(invite_row.email) <> lower(coalesce(current_user_email, '')) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  IF invite_row.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_used';
  END IF;

  IF invite_row.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (invite_row.company_id, current_user_id, invite_row.role)
  ON CONFLICT (company_id, user_id) DO NOTHING;

  UPDATE public.company_invites
  SET accepted_at = now()
  WHERE id = invite_row.id;

  RETURN invite_row.company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_company_invite(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_company_invite(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(TEXT) TO authenticated;