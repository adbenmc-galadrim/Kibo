// Page « 25 · Questions & session » : écrans 170 à 173 (phase 17, spec §23.12). Requiert 18-socle.js et 24-socle-suite.js.
// Données : design/donnees-fictives.md, section « Questions » (KIB-14 et KIB-11).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "25 · Questions & session";
const { find, wait, shadow, abs, input, select, help, labeled, segmented, formDialog, item, appScreen, kanbanAt } = S.fx;
const { iconButton, cell, dashboard, widget } = S.fx2;

Object.assign(S.ICONS, {
  messageQuestion: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
});

// ---------- Données (donnees-fictives.md) ----------
const Q = {
  port: { key: "KIB-14", title: "Quel port pour le récepteur ?", by: "opus-dev-2", age: "il y a 3 min", ctx: "Le récepteur de hooks écoute sur 127.0.0.1. Question bloquante : le run attend la réponse.", options: ["7420", "Port libre choisi au lancement"], provisional: null },
  read: { key: "KIB-14", title: "Un composant non autorisé lit-il les fichiers du projet ?", by: "opus-dev-2", age: "il y a 8 min", ctx: "Décision prise **provisoirement** par le run : accès refusé pour l'instant.", options: ["Oui", "Non"], provisional: "Non" },
  archived: { key: "KIB-14", title: "Bloquer l'écriture sur un projet archivé ?", by: "opus-dev-2", age: "il y a 9 min", ctx: "Décision prise **provisoirement** par le run : écriture autorisée pour l'instant.", options: ["Oui", "Non"], provisional: "Non", answer: "Oui", answeredBy: "Adam · il y a 5 min", delivered: null },
  review: { key: "KIB-11", title: "Exiger une review humaine avant fusion ?", by: "sonnet-review", age: "il y a 41 min", ctx: "Posée pendant la review de la PR #15 ; la review a été postée avec le choix provisoire.", options: ["Oui", "Non"], provisional: "Oui" },
  token: { key: "KIB-11", title: "Renouveler le jeton local à chaque démarrage ?", by: "sonnet-review", age: "hier", ctx: "Posée pendant la review de la PR #15.", options: ["Oui", "Non"], provisional: "Non", answer: "Non", answeredBy: "Adam · hier", delivered: "sonnet-review" },
};
const TICKET = { "KIB-14": "Récepteur de hooks Claude Code", "KIB-11": "Démon : auth par jeton local", "KIB-16": "Moteur de règles déclaratif" };

