// Page « 20 · Notes, graphe & disposition » : écrans 150 à 155 (phase 12, spec §18 et spec composants §18). Requiert 18-socle.js et 24-socle-suite.js.
// Numéros 150 à 155 proposés ici (la spec ne numérote pas les écrans de la phase 12).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "20 · Notes, graphe & disposition";
const { find, wait, shadow, abs, rel, menu, tooltip, input, select, help, appScreen, kanbanAt } = S.fx;
const { kbd, iconButton, cell, dashboard, widget, handles, filterBar } = S.fx2;

// ---------- 150 · Kanban : colonnes qui défilent (§18.3) ----------
const MORE = [{ id: "KIB-3", title: "Noyau de données", domain: "Core", sub: "1/2" }, { id: "KIB-4", title: "Orchestration des agents", domain: "Agents", sub: "0/2" },
  { id: "KIB-6", title: "UI de base", domain: "UI", sub: "0/2" }, { id: "KIB-27", title: "Tests de convergence (fast-check)", domain: "Core", sub: "0/1", agent: "opus-dev-1", run: "running" },
  { id: "KIB-28", title: "Générateur d'opérations concurrentes", domain: "Core", agent: "haiku-tests", run: "running" }];
S.draw[150] = async () => { const { frame: f } = await kanbanAt(PAGE, "150 · Kanban : colonnes qui défilent", 0, 0); await wait(1500);
  const col = penpotUtils.findShape(s => /^Column ?\/ ?En cours$/.test(s.name), f); MORE.forEach(t => S.card(col, t)); col.clipContent = true;
  const hd = col.children.find(c => c.name === "header"); const n = hd.children.filter(c => c.type === "text").pop(); S.setText(n, "9");
  const tb = find(f, "Toolbar"); const cnt = tb && tb.children.filter(c => c.type === "text").pop(); if (cnt) S.setText(cnt, "24 / 24 tickets");
  await wait(1500); const p = rel(f, col); const bar = S.box(f, { name: "Scrollbar", fill: C.mfg, op: 0.6, radius: 3, w: 5, h: 220 }); abs(f, bar, p.x + p.w - 8, p.y + 44);
  const fade = S.box(f, { name: "ScrollFade", fill: C.bg, op: 0.6, w: p.w - 4, h: 24 }); abs(f, fade, p.x + 2, p.y + p.h - 26);
  S.frontAbs(f); return f.id; };

// ---------- 151 · Tableau de bord : taille libre, raccourcis de taille, compaction (§18.1, §18.2) ----------
const kanbanBody = (b) => { const r = S.row(b, { gap: 8, align: "start" }); [["À faire", ["KIB-9", "KIB-15", "KIB-18"]], ["En cours", ["KIB-12", "KIB-14", "KIB-16"]], ["En review", ["KIB-7", "KIB-11"]]].forEach(([n, ks]) => {
  const c = S.col(r, { gap: 6, pad: 6, fill: C.muted, radius: 8 }); const h = S.row(c, { gap: 6 }); S.statusDot(h, n, 7); S.txt(h, n, { size: 11, weight: 500 }); ks.forEach(k => { const cd = S.panel(c, { gap: 2, pad: 8, radius: 6 }); S.txt(cd, k, { size: 10, mono: true, color: C.dim }); }); }); };
const ticketsBody = (b) => [["KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours"], ["KIB-14", "Récepteur de hooks Claude Code", "En cours"], ["KIB-15", "Kanban : drag & drop entre colonnes", "À faire"], ["KIB-21", "Sandbox iframe des composants", "Bloqué"], ["KIB-22", "Export Markdown / Obsidian", "Backlog"]]
  .forEach(([k, t, s]) => { const r = S.row(b, { gap: 8, pad: [4, 0] }); S.statusDot(r, s, 7); S.txt(r, k, { size: 11, mono: true, color: C.dim }); S.txt(r, t, { size: 12 }); });
