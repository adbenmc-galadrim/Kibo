// Page « 15 · Projets & réglages » : écrans 107 à 112 (phase 9, plan kibo-phase-9-vague-2). Requiert 18-socle.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "15 · Projets & réglages";
const { find, wait, abs, rel, byText, menu, alertDialog, formDialog, input, help, ringed, item, labeled, segmented, swatches, iconField, folderField, card, pageHead, settingsScreen, appScreen, kanbanAt } = S.fx;

// ---------- 107 · Menu et modification d'un projet ----------
const PROJECT_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#EC4899", "#06B6D4", "#64748B"];
S.draw[107] = async () => { const { frame: f } = await kanbanAt(PAGE, "107 · Menu d'un projet", 0, 0);
  const it = item(f, "Kibo"); ringed(it); await wait(2000); const p = rel(f, it);
  menu(f, p.x + 140, p.y + p.h - 4, [["Nouvelle page", "plus"], ["Partager", "share2"], ["Modifier…", "pencil", { hover: true }], "-", ["Supprimer…", "trash", { danger: true }]], 200);
  S.frontAbs(f); return f.id; };
const editDialog = (f, o = {}) => { const d = formDialog(f, "Modifier le projet", 480);
  labeled(d, "Nom", c => input(c, "Kibo", { focus: !o.error }));
  labeled(d, "Couleur", c => swatches(c, PROJECT_COLORS, null));
  labeled(d, "Image", c => iconField(c, { logo: true }), { help: "PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux." });
  labeled(d, "Dossier", c => folderField(c, "/Users/adam/code/kibo"), { help: "Le dossier reste sur ta machine. Vide pour délier." });
  if (o.error) S.alert(d, "Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier.", "red", { icon: "alert" });
  S.footer(d, "Annuler", "Enregistrer"); return d; };
