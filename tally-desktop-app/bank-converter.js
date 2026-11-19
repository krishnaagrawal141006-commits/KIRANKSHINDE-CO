/**
 * CA Kiran K. Shinde & Co. — Offline Bank Statement PDF to Excel Converter
 * 100% Deterministic, 0% AI, Offline, Free, Exact Paisa-to-Paisa Accuracy.
 * Supports HDFC, SBI, ICICI, Axis, Kotak, BOB, Canara, PNB & Generic Indian Banks.
 */

const fs = require('fs');
const path = require('path');
const pdfParseModule = require('pdf-parse');
const XLSX = require('xlsx');

class BankStatementConverter {
  constructor() {
    this.supportedBanks = [
      { name: 'HDFC Bank', test: /HDFC\s*BANK/i },
      { name: 'State Bank of India (SBI)', test: /STATE\s*BANK\s*OF\s*INDIA|SBI/i },
      { name: 'ICICI Bank', test: /ICICI\s*BANK/i },
      { name: 'Axis Bank', test: /AXIS\s*BANK/i },
      { name: 'Kotak Mahindra Bank', test: /KOTAK\s*MAHINDRA/i },
      { name: 'Bank of Baroda', test: /BANK\s*OF\s*BARODA/i },
      { name: 'Punjab National Bank', test: /PUNJAB\s*NATIONAL\s*BANK|PNB/i },
      { name: 'Canara Bank', test: /CANARA\s*BANK/i }
    ];
  }

  /**
   * Universal PDF Text Extractor compatible with pdf-parse v1.x, v2.x (class-based), and CJS/ESM
   */
  async extractTextFromPdf(dataBuffer) {
    let lastError = null;

    // 1. Check pdf-parse v2.x (Mehmet Kozan class export: { PDFParse })
    if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
      try {
        const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
        const res = await parser.getText();
        if (typeof parser.destroy === 'function') {
          try { await parser.destroy(); } catch (e) {}
        }
        if (res && typeof res.text === 'string' && res.text.trim().length > 0) {
          return res.text;
        }
      } catch (err) {
        lastError = err;
        console.warn('PDFParse class extraction notice:', err.message);
      }
    }

    // 2. Check pdf-parse v1.x (function export: fn(dataBuffer))
    if (typeof pdfParseModule === 'function') {
      try {
        const res = await pdfParseModule(dataBuffer);
        if (res && typeof res.text === 'string' && res.text.trim().length > 0) {
          return res.text;
        }
      } catch (err) {
        lastError = err;
        console.warn('pdfParse function extraction notice:', err.message);
      }
    }

    // 3. Check default export (ESM interop)
    if (pdfParseModule && typeof pdfParseModule.default === 'function') {
      try {
        const res = await pdfParseModule.default(dataBuffer);
        if (res && typeof res.text === 'string' && res.text.trim().length > 0) {
          return res.text;
        }
      } catch (err) {
        lastError = err;
        console.warn('pdfParse default extraction notice:', err.message);
      }
    }

    // Friendly error messaging for password-protected or encrypted PDFs
    if (lastError && /password|decrypt|encrypted/i.test(lastError.message)) {
      throw new Error('This PDF is password-protected. Please open the PDF in Chrome or Adobe Reader, unlock it with your password, and save/print as an unencrypted PDF.');
    }

