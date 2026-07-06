import type { CapacitorConfig } from "@capacitor/cli";

// Mobile shell (Android/iOS) — o app carrega a URL publicada, então novas
// versões publicadas no Lovable ficam disponíveis automaticamente sem precisar
// gerar um novo APK. Para funcionar offline após a primeira abertura,
// o PWA (service worker) cacheia os assets do app.
//
// Para gerar o APK localmente, siga as instruções em `installers/README.md`.

const config: CapacitorConfig = {
  appId: "app.lovable.totalcontrole",
  appName: "TotalControle ERP",
  webDir: "dist",
  server: {
    url: "https://id-preview--ab503052-221a-48ec-9345-c94ccb06c280.lovable.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0b1220",
  },
};

export default config;
