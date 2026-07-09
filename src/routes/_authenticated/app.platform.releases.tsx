import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/platform/releases")({
  head: () => ({ meta: [{ title: "Publicar releases — TotalControle ERP" }] }),
  component: ReleasesAdmin,
});

type Release = {
  id: string; version: string; title: string; summary: string;
  details: string | null; category: "bugfix" | "feature" | "melhoria";
  published_at: string;
};

function ReleasesAdmin() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    version: "", title: "", summary: "", details: "",
    category: "melhoria" as Release["category"],
  });

  const isAdmin = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_platform_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const releasesQ = useQuery({
    queryKey: ["releases-admin"],
    enabled: !!isAdmin.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_releases").select("*").order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Release[];
    },
  });

  const submit = async () => {
    if (!form.version || !form.title || !form.summary) {
      toast.error("Versão, título e resumo são obrigatórios");
      return;
    }
    const { error } = await supabase.from("app_releases").insert({
      version: form.version.trim(),
      title: form.title.trim(),
      summary: form.summary.trim(),
      details: form.details.trim() || null,
      category: form.category,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Release publicado");
    setForm({ version: "", title: "", summary: "", details: "", category: "melhoria" });
    qc.invalidateQueries({ queryKey: ["releases-admin"] });
    qc.invalidateQueries({ queryKey: ["releases"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("app_releases").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["releases-admin"] });
    qc.invalidateQueries({ queryKey: ["releases"] });
  };

  if (isAdmin.isLoading) return null;
  if (!isAdmin.data) return <p className="text-sm text-muted-foreground">Acesso restrito a administradores da plataforma.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Publicar releases</h1>
        <p className="text-sm text-muted-foreground">
          Cada release aparece no Changelog e gera notificação para os usuários.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nova entrada</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Versão *</Label>
            <Input placeholder="1.4.1" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Release["category"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bugfix">Correção</SelectItem>
                <SelectItem value="feature">Novidade</SelectItem>
                <SelectItem value="melhoria">Melhoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Resumo (aparece na notificação) *</Label>
            <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Detalhes (opcional)</Label>
            <Textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Button onClick={submit}>Publicar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Releases publicados</h2>
        {(releasesQ.data ?? []).map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between p-3 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">v{r.version}</Badge>
                  <span className="font-medium truncate">{r.title}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.summary}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
