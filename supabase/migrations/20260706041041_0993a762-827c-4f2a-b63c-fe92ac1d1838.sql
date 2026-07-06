
DROP FUNCTION IF EXISTS public.platform_company_overview();

CREATE TYPE public.ticket_type AS ENUM ('bug', 'feature', 'change', 'question');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ticket_type NOT NULL DEFAULT 'question',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  module TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "st_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "st_insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "st_update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_company_manage(company_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "st_delete" ON public.support_tickets FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_st_company ON public.support_tickets(company_id);
CREATE INDEX idx_st_status ON public.support_tickets(status);
CREATE INDEX idx_st_created ON public.support_tickets(created_at DESC);

CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stm_select" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (public.has_company_access(t.company_id, auth.uid()) OR public.is_platform_admin(auth.uid()))));
CREATE POLICY "stm_insert" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (public.has_company_access(t.company_id, auth.uid()) OR public.is_platform_admin(auth.uid()))));
CREATE POLICY "stm_delete" ON public.support_ticket_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE INDEX idx_stm_ticket ON public.support_ticket_messages(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.platform_ticket_stats()
RETURNS TABLE (total BIGINT, open_count BIGINT, in_progress_count BIGINT, waiting_customer_count BIGINT, resolved_count BIGINT, critical_open BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::BIGINT,
    count(*) FILTER (WHERE status = 'open')::BIGINT,
    count(*) FILTER (WHERE status = 'in_progress')::BIGINT,
    count(*) FILTER (WHERE status = 'waiting_customer')::BIGINT,
    count(*) FILTER (WHERE status = 'resolved')::BIGINT,
    count(*) FILTER (WHERE status = 'open' AND priority = 'critical')::BIGINT
  FROM public.support_tickets
  WHERE public.is_platform_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.grant_platform_admin(_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.platform_admins(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_platform_admin(_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot revoke self'; END IF;
  DELETE FROM public.platform_admins WHERE user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.platform_company_overview()
RETURNS TABLE (id UUID, name TEXT, document TEXT, email TEXT, phone TEXT,
  created_at TIMESTAMPTZ, member_count BIGINT, owner_email TEXT,
  open_tickets BIGINT, open_errors BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.document, c.email, c.phone, c.created_at,
    (SELECT count(*) FROM public.company_members cm WHERE cm.company_id = c.id),
    (SELECT u.email FROM auth.users u WHERE u.id = c.created_by),
    (SELECT count(*) FROM public.support_tickets t WHERE t.company_id = c.id AND t.status NOT IN ('resolved','closed')),
    (SELECT count(*) FROM public.error_logs e WHERE e.company_id = c.id AND e.resolved_at IS NULL)
  FROM public.companies c
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.list_platform_admins()
RETURNS TABLE (user_id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pa.user_id, u.email, u.created_at
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY u.created_at;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_email(_email TEXT)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email FROM auth.users u
  WHERE public.is_platform_admin(auth.uid()) AND lower(u.email) = lower(_email)
  LIMIT 1;
$$;
