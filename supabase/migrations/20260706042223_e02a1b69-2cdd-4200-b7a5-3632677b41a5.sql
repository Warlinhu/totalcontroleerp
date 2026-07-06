
-- Revoke default PUBLIC/anon EXECUTE on all SECURITY DEFINER functions,
-- then grant EXECUTE only to the roles that legitimately need it.

-- Helpers used inside RLS policies: needed by authenticated (RLS runs as caller role)
REVOKE ALL ON FUNCTION public.has_company_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_company_manage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_manage(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_company_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_role(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

-- Trigger-only functions: no direct EXECUTE needed by any client role
REVOKE ALL ON FUNCTION public.handle_new_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Platform admin RPCs: only signed-in users; functions self-check admin status
REVOKE ALL ON FUNCTION public.platform_company_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_company_overview() TO authenticated;

REVOKE ALL ON FUNCTION public.platform_ticket_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_ticket_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.list_platform_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_platform_admins() TO authenticated;

REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.grant_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_platform_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_platform_admin(uuid) TO authenticated;
