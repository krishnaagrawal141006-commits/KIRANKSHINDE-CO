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

// 8. Client Document Vault Manager
const btnRefreshVault = document.getElementById('btnRefreshVault');
const btnOpenVaultRoot = document.getElementById('btnOpenVaultRoot');
const vaultClientsList = document.getElementById('vaultClientsList');
const vaultSearchInput = document.getElementById('vaultSearchInput');

let cachedVaultClients = [];

async function loadClientVault() {
  if (!vaultClientsList) return;
  vaultClientsList.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-dim);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px;"></i>
      <p>Loading local client folders...</p>
    </div>`;

  try {
    const clients = await window.api?.getClientVaults() || [];
    cachedVaultClients = clients;
    renderVaultClients(clients);
  } catch (err) {
    vaultClientsList.innerHTML = `<div style="padding: 20px; color: var(--color-rose);">Failed to load vault: ${err.message}</div>`;
  }
}

function renderVaultClients(clients) {
  if (!vaultClientsList) return;
  if (!clients || clients.length === 0) {
    vaultClientsList.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
        <i class="fa-regular fa-folder-open" style="font-size: 2.2rem; color: var(--text-dim); margin-bottom: 12px;"></i>
        <h4 style="margin: 0 0 6px;">No Client Vault Folders Yet</h4>
        <p style="color: var(--text-dim); font-size: 0.88rem; max-width: 440px; margin: 0 auto;">
          Client folders are created automatically when invoices sync from the website or when client files are placed in storage.
        </p>
      </div>`;
    return;
  }

  vaultClientsList.innerHTML = clients.map(c => {
    const kyc = c.subCount?.['01_KYC_and_Certificates'] || 0;
    const gst = c.subCount?.['02_GST_Documents'] || 0;
    const tax = c.subCount?.['03_Income_Tax_and_Audit'] || 0;
    const bank = c.subCount?.['04_Bank_Statements_and_Bills'] || 0;
    const work = c.subCount?.['05_CA_Employee_Work_Papers'] || 0;

    return `
      <div class="card" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.06); background: rgba(15,23,42,0.6);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <i class="fa-solid fa-folder text-blue" style="font-size: 1.25rem;"></i>
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #f8fafc;">${c.name}</h4>
            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: rgba(59,130,246,0.15); color: #60a5fa; font-weight: 600;">
              ${c.totalFiles} files
            </span>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.76rem;">
            <span style="color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">KYC: <strong style="color: #cbd5e1;">${kyc}</strong></span>
            <span style="color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">GST: <strong style="color: #cbd5e1;">${gst}</strong></span>
            <span style="color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">Tax/Audit: <strong style="color: #cbd5e1;">${tax}</strong></span>
            <span style="color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">Bank: <strong style="color: #cbd5e1;">${bank}</strong></span>
            <span style="color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">Work Papers: <strong style="color: #cbd5e1;">${work}</strong></span>
          </div>
        </div>
        <div>
          <button class="btn btn-secondary btn-open-client-vault" data-path="${c.folderPath}" style="padding: 6px 14px; font-size: 0.85rem;">
            <i class="fa-regular fa-folder-open"></i> Open in Explorer
          </button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-open-client-vault').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = e.currentTarget.getAttribute('data-path');
      window.api?.openClientVault(p);
    });
  });
}

btnRefreshVault?.addEventListener('click', () => loadClientVault());

btnOpenVaultRoot?.addEventListener('click', () => {
  window.api?.openClientVault('');
});

vaultSearchInput?.addEventListener('input', (e) => {
  const q = String(e.target.value || '').toLowerCase().trim();
  if (!q) {
    renderVaultClients(cachedVaultClients);
    return;
  }
  const filtered = cachedVaultClients.filter(c => c.name.toLowerCase().includes(q) || c.folderName.toLowerCase().includes(q));
  renderVaultClients(filtered);
});

// Load vault when clicking on Vault tab
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.getAttribute('data-tab') === 'tab-vault') {
      loadClientVault();
    }
  });
});

