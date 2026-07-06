import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerPWA, type PwaUpdater } from "@/lib/pwa-register";

export function PwaUpdatePrompt() {
  const [updater, setUpdater] = useState<PwaUpdater | null>(null);

  useEffect(() => {
    const u = registerPWA({
      onNeedRefresh: () => {
        toast("Nova versão do TotalControle disponível", {
          description: "Recarregar agora para aplicar as atualizações?",
          duration: Infinity,
          action: {
            label: "Atualizar",
            onClick: () => u?.update(),
          },
          cancel: { label: "Depois", onClick: () => {} },
        });
      },
      onOfflineReady: () => {
        toast.success("Pronto para uso offline");
      },
    });
    if (u) setUpdater(u);
    return () => u?.dispose();
  }, []);

  // Hidden component; UI is emitted via toasts.
  void updater;
  return null;
}

/** Manual "check for updates" button — usable in Settings later. */
export function CheckUpdatesButton() {
  return (
    <Button
      variant="outline"
      onClick={() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
          toast.info("Atualização automática indisponível neste navegador.");
          return;
        }
        navigator.serviceWorker.getRegistrations().then((regs) => {
          if (regs.length === 0) {
            toast.info("Nenhuma versão instalada localmente ainda.");
            return;
          }
          Promise.all(regs.map((r) => r.update())).then(() => toast.success("Verificação concluída."));
        });
      }}
    >
      Verificar atualizações
    </Button>
  );
}
