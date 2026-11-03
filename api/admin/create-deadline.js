module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const auth = req.headers.authorization || '';
  if (!url || !serviceKey || !anonKey || !admins.length) return res.status(500).json({ error: 'Supabase admin configuration is incomplete' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
  if (!auth.startsWith('Bearer ') || !check.ok) return res.status(401).json({ error: 'Main Admin login required' });
  const user = await check.json(); if (!admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'Only the Main Admin can add deadlines' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const required = ['id', 'title', 'category', 'category_label'];
  if (required.some(key => !String(body[key] || '').trim())) return res.status(400).json({ error: 'ID, title, category and category label are required' });
  const row = { id: String(body.id).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'), category: body.category, category_label: body.category_label, category_class: body.category_class || 'cat-it', title: body.title, description: body.description || '', frequency: body.frequency || 'annual', due_day: body.due_day ? Number(body.due_day) : null, due_date: body.due_date || null, due_date_label: body.due_date_label || null, action_text: body.action_text || 'View compliance', source_url: body.source_url || null, is_active: body.is_active !== false };
  const result = await fetch(`${url}/rest/v1/compliance_deadlines`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
  const data = await result.json().catch(() => ({})); if (!result.ok) return res.status(result.status).json({ error: data.message || 'Deadline creation failed' });
  return res.status(201).json({ deadline: data[0] || null });
};
