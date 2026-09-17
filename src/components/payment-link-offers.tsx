import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
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

export function usePublicOffers(onlyHome: boolean) {
  return useQuery({
    queryKey: ["public-offers", onlyHome],
    queryFn: async () => {
      let q = supabase
        .from("payment_links")
        .select("id, code, name, description, kind, amount_cents, duration_days, highlight")
        .eq("active", true);
      if (onlyHome) q = q.eq("show_on_home", true);
      const { data, error } = await q.order("amount_cents", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicOffer[];
    },
  });
}

export function offerAccessLabel(o: PublicOffer) {
  return o.kind === "lifetime" ? "Pagamento único — acesso definitivo" : `Acesso por ${o.duration_days} dias`;
}

/** Cartões de oferta com botão de pagamento (usuário autenticado). */
export function PaymentOffers({ filterCode }: { filterCode?: string | undefined }) {
  const offers = usePublicOffers(false);
  const checkout = useServerFn(createLinkCheckout);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = (offers.data ?? []).filter((o) => !filterCode || o.code === filterCode);
  if (rows.length === 0) return null;

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
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((o) => (
        <div key={o.id} className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{o.name}</h3>
            {o.kind === "lifetime" && <Badge>Definitivo</Badge>}
          </div>
          <div className="mt-3 text-3xl font-bold">{formatBRL(o.amount_cents)}</div>
          <p className="mt-1 text-sm text-muted-foreground">{offerAccessLabel(o)}</p>
          {o.description && <p className="mt-2 text-sm text-muted-foreground">{o.description}</p>}
          <Button className="mt-6 w-full" disabled={busy === o.code} onClick={() => buy(o.code)}>
            {busy === o.code ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo...</> : "Pagar agora"}
          </Button>
        </div>
      ))}
    </div>
  );
}
