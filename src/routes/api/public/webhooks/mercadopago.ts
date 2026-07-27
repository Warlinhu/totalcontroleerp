import { createFileRoute } from "@tanstack/react-router";

type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  payment_method_id?: string | null;
  transaction_amount?: number;
  metadata?: { cycle?: string; user_id?: string };
};

async function processPayment(mpPaymentId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    console.error("mercadopago webhook: missing MERCADOPAGO_ACCESS_TOKEN");
    return new Response("not configured", { status: 500 });
  }

  // Never trust the webhook body — re-query the provider.
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`mercadopago lookup failed [${res.status}]: ${body}`);
    return new Response("lookup failed", { status: 202 });
  }
  const mp = (await res.json()) as MpPayment;

  const localPaymentId = mp.external_reference;
  if (!localPaymentId) return new Response("no reference", { status: 200 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, cycle, amount_cents, status")
    .eq("id", localPaymentId)
    .maybeSingle();
  if (!row) return new Response("unknown payment", { status: 200 });

  const statusMap: Record<string, "pending" | "approved" | "rejected" | "refunded" | "cancelled"> = {
    approved: "approved",
    authorized: "approved",
    pending: "pending",
    in_process: "pending",
    in_mediation: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "refunded",
  };
  const status = statusMap[mp.status] ?? "pending";

  // Idempotent: only act once when transitioning into approved.
  const alreadyApproved = row.status === "approved";

  await supabaseAdmin
    .from("payments")
    .update({
      external_id: String(mp.id),
      status,
      method: mp.payment_method_id ?? null,
      paid_at: status === "approved" ? new Date().toISOString() : null,
      raw: JSON.parse(JSON.stringify(mp)),
    })
    .eq("id", row.id);

  if (status !== "approved" || alreadyApproved) {
    return new Response("ok", { status: 200 });
  }

  const days = row.cycle === "yearly" ? 365 : 30;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", row.user_id)
    .maybeSingle();

  const now = Date.now();
  const base = sub?.current_period_end ? Math.max(new Date(sub.current_period_end).getTime(), now) : now;
  const periodEnd = new Date(base + days * 86400000).toISOString();

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: row.user_id,
      status: "active",
      cycle: row.cycle,
      source: "mercadopago",
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
      first_month_discount_used: true,
      last_amount_cents: row.amount_cents,
    },
    { onConflict: "user_id" },
  );

  await supabaseAdmin
    .from("payments")
    .update({ subscription_id: sub?.id ?? null })
    .eq("id", row.id)
    .is("subscription_id", null);

  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
          const type = url.searchParams.get("type") ?? url.searchParams.get("topic");

          const raw = await request.text();
          if (raw) {
            try {
              const body = JSON.parse(raw) as { type?: string; action?: string; data?: { id?: string } };
              if (body?.data?.id) paymentId = String(body.data.id);
              if (body?.type && !type) {
                if (body.type !== "payment") return new Response("ignored", { status: 200 });
              }
            } catch {
              /* provider sometimes posts form bodies; query params already handled */
            }
          }

          if (type && type !== "payment") return new Response("ignored", { status: 200 });
          if (!paymentId) return new Response("no id", { status: 200 });

          return await processPayment(paymentId);
        } catch (err) {
          console.error("mercadopago webhook error", err);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
