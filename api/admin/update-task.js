module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.setHeader('Allow', 'PATCH, POST');
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
    return res.status(403).json({ error: 'Only Main Admin can update tasks' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!body.taskId) return res.status(400).json({ error: 'taskId is required' });

  const updateFields = {};
  if (body.stage) updateFields.stage = body.stage;
  if (body.assignedEmail) updateFields.assigned_employee_email = body.assignedEmail.toLowerCase();
  if (body.remarks) updateFields.remarks = body.remarks;

  // If a single remark is being added
  if (body.addRemark && typeof body.addRemark === 'object') {
    const getRes = await fetch(`${url}/rest/v1/compliance_tasks?id=eq.${encodeURIComponent(body.taskId)}&select=remarks`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const existing = await getRes.json().catch(() => ([]));
    let remarks = (existing && existing[0] && Array.isArray(existing[0].remarks)) ? existing[0].remarks : [];
    remarks.push(body.addRemark);
    updateFields.remarks = remarks;
  }

  const result = await fetch(`${url}/rest/v1/compliance_tasks?id=eq.${encodeURIComponent(body.taskId)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(updateFields)
  });

  const data = await result.json().catch(() => ({}));
  if (!result.ok) return res.status(result.status).json({ error: data.message || 'Task update failed' });
  return res.status(200).json({ task: data[0] || null });
};

