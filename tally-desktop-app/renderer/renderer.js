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

function appendLog(log) {
  if (!consoleBody) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${log.level || 'info'}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = `[${log.time || new Date().toLocaleTimeString('en-IN')}]`;

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
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

function updateStatsUI(stats) {
  if (!stats) return;

  // 1. Update Tally Card
  if (stats.tallyOnline) {
    if (tallyPill) {
      tallyPill.className = 'status-pill status-online';
      tallyPillText.textContent = 'CONNECTED';
    }
    if (tallyCompanyVal) {
      tallyCompanyVal.textContent = stats.activeCompany || 'Company Active';
      tallyCompanyVal.style.color = '#10b981';
    }
  } else {
    if (tallyPill) {
      tallyPill.className = 'status-pill status-offline';
      tallyPillText.textContent = 'OFFLINE';
    }
    if (tallyCompanyVal) {
      tallyCompanyVal.textContent = 'Open TallyPrime';
      tallyCompanyVal.style.color = '#f43f5e';
    }
  }

  // 2. Update Cloud Card
  if (stats.cloudOnline) {
    if (cloudPill) {
      cloudPill.className = 'status-pill status-online';
      cloudPillText.textContent = 'ONLINE';
    }
  } else {
    if (cloudPill) {
      cloudPill.className = 'status-pill status-offline';
      cloudPillText.textContent = 'CONNECTING...';
    }
  }

  // 3. Sync Pause / Running toggle
  isPaused = Boolean(stats.isPaused);
  if (btnToggleSync) {
    if (isPaused) {
      btnToggleSync.className = 'btn btn-toggle-sync paused';
      btnToggleSync.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="toggleSyncText">SYNC PAUSED</span>';
    } else {
      btnToggleSync.className = 'btn btn-toggle-sync';
      btnToggleSync.innerHTML = '<i class="fa-solid fa-play"></i> <span id="toggleSyncText">SYNC RUNNING</span>';
    }
  }

  // 4. Counters
  if (countSynced) countSynced.textContent = stats.totalSynced || 0;
  if (countPending) countPending.textContent = stats.pendingCount || 0;
  if (countFailed) countFailed.textContent = stats.totalFailed || 0;

  if (lastSyncVal && stats.lastSyncTime) {
    lastSyncVal.textContent = `Last: ${stats.lastSyncTime}`;
  }
}

// 3. On DOM Ready, fetch initial state immediately from main process
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await window.api?.getInitialState();
    if (data && data.stats) {
      updateStatsUI(data.stats);
    }
    if (data && Array.isArray(data.logs)) {
      data.logs.forEach(l => appendLog(l));
    }
  } catch (e) {
    console.error('Error getting initial state:', e);
  }
});

// 4. Listen for continuous real-time updates from engine
window.api?.onStats((stats) => {
  updateStatsUI(stats);
});

window.api?.onLog((log) => {
  appendLog(log);
});
