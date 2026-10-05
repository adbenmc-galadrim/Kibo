// Page « 22 · Installation & aide » : écrans 19 et 78 complétés, 76 (Général), 112c (groupe Aide), 136 à 139 (phase 14, spec §20.2 à §20.6). Requiert 18-socle.js et 24-socle-suite.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "22 · Installation & aide";
const { find, wait, rel, menu, alertDialog, formDialog, help, hline, ringed, card, pageHead, settingsScreen, appScreen, kanbanAt } = S.fx;
const { kbd, link, noProjects, bareTabs } = S.fx2;

// ---------- 19 et 78 · Premier lancement complété (§20.2) ----------
const CHECKS = (o) => [["Démon local", "En marche sur 127.0.0.1:4317 · données dans ~/.kibo", "ok"],
  ["Claude Code", o.claude === "missing" ? "claude introuvable dans le PATH · les agents sont désactivés" : o.claude === "logout" ? "claude 2.1.283 détecté · non connecté" : "claude 2.1.283 détecté · connecté à ton abonnement", o.claude === "missing" ? "fail" : o.claude === "logout" ? "warn" : "ok"],
  ["Git", "git 2.54 détecté", "ok"], ["GitHub CLI", "gh introuvable · facultatif · Pour les PR et la CI depuis Kibo", "optional"],
  ["Capacité machine", "10 cœurs, 24 Go → 4 places d'agents (modifiable)", "ok"], ["Isolation des composants", "sandbox-exec actif", "ok"], ["GitHub (optionnel)", "Pour synchroniser issues, PR et CI", "optional", "Connecter"]];
