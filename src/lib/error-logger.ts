import { supabase } from "@/integrations/supabase/client";

type Severity = "info" | "warning" | "error" | "critical";

async function fingerprint(source: string, message: string) {
  const data = new TextEncoder().encode(`${source}::${message.slice(0, 200)}`);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function logAppError(input: {
  source: string;
  message: string;
  severity?: Severity;
  stack?: string;
  route?: string;
  context?: Record<string, unknown>;
  companyId?: string | null;
}) {
  try {
    const fp = await fingerprint(input.source, input.message);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      company_id: input.companyId ?? null,
      user_id: user.user?.id ?? null,
      source: input.source,
      severity: input.severity ?? "error",
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      route: input.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      fingerprint: fp,
      context: input.context ?? null,
    };
    const client = supabase.from("error_logs") as unknown as {
      insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
    };
    await client.insert(payload);
    // Fire-and-forget notification email (only for error/critical to avoid noise)
    if (payload.severity === "error" || payload.severity === "critical") {
      void supabase.functions.invoke("notify-error", {
        body: {
          source: payload.source,
          severity: payload.severity,
          message: payload.message,
          route: payload.route,
          fingerprint: payload.fingerprint,
        },
      }).catch(() => {});
    }
  } catch (e) {
    // Swallow — logging must not break the app.
    console.warn("[error-logger] failed", e);
  }
}

export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __erpErrorHandlersInstalled?: boolean };
  if (w.__erpErrorHandlersInstalled) return;
  w.__erpErrorHandlersInstalled = true;

  window.addEventListener("error", (e) => {
    const err = e.error as Error | undefined;
    void logAppError({
      source: "window.onerror",
      message: err?.message ?? String(e.message ?? "Unknown error"),
      stack: err?.stack,
      severity: "error",
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as Error | undefined;
    void logAppError({
      source: "unhandledrejection",
      message: reason?.message ?? String(reason ?? "Unhandled promise rejection"),
      stack: reason?.stack,
      severity: "error",
    });
  });
}
