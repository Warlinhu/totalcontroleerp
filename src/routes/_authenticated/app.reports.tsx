import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileJson, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deliverFile } from "@/lib/download";
import { REPORT_SOURCES, filterReportRows, localDate, normalizeReportRow, readAllPages, reportCsv, summarizeReportRows } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({ meta: [
    { title: "Histórico e relatórios — Total Controle - Gestão Empresarial" },
    { name: "description", content: "Histórico empresarial com pesquisa, filtros por categoria e período e exportação de relatórios." },
    { property: "og:title", content: "Histórico e relatórios — Total Controle - Gestão Empresarial" },
    { property: "og:description", content: "Consulte e exporte os registros históricos da sua empresa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ReportsPage,
});

const money = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const displayDate = (date: string) => date ? date.split("-").reverse().join("/") : "—";
const PAGE_SIZE = 50;

function ReportsPage() {
  const { currentCompanyId, current } = useCompany();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("details");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["historical-reports", currentCompanyId, category],
    enabled: Boolean(currentCompanyId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!currentCompanyId) throw new Error("Selecione uma empresa.");
      const sources = REPORT_SOURCES.filter(source => category === "all" || source.table === category);
      const result = await Promise.all(sources.map(async source => {
        const records = await readAllPages<Record<string, unknown>>(async (first, last) => {
          // Small stable pages avoid the Data API row cap; the exact count guards completeness.
          const selection = source.table === "debtor_installments" ? "*,debtor:debtors(name,description)" : source.table === "payable_installments" ? "*,payable:payables(description)" : "*";
          const { data, error, count } = await supabase.from(source.table)
            .select(selection, { count: "exact" }).eq("company_id", currentCompanyId)
            .order(source.date, { ascending: false }).order("id", { ascending: true }).range(first, last);
          return { data: data as unknown as Record<string, unknown>[] | null, error, count };
        });
        return records.map(raw => {
          const parent = (raw.debtor ?? raw.payable) as { name?: string; description?: string } | null | undefined;
          const description = parent ? [parent.name, parent.description, `Parcela ${raw.sequence}`].filter(Boolean).join(" · ") : undefined;
          return normalizeReportRow(source, description ? { ...raw, description } : raw);
        });
      }));
      return result.flat().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    },
  });
  const rows = query.data ?? [];
  const invalidRange = Boolean(from && to && from > to);
  const filtered = useMemo(() => invalidRange ? [] : filterReportRows(rows, { search, from, to, status: status === "all" ? "" : status }), [rows, search, from, to, status, invalidRange]);
  const summary = useMemo(() => summarizeReportRows(filtered), [filtered]);
  const statuses = [...new Set(rows.map(r => r.status).filter(Boolean))].sort();
  const pageCount = Math.max(1, Math.ceil((view === "details" ? filtered.length : summary.length) / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const busy = query.isFetching || query.isPending;
  const exportDisabled = busy || query.isError || invalidRange || filtered.length === 0;

  function changeFilter(action: () => void) { action(); setPage(0); }
  function preset(value: string) {
    changeFilter(() => {
      if (value === "all") { setFrom(""); setTo(""); return; }
      const end = new Date(); const begin = new Date();
      if (value === "month") begin.setDate(1);
      else if (value === "year") begin.setMonth(0, 1);
      else begin.setDate(begin.getDate() - 29);
      setFrom(localDate(begin)); setTo(localDate(end));
    });
  }
  function exportFile(format: "csv" | "json") {
    if (exportDisabled) return;
    const filename = `total-controle-${view === "summary" ? "resumo" : "historico"}-${localDate(new Date())}.${format}`;
    const content = format === "csv" ? reportCsv(filtered, view === "summary") : JSON.stringify({
      company: current?.company.name, exportedAt: new Date().toISOString(),
      filters: { category, from, to, search, status },
      data: view === "summary" ? summary : filtered,
    }, null, 2);
    void deliverFile(new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" }), filename)
      .catch(() => toast.error("Não foi possível salvar o arquivo."));
  }

  return (
    <div className="space-y-6 min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Archive className="h-6 w-6 shrink-0 text-primary" />Histórico e relatórios</h1><p className="mt-1 text-sm text-muted-foreground">{current?.company.name}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" aria-label="Atualizar relatório" title="Atualizar relatório" disabled={busy} onClick={() => void query.refetch()}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button>
          <Button variant="outline" disabled={exportDisabled} onClick={() => exportFile("csv")}><Download className="mr-2 h-4 w-4" />Planilha CSV</Button>
          <Button variant="outline" disabled={exportDisabled} onClick={() => exportFile("json")}><FileJson className="mr-2 h-4 w-4" />JSON</Button>
        </div>
      </header>

      <section className="space-y-4 border-y py-4" aria-label="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5"><Label htmlFor="history-search">Pesquisar</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="history-search" className="pl-9" placeholder="Nome, documento, descrição…" value={search} onChange={e => changeFilter(() => setSearch(e.target.value))} /></div></div>
          <div className="space-y-1.5"><Label>Categoria</Label><Select value={category} onValueChange={value => changeFilter(() => { setCategory(value); setStatus("all"); })}><SelectTrigger aria-label="Categoria"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{REPORT_SOURCES.map(source => <SelectItem key={source.table} value={source.table}>{source.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="history-from">De</Label><Input id="history-from" type="date" value={from} onChange={e => changeFilter(() => setFrom(e.target.value))} /></div>
          <div className="space-y-1.5"><Label htmlFor="history-to">Até</Label><Input id="history-to" type="date" value={to} onChange={e => changeFilter(() => setTo(e.target.value))} /></div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44 space-y-1.5"><Label>Situação</Label><Select value={status} onValueChange={value => changeFilter(() => setStatus(value))}><SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{statuses.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="w-48 space-y-1.5"><Label>Período</Label><Select onValueChange={preset}><SelectTrigger aria-label="Período"><SelectValue placeholder="Selecionar período" /></SelectTrigger><SelectContent><SelectItem value="all">Todo o histórico</SelectItem><SelectItem value="30d">Últimos 30 dias</SelectItem><SelectItem value="month">Este mês</SelectItem><SelectItem value="year">Este ano</SelectItem></SelectContent></Select></div>
          <Button variant="ghost" onClick={() => changeFilter(() => { setSearch(""); setFrom(""); setTo(""); setCategory("all"); setStatus("all"); })}>Limpar filtros</Button>
        </div>
        {invalidRange && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior ou igual à data final.</p>}
      </section>

      <section aria-label="Resultados" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{busy ? "Consultando histórico…" : `${filtered.length} registros encontrados`}</p>
          <Select value={view} onValueChange={value => changeFilter(() => setView(value))}><SelectTrigger aria-label="Visualização" className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="details">Registros detalhados</SelectItem><SelectItem value="summary">Resumo por categoria e mês</SelectItem></SelectContent></Select>
        </div>
        {query.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 border border-destructive p-4 text-sm"><AlertCircle className="h-5 w-5 text-destructive" /><p>Não foi possível consultar o histórico. Verifique sua conexão e tente novamente.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : busy ? <p className="py-12 text-center text-muted-foreground" role="status">Carregando registros…</p> : filtered.length === 0 ? <p className="py-12 text-center text-muted-foreground">Nenhum registro encontrado para estes filtros.</p> : (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm"><thead className="bg-muted"><tr>{(view === "details" ? ["Data", "Categoria", "Descrição", "Situação", "Valor"] : ["Mês", "Categoria", "Situação", "Registros", "Valor"]).map(label => <th key={label} className="px-4 py-3 text-left whitespace-nowrap font-medium">{label}</th>)}</tr></thead>
              <tbody>{view === "details" ? filtered.slice(start, start + PAGE_SIZE).map(row => <tr key={`${row.category}-${row.id}`} className="border-t"><td className="px-4 py-3 whitespace-nowrap">{displayDate(row.date)}</td><td className="px-4 py-3 whitespace-nowrap">{row.category}</td><td className="px-4 py-3 min-w-48 max-w-96 break-words">{row.description}</td><td className="px-4 py-3">{row.status || "—"}</td><td className="px-4 py-3 whitespace-nowrap tabular-nums">{money(row.amount)}</td></tr>) : summary.slice(start, start + PAGE_SIZE).map(row => <tr key={`${row.category}-${row.month}-${row.status}`} className="border-t"><td className="px-4 py-3 whitespace-nowrap">{row.month.split("-").reverse().join("/")}</td><td className="px-4 py-3 whitespace-nowrap">{row.category}</td><td className="px-4 py-3">{row.status || "—"}</td><td className="px-4 py-3 tabular-nums">{row.count}</td><td className="px-4 py-3 whitespace-nowrap tabular-nums">{money(row.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {!busy && !query.isError && filtered.length > 0 && <div className="flex items-center justify-end gap-3"><span className="text-sm text-muted-foreground">Página {safePage + 1} de {pageCount}</span><Button size="icon" variant="outline" title="Página anterior" aria-label="Página anterior" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" title="Próxima página" aria-label="Próxima página" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
      </section>
    </div>
  );
}