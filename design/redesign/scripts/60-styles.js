// Trois directions de style hors shadcn : 1 « Carnet de centre », 2 « Instrument », 3 « Atelier ».
// Données : plan fictif de Silo (22 fonctionnalités F00 à F21, sprints S1 à S10, mise en production le 18/12).
const S = storage;
S.draw = S.draw || {};
Object.assign(S.ICONS, {
  package: S.ICONS.package || '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
});

// ---------- Données Silo (plan fictif, location de box) ----------
const F = (k, name, short, from, to, steps) => ({ k, name, short, from, to, steps });
S.E = {
  sprints: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"],
  dates: ["12–16 oct.", "19–23 oct.", "26–30 oct.", "2–6 nov.", "9–13 nov.", "16–20 nov.", "23–27 nov.", "30 nov.–4 déc.", "7–11 déc.", "14–18 déc."],
  open: [["F01", "F02"], ["F01", "F02"], ["F03", "F04"], ["F05", "F06"], ["F06", "F07"], ["F08", "F09"], ["F10", "F11"], ["F12", "F13"], ["F13", "F14"], ["F14", "F15"]],
  closed: [[], ["F01", "F02"], ["F03", "F04"], ["F05"], ["F06", "F07"], ["F08", "F09"], ["F10", "F11"], ["F12"], ["F13"], ["F14", "F15"]],
  tracks: ["P1", "P1", "P1", "P1", null, null, null, null, "P2", "P2"],
  f: [
    F("F00", "Socle et déploiement", "Socle", -1, -1, "LLLLLLLLL"),
    F("F01", "Se connecter avec Microsoft", "Connexion Microsoft", 0, 1, "LRRTTT"),
    F("F02", "Créer et consulter ses clients", "Clients", 0, 1, "TRTTTTTTT"),
    F("F03", "Donner accès à un locataire", "Accès locataire", 2, 2, "TTTTTT"),
    F("F04", "Voir les constats d'un client", "Constats", 2, 2, "TTTT"),
    F("F05", "Constituer l'équipe d'un client", "Équipe", 3, 3, "TTT"),
    F("F06", "Valider un constat au clic", "Fiche constat", 3, 4, "TTTTT"),
    F("F07", "Piloter l'accueil au Kanban", "Kanban accueil", 4, 4, "TTTT"),
    F("F08", "Encoder les badges d'accès", "Badges accès", 5, 5, "LTTT"),
    F("F09", "Gérer un constat", "Gérer un constat", 5, 5, "TTTTTTT"),
    F("F10", "Importer les constats depuis Excel", "Import Excel", 6, 6, "TTTTT"),
    F("F11", "Plans des box et fichiers", "Plans box", 6, 6, "RTTT"),
    F("F12", "Scanner au lecteur", "Scan lecteur", 7, 7, "TTTB"),
    F("F13", "Libérer les box : état des lieux et caution", "Libération", 7, 8, "TTTTT"),
    F("F14", "Travailler hors ligne au centre", "Hors ligne", 8, 9, "TTTTTT"),
    F("F15", "Suivre l'occupation : KPIs et reporting", "KPIs", 9, 9, "TTTTT"),
    F("F16", "Être relancé", "Relances", 10, 10, "TTTTB"),
    F("F17", "Organigramme de client", "Organigramme", 10, 10, "TTT"),
    F("F18", "Partager l'état du box avec le client", "Partage client", 10, 10, "TTB"),
    F("F19", "Photographier un constat", "Photos", 10, 10, "TT"),
    F("F20", "Faire évoluer les tarifs", "Tarifs", 10, 10, "TTT"),
    F("F21", "Clôturer, archiver, exporter un client", "Clôture", 10, 10, "TTT") ],
  p: [F("P1", "Staging recettable par le client", "Staging", 0, 3, "TBTTTTT"), F("P2", "Mise en production", "Production", 8, 9, "TTTTTTTTT")],
  f01steps: [["SILO-13", "Spike SSO Microsoft Entra ID", "L", "livré"], ["SILO-14", "Connexion Microsoft, écrans 1.0 à 1.3", "R", "PR #11 à relire"], ["SILO-15", "Compte non provisionné", "R", "PR #12, empilée"],
    ["N01", "Profil courant côté client", "T", ""], ["N02", "Seed de démo multi-rôles", "T", ""], ["N03", "Démo e2e de la connexion", "T", ""]],
  blockers: [
    { kind: "BLK", icon: "lock", title: "Le staging attend la DSI", body: "Le compte AWS (SILO-7) attend la validation DSI ; le dossier d'hébergement (SILO-6) n'est pas commencé. Pas de recette client d'ici là.", meta: "P1 · Staging recettable" },
    { kind: "Q", icon: "question", title: "Qui peut créer un client ?", body: "Admin seul, ou aussi le chargé de clientèle ? La garde de création (N04) en dépend.", meta: "Question · F02" },
    { kind: "PR", icon: "pr", title: "Quatre PR à relire", body: "#11 et #12 (F01), #13 en brouillon (F02), #9 (F11, en avance). La #11 attend les variables MICROSOFT_* dans .env.dev.", meta: "PR · F01 F02 F11" } ],
  agent: "S1 se termine sans fonctionnalité fermée : F01 et F02 continuent en S2, comme prévu. Le staging reste le premier risque pour le 18/12.",
};
S.efeat = (k) => S.E.f.find(x => x.k === k) || S.E.p.find(x => x.k === k);

