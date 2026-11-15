// UI Controller for Kiran Tally Bridge Desktop App (v1.3)

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

// Bank Converter Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');
const bankDropzone = document.getElementById('bankDropzone');
const btnBrowseBankPdf = document.getElementById('btnBrowseBankPdf');
document.getElementById('btnOpenBankConverterSource')?.addEventListener('click', () => {
  window.api.openBankConverterSource();
});
const bankFileInput = document.getElementById('bankFileInput');
const bankResultCard = document.getElementById('bankResultCard');
const resBankName = document.getElementById('resBankName');
const resFileName = document.getElementById('resFileName');
const resFilePath = document.getElementById('resFilePath');
const resTxCount = document.getElementById('resTxCount');
const resTotalDebit = document.getElementById('resTotalDebit');
const resTotalCredit = document.getElementById('resTotalCredit');
const resPreviewBody = document.getElementById('resPreviewBody');
const btnOpenExcelFile = document.getElementById('btnOpenExcelFile');
const btnShowInFolder = document.getElementById('btnShowInFolder');

let lastGeneratedExcelPath = null;
let isPaused = false;

// 1. Tab Switching
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetId = tab.getAttribute('data-tab');
    navTabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');
  });
});

// 2. Window Controls
btnMinimize?.addEventListener('click', () => window.api?.minimize());
btnClose?.addEventListener('click', () => window.api?.close());

// 3. Action Buttons
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

// 4. Bank Converter Logic (100% Deterministic & Offline)
async function processBankPdf(filePath) {
  if (!filePath) return;
  appendLog({ level: 'info', text: `Analyzing statement: ${filePath}...`, time: new Date().toLocaleTimeString('en-IN') });

  try {
    const res = await window.api?.convertBankPdf(filePath);
    if (!res || !res.success) {
      alert(`Conversion Failed: ${res?.error || 'Could not parse tabular transactions from this PDF.'}`);
      return;
    }

    lastGeneratedExcelPath = res.outputPath;

    // Display Result Card
    if (bankResultCard) bankResultCard.style.display = 'flex';
    if (resBankName) resBankName.textContent = res.bankName;
    if (resFileName) resFileName.textContent = res.fileName;
    if (resFilePath) resFilePath.textContent = res.outputPath;
    if (resTxCount) resTxCount.textContent = `${res.transactionCount} Rows`;
    if (resTotalDebit) resTotalDebit.textContent = `₹ ${Number(res.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (resTotalCredit) resTotalCredit.textContent = `₹ ${Number(res.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Populate Preview Table
    if (resPreviewBody) {
      resPreviewBody.innerHTML = (res.transactions || []).map(tx => `
        <tr>
          <td>${tx.date}</td>
          <td>${tx.narration.slice(0, 45)}...</td>
          <td>${tx.refNo || '-'}</td>
          <td style="color: ${tx.debit > 0 ? '#f43f5e' : 'inherit'}; font-weight: ${tx.debit > 0 ? '700' : '400'};">
            ${tx.debit > 0 ? '₹ ' + Number(tx.debit).toLocaleString('en-IN') : '-'}
          </td>
          <td style="color: ${tx.credit > 0 ? '#10b981' : 'inherit'}; font-weight: ${tx.credit > 0 ? '700' : '400'};">
            ${tx.credit > 0 ? '₹ ' + Number(tx.credit).toLocaleString('en-IN') : '-'}
          </td>
          <td>₹ ${Number(tx.balance || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    }

    appendLog({
      level: 'success',
      text: `✅ Generated Excel! ${res.bankName} (${res.transactionCount} txns). Saved to: ${res.fileName}`,
      time: new Date().toLocaleTimeString('en-IN')
    });
  } catch (err) {
    alert('Error converting PDF: ' + err.message);
  }
}

// Browse Button
btnBrowseBankPdf?.addEventListener('click', async () => {
  const selectedPath = await window.api?.browseBankPdf();
  if (selectedPath) {
    processBankPdf(selectedPath);
  }
});

// Drag & Drop
if (bankDropzone) {
  ['dragenter', 'dragover'].forEach(eventName => {
    bankDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      bankDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    bankDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      bankDropzone.classList.remove('dragover');
    });
  });

  bankDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].path) {
      processBankPdf(files[0].path);
    }
  });
}

btnOpenExcelFile?.addEventListener('click', () => {
  if (lastGeneratedExcelPath) {
    window.api?.openFileInExplorer(lastGeneratedExcelPath);
  }
});

btnShowInFolder?.addEventListener('click', () => {
  if (lastGeneratedExcelPath) {
    window.api?.openFileInExplorer(lastGeneratedExcelPath);
  }
});

// 5. Log & Stats Helpers
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

// 6. On DOM Ready, fetch initial state immediately from main process
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

// 7. Listen for continuous real-time updates from engine
window.api?.onStats((stats) => {
  updateStatsUI(stats);
});

window.api?.onLog((log) => {
  appendLog(log);
});
