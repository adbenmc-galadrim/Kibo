// Page « 10 · Intégrations » (suite) : écrans 57b à 57n (phase 5, plan kibo-integrations P6 à P11), d'après les écrans livrés.
// Pas de base collée : shell reconstruit (S.screenX), Kanban de référence (S.fillKanban). Données : design/donnees-fictives.md.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "10 · Intégrations";
const ROW0 = 8;
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const wait = ms => new Promise(r => setTimeout(r, ms));

Object.assign(S.ICONS, {
  circleDot: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  unlink: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/>',
  listTodo: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  hardDrive: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
});

// ---------- Écrans de base ----------
const kanbanScreen = async (name, row) => { await S.page(PAGE);
  const r = S.screenX(name, 0, ROW0 + row, "Kanban", ["Kibo", "Kanban"], ["kanban", "Kibo · Kanban"]); S.fillKanban(r.content); return r; };
const line = (p) => S.fillX(S.box(p, { name: "sep", fill: C.border, h: 1, w: 10 }));
const select = (p, v, o = {}) => { const s = S.box(p, { name: "Select", fill: C.bg, stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [8, 10], vs: "auto", align: "center", w: o.w });
  if (!o.w) S.fillX(s); S.fillX(S.txt(s, v, { size: 13, mono: !!o.mono, color: o.dim ? C.mfg : C.fg })); S.icon(s, "chevDown", 14, C.dim); return s; };
const input = (p, v, o = {}) => { const i = S.box(p, { name: "Input", fill: C.bg, stroke: o.error ? C.red : (o.focus ? C.mfg : C.border), radius: 6, dir: "row", gap: 8, pad: [8, 10], vs: "auto", align: "center", w: o.w });
  if (!o.w) S.fillX(i); if (o.icon) S.icon(i, o.icon, 14, C.dim); S.fillX(S.txt(i, v, { size: 13, mono: !!o.mono, color: o.placeholder ? C.dim : C.fg })); return i; };
const title = (p, t) => S.txt(p, t, { size: 13, weight: 600 });
const trust = (p, t) => { const r = S.row(p, { gap: 6 }); S.icon(r, "check", 13, C.green); S.txt(r, t, { size: 11, color: C.mfg }); return r; };

// ---------- Dialogue « Ajouter un composant » (écran 3) ----------
const CATALOG = [["kanban", "Kanban", "Tickets par statut, glisser-déposer"], ["list", "Tickets", "Arbre des tickets, sous-tickets illimités"],
  ["graph", "Graphe de dépendances", "Généré depuis les liens bloque / bloqué par"], ["note", "Notes", "Markdown local, compatible Obsidian"],
  ["plug", "Source MCP", "Éléments d'un serveur MCP, un ticket par élément"]];
const addDialog = (f, selected, fillRight, footer) => {
  S.overlay(f); const d = S.dialog(f, 920, "Ajouter un composant"); d.flex.rowGap = 16;
  const body = S.row(d, { gap: 16, align: "start" });
  const left = S.col(body, { w: 360, gap: 6 }); input(left, "Rechercher un composant…", { icon: "search", placeholder: true });
  S.box(left, { name: "gap", h: 4, w: 1 }); S.label(left, "Intégrés");
  CATALOG.forEach(([ic, t, h]) => { const on = t === selected; const it = S.row(left, { gap: 10, pad: [8, 8], fill: on ? C.accent : null, radius: 8 });
    const ib = S.box(it, { name: "ic", fill: on ? C.bg : null, stroke: C.border, radius: 6, w: 30, h: 30, dir: "row", align: "center", justify: "center" }); S.icon(ib, ic, 15, C.fg);
    const tv = S.col(it, { gap: 1 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, h, { size: 11, color: C.mfg }); S.badge(it, "1.0.0", C.mfg, { mono: true }); });
  const cr = S.row(left, { gap: 8, pad: [10, 12], stroke: C.border, radius: 8 }); cr.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, strokeStyle: "dashed" }];
  S.icon(cr, "sparkles", 14, C.fg); S.txt(cr, "Créer un composant (code ou IA)", { size: 13, weight: 500 });
  const right = S.panel(body, { gap: 14, pad: 16 }); fillRight(right);
  const ft = S.row(d, { gap: 8, justify: "end" }); footer(ft); S.frontAbs(f); return d; };
