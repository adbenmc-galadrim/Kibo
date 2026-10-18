// Piste A · « Tableau de bord sobre » : dense, façon Linear. Barre latérale, panneau de l'agent de projet à droite.
const S = storage;
S.draw = S.draw || {};
S.card = (p, title, icon, o = {}) => { const C = S.C;
  const c = S.col(p, { name: "card/" + title, fx: !o.w, w: o.w, stroke: C.border, radius: 8, fill: C.card, clip: true });
  const h = S.row(c, { fx: true, h: 40, pad: [0, 14], gap: 8 }); S.icon(h, icon, 15, C.mfg); S.txt(h, title, { size: 13, weight: 600 });
  if (o.count) S.txt(h, o.count, { size: 12, mono: true, color: C.dim }); S.spacer(h); if (o.right) o.right(h);
  return c; };
S.cardRow = (c, o = {}) => { S.hline(c, S.C.soft); return S.row(c, { fx: true, pad: o.pad || [9, 14], gap: o.gap ?? 10, align: o.align || "center", h: o.h }); };
S.gitRef = (p, t, o = {}) => { const C = S.C; const r = S.row(p, { gap: 5 });
  if (t.git) S.icon(r, S.gitIcon[t.git], 13, S.gitColor(t.git)); else if (t.ref) S.icon(r, t.st === "Bloqué" ? "lock" : "link", 12, C.dim);
  if (!o.short || t.git) S.txt(r, t.git ? t.ref : (t.ref || "—"), { size: 12, mono: !!t.git, color: t.git ? C.fg : C.dim });
  if (t.git === "merged" && !o.short) S.txt(r, "fusionnée", { size: 12, color: C.dim });
  if (t.git === "changes" && !o.short) S.txt(r, "changements demandés", { size: 12, color: C.amber });
  if (t.ci === "ok") S.icon(r, "circleCheck", 12, C.green); if (t.ci === "ko") S.icon(r, "circleX", 12, C.red); if (t.ci === "run") S.ring(r, C.amber, 10, 2);
  return r; };
S.stepCell = (p, step, o = {}) => { const C = S.C; const r = S.row(p, { gap: 8, w: o.w, h: o.h });
  if (step == null) { S.txt(r, "—", { size: 12, color: C.faint }); return r; }
  S.segs(r, S.stepColors(step, { done: C.mfg, cur: step === 11 ? C.green : C.brand }), { w: o.sw || 4, h: o.sh || 10, gap: 1.5, radius: 1 });
  S.txt(r, S.stepLabel(step), { size: 12, color: C.mfg }); return r; };

