import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  classifyDocument,
  fetchCnpjInfo,
  isValidEmail,
  isValidPhone,
  maskDocument,
  maskPhone,
  onlyDigits,
} from "@/lib/br-document";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Configurações — TotalControle ERP" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { current, isManager, refresh } = useCompany();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setName(current.company.name);
    setDocument(current.company.document ? maskDocument(current.company.document) : "");
    setEmail(current.company.email ?? "");
    setPhone(current.company.phone ? maskPhone(current.company.phone) : "");
  }, [current]);

  const docKind = useMemo(() => classifyDocument(document), [document]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e["name"] = "Informe o nome da empresa (mínimo 2 caracteres).";
    if (name.trim().length > 120) e["name"] = "Nome muito longo (máximo 120 caracteres).";
    if (docKind === "invalid") e["document"] = "CNPJ ou CPF inválido — confira os dígitos.";
    if (email.trim() && !isValidEmail(email)) e["email"] = "E-mail inválido.";
    if (phone.trim() && !isValidPhone(phone)) e["phone"] = "Telefone deve ter DDD + 8 ou 9 dígitos.";
    return e;
  }, [name, docKind, email, phone]);

  const hasErrors = Object.keys(errors).length > 0;

  const lookupCnpj = async () => {
    setLookingUp(true);
    setCnpjStatus(null);
    try {
      const info = await fetchCnpjInfo(document);
      setName(info.nome_fantasia || info.razao_social || name);
      if (info.email) setEmail(info.email);
      if (info.telefone) setPhone(maskPhone(info.telefone));
      setCnpjStatus(
        [info.situacao, [info.municipio, info.uf].filter(Boolean).join("/")].filter(Boolean).join(" · "),
      );
      toast.success("Dados encontrados na Receita Federal");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na consulta");
    } finally {
      setLookingUp(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        document: document ? onlyDigits(document) : null,
        email: email.trim() || null,
        phone: phone ? onlyDigits(phone) : null,
      })
      .eq("id", current.company_id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Empresa atualizada");
      await refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da empresa</h1>
        <p className="text-sm text-muted-foreground">Dados básicos que aparecem no sistema.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Empresa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={!isManager} />
              {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / CPF</Label>
              <div className="flex gap-2">
                <Input
                  value={document}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  onChange={(e) => { setDocument(maskDocument(e.target.value)); setCnpjStatus(null); }}
                  disabled={!isManager}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isManager || docKind !== "cnpj" || lookingUp}
                  onClick={lookupCnpj}
                  title="Consultar CNPJ na Receita Federal"
                >
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {errors["document"] ? (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {errors["document"]}
                </p>
              ) : docKind !== "empty" ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {docKind === "cnpj" ? "CNPJ válido" : "CPF válido"}
                  {cnpjStatus ? ` · ${cnpjStatus}` : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} disabled={!isManager} />
              {errors["email"] && <p className="text-xs text-destructive">{errors["email"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={phone}
                inputMode="tel"
                placeholder="(11) 99999-9999"
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                disabled={!isManager}
              />
              {errors["phone"] && <p className="text-xs text-destructive">{errors["phone"]}</p>}
            </div>
            {isManager && (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy || hasErrors}>Salvar</Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
