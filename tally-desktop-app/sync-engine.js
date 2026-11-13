/**
 * Kiran K. Shinde & Co. — Tally Desktop Sync Engine
 * Handles TallyPrime HTTP communication, auto ledger creation, and Cloud Queue synchronization.
 */

const http = require('http');
const https = require('https');
const EventEmitter = require('events');

class TallySyncEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      siteUrl: "https://kirankshinde-co.vercel.app",
      bridgeToken: "ks_tally_secret_2026",
      tallyUrl: "http://127.0.0.1:9000",
      pollIntervalSeconds: 4,
      ...config
    };

    this.isRunning = false;
    this.isPaused = false;
    this.timer = null;
    this.lastReportedTallyStatus = null;
    this.stats = {
      totalSynced: 0,
      totalFailed: 0,
      pendingCount: 0,
      activeCompany: 'Checking...',
      tallyOnline: false,
      cloudOnline: false,
      lastSyncTime: null
    };
  }

  log(level, text) {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.emit('log', { level, text, time });
  }

  xmlEscape(val = '') {
    return String(val).replace(/[<>&'"]/g, ch => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    }[ch]));
  }

  request(urlStr, options = {}, postData = null) {
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

  // 1. Check Tally status & get company
  async getTallyActiveCompany() {
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
      const res = await this.request(this.config.tallyUrl, {
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

  // 2. Ensure master ledgers exist in Tally
  async ensureTallyLedgersExist(partyName, salesLedgerName) {
    const party = this.xmlEscape(partyName || 'Sundry Debtors');
    const sales = this.xmlEscape(salesLedgerName || 'Professional Fees Account');

    const masterXml = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
        <REQUESTDATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <LEDGER NAME="${party}" ACTION="Create">
              <NAME.LIST><NAME>${party}</NAME></NAME.LIST>
              <PARENT>Sundry Debtors</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>
            <LEDGER NAME="${sales}" ACTION="Create">
              <NAME.LIST><NAME>${sales}</NAME></NAME.LIST>
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
      await this.request(this.config.tallyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(masterXml)
        }
      }, masterXml);
    } catch (e) {
      // Ignored non-fatal
    }
  }

  // 3. Format Date
  parseToTallyDate(dateVal, companyInfo = null, forceEducationalDay = false) {
    let y, m, d;
    const str = String(dateVal || '').trim();

    if (str.includes('/')) {
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
          y = parts[0];
          m = parts[1].padStart(2, '0');
          d = parts[2].padStart(2, '0');
        } else {
          d = parts[0].padStart(2, '0');
          m = parts[1].padStart(2, '0');
          y = parts[2];
        }
      }
    }

    if (!y || !m || !d || isNaN(parseInt(y, 10)) || isNaN(parseInt(m, 10)) || isNaN(parseInt(d, 10))) {
      const now = new Date();
      y = String(now.getFullYear());
      m = String(now.getMonth() + 1).padStart(2, '0');
      d = String(now.getDate()).padStart(2, '0');
    }

    if (companyInfo && companyInfo.startingYear && companyInfo.endingYear) {
      const numY = parseInt(y, 10);
      if (numY < companyInfo.startingYear || numY > companyInfo.endingYear) {
        y = String(companyInfo.startingYear);
      }
    }

    if (forceEducationalDay) {
      d = '01';
    }

    return `${y}${m}${d}`;
  }

  // 4. Generate Voucher XML
  buildVoucherXml(item, dateStr) {
    const amount = Number(item.amount || 0).toFixed(2);
    const party = this.xmlEscape(item.party_ledger || item.client_name || 'Sundry Debtors');
    const salesLedger = this.xmlEscape(item.sales_ledger || 'Professional Fees Account');
    const narration = this.xmlEscape(item.narration || `Professional Fees - ${item.client_name}`);
    const vchType = this.xmlEscape(item.voucher_type || 'Sales');
    const invoiceNo = this.xmlEscape(item.source_id || `INV-${Date.now().toString().slice(-4)}`);

    return `<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
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

              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${party}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>

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

  // 5. Send single XML to Tally
  async sendVoucherXml(item, dateStr) {
    const xml = this.buildVoucherXml(item, dateStr);
    try {
      const res = await this.request(this.config.tallyUrl, {
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

  // 6. Inject Voucher into Tally with Auto-Masters and Safe Retry
  async injectVoucherIntoTally(item, companyInfo) {
    const party = item.party_ledger || item.client_name || 'Sundry Debtors';
    const salesLedger = item.sales_ledger || 'Professional Fees Account';

    this.log('info', `Checking master ledgers: "${party}" & "${salesLedger}"`);
    await this.ensureTallyLedgersExist(party, salesLedger);

    let dateStr = this.parseToTallyDate(item.date, companyInfo, false);
    let res = await this.sendVoucherXml(item, dateStr);

    if (!res.success && res.error && (
        res.error.toLowerCase().includes('date') ||
        res.error.toLowerCase().includes('educational') ||
        res.error.toLowerCase().includes('period') ||
        res.error.toLowerCase().includes('year')
    )) {
      this.log('warn', `Retrying with Educational/Period Safe Date (Day 01)...`);
      const safeDateStr = this.parseToTallyDate(item.date, companyInfo, true);
      if (safeDateStr !== dateStr) {
        res = await this.sendVoucherXml(item, safeDateStr);
      }
    }

    return res;
  }

  // 7. Send Heartbeat to Cloud
  async sendHeartbeat(tallyStatus) {
    try {
      const hbUrl = `${this.config.siteUrl}/api/tally/heartbeat`;
      const res = await this.request(hbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': this.config.bridgeToken
        }
      }, JSON.stringify({
        connectorName: 'Kiran Shinde PC Connector (Desktop GUI)',
        tallyOnline: tallyStatus.online,
        companyName: tallyStatus.company || 'Tally Not Running',
        tallyVersion: tallyStatus.version || 'TallyPrime'
      }));
      this.stats.cloudOnline = res.statusCode === 200;
    } catch (e) {
      this.stats.cloudOnline = false;
    }
  }

  // 8. Poll Cloud Queue
  async pollSyncQueue(tallyStatus) {
    if (this.isPaused) return;

    try {
      const qUrl = `${this.config.siteUrl}/api/tally/queue?status=pending`;
      const res = await this.request(qUrl, {
        method: 'GET',
        headers: {
          'x-bridge-token': this.config.bridgeToken
        }
      });

      if (res.statusCode !== 200) return;
      const json = JSON.parse(res.body || '{}');
      const items = json.queue || [];
      this.stats.pendingCount = items.length;

      if (!items.length) return;

      this.log('info', `Found ${items.length} pending voucher(s) in cloud queue.`);

      for (const item of items) {
        this.log('info', `Posting ${item.source_id || 'invoice'} for ${item.client_name} (₹${item.amount})...`);
        const tallyRes = await this.injectVoucherIntoTally(item, tallyStatus);

        const updateUrl = `${this.config.siteUrl}/api/tally/queue`;
        if (tallyRes.success) {
          this.stats.totalSynced++;
          this.stats.lastSyncTime = new Date().toLocaleTimeString('en-IN');
          this.log('success', `✅ Posted in Tally! Voucher No: ${tallyRes.voucherNo}`);

          this.emit('voucher-synced', {
            id: item.id,
            sourceId: item.source_id,
            clientName: item.client_name,
            amount: item.amount,
            voucherNo: tallyRes.voucherNo
          });

          await this.request(updateUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-bridge-token': this.config.bridgeToken
            }
          }, JSON.stringify({
            id: item.id,
            status: 'SYNCED',
            tallyVoucherNo: tallyRes.voucherNo
          }));
        } else {
          this.stats.totalFailed++;
          this.log('error', `❌ Tally rejected: ${tallyRes.error}`);

          this.emit('voucher-failed', {
            id: item.id,
            sourceId: item.source_id,
            clientName: item.client_name,
            amount: item.amount,
            error: tallyRes.error
          });

          await this.request(updateUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-bridge-token': this.config.bridgeToken
            }
          }, JSON.stringify({
            id: item.id,
            status: 'FAILED',
            errorMessage: tallyRes.error
          }));
        }
      }
    } catch (e) {
      // Network blip
    }
  }

  // 9. Main Cycle & Heartbeat Loop
  async heartbeat() {
    const tallyStatus = await this.getTallyActiveCompany();
    this.stats.tallyOnline = tallyStatus.online;
    this.stats.activeCompany = tallyStatus.company || 'Not Connected';

    if (tallyStatus.online !== this.lastReportedTallyStatus) {
      if (tallyStatus.online) {
        this.log('success', `🟢 Connected to TallyPrime! Company: "${tallyStatus.company}"`);
        if (tallyStatus.startingFrom && tallyStatus.endingAt) {
          this.log('info', `Active Books Period: ${tallyStatus.startingFrom} to ${tallyStatus.endingAt}`);
        }
      } else {
        this.log('warn', `🔴 TallyPrime not responding on ${this.config.tallyUrl}. Please ensure Tally is open.`);
      }
      this.lastReportedTallyStatus = tallyStatus.online;
    }

    await this.sendHeartbeat(tallyStatus);
    this.emit('stats-updated', { ...this.stats, isPaused: this.isPaused });
  }

  async pollQueue() {
    const tallyStatus = await this.getTallyActiveCompany();
    if (tallyStatus.online && !this.isPaused) {
      await this.pollSyncQueue(tallyStatus);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.log('info', `Starting Kiran K. Shinde & Co. Tally Bridge (Every ${this.config.pollIntervalSeconds}s)...`);

    // Run initial iterations
    this.heartbeat();
    this.pollQueue();

    // Independent timers: Heartbeat NEVER stops even if voucher syncing takes time
    this.heartbeatTimer = setInterval(() => this.heartbeat(), 4000);
    this.queueTimer = setInterval(() => this.pollQueue(), this.config.pollIntervalSeconds * 1000);
  }

  pause() {
    this.isPaused = true;
    this.log('warn', 'Sync paused by user.');
    this.emit('stats-updated', { ...this.stats, isPaused: this.isPaused });
  }

  resume() {
    this.isPaused = false;
    this.log('success', 'Sync resumed.');
    this.emit('stats-updated', { ...this.stats, isPaused: this.isPaused });
    this.pollQueue();
  }

  stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.heartbeatTimer = null;
    this.queueTimer = null;
    this.log('info', 'Bridge stopped.');
  }

  syncNow() {
    this.log('info', '⚡ Force sync triggered by user.');
    this.heartbeat();
    this.pollQueue();
  }
}

module.exports = TallySyncEngine;

