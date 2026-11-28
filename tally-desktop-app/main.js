const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const TallySyncEngine = require('./sync-engine');
const BankStatementConverter = require('./bank-converter');
const NaraRouterAI = require('./ai-router');

const bankConverter = new BankStatementConverter();
const aiRouter = new NaraRouterAI();

let mainWindow = null;
let tray = null;
let isQuitting = false;
let whatsappWindow = null;

function getOrCreateWhatsAppWindow() {
  if (whatsappWindow && !whatsappWindow.isDestroyed()) {
    whatsappWindow.show();
    whatsappWindow.focus();
    return whatsappWindow;
  }

  whatsappWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 840,
    minHeight: 600,
    title: 'CA Kiran K. Shinde & Co. — WhatsApp Web Auto-Dispatcher',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    webPreferences: {
      partition: 'persist:whatsapp',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  whatsappWindow.webContents.setUserAgent(chromeUserAgent);

  whatsappWindow.loadURL('https://web.whatsapp.com');

  whatsappWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      whatsappWindow.hide();
    }
  });

  return whatsappWindow;
}

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

engine.on('bank-post-progress', (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('bank-post-progress', progress);
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

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('voucher-synced-ready-for-whatsapp', data);
    } catch (e) {}
  }
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
        label: '💬 Open WhatsApp Web Dispatcher',
        click: () => getOrCreateWhatsAppWindow()
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

ipcMain.on('open-bank-converter-source', () => {
  shell.openExternal('https://github.com/cloudpotions/PDF-to-Excel-Bank-Statements-Converter');
});

