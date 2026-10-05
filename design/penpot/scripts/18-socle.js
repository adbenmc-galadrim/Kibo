// Socle des écrans 98+ (phase 9) : primitives partagées (S.fx), écrans de base clonés et variante claire dessinée avec la palette claire.
// Un écran = clone d'une base (shell, + Kanban si demandé) puis ses éléments propres ; S.both(n) dessine le sombre puis le clair.
// La palette est changée en place (S.C) : les helpers lisent C à l'appel. S.lightFix corrige les couleurs codées en dur (voile, ombres, alertes).
const S = storage, C = S.C;
S.draw = S.draw || {};
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const wait = ms => new Promise(r => setTimeout(r, ms));
const shadow = (b, o = 0.5) => { b.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: { color: "#000000", opacity: S.mode === "light" ? 0.12 : o } }]; };
const measure = (f, s) => ({ x: Math.round(s.x - f.x), y: Math.round(s.y - f.y), w: Math.round(s.width), h: Math.round(s.height) });
S.lastRel = null;
const rel = (f, s) => { const r = measure(f, s); S.lastRel = { fid: f.id, a: s.id, r }; return r; };
const abs = (f, s, x, y) => { if (s.layoutChild) s.layoutChild.absolute = true; penpotUtils.setParentXY(s, x, y);
  if (S.lastRel && S.lastRel.fid === f.id) s.setPluginData("pin", JSON.stringify({ a: S.lastRel.a, dx: x - S.lastRel.r.x, dy: y - S.lastRel.r.y })); return s; };
const repinOnce = (f) => { let n = 0; for (const s of f.children.filter(x => !!x.getPluginData("pin"))) { const p = JSON.parse(s.getPluginData("pin")); const a = penpotUtils.findShapeById(p.a); if (!a) continue;
  const m = measure(f, a), c = measure(f, s), x = m.x + p.dx, y = m.y + p.dy; if (c.x !== x || c.y !== y) { penpotUtils.setParentXY(s, x, y); n++; } } return n; };
S.applyPins = (f) => repinOnce(f) + repinOnce(f);
S.repinPage = () => penpot.currentPage.root.children.filter(c => c.type === "board").reduce((n, f) => n + S.applyPins(f), 0);
const byText = (root, t) => { const x = penpotUtils.findShape(s => s.type === "text" && s.characters === t, root); return x && x.parent; };

// Même S.box que 01-core, sans écrire les valeurs par défaut du flex (chaque écriture coûte)
S.box = (parent, o = {}) => { const b = penpot.createBoard(); b.name = o.name || "box"; b.resize(o.w || 100, o.h || 100);
  b.fills = o.fill ? [{ fillColor: o.fill, fillOpacity: o.op ?? 1 }] : []; if (o.radius) b.borderRadius = o.radius;
  if (o.stroke) b.strokes = [{ strokeColor: o.stroke, strokeWidth: o.sw || 1, strokeAlignment: "inner", strokeOpacity: 1, ...(o.dashed ? { strokeStyle: "dashed" } : {}) }];
  if (parent) parent.appendChild(b);
  if (o.dir) { const fl = b.addFlexLayout(); if (o.dir !== "row") fl.dir = o.dir; const g = o.gap ?? 0; if (g) { fl.rowGap = g; fl.columnGap = g; }
    const p = o.pad ?? 0; const [pt, pr, pb, pl] = Array.isArray(p) ? (p.length === 2 ? [p[0], p[1], p[0], p[1]] : p) : [p, p, p, p];
    if (pt) fl.topPadding = pt; if (pr) fl.rightPadding = pr; if (pb) fl.bottomPadding = pb; if (pl) fl.leftPadding = pl;
    if (o.align && o.align !== "start") fl.alignItems = o.align; if (o.justify && o.justify !== "start") fl.justifyContent = o.justify;
    if (o.hs && o.hs !== "fix") fl.horizontalSizing = o.hs; if (o.vs && o.vs !== "fix") fl.verticalSizing = o.vs; }
  return b; };

