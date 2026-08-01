import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { classifyDocument, fetchCnpjInfo, maskDocument, onlyDigits } from "@/lib/br-document";
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
  const [lookingUp, setLookingUp] = useState(false);

  const docKind = useMemo(() => classifyDocument(document), [document]);

  const lookupCnpj = async () => {
    setLookingUp(true);
    try {
      const info = await fetchCnpjInfo(document);
      setCompanyName(info.nome_fantasia || info.razao_social || companyName);
      toast.success("Dados encontrados na Receita Federal");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na consulta");
    } finally {
      setLookingUp(false);
    }
  };


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
    const { data: companyId, error } = await supabase.rpc("accept_company_invite", { _token: search.invite });
    setBusy(false);

    if (error || !companyId) {
      const message = getInviteErrorMessage(error?.message);
      toast.error(message);
      return;
    }

    await refresh();
    setCurrentCompanyId(companyId);
    toast.success("Convite aceito!");
    navigate({ to: "/app", replace: true });
  };

  const getInviteErrorMessage = (message?: string) => {
    if (!message || message.includes("invalid_invite")) return "Convite inválido ou expirado";
    if (message.includes("invite_already_used")) return "Este convite já foi utilizado";
    if (message.includes("invite_expired")) return "Este convite expirou";
    if (message.includes("invite_email_mismatch")) return "Entre com o e-mail que recebeu este convite";
    if (message.includes("not_authenticated")) return "Entre na sua conta para aceitar o convite";
    return "Não foi possível aceitar o convite";
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
                <Input id="cname" required maxLength={120} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdoc">CNPJ / CPF (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="cdoc"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={document}
                    onChange={(e) => setDocument(maskDocument(e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={docKind !== "cnpj" || lookingUp}
                    onClick={lookupCnpj}
                    title="Consultar CNPJ na Receita Federal"
                  >
                    {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {docKind === "invalid" ? (
                  <p className="text-xs text-destructive">CNPJ ou CPF inválido — confira os dígitos.</p>
                ) : docKind !== "empty" ? (
                  <p className="text-xs text-muted-foreground">{docKind === "cnpj" ? "CNPJ válido" : "CPF válido"}</p>
                ) : null}
              </div>
              <Button type="submit" disabled={busy || companyName.trim().length < 2 || docKind === "invalid"} className="w-full">
                Criar empresa
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
