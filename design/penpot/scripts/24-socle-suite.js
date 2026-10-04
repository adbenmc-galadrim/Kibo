// Socle des écrans des phases 12 à 15 (pages 20 à 24) : icônes, tableau de bord à grille, widgets, projet de démonstration, panneau du didacticiel.
// Requiert 18-socle.js (S.fx, S.baseScreen, S.both, S.job). Les helpers lisent S.C à l'appel : le clair est redessiné par S.setMode, comme en 18.
const S = storage, C = S.C;
S.draw = S.draw || {};
const { find, abs, shadow, rel, item, select, help, appScreen } = S.fx;

Object.assign(S.ICONS, {
  graduationCap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  penTool: '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>',
  maximize: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>',
  gamepad: '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"/>',
  box3d: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  heading: '<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
  inlineCode: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/>',
  listOrdered: '<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  listChecks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  squareCode: '<path d="m10 9-3 3 3 3"/><path d="m14 15 3-3-3-3"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  imagePlus: '<path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>',
  messagePlus: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/>',
  folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  minus: '<path d="M5 12h14"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  listTodo: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
});

const kbd = (p, k) => { const b = S.box(p, { name: "kbd", fill: C.accent, stroke: C.border, radius: 4, dir: "row", pad: [2, 6], hs: "auto", vs: "auto" }); S.txt(b, k, { size: 11, mono: true }); return b; };
const link = (p, t, o = {}) => { const r = S.row(p, { gap: 4, hs: "auto" }); S.txt(r, t, { size: o.size || 13, color: o.color || C.fg, weight: 500 }); if (o.icon) S.icon(r, o.icon, 13, C.mfg);
  const tx = r.children.find(c => c.type === "text"); if (tx) tx.textDecoration = "underline"; return r; };
const iconButton = (p, icon, o = {}) => { const b = S.box(p, { name: "IconButton-" + icon, fill: o.on ? C.accent : null, stroke: o.outline ? C.border : null, radius: 6, w: o.size || 28, h: o.size || 28, dir: "row", align: "center", justify: "center" }); S.icon(b, icon, o.icon || 15, o.color || C.mfg); return b; };
const empty = (p, t, o = {}) => { const e = S.box(p, { name: "Empty", dir: "column", gap: 10, pad: o.pad ?? [48, 16], vs: "auto", align: "center", justify: "center" }); S.fillX(e); if (o.fill) S.child(e, { v: "fill" });
  if (o.icon) { const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(ic, o.icon, 18, C.mfg); }
  S.txt(e, t, { size: 13, color: C.mfg }); if (o.action) o.action(e); return e; };

// ---------- Barre latérale : projet de démonstration, premier lancement ----------
const DEMO_COLOR = "#EC4899";
const KIBO_PAGES = ["Tableau de bord", "Kanban", "Tickets", "Graphe", "Notes", "Changements", "Ajouter une page"];
const insertAt = (sb, i, shape) => { sb.insertChild(i, shape); S.fillX(shape); return shape; };
const demoSidebar = (f, active, o = {}) => { const sb = find(f, "Sidebar"); KIBO_PAGES.forEach(l => { const it = item(f, l); if (it) it.remove(); });
  const anchor = item(f, "API Facturation"); let i = sb.children.findIndex(c => c.id === anchor.id) + 1;
  const p = insertAt(sb, i++, S.navItem(null, null, "Démo Kibo", { dot: DEMO_COLOR })); S.badge(p, "Démo", C.fg, { fill: C.accent });
  if (o.collapsed) return p;
  [["dashboard", "Tableau de bord"], ["kanban", "Kanban"], ["graph", "Graphe"], ["note", "Notes"]].forEach(([ic, l]) => insertAt(sb, i++, S.navItem(null, ic, l, { indent: 14, active: l === active })));
  return p; };
const noProjects = (f) => { const sb = find(f, "Sidebar"); const kids = [...sb.children]; const from = kids.findIndex(c => c.type === "text" && c.characters === "PROJETS"); const to = kids.findIndex(c => c.name === "spacer");
  kids.slice(from + 1, to).forEach(k => k.remove()); return sb; };
const bareTabs = (f) => { const tb = find(f, "TabBar"); tb.children.filter(c => (/^Tab-/.test(c.name) && c.name !== "Tab-Accueil") || c.name === "sep").forEach(c => c.remove()); return tb; };
const crumbAction = (f, label) => { const bc = find(f, "Breadcrumb"); return S.button(bc, label, "outline", { sm: true }); };

