// Page « 19 · Formats & créations » : écrans 127 à 135 (phase 9, plan kibo-phase-9-vague-4, libellés de 133 et 134 selon T55). Requiert 18-socle.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "19 · Formats & créations";
const { find, wait, shadow, abs, rel, menu, tooltip, alertDialog, input, select, help, hline, segmented, pageHead, appScreen, kanbanAt } = S.fx;

// ---------- 127 à 129 · Tableau de bord et formats ----------
const CELL = { w: 80.67, h: 60, gap: 16 };
const box = (x, y, w, h) => ({ x: Math.round(x * (CELL.w + CELL.gap)), y: Math.round(y * (CELL.h + CELL.gap)), w: Math.round(w * CELL.w + (w - 1) * CELL.gap), h: Math.round(h * CELL.h + (h - 1) * CELL.gap) });
const dots = (g, cols, rows) => { let svg = ""; for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) svg += `<circle cx="${(i * (CELL.w + CELL.gap) - CELL.gap / 2 + 2).toFixed(1)}" cy="${(j * (CELL.h + CELL.gap) - CELL.gap / 2 + 2).toFixed(1)}" r="1.2" fill="${C.border}"/>`;
  const w = Math.round(cols * (CELL.w + CELL.gap)), h = Math.round(rows * (CELL.h + CELL.gap)); const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>`); s.name = "GridDots"; g.appendChild(s); penpotUtils.setParentXY(s, -2, -2); return s; };
const widgetBody = (b, kind) => {
  if (kind === "Kanban") { const r = S.row(b, { gap: 8, align: "start" }); [["À faire", ["KIB-9", "KIB-15", "KIB-18"]], ["En cours", ["KIB-12", "KIB-14", "KIB-16"]], ["En review", ["KIB-7", "KIB-11"]]].forEach(([n, ks]) => {
    const c = S.col(r, { gap: 6, pad: 6, fill: C.muted, radius: 8 }); const h = S.row(c, { gap: 6 }); S.statusDot(h, n, 7); S.txt(h, n, { size: 11, weight: 500 }); ks.forEach(k => { const cd = S.panel(c, { gap: 2, pad: 8, radius: 6 }); S.txt(cd, k, { size: 10, mono: true, color: C.dim }); }); }); }
  else if (kind === "Tickets") [["KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours"], ["KIB-14", "Récepteur de hooks Claude Code", "En cours"], ["KIB-15", "Kanban : drag & drop entre colonnes", "À faire"], ["KIB-21", "Sandbox iframe des composants", "Bloqué"], ["KIB-22", "Export Markdown / Obsidian", "Backlog"]].forEach(([k, t, s]) => {
    const r = S.row(b, { gap: 8, pad: [4, 0] }); S.statusDot(r, s, 7); S.txt(r, k, { size: 11, mono: true, color: C.dim }); S.txt(r, t, { size: 12 }); });
  else if (kind === "Graphe") { const r = S.row(b, { gap: 10 }); ["KIB-11", "KIB-21", "KIB-22"].forEach((k, i) => { if (i) S.icon(r, "chevRight", 14, C.dim); const n = S.box(r, { name: "Node", stroke: C.border, radius: 6, dir: "row", pad: [4, 8], hs: "auto", vs: "auto" }); S.txt(n, k, { size: 11, mono: true }); }); help(b, "Chemin critique : 3 tickets"); }
  else ["Architecture du sync", "Décisions d'architecture", "Journal agents"].forEach(t => { const r = S.row(b, { gap: 8, pad: [3, 0] }); S.icon(r, "note", 13, C.mfg); S.txt(r, t, { size: 12 }); }); };
const ICON = { Kanban: "kanban", Tickets: "list", Graphe: "graph", Notes: "note" };
const widget = (g, title, pos, o = {}) => { const w = S.box(g, { name: "Widget-" + title, fill: C.card, stroke: o.ring || C.border, radius: 10, w: pos.w, h: pos.h, dir: "column", gap: 0 }); w.clipContent = true; penpotUtils.setParentXY(w, pos.x, pos.y);
  const h = S.row(w, { gap: 8, pad: [8, 10] }); S.border(h); if (o.edit) S.icon(h, "grip", 14, C.dim); S.icon(h, ICON[title], 14, C.mfg); S.fillX(S.txt(h, title, { size: 13, weight: 500 }));
  let fmt = null; if (o.edit) { fmt = select(h, "Format : " + o.format, { open: o.menu }); S.button(h, null, "ghost", { sm: true, icon: "x" }); } else S.icon(h, "more", 14, C.mfg);
  const b = S.col(w, { gap: 6, pad: 12 }); widgetBody(b, title); return { w, fmt }; };
const dashboard = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, "Tableau de bord", ["Kibo", "Tableau de bord"], ["dashboard", "Kibo · Tableau de bord"]);
  const c = r.content; const hd = S.row(c, { gap: 10 }); S.txt(hd, "Tableau de bord", { size: 18, weight: 600 }); S.spacer(hd);
  if (o.edit) { const tb = S.box(hd, { name: "LayoutToolbar", fill: C.muted, stroke: C.border, radius: 8, dir: "row", gap: 8, pad: [4, 4, 4, 12], hs: "auto", vs: "auto", align: "center" });
    S.txt(tb, "Disposition · 2 changements", { size: 12, weight: 500 }); S.button(tb, "Annuler", "outline", { sm: true }); S.button(tb, "Enregistrer", "default", { sm: true }); }
  else if (!o.narrow) S.button(hd, "Modifier la disposition", "outline", { sm: true, icon: "grid" });
  const g = S.box(c, { name: "Grid", w: 1144, h: 668 }); if (o.edit) dots(g, 12, 9);
  return { ...r, g }; };
S.draw[127] = async () => { const { frame: f, g } = await dashboard("127 · Tableau de bord : mode disposition", 0, 0, { edit: true });
  widget(g, "Kanban", box(0, 0, 6, 6), { edit: true, format: "Large" }); widget(g, "Tickets", box(6, 0, 6, 6), { edit: true, format: "Large" });
  widget(g, "Notes", box(6, 6, 6, 3), { edit: true, format: "Moyen" });
  const t = box(3, 6, 6, 3); const tgt = S.box(g, { name: "DropTarget", fill: C.accent, op: 0.5, stroke: C.fg, sw: 2, dashed: true, radius: 10, w: t.w, h: t.h }); penpotUtils.setParentXY(tgt, t.x, t.y);
  const { w } = widget(g, "Graphe", box(0, 6, 6, 3), { edit: true, format: "Moyen" }); w.opacity = 0.9; shadow(w, 0.5); penpotUtils.setParentXY(w, Math.round(t.x - 60), Math.round(t.y - 24)); w.rotation = -1;
  return f.id; };
S.draw["127b"] = async () => { const { frame: f, g } = await dashboard("127b · Mode disposition : place prise", 2, 0, { edit: true });
  widget(g, "Kanban", box(0, 0, 6, 6), { edit: true, format: "Large" }); widget(g, "Tickets", box(6, 0, 6, 6), { edit: true, format: "Large" }); widget(g, "Graphe", box(0, 6, 6, 3), { edit: true, format: "Moyen" });
  const t = box(6, 6, 6, 3); const tgt = S.box(g, { name: "DropTarget", fill: C.red, op: 0.12, stroke: C.red, sw: 2, dashed: true, radius: 10, w: t.w, h: t.h }); penpotUtils.setParentXY(tgt, t.x, t.y);
  const { w } = widget(g, "Notes", box(6, 6, 6, 3), { edit: true, format: "Moyen" }); w.opacity = 0.9; shadow(w, 0.5); penpotUtils.setParentXY(w, Math.round(t.x - 40), Math.round(t.y - 30)); w.rotation = -1;
  return f.id; };
S.draw[128] = async () => { const { frame: f, g } = await dashboard("128 · Menu Format", 0, 1, { edit: true });
  widget(g, "Kanban", box(0, 0, 6, 6), { edit: true, format: "Large" }); const { fmt } = widget(g, "Tickets", box(6, 0, 6, 6), { edit: true, format: "Large", menu: true });
  widget(g, "Graphe", box(0, 6, 6, 3), { edit: true, format: "Moyen" }); widget(g, "Notes", box(6, 6, 6, 3), { edit: true, format: "Moyen" }); await wait(2000);
  const p = rel(f, fmt); const m = menu(f, p.x + p.w - 250, p.y + p.h + 4, [["Moyen", null, { hint: "6 × 3" }], ["Large", null, { hint: "6 × 6", check: true, hover: true }], ["Demi-page", null, { hint: "12 × 6" }], ["Plein écran", null, { hint: "12 × 9 · Pas de place", disabled: true }], "-"], 250);
  const ft = S.box(m, { name: "MenuHelp", dir: "row", pad: [6, 8], vs: "auto" }); S.fillX(ft); S.fillX(S.txt(ft, "Un composant s'adapte à chacun de ses formats.", { size: 11, color: C.dim, lh: 1.4 })); S.frontAbs(f); return f.id; };
S.draw[129] = async () => { const { frame: f, content: c, g } = await dashboard("129 · Tableau de bord étroit", 0, 2, { narrow: true }); f.resize(900, 940);
  const hd = c.children.find(k => k.name === "row"); const more = S.box(hd, { name: "MoreButton", fill: C.accent, radius: 6, w: 28, h: 28, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 16, C.fg);
  g.resize(604, 668); g.clipContent = true; const W = 604; let y = 0;
  [["Kanban", 6], ["Tickets", 6], ["Graphe", 6], ["Notes", 3]].forEach(([t, rows]) => { const h = Math.round(rows * CELL.h + (rows - 1) * CELL.gap); widget(g, t, { x: 0, y, w: W, h }); y += h + CELL.gap; });
  await wait(2000); const p = rel(f, more); const m = menu(f, p.x + p.w - 280, p.y + p.h + 4, [["Nouvelle sous-page", "filePlus"], ["Renommer…", "pencil"], "-", ["Modifier la disposition", "grid", { disabled: true }]], 280);
  const ft = S.box(m, { name: "MenuHelp", dir: "row", pad: [4, 8, 6, 30], vs: "auto" }); S.fillX(ft); S.fillX(S.txt(ft, "Élargis la fenêtre pour modifier la disposition.", { size: 11, color: C.dim, lh: 1.4 })); S.frontAbs(f); return f.id; };

// ---------- 130 · Créations, 131 · indicateur ----------
const creationsScreen = async (name, col, row) => { const r = await appScreen(PAGE, name, col, row, null, ["Composants", "Créations"], ["sparkles", "Créations"]); S.activate(r.frame, "Composants");
  pageHead(r.content, "Créations", "Les composants que l'IA écrit pour toi. Une création continue même si tu fermes son dialogue."); return r; };
const runBadge = (cell, label, color) => { const b = S.row(cell, { gap: 4, hs: "auto" }); S.dot(b, color, 7); S.txt(b, label, { size: 12, color: C.fg }); };
const rowActions = (cell, done) => { S.button(cell, "Ouvrir", "outline", { sm: true }); S.button(cell, "Journal", "ghost", { sm: true }); if (!done) S.button(cell, "Abandonner…", "ghost", { sm: true }); };
const creationsTable = (c, title, rows, done) => { S.txt(c, title, { size: 14, weight: 600 });
  S.table(c, [["Composant"], ["Type", 110], ["Avancement", 260], ["Mis à jour", 150], ["Actions", 260]], rows.map(([t, id, mode, step, state, col, when]) => [
    cell => { const tv = S.col(cell, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, id, { size: 11, mono: true, color: C.dim }); }, cell => S.txt(cell, mode, { size: 12, color: C.mfg }),
    cell => { const tv = S.col(cell, { gap: 4 }); if (step) S.txt(tv, step, { size: 12 }); runBadge(tv, state, col); }, cell => S.txt(cell, when, { size: 12, color: C.dim }), cell => rowActions(cell, done)])); };
const ACTIVE = [["Burndown du sprint", "burndown", "Création", "2 · Générer (agent)", "En cours", C.brand, "mis à jour il y a 1 min"], ["Météo", "meteo", "Modification", "3 · Tests de conformité", "En file #2", C.cyan, "1 tentative"]];
S.draw[130] = async () => { const { frame: f, content: c } = await creationsScreen("130 · Créations", 0, 3); creationsTable(c, "En cours (2)", ACTIVE, false);
  creationsTable(c, "Terminées (1)", [["Hello", "hello", "Création", null, "Publié", C.green, "il y a 2 h"]], true); return f.id; };
S.draw["130b"] = async () => { const { frame: f, content: c } = await creationsScreen("130b · Créations vide", 2, 3);
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [80, 0], vs: "auto", align: "center" }); S.fillX(e); const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 48, h: 48, dir: "row", align: "center", justify: "center" }); S.icon(ic, "sparkles", 22, C.mfg);
  S.txt(e, "Aucune création pour l'instant.", { size: 15, weight: 600 }); S.button(e, "Créer un composant", "outline", { sm: true, icon: "plus" }); return f.id; };
S.draw["130c"] = async () => { const { frame: f, content: c } = await creationsScreen("130c · Abandonner une création", 4, 3); creationsTable(c, "En cours (2)", ACTIVE, false);
  alertDialog(f, "Abandonner Burndown du sprint ?", "Le brouillon et ses images sont supprimés ; le run en cours est arrêté.", "Abandonner"); S.frontAbs(f); return f.id; };
const indicator = (f) => { const tb = find(f, "Topbar"); const bell = tb.children.find(k => /bell/.test(k.name)); const idx = tb.children.findIndex(k => k.id === bell.id);
  const s = S.box(null, { name: "CreationsIndicator", fill: C.accent, radius: 6, w: 28, h: 28, dir: "row", align: "center", justify: "center" }); tb.insertChild(idx, s); S.icon(s, "sparkles", 16, C.fg); return s; };
S.draw[131] = async () => { const { frame: f } = await kanbanAt(PAGE, "131 · Indicateur des créations", 0, 4); const s = indicator(f); await wait(2000); const p = rel(f, s);
  const b = S.box(f, { name: "Badge", fill: C.amber, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); S.txt(b, "1", { size: 10, weight: 600, color: "#09090B" }); abs(f, b, p.x + 16, p.y - 6);
  tooltip(f, p.x - 150, p.y + p.h + 8, "Créations · 1 attend une action, 1 en cours"); S.frontAbs(f); return f.id; };

// ---------- 132 à 135 · Dialogue « Créer un composant » ----------
const compBg = async (name, col, row) => { const r = await appScreen(PAGE, name, col, row, null, ["Composants"], ["puzzle", "Composants"]); S.activate(r.frame, "Composants");
  pageHead(r.content, "Composants", "Les widgets et vues disponibles dans tes pages.", h => S.button(h, "Créer un composant", "default", { sm: true, icon: "plus" })); return r; };
const bigDialog = (f, w = 768, y = 16, h) => { S.overlay(f); const d = S.box(f, { name: "Dialog-Créer un composant", fill: C.card, stroke: C.border, radius: 12, w, dir: "column", gap: 16, pad: 24, vs: h ? "fix" : "auto" }); if (h) d.resize(w, h);
  shadow(d); abs(f, d, Math.round((1440 - w) / 2), y); const hd = S.row(d, { gap: 8, align: "start" }); const tv = S.col(hd, { gap: 4 }); S.txt(tv, "Créer un composant", { size: 18, weight: 600 }); return { d, tv, hd }; };
const lbl = (p, t) => S.txt(p, t, { size: 12, weight: 500 });
const thumb = (p, name, size) => { const r = S.row(p, { gap: 10, pad: 6, stroke: C.border, radius: 8 }); S.box(r, { name: "Thumb", fill: C.blue, op: 0.6, radius: 4, w: 40, h: 40 }); S.fillX(S.txt(r, name + " · " + size, { size: 11, mono: true, color: C.mfg })); S.button(r, null, "ghost", { sm: true, icon: "x" }); return r; };
const attachments = (p, files, error) => { const z = S.box(p, { name: "Attachments", stroke: C.border, dashed: true, radius: 8, dir: "column", gap: 8, pad: 12, vs: "auto" }); S.fillX(z);
  const h = S.row(z, { gap: 8 }); S.fillX(S.txt(h, "Maquettes (facultatif)", { size: 12, weight: 500 })); S.button(h, "Choisir des images", "outline", { sm: true, icon: "image" });
  help(z, "Glisse, colle ou choisis jusqu'à 4 images (PNG, JPEG, WebP, 256 ko max)."); files.forEach(([n, s]) => thumb(z, n, s)); if (error) help(z, error, C.red); return z; };
const describe = (col) => { const h = S.row(col, { gap: 8 }); S.icon(h, "sparkles", 16, C.brand); S.txt(h, "Décrire à l'IA", { size: 13, weight: 600 });
  lbl(col, "Ce que doit faire le composant"); input(col, "Burndown du sprint : tickets restants par jour, avec le total.", { h: 60 }); const cnt = S.row(col, { gap: 0, justify: "end" }); S.txt(cnt, "62 / 2000", { size: 11, mono: true, color: C.dim });
  lbl(col, "Titre"); input(col, "Burndown du sprint"); lbl(col, "Identifiant"); input(col, "burndown-du-sprint", { mono: true });
  lbl(col, "Type"); const tr = S.row(col, { gap: 12 }); select(tr, "Widget", { w: 160 }); S.check(tr, false, "Avec backend (server.ts)");
  lbl(col, "Formats"); const fr = S.row(col, { gap: 14 }); fr.flex.wrap = "wrap"; [["Petit", false], ["Moyen", true], ["Large", true], ["Demi-page", true], ["Plein écran", false]].forEach(([t, on]) => S.check(fr, on, t));
  help(col, "Les tailles que le composant sait occuper sur un tableau de bord."); };
const fromCode = (col) => { const h = S.row(col, { gap: 8 }); S.icon(h, "terminal", 16, C.mfg); S.txt(h, "Depuis le code", { size: 13, weight: 600 });
  S.sub(col, "Génère le squelette dans le dossier des composants du workspace :", { size: 12 }); S.code(col, ["$ kibo component new burndown", "$ kibo component test burndown", "$ kibo component dev burndown"]);
  S.sub(col, "Le composant apparaît dans « Mes composants » dès que les tests passent.", { size: 12 }); };
const createBody = (d, o = {}) => { const cols = S.row(d, { gap: 16, align: "start" });
  const l = S.panel(cols, { gap: 8, pad: 16, stroke: C.mfg }); describe(l);
  attachments(l, [["maquette-kanban.png", "84 ko"], ["maquette-kanban-clair.png", "79 ko"]], o.error ? "Format non pris en charge : PNG, JPEG ou WebP." : null);
  S.sub(l, "Un agent génère le code avec le SDK public, dans un dossier brouillon, puis lance la suite de conformité. Tu relis le diff avant l'ajout.", { size: 12 });
  S.button(l, "Générer avec un agent", "brand", { icon: "bot" });
  const r = S.panel(cols, { gap: 10, pad: 16, w: 300 }); fromCode(r); return cols; };
S.draw[132] = async () => { const { frame: f } = await compBg("132 · Décrire avec images et formats", 0, 5); const { d, tv, hd } = bigDialog(f);
  S.sub(tv, "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.", { size: 13 }); S.icon(hd, "x", 16, C.dim);
  createBody(d, { error: true }); S.frontAbs(f); return f.id; };
const STEPS = ["Décrire", "Générer (agent)", "Tests de conformité", "Permissions", "Ajouter à la page"];
const previewDialog = (f, o = {}) => { const { d, tv, hd } = bigDialog(f, 768, 16); S.sub(tv, "Fichiers écrits par l'agent. Relis le code avant de continuer.", { size: 13 }); S.icon(hd, "x", 16, C.dim);
  segmented(d, ["Diff", "Aperçu"], "Aperçu"); const fr = S.row(d, { gap: 12 }); segmented(fr, ["Moyen", "Large", "Demi-page"], "Large"); S.spacer(fr); S.txt(fr, "Aperçu isolé avec des données de démonstration. Rien n'est enregistré.", { size: 12, color: C.mfg });
  const pv = S.box(d, { name: "PreviewFrame", fill: C.bg, stroke: C.border, radius: 10, dir: "column", pad: 16, h: o.short ? 250 : 400, align: "center" }); S.fillX(pv); pv.clipContent = true;
  const cmp = S.panel(pv, { w: 560, gap: 10, pad: 18 }); S.txt(cmp, "Burndown du sprint", { size: 14, weight: 600 }); const v = S.row(cmp, { gap: 8, align: "end" }); S.txt(v, "17", { size: 30, weight: 700 }); S.txt(v, "tickets restants", { size: 12, color: C.mfg });
  const bars = S.row(cmp, { gap: 6, align: "end" }); [24, 22, 21, 19, 19, 18, 17].forEach(hh => S.box(bars, { name: "Bar", fill: C.mfg, op: 0.5, radius: 2, w: 28, h: hh * 4 }));
  ["KIB-12 · Schéma Loro des tickets (LoroTree)", "KIB-14 · Récepteur de hooks Claude Code", "KIB-15 · Kanban : drag & drop entre colonnes"].forEach(t => S.txt(cmp, t, { size: 11, mono: true, color: C.mfg }));
  return d; };
const footer = (d, cur, o = {}) => { S.stepper(d, STEPS, cur); const ft = S.row(d, { gap: 8, justify: "end" }); if (o.left) o.left(ft); S.spacer(ft); S.button(ft, "Abandonner", "ghost"); S.button(ft, "J'ai relu, continuer", "default", { disabled: !!o.busy }); };
S.draw[133] = async () => { const { frame: f } = await compBg("133 · Aperçu du brouillon", 0, 6); const d = previewDialog(f);
  footer(d, 2, { left: ft => S.button(ft, "Demander une modification", "outline", { icon: "pencil" }) }); S.frontAbs(f); return f.id; };
S.draw[134] = async () => { const { frame: f } = await compBg("134 · Demander une modification", 0, 7); const d = previewDialog(f, { short: true });
  const rv = S.panel(d, { gap: 8, pad: 14 }); S.txt(rv, "Demander une modification", { size: 13, weight: 600 }); lbl(rv, "Ce qu'il faut changer");
  input(rv, "Mets le total en gros et ajoute un filtre par domaine", { h: 56, focus: true }); const ct = S.row(rv, { gap: 8 }); S.txt(ct, "9 révisions restantes", { size: 11, color: C.dim }); S.spacer(ct); S.txt(ct, "53 / 2000", { size: 11, mono: true, color: C.dim });
  attachments(rv, []); const bt = S.row(rv, { gap: 8, justify: "end" }); S.spacer(bt); S.button(bt, "Annuler", "outline", { sm: true }); S.button(bt, "Envoyer à l'agent", "brand", { sm: true, icon: "bot" });
  footer(d, 2); S.frontAbs(f); return f.id; };
S.draw["134b"] = async () => { const { frame: f } = await compBg("134b · Modification envoyée à l'agent", 2, 7); const { d, tv, hd } = bigDialog(f, 768, 120);
  S.sub(tv, "Burndown du sprint · génération en cours", { size: 13 }); S.icon(hd, "x", 16, C.dim);
  const p = S.panel(d, { gap: 10, pad: 16 }); const r = S.row(p, { gap: 8 }); S.spinner(r, C.brand, 14); S.txt(r, "opus-dev", { size: 12, mono: true, weight: 600 }); S.txt(r, "Révision 1 sur 10", { size: 12, color: C.mfg });
  S.code(p, [["14:21  SessionStart   retour de relecture + 2 images", C.mfg], ["14:22  PostToolUse    Edit src/Burndown.tsx", C.mfg], ["14:22  PostToolUse    Edit src/filters.ts", C.mfg]]);
  help(d, "L'agent ne peut écrire que dans le dossier brouillon ; kibo.component.json est réservé à Kibo.");
  S.stepper(d, STEPS, 1); const ft = S.row(d, { gap: 8, justify: "end" }); S.spacer(ft); S.button(ft, "Continuer en arrière-plan", "outline"); S.button(ft, "Abandonner", "ghost"); S.frontAbs(f); return f.id; };
S.draw[135] = async () => { const { frame: f } = await compBg("135 · Dialogue borné (fenêtre de 700 px)", 0, 8); f.resize(1440, 700);
  const { d, tv, hd } = bigDialog(f, 768, 16, 668); S.sub(tv, "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.", { size: 13 }); S.icon(hd, "x", 16, C.dim);
  const sc = S.box(d, { name: "ScrollArea", dir: "column", gap: 0 }); S.fillX(sc); S.child(sc, { v: "fill" }); sc.clipContent = true; createBody(sc);
  const bar = S.box(d, { name: "Scrollbar", fill: C.border, radius: 3, w: 6, h: 180 }); abs(d, bar, 768 - 12, 150); S.frontAbs(f); return f.id; };

S.CREATIONS = [127, "127b", 128, 129, 130, "130b", "130c", 131, 132, 133, 134, "134b", 135];
return "formats-creations ok";
