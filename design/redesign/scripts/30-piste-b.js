// Piste B · « Éditorial » : aéré, colonne centrée, la feuille de route des ensembles au cœur ; navigation en haut.
const S = storage;
S.draw = S.draw || {};
S.topnavB = (p, active) => { const C = S.C;
  const n = S.row(p, { name: "topnav", fx: true, h: 64, pad: [0, 32], gap: 20 });
  const l = S.row(n, { gap: 10 }); S.logo(l, 26); S.txt(l, "Kibo", { size: 15, weight: 600 });
  S.txt(n, "/", { size: 16, color: C.faint }); S.projectSwitch(n);
  S.box(n, { w: 12, h: 4 });
  const links = S.row(n, { gap: 22, align: "end", h: 64 });
  for (const [l, c] of [["Aperçu"], ["Tickets", "27"], ["Kanban"], ["Graphe"], ["Notes"], ["Questions", "3"]]) {
    const on = l === active, it = S.col(links, { gap: 0, h: 64, justify: "end" });
    const r = S.row(it, { gap: 5, h: 40 }); S.txt(r, l, { size: 13.5, weight: on ? 500 : 400, color: on ? C.fg : C.mfg }); if (c) S.txt(r, c, { size: 11, mono: true, color: C.dim });
    S.box(it, { w: 10, h: 2, fill: on ? C.fg : null, fx: true }); }
  S.spacer(n);
  S.icon(n, "search", 17, C.mfg); S.icon(n, "bell", 17, C.mfg); S.agentButton(n, { label: "Agent", count: "3" }); S.avatar(n, "AB", 28);
  S.hline(p, C.soft); return n; };
S.center = (p, w, o = {}) => { const wrap = S.row(p, { fx: true, justify: "center", align: "start", fy: o.fy }); return S.col(wrap, { w, pad: o.pad || [48, 0], gap: o.gap ?? 40 }); };
S.progressStrip = (p, o = {}) => { const C = S.C, P = S.D.project; const cols = [];
  const add = (n, c) => { for (let i = 0; i < n; i++) cols.push(c); };
  add(P.done, C.fg); add(P.review, C.purple); add(P.wip, C.blue); add(P.blocked, C.red); add(P.todo, C.track);
  return S.segs(p, cols, { w: o.w || 3, h: o.h || 22, gap: o.gap ?? 1.5, radius: 1 }); };

