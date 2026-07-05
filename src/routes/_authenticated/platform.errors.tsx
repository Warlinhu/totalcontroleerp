import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/platform/errors")({
  head: () => ({ meta: [{ title: "Painel de erros — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Painel da plataforma" description="Monitoramento de erros em todas as empresas (acesso restrito ao dono da plataforma)." />,
});
