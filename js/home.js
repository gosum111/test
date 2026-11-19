/* =========================================================
   หน้าแรก: Workshop carousel + พันธุ์ไม้มงคล 77 จังหวัด
   ========================================================= */

/* ---------- สาธิตผลิตภัณฑ์จากสมุนไพร (Workshop) ---------- */
function workshopRun(){
  const tr = document.getElementById("wsTrack"); if (!tr) return;
  tr.innerHTML = WORKSHOPS.map(w=>`<article class="ws-card"><div class="ws-img" style="background-image:url('${w.img}')"></div><h3>${w.name}</h3>${w.desc?`<p>${w.desc}</p>`:""}</article>`).join("");
  const prev = document.getElementById("wsPrev"), next = document.getElementById("wsNext"), bar = document.getElementById("wsBar");
  const step = () => { const c = tr.querySelector(".ws-card"); return c ? c.offsetWidth + 38 : 400; };
  const update = () => {
    const max = tr.scrollWidth - tr.clientWidth;
    const vis = tr.clientWidth / tr.scrollWidth;
    bar.style.width = (Math.min(1, vis) * 100) + "%";
    bar.style.marginLeft = (max > 0 ? (tr.scrollLeft / tr.scrollWidth) * 100 : 0) + "%";
    prev.disabled = tr.scrollLeft <= 2;
    next.disabled = tr.scrollLeft >= max - 2;
  };
  prev.onclick = () => tr.scrollBy({ left: -step(), behavior: "smooth" });
  next.onclick = () => tr.scrollBy({ left: step(), behavior: "smooth" });
  tr.onscroll = update;
  addEventListener("resize", update);
  update();
}

/* ---------- แผนที ่ประเทศไทยแบบจุด ---------- */
/* โครงร่างประเทศไทยโดยประมาณ (ลองจิจูด, ละติจูด) */
const TH_OUTLINE = [[99.9,20.4],[100.5,20.2],[100.6,19.5],[101.2,19.6],[101.3,18.0],[102.1,17.9],[103.0,18.4],[104.0,18.0],[104.7,17.4],[104.8,16.5],[105.6,15.7],[105.5,14.4],[104.6,14.4],[103.3,14.3],[102.3,13.6],[102.6,12.6],[102.9,11.7],[102.3,12.2],[101.5,12.6],[100.9,12.7],[100.95,13.4],[100.5,13.5],[100.0,13.4],[99.9,12.5],[99.6,11.8],[99.2,10.4],[99.3,9.3],[100.3,8.4],[100.4,7.2],[101.2,6.9],[102.1,6.2],[101.8,5.8],[101.1,5.7],[100.3,6.5],[99.7,6.9],[99.4,7.6],[98.4,8.0],[98.3,9.0],[98.6,10.0],[98.9,10.8],[99.2,11.6],[99.3,12.2],[99.1,13.1],[98.4,14.2],[98.6,15.3],[98.6,16.1],[97.8,17.0],[97.6,18.4],[97.4,18.6],[97.8,19.6],[98.3,19.7],[99.0,20.0],[99.5,20.1]];
const TH_BOX = { lon0:97.2, lon1:105.8, lat0:5.5, lat1:20.6 };
/* ตำแหน่งหมุดของแต่ละภาค */
const REGION_PINS = {
  "ภาคเหนือ":[99.3,18.7], "ภาคตะวันออกเฉียงเหนือ":[103.2,16.2], "ภาคกลาง":[100.4,15.2],
  "ภาคตะวันตก":[98.9,14.4], "ภาคตะวันออก":[101.6,13.2], "ภาคใต้":[99.7,8.6]
};
const pinSvg = c => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${c}"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;

function thaiDotsSvg(){
  const inside = (x, y) => { let c = false; for (let i=0, j=TH_OUTLINE.length-1; i<TH_OUTLINE.length; j=i++){ const [xi,yi]=TH_OUTLINE[i],[xj,yj]=TH_OUTLINE[j]; if (((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c; } return c; };
  const W = (TH_BOX.lon1-TH_BOX.lon0)*10, H = (TH_BOX.lat1-TH_BOX.lat0)*10, s = 0.24;
  let dots = "";
  for (let lat = TH_BOX.lat1; lat > TH_BOX.lat0; lat -= s)
    for (let lon = TH_BOX.lon0; lon < TH_BOX.lon1; lon += s)
      if (inside(lon, lat)) dots += `<circle cx="${((lon-TH_BOX.lon0)*10).toFixed(1)}" cy="${((TH_BOX.lat1-lat)*10).toFixed(1)}" r=".75"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="pv-dots" aria-hidden="true"><g fill="#1d1d1d">${dots}</g></svg>`;
}

let pvRegion = "ภาคกลาง";
function provincesRun(){
  const tabs = document.getElementById("pvTabs"); if (!tabs) return;
  const regions = Object.keys(PROVINCES);
  /* data-v = ชื่อภาคภาษาไทยเดิม (ข้อความบนปุ่มอาจถูกแปลเป็นภาษาอังกฤษ) */
  tabs.innerHTML = regions.map(r=>`<button class="${r===pvRegion?"on":""}" role="tab" data-v="${r}">${r}</button>`).join("");
  tabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{ pvRegion=b.dataset.v; provincesRun(); });

  const map = document.getElementById("pvMap");
  if (!map.querySelector(".pv-dots")) map.innerHTML = thaiDotsSvg() + `<div id="pvPins"></div>`;
  const W = TH_BOX.lon1-TH_BOX.lon0, H = TH_BOX.lat1-TH_BOX.lat0;
  document.getElementById("pvPins").innerHTML = regions.map(r=>{
    const [lon,lat] = REGION_PINS[r], x = (lon-TH_BOX.lon0)/W*100, y = (TH_BOX.lat1-lat)/H*100;
    return r===pvRegion
      ? `<button class="pv-pin on" style="left:${x}%;top:${y}%">${pinSvg("#fff")}<span>${r}</span></button>`
      : `<button class="pv-pin" style="left:${x}%;top:${y}%" data-r="${r}" aria-label="${r}">${pinSvg("#9b6fb8")}</button>`;
  }).join("");
  document.querySelectorAll(".pv-pin[data-r]").forEach(p=>p.onclick=()=>{ pvRegion=p.dataset.r; provincesRun(); });

  document.getElementById("pvTitle").textContent = pvRegion;
  document.getElementById("pvSub").textContent = `ข้อมูลสมุนไพรประจำจังหวัดใน${pvRegion}`;
  const list = document.getElementById("pvList");
  list.innerHTML = PROVINCES[pvRegion].map(p=>`
    <a class="pv-item" href="#/herb/search" data-p="${p}">
      <span class="pv-thumb" style="background-image:url('images/province/${p}.jpg')"></span>
      <b>${p}</b>
      <span class="pv-go"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
    </a>`).join("");
  list.scrollTop = 0;
  list.querySelectorAll(".pv-item").forEach(a=>a.onclick=()=>{ window.HS_PRESET = { region: pvRegion, province: a.dataset.p }; });
}
