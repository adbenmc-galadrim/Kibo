// Phase 27 (spec §39) : suivi seul, création de projet, constats des critiques (§39.6).
// Boards de la page « Proposition », rangées à partir de y = 8 000 (pas de 1 500), sombre à x = 0, clair à x = 1 540.
// Repose sur 01-base, 02-data, 10-shell, 20-piste-a, 50-proposition et 55-proposition-v2 ; couleurs et vocabulaire inchangés.
const S = storage;
S.draw = S.draw || {};
Object.assign(S.ICONS, {
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  chevUp: '<path d="m18 15-6-6-6 6"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>',
  minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
  triangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  panelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
});
S.Y27 = 8000; S.STEP27 = 1500;
S.ROWS27 = ["p-vue3", "p-commencer", "p-nouveau", "p-kanban", "p-fiche", "p-fiche-act", "p-questions", "p-barre", "p-agent-q", "p-agent-recap", "p-vue3-retard"];
S.rename = (f, name) => { f.name = S.mode === "light" ? name + " (clair)" : name; return f; };
S.resizeScreen = (f, h) => { f.resize(f.width, h); const root = f.children.find(c => c.name === "root"); if (root) root.resize(root.width, h); return f; };
S.parentOf = (scope, child) => penpotUtils.findShapes(s => s.type === "board" && (s.children || []).some(c => c.id === child.id), scope)[0];
S.byText = (scope, chars) => penpotUtils.findShapes(s => s.type === "text" && s.characters === chars, scope)[0];
S.insertAfter = (parent, ref, shape) => { const i = parent.children.findIndex(c => c.id === ref.id); parent.insertChild(i + 1, shape); return shape; };
S.veil = (f) => S.box(f, { name: "veil", x: 0, y: 0, w: f.width, h: f.height, fill: S.C.bg, op: 0.6 });
S.cloneScreen = (name, x, y) => { const src = penpot.currentPage.root.children.find(c => c.name === (S.mode === "light" ? name + " (clair)" : name));
  if (!src) throw new Error("missing board: " + name); const c = src.clone(); c.x = x; c.y = y; return c; };

// ---------- Barres et coque ----------
S.PAGES27 = ["Vue d'ensemble", "Planning", "Kanban", "Graphe", "Questions"];
S.shell27 = (f, active, o = {}) => { const C = S.C;
  const root = S.box(f, { name: "root", w: f.width, h: f.height, dir: "row", align: "stretch" });
  if (o.collapsed) S.sidebarIcons(root, active); else S.sidebar(root, active, { pages: o.pages || S.PAGES_P, counts: o.counts || S.COUNTS_P });
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbar(main, o.crumbs || ["Emis", active], t => { S.syncChip(t); if (o.right) o.right(t); S.agentButton(t, o.agentOn ? { on: true } : o.agentCount === null ? {} : { count: o.agentCount || "3" }); });
  return { root, main }; };
// Barre latérale repliée en icônes (48 px) : sous 1 180 px de large (§39.6.16).
S.sidebarIcons = (p, active) => { const C = S.C;
  const sb = S.col(p, { name: "sidebar", w: 48, fy: true, fill: C.panel, pad: [12, 0], gap: 4, align: "center" });
  const item = (icon, on, o = {}) => { const b = S.box(sb, { name: "nav-icon/" + (o.name || icon), w: 32, h: 32, radius: 6, fill: on ? C.hover : null, stroke: o.stroke ? C.border : null, dir: "row", align: "center", justify: "center" });
    S.icon(b, icon, 16, on ? C.fg : C.mfg); return b; };
  item("panelLeft", false, { name: "Déplier" }); item("search", false, { stroke: true }); S.box(sb, { w: 4, h: 6 });
  item("home"); item("ticket"); item("inbox"); S.box(sb, { w: 4, h: 6 });
  const proj = (n, c, on) => { const b = S.box(sb, { name: "project/" + n, w: 32, h: 32, radius: 6, fill: on ? C.hover : null, dir: "row", align: "center", justify: "center" });
    const t = S.box(b, { w: 22, h: 22, radius: 5, fill: c, dir: "row", align: "center", justify: "center" }); S.txt(t, n[0], { size: 11, weight: 600, color: "#FFFFFF" }); return b; };
  proj("Emis", S.D.project.color, true); for (const [n, c] of S.D.projects.slice(1)) proj(n, c, false);
  S.box(sb, { w: 4, h: 4, fy: true }); item("settings"); S.avatar(sb, "AB", 24);
  S.vline(p, C.soft); return sb; };
S.pagesMenu = (f, x, y, active) => { const C = S.C;
  const m = S.col(f, { name: "pages-menu", x, y, w: 222, pad: 6, gap: 2, radius: 8, stroke: C.border, fill: C.card, shadow: 10 });
  const h = S.row(m, { fx: true, h: 30, pad: [0, 8] }); S.txt(h, "Emis", { size: 13, weight: 600 });
  for (const pg of S.PAGES_P) { const on = pg === active, r = S.row(m, { fx: true, h: 32, pad: [0, 8], gap: 10, radius: 6, fill: on ? C.hover : null });
    S.icon(r, S.NAV_ICON[pg], 15, on ? C.fg : C.mfg); S.txt(r, pg, { size: 13, weight: on ? 500 : 400 }); }
  return m; };
S.scrollFade = (p, side, o = {}) => { const C = S.C, n = 8, step = (o.size || 32) / n;
  for (let i = 0; i < n; i++) { const t = (i + 1) / n * 0.9;
    if (side === "bottom") S.box(p, { name: "scroll-shadow", x: o.x || 0, y: o.y + i * step, w: o.w, h: step + 0.5, fill: o.fill || C.panel, op: t });
    else S.box(p, { name: "scroll-shadow", x: o.x + i * step, y: o.y || 0, w: step + 0.5, h: o.h, fill: o.fill || C.bg, op: t }); } };

// ---------- Champs de formulaire (shadcn) ----------
S.input = (p, value, o = {}) => { const C = S.C;
  const r = S.row(p, { name: "input", fx: !o.w, w: o.w, h: 36, pad: [0, 12], gap: 8, radius: 6, stroke: o.focus ? C.mfg : C.border, fill: C.bg });
  if (o.icon) S.icon(r, o.icon, 14, C.dim); S.txt(r, value, { size: 13, mono: o.mono, color: o.placeholder ? C.dim : C.fg }); S.spacer(r); if (o.right) o.right(r); return r; };
S.field = (p, label, build, help, o = {}) => { const C = S.C;
  const c = S.col(p, { name: "field/" + label, fx: !o.w, w: o.w, gap: 6 }); const l = S.row(c, { gap: 6 }); S.txt(l, label, { size: 13, weight: 500 }); if (o.opt) S.txt(l, "facultatif", { size: 12, color: C.dim });
  build(c); if (help) S.txt(c, help, { size: 12, color: C.mfg, fill: true, lh: 1.4 }); return c; };
