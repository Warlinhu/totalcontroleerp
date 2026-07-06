import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";

type Employee = {
  id: string; name: string; document: string | null; role_title: string | null;
  email: string | null; phone: string | null; salary: number | null;
  hired_at: string | null; active: boolean; notes: string | null;
};

export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({ meta: [{ title: "Funcionários — TotalControle ERP" }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const crud = useEntityCrud<Employee>("employees");
  const [form, setForm] = useState({
    name: "", document: "", role_title: "", email: "", phone: "",
    salary: "", hired_at: "", active: true, notes: "",
  });

  useEffect(() => {
    if (crud.editing) {
      setForm({
        name: crud.editing.name,
        document: crud.editing.document ?? "",
        role_title: crud.editing.role_title ?? "",
        email: crud.editing.email ?? "",
        phone: crud.editing.phone ?? "",
        salary: crud.editing.salary == null ? "" : String(crud.editing.salary),
        hired_at: crud.editing.hired_at ?? "",
        active: crud.editing.active,
        notes: crud.editing.notes ?? "",
      });
    } else {
      setForm({ name: "", document: "", role_title: "", email: "", phone: "", salary: "", hired_at: "", active: true, notes: "" });
    }
  }, [crud.editing, crud.formOpen]);

  return (
    <EntityList<Employee>
      title="Funcionários"
      description="Cadastro de colaboradores da empresa."
      rows={crud.rows}
      loading={crud.loading}
      canManage={crud.canManage}
      columns={[
        { header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { header: "Cargo", cell: (r) => r.role_title ?? "—" },
        { header: "E-mail", cell: (r) => r.email ?? "—" },
        { header: "Salário", cell: (r) => (r.salary == null ? "—" : `R$ ${Number(r.salary).toFixed(2)}`) },
        { header: "Status", cell: (r) => (r.active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>) },
      ]}
      onCreate={crud.openCreate}
      onEdit={crud.openEdit}
      onDelete={crud.remove}
      formOpen={crud.formOpen}
      onFormOpenChange={crud.setFormOpen}
      formTitle={crud.editing ? "Editar funcionário" : "Novo funcionário"}
      submitting={crud.submitting}
      onSubmit={() =>
        crud.save({
          name: form.name.trim(),
          document: form.document.trim() || null,
          role_title: form.role_title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          salary: form.salary === "" ? null : Number(form.salary),
          hired_at: form.hired_at || null,
          active: form.active,
          notes: form.notes.trim() || null,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nome *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>CPF</Label>
          <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Salário (R$)</Label>
          <Input type="number" step="0.01" value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Data de admissão</Label>
          <Input type="date" value={form.hired_at}
            onChange={(e) => setForm({ ...form, hired_at: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          <Label>Ativo</Label>
        </div>
      </div>
    </EntityList>
  );
}
