// Page « 33 · Questions : modifier, rouvrir, archiver » : écrans 202 à 206 (phase 23, spec §30.6 à §30.8 et §30.11). Requiert 18-socle.js, 24-socle-suite.js, 32b et 32d (primitives S.vis et S.visQ).
// D'après les captures screens/2026-10-12-p23-t16, p23-t17 et p23-qactions (actions dans l'en-tête de la carte) ; données : design/donnees-fictives.md, section « Questions : modification et archivage (phase 23) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "33 · Questions : modifier, rouvrir, archiver";
const { find, wait, shadow, abs, rel, hline, input, select, help, segmented, appScreen, kanbanAt } = S.fx;
const { iconButton } = S.fx2;
const { mention, label } = S.vis;
const { orangeButton, recipient, toTransmit, addNav } = S.visQ;

Object.assign(S.ICONS, {
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  archiveRestore: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  messageQuestion: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
});

// ---------- Données (donnees-fictives.md, « Questions : modification et archivage (phase 23) ») ----------
const TITLES = { "KIB-14": "Récepteur de hooks Claude Code", "KIB-11": "Démon : auth par jeton local", "KIB-12": "Schéma Loro des tickets (LoroTree)" };
const Q = {
  write: { key: "KIB-14", to: "Produit", title: "Bloquer l'écriture sur un projet archivé ?", by: "opus-dev-2", age: "il y a 9 min", ctx: "Décision prise **provisoirement** par le run : écriture autorisée pour l'instant.",
    options: ["Oui", "Non"], provisional: "Non", answer: "Oui", answeredBy: "Adam · il y a 5 min" },
  token: { key: "KIB-11", to: "Moi (technique)", title: "Renouveler le jeton local à chaque démarrage ?", by: "sonnet-review", age: "hier", options: ["Oui", "Non"], provisional: "Non",
    answer: "Non", answeredBy: "Adam · hier", delivered: "sonnet-review" },
  port: { key: "KIB-14", to: "Moi (technique)", title: "Quel port pour le récepteur ?", by: "opus-dev-2", age: "il y a 3 min", ctx: "Le récepteur écoute sur 127.0.0.1. Question bloquante : le run attend la réponse.",
    options: ["7420", "Port libre choisi au lancement"], blocking: true },
  read: { key: "KIB-14", to: "Produit", title: "Un composant non autorisé lit-il les fichiers du projet ?", by: "opus-dev-2", age: "il y a 8 min", ctx: "Décision prise **provisoirement** par le run : accès refusé pour l'instant.",
    options: ["Oui", "Non"], provisional: "Non" },
  client: { key: "KIB-14", to: "Client", title: "Quel port pour le récepteur ?", by: "opus-dev-2", age: "il y a 3 j", options: ["7420", "Port libre choisi au lancement"],
    archived: "Archivée par Adam · il y a 2 j" },
};
const HISTORY = ["il y a 2 j · Adam · Archivée", "il y a 2 j · Adam · Rouverte (réponse « Remplacée par la même question sans préfixe » retirée)",
  "il y a 2 j · Adam · Modifiée (titre : « Client - Quel port… » → « Quel port pour le récepteur ? » ; destinataire : Moi (technique) → Client)"];
const BATCH = [
  { title: "Ajouter le destinataire « Galadrim »", why: "Galadrim répond aux questions d'hébergement." },
  { title: "Question sur KIB-14 pour Client : « Quel navigateur minimal ? »", why: "La compatibilité du récepteur dépend du navigateur du client." },
  { title: "Modifier la question « Client - Quel port pour le récepteur ? »", diffs: [["Titre", "Client - Quel port…", "Quel port pour le récepteur ?"], ["Destinataire", "Moi (technique)", "Client"]],
    why: "Le préfixe « Client - » double le destinataire.", hover: true },
  { title: "Rouvrir « Renouveler le jeton local à chaque démarrage ? » (réponse retirée)", why: "La réponse transmise date d'avant la rotation des clés." },
  { title: "Archiver « Client - Faut-il garder l'historique des tickets supprimés ? »", why: "Doublon de la question sans préfixe sur KIB-12." },
];

