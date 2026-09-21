# Offline com sincronização, painel de links e novo ícone

## 1. Uso offline sem perder dados

Hoje o app abre offline (tela local + cache), mas nada digitado sem internet é salvo.

- Toda venda, cliente e configuração criada/editada sem internet fica guardada no próprio aparelho (fila local no navegador/app).
- Assim que a internet volta, o sistema envia tudo automaticamente, em ordem, e avisa quando terminou.
- Indicador no topo do sistema: "Offline — N itens aguardando envio" / "Sincronizado".
- Listas de vendas e clientes continuam mostrando o que foi criado offline, marcado como "pendente de envio".
- Proteção contra duplicidade: cada item leva uma identificação própria, então reenvios não criam registros repetidos.
- Botão "Sincronizar agora" para forçar o envio.

Escopo: vendas (PDV), clientes e configurações da empresa. Demais telas seguem exigindo internet.

## 2. Painel de desempenho dos links (aba Licenças)

Novo bloco abaixo da lista de links, com por link:

- Cliques (quantas vezes o link foi aberto)
- Pagamentos aprovados
- Taxa de conversão (aprovados ÷ cliques)
- Receita gerada
- Totais gerais no topo e ordenação por receita

Os cliques passam a ser registrados quando alguém abre `/assinatura?oferta=<código>` ou clica na oferta na página inicial.

## 3. Ícone novo em todo o sistema

- A imagem enviada vira o ícone do programa de computador, do aplicativo de celular, da aba do navegador e da tela inicial.
- No Windows, o ícone correto passa a aparecer no atalho, na barra de tarefas e na bandeja (hoje aparece um genérico porque o instalador recebe um PNG em vez do formato exigido pelo Windows).
- Nenhuma outra parte visual do sistema muda (cores, layout, logo dentro das telas permanecem).

## Detalhes técnicos

**Offline/sync**
- Fila local em IndexedDB (`idb-keyval`), chave `tc-outbox`: `{ id (uuid), entity: 'sale'|'customer'|'company_settings', op, payload, createdAt, tries }`.
- `src/lib/offline-queue.ts`: `enqueue`, `listPending`, `flush`, `subscribe`; flush disparado no evento `online`, ao focar a janela e a cada 60s.
- `src/lib/use-offline-sync.ts` + indicador em `app-shell.tsx`.
- Escritas do PDV (`app.pos.tsx`), clientes (`app.customers.tsx`) e configurações (`app.settings.tsx`) passam por um wrapper: tenta Supabase; em falha de rede, enfileira e devolve um registro otimista com `client_uuid`.
- Migração: coluna `client_uuid uuid` (nullable) + índice único parcial em `sales` e `customers` para idempotência; upsert com `onConflict: 'client_uuid'`.
- Cache de leitura: últimos resultados de clientes/produtos guardados localmente para o PDV funcionar offline.

**Métricas dos links**
- Migração `payment_link_events` (`id`, `payment_link_id`, `kind 'click'`, `created_at`, `ref`), GRANT INSERT para `anon` e `authenticated`, SELECT só para `is_platform_admin`; RLS conforme.
- RPC `payment_link_stats()` (SECURITY DEFINER, restrita a admin de plataforma, EXECUTE apenas para `authenticated`) agregando cliques + `payments` aprovados por `payment_link_id`.
- Registro de clique em `assinatura.index.tsx` (quando há `?oferta=`) e no botão da home.
- Novo componente `payment-links-stats.tsx` montado em `app.platform.licenses.tsx`.

**Ícone**
- Imagem enviada gera `public/icon-512.png`, `public/icon-192.png`, `public/apple-touch-icon.png`, `public/favicon.png` e `build/icon.ico` (multi-resolução 16–256, via ImageMagick no sandbox).
- `package.json` → `build.win.icon: "build/icon.ico"`, `build.mac.icon`/`build.linux.icon` apontando para o PNG 512, `build.files` incluindo `build/icon.ico`.
- `electron/main.cjs`: `ICON_PATH` usa o `.ico` no Windows (janela + tray).
- `src/routes/__root.tsx`: links de ícone atualizados; manifest do PWA revisado.
- Workflows do GitHub permanecem inalterados (nenhuma mudança em passos, actions ou lockfile).
