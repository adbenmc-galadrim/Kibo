// Piste C · « Chronologie » : le temps en abscisse. Échéances des ensembles, fil d'activité, graphe en couloirs ; rail d'icônes.
const S = storage;
S.draw = S.draw || {};
S.WEEKS = [["S40", "28 sept."], ["S41", "5 oct."], ["S42", "12 oct."], ["S43", "19 oct."], ["S44", "26 oct."], ["S45", "2 nov."], ["S46", "9 nov."]];
S.TODAY = 2 + 4.5 / 7;
S.topbarC = (p, title, o = {}) => { const C = S.C;
  const t = S.row(p, { name: "topbar", fx: true, h: 56, pad: [0, 20, 0, 20], gap: 12 });
  S.projectSwitch(t, { stroke: true }); S.txt(t, title, { size: 15, weight: 600 });
  if (o.range !== false) { const seg = S.row(t, { pad: 2, radius: 7, fill: C.muted, gap: 2 });
    for (const [l, on] of [["Jour"], ["Semaine", true], ["Mois"]]) { const s = S.row(seg, { pad: [3, 10], radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); S.txt(s, l, { size: 12, weight: 500, color: on ? C.fg : C.mfg }); }
    const d = S.row(t, { gap: 6 }); S.icon(d, "chevLeft", 14, C.dim); S.txt(d, "ven. 16 oct. · S42", { size: 12.5, weight: 500 }); S.icon(d, "chevRight", 14, C.dim); }
  S.spacer(t); S.agentButton(t, { count: "3" });
  S.hline(p, C.soft); return t; };
S.wk = (x0, colW, w) => x0 + w * colW;

// Bande des échéances : une ligne par ensemble, barre de la période et part livrée, ligne « aujourd'hui ».
S.ganttC = (p, W) => { const C = S.C, D = S.D;
  const card = S.col(p, { name: "gantt", fx: true, stroke: C.border, radius: 10, fill: C.card, clip: true });
  const h = S.row(card, { fx: true, h: 40, pad: [0, 16], gap: 8 }); S.icon(h, "calendar", 15, C.mfg); S.txt(h, "Échéances des ensembles", { size: 13, weight: 600 });
  S.txt(h, "C0 et C1 livrés", { size: 12, color: C.dim }); S.spacer(h);
  for (const [l, col] of [["livré", C.fg], ["prévu", C.track]]) { const r = S.row(h, { gap: 6 }); S.box(r, { w: 14, h: 6, radius: 2, fill: col }); S.txt(r, l, { size: 11.5, color: C.dim }); }
  { const r = S.row(h, { gap: 6 }); S.icon(r, "milestone", 13, C.mfg); S.txt(r, "jalon", { size: 11.5, color: C.dim }); }
  S.hline(card, C.soft);
  const LW = 240, RH = 38, rows = D.sets.slice(2), TW = W - LW, colW = TW / 7, H = 30 + rows.length * RH + 38;
  const g = S.box(card, { name: "grid", w: W, h: H, fx: true });
  for (let i = 0; i < 7; i++) { const x = LW + i * colW;
    S.box(g, { name: "col", x, y: 0, w: 1, h: H, fill: C.soft });
    const l = S.row(g, { x: x + 8, y: 8, gap: 6 }); S.txt(l, S.WEEKS[i][0], { size: 11.5, weight: 600, mono: true, color: i === 2 ? C.fg : C.mfg }); S.txt(l, S.WEEKS[i][1], { size: 11.5, color: C.dim }); }
  S.box(g, { name: "sep", x: 0, y: 30, w: W, h: 1, fill: C.soft });
  const labels = [];
  rows.forEach((s, i) => { const y = 30 + i * RH;
    const l = S.row(g, { x: 16, y: y + 10, gap: 8, w: LW - 24 }); S.setChip(l, s.key); S.txt(l, s.title, { size: 12.5 }); S.spacer(l); S.txt(l, `${s.done}/${s.total}`, { size: 11.5, mono: true, color: C.dim });
    const x1 = LW + s.start * colW, x2 = LW + s.end * colW, bw = x2 - x1;
    S.box(g, { name: "bar " + s.key, x: x1, y: y + 9, w: bw, h: 20, radius: 5, fill: C.muted, stroke: C.border });
    if (s.done) S.box(g, { name: "done", x: x1, y: y + 9, w: Math.max(10, bw * s.done / s.total), h: 20, radius: 5, fill: C.fg, op: 0.9 });
    const lab = S.row(g, { gap: 6 }); S.txt(lab, s.due, { size: 11.5, color: C.mfg });
    if (s.key === "C2") S.chip(lab, "2 restants", { size: 10.5, color: C.amber, stroke: null, fill: C.amberSoft });
    labels.push([lab, x2 + 8 + 130 > W ? x1 + 10 : x2 + 8, y + 12]); });
  for (const [lab, lx, ly] of labels) { lab.x = g.x + lx; lab.y = g.y + ly; S.placed.push([lab, g, lx, ly]); }
  const my = 30 + rows.length * RH + 6;
  { const x = LW + (3 + 4.5 / 7) * colW; const m = S.row(g, { x: x - 7, y: my, gap: 6 }); S.icon(m, "milestone", 14, C.fg); S.txt(m, "Démo client · fin de C3", { size: 11.5, color: C.mfg }); }
  { const l = S.row(g, { x: 16, y: my + 2, gap: 6 }); S.txt(l, "Jalons", { size: 11.5, color: C.dim }); }
  const tx = LW + S.TODAY * colW; S.box(g, { name: "today", x: tx, y: 26, w: 1.5, h: H - 26, fill: C.fg });
  const tl = S.row(g, { x: tx + 6, y: my + 1, pad: [2, 6], radius: 4, fill: C.primary }); S.txt(tl, "Aujourd'hui", { size: 10.5, weight: 600, color: C.pfg });
  return card; };

// ---------- C1 · Chronologie ----------
S.draw["c-vue"] = (x, y) => { const C = S.C, D = S.D;
  const f = S.screen("C1 · Chronologie", x, y, 1440, 1000);
  const root = S.box(f, { name: "root", w: 1440, h: 1000, dir: "row", align: "stretch" });
  S.rail(root, "Vue d'ensemble");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbarC(main, "Chronologie");
  const body = S.col(main, { fx: true, fy: true, pad: [20, 24], gap: 18 });
  S.ganttC(body, 1379 - 48 - 2);
  const cols = S.row(body, { fx: true, gap: 24, align: "start" });
  // Fil d'activité
  const feed = S.col(cols, { fx: true, gap: 10 });
  const fh = S.row(feed, { fx: true, gap: 8 }); S.icon(fh, "activity", 15, C.mfg); S.txt(fh, "Fil d'activité", { size: 13, weight: 600 }); S.spacer(fh);
  for (const [l, on] of [["Tout", true], ["git et PR"], ["full-delivery"], ["Agent de projet"]]) S.chip(fh, l, { size: 11, color: on ? C.fg : C.mfg, fill: on ? C.muted : null, stroke: on ? C.border : null, pad: [3, 8], radius: 12 });
  const live = S.col(feed, { fx: true, stroke: C.brandLine, radius: 10, fill: C.brandSoft, pad: [4, 0] });
  for (const [k, step, since] of [["SILO-33", 7, "depuis 42 min"], ["SILO-23", 6, "depuis 18 min"]]) { const t = S.tk(k);
    const r = S.row(live, { fx: true, pad: [8, 14], gap: 12 }); S.halo(r, C.brand, 7);
    S.txt(r, "En ce moment", { size: 11.5, weight: 600, color: C.brandText }); S.txt(r, `${k} · ${t.title}`, { size: 13 });
    S.spacer(r); S.segs(r, S.stepColors(step), { w: 4, h: 10, gap: 1.5, radius: 1 }); S.txt(r, S.stepLabel(step), { size: 12, color: C.mfg }); S.txt(r, `T3 Code · ${since}`, { size: 11.5, color: C.dim }); }
  const day = (label) => { const d = S.row(feed, { fx: true, gap: 8, pad: [6, 0, 0, 0] }); S.txt(d, label, { size: 11, weight: 600, color: C.dim, upper: true, ls: 0.6 }); S.hline(d, C.soft); };
  const item = (a, last) => { const r = S.row(feed, { fx: true, gap: 12, align: "start" });
    const tm = S.row(r, { w: 40, pad: [3, 0, 0, 0] }); S.txt(tm, a.t, { size: 11.5, mono: true, color: C.dim });
    const rail = S.col(r, { w: 24, align: "center", gap: 0 });
    const ic = S.box(rail, { w: 24, h: 24, radius: 12, fill: a.src === "agent" ? C.brandSoft : C.muted, stroke: a.src === "agent" ? C.brandLine : C.border, dir: "row", align: "center", justify: "center" });
    S.icon(ic, a.icon, 12, a.src === "agent" ? C.brand : a.color ? C[a.color] : C.mfg); if (!last) S.box(rail, { w: 1, h: 18, fill: C.border });
    const tc = S.col(r, { fx: true, gap: 3, pad: [3, 0, 0, 0] }); const tl = S.row(tc, { gap: 8 });
    S.txt(tl, a.text, { size: 13, color: a.src === "agent" ? C.brandText : C.fg });
    if (a.res) { S.icon(tl, "arrowRight", 11, C.dim); S.status(tl, a.res, 7); S.txt(tl, a.res, { size: 12.5, color: C.mfg }); }
    const m = S.row(tc, { gap: 6 }); if (a.tk) { S.txt(m, a.tk, { size: 11.5, mono: true, color: C.dim }); const t = S.tk(a.tk); if (t) S.txt(m, t.title, { size: 11.5, color: C.dim }); if (a.set) S.setChip(m, a.set); }
    else S.txt(m, "3 actions à valider", { size: 11.5, color: C.dim });
    const src = { git: "git", ci: "CI", step: "full-delivery", agent: "agent de projet", question: "question" }[a.src]; S.txt(r, src, { size: 11, color: C.faint }); };
  day("Aujourd'hui · ven. 16 oct.");
  const today = D.activity.filter(a => a.day === "Aujourd'hui").slice(0, 6); today.forEach((a, i) => item(a, i === today.length - 1));
  day("Hier · jeu. 15 oct.");
  const hier = D.activity.filter(a => a.day === "Hier"); hier.forEach((a, i) => item(a, i === hier.length - 1));
  // Colonne de droite : à venir, en attente, agent
  const rc = S.col(cols, { w: 380, gap: 16 });
  const up = S.card(rc, "À venir", "calendar", { right: h => S.txt(h, "14 jours", { size: 12, color: C.dim }) });
  for (const [d, wd, title, meta, warn] of [["19", "lun.", "Fin de C2 · Périmètre", "2 tickets restants · 1 en review", true], ["21", "mer.", "Point client hebdomadaire", "Q14 et Q17 à l'ordre du jour"], ["23", "ven.", "Démo client · Fin de C3", "5 tickets restants · 1 bloqué"], ["30", "ven.", "Fin de C4 · Fichiers et photos", "4 tickets restants"]]) {
    const r = S.cardRow(up, { gap: 12 }); const db = S.col(r, { w: 40, align: "center", gap: 0, pad: [4, 0], radius: 6, stroke: warn ? C.amber : C.border });
    S.txt(db, d, { size: 16, weight: 600, color: warn ? C.amber : C.fg }); S.txt(db, wd, { size: 10.5, color: C.dim });
    const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, title, { size: 13 }); S.txt(tc, meta, { size: 11.5, color: C.dim }); }
  const wt = S.card(rc, "Attend ta réponse", "inbox", { count: "3" });
  for (const [ic, col, text, meta] of [["pr", C.purple, "Relire PR #21 et PR #22", "ouvertes depuis hier · C2 et C4"], ["question", C.red, "Q14 · Un box réaffecté garde-t-il ses photos ?", "bloque SILO-44 depuis 3 j · Client"]]) {
    const r = S.cardRow(wt, { align: "start" }); S.icon(r, ic, 14, col); const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, text, { size: 12.5, fill: true }); S.txt(tc, meta, { size: 11.5, color: C.dim }); }
  { const r = S.cardRow(wt, { align: "start" }); S.icon(r, "bot", 14, C.brand); const tc = S.col(r, { fx: true, gap: 6 });
    S.txt(tc, "Lot n° 6 de l'agent de projet · 3 actions", { size: 12.5, fill: true }); S.txt(tc, "créer SILO-61, lier SILO-34, relancer Q14", { size: 11.5, color: C.dim });
    const b = S.row(tc, { gap: 8 }); S.btn(b, "Examiner", "brandOutline", { sm: true }); S.btn(b, "Plus tard", "ghost", { sm: true }); }
  return f; };

