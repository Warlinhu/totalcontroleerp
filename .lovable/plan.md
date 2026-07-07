# Plano de correções e novas funcionalidades

## 1. Correções de bugs críticos

### 1.1 macOS `.zip` não abre após descompactar
Causa: `@electron/packager` cross-compilado a partir do Linux gera um `.app` sem assinatura e sem o bit executável no binário interno. macOS Gatekeeper bloqueia com "app está danificado".

Correção:
- Trocar o job `macos` no `.github/workflows/build-desktop.yml` para rodar em `macos-latest` (não Linux) e usar `--platform=darwin --arch=universal` (universal2) para funcionar em Intel e Apple Silicon.
- Após empacotar, rodar `chmod +x` no binário dentro do `.app/Contents/MacOS/` e assinar ad-hoc: `codesign --force --deep --sign - TotalControleERP.app` antes de compactar.
- Compactar com `ditto -c -k --sequesterRsrc --keepParent` (preserva permissões do `.app`, ao contrário de `zip -r`).
- Na tela de download, adicionar instrução: após descompactar, rodar `xattr -cr TotalControleERP.app` uma vez (remove quarentena) caso o macOS ainda bloqueie.

### 1.2 Erro "column subscription_id does not exist"
Não existe nenhuma referência a `subscription_id` no código do projeto — o erro vem do backend gerenciado (provavelmente do runtime de auth/cloud consultando uma coluna esperada mas ausente).
- Investigar via `supabase--read_query` a origem exata (tabelas do schema `public` que tenham colunas de assinatura, ou triggers/funções que referenciem `subscription_id`).
- Se for um trigger/função órfã, remover via migração. Se for uma tabela esperada pelo runtime, criar a coluna `subscription_id TEXT` na tabela apropriada.
- Consultar `supabase--cloud_status` e `supabase--linter` para confirmar diagnóstico antes de migrar.

### 1.3 Android: login Google não volta para o app
Causa: fluxo web OAuth redireciona para browser externo (Chrome Custom Tabs) e o retorno via `window.location.origin` não é capturado pelo APK Capacitor.

Correção:
- Instalar `@capacitor/browser` e `@capacitor-community/generic-oauth2` (ou usar `@codetrix-studio/capacitor-google-auth` para login nativo dentro do app, sem sair).
- Detectar ambiente Capacitor (`Capacitor.isNativePlatform()`) na tela `/auth` e, em vez de `lovable.auth.signInWithOAuth("google")`, usar `GoogleAuth.signIn()` nativo que retorna `idToken`, então chamar `supabase.auth.signInWithIdToken({ provider: "google", token: idToken })`.
- Configurar `capacitor.config.ts` com plugin `GoogleAuth` (clientId Web + Android).
- Fallback deep-link: registrar `com.totalcontroleerp://` no `AndroidManifest.xml` e adicionar listener `App.addListener('appUrlOpen', ...)` no `src/routes/__root.tsx` para capturar retorno OAuth caso o modo browser seja usado.

## 2. Novas funcionalidades

### 2.1 Trocar senha (com verificação por e-mail) em Configurações
- Adicionar seção "Segurança" em `app.settings.tsx` com botão "Alterar senha".
- Fluxo: usuário clica → chama `supabase.auth.reauthenticate()` (envia código nonce por e-mail) → digita código + nova senha → `supabase.auth.updateUser({ password, nonce })`.

### 2.2 Recuperação de senha na tela `/auth`
- Adicionar link "Esqueci minha senha" em `src/routes/auth.tsx`.
- Nova rota pública `src/routes/forgot-password.tsx`: input de e-mail → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`.
- Nova rota pública `src/routes/reset-password.tsx`: detecta `type=recovery` no hash, form de nova senha → `supabase.auth.updateUser({ password })`.
- Scaffold de templates de auth email via `email_domain--scaffold_auth_email_templates` se ainda não estiver ativo.

### 2.3 Botões admin para gerenciar empresas cadastradas
Em `app.platform.companies.tsx`, adicionar por linha:
- Botão "Ver detalhes" (drawer com membros, tickets, erros da empresa).
- Botão "Suspender empresa" (marca `companies.suspended_at`; RLS bloqueia acesso enquanto suspensa).
- Botão "Excluir empresa" (soft delete com confirmação dupla).
- Botão "Impersonar" (opcional, se solicitado depois — não incluído nesta rodada).
- Migração: adicionar coluna `suspended_at TIMESTAMPTZ` em `companies`, função `platform_suspend_company(_id)` / `platform_delete_company(_id)` com `SECURITY DEFINER` verificando `is_platform_admin`.

### 2.4 Filtro por data em Recebimentos e Pagamentos
Em `app.debtors.tsx` e `app.payables.tsx`:
- Adicionar dois `DatePicker` (De / Até) no topo da lista, aplicando filtro em `due_date` (ou `created_at` a definir com base no schema real das parcelas).
- Botões rápidos: "Este mês", "Próximos 30 dias", "Vencidas", "Limpar".

### 2.5 Aba de Notas Fiscais Emitidas
- Nova migração: tabela `public.invoices` com colunas: `company_id`, `nfe_number` (int), `nfe_series`, `nfe_key` (44 chars), `customer_id` (FK opcional), `customer_name`, `customer_document`, `issue_date`, `total_amount` (numeric), `tax_amount`, `status` (enum: `issued`|`cancelled`), `access_key`, `xml_url`, `pdf_url`, `notes`. GRANT + RLS por `company_id`.
- Nova rota `src/routes/_authenticated/app.invoices.tsx`: CRUD via `useEntityCrud`, listagem com filtros por data e status.
- Botão destacado "Emitir NF-e no Portal da Receita" → abre `https://www.nfe.fazenda.gov.br/portal/principal.aspx` em nova aba.
- Adicionar item "Notas Fiscais" no menu lateral (`app-shell.tsx`).

## Ordem de execução
1. Migração DB (suspend, invoices, investigação subscription_id).
2. Bugfix macOS workflow.
3. Bugfix Android OAuth (nativo).
4. Recuperação e troca de senha.
5. Filtros de data em recebimentos/pagamentos.
6. Aba de NF-e.
7. Ações admin de empresas.

## Aspectos técnicos
- Todas as tabelas novas com `GRANT SELECT,INSERT,UPDATE,DELETE ON ... TO authenticated;` + `GRANT ALL ... TO service_role;` + RLS por `has_company_access(company_id, auth.uid())`.
- Login Google nativo Android: requer Client ID Android adicional no Google Cloud Console — vou pedir ao usuário após implementar o código base.
- macOS universal build ~2x tamanho do zip atual (~700MB); aceitável.

## Perguntas antes de implementar
Nenhuma bloqueante — vou seguir os padrões existentes do projeto. Confirma que posso executar?