// ---------- Primitives ----------
const tint = (b, col = C.brand) => { b.strokes = [{ strokeColor: col, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  b.children.filter(c => c.type === "text").forEach(t => t.fills = [{ fillColor: col, fillOpacity: 1 }]);
  b.children.filter(c => /^icon/.test(c.name)).forEach(ic => penpotUtils.findShapes(x => x.strokes?.length, ic).forEach(x => x.strokes = x.strokes.map(s => ({ ...s, strokeColor: col })))); return b; };
const orangeButton = (p, label, icon) => tint(S.button(p, label, "outline", { sm: true, icon }));
const pill = (p, n) => { const b = S.box(p, { name: "QuestionsBadge", stroke: C.brand, radius: 999, dir: "row", gap: 4, pad: [1, 7], hs: "auto", vs: "auto", align: "center" });
  S.icon(b, "messageQuestion", 11, C.brand); S.txt(b, n + (n > 1 ? " questions" : " question"), { size: 10, weight: 500, color: C.brand }); return b; };
const chip = (p, name) => { const a = S.box(p, { name: "AgentBadge", stroke: C.border, radius: 999, dir: "row", gap: 4, pad: [1, 7], hs: "auto", vs: "auto", align: "center" });
  S.icon(a, "bot", 11, C.mfg); S.txt(a, name, { size: 10, mono: true, color: C.fg }); return a; };
const toTransmit = (p) => { const b = S.box(p, { name: "ToTransmit", stroke: C.brand, radius: 999, dir: "row", pad: [1, 7], hs: "auto", vs: "auto" }); S.txt(b, "à transmettre", { size: 10, weight: 500, color: C.brand }); return b; };
const answerForm = (p, q) => { const r = S.row(p, { gap: 8 }); if (q.provisional) orangeButton(r, "Valider le choix provisoire", "check");
  q.options.forEach(o => S.button(r, o, "outline", { sm: true }));
  const t = S.row(p, { gap: 8 }); input(t, "Autre réponse…", { placeholder: true }); S.button(t, "Répondre", "secondary", { sm: true, disabled: true }); };
const meta = (p, q, o = {}) => { const r = S.row(p, { gap: 8 }); if (o.key) S.txt(r, q.key, { size: 11, mono: true, color: C.mfg }); chip(r, q.by);
  if (q.provisional) S.txt(r, "provisoire : " + q.provisional, { size: 11, color: C.mfg }); S.txt(r, q.age, { size: 11, color: C.dim }); return r; };
const markdown = (p, t) => { const r = S.row(p, { gap: 0 }); r.flex.wrap = "wrap"; t.split("**").forEach((s, i) => { if (s) S.txt(r, s, { size: 12, color: C.mfg, weight: i % 2 ? 600 : 400 }); }); return r; };

// ---------- 171 · Kanban, fiche, Tickets : pastille « n questions » ----------
const addPills = (c) => { [["KIB-14", 2], ["KIB-11", 1]].forEach(([k, n]) => { const cd = find(c, "TicketCard / " + k); const m = cd && cd.children.find(x => x.name === "meta"); if (m) pill(m, n); }); };
const sheet = (f) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 520, h: 900, dir: "column", gap: 14, pad: [20, 24] }); shadow(sh); abs(f, sh, 1440 - 520, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); S.fillX(S.txt(hd, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(hd, "more"); iconButton(hd, "x");
  S.fillX(S.txt(sh, "Récepteur de hooks Claude Code", { size: 20, weight: 600, lh: 1.3 }));
  const lb = S.row(sh, { gap: 6 }); S.badge(lb, "area:agents", C.fg, { mono: true }); S.badge(lb, "urgent", C.fg, { mono: true }); pill(lb, 2);
  const ac = S.row(sh, { gap: 8 }); orangeButton(ac, "Assigner à un agent", "bot");
  const props = S.col(sh, { gap: 10 }); const prop = (k, fn) => { const r = S.row(props, { gap: 8 }); const kk = S.box(r, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
  prop("Statut", r => select(r, "En cours", { lead: s => S.statusDot(s, "En cours", 8) }));
  prop("Domaine", r => select(r, "Agents", { lead: s => S.box(s, { name: "sq", fill: S.domainColors.Agents, radius: 1, w: 7, h: 7 }) }));
  prop("Assigné", r => select(r, "opus-dev-2", { disabled: true, lead: s => S.icon(s, "bot", 12, C.mfg) }));
  const ses = S.row(props, { gap: 8 }); S.box(ses, { name: "k", w: 110, h: 1 }); S.icon(ses, "refresh", 12, C.mfg); S.txt(ses, "Session principale : opus-dev-2 · 3 tours", { size: 12, color: C.mfg });
  prop("Branche", r => { S.icon(r, "git", 13, C.mfg); S.txt(r, "kib-14", { size: 12, mono: true }); });
  const de = S.col(sh, { gap: 8 }); S.txt(de, "Description", { size: 13, weight: 600 });
  S.sub(de, "Serveur HTTP local qui reçoit les hooks de Claude Code (SessionStart, PostToolUse, Stop) et met à jour l'état du run.", { size: 13 }); return sh; };
S.draw[171] = async () => { const { frame: f, content: c } = await kanbanAt(PAGE, "171 · Pastille n questions : Kanban et fiche", 0, 1); addPills(c); sheet(f); S.frontAbs(f); return f.id; };
const ROWS = [["KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours", "opus-dev-1", 0, null], ["KIB-14", "Récepteur de hooks Claude Code", "En cours", "opus-dev-2", 2, null],
  ["KIB-16", "Moteur de règles déclaratif", "En cours", "opus-dev-3", 0, null], ["KIB-15", "Kanban : drag & drop entre colonnes", "À faire", "Adam", 0, "KIB-12"],
  ["KIB-11", "Démon : auth par jeton local", "En review", "Adam", 1, null], ["KIB-7", "Tokens shadcn + thème sombre", "En review", "Adam", 0, null]];
S.draw["171b"] = async () => { const r = await appScreen(PAGE, "171b · Pastille n questions : ligne Tickets", 2, 1, "Tickets", ["Kibo", "Tickets"], ["list", "Kibo · Tickets"]); const c = r.content;
  const tb = S.row(c, { gap: 8 }); input(tb, "Rechercher (clé ou titre)", { icon: "search", placeholder: true, w: 280 }); S.button(tb, "Statut", "outline", { sm: true, icon: "filter" }); select(tb, "Assigné : Tous"); select(tb, "Étiquette : toutes");
  S.spacer(tb); S.button(tb, "Nouveau ticket", "outline", { sm: true, icon: "plus" });
  S.table(c, [["Ticket"], ["Statut", 130], ["Assigné", 150]], ROWS.map(([k, t, st, who, n, w]) => [
    cell => { S.txt(cell, k, { size: 12, mono: true, color: C.dim }); S.txt(cell, t, { size: 13 }); if (w) S.badge(cell, "attend " + w, C.mfg, { icon: "link" }); if (n) pill(cell, n); },
    cell => { S.statusDot(cell, st, 8); S.txt(cell, st, { size: 12 }); },
    cell => { if (/-\d$/.test(who)) S.icon(cell, "bot", 13, C.mfg); S.txt(cell, who, { size: 12, mono: /-\d$/.test(who) }); }]));
  return r.frame.id; };

// ---------- 170 · Composant Questions : widget, vue, nouvelle question ----------
const kcard = (p, k, t, o = {}) => { const cd = S.box(p, { name: "TicketCard / " + k, fill: C.card, stroke: C.border, radius: 8, dir: "column", gap: 8, pad: 10, vs: "auto" }); S.fillX(cd);
  S.txt(cd, k, { size: 11, mono: true, color: C.dim }); S.fillX(S.txt(cd, t, { size: 13, weight: 500, lh: 1.35 }));
  if (o.agent || o.n) { const r = S.row(cd, { gap: 6 }); r.flex.wrap = "wrap"; if (o.agent) S.agentBadge(r, o.agent, o.run, o.runL); if (o.n) pill(r, o.n); } return cd; };
const kcol = (p, name, cards) => { const col = S.box(p, { name: "Column / " + name, fill: C.muted, op: 0.5, radius: 10, dir: "column", gap: 8, pad: 6, w: 262 }); S.child(col, { v: "fill" });
  const hd = S.row(col, { gap: 6, pad: [4, 4] }); S.statusDot(hd, name); S.fillX(S.txt(hd, name, { size: 12, weight: 500 })); S.txt(hd, String(cards.length), { size: 11, mono: true, color: C.dim });
  cards.forEach(x => kcard(col, ...x)); return col; };
const qItem = (p, q, open) => { const it = S.col(p, { name: "QuestionItem", gap: 8, pad: [10, 0] }); S.border(it); it.strokes = [];
  S.fillX(S.txt(it, q.title, { size: 13, weight: 600, lh: 1.35 })); meta(it, q, { key: true }); if (open) answerForm(it, q);
  S.fillX(S.box(p, { name: "Separator", fill: C.border, h: 1, w: 10 })); return it; };
S.draw[170] = async () => { const { frame: f, g } = await dashboard(PAGE, "170 · Questions : widget, réponse en ligne", 0, 0);
  const k = widget(g, "Kanban", "kanban", cell(0, 0, 6, 7)); const b = S.row(k.body, { gap: 8, align: "start" }); S.child(b, { v: "fill" });
  kcol(b, "À faire", [["KIB-15", "Kanban : drag & drop entre colonnes"], ["KIB-18", "Adaptateur GitHub Issues", { agent: "opus-dev", run: "queued", runL: "En file #2" }]]);
  kcol(b, "En cours", [["KIB-12", "Schéma Loro des tickets (LoroTree)", { agent: "opus-dev-1", run: "running" }], ["KIB-14", "Récepteur de hooks Claude Code", { agent: "opus-dev-2", run: "waiting", runL: "Attend", n: 2 }]]);
  const w = widget(g, "Questions", "messageQuestion", cell(6, 0, 6, 7), { gap: 0 });
  S.txt(w.body, "Questions ouvertes · 3", { size: 13, weight: 600 });
  qItem(w.body, Q.read, true); qItem(w.body, Q.port, false); qItem(w.body, Q.review, false);
  const tr = S.row(w.body, { gap: 8, pad: [10, 0, 6, 0] }); orangeButton(tr, "Transmettre à l'agent (1) · KIB-14", "send");
  S.txt(w.body, "Ouvrir les questions →", { size: 12, weight: 500, color: C.mfg }); return f.id; };

const qCard = (p, q, o = {}) => { const card = S.panel(p, { name: "Question", gap: 8, pad: [12, 14] });
  const h = S.row(card, { gap: 8 }); S.fillX(S.txt(h, q.title, { size: 13, weight: 600 })); chip(h, q.by); S.txt(h, q.age, { size: 11, color: C.dim });
  if (q.answer) S.button(h, "Supprimer", "ghost", { sm: true, icon: "trash" });
  markdown(card, q.ctx);
  S.txt(card, "Options : " + q.options.join(" · ") + (q.provisional ? "    provisoire : " + q.provisional : ""), { size: 11, color: C.mfg });
  if (q.answer) { const a = S.col(card, { gap: 4, pad: [10, 12], fill: C.muted, radius: 8 }); S.txt(a, "Réponse : " + q.answer, { size: 13, weight: 600 });
    const r = S.row(a, { gap: 8 }); S.txt(r, "Répondu par " + q.answeredBy, { size: 11, color: C.mfg }); if (q.delivered) S.txt(r, "· transmise à " + q.delivered, { size: 11, color: C.mfg }); else toTransmit(r); }
  else answerForm(card, q); return card; };
const group = (c, key, qs, n) => { const h = S.row(c, { gap: 8, pad: [6, 0, 0, 0] }); S.txt(h, key, { size: 11, mono: true, color: C.mfg }); S.txt(h, TICKET[key], { size: 13, weight: 600 }); S.spacer(h);
  if (n) orangeButton(h, "Transmettre à l'agent (" + n + ")", "send"); qs.forEach(q => qCard(c, q)); };
const QNAV = "Questions";
const addNav = (f) => { const sb = find(f, "Sidebar"); const notes = item(f, "Notes"); if (!sb || !notes) return null;
  const it = S.navItem(null, "messageQuestion", QNAV, { indent: 14, active: true }); sb.insertChild(sb.children.findIndex(x => x.id === notes.id) + 1, it); S.fillX(it); return it; };
S.fixQNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && !/^base/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), a = item(f, "Notes"), it = item(f, QNAV);
  if (!sb || !a || !it) return n; sb.insertChild(0, it); sb.insertChild(sb.children.findIndex(x => x.id === a.id) + 1, it); return n + 1; }, 0);
