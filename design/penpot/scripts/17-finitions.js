// Page « 14 · Finitions UI » : écrans 98 à 106 (phase 9, plan kibo-phase-9-vague-1).
// Écrans clonés d'une base (S.baseScreen, 18-socle.js), une rangée par écran, états en colonnes paires ; S.both(n) dessine le sombre puis le clair à droite.
// Menus : fond card, bordure border, entrée destructive en rouge, séparateur. Confirmations : AlertDialog centré avec voile.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "14 · Finitions UI";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const wait = ms => new Promise(r => setTimeout(r, ms));
const shadow = (b, o = 0.5) => { b.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: { color: "#000000", opacity: o } }]; };
const abs = (f, s, x, y) => { if (s.layoutChild) s.layoutChild.absolute = true; penpotUtils.setParentXY(s, x, y); return s; };
const byText = (root, t) => { const x = penpotUtils.findShape(s => s.type === "text" && s.characters === t, root); return x && x.parent; };
const rel = (f, s) => ({ x: Math.round(s.x - f.x), y: Math.round(s.y - f.y), w: Math.round(s.width), h: Math.round(s.height) });

Object.assign(S.ICONS, {
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  folderInput: '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
  filePlus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  circleDot: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  cornerUpLeft: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  minusSq: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/>',
  plusSq: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
});

