import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import listProducts from "./tools/list-products";
import listDebtors from "./tools/list-debtors";
import salesSummary from "./tools/sales-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "totalcontrole-erp-mcp",
  title: "TotalControle ERP",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultar dados do TotalControle ERP (clientes, produtos, devedores e vendas). Todas as chamadas respeitam as regras de acesso por empresa do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCustomers, listProducts, listDebtors, salesSummary],
});
