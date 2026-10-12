// Page « 30 · Signaux des agents » : écrans 189 à 191 (phase 21, spec §27.7 et §27.10). Requiert 18-socle.js, 24-socle-suite.js, 32b, 32d et 33.
// D'après les captures screens/2026-10-12-t5 et la piste P5 (page 28) ; données : design/donnees-fictives.md, section « Signaux des agents (phase 21) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "30 · Signaux des agents";
const { find, wait, shadow, abs, hline, input, appScreen, kanbanAt } = S.fx;
const { iconButton } = S.fx2;
const { RUNCOL, mention, planBlock, notice, label } = S.vis;
const { orangeButton } = S.visQ;

Object.assign(S.ICONS, {
  alarmClock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>',
  bookSearch: '<path d="M11 22H5.5a1 1 0 0 1 0-5h4.501"/><path d="m21 22-1.879-1.878"/><path d="M3 19.5v-15A2.5 2.5 0 0 1 5.5 2H18a1 1 0 0 1 1 1v8"/><circle cx="17" cy="18" r="3"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
});

// ---------- Données ----------
const SIG = {
  ticket: { kind: "Ticket à créer", ic: "ticket", who: "opus-dev-2", st: "running", t: "KIB-14", what: "Tests du récepteur de hooks", time: "14:26" },
  blocker: { kind: "Blocage", ic: "alert", who: "opus-dev-3", st: "running", t: "KIB-16", what: "Attend le schéma Loro de KIB-12 pour brancher les transitions", time: "14:28" },
  question: { kind: "Question", ic: "messageQuestion", who: "sonnet-review", st: "running", t: "KIB-7", what: "Garder deux tons de zinc pour les bordures ?", time: "14:12" },
  context: { kind: "Contexte", ic: "info", who: "opus-dev-1", st: "running", t: "KIB-12", what: "Le reparentage garde l'ordre des enfants : rien à changer côté Kanban", time: "13:52" },
};
const OPEN4 = [SIG.blocker, SIG.ticket, SIG.question, SIG.context];
const LOT = [
  ["Tickets", [
    { title: "Créer le ticket « Tests du récepteur de hooks »", sub: "parent KIB-14", from: SIG.ticket, why: "KIB-14 n'a pas encore de test d'intégration.", res: ["applied", "KIB-31"] },
    { title: "KIB-16 : passer en Bloqué", diff: ["En cours", "Bloqué"], from: SIG.blocker, why: "Motif « attend KIB-12 ».", res: ["applied"] }]],
  ["Liens", [{ title: "Lier KIB-12 → KIB-16 (bloque)", from: SIG.blocker, why: "Le lien manquait : KIB-16 attend le schéma Loro de KIB-12.", res: ["applied"] }]],
];
const PLAN = [["done", "Relire le récepteur et ses tests", "2 moments"], ["done", "Corriger la validation du corps", "4 moments"], ["done", "Choisir le port du récepteur", "réponse d'Adam : 7420"],
  ["blocked", "Brancher le récepteur sur le démon", "attend KIB-12"], ["doing", "Documenter le format des hooks", "2 moments"]];
const SIGNAL_MOMENT = { signal: SIG.ticket };
const FIL = [
  { notice: "14:21 · Session reprise (run 3, 4 tours)" },
  { time: "14:22", step: "Étape 3", text: "Adam a choisi le port 7420. Je le fixe dans la config et je relance les tests.", sum: "A modifié 1 fichier et lancé les tests (14 réussis)" },
  { time: "14:25", step: "Étape 5", text: "Le récepteur n'a aucun test d'intégration. Je le signale à l'agent de projet plutôt que de créer un ticket moi-même.", after: SIGNAL_MOMENT, sum: "A envoyé 1 signal",
    acts: [["send", "Signalé", "« Tests du récepteur de hooks » à l'agent de projet", "sig:3"]] },
  { time: "14:27", step: "Étape 5", text: "Je documente le format des hooks dans le README du récepteur.", sum: "A lu 2 fichiers" },
];
const OPEN_ACT = FIL[2];

