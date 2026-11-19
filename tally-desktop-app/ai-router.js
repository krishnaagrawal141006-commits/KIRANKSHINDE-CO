/**
 * CA Kiran K. Shinde & Co. — NaraRouter AI Integration
 * OpenAI-compatible multi-model gateway (https://router.bynara.id/v1)
 * Used for:
 *   1. Bank Statement Narration Auto-Categorization into Tally Ledgers
 *   2. CA Tax & Anomaly Detection
 */

const https = require('https');

class NaraRouterAI {
  constructor(apiKey = 'sk-nry--zwACm-Lwgf6szqLndzACvNqQcUHa3CoNH4EyfFvogg', baseUrl = 'https://router.bynara.id/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = 'deepseek-v4.1-flash-fast'; // Fast & optimized for Indian accounting narrations
  }

  request(endpoint, postData) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      const dataStr = JSON.stringify(postData);

      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(dataStr)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${body}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse AI response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('NaraRouter AI request timed out.'));
      });

      req.write(dataStr);
      req.end();
    });
  }

  /**
   * Classifies a batch of bank narrations into standard CA Tally Ledgers
   */
  async classifyNarrations(transactions = []) {
    if (!transactions.length) return [];

    const promptItems = transactions.map((tx, idx) => ({
      index: idx,
      narration: tx.narration,
      type: tx.debit > 0 ? 'Debit (Expense/Payment)' : 'Credit (Income/Deposit)',
      amount: tx.debit > 0 ? tx.debit : tx.credit
    }));

    const systemPrompt = `You are an expert Indian Chartered Accountant assistant for CA Kiran K. Shinde & Co.
Your job is to classify Indian Bank Statement narrations (UPI, NEFT, IMPS, POS, ATM, Netbanking) into standard TallyPrime Ledgers.

Standard Tally Ledgers list:
- Staff Welfare & Pantry Expense (Swiggy, Zomato, Dmart, Food, Groceries)
- Conveyance & Fuel Expenses (Petrol, HPCL, IOCL, BPCL, Uber, Ola)
- Telephone, Mobile & Internet (Jio, Airtel, Vodafone, BSNL)
- Printing, Stationery & Office Supplies (Xerox, Paper, Stationery)
- Professional Fees / Legal & Audit Fees (Fees received or paid)
- Bank Charges & Interest (SMS charges, Min balance fee, Locker fee, Interest)
- GST Payable / Tax Paid (CBIC, GST PMT-06, Income tax advance)
- Cash-in-Hand / ATM Contra (ATM wdl, Cash deposit)
- Sundry Debtors (Client payments received via UPI/NEFT)
- Sundry Creditors (Vendor/Supplier payments)
- Director / Partner Remuneration (Salaries, partner drawings)

Return ONLY a valid JSON array of objects with keys:
- "index": number
- "suggestedLedger": string (one of the standard Tally ledger names)
- "voucherType": string ("Payment" or "Receipt" or "Contra")
- "confidence": number (e.g. 0.95)`;

    const userPrompt = `Classify these bank statement items:\n${JSON.stringify(promptItems, null, 2)}`;

    try {
      const response = await this.request('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      });

      const content = response.choices?.[0]?.message?.content || '[]';
      // Strip markdown code fences if model wrapped in ```json
      const cleanJson = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const classifications = JSON.parse(cleanJson);

      return classifications;
    } catch (err) {
      console.error('NaraRouter Classification Error:', err.message);
      throw err;
    }
  }
}

module.exports = NaraRouterAI;

