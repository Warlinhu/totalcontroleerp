import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
  member_count: number;
  owner_email: string | null;
  open_tickets: number;
  open_errors: number;
};

function PlatformCompaniesPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");

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
            Painel global — todas as empresas que se cadastraram no sistema.
          </p>
        </div>
        <Button variant="outline" onClick={() => list.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Total de empresas" value={rows.length} />
        <StatCard icon={Building2} label="Novas nos últimos 30 dias" value={last30} />
        <StatCard icon={Users} label="Total de usuários" value={totalMembers} />
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
              <TableHead>Contato</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead>Cadastrada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.document ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.owner_email ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.phone ?? ""}</div>
                </TableCell>
                <TableCell className="text-right"><Badge variant="secondary">{r.member_count}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
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