const sourceCards = (p, synced, disabled) => { S.txt(p, "Source", { size: 13, weight: 600 }); const r = S.row(p, { gap: 10, align: "start" });
  [["hardDrive", "Locale", "Tickets du projet, dans Kibo uniquement.", !synced], ["listTodo", "Synchronisée · GitHub Issues", "Aller-retour avec les issues d'un dépôt.", synced]].forEach(([ic, t, h, on], i) => {
    const c = S.box(r, { name: "ChoiceCard", fill: on ? C.muted : null, stroke: on ? C.mfg : C.border, radius: 8, dir: "row", gap: 10, pad: 12, vs: "auto", align: "start" }); S.fillX(c);
    if (disabled && i === 1) c.opacity = 0.5; S.icon(c, ic, 16, C.fg); const tv = S.col(c, { gap: 3 }); S.fillX(S.txt(tv, t, { size: 13, weight: 500, lh: 1.3 })); S.sub(tv, h, { size: 11 }); S.radio(c, on); });
  return r; };
const kanbanPreview = (p) => { const pv = S.box(p, { name: "Preview", fill: C.muted, radius: 8, dir: "row", gap: 8, pad: 10, h: 112 }); S.fillX(pv);
  [[C.mfg, 2], [C.blue, 3], [C.purple, 1], [C.green, 2]].forEach(([col, n]) => { const c = S.box(pv, { name: "col", fill: C.bg, radius: 6, dir: "column", gap: 6, pad: 8 }); S.child(c, { h: "fill", v: "fill" });
    S.dot(c, col, 6); for (let i = 0; i < n; i++) S.fillX(S.box(c, { name: "card", fill: C.accent, radius: 4, h: 14, w: 10 })); }); return pv; };
const STATUS_MAP = [["Backlog", "Backlog"], ["À faire", "À faire"], ["En cours", "En cours"], ["En review", "En review"], ["Bloqué", "Non envoyé"], ["Terminé", "Terminé"]];
const mapping = (p, rows) => { rows.forEach(([st, opt]) => { const r = S.row(p, { gap: 8 }); S.statusDot(r, st, 8); S.fillX(S.txt(r, st, { size: 13 })); select(r, opt, { w: 200, dim: opt === "Non envoyé" }); }); };
const labelsAndClosed = (p) => { S.field(p, "Filtrer par libellés", "ui, core"); S.sub(p, "Séparés par des virgules ; vide = toutes les issues.", { size: 11 });
  S.check(p, false, "Importer aussi les issues fermées"); trust(p, "Intégré · confiance totale · lit : ticket, status, run · écrit : ticket"); };
const syncForm = (p) => { sourceCards(p, true);
  const dep = S.col(p, { gap: 6 }); title(dep, "Dépôt"); input(dep, "Filtrer les dépôts…", { placeholder: true });
  const list = S.panel(dep, { pad: 4, gap: 2, radius: 8 }); [["adam/kibo", true], ["adam/portfolio", false], ["adam/api-facturation", false]].forEach(([n, on]) => {
    const r = S.row(list, { gap: 8, pad: [7, 8], fill: on ? C.accent : null, radius: 6 }); S.radio(r, on); S.txt(r, n, { size: 13, mono: true }); });
  const pj = S.col(p, { gap: 6 }); title(pj, "Project (facultatif)"); select(pj, "Roadmap Kibo");
  const mp = S.col(p, { gap: 8 }); title(mp, "Correspondance des statuts"); S.sub(mp, "Pré-remplie par libellés identiques. Un statut sans correspondance n'est pas envoyé.", { size: 11 }); mapping(mp, STATUS_MAP); };
