/**
 * Copy SaaS Backend, Admin, Tally, AI, and APIs into E:\finnboook
 * Does NOT delete or modify anything in E:\kiran k shinde & co.
 */

const fs = require('fs');
const path = require('path');

const SRC = 'E:\\kiran k shinde & co';
const DEST = 'E:\\finnboook';

function copyRecursiveSync(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (ignoreList.includes(entry)) continue;
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry), ignoreList);
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('🚀 Copying SaaS modules into ' + DEST + '...');

if (!fs.existsSync(DEST)) {
  fs.mkdirSync(DEST, { recursive: true });
}

// 1. Core folders
const folders = ['admin', 'api', 'tally-connector', 'supabase', 'storage', 'scripts', 'docs'];
folders.forEach(f => {
  console.log('  -> Copying folder:', f);
  copyRecursiveSync(path.join(SRC, f), path.join(DEST, f));
});

// 2. Tally Desktop App (excluding heavy build dist and node_modules)
console.log('  -> Copying tally-desktop-app (source & assets)...');
copyRecursiveSync(path.join(SRC, 'tally-desktop-app'), path.join(DEST, 'tally-desktop-app'), ['node_modules', 'dist']);

// 3. Core files & batch runners
const files = [
  'pay.html',
  'vercel.json',
  'local-server.js',
  'tally-bridge.js',
  'supabase-config.js',
  'supabase-config.example.js',
  'supabase-client.js',
  'CA_Kiran_Tally_Connector_AI_Master_Plan.docx',
  'START TALLY DESKTOP APP.bat',
  'START TALLY BRIDGE.bat',
  'BUILD TALLY EXE.bat',
  'LAUNCH TALLY DESKTOP APP.bat',
  'START-TALLY-SYNC.bat'
];

files.forEach(f => {
  const s = path.join(SRC, f);
  if (fs.existsSync(s)) {
    console.log('  -> Copying file:', f);
    fs.copyFileSync(s, path.join(DEST, f));
  }
});

// 4. Finnboook package.json
const pkg = {
  name: 'finnboook',
  version: '1.0.0',
  description: 'Finnboook — AI Powered Accounting Automation & TallyPrime SaaS',
  private: true,
  scripts: {
    start: 'node local-server.js',
    'tally:bridge': 'node tally-bridge.js',
    'tally:desktop': 'cd tally-desktop-app && npm start',
    'tally:sync': 'cd tally-connector && node kiran-tally-sync.js'
  }
};
fs.writeFileSync(path.join(DEST, 'package.json'), JSON.stringify(pkg, null, 2));

// 5. Finnboook README.md
const readme = `# Finnboook 🚀
**AI-Powered Accounting Automation, Bank Statement to Excel & TallyPrime Cloud Sync SaaS**

## Overview
Finnboook is a modern B2B SaaS platform designed for Chartered Accountants, Tax Professionals, Bookkeepers, and SMEs.

## Key SaaS Modules:
1. **Admin & Client CRM Desk (\`/admin\`):**
   - Multi-firm practice management.
   - Staff task allocation & statutory deadlines (GST, ITR, ROC).
   - Google Calendar live synchronization.
   - Proforma Invoicing with automated dynamic UPI QR code.

2. **Bank PDF to Clean Excel Engine (\`/tally-desktop-app\` & \`/admin\`):**
   - 100% deterministic, exact paisa-to-paisa mathematical verification.
   - NaraRouter AI Narration Auto-Tagging (\`deepseek-v4.1-flash-fast\`) into standard Tally ledgers.
   - Supports HDFC, SBI, ICICI, Axis, Kotak, BOB, Canara, PNB & Indian bank statements.

3. **TallyPrime Cloud Sync Connector (\`/tally-connector\`):**
   - Direct XML Bridge to local TallyPrime (Port 9000).
   - Posts Optional Vouchers (\`<ISOPTIONAL>Yes</ISOPTIONAL>\`) to protect P&L before approval.
   - Automated Master Ledger creation with CGST / SGST / IGST breakdown.

4. **Automated Client Local Vault (\`/storage/clients\`):**
   - Auto-creates standardized compliance directories:
     - \`01_KYC_and_Certificates\`
     - \`02_GST_Documents\`
     - \`03_Income_Tax_and_Audit\`
     - \`04_Bank_Statements_and_Bills\`
     - \`05_CA_Employee_Work_Papers\`

## Running the App
- Run Admin Local Server: \`npm start\`
- Run Tally Desktop Connector: Double-click \`START TALLY DESKTOP APP.bat\`
`;
fs.writeFileSync(path.join(DEST, 'README.md'), readme);

// 6. Finnboook .gitignore
const gitignore = `node_modules/
dist/
storage/clients/
*.log
.DS_Store
Thumbs.db
.env
`;
fs.writeFileSync(path.join(DEST, '.gitignore'), gitignore);

console.log('\n🎉 ALL DONE! Finnboook successfully created at E:\\finnboook');
console.log('Original repository E:\\kiran k shinde & co is 100% untouched and safe.');

