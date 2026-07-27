import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/assinatura/retorno")({
  head: () => ({
    meta: [
      { title: "Confirmando pagamento — TotalControle ERP" },
      { name: "description", content: "Estamos confirmando seu pagamento junto ao provedor." },
    ],
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [tries, setTries] = useState(0);

  const sub = useQuery({
    queryKey: ["my-subscription-return", user?.id, tries],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const active =
    sub.data?.status === "active" &&
    sub.data.current_period_end &&
    new Date(sub.data.current_period_end).getTime() > Date.now();

  useEffect(() => {
    if (active || tries > 20) return;
    const t = setTimeout(() => setTries((n) => n + 1), 3000);
    return () => clearTimeout(t);
  }, [active, tries]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => navigate({ to: "/app" }), 1500);
    return () => clearTimeout(t);
  }, [active, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link to="/"><BrandLogo className="h-9 w-auto" /></Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3">
              {active ? (
                <CheckCircle2 className="h-12 w-12 text-primary" />
              ) : tries > 20 ? (
                <XCircle className="h-12 w-12 text-muted-foreground" />
              ) : (
                <Clock className="h-12 w-12 animate-pulse text-muted-foreground" />
              )}
            </div>
            <CardTitle>
              {active ? "Pagamento confirmado!" : tries > 20 ? "Ainda não confirmamos" : "Confirmando seu pagamento..."}
            </CardTitle>
            <CardDescription>
              {active
                ? "Sua assinatura está ativa. Redirecionando para o sistema..."
                : tries > 20
                  ? "PIX e boleto podem levar alguns minutos. Assim que o provedor confirmar, seu acesso é liberado automaticamente."
                  : "Isso costuma levar poucos segundos. Não feche esta página."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button asChild variant="outline"><Link to="/assinatura">Voltar aos planos</Link></Button>
            {active && <Button asChild><Link to="/app">Ir para o sistema</Link></Button>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
