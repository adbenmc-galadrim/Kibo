// Page « 12 · Sync & marketplace » : écrans 65 à 75 (phase 7, plan kibo-sync-marketplace S1–S9, M1–M2).
// Bases : copies des écrans 8, 16 et 6. Collègue fictive : Léa (LM), serveur wss://sync.kibo.test.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "12 · Sync & marketplace";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const clear = (b) => [...b.children].forEach(k => k.remove());
const LEA = "#0EA5E9";
const fromBase = async (base, name, row) => { await S.page(PAGE); const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = root.children.find(c => c.name === "base · " + base).clone(); f.name = name; f.x = 0; f.y = row * 1040;
  f.children.filter(c => /^Dialog|^Overlay/.test(c.name)).forEach(c => c.remove()); return f; };
const shareBtn = (f) => S.topAction(f, "Partager", "outline", "share");
const syncState = (f, label, col) => { const bar = find(f, "AgentStatusBar"); const t = bar.children.find(c => c.type === "text" && /Démon local/.test(c.characters)); bar.flex.columnGap = 10; if (t) { S.setText(t, "● Démon local · " + label); t.fills = [{ fillColor: col, fillOpacity: 1 }]; } };
const inviteCode = "K7QD 9XMP 2RTA HW4C 8NEV B3YF QZ";
const block = (p, title, sub) => { const b = S.panel(p, { gap: 12, pad: 16 }); const h = S.row(b, { gap: 8 }); S.h(h, title, { size: 14 }); if (sub) S.txt(h, sub, { size: 12, color: C.dim }); return b; };

