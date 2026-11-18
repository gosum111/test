"""
เปิดเว็บให้มือถือสแกนได้ (คลิกเดียว) — ใช้คู่กับ start-mobile.bat

1. เปิดเซิร์ฟเวอร์เว็บ (TRUST_PROXY=1 เพื่อให้ระบบกันสแปม/ล็อกรหัสเห็น IP จริงของผู้ใช้)
2. เปิด Cloudflare Tunnel แบบชั่วคราว → ได้ลิงก์ https://xxxx.trycloudflare.com ที่มือถือทุกเครือข่ายเปิดได้
3. ตั้งลิงก์นี้เป็น "ที่อยู่เว็บ" ของป้าย QR ให้อัตโนมัติ (server/notify.json)
4. เปิดหน้า QR ตัวใหญ่บนจอให้สแกน

ลิงก์จะเปลี่ยนใหม่ทุกครั้งที่เปิด — ป้าย QR ที่พิมพ์ด้วยลิงก์นี้ใช้ได้เฉพาะตอนที่หน้าต่างนี้เปิดอยู่
ปิดหน้าต่าง / กด Ctrl+C = ปิดทั้งลิงก์และเซิร์ฟเวอร์
"""
import json, os, re, shutil, subprocess, sys, threading, time, urllib.request, webbrowser
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
PORT = os.environ.get("PORT", "8000")
LOCAL = f"http://localhost:{PORT}"
NOTIFY = ROOT / "server" / "notify.json"


def find_cloudflared():
    for p in (r"C:\Program Files (x86)\cloudflared\cloudflared.exe", r"C:\Program Files\cloudflared\cloudflared.exe"):
        if Path(p).exists():
            return p
    return shutil.which("cloudflared")


def wait_ok(url, timeout):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=10)
            return True
        except Exception:
            time.sleep(1)
    return False


def set_site_url(url):
    cfg = {}
    try:
        cfg = json.loads(NOTIFY.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    cfg["site_url"] = url
    NOTIFY.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    exe = find_cloudflared()
    if not exe:
        sys.exit("ไม่พบโปรแกรม cloudflared — ติดตั้งด้วยคำสั่ง: winget install --id Cloudflare.cloudflared")

    env = {**os.environ, "TRUST_PROXY": "1", "PYTHONIOENCODING": "utf-8"}
    print("1/3 เปิดเซิร์ฟเวอร์เว็บ ...", flush=True)
    srv = subprocess.Popen([sys.executable, str(ROOT / "server" / "server.py")], cwd=ROOT, env=env)
    procs = [srv]
    try:
        if not wait_ok(f"{LOCAL}/api/health", 30):
            sys.exit("เปิดเซิร์ฟเวอร์ไม่สำเร็จ — พอร์ต 8000 อาจถูกใช้อยู่ (มีหน้าต่างเซิร์ฟเวอร์เปิดค้างอยู่หรือไม่?)")

        print("2/3 เปิดลิงก์ออนไลน์ (Cloudflare Tunnel) ...", flush=True)
        cf = subprocess.Popen([exe, "tunnel", "--no-autoupdate", "--url", LOCAL],
                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        procs.append(cf)
        url, end = None, time.time() + 90
        while not url and time.time() < end:
            line = cf.stderr.readline()
            if not line:
                break
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
            if m:
                url = m.group(0)
        if not url:
            sys.exit("สร้างลิงก์ไม่สำเร็จ — ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่")
        threading.Thread(target=lambda: [None for _ in cf.stderr], daemon=True).start()   # อ่าน log ทิ้งไม่ให้ค้าง

        print("3/3 รอให้ลิงก์พร้อมใช้งาน ...", flush=True)
        if not wait_ok(f"{url}/api/health", 90):
            print("   (ลิงก์ยังไม่ตอบ — ลองเปิดอีกครั้งใน 1–2 นาที)", flush=True)
        set_site_url(url)

        print("\n" + "=" * 64)
        print(f"  ✓ เปิดบนมือถือได้แล้ว: {url}")
        print(f"  ✓ ตั้งเป็นที่อยู่เว็บของป้าย QR ให้แล้ว (พิมพ์ป้ายจากหน้าแอดมินได้เลย)")
        print(f"  • หน้าแอดมิน (เครื่องนี้): {LOCAL}/admin.html")
        print("  • ลิงก์นี้ใช้ได้เฉพาะตอนที่หน้าต่างนี้เปิดอยู่ — ปิดหน้าต่าง = ปิดลิงก์")
        print("=" * 64 + "\n", flush=True)
        webbrowser.open(f"{LOCAL}/mobile-qr.html?u={quote(url, safe='')}")

        while all(p.poll() is None for p in procs):
            time.sleep(1)
        print("โปรแกรมหยุดทำงาน — ปิดหน้าต่างแล้วเปิด start-mobile.bat ใหม่", flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        set_site_url(LOCAL)   # ลิงก์ชั่วคราวปิดแล้ว → กลับเป็น localhost (กันพิมพ์ป้ายด้วยลิงก์ที่ใช้ไม่ได้)


if __name__ == "__main__":
    main()
