module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') { res.setHeader('Allow', 'DELETE'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const auth = req.headers.authorization || ''; if (!url || !serviceKey || !anonKey || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Main Admin login required' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } }); if (!check.ok) return res.status(401).json({ error: 'Main Admin session expired' });
  const user = await check.json(); if (admins.length && !admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'Only the Main Admin can delete deadlines' });
  const id = String(req.query?.id || '').trim(); if (!id) return res.status(400).json({ error: 'Deadline id is required' });
  const result = await fetch(`${url}/rest/v1/compliance_deadlines?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!result.ok) return res.status(result.status).json({ error: 'Deadline deletion failed' }); return res.status(204).end();
};
