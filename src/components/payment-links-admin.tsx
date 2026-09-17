import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export type PaymentLinkRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: "subscription" | "lifetime";
  amount_cents: number;
  currency: string;
  duration_days: number | null;
  show_on_home: boolean;
  highlight: boolean;
  active: boolean;
  created_at: string;
};

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function parseCents(v: string) {
  return Math.round(parseFloat(v.replace(/\./g, "").replace(",", ".")) * 100);
}

export function PaymentLinksAdmin({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("497,00");
  const [kind, setKind] = useState<"subscription" | "lifetime">("lifetime");
  const [days, setDays] = useState("365");
  const [description, setDescription] = useState("");
  const [onHome, setOnHome] = useState(true);
  const [saving, setSaving] = useState(false);

  const list = useQuery({
    queryKey: ["payment-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_links")
        .select("id, code, name, description, kind, amount_cents, currency, duration_days, show_on_home, highlight, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentLinkRow[];
    },
  });

  const publicUrl = (c: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/assinatura?oferta=${c}`;

  const create = async () => {
    const cents = parseCents(amount);
    const slug = slugify(code || name);
    if (!name.trim()) return toast.error("Informe o nome da oferta.");
    if (!slug) return toast.error("Informe um identificador para o link.");
    if (Number.isNaN(cents) || cents <= 0) return toast.error("Informe um valor válido.");
    const dur = kind === "lifetime" ? null : parseInt(days, 10);
    if (kind === "subscription" && (!dur || dur < 1)) return toast.error("Informe a duração em dias.");

    setSaving(true);
    const { error } = await supabase.from("payment_links").insert({
      code: slug,
      name: name.trim(),
      description: description.trim() || null,
      kind,
      amount_cents: cents,
      duration_days: dur,
      show_on_home: onHome,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error("Falha ao criar o link", { description: error.message });

    await navigator.clipboard.writeText(publicUrl(slug)).catch(() => undefined);
    toast.success("Link criado", { description: "O endereço foi copiado para a área de transferência." });
    setOpen(false);
    setName("");
    setCode("");
    setDescription("");
    list.refetch();
  };

  const patch = async (id: string, values: Partial<PaymentLinkRow>) => {
    const { error } = await supabase.from("payment_links").update(values).eq("id", id);
    if (error) return toast.error("Falha ao atualizar", { description: error.message });
    list.refetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payment_links").delete().eq("id", id);
    if (error) return toast.error("Falha ao excluir", { description: error.message });
    toast.success("Link removido");
    list.refetch();
  };

  const rows = list.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Links de pagamento
          </CardTitle>
          <CardDescription>
            Crie quantos links quiser, com valor próprio. Marque para aparecer na página inicial e
            escolha entre acesso por período ou licença definitiva.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => list.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo link</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo link de pagamento</DialogTitle>
                <DialogDescription>
                  O valor definido aqui é o cobrado do cliente e o exibido na página inicial.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Nome da oferta</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Licença vitalícia" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Identificador do link</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={slugify(name) || "vitalicia"} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={kind === "lifetime" ? "default" : "secondary"} onClick={() => setKind("lifetime")}>
                      Licença definitiva
                    </Button>
                    <Button type="button" size="sm" variant={kind === "subscription" ? "default" : "secondary"} onClick={() => setKind("subscription")}>
                      Acesso por período
                    </Button>
                  </div>
                </div>
                {kind === "subscription" && (
                  <div className="space-y-2">
                    <Label>Duração (dias)</Label>
                    <Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pagamento único, acesso para sempre" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm">Mostrar na página inicial</div>
                  <Switch checked={onHome} onCheckedChange={setOnHome} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={create} disabled={saving}>{saving ? "Criando..." : "Criar e copiar link"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oferta</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Página inicial</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum link criado ainda.
                </TableCell>
              </TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">/assinatura?oferta={r.code}</div>
                </TableCell>
                <TableCell className="text-right font-medium">{formatBRL(r.amount_cents)}</TableCell>
                <TableCell>
                  {r.kind === "lifetime"
                    ? <Badge>Definitivo</Badge>
                    : <Badge variant="secondary">{r.duration_days} dias</Badge>}
                </TableCell>
                <TableCell>
                  <Switch checked={r.show_on_home} onCheckedChange={(v) => patch(r.id, { show_on_home: v })} />
                </TableCell>
                <TableCell>
                  <Switch checked={r.active} onCheckedChange={(v) => patch(r.id, { active: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl(r.code));
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
