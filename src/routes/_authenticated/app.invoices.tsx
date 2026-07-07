import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";

type Invoice = {
  id: string;
  nfe_number: string;
  nfe_series: string | null;
  access_key: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_document: string | null;
  issue_date: string;
  total_amount: number;
  tax_amount: number;
  status: "issued" | "cancelled";
  xml_url: string | null;
  pdf_url: string | null;
  notes: string | null;
};

const NFE_PORTAL_URL = "https://www.nfe.fazenda.gov.br/portal/principal.aspx";
const today = () => new Date().toISOString().slice(0, 10);

export const Route = createFileRoute("/_authenticated/app/invoices")({
  head: () => ({ meta: [{ title: "Notas Fiscais — TotalControle ERP" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const crud = useEntityCrud<Invoice>("invoices");
  const { currentCompanyId } = useCompany();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "issued" | "cancelled">("all");

  const customers = useQuery({
    queryKey: ["customers-lite", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, document")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    nfe_number: "",
    nfe_series: "1",
    access_key: "",
    customer_id: "",
    customer_name: "",
    customer_document: "",
    issue_date: today(),
    total_amount: "0",
    tax_amount: "0",
    status: "issued" as "issued" | "cancelled",
    xml_url: "",
    pdf_url: "",
    notes: "",
  });

  useEffect(() => {
    if (crud.editing) {
      const e = crud.editing;
      setForm({
        nfe_number: e.nfe_number,
        nfe_series: e.nfe_series ?? "1",
        access_key: e.access_key ?? "",
        customer_id: e.customer_id ?? "",
        customer_name: e.customer_name,
        customer_document: e.customer_document ?? "",
        issue_date: e.issue_date,
        total_amount: String(e.total_amount ?? 0),
        tax_amount: String(e.tax_amount ?? 0),
        status: e.status,
        xml_url: e.xml_url ?? "",
        pdf_url: e.pdf_url ?? "",
        notes: e.notes ?? "",
      });
    } else {
      setForm({
        nfe_number: "", nfe_series: "1", access_key: "", customer_id: "",
        customer_name: "", customer_document: "", issue_date: today(),
        total_amount: "0", tax_amount: "0", status: "issued",
        xml_url: "", pdf_url: "", notes: "",
      });
    }
  }, [crud.editing, crud.formOpen]);

  const filtered = useMemo(() => {
    return crud.rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFrom && r.issue_date < dateFrom) return false;
      if (dateTo && r.issue_date > dateTo) return false;
      return true;
    });
  }, [crud.rows, statusFilter, dateFrom, dateTo]);

  const totalEmitted = filtered
    .filter((r) => r.status === "issued")
    .reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="issued">Emitidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}>
          Limpar
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total emitido no período</div>
            <div className="text-lg font-semibold">R$ {totalEmitted.toFixed(2)}</div>
          </div>
          <a href={NFE_PORTAL_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="default" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Emitir NF-e no Portal da Receita
            </Button>
          </a>
        </div>
      </div>

      <EntityList<Invoice>
        title="Notas Fiscais"
        description="Registro de NF-e emitidas com filtros por data e status."
        rows={filtered}
        loading={crud.loading}
        canManage={crud.canManage}
        columns={[
          {
            header: "Nº / Série",
            cell: (r) => (
              <div className="font-medium">
                {r.nfe_number}
                {r.nfe_series && <span className="text-xs text-muted-foreground"> / {r.nfe_series}</span>}
              </div>
            ),
          },
          { header: "Cliente", cell: (r) => r.customer_name },
          { header: "Emissão", cell: (r) => new Date(r.issue_date + "T00:00:00").toLocaleDateString("pt-BR") },
          { header: "Valor", cell: (r) => `R$ ${Number(r.total_amount).toFixed(2)}` },
          {
            header: "Status",
            cell: (r) =>
              r.status === "issued"
                ? <Badge>Emitida</Badge>
                : <Badge variant="destructive">Cancelada</Badge>,
          },
          {
            header: "",
            cell: (r) =>
              r.pdf_url ? (
                <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost">
                    <FileText className="h-4 w-4" />
                  </Button>
                </a>
              ) : null,
          },
        ]}
        emptyMessage="Nenhuma nota fiscal registrada neste período."
        onCreate={crud.openCreate}
        onEdit={crud.openEdit}
        onDelete={crud.remove}
        formOpen={crud.formOpen}
        onFormOpenChange={crud.setFormOpen}
        formTitle={crud.editing ? "Editar nota fiscal" : "Nova nota fiscal"}
        submitting={crud.submitting}
        onSubmit={async () => {
          await crud.save({
            nfe_number: form.nfe_number.trim(),
            nfe_series: form.nfe_series.trim() || null,
            access_key: form.access_key.trim() || null,
            customer_id: form.customer_id || null,
            customer_name: form.customer_name.trim(),
            customer_document: form.customer_document.trim() || null,
            issue_date: form.issue_date,
            total_amount: Number(form.total_amount) || 0,
            tax_amount: Number(form.tax_amount) || 0,
            status: form.status,
            xml_url: form.xml_url.trim() || null,
            pdf_url: form.pdf_url.trim() || null,
            notes: form.notes.trim() || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Número da NF-e *</Label>
            <Input required value={form.nfe_number} onChange={(e) => setForm({ ...form, nfe_number: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Série</Label>
            <Input value={form.nfe_series} onChange={(e) => setForm({ ...form, nfe_series: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Chave de acesso (44 dígitos)</Label>
            <Input value={form.access_key} onChange={(e) => setForm({ ...form, access_key: e.target.value })}
              maxLength={44} placeholder="Opcional" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={form.customer_id || "manual"}
              onValueChange={(v) => {
                if (v === "manual") {
                  setForm({ ...form, customer_id: "" });
                } else {
                  const c = customers.data?.find((x) => x.id === v);
                  setForm({
                    ...form,
                    customer_id: v,
                    customer_name: c?.name ?? form.customer_name,
                    customer_document: c?.document ?? form.customer_document,
                  });
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Digitar manualmente</SelectItem>
                {(customers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nome do cliente *</Label>
            <Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>CPF/CNPJ do cliente</Label>
            <Input value={form.customer_document} onChange={(e) => setForm({ ...form, customer_document: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de emissão *</Label>
            <Input type="date" required value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "issued" | "cancelled" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="issued">Emitida</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor total (R$) *</Label>
            <Input type="number" step="0.01" required value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Impostos (R$)</Label>
            <Input type="number" step="0.01" value={form.tax_amount}
              onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>URL do PDF (DANFE)</Label>
            <Input value={form.pdf_url} onChange={(e) => setForm({ ...form, pdf_url: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>URL do XML</Label>
            <Input value={form.xml_url} onChange={(e) => setForm({ ...form, xml_url: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </EntityList>
    </>
  );
}
