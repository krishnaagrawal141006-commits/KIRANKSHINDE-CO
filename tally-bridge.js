const http = require('http');

const bridgePort = Number(process.env.TALLY_BRIDGE_PORT || 9100);
const tallyUrl = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || '';

function xmlEscape(value = '') {
  return String(value).replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
}

function postToTally(xml) {
  return new Promise((resolve, reject) => {
    const target = new URL(tallyUrl);
    const request = http.request({ hostname: target.hostname, port: target.port || 80, path: target.pathname || '/', method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; }); response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject); request.write(xml); request.end();
  });
}

function invoiceXml(invoice) {
  const date = String(invoice.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const amount = Number(invoice.amount || 0).toFixed(2);
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA><TALLYMESSAGE><VOUCHER VCHTYPE="Sales" ACTION="Create"><DATE>${xmlEscape(date)}</DATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><PARTYLEDGERNAME>${xmlEscape(invoice.customer)}</PARTYLEDGERNAME><PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><ALLLEDGERENTRIES.LIST><LEDGERNAME>${xmlEscape(invoice.customer)}</LEDGERNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT></ALLLEDGERENTRIES.LIST><ALLLEDGERENTRIES.LIST><LEDGERNAME>${xmlEscape(invoice.salesLedger || 'Sales')}</LEDGERNAME><ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE><AMOUNT>-${amount}</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ bridge: 'online', tallyUrl })); return; }
  if (req.url === '/create-invoice' && req.method === 'POST') {
    if (!bridgeToken || req.headers.authorization !== `Bearer ${bridgeToken}`) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Bridge authentication required' })); return; }
    let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', async () => {
      try { const invoice = JSON.parse(raw || '{}'); if (!invoice.customer || !invoice.amount) throw new Error('customer and amount are required'); const result = await postToTally(invoiceXml(invoice)); res.writeHead(result.status === 200 ? 200 : 502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: result.status === 200, tallyStatus: result.status, response: result.body.slice(0, 2000) })); }
      catch (error) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: error.message })); }
    }); return;
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(bridgePort, '127.0.0.1', () => console.log(`Tally bridge listening at http://127.0.0.1:${bridgePort} → ${tallyUrl}`));
