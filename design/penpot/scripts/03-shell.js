const S = storage, C = S.C;
S.navItem = (parent, ic, label, o={}) => {
  const it = S.box(parent, {name:"SidebarItem/"+label, fill:o.active?C.accent:null, radius:6, dir:"row", gap:8, pad:[6, 8, 6, 8+(o.indent||0)], vs:"auto", align:"center"}); S.fillX(it);
  if (o.dot) S.dot(it,o.dot); else if (ic) S.icon(it, ic, 16, o.active?C.fg:C.mfg);
  S.fillX(S.txt(it, label, {size:13, weight:o.active?500:400, color:o.active?C.fg:C.mfg}));
  if (o.count!=null) S.txt(it, String(o.count), {size:11, color:C.dim, mono:true}); if (o.badge) S.dot(it,o.badge); return it; };
S.sidebar = (parent, active="Kanban") => {
  const sb = S.box(parent,{name:"Sidebar", fill:C.sidebar, w:248, dir:"column", gap:2, pad:[12,10]}); S.child(sb,{v:"fill"}); S.border(sb);
  const ws = S.box(sb,{name:"WorkspaceSwitcher", dir:"row", gap:8, pad:[6,6], vs:"auto", align:"center", radius:6}); S.fillX(ws);
  S.logo(ws,24,"dark"); const wn = S.box(ws,{name:"ws-name", dir:"column", vs:"auto"}); S.fillX(wn);
  S.txt(wn,"Perso",{size:13, weight:600}); S.txt(wn,"Workspace local",{size:11, color:C.dim}); S.icon(ws,"chevDown",14,C.dim);
  const se = S.box(sb,{name:"Search", fill:C.muted, stroke:C.border, radius:6, dir:"row", gap:8, pad:[6,8], vs:"auto", align:"center"}); S.fillX(se);
  S.icon(se,"search",14,C.dim); S.fillX(S.txt(se,"Rechercher…",{size:12, color:C.dim})); const k = S.box(se,{name:"kbd", fill:C.accent, radius:4, dir:"row", pad:[1,5], hs:"auto", vs:"auto"}); S.txt(k,"⌘K",{size:10, color:C.mfg, mono:true});
  S.box(sb,{name:"gap", h:8, w:1});
  S.navItem(sb,"home","Vue d'ensemble",{active:active==="overview"}); S.navItem(sb,"list","Mes tickets",{count:7}); S.navItem(sb,"bot","Agents",{count:3, badge:C.amber});
  S.box(sb,{name:"gap", h:12, w:1}); S.txt(sb,"PROJETS",{size:10, weight:600, color:C.dim}); S.box(sb,{name:"gap", h:4, w:1});
  S.navItem(sb,null,"Kibo",{dot:C.brand});
  [["grid","Tableau de bord"],["kanban","Kanban"],["list","Tickets"],["graph","Graphe"],["note","Notes"],["git","Changements"]].forEach(([i,l])=>S.navItem(sb,i,l,{indent:14, active: active===l, count: l==="Changements"?4:null}));
  S.navItem(sb,"plus","Ajouter une page",{indent:14}); S.navItem(sb,null,"Portfolio",{dot:C.purple}); S.navItem(sb,null,"API Facturation",{dot:C.green});
  S.child(S.box(sb,{name:"spacer", h:10, w:10}),{v:"fill"}); S.navItem(sb,"grid","Composants"); S.navItem(sb,"settings","Paramètres"); return sb; };
S.topbar = (parent, crumbs, o={}) => {
  const tb = S.box(parent,{name:"Topbar", h:52, dir:"row", gap:12, pad:[0,20], align:"center"}); S.fillX(tb); S.border(tb);
  const bc = S.box(tb,{name:"Breadcrumb", dir:"row", gap:6, vs:"auto", align:"center"}); S.fillX(bc);
  crumbs.forEach((c,i)=>{ if(i) S.icon(bc,"chevRight",14,C.dim); S.txt(bc,c,{size:13, weight:i===crumbs.length-1?500:400, color:i===crumbs.length-1?C.fg:C.mfg, mono: /\.(ts|tsx|md)/.test(c)}); });
  (o.extra||[]).forEach(fn=>fn(tb)); S.button(tb,"Ticket","default",{sm:true, icon:"plus"}); S.icon(tb,"bell",16,C.mfg);
  const av = S.box(tb,{name:"Avatar", fill:C.accent, radius:999, w:28, h:28, dir:"row", align:"center", justify:"center"}); S.txt(av,"AB",{size:11, weight:600}); return tb; };
