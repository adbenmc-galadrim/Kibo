// Page « 28 · Pistes visibilité agents », écrans P6 : page Questions refondue (destinataires, export, réponse collée). Requiert 18-socle.js, 24-socle-suite.js et 32b-pistes-agents.js.
// Même style que P1 à P5. Données : design/donnees-fictives.md, section « Questions (phase 17) », complétées (KIB-16, KIB-12, destinataires).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "28 · Pistes visibilité agents";
const { find, wait, shadow, abs, rel, input, select, listbox, help, hline, labeled, segmented, formDialog, item, tooltip, appScreen } = S.fx;
const { iconButton } = S.fx2;

Object.assign(S.ICONS, {
  messageQuestion: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  clipboardPaste: '<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10"/><path d="m17 10 4 4-4 4"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
});

// ---------- Données ----------
const RECIPIENTS = [["Moi (technique)", 4], ["Produit", 3], ["Client", 2]];
const Q = {
  port: { key: "KIB-14", to: "Moi (technique)", title: "Quel port pour le récepteur ?", by: "opus-dev-2", age: "il y a 3 min", ctx: "Le récepteur écoute sur 127.0.0.1. Question bloquante : le run attend la réponse.", options: ["7420", "Port libre choisi au lancement"], blocking: true },
  read: { key: "KIB-14", to: "Produit", title: "Un composant non autorisé lit-il les fichiers du projet ?", by: "opus-dev-2", age: "il y a 8 min", ctx: "Décision provisoire du run : accès refusé pour l'instant.", options: ["Oui", "Non"], provisional: "Non" },
  archived: { key: "KIB-14", to: "Produit", title: "Bloquer l'écriture sur un projet archivé ?", by: "opus-dev-2", age: "il y a 9 min", ctx: "Décision provisoire du run : écriture autorisée pour l'instant.", options: ["Oui", "Non"], provisional: "Non", answer: "Oui", answeredBy: "Adam · il y a 5 min" },
  rules: { key: "KIB-16", to: "Client", title: "Le client modifie-t-il lui-même les règles d'automatisation ?", by: "opus-dev-3", age: "il y a 2 j", ctx: "Si oui, il faut un éditeur de règles dans l'interface ; sinon un fichier suffit.", options: ["Oui, dans l'interface", "Non, Adam les écrit"], sent: "Envoyée au client il y a 2 j · mail" },
  history: { key: "KIB-12", to: "Client", title: "Faut-il garder l'historique des tickets supprimés ?", by: "opus-dev-1", age: "il y a 1 h", ctx: "Aujourd'hui un ticket supprimé disparaît de l'historique. On peut le garder 30 jours dans une corbeille.", options: ["Oui, corbeille de 30 jours", "Non, suppression définitive"] },
  review: { key: "KIB-11", to: "Moi (technique)", title: "Exiger une review humaine avant fusion ?", by: "sonnet-review", age: "il y a 41 min", ctx: "Posée pendant la review de la PR #15 ; la review a été postée avec le choix provisoire.", options: ["Oui", "Non"], provisional: "Oui" },
};
const TICKET = { "KIB-14": "Récepteur de hooks Claude Code", "KIB-11": "Démon : auth par jeton local", "KIB-16": "Moteur de règles déclaratif", "KIB-12": "Schéma Loro des tickets (LoroTree)" };
const EXPORT = ["Bonjour,", "", "Une question sur Kibo (KIB-12 · Schéma Loro des tickets) :", "",
  "Contexte : aujourd'hui un ticket supprimé disparaît de l'historique. On peut le garder 30 jours dans une corbeille.", "",
  "Question : faut-il garder l'historique des tickets supprimés ?", "", "Options :", "1. Oui, corbeille de 30 jours", "2. Non, suppression définitive", "", "Merci !"];
const PASTED = "Oui pour les règles simples (statut, assignation). Les règles qui touchent la facturation restent chez Adam.\n— Claire, côté client";

