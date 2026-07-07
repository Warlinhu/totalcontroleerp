import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";
import { InstallmentsDialog, buildInstallments, useInstallmentsCreator, formatDate } from "@/components/installments";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";

type Payable = {
  id: string; description: string; supplier_id: string | null;
  total_amount: number; notes: string | null;
};

type Summary = { total: number; paid: number; nextDue: string | null; overdue: number };

export const Route = createFileRoute("/_authenticated/app/payables")({
  head: () => ({ meta: [{ title: "Contas a pagar — TotalControle ERP" }] }),
  component: PayablesPage,
});

function PayablesPage() {
  const crud = useEntityCrud<Payable>("payables");
  const { currentCompanyId } = useCompany();
  const creator = useInstallmentsCreator();
  const [installmentsOpen, setInstallmentsOpen] = useState<Payable | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const suppliers = useQuery({
    queryKey: ["suppliers-lite", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    description: "", supplier_id: "", total_amount: "0", notes: "",
    parcels: "1", firstDue: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (crud.editing) {
      setForm({
        description: crud.editing.description,
        supplier_id: crud.editing.supplier_id ?? "",
        total_amount: String(crud.editing.total_amount ?? 0),
        notes: crud.editing.notes ?? "",
        parcels: "1",
        firstDue: new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm({ description: "", supplier_id: "", total_amount: "0", notes: "", parcels: "1", firstDue: new Date().toISOString().slice(0, 10) });
    }
  }, [crud.editing, crud.formOpen]);

  const summary = useQuery({
    queryKey: ["payable-summary", currentCompanyId, crud.rows.map((r) => r.id).join(",")],
    enabled: !!currentCompanyId && crud.rows.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payable_installments")
        .select("payable_id, status, due_date")
        .eq("company_id", currentCompanyId!);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const map = new Map<string, Summary>();
      (data ?? []).forEach((row) => {
        const s = map.get(row.payable_id) ?? { total: 0, paid: 0, nextDue: null, overdue: 0 };
        s.total += 1;
        if (row.status === "paid") s.paid += 1;
        if (row.status === "pending") {
          if (!s.nextDue || row.due_date < s.nextDue) s.nextDue = row.due_date;
          if (row.due_date < today) s.overdue += 1;
        }
        map.set(row.payable_id, s);
      });
      return { map, raw: data ?? [] };
    },
  });

  const filteredRows = crud.rows.filter((r) => {
    if (!dateFrom && !dateTo) return true;
    const parcels = summary.data?.raw.filter((p) => p.payable_id === r.id) ?? [];
    if (parcels.length === 0) return false;
    return parcels.some((p) => {
      if (dateFrom && p.due_date < dateFrom) return false;
      if (dateTo && p.due_date > dateTo) return false;
      return true;
    });
  });

  const supplierName = (id: string | null) => suppliers.data?.find((s) => s.id === id)?.name ?? "—";

  return (
    <>
      <EntityList<Payable>
        title="Contas a pagar"
        description="Registre despesas e obrigações com fornecedores."
        rows={filteredRows}
        loading={crud.loading}
        canManage={crud.canManage}
        columns={[
          { header: "Descrição", cell: (r) => <span className="font-medium">{r.description}</span> },
          { header: "Fornecedor", cell: (r) => supplierName(r.supplier_id) },
          { header: "Total", cell: (r) => `R$ ${Number(r.total_amount).toFixed(2)}` },
          {
            header: "Parcelas",
            cell: (r) => {
              const s = summary.data?.map.get(r.id);
              return s ? `${s.paid}/${s.total} pagas` : "—";
            },
          },
          {
            header: "Próx. venc.",
            cell: (r) => {
              const s = summary.data?.map.get(r.id);
              if (!s?.nextDue) return "—";
              return (
                <div className="flex items-center gap-2">
                  <span>{formatDate(s.nextDue)}</span>
                  {s.overdue > 0 && <Badge variant="destructive">{s.overdue} em atraso</Badge>}
                </div>
              );
            },
          },
          {
            header: "",
            cell: (r) => (
              <Button size="sm" variant="outline" onClick={() => setInstallmentsOpen(r)}>
                <Receipt className="mr-2 h-4 w-4" /> Parcelas
              </Button>
            ),
          },
        ]}
        onCreate={crud.openCreate}
        onEdit={crud.openEdit}
        onDelete={crud.remove}
        formOpen={crud.formOpen}
        onFormOpenChange={crud.setFormOpen}
        formTitle={crud.editing ? "Editar conta a pagar" : "Nova conta a pagar"}
        submitting={crud.submitting || creator.isPending}
        onSubmit={async () => {
          const total = Number(form.total_amount) || 0;
          const createdId = await (async () => {
            if (crud.editing) {
              await crud.save({
                description: form.description.trim(),
                supplier_id: form.supplier_id || null,
                total_amount: total,
                notes: form.notes.trim() || null,
              });
              return null;
            }
            if (!currentCompanyId) return null;
            const { data, error } = await supabase
              .from("payables")
              .insert({
                company_id: currentCompanyId,
                description: form.description.trim(),
                supplier_id: form.supplier_id || null,
                total_amount: total,
                notes: form.notes.trim() || null,
              })
              .select("id")
              .single();
            if (error) throw error;
            return data.id as string;
          })();

          if (createdId) {
            const parcels = Math.max(1, Number(form.parcels) || 1);
            const installments = buildInstallments(total, parcels, form.firstDue);
            await creator.mutateAsync({
              table: "payable_installments",
              fk: "payable_id",
              parentId: createdId,
              installments,
            });
            crud.setFormOpen(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição *</Label>
            <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem fornecedor</SelectItem>
                {(suppliers.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor total (R$) *</Label>
            <Input type="number" step="0.01" required value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>
          {!crud.editing && (
            <>
              <div className="space-y-1.5">
                <Label>Nº de parcelas</Label>
                <Input type="number" min="1" value={form.parcels}
                  onChange={(e) => setForm({ ...form, parcels: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Primeiro vencimento</Label>
                <Input type="date" value={form.firstDue}
                  onChange={(e) => setForm({ ...form, firstDue: e.target.value })} />
              </div>
            </>
          )}
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </EntityList>

      <InstallmentsDialog
        open={!!installmentsOpen}
        onOpenChange={(o) => !o && setInstallmentsOpen(null)}
        title={installmentsOpen ? `Parcelas — ${installmentsOpen.description}` : ""}
        parentId={installmentsOpen?.id ?? null}
        installmentTable="payable_installments"
        parentFk="payable_id"
        canManage={crud.canManage}
      />
    </>
  );
}
