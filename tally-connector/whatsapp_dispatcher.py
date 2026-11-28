"""
CA Kiran K. Shinde & Co. — WhatsApp Web Auto-Dispatcher (Python Bot)
Connects the Cloud Admin Panel (/api/tally/whatsapp) directly to your
logged-in Office WhatsApp Web so every framed message & invoice link
is delivered automatically without manual clicking.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

# Ensure UTF-8 printing on Windows console (handles emojis and Rupee symbol)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
PROFILE_DIR = os.path.join(BASE_DIR, "wa_session_profile")


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


def api_request(url: str, method: str = "GET", payload: dict | None = None, token: str = "") -> dict:
    headers = {
        "x-bridge-token": token,
        "User-Agent": "KiranShinde-WhatsApp-Dispatcher/1.0",
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
    # Try system Chrome first (zero extra downloads), then Edge, then bundled Chromium
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

    chat_selectors = [
        "#pane-side",
        'div[aria-label="Chat list"]',
        '[data-testid="chat-list"]',
    ]

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
                qr_visible = page.locator('canvas, [data-ref]').first.is_visible(timeout=400)
                if qr_visible:
                    log("ACTION", "Scan the QR Code in the Chrome window using your phone (1-time setup).")
                    qr_prompted = True
            except Exception:
                pass
        time.sleep(1.5)

    return False


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
        'span[data-icon="send"]',
        'span[data-icon="wds-ic-send-filled"]',
    ]
    composer_selectors = [
        'div[contenteditable="true"][data-tab="10"]',
        'footer div[contenteditable="true"]',
    ]

    deadline = time.time() + 40
    composer_el = None

    while time.time() < deadline:
        # 1. Check for invalid phone number dialog
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

        # 2. Wait for composer box & Send button
        for sel in composer_selectors:
            try:
                loc = page.locator(sel).last
                if loc.is_visible(timeout=300):
                    text_inside = loc.inner_text(timeout=300).strip()
                    if text_inside:
                        composer_el = loc
                        break
            except Exception:
                pass

        if composer_el:
            # Small buffer so WhatsApp Web finishes rendering link previews
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

            # Optional local PDF attachment support
            if attach_pdf and os.path.exists(attach_pdf):
                try:
                    time.sleep(1.0)
                    attach_btn = page.locator('button[aria-label="Attach"], span[data-icon="plus"], span[data-icon="clip"]').first
                    attach_btn.click(timeout=3000)
                    file_input = page.locator('input[type="file"]').first
                    file_input.set_input_files(attach_pdf)
                    time.sleep(1.5)
                    for ssel in send_selectors:
                        btn = page.locator(ssel).last
                        if btn.is_visible(timeout=2000):
                            btn.click()
                            break
                    log("OK", f"Attached and sent PDF: {os.path.basename(attach_pdf)}")
                except Exception as exc:
                    log("WARN", f"Message sent, but PDF attachment failed: {exc}")

            time.sleep(2.5)
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

        log("INFO", f"Polling {queue_url} every {poll_sec}s. Keep this window minimized.")

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
                        log("QUEUE", f"Dispatching WhatsApp to {client} (+{clean_phone(phone)})...")

                        # Claim item atomically so another worker doesn't double-send
                        try:
                            api_request(
                                patch_url,
                                method="PATCH",
                                payload={
                                    "id": item_id,
                                    "status": "WA_PROCESSING",
                                    "sentBy": "Python WhatsApp Bot (Sending...)",
                                },
                                token=token,
                            )
                        except Exception:
                            pass

                        ok, err_msg = send_whatsapp_message(page, phone, message)
                        status_payload = {
                            "id": item_id,
                            "status": "WA_SENT" if ok else "WA_FAILED",
                            "sentBy": "Python WhatsApp Bot (Office PC)",
                            "errorMessage": err_msg,
                        }
                        api_request(patch_url, method="PATCH", payload=status_payload, token=token)

                        if ok:
                            log("SUCCESS", f"Delivered WhatsApp to {client} (+{clean_phone(phone)})!")
                        else:
                            log("FAIL", f"Failed to send to {client}: {err_msg}")

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


def main():
    parser = argparse.ArgumentParser(description="CA Kiran K. Shinde & Co. WhatsApp Auto-Dispatcher")
    parser.add_argument("--send", help="Send a single message to this phone number and exit")
    parser.add_argument("--msg", help="Message body for --send mode")
    parser.add_argument("--pdf", help="Optional local PDF path to attach in --send mode")
    parser.add_argument("--login-only", action="store_true", help="Verify WhatsApp QR login session and exit")
    parser.add_argument("--url", help="Override Cloud Bridge siteUrl")
    parser.add_argument("--token", help="Override Cloud Bridge token")
    args = parser.parse_args()

    config = load_config()
    if args.url:
        config["siteUrl"] = args.url
    if args.token:
        config["bridgeToken"] = args.token

    if args.send:
        if not args.msg:
            log("ERR", "--msg is required when using --send")
            sys.exit(1)
        run_single_send(args.send, args.msg, args.pdf)
    else:
        run_daemon(config, login_only=args.login_only)


if __name__ == "__main__":
    main()
