module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const allowed = ['GET', 'POST', 'PATCH', 'DELETE'];
  if (!allowed.includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

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
    return res.status(403).json({ error: 'Only Main Admin can manage compliance deadlines' });
  }

  // --- DELETE ---
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Deadline ID required' });
    const response = await fetch(`${url}/rest/v1/compliance_deadlines?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: result.message || 'Could not delete deadline' });
    }
    return res.status(200).json({ ok: true });
  }

  // --- POST (Create) ---
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = String(body.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id || !body.title || !body.category) {
      return res.status(400).json({ error: 'ID, title and category are required' });
    }
    const row = {
      id,
      category: body.category,
      category_label: body.category_label || body.category,
      category_class: body.category_class || 'cat-it',
      title: body.title,
      description: body.description || '',
      frequency: body.frequency || 'annual',
      due_day: body.due_day ? Number(body.due_day) : null,
      due_date: body.due_date || null,
      due_date_label: body.due_date_label || null,
      action_text: body.action_text || 'View compliance',
      source_url: body.source_url || null,
      is_active: body.is_active !== false,
      updated_at: new Date().toISOString()
    };
    const response = await fetch(`${url}/rest/v1/compliance_deadlines`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: result.message || 'Could not create deadline' });
    return res.status(201).json({ deadline: result[0] || row });
  }

  // --- PATCH (Update) ---
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.id) return res.status(400).json({ error: 'Deadline ID required' });
    const patch = {
      title: body.title,
      description: body.description,
      category: body.category,
      category_label: body.category_label,
      category_class: body.category_class,
      frequency: body.frequency,
      due_day: body.due_day ? Number(body.due_day) : null,
      due_date: body.due_date || null,
      due_date_label: body.due_date_label || null,
      action_text: body.action_text,
      source_url: body.source_url || null,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
      updated_at: new Date().toISOString()
    };
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    const response = await fetch(`${url}/rest/v1/compliance_deadlines?id=eq.${encodeURIComponent(body.id)}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: result.message || 'Could not update deadline' });
    return res.status(200).json({ deadline: result[0] || patch });
  }

  // --- GET ---
  const list = await fetch(`${url}/rest/v1/compliance_deadlines?select=*&order=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const data = await list.json().catch(() => []);
  return res.status(200).json({ deadlines: data });
};

