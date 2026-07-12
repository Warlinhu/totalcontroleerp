import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, TrendingUp, Users, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — TotalControle ERP" }] }),
  component: Dashboard,
});

type Period = "today" | "7d" | "30d" | "month";
type ChartStyle = "donut" | "pie" | "bar";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
};

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "PIX",
  alimentacao: "Alimentação",
  voucher: "Voucher",
  nota: "Nota (Fiado)",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 80% 55%))",
  "hsl(var(--chart-3, 340 75% 55%))",
  "hsl(var(--chart-4, 45 90% 55%))",
  "hsl(var(--chart-5, 160 60% 45%))",
  "hsl(var(--chart-6, 280 60% 60%))",
  "hsl(var(--chart-7, 20 80% 55%))",
];

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  if (p === "today") from.setHours(0, 0, 0, 0);
  else if (p === "7d") from.setDate(from.getDate() - 6);
  else if (p === "30d") from.setDate(from.getDate() - 29);
  else if (p === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const { current, currentCompanyId } = useCompany();
  const [period, setPeriod] = useState<Period>("30d");
  const [paymentChart, setPaymentChart] = useState<ChartStyle>("donut");
  const range = useMemo(() => periodRange(period), [period]);

  // Sales in range
  const salesQ = useQuery({
    queryKey: ["dash-sales", currentCompanyId, period],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, sold_at")
        .eq("company_id", currentCompanyId!)
        .gte("sold_at", range.from)
        .lte("sold_at", range.to)
        .order("sold_at");
      if (error) throw error;
      return (data ?? []) as { id: string; total: number; sold_at: string }[];
    },
  });

  // Ticket médio = valor total das vendas (independente de já estar liquidado)
  // dividido pelo número de vendas. Vendas em "Nota" não puxam o ticket para baixo.

  const paymentsQ = useQuery({
    queryKey: ["dash-payments", currentCompanyId, period],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_payments")
        .select("method, amount, status, settled_at, sale_id, created_at")
        .eq("company_id", currentCompanyId!)
        .gte("created_at", range.from)
        .lte("created_at", range.to);
      if (error) throw error;
      return (data ?? []) as {
        method: string; amount: number; status: string;
        settled_at: string | null; sale_id: string; created_at: string;
      }[];
    },
  });

  const stats = useMemo(() => {
    const sales = salesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const settled = payments.filter((p) => p.status === "settled");
    const revenue = settled.reduce((a, p) => a + Number(p.amount), 0);
    const pendingNota = payments
      .filter((p) => p.status === "pending" && p.method === "nota")
      .reduce((a, p) => a + Number(p.amount), 0);
    const salesCount = sales.length;
    const salesTotal = sales.reduce((a, s) => a + Number(s.total), 0);
    const avgTicket = salesCount > 0 ? salesTotal / salesCount : 0;
    return { revenue, pendingNota, salesCount, avgTicket };
  }, [salesQ.data, paymentsQ.data]);

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    (paymentsQ.data ?? []).forEach((p) => {
      map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount));
    });
    return Array.from(map.entries()).map(([method, value]) => ({
      name: METHOD_LABEL[method] ?? method,
      value,
    }));
  }, [paymentsQ.data]);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, sales: 0 }));
    (salesQ.data ?? []).forEach((s) => {
      const h = new Date(s.sold_at).getHours();
      buckets[h].sales += 1;
    });
    return buckets;
  }, [salesQ.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    (salesQ.data ?? []).forEach((s) => {
      const d = new Date(s.sold_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(s.total));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({
        day: new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        total: v,
      }));
  }, [salesQ.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral de {current?.company.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link to="/app/pos">
              <ShoppingCart className="mr-1 h-4 w-4" /> Nova venda
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Faturamento" value={brl(stats.revenue)} icon={TrendingUp} />
        <StatCard title="Vendas" value={stats.salesCount} icon={ShoppingCart} />
        <StatCard title="Ticket médio" value={brl(stats.avgTicket)} icon={Users} />
        <StatCard
          title="Nota em aberto"
          value={brl(stats.pendingNota)}
          icon={Package}
          hint="Não conta no faturamento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Vendas por forma de pagamento</CardTitle>
            <Select value={paymentChart} onValueChange={(v) => setPaymentChart(v as ChartStyle)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="donut">Rosquinha</SelectItem>
                <SelectItem value="pie">Pizza</SelectItem>
                <SelectItem value="bar">Barras</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-72">
            {byMethod.length === 0 ? (
              <EmptyState msg="Sem vendas no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {paymentChart === "bar" ? (
                  <BarChart data={byMethod}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => brl(v).replace("R$", "")} />
                    <RTooltip formatter={(v: number) => brl(v)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {byMethod.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={byMethod}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={paymentChart === "donut" ? 55 : 0}
                      paddingAngle={2}
                    >
                      {byMethod.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Horário de maior movimento</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(salesQ.data ?? []).length === 0 ? (
              <EmptyState msg="Sem vendas no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byHour}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="hour" fontSize={10} interval={2} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <RTooltip />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução do faturamento</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {byDay.length === 0 ? (
            <EmptyState msg="Sem vendas no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => brl(v).replace("R$", "")} />
                <RTooltip formatter={(v: number) => brl(v)} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title, value, icon: Icon, hint,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}
