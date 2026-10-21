// Phase 31 (spec §45) : « P5b · Graphe · en attente », clone de « P5b · Graphe, Fonctionnalités » au 16 oct. du scénario silo-graphe
// (silo-attente, puis F1 renommée). Étapes en attente en cyan, à leur place ; F4 livrée ne garde que son étape en attente. Rangée après P8g.
const S = storage;
S.Y_GA = S.Y_AP + S.STEP27 * S.ROWS_AP.length;
S.ROWS_GA = ["g-attente"];
S.NAMES_GA = { "g-attente": "P5b · Graphe · en attente" };
S.FILES_GA = { "P5b · Graphe · en attente": "attente-graphe" };
S.F1_GA = "Connexion, environnements et hébergement";
S.LAYOUT_GA = { firstY: 70, stack: 30, anchor: 38, f1: 96, f4: 96, f4w: 212 };
S.EDGES_GA = [["F2", "F3"], ["F2", "F4"], ["F3", "F5"], ["F2", "F6"], ["F4", "F8"], ["F4", "F7"], ["F5", "F7"], ["F7", "F9"]];

// ---------- Cadre : en-tête « n/m ⏸ k ✓ », segments, lignes d'étape ----------
S.frameGA = (f, k) => S.named(f, "frame " + k);
S.headGA = (fr) => fr.children.find(c => c.name === "box" && c.children.some(x => x.type === "text" && /^\d+\/\d+$/.test(x.characters)));
S.countGA = (fr, to) => { const head = S.headGA(fr), count = head.children.find(x => x.type === "text" && /^\d+\/\d+$/.test(x.characters));
  S.setText(head, count.characters, to); return { head, count }; };
S.heldHeadGA = (fr, count, n, delivered) => { const C = S.C, { head, count: t } = S.countGA(fr, count);
  const mark = S.showAfter(head, t, S.row(null, { name: "held", gap: 2 })); S.icon(mark, "pause", 11, C.hold); S.txt(mark, String(n), { size: 11, mono: true, color: C.hold });
  if (delivered) S.showAfter(head, mark, S.icon(null, "circleCheck", 12, C.green)); return head; };
S.stepRowGA = (fr, title) => S.parentOf(fr, S.byText(fr, title));
S.holdRowGA = (fr, title) => { const C = S.C, row = S.stepRowGA(fr, title), status = S.shown(row)[0];
  status.strokes = []; S.paint(status, C.hold); status.name = "dot";
  const git = row.children.find(c => c.name.replace(/\s/g, "").startsWith("icon/")), pause = S.icon(null, "pause", 11, C.hold);
  if (git) S.showBefore(row, git, pause); else S.showLast(row, pause); return row; };
S.segsGA = (fr, held, w) => { const all = S.shown(S.named(fr, "segs"));
  for (const i of held) S.paint(all[i], S.C.hold); if (w) for (const c of all) c.resize(w, c.height); return all; };

// ---------- Flèches entre fonctionnalités : ancrées à 38 px du haut des cadres, sous les cadres ----------
S.edgesGA = (f) => { const cv = S.named(f, "canvas"), old = S.named(cv, "edges"), first = penpotUtils.findShapes(s => s.type === "path", old)[0];
  const col = first.strokes[0].strokeColor, A = S.LAYOUT_GA.anchor;
  const box = (k) => { const n = S.frameGA(cv, k); return { x: Math.round(n.x - cv.x), y: Math.round(n.y - cv.y), w: Math.round(n.width) }; };
  const head = (x, y) => `<path d="M${x - 7},${y - 4} L${x},${y} L${x - 7},${y + 4}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  let d = "";
  for (const [a, b] of S.EDGES_GA) { const P = box(a), Q = box(b), y1 = P.y + A, y2 = Q.y + A, x2 = Q.x - 1;
    if (Math.abs(P.x - Q.x) < 20) { const cx = P.x - 16; d += `<path d="M${P.x},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(x2, y2); continue; }
    const x1 = P.x + P.w, mx = Math.round((x1 + x2) / 2); d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(x2, y2); }
  old.remove();
  const s = S.svg(cv, `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.width}" height="${cv.height}" viewBox="0 0 ${cv.width} ${cv.height}" fill="none">${d}</svg>`, "edges", { x: 0, y: 0 });
  const idx = cv.children.findIndex(c => c.name && c.name.startsWith("frame ")); if (idx >= 0) cv.insertChild(idx, s); return s; };

// ---------- P5b · Graphe · en attente ----------
S.drawGAk = {};
S.drawGAk["g-attente"] = (f) => { const C = S.C, L = S.LAYOUT_GA, cv = S.named(f, "canvas");
  const f1 = S.frameGA(f, "F1"), t1 = f1.children.find(c => c.type === "text"); S.setText(f1, t1.characters, S.F1_GA); t1.resize(t1.width, 45);
  S.frameGA(f, "F2").y = cv.y + L.firstY + L.f1 + L.stack;
  const f4 = S.frameGA(f, "F4");
  for (const title of ["Schéma local des constats", "Formulaire de saisie", "Synchro au retour du réseau", "Démo client"]) S.stepRowGA(f4, title).remove();
  f4.resize(L.f4w, f4.height); f4.flex.verticalSizing = "auto"; S.holdRowGA(f4, "Conflits de saisie"); S.heldHeadGA(f4, "3/4", 1, true);
  S.segsGA(f4, [3], Math.floor((L.f4w - 20 - 4 * 3) / 5));
  const f5 = S.frameGA(f, "F5"); S.parentOf(f5, S.byText(f5, "en retard · glisse en S43")).remove(); f5.strokes = f4.strokes;
  for (const title of ["Écran d'envoi hors ligne", "Tests E2E de l'envoi", "Démo client"]) S.holdRowGA(f5, title);
  S.heldHeadGA(f5, "1/2", 3, false); S.segsGA(f5, [2, 3, 4]);
  f5.y = f4.y + L.f4 + L.stack;
  const f7 = S.frameGA(f, "F7"); S.holdRowGA(f7, "Génération PDF"); S.heldHeadGA(f7, "0/4", 1, false); S.segsGA(f7, [1]);
  return f; };
S.drawGA = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_GA.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_GA + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen("P5b · Graphe, Fonctionnalités", x, y), S.NAMES_GA[key]);
  const refonts = await S.withRefont(() => S.drawGAk[key](f)); await S.wait(600); const moved = S.replace();
  return { board: f.name, shapes: S.count(f), moved, refonts }; };
S.edgesDrawGA = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const f = penpot.currentPage.root.children.find(c => c.name === (mode === "light" ? S.NAMES_GA[key] + " (clair)" : S.NAMES_GA[key]));
  return S.edgesGA(f).id; };
S.exportGA = async () => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_GA)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_GA[base];
    if (!file) continue; const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
return "graphe attente ok";
