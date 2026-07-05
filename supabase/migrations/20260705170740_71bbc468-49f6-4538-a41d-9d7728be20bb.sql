
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'employee');
CREATE TYPE public.product_kind AS ENUM ('product', 'service');
CREATE TYPE public.installment_status AS ENUM ('pending', 'paid', 'overdue', 'canceled');
CREATE TYPE public.error_severity AS ENUM ('info', 'warning', 'error', 'critical');

-- =========================
-- COMPANIES
-- =========================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.company_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.company_role NOT NULL DEFAULT 'employee',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- =========================
-- PLATFORM ADMINS (separate from company roles)
-- =========================
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- =========================
-- SECURITY DEFINER HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(_company_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_company_role(_company_id UUID, _user_id UUID)
RETURNS public.company_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.company_members
  WHERE company_id = _company_id AND user_id = _user_id
  LIMIT 1;
$$;

-- true if user has at least admin-level rights (owner or admin)
CREATE OR REPLACE FUNCTION public.has_company_manage(_company_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id AND user_id = _user_id
      AND role IN ('owner','admin')
  );
$$;

-- =========================
-- COMPANY POLICIES
-- =========================
CREATE POLICY "members can view their companies" ON public.companies
  FOR SELECT TO authenticated
  USING (public.has_company_access(id, auth.uid()));

CREATE POLICY "authenticated users can create companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owners and admins can update their company" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_company_manage(id, auth.uid()))
  WITH CHECK (public.has_company_manage(id, auth.uid()));

CREATE POLICY "owners can delete their company" ON public.companies
  FOR DELETE TO authenticated
  USING (public.get_company_role(id, auth.uid()) = 'owner');

-- COMPANY_MEMBERS policies
CREATE POLICY "members can view members of their companies" ON public.company_members
  FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));

CREATE POLICY "owners and admins can add members" ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));

CREATE POLICY "owners and admins can update members" ON public.company_members
  FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));

CREATE POLICY "owners and admins can remove members" ON public.company_members
  FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- COMPANY_INVITES policies
CREATE POLICY "members can view invites of their companies" ON public.company_invites
  FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));

CREATE POLICY "owners and admins can create invites" ON public.company_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "owners and admins can update invites" ON public.company_invites
  FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));

CREATE POLICY "owners and admins can delete invites" ON public.company_invites
  FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- PLATFORM_ADMINS policies
CREATE POLICY "platform admins can view the list" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- =========================
-- AUTO: creator becomes owner
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.product_kind NOT NULL DEFAULT 'product',
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock NUMERIC(14,3),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.products (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read products" ON public.products FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update products" ON public.products FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete products" ON public.products FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- CUSTOMERS
-- =========================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customers (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- SUPPLIERS
-- =========================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.suppliers (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert suppliers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update suppliers" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- EMPLOYEES (HR records, not system users)
-- =========================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  salary NUMERIC(14,2),
  hired_at DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.employees (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read employees" ON public.employees FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert employees" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update employees" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete employees" ON public.employees FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- DEBTORS + INSTALLMENTS
-- =========================
CREATE TABLE public.debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  document TEXT,
  description TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.debtors (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debtors TO authenticated;
GRANT ALL ON public.debtors TO service_role;
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_debtors_updated BEFORE UPDATE ON public.debtors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read debtors" ON public.debtors FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert debtors" ON public.debtors FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update debtors" ON public.debtors FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete debtors" ON public.debtors FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

CREATE TABLE public.debtor_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sequence INT NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.debtor_installments (company_id, due_date);
CREATE INDEX ON public.debtor_installments (debtor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debtor_installments TO authenticated;
GRANT ALL ON public.debtor_installments TO service_role;
ALTER TABLE public.debtor_installments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_debtor_inst_updated BEFORE UPDATE ON public.debtor_installments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read debtor installments" ON public.debtor_installments FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert debtor installments" ON public.debtor_installments FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update debtor installments" ON public.debtor_installments FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete debtor installments" ON public.debtor_installments FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- PAYABLES + INSTALLMENTS
-- =========================
CREATE TABLE public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payables (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payables_updated BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read payables" ON public.payables FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert payables" ON public.payables FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update payables" ON public.payables FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete payables" ON public.payables FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

CREATE TABLE public.payable_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sequence INT NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payable_installments (company_id, due_date);
CREATE INDEX ON public.payable_installments (payable_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payable_installments TO authenticated;
GRANT ALL ON public.payable_installments TO service_role;
ALTER TABLE public.payable_installments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pay_inst_updated BEFORE UPDATE ON public.payable_installments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "members read payable installments" ON public.payable_installments FOR SELECT TO authenticated
  USING (public.has_company_access(company_id, auth.uid()));
CREATE POLICY "managers insert payable installments" ON public.payable_installments FOR INSERT TO authenticated
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers update payable installments" ON public.payable_installments FOR UPDATE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()))
  WITH CHECK (public.has_company_manage(company_id, auth.uid()));
CREATE POLICY "managers delete payable installments" ON public.payable_installments FOR DELETE TO authenticated
  USING (public.has_company_manage(company_id, auth.uid()));

-- =========================
-- ERROR LOGS (platform monitoring)
-- =========================
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'client', -- 'client' | 'server'
  severity public.error_severity NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  route TEXT,
  user_agent TEXT,
  fingerprint TEXT NOT NULL,
  context JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.error_logs (created_at DESC);
CREATE INDEX ON public.error_logs (fingerprint);
CREATE INDEX ON public.error_logs (severity);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (or even anon via server function) can INSERT their own error;
-- we allow authenticated inserts here and rely on server-side capture for unauthenticated ones.
CREATE POLICY "authenticated can insert their errors" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "platform admins read all errors" ON public.error_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins update errors" ON public.error_logs
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins delete errors" ON public.error_logs
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE TABLE public.error_notifications (
  fingerprint TEXT PRIMARY KEY,
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notify_count INT NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_notifications TO authenticated;
GRANT ALL ON public.error_notifications TO service_role;
ALTER TABLE public.error_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read notif log" ON public.error_notifications
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