// ---------- Palettes ----------
S.STYLES = {
  1: { fonts: ["Geist", "IBM Plex Mono"], title: "Newsreader",
    light: { bg: "#F5F0E6", panel: "#EDE6D8", ink: "#1F1B16", ink2: "#574E43", faint: "#8C8173", rule: "#D6CCBA", rule2: "#BBAE99", accent: "#A63A1A", accentSoft: "#F0DCCF", ok: "#3D6B35", todo: "#E0D6C4", review: "#8C8173" },
    dark: { bg: "#15120E", panel: "#1D1915", ink: "#EFE8DC", ink2: "#B3A895", faint: "#7E7466", rule: "#342D25", rule2: "#4F463A", accent: "#E58A63", accentSoft: "#3A2118", ok: "#95BD86", todo: "#2B251E", review: "#8A7F6F" } },
  2: { fonts: ["IBM Plex Sans", "IBM Plex Mono"], title: "IBM Plex Sans",
    dark: { bg: "#0A0B0B", panel: "#101212", ink: "#E8EBE8", ink2: "#A0A8A6", faint: "#6B7472", grid: "#1C2120", grid2: "#2C3331", sig: "#C8F03C", sigText: "#C8F03C", sigInk: "#0A0B0B", alert: "#FF6B5B", alertSoft: "#2A1210", todo: "#262C2B", review: "#7D8986" },
    light: { bg: "#F3F4F2", panel: "#FFFFFF", ink: "#0F1312", ink2: "#4A5452", faint: "#6F7977", grid: "#E2E5E3", grid2: "#C6CCCA", sig: "#B9E22F", sigText: "#3F6212", sigInk: "#0F1312", alert: "#C2281C", alertSoft: "#FBE7E5", todo: "#E3E7E5", review: "#8E9A97" } },
  3: { fonts: ["DM Sans", "IBM Plex Mono"], title: "Bricolage Grotesque",
    light: { bg: "#FBF6EF", card: "#FFFFFF", soft: "#F4ECE1", ink: "#2B2420", ink2: "#6B5F56", line: "#EADFD2", brand: "#D9480F", brandSoft: "#FFE8D9", brandInk: "#FFFFFF", alert: "#C2255C", alertSoft: "#FFE3EC", ok: "#2B8A3E", okSoft: "#E3F5E6",
      feat: [["#FFD8BE", "#7A3410"], ["#CFE4FF", "#1C4A85"], ["#CDEFD6", "#1D5C30"], ["#E5DBFF", "#4B2E83"], ["#FFF0B3", "#6B5200"], ["#FFD6E4", "#8A1F47"], ["#C8EEEA", "#145A55"], ["#EFE3D3", "#5C4630"]] },
    dark: { bg: "#1B1714", card: "#26201C", soft: "#2F2823", ink: "#F6EEE6", ink2: "#C2B5A9", line: "#3A322C", brand: "#FF8A4C", brandSoft: "#3D2416", brandInk: "#1B1714", alert: "#F783AC", alertSoft: "#3B1A27", ok: "#69DB7C", okSoft: "#1C3322",
      feat: [["#5C3320", "#FFD8BE"], ["#1F3A5F", "#CFE4FF"], ["#1E4A2C", "#CDEFD6"], ["#3B2A63", "#E5DBFF"], ["#57461A", "#FFF0B3"], ["#5A2238", "#FFD6E4"], ["#164744", "#C8EEEA"], ["#4A3A28", "#EFE3D3"]] } },
};
S.useStyle = (n, mode) => { const st = S.STYLES[n]; S.K = st[mode]; S.bodyFont = st.fonts[0]; S.monoFont = st.fonts[1]; S.titleFont = st.title; S.mode = mode; };
S.fcol = (k) => { const i = Math.max(0, parseInt(k.slice(1), 10) - 1) % 8; return S.K.feat[i]; };
S.sbox = (name, x, y, w, h) => { const f = penpot.createBoard(); f.name = S.mode === "light" ? name + " (clair)" : name; f.resize(w, h); f.x = x; f.y = y;
  f.fills = [{ fillColor: S.K.bg, fillOpacity: 1 }]; f.clipContent = true; penpot.currentPage.root.appendChild(f); return f; };
S.T = (p, chars, o = {}) => S.txt(p, chars, { ...o, font: o.title ? S.titleFont : o.font, color: o.color || S.K.ink });

// =====================================================================================
// Style 1 · Carnet de centre
// =====================================================================================
S.caseC1 = (c) => ({ L: S.K.ink, R: S.K.review, B: S.K.accent, T: S.K.todo })[c];
S.mastC1 = (root, active) => { const K = S.K;
  const m = S.row(root, { fx: true, gap: 16, align: "end" });
  const l = S.col(m, { gap: 2 }); S.T(l, "KIBO", { size: 11, weight: 600, color: K.ink2, ls: 2.5 });
  const t = S.row(l, { gap: 10, align: "end" }); S.T(t, "Silo", { title: true, size: 40, weight: 600, ls: -0.5 }); S.T(t, "location de box", { title: true, italic: true, size: 22, color: K.ink2 });
  S.spacer(m);
  const r = S.col(m, { gap: 3, align: "end" }); S.T(r, "Vendredi 16 octobre 2026", { title: true, italic: true, size: 17 }); S.T(r, "Sprint S1, dernier jour", { size: 12, color: K.ink2 });
  const nav = S.row(root, { fx: true, gap: 24, pad: [18, 0, 10, 0] });
  for (const n of ["Vue d'ensemble", "Planning", "Tickets", "Graphe", "Notes", "Questions"]) { const on = n === active; const c = S.col(nav, { gap: 4 });
    S.T(c, n.toUpperCase(), { size: 11, weight: on ? 600 : 500, ls: 1.4, color: on ? K.ink : K.ink2 }); S.box(c, { w: 10, h: 1.5, fill: on ? K.ink : null, fx: true }); }
  S.spacer(nav); const ag = S.row(nav, { gap: 6 }); S.icon(ag, "bot", 14, K.accent); S.T(ag, "AGENT DE PROJET", { size: 11, weight: 500, ls: 1.4, color: K.ink2 }); S.avatar(nav, "AB", 26, { fill: K.panel, stroke: K.rule2, color: K.ink });
  S.box(root, { name: "rule", h: 2, w: 10, fx: true, fill: K.ink }); S.box(root, { w: 4, h: 3 }); S.box(root, { name: "rule", h: 1, w: 10, fx: true, fill: K.ink }); };
S.secC1 = (p, num, title) => { const K = S.K; const h = S.row(p, { gap: 10, align: "end", pad: [0, 0, 14, 0] }); S.T(h, num, { title: true, italic: true, size: 22, color: K.accent }); S.T(h, title, { title: true, size: 24, weight: 600 }); };
S.ruleC1 = (p) => S.box(p, { name: "hair", h: 1, w: 10, fx: true, fill: S.K.rule });

