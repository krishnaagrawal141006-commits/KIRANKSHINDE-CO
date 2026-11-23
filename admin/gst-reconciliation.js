/**
 * CA Kiran K. Shinde & Co. — GSTR-2B vs Tally Purchase Auto-Reconciliation Engine
 * 100% Client-Side Private • Instant ITC Risk Analysis • 1-Click WhatsApp Vendor Follow-Up
 * Detects:
 *   1. 100% Matched Invoices (Safe ITC)
 *   2. Missing in GSTR-2B (High Risk u/s 16(2)(aa) — Vendor hasn't filed GSTR-1)
 *   3. Missing in Tally (Unclaimed ITC — Bill missing in client accounting)
 *   4. Tax / Taxable Amount Discrepancies
 */

(function () {
  'use strict';

  class GstReconciliationEngine {
    constructor() {
      this.gstr2bInvoices = [];
      this.tallyInvoices = [];
      this.reconciliationResults = null;
      this.activeFilter = 'all';
      this.searchQuery = '';
    }

    // Helper: Normalize invoice number (removes '/', '-', spaces, leading zeros, lowercase)
    cleanInvoiceNo(invNo) {
      if (!invNo) return '';
      return String(invNo)
        .replace(/[^a-zA-Z0-9]/g, '')
        .replace(/^0+/, '')
        .toLowerCase()
        .trim();
    }

    // Helper: Clean GSTIN (uppercase, trimmed)
    cleanGstin(gstin) {
      if (!gstin) return '';
      return String(gstin).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    }

    // Helper: Parse numerical amounts safely
    cleanAmount(val) {
      if (val === null || val === undefined) return 0;
      const clean = String(val).replace(/[₹,Rs.\s]/gi, '').replace(/[a-zA-Z]/g, '').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }

    // 1. Parse GSTR-2B JSON File
    parseGstr2bJson(jsonContent) {
      let data = null;
      try {
        data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      } catch (e) {
        throw new Error('Invalid JSON format. Please ensure you uploaded an official GSTR-2B JSON file.');
      }

      const invoices = [];
      // Schema support: GSTN GSTR-2B v1 & v2 (data.docdata.b2b, b2b, docdata.b2b, etc.)
      const docData = data.data?.docdata || data.docdata || data;
      const b2bList = docData.b2b || [];

      if (!Array.isArray(b2bList) || !b2bList.length) {
        // Fallback: check if docdata itself has invoices or check b2ba
        if (data.b2b && Array.isArray(data.b2b)) {
          // direct b2b array
        } else {
          throw new Error('No B2B invoices found in this GSTR-2B JSON. Please check file structure.');
        }
      }

      const targetB2b = Array.isArray(b2bList) && b2bList.length ? b2bList : (data.b2b || []);

      targetB2b.forEach(supplier => {
        const ctin = this.cleanGstin(supplier.ctin);
        const supplierName = supplier.trdnm || supplier.lgnm || `Supplier (${ctin})`;

        const invList = supplier.inv || [];
        invList.forEach(inv => {
          const inum = String(inv.inum || '').trim();
          const idt = String(inv.idt || '').trim();
          const val = this.cleanAmount(inv.val);
          const itcAvl = inv.itcavl !== 'N';

          let txval = 0;
          let igst = 0;
          let cgst = 0;
          let sgst = 0;

          if (Array.isArray(inv.items)) {
            inv.items.forEach(it => {
              const itemDetails = it.itm_det || it;
              txval += this.cleanAmount(itemDetails.txval);
              igst += this.cleanAmount(itemDetails.iamt || itemDetails.igst);
              cgst += this.cleanAmount(itemDetails.camt || itemDetails.cgst);
              sgst += this.cleanAmount(itemDetails.samt || itemDetails.sgst);
            });
          }

          const totalTax = Math.round((igst + cgst + sgst) * 100) / 100;

          invoices.push({
            source: 'GSTR-2B',
            gstin: ctin,
            supplierName,
            invoiceNo: inum,
            normalizedInvNo: this.cleanInvoiceNo(inum),
            invoiceDate: idt,
            totalAmount: val || (txval + totalTax),
            taxableValue: Math.round(txval * 100) / 100,
            igst: Math.round(igst * 100) / 100,
            cgst: Math.round(cgst * 100) / 100,
            sgst: Math.round(sgst * 100) / 100,
            totalTax,
            itcAvailable: itcAvl
          });
        });
      });

      return invoices;
    }

    // 2. Parse Tally Purchase Register (Excel / CSV)
    parseTallyPurchaseExcel(workbook) {
      if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
        throw new Error('Invalid Excel file. No worksheets found.');
      }

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rawRows || rawRows.length < 2) {
        throw new Error('Excel sheet appears to be empty.');
      }

      // Find Header Row (looks for "Date", "Particulars", "Voucher", "GSTIN", "Taxable", "Total")
      let headerRowIndex = -1;
      let colMap = {};

      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r].map(c => String(c).trim().toLowerCase());
        const hasDate = row.some(c => c.includes('date'));
        const hasParty = row.some(c => c.includes('particular') || c.includes('party') || c.includes('supplier'));
        const hasTotal = row.some(c => c.includes('total') || c.includes('amount') || c.includes('gross') || c.includes('value'));

        if ((hasDate && hasParty) || (hasParty && hasTotal)) {
          headerRowIndex = r;
          row.forEach((colName, cIdx) => {
            if (colName.includes('date')) colMap.date = cIdx;
            else if (colName.includes('particular') || colName.includes('party') || colName.includes('supplier') || colName.includes('vendor')) colMap.party = cIdx;
            else if (colName.includes('gstin') || colName.includes('uin')) colMap.gstin = cIdx;
            else if (colName.includes('voucher no') || colName.includes('inv no') || colName.includes('invoice no') || colName.includes('ref no')) colMap.invNo = cIdx;
            else if (colName.includes('taxable') || colName.includes('assessable')) colMap.taxable = cIdx;
            else if (colName.includes('integrated') || colName.includes('igst')) colMap.igst = cIdx;
            else if (colName.includes('central') || colName.includes('cgst')) colMap.cgst = cIdx;
            else if (colName.includes('state') || colName.includes('sgst') || colName.includes('utgst')) colMap.sgst = cIdx;
            else if (colName.includes('gross') || colName.includes('total') || colName.includes('net')) colMap.total = cIdx;
          });
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Fallback default column order if explicit headers not detected
        colMap = { date: 0, party: 1, invNo: 2, gstin: 3, taxable: 4, igst: 5, cgst: 6, sgst: 7, total: 8 };
        headerRowIndex = 0;
      }

      const invoices = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !row.length) continue;

        const partyName = String(row[colMap.party] || '').trim();
        // Skip grand total or summary rows
        if (!partyName || /^(grand total|total|sub total|closing balance)/i.test(partyName)) continue;

        const rawDate = row[colMap.date];
        let dateStr = '';
        if (typeof rawDate === 'number') {
          // Excel serial date conversion
          const d = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
          dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        } else {
          dateStr = String(rawDate || '').trim();
        }

        const invNo = String(row[colMap.invNo] || '').trim();
        let gstin = this.cleanGstin(row[colMap.gstin] || '');

        // Try extracting GSTIN from party name if column was empty (e.g. "Tata Teleservices - 27AAACT2727Q1ZU")
        if (!gstin && partyName) {
          const match = partyName.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/);
          if (match) gstin = match[1];
        }

        const taxable = this.cleanAmount(row[colMap.taxable]);
        const igst = this.cleanAmount(row[colMap.igst]);
        const cgst = this.cleanAmount(row[colMap.cgst]);
        const sgst = this.cleanAmount(row[colMap.sgst]);
        let total = this.cleanAmount(row[colMap.total]);
        const totalTax = Math.round((igst + cgst + sgst) * 100) / 100;

        if (!total && taxable) {
          total = Math.round((taxable + totalTax) * 100) / 100;
        }

        if (taxable > 0 || total > 0 || totalTax > 0) {
          invoices.push({
            source: 'Tally',
            gstin: gstin || 'UNREGISTERED',
            supplierName: partyName,
            invoiceNo: invNo || `VCH-${r}`,
            normalizedInvNo: this.cleanInvoiceNo(invNo || `VCH-${r}`),
            invoiceDate: dateStr,
            totalAmount: total,
            taxableValue: taxable,
            igst,
            cgst,
            sgst,
            totalTax
          });
        }
      }

      return invoices;
    }

    // 3. Main Reconciliation Matching Engine
    reconcile(gstr2bInvoices = [], tallyInvoices = []) {
      this.gstr2bInvoices = gstr2bInvoices;
      this.tallyInvoices = tallyInvoices;

      const matched = [];
      const missingIn2B = []; // In Tally, missing in GSTR-2B -> HIGH ITC RISK!
      const missingInTally = []; // In 2B, missing in Tally -> Unclaimed ITC!
      const taxMismatch = []; // Match found, but tax differs by > ₹2.00

      const matched2BIndices = new Set();
      const matchedTallyIndices = new Set();

      // Step 1: Match Tally against GSTR-2B
      tallyInvoices.forEach((tInv, tIdx) => {
        let bestMatchIdx = -1;
        let bestMatchReason = '';

        for (let gIdx = 0; gIdx < gstr2bInvoices.length; gIdx++) {
          if (matched2BIndices.has(gIdx)) continue;
          const gInv = gstr2bInvoices[gIdx];

          // Condition 1: Exact GSTIN & Exact Normalized Inv Number
          const isGstinMatch = tInv.gstin === 'UNREGISTERED' || !tInv.gstin || (tInv.gstin === gInv.gstin);
          const isInvMatch = tInv.normalizedInvNo && gInv.normalizedInvNo && (tInv.normalizedInvNo === gInv.normalizedInvNo);

          if (isInvMatch && isGstinMatch) {
            bestMatchIdx = gIdx;
            bestMatchReason = 'EXACT';
            break;
          }

          // Condition 2: Same GSTIN & Exact Tax Amounts Match & Total Match within ₹2.00
          if (isGstinMatch && Math.abs(tInv.totalTax - gInv.totalTax) <= 2.0 && Math.abs(tInv.totalAmount - gInv.totalAmount) <= 5.0) {
            // Also check if invoice numbers contain common substrings (e.g. "45" in "INV-45")
            if (tInv.normalizedInvNo.includes(gInv.normalizedInvNo) || gInv.normalizedInvNo.includes(tInv.normalizedInvNo)) {
              bestMatchIdx = gIdx;
              bestMatchReason = 'FUZZY';
              break;
            }
          }
        }

        if (bestMatchIdx !== -1) {
          const gInv = gstr2bInvoices[bestMatchIdx];
          matched2BIndices.add(bestMatchIdx);
          matchedTallyIndices.add(tIdx);

          const taxDiff = Math.abs(tInv.totalTax - gInv.totalTax);
          const taxableDiff = Math.abs(tInv.taxableValue - gInv.taxableValue);

          if (taxDiff <= 2.0 && taxableDiff <= 5.0) {
            matched.push({
              status: 'MATCHED',
              badgeColor: '#10b981',
              tally: tInv,
              gstr2b: gInv,
              taxDiff: 0,
              remarks: '100% ITC Matched & Eligible'
            });
          } else {
            taxMismatch.push({
              status: 'TAX_MISMATCH',
              badgeColor: '#3b82f6',
              tally: tInv,
              gstr2b: gInv,
              taxDiff: Math.round((tInv.totalTax - gInv.totalTax) * 100) / 100,
              taxableDiff: Math.round((tInv.taxableValue - gInv.taxableValue) * 100) / 100,
              remarks: `Tax Diff: ₹${Math.abs(tInv.totalTax - gInv.totalTax).toFixed(2)}`
            });
          }
        } else {
          // Missing in GSTR-2B -> HIGH ITC RISK!
          missingIn2B.push({
            status: 'MISSING_IN_2B',
            badgeColor: '#ef4444',
            tally: tInv,
            gstr2b: null,
            taxDiff: tInv.totalTax,
            remarks: '⚠️ Missing in 2B (ITC Blocked u/s 16(2)(aa) — Vendor pending GSTR-1)'
          });
        }
      });

      // Step 2: Invoices remaining in GSTR-2B that are not in Tally
      gstr2bInvoices.forEach((gInv, gIdx) => {
        if (!matched2BIndices.has(gIdx)) {
          missingInTally.push({
            status: 'MISSING_IN_TALLY',
            badgeColor: '#f59e0b',
            tally: null,
            gstr2b: gInv,
            taxDiff: gInv.totalTax,
            remarks: '💡 Missing in Tally (Unclaimed ITC — Record in books)'
          });
        }
      });

      // Compute Totals
      let total2bTax = 0;
      gstr2bInvoices.forEach(i => total2bTax += i.totalTax);

      let totalTallyTax = 0;
      tallyInvoices.forEach(i => totalTallyTax += i.totalTax);

      let matchedTax = 0;
      matched.forEach(i => matchedTax += i.tally.totalTax);

      let atRiskTax = 0;
      missingIn2B.forEach(i => atRiskTax += i.tally.totalTax);

      let unclaimedTax = 0;
      missingInTally.forEach(i => unclaimedTax += i.gstr2b.totalTax);

      this.reconciliationResults = {
        timestamp: new Date().toISOString(),
        matched,
        missingIn2B,
        missingInTally,
        taxMismatch,
        all: [...matched, ...taxMismatch, ...missingIn2B, ...missingInTally],
        kpis: {
          total2bCount: gstr2bInvoices.length,
          total2bTax: Math.round(total2bTax * 100) / 100,
          totalTallyCount: tallyInvoices.length,
          totalTallyTax: Math.round(totalTallyTax * 100) / 100,
          matchedCount: matched.length,
          matchedTax: Math.round(matchedTax * 100) / 100,
          atRiskCount: missingIn2B.length,
          atRiskTax: Math.round(atRiskTax * 100) / 100,
          unclaimedCount: missingInTally.length,
          unclaimedTax: Math.round(unclaimedTax * 100) / 100,
          mismatchCount: taxMismatch.length
        }
      };

      return this.reconciliationResults;
    }

    // 4. Generate 1-Click WhatsApp Vendor Follow-Up Link
    generateWhatsAppReminderUrl(item) {
      const t = item.tally;
      if (!t) return '#';

      const vendorName = t.supplierName || 'Supplier';
      const invNo = t.invoiceNo || '-';
      const invDate = t.invoiceDate || 'recent date';
      const grossAmt = Number(t.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const taxAmt = Number(t.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const gstin = t.gstin && t.gstin !== 'UNREGISTERED' ? `(GSTIN: ${t.gstin})` : '';

      const msg = `Dear ${vendorName} ${gstin},\n\n` +
        `Greetings from CA Kiran K. Shinde & Co. (Auditors).\n\n` +
        `During our purchase register vs GSTR-2B reconciliation, we noticed that your invoice has NOT appeared in our GSTR-2B:\n\n` +
        `📄 Invoice No: ${invNo}\n` +
        `📅 Date: ${invDate}\n` +
        `💰 Total Amount: ₹${grossAmt}\n` +
        `⚖️ Input Tax Credit (ITC): ₹${taxAmt}\n\n` +
        `Under GST Section 16(2)(aa), ITC cannot be claimed by our client until you upload this invoice in your GSTR-1.\n\n` +
        `Kindly upload this invoice in your upcoming GSTR-1 return immediately to avoid blocking of ITC & statutory interest.\n\n` +
        `Thank you,\n` +
        `CA Kiran K. Shinde & Co.\n` +
        `Chartered Accountants | Pune`;

      return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }

    // 5. Export 3-Sheet Excel Reconciliation Report
    exportToExcel() {
      if (!this.reconciliationResults) {
        alert('Please run reconciliation first before exporting.');
        return;
      }

      const res = this.reconciliationResults;
      const wb = window.XLSX.utils.book_new();

      // Sheet 1: Executive Summary
      const summaryData = [
        ['CA KIRAN K. SHINDE & CO. — CHARTERED ACCOUNTANTS'],
        ['GSTR-2B VS TALLY PURCHASE AUDIT RECONCILIATION REPORT'],
        ['Generated Date', new Date().toLocaleString('en-IN')],
        [''],
        ['SUMMARY METRICS', 'COUNT', 'TOTAL TAX (ITC ₹)'],
        ['GSTR-2B Total Invoices (GST Portal)', res.kpis.total2bCount, res.kpis.total2bTax],
        ['Tally Purchase Register Booked', res.kpis.totalTallyCount, res.kpis.totalTallyTax],
        ['100% Reconciled (Safe ITC Claimed)', res.kpis.matchedCount, res.kpis.matchedTax],
        ['⚠️ MISSING IN GSTR-2B (AT-RISK ITC u/s 16(2)(aa))', res.kpis.atRiskCount, res.kpis.atRiskTax],
        ['💡 MISSING IN TALLY (UNCLAIMED ITC IN BOOKS)', res.kpis.unclaimedCount, res.kpis.unclaimedTax],
        ['TAX / AMOUNT DISCREPANCIES', res.kpis.mismatchCount, '-']
      ];
      const wsSummary = window.XLSX.utils.aoa_to_sheet(summaryData);
      window.XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Sheet 2: Matched Invoices
      const matchedRows = [
        ['Supplier Name', 'GSTIN', 'Tally Inv No', '2B Inv No', 'Invoice Date', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'Total Tax (₹)', 'Gross Amount (₹)', 'Status']
      ];
      res.matched.forEach(m => {
        matchedRows.push([
          m.tally.supplierName,
          m.tally.gstin,
          m.tally.invoiceNo,
          m.gstr2b.invoiceNo,
          m.tally.invoiceDate,
          m.tally.taxableValue,
          m.tally.igst,
          m.tally.cgst,
          m.tally.sgst,
          m.tally.totalTax,
          m.tally.totalAmount,
          '100% Matched'
        ]);
      });
      const wsMatched = window.XLSX.utils.aoa_to_sheet(matchedRows);
      window.XLSX.utils.book_append_sheet(wb, wsMatched, '100% Matched ITC');

      // Sheet 3: At Risk (Missing in GSTR-2B)
      const atRiskRows = [
        ['Supplier Name', 'GSTIN', 'Tally Inv No', 'Invoice Date', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'At-Risk ITC Tax (₹)', 'Gross Amount (₹)', 'Issue / Reason']
      ];
      res.missingIn2B.forEach(m => {
        atRiskRows.push([
          m.tally.supplierName,
          m.tally.gstin,
          m.tally.invoiceNo,
          m.tally.invoiceDate,
          m.tally.taxableValue,
          m.tally.igst,
          m.tally.cgst,
          m.tally.sgst,
          m.tally.totalTax,
          m.tally.totalAmount,
          'Vendor has not filed GSTR-1 (ITC Blocked u/s 16(2)(aa))'
        ]);
      });
      const wsAtRisk = window.XLSX.utils.aoa_to_sheet(atRiskRows);
      window.XLSX.utils.book_append_sheet(wb, wsAtRisk, 'ITC At Risk (Vendor Pending)');

      // Download
      window.XLSX.writeFile(wb, `GSTR-2B_vs_Tally_Recon_${Date.now().toString().slice(-6)}.xlsx`);
    }

    // 6. Generate Realistic Sample Dataset for Instant Demo
    loadSampleDataset() {
      const sample2b = [
        {
          source: 'GSTR-2B',
          gstin: '27AAACT2727Q1ZU',
          supplierName: 'Tata Teleservices Maharashtra Ltd',
          invoiceNo: 'TTML-2026-904',
          normalizedInvNo: 'ttml2026904',
          invoiceDate: '14-10-2026',
          totalAmount: 11800.00,
          taxableValue: 10000.00,
          igst: 0,
          cgst: 900.00,
          sgst: 900.00,
          totalTax: 1800.00,
          itcAvailable: true
        },
        {
          source: 'GSTR-2B',
          gstin: '27AABCS1429B1Z8',
          supplierName: 'Shree Ganesh Logistics & Warehousing',
          invoiceNo: 'SGL-1048',
          normalizedInvNo: 'sgl1048',
          invoiceDate: '08-10-2026',
          totalAmount: 47200.00,
          taxableValue: 40000.00,
          igst: 0,
          cgst: 3600.00,
          sgst: 3600.00,
          totalTax: 7200.00,
          itcAvailable: true
        },
        {
          source: 'GSTR-2B',
          gstin: '27AAACL5842N1ZR',
          supplierName: 'Krishna Textile Processors Pvt Ltd',
          invoiceNo: 'KTP-409',
          normalizedInvNo: 'ktp409',
          invoiceDate: '19-10-2026',
          totalAmount: 88500.00,
          taxableValue: 75000.00,
          igst: 0,
          cgst: 6750.00,
          sgst: 6750.00,
          totalTax: 13500.00,
          itcAvailable: true
        },
        {
          source: 'GSTR-2B',
          gstin: '27AAECM4012P1ZS',
          supplierName: 'Mahindra Auto Spares & Ancillary',
          invoiceNo: 'MAS-2026-08',
          normalizedInvNo: 'mas202608',
          invoiceDate: '22-10-2026',
          totalAmount: 23600.00,
          taxableValue: 20000.00,
          igst: 0,
          cgst: 1800.00,
          sgst: 1800.00,
          totalTax: 3600.00,
          itcAvailable: true
        }
      ];

      const sampleTally = [
        {
          source: 'Tally',
          gstin: '27AAACT2727Q1ZU',
          supplierName: 'Tata Teleservices Maharashtra Ltd',
          invoiceNo: 'TTML-2026-904',
          normalizedInvNo: 'ttml2026904',
          invoiceDate: '14-10-2026',
          totalAmount: 11800.00,
          taxableValue: 10000.00,
          igst: 0,
          cgst: 900.00,
          sgst: 900.00,
          totalTax: 1800.00
        },
        {
          source: 'Tally',
          gstin: '27AABCS1429B1Z8',
          supplierName: 'Shree Ganesh Logistics & Warehousing',
          invoiceNo: 'SGL-1048',
          normalizedInvNo: 'sgl1048',
          invoiceDate: '08-10-2026',
          totalAmount: 47200.00,
          taxableValue: 40000.00,
          igst: 0,
          cgst: 3600.00,
          sgst: 3600.00,
          totalTax: 7200.00
        },
        {
          source: 'Tally',
          gstin: '27AAACL5842N1ZR',
          supplierName: 'Krishna Textile Processors Pvt Ltd',
          invoiceNo: 'KTP-409',
          normalizedInvNo: 'ktp409',
          invoiceDate: '19-10-2026',
          totalAmount: 88500.00,
          taxableValue: 75000.00,
          igst: 0,
          cgst: 6750.00,
          sgst: 6750.00,
          totalTax: 13500.00
        },
        // Missing in GSTR-2B (High Risk!)
        {
          source: 'Tally',
          gstin: '27AABCR8014E1ZQ',
          supplierName: 'Reliance Retail Ventures Ltd',
          invoiceNo: 'RRVL/PUN/2026/89',
          normalizedInvNo: 'rrvlpun202689',
          invoiceDate: '26-10-2026',
          totalAmount: 64900.00,
          taxableValue: 55000.00,
          igst: 0,
          cgst: 4950.00,
          sgst: 4950.00,
          totalTax: 9900.00
        },
        // Missing in GSTR-2B (High Risk!)
        {
          source: 'Tally',
          gstin: '27AACCA1100F1ZM',
          supplierName: 'Adani Electricity & Power Spares',
          invoiceNo: 'ADE-114',
          normalizedInvNo: 'ade114',
          invoiceDate: '28-10-2026',
          totalAmount: 35400.00,
          taxableValue: 30000.00,
          igst: 5400.00,
          cgst: 0,
          sgst: 0,
          totalTax: 5400.00
        }
      ];

      return this.reconcile(sample2b, sampleTally);
    }
  }

  window.GstReconciliationEngine = GstReconciliationEngine;
})();
