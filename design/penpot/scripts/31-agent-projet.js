// Page « 26 · Agent de projet » : écrans 174 à 177 (phase 18, spec §24.7 et §24.9). Requiert 18-socle.js et 24-socle-suite.js.
// Données : design/donnees-fictives.md, section « Agent de projet (phase 18) ». Textes : packages/ui/src/i18n/fr-project-agent.ts.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "26 · Agent de projet";
const { find, wait, shadow, abs, input, select, help, hline, labeled, menu, alertDialog, appScreen, kanbanAt } = S.fx;
const { iconButton } = S.fx2;

Object.assign(S.ICONS, {
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  bookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  bookSearch: '<path d="M11 22H5.5a1 1 0 0 1 0-5h4.501"/><path d="m21 22-1.879-1.878"/><path d="M3 19.5v-15A2.5 2.5 0 0 1 5.5 2H18a1 1 0 0 1 1 1v8"/><circle cx="17" cy="18" r="3"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
});

// ---------- Données (donnees-fictives.md) ----------
const SUMMARY = "Avancer KIB-9, débloquer KIB-14 et garder la mémoire à jour";
const BATCH = [
  ["Tickets", [
    { title: "Créer le ticket « Tests du récepteur de hooks »", why: "KIB-14 n'a pas encore de test d'intégration", on: true, res: ["applied", "KIB-30"] },
    { title: "KIB-9 : passer en En cours", diff: ["À faire", "En cours"], why: "2 sous-tickets sur 3 terminés", on: true, res: ["stale", "statut modifié depuis la proposition"] }]],
  ["Agents", [{ title: "Transmettre les réponses de KIB-14", why: "Une réponse attend depuis 5 min", on: true, res: ["applied"] }]],
  ["Questions", [{ title: "Question sur KIB-21 : « Lancer l'audit sans attendre KIB-11 ? »", why: "Bloqué depuis 6 jours", on: false, res: ["skipped"] }]],
  ["Notes", [{ title: "Mettre à jour la note agent-de-projet/memoire.md", replaced: true, why: "Mémoire de la semaine", on: true, res: ["applied"] }]],
];
const OUTCOME = { applied: "Appliquée", stale: "Périmée", failed: "Échec", skipped: "Ignorée" };
const TONE = { applied: () => C.green, stale: () => C.amber, failed: () => C.red, skipped: () => C.mfg };
const REPLY = [["KIB-11", "en review depuis 2 jours ; la PR #15 est relue par sonnet-review, il ne manque que ta review."],
  ["KIB-14", "opus-dev-2 attend ta réponse sur le port ; une réponse est déjà prête à transmettre."],
  ["KIB-21", "bloqué par l'audit externe, et il bloque KIB-22."],
  ["KIB-9", "2 sous-tickets sur 3 terminés : il peut passer en cours."]];
const PAST = ["Session du 6 octobre à 18:42", "Session du 29 septembre à 10:05"];

// ---------- Panneau ----------
const W = 440, X = 1440 - W, Y = 92, H = 940 - 92;
const recolor = (s, col) => penpotUtils.findShapes(x => x.strokes?.length, s).forEach(x => x.strokes = x.strokes.map(k => ({ ...k, strokeColor: col })));
const STATUS = { ready: "Prêt", queued: "En file", thinking: "Réfléchit…", batch: "Lot à valider" };
const header = (p, status) => { const h = S.row(p, { name: "PanelHeader", gap: 8, pad: [8, 12] });
  S.icon(h, "sparkles", 16, C.brand); S.fillX(S.txt(h, "Agent de projet · Kibo", { size: 13, weight: 600 }));
  const active = status === "thinking" || status === "batch";
  S.badge(h, STATUS[status], active ? C.brand : C.mfg, { round: true, stroke: active ? C.brand : C.border });
  iconButton(h, "more"); iconButton(h, "x"); hline(p); return h; };
const compose = (p, text) => { hline(p); const c = S.col(p, { name: "ComposeBox", gap: 8, pad: 12 });
  input(c, text, { placeholder: true, h: 80 });
  const r = S.row(c, { gap: 8 }); S.fillX(S.txt(r, "⌘↵ pour envoyer", { size: 11, color: C.dim })); S.button(r, "Envoyer", "brand", { sm: true, icon: "send", disabled: true }); return c; };
