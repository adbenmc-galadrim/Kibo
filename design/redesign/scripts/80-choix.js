// Page « Choix » : un tableau par choix ouvert, « Recommandé » et « Autre option » côte à côte, style de la proposition.
const S = storage;
S.draw = S.draw || {};
S.CH = { W: 1200, H: 560, SW: 540, SH: 340, ROW: 640 };
S.CHOIX = [
  { n: 1, slug: "planning", q: "Comment afficher le Planning ?", rec: "Chaque sprint est une colonne, ses fonctionnalités dedans.", alt: "Une bande par fonctionnalité sur une frise de dates (Gantt)." },
  { n: 2, slug: "retard", q: "Quand une fonctionnalité est-elle en retard ?", rec: "S42 finit et F5 a encore 4 étapes : elle est en retard.", alt: "Chaque fonctionnalité a sa propre date d'échéance." },
  { n: 3, slug: "report", q: "Que devient F5 à la fin de S42 ?", rec: "L'agent propose le report ; tu valides ou tu refuses.", alt: "Le report se fait seul à la fin du sprint." },
  { n: 4, slug: "limite-ouvertes", q: "Que se passe-t-il au-delà de 2 ouvertes ?", rec: "Un avertissement, mais tu peux quand même ouvrir F6.", alt: "Bouton bloqué tant que F4 ou F5 n'est pas livrée." },
  { n: 5, slug: "demo-client", q: "La démo client est-elle obligatoire ?", rec: "Démo facultative : F4 est livrée sans elle.", alt: "Démo obligatoire : « livrée » seulement après la démo." },
  { n: 6, slug: "nom-listes", q: "Comment afficher le nom dans les listes ?", rec: "Une ligne, nom complet dans une infobulle.", alt: "Nom complet, quitte à passer sur deux lignes." },
  { n: 7, slug: "sprint", q: "Qu'est-ce qu'un sprint dans Kibo ?", rec: "Une fiche : nom, dates, et sa fin propose les reports.", alt: "Une simple étiquette « S42 » sur les tickets." },
  { n: 8, slug: "graphe", q: "Comment le graphe montre-t-il les sprints ?", rec: "Une colonne par sprint, lecture de gauche à droite.", alt: "Une couleur par sprint, forme libre." },
  { n: 9, slug: "vue-ensemble", q: "Quelles échéances sur la vue d'ensemble ?", rec: "Sprint en cours et suivant seulement.", alt: "Toutes les échéances, plus un Planning tous projets." } ];

S.choiceBoard = (ch, x, y, rec, alt) => { const C = S.C, { W, H, SW, SH } = S.CH;
  const f = S.screen(`Choix ${ch.n} · ${ch.q.replace(/ \?$/, "")}`, x, y, W, H);
  const root = S.col(f, { name: "content", w: W, h: H, pad: [36, 44], gap: 24 });
  const hd = S.row(root, { gap: 14 });
  const n = S.row(hd, { w: 34, h: 34, radius: 17, fill: C.muted, justify: "center" }); S.txt(n, String(ch.n), { size: 15, weight: 600, mono: true });
  S.txt(hd, ch.q, { size: 24, weight: 600, ls: -0.3 });
  const cols = S.row(root, { fx: true, gap: 32, align: "start" });
  [["Recommandé", ch.rec, rec, true], ["Autre option", ch.alt, alt, false]].forEach(([label, cap, draw, isRec]) => {
    const c = S.col(cols, { w: SW, gap: 12 });
    const b = S.row(c, { pad: [3, 10], gap: 6, radius: 12, fill: isRec ? C.greenSoft : C.muted, stroke: isRec ? C.green : C.border });
    S.icon(b, isRec ? "circleCheck" : "refresh", 13, isRec ? C.green : C.mfg); S.txt(b, label, { size: 13, weight: 600, color: isRec ? C.green : C.mfg });
    const st = S.box(c, { name: "stage", w: SW, h: SH, fill: C.card, stroke: isRec ? C.border : C.border, radius: 12, clip: true });
    draw(st);
    S.txt(c, cap, { size: 14, color: C.fg, w: SW }); });
  return f; };