// ---------- B1 · Aperçu ----------
S.draw["b-vue"] = (x, y) => { const C = S.C, D = S.D, P = D.project;
  const f = S.screen("B1 · Aperçu", x, y, 1440, 1440);
  const root = S.col(f, { name: "root", w: 1440, h: 1440 });
  S.topnavB(root, "Aperçu");
  const c = S.center(root, 1040);
  // En-tête éditorial
  const hero = S.row(c, { fx: true, gap: 48, align: "end" });
  const hl = S.col(hero, { fx: true, gap: 14 });
  S.txt(hl, "Projet · " + P.sub, { size: 11.5, weight: 500, color: C.dim, upper: true, ls: 1.2 });
  S.txt(hl, "Silo", { size: 52, weight: 600, ls: -1.5 });
  S.txt(hl, "41 tickets livrés sur 68. Le périmètre se boucle lundi, les photos entrent en review et les rapports n'ont pas commencé.", { size: 18, lh: 1.55, color: C.mfg, w: 600 });
  const meta = S.row(hl, { gap: 8 }); S.icon(meta, "github", 13, C.dim); S.txt(meta, P.repo, { size: 12.5, mono: true, color: C.dim }); S.txt(meta, "·", { color: C.faint });
  S.icon(meta, "refresh", 13, C.dim); S.txt(meta, "synchronisé il y a 1 min", { size: 12.5, color: C.dim });
  const hr = S.col(hero, { w: 300, gap: 10, align: "end" });
  const big = S.row(hr, { gap: 6, align: "end" }); S.txt(big, "60", { size: 72, weight: 300, ls: -3 }); S.txt(big, "%", { size: 28, weight: 300, color: C.mfg });
  S.txt(hr, "livré · 41 sur 68 tickets", { size: 13, color: C.mfg });
  S.progressStrip(hr, { w: 3, h: 22, gap: 1.4 });
  const lg = S.row(hr, { gap: 12 }); for (const [l, col] of [["livrés", C.fg], ["review", C.purple], ["en cours", C.blue], ["bloqué", C.red]]) { const r = S.row(lg, { gap: 5 }); S.dot(r, col, 6); S.txt(r, l, { size: 11, color: C.dim }); }

  // Le point de l'agent de projet
  const ag = S.row(c, { fx: true, gap: 0, align: "stretch" });
  S.box(ag, { w: 2, h: 10, fill: C.brand, fy: true });
  const at = S.col(ag, { fx: true, pad: [4, 0, 4, 24], gap: 12 });
  const ah = S.row(at, { gap: 10 }); S.agentMark(ah, 24); S.txt(ah, "Le point de l'agent de projet", { size: 13.5, weight: 600, color: C.brandText }); S.txt(ah, "mis à jour à 14:40", { size: 12.5, color: C.dim });
  S.txt(at, "Deux PR attendent ta relecture depuis hier, #21 et #22. Je propose de démarrer SILO-34 dès la fusion de #22, de créer SILO-61 pour compresser les photos avant envoi, et de relancer le client sur Q14, qui bloque l'import Excel.", { size: 17, lh: 1.6, color: C.fg, w: 900 });
  const ab = S.row(at, { gap: 10 }); S.btn(ab, "Examiner le lot n° 6 · 3 actions", "brandOutline", { sm: true, icon: "check", ic: C.brandText }); S.btn(ab, "Répondre", "ghost", { sm: true, icon: "message" });
  S.box(c, { w: 4, h: 8 });

  // Feuille de route
  const rm = S.col(c, { fx: true, gap: 0 });
  const rh = S.row(rm, { fx: true, gap: 12, align: "end", pad: [0, 0, 16, 0] }); S.txt(rh, "Feuille de route", { size: 26, weight: 600, ls: -0.5 }); S.txt(rh, "6 ensembles, dans l'ordre de livraison", { size: 13.5, color: C.dim }); S.spacer(rh);
  const gl = S.row(rh, { gap: 6 }); S.txt(gl, "Voir le graphe", { size: 13, weight: 500, color: C.fg }); S.icon(gl, "arrowRight", 14, C.fg);
  for (const s of D.sets.slice(2)) { S.hline(rm, C.border);
    const r = S.row(rm, { fx: true, gap: 28, pad: [22, 0], align: "start" });
    S.txt(r, s.key, { size: 24, weight: 300, mono: true, color: C.dim });
    const tc = S.col(r, { fx: true, gap: 6 }); S.txt(tc, s.title, { size: 19, weight: 600, ls: -0.3 }); S.txt(tc, s.line, { size: 14.5, color: C.mfg });
    const m = S.row(tc, { gap: 8, pad: [4, 0, 0, 0] }); S.icon(m, "calendar", 13, C.dim); S.txt(m, "Échéance " + s.due, { size: 12.5, color: C.dim });
    const cnt = (st) => s.subs.filter(x => x === st).length;
    for (const st of ["En review", "En cours", "Bloqué"]) if (cnt(st)) { S.txt(m, "·", { color: C.faint }); S.status(m, st, 6); S.txt(m, `${cnt(st)} ${st.toLowerCase()}`, { size: 12.5, color: C.dim }); }
    const rc = S.col(r, { w: 320, gap: 10, align: "end" });
    const n = S.row(rc, { gap: 6, align: "end" }); S.txt(n, `${s.done}`, { size: 26, weight: 500 }); S.txt(n, `/ ${s.total} livrés`, { size: 13.5, color: C.dim });
    S.segs(rc, s.subs.map(st => st === "Terminé" ? C.fg : st === "À faire" ? C.track : S.statusColor(st)), { w: s.total > 8 ? 16 : 30, h: 8, gap: 4, radius: 2 }); }
  S.hline(rm, C.border);
  { const r = S.row(rm, { fx: true, gap: 10, pad: [16, 0] }); S.icon(r, "circleCheck", 15, C.green); S.txt(r, "C0 Socle et déploiement, C1 Connexion et comptes : livrés, 20 tickets.", { size: 13.5, color: C.dim }); }

  // Trois colonnes
  const tri = S.row(c, { fx: true, gap: 40, align: "start" });
  const colB = (title, n) => { const k = S.col(tri, { fx: true, gap: 16 }); const h = S.row(k, { gap: 8 }); S.txt(h, title, { size: 16, weight: 600 }); S.txt(h, n, { size: 12.5, mono: /^[0-9]+$/.test(n), color: C.dim }); S.hline(k, C.border); return k; };
  const rv = colB("À relire", "4");
  for (const key of ["SILO-22", "SILO-32", "SILO-41"]) { const t = S.tk(key); const it = S.col(rv, { fx: true, gap: 5 });
    const r = S.row(it, { gap: 8 }); S.icon(r, "pr", 14, S.gitColor(t.git)); S.txt(r, t.ref, { size: 13, mono: true, color: C.mfg });
    S.txt(it, t.title, { size: 14.5, fill: true, lh: 1.4 }); S.txt(it, `${t.key} · ${t.set} · ${t.note}`, { size: 12, color: t.git === "changes" ? C.amber : C.dim }); }
  const qs = colB("Questions ouvertes", "3");
  for (const q of D.questions) { const it = S.col(qs, { fx: true, gap: 5 }); S.txt(it, q.text, { size: 14.5, fill: true, lh: 1.4 });
    const m = S.row(it, { gap: 6 }); S.txt(m, `${q.id} · ${q.to} · ${q.age}`, { size: 12, color: C.dim }); if (q.blocking) S.txt(m, "· bloque " + q.ticket, { size: 12, color: C.red }); }
  const nw = colB("Dernières nouvelles", "aujourd'hui");
  for (const a of D.activity.slice(0, 5)) { const it = S.row(nw, { fx: true, gap: 10, align: "start" }); S.txt(it, a.t, { size: 12, mono: true, color: C.dim });
    const tc = S.col(it, { fx: true, gap: 3 }); S.txt(tc, a.text, { size: 14, fill: true, color: a.src === "agent" ? C.brandText : C.fg }); if (a.tk) S.txt(tc, a.tk + (a.res ? " → " + a.res : ""), { size: 12, color: C.dim }); }
  return f; };

