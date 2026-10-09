// Page « 28 · Pistes visibilité agents » : pistes de maquettes (brainstorming), pas des écrans validés. Requiert 18-socle.js et 24-socle-suite.js.
// P1 barre repliée · P2-A/B volet déroulé · P3-A/B onglet Activité de la fiche · P4 mention d'agent (carte, volet, page) · P5 signaux vers l'agent de projet.
// Données : design/donnees-fictives.md (KIB-14 opus-dev-2, KIB-16 opus-dev-3…), complétées ici pour le plan, le fil et le compte rendu.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "28 · Pistes visibilité agents";
const { find, wait, shadow, abs, rel, hline, tooltip, appScreen, kanbanAt } = S.fx;
const { iconButton } = S.fx2;

Object.assign(S.ICONS, {
  messageQuestion: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  gripH: '<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
  bellRing: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/>',
});

// ---------- Données ----------
const ACTIVE = [
  { a: "opus-dev-3", t: "KIB-16", title: "Moteur de règles déclaratif", st: "running", n: "2/5", step: "Corriger la validation", min: "4 min" },
  { a: "opus-dev-1", t: "KIB-12", title: "Schéma Loro des tickets", st: "running", n: "3/5", step: "Tests de convergence", min: "12 min" },
  { a: "sonnet-review", t: "KIB-7", title: "Tokens shadcn + thème sombre", st: "running", n: "1/3", step: "Relire la PR #12", min: "1 min", internal: true },
  { a: "opus-dev-2", t: "KIB-14", title: "Récepteur de hooks Claude Code", st: "waiting", n: "4/5", step: "Attend une réponse", min: "3 min" }];
const DONE24 = [["sonnet-review", "KIB-11", "fait, 1 point à vérifier", "il y a 41 min"], ["opus-dev-2", "KIB-14", "fait, 2 points à vérifier", "hier 18:40"], ["opus-dev-1", "KIB-26", "fait", "hier 16:12"]];
const PLAN16 = [["done", "Relire le schéma des règles et ses tests", "1 moment"], ["doing", "Corriger la validation des conditions", "2 moments"], ["todo", "Tester les règles imbriquées"],
  ["blocked", "Brancher le moteur sur les transitions de statut", "attend KIB-12 (schéma Loro)"], ["todo", "Documenter le format des règles"]];
const PLAN14 = [["done", "Lire la doc des hooks de Claude Code", "run 1"], ["done", "Serveur HTTP local du récepteur", "run 2 · 3 moments"], ["done", "Valider les événements avec Zod", "run 2 · 2 moments"],
  ["blocked", "Choisir le port du récepteur", "question à Adam · run 3"], ["todo", "Tests d'intégration du récepteur"]];
const FIL16 = [{ notice: "14:01 · Kibo a rappelé de déclarer le plan" },
  { time: "14:01", step: "Étape 1", text: "Je commence par relire le schéma des règles et ses tests.", sum: "4 fichiers lus" },
  { time: "14:05", step: "Étape 2", text: "La validation laisse passer une condition vide (when: {}). Je la corrige dans validate.ts.", sum: "2 fichiers lus · 1 modifié · tests 12 ✓ 1 ✗",
    open: [["file", "Lu", "packages/core/src/rules/schema.ts", ""], ["file", "Lu", "packages/core/src/rules/validate.test.ts", ""], ["fileDiff", "Modifié", "packages/core/src/rules/validate.ts", "+8 −3"], ["terminal", "Commande", "bun test packages/core/src/rules", "12 ✓ 1 ✗"]] },
  { time: "14:09", step: "Étape 2", text: "Un test échoue encore : les règles imbriquées n'héritent pas du contexte du parent.", sum: "1 fichier modifié · tests en cours", running: true, reasoning: true }];
const FIL14 = [{ notice: "14:21 · Session reprise (run 2, 3 tours)" },
  { time: "14:22", step: "Étape 4", text: "Le port 7420 est codé en dur depuis le run 2. Je demande à Adam s'il préfère un port libre choisi au lancement.", sum: "2 fichiers lus · 1 question posée" },
  { signal: ["Ticket à créer", "« Tests du récepteur de hooks »", "14:26"] },
  { time: "14:29", step: "Étape 4", text: "J'attends ta réponse sur le port avant de continuer.", sum: "attend une réponse", waiting: true }];
const REPORT14 = { run: "Run 2 · hier 17:52 → 18:40",
  done: "Le récepteur écoute en local et met à jour l'état du run sur SessionStart, PostToolUse et Stop. Les hooks inconnus sont journalisés, sans erreur.",
  decisions: ["Port fixe 7420 gardé pour l'instant, parce que la question à Adam est encore ouverte.", "Corps des hooks validé par Zod côté démon, parce que Claude Code peut changer de format."],
  check: ["le redémarrage du démon pendant un run", "les hooks reçus en double"],
  files: [["packages/daemon/src/hooks/receiver.ts", "+112 −0"], ["packages/daemon/src/hooks/receiver.test.ts", "+86 −0"], ["packages/schema/src/hook-event.ts", "+31 −2"], ["packages/daemon/src/server.ts", "+6 −1"]],
  extra: "1 fichier modifié non mentionné : packages/daemon/src/config.ts",
  next: "Écrire les tests d'intégration du récepteur (ticket proposé à l'agent de projet)." };
const RUNS2 = [["Run 3", "KIB-14", "aujourd'hui 14:21", "Attend une réponse", "waiting"], ["Run 2", "KIB-14", "hier 17:52 → 18:40", "Fait · 2 points à vérifier", "done"], ["Run 1", "KIB-14", "7 oct · 10:04", "Interrompu · pas de compte rendu", "failed"]];
const LAST = "« Quel port pour le récepteur ? 7420, ou un port libre choisi au lancement. »";

