import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert, Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/app/platform/admins")({
  head: () => ({ meta: [{ title: "Administradores da plataforma — TotalControle ERP" }] }),
  component: PlatformAdminsPage,
});

type AdminRow = { user_id: string; email: string; created_at: string };

function PlatformAdminsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

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
    queryKey: ["platform-admins"],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (n: string) => Promise<{ data: unknown; error: Error | null }>)("list_platform_admins");
      if (error) throw error;
      return (data as AdminRow[]) ?? [];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error("Informe um e-mail");
      const { data: found, error: findErr } = await (supabase.rpc as unknown as (n: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>)("find_user_by_email", { _email: clean });
      if (findErr) throw findErr;
      const row = (found as { user_id: string }[])?.[0];
      if (!row) throw new Error("Nenhum usuário encontrado com esse e-mail.");
      const { error } = await supabase.rpc("grant_platform_admin", { _user_id: row.user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Administrador adicionado");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.rpc("revoke_platform_admin", { _user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Administrador removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (admin.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Acesso restrito</CardTitle>
          <CardDescription>Somente administradores da plataforma podem acessar esta área.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administradores da plataforma</h1>
          <p className="text-sm text-muted-foreground">Quem tem acesso aos painéis globais (empresas, erros, chamados).</p>
        </div>
        <Button variant="outline" onClick={() => list.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conceder acesso</CardTitle>
          <CardDescription>O usuário precisa já ter uma conta no sistema.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") grant.mutate(); }}
            className="max-w-sm"
          />
          <Button onClick={() => grant.mutate()} disabled={grant.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Conta criada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : (list.data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nenhum administrador.</TableCell></TableRow>
            ) : (list.data ?? []).map((a) => (
              <TableRow key={a.user_id}>
                <TableCell className="font-medium">{a.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm" variant="ghost"
                    disabled={a.user_id === user?.id}
                    onClick={() => {
                      if (confirm(`Remover ${a.email} como administrador?`)) revoke.mutate(a.user_id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
