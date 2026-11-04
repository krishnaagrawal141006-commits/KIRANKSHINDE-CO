module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.setHeader('Allow', 'PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  const auth = req.headers.authorization || '';
  if (!url || !key || !anon || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Employee login required' });
  }

  const check = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!check.ok) return res.status(401).json({ error: 'Session expired' });
  const user = await check.json();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const stage = String(body.stage || '');
  if (!body.taskId || !['todo', 'in-progress', 'in-review', 'completed'].includes(stage)) {
    return res.status(400).json({ error: 'Valid taskId and stage are required' });
  }

  const updatePayload = { stage };

  // If employee sent a remark with this stage update
  if (body.remark && typeof body.remark === 'string' && body.remark.trim()) {
    const getRes = await fetch(`${url}/rest/v1/compliance_tasks?id=eq.${encodeURIComponent(body.taskId)}&select=remarks`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const existing = await getRes.json().catch(() => ([]));
    let remarks = (existing && existing[0] && Array.isArray(existing[0].remarks)) ? existing[0].remarks : [];
    const now = new Date();
    const timeStr = `${now.getDate()} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    remarks.push({
      author: user.user_metadata?.name || user.email?.split('@')[0] || 'Employee',
      time: timeStr,
      note: body.remark.trim()
    });
    updatePayload.remarks = remarks;
  }

  const result = await fetch(`${url}/rest/v1/compliance_tasks?id=eq.${encodeURIComponent(body.taskId)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(updatePayload)
  });

  const data = await result.json().catch(() => ({}));
  if (!result.ok) return res.status(result.status).json({ error: data.message || 'Task update failed' });
  return res.status(200).json({ task: data[0] || null });
};