S.draw["s1-vue"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 1 · Vue d'ensemble", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960, pad: [30, 56, 24, 56] });
  S.mastC1(root, "Vue d'ensemble");
  const cols = S.row(root, { fx: true, fy: true, align: "stretch", pad: [30, 0, 24, 0] });
  const col = (w) => S.col(cols, { w, fx: !w, gap: 18, pad: [0, 30] });
  // I. Où en est-on
  const c1 = col(410); c1.flex.leftPadding = 0;
  S.secC1(c1, "I.", "Où en est-on");
  const big = S.row(c1, { gap: 14, align: "end" }); S.T(big, "1", { title: true, size: 128, weight: 400, lh: 0.9 });
  const bl = S.col(big, { gap: 2, pad: [0, 0, 18, 0] }); S.T(bl, "sur 22", { title: true, size: 34, color: K.ink2 }); S.T(bl, "fonctionnalités livrées", { size: 13.5, color: K.ink2 });
  const sq = S.row(c1, { gap: 4 });
  E.f.forEach((ft, i) => { if (i === 16) S.box(sq, { w: 1.5, h: 22, fill: K.accent });
    S.box(sq, { w: 12, h: 12, fill: i === 0 ? K.ink : i <= 2 ? K.review : i <= 15 ? K.todo : null, stroke: i > 15 ? K.rule2 : null, dashed: i > 15 }); });
  S.T(c1, "Le trait marque le 18 décembre : six fonctionnalités tombent après.", { size: 12.5, color: K.ink2, italic: false });
  S.ruleC1(c1);
  const sp = S.col(c1, { fx: true, gap: 6 }); const sh = S.row(sp, { gap: 10, align: "end" }); S.T(sh, "Sprint S1", { title: true, size: 22, weight: 600 }); S.T(sh, "12 → 16 octobre", { title: true, italic: true, size: 16, color: K.ink2 });
  S.T(sp, "F01 et F02 sont ouvertes, aucune n'est fermée. Elles continuent en S2, comme prévu.", { size: 14, lh: 1.5, color: K.ink2, fill: true });
  S.ruleC1(c1);
  const mp = S.col(c1, { fx: true, gap: 6 }); const mh = S.row(mp, { gap: 10, align: "end" }); S.T(mh, "Mise en production", { title: true, size: 22, weight: 600 }); S.T(mh, "18 déc. · J−63", { title: true, italic: true, size: 16, color: K.ink2 });
  const v = S.row(mp, { gap: 10, align: "start", fx: true }); S.T(v, "À risque.", { title: true, italic: true, size: 22, color: K.accent });
  S.T(v, "16 fonctionnalités prévues avant, 6 après. Rien n'est encore déployé.", { size: 14, lh: 1.5, color: K.ink2, fill: true });
  S.box(cols, { w: 1, h: 10, fy: true, fill: K.rule });
  // II. Ce qui bloque
  const c2 = col(null); S.secC1(c2, "II.", "Ce qui bloque");
  E.blockers.forEach((b, i) => { if (i) S.ruleC1(c2); const r = S.row(c2, { fx: true, gap: 16, align: "start" });
    S.T(r, String(i + 1), { title: true, size: 34, weight: 400, color: K.accent, lh: 1 });
    const t = S.col(r, { fx: true, gap: 6 }); S.T(t, b.title, { title: true, size: 20, weight: 600, fill: true }); S.T(t, b.body, { size: 14, lh: 1.5, color: K.ink2, fill: true }); S.T(t, b.meta.toUpperCase(), { size: 10.5, weight: 500, ls: 1.2, color: K.ink2 }); });
  S.box(cols, { w: 1, h: 10, fy: true, fill: K.rule });
  // III. La suite
  const c3 = col(410); c3.flex.rightPadding = 0; S.secC1(c3, "III.", "La suite");
  S.T(c3, "PROCHAINE À FINIR · F01", { size: 10.5, weight: 600, ls: 1.4, color: K.ink2 });
  S.T(c3, "Se connecter avec Microsoft", { title: true, size: 30, weight: 600, lh: 1.15, fill: true });
  const st = S.col(c3, { fx: true, gap: 7 });
  E.f01steps.forEach(([key, title, c, note], i) => { const cur = i === 1; const r = S.row(st, { fx: true, gap: 10 });
    S.T(r, cur ? "→" : String(i + 1), { size: 13, weight: 600, color: cur ? K.accent : K.ink2, w: 14 });
    S.box(r, { w: 10, h: 10, fill: S.caseC1(c), stroke: c === "T" ? K.rule2 : null });
    S.T(r, title, { size: 13.5, weight: cur ? 600 : 400, color: c === "L" ? K.ink2 : K.ink }); if (note) S.T(r, note, { title: true, italic: true, size: 13.5, color: cur ? K.accent : K.ink2 }); });
  const nx = S.col(c3, { fx: true, gap: 8, pad: [14, 16], fill: K.panel });
  S.T(nx, "Étape suivante", { title: true, italic: true, size: 16, color: K.accent }); S.T(nx, "Relire et fusionner la PR #11, puis lancer le profil courant (N01).", { size: 14, lh: 1.45, fill: true });
  const cm = S.row(nx, { gap: 8 }); S.T(cm, "/full-delivery N01", { mono: true, size: 12.5 }); S.icon(cm, "copy", 13, K.ink2);
  S.T(c3, "Ensuite : F02 · Créer et consulter ses clients, 0 étape sur 9.", { size: 13, color: K.ink2, fill: true });
  // Agent, discret
  S.box(root, { name: "rule", h: 1, w: 10, fx: true, fill: K.ink });
  const ag = S.row(root, { fx: true, gap: 14, pad: [14, 0, 0, 0] });
  const mk = S.box(ag, { w: 26, h: 26, fill: K.accentSoft, dir: "row", align: "center", justify: "center" }); S.icon(mk, "bot", 15, K.accent);
  S.T(ag, "« " + E.agent + " »", { title: true, italic: true, size: 16, color: K.ink }); S.spacer(ag);
  const lk = S.col(ag, { gap: 2 }); S.T(lk, "Lot n° 8 · 3 actions à valider →", { size: 13, weight: 600, color: K.accent }); S.box(lk, { h: 1, w: 10, fx: true, fill: K.accent });
  return f; };

