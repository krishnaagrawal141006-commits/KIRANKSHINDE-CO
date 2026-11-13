const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const TallySyncEngine = require('./sync-engine');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Config file path
const configFilePath = path.join(app.getPath('userData'), 'kiran-tally-config.json');
let savedConfig = {
  siteUrl: "https://kirankshinde-co.vercel.app",
  bridgeToken: "ks_tally_secret_2026",
  tallyUrl: "http://127.0.0.1:9000",
  pollIntervalSeconds: 4
};

if (fs.existsSync(configFilePath)) {
  try {
    savedConfig = { ...savedConfig, ...JSON.parse(fs.readFileSync(configFilePath, 'utf8')) };
  } catch (e) {}
}

const engine = new TallySyncEngine(savedConfig);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 840,
    minHeight: 560,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0f1d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: 'Kiran K. Shinde & Co. — Tally Bridge',
          content: 'Running in background. Double-click tray icon to open.'
        });
      }
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  // Fallback to electron default icon if custom icon missing
  tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'assets', 'tray.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Kiran Tally Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Force Sync Now',
      click: () => engine.syncNow()
    },
    {
      label: engine.isPaused ? 'Resume Sync' : 'Pause Sync',
      id: 'pause-resume',
      click: (item) => {
        if (engine.isPaused) {
          engine.resume();
          item.label = 'Pause Sync';
        } else {
          engine.pause();
          item.label = 'Resume Sync';
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Open Admin Website',
      click: () => shell.openExternal('https://kirankshinde-co.vercel.app/admin/index.html')
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        engine.stop();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CA Kiran K. Shinde & Co. — TallyPrime Cloud Sync');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('sync-toggle-pause', () => {
  if (engine.isPaused) {
    engine.resume();
  } else {
    engine.pause();
  }
});

ipcMain.on('sync-force-now', () => {
  engine.syncNow();
});

ipcMain.on('open-admin-site', () => {
  shell.openExternal('https://kirankshinde-co.vercel.app/admin/index.html');
});

ipcMain.on('open-tally-settings', () => {
  shell.openExternal(engine.config.tallyUrl);
});

ipcMain.on('save-config', (event, newConfig) => {
  engine.config = { ...engine.config, ...newConfig };
  fs.writeFileSync(configFilePath, JSON.stringify(engine.config, null, 2), 'utf8');
  engine.log('success', 'Configuration updated successfully.');
});

// App Lifecycle
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Ensure assets directory and fallback icon exist
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    createWindow();
    createTray();

    // Wire Engine Events to Renderer UI & Notifications
    engine.on('log', (logData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine-log', logData);
      }
    });

    engine.on('stats-updated', (stats) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine-stats', stats);
      }
    });

    engine.on('voucher-synced', (data) => {
      if (Notification.isSupported()) {
        new Notification({
          title: '✅ TallyPrime Sync Successful!',
          body: `Invoice ${data.sourceId} (${data.clientName} - ₹${data.amount}) posted to Tally DayBook. Voucher #${data.voucherNo}`
        }).show();
      }
    });

    engine.on('voucher-failed', (data) => {
      if (Notification.isSupported()) {
        new Notification({
          title: '⚠️ Tally Voucher Failed',
          body: `Invoice ${data.sourceId} (${data.clientName}): ${data.error}`
        }).show();
      }
    });

    // Start background sync
    engine.start();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  engine.stop();
});

app.on('window-all-closed', (e) => {
  // Prevent quitting so background sync keeps running in tray
  e.preventDefault();
});
