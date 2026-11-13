const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  togglePause: () => ipcRenderer.send('sync-toggle-pause'),
  forceSync: () => ipcRenderer.send('sync-force-now'),
  openAdminSite: () => ipcRenderer.send('open-admin-site'),
  openTallySettings: () => ipcRenderer.send('open-tally-settings'),
  getInitialState: () => ipcRenderer.invoke('get-initial-state'),
  saveConfig: (cfg) => ipcRenderer.send('save-config', cfg),
  onLog: (cb) => ipcRenderer.on('engine-log', (_event, value) => cb(value)),
  onStats: (cb) => ipcRenderer.on('engine-stats', (_event, value) => cb(value))
});
