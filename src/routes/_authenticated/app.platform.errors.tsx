import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/platform/errors")({
  head: () => ({ meta: [{ title: "Painel de erros — TotalControle ERP" }] }),
  component: PlatformErrorsPage,
});

type ErrorLog = {
  id: string;
  source: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  stack: string | null;
  route: string | null;
  user_agent: string | null;
  fingerprint: string;
  context: Record<string, unknown> | null;
  resolved_at: string | null;
  created_at: string;
  company_id: string | null;
};

function PlatformErrorsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ErrorLog | null>(null);

  const admin = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const logs = useQuery({
    queryKey: ["error-logs", statusFilter, severityFilter],
    enabled: admin.data === true,
    queryFn: async () => {
      let q = supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (statusFilter === "open") q = q.is("resolved_at", null);
      if (statusFilter === "resolved") q = q.not("resolved_at", "is", null);
      if (severityFilter !== "all") q = q.eq("severity", severityFilter as ErrorLog["severity"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ErrorLog[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (row: ErrorLog) => {
      const client = supabase.from("error_logs") as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      };
      const { error } = await client.update({
        resolved_at: row.resolved_at ? null : new Date().toISOString(),
        resolved_by: row.resolved_at ? null : user!.id,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["error-logs"] });
      toast.success("Registro atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (admin.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Acesso restrito</CardTitle>
          <CardDescription>Somente administradores da plataforma podem acessar este painel.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rows = logs.data ?? [];
  const openCount = rows.filter((r) => !r.resolved_at).length;
  const criticalCount = rows.filter((r) => r.severity === "critical" && !r.resolved_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monitoramento de erros</h1>
          <p className="text-sm text-muted-foreground">Painel global — visível apenas para administradores da plataforma.</p>
        </div>
        <Button variant="outline" onClick={() => logs.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Erros abertos" value={openCount} />
        <StatCard label="Críticos abertos" value={criticalCount} accent="destructive" />
        <StatCard label="Total exibido" value={rows.length} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Severidade</label>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="warning">Aviso</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">Nenhum erro registrado.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell><SeverityBadge severity={r.severity} /></TableCell>
                <TableCell className="font-mono text-xs">{r.source}</TableCell>
                <TableCell className="max-w-md truncate">{r.message}</TableCell>
                <TableCell className="font-mono text-xs">{r.route ?? "—"}</TableCell>
                <TableCell>{r.resolved_at ? <Badge variant="outline">Resolvido</Badge> : <Badge variant="secondary">Aberto</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); resolve.mutate(r); }}>
                    <Check className="mr-2 h-4 w-4" /> {r.resolved_at ? "Reabrir" : "Resolver"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do erro</DialogTitle>
            <DialogDescription>Fingerprint: <span className="font-mono text-xs">{selected?.fingerprint}</span></DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p><strong>Mensagem:</strong> {selected.message}</p>
              <p><strong>Rota:</strong> <span className="font-mono">{selected.route ?? "—"}</span></p>
              <p><strong>User-Agent:</strong> <span className="text-xs text-muted-foreground">{selected.user_agent ?? "—"}</span></p>
              {selected.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{selected.stack}</pre>
                </div>
              )}
              {selected.context && (
                <div>
                  <strong>Contexto:</strong>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(selected.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "destructive" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: ErrorLog["severity"] }) {
  const map = {
    critical: <Badge variant="destructive">Crítica</Badge>,
    error: <Badge className="bg-orange-600 hover:bg-orange-600">Erro</Badge>,
    warning: <Badge className="bg-amber-500 hover:bg-amber-500">Aviso</Badge>,
    info: <Badge variant="secondary">Info</Badge>,
  } as const;
  return map[severity];
}
