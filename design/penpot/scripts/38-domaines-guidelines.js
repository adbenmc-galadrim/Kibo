// Page « 34 · Domaines & guidelines » : écrans 207 à 209b, ajustés d'après les captures de la tâche 20 (phase 23, spec §31.5 et §31.8). Requiert 18-socle.js, 17-finitions.js, 24-socle-suite.js, 32b, 32d et 35 (S.one).
// D'après l'écran 106 (page 14 : colonne « Domaines », en-tête de domaine), la navigation des Paramètres (18-socle) et l'encart replié de la page Agents (page 31).
// Données : design/donnees-fictives.md, section « Domaines & guidelines (phase 23) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "34 · Domaines & guidelines";
const { find, wait, shadow, abs, rel, hline, input, select, help, labeled, segmented, formDialog, settingsScreen, appScreen, item } = S.fx;
const { iconButton, link } = S.fx2;

S.ICONS.info = S.ICONS.info || '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>';
S.ICONS.trash = S.ICONS.trash || '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>';

// ---------- Données (donnees-fictives.md, « Domaines & guidelines (phase 23) ») ----------
const COLORS = { Kibo: "#F97316", Portail: "#A855F7", Facturation: "#22C55E", Boutique: "#14B8A6",
  Sync: "#0EA5E9", UI: "#EC4899", CI: "#64748B", "Démon": "#6366F1", "Sécurité": "#A16207", Livraison: "#84CC16" };
const WS_FILES = ["guidelines/conventions.md", "guidelines/git.md"];
const WS_DOMAINS = [["Sécurité", 1]];
const PROJECTS = [
  { name: "Kibo", count: 7, files: ["guidelines/kibo.md", "guidelines/tests.md", "guidelines/ui.md"], domains: [["Sync", 1], ["UI", 1], ["CI", 1], ["Démon", 1]] },
  { name: "Portail", count: 1, files: ["guidelines/portail.md"], domains: [], locked: true },
  { name: "Facturation", count: 0, files: [], domains: [] },
  { name: "Boutique", count: 2, files: ["guidelines/boutique.md"], domains: [["Livraison", 1]] },
];
const KIBO_MD = ["# Kibo", "", "Monorepo Bun, TypeScript strict, ESM. Lint et format : Biome (bun run check).", "",
  "## Code", "- Code et identifiants en anglais ; textes d'interface en français (i18n/fr.ts).", "- Aucun commentaire : noms explicites, petites fonctions.",
  "- Erreurs du domaine : KiboError avec un code stable.", "", "## Paquets", "- core ne fait aucune I/O ; ui ne parle qu'au démon."];
const SYNC_MD = ["# Sync", "", "Serveur kibo-sync (Bun, SQLite) : un doc Loro par projet partagé.", "",
  "- Toute mise à jour passe par importUpdates, jamais par un JSON réécrit.", "- Tests de convergence avec fast-check, sans réseau.", "- Un lecteur reçoit les mises à jour mais n'en émet aucune."];
const SECU_MD = ["# Sécurité", "", "- Démon sur 127.0.0.1 uniquement.", "- Secrets dans le trousseau système, jamais dans le CRDT ni dans les logs.",
  "- Jamais --dangerously-skip-permissions par défaut.", "- Toute entrée réseau est validée par un schéma Zod."];
const PORTAIL_MD = ["# Portail", "", "Application Next.js du portail client, partagée par l'équipe Produit.", "",
  "- Composants dans src/components, un fichier par composant.", "- Textes d'interface en français, dates au format JJ/MM/AAAA.", "- Toute page publique passe la revue d'accessibilité."];

// ---------- Coque : projets Kibo, Portail, Facturation, Boutique ----------
const RENAME = [[/API Facturation/g, "Facturation"], [/Portfolio/g, "Portail"]];
const projectsShell = (f) => { ["Sidebar", "TabBar"].forEach(n => { const s = find(f, n); if (!s) return;
  penpotUtils.findShapes(t => t.type === "text" && /API Facturation|Portfolio/.test(t.characters), s)
    .forEach(t => S.setText(t, RENAME.reduce((a, [re, to]) => a.replace(re, to), t.characters))); });
  const sb = find(f, "Sidebar"), fac = item(f, "API Facturation"); if (!sb || !fac) return;
  const b = S.navItem(null, null, "Boutique", { dot: COLORS.Boutique }); sb.insertChild(0, b); S.fillX(b); sb.insertChild(sb.children.findIndex(c => c.id === fac.id) + 1, b); S.fixIconOrder(f); };