const notesBody = (b) => ["Architecture du sync", "Décisions d'architecture", "Journal agents"].forEach(t => { const r = S.row(b, { gap: 8, pad: [3, 0] }); S.icon(r, "note", 13, C.mfg); S.txt(r, t, { size: 12 }); });
const sizeBadge = (w, t) => { const b = S.box(w, { name: "SizeBadge", fill: C.card, stroke: C.border, radius: 6, dir: "row", pad: [5, 10], hs: "auto", vs: "auto" }); S.txt(b, t, { size: 12, mono: true }); abs(w, b, Math.round(w.width / 2) - 50, Math.round(w.height / 2) - 14); return b; };
S.draw[151] = async () => { const { frame: f, g } = await dashboard(PAGE, "151 · Disposition : taille libre", 0, 1, { edit: true, changes: "1 changement" });
  kanbanBody(widget(g, "Kanban", "kanban", cell(0, 0, 6, 4), { edit: true, size: "6 × 4", format: "Moyen" }).body);
  const { w, body } = widget(g, "Tickets", "list", cell(6, 0, 6, 8), { edit: true, size: "6 × 8", format: "Large", ring: C.fg }); ticketsBody(body); handles(w); sizeBadge(w, "6 × 8 cases");
  notesBody(widget(g, "Notes", "note", cell(0, 4, 6, 3), { edit: true, size: "6 × 3", format: "Moyen" }).body);
  return f.id; };
S.draw["151b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "151b · Disposition : raccourcis de taille", 2, 1, { edit: true });
  kanbanBody(widget(g, "Kanban", "kanban", cell(0, 0, 6, 6), { edit: true, size: "6 × 6", format: "Large" }).body);
  const t = widget(g, "Tickets", "list", cell(6, 0, 6, 6), { edit: true, size: "6 × 6", format: "Large", menu: true }); ticketsBody(t.body);
  notesBody(widget(g, "Notes", "note", cell(0, 6, 6, 3), { edit: true, size: "6 × 3", format: "Moyen" }).body); await wait(2000);
  const fmt = find(t.h, "Select-Format : Large"); const p = rel(f, fmt);
  const m = menu(f, p.x + p.w - 250, p.y + p.h + 4, ["Raccourcis de taille", ["Moyen", null, { hint: "6 × 3" }], ["Large", null, { hint: "6 × 6", check: true, hover: true }], ["Demi-page", null, { hint: "12 × 6" }], ["Plein écran", null, { hint: "12 × 9" }], "-"], 250);
  const ft = S.box(m, { name: "MenuHelp", dir: "row", pad: [6, 8], vs: "auto" }); S.fillX(ft); S.fillX(S.txt(ft, "Un composant s'adapte à chacun de ses formats. Tire un bord pour une taille libre.", { size: 11, color: C.dim, lh: 1.4 }));
  S.frontAbs(f); return f.id; };
S.draw["151c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "151c · Disposition : compaction pendant le glisser", 4, 1, { edit: true, changes: "2 changements" });
  ticketsBody(widget(g, "Tickets", "list", cell(6, 0, 6, 6), { edit: true, size: "6 × 6", format: "Large" }).body);
  notesBody(widget(g, "Notes", "note", cell(0, 0, 6, 3), { edit: true, size: "6 × 3", format: "Moyen" }).body);
  const t = cell(0, 3, 6, 4); const ghost = S.box(g, { name: "DropGhost", fill: C.accent, op: 0.5, stroke: C.fg, sw: 2, dashed: true, radius: 10, w: t.w, h: t.h }); penpotUtils.setParentXY(ghost, t.x, t.y);
  const k = widget(g, "Kanban", "kanban", cell(0, 3, 6, 4), { edit: true, size: "6 × 4", format: "Moyen" }); kanbanBody(k.body); k.w.opacity = 0.9; shadow(k.w); penpotUtils.setParentXY(k.w, t.x + 70, t.y + 40); k.w.rotation = -1;
  return f.id; };

