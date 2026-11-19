import zipfile
import xml.sax.saxutils as saxutils
import os

def escape(text):
    return saxutils.escape(str(text))

class DocxBuilder:
    def __init__(self):
        self.body_xml = []
        
    def add_title(self, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="300" w:after="120"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="52"/>
                    <w:color w:val="1E3A8A"/>
                </w:rPr>
                <w:t>{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_subtitle(self, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="0" w:after="300"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:i/>
                    <w:sz w:val="28"/>
                    <w:color w:val="4B5563"/>
                </w:rPr>
                <w:t>{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_heading1(self, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:spacing w:before="360" w:after="140"/>
                <w:pBdr>
                    <w:bottom w:val="single" w:sz="12" w:space="4" w:color="2563EB"/>
                </w:pBdr>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="34"/>
                    <w:color w:val="1E40AF"/>
                </w:rPr>
                <w:t>{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_heading2(self, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:spacing w:before="260" w:after="100"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="28"/>
                    <w:color w:val="0D9488"/>
                </w:rPr>
                <w:t>{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_heading3(self, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:spacing w:before="180" w:after="60"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="24"/>
                    <w:color w:val="374151"/>
                </w:rPr>
                <w:t>{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_paragraph(self, text, bold_prefix="", italic=False):
        runs = []
        if bold_prefix:
            runs.append(f'''<w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="22"/>
                    <w:color w:val="111827"/>
                </w:rPr>
                <w:t xml:space="preserve">{escape(bold_prefix)} </w:t>
            </w:r>''')
        
        runs.append(f'''<w:r>
            <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                {"<w:i/>" if italic else ""}
                <w:sz w:val="22"/>
                <w:color w:val="374151"/>
            </w:rPr>
            <w:t xml:space="preserve">{escape(text)}</w:t>
        </w:r>''')

        xml = f'''<w:p>
            <w:pPr>
                <w:spacing w:before="60" w:after="80" w:line="276" w:lineRule="auto"/>
            </w:pPr>
            {"".join(runs)}
        </w:p>'''
        self.body_xml.append(xml)

    def add_bullet(self, bold_prefix, text):
        xml = f'''<w:p>
            <w:pPr>
                <w:ind w:left="360" w:hanging="200"/>
                <w:spacing w:before="40" w:after="60"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:color w:val="2563EB"/>
                </w:rPr>
                <w:t xml:space="preserve">• </w:t>
            </w:r>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="22"/>
                    <w:color w:val="1F2937"/>
                </w:rPr>
                <w:t xml:space="preserve">{escape(bold_prefix)}: </w:t>
            </w:r>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:sz w:val="22"/>
                    <w:color w:val="4B5563"/>
                </w:rPr>
                <w:t xml:space="preserve">{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_callout(self, text, title="NOTE / SUMMARY"):
        xml = f'''<w:p>
            <w:pPr>
                <w:pBdr>
                    <w:left w:val="single" w:sz="24" w:space="12" w:color="2563EB"/>
                </w:pBdr>
                <w:shd w:val="clear" w:color="auto" w:fill="F0F9FF"/>
                <w:spacing w:before="120" w:after="120"/>
                <w:ind w:left="240" w:right="240"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:b/>
                    <w:sz w:val="22"/>
                    <w:color w:val="1E40AF"/>
                </w:rPr>
                <w:t xml:space="preserve">📌 {escape(title)}: </w:t>
            </w:r>
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                    <w:sz w:val="22"/>
                    <w:color w:val="1E3A8A"/>
                </w:rPr>
                <w:t xml:space="preserve">{escape(text)}</w:t>
            </w:r>
        </w:p>'''
        self.body_xml.append(xml)

    def add_table(self, headers, rows):
        tbl_xml = ['''<w:tbl>
            <w:tblPr>
                <w:tblStyle w:val="TableGrid"/>
                <w:tblW w:w="0" w:type="auto"/>
                <w:tblBorders>
                    <w:top w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
                    <w:left w:val="none"/>
                    <w:bottom w:val="single" w:sz="12" w:space="0" w:color="9CA3AF"/>
                    <w:right w:val="none"/>
                    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    <w:insideV w:val="none"/>
                </w:tblBorders>
                <w:tblCellMar>
                    <w:top w:w="120" w:type="dxa"/>
                    <w:left w:w="160" w:type="dxa"/>
                    <w:bottom w:w="120" w:type="dxa"/>
                    <w:right w:w="160" w:type="dxa"/>
                </w:tblCellMar>
            </w:tblPr>''']
        
        # Header Row
        tbl_xml.append('''<w:tr>
            <w:trPr><w:tblHeader/></w:trPr>''')
        for h in headers:
            tbl_xml.append(f'''<w:tc>
                <w:tcPr>
                    <w:shd w:val="clear" w:color="auto" w:fill="1E40AF"/>
                </w:tcPr>
                <w:p>
                    <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
                    <w:r>
                        <w:rPr>
                            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                            <w:b/>
                            <w:sz w:val="22"/>
                            <w:color w:val="FFFFFF"/>
                        </w:rPr>
                        <w:t>{escape(h)}</w:t>
                    </w:r>
                </w:p>
            </w:tc>''')
        tbl_xml.append('</w:tr>')

        # Data Rows
        for idx, row in enumerate(rows):
            bg = "F9FAFB" if idx % 2 == 1 else "FFFFFF"
            tbl_xml.append('<w:tr>')
            for cell in row:
                tbl_xml.append(f'''<w:tc>
                    <w:tcPr>
                        <w:shd w:val="clear" w:color="auto" w:fill="{bg}"/>
                    </w:tcPr>
                    <w:p>
                        <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
                        <w:r>
                            <w:rPr>
                                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                                <w:sz w:val="20"/>
                                <w:color w:val="374151"/>
                            </w:rPr>
                            <w:t>{escape(cell)}</w:t>
                        </w:r>
                    </w:p>
                </w:tc>''')
            tbl_xml.append('</w:tr>')

        tbl_xml.append('</w:tbl>')
        self.body_xml.append("".join(tbl_xml))

    def save(self, filepath):
        doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        {"".join(self.body_xml)}
        <w:sectPr>
            <w:pgSz w:w="11906" w:h="16838"/>
            <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr>
    </w:body>
</w:document>'''

        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

        rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

        doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

        styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:sz w:val="22"/>
                <w:color w:val="374151"/>
            </w:rPr>
        </w:rPrDefault>
    </w:docDefaults>
</w:styles>'''

        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with zipfile.ZipFile(filepath, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/_rels/document.xml.rels', doc_rels)
            z.writestr('word/document.xml', doc_xml)
            z.writestr('word/styles.xml', styles)
        print(f"Created: {filepath}")

# Build Master Document
doc = DocxBuilder()

doc.add_title("CA KIRAN K. SHINDE & CO.")
doc.add_subtitle("Tally Connector 2.0 & AI Autonomous Accounting Ecosystem — Master Blueprint")

doc.add_callout(
    "Yeh document hamari conversation aur discussion ka complete comprehensive summary hai — jisme Tally Connector ko upgrade karna, AI vs Non-AI capabilities, Costing, Website Billing Flow (Multi-Line Proforma), Baileys WhatsApp delivery without paid API, Payment Follow-up Engine, aur Local PC Client Document Vault ka poora master plan shamil hai.",
    "DOCUMENT OVERVIEW"
)

# Section 1
doc.add_heading1("1. Executive Summary & Core Objective")
doc.add_paragraph("Hamara primary objective Kiran K. Shinde & Co. ke existing Tally Connector aur Desktop App ko ek standard sync bridge se badal kar CA firm ka ek powerful, autonomous accounting aur client management engine banana hai.")
doc.add_bullet("Starting Reality", "Abhi connector sirf Cloud se Tally me basic Sales Voucher post karta hai aur offline bank PDF to excel conversion karta hai (0% AI).")
doc.add_bullet("The Modern Upgrade", "Website par client ke service book karte hi Tally me Optional Proforma Invoice banega, Baileys ke zariye direct WhatsApp par PDF deliver hoga, automated payment follow-up chalega, aur client ke sabhi documents local office PC me client-wise auto-organize honge.")

# Section 2
doc.add_heading1("2. AI vs Without-AI Comparison, Tools & Costing")
doc.add_paragraph("CA practice ke liye hamne hybrid model design kiya hai, taaki 80% daily operations 100% Free aur Local chalein, aur jahan complex analysis chahiye wahan low-cost/free AI lage.")

headers_ai = ["Feature / Service", "Without AI (Deterministic)", "With AI (Cognitive)", "Best Tool / API"]
rows_ai = [
    ["Bank Statement to Tally", "Custom Keyword Rules (e.g. SALARY, FUEL)", "Unpredictable UPI & NEFT Narration understanding", "Google Gemini 1.5/2.0 Flash + Rule Engine"],
    ["Invoice / Bill Ingestion", "Structured Excel / CSV import", "Scanned paper / mobile photo OCR with Tax extraction", "Gemini Flash Vision OCR"],
    ["Tally Voucher Creation", "XML Schema over HTTP Port 9000", "Anomaly, Duplicate & TDS Section checking", "Node.js XML Generator + Gemini"],
    ["Client Communication", "Pre-set templates & triggers", "Smart customized reminder notes & conversational prompt", "Baileys Local Web + Gemini"],
    ["Document Storage", "Local folder structure with clean names", "Smart document type classification from content", "Node.js fs / Local Storage Engine"]
]
doc.add_table(headers_ai, rows_ai)

doc.add_heading2("AI API Selection & Real-World Costing")
doc.add_bullet("Selected AI Engine", "Google Gemini API (Model: gemini-1.5-flash / gemini-2.0-flash). Text aur Vision (photo/PDF) dono ko native process karta hai.")
doc.add_bullet("Free Tier Benefit", "15 Requests per minute (RPM) aur 1,500 Requests per day (RPD) bilkul FREE hai. CA firm ke daily 50-100 bills ke liye cost = ₹0.00!")
doc.add_bullet("Paid Tier (Agar limits cross ho)", "Approx 2 se 5 paise per invoice/statement scan. 1,000 bills scan karne par pure mahine ka kharcha sirf ₹30 se ₹40 aayega!")

# Section 3
doc.add_heading1("3. Client Billing System & Multi-Line Service Flow")
doc.add_paragraph("CA firm me client ko multiple services ka alag-alag price break-up dena zaroori hota hai. Website par ek dynamic billing aur booking form banega jo Tally ki har requirement capture karega.")
doc.add_bullet("Client Master Fields", "Client/Company Name, Mobile (WhatsApp), Email, Address, State, Pincode, PAN, GSTIN (optional).")
doc.add_bullet("Multi-Line Item Table", "Client/Staff alag-alag lines add kar sakega: ITR Filing (₹3,500), Audit Report (₹15,000), ROC Filing (₹5,000), Govt Challan/Reimbursement (₹1,200).")
doc.add_bullet("Tax Calculation", "Intra-State: CGST (9%) + SGST (9%), Inter-State: IGST (18%), with auto HSN/SAC code 998231.")

# Section 4
doc.add_heading1("4. Proforma Invoice Generation & Tally Integration")
doc.add_paragraph("Website form submit hote hi do simultaneous actions honge:")
doc.add_bullet("Tally me Entry", "Tally me 'Optional Sales Voucher' (<ISOPTIONAL>Yes</ISOPTIONAL>) post hoga. Isse voucher ready rehta hai lekin payment aane se pehle P&L ya Tax liability me effect nahi padta.")
doc.add_bullet("Branded Proforma PDF", "Firm ke official letterhead (CA Kiran K. Shinde & Co.), Proforma Number (PI-2026-001), bank details aur DYNAMIC UPI QR Code ke sath clean A4 PDF generate hoga.")
doc.add_bullet("Conversion to Tax Invoice", "Jaise hi client payment karega, Admin 1-click me ise 'Regular Tax Invoice' me convert kar dega.")

# Section 5
doc.add_heading1("5. WhatsApp Delivery Without Paid Meta API (Baileys Integration)")
doc.add_paragraph("Meta Business API ke heavy charges (₹2,500 monthly + 80p/msg) aur verification drama se bachne ke liye hamne 100% Free local approach chuni:")
doc.add_bullet("Mechanism", "Tally Desktop App ke andar @whiskeysockets/baileys integrate hoga. Ek baar office mobile se QR scan karke link karna hoga.")
doc.add_bullet("Full Automation", "Form submit hote hi Desktop App background me client ke number par polite greeting message + asli PDF document attach karke deliver kar dega.")
doc.add_bullet("Safe Limit", "Chunki roz 5 se 15 genuine clients ko hi transactional invoice bhej rahe hain, WhatsApp ban hone ka 0% risk hai.")
doc.add_bullet("Fallback Option", "Agar kabhi mobile unlink ho, to 1-Click 'wa.me' smart launcher button hamesha ready rahega.")

# Section 6
doc.add_heading1("6. Smart Follow-Up & Payment Recovery System")
doc.add_paragraph("Proforma invoice bhejne ke baad payment aane tak automated follow-up cadence chalega:")
doc.add_bullet("Day 0", "Proforma Invoice PDF sent on WhatsApp. Status: PROFORMA_SENT.")
doc.add_bullet("Day 3", "Gentle Reminder 1 on WhatsApp: 'Namaste [Client], gentle reminder regarding pending Proforma [PI-001].'")
doc.add_bullet("Day 6", "Reminder 2 with Direct UPI QR Code link.")
doc.add_bullet("Auto-Stop Trigger", "Payment receive hote hi Admin 'Mark Paid' karega ➔ Follow-up band ➔ Client ko Payment Receipt Confirmation!")

# Section 7
doc.add_heading1("7. Local Client Document Vault (Auto-Organizer in Connector)")
doc.add_paragraph("Office PC par client documents ko client-wise structured folders me organize karne ka complete blueprint:")
doc.add_bullet("Root Location", "Configurable Office Drive (e.g. D:\\CA_Kiran_Firm_Data\\Clients\\).")
doc.add_bullet("Auto Folder Creation", "Client Name - PAN/GST ke naam se main folder auto-create hoga.")
doc.add_bullet("Categorized Sub-Folders", "01_KYC_and_Certificates, 02_GST_Documents, 03_Income_Tax_and_Audit, 04_Bank_Statements_and_Bills, 05_CA_Employee_Work_Papers.")
doc.add_bullet("Clean Auto-Naming", "Ajeeb upload naamo ke badle: Aadhaar_Card_[ClientName].pdf, GST_Certificate_REG06.pdf, ITR_Ack_AY26-27.pdf.")
doc.add_bullet("CA Staff Work Papers", "Articles/Employees ke banaye hue final computation, balance sheet drafts seedhe client folder me auto-save honge.")
doc.add_bullet("Explorer Integration", "Desktop app aur Admin panel me 'Open Client Folder' button Windows File Explorer me 1 click me folder kholega.")

# Section 8
doc.add_heading1("8. Local PC Superpowers & Tally Read Capabilities")
doc.add_paragraph("Chunki Connector local Windows PC aur Tally Port 9000 par direct chal raha hai, yeh future research aur expandability ke liye ye sab kar sakta hai:")
doc.add_bullet("Tally Data Extraction", "Debtors Outstanding & Ageing (30/60/90 days), Live Bank & Cash balances, DayBook transactions history, Trial Balance / P&L snapshots, GSTR-1 & GSTR-3B tax data.")
doc.add_bullet("Folder Watcher", "Scanner/Dropzone folder monitor karega — jaise hi koi bill ya bank PDF aayi, bina software khole Tally me entry.")
doc.add_bullet("Silent Hardware Printing", "Proforma ya receipt bante hi laser ya thermal printer se direct physical print.")
doc.add_bullet("Daily Auto Tally Backup", "Har sham Tally data ka encrypted password-protected .zip backup local drive aur secure cloud me.")
doc.add_bullet("Daily CA Morning Digest", "Subah CA sir ke WhatsApp par daily outstanding balance aur pending jobs ka automated summary.")

# Section 9
doc.add_heading1("9. Step-by-Step Implementation Roadmap")
headers_plan = ["Phase", "Task / Deliverable", "Key Components", "Result / Outcome"]
rows_plan = [
    ["Phase 1", "Multi-Line Booking & Proforma Engine", "Website Service Selector + Dynamic Proforma PDF Generator with UPI QR", "Clients ko breakdown ke sath official Proforma milna shuru"],
    ["Phase 2", "Local Storage Client Vault in Connector", "Desktop App Auto-folder & Category Subfolders + File Renamer", "Sabhi documents client-wise local PC me auto-organized"],
    ["Phase 3", "Tally Optional Voucher Integration", "Tally XML Generator for Multi-Line Items (Port 9000)", "Tally DayBook me Proforma entry bina manual typing ke ready"],
    ["Phase 4", "Baileys WhatsApp & Follow-Up Bot", "Desktop App QR scan link + Scheduled auto reminders (Day 3 / Day 6)", "Zero cost automated WhatsApp delivery aur payment recovery"]
]
doc.add_table(headers_plan, rows_plan)

doc.add_callout(
    "Yeh master document Kiran K. Shinde & Co. ke local workspace me save kar diya gaya hai aur is blueprint ke hisab se hum step-by-step implementation execute kar sakte hain.",
    "STATUS: READY FOR EXECUTION"
)

# Save to workspace
output_path = r"e:\kiran k shinde & co\CA_Kiran_Tally_Connector_AI_Master_Plan.docx"
doc.save(output_path)

