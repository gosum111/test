/* ---------------- HELPERS ---------------- */
const $=s=>document.querySelector(s);
const searchIcon=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;
const chev=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>`;
const herbCard=h=>`<article class="card"><div class="img">${h[3]}</div><div class="body"><h3>${h[0]}</h3><i>${h[1]}</i><p>${h[4]}</p><span class="tag">${h[2]}</span></div></article>`;
const actCard=a=>`<article class="card"><div class="img" style="background:linear-gradient(135deg,#b49ad6,#6f4c9b)">${a[2]}</div><div class="body"><span class="meta">${a[1]}</span><h3>${a[0]}</h3><p>${a[3]}</p></div></article>`;
const filterSearch=(ph)=>`<label>ค้นหา <span class="field"><input id="fq" placeholder="${ph||"ระบุคำค้นหา"}">${searchIcon}</span></label>`;
const filterSelect=(label,opts)=>`<label>${label} <span class="field" style="min-width:186px"><select id="fs">${opts.map(o=>`<option>${o}</option>`).join("")}</select>${chev}</span></label>`;

/* ---------------- ROUTES ---------------- */
const BG={brochure:"linear-gradient(160deg,#3d6b2c,#86ad5e)",acts:"linear-gradient(160deg,#5d7a8c,#9fb3a0)",herb:"linear-gradient(160deg,#2f5a24,#7da95a)",about:"linear-gradient(160deg,#6f4c9b,#b8a3d6)"};
const ROUTES={
 "/about/history":{t:"ประวัติความเป็นมา",c:"เกี่ยวกับเรา",bg:BG.about,img:"images/about.jpg",body:()=>`<div class="prose"><div class="note">เนื้อหาตัวอย่าง — กรุณาแทนที่ด้วยประวัติจริงของสวน</div><p>สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี จัดตั้งขึ้นเพื่อเป็นแหล่งรวบรวม อนุรักษ์ และเผยแพร่ความรู้ด้านสมุนไพรไทย ซึ่งเป็นภูมิปัญญาที่มีคุณค่าเอนกอนันต์</p><div class="timeline"><div><b>ปีที่ก่อตั้ง</b><p>ระบุเหตุการณ์สำคัญ</p></div><div><b>ปีที่ขยายพื้นที่</b><p>ระบุเหตุการณ์สำคัญ</p></div><div><b>ปัจจุบัน</b><p>รวบรวมพันธุ์สมุนไพรมากกว่า 509 ชนิด บนเนื้อที่ 60 ไร่</p></div></div></div>`},
 "/about/building":{t:"อาคารเฉลิมพระเกียรติ 50 พรรษา",c:"เกี่ยวกับเรา",bg:BG.about,img:"images/building.jpg",body:()=>`<div class="prose"><div class="note">เนื้อหาตัวอย่าง — กรุณาแทนที่ด้วยข้อมูลจริง</div><p>รายละเอียดอาคาร ห้องนิทรรศการ และพื้นที่ใช้สอยภายในอาคาร</p></div>`},
 "/about/awards":{t:"รางวัลที่ได้รับ",c:"เกี่ยวกับเรา",bg:BG.about,img:"images/awards.jpg",body:()=>`<div class="prose"><div class="note">เนื้อหาตัวอย่าง — กรุณาแทนที่ด้วยรายการรางวัลจริง</div><div class="timeline"><div><b>ชื่อรางวัล</b><p>หน่วยงานที่มอบ · ปี</p></div><div><b>ชื่อรางวัล</b><p>หน่วยงานที่มอบ · ปี</p></div></div></div>`},
 "/herb/search":HERB_SEARCH, /* อยู่ในไฟล์ js/herb-search.js */
 "/herb/articles":{t:"บทความสมุนไพร",c:"ข้อมูลสวนสมุนไพร",bg:BG.herb,img:"images/articles.jpg",filters:()=>filterSearch(),
   body:()=>`<div class="art-grid" id="artList"></div>`,
   run(){const f=()=>{const q=$("#fq").value.trim().toLowerCase();const r=ARTICLES.map((a,i)=>[a,i]).filter(([a])=>(a.title+a.excerpt).toLowerCase().includes(q));
     $("#artList").innerHTML=r.map(([a,i])=>`<a class="art" href="#/herb/article/${a.id}"><div class="art-img" style="background-image:url('${a.img}')"><span class="art-more">อ่านเพิ่มเติม</span></div>${a.date?`<span class="art-date">${a.date}</span>`:""}<h3>${a.title}</h3>${a.excerpt?`<p>${a.excerpt}</p>`:""}</a>`).join("")||`<p class="empty">ไม่พบบทความ</p>`};
     $("#fq").oninput=f;f()}},
 "/herb/map":GARDEN_MAP, /* อยู่ในไฟล์ js/garden-map.js */
 "/news":{t:"ข่าวประชาสัมพันธ์",c:null,bg:BG.acts,img:"images/news.jpg",filters:()=>filterSearch(),
   body:()=>`<div class="news-grid" id="newsList" style="padding-bottom:100px"></div>`,
   run(){const f=()=>{const q=$("#fq").value.trim().toLowerCase();const r=NEWS.filter(n=>(n[0]+" "+n[1]+" "+n[2]).toLowerCase().includes(q));
     $("#newsList").innerHTML=r.map(newsCard).join("")||`<p class="empty">ไม่พบข่าวที่ค้นหา</p>`};$("#fq").oninput=f;f()}},
 "/brochure":{t:"โบรชัวร์",c:null,bg:BG.brochure,img:"images/brochure.jpg",filters:()=>filterSearch()+filterSelect("ประเภทโบรชัวร์",["ทั้งหมด","แนะนำ","แผนที่","สมุนไพร","กิจกรรม"]),
   body:()=>`<div class="cards" id="list" style="padding-bottom:100px"></div>`,
   run(){const f=()=>{const q=$("#fq").value.trim(),c=$("#fs").value;
     /* แสดงเฉพาะโบรชัวร์ที่มีไฟล์ PDF แล้ว */
     if(!BROCHURES.some(b=>b[2])){$("#list").innerHTML=`<p class="empty">ขณะนี้ยังไม่มีโบรชัวร์ให้ดาวน์โหลด สอบถามข้อมูลเพิ่มเติมได้ที่ ${escHtml(sitePhone())}</p>`;return}
     const r=BROCHURES.filter(b=>b[2]&&(c==="ทั้งหมด"||b[1]===c)&&b[0].includes(q));$("#list").innerHTML=r.map(b=>`<article class="card"><div class="img" style="aspect-ratio:3/4">📄</div><div class="body"><span class="meta">${b[1]}</span><h3>${b[0]}</h3>${b[2]?`<a class="btn btn-g" style="margin-top:10px;align-self:flex-start;padding:8px 22px" href="${b[2]}" target="_blank" rel="noopener">ดาวน์โหลด PDF</a>`:`<span class="meta" style="margin-top:10px">ยังไม่มีไฟล์ให้ดาวน์โหลด</span>`}</div></article>`).join("")||`<p class="empty">ไม่พบข้อมูล</p>`};$("#fq").oninput=f;$("#fs").onchange=f;f()}},
 "/activities":ACTIVITIES_PAGE, /* อยู่ในไฟล์ js/activities.js */
 "/contact":{t:"ติดต่อเรา",c:null,bg:BG.herb,img:"images/contact.jpg",body:contactBody,run:contactRun},
 "/cookie":{t:"นโยบายคุกกี้",c:null,bg:BG.about,img:"",body:()=>`<div class="prose"><div class="note">กรุณาใส่นโยบายคุกกี้ฉบับจริง</div><p>เว็บไซต์นี้ใช้คุกกี้เพื่อจดจำการตั้งค่าและปรับปรุงประสบการณ์การใช้งาน ท่านสามารถเลือกยอมรับหรือปฏิเสธได้จากแถบแจ้งเตือนด้านล่างของหน้าเว็บ</p></div>`}
};

/* หน้า "ติดต่อเรา": แสดง/ซ่อนข้อมูลติดต่อและแผนที่ได้จากหน้าแอดมิน (แท็บ ⚙️ ตั้งค่าเว็บไซต์) */
function contactBody(){
 const showInfo=SITE.site_show_info==="1", showMap=SITE.site_show_map==="1"&&SITE.site_map_query;
 const nl=s=>escHtml(s).replace(/\n/g,"<br>");
 return `<div class="contact${showInfo||showMap?"":" form-only"}">
 ${showInfo||showMap?`<div class="info">
  ${showInfo ? `
  ${SITE.site_address?`<div class="row"><span class="ic">📍</span><div><b>ที่อยู่</b><p>${nl(SITE.site_address)}</p></div></div>`:""}
  ${sitePhones().length?`<div class="row"><span class="ic">☎</span><div><b>โทรศัพท์</b>${sitePhones().map(telLink).join(", ")}</div></div>`:""}
  ${SITE.site_email?`<div class="row"><span class="ic">✉</span><div><b>อีเมล</b><a href="mailto:${escHtml(SITE.site_email)}">${escHtml(SITE.site_email)}</a></div></div>`:""}
  ${SITE.site_hours?`<div class="row"><span class="ic">🕘</span><div><b>เวลาทำการ</b><p>${nl(SITE.site_hours)}</p></div></div>`:""}` : ""}
  ${showMap ? `<div class="map"><iframe loading="lazy" title="แผนที่" src="https://maps.google.com/maps?q=${encodeURIComponent(SITE.site_map_query)}&z=13&output=embed"></iframe></div>` : ""}
 </div>`:""}
 <form class="cf" id="cf">
  <h2 style="font-size:28px">ส่งข้อความถึงเรา</h2>
  <p class="demo-note" data-demo-only>⚠ เว็บไซต์ทดลอง: ข้อความที่ส่งจะเก็บไว้ในระบบทดลองเท่านั้น <b>ไม่ถึงเจ้าหน้าที่ของสวนจริง</b></p>
  <div class="two"><label>ชื่อ-นามสกุล *<input name="name" required maxlength="120"></label><label>เบอร์โทรศัพท์ *<input name="phone" required type="tel" maxlength="30"></label></div>
  <div class="two"><label>อีเมล<input name="email" type="email" maxlength="120"></label><label>หัวข้อ<select name="topic"><option>เยี่ยมชม/ศึกษาดูงาน</option><option>Workshop</option><option>สอบถามข้อมูลสมุนไพร</option><option>Sport Complex / จองสนามฟุตบอล</option><option>อื่นๆ</option></select></label></div>
  <label>รายละเอียด<textarea name="detail" rows="5" maxlength="3000"></textarea></label>
  <label class="hp" aria-hidden="true">ห้ามกรอกช่องนี้<input name="website" tabindex="-1" autocomplete="off"></label>
  <label class="chk"><input type="checkbox" required> ข้าพเจ้าได้อ่านและยอมรับนโยบายคุ้มครองข้อมูลส่วนบุคคล</label>
  <button class="btn btn-p" style="justify-self:start">ส่งข้อความ</button>
  <p class="ok" id="ok">✓ ส่งข้อความเรียบร้อย เจ้าหน้าที่จะติดต่อกลับโดยเร็ว</p>
  <p class="ok" id="cfErr" style="color:#c0392b"></p>
 </form></div>`}
/* ส่วนท้ายเว็บ: ที่อยู่ โทร อีเมล และปุ่มโซเชียล จากข้อมูลใน SITE */
function renderSiteInfo(){
  const fc=$("#footContact"),fs=$("#footSocial");
  if(fc) fc.innerHTML=[escHtml(SITE.site_address).replace(/\n/g,"<br>"),
    sitePhones().length?"โทร "+sitePhones().map(telLink).join(", "):"",
    SITE.site_email?`<a href="mailto:${escHtml(SITE.site_email)}">${escHtml(SITE.site_email)}</a>`:""].filter(Boolean).join("<br>");
  if(fs) fs.innerHTML=[[SITE.site_facebook,"Facebook","f"],[SITE.site_youtube,"YouTube","▶"],[SITE.site_line,"LINE","L"]]
    .filter(([u])=>/^https:\/\//.test(u||"")).map(([u,l,t])=>`<a href="${escHtml(u)}" target="_blank" rel="noopener" aria-label="${l}">${t}</a>`).join("")
    +(SITE.site_email?`<a href="mailto:${escHtml(SITE.site_email)}" aria-label="Email">@</a>`:"");
}

function contactRun(){$("#cf").dataset.start=Date.now();$("#cf").onsubmit=async e=>{
  e.preventDefault();const f=e.target,btn=f.querySelector("button");
  $("#ok").style.display="none";$("#cfErr").style.display="none";btn.disabled=true;
  try{await apiSendContact(f);$("#ok").style.display="block";f.reset()}
  catch(err){$("#cfErr").textContent="✗ "+err.message;$("#cfErr").style.display="block"}
  finally{btn.disabled=false}
}}

function calendar(){
  let d=new Date();d.setDate(1);
  const M=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const draw=()=>{
    const y=d.getFullYear(),m=d.getMonth(),first=d.getDay(),days=new Date(y,m+1,0).getDate(),t=new Date();
    $("#cm").textContent=`${M[m]} ${y+543}`;
    let h=["อา","จ","อ","พ","พฤ","ศ","ส"].map(x=>`<div class="dow">${x}</div>`).join("");
    for(let i=0;i<first;i++)h+=`<div class="off"></div>`;
    for(let i=1;i<=days;i++){
      const wd=(first+i-1)%7,isT=t.getFullYear()===y&&t.getMonth()===m&&t.getDate()===i;
      let ev="";
      if(wd===1)ev=`<span class="closed">ปิดทำการ</span>`;
      else if(wd===6||wd===0)ev=`<span class="ev">ตลาดชุมชน</span>`;
      if(i===15)ev+=`<span class="ev">Workshop</span>`;
      h+=`<div class="${isT?"today":""}">${i}${ev}</div>`;
    }
    $("#cg").innerHTML=h;
  };
  $("#pm").onclick=()=>{d.setMonth(d.getMonth()-1);draw()};
  $("#nm").onclick=()=>{d.setMonth(d.getMonth()+1);draw()};
  draw();
}

/* ---------------- URL ----------------
   เปิดผ่านเซิร์ฟเวอร์ → ลิงก์จริง เช่น /news/3, /activity/5 (แชร์ได้ / Google เก็บได้)
   เปิดไฟล์ตรง ๆ (file://) → ใช้ #/news/3 แบบเดิม
   ในโค้ดยังเขียนลิงก์เป็น "#/..." ได้ตามเดิม ระบบแปลงเป็นลิงก์จริงให้อัตโนมัติ */
const PATH_MODE=location.protocol.startsWith("http");
function curPath(){
  if(!PATH_MODE) return location.hash.replace(/^#/,"")||"/";
  const p=decodeURIComponent(location.pathname).replace(/\/index\.html$/,"/");
  return p.length>1?p.replace(/\/+$/,""):"/";
}
function navigate(p,replace){
  if(!PATH_MODE){location.hash="#"+p;return}
  history[replace?"replaceState":"pushState"](null,"",p);go();
}
if(PATH_MODE&&location.hash.startsWith("#/")) history.replaceState(null,"",location.hash.slice(1));   /* ลิงก์เก่า /#/news → /news */
function fixLinks(root){
  if(!PATH_MODE||!root.querySelectorAll) return;
  root.querySelectorAll('a[href^="#/"]').forEach(a=>a.setAttribute("href",a.getAttribute("href").slice(1)));
}
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)fixLinks(n.parentNode||n)}))).observe(document.body,{childList:true,subtree:true});
fixLinks(document);
/* กดลิงก์ภายในเว็บ → เปลี่ยนหน้าโดยไม่โหลดใหม่ */
document.addEventListener("click",e=>{
  if(!PATH_MODE||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  const a=e.target.closest("a[href]"); if(!a||a.target||a.hasAttribute("download")) return;
  let href=a.getAttribute("href");
  if(href.startsWith("#/")) href=href.slice(1);
  if(!href.startsWith("/")||href.startsWith("//")||href.startsWith("/api/")||/\.[a-z0-9]{2,5}$/i.test(href)) return;
  e.preventDefault();
  navigate(href);
});
addEventListener("popstate",go);
const DEFAULT_TITLE=document.title;

/* ---------------- ROUTER ---------------- */
function go(){
  let p=curPath();
  /* ปฏิทินกิจกรรมอยู่บนหน้าหลัก: เปลี่ยนที่อยู่กลับเป็นหน้าหลัก แล้วค่อยเลื่อนลงไป */
  const scrollCal=p==="/calendar";
  if(scrollCal){p="/";history.replaceState(null,"",PATH_MODE?"/":"#/");}
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("on"));
  document.querySelectorAll(".menu>li").forEach(li=>{li.classList.remove("open");li.classList.toggle("active",li.dataset.p==="/"?p==="/":p.startsWith(li.dataset.p))});
  $("#menu").classList.remove("show");
  /* หน้ารายละเอียด: ลิงก์อ้างอิงเลขประจำรายการ (id) → เพิ่มรายการใหม่แล้วลิงก์เดิมไม่เปลี่ยน */
  const byId=(list,id,get=x=>x.id)=>list.find(x=>String(get(x))===id);
  const vm=p.match(/^\/activity\/(\d+)$/);
  if(vm){const r=activityRoute(vm[1]);if(r)ROUTES[p]=r;}
  const am=p.match(/^\/herb\/article\/(\d+)$/), a=am&&byId(ARTICLES,am[1]);
  if(a){ROUTES[p]={t:a.title,c:"บทความสมุนไพร",bg:BG.herb,img:a.img,
    body:()=>`<article class="prose">${a.date?`<p class="art-date">${a.date}</p>`:""}${a.excerpt?`<p class="art-lead">${a.excerpt}</p>`:""}${richText(a.body)}<p style="margin-top:40px"><a class="btn btn-g" href="#/herb/articles">← กลับไปหน้าบทความ</a></p></article>`};}
  const nm=p.match(/^\/news\/(\d+)$/), n=nm&&byId(NEWS,nm[1],x=>x[4]);
  if(n){ROUTES[p]={t:n[0],c:"ข่าวประชาสัมพันธ์",bg:BG.acts,img:n[3],
    body:()=>`<article class="prose">${n[1]?`<p class="art-date">${n[1]}</p>`:""}${n[2]?richText(n[2]):""}<p style="margin-top:40px"><a class="btn btn-g" href="#/news">← กลับไปหน้าข่าวประชาสัมพันธ์</a></p></article>`};}
  const hm=p.match(/^\/herb\/plant\/(\d+)$/), h=hm&&byId(HERB_DB,hm[1]);
  /* หน้าพืช (ปลายทางของป้าย QR ที่ต้นไม้): ไม่มีภาพหัวหน้า → สแกนแล้วเห็นรูปและข้อมูลทันที */
  if(h){ROUTES[p]={t:h.th,c:"ค้นหาสมุนไพร",noHero:true,body:()=>herbPage(h)};}
  else if(hm){ROUTES[p]=PATH_MODE&&!window.DATA_LOADED
    ? {t:"กำลังโหลดข้อมูลพืช…",c:"ค้นหาสมุนไพร",noHero:true,body:()=>`<p class="empty">กำลังโหลด…</p>`}
    : {t:"ไม่พบข้อมูลพืชนี้",c:"ค้นหาสมุนไพร",noHero:true,body:()=>`<div class="prose"><p>ขออภัย ไม่พบข้อมูลพืชตามลิงก์หรือป้าย QR นี้ ข้อมูลอาจถูกย้ายหรือปรับปรุงแล้ว</p>
        <p>ค้นหาพืชที่ต้องการได้จากหน้าค้นหาสมุนไพร หรือสอบถามเจ้าหน้าที่ได้ที่ ${escHtml(sitePhone())}</p>
        <p style="margin-top:30px"><a class="btn btn-g" href="#/herb/search">ไปหน้าค้นหาสมุนไพร →</a></p></div>`};}
  if(scrollCal){
    $('[data-page="/"]').classList.add("on");homeRun();header();document.title=DEFAULT_TITLE;
    const toCal=()=>{if(curPath()!=="/")return;const s=$(".cal-sec");window.scrollTo({top:s.getBoundingClientRect().top+scrollY,behavior:"instant"});header()};
    requestAnimationFrame(toCal);
    if(document.fonts)document.fonts.ready.then(toCal);
    setTimeout(toCal,400);
    return;
  }
  if(p==="/"||!ROUTES[p]){$('[data-page="/"]').classList.add("on");homeRun();document.title=DEFAULT_TITLE;}
  else{
    const r=ROUTES[p];
    document.title=`${r.t} | สวนสมุนไพรสมเด็จพระเทพฯ`;
    $('[data-page="sub"]').classList.add("on");
    $("#subHero").style.background=(r.img?`url("${r.img}") center/cover no-repeat, `:"")+(r.bg||"");
    $("#subHero").hidden=!!r.noHero;
    $('[data-page="sub"]').classList.toggle("no-hero",!!r.noHero);
    $("#crumb").innerHTML=`<a href="#/">หน้าหลัก</a><span class="sep"></span>`+(r.c?`<span>${r.c}</span><span class="sep"></span>`:"")+`<span class="cur">${r.t}</span>`;
    $("#subTitle").textContent=r.t;
    $("#subDesc").textContent=r.desc||"";
    document.querySelector(".page-head").classList.toggle("centered",!!(r.desc||r.center));
    document.querySelector(".page-head").classList.toggle("stacked",!!r.stack);
    $("#subFilters").innerHTML=r.filters?r.filters():"";
    $("#subBody").innerHTML=r.body();
    r.run&&r.run();
    document.querySelectorAll("[data-demo-only]").forEach(el=>el.hidden=!window.DEMO);
  }
  window.scrollTo(0,0);
  header();
}
let cat="ทั้งหมด";
function homeRun(){
  homeActsRun();
  workshopRun();
  provincesRun();
  purpleCal($("#homeCal"));
  $("#homeNews").innerHTML=NEWS.slice(0,3).map(newsCard).join("");
  /* บริการ: การ์ดเลื่อนด้วยลูกศร */
  const tr=$("#svcTrack");
  tr.innerHTML=SERVICES.map(s=>`<a class="svc-card" href="${s.link}" style="background-image:url('${s.img}')"><h3>${s.title}</h3></a>`).join("");
  const step=()=>{const c=tr.querySelector(".svc-card");return c?c.offsetWidth+25:300};
  $("#svcPrev").onclick=()=>tr.scrollBy({left:-step(),behavior:"smooth"});
  $("#svcNext").onclick=()=>tr.scrollBy({left:step(),behavior:"smooth"});
}
function newsCard(n){
  return `<a class="news" href="#/news${n[4]?"/"+n[4]:""}"><div class="news-img" style="background-image:url('${n[3]}')"><span class="art-more">อ่านเพิ่มเติม</span></div><h3>${n[0]}</h3>${n[2]?`<p>${n[2]}</p>`:""}</a>`;
}

/* dropdowns */
document.querySelectorAll("[data-dd]").forEach(a=>a.addEventListener("click",e=>{
  e.preventDefault();const li=a.parentElement,o=li.classList.contains("open");
  document.querySelectorAll(".menu>li").forEach(x=>x.classList.remove("open"));
  if(!o)li.classList.add("open");
}));
document.addEventListener("click",e=>{if(!e.target.closest(".menu"))document.querySelectorAll(".menu>li").forEach(x=>x.classList.remove("open"))});
$("#burger").onclick=e=>{e.stopPropagation();$("#menu").classList.toggle("show")};
document.querySelectorAll('a[href="#/calendar"]').forEach(a=>a.addEventListener("click",()=>{if(location.hash==="#/calendar")go()}));

/* sticky header after scroll */
function header(){$("#hdr").classList.toggle("solid",scrollY>120)}
addEventListener("scroll",header,{passive:true});

/* hero image fallback: hide .photo if images/hero.jpg missing */
(function(){const i=new Image();i.onerror=()=>document.querySelectorAll(".hero .photo").forEach(p=>p.remove());i.src="images/hero.jpg"})();

/* floating & falling leaves */
(function(){
  let lid=0;
  const leaf=(c1,c2)=>{const id="lf"+(lid++);return `<svg viewBox="0 0 100 50"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#b8e07a"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><path d="M7 27C22 7 62-1 97 20 63 45 24 46 7 27Z" fill="url(#${id})"/><path d="M0 28Q48 25 95 20" stroke="#2d6418" stroke-width="1.5" fill="none" opacity=".55"/><path d="M28 26 38 13M48 24 58 9M68 22 77 11M28 26 40 38M48 24 60 38M68 22 79 33" stroke="#2d6418" stroke-width=".9" opacity=".3" fill="none"/></svg>`};
  const L=$("#leaves"),reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* [ซ้าย%, บน%, กว้างpx, องศา] — วางไว้ริมจอ ไม่ทับหัวข้อ */
  const fixed=[[1,14,70,-20],[3,30,130,35],[12,44,55,60],[7,58,90,-15],[94,22,60,-60],[89,35,100,30],[83,50,50,70],[20,61,60,10]];
  fixed.forEach(([x,y,w,r],i)=>{const d=document.createElement("div");d.className="leaf";d.style.cssText=`left:${x}%;top:${y}%;width:${w}px;--r:${r}deg;animation-delay:${-i*1.3}s;filter:blur(${i%3===2?1.5:0}px)`;d.innerHTML=leaf(i%2?"#7cc04a":"#5ea63a","#3d7a22");L.appendChild(d)});
  if(!reduce)for(let i=0;i<7;i++){const d=document.createElement("div");d.className="leaf fall";d.style.cssText=`left:${Math.random()*95}%;top:0;width:${24+Math.random()*30}px;--dx:${(Math.random()-.5)*300}px;animation-duration:${12+Math.random()*10}s;animation-delay:${-Math.random()*20}s;opacity:.85`;d.innerHTML=leaf("#8ccf5a","#4b8a2a");L.appendChild(d)}
})();