// ---------- Primitives ----------
const RUNCOL = { running: () => C.blue, waiting: () => C.amber, done: () => C.green, failed: () => C.red };
const mention = (p, name, o = {}) => { const t = S.txt(p, name, { size: o.size || 12, mono: true, weight: o.weight || 600, color: o.color || C.fg }); t.textDecoration = "underline"; t.name = "AgentMention"; return t; };
const ring = (p, col, sz = 12) => { const d = penpot.createEllipse(); d.resize(sz, sz); d.fills = []; d.strokes = [{ strokeColor: col, strokeWidth: 1.5, strokeAlignment: "inner", strokeOpacity: 1 }]; d.name = "ring"; p.appendChild(d); return d; };
const glyph = (p, st) => { const b = S.box(p, { name: "StepGlyph", w: 16, h: 16, dir: "row", align: "center", justify: "center" });
  if (st === "done") S.icon(b, "circleCheck", 14, C.green); else if (st === "doing") S.spinner(b, C.blue, 14); else if (st === "blocked") S.icon(b, "circleX", 14, C.red); else ring(b, C.mfg, 12); return b; };
const progress = (p, n, w = 48) => { const [a, b] = n.split("/").map(Number); const r = S.row(p, { gap: 1, hs: "auto" }); for (let i = 0; i < b; i++) S.box(r, { name: "seg", fill: i < a ? C.fg : C.border, radius: 1, w: Math.round((w - (b - 1)) / b), h: 4 }); return r; };
const planStep = (p, [st, text, sub], o = {}) => { const r = S.row(p, { name: "PlanStep", gap: 8, align: "start", pad: o.pad ?? [5, 0] }); glyph(r, st);
  const c = S.col(r, { gap: 2 }); S.fillX(S.txt(c, text, { size: o.size || 13, lh: 1.35, color: st === "done" ? C.mfg : C.fg, weight: st === "doing" ? 500 : 400 }));
  if (sub && (!o.nosub || st === "blocked")) { const s = S.row(c, { gap: 4 }); if (/moment|run/.test(sub) && st !== "blocked") S.icon(s, "arrowRight", 11, C.dim); S.txt(s, sub, { size: 11, color: st === "blocked" ? C.red : C.dim }); } return r; };
const planBlock = (p, steps, o = {}) => { const c = S.col(p, { name: "Plan", gap: 2, w: o.w }); const h = S.row(c, { gap: 6, pad: [0, 0, 6, 0] }); S.icon(h, "listTodo", 14, C.mfg);
  S.txt(h, "Plan", { size: 13, weight: 600 }); S.txt(h, o.n || "2/5", { size: 12, mono: true, color: C.mfg }); S.spacer(h); if (o.source) S.txt(h, o.source, { size: 11, color: C.dim });
  if (o.sub) S.fillX(S.txt(c, o.sub, { size: 11, color: C.dim, lh: 1.35 })); steps.forEach(s => planStep(c, s, o)); return c; };
const notice = (p, t) => { const r = S.row(p, { name: "Notice", gap: 6, pad: [0, 0, 0, 2] }); S.icon(r, "bellRing", 12, C.dim); S.fillX(S.txt(r, t, { size: 11, color: C.dim })); return r; };
const actionRow = (p, [ic, verb, path, res]) => { const r = S.row(p, { name: "Action", gap: 8, pad: [3, 0] }); S.icon(r, ic, 13, C.mfg); const v = S.box(r, { name: "verb", w: 64, dir: "row", vs: "auto" }); S.txt(v, verb, { size: 11, color: C.dim });
  S.fillX(S.txt(r, path, { size: 11, mono: true })); if (res) { const m = /^\+(\d+) −(\d+)$/.exec(res); if (m) { S.txt(r, "+" + m[1], { size: 11, mono: true, color: C.green }); S.txt(r, "−" + m[2], { size: 11, mono: true, color: C.red }); }
    else S.txt(r, res, { size: 11, mono: true, color: /✗/.test(res) ? C.amber : C.green }); } return r; };
const signalLine = (p, [kind, what, time], o = {}) => { const r = S.row(p, { name: "SignalLine", gap: 8, pad: [6, 10], radius: 6, stroke: C.border });
  S.icon(r, "send", 13, C.brand); S.txt(r, o.compact ? "Signal" : "Signal à l'agent de projet", { size: 11, color: C.mfg }); S.badge(r, kind, C.fg, { round: true }); S.fillX(S.txt(r, what, { size: 12 })); S.txt(r, time, { size: 11, mono: true, color: C.dim }); return r; };