S.draw["s1-planning"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 1 · Planning", x, y, 1440, 1040);
  const root = S.col(f, { name: "root", w: 1440, h: 1040, pad: [30, 56, 24, 56] });
  S.mastC1(root, "Planning");
  const th = S.row(root, { fx: true, gap: 14, align: "end", pad: [26, 0, 16, 0] }); S.T(th, "Planning", { title: true, size: 34, weight: 600 }); S.T(th, "dix sprints jusqu'à la mise en production", { title: true, italic: true, size: 20, color: K.ink2 }); S.spacer(th);
  for (const [l, c] of [["étape livrée", K.ink], ["en review", K.review], ["bloquée", K.accent], ["à faire", K.todo]]) { const r = S.row(th, { gap: 6 }); S.box(r, { w: 9, h: 9, fill: c, stroke: c === K.todo ? K.rule2 : null }); S.T(r, l, { size: 12, color: K.ink2 }); }
  const W = { s: 90, d: 130, c: 150, p: 200 };
  const hd = S.row(root, { fx: true, gap: 16, pad: [0, 0, 8, 0] });
  for (const [l, w] of [["SPRINT", W.s], ["DATES", W.d], ["FONCTIONNALITÉS OUVERTES ET LEURS ÉTAPES", null], ["FERMÉES À LA FIN", W.c], ["PISTE", W.p]]) { const c = S.row(hd, { w, fx: !w }); S.T(c, l, { size: 10.5, weight: 600, ls: 1.2, color: K.ink2 }); }
  S.box(root, { h: 1, w: 10, fx: true, fill: K.ink });
  const caseRow = (p, ft, sz = 9) => { const r = S.row(p, { gap: 2 }); for (const c of ft.steps) S.box(r, { w: sz, h: sz, fill: S.caseC1(c), stroke: c === "T" ? K.rule2 : null }); return r; };
  E.sprints.forEach((s, i) => { const cur = i === 0;
    const r = S.row(root, { fx: true, gap: 16, pad: [9, 0], align: "start", fill: cur ? K.panel : null });
    const sc = S.col(r, { w: W.s, gap: 0 }); const sr = S.row(sc, { gap: 8 }); if (cur) S.box(sr, { w: 3, h: 26, fill: K.accent }); S.T(sr, s, { title: true, size: 24, weight: 500 }); if (cur) S.T(sc, "en cours", { title: true, italic: true, size: 13, color: K.accent });
    const dc = S.row(r, { w: W.d, pad: [6, 0, 0, 0] }); S.T(dc, E.dates[i], { size: 13, color: K.ink2 });
    const fc = S.col(r, { fx: true, gap: 4, pad: [4, 0, 0, 0] });
    for (const k of E.open[i]) { const ft = S.efeat(k); const cont = ft.from < i; const l = S.row(fc, { fx: true, gap: 10 });
      S.T(l, k, { mono: true, size: 11.5, color: K.ink2 }); S.T(l, ft.name, { size: 14, color: cont ? K.ink2 : K.ink, italic: false }); if (cont) S.T(l, "suite", { title: true, italic: true, size: 13, color: K.ink2 }); S.spacer(l); caseRow(l, ft); }
    const cc = S.row(r, { w: W.c, pad: [6, 0, 0, 0] }); S.T(cc, E.closed[i].length ? E.closed[i].join(", ") : "—", { size: 13, weight: E.closed[i].length ? 600 : 400, color: E.closed[i].length ? K.ink : K.ink2 });
    const pc = S.row(r, { w: W.p, gap: 8, pad: [6, 0, 0, 0] }); const tr = E.tracks[i]; if (tr) { const p = S.efeat(tr); S.T(pc, tr + " · " + p.short, { size: 13, color: K.ink2 }); if (tr === "P1" && i === 0) S.T(pc, "bloquée", { title: true, italic: true, size: 13, color: K.accent }); } else S.T(pc, "—", { size: 13, color: K.ink2 });
    if (i < 9) S.box(root, { h: 1, w: 10, fx: true, fill: K.rule }); });
  S.box(root, { h: 2, w: 10, fx: true, fill: K.accent }); S.box(root, { w: 4, h: 3 }); S.box(root, { h: 1, w: 10, fx: true, fill: K.accent });
  const mep = S.row(root, { fx: true, gap: 12, pad: [8, 0, 12, 0] }); S.icon(mep, "rocket", 16, K.accent); S.T(mep, "Mise en production · vendredi 18 décembre", { title: true, italic: true, size: 18, color: K.accent });
  const ar = S.row(root, { fx: true, gap: 16, align: "start" });
  const al = S.col(ar, { w: W.s + W.d + 16, gap: 2 }); S.T(al, "À arbitrer", { title: true, italic: true, size: 22 }); S.T(al, "après le 18/12", { size: 12.5, color: K.ink2 });
  const chips = S.row(ar, { fx: true, gap: 8, wrap: true, hs: "fix" });
  for (const k of ["F16", "F17", "F18", "F19", "F20", "F21"]) { const ft = S.efeat(k); const c = S.row(chips, { gap: 7, pad: [6, 10], stroke: K.rule2, fill: k === "F19" ? null : K.bg, dashed: k === "F19" });
    S.icon(c, "grip", 12, K.ink2); S.T(c, k, { mono: true, size: 11.5, color: K.ink2 }); S.T(c, ft.name, { size: 13, color: k === "F19" ? K.faint : K.ink }); }
  S.T(root, "Glisser une fonctionnalité vers un sprint pour la planifier ; Kibo signale le dépassement de la limite de deux ouvertes.", { size: 12.5, color: K.ink2 });
  // F19 en cours de glissement vers S10
  const g = S.row(f, { name: "dragging F19", x: 610, y: 834, gap: 7, pad: [7, 11], stroke: K.accent, fill: K.bg, shadow: 6 }); S.icon(g, "grip", 12, K.ink); S.T(g, "F19", { mono: true, size: 11.5, color: K.ink2 }); S.T(g, "Photographier un constat", { size: 13 });
  const w = S.row(f, { name: "warning", x: 612, y: 808, gap: 6 }); S.T(w, "→ S10 : trois ouvertes, au-delà de la limite de deux", { title: true, italic: true, size: 14, color: K.accent });
  return f; };

// =====================================================================================
// Style 2 · Instrument
// =====================================================================================
S.caseC2 = (c) => ({ L: S.K.sig, R: S.K.review, B: S.K.alert, T: S.K.todo })[c];
S.barC2 = (root, active) => { const K = S.K;
  const b = S.row(root, { fx: true, h: 44, pad: [0, 24], gap: 18 });
  S.T(b, "KIBO", { mono: true, size: 12, weight: 600 }); S.T(b, "/", { mono: true, size: 12, color: K.faint }); S.T(b, "SILO", { mono: true, size: 12, weight: 600 });
  S.box(b, { w: 8, h: 4 });
  for (const n of ["VUE", "PLANNING", "TICKETS", "GRAPHE", "NOTES", "QUESTIONS"]) { const on = n === active; const t = S.row(b, { pad: [3, 7], fill: on ? K.ink : null }); S.T(t, n, { mono: true, size: 11, weight: 500, color: on ? K.bg : K.ink2, ls: 0.6 }); }
  S.spacer(b); S.T(b, "16.10.2026 · S1 J5/5", { mono: true, size: 11.5, color: K.ink2 }); const sy = S.row(b, { gap: 6 }); S.dot(sy, K.sig, 6); S.T(sy, "SYNC 14:58", { mono: true, size: 11.5, color: K.ink2 });
  S.box(root, { h: 1, w: 10, fx: true, fill: K.grid2 }); };
S.panelC2 = (p, code, title, right, o = {}) => { const K = S.K;
  const c = S.col(p, { name: "panel " + code, fx: !o.w, w: o.w, fy: o.fy, stroke: K.grid2, fill: K.panel });
  const h = S.row(c, { fx: true, h: 32, pad: [0, 14], gap: 10, fill: K.bg }); S.T(h, code, { mono: true, size: 11, color: K.faint }); S.T(h, title, { mono: true, size: 11, weight: 600, ls: 1 }); S.spacer(h); if (right) S.T(h, right, { mono: true, size: 11, color: o.rc || K.ink2 });
  S.box(c, { h: 1, w: 10, fx: true, fill: K.grid2 });
  return S.col(c, { fx: true, fy: o.fy, pad: 18, gap: 16 }); };