// ---------- Primitives ----------
const brandIcon = (b) => { if (b) penpotUtils.findShapes(x => x.strokes?.length, b.children.find(k => /^icon/.test(k.name)) || b).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: C.brand }))); return b; };
const topbar = (f) => { S.topAction(f, "Partager", "outline", "share2"); brandIcon(S.topAction(f, "Agent de projet", "ghost", "sparkles")); };
const markdown = (p, t) => { const r = S.row(p, { gap: 0 }); r.flex.wrap = "wrap"; t.split("**").forEach((s, i) => { if (s) S.txt(r, s, { size: 12, color: i % 2 ? C.fg : C.mfg, weight: i % 2 ? 600 : 400 }); }); return r; };
const agentChip = (p, name) => { const a = S.box(p, { name: "AgentMention", stroke: C.border, radius: 999, dir: "row", gap: 4, pad: [1, 7], hs: "auto", vs: "auto", align: "center" });
  S.icon(a, "bot", 11, C.mfg); S.txt(a, name, { size: 10, mono: true }); return a; };
const headAction = (p, t, icon) => { const b = S.button(p, t, "ghost", { sm: true, icon }); b.children.filter(k => k.type === "text").forEach(x => x.fills = [{ fillColor: C.mfg, fillOpacity: 1 }]);
  penpotUtils.findShapes(x => x.strokes?.length, b).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: C.mfg }))); return b; };
const answerBox = (p, q) => { const a = S.box(p, { name: "Answer", fill: C.muted, radius: 8, dir: "column", gap: 4, pad: [10, 12], vs: "auto" }); S.fillX(a);
  S.txt(a, "Réponse : " + q.answer, { size: 13, weight: 600 }); const r = S.row(a, { gap: 8 }); S.txt(r, "Répondu par " + q.answeredBy, { size: 11, color: C.mfg });
  if (q.delivered) { const d = S.row(r, { gap: 4, hs: "auto" }); S.icon(d, "lock", 11, C.mfg); S.txt(d, "transmise à " + q.delivered + " · figée", { size: 11, color: C.mfg }); }
  else if (!q.archived) toTransmit(r); return a; };
const answerForm = (p, q, o = {}) => { const r = S.row(p, { gap: 8 }); if (q.provisional) orangeButton(r, "Valider le choix provisoire", "check");
  q.options.forEach(x => S.button(r, x, x === o.picked ? "secondary" : "outline", { sm: true }));
  const t = S.row(p, { gap: 8 }); S.fillX(input(t, "Autre réponse…", { placeholder: true, size: 12 }));
  if (o.edit) { S.button(t, "Annuler", "ghost", { sm: true }); S.button(t, "Enregistrer", "secondary", { sm: true }); return; }
  S.button(t, "Répondre", "secondary", { sm: true }).opacity = 0.6; const ft = S.row(p, { gap: 8 }); S.spacer(ft); S.button(ft, "Exporter", "outline", { sm: true, icon: "upload" }); orangeButton(ft, "Coller la réponse", "clipboardPaste"); };