S.radio = (p, label, on) => { const C = S.C; const r = S.row(p, { gap: 8 });
  const b = S.box(r, { name: "radio", w: 16, h: 16, radius: 8, stroke: on ? C.fg : C.border, sw: on ? 1.5 : 1, dir: "row", align: "center", justify: "center" }); if (on) S.dot(b, C.fg, 8);
  S.txt(r, label, { size: 13 }); return r; };
S.checkbox = (p, on) => { const C = S.C; const b = S.box(p, { name: "check", w: 18, h: 18, radius: 9, stroke: on ? null : C.border, fill: on ? C.green : null, dir: "row", align: "center", justify: "center" });
  if (on) S.icon(b, "check", 11, "#FFFFFF", 3); return b; };
S.toast = (p, text, action, o = {}) => { const C = S.C;
  const t = S.row(p, { name: "toast", x: o.x, y: o.y, pad: [12, 14], gap: 10, radius: 8, stroke: C.border, fill: C.card, shadow: 6 });
  S.icon(t, o.icon || "circleCheck", 15, o.ic || C.green); S.txt(t, text, { size: 13, weight: 500 }); if (action) S.btn(t, action, "outline", { sm: true }); return t; };

// ---------- P1 bis v3 · Vue d'ensemble : « 1 en retard » et carte « En retard » sous Échéances ----------
// Au 16 oct., S42 est en cours : aucune carte « En retard » (référence pixel). Au 18 oct., entre deux sprints, S42 reste courant
// (« terminé le 16 oct. ») et F5 est en retard : carte « En retard » sous Échéances et « 1 en retard » sous Fonctionnalités.
S.setText = (scope, from, to) => { const t = S.byText(scope, from); if (!t) throw new Error("missing text: " + from); t.characters = to; return t; };
// Tour 2 (§39.6.18, .21) : « En cours n / limite », bloquées nommées, état du sprint par sprintPhase, « à risque » au 16 oct.
S.inProgress27 = (f, late) => { const C = S.C;
  const kpis = penpotUtils.findShapes(s => s.name === "kpis", f)[0];
  S.setText(kpis, "Ouvertes", "En cours"); S.setText(kpis, "sur 2 max", "/ 2");
  const lim = S.setText(kpis, "limite atteinte", "limite · bloquée : F6"), open = S.parentOf(kpis, lim);
  const dot = open.children.find(c => c.name === "dot"); if (dot) dot.fills = [{ fillColor: C.red, fillOpacity: 1 }];
  const grid = penpotUtils.findShapes(s => s.name === "grid", f)[0];
  for (const [key, color] of late ? [["F5", C.red]] : [["F4", C.amber], ["F5", C.amber]]) { const t = S.byText(grid, key); if (t) t.fills = [{ fillColor: color, fillOpacity: 1 }]; }
  const sp = penpotUtils.findShapes(s => s.name === "card / Sprint S42 · Terrain hors ligne", f)[0] || f;
  S.parentOf(sp, S.byText(sp, "2/2 ouvertes")).remove();
  S.setText(sp, "Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5.", "Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5.");
  if (late) { S.setText(sp, "12–16 oct.", "S43 commence lun. 19 oct."); S.setText(sp, "Sprint S42 · Terrain hors ligne", "Dernier sprint · S42 terminé"); }
  for (const t of penpotUtils.findShapes(s => s.type === "text" && s.characters === "ouverte", sp)) { const pill = S.parentOf(sp, t), st = S.parentOf(sp, pill); pill.remove();
    if (late) S.pill(st, "en cours", C.blue, C.blueSoft); else S.pill(st, "à risque", C.amber, C.amberSoft, "triangleAlert"); }
  if (!late) for (const t of penpotUtils.findShapes(s => s.type === "text" && s.characters === "en retard", sp)) { const pill = S.parentOf(sp, t), st = S.parentOf(sp, pill); pill.remove(); S.pill(st, "à risque", C.amber, C.amberSoft, "triangleAlert"); }
  if (late) return kpis;
  S.setText(kpis, "finit ce soir", "Terrain ho…"); S.setText(kpis, "Terrain hors ligne", "se termine aujourd'hui");
  const segs = penpotUtils.findShapes(s => s.name === "segs", kpis)[0], sub = S.parentOf(kpis, segs);
  for (const c of segs.children) c.resize(5, c.height);
  sub.layoutChild.horizontalSizing = "fill"; S.spacer(sub); S.txt(sub, "2 à risque", { size: 12, color: C.amber });
  return kpis; };
S.vue3 = (x, y, late) => { const C = S.C, sec = C.mfg;
  const f5 = S.feat("F5"), wasLate = f5.late; if (!late) f5.late = false;
  let f; S.V3 = true; try { f = S.rename(S.draw["p-vue2"](x, y), late ? "P1 bis v3 · En retard au 18 oct." : "P1 bis v3 · Vue d'ensemble"); } finally { f5.late = wasLate; S.V3 = false; }
  const kpis = S.inProgress27(f, late);
  if (!late) return f;
  S.resizeScreen(f, 1360);
  const segs = penpotUtils.findShapes(s => s.name === "segs", kpis)[0], sub = S.parentOf(kpis, segs);
  segs.remove(); S.icon(sub, "clockAlert", 12, C.red); S.txt(sub, "1 en retard", { size: 12, weight: 500, color: C.red });
  S.setText(kpis, "finit ce soir", "Terrain ho…"); S.setText(kpis, "Terrain hors ligne", "terminé le 16 oct. · reste 2");
  S.setText(f, "S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.",
    "S42 est terminé depuis vendredi et F5 n'y a pas tenu : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.");
  S.setText(f, "4 étapes restantes, S42 finit aujourd'hui", "4 étapes restantes, S42 terminé le 16 oct.");
  const ap = penpotUtils.findShapes(s => s.name === "agent-panel", f)[0]; S.setText(ap, "Résumé du jour", "Dernier résumé"); S.setText(ap, "14:40", "16 oct. · 14:40");
  const grid = penpotUtils.findShapes(s => s.name === "grid", f)[0], today = penpotUtils.findShapes(s => s.name === "today", grid)[0], tl = S.parentOf(grid, S.byText(grid, "aujourd'hui"));
  const dx = 2 / 7 * (806 - 250) / 4; today.x += dx; tl.x += dx; for (const e of S.placed) if (e[0].id === today.id || e[0].id === tl.id) e[2] += dx;
  const band = penpotUtils.findShapes(s => s.name === "card / Échéances", f)[0], body = S.parentOf(f, band);
  const card = S.col(null, { name: "card/En retard", w: 810, stroke: C.border, radius: 10, fill: C.card, clip: true });
  const h = S.row(card, { fx: true, h: 44, pad: [0, 16], gap: 8 }); S.icon(h, "clockAlert", 15, C.red); S.txt(h, "En retard", { size: 14, weight: 600 });
  const k = S.row(h, { pad: [0, 7], radius: 9, fill: C.redSoft }); S.txt(k, "1", { size: 12, weight: 500, mono: true, color: C.red });
  S.spacer(h); S.txt(h, "sprint terminé, étapes obligatoires restantes", { size: 12.5, color: sec });
  const r = S.row2(card, { h: 38, gap: 10 }); const ft = S.feat("F5");
  const a = S.row(r, { w: 26 }); S.txt(a, "F5", { size: 12, mono: true, color: sec });
  const b = S.row(r, { fx: true }); S.txt(b, ft.name, { size: 13, weight: 500 });
  const sp = S.row(r, { w: 160, gap: 6 }); S.icon(sp, "sprint", 12, sec); S.txt(sp, "S42", { size: 12, mono: true, color: sec }); S.txt(sp, "· terminé le 16 oct.", { size: 12, color: sec });
  const st = S.row(r, { w: 118 }); S.pill(st, "reste 4 étapes", C.red, C.redSoft, "clockAlert");
  const cs = S.row(r, { w: 84 }); S.fCases(cs, ft, { w: 12, h: 8, gap: 3 });
  const n = S.row(r, { w: 30, justify: "end" }); S.txt(n, "1/5", { size: 12.5, mono: true });
  S.insertAfter(body, band, card); card.layoutChild.horizontalSizing = "fill";
  return f; };
