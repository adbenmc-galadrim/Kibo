// Page « 32 · Doublons entre agents » : écrans 197 à 201b (phase 23, spec §29.10 et §29.14). Requiert 18-socle.js, 24-socle-suite.js, 32b, 32d, 33 et 35.
// D'après la page 30 (fil du run) et la page 31 (fiche d'agent, « Ce que reçoit l'agent »), ajusté sur screens/2026-10-12-p23-t11 (implémentation) ; données : design/donnees-fictives.md, section « Doublons entre agents (phase 23) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "32 · Doublons entre agents";
const { find, wait, shadow, abs, rel, hline, input, select, help, labeled, formDialog, tooltip, appScreen } = S.fx;
const { iconButton } = S.fx2;
const { RUNCOL, mention, planBlock, notice, label } = S.vis;

// ---------- Données (donnees-fictives.md, « Doublons entre agents (phase 23) ») ----------
const R12 = "bou · livraison · BOU-12", R15 = "bou · livraison · BOU-15";
const T12 = "Format des dates de livraison", T15 = "Page de suivi de commande";
const PLAN15 = [["done", "Relire la page de suivi et l'API commandes", "2 moments"], ["done", "Afficher la date de livraison estimée", "3 moments"],
  ["doing", "Reprendre formatDate de BOU-12", "recouvrement"], ["todo", "Tests de la page de suivi"]];
const PLAN12 = [["done", "Lire les formats de date existants", "1 moment"], ["done", "Écrire formatDate et formatDeliveryWindow", "2 moments"],
  ["doing", "Brancher le format sur le récapitulatif", "1 moment"], ["todo", "Tests des formats"]];
const FILES12 = [["src/lib/format-date.ts", "ajouté", "+24 −0"], ["src/lib/format.ts", "modifié", "+3 −1"], ["src/i18n/fr.ts", "modifié", "+6 −2"]];
const EXPORTS12 = [["formatDate", "src/lib/format-date.ts"], ["formatDeliveryWindow", "src/lib/format-date.ts"]];
const HISTORY = [[R15, "En cours", "blue", "12 oct., 14:40", true], [R12, "En cours", "blue", "12 oct., 14:28"], ["bou · review-pr · BOU-9", "Fait", "green", "12 oct., 11:02"]];

Object.assign(S.ICONS, {
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  bookSearch: '<path d="M11 22H5.5a1 1 0 0 1 0-5h4.501"/><path d="m21 22-1.879-1.878"/><path d="M3 19.5v-15A2.5 2.5 0 0 1 5.5 2H18a1 1 0 0 1 1 1v8"/><circle cx="17" cy="18" r="3"/>',
});

// ---------- Projet Boutique dans la coque ----------
const toBoutique = (f) => { ["Sidebar", "TabBar", "Breadcrumb"].forEach(n => { const s = find(f, n); if (!s) return;
  penpotUtils.findShapes(t => t.type === "text" && /Kibo|KIB-/.test(t.characters) && !/connecté/.test(t.characters), s)
    .forEach(t => S.setText(t, t.characters.replace(/Kibo/g, "Boutique").replace(/KIB-14/g, "BOU-15").replace(/KIB-12/g, "BOU-12").replace(/KIB-(\d+)/g, "BOU-$1"))); }); };
const sidebarAgents = (f, active) => { const sb = find(f, "Sidebar"); const ag = S.fx.item(f, "Agents"); if (!sb || !ag) return;
  const q = S.navItem(null, "listOrdered", "Files d'attente", { indent: 14 }); const sk = S.navItem(null, "bookOpen", "Skills", { indent: 14 });
  [q, sk].forEach(x => { sb.insertChild(0, x); S.fillX(x); }); sb.insertChild(sb.children.findIndex(c => c.id === ag.id) + 1, q); sb.insertChild(sb.children.findIndex(c => c.id === q.id) + 1, sk);
  S.activate(f, active); S.fixIconOrder(f); };
const copyCount = (p, n) => { const r = S.row(p, { name: "OverlapCount", gap: 3, hs: "auto" }); S.icon(r, "copy", 11, C.mfg); S.txt(r, String(n), { size: 11, mono: true, color: C.mfg }); return r; };
const chip = (p, name, t, o = {}) => { const c = S.row(p, { name: "RunChip", gap: 6, hs: "auto" }); S.dot(c, C.blue, 7); mention(c, name, { size: 11 }); S.txt(c, t, { size: 11, color: C.mfg }); if (o.n) copyCount(c, o.n); return c; };
const CHIP15 = "BOU-15 · 3/4 · Reprendre formatDate", CHIP12 = "BOU-12 · 3/4 · Brancher le format";
const agentBar = (f, o = {}) => { const bar = find(f, "AgentStatusBar"); if (!bar) return; [...bar.children].forEach(k => k.remove()); bar.flex.columnGap = 10; const used = o.used || 2;
  S.icon(bar, "bot", 14, C.fg); S.txt(bar, "Agents", { size: 12, weight: 500 }); S.slotsMini(bar, used, 3); S.txt(bar, used + "/3 " + (used > 1 ? "places" : "place") + (o.open ? " · 1 recouvrement" : ""), { size: 11, color: C.mfg });
  if (used > 1) chip(bar, R15, o.t15 || CHIP15, { n: o.open ? 1 : 0 }); chip(bar, R12, o.t12 || CHIP12, { n: o.open ? 1 : 0 });
  S.spacer(bar); S.dot(bar, C.green, 6); S.txt(bar, "Kibo · connecté", { size: 11, color: C.mfg }); S.icon(bar, "chevUp", 14, C.mfg); return bar; };
const ROW = 1.4;
const screen = async (name, col, row, nav, crumbs, tab, o = {}) => { const r = await appScreen(PAGE, name, col, row * ROW, nav, crumbs, tab);
  if (o.h) r.frame.resize(1440, o.h); sidebarAgents(r.frame, nav); toBoutique(r.frame); agentBar(r.frame, o.bar || {}); return r; };