const moment = (p, m, o = {}) => { if (m.notice) return notice(p, m.notice); if (m.signal) return signalLine(p, m.signal, o);
  const c = S.col(p, { name: "Moment", gap: 6 }); const h = S.row(c, { gap: 6 }); S.icon(h, "bot", 13, C.brand); if (o.who) mention(h, o.who, { size: 11 });
  S.txt(h, m.time, { size: 11, mono: true, color: C.dim }); if (m.step) S.badge(h, m.step, C.mfg); if (m.waiting) S.badge(h, "Attend une réponse", C.amber, { stroke: C.amber });
  S.fillX(S.txt(c, m.text, { size: o.size || 13, lh: 1.45, weight: 500 })); if (o.compact) return c;
  const a = S.box(c, { name: "Actions", fill: C.muted, radius: 6, dir: "column", gap: 4, pad: [6, 10], vs: "auto" }); S.fillX(a);
  const ah = S.row(a, { gap: 6 }); S.icon(ah, m.open ? "chevDown" : "chevRight", 12, C.mfg); if (m.running) S.spinner(ah, C.blue, 12); S.fillX(S.txt(ah, m.sum, { size: 11, color: C.mfg }));
  if (m.open) m.open.forEach(x => actionRow(a, x));
  if (m.reasoning && !o.noReason) { const rr = S.row(c, { name: "Reasoning", gap: 6 }); S.icon(rr, "chevRight", 12, C.dim); S.icon(rr, "brain", 12, C.dim); S.txt(rr, "Afficher le raisonnement", { size: 11, color: C.dim }); }
  if (m.reasonText) { const rb = S.box(c, { name: "ReasoningText", stroke: C.border, radius: 6, dir: "column", gap: 4, pad: [8, 10], vs: "auto" }); S.fillX(rb);
    const rh = S.row(rb, { gap: 6 }); S.icon(rh, "chevDown", 12, C.dim); S.icon(rh, "brain", 12, C.dim); S.txt(rh, "Masquer le raisonnement", { size: 11, color: C.dim });
    S.fillX(S.txt(rb, m.reasonText, { size: 12, color: C.mfg, lh: 1.45 })); } return c; };
const thread = (p, items, o = {}) => { const c = S.col(p, { name: "Thread", gap: o.gap ?? 14, w: o.w }); items.forEach(m => moment(c, m, o)); return c; };
const label = (p, t) => S.txt(p, t.toUpperCase(), { size: 10, weight: 600, color: C.dim });
const bullets = (p, list, o = {}) => list.forEach(t => { const r = S.row(p, { gap: 6, align: "start" }); if (o.check) { const b = S.box(r, { name: "Checkbox", stroke: C.mfg, radius: 3, w: 12, h: 12 }); b.layoutChild.topMargin = 3; }
  else S.txt(r, "•", { size: 12, color: C.mfg, lh: 1.45 }); S.fillX(S.txt(r, t, { size: 12, lh: 1.45 })); });
const report = (p, R, o = {}) => { const b = S.panel(p, { name: "RunReport", gap: 10, pad: [12, 14], fill: C.bg });
  const h = S.row(b, { gap: 8 }); S.icon(h, "clipboard", 14, C.mfg); S.txt(h, "Compte rendu", { size: 13, weight: 600 }); S.fillX(S.txt(h, R.run, { size: 11, color: C.dim })); if (o.who) mention(h, o.who, { size: 11 });
  const cols = S.row(b, { gap: 16, align: "start" }); if (o.stack) { cols.flex.dir = "column"; cols.flex.rowGap = 10; }
  const l = S.col(cols, { gap: 6 }), r = o.stack ? l : S.col(cols, { gap: 6, w: 270 });
  label(l, "Fait"); S.fillX(S.txt(l, R.done, { size: 12, lh: 1.45 }));
  label(l, "Décisions"); bullets(l, R.decisions); label(l, "À vérifier"); bullets(l, R.check, { check: true });
  label(r, "Fichiers modifiés · " + R.files.length); R.files.forEach(([f, d]) => actionRow(r, ["fileDiff", "", f.split("/").slice(-2).join("/"), d]));
  r.children.filter(x => x.name === "Action").forEach(x => { const v = x.children.find(k => k.name === "verb"); if (v) v.remove(); });
  const w = S.row(r, { gap: 6, align: "start", pad: [6, 8], radius: 6, fill: "#1F1608" }); S.icon(w, "alert", 12, C.amber); S.fillX(S.txt(w, R.extra, { size: 11, color: C.amber, lh: 1.4 }));
  label(r, "Prochaine étape"); S.fillX(S.txt(r, R.next, { size: 12, lh: 1.45 })); return b; };
const noReport = (p) => { const r = S.row(p, { name: "NoReport", gap: 6, pad: [6, 10], radius: 6, stroke: C.border }); S.icon(r, "clipboard", 12, C.dim); S.txt(r, "Pas de compte rendu pour ce run", { size: 11, color: C.dim }); return r; };

// ---------- Barre et volet du pied de page ----------
const chip = (p, r, o = {}) => { if (o.tab) { const s = S.box(p, { name: "AgentTab-" + r.a, fill: o.fill || null, radius: 6, dir: "row", gap: 6, pad: [4, 8], hs: "auto", vs: "auto", align: "center" });
    S.dot(s, RUNCOL[r.st](), 7); mention(s, r.a, { size: 11 }); S.txt(s, r.t, { size: 11, mono: true, color: C.mfg }); S.txt(s, r.st === "waiting" ? "attend" : r.n, { size: 11, mono: r.st !== "waiting", color: r.st === "waiting" ? C.amber : C.mfg }); return s; } const s = S.box(p, { name: "RunChip-" + r.a, fill: o.fill || null, radius: 6, dir: "row", gap: 6, pad: [4, 8], hs: "auto", vs: "auto", align: "center" });
  S.dot(s, RUNCOL[r.st](), 7); mention(s, r.a, { size: 11 }); S.txt(s, r.t, { size: 11, mono: true, color: C.mfg }); if (r.st === "waiting") { S.txt(s, "· " + r.step, { size: 11, color: C.amber }); return s; }
  progress(s, r.n, 40); S.txt(s, r.n + " · " + r.step, { size: 11, color: C.mfg }); return s; };
