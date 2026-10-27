import { useEffect } from "react";
import { toast } from "sonner";

// Versão mais recente do APK (manter igual ao "version" do package.json).
export const LATEST_APK_VERSION = "1.1.4";
const APK_URL = "https://github.com/Warlinhu/totalcontroleerp/releases/download/latest/TotalControleERP.apk";

function isOlder(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** Sugere (sem obrigar) instalar a nova versão do APK. */
export function ApkUpdatePrompt() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const isApk = /TotalControleAPK\//.test(ua) || (/Android/.test(ua) && "Capacitor" in window);
    if (!isApk) return;
    const installed = ua.match(/TotalControleAPK\/([\d.]+)/)?.[1] ?? "0.0.0";
    if (!isOlder(installed, LATEST_APK_VERSION)) return;
    const key = `tc-apk-update-dismissed-${LATEST_APK_VERSION}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    const t = setTimeout(() => {
      toast("Nova versão do aplicativo disponível", {
        description: "Instale quando quiser — você pode continuar usando normalmente.",
        duration: 15000,
        action: { label: "Baixar", onClick: () => window.open(APK_URL, "_system") },
        onDismiss: () => localStorage.setItem(key, String(Date.now())),
        onAutoClose: () => localStorage.setItem(key, String(Date.now())),
      });
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
