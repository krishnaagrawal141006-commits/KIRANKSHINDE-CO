/**
 * ==============================================================================
 *  KIRAN K. SHINDE & CO. — TALLYPRIME CLOUD CONNECTOR
 *  Direct Real-time Sync between Cloud Website & Local Office TallyPrime
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load config
let config = {
  siteUrl: "https://kiranshinde-co.vercel.app",
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

// 1. Check TallyPrime Status and Get Current Active Company
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
      // Simple regex to extract Company Name from XML
      const match = res.body.match(/<COMPANYNAME>(.*?)<\/COMPANYNAME>/i) ||
                    res.body.match(/<NAME>(.*?)<\/NAME>/i);
      const company = match ? match[1].trim() : 'Company Active';
      return { online: true, company, version: 'TallyPrime' };
    }
    return { online: false, company: null, error: `HTTP ${res.statusCode}` };
  } catch (err) {
    return { online: false, company: null, error: err.message };
  }
}

// 2. Generate Tally Voucher XML (Sales / Fee Voucher)
function buildVoucherXml(item) {
  // Format Date to YYYYMMDD
  const rawDate = String(item.date || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '');
  const dateStr = rawDate.length === 8 ? rawDate : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
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
        <STATICVARIABLES>
          <SVCURRENTCOMPANY></SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoiceNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <NARRATION>${narration}</NARRATION>

            <!-- Debit: Client / Party Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${party}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Credit: Professional Fees / Sales Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${salesLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// 3. Post Voucher to local TallyPrime
async function injectVoucherIntoTally(item) {
  const xml = buildVoucherXml(item);
  try {
    const res = await request(config.tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xml)
      }
    }, xml);

    const body = res.body || '';
    const createdMatch = body.match(/<CREATED>(\d+)<\/CREATED>/i);
    const alteredMatch = body.match(/<ALTERED>(\d+)<\/ALTERED>/i);
    const isSuccess = (createdMatch && Number(createdMatch[1]) > 0) ||
                      (alteredMatch && Number(alteredMatch[1]) > 0);

    if (isSuccess) {
      const vchNoMatch = body.match(/<VOUCHERNUMBER>(.*?)<\/VOUCHERNUMBER>/i) ||
                         body.match(/<LASTVCHID>(.*?)<\/LASTVCHID>/i);
      const vchNo = vchNoMatch ? vchNoMatch[1].trim() : item.source_id;
      return { success: true, voucherNo: vchNo, raw: body };
    }

    // Check for errors in Tally XML response
    const lineErrorMatch = body.match(/<LINEERROR>(.*?)<\/LINEERROR>/i);
    const errorMsg = lineErrorMatch ? lineErrorMatch[1].trim() : 'Tally rejected voucher (check ledger names)';
    return { success: false, error: errorMsg, raw: body };
  } catch (err) {
    return { success: false, error: `Connection to Tally failed: ${err.message}` };
  }
}

// 4. Send Heartbeat to Cloud
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

// 5. Poll Cloud for Pending Sync Tasks
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

    console.log(`\n[QUEUE] Found ${items.length} pending voucher(s) to sync into Tally!`);

    for (const item of items) {
      console.log(`  -> Processing: ${item.client_name} (₹${item.amount}) [${item.voucher_type}]...`);
      const tallyRes = await injectVoucherIntoTally(item);

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
console.log('  KIRAN K. SHINDE & CO. — TALLYPRIME CLOUD CONNECTOR (v1.0)');
console.log('==============================================================');
console.log(`  Cloud Website : ${config.siteUrl}`);
console.log(`  Local Tally   : ${config.tallyUrl}`);
console.log(`  Poll Interval : Every ${config.pollIntervalSeconds} seconds`);
console.log('==============================================================\n');

let lastReportedOnline = null;

// Main Cycle Loop
async function runLoop() {
  const tallyStatus = await getTallyActiveCompany();

  if (tallyStatus.online !== lastReportedOnline) {
    if (tallyStatus.online) {
      console.log(`[TALLY CONNECTED] 🟢 Active Company: "${tallyStatus.company}" on ${config.tallyUrl}`);
      console.log(`[STATUS] Listening for sync commands from website...`);
    } else {
      console.log(`[TALLY OFFLINE] 🔴 Could not reach Tally on ${config.tallyUrl}`);
      console.log(`                Tip: Make sure TallyPrime is open & ODBC/HTTP enabled on port 9000.`);
    }
    lastReportedOnline = tallyStatus.online;
  }

  // Send Heartbeat to website
  await sendHeartbeat(tallyStatus);

  // If Tally is running, process pending sync items
  if (tallyStatus.online) {
    await pollSyncQueue();
  }

  setTimeout(runLoop, config.pollIntervalSeconds * 1000);
}

runLoop();

