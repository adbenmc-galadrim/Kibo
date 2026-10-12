// Page « 31 · Agents et skills » : écrans 192 à 196 (phase 22, spec §28.8 et §28.13). Requiert 18-socle.js, 24-socle-suite.js, 32b et 32d.
// D'après les captures screens/2026-10-12-roles-agents et 2026-10-11-p20-reel ; données : design/donnees-fictives.md, section « Agents et skills (phase 22) ».
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "31 · Agents et skills";
const { find, wait, shadow, abs, hline, input, select, help, labeled, segmented, formDialog, appScreen } = S.fx;
const { iconButton } = S.fx2;
const { mention, notice, label } = S.vis;
const { orangeButton } = S.visQ;

Object.assign(S.ICONS, {
  bookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  chevUp: '<path d="m18 15-6-6-6 6"/>',
});

// ---------- Données (donnees-fictives.md, « Agents et skills (phase 22) ») ----------
const KIBO = "Projet · Kibo";
const A = {
  livraison: { name: "livraison", scope: "Global", desc: "Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR.", model: "Opus", skills: "3 skills", subs: "0 sous-agent", run: "global · livraison · KIB-14" },
  review: { name: "review-pr", scope: "Global", desc: "Relit une PR en lecture seule et rend un verdict accepté ou refusé, avec des remarques actionnables.", model: "Sonnet", skills: "2 skills", subs: "0 sous-agent", masked: "masqué dans Kibo" },
  seo: { name: "seo-contenu", scope: "Global", desc: "Audite les pages publiques et propose des corrections SEO classées par impact.", model: "Sonnet", skills: "1 skill", subs: "0 sous-agent" },
  chef: { name: "chef-orchestre", scope: "Global", desc: "Enchaîne livraison, review-pr puis seo-contenu comme sous-agents et rend un compte rendu.", model: "Opus", skills: "Tous les skills", subs: "3 sous-agents" },
  dev: { name: "kibo-dev", scope: KIBO, desc: "Implémente une tâche d'un plan de phase Kibo en TDD, dans le worktree et la branche fournis.", model: "Opus", skills: "Tous les skills", subs: "génériques", note: "Écrit à la main · réglages par défaut" },
  reviewKibo: { name: "review-pr", scope: KIBO, desc: "Relit une PR de Kibo selon CLAUDE.md : Biome, TDD, commits en français, aucun commentaire.", model: "Sonnet", skills: "2 skills", subs: "0 sous-agent", run: "kibo · review-pr · KIB-12" },
  sonnet: { name: "sonnet-dev", scope: "Global", desc: "Agent migré du profil Kibo sonnet-dev.", model: "Sonnet", skills: "Tous les skills", subs: "génériques", rename: true },
  ux: { name: "ux-audit", scope: "Global", desc: "Frontmatter illisible : ligne 3, « description » sans valeur.", model: "—", skills: "—", subs: "—", broken: true },
};
const KIBO_AGENTS = ["kibo-assistant", "kibo-generateur", "kibo-demo", "kibo-project-agent"];
const SPEC_LIVRAISON = ["# Livraison", "Tu livres un ticket Kibo de bout en bout.", "", "## Workflow", "1. Lis le ticket et son brief ; relis les fichiers cités.",
  "2. Déclare ton plan avec ticket_progress avant de coder.", "3. TDD : le test d'abord, le voir échouer, puis le code minimal.", "4. Commits en français, une ligne, préfixe conventionnel.",
  "5. Ouvre la PR en brouillon et remplis le compte rendu.", "", "## Règles", "- Pose une question avec ask_question plutôt que deviner.", "- Jamais de --no-verify ni de push forcé.", "- Passe le skill porte-qualite avant de pousser."];
const SPEC_CHEF = ["# Chef d'orchestre", "Tu mènes un ticket jusqu'au bout avec trois sous-agents.", "", "## Workflow", "1. Confie la livraison au sous-agent livraison.",
  "2. Fais relire la PR par review-pr ; relance livraison si refus.", "3. Si le ticket touche une page publique, appelle seo-contenu.", "4. Rends un compte rendu : ce qui est livré, les verdicts, la suite."];
const SKILL_BODY = ["# Porte qualité", "Relis le diff d'une branche avant son push.", "", "## Volet correctness", "Cherche les bugs : cas limites, tests absents.", "",
  "## Volet conventions", "Relis les fichiers touchés par la branche.", "Vérifie le format des commits et le lint.", "", "## Verdict", "« Prêt » ou la liste des points bloquants."];
const SK = {
  user: [["porte-qualite", "Porte qualité d'une branche avant son push, à deux volets : correctness et conventions.", "2 notes", "utilisé il y a 2 h · 9 runs/30 j"],
    ["apply-review", "Récupère les reviews d'une PR, traite chaque point, corrige, vérifie, commite et pousse.", "1 note", "utilisé il y a 1 j · 4 runs/30 j"],
    ["clean-pr", "Démonte l'environnement local d'une PR fusionnée : worktree, branche, conteneurs.", null, "utilisé il y a 5 j · 2 runs/30 j"],
    ["captures-ui", "Capture chaque écran modifié en sombre et en clair dans screens/.", null, "jamais utilisé"]],
  kibo: [["penpot-maquettes", "Dessine un écran Kibo dans Penpot avec les scripts de design/penpot.", null, "utilisé il y a 3 j · 3 runs/30 j"],
    ["clean-pr", "Nettoie une PR de Kibo : worktree sous .claude/worktrees, branche feat/…", null, "jamais utilisé", { masked: true }]],
  fact: [["factures-pdf", "Génère une facture PDF de test à partir d'un devis du dossier fixtures/.", null, "utilisé il y a 9 j · 1 run/30 j"]],
  superpowers: [["superpowers:brainstorming", "Explore l'intention, les besoins et la conception avant tout travail créatif.", "1 note", "utilisé il y a 1 j · 6 runs/30 j"],
    ["superpowers:test-driven-development", "Écrit le test d'abord, le voit échouer, puis le code minimal.", null, "utilisé il y a 2 j · 11 runs/30 j"],
    ["superpowers:writing-plans", "Transforme une spec en plan de tâches avant de toucher au code.", null, "utilisé il y a 6 j · 2 runs/30 j"]],
  design: [["frontend-design:frontend-design", "Guide une direction visuelle nette pour une nouvelle interface.", null, "jamais utilisé"]],
};
const NOTES = [
  { skill: "porte-qualite", verdict: "improve", by: "global · livraison · KIB-14", when: "il y a 2 h", text: "Le volet conventions a relu tout le fichier au lieu du diff.\nIl manque la règle « aucun commentaire » de CLAUDE.md.\nJe bornerais la relecture aux lignes modifiées.", suggestion: true },
  { skill: "porte-qualite", verdict: "ok", by: "kibo · review-pr · KIB-12", when: "hier", text: "Les deux volets ont trouvé le test manquant de receiver.ts.\nRien à changer." },
  { skill: "apply-review", verdict: "improve", by: "global · livraison · KIB-16", when: "il y a 3 j", text: "Le skill ne dit pas quoi faire d'un commentaire déjà résolu sur GitHub.\nJ'ai perdu un tour à le retraiter.", suggestion: true },
];

// ---------- Primitives ----------
const labeledW = (p, t, w, fn, o = {}) => { const c = S.col(p, { name: "Field-" + t, gap: 6, w }); S.txt(c, t, { size: 12, weight: 500 }); fn(c); if (o.help) help(c, o.help); return c; };
const inline = (p, parts, o = {}) => { const r = S.row(p, { gap: 0, hs: o.fill ? undefined : "auto" }); parts.forEach(x => typeof x === "string" ? S.txt(r, x, { size: o.size || 12, color: o.color || C.fg })
  : S.txt(r, x.m, { size: (o.size || 12) - 0.5, mono: true, weight: 500, color: x.color || o.mcolor || C.fg })); return r; };
const scopeBadge = (p, sc) => sc === "Global" ? S.badge(p, "Global", C.mfg, { round: true, icon: "globe" }) : sc === "Kibo" ? S.badge(p, "Agent de Kibo", C.mfg, { round: true, icon: "lock" })
  : S.badge(p, sc, C.mfg, { round: true, dot: C.brand });
