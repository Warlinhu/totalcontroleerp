import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — TotalControle ERP" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { current, currentCompanyId } = useCompany();

  const stats = useQuery({
    queryKey: ["dashboard-stats", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      if (!currentCompanyId) return null;
      const today = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const [customers, products, debtorsDue, payablesDue] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
        supabase.from("debtor_installments").select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId).eq("status", "pending").lte("due_date", in7),
        supabase.from("payable_installments").select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId).eq("status", "pending").lte("due_date", in7),
      ]);
      void today;
      return {
        customers: customers.count ?? 0,
        products: products.count ?? 0,
        debtorsDueSoon: debtorsDue.count ?? 0,
        payablesDueSoon: payablesDue.count ?? 0,
      };
    },
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de {current?.company.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Clientes" value={s?.customers ?? "—"} />
        <StatCard title="Produtos/Serviços" value={s?.products ?? "—"} />
        <StatCard title="A receber (7 dias)" value={s?.debtorsDueSoon ?? "—"} />
        <StatCard title="A pagar (7 dias)" value={s?.payablesDueSoon ?? "—"} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao TotalControle ERP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>A estrutura multi-tenant e o cadastro base estão prontos.</p>
          <p>Módulos de cadastro, financeiro, lembretes e monitoramento de erros serão liberados nos próximos passos.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