const grip = (p, x, y) => { const g = S.box(p, { name: "ResizeGrip", fill: C.mfg, op: 0.6, radius: 999, w: 40, h: 4 }); if (g.layoutChild) g.layoutChild.absolute = true; penpotUtils.setParentXY(g, x, y); return g; };
const barContent = (bar, o = {}) => { [...bar.children].forEach(k => k.remove()); bar.fills = [{ fillColor: o.hover ? C.accent : C.sidebar, fillOpacity: 1 }]; bar.flex.columnGap = 8;
  if (o.hover) bar.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  S.icon(bar, "bot", 14, C.fg); S.txt(bar, "Agents", { size: 12, weight: 500 }); S.slotsMini(bar, 3, 3); S.txt(bar, "3 en file", { size: 11, color: C.mfg }); S.box(bar, { name: "sep", fill: C.border, w: 1, h: 16 });
  [ACTIVE[0], ACTIVE[1], ACTIVE[3]].forEach(r => chip(bar, r)); S.txt(bar, "+1", { size: 11, mono: true, color: C.mfg });
  S.spacer(bar); S.icon(bar, "chevDown", 14, C.mfg).rotation = 180; grip(bar, 576, 3); return bar; };
const drawerHead = (d) => { const h = S.row(d, { name: "DrawerBar", gap: 10, pad: [14, 16, 10, 16], fill: C.sidebar }); S.icon(h, "bot", 14, C.fg); S.txt(h, "Agents", { size: 13, weight: 500 });
  S.slotsMini(h, 3, 3); S.txt(h, "3/3 places · 3 en file · 1 attend une réponse", { size: 12, color: C.mfg }); S.spacer(h); S.button(h, "Lancer un agent", "outline", { sm: true, icon: "plus" }); S.icon(h, "chevDown", 14, C.mfg); hline(d); return h; };
const drawer = (f) => { const H = 430; const d = S.box(f, { name: "AgentDrawer", fill: C.card, stroke: C.border, w: 1192, h: H, dir: "column", gap: 0 }); shadow(d); abs(f, d, 248, 940 - H); d.clipContent = true;
  drawerHead(d); grip(d, 576, 4); return d; };
const runRow = (p, r, on) => { const row = S.box(p, { name: "RunRow", fill: on ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [6, 8], vs: "auto" }); S.fillX(row);
  const a = S.row(row, { gap: 6 }); S.dot(a, RUNCOL[r.st](), 7); mention(a, r.a, { size: 11 }); S.txt(a, r.t, { size: 11, mono: true, color: C.mfg }); S.spacer(a); S.txt(a, r.min, { size: 10, mono: true, color: C.dim });
  const b = S.row(row, { gap: 6, pad: [0, 0, 0, 13] }); if (r.st === "waiting") S.txt(b, r.step, { size: 11, color: C.amber }); else { progress(b, r.n, 40); S.fillX(S.txt(b, r.n + " · " + r.step, { size: 11, color: C.mfg })); }
  if (r.internal) { const c = S.row(row, { gap: 4, pad: [0, 0, 0, 13] }); S.txt(c, "plan interne de l'agent", { size: 10, color: C.dim }); } return row; };
const doneRow = (p, [a, t, s, when]) => { const r = S.row(p, { name: "DoneRow", gap: 6, pad: [5, 8] }); S.dot(r, C.green, 7); mention(r, a, { size: 11, weight: 500 });
  S.fillX(S.txt(r, t + " · " + s, { size: 11, color: C.mfg })); S.txt(r, when, { size: 10, color: C.dim }); return r; };
const runLists = (p, sel) => { label(p, "Actifs · 4"); ACTIVE.forEach(r => runRow(p, r, r.a === sel)); S.box(p, { name: "gap", w: 1, h: 6 }); label(p, "Terminés depuis 24 h · 3"); DONE24.forEach(r => doneRow(p, r)); };
const filHead = (p, r) => { const h = S.row(p, { gap: 8 }); S.icon(h, "bot", 14, C.brand); mention(h, r.a, { size: 13 }); S.txt(h, r.t + " · " + r.title, { size: 12, color: C.mfg }); S.spacer(h);
  S.txt(h, "worktree " + r.t.toLowerCase() + " · " + r.min, { size: 11, mono: true, color: C.dim }); return h; };

S.draw.p1 = async () => { const { frame: f } = await kanbanAt(PAGE, "P1 · Barre des agents repliée (survol)", 0, 0);
  const bar = barContent(find(f, "AgentStatusBar"), { hover: true }); await wait(1500);
  tooltip(f, 420, 940 - 40 - 36, "Clic n'importe où sur la barre : déplier · glisser le bord haut : redimensionner"); S.frontAbs(f); return f.id; };

S.draw.p2a = async () => { const { frame: f } = await kanbanAt(PAGE, "P2-A · Volet déroulé : trois colonnes", 2, 0); barContent(find(f, "AgentStatusBar")); const d = drawer(f);
  const body = S.row(d, { name: "Columns", gap: 0, align: "start" }); S.child(body, { v: "fill" });
  const l = S.box(body, { name: "Runs", w: 300, dir: "column", gap: 4, pad: 12, vs: "auto" }); runLists(l, "opus-dev-3");
  const m = S.col(body, { name: "Fil", gap: 12, pad: [12, 16] }); S.child(m, { v: "fill" }); m.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; m.clipContent = true;
  filHead(m, ACTIVE[0]); thread(m, [FIL16[0], ...FIL16.slice(2)], { gap: 10, size: 12 });
  const r = S.box(body, { name: "PlanCol", w: 300, dir: "column", gap: 4, pad: 12, vs: "auto" }); planBlock(r, PLAN16, { n: "2/5", source: "ticket_progress", size: 12, pad: [4, 0] });
  S.frontAbs(f); return f.id; };

