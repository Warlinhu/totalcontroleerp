import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityList } from "@/components/entity-list";
import { useEntityCrud } from "@/lib/use-entity-crud";

type Product = {
  id: string; name: string; sku: string | null; description: string | null;
  kind: "product" | "service"; price: number; stock: number | null; active: boolean;
};

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({ meta: [{ title: "Produtos/Serviços — TotalControle ERP" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const crud = useEntityCrud<Product>("products");
  const [form, setForm] = useState({
    name: "", sku: "", description: "", kind: "product" as "product" | "service",
    price: "0", stock: "", active: true,
  });

  useEffect(() => {
    if (crud.editing) {
      setForm({
        name: crud.editing.name,
        sku: crud.editing.sku ?? "",
        description: crud.editing.description ?? "",
        kind: crud.editing.kind,
        price: String(crud.editing.price ?? 0),
        stock: crud.editing.stock == null ? "" : String(crud.editing.stock),
        active: crud.editing.active,
      });
    } else {
      setForm({ name: "", sku: "", description: "", kind: "product", price: "0", stock: "", active: true });
    }
  }, [crud.editing, crud.formOpen]);

  return (
    <EntityList<Product>
      title="Produtos e Serviços"
      description="Catálogo de produtos e serviços da empresa."
      rows={crud.rows}
      loading={crud.loading}
      canManage={crud.canManage}
      columns={[
        { header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { header: "Tipo", cell: (r) => <Badge variant="secondary">{r.kind === "service" ? "Serviço" : "Produto"}</Badge> },
        { header: "SKU", cell: (r) => r.sku ?? "—" },
        { header: "Preço", cell: (r) => `R$ ${Number(r.price).toFixed(2)}` },
        { header: "Estoque", cell: (r) => (r.kind === "service" ? "—" : (r.stock ?? 0)) },
        { header: "Status", cell: (r) => (r.active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>) },
      ]}
      onCreate={crud.openCreate}
      onEdit={crud.openEdit}
      onDelete={crud.remove}
      formOpen={crud.formOpen}
      onFormOpenChange={crud.setFormOpen}
      formTitle={crud.editing ? "Editar produto" : "Novo produto"}
      submitting={crud.submitting}
      onSubmit={() =>
        crud.save({
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          description: form.description.trim() || null,
          kind: form.kind,
          price: Number(form.price) || 0,
          stock: form.stock === "" ? null : Number(form.stock),
          active: form.active,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nome *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "product" | "service" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Produto</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>SKU</Label>
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Preço (R$) *</Label>
          <Input type="number" step="0.01" required value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Estoque</Label>
          <Input type="number" step="1" value={form.stock} disabled={form.kind === "service"}
            onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          <Label>Ativo</Label>
        </div>
      </div>
    </EntityList>
  );
}