S.inner = (st, o = {}) => S.col(st, { x: o.x ?? 20, y: o.y ?? 20, w: S.CH.SW - 2 * (o.x ?? 20), gap: o.gap ?? 10, ...o });
S.secTxt = (p, t, o = {}) => S.txt(p, t, { size: 12, color: S.C.mfg, ...o });

// 1 · Planning
S.draw["choix-1"] = (x, y) => { const C = S.C, P = S.P;
  return S.choiceBoard(S.CHOIX[0], x, y, st => {
    const r = S.row(st, { x: 16, y: 16, w: S.CH.SW - 32, gap: 8, align: "start" });
    for (const sp of P.sprints) { const cur = sp.key === "S42"; const c = S.col(r, { w: (S.CH.SW - 32 - 24) / 4, h: 306, pad: 8, gap: 6, radius: 8, fill: cur ? C.muted : C.panel, stroke: cur ? C.fg : C.border });
      const h = S.row(c, { gap: 4 }); S.txt(h, sp.key, { size: 13, weight: 600, mono: true }); if (cur) S.pill(h, "en cours", C.blue, C.blueSoft);
      S.secTxt(c, sp.dates);
      for (const ft of P.features.filter(z => z.sprint === sp.key)) { const k = S.col(c, { fx: true, pad: [6, 8], gap: 5, radius: 6, fill: C.card, stroke: C.border });
        const l = S.row(k, { gap: 5 }); S.txt(l, ft.k, { size: 12, mono: true, weight: 600 }); if (ft.late) S.icon(l, "clockAlert", 12, C.red); if (ft.blocked) S.icon(l, "lock", 12, C.red);
        S.fCases(k, ft, { w: 12, h: 6, gap: 2 }); } }
  }, st => {
    const LW = 150, X0 = 20 + LW, AW = S.CH.SW - X0 - 20, days = 26, px = AW / days;
    const weeks = [["5 oct.", 0], ["12 oct.", 7], ["19 oct.", 14], ["26 oct.", 21]];
    for (const [l, d] of weeks) { S.box(st, { x: X0 + d * px, y: 20, w: 1, h: 300, fill: C.soft }); S.secTxt(S.row(st, { x: X0 + d * px + 4, y: 20 }), l); }
    S.box(st, { x: X0 + 11 * px, y: 40, w: 2, h: 280, fill: C.fg });
    const start = { S41: 0, S42: 7, S43: 14, S44: 21 };
    P.features.filter(f => f.sprint).forEach((ft, i) => { const yy = 52 + i * 36;
      const l = S.row(st, { x: 20, y: yy, w: LW - 8, gap: 6 }); S.txt(l, ft.k, { size: 12, mono: true, color: C.mfg }); S.txt(l, ft.name.split(" ").slice(0, 2).join(" ") + "…", { size: 12.5 });
      const bx = X0 + start[ft.sprint] * px, bw = 5 * px, done = S.fDone(ft) / ft.steps.length;
      S.box(st, { x: bx, y: yy + 2, w: bw, h: 14, radius: 4, fill: C.track });
      if (done) S.box(st, { x: bx, y: yy + 2, w: bw * done, h: 14, radius: 4, fill: done === 1 ? C.green : C.blue }); });
  }); };

