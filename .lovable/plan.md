
## TotalControle ERP — Estrutura da Fase 1

Um único app multi-tenant. Cada empresa cliente tem seus dados isolados. Você (dono da plataforma) tem acesso a um painel global de monitoramento. Nesta fase focamos em **estrutura funcional** (dados, permissões, telas cruas) — a estilização vem depois.

### 1. Backend (Lovable Cloud)

Vou ativar o Lovable Cloud para ter banco de dados, autenticação e envio de e-mails.

**Login:**
- Google (padrão) + e-mail/senha
- Ao entrar pela primeira vez, o usuário cria uma empresa OU aceita convite para uma existente

**Papéis (por empresa):**
- `owner` — dono da empresa (primeiro usuário; gerencia tudo, convida pessoas)
- `admin` — acesso total à operação
- `employee` — acesso limitado, definido pelo owner/admin
- `platform_admin` — VOCÊ, acesso ao painel global de bugs (separado das empresas)

### 2. Tabelas principais

```text
companies              → empresas clientes (tenants)
company_members        → vínculo usuário ↔ empresa + papel
company_invites        → convites por e-mail
products               → produtos e serviços (tipo, preço, estoque opcional)
customers              → clientes da empresa
suppliers              → fornecedores
employees              → funcionários (dados cadastrais; separado de usuários do sistema)
debtors                → devedores (quem deve para a empresa)
debtor_installments    → parcelas/vencimentos dos devedores
payables               → contas a pagar (para fornecedores ou avulsas)
payable_installments   → parcelas de contas a pagar
reminders              → lembretes gerados (vencimentos próximos/atrasados)
error_logs             → erros capturados no app (painel global seu)
error_notifications    → controle de e-mails já enviados por erro
```

Todas as tabelas de negócio têm `company_id` e RLS que garante isolamento por empresa via função `has_company_access(company_id, role)`.

### 3. Módulos e telas (estrutura, sem design)

- **Onboarding** — criar empresa ou aceitar convite
- **Dashboard** — resumo: contas a vencer hoje/semana, devedores em atraso, totais
- **Produtos/Serviços** — CRUD, tipo (produto ou serviço), preço, estoque opcional
- **Clientes** — CRUD com dados de contato e documento
- **Fornecedores** — CRUD
- **Funcionários** — CRUD (cadastro RH, distinto de usuários do sistema)
- **Devedores** — CRUD + parcelas com data de vencimento + status (em dia/vencido/pago)
- **Contas a pagar** — CRUD + parcelas + status
- **Lembretes** — listagem centralizada de vencimentos próximos e atrasados (devedores + contas a pagar)
- **Equipe** — owner/admin convida usuários, define papel, revoga acesso
- **Configurações da empresa** — nome, CNPJ, dados básicos

### 4. Monitoramento de erros (seu painel global)

- Captura automática de erros do frontend (React Error Boundary + `window.onerror` + `unhandledrejection`)
- Captura de erros do backend (server functions envolvidas em wrapper)
- Cada erro grava: mensagem, stack, rota, empresa, usuário, timestamp, severidade
- Rota `/platform/errors` — só `platform_admin` acessa; lista, filtra por empresa/severidade, marca como resolvido
- Job periódico: quando um erro **crítico novo** aparece, dispara e-mail para você (com deduplicação para não spammar o mesmo erro)

### 5. Emissão de notas fiscais

Fica de fora desta fase, conforme você pediu. Estruturamos numa próxima conversa dedicada.

### 6. O que fica para depois

- Estilização/design (paleta, tipografia, logo, slogan)
- Emissão fiscal real
- Relatórios avançados / exportações
- App mobile

---

### Ordem de implementação sugerida

1. Ativar Cloud + tabelas + RLS + papéis
2. Autenticação (Google + e-mail) + onboarding de empresa + convites
3. Módulos CRUD (produtos, clientes, fornecedores, funcionários)
4. Devedores e contas a pagar com parcelas e status
5. Dashboard + lembretes de vencimento
6. Sistema de captura de erros + painel `/platform/errors` + e-mail para você

Cada passo entrego funcional antes de avançar. Posso começar pelo passo 1?
