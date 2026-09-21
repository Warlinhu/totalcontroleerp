import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushOutbox, isOffline, pendingCount, subscribeOutbox } from "@/lib/offline-queue";

export function useOfflineSync() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setPending(pendingCount()), []);

  const sync = useCallback(
    async (silent = true) => {
      if (isOffline()) {
        if (!silent) toast.error("Sem internet — os dados continuam salvos no aparelho.");
        return;
      }
      setSyncing(true);
      try {
        const res = await flushOutbox();
        refresh();
        if (res.sent > 0) {
          toast.success(`${res.sent} ${res.sent === 1 ? "registro enviado" : "registros enviados"}`);
          qc.invalidateQueries();
        } else if (!silent) {
          toast.success("Tudo sincronizado");
        }
        if (res.failed > 0) {
          toast.error(`${res.failed} ${res.failed === 1 ? "registro falhou" : "registros falharam"} ao enviar.`);
        }
      } finally {
        setSyncing(false);
      }
    },
    [qc, refresh],
  );

  useEffect(() => {
    setOnline(!isOffline());
    refresh();
    const unsub = subscribeOutbox(refresh);

    const goOnline = () => {
      setOnline(true);
      void sync(true);
    };
    const goOffline = () => setOnline(false);
    const onFocus = () => {
      if (!isOffline()) void sync(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (!isOffline() && pendingCount() > 0) void sync(true);
    }, 60_000);

    if (pendingCount() > 0) void sync(true);

    return () => {
      unsub();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [refresh, sync]);

  return { online, pending, syncing, sync };
}
