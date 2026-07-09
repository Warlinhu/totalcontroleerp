
-- Enums
CREATE TYPE public.sale_payment_method AS ENUM ('dinheiro','credito','debito','pix','alimentacao','voucher','nota');
CREATE TYPE public.sale_payment_status AS ENUM ('settled','pending');
CREATE TYPE public.release_category AS ENUM ('bugfix','feature','melhoria');

-- Sales
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_company_id_sold_at_idx ON public.sales(company_id, sold_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select sales" ON public.sales FOR SELECT TO authenticated USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members update sales" ON public.sales FOR UPDATE TO authenticated USING (public.has_company_access(company_id, auth.uid())) WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_company_manage(company_id, auth.uid()));
CREATE TRIGGER sales_touch BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sale items
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_id_idx ON public.sale_items(sale_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select sale_items" ON public.sale_items FOR SELECT TO authenticated USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (public.has_company_access(company_id, auth.uid())) WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (public.has_company_access(company_id, auth.uid()));

-- Sale payments
CREATE TABLE public.sale_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  method public.sale_payment_method NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.sale_payment_status NOT NULL DEFAULT 'settled',
  debtor_installment_id UUID REFERENCES public.debtor_installments(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sale_payments_sale_id_idx ON public.sale_payments(sale_id);
CREATE INDEX sale_payments_company_status_idx ON public.sale_payments(company_id, status);
CREATE INDEX sale_payments_installment_idx ON public.sale_payments(debtor_installment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select sale_payments" ON public.sale_payments FOR SELECT TO authenticated USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members insert sale_payments" ON public.sale_payments FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members update sale_payments" ON public.sale_payments FOR UPDATE TO authenticated USING (public.has_company_access(company_id, auth.uid())) WITH CHECK (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "members delete sale_payments" ON public.sale_payments FOR DELETE TO authenticated USING (public.has_company_access(company_id, auth.uid()));

-- Trigger: when a debtor_installment goes to paid, mark corresponding sale_payments settled
CREATE OR REPLACE FUNCTION public.sync_sale_payment_on_installment_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.sale_payments
      SET status = 'settled', settled_at = COALESCE(NEW.paid_at, now())
    WHERE debtor_installment_id = NEW.id;
  ELSIF NEW.status <> 'paid' AND OLD.status = 'paid' THEN
    UPDATE public.sale_payments
      SET status = 'pending', settled_at = NULL
    WHERE debtor_installment_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER sync_sale_payment_on_installment
AFTER UPDATE OF status ON public.debtor_installments
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_on_installment_paid();

-- App releases (changelog)
CREATE TABLE public.app_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  category public.release_category NOT NULL DEFAULT 'melhoria',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_releases_published_idx ON public.app_releases(published_at DESC);
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated select releases" ON public.app_releases FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform admins insert releases" ON public.app_releases FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins update releases" ON public.app_releases FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins delete releases" ON public.app_releases FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE TRIGGER app_releases_touch BEFORE UPDATE ON public.app_releases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- User read markers
CREATE TABLE public.user_release_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  release_id UUID NOT NULL REFERENCES public.app_releases(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, release_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_release_reads TO authenticated;
GRANT ALL ON public.user_release_reads TO service_role;
ALTER TABLE public.user_release_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own release reads select" ON public.user_release_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own release reads insert" ON public.user_release_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own release reads delete" ON public.user_release_reads FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Seed initial release
INSERT INTO public.app_releases (version, title, summary, category)
VALUES ('1.4.0', 'PDV, Dashboard analítico e Assistente', 'Novo módulo de PDV com múltiplas formas de pagamento (incluindo Nota / fiado), dashboard com gráficos configuráveis (rosquinha, barras, linha), ticket médio, horário de maior movimento e assistente integrado para consultas rápidas ao seu negócio.', 'feature');