const syncFooter = (o = {}) => ft => { if (o.progress) { S.spinner(ft, C.mfg, 14); S.txt(ft, o.progress, { size: 12, color: C.mfg }); }
  if (o.error) { S.icon(ft, "circleX", 14, C.red); S.fillX(S.txt(ft, o.error, { size: 12, color: C.red, lh: 1.4 })); } else S.spacer(ft);
  S.button(ft, "Annuler", "outline"); const b = S.button(ft, o.label || "Ajouter et synchroniser", "default", { disabled: !!o.progress }); return b; };

S.draw["57b"] = async () => { const { frame: f } = await kanbanScreen("57b · Source : GitHub non connecté", 0);
  addDialog(f, "Kanban", p => { kanbanPreview(p); const h = S.col(p, { gap: 4 }); S.txt(h, "Kanban", { size: 15, weight: 600 }); S.sub(h, "Tickets par statut, glisser-déposer");
    const a = S.col(p, { gap: 6 }); title(a, "Affichage"); const seg = S.row(a, { gap: 0, pad: 3, fill: C.muted, radius: 8 }); const on = S.box(seg, { name: "seg", fill: C.bg, radius: 6, dir: "row", pad: [6, 10], vs: "auto", justify: "center" }); S.fillX(on); S.txt(on, "Vue plein écran", { size: 12, weight: 500 });
    sourceCards(p, false, true); S.sub(p, "Connecte GitHub dans Paramètres › Intégrations pour synchroniser.");
    const l = S.row(p, { gap: 6 }); S.txt(l, "Ouvrir les intégrations", { size: 13, weight: 500 }); S.icon(l, "chevRight", 14, C.fg);
    trust(p, "Intégré · confiance totale · lit : ticket, status, run · écrit : ticket"); },
    ft => { S.button(ft, "Annuler", "outline"); S.button(ft, "Ajouter à la page", "default"); });
  return f.id; };

S.draw["57c"] = async () => { const { frame: f } = await kanbanScreen("57c · Source synchronisée (formulaire)", 1);
  addDialog(f, "Kanban", syncForm, syncFooter()); return f.id; };

const syncBottom = (p) => { sourceCards(p, true); const mp = S.col(p, { gap: 8 }); title(mp, "Correspondance des statuts"); mapping(mp, STATUS_MAP.slice(2)); labelsAndClosed(p); };
S.draw["57d"] = async () => { const { frame: f } = await kanbanScreen("57d · Source synchronisée (progression)", 2);
  addDialog(f, "Kanban", syncBottom, syncFooter({ progress: "Synchronisation… 12 issues importées" })); return f.id; };

S.draw["57e"] = async () => { const { frame: f } = await kanbanScreen("57e · Source synchronisée (échec de la première sync)", 3);
  addDialog(f, "Kanban", syncBottom, syncFooter({ error: "La première synchronisation a échoué : GitHub a répondu 404, dépôt adam/kibo introuvable pour ce compte.", label: "Ajouter et synchroniser" })); return f.id; };

// ---------- Sheet ticket (écran 4) : GitHub, CI, Maquettes ----------
const chip = (p, ic, label, o = {}) => { const b = S.box(p, { name: "Chip", stroke: o.stroke || C.border, radius: 999, dir: "row", gap: 4, pad: [2, 8], hs: "auto", vs: "auto", align: "center" });
  if (ic) S.icon(b, ic, 12, o.color || C.mfg); S.txt(b, label, { size: 12, weight: 500, color: o.color || C.fg }); if (o.ci) S.dot(b, o.ci, 6); return b; };
const sheetBox = (f, w, o = {}) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w, h: 900, dir: "column", gap: o.gap ?? 16, pad: [20, 24] });
  sh.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 0, blur: 32, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; sh.layoutChild.absolute = true; penpotUtils.setParentXY(sh, 1440 - w, 40); sh.clipContent = true; return sh; };