const panel = (f, o) => { const p = S.box(f, { name: "ProjectAgentPanel", fill: C.bg, stroke: C.border, w: W, h: H, dir: "column", gap: 0 }); shadow(p, 0.35); abs(f, p, X, Y); p.clipContent = true;
  header(p, o.status);
  if (o.banner) { const b = S.row(p, { name: "PastBanner", gap: 8, pad: [4, 12], fill: C.muted }); S.fillX(S.txt(b, "Ancien agent · lecture seule", { size: 11, color: C.mfg }));
    S.button(b, "Retour", "ghost", { sm: true, icon: "arrowLeft" }); hline(p); }
  const body = S.box(p, { name: "Conversation", dir: "column", gap: 12, pad: 12 }); S.fillX(body); S.child(body, { v: "fill" }); body.clipContent = true;
  o.body(body);
  if (o.compose) compose(p, o.compose);
  return p; };
const agentButton = async (f, pending) => { S.topAction(f, "Partager", "outline", "share2"); const b = S.topAction(f, "Agent de projet", "secondary", "sparkles");
  b.name = "ProjectAgentButton"; recolor(b.children.find(c => /^icon/.test(c.name)) || b, C.brand);
  if (!pending) return b; await wait(1200); b.clipContent = false;
  const d = S.dot(b, C.brand, 8); d.name = "PendingDot"; d.strokes = [{ strokeColor: C.bg, strokeWidth: 2, strokeAlignment: "outer", strokeOpacity: 1 }];
  if (d.layoutChild) d.layoutChild.absolute = true; penpotUtils.setParentXY(d, Math.round(b.width) - 6, -2); return b; };

// ---------- Conversation ----------
const event = (p, t) => S.fillX(S.txt(p, t, { size: 11, color: C.mfg }));
const user = (p, t) => { const r = S.row(p, { name: "UserMessage", gap: 0 }); S.spacer(r);
  const b = S.box(r, { name: "bubble", fill: C.muted, radius: 8, dir: "row", pad: [8, 12], hs: "auto", vs: "auto" }); S.txt(b, t, { size: 13 }); return r; };
const reading = (p, t) => { const r = S.row(p, { name: "Reading", gap: 6 }); S.icon(r, "bookSearch", 13, C.mfg); S.fillX(S.txt(r, t, { size: 11, color: C.mfg })); return r; };
const agentText = (p, t) => S.fillX(S.txt(p, t, { size: 13, lh: 1.5 }));
const reply = (p, items, outro) => { const c = S.col(p, { name: "AgentMessage", gap: 8 });
  agentText(c, "Voici où en est Kibo cette semaine :");
  items.forEach(([k, t]) => { const r = S.row(c, { gap: 6, align: "start", pad: [0, 0, 0, 4] }); S.txt(r, "•", { size: 13, color: C.mfg, lh: 1.5 });
    S.txt(r, k, { size: 12, mono: true, weight: 600, lh: 1.6 }); S.fillX(S.txt(r, t, { size: 13, lh: 1.5 })); });
  if (outro) agentText(c, outro); return c; };

// ---------- Carte de lot ----------
const actionRow = (p, a, o) => { const r = S.row(p, { name: "Action", gap: 10, align: "start", pad: [8, 0] });
  if (o.select) S.check(r, a.on);
  const c = S.col(r, { gap: 3 }); S.fillX(S.txt(c, a.title, { size: 13, lh: 1.35 }));
  if (a.diff) { const d = S.row(c, { gap: 5 }); const t = S.txt(d, a.diff[0], { size: 11, color: C.mfg }); t.textDecoration = "line-through"; S.icon(d, "arrowRight", 11, C.mfg); S.txt(d, a.diff[1], { size: 11 }); }
  if (a.replaced) S.txt(c, "contenu remplacé", { size: 11, color: C.mfg });
  if (a.why) S.fillX(S.txt(c, a.why, { size: 11, color: C.mfg, lh: 1.35 }));
  if (o.decided) { const rr = S.row(c, { gap: 5 }); S.txt(rr, OUTCOME[a.res[0]], { size: 11, weight: 500, color: TONE[a.res[0]]() });
    if (a.res[1]) S.txt(rr, a.res[1], { size: 11, mono: a.res[0] === "applied", color: C.mfg }); }
  return r; };
const group = (card, name, acts, o) => { const g = S.col(card, { name: "Group-" + name, gap: 0 });
  const h = S.row(g, { gap: 8 }); S.fillX(S.txt(h, name.toUpperCase(), { size: 10, weight: 600, color: C.mfg }));
  if (o.select) S.txt(h, acts.every(a => a.on) ? "Tout décocher" : "Tout cocher", { size: 11, weight: 500 });
  acts.forEach((a, i) => { if (i) hline(g); actionRow(g, a, o); }); return g; };
