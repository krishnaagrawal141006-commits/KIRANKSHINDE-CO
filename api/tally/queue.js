// API Endpoint: /api/tally/queue
// Manages the Tally Prime Cloud Sync Queue

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const allowedMethods = ['GET', 'POST', 'PATCH'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || 'ks_tally_secret_2026';

  // Authentication: Accept either Bearer JWT from Admin login OR x-bridge-token from Local PC connector
  const authHeader = req.headers.authorization || '';
  const xBridgeToken = req.headers['x-bridge-token'] || req.query.token || '';
  const isConnector = xBridgeToken === bridgeToken;

  let isAdmin = false;
  if (authHeader.startsWith('Bearer ')) {
    const checkToken = authHeader.replace('Bearer ', '').trim();
    if (checkToken === bridgeToken) {
      isAdmin = true;
    } else if (url && anon) {
      const authRes = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: authHeader }
      });
      if (authRes.ok) isAdmin = true;
    }
  }

  if (!isConnector && !isAdmin) {
    return res.status(401).json({ error: 'Authentication required (Admin token or Bridge token)' });
  }

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase configuration missing on server' });
  }

  // --- GET: Fetch Sync Queue ---
  if (req.method === 'GET') {
    const statusFilter = req.query.status;
    let endpoint = `${url}/rest/v1/tally_sync_queue?select=*&order=created_at.desc&limit=50`;
    if (statusFilter === 'pending') {
      endpoint = `${url}/rest/v1/tally_sync_queue?select=*&status=eq.PENDING&order=created_at.asc&limit=20`;
    }

    try {
      const r = await fetch(endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      if (!r.ok) {
        // Table might not be created yet in Supabase
        const errText = await r.text();
        return res.status(200).json({
          queue: [],
          notice: 'Table tally_sync_queue not initialized or empty',
          details: errText
        });
      }
      const data = await r.json();
      return res.status(200).json({ queue: Array.isArray(data) ? data : [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- POST: Enqueue new invoice/voucher to sync ---
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const clientName = String(body.clientName || body.client || '').trim();
    const amount = Number(body.amount || 0);

    if (!clientName || !amount) {
      return res.status(400).json({ error: 'clientName and amount are required' });
    }

    const row = {
      source_type: body.sourceType || 'invoice',
      source_id: body.sourceId || body.id || null,
      client_name: clientName,
      voucher_type: body.voucherType || 'Sales',
      amount: amount,
      date: body.date || new Date().toISOString().slice(0, 10),
      narration: body.narration || `Professional Fees - ${clientName}`,
      sales_ledger: body.salesLedger || 'Professional Fees Account',
      party_ledger: body.partyLedger || clientName,
      status: 'PENDING',
      error_message: null
    };

    try {
      const r = await fetch(`${url}/rest/v1/tally_sync_queue`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(row)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(r.status).json({ error: data.message || 'Failed to enqueue for Tally' });
      }
      return res.status(201).json({ ok: true, queued: data[0] || row });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- PATCH: Update sync status from Connector ---
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Queue item id required' });

    const updateFields = {
      status: body.status || 'SYNCED', // 'SYNCED' or 'FAILED'
      tally_voucher_no: body.tallyVoucherNo || null,
      error_message: body.errorMessage || null,
      synced_at: body.status === 'SYNCED' ? new Date().toISOString() : null
    };

    try {
      const r = await fetch(`${url}/rest/v1/tally_sync_queue?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(updateFields)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(r.status).json({ error: data.message || 'Failed to update queue item' });
      }
      return res.status(200).json({ ok: true, updated: data[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
};
