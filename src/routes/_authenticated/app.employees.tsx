import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({ meta: [{ title: "Funcionários — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Funcionários" description="Cadastro de funcionários (RH)." />,
});