// ---------- Primitives ----------
const tint = (b, col = C.brand) => { b.strokes = [{ strokeColor: col, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  b.children.filter(c => c.type === "text").forEach(t => t.fills = [{ fillColor: col, fillOpacity: 1 }]);
  b.children.filter(c => /^icon/.test(c.name)).forEach(ic => penpotUtils.findShapes(x => x.strokes?.length, ic).forEach(x => x.strokes = x.strokes.map(s => ({ ...s, strokeColor: col })))); return b; };
const orangeButton = (p, label, icon) => tint(S.button(p, label, "outline", { sm: true, icon }));
const mention = (p, name) => { const t = S.txt(p, name, { size: 11, mono: true, weight: 600 }); t.textDecoration = "underline"; t.name = "AgentMention"; return t; };
const recipient = (p, to, o = {}) => { const b = S.box(p, { name: "RecipientMenu", fill: o.open ? C.accent : null, stroke: o.open ? C.mfg : C.border, radius: 999, dir: "row", gap: 4, pad: [2, 8], hs: "auto", vs: "auto", align: "center" });
  S.icon(b, "user", 11, C.mfg); S.txt(b, "Pour : " + to, { size: 11, weight: 500 }); S.icon(b, "chevDown", 11, C.mfg); return b; };
const toTransmit = (p) => { const b = S.box(p, { name: "ToTransmit", stroke: C.brand, radius: 999, dir: "row", pad: [1, 7], hs: "auto", vs: "auto" }); S.txt(b, "à transmettre", { size: 10, weight: 500, color: C.brand }); return b; };
const filterBar = (p, on) => { const r = S.row(p, { name: "RecipientFilter", gap: 6 }); [["Tous", 9], ...RECIPIENTS].forEach(([t, n]) => {
    const b = S.box(r, { name: "Filter-" + t, fill: t === on ? C.accent : null, stroke: t === on ? C.mfg : C.border, radius: 999, dir: "row", gap: 6, pad: [5, 12], hs: "auto", vs: "auto", align: "center" });
    S.txt(b, t, { size: 12, weight: t === on ? 600 : 400 }); S.txt(b, String(n), { size: 12, color: C.mfg }); });
  const add = S.box(r, { name: "AddRecipient", radius: 999, dir: "row", gap: 4, pad: [5, 10], hs: "auto", vs: "auto", align: "center" }); S.icon(add, "plus", 12, C.mfg); S.txt(add, "Destinataire", { size: 12, color: C.mfg });
  S.spacer(r); segmented(r, ["Ouvertes", "Répondues", "Toutes"], "Ouvertes"); return r; };
const answerForm = (p, q) => { const r = S.row(p, { gap: 8 }); if (q.provisional) orangeButton(r, "Valider le choix provisoire", "check");
  q.options.forEach(o => S.button(r, o, "outline", { sm: true })); const t = S.row(p, { gap: 8 }); input(t, "Autre réponse…", { placeholder: true }); S.button(t, "Répondre", "secondary", { sm: true, disabled: true }); };
const qCard = (p, q, o = {}) => { const card = S.panel(p, { name: "Question", gap: 8, pad: [12, 14] });
  const h = S.row(card, { gap: 8 }); S.fillX(S.txt(h, q.title, { size: 13, weight: 600 })); if (q.blocking) S.badge(h, "bloquante", C.brand, { round: true, stroke: C.brand });
  const m = S.row(card, { gap: 8 }); recipient(m, q.to, { open: o.menu }); S.txt(m, "posée par", { size: 11, color: C.dim }); mention(m, q.by); S.txt(m, q.age, { size: 11, color: C.dim });
  if (q.provisional && !q.answer) S.txt(m, "· provisoire : " + q.provisional, { size: 11, color: C.mfg });
  S.fillX(S.txt(card, q.ctx, { size: 12, color: C.mfg, lh: 1.4 }));
  if (q.answer) { const a = S.col(card, { gap: 4, pad: [10, 12], fill: C.muted, radius: 8 }); S.txt(a, "Réponse : " + q.answer, { size: 13, weight: 600 });
    const r = S.row(a, { gap: 8 }); S.txt(r, "Répondu par " + q.answeredBy, { size: 11, color: C.mfg }); toTransmit(r); return card; }
  if (q.sent) { S.txt(card, "Options : " + q.options.join(" · "), { size: 11, color: C.mfg });
    const s = S.row(card, { name: "ExternalWait", gap: 8, pad: [8, 10], radius: 8, fill: C.muted }); S.icon(s, "send", 13, C.mfg); S.fillX(S.txt(s, q.sent, { size: 12 }));
    S.button(s, "Exporter à nouveau", "ghost", { sm: true, icon: "copy" }); orangeButton(s, "Coller la réponse", "clipboardPaste"); return card; }
  if (q.to !== "Moi (technique)") { const r = S.row(card, { gap: 8 }); S.txt(r, "Options : " + q.options.join(" · "), { size: 11, color: C.mfg }); S.spacer(r);
    S.button(r, "Exporter la question", "outline", { sm: true, icon: "share" }); S.button(r, "Répondre moi-même", "ghost", { sm: true }); return card; }
  answerForm(card, q); return card; };
const group = (c, key, qs, n, o = {}) => { const h = S.row(c, { gap: 8, pad: [6, 0, 0, 0] }); S.txt(h, key, { size: 11, mono: true, color: C.mfg }); S.txt(h, TICKET[key], { size: 13, weight: 600 }); S.spacer(h);
  if (n) orangeButton(h, "Transmettre à l'agent (" + n + ")", "send"); return qs.map(q => qCard(c, q, { menu: o.menu === q })); };
const QNAV = "Questions";
const addNav = (f) => { const sb = find(f, "Sidebar"); const notes = item(f, "Notes"); if (!sb || !notes) return null;
  const it = S.navItem(null, "messageQuestion", QNAV, { indent: 14, active: true, count: 9 }); sb.insertChild(sb.children.findIndex(x => x.id === notes.id) + 1, it); S.fillX(it); return it; };
S.fixP6Nav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^P6/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), a = item(f, "Notes"), it = item(f, QNAV);
  if (!sb || !a || !it) return n; sb.insertChild(0, it); sb.insertChild(sb.children.findIndex(x => x.id === a.id) + 1, it); return n + 1; }, 0);
