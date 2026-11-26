/* =========================================================
   หน้า "ค้นหาสมุนไพร"  (#/herb/search)
   เมื่อรันผ่านเซิร์ฟเวอร์ ข้อมูลจะมาจากฐานข้อมูล (แก้/นำเข้าที่หน้าแอดมิน → แท็บสมุนไพร)
   HERB_DB ด้านล่างใช้เป็นข้อมูลสำรองเมื่อเปิดไฟล์ตรง ๆ โดยไม่มีเซิร์ฟเวอร์
   ========================================================= */

/* หมวดสมุนไพร (เลือกได้หลายหมวด) */
const HERB_CATEGORIES = [
  "สมุนไพรตามสรรพคุณ",
  "พันธุ์ไม้มงคลพระราชทานประจำจังหวัด (77 จังหวัด)"
];
const PROVINCIAL = HERB_CATEGORIES[1];

/* กลุ่มสมุนไพรตามสรรพคุณ (ตัวอย่าง — ควรใส่ให้ครบ 20 กลุ่มตามจริง) */
const HERB_GROUPS = [
  "กลุ่มยาแก้ไข้", "กลุ่มยาระบบทางเดินอาหาร", "กลุ่มยาระบบทางเดินหายใจ",
  "กลุ่มยารักษาโรคผิวหนัง", "กลุ่มยาบรรเทาปวดเมื่อย", "กลุ่มยาบำรุงร่างกาย",
  "กลุ่มยาบำรุงโลหิต", "กลุ่มยาขับปัสสาวะ"
];

/* ภูมิภาค → จังหวัด (ใส่เฉพาะจังหวัดที่มีข้อมูล) */
const REGIONS = PROVINCES; /* 77 จังหวัด อยู่ใน js/data.js */

