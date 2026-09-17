CREATE TABLE public.payment_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'subscription' CHECK (kind IN ('subscription','lifetime')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  duration_days integer,
  show_on_home boolean NOT NULL DEFAULT true,
  highlight boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can view home links"
  ON public.payment_links FOR SELECT
  TO anon, authenticated
  USING (active);

CREATE POLICY "platform admins manage payment links"
  ON public.payment_links FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER payment_links_touch
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.payments
  ADD COLUMN payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL;