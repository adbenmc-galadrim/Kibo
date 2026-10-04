// Page « 23 · Didacticiel » : écrans 140 à 146 (phase 14, spec §20.8). Requiert 18-socle.js, 24-socle-suite.js et 27-installation-aide.js (écran d'accueil).
// 140 proposition, 141 à 145c une étape chacun (panneau à l'étape en cours), 146 fin et suppression de la démo.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "23 · Didacticiel";
const { abs, alertDialog, formDialog, input, select, help, labeled, appScreen } = S.fx;
const { iconButton, demoSidebar, cell, dashboard, widget, handles, demoKanban, filterBar, tutorialPanel } = S.fx2;
const D = ["Démo Kibo"];
const STEPS = ["Créer un ticket et le déplacer", "Lier deux tickets", "Écrire une note", "Réorganiser le tableau de bord", "Confier un ticket à un agent", "Créer un composant"];

// ---------- 140 · Proposition ----------
const offer = (f, done) => { const d = formDialog(f, "Faire le tour de Kibo ?", 448, "Six étapes dans un projet de démonstration, environ dix minutes. L'agent de démonstration ne consomme aucun token.");
  const l = S.col(d, { gap: 8 }); STEPS.forEach((t, i) => { const r = S.row(l, { gap: 8 }); if (i < done) S.icon(r, "check", 14, C.green); else S.txt(r, (i + 1) + ".", { size: 13, color: C.mfg }); S.txt(r, t, { size: 13, color: i < done ? C.mfg : C.fg }); });
  if (done) { S.footer(d, "Recommencer", "Reprendre"); } else S.footer(d, "Plus tard", "Commencer"); return d; };
S.draw[140] = async () => { const { frame: f } = await S.fx2.welcomeAt(PAGE, "140 · Didacticiel : proposition", 0, 0); offer(f, 0); S.frontAbs(f); return f.id; };
S.draw["140b"] = async () => { const { frame: f } = await S.fx2.welcomeAt(PAGE, "140b · Didacticiel : reprendre", 2, 0); offer(f, 2); S.frontAbs(f); return f.id; };

// ---------- Pages du projet de démonstration ----------
const demoDash = async (name, col, row, o = {}) => { const r = await dashboard(PAGE, name, col, row, { crumbs: [...D, "Tableau de bord"], tab: ["dashboard", "Démo Kibo · Tableau de bord"], edit: o.edit, changes: o.changes });
  demoSidebar(r.frame, "Tableau de bord"); const e = o.edit ? { edit: true } : {};
  const k = widget(r.g, "Kanban", "kanban", o.kanbanPos || cell(0, 0, 8, 6), { ...e, size: "8 × 6", format: "Large" }); filterBar(k.body, 8, 8);
  demoKanban(k.body, S.DEMO, ["Backlog", "À faire", "En cours", "En review"], 150);
  const t = widget(r.g, "Tickets", "list", o.ticketsPos || cell(8, 0, 4, 6), { ...e, size: "4 × 6", format: "Moyen" });
  [["DEMO-1", "En cours"], ["DEMO-2", "En cours"], ["DEMO-3", "Terminé"], ["DEMO-4", "Terminé"], ["DEMO-5", "En review"], ["DEMO-6", "À faire"], ["DEMO-7", "À faire"], ["DEMO-8", "Bloqué"]].forEach(([k2, s]) => {
    const rr = S.row(t.body, { gap: 8, pad: [3, 0] }); S.txt(rr, k2, { size: 11, mono: true, color: C.dim }); S.statusDot(rr, s, 7); S.txt(rr, s, { size: 12 }); });
  const n = widget(r.g, "Notes", "note", o.notesPos || cell(0, 6, 12, 3), { ...e, size: "12 × 3", format: "Demi-page" }); S.txt(n.body, "Bienvenue dans la démo", { size: 13, weight: 600 });
  S.sub(n.body, "Ce projet sert au didacticiel. Modifie cette note avec la barre d'outils : mets un mot en **gras**, ajoute une liste.");
  return { ...r, k, t, n }; };
const demoPage = async (name, col, row, page, icon) => { const r = await appScreen(PAGE, name, col, row, page, [...D, page], [icon, "Démo Kibo · " + page]); demoSidebar(r.frame, page); S.topAction(r.frame, "Partager", "outline", "share2"); return r; };
S.draw[141] = async () => { const { frame: f } = await demoDash("141 · Didacticiel : étape 1, panneau", 0, 1); tutorialPanel(f, 0); S.frontAbs(f); return f.id; };

// ---------- 142 · Étape 2 : lier deux tickets, les voir dans le graphe ----------
const dnode = (g, k, t, s, x, y, o = {}) => { const n = S.box(g, { name: "Node-" + k, fill: C.card, stroke: o.ring ? C.fg : C.border, sw: o.ring ? 2 : 1, radius: 8, w: 176, h: 52, dir: "column", gap: 2, pad: [8, 12] }); penpotUtils.setParentXY(n, x, y);
  const r = S.row(n, { gap: 6 }); S.statusDot(r, s, 7); S.txt(r, k, { size: 11, mono: true, color: C.dim }); S.txt(n, t, { size: 12, weight: 500 }); return n; };
