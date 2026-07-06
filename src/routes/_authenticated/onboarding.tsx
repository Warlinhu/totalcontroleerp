import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const searchSchema = z.object({ invite: z.string().optional() });

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Bem-vindo — TotalControle ERP" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const { memberships, loading, refresh, setCurrentCompanyId } = useCompany();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [document, setDocument] = useState("");
  const [busy, setBusy] = useState(false);

  // If already has a company and no explicit invite pending, go to app.
  useEffect(() => {
    if (loading) return;
    if (!search.invite && memberships.length > 0) {
      navigate({ to: "/app", replace: true });
    }
  }, [loading, memberships, search.invite, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({ name: companyName, document: document || null, created_by: user.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error("Não foi possível criar a empresa", { description: error.message });
      return;
    }
    await refresh();
    if (data?.id) setCurrentCompanyId(data.id);
    toast.success("Empresa criada!");
    navigate({ to: "/app", replace: true });
  };

  const handleAcceptInvite = async () => {
    if (!search.invite) return;
    setBusy(true);
    const { data: invite, error: fetchErr } = await supabase
      .from("company_invites")
      .select("id, company_id, role, expires_at, accepted_at, email")
      .eq("token", search.invite)
      .maybeSingle();
    if (fetchErr || !invite) {
      setBusy(false);
      toast.error("Convite inválido ou expirado");
      return;
    }
    if (invite.accepted_at) {
      setBusy(false);
      toast.error("Este convite já foi utilizado");
      return;
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      setBusy(false);
      toast.error("Este convite expirou");
      return;
    }
    const { error: memberErr } = await supabase
      .from("company_members")
      .insert({ company_id: invite.company_id, user_id: user.id, role: invite.role });
    if (memberErr) {
      setBusy(false);
      toast.error("Não foi possível aceitar o convite", { description: memberErr.message });
      return;
    }
    await supabase.from("company_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    await refresh();
    setCurrentCompanyId(invite.company_id);
    setBusy(false);
    toast.success("Convite aceito!");
    navigate({ to: "/app", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {memberships.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
            ← Voltar para o sistema
          </Button>
        )}
        {search.invite && (
          <Card>
            <CardHeader>
              <CardTitle>Você foi convidado</CardTitle>
              <CardDescription>Aceite para entrar na empresa que te convidou.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAcceptInvite} disabled={busy} className="w-full">
                Aceitar convite
              </Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Criar sua empresa</CardTitle>
            <CardDescription>
              {search.invite
                ? "Ou crie uma nova empresa ao invés de aceitar o convite."
                : "Vamos configurar sua primeira empresa no TotalControle."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cname">Nome da empresa</Label>
                <Input id="cname" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdoc">CNPJ / documento (opcional)</Label>
                <Input id="cdoc" value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy || !companyName} className="w-full">
                Criar empresa
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
