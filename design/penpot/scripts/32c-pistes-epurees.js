// Page « 28b · Pistes épurées » : seconde série de pistes, une information principale par surface, le reste se déplie. Requiert 18-socle.js et 24-socle-suite.js.
// I barre repliée (commune) · D1 fil épuré · D2 résumé d'abord · D3 conversation, chacune en volet déroulé (ii) et fiche KIB-14, onglet Activité (iii).
// Zinc partout, orange seulement quand un agent attend Adam, rouge seulement pour un échec, monospace seulement au niveau détail technique.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "28b · Pistes épurées";
const { find, wait, shadow, abs, hline, tooltip, kanbanAt } = S.fx;
const { iconButton } = S.fx2;

// ---------- Données (une partie seulement) ----------
const AG = [
  { a: "opus-dev-3", t: "KIB-16", title: "Moteur de règles déclaratif", where: "Étape 2 sur 5 : corriger la validation", did: "A trouvé pourquoi une condition vide passait la validation, et l'a corrigé.", wants: "Rien pour l'instant" },
  { a: "opus-dev-1", t: "KIB-12", title: "Schéma Loro des tickets", where: "Étape 3 sur 5 : tests de convergence", did: "A écrit les opérations de déplacement ; les tests tournent.", wants: "Rien pour l'instant" },
  { a: "sonnet-review", t: "KIB-7", title: "Tokens shadcn + thème sombre", where: "Étape 1 sur 3 : relire la PR #12", did: "Vient de commencer la relecture.", wants: "Rien pour l'instant" },
  { a: "opus-dev-2", t: "KIB-14", title: "Récepteur de hooks Claude Code", where: "Étape 4 sur 5 : choisir le port", did: "A fini le serveur local et la validation des événements.", wants: "Une réponse : garder le port 7420, ou un port libre choisi au lancement ?", waiting: true }];
const FIL16 = [["14:01", "Je commence par relire le schéma des règles et ses tests."],
  ["14:05", "La validation laissait passer une condition vide. Je l'ai corrigée.", [["Lu", "packages/core/src/rules/schema.ts", ""], ["Modifié", "packages/core/src/rules/validate.ts", "+8 −3"], ["Commande", "bun test packages/core/src/rules", "12 réussis · 1 échoue"]]],
  ["14:09", "Un test échoue encore : les règles imbriquées n'héritent pas du contexte du parent. Je regarde pourquoi."]];
const PLAN16 = ["Relire le schéma des règles", "Corriger la validation", "Tester les règles imbriquées", "Brancher le moteur sur les statuts", "Documenter le format"];
const REPORT = [["Fait", "Le récepteur reçoit les hooks de Claude Code et met à jour l'état du run."], ["À vérifier", "Le redémarrage du démon pendant un run."], ["Suite", "Écrire les tests d'intégration du récepteur."]];
const QUESTION = "Le port 7420 est écrit en dur. Tu préfères le garder, ou laisser Kibo choisir un port libre au lancement ?";

// ---------- Primitives sobres ----------
const W = (p, t, o = {}) => { const x = S.txt(p, t, { size: o.size || 13, weight: o.weight || 400, color: o.color || C.fg, lh: o.lh || 1.5, mono: !!o.mono }); if (o.fill !== false) S.fillX(x); return x; };
const quiet = (p, t, o = {}) => W(p, t, { size: 12, color: C.mfg, ...o });
const link = (p, t, o = {}) => { const r = S.row(p, { gap: 4, hs: "auto" }); const x = S.txt(r, t, { size: o.size || 12, color: o.color || C.mfg, weight: 500 }); x.textDecoration = "underline"; if (o.chev) S.icon(r, o.open ? "chevDown" : "chevRight", 12, o.color || C.mfg); return r; };
const space = (p, h) => S.box(p, { name: "space", w: 1, h });
const fold = (p, label, value) => { const r = S.row(p, { name: "Fold-" + label, gap: 8, pad: [10, 0] }); S.icon(r, "chevRight", 13, C.mfg); S.txt(r, label, { size: 13, weight: 500 }); quiet(r, value, { fill: true }); return r; };
const detail = (p, rows) => { const b = S.box(p, { name: "TechDetail", stroke: C.border, radius: 6, dir: "column", gap: 4, pad: [8, 10], vs: "auto" }); S.fillX(b);
  rows.forEach(([k, v, res]) => { const r = S.row(b, { gap: 10 }); const kk = S.box(r, { name: "k", w: 64, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 11, color: C.dim });
    W(r, v, { size: 11, mono: true, color: C.mfg }); if (res) res.split(" · ").forEach(x => S.txt(r, x, { size: 11, mono: true, color: /échoue/.test(x) ? C.red : C.mfg })); }); return b; };
