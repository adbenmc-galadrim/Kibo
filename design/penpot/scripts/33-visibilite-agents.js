// Page « 29 · Visibilité des agents » : écrans 183 à 188k (phase 20, spec §26.10). Requiert 18-socle.js, 24-socle-suite.js, 32b, 32d et 32e (rechargé ici sur la page 29).
// D'après les captures screens/2026-10-1x-p20-t7 … t13 ; données : design/donnees-fictives.md, section « Visibilité des agents (phase 20) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "29 · Visibilité des agents";
const { find, wait, shadow, abs, rel, hline, input, select, listbox, help, labeled, segmented, formDialog, swatches, appScreen, kanbanAt } = S.fx;
const { iconButton } = S.fx2;
const { RUNCOL, mention, planBlock, notice, label, agentId, grip } = S.vis;
const { tint, orangeButton, recipient, toTransmit, addNav } = S.visQ;

Object.assign(S.ICONS, {
  chevUp: '<path d="m18 15-6-6-6 6"/>',
  listFilter: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  waypoints: '<circle cx="12" cy="4.5" r="2.5"/><path d="m10.2 6.3-3.9 3.9"/><circle cx="4.5" cy="12" r="2.5"/><path d="M7 12h10"/><circle cx="19.5" cy="12" r="2.5"/><path d="m13.8 17.7 3.9-3.9"/><circle cx="12" cy="19.5" r="2.5"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
});

// ---------- Données ----------
const PLAN = [["done", "Relire le récepteur et ses tests", "2 moments"], ["doing", "Corriger la validation du corps", "4 moments"], ["todo", "Choisir le port du récepteur"],
  ["blocked", "Brancher le récepteur sur le démon", "attend KIB-12"], ["todo", "Documenter le format des hooks"]];
const ACTS = [["check", "Modifié", "packages/daemon/src/hooks/receiver.ts", "+8 −3"], ["x", "Tests", "bun test packages/daemon/src/hooks", "12 ✓ 1 ✗"]];
const M = {
  read: { time: "10:37", step: "Étape 1", text: "Je relis le récepteur et ses tests avant de toucher au port.", sum: "A lu 2 fichiers" },
  fix: { time: "10:39", step: "Étape 2", text: "La validation laisse passer un corps vide. Je la corrige dans receiver.ts.", sum: "A modifié 1 fichier et lancé les tests (12 réussis, 1 échec)", err: true },
  why: { time: "10:40", step: "Étape 2", reason: "Le corps vide passe parce que le test ne couvre que null." },
  ask: { time: "10:42", step: "Étape 2", text: "Un test échoue encore : quel port veux-tu pour le récepteur ?" },
  q: { question: ["10:42", "Quel port pour le récepteur : 7420 fixe ou un port libre choisi au lancement ?"] },
  r2a: { time: "17:55", step: "Étape 1", text: "Je lis la doc des hooks de Claude Code et le serveur du démon.", sum: "A lu 3 fichiers" },
  r2b: { time: "18:31", step: "Étape 3", text: "Les corps de hooks passent par Zod ; les hooks inconnus sont journalisés, sans erreur.", sum: "A modifié 2 fichiers et lancé les tests (14 réussis)" },
};
const REPORT = { done: "Le récepteur accepte les hooks signés et rejette les corps vides.", decisions: ["Port 7420 gardé pour l'instant : la question à Adam est encore ouverte."],
  check: ["Le délai de 5 s convient-il aux gros dépôts ?", "Le message d'erreur est-il assez clair ?"], files: ["packages/daemon/src/hooks/receiver.ts", "packages/daemon/src/hooks/README.md"],
  next: "Brancher le récepteur sur le démon." };
const RUNS = [["opus-dev-1", "KIB-12", "running", "Schéma Loro des tickets", "12m"], ["opus-dev-3", "KIB-16", "running", "2/5 · Corriger la validation", "4m"],
  ["sonnet-review", "KIB-7", "running", "Tokens shadcn + thème sombre", "1m"], ["opus-dev-2", "KIB-14", "waiting", "Attend une réponse", "0s"]];
const QUEUE = [["opus-dev", "KIB-10", "Watcher git et gh"], ["opus-dev", "KIB-18", "Adaptateur GitHub Issues"], ["opus-dev", "KIB-29", "Migration v0 → v1"]];
const HISTORY = [["opus-dev", "KIB-29", "En file", "cyan", "11 oct., 10:25"], ["opus-dev", "KIB-18", "En file", "cyan", "11 oct., 10:25"], ["opus-dev-3", "KIB-16", "En cours", "blue", "11 oct., 10:41"],
  ["opus-dev-1", "KIB-12", "En cours", "blue", "11 oct., 10:33"], ["opus-dev-2", "KIB-14", "Attend une réponse", "amber", "11 oct., 10:37", true], ["sonnet-review", "KIB-11", "Terminé", "green", "11 oct., 09:51"],
  ["opus-dev-2", "KIB-14", "Fait, 2 points à vérifier", "green", "10 oct., 17:52"], ["opus-dev-1", "KIB-14", "Annulé · pas de compte rendu", "red", "7 oct., 10:04"]];
