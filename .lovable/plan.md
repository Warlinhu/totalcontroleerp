## Plano de implementação — PDV, Dashboard analítico, Assistente e Changelog

### 1. PDV (Ponto de Venda) — nova rota `/app/pos`

Novo módulo estilo carrinho com:

- **Busca de produtos** (por nome/SKU) já cadastrados em `products`, adição ao carrinho com controle de quantidade, desconto por item e desconto geral.
- **Seleção de cliente** (opcional, exceto para "Nota" onde é obrigatório).
- **Formas de pagamento** suportadas: `dinheiro`, `credito`, `debito`, `pix`, `alimentacao`, `voucher`, `nota`. Permite pagamento **misto** (parte em dinheiro + parte em cartão etc.).
- **Finalização da venda**: cria registro em `sales` + `sale_items` + `sale_payments`.
- **Cupom/recibo imprimível** ao finalizar (formato térmico 80mm + A4, `window.print()`).

**Regra da "Nota" (fiado):**
- Cliente obrigatório.
- Cria automaticamente registro em `debtors` + `debtor_installments` (parcela única no vencimento escolhido).
- O valor da parte "Nota" **não conta em faturamento** enquanto não for pago. Conforme o cliente paga (marca parcelas como `paid`), o valor pago passa a compor o faturamento.
- Partes pagas em outras formas (dinheiro, pix, cartão) contam em faturamento **imediatamente**.

**Baixa de estoque:** não incluída nesta rodada (você não marcou como obrigatório — posso adicionar depois).

### 2. Dashboard analítico revisado — `/app`

Substituo os 4 "stat cards" atuais por painel com:

- **Ticket médio** (faturamento realizado ÷ nº de vendas no período).
- **Faturamento do período** (soma dos pagamentos realizados; "Nota" não pago não entra).
- **Vendas por forma de pagamento** — gráfico rosquinha (Recharts `PieChart`) com seletor para trocar entre: rosquinha, barras, pizza.
- **Vendas por categoria de produto** — mesmo padrão de gráfico configurável.
- **Horário de maior movimento** — gráfico de linha (0h–23h) com nº de vendas por hora, filtro por período (hoje/semana/mês).
- **Evolução do faturamento** — gráfico de linha por dia.
- **Filtro global de período** no topo (hoje, 7 dias, 30 dias, mês atual, customizado).

### 3. Assistente "TotalControle Assist" (sem IA) — rota `/app/assist`

Interface de chat com perguntas rápidas + campo de texto. Sem chamadas a modelos de IA, sem custo:

- Parser de intenções por palavras-chave em português (regex/keywords) que mapeia perguntas a consultas SQL parametrizadas na sua base.
- Perguntas suportadas de largada: faturamento (dia/semana/mês/ano), ticket médio, top clientes devedores, top produtos vendidos, contas a pagar/receber vencendo, horário de pico, comparação mês vs. mês anterior, saldo de "Nota" em aberto.
- Perguntas fora do escopo retornam: "Ainda não sei responder isso — tente uma das sugestões abaixo".
- Botões de sugestão sempre visíveis para facilitar o uso.

### 4. Changelog + notificação de correções — `/app/changelog`

- Nova tabela `app_releases` (versão, título, descrição resumida, categoria: `bugfix`|`feature`|`melhoria`, publicado_em).
- Nova tabela `user_release_reads` (marca quais releases o usuário já viu).
- No `AppShell`: badge no ícone de sino mostrando releases não lidos + popover com resumo.
- Página `/app/changelog` com histórico completo.
- Como popular: quando eu (ou você) corrigir um bug/lançar melhoria, insiro uma linha em `app_releases` via migração ou via painel admin (adiciono formulário em `/app/platform/releases` para admins da plataforma criarem entradas).

### 5. Pesquisa de recursos de mercado — documento

Entrego `docs/recursos-mercado-erp.md` com sugestões baseadas em ERPs populares (Bling, Omie, Tiny, Conta Azul, SAP Business One, Sankhya, TOTVS Protheus), agrupados por porte da empresa e prioridade sugerida. Não implemento nada — é material de apoio para você priorizar próximas fases.

---

## Detalhes técnicos

**Migrações (uma migração agrupada):**
- `sales` (id, company_id, customer_id nullable, subtotal, discount, total, sold_at, sold_by, notes)
- `sale_items` (id, sale_id, product_id, description, quantity, unit_price, discount, total)
- `sale_payments` (id, sale_id, method enum, amount, status enum `settled`|`pending`, debtor_installment_id nullable)
- `app_releases` + `user_release_reads`
- Triggers: quando `debtor_installments.status` vira `paid`, atualiza `sale_payments.status` correspondente (para a regra da "Nota").
- Todas com `GRANT` + `ENABLE RLS` + policies por `has_company_access(company_id, auth.uid())`.
- Faturamento = soma de `sale_payments` onde `status='settled'` (parcelas pagas + métodos à vista).

**Frontend:**
- Recharts (já instalado no ecossistema shadcn) para gráficos.
- Novas rotas: `app.pos.tsx`, `app.changelog.tsx`, `app.assist.tsx`, `app.platform.releases.tsx`.
- Atualizo `app-shell.tsx` para incluir os novos itens de menu e badge de novidades.
- Refatoro `app.index.tsx` para o novo dashboard.

**Assistente (sem IA):**
- Módulo `src/lib/assist/intents.ts` — array de intents com regex + função que monta a query Supabase.
- Módulo `src/lib/assist/formatters.ts` — formata resposta em markdown/tabelas simples.
- Renderização com `react-markdown` (adicionar via `bun add`).

**Fora de escopo desta rodada** (deixo registrado):
- IA de verdade que responde qualquer coisa (requer créditos/API key).
- Auto-correção automática de código (não é possível — código só muda no editor).
- Baixa automática de estoque no PDV.
- Impressão em impressora térmica dedicada (uso `window.print()` com CSS 80mm).

---

## Ordem de execução
1. Migração DB (sales, sale_items, sale_payments, app_releases, user_release_reads, trigger de faturamento).
2. PDV (`/app/pos`) + integração com Contas a Receber para "Nota".
3. Dashboard novo com Recharts.
4. Assistente sem IA.
5. Changelog + badge de novidades + painel admin de releases.
6. Documento `docs/recursos-mercado-erp.md`.

Confirma que posso executar?