// ---------- Primitives ----------
const menu = (f, x, y, items, w = 232) => { const m = S.box(f, { name: "ContextMenu", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(m); abs(f, m, x, y);
  items.forEach(it => { if (it === "-") { S.fillX(S.box(m, { name: "Separator", fill: C.border, h: 1, w: 10 })); return; }
    const [label, icon, o = {}] = it; const r = S.box(m, { name: "MenuItem", fill: o.hover ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r);
    if (o.status !== undefined) { const d = S.box(r, { name: "slot", w: 14, h: 14, dir: "row", align: "center", justify: "center" }); S.statusDot(d, o.status, 8); }
    else if (icon) S.icon(r, icon, 14, o.danger ? C.red : C.mfg); else S.box(r, { name: "slot", w: 14, h: 14 });
    S.fillX(S.txt(r, label, { size: 13, color: o.danger ? C.red : C.fg }));
    if (o.check) S.icon(r, "check", 14, C.fg); if (o.sub) S.icon(r, "chevRight", 14, C.mfg); if (o.kbd) S.txt(r, o.kbd, { size: 11, color: C.dim, mono: true }); });
  return m; };
const tooltip = (f, x, y, t) => { const b = S.box(f, { name: "Tooltip", fill: C.primary, radius: 6, dir: "row", pad: [6, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(b, t, { size: 12, color: C.pfg }); abs(f, b, x, y); return b; };
const alertDialog = (f, title, desc, ok = "Supprimer", w = 480) => { S.overlay(f);
  const d = S.box(f, { name: "Dialog-" + title, fill: C.card, stroke: C.border, radius: 12, w, dir: "column", gap: 20, pad: 24, vs: "auto" }); shadow(d, 0.5); abs(f, d, Math.round((1440 - w) / 2), 380);
  const tv = S.col(d, { gap: 8 }); S.fillX(S.txt(tv, title, { size: 17, weight: 600, lh: 1.3 })); S.sub(tv, desc, { size: 13 }); S.footer(d, "Annuler", ok, "destructive"); return d; };
const formDialog = (f, title, w = 440) => { S.overlay(f); const d = S.dialog(f, w, title); abs(f, d, Math.round((1440 - w) / 2), 330); return d; };
const input = (p, v, o = {}) => { const i = S.box(p, { name: "Input", fill: C.bg, stroke: o.error ? C.red : (o.focus ? C.mfg : C.border), radius: 6, dir: "row", gap: 8, pad: [8, 10], vs: "auto", align: "center", w: o.w });
  if (!o.w) S.fillX(i); if (o.focus) i.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 0, blur: 0, spread: 3, color: { color: "#71717A", opacity: 0.35 } }];
  if (o.icon) S.icon(i, o.icon, 14, C.dim); S.fillX(S.txt(i, v, { size: o.size || 13, weight: o.weight || 400, mono: !!o.mono, color: o.placeholder ? C.dim : C.fg })); return i; };
const select = (p, v, o = {}) => { const s = S.box(p, { name: "Select", fill: C.bg, stroke: o.open ? C.mfg : C.border, radius: 6, dir: "row", gap: 6, pad: [6, 10], vs: "auto", align: "center", w: o.w, hs: o.w ? undefined : "auto" });
  if (o.disabled) s.opacity = 0.5; if (o.lead) o.lead(s); S.txt(s, v, { size: 12, mono: !!o.mono }); if (o.w) S.spacer(s); S.icon(s, "chevDown", 12, C.dim); s.name = "Select-" + v; return s; };
const listbox = (f, x, y, opts, w = 200) => { const m = S.box(f, { name: "SelectContent", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(m); abs(f, m, x, y);
  opts.forEach(([t, on, lead]) => { const r = S.box(m, { name: "SelectItem", fill: on ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r);
    if (lead) lead(r); S.fillX(S.txt(r, t, { size: 13 })); if (on) S.icon(r, "check", 14, C.fg); }); return m; };
const help = (p, t, color = C.dim) => S.fillX(S.txt(p, t, { size: 12, color, lh: 1.4 }));
const hline = (p) => S.fillX(S.box(p, { name: "Separator", fill: C.border, h: 1, w: 10 }));
const ringed = (s) => { s.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; return s; };
const item = (f, label) => penpotUtils.findShape(s => /^SidebarItem ?\/ ?/.test(s.name) && s.name.replace(/^SidebarItem ?\/ ?/, "") === label, f);

// ---------- Écrans de base ----------
const screen = async (name, n, col, nav, crumbs, tab, o = {}) => { await S.page(PAGE); return S.baseScreen(name, col, n - 98, nav, crumbs, tab, o); };
const kanban = async (name, n, col = 0) => screen(name, n, col, "Kanban", ["Kibo", "Kanban"], ["kanban", "Kibo · Kanban"], { kanban: true });

// Sheet de KIB-12 (écran 4) : édition en place, sélecteurs, dépendances
const SUBS = [["KIB-24", "Types Zod Ticket / Link / Status", "Terminé"], ["KIB-25", "Opérations move / reparent", "Terminé"], ["KIB-26", "Index SQLite dérivé", "Terminé"],
  ["KIB-27", "Tests de convergence (fast-check)", "En cours"], ["KIB-29", "Migration v0 → v1", "À faire"]];
const sheetBox = (f, w = 520) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w, h: 900, dir: "column", gap: 16, pad: [20, 24] });
  sh.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 0, blur: 32, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; abs(f, sh, 1440 - w, 40); sh.clipContent = true; return sh; };
const prop = (p, k, fn) => { const r = S.row(p, { gap: 8 }); const kk = S.box(r, { name: "k", w: 100, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
const title = (p, t) => S.txt(p, t, { size: 13, weight: 600 });
const agentButton = (p) => { const b = S.button(p, "Assigner à un agent", "outline", { sm: true, icon: "bot" });
  b.children.filter(c => c.type === "text").forEach(t => t.fills = [{ fillColor: C.brand, fillOpacity: 1 }]);
  penpotUtils.findShapes(x => x.strokes?.length, b.children.find(c => /^icon/.test(c.name))).forEach(x => x.strokes = x.strokes.map(s => ({ ...s, strokeColor: C.brand }))); return b; };
const sheetHead = (sh, o = {}) => { const hd = S.row(sh, { gap: 6 }); S.txt(hd, "KIB-12", { size: 12, mono: true, color: C.mfg }); S.spacer(hd);
  const more = S.box(hd, { name: "MoreButton", fill: o.menu ? C.accent : null, radius: 6, w: 28, h: 28, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 16, o.menu ? C.fg : C.mfg);
  S.icon(hd, "x", 16, C.mfg); return hd; };
const sheetTitle = (sh, editing) => { if (!editing) { S.fillX(S.txt(sh, "Schéma Loro des tickets (LoroTree)", { size: 20, weight: 600, lh: 1.3 })); return; }
  const c = S.col(sh, { gap: 6 }); input(c, "Schéma Loro des tickets (LoroTree)", { focus: true, size: 18, weight: 600 }); help(c, "Entrée pour enregistrer · Échap pour annuler"); };
const sheetProps = (sh) => { const props = S.col(sh, { gap: 10 });
  prop(props, "Statut", r => select(r, "En cours", { lead: s => S.statusDot(s, "En cours", 8) }));
  prop(props, "Domaine", r => select(r, "Core", { lead: s => S.box(s, { name: "sq", fill: S.domainColors.Core, radius: 1, w: 7, h: 7 }) }));
  prop(props, "Assigné", r => select(r, "opus-dev-1", { disabled: true, lead: s => S.icon(s, "bot", 12, C.mfg) }));
  prop(props, "Branche", r => { S.icon(r, "git", 13, C.mfg); S.txt(r, "kib-12", { size: 12, mono: true }); }); return props; };
const ticketSheet = (f, o = {}) => { const sh = sheetBox(f); sheetHead(sh, o); sheetTitle(sh, o.editing);
  const ac = S.row(sh, { gap: 8 }); agentButton(ac);
  const props = sheetProps(sh);
  const de = S.col(sh, { gap: 8 }); const dh = S.row(de, { gap: 8 }); title(dh, "Description"); S.spacer(dh); S.button(dh, "Modifier", "ghost", { sm: true, icon: "pencil" });
  S.sub(de, "Arbre des tickets dans un LoroTree : déplacement et reparentage sans conflit, sous-tickets en profondeur illimitée, index SQLite dérivé.", { size: 13 });
  const st = S.col(sh, { gap: 4 }); const sth = S.row(st, { gap: 8 }); title(sth, "Sous-tickets"); S.txt(sth, "3/5", { size: 12, mono: true, color: C.dim });
  SUBS.forEach(([k, t, s], i) => { const r = S.row(st, { gap: 8, pad: [6, 8], radius: 6, fill: i === 3 && o.hoverSub ? C.accent : null }); S.statusDot(r, s, 8); S.txt(r, k, { size: 12, mono: true, color: C.dim });
    S.fillX(S.txt(r, t, { size: 13, color: s === "Terminé" ? C.mfg : C.fg })); S.icon(r, "chevRight", 14, C.dim); });
  return { sh, props }; };

// ---------- 98 · Fiche ticket éditable ----------
S.draw[98] = async () => { const { frame: f } = await kanban("98 · Fiche ticket éditable", 98);
  const { props } = ticketSheet(f, { editing: true, menu: true, hoverSub: true }); await wait(2000);
  const p = rel(f, find(props, "Select-opus-dev-1"));
  tooltip(f, p.x - 20, p.y + p.h + 6, "Choisis un profil via Assigner à un agent");
  menu(f, 1440 - 24 - 36 - 220, 40 + 20 + 32, [["Ouvrir dans un onglet", "external"], ["Copier la clé", "copy"], "-", ["Supprimer…", "trash", { danger: true }]], 220);
  S.frontAbs(f); return f.id; };

// ---------- 99 · Supprimer un ticket ----------
S.draw[99] = async () => { const { frame: f } = await kanban("99 · Supprimer un ticket", 99);
  ticketSheet(f, {}); alertDialog(f, "Supprimer KIB-12 ?", "Ses 5 sous-tickets et ses liens seront supprimés aussi. Cette action est irréversible."); S.frontAbs(f); return f.id; };

// ---------- 100 · Dépendances ----------
const DEPS = [["Bloqué par", [["KIB-5", "Monorepo Bun workspaces", "Terminé"], ["KIB-13", "Snapshots Loro ↔ SQLite", "Terminé"]]],
  ["Bloque", [["KIB-15", "Kanban : drag & drop entre colonnes", "À faire"]]], ["Lié à", [["KIB-16", "Moteur de règles déclaratif", "En cours"]]]];
const depsSheet = (f, form) => { const sh = sheetBox(f); sheetHead(sh); sheetTitle(sh, false);
  const ac = S.row(sh, { gap: 8 }); agentButton(ac); sheetProps(sh);
  const dp = S.col(sh, { gap: 10 }); const dh = S.row(dp, { gap: 8 }); title(dh, "Dépendances"); S.spacer(dh); S.button(dh, "Ajouter", "ghost", { sm: true, icon: "plus" });
  const rows = [];
  DEPS.forEach(([g, list]) => { const gc = S.col(dp, { gap: 2 }); S.txt(gc, g, { size: 11, weight: 500, color: C.dim });
    list.forEach(([k, t, s]) => { const done = s === "Terminé"; const r = S.row(gc, { gap: 8, pad: [6, 8], radius: 6 }); if (done) r.opacity = 0.5;
      S.statusDot(r, s, 8); S.txt(r, k, { size: 12, mono: true, color: C.dim }); S.fillX(S.txt(r, t, { size: 13 })); S.txt(r, s, { size: 11, color: C.mfg });
      const x = S.box(r, { name: "Retirer", radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(x, "x", 14, C.mfg); rows.push(x); }); });
  const fm = S.panel(dp, { name: "AddDependency", gap: 10, pad: 12, radius: 8 }); const fh = S.row(fm, { gap: 8 }); title(fh, "Ajouter une dépendance"); S.spacer(fh); S.icon(fh, "x", 14, C.mfg);
  const fr = S.row(fm, { gap: 8 }); const typ = select(fr, form.type, { w: 130, open: form.typeOpen }); const q = input(fr, form.query, { icon: "search", focus: !form.typeOpen, error: !!form.error });
  if (form.error) help(fm, form.error, C.red);
  const ft = S.row(fm, { gap: 8, justify: "end" }); S.button(ft, "Annuler", "outline", { sm: true }); S.button(ft, "Ajouter", "default", { sm: true, disabled: !form.canAdd });
  return { sh, typ, q, rows }; };
S.draw[100] = async () => { const { frame: f } = await kanban("100 · Dépendances", 100);
  const { q, rows } = depsSheet(f, { type: "Bloqué par", query: "KIB-2" }); await wait(2000);
  const p = rel(f, q); const res = S.box(f, { name: "SearchResults", fill: C.card, stroke: C.border, radius: 8, w: p.w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(res); abs(f, res, p.x, p.y + p.h + 4);
  [["KIB-21", "Sandbox iframe des composants", "Bloqué"], ["KIB-22", "Export Markdown / Obsidian", "Backlog"], ["KIB-24", "Types Zod Ticket / Link / Status", "Terminé"]].forEach(([k, t, s], i) => {
    const r = S.box(res, { name: "Result", fill: i === 0 ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r); S.statusDot(r, s, 8); S.txt(r, k, { size: 12, mono: true, color: C.dim }); S.fillX(S.txt(r, t, { size: 13 })); });
  const x = rel(f, rows[2]); tooltip(f, x.x - 22, x.y - 32, "Retirer"); S.frontAbs(f); return f.id; };
S.draw["100b"] = async () => { const { frame: f } = await kanban("100b · Dépendances : type de lien", 100, 2);
  const { typ } = depsSheet(f, { type: "Bloqué par", query: "Rechercher par clé ou titre…", typeOpen: true }); await wait(2000);
  const p = rel(f, typ); listbox(f, p.x, p.y + p.h + 4, [["Bloqué par", true], ["Bloque", false], ["Lié à", false]], 180); S.frontAbs(f); return f.id; };
S.draw["100c"] = async () => { const { frame: f } = await kanban("100c · Dépendances : boucle refusée", 100, 4);
  depsSheet(f, { type: "Bloque", query: "KIB-5", error: "Impossible : cela créerait une boucle de dépendances." }); S.frontAbs(f); return f.id; };

// ---------- 101 · Menu d'une page ----------
const pageScreen = async (name, col) => { const r = await kanban(name, 101, col); return r; };
S.draw[101] = async () => { const { frame: f } = await pageScreen("101 · Menu d'une page", 0);
  const it = item(f, "Kanban"); ringed(it); await wait(2000); const p = rel(f, it);
  const m = menu(f, p.x + 120, p.y + p.h - 4, [["Ouvrir dans un nouvel onglet", "external"], ["Nouvelle sous-page", "filePlus"], ["Renommer…", "pencil"], ["Monter", "arrowUp"], ["Descendre", "arrowDown"],
    ["Déplacer vers", "folderInput", { sub: true, hover: true }], "-", ["Supprimer…", "trash", { danger: true }]], 236);
  await wait(1500); const mv = rel(f, byText(m, "Déplacer vers")); menu(f, p.x + 120 + 236 - 4, mv.y - 4, [["Racine", "cornerUpLeft"], ["Tableau de bord", "dashboard", { hover: true }]], 190);
  S.frontAbs(f); return f.id; };
S.draw["101b"] = async () => { const { frame: f } = await pageScreen("101b · Renommer la page", 2);
  const d = formDialog(f, "Renommer la page"); S.field(d, "Nom", "Kanban", { focus: true }); S.footer(d, "Annuler", "Renommer"); S.frontAbs(f); return f.id; };
S.draw["101c"] = async () => { const { frame: f } = await pageScreen("101c · Supprimer la page", 4);
  alertDialog(f, "Supprimer la page Kanban ?", "Ses 2 sous-pages et 3 widgets disparaîtront."); S.frontAbs(f); return f.id; };
S.draw["101d"] = async () => { const { frame: f } = await pageScreen("101d · Déplacer une page (glisser-déposer)", 6);
  const src = item(f, "Graphe"); src.opacity = 0.4; const dst = item(f, "Tableau de bord");
  dst.fills = [{ fillColor: C.accent, fillOpacity: 1 }]; dst.strokes = [{ strokeColor: C.fg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  await wait(2000); const p = rel(f, dst); const g = S.box(f, { name: "DragGhost", fill: C.card, stroke: C.border, radius: 6, dir: "row", gap: 8, pad: [6, 10], hs: "auto", vs: "auto", align: "center" }); shadow(g);
  S.icon(g, "grip", 14, C.dim); S.icon(g, "graph", 14, C.mfg); S.txt(g, "Graphe", { size: 13 }); abs(f, g, p.x + 70, p.y + p.h - 8); g.opacity = 0.9;
  S.frontAbs(f); return f.id; };

// ---------- 102 · Menu d'un ticket dans l'arbre ----------
const TREE = [[0, "KIB-3", "Noyau de données", "En cours", "—", "1/2", true], [1, "KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours", "opus-dev-1", "3/5", true],
  [2, "KIB-24", "Types Zod Ticket / Link / Status", "Terminé", "opus-dev-1", ""], [2, "KIB-25", "Opérations move / reparent", "Terminé", "opus-dev-1", ""], [2, "KIB-26", "Index SQLite dérivé", "Terminé", "opus-dev-1", ""],
  [2, "KIB-27", "Tests de convergence (fast-check)", "En cours", "opus-dev-1", "0/1", true], [3, "KIB-28", "Générateur d'opérations concurrentes", "En cours", "haiku-tests", ""],
  [2, "KIB-29", "Migration v0 → v1", "À faire", "opus-dev", ""], [1, "KIB-13", "Snapshots Loro ↔ SQLite", "Terminé", "Adam", ""],
  [0, "KIB-4", "Orchestration des agents", "En cours", "—", "0/2"], [0, "KIB-6", "UI de base", "En cours", "—", "0/2"], [0, "KIB-9", "Setup Tauri + sidecar Bun", "À faire", "Adam", "2/3"],
  [0, "KIB-21", "Sandbox iframe des composants", "Bloqué", "Adam", "0/4"], [0, "KIB-22", "Export Markdown / Obsidian", "Backlog", "Adam", ""]];
const HOT = 5;
const treeScreen = async (name, col, o = {}) => { const r = await screen(name, 102, col, "Tickets", ["Kibo", "Tickets"], ["list", "Kibo · Tickets"]);
  const c = r.content; const tb = S.row(c, { gap: 8 }); S.txt(tb, "Tickets", { size: 15, weight: 600 }); S.txt(tb, "14 / 24", { size: 12, mono: true, color: C.dim }); S.spacer(tb); S.button(tb, "Nouveau ticket", "outline", { sm: true, icon: "plus" });
  let more = null, row = null;
  const t = S.table(c, [["Ticket"], ["Statut", 130], ["Assigné", 150], ["Sous-tickets", 90], ["", 28]], TREE.map(([lvl, k, ti, st, who, sub, open], i) => [
    cell => { if (lvl) S.box(cell, { name: "indent", w: 20 * lvl, h: 1 }); if (open) S.icon(cell, "chevDown", 14, C.dim); else S.box(cell, { name: "indent", w: 14, h: 1 });
      S.txt(cell, k, { size: 12, mono: true, color: C.dim }); S.txt(cell, ti, { size: 13 }); },
    cell => { S.statusDot(cell, st, 8); S.txt(cell, st, { size: 12 }); }, who, cell => S.txt(cell, sub || " ", { size: 12, mono: true, color: C.mfg }),
    cell => { if (i === HOT) row = cell.parent; if (i === HOT && o.more) { more = S.box(cell, { name: "MoreButton", fill: o.menuFromMore ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 14, C.fg); } else S.txt(cell, " ", { size: 12 }); }]), { hl: HOT });
  if (o.ring) ringed(row); return { ...r, row, more }; };
const TICKET_MENU = (sub) => [["Ouvrir", "ticket"], ["Statut", "circleDot", { sub: true, hover: sub }], ["Nouveau sous-ticket", "plus"], ["Déplacer à la racine", "cornerUpLeft"], "-", ["Supprimer…", "trash", { danger: true }]];
S.draw[102] = async () => { const { frame: f, row } = await treeScreen("102 · Menu d'un ticket dans l'arbre", 0, { ring: true, more: true }); await wait(2000);
  const p = rel(f, row); const mx = p.x + 320, my = p.y + p.h - 6; const m = menu(f, mx, my, TICKET_MENU(true), 220);
  await wait(1500); const s = rel(f, byText(m, "Statut"));
  menu(f, mx + 216, s.y - 4, [["Backlog", null, { status: "Backlog" }], ["À faire", null, { status: "À faire" }], ["En cours", null, { status: "En cours", check: true }], ["En review", null, { status: "En review" }],
    ["Bloqué…", null, { status: "Bloqué", hover: true }], ["Terminé", null, { status: "Terminé" }]], 180);
  S.frontAbs(f); return f.id; };
S.draw["102b"] = async () => { const { frame: f, more } = await treeScreen("102b · Menu « ⋯ » d'un ticket", 2, { more: true, menuFromMore: true }); await wait(2000);
  const p = rel(f, more); menu(f, p.x + p.w - 220, p.y + p.h + 4, TICKET_MENU(false), 220); S.frontAbs(f); return f.id; };
S.draw["102c"] = async () => { const { frame: f } = await treeScreen("102c · Bloquer un ticket", 4, {});
  const d = formDialog(f, "Bloquer KIB-27"); const ds = d.children.find(c => c.name === "header").children.find(c => c.name === "t");
  S.fillX(S.txt(ds, "Un ticket bloqué attend une condition extérieure au projet.", { size: 13, color: C.mfg, lh: 1.4 }));
  S.field(d, "Motif", "Informations attendues du client", { focus: true, placeholder: true }); S.footer(d, "Annuler", "Bloquer"); S.frontAbs(f); return f.id; };

// ---------- 103 · Menu d'une note ----------
const NOTES = [["Architecture du sync", "aujourd'hui · 2 liens"], ["Décisions d'architecture", "aujourd'hui · 3 liens"], ["Journal agents", "hier"], ["Idées composants", "22/09"], ["Réunion kick-off", "18/09"]];
const notesScreen = async (name, col, o = {}) => { const r = await screen(name, 103, col, "Notes", ["Kibo", "Notes"], ["note", "Kibo · Notes"]);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const list = S.panel(c, { w: 320, gap: 4, pad: 8 }); S.child(list, { v: "fill" }); input(list, "Rechercher une note…", { icon: "search", placeholder: true }); S.txt(list, "~/goinfre/Kibo/notes · Obsidian", { size: 11, color: C.dim });
  let more = null, hot = null;
  NOTES.forEach(([t, m], i) => { const r2 = S.row(list, { gap: 8, pad: [8, 10], radius: 6, fill: i === 0 ? C.accent : null }); S.icon(r2, "note", 14, C.mfg);
    const tv = S.col(r2, { gap: 2 }); S.txt(tv, t, { size: 13, weight: i === 0 ? 500 : 400 }); S.txt(tv, m, { size: 11, color: C.dim });
    if (i === 0) { hot = r2; if (o.more) { more = S.box(r2, { name: "MoreButton", fill: o.menu ? C.bg : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 14, C.fg); } } });
  const nb = S.row(list, { gap: 6, pad: [8, 10] }); S.icon(nb, "plus", 14, C.mfg); S.txt(nb, "Nouvelle note", { size: 13, color: C.mfg });
  const ed = S.panel(c, { gap: 12, pad: 24 }); S.child(ed, { v: "fill" }); const eh = S.row(ed, { gap: 8 }); S.fillX(S.txt(eh, "notes/architecture-du-sync.md", { size: 12, mono: true, color: C.dim })); S.txt(eh, "Enregistré ● local", { size: 12, color: C.dim });
  S.txt(ed, "Architecture du sync", { size: 24, weight: 600 }); S.txt(ed, "Serveur de relais", { size: 16, weight: 600 });
  S.sub(ed, "Le serveur kibo-sync ne fait que relayer les mises à jour Loro chiffrées entre les machines d'un projet partagé ; chaque machine garde l'état complet et fonctionne hors ligne.", { size: 14, color: C.fg });
  S.txt(ed, "Voir KIB-12 et KIB-13.", { size: 14, color: C.mfg });
  return { ...r, more, hot }; };
S.draw[103] = async () => { const { frame: f, more } = await notesScreen("103 · Menu d'une note", 0, { more: true, menu: true }); await wait(2000);
  const p = rel(f, more); menu(f, p.x - 4, p.y + p.h + 4, [["Renommer…", "pencil"], ["Supprimer…", "trash", { danger: true }]], 180); S.frontAbs(f); return f.id; };
S.draw["103b"] = async () => { const { frame: f } = await notesScreen("103b · Renommer la note", 2);
  const d = formDialog(f, "Renommer la note"); S.field(d, "Titre", "Architecture du sync", { focus: true }); help(d.children.find(c => /^Field/.test(c.name)), "Fichier : architecture-du-sync.md");
  S.footer(d, "Annuler", "Renommer"); S.frontAbs(f); return f.id; };
S.draw["103c"] = async () => { const { frame: f } = await notesScreen("103c · Supprimer la note", 4);
  alertDialog(f, "Supprimer la note « Architecture du sync » ?", "Le fichier architecture-du-sync.md sera supprimé du disque."); S.frontAbs(f); return f.id; };

// ---------- 104 · Menu d'un fichier modifié ----------
const FILES = [["Non indexés", "Tout indexer", [["packages/core/ticket.ts", "M", C.amber], ["notes.md", "A", C.green]]],
  ["Indexés", "Tout désindexer", [["packages/core/tree.ts", "M", C.amber], ["packages/schema/src/ticket.ts", "M", C.amber]]]];
const DIFF = [["@@ -12,6 +12,9 @@ export const TicketNode", C.dim, null], ["  export const TicketNode = z.object({", C.fg, null], ["    id: TicketId,", C.fg, null],
  ["-   parent: z.string().nullable(),", C.red, "#2A0F0F"], ["+   parentId: TicketId.nullable(),", C.green, "#0D1F12"], ["+   order: z.number().int(),", C.green, "#0D1F12"], ["+   depth: z.number().int().min(0),", C.green, "#0D1F12"],
  ["    status: Status,", C.fg, null], ["  });", C.fg, null]];
const changesScreen = async (name, col, o = {}) => { const r = await screen(name, 104, col, "Changements", ["Kibo", "Changements"], ["git", "Kibo · Changements"]);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const left = S.panel(c, { name: "ChangedFiles", w: 380, gap: 6, pad: 8 }); S.child(left, { v: "fill" });
  const wt = S.row(left, { gap: 8, pad: [4, 4] }); S.icon(wt, "branch", 14, C.mfg); S.fillX(S.txt(wt, "worktree kib-12", { size: 12, mono: true })); S.icon(wt, "chevDown", 12, C.dim);
  let hot = null;
  FILES.forEach(([sec, all, list]) => { const h = S.row(left, { gap: 8, pad: [8, 6, 4, 6] }); S.txt(h, sec.toUpperCase(), { size: 10, weight: 600, color: C.dim }); S.txt(h, String(list.length), { size: 11, mono: true, color: C.dim }); S.spacer(h);
    S.button(h, all, "ghost", { sm: true, icon: sec === "Indexés" ? "minusSq" : "plusSq" });
    list.forEach(([p, k, col], i) => { const sel = sec === "Non indexés" && (o.selectAll || i === 0); const fr = S.row(left, { name: "File-" + p, gap: 8, pad: [6, 8], radius: 6, fill: sel ? C.accent : null });
      S.icon(fr, "fileCode", 14, C.mfg); S.fillX(S.txt(fr, p, { size: 12, mono: true })); S.txt(fr, k, { size: 12, mono: true, weight: 600, color: col }); if (sec === "Non indexés" && i === 0) hot = fr; }); });
  const right = S.panel(c, { gap: 0, pad: 0 }); S.child(right, { v: "fill" }); const rh = S.row(right, { gap: 8, pad: [10, 14] }); S.border(rh);
  S.fillX(S.txt(rh, "packages/core/ticket.ts", { size: 12, mono: true })); S.txt(rh, "+3 −1", { size: 12, mono: true, color: C.mfg });
  const code = S.col(right, { gap: 0, pad: [6, 0] }); DIFF.forEach(([t, col, bg]) => { const l = S.row(code, { gap: 0, pad: [2, 14], fill: bg }); S.fillX(S.txt(l, t, { size: 12, mono: true, color: col, lh: 1.5 })); });
  if (o.ring) ringed(hot); return { ...r, hot }; };
S.draw[104] = async () => { const { frame: f, hot } = await changesScreen("104 · Menu d'un fichier modifié", 0, { ring: true }); await wait(2000);
  const p = rel(f, hot); menu(f, p.x + 150, p.y + p.h - 6, [["Voir le diff", "fileDiff"], ["Ouvrir dans un onglet", "external"], ["Ouvrir dans l'éditeur externe", "code"], ["Copier le chemin", "copy"], ["Indexer", "plusSq"],
    "-", ["Annuler les changements…", "undo", { danger: true }]], 250); S.frontAbs(f); return f.id; };
S.draw["104b"] = async () => { const { frame: f } = await changesScreen("104b · Annuler les changements", 2, { selectAll: true });
  alertDialog(f, "Annuler les changements de 2 fichiers ?", "ticket.ts reviendra à sa dernière version commitée. notes.md est nouveau : il sera supprimé du disque. Cette action est irréversible.", "Annuler les changements", 500);
  S.frontAbs(f); return f.id; };

// ---------- 105 · Réglages d'un widget ----------
const dashScreen = async (name, col, o = {}) => { const r = await screen(name, 105, col, "Tableau de bord", ["Kibo", "Tableau de bord"], ["dashboard", "Kibo · Tableau de bord"]);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const w = S.panel(c, { name: "Widget", w: 780, gap: 0, pad: 0, radius: 10 }); const h = S.row(w, { gap: 8, pad: [10, 14] }); S.border(h);
  S.icon(h, "kanban", 14, C.mfg); S.fillX(S.txt(h, "Kanban", { size: 13, weight: 500 })); S.txt(h, "Moi + agents", { size: 12, color: C.dim });
  const more = S.box(h, { name: "MoreButton", fill: o.menu ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 16, o.menu ? C.fg : C.mfg);
  const body = S.box(w, { name: "Body", dir: "row", gap: 8, pad: 16, w: 780, h: 520 }); S.fillMiniKanban(body);
  const n = S.panel(c, { name: "Widget", gap: 0, pad: 0, radius: 10 }); const nh = S.row(n, { gap: 8, pad: [10, 14] }); S.border(nh); S.icon(nh, "note", 14, C.mfg); S.fillX(S.txt(nh, "Notes récentes", { size: 13, weight: 500 })); S.icon(nh, "more", 16, C.mfg);
  const nb = S.col(n, { gap: 4, pad: [8, 14] }); NOTES.slice(0, 4).forEach(([t, m]) => { const r2 = S.row(nb, { gap: 8, pad: [6, 0] }); S.icon(r2, "note", 14, C.mfg); S.fillX(S.txt(r2, t, { size: 13 })); S.txt(r2, m.split(" · ")[0], { size: 11, color: C.dim }); });
  return { ...r, more }; };
S.draw[105] = async () => { const { frame: f } = await dashScreen("105 · Réglages d'un widget", 0);
  const d = formDialog(f, "Réglages · Kanban", 460); const fl = S.col(d, { gap: 6 }); S.txt(fl, "Filtre", { size: 12, weight: 500 }); const s = select(fl, "Moi + agents", { w: 412, open: true });
  help(d, "Ces réglages ne concernent que ce widget."); S.footer(d, "Annuler", "Enregistrer"); await wait(2000);
  const p = rel(f, s); listbox(f, p.x, p.y + p.h + 4, [["Moi + agents", true], ["Tous", false]], p.w); S.frontAbs(f); return f.id; };
S.draw["105b"] = async () => { const { frame: f, more } = await dashScreen("105b · Menu « ⋯ » d'un widget", 2, { menu: true }); await wait(2000);
  const p = rel(f, more); menu(f, p.x + p.w - 230, p.y + p.h + 4, [["Mettre à jour vers…", "arrowUpCircle"], ["Réglages…", "settings"], "-", ["Retirer de la page…", "trash", { danger: true }]], 230); S.frontAbs(f); return f.id; };
S.draw["105c"] = async () => { const { frame: f } = await dashScreen("105c · Retirer un widget", 4);
  alertDialog(f, "Retirer Kanban de la page ?", "Le widget disparaît de la page ; les tickets ne sont pas touchés.", "Retirer"); S.frontAbs(f); return f.id; };

// ---------- 106 · Domaine : nom et couleur ----------
const DOMAINS = [["Core", 3], ["Agents", 1], ["UI", 2], ["Sécurité", 1], ["DevOps", 0], ["Intégrations", 0], ["Facturation", 0]];
const PALETTE = ["#14B8A6", "#6366F1", "#EC4899", "#B45309", "#64748B", "#84CC16", "#D946EF"];
const domainScreen = async (name, col, o = {}) => { const r = await screen(name, 106, col, null, ["Paramètres", "Domaines & guidelines"], ["settings", "Paramètres"], {});
  S.activate(r.frame, "Paramètres");
  const c = r.content; const hd = S.col(c, { gap: 4 }); S.txt(hd, "Domaines & guidelines", { size: 20, weight: 600 });
  S.sub(hd, "Les guidelines sont des .md injectés aux agents, dans l'ordre workspace → projet → domaine du ticket.", { size: 13 });
  const row = S.row(c, { gap: 16, align: "start" }); const left = S.panel(row, { w: 280, gap: 2, pad: 8 }); S.label(left, "Domaines");
  DOMAINS.forEach(([d, n], i) => { const it = S.row(left, { gap: 8, pad: [7, 8], radius: 6, fill: i === 0 ? C.accent : null }); S.box(it, { name: "sq", fill: S.domainColors[d], radius: 2, w: 8, h: 8 });
    S.fillX(S.txt(it, d, { size: 13, weight: i === 0 ? 500 : 400 })); S.txt(it, n + " .md", { size: 11, mono: true, color: C.dim }); });
  const nd = S.row(left, { gap: 6, pad: [7, 8] }); S.icon(nd, "plus", 14, C.mfg); S.txt(nd, "Nouveau domaine", { size: 13, color: C.mfg });
  const right = S.panel(row, { gap: 14, pad: 20 }); const h = S.row(right, { gap: 10 });
  const sw = S.box(h, { name: "ColorSwatch", fill: S.domainColors.Core, radius: 4, w: 20, h: 20 }); if (o.palette) sw.strokes = [{ strokeColor: C.fg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }];
  let field = null;
  if (o.rename) { const fc = S.row(h, { gap: 6, hs: "auto" }); S.txt(fc, "Domaine ·", { size: 16, weight: 600 }); field = input(fc, "Core", { focus: true, w: 200, size: 15, weight: 600 }); S.button(fc, null, "ghost", { sm: true, icon: "check" }); S.button(fc, null, "ghost", { sm: true, icon: "x" }); S.spacer(h); }
  else { S.txt(h, "Domaine · Core", { size: 16, weight: 600 }); S.icon(h, "pencil", 14, C.mfg); S.spacer(h); }
  S.txt(h, "utilisé par 7 tickets", { size: 12, color: C.dim }); S.button(h, "Supprimer le domaine Core", "outline", { sm: true, icon: "trash" });
  [["core.md", "Conventions du noyau : aucune I/O, types Zod."], ["loro-patterns.md", "Arbres Loro : move plutôt que delete + create."], ["tests.md", "fast-check pour la convergence, jamais de tokens."]].forEach(([fn, d]) => {
    const fr = S.row(right, { gap: 10, pad: [10, 12], stroke: C.border, radius: 8 }); S.icon(fr, "file", 14, C.mfg); const tv = S.col(fr, { gap: 2 }); S.txt(tv, "guidelines/" + fn, { size: 12, mono: true }); S.txt(tv, d, { size: 12, color: C.mfg });
    S.button(fr, "Éditer", "ghost", { sm: true }); });
  S.button(right, "Ajouter un fichier", "outline", { sm: true, icon: "plus" });
  return { ...r, sw, field }; };
S.draw[106] = async () => { const { frame: f, sw } = await domainScreen("106 · Domaine : nom et couleur", 0, { rename: true, palette: true }); await wait(2000);
  const p = rel(f, sw); const pop = S.box(f, { name: "ColorPopover", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 8, pad: 10, hs: "auto", vs: "auto", align: "center" }); shadow(pop); abs(f, pop, p.x - 10, p.y + p.h + 8);
  PALETTE.forEach((col, i) => { const b = S.box(pop, { name: "Color " + col, fill: col, radius: 999, w: 22, h: 22, dir: "row", align: "center", justify: "center" });
    if (i === 0) { b.strokes = [{ strokeColor: C.fg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }]; S.icon(b, "check", 12, "#FFFFFF"); } });
  S.frontAbs(f); return f.id; };
S.draw["106b"] = async () => { const { frame: f } = await domainScreen("106b · Supprimer le domaine", 2);
  alertDialog(f, "Supprimer le domaine Core ?", "Ses 3 fichiers de guidelines seront supprimés."); S.frontAbs(f); return f.id; };

S.FINITIONS = [98, 99, 100, "100b", "100c", 101, "101b", "101c", "101d", 102, "102b", "102c", 103, "103b", "103c", 104, "104b", 105, "105b", "105c", 106, "106b"];
return "finitions ok";