const QS = {
  port: { key: "KIB-14", to: "Moi (technique)", title: "Quel port pour le récepteur ?", by: "opus-dev-2", age: "il y a 3 min", ctx: "Le récepteur écoute sur 127.0.0.1. Question bloquante : le run attend la réponse.", options: ["7420", "Port libre choisi au lancement"], blocking: true },
  read: { key: "KIB-14", to: "Produit", title: "Un composant non autorisé lit-il les fichiers du projet ?", by: "opus-dev-2", age: "il y a 8 min", options: ["Oui", "Non"], provisional: "Non" },
  history: { key: "KIB-12", to: "Client", title: "Faut-il garder l'historique des tickets supprimés ?", by: "opus-dev-1", age: "il y a 1 h", ctx: "Aujourd'hui un ticket supprimé disparaît de l'historique. On peut le garder 30 jours dans une corbeille.", options: ["Oui, corbeille de 30 jours", "Non, suppression définitive"], sent: "envoyée il y a 2 j" },
  rules: { key: "KIB-16", to: "Client", title: "Le client modifie-t-il lui-même les règles d'automatisation ?", by: "opus-dev-3", age: "il y a 2 j", ctx: "Si oui, il faut un éditeur de règles dans l'interface ; sinon un fichier suffit.", options: ["Oui, dans l'interface", "Non, Adam les écrit"] },
};
const PASTED = "Oui pour les règles simples (statut, assignation). Les règles qui touchent la facturation restent chez Adam.\n— Claire, côté client";
const TITLES = { "KIB-14": "Récepteur de hooks Claude Code", "KIB-12": "Schéma Loro des tickets (LoroTree)", "KIB-16": "Moteur de règles déclaratif" };
const RECIP = (n) => [["Tous", n[0]], ["Moi (technique)", n[1]], ["Produit", n[2]], ["Client", n[3]], ["Design", n[4]]];

// ---------- Primitives : barre et fil ----------
const brandIcon = (b) => { penpotUtils.findShapes(x => x.strokes?.length, b.children.find(k => /^icon/.test(k.name)) || b).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: C.brand }))); return b; };
const topbar = (f) => { S.topAction(f, "Partager", "outline", "share2"); brandIcon(S.topAction(f, "Agent de projet", "ghost", "sparkles")); };
const chip = (p, [a, k, st, extra]) => { const s = S.row(p, { name: "RunChip-" + a, gap: 6, hs: "auto" }); S.dot(s, RUNCOL[st](), 7); mention(s, a, { size: 11 });
  S.txt(s, k + " · ", { size: 11, color: C.mfg }); S.txt(s, extra, { size: 11, color: st === "waiting" ? C.amber : C.mfg }); s.flex.columnGap = 4; return s; };
const barRuns = (bar) => { [...bar.children].forEach(k => k.remove()); bar.flex.columnGap = 10; S.icon(bar, "bot", 14, C.fg); S.txt(bar, "Agents", { size: 12, weight: 500 });
  S.slotsMini(bar, 3, 3); S.txt(bar, "3/3 · 3 en file", { size: 11, color: C.mfg });
  chip(bar, ["opus-dev-1", "KIB-12", "running", "12m"]); chip(bar, ["opus-dev-3", "KIB-16", "running", "2/5 · Corriger la validation"]); chip(bar, ["sonnet-review", "KIB-7", "running", "1m"]);
  S.box(bar, { name: "sep", fill: C.border, w: 1, h: 16 }); chip(bar, ["opus-dev-2", "KIB-14", "waiting", "attend"]); S.button(bar, "Répondre", "brand", { sm: true });
  S.spacer(bar); S.dot(bar, C.green, 6); S.txt(bar, "Kibo · connecté", { size: 11, color: C.mfg }); S.icon(bar, "chevUp", 14, C.mfg); return bar; };
const stepTag = (p, t) => S.badge(p, t, C.fg, { round: true });
const actRow = (p, [ic, verb, path, res]) => { const c = S.col(p, { gap: 2 }); const r = S.row(c, { name: "Action", gap: 10 }); S.icon(r, ic, 13, ic === "x" ? C.red : C.mfg);
  const v = S.box(r, { name: "verb", w: 90, dir: "row", vs: "auto" }); S.txt(v, verb, { size: 12, color: C.mfg }); S.fillX(S.txt(r, path, { size: 12, mono: true }));
  const m = /^\+(\d+) −(\d+)$/.exec(res); if (m) { S.txt(r, "+" + m[1], { size: 12, mono: true, color: C.green }); S.txt(r, "−" + m[2], { size: 12, mono: true, color: C.red }); }
  else S.txt(r, res, { size: 12, mono: true, color: C.red }); const d = S.row(c, { gap: 6, pad: [0, 0, 0, 23] }); S.icon(d, "chevRight", 11, C.mfg); S.txt(d, "Voir le détail", { size: 12, color: C.mfg }); return c; };
const actions = (p, m, open) => { const a = S.box(p, { name: "Actions", fill: C.muted, radius: 6, dir: "column", gap: 8, pad: [7, 12], vs: "auto" }); S.fillX(a);
  const h = S.row(a, { gap: 8 }); S.icon(h, open ? "chevDown" : "chevRight", 12, m.err ? C.red : C.mfg); S.fillX(S.txt(h, m.sum, { size: 12, color: m.err ? C.red : C.mfg }));
  if (open) ACTS.forEach(x => actRow(a, x)); return a; };
const questionBox = (p, [time, text]) => { const b = S.box(p, { name: "AgentQuestion", radius: 8, dir: "column", gap: 6, pad: [10, 12], vs: "auto" }); S.fillX(b);
  b.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 0.6 }];
  const h = S.row(b, { gap: 8 }); S.txt(h, time, { size: 12, mono: true, color: C.mfg }); S.txt(h, "Question de l'agent", { size: 12, color: C.mfg }); S.fillX(S.txt(b, text, { size: 13, lh: 1.4 })); return b; };
