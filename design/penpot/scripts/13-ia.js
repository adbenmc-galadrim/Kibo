// Page « 11 · IA » : écrans 58 à 64 (phase 6, plan kibo-ia « Écrans à dessiner »). Bases : copies des écrans 2 et 29.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "11 · IA";
const fromBase = async (base, name, row) => { await S.page(PAGE); const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = root.children.find(c => c.name === "base · " + base).clone(); f.name = name; f.x = 0; f.y = row * 1040;
  f.children.filter(c => /^Dialog/.test(c.name)).forEach(c => c.remove()); return f; };
const agentBtn = (p, label, o = {}) => S.button(p, label, "brand", { sm: o.sm, icon: o.icon || "sparkles", disabled: o.disabled });

// ---------- Nouveau projet · « Ton rôle » ----------
const roleDialog = (f, o) => {
  const d = S.dialog(f, 640, "Nouveau projet", "Kibo te propose des pages de départ selon ton usage. Tu pourras tout changer ensuite.");
  const grid = S.box(d, { name: "Roles", dir: "row", gap: 10, vs: "auto" }); S.fillX(grid); grid.flex.wrap = "wrap";
  [["code", "Développeur·se", "Tickets, Kanban, agents et code"], ["palette", "Designer", "Maquettes Figma liées aux tickets"], ["clipboard", "Chef·fe de projet", "Avancement, chemin critique, notes"], ["sparkles", "Autre", "Pars d'une page vide"]].forEach(([ic, t, h], i) => {
    const on = i === 0; const c = S.box(grid, { name: "ChoiceCard", fill: on ? C.muted : null, stroke: on ? C.mfg : C.border, radius: 8, dir: "row", gap: 10, pad: [10, 12], vs: "auto", w: 290, align: "center" });
    S.icon(c, ic, 16, on ? C.fg : C.mfg); const tv = S.col(c, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, h, { size: 11, color: C.mfg }); });
  const fl = S.col(d, { gap: 6 }); const lr = S.row(fl); S.txt(lr, "Décris ton usage en une phrase", { size: 12, weight: 500 }); S.spacer(lr); S.txt(lr, "Facultatif", { size: 11, color: C.dim });
  const inp = S.box(fl, { name: "Textarea", fill: C.bg, stroke: C.border, radius: 6, dir: "column", pad: [8, 10], vs: "auto" }); S.fillX(inp); S.fillX(S.txt(inp, "Je code Kibo avec des agents Claude et je suis les PR de près.", { size: 13, lh: 1.5 }));
  const br = S.row(fl, { gap: 8 }); o.button(br);
  if (o.banner) o.banner(d);
  const ph = S.row(d, { gap: 8 }); S.txt(ph, "Pages proposées", { size: 13, weight: 600 }); if (o.claude) S.badge(ph, "Proposition de Claude", C.brand, { icon: "sparkles", stroke: "#7C2D12" });
  const list = S.panel(d, { pad: 0, gap: 0, radius: 8 });
  o.pages.forEach(([on, t, type, comps]) => { const r = S.row(list, { gap: 10, pad: [8, 12] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    S.check(r, on); const ti = S.box(r, { name: "Input", fill: C.bg, stroke: C.border, radius: 6, dir: "row", pad: [5, 8], vs: "auto", w: 170 }); S.txt(ti, t, { size: 12 });
    S.badge(r, type, C.fg, { fill: C.accent }); S.fillX(S.txt(r, comps, { size: 11, color: C.dim })); if (!on) r.opacity = 0.6; });
  S.txt(d, "Décoche ce que tu ne veux pas, renomme si besoin.", { size: 11, color: C.dim });
  const ft = S.row(d, { gap: 8 }); S.txt(ft, "Étape 1 sur 2", { size: 12, color: C.dim }); S.spacer(ft); S.button(ft, "Passer", "ghost"); S.button(ft, "Continuer", "default");
  S.center(f, d); S.frontAbs(f); return d; };
const PAGES_CLAUDE = [[true, "Tableau de bord", "Tableau de bord", "Kanban · Mes tickets · Graphe"], [true, "Kanban", "Vue", "Kanban"], [true, "Revues de PR", "Vue", "PR en attente"], [false, "Notes", "Vue", "Notes"]];
const PAGES_STD = [[true, "Tableau de bord", "Tableau de bord", "Kanban · Mes tickets · Graphe"], [true, "Kanban", "Vue", "Kanban"], [true, "Tickets", "Vue", "Tickets"], [true, "Notes", "Vue", "Notes"]];

S.draw[58] = async () => { const f = await fromBase(2, "58 · Nouveau projet : ton rôle (proposition)", 0);
  roleDialog(f, { claude: true, pages: PAGES_CLAUDE, button: br => { agentBtn(br, "Proposer avec Claude", { sm: true }); S.txt(br, "Via ton abonnement · passe par la file d'attente", { size: 11, color: C.dim }); } });
  return f.id; };
S.draw[59] = async () => { const f = await fromBase(2, "59 · Nouveau projet : suggestion indisponible", 1);
  roleDialog(f, { pages: PAGES_STD, button: br => { agentBtn(br, "Proposer avec Claude", { sm: true, disabled: true }); S.txt(br, "Hors ligne", { size: 11, color: C.mfg }); },
    banner: d => S.alert(d, "Suggestion indisponible, voici le point de départ standard", "muted", { icon: "info" }) });
  return f.id; };

// ---------- Écran 29 : étapes 2 et 3 ----------
const STEPS = ["Décrire", "Générer (agent)", "Tests de conformité", "Permissions", "Ajouter à la page"];
const pills = (d, cur) => { const r = S.row(d, { gap: 8 }); STEPS.forEach((s, i) => { const on = i === cur, done = i < cur;
  const b = S.box(r, { name: "step", fill: on ? C.accent : null, stroke: on ? C.mfg : null, radius: 999, dir: "row", gap: 5, pad: [4, 10], hs: "auto", vs: "auto", align: "center" });
  if (done) S.icon(b, "check", 11, C.green); S.txt(b, (i + 1) + " · " + s, { size: 11, weight: on ? 500 : 400, color: on ? C.fg : done ? C.mfg : C.dim }); }); return r; };
const genDialog = (f, cur, title) => { const d = S.dialog(f, 880, "Créer un composant", title); return d; };
const attempt = (d, n, state, kind) => { const r = S.row(d, { gap: 8 }); S.dot(r, S.RUN[kind], 7); S.txt(r, "Tentative " + n + " sur 3 · opus · " + state, { size: 12, color: C.mfg }); return r; };

S.draw[60] = async () => { const f = await fromBase(29, "60 · Créer un composant : génération (agent)", 2);
  const d = genDialog(f, 1, "Burndown · génération en cours dans un dossier brouillon (components/src/burndown).");
  attempt(d, 1, "En cours · 2 min", "running");
  const tl = S.panel(d, { gap: 8, pad: 14, fill: C.bg }); S.txt(tl, "Timeline des hooks", { size: 12, weight: 600 });
  [["11:02", "SessionStart", ["CLAUDE.md et SKILL.md du brouillon chargés"], C.green], ["11:02", "PostToolUse", ["Read ", { link: "CLAUDE.md" }]], ["11:03", "PostToolUse", ["Write ", { link: "ui.tsx" }]], ["11:03", "PostToolUse", ["Write ", { link: "component.test.tsx" }]], ["11:04", "PreToolUse", ["Bash kibo component test ."]]]
    .forEach(([t, e, x, col]) => S.hookLine(tl, t, e, x, { color: col || C.blue }));
  const now = S.row(tl, { gap: 8 }); S.spinner(now, C.blue, 12); S.txt(now, "En cours : Bash · 9 s", { size: 12, color: C.blue });
  S.sub(d, "L'agent ne peut écrire que dans le dossier brouillon ; kibo.component.json est réservé à Kibo.");
  pills(d, 1); const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Abandonner", "outline");
  S.center(f, d); S.frontAbs(f); return f.id; };

const checks = (d, rows) => { const p = S.panel(d, { gap: 0, pad: 0, radius: 8 });
  rows.forEach(([t, ok, detail, out]) => { const r = S.row(p, { gap: 10, pad: [10, 14] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    S.icon(r, ok ? "circleCheck" : "circleX", 16, ok ? C.green : C.red); const tv = S.col(r, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, detail, { size: 11, color: C.mfg });
    S.txt(r, out ? "Masquer la sortie" : "Voir la sortie", { size: 12, color: C.mfg });
    if (out) { const o = S.box(p, { name: "out", dir: "column", pad: [0, 14, 10, 40], vs: "auto" }); S.fillX(o); S.code(o, out); } }); return p; };
const REPORT = [["Typecheck", true, "tsc --noEmit · 0 erreur"], ["Tests", false, "bun test · 5 passés, 1 échec",
  [["✗ burndown > ligne idéale sur 10 jours", C.red], ["  attendu 0 le dernier jour, reçu 1  (component.test.tsx:28)", C.mfg]]], ["Conformité", true, "suite de conformité du SDK · 14/14"], ["Permissions", true, "tickets:read · aucune permission réseau"]];

S.draw[61] = async () => { const f = await fromBase(29, "61 · Créer un composant : rapport de validation", 3);
  const d = genDialog(f, 2, "Burndown · la validation a trouvé 1 problème.");
  attempt(d, 1, "Terminé", "done");
  checks(d, REPORT);
  S.alert(d, "kibo.component.json restauré (fichier réservé à Kibo)", "amber", { icon: "alert" });
  pills(d, 2); const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Abandonner", "outline"); S.txt(ft, "Tentative 2 sur 3", { size: 11, color: C.dim }); agentBtn(ft, "Corriger avec l'agent");
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[62] = async () => { const f = await fromBase(29, "62 · Créer un composant : tentatives épuisées", 4);
  const d = genDialog(f, 2, "Burndown · l'agent n'a pas réussi à faire passer la validation.");
  attempt(d, 3, "Échec", "failed");
  checks(d, REPORT.map(r => r.slice(0, 3)));
  S.alert(d, "Tentatives épuisées : continue dans ton éditeur (kibo component test .)", "muted", { icon: "info", desc: "Le brouillon reste dans components/src/burndown. Revalide quand les tests passent." });
  pills(d, 2); const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Abandonner", "ghost"); S.button(ft, "Ouvrir le dossier dans l'éditeur", "outline", { icon: "external" }); S.button(ft, "Revalider", "default", { icon: "refresh" });
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[63] = async () => { const f = await fromBase(29, "63 · Créer un composant : relire le diff", 5);
  const d = genDialog(f, 2, "Burndown · validation réussie. Relis le code écrit par l'agent avant de continuer.");
  const row = S.row(d, { gap: 12, align: "start" });
  const fl = S.col(row, { w: 200, gap: 4 }); [["ui.tsx", "+84", true], ["component.test.tsx", "+41", false]].forEach(([n, a, on]) => { const r = S.row(fl, { gap: 6, pad: [6, 8], fill: on ? C.accent : null, radius: 6 }); S.txt(r, "A", { size: 11, mono: true, color: C.green }); S.fillX(S.txt(r, n, { size: 12, mono: true })); S.txt(r, a, { size: 11, mono: true, color: C.green }); });
  const dv = S.box(row, { name: "Diff", fill: C.bg, stroke: C.border, radius: 8, dir: "column", vs: "auto" }); S.fillX(dv);
  const hh = S.box(dv, { name: "hunk", fill: C.muted, dir: "row", pad: [4, 12], vs: "auto" }); S.fillX(hh); S.txt(hh, "@@ -0,0 +1,84 @@ ui.tsx", { size: 11, mono: true, color: C.dim });
  ["import { useTickets } from \"@kibo/sdk\";", "", "export function Burndown({ config }: Props) {", "  const tickets = useTickets({ status: \"open\" });", "  const days = buildDays(config.sprintDays);", "  const ideal = days.map((_, i) => total - (total / (days.length - 1)) * i);", "  return <Chart remaining={remaining(days, tickets)} ideal={ideal} />;", "}"]
    .forEach((t, i) => { const l = S.box(dv, { name: "line", fill: "#0D1F12", dir: "row", gap: 10, pad: [1, 12], vs: "auto" }); S.fillX(l); S.txt(l, String(i + 1).padStart(2, " "), { size: 12, mono: true, color: C.dim }); S.txt(l, "+ " + (t || " "), { size: 12, mono: true, color: "#86EFAC" }); });
  pills(d, 2); const ft = S.row(d, { gap: 8 }); S.spacer(ft); S.button(ft, "Abandonner", "ghost"); S.button(ft, "J'ai relu, continuer", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[64] = async () => { const f = await fromBase(29, "64 · Modifier avec l'IA (dialogue)", 6);
  const d = S.dialog(f, 520, "Modifier « Burndown » avec l'IA", "Version actuelle 0.1.0 · origine IA");
  S.field(d, "Ce qu'il faut changer", "Ajoute un filtre par domaine et affiche la vélocité moyenne sous le graphique.", { multi: true, focus: true });
  S.sub(d, "L'agent reprend le code actuel. La forme de la config ne peut pas changer : pour ça, passe par le code.");
  const ft = S.row(d, { gap: 8, justify: "end" }); S.button(ft, "Annuler", "outline"); agentBtn(ft, "Lancer l'agent", { icon: "bot" });
  S.center(f, d); S.frontAbs(f); return f.id; };
return "ia ok";
