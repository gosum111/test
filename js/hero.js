/* =========================================================
   ภาพต้นไม้สำรองของหน้าแรก (ใช้เมื่อยังไม่มี images/hero.jpg)
   วาดพุ่มไม้ 3 ชั้น + สระน้ำพุ ด้วย SVG ให้เต็มความกว้างจอ
   ========================================================= */
function drawCanopy(svg){
  if (!svg) return;
  let seed = 7;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };

  const layer = (base, rMin, rMax, colors, light) => {
    let out = `<rect x="-100" y="${base}" width="1800" height="${520-base}" fill="${colors[0]}"/>`;
    for (let x = -80; x < 1700; x += rnd(rMin * 0.9, rMax * 1.1)) {
      const r = rnd(rMin, rMax), y = base + rnd(-rMin * .35, rMin * .35), c = colors[Math.floor(rnd(0, colors.length))];
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/>`;
      out += `<circle cx="${(x - r*.28).toFixed(1)}" cy="${(y - r*.3).toFixed(1)}" r="${(r*.55).toFixed(1)}" fill="${light}" opacity=".35"/>`;
    }
    return out;
  };

  svg.setAttribute("viewBox", "0 0 1600 500");
  svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
  svg.innerHTML = `
    <defs>
      <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef5f8" stop-opacity=".55"/><stop offset=".35" stop-color="#eef5f8" stop-opacity="0"/></linearGradient>
      <radialGradient id="water" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#cfe6ea"/><stop offset="1" stop-color="#7fa9ae"/></radialGradient>
    </defs>
    <g opacity=".9">${layer(170, 26, 46, ["#a9cf86","#9dc57a","#b4d690"], "#e2f0c8")}</g>
    ${layer(250, 38, 62, ["#6ea646","#78b04e","#639c3d"], "#b9de8c")}
    ${layer(345, 52, 88, ["#3f7d27","#4a8a2f","#36701f"], "#86c05a")}
    <rect width="1600" height="500" fill="url(#haze)"/>
    <g transform="translate(800 468)">
      <ellipse rx="300" ry="44" fill="#d9cdb2"/>
      <ellipse rx="282" ry="38" fill="url(#water)"/>
      <ellipse rx="120" ry="18" fill="none" stroke="#e8dcc0" stroke-width="5"/>
      <g fill="#fff">
        <path d="M0 0C-5-60-3-110 0-150 3-110 5-60 0 0Z" opacity=".9"/>
        <path d="M-14 0C-18-40-14-70-8-88-8-60-9-30-6 0Z" opacity=".6"/>
        <path d="M14 0C18-40 14-70 8-88 8-60 9-30 6 0Z" opacity=".6"/>
        ${[-210,-150,-90,90,150,210].map(x=>`<path d="M${x} 0c-2-14-1-26 0-34 1 8 2 20 0 34z" opacity=".75"/>`).join("")}
      </g>
    </g>`;
}
drawCanopy(document.querySelector(".hero .trees"));