const sentence = (p, [time, text, tech], o = {}) => { const c = S.col(p, { name: "Sentence", gap: 4 }); S.txt(c, time, { size: 11, color: C.dim }); W(c, text, { size: o.size || 14, lh: 1.55 });
  if (o.noLinks) return c; link(c, "Détails", { chev: true, open: !!(tech && o.open) }); if (tech && o.open) detail(c, tech); return c; };
const waitingLine = (p, t) => { const r = S.row(p, { name: "Waiting", gap: 8 }); W(r, t, { size: 12, color: C.brand, weight: 500 }); return r; };

// ---------- Étape 1 : la carte du ticket dit juste « Agent au travail » ----------
const calmCards = (content) => { [["KIB-12", "Agent au travail"], ["KIB-16", "Agent au travail"], ["KIB-7", "Agent au travail"], ["KIB-14", "Attend ta réponse", true], ["KIB-10", "En file"], ["KIB-18", "En file"]].forEach(([k, t, w]) => {
  const cd = find(content, "TicketCard / " + k); if (!cd) return; const ag = cd.children.find(x => x.name === "agent"); if (ag) ag.remove();
  S.txt(cd, t, { size: 11, weight: w ? 500 : 400, color: w ? C.brand : C.mfg }); }); };

// ---------- Étape 2 : barre repliée, une info et une alerte ----------
const grip = (p, x, y) => { const g = S.box(p, { name: "ResizeGrip", fill: C.mfg, op: 0.5, radius: 999, w: 40, h: 4 }); if (g.layoutChild) g.layoutChild.absolute = true; penpotUtils.setParentXY(g, x, y); return g; };
const barLine = (bar, o = {}) => { S.txt(bar, "3 agents au travail", { size: 12, weight: 500 }); S.box(bar, { name: "gap", w: 16, h: 1 });
  S.txt(bar, "opus-dev-2 attend ta réponse", { size: 12, weight: 500, color: C.brand }); S.spacer(bar); S.txt(bar, o.open ? "Masquer" : "Afficher", { size: 12, color: C.mfg }); S.icon(bar, "chevDown", 14, C.mfg).rotation = o.open ? 0 : 180; };
const calmBar = (bar, o = {}) => { [...bar.children].forEach(k => k.remove()); bar.fills = [{ fillColor: o.hover ? C.accent : C.sidebar, fillOpacity: 1 }]; bar.flex.columnGap = 8; barLine(bar); grip(bar, 576, 3); return bar; };
const screen = async (name, col, row) => { const r = await kanbanAt(PAGE, name, col, row); calmCards(r.content); calmBar(find(r.frame, "AgentStatusBar")); return r; };
S.draw.e1 = async () => { const { frame: f } = await screen("I · Barre repliée : une info, une alerte", 0, 0); find(f, "AgentStatusBar").fills = [{ fillColor: C.accent, fillOpacity: 1 }];
  await wait(1500); tooltip(f, 600, 940 - 40 - 36, "Toute la barre se clique · le bord haut se tire"); S.frontAbs(f); return f.id; };

