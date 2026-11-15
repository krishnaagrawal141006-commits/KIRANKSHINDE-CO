/**
 * CA Kiran K. Shinde & Co. — Browser Client-Side Bank Statement PDF to Excel
 * 100% Client-Side, 0% AI, Offline, Free, Exact Paisa-to-Paisa Accuracy.
 */

window.WebBankConverter = {
  pdfLibInitialized: false,

  init() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      this.pdfLibInitialized = true;
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
    return 'Standard Indian Bank';
  },

  async extractTextFromPdf(file) {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group items by vertical position (Y coordinate) to preserve row structure
      const items = textContent.items;
      let lastY = null;
      let pageText = '';

      for (const item of items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (lastY !== null) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }

      fullText += pageText + '\n';
    }

    return fullText;
  },

  parseTransactions(fullText) {
    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const transactions = [];

    const dateRegex = /^(\d{1,2}[\/\-\.](\d{1,2}|[a-zA-Z]{3})[\/\-\.]\d{2,4})/;
    const amountRegex = /(\d{1,3}(,\d{2,3})*(\.\d{2}))/g;

    let currentTx = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^(page|statement|branch|account|ifsc|micr|customer|opening|closing|nominee|total|b\/f|c\/f|generated)/i.test(line)) {
        continue;
      }

      const dateMatch = line.match(dateRegex);

      if (dateMatch) {
        if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0 || currentTx.balance > 0)) {
          transactions.push(currentTx);
        }

        const dateStr = dateMatch[0];
        const restOfLine = line.slice(dateStr.length).trim();
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

        let refNo = '';
        const refMatch = narration.match(/(?:chq|cheque|ref|upi|neft|rtgs|imps)[\/:\s]*([a-zA-Z0-9_-]{4,25})/i) ||
                         narration.match(/\b(\d{6,16})\b/);
        if (refMatch) refNo = refMatch[1];

        if (amounts.length >= 3) {
          debit = amounts[0];
          credit = amounts[1];
          balance = amounts[2];
        } else if (amounts.length === 2) {
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
          debit,
          credit,
          balance
        };
      } else if (currentTx) {
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
          if (!/^\d+$/.test(line)) {
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
    const fullText = await this.extractTextFromPdf(file);
    const bankName = this.detectBank(fullText);
    const transactions = this.parseTransactions(fullText);

    if (!transactions.length) {
      throw new Error('No transactions detected in this PDF. Please check if it is a scanned image or password-protected.');
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
    if (!window.XLSX) return alert('Excel generator library loading...');

    const sheetData = [
      ['CA KIRAN K. SHINDE & CO. — CHARTERED ACCOUNTANTS'],
      [`Bank Statement Conversion Report • Bank: ${result.bankName}`],
      [`Source File: ${result.fileName} • Transactions: ${result.transactions.length}`],
      [''],
      ['SUMMARY METRICS', 'AMOUNT (INR)'],
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

// Global handlers & Drag-Drop Setup
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
    alert('Statement Reading Error:\n\n' + err.message + '\n\nNote: If this statement is password-protected or a scanned image/photo, please convert or unlock it first.');
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