S.draw["107b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "107b · Modifier le projet", 2, 0); editDialog(f); S.frontAbs(f); return f.id; };
S.draw["107c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "107c · Modifier le projet : dossier occupé", 4, 0); editDialog(f, { error: true }); S.frontAbs(f); return f.id; };

// ---------- 108 · Supprimer un projet ----------
const overview = async (name, col) => { const r = await appScreen(PAGE, name, col, 1, "overview", ["Vue d'ensemble"], null);
  const c = r.content; S.txt(c, "Bonjour Adam", { size: 22, weight: 600 }); S.sub(c, "3 projets · 31 tickets ouverts", { size: 13 });
  const g = S.row(c, { gap: 16, align: "start" });
  [["Kibo", C.brand, "/Users/adam/code/kibo", "8 terminés sur 24"], ["Portfolio", C.purple, "/Users/adam/code/portfolio", "3 terminés sur 9"], ["API Facturation", C.green, "/Users/adam/code/api-facturation", "5 terminés sur 14"]].forEach(([n, col, dir, pr]) => {
    const p = S.panel(g, { gap: 8, pad: 16 }); const h = S.row(p, { gap: 8 }); S.box(h, { name: "sq", fill: col, radius: 3, w: 10, h: 10 }); S.fillX(S.txt(h, n, { size: 14, weight: 600 }));
    S.txt(p, dir, { size: 11, mono: true, color: C.dim }); S.txt(p, pr, { size: 12, color: C.mfg }); });
  return r; };
const deleteDialog = (f, o = {}) => alertDialog(f, o.leave ? "Quitter le projet Kibo ?" : "Supprimer le projet Kibo ?", null, o.leave ? "Quitter le projet" : "Supprimer", 500, { body: d => {
  const b = S.col(d, { gap: 10 });
  if (o.leave) S.sub(b, "Ta copie locale sera supprimée. Le projet reste sur le serveur : il te faudra une nouvelle invitation pour y revenir.", { size: 13 });
  else { S.sub(b, "24 tickets, 5 pages et 3 widgets seront supprimés.", { size: 13 });
    S.sub(b, "Le dossier /Users/adam/code/kibo et ses fichiers ne sont pas touchés ; les notes restent sur le disque ; l'historique des runs est conservé.", { size: 13 }); }
  if (o.busy) S.alert(b, "Des agents travaillent sur ce projet", "amber", { desc: "2 runs en cours ou en file : arrête-les avant de supprimer le projet.", actions: [["Voir les agents"]] });
  if (o.shared) S.alert(b, "Ce projet est partagé", "amber", { desc: "Tu en es propriétaire : arrête d'abord le partage, ce qui le supprime du serveur pour tout le monde.", actions: [["Ouvrir le partage"]] });
  if (!o.leave && !o.busy && !o.shared) labeled(b, "Tape Kibo pour confirmer", c => input(c, o.typed ? "Kibo" : "", { focus: true }));
} });
S.draw[108] = async () => { const { frame: f } = await overview("108 · Supprimer un projet", 0); const d = deleteDialog(f, {}); await wait(1000);
  const ok = penpotUtils.findShape(s => s.name === "Button/destructive", d); if (ok) ok.opacity = 0.45; S.frontAbs(f); return f.id; };
S.draw["108b"] = async () => { const { frame: f } = await overview("108b · Supprimer un projet : confirmé", 2); deleteDialog(f, { typed: true }); S.frontAbs(f); return f.id; };
S.draw["108c"] = async () => { const { frame: f } = await overview("108c · Supprimer un projet : agents actifs", 4); const d = deleteDialog(f, { busy: true }); await wait(1000);
  const ok = penpotUtils.findShape(s => s.name === "Button/destructive", d); if (ok) ok.opacity = 0.45; S.frontAbs(f); return f.id; };
S.draw["108d"] = async () => { const { frame: f } = await overview("108d · Supprimer un projet : partagé", 6); const d = deleteDialog(f, { shared: true }); await wait(1000);
  const ok = penpotUtils.findShape(s => s.name === "Button/destructive", d); if (ok) ok.opacity = 0.45; S.frontAbs(f); return f.id; };
S.draw["108e"] = async () => { const { frame: f } = await overview("108e · Quitter un projet", 8); deleteDialog(f, { leave: true }); S.frontAbs(f); return f.id; };

// ---------- 109 · Paramètres › Workspace ----------
S.draw[109] = async () => { const { frame: f, body } = await settingsScreen(PAGE, "109 · Paramètres › Workspace", 0, 2, "Workspace");
  pageHead(body, "Workspace", "Nom, image et description de ton espace.");
  const b = card(body, "Identité");
  labeled(b, "Image", c => iconField(c, { logo: true }), { help: "PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux." });
  labeled(b, "Nom", c => input(c, "Perso"), { help: "40 caractères au plus" });
  labeled(b, "Description", c => input(c, "Mes projets et ceux de l'équipe", { h: 64 }), { help: "500 caractères au plus" });
  const ft = S.row(b, { gap: 12 }); S.button(ft, "Enregistrer", "default", { sm: true }); S.txt(ft, "Enregistré", { size: 12, color: C.mfg });
  return f.id; };

// ---------- 110 · Apparence et Sécurité ----------
S.draw[110] = async () => { const { frame: f, body } = await settingsScreen(PAGE, "110 · Paramètres › Apparence", 0, 3, "Apparence");
  pageHead(body, "Apparence", "Kibo suit le thème de ton système par défaut.");
  const b = card(body, "Thème"); segmented(b, [["Système", "monitor"], ["Clair", "sun"], ["Sombre", "moon"]], "Système"); help(b, "Le thème système suit les réglages de ton ordinateur.");
  return f.id; };
S.draw["110b"] = async () => { const { frame: f, body } = await settingsScreen(PAGE, "110b · Paramètres › Sécurité", 2, 3, "Sécurité");
  pageHead(body, "Sécurité", "Accès au démon, sessions et isolation des composants.");
  const r = card(body, "Accès distant"); const rl = S.row(r, { gap: 12 }); S.sub(rl, "Le démon n'écoute que sur 127.0.0.1. L'accès distant ouvre un second port, chiffré, sur une interface que tu choisis.", { size: 12 }); S.toggle(rl, false);
  const w = card(body, "Accès web"); const wl = S.row(w, { gap: 12 }); S.sub(wl, "Appaire un navigateur de cet ordinateur ou du réseau local avec un code à usage unique.", { size: 12 }); S.button(wl, "Générer un code", "outline", { sm: true, icon: "key" });
  const s = card(body, "Sessions"); help(s, "Une session expire après 30 jours sans activité.");
  S.table(s, [["Appareil"], ["Type", 90], ["Créée", 110], ["Dernière activité", 130], ["", 90]], [
    ["MacBook d'Adam · Cette session", "Local", "22/09", "à l'instant", cell => S.txt(cell, " ", { size: 12 })],
    ["Firefox · iPad", "Distant", "28/09", "il y a 2 h", cell => S.button(cell, "Révoquer", "ghost", { sm: true })]]);
  const i = card(body, "Isolation des composants"); const il = S.row(i, { gap: 8 }); S.dot(il, C.green, 7); S.txt(il, "sandbox-exec actif", { size: 13 }); S.txt(il, "· backends sandboxés isolés par le système", { size: 12, color: C.mfg });
  return f.id; };

// ---------- 111 · Historique des runs ----------
const historyMenu = (f, empty) => { const tb = find(f, "Topbar"); const bell = tb.children.find(c => /^icon/.test(c.name) && c.name.includes("bell")) || tb.children[tb.children.length - 2];
  const p = rel(f, bell); if (!empty) { const dot = S.box(f, { name: "BellBadge", fill: C.amber, radius: 999, w: 16, h: 16, dir: "row", align: "center", justify: "center" }); S.txt(dot, "2", { size: 10, weight: 600, color: "#09090B" }); abs(f, dot, p.x + 8, p.y - 7); }
  const items = ["Historique des runs"];
  if (empty) items.push(["Aucun run pour l'instant.", null, { noSlot: true }]);
  else items.push(["opus-dev-2 · KIB-14 · Attend une réponse · il y a 3 min", null, { noSlot: true, sub2: "Répondre", sub2Color: C.brand, hover: true }],
    ["sonnet-review · KIB-11 · Terminé · il y a 41 min", null, { noSlot: true }], ["opus-dev-1 · KIB-9 · Échec · il y a 2 h", null, { noSlot: true }], "-", ["Activer les notifications", "bell"]);
  menu(f, p.x + p.w - 360 + 40, p.y + p.h + 14, items, 360); };
S.draw[111] = async () => { const { frame: f } = await kanbanAt(PAGE, "111 · Historique des runs", 0, 4); await wait(1500); historyMenu(f, false); S.frontAbs(f); return f.id; };
S.draw["111b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "111b · Historique des runs : vide", 2, 4); await wait(1500); historyMenu(f, true); S.frontAbs(f); return f.id; };

// ---------- 112 · Menu de l'avatar ----------
S.draw[112] = async () => { const { frame: f } = await kanbanAt(PAGE, "112 · Menu de l'avatar", 0, 5); await wait(1500);
  const av = find(find(f, "Topbar"), "Avatar"); ringed(av); const p = rel(f, av); const w = 240, x = p.x + p.w - w;
  const m = menu(f, x, p.y + p.h + 6, [["adam", null, { noSlot: true, sub2: "Adam · sync.galadrim.fr" }], "-", ["Thème", "palette", { sub: true, hover: true }], "-", ["Sessions", "shield"], ["Paramètres", "settings"]], w);
  await wait(1500); const t = rel(f, byText(m, "Thème")); menu(f, x - 180 + 4, t.y - 4, [["Système", "monitor", { check: true }], ["Clair", "sun"], ["Sombre", "moon"]], 180);
  S.frontAbs(f); return f.id; };
S.draw["112b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "112b · Menu de l'avatar sans compte de sync", 2, 5); await wait(1500);
  const av = find(find(f, "Topbar"), "Avatar"); ringed(av); const p = rel(f, av); const w = 240;
  menu(f, p.x + p.w - w, p.y + p.h + 6, ["adam", "-", ["Thème", "palette", { sub: true }], "-", ["Sessions", "shield"], ["Paramètres", "settings"]], w); S.frontAbs(f); return f.id; };

S.PROJETS = [107, "107b", "107c", 108, "108b", "108c", "108d", "108e", 109, 110, "110b", 111, "111b", 112, "112b"];
return "projets-reglages ok";