// ---------- C2 · Tickets ----------
S.stepper = (p, step) => { const C = S.C; const r = S.row(p, { gap: 0 });
  for (let i = 0; i < 12; i++) { if (i) S.box(r, { w: 5, h: 1.5, fill: step != null && i <= step ? C.mfg : C.track });
    if (step == null) S.ring(r, C.track, 7, 1.5); else if (i < step) S.dot(r, C.mfg, 7); else if (i === step) S.halo(r, step === 11 ? C.green : C.brand, 7); else S.ring(r, C.faint, 7, 1.5); }
  return r; };
S.draw["c-tickets"] = (x, y) => { const C = S.C, D = S.D;
  const f = S.screen("C2 · Tickets", x, y, 1440, 1000);
  const root = S.box(f, { name: "root", w: 1440, h: 1000, dir: "row", align: "stretch" });
  S.rail(root, "Tickets");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbarC(main, "Tickets", { range: false });
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24], gap: 14 });
  const fr = S.row(body, { fx: true, gap: 8 });
  const seg = S.row(fr, { pad: 2, radius: 7, fill: C.muted, gap: 2 });
  for (const [l, on] of [["Par activité", true], ["Par échéance"], ["Par ensemble"]]) { const s = S.row(seg, { pad: [4, 10], radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : C.mfg }); }
  S.txt(fr, "27 ouverts · 41 livrés", { size: 12.5, color: C.dim }); S.spacer(fr);
  S.btn(fr, "Ensemble", "outline", { sm: true, icon: "layers" }); S.btn(fr, "Source", "outline", { sm: true, icon: "branch" }); S.btn(fr, "Terminés", "outline", { sm: true, icon: "eye" });
  const W = { key: 78, st: 112, step: 236, ev: 250, due: 92 };
  const tb = S.col(body, { fx: true, stroke: C.border, radius: 10, clip: true, fill: C.card });
  const th = S.row(tb, { fx: true, h: 34, pad: [0, 16], gap: 12, fill: C.panel });
  const hc = (l, w) => { const c = S.row(th, { w, fx: !w }); S.txt(c, l, { size: 11.5, weight: 500, color: C.dim }); };
  hc("Clé", W.key); hc("Titre"); hc("État", W.st); hc("Livraison · étapes 0 à 11", W.step); hc("Dernier événement", W.ev); hc("Échéance", W.due);
  const EV = { "SILO-23": ["branch", C.blue, "branche poussée · 14:20"], "SILO-33": ["flag", C.mfg, "étape 7 · 14:51"], "SILO-22": ["flag", C.mfg, "2 commentaires · 13:47"], "SILO-32": ["pr", C.purple, "PR #22 ouverte · 15:04"], "SILO-21": ["merge", C.green, "PR #18 fusionnée · 14:36"],
    "SILO-41": ["circleX", C.red, "CI rouge sur #20 · 11:58"], "SILO-60": ["pr", C.purple, "PR #23 ouverte · mer."], "SILO-43": ["flag", C.mfg, "étape 4 · mer."], "SILO-44": ["question", C.red, "attend Q14 · mar."],
    "SILO-34": ["link", C.dim, "lié à SILO-32 · hier"], "SILO-46": ["plus", C.dim, "créé · mar. 13"], "SILO-35": ["plus", C.dim, "créé · lun. 12"], "SILO-52": ["question", C.mfg, "Q17 posée · 13:10"] };
  const groups = [["Aujourd'hui", ["SILO-32", "SILO-33", "SILO-21", "SILO-23", "SILO-22", "SILO-52"]], ["Cette semaine", ["SILO-41", "SILO-60", "SILO-43", "SILO-44", "SILO-34"]], ["Plus ancien", ["SILO-46", "SILO-35"]]];
  for (const [g, keys] of groups) { S.hline(tb, C.soft);
    const gr = S.row(tb, { fx: true, h: 30, pad: [0, 16], gap: 8, fill: C.panel }); S.icon(gr, "chevDown", 13, C.dim); S.txt(gr, g, { size: 12, weight: 600, color: C.mfg }); S.txt(gr, String(keys.length), { size: 11, mono: true, color: C.dim });
    for (const k of keys) { const t = S.tk(k); S.hline(tb, C.soft);
      const r = S.row(tb, { fx: true, h: 42, pad: [0, 16], gap: 12 });
      const kc = S.row(r, { w: W.key }); S.txt(kc, k, { size: 12, mono: true, color: t.st === "Terminé" ? C.dim : C.mfg });
      const tc = S.row(r, { fx: true, gap: 8 }); S.txt(tc, t.title, { size: 13, color: t.st === "Terminé" ? C.mfg : C.fg }); if (t.set) S.setChip(tc, t.set); if (t.live) S.dot(tc, C.brand, 7);
      const st = S.row(r, { w: W.st, gap: 7 }); S.status(st, t.st, 8); S.txt(st, t.st, { size: 12.5 });
      const sc = S.row(r, { w: W.step, gap: 10 }); S.stepper(sc, t.step); S.txt(sc, t.step == null ? "—" : String(t.step), { size: 11.5, mono: true, color: C.dim });
      const ev = EV[k]; const ec = S.row(r, { w: W.ev, gap: 7 }); S.icon(ec, ev[0], 13, ev[1]); S.txt(ec, ev[2], { size: 12, color: C.mfg });
      const dc = S.row(r, { w: W.due }); const soon = t.due === "19 oct."; S.txt(dc, t.due, { size: 12, color: soon ? C.amber : C.dim, weight: soon ? 500 : 400 }); } }
  const ft = S.row(body, { fx: true, gap: 8 }); S.icon(ft, "refresh", 13, C.dim);
  S.txt(ft, "Triés par dernier événement : git, PR, CI et étapes full-delivery. Aucun état n'est saisi à la main.", { size: 11.5, color: C.dim });
  return f; };

