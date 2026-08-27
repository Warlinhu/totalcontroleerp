import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MpCredentials = { token: string; mode: string };

/**
 * Resolve as credenciais do Mercado Pago: primeiro o que o desenvolvedor
 * cadastrou no painel (Plataforma → Pagamentos), depois a variável de ambiente.
 */
export async function getMercadoPagoCredentials(): Promise<MpCredentials | null> {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("access_token, mode, enabled, provider")
    .eq("singleton", true)
    .maybeSingle();

  const dbToken = data?.enabled && data?.provider === "mercadopago" ? data.access_token?.trim() : null;
  if (dbToken) return { token: dbToken, mode: data?.mode ?? "production" };

  const envToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
  if (envToken) return { token: envToken, mode: "production" };

  return null;
}
