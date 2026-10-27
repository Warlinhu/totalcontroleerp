import { describe, expect, test } from "bun:test";
import { filterReportRows, normalizeReportRow, REPORT_SOURCES, reportCsv, summarizeReportRows, readAllPages, csvCell } from "./reports";

const rows = [
  normalizeReportRow(REPORT_SOURCES[0], { id: "s1", sold_at: "2020-01-01", total: 120, notes: "João" }),
  normalizeReportRow(REPORT_SOURCES[1], { id: "r1", due_date: "2020-01-31", amount: 40, status: "paid" }),
  normalizeReportRow(REPORT_SOURCES[2], { id: "p1", due_date: "2020-02-01", amount: 25, status: "pending" }),
];
describe("historical reports", () => {
  test("historical records have no age cutoff", () => {
    expect(filterReportRows(rows, { search: "", from: "", to: "", status: "" })).toHaveLength(3);
  });
  test("period includes both boundary dates", () => {
    expect(filterReportRows(rows, { search: "", from: "2020-01-01", to: "2020-01-31", status: "" }).map(r => r.id)).toEqual(["s1", "r1"]);
  });
  test("search handles accents and status filtering", () => {
    expect(filterReportRows(rows, { search: "joao", from: "", to: "", status: "" }).map(r => r.id)).toEqual(["s1"]);
    expect(filterReportRows(rows, { search: "", from: "", to: "", status: "Pago" }).map(r => r.id)).toEqual(["r1"]);
  });
  test("summary separates category, month and status instead of adding unrelated money", () => {
    expect(summarizeReportRows(rows)).toEqual([
      { category: "A pagar", month: "2020-02", status: "Pendente", count: 1, amount: 25 },
      { category: "A receber", month: "2020-01", status: "Pago", count: 1, amount: 40 },
      { category: "Vendas", month: "2020-01", status: "", count: 1, amount: 120 },
    ]);
  });
  test("CSV exports all filtered data with decimal comma and formula safety", () => {
    expect(reportCsv(rows, false)).toContain('"120,00"');
    expect(reportCsv(rows, false)).toContain('"p1"');
    expect(csvCell("=HYPERLINK(\"unsafe\")")).toBe('"\'=HYPERLINK(""unsafe"")"');
  });
  test("reads beyond the first thousand rows even when API caps page size", async () => {
    const data = Array.from({ length: 1205 }, (_, id) => ({ id }));
    const result = await readAllPages(async (from, to) => ({ data: data.slice(from, Math.min(to + 1, from + 100)), count: data.length, error: null }));
    expect(result).toHaveLength(1205);
    expect(result[1204]?.id).toBe(1204);
  });
  test("failed uploads cannot produce a partial export", async () => {
    await expect(readAllPages(async () => ({ data: null, count: null, error: { message: "Sem conexão" } }))).rejects.toThrow("Sem conexão");
  });
});