// ---------- Barre des agents : opus-dev-2 a repris son run (run 4) ----------
const runningBar = (f) => { const r = find(f, "Run-opus-dev-2"); if (!r) return;
  r.children.filter(k => /^Button/.test(k.name)).forEach(k => k.remove()); const d = r.children.find(k => k.name === "dot"); if (d) d.fills = [{ fillColor: C.blue, fillOpacity: 1 }];
  const t = r.children.find(k => k.type === "text" && /attend/.test(k.characters)); if (t) { S.setText(t, "KIB-14 · 8m"); t.fills = [{ fillColor: C.mfg, fillOpacity: 1 }]; } };

// ---------- Bouton « Agent de projet » et pastille ----------
const recolor = (s, col) => penpotUtils.findShapes(x => x.strokes?.length, s).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: col })));
const agentButton = async (f, n, o = {}) => { runningBar(f); if (o.share !== false) S.topAction(f, "Partager", "outline", "share2");
  const b = S.topAction(f, "Agent de projet", o.variant || "secondary", "sparkles"); b.name = "ProjectAgentButton"; recolor(b.children.find(c => /^icon/.test(c.name)) || b, C.brand);
  if (!n) return b; await wait(1200); b.clipContent = false;
  const pill = S.box(b, { name: "SignalCount", fill: C.brand, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); S.txt(pill, String(n), { size: 10, weight: 600, color: "#FFFFFF" });
  pill.strokes = [{ strokeColor: C.bg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }]; if (pill.layoutChild) pill.layoutChild.absolute = true;
  await wait(1500); pill.x = Math.round(b.x + b.width) - 11; pill.y = Math.round(b.y) - 6; return b; };

// ---------- Panneau ----------
const W = 440, X = 1440 - W, Y = 92, H = 940 - 92;
const STATUS = { ready: "Prêt", batch: "Lot à valider" };
const header = (p, status) => { const h = S.row(p, { name: "PanelHeader", gap: 8, pad: [8, 12] }); S.icon(h, "sparkles", 16, C.brand); S.fillX(S.txt(h, "Agent de projet · Kibo", { size: 13, weight: 600 }));
  const on = status === "batch"; S.badge(h, STATUS[status], on ? C.brand : C.mfg, { round: true, stroke: on ? C.brand : C.border }); iconButton(h, "more"); iconButton(h, "x"); hline(p); };
const tabs = (p, on, n) => { const tb = S.row(p, { name: "PanelTabs", gap: 16, pad: [8, 12, 0, 12] });
  [["Conversation", on === "conv"], [n ? "Signaux · " + n : "Signaux", on === "sig"]].forEach(([t, a]) => { const c = S.box(tb, { name: "Tab-" + t, dir: "column", gap: 6, hs: "auto", vs: "auto" });
    S.txt(c, t, { size: 12, weight: a ? 600 : 400, color: a ? C.fg : C.mfg }); S.fillX(S.box(c, { name: "underline", fill: a ? C.fg : null, h: 2, w: 10 })); }); hline(p); };
const compose = (p) => { hline(p); const c = S.col(p, { name: "ComposeBox", gap: 8, pad: 12 }); input(c, "Écris à l'agent de projet…", { placeholder: true, h: 80 });
  const r = S.row(c, { gap: 8 }); S.fillX(S.txt(r, "⌘↵ pour envoyer", { size: 11, color: C.dim })); S.button(r, "Envoyer", "brand", { sm: true, icon: "send", disabled: true }); };
const panel = (f, o) => { const p = S.box(f, { name: "ProjectAgentPanel", fill: C.bg, stroke: C.border, w: W, h: H, dir: "column", gap: 0 }); shadow(p, 0.35); abs(f, p, X, Y); p.clipContent = true;
  header(p, o.status); tabs(p, o.tab, o.n);
  const body = S.box(p, { name: o.tab === "sig" ? "Signals" : "Conversation", dir: "column", gap: o.tab === "sig" ? 8 : 12, pad: 12 }); S.fillX(body); S.child(body, { v: "fill" }); body.clipContent = true;
  o.body(body); if (o.tab === "conv") compose(p); return p; };

// ---------- Boîte à signaux ----------
const sigCard = (p, s, o = {}) => { const r = S.box(p, { name: "Signal", fill: o.done ? null : C.card, stroke: C.border, radius: 8, dir: "column", gap: 4, pad: [8, 10], vs: "auto" }); S.fillX(r); if (o.done) r.opacity = 0.7;
  const red = s.kind === "Blocage"; const h = S.row(r, { gap: 6 }); S.icon(h, s.ic, 13, red ? C.red : C.mfg); S.txt(h, s.kind, { size: 12, weight: 600, color: red ? C.red : C.fg });
  S.txt(h, "de", { size: 11, color: C.dim }); S.dot(h, RUNCOL[s.st](), 6); mention(h, s.who, { size: 11 }); S.txt(h, "sur", { size: 11, color: C.dim });
  const k = S.txt(h, s.t, { size: 11, mono: true, color: C.mfg }); k.textDecoration = "underline"; S.spacer(h); S.txt(h, s.time, { size: 11, mono: true, color: C.dim });
  S.fillX(S.txt(r, "« " + s.what + " »", { size: 12, lh: 1.4 }));
  if (o.tag) S.txt(r, o.tag, { size: 11, color: C.mfg });
  else { const ft = S.row(r, { gap: 8 }); S.spacer(ft); S.button(ft, "Ouvrir le ticket", "ghost", { sm: true }); S.button(ft, "Ignorer", "outline", { sm: true }); } return r; };
const gap = (p, h = 6) => S.box(p, { name: "gap", w: 1, h });
const wakeLine = (p, t) => { gap(p); label(p, "Réveil automatique"); const r = S.row(p, { name: "Wakeup", gap: 6 }); S.icon(r, "alarmClock", 13, C.mfg); S.txt(r, t, { size: 12, color: C.mfg }); };

// ---------- Conversation et lot ----------
const event = (p, t, ic) => { const r = S.row(p, { name: "Event", gap: 6 }); if (ic) S.icon(r, ic, 13, C.mfg); S.fillX(S.txt(r, t, { size: 11, color: C.mfg })); return r; };
const agentText = (p, t) => S.fillX(S.txt(p, t, { size: 13, lh: 1.5 }));
const OUTCOME = { applied: "Appliquée", stale: "Périmée", failed: "Échec", skipped: "Ignorée" };
const actionRow = (p, a, o) => { const r = S.row(p, { name: "Action", gap: 10, align: "start", pad: [8, 0] }); if (!o.decided) S.check(r, true);
  const c = S.col(r, { gap: 3 }); S.fillX(S.txt(c, a.title, { size: 13, lh: 1.35 }));
  if (a.diff) { const d = S.row(c, { gap: 5 }); const t = S.txt(d, a.diff[0], { size: 11, color: C.mfg }); t.textDecoration = "line-through"; S.icon(d, "arrowRight", 11, C.mfg); S.txt(d, a.diff[1], { size: 11 }); }
  if (a.sub) S.txt(c, a.sub, { size: 11, color: C.mfg });
  const pv = S.row(c, { name: "Provenance", gap: 4 }); S.txt(pv, "signal " + a.from.kind + " de", { size: 11, color: C.mfg }); mention(pv, a.from.who, { size: 11, weight: 500, color: C.mfg });
  S.fillX(S.txt(c, a.why, { size: 11, color: C.mfg, lh: 1.35 }));
  if (o.decided) { const rr = S.row(c, { gap: 5 }); S.txt(rr, OUTCOME[a.res[0]], { size: 11, weight: 500, color: C.green }); if (a.res[1]) S.txt(rr, a.res[1], { size: 11, mono: true, color: C.mfg }); }
  return r; };
const group = (card, name, acts, o) => { const g = S.col(card, { name: "Group-" + name, gap: 0 }); const h = S.row(g, { gap: 8 }); S.fillX(S.txt(h, name.toUpperCase(), { size: 10, weight: 600, color: C.mfg }));
  if (!o.decided) S.txt(h, "Tout décocher", { size: 11, weight: 500 }); acts.forEach((a, i) => { if (i) hline(g); actionRow(g, a, o); }); return g; };
const batchCard = (p, o = {}) => { const c = S.box(p, { name: "BatchCard", fill: C.card, radius: 10, dir: "column", gap: 12, pad: [12, 14], vs: "auto" }); S.fillX(c);
  c.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: o.decided ? 0.35 : 0.6 }];
  const h = S.row(c, { gap: 8 }); S.fillX(S.txt(h, "Lot n° 2", { size: 13, weight: 600 })); S.txt(h, "3 actions · après réveil", { size: 11, color: C.mfg });
  S.fillX(S.txt(c, "Traiter les signaux de opus-dev-2 et opus-dev-3", { size: 13, lh: 1.35 }));
  if (o.decided) S.txt(c, "Appliqué", { size: 12, weight: 500, color: C.mfg });
  LOT.forEach(([n, acts]) => group(c, n, acts, o));
  if (!o.decided) { const ft = S.row(c, { gap: 8 }); S.spacer(ft); S.button(ft, "Refuser", "ghost", { sm: true }); S.button(ft, "Valider (3)", "brand", { sm: true }); } return c; };
