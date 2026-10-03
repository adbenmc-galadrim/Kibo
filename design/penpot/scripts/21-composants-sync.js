// Page « 17 · Composants & synchronisation » : écrans 116 à 120 (phase 9, plan kibo-phase-9-vague-3 ; 116 amendé par la vague 4). Requiert 18-socle.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "17 · Composants & synchronisation";
const { find, wait, shadow, abs, rel, menu, alertDialog, formDialog, input, help, hline, labeled, segmented, card, pageHead, settingsScreen, appScreen } = S.fx;

const toggles = (p, label, opts, on) => { const r = S.row(p, { gap: 8, hs: "auto" }); S.txt(r, label, { size: 12, color: C.mfg }); segmented(r, opts, on); return r; };
const compScreen = async (name, col, row, tab = "Installés") => { const r = await appScreen(PAGE, name, col, row, null, ["Composants"], ["puzzle", "Composants"]); S.activate(r.frame, "Composants");
  const c = r.content; pageHead(c, "Composants", "Les widgets et vues disponibles dans tes pages. Les composants intégrés viennent avec Kibo ; les autres sont à toi, créés par l'IA ou installés depuis une marketplace.",
    h => { S.button(h, "Créations (2)", "ghost", { sm: true, icon: "sparkles" }); S.button(h, "Créer un composant", "default", { sm: true, icon: "plus" }); });
  segmented(c, ["Installés", "Marketplace"], tab); return r; };
const COMPONENTS = [["Burndown du sprint", "0.1.0", "Isolé", "Créé par l'IA", "1 page · 1 projet"], ["Kanban", "1.0.0", "Intégré", "Kibo", "3 pages · 2 projets"], ["Météo", "1.2.0", "Isolé", "Marketplace", "Aucune page"],
  ["Notes", "1.0.0", "Intégré", "Kibo", "2 pages · 1 projet"], ["Tickets", "1.0.0", "Intégré", "Kibo", "2 pages · 2 projets"]];
const filters = (c, q, trust = "Tous", origin = "Tous") => { const b = S.row(c, { gap: 16 }); input(b, q || "Rechercher un composant", { icon: "search", placeholder: !q, w: 260 });
  toggles(b, "Confiance", ["Tous", "Fiables", "Isolés", "À examiner"], trust); toggles(b, "Origine", ["Tous", "Kibo", "Les miens", "Créés par l'IA", "Marketplace"], origin); return b; };
const compTable = (c, rows, o = {}) => { let more = null, usage = null;
  const head = t => cell => { S.txt(cell, t, { size: 11, weight: 500, color: C.dim }); S.icon(cell, t === "Nom" ? "arrowUp" : "chevDown", 12, t === "Nom" ? C.fg : C.dim); };
  const t = S.table(c, [["Nom"], ["Version", 100], ["Confiance", 130], ["Origine", 140], ["Utilisé dans", 180], ["", 28]], rows.map(([n, v, tr, or, use], i) => [
    cell => S.txt(cell, n, { size: 13, weight: 500 }), cell => S.txt(cell, v, { size: 12, mono: true, color: C.mfg }), cell => S.txt(cell, tr, { size: 12, color: C.mfg }), cell => S.txt(cell, or, { size: 12, color: C.mfg }),
    cell => { if (use === "Aucune page") S.txt(cell, use, { size: 12, color: C.dim }); else { const b = S.button(cell, use, "ghost", { sm: true }); if (n === o.usage) { b.fills = [{ fillColor: C.accent, fillOpacity: 1 }]; usage = b; } } },
    cell => { const m = S.box(cell, { name: "MoreButton", fill: n === o.menu ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(m, "more", 14, C.mfg); if (n === o.menu) more = m; }]), { hl: o.hl });
  const th = t.children.find(k => k.name === "thead"); if (th) th.children.forEach((cell, j) => { const label = ["Nom", "Version", "Confiance", "Origine", "Utilisé dans"][j]; if (!label) return; [...cell.children].forEach(k => k.remove()); head(label)(cell); });
  return { t, more, usage }; };

// ---------- 116 · Composants › Installés ----------
S.draw[116] = async () => { const { frame: f, content: c } = await compScreen("116 · Composants › Installés", 0, 0); filters(c); compTable(c, COMPONENTS, { usage: "Kanban", hl: 1 });
  const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 400, h: 900, dir: "column", gap: 14, pad: [20, 20] }); shadow(sh); abs(f, sh, 1440 - 400, 40);
  const h = S.row(sh, { gap: 8 }); const tv = S.col(h, { gap: 2 }); S.txt(tv, "Utilisé dans", { size: 15, weight: 600 }); S.txt(tv, "Kanban 1.0.0", { size: 12, color: C.mfg }); S.icon(h, "x", 16, C.dim); hline(sh);
  ["Kibo › Sprint", "Kibo › Tableau de bord", "Portfolio › Accueil"].forEach((p, i) => { const r = S.row(sh, { gap: 8, pad: [6, 8], radius: 6, fill: i === 1 ? C.accent : null }); S.icon(r, "file", 14, C.mfg); S.txt(r, p, { size: 13, weight: 500 }); });
  hline(sh); const d = S.row(sh, { gap: 6 }); S.icon(d, "chevDown", 14, C.mfg); S.txt(d, "Détails", { size: 12, weight: 500 }); const dv = S.col(sh, { gap: 4, pad: [0, 0, 0, 20] });
  S.txt(dv, "kanban · 1.0.0", { size: 12, mono: true, color: C.mfg }); S.txt(dv, "Formats : Moyen, Large, Demi-page", { size: 12, color: C.mfg });
  S.frontAbs(f); return f.id; };
