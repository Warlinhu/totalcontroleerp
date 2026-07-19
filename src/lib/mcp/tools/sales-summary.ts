import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "sales_summary",
  title: "Resumo de vendas",
  description: "Retorna total de vendas, quantidade e ticket médio dentro de um período (padrão: mês atual).",
  inputSchema: {
    from: z.string().datetime().optional().describe("Data/hora inicial ISO 8601."),
    to: z.string().datetime().optional().describe("Data/hora final ISO 8601."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const now = new Date();
    const fromDate = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const toDate = to ?? now.toISOString();
    const { data, error } = await sb(ctx)
      .from("sales")
      .select("total, sold_at")
      .gte("sold_at", fromDate)
      .lte("sold_at", toDate);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const total = rows.reduce((a, s) => a + Number(s.total), 0);
    const count = rows.length;
    const avg = count > 0 ? total / count : 0;
    const summary = { from: fromDate, to: toDate, total, count, average_ticket: avg };
    return { content: [{ type: "text", text: JSON.stringify(summary) }], structuredContent: summary };
  },
});