const wakeConversation = (b, o = {}) => { event(b, "Réveil automatique · 2 signaux", "alarmClock"); event(b, "list_signals · lit KIB-14, KIB-16 et KIB-12", "bookSearch");
  agentText(b, "J'ai proposé un lot pour 2 signaux : un ticket de tests sous KIB-14 et le blocage de KIB-16, avec le lien qui manquait."); batchCard(b, o); };

// ---------- 189 · Conversation : lot après réveil ----------
S.draw[189] = async () => { const { frame: f } = await kanbanAt(PAGE, "189 · Agent de projet : lot après réveil", 0, 0); await agentButton(f, 4);
  panel(f, { status: "batch", tab: "conv", n: 4, body: b => wakeConversation(b) }); S.frontAbs(f); return f.id; };

// ---------- 189a · Onglet Signaux : boîte ----------
S.draw["189a"] = async () => { const { frame: f } = await kanbanAt(PAGE, "189a · Agent de projet : boîte à signaux", 2, 0); await agentButton(f, 4);
  panel(f, { status: "batch", tab: "sig", n: 4, body: b => { label(b, "En boîte · 4"); OPEN4.forEach(s => sigCard(b, s)); wakeLine(b, "prochain réveil à 14:41"); } });
  S.frontAbs(f); return f.id; };