const moment = (p, m, o = {}) => { if (m.notice) return notice(p, m.notice); if (m.question) return questionBox(p, m.question);
  const c = S.col(p, { name: "Moment", gap: 8 }); const h = S.row(c, { gap: 8 }); S.txt(h, m.time, { size: 12, mono: true, color: C.mfg }); stepTag(h, m.step);
  if (m.reason) { const r = S.row(c, { name: "Reasoning", gap: 10, align: "start", pad: [0, 0, 0, 2] }); S.box(r, { name: "rule", fill: C.border, w: 2, h: 40 });
    const v = S.col(r, { gap: 4 }); S.txt(v, "Raisonnement", { size: 12, color: C.mfg }); S.fillX(S.txt(v, m.reason, { size: 13, color: C.mfg, lh: 1.4 })); return c; }
  S.fillX(S.txt(c, m.text, { size: 13, lh: 1.45, weight: 500 })); if (m.sum) actions(c, m, o.open === m); return c; };
const fil = (p, items, o = {}) => { const c = S.col(p, { name: "Thread", gap: o.gap ?? 12 }); items.forEach(m => moment(c, m, o)); return c; };
const replyBox = (p) => { const c = S.col(p, { name: "Reply", gap: 6 }); S.txt(c, "Répondre", { size: 12, color: C.mfg });
  const b = S.box(c, { name: "ReplyInput", fill: C.bg, stroke: C.brand, radius: 8, dir: "row", gap: 10, pad: [6, 6, 6, 12], vs: "auto", align: "center" }); S.fillX(b);
  S.fillX(S.txt(b, "Ta réponse…", { size: 13, color: C.dim })); S.txt(b, "Reprend la session", { size: 12, color: C.mfg }); S.button(b, "Envoyer", "brand", { sm: true }).opacity = 0.5; return c; };
const filHead = (p, o = {}) => { const h = S.row(p, { gap: 8 }); S.icon(h, "bot", 14, C.brand); S.txt(h, "opus-dev-2", { size: 13, mono: true, weight: 600 });
  S.txt(h, "KIB-14", { size: 12, mono: true, color: C.mfg }); S.spacer(h); S.txt(h, "worktree kib-14 · 0s", { size: 12, mono: true, color: C.mfg });
  S.button(h, "Passer en review", "outline", { sm: true, icon: "eye" }); S.button(h, "Arrêter", "ghost", { sm: true, icon: "square" }); return h; };
const plan = (p, o = {}) => planBlock(p, PLAN, { n: "2/5", source: "ticket_progress", size: 13, pad: [5, 0], w: o.w });

// ---------- Compte rendu ----------
const sec = (p, t) => { S.box(p, { name: "gap", w: 1, h: 4 }); S.txt(p, t, { size: 12, color: C.mfg }); };
const dotList = (p, list) => list.forEach(t => { const r = S.row(p, { gap: 8, align: "start" }); S.txt(r, "•", { size: 13, lh: 1.45 }); S.fillX(S.txt(r, t, { size: 13, lh: 1.45 })); });
const reportBox = (p, o = {}) => { const c = S.col(p, { name: "Report", gap: 8 }); const h = S.row(c, { gap: 8 }); S.txt(h, o.title || "Compte rendu", { size: 13, weight: 600 }); if (o.sub) S.txt(h, o.sub, { size: 12, color: C.mfg });
  const b = S.panel(c, { name: "RunReport", gap: 4, pad: [10, 14, 14, 14], fill: C.bg }); sec(b, "Fait"); S.fillX(S.txt(b, REPORT.done, { size: 13, lh: 1.45 }));
  sec(b, "Décisions"); dotList(b, REPORT.decisions); sec(b, "À vérifier (2)"); dotList(b, REPORT.check); sec(b, "Fichiers (2)"); dotList(b, REPORT.files);
  S.txt(b, "1 fichier modifié non mentionné", { size: 12, color: C.red }); S.txt(b, "1 fichier cité sans modification", { size: 12, color: C.mfg });
  sec(b, "Suite"); S.fillX(S.txt(b, REPORT.next, { size: 13, lh: 1.45 })); return c; };

// ---------- 183 · Barre repliée ----------
S.draw[183] = async () => { const { frame: f } = await kanbanAt(PAGE, "183 · Barre des agents repliée", 0, 0); topbar(f);
  const bar = barRuns(find(f, "AgentStatusBar")); await wait(1200); const p = rel(f, bar); grip(f, p.x + Math.round(p.w / 2) - 20, p.y + 3); return f.id; };

// ---------- 184 · Volet trois colonnes ----------
const runItem = (p, [a, k, st, sub, t], on) => { const r = S.box(p, { name: "RunRow", fill: on ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [6, 8], vs: "auto" }); S.fillX(r);
  const h = S.row(r, { gap: 6 }); S.dot(h, st === "queued" ? C.cyan : RUNCOL[st](), 7); mention(h, a, { size: 12 }); S.fillX(S.txt(h, k, { size: 12, mono: true, color: C.mfg })); if (t) S.txt(h, t, { size: 12, mono: true, color: C.mfg });
  const l = S.row(r, { gap: 0, pad: [0, 0, 0, 13] }); S.txt(l, sub, { size: 12, color: st === "waiting" ? C.amber : C.mfg }); return r; };
