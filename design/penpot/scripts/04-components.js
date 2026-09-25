const S = storage, C = S.C;
S.ticketCard = (parent, t) => {
  const card = S.box(parent, {name:"TicketCard/"+t.id, fill:C.card, stroke:C.border, radius:8, dir:"column", gap:8, pad:12, vs:"auto"}); S.fillX(card);
  const top = S.box(card, {name:"top", dir:"row", gap:6, vs:"auto", align:"center"}); S.fillX(top); S.fillX(S.txt(top, t.id, {size:11, color:C.dim, mono:true}));
  if (t.agent) { const a = S.box(top,{name:"agent", fill:C.muted, radius:999, dir:"row", gap:4, pad:[2,6], hs:"auto", vs:"auto", align:"center"}); S.icon(a,"bot",12,t.agentColor||C.blue); S.txt(a, t.agent, {size:10, color:C.mfg}); }
  S.fillX(S.txt(card, t.title, {size:13, weight:500, lh:1.35}));
  const meta = S.box(card, {name:"meta", dir:"row", gap:8, vs:"auto", hs:"auto", align:"center"});
  const dom = S.box(meta,{name:"domain", stroke:C.border, radius:4, dir:"row", gap:4, pad:[1,6], hs:"auto", vs:"auto", align:"center"}); S.box(dom,{name:"sq", fill:S.domainColors[t.domain]||C.mfg, radius:2, w:6, h:6}); S.txt(dom, t.domain, {size:10, color:C.mfg});
  if (t.sub) { const s = S.box(meta,{name:"sub", dir:"row", gap:3, hs:"auto", vs:"auto", align:"center"}); S.icon(s,"subtask",12,C.dim); S.txt(s, t.sub, {size:10, color:C.dim, mono:true}); }
  return card; };
S.kanbanCol = (parent, name, color, tickets) => {
  const col = S.box(parent, {name:"Column/"+name, fill:C.muted, op:0.5, radius:10, dir:"column", gap:8, pad:8, w:240}); S.child(col,{v:"fill", h:"fill"});
  const hd = S.box(col,{name:"header", dir:"row", gap:8, pad:[4,4], vs:"auto", align:"center"}); S.fillX(hd);
  S.dot(hd,color); S.fillX(S.txt(hd, name, {size:12, weight:500})); S.txt(hd, String(tickets.length), {size:11, color:C.dim, mono:true});
  tickets.forEach(t=>S.ticketCard(col,t)); return col; };
S.T = [
 {id:"KIB-9", title:"Setup Tauri + sidecar Bun", domain:"DevOps", sub:"2/3"},
 {id:"KIB-12", title:"Schéma Loro des tickets (LoroTree)", domain:"Core", sub:"3/5", agent:"opus-dev-1"},
 {id:"KIB-14", title:"Récepteur de hooks Claude Code", domain:"Agents", agent:"opus-dev-2", agentColor:C.amber},
 {id:"KIB-15", title:"Kanban : drag & drop entre colonnes", domain:"UI"},
 {id:"KIB-18", title:"Adaptateur GitHub Issues", domain:"Intégrations"},
 {id:"KIB-21", title:"Sandbox iframe des composants", domain:"Sécurité", sub:"0/4"},
 {id:"KIB-7", title:"Tokens shadcn + thème sombre", domain:"UI"},
 {id:"KIB-11", title:"Démon : auth par jeton local", domain:"Sécurité"},
 {id:"KIB-5", title:"Monorepo Bun workspaces", domain:"DevOps"}];
S.overlay = (frame, op=0.55) => { const o = S.box(frame,{name:"Overlay", fill:"#000000", op, w:frame.width, h:frame.height}); o.layoutChild.absolute = true; penpotUtils.setParentXY(o,0,0); return o; };
S.dialog = (frame, w, title, desc) => {
  const d = S.box(frame,{name:"Dialog-"+title, fill:C.card, stroke:C.border, radius:12, w, dir:"column", gap:18, pad:24, vs:"auto"});
  d.shadows = [{style:"drop-shadow", offsetX:0, offsetY:16, blur:48, spread:0, color:{color:"#000000", opacity:0.5}}]; d.layoutChild.absolute = true;
  const h = S.box(d,{name:"header", dir:"row", gap:8, vs:"auto"}); S.fillX(h); const tv = S.box(h,{name:"t", dir:"column", gap:4, vs:"auto"}); S.fillX(tv);
  S.txt(tv,title,{size:17, weight:600}); if (desc) S.fillX(S.txt(tv,desc,{size:13,color:C.mfg, lh:1.4})); S.icon(h,"x",16,C.dim); return d; };