// ---------- B2 · Tickets ----------
S.draw["b-tickets"] = (x, y) => { const C = S.C, D = S.D;
  const f = S.screen("B2 · Tickets", x, y, 1440, 1240);
  const root = S.col(f, { name: "root", w: 1440, h: 1240 });
  S.topnavB(root, "Tickets");
  const c = S.center(root, 1040, { gap: 28 });
  const h = S.col(c, { fx: true, gap: 10 }); S.txt(h, "Tickets", { size: 40, weight: 600, ls: -1 });
  S.txt(h, "27 ouverts, 41 livrés. L'état de chaque ticket vient de git et des PR ; son étape, de full-delivery.", { size: 16, color: C.mfg });
  const fr = S.row(c, { fx: true, gap: 8 });
  for (const [l, n, on] of [["Ouverts", "27", true], ["En review", "4"], ["En cours", "3"], ["Bloqués", "1"], ["Terminés", "41"]]) {
    const p = S.row(fr, { pad: [6, 14], gap: 6, radius: 18, fill: on ? C.primary : null, stroke: on ? null : C.border }); S.txt(p, l, { size: 13, weight: 500, color: on ? C.pfg : C.fg }); S.txt(p, n, { size: 11.5, mono: true, color: on ? C.pfg : C.dim }); }
  S.spacer(fr); S.btn(fr, "Ensemble : tous", "ghost", { sm: true, icon: "layers" }); S.btn(fr, "Plus récents", "ghost", { sm: true, icon: "sort" }); S.icon(fr, "search", 16, C.mfg);
  const list = S.col(c, { fx: true });
  for (const t of D.tickets.filter(t => t.st !== "Terminé")) { S.hline(list, C.border);
    const r = S.row(list, { fx: true, gap: 18, pad: [16, 4], align: "center" });
    S.status(r, t.st, 10);
    const tc = S.col(r, { fx: true, gap: 6 });
    const tl = S.row(tc, { gap: 10 }); S.txt(tl, t.title, { size: 15.5, weight: 500 }); if (t.live) { const lv = S.row(tl, { gap: 5 }); S.dot(lv, C.brand, 6); S.txt(lv, "en session · T3 Code", { size: 12, color: C.brandText }); }
    const m = S.row(tc, { gap: 8 }); S.txt(m, t.key, { size: 12.5, mono: true, color: C.dim });
    if (t.set) { const s = D.sets.find(x => x.key === t.set); S.txt(m, "·", { color: C.faint }); S.setChip(m, t.set); S.txt(m, s.title, { size: 12.5, color: C.dim }); }
    if (t.git || t.ref) { S.txt(m, "·", { color: C.faint }); if (t.git) S.icon(m, S.gitIcon[t.git], 12, S.gitColor(t.git)); S.txt(m, t.git ? S.gitText(t) : t.ref, { size: 12.5, color: t.git === "changes" ? C.amber : C.dim, mono: t.git === "branch" }); if (t.git === "changes") S.txt(m, "changements demandés", { size: 12.5, color: C.amber }); }
    const rc = S.col(r, { w: 230, gap: 7, align: "end" });
    const st = S.row(rc, { gap: 6 }); S.txt(st, t.st, { size: 13.5, weight: 500, color: t.st === "Bloqué" ? C.red : C.fg });
    if (t.step != null) { const s = S.row(rc, { gap: 8 }); S.txt(s, `étape ${t.step}/11 · ${S.STEP[t.step]}`, { size: 12, color: C.dim }); S.bar(s, 80, t.step / 11, { h: 3, color: C.mfg }); }
    else S.txt(rc, t.st === "En review" ? "hors full-delivery" : "pas commencé", { size: 12, color: C.faint }); }
  S.hline(list, C.border);
  const ft = S.row(c, { fx: true, gap: 8 }); S.icon(ft, "circleCheck", 14, C.green); S.txt(ft, "41 tickets livrés, repliés", { size: 13, color: C.dim }); S.icon(ft, "chevDown", 13, C.dim);
  return f; };

