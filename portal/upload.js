// Client Document Upload Portal Logic & Checklist Engine
document.addEventListener('DOMContentLoaded', () => {

  // 1. Client Checklists Database
  const clientChecklists = {
    'new-submission': {
      name: 'New portal submission',
      items: [{ id: 'GEN-1', title: 'Documents received for review', category: 'General', status: 'pending', deadline: 'To be confirmed' }]
    }
  };

  const clientSelect = document.getElementById('clientSelect');
  const checklistContainer = document.getElementById('checklistContainer');
  const pendingSummaryBadge = document.getElementById('pendingSummaryBadge');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectedFilesList = document.getElementById('selectedFilesList');
  const uploadForm = document.getElementById('docUploadForm');
  const successModal = document.getElementById('successModal');

  let queuedFiles = [];

  // 2. Render Checklist for Selected Client
  function renderClientChecklist(clientId) {
    const data = clientChecklists[clientId] || {
      name: 'Selected Client',
      items: [
        { id: 'GEN-1', title: 'Bank Statement for Previous Quarter', category: 'General', status: 'pending', deadline: '25 Oct 2026' }
      ]
    };

    const pendingCount = data.items.filter(i => i.status === 'pending').length;
    if (pendingSummaryBadge) {
      pendingSummaryBadge.innerText = `${pendingCount} Pending`;
      pendingSummaryBadge.style.background = pendingCount > 0 ? '#fee2e2' : '#dcfce7';
      pendingSummaryBadge.style.color = pendingCount > 0 ? '#ef4444' : '#16a34a';
    }

    if (checklistContainer) {
      checklistContainer.innerHTML = data.items.map(item => `
        <div class="check-card ${item.status === 'verified' ? 'verified' : ''}">
          <div class="check-icon ${item.status === 'verified' ? 'done' : 'pending'}">
            <i class="fa-solid ${item.status === 'verified' ? 'fa-circle-check' : 'fa-clock'}"></i>
          </div>
          <div class="check-details">
            <h4>${item.title}</h4>
            <p>${item.category} • Due: <strong style="color: #0f172a;">${item.deadline}</strong></p>
            <div class="check-meta">
              <span>Status: ${item.status === 'verified' ? '<span style="color: #10b981; font-weight:700;">Verified in Vault</span>' : '<span style="color: #d97706; font-weight:700;">Awaiting Upload</span>'}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // Initial render
  if (clientSelect) {
    renderClientChecklist(clientSelect.value);
    clientSelect.addEventListener('change', () => {
      renderClientChecklist(clientSelect.value);
    });
  }

  // 3. Drag and Drop File Handlers
  if (dropZone && fileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      addFilesToQueue(files);
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    });
  }

  function addFilesToQueue(files) {
    queuedFiles = [...queuedFiles, ...files];
    renderFileList();
  }

  function renderFileList() {
    if (!selectedFilesList) return;

    if (queuedFiles.length === 0) {
      selectedFilesList.style.display = 'none';
      selectedFilesList.innerHTML = '';
      return;
    }

    selectedFilesList.style.display = 'flex';
    selectedFilesList.innerHTML = queuedFiles.map((file, idx) => `
      <div class="file-item-pill">
        <span><i class="fa-regular fa-file-pdf" style="color: #ef4444; margin-right: 6px;"></i> ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
        <button type="button" onclick="removeQueuedFile(${idx})" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem;">&times;</button>
      </div>
    `).join('');
  }

  window.removeQueuedFile = function(idx) {
    queuedFiles.splice(idx, 1);
    renderFileList();
  };

  // 4. Form Submit Handler (Simulate Upload & Sync)
  if (uploadForm) {
    uploadForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const clientId = clientSelect.value;
      const clientName = document.getElementById('portalName').value.trim();
      const portalPhone = document.getElementById('portalPhone').value.trim();
      const portalEmail = document.getElementById('portalEmail').value.trim();
      const category = document.getElementById('docCategory').value;
      const period = document.getElementById('docPeriod').value;
      const fileCount = queuedFiles.length > 0 ? queuedFiles.length : 1;
      const firstFileName = queuedFiles.length > 0 ? queuedFiles[0].name : `${category.replace(/\s+/g, '_')}_Document.pdf`;
      const now = new Date();
      const timeStr = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      if (!clientName || !portalPhone) {
        alert('Please enter your name and phone number.');
        return;
      }

      const submissions = JSON.parse(localStorage.getItem('ks_leads') || '[]');
      submissions.unshift({
        id: `PORTAL-${Date.now()}`,
        name: clientName,
        phone: portalPhone,
        email: portalEmail,
        entity: 'Document portal submission',
        service: category,
        notes: `${period} • ${fileCount} file(s) • ${firstFileName}`,
        date: timeStr,
        status: 'New',
        source: 'Document upload portal'
      });
      localStorage.setItem('ks_leads', JSON.stringify(submissions));

      // Generate Receipt
      const receiptId = `RCPT-${Math.floor(100000 + Math.random() * 900000)}`;

      // Update Client Checklist in memory to mark pending items as received
      const clientData = clientChecklists[clientId];
      if (clientData) {
        const firstPending = clientData.items.find(i => i.status === 'pending');
        if (firstPending) {
          firstPending.status = 'verified';
          firstPending.title += ' (Uploaded Just Now)';
        }
      }

      // Populate Success Modal
      document.getElementById('successClientName').innerText = clientName;
      document.getElementById('uploadReceiptBox').innerHTML = `
        <p><strong>Receipt Number:</strong> <code>${receiptId}</code></p>
        <p><strong>Uploaded At:</strong> ${timeStr}</p>
        <p><strong>Category:</strong> ${category} (${period})</p>
        <p><strong>Files Stored:</strong> ${fileCount} file(s) — <em>${firstFileName}</em></p>
        <p><strong>Cloud Vault Destination:</strong> <code style="font-size: 0.72rem;">OneDrive/Clients/${clientName.replace(/\s+/g, '_')}/FY2026-27/${category.replace(/\s+/g, '_')}</code></p>
        <p style="color: #16a34a; font-weight: 700; margin-top: 8px;"><i class="fa-solid fa-circle-check"></i> Dispatched to CA Kiran Shinde & Co. Audit Desk</p>
      `;

      successModal.classList.add('active');

      // Reset Form and Re-render checklist
      uploadForm.reset();
      queuedFiles = [];
      renderFileList();
      renderClientChecklist(clientId);
    });
  }

});

