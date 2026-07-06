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

1. Faça as mudanças no Lovable.
2. Clique em **Publish** → **Update**.
3. Pronto. Os apps já instalados (PWA, desktop, Android) exibem o toast de atualização na próxima abertura e recarregam com a nova versão.

Você só precisa gerar um novo `.exe`/`.apk` quando trocar de domínio publicado ou mudar o próprio shell (`electron/main.cjs` ou `capacitor.config.ts`).