// ---------- Étape 3 : volet déroulé ----------
const drawer = (f) => { const H = 430; const d = S.box(f, { name: "AgentDrawer", fill: C.card, stroke: C.border, w: 1192, h: H, dir: "column", gap: 0 }); shadow(d, 0.3); abs(f, d, 248, 940 - H); d.clipContent = true;
  const h = S.row(d, { name: "DrawerBar", gap: 8, pad: [14, 20, 12, 20] }); barLine(h, { open: true }); hline(d); grip(d, 576, 4); return d; };
const agentLine = (p, g, o = {}) => { const r = S.box(p, { name: "AgentLine-" + g.a, fill: o.on ? C.accent : null, radius: 8, dir: "column", gap: 2, pad: [10, 12], vs: "auto" }); S.fillX(r);
  const h = S.row(r, { gap: 8 }); S.txt(h, g.a, { size: 13, weight: 500 }); quiet(h, g.t, { fill: true });
  if (g.waiting) W(r, "Attend ta réponse sur le port", { size: 12, color: C.brand }); else quiet(r, g.where); return r; };
const agentList = (p, sel) => { AG.forEach(g => agentLine(p, g, { on: g.a === sel })); space(p, 6); fold(p, "Terminés aujourd'hui", "1 run"); };
const filHead = (p, g, o = {}) => { const c = S.col(p, { gap: 4 }); const h = S.row(c, { gap: 8 }); S.txt(h, g.a, { size: 16, weight: 600 }); quiet(h, g.t + " · " + g.title, { fill: true });
  if (o.plan !== false) { const r = S.row(c, { gap: 10 }); quiet(r, g.where, { fill: false }); link(r, "Voir le plan", { chev: true }); } return c; };

S.draw.d1v = async () => { const { frame: f } = await screen("D1-ii · Fil épuré : volet en deux colonnes", 0, 1); const d = drawer(f);
  const b = S.row(d, { name: "Columns", gap: 0, align: "start" }); S.child(b, { v: "fill" });
  const l = S.box(b, { name: "Agents", w: 380, dir: "column", gap: 2, pad: [12, 12], vs: "auto" }); agentList(l, "opus-dev-3");
  const m = S.col(b, { name: "Fil", gap: 18, pad: [16, 28] }); S.child(m, { v: "fill" }); m.clipContent = true; m.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  filHead(m, AG[0]); FIL16.forEach((x, i) => sentence(m, x, { open: i === 1 })); S.frontAbs(f); return f.id; };
S.draw.d2v = async () => { const { frame: f } = await screen("D2-ii · Résumé d'abord : rangée de cartes", 0, 2); const d = drawer(f);
  const row = S.row(d, { name: "Cards", gap: 16, pad: [20, 20], align: "start" });
  [AG[3], AG[0], AG[1], AG[2]].forEach(g => { const c = S.box(row, { name: "Summary-" + g.a, fill: C.bg, stroke: g.waiting ? C.brand : C.border, radius: 10, dir: "column", gap: 14, pad: [16, 16], vs: "auto" }); S.child(c, { h: "fill" });
    const h = S.col(c, { gap: 2 }); S.txt(h, g.a, { size: 14, weight: 600 }); quiet(h, g.t + " · " + g.title);
    [["Où il en est", g.where], ["Ce qu'il a fait", g.did], ["Ce qu'il attend de toi", g.wants]].forEach(([k, v], i) => { const s = S.col(c, { gap: 2 }); S.txt(s, k, { size: 11, color: C.dim });
      W(s, v, { size: 13, lh: 1.45, color: i === 2 ? (g.waiting ? C.brand : C.mfg) : C.fg, weight: i === 2 && g.waiting ? 500 : 400 }); });
    const ft = S.row(c, { gap: 12 }); if (g.waiting) S.button(ft, "Répondre", "brand", { sm: true }); link(ft, "Voir le fil", { chev: true }); });
  S.frontAbs(f); return f.id; };