const line = (g, x, y, w) => { const l = S.box(g, { name: "Edge", fill: C.mfg, w, h: 1 }); penpotUtils.setParentXY(l, x, y); return l; };
S.draw[142] = async () => { const { frame: f, content: c } = await demoPage("142 · Didacticiel : étape 2, graphe", 0, 2, "Graphe", "graph");
  const g = S.box(c, { name: "Canvas", fill: C.bg, stroke: C.border, radius: 10, w: 1144, h: 760 }); g.clipContent = true;
  dnode(g, "DEMO-4", "Monorepo", "Terminé", 60, 80); dnode(g, "DEMO-1", "Noyau de données", "En cours", 320, 80); dnode(g, "DEMO-2", "Schéma des tickets", "En cours", 320, 200, { ring: true }); dnode(g, "DEMO-6", "Kanban : glisser-déposer", "À faire", 580, 200, { ring: true });
  dnode(g, "DEMO-7", "Coque et sidecar", "À faire", 60, 320); dnode(g, "DEMO-8", "Bac à sable des composants", "Bloqué", 320, 320);
  line(g, 236, 106, 84); line(g, 496, 226, 84); const t = S.badge(g, "nouveau lien", C.fg, { fill: C.accent }); penpotUtils.setParentXY(t, 500, 236);
  tutorialPanel(f, 1); S.frontAbs(f); return f.id; };

// ---------- 143 · Étape 3 : écrire une note ----------
S.draw[143] = async () => { const { frame: f, content: c } = await demoPage("143 · Didacticiel : étape 3, note", 0, 3, "Notes", "note"); c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const list = S.panel(c, { w: 260, gap: 8, pad: 10 }); S.child(list, { v: "fill" }); input(list, "Rechercher une note…", { icon: "search", placeholder: true });
  const it = S.col(list, { gap: 2, pad: [8, 10], radius: 6, fill: C.accent }); S.txt(it, "Bienvenue", { size: 13, weight: 500 }); S.txt(it, "aujourd'hui", { size: 11, color: C.dim });
  const ed = S.panel(c, { gap: 0, pad: 0 }); const tb = S.row(ed, { gap: 2, pad: [6, 8] }); S.border(tb);
  ["heading", "|", "bold", "italic", "strike", "inlineCode", "|", "list", "listOrdered", "listChecks", "quote", "|", "link", "table", "squareCode"].forEach(i => { if (i === "|") S.box(tb, { name: "sep", fill: C.border, w: 1, h: 16 }); else iconButton(tb, i, { on: i === "bold", color: i === "bold" ? C.fg : C.mfg }); });
  const area = S.col(ed, { gap: 10, pad: 16 }); ["# Bienvenue dans la démo", "Ce projet sert au didacticiel. Modifie cette note avec la barre d'outils :", "mets un mot en **gras**, ajoute une liste.", "- une première idée"].forEach((l, i) => S.fillX(S.txt(area, l, { size: 13, mono: true, weight: i === 0 ? 600 : 400, lh: 1.6 })));
  S.box(area, { name: "gap", w: 1, h: 300 }); tutorialPanel(f, 2); S.frontAbs(f); return f.id; };

// ---------- 144 · Étape 4 : réorganiser le tableau de bord ----------
S.draw[144] = async () => { const { frame: f, t } = await demoDash("144 · Didacticiel : étape 4, disposition", 0, 4, { edit: true, changes: "1 changement", ticketsPos: cell(8, 0, 4, 7) });
  t.w.strokes = [{ strokeColor: C.fg, strokeWidth: 2, strokeAlignment: "inner", strokeOpacity: 1 }]; handles(t.w); tutorialPanel(f, 3); S.frontAbs(f); return f.id; };

