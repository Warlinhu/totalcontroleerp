
CREATE POLICY "platform admins can view all companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins can view all company_members"
ON public.company_members FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.platform_company_overview()
RETURNS TABLE (
  id uuid,
  name text,
  document text,
  email text,
  phone text,
  created_at timestamptz,
  member_count bigint,
  owner_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.document, c.email, c.phone, c.created_at,
    (SELECT count(*) FROM public.company_members cm WHERE cm.company_id = c.id) AS member_count,
    (SELECT u.email FROM auth.users u WHERE u.id = c.created_by) AS owner_email
  FROM public.companies c
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.platform_company_overview() TO authenticated;
