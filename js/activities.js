/* =========================================================
   หน้า "โครงการและกิจกรรม"  (/activities)  และหน้าอ่าน (/activity/<id>)
   วันที่ใช้รูปแบบ วว/ดด/ปปปป (ค.ศ.)   รูปวางไว้ใน images/
   contain:true = แสดงรูปทั้งภาพบนพื้นขาว (เหมาะกับโลโก้)
   ========================================================= */
const ACTIVITIES = [
  { type:"งาน อพ.สธ.", date:"17/04/2026", title:"สืบสานพระราชปณิธาน รักษาฐานทรัพยากรแผ่นดิน",
    excerpt:"จุดเริ่มต้น และ เป้าหมายของโครงการ อพ.สธ.-ปตท.", img:"images/activity1.jpg", contain:true,
    body:"<p>เนื้อหาตัวอย่าง — ใส่รายละเอียดโครงการจริงที่นี่</p>" },
  { type:"อบรม/เวิร์คช็อป", date:"27/01/2026", title:"ยาดมจันทน์เทศ",
    excerpt:"", img:"images/activity2.jpg", body:"<p>เนื้อหาตัวอย่าง</p>" },
  { type:"Sport Complex", date:"22/01/2026", title:"Sport Complex",
    excerpt:"", img:"images/activity3.jpg", body:"<p>เนื้อหาตัวอย่าง</p>" },
  { type:"ตลาด", date:"22/01/2026", title:"ตลาดในสวน@สวนสมุนไพรสมเด็จพระเทพฯ",
    excerpt:"กิจกรรมตลาดในสวน@สวนสมุนไพรสมเด็จพระเทพฯ จัดขึ้นทุกวันเสาร์-อาทิตย์สัปดาห์แรกของเดือน", img:"images/activity4.jpg",
    body:"<p>เนื้อหาตัวอย่าง</p>" }
];