S.draw["p-vue3"] = (x, y) => S.vue3(x, y, false);
S.draw["p-vue3-retard"] = (x, y) => S.vue3(x, y, true);

// ---------- P1 bis v3 · Pour commencer : projet neuf, cinq pages, six sprints ----------
S.kpis27 = (p, cells) => { const C = S.C, sec = C.mfg;
  const k = S.row(p, { name: "kpis", fx: true, h: 92, stroke: C.border, radius: 10, fill: C.card, align: "stretch" });
  cells.forEach(([icon, label, value, unit, sub], i) => { if (i) S.vline(k, C.soft);
    const c = S.col(k, { fx: true, pad: [12, 18], gap: 5 }); const l = S.row(c, { gap: 6 }); S.icon(l, icon, 14, sec); S.txt(l, label, { size: 12.5, weight: 500, color: sec });
    const v = S.row(c, { gap: 6, align: "end" }); S.txt(v, value, { size: 28, weight: 600, ls: -0.5, lh: 1, color: C.fg }); if (unit) S.txt(v, unit, { size: 13, color: sec });
    const s = S.row(c, { h: 16, gap: 6 }); S.txt(s, sub, { size: 12, color: sec }); });
  return k; };
S.SPRINTS27 = [["S1", "19–23 oct."], ["S2", "26–30 oct."], ["S3", "2–6 nov."], ["S4", "9–13 nov."], ["S5", "16–20 nov."], ["S6", "23–27 nov."]];
S.draw["p-commencer"] = (x, y) => { const C = S.C, sec = C.mfg;
  const f = S.screen("P1 bis v3 · Pour commencer", x, y, 1440, 1000);
  const { main } = S.shell27(f, "Vue d'ensemble", { pages: S.PAGES27, counts: {}, agentCount: null, right: t => S.btn(t, "Nouveau ticket", "outline", { sm: true, icon: "plus" }) });
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24, 24, 24], gap: 14 });
  const ht = S.col(body, { gap: 4 }); S.txt(ht, "Emis", { size: 24, weight: 600, ls: -0.3 });
  const hs = S.row(ht, { gap: 8 }); S.icon(hs, "building", 13, sec); S.txt(hs, "client Emis SA", { size: 13, color: sec }); S.txt(hs, "·", { size: 13, color: C.faint }); S.txt(hs, "6 sprints d'une semaine · du 19 oct. au 27 nov. 2026", { size: 13, color: sec });
  S.kpis27(body, [["package", "Fonctionnalités", "0", "livrées sur 0", "aucune pour l'instant"], ["sprint", "Sprint en cours", "—", null, "S1 commence le lun. 19 oct."],
    ["target", "En cours", "0", "/ 2", "aucune en cours"], ["pr", "En review", "0", "PR", "aucune PR"], ["question", "Questions", "0", "ouvertes", "aucune question"]]);
  const cols = S.row(body, { fx: true, gap: 16, align: "start" });
  const go = S.card2(cols, "Pour commencer", "flag", { count: "0/2", right: h => S.txt(h, "deux étapes pour suivre le projet", { size: 12.5, color: sec }) });
  const step = (title, help, btn, icon) => { const r = S.row2(go, { pad: [14, 16], gap: 12, align: "start" }); S.checkbox(r, false);
    const tc = S.col(r, { fx: true, gap: 4 }); const tt = S.row(tc, { gap: 6 }); S.txt(tt, title, { size: 13.5, weight: 500 });
    S.txt(tc, help, { size: 12.5, color: sec, fill: true, lh: 1.4 }); S.btn(r, btn, "outline", { sm: true, icon }); };
  step("Relier le dépôt", "Choisis le dossier du dépôt : branches, PR et CI remontent seuls.", "Choisir le dossier", "folderOpen");
  step("Créer une fonctionnalité", "Elle se livre de A à Z ; ses étapes deviennent EMIS-1, EMIS-2…", "Nouvelle fonctionnalité", "plus");
  const sp = S.card2(cols, "Sprints", "sprint", { w: 300, count: "6" });
  S.SPRINTS27.forEach(([k, d], i) => { const r = S.row2(sp, { h: 38, gap: 10 }); const a = S.row(r, { w: 26 }); S.txt(a, k, { size: 12, mono: true, color: i ? sec : C.fg, weight: i ? 400 : 600 });
    const b = S.row(r, { fx: true }); S.txt(b, "Sprint " + (i + 1), { size: 13 }); S.txt(r, d, { size: 12.5, color: sec }); });
  return f; };