// ---------- Palettes ----------
S.DARK = S.DARK || { ...S.C };
S.LIGHT = { ...S.DARK, bg: "#FFFFFF", fg: "#09090B", card: "#FFFFFF", muted: "#F4F4F5", mfg: "#52525B", dim: "#71717A", border: "#E4E4E7", accent: "#F4F4F5", sidebar: "#FAFAFA", sbBorder: "#E4E4E7", primary: "#18181B", pfg: "#FAFAFA", brandSoft: "#FFEDD5" };
S.mode = "dark";
S.setMode = (m) => { Object.assign(S.C, m === "light" ? S.LIGHT : S.DARK); S.mode = m; };
const LF_FILL = { "#050506": "#F4F4F5", "#431407": "#FFEDD5", "#1F1608": "#FFFBEB", "#0D1F12": "#ECFDF3", "#2A0F0F": "#FEF2F2", "#15131A": "#F5F3FF", "#0B1426": "#EFF6FF", "#2B2B2E": "#FFFFFF", "#0C0C0E": "#FAFAFA", "#111113": "#FFFFFF", "#1C1C1F": "#F4F4F5", "#27272A": "#F4F4F5" };
const LF_STROKE = { "#78350F": "#FCD34D", "#7F1D1D": "#FECACA", "#14532D": "#BBF7D0", "#1E3A8A": "#BFDBFE", "#3F3F46": "#D4D4D8", "#27272A": "#E4E4E7", "#1F1F23": "#E4E4E7", "#52525B": "#71717A", "#71717A": "#A1A1AA" };
const LF_TEXT = { "#06B6D4": "#0E7490", "#F59E0B": "#B45309", "#22C55E": "#15803D", "#EF4444": "#B91C1C", "#3B82F6": "#1D4ED8", "#F97316": "#C2410C", "#FCD34D": "#92400E", "#A855F7": "#7E22CE", "#EC4899": "#BE185D", "#A1A1AA": "#52525B" };
const up = c => (c || "").toUpperCase();
// Ne réécrit que ce qui change (une écriture coûte cher, une lecture non)
S.lightFix = (root, skip) => { let n = 0; penpotUtils.analyzeDescendants(root, (r, s) => { try {
  if (skip && skip.has(s.id)) return null;
  if (s.name === "Overlay") { s.fills = [{ fillColor: "#09090B", fillOpacity: 0.5 }]; n++; return null; }
  if (s.shadows?.some(x => (x.color?.opacity ?? 0) > 0.2)) { s.shadows = s.shadows.map(x => ({ ...x, color: { color: "#000000", opacity: 0.12 } })); n++; }
  if (s.type === "text") { if (s.fills?.some(f => LF_TEXT[up(f.fillColor)])) { s.fills = s.fills.map(f => ({ ...f, fillColor: LF_TEXT[up(f.fillColor)] || f.fillColor })); n++; } return null; }
  if (s.type !== "ellipse" && s.fills?.some(f => LF_FILL[up(f.fillColor)])) { s.fills = s.fills.map(f => ({ ...f, fillColor: LF_FILL[up(f.fillColor)] || f.fillColor })); n++; }
  if (s.strokes?.some(f => LF_STROKE[up(f.strokeColor)])) { s.strokes = s.strokes.map(f => ({ ...f, strokeColor: LF_STROKE[up(f.strokeColor)] || f.strokeColor })); n++; }
  } catch (e) {} return null; }); return n; };

// ---------- Écrans de base ----------
const baseKey = (nav, crumbs, tab, o) => "base · " + JSON.stringify([nav ?? null, crumbs, tab ?? null, o.kanban ? 1 : 0, o.noTicket ? 1 : 0]);
S.fixLogo = (f) => { const ws = find(f, "WorkspaceSwitcher"); if (!ws) return 0; const logo = ws.children.find(c => c.name === "logo"); const t = ws.children.find(c => c.name === "ws-name");
  if (logo && t && logo.x > t.x) { ws.insertChild(0, logo); return 1; } return 0; };
const ensureBase = (key, col, row, nav, crumbs, tab, o) => { const root = penpot.currentPage.root; const lk = key + " (clair)";
  let d = root.children.find(c => c.name === key);
  if (!d) { const m = S.mode; S.setMode("dark"); const n = root.children.filter(c => /^base · /.test(c.name) && !/\(clair\)$/.test(c.name)).length;
    const r = S.screenX(key, 0, 0, nav, crumbs, tab, o.noTicket ? { noTicket: true } : {}); if (o.kanban) S.fillKanban(r.content); d = r.frame; d.x = -40000; d.y = n * 1040; S.retext(d); S.setMode(m); }
  if (S.mode !== "light") return d;
  let l = root.children.find(c => c.name === lk);
  if (!l) { const id = S.relight(d.id); l = penpotUtils.findShapeById(id); S.retext(l); S.fixLightX(l); S.fixIconOrder(l); S.fixLogo(l); }
  return l; };