// 2 · Retard
S.draw["choix-2"] = (x, y) => { const C = S.C;
  return S.choiceBoard(S.CHOIX[1], x, y, st => {
    const c = S.inner(st, { gap: 0 });
    const h = S.row(c, { fx: true, gap: 8, pad: [0, 0, 12, 0] }); S.icon(h, "sprint", 15, C.mfg); S.txt(h, "Sprint S42 · Terrain hors ligne", { size: 14, weight: 600 }); S.spacer(h); S.pill(h, "finit ce soir", C.amber, C.amberSoft, "clockAlert");
    for (const k of ["F3", "F4", "F5"]) { const ft = S.feat(k), d = S.fDone(ft), hot = k === "F5"; S.hline(c, C.soft);
      const r = S.row(c, { fx: true, h: hot ? 70 : 48, gap: 10, pad: [0, 10], fill: hot ? C.redSoft : null, radius: hot ? 8 : 0 });
      const t = S.col(r, { fx: true, gap: 4 }); const l = S.row(t, { gap: 8 }); S.txt(l, k, { size: 12, mono: true, color: C.mfg }); S.txt(l, ft.name, { size: 13.5, weight: hot ? 600 : 500 });
      if (hot) S.txt(t, `${ft.steps.length - d} étapes restantes, le sprint finit ce soir`, { size: 12, color: C.red });
      S.fCases(r, ft, { w: 12, h: 8, gap: 3 });
      const s = S.row(r, { w: 92, justify: "end" }); if (d === ft.steps.length) S.pill(s, "livrée", C.green, C.greenSoft, "circleCheck"); else if (hot) S.pill(s, "en retard", C.red, C.redSoft, "clockAlert"); else S.pill(s, "ouverte", C.blue, C.blueSoft); }
  }, st => {
    const c = S.inner(st, { gap: 0 });
    const h = S.row(c, { fx: true, gap: 8, pad: [0, 0, 12, 0] }); S.icon(h, "package", 15, C.mfg); S.txt(h, "Fonctionnalités", { size: 14, weight: 600 }); S.spacer(h); S.secTxt(h, "aujourd'hui : 16 oct.");
    for (const [k, due, rel, late] of [["F4", "17 oct.", "demain", false], ["F5", "20 oct.", "dans 4 j", false], ["F6", "15 oct.", "dépassée", true], ["F8", "24 oct.", "dans 8 j", false]]) { const ft = S.feat(k); S.hline(c, C.soft);
      const r = S.row(c, { fx: true, h: 48, gap: 10, pad: [0, 10] }); S.txt(r, k, { size: 12, mono: true, color: C.mfg }); S.txt(S.row(r, { fx: true }), ft.name, { size: 13.5, weight: 500 });
      const d = S.row(r, { w: 150, gap: 6, justify: "end" }); S.icon(d, "calendar", 13, late ? C.red : C.mfg); S.txt(d, due, { size: 13, weight: 500, color: late ? C.red : C.fg }); S.txt(d, rel, { size: 12, color: late ? C.red : C.mfg }); }
  }); };

// 3 · Report
S.draw["choix-3"] = (x, y) => { const C = S.C;
  return S.choiceBoard(S.CHOIX[2], x, y, st => {
    const c = S.inner(st, { y: 40, x: 40, gap: 14 });
    const card = S.col(c, { fx: true, radius: 10, stroke: C.brandLine, fill: C.brandSoft, pad: 18, gap: 12 });
    const h = S.row(card, { gap: 10 }); S.agentMark(h, 28); S.txt(h, "Agent de projet", { size: 13, weight: 600, color: C.brandText }); S.secTxt(h, "à l'instant");
    S.txt(card, "Reporter F5 en S43 ?", { size: 20, weight: 600 });
    S.txt(card, "4 étapes restantes, S42 finit ce soir.", { size: 13, color: C.mfg });
    const b = S.row(card, { gap: 8 }); S.btn(b, "Valider", "brand"); S.btn(b, "Refuser", "outline");
    const n = S.row(c, { gap: 8 }); S.icon(n, "lock", 13, C.mfg); S.secTxt(n, "Rien ne bouge sans ta validation.");
  }, st => {
    const c = S.inner(st, { y: 40, x: 40, gap: 0 });
    const ev = (icon, col, t, sub) => { const r = S.row(c, { fx: true, gap: 12, pad: [12, 0], align: "start" }); const i = S.row(r, { w: 28, h: 28, radius: 14, fill: C.muted, justify: "center" }); S.icon(i, icon, 14, col);
      const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, t, { size: 14, weight: 500 }); S.secTxt(tc, sub); };
    ev("flag", C.mfg, "S42 terminé", "16 oct. à minuit");
    ev("refresh", C.blue, "F5 déplacée en S43", "automatiquement, sans validation");
    const m = S.row(c, { gap: 8, pad: [10, 0, 0, 40] }); S.txt(m, "F5", { size: 12, mono: true, color: C.mfg });
    const a = S.row(m, { pad: [2, 8], radius: 4, stroke: C.border }); S.txt(a, "S42", { size: 12, mono: true, color: C.mfg }); S.icon(m, "arrowRight", 13, C.mfg);
    const b2 = S.row(m, { pad: [2, 8], radius: 4, stroke: C.fg }); S.txt(b2, "S43", { size: 12, mono: true, weight: 600 });
  }); };