const warnBadge = (p, t, icon = "alert") => S.badge(p, t, C.amber, { round: true, icon, stroke: "#78350F" });
const sidebarAgents = (f, active) => { const sb = find(f, "Sidebar"); const ag = S.fx.item(f, "Agents"); if (!sb || !ag) return;
  const q = S.navItem(null, "listOrdered", "Files d'attente", { indent: 14 }); const sk = S.navItem(null, "bookOpen", "Skills", { indent: 14, active: active === "Skills" });
  [q, sk].forEach(x => { sb.insertChild(0, x); S.fillX(x); }); sb.insertChild(sb.children.findIndex(c => c.id === ag.id) + 1, q); sb.insertChild(sb.children.findIndex(c => c.id === q.id) + 1, sk);
  if (!active) S.activate(f, "Agents"); else if (active !== "Skills") S.activate(f, active); S.fixIconOrder(f); };
S.fixAgSkNav = () => penpot.currentPage.root.children.filter(c => c.type === "board" && /^19[2-6]/.test(c.name)).reduce((n, f) => { const sb = find(f, "Sidebar"), ag = S.fx.item(f, "Agents"),
  q = S.fx.item(f, "Files d'attente"), sk = S.fx.item(f, "Skills"); if (!sb || !ag || !q || !sk) return n;
  sb.insertChild(sb.children.findIndex(c => c.id === ag.id) + 1, q); sb.insertChild(sb.children.findIndex(c => c.id === q.id) + 1, sk); return n + 1; }, 0);
const agentBar = (f) => { const bar = find(f, "AgentStatusBar"); if (!bar) return; [...bar.children].forEach(k => k.remove()); bar.flex.columnGap = 10;
  S.icon(bar, "bot", 14, C.fg); S.txt(bar, "Agents", { size: 12, weight: 500 }); S.slotsMini(bar, 2, 4); S.txt(bar, "2/4 places · 1 en file", { size: 11, color: C.mfg });
  [["global · livraison · KIB-14", "18m"], ["kibo · review-pr · KIB-12", "6m"]].forEach(([n, t]) => { const c = S.row(bar, { gap: 6, hs: "auto" }); S.dot(c, C.blue, 7); mention(c, n, { size: 11 }); S.txt(c, t, { size: 11, color: C.mfg }); });
  S.spacer(bar); S.dot(bar, C.green, 6); S.txt(bar, "Kibo · connecté", { size: 11, color: C.mfg }); S.icon(bar, "chevUp", 14, C.mfg); };
const ROW = 1.4;
const screen = async (name, col, row, crumbs, o = {}) => { const skills = o.nav === "Skills";
  const r = await appScreen(PAGE, name, col, row * ROW, "Agents", crumbs, o.tab || (skills ? ["bookOpen", "Agents · Skills"] : ["bot", crumbs.join(" · ")]));
  if (o.h) r.frame.resize(1440, o.h); sidebarAgents(r.frame, o.nav); agentBar(r.frame); if (o.action) S.topAction(r.frame, o.action[0], "outline", o.action[1]); return r; };
