/**
/**
 * CA Kiran K. Shinde & Co. — Client Document Vault & Local Storage Engine
 * Automatically creates and organizes client folders on local office PC:
 *   ├── 01_KYC_and_Certificates
 *   ├── 02_GST_Documents
 *   ├── 03_Income_Tax_and_Audit
 *   ├── 04_Bank_Statements_and_Bills
 *   └── 05_CA_Employee_Work_Papers
 */

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

class ClientVaultManager {
  constructor(customStorageRoot = null) {
    // Default to 'storage/clients' in root or app directory
    this.storageRoot = customStorageRoot || path.resolve(__dirname, '..', 'storage', 'clients');
    this.ensureRoot();
  }

  ensureRoot() {
    try {
      if (!fs.existsSync(this.storageRoot)) {
        fs.mkdirSync(this.storageRoot, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create storage root:', e);
    }
  }

  sanitizeName(name = 'Client') {
    return String(name || 'Client')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
  }

  /**
   * Ensures client folder and standard 5 subcategories exist
   */
  ensureClientFolder(clientName, panOrId = '') {
    this.ensureRoot();
    const cleanClient = this.sanitizeName(clientName);
    const cleanId = panOrId ? `_${this.sanitizeName(panOrId)}` : '';
    const folderName = `${cleanClient}${cleanId}`;
    const clientPath = path.join(this.storageRoot, folderName);

    const subfolders = {
      kyc: path.join(clientPath, '01_KYC_and_Certificates'),
      gst: path.join(clientPath, '02_GST_Documents'),
      tax: path.join(clientPath, '03_Income_Tax_and_Audit'),
      bank: path.join(clientPath, '04_Bank_Statements_and_Bills'),
      workPapers: path.join(clientPath, '05_CA_Employee_Work_Papers')
    };

    try {
      if (!fs.existsSync(clientPath)) {
        fs.mkdirSync(clientPath, { recursive: true });
      }
      for (const dir of Object.values(subfolders)) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (e) {
      console.error('Error creating client subfolders:', e);
    }

    return {
      folderName,
      clientPath,
      subfolders
    };
  }

  /**
   * Saves a generated Proforma Invoice copy into client's working papers
   */
  saveProformaDocument(clientName, panOrId, invoiceNo, htmlContent, metadata = {}) {
    try {
      const { subfolders } = this.ensureClientFolder(clientName, panOrId);
      const safeInv = String(invoiceNo || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Proforma_${safeInv}.html`;
      const filePath = path.join(subfolders.workPapers, fileName);
      
      fs.writeFileSync(filePath, htmlContent, 'utf8');

      // Also save metadata json
      const metaPath = path.join(subfolders.workPapers, `Proforma_${safeInv}_meta.json`);
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

      return { success: true, filePath, metaPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Lists all client folders with file counts and last updated dates
   */
  listClients() {
    this.ensureRoot();
    try {
      const entries = fs.readdirSync(this.storageRoot, { withFileTypes: true });
      const clients = [];

      for (const ent of entries) {
        if (ent.isDirectory()) {
          const clientDir = path.join(this.storageRoot, ent.name);
          let totalFiles = 0;
          let subCount = {};

          try {
            const subdirs = fs.readdirSync(clientDir, { withFileTypes: true });
            for (const sub of subdirs) {
              if (sub.isDirectory()) {
                const subPath = path.join(clientDir, sub.name);
                const count = fs.readdirSync(subPath).length;
                subCount[sub.name] = count;
                totalFiles += count;
              }
            }
          } catch (e) {}

          const stat = fs.statSync(clientDir);
          clients.push({
            name: ent.name.replace(/_/g, ' '),
            folderName: ent.name,
            folderPath: clientDir,
            totalFiles,
            subCount,
            lastModified: stat.mtime
          });
        }
      }

      // Sort recent first
      clients.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      return clients;
    } catch (e) {
      console.error('Error listing client vault:', e);
      return [];
    }
  }

  /**
   * Opens client folder directly in Windows Explorer
   */
  openClientInExplorer(folderName) {
    const target = path.isAbsolute(folderName) ? folderName : path.join(this.storageRoot, folderName);
    if (fs.existsSync(target)) {
      shell.openPath(target);
      return true;
    }
    return false;
  }
}

module.exports = ClientVaultManager;