// ---------- C3 · Graphe en couloirs ----------
S.draw["c-graphe"] = (x, y) => { const C = S.C, D = S.D;
  const f = S.screen("C3 · Graphe", x, y, 1440, 1000);
  const root = S.box(f, { name: "root", w: 1440, h: 1000, dir: "row", align: "stretch" });
  S.rail(root, "Graphe");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbarC(main, "Graphe");
  const tb = S.row(main, { fx: true, h: 46, pad: [0, 20], gap: 8 });
  S.btn(tb, "Abscisse : semaines", "outline", { sm: true, icon: "calendar" }); S.btn(tb, "Couloirs : ensembles", "outline", { sm: true, icon: "layers" }); S.btn(tb, "Livrés masqués", "outline", { sm: true, icon: "eye" });
  S.spacer(tb); for (const st of ["À faire", "En cours", "En review", "Bloqué"]) { const r = S.row(tb, { gap: 6 }); S.status(r, st, 8); S.txt(r, st, { size: 11.5, color: C.mfg }); }
  { const r = S.row(tb, { gap: 6 }); S.dot(r, C.brand, 7); S.txt(r, "Session active", { size: 11.5, color: C.mfg }); }
  { const r = S.row(tb, { gap: 6 }); S.icon(r, "flag", 12, C.mfg); S.txt(r, "Échéance", { size: 11.5, color: C.mfg }); }
  S.hline(main, C.soft);
  const CW = 1379, CH = 1000 - 56 - 1 - 46 - 1, cv = S.box(main, { name: "canvas", w: CW, h: CH, fill: C.canvas, fx: true, fy: true, clip: true });
  const LW = 210, colW = (CW - LW - 20) / 7, NW = 150, X = w => LW + w * colW;
  S.box(cv, { name: "axis", x: 0, y: 0, w: CW, h: 50, fill: C.panel });
  for (let i = 0; i < 7; i++) { S.box(cv, { name: "col", x: X(i), y: 0, w: 1, h: CH, fill: C.grid });
    const l = S.row(cv, { x: X(i) + 8, y: 10, gap: 6 }); S.txt(l, S.WEEKS[i][0], { size: 11.5, weight: 600, mono: true, color: i === 2 ? C.fg : C.mfg }); S.txt(l, S.WEEKS[i][1], { size: 11.5, color: C.dim }); }
  const lanes = [{ key: "C2", rows: 1 }, { key: "C3", rows: 2 }, { key: "C4", rows: 2 }, { key: "C5", rows: 1, more: "+ 4 tickets" }, { key: null, rows: 1 }];
  const place = { "SILO-22": ["C2", 1.68, 0], "SILO-23": ["C2", 2.75, 0], "SILO-41": ["C3", 1.68, 0], "SILO-43": ["C3", 2.75, 0], "SILO-44": ["C3", 1.68, 1], "SILO-46": ["C3", 2.75, 1],
    "SILO-32": ["C4", 1.68, 0], "SILO-33": ["C4", 2.75, 0], "SILO-34": ["C4", 3.95, 1], "SILO-35": ["C4", 4.9, 1], "SILO-52": ["C5", 3.9, 0], "SILO-53": ["C5", 4.85, 0], "SILO-60": [null, 1.68, 0] };
  const extra = { "SILO-53": { key: "SILO-53", title: "Export des rapports", st: "À faire" }, "SILO-54": { key: "SILO-54", title: "Signature du rapport", st: "À faire" } };
  const done = { C2: [0.6, "4 livrés"], C3: [0.6, "9 livrés"], C4: [0.75, "1 livré"] };
  const RH = 64; let yy = 56; const laneY = {}, pos = {};
  for (const ln of lanes) { const h = ln.rows * RH + 22; laneY[ln.key] = yy; const s = D.sets.find(x => x.key === ln.key);
    S.box(cv, { name: "lane " + (ln.key || "hors"), x: 8, y: yy, w: CW - 16, h, radius: 10, stroke: C.border, dashed: !!ln.key, fill: C.bg, op: 0.55 });
    const lab = S.col(cv, { x: 22, y: yy + 12, w: LW - 34, gap: 5 });
    if (s) { const a = S.row(lab, { gap: 8 }); S.setChip(a, s.key); S.txt(a, `${s.done}/${s.total}`, { size: 11.5, mono: true, color: C.dim });
      S.txt(lab, s.title, { size: 13, weight: 600, fill: true }); S.bar(lab, LW - 40, s.done / s.total, { h: 3, color: C.fg }); }
    else { S.txt(lab, "Hors ensemble", { size: 13, weight: 600, color: C.mfg }); S.txt(lab, "1 ticket ouvert", { size: 11.5, color: C.dim }); }
    if (s) { const fl = S.row(lab, { gap: 5 }); S.icon(fl, "flag", 12, s.key === "C2" ? C.amber : C.dim); S.txt(fl, "Échéance " + s.due, { size: 11.5, color: s.key === "C2" ? C.amber : C.dim });
      const ax = S.row(cv, { x: X(s.end) - 6, y: 34 + 2 + ["C2", "C3", "C4", "C5"].indexOf(s.key) * 0, gap: 3 }); S.icon(ax, "flag", 11, s.key === "C2" ? C.amber : C.mfg); S.txt(ax, s.key, { size: 10, mono: true, color: s.key === "C2" ? C.amber : C.mfg }); }
    if (done[ln.key]) { const [w, l] = done[ln.key]; const p = S.row(cv, { x: X(w), y: yy + 14, pad: [5, 10], gap: 6, radius: 14, fill: C.muted }); S.icon(p, "circleCheck", 12, C.green); S.txt(p, l, { size: 11.5, color: C.mfg }); }
    if (ln.more) { const p = S.row(cv, { x: X(5.8), y: yy + 22, pad: [5, 10], radius: 14, stroke: C.border, dashed: true }); S.txt(p, ln.more, { size: 11.5, color: C.dim }); }
    yy += h + 10; }
  const SHORT = { "SILO-22": "Périmètre serveur et synchro", "SILO-23": "404 hors périmètre", "SILO-41": "Constat hors ligne", "SILO-43": "Contrats par lot", "SILO-44": "Import Excel des box", "SILO-46": "Recherche par numéro",
    "SILO-32": "Envoi des photos", "SILO-33": "Aperçu hors ligne", "SILO-34": "Quotas par client", "SILO-35": "Purge des orphelins", "SILO-52": "Rapport journalier PDF", "SILO-53": "Export des rapports", "SILO-54": "Signature du rapport", "SILO-60": "Expo SDK 54" };
  const at = {}; for (const [k, [lane, w, row]] of Object.entries(place)) at[k] = { x: X(w), y: laneY[lane] + 11 + row * RH };
  { const pairs = [["SILO-22", "SILO-23"], ["SILO-41", "SILO-43"], ["SILO-44", "SILO-46"], ["SILO-32", "SILO-33"], ["SILO-32", "SILO-34"], ["SILO-34", "SILO-35"], ["SILO-23", "SILO-52"], ["SILO-52", "SILO-53"]];
    const segs = pairs.map(([a, b]) => [at[a].x + NW, at[a].y + 26, at[b].x - 2, at[b].y + 26, false, a === "SILO-32"]);
    S.svg(cv, S.edgesSvg(CW, CH, segs), "edges", { x: 0, y: 0 }); }
  for (const [k, [lane, w, row]] of Object.entries(place)) { const t = { ...(S.tk(k) || extra[k]), title: SHORT[k] }; const nx = X(w), ny = laneY[lane] + 11 + row * RH;
    const n = S.col(cv, { name: "node " + k, x: nx, y: ny, w: NW, pad: [7, 9], gap: 3, radius: 8, fill: C.card, stroke: t.live ? C.brandLine : C.border, vs: "auto" });
    const r = S.row(n, { fx: true, gap: 6 }); S.status(r, t.st, 7); S.txt(r, k, { size: 10.5, mono: true, color: C.dim }); S.spacer(r); if (t.live) S.dot(r, C.brand, 6); if (t.git) S.icon(r, S.gitIcon[t.git], 11, S.gitColor(t.git));
    S.txt(n, t.title, { size: 12, fill: true, lh: 1.3 }); pos[k] = { x: nx, y: ny }; }
  const tx = X(S.TODAY); S.box(cv, { name: "today", x: tx, y: 30, w: 1.5, h: CH - 30, fill: C.fg });
  const tl = S.row(cv, { x: tx + 6, y: CH - 30, pad: [2, 6], radius: 4, fill: C.primary }); S.txt(tl, "Aujourd'hui", { size: 10.5, weight: 600, color: C.pfg });
  S.cPos = pos; S.cNW = NW;
  return f; };
return "piste C ok";