S.slotsMini = (parent, used, total) => { const g = S.box(parent,{name:"HostSlots", dir:"row", gap:3, hs:"auto", vs:"auto", align:"center"}); for (let i=0;i<total;i++) S.box(g,{name:"slot", fill:i<used?C.blue:C.accent, radius:2, w:6, h:12}); return g; };
// Barre d'état des agents (données : design/donnees-fictives.md)
S.agentBar = (parent) => {
  const sbar = S.box(parent,{name:"AgentStatusBar", fill:C.sidebar, h:40, dir:"row", gap:14, pad:[0,16], align:"center"}); S.fillX(sbar); S.border(sbar);
  S.icon(sbar,"bot",14,C.fg); S.txt(sbar,"Agents",{size:12, weight:500});
  const q = S.box(sbar,{name:"QueueSegment", dir:"row", gap:8, hs:"auto", vs:"auto", align:"center"}); S.slotsMini(q,3,3); S.txt(q,"3/3",{size:11, mono:true}); S.dot(q,C.cyan,7); S.txt(q,"3 en file",{size:11,color:C.mfg}); S.box(q,{name:"sep", fill:C.border, w:1, h:16});
  const seg = (a, color, t) => { const s = S.box(sbar,{name:"Run-"+a, dir:"row", gap:6, hs:"auto", vs:"auto", align:"center"}); S.dot(s,color,7); S.txt(s,a,{size:11, mono:true}); S.txt(s,t,{size:11,color:C.dim}); return s; };
  seg("opus-dev-1",C.blue,"KIB-12 · 12m"); seg("opus-dev-3",C.blue,"KIB-16 · 4m"); seg("sonnet-review",C.blue,"KIB-7 · 1m");
  S.box(sbar,{name:"sep", fill:C.border, w:1, h:16});
  const w = seg("opus-dev-2",C.amber,"KIB-14 · attend une réponse"); S.button(w,"Répondre","brand",{sm:true});
  S.fillX(S.box(sbar,{name:"spacer",h:1,w:1})); S.txt(sbar,"● Démon local",{size:11,color:C.dim});
  const chev = S.icon(sbar,"chevDown",14,C.mfg); chev.name = "expand"; chev.rotation = 180; return sbar; };
// Remplace la barre d'état d'un écran par la version de référence
S.replaceAgentBar = (frame, light) => {
  const old = penpotUtils.findShape(s=>s.name==="AgentStatusBar", frame); if (!old) return "none";
  // La barre est toujours le dernier enfant de Main (insertChild ne respecte pas l'ordre du flex)
  const par = old.parent; old.remove(); const nb = S.agentBar(par);
  if (light) S.toLight(nb), nb.fills = [{fillColor:"#FAFAFA", fillOpacity:1}];
  return "ok"; };
// Figma-like tab bar
S.tabBar = (parent, tabs, o={}) => {
  const bar = S.box(parent,{name:"TabBar", fill:"#050506", h:40, dir:"row", gap:2, pad:[0,8,0,12], align:"end"}); S.fillX(bar);
  bar.strokes=[{strokeColor:C.sbBorder, strokeWidth:1, strokeAlignment:"inner", strokeOpacity:1}];
  const tl = S.box(bar,{name:"TrafficLights", dir:"row", gap:8, pad:[0,12,14,0], hs:"auto", vs:"auto", align:"center"});
  ["#FF5F57","#FEBC2E","#28C840"].forEach(c=>S.dot(tl,c,12));
  tabs.forEach(t=>{
    const act = !!t.active;
    const tab = S.box(bar,{name:"Tab-"+(t.label||t.icon), fill:act?C.bg:null, radius:0, dir:"row", gap:7, pad:t.pinned?[0,10]:[0,10,0,12], h:32, hs:"auto", align:"center"});
    tab.borderRadiusTopLeft = 8; tab.borderRadiusTopRight = 8;
    if (act) tab.strokes=[{strokeColor:C.sbBorder, strokeWidth:1, strokeAlignment:"inner", strokeOpacity:1}];
    if (t.home) S.logo(tab,16,"dark"); else if (t.dot) S.dot(tab,t.dot,8); if (t.icon && !t.home) S.icon(tab,t.icon,14,act?C.fg:C.mfg);
    if (!t.pinned && t.label) { S.txt(tab,t.label,{size:12, weight:act?500:400, color:act?C.fg:C.mfg, mono:!!t.mono}); }
    if (t.pinned) S.icon(tab,"pin",11,C.dim);
    if (t.badge) S.dot(tab,t.badge,6);
    if (!t.pinned && !t.home) S.icon(tab,"x",12,act?C.mfg:C.dim);
    if (t.sep) { const sp = S.box(bar,{name:"sep", fill:C.border, w:1, h:16}); sp.layoutChild.alignSelf = "center"; }
  });
  const add = S.box(bar,{name:"NewTab", dir:"row", pad:[0,8], h:32, hs:"auto", align:"center"}); S.icon(add,"plus",14,C.mfg);
  S.fillX(S.box(bar,{name:"drag-area",h:32,w:10}));
  return bar; };
S.TABS = (activeLabel) => [
  {home:true, label:"Accueil", icon:"home", pinned:true},
  {pinned:true, dot:C.brand, icon:"kanban", label:"Kibo · Kanban"},
  {pinned:true, dot:C.green, icon:"list", label:"API Facturation · Tickets", sep:true},
  {icon:"kanban", label:"Kibo · Tableau de bord", dot:null},
  {icon:"note", label:"KIB-12 · Schéma Loro"},
  {icon:"git", label:"Changements · kib-12", badge:C.amber},
  {icon:"fileCode", label:"ticket.ts", mono:true},
].map(t=>({...t, active: t.label===activeLabel}));
// shell: frame column = tabbar + body(row: sidebar + main(topbar, content, agentbar))
S.shell = (name, x, y, active, crumbs, activeTab, o={}) => {
  const frame = S.box(null,{name, w:1440, h:940, fill:C.bg, dir:"column"}); frame.x = x; frame.y = y;
  S.tabBar(frame, S.TABS(activeTab));
  const body = S.box(frame,{name:"Body", dir:"row"}); S.child(body,{h:"fill", v:"fill"});
  S.sidebar(body, active);
  const col = S.box(body,{name:"Main", dir:"column"}); S.child(col,{h:"fill", v:"fill"});
  S.topbar(col, crumbs, o);
  const content = S.box(col,{name:"Content", dir:o.dir||"column", gap:o.gap??16, pad:o.pad??24}); S.child(content,{h:"fill", v:"fill"}); content.clipContent = true;
  if (!o.noBar) S.agentBar(col);
  return {frame, content, col, body}; };
return "shell ok";
