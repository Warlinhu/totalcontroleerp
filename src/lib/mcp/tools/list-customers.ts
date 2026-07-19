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
  name: "list_customers",
  title: "Listar clientes",
  description: "Lista clientes das empresas do usuário autenticado (respeita as regras de acesso por empresa).",
  inputSchema: {
    search: z.string().trim().optional().describe("Filtro opcional por nome ou documento."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de resultados (padrão 50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx).from("customers").select("id, name, document, email, phone, company_id, created_at").limit(limit ?? 50);
    if (search) q = q.or(`name.ilike.%${search}%,document.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { customers: data } };
  },
});
