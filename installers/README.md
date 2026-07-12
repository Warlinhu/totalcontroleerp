# Instaladores — TotalControle ERP

O sistema pode ser distribuído em três formatos:

1. **PWA** (já ativo) — o usuário instala direto pelo navegador (Chrome/Edge → botão "Instalar aplicativo"). Atualizações são detectadas automaticamente e o toast pergunta se deseja atualizar.
2. **Desktop** (`.exe` no Windows, `.dmg`/`.app` no macOS, `.AppImage` no Linux) — via Electron.
3. **Mobile Android** (`.apk`) — via Capacitor.

> **Estratégia de atualização:** tanto o app desktop quanto o mobile carregam a URL publicada do Lovable. Sempre que você **publicar** uma nova versão pelo Lovable, todos os usuários com o app instalado recebem a atualização na próxima abertura (ou já no próximo refresh, via o service worker do PWA). Só será necessário gerar um novo instalador se você mudar a `APP_URL`/domínio ou alterar o `capacitor.config.ts` / `electron/main.cjs`.

---

## 1. Windows `.exe`

Requer Node.js instalado localmente.

```bash
# instale as dependências de build (uma única vez)
npm install --save-dev electron @electron/packager

# publique o app no Lovable e substitua APP_URL pela sua URL publicada
export APP_URL="https://seu-dominio-publicado.lovable.app"

# gere o instalador Windows a partir de qualquer sistema (Linux/macOS/Windows)
npx @electron/packager . "TotalControleERP" \
  --platform=win32 --arch=x64 \
  --out=installers/release --overwrite \
  --icon=public/icon-512.png \
  --ignore='^/src' --ignore='^/public/(?!icon-)' \
  --ignore='^/installers' --ignore='^/supabase' \
  --ignore='^/node_modules/(?!electron)'
```

O `.exe` será gerado em `installers/release/TotalControleERP-win32-x64/TotalControleERP.exe`.

Para macOS use `--platform=darwin`, para Linux `--platform=linux`.

---

## 2. Android `.apk`

Requer **Android Studio** ou o **Android SDK + JDK 17** instalados localmente.

```bash
# instale o Capacitor (uma única vez)
npm install @capacitor/core @capacitor/cli @capacitor/android

# ajuste server.url em capacitor.config.ts para sua URL publicada
# depois adicione a plataforma Android e sincronize
npx cap add android
npx cap sync android

# gere o APK debug
cd android
./gradlew assembleDebug
# o APK sai em android/app/build/outputs/apk/debug/app-debug.apk

# para gerar um APK de produção assinado, use:
./gradlew assembleRelease
# (necessário criar um keystore — siga a doc oficial do Android)
```

Instale no celular via USB (`adb install app-debug.apk`) ou envie o arquivo direto para o dispositivo.

---

## 3. Fluxo de novas versões

1. Faça as mudanças no Lovable e clique em **Publish** → **Update**.
2. A webview do desktop e o WebView do Android carregam a nova versão automaticamente na próxima abertura (o service worker do PWA aplica a atualização em segundos).
3. Se o shell nativo mudou (`electron/main.cjs`, `capacitor.config.ts`, ícones, atualizador), **bumpe a versão em `package.json`** e faça push em `main`. O workflow `Build Desktop Installers` gera os instaladores nativos e publica no GitHub Release automaticamente — o app instalado no PC detecta o release novo e instala sozinho (também acessível via bandeja → "Verificar atualizações").

### Como o auto-update funciona

- `package.json` → `build.publish` aponta para o repositório GitHub `Warlinhu/totalcontroleerp`.
- O workflow roda `electron-builder --publish always`, que sobe o instalador **e** os arquivos `latest.yml` / `latest-mac.yml` / `latest-linux.yml`.
- O app instalado consulta esses YAMLs a cada 30 min (ou quando você aciona "Verificar atualizações" na bandeja) e baixa/instala a versão nova.
- Se o clique na bandeja diz "Você já está na versão mais recente", significa que o release publicado tem a mesma versão do `package.json` local — bumpe a versão e faça push.

