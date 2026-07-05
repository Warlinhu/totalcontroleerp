import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/app/reminders")({
  head: () => ({ meta: [{ title: "Lembretes — TotalControle ERP" }] }),
  component: () => <ComingSoon title="Lembretes" description="Vencimentos próximos e em atraso." />,
});