const bubble = (p, t, o = {}) => { const r = S.row(p, { name: o.me ? "MyMessage" : "AgentMessage", gap: 0 }); if (o.me) S.spacer(r);
  const b = S.box(r, { name: "Bubble", fill: o.me ? C.accent : C.muted, radius: 12, dir: "column", gap: 4, pad: [10, 14], vs: "auto", w: o.w || 520 }); W(b, t, { size: 14, lh: 1.5 }); return r; };
const mentionLine = (p, t, o = {}) => { const r = S.row(p, { name: "ActionMention", gap: 8, pad: [0, 0, 0, 14] }); S.txt(r, t, { size: 11, color: C.dim }); if (o.details) link(r, "Détails", { size: 11, color: C.dim }); return r; };
const stamp = (p, t) => { const r = S.row(p, { name: "Stamp", gap: 0, justify: "center" }); S.txt(r, t, { size: 11, color: C.dim }); return r; };
const reply = (p, who, o = {}) => { const c = S.col(p, { name: "Reply", gap: 10 }); if (o.chips) { const r = S.row(c, { gap: 8 }); o.chips.forEach(t => S.button(r, t, "outline", { sm: true })); }
  const i = S.box(c, { name: "Input", fill: C.bg, stroke: C.border, radius: 10, dir: "row", gap: 8, pad: [10, 12], vs: "auto", align: "center" }); S.fillX(i);
  W(i, "Répondre à " + who + "…", { size: 13, color: C.dim }); S.button(i, "Envoyer", o.wait ? "brand" : "secondary", { sm: true }); return c; };
const conversation = (p, o = {}) => { stamp(p, "Hier"); bubble(p, "Valide bien les événements avec Zod, le format des hooks peut changer.", { me: true, w: 420 });
  bubble(p, "C'est fait : le serveur local et la validation des événements sont prêts."); mentionLine(p, "a modifié 4 fichiers · tests réussis", { details: true });
  stamp(p, "Aujourd'hui"); bubble(p, "J'ai repris là où je m'étais arrêté."); mentionLine(p, "a relu 2 fichiers");
  bubble(p, QUESTION); const w = S.row(p, { gap: 0, pad: [0, 0, 0, 14] }); waitingLine(w, "Attend ta réponse depuis 3 min"); };
S.draw.d3v = async () => { const { frame: f } = await screen("D3-ii · Conversation : volet", 0, 3); const d = drawer(f);
  const b = S.row(d, { name: "Columns", gap: 0, align: "start" }); S.child(b, { v: "fill" });
  const l = S.box(b, { name: "Agents", w: 380, dir: "column", gap: 2, pad: [12, 12], vs: "auto" }); agentList(l, "opus-dev-2");
  const m = S.col(b, { name: "Chat", gap: 10, pad: [14, 28] }); S.child(m, { v: "fill" }); m.clipContent = true; m.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  const h = S.row(m, { gap: 8 }); S.txt(h, "opus-dev-2", { size: 16, weight: 600 }); quiet(h, "KIB-14 · Récepteur de hooks Claude Code", { fill: true });
  bubble(m, "C'est fait : le serveur local et la validation des événements sont prêts."); mentionLine(m, "a modifié 4 fichiers · tests réussis", { details: true });
  bubble(m, QUESTION); const w = S.row(m, { gap: 0, pad: [0, 0, 0, 14] }); waitingLine(w, "Attend ta réponse depuis 3 min");
  reply(m, "opus-dev-2", { wait: true, chips: ["Garder 7420", "Port libre au lancement"] }); S.frontAbs(f); return f.id; };

// ---------- Étape 5 : fiche KIB-14, onglet Activité ----------
const sheet = (f) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 600, h: 900, dir: "column", gap: 16, pad: [20, 28] }); shadow(sh, 0.3); abs(f, sh, 1440 - 600, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); quiet(hd, "KIB-14", { fill: true }); iconButton(hd, "more"); iconButton(hd, "x");
  W(sh, "Récepteur de hooks Claude Code", { size: 20, weight: 600, lh: 1.3 });
  const tabs = S.row(sh, { name: "SheetTabs", gap: 20 }); [["Détails"], ["Activité", true], ["Questions"]].forEach(([t, on]) => { const c = S.box(tabs, { name: "Tab-" + t, dir: "column", gap: 6, hs: "auto", vs: "auto" });
    S.txt(c, t, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : C.mfg }); const u = S.box(c, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 }); S.fillX(u); });
  hline(sh); return sh; };