// ---------- 189b · Onglet Signaux après validation ----------
S.draw["189b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "189b · Agent de projet : signaux après validation", 4, 0); await agentButton(f, 2);
  panel(f, { status: "ready", tab: "sig", n: 2, body: b => { label(b, "En boîte · 2"); sigCard(b, SIG.question); sigCard(b, SIG.context); wakeLine(b, "prochain réveil à 14:41");
    gap(b); label(b, "Traités"); sigCard(b, SIG.blocker, { done: true, tag: "traité dans le lot n° 2" }); sigCard(b, SIG.ticket, { done: true, tag: "traité dans le lot n° 2 · KIB-31" }); } });
  S.frontAbs(f); return f.id; };

// ---------- 189c · Conversation : lot appliqué ----------
S.draw["189c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "189c · Agent de projet : lot appliqué", 6, 0); await agentButton(f, 2);
  panel(f, { status: "ready", tab: "conv", n: 2, body: b => wakeConversation(b, { decided: true }) }); S.frontAbs(f); return f.id; };

// ---------- Fil du run émetteur ----------
const signalMoment = (p, s, o = {}) => { const r = S.row(p, { name: "SignalMoment", gap: 8, pad: o.pad }); S.icon(r, "send", 13, C.brand);
  S.fillX(S.txt(r, "Signal à l'agent de projet · " + s.kind + " · « " + s.what + " »", { size: 12, color: s.kind === "Blocage" ? C.red : C.fg, lh: 1.4 }));
  S.txt(r, "· " + s.time, { size: 12, mono: true, color: C.mfg }); return r; };
const actRow = (p, [ic, verb, what, res]) => { const r = S.row(p, { name: "Action", gap: 10, pad: [0, 0, 0, 2] }); S.icon(r, ic, 13, C.brand);
  const v = S.box(r, { name: "verb", w: 64, dir: "row", vs: "auto" }); S.txt(v, verb, { size: 12, color: C.mfg }); S.fillX(S.txt(r, what, { size: 12 })); S.txt(r, res, { size: 12, mono: true, color: C.mfg }); return r; };
const actions = (p, m, open) => { const a = S.box(p, { name: "Actions", fill: C.muted, radius: 6, dir: "column", gap: 8, pad: [7, 12], vs: "auto" }); S.fillX(a);
  const h = S.row(a, { gap: 8 }); S.icon(h, open ? "chevDown" : "chevRight", 12, C.mfg); S.fillX(S.txt(h, m.sum, { size: 12, color: C.mfg }));
  if (open) m.acts.forEach(x => actRow(a, x)); return a; };
