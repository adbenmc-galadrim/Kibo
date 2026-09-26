// Page « 13 · Compléments » : écrans 76 à 78 (revue-flows §7 : Paramètres Général et Raccourcis, échec du premier lancement).
// Bases : copies des écrans 16 et 19.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "13 · Compléments";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const clear = (b) => [...b.children].forEach(k => k.remove());
const fromBase = async (base, name, row) => { await S.page(PAGE); const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = root.children.find(c => c.name === "base · " + base).clone(); f.name = name; f.x = 0; f.y = row * 1040; return f; };
const settings = async (name, row, active) => { const f = await fromBase(16, name, row);
  const nav = find(f, "SettingsNav"); const integ = nav.children.find(c => c.name === "SidebarItem / Intégrations");
  const sync = S.navItem(null, "cloud", "Sync", {}); nav.insertChild(nav.children.findIndex(c => c.id === integ.id) + 1, sync); S.fillX(sync);
  nav.children.filter(c => /^SidebarItem/.test(c.name)).forEach(it => { const on = it.name === "SidebarItem / " + active; it.fills = on ? [{ fillColor: C.accent, fillOpacity: 1 }] : [];
    const t = it.children.find(c => c.type === "text"); t.fills = [{ fillColor: on ? C.fg : C.mfg, fillOpacity: 1 }]; });
  const cr = find(f, "Breadcrumb"); const last = penpotUtils.findShapes(s => s.type === "text", cr).pop(); S.setText(last, active);
  const body = find(f, "SettingsBody"); clear(body); return { f, body }; };
const head = (body, t, sub) => { const h = S.col(body, { gap: 4 }); S.txt(h, t, { size: 20, weight: 600 }); S.sub(h, sub, { size: 13 }); };
const block = (p, title, sub) => { const b = S.panel(p, { gap: 12, pad: 16 }); const h = S.row(b, { gap: 8 }); S.h(h, title, { size: 14 }); if (sub) S.txt(h, sub, { size: 12, color: C.dim }); return b; };
const line = (p, label, help, right) => { const r = S.row(p, { gap: 12 }); const tv = S.col(r, { gap: 2 }); S.txt(tv, label, { size: 13 }); if (help) S.txt(tv, help, { size: 11, color: C.dim }); right(r); return r; };
const select = (p, v) => { const s = S.box(p, { name: "Select", fill: C.bg, stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [6, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(s, v, { size: 12 }); S.icon(s, "chevDown", 12, C.dim); return s; };
const kbd = (p, k) => { const b = S.box(p, { name: "kbd", fill: C.accent, stroke: C.border, radius: 4, dir: "row", pad: [2, 6], hs: "auto", vs: "auto" }); S.txt(b, k, { size: 11, mono: true }); return b; };

S.draw[76] = async () => { const { f, body } = await settings("76 · Paramètres › Général", 0, "Général");
  head(body, "Général", "Langue, démarrage et outils en ligne de commande.");
  const g = block(body, "Application");
  line(g, "Langue", null, r => select(r, "Français"));
  line(g, "Ouvrir Kibo à l'ouverture de session", "Le démon démarre avec l'application", r => S.toggle(r, true));
  line(g, "Dossier des données", "~/.kibo · base SQLite, journaux des runs, onglets", r => S.button(r, "Ouvrir", "outline", { sm: true, icon: "folder" }));
  const k = block(body, "Commande kibo");
  S.sub(k, "Installe la commande kibo dans ~/.local/bin pour créer, tester et publier tes composants.", { size: 12 });
  const r = S.row(k, { gap: 10 }); S.button(r, "Installer la commande kibo", "outline", { sm: true, icon: "terminal" }); S.txt(r, "Non installée", { size: 12, color: C.dim });
  S.alert(k, "Impossible d'installer la commande kibo", "red", { icon: "circleX", desc: "~/.local/bin n'est pas accessible en écriture. Crée le dossier ou corrige ses droits, puis réessaie." });
  const r2 = S.row(k, { gap: 8 }); S.dot(r2, C.green, 7); S.txt(r2, "Une fois installée : « Installée : ~/.local/bin/kibo »", { size: 12, color: C.mfg });
  return f.id; };

S.draw[77] = async () => { const { f, body } = await settings("77 · Paramètres › Raccourcis", 1, "Raccourcis");
  head(body, "Raccourcis", "⌘ sur macOS, Ctrl ailleurs. Dans un navigateur, certains raccourcis restent pris par le navigateur ; ils fonctionnent dans la fenêtre Kibo.");
  const groups = [["Navigation", [["Palette de commandes", ["⌘K"]], ["Nouvel onglet (palette)", ["⌘T"]], ["Fermer l'onglet", ["⌘W"]], ["Aller à l'Accueil", ["⌘1"]], ["Aller à un onglet", ["⌘2", "…", "⌘8"]], ["Dernier onglet", ["⌘9"]]]],
    ["Palette", [["Ouvrir la sélection", ["↵"]], ["Ouvrir un ticket dans le Sheet", ["⌘↵"]], ["Filtre suivant (Tout, Tickets, Pages…)", ["Tab"]]]],
    ["Code", [["Enregistrer le fichier édité", ["⌘S"]], ["Ouvrir dans l'éditeur externe", ["⌘⇧O"]]]]];
  const row = S.row(body, { gap: 12, align: "start" });
  groups.forEach(([t, items]) => { const b = block(row, t); items.forEach(([l, keys]) => { const r = S.row(b, { gap: 6 }); S.fillX(S.txt(r, l, { size: 12, color: C.mfg })); keys.forEach(k => k === "…" ? S.txt(r, "…", { size: 12, color: C.dim }) : kbd(r, k)); }); });
  return f.id; };

S.draw[78] = async () => { const f = await fromBase(19, "78 · Premier lancement : échec d'une vérification", 2);
  const cl = find(f, "Check-Claude Code"); const st = cl.children.find(c => c.name === "state"); st.fills = [{ fillColor: C.red, fillOpacity: 0.15 }]; clear(st); S.icon(st, "x", 13, C.red);
  const ts = cl.children.find(c => c.name === "t").children.filter(c => c.type === "text"); S.setText(ts[1], "claude introuvable dans le PATH · les agents sont désactivés"); ts[1].fills = [{ fillColor: C.red, fillOpacity: 1 }];
  S.button(cl, "Réessayer", "outline", { sm: true, icon: "refresh" });
  const checks = find(f, "Checks"); const help = S.col(null, { gap: 8, pad: [10, 14, 12, 50] }); checks.insertChild(checks.children.findIndex(c => c.id === cl.id) + 1, help); S.fillX(help);
  S.txt(help, "Installe Claude Code puis connecte-le à ton abonnement :", { size: 12, color: C.mfg }); S.code(help, [["npm install -g @anthropic-ai/claude-code", C.fg], ["claude login", C.fg]]);
  const title = find(f, "title"); const tt = title.children.filter(c => c.type === "text"); S.setText(tt[1], "Une vérification a échoué. Tu peux continuer : tout fonctionne sauf les agents.");
  return f.id; };
return "complements ok";