const STATE = { ok: ["check", C.green], warn: ["alert", C.amber], fail: ["x", C.red], optional: ["plus", C.mfg] };
const checkRow = (p, [t, sub, st, action]) => { const r = S.row(p, { gap: 12, pad: [12, 16] }); S.border(r); r.name = "Check-" + t; const [ic, col] = STATE[st];
  const s = S.box(r, { name: "state", fill: col, op: st === "optional" ? 0 : 0.15, stroke: st === "optional" ? C.border : null, radius: 999, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(s, ic, 13, col);
  const tv = S.col(r, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 600 }); S.txt(tv, sub, { size: 12, color: st === "fail" ? C.red : st === "warn" ? C.amber : C.mfg });
  if (st === "fail" || st === "warn") S.button(r, "Réessayer", "outline", { sm: true, icon: "refresh" }); else if (action) S.button(r, action, "outline", { sm: true }); return r; };
const welcomeAt = async (page, name, col, row, o = {}) => { const r = await appScreen(page, name, col, row, "overview", ["Vue d'ensemble"], null); noProjects(r.frame); bareTabs(r.frame);
  const c = r.content; c.flex.alignItems = "center"; c.flex.rowGap = 20; c.flex.topPadding = 72;
  const lg = S.box(c, { name: "Mark", fill: C.card, stroke: C.border, radius: 14, w: 56, h: 56, dir: "row", align: "center", justify: "center" }); S.logo(lg, 36, S.mode);
  const t = S.col(c, { name: "title", gap: 8, align: "center", w: 672 }); S.txt(t, "Bienvenue dans Kibo", { size: 22, weight: 700 });
  S.txt(t, o.claude === "missing" ? "Une vérification a échoué. Tu peux continuer : tout fonctionne sauf les agents." : "Ton centre de contrôle local. Vérifions l'environnement avant de créer ton premier projet.", { size: 13, color: C.mfg });
  const checks = S.panel(c, { name: "Checks", w: 672, gap: 0, pad: 0 }); CHECKS(o).forEach(ch => { checkRow(checks, ch);
    if (ch[0] === "Claude Code" && o.help) { const h = S.col(checks, { gap: 8, pad: [4, 16, 14, 52] }); S.txt(h, o.claude === "missing" ? "Installe Claude Code puis connecte-le à ton abonnement :" : "Connecte Claude Code à ton abonnement :", { size: 12, color: C.mfg });
      S.code(h, o.claude === "missing" ? ["npm install -g @anthropic-ai/claude-code", "claude", "/login"] : ["claude", "/login"]); }
    else if (ch[0] === "Claude Code" && o.claude === "logout") { const h = S.row(checks, { gap: 6, pad: [0, 16, 12, 52] }); S.icon(h, "chevRight", 13, C.mfg); S.txt(h, "Comment connecter Claude Code", { size: 12, color: C.mfg }); } });
  const ft = S.row(c, { gap: 12, hs: "auto" }); S.button(ft, "Suivre le didacticiel (10 min)", "secondary", { icon: "graduationCap" }); S.button(ft, "Importer un dossier existant", "outline", { icon: "folder" }); S.button(ft, "Créer mon premier projet", "default", { icon: "plus" });
  return r; };
const welcome = (name, col, row, o) => welcomeAt(PAGE, name, col, row, o);
S.fx2.welcomeAt = welcomeAt;
S.draw[19] = async () => { const { frame: f } = await welcome("19 · Premier lancement (complété)", 0, 0); return f.id; };
S.draw["19b"] = async () => { const { frame: f } = await welcome("19b · Premier lancement : Claude Code non connecté", 2, 0, { claude: "logout" }); return f.id; };
S.draw["19c"] = async () => { const { frame: f } = await welcome("19c · Premier lancement : aide dépliée", 4, 0, { claude: "logout", help: true }); return f.id; };
S.draw[78] = async () => { const { frame: f } = await welcome("78 · Premier lancement : Claude Code introuvable", 6, 0, { claude: "missing", help: true }); return f.id; };

// ---------- 76 · Paramètres › Général : Application, Mises à jour, Sauvegardes, Commande kibo (§20.2, §20.5) ----------
const BACKUPS = [["5 oct. 2026 à 09:12", "automatique", "48,6 Mo"], ["4 oct. 2026 à 18:28", "avant mise à jour", "47,9 Mo"], ["4 oct. 2026 à 09:05", "automatique", "47,2 Mo"], ["2 oct. 2026 à 14:40", "manuelle", "44,1 Mo"]];
const general = async (name, col, row, o = {}) => { const { frame: f, body } = await settingsScreen(PAGE, name, col, row, "Général");
  pageHead(body, "Général", "Démarrage, mises à jour, sauvegardes et outils en ligne de commande.");
  const a = card(body, "Application"); S.sub(a, "Comportement de Kibo sur cet ordinateur.");
  const ar = S.row(a, { gap: 12, align: "start" }); const tv = S.col(ar, { gap: 2 }); S.txt(tv, "Ouvrir Kibo à l'ouverture de session", { size: 13 });
  S.sub(tv, "Le démon démarre avec l'application. Garde Kibo dans le dossier Applications : si tu le déplaces après avoir activé ce réglage, désactive-le puis réactive-le."); S.toggle(ar, true);
  const u = card(body, "Mises à jour"); S.sub(u, "Kibo vérifie les nouvelles versions au lancement puis toutes les six heures. Rien ne s'installe sans ton accord.");
  const ur = S.row(u, { gap: 12 }); S.txt(ur, "Version installée : 1.6.0", { size: 13 }); S.txt(ur, "Kibo est à jour. · Dernière vérification à 09:12", { size: 12, color: C.mfg }); S.spacer(ur); S.button(ur, "Rechercher", "outline", { sm: true, icon: "refresh" });
  const b = card(body, "Sauvegardes"); S.sub(b, "Une copie de tes données Kibo chaque jour et avant chaque mise à jour.");
  const br = S.row(b, { gap: 12, align: "start" }); const bt = S.col(br, { gap: 2 }); S.txt(bt, "Sauvegarde automatique quotidienne", { size: 13 }); S.txt(bt, "Prochaine : demain à 09:12", { size: 12, color: C.mfg }); S.toggle(br, true);
  const dr = S.row(b, { gap: 8 }); S.icon(dr, "folder", 14, C.mfg); S.txt(dr, "Dossier", { size: 12, color: C.mfg }); S.fillX(S.txt(dr, "~/.kibo/backups", { size: 12, mono: true }));
  S.button(dr, "Ouvrir le dossier", "ghost", { sm: true, icon: "folderOpen" }); S.button(dr, "Choisir le dossier…", "ghost", { sm: true }); S.button(dr, "Dossier par défaut", "ghost", { sm: true, disabled: true });
  const nr = S.row(b, { gap: 12 }); S.button(nr, o.running ? "Sauvegarde en cours…" : "Sauvegarder maintenant", "default", { sm: true, disabled: !!o.running }); S.txt(nr, "Dernière sauvegarde aujourd'hui à 09:12 · 48,6 Mo · automatique", { size: 12, color: C.mfg });
  const lh = S.row(b, { gap: 6 }); S.icon(lh, "chevDown", 14, C.mfg); S.txt(lh, "4 sauvegardes", { size: 12, weight: 500 });
  S.table(b, [["Date"], ["Raison", 150], ["Taille", 90], ["", 100]], BACKUPS.map(([d, r, s]) => [d, r, s, c => S.button(c, "Supprimer", "ghost", { sm: true })]));
  help(b, "Les fichiers de projet (files/) et les secrets ne sont pas inclus."); help(b, "Restaurer : quitte Kibo puis remplace kibo.db, runs.db, components/ et notes/ par ceux de la sauvegarde. Guide d'installation");
  return { f, body }; };
S.draw[76] = async () => { const { f } = await general("76 · Paramètres › Général (complété)", 0, 1); return f.id; };
S.draw["76b"] = async () => { const { f } = await general("76b · Supprimer une sauvegarde", 2, 1);
  alertDialog(f, "Supprimer cette sauvegarde ?", "La sauvegarde du 2 oct. 2026 à 14:40 sera effacée du disque."); S.frontAbs(f); return f.id; };
S.draw["76c"] = async () => { const { f, body } = await general("76c · Sauvegarde en cours, dossier refusé", 4, 1, { running: true });
  const b = penpotUtils.findShapes(s => s.type === "text" && s.characters === "Sauvegardes", body)[0]; const panel = S.up(b, s => s.name === "Panel");
  const a = S.alert(null, "Ce dossier ne convient pas : choisis un dossier existant, en dehors du dossier de Kibo.", "red", { icon: "circleX" }); panel.insertChild(2, a); S.fillX(a); return f.id; };

// ---------- 112c · Menu de l'avatar : groupe Aide (§20.6) ----------
S.draw["112c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "112c · Menu de l'avatar : groupe Aide", 0, 2); await wait(1500);
  const av = find(find(f, "Topbar"), "Avatar"); ringed(av); const p = rel(f, av); const w = 260;
  menu(f, p.x + p.w - w, p.y + p.h + 6, [["adam", null, { noSlot: true, sub2: "Adam · sync.galadrim.fr" }], "-", ["Thème", "palette", { sub: true }], "-", ["Sessions", "shield"], ["Paramètres", "settings"], "-", "Aide",
    ["Raccourcis clavier", "keyboard", { kbd: "⌘/" }], ["Didacticiel", "graduationCap"], ["Quoi de neuf", "arrowUpCircle"], ["Signaler un problème", "messagePlus", { hover: true }], ["À propos de Kibo", "info"]], w);
  S.frontAbs(f); return f.id; };

// ---------- 136 · À propos (§20.3) ----------
S.draw[136] = async () => { const { frame: f } = await kanbanAt(PAGE, "136 · À propos de Kibo", 2, 2);
  const d = formDialog(f, "À propos de Kibo", 400); const hd = d.children.find(c => c.name === "header"); if (hd) hd.remove();
  const top = S.col(null, { gap: 8, align: "center" }); d.insertChild(0, top); S.fillX(top);
  const lg = S.box(top, { name: "Mark", fill: C.card, stroke: C.border, radius: 12, w: 48, h: 48, dir: "row", align: "center", justify: "center" }); S.logo(lg, 32, S.mode);
  S.txt(top, "À propos de Kibo", { size: 17, weight: 600 }); S.txt(top, "Centre de contrôle local pour tes projets de code.", { size: 13, color: C.mfg });
  const info = S.col(d, { gap: 6 }); S.txt(info, "Kibo 1.6.0", { size: 13, weight: 600 }); ["macOS · Apple Silicon · application de bureau", "Démon : PID 4821 · port 4317 · ~/.kibo", "En marche depuis 2 h 14 min"].forEach(t => S.txt(info, t, { size: 13 }));
  const ls = S.row(d, { gap: 16 }); ["Notes de version", "Code source", "Licence MIT"].forEach(t => link(ls, t));
  const ft = S.row(d, { gap: 8, justify: "end" }); S.spacer(ft); S.button(ft, "Copier les informations", "outline", { icon: "copy" }); S.button(ft, "Fermer", "default"); S.frontAbs(f); return f.id; };

// ---------- 137 · Quoi de neuf (§20.4) ----------
const NOTES_160 = ["Figma par jeton personnel, en plus du serveur MCP de l'application Figma.", "Penpot : connexion à ton instance (penpot.app ou locale) avec un jeton d'accès.", "Widget « Maquette » : un cadre Figma ou un board Penpot dans une page, avec ses tickets liés.",
  "Maquettes dans la fiche d'un ticket, avec un aperçu rendu par Kibo.", "Aperçus gardés en cache : toujours visibles hors ligne, marqués « Périmé »."];
const whatsNew = (f, notes) => { const d = formDialog(f, "Quoi de neuf dans Kibo 1.6.0", 512, "Ce qui change pour toi dans cette version.");
  if (notes) { const l = S.col(d, { gap: 8 }); notes.forEach(n => { const r = S.row(l, { gap: 8, align: "start" }); S.txt(r, "•", { size: 13 }); S.fillX(S.txt(r, n, { size: 13, lh: 1.45 })); }); }
  else S.txt(d, "Aucune note pour cette version.", { size: 13, color: C.mfg });
  const ft = S.row(d, { gap: 8 }); link(ft, "Toutes les notes de version", { icon: "external" }); S.spacer(ft); S.button(ft, "Fermer", "default"); return d; };
S.draw[137] = async () => { const { frame: f } = await kanbanAt(PAGE, "137 · Quoi de neuf", 0, 3); whatsNew(f, NOTES_160); S.frontAbs(f); return f.id; };
S.draw["137b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "137b · Quoi de neuf : aucune note", 2, 3); whatsNew(f, null); S.frontAbs(f); return f.id; };

// ---------- 138 · Signaler un problème (§20.3) ----------
const REPORT = ["# Rapport Kibo", "", "## Application", "- Kibo 1.6.0 · macOS · Apple Silicon · application de bureau", "- Démon : PID 4821 · ~/.kibo · en marche depuis 2 h 14 min", "", "## Environnement",
  "- claude 2.1.283 · connecté", "- git 2.54 · gh 2.81.0", "- 10 cœurs · 24 Go de mémoire · 3 créneaux", "", "## Contenu", "- 3 projets · 47 tickets · 7 composants · 12 instances · 5 profils", "",
  "## Intégrations", "- git : active · github : connected · figma : connected", "", "## Journal (50 dernières lignes)", "- 09:14:02 warn  sync: relais injoignable, nouvel essai dans 30 s"];
S.draw[138] = async () => { const { frame: f } = await kanbanAt(PAGE, "138 · Signaler un problème", 0, 4);
  const d = formDialog(f, "Signaler un problème", 672, "Voici le rapport que Kibo a préparé. Relis-le : il ne contient ni jeton, ni secret, ni contenu de tes projets. Copie-le, puis colle-le dans l'issue GitHub.");
  const code = S.code(d, REPORT.map(l => [l || " ", /^#/.test(l) ? C.fg : C.mfg])); code.flex.verticalSizing = "fix"; code.resize(code.width, 380); code.clipContent = true;
  S.check(d, true, "Inclure le journal"); const ft = S.row(d, { gap: 8, justify: "end" }); S.spacer(ft); S.button(ft, "Ouvrir une issue GitHub", "outline", { icon: "external" }); S.button(ft, "Copier", "default", { icon: "copy" });
  S.frontAbs(f); return f.id; };

// ---------- 139 · Raccourcis (dialogue ⌘/) (§20.6) ----------
const GROUPS = [["Navigation", [["Palette de commandes", ["⌘K"]], ["Nouvel onglet (palette)", ["⌘T"]], ["Fermer l'onglet", ["⌘W"]], ["Rouvrir le dernier onglet fermé", ["⌘⇧T"]], ["Épingler ou détacher l'onglet", ["⌘⇧P"]],
  ["Aller à l'Accueil", ["⌘1"]], ["Aller à un onglet", ["⌘2", "…", "⌘8"]], ["Dernier onglet", ["⌘9"]], ["Aide des raccourcis", ["⌘/"]]]],
  ["Palette", [["Ouvrir la sélection", ["↵"]], ["Ouvrir un ticket dans le Sheet", ["⌘↵"]], ["Filtre suivant (Tout, Tickets, Pages…)", ["Tab"]]]],
  ["Code", [["Enregistrer le fichier édité", ["⌘S"]], ["Ouvrir dans l'éditeur externe", ["⌘⇧O"]], ["Valider le commit", ["⌘↵"]]]]];
S.draw[139] = async () => { const { frame: f } = await kanbanAt(PAGE, "139 · Raccourcis (dialogue)", 2, 4);
  const d = formDialog(f, "Raccourcis", 1024, "⌘ sur macOS, Ctrl ailleurs. Dans un navigateur, certains raccourcis restent pris par le navigateur ; ils fonctionnent dans la fenêtre Kibo.");
  const cols = S.row(d, { gap: 24, align: "start" }); GROUPS.forEach(([t, items]) => { const g = S.col(cols, { gap: 10 }); S.txt(g, t, { size: 13, weight: 600 });
    items.forEach(([l, keys]) => { const r = S.row(g, { gap: 6 }); S.fillX(S.txt(r, l, { size: 13 })); keys.forEach(k => k === "…" ? S.txt(r, "…", { size: 12, color: C.dim }) : kbd(r, k)); }); });
  hline(d); link(d, "Voir dans les Paramètres"); S.frontAbs(f); return f.id; };

S.INSTALLATION = [19, "19b", "19c", 78, 76, "76b", "76c", "112c", 136, 137, "137b", 138, 139];
return "installation-aide ok";
