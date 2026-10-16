// P1 bis : même contenu que P1 (vue d'ensemble de la proposition), hiérarchie et lisibilité retravaillées.
// Règles : texte secondaire en mfg (AA en sombre et en clair), aucune taille sous 12 px, titres de carte homogènes,
// colonnes alignées dans chaque liste, orange réservé à l'agent (« En ce moment », panneau, lot).
const S = storage;
S.draw = S.draw || {};
S.fChip2 = (p, k) => { const C = S.C; const c = S.row(p, { name: "fchip", pad: [1, 6], gap: 4, radius: 4, stroke: C.border });
  S.icon(c, "package", 12, C.mfg); S.txt(c, k, { size: 12, weight: 500, mono: true, color: C.mfg }); return c; };
S.pill = (p, text, fg, bg, icon) => { const c = S.row(p, { name: "pill", pad: [2, 8], gap: 5, radius: 10, fill: bg }); if (icon) S.icon(c, icon, 12, fg); S.txt(c, text, { size: 12, weight: 500, color: fg }); return c; };
// En-tête de carte homogène : icône, titre 14/600, compteur en pastille, méta à droite.
S.card2 = (p, title, icon, o = {}) => { const C = S.C;
  const c = S.col(p, { name: "card/" + title, fx: !o.w, w: o.w, fy: o.fy, stroke: C.border, radius: 10, fill: C.card, clip: true });
  const h = S.row(c, { fx: true, h: 44, pad: [0, 16], gap: 8 }); S.icon(h, icon, 15, C.mfg); S.txt(h, title, { size: 14, weight: 600 });
  if (o.count) { const k = S.row(h, { pad: [0, 7], radius: 9, fill: C.muted }); S.txt(k, o.count, { size: 12, weight: 500, mono: true, color: C.mfg }); }
  S.spacer(h); if (o.right) o.right(h);
  return c; };
S.row2 = (c, o = {}) => { S.hline(c, S.C.soft); return S.row(c, { fx: true, pad: o.pad || [10, 16], gap: o.gap ?? 12, align: o.align || "center", h: o.h }); };

S.draw["p-vue2"] = (x, y) => { const C = S.C, P = S.P, sec = C.mfg;
  const f = S.screen("P1 bis · Vue d'ensemble", x, y, 1440, 1260);
  const { root, main } = S.shellP(f, "Vue d'ensemble", { agentOn: true, right: t => S.btn(t, "Nouveau ticket", "outline", { sm: true, icon: "plus" }) });
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24, 24, 24], gap: 14 });
  // En-tête du projet
  const hd = S.row(body, { fx: true, gap: 12, align: "end" });
  const ht = S.col(hd, { gap: 4 }); S.txt(ht, "Emis", { size: 24, weight: 600, ls: -0.3 });
  const hs = S.row(ht, { gap: 8 }); S.txt(hs, "Suivi de chantier", { size: 13, color: sec }); S.txt(hs, "·", { size: 13, color: C.faint }); S.icon(hs, "github", 13, sec); S.txt(hs, "galadrimteam/emis-suivi-chantier", { size: 12, mono: true, color: sec });

  // 1. Indicateurs : cinq cellules égales, chiffre dominant, libellé au-dessus, sous-ligne de hauteur fixe.
  const k = S.row(body, { name: "kpis", fx: true, h: 92, stroke: C.border, radius: 10, fill: C.card, align: "stretch" });
  const kpi = (icon, label, value, unit, sub, i) => { if (i) S.vline(k, C.soft);
    const c = S.col(k, { fx: true, pad: [12, 18], gap: 5 });
    const l = S.row(c, { gap: 6 }); S.icon(l, icon, 14, sec); S.txt(l, label, { size: 12.5, weight: 500, color: sec });
    const v = S.row(c, { gap: 6, align: "end" }); S.txt(v, value, { size: 28, weight: 600, ls: -0.5, lh: 1 }); if (unit) S.txt(v, unit, { size: 13, color: sec });
    const s = S.row(c, { h: 16, gap: 6 }); sub(s); };
  kpi("package", "Fonctionnalités", "3", "livrées sur 9", s => S.segs(s, P.features.map(ft => { const st = S.fState(ft); return st === "Livrée" ? C.green : st === "Ouverte" ? C.blue : C.track; }), { w: 14, h: 6, gap: 3, radius: 1.5 }), 0);
  kpi("sprint", "Sprint en cours", "S42", "finit ce soir", s => S.txt(s, "Terrain hors ligne", { size: 12, color: sec }), 1);
  kpi("target", "Ouvertes", "2", "sur 2 max", s => { S.dot(s, C.amber, 7); S.txt(s, "limite atteinte", { size: 12, color: sec }); }, 2);
  kpi("pr", "En review", "3", "PR", s => S.txt(s, "#20 · #22 · #23", { size: 12, color: sec }), 3);
  kpi("question", "Questions", "3", "ouvertes", s => { S.dot(s, C.red, 7); S.txt(s, "Q14 bloque F6", { size: 12, color: sec }); }, 4);

  // 2. En ce moment : une étiquette pour les deux sessions, colonnes alignées.
  const live = S.row(body, { name: "live", fx: true, h: 86, stroke: C.brandLine, radius: 10, fill: C.brandSoft, align: "stretch" });
  const ll = S.col(live, { w: 150, fy: true, pad: [0, 16], gap: 4, justify: "center" }); const lr = S.row(ll, { gap: 8 }); S.halo(lr, C.brand, 7); S.txt(lr, "En ce moment", { size: 13, weight: 600, color: C.brandText }); S.txt(ll, "2 sessions T3 Code", { size: 12, color: sec });
  S.box(live, { w: 1, h: 10, fy: true, fill: C.brandLine });
  const lc = S.col(live, { fx: true, fy: true, pad: [6, 16] });
  [["F5", "EMIS-33", "42 min"], ["F4", "EMIS-45", "18 min"]].forEach(([fk, tk, since], i) => { const t = S.feat(fk).steps.find(s => s.key === tk);
    if (i) S.hline(lc, C.brandLine);
    const r = S.row(lc, { fx: true, h: 36, gap: 12 });
    const a = S.row(r, { w: 44 }); S.fChip2(a, fk);
    const b = S.row(r, { fx: true, gap: 8 }); S.txt(b, tk, { size: 12, mono: true, color: sec }); S.txt(b, t.title, { size: 13, weight: 500 });
    const c = S.row(r, { w: 210, gap: 10 }); S.segs(c, S.stepColors(t.step), { w: 5, h: 12, gap: 2, radius: 1 }); S.txt(c, S.stepLabel(t.step), { size: 12.5, color: C.fg });
    const d = S.row(r, { w: 70, justify: "end" }); S.txt(d, since, { size: 12, color: sec }); });

  // 3. Échéances : grille stricte, légende en pied, « aujourd'hui » étiqueté, glissement et blocage explicites.
  const band = S.card2(body, "Échéances", "calendar", { right: h => S.txt(h, "fonctionnalités par sprint", { size: 12.5, color: sec }) });
  S.hline(band, C.soft);
  const W = 806, LW = 250, RH = 30, HH = 30, rows = ["F4", "F5", "F6", "F8", "F7"], cw = (W - LW) / 4, H = HH + rows.length * RH + 6;
  const g = S.box(band, { name: "grid", w: W, h: H });
  const weeks = [["S42", "12 oct."], ["S43", "19 oct."], ["S44", "26 oct."], ["S45", "2 nov."]];
  weeks.forEach(([s, d], i) => { const xx = LW + i * cw; S.box(g, { x: xx, y: 0, w: 1, h: H, fill: C.soft }); if (i === 0) S.box(g, { x: xx + 1, y: 0, w: cw - 1, h: H, fill: C.muted, op: 0.5 });
    const l = S.row(g, { x: xx + 10, y: 9, gap: 6 }); S.txt(l, s, { size: 12, weight: 600, mono: true, color: i === 0 ? C.fg : sec }); S.txt(l, d, { size: 12, color: sec }); });
  S.box(g, { x: 0, y: HH, w: W, h: 1, fill: C.soft });
  const wk = { S42: 0, S43: 1, S44: 2 }, PAD = 10;
  rows.forEach((kk, i) => { const ft = S.feat(kk), yy = HH + i * RH, x1 = LW + wk[ft.sprint] * cw + PAD, bw = cw - 2 * PAD;
    if (i) S.box(g, { x: 16, y: yy, w: W - 16, h: 1, fill: C.soft, op: 0.6 });
    const l = S.row(g, { x: 16, y: yy + 8, gap: 8 }); S.txt(l, kk, { size: 12, mono: true, color: sec }); S.txt(l, ft.name, { size: 12.5 });
    const n = ft.steps.length, sw = (bw - (n - 1) * 3) / n;
    ft.steps.forEach((t, j) => S.box(g, { x: x1 + j * (sw + 3), y: yy + 10, w: sw, h: 12, radius: 2, fill: S.caseColor(t.st) }));
    if (ft.late) { const dx = LW + cw + PAD; const rem = ft.steps.length - S.fDone(ft); for (let j = 0; j < rem; j++) S.box(g, { x: dx + j * (sw + 3), y: yy + 10, w: sw, h: 12, radius: 2, fill: C.redSoft, stroke: C.red });
      const t = S.row(g, { x: dx + rem * (sw + 3) + 6, y: yy + 8, gap: 4 }); S.icon(t, "clockAlert", 12, C.red); S.txt(t, "glisse en S43", { size: 12, weight: 500, color: C.red }); }
    if (ft.blocked) { const t = S.row(g, { x: x1 + bw + 2 * PAD, y: yy + 7 }); S.pill(t, "bloquée · Q14", C.red, C.redSoft, "lock"); } });
  const tx = LW + 4.5 / 7 * cw; S.box(g, { name: "today", x: tx, y: HH - 6, w: 2, h: H - HH + 6, fill: C.fg });
  const tl = S.row(g, { x: tx + 6, y: H - 24, pad: [1, 6], radius: 4, fill: C.primary }); S.txt(tl, "aujourd'hui", { size: 12, weight: 600, color: C.pfg });
  S.hline(band, C.soft);
  const lg = S.row(band, { fx: true, pad: [10, 16], gap: 16, fill: C.panel });
  for (const [l, col] of [["étape livrée", C.fg], ["en review", C.purple], ["en cours", C.blue], ["bloquée", C.red], ["à faire", C.track]]) { const r = S.row(lg, { gap: 6 }); S.box(r, { w: 12, h: 10, radius: 2, fill: col }); S.txt(r, l, { size: 12, color: sec }); }
  { const r = S.row(lg, { gap: 6 }); S.box(r, { w: 12, h: 10, radius: 2, fill: C.redSoft, stroke: C.red }); S.txt(r, "glissement prévu", { size: 12, color: sec }); }

  // 4. Deux colonnes équilibrées.
  const cols = S.row(body, { fx: true, gap: 16, align: "start" });
  const left = S.col(cols, { fx: true, gap: 14 });
  // Sprint S42 : statut, cases et compteur en colonnes ; note de limite en pied.
  const sp = S.card2(left, "Sprint S42 · Terrain hors ligne", "sprint", { right: h => { S.txt(h, "12–16 oct.", { size: 12.5, color: sec }); S.pill(h, "2/2 ouvertes", C.amber, C.amberSoft); } });
  for (const fk of ["F3", "F4", "F5"]) { const ft = S.feat(fk), done = S.fDone(ft), full = done === ft.steps.length, r = S.row2(sp, { h: 38, gap: 10 });
    const a = S.row(r, { w: 26 }); S.txt(a, fk, { size: 12, mono: true, color: sec });
    const b = S.row(r, { fx: true }); S.txt(b, ft.name, { size: 13, weight: 500, color: full ? sec : C.fg });
    const st = S.row(r, { w: 86 }); if (full) S.pill(st, "livrée", C.green, C.greenSoft, "circleCheck"); else if (ft.late) S.pill(st, "en retard", C.red, C.redSoft, "clockAlert"); else S.pill(st, "ouverte", C.blue, C.blueSoft);
    const cs = S.row(r, { w: 66 }); S.fCases(cs, ft, { w: 10, h: 8, gap: 3 });
    const n = S.row(r, { w: 30, justify: "end" }); S.txt(n, `${done}/${ft.steps.length}`, { size: 12.5, mono: true, color: full ? sec : C.fg }); }
  S.hline(sp, C.soft);
  { const r = S.row(sp, { fx: true, pad: [10, 16], gap: 8, fill: C.panel }); S.icon(r, "target", 13, sec); S.txt(r, "Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5.", { size: 12, color: sec, fill: true }); }
  // Prochaine à finir
  const nx = S.card2(left, "Prochaine à finir", "flag", { right: h => S.txt(h, "la plus avancée du sprint", { size: 12.5, color: sec }) });
  const nb = S.col(nx, { fx: true, pad: [2, 16, 14, 16], gap: 10 });
  const nr = S.row(nb, { fx: true, gap: 10 }); S.txt(nr, "F4", { size: 12, mono: true, color: sec }); S.txt(nr, "Saisir un tronçon hors ligne", { size: 15, weight: 600 }); S.spacer(nr); S.fCases(nr, S.feat("F4"), { w: 22, h: 8, gap: 3 }); S.txt(nr, "3/5", { size: 12.5, mono: true });
  const rest = S.col(nb, { fx: true, gap: 6 });
  { const r = S.row(rest, { gap: 8 }); S.status(r, "En review", 8); S.txt(r, "EMIS-45", { size: 12, mono: true, color: sec }); S.txt(r, "Conflits de saisie", { size: 13 }); S.txt(r, "changements demandés", { size: 12, color: C.amber }); }
  { const r = S.row(rest, { gap: 8 }); S.status(r, "À faire", 8); S.txt(r, "EMIS-46", { size: 12, mono: true, color: sec }); S.txt(r, "Démo client", { size: 13 }); }
  const cr = S.row(nb, { fx: true, gap: 10, pad: [8, 10, 8, 12], radius: 8, fill: C.muted }); S.txt(cr, "Étape suivante", { size: 12, weight: 500, color: sec }); S.txt(cr, "/full-delivery EMIS-45", { size: 12.5, mono: true }); S.spacer(cr); S.btn(cr, "Copier", "outline", { sm: true, icon: "copy" });
  // Colonne droite
  const right = S.col(cols, { w: 300, gap: 14 });
  const rv = S.card2(right, "En review", "pr", { count: "3" });
  for (const t of [S.feat("F5").steps[1], S.feat("F4").steps[3], P.other]) { const r = S.row2(rv, { align: "start" });
    S.icon(r, "pr", 15, S.gitColor(t.git)); const tc = S.col(r, { fx: true, gap: 4 }); const tt = S.row(tc, { gap: 6 }); S.txt(tt, t.ref, { size: 13, weight: 600, mono: true }); S.txt(tt, t.title, { size: 13 });
    const m = S.row(tc, { gap: 6 }); S.txt(m, t.key, { size: 12, mono: true, color: sec }); const fk = S.allTickets().find(z => z.key === t.key)?.f; if (fk) S.fChip2(m, fk);
    const ci = S.row(tc, { gap: 6 });
    if (t.ci === "ok") { S.icon(ci, "circleCheck", 12, C.green); S.txt(ci, "CI verte", { size: 12, color: sec }); }
    if (t.ci === "ko") { S.icon(ci, "circleX", 12, C.red); S.txt(ci, "changements demandés", { size: 12, color: C.amber }); }
    if (t.ci === "run") { S.ring(ci, C.amber, 11, 2); S.txt(ci, "CI en cours", { size: 12, color: sec }); } }
  const qs = S.card2(right, "Questions", "question", { count: "3" });
  for (const q of P.questions) { const r = S.row2(qs, { align: "start" }); const tc = S.col(r, { fx: true, gap: 5 }); S.txt(tc, q.text.replace(" ?", "\u00a0?"), { size: 13, fill: true, lh: 1.35 });
    const m = S.row(tc, { gap: 6 }); S.fChip2(m, q.f); S.txt(m, `${q.id} · ${q.to} · ${q.age}`, { size: 12, color: sec }); if (q.blocking) S.pill(m, "bloquante", C.red, C.redSoft); }
  // Activité : sous Prochaine à finir, une ligne par événement, colonnes alignées.
  const act = S.card2(left, "Activité", "activity", { right: h => { S.chip(h, "git", { size: 12 }); S.chip(h, "full-delivery", { size: 12 }); } });
  for (const a of P.activity.slice(0, 4)) { const r = S.row2(act, { h: 38, gap: 10 });
    const t = S.row(r, { w: 40 }); S.txt(t, a.t, { size: 12, mono: true, color: sec });
    S.icon(r, a.icon, 14, a.src === "agent" ? C.brand : a.color ? C[a.color] : sec);
    const b = S.row(r, { fx: true }); S.txt(b, a.text, { size: 13, color: a.src === "agent" ? C.brandText : C.fg });
    const m = S.row(r, { w: 110, gap: 6, justify: "end" }); if (a.tk) { S.txt(m, a.tk, { size: 12, mono: true, color: sec }); S.fChip2(m, a.f); } else S.txt(m, "Agent de projet", { size: 12, color: C.brandText }); }
  S.vline(root, C.soft);
  S.agentPanelP2(root);
  return f; };