const threeLines = (p, title, rows, o = {}) => { const b = S.col(p, { name: "Summary", gap: 12 }); quiet(b, title, { size: 11, color: C.dim });
  rows.forEach(([k, v, col]) => { const r = S.row(b, { gap: 16, align: "start" }); const kk = S.box(r, { name: "k", w: o.kw || 90, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 13, color: C.mfg, lh: 1.5 });
    W(r, v, { size: 14, lh: 1.5, color: col || C.fg, weight: col ? 500 : 400 }); }); return b; };
const waitingBanner = (p) => { const b = S.box(p, { name: "WaitingBanner", stroke: C.brand, radius: 10, dir: "column", gap: 8, pad: [12, 14], vs: "auto" }); S.fillX(b);
  waitingLine(b, "opus-dev-2 attend ta réponse"); W(b, QUESTION, { size: 13 }); const r = S.row(b, { gap: 8 }); S.button(r, "Répondre", "brand", { sm: true }); return b; };
S.draw.d1s = async () => { const { frame: f } = await screen("D1-iii · Fil épuré : fiche, Activité", 2, 1); const sh = sheet(f);
  waitingBanner(sh); threeLines(sh, "Dernier run terminé · hier", REPORT); hline(sh);
  const fl = S.col(sh, { gap: 16 }); quiet(fl, "Run en cours · aujourd'hui", { size: 11, color: C.dim }); const r = S.row(fl, { gap: 10 }); quiet(r, "Étape 4 sur 5 : choisir le port", { fill: false }); link(r, "Voir le plan", { chev: true });
  sentence(fl, ["14:21", "J'ai repris là où je m'étais arrêté hier."], {}); sentence(fl, ["14:29", "Je t'ai posé une question sur le port ; j'attends ta réponse pour continuer."], {});
  hline(sh); fold(sh, "Runs précédents", "2 runs, le premier interrompu"); S.frontAbs(f); return f.id; };
S.draw.d2s = async () => { const { frame: f } = await screen("D2-iii · Résumé d'abord : fiche, Activité", 2, 2); const sh = sheet(f);
  threeLines(sh, "Run en cours · opus-dev-2", [["Où il en est", AG[3].where], ["Ce qu'il a fait", AG[3].did], ["Ce qu'il attend de toi", AG[3].wants, C.brand]], { kw: 150 });
  const r = S.row(sh, { gap: 8 }); S.button(r, "Répondre", "brand", { sm: true }); link(r, "Voir le fil", { chev: true }); hline(sh);
  threeLines(sh, "Dernier run terminé · hier", REPORT, { kw: 150 }); hline(sh);
  fold(sh, "Plan", "étape 4 sur 5"); fold(sh, "Runs précédents", "2 runs"); S.frontAbs(f); return f.id; };
S.draw.d3s = async () => { const { frame: f } = await screen("D3-iii · Conversation : fiche, Activité", 2, 3); const sh = sheet(f);
  threeLines(sh, "Dernier run terminé · hier", REPORT); const r = S.row(sh, { gap: 16 }); link(r, "Plan · étape 4 sur 5", { chev: true }); link(r, "Runs précédents · 2", { chev: true }); hline(sh);
  const c = S.col(sh, { name: "Chat", gap: 10 }); conversation(c); reply(sh, "opus-dev-2", { wait: true, chips: ["Garder 7420", "Port libre au lancement"] }); S.frontAbs(f); return f.id; };

S.EPUREES = ["e1", "d1v", "d1s", "d2v", "d2s", "d3v", "d3s"];
return "pistes-epurees ok";
