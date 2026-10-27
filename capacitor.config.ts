import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync } from "fs";

const APP_VERSION: string = JSON.parse(readFileSync("./package.json", "utf8")).version;

// Mobile shell (Android/iOS) — o app carrega a URL publicada, então novas
// versões publicadas no Lovable ficam disponíveis automaticamente sem precisar
// gerar um novo APK. Para funcionar offline após a primeira abertura,
// o PWA (service worker) cacheia os assets do app.
//
// Para gerar o APK localmente, siga as instruções em `installers/README.md`.

const config: CapacitorConfig = {
  appId: "app.lovable.totalcontrole",
  appName: "Total Controle - Gestão Empresarial",
  webDir: "dist",
  server: {
    url: "https://totalcontroleerp.lovable.app",
    cleartext: false,
    // Página local exibida quando o celular está sem internet — o app abre
    // normalmente e volta sozinho ao sistema quando a conexão retorna.
    errorPath: "offline.html",
  },
  // Identifica a versão do APK instalado para sugerir atualizações.
  appendUserAgent: `TotalControleAPK/${APP_VERSION}`,
  android: {
    backgroundColor: "#0b1220",
  },
};

export default config;