S.baseScreen = (name, col, row, nav, crumbs, tab, o = {}) => { const light = S.mode === "light"; const full = light ? name + " (clair)" : name;
  const root = penpot.currentPage.root; const old = root.children.find(c => c.name === full); if (old) old.remove();
  const base = ensureBase(baseKey(nav, crumbs, tab, o), col, row, nav, crumbs, tab, o);
  const f = base.clone(); f.name = full; f.x = (col + (light ? 1 : 0)) * 1540; f.y = row * 1040; S.fixIconOrder(f);
  S.fresh = new Set(penpotUtils.findShapes(() => true, f).map(s => s.id));
  return { frame: f, content: find(f, "Content"), col: find(f, "Main"), body: find(f, "Body") }; };
S.dropBases = () => { const bs = penpot.currentPage.root.children.filter(c => /^base · /.test(c.name)); bs.forEach(b => b.remove()); return bs.length; };

// ---------- Dessin sombre puis clair, en tâche de fond (un appel du plugin est limité à 120 s) ----------
const finishOne = async (id) => { const f = penpotUtils.findShapeById(id); if (S.mode === "light") S.lightFix(f, S.fresh); S.fixIconOrder(f); S.retext(f);
  await wait(2000); S.recenter(f); S.applyPins(f); return id; };
S.both = async (n) => { penpot.selection = []; const out = [];
  for (const m of ["dark", "light"]) { S.setMode(m); S.lastRel = null; try { const id = await S.draw[n](); await wait(400); out.push(await finishOne(id)); } finally { S.setMode("dark"); } }
  return out; };
const report = (st) => fetch("http://127.0.0.1:8787/upload?name=job-status.txt", { method: "POST", body: st.status + " " + st.done.length + "/" + st.list.length + " " + (st.current || "") + (st.error ? " " + st.error : "") }).catch(() => null);
S.job = (list) => { const st = S.jobState = { status: "running", done: [], list: list.map(String) }; report(st);
  (async () => { for (const n of list) { st.current = String(n); await S.both(n); st.done.push(String(n)); report(st); } })()
    .then(() => { st.status = "done"; report(st); }).catch(e => { st.status = "error"; st.error = String(e && (e.stack || e.message) || e); report(st); });
  return "started " + list.join(","); };

Object.assign(S.ICONS, {
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  circleDot: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
});

