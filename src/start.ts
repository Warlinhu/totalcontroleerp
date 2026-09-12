import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    try {
      const { logServerError, describeError } = await import("./lib/error-logger.server");
      const { message, stack } = describeError(error);
      const url = new URL(request.url);
      await logServerError({
        source: "server.request",
        severity: "critical",
        message,
        stack,
        route: url.pathname,
        userAgent: request.headers.get("user-agent"),
        context: { method: request.method, search: url.search || null },
      });
    } catch {
      /* logging nunca quebra a resposta */
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