const view = async (name, col, row, scope) => { const r = await appScreen(PAGE, name, col, row, null, ["Kibo", "Questions"], ["messageQuestion", "Kibo · Questions"]); addNav(r.frame); S.fixIconOrder(r.frame);
  S.topAction(r.frame, "Partager", "outline", "share2"); const c = r.content;
  const tb = S.row(c, { gap: 8 }); segmented(tb, ["Ouvertes", "Répondues", "Toutes"], scope); select(tb, "Tous les tickets"); S.spacer(tb); S.button(tb, "Nouvelle question", "outline", { sm: true, icon: "plus" });
  return r; };
S.draw["170b"] = async () => { const { frame: f, content: c } = await view("170b · Questions : vue filtrée « Répondues »", 2, 0, "Répondues");
  group(c, "KIB-14", [Q.archived], 1); group(c, "KIB-11", [Q.token], 0); return f.id; };
S.draw["170c"] = async () => { const { frame: f, content: c } = await view("170c · Questions : vue, nouvelle question", 4, 0, "Ouvertes");
  group(c, "KIB-14", [Q.read, Q.port], 1);
  const d = formDialog(f, "Nouvelle question", 500, "Une question à valider sur un ticket, visible de tout le projet.");
  labeled(d, "Ticket", cc => select(cc, "KIB-16  Moteur de règles déclaratif", { fill: true }));
  labeled(d, "Question", cc => input(cc, "Une règle peut-elle changer le statut d'un ticket bloqué ?", { focus: true }));
  labeled(d, "Contexte (Markdown)", cc => input(cc, "Pourquoi la question se pose, ce qui est fait en attendant.", { placeholder: true, h: 64 }));
  labeled(d, "Options, une par ligne", cc => input(cc, "Oui\nNon", { h: 64 }), { help: "6 options au plus." });
  labeled(d, "Choix provisoire", cc => select(cc, "Non", { fill: true }));
  S.footer(d, "Annuler", "Créer la question"); S.frontAbs(f); return f.id; };