// 4 · Limite d'ouvertes
S.draw["choix-4"] = (x, y) => { const C = S.C;
  const f6 = (c, enabled) => { const card = S.col(c, { fx: true, radius: 10, stroke: C.border, fill: C.panel, pad: 16, gap: 10 });
    const h = S.row(card, { fx: true, gap: 8 }); S.txt(h, "F6", { size: 12, mono: true, color: C.mfg }); S.txt(h, "Importer les ISO depuis Excel", { size: 14, weight: 600 });
    S.fCases(card, S.feat("F6"), { w: 18, h: 8, gap: 3 });
    const r = S.row(card, { gap: 8 });
    if (enabled) S.btn(r, "Ouvrir F6", "default", { icon: "arrowRight" });
    else { const b = S.row(r, { pad: [7, 14], gap: 6, radius: 6, fill: C.muted }); S.icon(b, "lock", 13, C.faint); S.txt(b, "Limite atteinte", { size: 13, weight: 500, color: C.faint }); S.secTxt(r, "2/2 ouvertes"); } };
  const opened = (c, ks) => { const l = S.row(c, { gap: 8 }); S.secTxt(l, "Ouvertes :"); for (const k of ks) S.fChip2(l, k); };
  return S.choiceBoard(S.CHOIX[3], x, y, st => {
    const c = S.inner(st, { y: 28, x: 28, gap: 14 });
    const w = S.row(c, { fx: true, pad: [10, 14], gap: 10, radius: 8, fill: C.amberSoft, stroke: C.amber }); S.icon(w, "target", 15, C.amber); S.txt(w, "3/2 ouvertes", { size: 14, weight: 600, color: C.amber }); S.txt(w, "au-dessus de la limite", { size: 13, color: C.fg });
    opened(c, ["F4", "F5", "F6"]); f6(c, true);
  }, st => {
    const c = S.inner(st, { y: 28, x: 28, gap: 14 });
    opened(c, ["F4", "F5"]); f6(c, false);
  }); };

// 5 · Démo client
S.draw["choix-5"] = (x, y) => { const C = S.C;
  const frise = (c, optional) => { const names = ["Schéma local", "Formulaire", "Synchro", "Conflits", "Démo client"];
    const r = S.row(c, { fx: true, align: "start" });
    names.forEach((nm, i) => { const demo = i === 4;
      if (i) { const k = S.col(r, { fx: true, pad: [11, 0, 0, 0] }); S.box(k, { fx: true, h: 2, w: 10, fill: demo && optional ? C.border : demo ? C.track : C.fg }); }
      const col = S.col(r, { w: 64, gap: 6, align: "center" });
      const n = S.box(col, { w: 24, h: 24, radius: 12, dir: "row", align: "center", justify: "center", fill: demo ? null : C.fg, stroke: demo ? (optional ? C.mfg : C.fg) : null, dashed: demo && optional, sw: 1.5 });
      if (!demo) S.icon(n, "check", 13, C.pfg, 3);
      S.txt(col, nm, { size: 12, color: demo ? C.mfg : C.fg, align: "center" });
      if (demo) S.txt(col, optional ? "facultative" : "obligatoire", { size: 12, weight: 600, color: optional ? C.mfg : C.fg }); }); };
  const head = (c, pill) => { const h = S.row(c, { fx: true, gap: 8 }); S.txt(h, "F4", { size: 12, mono: true, color: C.mfg }); S.txt(h, "Saisir un tronçon hors ligne", { size: 15, weight: 600 }); S.spacer(h); pill(h); };
  return S.choiceBoard(S.CHOIX[4], x, y, st => {
    const c = S.inner(st, { y: 60, x: 28, gap: 36 });
    head(c, h => S.pill(h, "livrée", C.green, C.greenSoft, "circleCheck")); frise(c, true);
  }, st => {
    const c = S.inner(st, { y: 60, x: 28, gap: 36 });
    head(c, h => S.pill(h, "attend la démo", C.blue, C.blueSoft)); frise(c, false);
  }); };

