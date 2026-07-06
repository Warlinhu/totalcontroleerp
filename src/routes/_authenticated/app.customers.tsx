import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";

type Customer = {
  id: string; name: string; document: string | null; email: string | null;
  phone: string | null; address: string | null; notes: string | null;
};

export const Route = createFileRoute("/_authenticated/app/customers")({
  head: () => ({ meta: [{ title: "Clientes — TotalControle ERP" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const crud = useEntityCrud<Customer>("customers");
  const [form, setForm] = useState({ name: "", document: "", email: "", phone: "", address: "", notes: "" });

  useEffect(() => {
    if (crud.editing) {
      setForm({
        name: crud.editing.name,
        document: crud.editing.document ?? "",
        email: crud.editing.email ?? "",
        phone: crud.editing.phone ?? "",
        address: crud.editing.address ?? "",
        notes: crud.editing.notes ?? "",
      });
    } else {
      setForm({ name: "", document: "", email: "", phone: "", address: "", notes: "" });
    }
  }, [crud.editing, crud.formOpen]);

  return (
    <EntityList<Customer>
      title="Clientes"
      description="Base de clientes da empresa."
      rows={crud.rows}
      loading={crud.loading}
      canManage={crud.canManage}
      columns={[
        { header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { header: "Documento", cell: (r) => r.document ?? "—" },
        { header: "E-mail", cell: (r) => r.email ?? "—" },
        { header: "Telefone", cell: (r) => r.phone ?? "—" },
      ]}
      onCreate={crud.openCreate}
      onEdit={crud.openEdit}
      onDelete={crud.remove}
      formOpen={crud.formOpen}
      onFormOpenChange={crud.setFormOpen}
      formTitle={crud.editing ? "Editar cliente" : "Novo cliente"}
      submitting={crud.submitting}
      onSubmit={() =>
        crud.save({
          name: form.name.trim(),
          document: form.document.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
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
          <Label>CPF/CNPJ</Label>
          <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Endereço</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
    </EntityList>
  );
}