// ---------- 172 · Tiroir du run : Terminé · n questions, ligne session, notification ----------
const runRow = (p, name, text, col, o = {}) => { const r = S.row(p, { gap: 8, pad: [6, 8], radius: 6, fill: o.on ? C.accent : null }); S.dot(r, col, 7); S.txt(r, name, { size: 12, mono: true, weight: 600 });
  S.txt(r, text, { size: 12, color: C.mfg }); if (o.q) S.txt(r, "· " + o.q, { size: 12, color: C.brand }); S.spacer(r); S.txt(r, o.t || "", { size: 11, mono: true, color: C.dim }); return r; };
const drawer = (f, o) => { const d = S.box(f, { name: "AgentDrawer", fill: C.card, stroke: C.border, w: 1192, h: 420, dir: "column", gap: 0 }); shadow(d); abs(f, d, 248, 940 - 420);
  const h = S.row(d, { gap: 10, pad: [10, 16] }); S.border(h); S.icon(h, "bot", 14, C.fg); S.txt(h, "Agents", { size: 13, weight: 500 }); S.txt(h, "3/3 places · 3 en file · 1 attend une réponse", { size: 12, color: C.mfg }); S.spacer(h);
  S.button(h, "Lancer un agent", "outline", { sm: true, icon: "plus" }); S.icon(h, "chevDown", 14, C.mfg);
  const b = S.row(d, { gap: 0, align: "start" }); S.child(b, { v: "fill" });
  const l = S.box(b, { name: "Runs", w: 400, dir: "column", gap: 2, pad: 12, vs: "auto" });
  S.label(l, "En cours · 3/3 places"); runRow(l, "opus-dev-1", "KIB-12 · Schéma Loro des tickets", C.blue, { t: "12m" }); runRow(l, "opus-dev-3", "KIB-16 · Moteur de règles", C.blue, { t: "4m" }); runRow(l, "sonnet-review", "KIB-7 · Tokens shadcn", C.blue, { t: "1m" });
  S.box(l, { name: "gap", w: 1, h: 6 }); S.label(l, "Attend une réponse"); runRow(l, "opus-dev-2", "KIB-14 · Attend une réponse", C.amber, { on: o.sel === "opus-dev-2", t: "3m" });
  S.box(l, { name: "gap", w: 1, h: 6 }); S.label(l, "Terminé"); runRow(l, "sonnet-review", "KIB-11 · Terminé", C.green, { on: o.sel === "sonnet-review", q: "1 question", t: "6m" });
  const j = S.col(b, { name: "Journal", gap: 10, pad: 12 }); S.child(j, { v: "fill" }); j.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  const jh = S.row(j, { gap: 8 }); S.icon(jh, "bot", 14, C.brand); S.txt(jh, o.sel, { size: 13, mono: true, weight: 600 }); S.txt(jh, o.ticket, { size: 12, color: C.mfg }); S.spacer(jh); S.txt(jh, o.where, { size: 12, mono: true, color: C.dim });
  const box = S.panel(j, { gap: 6, pad: [10, 12], fill: C.bg }); o.lines.forEach(([t, e, x, col]) => S.hookLine(box, t, e, x, { color: col }));
  o.footer(j);
  S.txt(j, "Écrire à l'agent", { size: 12, weight: 500 }); const ir = S.row(j, { gap: 8 }); input(ir, "Ton message…", { placeholder: true, right: i => S.txt(i, "Reprend la session", { size: 11, color: C.mfg }) }); S.button(ir, "Envoyer", "brand", { sm: true, disabled: true });
  return d; };
