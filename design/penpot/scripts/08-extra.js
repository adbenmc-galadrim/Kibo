// Écrans 32+ : pages par phase, shell de référence reconstruit sur la page active (un clone ne change pas de page).
const S = storage, C = S.C;

Object.assign(S.ICONS, {
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
 circleCheck:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
 circleX:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
 arrowUpCircle:'<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>',
 shieldAlert:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
 shieldOff:'<path d="m2 2 20 20"/><path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71"/><path d="M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264"/>',
 scanSearch:'<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
 cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
 cloudOff:'<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 eye:'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
 package:'<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
 refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
 trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
 laptop:'<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
 globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
 cpu:'<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
 code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
 clipboard:'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
 download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
 arrowLeft:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
 frame:'<line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/>',
 github:'<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
 badgeCheck:'<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
 fileDiff:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M9 10h6"/><path d="M12 13V7"/><path d="M9 17h6"/>',
 activity:'<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
 hand:'<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
 square:'<rect width="18" height="18" x="3" y="3" rx="2"/>',
 wifiOff:'<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
 userPlus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
 share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
 store:'<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
 fingerprint:'<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
 merge:'<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/>',
 edit3:'<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
});
const wait = ms => new Promise(r => setTimeout(r, ms));

// Ouvre (ou crée) une page par son nom exact
S.page = async (name) => {
  const p = penpotUtils.getPages().find(x => x.name === name);
  const page = p ? penpotUtils.getPageById(p.id) : penpot.createPage();
  if (!p) page.name = name;
  if (penpot.currentPage.id !== page.id) { penpot.openPage(page); await wait(800); }
  return page; };

// Onglets : Accueil + 2 épinglés + onglet courant + KIB-12 + Changements
S.tabsX = (cur) => {
  const base = [{ home: true, label: "Accueil", pinned: true }, { pinned: true, dot: C.brand, icon: "kanban", label: "Kibo · Kanban" }, { pinned: true, dot: C.green, icon: "list", label: "API Facturation · Tickets", sep: true }];
  const opened = []; if (cur && cur[1] !== "Kibo · Kanban" && cur[1] !== "Kibo · KIB-12" && cur[1] !== "Kibo · Changements") opened.push({ icon: cur[0], label: cur[1] });
  opened.push({ icon: "ticket", label: "Kibo · KIB-12" }, { icon: "git", label: "Kibo · Changements", badge: C.amber });
  const act = cur ? cur[1] : "Accueil";
  return [...base, ...opened].map(t => ({ ...t, active: t.label === act })); };

// Écran complet : name, position (col, row sur la grille 1540 × 1040), nav active, fil d'Ariane, onglet [icône, libellé]
S.screenX = (name, col, row, active, crumbs, tab, o = {}) => {
  const old = penpot.currentPage.root.children.find(c => c.name === name); if (old) old.remove();
  const r = S.shell(name, col * 1540, row * 1040, active, crumbs, null, o);
  const f = r.frame; f.resize(1440, 940);
  const tb = penpotUtils.findShape(s => s.name === "TabBar", f); const nb = S.tabBar(null, S.tabsX(tab)); f.insertChild(0, nb); S.child(nb, { h: "fill" }); tb.remove();
  S.fixIcons(f); S.fixIconOrder(f); if (o.nav) S.activate(f, o.nav);
  const mt = penpotUtils.findShape(s => s.name === "SidebarItem / Mes tickets", f); if (mt) { const t = mt.children.find(c => c.type === "text" && /^\d+$/.test(c.characters)); if (t) S.setText(t, "9"); }
  if (o.noTicket) { const b = penpotUtils.findShape(s => s.name === "Topbar", f).children.find(c => /Button/.test(c.name)); if (b) b.remove(); }
  return { ...r, frame: f }; };

// Élément actif de la sidebar (Agents, Composants, Paramètres…)
S.activate = (f, label) => { const it = penpotUtils.findShape(s => s.name === "SidebarItem / " + label, f); if (!it) return 0;
  it.fills = [{ fillColor: C.accent, fillOpacity: 1 }]; const t = it.children.find(c => c.type === "text"); if (t) { t.fills = [{ fillColor: C.fg, fillOpacity: 1 }]; S.setText(t); }
  const ic = it.children.find(c => /^icon/.test(c.name)); if (ic) penpotUtils.findShapes(x => x.strokes?.length, ic).forEach(x => x.strokes = x.strokes.map(st => ({ ...st, strokeColor: C.fg }))); return 1; };
