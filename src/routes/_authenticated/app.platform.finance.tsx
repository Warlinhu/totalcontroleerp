import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Plus, TrendingUp, Receipt, Wallet, Calculator, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { formatBRL } from "@/lib/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/platform/finance")({
  head: () => ({
    meta: [
      { title: "Financeiro da plataforma — TotalControle ERP" },
      { name: "description", content: "Receita das assinaturas, despesas dedutíveis e sugestão de apuração de impostos." },
    ],
  }),
  component: PlatformFinancePage,
});

const CATEGORIES = [
  "infraestrutura", "marketing", "software", "contabilidade",
  "taxas de pagamento", "equipamentos", "pro-labore", "outros",
];

type Payment = { id: string; amount_cents: number; paid_at: string | null; cycle: string; status: string };
type Expense = {
  id: string; description: string; category: string; amount_cents: number;
  incurred_on: string; deductible: boolean; notes: string | null;
};
type Bracket = {
  id: string; regime: string; label: string; annual_limit_cents: number;
  rate_pct: number; deduction_cents: number; sort_order: number;
};

function PlatformFinancePage() {
  const { user } = useSession();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "", category: "infraestrutura", amount: "",
    incurred_on: new Date().toISOString().slice(0, 10), deductible: true, notes: "",
  });
  const [saving, setSaving] = useState(false);

  const admin = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const payments = useQuery({
    queryKey: ["platform-payments", year],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount_cents, paid_at, cycle, status")
        .eq("status", "approved")
        .gte("paid_at", `${from}T00:00:00Z`)
        .lte("paid_at", `${to}T23:59:59Z`);
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const licenses = useQuery({
    queryKey: ["platform-license-revenue", year],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("amount_cents, redeemed_at, status")
        .eq("status", "redeemed")
        .gte("redeemed_at", `${from}T00:00:00Z`)
        .lte("redeemed_at", `${to}T23:59:59Z`);
      if (error) throw error;
      return (data ?? []) as { amount_cents: number; redeemed_at: string | null }[];
    },
  });

  const expenses = useQuery({
    queryKey: ["platform-expenses", year],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_expenses")
        .select("id, description, category, amount_cents, incurred_on, deductible, notes")
        .gte("incurred_on", from)
        .lte("incurred_on", to)
        .order("incurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const brackets = useQuery({
    queryKey: ["tax-brackets"],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_brackets")
        .select("id, regime, label, annual_limit_cents, rate_pct, deduction_cents, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bracket[];
    },
  });

  const subsRevenue = (payments.data ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const licRevenue = (licenses.data ?? []).reduce((s, l) => s + l.amount_cents, 0);
  const revenue = subsRevenue + licRevenue;
  const expenseRows = expenses.data ?? [];
  const totalExpenses = expenseRows.reduce((s, e) => s + e.amount_cents, 0);
  const deductible = expenseRows.filter((e) => e.deductible).reduce((s, e) => s + e.amount_cents, 0);
  const nonDeductible = totalExpenses - deductible;
  const profit = revenue - totalExpenses;

  const tax = useMemo(() => {
    const rows = (brackets.data ?? []).filter((b) => b.regime.toLowerCase() === "simples_iii");
    if (rows.length === 0 || revenue === 0) return null;
    const band = rows.find((b) => revenue <= b.annual_limit_cents) ?? rows[rows.length - 1];
    const nominal = (revenue * Number(band.rate_pct)) / 100 - band.deduction_cents;
    const due = Math.max(0, Math.round(nominal));
    const effective = revenue > 0 ? (due / revenue) * 100 : 0;
    return { band, due, effective };
  }, [brackets.data, revenue]);

  const monthly = useMemo(() => {
    const acc = Array.from({ length: 12 }, () => ({ rev: 0, exp: 0 }));
    for (const p of payments.data ?? []) {
      if (!p.paid_at) continue;
      acc[new Date(p.paid_at).getMonth()].rev += p.amount_cents;
    }
    for (const l of licenses.data ?? []) {
      if (!l.redeemed_at) continue;
      acc[new Date(l.redeemed_at).getMonth()].rev += l.amount_cents;
    }
    for (const e of expenseRows) {
      acc[Number(e.incurred_on.slice(5, 7)) - 1].exp += e.amount_cents;
    }
    return acc;
  }, [payments.data, licenses.data, expenseRows]);

  const addExpense = async () => {
    const cents = Math.round(parseFloat(form.amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!form.description.trim()) return toast.error("Informe a descrição.");
    if (Number.isNaN(cents) || cents <= 0) return toast.error("Informe um valor válido.");
    setSaving(true);
    const { error } = await supabase.from("platform_expenses").insert({
      description: form.description.trim(),
      category: form.category,
      amount_cents: cents,
      incurred_on: form.incurred_on,
      deductible: form.deductible,
      notes: form.notes.trim() || null,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) return toast.error("Falha ao salvar", { description: error.message });
    toast.success("Despesa registrada");
    setOpen(false);
    setForm({ ...form, description: "", amount: "", notes: "" });
    expenses.refetch();
  };

  const removeExpense = async (id: string) => {
    const { error } = await supabase.from("platform_expenses").delete().eq("id", id);
    if (error) return toast.error("Falha ao excluir", { description: error.message });
    toast.success("Despesa excluída");
    expenses.refetch();
  };

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (admin.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Acesso restrito</CardTitle>
          <CardDescription>Somente administradores da plataforma podem ver o financeiro.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const maxBar = Math.max(1, ...monthly.map((m) => Math.max(m.rev, m.exp)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro da plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Receita das assinaturas, despesas dedutíveis e apuração sugerida de impostos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { payments.refetch(); licenses.refetch(); expenses.refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label={`Receita ${year}`} value={formatBRL(revenue)} hint={`Assinaturas ${formatBRL(subsRevenue)} · Licenças ${formatBRL(licRevenue)}`} />
        <Stat icon={Receipt} label="Despesas" value={formatBRL(totalExpenses)} hint={`Dedutíveis ${formatBRL(deductible)}`} />
        <Stat icon={Wallet} label="Lucro" value={formatBRL(profit)} hint={revenue ? `Margem ${((profit / revenue) * 100).toFixed(1)}%` : "—"} />
        <Stat icon={Calculator} label="Imposto estimado" value={tax ? formatBRL(tax.due) : "—"} hint={tax ? `${tax.band.label} · efetiva ${tax.effective.toFixed(2)}%` : "Sem faixas cadastradas"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita x despesas por mês</CardTitle>
          <CardDescription>Valores realizados em {year}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            {monthly.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(m.rev / maxBar) * 100}%` }} title={formatBRL(m.rev)} />
                  <div className="w-1/2 rounded-t bg-destructive/60" style={{ height: `${(m.exp / maxBar) * 100}%` }} title={formatBRL(m.exp)} />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> Receita</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/60" /> Despesas</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sugestão para declaração de impostos</CardTitle>
          <CardDescription>
            Estimativa informativa baseada no Simples Nacional (Anexo III). Confirme sempre com seu contador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tax ? (
            <>
              <Row label="Receita bruta acumulada (RBT12 aproximada)" value={formatBRL(revenue)} />
              <Row label="Faixa aplicável" value={`${tax.band.label} — alíquota nominal ${Number(tax.band.rate_pct).toFixed(2)}%`} />
              <Row label="Parcela a deduzir" value={formatBRL(tax.band.deduction_cents)} />
              <Row label="Imposto estimado no ano" value={formatBRL(tax.due)} strong />
              <Row label="Alíquota efetiva" value={`${tax.effective.toFixed(2)}%`} />
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">Como economizar legalmente</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Registre <strong>todas</strong> as despesas da operação: hospedagem, domínios, ferramentas SaaS, taxas do gateway e contabilidade. Hoje há {formatBRL(deductible)} marcados como dedutíveis{nonDeductible > 0 ? ` e ${formatBRL(nonDeductible)} fora da dedução` : ""}.</li>
                  <li>As taxas do Mercado Pago são custo operacional — lance-as mensalmente para reduzir o lucro tributável.</li>
                  <li>No Anexo III, manter a folha (pró-labore + encargos) próxima de 28% da receita costuma reduzir a alíquota efetiva pelo Fator R. Sua folha registrada é {formatBRL(expenseRows.filter((e) => e.category === "pro-labore").reduce((s, e) => s + e.amount_cents, 0))}.</li>
                  <li>Guarde nota fiscal de cada despesa por 5 anos; sem documento, a dedução não se sustenta em fiscalização.</li>
                  <li>Provisione mensalmente {tax ? formatBRL(Math.round(tax.due / 12)) : "—"} para o DAS e evite juros por atraso.</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Cadastre as faixas do regime tributário para ver a estimativa, ou registre receita no período.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Despesas</CardTitle>
            <CardDescription>Lançamentos que reduzem o lucro tributável.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar despesa</DialogTitle>
                <DialogDescription>Use categorias consistentes para facilitar a apuração.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Hospedagem mensal" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={form.incurred_on} onChange={(e) => setForm({ ...form, incurred_on: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observação (opcional)</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.deductible}
                    onChange={(e) => setForm({ ...form, deductible: e.target.checked })}
                  />
                  Despesa dedutível
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={addExpense} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Dedutível</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : expenseRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma despesa em {year}.</TableCell></TableRow>
            ) : expenseRows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{new Date(`${e.incurred_on}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">
                  <div>{e.description}</div>
                  {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                </TableCell>
                <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                <TableCell className="text-right">{formatBRL(e.amount_cents)}</TableCell>
                <TableCell>{e.deductible ? <Badge>Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => removeExpense(e.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-muted p-2"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : undefined}>{value}</span>
    </div>
  );
}
