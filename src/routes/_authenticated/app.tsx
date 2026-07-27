import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/app")({
  component: GatedApp,
});

function GatedApp() {
  const { user } = useSession();
  const navigate = useNavigate();

  const gate = useQuery({
    queryKey: ["subscription-gate", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_active_subscription", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const blocked = gate.isSuccess && gate.data === false;

  useEffect(() => {
    if (blocked) navigate({ to: "/assinatura", replace: true });
  }, [blocked, navigate]);

  if (!user || gate.isLoading || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando sua conta...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
