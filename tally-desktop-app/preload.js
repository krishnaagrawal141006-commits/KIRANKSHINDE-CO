const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  togglePause: () => ipcRenderer.send('sync-toggle-pause'),
  forceSync: () => ipcRenderer.send('sync-force-now'),
  openAdminSite: () => ipcRenderer.send('open-admin-site'),
  openTallySettings: () => ipcRenderer.send('open-tally-settings'),
  openBankConverterSource: () => ipcRenderer.send('open-bank-converter-source'),
  getInitialState: () => ipcRenderer.invoke('get-initial-state'),
  saveConfig: (cfg) => ipcRenderer.send('save-config', cfg),
  browseBankPdf: () => ipcRenderer.invoke('browse-bank-pdf'),
  convertBankPdf: (filePath) => ipcRenderer.invoke('convert-bank-pdf', filePath),
  classifyBankNarrations: (txs) => ipcRenderer.invoke('ai-classify-narrations', txs),
  postBankTxsToTally: (data) => ipcRenderer.invoke('post-bank-txs-to-tally', data),
  getTallyBankLedgers: () => ipcRenderer.invoke('get-tally-bank-ledgers'),
  openFileInExplorer: (filePath) => ipcRenderer.send('open-file-in-explorer', filePath),
  getClientVaults: () => ipcRenderer.invoke('client-vault-list'),
  openClientVault: (folderName) => ipcRenderer.send('client-vault-open', folderName),
  openWhatsAppWeb: () => ipcRenderer.send('whatsapp-open-web'),
  sendWhatsAppInvoice: (payload) => ipcRenderer.invoke('whatsapp-send-invoice', payload),
  generateInvoicePdf: (payload) => ipcRenderer.invoke('invoice-generate-pdf', payload),
  onLog: (cb) => ipcRenderer.on('engine-log', (_event, value) => cb(value)),
  onStats: (cb) => ipcRenderer.on('engine-stats', (_event, value) => cb(value)),
  onBankProgress: (cb) => ipcRenderer.on('bank-post-progress', (_event, value) => cb(value)),
  onWhatsAppVoucherReady: (cb) => ipcRenderer.on('voucher-synced-ready-for-whatsapp', (_event, value) => cb(value))
});
