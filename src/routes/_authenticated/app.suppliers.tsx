import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Fornecedores" description="Cadastro de fornecedores da empresa." />,
});
