"""ตัวควบคุมเบราว์เซอร์แบบย่อ (Chrome DevTools Protocol ผ่าน websocket) — ใช้ไลบรารีมาตรฐานของ Python เท่านั้น"""
import base64, json, os, socket, struct, subprocess, tempfile, time, urllib.request
from urllib.parse import urlparse


class WS:
    def __init__(self, url):
        u = urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.s.recv(4096)
        hdr, self.buf = resp.split(b"\r\n\r\n", 1)
        if b" 101 " not in hdr.split(b"\r\n")[0]:
            raise RuntimeError(hdr.decode(errors="replace"))

    def send(self, text):
        data = text.encode()
        n, mask = len(data), os.urandom(4)
        hdr = bytearray([0x81])
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.s.sendall(bytes(hdr) + mask + masked)

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise EOFError
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        msg = b""
        while True:
            b1, b2 = self._read(2)
            op, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            if b2 & 0x80:
                self._read(4)
            data = self._read(n)
            if op == 8:
                raise EOFError
            if op in (9, 10):
                continue
            msg += data
            if b1 & 0x80:
                return msg.decode()


class Browser:
    def __init__(self, exe, port=9333, width=1366, height=900):
        self.dir = tempfile.mkdtemp(prefix="cdp-")
        self.proc = subprocess.Popen([exe, "--headless=new", f"--remote-debugging-port={port}", f"--user-data-dir={self.dir}",
                                      "--no-first-run", "--no-default-browser-check", "--disable-extensions",
                                      f"--window-size={width},{height}", "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
                page = next(p for p in pages if p["type"] == "page")
                break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("browser did not start")
        self.ws = WS(page["webSocketDebuggerUrl"])
        self.id, self.events = 0, []
        for m in ("Page.enable", "Runtime.enable", "Log.enable"):
            self.call(m)
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=1, mobile=False)
        # กล่อง confirm/alert: ตอบ "ตกลง" อัตโนมัติ และเก็บข้อความ alert ไว้ตรวจ
        self.call("Page.addScriptToEvaluateOnNewDocument", source=
                  "window.__alerts=[];window.confirm=()=>true;window.alert=m=>window.__alerts.push(String(m));")

    def call(self, method, **params):
        self.id += 1
        mid = self.id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == mid:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})
            self.events.append(m)

    def js(self, expr, gesture=False):
        """gesture=True: ทำเหมือนผู้ใช้กดจริง (เช่น ให้เปิดแท็บใหม่ได้โดยไม่ถูกบล็อกป๊อปอัป)"""
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True, userGesture=gesture)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError((d.get("exception") or {}).get("description") or d.get("text"))
        return r["result"].get("value")

    def wait(self, cond, timeout=8):
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.js(f"!!({cond})"):
                    return True
            except RuntimeError:
                pass
            time.sleep(0.15)
        return False

    def goto(self, url, settle=1.0):
        self.call("Page.navigate", url=url)
        self.wait("document.readyState==='complete'", 15)
        time.sleep(settle)   # รอ fetch ข้อมูลจากเซิร์ฟเวอร์

    def errors(self):
        """ข้อผิดพลาด JavaScript และ console.error ที่เกิดขึ้นตั้งแต่ครั้งก่อน (ไม่นับรูปที่หาไม่เจอ)"""
        self.call("Runtime.evaluate", expression="1")   # ดึง event ที่ค้างอยู่
        out = []
        for m in self.events:
            p = m.get("params", {})
            if m.get("method") == "Runtime.exceptionThrown":
                d = p["exceptionDetails"]
                out.append("EXCEPTION: " + ((d.get("exception") or {}).get("description") or d.get("text", "")).split("\n")[0])
            elif m.get("method") == "Runtime.consoleAPICalled" and p.get("type") == "error":
                out.append("console.error: " + " ".join(str(a.get("value", a.get("description", ""))) for a in p["args"]))
            elif m.get("method") == "Log.entryAdded":
                e = p["entry"]
                if e["level"] == "error" and not (e.get("source") == "network" and "404" in e.get("text", "")):
                    out.append(f"log[{e.get('source')}]: {e.get('text')} {e.get('url', '')}")
        self.events = []
        return out

    def shot(self, path, full=False):
        params = {"format": "png"}
        if full:
            h = self.js("Math.min(document.documentElement.scrollHeight, 4000)")
            params["clip"] = {"x": 0, "y": 0, "width": 1366, "height": h, "scale": 1}
            params["captureBeyondViewport"] = True
        data = self.call("Page.captureScreenshot", **params)["data"]
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))

    def close(self):
        try:
            self.call("Browser.close")
        except Exception:
            pass
        self.proc.wait(timeout=10)
