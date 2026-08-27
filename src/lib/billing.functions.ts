import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priceForCycle, FALLBACK_PLAN, type BillingPlan, type Cycle } from "@/lib/billing";

type CheckoutInput = { cycle: Cycle };

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CheckoutInput): CheckoutInput => {
    if (data?.cycle !== "monthly" && data?.cycle !== "yearly") {
      throw new Error("Ciclo inválido");
    }
    return { cycle: data.cycle };
  })
  .handler(async ({ data, context }) => {
    const { getMercadoPagoCredentials } = await import("@/lib/payment-settings.server");
    const creds = await getMercadoPagoCredentials();
    if (!creds) {
      throw new Error(
        "Pagamento indisponível: cadastre o Access Token em Plataforma → Pagamentos no painel do desenvolvedor.",
      );
    }
    const token = creds.token;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: planRow } = await supabaseAdmin
      .from("billing_plans")
      .select("code, name, currency, monthly_price_cents, first_month_discount_pct, yearly_discount_pct")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const plan = (planRow as BillingPlan | null) ?? FALLBACK_PLAN;

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, first_month_discount_used")
      .eq("user_id", userId)
      .maybeSingle();

    const firstPurchase = !sub?.first_month_discount_used;
    const amountCents = priceForCycle(plan, data.cycle, firstPurchase);

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        subscription_id: sub?.id ?? null,
        cycle: data.cycle,
        amount_cents: amountCents,
        currency: plan.currency,
        status: "pending",
        provider: "mercadopago",
      })
      .select("id")
      .single();
    if (payErr || !payment) throw new Error("Não foi possível iniciar o pagamento.");

    const origin = new URL(getRequest().url).origin;
    const title =
      data.cycle === "yearly"
        ? "TotalControle ERP — Plano anual (12 meses)"
        : firstPurchase
          ? "TotalControle ERP — 1º mês promocional"
          : "TotalControle ERP — Mensalidade";

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: `${plan.code}-${data.cycle}`,
            title,
            quantity: 1,
            currency_id: plan.currency,
            unit_price: Number((amountCents / 100).toFixed(2)),
          },
        ],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: userId, cycle: data.cycle },
        back_urls: {
          success: `${origin}/assinatura/retorno`,
          pending: `${origin}/assinatura/retorno`,
          failure: `${origin}/assinatura/retorno`,
        },
        auto_return: "approved",
        notification_url: `${origin}/api/public/webhooks/mercadopago`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Mercado Pago preference failed [${res.status}]: ${body}`);
      throw new Error("O provedor de pagamento recusou a solicitação. Tente novamente.");
    }

    const pref = (await res.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
    const url = pref.init_point ?? pref.sandbox_init_point;
    if (!url) throw new Error("O provedor não retornou o link de pagamento.");

    await supabaseAdmin.from("payments").update({ external_id: `pref:${pref.id}` }).eq("id", payment.id);

    return { url, amountCents, cycle: data.cycle };
  });