S.kvC2 = (p, k, v, o = {}) => { const K = S.K; const r = S.row(p, { fx: true, gap: 10 }); S.T(r, k, { mono: true, size: 11, color: K.faint, w: 120 }); S.T(r, v, { mono: true, size: 12, color: o.color || K.ink }); return r; };
S.draw["s2-vue"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 2 · Vue d'ensemble", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960 });
  S.barC2(root, "VUE");
  const body = S.col(root, { fx: true, fy: true, pad: 24, gap: 16 });
  const row = S.row(body, { fx: true, gap: 16, align: "stretch", h: 560 });
  // 01 État
  const p1 = S.panelC2(row, "01", "OÙ EN EST-ON", "RISQUE MEP", { w: 440, fy: true, rc: K.alert });
  S.T(p1, "FONCTIONNALITÉS LIVRÉES", { mono: true, size: 10.5, color: K.faint, ls: 0.6 });
  const big = S.row(p1, { gap: 8, align: "end" }); S.T(big, "01", { mono: true, size: 76, weight: 300, lh: 0.9 }); S.T(big, "/22", { mono: true, size: 30, weight: 300, color: K.ink2 });
  const g = S.box(p1, { name: "gauge", w: 404, h: 64 });
  E.f.forEach((ft, i) => { const xx = i * 18 + (i > 15 ? 6 : 0); const c = i === 0 ? K.sig : i <= 2 ? K.review : i <= 15 ? K.todo : null;
    S.box(g, { x: xx, y: 8, w: 14, h: 30, fill: c, stroke: i > 15 ? K.grid2 : null, dashed: i > 15 }); });
  S.box(g, { x: 16 * 18 + 1, y: 0, w: 1.5, h: 46, fill: K.alert }); S.T(g, "MEP 18/12", { mono: true, size: 10, color: K.alert, x: 16 * 18 + 6, y: 44 });
  S.T(g, "F00", { mono: true, size: 10, color: K.faint, x: 0, y: 44 }); S.T(g, "F21", { mono: true, size: 10, color: K.faint, x: 21 * 18 + 6 - 4, y: 44 });
  S.box(p1, { h: 1, w: 10, fx: true, fill: K.grid });
  S.kvC2(p1, "SPRINT", "S1 · 12–16/10 · J5/5"); S.kvC2(p1, "OUVERTES", "2/2 · F01 F02"); S.kvC2(p1, "FERMÉES S1", "0"); S.kvC2(p1, "RYTHME REQUIS", "1,7 fermeture / sprint"); S.kvC2(p1, "MEP", "18/12 · J−63");
  const vd = S.col(p1, { fx: true, gap: 6, pad: [10, 12], stroke: K.alert, fill: K.alertSoft }); S.T(vd, "▲ TENUE DE LA MEP : À RISQUE", { mono: true, size: 11.5, weight: 600, color: K.alert });
  S.T(vd, "16 fonctionnalités prévues avant le 18/12, 6 après. Staging non déployé.", { size: 13, color: K.ink, fill: true, lh: 1.4 });
  // 02 Blocages
  const p2 = S.panelC2(row, "02", "CE QUI BLOQUE", "3", { fy: true });
  E.blockers.forEach((b, i) => { if (i) S.box(p2, { h: 1, w: 10, fx: true, fill: K.grid });
    const r = S.row(p2, { fx: true, gap: 14, align: "start" }); const tag = S.row(r, { w: 40, pad: [2, 0], justify: "center", stroke: i === 0 ? K.alert : K.grid2 }); S.T(tag, b.kind, { mono: true, size: 10.5, weight: 600, color: i === 0 ? K.alert : K.ink2 });
    const t = S.col(r, { fx: true, gap: 5 }); S.T(t, b.title, { size: 15, weight: 600, fill: true }); S.T(t, b.body, { size: 12.5, lh: 1.45, color: K.ink2, fill: true }); S.T(t, b.meta.toUpperCase(), { mono: true, size: 10, color: K.faint }); });
  // 03 Suite
  const p3 = S.panelC2(row, "03", "LA SUITE", "NEXT", { w: 420, fy: true });
  S.T(p3, "PROCHAINE À FINIR", { mono: true, size: 10.5, color: K.faint, ls: 0.6 });
  const nt = S.row(p3, { gap: 10, align: "end" }); S.T(nt, "F01", { mono: true, size: 13, color: K.ink2 }); S.T(nt, "Se connecter avec Microsoft", { size: 20, weight: 600 });
  const tr = S.box(p3, { name: "track", w: 384, h: 74 }); const sw = 60;
  E.f01steps.forEach(([key, title, c], i) => { const xx = i * (sw + 4.8);
    S.T(tr, String(i + 1).padStart(2, "0"), { mono: true, size: 10, color: K.faint, x: xx, y: 0 });
    S.box(tr, { x: xx, y: 16, w: sw, h: 14, fill: S.caseC2(c) });
    S.T(tr, { L: "LIV", R: "REV", B: "BLK", T: "—" }[c], { mono: true, size: 10, color: c === "L" ? K.sigText : K.ink2, x: xx, y: 36 }); });
  S.T(tr, "▲ ICI", { mono: true, size: 10.5, weight: 600, color: K.sigText, x: sw + 5, y: 54 });
  S.box(p3, { h: 1, w: 10, fx: true, fill: K.grid });
  S.kvC2(p3, "ÉTAPE SUIVANTE", "SILO-14 · PR #11"); S.T(p3, "Relire et fusionner la PR #11 (après MICROSOFT_* dans .env.dev), puis lancer N01, le profil courant.", { size: 13, lh: 1.45, color: K.ink2, fill: true });
  const cm = S.row(p3, { fx: true, gap: 10, pad: [10, 12], fill: K.bg, stroke: K.grid2 }); S.T(cm, "$", { mono: true, size: 13, color: K.sigText }); S.T(cm, "/full-delivery N01", { mono: true, size: 13 }); S.spacer(cm); S.T(cm, "COPIER", { mono: true, size: 10.5, color: K.ink2 });
  S.kvC2(p3, "PUIS", "F02 · 0/9 étapes", { color: K.ink2 });
  // Règle des sprints
  const rl = S.panelC2(body, "04", "SPRINTS → MEP", "FERMETURES PRÉVUES PAR SPRINT", {});
  const ru = S.box(rl, { name: "ruler", w: 1356, h: 84 }); const cw = 1356 / 10;
  E.sprints.forEach((s, i) => { const xx = i * cw; S.box(ru, { x: xx, y: 0, w: 1, h: 84, fill: K.grid });
    const n = E.closed[i].length; for (let j = 0; j < n; j++) S.box(ru, { x: xx + 10 + j * 22, y: 30 - 0, w: 18, h: 18, fill: i === 0 ? K.todo : K.grid2 });
    S.T(ru, s, { mono: true, size: 11.5, weight: 600, color: i === 0 ? K.sigText : K.ink, x: xx + 10, y: 4 }); S.T(ru, E.dates[i], { mono: true, size: 10, color: K.faint, x: xx + 10, y: 60 });
    if (n) S.T(ru, E.closed[i].join(" "), { mono: true, size: 10, color: K.ink2, x: xx + 60, y: 33 }); });
  S.box(ru, { x: cw - 2, y: 0, w: 2, h: 84, fill: K.sig }); S.box(ru, { x: 1354, y: 0, w: 2, h: 84, fill: K.alert });
  // Agent
  const ag = S.row(body, { fx: true, gap: 12, pad: [10, 14], stroke: K.grid2 }); S.T(ag, "AGENT ›", { mono: true, size: 11.5, weight: 600, color: K.sigText }); S.T(ag, E.agent, { size: 13.5 }); S.spacer(ag);
  const lb = S.row(ag, { pad: [4, 10], stroke: K.ink }); S.T(lb, "LOT 8 · 3 ACTIONS", { mono: true, size: 11, weight: 600 });
  return f; };