const HERB_DB = [
  { th:"ไทรย้อยใบแหลม", en:"Fig, Golden Fig, Weeping Fig", sci:"Ficus benjamina L.",
    desc:"ไทรย้อยใบแหลมมีถิ่นกำเนิดในอินเดียและมาเลเซีย เป็นไม้ยืนต้น สูงได้ถึง 10 เมตร มีรากอากาศห้อยย้อยลงมาจากกิ่ง ใบเดี่ยวเรียงสลับ ปลายใบแหลม",
    use:"รากมีสรรพคุณแก้ฝีเปื่อยพัง ขับพยาธิ แก้บวม แก้นิ่ว ทาแผลฟกช้ำ สมานลำไส้ แก้ตับพิการ บำรุงโลหิต",
    cats:[PROVINCIAL], groups:["กลุ่มยาบำรุงโลหิต"], region:"ภาคกลาง", province:"กรุงเทพมหานคร" },
  { th:"นนทรี", en:"Yellow Flame, Copper Pod", sci:"Peltophorum pterocarpum (DC.) K.Heyne",
    desc:"ไม้ยืนต้นขนาดกลางถึงใหญ่ ทรงพุ่มกว้าง ใบประกอบแบบขนนกสองชั้น ดอกสีเหลืองออกเป็นช่อตั้งที่ปลายกิ่ง ฝักแบนสีน้ำตาลแดง",
    use:"เปลือกต้นใช้เป็นยาสมานแผล แก้ท้องร่วง ตามตำรายาไทย",
    cats:[PROVINCIAL], groups:["กลุ่มยาระบบทางเดินอาหาร"], region:"ภาคกลาง", province:"นนทบุรี" },
  { th:"ทองกวาว", en:"Flame of the Forest, Bastard Teak", sci:"Butea monosperma (Lam.) Taub.",
    desc:"ไม้ยืนต้นผลัดใบ สูง 10–15 เมตร ใบประกอบมี 3 ใบย่อย ดอกสีแสดออกเป็นช่อขณะทิ้งใบในฤดูแล้ง",
    use:"ตำรายาไทยใช้ดอกแก้ไข้ ขับปัสสาวะ ยางใช้แก้ท้องร่วง",
    cats:[PROVINCIAL], groups:["กลุ่มยาแก้ไข้","กลุ่มยาขับปัสสาวะ"], region:"ภาคเหนือ", province:"เชียงใหม่" },
  { th:"ราชพฤกษ์ (คูน)", en:"Golden Shower, Indian Laburnum", sci:"Cassia fistula L.",
    desc:"ไม้ยืนต้นผลัดใบ สูง 10–20 เมตร ดอกสีเหลืองออกเป็นช่อห้อยลง ฝักกลมยาวสีดำเมื่อแก่",
    use:"เนื้อในฝักใช้เป็นยาระบายอ่อน ๆ ตามตำรายาไทย",
    cats:[PROVINCIAL], groups:["กลุ่มยาระบบทางเดินอาหาร"], region:"ภาคตะวันออกเฉียงเหนือ", province:"ขอนแก่น" },
  { th:"ฟ้าทะลายโจร", en:"Kariyat, The Creat", sci:"Andrographis paniculata (Burm.f.) Nees",
    desc:"ไม้ล้มลุก สูง 30–70 เซนติเมตร ลำต้นเป็นสี่เหลี่ยม ใบเดี่ยวเรียงตรงข้าม ทุกส่วนมีรสขมจัด",
    use:"บรรเทาอาการเจ็บคอ ไข้หวัด และท้องเสียไม่รุนแรง ตามบัญชียาหลักแห่งชาติด้านสมุนไพร",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาแก้ไข้","กลุ่มยาระบบทางเดินหายใจ"] },
  { th:"ขมิ้นชัน", en:"Turmeric", sci:"Curcuma longa L.",
    desc:"ไม้ล้มลุกมีเหง้าใต้ดิน เนื้อในเหง้าสีเหลืองส้ม มีกลิ่นหอมเฉพาะ ใบเดี่ยวรูปใบหอก",
    use:"บรรเทาอาการท้องอืด ท้องเฟ้อ อาหารไม่ย่อย ใช้ภายนอกบรรเทาผื่นคัน",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาระบบทางเดินอาหาร","กลุ่มยารักษาโรคผิวหนัง"] },
  { th:"ขิง", en:"Ginger", sci:"Zingiber officinale Roscoe",
    desc:"ไม้ล้มลุก มีเหง้าใต้ดินสีน้ำตาลแกมเหลือง กลิ่นหอมเฉพาะ รสเผ็ดร้อน",
    use:"ขับลม บรรเทาอาการท้องอืด คลื่นไส้อาเจียน",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาระบบทางเดินอาหาร"] },
  { th:"บอระเพ็ด", en:"Heart-leaved Moonseed", sci:"Tinospora crispa (L.) Hook.f. & Thomson",
    desc:"ไม้เถาเลื้อย ลำต้นมีปุ่มปมทั่วไป ใบเดี่ยวรูปหัวใจ ทุกส่วนมีรสขมจัด",
    use:"แก้ไข้ เจริญอาหาร ตามตำรายาไทย",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาแก้ไข้"] },
  { th:"ว่านหางจระเข้", en:"Aloe", sci:"Aloe vera (L.) Burm.f.",
    desc:"ไม้ล้มลุกอวบน้ำ ใบหนาเรียงซ้อนกัน ขอบใบมีหนาม ภายในมีวุ้นใส",
    use:"วุ้นใช้ทาบรรเทาแผลไฟไหม้ น้ำร้อนลวก แผลถลอก",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยารักษาโรคผิวหนัง"] },
  { th:"ไพล", en:"Cassumunar Ginger", sci:"Zingiber montanum (J.Koenig) Link ex A.Dietr.",
    desc:"ไม้ล้มลุก มีเหง้าใต้ดิน เนื้อในสีเหลือง กลิ่นหอมฉุน",
    use:"ใช้ทำลูกประคบและน้ำมันไพล บรรเทาอาการปวดเมื่อย เคล็ดขัดยอก ฟกช้ำ",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาบรรเทาปวดเมื่อย"] },
  { th:"มะขามป้อม", en:"Indian Gooseberry", sci:"Phyllanthus emblica L.",
    desc:"ไม้ยืนต้นขนาดกลาง ใบเล็กเรียงสลับคล้ายใบประกอบ ผลกลมสีเขียวอมเหลือง รสเปรี้ยวฝาดอมหวาน",
    use:"บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาระบบทางเดินหายใจ"] },
  { th:"บัวบก", en:"Asiatic Pennywort", sci:"Centella asiatica (L.) Urb.",
    desc:"ไม้ล้มลุก เลื้อยตามผิวดิน ใบเดี่ยวรูปไตออกเป็นกระจุกที่ข้อ",
    use:"ใช้ภายนอกช่วยสมานแผล ใช้ทำเครื่องดื่มบำรุงร่างกาย",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาบำรุงร่างกาย","กลุ่มยารักษาโรคผิวหนัง"] },
  { th:"ตะไคร้", en:"Lemongrass", sci:"Cymbopogon citratus (DC.) Stapf",
    desc:"ไม้ล้มลุก ขึ้นเป็นกอ ใบเรียวยาว มีกลิ่นหอมเฉพาะ",
    use:"ขับลม บรรเทาอาการท้องอืด ขับปัสสาวะ",
    cats:[HERB_CATEGORIES[0]], groups:["กลุ่มยาระบบทางเดินอาหาร","กลุ่มยาขับปัสสาวะ"] }
];

/* ---------- UI ---------- */
const ALL = "ทั้งหมด";   /* เปิดหน้ามาแสดงพืชทั้งหมดก่อน แล้วค่อยเลือกตัวกรอง */
/* มุมมอง: "grid" = การ์ดรูปภาพ (ค่าเริ่มต้น) · "table" = ตาราง — จำค่าที่เลือกไว้ในเบราว์เซอร์ */
let HS_VIEW = (() => { try { return localStorage.getItem("hsView") || "grid"; } catch (e) { return "grid"; } })();

/* การ์ดพืช (ใช้ทั้งหน้าค้นหาและ "พืชในกลุ่มเดียวกัน" ในหน้าพืช) */
function plantCard(h){
  const sub = h.province ? `ไม้มงคลประจำจังหวัด${h.province}` : (h.groups || []).slice(0, 2).join(" · ");
  return `<a class="hs-card" href="#/herb/plant/${h.id}">
    <div class="hs-card-img"${h.img ? ` style="background-image:url('${h.img}')"` : ""}>${h.img ? "" : `<span>🌿</span>`}${statusBadge(h.status)}</div>
    <div class="hs-card-b"><h3>${herbTitleIsSci(h) ? `<i>${herbTitle(h)}</i>` : herbTitle(h)}</h3>${herbTitle(h) !== h.th ? `<small>${h.th}</small>` : ""}${h.sci && !herbTitleIsSci(h) ? `<i>${h.sci}</i>` : ""}${sub ? `<small>${sub}</small>` : ""}</div>
  </a>`;
}

const chevSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>`;
const docSvg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9b7fc4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3v5h5"/><path d="M19 8v3"/><circle cx="17" cy="17" r="3"/><path d="M17 16v1.2l.8.6"/></svg>`;

function hsSelect(id, opts){
  return `<span class="hs-select"><select id="${id}">${opts.map(o=>`<option>${o}</option>`).join("")}</select>${chevSvg}</span>`;
}

function hsBody(){
  return `
  <div class="hs-panel">
    <div class="hs-row hs-two">
      <label><span class="hs-label">หมวดสมุนไพร</span>${hsSelect("hsCat", [ALL, ...HERB_CATEGORIES])}</label>
      <label><span class="hs-label">กลุ่มสมุนไพร</span>${hsSelect("hsGroup", [ALL, ...HERB_GROUPS])}</label>
    </div>
    <div class="hs-row hs-two" id="rowRegion">
      <label><span class="hs-label">ภูมิภาค</span>${hsSelect("hsRegion", [ALL, ...Object.keys(REGIONS)])}</label>
      <label><span class="hs-label">จังหวัด</span>${hsSelect("hsProv", [ALL])}</label>
    </div>
    <div class="hs-row hs-two">
      <label><span class="hs-label">สถานะการอนุรักษ์</span>${hsSelect("hsStatus", [ALL, "พืชที่ต้องอนุรักษ์ (ทุกระดับ)", ...CONSERVATION])}</label>
    </div>
    <div class="hs-row hs-search">
      <label><span class="hs-label">หัวข้อค้นหา</span>${hsSelect("hsField", ["ทั้งหมด","ชื่อภาษาไทย","ชื่อภาษาอังกฤษ","ชื่อวิทยาศาสตร์","สรรพคุณ"])}</label>
      <span class="hs-input"><input id="hsQ" placeholder="ระบุคำค้นหา"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span>
    </div>
  </div>
  <div class="hs-bar"><p class="hs-count" id="hsCount"></p>
    <div class="hs-view" role="group" aria-label="มุมมอง">
      <button data-view="grid">🖼 รูปภาพ</button><button data-view="table">☰ ตาราง</button>
    </div></div>
  <div class="hs-grid" id="hsGrid"></div>
  <div class="hs-table-wrap" id="hsTableWrap">
    <table class="hs-table">
      <thead><tr><th>ลำดับ</th><th>ชื่อภาษาไทย</th><th>ชื่อภาษาอังกฤษ</th><th>ชื่อวิทยาศาสตร์</th><th>ลักษณะทั่วไป</th><th>สรรพคุณ</th><th>รายละเอียด</th></tr></thead>
      <tbody id="hsBody"></tbody>
    </table>
  </div>
  <div class="hs-modal" id="hsModal" hidden><div class="hs-dialog" role="dialog" aria-modal="true"><button class="hs-close" aria-label="ปิด">×</button><div id="hsDetail"></div></div></div>`;
}

function hsRun(){
  const $v = id => document.getElementById(id).value;
  const cat = $v("hsCat"), group = $v("hsGroup"), region = $v("hsRegion"), prov = $v("hsProv");
  const field = $v("hsField"), status = $v("hsStatus");
  const q = $v("hsQ").trim().toLowerCase();
  const provincialOn = cat === PROVINCIAL;   /* ช่องภูมิภาค/จังหวัด แสดงเฉพาะเมื่อเลือกหมวดพันธุ์ไม้มงคล */
  document.getElementById("rowRegion").style.display = provincialOn ? "" : "none";

  const fieldText = h => ({ "ชื่อภาษาไทย":h.th, "ชื่อภาษาอังกฤษ":h.en, "ชื่อวิทยาศาสตร์":h.sci, "สรรพคุณ":h.use }[field] ?? (h.th+h.en+h.sci+h.desc+h.use));

  const rows = HERB_DB.filter(h=>{
    if (cat!==ALL && !h.cats.includes(cat)) return false;
    if (provincialOn){
      if (region!==ALL && h.region!==region) return false;
      if (prov!==ALL && h.province!==prov) return false;
    }
    if (group!==ALL && !h.groups.includes(group)) return false;
    if (status!==ALL && (status.startsWith("พืชที่ต้องอนุรักษ์") ? !h.status : h.status!==status)) return false;
    if (q && !fieldText(h).toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById("hsCount").textContent = `พบ ${rows.length} รายการ`;
  const grid = HS_VIEW === "grid";
  document.querySelectorAll(".hs-view button").forEach(b => b.classList.toggle("on", b.dataset.view === HS_VIEW));
  document.getElementById("hsGrid").hidden = !grid;
  document.getElementById("hsTableWrap").hidden = grid;
  if (grid) {
    /* แบบรูปภาพ: ชนิดที่มีรูปขึ้นก่อน (ลำดับเดิมภายในกลุ่มคงไว้) */
    const sorted = [...rows.filter(h => h.img), ...rows.filter(h => !h.img)];
    document.getElementById("hsGrid").innerHTML = sorted.map(plantCard).join("")
      || `<p class="hs-empty">ไม่พบข้อมูลสมุนไพรที่ตรงกับเงื่อนไข</p>`;
    return;
  }
  document.getElementById("hsBody").innerHTML = rows.length ? rows.map((h,i)=>`
    <tr>
      <td class="c">${i+1}</td>
      <td><div class="hs-name">${h.img?`<img class="hs-thumb" src="${h.img}" alt="" loading="lazy">`:""}<span>${h.th}${statusBadge(h.status)}${h.province?`<small>${h.province}</small>`:""}</span></div></td>
      <td>${h.en}</td>
      <td><i>${h.sci}</i></td>
      <td class="clip"><div>ลักษณะทั่วไป ${h.desc}</div></td>
      <td class="clip"><div>สรรพคุณ ${h.use}</div></td>
      <td class="c"><button class="hs-doc" data-i="${HERB_DB.indexOf(h)}" aria-label="ดูรายละเอียด ${h.th}">${docSvg}</button></td>
    </tr>`).join("") : `<tr><td colspan="7" class="hs-empty">ไม่พบข้อมูลสมุนไพรที่ตรงกับเงื่อนไข</td></tr>`;
}

function hsOpen(h){
  document.getElementById("hsDetail").innerHTML = `
    ${h.img?`<img class="hs-photo" src="${h.img}" alt="${h.th}">${creditLine(h.credit)}`:""}
    <span class="pill">${h.province ? "พันธุ์ไม้มงคลประจำจังหวัด"+h.province : h.groups.join(" · ")}</span>
    <h2>${herbTitleIsSci(h) ? `<i>${herbTitle(h)}</i>` : herbTitle(h)}</h2>${statusBadge(h.status)}
    <p class="hs-sub">${[herbTitle(h) !== h.th ? h.th : h.en, h.sci ? `<i>${h.sci}</i>` : ""].filter(Boolean).join(" · ")}</p>
    <h3>ลักษณะทั่วไป</h3><p>${h.desc}</p>
    <h3>สรรพคุณ</h3><p>${h.use}</p>
    <p class="hs-warn">* ข้อมูลตามภูมิปัญญาการแพทย์แผนไทย ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้</p>
    ${h.id!=null?`<p style="margin-top:18px"><a class="btn btn-g" href="#/herb/plant/${h.id}">🔗 เปิดหน้าของพืชนี้ (คัดลอก/แชร์ลิงก์ได้)</a></p>`:""}`;
  document.getElementById("hsModal").hidden = false;
}

const HERB_SEARCH = {
  t: "ค้นหาสมุนไพร",
  c: "ข้อมูลสวนสมุนไพร",
  /* คำอธิบายนับจากข้อมูลจริง (จำนวนชนิด/กลุ่มเปลี่ยนตามที่แอดมินใส่) */
  get desc(){
    const groups = new Set(HERB_DB.flatMap(h => h.groups || []));
    const prov = HERB_DB.filter(h => h.province).length;
    return `ฐานข้อมูลพืชสมุนไพรและพันธุ์ไม้มงคลพระราชทานประจำจังหวัด รวม ${HERB_DB.length} ชนิด`
      + (prov ? ` (พันธุ์ไม้มงคล ${prov} จังหวัด)` : "")
      + (groups.size ? ` จัดเป็น ${groups.size} กลุ่มตามสรรพคุณรักษาโรคในตำรายาไทย` : "");
  },
  bg: "linear-gradient(160deg,#2f5a24,#7da95a)",
  img: "images/herb.jpg",
  body: hsBody,
  run(){
    const region = document.getElementById("hsRegion"), prov = document.getElementById("hsProv");
    const fillProv = () => {
      const list = region.value===ALL ? Object.values(REGIONS).flat() : REGIONS[region.value];
      prov.innerHTML = [ALL, ...list].map(p=>`<option>${p}</option>`).join("");
    };
    fillProv();
    /* มาจากการกดจังหวัดในหน้าแรก → เลือกหมวดพันธุ์ไม้มงคล + จังหวัดนั้นให้ */
    if (window.HS_PRESET) {
      document.getElementById("hsCat").value = PROVINCIAL;
      region.value = HS_PRESET.region; fillProv(); prov.value = HS_PRESET.province;
      window.HS_PRESET = null;
    }
    region.onchange = () => { fillProv(); hsRun(); };
    prov.onchange = hsRun;
    document.getElementById("hsCat").onchange = hsRun;
    document.querySelectorAll(".hs-view button").forEach(b => b.onclick = () => {
      HS_VIEW = b.dataset.view;
      try { localStorage.setItem("hsView", HS_VIEW); } catch (e) {}
      hsRun();
    });
    document.getElementById("hsGroup").onchange = hsRun;
    document.getElementById("hsStatus").onchange = hsRun;
    document.getElementById("hsField").onchange = hsRun;
    document.getElementById("hsQ").oninput = hsRun;
    document.getElementById("hsBody").onclick = e => { const b = e.target.closest(".hs-doc"); if (b) hsOpen(HERB_DB[b.dataset.i]); };
    const modal = document.getElementById("hsModal");
    modal.onclick = e => { if (e.target===modal || e.target.closest(".hs-close")) modal.hidden = true; };
    document.addEventListener("keydown", e => { if (e.key==="Escape") modal.hidden = true; });
    hsRun();
  }
};