const qCard = (p, q, o = {}) => { const card = S.panel(p, { name: "Question", gap: 10, pad: [12, 14], fill: o.spot ? C.brandSoft : undefined, stroke: o.spot ? C.brand : undefined });
  const h = S.row(card, { gap: 8 }); S.fillX(S.txt(h, q.title, { size: 13, weight: 600 })); if (q.blocking) S.badge(h, "bloquante", C.brand, { round: true, stroke: C.brand });
  if (q.archived) S.button(h, "Restaurer", "outline", { sm: true, icon: "archiveRestore" });
  else { if (q.answer && !q.delivered && !o.edit) { headAction(h, "Modifier la réponse", "pencil"); headAction(h, "Retirer la réponse", "undo"); }
    if (q.delivered) headAction(h, "Rouvrir", "rotateCcw"); headAction(h, "Archiver", "archive"); }
  const m = S.row(card, { gap: 8 }); if (q.archived) { const r = S.row(m, { gap: 4, hs: "auto" }); S.icon(r, "user", 11, C.mfg); S.txt(r, "Pour : " + q.to, { size: 11, color: C.mfg }); } else recipient(m, q.to);
  S.txt(m, "posée par", { size: 11, color: C.dim }); agentChip(m, q.by); S.txt(m, q.age, { size: 11, color: C.dim });
  if (q.archived) { const r = S.row(card, { gap: 4 }); S.icon(r, "archive", 11, C.mfg); S.txt(r, q.archived, { size: 11, color: C.mfg }); }
  if (q.ctx) markdown(card, q.ctx);
  const opt = S.row(card, { gap: 10 }); S.txt(opt, "Options : " + q.options.join(" · "), { size: 11, color: C.mfg }); if (q.provisional) S.txt(opt, "provisoire : " + q.provisional, { size: 11, color: C.mfg });
  if (q.answer) answerBox(card, q);
  if (o.edit) answerForm(card, q, { edit: true, picked: q.answer }); else if (!q.answer && !q.archived) answerForm(card, q);
  if (o.history) { const hs = S.col(card, { name: "History", gap: 6 }); const hh = S.row(hs, { gap: 6 }); S.icon(hh, "history", 12, C.mfg); S.txt(hh, "Historique (" + o.history.length + ")", { size: 11, weight: 600 });
    const l = S.col(hs, { gap: 4, pad: [0, 0, 0, 12] }); o.history.forEach(t => S.fillX(S.txt(l, t, { size: 11, color: C.mfg, lh: 1.4 }))); }
  return card; };
const qGroup = (c, key, qs, o = {}) => { const h = S.row(c, { gap: 8, pad: [4, 0, 0, 0] }); S.txt(h, key, { size: 11, mono: true, color: C.mfg }); S.txt(h, TITLES[key], { size: 13, weight: 600 }); S.spacer(h);
  if (o.transmit) orangeButton(h, "Transmettre à l'agent (" + o.transmit + ")", "send"); if (o.sent) S.txt(c, o.sent, { size: 12, color: C.mfg }); return qs.map(([q, qo]) => qCard(c, q, qo || {})); };
const qPage = async (name, col, row, view, counts) => { const r = await appScreen(PAGE, name, col, row * 1.4, null, ["Kibo", "Questions"], ["messageQuestion", "Kibo · Questions"]); addNav(r.frame); S.fixIconOrder(r.frame); topbar(r.frame);
  const c = r.content; c.flex.rowGap = 12; const t = S.row(c, { gap: 8 }); segmented(t, ["Ouvertes", "Répondues", "Toutes", "Archivées"], view); select(t, "Tous les tickets");
  S.spacer(t); S.button(t, "Nouvelle question", "secondary", { sm: true, icon: "plus" });
  const fr = S.row(c, { name: "RecipientFilter", gap: 6 }); [["Tous", counts[0]], ["Moi (technique)", counts[1]], ["Produit", counts[2]], ["Client", counts[3]]].forEach(([n, k], i) => {
    const b = S.box(fr, { name: "Filter-" + n, fill: i === 0 ? C.accent : null, stroke: i === 0 ? C.mfg : C.border, radius: 6, dir: "row", gap: 6, pad: [5, 10], hs: "auto", vs: "auto", align: "center" });
    S.txt(b, n, { size: 12, weight: i === 0 ? 600 : 400 }); S.txt(b, String(k), { size: 12, color: C.mfg }); });
  const add = S.row(fr, { gap: 4, hs: "auto", pad: [0, 6] }); S.icon(add, "plus", 12, C.fg); S.txt(add, "Destinataire", { size: 12, weight: 500 }); hline(c); return r; };

