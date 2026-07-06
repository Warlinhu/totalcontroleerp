// TotalControle ERP — Electron desktop shell.
// Estratégia de atualização: carrega o app publicado no domínio configurado.
// Toda vez que você publica uma nova versão no Lovable, o app instalado
// recebe a atualização automaticamente na próxima abertura (ou já no
// próximo refresh, via o service worker do PWA).
//
// Para funcionamento offline, o PWA em segundo plano cacheia os assets
// automaticamente após a primeira abertura online.

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

// URL padrão: domínio estável do app publicado no Lovable.
// Toda nova publicação chega automaticamente aos instaladores existentes.
// Você pode sobrescrever com a variável de ambiente APP_URL ao empacotar.
const APP_URL =
  process.env.APP_URL ||
  "https://totalcontroleerp.lovable.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0b1220",
    title: "TotalControle ERP",
    icon: path.join(__dirname, "..", "public", "icon-512.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Links externos abrem no navegador do sistema, não no app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