// ---------- Primitives partagées (S.fx) ----------
const menu = (f, x, y, items, w = 232) => { const m = S.box(f, { name: "ContextMenu", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(m); abs(f, m, x, y);
  items.forEach(it => { if (it === "-") { S.fillX(S.box(m, { name: "Separator", fill: C.border, h: 1, w: 10 })); return; }
    if (typeof it === "string") { const l = S.box(m, { name: "MenuLabel", dir: "row", pad: [6, 8], vs: "auto" }); S.fillX(l); S.txt(l, it, { size: 12, weight: 600 }); return; }
    const [label, icon, o = {}] = it; const r = S.box(m, { name: "MenuItem", fill: o.hover ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: o.sub2 ? "start" : "center" }); S.fillX(r); if (o.disabled) r.opacity = 0.5;
    if (o.status !== undefined) { const d = S.box(r, { name: "slot", w: 14, h: 14, dir: "row", align: "center", justify: "center" }); S.statusDot(d, o.status, 8); }
    else if (icon) S.icon(r, icon, 14, o.danger ? C.red : C.mfg); else if (!o.noSlot) S.box(r, { name: "slot", w: 14, h: 14 });
    if (o.sub2) { const tv = S.col(r, { gap: 2 }); S.txt(tv, label, { size: 13, color: C.fg }); S.txt(tv, o.sub2, { size: 11, color: o.sub2Color || C.dim }); }
    else S.fillX(S.txt(r, label, { size: 13, color: o.danger ? C.red : C.fg }));
    if (o.check) S.icon(r, "check", 14, C.fg); if (o.sub) S.icon(r, "chevRight", 14, C.mfg); if (o.kbd) S.txt(r, o.kbd, { size: 11, color: C.dim, mono: true }); if (o.hint) S.txt(r, o.hint, { size: 11, color: C.dim }); });
  return m; };
const tooltip = (f, x, y, t) => { const b = S.box(f, { name: "Tooltip", fill: C.primary, radius: 6, dir: "row", pad: [6, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(b, t, { size: 12, color: C.pfg }); abs(f, b, x, y); return b; };
const dialogAt = (f, d, w, y) => { abs(f, d, Math.round((1440 - w) / 2), y); return d; };
const alertDialog = (f, title, desc, ok = "Supprimer", w = 480, o = {}) => { S.overlay(f);
  const d = S.box(f, { name: "Dialog-" + title, fill: C.card, stroke: C.border, radius: 12, w, dir: "column", gap: 20, pad: 24, vs: "auto" }); shadow(d, 0.5); dialogAt(f, d, w, 380);
  const tv = S.col(d, { gap: 8 }); S.fillX(S.txt(tv, title, { size: 17, weight: 600, lh: 1.3 })); if (desc) S.sub(tv, desc, { size: 13 }); if (o.body) o.body(d);
  if (ok) S.footer(d, o.cancel === undefined ? "Annuler" : o.cancel, ok, o.variant || "destructive"); return d; };
const formDialog = (f, title, w = 440, desc) => { S.overlay(f); const d = S.dialog(f, w, title, desc); dialogAt(f, d, w, 300); return d; };
const input = (p, v, o = {}) => { const i = S.box(p, { name: "Input", fill: C.bg, stroke: o.error ? C.red : (o.focus ? C.mfg : C.border), radius: 6, dir: "row", gap: 8, pad: [8, 10], vs: "auto", align: "center", w: o.w });
  if (!o.w) S.fillX(i); if (o.focus) i.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 0, blur: 0, spread: 3, color: { color: "#71717A", opacity: 0.35 } }]; if (o.h) { i.resize(i.width, o.h); i.flex.verticalSizing = "fix"; i.flex.alignItems = "start"; if (!o.w) S.fillX(i); }
  if (o.icon) S.icon(i, o.icon, 14, C.dim); S.fillX(S.txt(i, v, { size: o.size || 13, weight: o.weight || 400, mono: !!o.mono, color: o.placeholder ? C.dim : C.fg, lh: 1.4 })); if (o.right) o.right(i); return i; };
const select = (p, v, o = {}) => { const s = S.box(p, { name: "Select", fill: C.bg, stroke: o.open ? C.mfg : C.border, radius: 6, dir: "row", gap: 6, pad: [7, 10], vs: "auto", align: "center", w: o.w, hs: o.w ? undefined : "auto" });
  if (o.fill) S.fillX(s); if (o.disabled) s.opacity = 0.5; if (o.lead) o.lead(s); S.txt(s, v, { size: 12, mono: !!o.mono }); if (o.w || o.fill) S.spacer(s); S.icon(s, "chevDown", 12, C.dim); s.name = "Select-" + v; return s; };
const listbox = (f, x, y, opts, w = 200) => { const m = S.box(f, { name: "SelectContent", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(m); abs(f, m, x, y);
  opts.forEach(([t, on, lead, o = {}]) => { const r = S.box(m, { name: "SelectItem", fill: on ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r); if (o.disabled) r.opacity = 0.5;
    if (lead) lead(r); S.fillX(S.txt(r, t, { size: 13 })); if (o.hint) S.txt(r, o.hint, { size: 11, color: C.dim }); if (on) S.icon(r, "check", 14, C.fg); }); return m; };
const help = (p, t, color = C.dim) => S.fillX(S.txt(p, t, { size: 12, color, lh: 1.4 }));
const hline = (p) => S.fillX(S.box(p, { name: "Separator", fill: C.border, h: 1, w: 10 }));
const ringed = (s) => { s.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; return s; };
const item = (f, label) => penpotUtils.findShape(s => /^SidebarItem ?\/ ?/.test(s.name) && s.name.replace(/^SidebarItem ?\/ ?/, "") === label, f);
const labeled = (p, label, fn, o = {}) => { const c = S.col(p, { name: "Field-" + label, gap: 6 }); S.txt(c, label, { size: 12, weight: 500 }); fn(c); if (o.help) help(c, o.help, o.helpColor); return c; };
const segmented = (p, opts, on) => { const g = S.box(p, { name: "ToggleGroup", fill: C.muted, radius: 8, dir: "row", gap: 2, pad: 3, hs: "auto", vs: "auto", align: "center" });
  opts.forEach(o => { const [t, ic] = Array.isArray(o) ? o : [o]; const b = S.box(g, { name: "Toggle-" + t, fill: t === on ? C.bg : null, stroke: t === on ? C.border : null, radius: 6, dir: "row", gap: 6, pad: [5, 10], hs: "auto", vs: "auto", align: "center" });
    if (ic) S.icon(b, ic, 13, t === on ? C.fg : C.mfg); S.txt(b, t, { size: 12, weight: t === on ? 500 : 400, color: t === on ? C.fg : C.mfg }); }); return g; };
const swatches = (p, colors, on) => { const r = S.row(p, { gap: 8, hs: "auto" }); colors.forEach(c => { const b = S.box(r, { name: "Swatch " + c, fill: c, radius: 4, w: 16, h: 16 });
  if (c === on) b.strokes = [{ strokeColor: C.fg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }]; }); return r; };
const iconField = (p, o = {}) => { const r = S.row(p, { gap: 12 }); const prev = S.box(r, { name: "IconPreview", fill: o.color || C.muted, stroke: C.border, radius: 8, w: 48, h: 48, dir: "row", align: "center", justify: "center" });
  if (o.logo) S.logo(prev, 32, S.mode); else if (!o.color) S.icon(prev, "image", 18, C.dim);
  S.button(r, "Choisir une image…", "outline", { sm: true }); S.button(r, "Retirer l'image", "ghost", { sm: true, icon: "trash" }); return r; };
const folderField = (p, v) => { const r = S.row(p, { gap: 8 }); input(r, v, { mono: true, size: 12 }); S.button(r, "Parcourir…", "outline", { sm: true }); return r; };
const card = (p, title, sub, o = {}) => { const b = S.panel(p, { gap: 14, pad: 20, w: o.w }); const h = S.row(b, { gap: 8 }); S.h(h, title, { size: 14 }); if (sub) S.txt(h, sub, { size: 12, color: C.dim }); return b; };
const pageHead = (p, t, sub, right) => { const h = S.row(p, { gap: 12, align: "start" }); const tv = S.col(h, { gap: 4 }); S.txt(tv, t, { size: 20, weight: 600 }); if (sub) S.sub(tv, sub, { size: 13 }); if (right) right(h); return h; };

const SETTINGS = [["building", "Workspace"], ["sliders", "Général"], ["palette", "Apparence"], ["fileText", "Domaines & guidelines"], ["plug", "Intégrations"], ["cloud", "Synchronisation"], ["shield", "Sécurité"], ["package", "Sources de composants"], ["keyboard", "Raccourcis"]];
const settingsScreen = async (page, name, col, row, active) => { await S.page(page);
  const r = S.baseScreen(name, col, row, null, ["Paramètres", "Workspace"], ["settings", "Paramètres"]); S.activate(r.frame, "Paramètres");
  const bc = find(r.frame, "Breadcrumb"); const last = penpotUtils.findShape(s => s.type === "text" && s.characters === "Workspace", bc); if (last && active !== "Workspace") S.setText(last, active);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 24; c.flex.alignItems = "start";
  const nav = S.box(c, { name: "SettingsNav", w: 220, dir: "column", gap: 2, vs: "auto" }); S.box(nav, { name: "gap", w: 1, h: 2 }); S.label(nav, "Workspace"); S.box(nav, { name: "gap", w: 1, h: 4 });
  SETTINGS.forEach(([ic, l]) => S.navItem(nav, ic, l, { active: l === active })); S.fixIconOrder(r.frame);
  const body = S.col(c, { name: "SettingsBody", gap: 16 }); return { ...r, body }; };
const appScreen = async (page, name, col, row, nav, crumbs, tab, o = {}) => { await S.page(page); return S.baseScreen(name, col, row, nav, crumbs, tab, o); };
const kanbanAt = async (page, name, col, row) => appScreen(page, name, col, row, "Kanban", ["Kibo", "Kanban"], ["kanban", "Kibo · Kanban"], { kanban: true });
S.fx = { find, wait, shadow, abs, rel, byText, menu, tooltip, alertDialog, formDialog, input, select, listbox, help, hline, ringed, item, labeled, segmented, swatches, iconField, folderField, card, pageHead, settingsScreen, appScreen, kanbanAt };
return "socle ok";
