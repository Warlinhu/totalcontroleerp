-- ENUMS
CREATE TYPE public.subscription_status AS ENUM ('pending','active','past_due','canceled');
CREATE TYPE public.subscription_cycle AS ENUM ('monthly','yearly');
CREATE TYPE public.subscription_source AS ENUM ('mercadopago','manual','license');
CREATE TYPE public.payment_status AS ENUM ('pending','approved','rejected','refunded','cancelled');
CREATE TYPE public.license_status AS ENUM ('unused','redeemed','revoked');

-- BILLING PLANS
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  monthly_price_cents integer NOT NULL,
  first_month_discount_pct numeric NOT NULL DEFAULT 10,
  yearly_discount_pct numeric NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT ON public.billing_plans TO anon;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active plans" ON public.billing_plans FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "platform admins manage plans" ON public.billing_plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_billing_plans_updated BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.billing_plans (code, name, currency, monthly_price_cents, first_month_discount_pct, yearly_discount_pct)
VALUES ('standard', 'TotalControle ERP', 'BRL', 5000, 10, 10);

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  cycle public.subscription_cycle NOT NULL DEFAULT 'monthly',
  source public.subscription_source NOT NULL DEFAULT 'mercadopago',
  current_period_start timestamptz,
  current_period_end timestamptz,
  first_month_discount_used boolean NOT NULL DEFAULT false,
  last_amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  external_id text UNIQUE,
  provider text NOT NULL DEFAULT 'mercadopago',
  cycle public.subscription_cycle NOT NULL DEFAULT 'monthly',
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  method text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_paid_at ON public.payments(paid_at);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- LICENSES
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  duration_days integer NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  target_email text,
  notes text,
  status public.license_status NOT NULL DEFAULT 'unused',
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read licenses" ON public.licenses FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR redeemed_by = auth.uid());
CREATE POLICY "platform admins manage licenses" ON public.licenses FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- EXPENSES (platform, deductible)
CREATE TABLE public.platform_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'infraestrutura',
  amount_cents integer NOT NULL,
  incurred_on date NOT NULL DEFAULT current_date,
  deductible boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_expenses TO authenticated;
GRANT ALL ON public.platform_expenses TO service_role;
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage expenses" ON public.platform_expenses FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_platform_expenses_updated BEFORE UPDATE ON public.platform_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- TAX BRACKETS
CREATE TABLE public.tax_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime text NOT NULL,
  label text NOT NULL,
  annual_limit_cents bigint NOT NULL,
  rate_pct numeric NOT NULL,
  deduction_cents bigint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tax_brackets TO authenticated;
GRANT ALL ON public.tax_brackets TO service_role;
ALTER TABLE public.tax_brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read tax brackets" ON public.tax_brackets FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins manage tax brackets" ON public.tax_brackets FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_tax_brackets_updated BEFORE UPDATE ON public.tax_brackets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.tax_brackets (regime, label, annual_limit_cents, rate_pct, deduction_cents, sort_order) VALUES
  ('MEI', 'MEI — Serviços (DAS fixo mensal)', 8100000, 0, 0, 0),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 1ª faixa', 18000000, 6, 0, 1),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 2ª faixa', 36000000, 11.2, 979200, 2),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 3ª faixa', 72000000, 13.5, 1747200, 3),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 4ª faixa', 180000000, 16, 3547200, 4),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 5ª faixa', 360000000, 21, 12507200, 5),
  ('SIMPLES_III', 'Simples Nacional Anexo III — 6ª faixa', 480000000, 33, 65307200, 6);

-- HELPER: active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.status = 'active'
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end > now()
    );
$$;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

-- HELPER: redeem license
CREATE OR REPLACE FUNCTION public.redeem_license(_code text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lic public.licenses%ROWTYPE;
  uid uuid := auth.uid();
  base timestamptz;
  new_end timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO lic FROM public.licenses WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_license'; END IF;
  IF lic.status <> 'unused' THEN RAISE EXCEPTION 'license_already_used'; END IF;

  SELECT greatest(coalesce(s.current_period_end, now()), now()) INTO base
  FROM public.subscriptions s WHERE s.user_id = uid;
  base := coalesce(base, now());
  new_end := base + make_interval(days => lic.duration_days);

  INSERT INTO public.subscriptions (user_id, status, cycle, source, current_period_start, current_period_end, last_amount_cents)
  VALUES (uid, 'active', 'monthly', 'license', now(), new_end, lic.amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'active', source = 'license',
        current_period_start = coalesce(public.subscriptions.current_period_start, now()),
        current_period_end = new_end,
        last_amount_cents = lic.amount_cents,
        updated_at = now();

  UPDATE public.licenses
    SET status = 'redeemed', redeemed_by = uid, redeemed_at = now()
  WHERE id = lic.id;

  RETURN new_end;
END; $$;
REVOKE EXECUTE ON FUNCTION public.redeem_license(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_license(text) TO authenticated;