// ---------- 202 · Réponse modifiable, réponse transmise figée ----------
S.draw[202] = async () => { const { frame: f, content: c } = await qPage("202 · Questions : réponse modifiable et réponse figée", 0, 0, "Répondues", [2, 1, 1, 0]);
  qGroup(c, "KIB-14", [[Q.write]], { transmit: 1 }); qGroup(c, "KIB-11", [[Q.token]], { sent: "Transmis à sonnet-review" }); return f.id; };

// ---------- 202b · Modifier la réponse ----------
S.draw["202b"] = async () => { const { frame: f, content: c } = await qPage("202b · Questions : modifier la réponse", 2, 0, "Répondues", [2, 1, 1, 0]);
  qGroup(c, "KIB-14", [[Q.write, { edit: true }]], { transmit: 1 }); qGroup(c, "KIB-11", [[Q.token]], { sent: "Transmis à sonnet-review" }); return f.id; };

// ---------- 203 · Archivées et historique ----------
S.draw[203] = async () => { const { frame: f, content: c } = await qPage("203 · Questions : archivée, historique déplié", 4, 0, "Archivées", [1, 0, 0, 1]);
  qGroup(c, "KIB-14", [[Q.client, { history: HISTORY }]]); return f.id; };

// ---------- Panneau de l'agent de projet (repris de 34-signaux-agents) ----------
const W = 440, X = 1440 - W, Y = 92, H = 940 - 92;
const agentButton = (f) => { S.topAction(f, "Partager", "outline", "share2"); const b = brandIcon(S.topAction(f, "Agent de projet", "secondary", "sparkles")); b.name = "ProjectAgentButton"; return b; };
const panel = (f, body) => { const p = S.box(f, { name: "ProjectAgentPanel", fill: C.bg, stroke: C.border, w: W, h: H, dir: "column", gap: 0 }); shadow(p, 0.35); abs(f, p, X, Y); p.clipContent = true;
  const h = S.row(p, { name: "PanelHeader", gap: 8, pad: [8, 12] }); S.icon(h, "sparkles", 16, C.brand); S.fillX(S.txt(h, "Agent de projet · Kibo", { size: 13, weight: 600 }));
  S.badge(h, "Lot à valider", C.brand, { round: true, stroke: C.brand }); iconButton(h, "more"); iconButton(h, "x"); hline(p);
  const tb = S.row(p, { name: "PanelTabs", gap: 16, pad: [8, 12, 0, 12] }); [["Conversation", true], ["Signaux", false]].forEach(([t, a]) => { const x = S.box(tb, { name: "Tab-" + t, dir: "column", gap: 6, hs: "auto", vs: "auto" });
    S.txt(x, t, { size: 12, weight: a ? 600 : 400, color: a ? C.fg : C.mfg }); S.fillX(S.box(x, { name: "underline", fill: a ? C.fg : null, h: 2, w: 10 })); }); hline(p);
  const b = S.box(p, { name: "Conversation", dir: "column", gap: 12, pad: 12 }); S.fillX(b); S.child(b, { v: "fill" }); b.clipContent = true; body(b);
  hline(p); const cp = S.col(p, { name: "ComposeBox", gap: 8, pad: 12 }); input(cp, "Écris à l'agent de projet…", { placeholder: true, h: 64 });
  const r = S.row(cp, { gap: 8 }); S.fillX(S.txt(r, "⌘↵ pour envoyer", { size: 11, color: C.dim })); S.button(r, "Envoyer", "brand", { sm: true, icon: "send", disabled: true }); return p; };
const actionRow = (p, a) => { const r = S.row(p, { name: "Action", gap: 10, align: "start", pad: [8, 0] }); S.check(r, true); const c = S.col(r, { gap: 3 });
  const t = S.txt(c, a.title, { size: 13, lh: 1.35 }); S.fillX(t); if (a.hover) { t.textDecoration = "underline"; t.name = "QuestionRef"; }
  (a.diffs || []).forEach(([k, from, to]) => { const d = S.row(c, { gap: 5 }); S.txt(d, k + " :", { size: 11, color: C.mfg }); const x = S.txt(d, from, { size: 11, color: C.mfg }); x.textDecoration = "line-through"; S.icon(d, "arrowRight", 11, C.mfg); S.txt(d, to, { size: 11 }); });
  S.fillX(S.txt(c, a.why, { size: 11, color: C.mfg, lh: 1.35 })); return r; };