// Panneau de l'agent : résumé, lot, puis champ de saisie isolé en pied.
S.agentPanelP2 = (root) => { const C = S.C, sec = C.mfg;
  const ap = S.col(root, { name: "agent-panel", w: 340, fy: true, fill: C.panel });
  const h = S.row(ap, { fx: true, h: 60, pad: [0, 18], gap: 10 }); S.agentMark(h, 30);
  const ht = S.col(h, { gap: 2 }); S.txt(ht, "Agent de projet", { size: 14, weight: 600 }); S.txt(ht, "Suivi à jour · il y a 4 min", { size: 12, color: sec });
  S.spacer(h); S.icon(h, "more", 16, sec); S.icon(h, "x", 16, sec);
  S.hline(ap, C.soft);
  const sm = S.col(ap, { fx: true, pad: [18, 18], gap: 8 });
  S.txt(sm, "Résumé du jour", { size: 12, weight: 600, color: sec, upper: true, ls: 0.5 });
  S.txt(sm, "F3 est livrée : 3 fonctionnalités sur 9.", { size: 14, weight: 500, lh: 1.45, fill: true });
  S.txt(sm, "S42 finit ce soir et F5 n'y tiendra pas : il lui reste 3 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.", { size: 13, lh: 1.55, color: sec, fill: true });
  S.hline(ap, C.soft);
  const lb = S.col(ap, { fx: true, pad: [18, 18], gap: 10 });
  const lh0 = S.row(lb, { fx: true, gap: 8 }); S.txt(lh0, "À valider", { size: 12, weight: 600, color: sec, upper: true, ls: 0.5 });
  const lot = S.col(lb, { fx: true, stroke: C.brandLine, radius: 10, clip: true, fill: C.card });
  const lh = S.row(lot, { fx: true, pad: [10, 14], gap: 8, fill: C.brandSoft }); S.txt(lh, "Lot n° 7", { size: 13, weight: 600, color: C.brandText }); S.spacer(lh); S.txt(lh, "3 actions", { size: 12, color: sec });
  for (const it of S.P.lot) { S.hline(lot, C.soft); const r = S.row(lot, { fx: true, pad: [11, 14], gap: 10, align: "start" });
    const cb = S.box(r, { w: 16, h: 16, radius: 4, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(cb, "check", 11, "#FFFFFF", 3);
    const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, it.text, { size: 13, weight: 500, fill: true }); S.txt(tc, it.meta, { size: 12, color: sec, fill: true }); }
  S.hline(lot, C.soft);
  const lf = S.row(lot, { fx: true, pad: [12, 14], gap: 8 }); S.btn(lf, "Valider (3)", "brand", { sm: true }); S.btn(lf, "Refuser", "outline", { sm: true });
  const note = S.row(lb, { fx: true, gap: 8, align: "start", pad: [4, 0, 0, 0] }); S.icon(note, "refresh", 13, sec);
  S.txt(note, "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.", { size: 12, color: sec, lh: 1.5, fill: true });
  S.box(ap, { w: 4, h: 4, fy: true });
  S.hline(ap, C.soft);
  const ft = S.col(ap, { fx: true, pad: [14, 18] });
  const inp = S.row(ft, { fx: true, h: 42, pad: [0, 12], gap: 8, radius: 8, stroke: C.border, fill: C.bg }); S.txt(inp, "Demander à l'agent de projet…", { size: 13, color: sec }); S.spacer(inp); S.icon(inp, "send", 15, sec);
  return ap; };
S.exportP1bis = async () => { await S.page("Proposition"); await S.wait(1200); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.name.startsWith("P1 bis · "))) out.push(await S.exportPng(b, `proposition-vue-ensemble-v2-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`));
  return out; };
return "proposition v2 ok";
