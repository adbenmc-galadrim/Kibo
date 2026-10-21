// Socle du redesign : palettes sombre et claire, primitives (texte, boîte, icône, puces, barres), écran.
// Repris de design/penpot/scripts/01-core.js et 02-icons.js, sans dépendre de leur état.
const S = storage;
S.PAL = {
  dark: { bg: "#09090B", panel: "#0C0C0E", card: "#111113", muted: "#18181B", hover: "#1C1C1F", border: "#27272A", soft: "#1F1F23",
    fg: "#FAFAFA", mfg: "#A1A1AA", dim: "#71717A", faint: "#52525B", primary: "#FAFAFA", pfg: "#18181B",
    brand: "#F97316", brandBtn: "#C2410C", brandSoft: "#2A1406", brandLine: "#7C2D12", brandText: "#FB923C",
    blue: "#3B82F6", purple: "#A855F7", green: "#22C55E", red: "#EF4444", amber: "#F59E0B",
    blueSoft: "#0B1426", purpleSoft: "#1A1024", greenSoft: "#0D1F12", redSoft: "#2A0F0F", amberSoft: "#1F1608", hold: "#22D3EE", holdSoft: "#082F35",
    track: "#27272A", grid: "#1A1A1D", canvas: "#0B0B0D" },
  light: { bg: "#FFFFFF", panel: "#FAFAFA", card: "#FFFFFF", muted: "#F4F4F5", hover: "#F4F4F5", border: "#E4E4E7", soft: "#EEEEF0",
    fg: "#09090B", mfg: "#52525B", dim: "#71717A", faint: "#A1A1AA", primary: "#18181B", pfg: "#FAFAFA",
    brand: "#EA580C", brandBtn: "#C2410C", brandSoft: "#FFF7ED", brandLine: "#FDBA74", brandText: "#C2410C",
    blue: "#2563EB", purple: "#9333EA", green: "#16A34A", red: "#DC2626", amber: "#D97706",
    blueSoft: "#EFF6FF", purpleSoft: "#FAF5FF", greenSoft: "#F0FDF4", redSoft: "#FEF2F2", amberSoft: "#FFFBEB", hold: "#0E7490", holdSoft: "#ECFEFF",
    track: "#E4E4E7", grid: "#EDEDEF", canvas: "#FAFAFA" },
};
S.C = S.C || {};
S.setMode = (m) => { Object.assign(S.C, S.PAL[m]); S.mode = m; };
S.setMode("dark");
S.bodyFont = null; S.monoFont = null;
// Hors flex, un enfant se place relativement au board parent (o.x, o.y) ; sinon le flex le place.
S.free = (parent) => parent && parent.type === "board" && !parent.flex && !parent.grid && parent !== penpot.currentPage.root;
S.placed = [];
S.put = (parent, s, o = {}) => { if (!parent) return s; parent.appendChild(s); if (S.free(parent)) { s.x = parent.x + (o.x || 0); s.y = parent.y + (o.y || 0); S.placed.push([s, parent, o.x || 0, o.y || 0]); } return s; };
// Une position posée pendant le calcul de la mise en page peut être perdue : la réappliquer une fois l'écran dessiné.
S.replace = () => { let n = 0; for (const [s, p, x, y] of S.placed) { if (Math.abs(s.x - p.x - x) > 0.5 || Math.abs(s.y - p.y - y) > 0.5) { s.x = p.x + x; s.y = p.y + y; n++; } } S.placed = []; return n; };
S.font = penpot.fonts.findByName("Geist"); S.mono = penpot.fonts.findByName("Geist Mono");

