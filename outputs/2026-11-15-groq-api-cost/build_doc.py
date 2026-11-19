from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION
from pathlib import Path

out = Path(r'E:\kiran k shinde & co\outputs\2026-11-15-groq-api-cost\CA_AI_NonAI_Automation_and_Groq_Cost_Guide.docx')
doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(0.65); sec.bottom_margin = Inches(0.65); sec.left_margin = Inches(0.72); sec.right_margin = Inches(0.72)
sec.header_distance = Inches(0.3); sec.footer_distance = Inches(0.3)

NAVY='153B35'; GREEN='16845B'; PALE='EAF4EF'; LIGHT='F4F7F6'; GRAY='55616E'; WHITE='FFFFFF'; DARK='202B36'
styles = doc.styles
styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(9.3); styles['Normal'].font.color.rgb=RGBColor.from_string(DARK)
styles['Normal'].paragraph_format.space_after=Pt(5); styles['Normal'].paragraph_format.line_spacing=1.08
for name,size,color in [('Title',25,NAVY),('Heading 1',17,NAVY),('Heading 2',12,GREEN),('Heading 3',10,NAVY)]:
    st=styles[name]; st.font.name='Aptos Display' if name in ('Title','Heading 1') else 'Aptos'; st.font.size=Pt(size); st.font.bold=True; st.font.color.rgb=RGBColor.from_string(color); st.paragraph_format.space_before=Pt(10 if name!='Title' else 0); st.paragraph_format.space_after=Pt(5)

