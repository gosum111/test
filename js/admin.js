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
    ["body","รายละเอียด — พิมพ์ข้อความธรรมดาได้ (เว้นบรรทัด = ย่อหน้าใหม่ · \"## \" = หัวข้อ · \"- \" = รายการ)","textarea",null,10]]},
  events: {title:"ปฏิทิน", fields:[
    ["kind","ประเภท","select",Object.entries(EVENT_KIND)],
    ["title","ชื่อ * (เช่น ปิดทำการวันสงกรานต์, งานวันสมุนไพร)","text"],
    ["date","วันเริ่ม *","date"],
    ["end_date","วันสิ้นสุด (ถ้าวันเดียวไม่ต้องใส่)","date"],
    ["detail","รายละเอียดสั้น ๆ","textarea",null,3],
    ["link","ลิงก์เพิ่มเติม (ไม่บังคับ — เลือกหน้าในเว็บหรือวางลิงก์ภายนอก)","datalist",SITE_LINKS]]},
  services: {title:"บริการ (หน้าแรก)", fields:[
    ["title","ชื่อบริการ * (ขึ้นบรรทัดใหม่ได้)","textarea",null,2],
    ["img","รูปภาพ (แนวตั้ง)","image"],
    ["link","เมื่อกดแล้วไปที่","datalist",SITE_LINKS],
    ["sort","ลำดับการแสดง (เลขน้อยแสดงก่อน)","number"]]},
  pages: {title:"หน้าเนื้อหา", fixed:true, fields:[   /* fixed = แก้ได้อย่างเดียว ไม่มีเพิ่ม/ลบ */
    ["title","ชื่อหน้า *","text"],
    ["img","รูปหัวหน้า (แนวนอน)","image"],
    ["body","เนื้อหา — พิมพ์ข้อความธรรมดาได้เลย: เว้น 1 บรรทัด = ย่อหน้าใหม่ · \"## หัวข้อ\" = หัวข้อ · \"- 2528: ก่อตั้งสวน\" = เส้นเวลา · \"- ข้อความ\" = รายการ","textarea",null,16]]},
  herbs: {title:"สมุนไพร", fields:[
    ["th","ชื่อภาษาไทย *","text"],
    ["en","ชื่อภาษาอังกฤษ","text"],
    ["sci","ชื่อวิทยาศาสตร์","text"],
    ["detail","ลักษณะทั่วไป","textarea",null,4],
    ["uses","สรรพคุณ","textarea",null,4],
    ["groups","กลุ่มสมุนไพร (หลายกลุ่มคั่นด้วย , เช่น กลุ่มยาแก้ไข้, กลุ่มยาขับปัสสาวะ)","text"],
    ["status","สถานะการอนุรักษ์","select",[["","ปกติ"], ...CONSERVATION]],
    ["province","พันธุ์ไม้มงคลประจำจังหวัด","province"],
    ["img","รูปภาพ","image"],
    ["img_credit","เครดิตรูป (ถ้าใช้รูปจากแหล่งอื่น เช่น ชื่อผู้ถ่าย · สัญญาอนุญาต · ลิงก์)","text"]]},
  news: {title:"ข่าวสาร", fields:[
    ["title","หัวข้อข่าว *","text"],
    ["type","ประเภท","select",["ข่าวสาร","กิจกรรม","โครงการ"]],
    ["detail","รายละเอียด","textarea"],
    ["img","รูปภาพ","image"]]},
  articles: {title:"บทความสมุนไพร", fields:[
    ["title","ชื่อบทความ *","text"],
    ["date","วันที่ (เช่น 30/01/2026)","text"],
    ["excerpt","คำโปรย (ใส่ <br> เพื่อขึ้นบรรทัดใหม่)","textarea"],
    ["img","รูปภาพ","image"],
    ["body","เนื้อหา (ใส่ HTML ได้ เช่น <p>…</p>)","textarea",null,10]]},
  workshops: {title:"Workshop", fields:[
    ["name","ชื่อผลิตภัณฑ์ *","text"],
    ["detail","คำอธิบาย","textarea"],
    ["img","รูปภาพ","image"]]},
  brochures: {title:"โบรชัวร์", fields:[
    ["title","ชื่อโบรชัวร์ *","text"],
    ["type","ประเภท","select",["แนะนำ","แผนที่","สมุนไพร","กิจกรรม"]],
    ["file","ไฟล์ PDF","pdf"]]}
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
  e.preventDefault(); $("#loginErr").textContent = "";
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
  notify:"แจ้งเตือนเมื่อมีคนส่งข้อความ"};

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
  };
  const ICON = {brochures:"📄", events:"📅"};
  const note = tab === "events" ? `<div class="note">
      <label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:600"><input type="checkbox" id="marketAuto" style="width:auto;margin:0" ${calSettings.market_auto === "1" ? "checked" : ""}>
        แสดงตลาดนัดอัตโนมัติทุกเสาร์–อาทิตย์สัปดาห์แรกของเดือน</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 0;font-weight:600"><input type="checkbox" id="closedMonday" style="width:auto;margin:0" ${calSettings.closed_monday !== "0" ? "checked" : ""}>
        แสดง "ปิดทำการ" ทุกวันจันทร์</label>
      <span class="hint">กิจกรรมจากแท็บ "โครงการและกิจกรรม" แสดงในปฏิทินตามวันที่จัดอยู่แล้ว · แท็บนี้ใช้เพิ่ม<b>วันปิดทำการ</b>, <b>ตลาดนัดพิเศษ</b> หรือ<b>กิจกรรมหลายวัน</b>ที่ไม่ต้องมีหน้าอ่านรายละเอียด</span></div>` : "";
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
    </section>`,
  /* สมุนไพร: ป้าย QR ที่จะติดต้นไม้ + หน้าของพืชที่ผู้เข้าชมเห็นหลังสแกน */
  herbs: d => {
    const fm = (d.detail || "").match(/^วงศ์\s+([^·]+?)\s*·\s*/), family = fm ? fm[1] : "", desc = fm ? d.detail.slice(fm[0].length) : (d.detail || "");
    const groups = (d.groups || "").split(",").map(s => s.trim()).filter(Boolean);
    const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "";
    const qr = editing ? qrSvg(`${SITE_URL}/herb/plant/${editing.id}`)
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
    </section>`
};

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
      <label class="btn ghost" style="flex:none;margin:0;display:inline-block">อัปโหลด<input type="file" accept="${type === "pdf" ? "application/pdf" : "image/*"}" id="file" hidden></label></div>
      ${type === "pdf" ? `<p class="hint" id="pdfLink" style="margin:6px 0 12px"></p>` : `<div style="height:12px"></div>`}`;
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
  $("#file").onchange = async e => {
    const file = e.target.files[0]; if(!file) return;
    $("#formErr").textContent = "กำลังอัปโหลด…";
    try{
      const data = await fileToUpload(file);
      const j = await api("upload", {method:"POST", body:JSON.stringify({data})});
      upIn.value = j.path; showPv(); $("#formErr").textContent = "";
    }catch(err){ $("#formErr").textContent = err.message; }
  };
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
    const big = document.querySelector('input[name="qrInlineSize"]:checked').value === "l";
    w.document.open();
    openLabelSheet([saved], copies, big, SITE_URL, w);
    $("#dlg").close(); load();
    toast(`บันทึก "${saved.th}" แล้ว · เปิดหน้าพิมพ์ป้าย QR ${copies} ป้ายในแท็บใหม่`);
  }catch(err){ w.close(); $("#formErr").textContent = err.message; }
  finally{ $("#savePrintBtn").disabled = false; }
};

/* ---------- สมุนไพร: ค้นหา / ดาวน์โหลด / นำเข้าจากไฟล์ ---------- */
$("#q").oninput = render;