// ---------- P6 · Nouveau projet : dialogue de 520 px sur la Vue d'ensemble d'Emis ----------
S.draw["p-nouveau"] = async (x, y) => { const C = S.C, sec = C.mfg;
  const f = S.rename(S.cloneScreen("P1 bis v3 · Vue d'ensemble", x, y), "P6 · Nouveau projet"); S.resizeScreen(f, 1000); S.veil(f);
  const d = S.col(f, { name: "dialog", x: 460, y: 80, w: 520, pad: 24, gap: 18, radius: 12, stroke: C.border, fill: C.bg, shadow: 12 });
  const hd = S.row(d, { fx: true, gap: 12, align: "start" }); const ht = S.col(hd, { fx: true, gap: 6 }); S.txt(ht, "Nouveau projet", { size: 18, weight: 600 });
  S.txt(ht, "Un projet suivi : ses pages et ses sprints sont créés aussitôt.", { size: 13, color: sec, fill: true }); S.icon(hd, "x", 16, sec);
  S.field(d, "Nom", c => S.input(c, "Emis", { focus: true }));
  const r1 = S.row(d, { fx: true, gap: 12, align: "start" });
  S.field(r1, "Clé", c => S.input(c, "EMIS", { mono: true }), "2 à 6 lettres majuscules, unique.", { w: 190 });
  S.field(r1, "Client", c => S.input(c, "Emis SA"), "Facultatif. Destinataire des questions client.", { opt: false });
  const r2 = S.row(d, { fx: true, gap: 12, align: "start" });
  S.field(r2, "Début du premier sprint", c => S.input(c, "19/10/2026", { right: r => S.icon(r, "calendar", 14, sec) }));
  S.field(r2, "Nombre de sprints", c => S.input(c, "6", { right: r => { const s = S.col(r, { gap: 0 }); S.icon(s, "chevUp", 11, sec); S.icon(s, "chevDown", 11, sec); } }), null, { w: 150 });
  S.field(d, "Durée d'un sprint", c => { const r = S.row(c, { gap: 20, h: 22 }); S.radio(r, "1 semaine", true); S.radio(r, "2 semaines", false); });
  const pv = S.col(d, { name: "preview", fx: true, pad: [12, 14], gap: 10, radius: 8, fill: C.muted });
  const ph = S.row(pv, { fx: true, gap: 8 }); S.icon(ph, "sprint", 14, C.fg); S.txt(ph, "6 sprints d'une semaine · du 19 oct. au 27 nov. 2026", { size: 13, weight: 500 }); S.spacer(ph); S.icon(ph, "chevUp", 14, sec);
  const grid = S.row(pv, { fx: true, gap: 8, wrap: true });
  for (const [k, dd] of S.SPRINTS27) { const c = S.row(grid, { w: 141, gap: 8 }); S.txt(c, k, { size: 12, mono: true, color: sec }); S.txt(c, dd, { size: 12, color: sec }); }
  S.field(d, "Dossier du dépôt", c => S.input(c, "Aucun dossier", { placeholder: true, icon: "folder", right: r => S.btn(r, "Choisir…", "outline", { sm: true, pad: [3, 10] }) }), "Facultatif. Sans dossier, pas de suivi git.");
  const ft = S.row(d, { fx: true, gap: 8, justify: "end", pad: [4, 0, 0, 0] }); S.btn(ft, "Annuler", "outline"); S.btn(ft, "Créer", "brand");
  return f; };

// ---------- Kanban : barre (Tous, Sprint courant, Démarrable, À reprendre), colonnes du workflow, pastilles ----------
const K = (key, f, title, o = {}) => ({ key, f, title, ...o });
S.KANBAN27 = [
  ["Backlog", 0, []],
  ["À faire", 19, [K("EMIS-46", "F4", "Démo · F4", { optional: true }), K("EMIS-34", "F5", "Tests E2E de l'envoi", { wait: "EMIS-33" }),
    K("EMIS-35", "F5", "Démo · F5", { wait: "EMIS-34" }), K("EMIS-52", "F6", "Contrôle des repères", { reason: "sprint S43" }), K("EMIS-53", "F6", "Écran d'import", { reason: "sprint S43" }), K("EMIS-54", "F6", "Démo · F6", { reason: "sprint S43" }), K("EMIS-71", "F8", "Statuts de soudure", { reason: "sprint S43" }),
    K("EMIS-72", "F8", "Sélection multiple", { reason: "sprint S43" }), K("EMIS-73", "F8", "Validation par lot", { reason: "sprint S43" }), K("EMIS-74", "F8", "Démo · F8", { reason: "sprint S43" })]],
  ["En cours", 1, [K("EMIS-33", "F5", "Écran d'envoi hors ligne", { live: true, step: 7, phase: "Phase 7/12 · Porte qu…", branch: "feat/envoi-hors-…" })]],
  ["En review", 3, [K("EMIS-45", "F4", "Conflits de saisie", { live: true, step: 9, pr: "#20", review: "changes", ci: "error" }), K("EMIS-32", "F5", "Route d'envoi des photos", { step: 10, pr: "#22", ci: "ok" }),
    K("EMIS-61", null, "Passage à Expo SDK 54", { pr: "#23", ci: "running" })]],
  ["Bloqué", 1, [K("EMIS-51", "F6", "Lecture du fichier Excel", { blockedQ: "Q14", step: 3 })]],
  ["Terminé", 17, [K("EMIS-21", "F3", "Démo · F3", { merged: "#18" }), K("EMIS-31", "F5", "Stockage des photos sur MinIO", { merged: "#19" }), K("EMIS-43", "F4", "Synchro au retour du réseau", { merged: "#16" }),
    K("EMIS-42", "F4", "Formulaire de saisie", { merged: "#14" }), K("EMIS-41", "F4", "Schéma local des tronçons", { merged: "#12" }), K("EMIS-20", "F3", "Écran de réaffectation"), K("EMIS-19", "F3", "Route de réaffectation"),
    K("EMIS-18", "F3", "Historique des affectations"), K("EMIS-14", "F2", "Démo · F2")]] ];
S.phaseLabel = (n) => `Phase ${n}/12 · ${S.STEP[n]}`;
S.kb = (p, text, fg, o = {}) => { const C = S.C; const c = S.row(p, { name: "badge", pad: o.pill ? [2, 8] : [2, 6], gap: 4, radius: o.pill ? 10 : 4, fill: o.bg || null, stroke: o.bg ? null : C.border, dashed: o.dashed });
  if (o.icon) S.icon(c, o.icon, 11, o.ic || fg); if (o.ring) S.ring(c, C.amber, 9, 2); if (text) S.txt(c, text, { size: 11, weight: 500, mono: o.mono, color: fg }); return c; };
S.kcard = (p, t) => { const C = S.C, sec = C.mfg, done = !!t.merged || ["EMIS-20", "EMIS-19", "EMIS-18", "EMIS-14"].includes(t.key);
  const c = S.col(p, { name: "card " + t.key, fx: true, pad: [10, 12], gap: 8, radius: 8, fill: C.card, stroke: t.live ? C.brandLine : C.border });
  const a = S.row(c, { fx: true, gap: 5 }); S.txt(a, t.key, { size: 11.5, mono: true, color: sec, name: "key" });
  if (t.f) { S.txt(a, "·", { size: 11.5, color: C.faint }); S.txt(a, t.f, { size: 11.5, mono: true, color: sec }); }
  S.spacer(a); if (t.live) S.halo(a, C.brand, 6); S.icon(a, "more", 14, C.dim);
  S.txt(c, t.title, { size: 13, weight: 500, fill: true, color: done ? sec : C.fg });
  const b = S.row(c, { name: "badges", fx: true, gap: 5, wrap: true });
  if (t.blockedQ) S.kb(b, "bloqué · " + t.blockedQ, C.red, { bg: C.redSoft, icon: "lock" });
  if (t.optional) S.kb(b, "facultative", sec, { dashed: true });
  if (t.pr) S.kb(b, t.pr, C.fg, { icon: "pr", ic: C.purple, mono: true });
  if (t.merged) S.kb(b, t.merged, sec, { icon: "merge", ic: C.green, mono: true });
  if (t.branch && !t.pr && !t.merged) S.kb(b, t.branch, C.fg, { icon: "branch", ic: sec, mono: true });
  if (t.review === "changes") S.kb(b, "changements demandés", C.amber, { bg: C.amberSoft });
  if (t.ci === "ok") S.kb(b, "CI", sec, { icon: "circleCheck", ic: C.green });
  if (t.ci === "error") S.kb(b, "CI cassée", C.red, { icon: "circleX", bg: C.redSoft });
  if (t.ci === "running") S.kb(b, "CI en cours", sec, { ring: true });
  if (t.step != null) S.kb(b, t.phase || S.phaseLabel(t.step), C.fg, { mono: true, pill: true });
  if (t.wait) S.kb(b, "attend " + t.wait, sec);
  if (t.reason) S.kb(b, t.reason, sec);
  if (!b.children.length) b.remove();
  return c; };
