/* ---------------- เชื่อมต่อ Back End (server/server.py) ----------------
   ถ้ารันผ่านเซิร์ฟเวอร์: ดึงข่าวและบทความล่าสุดจากฐานข้อมูลมาแทนข้อมูลใน js/data.js
   ถ้าเปิดไฟล์ตรง ๆ (file://) หรือเซิร์ฟเวอร์ปิดอยู่: ใช้ข้อมูลเดิมใน js/data.js ต่อไป */
const API_ONLINE = location.protocol.startsWith("http");

async function apiLoadPublic(){
  if(!API_ONLINE) return;
  try{
    const r = await fetch("api/public");
    if(!r.ok){ window.DATA_LOADED = true; go(); return; }
    const d = await r.json();
    /* NEWS / ARTICLES เป็น const ใน data.js จึงแทนที่ข้อมูลข้างในแทน */
    /* id = เลขประจำรายการในฐานข้อมูล ใช้ทำลิงก์ถาวร เช่น /news/3 */
    NEWS.splice(0, NEWS.length, ...d.news.map(n => [n.title, n.type, n.detail, n.img, n.id]));
    ARTICLES.splice(0, ARTICLES.length, ...d.articles.map(a => ({id:a.id, date:a.date, title:a.title, excerpt:a.excerpt, img:a.img, body:a.body})));
    WORKSHOPS.splice(0, WORKSHOPS.length, ...d.workshops.map(w => ({name:w.name, desc:w.detail, img:w.img})));
    BROCHURES.splice(0, BROCHURES.length, ...d.brochures.map(b => [b.title, b.type, b.file]));
    if(d.herbs){
      HERB_DB.splice(0, HERB_DB.length, ...d.herbs.map(h => {
        const groups = h.groups ? h.groups.split(",").map(s => s.trim()).filter(Boolean) : [];
        return {id:h.id, th:h.th, en:h.en, sci:h.sci, desc:h.detail, use:h.uses, groups, img:h.img || "", credit:h.img_credit || "", status:h.status || "",
                /* พันธุ์ไม้มงคลที่เป็นสมุนไพรด้วย (มีกลุ่มสรรพคุณ) → แสดงได้ทั้ง 2 หมวด */
                cats:h.province ? (groups.length ? [PROVINCIAL, HERB_CATEGORIES[0]] : [PROVINCIAL]) : [HERB_CATEGORIES[0]], region:h.region || undefined, province:h.province || undefined};
      }));
      /* กลุ่มสมุนไพร: กลุ่มเดิม + กลุ่มใหม่ที่มีในข้อมูล */
      const all = [...HERB_GROUPS];
      HERB_DB.forEach(h => h.groups.forEach(g => { if(!all.includes(g)) all.push(g); }));
      HERB_GROUPS.splice(0, HERB_GROUPS.length, ...all);
    }
    /* โครงการและกิจกรรม (วันที่ในฐานข้อมูลเป็น YYYY-MM-DD → หน้าเว็บใช้ วว/ดด/ปปปป) */
    if(d.activities){
      const dmy = s => { const [y, m, dd] = String(s).split("-"); return `${dd}/${m}/${y}`; };
      ACTIVITIES.splice(0, ACTIVITIES.length, ...d.activities.map(a => ({id:a.id, type:a.type, date:dmy(a.date), title:a.title,
        excerpt:a.excerpt, img:a.img, contain:!!a.contain, body:a.body})));
    }
    /* บริการ (หน้าแรก): ขึ้นบรรทัดใหม่ในชื่อ → <br> */
    if(d.services) SERVICES.splice(0, SERVICES.length, ...d.services.map(s => ({title:s.title.replace(/\n/g, "<br>"), img:s.img, link:s.link})));
    /* ปฏิทิน */
    if(d.events) CAL_EVENTS.splice(0, CAL_EVENTS.length, ...d.events);
    if(d.settings) Object.assign(CAL_SETTINGS, d.settings);
    if(d.settings && d.settings.demo === "0"){ window.DEMO = false; applyDemo(false); }   /* เว็บจริง: ซ่อนแถบทดลอง */

    /* หน้าเนื้อหาที่แก้จากหน้าแอดมิน (ประวัติ, อาคาร, รางวัล, นโยบายคุกกี้) */
    (d.pages || []).forEach(pg => {
      if(!ROUTES[pg.key]) return;
      Object.assign(ROUTES[pg.key], {t:pg.title, img:pg.img, body:() => `<div class="prose">${richText(pg.body)}</div>`});
    });
    window.DATA_LOADED = true;
    /* วาดหน้าที่เปิดอยู่ใหม่ด้วยข้อมูลล่าสุด (หน้าแรก: ข่าว, บริการ, กิจกรรม, ปฏิทิน, Workshop) */
    const p = curPath();
    if(p === "/") homeRun();
    else if(curPath() !== "/calendar") go();
  }catch(e){   /* เชื่อมต่อไม่ได้: ใช้ข้อมูลสำรองใน data.js */
    window.DATA_LOADED = true;
    if(/^\/herb\/plant\//.test(curPath())) go();
  }
}

async function apiSendContact(form){
  if(!API_ONLINE) throw new Error("ยังไม่ได้รันเซิร์ฟเวอร์ (python server/server.py)");
  const data = Object.fromEntries(new FormData(form));
  data.t = Date.now() - (+form.dataset.start || Date.now());   /* เวลาที่ใช้กรอกฟอร์ม (กันบอต) */
  let r;
  try{
    r = await fetch("api/contact", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)});
  }catch(e){ throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่ หรือโทร 03-867-6168"); }
  if(!r.ok){ const j = await r.json().catch(()=>({})); throw new Error(j.error || "ส่งข้อความไม่สำเร็จ"); }
}

apiLoadPublic();
