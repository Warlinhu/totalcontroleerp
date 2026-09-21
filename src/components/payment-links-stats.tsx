import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StatRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  amount_cents: number;
  active: boolean;
  clicks: number;
  approved: number;
  revenue_cents: number;
};

export function PaymentLinksStats() {
  const stats = useQuery({
    queryKey: ["payment-link-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("payment_link_stats");
      if (error) throw error;
      return (data ?? []) as StatRow[];
    },
  });

  const rows = stats.data ?? [];
  const totalClicks = rows.reduce((s, r) => s + Number(r.clicks), 0);
  const totalApproved = rows.reduce((s, r) => s + Number(r.approved), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue_cents), 0);
  const conv = (a: number, c: number) => (c > 0 ? `${((a / c) * 100).toFixed(1)}%` : "—");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Desempenho dos links
          </CardTitle>
          <CardDescription>
            Cliques, pagamentos aprovados, conversão e receita de cada link de pagamento.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => stats.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Mini label="Cliques" value={String(totalClicks)} />
          <Mini label="Pagamentos aprovados" value={String(totalApproved)} />
          <Mini label="Conversão geral" value={conv(totalApproved, totalClicks)} />
          <Mini label="Receita" value={formatBRL(totalRevenue)} />
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Aprovados</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum link criado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{r.code}</span>
                        {!r.active && <Badge variant="outline">inativo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(r.amount_cents)}</TableCell>
                    <TableCell className="text-right">{Number(r.clicks)}</TableCell>
                    <TableCell className="text-right">{Number(r.approved)}</TableCell>
                    <TableCell className="text-right">{conv(Number(r.approved), Number(r.clicks))}</TableCell>
                    <TableCell className="text-right font-medium">{formatBRL(Number(r.revenue_cents))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
