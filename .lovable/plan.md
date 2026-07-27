## Objetivo

Transformar o TotalControle em SaaS pago: página de vendas pública → pagamento (Mercado Pago) → liberação do sistema e do download. Mais: painel de licenças manuais e painel financeiro/fiscal para você.

Nada disso toca `electron/`, `capacitor.config.ts`, `.github/workflows/*` ou os scripts de build do `package.json` — os builds de APK e desktop continuam gerando normalmente.

---

## 1. Regras de cobrança

- Preço base configurável (começa em **BRL 50,00/mês**), guardado numa tabela de configuração — mudar o valor depois é um update de linha, não deploy.
- **Primeiro mês: 10% off** → R$ 45,00 (só na primeira assinatura da conta).
- **Anual: 10% off** sobre 12 meses → R$ 540,00, licença de 365 dias.
- Escopo: **por conta (dono)** — quem paga libera todas as empresas em que é `owner`.
- Sem pagamento válido = **bloqueio total**: login funciona, mas todo `/app/*` redireciona para `/assinatura`.

## 2. Banco de dados (Lovable Cloud)

Novas tabelas:

- `billing_plans` — preço mensal vigente, % desconto primeiro mês, % desconto anual, moeda.
- `subscriptions` — dono (`user_id`), status (`pending`/`active`/`past_due`/`canceled`), ciclo (`monthly`/`yearly`), `current_period_end`, origem (`mercadopago`/`manual`), valor pago, se já usou o desconto de estreia.
- `payments` — cada cobrança: valor, método (pix/boleto/cartão), status, id externo do Mercado Pago, data de confirmação. Base do painel financeiro.
- `licenses` — licenças geradas por você: código, dono/e-mail destino, duração em dias, valor definido por você, status, quem resgatou e quando.
- `expenses` — despesas dedutíveis que você lançar (infra, domínio, ferramentas), para o cálculo fiscal.

Tudo com RLS: usuário só vê a própria assinatura/pagamentos; `licenses` e `expenses` são exclusivas de admin da plataforma (`is_platform_admin`).

Função `has_active_subscription(user_id)` (SECURITY DEFINER) usada tanto pelo gate quanto pelas policies.

## 3. Gate de acesso

- Layout `_authenticated/app` consulta a assinatura ativa. Se não houver, redireciona para `/assinatura` (nova rota interna com o resumo dos planos e botão de pagar).
- Admins da plataforma e contas com licença manual válida passam livres.
- Enquanto carrega, mostra skeleton — sem flash de conteúdo bloqueado.

## 4. Pagamento — Mercado Pago

- Server function cria a preferência de checkout (`/checkout/preferences`) com o plano escolhido e retorna o `init_point`; o usuário é redirecionado ao checkout MP (PIX, boleto e cartão inclusos).
- Rota pública `src/routes/api/public/webhooks/mercadopago.ts` recebe a notificação, **reconsulta o pagamento na API do MP** (nunca confia no corpo do webhook), e ativa/renova a assinatura.
- Página `/assinatura/retorno` mostra o status enquanto o webhook não chega.
- Preciso do seu **Access Token do Mercado Pago** — vou pedir pelo formulário seguro na hora de implementar (não cole no chat).

## 5. Página de vendas pública (`/`)

Reescrevo a landing seguindo estrutura de copy que converte:

1. **Hero** — promessa clara + CTA primário ("Começar por R$ 45 no primeiro mês").
2. **Dor/agitação** — planilhas, fiado esquecido, contas vencidas sem aviso.
3. **Solução em blocos** — PDV, financeiro, NF-e, devedores, assistente, multi-empresa (com prints/ícones).
4. **Prova** — números do produto, garantia de 7 dias de reembolso, selo de segurança dos dados.
5. **Preços** — dois cards (Mensal / Anual -10%), anual destacado como "melhor valor", primeiro mês com desconto em evidência.
6. **FAQ** — cancelamento, formas de pagamento, dados, suporte.
7. **CTA final** + rodapé com downloads (a seção de download atual passa a aparecer só depois do login/assinatura ativa).

SEO completo: title/description próprios, H1 único, JSON-LD de `SoftwareApplication` com oferta em BRL.

## 6. Painel de licenças (admin) — `/app/platform/licenses`

- Gerar licença: duração em dias (ou meses), valor cobrado definido por você, e-mail destino opcional, observação.
- Código único gerado automaticamente; botão de copiar.
- Lista com status (não usada / resgatada / expirada), quem resgatou, revogar.
- Tela do usuário em `/assinatura` ganha campo "Tenho um código de licença".

## 7. Painel financeiro e fiscal — dentro de `/app/platform/companies`

Nova aba/seção mostrando:

- Receita do mês, MRR, receita acumulada 12 meses, assinantes ativos, churn, ticket médio.
- Receita por empresa/assinante, com histórico de pagamentos.
- **Sugestão fiscal** sobre a *sua* receita de SaaS: enquadramento provável (MEI até R$ 81k / Simples Anexo III), estimativa do DAS, alerta ao se aproximar do teto, e lista de despesas dedutíveis lançadas em `expenses` com o total abatível.
- Aviso explícito de que é estimativa orientativa, não substitui contador.

## 8. APIs 100% gratuitas

Verifiquei o que dá para usar sem custo:

- **Mercado Pago** — API de checkout e webhooks é gratuita (só a taxa por transação).
- **BrasilAPI** — CNPJ, CEP, feriados e tabela de bancos, sem chave e sem custo. Útil para autocompletar cadastro na assinatura.
- **Cálculo fiscal** — não existe API pública gratuita confiável de Simples/MEI; faço as faixas em tabela no próprio banco (atualizável por você).
- **E-mail de confirmação** — Resend já está configurado no projeto (`RESEND_API_KEY`), plano gratuito cobre o volume inicial.

---

### Detalhes técnicos

- Toda lógica de pagamento em `createServerFn` + uma server route pública para o webhook; nenhuma Edge Function nova.
- Access Token do MP lido só dentro do handler (`process.env`), nunca no bundle do cliente.
- Webhook idempotente por `external_payment_id` para não duplicar renovação.
- O gate roda no layout já existente `src/routes/_authenticated/app.tsx`, sem mexer no `route.tsx` gerenciado.
- Preço em centavos (inteiro) no banco para evitar erro de arredondamento.

### O que não muda

`.github/workflows/build-desktop.yml`, `.github/workflows/build-android.yml`, `electron/main.cjs`, `capacitor.config.ts`, `package-lock.json` e os scripts de build permanecem intactos.

### Ordem de execução quando você mandar

1. Migração do banco (tabelas + RLS + função de gate)
2. Página de vendas + rota `/assinatura`
3. Integração Mercado Pago + webhook (pedirei o token aqui)
4. Gate de bloqueio
5. Painel de licenças
6. Painel financeiro/fiscal
