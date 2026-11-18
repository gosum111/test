/* =========================================================
   หน้า "แผนผังสวนสมุนไพร"  (#/herb/map)
   - วางภาพแผนผังจริงไว้ที่ images/map.jpg
   - x, y = ตำแหน่งหมุดบนภาพ (เป็น % จากซ้าย/บน)
   ========================================================= */

const GM_ICONS = {
  arch:    '<path d="M5 20V11a7 7 0 0 1 14 0v9"/><path d="M8 20v-8a4 4 0 0 1 8 0v8"/>',
  pond:    '<circle cx="12" cy="6" r="2"/><path d="M8 13l4-3 4 3"/><path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17"/><path d="M3 20.5c2 0 2-1.5 4.5-1.5S10 20.5 12 20.5s2-1.5 4.5-1.5S19 20.5 21 20.5"/>',
  shop:    '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18v-3H3z"/><path d="M12 6v14"/><path d="M12 6c-2-4-6-3-5 0M12 6c2-4 6-3 5 0"/>',
  museum:  '<path d="M3 20h18"/><path d="M5 20V9M10 20V6M14 20V11M19 20V8"/><path d="M5 9h3M10 6h3M14 11h3M19 8h-3"/>',
  zodiac:  '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  lotus:   '<path d="M12 18c-3-2-4-5-3-9 2 1 3 3 3 5 0-2 1-4 3-5 1 4 0 7-3 9z"/><path d="M12 18c-4 0-7-2-8-5 3-1 5 0 7 2M12 18c4 0 7-2 8-5-3-1-5 0-7 2"/>',
  pavilion:'<path d="M3 10 12 4l9 6"/><path d="M5 10h14"/><path d="M7 10v9M17 10v9M5 19h14"/><path d="M10 14h4"/>',
  toilet:  '<circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M6 20v-6h4v6M14 20v-6h4v6"/>'
};
const gmIcon = k => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GM_ICONS[k]}</svg>`;

/* ---- 20 กลุ่มสรรพคุณ (กลุ่ม 1–9 คัดจากเว็บจริง, 10–20 รอใส่ข้อมูล) ---- */
const GM_GROUPS = [
  { n:1,  x:61.5, y:25.2, t:"กลุ่มพืชหอมต่างๆ (Aromatic Plants)",
    h:"กระดังงาไทย / กระดังงาสงขลา / กานพลู / กุหลาบมอญ / ขันทองพยาบาท / จำปา / จำปาขาว / จำปี / จำปีสิรินธร / ชมนาด / ดีปลี / ตะไคร้บ้าน / ตะไคร้หอม / นมแมว / มณฑา / มะกรูด / มะนาว / มะตูม / มะพลับ / มหาหงส์ / โมกหลวง / พิกุล / ยี่หร่า / ส้มเขียวหวาน / ส้มซ่า / มะขามป้อม / มะเฟือง / มะดัน" },
  { n:2,  x:63.3, y:66.2, t:"กลุ่มแก้โรคผิวหนัง (Treatment of Skin Diseases)",
    h:"ข่า / ขมิ้นชัน / ข่าใหญ่ / ไพล / คำแสด / ดีปลี / ผักคราดหัวแหวน / ฝรั่ง / มะขาม / มะขามเทศ / มะเกลือ / มะคำดีควาย / มะหาด / พลับพลึง / ฟักข้าว / ระกำ / ว่านหางจระเข้ / สับปะรด / สำหล้า / เสลดพังพอนตัวเมีย" },
  { n:3,  x:49.8, y:48.6, t:"กลุ่มต้านฮีสตามีน (Antihistaminic Agents)",
    h:"กะเม็ง / กำยาน / ขลู่ / เถาคัน / เทียนบ้าน / บอระเพ็ด / มะระขี้นก / มะรุม / มังคุด / ย่านาง / หญ้าคา / หญ้าหนวดแมว / หญ้าใต้ใบ (เล็ก) / เสี้ยนกุ่ง / สาบเสือ / แก้ว / เทพทาโร" },
  { n:4,  x:53.2, y:25.7, t:"กลุ่มยาแก้อ่อนเพลีย บำรุงกำลัง (Tonic)",
    h:"กะเพรา / กำยาน / ขี้เหล็ก / บุกหลวง / มะตูม / มะขาม / มะดัน" },
  { n:5,  x:45.2, y:37.9, t:"กลุ่มแก้ไข้ ลดความร้อน (Antifever, Antipyretic)",
    h:"กะเพรา / กำยาน / ขี้เหล็ก / ตะไคร้บ้าน / เทียนบ้าน / ดีปลี / ฟ้าทะลายโจร / มะยม / มะกรูด / มะขามป้อม / มะดัน / มังคุด / ย่านาง / ลำโพง / สาบเสือ / หญ้าคา / หญ้าหนวดแมว / มะระขี้นก / สมอพิเภก / สมอไทย" },
  { n:6,  x:46.6, y:25.5, t:"กลุ่มยาขับน้ำนม (Galactogogues)",
    h:"กานพลู / กุยช่าย / ไทรย้อยใบแหลม / มะเกลือเทศแดง / เจต / อะลาง" },
  { n:7,  x:37.1, y:55.8, t:"กลุ่มยาถ่าย ยาระบาย (Cathartic, Laxative)",
    h:"กากหมาก / ชุมเห็ดเทศ / ลูก / ตองตึง / บุกค้ำเสา / บุกหอม / ส้มป่อย / มะขามแขก / มะขามเทศ / มะขาม / มะตูม / มะเกลือ / มะหาด / ระกำ / ว่านหางจระเข้ / สมอไทย / สมอพิเภก / สมอเทศ" },
  { n:8,  x:36.3, y:40.5, t:"กลุ่มยาสมุนไพรตำรับไทย (Thai Herbal Remedies)",
    h:"ขมิ้นชัน / กระชาย / ยอ / กานพลู / บอระเพ็ด / มะตูมเทศ / ดีปลี / ขี้เหล็ก / ชะพลู / ฟ้าทะลายโจร / มะขามป้อม / มะเกลือ / มะหาด / สมอพิเภก / สมอไทย / สมอเทศ / สมุนไพรตำรับยาไทย" },
  { n:9,  x:28.6, y:39.2, t:"กลุ่มยาแก้ไอ ขับเสมหะ (Antitussive, Expectorants)",
    h:"ข่า / กระชาย / กระวาน / กานพลู / ขิง / ขี้เหล็ก / ตะไคร้หอม / มะกรูด / มะขามป้อม / มะดัน / มังคุด / มะนาว / สมอไทย / สมอพิเภก / สมอเทศ / หญ้าหนวดแมว" },
  { n:10, x:30.6, y:28.3 }, { n:11, x:22.5, y:57.4 }, { n:12, x:24.0, y:31.4 },
  { n:13, x:10.8, y:71.7 }, { n:14, x:14.4, y:44.2 }, { n:15, x:11.8, y:57.4 },
  { n:16, x:15.3, y:31.9 }, { n:17, x:5.2,  y:70.6 }, { n:18, x:9.8,  y:46.8 },
  { n:19 },                 { n:20, x:18.1, y:27.3 }
].map(g => ({ t:`กลุ่มที่ ${g.n} (รอใส่ชื่อกลุ่ม)`, h:"รอใส่รายชื่อสมุนไพร", ...g }));

/* ---- อาคารและสถานที่แนะนำ ---- */
const GM_PLACES = [
  { id:"arch",     icon:"arch",     x:49.3, y:19.2, t:"ซุ้มไม้เลื้อย (Creeper Arches)", d:"พันธุ์ไม้สมุนไพรเลื้อยขึ้นตามโครงสร้างทางเดิน เพิ่มบรรยากาศร่มรื่นตลอดแนวสวนด้านตะวันตก" },
  { id:"pond",     icon:"pond",     x:6.1,  y:48.3, t:"สระกฤษณา (Eaglewood (Krishana) Pond)", d:"สระน้ำขนาดใหญ่ มีเงาสะท้อนภาพของกฤษณาลงบนผิวน้ำ" },
  { id:"shop",     icon:"shop",     x:80.5, y:8.6,  t:"ศูนย์บริการร้านค้าชุมชน", d:"ร้านอาหารและเครื่องดื่ม" },
  { id:"museum",   icon:"museum",   x:84.5, y:26.5, t:"อาคารพิพิธภัณฑ์สมุนไพร (Museum Building)", d:"รวบรวมประวัติความเป็นมาของสมุนไพรไทยและวิถีชีวิตแบบไทย" },
  { id:"zodiac",   icon:"zodiac",   x:32.4, y:57.9, t:"ลาน 12 ราศี (Zodiac Court)", d:"นาฬิกาแดดบอกเวลาตามจักรราศี" },
  { id:"lotus",    icon:"lotus",    x:60.9, y:48.1, t:"สระบัวหลวง", d:"สระบัวรูปครึ่งวงกลม เป็นสัญลักษณ์ต้อนรับผู้มาเยือน" },
  { id:"pavilion", icon:"pavilion", x:10.2, y:27.3, t:"ศาลาพักผ่อน (Recreation Pavilion)", d:"ศาลาไทยสำหรับพักผ่อน" },
  { id:"A", letter:"A", x:85.0, y:41.6, t:"อาคารเฉลิมพระเกียรติ 50 พรรษา" },
  { id:"B", letter:"B", x:87.8, y:59.0, t:"ห้องประชุมสายน้ำผึ้ง" },
  { id:"C", letter:"C", x:72.1, y:25.2, t:"จุดขึ้นรถบริการนำชมสวนสมุนไพร" },
  { id:"toilet",   icon:"toilet", purple:true, x:82.9, y:8.6, t:"ห้องน้ำ (Toilet)" }
];

/* ---------- render ---------- */
function gmBadge(p){
  if (p.n) return `<span class="gm-num">${p.n}</span>`;
  if (p.letter) return `<span class="gm-num purple">${p.letter}</span>`;
  return `<span class="gm-num ${p.purple?"purple":"gold"}">${gmIcon(p.icon)}</span>`;
}

/* แสดงเฉพาะกลุ่มที่มีข้อมูลแล้ว — กลุ่มที่ยังเป็น "รอใส่..." ซ่อนไว้จนกว่าจะได้ข้อมูลจากสวน */
const GM_SHOWN = GM_GROUPS.filter(g => !/^รอใส่/.test(g.h));

function gmBody(){
  const pins = [
    ...GM_SHOWN.filter(g=>g.x!=null).map(g=>`<button class="gm-pin" style="left:${g.x}%;top:${g.y}%" data-tab="groups" data-id="${g.n}" aria-label="${g.t}">${gmBadge(g)}<span class="gm-tip">${g.t}</span></button>`),
    ...GM_PLACES.map(p=>`<button class="gm-pin" style="left:${p.x}%;top:${p.y}%" data-tab="places" data-id="${p.id}" aria-label="${p.t}">${gmBadge(p)}<span class="gm-tip">${p.t}</span></button>`)
  ].join("");
  return `
  <div class="gm-map">
    <img src="images/map.jpg" alt="แผนผังสวนสมุนไพร" onerror="this.parentElement.classList.add('nomap');this.remove()">
    ${pins}
  </div>
  <div class="gm-tabs" role="tablist">
    <button class="on" data-t="groups" role="tab">กลุ่มสรรพคุณสมุนไพร</button>
    <button data-t="places" role="tab">อาคารและสถานที่แนะนำ</button>
  </div>
  <div class="gm-list gm-groups" id="gmGroups">
    ${GM_SHOWN.map(g=>`<div class="gm-item" id="gm-groups-${g.n}">${gmBadge(g)}<div><h4>${g.t}</h4><p>${g.h}</p></div></div>`).join("")}
  </div>
  <div class="gm-list gm-places" id="gmPlaces" hidden>
    ${GM_PLACES.map(p=>`<div class="gm-item" id="gm-places-${p.id}">${gmBadge(p)}<div><h4>${p.t}</h4>${p.d?`<p>${p.d}</p>`:""}</div></div>`).join("")}
  </div>`;
}

function gmTab(t){
  document.querySelectorAll(".gm-tabs button").forEach(b=>b.classList.toggle("on", b.dataset.t===t));
  document.getElementById("gmGroups").hidden = t!=="groups";
  document.getElementById("gmPlaces").hidden = t!=="places";
}

const GARDEN_MAP = {
  t: "แผนผังสวนสมุนไพร",
  c: "ข้อมูลสวนสมุนไพร",
  noHero: true,
  center: true,
  body: gmBody,
  run(){
    document.querySelectorAll(".gm-tabs button").forEach(b=>b.onclick=()=>gmTab(b.dataset.t));
    document.querySelectorAll(".gm-pin").forEach(pin=>pin.onclick=()=>{
      gmTab(pin.dataset.tab);
      const el = document.getElementById(`gm-${pin.dataset.tab}-${pin.dataset.id}`);
      if (!el) return;
      el.scrollIntoView({behavior:"smooth", block:"center"});
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    });
  }
};
