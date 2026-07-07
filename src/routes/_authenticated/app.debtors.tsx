import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";
import { InstallmentsDialog, buildInstallments, useInstallmentsCreator, formatDate } from "@/components/installments";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";

type Debtor = {
  id: string; name: string; document: string | null; description: string | null;
  total_amount: number; notes: string | null;
};

type InstallmentSummary = { debtor_id: string; total: number; paid: number; nextDue: string | null; overdue: number };

export const Route = createFileRoute("/_authenticated/app/debtors")({
  head: () => ({ meta: [{ title: "Devedores — TotalControle ERP" }] }),
  component: DebtorsPage,
});

function DebtorsPage() {
  const crud = useEntityCrud<Debtor>("debtors");
  const { currentCompanyId } = useCompany();
  const creator = useInstallmentsCreator();
  const [installmentsOpen, setInstallmentsOpen] = useState<Debtor | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [form, setForm] = useState({
    name: "", document: "", description: "", total_amount: "0",
    notes: "", parcels: "1", firstDue: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (crud.editing) {
      setForm({
        name: crud.editing.name,
        document: crud.editing.document ?? "",
        description: crud.editing.description ?? "",
        total_amount: String(crud.editing.total_amount ?? 0),
        notes: crud.editing.notes ?? "",
        parcels: "1",
        firstDue: new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm({ name: "", document: "", description: "", total_amount: "0", notes: "", parcels: "1", firstDue: new Date().toISOString().slice(0, 10) });
    }
  }, [crud.editing, crud.formOpen]);

  const summary = useQuery({
    queryKey: ["debtor-summary", currentCompanyId, crud.rows.map((r) => r.id).join(",")],
    enabled: !!currentCompanyId && crud.rows.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtor_installments")
        .select("debtor_id, amount, status, due_date")
        .eq("company_id", currentCompanyId!);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const map = new Map<string, InstallmentSummary>();
      (data ?? []).forEach((row) => {
        const s = map.get(row.debtor_id) ?? { debtor_id: row.debtor_id, total: 0, paid: 0, nextDue: null, overdue: 0 };
        s.total += 1;
        if (row.status === "paid") s.paid += 1;
        if (row.status === "pending") {
          if (!s.nextDue || row.due_date < s.nextDue) s.nextDue = row.due_date;
          if (row.due_date < today) s.overdue += 1;
        }
        map.set(row.debtor_id, s);
      });
      return { map, raw: data ?? [] };
    },
  });

  // Filtra devedores que possuem ao menos uma parcela no intervalo (por due_date)
  const filteredRows = crud.rows.filter((r) => {
    if (!dateFrom && !dateTo) return true;
    const parcels = summary.data?.raw.filter((p) => p.debtor_id === r.id) ?? [];
    if (parcels.length === 0) return false;
    return parcels.some((p) => {
      if (dateFrom && p.due_date < dateFrom) return false;
      if (dateTo && p.due_date > dateTo) return false;
      return true;
    });
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">Venc. de</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar</Button>
      </div>

      <EntityList<Debtor>
        title="Devedores"
        description="Registre pessoas que devem à sua empresa e acompanhe as parcelas."
        rows={filteredRows}
        loading={crud.loading}
        canManage={crud.canManage}
        columns={[
          { header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Documento", cell: (r) => r.document ?? "—" },
          { header: "Total", cell: (r) => `R$ ${Number(r.total_amount).toFixed(2)}` },
          {
            header: "Parcelas",
            cell: (r) => {
              const s = summary.data?.map.get(r.id);
              if (!s) return "—";
              return <span className="text-sm">{s.paid}/{s.total} pagas</span>;
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
                <HandCoins className="mr-2 h-4 w-4" /> Parcelas
              </Button>
            ),
          },
        ]}
        onCreate={crud.openCreate}
        onEdit={crud.openEdit}
        onDelete={crud.remove}
        formOpen={crud.formOpen}
        onFormOpenChange={crud.setFormOpen}
        formTitle={crud.editing ? "Editar devedor" : "Novo devedor"}
        submitting={crud.submitting || creator.isPending}
        onSubmit={async () => {
          const total = Number(form.total_amount) || 0;
          const created = await (async () => {
            if (crud.editing) {
              await crud.save({
                name: form.name.trim(),
                document: form.document.trim() || null,
                description: form.description.trim() || null,
                total_amount: total,
                notes: form.notes.trim() || null,
              });
              return null;
            }
            // Create manually so we can capture the new id and generate installments
            if (!currentCompanyId) return null;
            const { data, error } = await supabase
              .from("debtors")
              .insert({
                company_id: currentCompanyId,
                name: form.name.trim(),
                document: form.document.trim() || null,
                description: form.description.trim() || null,
                total_amount: total,
                notes: form.notes.trim() || null,
              })
              .select("id")
              .single();
            if (error) throw error;
            return data.id as string;
          })();

          if (created) {
            const parcels = Math.max(1, Number(form.parcels) || 1);
            const installments = buildInstallments(total, parcels, form.firstDue);
            await creator.mutateAsync({
              table: "debtor_installments",
              fk: "debtor_id",
              parentId: created,
              installments,
            });
            crud.setFormOpen(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome do devedor *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>CPF/CNPJ</Label>
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor total (R$) *</Label>
            <Input type="number" step="0.01" required value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        title={installmentsOpen ? `Parcelas — ${installmentsOpen.name}` : ""}
        parentId={installmentsOpen?.id ?? null}
        installmentTable="debtor_installments"
        parentFk="debtor_id"
        canManage={crud.canManage}
      />
    </>
  );
}
