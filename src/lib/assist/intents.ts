import { supabase } from "@/integrations/supabase/client";

export type AssistResult = { title: string; markdown: string };

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function rangeFor(text: string): { from: string; to: string; label: string } {
  const now = new Date();
  const to = new Date(now); to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  const t = text.toLowerCase();
  if (/\b(hoje|today)\b/.test(t)) {
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString(), label: "hoje" };
  }
  if (/\b(semana|7\s*dias)\b/.test(t)) {
    from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString(), label: "últimos 7 dias" };
  }
  if (/\b(ano)\b/.test(t)) {
    from.setMonth(0, 1); from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString(), label: "este ano" };
  }
  // default: this month
  from.setDate(1); from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString(), label: "este mês" };
}

export const SUGGESTIONS = [
  "Qual meu faturamento deste mês?",
  "Qual meu ticket médio?",
  "Quais meus maiores devedores?",
  "Quais produtos mais vendidos?",
  "Quais contas vencem em 7 dias?",
  "Qual meu horário de pico?",
  "Quanto tenho de Nota em aberto?",
  "Compare este mês com o anterior",
];

export async function runAssist(input: string, companyId: string): Promise<AssistResult> {
  const q = input.toLowerCase().trim();
  if (!q) return { title: "Olá!", markdown: "Faça uma pergunta ou escolha uma sugestão abaixo." };

  // Faturamento
  if (/\b(faturamento|receita|vendi|vendas totais)\b/.test(q)) {
    const { from, to, label } = rangeFor(q);
    const { data } = await supabase
      .from("sale_payments")
      .select("amount, status")
      .eq("company_id", companyId)
      .eq("status", "settled")
      .gte("created_at", from).lte("created_at", to);
    const total = (data ?? []).reduce((a, p) => a + Number(p.amount), 0);
    return {
      title: `Faturamento (${label})`,
      markdown: `Seu faturamento **${label}** foi de **${brl(total)}**.\n\n_Valores em "Nota" só entram no faturamento após o pagamento._`,
    };
  }

  // Ticket médio — divide o valor TOTAL das vendas (incluindo Nota) pela quantidade,
  // para não subestimar quando há vendas fiadas.
  if (/\bticket\s*(m[eé]dio)?\b/.test(q)) {
    const { from, to, label } = rangeFor(q);
    const { data } = await supabase.from("sales").select("total").eq("company_id", companyId)
      .gte("sold_at", from).lte("sold_at", to);
    const sales = (data ?? []) as { total: number }[];
    const count = sales.length;
    const totalVendas = sales.reduce((a, s) => a + Number(s.total), 0);
    const avg = count > 0 ? totalVendas / count : 0;
    return {
      title: `Ticket médio (${label})`,
      markdown: `Foram **${count}** vendas somando **${brl(totalVendas)}**, com ticket médio de **${brl(avg)}**.`,
    };
  }

  // Devedores
  if (/\bdevedor|devedores|deve\b/.test(q)) {
    const { data } = await supabase
      .from("debtors")
      .select("name, total_amount")
      .eq("company_id", companyId)
      .order("total_amount", { ascending: false })
      .limit(10);
    const rows = (data ?? []) as { name: string; total_amount: number }[];
    if (rows.length === 0) return { title: "Devedores", markdown: "Nenhum devedor registrado." };
    return {
      title: "Maiores devedores",
      markdown: rows.map((r, i) => `${i + 1}. **${r.name}** — ${brl(Number(r.total_amount))}`).join("\n"),
    };
  }

  // Produtos mais vendidos
  if (/\bprodutos?\b.*\b(mais|top|vendidos?)\b|\btop\s+produtos?/.test(q)) {
    const { from, to, label } = rangeFor(q);
    const { data } = await supabase
      .from("sale_items")
      .select("description, quantity, total, sale_id, sales!inner(sold_at, company_id)")
      .eq("company_id", companyId)
      .gte("sales.sold_at", from).lte("sales.sold_at", to);
    const items = (data ?? []) as { description: string; quantity: number; total: number }[];
    const map = new Map<string, { qty: number; total: number }>();
    items.forEach((i) => {
      const cur = map.get(i.description) ?? { qty: 0, total: 0 };
      map.set(i.description, { qty: cur.qty + Number(i.quantity), total: cur.total + Number(i.total) });
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    if (sorted.length === 0) return { title: "Produtos", markdown: `Sem vendas em ${label}.` };
    return {
      title: `Produtos mais vendidos (${label})`,
      markdown: sorted.map(([n, v], i) => `${i + 1}. **${n}** — ${v.qty.toFixed(0)} un · ${brl(v.total)}`).join("\n"),
    };
  }

  // Contas a vencer
  if (/\b(vencer|vencem|vencendo|a\s+pagar|a\s+receber)\b/.test(q)) {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const [recR, payR] = await Promise.all([
      supabase.from("debtor_installments").select("amount")
        .eq("company_id", companyId).eq("status", "pending")
        .gte("due_date", today).lte("due_date", in7),
      supabase.from("payable_installments").select("amount")
        .eq("company_id", companyId).eq("status", "pending")
        .gte("due_date", today).lte("due_date", in7),
    ]);
    const rec = (recR.data ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const pay = (payR.data ?? []).reduce((a, r) => a + Number(r.amount), 0);
    return {
      title: "Vencendo em 7 dias",
      markdown: `- A receber: **${brl(rec)}**\n- A pagar: **${brl(pay)}**\n- Saldo previsto: **${brl(rec - pay)}**`,
    };
  }

  // Horário de pico
  if (/\b(pico|movimento|hor[aá]rio)\b/.test(q)) {
    const { from, to, label } = rangeFor(q);
    const { data } = await supabase
      .from("sales").select("sold_at")
      .eq("company_id", companyId).gte("sold_at", from).lte("sold_at", to);
    const buckets = new Array(24).fill(0);
    (data ?? []).forEach((s) => { buckets[new Date(s.sold_at).getHours()] += 1; });
    const max = Math.max(...buckets);
    if (max === 0) return { title: "Horário de pico", markdown: `Sem vendas em ${label}.` };
    const hour = buckets.indexOf(max);
    return {
      title: `Horário de pico (${label})`,
      markdown: `Maior movimento entre **${hour}h e ${hour + 1}h** com **${max}** vendas.`,
    };
  }

  // Nota em aberto
  if (/\b(nota|fiado)\b/.test(q)) {
    const { data } = await supabase
      .from("sale_payments").select("amount")
      .eq("company_id", companyId).eq("method", "nota").eq("status", "pending");
    const total = (data ?? []).reduce((a, p) => a + Number(p.amount), 0);
    return { title: "Nota em aberto", markdown: `Você tem **${brl(total)}** em Notas (fiado) aguardando pagamento.` };
  }

  // Comparação
  if (/\b(compar|vs|versus)\b/.test(q)) {
    const now = new Date();
    const thisFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisTo = new Date().toISOString();
    const lastFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const q1 = await supabase.from("sale_payments").select("amount")
      .eq("company_id", companyId).eq("status", "settled").gte("created_at", thisFrom).lte("created_at", thisTo);
    const q2 = await supabase.from("sale_payments").select("amount")
      .eq("company_id", companyId).eq("status", "settled").gte("created_at", lastFrom).lte("created_at", lastTo);
    const cur = (q1.data ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const prev = (q2.data ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const diff = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
    return {
      title: "Este mês vs mês anterior",
      markdown: `- Este mês: **${brl(cur)}**\n- Mês anterior: **${brl(prev)}**\n- Variação: **${diff.toFixed(1)}%**`,
    };
  }

  return {
    title: "Ainda não sei responder isso",
    markdown:
      "Tente uma das sugestões abaixo. Meu assistente é local e responde perguntas sobre faturamento, vendas, clientes, produtos, contas e horário de pico — sem consumir créditos.",
  };
}
