import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/customers")({
  head: () => ({ meta: [{ title: "Clientes — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Clientes" description="Cadastro de clientes da empresa." />,
});