S.draw[184] = async () => { const { frame: f } = await kanbanAt(PAGE, "184 · Volet des agents : runs, fil, plan", 2, 0); topbar(f); barRuns(find(f, "AgentStatusBar"));
  const H = 470; const d = S.box(f, { name: "AgentDrawer", fill: C.card, stroke: C.border, w: 1192, h: H, dir: "column", gap: 0 }); shadow(d, 0.3); abs(f, d, 248, 940 - H); d.clipContent = true;
  const h = S.row(d, { name: "DrawerBar", gap: 10, pad: [12, 16], fill: C.sidebar }); S.icon(h, "bot", 14, C.fg); S.txt(h, "Agents", { size: 13, weight: 500 }); S.slotsMini(h, 3, 3);
  S.txt(h, "3/3 places · 3 en file · 1 attend une réponse", { size: 12, color: C.mfg }); S.spacer(h); S.button(h, "Lancer un agent", "outline", { sm: true, icon: "plus" }); S.icon(h, "chevDown", 14, C.mfg); hline(d);
  grip(d, 576, 4); const body = S.row(d, { name: "Columns", gap: 0, align: "start" }); S.child(body, { v: "fill" });
  const l = S.box(body, { name: "Runs", w: 290, dir: "column", gap: 4, pad: 12, vs: "auto" }); label(l, "Actifs · 4"); RUNS.forEach(r => runItem(l, r, r[0] === "opus-dev-2"));
  S.box(l, { name: "gap", w: 1, h: 8 }); label(l, "En file · 3"); QUEUE.forEach(([a, k, t]) => runItem(l, [a, k, "queued", t]));
  const m = S.col(body, { name: "Fil", gap: 12, pad: [12, 16] }); S.child(m, { v: "fill" }); m.clipContent = true; m.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  filHead(m); fil(m, [M.fix, M.ask], { open: M.fix }); replyBox(m);
  const r = S.box(body, { name: "PlanCol", w: 300, dir: "column", gap: 4, pad: 12, vs: "auto" }); plan(r); S.frontAbs(f); return f.id; };

// ---------- 185 · Fiche ticket, onglet Activité ----------
const ticketHead = (p, o = {}) => { const h = S.row(p, { gap: 6 }); S.fillX(S.txt(h, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(h, "more"); if (o.close) iconButton(h, "x");
  S.txt(p, "Récepteur de hooks Claude Code", { size: 18, weight: 600 }); input(p, "Ajouter une étiquette", { w: 192, size: 12, placeholder: true });
  const a = S.row(p, { gap: 8 }); orangeButton(a, "Assigner à un agent", "bot");
  const tc = S.col(p, { name: "SheetTabs", gap: 0 }); const tabs = S.row(tc, { gap: 0 });
  [["Détails"], ["Activité", true]].forEach(([t, on]) => { const c = S.box(tabs, { name: "Tab-" + t, dir: "column", gap: 8, pad: [0, 12], hs: "auto", vs: "auto" }); S.txt(c, t, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : C.mfg });
    S.fillX(S.box(c, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 })); }); hline(tc); return h; };
const runHead = (p, [run, who, when, state, st], o = {}) => { const r = S.row(p, { name: "RunHead", gap: 8 }); if (o.chev) S.icon(r, "chevDown", 13, C.mfg); S.dot(r, RUNCOL[st](), 8);
  S.txt(r, run, { size: 13, weight: 600 }); S.txt(r, who, { size: 12, mono: true, color: C.mfg }); S.txt(r, when, { size: 12, color: C.mfg }); S.spacer(r); S.txt(r, state, { size: 12, color: st === "waiting" ? C.brand : C.mfg }); return r; };
const indent = (p) => { const c = S.col(p, { name: "RunBody", gap: 12, pad: [0, 0, 4, 16] }); c.strokes = []; return c; };
const RUN3 = ["Run 3", "opus-dev-2", "aujourd'hui 10:37", "Attend une réponse", "waiting"];
const RUN2 = ["Run 2", "opus-dev-2", "hier 17:52 → 18:40", "Fait, 2 points à vérifier, 1 fichier non mentionné", "done"];
const RUN1 = ["Run 1", "opus-dev-1", "7 oct. 10:04 → 10:31", "Annulé · Pas de compte rendu pour ce run", "failed"];
S.draw[185] = async () => { const r = await appScreen(PAGE, "185 · Fiche ticket en page, Activité large", 6, 0, "Tickets", ["Kibo", "KIB-14"], ["ticket", "Kibo · KIB-14"]); const { frame: f, content: c } = r;
  topbar(f); f.resize(1440, 1420); c.flex.rowGap = 12; ticketHead(c); reportBox(c, { sub: "Run 2 · opus-dev-2" });
  const row = S.row(c, { name: "ActivityRow", gap: 24, align: "start" }); const t = S.col(row, { name: "Timeline", gap: 12 }); label(t, "Chronologie · plan et fil mêlés");
  runHead(t, RUN3); fil(indent(t), [{ notice: "Kibo a rappelé de déclarer le plan" }, M.read, M.fix, M.ask, M.q]);
  runHead(t, RUN2); fil(indent(t), [M.r2a, M.r2b]); runHead(t, RUN1);
  const side = S.panel(row, { name: "PlanSide", gap: 4, pad: 14, w: 288 }); plan(side); return f.id; };