S.kanban27 = (main, o = {}) => { const C = S.C, sec = C.mfg, W = o.W, H = o.H;
  const tb = S.row(main, { name: "toolbar", fx: true, h: 48, pad: [0, 16], gap: 8 });
  const seg = S.row(tb, { name: "filter", pad: 2, radius: 7, fill: C.muted, gap: 2 });
  for (const [l, on, n] of [["Tous", true, "41"], ["Sprint courant · S42", false, "15"], ["Démarrable", false, "1"], ["À reprendre", false, "1"]]) { const s = S.row(seg, { pad: [4, 10], gap: 6, radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null });
    if (l === "À reprendre") S.icon(s, "rotate", 12, on ? C.fg : sec); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : sec }); S.txt(s, n, { size: 11, mono: true, color: C.dim }); }
  S.btn(tb, "Étiquette : toutes", "outline", { sm: true, icon: "tag" });
  S.spacer(tb); S.txt(tb, "41 tickets · Tous", { size: 12, color: sec });
  S.hline(main, C.soft);
  const cw = o.cw || 0, area = S.box(main, { name: "columns", w: W, h: 10, fx: true, fy: true, clip: true });
  const row = S.row(area, { name: "columns-row", x: 12, y: 12, h: H - 48 - 1 - 48 - 1 - 24, gap: 8, align: "stretch" });
  const colW = cw || Math.floor((W - 24 - 5 * 8) / 6);
  for (const [name, count, cards] of S.KANBAN27) { const st = { "Backlog": "À faire", "Bloqué": "Bloqué" }[name] || name;
    const col = S.col(row, { name: "column " + name, w: colW, fy: true, pad: 8, gap: 8, radius: 10, fill: C.panel, clip: true });
    const h = S.row(col, { fx: true, h: 28, pad: [0, 4], gap: 7 }); if (name === "Backlog") S.ring(h, C.dim, 8); else S.status(h, st, 8);
    S.txt(h, name, { size: 12.5, weight: 600 }); S.txt(h, String(count), { size: 11.5, mono: true, color: C.dim }); S.spacer(h); S.icon(h, "plus", 14, C.dim);
    for (const t of cards) S.kcard(col, t); }
  S.kanbanFades(area, colW, H - 48 - 1 - 48 - 1 - 24, { right: !!o.cw, W }); return { area, row, colW }; };
S.kanbanFades = (area, colW, rowH, o = {}) => { S.KANBAN27.forEach(([name], i) => { if (name === "À faire" || name === "Terminé")
    S.scrollFade(area, "bottom", { x: 12 + i * (colW + 8), y: 12 + rowH - 48, w: colW, size: 48 }); });
  if (o.right) S.scrollFade(area, "right", { x: o.W - 48, y: 0, h: rowH + 24, size: 48 }); };
S.draw["p-kanban"] = async (x, y) => {
  const f = S.screen("P7 · Kanban", x, y, 1440, 1000);
  const { main } = S.shell27(f, "Kanban"); S.kanban27(main, { W: 1440 - 241, H: 1000 }); return f; };
S.draw["p-barre"] = async (x, y) => {
  const f = S.screen("Barre repliée · Kanban à 1 180 px", x, y, 1180, 1000);
  const { main } = S.shell27(f, "Kanban", { collapsed: true }); S.kanban27(main, { cw: 200, W: 1180 - 49, H: 1000 }); S.pagesMenu(f, 50, 188, "Kanban"); return f; };

// ---------- P8 · Fiche ticket : Sheet de 560 px sur le Kanban ----------
S.sec27 = (p, title, o = {}) => { const C = S.C; const c = S.col(p, { name: "section/" + title, fx: true, gap: o.gap ?? 10 });
  const h = S.row(c, { fx: true, gap: 8 }); if (o.chev) S.icon(h, o.chev, 14, C.dim); S.txt(h, title, { size: 13, weight: 600 }); if (o.count) S.txt(h, o.count, { size: 12, mono: true, color: C.dim });
  if (o.meta) S.txt(h, o.meta, { size: 12.5, color: C.mfg }); if (o.after) o.after(h); S.spacer(h); if (o.right) o.right(h); return c; };
S.switch = (p, on) => { const C = S.C; const t = S.box(p, { name: "switch", w: 32, h: 18, radius: 9, fill: on ? C.fg : C.track, dir: "row", align: "center", justify: on ? "end" : "start", pad: [0, 2] }); S.dot(t, C.bg, 14); return t; };
S.kv = (p, label, build) => { const C = S.C; const r = S.row(p, { fx: true, h: 30, gap: 10 }); const l = S.row(r, { w: 96 }); S.txt(l, label, { size: 12.5, color: C.mfg }); const v = S.row(r, { fx: true, gap: 6 }); build(v); return r; };
S.ACT27 = [["14:34", "bot", "brand", "Session T3 Code ouverte", null], ["13:47", "pr", "amber", "Changements demandés sur PR #20", null], ["11:58", "circleX", "red", "CI cassée sur PR #20", "job e2e"],
  ["hier 17:12", "flag", null, "Étape 9 · Review", null], ["hier 16:40", "pr", "purple", "PR #20 ouverte", "En review"], ["mer. 10:05", "branch", "blue", "Branche feat/emis-45 poussée", "En cours"]];