S.draw["116b"] = async () => { const { frame: f, content: c } = await compScreen("116b · Composants : aucun résultat", 2, 0); filters(c, "calendrier", "Fiables", "Marketplace"); compTable(c, []);
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [48, 0], vs: "auto", align: "center" }); S.fillX(e); S.txt(e, "Aucun composant ne correspond.", { size: 14, weight: 600 }); S.button(e, "Effacer les filtres", "outline", { sm: true });
  return f.id; };

// ---------- 117 · Confirmations et Marketplace ----------
S.draw[117] = async () => { const { frame: f, content: c } = await compScreen("117 · Menu d'un composant", 0, 1); filters(c); const { more } = compTable(c, COMPONENTS, { menu: "Météo", hl: 2 }); await wait(2000);
  const p = rel(f, more); const m = menu(f, p.x + p.w - 250, p.y + p.h + 4, [["Vérifier le code", "scanSearch"], ["Bloquer ce composant…", "shieldOff"], ["Modifier avec l'IA", "sparkles"], ["Publier sur la marketplace", "upload"], "-", ["Désinstaller…", "trash", { danger: true }]], 250);
  const ai = penpotUtils.findShape(s => s.type === "text" && s.characters === "Modifier avec l'IA", m); if (ai) { ai.fills = [{ fillColor: C.brand, fillOpacity: 1 }]; const ic = ai.parent.children.find(k => /^icon/.test(k.name)); if (ic) penpotUtils.findShapes(x => x.strokes?.length, ic).forEach(x => x.strokes = x.strokes.map(s => ({ ...s, strokeColor: C.brand }))); }
  S.frontAbs(f); return f.id; };
S.draw["117b"] = async () => { const { frame: f, content: c } = await compScreen("117b · Désinstaller un composant", 2, 1); filters(c); compTable(c, COMPONENTS);
  alertDialog(f, "Désinstaller Météo 1.2.0 ?", "Le composant est retiré de ton workspace. Il n'est posé sur aucune page.", "Désinstaller"); S.frontAbs(f); return f.id; };
S.draw["117c"] = async () => { const { frame: f, content: c } = await compScreen("117c · Bloquer un composant", 4, 1); filters(c); compTable(c, COMPONENTS);
  alertDialog(f, "Bloquer Météo 1.2.0 ?", "Ses instances n'affichent plus rien tant que tu ne l'examines pas de nouveau. Le composant reste installé.", "Bloquer"); S.frontAbs(f); return f.id; };
const PACKAGES = [["Météo", "Prévisions de la ville de ton choix, rafraîchies toutes les heures.", "Widget", "Galadrim · vérifié par Galadrim", "Installé 1.2.0", true],
  ["Calendrier des jalons", "Jalons et échéances des tickets sur un calendrier mensuel.", "Vue", "Léa · vérifié par Galadrim", "1.2.0 disponible", false],
  ["Revue de sprint", "Résumé du sprint : tickets terminés, glissés et bloqués.", "Widget", "Léa · vérifié par Galadrim", "0.1.2 disponible", false]];