const notification = (f, title, body) => { const n = S.box(f, { name: "SystemNotification", fill: C.card, stroke: C.border, radius: 12, w: 360, dir: "row", gap: 12, pad: [12, 14], vs: "auto" }); shadow(n); abs(f, n, 1440 - 360 - 16, 52);
  S.logo(n, 32, S.mode); const tv = S.col(n, { gap: 2 }); const r = S.row(tv, { gap: 6 }); S.fillX(S.txt(r, "Kibo", { size: 11, color: C.mfg })); S.txt(r, "maintenant", { size: 11, color: C.dim });
  S.txt(tv, title, { size: 13, weight: 600 }); S.sub(tv, body); return n; };
S.draw[172] = async () => { const { frame: f, content: kc } = await kanbanAt(PAGE, "172 · Tiroir du run : Terminé · 1 question, notification", 0, 2); addPills(kc);
  drawer(f, { sel: "sonnet-review", ticket: "KIB-11 · Démon : auth par jeton local", where: "dossier isolé · 6 min",
    lines: [["14:02", "session", "Session : reprise du run sonnet-review (2 tours)", C.mfg], ["14:02", "SessionStart", "brief.md + 2 guidelines chargés", C.blue], ["14:05", "PostToolUse", "mcp__kibo__ask_question", C.blue],
      ["14:08", "Stop", "Review de la PR #15 postée avec le choix provisoire.", C.green], ["14:08", "SessionEnd", "other", C.mfg]],
    footer: j => { const r = S.row(j, { gap: 8 }); S.icon(r, "messageQuestion", 14, C.brand); S.txt(r, "1 question ouverte", { size: 12, color: C.brand }); S.txt(r, "Ouvrir les questions", { size: 12, weight: 600 }); } });
  notification(f, "sonnet-review a posé une question", "KIB-11 · Exiger une review humaine avant fusion ?"); S.frontAbs(f); return f.id; };
