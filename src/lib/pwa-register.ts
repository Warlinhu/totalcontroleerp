// Guarded service-worker registration. Follows the Lovable PWA skill:
// - never registers in dev, iframe, or Lovable preview hosts
// - always usable via ?sw=off to force unregister
// - single registration wrapper

export type PwaUpdater = {
  update: () => void;
  dispose: () => void;
};

type Opts = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

function shouldSkip(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const h = window.location.hostname;
  if (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")
  ) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAll() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
}

export function registerPWA(opts: Opts = {}): PwaUpdater | null {
  if (shouldSkip()) {
    void unregisterAll();
    return null;
  }

  let updateFn: (() => void) | null = null;
  let disposed = false;

  (async () => {
    try {
      const mod = await import("virtual:pwa-register");
      updateFn = mod.registerSW({
        immediate: true,
        onNeedRefresh() { if (!disposed) opts.onNeedRefresh?.(); },
        onOfflineReady() { if (!disposed) opts.onOfflineReady?.(); },
      });
    } catch (e) {
      console.warn("[pwa] register failed", e);
    }
  })();

  return {
    update: () => updateFn?.(true),
    dispose: () => { disposed = true; },
  };
}
