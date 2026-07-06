// TotalControle ERP — Electron desktop shell.
//
// Comportamento como programa instalado no Windows:
//  - Instalador NSIS (electron-builder) cria atalhos no Menu Iniciar, Área
//    de Trabalho e adiciona em "Aplicativos e Recursos".
//  - Uma única instância; ao abrir de novo, foca a janela existente.
//  - Ícone na bandeja do sistema (tray). Fechar a janela minimiza para a
//    bandeja em vez de encerrar — o app segue rodando em segundo plano.
//  - Inicia com o Windows (auto-launch) já minimizado na bandeja, para
//    poder notificar mesmo com a janela fechada.
//  - Auto-update via electron-updater: verifica periodicamente; ao
//    encontrar uma versão, notifica com toast do Windows; clique instala.

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  shell,
  nativeImage,
} = require("electron");
const path = require("path");

const APP_URL =
  process.env.APP_URL || "https://totalcontroleerp.lovable.app";
const ICON_PATH = path.join(__dirname, "..", "public", "icon-512.png");

let mainWindow = null;
let tray = null;
let isQuitting = false;

// -------- Single-instance lock --------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}
app.on("second-instance", () => showWindow());

// -------- Windows metadata / notification identity --------
if (process.platform === "win32") {
  app.setAppUserModelId("com.totalcontrole.erp");
}

// -------- Auto-launch on login (minimized to tray) --------
function configureAutoLaunch() {
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      args: ["--hidden"],
    });
  } catch (e) {
    console.warn("[autolaunch] failed", e);
  }
}

// -------- Window --------
function createWindow(startHidden = false) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: !startHidden,
    backgroundColor: "#0b1220",
    title: "TotalControle ERP",
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Ao fechar: apenas esconde (fica na bandeja para notificar).
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (!mainWindow) createWindow(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// -------- Tray --------
function createTray() {
  try {
    const icon = nativeImage.createFromPath(ICON_PATH);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip("TotalControle ERP");
    const menu = Menu.buildFromTemplate([
      { label: "Abrir TotalControle", click: () => showWindow() },
      { type: "separator" },
      {
        label: "Verificar atualizações",
        click: () => checkForUpdates(true),
      },
      { type: "separator" },
      {
        label: "Sair",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => showWindow());
    tray.on("double-click", () => showWindow());
  } catch (e) {
    console.warn("[tray] failed", e);
  }
}

// -------- Auto-updater --------
// electron-updater lê metadados do publisher configurado no package.json
// (build.publish). Sem publisher configurado, checkForUpdates simplesmente
// não encontra nada; a notificação do PWA dentro da webview continua
// funcionando como fallback.
function setupAutoUpdater() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (e) {
    console.warn("[updater] electron-updater indisponível", e);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const n = new Notification({
      title: "Atualização disponível",
      body: `Baixando TotalControle ${info?.version ?? "nova versão"}…`,
      icon: ICON_PATH,
      silent: false,
    });
    n.show();
  });

  autoUpdater.on("update-downloaded", (info) => {
    const n = new Notification({
      title: "Atualização pronta para instalar",
      body: `Clique para atualizar o TotalControle ERP para ${info?.version ?? "a nova versão"}.`,
      icon: ICON_PATH,
      silent: false,
    });
    n.on("click", () => {
      isQuitting = true;
      autoUpdater.quitAndInstall(false, true);
    });
    n.show();
    // Também sinaliza dentro do app (se estiver aberto) para o usuário
    // ver o botão "Atualizar agora" do toast web.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app-update-ready", info);
    }
  });

  autoUpdater.on("error", (err) => {
    console.warn("[updater] erro:", err?.message || err);
  });

  const check = (manual = false) => {
    autoUpdater
      .checkForUpdates()
      .then((r) => {
        if (manual && !r?.updateInfo) {
          new Notification({
            title: "TotalControle ERP",
            body: "Você já está na versão mais recente.",
            icon: ICON_PATH,
          }).show();
        }
      })
      .catch((e) => console.warn("[updater] check fail", e?.message || e));
  };

  // primeira checagem 10s após abrir, depois a cada 30 minutos
  setTimeout(() => check(false), 10_000);
  setInterval(() => check(false), 30 * 60 * 1000);

  // exposto no escopo para uso pelo tray
  checkForUpdates = check;
}

let checkForUpdates = () => {};

// -------- App lifecycle --------
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  configureAutoLaunch();

  const startHidden =
    process.argv.includes("--hidden") ||
    (app.getLoginItemSettings().wasOpenedAsHidden ?? false);

  createWindow(startHidden);
  createTray();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(false);
    else showWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

// Não encerrar quando todas as janelas fecharem — fica na bandeja.
app.on("window-all-closed", (e) => {
  if (process.platform !== "darwin" && !isQuitting) {
    e.preventDefault?.();
  }
});