const batchCard = (p) => { const c = S.box(p, { name: "BatchCard", fill: C.card, radius: 10, dir: "column", gap: 10, pad: [12, 14], vs: "auto" }); S.fillX(c);
  c.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 0.6 }];
  const h = S.row(c, { gap: 8 }); S.fillX(S.txt(h, "Lot n° 3", { size: 13, weight: 600 })); S.txt(h, "5 actions", { size: 11, color: C.mfg });
  S.fillX(S.txt(c, "Nettoyer les questions préfixées", { size: 13, lh: 1.35 }));
  const g = S.col(c, { name: "Group-Questions", gap: 0 }); const gh = S.row(g, { gap: 8 }); S.fillX(S.txt(gh, "QUESTIONS", { size: 10, weight: 600, color: C.mfg })); S.txt(gh, "Tout décocher", { size: 11, weight: 500 });
  BATCH.forEach((a, i) => { if (i) hline(g); actionRow(g, a); });
  const ft = S.row(c, { gap: 8 }); S.spacer(ft); S.button(ft, "Refuser", "ghost", { sm: true }); S.button(ft, "Valider (5)", "brand", { sm: true }); return c; };
const conversation = (b) => { const u = S.row(b, { gap: 0 }); S.spacer(u); const bu = S.box(u, { name: "UserMessage", fill: C.accent, radius: 10, dir: "row", pad: [8, 12], hs: "auto", vs: "auto" }); S.txt(bu, "Range les questions préfixées par le client", { size: 13 });
  const e = S.row(b, { gap: 6 }); S.icon(e, "bookSearch", 13, C.mfg); S.txt(e, "lit les questions state=all, lit le projet", { size: 11, color: C.mfg });
  S.fillX(S.txt(b, "J'ai proposé un lot de 5 actions sur les questions.", { size: 13, lh: 1.5 })); return batchCard(b); };

// ---------- 204 · Lot de questions ----------
S.draw[204] = async () => { const { frame: f } = await kanbanAt(PAGE, "204 · Agent de projet : lot de questions", 6, 0); agentButton(f); panel(f, conversation); S.frontAbs(f); return f.id; };

// ---------- 205 · Aperçu de la pastille « 2 questions » ----------
const pill = (p, n) => { const b = S.box(p, { name: "QuestionsBadge", stroke: C.brand, radius: 999, dir: "row", gap: 4, pad: [1, 7], hs: "auto", vs: "auto", align: "center" });
  S.icon(b, "messageQuestion", 11, C.brand); S.txt(b, n + (n > 1 ? " questions" : " question"), { size: 10, weight: 500, color: C.brand }); return b; };
const previewCard = (f, x, y, fill) => { const c = S.box(f, { name: "QuestionPreview", fill: C.card, stroke: C.border, radius: 10, w: 320, dir: "column", gap: 8, pad: 14, vs: "auto" }); shadow(c); abs(f, c, x, y); fill(c); return c; };
const previewLine = (p, title, sub, o = {}) => { const r = S.box(p, { name: "PreviewLine", radius: 6, dir: "column", gap: 3, pad: [6, 6], vs: "auto" }); S.fillX(r);
  const h = S.row(r, { gap: 6 }); S.fillX(S.txt(h, title, { size: 12, weight: 600, lh: 1.35 })); if (o.blocking) S.icon(h, "alert", 12, C.brand); S.txt(r, sub, { size: 11, color: C.mfg }); return r; };
