const S = storage, C = S.C;
// Onglets sans icône d'épingle (les épinglés sont compacts)
const oldTabBar = S.tabBar;
S.tabBar = (parent, tabs, o) => { const b = oldTabBar(parent, tabs, o); penpotUtils.findShapes(s => /icon ?\/ ?pin/.test(s.name), b).forEach(i => i.remove()); return b; };
// Un texte vide casse applyToText
const oldTxt = S.txt;
S.txt = (p, chars, opt = {}) => oldTxt(p, (chars === "" || chars == null) ? " " : chars, opt);
S.CUR = {1:null,2:null,3:["grid","Kibo · Tableau de bord"],4:["kanban","Kibo · Kanban"],5:["kanban","Kibo · Kanban"],6:["grid","Composants"],7:["grid","Kibo · Tableau de bord"],8:["kanban","Kibo · Kanban"],9:["list","Kibo · Tickets"],10:["graph","Kibo · Graphe"],11:["note","Kibo · Notes"],12:["list","Mes tickets"],13:["bot","Agents"],14:["settings","Paramètres"],15:["settings","Paramètres"],16:["settings","Paramètres"],17:["clock","Files d'attente"],18:["kanban","Kibo · Kanban"]};
S.tabsFor = (num) => {
  if (num === 19) return [{home:true, label:"Accueil", pinned:true, active:true}];
  const cur = S.CUR[num]; const act = cur ? cur[1] : "Accueil";
  const base = [{home:true, label:"Accueil", pinned:true},{pinned:true, dot:C.brand, icon:"kanban", label:"Kibo · Kanban"},{pinned:true, dot:C.green, icon:"list", label:"API Facturation · Tickets", sep:true}];
  const opened = []; if (cur && cur[1] !== "Kibo · Kanban") opened.push({icon:cur[0], label:cur[1]});
  opened.push({icon:"note", label:"Kibo · KIB-12"},{icon:"git", label:"Kibo · Changements", badge:C.amber});
  return [...base, ...opened].map(t=>({...t, active: t.label===act})); };
S.addTabs = (f) => {
  if (penpotUtils.findShape(s=>s.name==="TabBar", f)) return "skip";
  const light = (f.fills?.[0]?.fillColor||"").toUpperCase()==="#FFFFFF";
  const num = parseInt(f.name);
  const kids = [...f.children];
  const flow = kids.filter(k=>!(k.layoutChild && k.layoutChild.absolute)), abs = kids.filter(k=>k.layoutChild && k.layoutChild.absolute);
  f.resize(1440, 940);
  const bar = S.tabBar(null, S.tabsFor(num));
  if (num === 19) { f.appendChild(bar); bar.layoutChild.absolute = true; penpotUtils.setParentXY(bar,0,0); bar.resize(1440,40); }
  else {
    const body = S.box(null,{name:"Body", dir:"row"});
    f.insertChild(0, body); flow.forEach(k=>body.appendChild(k));
    f.flex.dir = "column"; f.insertChild(0, bar);
    S.child(bar,{h:"fill"}); S.child(body,{h:"fill", v:"fill"});
    abs.forEach(k=>{ if (k.name==="Overlay") { k.resize(1440,940); penpotUtils.setParentXY(k,0,0); } else penpotUtils.setParentXY(k, k.parentX, k.parentY+40); });
  }
  if (light) { S.toLight(bar); bar.fills=[{fillColor:"#F4F4F5", fillOpacity:1}]; f.fills=[{fillColor:"#FFFFFF", fillOpacity:1}]; }
  return "ok"; };
S.frontAbs = (f) => { const abs = f.children.filter(k=>k.layoutChild && k.layoutChild.absolute && k.name!=="TabBar"); const ov = abs.filter(k=>k.name==="Overlay"), rest = abs.filter(k=>k.name!=="Overlay"); [...ov, ...rest].forEach(k=>{ k.bringToFront(); if (k.layoutChild) k.layoutChild.zIndex = k.name==="Overlay"?10:20; }); return abs.length; };
const oldAddTabs = S.addTabs; S.addTabs = (f) => { const r = oldAddTabs(f); S.frontAbs(f); return r; };
S.addChangements = (sb, light) => {
  if (sb.children.some(c=>/Changements/.test(c.name))) return "skip";
  const after = ["Ajouter une page","Portfolio","API Facturation","spacer","Composants","Paramètres"];
  if (!sb.children.some(c=>/Notes/.test(c.name))) return "no-notes";
  const it = S.navItem(sb,"git","Changements",{indent:14, count:4});
  if (light) { S.toLight(it); it.fills = []; }
  for (const key of after) { const c = sb.children.find(x=>x.name.includes(key)); if (c) sb.appendChild(c); }
  return sb.children.map(c=>c.name.replace("SidebarItem / ","")).join(",");
};
return "tabs ok";