S.draw["s2-planning"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 2 · Planning", x, y, 1440, 1000);
  const root = S.col(f, { name: "root", w: 1440, h: 1000 });
  S.barC2(root, "PLANNING");
  const hd = S.row(root, { fx: true, h: 52, pad: [0, 24], gap: 14 }); S.T(hd, "PLANNING", { mono: true, size: 13, weight: 600 }); S.T(hd, "10 SPRINTS · 22 FONCTIONNALITÉS + 2 PISTES · MEP 18/12", { mono: true, size: 11.5, color: K.ink2 }); S.spacer(hd);
  for (const [l, c] of [["LIVRÉE", K.sig], ["REVIEW", K.review], ["BLOQUÉE", K.alert], ["À FAIRE", K.todo]]) { const r = S.row(hd, { gap: 6 }); S.box(r, { w: 10, h: 10, fill: c }); S.T(r, l, { mono: true, size: 10.5, color: K.ink2 }); }
  const cv = S.box(root, { name: "matrix", w: 1392, h: 880, fx: true }); cv.layoutChild && (cv.layoutChild.horizontalSizing = "fix");
  S.at && null;
  const LW = 290, CW = (1392 - LW) / 11, RH = 27, TOP = 40, X = (i) => LW + i * CW;
  const rows = [...E.f, ...E.p];
  // en-têtes
  [...E.sprints, "S11+"].forEach((s, i) => { S.box(cv, { x: X(i), y: 0, w: 1, h: TOP + rows.length * RH + 120, fill: K.grid });
    S.T(cv, s, { mono: true, size: 11.5, weight: 600, color: i === 0 ? K.sigText : K.ink, x: X(i) + 8, y: 6 }); S.T(cv, i < 10 ? E.dates[i] : "à arbitrer", { mono: true, size: 9.5, color: K.faint, x: X(i) + 8, y: 22 }); });
  S.box(cv, { x: 0, y: TOP - 2, w: 1392, h: 1, fill: K.grid2 });
  rows.forEach((ft, r) => { const yy = TOP + r * RH; if (r % 2) S.box(cv, { x: 0, y: yy, w: 1392, h: RH, fill: K.panel, op: 0.6 });
    if (ft.k === "P1") S.box(cv, { x: 0, y: yy - 1, w: 1392, h: 1, fill: K.grid2 });
    S.T(cv, ft.k, { mono: true, size: 11, color: K.faint, x: 8, y: yy + 7 }); S.T(cv, ft.name.length > 34 ? ft.short : ft.name, { size: 12, color: ft.k === "F00" ? K.ink2 : K.ink, x: 44, y: yy + 6 });
    if (ft.from < 0) { S.T(cv, "LIVRÉE AVANT S1", { mono: true, size: 10, color: K.sigText, x: X(0) - 108, y: yy + 8 }); return; }
    const x1 = X(ft.from) + 4, w = (ft.to - ft.from + 1) * CW - 8, n = ft.steps.length, sw = (w - (n - 1) * 2) / n;
    if (ft.from === 10) { S.box(cv, { x: x1, y: yy + 7, w, h: 13, stroke: K.faint, dashed: true }); return; }
    [...ft.steps].forEach((c, j) => S.box(cv, { x: x1 + j * (sw + 2), y: yy + 7, w: sw, h: 13, fill: S.caseC2(c) })); });
  const bot = TOP + rows.length * RH;
  S.box(cv, { x: X(0) + CW - 1, y: 0, w: 2, h: bot + 110, fill: K.sig }); S.T(cv, "AUJOURD'HUI", { mono: true, size: 9.5, weight: 600, color: K.sigText, x: X(0) + CW + 5, y: bot + 92 });
  S.box(cv, { x: X(10) - 1, y: 0, w: 2, h: bot + 110, fill: K.alert }); S.T(cv, "MEP 18/12", { mono: true, size: 9.5, weight: 600, color: K.alert, x: X(10) + 5, y: bot + 92 });
  // histogramme des ouvertes (limite 2)
  S.box(cv, { x: 0, y: bot + 4, w: 1392, h: 1, fill: K.grid2 });
  S.T(cv, "OUVERTES / LIMITE 2", { mono: true, size: 10.5, color: K.faint, x: 8, y: bot + 20 }); S.T(cv, "FERMÉES", { mono: true, size: 10.5, color: K.faint, x: 8, y: bot + 62 });
  E.sprints.forEach((s, i) => { const n = E.open[i].length + (i === 9 ? 1 : 0); for (let j = 0; j < n; j++) S.box(cv, { x: X(i) + 10 + j * 16, y: bot + 14, w: 12, h: 26, fill: j >= 2 ? K.alert : K.ink2 });
    S.box(cv, { x: X(i) + 8, y: bot + 12, w: 32, h: 1, fill: K.faint });
    S.T(cv, String(E.closed[i].length), { mono: true, size: 12, weight: 600, x: X(i) + 10, y: bot + 60, color: E.closed[i].length ? K.ink : K.faint }); });
  // glisser F19 vers S10
  const fy = TOP + 19 * RH; const gx = X(9) + 4;
  const gh = S.box(cv, { name: "drag F19", x: gx, y: fy + 7, w: CW - 8, h: 13, stroke: K.alert, dashed: true, fill: K.alertSoft });
  S.T(cv, "← F19 · 3/2 OUVERTES", { mono: true, size: 9.5, weight: 600, color: K.alert, x: gx - 4, y: fy - 7 });
  return f; };

// =====================================================================================
// Style 3 · Atelier
// =====================================================================================
S.navC3 = (root, active) => { const K = S.K;
  const n = S.row(root, { fx: true, h: 72, pad: [0, 32], gap: 12 });
  S.logo(n, 30); const ps = S.row(n, { gap: 8, pad: [7, 14], radius: 999, fill: K.card, stroke: K.line }); S.dot(ps, "#14B8A6", 9); S.T(ps, "Silo", { size: 14, weight: 600 }); S.icon(ps, "chevDown", 14, K.ink2);
  S.box(n, { w: 12, h: 4 });
  for (const l of ["Accueil", "Planning", "Tickets", "Graphe", "Notes", "Questions"]) { const on = l === active; const p = S.row(n, { pad: [8, 16], radius: 999, fill: on ? K.ink : null }); S.T(p, l, { size: 14, weight: 500, color: on ? K.bg : K.ink2 }); }
  S.spacer(n); S.icon(n, "search", 19, K.ink2); S.icon(n, "bell", 19, K.ink2); S.avatar(n, "AB", 36, { fill: K.brandSoft, stroke: K.line, color: K.brand }); };
