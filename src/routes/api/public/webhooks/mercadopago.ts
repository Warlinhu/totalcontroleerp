import { createFileRoute } from "@tanstack/react-router";

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
              const body = JSON.parse(raw) as {
                type?: string;
                action?: string;
                data?: { id?: string };
              };
              if (body?.data?.id) paymentId = String(body.data.id);
              if (body?.type && !type && body.type !== "payment") {
                return new Response("ignored", { status: 200 });
              }
            } catch {
              /* o provedor às vezes envia form-encoded; os query params já cobrem */
            }
          }

          if (type && type !== "payment") return new Response("ignored", { status: 200 });
          if (!paymentId) return new Response("no id", { status: 200 });

          const { verifyWebhookSignature, processMpPayment } = await import(
            "@/lib/mercadopago.server"
          );

          const valid = verifyWebhookSignature({
            signatureHeader: request.headers.get("x-signature"),
            requestId: request.headers.get("x-request-id"),
            dataId: paymentId,
          });
          if (!valid) {
            const { logServerError } = await import("@/lib/error-logger.server");
            await logServerError({
              source: "billing.webhook",
              severity: "warning",
              message: "Aviso do Mercado Pago rejeitado: assinatura inválida",
              route: "/api/public/webhooks/mercadopago",
              context: { paymentId },
            });
            return new Response("invalid signature", { status: 401 });
          }

          const result = await processMpPayment(paymentId);
          if (!result.ok) {
            return new Response(result.reason, { status: result.retryable ? 202 : 200 });
          }
          return new Response("ok", { status: 200 });
        } catch (err) {
          const { logServerError, describeError } = await import("@/lib/error-logger.server");
          const { message, stack } = describeError(err);
          await logServerError({
            source: "billing.webhook",
            severity: "critical",
            message: `Falha ao processar aviso de pagamento: ${message}`,
            stack,
            route: "/api/public/webhooks/mercadopago",
          });
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