ipcMain.handle('browse-bank-pdf', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Bank Statement PDF',
      filters: [{ name: 'Bank Statements (*.pdf)', extensions: ['pdf'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  } catch (e) {
    return null;
  }
});

ipcMain.handle('convert-bank-pdf', async (event, filePath) => {
  try {
    engine.log('info', `Converting Bank Statement: ${path.basename(filePath)}...`);
    const res = await bankConverter.convertPdfToExcel(filePath);
    engine.log('success', `✅ Converted! ${res.bankName} (${res.transactionCount} entries) -> ${res.fileName}`);
    return res;
  } catch (err) {
    engine.log('error', `❌ Bank Conversion Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// NaraRouter AI Narration Categorizer Handler
ipcMain.handle('ai-classify-narrations', async (event, transactions) => {
  try {
    engine.log('info', `🤖 Running NaraRouter AI on ${transactions.length} transactions...`);
    const results = await aiRouter.classifyNarrations(transactions);
    engine.log('success', `✅ AI Categorized ${results.length} narrations into Tally Ledgers!`);
    return { success: true, classifications: results };
  } catch (err) {
    engine.log('warn', `⚠️ AI Categorizer note: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// Suvit-Style Bank Statement Direct Auto-Posting to Tally
ipcMain.handle('post-bank-txs-to-tally', async (event, { transactions, bankLedger }) => {
  try {
    return await engine.postBankTransactionsToTally(transactions, bankLedger);
  } catch (err) {
    engine.log('error', `❌ Bank Post Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-tally-bank-ledgers', async () => {
  try {
    return await engine.getTallyBankLedgers();
  } catch (e) {
    return ['HDFC Bank Ltd', 'State Bank of India', 'ICICI Bank Ltd', 'Bank Account'];
  }
});

ipcMain.on('open-file-in-explorer', (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// Client Document Vault IPC Handlers
ipcMain.handle('client-vault-list', async () => {
  try {
    return engine.clientVault ? engine.clientVault.listClients() : [];
  } catch (e) {
    return [];
  }
});

ipcMain.on('client-vault-open', (event, folderName) => {
  try {
    if (engine.clientVault) engine.clientVault.openClientInExplorer(folderName);
  } catch (e) {}
});

ipcMain.on('save-config', (event, newConfig) => {
  engine.config = { ...engine.config, ...newConfig };
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(engine.config, null, 2), 'utf8');
  } catch (e) {}
  engine.log('success', 'Configuration updated successfully.');
});

// ================= WHATSAPP WEB & INVOICE PDF IPC HANDLERS =================
ipcMain.on('whatsapp-open-web', () => {
  getOrCreateWhatsAppWindow();
});

ipcMain.handle('whatsapp-launch-python-bot', async () => {
  try {
    const candidates = [
      path.resolve(__dirname, '..', 'START WHATSAPP BOT.bat'),
      path.resolve(__dirname, '..', '..', 'START WHATSAPP BOT.bat'),
      path.resolve(process.resourcesPath || '', '..', '..', '..', 'START WHATSAPP BOT.bat'),
      'E:\\kiran k shinde & co\\START WHATSAPP BOT.bat'
    ];
    const batPath = candidates.find(p => p && fs.existsSync(p));
    if (!batPath) {
      return { ok: false, error: 'START WHATSAPP BOT.bat not found in workspace folder.' };
    }
    // Use shell.openPath (ShellExecuteW) so spaces and '&' in 'kiran k shinde & co' never break cmd.exe!
    const openErr = await shell.openPath(batPath);
    if (openErr) {
      const batDir = path.dirname(batPath);
      const batFile = path.basename(batPath);
      const child = spawn('cmd.exe', ['/s', '/c', `start "Kiran WhatsApp Bot" "${batFile}"`], {
        detached: true,
        stdio: 'ignore',
        cwd: batDir,
        windowsVerbatimArguments: true
      });
      child.unref();
    }
    engine.log('success', '🐍 Launched Python WhatsApp Auto-Dispatcher Bot!');
    return { ok: true, batPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('whatsapp-fetch-cloud-queue', async () => {
  try {
    const qUrl = `${engine.config.siteUrl}/api/tally/whatsapp`;
    const res = await engine.request(qUrl, {
      method: 'GET',
      headers: { 'x-bridge-token': engine.config.bridgeToken }
    });
    if (res.statusCode !== 200) return { ok: false, queue: [] };
    const parsed = JSON.parse(res.body || '{}');
    return { ok: true, queue: parsed.queue || [] };
  } catch (err) {
    return { ok: false, queue: [], error: err.message };
  }
});

ipcMain.handle('whatsapp-send-invoice', async (event, payload) => {
  try {
    const win = getOrCreateWhatsAppWindow();
    let phone = String(payload.phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const invoiceId = payload.invoiceId || 'INV';
    const amount = Number(String(payload.amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const clientName = payload.clientName || 'Valued Client';
    const service = payload.service || 'Statutory Compliance & CA Consultancy Fees';
    const voucherNo = payload.voucherNo ? ` (Tally Ref: #${payload.voucherNo})` : '';

    const webPayLink = `https://www.cakiran.co.in/pay?inv=${encodeURIComponent(invoiceId)}&am=${amount}&client=${encodeURIComponent(clientName)}`;

    const defaultMsg = `Namaste *${clientName}* Ji,\n\nGreetings from *CA Kiran K. Shinde & Co.* 🙏\n\nYour official Tax Invoice & compliance details are ready:\n\n📄 *Invoice No:* ${invoiceId}${voucherNo}\n💼 *Particulars:* ${service}\n💰 *Amount Due:* ₹${amount.toLocaleString('en-IN')}\n\n⚡ *1-Click Pay Online (GPay / PhonePe / Paytm / Any UPI):*\n👉 *Pay Link:* ${webPayLink}\n👉 *UPI ID:* 7506647791@hdfcbank\n\n📄 *View / Download Invoice PDF:* ${webPayLink}&pdf=1\n\n*Bank NEFT / RTGS Details:*\nBank: HDFC Bank Ltd | A/C: 50200067891234 | IFSC: HDFC0000123\n\nPlease share the payment screenshot / UTR once done. Thank you!\n*CA Kiran K. Shinde & Co.* | +91 75066 47791`;

    const message = payload.message || defaultMsg;

    const url = phone
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    win.loadURL(url);
    win.show();
    win.focus();

    return { ok: true, phone, message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('invoice-generate-pdf', async (event, data) => {
  try {
    const clientName = data.clientName || 'Client';
    const invoiceId = data.invoiceId || data.sourceId || 'INV';
    const amount = data.amount || 0;
    const cleanAmount = Number(String(amount).replace(/[^0-9.]/g, '')) || 0;
    const formattedAmount = cleanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const service = data.service || 'Statutory Compliance & Professional CA Consultancy Fees';
    const voucherNo = data.voucherNo || invoiceId.replace(/[^0-9]/g, '') || '529';
    const dateStr = data.date || new Date().toLocaleDateString('en-IN');

    // Create client folder
    let targetFolder = path.join(app.getPath('userData'), 'invoices');
    if (engine.clientVault) {
      const folders = engine.clientVault.ensureClientFolder(clientName, invoiceId);
      targetFolder = folders.bank || targetFolder;
    }
    fs.mkdirSync(targetFolder, { recursive: true });

    const safeInvId = String(invoiceId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfPath = path.join(targetFolder, `Invoice_${safeInvId}.pdf`);

    // Generate HTML for Authentic 1:1 Tally Invoice
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceId}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; background: #fff; color: #000; font-size: 12px; line-height: 1.35; }
    .tally-sheet { border: 2px solid #000; }
    .title-bar { text-align: center; font-weight: 800; font-size: 15px; padding: 6px 0; border-bottom: 1px solid #000; letter-spacing: 1px; }
    .row-split { display: flex; border-bottom: 1px solid #000; }
    .col-left { width: 52%; border-right: 1px solid #000; }
    .col-right { width: 48%; }
    .cell-pad { padding: 8px 10px; }
    .cell-border { border-bottom: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-right: 1px solid #000; padding: 6px 8px; font-size: 11px; }
    th:last-child, td:last-child { border-right: none; }
    th { border-bottom: 1px solid #000; background: #fafafa; font-weight: 700; text-align: left; }
    .amt { text-align: right; }
  </style>
</head>
<body>
  <div class="tally-sheet">
    <div class="title-bar">INVOICE</div>
    <div class="row-split">
      <div class="col-left">
        <div class="cell-pad cell-border">
          <strong style="font-size: 13px;">CA KIRAN K. SHINDE &amp; CO.</strong><br>
          <span>Chartered Accountants &bull; FRN: 147829W</span><br>
          <span>State Name: Maharashtra, Code: 27</span>
        </div>
        <div class="cell-pad">
          <span style="font-size: 10px; color: #555;">Buyer (Bill to):</span><br>
          <strong style="font-size: 12px;">${clientName}</strong><br>
          <span>State Name: Maharashtra, Code: 27</span>
        </div>
      </div>
      <div class="col-right">
        <div class="row-split" style="border-bottom: 1px solid #000;">
          <div style="width: 50%; border-right: 1px solid #000; padding: 6px 8px;">
            <span style="font-size: 10px; color: #555;">Invoice No.</span><br>
            <strong>${voucherNo}</strong>
          </div>
          <div style="width: 50%; padding: 6px 8px;">
            <span style="font-size: 10px; color: #555;">Dated</span><br>
            <strong>${dateStr}</strong>
          </div>
        </div>
        <div class="cell-pad">
          <span style="font-size: 10px; color: #555;">Reference No. &amp; Date</span><br>
          <strong>${invoiceId} dt. ${dateStr}</strong>
        </div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">Sl</th>
          <th>Description of Services</th>
          <th style="width: 70px;">SAC</th>
          <th class="amt" style="width: 100px;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr style="height: 180px; vertical-align: top;">
          <td>1</td>
          <td>
            <strong>Professional Fees Account</strong><br>
            <span style="color: #444;">${service}</span>
          </td>
          <td>998231</td>
          <td class="amt"><strong>${formattedAmount}</strong></td>
        </tr>
        <tr style="border-top: 1px solid #000; font-weight: 700;">
          <td colspan="3" style="text-align: right; padding: 6px 8px;">Total</td>
          <td class="amt" style="padding: 6px 8px;">₹ ${formattedAmount}</td>
        </tr>
      </tbody>
    </table>
    <div class="cell-pad cell-border">
      <span style="font-size: 10px; color: #555;">Declaration:</span><br>
      <span>We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.</span>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 12px 10px 8px;">
      <div>
        <span style="font-size: 10px;">Bank: HDFC Bank Ltd | A/C: 50200067891234 | IFSC: HDFC0000123</span><br>
        <span style="font-size: 10px;">UPI ID: 7506647791@hdfcbank</span>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px;">For <strong>CA KIRAN K. SHINDE &amp; CO.</strong></span><br><br>
        <span style="font-size: 10px;">Authorised Signatory</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Render offscreen and print to PDF
    const printWin = new BrowserWindow({
      show: false,
      width: 820,
      height: 1160,
      webPreferences: { offscreen: true }
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });

    fs.writeFileSync(pdfPath, pdfData);
    printWin.destroy();

    engine.log('success', `📄 Invoice PDF generated & saved: ${pdfPath}`);
    return { ok: true, pdfPath, invoiceId, clientName };
  } catch (err) {
    console.error('Invoice PDF generation failed:', err);
    return { ok: false, error: err.message };
  }
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