// ---------- 152 · Éditeur de notes (spec composants §18 points 1 et 2) ----------
const TOOLS = [["heading"], "|", ["bold"], ["italic"], ["strike"], ["inlineCode"], "|", ["list"], ["listOrdered"], ["listChecks"], ["quote"], "|", ["link"], ["table"], ["squareCode"]];
const toolbar = (p, on) => { const r = S.row(p, { gap: 2, pad: [6, 8] }); S.border(r); TOOLS.forEach(t => { if (t === "|") { S.box(r, { name: "sep", fill: C.border, w: 1, h: 16 }); return; } iconButton(r, t[0], { on: t[0] === on, color: t[0] === on ? C.fg : C.mfg }); }); return r; };
const notesScreen = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, "Notes", ["Kibo", "Notes"], ["note", "Kibo · Notes"]); S.topAction(r.frame, "Partager", "outline", "share2");
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const list = S.panel(c, { w: 260, gap: 8, pad: 10 }); S.child(list, { v: "fill" }); input(list, "Rechercher une note…", { icon: "search", placeholder: true }); select(list, "Modifiées récemment", { fill: true });
  S.txt(list, "~/code/kibo/notes", { size: 11, mono: true, color: C.dim });
  [["Décisions d'architecture", "aujourd'hui", true], ["Architecture du sync", "aujourd'hui"], ["Journal agents", "hier"]].forEach(([t, m, on]) => { const it = S.col(list, { gap: 2, pad: [8, 10], radius: 6, fill: on ? C.accent : null }); S.fillX(it); S.txt(it, t, { size: 13, weight: 500 }); S.txt(it, m, { size: 11, color: C.dim }); });
  const ed = S.col(c, { gap: 12 }); const eh = S.row(ed, { gap: 8 }); S.icon(eh, "fileText", 14, C.mfg); S.fillX(S.txt(eh, "decisions-d-architecture.md", { size: 12, mono: true, color: C.mfg }));
  const pv = S.row(eh, { gap: 6, hs: "auto" }); S.icon(pv, "eye", 14, o.preview ? C.fg : C.mfg); S.txt(pv, "Aperçu", { size: 12, weight: 500 }); S.txt(eh, o.saved ? "Enregistré" : "Non enregistré", { size: 12, color: C.mfg });
  const box = S.panel(ed, { gap: 0, pad: 0, h: 560, vs: "fix" }); toolbar(box, o.tool); const area = S.box(box, { name: "Editor", dir: o.preview ? "row" : "column", gap: o.preview ? 0 : 10, pad: o.preview ? 0 : 16 }); S.child(area, { h: "fill", v: "fill" });
  const side = S.col(c, { w: 240, gap: 12 }); S.txt(side, "Tickets liés", { size: 13, weight: 600 }); S.badge(side, "KIB-12 · Schéma Loro des tickets", C.fg, { round: true }); S.txt(side, "Rétroliens", { size: 13, weight: 600 }); S.txt(side, "Architecture du sync", { size: 12, color: C.mfg });
  return { ...r, area }; };
const md = (p, t, o = {}) => S.fillX(S.txt(p, t, { size: 13, mono: true, color: o.color || C.fg, lh: 1.6, weight: o.weight || 400 }));
const SOURCE = ["## Choix du stockage", "Le démon garde les notes en **local**, sans serveur.", "- un fichier .md par note", "- liens [[KIB-12]] vers les tickets"];
S.draw[152] = async () => { const { frame: f, area } = await notesScreen("152 · Notes : barre d'outils", 0, 2, { tool: "bold" });
  SOURCE.forEach((l, i) => md(area, l, { weight: i === 0 ? 600 : 400 })); await wait(1500);
  const b = penpotUtils.findShape(s => s.name === "IconButton-bold", f); const p = rel(f, b); tooltip(f, p.x - 30, p.y + p.h + 6, "Gras ⌘B"); S.frontAbs(f); return f.id; };
