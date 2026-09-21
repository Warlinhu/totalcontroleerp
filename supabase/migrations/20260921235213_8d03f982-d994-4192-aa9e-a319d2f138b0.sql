CREATE TABLE public.payment_link_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_link_id UUID NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'click',
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.payment_link_events TO anon;
GRANT SELECT, INSERT ON public.payment_link_events TO authenticated;
GRANT ALL ON public.payment_link_events TO service_role;

ALTER TABLE public.payment_link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can record link events"
  ON public.payment_link_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (kind = 'click');

CREATE POLICY "platform admins read link events"
  ON public.payment_link_events FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE INDEX idx_payment_link_events_link ON public.payment_link_events(payment_link_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.payment_link_stats()
RETURNS TABLE(
  id uuid, code text, name text, kind text, amount_cents integer,
  active boolean, clicks bigint, approved bigint, revenue_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.code, l.name, l.kind, l.amount_cents, l.active,
    (SELECT count(*) FROM public.payment_link_events e WHERE e.payment_link_id = l.id AND e.kind = 'click')::BIGINT,
    (SELECT count(*) FROM public.payments p WHERE p.payment_link_id = l.id AND p.status = 'approved')::BIGINT,
    coalesce((SELECT sum(p.amount_cents) FROM public.payments p WHERE p.payment_link_id = l.id AND p.status = 'approved'), 0)::BIGINT
  FROM public.payment_links l
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY 9 DESC, l.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.payment_link_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_link_stats() TO authenticated;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_uuid UUID;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS client_uuid UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_uuid ON public.sales(client_uuid) WHERE client_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_client_uuid ON public.customers(client_uuid) WHERE client_uuid IS NOT NULL;