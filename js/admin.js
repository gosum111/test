/* ---------------- หน้าแอดมิน: เรียก REST API ของ server/server.py ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* token: ติ๊ก "จดจำฉัน" → localStorage (ปิดเบราว์เซอร์แล้วยังอยู่) · ไม่ติ๊ก → sessionStorage (อยู่จนปิดเบราว์เซอร์) */
const store = {
  get(){ try{ return localStorage.getItem("adminToken") || sessionStorage.getItem("adminToken") || ""; }catch(e){ return ""; } },
  set(t, remember){ try{ this.clear(); (remember ? localStorage : sessionStorage).setItem("adminToken", t); }catch(e){} },
  clear(){ try{ localStorage.removeItem("adminToken"); sessionStorage.removeItem("adminToken"); }catch(e){} }
};
let token = store.get();
let tab = "readiness";
let cache = [];
let editing = null;

/* ฟิลด์ของแต่ละประเภท: [ชื่อฟิลด์, ป้าย, ชนิด, ตัวเลือก] */
const ACT_TYPES = ["Sport Complex","สนามฟุตบอล","ตลาด","งาน อพ.สธ.","อบรม/เวิร์คช็อป"];
const SITE_LINKS = [["#/contact","ติดต่อเรา"],["#/activities","โครงการและกิจกรรม"],["#/herb/search","ค้นหาสมุนไพร"],
  ["#/herb/articles","บทความสมุนไพร"],["#/herb/map","แผนผังสวนสมุนไพร"],["#/news","ข่าวประชาสัมพันธ์"],["#/brochure","โบรชัวร์"],["#/about/history","ประวัติความเป็นมา"]];
const EVENT_KIND = {event:"กิจกรรม", market:"ตลาดนัด", closed:"ปิดทำการ"};

