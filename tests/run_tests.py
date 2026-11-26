"""
ชุดทดสอบอัตโนมัติของเว็บสวนสมุนไพร

    python tests/run_tests.py          ทดสอบ API ทั้งหมด (+ ทดสอบหน้าเว็บในเบราว์เซอร์ ถ้ามี Edge/Chrome)
    python tests/run_tests.py --api    ทดสอบเฉพาะ API (เร็ว)

ปลอดภัยกับข้อมูลจริง: เปิดเซิร์ฟเวอร์ทดสอบแยก (พอร์ต 8799) บน "สำเนา" ของฐานข้อมูลในโฟลเดอร์ชั่วคราว
ใช้รหัสแอดมินชั่วคราว ไม่แตะ server/herbgarden.db, admin.json หรือ notify.json จริง และลบทิ้งเมื่อเสร็จ
"""
import base64, json, os, secrets, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8799
BASE = f"http://127.0.0.1:{PORT}"
PW = "test-" + secrets.token_hex(6)
TMP = tempfile.mkdtemp(prefix="herbtest-")
ENV = {**os.environ, "HERB_DB": os.path.join(TMP, "herb.db"), "PORT": str(PORT), "ADMIN_PASSWORD": PW,
       "HOST": "127.0.0.1", "PYTHONIOENCODING": "utf-8"}
RESULTS = []


# ---------------------------------------------------------------- helpers
def check(name, ok, info=""):
    RESULTS.append((name, bool(ok), info))
    print(("  ✓ " if ok else "  ✗ ") + name + (f"  — {info}" if info and not ok else ""), flush=True)


def call(path, data=None, token=None, method=None, raw=False, headers=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 method=method or ("POST" if data is not None else "GET"))
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            return r.status, (body.decode("utf-8", "replace") if raw else json.loads(body or b"null"))
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, (body.decode("utf-8", "replace") if raw else json.loads(body))
        except ValueError:
            return e.code, body.decode("utf-8", "replace")