// Bouton dans la topbar, avant « Ticket »
S.topAction = (f, label, variant = "outline", icon) => { const tb = penpotUtils.findShape(s => s.name === "Topbar", f);
  const b = S.button(null, label, variant, { sm: true, icon }); tb.insertChild(1, b); return b; };

// Réglages ici : dernières touches communes
S.h = (p, t, o = {}) => S.txt(p, t, { size: o.size || 15, weight: 600, ...o });
S.sub = (p, t, o = {}) => S.fillX(S.txt(p, t, { size: 12, color: C.mfg, lh: 1.4, ...o }));
S.label = (p, t) => S.txt(p, t.toUpperCase(), { size: 10, weight: 600, color: C.dim });
S.panel = (p, o = {}) => { const b = S.box(p, { name: o.name || "Panel", fill: o.fill || C.card, stroke: o.stroke || C.border, radius: o.radius ?? 10, dir: o.dir || "column", gap: o.gap ?? 12, pad: o.pad ?? 16, vs: o.vs || "auto", w: o.w, h: o.h, align: o.align, justify: o.justify });
  if (o.fillX !== false && !o.w) S.fillX(b); return b; };
S.row = (p, o = {}) => { const b = S.box(p, { name: o.name || "row", dir: "row", gap: o.gap ?? 8, pad: o.pad ?? 0, vs: "auto", hs: o.hs, align: o.align || "center", justify: o.justify, fill: o.fill, stroke: o.stroke, radius: o.radius, w: o.w });
  if (!o.hs && !o.w) S.fillX(b); return b; };
S.col = (p, o = {}) => { const b = S.box(p, { name: o.name || "col", dir: "column", gap: o.gap ?? 6, pad: o.pad ?? 0, vs: "auto", hs: o.hs, align: o.align, fill: o.fill, stroke: o.stroke, radius: o.radius, w: o.w });
  if (!o.hs && !o.w) S.fillX(b); return b; };
S.spacer = (p) => S.fillX(S.box(p, { name: "spacer", h: 1, w: 1 }));
S.badge = (p, t, color = C.mfg, o = {}) => { const b = S.box(p, { name: "Badge", fill: o.fill || null, stroke: o.fill ? null : (o.stroke || C.border), radius: o.round ? 999 : 4, dir: "row", gap: 4, pad: [2, 6], hs: "auto", vs: "auto", align: "center" });
  if (o.dot) S.dot(b, o.dot, 6); if (o.icon) S.icon(b, o.icon, 11, color); S.txt(b, t, { size: 10, weight: 500, color, mono: !!o.mono }); return b; };
S.alert = (p, t, kind = "amber", o = {}) => { const k = { amber: [C.amber, "#1F1608", "#78350F"], red: [C.red, "#2A0F0F", "#7F1D1D"], muted: [C.mfg, C.muted, C.border], green: [C.green, "#0D1F12", "#14532D"], blue: [C.blue, "#0B1426", "#1E3A8A"] }[kind];
  const a = S.box(p, { name: "Alert-" + kind, fill: k[1], stroke: k[2], radius: 8, dir: "row", gap: 10, pad: [10, 12], vs: "auto", align: o.desc ? "start" : "center" }); S.fillX(a);
  S.icon(a, o.icon || (kind === "red" ? "alert" : kind === "green" ? "check" : "alert"), 16, k[0]);
  const tv = S.col(a, { gap: 2 }); S.fillX(S.txt(tv, t, { size: 13, weight: 500, color: kind === "muted" ? C.fg : k[0], lh: 1.35 })); if (o.desc) S.sub(tv, o.desc);
  (o.actions || []).forEach(([l, v]) => S.button(a, l, v || "outline", { sm: true })); return a; };