const FORMS = {
  activities: {title:"โครงการและกิจกรรม", fields:[
    ["title","ชื่อกิจกรรม *","text"],
    ["type","ประเภท (4 ประเภทแรกแสดงเป็นแท็บในหน้าแรก — พิมพ์ประเภทใหม่ได้)","datalist",ACT_TYPES],
    ["date","วันที่จัด * (จะแสดงในปฏิทินด้วย)","date"],
    ["excerpt","คำโปรย","textarea",null,2],
    ["img","รูปภาพ","image"],
    ["contain","รูปเป็นโลโก้ (แสดงทั้งภาพบนพื้นขาว ไม่ครอบตัด)","checkbox"],
    ["body","รายละเอียด — พิมพ์ข้อความธรรมดาได้ (เว้นบรรทัด = ย่อหน้าใหม่ · \"## \" = หัวข้อ · \"- \" = รายการ)","textarea",null,10],
    ["title_en","ชื่อกิจกรรม ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["excerpt_en","คำโปรย ภาษาอังกฤษ","textarea",null,2],
    ["body_en","รายละเอียด ภาษาอังกฤษ — รูปแบบเดียวกับภาษาไทย","textarea",null,10]]},
  events: {title:"ปฏิทิน", fields:[
    ["kind","ประเภท","select",Object.entries(EVENT_KIND)],
    ["title","ชื่อ * (เช่น ปิดทำการวันสงกรานต์, งานวันสมุนไพร)","text"],
    ["date","วันเริ่ม *","date"],
    ["end_date","วันสิ้นสุด (ถ้าวันเดียวไม่ต้องใส่)","date"],
    ["detail","รายละเอียดสั้น ๆ","textarea",null,3],
    ["link","ลิงก์เพิ่มเติม (ไม่บังคับ — เลือกหน้าในเว็บหรือวางลิงก์ภายนอก)","datalist",SITE_LINKS],
    ["title_en","ชื่อ ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["detail_en","รายละเอียดสั้น ๆ ภาษาอังกฤษ","textarea",null,3]]},
  services: {title:"บริการ (หน้าแรก)", fields:[
    ["title","ชื่อบริการ * (ขึ้นบรรทัดใหม่ได้)","textarea",null,2],
    ["img","รูปภาพ (แนวตั้ง)","image"],
    ["link","เมื่อกดแล้วไปที่","datalist",SITE_LINKS],
    ["sort","ลำดับการแสดง (เลขน้อยแสดงก่อน)","number"],
    ["title_en","ชื่อบริการ ภาษาอังกฤษ (ขึ้นบรรทัดใหม่ได้ · เว้นว่าง = แสดงภาษาไทย)","textarea",null,2]]},
  pages: {title:"หน้าเนื้อหา", fixed:true, fields:[   /* fixed = แก้ได้อย่างเดียว ไม่มีเพิ่ม/ลบ */
    ["title","ชื่อหน้า *","text"],
    ["img","รูปหัวหน้า (แนวนอน)","image"],
    ["body","เนื้อหา — พิมพ์ข้อความธรรมดาได้เลย: เว้น 1 บรรทัด = ย่อหน้าใหม่ · \"## หัวข้อ\" = หัวข้อ · \"- 2528: ก่อตั้งสวน\" = เส้นเวลา · \"- ข้อความ\" = รายการ","textarea",null,16],
    ["title_en","ชื่อหน้า ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN)","text"],
    ["body_en","เนื้อหา ภาษาอังกฤษ — รูปแบบเดียวกับเนื้อหาภาษาไทย · เว้นว่าง = โหมด EN แสดงเนื้อหาภาษาไทยแทน","textarea",null,16]]},
  herbs: {title:"สมุนไพร", fields:[
    ["th","ชื่อภาษาไทย *","text"],
    ["en","ชื่อภาษาอังกฤษ","text"],
    ["sci","ชื่อวิทยาศาสตร์","text"],
    ["other_names","ชื่ออื่น (แสดงบนป้ายแบบสวน เช่น ปิ้งสมุทร, ส้วนใหญ่)","text"],
    ["detail","ลักษณะทั่วไป","textarea",null,4],
    ["uses","สรรพคุณ","textarea",null,4],
    ["detail_en","ลักษณะทั่วไป ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · ไม่ต้องใส่วงศ์ ระบบใช้วงศ์จากช่องภาษาไทย)","textarea",null,3],
    ["uses_en","สรรพคุณ ภาษาอังกฤษ","textarea",null,3],
    ["groups","กลุ่มสมุนไพร (หลายกลุ่มคั่นด้วย , เช่น กลุ่มยาแก้ไข้, กลุ่มยาขับปัสสาวะ)","text"],
    ["status","สถานะการอนุรักษ์","select",[["","ปกติ"], ...CONSERVATION]],
    ["province","พันธุ์ไม้มงคลประจำจังหวัด","province"],
    ["img","รูปภาพ","image"],
    ["img_credit","เครดิตรูป (ถ้าใช้รูปจากแหล่งอื่น เช่น ชื่อผู้ถ่าย · สัญญาอนุญาต · ลิงก์)","text"],
    ["verse","กลอนบนป้ายแบบสวน (1 บรรทัด = 1 วรรค · 4 บรรทัด = 1 บท แสดงเป็น 2 คอลัมน์แบบป้ายจริง)","textarea",null,4],
    ["verse_src","ที่มาของกลอน (เช่น นิราศเกาะจาน : สุนทรภู่)","text"]]},
  news: {title:"ข่าวสาร", fields:[
    ["title","หัวข้อข่าว *","text"],
    ["type","ประเภท","select",["ข่าวสาร","กิจกรรม","โครงการ"]],
    ["detail","รายละเอียด","textarea"],
    ["img","รูปภาพ","image"],
    ["title_en","หัวข้อข่าว ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["detail_en","รายละเอียด ภาษาอังกฤษ","textarea"]]},
  articles: {title:"บทความสมุนไพร", fields:[
    ["title","ชื่อบทความ *","text"],
    ["date","วันที่ (เช่น 30/01/2026)","text"],
    ["excerpt","คำโปรย (ใส่ <br> เพื่อขึ้นบรรทัดใหม่)","textarea"],
    ["img","รูปภาพ","image"],
    ["body","เนื้อหา (ใส่ HTML ได้ เช่น <p>…</p>)","textarea",null,10],
    ["title_en","ชื่อบทความ ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["excerpt_en","คำโปรย ภาษาอังกฤษ","textarea"],
    ["body_en","เนื้อหา ภาษาอังกฤษ — รูปแบบเดียวกับเนื้อหาภาษาไทย","textarea",null,10]]},
  workshops: {title:"Workshop", fields:[
    ["name","ชื่อผลิตภัณฑ์ *","text"],
    ["detail","คำอธิบาย","textarea"],
    ["img","รูปภาพ","image"],
    ["name_en","ชื่อผลิตภัณฑ์ ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["detail_en","คำอธิบาย ภาษาอังกฤษ","textarea"]]},
  brochures: {title:"โบรชัวร์", fields:[
    ["title","ชื่อโบรชัวร์ *","text"],
    ["type","ประเภท","select",["แนะนำ","แผนที่","สมุนไพร","กิจกรรม"]],
    ["file","ไฟล์ PDF","pdf"],
    ["title_en","ชื่อโบรชัวร์ ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["file_en","ไฟล์ PDF ภาษาอังกฤษ (ถ้ามี · เว้นว่าง = โหมด EN ให้ดาวน์โหลดไฟล์ภาษาไทย)","pdf"]]},
  map_spots: {title:"จุดบนแผนผังสวน", fields:[
    ["kind","ประเภท","select",[["group","กลุ่มสรรพคุณสมุนไพร (หมุดตัวเลข)"],["place","อาคาร/สถานที่ (หมุดไอคอน)"]]],
    ["num","เลขกลุ่ม (กลุ่มสรรพคุณ) หรือ ลำดับการแสดง (อาคาร/สถานที่)","number"],
    ["title","ชื่อ * (เช่น กลุ่มแก้ไข้ ลดความร้อน (Antifever))","text"],
    ["detail","กลุ่มสรรพคุณ: รายชื่อสมุนไพร คั่นด้วย / (ถ้าเว้นว่าง กลุ่มนี้จะยังไม่แสดงบนเว็บ) · อาคาร/สถานที่: คำอธิบายสั้น ๆ","textarea",null,4],
    ["icon","ไอคอน (เฉพาะอาคาร/สถานที่ — เลือกจากรายการ หรือพิมพ์ตัวอักษร 1 ตัว เช่น A)","datalist",
      [["arch","ซุ้มไม้เลื้อย"],["pond","สระน้ำ"],["shop","ร้านค้า"],["museum","พิพิธภัณฑ์/อาคาร"],["zodiac","ลานกลางแจ้ง"],
       ["lotus","สระบัว"],["pavilion","ศาลา"],["toilet","ห้องน้ำ"],["A","ตัวอักษร A"],["B","ตัวอักษร B"],["C","ตัวอักษร C"]]],
    ["x","ตำแหน่งหมุด แนวนอน x (0–100 = % จากซ้ายของภาพแผนผัง · เว้นว่าง = ไม่มีหมุด)","text"],
    ["y","ตำแหน่งหมุด แนวตั้ง y (0–100 = % จากบนของภาพแผนผัง)","text"],
    ["title_en","ชื่อ ภาษาอังกฤษ (แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)","text"],
    ["detail_en","รายชื่อสมุนไพร / คำอธิบาย ภาษาอังกฤษ (กลุ่มสรรพคุณคั่นด้วย / เหมือนภาษาไทย)","textarea",null,4]]}
};

/* อ่านไฟล์เป็น data URL — รูปภาพจะถูกย่อให้ด้านยาวไม่เกิน 1600px และบีบอัดเป็น JPG (ไฟล์เล็กลง โหลดเว็บเร็วขึ้น)
   ถ้าบีบแล้วใหญ่กว่าไฟล์เดิม (เช่น JPG ที่บีบมาดีแล้ว) จะใช้ไฟล์เดิม */
const readDataUrl = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
async function fileToUpload(file, max = 1600){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)){
    if(file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่เกิน 5MB");
    return readDataUrl(file);
  }
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("เปิดรูปไม่ได้")); i.src = URL.createObjectURL(file); });
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if(s === 1 && file.size < 200 * 1024){ URL.revokeObjectURL(img.src); return readDataUrl(file); }   /* เล็กอยู่แล้ว ไม่ต้องบีบ */
  const c = Object.assign(document.createElement("canvas"), {width:Math.round(img.naturalWidth * s), height:Math.round(img.naturalHeight * s)});
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);   /* พื้นหลังโปร่งใสของ PNG → ขาว */
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const jpg = c.toDataURL("image/jpeg", .82);
  if(s === 1 && file.size <= 5 * 1024 * 1024 && jpg.length * .75 >= file.size) return readDataUrl(file);
  return jpg;
}

async function api(path, opts = {}){
  const r = await fetch("api/" + path, {...opts, headers:{"Content-Type":"application/json", "Authorization":"Bearer " + token, ...(opts.headers||{})}});
  const j = await r.json().catch(() => ({}));
  /* token หมดอายุ (เช่น เซิร์ฟเวอร์รีสตาร์ต): กลับไปหน้าล็อกอินเฉย ๆ ไม่ต้องเรียก logout ที่เซิร์ฟเวอร์ (กันวนลูป) */
  if(r.status === 401 && path !== "login" && path !== "logout"){ clearSession(); throw new Error(j.error || "กรุณาเข้าสู่ระบบ"); }
  if(!r.ok) throw new Error(j.error || "เกิดข้อผิดพลาด");
  return j;
}

/* ---------- login ---------- */
function showLogin(){ $("#loginForm").hidden = false; $("#app").hidden = true; $("#logout").hidden = true; $("#pw").focus(); }
function showApp(){ $("#loginForm").hidden = true; $("#app").hidden = false; $("#logout").hidden = false; load(); }
function clearSession(){ token = ""; store.clear(); showLogin(); }
function logout(){
  const old = token;
  clearSession();
  /* แจ้งเซิร์ฟเวอร์ให้ยกเลิก token เดิม — ส่งครั้งเดียว ไม่สนผลลัพธ์ */
  if(old) fetch("api/logout", {method:"POST", headers:{"Authorization":"Bearer " + old}}).catch(() => {});
}

$("#loginForm").onsubmit = async e => {
  e.preventDefault(); $("#loginErr").textContent = ""; $("#loginErr").style.color = "";
  try{
    const remember = $("#remember").checked;
    const j = await api("login", {method:"POST", body:JSON.stringify({password:$("#pw").value, remember})});
    token = j.token; store.set(token, remember); $("#pw").value = ""; showApp();
  }catch(err){ $("#loginErr").textContent = err.message; }
};
$("#logout").onclick = logout;

/* ---------- tabs & list ---------- */
$("#tabs").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  tab = b.dataset.t; load();
};

const TYPE_LABEL = {herbs:"สมุนไพร", news:"ข่าวสาร", articles:"บทความ", workshops:"Workshop", brochures:"โบรชัวร์", messages:"ข้อความติดต่อ"};
const SPECIAL_TITLE = {messages:"ข้อความจากฟอร์มติดต่อ", trash:"ถังขยะ", backups:"สำรองข้อมูล", readiness:"ความพร้อมของเว็บก่อนเปิดใช้จริง",
  notify:"แจ้งเตือนเมื่อมีคนส่งข้อความ", settings:"ตั้งค่าเว็บไซต์", map_spots:"แผนผังสวน"};

async function load(){
  $("#secTitle").textContent = SPECIAL_TITLE[tab] || FORMS[tab].title;
  $("#addBtn").hidden = !FORMS[tab] || FORMS[tab].fixed;
  $("#backupBtn").hidden = tab !== "backups";
  ["#q", "#exportBtn", "#importBtn", "#photoBtn", "#qrBtn"].forEach(s => $(s).hidden = tab !== "herbs");
  $("#q").value = "";
  $("#list").innerHTML = `<p class="empty">กำลังโหลด…</p>`;
  try{
    if(tab === "events") await loadCalSettings();
    cache = await api(tab);
    render();
    if(tab !== "messages") updateUnread(await api("messages"));
    else updateUnread(cache);
  }catch(err){ $("#list").innerHTML = `<p class="empty">${esc(err.message)}</p>`; }
}

function updateUnread(msgs){
  const n = msgs.filter(m => !m.is_read).length;
  $("#unread").hidden = !n; $("#unread").textContent = n;
}

function render(){
  if(tab === "trash") return renderTrash();
  if(tab === "readiness") return renderReadiness();
  if(tab === "notify") return renderNotify();
  if(tab === "settings") return renderSettings();
  if(tab === "pages"){
    $("#list").innerHTML = cache.map(p => `
      <div class="item">
        <div class="th" style="background-image:url('${esc(p.img)}')"></div>
        <div class="tx"><h3>${esc(p.title)} ${p.is_sample ? `<span class="st lv2">ยังเป็นข้อความตัวอย่าง</span>` : ""}</h3>
          <small>${esc(p.key)} · แก้ไขล่าสุด ${esc(p.updated_at)}</small></div>
        <div class="act"><a class="btn ghost sm" href="${esc(p.key)}" target="_blank">ดูหน้า ↗</a><button class="btn sm" data-edit="${p.id}">แก้ไข</button></div>
      </div>`).join("");
    return;
  }
  if(tab === "backups") return renderBackups();
  if(!cache.length){ $("#list").innerHTML = `<p class="empty">ยังไม่มีข้อมูล</p>`; return; }
  if(tab === "messages"){
    $("#list").innerHTML = cache.map(m => `
      <div class="msg ${m.is_read ? "read" : ""}">
        <div class="meta">${esc(m.created_at)} · ${esc(m.topic)}</div>
        <b>${esc(m.name)}</b> · <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>${m.email ? ` · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}
        ${m.detail ? `<p>${esc(m.detail)}</p>` : ""}
        <div class="act" style="display:flex;gap:6px;margin-top:8px">
          <button class="btn ghost sm" data-read="${m.id}" data-v="${m.is_read ? 0 : 1}">${m.is_read ? "ทำเป็นยังไม่อ่าน" : "✓ อ่านแล้ว"}</button>
          <button class="btn red sm" data-del="${m.id}">ลบ</button>
        </div>
      </div>`).join("");
    return;
  }
  if(tab === "herbs"){
    const q = $("#q").value.trim().toLowerCase();
    const list = cache.filter(h => !q || (h.th + " " + h.en + " " + h.sci).toLowerCase().includes(q));
    $("#secTitle").textContent = `สมุนไพร (${cache.length} ชนิด${q ? ` · พบ ${list.length}` : ""})`;
    $("#list").innerHTML = list.map(h => `
      <div class="item">
        <div class="th" style="background-image:url('${esc(h.img)}')">${h.img ? "" : `<span style="display:grid;place-items:center;height:100%;font-size:26px">🌿</span>`}</div>
        <div class="tx"><h3>${esc(h.th)} <small style="font-weight:400"><i>${esc(h.sci)}</i></small>${h.status ? ` <span class="st lv${CONSERVATION.indexOf(h.status) + 1}">${esc(h.status)}</span>` : ""}</h3>
          <small>${h.province ? `พันธุ์ไม้มงคล จ.${esc(h.province)}` : esc(h.groups || "ยังไม่ระบุกลุ่ม")}</small></div>
        <div class="act"><button class="btn ghost sm" data-qr="${h.id}" title="พิมพ์ป้าย QR ของชนิดนี้">🏷 QR</button><button class="btn ghost sm" data-edit="${h.id}">แก้ไข</button><button class="btn red sm" data-del="${h.id}">ลบ</button></div>
      </div>`).join("") || `<p class="empty">ไม่พบสมุนไพรที่ค้นหา</p>`;
    return;
  }
  const SUB = {
    activities: it => `${it.type} · ${thDate(it.date)}`,
    events: it => `${EVENT_KIND[it.kind]} · ${thDate(it.date)}${it.end_date ? ` ถึง ${thDate(it.end_date)}` : ""}`,
    services: it => `ลำดับ ${it.sort} · ไปที่ ${it.link || "-"}`,
    brochures: it => `${it.type} · ${it.file ? "มีไฟล์ PDF" : "ยังไม่มีไฟล์"}`,
    map_spots: it => `${it.kind === "group" ? `กลุ่มที่ ${it.num}` : `สถานที่ · ลำดับ ${it.num}`} · ${it.x !== "" ? `หมุดที่ ${it.x}, ${it.y}` : "ไม่มีหมุดบนภาพ"}`
      + (it.kind === "group" && !it.detail ? " · ⚠ ยังไม่มีรายชื่อสมุนไพร (ยังไม่แสดงบนเว็บ)" : ""),
  };
  const ICON = {brochures:"📄", events:"📅", map_spots:"📍"};
  const note = tab === "events" ? `<div class="note">
      <label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:600"><input type="checkbox" id="marketAuto" style="width:auto;margin:0" ${calSettings.market_auto === "1" ? "checked" : ""}>
        แสดงตลาดนัดอัตโนมัติทุกเสาร์–อาทิตย์สัปดาห์แรกของเดือน</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 0;font-weight:600"><input type="checkbox" id="closedMonday" style="width:auto;margin:0" ${calSettings.closed_monday !== "0" ? "checked" : ""}>
        แสดง "ปิดทำการ" ทุกวันจันทร์</label>
      <span class="hint">กิจกรรมจากแท็บ "โครงการและกิจกรรม" แสดงในปฏิทินตามวันที่จัดอยู่แล้ว · แท็บนี้ใช้เพิ่ม<b>วันปิดทำการ</b>, <b>ตลาดนัดพิเศษ</b> หรือ<b>กิจกรรมหลายวัน</b>ที่ไม่ต้องมีหน้าอ่านรายละเอียด</span></div>`
    : tab === "map_spots" ? `<div class="note">ข้อมูลในหน้า <a href="herb/map" target="_blank">แผนผังสวนสมุนไพร ↗</a> — กลุ่มสรรพคุณที่ยังไม่มีรายชื่อสมุนไพรจะยังไม่แสดงบนเว็บ
      <span class="hint">ภาพแผนผัง: วางไฟล์ไว้ที่ <code>images/map.jpg</code> · ตำแหน่งหมุด x, y เป็น % จากซ้าย/บนของภาพ (เช่น x 50, y 50 = กลางภาพ)</span></div>` : "";
  $("#list").innerHTML = note + cache.map(it => `
    <div class="item">
      <div class="th" style="background-image:url('${esc(it.img || "")}')">${ICON[tab] ? `<span style="display:grid;place-items:center;height:100%;font-size:26px">${ICON[tab]}</span>` : ""}</div>
      <div class="tx"><h3>${esc(it.title || it.name).replace(/\n/g, " ")}</h3><small>${esc(SUB[tab] ? SUB[tab](it) : (it.type || it.date || ""))} · สร้างเมื่อ ${esc(it.created_at)}</small></div>
      <div class="act"><button class="btn ghost sm" data-edit="${it.id}">แก้ไข</button><button class="btn red sm" data-del="${it.id}">ลบ</button></div>
    </div>`).join("");
}

$("#list").onclick = async e => {
  const b = e.target.closest("button"); if(!b) return;
  try{
    if(b.dataset.qr) openQrOne(cache.find(x => x.id == b.dataset.qr), false);
    else if(b.dataset.edit) openForm(cache.find(x => x.id == b.dataset.edit));
    else if(b.dataset.del){
      const it = cache.find(x => x.id == b.dataset.del);
      const name = it ? (it.th || it.title || it.name) : "";
      if(!confirm(`ย้าย "${name}" ไปถังขยะ?\n(กู้คืนได้ภายใน 30 วันที่แท็บถังขยะ)`)) return;
      const j = await api(`${tab}/${b.dataset.del}`, {method:"DELETE"}); load();
      toast(`ย้าย "${name}" ไปถังขยะแล้ว`, "เลิกทำ", async () => {
        await api("trash/restore", {method:"POST", body:JSON.stringify({type:j.type, deleted_at:j.deleted_at})}); load();
      });
    }else if(b.dataset.read){
      await api(`messages/${b.dataset.read}`, {method:"PUT", body:JSON.stringify({is_read:b.dataset.v === "1"})}); load();
    }
  }catch(err){ alert(err.message); }
};

/* ---------- ตัวอย่างบนหน้าเว็บ (ใช้ css/style.css ตัวจริง และ markup เดียวกับหน้าเว็บ) ---------- */
let MAP_IMG_OK = false;
(() => { const i = new Image(); i.onload = () => MAP_IMG_OK = true; i.src = "images/map.jpg"; })();
const PV_LABEL = t => `<p style="font:600 13px 'IBM Plex Sans Thai',sans-serif;letter-spacing:.04em;color:#8a7fa0;margin:0 0 14px">${t}</p>`;
const thDate = s => { if(!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const PREVIEWS = {
  activities: d => `<section style="padding:28px">
      ${PV_LABEL("หน้าโครงการและกิจกรรม / แท็บในหน้าแรก")}
      <div style="max-width:620px"><a class="act-card"><div class="act-img${d.contain ? " contain" : ""}" style="background-image:url('${d.img}')"></div>
        <div class="act-info"><div class="act-meta"><span class="act-tag">${esc(d.type)}</span><span class="act-bar"></span><span class="act-date">${thDate(d.date)}</span></div>
        <h3>${esc(d.title) || "(ยังไม่ได้ใส่ชื่อ)"}</h3>${d.excerpt ? `<p>${esc(d.excerpt)}</p>` : ""}<span class="act-more">อ่านเพิ่มเติม →</span></div></a></div>
    </section>
    <hr style="border:0;border-top:1px dashed #d5cfe0;margin:0 28px">
    <section style="padding:28px">
      ${PV_LABEL("หน้าอ่านรายละเอียด")}
      <h1 style="font-size:32px;line-height:1.3;margin-bottom:14px">${esc(d.title)}</h1>
      <article class="prose" style="padding-bottom:20px">${d.excerpt ? `<p class="art-lead">${esc(d.excerpt)}</p>` : ""}${richText(d.body)}</article>
    </section>`,
  events: d => `<section style="padding:28px;background:#9563a8;min-height:100%">
      <p style="font:600 13px 'IBM Plex Sans Thai',sans-serif;color:#f0e6f7;margin:0 0 14px">ปฏิทินกิจกรรม › เมื่อกดวันที่ ${thDate(d.date)}${d.end_date ? ` ถึง ${thDate(d.end_date)}` : ""}</p>
      <div class="pcal-info" style="margin:0"><b>${thDate(d.date)}${d.end_date ? ` – ${thDate(d.end_date)}` : ""}</b>
        <div class="pi ${d.kind}"><i></i><div><span class="k">${EVENT_KIND[d.kind]}</span> ${esc(d.title) || "(ยังไม่ได้ใส่ชื่อ)"}${d.detail ? `<p>${esc(d.detail)}</p>` : ""}
        ${d.link ? `<a>ดูรายละเอียด →</a>` : ""}</div></div></div>
      <p style="color:#fff;margin-top:16px;font-size:14px">สีของวันในปฏิทิน: <b>${{event:"ส้ม (กิจกรรม)", market:"เขียว (ตลาดนัด)", closed:"เทาเข้ม (ปิดทำการ)"}[d.kind]}</b></p>
    </section>`,
  services: d => `<section style="padding:28px;background:#f4f1ec;min-height:100%">
      ${PV_LABEL("หน้าแรก › บริการ")}
      <a class="svc-card" style="display:flex;width:294px;max-width:100%;background-image:url('${d.img}')"><h3>${esc(d.title).replace(/\n/g, "<br>") || "(ยังไม่ได้ใส่ชื่อ)"}</h3></a>
    </section>`,
  pages: d => `<div style="height:220px;background:${d.img ? `url('${d.img}') center/cover no-repeat,` : ""}linear-gradient(160deg,#6f4c9b,#b8a3d6)"></div>
    <section style="padding:28px 32px">
      <h1 style="font-size:36px;line-height:1.3;margin-bottom:20px">${esc(d.title)}</h1>
      <div class="prose" style="padding-bottom:20px">${richText(d.body)}</div>
    </section>
    <hr style="border:0;border-top:1px dashed #d5cfe0;margin:0 28px">
    <section style="padding:28px 32px" lang="en">
      ${PV_LABEL("เมื่อผู้ชมกดปุ่ม EN (ภาษาอังกฤษ)")}
      ${String(d.body_en || "").trim() ? `<h1 style="font-size:36px;line-height:1.3;margin-bottom:20px">${esc(d.title_en || d.title)}</h1>
      <div class="prose" style="padding-bottom:20px">${richText(d.body_en)}</div>`
      : `<p style="color:#9a5b00">ยังไม่มีเนื้อหาภาษาอังกฤษ — โหมด EN จะแสดงเนื้อหาภาษาไทยด้านบน พร้อมข้อความ "This page is currently available in Thai only."</p>`}
    </section>`,
  /* สมุนไพร: ป้าย QR ที่จะติดต้นไม้ + หน้าของพืชที่ผู้เข้าชมเห็นหลังสแกน */
  herbs: d => {
    const fm = (d.detail || "").match(/^วงศ์\s+([^·]+?)\s*·\s*/), family = fm ? fm[1] : "", desc = fm ? d.detail.slice(fm[0].length) : (d.detail || "");
    const groups = (d.groups || "").split(",").map(s => s.trim()).filter(Boolean);
    const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "";
    const qr = editing ? qrSvg(qrUrl(SITE_URL, editing.id), d.th)
      : `<div style="aspect-ratio:1;display:grid;place-items:center;text-align:center;border:2px dashed #c9c2d6;border-radius:6px;font:12px 'IBM Plex Sans Thai';color:#888;padding:6px">QR สร้างอัตโนมัติ<br>เมื่อกดบันทึก</div>`;
    return `<section style="padding:24px 28px 8px">
      ${PV_LABEL("ป้าย QR ที่จะติดต้นไม้")}
      <div style="display:flex;gap:14px;align-items:center;max-width:430px;border:1.5px dashed #b9b2c6;border-radius:12px;padding:14px;background:#fff;font-family:'IBM Plex Sans Thai',sans-serif">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <b style="font-size:24px;line-height:1.2;color:#1d1a24">${esc(d.th) || "(ชื่อพืช)"}</b>
          ${d.sci ? `<i style="font-size:13px;color:#555">${esc(d.sci)}</i>` : ""}
          ${d.province ? `<small style="font-size:12px;color:#4b7d26;font-weight:600">ไม้มงคลพระราชทานประจำจังหวัด${esc(d.province)}</small>` : ""}
          <small style="font-size:12px;margin-top:6px">📱 สแกนดูรูปและข้อมูล</small>
        </div>
        <div style="width:130px;flex:none">${qr.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>
      </div>
    </section>
    <section style="padding:16px 28px 8px">
      ${PV_LABEL("ป้ายแบบสวน (เปลี่ยนตามที่พิมพ์ในช่อง กลอน / ที่มาของกลอน / ชื่ออื่น)")}
      ${SIGN_FONTS}<style>${SIGN_CSS}</style>
      <div style="zoom:.55">${gardenSignHtml(editing ? {...d, id:editing.id} : d, SITE_URL)}</div>
    </section>
    <hr style="border:0;border-top:1px dashed #d5cfe0;margin:16px 28px 0">
    <section style="padding:24px 28px">
      ${PV_LABEL("หน้าของพืช (ผู้เข้าชมเห็นเมื่อสแกน QR)")}
      <h1 style="font-size:34px;margin-bottom:18px;color:var(--purple,#6f4c9b)">${esc(d.th) || "(ชื่อพืช)"}</h1>
      <article class="plant" style="padding-bottom:10px">
        <div class="plant-top">
          <div class="plant-photo">${d.img ? `<img src="${d.img}" alt="">${creditLine(d.img_credit)}` : `<div class="plant-nophoto">🌿<span>ยังไม่มีรูปภาพ — อัปโหลดได้ที่ช่อง "รูปภาพ"</span></div>`}</div>
          <dl class="plant-facts">
            ${row("ชื่อภาษาไทย", esc(d.th))}${row("ชื่อภาษาอังกฤษ", esc(d.en))}${row("ชื่อวิทยาศาสตร์", d.sci ? `<i>${esc(d.sci)}</i>` : "")}
            ${row("วงศ์", esc(family))}${row("กลุ่มสรรพคุณ", groups.map(esc).join("<br>"))}
            ${row("พันธุ์ไม้มงคล", d.province ? `ประจำจังหวัด${esc(d.province)}` : "")}${row("สถานะการอนุรักษ์", d.status ? statusBadge(d.status) : "")}
          </dl>
        </div>
        <section class="plant-sec"><h2>ลักษณะทั่วไป</h2><p>${esc(desc) || "-"}</p></section>
        <section class="plant-sec"><h2>สรรพคุณและการใช้ประโยชน์</h2><p>${esc(d.uses) || "-"}</p></section>
      </article>
    </section>`;
  },
  news: d => `<section class="news-sec" style="padding:32px 28px 48px">
      ${PV_LABEL("หน้าแรก › ข่าวสารล่าสุด และหน้าข่าวประชาสัมพันธ์")}
      <div class="news-grid" style="grid-template-columns:minmax(0,440px)">
        <a class="news"><div class="news-img" style="background-image:url('${d.img}')"><span class="art-more">อ่านเพิ่มเติม</span></div><h3>${d.title || "(ยังไม่ได้ใส่หัวข้อ)"}</h3>${d.detail ? `<p>${d.detail}</p>` : ""}</a>
      </div></section>`,
  articles: d => `<section style="padding:32px 28px">
      ${PV_LABEL("หน้ารายการบทความ")}
      <div style="max-width:440px"><a class="art"><div class="art-img" style="background-image:url('${d.img}')"><span class="art-more">อ่านเพิ่มเติม</span></div>${d.date ? `<span class="art-date">${d.date}</span>` : ""}<h3>${d.title || "(ยังไม่ได้ใส่ชื่อบทความ)"}</h3>${d.excerpt ? `<p>${d.excerpt}</p>` : ""}</a></div>
    </section>
    <hr style="border:0;border-top:1px dashed #d5cfe0;margin:0 28px">
    <section style="padding:32px 28px">
      ${PV_LABEL("หน้าอ่านบทความ (เมื่อกดเข้าไป)")}
      <div style="aspect-ratio:1440/300;max-height:200px;width:100%;border-radius:16px;margin-bottom:24px;background:${d.img ? `url('${d.img}') center/cover no-repeat,` : ""}linear-gradient(160deg,#2f5a24,#7da95a)"></div>
      <h1 style="font-size:34px;line-height:1.3;margin-bottom:18px">${d.title || ""}</h1>
      <article class="prose" style="padding-bottom:20px">${d.date ? `<p class="art-date">${d.date}</p>` : ""}${d.excerpt ? `<p class="art-lead">${d.excerpt}</p>` : ""}${d.body || ""}</article>
    </section>`,
  workshops: d => `<section style="padding:32px 28px 48px;background:#f9f5f1">
      ${PV_LABEL("หน้าแรก › สาธิตผลิตภัณฑ์จากสมุนไพร (Workshop)")}
      <article class="ws-card" style="max-width:375px"><div class="ws-img" style="background-image:url('${d.img}')"></div><h3>${d.name || "(ยังไม่ได้ใส่ชื่อ)"}</h3>${d.detail ? `<p>${d.detail}</p>` : ""}</article>
    </section>`,
  brochures: d => `<section style="padding:32px 28px 48px">
      ${PV_LABEL("หน้าโบรชัวร์")}
      <div class="cards" style="grid-template-columns:minmax(0,320px)"><article class="card"><div class="img" style="aspect-ratio:3/4">📄</div><div class="body"><span class="meta">${d.type}</span><h3>${d.title || "(ยังไม่ได้ใส่ชื่อ)"}</h3>${d.file ? `<a class="btn btn-g" style="margin-top:10px;align-self:flex-start;padding:8px 22px" href="${d.file}" target="_blank">ดาวน์โหลด PDF</a>` : `<span class="meta" style="margin-top:10px">ยังไม่มีไฟล์ให้ดาวน์โหลด</span>`}</div></article></div>
    </section>`,
  /* ใช้ตัววาดหมุด/การ์ดเดียวกับหน้าเว็บจริง (js/garden-map.js)
     กรอบตัวอย่างไม่รันสคริปต์ → เช็กล่วงหน้าว่ามีภาพแผนผังไหม (MAP_IMG_OK) แทน onerror */
  map_spots: d => {
    gmSetSpots([{id:0, kind:d.kind, num:parseInt(d.num, 10) || 0, icon:d.icon || "", title:d.title || "(ยังไม่ได้ใส่ชื่อ)",
                 detail:d.detail || "", x:(d.x || "").trim(), y:(d.y || "").trim()}]);
    const it = (d.kind === "group" ? GM_GROUPS : GM_PLACES)[0];
    const pinOk = it.x >= 0 && it.x <= 100 && it.y >= 0 && it.y <= 100;
    const text = it.h ?? it.d;
    return `<section style="padding:28px">
      ${PV_LABEL("หน้าแผนผังสวนสมุนไพร")}
      <div class="gm-map${MAP_IMG_OK ? "" : " nomap"}">${MAP_IMG_OK ? `<img src="images/map.jpg" alt="">` : ""}
        ${pinOk ? `<span class="gm-pin" style="left:${it.x}%;top:${it.y}%">${gmBadge(it)}</span>` : ""}</div>
      <p class="hint" style="margin:8px 0 18px;color:#8a7fa0">${pinOk ? "" : "ไม่มีหมุดบนภาพ (ใส่ตำแหน่ง x, y 0–100 เพื่อแสดงหมุด)"}</p>
      <div class="gm-list"><div class="gm-item">${gmBadge(it)}<div><h4>${it.t}</h4>${text ? `<p>${text}</p>` : ""}</div></div></div>
      ${d.kind === "group" && !d.detail ? `<p style="color:#b25b00;margin-top:14px">⚠ ยังไม่มีรายชื่อสมุนไพร — กลุ่มนี้จะยังไม่แสดงบนเว็บ</p>` : ""}
    </section>`;
  }
};

/* แก้ข้อความภาษาไทยแล้ว แต่ช่องภาษาอังกฤษคู่กัน (มีคำแปลอยู่) ไม่ได้แก้ → เตือนว่าโหมด EN ยังแสดงข้อความเก่า */
function enStaleWarn(d){
  let w = $("#enWarn");
  if(!w){ w = Object.assign(document.createElement("p"), {id:"enWarn", className:"hint"}); w.style.color = "#9a5b00"; $("#formErr").before(w); }
  const fields = FORMS[tab].fields, names = new Set(fields.map(([k]) => k));
  const stale = !editing ? [] : fields.filter(([k]) => k !== "file" && names.has(k + "_en")
    && (d[k] ?? "") !== String(editing[k] ?? "")                                     /* ภาษาไทยเปลี่ยน */
    && String(editing[k + "_en"] ?? "").trim()                                       /* มีคำแปลเดิมอยู่ */
    && (d[k + "_en"] ?? "") === String(editing[k + "_en"] ?? ""))                    /* แต่คำแปลไม่ได้แก้ */
    .map(([, label]) => label.replace(/\s*[\(—*].*$/s, "").trim());
  w.textContent = stale.length ? `⚠ แก้ "${stale.join('", "')}" ภาษาไทยแล้ว แต่ยังไม่ได้แก้ช่องภาษาอังกฤษคู่กัน — ผู้ชมที่กด EN จะยังเห็นข้อความเก่า` : "";
}

let pvTimer;
function renderPreview(){
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => {
    const d = Object.fromEntries(new FormData($("#editForm")));
    const base = new URL(".", location.href).href;
    $("#pvFrame").srcdoc = `<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${esc(base)}">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Prompt:wght@500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="css/style.css"><style>body{margin:0;background:#fff}a{pointer-events:none}</style></head>
      <body>${PREVIEWS[tab](d)}</body></html>`;
    const changed = !editing || FORMS[tab].fields.some(([k]) => (d[k] ?? "") !== String(editing[k] ?? ""));
    enStaleWarn(d);
    $("#pvState").textContent = editing ? (changed ? "— มีการแก้ไขที่ยังไม่ได้บันทึก" : "— ตรงกับที่แสดงอยู่ตอนนี้") : "— รายการใหม่ ยังไม่ได้บันทึก";
    $("#pvDot").classList.toggle("saved", !changed);
  }, 150);
}

/* ---------- add / edit form ---------- */
$("#addBtn").onclick = () => openForm(null);
$("#cancel").onclick = () => $("#dlg").close();

/* ที่อยู่เว็บที่ QR จะชี้ไป (ตั้งในหน้าต่าง "พิมพ์ป้าย QR" · เก็บไว้ใน server/notify.json) */
let SITE_URL = location.origin;
async function loadSiteUrl(){
  try{ SITE_URL = ((await api("notify")).site_url || location.origin).replace(/\/+$/, ""); }catch(e){}
}

function openForm(item){
  editing = item;
  const f = FORMS[tab];
  $("#dlgTitle").textContent = (item ? "แก้ไข" : "เพิ่ม") + f.title;
  $("#formErr").textContent = "";
  $("#qrInline").hidden = tab !== "herbs";   /* สมุนไพร: บันทึก + พิมพ์ป้าย QR */
  $("#qrInlineCopies").value = 1;
  if(tab === "herbs") loadSiteUrl().then(() => renderPreview());
  $("#fields").innerHTML = f.fields.map(([k, label, type, opts, rows]) => {
    const v = esc(item ? item[k] : "");
    if(type === "select") return `<label>${label}<select name="${k}">${opts.map(o => {
      const [val, text] = Array.isArray(o) ? o : [o, o];   /* ตัวเลือกแบบ [ค่า, ข้อความ] ได้ */
      return `<option value="${esc(val)}" ${item && item[k] === val ? "selected" : ""}>${esc(text)}</option>`;
    }).join("")}</select></label>`;
    if(type === "date") return `<label>${label}<input type="date" name="${k}" value="${v}"></label>`;
    if(type === "number") return `<label>${label}<input type="number" name="${k}" value="${item ? v : (cache.length + 1)}" style="max-width:140px"></label>`;
    if(type === "checkbox") return `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" name="${k}" value="1" style="width:auto;margin:0" ${item && +item[k] ? "checked" : ""}>${label}</label>`;
    if(type === "datalist") return `<label>${label}<input name="${k}" value="${v}" list="dl-${k}" autocomplete="off"><datalist id="dl-${k}">${
      opts.map(o => { const [val, text] = Array.isArray(o) ? o : [o, ""]; return `<option value="${esc(val)}">${esc(text)}</option>`; }).join("")}</datalist></label>`;
    if(type === "province") return `<label>${label}<select name="${k}"><option value="">— ไม่ใช่ (สมุนไพรตามสรรพคุณ) —</option>${
      Object.entries(PROVINCES).map(([r, ps]) => `<optgroup label="${r}">${ps.map(p => `<option ${item && item[k] === p ? "selected" : ""}>${p}</option>`).join("")}</optgroup>`).join("")}</select></label>`;
    if(type === "textarea") return `<label>${esc(label)}<textarea name="${k}" rows="${rows || 3}">${v}</textarea></label>`;
    if(type === "image" || type === "pdf") return `<div class="imgrow"><label>${label} <span class="hint">พิมพ์ path/ลิงก์เอง หรือกดอัปโหลด (ไม่เกิน 5MB)</span><input name="${k}" value="${v}" placeholder="${type === "pdf" ? "images/uploads/brochure.pdf" : "images/news1.jpg"}"></label>
      <label class="btn ghost" style="flex:none;margin:0;display:inline-block">อัปโหลด<input type="file" accept="${type === "pdf" ? "application/pdf" : "image/*"}" data-up="${k}" hidden></label></div>
      ${type === "pdf" ? `<p class="hint" ${k === "file" ? 'id="pdfLink"' : ""} style="margin:6px 0 12px"></p>` : `<div style="height:12px"></div>`}`;
    return `<label>${label}<input name="${k}" value="${v}"></label>`;
  }).join("");
  const upIn = $('#fields [name="img"], #fields [name="file"]'), pv = $("#preview"), pl = $("#pdfLink");
  const showPv = () => {
    if(pv){ pv.src = upIn.value; pv.style.display = upIn.value ? "block" : "none"; }
    if(pl) pl.innerHTML = upIn.value ? `<a href="${esc(upIn.value)}" target="_blank">เปิดดูไฟล์ ↗</a>` : "";
    renderPreview();
  };
  $("#editForm").oninput = renderPreview;
  if(!upIn){ renderPreview(); $("#dlg").showModal(); return; }   /* สมุนไพร: ไม่มีช่องอัปโหลด */
  if(pv) pv.onerror = () => pv.style.display = "none";
  upIn.oninput = showPv; showPv();
  /* ปุ่มอัปโหลดแต่ละช่อง (เช่น โบรชัวร์: PDF ภาษาไทย + PDF ภาษาอังกฤษ) */
  document.querySelectorAll("#fields input[data-up]").forEach(fi => fi.onchange = async e => {
    const file = e.target.files[0]; if(!file) return;
    const target = $(`#fields [name="${fi.dataset.up}"]`);
    $("#formErr").textContent = "กำลังอัปโหลด…";
    try{
      const data = await fileToUpload(file);
      const j = await api("upload", {method:"POST", body:JSON.stringify({data})});
      target.value = j.path; if(target === upIn) showPv(); else renderPreview(); $("#formErr").textContent = "";
    }catch(err){ $("#formErr").textContent = err.message; }
  });
  $("#dlg").showModal();
}

$("#editForm").onsubmit = async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  $("#saveBtn").disabled = true;
  try{
    await api(editing ? `${tab}/${editing.id}` : tab, {method:editing ? "PUT" : "POST", body:JSON.stringify(data)});
    $("#dlg").close(); load();
  }catch(err){ $("#formErr").textContent = err.message; }
  finally{ $("#saveBtn").disabled = false; }
};

/* สมุนไพร: "บันทึก + พิมพ์ป้าย QR" ในขั้นตอนเดียว
   เปิดแท็บพิมพ์ทันทีตอนกดปุ่ม (กันเบราว์เซอร์บล็อกป๊อปอัป) แล้วค่อยใส่ป้ายหลังบันทึกเสร็จ */
$("#savePrintBtn").onclick = async () => {
  const f = $("#editForm");
  if(!f.reportValidity()) return;
  const w = window.open("", "_blank");
  if(!w){ alert("เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัปสำหรับหน้านี้"); return; }
  w.document.write(`<p style="font-family:sans-serif;padding:20px">กำลังบันทึกและสร้างป้าย QR…</p>`);
  $("#savePrintBtn").disabled = true; $("#formErr").textContent = "";
  try{
    const data = Object.fromEntries(new FormData(f));
    const saved = await api(editing ? `herbs/${editing.id}` : "herbs", {method:editing ? "PUT" : "POST", body:JSON.stringify(data)});
    const copies = Math.min(50, Math.max(1, parseInt($("#qrInlineCopies").value, 10) || 1));
    const size = document.querySelector('input[name="qrInlineSize"]:checked').value;
    w.document.open();
    openLabelSheet([saved], copies, size, SITE_URL, w);
    $("#dlg").close(); load();
    toast(`บันทึก "${saved.th}" แล้ว · เปิดหน้าพิมพ์ป้าย QR ${copies} ป้ายในแท็บใหม่`);
  }catch(err){ w.close(); $("#formErr").textContent = err.message; }
  finally{ $("#savePrintBtn").disabled = false; }
};

/* ---------- สมุนไพร: ค้นหา / ดาวน์โหลด / นำเข้าจากไฟล์ ---------- */
$("#q").oninput = render;

const HERB_COLS = [["th","ชื่อภาษาไทย"],["en","ชื่อภาษาอังกฤษ"],["sci","ชื่อวิทยาศาสตร์"],["detail","ลักษณะทั่วไป"],
                   ["uses","สรรพคุณ"],["groups","กลุ่มสมุนไพร"],["province","จังหวัด (เฉพาะพันธุ์ไม้มงคล)"],["img","รูปภาพ"],
                   ["status","สถานะการอนุรักษ์"],["img_credit","เครดิตรูป"],["other_names","ชื่ออื่น"],["verse","กลอน"],["verse_src","ที่มาของกลอน"],
                   ["detail_en","ลักษณะทั่วไป ภาษาอังกฤษ"],["uses_en","สรรพคุณ ภาษาอังกฤษ"]];

async function downloadHerbsCsv(){
  const herbs = tab === "herbs" && cache.length ? cache : await api("herbs");
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [HERB_COLS.map(c => q(c[1])).join(","), ...herbs.map(h => HERB_COLS.map(c => q(h[c[0]])).join(","))];
  /* ใส่ BOM เพื่อให้ Excel เปิดภาษาไทยได้ถูกต้อง */
  const blob = new Blob(["﻿" + lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
  const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(blob), download:`สมุนไพร-${new Date().toISOString().slice(0,10)}.csv`});
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("#exportBtn").onclick = () => downloadHerbsCsv().catch(err => alert(err.message));
$("#tplBtn").onclick = () => downloadHerbsCsv().catch(err => alert(err.message));

let impData = null;
const impMode = () => document.querySelector('#impDlg input[name="mode"]:checked').value;

$("#importBtn").onclick = () => {
  impData = null; $("#impFile").value = ""; $("#impName").textContent = "";
  $("#impResult").innerHTML = ""; $("#impGo").disabled = true;
  $("#impDlg").showModal();
};
$("#impCancel").onclick = () => $("#impDlg").close();

$("#impFile").onchange = async e => {
  const f = e.target.files[0]; if(!f) return;
  if(f.size > 5 * 1024 * 1024){ $("#impResult").innerHTML = `<p class="err">ไฟล์ต้องไม่เกิน 5MB</p>`; return; }
  $("#impName").textContent = f.name;
  impData = await readDataUrl(f);
  impMap = null; impExtra = false;
  checkImport();
};

/* การจับคู่คอลัมน์: null = ให้ระบบเดา, {field: index} = แอดมินเลือกเอง */
let impMap = null, impExtra = false;
$("#impResult").addEventListener("change", e => {
  if(e.target.matches("select[data-map]")){
    impMap = {};
    document.querySelectorAll("#impResult select[data-map]").forEach(s => { if(s.value !== "") impMap[s.dataset.map] = +s.value; });
    checkImport();
  }else if(e.target.id === "impExtra"){ impExtra = e.target.checked; checkImport(); }
});

function mappingPanel(j){
  const opts = sel => `<option value="">— ไม่ใช้ —</option>` + j.headers.map((h, i) => h ? `<option value="${i}" ${sel === i ? "selected" : ""}>${esc(h)}</option>` : "").join("");
  return `<div class="imp-mode" style="margin-bottom:12px">
    <b>จับคู่คอลัมน์ <span class="hint">(หัวตารางอยู่แถวที่ ${j.header_row} ของไฟล์ · ระบบเดาให้แล้ว เปลี่ยนได้)</span></b>
    <div class="map-grid">${HERB_COLS.map(([k, label]) => `
      <label class="${k === "th" && j.mapping.th === undefined ? "need" : ""}">${label}${k === "th" ? " *" : ""}<select data-map="${k}">${opts(j.mapping[k])}</select></label>`).join("")}
    </div>
    ${j.unknown_columns.length ? `<label style="margin-top:6px"><input type="checkbox" id="impExtra" ${impExtra ? "checked" : ""}> นำคอลัมน์ที่ไม่ได้จับคู่ (${j.unknown_columns.map(esc).join(", ")}) ไปต่อท้าย <b>ลักษณะทั่วไป</b></label>` : ""}
  </div>`;
}
document.querySelectorAll('#impDlg input[name="mode"]').forEach(r => r.onchange = () => impData && checkImport());

/* ขั้นที่ 1: ส่งไฟล์ไปตรวจ (dry run) แล้วแสดงตัวอย่าง — ยังไม่บันทึก */
async function checkImport(){
  $("#impGo").disabled = true;
  $("#impResult").innerHTML = `<p class="hint">กำลังอ่านไฟล์…</p>`;
  try{
    const j = await api("herbs/import", {method:"POST", body:JSON.stringify({data:impData, mode:impMode(), dry_run:true, mapping:impMap, extra:impExtra})});
    const s = j.summary, act = {insert:"เพิ่มใหม่", update:"อัปเดต", skip:"ข้าม"};
    const missing = HERB_COLS.filter(c => !j.columns.includes(c[0])).map(c => c[1]);
    if(j.mapping.th === undefined){
      $("#impResult").innerHTML = mappingPanel(j) + `<p class="err">ระบบหาคอลัมน์ชื่อภาษาไทยไม่เจอ — กรุณาเลือกในช่อง "ชื่อภาษาไทย *" ด้านบน</p>`;
      return;
    }
    $("#impResult").innerHTML = mappingPanel(j) + `
      <div class="sum">
        ${s.insert ? `<span class="ins">+ เพิ่มใหม่ ${s.insert} ชนิด</span>` : ""}
        ${s.update ? `<span class="upd">✎ อัปเดต ${s.update} ชนิด</span>` : ""}
        ${s.delete ? `<span class="del">🗑 ลบของเดิม ${s.delete} ชนิด</span>` : ""}
        ${s.skip ? `<span class="skp">⚠ ข้าม ${s.skip} แถวที่มีปัญหา</span>` : ""}
      </div>
      ${missing.length ? `<p class="hint">ไม่มีคอลัมน์: ${missing.join(", ")}${impMode() === "merge" ? " — ชนิดที่อัปเดตจะคงค่าเดิมของคอลัมน์เหล่านี้ไว้" : ""}</p>` : ""}
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>แถว</th><th>ผล</th><th>ชื่อภาษาไทย</th><th>ชื่อวิทยาศาสตร์</th><th>กลุ่ม / จังหวัด</th><th>สรรพคุณ</th></tr></thead>
        <tbody>${j.items.map(i => `<tr class="${i.errors.length ? "bad" : ""}">
          <td>${i.row}</td><td><span class="tag ${i.action}">${act[i.action]}</span>${i.errors.length ? `<div style="color:var(--red)">${i.errors.map(esc).join("<br>")}</div>` : ""}</td>
          <td>${esc(i.data.th)}</td><td><i>${esc(i.data.sci)}</i></td><td>${esc(i.data.province ? "จ." + i.data.province : i.data.groups)}${i.data.status && CONSERVATION.includes(i.data.status) ? ` <span class="st lv${CONSERVATION.indexOf(i.data.status) + 1}">${esc(i.data.status)}</span>` : ""}</td>
          <td class="clip" title="${esc(i.data.uses)}">${esc(i.data.uses)}</td></tr>`).join("")}</tbody>
      </table></div>`;
    const n = s.insert + s.update;
    $("#impGo").disabled = !n && !s.delete;
    $("#impGo").textContent = s.delete ? `ยืนยัน: ลบของเดิม ${s.delete} และนำเข้า ${n} ชนิด` : `ยืนยันนำเข้า ${n} ชนิด`;
  }catch(err){ $("#impResult").innerHTML = `<p class="err">${esc(err.message)}</p>`; }
}

/* ขั้นที่ 2: ยืนยัน → บันทึกจริง */
$("#impGo").onclick = async () => {
  if(impMode() === "replace" && !confirm("โหมดแทนที่ทั้งหมด: ชนิดที่ไม่อยู่ในไฟล์จะถูกย้ายไปถังขยะ\n(กู้คืนได้ภายใน 30 วัน และระบบจะสำรองข้อมูลไว้ก่อน) ยืนยันหรือไม่?")) return;
  $("#impGo").disabled = true;
  try{
    const j = await api("herbs/import", {method:"POST", body:JSON.stringify({data:impData, mode:impMode(), dry_run:false, mapping:impMap, extra:impExtra})});
    $("#impDlg").close(); load();
    alert(`นำเข้าเรียบร้อย: เพิ่ม ${j.summary.insert} · อัปเดต ${j.summary.update}${j.summary.skip ? ` · ข้าม ${j.summary.skip} แถว` : ""}`);
  }catch(err){ $("#impResult").insertAdjacentHTML("afterbegin", `<p class="err">${esc(err.message)}</p>`); $("#impGo").disabled = false; }
};

/* ---------- สมุนไพร: พิมพ์ป้าย QR ติดต้นไม้ ---------- */
/* QR เป็น SVG — ใส่ name แล้วจะมีกล่องชื่อพืชตรงกลาง QR
   ใช้ระดับแก้ข้อผิดพลาด "H" (กู้ข้อมูลได้ถึง ~30%) จึงยังสแกนได้แม้มีกล่องบังตรงกลาง (บังไม่เกิน ~20% ของพื้นที่)
   ขนาดตัวอักษร: วัดความกว้างจริงของชื่อ แล้วใช้ตัวใหญ่ที่สุดที่ใส่กล่องได้ · ชื่อยาวแบ่ง 2 บรรทัดตรงรอยต่อคำ */
const QR_FONT = "'IBM Plex Sans Thai',Tahoma,'Leelawadee UI',sans-serif";
const qrMeasure = (() => {   /* ความกว้างของข้อความ (หน่วย = เท่าของขนาดตัวอักษร) */
  const c = document.createElement("canvas").getContext("2d");
  return s => { c.font = `700 100px ${QR_FONT}`; return c.measureText(s).width / 100; };
})();
function qrLines(label){
  /* หาจุดแบ่ง 2 บรรทัดที่ทำให้บรรทัดยาวสุดสั้นที่สุด (แบ่งตรงรอยต่อคำภาษาไทยเท่านั้น) */
  if(!window.Intl || !Intl.Segmenter) return [[label], qrMeasure(label)];
  const words = [...new Intl.Segmenter("th", {granularity:"word"}).segment(label)].map(s => s.segment);
  let best = [label], bestW = qrMeasure(label);
  for(let i = 1; i < words.length; i++){
    const a = words.slice(0, i).join("").trim(), b = words.slice(i).join("").trim();
    if(!a || !b) continue;
    const w = Math.max(qrMeasure(a), qrMeasure(b));
    if(w < bestW){ best = [a, b]; bestW = w; }
  }
  return [best, bestW];
}
/* ลิงก์ที่ใส่ใน QR ป้ายต้นไม้: แบบสั้นตัวพิมพ์ใหญ่ "HTTPS://เว็บ/P/514" (เซิร์ฟเวอร์พาไปหน้า /herb/plant/514)
   QR เก็บตัวพิมพ์ใหญ่แบบ "Alphanumeric" ได้กระชับกว่า ~45% → ช่องใหญ่ขึ้น สแกนง่ายขึ้นแม้มีชื่อพืชบังตรงกลาง
   ถ้าที่อยู่เว็บมี path ต่อท้าย (ตัวพิมพ์ใหญ่อาจเปิดไม่ได้) → ใช้ลิงก์เต็มแบบเดิม */
const qrUrl = (site, id) => /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(site) ? `${site}/P/${id}`.toUpperCase() : `${site}/herb/plant/${id}`;
function qrSvg(text, name){
  const q = qrcode(0, name ? "H" : "Q");
  q.addData(text, /^[0-9A-Z $%*+\-./:]+$/.test(text) ? "Alphanumeric" : "Byte"); q.make();
  const n = q.getModuleCount();
  let d = "";
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  let mid = "";
  const label = String(name || "").trim();
  if(label){
    /* ขนาดกล่องสูงสุดทดสอบแล้วว่าสแกนได้ (ใหญ่กว่านี้บางชื่อสแกนไม่ติด) */
    const maxW = n * 0.56 - 1.6, LH = 1.12;              /* ความกว้างข้อความสูงสุด (หน่วย = ช่อง QR) · ระยะบรรทัด */
    const h1 = n * 0.19, h2 = n * 0.235;                  /* ความสูงกล่อง 1 บรรทัด / 2 บรรทัด */
    const w1 = qrMeasure(label), fs1 = Math.min((h1 - 1.2) / LH, maxW / w1);
    const [two, w2] = qrLines(label), fs2 = two.length > 1 ? Math.min((h2 - 1.2) / (2 * LH), maxW / w2) : 0;
    const useTwo = fs2 > fs1 * 1.2;                       /* แบ่ง 2 บรรทัดเมื่อได้ตัวใหญ่ขึ้นชัดเจน */
    const lines = useTwo ? two : [label], fs = useTwo ? fs2 : fs1, tw = useTwo ? w2 : w1;
    const bw = Math.max(n * 0.28, fs * tw + 1.6), bh = lines.length * fs * LH + 1.2;
    const x = (n - bw) / 2, y = (n - bh) / 2;
    mid = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1.2" fill="#fff"/>`
      + lines.map((l, i) => `<text x="${n / 2}" y="${(n / 2 + (i - (lines.length - 1) / 2) * fs * LH).toFixed(2)}" dominant-baseline="central" text-anchor="middle"
          font-family="${QR_FONT}" font-weight="700" font-size="${fs.toFixed(2)}" fill="#000" textLength="${(fs * qrMeasure(l)).toFixed(2)}" lengthAdjust="spacingAndGlyphs">${esc(l)}</text>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"><path d="${d}" fill="#000" shape-rendering="crispEdges"/>${mid}</svg>`;
}
const qrScope = () => document.querySelector('#qrDlg input[name="qrScope"]:checked').value;
function qrList(){
  const q = $("#q").value.trim().toLowerCase();
  return {
    all: cache,
    search: cache.filter(h => !q || (h.th + " " + h.en + " " + h.sci).toLowerCase().includes(q)),
    prov: cache.filter(h => h.province),
  };
}
function qrSiteCheck(){
  const v = $("#qrSite").value.trim();
  $("#qrSiteWarn").textContent = !/^https?:\/\/[^\s/]+/.test(v) ? "กรุณาใส่ที่อยู่เว็บ เช่น https://herbgarden.example.com"
    : /localhost|127\.0\.0\.1/.test(v) ? "⚠ ที่อยู่นี้ใช้ได้เฉพาะเครื่องนี้ มือถือของผู้เข้าชมจะเปิดไม่ได้ — ทดลองพิมพ์ได้ แต่ป้ายจริงควรรอใส่ที่อยู่เว็บจริงหลังนำเว็บขึ้นออนไลน์"
    : /trycloudflare\.com/.test(v) ? "⚠ นี่คือลิงก์ชั่วคราว — เปลี่ยนใหม่ทุกครั้งที่เปิดลิงก์มือถือ ป้ายที่พิมพ์ด้วยลิงก์นี้จะใช้ไม่ได้เมื่อปิดเครื่อง เหมาะสำหรับทดลองสแกนเท่านั้น" : "";
}
const qrCopies = () => Math.min(50, Math.max(1, parseInt($("#qrCopies").value, 10) || 1));
function qrTotal(){
  const n = qrList()[qrScope()].length, c = qrCopies();
  $("#qrTotal").textContent = `รวมทั้งหมด ${n * c} ป้าย (${n} ชนิด × ${c}) · ประมาณ ${Math.ceil(n * c / (document.querySelector('#qrDlg input[name="qrSize"]:checked').value === "s" ? 10 : 2))} แผ่น A4`;
}
document.querySelectorAll('#qrDlg input[name="qrScope"], #qrDlg input[name="qrSize"]').forEach(r => r.addEventListener("change", qrTotal));
$("#qrBtn").onclick = async () => {
  const l = qrList();
  $("#qrCntAll").textContent = `(${l.all.length} ป้าย)`;
  $("#qrCntSearch").textContent = `(${l.search.length} ป้าย${$("#q").value.trim() ? ` · คำค้น "${$("#q").value.trim()}"` : " · ยังไม่ได้พิมพ์คำค้น"})`;
  $("#qrCntProv").textContent = `(${l.prov.length} ป้าย)`;
  try{ $("#qrSite").value = (await api("notify")).site_url || location.origin; }catch(e){ $("#qrSite").value = location.origin; }
  qrSiteCheck();
  qrTotal();
  $("#qrDlg").showModal();
};
$("#qrSite").oninput = qrSiteCheck;
$("#qrCopies").oninput = qrTotal;
$("#qrCancel").onclick = () => $("#qrDlg").close();
$("#qrGo").onclick = async () => {
  const site = $("#qrSite").value.trim().replace(/\/+$/, "");
  if(!/^https?:\/\/[^\s/]+/.test(site)){ qrSiteCheck(); return; }
  const list = qrList()[qrScope()];
  if(!list.length){ alert("ไม่มีพืชที่จะพิมพ์ป้าย"); return; }
  try{ await api("notify", {method:"PUT", body:JSON.stringify({site_url:site})}); SITE_URL = site; }catch(e){}   /* จำที่อยู่เว็บไว้ใช้ครั้งหน้า */
  const size = document.querySelector('#qrDlg input[name="qrSize"]:checked').value;
  if(openLabelSheet(list, qrCopies(), size, site)) $("#qrDlg").close();
};

/* สร้างหน้าพิมพ์ป้าย (ใช้ทั้งหน้าต่าง "พิมพ์ป้าย QR" และปุ่ม 🏷 QR ของแต่ละชนิด)
   size: "s" มาตรฐาน · "l" ใหญ่ · "g" ป้ายแบบสวน (พื้นเขียว เสาลายไทย กลอน รูปพืช) */
function openLabelSheet(list, copies, size, site, win){
  const all = list.flatMap(h => Array(copies).fill(h));   /* ป้ายของชนิดเดียวกันอยู่ติดกัน ตัดแล้วแยกกองง่าย */
  if(size === "g") return gardenSheet(all, list.length, copies, site, win);
  const big = size === "l";
  const labels = all.map(h => `
    <div class="lb">
      <div class="tx">
        <div class="gd">สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ</div>
        <div class="th">${esc(h.th)}</div>
        ${h.sci ? `<div class="sci">${esc(h.sci)}</div>` : ""}
        ${h.province ? `<div class="pv">ไม้มงคลพระราชทานประจำจังหวัด${esc(h.province)}</div>` : ""}
        <div class="sc">📱 สแกนดูรูปและข้อมูล</div>
        <div class="id">#${h.id}</div>
      </div>
      <div class="qr">${qrSvg(qrUrl(site, h.id), h.th)}</div>
    </div>`).join("");
  const w = win || window.open("", "_blank");
  if(!w){ alert("เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัปสำหรับหน้านี้"); return false; }
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ป้าย QR ${all.length} ป้าย</title>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      @page{size:A4;margin:8mm}
      *{box-sizing:border-box;margin:0}
      body{font-family:"IBM Plex Sans Thai",sans-serif;color:#1d1a24}
      .bar{padding:12px 16px;background:#f2edf8;display:flex;gap:12px;align-items:center;font-size:14px}
      .bar button{font:inherit;padding:8px 18px;border:0;border-radius:8px;background:#6f4c9b;color:#fff;cursor:pointer}
      .grid{display:grid;grid-template-columns:repeat(2,${big ? "190mm" : "92mm"});gap:2mm;justify-content:center;padding:4mm 0}
      ${big ? ".grid{grid-template-columns:190mm}" : ""}
      .lb{height:${big ? "130mm" : "52mm"};border:1px dashed #b9b2c6;border-radius:3mm;padding:${big ? "8mm" : "3.5mm"};display:flex;gap:${big ? "8mm" : "3mm"};align-items:center;break-inside:avoid;page-break-inside:avoid}
      .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:${big ? "2.5mm" : "0.8mm"}}
      .gd{font-size:${big ? "13pt" : "7pt"};color:#6f4c9b;font-weight:600}
      .th{font-size:${big ? "40pt" : "17pt"};font-weight:700;line-height:1.15}
      .sci{font-size:${big ? "16pt" : "8pt"};font-style:italic;color:#555}
      .pv{font-size:${big ? "13pt" : "7pt"};color:#4b7d26;font-weight:600}
      .sc{font-size:${big ? "15pt" : "7.5pt"};margin-top:${big ? "4mm" : "1mm"}}
      .id{font-size:${big ? "10pt" : "6pt"};color:#999}
      .qr{width:${big ? "85mm" : "38mm"};flex:none}
      .qr svg{width:100%;height:auto;display:block}
      @media print{.bar{display:none}.lb{border-color:#ccc}}
    </style></head><body>
    <div class="bar"><b>${all.length} ป้าย</b>${copies > 1 ? ` (${list.length} ชนิด × ${copies})` : ""} · QR ชี้ไปที่ ${esc(site)}/herb/plant/… · ตัดตามเส้นประ
      <button onclick="print()">🖨 พิมพ์</button></div>
    <div class="grid">${labels}</div></body></html>`);
  w.document.close();
  return true;
}

/* ---------- ป้ายแบบสวน: เลียนแบบป้ายจริงในสวน (19 × 13 ซม. · 2 ป้าย/A4) ----------
   พื้นฟ้า-สนาม · เสาลายไทยสีแดงเลือดหมูสองข้าง · แผ่นป้ายสีเขียวขอบทอง หัวโค้ง
   ชื่อพืชสีทอง · กลอน 2 คอลัมน์ + ที่มา · แถวล่าง: QR, รูปพืช, ชื่ออื่น / ชื่อวิทยาศาสตร์ / ชื่อวงศ์
   ใช้ที่เดียวกันทั้ง: หน้าพิมพ์ (คลิกป้ายเพื่อแก้แล้วบันทึกได้ทันที) และตัวอย่างในฟอร์มแก้ไขพืช */
const SIGN_POLE = `<svg viewBox="0 0 40 300" preserveAspectRatio="none"><defs><linearGradient id="pg" x1="0" x2="1">
  <stop offset="0" stop-color="#5a1a1f"/><stop offset=".45" stop-color="#8e3a3f"/><stop offset="1" stop-color="#5a1a1f"/></linearGradient></defs>
  <g fill="url(#pg)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round">
    <path d="M20 2 C23 10 27 14 27 20 L13 20 C13 14 17 10 20 2Z"/>
    <path d="M11 20 H29 C33 24 34 30 30 34 H10 C6 30 7 24 11 20Z"/>
    <path d="M9 34 H31 C36 40 36 48 31 52 H9 C4 48 4 40 9 34Z"/>
    <rect x="12" y="52" width="16" height="196"/>
    <path d="M9 248 H31 C36 252 36 260 31 266 H9 C4 260 4 252 9 248Z"/>
    <path d="M10 266 H30 C34 270 33 276 29 280 H11 C7 276 6 270 10 266Z"/>
    <path d="M13 280 H27 C27 286 23 290 20 298 C17 290 13 286 13 280Z"/>
  </g></svg>`;
const SIGN_PANEL = `<svg viewBox="0 0 142 108" preserveAspectRatio="none"><defs>
  <radialGradient id="gp" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#2f5d40"/><stop offset="1" stop-color="#1b3d2a"/></radialGradient></defs>
  <path d="M0 16 H10 C10 8 30 3.5 71 3 C112 3.5 132 8 132 16 H142 V100 C136 100 134 104 134 108 H8 C8 104 6 100 0 100Z" fill="url(#gp)" stroke="#e9e2c9" stroke-width=".8"/>
  <g fill="none" stroke="#9fc1a6" stroke-width=".7" opacity=".28">
    <path d="M96 92 C100 70 118 58 132 40 M110 66 C118 62 126 64 130 70 C122 72 114 72 110 66Z M104 78 C96 72 90 64 92 56 C100 60 104 68 104 78Z M120 50 C124 42 130 38 136 38 C134 46 128 50 120 50Z"/>
    <path d="M10 70 C20 62 34 60 44 66 M24 63 C26 56 32 52 38 52 C36 58 30 62 24 63Z"/>
  </g>
  <path d="M2.5 18.5 H12.4 C12.8 11 32 6.5 71 6 C110 6.5 129.2 11 129.6 18.5 H139.5 V97.8 C134.6 98.2 132 101.6 131.8 105.5 H10.2 C10 101.6 7.4 98.2 2.5 97.8Z" fill="none" stroke="#d8b24c" stroke-width=".45"/></svg>`;
const SIGN_FLOURISH = `<svg viewBox="0 0 120 12"><g fill="none" stroke="#d8b24c" stroke-width="1.1" stroke-linecap="round">
  <path d="M6 6 C20 6 30 1 40 4 C46 6 44 10 40 9 M114 6 C100 6 90 1 80 4 C74 6 76 10 80 9"/>
  <path d="M46 6 H74"/><path d="M60 2 L64 6 L60 10 L56 6Z" fill="#d8b24c"/></g></svg>`;
const SIGN_RULE = `<svg viewBox="0 0 100 8" preserveAspectRatio="none"><path d="M2 4 H92 M92 4 C96 1 99 2 98 4 C97 6 94 6 92 4" fill="none" stroke="#d8b24c" stroke-width="1.1"/></svg>`;
const SIGN_FONTS = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Pridi:wght@500;600&display=swap" rel="stylesheet">`;
const SIGN_CSS = `
  .sg{position:relative;width:190mm;height:130mm;border-radius:2mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;font-family:"IBM Plex Sans Thai",sans-serif;
    background:linear-gradient(180deg,#bcd6e6 0%,#dde9ee 30%,#e8efe6 55%,#a7c48f 80%,#7fa36a 100%);border:.3mm solid #c9c9c9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sg *{box-sizing:border-box;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sg:before{content:"";position:absolute;left:0;right:0;bottom:0;height:22mm;
    background:radial-gradient(ellipse 18mm 5mm at 25% 60%,#6f9a54 60%,transparent 62%),radial-gradient(ellipse 18mm 5mm at 50% 70%,#7aa65e 60%,transparent 62%),radial-gradient(ellipse 18mm 5mm at 75% 60%,#6f9a54 60%,transparent 62%);opacity:.7}
  .sg .pole{position:absolute;top:4mm;width:15mm;height:122mm;z-index:2}
  .sg .pole.l{left:6mm}.sg .pole.r{right:6mm}
  .sg .pole svg,.sg .pn>svg{width:100%;height:100%;display:block}
  .sg .pn{position:absolute;left:19mm;right:19mm;top:9mm;bottom:12mm}
  .sg .pn>svg{position:absolute;inset:0}
  .sg .in{position:absolute;inset:4mm 9mm 3.5mm;display:flex;flex-direction:column;align-items:center;color:#f2e9cc}
  .sg .orn{color:#e6c3e8;font-size:9pt;line-height:1;margin-top:.5mm}
  .sg .ti{font-family:"Pridi",serif;font-weight:500;color:#e8c55e;line-height:1.25;text-align:center;letter-spacing:.3pt;margin-top:1mm}
  .sg .fl{width:30mm;height:3mm;margin:.5mm 0 2.5mm}.sg .fl svg{width:100%;height:100%;display:block}
  .sg .vs{display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:1.5mm 5mm;font-size:11pt;line-height:1.45;width:100%;padding:0 2mm;margin-top:auto;white-space:nowrap}
  .sg .vs.one{grid-template-columns:1fr;text-align:center;white-space:normal}
  .sg .vs.long{white-space:normal;font-size:10pt}
  .sg .vs.none{flex:1}
  .sg .src{display:flex;align-items:center;gap:3mm;width:100%;font-size:7.5pt;color:#e9e2c9;margin-top:2.5mm}
  .sg .src i{flex:1;height:2.4mm}.sg .src i svg{width:100%;height:100%;display:block}.sg .src i.flip{transform:scaleX(-1)}
  .sg .bt{margin-top:auto;display:flex;gap:3mm;align-items:center;width:100%;padding:0 2mm}
  .sg .sq{width:29mm;flex:none;background:#fff;padding:1.2mm;border:.3mm solid #ddd}
  .sg .sq svg{width:100%;height:auto;display:block}
  .sg .sq .wait{aspect-ratio:1;display:grid;place-items:center;text-align:center;font-size:8pt;color:#888}
  .sg .ph{width:29mm;height:29mm;flex:none;border:.5mm solid #e9e2c9;overflow:hidden;background:#244a33}
  .sg .ph img{width:100%;height:100%;object-fit:cover;display:block}
  .sg .info{flex:1;min-width:0;display:grid;grid-template-columns:auto auto 1fr;gap:1mm 2.5mm;font-size:10pt;padding-left:2mm}
  .sg .info .v{overflow-wrap:anywhere}`;

/* ชื่อวงศ์เก็บอยู่ต้นช่อง "ลักษณะทั่วไป" แบบ "วงศ์ XXX · …" (หน้าพืชบนเว็บอ่านจากตรงนี้ด้วย) */
const FAMILY_RE = /^วงศ์\s+([^·]+?)\s*·\s*/;
const FAMILY_LOOSE_RE = /^วงศ์\s+(\S+)\s*/;   /* "วงศ์ FABACEAE ไม้ยืนต้น…" (ไม่มี ·) → ถือว่าคำแรกคือวงศ์ กันวงศ์ซ้อน 2 ชั้น */
function signFamily(detail){ const s = String(detail || ""), m = s.match(FAMILY_RE) || s.match(FAMILY_LOOSE_RE); return m ? m[1].trim() : ""; }
function setFamily(detail, fam){
  const s = String(detail || ""), rest = FAMILY_RE.test(s) ? s.replace(FAMILY_RE, "") : s.replace(FAMILY_LOOSE_RE, "");
  fam = fam.trim(); return fam ? `วงศ์ ${fam} · ${rest}` : rest;
}

/* id ของ gradient ใน SVG ต้องไม่ซ้ำกันทั้งหน้า (หลายป้าย/แก้แล้ววาดใหม่) — บางเบราว์เซอร์พิมพ์สีหายถ้า id ซ้ำ */
let SIGN_UID = 0;
function signSvg(svg, id){ const u = `${id}${++SIGN_UID}`; return svg.split(`id="${id}"`).join(`id="${u}"`).split(`url(#${id})`).join(`url(#${u})`); }

function gardenSignHtml(h, site){
  const abs = u => { try{ return new URL(u, location.href).href; }catch(e){ return ""; } };   /* หน้าพิมพ์เป็น about:blank → ต้องใช้ลิงก์เต็ม */
  const family = signFamily(h.detail);
  const lines = String(h.verse || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const verse = lines.map((l, i) => `<span>${i === 0 ? "“" : ""}${esc(l)}${i === lines.length - 1 ? "”" : ""}</span>`).join("");
  const th = h.th || "(ชื่อพืช)", n = [...th].length, fs = n <= 10 ? 34 : n <= 16 ? 28 : n <= 24 ? 22 : 17;
  const rows = [["ชื่ออื่น", esc(h.other_names || h.en || "")], ["ชื่อวิทยาศาสตร์", h.sci ? `<i>${esc(h.sci)}</i>` : ""], ["ชื่อวงศ์", esc(family.toUpperCase())]]
    .filter(r => r[1]).map(([k, v]) => `<div class="k">${k}</div><div>:</div><div class="v">${v}</div>`).join("");
  return `<div class="sg" data-id="${h.id || ""}">
    <div class="pole l">${signSvg(SIGN_POLE, "pg")}</div><div class="pole r">${signSvg(SIGN_POLE, "pg")}</div>
    <div class="pn">${signSvg(SIGN_PANEL, "gp")}
      <div class="in">
        <div class="orn">❀</div>
        <div class="ti" style="font-size:${fs}pt">${esc(th)}</div>
        <div class="fl">${SIGN_FLOURISH}</div>
        ${lines.length ? `<div class="vs ${lines.length === 1 ? "one" : lines.some(l => [...l].length > 34) ? "long" : ""}">${verse}</div>` : `<div class="vs none"></div>`}
        ${h.verse_src ? `<div class="src"><i>${SIGN_RULE}</i><span>${esc(h.verse_src)}</span><i class="flip">${SIGN_RULE}</i></div>` : ""}
        <div class="bt">
          <div class="sq">${h.id ? qrSvg(qrUrl(site, h.id), th) : `<div class="wait">QR สร้างอัตโนมัติ<br>เมื่อกดบันทึก</div>`}</div>
          ${h.img ? `<div class="ph"><img src="${esc(abs(h.img))}" alt=""></div>` : ""}
          <div class="info">${rows}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* บันทึกที่แก้จากหน้าพิมพ์ป้าย (เรียกจากแท็บหน้าพิมพ์)
   orig = ค่าตอนเปิดหน้าพิมพ์ · ดึงข้อมูลล่าสุดของพืชจากเซิร์ฟเวอร์ก่อน แล้วเปลี่ยนเฉพาะช่องที่แก้บนป้าย
   → ถ้าระหว่างนั้นมีคนแก้ช่องอื่นในฟอร์มหลังบ้าน (รูป สรรพคุณ ฯลฯ) จะไม่ถูกเขียนทับ */
async function saveSignEdit(orig, changes){
  const latest = (await api("herbs")).find(x => x.id === orig.id);
  if(!latest) throw new Error("ไม่พบพืชนี้แล้ว (อาจถูกลบไปถังขยะ)");
  const body = Object.fromEntries(FORMS.herbs.fields.map(([k]) => [k, latest[k] ?? ""]));
  ["th", "verse", "verse_src", "other_names", "sci"].forEach(k => {
    if(k in changes && String(changes[k] ?? "") !== String(orig[k] ?? "")) body[k] = changes[k];
  });
  const fam = signFamily(changes.detail);   /* ชื่อวงศ์อยู่ต้น "ลักษณะทั่วไป" → แก้เฉพาะส่วนวงศ์ของข้อความล่าสุด */
  if("detail" in changes && fam !== signFamily(orig.detail)) body.detail = setFamily(latest.detail, fam);
  const saved = await api(`herbs/${orig.id}`, {method:"PUT", body:JSON.stringify(body)});
  const i = cache.findIndex(x => x.id === saved.id);
  if(i >= 0 && tab === "herbs"){ cache[i] = saved; render(); }
  return saved;
}

function gardenSheet(all, kinds, copies, site, win){
  const w = win || window.open("", "_blank");
  if(!w){ alert("เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัปสำหรับหน้านี้"); return false; }
  const noVerse = new Set(all.filter(h => !String(h.verse || "").trim()).map(h => h.id)).size;
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ป้ายแบบสวน ${all.length} ป้าย</title>
    ${SIGN_FONTS}
    <style>
      @page{size:A4;margin:8mm}
      *{box-sizing:border-box}
      body{margin:0;font-family:"IBM Plex Sans Thai",sans-serif;color:#1d1a24;background:#eee}
      .bar{position:sticky;top:0;z-index:5;padding:10px 16px;background:#f2edf8;display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap;font-size:14px;box-shadow:0 1px 4px #0002}
      .bar button,.ed button{font:inherit;padding:8px 18px;border:0;border-radius:8px;background:#6f4c9b;color:#fff;cursor:pointer}
      .bar .tip{background:#fff3c4;padding:3px 10px;border-radius:6px}
      .bar .warn{color:#9a5b00}
      .grid{display:grid;grid-template-columns:190mm;gap:4mm;justify-content:center;padding:4mm 0}
      .grid .sg{cursor:pointer;transition:box-shadow .15s}
      .grid .sg:hover{box-shadow:0 0 0 1.2mm #6f4c9b88}
      .grid .sg.on{box-shadow:0 0 0 1.2mm #6f4c9b}
      ${SIGN_CSS}
      .ed{position:fixed;top:0;right:0;bottom:0;width:min(360px,100%);background:#fff;box-shadow:-4px 0 16px #0003;z-index:9;padding:16px 18px;overflow:auto;display:none;font-size:14px}
      .ed.open{display:block}
      @media (min-width:1100px){body.editing .grid{padding-right:370px}}
      .ed h3{margin:0 0 4px;font-size:18px;color:#6f4c9b}
      .ed label{display:block;margin:10px 0 0;font-weight:600}
      .ed .h{font-weight:400;color:#777;font-size:12px}
      .ed input,.ed textarea{display:block;width:100%;margin-top:4px;font:inherit;padding:7px 9px;border:1px solid #cfc8db;border-radius:8px}
      .ed textarea{min-height:120px;line-height:1.6}
      .ed .row{display:flex;gap:8px;margin-top:16px;align-items:center;flex-wrap:wrap}
      .ed .ghost{background:#eee;color:#333}
      .ed .msg{font-size:13px;margin-top:8px}
      .ed .msg.ok{color:#2d7a2d}.ed .msg.err{color:#b3261e}
      @media print{body{background:#fff}.bar,.ed{display:none!important}.grid .sg{box-shadow:none!important}}
    </style></head><body>
    <div class="bar"><b>${all.length} ป้ายแบบสวน</b>${copies > 1 ? ` (${kinds} ชนิด × ${copies})` : ""} · 19 × 13 ซม. · 2 ป้าย/A4
      <span class="tip">✏️ คลิกที่ป้ายเพื่อแก้ข้อความ</span>
      <span class="warn" id="nv">${noVerse ? `· ${noVerse} ชนิดยังไม่มีกลอน` : ""}</span>
      · ตั้งค่าพิมพ์ให้ติ๊ก "กราฟิกพื้นหลัง" <button onclick="print()">🖨 พิมพ์</button></div>
    <div class="grid" id="grid"></div>
    <form class="ed" id="ed" autocomplete="off">
      <h3>แก้ข้อความบนป้าย</h3>
      <div class="h">พิมพ์แล้วป้ายเปลี่ยนตามทันที · กด "บันทึก" เพื่อเก็บลงข้อมูลพืช (หน้าเว็บของพืชเปลี่ยนตามด้วย)</div>
      <label>ชื่อพืช<input name="th" required></label>
      <label>กลอน <span class="h">1 บรรทัด = 1 วรรค · 4 บรรทัด = 1 บท</span><textarea name="verse" placeholder="วรรคที่ 1&#10;วรรคที่ 2&#10;วรรคที่ 3&#10;วรรคที่ 4"></textarea></label>
      <label>ที่มาของกลอน <span class="h">เช่น นิราศเกาะจาน : สุนทรภู่</span><input name="verse_src"></label>
      <label>ชื่ออื่น <span class="h">ว่างไว้ = ใช้ชื่อภาษาอังกฤษ</span><input name="other_names"></label>
      <label>ชื่อวิทยาศาสตร์<input name="sci"></label>
      <label>ชื่อวงศ์ <span class="h">เช่น Magnoliaceae</span><input name="family"></label>
      <div class="row"><button type="submit">💾 บันทึก</button><button type="button" class="ghost" id="edClose">ปิด</button></div>
      <div class="msg" id="edMsg"></div>
    </form>
    <script>
      const A = window.opener || (parent !== window ? parent : null), site = ${JSON.stringify(site).split("<").join("\\" + "u003c")};
      const data = ${JSON.stringify(Object.fromEntries(all.map(h => [h.id, h]))).split("<").join("\\" + "u003c")}, order = ${JSON.stringify(all.map(h => h.id))};
      const orig = JSON.parse(JSON.stringify(data));   /* ค่าตอนเปิด/บันทึกล่าสุด → ส่งเฉพาะช่องที่แก้ ไม่ทับงานที่แก้จากที่อื่น */
      const ed = document.getElementById("ed"), grid = document.getElementById("grid"), msg = document.getElementById("edMsg");
      let cur = null, dirty = new Set();
      const draw = () => { grid.innerHTML = order.map(id => A.gardenSignHtml(data[id], site)).join(""); mark(); };
      const mark = () => grid.querySelectorAll(".sg").forEach(s => s.classList.toggle("on", cur != null && s.dataset.id == cur));
      const redraw = id => { grid.querySelectorAll('.sg[data-id="' + id + '"]').forEach(s => { s.outerHTML = A.gardenSignHtml(data[id], site); }); mark(); };
      const fill = h => { ["th","verse","verse_src","other_names","sci"].forEach(k => ed.elements[k].value = h[k] || ""); ed.elements.family.value = A.signFamily(h.detail); };
      const changes = () => { const e = ed.elements; return {th:e.th.value.trim(), verse:e.verse.value, verse_src:e.verse_src.value.trim(),
        other_names:e.other_names.value.trim(), sci:e.sci.value.trim(), detail:A.setFamily(data[cur].detail, e.family.value)}; };
      grid.onclick = ev => { const s = ev.target.closest(".sg"); if(!s) return;
        if(!A || A.closed){ alert("ปิดหน้าแอดมินไปแล้ว — เปิดหน้าพิมพ์ป้ายใหม่จากหน้าแอดมินเพื่อแก้ไข"); return; }
        cur = s.dataset.id; fill(data[cur]); msg.textContent = dirty.has(cur) ? "ยังไม่ได้บันทึก" : ""; msg.className = "msg"; ed.classList.add("open"); document.body.classList.add("editing"); mark(); ed.elements.verse.focus(); };
      ed.oninput = () => { Object.assign(data[cur], changes()); dirty.add(cur); msg.textContent = "ยังไม่ได้บันทึก"; msg.className = "msg"; redraw(cur); mark(); };
      ed.onsubmit = async ev => { ev.preventDefault(); if(!ed.reportValidity()) return;
        const id = cur; msg.textContent = "กำลังบันทึก…"; msg.className = "msg";
        try{ data[id] = await A.saveSignEdit(orig[id], changes()); orig[id] = JSON.parse(JSON.stringify(data[id])); dirty.delete(id); redraw(id); mark();
          const nv = new Set(order.filter(i => !String(data[i].verse || "").trim())).size;
          document.getElementById("nv").textContent = nv ? "· " + nv + " ชนิดยังไม่มีกลอน" : "";
          msg.textContent = "✓ บันทึกแล้ว"; msg.className = "msg ok"; }
        catch(e){ msg.textContent = "บันทึกไม่ได้: " + (e.message || e); msg.className = "msg err"; } };
      document.getElementById("edClose").onclick = () => { ed.classList.remove("open"); document.body.classList.remove("editing"); cur = null; mark(); };
      addEventListener("beforeunload", e => { if(dirty.size){ e.preventDefault(); e.returnValue = ""; } });
      draw();
    <\/script></body></html>`);
  w.document.close();
  return true;
}

/* ---------- QR ของพืชชนิดเดียว: หลังเพิ่มพืชใหม่ (เปิดให้อัตโนมัติ) และปุ่ม 🏷 QR ในรายการ ---------- */
let qrOneHerb = null;
async function openQrOne(h, isNew){
  qrOneHerb = h;
  let site = location.origin;
  try{ site = (await api("notify")).site_url || site; }catch(e){}
  site = site.replace(/\/+$/, "");
  const url = `${site}/herb/plant/${h.id}`;
  $("#q1Title").textContent = isNew ? `✓ เพิ่ม "${h.th}" แล้ว — พิมพ์ป้าย QR ได้เลย` : `ป้าย QR: ${h.th}`;
  $("#q1Qr").innerHTML = qrSvg(qrUrl(site, h.id), h.th);
  $("#q1Name").textContent = h.th;
  $("#q1Sci").textContent = h.sci || "";
  $("#q1Url").textContent = url;
  $("#q1Warn").textContent = /localhost|127\.0\.0\.1/.test(site) ? "⚠ QR ชี้ไป localhost — มือถือผู้เข้าชมจะเปิดไม่ได้ (ทดลองได้) · เปลี่ยนที่อยู่เว็บได้ในหน้าต่าง \"พิมพ์ป้าย QR\""
    : /trycloudflare\.com/.test(site) ? "⚠ ลิงก์ชั่วคราว — ป้ายจะใช้ไม่ได้เมื่อปิดลิงก์มือถือ" : "";
  $("#q1Copies").value = 1;
  $("#qrOneDlg").dataset.site = site;
  $("#qrOneDlg").showModal();
}
$("#q1Close").onclick = () => $("#qrOneDlg").close();
$("#q1Print").onclick = () => {
  const d = $("#qrOneDlg"), copies = Math.min(50, Math.max(1, parseInt($("#q1Copies").value, 10) || 1));
  const size = d.querySelector('input[name="q1Size"]:checked').value;
  if(openLabelSheet([qrOneHerb], copies, size, d.dataset.site)) d.close();
};
/* ดาวน์โหลดรูป QR (PNG) พร้อมชื่อพืชใต้ QR — ใช้ส่งร้านทำป้ายแบบอื่น เช่น อะคริลิก/สติกเกอร์ใหญ่ */
$("#q1Png").onclick = async () => {
  const svg = $("#q1Qr svg"), W = 1000, P = 70;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await img.decode();
  const c = Object.assign(document.createElement("canvas"), {width:W, height:W + 190});
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = false;
  x.drawImage(img, P, P, W - 2 * P, W - 2 * P);
  x.fillStyle = "#1d1a24"; x.textAlign = "center";
  x.font = "700 64px 'IBM Plex Sans Thai', sans-serif"; x.fillText(qrOneHerb.th, W / 2, W + 40);
  if(qrOneHerb.sci){ x.fillStyle = "#555"; x.font = "italic 36px 'IBM Plex Sans Thai', sans-serif"; x.fillText(qrOneHerb.sci, W / 2, W + 110); }
  const a = Object.assign(document.createElement("a"), {href:c.toDataURL("image/png"), download:`QR-${qrOneHerb.th}-${qrOneHerb.id}.png`});
  document.body.appendChild(a); a.click(); a.remove();
};

/* ---------- สมุนไพร: อัปโหลดรูปหลายรูป (จับคู่จากชื่อไฟล์) ---------- */
let phItems = [];
const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

function herbIndex(){
  const idx = new Map();
  const add = (k, id) => { k = normName(k); if(k && !idx.has(k)) idx.set(k, id); };
  cache.forEach(h => add(h.th, h.id));                                        /* ชื่อไทยตรงตัว */
  cache.forEach(h => add(h.th.replace(/\s*\(.*?\)\s*/g, ""), h.id));          /* ไม่มีวงเล็บ: ราชพฤกษ์ */
  cache.forEach(h => (h.th.match(/\((.*?)\)/g) || []).forEach(m => add(m.slice(1, -1), h.id)));  /* ในวงเล็บ: คูน */
  cache.forEach(h => add(h.sci, h.id));                                       /* ชื่อวิทยาศาสตร์เต็ม */
  cache.forEach(h => add(h.sci.split(" ").slice(0, 2).join(" "), h.id));     /* สกุล + ชนิด */
  return idx;
}

function phRender(){
  const over = $("#phOverwrite").checked, byId = new Map(cache.map(h => [h.id, h]));
  const used = new Map();   /* สมุนไพรเดียวกันหลายรูป → ใช้รูปสุดท้าย */
  phItems.forEach((p, i) => { if(p.herbId) used.set(p.herbId, i); });
  let n = 0;
  phItems.forEach((p, i) => {
    const h = byId.get(p.herbId);
    p.skip = !h ? "ไม่พบสมุนไพรชื่อนี้ — เลือกเองด้านล่าง"
           : used.get(p.herbId) !== i ? "ซ้ำกับรูปอื่นของชนิดเดียวกัน — ข้าม"
           : h.img && !over ? "มีรูปอยู่แล้ว — ข้าม (ติ๊กแทนที่ได้)" : "";
    if(!p.skip && !p.status) n++;
  });
  const opts = sel => `<option value="">— เลือกสมุนไพร —</option>` + cache.map(h => `<option value="${h.id}" ${h.id === sel ? "selected" : ""}>${esc(h.th)}</option>`).join("");
  const matched = phItems.filter(p => p.herbId).length;
  $("#phResult").innerHTML = `
    <div class="sum"><span class="ins">จับคู่ได้ ${matched} รูป</span>${phItems.length - matched ? `<span class="skp">ไม่พบชื่อ ${phItems.length - matched} รูป</span>` : ""}<span class="upd">จะอัปโหลด ${n} รูป</span></div>
    <div class="ph-grid">${phItems.map((p, i) => `
      <div class="ph ${p.status || (!p.herbId ? "no" : p.skip ? "keep" : "")}">
        <img src="${p.url}" alt="">
        <div><div class="fn">${esc(p.file.name)}</div>
          <select data-i="${i}">${opts(p.herbId)}</select>
          <div style="color:${p.status === "fail" ? "var(--red)" : p.status === "done" ? "var(--g)" : "var(--mut)"}">${p.status === "done" ? "✓ อัปโหลดแล้ว" : p.status === "fail" ? "✗ " + esc(p.err) : p.status === "busy" ? "กำลังอัปโหลด…" : esc(p.skip)}</div>
        </div>
      </div>`).join("")}</div>`;
  $("#phGo").disabled = !n;
  $("#phGo").textContent = `ยืนยันอัปโหลด ${n} รูป`;
}

$("#photoBtn").onclick = () => {
  phItems.forEach(p => URL.revokeObjectURL(p.url)); phItems = [];
  $("#phFiles").value = ""; $("#phResult").innerHTML = ""; $("#phGo").disabled = true; $("#phGo").textContent = "ยืนยันอัปโหลด";
  $("#phDlg").showModal();
};
$("#phCancel").onclick = () => $("#phDlg").close();
$("#phOverwrite").onchange = () => phItems.length && phRender();
$("#phFiles").onchange = e => {
  const idx = herbIndex();
  phItems.forEach(p => URL.revokeObjectURL(p.url));
  phItems = [...e.target.files].map(file => {
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[\s_-]*\(?\d+\)?$/, "");
    return {file, url:URL.createObjectURL(file), herbId:idx.get(normName(base)) || null};
  });
  phRender();
};
$("#phResult").onchange = e => {
  const s = e.target.closest("select[data-i]"); if(!s) return;
  phItems[s.dataset.i].herbId = +s.value || null; phRender();
};

$("#phGo").onclick = async () => {
  $("#phGo").disabled = true;
  const byId = new Map(cache.map(h => [h.id, h]));
  const todo = phItems.filter(p => !p.skip && !p.status);
  for(const p of todo){
    p.status = "busy"; phRender();
    try{
      const {path} = await api("upload", {method:"POST", body:JSON.stringify({data:await fileToUpload(p.file)})});
      const h = byId.get(p.herbId);
      const body = Object.fromEntries(FORMS.herbs.fields.map(([k]) => [k, h[k] ?? ""]));
      const saved = await api(`herbs/${h.id}`, {method:"PUT", body:JSON.stringify({...body, img:path})});
      Object.assign(h, saved); p.status = "done";
    }catch(err){ p.status = "fail"; p.err = err.message; }
  }
  phRender();
  const ok = todo.filter(p => p.status === "done").length, bad = todo.length - ok;
  $("#phResult").insertAdjacentHTML("afterbegin", `<p style="margin-bottom:10px;font-weight:600;color:${bad ? "var(--red)" : "var(--g)"}">อัปโหลดสำเร็จ ${ok} รูป${bad ? ` · ไม่สำเร็จ ${bad} รูป (ดูรายละเอียดที่การ์ดสีแดง)` : ""}</p>`);
  render();
};

/* ---------- แจ้งเตือนมุมล่าง (มีปุ่ม "เลิกทำ") ---------- */
let toastTimer;
function toast(msg, actionText, action){
  document.querySelector(".toast")?.remove(); clearTimeout(toastTimer);
  const el = document.createElement("div"); el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>${actionText ? `<button>${esc(actionText)}</button>` : ""}`;
  if(actionText) el.querySelector("button").onclick = async () => {
    el.remove();
    try{ await action(); toast("กู้คืนแล้ว"); }catch(err){ alert(err.message); }
  };
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 8000);
}

/* ---------- ปฏิทิน: ตั้งค่าตลาดนัดอัตโนมัติ ---------- */
let calSettings = {market_auto:"1", closed_monday:"1"};
async function loadCalSettings(){ try{ calSettings = (await (await fetch("api/public")).json()).settings || calSettings; }catch(e){} }
$("#list").addEventListener("change", async e => {
  const key = {marketAuto:"market_auto", closedMonday:"closed_monday"}[e.target.id];
  if(!key) return;
  const label = {market_auto:"ตลาดนัดอัตโนมัติ", closed_monday:"ปิดทำการทุกวันจันทร์"}[key];
  try{
    calSettings = await api("settings", {method:"PUT", body:JSON.stringify({[key]:e.target.checked ? "1" : "0"})});
    toast((e.target.checked ? "เปิดแสดง" : "ปิดแสดง") + label + "แล้ว");
  }catch(err){ alert(err.message); e.target.checked = !e.target.checked; }
});

/* ---------- แจ้งเตือน (อีเมล / LINE) ---------- */
function renderNotify(){
  const c = cache;   /* GET /api/notify คืนเป็น object (ไม่มีรหัสผ่าน/โทเคน) */
  const secret = (k, label, ph) => `<label>${label}
      <input type="password" name="${k}" autocomplete="new-password" placeholder="${c["has_" + k] ? "•••••••• (ตั้งไว้แล้ว — เว้นว่างเพื่อใช้ค่าเดิม)" : ph}"></label>`;
  $("#list").innerHTML = `
  <form id="notifyForm">
    <div class="note">เมื่อมีคนส่งข้อความจากหน้า "ติดต่อเรา" ระบบจะส่งแจ้งเตือนไปยังช่องทางที่เปิดไว้ · ถ้าส่งไม่สำเร็จ ข้อความยังอยู่ในแท็บ "ข้อความติดต่อ" เสมอ
      <label style="margin:8px 0 0">ที่อยู่เว็บ (ใช้ทำลิงก์ไปหน้าแอดมินในข้อความแจ้งเตือน)<input name="site_url" value="${esc(c.site_url)}" placeholder="https://www.example.com"></label></div>

    <div class="nf">
      <h3>✉️ อีเมล <label><input type="checkbox" name="email_on" ${c.email_on ? "checked" : ""}> เปิดใช้</label></h3>
      <details><summary>วิธีตั้งค่าด้วย Gmail (ประมาณ 5 นาที)</summary><ol>
        <li>เปิด <b>myaccount.google.com</b> → ความปลอดภัย → เปิด <b>การยืนยันแบบ 2 ขั้นตอน</b> (ถ้ายังไม่เปิด)</li>
        <li>ค้นหา <b>"รหัสผ่านสำหรับแอป" (App passwords)</b> → ตั้งชื่อ เช่น "เว็บสวนสมุนไพร" → กดสร้าง</li>
        <li>คัดลอกรหัส 16 ตัวที่ได้ มาใส่ช่อง "รหัสผ่านแอป" ด้านล่าง (<b>ไม่ใช่</b>รหัส Gmail ปกติ)</li>
        <li>แนะนำให้สร้างบัญชี Gmail แยกสำหรับส่งแจ้งเตือนโดยเฉพาะ</li></ol></details>
      <div class="two">
        <label>เซิร์ฟเวอร์ส่งอีเมล (SMTP)<input name="smtp_host" value="${esc(c.smtp_host)}"></label>
        <label>พอร์ต<input name="smtp_port" type="number" value="${esc(c.smtp_port)}"></label>
        <label>บัญชีอีเมลที่ใช้ส่ง<input name="smtp_user" value="${esc(c.smtp_user)}" placeholder="yourname@gmail.com" autocomplete="off"></label>
        ${secret("smtp_pass", "รหัสผ่านแอป", "รหัส 16 ตัวจาก Google")}
      </div>
      <label>ส่งถึง (หลายอีเมลคั่นด้วย ,)<input name="email_to" value="${esc(c.email_to)}" placeholder="staff1@example.com, staff2@example.com"></label>
      <div class="row"><button type="button" class="btn ghost sm" data-test="email">ทดสอบส่งอีเมล</button><span class="res" id="res-email"></span></div>
    </div>

    <div class="nf">
      <h3>💬 LINE <label><input type="checkbox" name="line_on" ${c.line_on ? "checked" : ""}> เปิดใช้</label></h3>
      <details><summary>วิธีตั้งค่า LINE (LINE Messaging API)</summary><ol>
        <li>สร้าง <b>LINE Official Account</b> (ฟรี) ที่ <b>manager.line.biz</b> แล้วเปิดใช้ <b>Messaging API</b> ในหน้าตั้งค่า</li>
        <li>เข้า <b>developers.line.biz</b> → เลือก Channel ของบัญชีนั้น → แท็บ <b>Messaging API</b> → กด <b>Issue</b> ที่ "Channel access token" แล้วคัดลอกมาใส่ด้านล่าง</li>
        <li>แท็บ <b>Basic settings</b> → คัดลอก <b>Your user ID</b> (ขึ้นต้นด้วย U) มาใส่ช่องผู้รับ</li>
        <li>ใช้ LINE ในมือถือ <b>เพิ่มเพื่อน</b>บัญชี Official Account นั้นก่อน ไม่งั้นจะไม่ได้รับข้อความ</li>
        <li>หมายเหตุ: บัญชีฟรีมีโควตาข้อความต่อเดือนจำกัด (ดูได้ใน LINE Official Account Manager) · LINE Notify แบบเดิมปิดบริการแล้ว</li></ol></details>
      ${secret("line_token", "Channel access token", "โทเคนยาว ๆ จาก LINE Developers")}
      <label>ส่งถึง (User ID หรือ Group ID)<input name="line_to" value="${esc(c.line_to)}" placeholder="U1234abcd..."></label>
      <div class="row"><button type="button" class="btn ghost sm" data-test="line">ทดสอบส่ง LINE</button><span class="res" id="res-line"></span></div>
    </div>
    <button class="btn">บันทึกการตั้งค่า</button>
  </form>`;
}
async function saveNotify(){
  const f = $("#notifyForm"), d = Object.fromEntries(new FormData(f));
  d.email_on = f.email_on.checked; d.line_on = f.line_on.checked;
  cache = await api("notify", {method:"PUT", body:JSON.stringify(d)});
}
$("#list").addEventListener("submit", async e => {
  if(e.target.id !== "notifyForm") return;
  e.preventDefault();
  try{ await saveNotify(); render(); toast("บันทึกการตั้งค่าแจ้งเตือนแล้ว"); }catch(err){ alert(err.message); }
});
$("#list").addEventListener("click", async e => {
  const b = e.target.closest("[data-test]"); if(!b) return;
  const res = $("#res-" + b.dataset.test);
  res.style.color = "var(--mut)"; res.textContent = "กำลังบันทึกและส่งทดสอบ…"; b.disabled = true;
  try{
    await saveNotify();   /* บันทึกค่าที่กรอกก่อน แล้วค่อยทดสอบ */
    const r = await api("notify/test", {method:"POST", body:JSON.stringify({channel:b.dataset.test})});
    const res2 = $("#res-" + b.dataset.test);
    res2.style.color = r.ok ? "var(--g)" : "var(--red)";
    res2.textContent = r.ok ? "✓ ส่งสำเร็จ — ลองเช็กกล่องข้อความ" : "✗ " + r.error;
  }catch(err){ res.style.color = "var(--red)"; res.textContent = "✗ " + err.message; }
  finally{ b.disabled = false; }
});

/* ---------- ตั้งค่าเว็บไซต์: ข้อมูลติดต่อ/โซเชียล + เปลี่ยนรหัสแอดมิน ---------- */
function renderSettings(){
  const c = cache;   /* GET /api/settings */
  const inp = (k, label, ph = "", type = "text") => `<label>${label}<input name="${k}" type="${type}" value="${esc(c[k])}" placeholder="${esc(ph)}"></label>`;
  const chk = (k, label) => `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:6px 0"><input type="checkbox" name="${k}" style="width:auto;margin:0" ${c[k] === "1" ? "checked" : ""}>${label}</label>`;
  const envPw = c.password_source === "env";
  $("#list").innerHTML = `
  <form id="siteForm">
    <div class="note">ข้อมูลนี้แสดงที่<b>ส่วนท้ายของทุกหน้า</b> และหน้า <a href="contact" target="_blank">ติดต่อเรา ↗</a> · บันทึกแล้วเห็นผลทันที</div>
    <div class="nf">
      <h3>📍 ข้อมูลติดต่อ</h3>
      <label>ที่อยู่<textarea name="site_address" rows="2">${esc(c.site_address)}</textarea></label>
      <div class="two">
        ${inp("site_phones", "เบอร์โทร (หลายเบอร์คั่นด้วย ,)", "03-867-6168, 084-930-6060")}
        ${inp("site_email", "อีเมล", "info@example.com", "email")}
      </div>
      <label>เวลาทำการ (ขึ้นบรรทัดใหม่ได้)<textarea name="site_hours" rows="3">${esc(c.site_hours)}</textarea></label>
      <label>ที่อยู่ ภาษาอังกฤษ <span class="hint">(แสดงเมื่อผู้ชมกดปุ่ม EN · เว้นว่าง = แสดงภาษาไทย)</span><textarea name="site_address_en" rows="2" placeholder="เช่น 39 Rayong Highway 3191, Nikhom Phatthana District, Rayong 21180, Thailand">${esc(c.site_address_en)}</textarea></label>
      <label>เวลาทำการ ภาษาอังกฤษ <span class="hint">(ถ้าใส่ไว้ แก้เวลาทำการภาษาไทยเมื่อไรอย่าลืมแก้ช่องนี้ด้วย)</span><textarea name="site_hours_en" rows="3" placeholder="เช่น Herb Garden: Tuesday–Sunday 09:00–16:30 (closed Mondays)">${esc(c.site_hours_en)}</textarea></label>
    </div>
    <div class="nf">
      <h3>🌐 โซเชียลมีเดีย <span class="hint" style="font-weight:400">(เว้นว่าง = ไม่แสดงปุ่ม · ต้องขึ้นต้นด้วย https://)</span></h3>
      ${inp("site_facebook", "Facebook", "https://www.facebook.com/...")}
      ${inp("site_youtube", "YouTube", "https://www.youtube.com/@...")}
      ${inp("site_line", "LINE Official Account", "https://lin.ee/...")}
    </div>
    <div class="nf">
      <h3>📄 หน้าติดต่อเรา</h3>
      ${chk("site_show_info", "แสดงที่อยู่ เบอร์โทร อีเมล และเวลาทำการ ข้างฟอร์มส่งข้อความ")}
      ${chk("site_show_map", "แสดงแผนที่ Google Maps")}
      ${inp("site_map_query", "คำค้นหาตำแหน่งบนแผนที่ (ชื่อสถานที่ หรือพิกัด เช่น 12.7, 101.2)", "PTT Herb Garden Rayong")}
    </div>
    <button class="btn">บันทึกข้อมูลเว็บไซต์</button>
  </form>

  <form id="pwForm" style="margin-top:28px">
    <div class="nf">
      <h3>🔑 เปลี่ยนรหัสแอดมิน</h3>
      ${envPw ? `<p class="hint">รหัสถูกตั้งไว้ด้วยค่า <code>ADMIN_PASSWORD</code> ของเซิร์ฟเวอร์ — เปลี่ยนจากหน้านี้ไม่ได้</p>` : `
      <p class="hint">เปลี่ยนแล้ว<b>ทุกคนจะถูกออกจากระบบ</b> (รวมถึงเครื่องนี้) ต้องเข้าสู่ระบบใหม่ด้วยรหัสใหม่</p>
      <label>รหัสปัจจุบัน<input type="password" name="current" required autocomplete="current-password"></label>
      <div class="two">
        <label>รหัสใหม่ (อย่างน้อย 8 ตัวอักษร)<input type="password" name="new" required minlength="8" autocomplete="new-password"></label>
        <label>พิมพ์รหัสใหม่อีกครั้ง<input type="password" name="new2" required minlength="8" autocomplete="new-password"></label>
      </div>
      <p class="err" id="pwErr" style="color:var(--red)"></p>
      <button class="btn">เปลี่ยนรหัส</button>`}
    </div>
  </form>`;
}
$("#list").addEventListener("submit", async e => {
  if(e.target.id === "siteForm"){
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f));
    d.site_show_info = f.site_show_info.checked ? "1" : "0";
    d.site_show_map = f.site_show_map.checked ? "1" : "0";
    try{ cache = {...cache, ...await api("settings", {method:"PUT", body:JSON.stringify(d)})}; render(); toast("บันทึกข้อมูลเว็บไซต์แล้ว"); }
    catch(err){ alert(err.message); }
  }else if(e.target.id === "pwForm"){
    e.preventDefault();
    const f = e.target, err = $("#pwErr");
    err.textContent = "";
    if(f.new.value !== f.new2.value){ err.textContent = "รหัสใหม่ทั้งสองช่องไม่ตรงกัน"; return; }
    try{
      await api("password", {method:"POST", body:JSON.stringify({current:f.current.value, new:f.new.value})});
      clearSession();
      $("#loginErr").style.color = "var(--g)";
      $("#loginErr").textContent = "เปลี่ยนรหัสแล้ว — กรุณาเข้าสู่ระบบด้วยรหัสใหม่";
    }catch(ex){ err.textContent = ex.message; }
  }
});

/* ---------- ความพร้อมของเว็บ ---------- */
function renderReadiness(){
  const total = cache.reduce((n, s) => n + s.items.length, 0);
  $("#list").innerHTML = `<div class="note">${total ? `ยังมี <b>${total}</b> เรื่องที่ควรจัดการก่อนเปิดเว็บให้คนทั่วไปใช้ · กดหัวข้อเพื่อดูรายละเอียด · กด "ไปแก้ไข" เพื่อไปยังแท็บที่เกี่ยวข้อง` : "✓ ไม่พบปัญหา เว็บพร้อมใช้งานจริง"}</div>` +
    cache.map(s => `
      <details class="rd ${s.items.length ? s.level : "ok"}" ${s.items.length && s.level === "red" ? "open" : ""}>
        <summary><span class="cnt">${s.items.length || "✓"}</span>${esc(s.title)}</summary>
        ${s.hint && s.items.length ? `<span class="hint">${esc(s.hint)}</span>` : ""}
        <ul>${s.items.map(i => `<li><span>${i.file ? esc(i.text).replace(esc(i.file), `<code>${esc(i.file)}</code>`) : esc(i.text)}</span>
          ${i.tab ? `<button class="btn ghost sm" data-goto="${i.tab}">ไปแก้ไข →</button>` : ""}</li>`).join("") || `<li>เรียบร้อย</li>`}</ul>
      </details>`).join("");
}
$("#list").addEventListener("click", e => {
  const b = e.target.closest("[data-goto]"); if(!b) return;
  document.querySelector(`#tabs button[data-t="${b.dataset.goto}"]`).click();
});

/* ---------- ถังขยะ ---------- */
function renderTrash(){
  const note = `<div class="note">รายการที่ลบจะอยู่ในถังขยะ <b>30 วัน</b> แล้วจึงถูกลบถาวรอัตโนมัติ · รายการที่ลบพร้อมกัน (เช่น นำเข้าแบบแทนที่ทั้งหมด) จะรวมเป็นกลุ่มเดียว กู้คืนได้ในครั้งเดียว</div>`;
  if(!cache.length){ $("#list").innerHTML = note + `<p class="empty">ถังขยะว่าง</p>`; return; }
  $("#list").innerHTML = note + cache.map((g, i) => `
    <div class="grp">
      <span class="badge">${TYPE_LABEL[g.type]}</span>
      <div class="tx">
        <b>${g.count > 1 ? `${g.count} รายการ` : esc(g.names[0])}</b>
        <small class="${g.days_left <= 3 ? "warn" : ""}" style="color:var(--mut)"> · ลบเมื่อ ${esc(g.deleted_at.slice(0, 16))} · ลบถาวรใน ${g.days_left} วัน</small>
        ${g.count > 1 ? `<div class="names">${g.names.map(esc).join(", ")}${g.count > g.names.length ? ` และอีก ${g.count - g.names.length} รายการ` : ""}</div>` : ""}
      </div>
      <div class="act"><button class="btn ghost sm" data-restore="${i}">↩ กู้คืน${g.count > 1 ? "ทั้งหมด" : ""}</button><button class="btn red sm" data-purge="${i}">ลบถาวร</button></div>
    </div>`).join("");
}

/* ---------- สำรองข้อมูล ---------- */
const REASON_LABEL = {auto:"อัตโนมัติ (รายวัน)", manual:"กดสำรองเอง", "before-import":"ก่อนนำเข้าไฟล์", "before-restore":"ก่อนกู้คืน"};
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " KB";
function renderBackups(){
  const note = `<div class="note">ระบบสำรองข้อมูล<b>อัตโนมัติวันละครั้ง</b> และ<b>ทุกครั้งก่อนนำเข้าไฟล์/ก่อนกู้คืน</b> (เก็บประเภทละ 30 ชุดล่าสุด) · ควรกด "ดาวน์โหลด" เก็บไว้นอกเครื่องนี้เป็นระยะ เช่น ใน Google Drive หรือแฟลชไดรฟ์ เผื่อเครื่องเสีย<br>
    <span class="hint">ไฟล์สำรองเก็บเฉพาะข้อมูล (ข้อความ/รายการ) — รูปและ PDF ที่อัปโหลดอยู่ในโฟลเดอร์ images/uploads ควรสำรองแยก</span></div>`;
  if(!cache.length){ $("#list").innerHTML = note + `<p class="empty">ยังไม่มีไฟล์สำรอง</p>`; return; }
  $("#list").innerHTML = note + cache.map((b, i) => `
    <div class="grp">
      <span class="badge">${REASON_LABEL[b.reason] || b.reason}</span>
      <div class="tx"><b>${esc(b.created)}</b> <small style="color:var(--mut)">· ${fmtSize(b.size)}</small>
        <div class="names">${Object.entries(b.counts).map(([t, n]) => `${TYPE_LABEL[t]} ${n}`).join(" · ")}</div></div>
      <div class="act"><button class="btn ghost sm" data-dl="${i}">⬇ ดาวน์โหลด</button><button class="btn red sm" data-restorebk="${i}">กู้คืนชุดนี้</button></div>
    </div>`).join("");
}

$("#backupBtn").onclick = async () => {
  $("#backupBtn").disabled = true;
  try{ await api("backups", {method:"POST"}); await load(); toast("สำรองข้อมูลเรียบร้อย"); }
  catch(err){ alert(err.message); }
  finally{ $("#backupBtn").disabled = false; }
};

/* ปุ่มในแท็บถังขยะ/สำรองข้อมูล */
$("#list").addEventListener("click", async e => {
  const b = e.target.closest("button"); if(!b) return;
  try{
    if(b.dataset.restore !== undefined){
      const g = cache[b.dataset.restore];
      const j = await api("trash/restore", {method:"POST", body:JSON.stringify({type:g.type, deleted_at:g.deleted_at})});
      await load();
      toast(`กู้คืน ${j.restored} รายการแล้ว`);
      if(j.duplicates) alert(`กู้คืนแล้ว แต่มี ${j.duplicates} ชนิดที่ชื่อซ้ำกับสมุนไพรที่มีอยู่ตอนนี้ — ตรวจและลบตัวที่ไม่ต้องการได้ที่แท็บสมุนไพร`);
    }else if(b.dataset.purge !== undefined){
      const g = cache[b.dataset.purge];
      if(!confirm(`ลบถาวร ${g.count} รายการ (${TYPE_LABEL[g.type]})?\nลบแล้วกู้คืนจากถังขยะไม่ได้อีก (ยังกู้ได้จากไฟล์สำรองข้อมูล)`)) return;
      await api("trash/purge", {method:"POST", body:JSON.stringify({type:g.type, deleted_at:g.deleted_at})}); load();
    }else if(b.dataset.dl !== undefined){
      const bk = cache[b.dataset.dl];
      const r = await fetch("api/backups/download/" + encodeURIComponent(bk.name), {headers:{"Authorization":"Bearer " + token}});
      if(!r.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");
      const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(await r.blob()), download:bk.name});
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }else if(b.dataset.restorebk !== undefined){
      const bk = cache[b.dataset.restorebk];
      if(!confirm(`กู้คืนข้อมูลทั้งหมดกลับไปเป็นเมื่อ ${bk.created}?\n\nข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยชุดนี้\n(ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อน ย้อนกลับได้)`)) return;
      b.disabled = true;
      await api("backups/restore", {method:"POST", body:JSON.stringify({name:bk.name})});
      await load();
      toast(`กู้คืนข้อมูลเป็นเมื่อ ${bk.created} แล้ว`);
    }
  }catch(err){ alert(err.message); }
});

/* ---------- start ---------- */
if(!location.protocol.startsWith("http")){
  document.body.insertAdjacentHTML("beforeend", `<p class="empty">หน้านี้ต้องเปิดผ่านเซิร์ฟเวอร์<br>รันคำสั่ง <code>python server/server.py</code> แล้วเปิด http://localhost:8000/admin.html</p>`);
}else if(token) showApp(); else showLogin();
