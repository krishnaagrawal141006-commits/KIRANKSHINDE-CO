// Consolidated Tally API Handler (Queue + Heartbeat)
// Keeps total serverless functions below Vercel Hobby limits

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || 'ks_tally_secret_2026';

  const action = req.query.action || (req.url.includes('heartbeat') ? 'heartbeat' : 'queue');

  // ================= 1. HEARTBEAT ACTION =================
  if (action === 'heartbeat') {
    if (req.method === 'POST') {
      const xBridgeToken = req.headers['x-bridge-token'] || req.query.token || '';
      if (xBridgeToken !== bridgeToken) {
        return res.status(401).json({ error: 'Invalid bridge token' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const heartbeatRow = {
        id: 'primary_pc',
        connector_name: body.connectorName || 'Office Main PC',
        tally_online: Boolean(body.tallyOnline),
        company_name: body.companyName || 'Not Opened',
        tally_version: body.tallyVersion || 'TallyPrime',
        last_heartbeat: new Date().toISOString(),
        ip_info: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'
      };

      try {
        if (!url || !key) return res.status(200).json({ ok: true, memoryOnly: true });

        // First try PATCH to update existing record
        const patchRes = await fetch(`${url}/rest/v1/tally_connector_heartbeat?id=eq.primary_pc`, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(heartbeatRow)
        });

        const patchRows = await patchRes.json().catch(() => []);
        if (!patchRes.ok || !Array.isArray(patchRows) || !patchRows.length) {
          // If record does not exist yet, upsert with on_conflict=id
          await fetch(`${url}/rest/v1/tally_connector_heartbeat?on_conflict=id`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates'
            },
            body: JSON.stringify(heartbeatRow)
          });
        }

        return res.status(200).json({ ok: true, received: heartbeatRow.last_heartbeat });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === 'GET') {
      try {
        if (!url || !key) return res.status(200).json({ online: false, statusText: 'Supabase unconfigured' });
        const r = await fetch(`${url}/rest/v1/tally_connector_heartbeat?id=eq.primary_pc`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        const rows = await r.json().catch(() => []);
        const record = Array.isArray(rows) && rows[0] ? rows[0] : null;

        if (!record || !record.last_heartbeat) {
          return res.status(200).json({ online: false, statusText: 'Connector Not Started', details: null });
        }

        const diffSeconds = (Date.now() - new Date(record.last_heartbeat).getTime()) / 1000;
        // Increased threshold to 75 seconds so normal network jitter or sync operations don't falsely show offline
        const isOnline = diffSeconds <= 75;

        return res.status(200).json({
          online: isOnline,
          lastSeenSecondsAgo: Math.max(0, Math.round(diffSeconds)),
          tallyOnline: record.tally_online,
          companyName: record.company_name,
          tallyVersion: record.tally_version,
          connectorName: record.connector_name,
          lastHeartbeat: record.last_heartbeat
        });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed for heartbeat' });
  }

  // ================= 2. QUEUE ACTION =================
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
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  // GET: Sync queue
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
        return res.status(200).json({ queue: [], notice: 'Table empty or pending initialization' });
      }
      const data = await r.json();
      return res.status(200).json({ queue: Array.isArray(data) ? data : [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: Enqueue new invoice/voucher
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
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: data.message || 'Failed to enqueue for Tally' });
      return res.status(201).json({ ok: true, queued: data[0] || row });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH: Update item status from Connector
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Queue item id required' });

    const updateFields = {
      status: body.status || 'SYNCED',
      tally_voucher_no: body.tallyVoucherNo || null,
      error_message: body.errorMessage || null,
      synced_at: body.status === 'SYNCED' ? new Date().toISOString() : null
    };

    try {
      const r = await fetch(`${url}/rest/v1/tally_sync_queue?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(updateFields)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: data.message || 'Failed to update queue item' });
      return res.status(200).json({ ok: true, updated: data[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