// ---------- Partage ----------
S.draw[65] = async () => { const f = await fromBase(8, "65 · Partager le projet (non partagé)", 0); shareBtn(f);
  const d = S.modal(f, 640, "Partager « Kibo »", "Tes collègues voient et modifient le projet depuis leur Kibo, via ton serveur de sync.");
  const srv = S.row(d, { gap: 8, pad: [8, 10], fill: C.muted, radius: 6 }); S.icon(srv, "cloud", 14, C.mfg); S.txt(srv, "wss://sync.kibo.test", { size: 12, mono: true }); S.spacer(srv); S.dot(srv, C.green, 7); S.txt(srv, "Connecté", { size: 12, color: C.mfg });
  const cols = S.row(d, { gap: 12, align: "start" });
  const col = (t, ic, items, color) => { const c = S.panel(cols, { gap: 8, pad: 14, fillX: false }); S.fillX(c); const h = S.row(c, { gap: 6 }); S.icon(h, ic, 14, color); S.txt(h, t, { size: 13, weight: 600 });
    items.forEach(i => { const r = S.row(c, { gap: 6, align: "start" }); S.txt(r, "·", { size: 12, color: C.dim }); S.fillX(S.txt(r, i, { size: 12, color: C.mfg, lh: 1.4 })); }); };
  col("Envoyé au serveur", "upload", ["Tickets et sous-tickets", "Pages et leur mise en page", "Liens entre tickets", "Workflow et domaines du projet", "Configuration des composants"], C.fg);
  col("Reste sur ta machine", "laptop", ["Dossier local et code", "Notes .md", "Runs et journaux des agents", "Secrets et serveurs MCP", "Code et confiance des composants"], C.fg);
  S.alert(d, "Le serveur voit les données en clair.", "muted", { icon: "info", desc: "Utilise un serveur que ton équipe contrôle." });
  S.footer(d, "Annuler", "Partager"); S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[66] = async () => { const f = await fromBase(8, "66 · Partager le projet (membres et invitation)", 1); shareBtn(f);
  const d = S.modal(f, 600, "Partager « Kibo »", "Partagé via wss://sync.kibo.test · 2 membres");
  S.txt(d, "Membres", { size: 12, weight: 600 });
  const m = S.panel(d, { gap: 0, pad: 0, radius: 8 });
  [["AB", "Adam (toi)", "Propriétaire", null], ["LM", "Léa", "Éditeur", LEA]].forEach(([ini, n, role, col], i) => { const r = S.row(m, { gap: 10, pad: [10, 12] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    S.avatar(r, ini, 28, col ? { fill: col, color: "#FFFFFF" } : {}); S.fillX(S.txt(r, n, { size: 13 }));
    if (i === 0) S.txt(r, role, { size: 12, color: C.mfg }); else { const sel = S.box(r, { name: "Select", fill: C.bg, stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [5, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(sel, role, { size: 12 }); S.icon(sel, "chevDown", 12, C.dim); S.button(r, "Retirer", "ghost", { sm: true }); } });
  S.txt(d, "Inviter", { size: 12, weight: 600 });
  const inv = S.row(d, { gap: 8 }); const sel = S.box(inv, { name: "Select", fill: C.bg, stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [7, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(sel, "Éditeur", { size: 13 }); S.icon(sel, "chevDown", 12, C.dim); S.button(inv, "Générer un code", "outline", { icon: "userPlus" });
  const code = S.row(d, { gap: 10, pad: [12, 14], fill: C.muted, radius: 8 }); S.fillX(S.txt(code, inviteCode, { size: 16, mono: true, weight: 500 })); S.button(code, "Copier", "outline", { sm: true, icon: "copy" });
  S.txt(d, "Valable 48 h, usage unique. Montré une seule fois.", { size: 11, color: C.dim });
  const ft = S.row(d, { gap: 8 }); S.button(ft, "Arrêter le partage", "ghost", { sm: true }); const st = ft.children[ft.children.length - 1]; penpotUtils.findShapes(s => s.type === "text", st).forEach(t => t.fills = [{ fillColor: C.red, fillOpacity: 1 }]); S.spacer(ft); S.button(ft, "Terminé", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };

// ---------- Présence, clé provisoire ----------
S.draw[67] = async () => { const f = await fromBase(8, "67 · Présence et ticket à clé provisoire", 2); shareBtn(f); syncState(f, "synchronisé", C.green);
  // pile d'avatars à droite de la barre d'onglets
  const tb = find(f, "TabBar"); const pile = S.row(null, { hs: "auto", gap: -6 }); tb.appendChild(pile); pile.layoutChild.alignSelf = "center"; pile.flex.columnGap = -6; pile.flex.rightPadding = 12;
  S.avatar(pile, "LM", 24, { fill: LEA, color: "#FFFFFF", ring: "#050506" });
  // pile réduite dans le fil d'Ariane
  const bc = find(f, "Breadcrumb"); const p2 = S.row(bc, { hs: "auto", gap: 4 }); S.box(p2, { name: "gap", w: 6, h: 1 }); S.avatar(p2, "LM", 20, { fill: LEA, color: "#FFFFFF" }); S.txt(p2, "Léa regarde cette page", { size: 11, color: C.dim });
  const tip = S.box(f, { name: "Tooltip", fill: C.primary, radius: 6, dir: "row", pad: [6, 8], hs: "auto", vs: "auto" }); tip.layoutChild.absolute = true; S.txt(tip, "Léa · Kibo › Kanban", { size: 11, color: C.pfg });
  // carte à clé provisoire dans « À faire »
  const colA = find(f, "Column / À faire"); const add = colA.children.find(c => c.name === "add");
  const card = S.card(null, { id: "KIB-…", title: "Filtrer l'import GitHub par libellés", domain: "Intégrations" }); colA.insertChild(colA.children.findIndex(c => c.id === add.id), card); S.fillX(card);
  const idt = penpotUtils.findShapes(s => s.type === "text" && s.characters === "KIB-…", card)[0]; idt.fills = [{ fillColor: C.dim, fillOpacity: 0.7 }];
  card.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, strokeStyle: "dashed" }];
  const tip2 = S.box(f, { name: "Tooltip", fill: C.primary, radius: 6, dir: "row", pad: [6, 8], hs: "auto", vs: "auto" }); tip2.layoutChild.absolute = true; S.txt(tip2, "Clé attribuée à la prochaine synchronisation", { size: 11, color: C.pfg });
  // agent d'un collègue sur KIB-22
  const c22 = find(f, "TicketCard / KIB-22"); const ag = S.box(c22, { name: "agent", fill: C.brandSoft, radius: 999, dir: "row", gap: 4, pad: [2, 6], hs: "auto", vs: "auto", align: "center" }); S.icon(ag, "bot", 12, C.brand); S.txt(ag, "opus-dev · Léa", { size: 10, color: C.brand });
  await new Promise(r => setTimeout(r, 300));
  penpotUtils.setParentXY(tip, 1440 - 36 - tip.width - 8, 9);
  penpotUtils.setParentXY(tip2, card.x - f.x + 10, card.y - f.y - 30);
  S.frontAbs(f); return f.id; };

S.draw[68] = async () => { const f = await fromBase(8, "68 · Projet en lecture seule", 3); syncState(f, "synchronisé", C.green);
  const main = find(f, "Main"); const content = find(f, "Content");
  const ban = S.box(null, { name: "ReadOnlyBanner", fill: C.muted, dir: "row", gap: 10, pad: [9, 20], vs: "auto", align: "center" }); main.insertChild(main.children.findIndex(c => c.id === content.id), ban); S.fillX(ban);
  S.icon(ban, "eye", 15, C.mfg); S.fillX(S.txt(ban, "Lecture seule — tu es lecteur de ce projet. Demande à Adam de te passer Éditeur pour modifier.", { size: 13, color: C.fg }));
  const tk = find(f, "Topbar").children.find(c => /Button/.test(c.name)); if (tk) tk.opacity = 0.45;
  penpotUtils.findShapes(s => s.name === "add", f).forEach(a => a.remove());
  return f.id; };

// ---------- Paramètres ----------
const settings = async (name, row, active) => { const f = await fromBase(16, name, row);
  const nav = find(f, "SettingsNav"); const integ = nav.children.find(c => c.name === "SidebarItem / Intégrations");
  const sync = S.navItem(null, "cloud", "Sync", {}); nav.insertChild(nav.children.findIndex(c => c.id === integ.id) + 1, sync); S.fillX(sync);
  nav.children.filter(c => /^SidebarItem/.test(c.name)).forEach(it => { const on = it.name === "SidebarItem / " + active; it.fills = on ? [{ fillColor: C.accent, fillOpacity: 1 }] : [];
    const t = it.children.find(c => c.type === "text"); t.fills = [{ fillColor: on ? C.fg : C.mfg, fillOpacity: 1 }]; });
  const cr = find(f, "Breadcrumb"); const last = penpotUtils.findShapes(s => s.type === "text", cr).pop(); S.setText(last, active);
  const body = find(f, "SettingsBody"); clear(body); return { f, body }; };
const head = (body, t, sub) => { const h = S.col(body, { gap: 4 }); S.txt(h, t, { size: 20, weight: 600 }); S.sub(h, sub, { size: 13 }); };
const tableRows = (p, cols, rows) => { const t = S.panel(p, { pad: 0, gap: 0, radius: 8 });
  const mk = (cells, headRow) => { const r = S.row(t, { gap: 12, pad: [headRow ? 8 : 10, 14] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    cells.forEach((c, j) => { const w = cols[j][1]; const cell = S.box(r, { name: "td", dir: "row", gap: 6, vs: "auto", w: w || 100, align: "center" }); if (!w) S.fillX(cell);
      if (typeof c === "function") c(cell); else S.txt(cell, c, { size: headRow ? 11 : 12, color: headRow ? C.dim : C.fg, weight: headRow ? 500 : 400, mono: !headRow && cols[j][2] === "mono" }); }); };
  mk(cols.map(c => c[0]), true); rows.forEach(r => mk(r, false)); return t; };

const buildSync = async (name, row) => { const { f, body } = await settings(name, row, "Sync");
  head(body, "Sync", "Partage tes projets avec ton équipe via ton propre serveur. Rien ne part tant que tu n'as pas cliqué « Partager ».");
  const two = S.row(body, { gap: 12, align: "start" });
  const sv = block(two, "Serveur"); const r1 = S.row(sv, { gap: 8 }); S.txt(r1, "wss://sync.kibo.test", { size: 13, mono: true }); S.spacer(r1); S.dot(r1, C.green, 7); S.txt(r1, "Connecté", { size: 12, color: C.mfg });
  S.button(sv, "Se déconnecter", "outline", { sm: true });
  const ac = block(two, "Compte"); const r2 = S.row(ac, { gap: 10 }); S.avatar(r2, "AB", 28); const tv = S.col(r2, { gap: 2 }); S.txt(tv, "Adam", { size: 13, weight: 500 }); S.txt(tv, "u_7f3c9a", { size: 11, mono: true, color: C.dim });
  const ap = block(body, "Appareils");
  tableRows(ap, [["Nom", 0], ["Ajouté", 140], ["Vu", 140], ["", 90]], [
    [c => { S.icon(c, "laptop", 14, C.mfg); S.txt(c, "MacBook d'Adam", { size: 12 }); S.badge(c, "Cet appareil", C.fg, { fill: C.accent }); }, "12 sept.", "à l'instant", " "],
    [c => { S.icon(c, "laptop", 14, C.mfg); S.txt(c, "iMac bureau", { size: 12 }); }, "18 sept.", "il y a 2 h", c => S.button(c, "Révoquer", "ghost", { sm: true })]]);
  S.button(ap, "Ajouter un appareil", "outline", { sm: true, icon: "plus" });
  const pj = block(body, "Projets partagés");
  tableRows(pj, [["Projet", 0], ["Rôle", 140], ["Dernière sync", 140], ["État", 160]], [
    [c => { S.dot(c, C.brand, 8); S.txt(c, "Kibo", { size: 12 }); }, "Propriétaire", "à l'instant", c => { S.dot(c, C.green, 7); S.txt(c, "Synchronisé", { size: 12, color: C.mfg }); }],
    [c => { S.dot(c, C.purple, 8); S.txt(c, "Portfolio", { size: 12 }); }, "Éditeur", "il y a 3 min", c => { S.dot(c, C.green, 7); S.txt(c, "Synchronisé", { size: 12, color: C.mfg }); }],
    [c => { S.dot(c, C.mfg, 8); S.txt(c, "Site Léa", { size: 12 }); }, "Lecteur", "hier", c => { S.dot(c, C.red, 7); S.txt(c, "Accès retiré", { size: 12, color: C.red }); }]]);
  syncState(f, "synchronisé", C.green); return f; };
S.draw[69] = async () => { const f = await buildSync("69 · Paramètres › Sync", 4); return f.id; };
S.draw[70] = async () => { const f = await buildSync("70 · Ajouter un appareil (code)", 5);
  const d = S.modal(f, 460, "Ajouter un appareil", "Saisis ce code sur l'autre appareil dans Paramètres › Sync.");
  const code = S.row(d, { gap: 10, pad: [14, 16], fill: C.muted, radius: 8 }); S.fillX(S.txt(code, "4F7Q 2MZK 9RDA", { size: 22, mono: true, weight: 500 })); S.button(code, "Copier", "outline", { sm: true, icon: "copy" });
  S.txt(d, "Valable 15 minutes. Montré une seule fois.", { size: 12, color: C.dim });
  const ft = S.row(d, { gap: 8, justify: "end" }); S.button(ft, "Terminé", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };

const buildSecu = async (name, row, on) => { const { f, body } = await settings(name, row, "Sécurité");
  head(body, "Sécurité", "Accès au démon, sessions et isolation des composants.");
  const ad = block(body, "Accès distant"); const r = S.row(ad, { gap: 10, align: "start" }); S.sub(r, "Le démon n'écoute que sur 127.0.0.1. L'accès distant ouvre un second port, chiffré, sur une interface que tu choisis.", { size: 12 }); S.toggle(r, on);
  if (on) { const u = S.row(ad, { gap: 8 }); S.icon(u, "globe", 14, C.mfg); S.txt(u, "https://192.168.1.20:47832", { size: 13, mono: true }); S.button(u, "Copier", "ghost", { sm: true, icon: "copy" }); S.spacer(u); S.button(u, "Désactiver", "outline", { sm: true });
    const fp = S.row(ad, { gap: 8, pad: [8, 10], fill: C.muted, radius: 6 }); S.icon(fp, "fingerprint", 14, C.mfg); S.txt(fp, "SHA-256  3F:A9:1C:7E:52:D0:8B:44:E6:19:C2:7A:0F:B3:95:6D", { size: 12, mono: true });
    S.txt(ad, "Vérifie cette empreinte dans ton navigateur à la première connexion.", { size: 11, color: C.dim }); }
  const se = block(body, "Sessions", "Une session expire après 30 jours sans activité.");
  tableRows(se, [["Appareil", 0], ["Type", 80], ["Créée", 90], ["Dernière activité", 130], ["Expire", 90], ["", 90]], [
    [c => { S.txt(c, "Tauri · MacBook d'Adam", { size: 12 }); S.badge(c, "Cette session", C.fg, { fill: C.accent }); }, "Local", "12 sept.", "à l'instant", "26 oct.", " "],
    [c => S.txt(c, "Safari · iPad", { size: 12 }), "Distant", "24 sept.", "hier", "25 oct.", c => S.button(c, "Révoquer", "ghost", { sm: true })]]);
  const iso = block(body, "Isolation des composants"); const ir = S.row(iso, { gap: 8 }); S.dot(ir, C.green, 7); S.txt(ir, "sandbox-exec actif", { size: 13, color: C.green }); S.txt(ir, "· backends sandboxés isolés par le système", { size: 12, color: C.mfg });
  const ir2 = S.row(iso, { gap: 10 }); S.fillX(S.txt(ir2, "Autoriser les backends sandboxés sans isolation OS", { size: 13 })); S.toggle(ir2, false);
  return f; };
S.draw[71] = async () => { const f = await buildSecu("71 · Paramètres › Sécurité (accès distant activé)", 6, true); return f.id; };
S.draw[72] = async () => { const f = await buildSecu("72 · Activer l'accès distant (dialogue)", 7, false);
  const d = S.modal(f, 520, "Activer l'accès distant", "Un second port chiffré (TLS), en plus de 127.0.0.1.");
  const r = S.row(d, { gap: 12, align: "start" }); S.field(r, "Interface", "en0 · 192.168.1.20", { right: "▾" }); const pf = S.box(r, { name: "port", w: 120, dir: "column", vs: "auto" }); S.field(pf, "Port", "47832", { mono: true });
  S.txt(d, "Certificat", { size: 12, weight: 500 }); const cr = S.row(d, { gap: 16 }); const a = S.row(cr, { hs: "auto", gap: 8 }); S.radio(a, true); S.txt(a, "Auto-signé", { size: 13 }); const b = S.row(cr, { hs: "auto", gap: 8 }); S.radio(b, false); S.txt(b, "Fourni (certificat et clé)", { size: 13 });
  S.alert(d, "Cet appareil sera joignable depuis le réseau", "amber", { icon: "alert", desc: "Chaque navigateur devra être appairé (écran 31). N'active pas l'accès distant sur un réseau public." });
  S.check(d, true, "Je comprends que cet appareil sera joignable depuis le réseau");
  S.footer(d, "Annuler", "Activer"); S.center(f, d); S.frontAbs(f); return f.id; };

// ---------- Marketplace ----------
const PKG = [["Burndown", "equipe/burndown", "Reste à faire par jour et ligne idéale du sprint.", "Widget", "Équipe", true, "0.4.0", "Installé 0.3.0"],
  ["PR en attente", "kibo/pr-queue", "Les PR ouvertes du projet avec leur statut CI et leurs reviewers.", "Les deux", "Kibo", true, "0.4.0", "0.4.0 disponible"],
  ["Calendrier des jalons", "equipe/milestones", "Jalons et échéances des tickets sur un calendrier.", "Vue", "Équipe", true, "1.2.0", null],
  ["Temps passé", "kibo/time-tracking", "Temps passé par ticket à partir des runs d'agents et des commits.", "Widget", "Kibo", true, "0.9.1", null],
  ["Revue de sprint", "lea/sprint-review", "Résumé de sprint : terminés, reportés, bloqués.", "Vue", "Équipe", false, "0.1.2", null],
  ["Carte des domaines", "kibo/domain-map", "Tickets regroupés par domaine avec leurs dépendances.", "Vue", "Kibo", true, "0.5.0", null]];
const buildMarket = async (name, row) => { const f = await fromBase(6, name, row);
  const content = find(f, "Content"); clear(content);
  const tabs = S.row(content, { gap: 4 }); [["Installés", false], ["Marketplace", true]].forEach(([t, on]) => { const b = S.box(tabs, { name: "tab", fill: on ? C.accent : null, radius: 6, dir: "row", pad: [6, 12], hs: "auto", vs: "auto" }); S.txt(b, t, { size: 13, weight: on ? 500 : 400, color: on ? C.fg : C.mfg }); });
  const tb = S.row(content, { gap: 8 }); const se = S.box(tb, { name: "Search", fill: C.bg, stroke: C.border, radius: 6, dir: "row", gap: 8, pad: [7, 10], vs: "auto", w: 360, align: "center" }); S.icon(se, "search", 14, C.dim); S.txt(se, "Rechercher un composant…", { size: 13, color: C.dim });
  for (const l of ["Source : toutes", "Type : tous"]) { const b = S.box(tb, { name: "Filter", stroke: C.border, radius: 6, dir: "row", gap: 6, pad: [7, 10], hs: "auto", vs: "auto", align: "center" }); S.txt(b, l, { size: 12, color: C.mfg }); S.icon(b, "chevDown", 12, C.dim); }
  S.spacer(tb); S.txt(tb, "2 sources · 6 paquets", { size: 12, color: C.dim });
  const grid = S.box(content, { name: "Grid", dir: "row", gap: 12, vs: "auto" }); S.fillX(grid); grid.flex.wrap = "wrap";
  PKG.forEach(([t, id, desc, type, src, ok, ver, badge]) => { const c = S.box(grid, { name: "PkgCard", fill: C.card, stroke: C.border, radius: 10, dir: "column", gap: 8, pad: 14, w: 368, vs: "auto" });
    const h = S.row(c, { gap: 8 }); S.icon(h, "package", 16, C.mfg); S.txt(h, t, { size: 14, weight: 600 }); S.spacer(h); if (badge) S.badge(h, badge, badge.startsWith("Installé") ? C.mfg : C.blue, { stroke: badge.startsWith("Installé") ? C.border : "#1E3A8A" });
    S.txt(c, id, { size: 11, mono: true, color: C.dim }); S.fillX(S.txt(c, desc, { size: 12, color: C.mfg, lh: 1.4 }));
    const m = S.row(c, { gap: 8 }); S.badge(m, type, C.fg, { fill: C.accent }); const e = S.row(m, { hs: "auto", gap: 4 }); S.icon(e, ok ? "badgeCheck" : "alert", 12, ok ? C.green : C.amber); S.txt(e, ok ? "vérifié · " + src : "non vérifié · " + src, { size: 11, color: ok ? C.mfg : C.amber }); S.spacer(m); S.txt(m, ver, { size: 11, mono: true, color: C.mfg }); });
  return f; };
S.draw[73] = async () => { const f = await buildMarket("73 · Composants › Marketplace", 8); return f.id; };
S.draw[74] = async () => { const f = await buildMarket("74 · Détail d'un paquet (Sheet)", 9);
  S.overlay(f, 0.4);
  const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 480, h: 860, dir: "column", gap: 14, pad: 20 }); sh.layoutChild.absolute = true; penpotUtils.setParentXY(sh, 1440 - 480, 40);
  const h = S.row(sh, { gap: 8 }); S.icon(h, "package", 18, C.fg); S.txt(h, "Calendrier des jalons", { size: 17, weight: 600 }); S.spacer(h); S.icon(h, "x", 16, C.dim);
  S.txt(sh, "equipe/milestones · 1.2.0", { size: 12, mono: true, color: C.dim });
  S.sub(sh, "Jalons et échéances des tickets sur un calendrier mensuel, avec les dépendances en retard mises en avant.", { size: 13 });
  const meta = S.col(sh, { gap: 8 }); [["Éditeur", "Léa · vérifié par Équipe", "badgeCheck"], ["Source", "Équipe (https://market.kibo.test)", "store"], ["Taille", "184 Ko", "package"], ["Empreinte", "sha256:9c41…7e0b", "fingerprint"]].forEach(([k, v, ic]) => { const r = S.row(meta, { gap: 8 }); const kk = S.box(r, { name: "k", w: 90, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.dim }); S.icon(r, ic, 13, ic === "badgeCheck" ? C.green : C.mfg); S.txt(r, v, { size: 12, mono: k === "Empreinte" }); });
  S.alert(sh, "Code vérifié : signature et empreinte correspondent", "green", { icon: "shield" });
  S.txt(sh, "Permissions", { size: 13, weight: 600 });
  ["Lire les tickets et leurs dépendances de ce projet", "Lire les pages du projet", "Aucun accès réseau"].forEach(p => { const r = S.row(sh, { gap: 8 }); S.icon(r, "check", 13, C.mfg); S.txt(r, p, { size: 12, color: C.mfg }); });
  S.txt(sh, "Versions", { size: 13, weight: 600 });
  const v = S.panel(sh, { pad: 0, gap: 0, radius: 8 }); [["1.2.0", "22 sept.", null], ["1.1.0", "2 sept.", null], ["1.0.3", "18 août", "Révoquée : calcul des échéances faux"]].forEach(([n, dte, rev]) => { const r = S.row(v, { gap: 10, pad: [8, 12] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    const t = S.txt(r, n, { size: 12, mono: true, color: rev ? C.dim : C.fg }); if (rev) t.textDecoration = "line-through"; S.txt(r, dte, { size: 12, color: C.dim }); S.spacer(r); if (rev) S.txt(r, rev, { size: 11, color: C.red }); });
  S.fillX(S.box(sh, { name: "grow", h: 10, w: 10 })).layoutChild.verticalSizing = "fill";
  const ft = S.row(sh, { gap: 8 }); S.button(ft, "Voir le code", "outline", { icon: "code" }); S.spacer(ft); S.button(ft, "Installer 1.2.0", "default", { icon: "download" });
  S.frontAbs(f); return f.id; };
S.draw[75] = async () => { const f = await buildMarket("75 · Paquet refusé (signature invalide)", 10);
  S.overlay(f, 0.4);
  const d = S.dialog(f, 500, "Installation refusée", "« Revue de sprint » 0.1.2 · lea/sprint-review");
  S.alert(d, "Signature invalide", "red", { icon: "shieldAlert", desc: "Le paquet téléchargé n'est pas signé par la clé de l'éditeur enregistrée pour la source Équipe. Rien n'a été installé." });
  S.code(d, [["attendu  ed25519:7b2e…c41a (Léa)", C.mfg], ["reçu     ed25519:0f93…22d8", C.red]]);
  S.sub(d, "Si Léa a changé de clé, fais-lui confirmer la nouvelle empreinte avant de débloquer.");
  const ft = S.row(d, { gap: 8, justify: "end" }); S.button(ft, "Débloquer…", "ghost"); S.button(ft, "Fermer", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };
return "sync ok";
