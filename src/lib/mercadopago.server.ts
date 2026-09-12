/**
 * Lógica compartilhada do Mercado Pago: consulta do pagamento no provedor,
 * atualização do registro local e liberação da assinatura.
 * Usada tanto pelo webhook quanto pela reconciliação manual.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getMercadoPagoCredentials } from "@/lib/payment-settings.server";
import { logServerError } from "@/lib/error-logger.server";

export type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  payment_method_id?: string | null;
  transaction_amount?: number;
  metadata?: { cycle?: string; user_id?: string };
};

export type ProcessResult =
  | { ok: true; outcome: "approved" | "updated" | "ignored"; status?: string }
  | { ok: false; reason: string; retryable: boolean };

const STATUS_MAP: Record<string, "pending" | "approved" | "rejected" | "refunded" | "cancelled"> = {
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

/**
 * Valida a assinatura `x-signature` do Mercado Pago.
 * Sem segredo cadastrado retorna `true` (validação opcional, como no painel do MP).
 */
export function verifyWebhookSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"]?.trim();
  if (!secret) return true;
  if (!input.signatureHeader) return false;

  const parts = Object.fromEntries(
    input.signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k?.trim() ?? "", rest.join("=").trim()];
    }),
  ) as Record<string, string>;

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${(input.dataId ?? "").toLowerCase()};request-id:${input.requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function fetchMpPayment(mpPaymentId: string): Promise<MpPayment | null> {
  const creds = await getMercadoPagoCredentials();
  if (!creds) return null;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    await logServerError({
      source: "billing.mercadopago.lookup",
      severity: "error",
      message: `Consulta de pagamento falhou [${res.status}]`,
      route: "/api/public/webhooks/mercadopago",
      context: { mpPaymentId, body: body.slice(0, 500) },
    });
    throw new Error(`lookup failed ${res.status}`);
  }
  return (await res.json()) as MpPayment;
}

/** Processa um pagamento do Mercado Pago de forma idempotente. */
export async function processMpPayment(mpPaymentId: string): Promise<ProcessResult> {
  let mp: MpPayment | null;
  try {
    mp = await fetchMpPayment(mpPaymentId);
  } catch {
    return { ok: false, reason: "lookup_failed", retryable: true };
  }
  if (!mp) {
    await logServerError({
      source: "billing.mercadopago",
      severity: "critical",
      message: "Credenciais do Mercado Pago não configuradas ao processar pagamento",
      context: { mpPaymentId },
    });
    return { ok: false, reason: "not_configured", retryable: true };
  }

  const localPaymentId = mp.external_reference;
  if (!localPaymentId) return { ok: true, outcome: "ignored" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, cycle, amount_cents, status")
    .eq("id", localPaymentId)
    .maybeSingle();
  if (!row) return { ok: true, outcome: "ignored" };

  const status = STATUS_MAP[mp.status] ?? "pending";
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
    return { ok: true, outcome: "updated", status };
  }

  const days = row.cycle === "yearly" ? 365 : 30;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", row.user_id)
    .maybeSingle();

  const now = Date.now();
  const base = sub?.current_period_end
    ? Math.max(new Date(sub.current_period_end).getTime(), now)
    : now;
  const periodEnd = new Date(base + days * 86400000).toISOString();

  const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
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

  if (subErr) {
    await logServerError({
      source: "billing.mercadopago",
      severity: "critical",
      message: `Pagamento aprovado mas a assinatura não foi liberada: ${subErr.message}`,
      userId: row.user_id,
      context: { paymentId: row.id, mpPaymentId },
    });
    return { ok: false, reason: "subscription_update_failed", retryable: true };
  }

  const { data: freshSub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", row.user_id)
    .maybeSingle();

  await supabaseAdmin
    .from("payments")
    .update({ subscription_id: freshSub?.id ?? sub?.id ?? null })
    .eq("id", row.id)
    .is("subscription_id", null);

  return { ok: true, outcome: "approved", status };
}

/**
 * Procura, para um usuário, pagamentos pendentes recentes e tenta confirmá-los
 * diretamente no provedor (rede de segurança quando o webhook não chega).
 */
export async function reconcileUserPayments(userId: string): Promise<{ checked: number; approved: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: pending } = await supabaseAdmin
    .from("payments")
    .select("id, external_id, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  const creds = await getMercadoPagoCredentials();
  if (!creds || !pending?.length) return { checked: 0, approved: 0 };

  let approved = 0;
  let checked = 0;

  for (const p of pending) {
    checked += 1;
    // Busca no provedor pela referência externa (id local do pagamento).
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(p.id)}`,
      { headers: { Authorization: `Bearer ${creds.token}` } },
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { results?: MpPayment[] };
    const best =
      json.results?.find((r) => r.status === "approved" || r.status === "authorized") ??
      json.results?.[0];
    if (!best) continue;
    const result = await processMpPayment(String(best.id));
    if (result.ok && result.outcome === "approved") approved += 1;
  }

  return { checked, approved };
}