S.draw.p2b = async () => { const { frame: f } = await kanbanAt(PAGE, "P2-B · Volet déroulé : un onglet par agent", 4, 0); barContent(find(f, "AgentStatusBar")); const d = drawer(f);
  const tabs = S.row(d, { name: "AgentTabs", gap: 4, pad: [6, 12] }); ACTIVE.forEach((r, i) => chip(tabs, r, { tab: true, fill: i === 0 ? C.accent : null }));
  S.spacer(tabs); const t = S.box(tabs, { name: "Tab-Terminés", radius: 6, dir: "row", gap: 6, pad: [4, 8], hs: "auto", vs: "auto", align: "center" }); S.dot(t, C.green, 7); S.txt(t, "Terminés depuis 24 h · 3", { size: 11, color: C.mfg }); hline(d);
  const band = S.row(d, { name: "PlanBand", gap: 10, pad: [8, 16], fill: C.bg }); S.icon(band, "listTodo", 13, C.mfg); S.txt(band, "Plan 2/5", { size: 12, weight: 600 }); progress(band, "2/5", 60);
  PLAN16.forEach(([st, txt]) => { const s = S.row(band, { gap: 4, hs: "auto" }); glyph(s, st); S.txt(s, txt.length > 26 ? txt.slice(0, 25) + "…" : txt, { size: 11, color: st === "doing" ? C.fg : st === "blocked" ? C.red : C.mfg }); });
  hline(d);
  const m = S.col(d, { name: "Fil", gap: 10, pad: [10, 16] }); S.child(m, { v: "fill" }); m.clipContent = true; filHead(m, ACTIVE[0]); thread(m, FIL16.slice(2), { gap: 10, size: 12 });
  hline(d); const ft = S.row(d, { name: "Done24", gap: 14, pad: [8, 16], fill: C.sidebar }); S.txt(ft, "Terminés depuis 24 h", { size: 11, weight: 500, color: C.mfg });
  DONE24.forEach(([a, k, s]) => { const x = S.row(ft, { gap: 4, hs: "auto" }); S.dot(x, C.green, 6); mention(x, a, { size: 11, weight: 500 }); S.txt(x, k + " · " + s, { size: 11, color: C.mfg }); });
  S.frontAbs(f); return f.id; };

// ---------- Fiche ticket, onglet Activité ----------
const sheetBase = (f, w) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w, h: 900, dir: "column", gap: 12, pad: [18, 24] }); shadow(sh); abs(f, sh, 1440 - w, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); S.fillX(S.txt(hd, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(hd, "more"); iconButton(hd, "x");
  S.fillX(S.txt(sh, "Récepteur de hooks Claude Code", { size: 19, weight: 600, lh: 1.3 }));
  const meta = S.row(sh, { gap: 8 }); S.statusDot(meta, "En cours", 8); S.txt(meta, "En cours", { size: 12 }); S.dot(meta, C.amber, 7); mention(meta, "opus-dev-2", { size: 12 }); S.txt(meta, "attend une réponse · run 3", { size: 12, color: C.mfg });
  const tabs = S.row(sh, { name: "SheetTabs", gap: 18 }); tabs.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  [["Détails"], ["Activité", true], ["Questions · 2"], ["Code"]].forEach(([t, on]) => { const c = S.box(tabs, { name: "Tab-" + t, dir: "column", gap: 6, hs: "auto", vs: "auto" }); S.txt(c, t, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : C.mfg });
    const u = S.box(c, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 }); S.fillX(u); }); return sh; };
const runHead = (p, [run, , when, state, st], o = {}) => { const r = S.row(p, { name: "RunHead", gap: 8, pad: [6, 8], radius: 6, fill: o.open ? C.muted : null }); S.icon(r, o.open ? "chevDown" : "chevRight", 13, C.mfg);
  S.dot(r, RUNCOL[st](), 7); S.txt(r, run, { size: 12, weight: 600 }); S.txt(r, when, { size: 12, color: C.mfg }); S.spacer(r); S.txt(r, state, { size: 11, color: st === "waiting" ? C.amber : C.mfg }); return r; };

S.draw.p3a = async () => { const { frame: f } = await kanbanAt(PAGE, "P3-A · Fiche ticket, Activité : plan puis runs", 0, 1); const sh = sheetBase(f, 640);
  sh.flex.rowGap = 10; report(sh, REPORT14); planBlock(sh, PLAN14, { n: "3/5", source: "repris sur 3 runs", size: 12, pad: [2, 0], nosub: true });
  const ch = S.col(sh, { name: "Runs", gap: 6 }); label(ch, "Chronologie des runs");
  runHead(ch, RUNS2[0], { open: true }); const t = S.col(ch, { gap: 10, pad: [4, 0, 6, 28] }); thread(t, FIL14.slice(1), { gap: 8, size: 12, compact: true });
  runHead(ch, RUNS2[1]); runHead(ch, [...RUNS2[2].slice(0, 3), "Interrompu · Pas de compte rendu pour ce run", "failed"]);
  S.frontAbs(f); return f.id; };