S.toggle = (p, on) => { const t = S.box(p, { name: "Switch", fill: on ? C.primary : C.accent, radius: 999, w: 32, h: 18, dir: "row", pad: 2, justify: on ? "end" : "start", align: "center" }); S.box(t, { name: "knob", fill: on ? C.pfg : C.mfg, radius: 999, w: 14, h: 14 }); return t; };
S.check = (p, on, label) => { const r = S.row(p, { hs: "auto", gap: 8 }); const c = S.box(r, { name: "Checkbox", fill: on ? C.primary : null, stroke: on ? null : C.mfg, radius: 4, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); if (on) S.icon(c, "check", 12, C.pfg); if (label) S.txt(r, label, { size: 13 }); return r; };
S.radio = (p, on) => { const c = S.box(p, { name: "Radio", stroke: on ? C.fg : C.mfg, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); if (on) S.box(c, { name: "in", fill: C.fg, radius: 999, w: 8, h: 8 }); return c; };
S.code = (p, lines, o = {}) => { const b = S.box(p, { name: "Code", fill: o.fill || "#0C0C0E", stroke: C.border, radius: 8, dir: "column", gap: 3, pad: [10, 12], vs: "auto" }); S.fillX(b);
  lines.forEach(l => { const [t, c] = Array.isArray(l) ? l : [l, C.fg]; S.fillX(S.txt(b, t, { size: 12, mono: true, color: c, lh: 1.5 })); }); return b; };
S.menu = (f, x, y, items, w = 240) => { const m = S.box(f, { name: "Menu", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" });
  m.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; if (m.layoutChild) m.layoutChild.absolute = true; penpotUtils.setParentXY(m, x, y);
  items.forEach(it => { if (it === "-") { S.fillX(S.box(m, { name: "sep", fill: C.border, h: 1, w: 10 })); return; }
    const [label, icon, o = {}] = it; const r = S.box(m, { name: "MenuItem", fill: o.hover ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r); if (o.disabled) r.opacity = 0.45;
    const col = o.danger ? C.red : C.fg; if (icon) S.icon(r, icon, 14, o.danger ? C.red : C.mfg); S.fillX(S.txt(r, label, { size: 13, color: col })); if (o.kbd) S.txt(r, o.kbd, { size: 11, color: C.dim, mono: true }); if (o.hint) S.txt(r, o.hint, { size: 11, color: C.dim }); });
  return m; };
S.toast = (f, t, kind = "green") => { const b = S.box(f, { name: "Toast", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 10, pad: [12, 14], hs: "auto", vs: "auto", align: "center" });
  b.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; b.layoutChild.absolute = true;
  S.icon(b, kind === "red" ? "alert" : "check", 16, kind === "red" ? C.red : C.green); S.txt(b, t, { size: 13, weight: 500 }); return b; };
S.table = (p, cols, rows, o = {}) => { const t = S.panel(p, { name: o.name || "Table", pad: 0, gap: 0, radius: 8 });
  const mk = (cells, head, i) => { const r = S.box(t, { name: head ? "thead" : "tr", dir: "row", gap: 12, pad: [head ? 8 : 10, 14], vs: "auto", align: "center", fill: (o.hl === i) ? C.muted : null }); S.fillX(r);
    if (!head || true) r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    cells.forEach((c, j) => { const w = cols[j][1]; const cell = S.box(r, { name: "td", dir: "row", gap: 6, vs: "auto", hs: w ? undefined : undefined, w: w || 100, align: "center" }); if (!w) S.fillX(cell);
      if (typeof c === "function") c(cell); else S.txt(cell, c, { size: head ? 11 : 12, color: head ? C.dim : C.fg, weight: head ? 500 : 400, mono: !head && cols[j][2] === "mono" }); }); return r; };
  mk(cols.map(c => c[0]), true); rows.forEach((r, i) => mk(r, false, i)); return t; };
S.hookLine = (p, time, ev, text, o = {}) => { const r = S.row(p, { gap: 12, align: "start" });
  S.txt(r, time, { size: 12, mono: true, color: C.dim }); const e = S.box(r, { name: "ev", w: 118, dir: "row", vs: "auto" }); S.txt(e, ev, { size: 12, mono: true, color: o.color || C.blue });
  const tx = S.row(r, { gap: 6 }); tx.flex.wrap = "wrap"; (Array.isArray(text) ? text : [text]).forEach(seg => { if (typeof seg === "string") S.txt(tx, seg, { size: 12, color: C.fg }); else S.txt(tx, seg.link, { size: 12, mono: true, color: C.blue }); });
  return r; };
S.stepper = (p, steps, cur) => { const r = S.row(p, { gap: 8 }); steps.forEach((s, i) => { const on = i === cur, done = i < cur;
  const b = S.box(r, { name: "Step", fill: on ? C.accent : null, stroke: on ? C.mfg : C.border, radius: 999, dir: "row", gap: 6, pad: [4, 10], hs: "auto", vs: "auto", align: "center" });
  if (done) S.icon(b, "check", 12, C.green); S.txt(b, (i + 1) + " · " + s, { size: 12, weight: on ? 500 : 400, color: on || done ? C.fg : C.mfg }); if (i < steps.length - 1) S.box(r, { name: "line", fill: C.border, w: 16, h: 1 }); }); return r; };
S.avatar = (p, ini, sz = 24, o = {}) => { const a = S.box(p, { name: "Avatar", fill: o.fill || C.accent, stroke: o.ring || null, sw: 2, radius: 999, w: sz, h: sz, dir: "row", align: "center", justify: "center" }); S.txt(a, ini, { size: Math.round(sz * 0.4), weight: 600, color: o.color || C.fg }); return a; };
S.spinner = (p, c = C.mfg, sz = 14) => { const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`); s.name = "icon/spinner"; if (p) p.appendChild(s); s.resize(sz, sz); return s; };
// Clair : régénère et corrige (retext + ordre des icônes)
S.lightX = async (f) => { const id = S.relight(f.id); const l = penpotUtils.findShapeById(id); S.retext(l); S.fixIconOrder(l); return id; };
// Couleurs propres aux écrans 32+ que toLight ne connaît pas
S.X_FILL = { "#0B1426": "#EFF6FF", "#2B2B2E": "#FFFFFF", "#0C0C0E": "#FAFAFA" };
S.X_STROKE = { "#7F1D1D": "#FECACA", "#14532D": "#BBF7D0", "#1E3A8A": "#BFDBFE" };
S.X_TEXT = { "#A855F7": "#7E22CE", "#EC4899": "#BE185D" };
S.fixLightX = (l) => { penpotUtils.analyzeDescendants(l, (r, s) => { try { const up = c => (c || "").toUpperCase();
  if (s.type === "text") { if (s.fills?.some(f => S.X_TEXT[up(f.fillColor)])) s.fills = s.fills.map(f => ({ ...f, fillColor: S.X_TEXT[up(f.fillColor)] || f.fillColor })); }
  else { if (s.fills?.some(f => S.X_FILL[up(f.fillColor)])) s.fills = s.fills.map(f => ({ ...f, fillColor: S.X_FILL[up(f.fillColor)] || f.fillColor }));
    if (s.strokes?.some(f => S.X_STROKE[up(f.strokeColor)])) s.strokes = s.strokes.map(f => ({ ...f, strokeColor: S.X_STROKE[up(f.strokeColor)] || f.strokeColor })); } } catch (e) {} return null; }); };
S.lightAll = (ids) => ids.map(id => { const nid = S.relight(id); const l = penpotUtils.findShapeById(nid); S.fixLightX(l); S.fixIconOrder(l); return nid; });
// Recentre le dialogue une fois sa hauteur calculée (appel séparé)
S.recenter = (f) => { const d = f.children.find(c => /^Dialog/.test(c.name)); if (d) S.center(f, d); return d ? Math.round(d.height) : 0; };
// Export PDF par tranches (un appel est limité à 120 s) : mêmes noms que storage.exportPage
S.exportPart = async (prefix, start, count) => {
  const pg = penpotUtils.getPages().find(p => p.name.startsWith(prefix)); const page = penpotUtils.getPageById(pg.id);
  if (penpot.currentPage.id !== page.id) { penpot.openPage(page); await wait(3000); }
  const boards = page.root.children.filter(c => c.type === "board"); const isLight = b => /\(clair\)/.test(b.name);
  const sortFn = (a, b) => (Math.round(a.y) - Math.round(b.y)) || (a.x - b.x);
  const all = []; for (const [kind, list] of [["dark", boards.filter(b => !isLight(b)).sort(sortFn)], ["light", boards.filter(isLight).sort(sortFn)]]) list.forEach((b, i) => all.push([kind, i + 1, b]));
  const res = [];
  for (const [kind, i, b] of all.slice(start, start + count)) { const bytes = await b.export({ type: "pdf", scale: 1 }); const name = `${kind}-${prefix}-${String(i).padStart(2, "0")}.pdf`;
    await fetch(`http://127.0.0.1:8787/upload?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes }); res.push(name); }
  return { total: all.length, done: res }; };
S.done = (f) => { S.retext(f); return f.id; };
return "extra ok";