const page = async (name, col, row, on) => { const r = await appScreen(PAGE, name, col, row, null, ["Kibo", "Questions"], ["messageQuestion", "Kibo · Questions"]); addNav(r.frame); S.fixIconOrder(r.frame);
  const c = r.content; c.flex.rowGap = 12; filterBar(c, on); return r; };

// ---------- P6a · Tous : destinataire, export en attente, réponse à transmettre ----------
S.draw.p6a = async () => { const { frame: f, content: c } = await page("P6a · Questions : destinataires, filtre Tous", 6, 0, "Tous");
  const [, read] = group(c, "KIB-14", [Q.port, Q.read, Q.archived], 1, { menu: Q.read });
  group(c, "KIB-16", [Q.rules]); S.txt(c, "+ 4 autres questions ouvertes sur KIB-11 et KIB-12", { size: 12, color: C.mfg });
  await wait(1800); const m = find(read, "RecipientMenu"); const p = rel(f, m);
  const lb = listbox(f, p.x, p.y + p.h + 6, [["Moi (technique)", false, s => S.icon(s, "user", 13, C.mfg), { hint: "4" }], ["Produit", true, s => S.icon(s, "user", 13, C.mfg), { hint: "proposé par l'agent" }],
    ["Client", false, s => S.icon(s, "user", 13, C.mfg), { hint: "2" }], ["Ajouter un destinataire…", false, s => S.icon(s, "plus", 13, C.mfg)]], 300);
  S.frontAbs(f); await wait(2500); lb.x = m.x; lb.y = m.y + m.height + 6; return f.id; };