S.field = (parent, label, value, o={}) => { const f = S.box(parent,{name:"Field-"+label, dir:"column", gap:6, vs:"auto"}); S.fillX(f); S.txt(f,label,{size:12, weight:500});
  const i = S.box(f,{name:"Input", fill:C.bg, stroke:o.focus?C.mfg:C.border, radius:6, dir:o.multi?"column":"row", gap:8, pad:[8,10], vs:"auto", align:o.multi?"start":"center"}); S.fillX(i);
  if (o.icon) S.icon(i,o.icon,14,C.dim); S.fillX(S.txt(i,value,{size:13, color:o.placeholder?C.dim:C.fg, mono:!!o.mono, lh:o.multi?1.5:undefined})); if (o.right) S.txt(i,o.right,{size:12,color:C.mfg}); return f; };
const boardFill = {"#09090B":"#FFFFFF","#111113":"#FFFFFF","#1C1C1F":"#F4F4F5","#27272A":"#F4F4F5","#0C0C0E":"#FAFAFA","#FAFAFA":"#18181B","#431407":"#FFEDD5","#1F1608":"#FFFBEB","#050506":"#F4F4F5","#0D1F12":"#ECFDF3","#2A0F0F":"#FEF2F2","#15131A":"#F5F3FF"};
const strokeMap = {"#27272A":"#E4E4E7","#1F1F23":"#E4E4E7","#78350F":"#FCD34D","#3F3F46":"#D4D4D8","#FAFAFA":"#09090B","#A1A1AA":"#71717A","#71717A":"#A1A1AA","#18181B":"#FAFAFA","#09090B":"#FFFFFF","#D4D4D8":"#18181B"};
const textMap = {"#FAFAFA":"#09090B","#06B6D4":"#0E7490","#F59E0B":"#B45309","#22C55E":"#15803D","#EF4444":"#B91C1C","#3B82F6":"#1D4ED8","#FCD34D":"#92400E","#67E8F9":"#0E7490","#A1A1AA":"#52525B","#71717A":"#71717A","#F97316":"#C2410C","#18181B":"#FAFAFA","#86EFAC":"#15803D","#FCA5A5":"#B91C1C","#C4B5FD":"#6D28D9","#93C5FD":"#1D4ED8","#FDBA74":"#C2410C"};
const up = c => (c||"").toUpperCase();
S.toLight = (root) => { penpotUtils.analyzeDescendants(root, (r, s) => { try {
  if (s.name === "logo" || (s.parent && s.parent.name === "logo") || s.name==="dot") return null;
  if (s.type === "text") { if (s.fills?.length) s.fills = s.fills.map(f => ({...f, fillColor: textMap[up(f.fillColor)] || f.fillColor})); }
  else { if (s.fills?.length && s.type !== "ellipse") s.fills = s.fills.map(f => { const n = boardFill[up(f.fillColor)]; return n ? {...f, fillColor:n, fillOpacity: up(f.fillColor)==="#1C1C1F" ? 1 : f.fillOpacity} : f; });
    if (s.strokes?.length) s.strokes = s.strokes.map(st => ({...st, strokeColor: strokeMap[up(st.strokeColor)] || st.strokeColor})); } } catch(e) {} return null; });
  root.fills = [{fillColor:"#FFFFFF", fillOpacity:1}];
  penpotUtils.findShapes(s=>s.name==="logo", root).forEach(l=>{ const par = l.parent, idx = par.children.findIndex(c => c.id === l.id), sz = Math.round(l.width); if (!par.layoutChild && !par.flex) return; const nw = penpot.createShapeFromSvg(S.kanbanLogo("light", sz)); nw.name="logo"; par.insertChild(idx, nw); l.remove(); });
  penpotUtils.findShapes(s=>s.name==="Overlay", root).forEach(o=>o.fills=[{fillColor:"#09090B",fillOpacity:0.5}]);
  penpotUtils.findShapes(s=>s.shadows?.length>0, root).forEach(s=>s.shadows = s.shadows.map(x=>({...x, color:{color:"#000000", opacity:0.12}}))); };
S.lightClone = (id, dx=1540) => { const src = penpotUtils.findShapeById(id); const cl = src.clone(); cl.name = src.name+" (clair)"; cl.x = src.x + dx; cl.y = src.y; S.toLight(cl); return cl.id; };
return "components ok";
