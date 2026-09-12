# Monitoramento de erros, testes automatizados e verificação do pagamento

Três frentes, na ordem em que serão feitas.

## 1. Monitoramento de erros ponta a ponta

O que já existe hoje: erros do navegador (telas do usuário) são gravados com usuário, rota e navegador, e aparecem em Plataforma → Erros.

O que falta e será adicionado:

- **Erros do servidor também registrados.** Hoje falhas no checkout, no aviso de pagamento e nas demais operações de servidor só aparecem no console e somem. Passarão a ser gravados na mesma lista, com usuário e rota.
- **Tela quebrada não fica em branco.** Uma barreira de erro envolve o app: mostra uma mensagem amigável com botão "recarregar" e registra a falha automaticamente.
- **Aviso por e-mail está quebrado.** O código chama um serviço de notificação que nunca foi criado, então nenhum alerta de erro grave é enviado hoje. Será removido esse trecho morto e, no lugar, a tela Plataforma → Erros ganha um contador de erros novos não resolvidos visível no menu da Plataforma.
- **Melhorias na tela de Erros:** filtro por período, busca por texto/rota, agrupamento por ocorrência repetida com contagem, e botão para marcar como resolvido em lote.
- **Registro de falhas de pagamento** com etiqueta própria (`billing`), para você identificar imediatamente qualquer assinatura que não liberou acesso.

## 2. Testes ponta a ponta dos fluxos críticos

Serão criados testes automatizados com Playwright cobrindo:

1. **Login** — entrar com e-mail e senha, erro em senha inválida, redirecionamento correto.
2. **Cadastro** — criar conta, validação de campos, primeiro acesso/onboarding de empresa.
3. **Criação de cupom (PDV)** — adicionar produto ao carrinho, aplicar forma de pagamento, fechar a venda e conferir que a venda e os itens foram gravados.
4. **Checkout de assinatura mensal e anual** — clicar em Assinar, conferir que o link de pagamento é gerado com o valor correto para cada ciclo (o provedor externo é simulado nos testes, então nenhum pagamento real é feito).
5. **Bloqueio por assinatura** — usuário sem assinatura ativa é levado para a página de assinatura; com assinatura ativa entra no sistema.

Os testes rodam com um comando (`npm run test:e2e`) e ficam em uma pasta separada, sem qualquer alteração nos arquivos que o GitHub usa para gerar o APK e o programa de PC. Também será adicionado um fluxo de teste no GitHub que roda apenas os testes, separado dos que geram os aplicativos.

## 3. Verificação completa do fluxo de pagamento

- **Modo sandbox de verdade.** A chave "sandbox" já existe na tela Plataforma → Pagamentos, mas hoje não muda nada. Passará a usar o link de teste do Mercado Pago quando ligada, para você testar o pagamento sem dinheiro real.
- **Confirmação por segurança no aviso do provedor.** O aviso recebido passa a ter a assinatura conferida (quando o segredo estiver cadastrado) antes de liberar qualquer acesso.
- **Rede de segurança se o aviso não chegar.** Na tela de retorno, além da espera atual, o sistema consulta ativamente o provedor pelo pagamento e libera o acesso assim que ele estiver aprovado — resolvendo o caso em que o aviso automático falha.
- **Botão "Verificar pagamento agora"** na tela de retorno e na área de assinatura, para o próprio cliente forçar a conferência.
- **Painel de diagnóstico** em Plataforma → Pagamentos: teste de credencial (mostra se o token é válido e se é de teste ou produção), últimos avisos recebidos e pagamentos pendentes há mais de 30 minutos.

## Detalhes técnicos

- Logging servidor: middleware de requisição em `src/start.ts` + helper `src/lib/error-logger.server.ts` gravando em `public.error_logs` via `supabaseAdmin`; remoção da chamada morta a `supabase.functions.invoke("notify-error")`.
- Error boundary no `__root.tsx` (`errorComponent`) reportando via `logAppError`.
- Playwright em `e2e/` com `playwright.config.ts`, `webServer` apontando para `vite dev` na porta 8080; usuário de teste criado/derrubado por um setup global; chamadas ao Mercado Pago interceptadas via `page.route`.
- Novo workflow `.github/workflows/e2e.yml` isolado; `build-android.yml` e `build-desktop.yml` e o `package-lock.json` permanecem intactos além das devDependencies adicionadas.
- Webhook: validação HMAC de `x-signature`/`x-request-id` com segredo opcional `MERCADOPAGO_WEBHOOK_SECRET`; `processPayment` extraído para helper reutilizável, chamado também por uma server function `reconcilePayment` autenticada.
- `sandbox_init_point` usado quando `payment_settings.mode = 'sandbox'`.
- Sem migração de banco necessária: `error_logs`, `payments`, `subscriptions` e `payment_settings` já têm as colunas usadas.