// ---------- P6b · Client : dialogue « Exporter la question » ----------
const clientList = async (name, col, row) => { const r = await page(name, col, row, "Client"); group(r.content, "KIB-12", [Q.history]); group(r.content, "KIB-16", [Q.rules]); return r; };
S.draw.p6b = async () => { const { frame: f } = await clientList("P6b · Questions : filtre Client, exporter", 8, 0);
  const d = formDialog(f, "Exporter la question", 560, "Texte prêt à coller dans un mail ou sur Slack : contexte, question, options.");
  const top = S.row(d, { gap: 12 }); segmented(top, ["Mail", "Slack"], "Mail"); S.spacer(top); S.txt(top, "KIB-12 · Pour : Client", { size: 12, color: C.mfg });
  const box = S.box(d, { name: "ExportText", fill: C.bg, stroke: C.border, radius: 8, dir: "column", gap: 0, pad: [12, 14], vs: "auto" }); S.fillX(box);
  EXPORT.forEach(l => S.fillX(S.txt(box, l || " ", { size: 13, lh: 1.5, weight: /^Question/.test(l) ? 600 : 400 })));
  S.check(d, true, "Marquer comme envoyée au client"); help(d, "Quand le client répond, colle sa réponse sur la question : Kibo la transmet à opus-dev-1.");
  S.footer(d, "Fermer", "Copier le texte"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

// ---------- P6c · Coller la réponse du client ----------
S.draw.p6c = async () => { const { frame: f } = await clientList("P6c · Questions : coller la réponse du client", 6, 1);
  const d = formDialog(f, "Coller la réponse du client", 560, "KIB-16 · Moteur de règles déclaratif · posée par opus-dev-3");
  const q = S.panel(d, { gap: 4, pad: [10, 12], fill: C.muted, stroke: C.border }); S.fillX(S.txt(q, Q.rules.title, { size: 13, weight: 600 })); S.txt(q, "Options : " + Q.rules.options.join(" · ") + " · envoyée il y a 2 j", { size: 11, color: C.mfg });
  labeled(d, "Réponse reçue", c => input(c, PASTED, { h: 92, focus: true }));
  labeled(d, "Option la plus proche (facultatif)", c => select(c, "Oui, dans l'interface", { fill: true }));
  const pv = S.col(d, { name: "Preview", gap: 6 }); S.txt(pv, "Aperçu de ce que reçoit opus-dev-3", { size: 12, weight: 500 });
  const b = S.box(pv, { name: "PreviewText", stroke: C.border, radius: 8, dir: "column", gap: 4, pad: [10, 12], vs: "auto" }); S.fillX(b);
  [["Réponse du client à « " + Q.rules.title + " »", C.fg], ["Option : Oui, dans l'interface", C.fg], ["« " + PASTED.replace("\n", " ") + " »", C.mfg]].forEach(([t, col]) => S.fillX(S.txt(b, t, { size: 12, color: col, lh: 1.45 })));
  S.footer(d, "Annuler", "Enregistrer et transmettre", "brand"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

// ---------- P6d · Réglages du projet : destinataires des questions ----------
S.draw.p6d = async () => { const { frame: f } = await page("P6d · Projet : destinataires des questions", 8, 1, "Tous");
  const d = formDialog(f, "Modifier le projet", 560); segmented(d, ["Général", "Agents", "Questions"], "Questions");
  const s = S.col(d, { gap: 6 }); S.txt(s, "Destinataires des questions", { size: 13, weight: 600 });
  help(s, "L'agent propose un destinataire en posant sa question ; tu le corriges d'un clic. Les questions Produit et Client s'exportent en texte.");
  const list = S.panel(d, { gap: 0, pad: [2, 12] });
  [["Moi (technique)", "4 questions ouvertes", "par défaut"], ["Produit", "3 questions ouvertes"], ["Client", "2 questions ouvertes · réponses collées"], ["Design", "aucune question", null, true]].forEach(([n, sub, tag, free], i) => {
    if (i) hline(list); const r = S.row(list, { name: "Recipient-" + n, gap: 10, pad: [10, 0] }); S.icon(r, "user", 14, C.mfg); const c = S.col(r, { gap: 2 }); const t = S.row(c, { gap: 6 });
    S.txt(t, n, { size: 13, weight: 500 }); if (tag) S.badge(t, tag, C.mfg); S.txt(c, sub, { size: 11, color: C.mfg });
    iconButton(r, "pencil"); const del = iconButton(r, "trash", { color: free ? C.red : C.dim }); if (!free) del.opacity = 0.4; });
  const add = S.row(d, { gap: 8 }); input(add, "Juridique", { focus: true }); S.button(add, "Ajouter", "secondary", { sm: true, icon: "plus" });
  help(d, "Supprimer n'est possible que pour un destinataire sans question. Renommer met à jour toutes ses questions.");
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f);
  const tr = find(d, "Recipient-Produit"); const tt = tooltip(f, 0, 0, "Utilisé par 3 questions : impossible de supprimer"); await wait(2000);
  const del = tr.children.reduce((m, c) => (c.x > m.x ? c : m), tr.children[0]); tt.x = del.x + del.width - tt.width + 8; tt.y = del.y + del.height + 6;
  S.frontAbs(f); return f.id; };

S.QUESTIONS_P6 = ["p6a", "p6b", "p6c", "p6d"];
return "pistes-questions ok";