// ---------- 145 · Étape 5 : confier un ticket à l'agent de démonstration ----------
const demoKanbanPage = async (name, col, row, data) => { const r = await demoPage(name, col, row, "Kanban", "kanban"); filterBar(r.content, 8, 8); demoKanban(r.content, data, undefined, 172); return r; };
const assignDialog = (f) => { const d = formDialog(f, "Assigner DEMO-7 à un agent", 576, "Coque et sidecar");
  labeled(d, "Profil", c => select(c, "Agent de démonstration · aucun token consommé", { fill: true, lead: s => S.icon(s, "bot", 13, C.mfg) }));
  labeled(d, "Brief (optionnel)", c => input(c, "Consignes pour l'agent", { placeholder: true }));
  const info = S.panel(d, { gap: 8, pad: 12 }); [["Espace", "dossier isolé"], ["Permissions", "acceptEdits"], ["Guidelines", "workspace · projet Démo Kibo (0 fichier .md)"], ["File d'attente", "place libre · démarre tout de suite"]].forEach(([k, v], i) => {
    const r = S.row(info, { gap: 8 }); const kk = S.box(r, { name: "k", w: 140, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); S.txt(r, v, { size: 12, color: i === 3 ? C.cyan : C.fg }); });
  S.footer(d, "Annuler", "Mettre en file", "brand"); return d; };
S.draw[145] = async () => { const { frame: f } = await demoKanbanPage("145 · Didacticiel : étape 5, assigner", 0, 5); assignDialog(f); tutorialPanel(f, 4, { here: true }); S.frontAbs(f); return f.id; };
const WAITING = { ...S.DEMO, "À faire": [S.DEMO["À faire"][0]], "En cours": [...S.DEMO["En cours"], { id: "DEMO-7", title: "Coque et sidecar", agent: "demo", run: "waiting", runL: "Attend" }] };
S.draw["145b"] = async () => { const { frame: f } = await demoKanbanPage("145b · Didacticiel : étape 5, question de l'agent", 2, 5, WAITING);
  const dr = S.box(f, { name: "AgentDrawer", fill: C.sidebar, stroke: C.border, w: 1192, h: 300, dir: "column", gap: 10, pad: [12, 16] }); abs(f, dr, 248, 940 - 300);
  const h = S.row(dr, { gap: 8 }); S.icon(h, "bot", 14, C.brand); S.txt(h, "demo-1", { size: 12, mono: true, weight: 600 }); S.txt(h, "DEMO-7 · Coque et sidecar", { size: 12, color: C.mfg });
  S.txt(h, "Agent de démonstration · aucun token consommé", { size: 12, color: C.brand }); S.spacer(h); S.txt(h, "dossier isolé", { size: 11, mono: true, color: C.dim });
  S.code(dr, [["20:06  SessionStart   lecture du ticket", C.mfg], ["20:06  PostToolUse    Read brief.md", C.mfg], ["20:06  Notification   Faut-il aussi mettre à jour la documentation ?", C.amber]]);
  const rp = S.row(dr, { gap: 8 }); S.fillX(S.txt(rp, "Faut-il aussi mettre à jour la documentation ?", { size: 13, weight: 500 })); S.button(rp, "Oui", "outline", { sm: true }); S.button(rp, "Non", "outline", { sm: true });
  const ir = S.row(dr, { gap: 8 }); input(ir, "Ton message…", { placeholder: true }); S.button(ir, "Répondre", "brand", { sm: true });
  tutorialPanel(f, 4, { y: 360 }); S.frontAbs(f); return f.id; };

// ---------- 145c · Étape 6 : créer un composant avec l'agent de démonstration ----------
S.draw["145c"] = async () => { const { frame: f } = await demoDash("145c · Didacticiel : étape 6, composant", 0, 6);
  const d = formDialog(f, "Créer un composant", 560, "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.");
  labeled(d, "Ce que doit faire le composant", c => input(c, "Avancement du sprint : tickets terminés par jour.", { h: 56 }));
  const tr = S.row(d, { gap: 12, align: "start" }); labeled(tr, "Type", c => select(c, "Widget", { fill: true })); labeled(tr, "Gabarit", c => select(c, "Graphique", { fill: true }));
  help(d, "Un agent génère le code avec le SDK public, dans un dossier brouillon, puis lance la suite de conformité. Tu relis le diff avant l'ajout.");
  const n = S.row(d, { gap: 6 }); S.icon(n, "bot", 14, C.brand); S.txt(n, "Agent de démonstration · aucun token consommé", { size: 12, color: C.brand });
  const ft = S.row(d, { gap: 8, justify: "end" }); S.spacer(ft); S.button(ft, "Annuler", "outline"); S.button(ft, "Générer avec un agent", "brand", { icon: "bot" });
  tutorialPanel(f, 5); S.frontAbs(f); return f.id; };

// ---------- 146 · Fin du didacticiel, suppression de la démo ----------
const bars = (p) => { const r = S.row(p, { gap: 10, align: "end" }); S.child(r, { v: "fill" }); [1, 1, 2, 3, 3, 5, 6, 8].forEach((v, i) => { const c = S.col(r, { gap: 4, align: "center", w: 40 }); S.box(c, { name: "Bar", fill: C.mfg, op: 0.6, radius: 3, w: 28, h: v * 14 }); S.txt(c, "J" + (i + 1), { size: 10, color: C.dim }); }); };
S.draw[146] = async () => { const { frame: f, g } = await demoDash("146 · Didacticiel : terminé", 0, 7, { notesPos: cell(0, 6, 6, 3) });
  const a = widget(g, "Avancement du sprint", "puzzle", cell(6, 6, 6, 3)); S.txt(a.body, "Graphique d'avancement · 8 terminés sur 8", { size: 12, color: C.mfg }); bars(a.body);
  tutorialPanel(f, 5, { done: true }); S.frontAbs(f); return f.id; };
S.draw["146b"] = async () => { const { frame: f } = await demoDash("146b · Supprimer la démo", 2, 7);
  alertDialog(f, "Supprimer le projet Démo Kibo ?", "8 tickets, 4 pages et la note Bienvenue seront supprimés. Tes autres projets ne sont pas touchés.", "Supprimer la démo"); S.frontAbs(f); return f.id; };

S.DIDACTICIEL = [140, "140b", 141, 142, 143, 144, 145, "145b", "145c", 146, "146b"];
return "didacticiel ok";