// ---------- B3 · Graphe ----------
S.draw["b-graphe"] = (x, y) => { const C = S.C, D = S.D;
  const f = S.screen("B3 · Graphe", x, y);
  const root = S.col(f, { name: "root", w: 1440, h: 960 });
  S.topnavB(root, "Graphe");
  const cv = S.box(root, { name: "canvas", w: 1440, h: 895, fill: C.canvas, fx: true, fy: true, clip: true });
  // Panneau « Feuille de route » : ensembles, avancement, visibilité ; fait office de légende.
  const pn = S.col(cv, { name: "panel", x: 24, y: 24, w: 268, pad: 18, gap: 14, radius: 14, stroke: C.border, fill: C.card });
  S.txt(pn, "Feuille de route", { size: 15, weight: 600 }); S.txt(pn, "Un cadre par ensemble ; les flèches suivent les dépendances.", { size: 12.5, color: C.dim, fill: true, lh: 1.45 });
  for (const s of D.sets) { const r = S.col(pn, { fx: true, gap: 6 }); const a = S.row(r, { fx: true, gap: 8 });
    S.setChip(a, s.key); S.txt(a, s.title, { size: 12.5, color: s.done === s.total ? C.dim : C.fg }); S.spacer(a); S.txt(a, `${s.done}/${s.total}`, { size: 11.5, mono: true, color: C.dim });
    S.bar(r, 230, s.done / s.total, { h: 3, color: s.done === s.total ? C.green : C.fg }); }
  S.hline(pn, C.soft);
  const lg = S.col(pn, { gap: 8 }); for (const st of ["À faire", "En cours", "En review", "Bloqué"]) { const r = S.row(lg, { gap: 8 }); S.status(r, st, 8); S.txt(r, st, { size: 12, color: C.mfg }); }
  { const r = S.row(lg, { gap: 8 }); S.dot(r, C.brand, 8); S.txt(r, "Session full-delivery active", { size: 12, color: C.mfg }); }
  // Colonnes-chapitres : C2 → C5, de gauche à droite.
  const X0 = 324, CW = 250, GX = 26, TOP = 24, pos = {};
  const chapters = [
    { key: "C2", nodes: ["SILO-22", "SILO-23"], done: 4 },
    { key: "C3", nodes: ["SILO-41", "SILO-43", "SILO-44", "SILO-46"], done: 9 },
    { key: "C4", nodes: ["SILO-32", "SILO-33", "SILO-34", "SILO-35"], done: 1 },
    { key: "C5", nodes: ["SILO-52", "SILO-53", "SILO-54"], done: 0, more: "+ 3 tickets" } ];
  const extra = { "SILO-53": { key: "SILO-53", title: "Export des rapports au client", st: "À faire" }, "SILO-54": { key: "SILO-54", title: "Signature du rapport sur tablette", st: "À faire" } };
  chapters.forEach((ch, i) => { const s = D.sets.find(x => x.key === ch.key); const fx = X0 + i * (CW + GX);
    const fr = S.col(cv, { name: "frame " + ch.key, x: fx, y: TOP, w: CW, h: 620, pad: [16, 14], gap: 12, radius: 16, stroke: C.border, dashed: true, fill: C.bg, op: 0.6 });
    const hd = S.col(fr, { fx: true, gap: 6 }); const a = S.row(hd, { fx: true, gap: 8 }); S.txt(a, ch.key, { size: 13, mono: true, color: C.dim }); S.spacer(a); S.txt(a, `${s.done}/${s.total}`, { size: 13, mono: true, color: C.mfg });
    S.txt(hd, s.title, { size: 16, weight: 600, fill: true, lh: 1.3 }); S.segs(hd, s.subs.map(st => st === "Terminé" ? C.fg : st === "À faire" ? C.track : S.statusColor(st)), { w: Math.floor((CW - 28 - (s.total - 1) * 3) / s.total), h: 4, gap: 3, radius: 1 });
    S.txt(hd, "Échéance " + s.due, { size: 12, color: C.dim });
    if (ch.done) { const d = S.row(fr, { fx: true, gap: 8, pad: [8, 12], radius: 10, fill: C.muted }); S.icon(d, "circleCheck", 13, C.green); S.txt(d, `${ch.done} livré${ch.done > 1 ? "s" : ""}`, { size: 12.5, color: C.mfg }); }
    for (const k of ch.nodes) { const t = S.tk(k) || extra[k];
      const n = S.col(fr, { name: "node " + k, fx: true, gap: 6, pad: [11, 12], radius: 12, fill: C.card, stroke: t.live ? C.brandLine : k === "SILO-32" ? C.mfg : C.border, vs: "auto" });
      const r = S.row(n, { fx: true, gap: 7 }); S.status(r, t.st, 8); S.txt(r, k, { size: 11.5, mono: true, color: C.dim }); S.spacer(r); if (t.live) S.dot(r, C.brand, 7);
      if (t.git) { S.icon(r, S.gitIcon[t.git], 12, S.gitColor(t.git)); if (t.git !== "branch") S.txt(r, t.ref, { size: 11.5, mono: true, color: C.dim }); }
      S.txt(n, t.title, { size: 13.5, fill: true, lh: 1.35 });
      if (t.step != null) S.txt(n, `étape ${t.step}/11 · ${S.STEP[t.step]}`, { size: 11.5, color: C.dim });
      pos[k] = n; }
    if (ch.more) { const m = S.row(fr, { fx: true, pad: [8, 12], radius: 10, stroke: C.border, dashed: true, justify: "center" }); S.txt(m, ch.more, { size: 12.5, color: C.dim }); }
  });
  return f; };
