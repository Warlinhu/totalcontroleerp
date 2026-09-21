import { CloudOff, RefreshCw, CloudCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/lib/use-offline-sync";
import { cn } from "@/lib/utils";

export function OfflineIndicator({ className }: { className?: string }) {
  const { online, pending, syncing, sync } = useOfflineSync();

  if (online && pending === 0 && !syncing) {
    return (
      <span className={cn("hidden items-center gap-1 text-xs text-muted-foreground sm:flex", className)}>
        <CloudCheck className="h-3.5 w-3.5" /> Sincronizado
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
          online ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive",
        )}
      >
        {online ? <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> : <CloudOff className="h-3.5 w-3.5" />}
        {online
          ? pending > 0
            ? `${pending} aguardando envio`
            : "Sincronizando..."
          : pending > 0
            ? `Offline — ${pending} salvos no aparelho`
            : "Offline"}
      </span>
      {pending > 0 && online && (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={syncing} onClick={() => void sync(false)}>
          Sincronizar agora
        </Button>
      )}
    </div>
  );
}