// 6 · Nom dans les listes
S.draw["choix-6"] = (x, y) => { const C = S.C;
  const rows = [["F4", "Saisir un tronçon hors ligne", "Saisir un tronçon…"], ["F5", "Envoyer les photos d'un tronçon", "Envoyer les photos…"], ["F6", "Importer les ISO depuis Excel", "Importer les ISO…"], ["F8", "Valider les soudures par lot", "Valider les soudures…"]];
  const list = (st, short) => { const c = S.inner(st, { gap: 0 });
    const h = S.row(c, { fx: true, h: 30, gap: 10, pad: [0, 10] }); S.secTxt(S.row(h, { w: 26 }), "Clé"); S.secTxt(S.row(h, { w: 170 }), "Fonctionnalité"); S.secTxt(S.row(h, { fx: true }), "Étapes"); S.secTxt(h, "Sprint");
    for (const [k, full, trunc] of rows) { const ft = S.feat(k), hov = short && k === "F5"; S.hline(c, C.soft);
      const r = S.row(c, { fx: true, h: short ? 44 : null, pad: short ? [0, 10] : [10, 10], gap: 10, fill: hov ? C.muted : null, radius: hov ? 6 : 0 });
      S.txt(S.row(r, { w: 26 }), k, { size: 12, mono: true, color: C.mfg });
      const nm = S.row(r, { w: 170 }); if (short) S.txt(nm, trunc, { size: 13.5, weight: 500 }); else S.txt(nm, full, { size: 13.5, weight: 500, w: 160, lh: 1.35 });
      S.fCases(S.row(r, { fx: true }), ft, { w: 12, h: 8, gap: 3 }); S.txt(r, ft.sprint, { size: 12, mono: true, color: C.mfg }); }
    return c; };
  return S.choiceBoard(S.CHOIX[5], x, y, st => { list(st, true);
    const tip = S.row(st, { x: 76, y: 140, pad: [6, 10], radius: 6, fill: C.primary, shadow: 4 }); S.txt(tip, "Envoyer les photos d'un tronçon", { size: 12.5, weight: 500, color: C.pfg });
  }, st => { list(st, false); }); };

// 7 · Sprint
S.draw["choix-7"] = (x, y) => { const C = S.C;
  return S.choiceBoard(S.CHOIX[6], x, y, st => {
    const c = S.inner(st, { gap: 10 });
    const h = S.row(c, { fx: true, gap: 8 }); S.icon(h, "sprint", 16, C.mfg); S.txt(h, "S42 · Terrain hors ligne", { size: 16, weight: 600 }); S.spacer(h); S.pill(h, "en cours", C.blue, C.blueSoft);
    const d = S.row(c, { gap: 8 }); S.icon(d, "calendar", 13, C.mfg); S.txt(d, "12–16 oct.", { size: 13 }); S.secTxt(d, "· finit ce soir · 1 livrée sur 3");
    const l = S.col(c, { fx: true, radius: 8, stroke: C.border, clip: true });
    ["F3", "F4", "F5"].forEach((k, i) => { const ft = S.feat(k); if (i) S.hline(l, C.soft); const r = S.row(l, { fx: true, h: 36, pad: [0, 12], gap: 10 }); S.txt(r, k, { size: 12, mono: true, color: C.mfg }); S.txt(S.row(r, { fx: true }), ft.name, { size: 13 }); S.fCases(r, ft, { w: 10, h: 7, gap: 2 }); });
    const a = S.row(c, { fx: true, pad: [10, 12], gap: 10, radius: 8, fill: C.brandSoft, stroke: C.brandLine }); S.agentMark(a, 22); S.txt(S.row(a, { fx: true }), "Fin de sprint : reporter F5 en S43 ?", { size: 13, weight: 500 }); S.btn(a, "Valider", "brand", { sm: true }); S.btn(a, "Refuser", "outline", { sm: true });
  }, st => {
    const c = S.inner(st, { gap: 0, y: 28 });
    for (const [tk, t, sp] of [["EMIS-33", "Écran d'envoi hors ligne", "S42"], ["EMIS-45", "Conflits de saisie", "S42"], ["EMIS-34", "Tests E2E de l'envoi", "S42"], ["EMIS-51", "Lecture du fichier Excel", "S43"], ["EMIS-71", "Statuts de soudure", "S43"]]) { S.hline(c, C.soft);
      const r = S.row(c, { fx: true, h: 46, gap: 10, pad: [0, 10] }); S.txt(r, tk, { size: 12, mono: true, color: C.mfg }); S.txt(S.row(r, { fx: true }), t, { size: 13.5 });
      const g = S.row(r, { pad: [2, 8], radius: 10, fill: C.muted, gap: 5 }); S.icon(g, "sprint", 12, C.mfg); S.txt(g, sp, { size: 12, mono: true, weight: 500 }); }
  }); };