S.draw["117d"] = async () => { const { frame: f, content: c } = await compScreen("117d · Marketplace : détails d'une carte", 6, 1, "Marketplace");
  const b = S.row(c, { gap: 8 }); input(b, "Rechercher un composant…", { icon: "search", placeholder: true, w: 300 }); S.button(b, "Source : toutes", "outline", { sm: true }); S.button(b, "Type : tous", "outline", { sm: true }); S.spacer(b); S.txt(b, "1 source · 3 paquets", { size: 12, color: C.dim });
  const g = S.row(c, { gap: 12, align: "start" });
  PACKAGES.forEach(([t, d, k, pub, ver, open]) => { const p = S.panel(g, { gap: 8, pad: 14 }); const h = S.row(p, { gap: 8 }); S.icon(h, "package", 16, C.mfg); S.fillX(S.txt(h, t, { size: 14, weight: 600 })); S.badge(h, ver, C.mfg);
    S.sub(p, d, { size: 12 }); const m = S.row(p, { gap: 8 }); S.badge(m, k, C.fg, { fill: C.accent }); const e = S.row(m, { hs: "auto", gap: 4 }); S.icon(e, "badgeCheck", 12, C.green); S.txt(e, pub, { size: 11, color: C.mfg });
    const dt = S.row(p, { gap: 6 }); S.icon(dt, open ? "chevDown" : "chevRight", 14, C.mfg); S.txt(dt, "Détails", { size: 12, weight: 500, color: C.mfg });
    if (open) { const dv = S.col(p, { gap: 4, pad: [0, 0, 0, 20] }); S.txt(dv, "galadrim/meteo · 1.2.0", { size: 12, mono: true, color: C.mfg }); S.txt(dv, "Empreinte · sha256:9f2c…a41b", { size: 12, mono: true, color: C.mfg }); } });
  return f.id; };
S.draw["117e"] = async () => { const { frame: f, content: c } = await compScreen("117e · Marketplace sans source", 8, 1, "Marketplace");
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [72, 0], vs: "auto", align: "center" }); S.fillX(e);
  const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 48, h: 48, dir: "row", align: "center", justify: "center" }); S.icon(ic, "store", 22, C.mfg);
  S.txt(e, "Aucune source de composants", { size: 15, weight: 600 }); S.txt(e, "Une source est un catalogue signé, publié par ton équipe ou par un tiers.", { size: 13, color: C.mfg });
  const r = S.row(e, { gap: 12, hs: "auto" }); S.button(r, "Ajouter une source", "default", { sm: true, icon: "plus" }); S.button(r, "Gérer les sources", "ghost", { sm: true }); return f.id; };

