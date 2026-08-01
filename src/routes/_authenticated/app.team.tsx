import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, type CompanyRole } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/app/team")({
  head: () => ({ meta: [{ title: "Equipe — TotalControle ERP" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { currentCompanyId, isManager, currentRole } = useCompany();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("employee");

  const membersQ = useQuery({
    queryKey: ["members", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, user_id, role, created_at")
        .eq("company_id", currentCompanyId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invitesQ = useQuery({
    queryKey: ["invites", currentCompanyId],
    enabled: !!currentCompanyId && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invites")
        .select("id, email, role, token, expires_at, accepted_at, created_at")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_invites").insert({
        company_id: currentCompanyId!,
        email,
        role,
        invited_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite criado. Copie o link e envie ao usuário.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invites", currentCompanyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", currentCompanyId] }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: CompanyRole }) => {
      const { error } = await supabase.from("company_members").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", currentCompanyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", currentCompanyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/onboarding?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Gerencie membros e convites da empresa.</p>
      </div>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Convidar usuário</CardTitle>
            <CardDescription>Crie um convite e envie o link para a pessoa entrar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => { e.preventDefault(); createInvite.mutate(); }}
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="inviteEmail">E-mail</Label>
                <Input id="inviteEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="w-40 space-y-1.5">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createInvite.isPending}>Criar convite</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Membros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQ.data?.map((m) => {
                const isSelf = m.user_id === user.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.user_id === user.id ? "Você" : m.user_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      {isManager && !isSelf && m.role !== "owner" ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole.mutate({ id: m.id, role: v as CompanyRole })}
                        >
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="employee">Funcionário</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize">{labelRole(m.role)}</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {isManager && !isSelf && m.role !== "owner" && (
                        <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {currentRole && <p className="mt-3 text-xs text-muted-foreground">Seu papel: {labelRole(currentRole)}</p>}
        </CardContent>
      </Card>

      {isManager && (
      <Card>
        <CardHeader><CardTitle>Convites pendentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitesQ.data?.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{labelRole(inv.role)}</TableCell>
                  <TableCell>{inv.accepted_at ? "Aceito" : "Pendente"}</TableCell>
                  <TableCell>{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {!inv.accepted_at && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => copyInviteLink(inv.token)} title="Copiar link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <Button variant="ghost" size="icon" onClick={() => removeInvite.mutate(inv.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invitesQ.data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum convite.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function labelRole(r: CompanyRole) {
  return r === "owner" ? "Dono" : r === "admin" ? "Admin" : "Funcionário";
}