S.txt = (parent, chars, o = {}) => {
  const C = S.C, t = penpot.createText(chars);
  S.fontCache = S.fontCache || {};
  const f = o.font ? (S.fontCache[o.font] = S.fontCache[o.font] || penpot.fonts.findByName(o.font)) : o.mono ? (S.monoFont ? (S.fontCache[S.monoFont] = S.fontCache[S.monoFont] || penpot.fonts.findByName(S.monoFont)) : S.mono) : (S.bodyFont ? (S.fontCache[S.bodyFont] = S.fontCache[S.bodyFont] || penpot.fonts.findByName(S.bodyFont)) : S.font);
  const style = o.italic ? "italic" : "normal";
  const v = f.variants.find(v => v.fontWeight === String(o.weight || 400) && v.fontStyle === style) || f.variants.find(v => v.fontStyle === style) || f.variants[0];
  f.applyToText(t, v);
  t.fontSize = String(o.size || 13); t.fills = [{ fillColor: o.color || C.fg, fillOpacity: 1 }];
  if (o.lh) t.lineHeight = String(o.lh); if (o.ls) t.letterSpacing = String(o.ls); if (o.upper) t.textTransform = "uppercase";
  if (o.align) t.align = o.align;
  t.growType = "auto-width"; t.name = (o.name || chars.slice(0, 40)).replace(/\//g, "-") || "texte";
  S.put(parent, t, o);
  if (o.w) { t.growType = "auto-height"; t.resize(o.w, t.height); }
  if (o.fill && t.layoutChild) { t.layoutChild.horizontalSizing = "fill"; t.growType = "auto-height"; }
  return t; };

S.box = (parent, o = {}) => {
  const b = penpot.createBoard(); b.name = o.name || "box"; b.resize(o.w || 100, o.h || 100);
  b.fills = o.fill ? [{ fillColor: o.fill, fillOpacity: o.op ?? 1 }] : [];
  if (o.radius) b.borderRadius = o.radius;
  if (o.stroke) b.strokes = [{ strokeColor: o.stroke, strokeWidth: o.sw || 1, strokeAlignment: "inner", strokeOpacity: 1, ...(o.dashed ? { strokeStyle: "dashed" } : {}) }];
  if (o.shadow) b.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: o.shadow, blur: o.shadow * 4, spread: 0, color: { color: "#000000", opacity: S.mode === "dark" ? 0.5 : 0.08 } }];
  b.clipContent = !!o.clip;
  S.put(parent, b, o);
  if (o.dir) { const fl = b.addFlexLayout(); fl.dir = o.dir; fl.rowGap = o.gap ?? 0; fl.columnGap = o.gap ?? 0;
    const p = o.pad ?? 0; const [pt, pr, pb, pl] = Array.isArray(p) ? (p.length === 2 ? [p[0], p[1], p[0], p[1]] : p) : [p, p, p, p];
    fl.topPadding = pt; fl.rightPadding = pr; fl.bottomPadding = pb; fl.leftPadding = pl;
    fl.alignItems = o.align || "start"; fl.justifyContent = o.justify || "start";
    if (o.wrap) fl.wrap = "wrap";
    fl.horizontalSizing = o.hs || "fix"; fl.verticalSizing = o.vs || "fix"; }
  if (o.fx && b.layoutChild) b.layoutChild.horizontalSizing = "fill";
  if (o.fy && b.layoutChild) b.layoutChild.verticalSizing = "fill";
  return b; };
S.row = (parent, o = {}) => S.box(parent, { dir: "row", align: "center", hs: o.w ? "fix" : "auto", vs: o.h ? "fix" : "auto", ...o });
S.col = (parent, o = {}) => S.box(parent, { dir: "column", hs: o.w ? "fix" : "auto", vs: o.h ? "fix" : "auto", ...o });
S.spacer = (parent) => S.box(parent, { name: "spacer", w: 1, h: 1, fx: true });
S.fillX = (s) => { if (s.layoutChild) { s.layoutChild.horizontalSizing = "fill"; if (s.type === "text") s.growType = "auto-height"; } return s; };
S.abs = (s) => { if (s.layoutChild) s.layoutChild.absolute = true; return s; };
S.at = (s, parent, x, y) => { s.x = parent.x + x; s.y = parent.y + y; return s; };
S.hline = (parent, color, o = {}) => S.box(parent, { name: "line", w: o.w || 10, h: 1, fill: color || S.C.soft, fx: !o.w });
S.vline = (parent, color, h) => S.box(parent, { name: "vline", w: 1, h: h || 10, fill: color || S.C.soft, fy: !h });

S.ICONS = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  kanban: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
  graph: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  question: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/>',
  merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  branch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  milestone: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  settings: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>', chevRight: '<path d="m9 18 6-6-6-6"/>', chevLeft: '<path d="m15 18-6-6 6-6"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  circleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  filter: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
  zoomOut: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  panelRight: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