// ---------- A1 · Vue d'ensemble ----------
S.draw["a-vue"] = (x, y) => { const C = S.C, D = S.D, P = D.project;
  const f = S.screen("A1 · Vue d'ensemble", x, y);
  const root = S.box(f, { name: "root", w: 1440, h: 960, dir: "row", align: "stretch" });
  S.sidebar(root, "Vue d'ensemble");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbar(main, ["Silo", "Vue d'ensemble"], t => { S.syncChip(t); S.btn(t, "Nouveau ticket", "outline", { sm: true, icon: "plus" }); S.agentButton(t, { on: true }); });
  const body = S.col(main, { fx: true, fy: true, pad: [20, 24], gap: 16 });
  const hd = S.row(body, { fx: true, gap: 12 });
  const ht = S.col(hd, { gap: 4 }); S.txt(ht, "Silo", { size: 22, weight: 600 });
  const hs = S.row(ht, { gap: 6 }); S.txt(hs, P.sub, { size: 12.5, color: C.mfg }); S.txt(hs, "·", { size: 12.5, color: C.faint });
  S.icon(hs, "github", 12, C.dim); S.txt(hs, P.repo, { size: 12, mono: true, color: C.dim }); S.icon(hs, "branch", 12, C.dim); S.txt(hs, P.base, { size: 12, mono: true, color: C.dim });
  S.spacer(hd); S.liveChip(hd, { text: "2 sessions actives · T3 Code" });

  const k = S.row(body, { name: "kpis", fx: true, h: 88, stroke: C.border, radius: 8, fill: C.card, align: "stretch" });
  const kpi = (icon, label, value, unit, sub) => { const c = S.col(k, { fx: true, pad: [12, 16], gap: 6 });
    const l = S.row(c, { gap: 6 }); S.icon(l, icon, 13, C.dim); S.txt(l, label, { size: 12, color: C.mfg });
    const v = S.row(c, { gap: 6, align: "end" }); S.txt(v, value, { size: 22, weight: 600 }); if (unit) S.txt(v, unit, { size: 12, color: C.dim });
    if (sub) sub(c); return c; };
  kpi("circleCheck", "Avancement", "60 %", "41/68 livrés", c => S.bar(c, 150, 41 / 68, { h: 4, color: C.green }));
  S.vline(k, C.soft);
  kpi("branch", "En cours", String(P.wip), "tickets", c => { const r = S.row(c, { gap: 6 }); S.dot(r, C.brand, 6); S.txt(r, "2 sessions full-delivery", { size: 11.5, color: C.dim }); });
  S.vline(k, C.soft);
  kpi("pr", "En review", String(P.review), "PR ouvertes", c => S.txt(c, "PR #20 à #23", { size: 11.5, color: C.dim }));
  S.vline(k, C.soft);
  kpi("question", "Questions", String(P.questions), "ouvertes", c => { const r = S.row(c, { gap: 6 }); S.dot(r, C.red, 6); S.txt(r, "1 bloquante", { size: 11.5, color: C.dim }); });
  S.vline(k, C.soft);
  kpi("lock", "Bloqués", String(P.blocked), "ticket", c => S.txt(c, "SILO-44 attend Q14", { size: 11.5, color: C.dim }));

  const cols = S.row(body, { fx: true, gap: 16, align: "start" });
  const left = S.col(cols, { fx: true, gap: 16 });
  const ens = S.card(left, "Ensembles", "layers", { count: "6", right: h => S.btn(h, "Graphe", "ghost", { sm: true, icon: "graph" }) });
  for (const s of D.sets.slice(2)) { const r = S.cardRow(ens);
    S.setChip(r, s.key); S.fillX(S.txt(r, s.title, { size: 13 }));
    S.bar(r, 90, s.done / s.total, { h: 4, color: s.done ? C.fg : C.track });
    S.txt(r, `${s.done}/${s.total}`, { size: 12, mono: true, color: C.mfg }); const d = S.row(r, { w: 92, justify: "end" }); S.txt(d, s.due, { size: 12, color: C.dim }); }
  { const r = S.cardRow(ens); S.icon(r, "circleCheck", 14, C.green); S.fillX(S.txt(r, "C0 et C1 livrés · 20 tickets", { size: 12.5, color: C.dim })); S.icon(r, "chevRight", 13, C.dim); }

  const rev = S.card(left, "En review", "pr", { count: "4", right: h => S.txt(h, "les plus anciennes d'abord", { size: 12, color: C.dim }) });
  for (const key of ["SILO-60", "SILO-41", "SILO-22", "SILO-32"]) { const t = S.tk(key), r = S.cardRow(rev, { align: "start" });
    S.icon(r, "pr", 14, S.gitColor(t.git)); S.txt(r, t.ref, { size: 12, mono: true, color: C.mfg });
    const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, t.title, { size: 13, fill: true }); const m = S.row(tc, { gap: 6 }); S.txt(m, t.key, { size: 11, mono: true, color: C.dim }); if (t.set) S.setChip(m, t.set);
    S.gitRef(m, { ci: t.ci }, { short: true });
    if (t.git === "changes") S.txt(m, "changements demandés", { size: 11, color: C.amber });
    else if (t.ci === "run") S.txt(m, "CI en cours", { size: 11, color: C.dim });
    const rc = S.col(r, { gap: 3, align: "end" }); S.txt(rc, t.step == null ? "sans étape" : S.stepLabel(t.step), { size: 12, color: t.step == null ? C.faint : C.mfg }); S.txt(rc, t.upd, { size: 11, color: C.dim }); }

  const go = S.card(left, "Prêts à démarrer", "flag", { count: "3", right: h => S.txt(h, "à lancer dans T3 Code", { size: 12, color: C.dim }) });
  for (const [key, set, title] of [["SILO-46", "C3", "Recherche d'un box par numéro"], ["SILO-35", "C4", "Purge des fichiers orphelins"], ["SILO-61", "C4", "Compresser les photos avant envoi"]]) {
    const r = S.cardRow(go); S.setChip(r, set); S.fillX(S.txt(r, title, { size: 13 }));
    const cmd = S.row(r, { gap: 6, pad: [3, 8], radius: 5, fill: C.muted }); S.txt(cmd, "/full-delivery " + key, { size: 11, mono: true, color: C.mfg }); S.icon(cmd, "copy", 12, C.dim); }

  const right = S.col(cols, { w: 300, gap: 16 });
  const act = S.card(right, "Activité", "activity", { right: h => { S.chip(h, "git", { size: 10.5 }); S.chip(h, "full-delivery", { size: 10.5 }); } });
  for (const a of D.activity.slice(0, 7)) { const r = S.cardRow(act, { align: "start", pad: [9, 14], gap: 10 });
    const ic = S.box(r, { w: 24, h: 24, radius: 12, fill: a.src === "agent" ? C.brandSoft : C.muted, dir: "row", align: "center", justify: "center" });
    S.icon(ic, a.icon, 13, a.src === "agent" ? C.brand : a.color ? C[a.color] : C.mfg);
    const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, a.text, { size: 12.5, fill: true });
    const m = S.row(tc, { gap: 5 }); if (a.tk) S.txt(m, a.tk, { size: 11, mono: true, color: C.dim }); if (a.res) { S.icon(m, "arrowRight", 10, C.dim); S.status(m, a.res, 6); S.txt(m, a.res, { size: 11, color: C.dim }); }
    if (!a.tk) S.txt(m, "Agent de projet", { size: 11, color: C.brandText });
    S.txt(r, a.t, { size: 11, mono: true, color: C.dim }); }
  const qs = S.card(right, "Questions ouvertes", "question", { count: "3" });
  for (const q of D.questions) { const r = S.cardRow(qs, { align: "start" });
    const tc = S.col(r, { fx: true, gap: 3 }); S.txt(tc, q.text, { size: 12.5, fill: true });
    const m = S.row(tc, { gap: 5 }); S.txt(m, `${q.id} · ${q.ticket} · ${q.to} · ${q.age}`, { size: 11, color: C.dim });
    if (q.blocking) S.chip(r, "bloquante", { color: C.red, stroke: null, fill: C.redSoft, size: 10.5 }); }

  S.vline(root, C.soft);
  S.agentPanelA(root);
  return f; };

