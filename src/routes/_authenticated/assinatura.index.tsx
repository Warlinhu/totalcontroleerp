import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Sparkles, KeyRound, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { createCheckout } from "@/lib/billing.functions";
import { FALLBACK_PLAN, formatBRL, priceForCycle, type BillingPlan, type Cycle } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/assinatura/")({
  head: () => ({
    meta: [
      { title: "Assinatura — TotalControle ERP" },
      { name: "description", content: "Ative sua assinatura do TotalControle ERP e libere o sistema completo." },
    ],
  }),
  component: SubscriptionPage,
});

const BENEFITS = [
  "PDV completo com dinheiro, cartão, PIX e fiado",
  "Controle de contas a receber e a pagar com parcelas",
  "Notas fiscais, clientes, fornecedores e estoque",
  "Dashboard com faturamento, ticket médio e horário de pico",
  "Assistente inteligente e multi-empresa ilimitado",
  "Aplicativo para Windows, macOS, Linux e Android",
];

function SubscriptionPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);
  const [busy, setBusy] = useState<Cycle | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const planQ = useQuery({
    queryKey: ["billing-plan"],
    queryFn: async (): Promise<BillingPlan> => {
      const { data, error } = await supabase
        .from("billing_plans")
        .select("code, name, currency, monthly_price_cents, first_month_discount_pct, yearly_discount_pct")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as BillingPlan | null) ?? FALLBACK_PLAN;
    },
  });

  const subQ = useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, cycle, current_period_end, first_month_discount_used")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const plan = planQ.data ?? FALLBACK_PLAN;
  const firstPurchase = !subQ.data?.first_month_discount_used;
  const monthly = priceForCycle(plan, "monthly", firstPurchase);
  const yearly = priceForCycle(plan, "yearly", firstPurchase);
  const yearlyFull = plan.monthly_price_cents * 12;
  const active =
    subQ.data?.status === "active" &&
    subQ.data?.current_period_end &&
    new Date(subQ.data.current_period_end).getTime() > Date.now();

  const startCheckout = async (cycle: Cycle) => {
    setBusy(cycle);
    try {
      const res = await checkout({ data: { cycle } });
      window.location.href = res.url;
    } catch (e) {
      toast.error("Não foi possível abrir o pagamento", {
        description: e instanceof Error ? e.message : "Tente novamente em instantes.",
      });
      setBusy(null);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_license", { _code: code.trim() });
    setRedeeming(false);
    if (error) {
      const msg =
        error.message.includes("invalid_license")
          ? "Código inválido."
          : error.message.includes("already_used")
            ? "Este código já foi utilizado."
            : error.message;
      toast.error("Não foi possível resgatar", { description: msg });
      return;
    }
    toast.success("Licença ativada!", {
      description: `Acesso liberado até ${new Date(data as string).toLocaleDateString("pt-BR")}.`,
    });
    await subQ.refetch();
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandLogo className="h-9 w-auto" /></Link>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sair</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {active ? (
          <Card className="mb-10 border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" /> Assinatura ativa
              </CardTitle>
              <CardDescription>
                Seu acesso está liberado até{" "}
                {new Date(subQ.data!.current_period_end!).toLocaleDateString("pt-BR")}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild><Link to="/app"><ArrowLeft className="mr-2 h-4 w-4" /> Ir para o sistema</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-10 text-center">
            <Badge className="mb-4">Acesso bloqueado</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ative sua assinatura para usar o TotalControle
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Um único pagamento libera todas as suas empresas, em todos os dispositivos.
              Cancele quando quiser — sem fidelidade.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <PlanCard
            title="Mensal"
            price={formatBRL(monthly)}
            suffix="/mês"
            note={firstPurchase ? `1º mês com 10% off — depois ${formatBRL(plan.monthly_price_cents)}/mês` : "Renovação a cada 30 dias"}
            benefits={BENEFITS}
            cta={busy === "monthly" ? "Abrindo pagamento..." : "Assinar mensal"}
            loading={busy === "monthly"}
            disabled={busy !== null}
            onClick={() => startCheckout("monthly")}
          />
          <PlanCard
            highlight
            title="Anual"
            price={formatBRL(yearly)}
            suffix="/ano"
            note={`Economize ${formatBRL(yearlyFull - yearly)} — equivale a ${formatBRL(Math.round(yearly / 12))}/mês`}
            benefits={["Tudo do plano mensal", "10% de desconto no total", "365 dias de licença", ...BENEFITS.slice(0, 3)]}
            cta={busy === "yearly" ? "Abrindo pagamento..." : "Assinar anual (-10%)"}
            loading={busy === "yearly"}
            disabled={busy !== null}
            onClick={() => startCheckout("yearly")}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pagamento seguro via Mercado Pago — PIX, boleto ou cartão de crédito.
        </p>

        <Card className="mx-auto mt-12 max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Tenho um código de licença
            </CardTitle>
            <CardDescription>Recebeu um código do suporte? Resgate aqui.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="TC-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Button onClick={redeem} disabled={redeeming || !code.trim()} variant="secondary">
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resgatar"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PlanCard({
  title, price, suffix, note, benefits, cta, onClick, highlight, loading, disabled,
}: {
  title: string; price: string; suffix: string; note: string; benefits: string[];
  cta: string; onClick: () => void; highlight?: boolean; loading?: boolean; disabled?: boolean;
}) {
  return (
    <Card className={highlight ? "relative border-primary shadow-elegant" : undefined}>
      {highlight && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Sparkles className="mr-1 h-3 w-3" /> Melhor valor
        </Badge>
      )}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">{suffix}</span>
        </div>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button className="w-full" size="lg" onClick={onClick} disabled={disabled} variant={highlight ? "default" : "outline"}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}