S.draw["185b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "185b · Fiche étroite, Activité empilée", 4, 0); topbar(f); S.overlay(f);
  const sh = S.box(f, { name: "Sheet", fill: C.bg, stroke: C.border, w: 560, h: 940, dir: "column", gap: 12, pad: [24, 20] }); shadow(sh); abs(f, sh, 880, 0); sh.clipContent = true;
  ticketHead(sh, { close: true }); reportBox(sh, { sub: "Run 2 · opus-dev-2" }); plan(sh); label(sh, "Chronologie des runs"); runHead(sh, RUN3, { chev: true });
  fil(indent(sh), [{ notice: "Kibo a rappelé de déclarer le plan" }, M.read, M.fix]); S.frontAbs(f); return f.id; };

// ---------- 186 · Mention d'agent : carte, volet, page ----------
const hoverCard = (f, x, y) => { const c = S.box(f, { name: "AgentHoverCard", fill: C.card, stroke: C.border, radius: 8, w: 288, dir: "column", gap: 8, pad: 12, vs: "auto" }); shadow(c); abs(f, c, x, y);
  const h = S.row(c, { gap: 8 }); S.dot(h, C.amber, 8); S.txt(h, "opus-dev-2", { size: 13, mono: true, weight: 600 }); S.txt(h, "Attend une réponse", { size: 12, color: C.amber });
  S.txt(c, "KIB-14 · Récepteur de hooks Claude Code", { size: 12, color: C.mfg }); S.txt(c, "2/5 · Corriger la validation du corps", { size: 12, weight: 500 });
  S.txt(c, "Attend une réponse", { size: 12, color: C.amber }); S.fillX(S.txt(c, "Un test échoue encore : quel port veux-tu pour le récepteur ?", { size: 12, color: C.mfg, lh: 1.4 }));
  const ft = S.row(c, { gap: 8 }); S.button(ft, "Voir l'historique", "outline", { sm: true }); return c; };
S.draw[186] = async () => { const { frame: f, content } = await kanbanAt(PAGE, "186 · Mention d'agent : carte au survol", 0, 1); topbar(f); await wait(1500);
  const cd = find(content, "TicketCard / KIB-14"); const ag = cd && cd.children.find(k => k.name === "agent"); const p = rel(f, ag || cd);
  if (ag) { const hl = S.box(f, { name: "MentionHover", stroke: C.mfg, radius: 999, w: p.w + 4, h: p.h + 4 }); abs(f, hl, p.x - 2, p.y - 2); }
  hoverCard(f, p.x - 8, p.y + p.h + 8); S.frontAbs(f); return f.id; };
