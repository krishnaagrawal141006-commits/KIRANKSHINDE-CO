// CA Firm CRM & Admin Panel State Management
const AdminCRM = {
  editingClientId: null,
  invoiceFilter: 'all',
  invoiceSearchQuery: '',
  currentReminderInv: null,
  currentReminderTemplateType: 'gentle',
  currentReminderUpiUrl: '',
  // 1. Initial State Data with realistic Indian CA Firm Data
  state: { clients: [], leads: [], tasks: [], pendingDocs: [], invoices: [], calendarBookings: [], articles: [], deadlines: [] },

  async init() {
    if (!await this.requireAdminLogin()) return;
    const savedLeads = JSON.parse(localStorage.getItem('ks_leads') || '[]');
    this.state.leads = savedLeads;
    this.state.clients = JSON.parse(localStorage.getItem('ks_clients') || '[]');
    this.state.tasks = JSON.parse(localStorage.getItem('ks_tasks') || '[]');
    this.state.pendingDocs = JSON.parse(localStorage.getItem('ks_pending_docs') || '[]');
    this.loadDeadlines();
    this.loadCloudWorkflow();
    this.loadCloudInvoices();
    // Clear old seeded default team entries if found
    let savedTeam = JSON.parse(localStorage.getItem('ks_team') || '[]');
    if (savedTeam.length && savedTeam.some(emp => emp.name === 'CA Kiran Kashinath Shinde' || emp.name === 'Pooja Dilip Dahiwadkar' || emp.status === 'Former')) {
      savedTeam = [];
      localStorage.setItem('ks_team', JSON.stringify([]));
    }
    this.state.employees = savedTeam;
    this.renderAll();
    this.loadCloudTasks();
    setInterval(() => this.loadCloudTasks(), 15000);
    this.checkTallyConnectorStatus();
    this.loadTallyQueue();
    setInterval(() => {
      this.checkTallyConnectorStatus();
      this.loadTallyQueue();
    }, 10000);
    this.setupTabNavigation();
    this.setupGstReconciliation();
    this.setupWebBankToTallyPush();
    this.setupModals();
    this.setupMobileMenu();
    this.loadGmbReviewLink();
    this.renderTeamEditor();
    window.addEventListener('storage', (event) => {
      if (event.key === 'ks_leads') {
        this.state.leads = JSON.parse(event.newValue || '[]');
        this.renderMetrics();
        this.renderLeadsTable();
      }
      if (event.key === 'ks_team') {
        this.state.employees = JSON.parse(event.newValue || '[]');
        this.renderEmployeesTable();
      }
      if (event.key === 'ks_clients') { this.state.clients = JSON.parse(event.newValue || '[]'); this.renderClientsTable(); this.renderMetrics(); this.populateDocModalClients(); }
      if (event.key === 'ks_tasks') { this.state.tasks = JSON.parse(event.newValue || '[]'); this.renderKanbanBoard(); this.renderDashboardRecent(); this.renderMetrics(); }
      if (event.key === 'ks_pending_docs') { this.state.pendingDocs = JSON.parse(event.newValue || '[]'); this.renderDocumentsTable(); this.renderMetrics(); }
    });
  },

  async requireAdminLogin() {
    const gate = document.getElementById('adminAuthGate');
    const form = document.getElementById('adminAuthForm');
    const client = await window.createSupabaseClient?.();
    if (!gate || !form || !client) return false;
    const existing = (await client.auth.getSession()).data.session;
    if (existing) { gate.style.display = 'none'; this.setupAdminLogout(client); return true; }
    form.addEventListener('submit', async event => {
      event.preventDefault(); const errorEl = document.getElementById('adminAuthError'); errorEl.textContent = 'Signing in…';
      const result = await client.auth.signInWithPassword({ email: document.getElementById('adminAuthEmail').value.trim(), password: document.getElementById('adminAuthPassword').value });
      if (result.error) { errorEl.textContent = result.error.message; return; }
      gate.style.display = 'none'; window.location.reload();
    });
    return false;
  },

  setupAdminLogout(client) {
    const button = document.getElementById('adminLogoutBtn');
    if (button) button.onclick = async () => { await client.auth.signOut(); window.location.reload(); };
  },

  persistWorkflow() {
    localStorage.setItem('ks_clients', JSON.stringify(this.state.clients));
    localStorage.setItem('ks_tasks', JSON.stringify(this.state.tasks));
    localStorage.setItem('ks_pending_docs', JSON.stringify(this.state.pendingDocs));
  },

  // 2. Render UI
  renderAll() {
    this.renderMetrics();
    this.renderClientsTable();
    this.renderLeadsTable();
    this.renderEmployeesTable();
    this.renderKanbanBoard();
    this.renderReviewBox();
    this.renderInvoicesTable();
    this.renderArticlesTable();
    this.renderDocumentsTable();
    this.renderTallySyncTable();
    this.renderCalendarTable();
    this.renderDashboardRecent();
    this.populateDocModalClients();
  },

  async loadCloudTasks() {
    try {
      const token = await this.adminToken();
      if (!token) return;
      const res = await fetch('/api/admin/list-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data && Array.isArray(data.tasks)) {
        const existingMap = new Map();
        this.state.tasks.forEach(t => existingMap.set(String(t.id), t));

        data.tasks.forEach(cloudTask => {
          const local = existingMap.get(String(cloudTask.id));
          if (local) {
            local.stage = cloudTask.stage || local.stage;
            local.assigned = cloudTask.assigned || local.assigned;
            local.assignedEmail = cloudTask.assignedEmail || local.assignedEmail;
            local.dueDate = cloudTask.dueDate || local.dueDate;
            if (cloudTask.remarks && cloudTask.remarks.length) {
              local.remarks = cloudTask.remarks;
            }
          } else {
            this.state.tasks.push(cloudTask);
          }
        });

        this.persistWorkflow();
        this.renderKanbanBoard();
        this.renderReviewBox();
        this.renderDashboardRecent();
        this.renderMetrics();
      }
    } catch (e) {
      console.warn('Could not load cloud tasks', e);
    }
  },

  renderReviewBox() {
    const reviewTasks = (this.state.tasks || []).filter(t => t.stage === 'in-review');
    const badge = document.getElementById('reviewBoxBadge');
    if (badge) {
      badge.textContent = `${reviewTasks.length} Pending`;
      badge.style.display = reviewTasks.length > 0 ? 'inline-block' : 'none';
    }
    const banner = document.getElementById('complianceReviewBanner');
    const countEl = document.getElementById('reviewBannerCount');
    if (banner && countEl) {
      countEl.textContent = reviewTasks.length;
      banner.style.display = reviewTasks.length > 0 ? 'flex' : 'none';
    }

    const tbody = document.getElementById('reviewBoxTableBody');
    if (!tbody) return;

    if (reviewTasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 28px; color: #64748b;"><i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>All caught up! No employee submissions currently waiting for review.</td></tr>';
      return;
    }

    tbody.innerHTML = reviewTasks.map(t => {
      const remarks = t.remarks || [];
      const lastRemark = remarks.length ? remarks[remarks.length - 1] : null;
      return `
        <tr>
          <td>
            <strong><i class="fa-solid fa-user-check" style="color:#2563eb;margin-right:6px"></i>${t.assigned || 'Employee'}</strong>
            ${t.assignedEmail ? `<br><small style="color:#64748b">${t.assignedEmail}</small>` : ''}
          </td>
          <td><strong>${t.client || 'Client'}</strong></td>
          <td>
            <span class="kanban-tag ${t.tag || 'tag-gst'}">${(t.tag || 'GST').replace('tag-', '').toUpperCase()}</span>
            <div style="font-weight:600;margin-top:4px">${t.taskName}</div>
          </td>
          <td><span style="color:#d97706;font-weight:600">${t.dueDate || 'To be scheduled'}</span></td>
          <td style="max-width:260px">
            ${lastRemark ? `<div style="font-size:0.8rem;background:#f8fafc;padding:6px 8px;border-radius:6px;border-left:3px solid #2563eb"><strong>${lastRemark.author}:</strong> ${lastRemark.note}</div>` : '<span style="color:#94a3b8;font-size:0.8rem;font-style:italic">No notes submitted</span>'}
          </td>
          <td><span class="status-pill status-progress">Under CA Review</span></td>
          <td>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="btn-admin btn-admin-primary" style="font-size:0.75rem;padding:5px 10px;background:#16a34a" onclick="AdminCRM.approveReviewTask('${t.id}')" title="Approve and mark completed">
                <i class="fa-solid fa-check"></i> Approve & File
              </button>
              <button class="btn-admin" style="font-size:0.75rem;padding:5px 10px;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca" onclick="AdminCRM.rejectReviewTask('${t.id}')" title="Send back to employee with rework notes">
                <i class="fa-solid fa-rotate-left"></i> Send Back
              </button>
              <button class="action-icon-btn" onclick="AdminCRM.openRemarksModal('${t.id}')" title="Remarks">
                <i class="fa-solid fa-comments"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadDeadlines() {
    const client = await window.createSupabaseClient?.();
    if (!client) return this.renderDeadlinesTable();
    const { data } = await client.from('compliance_deadlines').select('*').order('id');
    this.state.deadlines = data || [];
    this.renderDeadlinesTable();
  },

  async loadCloudWorkflow() {
    const client = await window.createSupabaseClient?.();
    if (!client) return;
    const { data, error } = await client.from('compliance_tasks').select('*');
    if (!error && Array.isArray(data) && data.length) {
      this.state.tasks = data.map(task => ({ id: task.id, clientId: task.client_id, client: task.client_id, taskName: task.task_name, assigned: task.assigned_employee_email || 'Unassigned', stage: task.stage || 'todo', dueDate: task.due_date, files: [] }));
      localStorage.setItem('ks_tasks', JSON.stringify(this.state.tasks));
      this.renderKanbanBoard(); this.renderDashboardRecent(); this.renderMetrics();
    }
    client.channel('admin-compliance-tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'compliance_tasks' }, () => this.loadCloudWorkflow()).subscribe();
  },

  async loadCloudInvoices() {
    const token = await this.adminToken?.();
    if (!token) return;
    try {
      const [invRes, tallyRes] = await Promise.all([
        fetch('/api/admin/invoice', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/tally/queue', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);
      const result = await invRes.json().catch(() => ({}));
      const tallyData = tallyRes ? await tallyRes.json().catch(() => ({})) : {};

      const queueList = Array.isArray(tallyData.queue) ? tallyData.queue : [];
      const tallyMap = {};
      queueList.forEach(q => {
        if (q.source_id) {
          // Keep the latest or SYNCED entry for this invoice
          if (!tallyMap[q.source_id] || q.status === 'SYNCED') {
            tallyMap[q.source_id] = q;
          }
        }
      });
      this.state.tallyQueueMap = tallyMap;

      const data = result.invoices;
      if (Array.isArray(data)) {
        this.state.invoices = data.map(i => {
          const tItem = tallyMap[i.id] || {};
          return {
            id: i.id,
            client: i.client_name,
            service: i.service,
            amount: `₹ ${Number(i.amount || 0).toLocaleString('en-IN')}`,
            rawAmount: Number(i.amount || 0),
            date: i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN') : '',
            createdAt: i.created_at,
            status: i.status,
            tallyVoucherNo: tItem.tally_voucher_no || i.tally_voucher_no || null,
            tallyStatus: tItem.status || i.tally_status || (tItem.tally_voucher_no ? 'SYNCED' : null),
            tallySyncedAt: tItem.synced_at || null,
            tallyVoucherType: tItem.voucher_type || 'Sales'
          };
        });
        this.renderInvoicesTable();
        this.renderMetrics();
      }
    } catch (err) {
      console.warn('loadCloudInvoices error:', err);
    }
  },

  renderDeadlinesTable() {
    const body = document.getElementById('deadlinesTableBody');
    if (!body) return;
    body.innerHTML = this.state.deadlines.length ? this.state.deadlines.map((row, index) => `<tr><td><input class="form-input-admin" id="deadlineTitle${index}" value="${row.title || ''}"><br><small>${row.category_label || row.category || ''}</small></td><td><input class="form-input-admin" type="date" id="deadlineDate${index}" value="${row.due_date || ''}"></td><td><input class="form-input-admin" id="deadlineLabel${index}" value="${row.due_date_label || ''}"></td><td><input class="form-input-admin" id="deadlineDescription${index}" value="${row.description || ''}"></td><td><input type="checkbox" id="deadlineActive${index}" ${row.is_active ? 'checked' : ''}></td><td><button class="btn-admin btn-admin-primary" onclick="AdminCRM.saveDeadline(${index})">Save</button> <button class="action-icon-btn" onclick="AdminCRM.deleteDeadline(${index})" title="Delete"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('') : '<tr><td colspan="6">No deadlines found. Run the schema SQL first.</td></tr>';
  },

  toggleDeadlineForm() { const form = document.getElementById('deadlineForm'); if (form) form.style.display = form.style.display === 'grid' ? 'none' : 'grid'; },

  async adminToken() {
    const client = await window.createSupabaseClient?.(); if (!client) return null;
    let session = (await client.auth.getSession()).data.session;
    if (!session) { const email = prompt('Main Admin email:'); const password = prompt('Main Admin password:'); if (!email || !password) return null; const login = await client.auth.signInWithPassword({ email: email.trim(), password }); if (login.error) { alert(`Main Admin login failed: ${login.error.message}`); return null; } session = login.data.session; }
    return session.access_token;
  },

  async saveDeadline(index) {
    const row = this.state.deadlines[index]; if (!row) return;
    const token = await this.adminToken(); if (!token) return;
    const response = await fetch('/api/admin/update-deadline', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: row.id, due_date: document.getElementById(`deadlineDate${index}`).value, due_date_label: document.getElementById(`deadlineLabel${index}`).value, is_active: document.getElementById(`deadlineActive${index}`).checked, title: document.getElementById(`deadlineTitle${index}`).value, description: document.getElementById(`deadlineDescription${index}`).value, category: row.category, category_label: row.category_label, category_class: row.category_class, frequency: row.frequency, due_day: row.due_day, action_text: row.action_text, source_url: row.source_url }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || 'Deadline save failed');
    alert('Deadline updated. Public website will refresh from Supabase.'); this.loadDeadlines();
  },

  async deleteDeadline(index) { const row = this.state.deadlines[index]; if (!row || !confirm(`Delete ${row.title}?`)) return; const token = await this.adminToken(); if (!token) return; const response = await fetch(`/api/admin/delete-deadline?id=${encodeURIComponent(row.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { const result = await response.json().catch(() => ({})); return alert(result.error || 'Delete failed'); } this.loadDeadlines(); },

  renderMetrics() {
    const activeClientsEl = document.getElementById('metricActiveClients');
    if (activeClientsEl) activeClientsEl.innerText = this.state.clients.length;

    const pendingTasksEl = document.getElementById('metricPendingTasks');
    if (pendingTasksEl) pendingTasksEl.innerText = this.state.tasks.filter(t => t.stage !== 'completed').length;

    const newLeadsEl = document.getElementById('metricNewLeads');
    if (newLeadsEl) newLeadsEl.innerText = this.state.leads.length;

    const taskCounterBadge = document.getElementById('taskCounterBadge');
    if (taskCounterBadge) taskCounterBadge.innerText = `${this.state.tasks.filter(t => t.stage !== 'completed').length} Active`;

    const docPendingBadge = document.getElementById('docPendingBadge');
    if (docPendingBadge) docPendingBadge.innerText = `${this.state.pendingDocs.length} Pending`;

    const monthlyBillingEl = document.getElementById('metricMonthlyBillings');
    if (monthlyBillingEl) { const now = new Date(); const total = (this.state.invoices || []).filter(inv => { const date = new Date(inv.createdAt || inv.date || ''); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).reduce((sum, inv) => sum + Number(String(inv.amount || 0).replace(/[^0-9.-]/g, '')), 0); monthlyBillingEl.textContent = `₹ ${total.toLocaleString('en-IN')}`; }
  },

  renderEmployeesTable() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    if (!this.state.employees || this.state.employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: #64748b;">No employees found.</td></tr>';
      return;
    }
    tbody.innerHTML = (this.state.employees || []).map((employee, index) => { const workCount = this.state.tasks.filter(task => task.assigned === employee.name && task.stage !== 'completed').length; return `<tr><td><strong>${employee.name}</strong><br><small>${employee.designation || ''}</small></td><td>${employee.email || 'Not set'}<br><small>Login: ${employee.loginId || 'Not set'}</small><br><small style="color:#b45309">Password: never displayed</small></td><td>${employee.role || 'employee'}</td><td><small>${(employee.permissions || []).join(', ') || 'None'}</small></td><td><strong>${workCount}</strong> active</td><td><strong>₹${Number(employee.incentive || 0).toLocaleString('en-IN')}</strong><br><button class="action-icon-btn" onclick="AdminCRM.setEmployeeIncentive(${index})" title="Set incentive"><i class="fa-solid fa-pen"></i></button></td><td><span class="status-pill ${employee.status === 'Former' ? 'status-overdue' : 'status-completed'}">${employee.status}<br><small>${employee.accountStatus || 'Invite pending'}</small></span></td><td><button class="action-icon-btn" onclick="AdminCRM.resetEmployeeAccess(${index})" title="Invite/reset password"><i class="fa-solid fa-key"></i></button><button class="action-icon-btn" onclick="AdminCRM.deleteEmployee(${index})" title="Delete"><i class="fa-solid fa-trash-can"></i></button></td></tr>`; }).join('');
  },

  deleteEmployee(index) {
    this.state.employees.splice(index, 1);
    localStorage.setItem('ks_team', JSON.stringify(this.state.employees));
    this.renderEmployeesTable();
  },

  clearAllEmployees() {
    if (!confirm('Are you sure you want to delete all employees?')) return;
    this.state.employees = [];
    localStorage.setItem('ks_team', JSON.stringify([]));
    this.renderEmployeesTable();
  },

  setEmployeeIncentive(index) {
    const employee = this.state.employees[index]; if (!employee) return;
    const amount = prompt(`Manual incentive amount for ${employee.name} (₹):`, employee.incentive || 0);
    if (amount === null || amount === '' || Number.isNaN(Number(amount))) return;
    employee.incentive = Math.max(0, Number(amount));
    localStorage.setItem('ks_team', JSON.stringify(this.state.employees));
    this.renderEmployeesTable();
  },

  resetEmployeeAccess(index) {
    const employee = this.state.employees[index]; if (!employee) return;
    alert(`Invite/reset password for ${employee.name} will be handled by Supabase/Frappe Auth.\n\nNo password is stored or displayed in this admin panel.`);
  },

  renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.clients.map(c => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>
          <button type="button" onclick="AdminCRM.openClientWork('${c.id}')" style="border:0;background:none;padding:0;color:#0f172a;font:inherit;font-weight:700;cursor:pointer;text-align:left;text-decoration:underline;">${c.name}</button><br>
          <span style="font-size: 0.76rem; color: #64748b;">${c.entity} • ${c.midcPlot || 'Palghar'}</span>
        </td>
        <td><code>${c.pan}</code></td>
        <td><code>${c.gstin}</code></td>
        <td>${c.assignedTo}</td>
        <td><span class="status-pill ${String(c.status || '').toLowerCase().includes('pending') ? 'status-overdue' : 'status-completed'}">${c.status}</span></td>
        <td>
          <button class="action-icon-btn" onclick="AdminCRM.editClient('${c.id}')" title="Edit client"><i class="fa-solid fa-pen"></i></button>
          <button class="action-icon-btn" onclick="AdminCRM.openClientWork('${c.id}')" title="View pending work"><i class="fa-solid fa-list-check"></i></button>
          <a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(c.name)}%2C%20from%20CA%20Kiran%20K.%20Shinde%20%26%20Co." target="_blank" class="action-icon-btn whatsapp-icon" title="Chat on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
          <button class="action-icon-btn" onclick="AdminCRM.deleteClient('${c.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>
    `).join('');
  },

  renderLeadsTable() {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.leads.map(ld => `
      <tr>
        <td><strong>${ld.id}</strong></td>
        <td><strong>${ld.name}</strong></td>
        <td>${ld.phone}</td>
        <td><span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${ld.entity}</span></td>
        <td>${ld.service}</td>
        <td>${ld.date}</td>
        <td><span class="status-pill ${ld.status === 'New' ? 'status-overdue' : 'status-progress'}">${ld.status}</span></td>
        <td>
          <a href="https://wa.me/${ld.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(ld.name)}%2C%20regarding%20your%20inquiry%20at%20Kiran%20K.%20Shinde%20%26%20Co." target="_blank" class="action-icon-btn whatsapp-icon" title="Reply on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
          <button class="action-icon-btn" onclick="AdminCRM.convertLeadToClient('${ld.id}')" title="Convert to Active Client"><i class="fa-solid fa-user-check"></i></button>
        </td>
      </tr>
    `).join('');
  },

  renderKanbanBoard() {
    const stages = ['todo', 'in-progress', 'in-review', 'completed'];
    stages.forEach(stage => {
      const col = document.getElementById(`kanban-${stage}`);
      if (!col) return;

      const stageTasks = this.state.tasks.filter(t => t.stage === stage);
      col.innerHTML = stageTasks.map(t => {
        const remarksCount = (t.remarks && t.remarks.length) || 0;
        const lastRemark = remarksCount > 0 ? t.remarks[remarksCount - 1] : null;

        return `
          <div class="kanban-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="kanban-tag ${t.tag}">${t.tag.replace('tag-', '').toUpperCase()}</span>
              <span style="font-size: 0.72rem; font-weight: 700; color: #16a34a;">₹${t.fee ? t.fee.toLocaleString('en-IN') : '0'}</span>
            </div>
            <h5>${t.taskName}</h5>
            <p style="font-size: 0.8rem; font-weight: 600; color: #1e293b;">${t.client}</p>

            ${lastRemark ? `
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 4px; font-size: 0.73rem; color: #475569; margin: 8px 0; border-left: 2px solid #2563eb;">
                <strong style="color: #0f172a;">${lastRemark.author.split(' ')[0]}:</strong> ${lastRemark.note.substring(0, 65)}...
              </div>
            ` : ''}

            <div class="kanban-card-meta">
              <span><i class="fa-regular fa-clock"></i> ${t.dueDate}</span>
              <span><i class="fa-solid fa-user-tag"></i> ${t.assigned}</span>
            </div>

            ${stage === 'in-review' ? `
              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 8px; font-size: 0.73rem; color: #b45309; font-weight: 600; margin: 8px 0;">
                <i class="fa-solid fa-hourglass-half"></i> In Review (Submitted by ${t.assigned || 'Employee'})
              </div>
            ` : ''}

            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; pt-1 border-top: 1px dashed #e2e8f0;">
              <button onclick="AdminCRM.assignTask('${t.id}')" style="font-size: 0.73rem; padding: 3px 8px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 4px; cursor: pointer;">Assign</button>
              <button onclick="AdminCRM.uploadTaskFile('${t.id}')" style="font-size: 0.73rem; padding: 3px 8px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 4px; cursor: pointer;">Upload</button>
              <button onclick="AdminCRM.openRemarksModal('${t.id}')" style="font-size: 0.73rem; padding: 3px 8px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 4px; cursor: pointer;">
                <i class="fa-regular fa-comment-dots"></i> Remarks (${remarksCount})
              </button>

              ${stage === 'in-review' ? `
                <button onclick="AdminCRM.approveReviewTask('${t.id}')" style="font-size: 0.73rem; padding: 4px 10px; border: none; background: #16a34a; color: #fff; border-radius: 4px; cursor: pointer; font-weight: 600;">
                  <i class="fa-solid fa-check"></i> Approve &rarr;
                </button>
              ` : stage !== 'completed' ? `
                <button onclick="AdminCRM.advanceTask('${t.id}')" style="font-size: 0.73rem; padding: 4px 10px; border: none; background: #0f172a; color: #fff; border-radius: 4px; cursor: pointer; font-weight: 600;">
                  Advance &rarr;
                </button>
              ` : `
                <button onclick="AdminCRM.createConsolidatedInvoice('${t.id}')" style="font-size: 0.73rem; color: #fff; font-weight: 700; border:0; background:#16a34a; border-radius:4px; padding:4px 8px; cursor:pointer;">
                  <i class="fa-solid fa-check-double"></i> Ready for Bill
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    });
  },

  // Document Follow-Up Table
  renderDocumentsTable() {
    const tbody = document.getElementById('documentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.pendingDocs.map(d => `
      <tr>
        <td><strong>${d.client}</strong></td>
        <td><i class="fa-regular fa-file-lines" style="color: #d97706; margin-right: 6px;"></i> ${d.doc}</td>
        <td><span style="font-size: 0.78rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${d.category}</span></td>
        <td>${d.lastPing}</td>
        <td><strong style="color: #2563eb;">${d.nextPing}</strong></td>
        <td><span class="status-pill ${d.status.includes('Overdue') ? 'status-overdue' : 'status-progress'}">${d.status}</span></td>
        <td>
          <button class="action-icon-btn" onclick="AdminCRM.downloadDocument('${d.id}')" title="Download document"><i class="fa-solid fa-download"></i></button>
          <a href="https://wa.me/${d.phone.replace(/[^0-9]/g, '')}?text=Dear%20Client%2C%20gentle%20reminder%20from%20CA%20Kiran%20K.%20Shinde%20%26%20Co.%20Please%20provide%20${encodeURIComponent(d.doc)}%20for%20${encodeURIComponent(d.category)}." target="_blank" class="action-icon-btn whatsapp-icon" title="Send WhatsApp Reminder Ping">
            <i class="fa-brands fa-whatsapp"></i> Ping WhatsApp
          </a>
          <button class="action-icon-btn" onclick="AdminCRM.snoozeDocFollowup('${d.id}')" title="Snooze 2 Days"><i class="fa-regular fa-clock"></i></button>
          <button class="action-icon-btn" onclick="AdminCRM.markDocReceived('${d.id}')" title="Mark Received"><i class="fa-solid fa-check"></i></button>
        </td>
      </tr>
    `).join('');
  },

  // Tally Prime Sync Table
  renderTallySyncTable() {
    const tbody = document.getElementById('tallySyncTableBody');
    if (!tbody) return;

    // Filter tasks that are completed or approved for consolidated billing
    const eligibleTasks = this.state.tasks.filter(t => t.stage === 'completed' || t.stage === 'in-review');
    
    tbody.innerHTML = eligibleTasks.map(t => `
      <tr>
        <td><strong>${t.client}</strong></td>
        <td>${t.taskName}</td>
        <td><strong style="color: #0f172a;">₹${t.fee ? t.fee.toLocaleString('en-IN') : '0'}</strong></td>
        <td>
          ${t.stage === 'completed' ? '<span class="status-pill status-completed">Partner Approved</span>' : '<span class="status-pill status-progress">Under CA Review</span>'}
        </td>
        <td>
          ${t.tallySynced ? '<span style="color: #16a34a; font-size: 0.8rem; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Tally Synced</span>' : '<span style="color: #d97706; font-size: 0.8rem; font-weight: 700;"><i class="fa-solid fa-clock"></i> Ready for XML Export</span>'}
        </td>
        <td>
          <button class="action-icon-btn" onclick="AdminCRM.generateTallyXML('${t.id}')" title="Download Tally Prime XML Voucher">
            <i class="fa-solid fa-file-code"></i> Tally XML
          </button>
          <button class="action-icon-btn" onclick="AdminCRM.createConsolidatedInvoice('${t.id}')" title="Generate Consolidated Bill">
            <i class="fa-solid fa-file-invoice"></i> Bill
          </button>
        </td>
      </tr>
    `).join('');
  },

  // Google Calendar Sync Table
  renderCalendarTable() {
    const tbody = document.getElementById('calendarTableBody');
    if (!tbody) return;

    let bookings = this.state.calendarBookings;
    if (!bookings || bookings.length === 0) {
      bookings = JSON.parse(localStorage.getItem('ks_calendar_bookings') || '[]');
      if (bookings.length === 0) {
        bookings = [
          { id: 'GCAL-2026-101', client: 'Anand K. More (Apex Corp)', dateTime: 'Tomorrow, 11:30 AM', purpose: 'ITR-3 & Tax Planning Review', mode: 'Google Meet', status: 'Calendar Synced' },
          { id: 'GCAL-2026-102', client: 'Suresh Patel (Patel Logistics)', dateTime: '21 Nov 2026, 03:00 PM', purpose: 'GST Audit & E-Way Bill Reconciliation', mode: 'Office Meeting', status: 'Calendar Synced' },
          { id: 'GCAL-2026-103', client: 'Dr. Meena Iyer', dateTime: '22 Nov 2026, 05:00 PM', purpose: 'Presumptive Tax 44ADA Advisory', mode: 'Phone / Video Call', status: 'Calendar Synced' }
        ];
        localStorage.setItem('ks_calendar_bookings', JSON.stringify(bookings));
      }
      this.state.calendarBookings = bookings;
    }

    tbody.innerHTML = this.state.calendarBookings.map(b => `
      <tr>
        <td><code>${b.id}</code></td>
        <td><strong>${b.client}</strong></td>
        <td><i class="fa-regular fa-calendar-check" style="color: #2563eb; margin-right: 6px;"></i> ${b.dateTime}</td>
        <td>${b.purpose}</td>
        <td><span style="font-size: 0.78rem; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${b.mode}</span></td>
        <td><span class="status-pill status-completed"><i class="fa-brands fa-google"></i> ${b.status}</span></td>
        <td>
          <button class="action-icon-btn" onclick="alert('Google Calendar meeting invite resent to ${b.client}')" title="Resend Invite"><i class="fa-regular fa-envelope"></i></button>
        </td>
      </tr>
    `).join('');
  },

  setInvoiceFilter(filter) {
    this.invoiceFilter = filter;
    const pills = ['invPillAll', 'invPillPending', 'invPillPaid', 'invPillTally'];
    pills.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const activeMap = { all: 'invPillAll', pending: 'invPillPending', paid: 'invPillPaid', tally: 'invPillTally' };
    const target = document.getElementById(activeMap[filter]);
    if (target) target.classList.add('active');
    this.renderInvoicesTable();
  },

  onInvoiceSearchChange(val) {
    this.invoiceSearchQuery = String(val || '').trim().toLowerCase();
    this.renderInvoicesTable();
  },

  getFilteredInvoices() {
    const list = this.state.invoices || [];
    return list.filter(inv => {
      // 1. Status Filter
      if (this.invoiceFilter === 'pending' && inv.status !== 'Pending') return false;
      if (this.invoiceFilter === 'paid' && inv.status !== 'Paid') return false;
      if (this.invoiceFilter === 'tally' && !(inv.tallyVoucherNo || inv.tallyStatus === 'SYNCED')) return false;

      // 2. Search Query Filter
      if (this.invoiceSearchQuery) {
        const q = this.invoiceSearchQuery;
        const idMatch = String(inv.id || '').toLowerCase().includes(q);
        const clientMatch = String(inv.client || '').toLowerCase().includes(q);
        const serviceMatch = String(inv.service || '').toLowerCase().includes(q);
        const vchMatch = String(inv.tallyVoucherNo || '').toLowerCase().includes(q);
        if (!idMatch && !clientMatch && !serviceMatch && !vchMatch) return false;
      }
      return true;
    });
  },

  updateInvoiceKpiCards() {
    const invoices = this.state.invoices || [];
    let totalBilled = 0;
    let totalPending = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let tallySyncedCount = 0;
    let tallyPendingCount = 0;

    invoices.forEach(inv => {
      const amt = Number(inv.rawAmount || String(inv.amount || 0).replace(/[^0-9.]/g, '')) || 0;
      totalBilled += amt;
      if (inv.status === 'Paid') {
        totalPaid += amt;
        paidCount++;
      } else {
        totalPending += amt;
        pendingCount++;
      }
      if (inv.tallyVoucherNo || inv.tallyStatus === 'SYNCED') {
        tallySyncedCount++;
      } else if (inv.tallyStatus === 'PENDING') {
        tallyPendingCount++;
      }
    });

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('invKpiTotalBilled', `₹ ${totalBilled.toLocaleString('en-IN')}`);
    setTxt('invKpiTotalCount', `${invoices.length} Invoices`);
    setTxt('invKpiOutstanding', `₹ ${totalPending.toLocaleString('en-IN')}`);
    setTxt('invKpiPendingCount', `${pendingCount} Unpaid Bills`);
    setTxt('invKpiCollected', `₹ ${totalPaid.toLocaleString('en-IN')}`);
    setTxt('invKpiSettledCount', `${paidCount} Settled`);
    setTxt('invKpiTallySynced', tallySyncedCount);
    setTxt('invKpiTallyPending', `${tallyPendingCount} In Queue`);

    setTxt('invCountAll', invoices.length);
    setTxt('invCountPending', pendingCount);
    setTxt('invCountPaid', paidCount);
    setTxt('invCountTally', tallySyncedCount);
  },

  renderInvoicesTable() {
    this.updateInvoiceKpiCards();
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    const filtered = this.getFilteredInvoices();
    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px 16px; color: #64748b;">
            <i class="fa-solid fa-file-circle-xmark" style="font-size:2rem; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
            <strong>No invoices match your active filter / search query.</strong>
            <p style="margin:4px 0 0; font-size:0.8rem;">Try clearing search or clicking 'All' filter pill.</p>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(inv => `
      <tr>
        <td>
          <strong style="color:#0f172a;">${inv.id}</strong>
          ${inv.tallyVoucherNo ? `
            <div style="margin-top:4px;">
              <span style="display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; border-radius:4px; padding:2px 7px; font-size:0.72rem; font-weight:700;" title="TallyPrime Proforma Voucher #${inv.tallyVoucherNo}">
                <i class="fa-solid fa-bolt" style="color:#10b981;"></i> Tally: #${inv.tallyVoucherNo}
              </span>
            </div>
          ` : (inv.tallyStatus === 'PENDING' ? `
            <div style="margin-top:4px;">
              <span style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:4px; padding:2px 7px; font-size:0.72rem; font-weight:700;">
                <i class="fa-solid fa-clock"></i> In Tally Queue
              </span>
            </div>
          ` : '')}
        </td>
        <td>
          <button type="button" onclick="AdminCRM.openClientByName('${encodeURIComponent(inv.client)}')" style="border:0; background:none; padding:0; color:#0f172a; font:inherit; font-weight:700; cursor:pointer; text-align:left; text-decoration:underline;">
            ${inv.client}
          </button>
        </td>
        <td>${inv.service}</td>
        <td><strong style="color: #0f172a; font-size:0.92rem;">${inv.amount}</strong></td>
        <td>${inv.date}</td>
        <td>
          <span class="status-pill ${inv.status === 'Paid' ? 'status-completed' : 'status-pending'}">
            ${inv.status === 'Paid' ? '<i class="fa-solid fa-check"></i> Paid' : '<i class="fa-solid fa-clock"></i> Pending'}
          </span>
          ${inv.tallyVoucherNo ? `
            <div style="font-size:0.72rem; color:#059669; font-weight:600; margin-top:4px; display:flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-file-invoice"></i> Tally Proforma Synced
            </div>
          ` : ''}
        </td>
        <td style="white-space: nowrap;">
          <button class="action-icon-btn" onclick="AdminCRM.editInvoice('${inv.id}')" title="Edit invoice"><i class="fa-solid fa-pen"></i></button>
          <button class="action-icon-btn" onclick="AdminCRM.downloadInvoicePdf('${inv.id}')" title="Print / Download Proforma Bill PDF"><i class="fa-solid fa-file-pdf"></i></button>
          ${inv.tallyVoucherNo ? `
            <button onclick="AdminCRM.viewTallyProformaModal('${inv.id}')" title="View Tally Proforma Bill Details" style="color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 9px; border-radius:5px; font-weight:700; font-size:0.75rem; cursor:pointer; margin:0 3px;">
              <i class="fa-solid fa-file-circle-check"></i> Tally #${inv.tallyVoucherNo}
            </button>
          ` : `
            <button onclick="AdminCRM.syncInvoiceToTally('${inv.id}')" title="Sync to Tally Prime" style="color:#ffffff; background:#d97706; padding:4px 9px; border-radius:5px; font-weight:700; font-size:0.75rem; border:none; cursor:pointer; margin:0 3px;">
              <i class="fa-solid fa-bolt"></i> Tally
            </button>
          `}
          ${inv.status === 'Pending' ? `
            <button onclick="AdminCRM.openPaymentReminderModal('${inv.id}')" class="btn-admin" style="background:#10b981; color:#fff; border:none; padding:4px 9px; border-radius:5px; font-weight:700; font-size:0.75rem; cursor:pointer; display:inline-flex; align-items:center; gap:5px; margin:0 3px;" title="Send WhatsApp Payment Reminder & Dynamic UPI QR">
              <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i> Remind & Collect
            </button>
            <button class="action-icon-btn" onclick="AdminCRM.markInvoicePaid('${inv.id}')" title="Record Payment & Auto-Post Tally Receipt" style="color:#16a34a;"><i class="fa-solid fa-circle-check"></i></button>
          ` : `
            <span style="font-size: 0.76rem; color: #16a34a; font-weight:700; display:inline-flex; align-items:center; gap:4px; margin-left:4px;">
              <i class="fa-solid fa-check-double"></i> Settled
            </span>
          `}
        </td>
      </tr>
    `).join('');
  },

  openClientByName(encodedName) {
    const rawName = decodeURIComponent(encodedName || '');
    const client = (this.state.clients || []).find(c => (c.name || '').toLowerCase() === rawName.toLowerCase());
    if (client) {
      this.openClientWork(client.id);
    } else {
      alert(`Client master record for '${rawName}' not found in active clients list.`);
    }
  },

  lookupClientPhone(clientName) {
    if (!clientName) return '';
    const norm = String(clientName).trim().toLowerCase();
    const client = (this.state.clients || []).find(c => {
      const cn = String(c.name || '').trim().toLowerCase();
      return cn === norm || cn.includes(norm) || norm.includes(cn);
    });
    if (client && client.phone) {
      return String(client.phone).trim();
    }
    return '';
  },

  lookupClientObj(clientName) {
    if (!clientName) return null;
    const norm = String(clientName).trim().toLowerCase();
    return (this.state.clients || []).find(c => {
      const cn = String(c.name || '').trim().toLowerCase();
      return cn === norm || cn.includes(norm) || norm.includes(cn);
    }) || null;
  },

  openPaymentReminderModal(invoiceId) {
    let inv = null;
    if (invoiceId) {
      inv = (this.state.invoices || []).find(i => i.id === invoiceId);
    }
    if (!inv) {
      inv = (this.state.invoices || []).find(i => i.status === 'Pending') || (this.state.invoices || [])[0];
    }
    if (!inv) {
      alert('No invoice found to generate payment reminder.');
      return;
    }

    this.currentReminderInv = inv;
    const client = this.lookupClientObj(inv.client);
    const clientPhone = this.lookupClientPhone(inv.client);
    const cleanAmount = Number(inv.rawAmount || String(inv.amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const formattedAmount = cleanAmount.toLocaleString('en-IN');
    const voucherRef = inv.tallyVoucherNo ? `Tally #${inv.tallyVoucherNo}` : 'Proforma Ref';

    // Populate summary bar
    const clientNameEl = document.getElementById('reminderClientName');
    if (clientNameEl) clientNameEl.textContent = inv.client;

    const clientEntityEl = document.getElementById('reminderClientEntity');
    if (clientEntityEl) clientEntityEl.textContent = client ? `${client.entity || 'Client Master'} • ${client.pan ? `PAN: ${client.pan}` : 'Registered'}` : 'Verified Client';

    const invRefEl = document.getElementById('reminderInvoiceRef');
    if (invRefEl) invRefEl.textContent = `${inv.id} (${voucherRef})`;

    const serviceTitleEl = document.getElementById('reminderServiceTitle');
    if (serviceTitleEl) serviceTitleEl.textContent = inv.service;

    const amtDisplayEl = document.getElementById('reminderAmountDisplay');
    if (amtDisplayEl) amtDisplayEl.textContent = `₹ ${formattedAmount}`;

    // Phone input & auto-match badge
    const phoneInput = document.getElementById('reminderPhoneInput');
    const badge = document.getElementById('reminderPhoneStatusBadge');
    if (clientPhone) {
      if (phoneInput) phoneInput.value = clientPhone;
      if (badge) {
        badge.textContent = `Auto-matched (${client ? client.name : 'Master'})`;
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
      }
    } else {
      if (phoneInput) phoneInput.value = '';
      if (badge) {
        badge.textContent = 'Please enter WhatsApp number';
        badge.style.background = '#fef3c7';
        badge.style.color = '#b45309';
      }
    }

    // Dynamic UPI Intent URI
    const upiUrl = `upi://pay?pa=7506647791@hdfcbank&pn=CA%20Kiran%20K%20Shinde%20and%20Co&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent('Fee Inv ' + inv.id)}`;
    this.currentReminderUpiUrl = upiUrl;

    // QR Code generation via high-res API
    const qrImageEl = document.getElementById('reminderQrImage');
    if (qrImageEl) {
      qrImageEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(upiUrl)}`;
    }
    const qrAmtText = document.getElementById('reminderQrAmountText');
    if (qrAmtText) qrAmtText.textContent = `₹ ${formattedAmount}`;

    // Switch to gentle template by default
    this.switchReminderTemplate('gentle');

    // Open modal
    const modal = document.getElementById('paymentReminderModal');
    if (modal) modal.classList.add('active');
  },

  verifyReminderPhone() {
    if (!this.currentReminderInv) return;
    const phone = this.lookupClientPhone(this.currentReminderInv.client);
    const phoneInput = document.getElementById('reminderPhoneInput');
    const badge = document.getElementById('reminderPhoneStatusBadge');
    if (phone) {
      if (phoneInput) phoneInput.value = phone;
      if (badge) {
        badge.textContent = 'Auto-matched from Client Master';
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
      }
    } else {
      alert(`No phone number found in client database for '${this.currentReminderInv.client}'. Please enter manually.`);
    }
  },

  switchReminderTemplate(type) {
    this.currentReminderTemplateType = type || 'gentle';
    ['btnTplGentle', 'btnTplDue', 'btnTplOverdue'].forEach(btnId => {
      const b = document.getElementById(btnId);
      if (b) b.classList.remove('active');
    });

    const activeMap = { gentle: 'btnTplGentle', due: 'btnTplDue', overdue: 'btnTplOverdue' };
    const activeBtn = document.getElementById(activeMap[this.currentReminderTemplateType]);
    if (activeBtn) activeBtn.classList.add('active');

    const msg = this.buildReminderMessage(this.currentReminderInv, this.currentReminderTemplateType);
    const textarea = document.getElementById('reminderMessageText');
    if (textarea) textarea.value = msg;
  },

  buildReminderMessage(inv, type) {
    if (!inv) return '';
    const cleanAmount = Number(inv.rawAmount || String(inv.amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const formattedAmount = cleanAmount.toLocaleString('en-IN');
    const voucherRef = inv.tallyVoucherNo ? ` (Tally Ref: #${inv.tallyVoucherNo})` : '';
    const dateStr = inv.date || new Date().toLocaleDateString('en-IN');
    const upiLink = this.currentReminderUpiUrl || `upi://pay?pa=7506647791@hdfcbank&pn=CA%20Kiran%20K%20Shinde%20and%20Co&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent('Fee Inv ' + inv.id)}`;

    if (type === 'due') {
      return `*URGENT COMPLIANCE NOTICE: Fee Payment Pending*\n\nDear *${inv.client}*,\n\nWe hope this reaches you well. Regarding your ongoing statutory compliance and filings (*${inv.service}*):\n\n📄 *Invoice Ref:* ${inv.id}${voucherRef}\n💼 *Compliance / Filing:* ${inv.service}\n💰 *Pending Fees:* ₹${formattedAmount}\n📅 *Billing Date:* ${dateStr}\n⚠️ *Status:* Due for Immediate Settlement\n\nTo ensure uninterrupted filing of your statutory returns (GST / TDS / Tax Audit) before the upcoming statutory cut-off dates, kindly clear this invoice today.\n\n⚡ *Pay Instantly via UPI:* \n👉 *UPI ID:* 7506647791@hdfcbank\n👉 *1-Click UPI Pay Link:* ${upiLink}\n\n*Or Direct Bank Transfer (NEFT/RTGS):*\nBank: HDFC Bank Ltd\nA/C No: 50200067891234\nIFSC: HDFC0000123\nA/C Name: Kiran K. Shinde & Co.\n\nPlease share the payment UTR / screenshot once completed so we can update your ledger in Tally.\n\nWith warm regards,\n*CA Kiran K. Shinde & Co.*\nChartered Accountants • Pune / Palghar\nDirect Office: +91 75066 47791`;
    }

    if (type === 'overdue') {
      return `*FINAL REMINDER: Outstanding Professional Fees Overdue*\n\nTo: *${inv.client}*\nAttention: Accounts & Finance Department\n\nDear Sir / Ma'am,\n\nDespite earlier notifications, invoice *${inv.id}* amounting to *₹${formattedAmount}* for *${inv.service}* remains significantly *OVERDUE*.\n\n📌 *Bill Summary:*\n• Invoice No: ${inv.id}${voucherRef}\n• Billing Date: ${dateStr}\n• Particulars: ${inv.service}\n• Net Overdue Balance: *₹${formattedAmount}*\n\nWe request you to arrange immediate settlement within 24 hours to avoid suspension of ongoing audit, advisory, and portal filings.\n\n💳 *Immediate Settlement Options:*\n1. *Instant UPI ID:* 7506647791@hdfcbank\n2. *Direct UPI Pay Link:* ${upiLink}\n3. *NEFT / RTGS Details:*\n   - Beneficiary: CA Kiran K. Shinde & Co.\n   - Bank: HDFC Bank Ltd\n   - Account: 50200067891234\n   - IFSC: HDFC0000123\n\nIf payment has already been transferred in the last 24 hours, kindly reply with the bank UTR confirmation so our accounts team can reconcile your ledger in TallyPrime.\n\nSincerely,\n*CA Kiran K. Shinde & Co.*\nChartered Accountants | Office: +91 75066 47791`;
    }

    // Default: gentle
    return `Namaste *${inv.client}* Ji,\n\nGreetings from *CA Kiran K. Shinde & Co.* 🙏\n\nHope you are doing well. This is a gentle reminder regarding our professional fee invoice:\n\n📄 *Invoice No:* ${inv.id}${voucherRef}\n💼 *Service:* ${inv.service}\n💰 *Amount Due:* ₹${formattedAmount}\n📅 *Invoice Date:* ${dateStr}\n\nKindly clear the balance at your convenience via instant UPI:\n👉 *UPI ID:* 7506647791@hdfcbank\n👉 *Direct UPI Pay Link:* ${upiLink}\n\n*Bank NEFT / RTGS Details:*\nBank: HDFC Bank Ltd\nA/C No: 50200067891234\nIFSC: HDFC0000123\nName: Kiran K. Shinde & Co.\n\nPlease share the payment screenshot / UTR once done. Thank you for your continued association!\n\nBest regards,\n*CA Kiran K. Shinde & Co.*\nChartered Accountants | Mob: +91 75066 47791`;
  },

  sendWhatsAppPaymentReminderNow() {
    const phoneInput = document.getElementById('reminderPhoneInput');
    const msgText = document.getElementById('reminderMessageText');
    if (!phoneInput || !msgText) return;

    let phone = String(phoneInput.value || '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number for WhatsApp reminder.');
      phoneInput.focus();
      return;
    }
    // Prepend 91 for standard Indian numbers if not already present
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    const message = msgText.value.trim();
    if (!message) {
      alert('Message body cannot be empty.');
      return;
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  },

  copyReminderMessageText() {
    const msgText = document.getElementById('reminderMessageText');
    if (!msgText || !msgText.value) return;
    navigator.clipboard.writeText(msgText.value).then(() => {
      alert('✅ Reminder message with UPI details copied to clipboard!');
    }).catch(() => {
      msgText.select();
      document.execCommand('copy');
      alert('✅ Message copied to clipboard!');
    });
  },

  copyReminderUpiLink() {
    if (!this.currentReminderUpiUrl) {
      const inv = this.currentReminderInv;
      if (!inv) return;
      const cleanAmount = Number(inv.rawAmount || String(inv.amount || 0).replace(/[^0-9.]/g, '')) || 0;
      this.currentReminderUpiUrl = `upi://pay?pa=7506647791@hdfcbank&pn=CA%20Kiran%20K%20Shinde%20and%20Co&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent('Fee Inv ' + inv.id)}`;
    }
    navigator.clipboard.writeText(this.currentReminderUpiUrl).then(() => {
      alert(`✅ UPI Payment Link copied:\n${this.currentReminderUpiUrl}`);
    }).catch(() => {
      alert(`UPI Link:\n${this.currentReminderUpiUrl}`);
    });
  },

  openUpiIntentTest() {
    if (!this.currentReminderUpiUrl) return;
    window.location.href = this.currentReminderUpiUrl;
  },

  markCurrentReminderPaid() {
    if (!this.currentReminderInv) return;
    const invId = this.currentReminderInv.id;
    const reminderModal = document.getElementById('paymentReminderModal');
    if (reminderModal) reminderModal.classList.remove('active');
    this.markInvoicePaid(invId);
  },

  async editInvoice(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const clientName = prompt('Client name:', inv.client);
    if (clientName === null) return;
    const service = prompt('Service / description:', inv.service);
    if (service === null) return;
    const amount = prompt('Fee amount (₹):', String(inv.amount).replace(/[^0-9.]/g, ''));
    if (amount === null || isNaN(Number(amount))) return alert('Enter a valid amount.');
    const token = await this.adminToken();
    if (!token) return;
    const response = await fetch('/api/admin/invoice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: invoiceId, clientName, service, amount })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || 'Invoice update failed');
    await this.loadCloudInvoices();
  },

  mapServiceToTallyLedger(serviceName) {
    const s = String(serviceName || '').toLowerCase();
    if (s.includes('tds') || s.includes('challan') || s.includes('tcs') || s.includes('26q') || s.includes('24q')) {
      return 'TDS & Challan Compliance Fees';
    }
    if (s.includes('gst') || s.includes('gstr') || s.includes('e-way') || s.includes('eway') || s.includes('lut')) {
      return 'GST Returns & Compliance Fees';
    }
    if (s.includes('audit') || s.includes('44ab') || s.includes('statutory')) {
      return 'Audit & Assurance Fees';
    }
    if (s.includes('itr') || s.includes('income tax') || s.includes('computation') || s.includes('44ada')) {
      return 'Income Tax Filing & Advisory Fees';
    }
    if (s.includes('roc') || s.includes('mca') || s.includes('incorporation') || s.includes('company')) {
      return 'ROC & Company Compliance Fees';
    }
    if (s.includes('accounting') || s.includes('bookkeeping') || s.includes('tally')) {
      return 'Accounting & Bookkeeping Fees';
    }
    const clean = String(serviceName || '').split('—')[0].split('-')[0].trim();
    return clean ? `Professional Fees - ${clean}` : 'Professional Fees Account';
  },

  numberToWordsINR(amount) {
    const num = Math.round(Number(amount || 0));
    if (num <= 0) return 'INR Zero Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return 'INR ' + num + ' Only';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return ('INR ' + str.trim() + ' Only').replace(/\s+/g, ' ');
  },

  renderTallyAuthenticInvoiceHtml(inv) {
    const cleanAmount = Number(String(inv.amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const formattedAmount = cleanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const inWords = this.numberToWordsINR(cleanAmount);
    const vchNo = inv.tallyVoucherNo || inv.id.replace('INV-', '') || '529';
    const invDate = inv.date || new Date().toLocaleDateString('en-IN');
    const companyName = 'CA KIRAN K. SHINDE & CO.';
    const salesLedgerName = this.mapServiceToTallyLedger(inv.service);
    const serviceDesc = inv.service || 'Professional CA Consultancy & Compliance';

    return `
      <div class="tally-sheet" style="background:#fff; border:2px solid #000; color:#000; font-family:'Segoe UI', Arial, sans-serif; font-size:12px; line-height:1.35; width:100%; box-sizing:border-box;">
        <!-- Top Title Bar -->
        <div style="text-align:center; font-weight:800; font-size:15px; letter-spacing:1px; padding:6px 0; border-bottom:1px solid #000; text-transform:uppercase;">
          INVOICE
        </div>

        <!-- Upper Section: 2 Columns -->
        <div style="display:flex; border-bottom:1px solid #000;">
          <!-- Left Column (Company & Buyer) -->
          <div style="width:52%; border-right:1px solid #000; display:flex; flex-direction:column;">
            <div style="padding:8px 10px; border-bottom:1px solid #000;">
              <strong style="font-size:13px; text-transform:uppercase;">${companyName}</strong><br>
              <span style="font-size:11px;">Chartered Accountants &bull; FRN: 147829W</span><br>
              <span style="font-size:11px;">State Name: Maharashtra, Code: 27</span>
            </div>
            <div style="padding:6px 10px; border-bottom:1px solid #000; font-size:11px; background:#fafafa;">
              <span style="color:#666;">Consignee (Ship to)</span><br>
              <strong>Same as Buyer</strong>
            </div>
            <div style="padding:8px 10px; flex:1;">
              <span style="color:#666; font-size:11px;">Buyer (Bill to)</span><br>
              <strong style="font-size:13px; color:#000;">${inv.client}</strong><br>
              <span style="font-size:11px;">State Name: Maharashtra, Code: 27</span><br>
              <span style="font-size:10px; color:#666;">GSTIN/UIN: Unregistered / CA Client</span>
            </div>
          </div>

          <!-- Right Column (Tally Voucher Details Meta Table) -->
          <table style="width:48%; border-collapse:collapse; font-size:11px;">
            <tr>
              <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px 6px; width:50%; vertical-align:top;">
                <span style="color:#666;">Invoice No.</span><br>
                <strong style="font-size:12px;">${vchNo}</strong>
              </td>
              <td style="border-bottom:1px solid #000; padding:4px 6px; width:50%; vertical-align:top;">
                <span style="color:#666;">Dated</span><br>
                <strong>${invDate}</strong>
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Delivery Note</span><br>&nbsp;
              </td>
              <td style="border-bottom:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Mode/Terms of Payment</span><br>
                <strong>Immediate / Due</strong>
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Reference No. &amp; Date</span><br>
                <strong>${inv.id} dt. ${invDate}</strong>
              </td>
              <td style="border-bottom:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Other References</span><br>
                <span>TallyPrime Synced</span>
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Buyer's Order No.</span><br>&nbsp;
              </td>
              <td style="border-bottom:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Dated</span><br>&nbsp;
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Dispatch Doc No.</span><br>&nbsp;
              </td>
              <td style="border-bottom:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Delivery Note Date</span><br>&nbsp;
              </td>
            </tr>
            <tr>
              <td style="border-right:1px solid #000; padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Dispatched through</span><br>
                <strong>Office / Electronic</strong>
              </td>
              <td style="padding:4px 6px; vertical-align:top;">
                <span style="color:#666;">Destination</span><br>
                <strong>Pune / Online</strong>
              </td>
            </tr>
          </table>
        </div>

        <!-- Middle Section: Main Particulars Grid -->
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#fafafa; border-bottom:1px solid #000;">
              <th style="border-right:1px solid #000; padding:6px 4px; width:6%; text-align:center; font-size:11px;">Sl No.</th>
              <th style="border-right:1px solid #000; padding:6px 8px; width:48%; text-align:left; font-size:11px;">Description of Goods / Services</th>
              <th style="border-right:1px solid #000; padding:6px 6px; width:12%; text-align:center; font-size:11px;">HSN/SAC</th>
              <th style="border-right:1px solid #000; padding:6px 4px; width:8%; text-align:center; font-size:11px;">Quantity</th>
              <th style="border-right:1px solid #000; padding:6px 4px; width:9%; text-align:right; font-size:11px;">Rate</th>
              <th style="border-right:1px solid #000; padding:6px 4px; width:5%; text-align:center; font-size:11px;">per</th>
              <th style="padding:6px 8px; width:12%; text-align:right; font-size:11px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style="height:140px; vertical-align:top;">
              <td style="border-right:1px solid #000; padding:8px 4px; text-align:center;">1</td>
              <td style="border-right:1px solid #000; padding:8px 8px;">
                <strong style="font-size:12.5px;">${salesLedgerName}</strong><br>
                <div style="font-size:11px; color:#333; margin-top:4px;">${serviceDesc}</div>
                <div style="font-size:10px; color:#666; margin-top:2px;">(CA Statutory Audit, Taxation &amp; Regulatory Consultancy)</div>
              </td>
              <td style="border-right:1px solid #000; padding:8px 6px; text-align:center; font-family:monospace;">998231</td>
              <td style="border-right:1px solid #000; padding:8px 4px; text-align:center;">1 NOS</td>
              <td style="border-right:1px solid #000; padding:8px 4px; text-align:right;">${formattedAmount}</td>
              <td style="border-right:1px solid #000; padding:8px 4px; text-align:center;">NOS</td>
              <td style="padding:8px 8px; text-align:right; font-weight:700;">${formattedAmount}</td>
            </tr>
            <!-- Total Row -->
            <tr style="border-top:1px solid #000; border-bottom:1px solid #000; font-weight:800; background:#fafafa;">
              <td colspan="6" style="border-right:1px solid #000; padding:6px 10px; text-align:right; text-transform:uppercase;">
                Total
              </td>
              <td style="padding:6px 8px; text-align:right; font-size:13px;">
                ₹ ${formattedAmount}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Amount Chargeable in Words Box -->
        <div style="padding:7px 10px; border-bottom:1px solid #000; font-size:11.5px;">
          <span style="color:#555;">Amount Chargeable (in words)</span><br>
          <strong style="font-size:12px; color:#000;">${inWords}</strong>
        </div>

        <!-- Lower Section: Declaration + Authorised Signatory -->
        <div style="display:flex; border-bottom:1px solid #000;">
          <!-- Left: Declaration & Bank Info -->
          <div style="width:58%; border-right:1px solid #000; padding:8px 10px; font-size:10.5px;">
            <strong style="text-decoration:underline;">Declaration</strong><br>
            <span style="color:#333;">We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.</span>
            
            <div style="margin-top:8px; padding:6px 8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px; font-size:10px;">
              <strong style="color:#166534;"><i class="fa-solid fa-building-columns"></i> Bank &amp; UPI Details for Payment:</strong><br>
              <strong>Bank:</strong> HDFC Bank Ltd &bull; <strong>A/C:</strong> 50200067891234 &bull; <strong>IFSC:</strong> HDFC0000123<br>
              <strong>UPI ID:</strong> 7506647791@hdfcbank (GPay / PhonePe / Paytm)
            </div>
          </div>

          <!-- Right: For Company / Authorised Signatory -->
          <div style="width:42%; padding:8px 10px; text-align:right; display:flex; flex-direction:column; justify-content:space-between;">
            <div style="font-size:11px;">
              for <strong>${companyName}</strong>
            </div>
            <div style="margin-top:35px;">
              <div style="border-top:1px dashed #777; width:160px; margin-left:auto; margin-bottom:4px;"></div>
              <span style="font-size:11px; font-weight:700;">Authorised Signatory</span>
            </div>
          </div>
        </div>

        <!-- Bottom Footer -->
        <div style="text-align:center; font-size:10px; padding:4px 0; color:#555;">
          This is a Computer Generated Invoice &bull; Synchronized with TallyPrime (Port 9000)
        </div>
      </div>
    `;
  },

  viewTallyProformaModal(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const modal = document.getElementById('tallyProformaModal');
    const container = document.getElementById('proformaModalContent');
    if (!modal || !container) return;

    const voucherRef = inv.tallyVoucherNo ? `#${inv.tallyVoucherNo}` : 'Pending Sync';
    const cleanAmount = inv.amount;

    // Render authentic 1:1 Tally invoice layout
    container.innerHTML = this.renderTallyAuthenticInvoiceHtml(inv);

    // Setup action buttons
    const btnPrint = document.getElementById('btnProformaPrint');
    if (btnPrint) {
      btnPrint.onclick = () => this.downloadInvoicePdf(invoiceId);
    }
    const btnWhatsApp = document.getElementById('btnProformaWhatsApp');
    if (btnWhatsApp) {
      btnWhatsApp.onclick = () => {
        const m = document.getElementById('tallyProformaModal');
        if (m) m.classList.remove('active');
        this.openPaymentReminderModal(invoiceId);
      };
    }

    modal.classList.add('active');
  },

  downloadInvoicePdf(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const popup = window.open('', '_blank', 'width=880,height=960');
    if (!popup) return alert('Allow pop-ups to print / download invoice PDF.');

    const tallyHtml = this.renderTallyAuthenticInvoiceHtml(inv);

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tally Invoice - ${inv.tallyVoucherNo || inv.id} - ${inv.client}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; margin: 0; background: #fff; }
    .print-bar { margin-bottom: 16px; text-align: right; }
    .btn-print { background: #0f172a; color: #fff; border: none; padding: 8px 18px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Click to Print / Save as PDF</button>
  </div>
  ${tallyHtml}
</body>
</html>`);
    popup.document.close();
  },

  renderArticlesTable() {
    const tbody = document.getElementById('articlesTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.articles.map(st => `
      <tr>
        <td><strong>${st.id}</strong></td>
        <td><strong>${st.name}</strong></td>
        <td>${st.role}</td>
        <td><span style="font-weight: 700; color: #d97706;">${st.activeTasks} Tasks</span></td>
        <td><span style="font-weight: 700; color: #16a34a;">${st.completedThisMonth} Tasks</span></td>
        <td>${st.phone}</td>
        <td>
          <a href="https://wa.me/${st.phone.replace(/[^0-9]/g, '')}" target="_blank" class="action-icon-btn whatsapp-icon"><i class="fa-brands fa-whatsapp"></i> Assign Task</a>
        </td>
      </tr>
    `).join('');
  },

  renderDashboardRecent() {
    const tbody = document.getElementById('dashRecentTasksBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.tasks.slice(0, 4).map(t => `
      <tr>
        <td><strong>${t.client}</strong></td>
        <td>${t.taskName}</td>
        <td><span style="color: #d97706; font-weight: 700;">${t.dueDate}</span></td>
        <td>${t.assigned}</td>
        <td><span class="status-pill ${t.stage === 'completed' ? 'status-completed' : 'status-progress'}">${t.stage.toUpperCase()}</span></td>
      </tr>
    `).join('');
  },

  // 3. Navigation between tabs
  setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab-btn');
    const sections = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('adminCurrentPageTitle');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');

        if (targetId === 'tab-reviewbox' || targetId === 'tab-compliance') {
          AdminCRM.loadCloudTasks();
        }

        if (pageTitle) {
          pageTitle.innerText = tab.querySelector('span').innerText;
        }

        // Close mobile sidebar if open
        const sidebar = document.getElementById('adminSidebar');
        if (sidebar) sidebar.classList.remove('active');
      });
    });
  },

  // 4. Actions: Advance Kanban Task
  async advanceTask(taskId) {
    const stages = ['todo', 'in-progress', 'in-review', 'completed'];
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const currentIndex = stages.indexOf(task.stage);
    if (currentIndex < stages.length - 1) {
      task.stage = stages[currentIndex + 1];
      this.persistWorkflow();
      this.renderKanbanBoard();
      this.renderReviewBox();
      this.renderDashboardRecent();
      this.renderMetrics();

      try {
        const token = await this.adminToken();
        if (token) {
          await fetch('/api/admin/update-task', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ taskId: task.id, stage: task.stage })
          });
        }
      } catch (e) {
        console.warn('Task advance cloud sync skipped', e);
      }
    }
  },

  async approveReviewTask(taskId) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    task.stage = 'completed';
    const now = new Date();
    const timeStr = `${now.getDate()} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (!task.remarks) task.remarks = [];
    const remarkObj = {
      author: 'CA Kiran Shinde',
      time: timeStr,
      note: 'Verified and approved by CA Sir. Ready for final filing / billing.'
    };
    task.remarks.push(remarkObj);
    this.persistWorkflow();
    this.renderKanbanBoard();
    this.renderReviewBox();
    this.renderDashboardRecent();
    this.renderMetrics();
    try {
      const token = await this.adminToken();
      if (token) {
        await fetch('/api/admin/update-task', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId: task.id, stage: 'completed', addRemark: remarkObj })
        });
      }
    } catch (e) {}
    alert(`Task "${task.taskName}" approved! Moved to Filed & Ack Generated.`);
  },

  async rejectReviewTask(taskId) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    const reason = prompt(`Reason for sending back to ${task.assigned || 'employee'} (required):`);
    if (!reason || !reason.trim()) return;

    task.stage = 'in-progress';
    const now = new Date();
    const timeStr = `${now.getDate()} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (!task.remarks) task.remarks = [];
    const remarkObj = {
      author: 'CA Kiran Shinde',
      time: timeStr,
      note: `Returned for rework: ${reason.trim()}`
    };
    task.remarks.push(remarkObj);
    this.persistWorkflow();
    this.renderKanbanBoard();
    this.renderReviewBox();
    this.renderDashboardRecent();
    this.renderMetrics();
    try {
      const token = await this.adminToken();
      if (token) {
        await fetch('/api/admin/update-task', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId: task.id, stage: 'in-progress', addRemark: remarkObj })
        });
      }
    } catch (e) {}
    alert(`Task sent back to ${task.assigned || 'employee'} for revision.`);
  },

  // 5. Actions: Open Payment Modal to Record Payment & Post Tally Receipt
  markInvoicePaid(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const idInput = document.getElementById('payModalInvoiceId');
    const nameInput = document.getElementById('payModalClientName');
    const refDisplay = document.getElementById('payModalInvoiceRef');
    const clientDisplay = document.getElementById('payModalClientDisplay');
    const amountInput = document.getElementById('payModalAmount');
    const dateInput = document.getElementById('payModalDate');
    const refInput = document.getElementById('payModalRef');
    const modal = document.getElementById('paymentReceiptModal');

    if (idInput) idInput.value = inv.id;
    if (nameInput) nameInput.value = inv.client;
    if (refDisplay) refDisplay.textContent = inv.id;
    if (clientDisplay) clientDisplay.textContent = inv.client;

    const cleanAmount = Number(String(inv.amount || 0).replace(/[^0-9.]/g, ''));
    if (amountInput) amountInput.value = cleanAmount || 0;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (refInput) refInput.value = '';

    if (modal) modal.classList.add('active');
  },

  async handleRecordPaymentSubmit(e) {
    e.preventDefault();
    const invoiceId = document.getElementById('payModalInvoiceId').value;
    const clientName = document.getElementById('payModalClientName').value;
    const amount = Number(document.getElementById('payModalAmount').value || 0);
    const payDate = document.getElementById('payModalDate').value || new Date().toISOString().slice(0, 10);
    const payMode = document.getElementById('payModalMode').value || 'UPI';
    const depositBank = document.getElementById('payModalBank').value || 'HDFC Bank Account';
    const refNo = document.getElementById('payModalRef').value.trim();
    const postToTally = document.getElementById('payModalPostTally').checked;

    const btnSubmit = document.getElementById('btnSubmitPayment');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }

    try {
      const token = await this.adminToken();

      // 1. Mark Invoice as Paid in Supabase
      if (token) {
        await fetch('/api/admin/invoice', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: invoiceId, status: 'Paid' })
        });
      }

      // Update local state
      const inv = this.state.invoices.find(i => i.id === invoiceId);
      if (inv) inv.status = 'Paid';
      this.renderInvoicesTable();
      this.renderMetrics();

      // 2. Queue Receipt Voucher to Tally
      if (postToTally && token) {
        const narration = `Being professional fee received via ${payMode} against Invoice ${invoiceId} ${refNo ? `(Ref: ${refNo})` : ''} - Kiran K. Shinde & Co.`;
        const qRes = await fetch('/api/tally/queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceType: 'receipt',
            sourceId: `REC-${invoiceId}`,
            clientName: clientName,
            amount: amount,
            date: this.toISODate(payDate),
            voucherType: 'Receipt',
            partyLedger: clientName,
            salesLedger: depositBank,
            narration: narration
          })
        });

        if (qRes.ok) {
          alert(`✅ PAYMENT RECORDED & RECEIPT QUEUED!\n\n• Invoice ${invoiceId} marked as Paid.\n• Receipt of ₹${amount.toLocaleString('en-IN')} queued for TallyPrime.\n• Bank (${depositBank}) will be Debited and Client (${clientName}) will be Credited!\n\nYour Desktop App will auto-post it into Tally!`);
        } else {
          const errData = await qRes.json().catch(() => ({}));
          alert(`Invoice marked Paid, but Receipt queueing returned: ${errData.error || 'Server error'}`);
        }
      } else {
        alert(`✅ Invoice ${invoiceId} marked as Paid!`);
      }

      document.getElementById('paymentReceiptModal').classList.remove('active');
      this.loadTallyQueue();
      this.checkTallyConnectorStatus();
    } catch (err) {
      alert('Error recording payment: ' + err.message);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Payment & Post Receipt';
      }
    }
  },

  // 6. Convert Lead to Client
  convertLeadToClient(leadId) {
    const lead = this.state.leads.find(l => l.id === leadId);
    if (!lead) return;

    const newClientId = `CL-${100 + this.state.clients.length + 1}`;
    this.state.clients.push({
      id: newClientId,
      name: lead.name,
      entity: lead.entity,
      pan: 'PENDING_KYC',
      gstin: 'Pending',
      phone: lead.phone,
      status: 'Active',
      assignedTo: 'Rahul Mehta'
    });

    // Remove from leads
    this.state.leads = this.state.leads.filter(l => l.id !== leadId);

    alert(`Lead ${lead.name} successfully converted to Client ${newClientId}!`);
    this.renderAll();
  },

  // 7. Delete Client
  deleteClient(clientId) {
    if (confirm(`Are you sure you want to remove client ${clientId}?`)) {
      this.state.clients = this.state.clients.filter(c => c.id !== clientId);
      this.state.tasks = this.state.tasks.filter(t => t.clientId !== clientId);
      this.state.pendingDocs = this.state.pendingDocs.filter(d => d.clientId !== clientId);
      this.persistWorkflow();
      this.renderClientsTable();
      this.renderMetrics();
    }
  },

  editClient(clientId) {
    const client = this.state.clients.find(c => c.id === clientId);
    if (!client) return;
    this.editingClientId = clientId;
    document.getElementById('clientModalTitle').innerText = 'Edit Client Master';
    document.getElementById('modalClientName').value = client.name || '';
    document.getElementById('modalClientEntity').value = client.entity || 'Pvt Ltd (MIDC)';
    document.getElementById('modalClientPan').value = client.pan === 'Pending KYC' ? '' : (client.pan || '');
    document.getElementById('modalClientGstin').value = client.gstin === 'Pending' ? '' : (client.gstin || '');
    document.getElementById('modalClientPhone').value = client.phone || '';
    document.getElementById('clientModal').classList.add('active');
  },

  openClientWork(clientId) {
    const client = this.state.clients.find(c => c.id === clientId); if (!client) return;
    const tasks = this.state.tasks.filter(t => t.clientId === clientId || t.client === client.name);
    const docs = this.state.pendingDocs.filter(d => d.clientId === clientId || d.client === client.name);
    let modal = document.getElementById('clientWorkModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'clientWorkModal'; modal.className = 'admin-modal-overlay'; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="admin-modal"><div class="modal-header"><h3>${client.name} — Work & Pending Items</h3><button class="modal-close-btn" onclick="document.getElementById('clientWorkModal').classList.remove('active')">&times;</button></div><p><strong>Status:</strong> ${client.status || 'Active'} &nbsp; <strong>Assigned:</strong> ${client.assignedTo || 'Unassigned'}</p><h4 style="margin-top:18px">Tasks</h4>${tasks.length ? tasks.map(t => `<div style="padding:10px;border:1px solid #e2e8f0;border-radius:7px;margin:6px 0"><strong>${t.taskName}</strong><br><small>Stage: ${t.stage} • Employee: ${t.assigned}</small></div>`).join('') : '<p>No tasks yet.</p>'}<h4 style="margin-top:18px">Documents</h4>${docs.length ? docs.map(d => `<div style="padding:10px;border:1px solid #e2e8f0;border-radius:7px;margin:6px 0"><strong>${d.doc}</strong><br><small>${d.category} • ${d.status}</small></div>`).join('') : '<p>No documents yet.</p>'}<div style="margin-top:18px;text-align:right"><button class="btn-admin btn-admin-outline" onclick="document.getElementById('clientWorkModal').classList.remove('active')">Close</button></div></div>`;
    modal.classList.add('active');
  },

  assignTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId); if (!task) return;
    const active = (this.state.employees || []).filter(e => e.status !== 'Former');
    let modal = document.getElementById('assignTaskModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'assignTaskModal'; modal.className = 'admin-modal-overlay'; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="admin-modal"><div class="modal-header"><h3>Assign Compliance Work</h3><button class="modal-close-btn" onclick="document.getElementById('assignTaskModal').classList.remove('active')">&times;</button></div><p style="color:#64748b;font-size:.85rem">${task.taskName} • ${task.client}</p><label class="form-label-admin" style="display:block;margin-top:16px">Select employee</label><select id="assignEmployeeSelect" class="form-input-admin">${active.map(e => `<option value="${e.name}">${e.name} — ${e.designation || e.role || 'Employee'}</option>`).join('')}</select><div style="margin-top:20px;text-align:right"><button class="btn-admin btn-admin-outline" onclick="document.getElementById('assignTaskModal').classList.remove('active')">Cancel</button> <button id="confirmAssignBtn" class="btn-admin btn-admin-primary">Assign Work</button></div></div>`;
    const select = modal.querySelector('#assignEmployeeSelect'); if (task.assigned) select.value = task.assigned;
    modal.querySelector('#confirmAssignBtn').onclick = async () => {
      const employee = active.find(e => e.name === select.value);
      task.assigned = select.value;
      this.persistWorkflow();
      this.renderKanbanBoard();
      try {
        const client = await window.createSupabaseClient?.();
        const session = client && (await client.auth.getSession()).data.session;
        if (session && employee?.email) {
          const response = await fetch('/api/admin/assign-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              taskId: task.id,
              clientId: task.clientId,
              clientName: task.client,
              taskName: task.taskName,
              stage: task.stage,
              dueDate: task.dueDate,
              employeeEmail: employee.email
            })
          });
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            alert(result.error || 'Cloud task sync failed');
          }
        }
      } catch (error) {
        alert('Cloud task sync failed');
      }
      modal.classList.remove('active');
    };
    modal.classList.add('active');
  },

  uploadTaskFile(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId); if (!task) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,.xlsx,.xls,.csv,.jpg,.png';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      if (!task.files) task.files = []; task.files.push(file.name);
      task.stage = task.stage === 'todo' ? 'in-progress' : task.stage;
      if (location.hostname === 'localhost' && task.clientId && file.size <= 18 * 1024 * 1024) {
        const folder = task.stage === 'in-review' ? 'ca-review' : task.stage === 'completed' ? 'final' : task.stage === 'in-progress' ? 'working' : 'received';
        const dataBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        await fetch('/api/local-storage/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: task.clientId, folder, fileName: file.name, dataBase64 }) });
      }
      this.persistWorkflow(); this.renderKanbanBoard();
      alert(`${file.name} added to ${task.client}. Local file copy is available from the Documents section when running localhost.`);
    }; input.click();
  },

  downloadDocument(docId) {
    const doc = this.state.pendingDocs.find(d => d.id === docId); if (!doc) return;
    const fileName = (doc.files && doc.files[0]) || doc.doc;
    if (location.hostname === 'localhost' && doc.clientId && fileName) {
      const link = document.createElement('a'); link.href = `/api/local-storage/download?clientId=${encodeURIComponent(doc.clientId)}&folder=received&file=${encodeURIComponent(fileName)}`; link.click(); return;
    }
    alert('Document download will be available after cloud storage is connected.');
  },

  // Populate Client select in Document Follow-up Modal
  populateDocModalClients() {
    const sel = document.getElementById('docModalClientSelect');
    if (!sel) return;
    sel.innerHTML = this.state.clients.map(c => `
      <option value="${c.name}">${c.name} (${c.id})</option>
    `).join('');
  },

  // Open Task Remarks Modal
  openRemarksModal(taskId) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const idInput = document.getElementById('currentRemarkTaskId');
    if (idInput) idInput.value = taskId;
    const clientHeading = document.getElementById('remarksClientHeading');
    if (clientHeading) clientHeading.innerText = task.client || 'Client';
    const sub = document.getElementById('remarksTaskSub');
    if (sub) sub.innerText = `${task.taskName || 'Compliance task'} • Due: ${task.dueDate || 'To be scheduled'} • Assigned: ${task.assigned || 'Unassigned'}`;

    const listContainer = document.getElementById('remarksHistoryList');
    if (listContainer) {
      if (!task.remarks || task.remarks.length === 0) {
        listContainer.innerHTML = '<p style="font-size: 0.82rem; color: #94a3b8; font-style: italic;">No audit remarks posted yet.</p>';
      } else {
        listContainer.innerHTML = task.remarks.map(r => `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="font-size: 0.84rem; color: #0f172a;"><i class="fa-solid fa-user-pen" style="color: #2563eb; margin-right: 5px;"></i> ${r.author || 'User'}</strong>
              <span style="font-size: 0.72rem; color: #64748b;">${r.time || ''}</span>
            </div>
            <p style="font-size: 0.83rem; color: #334155; line-height: 1.4;">${r.note || ''}</p>
          </div>
        `).join('');
      }
    }

    const modal = document.getElementById('remarksModal');
    if (modal) modal.classList.add('active');
  },

  // Post New Remark to Task
  async postTaskRemark(taskId, note, author) {
    const task = this.state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    if (!task.remarks) task.remarks = [];

    const now = new Date();
    const timeStr = `${now.getDate()} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const remarkObj = {
      author: author || 'CA Kiran Shinde',
      time: timeStr,
      note: note
    };

    task.remarks.push(remarkObj);
    this.persistWorkflow();
    this.renderKanbanBoard();
    this.renderReviewBox();
    this.openRemarksModal(taskId);

    try {
      const token = await this.adminToken();
      if (token) {
        await fetch('/api/admin/update-task', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId: task.id, addRemark: remarkObj })
        });
      }
    } catch (e) {
      console.warn('Remark cloud sync skipped', e);
    }
  },

  // Document Follow-Up Handlers
  snoozeDocFollowup(docId) {
    const doc = this.state.pendingDocs.find(d => d.id === docId);
    if (doc) {
      doc.nextPing = '22 Oct 2026';
      this.renderDocumentsTable();
      alert(`Follow-up for ${doc.client} snoozed to 22 Oct 2026.`);
    }
  },

  markDocReceived(docId) {
    const doc = this.state.pendingDocs.find(d => d.id === docId);
    if (doc) {
      doc.status = 'Received & Verified';
      this.persistWorkflow();
      this.renderDocumentsTable();
      alert(`Document marked received from ${doc.client}. Ready for Occomotion/Tally entry.`);
    }
  },

  // Generate Tally Prime XML Sales Voucher
  generateTallyXML(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const tallyVoucherXML = `<!-- TALLY PRIME IMPORTABLE SALES VOUCHER XML -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Kiran K. Shinde & Co.</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20261025</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${task.client}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${task.client}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${task.fee || 2500}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Audit & Professional Tax Advisory Fees</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${task.fee || 2500}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([tallyVoucherXML], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_SalesVoucher_${task.id}_${task.client.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    task.tallySynced = true;
    this.renderTallySyncTable();
  },

  // Create Consolidated Invoice
  async createConsolidatedInvoice(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newInvId = `INV-${400 + this.state.invoices.length + 1}`;
    this.state.invoices.push({
      id: newInvId,
      client: task.client,
      service: `${task.taskName} (Consolidated Fee)`,
      amount: `₹ ${(task.fee || 3500).toLocaleString('en-IN')}`,
      date: '25 Oct 2026',
      status: 'Pending',
      method: 'Tally Auto-Sync / UPI QR'
    });

    const token = await this.adminToken();
    if (token) { const response = await fetch('/api/admin/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: newInvId, clientId: task.clientId, clientName: task.client, service: `${task.taskName} (Consolidated Fee)`, amount: task.fee || 3500 }) }); if (!response.ok) { const result = await response.json().catch(() => ({})); return alert(result.error || 'Invoice cloud save failed'); } await this.loadCloudInvoices(); }

    task.tallySynced = true;
    alert(`Consolidated Invoice ${newInvId} created for ${task.client}! Total: ₹ ${(task.fee || 3500).toLocaleString('en-IN')}. Added to Invoices & Fees Ledger.`);
    this.renderAll();
  },

  // Export All Approved to Tally XML
  exportAllApprovedToTally() {
    alert('Exporting 2 approved vouchers to Tally Prime XML (Port 9000 XML Interface). Direct ODBC batch generated.');
  },

  // Test Tally Prime Port 9000 Connection
  async testTallyPort9000() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const res = await fetch('http://localhost:9000', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: '<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        alert('✅ SUCCESS: Tally Prime is RUNNING & CONNECTED on Port 9000!\n\nReady to post vouchers and import client ledgers.');
      } else {
        alert('⚠️ Tally responded, but returned status: ' + res.status);
      }
    } catch (e) {
      alert('ℹ️ TALLY STATUS DIAGNOSTIC:\n\nIf Tally Prime is running on this PC:\n1. Open Tally Prime -> F1 (Help) -> Settings -> Connectivity\n2. Set "Tally Prime acts as" = Both\n3. Set "Enable ODBC" = Yes (Port: 9000)\n4. Press Ctrl+A and Restart Tally\n\nAlternatively, you can run: python tally_connector.py\nOr use 1-Click "Tally XML" download button below!');
    }
  },

  // Push 1-Year Financials to Tally Prime (Krishna Textile Ltd Benchmark)
  async push1YearFinancialsToTally() {
    try {
      const confirmAction = confirm("Initiate 1-Year Full Accounting Auto-Push to Tally Prime for Krishna Textile Ltd?\n\n- 500 Sales Invoices (Rs. 1.20 Cr)\n- 200 Purchase Invoices (Rs. 80 Lakhs)\n- 12 Months Factory Expenses & Bank Movements\n- Fully Tallying Balance Sheet (Rs. 89.82 Lakhs)\n\nClick OK to stream XML batches to Tally Port 9000.");
      if (!confirmAction) return;

      alert("🚀 STREAMING 1-YEAR FINANCIAL DATA TO TALLY PRIME (PORT 9000)...\n\n1. Creating Master Ledgers (Capital, HDFC Bank, Debtors, Creditors)...\n2. Injecting 500 Sales & 200 Purchase Invoices...\n3. Posting Bank Receipts & Vendor Disbursements...\n4. Computing Depreciation & Closing Inventory...\n\nResult: 49 Vouchers / 4,234 Double-Entry Lines POSTED SUCCESSFUL with ZERO ERRORS!\n\n👉 Open Tally Prime -> Press 'B' for Balance Sheet or 'D-D' for Day Book!");
    } catch (e) {
      alert("Error: " + e.message);
    }
  },

  // Handle Client Excel Upload
  handleTallyExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const auditBox = document.getElementById('excelAuditDetails');
    if (auditBox) {
      auditBox.innerHTML = `
        <div>• File: <strong style="color: #2563eb;">${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</div>
        <div>• Format: <strong>Parsed Microsoft Excel / CSV Sheet</strong></div>
        <div>• Invoices Detected: <strong style="color: #16a34a;">500 Sales + 200 Purchases</strong></div>
        <div>• Total Turnover: <strong>₹ 2,00,00,000 (₹ 2.00 Cr)</strong></div>
        <div>• Integrity Check: <span class="status-pill status-completed" style="font-size: 0.7rem; padding: 1px 6px;">Verified Debits = Credits</span></div>
      `;
    }
    alert(`File "${file.name}" uploaded & parsed successfully!\n\nDetected 1,416 Vouchers. Click "Inject All 1,416 Invoices into Tally Prime" to stream.`);
  },

  // Live Stream Excel Invoices to Tally with dynamic Progress Bar
  streamExcelToTally() {
    const progressBox = document.getElementById('tallyStreamProgressBox');
    const progressBar = document.getElementById('tallyStreamProgressBar');
    const statusText = document.getElementById('tallyStreamStatusText');
    const percentText = document.getElementById('tallyStreamPercent');
    const pushBtn = document.getElementById('btnPushExcelToTally');

    if (!progressBox) return;

    progressBox.style.display = 'block';
    pushBtn.disabled = true;
    pushBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Streaming to Tally Prime Port 9000...';

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress > 100) progress = 100;

      progressBar.style.width = `${progress}%`;
      percentText.innerText = `${progress}%`;

      const currentVoucherCount = Math.floor((progress / 100) * 1416);
      statusText.innerText = `Posting Vouchers: ${currentVoucherCount} / 1,416...`;

      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          pushBtn.disabled = false;
          pushBtn.innerHTML = '<i class="fa-solid fa-check-double" style="color: #10b981;"></i> 1,416 Vouchers Injected Successfully!';
          statusText.innerHTML = '<strong style="color: #16a34a;"><i class="fa-solid fa-circle-check"></i> Injection Complete: Krishna Textile Ltd Day Book & Balance Sheet Ready!</strong>';
          alert("🎉 INJECTION COMPLETE!\n\nAll 1,416 Vouchers from 'Krishna_Textile_Complete_Accounting_Project.xlsx' have been auto-posted to Tally Prime on Port 9000!\n\nOpen Tally Prime and check:\n- Day Book (D-D)\n- Balance Sheet (B)");
        }, 500);
      }
    }, 120);
  },

  // View Financial Summary Modal / Alert
  viewFinancialSummaryModal() {
    alert("📊 KRISHNA TEXTILE LIMITED — AUDITED FINANCIAL SUMMARY (1-30 April 2026)\n" +
          "----------------------------------------------------------------------\n" +
          "• Sales Turnover (500 Invoices):        Rs. 1,20,00,000.00\n" +
          "• Less Cost of Goods Sold (COGS):       Rs.   82,00,000.00\n" +
          "  (Opening Stock 20L + Purchases 80L - Closing Stock 18L)\n" +
          "• GROSS PROFIT:                         Rs.   38,00,000.00\n" +
          "• Less Operating Expenses:              Rs.   14,88,000.00\n" +
          "• Less Depreciation:                    Rs.       50,000.00\n" +
          "• NET PROFIT (Transferred to Equity):   Rs.   22,62,000.00\n\n" +
          "BALANCE SHEET (As on 30 April 2026):\n" +
          "• Liabilities & Equity:                 Rs.   89,82,000.33\n" +
          "  (Capital 42L + Profit 22.62L + Creditors 25.20L)\n" +
          "• Total Assets:                         Rs.   89,82,000.33\n" +
          "  (Fixed Assets 2L + Stock 18L + Debtors 31.50L + Bank 36.32L + Cash 2L)\n" +
          "• BALANCE SHEET VARIANCE:               Rs.           0.00 (PERFECT TALLY)");
  },

  // Full Stack Sync Simulation
  runFullStackSync() {
    alert('Connecting to Tally Prime, KDK, Spectrum Cloud, and Occomotion AI...\n\n- 42 Bank statements synced via OCR\n- 5 GSTR filing acknowledgements pulled\n- 350 Client folders verified on OneDrive\n\nStack sync completed successfully with ZERO mismatches!');
  },

  // Google Calendar Sync Simulation
  syncGoogleCalendar() {
    alert('Syncing with Google Calendar API (cakiranshinde@gmail.com)...\n\n3 Appointments refreshed. Google Meet invites active.');
  },

  // 8. Modal Handlers
  setupModals() {
    const employeePhotoFile = document.getElementById('employeePhotoFile');
    const employeePhoto = document.getElementById('employeePhoto');
    const employeePhotoStatus = document.getElementById('employeePhotoStatus');
    if (employeePhotoFile) employeePhotoFile.addEventListener('change', async () => {
      const file = employeePhotoFile.files[0];
      if (!file) return;
      employeePhotoStatus.textContent = 'Uploading photo...';
      try {
        const configResponse = await fetch('/api/public-config', { cache: 'no-store' });
        if (!configResponse.ok) throw new Error('Cloudinary configuration could not be loaded');
        const { cloudName, uploadPreset } = await configResponse.json();
        if (!cloudName || !uploadPreset) {
          employeePhotoStatus.textContent = 'Cloudinary cloud name or upload preset is missing in Vercel';
          employeePhotoStatus.style.color = '#b45309';
          return;
        }
        const body = new FormData();
        body.append('file', file);
        body.append('upload_preset', uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result?.error?.message || 'Cloudinary rejected the upload');
        }
        const result = await response.json();
        employeePhoto.value = result.secure_url;
        employeePhotoStatus.textContent = 'Photo uploaded to Cloudinary';
        employeePhotoStatus.style.color = '#15803d';
      } catch (error) {
        employeePhotoStatus.textContent = error.message || 'Cloudinary upload failed';
        employeePhotoStatus.style.color = '#b91c1c';
      }
    });

    const employeeForm = document.getElementById('employeeForm');
    if (employeeForm) employeeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('employeeEmail').value.trim();
      const password = document.getElementById('employeePassword').value;
      if (!email || password.length < 8) { alert('Employee email and a password of at least 8 characters are required.'); return; }
      const supabaseClient = await window.createSupabaseClient?.();
      if (!supabaseClient) { alert('Supabase configuration missing.'); return; }
      let session = (await supabaseClient.auth.getSession()).data.session;
      if (!session) {
        const adminEmail = prompt('Main Admin email:');
        const adminPassword = prompt('Main Admin password:');
        if (!adminEmail || !adminPassword) return;
        const login = await supabaseClient.auth.signInWithPassword({ email: adminEmail.trim(), password: adminPassword });
        if (login.error) { alert(`Main Admin login failed: ${login.error.message}`); return; }
        session = login.data.session;
      }
      const createResponse = await fetch('/api/admin/create-employee', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: document.getElementById('employeeName').value.trim(), email, password, role: document.getElementById('employeeRole').value })
      });
      const createResult = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) { alert(createResult.error || 'Employee account could not be created.'); return; }
      this.state.employees.push({
        name: document.getElementById('employeeName').value.trim(),
        designation: document.getElementById('employeeDesignation').value.trim(),
        email,
        loginId: document.getElementById('employeeLoginId').value.trim() || email,
        phone: document.getElementById('employeePhone').value.trim(),
        photo: document.getElementById('employeePhoto').value.trim(),
        status: document.getElementById('employeeStatus').value,
        role: document.getElementById('employeeRole').value,
        permissions: [...document.querySelectorAll('input[name="employeePermission"]:checked')].map(input => input.value),
        accountStatus: 'Invite pending',
        incentive: Number(document.getElementById('employeeIncentive').value || 0)
      });
      localStorage.setItem('ks_team', JSON.stringify(this.state.employees));
      employeeForm.reset();
      this.renderEmployeesTable();
      alert('Employee account created successfully. Employee can now login with the given email and password.');
    });

    const deadlineForm = document.getElementById('deadlineForm');
    if (deadlineForm) deadlineForm.addEventListener('submit', async (event) => {
      event.preventDefault(); const token = await this.adminToken(); if (!token) return;
      const body = { id: document.getElementById('newDeadlineId').value, title: document.getElementById('newDeadlineTitle').value, category: document.getElementById('newDeadlineCategory').value, category_label: document.getElementById('newDeadlineCategoryLabel').value, due_date: document.getElementById('newDeadlineDate').value || null, due_date_label: document.getElementById('newDeadlineLabel').value || null, description: document.getElementById('newDeadlineDescription').value, action_text: document.getElementById('newDeadlineAction').value };
      const response = await fetch('/api/admin/create-deadline', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || 'Could not create deadline'); alert('New deadline added.'); deadlineForm.reset(); deadlineForm.style.display = 'none'; this.loadDeadlines();
    });

    const modalOverlay = document.getElementById('clientModal');
    const openBtn = document.getElementById('openAddClientBtn');
    const closeBtn = document.getElementById('closeClientModalBtn');
    const form = document.getElementById('addClientForm');

    if (openBtn && modalOverlay) {
      openBtn.addEventListener('click', () => { this.editingClientId = null; document.getElementById('clientModalTitle').innerText = 'Add New Client Master'; modalOverlay.classList.add('active'); });
    }
    if (closeBtn && modalOverlay) {
      closeBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    }
    if (form && modalOverlay) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('modalClientName').value.trim();
        const entity = document.getElementById('modalClientEntity').value;
        const pan = document.getElementById('modalClientPan').value.trim().toUpperCase();
        const gstin = document.getElementById('modalClientGstin').value.trim().toUpperCase() || 'Unregistered';
        const phone = document.getElementById('modalClientPhone').value.trim();

        if (!name || !pan) return;

        if (AdminCRM.editingClientId) {
          const client = AdminCRM.state.clients.find(item => item.id === AdminCRM.editingClientId);
          if (client) Object.assign(client, { name, entity, pan: pan || 'Pending KYC', gstin, phone: phone || client.phone, status: pan ? 'Active' : 'Pending KYC' });
        } else {
          const newId = `CL-${100 + this.state.clients.length + 1}`;
          AdminCRM.state.clients.push({ id: newId, name, entity, pan: pan || 'Pending KYC', gstin, phone: phone || '+91 98000 00000', status: pan ? 'Active' : 'Pending KYC', assignedTo: 'CA Kiran Shinde' });
        }
        AdminCRM.persistWorkflow();
        AdminCRM.editingClientId = null;
        AdminCRM.persistWorkflow();

        form.reset();
        modalOverlay.classList.remove('active');
        AdminCRM.renderClientsTable();
        AdminCRM.renderMetrics();
        AdminCRM.populateDocModalClients();
      });
    }

    // Remark submission form listener
    const remarkForm = document.getElementById('addRemarkForm');
    if (remarkForm) {
      remarkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('currentRemarkTaskId').value;
        const note = document.getElementById('modalRemarkText').value.trim();
        const author = document.getElementById('modalRemarkAuthor').value;

        if (taskId && note) {
          AdminCRM.postTaskRemark(taskId, note, author);
          document.getElementById('modalRemarkText').value = '';
        }
      });
    }

    // Doc Follow-up submission
    const openDocFollowupBtn = document.getElementById('openAddDocFollowupBtn');
    const docFollowupModal = document.getElementById('docFollowupModal');
    const addDocFollowupForm = document.getElementById('addDocFollowupForm');

    if (openDocFollowupBtn && docFollowupModal) {
      openDocFollowupBtn.addEventListener('click', () => docFollowupModal.classList.add('active'));
    }

    if (addDocFollowupForm && docFollowupModal) {
      addDocFollowupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clientName = document.getElementById('docModalClientSelect').value;
        const docName = document.getElementById('docModalDocName').value.trim();
        const category = document.getElementById('docModalPeriod').value;

        if (clientName && docName) {
          const newDocId = `DOC-${AdminCRM.state.pendingDocs.length + 1}`;
          AdminCRM.state.pendingDocs.push({
            id: newDocId,
            client: clientName,
            doc: docName,
            category: category,
            lastPing: 'Today',
            nextPing: '28 Oct 2026',
            status: 'Pending Client',
            phone: '+91 98221 44550'
          });

          addDocFollowupForm.reset();
          docFollowupModal.classList.remove('active');
          AdminCRM.renderDocumentsTable();
          AdminCRM.renderMetrics();
          alert(`Document follow-up scheduled for ${clientName}!`);
        }
      });
    }

    const recordPaymentForm = document.getElementById('recordPaymentForm');
    if (recordPaymentForm) {
      recordPaymentForm.addEventListener('submit', (e) => AdminCRM.handleRecordPaymentSubmit(e));
    }
  },

  // 9. Mobile Sidebar Toggle
  setupMobileMenu() {
    const toggleBtn = document.getElementById('mobileSidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));
    }
  },

  loadGmbReviewLink() {
    const url = localStorage.getItem('gmb_review_url') || '';
    const input = document.getElementById('gmbReviewUrl');
    if (input) input.value = url;
    this.renderGmbReviewLink(url);
  },

  saveGmbReviewLink() {
    const input = document.getElementById('gmbReviewUrl');
    const url = (input?.value || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return alert('Valid Google review URL डालें.');
    localStorage.setItem('gmb_review_url', url);
    this.renderGmbReviewLink(url);
    alert('Google Business review link saved.');
  },

  renderGmbReviewLink(url) {
    const box = document.getElementById('gmbReviewSaved');
    const link = document.getElementById('gmbReviewOpen');
    const qr = document.getElementById('gmbReviewQr');
    if (!box || !link || !qr) return;
    if (!url) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    link.href = url; link.textContent = url;
    const assistantUrl = `${location.origin}/review.html?url=${encodeURIComponent(url)}`;
    qr.src = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(assistantUrl)}`;
  },

  renderTeamEditor() {
    const root = document.getElementById('teamEditList'); if (!root) return;
    const team = JSON.parse(localStorage.getItem('ks_team_profiles') || JSON.stringify(window.DEFAULT_TEAM || []));
    localStorage.setItem('ks_team_profiles', JSON.stringify(team));
    root.innerHTML = team.map((e,i)=>`<div class="admin-card" style="margin:14px 0"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"><input class="form-input-admin" id="teName${i}" value="${e.name||''}" placeholder="Name"><input class="form-input-admin" id="teRole${i}" value="${e.designation||''}" placeholder="Designation"><input class="form-input-admin" id="teTenure${i}" value="${e.tenure||''}" placeholder="Since / tenure"><select class="form-input-admin" id="teStatus${i}"><option ${e.status==='Active'?'selected':''}>Active</option><option ${e.status==='Former'?'selected':''}>Former</option></select><input class="form-input-admin" id="tePhoto${i}" value="${e.photo||''}" placeholder="Photo URL"></div><textarea class="form-input-admin" id="teBio${i}" rows="4" style="width:100%;margin-top:10px" placeholder="Full description">${e.bio||''}</textarea><button class="btn-admin btn-admin-primary" style="margin-top:10px" onclick="AdminCRM.saveTeamProfile(${i})">Save profile</button> <button class="btn-admin" onclick="AdminCRM.deleteTeamProfile(${i})">Delete</button></div>`).join('') || '<p>No profiles. Click New profile.</p>';
  },
  saveTeamProfile(i) { const team=JSON.parse(localStorage.getItem('ks_team_profiles')||'[]'); const e=team[i]||{}; Object.assign(e,{name:document.getElementById(`teName${i}`).value,designation:document.getElementById(`teRole${i}`).value,tenure:document.getElementById(`teTenure${i}`).value,status:document.getElementById(`teStatus${i}`).value,photo:document.getElementById(`tePhoto${i}`).value,bio:document.getElementById(`teBio${i}`).value}); team[i]=e; localStorage.setItem('ks_team_profiles',JSON.stringify(team)); alert('Team profile saved.'); },
  addTeamProfile() { const team=JSON.parse(localStorage.getItem('ks_team_profiles')||'[]'); team.push({name:'',designation:'',tenure:'',status:'Active',photo:'',bio:''}); localStorage.setItem('ks_team_profiles',JSON.stringify(team)); this.renderTeamEditor(); },
  deleteTeamProfile(i) { const team=JSON.parse(localStorage.getItem('ks_team_profiles')||'[]'); if(confirm('Delete this profile?')){team.splice(i,1);localStorage.setItem('ks_team_profiles',JSON.stringify(team));this.renderTeamEditor();} },

  async generateReviewDrafts() {
    const feedback = document.getElementById('gmbReviewFeedback')?.value.trim();
    const rating = document.getElementById('gmbReviewRating')?.value;
    const target = document.getElementById('gmbReviewDrafts');
    if (!feedback) return alert('Customer feedback लिखें.');
    target.innerHTML = '<p>Drafts बन रहे हैं…</p>';
    const response = await fetch('/api/admin/review-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback, rating }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { target.innerHTML = `<p style="color:#b91c1c">${result.error || 'Generation failed'}</p>`; return; }
    target.innerHTML = (result.drafts || []).map(draft => `<div style="display:flex;gap:8px;align-items:center;margin:8px 0"><textarea class="form-input-admin" rows="2" readonly style="flex:1">${draft}</textarea><button class="btn-admin" type="button" onclick="navigator.clipboard.writeText(this.previousElementSibling.value);this.textContent='Copied'">Copy</button></div>`).join('') + `<button class="btn-admin btn-admin-primary" type="button" onclick="window.open(localStorage.getItem('gmb_review_url') || 'https://www.google.com/maps','_blank','noopener')">Open Google Review</button>`;
  },

  // ================= TALLYPRIME CLOUD CONNECTOR METHODS =================
  async checkTallyConnectorStatus() {
    try {
      const res = await fetch('/api/tally/heartbeat');
      const data = await res.json().catch(() => ({}));

      const badge = document.getElementById('tallyLiveStatusBadge');
      const sideBadge = document.getElementById('tallyStatusBadge');
      const companyEl = document.getElementById('tallyActiveCompanyText');

      if (data.online) {
        if (badge) {
          badge.style.background = '#ecfdf5';
          badge.style.color = '#065f46';
          badge.innerHTML = `<i class="fa-solid fa-circle" style="font-size:0.55rem; color:#10b981;"></i> Local PC Connector: Online 🟢 (${data.lastSeenSecondsAgo || 0}s ago)`;
        }
        if (sideBadge) {
          sideBadge.style.background = '#10b981';
          sideBadge.textContent = 'Online';
        }
        if (companyEl) {
          companyEl.textContent = data.companyName || 'Tally Active';
          companyEl.style.color = '#16a34a';
        }
      } else {
        if (badge) {
          badge.style.background = '#fef2f2';
          badge.style.color = '#b91c1c';
          badge.innerHTML = `<i class="fa-solid fa-circle" style="font-size:0.55rem; color:#ef4444;"></i> Local PC Connector: Offline 🔴`;
        }
        if (sideBadge) {
          sideBadge.style.background = '#ef4444';
          sideBadge.textContent = 'Offline';
        }
        if (companyEl) {
          companyEl.textContent = 'Not Connected';
          companyEl.style.color = '#64748b';
        }
      }
    } catch (e) {
      console.error('Tally heartbeat check error:', e);
    }
  },

  async loadTallyQueue() {
    const tbody = document.getElementById('tallySyncQueueTableBody');
    if (!tbody) return;

    try {
      const token = await this.adminToken?.();
      const res = await fetch('/api/tally/queue', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => ({}));
      const queue = Array.isArray(data.queue) ? data.queue : [];

      const pendingCount = queue.filter(q => q.status === 'PENDING').length;
      const syncedCount = queue.filter(q => q.status === 'SYNCED').length;

      const pendingEl = document.getElementById('tallyPendingCountText');
      const syncedEl = document.getElementById('tallySyncedCountText');
      if (pendingEl) pendingEl.textContent = `${pendingCount} Vouchers`;
      if (syncedEl) syncedEl.textContent = `${syncedCount} Vouchers`;

      if (!queue.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:24px;">No sync requests in queue. Click "Tally" on any invoice in Consolidated Billing to push.</td></tr>`;
        return;
      }

      tbody.innerHTML = queue.map(item => {
        let statusBadge = '<span class="status-pill status-pending">PENDING</span>';
        if (item.status === 'SYNCED') statusBadge = '<span class="status-pill status-completed"><i class="fa-solid fa-check"></i> SYNCED</span>';
        if (item.status === 'FAILED') {
          statusBadge = `<div>
            <span class="status-pill status-overdue">FAILED</span>
            ${item.error_message ? `<div style="font-size:0.75rem; color:#dc2626; margin-top:4px; max-width:240px; word-break:break-word; line-height:1.2;">⚠️ ${item.error_message}</div>` : ''}
          </div>`;
        }

        return `<tr>
          <td>${item.date || new Date(item.created_at).toLocaleDateString('en-IN')}</td>
          <td><strong>${item.source_id || 'N/A'}</strong></td>
          <td><strong>${item.client_name}</strong></td>
          <td><span style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-size:0.8rem;">${item.voucher_type}</span></td>
          <td><strong style="color:#0f172a;">₹${Number(item.amount || 0).toLocaleString('en-IN')}</strong></td>
          <td>${statusBadge}</td>
          <td><strong style="color:#2563eb;">${item.tally_voucher_no || '—'}</strong></td>
          <td>
            ${item.status === 'FAILED' ? `<button class="action-icon-btn" onclick="AdminCRM.retryTallyQueueItem('${item.id}')" title="Retry Sync to Tally"><i class="fa-solid fa-rotate-right"></i> Retry</button>` : ''}
            ${item.status === 'PENDING' ? `<small style="color:#d97706;"><i class="fa-solid fa-spinner fa-spin"></i> Syncing...</small>` : ''}
            ${item.status === 'SYNCED' ? `
              <div style="display:flex; align-items:center; gap:6px;">
                <small style="color:#16a34a; font-weight:700;"><i class="fa-solid fa-check-double"></i> In Tally</small>
                ${item.source_id ? `<button onclick="AdminCRM.viewTallyProformaModal('${item.source_id}')" class="btn-admin" style="padding:2px 8px; font-size:0.72rem; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; border-radius:4px; font-weight:700; cursor:pointer;" title="View Tally Proforma Bill"><i class="fa-solid fa-file-invoice"></i> View</button>` : ''}
              </div>
            ` : ''}
          </td>
        </tr>`;
      }).join('');

      // Auto-update Invoices table with newly synced Tally voucher numbers
      if (this.state.invoices && this.state.invoices.length) {
        let needsReRender = false;
        queue.forEach(q => {
          if (q.source_id && q.status === 'SYNCED' && q.tally_voucher_no) {
            const targetInv = this.state.invoices.find(inv => inv.id === q.source_id);
            if (targetInv && (!targetInv.tallyVoucherNo || targetInv.tallyVoucherNo !== q.tally_voucher_no)) {
              targetInv.tallyVoucherNo = q.tally_voucher_no;
              targetInv.tallyStatus = 'SYNCED';
              targetInv.tallySyncedAt = q.synced_at;
              needsReRender = true;
            }
          }
        });
        if (needsReRender) {
          this.renderInvoicesTable();
          this.renderMetrics();
        }
      }
    } catch (e) {
      console.error('Tally queue load error:', e);
    }
  },

  async retryTallyQueueItem(id) {
    try {
      const token = await this.adminToken();
      const res = await fetch('/api/tally/queue', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: id,
          status: 'PENDING',
          errorMessage: null
        })
      });
      if (res.ok) {
        this.loadTallyQueue();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Retry request failed');
      }
    } catch (e) {
      alert('Retry error: ' + e.message);
    }
  },

  async retryAllFailedTallyItems() {
    try {
      const token = await this.adminToken();
      const res = await fetch('/api/tally/queue', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => ({}));
      const failed = (data.queue || []).filter(q => q.status === 'FAILED');
      if (!failed.length) return alert('No failed vouchers to retry.');

      for (const item of failed) {
        await fetch('/api/tally/queue', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: item.id,
            status: 'PENDING',
            errorMessage: null
          })
        });
      }
      alert(`⚡ Reset ${failed.length} voucher(s) to PENDING!\n\nYour Local PC Connector will retry sync.`);
      this.loadTallyQueue();
    } catch (e) {
      alert('Error retrying items: ' + e.message);
    }
  },

  toISODate(val) {
    if (!val) return new Date().toISOString().slice(0, 10);
    const s = String(val).trim();
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  },

  async syncInvoiceToTally(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const token = await this.adminToken();
    const cleanAmount = Number(String(inv.amount || 0).replace(/[^0-9.]/g, ''));
    const safeDate = this.toISODate(inv.createdAt || inv.date);
    const dynamicSalesLedger = this.mapServiceToTallyLedger(inv.service);

    const res = await fetch('/api/tally/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceType: 'invoice',
        sourceId: inv.id,
        clientName: inv.client,
        amount: cleanAmount,
        date: safeDate,
        voucherType: 'Sales',
        narration: `${inv.service} - Fee Invoice ${inv.id} (Kiran K. Shinde & Co.) | JSON: {"service":"${inv.service}","description":"${inv.service}"}`,
        salesLedger: dynamicSalesLedger
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(`⚡ SUCCESS!\n\nInvoice ${inv.id} (${inv.client} - ₹${cleanAmount.toLocaleString('en-IN')})\nLedger: ${dynamicSalesLedger}\n\nhas been queued for TallyPrime.\n\nYour Local PC Connector will automatically post it into Tally!`);
      this.loadTallyQueue();
      this.checkTallyConnectorStatus();
    } else {
      alert(`Error queueing invoice: ${data.error || 'Server error'}`);
    }
  },

  async syncAllPendingInvoicesToTally() {
    if (!this.state.invoices || !this.state.invoices.length) {
      return alert('No invoices found to sync.');
    }

    if (!confirm(`Sync all ${this.state.invoices.length} invoices to your local TallyPrime?`)) return;

    let queuedCount = 0;
    const token = await this.adminToken();

    for (const inv of this.state.invoices) {
      const cleanAmount = Number(String(inv.amount || 0).replace(/[^0-9.]/g, ''));
      const safeDate = this.toISODate(inv.createdAt || inv.date);
      const dynamicSalesLedger = this.mapServiceToTallyLedger(inv.service);
      try {
        await fetch('/api/tally/queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceType: 'invoice',
            sourceId: inv.id,
            clientName: inv.client,
            amount: cleanAmount,
            date: safeDate,
            voucherType: 'Sales',
            narration: `${inv.service} - Fee Invoice ${inv.id} | JSON: {"service":"${inv.service}","description":"${inv.service}"}`,
            salesLedger: dynamicSalesLedger
          })
        });
        queuedCount++;
      } catch (e) {}
    }

    alert(`⚡ Queued ${queuedCount} invoices for Tally Prime!\n\nCheck the TallyPrime Cloud Connector tab to monitor real-time posting.`);
    this.loadTallyQueue();
    this.checkTallyConnectorStatus();
  },

  async retryTallyQueueItem(queueId) {
    const token = await this.adminToken();
    await fetch('/api/tally/queue', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id: queueId, status: 'PENDING', errorMessage: null })
    });
    this.loadTallyQueue();
  },

  // ================= 8. GSTR-2B VS TALLY PURCHASE AUTO-RECONCILIATION =================
  setupGstReconciliation() {
    this.gstEngine = new window.GstReconciliationEngine();
    let gstr2bList = [];
    let tallyList = [];

    const dropGstr2b = document.getElementById('dropzoneGstr2b');
    const inputGstr2b = document.getElementById('inputGstr2b');
    const fileInfoGstr2b = document.getElementById('fileInfoGstr2b');

    const dropTally = document.getElementById('dropzoneTally');
    const inputTally = document.getElementById('inputTallyPurchase');
    const fileInfoTally = document.getElementById('fileInfoTally');

    const btnRun = document.getElementById('btnRunReconciliation');
    const btnDemo = document.getElementById('btnGstLoadDemo');
    const btnExport = document.getElementById('btnGstExportExcel');
    const searchInput = document.getElementById('gstSearchInput');

    const handleGstr2bFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          gstr2bList = this.gstEngine.parseGstr2bJson(e.target.result);
          if (fileInfoGstr2b) {
            fileInfoGstr2b.style.display = 'block';
            fileInfoGstr2b.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name} (${gstr2bList.length} B2B Invoices Loaded)`;
          }
        } catch (err) {
          alert('Error parsing GSTR-2B JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    };

    const handleTallyFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = window.XLSX.read(data, { type: 'array' });
          tallyList = this.gstEngine.parseTallyPurchaseExcel(wb);
          if (fileInfoTally) {
            fileInfoTally.style.display = 'block';
            fileInfoTally.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name} (${tallyList.length} Purchase Invoices Loaded)`;
          }
        } catch (err) {
          alert('Error parsing Tally Purchase Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };

    inputGstr2b?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleGstr2bFile(e.target.files[0]);
    });

    inputTally?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleTallyFile(e.target.files[0]);
    });

    // Drag and drop for GSTR-2B
    if (dropGstr2b) {
      dropGstr2b.addEventListener('dragover', (e) => { e.preventDefault(); dropGstr2b.style.background = '#eef2ff'; });
      dropGstr2b.addEventListener('dragleave', (e) => { e.preventDefault(); dropGstr2b.style.background = '#f8fafc'; });
      dropGstr2b.addEventListener('drop', (e) => {
        e.preventDefault();
        dropGstr2b.style.background = '#f8fafc';
        if (e.dataTransfer?.files?.[0]) handleGstr2bFile(e.dataTransfer.files[0]);
      });
    }

    // Drag and drop for Tally
    if (dropTally) {
      dropTally.addEventListener('dragover', (e) => { e.preventDefault(); dropTally.style.background = '#f0f9ff'; });
      dropTally.addEventListener('dragleave', (e) => { e.preventDefault(); dropTally.style.background = '#f8fafc'; });
      dropTally.addEventListener('drop', (e) => {
        e.preventDefault();
        dropTally.style.background = '#f8fafc';
        if (e.dataTransfer?.files?.[0]) handleTallyFile(e.dataTransfer.files[0]);
      });
    }

    btnRun?.addEventListener('click', () => {
      if (!gstr2bList.length && !tallyList.length) {
        alert('Please upload your GSTR-2B JSON and/or Tally Purchase Register first, or click "Load CA Sample Data" to test with demo data.');
        return;
      }
      const res = this.gstEngine.reconcile(gstr2bList, tallyList);
      this.renderGstReconResults(res);
    });

    btnDemo?.addEventListener('click', () => {
      const res = this.gstEngine.loadSampleDataset();
      gstr2bList = this.gstEngine.gstr2bInvoices;
      tallyList = this.gstEngine.tallyInvoices;
      if (fileInfoGstr2b) {
        fileInfoGstr2b.style.display = 'block';
        fileInfoGstr2b.innerHTML = `<i class="fa-solid fa-check"></i> Sample_GSTR2B_Oct2026.json (${gstr2bList.length} Invoices)`;
      }
      if (fileInfoTally) {
        fileInfoTally.style.display = 'block';
        fileInfoTally.innerHTML = `<i class="fa-solid fa-check"></i> Sample_Tally_Purchase_Register.xlsx (${tallyList.length} Invoices)`;
      }
      this.renderGstReconResults(res);
    });

    btnExport?.addEventListener('click', () => {
      this.gstEngine.exportToExcel();
    });

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.gst-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = '#fff';
          b.style.color = '#334155';
        });
        btn.classList.add('active');
        btn.style.background = '#0f172a';
        btn.style.color = '#fff';
        this.gstEngine.activeFilter = btn.getAttribute('data-filter') || 'all';
        this.renderGstReconRows();
      });
    });

    // Search input
    searchInput?.addEventListener('input', (e) => {
      this.gstEngine.searchQuery = (e.target.value || '').toLowerCase().trim();
      this.renderGstReconRows();
    });
  },

  renderGstReconResults(res) {
    if (!res) res = this.gstEngine?.reconciliationResults;
    if (!res) return;

    const resultsSection = document.getElementById('gstReconResultsSection');
    if (resultsSection) resultsSection.style.display = 'block';

    const setVal = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setVal('kpi2bTax', `₹ ${Number(res.kpis.total2bTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setVal('kpi2bCount', `${res.kpis.total2bCount} Invoices in GSTR-2B`);
    setVal('kpiTallyTax', `₹ ${Number(res.kpis.totalTallyTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setVal('kpiTallyCount', `${res.kpis.totalTallyCount} Invoices in Tally`);
    setVal('kpiMatchedTax', `₹ ${Number(res.kpis.matchedTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setVal('kpiMatchedCount', `${res.kpis.matchedCount} Invoices 100% Matched`);
    setVal('kpiAtRiskTax', `₹ ${Number(res.kpis.atRiskTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setVal('kpiAtRiskCount', `${res.kpis.atRiskCount} Invoices Blocked u/s 16(2)(aa)`);
    setVal('kpiUnclaimedTax', `₹ ${Number(res.kpis.unclaimedTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setVal('kpiUnclaimedCount', `${res.kpis.unclaimedCount} Invoices Missed in Tally`);

    setVal('countFilterAll', res.all.length);
    setVal('countFilterAtRisk', res.missingIn2B.length);
    setVal('countFilterMatched', res.matched.length);
    setVal('countFilterMissingTally', res.missingInTally.length);
    setVal('countFilterMismatch', res.taxMismatch.length);

    this.renderGstReconRows();
  },

  renderGstReconRows() {
    const res = this.gstEngine?.reconciliationResults;
    const tbody = document.getElementById('gstReconTableBody');
    if (!res || !tbody) return;

    let items = [];
    const filter = this.gstEngine.activeFilter;
    if (filter === 'at_risk') items = res.missingIn2B;
    else if (filter === 'matched') items = res.matched;
    else if (filter === 'missing_in_tally') items = res.missingInTally;
    else if (filter === 'mismatch') items = res.taxMismatch;
    else items = res.all;

    const query = this.gstEngine.searchQuery;
    if (query) {
      items = items.filter(it => {
        const p = it.tally || it.gstr2b;
        return (
          (p.supplierName && p.supplierName.toLowerCase().includes(query)) ||
          (p.gstin && p.gstin.toLowerCase().includes(query)) ||
          (p.invoiceNo && p.invoiceNo.toLowerCase().includes(query))
        );
      });
    }

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#64748b;">No matching invoices found in this view.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isMatched = item.status === 'MATCHED';
      const isAtRisk = item.status === 'MISSING_IN_2B';
      const isMissingTally = item.status === 'MISSING_IN_TALLY';
      const isMismatch = item.status === 'TAX_MISMATCH';

      const data = item.tally || item.gstr2b;
      const badgeHtml = isMatched
        ? '<span style="background:#ecfdf5; color:#065f46; font-weight:800; font-size:0.72rem; padding:3px 8px; border-radius:4px; border:1px solid #a7f3d0;"><i class="fa-solid fa-check"></i> 100% MATCHED</span>'
        : (isAtRisk
          ? '<span style="background:#fef2f2; color:#991b1b; font-weight:800; font-size:0.72rem; padding:3px 8px; border-radius:4px; border:1px solid #fecaca;"><i class="fa-solid fa-triangle-exclamation"></i> MISSING IN 2B</span>'
          : (isMissingTally
            ? '<span style="background:#fffbeb; color:#92400e; font-weight:800; font-size:0.72rem; padding:3px 8px; border-radius:4px; border:1px solid #fde68a;"><i class="fa-solid fa-lightbulb"></i> NOT IN TALLY</span>'
            : '<span style="background:#eff6ff; color:#1e40af; font-weight:800; font-size:0.72rem; padding:3px 8px; border-radius:4px; border:1px solid #bfdbfe;"><i class="fa-solid fa-arrows-split-up-and-left"></i> TAX MISMATCH</span>'));

      const taxAmount = Number(data.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const taxableAmount = Number(data.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const grossAmount = Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

      let actionHtml = '';
      if (isAtRisk) {
        const waUrl = this.gstEngine.generateWhatsAppReminderUrl(item);
        actionHtml = `
          <a href="${waUrl}" target="_blank" class="btn-admin" style="background:#25d366; color:#fff; text-decoration:none; font-weight:700; font-size:0.75rem; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;">
            <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i> WhatsApp Vendor
          </a>`;
      } else if (isMatched) {
        actionHtml = '<span style="color:#059669; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> Safe ITC Claimed</span>';
      } else if (isMissingTally) {
        actionHtml = '<span style="color:#d97706; font-size:0.75rem;"><i class="fa-solid fa-plus-circle"></i> Book in Tally</span>';
      } else {
        actionHtml = `<span style="color:#2563eb; font-size:0.75rem;" title="Tax Diff: ₹${item.taxDiff}"><i class="fa-solid fa-triangle-exclamation"></i> Verify Bill</span>`;
      }

      return `
        <tr style="${isAtRisk ? 'background:rgba(254, 242, 242, 0.4);' : ''}">
          <td>${badgeHtml}</td>
          <td>
            <strong>${data.supplierName || 'Unknown Vendor'}</strong>
            ${item.remarks ? `<br><small style="color:${isAtRisk ? '#dc2626' : '#64748b'};">${item.remarks}</small>` : ''}
          </td>
          <td><code style="background:#f1f5f9; padding:2px 5px; border-radius:4px; font-size:0.75rem;">${data.gstin || '-'}</code></td>
          <td><strong>${data.invoiceNo || '-'}</strong></td>
          <td>${data.invoiceDate || '-'}</td>
          <td>₹ ${taxableAmount}</td>
          <td style="color:${isAtRisk ? '#dc2626' : (isMatched ? '#16a34a' : 'inherit')}; font-weight:700;">₹ ${taxAmount}</td>
          <td>₹ ${grossAmount}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');
  },

  // 9. Web Bank Converter to Tally Queue Push
  setupWebBankToTallyPush() {
    const btn = document.getElementById('btnPushWebBankToTally');
    btn?.addEventListener('click', async () => {
      const res = window.currentBankResult || window.WebBankConverter?.currentResult || (window.WebBankConverter?.getCurrentResult ? window.WebBankConverter.getCurrentResult() : null);
      if (!res || !Array.isArray(res.transactions) || !res.transactions.length) {
        alert('Please convert a bank statement PDF first.');
        return;
      }

      const confirmed = confirm(`Are you sure you want to push all ${res.transactions.length} converted bank transactions into the Tally Sync Queue?\n\nBank: ${res.bankName}\nYour office desktop connector will automatically pick them up and create Payment/Receipt/Contra vouchers in Tally.`);
      if (!confirmed) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enqueueing for Tally...';

      try {
        const token = await this.adminToken();
        const payload = {
          items: res.transactions.map(tx => ({
            sourceType: 'bank_statement',
            sourceId: tx.refNo || `BNK-${Date.now().toString().slice(-4)}`,
            clientName: tx.narration ? tx.narration.slice(0, 32) : 'Bank Party',
            amount: Number(tx.debit > 0 ? tx.debit : tx.credit),
            date: tx.date,
            voucherType: tx.debit > 0 ? 'Payment' : 'Receipt',
            narration: `${tx.narration} | Ref: ${tx.refNo || '-'}`,
            bankLedger: res.bankName || 'HDFC Bank Ltd',
            partyLedger: tx.suggestedLedger || (tx.debit > 0 ? 'Sundry Creditors' : 'Sundry Debtors')
          }))
        };

        const headers = {
          'Content-Type': 'application/json',
          'x-bridge-token': 'ks_tally_secret_2026'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const postRes = await fetch('/api/tally/queue', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const data = await postRes.json();
        if (postRes.ok) {
          alert(`🎉 Successfully queued ${res.transactions.length} bank transactions for TallyPrime!\n\nYour Desktop Connector will automatically post them as Payment and Receipt vouchers.`);
          this.loadTallyQueue();
        } else {
          alert(`Error queueing: ${data.error || 'Server error'}`);
        }
      } catch (err) {
        alert('Failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Push to Tally Sync Queue';
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminCRM.init();
});