const HERB_COLS = [["th","ชื่อภาษาไทย"],["en","ชื่อภาษาอังกฤษ"],["sci","ชื่อวิทยาศาสตร์"],["detail","ลักษณะทั่วไป"],
                   ["uses","สรรพคุณ"],["groups","กลุ่มสมุนไพร"],["province","จังหวัด (เฉพาะพันธุ์ไม้มงคล)"],["img","รูปภาพ"],
                   ["status","สถานะการอนุรักษ์"],["img_credit","เครดิตรูป"]];

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
const qrSvg = text => { const q = qrcode(0, "Q"); q.addData(text); q.make(); return q.createSvgTag({cellSize:4, margin:0, scalable:true}); };
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
  $("#qrTotal").textContent = `รวมทั้งหมด ${n * c} ป้าย (${n} ชนิด × ${c}) · ประมาณ ${Math.ceil(n * c / (document.querySelector('#qrDlg input[name="qrSize"]:checked').value === "l" ? 2 : 10))} แผ่น A4`;
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
  const big = document.querySelector('#qrDlg input[name="qrSize"]:checked').value === "l";
  if(openLabelSheet(list, qrCopies(), big, site)) $("#qrDlg").close();
};

/* สร้างหน้าพิมพ์ป้าย (ใช้ทั้งหน้าต่าง "พิมพ์ป้าย QR" และปุ่ม 🏷 QR ของแต่ละชนิด) */
function openLabelSheet(list, copies, big, site, win){
  const all = list.flatMap(h => Array(copies).fill(h));   /* ป้ายของชนิดเดียวกันอยู่ติดกัน ตัดแล้วแยกกองง่าย */
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
      <div class="qr">${qrSvg(`${site}/herb/plant/${h.id}`)}</div>
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

/* ---------- QR ของพืชชนิดเดียว: หลังเพิ่มพืชใหม่ (เปิดให้อัตโนมัติ) และปุ่ม 🏷 QR ในรายการ ---------- */
let qrOneHerb = null;
async function openQrOne(h, isNew){
  qrOneHerb = h;
  let site = location.origin;
  try{ site = (await api("notify")).site_url || site; }catch(e){}
  site = site.replace(/\/+$/, "");
  const url = `${site}/herb/plant/${h.id}`;
  $("#q1Title").textContent = isNew ? `✓ เพิ่ม "${h.th}" แล้ว — พิมพ์ป้าย QR ได้เลย` : `ป้าย QR: ${h.th}`;
  $("#q1Qr").innerHTML = qrSvg(url);
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
  const big = d.querySelector('input[name="q1Size"]:checked').value === "l";
  if(openLabelSheet([qrOneHerb], copies, big, d.dataset.site)) d.close();
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
