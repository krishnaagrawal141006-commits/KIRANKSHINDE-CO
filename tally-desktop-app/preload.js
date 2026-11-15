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
  openFileInExplorer: (filePath) => ipcRenderer.send('open-file-in-explorer', filePath),
  onLog: (cb) => ipcRenderer.on('engine-log', (_event, value) => cb(value)),
  onStats: (cb) => ipcRenderer.on('engine-stats', (_event, value) => cb(value))
});
