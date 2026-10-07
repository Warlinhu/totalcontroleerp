import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/billing";
import { createLinkCheckout } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PublicOffer = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: "subscription" | "lifetime";
  amount_cents: number;
  duration_days: number | null;
  highlight: boolean;
};

export function usePublicOffers(filterCode?: string) {
  return useQuery({
    queryKey: ["public-offers", filterCode],
    enabled: Boolean(filterCode),
    queryFn: async () => {
      if (!filterCode) return [];
      const q = supabase
        .from("payment_links")
        .select("id, code, name, description, kind, amount_cents, duration_days, highlight")
        .eq("active", true)
        .eq("code", filterCode);
      const { data, error } = await q.order("amount_cents", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicOffer[];
    },
  });
}

export function offerAccessLabel(o: PublicOffer) {
  return o.kind === "lifetime" ? "Pagamento único — acesso definitivo" : `Acesso por ${o.duration_days} dias`;
}

/** Registra um clique no link de pagamento (usado nas métricas da aba Licenças). */
export async function trackOfferClick(paymentLinkId: string, ref?: string) {
  try {
    await supabase.from("payment_link_events").insert({
      payment_link_id: paymentLinkId,
      kind: "click",
      ref: ref ?? (typeof window !== "undefined" ? window.location.pathname : null),
    });
  } catch {
    /* métrica não pode quebrar a jornada de compra */
  }
}

/** Cartões de oferta com botão de pagamento (usuário autenticado). */
export function PaymentOffers({ filterCode }: { filterCode?: string | undefined }) {
  const offers = usePublicOffers(filterCode);
  const checkout = useServerFn(createLinkCheckout);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = filterCode ? (offers.data ?? []).filter((o) => o.code === filterCode) : [];

  // Conta o clique quando alguém abre o link da oferta (/assinatura?oferta=codigo).
  const trackedId = filterCode ? (offers.data ?? []).find((o) => o.code === filterCode)?.id : undefined;
  useEffect(() => {
    if (trackedId) void trackOfferClick(trackedId, "link");
  }, [trackedId]);

  if (!filterCode) return null;
  if (offers.isPending) return <p className="text-center text-muted-foreground">Carregando oferta...</p>;
  if (offers.isError) return <p className="text-center text-destructive">Não foi possível carregar esta oferta.</p>;
  if (rows.length === 0) return <p className="text-center text-muted-foreground">Este link está indisponível.</p>;

  const buy = async (code: string) => {
    setBusy(code);
    try {
      const res = await checkout({ data: { code } });
      window.location.href = res.url;
    } catch (err) {
      toast.error("Não foi possível abrir o pagamento", {
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
      });
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      {rows.map((o) => (
        <div
          key={o.id}
          className={`relative overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md ${
            o.highlight ? "border-primary/50 ring-1 ring-primary/30" : ""
          }`}
        >
          {o.highlight && (
            <div className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
              Oferta especial
            </div>
          )}
           <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="break-words font-semibold">{o.name}</h3>
            {o.kind === "lifetime" && <Badge variant="secondary">Definitivo</Badge>}
          </div>
          <div className="mt-4 flex items-baseline justify-center gap-2">
            <span className="text-4xl font-extrabold tracking-tight">{formatBRL(o.amount_cents)}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-primary">{offerAccessLabel(o)}</p>
          {o.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.description}</p>}
          <Button className="mt-6 w-full" size="lg" disabled={busy === o.code} onClick={() => buy(o.code)}>
            {busy === o.code ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo...</> : "Pagar agora"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro via Mercado Pago
          </p>
        </div>
      ))}
    </div>
  );
}