S.draw["172b"] = async () => { const { frame: f, content: kc } = await kanbanAt(PAGE, "172b · Tiroir du run : réponses à transmettre", 2, 2); addPills(kc);
  drawer(f, { sel: "opus-dev-2", ticket: "KIB-14 · Récepteur de hooks Claude Code", where: "worktree kib-14 · 9 min",
    lines: [["14:21", "session", "Session : nouvelle (transcript introuvable)", C.mfg], ["14:21", "SessionStart", "brief.md + 3 guidelines chargés", C.blue], ["14:24", "PostToolUse", "mcp__kibo__ask_question", C.blue],
      ["14:25", "PostToolUse", "mcp__kibo__ask_question", C.blue], ["14:29", "PostToolUse", "mcp__kibo__ask_user", C.blue], ["14:29", "Notification", "Quel port pour le récepteur ?", C.amber]],
    footer: j => { const r = S.row(j, { gap: 8 }); S.icon(r, "messageQuestion", 14, C.brand); S.txt(r, "2 questions ouvertes", { size: 12, color: C.brand }); S.txt(r, "Ouvrir les questions", { size: 12, weight: 600 });
      const t = S.row(j, { gap: 8 }); S.txt(t, "1 réponse à transmettre", { size: 12, color: C.mfg }); S.button(t, "Transmettre à l'agent", "brand", { sm: true, icon: "send" }); } });
  S.frontAbs(f); return f.id; };

// ---------- 173 · Assigner : session principale ----------
const assign = (f, o) => { const d = formDialog(f, "Assigner KIB-11 à un agent", 576, "Démon : auth par jeton local");
  labeled(d, "Profil", c => select(c, o.profile, { fill: true, lead: s => S.icon(s, "bot", 13, C.mfg) }));
  labeled(d, "Brief (optionnel)", c => input(c, "Consignes pour l'agent", { placeholder: true }));
  const info = S.panel(d, { gap: 8, pad: 12 });
  const kv = (k, fn) => { const r = S.row(info, { gap: 8, align: "start" }); const kk = S.box(r, { name: "k", w: 140, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); const v = S.col(r, { gap: 6 }); fn(v); };
  o.rows.forEach(([k, v, col]) => kv(k, c => S.txt(c, v, { size: 12, color: col || C.fg })));
  kv("Session", c => { S.txt(c, o.session, { size: 12 }); if (o.reason) S.txt(c, o.reason, { size: 11, color: C.mfg }); if (o.reset) S.check(c, false, "Repartir de zéro"); });
  S.footer(d, "Annuler", "Mettre en file", "brand"); return d; };
const ROWS173 = [["Espace", "dossier isolé"], ["Permissions", "Lecture seule (plan)"], ["Guidelines", "workspace · projet Kibo · Sécurité (2 fichiers .md)"], ["File d'attente", "en file #4 · attend une place de l'hôte (3/3)", C.cyan]];
S.draw[173] = async () => { const { frame: f, content: kc } = await kanbanAt(PAGE, "173 · Assigner : reprise de la session principale", 0, 3); addPills(kc);
  assign(f, { profile: "sonnet-review · Claude Sonnet 5 · dossier isolé", rows: ROWS173, session: "reprend sonnet-review (2 tours, 12 k tokens)", reset: true }); S.frontAbs(f); return f.id; };
S.draw["173b"] = async () => { const { frame: f, content: kc } = await kanbanAt(PAGE, "173b · Assigner : nouvelle session, transcript introuvable", 2, 3); addPills(kc);
  assign(f, { profile: "sonnet-review · Claude Sonnet 5 · dossier isolé", rows: ROWS173, session: "nouvelle (transcript introuvable)", reason: "Le brief porte la fiche, les questions et les commits de la branche." }); S.frontAbs(f); return f.id; };


// ---------- 166 à 169 · Étiquettes, branche, worktrees, mode Automatique (spec §23.2 à §23.5) ----------
const LABELS = { "KIB-12": ["area:core", "phase:p1"], "KIB-14": ["area:agents", "urgent"], "KIB-16": ["area:agents", "phase:p2"], "KIB-15": ["area:ui", "phase:p1"], "KIB-11": ["area:securite", "phase:p1", "urgent"], "KIB-7": ["area:ui"] };
const label = (p, t) => S.badge(p, t, C.fg, { mono: true });
const labelSheet = (f, o = {}) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 520, h: 900, dir: "column", gap: 14, pad: [20, 24] }); shadow(sh); abs(f, sh, 1440 - 520, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); S.fillX(S.txt(hd, "KIB-12", { size: 12, mono: true, color: C.mfg })); iconButton(hd, "more"); iconButton(hd, "x");
  S.fillX(S.txt(sh, "Schéma Loro des tickets (LoroTree)", { size: 20, weight: 600, lh: 1.3 }));
  const lc = S.col(sh, { gap: 6 }); const lb = S.row(lc, { gap: 6 }); LABELS["KIB-12"].forEach(t => label(lb, t)); if (o.added) label(lb, o.added);
  input(lb, o.typing || "Ajouter une étiquette", { placeholder: !o.typing, focus: !!o.typing, error: !!o.error, w: 200, size: 12, mono: !!o.typing });
  if (o.error) help(lc, "Étiquette invalide : minuscules, chiffres, : _ . / -, 40 caractères.", C.red);
  const ac = S.row(sh, { gap: 8 }); orangeButton(ac, "Assigner à un agent", "bot");
  const props = S.col(sh, { gap: 10 }); const prop = (k, fn) => { const r = S.row(props, { gap: 8 }); const kk = S.box(r, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); return r; };
  prop("Statut", r => select(r, "En cours", { lead: s => S.statusDot(s, "En cours", 8) }));
  prop("Domaine", r => select(r, "Core", { lead: s => S.box(s, { name: "sq", fill: S.domainColors.Core, radius: 1, w: 7, h: 7 }) }));
  prop("Assigné", r => select(r, "opus-dev-1", { disabled: true, lead: s => S.icon(s, "bot", 12, C.mfg) }));
  const br = prop("Code", r => { S.badge(r, "feat/schema-loro", C.fg, { icon: "branch", mono: true, round: true }).name = "BranchBadge"; S.badge(r, "PR #18", C.fg, { icon: "pr", mono: true, round: true }); });
  const de = S.col(sh, { gap: 8 }); S.txt(de, "Description", { size: 13, weight: 600 });
  S.sub(de, "Arbre des tickets dans un LoroTree : déplacement et reparentage sans conflit, sous-tickets en profondeur illimitée, index SQLite dérivé.", { size: 13 }); return sh; };
