module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const auth = req.headers.authorization || '';

  if (!url || !key || !anon || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Main Admin login required' });
  }

  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!check.ok) return res.status(401).json({ error: 'Admin session expired' });
  const admin = await check.json();
  if (admins.length && !admins.includes(String(admin.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Only Main Admin can view tasks' });
  }

  try {
    const tasksRes = await fetch(`${url}/rest/v1/compliance_tasks?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const tasksData = await tasksRes.json().catch(() => []);

    const clientsRes = await fetch(`${url}/rest/v1/clients?select=id,name`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const clientsData = await clientsRes.json().catch(() => []);
    const clientMap = {};
    if (Array.isArray(clientsData)) {
      clientsData.forEach(c => { clientMap[c.id] = c.name; });
    }

    const tasks = (Array.isArray(tasksData) ? tasksData : []).map(t => ({
      id: t.id,
      clientId: t.client_id,
      client: clientMap[t.client_id] || t.client_id || 'Client',
      taskName: t.task_name,
      assigned: t.assigned_employee_email || 'Unassigned',
      assignedEmail: t.assigned_employee_email || '',
      stage: t.stage || 'todo',
      dueDate: t.due_date || 'To be scheduled',
      remarks: Array.isArray(t.remarks) ? t.remarks : [],
      tag: 'tag-gst',
      createdAt: t.created_at
    }));

    return res.status(200).json({ tasks });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to list tasks' });
  }
};

