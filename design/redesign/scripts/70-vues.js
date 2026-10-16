// Variantes de la vue d'ensemble seule (4 à 7) : une phrase, frise, trois colonnes, tableau de bord minimal.
// Chacune répond aux trois questions : où en est-on, qu'est-ce qui bloque, quelle est la suite.
const S = storage;
Object.assign(S.STYLES, {
  4: { fonts: ["Geist", "IBM Plex Mono"], title: "Newsreader", light: S.STYLES[1].light, dark: S.STYLES[1].dark },
  5: { fonts: ["Space Grotesk", "JetBrains Mono"], title: "Space Grotesk",
    dark: { bg: "#08172A", panel: "#0D2038", ink: "#E6F0FA", ink2: "#9DB3CB", faint: "#5F7A97", line: "#1B3555", line2: "#2A4C74", cyan: "#5CD3FF", open: "#5CD3FF", openFill: "#0F3A57", fut: "#12294A", alert: "#FF7A6B", ok: "#7EE0A1" },
    light: { bg: "#EEF4FA", panel: "#FFFFFF", ink: "#0B2340", ink2: "#3D5A7A", faint: "#6E87A3", line: "#CFDDEB", line2: "#A9C0D8", cyan: "#0A6FA8", open: "#0A6FA8", openFill: "#D3ECFA", fut: "#DDE8F3", alert: "#C2311F", ok: "#1E7A43" } },
  6: { fonts: ["Inter", "JetBrains Mono"], title: "Inter",
    light: { bg: "#FFFFFF", panel: "#F5F5F4", ink: "#0A0A0A", ink2: "#525252", faint: "#737373", line: "#E5E5E5", c1: "#0A0A0A", c2: "#D7261E", c3: "#1F4FE0" },
    dark: { bg: "#0A0A0A", panel: "#151515", ink: "#FAFAFA", ink2: "#B3B3B3", faint: "#8A8A8A", line: "#262626", c1: "#FAFAFA", c2: "#FF5A4F", c3: "#6E95FF" } },
  7: { fonts: ["Geist", "Geist Mono"], title: "Manrope",
    dark: { bg: "#0E0E10", card: "#17171A", ink: "#FAFAFA", ink2: "#A1A1AA", faint: "#71717A", line: "#27272A", brand: "#F97316", brandSoft: "#2A1406", alert: "#F87171", ok: "#4ADE80" },
    light: { bg: "#F7F7F8", card: "#FFFFFF", ink: "#09090B", ink2: "#52525B", faint: "#71717A", line: "#E4E4E7", brand: "#C2410C", brandSoft: "#FFF1E8", alert: "#B91C1C", ok: "#15803D" } },
});
Object.assign(S.STYLE_OF, { v4: 4, v5: 5, v6: 6, v7: 7 });

