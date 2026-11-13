const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell, nativeImage } = require('electron');
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

// Recent in-memory logs cache so renderer receives full history on load
const recentLogs = [];
engine.on('log', (logData) => {
  recentLogs.push(logData);
  if (recentLogs.length > 50) recentLogs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('engine-log', logData);
    } catch (e) {}
  }
});

engine.on('stats-updated', (stats) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('engine-stats', stats);
    } catch (e) {}
  }
});

engine.on('voucher-synced', (data) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: '✅ TallyPrime Sync Successful!',
        body: `Invoice ${data.sourceId} (${data.clientName} - ₹${data.amount}) posted to Tally DayBook.`
      }).show();
    }
  } catch (e) {}
});

engine.on('voucher-failed', (data) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: '⚠️ Tally Voucher Rejected',
        body: `Invoice ${data.sourceId} (${data.clientName}): ${data.error}`
      }).show();
    }
  } catch (e) {}
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
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

  mainWindow.webContents.on('did-finish-load', () => {
    // Send initial state & replay recent logs
    try {
      mainWindow.webContents.send('engine-stats', { ...engine.stats, isPaused: engine.isPaused });
      for (const item of recentLogs) {
        mainWindow.webContents.send('engine-log', item);
      }
    } catch (e) {}
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let img = null;
    if (fs.existsSync(iconPath)) {
      img = nativeImage.createFromPath(iconPath);
    }

    tray = new Tray(img || nativeImage.createEmpty());

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
        label: 'Pause / Resume Sync',
        click: () => {
          if (engine.isPaused) {
            engine.resume();
          } else {
            engine.pause();
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
  } catch (e) {
    console.warn('Tray init non-fatal warning:', e.message);
  }
}

// IPC Handlers
ipcMain.handle('get-initial-state', () => {
  return {
    stats: { ...engine.stats, isPaused: engine.isPaused },
    logs: recentLogs
  };
});

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
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(engine.config, null, 2), 'utf8');
  } catch (e) {}
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
    // 1. Start Engine First
    engine.start();

    // 2. Create Window
    createWindow();

    // 3. Create Tray
    createTray();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  engine.stop();
});

app.on('window-all-closed', (e) => {
  // Keep background sync running in tray
  e.preventDefault();
});
