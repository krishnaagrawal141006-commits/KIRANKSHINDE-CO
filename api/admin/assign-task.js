module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean); const auth = req.headers.authorization || '';
  if (!url || !key || !anon || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Main Admin login required' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } }); if (!check.ok) return res.status(401).json({ error: 'Admin session expired' }); const admin = await check.json();
  if (admins.length && !admins.includes(String(admin.email || '').toLowerCase())) return res.status(403).json({ error: 'Only Main Admin can assign work' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); if (!body.taskId || !body.employeeEmail) return res.status(400).json({ error: 'Task and employee email are required' });
  
  // Format or sanitize due_date for SQL date column
  let dueDate = null;
  if (body.dueDate && !isNaN(Date.parse(body.dueDate))) {
    dueDate = new Date(body.dueDate).toISOString().split('T')[0];
  }

  const row = { id: String(body.taskId), client_id: String(body.clientId || 'UNASSIGNED'), task_name: body.taskName || 'Compliance task', assigned_employee_email: String(body.employeeEmail).toLowerCase(), stage: body.stage || 'todo', due_date: dueDate };
  const result = await fetch(`${url}/rest/v1/compliance_tasks`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) }); const data = await result.json().catch(() => ({})); if (!result.ok) return res.status(result.status).json({ error: data.message || 'Task sync failed' }); return res.status(200).json({ task: data[0] || null });
};