S.draw["152b"] = async () => { const { frame: f, area } = await notesScreen("152b · Notes : menu /", 2, 2);
  md(area, "# Décisions", { weight: 600 }); md(area, "Le démon reste local et écoute sur 127.0.0.1."); const slash = md(area, "/"); await wait(1500); const p = rel(f, slash);
  menu(f, p.x, p.y + 22, [["Titre 1", "heading", { hover: true }], ["Titre 2", "heading"], ["Titre 3", "heading"], ["Liste", "list"], ["Liste numérotée", "listOrdered"], ["Case à cocher", "listChecks"], ["Citation", "quote"], ["Bloc de code", "squareCode"], ["Tableau", "table"], ["Lien", "link"], ["Image", "image"]], 220);
  S.frontAbs(f); return f.id; };
S.draw["152c"] = async () => { const { frame: f, area } = await notesScreen("152c · Notes : bulle de sélection", 4, 2);
  md(area, "## Choix du stockage", { weight: 600 }); const t = md(area, "Le démon garde les notes en local, sans serveur."); await wait(1500); const p = rel(f, t);
  const hl = S.box(f, { name: "Selection", fill: C.blue, op: 0.35, w: 46, h: 20 }); abs(f, hl, p.x + 252, p.y + 1);
  const bub = S.box(f, { name: "Bubble", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 2, pad: 4, hs: "auto", vs: "auto", align: "center" }); shadow(bub);
  ["bold", "italic", "strike", "inlineCode", "link"].forEach(i => iconButton(bub, i, { on: i === "bold", color: i === "bold" ? C.fg : C.mfg })); abs(f, bub, p.x + 180, p.y - 44);
  S.frontAbs(f); return f.id; };
S.draw["152d"] = async () => { const { frame: f, area } = await notesScreen("152d · Notes : image collée et aperçu en direct", 6, 2, { preview: true });
  const src = S.col(area, { gap: 10, pad: 16 }); S.child(src, { h: "fill", v: "fill" }); S.border(src);
  ["## Maquette du Kanban", "![colonne-en-cours](assets/colonne-en-cours.png)", "Les colonnes défilent dans leur fond."].forEach((l, i) => md(src, l, { weight: i === 0 ? 600 : 400, color: i === 1 ? C.mfg : C.fg }));
  const out = S.col(area, { gap: 10, pad: 16 }); S.child(out, { h: "fill", v: "fill" }); S.txt(out, "Maquette du Kanban", { size: 18, weight: 600 });
  const img = S.box(out, { name: "Image", fill: C.muted, stroke: C.border, radius: 8, h: 180, dir: "row", gap: 8, pad: 12, align: "start" }); S.fillX(img);
  ["En cours", "En review"].forEach(n => { const cc = S.col(img, { gap: 6, pad: 6, fill: C.card, radius: 6 }); const h = S.row(cc, { gap: 6 }); S.statusDot(h, n, 7); S.txt(h, n, { size: 11, weight: 500 }); [1, 2, 3].forEach(() => S.box(cc, { name: "card", fill: C.accent, radius: 4, w: 140, h: 22 })); });
  S.txt(out, "Les colonnes défilent dans leur fond.", { size: 13 }); help(out, "colonne-en-cours.png · collée depuis le presse-papiers, 84 ko"); return f.id; };

// ---------- 153 · Graphe navigable et ses formats de widget (spec composants §18 points 3 et 4) ----------
const node = (g, k, t, s, x, y, o = {}) => { const n = S.box(g, { name: "Node-" + k, fill: C.card, stroke: o.ring ? C.fg : (o.crit ? C.fg : C.border), sw: o.ring ? 2 : 1, radius: 8, w: 176, h: 52, dir: "column", gap: 2, pad: [8, 12] }); penpotUtils.setParentXY(n, x, y);
  const r = S.row(n, { gap: 6 }); S.statusDot(r, s, 7); S.txt(r, k, { size: 11, mono: true, color: C.dim }); S.txt(n, t, { size: 12, weight: 500 }); if (o.dim) n.opacity = 0.45; return n; };
