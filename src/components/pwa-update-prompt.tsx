import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerPWA, type PwaUpdater } from "@/lib/pwa-register";

export function PwaUpdatePrompt() {
  const [updater, setUpdater] = useState<PwaUpdater | null>(null);

  useEffect(() => {
    const u = registerPWA({
      onNeedRefresh: () => {
        // Notificação discreta: canto, curta, com ação opcional.
        // Não bloqueia o usuário — se ele ignorar, a nova versão será
        // aplicada automaticamente na próxima abertura do app.
        toast("Nova versão disponível", {
          description: "Atualize quando quiser para aplicar as melhorias.",
          duration: 10000,
          position: "bottom-right",
          action: {
            label: "Atualizar agora",
            onClick: () => u?.update(),
          },
        });
      },
      onOfflineReady: () => {
        toast.success("Pronto para uso offline", {
          duration: 4000,
          position: "bottom-right",
        });
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