S.icon = (parent, name, size = 16, color, sw = 2, o = {}) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color || S.C.mfg}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${S.ICONS[name]}</svg>`;
  const s = penpot.createShapeFromSvg(svg); s.name = "icon/" + name; s.resize(size, size); S.put(parent, s, o); return s; };
S.svg = (parent, markup, name = "svg", o = {}) => { const s = penpot.createShapeFromSvg(markup); s.name = name; S.put(parent, s, o); return s; };

S.dot = (p, color, sz = 8) => { const d = penpot.createEllipse(); d.resize(sz, sz); d.fills = [{ fillColor: color, fillOpacity: 1 }]; d.name = "dot"; return S.put(p, d); };
S.ring = (p, color, sz = 8, w = 1.5) => { const d = penpot.createEllipse(); d.resize(sz, sz); d.fills = []; d.strokes = [{ strokeColor: color, strokeWidth: w, strokeAlignment: "inner", strokeOpacity: 1 }]; d.name = "ring"; return S.put(p, d); };
S.statusColor = (st) => ({ "À faire": S.C.dim, "En cours": S.C.blue, "En review": S.C.purple, "Bloqué": S.C.red, "Terminé": S.C.green })[st] || S.C.dim;
S.status = (p, st, sz = 8) => st === "À faire" ? S.ring(p, S.C.dim, sz) : S.dot(p, S.statusColor(st), sz);
S.halo = (p, color, sz = 8) => { const w = S.box(p, { name: "halo", w: sz + 6, h: sz + 6, radius: (sz + 6) / 2, fill: color, op: 0.22, dir: "row", align: "center", justify: "center" }); S.dot(w, color, sz); return w; };

S.chip = (p, label, o = {}) => { const C = S.C;
  const b = S.row(p, { name: "chip", fill: o.fill === undefined ? null : o.fill, stroke: o.stroke === undefined ? C.border : o.stroke, radius: o.radius ?? 4, pad: o.pad || [2, 6], gap: 4 });
  if (o.dot) S.dot(b, o.dot, 6); if (o.icon) S.icon(b, o.icon, o.isz || 12, o.ic || o.color || C.mfg);
  S.txt(b, label, { size: o.size || 11, mono: o.mono, weight: o.weight || 500, color: o.color || C.mfg }); return b; };
S.setChip = (p, key) => S.chip(p, key, { mono: true, size: 10.5, color: S.C.mfg, stroke: S.C.border, pad: [1, 5], weight: 500 });
S.kbd = (p, label) => S.chip(p, label, { mono: true, size: 10, color: S.C.dim, stroke: S.C.border, pad: [1, 4], weight: 400 });
S.btn = (p, label, variant = "outline", o = {}) => { const C = S.C;
  const st = { default: [C.primary, C.pfg, null], outline: [null, C.fg, C.border], ghost: [null, C.mfg, null], brand: [C.brandBtn, "#FFFFFF", null], soft: [C.muted, C.fg, null], brandOutline: [C.brandSoft, C.brandText, C.brandLine] }[variant];
  const b = S.row(p, { name: "Button/" + variant, fill: st[0], stroke: st[2], radius: o.radius ?? 6, pad: o.pad || (o.sm ? [5, 10] : [7, 14]), gap: 6, justify: "center" });
  if (o.icon) S.icon(b, o.icon, o.sm ? 13 : 15, o.ic || st[1]); if (label) S.txt(b, label, { size: o.size || (o.sm ? 12 : 13), weight: 500, color: st[1] });
  if (o.dot) S.dot(b, o.dot, 6); if (o.count) S.chip(b, o.count, { size: 10, color: C.mfg, stroke: null, fill: C.muted, pad: [0, 5], mono: true }); return b; };
S.avatar = (p, initials, sz = 24, o = {}) => { const C = S.C;
  const a = S.box(p, { name: "avatar", w: sz, h: sz, radius: sz / 2, fill: o.fill || C.muted, stroke: o.stroke || C.border, dir: "row", align: "center", justify: "center" });
  if (o.icon) S.icon(a, o.icon, Math.round(sz * 0.55), o.ic || C.mfg); else S.txt(a, initials, { size: Math.round(sz * 0.4), weight: 600, color: o.color || C.fg }); return a; };
S.agentMark = (p, sz = 24) => S.avatar(p, "", sz, { icon: "bot", fill: S.C.brandSoft, stroke: S.C.brandLine, ic: S.C.brand });

// Barre d'avancement : piste et remplissage, en flex pour suivre la mise en page.
S.bar = (p, w, ratio, o = {}) => { const C = S.C, h = o.h || 6;
  const t = S.row(p, { name: "bar", w, h, fill: o.track || C.track, radius: o.radius ?? h / 2, clip: true, align: "start" });
  if (ratio > 0) S.box(t, { name: "fill", w: Math.max(h, Math.round(w * ratio)), h, fill: o.color || C.fg, radius: o.radius ?? h / 2 }); return t; };
// Barre segmentée : une case par élément, couleur par élément (statuts des sous-tickets, étapes de livraison).
S.segs = (p, colors, o = {}) => { const g = S.row(p, { name: "segs", gap: o.gap ?? 2 });
  for (const c of colors) S.box(g, { name: "seg", w: o.w || 6, h: o.h || 6, radius: o.radius ?? 1.5, fill: c }); return g; };
S.stepColors = (step, o = {}) => { const C = S.C; const out = [];
  for (let i = 0; i < 12; i++) out.push(step == null ? C.track : i < step ? (o.done || C.mfg) : i === step ? (o.cur || C.brand) : C.track); return out; };

// Écran : board de premier niveau, nom suffixé « (clair) » en clair.
S.screen = (name, x, y, w = 1440, h = 960) => { const C = S.C;
  const f = penpot.createBoard(); f.name = S.mode === "light" ? name + " (clair)" : name; f.resize(w, h); f.x = x; f.y = y;
  f.fills = [{ fillColor: C.bg, fillOpacity: 1 }]; f.clipContent = true; penpot.currentPage.root.appendChild(f); return f; };
S.dropScreen = (name) => { for (const c of penpot.currentPage.root.children) if (c.name === name || c.name === name + " (clair)") c.remove(); };
S.wait = (ms) => new Promise(r => setTimeout(r, ms));
return "base ok";