/* cookie banner */
try{if(!localStorage.getItem("cookie"))$("#cookie").hidden=false}catch(e){$("#cookie").hidden=false}
document.querySelectorAll("#cookie button").forEach(b=>b.onclick=()=>{try{localStorage.setItem("cookie",b.dataset.c)}catch(e){}$("#cookie").hidden=true});

/* โหมดเว็บไซต์ทดลอง: แสดงแถบแจ้งเตือน (ค่าเริ่มต้น) — เซิร์ฟเวอร์ตั้ง DEMO_MODE=0 แล้วจะซ่อนให้ */
function applyDemo(on){
  document.body.classList.toggle("demo",on);
  const bar=$("#demoBar");
  if(bar) document.documentElement.style.setProperty("--demo-h",(on?bar.offsetHeight:0)+"px");
  document.querySelectorAll("[data-demo-only]").forEach(el=>el.hidden=!on);
}
window.DEMO=true;
applyDemo(true);
addEventListener("resize",()=>applyDemo(window.DEMO));

/* ข้อมูลสำรอง (เปิดไฟล์ตรง ๆ ไม่มีเซิร์ฟเวอร์) ยังไม่มีเลขประจำรายการ → ใส่ลำดับให้แทน */
NEWS.forEach((n,i)=>{if(n[4]==null)n[4]=i+1});
[ARTICLES,ACTIVITIES,HERB_DB].forEach(l=>l.forEach((x,i)=>{if(x.id==null)x.id=i+1}));

