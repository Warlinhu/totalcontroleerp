// deno-lint-ignore-file no-explicit-any
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const { source, severity, message, route, fingerprint } = body ?? {};
    if (!message) return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: cors });

    const to = Deno.env.get("ERROR_NOTIFY_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!to || !resendKey || !lovableKey) {
      return new Response(JSON.stringify({ skipped: true }), { headers: cors });
    }

    const subject = `[TotalControle] ${String(severity ?? "error").toUpperCase()}: ${String(message).slice(0, 120)}`;
    const html = `
      <h2>Novo erro registrado</h2>
      <p><strong>Severidade:</strong> ${severity ?? "error"}</p>
      <p><strong>Origem:</strong> ${source ?? "—"}</p>
      <p><strong>Rota:</strong> ${route ?? "—"}</p>
      <p><strong>Fingerprint:</strong> <code>${fingerprint ?? "—"}</code></p>
      <p><strong>Mensagem:</strong></p>
      <pre style="background:#f4f4f5;padding:12px;border-radius:6px;white-space:pre-wrap">${String(message).slice(0, 4000)}</pre>
    `;

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "TotalControle <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: res.ok, out }), { status: res.ok ? 200 : 500, headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: cors });
  }
});