// ---------- 4 · Une phrase ----------
S.draw.v4 = (x, y) => { const K = S.K;
  const f = S.sbox("Vue 4 · Une phrase", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960, pad: [28, 56] });
  const top = S.row(root, { fx: true, gap: 22 }); S.T(top, "KIBO", { size: 11, weight: 600, ls: 2.5, color: K.ink2 }); S.T(top, "Emis", { title: true, size: 18, weight: 600 });
  for (const n of ["Planning", "Tickets", "Graphe", "Notes", "Questions"]) S.T(top, n, { size: 13, color: K.ink2 });
  S.spacer(top); S.T(top, "Vendredi 16 octobre", { title: true, italic: true, size: 15, color: K.ink2 });
  const wrap = S.row(root, { fx: true, fy: true, justify: "center", align: "center" });
  const c = S.col(wrap, { w: 1040, gap: 44 });
  S.T(c, "Emis avance : une fonctionnalité livrée sur vingt-deux. La mise en production du 18 décembre tient si F01 et F02 ferment la semaine prochaine et si la DSI valide le staging.", { title: true, size: 50, weight: 400, lh: 1.22, ls: -0.6, w: 1040 });
  S.T(c, "Rien n'est encore déployé ; quatre PR attendent ta relecture.", { title: true, italic: true, size: 24, color: K.accent });
  S.box(c, { h: 1, w: 10, fx: true, fill: K.rule2 });
  const links = S.row(c, { fx: true, gap: 40, align: "start" });
  const lk = (label, title, detail) => { const l = S.col(links, { fx: true, gap: 8 }); S.T(l, label.toUpperCase(), { size: 11, weight: 600, ls: 1.4, color: K.ink2 });
    const t = S.row(l, { gap: 10 }); S.T(t, title, { title: true, size: 26, weight: 600 }); S.icon(t, "arrowRight", 20, K.accent); S.T(l, detail, { size: 14, color: K.ink2, lh: 1.45, fill: true }); };
  lk("Où en est-on", "1 sur 22", "Sprint S1, dernier jour. F01 et F02 ouvertes, aucune fermée.");
  lk("Ce qui bloque", "3 points", "Staging en attente de la DSI, une question sur la création d'affaire, quatre PR.");
  lk("La suite", "F01 · PR #11", "Fusionner la PR #11, puis lancer le profil courant (N01).");
  const ag = S.row(root, { fx: true, gap: 10 }); S.icon(ag, "bot", 14, K.accent); S.T(ag, "Synthèse rédigée par l'agent de projet à 14:40 · Lot n° 8 à valider (3)", { size: 12.5, color: K.ink2 });
  return f; };

