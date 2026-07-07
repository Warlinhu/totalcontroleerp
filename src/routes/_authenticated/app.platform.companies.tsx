import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert, Building2, Users, Ban, RotateCcw, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/platform/companies")({
  head: () => ({ meta: [{ title: "Empresas cadastradas — TotalControle ERP" }] }),
  component: PlatformCompaniesPage,
});

type CompanyRow = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  suspended_at: string | null;
  member_count: number;
  owner_email: string | null;
  open_tickets: number;
  open_errors: number;
};

function PlatformCompaniesPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CompanyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    queryKey: ["platform-companies"],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_company_overview");
      if (error) throw error;
      return (data ?? []) as unknown as CompanyRow[];
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.owner_email ?? "").toLowerCase().includes(q) ||
        (r.document ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const now = Date.now();
  const last30 = rows.filter((r) => now - new Date(r.created_at).getTime() < 30 * 86400e3).length;
  const totalMembers = rows.reduce((s, r) => s + Number(r.member_count ?? 0), 0);
  const suspendedCount = rows.filter((r) => r.suspended_at).length;

  const runAction = async (fn: string, id: string, successMsg: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc(fn as "platform_suspend_company", { _company_id: id });
    setBusyId(null);
    if (error) {
      toast.error("Ação falhou", { description: error.message });
    } else {
      toast.success(successMsg);
      list.refetch();
    }
  };

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (admin.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Acesso restrito</CardTitle>
          <CardDescription>Somente administradores da plataforma podem ver as empresas cadastradas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas cadastradas</h1>
          <p className="text-sm text-muted-foreground">
            Painel global — gerencie todas as empresas do sistema.
          </p>
        </div>
        <Button variant="outline" onClick={() => list.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={Building2} label="Total de empresas" value={rows.length} />
        <StatCard icon={Building2} label="Novas em 30 dias" value={last30} />
        <StatCard icon={Users} label="Total de usuários" value={totalMembers} />
        <StatCard icon={Ban} label="Suspensas" value={suspendedCount} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nome, e-mail do dono ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead className="text-right">Chamados</TableHead>
              <TableHead className="text-right">Erros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className={r.suspended_at ? "opacity-60" : undefined}>
                <TableCell className="font-medium">
                  <div>{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Criada em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.document ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.owner_email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.email ?? ""} {r.phone ?? ""}</div>
                </TableCell>
                <TableCell className="text-right"><Badge variant="secondary">{r.member_count}</Badge></TableCell>
                <TableCell className="text-right">
                  {Number(r.open_tickets) > 0 ? <Badge>{r.open_tickets}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-right">
                  {Number(r.open_errors) > 0 ? <Badge variant="destructive">{r.open_errors}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell>
                  {r.suspended_at ? (
                    <Badge variant="destructive">Suspensa</Badge>
                  ) : (
                    <Badge variant="secondary">Ativa</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" disabled={busyId === r.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.suspended_at ? (
                        <DropdownMenuItem onClick={() => runAction("platform_unsuspend_company", r.id, "Empresa reativada")}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reativar empresa
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => runAction("platform_suspend_company", r.id, "Empresa suspensa")}>
                          <Ban className="mr-2 h-4 w-4" /> Suspender empresa
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDelete(r)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir empresa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Todos os dados (clientes, produtos, financeiro, notas, membros e histórico) serão apagados. Considere suspender em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                await runAction("platform_delete_company", confirmDelete.id, "Empresa excluída");
                setConfirmDelete(null);
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
