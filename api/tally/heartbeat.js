// API Endpoint: /api/tally/heartbeat
// Tracks live connection status of the office PC running TallyPrime

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const allowedMethods = ['GET', 'POST'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || 'ks_tally_secret_2026';

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  // --- POST: Connector sends heartbeat every 10 seconds ---
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
      const r = await fetch(`${url}/rest/v1/tally_connector_heartbeat`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify(heartbeatRow)
      });
      return res.status(200).json({ ok: true, received: heartbeatRow.last_heartbeat });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- GET: Admin Panel checks if connector is currently online ---
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${url}/rest/v1/tally_connector_heartbeat?id=eq.primary_pc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      const rows = await r.json().catch(() => []);
      const record = Array.isArray(rows) && rows[0] ? rows[0] : null;

      if (!record || !record.last_heartbeat) {
        return res.status(200).json({
          online: false,
          statusText: 'Connector Not Started',
          details: null
        });
      }

      const diffSeconds = (Date.now() - new Date(record.last_heartbeat).getTime()) / 1000;
      const isOnline = diffSeconds <= 35; // consider online if heartbeat received within 35s

      return res.status(200).json({
        online: isOnline,
        lastSeenSecondsAgo: Math.round(diffSeconds),
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
};