// 8 · Graphe
S.edgeEl = (st, a, b, col) => { const t = 1.5, mx = Math.round((a[0] + b[0]) / 2);
  S.box(st, { x: a[0], y: a[1], w: Math.max(1, mx - a[0]), h: t, fill: col });
  S.box(st, { x: mx, y: Math.min(a[1], b[1]), w: t, h: Math.abs(b[1] - a[1]) + t, fill: col });
  S.box(st, { x: mx, y: b[1], w: Math.max(1, b[0] - mx), h: t, fill: col }); };
S.graphChoice = (st, pos, colorOf) => { const C = S.C, NW = 92, NH = 30, deps = [["F2", "F3"], ["F2", "F4"], ["F2", "F6"], ["F3", "F5"], ["F4", "F8"], ["F4", "F7"], ["F5", "F7"], ["F1", "F2"]];
  for (const [a, b] of deps) { const A = pos[a], B = pos[b]; if (Math.abs(A[0] - B[0]) < NW) { const [u, v] = A[1] < B[1] ? [A, B] : [B, A]; S.box(st, { x: u[0] + NW / 2, y: u[1] + NH, w: 1.5, h: Math.max(1, v[1] - u[1] - NH), fill: C.faint }); } else if (A[0] < B[0]) S.edgeEl(st, [A[0] + NW, A[1] + NH / 2], [B[0], B[1] + NH / 2], C.faint); else S.edgeEl(st, [B[0] + NW, B[1] + NH / 2], [A[0], A[1] + NH / 2], C.faint); }
  for (const [k, [x, y]] of Object.entries(pos)) { const ft = S.feat(k), col = colorOf(ft);
    const n = S.row(st, { x, y, w: NW, h: NH, pad: [0, 8], gap: 6, radius: 6, fill: col ? col[1] : C.card, stroke: col ? col[0] : C.border });
    S.txt(n, k, { size: 12, mono: true, weight: 600, color: col ? col[0] : C.fg }); S.fCases(n, ft, { w: 6, h: 6, gap: 2 }); } };
S.draw["choix-8"] = (x, y) => { const C = S.C;
  return S.choiceBoard(S.CHOIX[7], x, y, st => {
    const cw = 125, x0 = 20;
    S.P.sprints.forEach((sp, i) => { const xx = x0 + i * cw; if (sp.key === "S42") S.box(st, { x: xx - 6, y: 12, w: cw - 8, h: 316, radius: 8, fill: C.muted });
      const l = S.row(st, { x: xx, y: 22, gap: 6 }); S.txt(l, sp.key, { size: 13, weight: 600, mono: true }); S.secTxt(l, sp.dates.split("–")[0] + " oct."); });
    S.graphChoice(st, { F1: [x0, 80], F2: [x0, 180], F3: [x0 + cw, 80], F4: [x0 + cw, 180], F5: [x0 + cw, 270], F6: [x0 + 2 * cw, 80], F8: [x0 + 2 * cw, 180], F7: [x0 + 3 * cw, 225] }, () => null);
  }, st => {
    const SC = { S41: [C.green, C.greenSoft], S42: [C.blue, C.blueSoft], S43: [C.purple, C.purpleSoft], S44: [C.fg, C.muted] };
    S.graphChoice(st, { F1: [24, 60], F2: [150, 120], F3: [290, 40], F4: [290, 140], F6: [150, 230], F5: [420, 60], F8: [420, 200], F7: [420, 130] }, ft => SC[ft.sprint]);
    const lg = S.row(st, { x: 24, y: 300, gap: 14 }); for (const [k, [c, s]] of Object.entries(SC)) { const r = S.row(lg, { gap: 5 }); S.box(r, { w: 12, h: 12, radius: 3, fill: s, stroke: c }); S.txt(r, k, { size: 12, mono: true, color: C.mfg }); }
  }); };