const agentHead = (p, o = {}) => { const h = S.row(p, { gap: 12 }); const av = S.box(h, { name: "AgentAvatar", fill: C.brandSoft, radius: 999, w: o.sz || 36, h: o.sz || 36, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", 18, C.brand);
  const c = S.col(h, { gap: 3 }); const r = S.row(c, { gap: 8 }); S.txt(r, "opus-dev-2", { size: o.big || 17, mono: true, weight: 600 }); S.badge(r, "Attend une réponse", C.amber, { round: true, stroke: C.amber, dot: C.amber });
  S.txt(c, o.short ? "Profil opus-dev · KIB-14 · worktree kib-14" : "Profil opus-dev · KIB-14 · Récepteur de hooks Claude Code", { size: 12, color: C.mfg }); return h; };
S.draw["186b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "186b · Mention d'agent : volet latéral", 2, 1); topbar(f);
  const W = 520; const pn = S.box(f, { name: "AgentSidePanel", fill: C.bg, stroke: C.border, w: W, h: 848, dir: "column", gap: 0 }); shadow(pn, 0.35); abs(f, pn, 1440 - W, 92); pn.clipContent = true;
  const h = S.row(pn, { gap: 8, pad: [10, 12, 10, 14] }); const a = agentHead(h, { sz: 32, short: true }); S.child(a, { h: "fill" }); S.button(h, "Ouvrir en grand", "outline", { sm: true, icon: "maximize" }); iconButton(h, "x"); hline(pn);
  const b = S.col(pn, { name: "Body", gap: 12, pad: [12, 14] }); S.child(b, { v: "fill" }); plan(b); hline(b); label(b, "Fil narratif");
  fil(b, [{ notice: "Kibo a rappelé de déclarer le plan" }, M.read, M.fix, M.ask, M.q], { gap: 10 }); reportBox(b, { title: "Compte rendu du run précédent" }); S.frontAbs(f); return f.id; };
const historyList = (p) => { const c = S.col(p, { name: "RunsHistory", gap: 2 }); label(c, "Historique des runs"); S.box(c, { name: "gap", w: 1, h: 6 });
  HISTORY.forEach(([a, k, st, col, when, on]) => { col = C[col]; const it = S.box(c, { name: "RunItem", fill: on ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [7, 8], vs: "auto" }); S.fillX(it);
    const r = S.row(it, { gap: 6 }); S.dot(r, col, 7); S.txt(r, a, { size: 12, mono: true, weight: 600 }); S.txt(r, k, { size: 12, mono: true, color: C.mfg });
    const l = S.row(it, { gap: 6, pad: [0, 0, 0, 13] }); S.fillX(S.txt(l, st, { size: 12, color: col })); S.txt(l, when, { size: 11, mono: true, color: C.dim }); }); return c; };
S.draw["186c"] = async () => { const r = await appScreen(PAGE, "186c · Page dédiée d'un agent", 4, 1, "Agents", ["Agents", "opus-dev-2"], ["bot", "Agents · opus-dev-2"]); const { frame: f, content: c } = r;
  S.activate(f, "Agents"); topbar(f); c.flex.rowGap = 16; const h = S.row(c, { gap: 12 }); const a = agentHead(h, { sz: 40 }); S.child(a, { h: "fill" });
  S.button(h, "Répondre", "brand", { sm: true }); S.button(h, "Arrêter le run", "outline", { sm: true, icon: "square" });
  const cols = S.row(c, { name: "Columns", gap: 16, align: "start" }); const l = S.box(cols, { name: "Runs", w: 240, dir: "column", gap: 4, vs: "auto" }); historyList(l);
  const m = S.panel(cols, { name: "Fil", gap: 12, pad: 16, fillX: false }); S.child(m, { h: "fill" });
  const mh = S.row(m, { gap: 8 }); S.txt(mh, "Fil narratif · run 3", { size: 13, weight: 600 }); S.fillX(S.txt(mh, "KIB-14 · worktree kib-14 · depuis 10:37", { size: 12, color: C.mfg })); S.check(mh, true, "Afficher le raisonnement");
  fil(m, [{ notice: "Kibo a rappelé de déclarer le plan" }, M.read, M.fix, M.why, M.ask, M.q], { open: M.fix });
  const side = S.box(cols, { name: "Side", w: 330, dir: "column", gap: 14, vs: "auto" }); const pl = S.panel(side, { gap: 4, pad: 14 }); plan(pl);
  const rp = S.panel(side, { gap: 8, pad: 14 }); reportBox(rp, { title: "Compte rendu du run précédent", sub: "run 2" });
  await wait(1500); penpotUtils.findShapes(x => /brand/.test(x.name), h).forEach(x => { x.flex.leftPadding = 11; x.flex.leftPadding = 10; }); return f.id; };

// ---------- 187 · Questions ----------
const delBtn = (p) => { const b = S.button(p, "Supprimer", "ghost", { sm: true, icon: "trash" }); b.children.filter(k => k.type === "text").forEach(t => t.fills = [{ fillColor: C.mfg, fillOpacity: 1 }]); return b; };
const qCard = (p, q, o = {}) => { const card = S.panel(p, { name: "Question", gap: 10, pad: [12, 14] });
  const h = S.row(card, { gap: 8 }); S.fillX(S.txt(h, q.title, { size: 13, weight: 600 })); if (q.blocking) S.badge(h, "bloquante", C.brand, { round: true, stroke: C.brand }); delBtn(h);
  const m = S.row(card, { gap: 8 }); recipient(m, q.to, { open: o.menu }); S.txt(m, "posée par", { size: 11, color: C.dim }); mention(m, q.by, { size: 11 }); S.txt(m, q.age, { size: 11, color: C.dim });
  if (q.sent || o.sent) { const s = S.row(m, { gap: 4, hs: "auto" }); S.icon(s, "send", 11, C.mfg); S.txt(s, o.sent || q.sent, { size: 11, color: C.mfg }); }
  if (q.ctx) S.fillX(S.txt(card, q.ctx, { size: 12, color: C.mfg, lh: 1.4 }));
  const opt = S.row(card, { gap: 10 }); S.txt(opt, "Options : " + q.options.join(" · "), { size: 11, color: C.mfg }); if (q.provisional) S.txt(opt, "provisoire : " + q.provisional, { size: 11, color: C.mfg });
  if (o.answer) { const a = S.col(card, { gap: 4, pad: [10, 12], fill: C.muted, radius: 8 }); S.fillX(S.txt(a, "Réponse : " + o.answer, { size: 13, weight: 600, lh: 1.4 }));
    const r = S.row(a, { gap: 8 }); S.txt(r, "Répondu par Adam · à l'instant", { size: 11, color: C.mfg }); toTransmit(r); return card; }
  const b = S.row(card, { gap: 8 }); if (q.provisional) orangeButton(b, "Valider le choix provisoire", "check"); q.options.forEach(x => S.button(b, x, "outline", { sm: true }));
  const t = S.row(card, { gap: 8 }); input(t, "Autre réponse…", { placeholder: true, size: 12 }); S.button(t, "Répondre", "secondary", { sm: true }).opacity = 0.6;
  const ft = S.row(card, { gap: 8 }); S.spacer(ft); S.button(ft, "Exporter", "outline", { sm: true, icon: "upload" }); if (!o.paste) orangeButton(ft, "Coller la réponse", "clipboardPaste");
  if (o.paste) { const f = S.col(card, { name: "PasteAnswer", gap: 6 }); S.txt(f, "Réponse reçue", { size: 12, weight: 500 }); input(f, PASTED, { h: 64, focus: true });
    help(f, "Enregistrée comme ta réponse ; « Transmettre à l'agent » l'envoie ensuite."); const fr = S.row(f, { gap: 8 }); S.spacer(fr); S.button(fr, "Annuler", "outline", { sm: true }); S.button(fr, "Enregistrer", "secondary", { sm: true }); }
  return card; };
const qGroup = (c, key, qs, o = {}) => { const h = S.row(c, { gap: 8, pad: [4, 0, 0, 0] }); S.txt(h, key, { size: 11, mono: true, color: C.mfg }); S.txt(h, TITLES[key], { size: 13, weight: 600 }); S.spacer(h);
  if (o.transmit) orangeButton(h, "Transmettre à l'agent (" + o.transmit + ")", "send"); return qs.map(([q, qo]) => qCard(c, q, qo || {})); };
const qPage = async (name, col, row, on, o = {}) => { const r = await appScreen(PAGE, name, col, row, null, ["Kibo", "Questions"], ["messageQuestion", "Kibo · Questions"]); addNav(r.frame); S.fixIconOrder(r.frame); topbar(r.frame);
  const c = r.content; c.flex.rowGap = 12; const t = S.row(c, { gap: 8 }); segmented(t, ["Ouvertes", "Répondues", "Toutes"], o.view || "Ouvertes"); select(t, "Tous les tickets");
  S.spacer(t); S.button(t, "Nouvelle question", "secondary", { sm: true, icon: "plus" });
  const fr = S.row(c, { name: "RecipientFilter", gap: 6 }); RECIP(o.counts || [9, 4, 3, 2, 0]).forEach(([n, k]) => { const b = S.box(fr, { name: "Filter-" + n, fill: n === on ? C.accent : null, stroke: n === on ? C.mfg : C.border, radius: 6, dir: "row", gap: 6, pad: [5, 10], hs: "auto", vs: "auto", align: "center" });
    S.txt(b, n, { size: 12, weight: n === on ? 600 : 400 }); S.txt(b, String(k), { size: 12, color: C.mfg }); });
  const add = S.row(fr, { gap: 4, hs: "auto", pad: [0, 6] }); S.icon(add, "plus", 12, C.fg); S.txt(add, "Destinataire", { size: 12, weight: 500 }); S.spacer(fr);
  if (on !== "Tous") S.button(fr, "Exporter tout (" + (o.exportN || 2) + ")", "outline", { sm: true, icon: "upload" }); hline(c); return r; };
S.fixVisNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^187/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), a = S.fx.item(f, "Notes"), it = S.fx.item(f, "Questions");
  if (!sb || !a || !it) return n; sb.insertChild(0, it); sb.insertChild(sb.children.findIndex(x => x.id === a.id) + 1, it); return n + 1; }, 0);