const tl = (p, kind, o) => { const r = S.row(p, { name: "TL-" + kind, gap: 10, align: "start" }); const g = S.box(r, { name: "rail", w: 16, dir: "column", vs: "auto", align: "center", pad: [2, 0, 0, 0] });
  if (kind === "step") glyph(g, o.st); else if (kind === "run") S.dot(g, RUNCOL[o.st](), 9); else if (kind === "signal") S.icon(g, "send", 13, C.brand); else S.icon(g, "bot", 13, C.brand);
  const c = S.col(r, { gap: 4 });
  if (kind === "run") { const h = S.row(c, { gap: 8 }); S.txt(h, o.run, { size: 12, weight: 600 }); S.txt(h, o.when, { size: 12, color: C.mfg }); S.spacer(h); S.txt(h, o.state, { size: 11, color: o.st === "waiting" ? C.amber : C.mfg }); if (o.none) noReport(c); }
  else if (kind === "step") { const h = S.row(c, { gap: 6 }); S.txt(h, o.time, { size: 11, mono: true, color: C.dim }); S.badge(h, o.label, o.st === "blocked" ? C.red : C.mfg); S.fillX(S.txt(h, o.text, { size: 12, weight: 500 })); }
  else if (kind === "signal") signalLine(c, o.signal, { compact: true });
  else moment(c, o.m, { size: 12 }); return r; };
S.draw.p3b = async () => { const { frame: f } = await kanbanAt(PAGE, "P3-B · Fiche ticket, Activité : chronologie unique", 2, 1); const sh = sheetBase(f, 880);
  report(sh, REPORT14); const row = S.row(sh, { name: "TimelineRow", gap: 20, align: "start" });
  const t = S.col(row, { name: "Timeline", gap: 10 }); label(t, "Chronologie · plan et fil mêlés");
  tl(t, "run", { run: "Run 3", when: "aujourd'hui 14:21", state: "Attend une réponse", st: "waiting" });
  tl(t, "moment", { m: FIL14[3] }); tl(t, "signal", { signal: FIL14[2].signal });
  tl(t, "step", { st: "blocked", time: "14:23", label: "Étape 4 bloquée", text: "Choisir le port du récepteur · question à Adam" });
  tl(t, "moment", { m: { ...FIL14[1], sum: "2 fichiers lus · 1 question posée" } });
  tl(t, "run", { run: "Run 2", when: "hier 17:52 → 18:40", state: "Fait · compte rendu ci-dessus", st: "done" });
  tl(t, "step", { st: "done", time: "18:31", label: "Étape 3 faite", text: "Valider les événements avec Zod" });
  tl(t, "step", { st: "done", time: "18:05", label: "Étape 2 faite", text: "Serveur HTTP local du récepteur" });
  tl(t, "run", { run: "Run 1", when: "7 oct · 10:04", state: "Interrompu", st: "failed", none: true });
  const side = S.box(row, { name: "PlanSide", fill: C.bg, stroke: C.border, radius: 8, w: 250, dir: "column", gap: 4, pad: 12, vs: "auto" });
  planBlock(side, PLAN14, { n: "3/5", size: 12, pad: [4, 0], sub: "Tenu par l'agent (ticket_progress), repris d'un run à l'autre." });
  S.frontAbs(f); return f.id; };

