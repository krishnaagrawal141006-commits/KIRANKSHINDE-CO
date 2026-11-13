/**
 * ==============================================================================
 *  KIRAN K. SHINDE & CO. — TALLYPRIME CLOUD CONNECTOR (v1.2)
 *  Smart Auto-Sync Bridge between Cloud Website & Local Office TallyPrime
 *  Features:
 *    - Auto Master Ledger Creation (Sundry Debtors & Direct Income)
 *    - Auto Financial Year & Educational Mode Date Compatibility
 *    - Detailed Error Diagnostics & Real-time Cloud Reporting
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load configuration
let config = {
  siteUrl: "https://kirankshinde-co.vercel.app",
  bridgeToken: "ks_tally_secret_2026",
  tallyUrl: "http://127.0.0.1:9000",
  pollIntervalSeconds: 4
};

const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...userConfig };
  } catch (e) {
    console.error('Error reading config.json, using defaults.');
  }
}

// Override via environment variables if provided
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;
if (process.env.TALLY_BRIDGE_TOKEN) config.bridgeToken = process.env.TALLY_BRIDGE_TOKEN;
if (process.env.TALLY_URL) config.tallyUrl = process.env.TALLY_URL;

function xmlEscape(val = '') {
  return String(val).replace(/[<>&'"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[ch]));
}

// Helper: HTTP/HTTPS fetch
function request(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(reqOptions, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

// 1. Check TallyPrime Status and Get Current Active Company + Period
async function getTallyActiveCompany() {
  const testXml = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
      <EXPORTDATA>
        <REQUESTDESC>
          <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
          <REPORTNAME>List of Companies</REPORTNAME>
        </REQUESTDESC>
      </EXPORTDATA>
    </BODY>
  </ENVELOPE>`;

  try {
    const res = await request(config.tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(testXml)
      }
    }, testXml);

    if (res.statusCode === 200 && res.body) {
      const match = res.body.match(/<COMPANYNAME>(.*?)<\/COMPANYNAME>/i) ||
                    res.body.match(/<NAME>(.*?)<\/NAME>/i);
      const company = match ? match[1].trim() : 'Company Active';

      const startMatch = res.body.match(/<STARTINGFROM>(.*?)<\/STARTINGFROM>/i);
      const endMatch = res.body.match(/<ENDINGAT>(.*?)<\/ENDINGAT>/i);
      const startingFrom = startMatch ? startMatch[1].trim() : null;
      const endingAt = endMatch ? endMatch[1].trim() : null;

      let startingYear = startingFrom && startingFrom.length >= 4 ? parseInt(startingFrom.slice(0, 4), 10) : null;
      let endingYear = endingAt && endingAt.length >= 4 ? parseInt(endingAt.slice(0, 4), 10) : null;

      return {
        online: true,
        company,
        version: 'TallyPrime',
        startingFrom,
        endingAt,
        startingYear,
        endingYear
      };
    }
    return { online: false, company: null, error: `HTTP ${res.statusCode}` };
  } catch (err) {
    return { online: false, company: null, error: err.message };
  }
}

// 2. Auto-Create Master Ledgers in Tally (Sundry Debtors & Direct Incomes)
async function ensureTallyLedgersExist(partyName, salesLedgerName) {
  const party = xmlEscape(partyName || 'Sundry Debtors');
  const sales = xmlEscape(salesLedgerName || 'Professional Fees Account');

  const masterXml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${party}" ACTION="Create">
            <NAME.LIST>
              <NAME>${party}</NAME>
            </NAME.LIST>
            <PARENT>Sundry Debtors</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
            <AFFECTSSTOCK>No</AFFECTSSTOCK>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>
          <LEDGER NAME="${sales}" ACTION="Create">
            <NAME.LIST>
              <NAME>${sales}</NAME>
            </NAME.LIST>
            <PARENT>Direct Incomes</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
            <AFFECTSSTOCK>No</AFFECTSSTOCK>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await request(config.tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(masterXml)
      }
    }, masterXml);
    return res.body || '';
  } catch (e) {
    console.warn(`  [WARN] Master ledger check skipped: ${e.message}`);
    return null;
  }
}

// 3. Smart Date Parser (Compatible with Tally Financial Year & Educational Mode)
function parseToTallyDate(dateVal, companyInfo = null, forceEducationalDay = false) {
  let y, m, d;
  const str = String(dateVal || '').trim();

  if (str.includes('/')) {
    // DD/MM/YYYY or D/M/YYYY
    const parts = str.split('/');
    if (parts.length === 3) {
      d = parts[0].padStart(2, '0');
      m = parts[1].padStart(2, '0');
      y = parts[2].trim();
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        y = parts[0];
        m = parts[1].padStart(2, '0');
        d = parts[2].padStart(2, '0');
      } else {
        // DD-MM-YYYY
        d = parts[0].padStart(2, '0');
        m = parts[1].padStart(2, '0');
        y = parts[2];
      }
    }
  }

  // Fallback to today if unparsed
  if (!y || !m || !d || isNaN(parseInt(y, 10)) || isNaN(parseInt(m, 10)) || isNaN(parseInt(d, 10))) {
    const now = new Date();
    y = String(now.getFullYear());
    m = String(now.getMonth() + 1).padStart(2, '0');
    d = String(now.getDate()).padStart(2, '0');
  }

  // Adjust year if outside Tally company's active financial year
  if (companyInfo && companyInfo.startingYear && companyInfo.endingYear) {
    const numY = parseInt(y, 10);
    if (numY < companyInfo.startingYear || numY > companyInfo.endingYear) {
      y = String(companyInfo.startingYear);
    }
  }

  // If forced for Educational Mode compatibility (Tally Edu only allows 01, 02, 31)
  if (forceEducationalDay) {
    d = '01';
  }

  return `${y}${m}${d}`;
}

// 4. Generate Tally Voucher XML (Accounting Voucher View)
function buildVoucherXml(item, dateStr) {
  const amount = Number(item.amount || 0).toFixed(2);
  const party = xmlEscape(item.party_ledger || item.client_name || 'Sundry Debtors');
  const salesLedger = xmlEscape(item.sales_ledger || 'Professional Fees Account');
  const narration = xmlEscape(item.narration || `Professional Fees - ${item.client_name}`);
  const vchType = xmlEscape(item.voucher_type || 'Sales');
  const invoiceNo = xmlEscape(item.source_id || `INV-${Date.now().toString().slice(-4)}`);

  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoiceNo}</VOUCHERNUMBER>
            <REFERENCE>${invoiceNo}</REFERENCE>
            <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ISINVOICE>No</ISINVOICE>
            <NARRATION>${narration}</NARRATION>

            <!-- Debit: Client / Party Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${party}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Credit: Professional Fees / Sales Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${salesLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// 5. Post Voucher to local TallyPrime with Pre-flight Ledgers & Safe Fallback
async function injectVoucherIntoTally(item, companyInfo) {
  const party = item.party_ledger || item.client_name || 'Sundry Debtors';
  const salesLedger = item.sales_ledger || 'Professional Fees Account';

  // Step 1: Ensure master ledgers exist in Tally (avoids "Ledger does not exist" error)
  console.log(`  [MASTERS] Verifying / auto-creating ledgers in Tally: "${party}", "${salesLedger}"...`);
  await ensureTallyLedgersExist(party, salesLedger);

  // Step 2: Post voucher with parsed date
  let dateStr = parseToTallyDate(item.date, companyInfo, false);
  let res = await sendVoucherXml(item, dateStr);

  // Step 3: If Tally rejected due to Educational mode or date restriction, retry with Day 01
  if (!res.success && res.error && (
      res.error.toLowerCase().includes('date') ||
      res.error.toLowerCase().includes('educational') ||
      res.error.toLowerCase().includes('period') ||
      res.error.toLowerCase().includes('year')
  )) {
    console.log(`  [RETRY] Retrying with Tally Educational / Period-safe Date (Day 01)...`);
    const safeDateStr = parseToTallyDate(item.date, companyInfo, true);
    if (safeDateStr !== dateStr) {
      res = await sendVoucherXml(item, safeDateStr);
    }
  }

  return res;
}

async function sendVoucherXml(item, dateStr) {
  const xml = buildVoucherXml(item, dateStr);
  try {
    const res = await request(config.tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xml)
      }
    }, xml);

    const body = res.body || '';
    const created = Number((body.match(/<CREATED>(\d+)<\/CREATED>/i) || [])[1] || 0);
    const altered = Number((body.match(/<ALTERED>(\d+)<\/ALTERED>/i) || [])[1] || 0);
    const errors = Number((body.match(/<ERRORS>(\d+)<\/ERRORS>/i) || [])[1] || 0);

    const isSuccess = (created > 0 || altered > 0) && errors === 0;

    if (isSuccess) {
      const vchNoMatch = body.match(/<VOUCHERNUMBER>(.*?)<\/VOUCHERNUMBER>/i) ||
                         body.match(/<LASTVCHID>(.*?)<\/LASTVCHID>/i);
      const vchNo = vchNoMatch ? vchNoMatch[1].trim() : (item.source_id || 'OK');
      return { success: true, voucherNo: vchNo, raw: body };
    }

    // Extract exact errors from Tally response
    const lineErrors = [];
    const re = /<LINEERROR>(.*?)<\/LINEERROR>/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      lineErrors.push(m[1].trim());
    }
    if (!lineErrors.length) {
      const errTag = body.match(/<ERROR>(.*?)<\/ERROR>/i) ||
                     body.match(/<DESCRIPTION>(.*?)<\/DESCRIPTION>/i) ||
                     body.match(/<EXCEPTION>(.*?)<\/EXCEPTION>/i);
      if (errTag) lineErrors.push(errTag[1].trim());
    }

    const errorMsg = lineErrors.length
      ? lineErrors.join(' | ')
      : (errors > 0 ? `Tally rejected voucher (ERRORS: ${errors})` : 'Tally rejected voucher');

    return { success: false, error: errorMsg, raw: body };
  } catch (err) {
    return { success: false, error: `Connection to Tally failed: ${err.message}`, raw: '' };
  }
}

// 6. Send Heartbeat to Cloud
async function sendHeartbeat(tallyStatus) {
  try {
    const hbUrl = `${config.siteUrl}/api/tally/heartbeat`;
    await request(hbUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': config.bridgeToken
      }
    }, JSON.stringify({
      connectorName: 'Kiran Shinde PC Connector',
      tallyOnline: tallyStatus.online,
      companyName: tallyStatus.company || 'Tally Not Running',
      tallyVersion: tallyStatus.version || 'TallyPrime'
    }));
  } catch (e) {
    // Non-critical, ignore heartbeat network blip
  }
}

// 7. Poll Cloud for Pending Sync Tasks
async function pollSyncQueue() {
  try {
    const qUrl = `${config.siteUrl}/api/tally/queue?status=pending`;
    const res = await request(qUrl, {
      method: 'GET',
      headers: {
        'x-bridge-token': config.bridgeToken
      }
    });

    if (res.statusCode !== 200) return;
    const json = JSON.parse(res.body || '{}');
    const items = json.queue || [];

    if (!items.length) return;

    const tallyStatus = await getTallyActiveCompany();
    if (!tallyStatus.online) {
      console.log(`[QUEUE] ${items.length} pending item(s) waiting, but Tally is offline.`);
      return;
    }

    console.log(`\n[QUEUE] Found ${items.length} pending voucher(s) to sync into Tally!`);

    for (const item of items) {
      console.log(`  -> Processing: ${item.client_name} (₹${item.amount}) [${item.voucher_type}]...`);
      const tallyRes = await injectVoucherIntoTally(item, tallyStatus);

      const updateUrl = `${config.siteUrl}/api/tally/queue`;
      if (tallyRes.success) {
        console.log(`  [SUCCESS] ✅ Voucher posted in Tally! Voucher No: ${tallyRes.voucherNo}`);
        await request(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-bridge-token': config.bridgeToken
          }
        }, JSON.stringify({
          id: item.id,
          status: 'SYNCED',
          tallyVoucherNo: tallyRes.voucherNo
        }));
      } else {
        console.error(`  [FAILED] ❌ Tally error: ${tallyRes.error}`);
        if (tallyRes.raw) {
          console.error(`  [DEBUG] Tally raw response:\n${tallyRes.raw.slice(0, 500)}...`);
        }
        await request(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-bridge-token': config.bridgeToken
          }
        }, JSON.stringify({
          id: item.id,
          status: 'FAILED',
          errorMessage: tallyRes.error
        }));
      }
    }
  } catch (err) {
    // Network or server error
  }
}

// Banner
console.log('\n==============================================================');
console.log('  KIRAN K. SHINDE & CO. — TALLYPRIME CLOUD CONNECTOR (v1.2)');
console.log('==============================================================');
console.log(`  Cloud Website : ${config.siteUrl}`);
console.log(`  Local Tally   : ${config.tallyUrl}`);
console.log(`  Poll Interval : Every ${config.pollIntervalSeconds} seconds`);
console.log('==============================================================\n');

let lastReportedOnline = null;

// Independent Heartbeat Loop (Runs every 4s regardless of sync queue operations)
async function runHeartbeatLoop() {
  try {
    const tallyStatus = await getTallyActiveCompany();

    if (tallyStatus.online !== lastReportedOnline) {
      if (tallyStatus.online) {
        console.log(`[TALLY CONNECTED] 🟢 Active Company: "${tallyStatus.company}" on ${config.tallyUrl}`);
        if (tallyStatus.startingFrom && tallyStatus.endingAt) {
          console.log(`                  Financial Period: ${tallyStatus.startingFrom} to ${tallyStatus.endingAt}`);
        }
        console.log(`[STATUS] Listening for sync commands from website...`);
      } else {
        console.log(`[TALLY OFFLINE] 🔴 Could not reach Tally on ${config.tallyUrl}`);
        console.log(`                Tip: Make sure TallyPrime is open & ODBC/HTTP enabled on port 9000.`);
      }
      lastReportedOnline = tallyStatus.online;
    }

    await sendHeartbeat(tallyStatus);
  } catch (e) {
    // Non-fatal
  }
}

// Queue Polling Loop (Runs every 4s to check pending vouchers)
async function runQueueLoop() {
  try {
    const tallyStatus = await getTallyActiveCompany();
    if (tallyStatus.online) {
      await pollSyncQueue();
    }
  } catch (e) {
    // Non-fatal
  }
}

// Execute initial run immediately
runHeartbeatLoop();
runQueueLoop();

// Separate timers so Heartbeat NEVER drops while processing vouchers
setInterval(runHeartbeatLoop, 4000);
setInterval(runQueueLoop, config.pollIntervalSeconds * 1000);