/* หน้าเต็มของพืชแต่ละชนิด (แชร์ลิงก์ได้) */
function herbPage(h){
  /* "วงศ์ FABACEAE · ไม้ยืนต้น..." → แยกวงศ์ออกมาไว้ในกล่องข้อมูลสรุป */
  const fm=(h.desc||"").match(/^วงศ์\s+([^·]+?)\s*·\s*/), family=fm?fm[1]:"", desc=fm?h.desc.slice(fm[0].length):(h.desc||"");
  const row=(k,v)=>v?`<div><dt>${k}</dt><dd>${v}</dd></div>`:"";
  /* พืชในกลุ่มเดียวกัน (หรือภาคเดียวกันสำหรับพันธุ์ไม้มงคล) */
  const g=(h.groups||[])[0];
  const related=HERB_DB.filter(x=>x.id!==h.id&&(g?(x.groups||[]).includes(g):x.region&&x.region===h.region))
    .sort((a,b)=>(!!b.img)-(!!a.img)).slice(0,6);
  return `<article class="plant">
    <div class="plant-top">
      <div class="plant-photo">${h.img?`<img src="${h.img}" alt="${h.th}">${creditLine(h.credit)}`:`<div class="plant-nophoto">🌿<span>ยังไม่มีรูปภาพ</span></div>`}</div>
      <dl class="plant-facts">
        ${row("ชื่อภาษาไทย",h.th)}
        ${row("ชื่อภาษาอังกฤษ",h.en)}
        ${row("ชื่อวิทยาศาสตร์",h.sci?`<i>${h.sci}</i>`:"")}
        ${row("วงศ์",family)}
        ${row("กลุ่มสรรพคุณ",(h.groups||[]).join("<br>"))}
        ${row("พันธุ์ไม้มงคล",h.province?`ประจำจังหวัด${h.province}${h.region?` (${h.region})`:""}`:"")}
        ${row("สถานะการอนุรักษ์",h.status?statusBadge(h.status):"")}
      </dl>
    </div>
    <section class="plant-sec"><h2>ลักษณะทั่วไป</h2><p>${desc||"-"}</p></section>
    <section class="plant-sec"><h2>สรรพคุณและการใช้ประโยชน์</h2><p>${h.use||"-"}</p>
      <p class="hs-warn">* ข้อมูลตามภูมิปัญญาการแพทย์แผนไทย ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้</p></section>
    <div class="plant-act">
      <a class="btn btn-g" href="#/herb/search">← ดูพืชชนิดอื่น</a>
      <button class="btn btn-g" type="button" onclick="sharePlant(this)">🔗 แชร์หน้านี้</button>
    </div>
    ${related.length?`<section class="plant-sec"><h2>${g?`พืชใน${g}`:`พันธุ์ไม้มงคล${h.region}`}</h2><div class="hs-grid">${related.map(plantCard).join("")}</div></section>`:""}
  </article>`;
}
/* แชร์ลิงก์หน้าพืช: มือถือเปิดเมนูแชร์ (LINE ฯลฯ) · คอมพิวเตอร์คัดลอกลิงก์ */
async function sharePlant(btn){
  const url=location.href, title=document.title;
  try{
    if(navigator.share){await navigator.share({title,url});return}
    await navigator.clipboard.writeText(url);btn.textContent="✓ คัดลอกลิงก์แล้ว";
  }catch(e){if(e&&e.name!=="AbortError")prompt("คัดลอกลิงก์นี้:",url)}
}

/* PWA: ให้เว็บใช้ได้ตอนสัญญาณไม่ดี/ไม่มีเน็ต (ดู sw.js) + แถบแจ้งเมื่อออฟไลน์ */
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))
  addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
function offlineBar(){
  const b=$("#offlineBar"),c=$("#cookie");if(!b)return;
  b.hidden=navigator.onLine;
  b.style.bottom=(c&&!c.hidden?c.offsetHeight+12:16)+"px";   /* อยู่เหนือกล่องคุกกี้ ไม่ทับกัน */
}
addEventListener("online",offlineBar);addEventListener("offline",offlineBar);
document.querySelectorAll("#cookie button").forEach(x=>x.addEventListener("click",offlineBar));offlineBar();

$("#yr").textContent=new Date().getFullYear();
addEventListener("hashchange",()=>{if(!PATH_MODE)go()});go();