S.draw[205] = async () => { const { frame: f, content: c } = await kanbanAt(PAGE, "205 · Aperçu au survol : pastille 2 questions", 0, 1.4); agentButton(f);
  const cd = find(c, "TicketCard / KIB-14"); const m = cd && cd.children.find(x => x.name === "meta"); const pl = m ? pill(m, 2) : null; const k11 = find(c, "TicketCard / KIB-11"); const m11 = k11 && k11.children.find(x => x.name === "meta"); if (m11) pill(m11, 1);
  await wait(2000); const p = rel(f, pl || cd); const hl = S.box(f, { name: "PillHover", stroke: C.brand, radius: 999, w: p.w + 4, h: p.h + 4 }); abs(f, hl, p.x - 2, p.y - 2);
  previewCard(f, p.x, p.y + p.h + 8, (pc) => { S.txt(pc, "KIB-14 · 2 questions ouvertes", { size: 11, color: C.mfg });
    previewLine(pc, Q.port.title, "Pour : Moi (technique) · ouverte · il y a 3 min", { blocking: true }); previewLine(pc, Q.read.title, "Pour : Produit · ouverte · il y a 8 min"); });
  S.frontAbs(f); return f.id; };

// ---------- 205b · Aperçu d'une question sur une ligne de lot ----------
S.draw["205b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "205b · Aperçu au survol : question d'un lot", 2, 1.4); agentButton(f); panel(f, conversation);
  await wait(4500); const ref = penpotUtils.findShapes(x => x.name === "QuestionRef", f)[0]; const p = rel(f, ref);
  previewCard(f, p.x, p.y + p.h + 6, (pc) => { S.txt(pc, "KIB-14 · " + TITLES["KIB-14"], { size: 11, color: C.mfg }); S.txt(pc, "Client - Quel port pour le récepteur ?", { size: 13, weight: 600 });
    S.fillX(S.txt(pc, "Le récepteur écoute sur 127.0.0.1. Question bloquante : le run attend la réponse.", { size: 12, color: C.mfg, lh: 1.4 }));
    S.txt(pc, "Options : 7420 · Port libre choisi au lancement", { size: 11, weight: 500 }); S.txt(pc, "Pour : Moi (technique) · ouverte", { size: 11, color: C.mfg });
    S.txt(pc, "posée par opus-dev-2 · il y a 3 j", { size: 11, color: C.dim }); });
  S.frontAbs(f); return f.id; };

// ---------- 206 · Question mise en évidence ----------
S.draw[206] = async () => { const { frame: f, content: c } = await qPage("206 · Questions : question mise en évidence", 4, 1, "Ouvertes", [9, 4, 3, 2]);
  qGroup(c, "KIB-14", [[Q.port], [Q.read, { spot: true }]]);
  await wait(1500); const tab = penpotUtils.findShapes(x => x.type === "text" && x.characters === "Kibo · Questions", find(f, "TabBar"))[0]; const p = rel(f, tab || f);
  const tip = S.box(f, { name: "AddressTip", fill: C.primary, radius: 6, dir: "row", gap: 6, pad: [6, 10], hs: "auto", vs: "auto", align: "center" });
  S.txt(tip, "#/p/kibo/questions?question=7f3a9c2e-…", { size: 11, mono: true, color: C.pfg }); abs(f, tip, p.x - 20, p.y + p.h + 10); S.frontAbs(f); return f.id; };

S.fixQEditNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^20[236]/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), a = S.fx.item(f, "Notes"), it = S.fx.item(f, "Questions");
  if (!sb || !a || !it) return n; sb.insertChild(0, it); sb.insertChild(sb.children.findIndex(x => x.id === a.id) + 1, it); return n + 1; }, 0);
S.fixQPreview = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^205b/.test(c.name)).reduce((n, f) => { const ref = penpotUtils.findShapes(x => x.name === "QuestionRef", f)[0];
  const pv = f.children.find(x => x.name === "QuestionPreview"); if (!ref || !pv) return n; pv.x = ref.x; pv.y = ref.y + ref.height + 6; return n + 1; }, 0);
S.QUESTIONS_EDITION = [202, "202b", 203, 204, 205, "205b", 206];
return "questions-edition ok";
