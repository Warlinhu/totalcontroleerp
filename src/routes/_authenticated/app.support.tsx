import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MessageSquare, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/support")({
  head: () => ({ meta: [{ title: "Chamados — TotalControle ERP" }] }),
  component: SupportPage,
});

type Ticket = {
  id: string;
  company_id: string;
  created_by: string;
  type: "bug" | "feature" | "change" | "question";
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  module: string | null;
  title: string;
  description: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin_reply: boolean;
  body: string;
  created_at: string;
};

const TYPE_LABEL: Record<Ticket["type"], string> = {
  bug: "Erro / Bug",
  feature: "Nova feature",
  change: "Alteração",
  question: "Dúvida",
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando você",
  resolved: "Resolvido",
  closed: "Fechado",
};

function SupportPage() {
  const { currentCompanyId } = useCompany();
  const { user } = useSession();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const tickets = useQuery({
    queryKey: ["support-tickets", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as never)
        .select("*")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: { title: string; description: string; type: Ticket["type"]; priority: Ticket["priority"]; module: string }) => {
      const { error } = await (supabase.from("support_tickets" as never) as never as {
        insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
      }).insert({
        ...payload,
        company_id: currentCompanyId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets", currentCompanyId] });
      toast.success("Chamado aberto! Nossa equipe responderá em breve.");
      setFormOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = tickets.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Central de chamados</h1>
          <p className="text-sm text-muted-foreground">
            Reporte erros, solicite novas features ou tire dúvidas com nossa equipe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => tickets.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo chamado
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Aberto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhum chamado ainda.</TableCell></TableRow>
            ) : rows.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABEL[t.type]}</Badge></TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.module ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(t.created_at).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <TicketFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        submitting={create.isPending}
        onSubmit={(v) => create.mutate(v)}
      />

      <TicketDetailDialog
        ticket={selected}
        onClose={() => setSelected(null)}
        isAdminView={false}
      />
    </div>
  );
}

export function TicketFormDialog({
  open, onOpenChange, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  submitting: boolean;
  onSubmit: (v: { title: string; description: string; type: Ticket["type"]; priority: Ticket["priority"]; module: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Ticket["type"]>("bug");
  const [priority, setPriority] = useState<Ticket["priority"]>("medium");
  const [module, setModule] = useState("");

  const submit = () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim(), type, priority, module: module.trim() });
    setTitle(""); setDescription(""); setModule(""); setType("bug"); setPriority("medium");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo chamado</DialogTitle>
          <DialogDescription>Descreva o que precisa. Quanto mais detalhes, melhor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as Ticket["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Erro / Bug</SelectItem>
                  <SelectItem value="feature">Nova feature</SelectItem>
                  <SelectItem value="change">Alteração</SelectItem>
                  <SelectItem value="question">Dúvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Ticket["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Módulo (opcional)</label>
            <Input placeholder="Ex.: Devedores, Contas a pagar..." value={module} onChange={(e) => setModule(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Resumo do problema ou pedido" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={4000} placeholder="Descreva o que acontece, passos para reproduzir, ou como imagina a feature" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Enviando..." : "Abrir chamado"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TicketDetailDialog({
  ticket, onClose, isAdminView,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  isAdminView: boolean;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const messages = useQuery({
    queryKey: ["ticket-messages", ticket?.id],
    enabled: !!ticket,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages" as never)
        .select("*")
        .eq("ticket_id", ticket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TicketMessage[];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("support_ticket_messages" as never) as never as {
        insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
      }).insert({
        ticket_id: ticket!.id,
        author_id: user!.id,
        is_admin_reply: isAdminView,
        body: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-messages", ticket!.id] });
      setReply("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: Ticket["status"]) => {
      const { error } = await (supabase.from("support_tickets" as never) as never as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      }).update({
        status,
        resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
        resolved_by: status === "resolved" || status === "closed" ? user!.id : null,
      }).eq("id", ticket!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["platform-tickets"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ticket) return null;

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> {ticket.title}
          </DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="outline">{TYPE_LABEL[ticket.type]}</Badge>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
              {ticket.module && <Badge variant="secondary">{ticket.module}</Badge>}
              <span className="text-xs text-muted-foreground">
                Aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-3 whitespace-pre-wrap">{ticket.description}</div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {messages.data?.map((m) => (
              <div
                key={m.id}
                className={`rounded-md border p-2 text-sm ${m.is_admin_reply ? "border-primary/40 bg-primary/5" : "bg-muted/40"}`}
              >
                <div className="mb-1 text-xs text-muted-foreground">
                  {m.is_admin_reply ? "Equipe" : "Cliente"} — {new Date(m.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
            {(messages.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda.</p>
            )}
          </div>

          <Textarea
            placeholder="Escreva uma mensagem..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {isAdminView && (
                <>
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("in_progress")}>Em andamento</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("waiting_customer")}>Aguardar cliente</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("resolved")}>Resolvido</Button>
                  <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate("closed")}>Fechar</Button>
                </>
              )}
              {!isAdminView && ticket.status !== "closed" && (
                <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate("closed")}>Marcar como resolvido</Button>
              )}
            </div>
            <Button size="sm" disabled={!reply.trim() || post.isPending} onClick={() => post.mutate()}>
              {post.isPending ? "Enviando..." : "Enviar resposta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PriorityBadge({ priority }: { priority: Ticket["priority"] }) {
  const map = {
    critical: <Badge variant="destructive">Crítica</Badge>,
    high: <Badge className="bg-orange-600 hover:bg-orange-600">Alta</Badge>,
    medium: <Badge className="bg-amber-500 hover:bg-amber-500">Média</Badge>,
    low: <Badge variant="secondary">Baixa</Badge>,
  } as const;
  return map[priority];
}

export function StatusBadge({ status }: { status: Ticket["status"] }) {
  const map = {
    open: <Badge variant="secondary">Aberto</Badge>,
    in_progress: <Badge className="bg-blue-600 hover:bg-blue-600">Em andamento</Badge>,
    waiting_customer: <Badge className="bg-amber-500 hover:bg-amber-500">Aguardando cliente</Badge>,
    resolved: <Badge className="bg-emerald-600 hover:bg-emerald-600">Resolvido</Badge>,
    closed: <Badge variant="outline">Fechado</Badge>,
  } as const;
  return map[status];
}

export type { Ticket, TicketMessage };
export { STATUS_LABEL, TYPE_LABEL };
