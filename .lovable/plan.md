## Objetivo
Quando os créditos renovarem, executar duas frentes: (1) corrigir os erros pendentes já registrados no sistema e (2) fazer o auto-update do executável no PC funcionar de verdade ao clicar em "Verificar atualizações" na bandeja.

## 1. Corrigir erros pendentes
- Rodar o linter do backend e revisar os erros capturados em `app.platform.errors.tsx` / tabela de erros.
- Verificar console e network do preview para pegar erros de runtime residuais das últimas features (PDV, Dashboard, Changelog, Assistente).
- Corrigir cada item encontrado (tipagem, RLS, GRANTs, queries quebradas, imports, etc.).
- Publicar release no changelog resumindo o que foi corrigido (dispara notificação in-app).

## 2. Auto-update do app desktop (Windows/PC)
Hoje o `electron/main.cjs` chama `autoUpdater.checkForUpdates()`, mas o `package.json` **não tem bloco `build.publish` configurado nem workflow que publique os artefatos de update** (`latest.yml` + instalador NSIS). Sem publisher, o `electron-updater` não encontra nada e o clique em "Verificar atualizações" sempre cai em "Você já está na versão mais recente." O PWA embutido também não recarrega porque a webview aponta para a URL publicada e depende do SW — que no Electron muitas vezes fica preso em cache.

Plano de correção:

**a) Publisher de updates (GitHub Releases)**
- Adicionar em `package.json` → `build.publish`: provider `github`, owner/repo do projeto, releaseType `release`.
- Ajustar `.github/workflows/build-desktop.yml` para:
  - Buildar instalador NSIS Windows (`.exe`) + `latest.yml` via `electron-builder --publish always`.
  - Buildar também macOS (`.dmg` + `latest-mac.yml`) e Linux (`AppImage` + `latest-linux.yml`).
  - Publicar como GitHub Release com tag = versão do `package.json`.
- Documentar em `installers/README.md` como bumpar versão e disparar release.

**b) Fluxo em runtime**
- Trocar `@electron/packager` (que não gera arquivos de update) por `electron-builder` no fluxo de release; manter packager só para builds locais rápidos.
- Garantir que `autoUpdater` só rode em builds empacotadas (`app.isPackaged`), evitando warnings em dev.
- No item de bandeja "Verificar atualizações": mostrar toast "Procurando…" imediato, e diferenciar 3 estados: já atualizado / baixando / pronto para instalar. Hoje só mostra "já está na versão mais recente" — o usuário não vê progresso.
- Ao terminar o download, mostrar notificação com botão "Instalar agora" e, se o usuário clicar, chamar `quitAndInstall`.

**c) Cache do PWA dentro do Electron**
- Forçar `session.defaultSession.clearCache()` ao detectar `update-downloaded`, para a próxima abertura pegar HTML fresco.
- Manter o `NetworkFirst` do SW; sem isso, a webview às vezes serve HTML antigo mesmo após o app novo instalar.

**d) macOS (bônus do relato anterior)**
- Assinar ad-hoc no workflow (`codesign --force --deep --sign -`) para o .app abrir depois de descompactado sem "app está danificado".

## 3. Verificação
- Bumpar versão para `x.y.z+1`, rodar workflow, instalar a versão anterior no PC de teste, abrir, esperar 10s, clicar "Verificar atualizações" na bandeja → deve baixar e oferecer instalar.
- Publicar entrada no changelog: "Auto-update do desktop corrigido + correções de bugs pendentes".

## Fora do escopo desta rodada
- Reescrever o instalador do zero.
- Trocar de GitHub Releases para outro publisher (S3/Cloudflare) — pode ser feito depois se preferir.
