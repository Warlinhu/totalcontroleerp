import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({ meta: [{ title: "Produtos/Serviços — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Produtos e Serviços" description="Cadastro de produtos e serviços da empresa." />,
});