// ---------- 118 · Sources de composants ----------
const sources = async (name, col) => { const r = await settingsScreen(PAGE, name, col, 2, "Sources de composants"); const b = r.body;
  pageHead(b, "Sources de composants", "Les catalogues où tu installes des composants. Chaque catalogue est signé par sa source.", h => { S.button(h, "Tout rafraîchir", "outline", { sm: true, icon: "refresh" }); S.button(h, "Ajouter une source", "default", { sm: true, icon: "plus" }); });
  let more = null;
  S.table(b, [["Nom", 120], ["Adresse"], ["Version du catalogue", 140], ["Mise à jour", 110], ["État", 90], ["", 28]], [["Galadrim", "https://sync.galadrim.fr/market/", "42", "il y a 2 h"], ["Kibo", "https://market.kibo.test/", "17", "hier"]].map(([n, u, v, w], i) => [
    cell => { S.icon(cell, "store", 14, C.mfg); S.txt(cell, n, { size: 12, weight: 500 }); }, cell => S.txt(cell, u, { size: 12, mono: true }), cell => S.txt(cell, v, { size: 12, mono: true, color: C.mfg }), w,
    cell => { S.dot(cell, C.green, 7); S.txt(cell, "À jour", { size: 12, color: C.mfg }); },
    cell => { const m = S.box(cell, { name: "MoreButton", fill: i === 0 && r.menu ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(m, "more", 14, C.mfg); if (i === 0) more = m; }]));
  S.txt(b, "Aucune source n'est ajoutée par défaut. Compare l'empreinte de la clé avec celle communiquée par l'éditeur avant d'ajouter une source.", { size: 11, color: C.dim }); return { ...r, more }; };
S.draw[118] = async () => { const { frame: f, more } = await sources("118 · Sources de composants", 0); more.fills = [{ fillColor: C.accent, fillOpacity: 1 }]; await wait(2000);
  const p = rel(f, more); menu(f, p.x + p.w - 230, p.y + p.h + 4, [["Rafraîchir cette source", "refresh"], "-", ["Retirer…", "trash", { danger: true }]], 230); S.frontAbs(f); return f.id; };
S.draw["118b"] = async () => { const { frame: f } = await sources("118b · Retirer une source", 2);
  alertDialog(f, "Retirer la source Galadrim ?", "Les composants déjà installés restent. Si tu la rajoutes plus tard, Kibo reconnaîtra ses éditeurs.", "Retirer"); S.frontAbs(f); return f.id; };

// ---------- 119 · Synchronisation ----------
const sync = async (name, col, row) => { const r = await settingsScreen(PAGE, name, col, row, "Synchronisation"); pageHead(r.body, "Synchronisation"); return r; };
S.draw[119] = async () => { const { frame: f, body: b } = await sync("119 · Synchronisation : premier pas", 0, 3);
  const i = S.panel(b, { dir: "row", gap: 12, pad: [14, 16], align: "start" }); S.icon(i, "cloud", 18, C.mfg); const tv = S.col(i, { gap: 4 }); S.txt(tv, "Partage tes projets entre tes appareils et avec ton équipe.", { size: 13, weight: 500 });
  const l = S.row(tv, { gap: 4 }); S.txt(l, "Il te faut un serveur kibo-sync, hébergé par ton équipe.", { size: 12, color: C.mfg }); const a = S.txt(l, "Comment en installer un", { size: 12, weight: 500 }); a.textDecoration = "underline";
  const r = S.row(b, { gap: 12, align: "start" });
  [["Se connecter à un serveur", "Avec l'adresse et le code reçus de l'administrateur.", "Se connecter"], ["C'est mon autre appareil", "Sur l'appareil déjà connecté : Paramètres › Synchronisation › Appareils › Ajouter un appareil. Le code vaut 15 minutes.", "Entrer le code"]].forEach(([t, d, btn]) => {
    const p = S.panel(r, { gap: 8, pad: 20 }); S.txt(p, t, { size: 14, weight: 600 }); S.sub(p, d, { size: 12 }); S.button(p, btn, "outline", { sm: true }); });
  return f.id; };
const connected = (b, o = {}) => { let devMore = null, projMore = null;
  const sv = card(b, "Serveur"); const r1 = S.row(sv, { gap: 8 }); S.txt(r1, "sync.galadrim.fr", { size: 13, weight: 500 }); S.badge(r1, "Connecté", C.green, { dot: C.green }); S.spacer(r1); S.button(r1, "Se déconnecter", "outline", { sm: true });
  const d1 = S.row(sv, { gap: 6 }); S.icon(d1, "chevRight", 14, C.mfg); S.txt(d1, "Détails", { size: 12, color: C.mfg });
  const ac = card(b, "Compte"); const r2 = S.row(ac, { gap: 8 }); S.avatar(r2, "AD", 24); S.txt(r2, "Adam", { size: 13, weight: 500 }); const d2 = S.row(ac, { gap: 6 }); S.icon(d2, "chevRight", 14, C.mfg); S.txt(d2, "Détails", { size: 12, color: C.mfg });
  const dv = card(b, "Appareils"); const dh = dv.children[0]; S.spacer(dh); S.button(dh, "Ajouter un appareil", "outline", { sm: true, icon: "plus" });
  [["MacBook d'Adam", "Cet appareil", "laptop"], ["PC maison", "vu il y a 2 h", "monitor"]].forEach(([n, s, ic], i) => { const r = S.row(dv, { gap: 8, pad: [6, 0] }); S.icon(r, ic, 14, C.mfg); S.txt(r, n, { size: 13 });
    if (i === 0) S.badge(r, s, C.fg, { fill: C.accent }); else S.txt(r, "· " + s, { size: 12, color: C.dim }); S.spacer(r); if (i === 1) devMore = S.button(r, "Révoquer…", "ghost", { sm: true }); });
  const pj = card(b, "Projets partagés"); [["Kibo", "propriétaire", "synchronisé il y a 1 min", C.brand], ["Portfolio", "éditeur", "synchronisé il y a 6 min", C.purple]].forEach(([n, role, s, col], i) => {
    const r = S.row(pj, { gap: 8, pad: [6, 0] }); S.box(r, { name: "sq", fill: col, radius: 2, w: 8, h: 8 }); S.txt(r, n, { size: 13, weight: 500 }); S.txt(r, "· " + role + " · " + s, { size: 12, color: C.mfg }); S.spacer(r);
    const m = S.box(r, { name: "MoreButton", fill: i === 0 && o.projMenu ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(m, "more", 14, C.mfg); if (i === 0) projMore = m; });
  return { devMore, projMore }; };
S.draw["119b"] = async () => { const { frame: f, body: b } = await sync("119b · Synchronisation : connecté", 2, 3); const { projMore } = connected(b, { projMenu: true }); await wait(2000);
  const p = rel(f, projMore); menu(f, p.x + p.w - 220, p.y + p.h + 4, [["Ouvrir", "external"], ["Gérer le partage…", "users"], "-", ["Arrêter le partage…", "trash", { danger: true }]], 220); S.frontAbs(f); return f.id; };
S.draw["119c"] = async () => { const { frame: f, body: b } = await sync("119c · Révoquer un appareil", 4, 3); connected(b);
  alertDialog(f, "Révoquer PC maison ?", "Cet appareil ne pourra plus se connecter.", "Révoquer"); S.frontAbs(f); return f.id; };

// ---------- 120 · Se connecter et Ajouter un appareil ----------
S.draw[120] = async () => { const { frame: f } = await sync("120 · Se connecter à un serveur", 0, 4); const d = formDialog(f, "Se connecter à un serveur", 500, "Saisis l'adresse du serveur et le code reçu.");
  labeled(d, "Adresse du serveur", c => input(c, "wss://sync.galadrim.fr", { mono: true, focus: true }), { help: "Donnée par ton équipe, elle commence par wss://" });
  labeled(d, "Code", c => input(c, "A7K2 9FQ3 XM4P", { mono: true }), { help: "Code d'invitation (48 h) ou code d'appareil (15 min)." });
  labeled(d, "Nom de cet appareil", c => input(c, "MacBook d'Adam"));
  const adv = S.row(d, { gap: 6 }); S.icon(adv, "chevRight", 14, C.mfg); S.txt(adv, "Options avancées", { size: 12, weight: 500, color: C.mfg });
  S.footer(d, "Annuler", "Se connecter"); S.frontAbs(f); return f.id; };
S.draw["120b"] = async () => { const { frame: f, body: b } = await sync("120b · Ajouter un appareil", 2, 4); connected(b); const d = formDialog(f, "Ajouter un appareil", 500, "Valable 15 minutes. Montré une seule fois.");
  const code = S.panel(d, { dir: "row", gap: 8, pad: [12, 14], fill: C.muted, align: "center" }); S.fillX(S.txt(code, "A7K2 9FQ3 XM4P 8RT6", { size: 18, weight: 600, mono: true })); S.button(code, "Copier", "outline", { sm: true, icon: "copy" });
  const ad = S.row(d, { gap: 8 }); S.fillX(S.txt(ad, "Adresse du serveur : sync.galadrim.fr", { size: 13 })); S.button(ad, "Copier", "ghost", { sm: true, icon: "copy" });
  const st = S.col(d, { gap: 6 }); ["1. Sur l'autre appareil, ouvre Paramètres › Synchronisation.", "2. Choisis « C'est mon autre appareil ».", "3. Saisis l'adresse et ce code (15 minutes)."].forEach(t => S.txt(st, t, { size: 13, color: C.mfg }));
  S.footer(d, null, "Terminé"); S.frontAbs(f); return f.id; };

S.COMPOSANTS = [116, "116b", 117, "117b", "117c", "117d", "117e", 118, "118b", 119, "119b", "119c", 120, "120b"];
return "composants-sync ok";
