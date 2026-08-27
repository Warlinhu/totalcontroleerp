import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ShieldAlert, Save, Eye, EyeOff, ExternalLink, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/platform/payments")({
  head: () => ({
    meta: [
      { title: "Pagamentos — Painel do desenvolvedor" },
      {
        name: "description",
        content: "Cadastre suas credenciais de recebimento e ative a cobrança automática das assinaturas.",
      },
      { property: "og:title", content: "Pagamentos — Painel do desenvolvedor" },
      {
        property: "og:description",
        content: "Vincule a conta de recebimento ao sistema de assinaturas do TotalControle ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformPaymentsPage,
});

type Settings = {
  id: string;
  provider: string;
  access_token: string | null;
  public_key: string | null;
  mode: string;
  payout_email: string | null;
  enabled: boolean;
  updated_at: string;
};

function PlatformPaymentsPage() {
  const { user } = useSession();

  const adminQ = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const settingsQ = useQuery({
    queryKey: ["payment-settings"],
    enabled: adminQ.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("id, provider, access_token, public_key, mode, payout_email, enabled, updated_at")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  const [token, setToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [mode, setMode] = useState("production");
  const [enabled, setEnabled] = useState(false);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setToken(s.access_token ?? "");
    setPublicKey(s.public_key ?? "");
    setPayoutEmail(s.payout_email ?? "");
    setMode(s.mode ?? "production");
    setEnabled(s.enabled);
  }, [settingsQ.data]);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/webhooks/mercadopago` : "";

  const save = async () => {
    const clean = token.trim();
    if (enabled && !clean) {
      toast.error("Informe o Access Token antes de ativar a cobrança.");
      return;
    }
    if (clean && !/^(APP_USR|TEST)-/.test(clean)) {
      toast.error("Access Token inválido", {
        description: "O token do Mercado Pago começa com APP_USR- (produção) ou TEST- (teste).",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("payment_settings")
      .update({
        access_token: clean || null,
        public_key: publicKey.trim() || null,
        payout_email: payoutEmail.trim() || null,
        mode,
        enabled,
        updated_by: user?.id ?? null,
      })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Credenciais salvas", {
      description: enabled ? "A cobrança automática está ativa." : "Cobrança automática desativada.",
    });
    await settingsQ.refetch();
  };

  if (adminQ.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (adminQ.data !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Acesso restrito
          </CardTitle>
          <CardDescription>Esta área é exclusiva dos administradores da plataforma.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const configured = !!settingsQ.data?.access_token && settingsQ.data.enabled;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CreditCard className="h-6 w-6" /> Pagamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincule sua conta de recebimento ao sistema de assinaturas.
          </p>
        </div>
        <Badge variant={configured ? "default" : "secondary"}>
          {configured ? "Cobrança ativa" : "Não configurado"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mercado Pago (Checkout Pro)</CardTitle>
          <CardDescription>
            API gratuita — você só paga a taxa do Mercado Pago por venda recebida. Aceita PIX, boleto e cartão,
            e o valor cai direto na sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Onde encontrar suas credenciais</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Entre no Portal do Desenvolvedor do Mercado Pago com a sua conta.</li>
              <li>Em “Suas integrações”, crie uma aplicação do tipo Pagamentos online / Checkout Pro.</li>
              <li>Abra “Credenciais de produção” e copie o Access Token e a Public Key.</li>
            </ol>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer">
                Abrir painel do Mercado Pago <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Access Token</Label>
            <div className="flex gap-2">
              <Input
                id="token"
                type={show ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="APP_USR-..."
                className="font-mono"
                autoComplete="off"
              />
              <Button variant="outline" size="icon" onClick={() => setShow((v) => !v)} aria-label="Mostrar token">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Guardado com segurança e visível apenas para administradores da plataforma.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pk">Public Key (opcional)</Label>
              <Input
                id="pk"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="APP_USR-xxxx-xxxx"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail de recebimento</Label>
              <Input
                id="email"
                type="email"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch id="mode" checked={mode === "sandbox"} onCheckedChange={(v) => setMode(v ? "sandbox" : "production")} />
              <Label htmlFor="mode" className="cursor-pointer">
                Modo de teste (sandbox)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="enabled" className="cursor-pointer">
                Ativar cobrança automática
              </Label>
            </div>
          </div>

          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar credenciais"}
          </Button>

          {configured && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Assinaturas mensais e anuais já estão cobrando por esta conta.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook de confirmação</CardTitle>
          <CardDescription>
            Cole esta URL em “Notificações / Webhooks” da sua aplicação no Mercado Pago (evento: Pagamentos).
            Ela libera o acesso do cliente automaticamente assim que o pagamento é aprovado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("URL copiada");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
