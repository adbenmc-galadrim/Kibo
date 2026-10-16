// Relevé des cotes : géométrie, flex, polices et couleurs de chaque nœud des boards storage.COTES_NAMES, envoyé en JSON au receiver (storage.COTES_FILE).
const names = storage.COTES_NAMES || [];
const hex = (c) => c ? String(c).toUpperCase() : null;
const fillsOf = (s) => (s.fills || []).filter(f => f.fillColor).map(f => hex(f.fillColor) + (f.fillOpacity != null && f.fillOpacity !== 1 ? "@" + Math.round(f.fillOpacity * 100) : ""));
const strokesOf = (s) => (s.strokes || []).filter(k => k.strokeColor).map(k => hex(k.strokeColor) + " " + k.strokeWidth + (k.strokeStyle && k.strokeStyle !== "solid" ? " " + k.strokeStyle : ""));
const r1 = (v) => Math.round(v * 10) / 10;
const firstStroke = (s) => { const st = penpotUtils.findShapes(z => (z.strokes || []).some(k => k.strokeColor), s)[0]; return st ? hex(st.strokes[0].strokeColor) : null; };
const out = {};
for (const nm of names) { const b = penpot.currentPage.root.children.find(c => c.name === nm); const bx = b.x, by = b.y; const rows = [];
  const walk = (s, d) => { const o = { d, n: s.name, t: s.type, x: r1(s.x - bx), y: r1(s.y - by), w: r1(s.width), h: r1(s.height) };
    if (s.type === "text") { Object.assign(o, { c: s.characters, ff: s.fontFamily, fs: s.fontSize, fw: s.fontWeight, fst: s.fontStyle, lh: s.lineHeight, ls: s.letterSpacing, col: fillsOf(s), tt: s.textTransform, al: s.align }); rows.push(o); return; }
    if (s.type === "board" || s.type === "rectangle" || s.type === "ellipse") { o.fill = fillsOf(s); o.stroke = strokesOf(s); if (s.borderRadius) o.r = s.borderRadius;
      if (s.flex) { const f = s.flex; o.flex = { dir: f.dir, gap: f.dir === "row" ? f.columnGap : f.rowGap, pad: [f.topPadding, f.rightPadding, f.bottomPadding, f.leftPadding], ai: f.alignItems, jc: f.justifyContent }; }
      if (s.layoutChild) o.lc = [s.layoutChild.horizontalSizing, s.layoutChild.verticalSizing];
      rows.push(o); if (s.children) for (const c of s.children) walk(c, d + 1); return; }
    o.icon = true; o.col = firstStroke(s) || (fillsOf(s)[0] || null); rows.push(o); };
  walk(b, 0); out[nm] = rows; }
const body = JSON.stringify(out);
const u = await fetch("http://127.0.0.1:8787/upload?name=" + encodeURIComponent(storage.COTES_FILE || "_dump.json"), { method: "POST", body });
return [u.ok, body.length];