def start_server():
    p = subprocess.Popen([sys.executable, os.path.join(ROOT, "server", "server.py")], cwd=ROOT, env=ENV,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/api/health", timeout=2)
            return p
        except Exception:
            time.sleep(0.25)
    p.kill()
    raise SystemExit("เปิดเซิร์ฟเวอร์ทดสอบไม่ได้ (พอร์ต 8799 ถูกใช้อยู่หรือไม่?)")


def login():
    return call("/api/login", {"password": PW})[1]["token"]


# ---------------------------------------------------------------- tests
def test_static_and_security():
    print("\n[หน้าเว็บและการป้องกันไฟล์]")
    for p in ("/", "/index.html", "/admin.html", "/css/style.css", "/js/main.js", "/news", "/about/history", "/herb/search"):
        check(f"เปิด {p} ได้", call(p, raw=True)[0] == 200)
    for p in ("/server/server.py", "/server/herbgarden.db", "/server/admin.json", "/server/logs/server.log",
              "/start-server.bat", "/DEPLOY.md", "/tests/run_tests.py", "/.claude/settings.local.json", "/images/"):
        check(f"กันไฟล์ระบบ {p}", call(p, raw=True)[0] == 404)
    s, html = call("/news/999999", raw=True)
    check("หน้าที่ไม่มีอยู่ตอบ 404", s == 404 and "noindex" in html)
    s, html = call("/about/history", raw=True)
    check("หน้าเนื้อหามี title และ og:image สำหรับแชร์", "<title>" in html and 'property="og:image"' in html and '<base href="/">' in html)
    robots = call("/robots.txt", raw=True)[1]
    check("robots.txt กันหน้าแอดมิน (โหมดทดลอง: กันทุกหน้า)", "Disallow: /admin.html" in robots or "Disallow: /\n" in robots)
    if "Disallow: /\n" in robots:   # โหมดเว็บไซต์ทดลอง
        s, html = call("/", raw=True)
        check("โหมดทดลอง: หน้าเว็บมี noindex + แถบเว็บไซต์ทดลอง", 'content="noindex, nofollow"' in html and "เว็บไซต์ทดลอง" in html)
        check("โหมดทดลอง: settings.demo = 1", call("/api/public")[1]["settings"].get("demo") == "1")
    check("sitemap.xml มีลิงก์หน้าเว็บ", call("/sitemap.xml", raw=True)[1].count("<url>") >= 10)
    req = urllib.request.urlopen(BASE + "/index.html")
    check("มี header ความปลอดภัย", req.headers["X-Content-Type-Options"] == "nosniff" and req.headers["X-Frame-Options"] == "SAMEORIGIN")
    s, h = call("/api/health")
    check("/api/health ตอบ ok", s == 200 and h["status"] == "ok")
    hid = call("/api/public")[1]["herbs"][0]["id"]   # ลิงก์สั้นจาก QR ป้ายต้นไม้ (ตัวพิมพ์ใหญ่)
    r = urllib.request.urlopen(f"{BASE}/P/{hid}")
    check("ลิงก์สั้น QR /P/<เลข> → หน้าพืช", r.status == 200 and r.geturl().endswith(f"/herb/plant/{hid}"))
    check("ลิงก์สั้น QR ตัวพิมพ์เล็ก /p/<เลข> ก็ได้", urllib.request.urlopen(f"{BASE}/p/{hid}").geturl().endswith(f"/herb/plant/{hid}"))


def test_public_api():
    print("\n[ข้อมูลสาธารณะ]")
    s, d = call("/api/public")
    check("/api/public ตอบได้", s == 200)
    for k in ("news", "articles", "workshops", "brochures", "herbs", "pages", "activities", "services", "events", "map_spots", "settings"):
        check(f"มีข้อมูล {k}", k in d)
    if d.get("herbs"):
        h = d["herbs"][0]
        check("ข้อมูลพืชมีคอลัมน์ครบ", all(k in h for k in ("th", "sci", "province", "region", "status", "img", "img_credit")))
    check("แก้ข้อมูลโดยไม่ล็อกอินไม่ได้", call("/api/news", {"title": "x"})[0] == 401)


def test_crud_trash_restore(tok):
    print("\n[เพิ่ม/แก้/ลบ/ถังขยะ]")
    s, n = call("/api/news", {"title": "ข่าวทดสอบ", "type": "ข่าวสาร"}, tok)
    check("เพิ่มข่าวได้", s == 201 and n.get("id"))
    s, n2 = call(f"/api/news/{n['id']}", {"title": "ข่าวทดสอบ (แก้)", "type": "กิจกรรม"}, tok, "PUT")
    check("แก้ข่าวได้", s == 200 and n2["title"] == "ข่าวทดสอบ (แก้)")
    s, d = call(f"/api/news/{n['id']}", token=tok, method="DELETE")
    check("ลบแล้วไปถังขยะ", s == 200 and d.get("deleted_at") and call(f"/api/news/{n['id']}")[0] == 404)
    check("ถังขยะมีรายการที่ลบ", any(g["deleted_at"] == d["deleted_at"] for g in call("/api/trash", token=tok)[1]))
    s, r = call("/api/trash/restore", {"type": "news", "deleted_at": d["deleted_at"]}, tok)
    check("กู้คืนจากถังขยะได้", s == 201 and r["restored"] == 1 and call(f"/api/news/{n['id']}")[0] == 200)
    check("ตรวจข้อมูล: ไม่ใส่หัวข้อ → ปฏิเสธ", call("/api/news", {"title": ""}, tok)[0] == 400)
    check("ตรวจข้อมูล: วันที่ผิดรูปแบบ → ปฏิเสธ", call("/api/events", {"title": "x", "date": "1/1/2026", "kind": "event"}, tok)[0] == 400)
    check("ตรวจข้อมูล: จังหวัดผิด → ปฏิเสธ", call("/api/herbs", {"th": "x", "province": "ไม่มีจังหวัดนี้"}, tok)[0] == 400)
    check("ตรวจข้อมูล: สถานะผิด → ปฏิเสธ", call("/api/herbs", {"th": "x", "status": "สูญพันธุ์แล้ว"}, tok)[0] == 400)
    call(f"/api/news/{n['id']}", token=tok, method="DELETE")


def test_site_and_map(tok):
    print("\n[ตั้งค่าเว็บไซต์ / แผนผังสวน / เปลี่ยนรหัส]")
    s, st = call("/api/settings", token=tok)
    check("อ่านข้อมูลเว็บไซต์ได้ (แอดมิน)", s == 200 and "site_phones" in st and "password_source" in st)
    check("อ่านข้อมูลเว็บไซต์ (แอดมิน) โดยไม่ล็อกอินไม่ได้", call("/api/settings")[0] == 401)
    check("ตรวจข้อมูล: ลิงก์โซเชียลไม่ใช่ https → ปฏิเสธ", call("/api/settings", {"site_facebook": "http://x.com"}, tok, "PUT")[0] == 400)
    check("ตรวจข้อมูล: อีเมลผิดรูปแบบ → ปฏิเสธ", call("/api/settings", {"site_email": "abc"}, tok, "PUT")[0] == 400)
    s, st2 = call("/api/settings", {"site_phones": "02-000-0000", "site_show_info": "1"}, tok, "PUT")
    pub = call("/api/public")[1]["settings"]
    check("แก้ข้อมูลติดต่อแล้วหน้าเว็บได้ค่าใหม่", s == 200 and pub["site_phones"] == "02-000-0000" and pub["site_show_info"] == "1")
    call("/api/settings", {k: st[k] for k in ("site_phones", "site_show_info")}, tok, "PUT")   # คืนค่าเดิม

    spots = call("/api/public")[1].get("map_spots", [])
    check("แผนผังสวน: มีข้อมูลกลุ่มและสถานที่", any(x["kind"] == "group" for x in spots) and any(x["kind"] == "place" for x in spots),
          f"{len(spots)} จุด")
    bad = [({"kind": "group", "num": "21", "title": "x", "x": "150", "y": "10"}, "ตำแหน่งเกิน 100"),
           ({"kind": "group", "num": "21", "title": "x", "x": "10", "y": ""}, "ใส่ x ไม่ใส่ y"),
           ({"kind": "place", "num": "1", "title": "x", "icon": "ไม่มีไอคอนนี้"}, "ไอคอนผิด"),
           ({"kind": "other", "num": "1", "title": "x"}, "ประเภทผิด"),
           ({"kind": "group", "num": "", "title": "x"}, "ไม่ใส่เลขกลุ่ม")]
    for data, why in bad:
        check(f"แผนผังสวน: {why} → ปฏิเสธ", call("/api/map_spots", data, tok)[0] == 400)
    s, sp = call("/api/map_spots", {"kind": "place", "num": "99", "icon": "D", "title": "จุดทดสอบ", "x": "12.50", "y": "40"}, tok)
    check("แผนผังสวน: เพิ่มสถานที่ได้", s == 201 and sp["x"] == "12.5")
    if s == 201:
        s, sp2 = call(f"/api/map_spots/{sp['id']}", {**sp, "title": "จุดทดสอบ (แก้)", "x": "", "y": ""}, tok, "PUT")
        check("แผนผังสวน: แก้ได้ (ลบหมุดออก)", s == 200 and sp2["title"] == "จุดทดสอบ (แก้)" and sp2["x"] == "")
        s, d = call(f"/api/map_spots/{sp['id']}", token=tok, method="DELETE")
        check("แผนผังสวน: ลบแล้วไปถังขยะ", s == 200 and any(g["type"] == "map_spots" for g in call("/api/trash", token=tok)[1]))

    s, r = call("/api/password", {"current": PW, "new": "new-password-123"}, tok)
    check("เปลี่ยนรหัส: รหัสตั้งจาก ADMIN_PASSWORD → ปฏิเสธพร้อมเหตุผล", s == 400 and "ADMIN_PASSWORD" in r.get("error", ""))
    check("เปลี่ยนรหัสโดยไม่ล็อกอินไม่ได้", call("/api/password", {"current": "x", "new": "y" * 8})[0] == 401)


def test_import(tok):
    print("\n[นำเข้าไฟล์สมุนไพร]")
    csv_text = ("ชื่อเรื่อง\r\n\r\nมีในสวน,ชื่อภาษาไทย,ชื่อวิทยาศาสตร์,จังหวัด,สถานะการอนุรักษ์,หมายเหตุจากสวน\r\n"
                "ใช่,พืชทดสอบ ก,Testus alpha,ระยอง,หายาก,\r\nไม่มี,พืชทดสอบ ข,Testus beta,,,\r\n"
                ",พืชทดสอบ ค,Testus gamma,จังหวัดผิด,,\r\n")
    data = "data:text/csv;base64," + base64.b64encode(csv_text.encode("utf-8-sig")).decode()
    s, j = call("/api/herbs/import", {"data": data, "mode": "merge", "dry_run": True}, tok)
    check("ตรวจไฟล์ (dry run) ได้", s == 201)
    if s == 201:
        check("หาแถวหัวตารางเจอเอง (ข้ามแถวชื่อเรื่อง)", j["header_row"] == 2, f"header_row={j['header_row']}")
        acts = {i["data"]["th"]: (i["action"], i["errors"]) for i in j["items"]}
        check("แถว 'มีในสวน = ไม่มี' ถูกข้าม", acts["พืชทดสอบ ข"][0] == "skip")
        check("แถวจังหวัดผิดถูกข้าม", acts["พืชทดสอบ ค"][0] == "skip")
        check("แถวถูกต้องจะถูกเพิ่ม", acts["พืชทดสอบ ก"][0] == "insert")
        check("dry run ไม่บันทึกจริง", not any(h["th"] == "พืชทดสอบ ก" for h in call("/api/herbs", token=tok)[1]))
    # โหมดแทนที่ทั้งหมด: ชนิดที่ชื่อเดิมต้องคงเลขประจำพืช (ป้าย QR ที่ติดไว้ยังใช้ได้)
    herbs = call("/api/herbs", token=tok)[1]
    if len(herbs) >= 2:
        keep, gone = herbs[0], herbs[1]
        csv2 = f"ชื่อภาษาไทย,ชื่อวิทยาศาสตร์\r\n{keep['th']},{keep['sci']}\r\nพืชใหม่ทดสอบ,Testus novus\r\n".encode("utf-8-sig")
        s, j = call("/api/herbs/import", {"data": "data:text/csv;base64," + base64.b64encode(csv2).decode(),
                                          "mode": "replace", "dry_run": False}, tok)
        check("นำเข้าแบบแทนที่ทั้งหมดได้", s == 201 and j["summary"]["update"] == 1 and j["summary"]["insert"] == 1,
              str(j.get("summary")))
        check("ชนิดเดิมคงเลขเดิม (QR ไม่เสีย)", call(f"/herb/plant/{keep['id']}", raw=True)[0] == 200)
        check("ชนิดที่ไม่อยู่ในไฟล์ไปถังขยะ", call(f"/herb/plant/{gone['id']}", raw=True)[0] == 404)
    check("ไฟล์ที่ไม่มีคอลัมน์ชื่อ → ให้เลือกคอลัมน์เอง (ไม่บันทึก)",
          call("/api/herbs/import", {"data": "data:text/csv;base64," + base64.b64encode(b"a,b\r\n1,2").decode(),
                                     "mode": "merge", "dry_run": False}, tok)[0] == 400)


def test_backup(tok):
    print("\n[สำรองและกู้คืนข้อมูล]")
    s, bk = call("/api/backups", {}, tok)
    check("สำรองข้อมูลได้", s == 201 and bk["name"].endswith(".db"))
    s, n = call("/api/news", {"title": "หลังสำรอง"}, tok)
    s, r = call("/api/backups/restore", {"name": bk["name"]}, tok)
    check("กู้คืนได้ + สำรองข้อมูลปัจจุบันไว้ก่อนกู้", s == 201 and r.get("safety_backup"))
    check("ข้อมูลกลับเป็นเหมือนตอนสำรอง", call(f"/api/news/{n['id']}")[0] == 404)
    check("ยังล็อกอินอยู่หลังกู้คืน", call("/api/messages", token=tok)[0] == 200)
    s, raw = call(f"/api/backups/download/{bk['name']}", token=tok, raw=True)
    check("ดาวน์โหลดไฟล์สำรองได้", s == 200 and raw.startswith("SQLite format 3"))
    check("ชื่อไฟล์แปลก ๆ ถูกปฏิเสธ", call("/api/backups/restore", {"name": "../server.py"}, tok)[0] == 404)


def test_contact_and_spam():
    print("\n[ฟอร์มติดต่อและกันสแปม]")
    base = {"name": "ทดสอบ", "phone": "081-234-5678", "detail": "สวัสดี", "t": 5000}
    check("กับดักบอต (ช่องซ่อน)", call("/api/contact", {**base, "website": "x"})[0] == 201)
    check("ส่งเร็วผิดปกติ (บอต)", call("/api/contact", {**base, "t": 100})[0] == 201)
    check("เบอร์โทรผิดรูปแบบ → ปฏิเสธ", call("/api/contact", {**base, "phone": "abc"})[0] == 400)
    check("ลิงก์เยอะ → ปฏิเสธ", call("/api/contact", {**base, "detail": "http://a http://b http://c"})[0] == 400)
    check("ส่งข้อความได้", call("/api/contact", base)[0] == 201)
    check("ส่งซ้ำ → แจ้งว่าได้รับแล้ว", call("/api/contact", base)[0] == 409)
    call("/api/contact", {**base, "detail": "2"}); call("/api/contact", {**base, "detail": "3"})
    check("ส่งถี่เกิน → จำกัด", call("/api/contact", {**base, "detail": "4"})[0] == 429)


def test_sessions_survive_restart(server):
    print("\n[การเข้าสู่ระบบ]")
    tok = login()
    server.terminate(); server.wait()
    server = start_server()
    check("รีสตาร์ตเซิร์ฟเวอร์แล้วยังล็อกอินอยู่", call("/api/messages", token=tok)[0] == 200)
    check("ออกจากระบบแล้ว token ใช้ไม่ได้", call("/api/logout", {}, tok)[0] == 201 and call("/api/messages", token=tok)[0] == 401)
    return server


def test_login_lockout():
    print("\n[กันเดารหัส]")
    codes = [call("/api/login", {"password": "wrong"})[0] for _ in range(5)]
    check("ผิด 4 ครั้งแรกตอบ 401", codes[:4] == [401] * 4, str(codes))
    check("ครั้งที่ 5 ล็อก (429)", codes[4] == 429)
    check("ระหว่างล็อก รหัสถูกก็เข้าไม่ได้", call("/api/login", {"password": PW})[0] == 429)


def test_browser():
    exe = next((p for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                            r"C:\Program Files\Google\Chrome\Application\chrome.exe") if os.path.exists(p)), None)
    if not exe:
        print("\n[หน้าเว็บในเบราว์เซอร์] ข้าม — ไม่พบ Edge/Chrome")
        return
    print("\n[หน้าเว็บในเบราว์เซอร์]")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from cdp import Browser
    b = Browser(exe, port=9399)
    try:
        js_err = lambda: [e for e in b.errors() if not e.startswith("log[network]")]
        b.goto(BASE + "/", settle=1.5)
        check("หน้าแรก: ข่าว/บริการ/ปฏิทินแสดง",
              b.js("document.querySelectorAll('#homeNews .news').length>0 && document.querySelectorAll('#svcTrack .svc-card').length>0 && document.querySelectorAll('#homeCal .pcal-grid > *').length>=28"))
        check("หน้าแรก: ไม่มี JavaScript error", not js_err(), "; ".join(js_err()))
        b.js("document.querySelector('a[href=\"/herb/search\"]').click()")
        check("เมนูเปลี่ยนหน้าด้วยลิงก์จริง", b.wait("location.pathname==='/herb/search' && document.querySelector('#hsCount')"))
        n_all = b.js("document.querySelectorAll('#hsBody .hs-doc').length")
        b.js("{const s=document.querySelector('#hsCat'); s.value=s.options[s.options.length-1].value; s.onchange()}")
        check("ค้นหาสมุนไพร: ตัวกรองหมวดทำงาน", b.js("document.querySelectorAll('#hsBody .hs-doc').length") <= n_all)
        b.js("history.back()")
        check("ปุ่มย้อนกลับใช้ได้", b.wait("location.pathname==='/'"))
        hid = call("/api/herbs?", token=login())[1][0]["id"]
        b.goto(f"{BASE}/herb/plant/{hid}", settle=1.5)   # เหมือนสแกน QR แล้วเปิดลิงก์ตรง
        check("สแกน QR → หน้าพืชแสดงชื่อและข้อมูล (ไม่มีภาพหัวหน้า)",
              b.js("document.querySelector('#subHero').hidden && document.querySelector('#subTitle').textContent.length>0 && !!document.querySelector('#subBody h2')"))
        b.goto(f"{BASE}/herb/plant/99999999", settle=1.5)
        check("QR ของพืชที่ไม่มีแล้ว → ข้อความแนะนำ", "ไม่พบข้อมูลพืช" in b.js("document.querySelector('#subTitle').textContent"))
        b.goto(BASE + "/admin.html", settle=1)
        b.js(f"document.querySelector('#pw').value={json.dumps(PW)}; document.querySelector('#loginForm').requestSubmit()")
        check("แอดมิน: เข้าสู่ระบบได้", b.wait("!document.querySelector('#app').hidden"))
        bad = []
        for t in b.js("[...document.querySelectorAll('#tabs button')].map(x=>x.dataset.t)"):
            b.js(f"document.querySelector('#tabs button[data-t=\"{t}\"]').click()")
            b.wait("!/กำลังโหลด/.test(document.querySelector('#list').innerText)", 10)
            if any(w in b.js("document.querySelector('#list').innerText") for w in ("เกิดข้อผิดพลาด", "ไม่พบ API")):
                bad.append(t)
        check("แอดมิน: ทุกแท็บโหลดได้", not bad, ", ".join(bad))
        check("แอดมิน: สร้าง QR ได้ (ไลบรารีโหลดแล้ว)", b.js("qrSvg('https://example.com/herb/plant/1').includes('<svg')"))
        # ฟอร์มเพิ่มพืช: ตัวอย่างป้าย QR + หน้าพืช และปุ่ม "บันทึก + พิมพ์ป้าย QR" ในขั้นตอนเดียว
        b.js("document.querySelector('#tabs button[data-t=\"herbs\"]').click()")
        b.wait("!document.querySelector('#addBtn').hidden && document.querySelector('#list .item')")
        b.js("document.querySelector('#addBtn').click()")
        b.wait("document.querySelector('#dlg').open")
        b.js("{const i=document.querySelector('#fields [name=th]'); i.value='พืชทดสอบ QR'; i.dispatchEvent(new Event('input',{bubbles:true}))}")
        check("ฟอร์มเพิ่มพืช: มีส่วนพิมพ์ป้าย QR + ตัวอย่างป้ายและหน้าพืช",
              b.js("!document.querySelector('#qrInline').hidden")
              and b.wait("(document.querySelector('#pvFrame').srcdoc||'').includes('QR สร้างอัตโนมัติ') && document.querySelector('#pvFrame').srcdoc.includes('plant-facts')"))
        b.js("{const c=document.querySelector('#qrInlineCopies'); c.value=3}")
        b.js("document.querySelector('#savePrintBtn').click()", gesture=True)   # เหมือนผู้ใช้กดจริง
        check("บันทึก + พิมพ์ป้าย QR: บันทึกพืชและเปิดหน้าพิมพ์ในขั้นตอนเดียว",
              b.wait("!document.querySelector('#dlg').open && document.querySelector('.toast') && document.querySelector('.toast').textContent.includes('3 ป้าย')")
              and b.wait("document.querySelector('#list').innerText.includes('พืชทดสอบ QR')"))
        b.wait("document.querySelector('#list [data-edit]')")
        b.js("document.querySelector('#list [data-edit]').click()")
        check("ฟอร์มแก้ไขพืช: ตัวอย่างแสดง QR จริงของพืช", b.wait("(document.querySelector('#pvFrame').srcdoc||'').includes('<svg')"))
        b.js("document.querySelector('#dlg').close()")
        b.wait("document.querySelector('#list [data-qr]')")
        b.js("document.querySelector('#list [data-qr]').click()")
        check("ปุ่ม 🏷 QR ในรายการพืชเปิดหน้าต่างป้าย", b.wait("document.querySelector('#qrOneDlg').open"))
        b.js("document.querySelector('#q1Close').click()")
        # ป้ายแบบสวน: แสดงตัวอย่างในฟอร์ม + คลิกป้ายในหน้าพิมพ์ แก้กลอน/วงศ์ แล้วบันทึกลงข้อมูลพืช
        b.js("document.querySelector('#list [data-edit]').click()")
        check("ฟอร์มแก้ไขพืช: มีตัวอย่างป้ายแบบสวน", b.wait("(document.querySelector('#pvFrame').srcdoc||'').includes('class=\x22sg')"))
        b.js("document.querySelector('#dlg').close()")
        b.js("{const f=document.createElement('iframe'); f.id='gsT'; f.style.cssText='width:900px;height:700px'; document.body.appendChild(f);"
             " gardenSheet([cache[0]], 1, 1, location.origin, f.contentWindow)}")
        gs = "document.querySelector('#gsT').contentDocument"
        check("ป้ายแบบสวน: หน้าพิมพ์แสดงป้ายพร้อม QR", b.wait(f"{gs}.querySelector('.sg .sq svg')"))
        b.js(f"{gs}.querySelector('.sg').click()")
        b.js(f"{{const e={gs}.querySelector('#ed').elements; e.verse.value=['วรรคหนึ่ง','วรรคสอง','วรรคสาม','วรรคสี่'].join(String.fromCharCode(10)); e.family.value='Testaceae';"
             f" e.verse.dispatchEvent(new Event('input',{{bubbles:true}}))}}")
        check("ป้ายแบบสวน: แก้แล้วป้ายเปลี่ยนทันที", b.wait(f"{gs}.querySelector('.sg .vs').textContent.includes('วรรคสาม') && {gs}.querySelector('.sg .info').textContent.includes('TESTACEAE')"))
        b.js(f"{gs}.querySelector('#ed').requestSubmit()")
        b.wait(f"{gs}.querySelector('#edMsg').textContent.includes('บันทึกแล้ว')")
        gid = b.js("cache[0].id")
        h = next(x for x in call("/api/herbs?", token=login())[1] if x["id"] == gid)
        check("ป้ายแบบสวน: กดบันทึกแล้วข้อมูลพืชเปลี่ยนจริง", "วรรคสาม" in h["verse"] and h["detail"].startswith("วงศ์ Testaceae ·"), str(h)[:200])
        check("แอดมิน: ไม่มี JavaScript error", not js_err(), "; ".join(js_err()))
    finally:
        b.close()


