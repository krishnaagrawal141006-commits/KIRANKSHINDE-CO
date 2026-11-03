module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  const admins = String(process.env.SUPABASE_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean); const auth = req.headers.authorization || '';
  if (!url || !key || !anon || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Main Admin login required' });
  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } }); if (!check.ok) return res.status(401).json({ error: 'Admin session expired' }); const user = await check.json(); if (admins.length && !admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'Only Main Admin can upload documents' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); if (!body.clientId || !body.fileName || !body.dataBase64) return res.status(400).json({ error: 'Client, file name and file data are required' });
  const safeName = String(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${body.clientId}/${Date.now()}-${safeName}`; const bytes = Buffer.from(body.dataBase64, 'base64');
  const upload = await fetch(`${url}/storage/v1/object/client-documents/${encodeURIComponent(path)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': body.contentType || 'application/octet-stream', 'x-upsert': 'false' }, body: bytes }); const result = await upload.json().catch(() => ({})); if (!upload.ok) return res.status(upload.status).json({ error: result.message || 'Document upload failed' });
  const signed = await fetch(`${url}/storage/v1/object/sign/client-documents/${encodeURIComponent(path)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) }); const signedData = await signed.json().catch(() => ({}));
  return res.status(201).json({ path, signedUrl: signedData.signedURL ? `${url}/storage/v1${signedData.signedURL}` : null });
};
