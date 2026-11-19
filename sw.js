/* ---------------- Service Worker: ให้เว็บใช้ได้แม้สัญญาณเน็ตไม่ดี / ไม่มีเน็ต ----------------
   - หน้าเว็บ, CSS, JS, ข้อมูล (api/public): ดึงจากเน็ตก่อนเสมอ (ได้ข้อมูลล่าสุด)
     ถ้าเน็ตช้าเกิน 4 วินาทีหรือไม่มีเน็ต → ใช้ชุดที่เคยเปิดไว้ในเครื่อง
   - รูปภาพ, ฟอนต์: ใช้ชุดในเครื่องทันที (เร็ว) แล้วอัปเดตเบื้องหลัง
   - ไม่ยุ่งกับหน้าแอดมิน, การส่งฟอร์ม และ API อื่น ๆ (ต้องใช้เน็ตจริงเสมอ)
   แก้ไฟล์นี้แล้ว: เปลี่ยน VERSION เพื่อล้างแคชเก่า */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`, IMAGES = `images-${VERSION}`;
const MAX_IMAGES = 250;           // เก็บรูปในเครื่องไม่เกินจำนวนนี้ (ลบรูปเก่าสุดออก)
const NET_TIMEOUT = 4000;

const PRECACHE = [
  "/", "/css/style.css", "/manifest.webmanifest",
  "/js/data.js", "/js/herb-search.js", "/js/garden-map.js", "/js/activities.js",
  "/js/hero.js", "/js/home.js", "/js/main.js", "/js/api.js",
  "/images/favicon.svg", "/images/icons/icon-192.png", "/api/public",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL)
    .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))   // ไฟล์ไหนโหลดไม่ได้ก็ข้าม ไม่ให้ติดตั้งล้ม
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== IMAGES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("Authorization")) return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    const p = url.pathname;
    if (p === "/admin.html" || p.startsWith("/admin") || p === "/sw.js") return;
    if (p.startsWith("/api/")) {
      if (p === "/api/public") e.respondWith(networkFirst(req, SHELL));
      return;                                            // API อื่นไม่เก็บ
    }
    if (req.mode === "navigate") return e.respondWith(page(req));
    if (req.destination === "image" || p.startsWith("/images/")) return e.respondWith(staleWhileRevalidate(req, IMAGES, true));
    return e.respondWith(networkFirst(req, SHELL));
  }
  // ฟอนต์จาก Google Fonts
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, SHELL));
  }
});

/* หน้าเว็บ: เน็ตก่อน → หน้านี้ที่เคยเปิด → หน้าหลัก (ตัวเปลี่ยนหน้าในเว็บจะแสดงหน้าที่ถูกต้องเอง) */
async function page(req) {
  try {
    return await networkFirst(req, SHELL, true);
  } catch (err) {
    const home = await caches.match("/", { cacheName: SHELL });
    if (home) return home;
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
       <title>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</title>
       <body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#333">
       <div style="font-size:56px">🌿</div><h1 style="color:#6f4c9b">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
       <p>กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
       <button onclick="location.reload()" style="font-size:18px;padding:10px 28px;border:0;border-radius:30px;background:#6f4c9b;color:#fff">ลองใหม่</button>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/* เน็ตก่อน (รอไม่เกิน NET_TIMEOUT) → ถ้าไม่ได้ใช้ของในเครื่อง
   ถ้าหมดเวลาแต่ไม่มีของในเครื่อง → รอเน็ตต่อจนเสร็จ */
async function networkFirst(req, cacheName, throwIfMissing = false) {
  const cache = await caches.open(cacheName);
  const net = fetch(req).then(res => {
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  });
  net.catch(() => {});                                     // กันข้อความ error เมื่อใช้ของในเครื่องไปแล้ว
  let timer;
  const timeout = new Promise(r => { timer = setTimeout(r, NET_TIMEOUT, "timeout"); });
  try {
    const first = await Promise.race([net, timeout]);
    if (first !== "timeout") return first;
    const cached = await cache.match(req);
    return cached || await net;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (throwIfMissing) throw err;
    return Response.error();
  } finally {
    clearTimeout(timer);
  }
}

/* ใช้ของในเครื่องทันที แล้วอัปเดตจากเน็ตเบื้องหลัง */
async function staleWhileRevalidate(req, cacheName, trim = false) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const net = fetch(req).then(async res => {
    if (res.ok || res.type === "opaque") {
      await cache.put(req, res.clone());
      if (trim) trimCache(cache);
    }
    return res;
  }).catch(() => cached || Response.error());
  return cached || net;
}

async function trimCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}