# ---------------------------------------------------------------- run
def main():
    src = os.path.join(ROOT, "server", "herbgarden.db")
    if os.path.exists(src):   # ทดสอบกับสำเนาข้อมูลจริง (ใช้ backup API ให้ได้สำเนาที่สมบูรณ์)
        import sqlite3
        a, b = sqlite3.connect(src), sqlite3.connect(ENV["HERB_DB"])
        a.backup(b); b.close(); a.close()
    print(f"ทดสอบบนสำเนาฐานข้อมูลใน {TMP}")
    server = start_server()
    try:
        test_static_and_security()
        test_public_api()
        tok = login()
        test_crud_trash_restore(tok)
        test_site_and_map(tok)
        test_import(tok)
        test_backup(tok)
        test_contact_and_spam()
        server = test_sessions_survive_restart(server)
        if "--api" not in sys.argv:
            test_browser()
        test_login_lockout()   # ทำท้ายสุด เพราะจะล็อกการเข้าสู่ระบบไว้ 15 นาที
    finally:
        server.terminate(); server.wait()
        time.sleep(0.5)
        shutil.rmtree(TMP, ignore_errors=True)
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{'ผ่านทั้งหมด' if not fails else 'ไม่ผ่าน'}: {len(RESULTS) - len(fails)}/{len(RESULTS)} ข้อ")
    for name, _, info in fails:
        print(f"  ✗ {name}  {info}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