const ROW = 1.4;
const page = async (name, col, row, o = {}) => { const r = await settingsScreen(PAGE, name, col, row * ROW, "Domaines & guidelines");
  r.frame.resize(1440, o.h || 1040); projectsShell(r.frame); return r; };

// ---------- Encart « Comment les agents sont configurés » ----------
const sq = (p, color, s = 8) => S.box(p, { name: "sq", fill: color, radius: 2, w: s, h: s });
const step = (p, n, t, lead) => { const b = S.box(p, { name: "Step-" + t, fill: C.muted, radius: 6, dir: "row", gap: 6, pad: [4, 8], hs: "auto", vs: "auto", align: "center" });
  S.txt(b, n, { size: 11, mono: true, color: C.dim }); lead(b); S.txt(b, t, { size: 12, weight: 500 }); return b; };
const howAgents = (p, open) => { const b = S.panel(p, { name: "HowAgentsAreConfigured", gap: 10, pad: [12, 16] });
  const h = S.row(b, { gap: 8 }); S.icon(h, open ? "chevDown" : "chevRight", 14, C.mfg); S.icon(h, "info", 14, C.mfg); S.txt(h, "Comment les agents sont configurés", { size: 13, weight: 600 }); S.spacer(h);
  if (!open) { S.txt(h, "workspace → projet → domaine → profil de l'agent", { size: 12, color: C.dim }); return b; }
  const chain = S.row(b, { name: "Order", gap: 6, pad: [0, 0, 0, 22] });
  [["1", "Workspace", x => S.icon(x, "grid", 12, C.mfg)], ["2", "Projet du ticket", x => S.icon(x, "folder", 12, C.mfg)], ["3", "Domaine du ticket", x => sq(x, C.mfg, 7)],
    ["4", "Profil de l'agent : spec et skills", x => S.icon(x, "bot", 12, C.mfg)]].forEach(([n, t, lead], i) => { if (i) S.icon(chain, "chevRight", 12, C.dim); step(chain, n, t, lead); });
  const tx = S.col(b, { gap: 8, pad: [0, 0, 0, 22] });
  help(tx, "Chaque agent reçoit, dans cet ordre : les guidelines du workspace, celles du projet du ticket, celles du domaine du ticket, puis la spec de son profil (page Agents) et ses skills.", C.mfg);
  const l = S.row(tx, { gap: 16 }); link(l, "Ouvrir la page Agents →", { size: 12 }); link(l, "Skills →", { size: 12 }); S.spacer(l);
  S.txt(l, "Le panneau Injection, en bas, montre la chaîne du dossier choisi.", { size: 12, color: C.dim }); return b; };

// ---------- Arbre des dossiers ----------
const node = (p, o) => { const r = S.box(p, { name: "TreeItem-" + o.label, fill: o.sel ? C.accent : null, radius: 6, dir: "row", gap: 6, pad: [5, 8, 5, 8 + (o.lvl || 0) * 16], vs: "auto", align: "center" }); S.fillX(r);
  if (o.chev === undefined) S.box(r, { name: "slot", w: 18, h: 18 });
  else { const cb = S.box(r, { name: "ChevronButton", fill: o.sel ? C.muted : null, radius: 4, w: 18, h: 18, dir: "row", align: "center", justify: "center" }); S.icon(cb, o.chev ? "chevDown" : "chevRight", 12, C.dim); }
  if (o.icon) S.icon(r, o.icon, 14, o.sel ? C.fg : C.mfg); if (o.dot) S.dot(r, o.dot, 8); if (o.sq) { const w = S.box(r, { name: "slot", w: 14, h: 14, dir: "row", align: "center", justify: "center" }); sq(w, o.sq); }
  S.fillX(S.txt(r, o.label, { size: o.file ? 12 : 13, mono: !!o.file, weight: o.sel || o.strong ? 500 : 400, color: o.muted ? C.mfg : C.fg }));
  if (o.count != null) S.txt(r, o.count + " .md", { size: 11, mono: true, color: C.dim }); return r; };
const files = (p, list, lvl, sel) => list.forEach(n => node(p, { lvl, icon: "fileText", label: n, file: true, sel: sel === n }));
const domains = (p, title, list, sel) => { node(p, { lvl: 1, chev: list.length ? true : undefined, icon: list.length ? "folderOpen" : "folder", label: title, muted: !list.length });
  list.forEach(([d, n]) => node(p, { lvl: 2, sq: COLORS[d], label: d, count: n, sel: sel === d })); node(p, { lvl: 2, icon: "plus", label: "Nouveau domaine", muted: true }); };