const moment = (p, m, o = {}) => { if (m.notice) return notice(p, m.notice);
  const c = S.col(p, { name: "Moment", gap: 8 }); const h = S.row(c, { gap: 8 }); S.txt(h, m.time, { size: 12, mono: true, color: C.mfg }); S.badge(h, m.step, C.fg, { round: true });
  S.fillX(S.txt(c, m.text, { size: 13, lh: 1.45, weight: 500 })); if (m.after) signalMoment(c, m.after.signal); actions(c, m, o.open === m); return c; };
const fil = (p, o = {}) => { const c = S.col(p, { name: "Thread", gap: 12 }); FIL.forEach(m => moment(c, m, o)); return c; };
const plan = (p) => planBlock(p, PLAN, { n: "3/5", source: "ticket_progress", size: 13, pad: [5, 0] });

// ---------- 190 · Page dédiée du run émetteur ----------
const HISTORY = [["opus-dev-3", "KIB-16", "En cours", "blue", "12 oct., 14:02"], ["opus-dev-2", "KIB-14", "En cours", "blue", "12 oct., 14:21", true], ["opus-dev-1", "KIB-12", "En cours", "blue", "12 oct., 13:40"],
  ["opus-dev-2", "KIB-14", "Fait, 2 points à vérifier", "green", "11 oct., 10:37"], ["opus-dev-2", "KIB-14", "Fait, 2 points à vérifier", "green", "10 oct., 17:52"]];
const historyList = (p) => { const c = S.col(p, { name: "RunsHistory", gap: 2 }); label(c, "Historique des runs"); gap(c);
  HISTORY.forEach(([a, k, st, col, when, on]) => { col = C[col]; const it = S.box(c, { name: "RunItem", fill: on ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [7, 8], vs: "auto" }); S.fillX(it);
    const r = S.row(it, { gap: 6 }); S.dot(r, col, 7); S.txt(r, a, { size: 12, mono: true, weight: 600 }); S.txt(r, k, { size: 12, mono: true, color: C.mfg });
    const l = S.row(it, { gap: 6, pad: [0, 0, 0, 13] }); S.fillX(S.txt(l, st, { size: 12, color: col })); S.txt(l, when, { size: 11, mono: true, color: C.dim }); }); return c; };
