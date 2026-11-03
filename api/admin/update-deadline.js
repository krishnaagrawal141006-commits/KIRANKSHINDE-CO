module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') { res.setHeader('Allow', 'PATCH'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!url || !serviceKey || !anonKey || !admins.length) return res.status(500).json({ error: 'Supabase admin configuration is incomplete' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Main Admin login required' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
  if (!check.ok) return res.status(401).json({ error: 'Main Admin session expired' });
  const user = await check.json();
  if (!admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'Only the Main Admin can edit deadlines' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const id = String(body.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Deadline id is required' });
  const fields = { title: body.title, description: body.description, due_date: body.due_date || null, due_date_label: body.due_date_label || null, is_active: body.is_active !== false, updated_at: new Date().toISOString() };
  const result = await fetch(`${url}/rest/v1/compliance_deadlines?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(fields) });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) return res.status(result.status).json({ error: data.message || 'Deadline update failed' });
  return res.status(200).json({ deadline: data[0] || null });
};
