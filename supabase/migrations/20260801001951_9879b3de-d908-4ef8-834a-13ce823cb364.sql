DROP POLICY "members can view invites of their companies" ON public.company_invites;
CREATE POLICY "managers can view invites of their companies"
ON public.company_invites FOR SELECT TO authenticated
USING (public.has_company_manage(company_id, auth.uid()));