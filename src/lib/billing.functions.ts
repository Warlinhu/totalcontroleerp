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
      const { logServerError } = await import("@/lib/error-logger.server");
      await logServerError({
        source: "billing.checkout",
        severity: "critical",
        message: `Mercado Pago recusou a criação do checkout [${res.status}]`,
        route: "/assinatura",
        userId,
        context: { cycle: data.cycle, amountCents, body: body.slice(0, 500) },
      });
      throw new Error("O provedor de pagamento recusou a solicitação. Tente novamente.");
    }

    const pref = (await res.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
    const sandbox = creds.mode === "sandbox";
    const url = sandbox
      ? (pref.sandbox_init_point ?? pref.init_point)
      : (pref.init_point ?? pref.sandbox_init_point);
    if (!url) throw new Error("O provedor não retornou o link de pagamento.");

    await supabaseAdmin.from("payments").update({ external_id: `pref:${pref.id}` }).eq("id", payment.id);

    return { url, amountCents, cycle: data.cycle, sandbox, paymentId: payment.id };
  });

/**
 * Rede de segurança: consulta o provedor pelos pagamentos pendentes do usuário
 * e libera a assinatura se algum já estiver aprovado (caso o aviso não chegue).
 */
export const reconcileMyPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { reconcileUserPayments } = await import("@/lib/mercadopago.server");
      const result = await reconcileUserPayments(context.userId);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", context.userId)
        .maybeSingle();

      const active =
        sub?.status === "active" &&
        !!sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > Date.now();

      return { ...result, active, periodEnd: sub?.current_period_end ?? null };
    } catch (err) {
      const { logServerError, describeError } = await import("@/lib/error-logger.server");
      const { message, stack } = describeError(err);
      await logServerError({
        source: "billing.reconcile",
        severity: "error",
        message,
        stack,
        userId: context.userId,
        route: "/assinatura/retorno",
      });
      throw new Error("Não foi possível verificar o pagamento agora. Tente novamente em instantes.");
    }
  });

/** Diagnóstico das credenciais e do fluxo de cobrança (somente admin da plataforma). */
export const billingDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Acesso restrito aos administradores da plataforma.");

    const { getMercadoPagoCredentials } = await import("@/lib/payment-settings.server");
    const creds = await getMercadoPagoCredentials();

    let credential: {
      configured: boolean;
      valid: boolean;
      sandbox: boolean;
      environment: string;
      detail: string;
    } = {
      configured: false,
      valid: false,
      sandbox: false,
      environment: "—",
      detail: "Nenhum Access Token cadastrado.",
    };

    if (creds) {
      const isTestToken = creds.token.startsWith("TEST-");
      const res = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${creds.token}` },
      });
      const ok = res.ok;
      const body = ok ? ((await res.json()) as { nickname?: string; email?: string }) : null;
      credential = {
        configured: true,
        valid: ok,
        sandbox: creds.mode === "sandbox" || isTestToken,
        environment: isTestToken ? "Teste (TEST-)" : "Produção (APP_USR-)",
        detail: ok
          ? `Conta conectada: ${body?.nickname ?? body?.email ?? "verificada"}`
          : `Credencial recusada pelo provedor (HTTP ${res.status}).`,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: recent } = await supabaseAdmin
      .from("payments")
      .select("id, status, cycle, amount_cents, method, created_at, paid_at, external_id")
      .order("created_at", { ascending: false })
      .limit(10);

    const { count: stuckCount } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", cutoff);

    const { count: activeSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const { data: billingErrors } = await supabaseAdmin
      .from("error_logs")
      .select("id, source, message, created_at, severity")
      .like("source", "billing%")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      credential,
      recent: recent ?? [],
      stuckCount: stuckCount ?? 0,
      activeSubs: activeSubs ?? 0,
      billingErrors: billingErrors ?? [],
      webhookSecretConfigured: !!process.env["MERCADOPAGO_WEBHOOK_SECRET"],
    };
  });
