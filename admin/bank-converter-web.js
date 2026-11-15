/**
 * CA Kiran K. Shinde & Co. — Browser Client-Side Bank Statement PDF to Excel
 * 100% Client-Side, 0% AI, Exact Paisa-to-Paisa Accuracy, Zero Server Uploads.
 */

window.WebBankConverter = {
  initialized: false,

  init() {
    if (this.initialized) return;
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      this.initialized = true;
    }
  },

  cleanAmount(str) {
    if (!str) return 0;
    const clean = String(str).replace(/[₹,Rs.\s]/gi, '').replace(/[a-zA-Z]/g, '').trim();
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  },

  detectBank(text) {
    if (/HDFC\s*BANK/i.test(text)) return 'HDFC Bank';
    if (/STATE\s*BANK\s*OF\s*INDIA|SBI/i.test(text)) return 'State Bank of India (SBI)';
    if (/ICICI\s*BANK/i.test(text)) return 'ICICI Bank';
    if (/AXIS\s*BANK/i.test(text)) return 'Axis Bank';
    if (/KOTAK\s*MAHINDRA/i.test(text)) return 'Kotak Mahindra Bank';
    if (/BANK\s*OF\s*BARODA/i.test(text)) return 'Bank of Baroda';
    if (/PUNJAB\s*NATIONAL\s*BANK|PNB/i.test(text)) return 'Punjab National Bank (PNB)';
    if (/CANARA\s*BANK/i.test(text)) return 'Canara Bank';
    if (/UNION\s*BANK/i.test(text)) return 'Union Bank of India';
    if (/INDUSIND/i.test(text)) return 'IndusInd Bank';
    if (/IDFC/i.test(text)) return 'IDFC First Bank';
    if (/YES\s*BANK/i.test(text)) return 'Yes Bank';
    return 'Standard Indian Bank';
  },

  async extractTextFromPdf(file) {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    let pdf;
    let password;
    let triedEmptyPassword = false;

    // First attempt always opens the PDF without a password. Ask only if
    // PDF.js confirms that the document is encrypted and requires one.
    while (!pdf) {
      try {
        const data = new Uint8Array(arrayBuffer.slice(0));
        const options = password ? { data, password } : { data };
        pdf = await window.pdfjsLib.getDocument(options).promise;
      } catch (error) {
        const needsPassword = error && error.name === 'PasswordException' && (error.code === 1 || error.code === 2);
        if (!needsPassword) throw error;

        // Some PDFs are encrypted with an empty user password. PDF.js asks
        // for a password anyway, so try an empty one silently before prompting.
        if (error.code === 1 && !triedEmptyPassword) {
          triedEmptyPassword = true;
          password = '';
          continue;
        }

        const promptMsg = error.code === 2 && password
          ? '❌ Incorrect Password!\nPlease re-enter statement password:'
          : '🔒 This Bank Statement is Password-Protected.\n\nPlease enter the PDF Password (e.g. PAN in CAPS, DOB in DDMMYYYY, or Customer ID):';
        const userPwd = prompt(promptMsg);
        if (userPwd === null || !userPwd.trim()) {
          throw new Error('This PDF requires a password to open. Select it again and enter the statement password when prompted.');
        }
        password = userPwd.trim();
      }
    }
    let fullText = '';
    let extractedLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];

      if (!items.length) continue;

      // Filter valid text items with non-empty content
      const validItems = items
        .filter(it => it.str && it.str.trim().length > 0)
        .map(it => ({
          str: it.str.trim(),
          x: it.transform[4],
          y: it.transform[5]
        }));

      if (!validItems.length) continue;

      // Group items into rows by physical Y position (vertical coordinate)
      // Y goes bottom-to-top in PDF coordinate space, so sort Y descending
      validItems.sort((a, b) => b.y - a.y);

      let currentRowY = null;
      let currentRowItems = [];

      for (const item of validItems) {
        if (currentRowY === null || Math.abs(item.y - currentRowY) > 3.5) {
          if (currentRowItems.length) {
            // Sort items in this row from left to right (X ascending)
            currentRowItems.sort((a, b) => a.x - b.x);
            const lineText = currentRowItems.map(it => it.str).join(' ');
            extractedLines.push(lineText);
          }
          currentRowY = item.y;
          currentRowItems = [item];
        } else {
          currentRowItems.push(item);
        }
      }

      if (currentRowItems.length) {
        currentRowItems.sort((a, b) => a.x - b.x);
        extractedLines.push(currentRowItems.map(it => it.str).join(' '));
      }
    }

    fullText = extractedLines.join('\n');
    return { fullText, lines: extractedLines };
  },

  parseTransactions(lines) {
    const transactions = [];

    // Comprehensive Indian date regex:
    // Matches DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD-Mon-YYYY, DD Mon YYYY, YYYY-MM-DD
    // Tolerates leading Sl No (e.g. "1 01/04/2026" or "1. 01-Apr-2026")
    const dateRegex = /(?:^\s*(?:\d{1,5}[\.\)]\s*)?)(\b\d{1,2}[\/\-\.](?:\d{1,2}|[a-zA-Z]{3,9})[\/\-\.]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)/i;

    // Decimal currency amounts e.g. 1,250.00, 500.00, 12,34,567.89
    const amountRegex = /\b\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{2})\b/g;

    let currentTx = null;
    let lastKnownBalance = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip non-transaction headers and summaries
      if (/^(page\s+\d+|statement\s+of|branch\s+|account\s+number|ifsc|micr|customer\s+name|nominee|total\s+|b\/f|c\/f|generated\s+on)/i.test(line)) {
        continue;
      }

      const dateMatch = line.match(dateRegex);

      if (dateMatch) {
        // Save previous transaction if valid
        if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0 || currentTx.balance > 0)) {
          transactions.push(currentTx);
          if (currentTx.balance > 0) lastKnownBalance = currentTx.balance;
        }

        const dateStr = dateMatch[1];
        // Remove date and optional serial number from line to extract narration & amounts
        let restOfLine = line.replace(dateMatch[0], '').trim();

        // If line has a second date (e.g. Value Date), capture or strip it
        const secondDateMatch = restOfLine.match(dateRegex);
        if (secondDateMatch && restOfLine.indexOf(secondDateMatch[0]) < 20) {
          restOfLine = restOfLine.replace(secondDateMatch[0], '').trim();
        }

        const amountsFound = restOfLine.match(amountRegex) || [];
        const amounts = amountsFound.map(a => this.cleanAmount(a)).filter(a => a > 0);

        let debit = 0;
        let credit = 0;
        let balance = 0;

        let narration = restOfLine;
        amountsFound.forEach(amt => {
          narration = narration.replace(amt, ' ');
        });
        narration = narration.replace(/\s+/g, ' ').trim();

        // Extract Cheque / UTR / Reference number
        let refNo = '';
        const refMatch = narration.match(/(?:chq|cheque|ref|utr|upi|neft|rtgs|imps)[\/:\s]*([a-zA-Z0-9_-]{4,25})/i) ||
                         narration.match(/\b(\d{6,16})\b/);
        if (refMatch) refNo = refMatch[1];

        // Column Assignment Strategy
        if (amounts.length >= 3) {
          // Columns: Debit, Credit, Balance
          debit = amounts[0];
          credit = amounts[1];
          balance = amounts[2];
        } else if (amounts.length === 2) {
          const txnAmt = amounts[0];
          balance = amounts[1];

          // Determine Debit vs Credit
          const isExplicitCredit = /\b(cr|credit|by transfer|deposit|neft cr|upi cr|rtgs cr)\b/i.test(line);
          const isExplicitDebit = /\b(dr|debit|to transfer|withdrawal|chq|atm|pos|to clg)\b/i.test(line);

          if (isExplicitCredit) {
            credit = txnAmt;
          } else if (isExplicitDebit) {
            debit = txnAmt;
          } else if (lastKnownBalance !== null) {
            // Math validation: If balance increased -> Credit; if balance decreased -> Debit
            if (balance > lastKnownBalance) {
              credit = txnAmt;
            } else {
              debit = txnAmt;
            }
          } else {
            // Default fallback
            debit = txnAmt;
          }
        } else if (amounts.length === 1) {
          balance = amounts[0];
        }

        currentTx = {
          date: dateStr,
          narration: narration || 'Bank Transaction',
          refNo: refNo || '-',
          debit,
          credit,
          balance
        };
      } else if (currentTx) {
        // Multi-line narration or amounts on subsequent line
        const additionalAmounts = line.match(amountRegex) || [];
        if (additionalAmounts.length > 0 && currentTx.debit === 0 && currentTx.credit === 0) {
          const num = this.cleanAmount(additionalAmounts[0]);
          if (/\b(cr|credit|deposit)\b/i.test(line)) {
            currentTx.credit = num;
          } else {
            currentTx.debit = num;
          }
          if (additionalAmounts.length > 1 && currentTx.balance === 0) {
            currentTx.balance = this.cleanAmount(additionalAmounts[1]);
          }
        } else {
          // Append to narration
          if (!/^\d+$/.test(line) && line.length > 2) {
            currentTx.narration += ' ' + line;
          }
        }
      }
    }

    if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0 || currentTx.balance > 0)) {
      transactions.push(currentTx);
    }

    return transactions;
  },

  async convertFile(file) {
    const { fullText, lines } = await this.extractTextFromPdf(file);

    // Diagnostics for Scanned / Non-selectable PDFs
    if (!fullText || fullText.trim().length < 40) {
      throw new Error(
        '⚠️ Yeh PDF ek Scanned Image (Photo/Xerox) lag raha hai.\n\n' +
        'Isme selectable digital text nahi mila. Bank Statement converter sirf original digital PDF statements (jo Net Banking / Mobile Banking se download hoti hain) ko parse karta hai.\n\n' +
        'Solution: Kripya client se Net Banking se download ki hui Original PDF mangwayein.'
      );
    }

    const bankName = this.detectBank(fullText);
    const transactions = this.parseTransactions(lines);

    if (!transactions.length) {
      throw new Error(
        `PDF text was extracted (${lines.length} lines, detected as ${bankName}), but its transaction layout was not recognized. ` +
        `No statement text was shown to protect account details. Please share a redacted transaction-page sample so the parser can be matched to this bank's format.`
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;
    transactions.forEach(t => {
      totalDebit += t.debit || 0;
      totalCredit += t.credit || 0;
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    return {
      bankName,
      transactions,
      totalDebit,
      totalCredit,
      fileName: file.name
    };
  },

  downloadExcel(result) {
    if (!window.XLSX) return alert('Excel generator library is still loading, please wait 2 seconds...');

    const sheetData = [
      ['CA KIRAN K. SHINDE & CO. — CHARTERED ACCOUNTANTS'],
      [`Bank Statement Conversion Report • Bank: ${result.bankName}`],
      [`Source File: ${result.fileName} • Transactions: ${result.transactions.length}`],
      [''],
      ['SUMMARY AUDIT METRICS', 'AMOUNT (INR)'],
      ['Total Withdrawals (Debits)', result.totalDebit],
      ['Total Deposits (Credits)', result.totalCredit],
      ['Net Cash Flow', Math.round((result.totalCredit - result.totalDebit) * 100) / 100],
      [''],
      ['S.No', 'Transaction Date', 'Narration / Description', 'Cheque / Ref No', 'Withdrawal (Debit ₹)', 'Deposit (Credit ₹)', 'Closing Balance (₹)', 'Voucher Type']
    ];

    result.transactions.forEach((tx, idx) => {
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

    sheetData.push([
      'TOTAL',
      '',
      `Total of ${result.transactions.length} Transactions`,
      '',
      result.totalDebit,
      result.totalCredit,
      '',
      ''
    ]);

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(sheetData);

    ws['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 55 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 15 }
    ];

    window.XLSX.utils.book_append_sheet(wb, ws, 'Bank Transactions');
    const outName = `${result.fileName.replace(/\.pdf$/i, '')}_Clean_Statement.xlsx`;
    window.XLSX.writeFile(wb, outName);
  }
};

// Global UI Handlers & Drag-Drop Setup
let currentBankResult = null;

function escapeHtmlBank(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function handleWebBankFileSelect(files) {
  if (!files || !files.length) return;
  const file = files[0];
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please select a valid PDF bank statement file.');
    return;
  }

  const loadingEl = document.getElementById('webBankLoading');
  const resultCard = document.getElementById('webBankResultCard');

  if (loadingEl) loadingEl.style.display = 'block';
  if (resultCard) resultCard.style.display = 'none';

  try {
    const res = await window.WebBankConverter.convertFile(file);
    currentBankResult = res;

    // Update UI elements
    const bankBadge = document.getElementById('webResBankName');
    const fileLabel = document.getElementById('webResFileName');
    const countLabel = document.getElementById('webResCount');
    const debitLabel = document.getElementById('webResDebit');
    const creditLabel = document.getElementById('webResCredit');
    const previewBody = document.getElementById('webResPreviewBody');

    if (bankBadge) bankBadge.textContent = res.bankName;
    if (fileLabel) fileLabel.textContent = `${res.fileName} (${res.transactions.length} rows parsed)`;
    if (countLabel) countLabel.textContent = `${res.transactions.length} Rows`;
    if (debitLabel) debitLabel.textContent = `₹ ${res.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (creditLabel) creditLabel.textContent = `₹ ${res.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (previewBody) {
      const topRows = res.transactions.slice(0, 15);
      previewBody.innerHTML = topRows.map(tx => `
        <tr>
          <td><span style="font-weight:600; color:#334155;">${escapeHtmlBank(tx.date)}</span></td>
          <td style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtmlBank(tx.narration)}">${escapeHtmlBank(tx.narration)}</td>
          <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${escapeHtmlBank(tx.refNo || '-')}</code></td>
          <td style="color:#dc2626; font-weight:700;">${tx.debit > 0 ? '₹ ' + tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
          <td style="color:#16a34a; font-weight:700;">${tx.credit > 0 ? '₹ ' + tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
          <td style="font-weight:700; color:#0f172a;">${tx.balance > 0 ? '₹ ' + tx.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
        </tr>
      `).join('');
    }

    if (resultCard) resultCard.style.display = 'block';
  } catch (err) {
    console.error('PDF parsing error:', err);
    alert(err.message);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('webBankDropzone');
  const btnDownload = document.getElementById('btnDownloadWebExcel');

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.background = '#ecfdf5';
      dropzone.style.borderColor = '#059669';
    });
    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.style.background = '#f8fafc';
      dropzone.style.borderColor = '#10b981';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = '#f8fafc';
      dropzone.style.borderColor = '#10b981';
      if (e.dataTransfer && e.dataTransfer.files) {
        handleWebBankFileSelect(e.dataTransfer.files);
      }
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (!currentBankResult) {
        alert('Please select and convert a bank statement PDF first.');
        return;
      }
      window.WebBankConverter.downloadExcel(currentBankResult);
    });
  }
});