const codeLines = (p, lines, o = {}) => { const b = S.box(p, { name: o.name || "CodeEditor", fill: o.fill || C.bg, stroke: o.stroke === false ? null : C.border, radius: 8, dir: "row", gap: 0, vs: "auto" }); S.fillX(b); b.clipContent = true;
  const g = S.box(b, { name: "Gutter", dir: "column", gap: 0, pad: [10, 10, 10, 8], w: 40, vs: "auto", align: "end" });
  const t = S.col(b, { name: "Lines", gap: 0, pad: [10, 12] });
  lines.forEach((l, i) => { S.txt(g, String(i + 1), { size: 12, mono: true, color: C.dim, lh: 1.6 });
    S.txt(t, l || " ", { size: 12, mono: true, lh: 1.6, weight: /^#/.test(l) ? 600 : 400, color: /^#/.test(l) ? C.fg : /^(-|\d\.)/.test(l) ? C.fg : C.mfg }); }); return b; };
const preview = (p, lines) => { const c = S.col(p, { name: "Preview", gap: 6, pad: [12, 16] }); lines.forEach(l => { if (!l) return;
  if (/^# /.test(l)) S.txt(c, l.slice(2), { size: 17, weight: 600 }); else if (/^## /.test(l)) S.txt(c, l.slice(3), { size: 14, weight: 600 });
  else S.fillX(S.txt(c, /^- /.test(l) ? "•  " + l.slice(2) : l, { size: 13, lh: 1.45, color: C.fg })); }); return c; };
const modeBar = (p, on, extra, skill) => { const r = S.row(p, { gap: 8 }); S.txt(r, skill ? "Corps du skill" : "Spec", { size: 13, weight: 600 }); S.txt(r, skill ? "SKILL.md, sans le frontmatter" : "corps du fichier, façon CLAUDE.md", { size: 12, color: C.mfg });
  S.spacer(r); if (extra) extra(r); segmented(r, ["Édition", "Aperçu", "Côte à côte"], on); return r; };
const section = (p, title, sum, open) => { const s = S.panel(p, { name: "Section-" + title, gap: 14, pad: [12, 16] }); const h = S.row(s, { gap: 8 });
  S.icon(h, open ? "chevDown" : "chevRight", 14, C.mfg); S.txt(h, title, { size: 13, weight: 600 }); if (sum) S.fillX(S.txt(h, sum, { size: 12, color: C.mfg })); return s; };
const inClaude = (p, name, desc) => { const r = S.box(p, { name: "ClaudeCodePreview", fill: C.muted, radius: 6, dir: "row", gap: 8, pad: [8, 10], vs: "auto", align: "center" }); S.fillX(r);
  S.icon(r, "terminal", 13, C.mfg); S.txt(r, "Dans Claude Code :", { size: 12, color: C.mfg }); S.txt(r, name, { size: 12, mono: true, weight: 600 }); S.fillX(S.txt(r, "— " + desc, { size: 12, color: C.mfg })); return r; };

// ---------- 192 · Page Agents ----------
const stat = (p, col, big, sub, extra) => { const s = S.panel(p, { name: "Stat", gap: 4, pad: 16, fillX: false }); S.child(s, { h: "fill" }); const r = S.row(s, { gap: 8 }); S.dot(r, col, 7);
  S.txt(r, big, { size: 20, weight: 600 }); S.sub(s, sub, { size: 12 }); if (extra) S.sub(s, extra, { size: 11, color: C.dim }); return s; };
const agentCard = (p, a) => { const c = S.panel(p, { name: "AgentCard-" + a.name, gap: 8, pad: 14, w: 370 }); if (a.broken) c.strokes = [{ strokeColor: "#7F1D1D", strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  const h = S.row(c, { gap: 10 }); const ib = S.box(h, { name: "AgentIcon", stroke: C.border, radius: 8, w: 30, h: 30, dir: "row", align: "center", justify: "center" }); S.icon(ib, a.broken ? "alert" : "bot", 15, a.broken ? C.red : C.mfg);
  S.fillX(S.txt(h, a.name, { size: 14, mono: true, weight: 600 })); scopeBadge(h, a.scope);
  S.fillX(S.txt(c, a.desc, { size: 12, color: a.broken ? C.red : C.mfg, lh: 1.45 }));
  if (!a.broken) { const m = S.row(c, { gap: 6 }); [a.model, a.skills, a.subs].forEach((t, i) => { if (i) S.txt(m, "·", { size: 12, color: C.dim }); S.txt(m, t, { size: 12 }); }); }
  const st = S.row(c, { gap: 6 });
  if (a.run) { S.dot(st, C.blue, 7); S.txt(st, "En cours :", { size: 12, color: C.mfg }); mention(st, a.run, { size: 11 }); }
  else if (a.masked) S.badge(st, a.masked + " par un agent du même nom", C.mfg, { round: true, icon: "eyeOff" });
  else if (a.rename) { warnBadge(st, "Nom peu parlant"); S.txt(st, "Renommer", { size: 12, weight: 500 }).textDecoration = "underline"; }
  else if (a.broken) { S.badge(st, "fichier illisible", C.red, { round: true, stroke: "#7F1D1D" }); S.txt(st, "Ouvrir en texte brut", { size: 12, weight: 500 }).textDecoration = "underline"; }
  else if (a.note) S.txt(st, a.note, { size: 12, color: C.dim }); else S.txt(st, "aucun run en cours", { size: 12, color: C.dim });
  return c; };
const resultCell = (t, col) => (cell) => { S.dot(cell, col, 7); S.txt(cell, t, { size: 12 }); };
const agentsPage = (c) => { c.flex.rowGap = 16;
  const top = S.row(c, { gap: 8 }); S.fillX(S.txt(top, "Un agent est un fichier Claude Code : sa spec, sa description et son modèle. Kibo y ajoute ses réglages techniques.", { size: 13, color: C.mfg })); select(top, "Projet : tous");
  const st = S.row(c, { gap: 16, align: "start" }); stat(st, C.blue, "2 places sur 4", "runs en cours"); stat(st, C.cyan, "1", "run en file d'attente"); stat(st, C.amber, "0", "attend une réponse (place libérée)");
  stat(st, C.mfg, "1,2 M", "tokens aujourd'hui", "Comptés par Claude Code sur ton abonnement.");
  const h = S.row(c, { gap: 8 }); S.txt(h, "Mes agents", { size: 15, weight: 600 }); S.txt(h, "8", { size: 12, mono: true, color: C.mfg }); S.spacer(h);
  S.txt(h, "~/.claude/agents · Kibo : .claude/agents", { size: 12, mono: true, color: C.dim });
  [[A.livraison, A.review, A.seo], [A.chef, A.dev, A.reviewKibo], [A.sonnet, A.ux]].forEach(list => { const r = S.row(c, { gap: 16, align: "start" }); list.forEach(a => agentCard(r, a)); });
  const k = S.panel(c, { name: "KiboAgents", dir: "row", gap: 10, pad: [12, 16], align: "center" }); S.icon(k, "chevRight", 14, C.mfg); S.txt(k, "Agents de Kibo", { size: 13, weight: 600 });
  S.badge(k, "4", C.mfg, { round: true }); S.fillX(S.txt(k, KIBO_AGENTS.join(", "), { size: 12, mono: true, color: C.dim })); S.txt(k, "repliés · réglages fixés", { size: 12, color: C.dim });
  const hh = S.row(c, { gap: 8 }); S.fillX(S.txt(hh, "Historique des runs", { size: 15, weight: 600 })); segmented(hh, ["Tous", "Terminés", "En échec", "Annulés", "En attente"], "Tous");
  S.table(c, [["Ticket", null], ["Nom du run", 300, "mono"], ["Durée", 60], ["Tokens", 70], ["Résultat", 190]], [
    ["Récepteur de hooks Claude Code", "global · livraison · KIB-14", "18m", "312k", resultCell("En cours", C.blue)],
    ["Schéma Loro des tickets", "kibo · review-pr · KIB-12", "6m", "88k", resultCell("En cours", C.blue)],
    ["Moteur de règles déclaratif", "global · chef-orchestre · KIB-16", "41m", "1,1M", resultCell("Fait, 1 point à vérifier", C.green)],
    ["Export PDF des factures", "global · sonnet-dev · FAC-4", "12m", "240k", resultCell("Échec", C.red)]]); };
S.draw[192] = async () => { const { frame: f, content: c } = await screen("192 · Agents : cartes, portées, agents de Kibo", 0, 0, ["Agents"], { h: 1120, action: ["Nouvel agent", "plus"] }); agentsPage(c); return f.id; };

// ---------- 192b · Nouvel agent ----------
const TEMPLATES = [["Vide", "Une spec à écrire"], ["Livraison", "Ticket, plan, TDD, commits, PR"], ["Review", "Lecture seule, verdict"], ["SEO", "Audit et recommandations"], ["Chef d'orchestre", "Appelle les trois autres"]];
S.draw["192b"] = async () => { const { frame: f, content: c } = await screen("192b · Nouvel agent : portée et gabarit", 2, 0, ["Agents"], { h: 1120, action: ["Nouvel agent", "plus"] }); agentsPage(c);
  const d = formDialog(f, "Nouvel agent", 620, "Un fichier Claude Code ordinaire, lisible et modifiable aussi dans le terminal."); d.flex.rowGap = 14;
  labeled(d, "Nom", x => input(x, "chef-orchestre", { mono: true, focus: true }), { help: "Un nom qui dit ce que fait l'agent : review-pr, livraison-front" });
  labeled(d, "Portée", x => { const r = S.row(x, { gap: 8 }); segmented(r, [["Global", "globe"], ["Projet", "folder"]], "Global"); select(r, "Kibo", { disabled: true, lead: s => S.dot(s, C.brand, 7) }); });
  labeled(d, "Description", x => input(x, "Enchaîne livraison, review-pr puis seo-contenu comme sous-agents et rend un compte rendu."), { help: "Obligatoire. Une phrase qui commence par un verbe : Claude Code s'en sert pour choisir l'agent" });
  labeled(d, "Modèle", x => select(x, "Opus", { w: 200 }));
  labeled(d, "Gabarit", x => { const r = S.row(x, { gap: 8, align: "start" }); TEMPLATES.forEach(([t, s]) => { const on = t === "Chef d'orchestre";
    const b = S.box(r, { name: "Template-" + t, fill: on ? C.accent : null, stroke: on ? C.mfg : C.border, radius: 8, dir: "column", gap: 4, pad: [8, 10], vs: "auto" }); S.child(b, { h: "fill" });
    S.txt(b, t, { size: 12, weight: 600 }); S.fillX(S.txt(b, s, { size: 11, color: C.mfg, lh: 1.35 })); }); });
  S.alert(d, "Sous-agents appelables posés : livraison, review-pr, seo-contenu", "muted", { icon: "info", desc: "Ils existent en Global. Le corps du gabarit reste modifiable et n'est jamais régénéré." });
  inClaude(d, "chef-orchestre", "Enchaîne livraison, review-pr puis seo-contenu…");
  const p = S.row(d, { gap: 6 }); S.icon(p, "fileText", 13, C.dim); S.txt(p, "Fichier créé :", { size: 12, color: C.mfg }); S.txt(p, "~/.claude/agents/chef-orchestre.md", { size: 12, mono: true });
  S.footer(d, "Annuler", "Créer l'agent"); return f.id; };

// ---------- 193 · Fiche agent ----------
const agentHead = (c, a, o = {}) => { const h = S.row(c, { gap: 12 }); const av = S.box(h, { name: "AgentAvatar", fill: C.brandSoft, radius: 999, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(av, "bot", 20, C.brand);
  const tv = S.col(h, { gap: 4 }); const r = S.row(tv, { gap: 8 }); S.txt(r, a.name, { size: 18, mono: true, weight: 600 }); scopeBadge(r, o.system ? "Kibo" : a.scope); if (o.dirty) S.badge(r, "modifié, non enregistré", C.mfg, { round: true, dot: C.amber });
  const pr = S.row(tv, { gap: 6 }); S.icon(pr, "fileText", 12, C.dim); const pt = S.txt(pr, o.path || "~/.claude/agents/" + a.name + ".md", { size: 12, mono: true, color: C.mfg }); pt.textDecoration = "underline"; S.icon(pr, "external", 12, C.dim);
  S.spacer(h); S.button(h, "Ce que reçoit l'agent", "outline", { sm: true, icon: "eye" }); S.button(h, "Historique", "outline", { sm: true, icon: "history" }); iconButton(h, "trash", { outline: true });
  S.button(h, "Enregistrer", "default", { sm: true, disabled: !o.dirty }); return h; };
const specFields = (c, a, o = {}) => { const r = S.row(c, { gap: 16, align: "start" }); labeled(r, "Description", x => input(x, a.desc), { help: "Une phrase qui commence par un verbe : Claude Code s'en sert pour choisir l'agent" });
  labeledW(r, "Modèle", 220, x => select(x, a.model, { fill: true })); inClaude(c, a.name, a.desc.length > 70 ? a.desc.slice(0, 68) + "…" : a.desc); };
const collapsedRest = (c, o = {}) => { if (o.settings !== false) section(c, "Réglages techniques", "Worktree par ticket · Demande à chaque action · 2 runs en parallèle · activé");
  if (o.subs !== false) section(c, "Sous-agents appelables", o.subsSum || "aucun · sous-agents génériques de Claude Code autorisés");
  if (o.skills !== false) section(c, "Skills autorisés", o.skillsSum || "Liste · 3 skills : porte-qualite, apply-review, superpowers:test-driven-development"); };
const agentPage = async (name, col, row, a, o = {}) => { const r = await screen(name, col, row, ["Agents", a.name], { h: o.h }); const c = r.content; c.flex.rowGap = 14;
  agentHead(c, a, o); if (o.running) S.alert(c, "1 run en cours : les changements s'appliquent à son prochain tour.", "blue", { icon: "info" });
  specFields(c, a); modeBar(c, o.mode || "Édition"); const body = o.body || SPEC_LIVRAISON; codeLines(c, o.lines ? body.slice(0, o.lines) : body); return r; };
S.draw[193] = async () => { const { frame: f, content: c } = await agentPage("193 · Fiche agent : spec en premier", 4, 0, A.livraison, { dirty: true, running: true }); collapsedRest(c); return f.id; };

// ---------- 193b · Réglages techniques ----------
S.draw["193b"] = async () => { const { frame: f, content: c } = await agentPage("193b · Fiche agent : réglages techniques dépliés", 6, 0, A.livraison, { lines: 4, h: 1300 });
  const s = section(c, "Réglages techniques", "réglages de Kibo, propres à cette machine : ils ne sont pas dans le fichier", true);
  labeled(s, "Espace de travail", x => segmented(x, ["Worktree par ticket", "Dossier isolé", "Dossier du projet"], "Worktree par ticket"));
  labeled(s, "Permissions", x => segmented(x, ["Lecture seule (plan)", "Modifications acceptées", "Demande à chaque action", "Automatique"], "Demande à chaque action"), { help: "Les permissions ne sont jamais contournées." });
  labeled(s, "Autorisations", x => input(x, "Bash(bun test *)\nBash(git commit *)", { mono: true, size: 12, h: 60 }), { help: "Une règle par ligne : Outil ou Outil(motif). Les skills autorisés ajoutent leurs règles Skill(nom)." });
  const r = S.row(s, { gap: 24, align: "start" }); labeledW(r, "Runs en parallèle", 320, x => input(x, "2", { w: 120 }), { help: "1 à 16 ; la limite de la machine (4) s'applique en plus." });
  labeled(r, "Activé", x => { const t = S.row(x, { gap: 8 }); S.toggle(t, true); S.txt(t, "Proposé dans « Assigner »", { size: 12, color: C.mfg }); });
  const o = S.col(s, { gap: 6 }); const oh = S.row(o, { gap: 6 }); S.icon(oh, "lock", 12, C.mfg); S.txt(oh, "Autres champs du frontmatter", { size: 12, weight: 500 }); S.badge(oh, "lecture seule", C.mfg, { round: true });
  S.code(o, ["color: orange", "maxTurns: 80", "effort: high"], { fill: C.muted }); help(o, "Kibo ne les modifie pas et les réécrit tels quels à l'enregistrement.");
  collapsedRest(c, { settings: false }); return f.id; };

// ---------- 193c · Sous-agents et skills ----------
const subRow = (p, on, name, scope, desc, o = {}) => { const r = S.row(p, { gap: 10, align: "start", pad: [8, 0] }); if (o.dis) r.opacity = 0.5; S.check(r, on);
  const c = S.col(r, { gap: 3 }); const h = S.row(c, { gap: 6 }); S.txt(h, name, { size: 13, mono: true, weight: 600 }); if (scope) scopeBadge(h, scope); if (o.badge) o.badge(h);
  S.fillX(S.txt(c, desc, { size: 12, color: C.mfg, lh: 1.4 })); return r; };
S.draw["193c"] = async () => { const { frame: f, content: c } = await agentPage("193c · Fiche agent : sous-agents et skills", 0, 1, A.chef, { lines: 3, body: SPEC_CHEF, h: 1100 });
  section(c, "Réglages techniques", "Worktree par ticket · Demande à chaque action · 1 run en parallèle · activé");
  const row = S.row(c, { gap: 16, align: "start" });
  const s = section(row, "Sous-agents appelables", "3 sur 4", true); s.flex.rowGap = 4;
  subRow(s, true, "livraison", "Global", A.livraison.desc); subRow(s, true, "review-pr", "Global", A.review.desc); subRow(s, true, "seo-contenu", "Global", A.seo.desc);
  subRow(s, false, "ux-audit", "Global", "Fichier illisible : non appelable.", { dis: true }); hline(s);
  const g = S.row(s, { gap: 10, pad: [8, 0, 0, 0] }); S.check(g, true); S.txt(g, "Sous-agents génériques de Claude Code", { size: 13 }); S.txt(g, "general-purpose, Explore, Plan", { size: 12, mono: true, color: C.dim });
  help(s, "Un agent global n'appelle que des agents globaux. Pendant le run, Kibo refuse tout autre sous-agent.");
  const k = section(row, "Skills autorisés", "Liste · 3 sur 11", true); k.flex.rowGap = 6; segmented(k, ["Tous", "Liste"], "Liste"); input(k, "Rechercher un skill…", { icon: "search", placeholder: true });
  [["CET ORDINATEUR", [[true, "porte-qualite", "Porte qualité d'une branche avant son push."], [true, "apply-review", "Traite les reviews d'une PR, corrige et pousse."], [false, "clean-pr", "Démonte l'environnement local d'une PR fusionnée."]]],
   ["PLUGINS", [[true, "superpowers:test-driven-development", "Le test d'abord, puis le code minimal."], [false, "superpowers:brainstorming", "Explore l'intention avant un travail créatif."]]]]
    .forEach(([t, list]) => { S.txt(k, t, { size: 10, weight: 600, color: C.dim }); list.forEach(([on, n, d]) => subRow(k, on, n, null, d)); });
  const pre = S.row(k, { gap: 6, pad: [6, 0, 0, 0] }); S.icon(pre, "info", 13, C.mfg); inline(pre, ["Préchargés par le fichier : ", { m: "porte-qualite" }, " (champ skills, il précharge sans restreindre)"], { color: C.mfg });
  return f.id; };

// ---------- 193d · Ce que reçoit l'agent ----------
const level = (p, t, tok, open, lines) => { const b = S.box(p, { name: "Level-" + t, stroke: C.border, radius: 6, dir: "column", gap: 8, pad: [8, 10], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, open ? "chevDown" : "chevRight", 13, C.mfg); S.fillX(S.txt(h, t, { size: 13, weight: 500 })); S.txt(h, tok, { size: 12, mono: true, color: C.mfg });
  if (open) S.code(b, lines, { fill: C.muted }); return b; };
S.draw["193d"] = async () => { const { frame: f, content: c } = await agentPage("193d · Ce que reçoit l'agent", 2, 1, A.chef, { lines: 6, body: SPEC_CHEF }); collapsedRest(c, { subsSum: "livraison, review-pr, seo-contenu · génériques" });
  S.overlay(f); const W = 640; const sh = S.box(f, { name: "Sheet", fill: C.bg, stroke: C.border, w: W, h: 940, dir: "column", gap: 12, pad: [20, 20] }); shadow(sh); abs(f, sh, 1440 - W, 0); sh.clipContent = true;
  const h = S.row(sh, { gap: 8 }); S.icon(h, "eye", 16, C.fg); S.fillX(S.txt(h, "Ce que reçoit l'agent", { size: 16, weight: 600 })); iconButton(h, "x");
  const t = S.row(sh, { gap: 8 }); S.txt(t, "chef-orchestre", { size: 12, mono: true, weight: 600 }); S.txt(t, "sur", { size: 12, color: C.mfg }); select(t, "Ticket d'exemple : KIB-16 · Moteur de règles déclaratif");
  label(sh, "CLAUDE.md composé · 3 140 tokens estimés");
  level(sh, "Workspace", "420"); level(sh, "Projet · Kibo", "1 380"); level(sh, "Domaine · Agents", "260");
  level(sh, "Agent · chef-orchestre", "610");
  level(sh, "Protocole Kibo", "470", true, ["Sous-agents appelables : livraison — Livre un ticket…, review-pr — Relit une PR…,", "seo-contenu — Audite les pages… (aucun autre)", "Skills autorisés : porte-qualite, apply-review, superpowers:test-driven-development", "Avant de terminer, laisse une review des skills utilisés avec skill_review."]);
  level(sh, "brief.md · KIB-16", "540"); level(sh, "agents.json · 3 sous-agents", "1 920");
  label(sh, "Commande");
  const kv = S.panel(sh, { name: "Command", gap: 6, pad: [10, 12] }); [["Modèle", "opus"], ["Permissions", "default · demande à chaque action"], ["Outils", "tous (pas de champ tools)"],
    ["Règles allow", "mcp__kibo__*, Bash(bun test *), Skill(porte-qualite)…"], ["Sous-agents", "--agents agents.json · génériques autorisés"]].forEach(([k, v]) => { const r = S.row(kv, { gap: 8 });
    const l = S.box(r, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(l, k, { size: 12, color: C.mfg }); S.fillX(S.txt(r, v, { size: 12, mono: true })); });
  help(sh, "Aucun secret : ni le jeton du run ni les variables d'environnement."); S.frontAbs(f); return f.id; };

// ---------- 193e · Conflit d'écriture ----------
const diffLine = (p, sign, t, o = {}) => { const fill = sign === "+" ? "#0D1F12" : sign === "−" ? "#2A0F0F" : null; const r = S.box(p, { name: "DiffLine", fill, dir: "row", gap: 8, pad: [2, 10], vs: "auto", align: "center" }); S.fillX(r);
  if (o.n !== undefined) { const nb = S.box(r, { name: "ln", w: 22, dir: "row", vs: "auto", justify: "end" }); S.txt(nb, String(o.n), { size: 11, mono: true, color: C.dim }); }
  S.txt(r, sign || " ", { size: 12, mono: true, color: sign === "+" ? C.green : sign === "−" ? C.red : C.dim }); S.txt(r, t || " ", { size: 12, mono: true, lh: 1.55, color: sign ? C.fg : C.mfg }); return r; };
const diffPane = (p, title, lines, o = {}) => { const c = S.box(p, { name: "DiffPane-" + title, fill: C.bg, stroke: C.border, radius: 8, dir: "column", gap: 0, vs: "auto" }); S.child(c, { h: "fill" }); c.clipContent = true;
  const h = S.row(c, { gap: 8, pad: [8, 10] }); S.fillX(S.txt(h, title, { size: 12, weight: 600 })); if (o.sub) S.txt(h, o.sub, { size: 11, color: C.dim }); hline(c);
  const b = S.col(c, { gap: 0, pad: [6, 0] }); lines.forEach(([s, t], i) => diffLine(b, s, t, { n: (o.from || 1) + i })); return c; };
S.draw["193e"] = async () => { const { frame: f, content: c } = await agentPage("193e · Conflit d'écriture", 4, 1, A.livraison, { dirty: true }); collapsedRest(c);
  S.overlay(f); const W = 820; const d = S.box(f, { name: "Dialog-conflit", fill: C.card, stroke: C.border, radius: 12, w: W, dir: "column", gap: 16, pad: 24, vs: "auto" }); shadow(d); abs(f, d, (1440 - W) / 2, 200);
  const tv = S.col(d, { gap: 6 }); S.txt(tv, "Le fichier a changé sur le disque", { size: 17, weight: 600 });
  const dsc = S.row(tv, { gap: 0 }); inline(dsc, [{ m: "~/.claude/agents/livraison.md" }, " a été modifié hors de Kibo il y a 2 min (dans le terminal). Rien n'a été écrit."], { color: C.mfg });
  const r = S.row(d, { gap: 12, align: "start" });
  diffPane(r, "Ma version", [[null, "## Règles"], ["−", "- Jamais de --no-verify ni de push forcé."], ["+", "- Jamais de --no-verify."], [null, "- Passe porte-qualite avant de pousser."], ["+", "- Une PR par ticket, en brouillon."]], { sub: "non enregistrée", from: 11 });
  diffPane(r, "Sur le disque", [[null, "## Règles"], [null, "- Jamais de --no-verify ni de push forcé."], [null, "- Passe porte-qualite avant de pousser."], ["+", "- Lance bun run check avant de commiter."]], { sub: "modifié 14:02", from: 11 });
  help(d, "« Recharger » reprend le disque et garde ton édition en brouillon. « Écraser » dépose d'abord la version du disque dans l'historique (Externe).");
  const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Annuler", "outline"); S.button(ft, "Recharger", "outline", { icon: "refresh" }); S.button(ft, "Écraser avec ma version", "default");
  S.frontAbs(f); return f.id; };

// ---------- 194 · Page Skills ----------
const skillRow = (p, [name, desc, notes, usage, o = {}], sel) => { const r = S.box(p, { name: "SkillRow-" + name, fill: sel ? C.accent : null, dir: "row", gap: 12, pad: [9, 14], vs: "auto", align: "center" }); S.fillX(r);
  const c = S.col(r, { gap: 2 }); const h = S.row(c, { gap: 6 }); S.txt(h, name, { size: 13, mono: true, weight: 600, color: o.masked ? C.mfg : C.fg });
  if (o.masked) S.badge(h, "masqué", C.mfg, { round: true, icon: "eyeOff" }); if (o.ro) S.badge(h, "lecture seule", C.mfg, { round: true, icon: "lock" });
  S.txt(c, o.masked ? "masqué par le skill personnel du même nom" : desc, { size: 12, color: C.mfg });
  if (notes) { const n = S.row(r, { gap: 5, hs: "auto" }); S.icon(n, "messagePlus", 13, C.brand); S.txt(n, notes, { size: 12, weight: 500, color: C.brand }); }
  const u = S.box(r, { name: "usage", w: 230, dir: "row", vs: "auto", justify: "end" }); S.txt(u, usage, { size: 12, color: C.dim }); S.icon(r, "chevRight", 14, C.dim); return r; };
const skillGroup = (p, icon, title, path, rows, o = {}) => { const g = S.panel(p, { name: "SkillGroup-" + title, gap: 0, pad: 0 });
  const h = S.row(g, { gap: 8, pad: [10, 14] }); if (o.dot) S.dot(h, o.dot, 8); else S.icon(h, icon, 15, C.mfg); S.txt(h, title, { size: 13, weight: 600 }); S.badge(h, String(rows.length), C.mfg, { round: true });
  S.fillX(S.txt(h, path, { size: 12, mono: true, color: C.dim })); if (o.right) o.right(h);
  rows.forEach(x => { hline(g); skillRow(g, o.ro ? [x[0], x[1], x[2], x[3], { ro: true }] : x, o.sel === x[0]); }); return g; };
const skillsPage = (c, o = {}) => { c.flex.rowGap = 14;
  const t = S.row(c, { gap: 8 }); input(t, "Rechercher un skill…", { icon: "search", placeholder: true, w: 420 }); select(t, "Tous les projets"); S.spacer(t);
  S.txt(t, "4 notes à traiter", { size: 12, weight: 500, color: C.brand });
  skillGroup(c, "laptop", "Cet ordinateur", "~/.claude/skills", SK.user);
  skillGroup(c, null, "Projet · Kibo", "~/code/kibo/.claude/skills", SK.kibo, { dot: C.brand });
  skillGroup(c, null, "Projet · API Facturation", "~/code/api-facturation/.claude/skills", SK.fact, { dot: C.green });
  const pl = S.col(c, { gap: 8 }); const ph = S.row(pl, { gap: 8 }); S.icon(ph, "package", 15, C.mfg); S.txt(ph, "Plugins", { size: 13, weight: 600 }); S.txt(ph, "lecture seule · ~/.claude/plugins/cache", { size: 12, mono: true, color: C.dim });
  skillGroup(pl, "package", "superpowers", "5.0.7", SK.superpowers, { ro: true, sel: o.sel }); skillGroup(pl, "package", "frontend-design", "1.2.0", SK.design, { ro: true }); };
S.draw[194] = async () => { const { frame: f, content: c } = await screen("194 · Skills : trois sources", 0, 2, ["Agents", "Skills"], { nav: "Skills", h: 1180, action: ["Nouveau skill", "plus"] }); skillsPage(c); return f.id; };

// ---------- 194b · Skill de plugin ----------
S.draw["194b"] = async () => { const { frame: f, content: c } = await screen("194b · Skill de plugin en lecture seule, copier pour modifier", 2, 2, ["Agents", "Skills"], { nav: "Skills", h: 1180, action: ["Nouveau skill", "plus"] });
  skillsPage(c, { sel: "superpowers:brainstorming" }); S.overlay(f);
  const W = 620; const sh = S.box(f, { name: "Sheet", fill: C.bg, stroke: C.border, w: W, h: 1180, dir: "column", gap: 14, pad: [20, 20] }); shadow(sh); abs(f, sh, 1440 - W, 0); sh.clipContent = true;
  const h = S.row(sh, { gap: 8 }); S.icon(h, "bookOpen", 16, C.fg); S.fillX(S.txt(h, "superpowers:brainstorming", { size: 15, mono: true, weight: 600 })); iconButton(h, "x");
  const m = S.row(sh, { gap: 8 }); S.badge(m, "Plugin superpowers 5.0.7", C.mfg, { round: true, icon: "package" }); S.badge(m, "lecture seule", C.mfg, { round: true, icon: "lock" }); S.txt(m, "6 runs/30 j", { size: 12, color: C.dim });
  S.fillX(S.txt(sh, "~/.claude/plugins/cache/…/superpowers/5.0.7/skills/brainstorming/SKILL.md", { size: 11, mono: true, color: C.dim }));
  S.alert(sh, "Ce skill vient d'un plugin : il se lit ici, il ne se modifie pas.", "muted", { icon: "lock", desc: "1 note de review l'attend : copie-le pour l'intégrer à ta copie." });
  const a = S.row(sh, { gap: 8 }); S.button(a, "Copier pour modifier", "default", { sm: true, icon: "copy" }); S.button(a, "Notes de review (1)", "outline", { sm: true, icon: "messagePlus" });
  const pop = S.box(sh, { name: "CopyPopover", fill: C.card, stroke: C.border, radius: 10, dir: "column", gap: 12, pad: 16, vs: "auto" }); S.fillX(pop); shadow(pop, 0.35);
  S.txt(pop, "Copier pour modifier", { size: 14, weight: 600 });
  labeled(pop, "Destination", x => segmented(x, [["Cet ordinateur", "laptop"], ["Projet · Kibo", "folder"]], "Cet ordinateur"));
  labeled(pop, "Nom de la copie", x => input(x, "brainstorming-kibo", { mono: true, focus: true }));
  S.alert(pop, "Nouvel identifiant pour les agents", "amber", { desc: "brainstorming-kibo est un autre skill que superpowers:brainstorming. 2 agents autorisent l'original : livraison et chef-orchestre." });
  S.check(pop, true, "Autoriser aussi la copie pour ces 2 agents");
  const ft = S.row(pop, { gap: 8 }); S.spacer(ft); S.button(ft, "Annuler", "outline", { sm: true }); S.button(ft, "Copier", "default", { sm: true });
  S.txt(sh, "SKILL.md", { size: 12, mono: true, weight: 600 }); codeLines(sh, ["# Brainstorming", "Turn an idea into a design through dialogue.", "", "## Process", "- Ask one question at a time.", "- Propose two or three approaches."], { fill: C.muted });
  S.frontAbs(f); return f.id; };

// ---------- 195 · Éditeur de skill ----------
const FILES = [["SKILL.md", "1,9 Ko", true], ["volets/correctness.md", "2,4 Ko", true], ["volets/conventions.md", "1,7 Ko", true], ["scripts/diff-stat.sh", "0,6 Ko", true], ["exemple-verdict.png", "48 Ko", false]];
const skillHead = (c, o = {}) => { const h = S.row(c, { gap: 12 }); const av = S.box(h, { name: "SkillIcon", stroke: C.border, radius: 8, w: 40, h: 40, dir: "row", align: "center", justify: "center" }); S.icon(av, "bookOpen", 18, C.mfg);
  const tv = S.col(h, { gap: 4 }); const r = S.row(tv, { gap: 8 }); S.txt(r, "porte-qualite", { size: 18, mono: true, weight: 600 }); S.badge(r, "Cet ordinateur", C.mfg, { round: true, icon: "laptop" });
  S.txt(r, "9 runs/30 j", { size: 12, color: C.dim });
  const pr = S.row(tv, { gap: 6 }); S.icon(pr, "folder", 12, C.dim); S.txt(pr, "~/.claude/skills/porte-qualite/SKILL.md", { size: 12, mono: true, color: C.mfg });
  S.spacer(h); if (!o.notesOpen) { const b = S.button(h, "Notes de review (2)", "outline", { sm: true, icon: "messagePlus" }); } S.button(h, "Historique", "outline", { sm: true, icon: "history" }); iconButton(h, "trash", { outline: true });
  S.button(h, "Enregistrer", "default", { sm: true, disabled: !o.dirty }); return h; };
const filesCol = (p) => { const f = S.panel(p, { name: "Files", gap: 2, pad: 10, w: 270 }); label(f, "Fichiers"); S.box(f, { name: "gap", w: 1, h: 4 });
  FILES.forEach(([n, size, text], i) => { const r = S.box(f, { name: "File-" + n, fill: i === 0 ? C.accent : null, radius: 6, dir: "row", gap: 6, pad: [5, 6], vs: "auto", align: "center" }); S.fillX(r); if (!text) r.opacity = 0.6;
    S.icon(r, text ? "fileText" : "image", 13, C.mfg); S.fillX(S.txt(r, n, { size: 12, mono: true })); S.txt(r, size, { size: 11, color: C.dim }); });
  help(f, "Les fichiers non texte sont listés, pas ouverts."); S.button(f, "Ajouter un fichier", "outline", { sm: true, icon: "plus" }); return f; };
const frontFields = (p) => { const s = S.panel(p, { name: "Frontmatter", gap: 12, pad: 14 }); labeled(s, "Description", x => input(x, "Porte qualité d'une branche avant son push, à deux volets : correctness et conventions."));
  const r = S.row(s, { gap: 20, align: "start" }); labeled(r, "allowed-tools", x => input(x, "Read, Grep, Bash(git diff *)", { mono: true, size: 12 }));
  const t = S.col(r, { gap: 8, w: 300 }); [["disable-model-invocation", false], ["user-invocable", true]].forEach(([k, on]) => { const x = S.row(t, { gap: 8 }); S.toggle(x, on); S.txt(x, k, { size: 12, mono: true }); });
  const o = S.row(s, { gap: 6 }); S.icon(o, "lock", 12, C.dim); inline(o, ["Autres champs, lecture seule : ", { m: "context: fork" }], { color: C.mfg }); return s; };
const editorShell = async (name, col, row, o = {}) => { const r = await screen(name, col, row, ["Agents", "Skills", "porte-qualite"], { nav: "Skills", h: o.h }); const c = r.content; c.flex.rowGap = 14;
  skillHead(c, o); const cols = S.row(c, { name: "EditorCols", gap: 16, align: "start" }); if (!o.noFiles) filesCol(cols); const m = S.col(cols, { name: "EditorMain", gap: 12 }); return { ...r, cols, m }; };
S.draw[195] = async () => { const { frame: f, m } = await editorShell("195 · Éditeur de skill : aperçu et fichiers", 4, 2, { dirty: true });
  frontFields(m); modeBar(m, "Côte à côte", null, true); const sbs = S.row(m, { gap: 0, align: "start", stroke: C.border, radius: 8 }); sbs.clipContent = true;
  const l = S.col(sbs, { gap: 0 }); codeLines(l, SKILL_BODY, { stroke: false }); const rp = S.col(sbs, { gap: 0, fill: C.card }); preview(rp, SKILL_BODY); return f.id; };

// ---------- 195b · Notes de review ----------
const verdictBadge = (p, v) => v === "ok" ? S.badge(p, "OK", C.green, { round: true, stroke: "#14532D" }) : S.badge(p, "À améliorer", C.amber, { round: true, stroke: "#78350F" });
const noteCard = (p, n, o = {}) => { const c = S.panel(p, { name: "ReviewNote", gap: 8, pad: 12 }); if (o.hl) c.strokes = [{ strokeColor: C.brand, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 0.7 }];
  const h = S.row(c, { gap: 6 }); verdictBadge(h, n.verdict); S.spacer(h); S.txt(h, n.when, { size: 11, color: C.dim });
  S.fillX(S.txt(c, n.text, { size: 12, lh: 1.45 })); const m = S.row(c, { gap: 6 }); S.icon(m, "bot", 12, C.brand); mention(m, n.by, { size: 11 });
  if (n.suggestion) S.txt(m, "· suggestion jointe", { size: 11, color: C.mfg });
  if (o.actions !== false) { const a = S.row(c, { gap: 8 }); if (n.suggestion) orangeButton(a, "Intégrer", "merge"); else S.button(a, "Ouvrir ici", "outline", { sm: true }); S.button(a, "Ignorer", "ghost", { sm: true }); } return c; };
const notesPane = (p, o = {}) => { const pn = S.box(p, { name: "NotesPane", w: 330, dir: "column", gap: 10, vs: "auto" });
  const h = S.row(pn, { gap: 8 }); S.icon(h, "messagePlus", 15, C.brand); S.fillX(S.txt(h, "Notes de review", { size: 14, weight: 600 })); S.badge(h, "2 à traiter", C.brand, { round: true, stroke: C.brand }); iconButton(h, "x");
  help(pn, "Laissées par les agents en fin de run. Rien n'est modifié sans ton clic."); noteCard(pn, NOTES[0], { hl: o.hl }); noteCard(pn, NOTES[1]);
  const t = S.row(pn, { gap: 8, pad: [4, 0] }); S.icon(t, "chevRight", 13, C.mfg); S.txt(t, "Traitées · 3", { size: 13, weight: 500 }); S.txt(t, "2 intégrées, 1 ignorée", { size: 12, color: C.dim }); return pn; };
S.draw["195b"] = async () => { const { frame: f, cols, m } = await editorShell("195b · Éditeur de skill : notes de review", 6, 2, { notesOpen: true, noFiles: true });
  frontFields(m); modeBar(m, "Édition", null, true); codeLines(m, SKILL_BODY); notesPane(cols); return f.id; };

// ---------- 195c · Intégration en diff ----------
const hunk = (p, title, rows, accepted) => { const h = S.box(p, { name: "Hunk", stroke: C.border, radius: 8, dir: "column", gap: 0, vs: "auto" }); S.fillX(h); h.clipContent = true;
  const bar = S.row(h, { gap: 8, pad: [6, 10], fill: C.muted }); S.txt(bar, title, { size: 12, mono: true, color: C.mfg }); S.spacer(bar);
  if (accepted) { S.badge(bar, "accepté", C.green, { round: true, icon: "check", stroke: "#14532D" }); S.button(bar, "Annuler", "ghost", { sm: true }); }
  else { S.button(bar, "Accepter ce bloc", "outline", { sm: true, icon: "check" }); S.button(bar, "Rejeter", "ghost", { sm: true }); }
  const two = S.row(h, { gap: 0, align: "start" }); [0, 1].forEach(side => { const c = S.col(two, { gap: 0, pad: [4, 0] }); if (!side) c.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    rows.forEach(([l, r]) => { const v = side ? r : l; if (v === undefined) { diffLine(c, null, "", {}).opacity = 0.4; return; } const [s, t, n] = v; diffLine(c, s, t, { n }); }); }); return h; };
S.draw["195c"] = async () => { const { frame: f, cols, m } = await editorShell("195c · Intégrer une review : diff", 0, 3, { dirty: true, noFiles: true, notesOpen: true });
  const t = S.row(m, { gap: 8 }); S.icon(t, "merge", 15, C.brand); inline(t, ["Intégrer la review de ", { m: "global · livraison · KIB-14", color: C.fg }], { size: 13 }); S.spacer(t); segmented(t, ["Côte à côte", "Unifié"], "Côte à côte");
  S.alert(m, "Le skill a changé depuis cette review", "amber", { desc: "Le diff est calculé contre le fichier courant (modifié hier hors de Kibo)." });
  const lg = S.row(m, { gap: 0 }); const a = S.col(lg, { gap: 0 }); S.txt(a, "Fichier courant", { size: 12, weight: 600 }); const b = S.col(lg, { gap: 0, pad: [0, 0, 0, 12] }); S.txt(b, "Suggestion de l'agent", { size: 12, weight: 600 });
  hunk(m, "@@ Volet conventions", [[[null, "## Volet conventions", 7], [null, "## Volet conventions", 7]], [["−", "Relis les fichiers touchés par la branche.", 8], ["+", "Relis uniquement les lignes modifiées.", 8]],
    [[null, "Vérifie le format des commits et le lint.", 9], [null, "Vérifie le format des commits et le lint.", 9]], [undefined, ["+", "Signale tout commentaire ajouté.", 10]]], true);
  hunk(m, "@@ Verdict", [[[null, "## Verdict", 11], [null, "## Verdict", 12]], [[null, "« Prêt » ou la liste des points bloquants.", 12], [null, "« Prêt » ou la liste des points bloquants.", 13]], [undefined, ["+", "Un verdict tient en trois lignes au plus.", 14]]], false);
  const ft = S.row(m, { gap: 8 }); S.txt(ft, "1 bloc sur 2 accepté", { size: 12, color: C.mfg }); S.spacer(ft); S.button(ft, "Annuler", "outline", { sm: true }); S.button(ft, "Enregistrer", "default", { sm: true });
  const pn = S.box(cols, { name: "NotesPane", w: 330, dir: "column", gap: 10, vs: "auto" }); const h = S.row(pn, { gap: 8 }); S.icon(h, "messagePlus", 15, C.brand); S.txt(h, "Review intégrée", { size: 14, weight: 600 });
  noteCard(pn, NOTES[0], { hl: true, actions: false }); help(pn, "Enregistrer crée une version « Intégration » et marque la review intégrée."); return f.id; };

// ---------- 195d · Historique ----------
const VERSIONS = [["12 oct. 14:32", "Intégration", "Adam · review intégrée", "4,1 Ko", "actuelle"], ["11 oct. 18:40", "Externe", "modifié hors de Kibo", "3,9 Ko"],
  ["11 oct. 10:05", "Kibo", "Adam", "3,8 Ko", null, true], ["9 oct. 16:20", "Restauration", "Adam", "3,6 Ko"], ["6 oct. 09:12", "Kibo", "Adam", "3,6 Ko"]];
S.draw["195d"] = async () => { const { frame: f, cols, m } = await editorShell("195d · Historique des versions", 2, 3, { noFiles: true }); modeBar(m, "Édition", null, true); codeLines(m, SKILL_BODY);
  S.overlay(f); const W = 980; const d = S.box(f, { name: "Dialog-historique", fill: C.card, stroke: C.border, radius: 12, w: W, dir: "column", gap: 14, pad: 24, vs: "auto" }); shadow(d); abs(f, d, (1440 - W) / 2, 120);
  const h = S.row(d, { gap: 8 }); S.icon(h, "history", 16, C.fg); S.txt(h, "Historique", { size: 17, weight: 600 }); S.fillX(S.txt(h, "porte-qualite · SKILL.md · 5 versions sur 100 gardées", { size: 12, color: C.mfg })); iconButton(h, "x");
  const r = S.row(d, { gap: 16, align: "start" }); const l = S.box(r, { name: "Versions", w: 330, dir: "column", gap: 2, vs: "auto" });
  VERSIONS.forEach(([at, origin, by, size, cur, sel]) => { const it = S.box(l, { name: "Version", fill: sel ? C.accent : null, radius: 6, dir: "column", gap: 3, pad: [8, 10], vs: "auto" }); S.fillX(it);
    const a = S.row(it, { gap: 6 }); S.txt(a, at, { size: 12, mono: true, weight: 600 }); S.badge(a, origin, C.mfg, { round: true }); if (cur) S.badge(a, "actuelle", C.fg, { round: true, fill: C.muted });
    const b = S.row(it, { gap: 6 }); S.fillX(S.txt(b, by, { size: 12, color: C.mfg })); S.txt(b, size, { size: 11, color: C.dim }); });
  const rp = S.col(r, { gap: 10 }); const rh = S.row(rp, { gap: 8 }); S.fillX(S.txt(rh, "11 oct. 10:05 comparée à la version actuelle", { size: 13, weight: 500 })); segmented(rh, ["Côte à côte", "Unifié"], "Unifié");
  const df = S.box(rp, { name: "Diff", fill: C.bg, stroke: C.border, radius: 8, dir: "column", gap: 0, pad: [6, 0], vs: "auto" }); S.fillX(df);
  [[null, "## Volet conventions", 7], ["−", "Relis les fichiers touchés par la branche.", 8], ["+", "Relis uniquement les lignes modifiées.", 8], [null, "Vérifie le format des commits et le lint.", 9],
    ["+", "Signale tout commentaire ajouté.", 10], [null, "", 11], [null, "## Verdict", 12], [null, "« Prêt » ou la liste des points bloquants.", 13]].forEach(([s, t, n]) => diffLine(df, s, t, { n }));
  help(rp, "Restaurer écrit une nouvelle version « Restauration » ; l'historique n'est jamais réécrit.");
  const ft = S.row(rp, { gap: 8 }); S.spacer(ft); S.button(ft, "Restaurer cette version", "default", { sm: true, icon: "undo" }); S.frontAbs(f); return f.id; };

// ---------- 196 · Fil du run et Activité ----------
const pill = (p, parts, o = {}) => { const b = S.box(p, { name: "ActionPill", fill: C.muted, radius: 6, dir: "column", gap: 6, pad: [7, 12], vs: "auto" }); S.fillX(b);
  const h = S.row(b, { gap: 8 }); S.icon(h, o.open ? "chevDown" : "chevRight", 12, C.mfg); if (o.icon) S.icon(h, o.icon, 13, o.iconColor || C.mfg); inline(h, parts, { color: o.color || C.mfg, mcolor: o.color || C.fg });
  if (o.body) o.body(b); return b; };
const say = (p, time, step, text) => { const c = S.col(p, { gap: 6 }); const h = S.row(c, { gap: 8 }); S.txt(h, time, { size: 12, mono: true, color: C.mfg }); S.badge(h, step, C.fg, { round: true });
  S.fillX(S.txt(c, text, { size: 13, weight: 500, lh: 1.45 })); return c; };
const reviewsBlock = (p) => { const b = S.panel(p, { name: "SkillReviews", gap: 10, pad: 14 }); const h = S.row(b, { gap: 8 }); S.icon(h, "bookOpen", 14, C.mfg); S.fillX(S.txt(h, "Reviews de skills", { size: 13, weight: 600 })); S.txt(h, "run de 14:05 · 2 skills", { size: 12, color: C.dim });
  [[NOTES[0], "À traiter", C.brand, "Ouvrir le skill"], [{ skill: "apply-review", verdict: "ok", text: "Les étapes ont suffi pour les 3 remarques de la PR.\nRien à changer." }, "Ignorée", C.mfg]].forEach(([n, st, col, link], i) => {
    if (i) hline(b); const c = S.col(b, { gap: 5 }); const r = S.row(c, { gap: 6 }); S.txt(r, n.skill, { size: 12, mono: true, weight: 600 }); verdictBadge(r, n.verdict); S.spacer(r);
    S.txt(r, st, { size: 12, weight: 500, color: col }); if (link) { const l = S.txt(r, link, { size: 12, weight: 500 }); l.textDecoration = "underline"; }
    S.fillX(S.txt(c, n.text, { size: 12, color: C.mfg, lh: 1.45 })); }); return b; };
S.draw[196] = async () => { const { frame: f, content: c } = await screen("196 · Fil du run : skills et Activité", 4, 3, ["Kibo", "KIB-14"], { nav: "Tickets", tab: ["ticket", "Kibo · KIB-14"] });
  c.flex.rowGap = 12;
  const th = S.row(c, { gap: 6 }); S.fillX(S.txt(th, "KIB-14", { size: 12, mono: true, color: C.mfg })); iconButton(th, "more"); S.txt(c, "Récepteur de hooks Claude Code", { size: 18, weight: 600 });
  const tabs = S.row(c, { gap: 0 }); [["Détails"], ["Activité", true]].forEach(([t, on]) => { const x = S.box(tabs, { name: "Tab-" + t, dir: "column", gap: 8, pad: [0, 12], hs: "auto", vs: "auto" });
    S.txt(x, t, { size: 13, weight: on ? 600 : 400, color: on ? C.fg : C.mfg }); S.fillX(S.box(x, { name: "underline", fill: on ? C.fg : null, h: 2, w: 10 })); }); hline(c);
  const row = S.row(c, { gap: 24, align: "start" }); const left = S.box(row, { name: "Side", w: 470, dir: "column", gap: 14, vs: "auto" });
  const rep = S.panel(left, { name: "Report", gap: 6, pad: 14 }); const rh = S.row(rep, { gap: 8 }); S.txt(rh, "Compte rendu", { size: 13, weight: 600 }); S.txt(rh, "run de 14:05", { size: 12, color: C.mfg });
  S.txt(rep, "Fait", { size: 12, color: C.mfg }); S.fillX(S.txt(rep, "Le récepteur rejette les corps vides et répond 413 au-delà de 1 Mio.", { size: 13, lh: 1.45 }));
  S.txt(rep, "Suite", { size: 12, color: C.mfg }); S.fillX(S.txt(rep, "Brancher le récepteur sur le démon.", { size: 13, lh: 1.45 })); reviewsBlock(left);
  const t = S.col(row, { name: "Timeline", gap: 12 }); label(t, "Chronologie des runs");
  const hd = S.row(t, { gap: 8 }); S.dot(hd, C.green, 8); mention(hd, "global · livraison · KIB-14", { size: 12 }); S.txt(hd, "aujourd'hui 14:05 → 14:23", { size: 12, color: C.mfg }); S.spacer(hd); S.txt(hd, "Fait", { size: 12, color: C.mfg });
  const fl = S.col(t, { gap: 10, pad: [0, 0, 0, 16] });
  say(fl, "14:06", "Étape 1", "Je relis le ticket et le récepteur avant de toucher à la validation."); pill(fl, ["A lu 3 fichiers"]);
  pill(fl, ["A utilisé le skill ", { m: "superpowers:test-driven-development" }], { icon: "bookOpen" });
  say(fl, "14:15", "Étape 2", "Le test du corps vide échoue ; je borne la taille du corps et je relance les tests."); pill(fl, ["A modifié 2 fichiers et lancé les tests (15 réussis)"]);
  pill(fl, ["A utilisé le skill ", { m: "porte-qualite" }], { icon: "bookOpen" });
  pill(fl, ["Kibo a refusé le skill ", { m: "clean-pr" }, " · skill non autorisé par Kibo"], { icon: "shieldAlert", iconColor: C.red, color: C.red });
  notice(fl, "Kibo a rappelé la review des skills");
  pill(fl, ["A laissé une review de 2 skills ", { m: "skill_review" }], { icon: "messagePlus", open: true, body: b => { const x = S.col(b, { gap: 4, pad: [0, 0, 0, 20] });
    inline(x, [{ m: "porte-qualite" }, " · à améliorer · suggestion jointe"], { color: C.mfg }); inline(x, [{ m: "apply-review" }, " · OK"], { color: C.mfg }); } });
  say(fl, "14:23", "Fin", "Compte rendu rempli. Le récepteur est prêt pour la review.");
  const r3 = S.row(t, { gap: 8, pad: [8, 0, 0, 0] }); S.icon(r3, "chevRight", 13, C.mfg); S.dot(r3, C.green, 8); mention(r3, "global · livraison · KIB-14", { size: 12 });
  S.txt(r3, "hier 17:52 → 18:40", { size: 12, color: C.mfg }); S.spacer(r3); S.txt(r3, "Fait · Pas de review des skills", { size: 12, color: C.mfg }); return f.id; };

S.fixTabX = (f) => { const tb = find(f, "TabBar"); if (!tb) return 0; let n = 0;
  for (const tab of tb.children) { if (tab.type !== "board" || !tab.children) continue; const x = tab.children.find(c => c.name.replace(/ /g, "") === "icon/x"); if (!x) continue;
    if (x.x < Math.max(...tab.children.map(c => c.x))) { tab.insertChild(tab.children.length, x); n++; } } return n; };
S.fixAgSk = async () => { let n = S.fixAgSkNav(); for (let i = 0; i < 3; i++) { penpot.currentPage.root.children.filter(c => c.type === "board").forEach(f => { n += S.fixTabX(f); }); await wait(500); } return n; };
const snapRetry = async (id, name) => { for (let i = 0; i < 3; i++) { try { return await S.snap(penpot.currentPage.getShapeById(id), name, 1); } catch (e) { await wait(4000); } } return "échec " + name; };
S.one = async (n) => { const [d, l] = await S.both(n); await wait(2000); return [n, await snapRetry(d, n + "-dark.png"), await snapRetry(l, n + "-light.png")]; };
S.AGENTS_SKILLS = [192, "192b", 193, "193b", "193c", "193d", "193e", 194, "194b", 195, "195b", "195c", "195d", 196];
return "agents-skills ok";
