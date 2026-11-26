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
    /* โหมดอังกฤษ: ใช้ช่อง *_en ถ้าแอดมินใส่ไว้ · ยังไม่มี → ภาษาไทย (thOnly = เนื้อหายังเป็นภาษาไทย ให้แสดงหมายเหตุ) */
    const en = (r, k) => IS_EN && String(r[k + "_en"] || "").trim() ? r[k + "_en"] : r[k];
    const thOnly = (r, k) => IS_EN && !String(r[k + "_en"] || "").trim() && !!String(r[k] || "").trim();
    NEWS.splice(0, NEWS.length, ...d.news.map(n => [en(n, "title"), n.type, en(n, "detail"), n.img, n.id, thOnly(n, "detail")]));
    ARTICLES.splice(0, ARTICLES.length, ...d.articles.map(a => ({id:a.id, date:a.date, title:en(a, "title"), excerpt:en(a, "excerpt"), img:a.img,
      body:en(a, "body"), thOnly:thOnly(a, "body")})));
    WORKSHOPS.splice(0, WORKSHOPS.length, ...d.workshops.map(w => ({name:en(w, "name"), desc:en(w, "detail"), img:w.img})));
    BROCHURES.splice(0, BROCHURES.length, ...d.brochures.map(b => [en(b, "title"), b.type, en(b, "file")]));
    if(d.herbs){
      HERB_DB.splice(0, HERB_DB.length, ...d.herbs.map(h => {
        const groups = h.groups ? h.groups.split(",").map(s => s.trim()).filter(Boolean) : [];
        /* โหมดอังกฤษ: ลักษณะ/สรรพคุณภาษาอังกฤษ (วงศ์ใช้จากข้อมูลภาษาไทย) · ยังไม่มี → ภาษาไทย + หมายเหตุ */
        const fam = (String(h.detail || "").match(/^วงศ์\s+([^·]+?)\s*·\s*/) || [])[1];
        const dEn = IS_EN && String(h.detail_en || "").trim(), uEn = IS_EN && String(h.uses_en || "").trim();
        return {id:h.id, th:h.th, en:h.en, sci:h.sci, desc:dEn ? (fam ? `Family ${fam} · ` : "") + h.detail_en : h.detail,
                use:uEn ? h.uses_en : h.uses, thOnly:IS_EN && ((!dEn && !!String(h.detail || "").trim()) || (!uEn && !!String(h.uses || "").trim())), groups, img:h.img || "", credit:h.img_credit || "", status:h.status || "",
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
      ACTIVITIES.splice(0, ACTIVITIES.length, ...d.activities.map(a => ({id:a.id, type:a.type, date:dmy(a.date), title:en(a, "title"),
        excerpt:en(a, "excerpt"), img:a.img, contain:!!a.contain, body:en(a, "body"), thOnly:thOnly(a, "body")})));
    }
    /* บริการ (หน้าแรก): ขึ้นบรรทัดใหม่ในชื่อ → <br> */
    if(d.services) SERVICES.splice(0, SERVICES.length, ...d.services.map(s => ({title:en(s, "title").replace(/\n/g, "<br>"), img:s.img, link:s.link})));
    /* ปฏิทิน */
    if(d.events) CAL_EVENTS.splice(0, CAL_EVENTS.length, ...d.events.map(e => ({...e, title:en(e, "title"), detail:en(e, "detail")})));
    if(d.settings){
      Object.assign(CAL_SETTINGS, d.settings);
      /* ข้อมูลติดต่อ/โซเชียล (แก้ได้จากหน้าแอดมิน) → ส่วนท้ายเว็บ + หน้าติดต่อเรา */
      Object.keys(SITE).forEach(k => { if(k in d.settings) SITE[k] = d.settings[k]; });
      renderSiteInfo();
    }
    /* แผนผังสวน (แก้ได้จากหน้าแอดมิน) */
    if(d.map_spots) gmSetSpots(d.map_spots.map(s => ({...s, title:en(s, "title"),
      detail:IS_EN && String(s.detail_en || "").trim() ? s.detail_en : s.detail})));
    if(d.settings && d.settings.demo === "0"){ window.DEMO = false; applyDemo(false); }   /* เว็บจริง: ซ่อนแถบทดลอง */

    /* หน้าเนื้อหาที่แก้จากหน้าแอดมิน (ประวัติ, อาคาร, รางวัล, นโยบายคุกกี้) */
    (d.pages || []).forEach(pg => {
      if(!ROUTES[pg.key]) return;
      /* โหมดอังกฤษ: ใช้เนื้อหาภาษาอังกฤษถ้าแอดมินใส่ไว้ · ยังไม่มี → แสดงภาษาไทยพร้อมหมายเหตุ */
      const en = IS_EN && String(pg.body_en || "").trim();
      Object.assign(ROUTES[pg.key], {t:IS_EN && pg.title_en ? pg.title_en : pg.title, img:pg.img,
        body:() => en ? `<div class="prose" lang="en">${richText(pg.body_en)}</div>`
          : `${IS_EN ? `<p class="en-only-th">This page is currently available in Thai only.</p>` : ""}<div class="prose">${richText(pg.body)}</div>`});
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
  }catch(e){ throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่" + (sitePhone() ? " หรือโทร " + sitePhone() : "")); }
  if(!r.ok){ const j = await r.json().catch(()=>({})); throw new Error(j.error || "ส่งข้อความไม่สำเร็จ"); }
}

apiLoadPublic();
