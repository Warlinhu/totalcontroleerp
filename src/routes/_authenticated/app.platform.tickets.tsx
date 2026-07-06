import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PriorityBadge, StatusBadge, TicketDetailDialog, TYPE_LABEL,
  type Ticket,
} from "./app.support";

export const Route = createFileRoute("/_authenticated/app/platform/tickets")({
  head: () => ({ meta: [{ title: "Chamados da plataforma — TotalControle ERP" }] }),
  component: PlatformTicketsPage,
});

type TicketWithCompany = Ticket & { company?: { name: string } | null };

function PlatformTicketsPage() {
  const { user } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const admin = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const stats = useQuery({
    queryKey: ["platform-ticket-stats"],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (n: string) => Promise<{ data: unknown; error: Error | null }>)("platform_ticket_stats");
      if (error) throw error;
      return (data as { total: number; open_count: number; in_progress_count: number; waiting_customer_count: number; resolved_count: number; critical_open: number }[])?.[0];
    },
  });

  const tickets = useQuery({
    queryKey: ["platform-tickets", statusFilter, typeFilter],
    enabled: admin.data === true,
    queryFn: async () => {
      let q = supabase
        .from("support_tickets" as never)
        .select("*, company:companies(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TicketWithCompany[];
    },
  });

  const filtered = useMemo(() => {
    const rows = tickets.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.company?.name ?? "").toLowerCase().includes(q) ||
        (r.module ?? "").toLowerCase().includes(q),
    );
  }, [tickets.data, search]);

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

  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chamados da plataforma</h1>
          <p className="text-sm text-muted-foreground">Todos os chamados abertos pelos clientes do ERP.</p>
        </div>
        <Button variant="outline" onClick={() => { tickets.refetch(); stats.refetch(); }}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={s?.total ?? 0} />
        <StatCard label="Abertos" value={s?.open_count ?? 0} />
        <StatCard label="Em andamento" value={s?.in_progress_count ?? 0} />
        <StatCard label="Aguardando cliente" value={s?.waiting_customer_count ?? 0} />
        <StatCard label="Resolvidos" value={s?.resolved_count ?? 0} />
        <StatCard label="Críticos abertos" value={s?.critical_open ?? 0} accent="destructive" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="waiting_customer">Aguardando cliente</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="bug">Erro / Bug</SelectItem>
              <SelectItem value="feature">Nova feature</SelectItem>
              <SelectItem value="change">Alteração</SelectItem>
              <SelectItem value="question">Dúvida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input placeholder="Título, empresa ou módulo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhum chamado.</TableCell></TableRow>
            ) : filtered.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                <TableCell className="font-medium">{t.company?.name ?? "—"}</TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABEL[t.type]}</Badge></TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(t.created_at).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <TicketDetailDialog ticket={selected} onClose={() => setSelected(null)} isAdminView />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
