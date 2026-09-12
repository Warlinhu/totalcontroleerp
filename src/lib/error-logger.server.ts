/**
 * Registro de erros do lado do servidor (server functions, webhooks, SSR).
 * Grava na mesma tabela usada pelo painel Plataforma → Erros.
 */

type Severity = "info" | "warning" | "error" | "critical";

async function fingerprint(source: string, message: string) {
  const data = new TextEncoder().encode(`${source}::${message.slice(0, 200)}`);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function logServerError(input: {
  source: string;
  message: string;
  severity?: Severity;
  stack?: string | null;
  route?: string | null;
  userId?: string | null;
  companyId?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown> | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fp = await fingerprint(input.source, input.message);
    await supabaseAdmin.from("error_logs").insert({
      company_id: input.companyId ?? null,
      user_id: input.userId ?? null,
      source: input.source,
      severity: input.severity ?? "error",
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      route: input.route ?? null,
      user_agent: input.userAgent ?? null,
      fingerprint: fp,
      context: (input.context ?? null) as never,
    });
  } catch (e) {
    // Nunca deixe o logging derrubar a requisição.
    console.warn("[error-logger.server] falhou", e);
  }
}

/** Extrai mensagem/stack de qualquer valor lançado. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}
