import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/debtors")({
  head: () => ({ meta: [{ title: "Devedores — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Devedores" description="Registro de devedores com parcelas e vencimentos." />,
});