S.sheet27 = (f, tab) => { const C = S.C, sec = C.mfg;
  const sh = S.col(f, { name: "sheet", x: f.width - 560, y: 0, w: 560, h: f.height, fill: C.bg, stroke: C.border, shadow: 12, clip: true });
  const top = S.row(sh, { fx: true, h: 52, pad: [0, 16, 0, 24], gap: 8 }); S.icon(top, "ticket", 14, sec); S.txt(top, "EMIS-45", { size: 12.5, mono: true, color: sec, name: "key" });
  S.spacer(top); S.btn(top, "Copier /full-delivery EMIS-45", "outline", { sm: true, icon: "copy" }); S.icon(top, "link", 15, sec); S.icon(top, "more", 15, sec); S.btn(top, "Fermer", "ghost", { sm: true, icon: "x" });
  S.hline(sh, C.soft);
  const body = S.col(sh, { fx: true, fy: true, pad: [18, 24], gap: 16 });
  const hl = S.row(body, { name: "header-line", gap: 6 }); S.fChip2(hl, "F4"); S.txt(hl, "·", { size: 12.5, color: C.faint }); S.icon(hl, "sprint", 12, sec); S.txt(hl, "S42", { size: 12.5, mono: true, color: sec });
  S.txt(hl, "·", { size: 12.5, color: C.faint }); S.icon(hl, "pr", 12, C.purple); S.txt(hl, "PR #20", { size: 12.5, mono: true, color: C.fg });
  S.txt(body, "Conflits de saisie", { size: 22, weight: 600, ls: -0.3 });
  const meta = S.row(body, { gap: 8 }); const st = S.row(meta, { gap: 6, pad: [4, 10], radius: 6, stroke: C.border }); S.status(st, "En review", 8); S.txt(st, "En review", { size: 12.5 }); S.icon(st, "chevDown", 12, C.dim);
  const as = S.row(meta, { gap: 6, pad: [3, 8, 3, 4], radius: 6, stroke: C.border }); S.avatar(as, "A", 20); S.txt(as, "Adam (moi)", { size: 12.5 }); S.icon(as, "chevDown", 12, C.dim);
  const rq = S.row(meta, { gap: 8, pad: [0, 0, 0, 4] }); S.switch(rq, true); S.txt(rq, "Requise pour livrer", { size: 12.5 });
  const lb = S.row(body, { name: "labels", pad: [4, 5, 4, 5] }); S.txt(lb, "Ajouter une étiquette", { size: 13, color: C.mfg });
  const bn = S.row(body, { name: "tracking-banner", fx: true, h: 42, pad: [0, 12], gap: 5, radius: 8, fill: C.amberSoft, stroke: C.border });
  S.icon(bn, "pr", 14, C.amber); S.txt(bn, "PR #20", { size: 13, weight: 600, mono: true }); S.txt(bn, "· changements demandés", { size: 13, weight: 500, color: C.amber });
  S.txt(bn, "· CI cassée", { size: 13, weight: 500, color: C.red }); S.spacer(bn);
  const l1 = S.row(bn, { gap: 4 }); S.txt(l1, "PR", { size: 12.5, weight: 500 }); S.icon(l1, "external", 12, sec); const l2 = S.row(bn, { gap: 4 }); S.txt(l2, "Job", { size: 12.5, weight: 500 }); S.icon(l2, "external", 12, sec);
  const tw = S.col(body, { name: "tabs-wrap", fx: true, gap: 0 });
  const tabs = S.row(tw, { name: "tabs", fx: true, gap: 0, pad: [10, 0, 0, 0] }); for (const [l, on] of [["Détails", tab === "details"], ["Activité", tab === "activity"]]) { const t = S.col(tabs, { gap: 12, pad: [0, 16] }); S.txt(t, l, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : sec }); S.box(t, { w: 10, h: 2, fx: true, fill: on ? C.fg : null }); }
  S.hline(tw, C.soft);
  if (tab === "details") {
    const tr = S.sec27(body, "Suivi", { meta: "remonté de git, des PR et de full-delivery", gap: 4 });
    S.kv(tr, "Branche", v => { S.icon(v, "branch", 13, C.blue); S.txt(v, "feat/emis-45", { size: 12.5, mono: true }); S.txt(v, "sur", { size: 12.5, color: sec }); S.txt(v, "dev", { size: 12.5, mono: true }); S.txt(v, "déclarée", { size: 12.5, color: sec }); });
    S.kv(tr, "PR", v => { S.icon(v, "pr", 13, C.purple); S.txt(v, "#20", { size: 12.5, mono: true, weight: 500 }); S.txt(v, "ouverte hier à 16:40", { size: 12.5, color: sec }); });
    S.kv(tr, "Review", v => { S.kb(v, "changements demandés", C.amber, { bg: C.amberSoft }); S.txt(v, "13:47", { size: 12.5, color: sec }); });
    S.kv(tr, "CI", v => { S.kb(v, "CI cassée", C.red, { icon: "circleX", bg: C.redSoft }); S.txt(v, "job e2e · 11:58", { size: 12.5, color: sec }); });
    S.kv(tr, "Session", v => { S.halo(v, C.brand, 6); S.txt(v, "T3 Code · 18 min", { size: 12.5, color: C.brandText, weight: 500 }); });
    S.kv(tr, "Livraison", v => { S.segs(v, S.stepColors(9), { w: 5, h: 12, gap: 2, radius: 1 }); S.txt(v, "Phase 9/12 · Review", { size: 12.5 }); S.txt(v, "· suivante : Démo", { size: 12.5, color: sec }); });
    S.hline(body, C.soft);
    const ds = S.sec27(body, "Description", { after: h => S.txt(h, "Modifier", { size: 12.5, weight: 500 }) }); S.txt(ds, "Deux saisies hors ligne du même tronçon : garder la plus récente et signaler l'autre au chef de chantier au retour du réseau.", { size: 13, lh: 1.55, fill: true });
    S.hline(body, C.soft);
    const dp = S.sec27(body, "Dépendances", { gap: 12 }); S.txt(dp, "Aucune", { size: 12.5, color: sec }); S.btn(dp, "Ajouter une dépendance", "outline", { sm: true, icon: "plus", pad: [8, 12], size: 12.5 });
    S.hline(body, C.soft);
    const qs = S.sec27(body, "Questions", { count: "0", gap: 14 }); S.txt(qs, "Aucune question sur ce ticket.", { size: 12.5, color: sec });
    S.hline(body, C.soft);
    const fold = S.col(body, { name: "folded", fx: true, gap: 20, pad: [4, 0, 0, 0] }); S.sec27(fold, "Domaine", { chev: "chevRight", meta: "Aucun" }); S.sec27(fold, "Maquettes", { chev: "chevRight", meta: "0" });
  } else {
    const ac = S.sec27(body, "Chronologie", { meta: "journal du ticket : branche, PR, étapes, sessions, statut" });
    const tl = S.col(ac, { fx: true, gap: 0 });
    S.ACT27.forEach(([t, icon, col, text, res], i) => { const r = S.row(tl, { fx: true, gap: 12, align: "start" });
      const rail = S.col(r, { w: 24, align: "center" }); const n = S.box(rail, { w: 24, h: 24, radius: 12, fill: C.muted, dir: "row", align: "center", justify: "center" }); S.icon(n, icon, 12, col ? C[col] : sec);
      if (i < S.ACT27.length - 1) S.box(rail, { name: "rail-line", w: 1, h: res ? 26 : 10, fill: C.border });
      const c = S.col(r, { fx: true, gap: 3, pad: [3, 0, 14, 0] }); const a = S.row(c, { fx: true, gap: 8 }); S.txt(a, text, { size: 13, weight: 500, color: icon === "bot" ? C.brandText : C.fg }); S.spacer(a); S.txt(a, t, { size: 12, color: sec });
      if (res) S.txt(c, res === "job e2e" ? "job e2e · voir le journal" : "statut ⇒ " + res, { size: 12, color: sec }); });
    S.hline(body, C.soft);
    S.sec27(body, "Anciens runs", { chev: "chevRight", meta: "runs d'agents d'avant la phase 27, en lecture seule" }); }
  return sh; };
S.draw["p-fiche"] = async (x, y, tab = "details") => {
  const f = S.rename(S.cloneScreen("P7 · Kanban", x, y), tab === "details" ? "P8 · Fiche ticket" : "P8b · Fiche ticket, Activité");
  S.veil(f); S.sheet27(f, tab); return f; };
S.draw["p-fiche-act"] = (x, y) => S.draw["p-fiche"](x, y, "activity");