S.draw[166] = async () => { const { frame: f } = await kanbanAt(PAGE, "166 · Fiche : étiquettes et branche", 0, 4); const sh = labelSheet(f, { added: "urgent" }); await wait(2000);
  const p = S.fx.rel(f, find(sh, "BranchBadge")); S.fx.tooltip(f, p.x, p.y + p.h + 6, "Base : feat/noyau-donnees"); S.frontAbs(f); return f.id; };
S.draw["166b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "166b · Fiche : étiquette invalide", 2, 4); labelSheet(f, { typing: "Phase P1", error: true }); S.frontAbs(f); return f.id; };

const projectDialog = (f, o = {}) => { const d = formDialog(f, "Modifier le projet", 480);
  labeled(d, "Nom", c => input(c, "Kibo")); labeled(d, "Couleur", c => S.fx.swatches(c, ["#F97316", "#14B8A6", "#6366F1", "#EC4899", "#84CC16", "#64748B"], "#F97316"));
  labeled(d, "Dossier", c => input(c, "~/code/kibo", { mono: true, size: 12 }), { help: "Le dossier reste sur ta machine. Vide pour délier." });
  S.txt(d, "Worktrees des agents", { size: 13, weight: 600 });
  const kv = (k, v, x = {}) => { const r = S.row(d, { gap: 12 }); const kk = S.box(r, { name: "k", w: 120, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, weight: 500 }); input(r, v, { mono: true, size: 12, placeholder: !!x.ph, focus: !!x.focus, error: !!x.error }); };
  kv("Base", "origin/main"); kv("Chemin", "../kibo-{slug}"); kv("Préparation", o.quote ? "bun run worktree '{branch}'" : "bun run worktree {branch}", { focus: !o.quote, error: !!o.quote });
  if (o.quote) help(d, "Une variable entre guillemets simples ne serait pas remplacée : utilise des guillemets doubles.", C.red);
  help(d, "Variables : {branch} {slug} {key} ; {path} dans la commande. La commande s'exécute depuis la racine du dépôt, sur ta machine.");
  S.footer(d, "Annuler", "Enregistrer"); return d; };
S.draw[167] = async () => { const { frame: f } = await kanbanAt(PAGE, "167 · Modifier le projet : worktrees des agents", 0, 5); projectDialog(f); S.frontAbs(f); return f.id; };
S.draw["167b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "167b · Modifier le projet : guillemets simples refusés", 2, 5); projectDialog(f, { quote: true }); S.frontAbs(f); return f.id; };

const profileDialog = (f, o = {}) => { const d = formDialog(f, "Modifier le profil opus-dev", 520);
  labeled(d, "Modèle", c => select(c, "Claude Opus 5.5", { fill: true }));
  labeled(d, "Espace de travail", c => select(c, "worktree par ticket", { fill: true }));
  labeled(d, "Permissions", c => select(c, "Automatique (l'agent décide, sans contournement)", { fill: true }), { help: "Les actions jugées risquées sont refusées et listées dans le run ; jamais de contournement des permissions." });
  labeled(d, "Règles d'autorisation, une par ligne", c => input(c, o.bad ? "Bash(bun *)\nBash(git *)\nBash(gh pr *)\nBash" : "Bash(bun *)\nBash(git *)\nBash(gh pr *)\nRead(packages/**)", { mono: true, size: 12, h: 96, error: !!o.bad }),
    { help: o.bad ? "Ligne 4 : une règle Bash doit porter un motif." : "50 règles au plus. Bash sans motif, Bash(*) et les shells (sh, bash, env…) sont refusés.", helpColor: o.bad ? C.red : undefined });
  S.footer(d, "Annuler", "Enregistrer"); return d; };
const agentsPage = async (name, col, row) => { const r = await appScreen(PAGE, name, col, row, null, ["Agents"], ["bot", "Agents"]); S.activate(r.frame, "Agents");
  S.sub(r.content, "Un run est le travail d'un agent sur un ticket.", { size: 13 }); return r; };
S.draw[168] = async () => { const { frame: f } = await agentsPage("168 · Profil : mode Automatique et règles", 0, 6); profileDialog(f); S.frontAbs(f); return f.id; };
S.draw["168b"] = async () => { const { frame: f } = await agentsPage("168b · Profil : règle Bash sans motif", 2, 6); profileDialog(f, { bad: true }); S.frontAbs(f); return f.id; };

S.draw[169] = async () => { const r = await appScreen(PAGE, "169 · Tickets : filtre d'étiquettes", 0, 7, "Tickets", ["Kibo", "Tickets"], ["list", "Kibo · Tickets"]); const { frame: f, content: c } = r;
  const tb = S.row(c, { gap: 8 }); input(tb, "Rechercher (clé ou titre)", { icon: "search", placeholder: true, w: 280 }); S.button(tb, "Statut", "outline", { sm: true, icon: "filter" }); select(tb, "Assigné : Tous");
  const lf = S.button(tb, "Étiquettes : 2", "outline", { sm: true, icon: "tag" }); S.button(tb, "Effacer", "ghost", { sm: true, icon: "x" }); S.spacer(tb); S.button(tb, "Nouveau ticket", "outline", { sm: true, icon: "plus" });
  S.table(c, [["Ticket"], ["Statut", 130], ["Assigné", 150]], ROWS.filter(x => (LABELS[x[0]] || []).some(l => l === "phase:p1" || l === "urgent")).map(([k, t, st, who, n]) => [
    cell => { S.txt(cell, k, { size: 12, mono: true, color: C.dim }); S.txt(cell, t, { size: 13 }); const ls = LABELS[k] || []; ls.slice(0, 2).forEach(l => label(cell, l)); if (ls.length > 2) S.txt(cell, "+" + (ls.length - 2), { size: 11, mono: true, color: C.mfg }); if (n) pill(cell, n); },
    cell => { S.statusDot(cell, st, 8); S.txt(cell, st, { size: 12 }); },
    cell => { if (/-\d$/.test(who)) S.icon(cell, "bot", 13, C.mfg); S.txt(cell, who, { size: 12, mono: /-\d$/.test(who) }); }]));
  await wait(2000); const p = S.fx.rel(f, lf);
  const pop = S.box(f, { name: "LabelFilter", fill: C.card, stroke: C.border, radius: 8, w: 220, dir: "column", gap: 2, pad: 6, vs: "auto" }); shadow(pop); abs(f, pop, p.x, p.y + p.h + 4);
  [["area", ["area:agents", "area:core", "area:securite", "area:ui"]], ["phase", ["phase:p1", "phase:p2"]], ["Autres", ["urgent"]]].forEach(([g, ls]) => { S.label(pop, g);
    ls.forEach(l => { const r2 = S.row(pop, { gap: 8, pad: [5, 6] }); S.check(r2, l === "phase:p1" || l === "urgent"); S.txt(r2, l, { size: 12, mono: true }); }); });
  S.frontAbs(f); return f.id; };

S.HERITES = [166, "166b", 167, "167b", 168, "168b", 169];

S.QUESTIONS = [170, "170b", "170c", 171, "171b", 172, "172b", 173, "173b"];
return "questions ok";
