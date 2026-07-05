import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  useEffect(() => {
    if (!current) return;
    setName(current.company.name);
    setDocument(current.company.document ?? "");
    setEmail(current.company.email ?? "");
    setPhone(current.company.phone ?? "");
  }, [current]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({ name, document: document || null, email: email || null, phone: phone || null })
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
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / documento</Label>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isManager} />
            </div>
            {isManager && (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>Salvar</Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