// ---------- P9 · Questions : Qn, « bloquante », bloquantes en tête, export ----------
S.QUESTIONS27 = [
  { id: "Q14", tk: "EMIS-51", f: "F6", group: "Lecture du fichier Excel", text: "Un ISO réaffecté garde-t-il ses photos ?", to: "Emis SA", blocking: true, age: "il y a 3 j" },
  { id: "Q16", tk: "EMIS-34", f: "F5", group: "Tests E2E de l'envoi", text: "Quota par affaire : 2 Go ou 5 Go ?", to: "Produit", age: "hier" },
  { id: "Q17", tk: "EMIS-81", f: "F7", group: "Modèle du rapport", text: "Un rapport par chef de chantier ou par affaire ?", to: "Emis SA", age: "il y a 2 h" } ];
S.qcard27 = (p, q) => { const C = S.C, sec = C.mfg;
  const g = S.col(p, { name: "group " + q.tk, fx: true, gap: 8 });
  const gh = S.row(g, { gap: 8 }); S.txt(gh, q.tk, { size: 12, mono: true, color: sec }); S.txt(gh, q.group, { size: 13, weight: 600 }); S.fChip2(gh, q.f);
  const c = S.col(g, { name: "question " + q.id, fx: true, pad: [12, 14], gap: 10, radius: 10, fill: C.card, stroke: q.blocking ? C.red : C.border });
  const t = S.row(c, { fx: true, gap: 8 }); S.txt(t, q.id, { size: 12.5, mono: true, weight: 600, color: q.blocking ? C.red : sec }); S.txt(t, q.text, { size: 13.5, weight: 600 });
  if (q.blocking) S.pill(t, "bloquante", C.red, C.redSoft, "lock"); S.spacer(t); S.icon(t, "more", 15, C.dim);
  const m = S.row(c, { gap: 8 }); const to = S.row(m, { gap: 5, pad: [3, 8], radius: 12, stroke: C.border }); S.icon(to, "user", 12, sec); S.txt(to, "Pour : " + q.to, { size: 12 }); S.icon(to, "chevDown", 11, C.dim);
  S.txt(m, "posée par", { size: 12, color: sec }); S.avatar(m, "AB", 18); S.txt(m, "Adam · " + q.age, { size: 12, color: sec });
  const a = S.row(c, { fx: true, gap: 8 }); S.input(a, "Votre réponse…", { placeholder: true }); S.btn(a, "Répondre", "soft", { sm: true });
  return g; };
S.draw["p-questions"] = (x, y) => { const C = S.C, sec = C.mfg;
  const f = S.screen("P9 · Questions", x, y, 1440, 1000);
  const { main } = S.shell27(f, "Questions");
  const tb = S.row(main, { name: "toolbar", fx: true, h: 52, pad: [0, 16], gap: 8 });
  const seg = S.row(tb, { pad: 2, radius: 7, fill: C.muted, gap: 2 });
  for (const [l, on] of [["Ouvertes", true], ["Répondues"], ["Toutes"], ["Archivées"]]) { const s = S.row(seg, { pad: [4, 10], radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : sec }); }
  const rc = S.row(tb, { gap: 4 }); for (const [l, n, on] of [["Tous", "3", true], ["Emis SA", "2"], ["Produit", "1"]]) { const s = S.row(rc, { pad: [4, 10], gap: 6, radius: 6, stroke: on ? C.mfg : C.border }); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : sec }); S.txt(s, n, { size: 11, mono: true, color: C.dim }); }
  S.spacer(tb); S.btn(tb, "Exporter pour le client (2)", "outline", { sm: true, icon: "upload" }); S.btn(tb, "Nouvelle question", "default", { sm: true, icon: "plus" });
  S.hline(main, C.soft);
  const list = S.col(main, { name: "list", fx: true, fy: true, pad: [18, 24], gap: 20 });
  const note = S.row(list, { gap: 8 }); S.icon(note, "lock", 13, C.red); S.txt(note, "1 bloquante en tête · 3 ouvertes", { size: 12.5, color: sec });
  for (const q of S.QUESTIONS27) S.qcard27(list, q);
  const pop = S.col(f, { name: "export-preview", x: 1440 - 16 - 420 - 150, y: 48 + 46, w: 420, pad: 14, gap: 10, radius: 10, stroke: C.border, fill: C.card, shadow: 10 });
  const ph = S.row(pop, { fx: true, gap: 8 }); S.txt(ph, "Texte exporté", { size: 13, weight: 600 }); S.spacer(ph); S.txt(ph, "2 questions client", { size: 12, color: sec });
  const pre = S.col(pop, { fx: true, pad: [10, 12], gap: 6, radius: 6, fill: C.muted });
  const lines = [["Questions pour Emis SA · 16 oct. 2026"], [""], ["Q14 · Un ISO réaffecté garde-t-il ses photos ?"],
    ["   bloque « Importer les ISO depuis Excel »,", sec], ["prévue semaine du 19 oct. · réponse souhaitée", sec], ["avant le 19 oct.", sec], [""],
    ["Q17 · Un rapport par chef de chantier ou par"], ["affaire ?"],
    ["   pour « Rapport de chantier journalier », prévue", sec], ["semaine du 26 oct. · réponse souhaitée avant le 26", sec], ["oct.", sec]];
  for (const [l, color] of lines) S.txt(pre, l || " ", { name: "export-line", size: 12, mono: true, color: color || C.fg });
  const pf = S.row(pop, { fx: true, gap: 8 }); S.txt(pf, "Les questions exportées sont marquées envoyées.", { size: 12, color: sec, fill: true }); S.btn(pf, "Copier", "default", { sm: true, icon: "copy" });
  S.toast(f, "2 questions marquées envoyées", "Annuler", { x: 1440 - 24 - 340, y: 1000 - 24 - 54 });
  return f; };

// ---------- Panneau de l'agent de projet (340 px) : question visible, résumé épinglé, récapitulatif ----------
S.agentHead27 = (ap) => { const C = S.C, sec = C.mfg;
  const h = S.row(ap, { fx: true, h: 60, pad: [0, 18], gap: 10 }); S.agentMark(h, 30);
  const ht = S.col(h, { gap: 2 }); S.txt(ht, "Agent de projet", { size: 14, weight: 600 }); S.txt(ht, "Suivi à jour · il y a 4 min", { size: 12, color: sec });
  S.spacer(h); S.icon(h, "more", 16, sec); S.icon(h, "x", 16, sec); S.hline(ap, C.soft);
  const sm = S.col(ap, { name: "pinned-summary", fx: true, pad: [14, 18], gap: 6, fill: C.panel });
  const l = S.row(sm, { fx: true, gap: 6 }); S.icon(l, "pin", 12, sec); S.txt(l, "Résumé du jour", { size: 12, weight: 600, color: sec, upper: true, ls: 0.5 }); S.spacer(l); S.txt(l, "14:40", { size: 12, color: sec }); S.txt(l, "épinglé", { size: 12, color: sec });
  S.txt(sm, "F3 est livrée : 3 fonctionnalités sur 9. S42 finit ce soir, F5 n'y tiendra pas.", { size: 13, lh: 1.5, fill: true });
  S.box(ap, { name: "pin-shadow", w: 10, h: 1, fx: true, fill: C.border }); };
