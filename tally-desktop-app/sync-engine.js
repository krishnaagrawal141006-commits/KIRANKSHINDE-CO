/**
 * Kiran K. Shinde & Co. — Tally Desktop Sync Engine
 * Handles TallyPrime HTTP communication, auto ledger creation, and Cloud Queue synchronization.
 */

const http = require('http');
const https = require('https');
const EventEmitter = require('events');
const ClientVaultManager = require('./client-vault');

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

    this.clientVault = new ClientVaultManager();
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

        const extractYear = (str) => {
          if (!str) return null;
          const s = String(str).trim();
          if (/^\d{8}$/.test(s)) return parseInt(s.slice(0, 4), 10);
          const m4 = s.match(/\b(20\d\d|19\d\d)\b/);
          if (m4) return parseInt(m4[1], 10);
          const m2 = s.match(/[-/\s](\d{2})$/);
          if (m2) return 2000 + parseInt(m2[1], 10);
          return null;
        };

        let startingYear = extractYear(startingFrom);
        let endingYear = extractYear(endingAt);

        // Default to active company starting year (2026) if not explicitly detected
        if (!startingYear || startingYear < 2000) startingYear = 2026;
        if (!endingYear || endingYear < 2000) endingYear = startingYear + 1;

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

  mapServiceToTallyLedger(serviceName) {
    const s = String(serviceName || '').toLowerCase();
    if (s.includes('tds') || s.includes('challan') || s.includes('tcs') || s.includes('26q') || s.includes('24q')) {
      return 'TDS & Challan Compliance Fees';
    }
    if (s.includes('gst') || s.includes('gstr') || s.includes('e-way') || s.includes('eway') || s.includes('lut')) {
      return 'GST Returns & Compliance Fees';
    }
    if (s.includes('audit') || s.includes('44ab') || s.includes('statutory')) {
      return 'Audit & Assurance Fees';
    }
    if (s.includes('itr') || s.includes('income tax') || s.includes('computation') || s.includes('44ada')) {
      return 'Income Tax Filing & Advisory Fees';
    }
    if (s.includes('roc') || s.includes('mca') || s.includes('incorporation') || s.includes('company')) {
      return 'ROC & Company Compliance Fees';
    }
    if (s.includes('accounting') || s.includes('bookkeeping') || s.includes('tally')) {
      return 'Accounting & Bookkeeping Fees';
    }
    const clean = String(serviceName || '').split('—')[0].split('-')[0].trim();
    return clean ? `Professional Fees - ${clean}` : 'Professional Fees Account';
  }

  // 2. Ensure master ledgers exist in Tally (Supports Multi-Service, GST & Bank Accounts)
  async ensureTallyLedgersExist(partyName, salesLedgerName, extraLedgers = []) {
    const party = this.xmlEscape(partyName || 'Sundry Debtors');
    const sales = this.xmlEscape(salesLedgerName || 'Professional Fees Account');

    const isBank = /bank|hdfc|sbi|icici|axis|kotak|bob|pnb/i.test(salesLedgerName || '');
    const isCash = /cash/i.test(salesLedgerName || '');
    const salesParent = isBank ? 'Bank Accounts' : (isCash ? 'Cash-in-Hand' : 'Direct Incomes');

    let extraXml = '';
    const uniqueLedgers = Array.from(new Set(extraLedgers.filter(Boolean)));
    for (const lName of uniqueLedgers) {
      const esc = this.xmlEscape(lName);
      const isTax = /cgst|sgst|igst|tax/i.test(lName);
      const isExtraBank = /bank|hdfc|sbi|icici|axis|kotak/i.test(lName);
      const parent = isTax ? 'Duties &amp; Taxes' : (isExtraBank ? 'Bank Accounts' : 'Direct Incomes');
      extraXml += `
            <LEDGER NAME="${esc}" ACTION="Create">
              <NAME.LIST><NAME>${esc}</NAME></NAME.LIST>
              <PARENT>${parent}</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>`;
    }

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
              <PARENT>${salesParent}</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>
            ${extraXml}
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

    const monthNames = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const textMatch = str.match(/^(\d{1,2})[\s\-]+([a-zA-Z]{3,9})[\s\-]+['"]?(\d{2,4})$/);

    if (textMatch) {
      d = textMatch[1].padStart(2, '0');
      const monStr = textMatch[2].toLowerCase().slice(0, 3);
      m = monthNames[monStr] || '01';
      y = textMatch[3].length === 2 ? `20${textMatch[3]}` : textMatch[3];
    } else if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        d = parts[0].padStart(2, '0');
        const monStr = parts[1].toLowerCase().slice(0, 3);
        m = monthNames[monStr] || parts[1].padStart(2, '0');
        y = parts[2].trim();
        if (y.length === 2) y = `20${y}`;
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
          const monStr = parts[1].toLowerCase().slice(0, 3);
          m = monthNames[monStr] || parts[1].padStart(2, '0');
          y = parts[2].trim();
          if (y.length === 2) y = `20${y}`;
        }
      }
    }

    if (!y || !m || !d || isNaN(parseInt(y, 10)) || isNaN(parseInt(m, 10)) || isNaN(parseInt(d, 10))) {
      const now = new Date();
      y = String(now.getFullYear());
      m = String(now.getMonth() + 1).padStart(2, '0');
      d = String(now.getDate()).padStart(2, '0');
    }

    // Force date within company starting/ending year
    const targetStartYear = (companyInfo && companyInfo.startingYear && companyInfo.startingYear >= 2000) ? companyInfo.startingYear : 2026;
    const targetEndYear = (companyInfo && companyInfo.endingYear && companyInfo.endingYear >= 2000) ? companyInfo.endingYear : targetStartYear + 1;

    const numY = parseInt(y, 10);
    if (numY < targetStartYear || numY > targetEndYear) {
      y = String(targetStartYear);
    }

    if (forceEducationalDay) {
      d = '01';
    }

    return `${y}${m}${d}`;
  }

  // 4. Generate Voucher XML (Supports Multi-line Items, GST & Optional Proformas)
  buildVoucherXml(item, dateStr) {
    const amount = Number(item.amount || 0).toFixed(2);
    const party = this.xmlEscape(item.party_ledger || item.client_name || 'Sundry Debtors');
    
    // Parse metadata from narration if present
    let rawNarration = item.narration || `Professional Fees - ${item.client_name}`;
    let metadata = null;
    if (rawNarration.includes('| JSON:')) {
      const parts = rawNarration.split('| JSON:');
      rawNarration = parts[0].trim();
      try {
        metadata = JSON.parse(parts[1].trim());
      } catch (e) {}
    }

    let serviceDesc = item.service || '';
    if (metadata && (metadata.service || metadata.description)) {
      serviceDesc = metadata.service || metadata.description;
    } else if (rawNarration) {
      serviceDesc = rawNarration.split('-')[0].trim();
    }

    let dynamicSalesLedger = item.sales_ledger;
    if (!dynamicSalesLedger || dynamicSalesLedger === 'Professional Fees Account') {
      dynamicSalesLedger = this.mapServiceToTallyLedger(serviceDesc || rawNarration);
    }
    const defaultSalesLedger = this.xmlEscape(dynamicSalesLedger);

    const isReceipt = String(item.voucher_type || '').toLowerCase() === 'receipt';
    const isOptional = isReceipt ? false : Boolean(item.is_optional || item.voucher_type === 'Proforma' || (metadata && metadata.isOptional));
    const vchType = this.xmlEscape(isReceipt ? 'Receipt' : (item.voucher_type === 'Proforma' ? 'Sales' : (item.voucher_type || 'Sales')));
    const invoiceNo = this.xmlEscape(item.source_id || (isReceipt ? `REC-${Date.now().toString().slice(-4)}` : `INV-${Date.now().toString().slice(-4)}`));
    const narration = this.xmlEscape(rawNarration);

    let ledgerEntriesXml = '';

    if (isReceipt) {
      // Receipt Voucher:
      // Bank / Cash Account is DEBITED (ISDEEMEDPOSITIVE: Yes, AMOUNT: -amount)
      // Client / Party Account is CREDITED (ISDEEMEDPOSITIVE: No, AMOUNT: amount)
      ledgerEntriesXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${defaultSalesLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${party}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
    } else if (metadata && Array.isArray(metadata.items) && metadata.items.length > 0) {
      // 1. Party Ledger (Debited with Full Total Amount)
      ledgerEntriesXml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${party}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;

      // 2. Individual Line Items (Credited)
      for (const line of metadata.items) {
        const lineLedger = this.xmlEscape(line.ledger || line.name || defaultSalesLedger);
        const lineAmt = Number(line.amount || 0).toFixed(2);
        ledgerEntriesXml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${lineLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${lineAmt}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
      }

      // 3. GST Tax Ledgers (Credited)
      if (metadata.cgst && Number(metadata.cgst) > 0) {
        ledgerEntriesXml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>CGST Output (9%)</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${Number(metadata.cgst).toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
      }
      if (metadata.sgst && Number(metadata.sgst) > 0) {
        ledgerEntriesXml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>SGST Output (9%)</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${Number(metadata.sgst).toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
      }
      if (metadata.igst && Number(metadata.igst) > 0) {
        ledgerEntriesXml += `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>IGST Output (18%)</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${Number(metadata.igst).toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
      }
    } else {
      // Standard 2-leg voucher with Dynamic Service Ledger & Service Description in Tally
      ledgerEntriesXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${party}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${defaultSalesLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount}</AMOUNT>
                ${serviceDesc ? `<DESCRIPTION>${this.xmlEscape(serviceDesc)}</DESCRIPTION>` : ''}
              </ALLLEDGERENTRIES.LIST>`;
    }

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
              <ISOPTIONAL>${isOptional ? 'Yes' : 'No'}</ISOPTIONAL>
              <NARRATION>${narration}</NARRATION>
              ${ledgerEntriesXml}
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

    let serviceDesc = item.service || '';
    if (item.narration && item.narration.includes('| JSON:')) {
      try {
        const meta = JSON.parse(item.narration.split('| JSON:')[1].trim());
        if (meta.service) serviceDesc = meta.service;
        else if (meta.description) serviceDesc = meta.description;
      } catch (e) {}
    } else if (item.narration) {
      serviceDesc = item.narration.split('-')[0].trim();
    }

    let salesLedger = item.sales_ledger;
    if (!salesLedger || salesLedger === 'Professional Fees Account') {
      salesLedger = this.mapServiceToTallyLedger(serviceDesc || item.narration);
    }

    // Collect extra ledgers from metadata if present
    const extraLedgers = [];
    if (item.narration && item.narration.includes('| JSON:')) {
      try {
        const meta = JSON.parse(item.narration.split('| JSON:')[1].trim());
        if (meta.items) {
          meta.items.forEach(it => {
            if (it.name || it.ledger) extraLedgers.push(it.ledger || it.name);
          });
        }
        if (meta.cgst && Number(meta.cgst) > 0) extraLedgers.push('CGST Output (9%)');
        if (meta.sgst && Number(meta.sgst) > 0) extraLedgers.push('SGST Output (9%)');
        if (meta.igst && Number(meta.igst) > 0) extraLedgers.push('IGST Output (18%)');
      } catch (e) {}
    }

    this.log('info', `Checking master ledgers: "${party}", "${salesLedger}" ${extraLedgers.length ? `+ ${extraLedgers.length} tax/service ledgers` : ''}`);
    await this.ensureTallyLedgersExist(party, salesLedger, extraLedgers);

    let dateStr = this.parseToTallyDate(item.date, companyInfo, false);
    let res = await this.sendVoucherXml(item, dateStr);

    if (!res.success && res.error && (
        res.error.toLowerCase().includes('date') ||
        res.error.toLowerCase().includes('educational') ||
        res.error.toLowerCase().includes('period') ||
        res.error.toLowerCase().includes('year') ||
        res.error.toLowerCase().includes('out of range')
    )) {
      this.log('warn', `Retrying with Educational/Period Safe Date (Day 01)...`);
      const targetYear = (companyInfo && companyInfo.startingYear && companyInfo.startingYear >= 2000) ? companyInfo.startingYear : 2026;
      const targetMonth = dateStr.length >= 6 ? dateStr.slice(4, 6) : '04';
      const safeDateStr = `${targetYear}${targetMonth}01`;
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

          // Auto-sync with local client document vault
          if (this.clientVault) {
            try {
              const panOrId = item.source_id || '';
              this.clientVault.ensureClientFolder(item.client_name, panOrId);
              this.log('info', `📁 Local Client Vault synchronized for: "${item.client_name}"`);
            } catch (err) {}
          }

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

  // ================= 10. BANK STATEMENT TO TALLY ENGINE (SUVIT STYLE) =================

  mapBankNarrationToLedger(narration = '', isDebit = true) {
    const s = String(narration || '').toLowerCase();

    // 1. Cash / ATM Contra
    if (/\b(atm|cash wdl|cash dep|cdm|self withdrawal|cash-in-hand)\b/.test(s)) {
      return { ledger: 'Cash-in-Hand', parent: 'Cash-in-Hand', isContra: true };
    }

    // 2. Staff Welfare & Food / Pantry
    if (/\b(swiggy|zomato|blinkit|zepto|dunzo|mcdonald|dominos|starbucks|subway|cafe|canteen|food|restaurant|grocery|dmart|bigbasket)\b/.test(s)) {
      return { ledger: 'Staff Welfare & Pantry Expense', parent: 'Indirect Expenses', isContra: false };
    }

    // 3. Conveyance & Fuel / Fastag
    if (/\b(petrol|hpcl|iocl|bpcl|fuel|diesel|cng|shell|fastag|toll|parking)\b/.test(s)) {
      return { ledger: 'Conveyance & Fuel Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 4. Travel & Hotel
    if (/\b(uber|ola|rapido|irctc|redbus|makemytrip|goibibo|indigo|air india|hotel|lodging|flight)\b/.test(s)) {
      return { ledger: 'Travelling & Conveyance Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 5. Telephone, Mobile & Internet
    if (/\b(jio|airtel|vodafone|idea|vi|bsnl|act fibernet|tata play|broadband|recharge|telecom)\b/.test(s)) {
      return { ledger: 'Telephone & Internet Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 6. Electricity & Utilities
    if (/\b(electricity|mseb|mahadiscom|adani|bescom|tneb|cesc|power bill|billdesk utilities|water bill)\b/.test(s)) {
      return { ledger: 'Electricity & Utility Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 7. Printing, Stationery & Courier
    if (/\b(stationery|xerox|print|paper|cartridge|courier|bluedart|dtdc|amazon|flipkart)\b/.test(s)) {
      return { ledger: 'Printing & Stationery Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 8. Bank Charges & Loan Interest
    if (/\b(sms charge|chq rtn|bounce|min bal|atm charge|card annual fee|locker|bank charges|int\.pd|loan emi|interest paid)\b/.test(s)) {
      return { ledger: 'Bank Charges & Finance Costs', parent: 'Indirect Expenses', isContra: false };
    }

    // 9. Taxes / Statutory Compliance
    if (/\b(cbic|gst pmt|gstin|advance tax|self assessment|income tax|tds challan|tcs|challan|prof\.tax|pt)\b/.test(s)) {
      return { ledger: 'Direct & Indirect Taxes Paid', parent: 'Duties & Taxes', isContra: false };
    }

    // 10. Rent & Office Maintenance
    if (/\b(rent|office rent|maintenance|society maintenance|housekeeping)\b/.test(s)) {
      return { ledger: 'Rent & Office Maintenance Expenses', parent: 'Indirect Expenses', isContra: false };
    }

    // 11. Salaries & Remuneration
    if (/\b(salary|salaries|stipend|wages|bonus|director remuneration|staff advance)\b/.test(s)) {
      return { ledger: 'Salaries & Staff Stipend', parent: 'Indirect Expenses', isContra: false };
    }

    // 12. Professional & Legal Fees
    if (/\b(audit fee|professional fee|legal fee|advocate|consultant fee)\b/.test(s)) {
      return isDebit
        ? { ledger: 'Professional & Legal Charges', parent: 'Indirect Expenses', isContra: false }
        : { ledger: 'Professional Fees Account', parent: 'Direct Incomes', isContra: false };
    }

    // 13. Interest Income / Dividend
    if (!isDebit && /\b(int\.recd|interest received|savings interest|fd interest|dividend|sweep in)\b/.test(s)) {
      return { ledger: 'Bank Interest Received', parent: 'Indirect Incomes', isContra: false };
    }

    // Default Fallbacks
    if (isDebit) {
      return { ledger: 'Sundry Creditors / Trade Vendors', parent: 'Sundry Creditors', isContra: false };
    } else {
      return { ledger: 'Sundry Debtors / Client Receipts', parent: 'Sundry Debtors', isContra: false };
    }
  }

  // Pre-creates all ledgers needed for bank auto-posting in Tally
  async ensureBankVoucherLedgersExist(bankLedgerName, requiredLedgers = []) {
    const bankEsc = this.xmlEscape(bankLedgerName || 'Bank Account');
    let mastersXml = `
            <LEDGER NAME="${bankEsc}" ACTION="Create">
              <NAME.LIST><NAME>${bankEsc}</NAME></NAME.LIST>
              <PARENT>Bank Accounts</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>
            <LEDGER NAME="Cash-in-Hand" ACTION="Create">
              <NAME.LIST><NAME>Cash-in-Hand</NAME></NAME.LIST>
              <PARENT>Cash-in-Hand</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>`;

    const seen = new Set();
    for (const item of requiredLedgers) {
      const name = item.name || item;
      const parent = item.parent || 'Indirect Expenses';
      if (!name || seen.has(name) || name === bankLedgerName || name === 'Cash-in-Hand') continue;
      seen.add(name);
      const esc = this.xmlEscape(name);
      const parentEsc = this.xmlEscape(parent);
      mastersXml += `
            <LEDGER NAME="${esc}" ACTION="Create">
              <NAME.LIST><NAME>${esc}</NAME></NAME.LIST>
              <PARENT>${parentEsc}</PARENT>
              <ISBILLWISEON>No</ISBILLWISEON>
              <AFFECTSSTOCK>No</AFFECTSSTOCK>
              <OPENINGBALANCE>0</OPENINGBALANCE>
            </LEDGER>`;
    }

    const envelope = `<ENVELOPE>
      <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
      <BODY>
        <IMPORTDATA>
          <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
          <REQUESTDATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              ${mastersXml}
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
          'Content-Length': Buffer.byteLength(envelope)
        }
      }, envelope);
    } catch (e) {}
  }

  // Generates single Bank Payment / Receipt / Contra XML
  buildBankVoucherXml(tx, dateStr, bankLedgerName) {
    const isDebit = Number(tx.debit || 0) > 0;
    const amount = Number(isDebit ? tx.debit : tx.credit).toFixed(2);
    const bankEsc = this.xmlEscape(bankLedgerName || 'Bank Account');
    const narration = this.xmlEscape(tx.narration || 'Bank Transaction');
    const refNo = this.xmlEscape(tx.refNo && tx.refNo !== '-' ? tx.refNo : `BNK-${Date.now().toString().slice(-6)}`);

    let ledgerName = tx.suggestedLedger || tx.ledger;
    let isContra = Boolean(tx.isContra);

    if (!ledgerName) {
      const mapped = this.mapBankNarrationToLedger(tx.narration, isDebit);
      ledgerName = mapped.ledger;
      isContra = mapped.isContra;
    }

    const ledgerEsc = this.xmlEscape(ledgerName);

    let vchType = 'Payment';
    let ledgerEntriesXml = '';

    if (isContra) {
      vchType = 'Contra';
      if (isDebit) {
        // Cash withdrawal: Cash Dr (-amount), Bank Cr (amount)
        ledgerEntriesXml = `
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>Cash-in-Hand</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${bankEsc}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                  <AMOUNT>${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>`;
      } else {
        // Cash deposit: Bank Dr (-amount), Cash Cr (amount)
        ledgerEntriesXml = `
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${bankEsc}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>Cash-in-Hand</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                  <AMOUNT>${amount}</AMOUNT>
                </ALLLEDGERENTRIES.LIST>`;
      }
    } else if (isDebit) {
      // Payment Voucher: Expense/Vendor Dr (-amount), Bank Cr (amount)
      vchType = 'Payment';
      ledgerEntriesXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${ledgerEsc}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${bankEsc}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
    } else {
      // Receipt Voucher: Bank Dr (-amount), Income/Debtor Cr (amount)
      vchType = 'Receipt';
      ledgerEntriesXml = `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${bankEsc}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${ledgerEsc}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
    }

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
                <VOUCHERNUMBER>${refNo}</VOUCHERNUMBER>
                <REFERENCE>${refNo}</REFERENCE>
                <PARTYLEDGERNAME>${isDebit ? ledgerEsc : bankEsc}</PARTYLEDGERNAME>
                <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
                <ISINVOICE>No</ISINVOICE>
                <NARRATION>${narration}</NARRATION>
                ${ledgerEntriesXml}
              </VOUCHER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE>`;
  }

  // Sends single bank voucher with educational fallback
  async sendBankVoucherToTally(tx, bankLedgerName, companyInfo) {
    let dateStr = this.parseToTallyDate(tx.date, companyInfo, false);
    const xml = this.buildBankVoucherXml(tx, dateStr, bankLedgerName);

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

      if ((created > 0 || altered > 0) && errors === 0) {
        return { success: true, voucherNo: tx.refNo || 'OK' };
      }

      // Educational / Date Range fallback
      if (errors > 0 || /date|educational|period|year|out of range/i.test(body)) {
        const targetYear = (companyInfo && companyInfo.startingYear && companyInfo.startingYear >= 2000) ? companyInfo.startingYear : 2026;
        const targetMonth = dateStr.length >= 6 ? dateStr.slice(4, 6) : '04';
        const safeDateStr = `${targetYear}${targetMonth}01`;
        if (safeDateStr !== dateStr) {
          const safeXml = this.buildBankVoucherXml(tx, safeDateStr, bankLedgerName);
          const safeRes = await this.request(this.config.tallyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'Content-Length': Buffer.byteLength(safeXml)
            }
          }, safeXml);
          const safeBody = safeRes.body || '';
          const sCreated = Number((safeBody.match(/<CREATED>(\d+)<\/CREATED>/i) || [])[1] || 0);
          const sErrors = Number((safeBody.match(/<ERRORS>(\d+)<\/ERRORS>/i) || [])[1] || 0);
          if (sCreated > 0 && sErrors === 0) {
            return { success: true, voucherNo: tx.refNo || 'OK', dateAdjusted: true };
          }
        }
      }

      const lineErrors = [];
      const re = /<LINEERROR>(.*?)<\/LINEERROR>/gi;
      let m;
      while ((m = re.exec(body)) !== null) lineErrors.push(m[1].trim());
      const errMsg = lineErrors.length ? lineErrors.join(' | ') : 'Tally rejected bank voucher';
      return { success: false, error: errMsg };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // 11. Suvit-Style Batch Auto-Posting of Bank Statement
  async postBankTransactionsToTally(transactions = [], bankLedgerName = 'HDFC Bank Ltd') {
    if (!transactions.length) {
      return { success: false, error: 'No transactions provided to post.' };
    }

    const companyInfo = await this.getTallyActiveCompany();
    if (!companyInfo.online) {
      return {
        success: false,
        error: `TallyPrime is not online on ${this.config.tallyUrl}. Please ensure Tally is open and company is loaded.`
      };
    }

    this.log('info', `🚀 Starting Suvit-Style Auto-Posting of ${transactions.length} transactions to Tally (${companyInfo.company})...`);

    // 1. Collect required ledgers and ensure they exist in Tally
    const ledgersToCreate = [];
    transactions.forEach(tx => {
      const isDebit = Number(tx.debit || 0) > 0;
      let mappedName = tx.suggestedLedger || tx.ledger;
      let parent = 'Indirect Expenses';
      if (!mappedName) {
        const m = this.mapBankNarrationToLedger(tx.narration, isDebit);
        mappedName = m.ledger;
        parent = m.parent;
      }
      ledgersToCreate.push({ name: mappedName, parent });
    });

    await this.ensureBankVoucherLedgersExist(bankLedgerName, ledgersToCreate);
    this.log('info', `✅ Tally Masters verified. Now creating Payment, Receipt & Contra vouchers...`);

    let postedCount = 0;
    let failedCount = 0;
    const results = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const res = await this.sendBankVoucherToTally(tx, bankLedgerName, companyInfo);

      if (res.success) {
        postedCount++;
        this.stats.totalSynced++;
        results.push({ index: i, success: true, refNo: tx.refNo });
      } else {
        failedCount++;
        this.stats.totalFailed++;
        results.push({ index: i, success: false, error: res.error });
      }

      this.emit('bank-post-progress', {
        current: i + 1,
        total: transactions.length,
        posted: postedCount,
        failed: failedCount,
        tx
      });
    }

    this.stats.lastSyncTime = new Date().toLocaleTimeString('en-IN');
    this.emit('stats-updated', { ...this.stats, isPaused: this.isPaused });

    const summaryMsg = `🏁 Bank Auto-Posting Finished: ${postedCount} Vouchers Created in Tally, ${failedCount} Failed.`;
    this.log(postedCount > 0 ? 'success' : 'warn', summaryMsg);

    return {
      success: postedCount > 0,
      total: transactions.length,
      posted: postedCount,
      failed: failedCount,
      company: companyInfo.company,
      results
    };
  }

  // 12. Query Tally for List of Bank Ledgers
  async getTallyBankLedgers() {
    const xml = `<ENVELOPE>
      <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
      <BODY>
        <EXPORTDATA>
          <REQUESTDESC>
            <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
            <REPORTNAME>List of Ledgers</REPORTNAME>
          </REQUESTDESC>
        </EXPORTDATA>
      </BODY>
    </ENVELOPE>`;

    const defaults = ['HDFC Bank Ltd', 'State Bank of India', 'ICICI Bank Ltd', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'Bank Account'];

    try {
      const res = await this.request(this.config.tallyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml)
        }
      }, xml);

      if (res.statusCode === 200 && res.body) {
        const ledgers = [];
        const re = /<NAME>(.*?)<\/NAME>/gi;
        let m;
        while ((m = re.exec(res.body)) !== null) {
          const lName = m[1].trim();
          if (/bank|hdfc|sbi|icici|axis|kotak|bob|pnb|canara/i.test(lName)) {
            ledgers.push(lName);
          }
        }
        if (ledgers.length) {
          return Array.from(new Set(ledgers));
        }
      }
      return defaults;
    } catch (e) {
      return defaults;
    }
  }
}

module.exports = TallySyncEngine;