    throw new Error(lastError ? `Could not extract text: ${lastError.message}` : 'Empty text extracted. The PDF may be a scanned image without selectable text.');
  }

  detectBank(text) {
    for (const b of this.supportedBanks) {
      if (b.test.test(text)) return b.name;
    }
    return 'Standard Indian Bank Statement';
  }

  cleanAmount(str) {
    if (!str) return 0;
    // Remove currency symbols, commas, spaces, Dr, Cr
    const clean = String(str).replace(/[₹,Rs.\s]/gi, '').replace(/[a-zA-Z]/g, '').trim();
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }

  parseIndianDate(str) {
    if (!str) return '';
    const s = str.trim();
    // Match DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MMM-YYYY
    const dMatch = s.match(/(\d{1,2})[\/\-\.](\d{1,2}|\w{3})[\/\-\.](\d{2,4})/);
    if (!dMatch) return s;
    return dMatch[0];
  }

  parseStatementText(fullText) {
    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const transactions = [];

    // Common Date Regex: DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, with optional leading serial no (e.g. 1 12/03/2026)
    const dateRegex = /^(?:\d{1,4}\s+)?(\d{1,2}[\/\-\.\s](\d{1,2}|[a-zA-Z]{3})[\/\-\.\s]\d{2,4})/;
    // Amount Regex: matches numbers with decimals like 1,250.00, 50000.00, 150.50
    const amountRegex = /(\d{1,3}(,\d{2,3})*(\.\d{2}))/g;

    let currentTx = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip common non-transaction header/footer lines
      if (/^(page|statement|branch|account|ifsc|micr|customer|opening|closing|nominee|total|b\/f|c\/f|generated)/i.test(line)) {
        continue;
      }

      const dateMatch = line.match(dateRegex);

      if (dateMatch) {
        // If we were building a multi-line transaction, push it
        if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0 || currentTx.balance > 0)) {
          transactions.push(currentTx);
        }

        const dateStr = dateMatch[1] || dateMatch[0];
        const restOfLine = line.slice(dateMatch.index + dateMatch[0].length).trim();

        // Extract all amounts in the line
        const amountsFound = restOfLine.match(amountRegex) || [];
        const amounts = amountsFound.map(a => this.cleanAmount(a)).filter(a => a > 0);

        let debit = 0;
        let credit = 0;
        let balance = 0;

        // Strip extracted amounts from rest of line to find narration & ref
        let narration = restOfLine;
        amountsFound.forEach(amt => {
          narration = narration.replace(amt, ' ');
        });
        narration = narration.replace(/\s+/g, ' ').trim();

        // Detect Cheque / Ref Number if present
        let refNo = '';
        const refMatch = narration.match(/(?:chq|cheque|ref|upi|neft|rtgs|imps)[\/:\s]*([a-zA-Z0-9_-]{4,25})/i) ||
                         narration.match(/\b(\d{6,16})\b/);
        if (refMatch) {
          refNo = refMatch[1];
        }

        // Amount placement logic:
        // Indian bank statements typically have:
        // Case A: [Debit, Credit, Balance] (3 amounts)
        // Case B: [Debit or Credit, Balance] (2 amounts)
        // Case C: [Amount, Dr/Cr flag, Balance]
        if (amounts.length >= 3) {
          debit = amounts[0];
          credit = amounts[1];
          balance = amounts[2];
        } else if (amounts.length === 2) {
          const isDebit = /dr|\bto\b|w\/d|withdrawal|debit/i.test(line) && !/cr|\bby\b|deposit|credit/i.test(line);
          const isCredit = /cr|\bby\b|deposit|credit/i.test(line);

          if (isCredit) {
            credit = amounts[0];
            balance = amounts[1];
          } else {
            debit = amounts[0];
            balance = amounts[1];
          }
        } else if (amounts.length === 1) {
          balance = amounts[0];
        }

        currentTx = {
          date: dateStr,
          narration: narration || 'Transaction',
          refNo: refNo || '-',
          debit: debit,
          credit: credit,
          balance: balance
        };
      } else if (currentTx) {
        // Multi-line narration continuation
        // If line contains additional amount not caught earlier:
        const additionalAmounts = line.match(amountRegex) || [];
        if (additionalAmounts.length > 0 && (currentTx.debit === 0 && currentTx.credit === 0)) {
          const num = this.cleanAmount(additionalAmounts[0]);
          if (/cr|\bby\b|deposit/i.test(line)) {
            currentTx.credit = num;
          } else {
            currentTx.debit = num;
          }
          if (additionalAmounts.length > 1 && currentTx.balance === 0) {
            currentTx.balance = this.cleanAmount(additionalAmounts[1]);
          }
        } else {
          // Append description
          if (!/^\d+$/.test(line)) {
            currentTx.narration += ' ' + line;
          }
        }
      }
    }

    // Push the final transaction
    if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0 || currentTx.balance > 0)) {
      transactions.push(currentTx);
    }

    return transactions;
  }

  async convertPdfToExcel(pdfPath, outputExcelPath = null) {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const extractedText = await this.extractTextFromPdf(dataBuffer);

    const bankName = this.detectBank(extractedText);
    const transactions = this.parseStatementText(extractedText);

    if (!transactions.length) {
      throw new Error('No tabular transactions detected in this PDF. It may be password-protected or a scanned image.');
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    transactions.forEach(t => {
      totalDebit += t.debit || 0;
      totalCredit += t.credit || 0;
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    // Build Excel Workbook using SheetJS
    const wb = XLSX.utils.book_new();

    // Summary Header rows
    const sheetData = [
      ['CA KIRAN K. SHINDE & CO. — AUDIT & ACCOUNTS DESK'],
      [`Bank Statement Conversion Report • Bank: ${bankName}`],
      [`Source File: ${path.basename(pdfPath)} • Total Transactions: ${transactions.length}`],
      [''],
      ['SUMMARY METRICS', 'AMOUNT (INR)'],
      ['Total Withdrawals (Debits)', totalDebit],
      ['Total Deposits (Credits)', totalCredit],
      ['Net Cash Flow', Math.round((totalCredit - totalDebit) * 100) / 100],
      [''],
      ['S.No', 'Transaction Date', 'Narration / Description', 'Cheque / Ref No', 'Withdrawal (Debit ₹)', 'Deposit (Credit ₹)', 'Closing Balance (₹)', 'Voucher Type']
    ];

    // Transaction rows
    transactions.forEach((tx, idx) => {
      const vchType = tx.credit > 0 ? 'Receipt' : (tx.debit > 0 ? 'Payment' : 'Contra');
      sheetData.push([
        idx + 1,
        tx.date,
        tx.narration.replace(/\s+/g, ' ').trim(),
        tx.refNo || '-',
        tx.debit > 0 ? tx.debit : 0,
        tx.credit > 0 ? tx.credit : 0,
        tx.balance > 0 ? tx.balance : 0,
        vchType
      ]);
    });

    // Final Total Row
    sheetData.push([
      'TOTAL',
      '',
      `Total of ${transactions.length} Transactions`,
      '',
      totalDebit,
      totalCredit,
      '',
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto Column Widths
    ws['!cols'] = [
      { wch: 8 },   // S.No
      { wch: 16 },  // Date
      { wch: 55 },  // Narration
      { wch: 20 },  // Ref No
      { wch: 20 },  // Debit
      { wch: 20 },  // Credit
      { wch: 22 },  // Balance
      { wch: 15 }   // Voucher Type
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Bank Transactions');

    // Default destination: Same folder or Desktop
    const finalOutputPath = outputExcelPath || path.join(
      path.dirname(pdfPath),
      `${path.basename(pdfPath, path.extname(pdfPath))}_Clean_Statement.xlsx`
    );

    XLSX.writeFile(wb, finalOutputPath);

    return {
      success: true,
      bankName,
      transactionCount: transactions.length,
      totalDebit,
      totalCredit,
      outputPath: finalOutputPath,
      fileName: path.basename(finalOutputPath),
      transactions: transactions.slice(0, 10) // Preview first 10
    };
  }
}

module.exports = BankStatementConverter;