# Header/footer
header=sec.header.paragraphs[0]; header.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=header.add_run('CA OFFICE AUTOMATION GUIDE  |  HINGLISH'); r.font.name='Aptos'; r.font.size=Pt(8); r.font.color.rgb=RGBColor.from_string(GREEN); r.bold=True
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
rr=footer.add_run('AI suggestions ko accountant review kare  |  '); rr.font.size=Pt(8); rr.font.color.rgb=RGBColor.from_string(GRAY)
fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); footer._p.append(fld)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); tcPr.append(shd)
def set_cell_text(cell, text, bold=False, color=DARK, size=8.3):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(0); p.paragraph_format.space_before=Pt(0); p.paragraph_format.line_spacing=1.0
    r=p.add_run(str(text)); r.font.name='Aptos'; r.font.size=Pt(size); r.bold=bold; r.font.color.rgb=RGBColor.from_string(color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
def set_repeat_table_header(row):
    trPr=row._tr.get_or_add_trPr(); el=OxmlElement('w:tblHeader'); el.set(qn('w:val'),'true'); trPr.append(el)
def table(headers, rows, widths=None, font=8.1):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    for i,h in enumerate(headers):
        set_cell_text(t.rows[0].cells[i],h,True,WHITE,font); shade(t.rows[0].cells[i],NAVY)
    set_repeat_table_header(t.rows[0])
    for idx,row in enumerate(rows):
        cells=t.add_row().cells
        for i,val in enumerate(row):
            set_cell_text(cells[i],val,False,DARK,font)
            if idx%2==1: shade(cells[i],LIGHT)
    if widths:
        for row in t.rows:
            for i,w in enumerate(widths): row.cells[i].width=Inches(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(1)
    return t
def p(text='', boldlead=None):
    para=doc.add_paragraph()
    if boldlead and text.startswith(boldlead):
        para.add_run(boldlead).bold=True; para.add_run(text[len(boldlead):])
    else: para.add_run(text)
    return para
def bullet(text):
    para=doc.add_paragraph(style='List Bullet'); para.paragraph_format.left_indent=Inches(.22); para.paragraph_format.first_line_indent=Inches(-.12); para.paragraph_format.space_after=Pt(2); para.add_run(text); return para
def note(label,text):
    t=doc.add_table(rows=1,cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER; cell=t.cell(0,0); shade(cell,PALE); cell.text=''; pp=cell.paragraphs[0]; pp.paragraph_format.space_after=Pt(3); rr=pp.add_run(label+'  '); rr.bold=True; rr.font.color.rgb=RGBColor.from_string(GREEN); pp.add_run(text)
    doc.add_paragraph().paragraph_format.space_after=Pt(1)

# Opening
para=doc.add_paragraph(style='Title'); para.add_run('CA Office AI aur Non-AI Automation Guide')
sub=doc.add_paragraph(); sub.paragraph_format.space_after=Pt(10); run=sub.add_run('Kaunsa kaam rules se karein, kahan AI lagayein, aur Groq API ka kharcha kaise samjhein'); run.font.size=Pt(11); run.font.color.rgb=RGBColor.from_string(GRAY)
p('Is guide mein CA office ke common workflows ko practical tareeke se tod kar bataya hai. Seedha recommendation yeh hai: jahan rule, formula ya exact matching kaam kare, wahan normal automation use karein. AI ko tab bulayein jab document ya narration ko samajhna, unclear item classify karna, ya human ke liye explanation/draft banana ho. Is hybrid design se cost aur accounting risk dono control mein rehte hain.')
note('Key cost example','100,000 bills, har bill par 2,000 input + 200 output tokens maan kar Groq GPT OSS 20B ka estimate $21, lagbhag ₹1,890 (₹90/US$ planning rate) hai. Yeh sirf model text-processing cost hai; OCR, hosting aur tax alag hain.')

doc.add_heading('1. AI automation aur normal automation ka farq', level=1)
p('Normal automation fixed instructions follow karti hai. Jaise invoice total ko line items se jodna, due date nikalna, GSTIN format check karna, exact invoice number match karna, ya GSTR data ko CSV mein export karna. Same input par same rule lagta hai; isliye iski output predictable hoti hai aur API token cost nahi lagti.')
p('AI automation language aur context ko interpret karti hai. Jaise bank narration “UPI/XYZ STORE/...” ko expense head suggest karna, invoice scan mein vendor fields dhoondhna, tax notice ka summary banana, ya unusual ledger entry ka possible reason likhna. AI answer probabilistic hota hai, isliye use suggestion/draft samjhein, final accounting fact nahi.')
table(['Kaam ka type','Best tool','Kyun'],[
['Exact arithmetic, dates, tax formulas','Non-AI rules','Formula repeatable aur audit karne layak rehta hai'],
['Fixed layout ke PDF/Excel statements','Parser + rules','Bank template pehchaan ke columns/rows nikaale ja sakte hain'],
['Scanned image/OCR aur messy documents','OCR + AI (zarurat par)','OCR text deta hai; AI field ko context ke saath samajhne mein help karta hai'],
['Unclear narration ya ambiguous text','AI suggestion + reviewer','Model category/reason suggest kare, accountant approve kare'],
['Reminder schedule, approval routing','Non-AI workflow','Trigger, date aur status deterministic hote hain'],
], [1.7,1.65,3.4])

doc.add_heading('2. CA office mein har major workflow ka automation plan', level=1)

workflows=[
('A. Bank statement se ledger/Tally entry',
 'AI bank narration ko ledger head suggest kar sakta hai: bank charges, rent, travel, client receipt, loan instalment, etc. Naye ya uncommon narration ko reason ke saath review queue mein bheje.',
 'Digital PDF/Excel parse karna, date/amount/balance nikaalna, debit-credit verify karna, opening + transactions = closing balance check, duplicate rows dhoondhna, voucher type aur Tally import file banana.',
 'Bank ke layout ko parser pehchaane; exact rows aur maths code kare. Sirf low-confidence narration AI ko bheje. AI ka ledger suggestion accountant approve kare. Passwords, full account number aur unnecessary personal details model prompt se hataayein.'),
('B. Purchase/sales invoice entry',
 'Messy invoice text ko samajhna, supplier/party name, invoice number, date, GSTIN, taxable amount aur tax fields ka candidate extraction; narration ya item description ko normalize karna.',
 'PDF text extraction/OCR, subtotal + tax + invoice total ka arithmetic, GSTIN/PAN format checks, invoice-number duplicate check, ledger mapping rules, approval status aur Tally/XML/CSV export.',
 'Digital PDF mein text extraction kaafi ho sakta hai. Scan/photo ke liye OCR service chahiye; Groq text model OCR ka replacement nahi maana gaya. Extracted fields ko totals/GST math se validate karke mismatch ho to human review.'),
('C. GSTR-2B vs purchase register',
 'Exact/near matches ke baad sirf mismatch ka likely reason likhna: invoice number formatting, date gap, GSTIN discrepancy, taxable value/tax mismatch, credit note ya supplier filing issue. Client follow-up draft karna.',
 'GSTIN + normalized invoice number + financial year matching, tax/value tolerance, duplicate detection, missing-in-2B / missing-in-books buckets, totals and downloadable exception register.',
 'Matching aur amount comparison rules se karein; AI ko poora GST return blindly na dein. AI ka kaam explanation/draft hai. Filing ke pehle CA review zaroori hai.'),
('D. Bank / ledger / payment reconciliation',
 'Narration, date, reference aur amount ke fuzzy candidates mein likely match suggest karna; unmatched entries ko possible reason dena.',
 'Exact amount/reference match, date window, bank ref or invoice ID join, one-to-one match safeguards, unmatched report, duplicate payment check.',
 'Pehle deterministic matching. AI sirf ambiguous leftovers ko rank kare; automatic posting tabhi jab confidence threshold aur reviewer approval policy ho.'),
('E. GST, TDS, ITR due-date tracking',
 'Circular ya notice ki language ko short action list mein convert karna, jab date/source text unstructured ho.',
 'Financial year, taxpayer type, filing frequency aur approved due-date calendar se deadline calculate karna; email/WhatsApp reminder schedule, escalation aur completion status.',
 'Dates aur notifications rules/calendar se. AI ko reminder draft ya unusual notice se action items extract karne tak rakhein. Official due date ko authoritative calendar se validate karein.'),
('F. Client document collection',
 'Client request ko polite Hinglish/English reminder mein draft karna; uploaded files ke visible content se document type suggest karna.',
 'Client-wise checklist, received/missing status, folder naming, upload links, reminder sequence, expiry/deadline, staff assignment, audit log.',
 'Missing document ka decision checklist rules se ho; AI sirf draft/sorting suggestion kare. Sensitive client information ko prompt mein minimize karein.'),
('G. Monthly MIS, P&L, cash flow, receivables',
 'Already-calculated figures ka plain-language summary; unusual month-to-month movement ka possible explanation prompt karna.',
 'Ledger se P&L/cash flow/ageing calculate karna, period filters, totals, variance %, report export, chart and client-wise roll-up.',
 'Numbers accounting system aur formulas se generate hon. AI narrative ko actual numbers se ground karein; invented causes ko “possible reason” label karein.'),
('H. TDS, payroll aur recurring accounting',
 'Description/employee query ko categorize karne ya policy question ka draft answer dene mein help.',
 'Salary formula, attendance/leave totals, configured PF/ESI/TDS calculations, payslip generation, recurring rent/depreciation/loan interest journal templates, validation and approvals.',
 'Tax/payroll computation rules-based aur period-configured rakhein. AI ko explanation, data extraction aur exception summary tak rakhein; filing/payment se pehle review.'),
('I. Audit preparation aur anomaly detection',
 'Flagged duplicate, unusual amount, round figure, dormant ledger movement ya outlier ke liye human-readable reason / investigation prompt banana.',
 'Duplicate invoice IDs, negative balances, missing voucher numbers, unusual thresholds, variance analysis, rule-based outlier flags, audit trail export.',
 'Rules anomalies ko flag karein, AI sirf explanation aur next-check suggestion de. AI ka flag fraud ka proof nahi hota.'),
('J. Notice, letter aur email processing',
 'Notice ka summary, section/date/action-item extraction, response draft; incoming client email ko topic/urgency ke hisaab se sort karna.',
 'Document archive, received date, due date field, task creation, owner assignment, response status, exact keyword/file search.',
 'OCR scanned notice ke liye separate service ho sakti hai. AI summary ke saath original page/reference preserve karein; legal/tax reply CA approve kare.'),
('K. Client onboarding, staff tasks, fees',
 'Client ke free-text request ko service category ya task suggestion mein convert karna; invoice reminder ka draft.',
 'KYC/document checklist, engagement status, task assignment, maker-checker approval, billing, due invoices, recurring work calendar, role-based access.',
 'Workflow states aur permissions normal software logic se. AI optional hai: intake text samajhna aur communication draft karna.'),
('L. Tally / accounting software integration',
 'Unmapped ledger ya description ke liye mapping candidate suggest karna.',
 'Tally XML/CSV generation, account/stock-item lookup, duplicate voucher control, import acknowledgement, retry/error log.',
 'Data transfer, schema validation aur retries deterministic code se; AI ko import engine ke beech mein na rakhein.'),
]
for title, ai, nonai, design in workflows:
    doc.add_heading(title, level=2)
    p('AI kya kare: '+ai, 'AI kya kare:')
    p('Non-AI kya kare: '+nonai, 'Non-AI kya kare:')
    p('Recommended flow: '+design, 'Recommended flow:')

doc.add_heading('3. Groq API key aur cost kaise lagti hai', level=1)
p('Groq API key ek secret credential hai jo server/backend se Groq model ko request bhejne ke liye use hoti hai. Key khud per-document fee nahi hai; charge model ke input tokens aur output tokens par hota hai. Key ko website ke browser JavaScript, public GitHub repo ya Excel file mein kabhi na daalein. Server environment variable/secret manager mein rakhein, monthly spend limit lagayein, logs mein key redact karein aur leak ho to rotate karein.')
table(['Model','Input rate / 1M tokens','Output rate / 1M tokens','Relative API cost'],[
['GPT OSS 20B','$0.075','$0.30','Lower cost option; pilot ke liye starting choice'],
['GPT OSS 120B','$0.15','$0.60','Rates 20B se 2x; harder items par selective fallback'],
], [1.5,1.45,1.55,2.25])
p('Formula: task cost (USD) = input tokens ÷ 1,000,000 × input rate + output tokens ÷ 1,000,000 × output rate. INR estimate = USD × ₹90. ₹90/US$ sirf editable planning assumption hai, live exchange quote nahi. Prices current listed rates ke mutabik hain; production se pehle Groq pricing page dobara check karein.')

cost_rows=[
['Invoice fields extract (digital text to model)', '2,000 / 200', '₹0.0189 (1.89 paise)', '₹0.0378 (3.78 paise)', 'OCR alag; 100k bills ka base scenario'],
['Bank narration category suggestion', '100 / 30', '₹0.001485 (0.15 paisa)', '₹0.002970 (0.30 paisa)', 'Per transaction; rules-only may be ₹0 API'],
['GSTR-2B mismatch explanation', '1,200 / 250', '₹0.01485 (1.49 paise)', '₹0.02970 (2.97 paise)', 'Per mismatch explanation'],
['Unclear reconciliation candidate', '250 / 80', '₹0.003848 (0.38 paisa)', '₹0.007695 (0.77 paisa)', 'Per candidate suggestion'],
['Notice / letter summary', '5,000 / 700', '₹0.05265 (5.27 paise)', '₹0.10530 (10.53 paise)', 'Per notice; scan OCR alag'],
['Audit exception explanation', '500 / 150', '₹0.007425 (0.74 paisa)', '₹0.01485 (1.49 paise)', 'Per flagged item'],
['MIS narrative summary', '3,000 / 500', '₹0.03375 (3.38 paise)', '₹0.06750 (6.75 paise)', 'Per generated summary'],
['Client reminder draft', '300 / 100', '₹0.004725 (0.47 paisa)', '₹0.009450 (0.95 paisa)', 'Per draft; sending service alag ho sakti hai'],
]
table(['AI task','Assumed input / output tokens','20B per item (₹)','120B per item (₹)','Counting unit / note'],cost_rows,[1.55,1.25,1.3,1.3,1.55],7.5)

p('Bills ka 100,000 batch: 2,000 input + 200 output tokens per bill maan kar GPT OSS 20B = 100,000 × ₹0.0189 = ₹1,890 (USD $21). GPT OSS 120B = ₹3,780 (USD $42). Yeh Groq text-token charge hai. Agar har invoice par OCR service, file storage ya additional AI calls use hon, total bill zyada hoga.')
p('Baaki workflows ka combined total abhi nikalne ke liye har mahine ke item counts chahiye: bank transactions, GST mismatches, unclear reconciliation candidates, notices, audit flags, MIS reports aur reminder drafts. Example formula: total monthly Groq cost = har workflow ka count × us workflow ka per-item cost. Cost sheet mein green input cells isi kaam ke liye hain; counts enter karte hi total update hota hai.')
note('Important estimate limit','Token sizes starter assumptions hain, vendor guarantee nahi. Actual prompt mein ledger list, chart of accounts, client context aur output schema add karne se token count badh sakta hai. Pilot ke 50-100 representative documents par actual token usage measure karke assumptions update karein.')

doc.add_heading('4. API cost ko kam aur predictable kaise rakhein', level=1)
for x in [
'Rules-first routing: exact match ya known bank layout ho to AI call na karein. Sirf exception ko bhejein.',
'Prompt chhota rakhein: poora ledger/history bhejne ke bajay relevant candidate accounts ya fields hi dein.',
'Output limit karein: fixed JSON fields, chhota reason, max output tokens; lambi kahani na mangayein.',
'Cache repeated answers: same supplier mapping ya recurring narration ko review ke baad local rule mein save karein.',
'Confidence threshold: high-confidence routine suggestion auto-fill ho; low-confidence item review queue mein aaye.',
'Budget guardrails: per-client/month token cap, Groq spend limits, alerting, request IDs aur usage logging lagayein.',
'Batch safe tasks: independent short narrations ko batching se overhead ghata sakte hain, lekin source-to-output mapping na khoein.',
'No silent posting: AI-generated ledger/GST output ko review, approval aur audit trail ke bina final post/file na karein.'
]: bullet(x)

doc.add_heading('5. Client financial data aur API key ki safety', level=1)
for x in [
'Groq API key backend secret mein rakhein; frontend HTML/JS, mobile app bundle, spreadsheet aur source control mein expose na karein.',
'Model ko sirf minimum necessary text bhejein. Account number, phone, email, PAN/GSTIN ya address ki zaroorat na ho to mask/remove karein.',
'Production se pehle provider ke current data retention, processing location, subprocessors aur contract terms ko firm policy ke saath review karein.',
'Har AI result ke saath original document/page, extracted values, model response, reviewer correction aur approval timestamp ka audit trail rakhein.',
'AI ko final tax advice, filing submit, payment release, voucher posting ya client communication send karne ka unilateral access na dein.'
]: bullet(x)

doc.add_heading('6. Practical rollout order', level=1)
table(['Phase','Pehle kya banayein','Kya verify karein'],[
['1. Non-AI foundation','Bank parsing, exact validations, GST matching, Tally export, reminders, audit logs','Opening/closing balance, totals, duplicate controls, import errors'],
['2. AI assist pilot','Invoice field suggestions, narration coding, unclear reconciliation candidates','Field accuracy, false matches, reviewer edits, real tokens/document'],
['3. Explain and draft','GST mismatch explanations, notices, MIS summaries, client reminders','Source citations, correct dates/amounts, no unsupported claims'],
['4. Controlled scale-up','Client-wise roles, spend limits, exception queues, model fallback','Per-client cost, service reliability, access and retention review'],
], [1.1,3.05,2.95])
p('Pilot ke dauraan AI output ko existing manual result ke against compare karein. Har task ke liye acceptance rule set karein: kaunsi fields exact honi chahiye, kitne items manual review mein jayenge, aur kis error par automation rokni hai. Tabhi AI feature ko client work mein expand karein.')

doc.add_heading('7. Bottom-line implementation recommendation', level=1)
p('Aapke office ke liye pehla practical build: (1) deterministic bank statement conversion aur balance check, (2) invoice OCR/extraction with tax-total validation, (3) GSTR-2B/purchase register exact-match reconciliation, (4) Tally export, (5) AI only for unclear narration, mismatch explanation, notice summary and client drafts. Is design mein routine math/rules ka API kharcha zero hota hai; Groq usage exceptions aur text understanding par hi lagta hai.')
p('20B ko initial model rakhein. 120B ko sirf difficult exceptions ke fallback ke roop mein test karein. 100,000 bills ka current token assumption ₹1,890 (20B) batata hai, par OCR/hosting add karne se pehle alag quote chahiye. Final ledger, GST return, TDS return aur client-facing tax response accountant review ke baad hi use karein.')

doc.add_heading('Sources and assumptions', level=1)
p('Groq Supported Models and token pricing: https://console.groq.com/docs/models (checked 15 November 2026). Rates used in this guide: GPT OSS 20B, $0.075 input / $0.30 output per million tokens; GPT OSS 120B, $0.15 input / $0.60 output per million tokens. API token amounts and exchange rate in worked examples are estimates; confirm live pricing and actual token usage before launch.')
p('Cost calculations exclude OCR/vision charges, app hosting, database/storage, email or WhatsApp delivery, provider/payment fees and applicable taxes. The 100,000 bill count is a one-batch scenario, not an assumption that it repeats monthly.')

# Avoid splitting rows across pages and apply table borders subtly
for t in doc.tables:
    for row in t.rows:
        trPr=row._tr.get_or_add_trPr(); cant=OxmlElement('w:cantSplit'); trPr.append(cant)
        for c in row.cells:
            tcPr=c._tc.get_or_add_tcPr(); borders=tcPr.first_child_found_in('w:tcBorders')
            if borders is None: borders=OxmlElement('w:tcBorders'); tcPr.append(borders)
            for edge in ('top','left','bottom','right','insideH','insideV'):
                e=OxmlElement('w:'+edge); e.set(qn('w:val'),'single'); e.set(qn('w:sz'),'3'); e.set(qn('w:color'),'DCE5E1'); borders.append(e)

doc.core_properties.title='CA Office AI aur Non-AI Automation Guide'
doc.core_properties.subject='CA office automation workflows and Groq API token cost estimates'
doc.core_properties.author=''
doc.save(out)
print(out)