const tree = (p, o) => { const t = S.panel(p, { name: "Dossiers", w: 290, gap: 1, pad: 8 }); const lb = S.row(t, { gap: 0, pad: [4, 8, 6, 8] }); S.label(lb, "Dossiers");
  node(t, { chev: true, icon: "grid", label: "Workspace", strong: true, count: 2, sel: o.sel === "Workspace" }); files(t, WS_FILES, 1, o.file);
  domains(t, "Domaines du workspace", WS_DOMAINS, o.sel);
  PROJECTS.forEach(pr => { const open = o.open.includes(pr.name); node(t, { chev: open, dot: COLORS[pr.name], label: pr.name, strong: true, count: pr.count, sel: o.sel === pr.name });
    if (!open) return; if (pr.files.length) files(t, pr.files, 1, o.sel === pr.name ? o.file : null); else node(t, { lvl: 1, label: "Aucun fichier", muted: true });
    if (pr.locked && !pr.domains.length) return; domains(t, "Domaines", pr.domains, o.sel); }); return t; };

// ---------- Panneau du nœud : en-tête, fichiers, éditeur, Injection ----------
const chipFile = (p, n, on) => { const b = S.box(p, { name: "File-" + n, fill: on ? C.accent : null, stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [4, 8], hs: "auto", vs: "auto", align: "center" });
  S.icon(b, "fileText", 12, on ? C.fg : C.mfg); const t = S.txt(b, n, { size: 12, mono: true, weight: on ? 500 : 400, color: on ? C.fg : C.mfg }); if (on) t.textDecoration = "underline"; return b; };
const injection = (p, chain, tokens) => { const r = S.row(p, { name: "Injection", gap: 6, pad: [10, 16] }); S.txt(r, "Injection :", { size: 12, color: C.mfg });
  chain.forEach((c, i) => { if (i) S.icon(r, "chevRight", 12, C.dim); const last = i === chain.length - 1;
    const b = S.box(r, { name: "Level-" + c, stroke: last ? C.mfg : C.border, radius: 4, dir: "row", gap: 5, pad: [2, 7], hs: "auto", vs: "auto", align: "center" });
    S.txt(b, c, { size: 11, weight: last ? 600 : 400, color: last ? C.fg : C.mfg }); });
  S.spacer(r); S.txt(r, "≈ " + tokens + " tokens injectés", { size: 11, mono: true, color: C.dim }); return r; };
