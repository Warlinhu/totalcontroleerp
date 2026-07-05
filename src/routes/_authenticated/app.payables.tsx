import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/payables")({
  head: () => ({ meta: [{ title: "Contas a pagar — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Contas a pagar" description="Registro de contas com parcelas e vencimentos." />,
});
