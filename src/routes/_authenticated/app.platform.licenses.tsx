import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, Copy, ShieldAlert, RefreshCw, Ban } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/platform/licenses")({
  head: () => ({
    meta: [
      { title: "Licenças — TotalControle ERP" },
      { name: "description", content: "Gere e gerencie licenças de acesso manuais do TotalControle ERP." },
    ],
  }),
  component: LicensesPage,
});

type LicenseRow = {
  id: string;
  code: string;
  duration_days: number;
  amount_cents: number;
  target_email: string | null;
  notes: string | null;
  status: "unused" | "redeemed" | "revoked";
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `TC-${block(4)}-${block(4)}`;
}

function LicensesPage() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [amount, setAmount] = useState("50,00");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
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

  const list = useQuery({
    queryKey: ["platform-licenses"],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("id, code, duration_days, amount_cents, target_email, notes, status, redeemed_by, redeemed_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LicenseRow[];
    },
  });

  const create = async () => {
    const d = parseInt(days, 10);
    const cents = Math.round(parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!d || d < 1) return toast.error("Informe a duração em dias.");
    if (Number.isNaN(cents) || cents < 0) return toast.error("Informe um valor válido.");

    setSaving(true);
    const code = generateCode();
    const { error } = await supabase.from("licenses").insert({
      code,
      duration_days: d,
      amount_cents: cents,
      target_email: email.trim() || null,
      notes: notes.trim() || null,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) return toast.error("Falha ao gerar licença", { description: error.message });

    await navigator.clipboard.writeText(code).catch(() => undefined);
    toast.success(`Licença ${code} gerada`, { description: "Código copiado para a área de transferência." });
    setOpen(false);
    setEmail("");
    setNotes("");
    list.refetch();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("licenses").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error("Falha ao revogar", { description: error.message });
    toast.success("Licença revogada");
    list.refetch();
  };

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (admin.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Acesso restrito</CardTitle>
          <CardDescription>Somente administradores da plataforma podem gerar licenças.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rows = list.data ?? [];
  const unused = rows.filter((r) => r.status === "unused").length;
  const redeemed = rows.filter((r) => r.status === "redeemed");
  const revenue = redeemed.reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Licenças</h1>
          <p className="text-sm text-muted-foreground">
            Gere códigos de acesso com duração e valor personalizados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => list.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Gerar licença</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar nova licença</DialogTitle>
                <DialogDescription>O código é criado automaticamente e copiado ao salvar.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (dias)</Label>
                    <Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor cobrado (R$)</Label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>E-mail destino (opcional)</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="cliente@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Observação (opcional)</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cortesia parceiro" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[30, 90, 180, 365].map((d) => (
                    <Button key={d} type="button" size="sm" variant="secondary" onClick={() => setDays(String(d))}>
                      {d} dias
                    </Button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={create} disabled={saving}>{saving ? "Gerando..." : "Gerar e copiar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Licenças geradas" value={String(rows.length)} />
        <Stat label="Disponíveis" value={String(unused)} />
        <Stat label="Receita por licenças" value={formatBRL(revenue)} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma licença gerada ainda.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.code}
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => {
                        navigator.clipboard.writeText(r.code);
                        toast.success("Código copiado");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-right">{r.duration_days} dias</TableCell>
                <TableCell className="text-right">{formatBRL(r.amount_cents)}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.target_email ?? "—"}</div>
                  {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                </TableCell>
                <TableCell>
                  {r.status === "unused" ? <Badge variant="secondary">Disponível</Badge>
                    : r.status === "redeemed" ? (
                      <div>
                        <Badge>Resgatada</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString("pt-BR") : ""}
                        </div>
                      </div>
                    ) : <Badge variant="destructive">Revogada</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "unused" && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(r.id)}>
                      <Ban className="mr-1 h-3.5 w-3.5" /> Revogar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
