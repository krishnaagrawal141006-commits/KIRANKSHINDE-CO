/* Main-admin-only employee provisioning endpoint.
 * The Supabase service key is used here on the server and is never sent to
 * the browser. Set SUPABASE_ADMIN_EMAILS to a comma-separated allow-list.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const allowedAdmins = String(process.env.SUPABASE_ADMIN_EMAILS || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!serviceKey || !supabaseUrl || !anonKey) return res.status(500).json({ error: 'Supabase server configuration is incomplete' });
  if (!allowedAdmins.length) return res.status(500).json({ error: 'Set SUPABASE_ADMIN_EMAILS in Vercel first' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Main Admin login required' });
  const adminCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader }
  });
  if (!adminCheck.ok) return res.status(401).json({ error: 'Main Admin session expired. Login again.' });
  const adminUser = await adminCheck.json();
  if (!allowedAdmins.includes(String(adminUser.email || '').toLowerCase())) return res.status(403).json({ error: 'Only the Main Admin can create employees' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password || password.length < 8) return res.status(400).json({ error: 'Valid email and password (minimum 8 characters) are required' });

  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: body.name || '', role: body.role || 'employee' } })
  });
  const result = await createResponse.json();
  if (!createResponse.ok) return res.status(createResponse.status).json({ error: result.msg || result.message || 'Could not create employee login' });
  return res.status(201).json({ userId: result.id, email: result.email });
};