const batchCard = (p, o = {}) => { const c = S.box(p, { name: "BatchCard", fill: C.card, radius: 10, dir: "column", gap: 12, pad: [12, 14], vs: "auto" }); S.fillX(c);
  c.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: o.decided || o.muted ? 0.35 : 0.6 }];
  const h = S.row(c, { gap: 8 }); S.fillX(S.txt(h, "Lot n° " + (o.seq || 1), { size: 13, weight: 600 })); S.txt(h, (o.count || 5) + " actions", { size: 11, color: C.mfg });
  S.fillX(S.txt(c, o.summary || SUMMARY, { size: 13, lh: 1.35 }));
  if (o.status) S.txt(c, o.status, { size: 12, weight: 500, color: C.mfg });
  (o.groups || BATCH).forEach(([n, acts]) => group(c, n, acts, o));
  if (o.select) { const f = S.row(c, { gap: 8 }); S.spacer(f); S.button(f, "Refuser", "ghost", { sm: true }); S.button(f, "Valider (4)", "brand", { sm: true }); }
  return c; };

const opening = (b) => { event(b, "Session : nouvelle (repartie de zéro)"); user(b, "Que proposes-tu pour la semaine ?");
  reading(b, "lit le projet, lit 12 tickets, lit les questions"); };

// ---------- 174 · Panneau ouvert : conversation ----------
S.draw[174] = async () => { const { frame: f } = await kanbanAt(PAGE, "174 · Agent de projet : panneau et conversation", 0, 0); await agentButton(f, true);
  panel(f, { status: "batch", compose: "Écris à l'agent de projet…", body: b => { opening(b); reply(b, REPLY, "Je te propose un lot de 5 actions ci-dessous ; décoche ce que tu ne veux pas.");
    batchCard(b, { select: true }); } });
  S.frontAbs(f); return f.id; };

// ---------- 175 · Lot à valider ----------
S.draw[175] = async () => { const { frame: f } = await kanbanAt(PAGE, "175 · Agent de projet : lot à valider", 2, 0); await agentButton(f, true);
  panel(f, { status: "batch", compose: "Écris à l'agent de projet…", body: b => { agentText(b, "Je te propose un lot de 5 actions ci-dessous ; décoche ce que tu ne veux pas."); batchCard(b, { select: true }); } });
  S.frontAbs(f); return f.id; };
S.draw["175b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "175b · Agent de projet : lot après décision", 4, 0); await agentButton(f, false);
  panel(f, { status: "ready", compose: "Écris à l'agent de projet…", body: b => { agentText(b, "Je te propose un lot de 5 actions ci-dessous ; décoche ce que tu ne veux pas.");
    batchCard(b, { decided: true, status: "Appliqué en partie" }); } });
  S.frontAbs(f); return f.id; };

// ---------- 176 · Anciens agents, nouvel agent ----------
const decidedConversation = (b) => { opening(b); reply(b, REPLY.slice(0, 2), null); const c = batchCard(b, { decided: true, status: "Appliqué en partie" }); return c; };
S.draw[176] = async () => { const { frame: f } = await kanbanAt(PAGE, "176 · Agent de projet : menu", 0, 1); await agentButton(f, false);
  panel(f, { status: "ready", compose: "Écris à l'agent de projet…", body: decidedConversation });
  menu(f, 1440 - 12 - 224, Y + 44, [["Nouvel agent de projet", "rotateCcw"], ["Anciens agents", "history", { hover: true }], ["Ouvrir la mémoire", "bookOpen"]], 224);
  S.frontAbs(f); return f.id; };
S.draw["176b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "176b · Agent de projet : anciens agents", 2, 1); await agentButton(f, false);
  panel(f, { status: "ready", body: b => { const h = S.row(b, { gap: 8 }); S.button(h, "Retour", "ghost", { sm: true, icon: "arrowLeft" }); S.txt(h, "Anciens agents", { size: 13, weight: 500 });
    const l = S.col(b, { gap: 2 }); PAST.forEach((t, i) => { const r = S.row(l, { name: "PastSession", gap: 8, pad: [8, 10], radius: 6, fill: i === 0 ? C.accent : null }); S.icon(r, "history", 14, C.mfg); S.txt(r, t, { size: 13 }); }); } });
  S.frontAbs(f); return f.id; };
const PAST_GROUPS = [["Tickets", [{ title: "KIB-22 : passer en À faire", diff: ["Backlog", "À faire"], why: "Prévu en phase 1" }]],
  ["Questions", [{ title: "Question sur KIB-21 : « Faut-il un second auditeur ? »", why: "L'audit externe n'a pas de date" }]]];
