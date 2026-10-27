export const REPORT_SOURCES = [
  { table: "sales", label: "Vendas", date: "sold_at", amount: "total" },
  { table: "debtor_installments", label: "A receber", date: "due_date", amount: "amount" },
  { table: "payable_installments", label: "A pagar", date: "due_date", amount: "amount" },
  { table: "invoices", label: "Notas fiscais", date: "issue_date", amount: "total_amount" },
  { table: "customers", label: "Clientes", date: "created_at", amount: null },
  { table: "suppliers", label: "Fornecedores", date: "created_at", amount: null },
  { table: "products", label: "Produtos e serviços", date: "created_at", amount: null },
  { table: "employees", label: "Funcionários", date: "created_at", amount: null },
] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number];
export type ReportRow = {
  id: string; category: string; date: string; description: string;
  status: string; amount: number | null; raw: Record<string, unknown>;
};
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", paid: "Pago", overdue: "Vencido", canceled: "Cancelado",
  cancelled: "Cancelado", issued: "Emitida", active: "Ativo", inactive: "Inativo",
};

export function normalizeReportRow(source: ReportSource, raw: Record<string, unknown>): ReportRow {
  const date = String(raw[source.date] ?? "");
  // Date-only financial deadlines remain unchanged; timestamps use the device's calendar.
  const calendarDate = date.length > 10 ? localDate(new Date(date)) : date;
  const status = String(raw.status ?? (typeof raw.active === "boolean" ? (raw.active ? "active" : "inactive") : ""));
  return {
    id: String(raw.id), category: source.label, date: calendarDate,
    description: String(raw.name ?? raw.customer_name ?? raw.description ?? raw.notes ?? (raw.sequence ? `Parcela ${raw.sequence}` : `Venda ${String(raw.id).slice(0, 8)}`)),
    status: STATUS_LABELS[status] ?? status,
    amount: source.amount ? Number(raw[source.amount] ?? 0) : null, raw,
  };
}

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterReportRows(rows: ReportRow[], filters: { search: string; from: string; to: string; status: string }) {
  const term = searchable(filters.search.trim());
  return rows.filter(row =>
    (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) &&
    (!filters.status || row.status === filters.status) &&
    (!term || searchable(`${row.description} ${row.category} ${row.status} ${JSON.stringify(row.raw)}`).includes(term)),
  );
}

export function summarizeReportRows(rows: ReportRow[]) {
  const groups = new Map<string, { category: string; month: string; status: string; count: number; amount: number | null }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const key = JSON.stringify([row.category, month, row.status]);
    const group = groups.get(key) ?? { category: row.category, month, status: row.status, count: 0, amount: row.amount === null ? null : 0 };
    group.count += 1;
    if (row.amount !== null) group.amount = (group.amount ?? 0) + row.amount;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month) || a.category.localeCompare(b.category));
}

// Protect spreadsheet applications from interpreting user-provided cells as formulas.
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function toCsv(headers: string[], rows: unknown[][]) {
  return "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n");
}

export function reportCsv(rows: ReportRow[], summary: boolean) {
  if (summary) return toCsv(["Categoria", "Mês", "Situação", "Registros", "Valor (R$)"], summarizeReportRows(rows).map(r => [r.category, r.month, r.status, r.count, r.amount?.toFixed(2).replace(".", ",")]));
  return toCsv(["Identificador", "Categoria", "Data", "Descrição", "Situação", "Valor (R$)", "Dados completos"], rows.map(r => [r.id, r.category, r.date, r.description, r.status, r.amount?.toFixed(2).replace(".", ","), JSON.stringify(r.raw)]));
}

export async function readAllPages<T>(read: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null; count: number | null }>) {
  const rows: T[] = [];
  let total: number | null = null;
  for (;;) {
    const result = await read(rows.length, rows.length + 499);
    if (result.error) throw new Error(result.error.message);
    if (result.count !== null) total = result.count;
    const page = result.data ?? [];
    rows.push(...page);
    if (total !== null ? rows.length >= total : page.length < 500) return rows;
    if (page.length === 0) throw new Error("Os registros mudaram durante a consulta. Atualize o relatório.");
  }
}