const agentHead = (p) => { const h = S.row(p, { gap: 12 }); const av = S.box(h, { name: "AgentAvatar", fill: C.brandSoft, radius: 999, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", 18, C.brand);
  const c = S.col(h, { gap: 3 }); const r = S.row(c, { gap: 8 }); S.txt(r, "opus-dev-2", { size: 17, mono: true, weight: 600 }); S.badge(r, "En cours", C.blue, { round: true, stroke: C.blue, dot: C.blue });
  S.txt(c, "Profil opus-dev · KIB-14 · Récepteur de hooks Claude Code", { size: 12, color: C.mfg }); return h; };
S.draw[190] = async () => { const r = await appScreen(PAGE, "190 · Page du run émetteur : ligne de signal", 0, 1, "Agents", ["Agents", "opus-dev-2"], ["bot", "Run opus-dev-2 · KIB-14"]); const { frame: f, content: c } = r;
  S.activate(f, "Agents"); await agentButton(f, 4, { share: false }); c.flex.rowGap = 16;
  const h = S.row(c, { gap: 12 }); const a = agentHead(h); S.child(a, { h: "fill" }); S.button(h, "Passer en review", "outline", { sm: true, icon: "eye" }); S.button(h, "Arrêter le run", "outline", { sm: true, icon: "square" });
  const cols = S.row(c, { name: "Columns", gap: 16, align: "start" }); const l = S.box(cols, { name: "Runs", w: 240, dir: "column", gap: 4, vs: "auto" }); historyList(l);
  const m = S.panel(cols, { name: "Fil", gap: 12, pad: 16, fillX: false }); S.child(m, { h: "fill" });
  const mh = S.row(m, { gap: 8 }); S.txt(mh, "Fil narratif · run 4", { size: 13, weight: 600 }); S.fillX(S.txt(mh, "KIB-14 · worktree kib-14 · depuis 14:21", { size: 12, color: C.mfg })); S.check(mh, false, "Afficher le raisonnement");
  fil(m, { open: OPEN_ACT });
  const side = S.box(cols, { name: "Side", w: 330, dir: "column", gap: 14, vs: "auto" }); const pl = S.panel(side, { gap: 4, pad: 14 }); plan(pl);
  await wait(1500); penpotUtils.findShapes(x => /brand/.test(x.name), h).forEach(x => { x.flex.leftPadding = 11; x.flex.leftPadding = 10; }); return f.id; };

// ---------- 190b · Fiche KIB-14, onglet Activité ----------
const ticketHead = (p) => { const h = S.row(p, { gap: 6 }); S.fillX(S.txt(h, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(h, "more");
  S.txt(p, "Récepteur de hooks Claude Code", { size: 18, weight: 600 }); input(p, "Ajouter une étiquette", { w: 192, size: 12, placeholder: true });
  const a = S.row(p, { gap: 8 }); orangeButton(a, "Assigner à un agent", "bot");
  const tc = S.col(p, { name: "SheetTabs", gap: 0 }); const tb = S.row(tc, { gap: 0 });
  [["Détails"], ["Activité", true]].forEach(([t, on]) => { const c = S.box(tb, { name: "Tab-" + t, dir: "column", gap: 8, pad: [0, 12], hs: "auto", vs: "auto" }); S.txt(c, t, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : C.mfg });
    S.fillX(S.box(c, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 })); }); hline(tc); return h; };
const runHead = (p, [run, who, when, state, st]) => { const r = S.row(p, { name: "RunHead", gap: 8 }); S.dot(r, RUNCOL[st](), 8);
  S.txt(r, run, { size: 13, weight: 600 }); S.txt(r, who, { size: 12, mono: true, color: C.mfg }); S.txt(r, when, { size: 12, color: C.mfg }); S.spacer(r); S.txt(r, state, { size: 12, color: C.mfg }); return r; };
const indent = (p) => S.col(p, { name: "RunBody", gap: 12, pad: [0, 0, 4, 16] });
S.draw["190b"] = async () => { const r = await appScreen(PAGE, "190b · Fiche ticket, Activité : ligne de signal", 2, 1, "Tickets", ["Kibo", "KIB-14"], ["ticket", "Kibo · KIB-14"]); const { frame: f, content: c } = r;
  await agentButton(f, 4); c.flex.rowGap = 12; ticketHead(c);
  const row = S.row(c, { name: "ActivityRow", gap: 24, align: "start" }); const t = S.col(row, { name: "Timeline", gap: 12 }); label(t, "Chronologie · plan et fil mêlés");
  runHead(t, ["Run 4", "opus-dev-2", "aujourd'hui 14:21", "En cours", "running"]); const b = indent(t); fil(b, { open: OPEN_ACT });
  runHead(t, ["Run 3", "opus-dev-2", "11 oct. 10:37 → 11:20", "Fait, 2 points à vérifier", "done"]);
  const side = S.panel(row, { name: "PlanSide", gap: 4, pad: 14, w: 288 }); plan(side); return f.id; };

// ---------- 191 · Kanban : pastille et notification ----------
const notification = (f, title, body) => { const n = S.box(f, { name: "SystemNotification", fill: C.card, stroke: C.border, radius: 12, w: 360, dir: "row", gap: 12, pad: [12, 14], vs: "auto" }); shadow(n); abs(f, n, 1440 - 360 - 16, 100);
  S.logo(n, 32, S.mode); const tv = S.col(n, { gap: 2 }); const r = S.row(tv, { gap: 6 }); S.fillX(S.txt(r, "Kibo", { size: 11, color: C.mfg })); S.txt(r, "maintenant", { size: 11, color: C.dim });
  S.txt(tv, title, { size: 13, weight: 600 }); S.sub(tv, body); return n; };
S.draw[191] = async () => { const { frame: f } = await kanbanAt(PAGE, "191 · Kanban : pastille et notification de blocage", 4, 1); await agentButton(f, 4);
  notification(f, "Blocage signalé par opus-dev-3 · KIB-16", "« Attend le schéma Loro de KIB-12 pour brancher les transitions »"); S.frontAbs(f); return f.id; };

S.SIGNAUX = [189, "189a", "189b", "189c", 190, "190b", 191];
return "signaux ok";