// 9 · Vue d'ensemble
S.miniBand = (p, sprints, keys, o = {}) => { const C = S.C, P = S.P;
  const g = S.col(p, { fx: true, radius: 8, stroke: C.border, clip: true, fill: C.card });
  const h = S.row(g, { fx: true, h: 32, pad: [0, 10], gap: 0 }); const hl = S.row(h, { w: o.lw || 120 }); if (!o.compact) S.secTxt(hl, "Échéances");
  for (const sp of sprints) { const c = S.row(h, { fx: true, gap: 4 }); S.txt(c, sp, { size: 12, mono: true, weight: 600, color: sp === "S42" ? C.fg : C.mfg }); if (sp === "S42" && !o.compact) S.secTxt(c, "en cours"); if (sp === "S43" && o.next) S.secTxt(c, "suivant"); }
  for (const k of keys) { const ft = S.feat(k); S.hline(g, C.soft); const r = S.row(g, { fx: true, h: o.rh || 34, pad: [0, 10] });
    const l = S.row(r, { w: o.lw || 120, gap: 6 }); S.txt(l, k, { size: 12, mono: true, color: C.mfg }); if (o.names) S.txt(l, ft.name.split(" ").slice(0, 2).join(" ") + "…", { size: 12.5 });
    for (const sp of sprints) { const c = S.row(r, { fx: true }); if (ft.sprint === sp) S.fCases(c, ft, { w: o.cw || 12, h: 8, gap: 2 }); if (!ft.sprint && sp === sprints[sprints.length - 1]) S.secTxt(c, "à planifier"); } }
  return g; };
S.draw["choix-9"] = (x, y) => { const C = S.C;
  return S.choiceBoard(S.CHOIX[8], x, y, st => {
    const c = S.inner(st, { y: 40, x: 28 }); S.miniBand(c, ["S42", "S43"], ["F3", "F4", "F5", "F6", "F8"], { next: true, names: true, lw: 210, cw: 16, rh: 40 });
  }, st => {
    const sb = S.col(st, { x: 0, y: 0, w: 180, h: S.CH.SH, fill: C.panel, pad: [14, 8], gap: 2 });
    const it = (icon, t, on) => { const r = S.row(sb, { fx: true, pad: [6, 8], gap: 7, radius: 6, fill: on ? C.muted : null, stroke: on ? C.fg : null }); S.icon(r, icon, 13, on ? C.fg : C.mfg); S.txt(r, t, { size: 12.5, weight: on ? 600 : 400, color: on ? C.fg : C.mfg }); };
    it("home", "Accueil"); it("ticket", "Mes tickets"); it("sprint", "Planning tous projets", true); S.box(sb, { w: 10, h: 10 }); S.secTxt(sb, "PROJETS", { ls: 0.5 }); it("package", "Emis"); it("package", "Kibo"); it("package", "Gereco");
    S.box(st, { x: 180, y: 0, w: 1, h: S.CH.SH, fill: C.border });
    const c = S.col(st, { x: 196, y: 20, w: S.CH.SW - 212, gap: 10 }); S.miniBand(c, ["S41", "S42", "S43", "S44"], ["F1", "F2", "F3", "F4", "F5", "F6", "F8", "F7", "F9"], { lw: 40, cw: 8, rh: 30, compact: true });
  }); };
S.exportChoix = async (list) => { await S.page("Choix"); await S.wait(800); const out = [];
  for (const ch of S.CHOIX.filter(c => !list || list.includes(c.n))) for (const b of penpot.currentPage.root.children.filter(z => z.name.startsWith(`Choix ${ch.n} · `)))
    out.push(await S.exportPng(b, `choix-${ch.n}-${ch.slug}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`));
  return out; };
return "choix ok";
