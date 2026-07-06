import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Installment = {
  id: string;
  sequence: number;
  due_date: string;
  amount: number;
  status: "pending" | "paid" | "overdue" | "canceled";
  paid_at: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  parentId: string | null;
  installmentTable: "debtor_installments" | "payable_installments";
  parentFk: "debtor_id" | "payable_id";
  canManage: boolean;
};

export function InstallmentsDialog({
  open, onOpenChange, title, parentId, installmentTable, parentFk, canManage,
}: Props) {
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const q = useQuery({
    queryKey: [installmentTable, parentId],
    enabled: !!parentId && open,
    queryFn: async () => {
      const client = supabase.from(installmentTable) as unknown as {
        select: (s: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Installment[] | null; error: Error | null }> } };
      };
      const { data, error } = await client.select("*").eq(parentFk, parentId!).order("sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Installment[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [installmentTable, parentId] });
    qc.invalidateQueries({ queryKey: [installmentTable === "debtor_installments" ? "debtors" : "payables", currentCompanyId] });
    qc.invalidateQueries({ queryKey: ["reminders", currentCompanyId] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats", currentCompanyId] });
  };

  const togglePaid = useMutation({
    mutationFn: async (row: Installment) => {
      const paid = row.status !== "paid";
      const client = supabase.from(installmentTable) as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      };
      const { error } = await client.update({
        status: paid ? "paid" : "pending",
        paid_at: paid ? new Date().toISOString() : null,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInst = useMutation({
    mutationFn: async (row: Installment) => {
      const { error } = await supabase.from(installmentTable).delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const addInst = useMutation({
    mutationFn: async () => {
      if (!parentId || !currentCompanyId) throw new Error("Registro inválido");
      if (!newDueDate) throw new Error("Informe o vencimento");
      const amt = Number(newAmount);
      if (!(amt > 0)) throw new Error("Informe um valor válido");
      const nextSeq = ((q.data ?? []).reduce((m, r) => Math.max(m, r.sequence), 0) || 0) + 1;
      const payload = {
        [parentFk]: parentId,
        company_id: currentCompanyId,
        sequence: nextSeq,
        due_date: newDueDate,
        amount: amt,
      };
      const client = supabase.from(installmentTable) as unknown as {
        insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
      };
      const { error } = await client.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewAmount("");
      setNewDueDate("");
      invalidate();
      toast.success("Parcela adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Gerencie as parcelas deste registro.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center py-6 text-sm text-muted-foreground">
                    Nenhuma parcela.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const overdue = r.status === "pending" && r.due_date < today;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.sequence}</TableCell>
                      <TableCell>{formatDate(r.due_date)}</TableCell>
                      <TableCell>R$ {Number(r.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        {r.status === "paid" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Paga</Badge>
                        ) : overdue ? (
                          <Badge variant="destructive">Em atraso</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => togglePaid.mutate(r)} title={r.status === "paid" ? "Marcar como pendente" : "Marcar como paga"}>
                            {r.status === "paid" ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeInst.mutate(r)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {canManage && (
          <form
            className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-2 border-t")}
            onSubmit={(e) => { e.preventDefault(); addInst.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} required />
            </div>
            <Button type="submit" disabled={addInst.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar parcela
            </Button>
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** Given total amount + parcel count + first due, produce evenly split installments (last row absorbs rounding). */
export function buildInstallments(
  total: number,
  count: number,
  firstDue: string,
): { sequence: number; due_date: string; amount: number }[] {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor((total * 100) / n) / 100;
  const remainder = Math.round((total - base * n) * 100) / 100;
  const [y, m, d] = firstDue.split("-").map(Number);
  const result: { sequence: number; due_date: string; amount: number }[] = [];
  for (let i = 0; i < n; i++) {
    const date = new Date(Date.UTC(y, (m - 1) + i, d));
    const iso = date.toISOString().slice(0, 10);
    const amt = i === n - 1 ? Math.round((base + remainder) * 100) / 100 : base;
    result.push({ sequence: i + 1, due_date: iso, amount: amt });
  }
  return result;
}

export function useInstallmentsCreator() {
  const { currentCompanyId } = useCompany();
  return useMutation({
    mutationFn: async (args: {
      table: "debtor_installments" | "payable_installments";
      fk: "debtor_id" | "payable_id";
      parentId: string;
      installments: { sequence: number; due_date: string; amount: number }[];
    }) => {
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      const rows = args.installments.map((i) => ({
        ...i,
        [args.fk]: args.parentId,
        company_id: currentCompanyId,
      }));
      const client = supabase.from(args.table) as unknown as {
        insert: (p: Record<string, unknown>[]) => Promise<{ error: Error | null }>;
      };
      const { error } = await client.insert(rows);
      if (error) throw error;
    },
  });
}

/** Track installment schedule inputs in a form-state helper (kept simple). */
export function useInstallmentSchedule(defaults?: { count?: number; firstDue?: string }) {
  const [count, setCount] = useState(String(defaults?.count ?? 1));
  const [firstDue, setFirstDue] = useState(defaults?.firstDue ?? new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (defaults?.count) setCount(String(defaults.count));
    if (defaults?.firstDue) setFirstDue(defaults.firstDue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { count, setCount, firstDue, setFirstDue };
}