// ---------- 5 · Frise ----------
S.draw.v5 = (x, y) => { const K = S.K, E = S.E;
  const f = S.sbox("Vue 5 · Frise", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960, pad: [26, 40, 24, 40], gap: 18 });
  const top = S.row(root, { fx: true, gap: 18 }); S.logo(top, 26); S.T(top, "Emis", { size: 20, weight: 700 }); S.T(top, "jusqu'à la mise en production", { size: 20, color: K.ink2 }); S.spacer(top);
  for (const n of ["Planning", "Tickets", "Graphe", "Notes", "Questions"]) S.T(top, n, { size: 13.5, color: K.ink2 });
  const hd = S.row(root, { fx: true, gap: 36, align: "end" });
  const kpi = (big, small, color) => { const k = S.col(hd, { gap: 2 }); S.T(k, big, { size: 34, weight: 700, color: color || K.ink }); S.T(k, small, { size: 13, color: K.ink2 }); };
  kpi("1 / 22", "fonctionnalités livrées"); kpi("S1 · J5/5", "sprint en cours"); kpi("J−63", "avant le 18/12 · à risque", K.alert); kpi("3", "blocages piqués sur la frise", K.alert);
  const W = 1360, H = 600, cv = S.box(root, { name: "frise", w: W, h: H, fill: K.panel, radius: 10, stroke: K.line });
  const L = 30, R = 90, cw = (W - L - R) / 10, X = (i) => L + i * cw, LA = 190, LB = 300, LP = 440, BH = 76;
  E.sprints.forEach((s, i) => { S.box(cv, { x: X(i), y: 70, w: 1, h: H - 100, fill: K.line });
    S.T(cv, s, { mono: true, size: 12, weight: 700, color: i === 0 ? K.cyan : K.ink, x: X(i) + 8, y: 76 }); S.T(cv, E.dates[i], { mono: true, size: 10.5, color: K.faint, x: X(i) + 8, y: 94 }); });
  S.T(cv, "Les deux voies montrent la limite : deux fonctionnalités ouvertes à la fois.", { size: 12.5, color: K.ink2, x: L, y: 22 });
  S.T(cv, "VOIE 1", { mono: true, size: 10, color: K.faint, x: L, y: LA - 18 }); S.T(cv, "VOIE 2", { mono: true, size: 10, color: K.faint, x: L, y: LB - 18 }); S.T(cv, "PISTES", { mono: true, size: 10, color: K.faint, x: L, y: LP - 18 });
  const lanes = { A: ["F01", "F03", "F05", "F07", "F08", "F10", "F12", "F14"], B: ["F02", "F04", "F06", "F09", "F11", "F13", "F15"] };
  const block = (ft, ly, o = {}) => { const open = ft.k === "F01" || ft.k === "F02"; const x1 = X(ft.from) + 4, w = (ft.to - ft.from + 1) * cw - 8;
    const b = S.col(cv, { name: "block " + ft.k, x: x1, y: ly, w, h: o.h || BH, pad: [8, 10], gap: 4, radius: 8, fill: open ? K.openFill : K.fut, stroke: open ? K.open : o.alert ? K.alert : K.line2, sw: open ? 1.5 : 1, clip: true });
    const r = S.row(b, { gap: 6 }); S.T(r, ft.k, { mono: true, size: 10.5, weight: 700, color: open ? K.cyan : K.ink2 }); if (open) S.T(r, "ouverte", { size: 10.5, color: K.cyan });
    S.T(b, ft.short, { size: 13, weight: 600, fill: true });
    const sg = S.row(b, { gap: 2 }); const sw = Math.max(4, Math.min(14, (w - 20 - (ft.steps.length - 1) * 2) / ft.steps.length));
    for (const c of ft.steps) S.box(sg, { w: sw, h: 5, radius: 1, fill: c === "L" ? K.ok : c === "R" ? K.cyan : c === "B" ? K.alert : K.line2 }); return b; };
  for (const k of lanes.A) block(S.efeat(k), LA); for (const k of lanes.B) block(S.efeat(k), LB);
  block(S.efeat("P1"), LP, { h: 60, alert: true }); block(S.efeat("P2"), LP, { h: 60 });
  // aujourd'hui et mise en production
  const tx = X(0) + cw * 0.95; S.box(cv, { name: "today", x: tx, y: 110, w: 2, h: H - 140, fill: K.cyan });
  const tl = S.row(cv, { x: tx - 40, y: H - 28, pad: [3, 8], radius: 4, fill: K.cyan }); S.T(tl, "aujourd'hui", { size: 11, weight: 700, color: K.bg });
  S.box(cv, { name: "mep", x: X(10), y: 70, w: 2, h: H - 100, fill: K.alert });
  const mp = S.col(cv, { x: X(10) + 10, y: 76, gap: 2 }); S.icon(mp, "rocket", 18, K.alert); S.T(mp, "MEP", { mono: true, size: 12, weight: 700, color: K.alert }); S.T(mp, "18/12", { mono: true, size: 11, color: K.alert });
  S.T(cv, "après : F16 à F21", { size: 11.5, color: K.faint, x: X(10) + 8, y: LA + 10, w: 76 });
  // blocages piqués
  const pin = (px, py, n, text) => { S.box(cv, { x: px, y: py, w: 1.5, h: 26, fill: K.alert });
    const p = S.box(cv, { x: px - 12, y: py - 24, w: 24, h: 24, radius: 12, fill: K.alert, dir: "row", align: "center", justify: "center" }); S.T(p, String(n), { size: 12, weight: 700, color: K.bg });
    const t = S.col(cv, { x: px + 18, y: py - 26, w: 230, pad: [6, 10], radius: 6, fill: K.bg, stroke: K.alert, vs: "auto" }); S.T(t, text, { size: 12, weight: 500, fill: true, lh: 1.35 }); };
  pin(X(0) + 70, LP - 2, 1, "Staging : le compte AWS attend la DSI");
  pin(X(1) + 40, LB - 2, 2, "F02 · Qui peut créer une affaire ?");
  pin(X(0) + 120, LA - 2, 3, "F01 · PR #11 et #12 à relire");
  // la suite
  const nx = S.row(root, { fx: true, gap: 14, pad: [12, 16], radius: 10, fill: K.panel, stroke: K.line });
  S.T(nx, "LA SUITE", { mono: true, size: 11, weight: 700, color: K.cyan }); S.T(nx, "F01 · Se connecter avec Microsoft : fusionner la PR #11, puis lancer N01.", { size: 14, weight: 500 }); S.spacer(nx);
  const ag = S.row(nx, { gap: 8 }); S.icon(ag, "bot", 14, K.ink2); S.T(ag, "Agent : lot n° 8 à valider (3)", { size: 12.5, color: K.ink2 });
  return f; };

