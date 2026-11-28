"""
CA Kiran K. Shinde & Co. — WhatsApp Web Auto-Dispatcher (Python Bot)
Connects the Cloud Admin Panel (/api/tally/whatsapp) directly to your
logged-in Office WhatsApp Web so every framed message AND authentic
1:1 Tally Tax Invoice PDF is delivered automatically without manual clicking.
"""

import argparse
import base64
import html as html_lib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
PROFILE_DIR = os.path.join(BASE_DIR, "wa_session_profile")
INVOICES_DIR = os.path.join(BASE_DIR, "generated_invoices")


def log(level: str, msg: str) -> None:
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] [{level}] {msg}", flush=True)


def load_config() -> dict:
    defaults = {
        "siteUrl": "https://kirankshinde-co.vercel.app",
        "bridgeToken": "ks_tally_secret_2026",
        "pollIntervalSeconds": 4,
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                defaults.update({k: v for k, v in data.items() if v})
        except Exception as exc:
            log("WARN", f"Could not read config.json ({exc}), using defaults.")
    return defaults


def clean_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", str(phone or ""))
    if len(digits) == 11 and digits.startswith("0"):
        digits = "91" + digits[1:]
    elif len(digits) == 10:
        digits = "91" + digits
    return digits


def number_to_words_inr(amount: float) -> str:
    num = int(round(float(amount or 0)))
    if num <= 0:
        return "INR Zero Only"

    ones = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen",
    ]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def two_digits(n: int) -> str:
        if n < 20:
            return ones[n]
        return f"{tens[n // 10]} {ones[n % 10]}".strip()

    crores = (num // 10000000) % 100
    lakhs = (num // 100000) % 100
    thousands = (num // 1000) % 100
    hundreds = (num // 100) % 10
    rest = num % 100

    parts = []
    if crores:
        parts.append(f"{two_digits(crores)} Crore")
    if lakhs:
        parts.append(f"{two_digits(lakhs)} Lakh")
    if thousands:
        parts.append(f"{two_digits(thousands)} Thousand")
    if hundreds:
        parts.append(f"{ones[hundreds]} Hundred")
    if rest:
        prefix = "and " if parts else ""
        parts.append(f"{prefix}{two_digits(rest)}")

    return f"INR {' '.join(parts)} Only"


def make_upi_qr_data_uri(upi_uri: str) -> str:
    try:
        import segno
        qr = segno.make(upi_uri, error="m")
        buf = io.BytesIO()
        qr.save(buf, kind="svg", scale=4, border=1, xmldecl=False)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/svg+xml;base64,{b64}"
    except Exception:
        encoded = urllib.parse.quote(upi_uri)
        return f"https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data={encoded}"


def build_tally_invoice_html(item: dict) -> str:
    invoice_id = str(item.get("invoiceId") or item.get("sourceId") or "INV-BILL").strip()
    client_name = str(item.get("clientName") or item.get("client") or "Valued Client").strip()
    amount = float(item.get("amount") or 0)
    service = str(item.get("service") or "Statutory Compliance & Professional CA Consultancy Fees").strip()
    date_str = str(item.get("date") or datetime.now().strftime("%d/%m/%Y")).strip()
    voucher_no = str(item.get("voucherNo") or re.sub(r"\D", "", invoice_id) or "529").strip()

    formatted_amt = f"{amount:,.2f}"
    in_words = number_to_words_inr(amount)
    upi_uri = (
        f"upi://pay?pa=7506647791@hdfcbank"
        f"&pn=CA%20Kiran%20K%20Shinde%20and%20Co"
        f"&am={int(round(amount)) if amount.is_integer() else amount}"
        f"&cu=INR&tn={urllib.parse.quote('Fee Inv ' + invoice_id)}"
    )
    qr_src = make_upi_qr_data_uri(upi_uri)

    e_client = html_lib.escape(client_name)
    e_inv = html_lib.escape(invoice_id)
    e_vch = html_lib.escape(voucher_no)
    e_date = html_lib.escape(date_str)
    e_srv = html_lib.escape(service)
    e_words = html_lib.escape(in_words)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice {e_inv}</title>
<style>
  @page {{ size: A4; margin: 12mm; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 8px; color: #000; font-size: 12px; line-height: 1.4; background: #fff; }}
  .sheet {{ border: 2px solid #000; width: 100%; box-sizing: border-box; }}
  .top-title {{ text-align: center; font-weight: 800; font-size: 16px; letter-spacing: 1.5px; padding: 7px 0; border-bottom: 1.5px solid #000; background: #f8fafc; }}
  .split {{ display: flex; border-bottom: 1px solid #000; }}
  .left-col {{ width: 52%; border-right: 1px solid #000; display: flex; flex-direction: column; }}
  .right-col {{ width: 48%; }}
  .pad {{ padding: 8px 10px; }}
  .bb {{ border-bottom: 1px solid #000; }}
  .meta-table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
  .meta-table td {{ border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 5px 7px; vertical-align: top; width: 50%; }}
  .meta-table td:last-child {{ border-right: none; }}
  .meta-table tr:last-child td {{ border-bottom: none; }}
  .lbl {{ color: #555; font-size: 10px; display: block; }}
  .items-table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  .items-table th {{ background: #f1f5f9; border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px; font-size: 11px; text-align: left; }}
  .items-table td {{ border-right: 1px solid #000; padding: 8px; vertical-align: top; }}
  .items-table th:last-child, .items-table td:last-child {{ border-right: none; }}
  .num {{ text-align: right; }}
  .ctr {{ text-align: center; }}
  .pay-strip {{ display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 8px 10px; margin-top: 8px; }}
</style>
</head>
<body>
  <div class="sheet">
    <div class="top-title">TAX / FEE INVOICE</div>
    <div class="split">
      <div class="left-col">
        <div class="pad bb">
          <strong style="font-size:14px;">CA KIRAN K. SHINDE &amp; CO.</strong><br>
          <span>Chartered Accountants &bull; FRN: 147829W</span><br>
          <span style="font-size:10.5px;">001/2 A, Shanti Vista, Yashwant Shristi, Boisar - Palghar Rd (401501)</span><br>
          <span style="font-size:10.5px;">State Name: Maharashtra, Code: 27 &bull; Mob: +91 75066 47791</span>
        </div>
        <div class="pad bb" style="background:#fafafa; font-size:11px;">
          <span class="lbl">Consignee (Ship to)</span>
          <strong>Same as Buyer</strong>
        </div>
        <div class="pad" style="flex:1;">
          <span class="lbl">Buyer (Bill to)</span>
          <strong style="font-size:13.5px;">{e_client}</strong><br>
          <span style="font-size:11px;">State Name: Maharashtra, Code: 27</span>
        </div>
      </div>
      <div class="right-col">
        <table class="meta-table">
          <tr>
            <td><span class="lbl">Invoice No.</span><strong>{e_vch}</strong></td>
            <td><span class="lbl">Dated</span><strong>{e_date}</strong></td>
          </tr>
          <tr>
            <td><span class="lbl">Delivery Note</span>&nbsp;</td>
            <td><span class="lbl">Mode/Terms of Payment</span><strong>Immediate / UPI / NEFT</strong></td>
          </tr>
          <tr>
            <td><span class="lbl">Reference No. &amp; Date</span><strong>{e_inv} dt. {e_date}</strong></td>
            <td><span class="lbl">Other References</span><strong>TallyPrime Cloud Sync</strong></td>
          </tr>
          <tr>
            <td><span class="lbl">Dispatched through</span><strong>Office / Electronic</strong></td>
            <td><span class="lbl">Destination</span><strong>Boisar / Palghar / Online</strong></td>
          </tr>
        </table>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="ctr" style="width:7%;">Sl</th>
          <th style="width:50%;">Description of Services</th>
          <th class="ctr" style="width:12%;">HSN/SAC</th>
          <th class="ctr" style="width:9%;">Qty</th>
          <th class="num" style="width:11%;">Rate</th>
          <th class="num" style="width:11%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="height: 190px;">
          <td class="ctr">1</td>
          <td>
            <strong style="font-size:12.5px;">Professional Fees Account</strong><br>
            <div style="margin-top:4px; color:#1e293b;">{e_srv}</div>
            <div style="margin-top:4px; font-size:10px; color:#64748b;">(CA Statutory Compliance, Audit, Taxation &amp; Advisory Services)</div>
          </td>
          <td class="ctr" style="font-family:monospace;">998231</td>
          <td class="ctr">1 NOS</td>
          <td class="num">{formatted_amt}</td>
          <td class="num"><strong>{formatted_amt}</strong></td>
        </tr>
        <tr style="border-top:1px solid #000; border-bottom:1px solid #000; background:#f8fafc; font-weight:800;">
          <td colspan="5" class="num" style="padding:7px 10px;">TOTAL PAYABLE</td>
          <td class="num" style="padding:7px 8px; font-size:13.5px;">₹ {formatted_amt}</td>
        </tr>
      </tbody>
    </table>

    <div class="pad bb">
      <span class="lbl">Amount Chargeable (in words)</span>
      <strong>{e_words}</strong>
    </div>

    <div class="split" style="border-bottom:1px solid #000;">
      <div style="width:62%; border-right:1px solid #000; padding:8px 10px;">
        <strong style="text-decoration:underline; font-size:11px;">Declaration</strong><br>
        <span style="font-size:10.5px; color:#334155;">We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.</span>
        <div class="pay-strip">
          <div style="font-size:10.5px;">
            <strong style="color:#166534;">Scan QR or Pay Online (GPay / PhonePe / Paytm)</strong><br>
            <span><strong>UPI ID:</strong> 7506647791@hdfcbank</span><br>
            <span><strong>Bank:</strong> HDFC Bank Ltd &bull; <strong>A/C:</strong> 50200067891234</span><br>
            <span><strong>IFSC:</strong> HDFC0000123 &bull; <strong>Pay Portal:</strong> www.cakiran.co.in/pay</span>
          </div>
          <div style="background:#fff; padding:3px; border:1px solid #cbd5e1; border-radius:4px;">
            <img src="{qr_src}" alt="UPI QR" style="width:76px; height:76px; display:block;">
          </div>
        </div>
      </div>
      <div style="width:38%; padding:10px 12px; text-align:right; display:flex; flex-direction:column; justify-content:space-between;">
        <div>for <strong>CA KIRAN K. SHINDE &amp; CO.</strong></div>
        <div style="margin-top:55px;">
          <div style="border-top:1px dashed #64748b; width:155px; margin-left:auto; margin-bottom:4px;"></div>
          <strong style="font-size:11px;">Authorised Signatory</strong>
        </div>
      </div>
    </div>

    <div style="text-align:center; font-size:10px; padding:5px 0; color:#475569;">
      This is a Computer Generated Invoice &bull; CA Kiran K. Shinde &amp; Co. (TallyPrime Cloud Connector)
    </div>
  </div>
</body>
</html>"""


def generate_tally_invoice_pdf(context, item: dict) -> str:
    os.makedirs(INVOICES_DIR, exist_ok=True)
    invoice_id = str(item.get("invoiceId") or item.get("sourceId") or "INV").strip()
    client_name = str(item.get("clientName") or "Client").strip()
    safe_inv = re.sub(r"[^a-zA-Z0-9_-]", "_", invoice_id)
    safe_client = re.sub(r"[^a-zA-Z0-9_-]", "_", client_name)[:24]
    pdf_path = os.path.join(INVOICES_DIR, f"Invoice_{safe_inv}_{safe_client}.pdf")

    html_doc = build_tally_invoice_html(item)
    pdf_page = context.new_page()
    try:
        pdf_page.set_content(html_doc, wait_until="load")
        cdp = context.new_cdp_session(pdf_page)
        res = cdp.send(
            "Page.printToPDF",
            {
                "printBackground": True,
                "paperWidth": 8.27,
                "paperHeight": 11.69,
                "marginTop": 0.35,
                "marginBottom": 0.35,
                "marginLeft": 0.35,
                "marginRight": 0.35,
            },
        )
        pdf_bytes = base64.b64decode(res["data"])
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        log("PDF", f"Generated 1:1 Tally Bill PDF ({len(pdf_bytes):,} bytes): {os.path.basename(pdf_path)}")
        return pdf_path
    finally:
        try:
            pdf_page.close()
        except Exception:
            pass


def api_request(url: str, method: str = "GET", payload: dict | None = None, token: str = "") -> dict:
    headers = {
        "x-bridge-token": token,
        "User-Agent": "KiranShinde-WhatsApp-Dispatcher/1.1",
        "Accept": "application/json",
    }
    data_bytes = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data_bytes = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def launch_whatsapp_browser(playwright):
    os.makedirs(PROFILE_DIR, exist_ok=True)
    for channel in ("chrome", "msedge", None):
        try:
            kwargs = {
                "user_data_dir": PROFILE_DIR,
                "headless": False,
                "viewport": {"width": 1200, "height": 800},
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            }
            if channel:
                kwargs["channel"] = channel
            context = playwright.chromium.launch_persistent_context(**kwargs)
            log("INFO", f"Launched persistent WhatsApp browser (engine: {channel or 'chromium'}).")
            return context
        except Exception as exc:
            log("WARN", f"Engine '{channel or 'chromium'}' unavailable: {exc}")
    raise RuntimeError("No compatible Chromium/Chrome/Edge browser found.")


def ensure_logged_in(page, timeout_sec: int = 300) -> bool:
    if "web.whatsapp.com" not in page.url:
        page.goto("https://web.whatsapp.com", wait_until="domcontentloaded")

    log("INFO", "Checking WhatsApp Web login session...")
    qr_prompted = False
    deadline = time.time() + timeout_sec
    chat_selectors = ["#pane-side", 'div[aria-label="Chat list"]', '[data-testid="chat-list"]']

    while time.time() < deadline:
        for sel in chat_selectors:
            try:
                if page.locator(sel).first.is_visible(timeout=400):
                    log("OK", "Office WhatsApp Web is logged in and ready!")
                    return True
            except Exception:
                pass

        if not qr_prompted:
            try:
                if page.locator("canvas, [data-ref]").first.is_visible(timeout=400):
                    log("ACTION", "Scan the QR Code in the Chrome window using your phone (1-time setup).")
                    qr_prompted = True
            except Exception:
                pass
        time.sleep(1.5)

    return False


def attach_and_send_pdf(page, pdf_path: str) -> tuple[bool, str | None]:
    send_selectors = [
        'button[aria-label="Send"]',
        'div[aria-label="Send"]',
        'span[data-icon="wds-ic-send-filled"]',
        'span[data-icon="send"]',
    ]
    attach_selectors = [
        'footer button[aria-label="Attach"]',
        'button[aria-label="Attach"]',
        'div[aria-label="Attach"]',
        'footer span[data-icon="plus-rounded"]',
        'footer span[data-icon="plus"]',
        'footer span[data-icon="clip"]',
    ]

    log("INFO", f"Attaching Bill PDF ({os.path.basename(pdf_path)}) in active chat...")
    clicked_attach = False
    for asel in attach_selectors:
        try:
            btn = page.locator(asel).last
            if btn.is_visible(timeout=1500):
                btn.click()
                clicked_attach = True
                break
        except Exception:
            pass

    if not clicked_attach:
        return False, "Could not locate WhatsApp Attach (+) button"

    time.sleep(0.8)

    # Prefer hidden Document <input type="file" accept="*"> to bypass Windows native File Dialog
    attached = False
    try:
        doc_input = page.locator('input[type="file"][accept="*"]').first
        if doc_input.count() > 0:
            doc_input.set_input_files(pdf_path)
            attached = True
    except Exception:
        pass

    if not attached:
        try:
            inputs = page.locator('input[type="file"]')
            for idx in range(inputs.count()):
                el = inputs.nth(idx)
                accept_val = (el.get_attribute("accept") or "").lower()
                if "image" not in accept_val:
                    el.set_input_files(pdf_path)
                    attached = True
                    break
        except Exception:
            pass

    if not attached:
        try:
            doc_item = page.locator(
                'li:has-text("Document"), [role="menuitem"]:has-text("Document"), button:has-text("Document")'
            ).first
            with page.expect_file_chooser(timeout=5000) as fc_info:
                doc_item.click(timeout=3000)
            fc_info.value.set_files(pdf_path)
            attached = True
        except Exception as exc:
            return False, f"Document upload selector failed: {exc}"

    # Wait for PDF preview screen & Send button
    deadline = time.time() + 18
    while time.time() < deadline:
        for ssel in send_selectors:
            try:
                sbtn = page.locator(ssel).last
                if sbtn.is_visible(timeout=500):
                    time.sleep(1.5)
                    sbtn.click()
                    time.sleep(3.5)
                    log("OK", f"Sent Bill PDF attachment: {os.path.basename(pdf_path)}")
                    return True, None
            except Exception:
                pass
        time.sleep(0.5)

    return False, "Timed out waiting for PDF preview Send button"


def send_whatsapp_message(page, raw_phone: str, message: str, attach_pdf: str | None = None) -> tuple[bool, str | None]:
    phone = clean_phone(raw_phone)
    if len(phone) < 11:
        return False, f"Invalid phone number: '{raw_phone}'"

    encoded_msg = urllib.parse.quote(message)
    send_url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"

    log("INFO", f"Opening chat for +{phone}...")
    page.goto(send_url, wait_until="domcontentloaded")

    send_selectors = [
        'button[aria-label="Send"]',
        'div[aria-label="Send"]',
        'span[data-icon="wds-ic-send-filled"]',
        'span[data-icon="send"]',
    ]
    composer_selectors = [
        'div[contenteditable="true"][data-tab="10"]',
        'footer div[contenteditable="true"]',
    ]

    deadline = time.time() + 45
    composer_el = None

    while time.time() < deadline:
        try:
            popup_text = page.locator('[data-animate-modal-popup="true"]').first.inner_text(timeout=300)
            if "invalid" in popup_text.lower() or "whatsapp" in popup_text.lower():
                log("ERR", f"Invalid WhatsApp number +{phone}: {popup_text.strip()}")
                try:
                    page.locator('[data-animate-modal-popup="true"] button').first.click(timeout=1000)
                except Exception:
                    pass
                return False, "Phone number not registered on WhatsApp"
        except Exception:
            pass

        for sel in composer_selectors:
            try:
                loc = page.locator(sel).last
                if loc.is_visible(timeout=300):
                    if loc.inner_text(timeout=300).strip():
                        composer_el = loc
                        break
            except Exception:
                pass

        if composer_el:
            time.sleep(1.2)
            sent_clicked = False
            for ssel in send_selectors:
                try:
                    btn = page.locator(ssel).last
                    if btn.is_visible(timeout=500):
                        btn.click()
                        sent_clicked = True
                        break
                except Exception:
                    pass

            if not sent_clicked:
                composer_el.focus()
                page.keyboard.press("Enter")

            time.sleep(2.0)

            if attach_pdf and os.path.exists(attach_pdf):
                pdf_ok, pdf_err = attach_and_send_pdf(page, attach_pdf)
                if not pdf_ok:
                    log("WARN", f"Retrying PDF attach once ({pdf_err})...")
                    time.sleep(1.0)
                    pdf_ok, pdf_err = attach_and_send_pdf(page, attach_pdf)
                if not pdf_ok:
                    return False, f"Text sent, but Bill PDF attachment failed: {pdf_err}"

            time.sleep(1.5)
            return True, None

        time.sleep(0.6)

    return False, "Timed out waiting for WhatsApp Web chat composer to load"


def run_daemon(config: dict, login_only: bool = False) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("ERR", "Playwright not installed! Run START WHATSAPP BOT.bat to auto-install.")
        sys.exit(1)

    site_url = config["siteUrl"].rstrip("/")
    token = config["bridgeToken"]
    poll_sec = max(2, int(config.get("pollIntervalSeconds", 4)))

    with sync_playwright() as pw:
        context = launch_whatsapp_browser(pw)
        page = context.pages[0] if context.pages else context.new_page()

        if not ensure_logged_in(page):
            log("ERR", "WhatsApp login timed out. Please try again.")
            context.close()
            return

        if login_only:
            log("OK", "Login verified and saved! Closing login check.")
            context.close()
            return

        queue_url = f"{site_url}/api/tally/whatsapp?status=pending"
        patch_url = f"{site_url}/api/tally/whatsapp"

        log("INFO", f"Polling {queue_url} every {poll_sec}s (Text + 1:1 Bill PDF enabled).")

        try:
            while True:
                try:
                    res = api_request(queue_url, method="GET", token=token)
                    items = res.get("queue", []) if isinstance(res, dict) else []

                    for item in items:
                        item_id = item.get("id")
                        phone = item.get("phone", "")
                        client = item.get("clientName", "Client")
                        message = item.get("message", "")
                        amt = float(item.get("amount") or 0)
                        should_attach_pdf = bool(item.get("attachPdf")) or (amt > 0)

                        log("QUEUE", f"Dispatching to {client} (+{clean_phone(phone)}) [PDF={'YES' if should_attach_pdf else 'NO'}]...")

                        try:
                            api_request(
                                patch_url,
                                method="PATCH",
                                payload={
                                    "id": item_id,
                                    "status": "WA_PROCESSING",
                                    "sentBy": "Python WhatsApp Bot (Generating PDF & Sending...)",
                                },
                                token=token,
                            )
                        except Exception:
                            pass

                        pdf_path = None
                        if should_attach_pdf:
                            try:
                                pdf_path = generate_tally_invoice_pdf(context, item)
                            except Exception as pdf_exc:
                                log("WARN", f"PDF generation warning: {pdf_exc}")

                        ok, err_msg = send_whatsapp_message(page, phone, message, attach_pdf=pdf_path)
                        sent_label = "Python Bot (Msg + Bill PDF)" if (ok and pdf_path) else "Python Bot (Office PC)"
                        status_payload = {
                            "id": item_id,
                            "status": "WA_SENT" if ok else "WA_FAILED",
                            "sentBy": sent_label,
                            "errorMessage": err_msg,
                        }
                        api_request(patch_url, method="PATCH", payload=status_payload, token=token)

                        if ok:
                            log("SUCCESS", f"Delivered to {client} (+{clean_phone(phone)}) [{sent_label}]!")
                        else:
                            log("FAIL", f"Failed for {client}: {err_msg}")

                except urllib.error.URLError as exc:
                    log("WARN", f"Cloud network unreachable ({exc.reason}), retrying...")
                except Exception as exc:
                    log("WARN", f"Loop warning: {exc}")

                time.sleep(poll_sec)
        except KeyboardInterrupt:
            log("INFO", "Stopping WhatsApp Auto-Dispatcher...")
        finally:
            context.close()


def run_single_send(phone: str, message: str, pdf_path: str | None) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        context = launch_whatsapp_browser(pw)
        page = context.pages[0] if context.pages else context.new_page()
        if not ensure_logged_in(page):
            log("ERR", "Not logged into WhatsApp Web.")
            context.close()
            sys.exit(1)

        ok, err = send_whatsapp_message(page, phone, message, attach_pdf=pdf_path)
        context.close()
        if ok:
            log("SUCCESS", f"Message sent to +{clean_phone(phone)}!")
        else:
            log("ERR", f"Send failed: {err}")
            sys.exit(1)


def run_test_pdf() -> None:
    from playwright.sync_api import sync_playwright

    sample_item = {
        "invoiceId": "INV-425",
        "clientName": "Sona Traders",
        "amount": 3500,
        "service": "TDS & Challan — October 2026 / FY 2026-27 (Consolidated Fee)",
        "date": "28/11/2026",
        "voucherNo": "529",
    }
    with sync_playwright() as pw:
        context = launch_whatsapp_browser(pw)
        pdf_path = generate_tally_invoice_pdf(context, sample_item)
        context.close()
        log("OK", f"Test PDF created cleanly at: {pdf_path}")


def main():
    parser = argparse.ArgumentParser(description="CA Kiran K. Shinde & Co. WhatsApp Auto-Dispatcher")
    parser.add_argument("--send", help="Send a single message to this phone number and exit")
    parser.add_argument("--msg", help="Message body for --send mode")
    parser.add_argument("--pdf", help="Optional local PDF path to attach in --send mode")
    parser.add_argument("--login-only", action="store_true", help="Verify WhatsApp QR login session and exit")
    parser.add_argument("--test-pdf", action="store_true", help="Generate sample 1:1 Tally Bill PDF and exit")
    parser.add_argument("--url", help="Override Cloud Bridge siteUrl")
    parser.add_argument("--token", help="Override Cloud Bridge token")
    args = parser.parse_args()

    config = load_config()
    if args.url:
        config["siteUrl"] = args.url
    if args.token:
        config["bridgeToken"] = args.token

    if args.test_pdf:
        run_test_pdf()
    elif args.send:
        if not args.msg:
            log("ERR", "--msg is required when using --send")
            sys.exit(1)
        run_single_send(args.send, args.msg, args.pdf)
    else:
        run_daemon(config, login_only=args.login_only)


if __name__ == "__main__":
    main()
