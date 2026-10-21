// Graphe simplifié (demande du 2026-10-20) : un sélecteur « Fonctionnalités | PRs » remplace Regrouper, Colonnes, Livrées repliées et Options.
// Trois boards clonés de « P5 · Graphe » (page « Proposition »), rangées après celle de l'alpha 3, sombre à x = 0, clair à x = 1 540.
const S = storage;
Object.assign(S.ICONS, {
  prDraft: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M18 6V5"/><path d="M18 11v-1"/><line x1="6" x2="6" y1="9" y2="21"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  pointer: '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>' });
S.Y_GR = S.Y_A3 + S.STEP27 * S.ROWS_A3.length;
S.ROWS_GR = ["g-fonctionnalites", "g-prs", "g-prs-vide"];
S.NAMES_GR = { "g-fonctionnalites": "P5b · Graphe, Fonctionnalités", "g-prs": "P5c · Graphe, PRs", "g-prs-vide": "P5e · Graphe, aucune PR" };
S.FEATS_GR = { F4: { title: "Saisir un constat hors ligne" }, F5: { title: "Envoyer les photos d'un constat" } };
S.PRS_GR = {
  22: { title: "Route d'envoi des photos", key: "SILO-32", feat: "F5", review: "waiting", ci: "ok", head: "feat/silo-32", base: "dev" },
  24: { title: "Écran d'envoi hors ligne", key: "SILO-33", feat: "F5", review: "draft", ci: "running", head: "feat/envoi-hors-ligne", base: "feat/silo-32", session: true },
  25: { title: "Tests E2E de l'envoi", key: "SILO-34", feat: "F5", review: "draft", ci: "ok", head: "feat/silo-34", base: "feat/envoi-hors-ligne" },
  20: { title: "Conflits de saisie", key: "SILO-45", feat: "F4", review: "changes", ci: "error", head: "feat/silo-45", base: "dev", session: true },
  23: { title: "Passage à Expo SDK 54", key: "SILO-61", feat: null, review: "waiting", ci: "running", head: "chore/expo-54", base: "dev" } };
S.STACKS_GR = [[22, 24, 25], [20], [23]];
S.COUNT_GR = "5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger";
S.REVIEW_GR = { draft: "Brouillon", waiting: "En attente de review", changes: "Changements demandés", approved: "Approuvée" };
S.CI_GR = { ok: ["circleCheck", "green", "CI verte"], error: ["circleX", "red", "CI rouge"], running: ["loader", "amber", "CI en cours"] };
S.drawGRk = {};

// ---------- Barre du haut : sélecteur de vue seul, compteur à droite ----------
S.viewSwitchGR = (active) => { const C = S.C;
  const s = S.row(null, { name: "view-switch", fill: C.muted, radius: 7, pad: 2, gap: 2 });
  for (const [label, icon] of [["Fonctionnalités", "package"], ["PRs", "pr"]]) { const on = label === active;
    const b = S.row(s, { name: "segment " + label, h: 21, pad: [0, 10], gap: 6, radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null });
    S.icon(b, icon, 13, on ? C.fg : C.mfg); S.txt(b, label, { size: 12.5, weight: 500, color: on ? C.fg : C.mfg }); }
  return s; };
S.toolbarGR = (f, active) => { const opts = S.parentOf(f, S.byText(f, "Options")), tb = S.parentOf(f, opts);
  for (const label of ["Regrouper : Fonctionnalités", "Colonnes : Sprints", "Livrées repliées", "Options"]) S.parentOf(f, S.byText(f, label)).remove();
  S.showFirst(tb, S.viewSwitchGR(active)); return tb; };
S.canvasGR = (f) => { const cv = S.named(f, "canvas"); for (const c of [...cv.children]) c.remove(); return cv; };
S.at0GR = (cv, s, x, y) => S.put(cv, s, { x, y });

// ---------- Puces d'une PR ----------
S.reviewChipGR = (p, review) => { const C = S.C, b = S.row(p, { name: "review " + review, gap: 5, pad: [2, 7], radius: 10, stroke: C.border });
  if (review === "draft") S.ring(b, C.dim, 7); else S.dot(b, review === "changes" ? C.red : C.purple, 7);
  S.txt(b, S.REVIEW_GR[review], { size: 11, weight: 500, color: review === "changes" ? C.red : C.mfg }); return b; };
S.ciChipGR = (p, ci) => { const C = S.C, [icon, tone, label] = S.CI_GR[ci], b = S.row(p, { name: "ci " + ci, gap: 4, pad: [2, 7], radius: 10, stroke: C.border });
  S.icon(b, icon, 12, C[tone]); S.txt(b, label, { size: 11, weight: 500, color: C.mfg }); return b; };
S.prIconGR = (p, pr, sz = 14) => S.icon(p, pr.review === "draft" ? "prDraft" : "pr", sz, pr.review === "draft" ? S.C.dim : S.C.green);
S.featLineGR = (p, pr) => { const C = S.C, r = S.row(p, { name: "ticket", fx: true, gap: 6 });
  S.chip(r, pr.key, { mono: true, size: 10.5, pad: [1, 5], color: C.fg });
  if (pr.feat) { S.icon(r, "package", 12, C.mfg); S.txt(r, `${pr.feat} · ${S.FEATS_GR[pr.feat].title}`, { size: 12, color: C.mfg }); }
  else S.txt(r, "Hors fonctionnalité", { size: 12, color: C.mfg });
  return r; };
S.markGR = (p, pr) => { const C = S.C;
  if (pr.late) { const m = S.row(p, { name: "late", gap: 4 }); S.icon(m, "clockAlert", 12, C.red); S.txt(m, "en retard", { size: 11, color: C.red }); }
  if (pr.session) { const m = S.row(p, { name: "session", gap: 5 }); S.dot(m, C.brand, 6); S.txt(m, "session", { size: 11, color: C.brandText }); } };

// ---------- P5c : piles de PR en arbre vertical, de la branche de base (en bas) à la PR la plus haute ----------
S.NODE_GR = { w: 364, h: 92, gap: 44, bottom: 760, rail: 790 };
S.nodeGR = (cv, n, x, y) => { const C = S.C, pr = S.PRS_GR[n], N = S.NODE_GR;
  const c = S.col(cv, { name: "pr #" + n, x, y, w: N.w, h: N.h, pad: [12, 12], gap: 9, radius: 8, fill: C.card, stroke: pr.review === "changes" ? C.red : C.border });
  const r1 = S.row(c, { fx: true, gap: 7 }); S.prIconGR(r1, pr); S.txt(r1, "#" + n, { size: 12.5, mono: true, color: C.mfg });
  S.txt(r1, pr.title, { size: 13, weight: 600 }); S.spacer(r1); S.markGR(r1, pr);
  S.featLineGR(c, pr);
  const r3 = S.row(c, { fx: true, gap: 5 }); S.reviewChipGR(r3, pr.review); S.ciChipGR(r3, pr.ci); S.spacer(r3);
  S.icon(r3, "branch", 11, C.dim); S.txt(r3, pr.head, { size: 10.5, mono: true, color: C.dim });
  return c; };
S.linkGR = (cv, x, y1, y2) => S.box(cv, { name: "base link", x: x - 1, y: y1, w: 2, h: y2 - y1, fill: S.C.faint });
S.legendGR = (cv) => { const C = S.C, lg = S.row(cv, { name: "legend", x: 16, y: 856, pad: [8, 12], gap: 14, radius: 8, fill: C.card, stroke: C.border });
  const item = (draw, label) => { const r = S.row(lg, { gap: 5 }); draw(r); S.txt(r, label, { size: 11.5, color: C.mfg }); };
  item(r => S.ring(r, C.dim, 8), "Brouillon"); item(r => S.dot(r, C.purple, 8), "En attente de review"); item(r => S.dot(r, C.red, 8), "Changements demandés"); item(r => S.dot(r, C.green, 8), "Approuvée");
  item(r => S.icon(r, "circleCheck", 12, C.green), "CI verte"); item(r => S.icon(r, "circleX", 12, C.red), "CI rouge"); item(r => S.icon(r, "loader", 12, C.amber), "CI en cours");
  item(r => S.box(r, { name: "link", w: 2, h: 12, fill: C.faint }), "Basée sur la PR du dessous"); item(r => S.dot(r, C.brand, 8), "Session active");
  item(r => S.icon(r, "pointer", 12, C.mfg), "Clic : fiche du ticket");
  return lg; };
S.headGR = (cv, x, title, sub) => { const C = S.C, h = S.col(cv, { name: "stack head", x, y: 12, gap: 2 });
  const r = S.row(h, { gap: 6 }); S.icon(r, "layers", 13, C.mfg); S.txt(r, title, { size: 13, weight: 600 }); S.txt(h, sub, { size: 11.5, color: C.dim }); return h; };
S.drawGRk["g-prs"] = (f) => { const C = S.C, N = S.NODE_GR;
  S.toolbarGR(f, "PRs"); S.setText(f, S.find29(f, z => z.type === "text" && z.characters.startsWith("9 fonctionnalités")).characters, S.COUNT_GR);
  const cv = S.canvasGR(f);
  S.box(cv, { name: "head line", x: 0, y: 50, w: cv.width, h: 1, fill: C.soft });
  const base = S.row(cv, { name: "base dev", x: 16, y: N.rail - 11, gap: 6, pad: [3, 9], radius: 11, fill: C.muted, stroke: C.border });
  S.icon(base, "branch", 12, C.fg); S.txt(base, "dev", { size: 11.5, mono: true, weight: 500 }); S.txt(base, "branche de base", { size: 11.5, color: C.mfg });
  S.box(cv, { name: "rail", x: 150, y: N.rail - 1, w: cv.width - 150 - 16, h: 2, fill: C.border });
  const colW = Math.floor((cv.width - 32) / S.STACKS_GR.length);
  S.STACKS_GR.forEach((stack, i) => { const x = 16 + i * colW + Math.round((colW - N.w) / 2), cx = x + N.w / 2;
    const n = stack.length, feats = [...new Set(stack.map(k => S.PRS_GR[k].feat))];
    S.headGR(cv, x, n > 1 ? `${n} PR empilées` : "1 PR", (feats[0] ? `${feats[0]} · ${S.FEATS_GR[feats[0]].title}` : "Hors fonctionnalité") + (n > 1 ? ` · #${stack[0]} à #${stack[n - 1]}` : ` · #${stack[0]}`));
    stack.forEach((k, j) => { const y = N.bottom - N.h - j * (N.h + N.gap); S.nodeGR(cv, k, x, y);
      S.linkGR(cv, cx, y + N.h, j === 0 ? N.rail : y + N.h + N.gap);
      if (j > 0) { const t = S.txt(null, "sur " + S.PRS_GR[k].base, { size: 10.5, mono: true, color: C.dim }); S.put(cv, t, { x: cx + 8, y: y + N.h + Math.round(N.gap / 2) - 7 }); } });
    const knot = S.dot(null, C.mfg, 8); S.put(cv, knot, { x: cx - 4, y: N.rail - 4 }); });
  S.legendGR(cv);
  return f; };

// ---------- P5e : aucune PR vivante, deux lignes centrées dans le canevas, ni rail ni légende ----------
S.EMPTY_GR = { title: "Aucune PR ouverte", hint: "Les PR ouvertes des étapes apparaissent ici, empilées sur leur branche de base." };
S.drawGRk["g-prs-vide"] = (f) => { const C = S.C;
  S.toolbarGR(f, "PRs"); S.setText(f, S.find29(f, z => z.type === "text" && z.characters.startsWith("9 fonctionnalités")).characters, "0 PR ouverte · 0 pile");
  const cv = S.canvasGR(f), e = S.col(cv, { name: "empty", x: 0, y: 410, w: cv.width, gap: 6, align: "center" });
  S.txt(e, S.EMPTY_GR.title, { size: 14, weight: 500, color: C.mfg }); S.txt(e, S.EMPTY_GR.hint, { size: 13, color: C.dim });
  return f; };

// ---------- P5b : Graphe par fonctionnalités, barre réduite au sélecteur, légende « En attente » après « Bloqué » (phase 31) ----------
S.legendHoldGR = (f) => { const lg = S.named(f, "legend"), blocked = S.parentOf(lg, S.byText(lg, "Bloqué")), item = S.showAfter(lg, blocked, blocked.clone());
  S.setText(item, "Bloqué", "En attente"); S.paint(item.children.find(c => c.type === "ellipse"), S.C.hold); return item; };
S.drawGRk["g-fonctionnalites"] = (f) => { S.toolbarGR(f, "Fonctionnalités"); S.legendHoldGR(f); return f; };

// ---------- Dessin (export : S.exportGR) ----------
S.drawGR = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_GR.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_GR + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen("P5 · Graphe", x, y), S.NAMES_GR[key]);
  const refonts = await S.withRefont(() => S.drawGRk[key](f)); await S.wait(600); const moved = S.replace();
  return { board: f.name, shapes: S.count(f), moved, refonts }; };
S.FILES_GR = { "P5b · Graphe, Fonctionnalités": "graphe-fonctionnalites", "P5c · Graphe, PRs": "graphe-prs", "P5e · Graphe, aucune PR": "graphe-prs-vide" };
S.exportGR = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_GR)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_GR[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
return "graphe prs ok";