const nodePanel = (p, o) => { const pn = S.panel(p, { name: "Node", gap: 0, pad: 0 });
  const h = S.row(pn, { name: "NodeHeader", gap: 10, pad: [14, 16] }); o.head(h); S.spacer(h); if (o.trash) iconButton(h, "trash"); if (o.lines) segmented(h, ["Éditer", "Aperçu"], "Éditer"); hline(pn);
  const body = S.col(pn, { name: "NodeBody", gap: 14, pad: 16 });
  if (o.empty) o.empty(body);
  else { const fl = S.row(body, { gap: 8 }); fl.flex.wrap = "wrap"; o.files.forEach((n, i) => chipFile(fl, n, i === 0)); if (!o.locked) iconButton(fl, "plus", { outline: true });
    const ed = S.box(body, { name: "Editor", fill: C.bg, stroke: C.border, radius: 8, dir: "column", gap: 4, pad: [12, 14], h: o.edH || 300 }); S.fillX(ed);
    o.lines.forEach(l => S.fillX(S.txt(ed, l || " ", { size: 12, mono: true, color: /^#/.test(l) ? C.fg : C.mfg, weight: /^#/.test(l) ? 600 : 400, lh: 1.5 })));
    const a = S.row(body, { gap: 12 }); if (!o.locked) { S.button(a, "Enregistrer", "default", { sm: true, disabled: true }); S.txt(a, "Supprimer le fichier", { size: 12, weight: 500, color: C.red }); }
    if (o.note) { S.spacer(a); S.txt(a, o.note, { size: 12, color: C.dim }); } }
  hline(pn); injection(pn, o.chain, o.tokens); return pn; };
const readOnlyBadge = (p) => { const b = S.box(p, { name: "ReadOnly", stroke: C.border, radius: 4, dir: "row", pad: [0, 4], hs: "auto", vs: "auto" }); S.txt(b, "Lecture seule", { size: 10, color: C.mfg }); return b; };
const projectHead = (name, path, counts, o = {}) => (h) => { S.dot(h, COLORS[name], 10); const tv = S.col(h, { gap: 2, hs: "auto" }); S.txt(tv, "Projet · " + name, { size: 15, weight: 600 });
  const s = S.row(tv, { name: "FolderLine", gap: 6, hs: "auto" }); S.txt(s, path, { size: 12, color: C.dim });
  S.txt(s, "· " + counts, { size: 12, color: C.dim }); if (o.locked) readOnlyBadge(s); };
const domainHead = (name, scope, used) => (h) => { S.box(h, { name: "ColorSwatch", fill: COLORS[name], radius: 4, w: 18, h: 18 });
  const tv = S.col(h, { gap: 2, hs: "auto" }); const t = S.row(tv, { gap: 8, hs: "auto" }); S.txt(t, "Domaine · " + name, { size: 15, weight: 600 }); S.icon(t, "pencil", 13, C.mfg);
  const s = S.row(tv, { gap: 6, hs: "auto" }); const b = S.badge(s, scope, C.fg, { round: true, dot: scope === "domaine du workspace" ? null : COLORS.Kibo });
  if (scope === "domaine du workspace") { b.children.forEach(k => k.remove()); S.icon(b, "grid", 10, C.mfg); S.txt(b, scope, { size: 10, weight: 500, color: C.fg }); }
  S.txt(s, "· " + used, { size: 12, color: C.dim }); };

const layout = (c, open) => { c.flex.rowGap = 16; const hd = S.col(c, { gap: 4 }); S.txt(hd, "Domaines & guidelines", { size: 20, weight: 600 });
  S.sub(hd, "Les guidelines sont des .md injectés aux agents. Un dossier par projet ; un domaine appartient à un projet ou au workspace.", { size: 13 });
  howAgents(c, open); return S.row(c, { name: "Explorer", gap: 16, align: "start" }); };

// ---------- 207 · Page, dossier « Projet · Kibo » ----------
S.draw[207] = async () => { const { frame: f, body } = await page("207 · Domaines & guidelines : dossier du projet Kibo", 0, 0, { h: 1100 });
  const row = layout(body, true); tree(row, { sel: "Kibo", open: ["Kibo"] });
  nodePanel(row, { head: projectHead("Kibo", "~/code/galadrim/kibo-monorepo…", "3 fichiers · 4 domaines"), files: PROJECTS[0].files, lines: KIBO_MD, edH: 330,
    chain: ["Workspace", "Projet Kibo"], tokens: "610" }); return f.id; };

// ---------- 207b · Dossier « Facturation » vide ----------
const emptyBlock = (p, icon, t, sub, btn, variant) => { const e = S.box(p, { name: "Empty-" + t, stroke: C.border, dashed: true, radius: 8, dir: "column", gap: 8, pad: [24, 16], vs: "auto", align: "center" }); S.fillX(e);
  const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 36, h: 36, dir: "row", align: "center", justify: "center" }); S.icon(ic, icon, 16, C.mfg);
  S.txt(e, t, { size: 13, weight: 500 }); if (sub) S.txt(e, sub, { size: 12, color: C.mfg }); S.box(e, { name: "gap", w: 1, h: 2 }); S.button(e, btn, variant, { sm: true, icon: "plus" }); return e; };
S.draw["207b"] = async () => { const { frame: f, body } = await page("207b · Dossier Facturation : aucune guideline", 2, 0, { h: 1100 });
  const row = layout(body, true); tree(row, { sel: "Facturation", open: ["Kibo", "Facturation"] });
  nodePanel(row, { head: projectHead("Facturation", "~/code/galadrim/api-facturat…", "0 fichier · 0 domaine"), chain: ["Workspace", "Projet Facturation"], tokens: "180",
    empty: (b) => { emptyBlock(b, "fileText", "Aucune guideline pour ce projet.", "Un fichier ajouté ici est injecté aux agents de tous les tickets de Facturation.", "Ajouter un fichier", "default");
      emptyBlock(b, "folder", "Aucun domaine. Un domaine range des guidelines par catégorie de ticket.", null, "Nouveau domaine", "outline"); } }); return f.id; };

// ---------- 208 · Domaine « Sync » de Kibo ----------
S.draw[208] = async () => { const { frame: f, body } = await page("208 · Domaine Sync de Kibo", 4, 0, { h: 1100 });
  const row = layout(body, true); tree(row, { sel: "Sync", open: ["Kibo"] });
  nodePanel(row, { head: domainHead("Sync", "domaine de Kibo", "utilisé par 8 tickets"), trash: true, files: ["guidelines/sync.md"], lines: SYNC_MD, edH: 330,
    chain: ["Workspace", "Projet Kibo", "Domaine Sync"], tokens: "790" }); return f.id; };

// ---------- 208b · Encart replié, domaine du workspace « Sécurité » ----------
S.draw["208b"] = async () => { const { frame: f, body } = await page("208b · Domaine du workspace Sécurité, encart replié", 6, 0);
  const row = layout(body, false); tree(row, { sel: "Sécurité", open: ["Kibo"] });
  nodePanel(row, { head: domainHead("Sécurité", "domaine du workspace", "utilisé par 6 tickets dans 2 projets"), trash: true, files: ["guidelines/securite.md"], lines: SECU_MD, edH: 420,
    note: "S'applique à tout projet local.", chain: ["Workspace", "Domaine Sécurité"], tokens: "260" }); return f.id; };

// ---------- 208c · Projet partagé « Portail » en lecture seule ----------
S.draw["208c"] = async () => { const { frame: f, body } = await page("208c · Projet partagé Portail : lecture seule", 4, 1, { h: 1100 });
  const row = layout(body, false); tree(row, { sel: "Portail", open: ["Kibo", "Portail"] });
  nodePanel(row, { head: projectHead("Portail", "~/code/equipe/portail-client", "1 fichier · 0 domaine", { locked: true }), locked: true, files: PROJECTS[1].files, lines: PORTAIL_MD, edH: 380,
    chain: ["Workspace", "Projet Portail"], tokens: "240" }); return f.id; };

// ---------- 209 · Fiche KIB-14, sélecteur de domaine groupé ----------
const prop = (p, k, fn) => { const r = S.row(p, { gap: 8 }); const kk = S.box(r, { name: "k", w: 100, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
const groupedList = (f, x, y, w = 240) => { const m = S.box(f, { name: "SelectContent", fill: C.card, stroke: C.border, radius: 8, w, dir: "column", gap: 2, pad: 4, vs: "auto" }); shadow(m); abs(f, m, x, y);
  const opt = (t, on, color) => { const r = S.box(m, { name: "SelectItem", fill: on ? C.accent : null, radius: 4, dir: "row", gap: 8, pad: [6, 8], vs: "auto", align: "center" }); S.fillX(r);
    const s = S.box(r, { name: "slot", w: 14, h: 14, dir: "row", align: "center", justify: "center" }); if (color) sq(s, color);
    S.fillX(S.txt(r, t, { size: 13, color: color ? C.fg : C.mfg })); if (on) S.icon(r, "check", 14, C.fg); };
  const group = (t) => { const l = S.box(m, { name: "SelectLabel", dir: "row", pad: [6, 8, 4, 8], vs: "auto" }); S.fillX(l); S.txt(l, t, { size: 11, weight: 600, color: C.dim }); };
  const sep = () => S.fillX(S.box(m, { name: "Separator", fill: C.border, h: 1, w: 10 }));
  opt("Aucun", false); sep(); group("Domaines de Kibo"); ["Sync", "UI", "CI", "Démon"].forEach(d => opt(d, d === "Démon", COLORS[d]));
  sep(); group("Domaines du workspace"); opt("Sécurité", false, COLORS["Sécurité"]); return m; };
S.draw[209] = async () => { const r = await appScreen(PAGE, "209 · Fiche KIB-14 : domaines groupés", 0, ROW, "Tickets", ["Kibo", "KIB-14"], ["ticket", "Kibo · KIB-14"]);
  const { frame: f, content: c } = r; f.resize(1440, 1040); projectsShell(f);
  const s = S.col(c, { name: "TicketPage", gap: 16, w: 720 }); const th = S.row(s, { gap: 6 }); S.fillX(S.txt(th, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(th, "more");
  S.fillX(S.txt(s, "Récepteur de hooks Claude Code", { size: 20, weight: 600 }));
  const ac = S.row(s, { gap: 8 }); S.button(ac, "Assigner à un agent", "outline", { sm: true, icon: "bot" });
  const props = S.col(s, { gap: 10 });
  prop(props, "Statut", x => select(x, "En cours", { lead: k => S.statusDot(k, "En cours", 8) }));
  let dom; prop(props, "Domaine", x => { dom = select(x, "Démon", { open: true, w: 240, lead: k => sq(k, COLORS["Démon"], 7) }); });
  prop(props, "Assigné", x => select(x, "opus-dev-2", { disabled: true, lead: k => S.icon(k, "bot", 12, C.mfg) }));
  prop(props, "Branche", x => { S.icon(x, "git", 13, C.mfg); S.txt(x, "kib-14", { size: 12, mono: true }); });
  const de = S.col(s, { gap: 8 }); S.txt(de, "Description", { size: 13, weight: 600 });
  S.sub(de, "Recevoir les hooks de Claude Code sur le démon (127.0.0.1) et mettre à jour l'état du run sans token.", { size: 13 });
  await wait(3000); const p = rel(f, dom); groupedList(f, p.x, p.y + p.h + 4, 240); S.frontAbs(f); return f.id; };

// ---------- 209b · Modifier le projet, section Guidelines ----------
S.draw["209b"] = async () => { const r = await appScreen(PAGE, "209b · Modifier le projet : guidelines", 2, ROW, "Kanban", ["Kibo", "Kanban"], ["kanban", "Kibo · Kanban"], { kanban: true });
  const { frame: f } = r; f.resize(1440, 1040); projectsShell(f);
  const d = formDialog(f, "Modifier le projet", 560); d.flex.rowGap = 14;
  labeled(d, "Nom", x => input(x, "Kibo")); labeled(d, "Dossier", x => input(x, "~/code/kibo", { mono: true, size: 12 }));
  hline(d); S.txt(d, "Storybook", { size: 13, weight: 600 }); labeled(d, "Adresse", x => input(x, "http://localhost:6006", { mono: true, size: 12 }));
  labeled(d, "Variable du port dans .env des worktrees", x => input(x, "STORYBOOK_PORT", { mono: true, size: 12 })); hline(d);
  const s = S.col(d, { name: "Section-guidelines", gap: 10 }); const sh = S.row(s, { gap: 8 }); S.icon(sh, "fileText", 15, C.mfg); S.fillX(S.txt(sh, "Guidelines", { size: 14, weight: 600 }));
  help(s, "Les .md que reçoivent les agents des tickets de Kibo, après ceux du workspace.");
  const g = S.panel(s, { name: "GuidelinesField", dir: "row", gap: 10, pad: [10, 12], radius: 8, align: "center" }); S.icon(g, "folder", 14, C.mfg);
  S.txt(g, "7 fichiers .md · 4 domaines", { size: 13 }); link(g, "Ouvrir le dossier de guidelines →", { size: 12 }); hline(d);
  const dd = S.col(d, { name: "Section-doublons", gap: 10 }); const dh = S.row(dd, { gap: 8 }); S.icon(dh, "copy", 15, C.mfg); S.fillX(S.txt(dh, "Doublons entre agents", { size: 14, weight: 600 }));
  help(dd, "Kibo compare le travail des runs actifs du projet à chaque écriture et toutes les 5 minutes, sans token.");
  const t = S.row(dd, { gap: 10 }); S.toggle(t, true); S.txt(t, "Détecter les doublons entre agents", { size: 13 });
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

const fixBoutique = (f) => { const sb = find(f, "Sidebar"), b = item(f, "Boutique"), fac = item(f, "API Facturation"); if (!sb || !b || !fac) return 0;
  if (sb.children.findIndex(c => c.id === b.id) === sb.children.findIndex(c => c.id === fac.id) + 1) return 0; sb.insertChild(sb.children.findIndex(c => c.id === fac.id) + 1, b); return 1; };
const fixTabClose = (f) => { const tb = find(f, "TabBar"); if (!tb) return 0; let n = 0; const color = /\(clair\)$/.test(f.name) ? "#71717A" : "#A1A1AA";
  for (const t of tb.children) { if (!t.children) continue; const x = t.children.find(c => c.name.replace(/ /g, "") === "icon/x");
    if (x && x.x < Math.max(...t.children.map(c => c.x))) { x.remove(); S.icon(t, "x", 12, color); n++; } } return n; };
S.fixGuidelinesNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^20[789]/.test(c.name)).reduce((n, f) => n + fixBoutique(f) + fixTabClose(f), 0);
S.GUIDELINES = [207, "207b", 208, "208b", "208c", 209, "209b"];
return "guidelines ok";