S.agentFoot27 = (ap, text) => { const C = S.C; S.box(ap, { w: 4, h: 4, fy: true }); S.hline(ap, C.soft);
  const ft = S.col(ap, { fx: true, pad: [14, 18] }); const inp = S.row(ft, { fx: true, h: 42, pad: [0, 12], gap: 8, radius: 8, stroke: C.border, fill: C.bg });
  S.txt(inp, text || "Demander à l'agent de projet…", { size: 13, color: C.mfg }); S.spacer(inp); S.icon(inp, "send", 15, C.mfg); };
S.agentBoard27 = (name, x, y) => { const f = S.screen(name, x, y, 340, 1000);
  const ap = S.col(f, { name: "agent-panel", x: 0, y: 0, w: 340, h: 1000, fill: S.C.panel }); S.agentHead27(ap); return { f, ap }; };
S.draw["p-agent-q"] = (x, y) => { const C = S.C, sec = C.mfg; const { f, ap } = S.agentBoard27("Agent · question", x, y);
  const b = S.col(ap, { fx: true, pad: [16, 18], gap: 14, fill: C.bg, fy: true });
  const qr = S.row(b, { fx: true, justify: "end" }); const q = S.col(qr, { name: "user-question", w: 240, pad: [10, 12], gap: 4, radius: 10, fill: C.muted });
  S.txt(q, "Pourquoi F5 glisse en S43 ?", { size: 13, fill: true, lh: 1.45 }); S.txt(q, "Adam · 14:48", { size: 12, color: C.dim });
  const ar = S.row(b, { fx: true, gap: 10, align: "start" }); S.agentMark(ar, 24); const ac = S.col(ar, { fx: true, gap: 8 });
  S.txt(ac, "Il reste 4 étapes à F5 et S42 finit ce soir. EMIS-32 attend sa review, EMIS-33 est en porte qualité depuis 42 min, EMIS-34 et EMIS-35 n'ont pas commencé.", { size: 13, lh: 1.55, fill: true });
  S.txt(ac, "Je propose de la reporter en S43 : c'est la première action du lot n° 7.", { size: 13, lh: 1.55, fill: true });
  S.txt(ac, "Lu : Planning, F5, journal des étapes", { size: 12, color: C.dim });
  const lot = S.col(b, { fx: true, stroke: C.brandLine, radius: 10, clip: true, fill: C.card });
  const lh = S.row(lot, { fx: true, pad: [10, 14], gap: 8, fill: C.brandSoft }); S.txt(lh, "Lot n° 7", { size: 13, weight: 600, color: C.brandText }); S.spacer(lh); S.txt(lh, "3 actions", { size: 12, color: sec });
  for (const it of S.P.lot) { S.hline(lot, C.soft); const r = S.row(lot, { fx: true, pad: [10, 14], gap: 10, align: "start" });
    const cb = S.box(r, { w: 16, h: 16, radius: 4, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(cb, "check", 11, "#FFFFFF", 3);
    const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, it.text, { size: 13, weight: 500, fill: true }); S.txt(tc, it.meta, { size: 12, color: sec, fill: true }); }
  S.hline(lot, C.soft); const lf = S.row(lot, { fx: true, pad: [12, 14], gap: 8 }); S.btn(lf, "Valider (3)", "brand", { sm: true }); S.btn(lf, "Refuser", "outline", { sm: true });
  const hid = S.row(b, { fx: true, gap: 8 }); S.icon(hid, "history", 13, C.dim); S.txt(hid, "1 lot remplacé masqué", { size: 12, color: C.dim }); S.spacer(hid); S.txt(hid, "Afficher les lots remplacés", { size: 12, weight: 500, color: sec });
  S.agentFoot27(ap); return f; };
S.draw["p-agent-recap"] = (x, y) => { const C = S.C, sec = C.mfg; const { f, ap } = S.agentBoard27("Agent · récapitulatif", x, y);
  const b = S.col(ap, { fx: true, pad: [16, 18], gap: 14, fill: C.bg, fy: true });
  const qr = S.row(b, { fx: true, justify: "end" }); const q = S.col(qr, { name: "user-question", w: 240, pad: [10, 12], gap: 4, radius: 10, fill: C.muted });
  S.txt(q, "Pourquoi F5 glisse en S43 ?", { size: 13, fill: true, lh: 1.45 }); S.txt(q, "Adam · 14:48", { size: 12, color: C.dim });
  const rc = S.col(b, { name: "batch-recap", fx: true, stroke: C.border, radius: 10, clip: true, fill: C.card });
  const rh = S.row(rc, { fx: true, pad: [10, 14], gap: 8, fill: C.panel }); S.icon(rh, "circleCheck", 14, C.green); S.txt(rh, "Lot n° 7 validé", { size: 13, weight: 600 }); S.spacer(rh); S.txt(rh, "14:52", { size: 12, color: sec }); S.icon(rh, "x", 13, sec);
  const sum = S.row(rc, { fx: true, pad: [10, 14], gap: 14 });
  for (const [n, l, col] of [["3", "appliquées", C.green], ["0", "échouée", C.red], ["0", "ignorée", C.dim]]) { const s = S.row(sum, { gap: 5 }); S.dot(s, col, 7); S.txt(s, n, { size: 13, weight: 600, mono: true }); S.txt(s, l, { size: 12.5, color: sec }); }
  const rows = [["check", C.green, "Reporter F5 en S43", "appliquée · F5 glissée de S42"], ["check", C.green, "Planifier F9 en S44", "appliquée"], ["check", C.green, "Relancer le client sur Q14", "appliquée", true]];
  for (const [ic, col, t, m, relance] of rows) { S.hline(rc, C.soft); const r = S.row(rc, { fx: true, pad: [10, 14], gap: 10, align: "start" }); S.icon(r, ic, 14, col, 2.5);
    const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, t, { size: 13, weight: 500, fill: true }); S.txt(tc, m, { size: 12, color: ic === "x" ? C.red : sec, fill: true });
    if (relance) { S.box(tc, { w: 4, h: 3 }); S.btn(tc, "Copier la relance", "outline", { sm: true, icon: "copy" }); } }
  const note = S.row(b, { fx: true, gap: 8, align: "start" }); S.icon(note, "refresh", 13, sec);
  S.txt(note, "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.", { size: 12, color: sec, lh: 1.5, fill: true });
  S.agentFoot27(ap); return f; };

// ---------- Dessin (export : 90-export.js, S.export27) ----------
S.draw27 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS27.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y27 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && (c.x === x))) b.remove();
  S.placed = []; const f = await S.draw[key](x, y); await S.wait(400); const moved = S.replace();
  const d = f.children.find(c => c.name === "dialog"); if (d) { await S.wait(1500); d.y = f.y + Math.round((f.height - d.height) / 2); }
  return { board: f.name, shapes: S.count(f), moved, dialog: d ? d.height : null }; };
return "phase 27 ok";
