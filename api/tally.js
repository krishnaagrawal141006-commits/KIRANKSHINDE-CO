// Consolidated Tally API Handler (Queue + Heartbeat)
// Keeps total serverless functions below Vercel Hobby limits

function toISODate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || 'ks_tally_secret_2026';

  const action = req.query.action || (req.url.includes('heartbeat') ? 'heartbeat' : (req.url.includes('whatsapp') ? 'whatsapp' : 'queue'));

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

  const referer = String(req.headers.referer || req.headers.origin || '');
  const isTrustedWeb = referer.includes('cakiran.co.in') ||
                       referer.includes('kirankshinde-co.vercel.app') ||
                       referer.includes('localhost') ||
                       referer.includes('127.0.0.1');

  let isAdmin = false;
  if (isTrustedWeb || isConnector) {
    isAdmin = true;
  } else if (authHeader.startsWith('Bearer ')) {
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

  // ================= 2B. WHATSAPP AUTO-DISPATCH QUEUE =================
  if (action === 'whatsapp' || action === 'whatsapp-queue') {
    if (req.method === 'GET') {
      const statusFilter = String(req.query.status || '').toLowerCase();
      let endpoint = `${url}/rest/v1/tally_sync_queue?select=*&source_type=eq.whatsapp&order=created_at.desc&limit=50`;
      if (statusFilter === 'pending') {
        endpoint = `${url}/rest/v1/tally_sync_queue?select=*&source_type=eq.whatsapp&status=eq.WA_PENDING&order=created_at.asc&limit=20`;
      }
      try {
        const r = await fetch(endpoint, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        if (!r.ok) {
          return res.status(200).json({ ok: true, queue: [] });
        }
        const rows = await r.json();
        const mapped = (Array.isArray(rows) ? rows : []).map(row => {
          let meta = {};
          const rawMeta = String(row.sales_ledger || '').trim();
          if (rawMeta.startsWith('{')) {
            try { meta = JSON.parse(rawMeta); } catch (_) {}
          }
          const amt = Number(row.amount || 0);
          return {
            id: row.id,
            phone: row.party_ledger || '',
            message: row.narration || '',
            clientName: row.client_name || '',
            invoiceId: row.source_id || '',
            amount: amt,
            service: meta.service || 'Statutory Compliance & CA Consultancy Fees',
            date: meta.date || row.date || '',
            voucherNo: meta.voucherNo || '',
            payLink: meta.payLink || (rawMeta.startsWith('http') ? rawMeta : ''),
            attachPdf: meta.attachPdf !== undefined ? Boolean(meta.attachPdf) : (amt > 0),
            pdfUrl: meta.payLink || rawMeta,
            status: row.status,
            sentBy: row.tally_voucher_no || null,
            errorMessage: row.error_message || null,
            createdAt: row.created_at,
            syncedAt: row.synced_at
          };
        });
        return res.status(200).json({ ok: true, queue: mapped });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      let phone = String(body.phone || '').replace(/[^0-9]/g, '');
      if (phone.length === 10) phone = '91' + phone;
      const message = String(body.message || '').trim();

      if (!phone || phone.length < 10) {
        return res.status(400).json({ error: 'Valid 10+ digit WhatsApp phone number required' });
      }
      if (!message) {
        return res.status(400).json({ error: 'WhatsApp message body is required' });
      }

      const amtNum = Number(String(body.amount || 0).replace(/[^0-9.]/g, '')) || 0;
      const attachPdf = body.attachPdf !== undefined ? Boolean(body.attachPdf) : (amtNum > 0);
      const metaPayload = JSON.stringify({
        payLink: String(body.pdfUrl || body.payLink || '').trim(),
        service: String(body.service || '').trim(),
        date: String(body.date || '').trim(),
        voucherNo: String(body.voucherNo || '').trim(),
        attachPdf
      });

      const row = {
        source_type: 'whatsapp',
        source_id: body.invoiceId || body.sourceId || `WA-${Date.now()}`,
        client_name: String(body.clientName || body.client || 'WhatsApp Client').trim(),
        voucher_type: 'WhatsApp',
        amount: amtNum,
        date: toISODate(new Date()),
        narration: message,
        sales_ledger: metaPayload,
        party_ledger: phone,
        status: 'WA_PENDING',
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
          return res.status(r.status).json({ error: data.message || 'Failed to queue WhatsApp dispatch' });
        }
        return res.status(201).json({ ok: true, queued: data[0] || row });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = body.id;
      if (!id) return res.status(400).json({ error: 'Queue item id required' });

      let finalStatus = String(body.status || 'WA_SENT').toUpperCase();
      if (finalStatus === 'SENT' || finalStatus === 'SYNCED') finalStatus = 'WA_SENT';
      if (finalStatus === 'FAILED') finalStatus = 'WA_FAILED';

      const updateFields = {
        status: finalStatus,
        tally_voucher_no: body.sentBy || 'Python WhatsApp Dispatcher',
        error_message: body.errorMessage || null,
        synced_at: finalStatus === 'WA_SENT' ? new Date().toISOString() : null
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
        if (!r.ok) return res.status(r.status).json({ error: data.message || 'Failed to update WhatsApp status' });
        return res.status(200).json({ ok: true, updated: data[0] || updateFields });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed for whatsapp queue' });
  }

  // GET: Sync queue
  if (req.method === 'GET') {
    const statusFilter = req.query.status;
    let endpoint = `${url}/rest/v1/tally_sync_queue?select=*&order=created_at.desc&limit=100`;
    if (statusFilter === 'pending') {
      endpoint = `${url}/rest/v1/tally_sync_queue?select=*&status=eq.PENDING&order=created_at.asc&limit=50`;
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

  // POST: Enqueue new invoice/voucher (Single or Batch)
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Batch Support for Bank Statements / Multi-Vouchers
    if (Array.isArray(body.items) && body.items.length) {
      const rows = body.items.map(item => {
        const clientName = String(item.clientName || item.client || item.partyLedger || item.suggestedLedger || 'Sundry Debtors').trim();
        const amount = Number(item.amount || (item.debit > 0 ? item.debit : item.credit) || 0);
        return {
          source_type: item.sourceType || 'bank_statement',
          source_id: item.sourceId || item.refNo || item.id || null,
          client_name: clientName,
          voucher_type: item.voucherType || (Number(item.debit || 0) > 0 ? 'Payment' : 'Receipt'),
          amount: amount,
          date: toISODate(item.date),
          narration: item.narration || 'Bank Transaction',
          sales_ledger: item.salesLedger || item.bankLedger || 'HDFC Bank Ltd',
          party_ledger: item.partyLedger || clientName,
          status: 'PENDING',
          error_message: null
        };
      }).filter(r => r.amount > 0);

      try {
        const r = await fetch(`${url}/rest/v1/tally_sync_queue`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(rows)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return res.status(r.status).json({ error: data.message || 'Failed to batch enqueue for Tally' });
        return res.status(201).json({ ok: true, queuedCount: rows.length, queued: data });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

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
      date: toISODate(body.date),
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

      const updatedItem = data && data[0] ? data[0] : null;

      // Write back to invoices table if source_id is present and status is SYNCED
      if (updatedItem && updatedItem.source_id && updatedItem.status === 'SYNCED') {
        try {
          await fetch(`${url}/rest/v1/invoices?id=eq.${encodeURIComponent(updatedItem.source_id)}`, {
            method: 'PATCH',
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tally_voucher_no: body.tallyVoucherNo || null,
              tally_status: 'SYNCED',
              tally_synced_at: new Date().toISOString()
            })
          }).catch(() => {});
        } catch (_) {}
      }

      return res.status(200).json({ ok: true, updated: updatedItem });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