/* ปฏิทิน: รายการเพิ่มเติมจากหน้าแอดมิน (กิจกรรม / ตลาดนัด / ปิดทำการ) และการตั้งค่า — โหลดจากเซิร์ฟเวอร์ใน js/api.js */
const CAL_EVENTS = [];
const CAL_SETTINGS = { market_auto: "1", closed_monday: "1" };
const CAL_KIND = { event: "กิจกรรม", market: "ตลาดนัด", closed: "ปิดทำการ" };

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const actChev = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>`;
const actSel = (id, opts, w) => `<span class="field act-sel" style="min-width:${w}px"><select id="${id}">${opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join("")}</select>${actChev}</span>`;

function actCardH(a, i){
  return `<a class="act-card" href="#/activity/${a.id}">
    <div class="act-img${a.contain?" contain":""}" style="background-image:url('${a.img}')"></div>
    <div class="act-info">
      <div class="act-meta"><span class="act-tag">${a.type}</span><span class="act-bar"></span><span class="act-date">${a.date}</span></div>
      <h3>${a.title}</h3>
      ${a.excerpt?`<p>${a.excerpt}</p>`:""}
      <span class="act-more">อ่านเพิ่มเติม →</span>
    </div>
  </a>`;
}

const ACTIVITIES_PAGE = {
  t: "โครงการและกิจกรรม",
  bg: "linear-gradient(160deg,#5d7a8c,#9fb3a0)",
  img: "images/activities.jpg",
  stack: true,
  filters(){
    const types = [...new Set(ACTIVITIES.map(a=>a.type))];
    const years = [...new Set(ACTIVITIES.map(a=>a.date.split("/")[2]))].sort().reverse();
    return `
      <label>หมวดหมู่กิจกรรม <span class="field" style="min-width:286px"><input id="actQ" placeholder="ระบุคำค้นหา"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span></label>
      <label>ประเภทกิจกรรม ${actSel("actType", [["","ทั้งหมด"], ...types.map(t=>[t,t])], 296)}</label>
      <label>วันที่จัดกิจกรรม ${actSel("actMonth", [["","ทุกเดือน"], ...TH_MONTHS.map((m,i)=>[String(i+1).padStart(2,"0"), monthName(i)])], 138)}</label>
      ${actSel("actYear", [["","ทุกปี"], ...years.map(y=>[y,y])], 138)}`;
  },
  body: () => `<div class="act-grid" id="actList"></div>`,
  run(){
    const f = () => {
      const q = $("#actQ").value.trim().toLowerCase(), t = $("#actType").value, m = $("#actMonth").value, y = $("#actYear").value;
      const html = ACTIVITIES.map((a,i)=>[a,i]).filter(([a])=>{
        const [, mm, yy] = a.date.split("/");
        return (!q || (a.title+a.excerpt+a.type).toLowerCase().includes(q)) && (!t || a.type===t) && (!m || mm===m) && (!y || yy===y);
      }).map(([a,i])=>actCardH(a,i)).join("");
      $("#actList").innerHTML = html || `<p class="empty">ไม่พบกิจกรรมที่ตรงกับเงื่อนไข</p>`;
    };
    $("#actQ").oninput = f;
    ["#actType","#actMonth","#actYear"].forEach(s => $(s).onchange = f);
    f();
  }
};

/* หน้าอ่านรายละเอียดกิจกรรม */
function activityRoute(id){
  const a = ACTIVITIES.find(x => String(x.id) === String(id));
  if (!a) return null;
  return {
    t: a.title, c: "โครงการและกิจกรรม", bg: "linear-gradient(160deg,#5d7a8c,#9fb3a0)", img: a.contain ? "images/activities.jpg" : a.img,
    body: () => `<article class="prose">
      <div class="act-meta" style="margin-bottom:20px"><span class="act-tag">${a.type}</span><span class="act-bar"></span><span class="act-date">${a.date}</span></div>
      ${a.excerpt?`<p class="art-lead">${a.excerpt}</p>`:""}${a.thOnly?`<p class="en-only-th">This page is currently available in Thai only.</p>`:""}${richText(a.body)}
      <p style="margin-top:40px"><a class="btn btn-g" href="#/activities">← กลับไปหน้าโครงการและกิจกรรม</a></p></article>`
  };
}

/* =========================================================
   หน้าแรก: แท็บโครงการและกิจกรรม
   ========================================================= */
const HOME_ACT_TABS = ["Sport Complex", "สนามฟุตบอล", "ตลาด", "งาน อพ.สธ."];
let homeActTab = HOME_ACT_TABS[0];
function homeActsRun(){
  const tabs = document.getElementById("haTabs"), list = document.getElementById("haList");
  if (!tabs) return;
  /* data-v = ค่าไทยเดิม (ข้อความบนปุ่มอาจถูกแปลเป็นภาษาอังกฤษ) */
  tabs.innerHTML = HOME_ACT_TABS.map(t=>`<button class="${t===homeActTab?"on":""}" role="tab" data-v="${t}">${t}</button>`).join("");
  tabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{ homeActTab=b.dataset.v; homeActsRun(); });
  const items = ACTIVITIES.map((a,i)=>[a,i]).filter(([a])=>a.type===homeActTab).slice(0,2);
  list.innerHTML = items.length ? items.map(([a,i])=>actCardH(a,i)).join("") : `<p class="empty">ยังไม่มีกิจกรรมในหมวดนี้</p>`;
}

/* =========================================================
   ปฏิทินกิจกรรม (การ์ดสีม่วง) — ใช้ทั้งหน้าแรกและหน้า #/calendar
   วันที่มีกิจกรรมดึงจาก ACTIVITIES อัตโนมัติ
   ========================================================= */
const TH_DOW = ["จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์","อาทิตย์"];
function purpleCal(root){
  const d = new Date(); d.setDate(1);
  root.innerHTML = `<div class="pcal-stack"><div class="pcal">
    <div class="pcal-head"><b class="pcal-title"></b><div><button class="pcal-prev" aria-label="เดือนก่อนหน้า"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="m15 6-6 6 6 6"/></svg></button><button class="pcal-next" aria-label="เดือนถัดไป"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></button></div></div>
    <div class="pcal-dow">${TH_DOW.map(x=>`<span>${x}</span>`).join("")}</div>
    <div class="pcal-grid"></div>
  </div></div>
  <div class="pcal-legend"><span><i class="lg-today"></i>วันปัจจุบัน</span><span><i class="lg-market"></i>ตลาดนัด</span><span><i class="lg-event"></i>กิจกรรม</span><span><i class="lg-closed"></i>ปิดทำการ</span></div>
  <div class="pcal-info" hidden></div>`;
  let items = {};
  const draw = () => {
    const y = d.getFullYear(), m = d.getMonth(), t = new Date();
    const first = (new Date(y,m,1).getDay()+6)%7, days = new Date(y,m+1,0).getDate(), prev = new Date(y,m,0).getDate();
    const cells = [];
    for (let i=first-1;i>=0;i--) cells.push({n:prev-i, off:true});
    for (let i=1;i<=days;i++) cells.push({n:i});
    let k=1; while (cells.length%7) cells.push({n:k++, off:true});

    /* รวมทุกอย่างที่เกิดในแต่ละวันของเดือนนี้: {kind, title, detail, href} */
    items = {};
    const add = (day, it) => { const l = (items[day] ||= []); if (!l.some(x=>x.title===it.title && x.kind===it.kind)) l.push(it); };
    ACTIVITIES.forEach((a,i)=>{ const [dd,mm,yy]=a.date.split("/").map(Number);
      if (yy===y && mm===m+1) add(dd, {kind:a.type==="ตลาด"?"market":"event", title:a.title, detail:a.excerpt, href:`#/activity/${a.id}`}); });
    CAL_EVENTS.forEach(e=>{   /* กิจกรรมจากหน้าแอดมิน (หลายวันได้) */
      const s = new Date(e.date+"T00:00"), end = new Date((e.end_date||e.date)+"T00:00");
      for (let x=new Date(s), n=0; x<=end && n<370; x.setDate(x.getDate()+1), n++)
        if (x.getFullYear()===y && x.getMonth()===m) add(x.getDate(), {kind:e.kind, title:e.title, detail:e.detail, href:e.link});
    });
    if (CAL_SETTINGS.closed_monday === "1"){   /* ปิดทำการทุกวันจันทร์ */
      for (let x=1; x<=days; x++) if (new Date(y,m,x).getDay()===1)
        add(x, {kind:"closed", title:"สวนสมุนไพรปิดทำการ (ทุกวันจันทร์)", detail:"พื้นที่ออกกำลังกายยังเปิดตามปกติ ทุกวัน 06.00–20.00 น.", href:"#/contact"});
    }
    if (CAL_SETTINGS.market_auto === "1"){   /* ตลาดนัดอัตโนมัติ: เสาร์–อาทิตย์ สัปดาห์แรกของเดือน */
      const sat = 1 + ((6 - new Date(y,m,1).getDay() + 7) % 7), mk = ACTIVITIES.find(a=>a.type==="ตลาด");
      [sat, sat+1].filter(x=>x<=days).forEach(x=>add(x, {kind:"market", title:"ตลาดในสวน", detail:"ทุกเสาร์–อาทิตย์สัปดาห์แรกของเดือน", href: mk?`#/activity/${mk.id}`:""}));
    }

    root.querySelector(".pcal-title").textContent = `${monthName(m)} ${yearDisp(y)}`;
    root.querySelector(".pcal-grid").innerHTML = cells.map(c=>{
      if (c.off) return `<span class="off">${c.n}</span>`;
      const isT = t.getFullYear()===y && t.getMonth()===m && t.getDate()===c.n;
      const e = items[c.n] || [], has = kd => e.some(x=>x.kind===kd);
      const cls = isT ? "today" : has("closed") ? "cl" : has("event") ? "ev" : has("market") ? "mk" : "";
      return e.length ? `<button class="${cls}" data-day="${c.n}" title="${e.map(x=>x.title).join(" / ").replace(/"/g,"&quot;")}">${c.n}</button>`
                      : `<span class="${cls}">${c.n}</span>`;
    }).join("");
    root.querySelector(".pcal-info").hidden = true;
  };
  /* กดวันที่ → แสดงรายละเอียดใต้ปฏิทิน */
  root.querySelector(".pcal-grid").onclick = e => {
    const b = e.target.closest("button[data-day]"); if (!b) return;
    root.querySelectorAll(".pcal-grid .sel").forEach(x=>x.classList.remove("sel")); b.classList.add("sel");
    const day = +b.dataset.day, info = root.querySelector(".pcal-info");
    info.innerHTML = `<b>${day} ${monthName(d.getMonth())} ${yearDisp(d.getFullYear())}</b>` + items[day].map(it=>`
      <div class="pi ${it.kind}"><i></i><div><span class="k">${CAL_KIND[it.kind]||""}</span> ${it.title}${it.detail?`<p>${it.detail}</p>`:""}
        ${it.href?`<a href="${it.href}"${/^https?:/.test(it.href)?' target="_blank" rel="noopener"':""}>ดูรายละเอียด →</a>`:""}</div></div>`).join("");
    info.hidden = false;
  };
  root.querySelector(".pcal-prev").onclick = () => { d.setMonth(d.getMonth()-1); draw(); };
  root.querySelector(".pcal-next").onclick = () => { d.setMonth(d.getMonth()+1); draw(); };
  draw();
}