// ---------- 6 · Trois colonnes ----------
S.draw.v6 = (x, y) => { const K = S.K;
  const f = S.sbox("Vue 6 · Trois colonnes", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960, pad: [26, 48, 30, 48], gap: 26 });
  const top = S.row(root, { fx: true, gap: 22 }); S.logo(top, 24); S.T(top, "Emis", { size: 17, weight: 700 }); S.T(top, "Vue d'ensemble", { size: 14, weight: 600 });
  for (const n of ["Planning", "Tickets", "Graphe", "Notes", "Questions"]) S.T(top, n, { size: 14, color: K.ink2 }); S.spacer(top); S.T(top, "ven. 16 oct.", { size: 14, color: K.ink2 }); S.avatar(top, "AB", 30, { fill: K.panel, stroke: K.line, color: K.ink });
  const cols = S.row(root, { fx: true, fy: true, gap: 28, align: "stretch" });
  const col = (color, label, num, unit, caption, items, link) => { const c = S.col(cols, { fx: true, fy: true, gap: 18 });
    S.box(c, { h: 6, w: 10, fx: true, fill: color }); S.T(c, label, { size: 15, weight: 700, color: color });
    const n = S.row(c, { gap: 10, align: "end" }); S.T(n, num, { size: 168, weight: 800, ls: -8, lh: 0.85, color: K.ink }); if (unit) S.T(n, unit, { size: 34, weight: 700, color: K.ink2, ls: -1 });
    S.T(c, caption, { size: 20, weight: 600, lh: 1.3, fill: true, ls: -0.3 });
    S.box(c, { h: 1, w: 10, fx: true, fill: K.line });
    for (const it of items) S.T(c, it, { size: 15, lh: 1.45, color: K.ink2, fill: true });
    S.box(c, { w: 4, h: 4, fy: true }); const l = S.row(c, { gap: 8 }); S.T(l, link, { size: 15, weight: 700, color: color }); S.icon(l, "arrowRight", 16, color); };
  col(K.c1, "Où en est-on", "1", "/22", "fonctionnalité livrée. S1 finit aujourd'hui, sans fermeture.", ["F01 et F02 sont ouvertes et passent en S2.", "Mise en production le 18/12 : à risque, six fonctionnalités tombent après."], "Planning");
  col(K.c2, "Ce qui bloque", "3", null, "points attendent quelqu'un d'autre que le code.", ["Le staging attend la validation DSI (EMIS-6, EMIS-7).", "Qui peut créer une affaire ? (F02)", "Quatre PR à relire : #11, #12, #13, #9."], "Questions et PR");
  col(K.c3, "La suite", "5", null, "étapes avant de fermer F01, Se connecter avec Microsoft.", ["Maintenant : fusionner la PR #11 après MICROSOFT_* dans .env.dev.", "Puis : N01, le profil courant · /full-delivery N01"], "Fiche de F01");
  const ag = S.row(root, { fx: true, gap: 10 }); S.icon(ag, "bot", 15, K.ink2); S.T(ag, "Agent de projet : « Le staging reste le premier risque pour le 18/12. » · Lot n° 8 à valider (3)", { size: 13.5, color: K.ink2 });
  return f; };