// ---------- Tableau de bord : grille de 12 colonnes, widgets posés en absolu ----------
const CELL = { w: 80.67, h: 60, gap: 16 };
const cell = (x, y, w, h) => ({ x: Math.round(x * (CELL.w + CELL.gap)), y: Math.round(y * (CELL.h + CELL.gap)), w: Math.round(w * CELL.w + (w - 1) * CELL.gap), h: Math.round(h * CELL.h + (h - 1) * CELL.gap) });
const dashboard = async (page, name, col, row, o = {}) => { const r = await appScreen(page, name, col, row, o.nav || "Tableau de bord", o.crumbs || ["Kibo", "Tableau de bord"], o.tab || ["dashboard", "Kibo · Tableau de bord"]);
  if (o.share !== false) S.topAction(r.frame, "Partager", "outline", "share2");
  if (!o.edit) crumbAction(r.frame, "Modifier la disposition");
  const c = r.content;
  if (o.edit) { const bar = S.row(c, { gap: 8 }); S.txt(bar, "Disposition", { size: 13, weight: 600 }); S.txt(bar, "· " + (o.changes || "Aucun changement"), { size: 13, color: C.mfg }); S.spacer(bar);
    S.button(bar, "Annuler", "outline", { sm: true }); S.button(bar, "Enregistrer", "default", { sm: true, disabled: !o.changes }); }
  const g = S.box(c, { name: "Grid", w: 1144, h: o.edit ? 640 : 680 }); g.clipContent = true;
  if (o.edit) { let svg = ""; for (let i = 0; i <= 12; i++) for (let j = 0; j <= 9; j++) svg += `<circle cx="${(i * (CELL.w + CELL.gap) - CELL.gap / 2 + 2).toFixed(1)}" cy="${(j * (CELL.h + CELL.gap) - CELL.gap / 2 + 2).toFixed(1)}" r="1.2" fill="${C.border}"/>`;
    const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="700" viewBox="0 0 1160 700">${svg}</svg>`); s.name = "GridDots"; g.appendChild(s); penpotUtils.setParentXY(s, -2, -2); }
  return { ...r, g }; };
const widget = (g, title, icon, pos, o = {}) => { const w = S.box(g, { name: "Widget-" + title, fill: C.card, stroke: o.ring || C.border, sw: o.ring ? 2 : 1, radius: 10, w: pos.w, h: pos.h, dir: "column" }); w.clipContent = true; penpotUtils.setParentXY(w, pos.x, pos.y);
  const h = S.row(w, { gap: 8, pad: [8, 10] }); S.border(h); if (o.edit) S.icon(h, "grip", 14, C.dim); S.icon(h, icon, 14, C.mfg); S.fillX(S.txt(h, title, { size: 13, weight: 500 }));
  if (o.head) o.head(h);
  if (o.edit) { S.txt(h, "Taille · " + o.size, { size: 11, mono: true, color: C.mfg }); select(h, "Format : " + o.format, { open: o.menu }); iconButton(h, "trash"); } else iconButton(h, "more");
  const body = S.box(w, { name: "WidgetBody", dir: "column", gap: o.gap ?? 8, pad: o.pad ?? 12 }); S.child(body, { h: "fill", v: "fill" }); body.clipContent = true;
  return { w, h, body }; };
const handles = (w) => { const mk = (x, y, ww, hh) => { const b = S.box(w, { name: "ResizeHandle", fill: C.fg, radius: 999, w: ww, h: hh }); abs(w, b, x, y); return b; };
  mk(w.width - 5, Math.round(w.height / 2) - 12, 4, 24); mk(Math.round(w.width / 2) - 12, w.height - 5, 24, 4); mk(w.width - 10, w.height - 10, 8, 8); };

// ---------- Projet de démonstration (§20.8), d'après les captures de la phase 14 ----------
S.DEMO = {
  "Backlog": [],
  "À faire": [{ id: "DEMO-6", title: "Kanban : glisser-déposer", wait: "DEMO-2" }, { id: "DEMO-7", title: "Coque et sidecar" }],
  "En cours": [{ id: "DEMO-1", title: "Noyau de données", sub: "1/2" }, { id: "DEMO-2", title: "Schéma des tickets" }],
  "En review": [{ id: "DEMO-5", title: "Thème sombre" }],
  "Bloqué": [{ id: "DEMO-8", title: "Bac à sable des composants", motif: "Audit en attente" }],
  "Terminé": [{ id: "DEMO-3", title: "Snapshots ↔ SQLite" }, { id: "DEMO-4", title: "Monorepo" }],
};
const demoCard = (p, t) => { const cd = S.box(p, { name: "TicketCard / " + t.id, fill: C.card, stroke: t.ring ? C.mfg : C.border, radius: 8, dir: "column", gap: 8, pad: 10, vs: "auto" }); S.fillX(cd); if (t.dim) cd.opacity = 0.5;
  const top = S.row(cd, { gap: 6 }); S.fillX(S.txt(top, t.id, { size: 11, mono: true, color: C.dim })); S.icon(top, "more", 14, C.dim);
  S.fillX(S.txt(cd, t.title, { size: 13, weight: 500, lh: 1.35 })); if (t.motif) S.txt(cd, "Motif : " + t.motif, { size: 11, color: C.red });
  if (t.wait) S.badge(cd, "attend " + t.wait, C.fg, { round: true }); if (t.sub) { const r = S.row(cd, { justify: "end" }); S.txt(r, t.sub, { size: 10, mono: true, color: C.dim }); }
  if (t.agent) S.agentBadge(cd, t.agent, t.run, t.runL); return cd; };
const demoColumn = (p, name, tickets, w) => { const col = S.box(p, { name: "Column / " + name, fill: C.muted, op: 0.5, radius: 10, dir: "column", gap: 8, pad: 6, w: w || 180 }); S.child(col, { v: "fill" });
  const hd = S.row(col, { gap: 6, pad: [4, 4] }); S.statusDot(hd, name); S.fillX(S.txt(hd, name, { size: 12, weight: 500 })); S.txt(hd, String(tickets.length), { size: 11, mono: true, color: C.dim }); S.icon(hd, "plus", 12, C.dim);
  tickets.forEach(t => demoCard(col, t)); return col; };
const filterBar = (p, shown, total, label = "Tous") => { const r = S.row(p, { gap: 8 }); const seg = S.box(r, { name: "ToggleGroup", stroke: C.border, radius: 6, dir: "row", hs: "auto", vs: "auto" });
  ["Moi + agents", "Tous"].forEach(t => { const b = S.box(seg, { name: "Toggle-" + t, fill: t === label ? C.accent : null, dir: "row", pad: [5, 10], hs: "auto", vs: "auto" }); S.txt(b, t, { size: 12, weight: 500 }); });
  S.spacer(r); S.txt(r, `${shown} / ${total} · ${label}`, { size: 12, mono: true, color: C.mfg }); return r; };
const demoKanban = (c, data = S.DEMO, cols = Object.keys(data), w) => { const board = S.box(c, { name: "Board", dir: "row", gap: 8 }); S.child(board, { h: "fill", v: "fill" });
  cols.forEach(n => demoColumn(board, n, data[n], w)); return board; };

// ---------- Panneau du didacticiel (§20.8) : six pastilles, consigne, actions ----------
const TUTO = [["Créer un ticket et le déplacer", "Sur la page Kanban, crée un ticket puis glisse-le dans la colonne En cours."],
  ["Lier deux tickets", "Ouvre la fiche d'un ticket, ajoute une dépendance vers un autre ticket, puis ouvre la page Graphe pour la voir."],
  ["Écrire une note", "Sur la page Notes, ouvre la note Bienvenue, clique sur Modifier et mets un mot en gras avec la barre d'outils."],
  ["Réorganiser le tableau de bord", "Sur le Tableau de bord, passe en mode édition puis déplace ou redimensionne un widget."],
  ["Confier un ticket à un agent", "Sur la page Kanban, ouvre un ticket ▸ Assigner à un agent ▸ Agent de démonstration. Réponds à sa question dans la barre des agents."],
  ["Créer un composant", "Sur le Tableau de bord : Ajouter un composant ▸ Décrire à l'IA ▸ gabarit Graphique, puis ajoute-le à la page."]];
const pips = (p, done, cur) => { const r = S.row(p, { gap: 6, hs: "auto" }); for (let i = 0; i < 6; i++) { const on = i < done;
  const b = S.box(r, { name: "Pip", fill: on ? C.fg : null, stroke: on ? null : (i === cur ? C.fg : C.border), sw: 1.5, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); if (on) S.icon(b, "check", 10, C.bg); } return r; };
const tutorialPanel = (f, step, o = {}) => { const done = o.done ? 6 : step; const p = S.box(f, { name: "TutorialPanel", fill: C.card, stroke: C.border, radius: 10, w: 320, dir: "column", gap: 12, pad: 16, vs: "auto" }); shadow(p);
  const h = S.row(p, { gap: 8 }); S.icon(h, "graduationCap", 16, C.fg); S.fillX(S.txt(h, "Didacticiel", { size: 13, weight: 600 })); S.txt(h, `${done} sur 6`, { size: 12, color: C.mfg }); S.icon(h, "chevDown", 14, C.mfg);
  pips(p, done, step);
  if (o.done) { S.txt(p, "Bravo, tu as fait le tour de Kibo", { size: 13, weight: 600 }); S.sub(p, "Tu peux supprimer le projet de démonstration : tes autres projets ne sont pas touchés.");
    const r = S.row(p, { gap: 8 }); S.button(r, "Supprimer le projet de démo", "destructive", { sm: true }); S.button(r, "Fermer", "outline", { sm: true }); }
  else { const [t, d] = TUTO[step]; S.txt(p, t, { size: 13, weight: 600 }); S.sub(p, d);
    const r = S.row(p, { gap: 8 }); S.button(r, "Aller à la page", "default", { sm: true, disabled: !!o.here }); S.button(r, "Passer cette étape", "outline", { sm: true });
    const l = S.row(p, { gap: 12 }); S.txt(l, "Mettre en pause", { size: 12, weight: 500 }); S.txt(l, "Arrêter le didacticiel", { size: 12, weight: 500 }); }
  abs(f, p, 1440 - 24 - 320, o.y ?? 610); return p; };

S.fx2 = { kbd, link, iconButton, empty, demoSidebar, noProjects, bareTabs, crumbAction, CELL, cell, dashboard, widget, handles, demoCard, demoColumn, demoKanban, filterBar, tutorialPanel, DEMO_COLOR };
return "socle-suite ok";
