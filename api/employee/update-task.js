module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  const auth = req.headers.authorization || ''; if (!url || !key || !anon || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Employee login required' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } }); if (!check.ok) return res.status(401).json({ error: 'Session expired' });
  const user = await check.json(); const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); const stage = String(body.stage || '');
  if (!body.taskId || !['in-progress', 'completed', 'in-review'].includes(stage)) return res.status(400).json({ error: 'Invalid task update' });
  const result = await fetch(`${url}/rest/v1/compliance_tasks?id=eq.${encodeURIComponent(body.taskId)}&assigned_employee_email=eq.${encodeURIComponent(String(user.email).toLowerCase())}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ stage }) });
  const data = await result.json().catch(() => ({})); if (!result.ok) return res.status(result.status).json({ error: data.message || 'Task update failed' }); return res.status(200).json({ task: data[0] || null });
};
