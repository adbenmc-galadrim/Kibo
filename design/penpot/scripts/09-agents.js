// Page « 07 · Agents (suite) » : écrans 32 à 35 (phase 2, spec §7). Données : design/donnees-fictives.md.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "07 · Agents (suite)";

// En-tête de run commun (32, 33)
const runHeader = (content, o) => {
  const h = S.panel(content, { name: "RunHeader", dir: "row", gap: 16, pad: [16, 20], align: "center" });
  const ic = S.box(h, { name: "ic", fill: C.muted, radius: 8, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(ic, "bot", 20, C.fg);
  const tv = S.col(h, { gap: 4 });
  const t1 = S.row(tv, { gap: 10 }); S.txt(t1, o.run, { size: 16, weight: 600, mono: true }); S.txt(t1, o.ticket, { size: 14, color: C.mfg });
  S.badge(t1, o.state, S.RUN[o.kind], { dot: S.RUN[o.kind], round: true });
  S.sub(tv, o.meta);
  (o.actions || []).forEach(([l, v, i]) => S.button(h, l, v, { sm: true, icon: i }));
  return h; };

const metaPanel = (row, items, extra, fillV = true) => {
  const m = S.panel(row, { name: "RunMeta", w: 300, gap: 10, fillX: false }); if (fillV) S.child(m, { v: "fill" });
  S.h(m, "Run", { size: 13 });
  items.forEach(([k, v, mono, col]) => { const r = S.row(m, { gap: 8, align: "start" }); const kk = S.box(r, { name: "k", w: 96, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.dim });
    S.fillX(S.txt(r, v, { size: 12, mono: !!mono, color: col || C.fg, lh: 1.4 })); });
  if (extra) extra(m); return m; };

S.draw[32] = async () => {
  await S.page(PAGE);
  const r = S.screenX("32 · Détail d'un run", 0, 0, "Agents", ["Agents", "Runs", "#42 · opus-dev-1"], ["bot", "Agents"], { nav: "Agents" });
  const c = r.content;
  runHeader(c, { run: "opus-dev-1", ticket: "KIB-12 · Schéma Loro des tickets (LoroTree)", state: "En cours · créneau 1", kind: "running",
    meta: "Démarré à 10:26 · 12 min · worktree kib-12 · session 7f3c…a91e · 48k tokens",
    actions: [["Ouvrir le ticket", "outline", "ticket"], ["Changements", "outline", "git"], ["Arrêter", "outline", "square"]] });
  const row = S.row(c, { gap: 16, align: "start" }); S.child(row, { v: "fill" });
  // Timeline des hooks
  const tl = S.panel(row, { name: "Timeline", gap: 10, w: 520 }); S.child(tl, { v: "fill" });
  const th = S.row(tl); S.h(th, "Timeline des hooks", { size: 13 }); S.spacer(th);
  for (const l of ["Tous", "Outils", "Sous-agents"]) S.badge(th, l, l === "Tous" ? C.fg : C.mfg, { fill: l === "Tous" ? C.accent : null });
  const L = [["10:26", "SessionStart", ["brief.md + 3 guidelines Core chargés"]],
    ["10:27", "PreToolUse", ["Read ", { link: "packages/core/src/ticket-tree.ts" }]],
    ["10:29", "PostToolUse", ["Edit ", { link: "packages/core/src/ticket-tree.ts:42" }]],
    ["10:31", "PostToolUse", ["Write ", { link: "packages/schema/src/link.ts" }]],
    ["10:33", "SubagentStart", ["haiku-tests · KIB-28 (créneau du parent)"], C.purple],
    ["10:35", "PostToolUse", ["Bash bun test packages/core · 31 passés"]],
    ["10:36", "SubagentStop", ["haiku-tests · générateur d'opérations prêt"], C.purple],
    ["10:37", "PostToolUse", ["Edit ", { link: "packages/core/src/move.ts:88" }]],
    ["10:38", "PreToolUse", ["Bash bun test packages/core/src/convergence.test.ts"]]];
  L.forEach(([t, e, x, col]) => S.hookLine(tl, t, e, x, { color: col || (e === "SessionStart" ? C.green : C.blue) }));
  const now = S.row(tl, { gap: 8 }); S.spinner(now, C.blue, 12); S.txt(now, "En cours : Bash · 14 s", { size: 12, color: C.blue });
  // Transcript
  const tr = S.panel(row, { name: "Transcript", gap: 12, fillX: false }); S.child(tr, { h: "fill", v: "fill" });
  const trh = S.row(tr); S.h(trh, "Transcript", { size: 13 }); S.spacer(trh); S.txt(trh, "session.jsonl · 214 lignes", { size: 11, mono: true, color: C.dim });
  const msg = (who, txt, o = {}) => { const m = S.col(tr, { gap: 4, pad: [10, 12], fill: o.user ? C.muted : null, stroke: o.user ? null : C.border, radius: 8 });
    const hd = S.row(m, { gap: 6 }); S.icon(hd, o.user ? "user" : o.tool ? "terminal" : "bot", 13, C.mfg); S.txt(hd, who, { size: 11, weight: 600, color: C.mfg }); S.spacer(hd); if (o.tok) S.txt(hd, o.tok, { size: 10, mono: true, color: C.dim });
    S.fillX(S.txt(m, txt, { size: 12, lh: 1.5, mono: !!o.tool, color: o.tool ? C.mfg : C.fg })); return m; };
  msg("brief.md", "KIB-12 · Schéma Loro des tickets. Sous-tickets : KIB-24, KIB-25, KIB-26 terminés ; KIB-27 en cours ; KIB-29 à faire.", { user: true });
  msg("opus-dev-1", "Je repars de ticket-tree.ts. Il manque l'opération reparent atomique : je l'ajoute avant d'écrire les tests de convergence.", { tok: "1,2k" });
  msg("Edit", "packages/core/src/move.ts  +18 −4", { tool: true });
  msg("opus-dev-1", "Je délègue le générateur d'opérations concurrentes à haiku-tests (KIB-28) et je lance la suite fast-check.", { tok: "0,8k" });
  // Méta
  metaPanel(row, [["Profil", "opus-dev", true], ["Modèle", "Claude Opus 5.5"], ["Mode", "CLI headless · acceptEdits"], ["Espace", "worktree kib-12", true], ["Branche", "kib-12", true],
    ["Créneau", "hôte 1/3 · profil 1/2"], ["Sous-agent", "haiku-tests · KIB-28"], ["Tokens", "48k (abonnement)"], ["Fichiers", "4 modifiés · +212 −37"]],
    m => { S.fillX(S.box(m, { name: "sep", fill: C.border, h: 1, w: 10 })); S.h(m, "Fichiers touchés", { size: 13 });
      for (const [f, d] of [["ticket-tree.ts", "+96 −12"], ["move.ts", "+18 −4"], ["link.ts", "+41 −0"], ["convergence.test.ts", "+57 −21"]]) { const rr = S.row(m, { gap: 6 }); S.icon(rr, "fileCode", 13, C.mfg); S.fillX(S.txt(rr, f, { size: 12, mono: true, color: C.blue })); S.txt(rr, d, { size: 11, mono: true, color: C.dim }); } });
  return S.done(r.frame); };

S.draw[33] = async () => {
  await S.page(PAGE);
  const r = S.screenX("33 · Run échoué", 0, 1, "Agents", ["Agents", "Runs", "#39 · opus-dev"], ["bot", "Agents"], { nav: "Agents" });
  const c = r.content;
  runHeader(c, { run: "opus-dev", ticket: "KIB-7 · Tokens shadcn + thème sombre", state: "Échec", kind: "failed",
    meta: "Terminé hier à 17:42 · 27 min · worktree kib-7 · 63k tokens · code de sortie 1",
    actions: [["Voir le transcript", "outline", "file"], ["Relancer", "brand", "play"]] });
  S.alert(c, "Échec : les tests ne passent pas", "red", { desc: "Le hook Stop a reçu un code de sortie 1 après « bun test packages/ui ». Le créneau est libéré ; le ticket reste En cours.", icon: "circleX", actions: [["Ouvrir les changements", "outline"]] });
  const row = S.row(c, { gap: 16, align: "start" }); S.child(row, { v: "fill" });
  const tl = S.panel(row, { name: "Timeline", gap: 10, fillX: false }); S.child(tl, { h: "fill", v: "fill" });
  S.h(tl, "Timeline des hooks", { size: 13 });
  [["17:15", "SessionStart", ["brief.md + 2 guidelines UI chargés"], C.green], ["17:18", "PostToolUse", ["Write ", { link: "packages/ui/src/theme.css" }]],
   ["17:26", "PostToolUse", ["Edit ", { link: "packages/ui/src/components/ui/button.tsx:14" }]], ["17:39", "PostToolUse", ["Bash bun test packages/ui · 2 échecs"], C.red],
   ["17:41", "PostToolUse", ["Bash bun test packages/ui · 2 échecs"], C.red], ["17:42", "Stop", ["exit 1 · « Je n'arrive pas à corriger le contraste »"], C.red]]
    .forEach(([t, e, x, col]) => S.hookLine(tl, t, e, x, { color: col || C.blue }));
  S.h(tl, "Sortie du dernier outil", { size: 13 });
  S.code(tl, [["✗ theme > contraste texte secondaire ≥ 4.5:1", C.red], ["  attendu 4.5, reçu 3.9  (packages/ui/src/theme.test.ts:31)", C.mfg], ["✗ button > variante brand en clair", C.red], ["  attendu #C2410C, reçu #F97316  (button.test.tsx:22)", C.mfg], ["48 passés · 2 échecs · 1,8 s", C.dim]]);
  const side = S.col(row, { w: 300, gap: 16 });
  metaPanel(side, [["Profil", "opus-dev", true], ["Modèle", "Claude Opus 5.5"], ["Espace", "worktree kib-7", true], ["Durée", "27 min"], ["Tokens", "63k"], ["Sortie", "exit 1 (Stop)", false, C.red]], null, false);
  const nx = S.panel(side, { gap: 10 }); S.h(nx, "Et maintenant ?", { size: 13 });
  S.sub(nx, "Relancer reprend la session avec --resume et ajoute la sortie des tests au contexte. Le run repasse par la file d'attente.");
  const b = S.row(nx, { gap: 8 }); S.button(b, "Relancer", "brand", { sm: true, icon: "play" }); S.button(b, "Marquer abandonné", "ghost", { sm: true });
  return S.done(r.frame); };

S.draw[34] = async () => {
  await S.page(PAGE);
  const r = S.screenX("34 · Admission en pause (seuil dépassé)", 0, 2, "Agents", ["Agents", "Files d'attente"], ["clock", "Files d'attente"], { nav: "Agents" });
  S.topAction(r.frame, "Reprendre l'admission", "outline", "play");
  const c = r.content;
  S.alert(c, "Admission en pause : RAM au-dessus du seuil (93 % > 90 %)", "amber", { desc: "Aucun nouveau run ne démarre. Les runs en cours continuent. L'admission reprend seule quand la RAM repasse sous 90 % pendant 30 s.", icon: "pause", actions: [["Reprendre quand même", "outline"]] });
  const cap = S.panel(c, { name: "Capacité", gap: 14, pad: 18 });
  S.h(cap, "Capacité de la machine", { size: 14 });
  const cr = S.row(cap, { gap: 16, align: "start" });
  const slots = S.row(cr, { gap: 10 });
  [["Créneau 1", "opus-dev-1", "KIB-12 · 14m"], ["Créneau 2", "opus-dev-3", "KIB-16 · 6m"], ["Créneau 3", "libre", "admission en pause"]].forEach(([a, b, d], i) => {
    const s = S.col(slots, { gap: 4, pad: [10, 12], stroke: i < 2 ? C.blue : C.border, radius: 8 }); s.strokes = [{ strokeColor: i < 2 ? C.blue : C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, ...(i === 2 ? { strokeStyle: "dashed" } : {}) }];
    S.txt(s, a, { size: 11, color: C.dim }); S.txt(s, b, { size: 13, mono: i < 2, color: i < 2 ? C.fg : C.mfg }); S.txt(s, d, { size: 11, color: i < 2 ? C.mfg : C.amber }); });
  const g = S.col(cr, { w: 320, gap: 12 });
  const gauge = (lbl, val, pct, seuil, col) => { const gg = S.col(g, { gap: 6 }); const hr = S.row(gg); S.txt(hr, lbl, { size: 12 }); S.spacer(hr); S.txt(hr, val, { size: 11, mono: true, color: col === C.amber ? C.amber : C.mfg });
    const bar = S.box(gg, { name: "bar", fill: C.accent, radius: 3, h: 6, w: 320 }); const fillb = S.box(bar, { name: "val", fill: col, radius: 3, h: 6, w: Math.round(320 * pct) }); penpotUtils.setParentXY(fillb, 0, 0);
    const mk = S.box(bar, { name: "seuil", fill: C.fg, w: 2, h: 10 }); penpotUtils.setParentXY(mk, Math.round(320 * seuil), -2); };
  gauge("CPU", "71 %  ·  seuil 85 %", 0.71, 0.85, C.blue); gauge("RAM", "14,9 / 16 Go · 93 %  ·  seuil 90 %", 0.93, 0.9, C.amber);
  S.txt(g, "Seuils modifiables dans Paramètres › Agents", { size: 11, color: C.dim });
  S.h(c, "File d'attente · 3 runs", { size: 14 });
  const q = S.panel(c, { gap: 8, pad: 12 });
  [["#1", "opus-dev", "KIB-10 · Watcher git et gh", "prioritaire · attend l'admission (RAM)"], ["#2", "opus-dev", "KIB-18 · Adaptateur GitHub Issues", "attend un créneau opus-dev (2/2)"], ["#3", "opus-dev", "KIB-29 · Migration v0 → v1", "attend un créneau hôte"]]
    .forEach(([n, p, t, why], i) => { const rr = S.row(q, { gap: 12, pad: [8, 10], stroke: C.border, radius: 6 }); S.icon(rr, "more", 14, C.dim); S.badge(rr, n, C.cyan, { mono: true }); S.txt(rr, p, { size: 12, mono: true }); S.fillX(S.txt(rr, t, { size: 13 }));
      S.dot(rr, i === 0 ? C.amber : C.cyan, 7); S.txt(rr, why, { size: 12, color: i === 0 ? C.amber : C.mfg }); });
  // barre d'état : admission en pause
  const qs = penpotUtils.findShape(s => s.name === "QueueSegment", r.frame); const pz = S.badge(null, "Admission en pause", C.amber, { icon: "pause" }); qs.insertChild(qs.children.length - 1, pz);
  const t33 = qs.children.find(c => c.type === "text" && c.characters === "3/3"); if (t33) S.setText(t33, "2/3"); const hs = qs.children.find(c => c.name === "HostSlots"); if (hs) { const sl = hs.children[hs.children.length - 1]; sl.fills = [{ fillColor: C.accent, fillOpacity: 1 }]; }
  return S.done(r.frame); };

S.draw[35] = async () => {
  await S.page(PAGE);
  const r = S.screenX("35 · Notification : réponse attendue", 0, 3, "Kanban", ["Kibo", "Kanban"], ["kanban", "Kibo · Kanban"]);
  S.fillKanban(r.content);
  const f = r.frame;
  // Notification système macOS (en haut à droite)
  const n = S.box(f, { name: "SystemNotification", fill: "#2B2B2E", stroke: "#3F3F46", radius: 14, w: 360, dir: "row", gap: 12, pad: 14, vs: "auto", align: "start" });
  n.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 12, blur: 32, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; n.layoutChild.absolute = true; penpotUtils.setParentXY(n, 1440 - 360 - 16, 52);
  S.logo(n, 32, "dark"); const tv = S.col(n, { gap: 3 }); const hr = S.row(tv); S.txt(hr, "Kibo", { size: 13, weight: 600 }); S.spacer(hr); S.txt(hr, "maintenant", { size: 11, color: C.mfg });
  S.txt(tv, "opus-dev-2 attend ta réponse · KIB-14", { size: 13, weight: 500 }); S.sub(tv, "« Quel port pour le récepteur ? 4747 (défaut) ou dynamique ? »");
  const ba = S.row(tv, { gap: 8 }); S.button(ba, "Répondre", "secondary", { sm: true }); S.button(ba, "Ouvrir", "ghost", { sm: true });
  // Popover de réponse depuis la barre d'état
  const p = S.box(f, { name: "ReplyPopover", fill: C.card, stroke: "#78350F", radius: 10, w: 440, dir: "column", gap: 12, pad: 16, vs: "auto" });
  p.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 12, blur: 32, spread: 0, color: { color: "#000000", opacity: 0.5 } }]; p.layoutChild.absolute = true;
  const ph = S.row(p, { gap: 8 }); S.dot(ph, C.amber, 8); S.txt(ph, "opus-dev-2", { size: 13, weight: 600, mono: true }); S.txt(ph, "KIB-14 · Récepteur de hooks", { size: 12, color: C.mfg }); S.spacer(ph); S.txt(ph, "attend depuis 3 min", { size: 11, color: C.amber });
  S.code(p, [["Quel port pour le récepteur ? 4747 (défaut) ou dynamique ?", C.fg]]);
  S.field(p, "Ta réponse", "Port dynamique, écrit dans ~/.kibo/daemon.json", { focus: true });
  const pf = S.row(p, { gap: 8 }); S.sub(pf, "Créneau libéré : ta réponse replace le run en tête de file (--resume).", { size: 11, color: C.dim }); S.button(pf, "Envoyer", "brand", { sm: true });
  penpotUtils.setParentXY(p, 1440 - 440 - 16, 940 - 40 - 8 - 250);
  S.frontAbs(f);
  return S.done(r.frame); };
return "agents ok";
