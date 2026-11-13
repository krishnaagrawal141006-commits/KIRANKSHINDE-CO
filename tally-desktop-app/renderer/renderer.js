// UI Controller for Kiran Tally Bridge Desktop App

const btnMinimize = document.getElementById('btnMinimize');
const btnClose = document.getElementById('btnClose');
const btnToggleSync = document.getElementById('btnToggleSync');
const toggleSyncText = document.getElementById('toggleSyncText');
const btnForceSync = document.getElementById('btnForceSync');
const btnOpenAdmin = document.getElementById('btnOpenAdmin');
const btnClearLogs = document.getElementById('btnClearLogs');

const tallyPill = document.getElementById('tallyPill');
const tallyPillText = document.getElementById('tallyPillText');
const tallyCompanyVal = document.getElementById('tallyCompanyVal');
const tallyPortVal = document.getElementById('tallyPortVal');
const tallyPeriodVal = document.getElementById('tallyPeriodVal');

const cloudPill = document.getElementById('cloudPill');
const cloudPillText = document.getElementById('cloudPillText');
const lastSyncVal = document.getElementById('lastSyncVal');

const countSynced = document.getElementById('countSynced');
const countPending = document.getElementById('countPending');
const countFailed = document.getElementById('countFailed');
const consoleBody = document.getElementById('consoleBody');

let isPaused = false;

// 1. Window Controls
btnMinimize?.addEventListener('click', () => window.api?.minimize());
btnClose?.addEventListener('click', () => window.api?.close());

// 2. Action Buttons
btnToggleSync?.addEventListener('click', () => {
  window.api?.togglePause();
});

btnForceSync?.addEventListener('click', () => {
  window.api?.forceSync();
});

btnOpenAdmin?.addEventListener('click', () => {
  window.api?.openAdminSite();
});

btnClearLogs?.addEventListener('click', () => {
  consoleBody.innerHTML = '';
});

// 3. Receive Live Stats from Main Process
window.api?.onStats((stats) => {
  // Update Tally Card
  if (stats.tallyOnline) {
    tallyPill.className = 'status-pill status-online';
    tallyPillText.textContent = 'CONNECTED';
    tallyCompanyVal.textContent = stats.activeCompany || 'Company Active';
    tallyCompanyVal.style.color = '#10b981';
  } else {
    tallyPill.className = 'status-pill status-offline';
    tallyPillText.textContent = 'OFFLINE';
    tallyCompanyVal.textContent = 'Open TallyPrime';
    tallyCompanyVal.style.color = '#f43f5e';
  }

  // Update Cloud Card
  if (stats.cloudOnline) {
    cloudPill.className = 'status-pill status-online';
    cloudPillText.textContent = 'ONLINE';
  } else {
    cloudPill.className = 'status-pill status-offline';
    cloudPillText.textContent = 'CONNECTING...';
  }

  // Sync Pause / Running toggle
  isPaused = Boolean(stats.isPaused);
  if (isPaused) {
    btnToggleSync.className = 'btn btn-toggle-sync paused';
    btnToggleSync.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="toggleSyncText">SYNC PAUSED</span>';
  } else {
    btnToggleSync.className = 'btn btn-toggle-sync';
    btnToggleSync.innerHTML = '<i class="fa-solid fa-play"></i> <span id="toggleSyncText">SYNC RUNNING</span>';
  }

  // Counters
  countSynced.textContent = stats.totalSynced || 0;
  countPending.textContent = stats.pendingCount || 0;
  countFailed.textContent = stats.totalFailed || 0;

  if (stats.lastSyncTime) {
    lastSyncVal.textContent = `Last: ${stats.lastSyncTime}`;
  }
});

// 4. Receive Live Logs
window.api?.onLog((log) => {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${log.level || 'info'}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = `[${log.time}]`;

  const tag = document.createElement('span');
  tag.className = `log-tag tag-${log.level || 'info'}`;
  tag.textContent = (log.level || 'INFO').toUpperCase();

  const text = document.createElement('span');
  text.className = 'log-text';
  text.textContent = log.text;

  entry.appendChild(time);
  entry.appendChild(tag);
  entry.appendChild(text);

  consoleBody.appendChild(entry);

  // Auto-scroll to bottom
  consoleBody.scrollTop = consoleBody.scrollHeight;
});
