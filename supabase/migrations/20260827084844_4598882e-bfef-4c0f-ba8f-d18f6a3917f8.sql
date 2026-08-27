CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  provider text NOT NULL DEFAULT 'mercadopago',
  access_token text,
  public_key text,
  mode text NOT NULL DEFAULT 'production',
  payout_email text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton_chk CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read payment settings"
ON public.payment_settings FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins insert payment settings"
ON public.payment_settings FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins update payment settings"
ON public.payment_settings FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER payment_settings_touch
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.payment_settings (singleton, provider, mode, enabled) VALUES (true, 'mercadopago', 'production', false);