S.agentPanelA = (root) => { const C = S.C, D = S.D;
  const ap = S.col(root, { name: "agent-panel", w: 360, fy: true, fill: C.panel });
  const h = S.row(ap, { fx: true, h: 56, pad: [0, 16], gap: 10 }); S.agentMark(h, 28);
  const ht = S.col(h, { gap: 1 }); S.txt(ht, "Agent de projet", { size: 13, weight: 600 }); S.txt(ht, "Suivi à jour · il y a 4 min", { size: 11.5, color: C.dim });
  S.spacer(h); S.icon(h, "more", 15, C.dim); S.icon(h, "x", 15, C.dim);
  S.hline(ap, C.soft);
  const b = S.col(ap, { fx: true, fy: true, pad: 16, gap: 14 });
  S.txt(b, "Depuis ce matin", { size: 11, weight: 500, color: C.dim, upper: true, ls: 0.4 });
  S.txt(b, "Trois tickets ont avancé sans toi : PR #22 ouverte, PR #18 fusionnée, SILO-23 démarré. SILO-44 reste bloqué : le client n'a pas répondu à Q14.", { size: 13, lh: 1.5, color: C.fg, fill: true });
  const lot = S.col(b, { fx: true, stroke: C.brandLine, radius: 8, clip: true, fill: C.card });
  const lh = S.row(lot, { fx: true, pad: [9, 12], gap: 8, fill: C.brandSoft }); S.txt(lh, `Lot n° ${D.lot.n} · à valider`, { size: 12.5, weight: 600, color: C.brandText }); S.spacer(lh); S.txt(lh, "3 actions", { size: 11.5, color: C.dim });
  for (const it of D.lot.items) { S.hline(lot, C.soft); const r = S.row(lot, { fx: true, pad: [9, 12], gap: 10, align: "start" });
    const cb = S.box(r, { w: 15, h: 15, radius: 4, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(cb, "check", 11, "#FFFFFF", 3);
    const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, it.text, { size: 12.5, fill: true }); S.txt(tc, it.meta, { size: 11, color: C.dim }); }
  S.hline(lot, C.soft);
  const lf = S.row(lot, { fx: true, pad: [10, 12], gap: 8 }); S.btn(lf, "Valider (3)", "brand", { sm: true }); S.btn(lf, "Refuser", "outline", { sm: true }); S.spacer(lf); S.txt(lf, "Voir le détail", { size: 12, color: C.mfg });
  const note = S.row(b, { fx: true, gap: 8, align: "start" }); S.icon(note, "refresh", 13, C.dim);
  S.txt(note, "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.", { size: 11.5, color: C.dim, lh: 1.45, fill: true });
  S.box(b, { w: 4, h: 4, fy: true });
  const inp = S.row(b, { fx: true, h: 40, pad: [0, 12], gap: 8, radius: 8, stroke: C.border, fill: C.bg }); S.txt(inp, "Demander à l'agent de projet…", { size: 12.5, color: C.dim }); S.spacer(inp); S.icon(inp, "send", 14, C.dim);
  return ap; };

// ---------- A2 · Tickets ----------
S.draw["a-tickets"] = (x, y) => { const C = S.C, D = S.D, P = D.project;
  const f = S.screen("A2 · Tickets", x, y);
  const root = S.box(f, { name: "root", w: 1440, h: 960, dir: "row", align: "stretch" });
  S.sidebar(root, "Tickets");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbar(main, ["Silo", "Tickets"], t => { S.syncChip(t); S.agentButton(t, { count: "3" }); });
  const body = S.col(main, { fx: true, fy: true, pad: [20, 24], gap: 14 });
  const hd = S.row(body, { fx: true, gap: 10, align: "end" }); S.txt(hd, "Tickets", { size: 22, weight: 600 });
  S.txt(hd, "27 ouverts · 41 terminés · ensembles en puce", { size: 12.5, color: C.dim }); S.spacer(hd); S.btn(hd, "Nouveau ticket", "default", { sm: true, icon: "plus" });
  const fr = S.row(body, { fx: true, gap: 8 });
  const seg = S.row(fr, { pad: 2, radius: 7, fill: C.muted, gap: 2 });
  for (const [l, n, on] of [["Ouverts", "27", true], ["En review", "4"], ["Terminés", "41"], ["Tous", "68"]]) {
    const s = S.row(seg, { pad: [4, 10], gap: 6, radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : C.mfg }); S.txt(s, n, { size: 11, mono: true, color: C.dim }); }
  S.spacer(fr);
  S.btn(fr, "Ensemble", "outline", { sm: true, icon: "layers" }); S.btn(fr, "État git", "outline", { sm: true, icon: "branch" }); S.btn(fr, "Étiquettes", "outline", { sm: true, icon: "filter" }); S.btn(fr, "Activité récente", "outline", { sm: true, icon: "sort" });
  const sr = S.row(fr, { w: 200, h: 30, pad: [0, 10], gap: 8, radius: 6, stroke: C.border }); S.icon(sr, "search", 13, C.dim); S.txt(sr, "Filtrer", { size: 12.5, color: C.dim });

  const W = { key: 84, set: 60, st: 112, git: 230, step: 196, upd: 96 };
  const tb = S.col(body, { fx: true, stroke: C.border, radius: 8, clip: true, fill: C.card });
  const th = S.row(tb, { fx: true, h: 34, pad: [0, 14], gap: 12, fill: C.panel });
  const hc = (l, w) => { const c = S.row(th, { w, fx: !w }); S.txt(c, l, { size: 11.5, weight: 500, color: C.dim }); };
  hc("Clé", W.key); hc("Titre"); hc("Ensemble", W.set); hc("État", W.st); hc("Git et PR", W.git); hc("Livraison", W.step); hc("Mis à jour", W.upd);
  for (const t of D.tickets.filter(t => t.st !== "Terminé")) { S.hline(tb, C.soft);
    const r = S.row(tb, { fx: true, h: 40, pad: [0, 14], gap: 12 });
    const kc = S.row(r, { w: W.key }); S.txt(kc, t.key, { size: 12, mono: true, color: C.mfg });
    const tc = S.row(r, { fx: true, gap: 8 }); S.txt(tc, t.title, { size: 13 }); if (t.live) S.liveChip(tc, { text: "session" });
    const sc = S.row(r, { w: W.set }); if (t.set) S.setChip(sc, t.set); else S.txt(sc, "—", { size: 12, color: C.faint });
    const st = S.row(r, { w: W.st, gap: 7 }); S.status(st, t.st, 8); S.txt(st, t.st, { size: 12.5, color: C.fg });
    const gc = S.row(r, { w: W.git }); S.gitRef(gc, t);
    S.stepCell(r, t.step, { w: W.step });
    const u = S.row(r, { w: W.upd }); S.txt(u, t.upd, { size: 12, color: C.dim }); }
  S.hline(tb, C.soft);
  { const g = S.row(tb, { fx: true, h: 34, pad: [0, 14], gap: 8, fill: C.panel }); S.icon(g, "chevDown", 13, C.dim); S.status(g, "Terminé", 8); S.txt(g, "Terminés récemment", { size: 12, weight: 500, color: C.mfg }); S.txt(g, "2 sur 41", { size: 11, mono: true, color: C.dim }); }
  for (const t of D.tickets.filter(t => t.st === "Terminé")) { S.hline(tb, C.soft);
    const r = S.row(tb, { fx: true, h: 40, pad: [0, 14], gap: 12 });
    const kc = S.row(r, { w: W.key }); S.txt(kc, t.key, { size: 12, mono: true, color: C.dim });
    const tc = S.row(r, { fx: true }); S.txt(tc, t.title, { size: 13, color: C.mfg });
    const sc = S.row(r, { w: W.set }); S.setChip(sc, t.set);
    const st = S.row(r, { w: W.st, gap: 7 }); S.status(st, t.st, 8); S.txt(st, t.st, { size: 12.5, color: C.mfg });
    const gc = S.row(r, { w: W.git }); S.gitRef(gc, t);
    S.stepCell(r, t.step, { w: W.step });
    const u = S.row(r, { w: W.upd }); S.txt(u, t.upd, { size: 12, color: C.dim }); }
  const ft = S.row(body, { fx: true, gap: 8 }); S.icon(ft, "refresh", 13, C.dim);
  S.txt(ft, "États tirés de git : branche poussée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step.", { size: 11.5, color: C.dim });
  return f; };

// ---------- Graphe (commun aux pistes A et B : même topologie, style différent) ----------
S.GRAPH = {
  compact: [{ key: "C0", title: "Socle et déploiement", n: "12/12", c: 0, r: 0 }, { key: "C1", title: "Connexion et comptes", n: "8/8", c: 0, r: 1 }],
  frames: [
    { key: "C2", title: "Périmètre et affectations", n: "4/6", cols: [1, 2], rows: [1, 1], doneN: 4 },
    { key: "C3", title: "Saisie des box et constats", n: "9/14", cols: [1, 2], rows: [3, 4], doneN: 9 },
    { key: "C4", title: "Fichiers et photos", n: "1/5", cols: [3, 4], rows: [1, 2], doneN: 1 },
    { key: "C5", title: "Rapports de centre", n: "0/6", cols: [3, 4], rows: [3.8, 3.8], more: "+ 4 tickets" } ],
  nodes: [
    { key: "SILO-22", c: 1, r: 1 }, { key: "SILO-23", c: 2, r: 1 },
    { key: "SILO-41", c: 1, r: 3 }, { key: "SILO-43", c: 2, r: 3 }, { key: "SILO-44", c: 1, r: 4 }, { key: "SILO-46", c: 2, r: 4 },
    { key: "SILO-32", c: 3, r: 1 }, { key: "SILO-33", c: 4, r: 1 }, { key: "SILO-34", c: 3, r: 2 }, { key: "SILO-35", c: 4, r: 2 },
    { key: "SILO-52", c: 3, r: 3.8 }, { key: "SILO-53", c: 4, r: 3.8, title: "Export des rapports au client", st: "À faire" },
    { key: "SILO-60", c: 0, r: 4.3, w: 176 } ],
  edges: [["C0", "C2"], ["C1", "C2"], ["C1", "C3"], ["SILO-22", "SILO-23"], ["SILO-41", "SILO-43"], ["SILO-44", "SILO-46"],
    ["SILO-32", "SILO-33"], ["SILO-32", "SILO-34"], ["SILO-34", "SILO-35"], ["SILO-23", "SILO-52"], ["SILO-52", "SILO-53"], ["C4", "C5"]],
};
// Géométrie : colonnes et rangées → coordonnées dans le canevas.
S.graphGeom = (g) => { const xs = [24, g.x1, g.x1 + g.nw + g.gx, g.x1 + 2 * (g.nw + g.gx) + g.fgap, g.x1 + 3 * (g.nw + g.gx) + g.fgap];
  return { x: c => xs[c], y: r => g.y0 + r * g.rh }; };
S.edgesSvg = (W, H, segs, o = {}) => { const C = S.C;
  let d = ""; let heads = "";
  for (const [x1, y1, x2, y2, dashed, strong] of segs) {
    const mx = (x1 + x2) / 2, vertical = Math.abs(x2 - x1) < 40;
    const path = vertical ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    const col = strong ? C.mfg : (o.color || C.faint);
    d += `<path d="${path}" fill="none" stroke="${col}" stroke-width="${o.sw || 1.5}"${dashed ? ' stroke-dasharray="4 4"' : ""}/>`;
    const a = vertical ? `M${x2 - 4},${y2 - 7} L${x2},${y2} L${x2 + 4},${y2 - 7}` : `M${x2 - 7},${y2 - 4} L${x2},${y2} L${x2 - 7},${y2 + 4}`;
    heads += `<path d="${a}" fill="none" stroke="${col}" stroke-width="${o.sw || 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">${d}${heads}</svg>`; };

S.nodeA = (cv, t, x, y, w) => { const C = S.C;
  const n = S.col(cv, { name: "node/" + t.key, x, y, w, pad: [8, 10], gap: 5, radius: 8, stroke: t.live ? C.brandLine : C.border, fill: C.card, vs: "auto" });
  const r = S.row(n, { fx: true, gap: 6 }); S.status(r, t.st, 8); S.txt(r, t.key, { size: 11, mono: true, color: C.mfg }); S.spacer(r);
  if (t.live) S.dot(r, C.brand, 6);
  if (t.git) { S.icon(r, S.gitIcon[t.git], 12, S.gitColor(t.git)); S.txt(r, t.git === "branch" ? "branche" : t.ref, { size: 11, mono: true, color: C.dim }); }
  S.txt(n, t.title, { size: 12.5, fill: true });
  if (t.step != null && t.st !== "Terminé") { const s = S.row(n, { gap: 6 }); S.segs(s, S.stepColors(t.step), { w: 3, h: 8, gap: 1.5, radius: 1 }); S.txt(s, S.stepLabel(t.step), { size: 11, color: C.dim }); }
  return n; };

S.draw["a-graphe"] = async (x, y) => { const C = S.C, G = S.GRAPH;
  const f = S.screen("A3 · Graphe", x, y);
  const root = S.box(f, { name: "root", w: 1440, h: 960, dir: "row", align: "stretch" });
  S.sidebar(root, "Graphe");
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbar(main, ["Silo", "Graphe"], t => { S.syncChip(t); S.agentButton(t, { count: "3" }); });
  const tb = S.row(main, { fx: true, h: 48, pad: [0, 16], gap: 8 });
  S.btn(tb, "Regrouper : Ensembles", "outline", { sm: true, icon: "layers" }); S.btn(tb, "Terminés repliés", "outline", { sm: true, icon: "circleCheck" }); S.btn(tb, "Démarrables · 3", "outline", { sm: true, icon: "flag" });
  S.spacer(tb); S.txt(tb, "27 tickets ouverts · 4 ensembles en cours", { size: 12, color: C.dim });
  S.hline(main, C.soft);
  const cv = S.box(main, { name: "canvas", w: 1199, h: 863, fill: C.canvas, fx: true, fy: true, clip: true });
  const g = { x1: 236, nw: 204, gx: 24, fgap: 30, y0: 0, rh: 110 }; const geo = S.graphGeom(g);
  const pos = {}, NH = 66;
  for (const fr of G.frames) { const fx = geo.x(fr.cols[0]) - 14, fy = geo.y(fr.rows[0]) + 6 - 46;
    const fw = geo.x(fr.cols[1]) + g.nw + 14 - fx, fh = geo.y(fr.rows[1]) + 6 + NH + 14 - fy;
    const b = S.box(cv, { name: "frame/" + fr.key, x: fx, y: fy, w: fw, h: fh, radius: 10, stroke: C.border, dashed: true, fill: null });
    const t = S.row(cv, { name: "frame-title", x: fx + 14, y: fy + 12, gap: 8 }); S.setChip(t, fr.key); S.txt(t, fr.title, { size: 12.5, weight: 600 });
    S.txt(t, fr.n, { size: 12, mono: true, color: C.mfg }); S.bar(t, 60, (parseInt(fr.n) || 0) / parseInt(fr.n.split("/")[1]), { h: 3, color: C.fg });
    if (fr.doneN) { const p = S.row(cv, { x: fx + fw - 120, y: fy + 10, pad: [3, 8], gap: 6, radius: 10, fill: C.muted }); S.icon(p, "circleCheck", 12, C.green); S.txt(p, `${fr.doneN} terminé${fr.doneN > 1 ? "s" : ""}`, { size: 11, color: C.mfg }); }
    if (fr.more) { const p = S.row(cv, { x: fx + fw - 110, y: fy + 10, pad: [3, 8], radius: 10, fill: C.muted }); S.txt(p, fr.more, { size: 11, color: C.mfg }); }
    pos[fr.key] = { x: fx, y: fy, w: fw, h: fh }; }
  for (const c of G.compact) { const cx = geo.x(0), cy = geo.y(c.r * 1.1 + 0.4);
    const b = S.col(cv, { name: "compact/" + c.key, x: cx, y: cy, w: 176, pad: [9, 12], gap: 4, radius: 8, stroke: C.border, dashed: true, fill: C.card });
    const r = S.row(b, { gap: 6 }); S.setChip(r, c.key); S.txt(r, c.n, { size: 11.5, mono: true, color: C.mfg }); S.icon(r, "circleCheck", 12, C.green);
    S.txt(b, c.title, { size: 12, color: C.mfg }); pos[c.key] = { x: cx, y: cy, w: 176, h: 56 }; }
  for (const nd of G.nodes) { const t = { ...(S.tk(nd.key) || { key: nd.key, title: nd.title, st: nd.st }) }; const nx = geo.x(nd.c), ny = geo.y(nd.r) + 6;
    pos[nd.key] = { x: nx, y: ny, w: nd.w || g.nw, h: NH, node: t }; }
  { const p = pos["SILO-60"]; const l = S.row(cv, { x: p.x, y: p.y - 24, gap: 6 }); S.txt(l, "Hors ensemble", { size: 11, weight: 500, color: C.dim, upper: true, ls: 0.4 }); }
  const segs = G.edges.map(([a, b]) => { const A = pos[a], B = pos[b]; const vertical = Math.abs(A.x - B.x) < 40 && !A.node === !B.node;
    if (vertical) return [A.x + A.w / 2, A.y + A.h, B.x + B.w / 2, B.y - 2, !A.node && !S.GRAPH.compact.find(c => c.key === a), a === "SILO-32"];
    return [A.x + A.w, A.y + Math.min(A.h, NH) / 2, B.x - 2, B.y + Math.min(B.h, NH) / 2, !A.node && !S.GRAPH.compact.find(c => c.key === a), a === "SILO-32"]; });
  S.svg(cv, S.edgesSvg(1199, 863, segs), "edges", { x: 0, y: 0 });
  for (const nd of G.nodes) { const p = pos[nd.key]; const n = S.nodeA(cv, p.node, p.x, p.y, p.w); if (nd.key === "SILO-32") n.strokes = [{ strokeColor: C.fg, strokeWidth: 1.5, strokeAlignment: "inner", strokeOpacity: 1 }]; }
  // Légende, zoom et minicarte
  const lg = S.row(cv, { name: "legend", x: 16, y: 863 - 52, pad: [8, 12], gap: 14, radius: 8, stroke: C.border, fill: C.card });
  for (const st of ["À faire", "En cours", "En review", "Bloqué"]) { const r = S.row(lg, { gap: 6 }); S.status(r, st, 8); S.txt(r, st, { size: 11.5, color: C.mfg }); }
  { const r = S.row(lg, { gap: 6 }); S.box(r, { w: 14, h: 10, radius: 3, stroke: C.mfg, dashed: true }); S.txt(r, "Ensemble", { size: 11.5, color: C.mfg }); }
  { const r = S.row(lg, { gap: 6 }); S.dot(r, C.brand, 7); S.txt(r, "Session active", { size: 11.5, color: C.mfg }); }
  const z = S.col(cv, { name: "zoom", x: 1199 - 52, y: 863 - 176, pad: 4, gap: 2, radius: 8, stroke: C.border, fill: C.card });
  for (const ic of ["zoomIn", "zoomOut", "maximize"]) { const b = S.box(z, { w: 28, h: 28, radius: 6, dir: "row", align: "center", justify: "center" }); S.icon(b, ic, 15, C.mfg); }
  const mm = S.box(cv, { name: "minimap", x: 1199 - 196, y: 863 - 72, w: 132, h: 56, radius: 6, stroke: C.border, fill: C.card });
  for (const [mx, my, mw, mh] of [[8, 8, 50, 16], [8, 30, 50, 18], [64, 8, 56, 22], [64, 34, 56, 14]]) S.box(mm, { x: mx, y: my, w: mw, h: mh, radius: 2, stroke: C.faint, dashed: true });
  S.box(mm, { x: 4, y: 4, w: 90, h: 46, radius: 3, stroke: C.mfg });
  return f; };
return "piste A ok";