const prop = (p, k, fn) => { const r = S.row(p, { gap: 8 }); const kk = S.box(r, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
const thumb = (p, name, o = {}) => { const c = S.col(p, { gap: 6, w: 208 });
  const t = S.box(c, { name: "Thumb", fill: C.muted, stroke: C.border, radius: 8, w: 208, h: 130, dir: "column", gap: 5, pad: 10 });
  if (o.badge) { const b = S.badge(t, o.badge, C.fg, { fill: C.bg, round: true }); b.name = "Badge"; }
  else { [[70, C.mfg], [140, C.accent], [120, C.accent], [150, C.accent], [90, C.accent]].forEach(([w, col]) => S.box(t, { name: "bar", fill: col, radius: 2, w, h: 6 }));
    const g = S.box(t, { name: "bar", fill: C.green, radius: 2, w: 110, h: 4 }); S.box(t, { name: "bar", fill: C.accent, radius: 2, w: 160, h: 18 }); }
  const r = S.row(c, { gap: 6 }); S.fillX(S.txt(r, name, { size: 12 })); S.button(r, "Retirer", "ghost", { sm: true }); return c; };
const ticketSheet = (f, o = {}) => { const sh = sheetBox(f, 480);
  const hd = S.row(sh, { gap: 6 }); S.txt(hd, "KIB-7", { size: 12, mono: true, color: C.mfg });
  if (o.broken) chip(hd, "unlink", "Lien GitHub rompu", { color: C.amber, stroke: "#78350F" }); else chip(hd, "circleDot", "#42", { color: C.fg });
  chip(hd, "pr", "#12", { color: C.fg }); S.spacer(hd); S.icon(hd, "more", 16, C.mfg); S.icon(hd, "x", 16, C.mfg);
  S.txt(sh, "Tokens shadcn + thème sombre", { size: 20, weight: 600 });
  if (o.broken) S.txt(sh, "L'issue a été supprimée ou transférée.", { size: 12, color: C.mfg });
  const ac = S.row(sh, { gap: 8 }); const ag = S.button(ac, "Assigner à un agent", "outline", { sm: true, icon: "bot" });
  ag.children.filter(c => c.type === "text").forEach(t => t.fills = [{ fillColor: C.brand, fillOpacity: 1 }]); penpotUtils.findShapes(x => x.strokes?.length, ag.children.find(c => /^icon/.test(c.name))).forEach(x => x.strokes = x.strokes.map(s => ({ ...s, strokeColor: C.brand })));
  S.button(ac, "Ouvrir dans un onglet", "outline", { sm: true, icon: "external" });
  if (o.pending) { const r = S.row(sh, { gap: 6 }); S.icon(r, "clock", 14, C.mfg); S.txt(r, "Synchronisation en attente", { size: 12, color: C.mfg }); }
  if (o.failed) { const a = S.alert(sh, "Échec de synchronisation", "red", { icon: "circleX", desc: "GitHub a répondu 422 : libellé « design » inconnu sur adam/kibo." });
    const ar = S.row(a.children.find(c => c.name === "col"), { gap: 8 }); S.button(ar, "Réessayer", "outline", { sm: true }); S.button(ar, "Abandonner", "ghost", { sm: true }); }
  const props = S.col(sh, { gap: 10 });
  prop(props, "Statut", r => { S.statusDot(r, "En review", 8); S.txt(r, "En review", { size: 12 }); });
  prop(props, "Domaine", r => S.domainChip(r, "UI"));
  prop(props, "Assigné à", r => { S.avatar(r, "AB", 18); S.txt(r, "Adam", { size: 12 }); S.txt(r, "review : sonnet-review", { size: 11, color: C.dim }); });
  if (!o.noMockup) prop(props, "Maquette", r => { S.icon(r, "frame", 13, C.mfg); S.txt(r, "Kibo › Fondations › Tokens sombres", { size: 12 }); });
  prop(props, "Branche", r => { S.icon(r, "git", 13, C.mfg); S.txt(r, "kib-7", { size: 12, mono: true }); });
  const de = S.col(sh, { gap: 6 }); title(de, "Description"); S.sub(de, "Palette zinc et tokens shadcn, variante sombre. Contraste ≥ 4.5:1 sur les textes secondaires.", { size: 13, color: C.mfg });
  const ci = S.col(sh, { gap: 8 }); const ch = S.row(ci, { gap: 6 }); title(ch, "CI"); S.spacer(ch); S.txt(ch, "PR #12", { size: 11, mono: true, color: C.dim });
  if (o.ciEmpty) S.sub(ci, "Aucun run pour les PR de ce ticket.");
  else [[C.red, "CI", "Échec", "3 min 12 s"], [C.amber, "E2E", "En cours", ""], [C.green, "Lint", "Réussi", "45 s"]].forEach(([col, n, st, d]) => {
    const r = S.row(ci, { gap: 8 }); S.dot(r, col, 8); S.txt(r, n, { size: 12, weight: 600 }); S.txt(r, st, { size: 12, color: C.mfg }); if (d) S.txt(r, d, { size: 12, color: C.dim }); S.spacer(r); S.button(r, "Voir les logs", "ghost", { sm: true }); });
  const mq = S.col(sh, { gap: 10 }); title(mq, "Maquettes");
  if (!o.noMockup) { const g = S.row(mq, { gap: 16, align: "start" }); thumb(g, "Tokens sombres", { badge: o.figmaDown ? "Figma non joignable" : null }); thumb(g, "Tokens clairs", { badge: o.figmaDown ? "Figma non joignable" : "Aperçu indisponible" }); }
  const lk = S.row(mq, { gap: 8 }); input(lk, o.badUrl ? "https://example.com/x" : "Colle l'URL d'un nœud Figma…", { placeholder: !o.badUrl, error: !!o.badUrl }); S.button(lk, "Lier un nœud Figma", "outline", { sm: true });
  if (o.badUrl) S.txt(mq, "URL Figma invalide : il faut un lien de nœud (node-id).", { size: 12, color: C.red });
  return sh; };

S.draw["57f"] = async () => { const { frame: f } = await kanbanScreen("57f · Sheet ticket : GitHub, CI, Maquettes", 4);
  ticketSheet(f, { pending: true }); S.frontAbs(f); return f.id; };
S.draw["57g"] = async () => { const { frame: f } = await kanbanScreen("57g · Sheet ticket : échec de synchronisation", 5);
  ticketSheet(f, { failed: true, figmaDown: true, badUrl: true }); S.frontAbs(f); return f.id; };
S.draw["57h"] = async () => { const { frame: f } = await kanbanScreen("57h · Sheet ticket : lien GitHub rompu, CI vide", 6);
  ticketSheet(f, { broken: true, ciEmpty: true, noMockup: true }); S.frontAbs(f); return f.id; };

const LOG = [["10:00:01Z ##[group]Run oven-sh/setup-bun@v2"], ["10:00:04Z ##[endgroup]"], ["10:00:05Z $ bun install --frozen-lockfile"], ["10:00:21Z 612 packages installed [15.9s]"],
  ["10:00:22Z $ bun test packages/ui"], ["10:02:41Z packages/ui/src/theme.test.ts:"], ["10:02:41Z ✗ theme > contraste texte secondaire ≥ 4.5:1"], ["10:02:41Z ##[error]attendu 4.5, reçu 3.9 (theme.test.ts:31)", 1],
  ["10:02:43Z packages/ui/src/components/ui/button.test.tsx:"], ["10:02:43Z ✗ button > variante brand en clair"], ["10:02:43Z ##[error]attendu #C2410C, reçu #F97316 (button.test.tsx:22)", 1],
  ["10:02:58Z 48 pass, 2 fail"], ["10:03:02Z ##[error]Process completed with exit code 1.", 1], ["10:03:12Z Cleaning up orphan processes"]];
S.draw["57i"] = async () => { const { frame: f } = await kanbanScreen("57i · Logs CI (Sheet)", 7);
  S.overlay(f, 0.45); const sh = sheetBox(f, 680, { gap: 14 });
  const hd = S.row(sh, { gap: 8, align: "start" }); const tv = S.col(hd, { gap: 3 }); S.txt(tv, "Logs · build", { size: 15, weight: 600 }); S.txt(tv, "CI · PR #12 · KIB-7", { size: 11, mono: true, color: C.mfg }); S.icon(hd, "x", 16, C.mfg);
  const tb = S.row(sh, { gap: 12 }); input(tb, "Rechercher dans les logs", { icon: "search", placeholder: true }); S.toggle(tb, false); S.txt(tb, "Erreurs seulement", { size: 12, weight: 500 });
  S.txt(sh, "Log tronqué à 20 Mio.", { size: 12, color: C.mfg });
  const box = S.box(sh, { name: "Log", fill: "#0C0C0E", stroke: C.border, radius: 8, dir: "column", gap: 0, pad: [8, 0] }); S.child(box, { h: "fill", v: "fill" }); box.clipContent = true;
  LOG.forEach(([t, err], i) => { const r = S.row(box, { gap: 12, pad: [2, 12], fill: err ? "#2A0F0F" : null, align: "start" });
    const n = S.box(r, { name: "n", w: 24, dir: "row", vs: "auto", justify: "end" }); S.txt(n, String(i + 1), { size: 12, mono: true, color: C.dim });
    S.fillX(S.txt(r, "2026-09-26T" + t, { size: 12, mono: true, color: err ? C.red : C.fg, lh: 1.5 })); });
  S.frontAbs(f); return f.id; };

// ---------- Widget Source MCP (tableau de bord) et étape de config ----------
const ITEMS = [["TypeError: cannot read 'status' of undefined", "kibo-ui · 42 occurrences"], ["Timeout du démon sur /api/rpc", "kibo-daemon · 9 occurrences", "KIB-31"],
  ["Worker du composant arrêté (OOM)", "kibo-daemon · 3 occurrences"], ["Échec de rendu du graphe", "kibo-ui · 1 occurrence"]];
const widget = (p, t, fillBody, foot, o = {}) => { const w = S.panel(p, { name: "Widget", pad: 0, gap: 0, radius: 10 }); if (o.fillV) S.child(w, { v: "fill" });
  const h = S.row(w, { gap: 8, pad: [10, 14] }); h.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  S.icon(h, "plug", 14, C.mfg); S.fillX(S.txt(h, t, { size: 13, weight: 500 })); S.icon(h, "more", 16, C.mfg);
  const b = S.col(w, { gap: 0 }); if (o.fillV) S.child(b, { v: "fill" }); fillBody(b);
  const ft = S.row(w, { gap: 8, pad: [8, 14] }); ft.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  S.fillX(S.txt(ft, foot, { size: 12, color: C.mfg })); S.button(ft, "Rafraîchir", "ghost", { sm: true, icon: "refresh" }); return w; };
S.draw["57j"] = async () => { await S.page(PAGE);
  const r = S.screenX("57j · Widget Source MCP (états)", 0, ROW0 + 8, "Tableau de bord", ["Kibo", "Tableau de bord"], ["dashboard", "Kibo · Tableau de bord"]);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const left = S.col(c, { gap: 16 }); const right = S.col(c, { gap: 16 });
  widget(left, "Erreurs Sentry", b => ITEMS.forEach(([t, s, key]) => { const it = S.row(b, { gap: 10, pad: [10, 14] }); it.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    const tv = S.col(it, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, s, { size: 11, color: C.mfg }); S.icon(it, "external", 14, C.dim);
    if (key) S.badge(it, key, C.fg, { mono: true }); else S.button(it, "Créer un ticket", "outline", { sm: true }); }), "Mis à jour il y a 3 min");
  widget(left, "Erreurs Sentry · chargement", b => { const pb = S.col(b, { gap: 10, pad: [14, 14] }); [1, 2, 3].forEach(() => S.fillX(S.box(pb, { name: "Skeleton", fill: C.muted, radius: 6, h: 18, w: 10 }))); }, "Jamais mis à jour");
  widget(right, "Tickets Linear", b => { const e = S.col(b, { gap: 0, pad: [16, 14] }); S.txt(e, "Aucun élément.", { size: 13, color: C.mfg }); }, "Mis à jour à l'instant");
  widget(right, "Erreurs Sentry (staging)", b => { const e = S.col(b, { gap: 4, pad: [12, 14] }); const hr = S.row(e, { gap: 6 }); S.icon(hr, "circleX", 14, C.red); S.txt(hr, "Serveur MCP injoignable", { size: 13, weight: 500, color: C.red });
    S.sub(e, "sentry ne répond pas (délai de 30 s dépassé). Vérifie le serveur dans Paramètres › Intégrations."); }, "Jamais mis à jour");
  return r.frame.id; };

S.draw["57k"] = async () => { const { frame: f } = await kanbanScreen("57k · Source MCP : étape de config", 9);
  addDialog(f, "Source MCP", p => { const h = S.col(p, { gap: 4 }); S.txt(h, "Source MCP", { size: 15, weight: 600 }); S.sub(h, "Liste les éléments d'un serveur MCP, un ticket par élément sur demande.");
    const sv = S.col(p, { gap: 6 }); title(sv, "Serveur MCP"); select(sv, "Sentry (sentry)");
    const md = S.col(p, { gap: 6 }); title(md, "Mode"); const mr = S.row(md, { gap: 16 }); [["Outil", true], ["Ressource", false]].forEach(([l, on]) => { const x = S.row(mr, { gap: 6, hs: "auto" }); S.radio(x, on); S.txt(x, l, { size: 13 }); });
    const tl = S.col(p, { gap: 6 }); title(tl, "Outil"); select(tl, "list_issues", { mono: true });
    const ar = S.col(p, { gap: 6 }); title(ar, "Arguments (JSON)"); const ta = S.box(ar, { name: "Textarea", fill: C.bg, stroke: C.border, radius: 6, dir: "column", pad: [8, 10], h: 56 }); S.fillX(ta); S.fillX(S.txt(ta, '{ "project": "kibo", "query": "is:unresolved" }', { size: 13, mono: true }));
    const cm = S.col(p, { gap: 8 }); title(cm, "Correspondance des champs"); S.sub(cm, "Pointeurs JSON, par exemple /items et /name.", { size: 11 });
    [["Éléments", "/issues"], ["Identifiant", "/id"], ["Titre", "/title"], ["Sous-titre", "/culprit"], ["Lien", "/permalink"]].forEach(([k, v]) => { const r = S.row(cm, { gap: 8 }); const kk = S.box(r, { name: "k", w: 84, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12 }); input(r, v, { mono: true }); });
    const rf = S.row(p, { gap: 10 }); S.txt(rf, "Rafraîchissement (minutes, 5 minimum)", { size: 13, weight: 600 }); S.spacer(rf); input(rf, "15", { w: 80 });
    trust(p, "Intégré · confiance totale · lit et écrit : ticket"); },
    ft => { S.button(ft, "Annuler", "outline"); S.button(ft, "Ajouter à la page", "default"); });
  return f.id; };

// ---------- Kanban et Tickets synchronisés ----------
const sourceHeader = (f, o) => { const main = find(f, "Main"); const content = find(f, "Content");
  const bar = S.box(null, { name: "SourceHeader", h: 40, dir: "row", gap: 8, pad: [0, 20], align: "center" }); S.border(bar);
  main.insertChild(main.children.findIndex(c => c.id === content.id), bar); S.fillX(bar);
  S.icon(bar, o.icon, 14, o.color || C.mfg); S.txt(bar, o.title, { size: 13, weight: 600, color: o.color || C.fg }); S.txt(bar, o.sub, { size: 12, color: C.mfg }); S.spacer(bar);
  if (o.syncing) { S.spinner(bar, C.mfg, 14); S.txt(bar, "Synchronisation…", { size: 12, color: C.mfg }); }
  if (o.button) S.button(bar, "Synchroniser", "ghost", { sm: true, icon: "refresh", disabled: !!o.syncing }); return bar; };
const ciOnPr = (f, key, col) => { const card = find(f, "TicketCard / " + key); const pr = card && penpotUtils.findShape(s => s.name === "pr", card); if (pr) S.dot(pr, col, 6); return !!pr; };
const toast = (f, t) => { const b = S.box(f, { name: "Toast", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 10, pad: [12, 14], w: 420, vs: "auto", align: "center" });
  b.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; b.layoutChild.absolute = true;
  S.icon(b, "info", 16, C.mfg); S.txt(b, t, { size: 13, weight: 500 }); return b; };
S.draw["57l"] = async () => { const { frame: f } = await kanbanScreen("57l · Kanban synchronisé (GitHub)", 10);
  sourceHeader(f, { icon: "listTodo", title: "GitHub · adam/kibo", sub: "Synchronisé à 10:03", button: true });
  ciOnPr(f, "KIB-7", C.red); ciOnPr(f, "KIB-11", C.green);
  const t = toast(f, "Conflit résolu sur KIB-12 : titre repris de GitHub"); penpotUtils.setParentXY(t, 1440 - 420 - 16, 940 - 40 - 46 - 16);
  S.frontAbs(f); return f.id; };

const TREE = [[0, "KIB-3", "Noyau de données", "En cours", "—", "1/2", true], [1, "KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours", "opus-dev-1", "3/5"], [1, "KIB-13", "Snapshots Loro ↔ SQLite", "Terminé", "Adam", ""],
  [0, "KIB-6", "UI de base", "En cours", "—", "0/2", true], [1, "KIB-7", "Tokens shadcn + thème sombre", "En review", "Adam", "", false, ["#12", C.red]], [1, "KIB-15", "Kanban : drag & drop entre colonnes", "À faire", "Adam", ""],
  [0, "KIB-11", "Démon : auth par jeton local", "En review", "Adam", "", false, ["#15", C.green]], [0, "KIB-18", "Adaptateur GitHub Issues", "À faire", "opus-dev", ""],
  [0, "KIB-21", "Sandbox iframe des composants", "Bloqué", "Adam", "0/4"], [0, "KIB-22", "Export Markdown / Obsidian", "Backlog", "Adam", ""]];
S.draw["57m"] = async () => { await S.page(PAGE);
  const r = S.screenX("57m · Tickets synchronisés (sync en cours)", 0, ROW0 + 11, "Tickets", ["Kibo", "Tickets"], ["list", "Kibo · Tickets"]); const f = r.frame;
  sourceHeader(f, { icon: "listTodo", title: "GitHub · adam/kibo", sub: "Synchronisé à 10:03", button: true, syncing: true });
  const c = r.content; const tb = S.row(c, { gap: 8 }); S.txt(tb, "Tickets", { size: 15, weight: 600 }); S.txt(tb, "10 / 24", { size: 12, mono: true, color: C.dim }); S.spacer(tb); S.button(tb, "Nouveau ticket", "outline", { sm: true, icon: "plus" });
  S.table(c, [["Ticket"], ["Statut", 140], ["Assigné", 150], ["Sous-tickets", 100]], TREE.map(([lvl, k, t, st, who, sub, open, pr]) => [
    cell => { if (lvl) S.box(cell, { name: "indent", w: 20 * lvl, h: 1 }); if (open) S.icon(cell, "chevDown", 14, C.dim); else S.box(cell, { name: "indent", w: 14, h: 1 });
      S.txt(cell, k, { size: 12, mono: true, color: C.dim }); S.txt(cell, t, { size: 13 }); if (pr) chip(cell, "pr", pr[0], { ci: pr[1] }); },
    cell => { S.statusDot(cell, st, 8); S.txt(cell, st, { size: 12 }); }, who, cell => S.txt(cell, sub || " ", { size: 12, mono: true, color: C.mfg })]));
  return f.id; };

S.draw["57n"] = async () => { const { frame: f } = await kanbanScreen("57n · Kanban : liaison supprimée", 12);
  sourceHeader(f, { icon: "unlink", title: "Liaison supprimée", sub: "Ce composant n'est plus synchronisé avec GitHub ; ses tickets restent dans le projet." });
  return f.id; };

S.SUITE = ["57b", "57c", "57d", "57e", "57f", "57g", "57h", "57i", "57j", "57k", "57l", "57m", "57n"];
return "integrations suite ok";