S.fixVisLogos = () => penpot.currentPage.root.children.filter(c => c.type === "board").reduce((n, f) => { const ws = find(f, "WorkspaceSwitcher"); const logo = ws && ws.children.find(c => c.name === "logo");
  if (!logo || Math.abs(logo.x - f.x) < 100) return n; ws.insertChild(0, logo); return n + 1; }, 0);
S.draw[187] = async () => { const { frame: f, content: c } = await qPage("187 · Questions : destinataires, filtre Tous", 0, 2, "Tous");
  const [, read] = qGroup(c, "KIB-14", [[QS.port], [QS.read, { menu: true }]]); qGroup(c, "KIB-16", [[QS.rules]]);
  await wait(1800); const m = find(read, "RecipientMenu"); const p = rel(f, m);
  const lb = listbox(f, p.x, p.y + p.h + 6, [["Moi (technique)", false, s => S.icon(s, "user", 13, C.mfg), { hint: "4" }], ["Produit", true, s => S.icon(s, "user", 13, C.mfg), { hint: "proposé par l'agent" }],
    ["Client", false, s => S.icon(s, "user", 13, C.mfg), { hint: "2" }], ["Design", false, s => S.icon(s, "user", 13, C.mfg), { hint: "0" }]], 300); S.frontAbs(f); await wait(2500); lb.x = m.x; lb.y = m.y + m.height + 6; return f.id; };
S.draw["187b"] = async () => { const { frame: f, content: c } = await qPage("187b · Questions : filtre Client, exporter tout", 2, 2, "Client");
  qGroup(c, "KIB-12", [[QS.history]]); qGroup(c, "KIB-16", [[QS.rules]]); return f.id; };
S.draw["187c"] = async () => { const { frame: f, content: c } = await qPage("187c · Questions : coller la réponse", 4, 2, "Client");
  qGroup(c, "KIB-12", [[{ ...QS.history, ctx: null }]]); qGroup(c, "KIB-16", [[{ ...QS.rules, ctx: null }, { paste: true }]]); return f.id; };
S.draw["187d"] = async () => { const { frame: f, content: c } = await qPage("187d · Projet : destinataires des questions", 6, 2, "Tous", { view: "Toutes" });
  qGroup(c, "KIB-14", [[QS.port]]); qGroup(c, "KIB-16", [[QS.rules]]);
  const d = formDialog(f, "Modifier le projet", 448); d.flex.rowGap = 14;
  labeled(d, "Nom", c => input(c, "Kibo", { focus: true })); labeled(d, "Couleur", c => swatches(c, ["#F97316", "#6366F1", "#EC4899", "#84CC16", "#D946EF", "#64748B"], "#F97316"));
  labeled(d, "Dossier", c => input(c, "~/code/kibo", { mono: true, size: 12 }), { help: "Le dossier reste sur ta machine. Vide pour délier." });
  labeled(d, "Storybook", c => input(c, "http://localhost:6006", { mono: true, size: 12 }));
  const s = S.col(d, { gap: 6 }); S.txt(s, "Destinataires des questions", { size: 13, weight: 600 }); help(s, "L'agent propose un destinataire en posant sa question ; tu le corriges d'un clic. Les questions s'exportent en texte.");
  const list = S.panel(d, { gap: 0, pad: [0, 12] }); [["Moi (technique)", "4 questions ouvertes", true], ["Produit", "3 questions ouvertes"], ["Client", "2 questions ouvertes"], ["Design", "aucune question ouverte"]].forEach(([n, sub, def], i) => {
    if (i) hline(list); const r = S.row(list, { name: "Recipient-" + n, gap: 10, pad: [9, 0] }); S.icon(r, "user", 14, C.mfg); const c = S.col(r, { gap: 2 }); const t = S.row(c, { gap: 6 });
    S.txt(t, n, { size: 13, weight: 500 }); if (def) S.badge(t, "par défaut", C.fg, { round: true }); S.txt(c, sub, { size: 11, color: C.mfg }); iconButton(r, "pencil"); if (!def) iconButton(r, "trash"); });
  const add = S.row(d, { gap: 8 }); input(add, "Juridique, Design…", { placeholder: true }); S.button(add, "Ajouter", "outline", { sm: true, icon: "plus" });
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f); return f.id; };