S.bubble = (p, icon, bg, fg, sz = 40) => { const b = S.box(p, { w: sz, h: sz, radius: sz / 2, fill: bg, dir: "row", align: "center", justify: "center" }); S.icon(b, icon, Math.round(sz * 0.45), fg); return b; };
S.dotsC3 = (p, ft, ink, sz = 12) => { const K = S.K; const r = S.row(p, { gap: 5 });
  for (const c of ft.steps) { if (c === "L") S.dot(r, ink, sz); else if (c === "R") S.ring(r, ink, sz, 2.5); else if (c === "B") S.dot(r, K.alert, sz); else S.ring(r, ink, sz, 1); } return r; };
S.draw["s3-vue"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 3 · Vue d'ensemble", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960 });
  S.navC3(root, "Accueil");
  const body = S.col(root, { fx: true, fy: true, pad: [20, 32, 28, 32], gap: 24 });
  const gr = S.row(body, { gap: 12, align: "end" }); S.T(gr, "Bonjour Adam,", { title: true, size: 40, weight: 700, ls: -1 }); S.T(gr, "voici Silo ce vendredi.", { title: true, size: 40, weight: 400, color: K.ink2, ls: -1 });
  const cards = S.row(body, { fx: true, gap: 20, align: "stretch", h: 500 });
  const card = (icon, title, bg, fg) => { const c = S.col(cards, { fx: true, fy: true, pad: 26, gap: 18, radius: 28, fill: K.card, stroke: K.line });
    const h = S.row(c, { gap: 12 }); S.bubble(h, icon, bg, fg, 40); S.T(h, title, { title: true, size: 22, weight: 700 }); return c; };
  // Où en est-on
  const a = card("flag", "Où en est-on ?", K.okSoft, K.ok);
  const big = S.row(a, { gap: 10, align: "end" }); S.T(big, "1", { title: true, size: 84, weight: 700, lh: 0.9 }); const bl = S.col(big, { gap: 0, pad: [0, 0, 10, 0] }); S.T(bl, "sur 22", { title: true, size: 26, weight: 600, color: K.ink2 }); S.T(bl, "fonctionnalités livrées", { size: 14, color: K.ink2 });
  const pills = S.row(a, { w: 360, gap: 6, wrap: true, hs: "fix", vs: "auto" });
  E.f.forEach((ft, i) => { const [bg, ink] = S.fcol(ft.k); S.box(pills, { w: 38, h: 18, radius: 9, fill: i === 0 ? K.ok : i <= 2 ? bg : i <= 15 ? K.soft : null, stroke: i > 15 ? K.line : i <= 2 && i > 0 ? ink : null, dashed: i > 15 }); });
  S.T(a, "En couleur : livrée ou ouverte. En pointillés : après le 18/12.", { size: 13, color: K.ink2, fill: true });
  const info = (icon, bg, fg, t1, t2) => { const r = S.row(a, { fx: true, gap: 12, pad: [12, 14], radius: 18, fill: K.soft }); S.bubble(r, icon, bg, fg, 34); const t = S.col(r, { fx: true, gap: 2 }); S.T(t, t1, { size: 15, weight: 600 }); S.T(t, t2, { size: 13, color: K.ink2, fill: true }); };
  info("calendar", K.card, K.ink, "Sprint S1 · dernier jour", "F01 et F02 continuent en S2, comme prévu.");
  info("rocket", K.alertSoft, K.alert, "Mise en production le 18 déc.", "À surveiller : 6 fonctionnalités passent après.");
  // Ce qui bloque
  const b = card("lock", "Qu'est-ce qui bloque ?", K.alertSoft, K.alert);
  E.blockers.forEach((bk, i) => { const r = S.row(b, { fx: true, gap: 14, pad: 16, radius: 20, fill: K.soft, align: "start" }); S.bubble(r, bk.icon, i === 0 ? K.alertSoft : K.card, i === 0 ? K.alert : K.ink, 36);
    const t = S.col(r, { fx: true, gap: 4 }); S.T(t, bk.title, { size: 16, weight: 700, fill: true }); S.T(t, bk.body, { size: 13, lh: 1.45, color: K.ink2, fill: true }); });
  // La suite
  const c = card("arrowRight", "Et ensuite ?", K.brandSoft, K.brand);
  const [fb, fi] = S.fcol("F01"); const fc = S.col(c, { fx: true, gap: 12, pad: 22, radius: 24, fill: fb });
  S.T(fc, "F01 · PROCHAINE À FINIR", { size: 12, weight: 700, color: fi, ls: 0.8 }); S.T(fc, "Se connecter avec Microsoft", { title: true, size: 26, weight: 700, color: fi, lh: 1.15, fill: true });
  const dr = S.row(fc, { gap: 10 }); S.dotsC3(dr, S.efeat("F01"), fi, 14); S.T(dr, "1 étape sur 6", { size: 13, weight: 600, color: fi });
  S.T(fc, "Étape suivante : relire et fusionner la PR #11, puis lancer le profil courant.", { size: 14, lh: 1.45, color: fi, fill: true });
  const bt = S.row(fc, { gap: 8, pad: [10, 16], radius: 999, fill: K.brand }); S.icon(bt, "copy", 15, K.brandInk); S.T(bt, "Copier /full-delivery N01", { size: 14, weight: 600, color: K.brandInk });
  const [f2b, f2i] = S.fcol("F02"); const n2 = S.row(c, { fx: true, gap: 12, pad: [14, 16], radius: 20, fill: K.soft }); S.box(n2, { w: 14, h: 14, radius: 7, fill: f2b, stroke: f2i });
  const t2 = S.col(n2, { fx: true, gap: 2 }); S.T(t2, "Puis F02 · Créer et consulter ses clients", { size: 14, weight: 600, fill: true }); S.T(t2, "0 étape sur 9 · PR #13 en brouillon", { size: 13, color: K.ink2 });
  // Agent
  const ag = S.row(body, { fx: true, gap: 14, align: "center" }); S.bubble(ag, "bot", K.brand, K.brandInk, 44);
  const sp = S.row(ag, { fx: true, gap: 14, pad: [14, 20], radius: 22, fill: K.card, stroke: K.line }); S.T(sp, E.agent, { size: 15, fill: true });
  const lb = S.row(sp, { pad: [8, 16], radius: 999, stroke: K.brand, fill: K.brandSoft }); S.T(lb, "Voir le lot (3)", { size: 14, weight: 600, color: K.brand });
  return f; };