// ---------- 7 · Tableau de bord minimal ----------
S.draw.v7 = (x, y) => { const K = S.K;
  const f = S.sbox("Vue 7 · Tableau de bord minimal", x, y, 1440, 960);
  const root = S.col(f, { name: "root", w: 1440, h: 960, pad: [24, 40, 32, 40], gap: 24 });
  const top = S.row(root, { fx: true, gap: 18 }); S.logo(top, 26); S.T(top, "Emis", { size: 16, weight: 600 });
  for (const [n, on] of [["Vue d'ensemble", true], ["Planning"], ["Tickets"], ["Graphe"], ["Notes"], ["Questions"]]) S.T(top, n, { size: 13.5, weight: on ? 600 : 400, color: on ? K.ink : K.ink2 });
  S.spacer(top); S.avatar(top, "AB", 30, { fill: K.card, stroke: K.line, color: K.ink });
  const nums = S.row(root, { fx: true, gap: 16 });
  const num = (big, label, sub, color) => { const c = S.col(nums, { fx: true, gap: 6, pad: [22, 24], radius: 16, fill: K.card, stroke: K.line });
    S.T(c, label, { size: 13, weight: 500, color: K.ink2 }); S.T(c, big, { title: true, size: 56, weight: 700, ls: -2, color: color || K.ink }); S.T(c, sub, { size: 13, color: K.ink2 }); };
  num("1/22", "Fonctionnalités livrées", "F00 seule, F01 et F02 ouvertes");
  num("S1", "Sprint en cours", "dernier jour · 0 fermeture");
  num("J−63", "Mise en production", "18/12 · à risque", K.alert);
  num("3", "Blocages", "staging, question, 4 PR", K.alert);
  const lc = S.col(root, { fx: true, fy: true, radius: 16, fill: K.card, stroke: K.line, clip: true });
  const lh = S.row(lc, { fx: true, h: 60, pad: [0, 24], gap: 10 }); S.T(lh, "À faire maintenant", { title: true, size: 22, weight: 700 }); S.T(lh, "dans cet ordre", { size: 14, color: K.ink2 });
  const items = [
    ["Ajouter les variables MICROSOFT_* à .env.dev, puis fusionner la PR #11", "F01 · débloque la connexion pour toute l'équipe", "Ouvrir la PR", false],
    ["Répondre : qui peut créer une affaire ?", "F02 · la garde de création N04 en dépend", "Répondre", false],
    ["Relancer la DSI sur le dossier d'hébergement", "P1 · sans staging, pas de recette client", "Ouvrir EMIS-6", false],
    ["Relire les PR #12 et #13", "F01 et F02 · empilées sur la #11", "Ouvrir", false],
    ["Valider le lot n° 8 de l'agent de projet", "3 actions : reporter, planifier, relancer", "Examiner", true] ];
  items.forEach(([t, m, a, agent], i) => { S.box(lc, { h: 1, w: 10, fx: true, fill: K.line });
    const r = S.row(lc, { fx: true, gap: 18, pad: [18, 24] });
    const n = S.box(r, { w: 34, h: 34, radius: 17, fill: i === 0 ? K.brand : K.brandSoft, dir: "row", align: "center", justify: "center" }); S.T(n, String(i + 1), { size: 15, weight: 700, color: i === 0 ? "#FFFFFF" : K.brand });
    const tc = S.col(r, { fx: true, gap: 3 }); const tl = S.row(tc, { gap: 8 }); if (agent) S.icon(tl, "bot", 15, K.brand); S.T(tl, t, { size: 16, weight: 600 }); S.T(tc, m, { size: 13.5, color: K.ink2 });
    const b = S.row(r, { pad: [8, 14], radius: 8, fill: i === 0 ? K.brand : null, stroke: i === 0 ? null : K.line }); S.T(b, a, { size: 13.5, weight: 600, color: i === 0 ? "#FFFFFF" : K.ink }); });
  return f; };
return "vues ok";
