/**
 * CA Kiran K. Shinde & Co. — Project Separation Engine
 * Safely copies current monorepo files into 2 clean separated projects:
 * 1. E:\kiran-website-frontend (Public Website + Client Upload Portal)
 * 2. E:\kiran-office-backend   (Admin Panel + TallyPrime + NaraRouter AI + APIs)
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = 'E:\\kiran k shinde & co';
const FRONTEND_DIR = 'E:\\kiran-website-frontend';
const BACKEND_DIR = 'E:\\kiran-office-backend';

function copyRecursiveSync(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (ignoreList.includes(entry)) continue;
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copyRecursiveSync(srcPath, destPath, ignoreList);
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('🚀 Starting project separation for CA Kiran K. Shinde & Co....\n');

// -------------------------------------------------------------
// 1. FRONTEND: kiran-website-frontend
// -------------------------------------------------------------
console.log('📦 1. Assembling Frontend: ' + FRONTEND_DIR);
if (!fs.existsSync(FRONTEND_DIR)) fs.mkdirSync(FRONTEND_DIR, { recursive: true });

const frontendFolders = ['assets', 'locations', 'portal'];
frontendFolders.forEach(folder => {
  const src = path.join(SOURCE_DIR, folder);
  const dest = path.join(FRONTEND_DIR, folder);
  if (fs.existsSync(src)) {
    console.log(`  -> Copying folder: ${folder}...`);
    copyRecursiveSync(src, dest);
  }
});

const frontendFiles = [
  'index.html',
  'app.js',
  'style.css',
  'services.html',
  'calculators.html',
  'knowledge-base.html',
  'review.html',
  'tax-hub.html',
  'tax-updates.html',
  'team.html',
  'team-data.js',
  'googled8f66905d91db3c0.html',
  'robots.txt',
  'sitemap.xml',
  'supabase-config.js',
  'supabase-config.example.js',
  'supabase-client.js',
  'vercel.json'
];

frontendFiles.forEach(file => {
  const src = path.join(SOURCE_DIR, file);
  const dest = path.join(FRONTEND_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  -> Copied file: ${file}`);
  }
});

// Create Frontend package.json
const frontendPkg = {
  name: 'kiran-website-frontend',
  version: '1.0.0',
  description: 'CA Kiran K. Shinde & Co. — Public Website & Client Portal',
  private: true,
  scripts: {
    dev: 'npx serve -l 3000 .',
    start: 'npx serve -l 3000 .'
  }
};
fs.writeFileSync(path.join(FRONTEND_DIR, 'package.json'), JSON.stringify(frontendPkg, null, 2));

// Create Frontend README.md
const frontendReadme = `# CA Kiran K. Shinde & Co. — Public Website & Client Portal

## Overview
This repository contains the official, public-facing website and client portal for **CA Kiran K. Shinde & Co.** (Chartered Accountants, Boisar & Palghar).

## Features
- **Public Website:** Services, About Us, Fee Estimator, Direct WhatsApp Consultation.
- **Client Billing Flow:** Multi-line service calculator, SAC 998231, dynamic UPI QR code generation, A4 Proforma Invoice printing.
- **Client Document Portal:** (/portal/upload.html) for fast and secure client document submissions.
- **SEO & Locations:** Over 350+ location-targeted pages for Tarapur MIDC, Boisar, Palghar, Wada, and surrounding industrial zones.

## Deployment
This project is configured for 1-click deployment on **Vercel** or **Netlify**.
`;
fs.writeFileSync(path.join(FRONTEND_DIR, 'README.md'), frontendReadme);

// Create Frontend .gitignore
const frontendGitignore = `node_modules/
.DS_Store
Thumbs.db
*.log
.vercel/
`;
fs.writeFileSync(path.join(FRONTEND_DIR, '.gitignore'), frontendGitignore);

console.log('✅ Frontend assembly complete!\n');

// -------------------------------------------------------------
// 2. BACKEND: kiran-office-backend
// -------------------------------------------------------------
console.log('📦 2. Assembling Backend & Admin: ' + BACKEND_DIR);
if (!fs.existsSync(BACKEND_DIR)) fs.mkdirSync(BACKEND_DIR, { recursive: true });

const backendFolders = ['admin', 'api', 'tally-connector', 'supabase', 'storage', 'scripts', 'docs'];
backendFolders.forEach(folder => {
  const src = path.join(SOURCE_DIR, folder);
  const dest = path.join(BACKEND_DIR, folder);
  if (fs.existsSync(src)) {
    console.log(`  -> Copying folder: ${folder}...`);
    copyRecursiveSync(src, dest);
  }
});

// For tally-desktop-app, copy excluding heavy node_modules & dist
console.log('  -> Copying tally-desktop-app (source & assets)...');
copyRecursiveSync(
  path.join(SOURCE_DIR, 'tally-desktop-app'),
  path.join(BACKEND_DIR, 'tally-desktop-app'),
  ['node_modules', 'dist']
);

const backendFiles = [
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

backendFiles.forEach(file => {
  const src = path.join(SOURCE_DIR, file);
  const dest = path.join(BACKEND_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  -> Copied file: ${file}`);
  }
});

// Create Backend package.json
const backendPkg = {
  name: 'kiran-office-backend',
  version: '1.0.0',
  description: 'CA Kiran K. Shinde & Co. — Office Admin Dashboard, Tally Connector & NaraRouter AI',
  private: true,
  scripts: {
    start: 'node local-server.js',
    'tally:bridge': 'node tally-bridge.js',
    'tally:desktop': 'cd tally-desktop-app && npm start',
    'tally:sync': 'cd tally-connector && node kiran-tally-sync.js'
  }
};
fs.writeFileSync(path.join(BACKEND_DIR, 'package.json'), JSON.stringify(backendPkg, null, 2));

// Create Backend README.md
const backendReadme = `# CA Kiran K. Shinde & Co. — Office Admin & Automation Backend

## Overview
This repository contains the internal office system, admin dashboard, serverless APIs, TallyPrime Cloud Sync, NaraRouter AI engine, and local client vault for **CA Kiran K. Shinde & Co.**

## Key Components
1. **Admin Dashboard (\`/admin\`):**
   - Client CRM, Proforma Invoices, Staff Task Allocation.
   - Google Calendar Sync.
   - Bank Statement Converter & Live NaraRouter AI Auto-tagger.
   - TallyPrime Live Cloud Sync Monitor.
2. **Tally Desktop App (\`/tally-desktop-app\`):**
   - Offline Bank PDF to Clean Excel Engine (100% deterministic, exact paisa accuracy).
   - NaraRouter AI Narration Classifier (\`deepseek-v4.1-flash-fast\`).
   - Client Local Vault (\`storage/clients/[Client_Name]_[ID]/\`) with 5 automated subfolders.
3. **Tally Connector (\`/tally-connector\`):**
   - Direct XML Bridge to TallyPrime (Port 9000).
   - Posts Optional Sales Vouchers without affecting P&L before clearance.
4. **Cloud Database (\`/supabase\`):**
   - Central schema for multi-terminal sync.
`;
fs.writeFileSync(path.join(BACKEND_DIR, 'README.md'), backendReadme);

// Create Backend .gitignore
const backendGitignore = `node_modules/
dist/
storage/clients/
*.log
.DS_Store
Thumbs.db
.env
`;
fs.writeFileSync(path.join(BACKEND_DIR, '.gitignore'), backendGitignore);

console.log('✅ Backend assembly complete!\n');
console.log('====================================================');
console.log('🎉 ALL DONE! Successfully created:');
console.log('1. ' + FRONTEND_DIR);
console.log('2. ' + BACKEND_DIR);
console.log('Original repository remains 100% untouched and safe.');
console.log('====================================================');