// ---------- Mention d'agent : carte, volet latéral, page dédiée ----------
const agentId = (p, o = {}) => { const h = S.row(p, { gap: 10, hs: o.auto ? "auto" : undefined }); const av = S.box(h, { name: "AgentAvatar", fill: C.muted, radius: 999, w: o.sz || 32, h: o.sz || 32, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", o.sz ? 20 : 16, C.brand);
  const c = S.col(h, { gap: 2, hs: o.auto ? "auto" : undefined }); const r = S.row(c, { gap: 8, hs: o.auto ? "auto" : undefined }); S.txt(r, "opus-dev-2", { size: o.big || 14, mono: true, weight: 600 }); S.badge(r, "Attend une réponse", C.amber, { round: true, stroke: C.amber, dot: C.amber });
  S.txt(c, "Profil opus-dev · Claude Opus 5.5 · worktree kib-14", { size: 11, color: C.mfg }); return h; };
const hoverCard = (f, x, y) => { const c = S.box(f, { name: "AgentHoverCard", fill: C.card, stroke: C.border, radius: 10, w: 340, dir: "column", gap: 10, pad: 14, vs: "auto" }); shadow(c); abs(f, c, x, y);
  agentId(c); hline(c); const kv = (k, fn) => { const r = S.row(c, { gap: 8, align: "start" }); const kk = S.box(r, { name: "k", w: 74, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 11, color: C.mfg }); const v = S.col(r, { gap: 3 }); fn(v); };
  kv("Ticket", v => S.txt(v, "KIB-14 · Récepteur de hooks Claude Code", { size: 12 }));
  kv("Étape", v => { const r = S.row(v, { gap: 6 }); progress(r, "3/5", 40); S.txt(r, "4/5 · Choisir le port du récepteur", { size: 12 }); });
  kv("Dit", v => { S.fillX(S.txt(v, LAST, { size: 12, lh: 1.45 })); S.txt(v, "il y a 3 min", { size: 11, color: C.dim }); });
  const ft = S.row(c, { gap: 8 }); S.button(ft, "Voir l'historique", "outline", { sm: true, icon: "history" }); S.spacer(ft); S.button(ft, "Répondre", "brand", { sm: true }); return c; };
S.draw.p4a = async () => { const { frame: f, content } = await kanbanAt(PAGE, "P4-a · Mention d'agent : carte au survol", 0, 2); await wait(1500);
  const cd = find(content, "TicketCard / KIB-14"); const ag = cd && cd.children.find(k => k.name === "agent"); const p = rel(f, ag || cd);
  if (ag) { const hl = S.box(f, { name: "MentionHover", stroke: C.mfg, radius: 999, w: p.w + 4, h: p.h + 4 }); abs(f, hl, p.x - 2, p.y - 2); }
  hoverCard(f, p.x, p.y + p.h + 8); S.frontAbs(f); return f.id; };
const panelHead = (p, o = {}) => { const h = S.row(p, { gap: 8, pad: [10, 14] }); agentId(h, { auto: true }); S.spacer(h); if (o.open) S.button(h, "Ouvrir en grand", "outline", { sm: true, icon: "maximize" }); iconButton(h, "x"); hline(p); return h; };
const runsHistory = (p) => { const c = S.col(p, { name: "RunsHistory", gap: 2 }); label(c, "Historique des runs"); RUNS2.forEach((r, i) => { const it = S.box(c, { name: "RunItem", fill: i === 0 ? C.accent : null, radius: 6, dir: "column", gap: 2, pad: [6, 8], vs: "auto" }); S.fillX(it); const row = S.row(it, { gap: 8 });
  S.dot(row, RUNCOL[r[4]](), 7); S.txt(row, r[0], { size: 12, weight: 500 }); S.txt(row, r[1], { size: 11, mono: true, color: C.mfg }); S.spacer(row); S.txt(row, r[2], { size: 11, color: C.dim });
  const l2 = S.row(it, { gap: 0, pad: [0, 0, 0, 15] }); S.txt(l2, r[3], { size: 11, color: r[4] === "waiting" ? C.amber : C.mfg }); }); return c; };
S.draw.p4b = async () => { const { frame: f } = await kanbanAt(PAGE, "P4-b · Mention d'agent : volet latéral", 2, 2);
  const W = 520; const pn = S.box(f, { name: "AgentSidePanel", fill: C.bg, stroke: C.border, w: W, h: 848, dir: "column", gap: 0 }); shadow(pn, 0.35); abs(f, pn, 1440 - W, 92); pn.clipContent = true;
  panelHead(pn, { open: true }); const b = S.col(pn, { name: "Body", gap: 14, pad: [12, 14] }); S.child(b, { v: "fill" });
  planBlock(b, PLAN14, { n: "3/5", source: "ticket_progress", size: 12, pad: [2, 0] }); hline(b);
  label(b, "Fil · run 3 en cours"); thread(b, FIL14, { gap: 10, size: 12 }); hline(b);
  const cr = S.row(b, { gap: 8, pad: [6, 8], radius: 6, stroke: C.border }); S.icon(cr, "clipboard", 13, C.mfg); S.txt(cr, "Compte rendu du run 2", { size: 12, weight: 500 }); S.fillX(S.txt(cr, "fait · 2 points à vérifier · 4 fichiers", { size: 11, color: C.mfg })); S.icon(cr, "chevRight", 13, C.mfg);
  runsHistory(b); S.frontAbs(f); return f.id; };
S.draw.p4c = async () => { const r = await appScreen(PAGE, "P4-c · Page dédiée d'un agent", 4, 2, "Agents", ["Agents", "opus-dev-2"], ["bot", "Agents · opus-dev-2"]); const { frame: f, content: c } = r; S.activate(f, "Agents");
  c.flex.rowGap = 14; const h = S.row(c, { gap: 12 }); agentId(h, { sz: 40, big: 17, auto: true }); S.spacer(h); S.button(h, "Répondre", "brand", { sm: true }); S.button(h, "Arrêter le run", "outline", { sm: true });
  const cols = S.row(c, { name: "Columns", gap: 16, align: "start" }); S.child(cols, { v: "fill" });
  const l = S.box(cols, { name: "Runs", w: 240, dir: "column", gap: 4, vs: "auto" }); runsHistory(l);
  const m = S.panel(cols, { name: "Fil", gap: 12, pad: 16, fillX: false }); S.child(m, { h: "fill" });
  const mh = S.row(m, { gap: 8 }); S.txt(mh, "Fil narratif · run 3", { size: 13, weight: 600 }); S.txt(mh, "KIB-14 · aujourd'hui 14:21", { size: 12, color: C.mfg }); S.spacer(mh); S.check(mh, true, "Afficher le raisonnement");
  thread(m, [FIL14[0], { ...FIL14[1], open: [["file", "Lu", "packages/daemon/src/hooks/receiver.ts", ""], ["file", "Lu", "packages/daemon/src/config.ts", ""], ["messageQuestion", "Question", "ask_user · Quel port pour le récepteur ?", ""]],
    reasonText: "Le récepteur doit démarrer avant le premier hook. Un port fixe simplifie la config de Claude Code, mais deux démons lancés en même temps entreraient en conflit. Je pose la question plutôt que de trancher." }, FIL14[2], FIL14[3]], { gap: 12, size: 13, noReason: true });
  const rc = S.box(cols, { name: "Side", w: 340, dir: "column", gap: 14, vs: "auto" }); const pl = S.panel(rc, { gap: 4, pad: 14 }); planBlock(pl, PLAN14, { n: "3/5", size: 12, pad: [2, 0], nosub: true });
  report(rc, REPORT14, { stack: true });
  await wait(1500); penpotUtils.findShapes(x => /brand/.test(x.name), h).forEach(x => { x.flex.leftPadding = 11; x.flex.leftPadding = 10; });
  S.frontAbs(f); return f.id; };

// ---------- P5 · Agent de projet : boîte des signaux et lot après réveil ----------
const SIG = [["Ticket à créer", "ticket", "opus-dev-2", "KIB-14", "Tests du récepteur de hooks", "14:26"], ["Blocage", "alert", "opus-dev-3", "KIB-16", "Attend le schéma Loro de KIB-12 pour brancher les transitions", "14:28"],
  ["Contexte", "info", "opus-dev-1", "KIB-12", "Le reparentage garde l'ordre des enfants : rien à changer côté Kanban", "13:52"], ["Question", "messageQuestion", "sonnet-review", "KIB-7", "Garder deux tons de zinc pour les bordures ?", "14:12"]];
const sigRow = (p, [kind, ic, who, t, what, time], o = {}) => { const r = S.box(p, { name: "Signal", fill: o.done ? null : C.card, stroke: C.border, radius: 8, dir: "column", gap: 4, pad: [8, 10], vs: "auto" }); S.fillX(r); if (o.done) r.opacity = 0.7;
  const h = S.row(r, { gap: 6 }); S.icon(h, ic, 13, kind === "Blocage" ? C.red : C.mfg); S.txt(h, kind, { size: 12, weight: 600 }); S.txt(h, "de", { size: 11, color: C.dim }); mention(h, who, { size: 11 }); S.txt(h, "sur " + t, { size: 11, mono: true, color: C.mfg }); S.spacer(h); S.txt(h, time, { size: 11, mono: true, color: C.dim });
  S.fillX(S.txt(r, "« " + what + " »", { size: 12, lh: 1.4 })); if (o.tag) S.txt(r, o.tag, { size: 11, color: C.mfg }); return r; };
const LOT = [["Créer le ticket « Tests du récepteur de hooks » (parent KIB-14)", "signal Ticket à créer de opus-dev-2"], ["KIB-16 : passer en Bloqué, motif « attend KIB-12 »", "signal Blocage de opus-dev-3"],
  ["Lier KIB-12 → KIB-16 (bloque)", "même signal ; le lien manquait"]];
S.draw.p5 = async () => { const { frame: f } = await kanbanAt(PAGE, "P5 · Agent de projet : signaux et lot après réveil", 0, 3);
  S.topAction(f, "Partager", "outline", "share2"); const btn = S.topAction(f, "Agent de projet", "secondary", "sparkles"); btn.name = "ProjectAgentButton";
  penpotUtils.findShapes(x => x.strokes?.length, btn.children.find(k => /^icon/.test(k.name)) || btn).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: C.brand })));
  await wait(1200); btn.clipContent = false; const pill = S.box(btn, { name: "SignalCount", fill: C.brand, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); S.txt(pill, "2", { size: 10, weight: 600, color: "#FFFFFF" });
  pill.strokes = [{ strokeColor: C.bg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }]; if (pill.layoutChild) pill.layoutChild.absolute = true; penpotUtils.setParentXY(pill, Math.round(btn.width) - 10, -6);
  const W = 440; const p = S.box(f, { name: "ProjectAgentPanel", fill: C.bg, stroke: C.border, w: W, h: 848, dir: "column", gap: 0 }); shadow(p, 0.35); abs(f, p, 1440 - W, 92); p.clipContent = true;
  const h = S.row(p, { gap: 8, pad: [8, 12] }); S.icon(h, "sparkles", 16, C.brand); S.fillX(S.txt(h, "Agent de projet · Kibo", { size: 13, weight: 600 })); S.badge(h, "Lot à valider", C.brand, { round: true, stroke: C.brand }); iconButton(h, "more"); iconButton(h, "x"); hline(p);
  const tb = S.row(p, { gap: 16, pad: [8, 12, 0, 12] }); [["Conversation"], ["Signaux · 2", true]].forEach(([t, on]) => { const c = S.box(tb, { name: "Tab-" + t, dir: "column", gap: 6, hs: "auto", vs: "auto" }); S.txt(c, t, { size: 12, weight: on ? 600 : 400, color: on ? C.fg : C.mfg }); const u = S.box(c, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 }); S.fillX(u); }); hline(p);
  const b = S.col(p, { name: "Body", gap: 10, pad: 12 }); S.child(b, { v: "fill" });
  label(b, "En boîte · 2"); S.sub(b, "Contexte et Question attendent ton prochain échange avec l'agent de projet.", { size: 11 }); sigRow(b, SIG[2]); sigRow(b, SIG[3]);
  label(b, "Réveil automatique · 14:31"); notice(b, "2 signaux regroupés · 1 tour en file · prochain réveil possible à 14:41");
  sigRow(b, SIG[0], { done: true, tag: "traité dans le lot n° 2" }); sigRow(b, SIG[1], { done: true, tag: "traité dans le lot n° 2" });
  const lot = S.box(b, { name: "BatchCard", fill: C.card, radius: 10, dir: "column", gap: 8, pad: [12, 14], vs: "auto" }); S.fillX(lot); lot.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 0.6 }];
  const lh = S.row(lot, { gap: 8 }); S.fillX(S.txt(lh, "Lot n° 2", { size: 13, weight: 600 })); S.txt(lh, "3 actions · après réveil", { size: 11, color: C.mfg });
  LOT.forEach(([t, why], i) => { if (i) hline(lot); const r = S.row(lot, { gap: 10, align: "start", pad: [4, 0] }); S.check(r, true); const c = S.col(r, { gap: 2 }); S.fillX(S.txt(c, t, { size: 12, lh: 1.35 })); S.txt(c, why, { size: 11, color: C.mfg }); });
  const ft = S.row(lot, { gap: 8 }); S.spacer(ft); S.button(ft, "Refuser", "ghost", { sm: true }); S.button(ft, "Valider (3)", "brand", { sm: true });
  await wait(3000); pill.x = Math.round(btn.x + btn.width) - 11; pill.y = Math.round(btn.y) - 6;
  S.frontAbs(f); return f.id; };

S.PISTES = ["p1", "p2a", "p2b", "p3a", "p3b", "p4a", "p4b", "p4c", "p5"];
return "pistes ok";
