import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/components/installments";

export const Route = createFileRoute("/_authenticated/app/reminders")({
  head: () => ({ meta: [{ title: "Lembretes — TotalControle ERP" }] }),
  component: RemindersPage,
});

type Item = {
  id: string;
  kind: "debtor" | "payable";
  parentName: string;
  sequence: number;
  due_date: string;
  amount: number;
  overdue: boolean;
};

function RemindersPage() {
  const { currentCompanyId, isManager } = useCompany();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["reminders", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [dRes, pRes] = await Promise.all([
        supabase
          .from("debtor_installments")
          .select("id, sequence, due_date, amount, status, debtors:debtors!inner(name)")
          .eq("company_id", currentCompanyId!)
          .eq("status", "pending")
          .lte("due_date", in30)
          .order("due_date"),
        supabase
          .from("payable_installments")
          .select("id, sequence, due_date, amount, status, payables:payables!inner(description)")
          .eq("company_id", currentCompanyId!)
          .eq("status", "pending")
          .lte("due_date", in30)
          .order("due_date"),
      ]);
      if (dRes.error) throw dRes.error;
      if (pRes.error) throw pRes.error;
      const today = new Date().toISOString().slice(0, 10);
      const debtors: Item[] = (dRes.data ?? []).map((r) => ({
        id: r.id, kind: "debtor" as const, sequence: r.sequence, due_date: r.due_date,
        amount: Number(r.amount),
        parentName: (r.debtors as { name: string } | { name: string }[] | null && ((Array.isArray(r.debtors) ? r.debtors[0]?.name : (r.debtors as { name: string })?.name))) || "—",
        overdue: r.due_date < today,
      }));
      const payables: Item[] = (pRes.data ?? []).map((r) => ({
        id: r.id, kind: "payable" as const, sequence: r.sequence, due_date: r.due_date,
        amount: Number(r.amount),
        parentName: (Array.isArray(r.payables) ? r.payables[0]?.description : (r.payables as { description: string })?.description) || "—",
        overdue: r.due_date < today,
      }));
      return { debtors, payables };
    },
  });

  const markPaid = useMutation({
    mutationFn: async (item: Item) => {
      const table = item.kind === "debtor" ? "debtor_installments" : "payable_installments";
      const client = supabase.from(table) as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      };
      const { error } = await client.update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", currentCompanyId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats", currentCompanyId] });
      qc.invalidateQueries({ queryKey: ["debtor_installments"] });
      qc.invalidateQueries({ queryKey: ["payable_installments"] });
      toast.success("Parcela marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data ?? { debtors: [], payables: [] };
  const totalToReceive = data.debtors.reduce((s, i) => s + i.amount, 0);
  const totalToPay = data.payables.reduce((s, i) => s + i.amount, 0);
  const overdueCount = data.debtors.filter((i) => i.overdue).length + data.payables.filter((i) => i.overdue).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lembretes de vencimento</h1>
        <p className="text-sm text-muted-foreground">Parcelas pendentes nos próximos 30 dias.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Em atraso" value={overdueCount} icon={<AlertTriangle className="h-4 w-4" />} accent="destructive" />
        <SummaryCard title="A receber (30 dias)" value={`R$ ${totalToReceive.toFixed(2)}`} icon={<CalendarClock className="h-4 w-4" />} />
        <SummaryCard title="A pagar (30 dias)" value={`R$ ${totalToPay.toFixed(2)}`} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <ReminderTable
        title="A receber (Devedores)"
        items={data.debtors}
        loading={q.isLoading}
        onMarkPaid={isManager ? (i) => markPaid.mutate(i) : undefined}
      />

      <ReminderTable
        title="A pagar (Contas)"
        items={data.payables}
        loading={q.isLoading}
        onMarkPaid={isManager ? (i) => markPaid.mutate(i) : undefined}
      />
    </div>
  );
}

function SummaryCard({ title, value, icon, accent }: { title: string; value: number | string; icon: React.ReactNode; accent?: "destructive" }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={accent === "destructive" ? "text-destructive" : "text-muted-foreground"}>{icon}</div>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function ReminderTable({ title, items, loading, onMarkPaid }: {
  title: string; items: Item[]; loading: boolean; onMarkPaid?: (i: Item) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{items.length} parcela(s) pendente(s)</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              {onMarkPaid && <TableHead className="text-right">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Nenhuma parcela pendente.</TableCell></TableRow>
            ) : items.map((i) => (
              <TableRow key={`${i.kind}-${i.id}`}>
                <TableCell className="font-medium">{i.parentName}</TableCell>
                <TableCell>#{i.sequence}</TableCell>
                <TableCell>{formatDate(i.due_date)}</TableCell>
                <TableCell>R$ {i.amount.toFixed(2)}</TableCell>
                <TableCell>
                  {i.overdue ? <Badge variant="destructive">Em atraso</Badge> : <Badge variant="secondary">Pendente</Badge>}
                </TableCell>
                {onMarkPaid && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onMarkPaid(i)}>
                      <Check className="mr-2 h-4 w-4" /> Marcar paga
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