const edge = (g, x1, y1, x2, y2, o = {}) => { const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${x2 - x1}" height="${Math.max(2, Math.abs(y2 - y1))}" viewBox="0 0 ${x2 - x1} ${Math.max(2, Math.abs(y2 - y1))}"><path d="M0 ${y2 >= y1 ? 1 : Math.abs(y2 - y1)} L${x2 - x1} ${y2 >= y1 ? Math.max(1, y2 - y1) : 1}" stroke="${o.crit ? C.fg : C.mfg}" stroke-width="${o.crit ? 2 : 1}" ${o.dashed ? 'stroke-dasharray="4 4"' : ""} fill="none"/></svg>`); s.name = "Edge"; g.appendChild(s); penpotUtils.setParentXY(s, x1, Math.min(y1, y2)); return s; };
const GRAPH = [["KIB-5", "Monorepo Bun workspaces", "Terminé", 40, 60], ["KIB-13", "Snapshots Loro ↔ SQLite", "Terminé", 40, 160], ["KIB-12", "Schéma Loro des tickets", "En cours", 300, 110], ["KIB-15", "Kanban : drag & drop", "À faire", 560, 110],
  ["KIB-11", "Démon : auth par jeton local", "En review", 40, 300], ["KIB-21", "Sandbox iframe", "Bloqué", 300, 300], ["KIB-16", "Moteur de règles", "En cours", 300, 400], ["KIB-22", "Export Markdown", "Backlog", 560, 350]];
const EDGES = [[0, 2], [1, 2], [2, 3], [4, 5, true], [5, 7, true], [6, 7]];
const drawGraph = (g, o = {}) => { EDGES.forEach(([a, b, crit]) => { const A = GRAPH[a], B = GRAPH[b]; edge(g, A[3] + 176, A[4] + 26, B[3], B[4] + 26, { crit }); }); edge(g, 476, 160, 476, 400, { dashed: true });
  GRAPH.forEach(([k, t, s, x, y]) => node(g, k, t, s, x, y, { ring: (o.sel || []).includes(k), crit: ["KIB-11", "KIB-21", "KIB-22"].includes(k) })); };
const legend = (p) => { const l = S.panel(p, { gap: 4, pad: [8, 12], radius: 8 }); [["Bloque", C.mfg, 1], ["Chemin critique", C.fg, 2], ["Lié à", C.mfg, 0]].forEach(([t, c, w]) => { const r = S.row(l, { gap: 8 }); S.box(r, { name: "line", fill: c, w: 18, h: w || 1, op: w ? 1 : 0.5 }); S.txt(r, t, { size: 11, color: C.mfg }); }); return l; };
const zoomBar = (p, z) => { const b = S.box(p, { name: "ZoomBar", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 2, pad: 3, hs: "auto", vs: "auto", align: "center" }); iconButton(b, "scan"); iconButton(b, "plus"); S.txt(b, z, { size: 11, mono: true }); iconButton(b, "minus"); return b; };
const graphScreen = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, "Graphe", ["Kibo", "Graphe"], ["graph", "Kibo · Graphe"]); S.topAction(r.frame, "Partager", "outline", "share2");
  const c = r.content; const tb = S.row(c, { gap: 8 }); [["Hiérarchique", "graph"], ["Chemin critique", "sparkles"], ["Masquer terminés"], ["Filtrer", "filter"]].forEach(([t, i]) => S.button(tb, t, "outline", { sm: true, icon: i }));
  S.spacer(tb); S.txt(tb, "Chemin critique : 3 tickets · 1 bloqué", { size: 12, color: C.mfg });
  const g = S.box(c, { name: "Canvas", fill: C.bg, stroke: C.border, radius: 10, w: 1144, h: 700 }); g.clipContent = true; drawGraph(g, o);
  const lg = legend(g); penpotUtils.setParentXY(lg, 16, 600); const zb = zoomBar(g, "125 %"); penpotUtils.setParentXY(zb, 1144 - 160, 650);
  const mm = S.box(g, { name: "Minimap", fill: C.card, stroke: C.border, radius: 8, w: 160, h: 100 }); penpotUtils.setParentXY(mm, 1144 - 176, 536); const vp = S.box(mm, { name: "Viewport", stroke: C.fg, w: 90, h: 56 }); penpotUtils.setParentXY(vp, 8, 8);
  return { ...r, g }; };
