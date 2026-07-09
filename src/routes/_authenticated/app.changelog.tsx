import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Sparkles, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/changelog")({
  head: () => ({ meta: [{ title: "Novidades — TotalControle ERP" }] }),
  component: ChangelogPage,
});

type Release = {
  id: string; version: string; title: string; summary: string;
  details: string | null; category: "bugfix" | "feature" | "melhoria";
  published_at: string;
};

const CAT: Record<Release["category"], { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "outline" }> = {
  bugfix: { label: "Correção", icon: Bug, variant: "secondary" },
  feature: { label: "Novidade", icon: Sparkles, variant: "default" },
  melhoria: { label: "Melhoria", icon: Wrench, variant: "outline" },
};

function ChangelogPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const releasesQ = useQuery({
    queryKey: ["releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_releases")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Release[];
    },
  });

  // Mark all as read on visit
  useEffect(() => {
    if (!user?.id || !releasesQ.data) return;
    (async () => {
      const rows = releasesQ.data.map((r) => ({ user_id: user.id, release_id: r.id }));
      if (rows.length === 0) return;
      await (supabase.from("user_release_reads") as unknown as {
        upsert: (p: unknown, o: unknown) => Promise<{ error: Error | null }>;
      }).upsert(rows, { onConflict: "user_id,release_id", ignoreDuplicates: true });
      qc.invalidateQueries({ queryKey: ["unread-releases", user.id] });
    })();
  }, [user?.id, releasesQ.data, qc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novidades e correções</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de atualizações do TotalControle ERP.
        </p>
      </div>

      <div className="space-y-3">
        {(releasesQ.data ?? []).map((r) => {
          const meta = CAT[r.category];
          const Icon = meta.icon;
          return (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {r.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <Badge variant="outline">v{r.version}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.published_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>{r.summary}</p>
                {r.details && <p className="whitespace-pre-wrap text-xs">{r.details}</p>}
              </CardContent>
            </Card>
          );
        })}
        {releasesQ.data && releasesQ.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