S.featCardC3 = (p, ft, o = {}) => { const K = S.K; const [bg, ink] = S.fcol(ft.k); const cont = o.cont;
  const c = S.col(p, { name: "card " + ft.k, fx: true, gap: 8, pad: [14, 16], radius: 20, fill: cont ? null : bg, stroke: cont ? ink : null, dashed: cont, vs: "auto" });
  const h = S.row(c, { fx: true, gap: 8 }); S.T(h, ft.k, { size: 12, weight: 700, color: cont ? K.ink2 : ink }); S.spacer(h); if (o.badge) { const bd = S.row(h, { pad: [2, 8], radius: 999, fill: o.badgeBg || K.card }); S.T(bd, o.badge, { size: 11, weight: 600, color: o.badgeInk || K.ink }); }
  S.T(c, ft.name, { title: true, size: 16, weight: 700, color: cont ? K.ink : ink, fill: true, lh: 1.2 });
  const d = S.row(c, { gap: 8 }); S.dotsC3(d, ft, cont ? K.ink2 : ink, 10); S.T(d, cont ? "suite" : `${[...ft.steps].filter(x => x === "L").length}/${ft.steps.length}`, { size: 12, weight: 600, color: cont ? K.ink2 : ink });
  return c; };
S.draw["s3-planning"] = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Style 3 · Planning", x, y, 1440, 1000);
  const root = S.col(f, { name: "root", w: 1440, h: 1000 });
  S.navC3(root, "Planning");
  const body = S.col(root, { fx: true, fy: true, pad: [16, 32, 28, 32], gap: 20 });
  const h = S.row(body, { fx: true, gap: 14, align: "end" }); S.T(h, "Planning", { title: true, size: 36, weight: 700, ls: -0.8 }); S.T(h, "dix sprints, mise en production le 18 décembre", { size: 16, color: K.ink2 }); S.spacer(h);
  const lim = S.row(h, { gap: 8, pad: [8, 14], radius: 999, fill: K.card, stroke: K.line }); S.T(lim, "Au plus 2 ouvertes", { size: 14, weight: 600 });
  // ruban des sprints
  const rb = S.row(body, { fx: true, gap: 6, pad: 6, radius: 999, fill: K.card, stroke: K.line });
  E.sprints.forEach((s, i) => { const on = i === 0; const p = S.row(rb, { fx: true, pad: [8, 0], radius: 999, fill: on ? K.ink : i < 5 ? K.soft : null, justify: "center", gap: 6 }); S.T(p, s, { size: 13, weight: 700, color: on ? K.bg : K.ink }); if (E.closed[i].length) S.T(p, "✓" + E.closed[i].length, { size: 12, color: on ? K.bg : K.ink2 }); });
  const mp = S.row(rb, { pad: [8, 14], radius: 999, fill: K.brand, gap: 6 }); S.icon(mp, "rocket", 14, K.brandInk); S.T(mp, "18 déc.", { size: 13, weight: 700, color: K.brandInk });
  const cols = S.row(body, { fx: true, fy: true, gap: 16, align: "stretch" });
  for (let i = 0; i < 5; i++) { const on = i === 0; const c = S.col(cols, { fx: true, fy: true, gap: 12, pad: 14, radius: 26, fill: on ? K.card : K.soft, stroke: on ? K.ink : null, sw: 1.5 });
    const ch = S.row(c, { fx: true, gap: 8, align: "end", pad: [4, 4, 2, 4] }); S.T(ch, E.sprints[i], { title: true, size: 24, weight: 700 }); S.T(ch, E.dates[i], { size: 13, color: K.ink2 });
    const st = S.row(c, { fx: true, gap: 6, pad: [0, 4] }); const pill = (t, bg, fg) => { const p = S.row(st, { pad: [3, 10], radius: 999, fill: bg }); S.T(p, t, { size: 12, weight: 600, color: fg }); };
    if (on) pill("en cours", K.ink, K.bg); pill(`${E.open[i].length}/2 ouvertes`, on ? K.soft : K.card, K.ink); if (E.closed[i].length) pill(`${E.closed[i].length} à fermer`, K.okSoft, K.ok);
    for (const k of E.open[i]) { const ft = S.efeat(k); S.featCardC3(c, ft, { cont: ft.from < i, badge: ft.to > i ? `jusqu'à ${E.sprints[ft.to]}` : null }); }
    if (E.tracks[i]) { const p = S.efeat(E.tracks[i]); const t = S.row(c, { fx: true, gap: 8, pad: [10, 14], radius: 16, stroke: K.line, fill: K.card }); S.icon(t, i === 0 ? "lock" : "rocket", 14, i === 0 ? K.alert : K.ink2); S.T(t, `${p.k} · ${p.short}`, { size: 13, weight: 600 }); S.spacer(t); if (i === 0) S.T(t, "bloquée", { size: 12, weight: 600, color: K.alert }); }
    if (i === 4) { const dz = S.col(c, { fx: true, h: 96, radius: 20, stroke: K.brand, dashed: true, fill: K.brandSoft, align: "center", justify: "center", gap: 4 }); S.T(dz, "Déposer ici", { size: 14, weight: 700, color: K.brand }); S.T(dz, "S5 est déjà à 2 ouvertes", { size: 12, color: K.ink2 }); } }
  const ar = S.col(cols, { w: 236, fy: true, gap: 10, pad: 14, radius: 26, stroke: K.line, dashed: true });
  const ah = S.row(ar, { gap: 8, pad: [4, 4, 2, 4] }); S.T(ah, "À arbitrer", { title: true, size: 22, weight: 700 }); S.T(ar, "après le 18/12 · glisser vers un sprint", { size: 13, color: K.ink2, fill: true });
  for (const k of ["F16", "F17", "F18", "F20", "F21"]) { const ft = S.efeat(k); const [bg, ink] = S.fcol(k); const r = S.row(ar, { fx: true, gap: 8, pad: [9, 12], radius: 16, fill: K.card, stroke: K.line });
    S.box(r, { w: 12, h: 12, radius: 6, fill: bg, stroke: ink }); S.T(r, k, { size: 12, weight: 700, color: K.ink2 }); S.T(r, ft.short, { size: 13, weight: 600 }); }
  S.T(ar, "S6 → S10 à droite", { size: 12.5, color: K.ink2 });
  // F19 glissée vers S5
  const [gb, gi] = S.fcol("F19"); const g = S.col(f, { name: "dragging F19", x: 1010, y: 640, w: 200, gap: 6, pad: [12, 16], radius: 20, fill: gb, shadow: 10, vs: "auto" });
  S.T(g, "F19", { size: 12, weight: 700, color: gi }); S.T(g, "Photographier un constat", { title: true, size: 16, weight: 700, color: gi, fill: true });
  try { g.rotation = -4; } catch (e) {}
  return f; };
S.STYLE_OF = { "s1-vue": 1, "s1-planning": 1, "s2-vue": 2, "s2-planning": 2, "s3-vue": 3, "s3-planning": 3 };
return "styles ok";