S.draw[153] = async () => { const { frame: f, g } = await graphScreen("153 · Graphe : navigation et sélection", 0, 3, { sel: ["KIB-21"] }); await wait(1500);
  const n = find(g, "Node-KIB-21"); const p = rel(f, n); const o = S.button(f, "Ouvrir", "outline", { sm: true }); abs(f, o, p.x, p.y + p.h + 6);
  tooltip(f, p.x + 190, p.y + 8, "Entrée : ouvrir · flèches : voisins · Échap : désélectionner"); S.frontAbs(f); return f.id; };
S.draw["153b"] = async () => { const { frame: f, g } = await graphScreen("153b · Graphe : sélection multiple", 2, 3, { sel: ["KIB-11", "KIB-21", "KIB-22"] });
  const box = S.box(g, { name: "Marquee", fill: C.blue, op: 0.08, stroke: C.blue, dashed: true, w: 760, h: 170 }); penpotUtils.setParentXY(box, 24, 286);
  const chip = S.badge(g, "3 sélectionnés", C.fg, { fill: C.accent }); penpotUtils.setParentXY(chip, 24, 16); return f.id; };
S.draw[154] = async () => { const { frame: f, g } = await dashboard(PAGE, "154 · Widget Graphe par format", 0, 4, { nav: "Tableau de bord" });
  const small = widget(g, "Graphe de dépendances", "graph", cell(0, 0, 3, 4)); const st = S.row(small.body, { gap: 0, justify: "center" }); S.child(st, { v: "fill" });
  [["Bloqués", "2"], ["Prêts", "4"], ["Chemin critique", "3"]].forEach(([l, v]) => { const k = S.col(st, { gap: 2, align: "center", w: 70 }); S.txt(k, l, { size: 11, color: C.mfg }); S.txt(k, v, { size: 22, weight: 700 }); });
  const med = widget(g, "Graphe de dépendances", "graph", cell(3, 0, 9, 4)); med.body.flex.dir = "row"; med.body.flex.columnGap = 8; med.body.flex.alignItems = "center";
  ["KIB-11", "KIB-21", "KIB-22"].forEach((k, i) => { if (i) S.icon(med.body, "chevRight", 14, C.dim); const n = S.box(med.body, { name: "Node", stroke: C.fg, radius: 6, dir: "row", gap: 6, pad: [6, 10], hs: "auto", vs: "auto", align: "center" }); S.statusDot(n, ["En review", "Bloqué", "Backlog"][i], 7); S.txt(n, k, { size: 11, mono: true }); });
  help(med.body, "Chemin critique · 3 tickets");
  const big = widget(g, "Graphe de dépendances", "graph", cell(0, 4, 12, 5), { pad: 0 }); const cv = S.box(big.body, { name: "Canvas", w: 1100, h: 300 }); drawGraph(cv); const zb = zoomBar(big.w, "100 %"); abs(big.w, zb, big.w.width - 150, big.w.height - 44);
  return f.id; };

// ---------- 155 · Onglet fermé, Annuler (§18.5) ----------
S.draw[155] = async () => { const { frame: f } = await kanbanAt(PAGE, "155 · Onglet fermé : Annuler", 0, 5);
  const t = S.toast(f, "Onglet fermé · Kibo · Changements", "green"); const ic = t.children.find(c => /^icon/.test(c.name)); if (ic) ic.remove(); S.button(t, "Annuler", "outline", { sm: true }); kbd(t, "⌘⇧T");
  penpotUtils.setParentXY(t, 1440 - 24 - 400, 940 - 40 - 24 - 52); return f.id; };

S.NOTES_GRAPHE = [150, 151, "151b", "151c", 152, "152b", "152c", "152d", 153, "153b", 154, 155];
return "notes-graphe ok";