// Flèches tracées une fois la mise en page calculée (second appel, positions réelles des nœuds).
S.edgesB = () => { const C = S.C; const f = penpot.currentPage.root.children.find(c => c.name === (S.mode === "light" ? "B3 · Graphe (clair)" : "B3 · Graphe"));
  const cv = penpotUtils.findShapes(s => s.name === "canvas", f)[0]; const old = penpotUtils.findShapes(s => s.name === "edges", cv); old.forEach(o => o.remove());
  const node = k => { const n = penpotUtils.findShapes(s => s.name === "node " + k, cv)[0]; return { x: n.x - cv.x, y: n.y - cv.y, w: n.width, h: n.height }; };
  const pairs = [["SILO-22", "SILO-23"], ["SILO-41", "SILO-43"], ["SILO-44", "SILO-46"], ["SILO-32", "SILO-33"], ["SILO-32", "SILO-34"], ["SILO-34", "SILO-35"], ["SILO-52", "SILO-53"], ["SILO-23", "SILO-52"]];
  let d = "";
  const head = (x, y, dir, col) => dir === "down" ? `<path d="M${x - 4},${y - 6} L${x},${y} L${x + 4},${y - 6}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M${x - 6},${y - 4} L${x},${y} L${x - 6},${y + 4}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (const [a, b] of pairs) { const A = node(a), B = node(b); const col = a === "SILO-32" ? C.mfg : C.faint;
    if (Math.abs(A.x - B.x) < 20 && B.y - (A.y + A.h) < 20) { const x = A.x + 24, y1 = A.y + A.h, y2 = B.y - 1; d += `<path d="M${x},${y1} L${x},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(x, y2, "down", col); }
    else if (Math.abs(A.x - B.x) < 20) { const xa = A.x - 7, ya = A.y + A.h / 2, yb = B.y + B.h / 2;
      d += `<path d="M${A.x},${ya} L${xa + 4},${ya} Q${xa},${ya} ${xa},${ya + 4} L${xa},${yb - 4} Q${xa},${yb} ${xa + 4},${yb} L${B.x - 1},${yb}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(B.x - 1, yb, "right", col); }
    else { const xs = A.x + A.w - 28, ys = A.y + A.h, low = 676, xg = B.x - 14 - 13, y2 = B.y + B.h / 2, r = 10;
      d += `<path d="M${xs},${ys} L${xs},${low - r} Q${xs},${low} ${xs + r},${low} L${xg - r},${low} Q${xg},${low} ${xg},${low - r} L${xg},${y2 + r} Q${xg},${y2} ${xg + r},${y2} L${B.x - 1},${y2}" stroke="${col}" stroke-width="1.5" fill="none" stroke-dasharray="5 4"/>` + head(B.x - 1, y2, "right", col); } }
  const W = cv.width, H = cv.height;
  const s = S.svg(cv, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">${d}</svg>`, "edges", { x: 0, y: 0 });
  return s.id; };
return "piste B ok";