// ---------- 188 · Graphe (version finale de 32e, sur la page 29, sous les écrans 183 à 187d) ----------
const ROWS = 3;
S.grapheScreen = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, "Graphe", ["Kibo", "Graphe"], ["graph", "Kibo · Graphe"]); await S.g32e.relayLogos(r.frame); topbar(r.frame);
  const c = r.content; c.flex.rowGap = 8; const tb = S.row(c, { gap: 8 }); segmented(tb, ["Vagues", "Hiérarchique"], "Vagues"); S.button(tb, "Chemin critique", "outline", { sm: true, icon: "waypoints" });
  S.button(tb, o.shown ? "Masquer les terminés" : "Afficher les terminés (31)", "outline", { sm: true }); S.button(tb, "Démarrables", o.startable ? "secondary" : "outline", { sm: true, icon: "listFilter" });
  S.button(tb, "Filtrer", "outline", { sm: true, icon: "filter" }); S.button(tb, o.group ? "Affichage · chapitre:" : "Affichage", "outline", { sm: true, icon: "sliders" }); S.spacer(tb);
  S.txt(tb, "69 tickets · 38 ouverts · 6 démarrables", { size: 12, color: C.mfg }); const info = S.row(c, { gap: 10 });
  if (!o.group) S.txt(info, "24 liens implicites masqués (survol pour les voir)", { size: 12, color: C.mfg }); S.txt(info, "Chemin critique : 5 tickets · 1 bloqué", { size: 12, color: C.mfg });
  const g = S.box(c, { name: "Canvas", fill: C.bg, stroke: C.border, radius: 10, w: 1144, h: 690 }); g.clipContent = true; minimap(g); legend(g); return { ...r, g }; };
const minimap = (g) => { const m = S.box(g, { name: "Minimap", fill: C.card, stroke: C.border, radius: 6, w: 150, h: 96 }); penpotUtils.setParentXY(m, 1144 - 166, 540);
  [10, 8, 6, 4, 3].forEach((n, j) => { for (let i = 0; i < n; i++) { const b = S.box(m, { name: "mini", fill: C.mfg, op: 0.5, w: 20, h: 4 }); penpotUtils.setParentXY(b, 10 + j * 27, 8 + i * 8); } });
  const v = S.box(m, { name: "viewport", stroke: C.fg, w: 130, h: 70 }); penpotUtils.setParentXY(v, 6, 4); return m; };
S.grapheLegend = () => null;
const legend = (g) => { const l = S.panel(g, { name: "Legend", gap: 6, pad: [8, 12], radius: 8, w: 150 });
  [["Bloque", 1, C.mfg], ["Chemin critique", 2, C.fg], ["Lié à", 1, C.mfg, true]].forEach(([t, h, col, dash]) => { const r = S.row(l, { gap: 8 }); const s = S.box(r, { name: "line", w: 22, h, dir: "row", gap: 3 });
    if (dash) [0, 1, 2, 3].forEach(() => S.box(s, { name: "dash", fill: col, w: 4, h: 1 })); else s.fills = [{ fillColor: col, fillOpacity: 1 }]; S.txt(r, t, { size: 11, color: C.mfg }); });
  penpotUtils.setParentXY(l, 1144 - 166 - 166, 560); return l; };
S.graphePage = PAGE; await S.load("32e-graphe-lisible.js"); S.graphePage = null;
const shift = (fn, post) => async () => { const id = await fn(); const f = penpot.currentPage.getShapeById(id); f.y = f.y + ROWS * 1040; if (post) await post(f); return id; };
const startOn = (f, key) => { const cd = find(f, "TicketCard / " + key); const meta = cd && cd.children.find(x => x.name === "meta"); if (meta) S.g32e.startable(meta); };
const g = S.draw;
S.draw[188] = shift(g[188]); S.draw["188b"] = shift(g["188b"]); S.draw["188c"] = shift(g["188c"], async (f) => { const m = find(f, "ContextMenu"); const t = penpotUtils.findShape(x => x.type === "text" && x.characters === "Affichage · chapitre:", f); const b = t && t.parent;
  if (m && b) { m.x = b.x; m.y = b.y + b.height + 4; } }); S.draw["188d"] = shift(g["188d"]);
S.draw["188k"] = shift(g["188k"], async (f) => { topbar(f); startOn(f, "KIB-22"); });
S.VISIBILITE = [183, 184, "185b", 185, 186, "186b", "186c", 187, "187b", "187c", "187d"];
S.VIS_GRAPHE = [188, "188b", "188c", "188d", "188k"];
return "visibilite ok";
