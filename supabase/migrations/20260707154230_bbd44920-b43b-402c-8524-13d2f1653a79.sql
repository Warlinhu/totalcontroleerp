
-- 1. Suspensão de empresa
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Recria política de leitura para membros excluindo empresas suspensas (admins veem sempre via política separada)
DROP POLICY IF EXISTS "members can view their companies" ON public.companies;
CREATE POLICY "members can view their companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_company_access(id, auth.uid()) AND suspended_at IS NULL);

DROP POLICY IF EXISTS "creators can view their companies" ON public.companies;
CREATE POLICY "creators can view their companies" ON public.companies
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by AND suspended_at IS NULL);

-- Funções administrativas
CREATE OR REPLACE FUNCTION public.platform_suspend_company(_company_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.companies SET suspended_at = now() WHERE id = _company_id;
END; $$;

CREATE OR REPLACE FUNCTION public.platform_unsuspend_company(_company_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.companies SET suspended_at = NULL WHERE id = _company_id;
END; $$;

CREATE OR REPLACE FUNCTION public.platform_delete_company(_company_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.companies WHERE id = _company_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.platform_suspend_company(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.platform_unsuspend_company(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.platform_delete_company(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_suspend_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_unsuspend_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_delete_company(UUID) TO authenticated;

-- Overview atualizado com suspended_at
DROP FUNCTION IF EXISTS public.platform_company_overview();
CREATE OR REPLACE FUNCTION public.platform_company_overview()
RETURNS TABLE(
  id UUID, name TEXT, document TEXT, email TEXT, phone TEXT,
  created_at TIMESTAMPTZ, suspended_at TIMESTAMPTZ,
  member_count BIGINT, owner_email TEXT, open_tickets BIGINT, open_errors BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.document, c.email, c.phone, c.created_at, c.suspended_at,
    (SELECT count(*) FROM public.company_members cm WHERE cm.company_id = c.id),
    (SELECT u.email FROM auth.users u WHERE u.id = c.created_by),
    (SELECT count(*) FROM public.support_tickets t WHERE t.company_id = c.id AND t.status NOT IN ('resolved','closed')),
    (SELECT count(*) FROM public.error_logs e WHERE e.company_id = c.id AND e.resolved_at IS NULL)
  FROM public.companies c
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY c.created_at DESC;
$$;

-- 2. Notas fiscais
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('issued','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nfe_number TEXT NOT NULL,
  nfe_series TEXT,
  access_key TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'issued',
  xml_url TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (has_company_access(company_id, auth.uid()));
CREATE POLICY "members can insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id, auth.uid()));
CREATE POLICY "members can update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (has_company_access(company_id, auth.uid())) WITH CHECK (has_company_access(company_id, auth.uid()));
CREATE POLICY "members can delete invoices" ON public.invoices
  FOR DELETE TO authenticated USING (has_company_manage(company_id, auth.uid()));

CREATE INDEX IF NOT EXISTS invoices_company_id_idx ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx ON public.invoices(issue_date DESC);

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