// ---------- Lignes du fil ----------
const inline = (p, parts, o = {}) => { const r = S.row(p, { gap: 0, hs: "auto" }); parts.forEach(x => typeof x === "string" ? S.txt(r, x, { size: o.size || 12, color: o.color || C.fg })
  : x.run ? mention(r, x.run, { size: (o.size || 12) - 1 }) : x.key ? (S.txt(r, x.key, { size: (o.size || 12) - 0.5, mono: true, weight: 600 }).textDecoration = "underline")
  : S.txt(r, x.m, { size: (o.size || 12) - 0.5, mono: true, weight: 500, color: C.fg })); return r; };
const stateText = (p, st) => { const r = S.row(p, { name: "OverlapState", gap: 5, hs: "auto" }); S.dot(r, st === "Ouvert" ? C.mfg : C.dim, 6); S.txt(r, st, { size: 12, weight: 500, color: st === "Ouvert" ? C.fg : C.mfg }); return r; };
const overlapLine = (p, o) => { const b = S.box(p, { name: "OverlapMoment", stroke: C.border, radius: 8, dir: "column", gap: 8, pad: [9, 12], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, "copy", 14, C.mfg); inline(h, ["Recouvrement avec ", { run: o.with }, " · ", { m: "formatDate" }, " exporté deux fois"]);
  const d = S.row(b, { gap: 6, pad: [0, 0, 0, 22] }); inline(d, [{ m: o.other ? "src/utils/date.ts" : "src/lib/format.ts" }, " (toi) · ", { m: o.other ? "src/lib/format.ts" : "src/utils/date.ts" }, o.other ? " (BOU-12)" : " (BOU-15)"], { color: C.mfg });
  if (o.time) { S.spacer(d); S.txt(d, o.time, { size: 11, mono: true, color: C.dim }); }
  const a = S.row(b, { gap: 8, pad: [0, 0, 0, 22] }); if (o.other) S.badge(a, "à factoriser", C.mfg, { round: true }); else { const t = S.badge(a, "repris par", C.mfg, { round: true }); mention(t, R15, { size: 10, weight: 500, color: C.mfg }); }
  stateText(a, o.state); S.spacer(a); S.button(a, "Voir les fichiers", "ghost", { sm: true, icon: "eye" }); if (o.state === "Ouvert") S.button(a, "Ignorer", "outline", { sm: true }); return b; };
const linkLine = (p, o = {}) => { const b = S.box(p, { name: "AutoLinkMoment", stroke: C.border, radius: 8, dir: "column", gap: 8, pad: [9, 12], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, "link", 14, C.mfg); inline(h, ["Kibo a lié ", { key: "BOU-12" }, " → ", { key: "BOU-15" }, " (BOU-12 bloque BOU-15)"]); S.spacer(h); S.txt(h, "14:52", { size: 11, mono: true, color: C.dim });
  const d = S.row(b, { gap: 8, pad: [0, 0, 0, 22] }); inline(d, [{ m: "src/lib/format-date.ts" }, " repris de BOU-12 · fusionner BOU-12 d'abord"], { color: C.mfg }); S.spacer(d);
  if (!o.cancelled) S.button(d, "Annuler", "outline", { sm: true, icon: "undo" });
  else { const n = S.row(b, { gap: 6, pad: [0, 0, 0, 22] }); S.icon(n, "undo", 12, C.mfg); S.txt(n, "Annulé par Adam 15:03", { size: 12, weight: 500, color: C.fg }); S.txt(n, "· lien retiré, Kibo ne le reposera pas", { size: 12, color: C.mfg }); } return b; };
const pill = (p, parts, o = {}) => { const b = S.box(p, { name: "ActionPill", fill: C.muted, radius: 6, dir: "column", gap: 6, pad: [7, 12], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, o.open ? "chevDown" : "chevRight", 12, C.mfg); if (o.icon) S.icon(h, o.icon, 13, C.mfg); inline(h, parts, { color: C.mfg });
  if (o.body) o.body(b); return b; };
const say = (p, time, step, text) => { const c = S.col(p, { name: "Moment", gap: 6 }); const h = S.row(c, { gap: 8 }); S.txt(h, time, { size: 12, mono: true, color: C.mfg }); S.badge(h, step, C.fg, { round: true });
  S.fillX(S.txt(c, text, { size: 13, weight: 500, lh: 1.45 })); return c; };
const peek = (p) => pill(p, ["A regardé le travail de ", { key: "BOU-12" }, " · ", { m: "peek_work" }], { icon: "bookSearch", open: true, body: b => { const x = S.col(b, { gap: 4, pad: [0, 0, 0, 20] });
  inline(x, [{ m: "src/lib/format-date.ts" }, " · ajouté · +24 −0"], { color: C.mfg }); inline(x, ["exporte ", { m: "formatDate" }, ", ", { m: "formatDeliveryWindow" }], { color: C.mfg }); } });

const FIL15 = {
  read: (p) => { say(p, "14:41", "Étape 1", "Je relis la page de suivi et l'API des commandes avant d'afficher la date de livraison."); pill(p, ["A lu 4 fichiers"]); },
  write: (p) => { say(p, "14:46", "Étape 2", "J'ajoute formatDate dans src/utils/date.ts pour afficher la date estimée."); pill(p, ["A créé 1 fichier et modifié 1 fichier"]); },
  peek: (p) => { say(p, "14:49", "Étape 3", "Kibo signale un formatDate chez BOU-12. Je regarde son travail avant de factoriser."); peek(p); },
  remind: (p) => notice(p, "14:50 · Kibo a rappelé de factoriser"),
  fix: (p) => { say(p, "14:52", "Étape 3", "Je supprime ma copie, je reprends src/lib/format-date.ts de BOU-12 à l'identique et je l'importe."); pill(p, ["A supprimé 1 fichier, créé 1 fichier et lancé les tests (9 réussis)"]); },
};

// ---------- Page du run (d'après screens/2026-10-12-p23-t11) ----------
const historyList = (p, on, done) => { const c = S.col(p, { name: "RunsHistory", gap: 2 }); label(c, "Historique des runs"); S.box(c, { name: "gap", w: 1, h: 6 });
  HISTORY.map(([n, st, col, when]) => done && n === R15 ? [n, "Fait", "green", when] : [n, st, col, when]).forEach(([n, st, col, when]) => { const sel = n === on; const it = S.box(c, { name: "RunItem", fill: sel ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [7, 8], vs: "auto" }); S.fillX(it);
    const r = S.row(it, { gap: 6 }); S.dot(r, C[col], 7); S.fillX(S.txt(r, n, { size: 11, mono: true, weight: 600 }));
    const l = S.row(it, { gap: 6, pad: [0, 0, 0, 13] }); S.fillX(S.txt(l, st, { size: 12, color: C[col] })); S.txt(l, when, { size: 11, mono: true, color: C.dim }); }); return c; };
const runHeadOf = (p, name, title, o = {}) => { const h = S.row(p, { gap: 12 }); const av = S.box(h, { name: "AgentAvatar", fill: C.brandSoft, radius: 999, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", 18, C.brand);
  const c = S.col(h, { gap: 3 }); const r = S.row(c, { gap: 8 }); S.txt(r, name, { size: 17, mono: true, weight: 600 });
  if (o.done) S.badge(r, "Terminé", C.green, { round: true, stroke: C.green, dot: C.green }); else S.badge(r, "En cours", C.blue, { round: true, stroke: C.blue, dot: C.blue });
  const sub = S.row(c, { gap: 0 }); S.txt(sub, "Agent livraison · Projet · BOU · " + title + " · ", { size: 12, color: C.mfg }); S.txt(sub, "démarré à " + o.start, { size: 12, mono: true, color: C.mfg });
  S.child(h, { h: "fill" }); S.button(h, "Passer en review", "outline", { sm: true, icon: "eye" }); if (!o.done) S.button(h, "Arrêter", "ghost", { sm: true, icon: "square" }); return h; };
const composer = (p, o = {}) => { const c = S.col(p, { name: "Composer", gap: 6 }); S.txt(c, "Écrire à l'agent", { size: 12, weight: 500 });
  const b = S.box(c, { name: "ComposerBox", stroke: C.brand, radius: 8, dir: "row", gap: 10, pad: [6, 6, 6, 12], vs: "auto", align: "center" }); S.fillX(b);
  S.fillX(S.txt(b, "Ton message…", { size: 13, color: C.dim })); if (o.done) S.txt(b, "Reprend la session", { size: 12, color: C.mfg }); S.button(b, "Envoyer", "brand", { sm: true, disabled: true });
  if (!o.done) help(c, "L'agent travaille : ton message lui sera remis au début de son prochain tour."); return c; };
const W12 = { run: R12, title: T12, ago: "22 min", step: "Étape 3 · Brancher le format sur le récapitulatif", ws: "worktree bou-12", files: 3, exports: EXPORTS12 };
const W15 = { run: R15, title: T15, ago: "12 min", step: "Étape 3 · Reprendre formatDate de BOU-12", ws: "worktree bou-15", files: 2, exports: [] };
const parallel = (p, w = W12, o = {}) => { const s = S.panel(p, { name: "ParallelWork", gap: 10, pad: 14 }); const h = S.row(s, { gap: 8 }); S.icon(h, "users", 14, C.mfg); S.fillX(S.txt(h, "Travail en parallèle", { size: 13, weight: 600 })); S.txt(h, "1 run actif", { size: 12, color: C.dim });
  help(s, "Ce que l'agent reçoit à chaque tour, sans token.", C.mfg);
  const cd = S.box(s, { name: "ParallelRun", stroke: C.border, radius: 8, dir: "column", gap: 8, pad: 12, vs: "auto" }); S.fillX(cd); S.fillX(mention(cd, w.run, { size: 12 }));
  S.fillX(S.txt(cd, w.title + " · démarré il y a " + w.ago, { size: 12, color: C.mfg, lh: 1.4 }));
  const st = S.row(cd, { gap: 6 }); S.spinner(st, C.mfg, 12); S.fillX(S.txt(st, w.step, { size: 12 }));
  const ws = S.row(cd, { gap: 6 }); S.icon(ws, "branch", 12, C.dim); S.txt(ws, w.ws, { size: 12, mono: true, color: C.mfg });
  const fl = S.row(cd, { gap: 6 }); S.icon(fl, "chevRight", 12, C.dim); label(fl, w.files + " fichiers");
  if (w.exports.length) { label(cd, w.exports.length + " exports nouveaux"); w.exports.forEach(([n, path]) => { const r = S.row(cd, { gap: 6 }); S.txt(r, n, { size: 12, mono: true, weight: 600 }); S.fillX(S.txt(r, path, { size: 12, mono: true, color: C.mfg })); }); }
  if (o.open) { hline(cd); const ov = S.row(cd, { gap: 6 }); S.icon(ov, "copy", 13, C.mfg); inline(ov, [{ m: "formatDate" }, " exporté deux fois"], { color: C.fg }); S.spacer(ov); S.txt(ov, "Ouvert", { size: 12, color: C.mfg });
    S.button(cd, "Voir les fichiers", "ghost", { sm: true, icon: "eye" }); }
  S.button(cd, "Voir son travail", "outline", { sm: true, icon: "eye" }); return s; };
const report15 = (p, o = {}) => { const rep = S.panel(p, { name: "Report", gap: 6, pad: o.pad ?? 14, fill: o.fill }); if (o.title !== false) S.txt(rep, "Compte rendu", { size: 13, weight: 600 });
  if (!o.done) { S.txt(rep, "Pas de compte rendu pour ce run", { size: 12, color: C.mfg }); return rep; }
  const b = o.flat ? rep : S.box(rep, { name: "ReportBody", stroke: C.border, radius: 8, dir: "column", gap: 6, pad: 12, vs: "auto" }); if (!o.flat) S.fillX(b);
  S.txt(b, "Fait", { size: 12, color: C.mfg }); S.fillX(S.txt(b, "La page de suivi affiche la date de livraison estimée.", { size: 13, lh: 1.45 }));
  S.txt(b, "Décisions", { size: 12, color: C.mfg }); const d = S.row(b, { gap: 8, align: "start" }); S.txt(d, "•", { size: 13 }); S.fillX(S.txt(d, "Repris formatDate de BOU-12 (src/lib/format-date.ts)", { size: 13, lh: 1.45 }));
  S.txt(b, "Fichiers (2)", { size: 12, color: C.mfg }); ["src/lib/format-date.ts", "src/pages/track.ts"].forEach(x => { const r = S.row(b, { gap: 8 }); S.txt(r, "•", { size: 13 }); S.txt(r, x, { size: 13 }); });
  S.txt(b, "Suite", { size: 12, color: C.mfg }); S.fillX(S.txt(b, "Fusionner BOU-12 avant BOU-15.", { size: 13, lh: 1.45 })); return rep; };
const runPage = async (name, col, row, o) => { const own = o.run === R12; const key = own ? "BOU-12" : "BOU-15";
  const r = await screen(name, col, row, "Agents", ["Agents", o.run], ["bot", "Run " + o.run], { h: o.h, bar: o.bar }); const { frame: f, content: c } = r; c.flex.rowGap = 16;
  runHeadOf(c, o.run, own ? T12 : T15, { done: o.done, start: own ? "14:28" : "14:40" });
  const cols = S.row(c, { name: "Columns", gap: 16, align: "start" }); const l = S.box(cols, { name: "Runs", w: 230, dir: "column", gap: 4, vs: "auto" }); historyList(l, o.run, o.done);
  const m = S.panel(cols, { name: "Fil", gap: 12, pad: 16, fillX: false }); S.child(m, { h: "fill" });
  const mh = S.row(m, { gap: 8 }); S.fillX(S.txt(mh, "Fil narratif", { size: 13, weight: 600 })); S.check(mh, false, "Afficher le raisonnement");
  S.txt(m, "Session : nouvelle (première session du ticket)", { size: 12, color: C.mfg });
  const fl = S.col(m, { name: "Thread", gap: 12 }); o.fil(fl); composer(m, { done: o.done });
  const side = S.box(cols, { name: "Side", w: o.sideW || 320, dir: "column", gap: 14, vs: "auto" });
  if (o.side) o.side(side); else { parallel(side, own ? W15 : W12, { open: o.openOverlap }); const pl = S.panel(side, { gap: 4, pad: 14 }); planBlock(pl, own ? PLAN12 : PLAN15, { n: "3/4", source: "ticket_progress", size: 13, pad: [5, 0] }); report15(side, { done: o.done && !own }); }
  return r; };

// ---------- 197 · Fil du run other ----------
S.draw[197] = async () => { const { frame: f } = await runPage("197 · Fil du run : recouvrement à factoriser", 0, 0, { run: R15, h: 1100, openOverlap: true, bar: { open: true },
  fil: (p) => { FIL15.read(p); FIL15.write(p); overlapLine(p, { with: R12, other: true, state: "Ouvert", time: "14:48" }); FIL15.peek(p); FIL15.remind(p); } }); return f.id; };

// ---------- 197b · Fil du run owner ----------
S.draw["197b"] = async () => { const { frame: f } = await runPage("197b · Fil du run : repris par l'autre run", 2, 0, { run: R12, h: 1100,
  fil: (p) => { say(p, "14:30", "Étape 1", "Je relis les formats de date de la boutique avant d'écrire le mien."); pill(p, ["A lu 3 fichiers"]);
    say(p, "14:38", "Étape 2", "J'écris formatDate et formatDeliveryWindow dans src/lib/format-date.ts, réexportés par src/lib/format.ts."); pill(p, ["A créé 1 fichier, modifié 2 fichiers et lancé les tests (6 réussis)"]);
    overlapLine(p, { with: R15, other: false, state: "Réglé 14:52", time: "14:48" });
    notice(p, "14:49 · Kibo : BOU-15 reprend ton formatDate, ne le renomme pas et ne le déplace pas");
    say(p, "14:51", "Étape 3", "Je garde formatDate tel quel et je branche le format sur le récapitulatif de commande."); pill(p, ["A modifié 1 fichier"]); } }); return f.id; };

// ---------- 197c · Dialogue « Voir les fichiers » ----------
const SRC12 = ['export { formatDate, formatDeliveryWindow } from "./format-date";', "", "export function formatPrice(cents: number): string {", '  return (cents / 100).toFixed(2).replace(".", ",") + " €";', "}"];
const SRC15 = ["export function formatDate(date: Date): string {", '  return date.toLocaleDateString("fr-FR");', "}"];
const codePane = (p, lines, hot, col) => { const c = S.box(p, { name: "CodePane", dir: "column", gap: 0, pad: [6, 0], vs: "auto" }); S.child(c, { h: "fill" });
  lines.forEach((t, i) => { const on = hot.includes(i + 1); const r = S.box(c, { name: "CodeLine", fill: on ? col : null, op: 0.12, dir: "row", gap: 10, pad: [3, 10], vs: "auto", align: "center" }); S.fillX(r);
    const n = S.box(r, { name: "ln", w: 22, dir: "row", vs: "auto", justify: "end" }); S.txt(n, String(i + 1), { size: 12, mono: true, color: C.dim });
    if (on) S.box(r, { name: "mark", fill: col, w: 2, h: 16 }); S.fillX(S.txt(r, t || " ", { size: 12, mono: true, lh: 1.5 })); }); return c; };
S.draw["197c"] = async () => { const { frame: f } = await runPage("197c · Fichiers du recouvrement", 0, 2, { run: R15, h: 1100, openOverlap: true, bar: { open: true },
  fil: (p) => { FIL15.read(p); FIL15.write(p); overlapLine(p, { with: R12, other: true, state: "Ouvert", time: "14:48" }); } });
  S.overlay(f); const W = 1100; const d = S.box(f, { name: "OverlapFiles", fill: C.card, stroke: C.border, radius: 12, w: W, dir: "column", gap: 14, pad: 24, vs: "auto" }); shadow(d); abs(f, d, (1440 - W) / 2, 130);
  S.txt(d, "Fichiers du recouvrement", { size: 17, weight: 600 }); help(d, "Les deux fichiers côte à côte, en lecture seule.", C.mfg);
  const hd = S.row(d, { gap: 16 }); [[R12, "src/lib/format.ts"], [R15, "src/utils/date.ts"]].forEach(([r, path]) => { const x = S.row(hd, { gap: 0 }); S.child(x, { h: "fill" }); S.txt(x, r + " · " + path, { size: 12, mono: true, weight: 600 }); });
  const box = S.box(d, { name: "Panes", fill: C.bg, stroke: C.border, radius: 8, dir: "row", gap: 16, pad: [6, 0], h: 260 }); S.fillX(box); box.clipContent = true;
  codePane(box, SRC12, [1], C.red); codePane(box, SRC15, [1, 2, 3], C.green);
  const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Fermer", "outline"); S.frontAbs(f); return f.id; };

// ---------- 198 · Lien posé par Kibo ----------
const fil198 = (o) => (p) => { FIL15.write(p); overlapLine(p, { with: R12, other: true, state: "Réglé 14:52", time: "14:48" }); FIL15.peek(p); FIL15.fix(p); linkLine(p, o); };
S.draw[198] = async () => { const { frame: f } = await runPage("198 · Kibo a lié BOU-12 → BOU-15", 4, 0, { run: R15, h: 1100, fil: fil198({}) }); return f.id; };
S.draw["198b"] = async () => { const { frame: f } = await runPage("198b · Lien annulé par Adam", 6, 0, { run: R15, h: 1100, done: true, bar: { used: 1 }, fil: fil198({ cancelled: true }) }); return f.id; };

// ---------- 199 · Fiche BOU-15 : Détails, lien par Kibo ----------
const tabsRow = (p, on) => { const tc = S.col(p, { name: "SheetTabs", gap: 0 }); const tb = S.row(tc, { gap: 0 });
  ["Détails", "Activité"].forEach(t => { const x = S.box(tb, { name: "Tab-" + t, dir: "column", gap: 8, pad: [0, 12], hs: "auto", vs: "auto" });
    S.txt(x, t, { size: 13, weight: t === on ? 600 : 400, color: t === on ? C.fg : C.mfg }); S.fillX(S.box(x, { name: "underline", fill: t === on ? C.fg : null, h: 2, w: 10 })); }); hline(tc); return tc; };
const topActions = (f) => { S.topAction(f, "Partager", "outline", "share2"); const b = S.topAction(f, "Agent de projet", "ghost", "sparkles");
  if (b) penpotUtils.findShapes(x => x.strokes?.length, b.children.find(k => /^icon/.test(k.name)) || b).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: C.brand }))); };
const sheetHead = (p, key, title, on) => { const th = S.row(p, { gap: 6 }); S.fillX(S.txt(th, key, { size: 12, mono: true, color: C.mfg })); iconButton(th, "more");
  S.txt(p, title, { size: 18, weight: 600 }); input(p, "Ajouter une étiquette", { w: 192, size: 12, placeholder: true });
  const a = S.row(p, { gap: 8 }); S.visQ.orangeButton(a, "Assigner à un agent", "bot"); tabsRow(p, on); };
const prop = (p, k, fn) => { const r = S.row(p, { gap: 8 }); const kk = S.box(r, { name: "k", w: 112, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
const details = (p, key, deps) => { const props = S.col(p, { gap: 10 });
  prop(props, "Statut", r => select(r, "En cours", { w: 192, lead: s => S.statusDot(s, "En cours", 8) })); prop(props, "Domaine", r => select(r, "Aucun", { w: 192 }));
  prop(props, "Assigné", r => { const c = S.col(r, { gap: 4 }); select(c, "livraison", { w: 192, disabled: true }); S.txt(c, "Choisis un profil via Assigner à un agent", { size: 12, color: C.mfg }); });
  prop(props, "Session principale", r => S.txt(r, "bou · livraison · " + key + " · 1 tour", { size: 12, mono: true }));
  const dp = S.col(p, { name: "Dependencies", gap: 8 }); S.txt(dp, "Dépendances", { size: 13, weight: 600 }); if (deps) deps(dp); S.button(dp, "Ajouter une dépendance", "outline", { sm: true, icon: "plus" });
  const de = S.row(p, { gap: 16 }); S.txt(de, "Description", { size: 13, weight: 600 }); S.txt(de, "Modifier", { size: 12, weight: 500 }); S.txt(p, "-", { size: 13, color: C.mfg });
  const mq = S.col(p, { gap: 8 }); S.txt(mq, "Maquettes", { size: 13, weight: 600 }); const mr = S.row(mq, { gap: 8 }); S.fillX(input(mr, "Colle l'URL d'un cadre Figma ou d'un board Penpot", { placeholder: true, size: 12 })); S.button(mr, "Lier un cadre", "outline", { sm: true }); };
const centered = (c) => { c.flex.alignItems = "center"; const s = S.box(c, { name: "Sheet", w: 736, dir: "column", gap: 14, vs: "auto" }); return s; };
S.draw[199] = async () => { const { frame: f, content: c } = await screen("199 · Fiche BOU-15 : lien posé par Kibo", 0, 1, "Tickets", ["Boutique", "BOU-15"], ["ticket", "Boutique · BOU-15"], { h: 1040, bar: { used: 1 } });
  topActions(f); const s = centered(c); sheetHead(s, "BOU-15", T15, "Détails");
  let kb; details(s, "BOU-15", (dp) => { label(dp, "Bloqué par"); const r = S.row(dp, { name: "LinkRow", gap: 8 }); S.dot(r, C.blue, 7); S.txt(r, "BOU-12", { size: 12, mono: true });
    S.fillX(S.txt(r, T12, { size: 12, weight: 500 })); kb = S.badge(r, "par Kibo", C.mfg, { round: true, icon: "link" }); kb.name = "ByKibo"; S.icon(r, "x", 13, C.mfg); });
  await wait(1500); const p = rel(f, kb); const pop = S.box(f, { name: "Popover", fill: C.card, stroke: C.border, radius: 8, dir: "column", gap: 8, pad: [10, 12], hs: "auto", vs: "auto" }); shadow(pop);
  inline(pop, ["Reprise de ", { m: "src/lib/format-date.ts" }], { size: 12 }); const pr = S.row(pop, { gap: 8, hs: "auto" }); S.txt(pr, "12 oct. 14:52", { size: 12, color: C.mfg }); S.box(pr, { name: "gap", w: 24, h: 1 }); S.icon(pr, "undo", 12, C.mfg); S.txt(pr, "Annuler", { size: 12, weight: 500 });
  abs(f, pop, p.x, p.y + p.h + 6); S.frontAbs(f); await wait(2500); pop.x = kb.x + kb.width - pop.width; pop.y = kb.y + kb.height + 6; return f.id; };

// ---------- 199b · Fiche BOU-15 : Activité ----------
S.draw["199b"] = async () => { const { frame: f, content: c } = await screen("199b · Fiche BOU-15 : Activité et recouvrements", 2, 2, "Tickets", ["Boutique", "BOU-15"], ["ticket", "Boutique · BOU-15"], { h: 1240, bar: { used: 1 } });
  topActions(f); c.flex.rowGap = 12; sheetHead(c, "BOU-15", T15, "Activité");
  const rh = S.row(c, { gap: 8 }); S.txt(rh, "Compte rendu", { size: 13, weight: 600 }); S.txt(rh, "Run 1 · " + R15, { size: 12, color: C.mfg });
  report15(c, { done: true, title: false, flat: true, pad: 14 });
  const o = S.row(c, { name: "OverlapSummary", gap: 6 }); S.icon(o, "copy", 13, C.mfg); S.txt(o, "Recouvrements : 1 réglé · 0 ouvert", { size: 12, color: C.mfg });
  const row = S.row(c, { name: "ActivityRow", gap: 24, align: "start" }); const t = S.col(row, { name: "Timeline", gap: 12 }); label(t, "Chronologie · plan et fil mêlés");
  const hd = S.row(t, { gap: 8 }); S.dot(hd, C.green, 8); S.txt(hd, "Run 1", { size: 13, weight: 600 }); S.txt(hd, R15, { size: 12, mono: true, color: C.mfg }); S.txt(hd, "aujourd'hui 14:40 → 14:57", { size: 12, color: C.mfg }); S.spacer(hd); S.txt(hd, "Fait", { size: 12, color: C.mfg });
  const fl = S.col(t, { gap: 10, pad: [0, 0, 0, 16] }); FIL15.write(fl); overlapLine(fl, { with: R12, other: true, state: "Réglé 14:52", time: "14:48" }); peek(fl); FIL15.fix(fl); linkLine(fl);
  say(fl, "14:57", "Fin", "Compte rendu rempli : formatDate repris de BOU-12, à fusionner après lui.");
  const side = S.panel(row, { name: "PlanSide", gap: 4, pad: 14, w: 288 }); planBlock(side, PLAN15.map(([, t, n]) => ["done", t, n]), { n: "4/4", source: "ticket_progress", size: 13, pad: [5, 0] }); return f.id; };

// ---------- 200 · Barre des agents : recouvrement ouvert ----------
S.draw[200] = async () => { const { frame: f, content: c } = await screen("200 · Barre des agents : recouvrement ouvert", 2, 1, "Tickets", ["Boutique", "BOU-12"], ["ticket", "Boutique · BOU-12"], { h: 1040, bar: { open: true } });
  topActions(f); const s = centered(c); sheetHead(s, "BOU-12", T12, "Détails"); details(s, "BOU-12");
  await wait(3500); const chips = penpotUtils.findShapes(x => x.name === "OverlapCount", find(f, "AgentStatusBar")); const p = rel(f, chips[chips.length - 1] || find(f, "AgentStatusBar"));
  tooltip(f, p.x - 70, p.y - 38, "1 recouvrement ouvert"); S.frontAbs(f); return f.id; };

// ---------- 200b · Page du run : travail en parallèle ----------
S.draw["200b"] = async () => { const { frame: f } = await runPage("200b · Page du run : travail en parallèle", 4, 2, { run: R15, h: 1040,
  bar: { t15: "BOU-15 · 1/4 · Relire la page de suivi", t12: "BOU-12 · 2/4 · Écrire formatDate" },
  fil: (p) => { FIL15.read(p); },
  side: (s) => { parallel(s, { ...W12, ago: "13 min", step: "Étape 2 · Écrire formatDate et formatDeliveryWindow", files: 2 }); const pl = S.panel(s, { gap: 4, pad: 14 });
    planBlock(pl, PLAN15.map(([st, t], i) => [i === 0 ? "doing" : "todo", t]), { n: "1/4", source: "ticket_progress", size: 13, pad: [5, 0] }); report15(s); } }); return f.id; };

// ---------- 201 · Modifier le projet › Doublons entre agents ----------
const GENERIC = ["default", "Props", "meta", "config", "loader", "action", "handler", "main", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "generateMetadata",
  "getServerSideProps", "getStaticProps", "getStaticPaths", "Route", "Page", "Layout", "Component", "schema", "routes", "index", "up", "down", "migrate", "seed", "setup", "teardown"];
const chipX = (p, t) => { const b = S.box(p, { name: "Chip-" + t, fill: C.muted, radius: 999, dir: "row", gap: 4, pad: [3, 6, 3, 9], hs: "auto", vs: "auto", align: "center" });
  S.txt(b, t, { size: 11, mono: true, weight: 600 }); S.icon(b, "x", 11, C.dim); return b; };
S.draw[201] = async () => { const { frame: f } = await runPage("201 · Modifier le projet : doublons entre agents", 4, 1, { run: R15, h: 1240, openOverlap: true, bar: { open: true },
  fil: (p) => { FIL15.read(p); FIL15.write(p); overlapLine(p, { with: R12, other: true, state: "Ouvert", time: "14:48" }); } });
  const d = formDialog(f, "Modifier le projet", 560); d.flex.rowGap = 14;
  labeled(d, "Nom", x => input(x, "Boutique")); hline(d);
  const s = S.col(d, { name: "Section-doublons", gap: 14 }); const sh = S.row(s, { gap: 8 }); S.icon(sh, "copy", 15, C.mfg); S.fillX(S.txt(sh, "Doublons entre agents", { size: 14, weight: 600 }));
  help(s, "Kibo compare le travail des runs actifs du projet à chaque écriture et toutes les 5 minutes, sans token. Désactivé, la section « Travail en cours » reste.");
  const t = S.row(s, { gap: 10 }); S.toggle(t, true); S.txt(t, "Détecter les doublons entre agents", { size: 13 });
  const r = S.row(s, { gap: 24, align: "start" }); labeled(r, "Lignes minimales d'un bloc", x => input(x, "8", { w: 96, mono: true }), { help: "4 à 50 ; un bloc fait aussi 160 caractères au moins." });
  const ct = S.col(r, { gap: 6 }); S.txt(ct, " ", { size: 12 }); S.check(ct, false, "Comparer aussi les tests"); help(ct, "Tests et fixtures sont exclus des blocs par défaut.");
  labeled(s, "Fichiers ignorés", x => input(x, "src/generated/**", { mono: true, size: 12, h: 56 }), { help: "Un glob par ligne, en plus des verrous, fichiers générés, binaires et secrets." });
  labeled(s, "Exports génériques", x => { const w = S.row(x, { gap: 6 }); w.flex.wrap = "wrap"; GENERIC.forEach(n => chipX(w, n)); input(x, "Ajouter…", { w: 160, size: 12, placeholder: true, mono: true }); },
    { help: "Un nom exporté deux fois parmi ceux-ci ne déclenche pas d'alerte." });
  const ig = S.col(s, { gap: 6 }); S.txt(ig, "Recouvrements ignorés", { size: 12, weight: 500 });
  const tb = S.panel(ig, { name: "IgnoredOverlaps", gap: 0, pad: [0, 12] }); const row = S.row(tb, { name: "Ignored-fr.ts", gap: 10, pad: [9, 0] }); S.icon(row, "fileText", 14, C.mfg);
  S.fillX(S.txt(row, "`src/i18n/fr.ts`", { size: 12, mono: true })); S.badge(row, "fichier", C.mfg, { round: true }); S.txt(row, "12 oct. · Adam", { size: 12, color: C.mfg }); S.button(row, "Réactiver", "outline", { sm: true });
  help(ig, "Un recouvrement ignoré ne réalerte plus, pour aucun run du projet.");
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

// ---------- 201b · Ce que reçoit l'agent ----------
const WORK = () => [["## Travail en cours sur le projet", C.fg], ["", C.mfg], ["### bou · livraison · BOU-12 · Format des dates de livraison", C.fg], ["", C.mfg],
  ["- démarré il y a 12 min · étape : Brancher le format sur le récapitulatif", C.mfg], ["- Plan :", C.mfg], ["  1. [done] Lire les formats de date existants", C.mfg],
  ["  2. [done] Écrire formatDate et formatDeliveryWindow", C.mfg], ["  3. [doing] Brancher le format sur le récapitulatif", C.mfg], ["  4. [todo] Tests des formats", C.mfg],
  ["- Fichiers créés ou modifiés :", C.mfg], ["  - `src/i18n/fr.ts` (+6 −2)", C.mfg], ["  - `src/lib/format-date.ts` (+24 −0)", C.mfg], ["  - `src/lib/format.ts` (+3 −1)", C.mfg],
  ["- Exports nouveaux :", C.mfg], ["  - `formatDate` (`src/lib/format-date.ts`)", C.mfg], ["  - `formatDeliveryWindow` (`src/lib/format-date.ts`)", C.mfg], ["- Espace : worktree `bou-12`", C.mfg], ["", C.mfg],
  ["### bou · livraison · BOU-9 · Codes promo du panier", C.fg], ["", C.mfg], ["- démarré il y a 31 min · étape : Valider le code côté serveur", C.mfg], ["- aucun plan déclaré", C.mfg],
  ["- Fichiers créés ou modifiés :", C.mfg], ["  - `src/cart/cart.ts` (+12 −3)", C.mfg], ["  - `src/cart/promo.ts` (+41 −0)", C.mfg], ["- Exports nouveaux :", C.mfg], ["  - `applyPromoCode` (`src/cart/promo.ts`)", C.mfg],
  ["- Espace : worktree `bou-9`", C.mfg], ["", C.mfg], ["Avant de créer un utilitaire, un type ou un composant, vérifie qu'il n'existe", C.fg], ["pas déjà dans le code ni dans ce qui précède ;", C.fg], ["`mcp__kibo__peek_work` lit le travail d'un autre run.", C.fg]];
const level = (p, t, lines) => { const b = S.box(p, { name: "Level-" + t, stroke: C.border, radius: 6, dir: "column", gap: 8, pad: [8, 10], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, lines ? "chevDown" : "chevRight", 13, C.mfg); S.fillX(S.txt(h, t, { size: 13, weight: 500 }));
  if (lines) S.code(b, lines, { fill: C.muted }); return b; };
S.draw["201b"] = async () => { const r = await screen("201b · Ce que reçoit l'agent : travail en cours", 6, 1, "Agents", ["Agents", "livraison"], ["bot", "Agents · livraison"], { h: 1240, bar: { open: true } });
  const { frame: f, content: c } = r; c.flex.rowGap = 14;
  const h = S.row(c, { gap: 12 }); const av = S.box(h, { name: "AgentAvatar", fill: C.brandSoft, radius: 999, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", 20, C.brand);
  const tv = S.col(h, { gap: 4 }); const tr = S.row(tv, { gap: 8 }); S.txt(tr, "livraison", { size: 18, mono: true, weight: 600 }); S.badge(tr, "Projet · Boutique", C.mfg, { round: true, dot: C.brand });
  S.txt(tv, "~/code/boutique/.claude/agents/livraison.md", { size: 12, mono: true, color: C.mfg }); S.spacer(h); S.button(h, "Ce que reçoit l'agent", "outline", { sm: true, icon: "eye" }); S.button(h, "Enregistrer", "default", { sm: true, disabled: true });
  const nb = S.box(c, { name: "RunNotice", stroke: C.border, radius: 8, dir: "row", gap: 8, pad: [10, 14], vs: "auto", align: "center" }); S.fillX(nb); S.icon(nb, "info", 14, C.blue); S.txt(nb, "2 runs en cours : les changements s'appliquent à leur prochain tour.", { size: 13, color: C.blue });
  labeled(c, "Description", x => input(x, "Livre un ticket de la boutique : lit le ticket, planifie, code en TDD, commite et ouvre la PR."));
  S.code(c, ["# Livraison", "Tu livres un ticket de la boutique de bout en bout.", "", "## Workflow", "1. Lis le ticket et son brief ; relis les fichiers cités.", "2. Déclare ton plan avec ticket_progress avant de coder."], { fill: C.bg });
  S.overlay(f); const W = 680; const sh = S.box(f, { name: "Sheet", fill: C.bg, stroke: C.border, w: W, h: 1240, dir: "column", gap: 10, pad: [20, 20] }); shadow(sh); abs(f, sh, 1440 - W, 0); sh.clipContent = true;
  const hh = S.row(sh, { gap: 8 }); S.icon(hh, "eye", 16, C.fg); S.fillX(S.txt(hh, "Ce que reçoit l'agent", { size: 16, weight: 600 })); iconButton(hh, "x");
  const t = S.row(sh, { gap: 8 }); S.txt(t, "livraison", { size: 12, mono: true, weight: 600 }); S.txt(t, "sur", { size: 12, color: C.mfg }); select(t, "Ticket d'exemple : BOU-15 · " + T15);
  label(sh, "CLAUDE.md composé · 2 400 tokens estimés");
  const lv = S.col(sh, { gap: 4 }); [["Workspace", "context/1-workspace/conventions.md", "420"], ["Projet", "context/2-projet/boutique.md", "640"], ["Agent · livraison", "context/4-agent/livraison.md", "610"]]
    .forEach(([n, path, tok]) => { const b = S.box(lv, { name: "Level-" + n, stroke: C.border, radius: 6, dir: "row", gap: 8, pad: [8, 12], vs: "auto", align: "center" }); S.fillX(b);
      const x = S.col(b, { gap: 2 }); S.txt(x, n, { size: 13 }); S.txt(x, path, { size: 11, mono: true, color: C.mfg }); S.txt(b, tok, { size: 12, mono: true }); });
  level(sh, "CLAUDE.md complet"); level(sh, "brief.md"); level(sh, "Travail en cours sur le projet (exemple)", WORK()); level(sh, "agents.json");
  label(sh, "Commande");
  const kv = S.panel(sh, { name: "Command", gap: 6, pad: [10, 12] }); [["Modèle", "opus"], ["Permissions", "Modifications acceptées"], ["Outils", "tous (pas de champ tools)"], ["Sous-agents", "aucun"], ["Skills", "tous"]]
    .forEach(([k, v]) => { const rr = S.row(kv, { gap: 8 }); const l = S.box(rr, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(l, k, { size: 12, color: C.mfg }); S.fillX(S.txt(rr, v, { size: 12, mono: true })); });
  help(sh, "Aucun secret : ni le jeton du run ni les variables d'environnement."); S.frontAbs(f); return f.id; };

S.fixDoublonsNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^(19[7-9]|20[01])/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), ag = S.fx.item(f, "Agents"),
  q = S.fx.item(f, "Files d'attente"), sk = S.fx.item(f, "Skills"); if (!sb || !ag || !q || !sk) return n;
  sb.insertChild(sb.children.findIndex(c => c.id === ag.id) + 1, q); sb.insertChild(sb.children.findIndex(c => c.id === q.id) + 1, sk); return n + 1; }, 0);
S.fixBarTip = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^200 /.test(c.name)).reduce((n, f) => { const tip = f.children.find(x => x.name === "Tooltip");
  const ch = penpotUtils.findShapes(x => x.name === "OverlapCount", find(f, "AgentStatusBar")).pop(); if (!tip || !ch) return n; tip.x = ch.x + ch.width / 2 - tip.width / 2; tip.y = ch.y - tip.height - 12; return n + 1; }, 0);
S.dropScreen = (n) => { const re = new RegExp("^" + n + " · "); const old = penpot.currentPage.root.children.filter(c => c.type === "board" && re.test(c.name)); old.forEach(b => b.remove()); return old.length; };
S.DOUBLONS = [197, "197b", "197c", 198, "198b", 199, "199b", 200, "200b", 201, "201b"];
return "doublons ok";