S.draw["176c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "176c · Agent de projet : ancien agent en lecture seule", 4, 1); await agentButton(f, false);
  panel(f, { status: "ready", banner: true, body: b => { event(b, "Session : nouvelle (première session)"); user(b, "Qu'est-ce qui bloque KIB-21 ?");
    reading(b, "lit KIB-21, lit les questions"); agentText(b, "KIB-21 attend l'audit de sécurité externe, sans date. Il bloque KIB-22 ; KIB-11 doit être fusionné avant.");
    batchCard(b, { status: "Refusé", muted: true, summary: "Relancer l'audit et préparer KIB-22", count: 2, groups: PAST_GROUPS }); } });
  S.frontAbs(f); return f.id; };
S.draw["176d"] = async () => { const { frame: f } = await kanbanAt(PAGE, "176d · Agent de projet : nouvel agent", 0, 2); await agentButton(f, false);
  panel(f, { status: "ready", compose: "Écris à l'agent de projet…", body: decidedConversation });
  alertDialog(f, "Nouvel agent de projet ?", "La conversation actuelle est fermée et reste lisible dans « Anciens agents ». Un lot en attente est abandonné. La note mémoire est gardée.", "Nouvel agent", 480, { variant: "default" });
  S.frontAbs(f); return f.id; };

// ---------- 177 · Profil Agent de projet ----------
const PROFILES = [["opus-dev", "Claude Opus 5.5 · Claude Code", "2 max"], ["sonnet-review", "Claude Sonnet 5 · Claude Code", "1 max"], ["Agent de projet", "Claude Opus 5.5 · Système", "1 tour par projet"]];
S.draw[177] = async () => { const r = await appScreen(PAGE, "177 · Profil Agent de projet", 2, 2, null, ["Agents"], ["bot", "Agents"]); const { frame: f, content: c } = r; S.activate(f, "Agents");
  S.sub(c, "Un run est le travail d'un agent sur un ticket.", { size: 13 });
  const pl = S.panel(c, { gap: 0, pad: [4, 16] }); S.txt(pl, "Profils", { size: 13, weight: 600 }).name = "title";
  PROFILES.forEach(([n, m, par], i) => { if (i) hline(pl); const row = S.row(pl, { gap: 10, pad: [10, 0], fill: i === 2 ? C.accent : null }); S.icon(row, i === 2 ? "sparkles" : "bot", 14, i === 2 ? C.brand : C.mfg);
    S.txt(row, n, { size: 13, weight: 500, mono: i < 2 }); S.fillX(S.txt(row, m, { size: 12, color: C.mfg })); if (i === 2) S.badge(row, "Système", C.mfg); S.txt(row, par, { size: 12, color: C.mfg }); });
  S.overlay(f, 0.3);
  const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 520, h: 900, dir: "column", gap: 16, pad: [20, 24] }); shadow(sh); abs(f, sh, 1440 - 520, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); S.fillX(S.txt(hd, "Profil Agent de projet", { size: 17, weight: 600 })); iconButton(hd, "x");
  help(sh, "Profil utilisé par Kibo pour l'IA dans le produit.");
  labeled(sh, "Modèle", x => select(x, "Claude Opus 5.5", { fill: true }));
  const par = S.col(sh, { gap: 6 }); S.txt(par, "Runs en parallèle (profil)", { size: 12, weight: 500 }); S.txt(par, "1", { size: 13 }); help(par, "1 tour à la fois par projet");
  const en = S.row(sh, { gap: 8 }); S.fillX(S.txt(en, "Activé", { size: 12, weight: 500 })); S.toggle(en, true);
  const gl = S.col(sh, { gap: 8 }); help(gl, "Consignes : guidelines du profil"); S.txt(gl, "Guidelines supplémentaires", { size: 12, weight: 500 });
  [["guidelines/lots.md", "Huit actions au plus par lot ; une raison courte pour chacune."], ["guidelines/priorites.md", "Les tickets urgents et les questions bloquantes d'abord."]].forEach(([p, t]) => {
    const g = S.panel(gl, { gap: 6, pad: [8, 10], radius: 6, fill: C.bg }); const gr = S.row(g, { gap: 8 }); S.icon(gr, "fileText", 14, C.mfg); S.fillX(S.txt(gr, p, { size: 12, mono: true })); S.icon(gr, "trash", 13, C.dim);
    help(g, t, C.mfg); });
  const add = S.row(gl, { gap: 8, pad: [4, 10], radius: 6, stroke: C.border }); S.icon(add, "fileText", 14, C.mfg); S.fillX(S.txt(add, "guidelines/front.md", { size: 12, color: C.dim })); S.icon(add, "plus", 13, C.dim);
  S.frontAbs(f); return f.id; };

S.AGENT_PROJET = [174, 175, "175b", 176, "176b", "176c", "176d", 177];
return "agent-projet ok";
