// Page « 28c · Graphe » : graphe lisible (spec §26.8 et §26.9), écrans 188 à 188d et pastille « Démarrable » du Kanban. Requiert 18-socle.js et 24-socle-suite.js.
// Données inventées dans l'esprit de design/donnees-fictives.md : projet de la taille d'Emis (69 tickets, chapitres C0 à C9, 31 terminés, ~60 liens blocks).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "28c · Graphe";
const { find, wait, abs, select, appScreen, kanbanAt, menu } = S.fx;
const { iconButton } = S.fx2;

// ---------- Données : tickets ouverts par vague ----------
const W = [
  [["KIB-38", "Recherche plein texte", "En cours", "C3"], ["KIB-42", "Agenda : vue semaine", "En cours", "C4"], ["KIB-47", "Notifications push", "En cours", "C5"], ["KIB-51", "Partage d'une tâche", "En cours", "C5"],
    ["KIB-44", "Filtres de la liste", "À faire", "C4", 1], ["KIB-53", "Étiquettes colorées", "À faire", "C5", 1], ["KIB-56", "Import CSV", "Backlog", "C6", 1], ["KIB-60", "Thème clair", "À faire", "C6", 1],
    ["KIB-63", "Raccourcis clavier", "Backlog", "C7", 1], ["KIB-66", "Page À propos", "Backlog", "C8", 1]],
  [["KIB-39", "Index de recherche", "À faire", "C3"], ["KIB-43", "Agenda : vue mois", "À faire", "C4"], ["KIB-45", "Tri personnalisé", "Backlog", "C4"], ["KIB-48", "Rappels programmés", "À faire", "C5"],
    ["KIB-52", "Commentaires", "Backlog", "C5"], ["KIB-54", "Mode hors ligne", "À faire", "C6"], ["KIB-57", "Export PDF", "Backlog", "C6"], ["KIB-61", "Accessibilité clavier", "Backlog", "C7"], ["KIB-64", "Onboarding", "À faire", "C7"]],
  [["KIB-40", "Suggestions de recherche", "Backlog", "C3"], ["KIB-46", "Glisser-déposer agenda", "Backlog", "C4"], ["KIB-49", "Résumé quotidien", "Backlog", "C5"], ["KIB-50", "Préférences de notification", "Backlog", "C5"],
    ["KIB-55", "Synchro différée", "Backlog", "C6"], ["KIB-58", "Pièces jointes", "Backlog", "C6"], ["KIB-62", "Audit accessibilité", "Bloqué", "C7"], ["KIB-65", "Tutoriel interactif", "Backlog", "C7"]],
  [["KIB-41", "Historique de recherche", "Backlog", "C3"], ["KIB-70", "Widget iOS", "Backlog", "C9"], ["KIB-71", "Widget Android", "Backlog", "C9"], ["KIB-59", "Résolution des conflits", "Backlog", "C6"],
    ["KIB-67", "Paiement in-app", "Backlog", "C8"], ["KIB-68", "Abonnement famille", "Backlog", "C8"]],
  [["KIB-72", "Montre connectée", "Backlog", "C9"], ["KIB-73", "Publication App Store", "Backlog", "C9"], ["KIB-74", "Publication Play Store", "Backlog", "C9"], ["KIB-69", "Facturation annuelle", "Backlog", "C8"], ["KIB-75", "Page de lancement", "Backlog", "C9"]]];
const LINKS = [["KIB-42", "KIB-43"], ["KIB-44", "KIB-45"], ["KIB-42", "KIB-45"], ["KIB-47", "KIB-48"], ["KIB-51", "KIB-52"], ["KIB-53", "KIB-52"], ["KIB-56", "KIB-54"], ["KIB-56", "KIB-57"], ["KIB-63", "KIB-61"],
  ["KIB-60", "KIB-64"], ["KIB-66", "KIB-64"], ["KIB-38", "KIB-39"], ["KIB-43", "KIB-46"], ["KIB-48", "KIB-49"], ["KIB-54", "KIB-55"], ["KIB-57", "KIB-58"], ["KIB-52", "KIB-58"], ["KIB-61", "KIB-62"],
  ["KIB-64", "KIB-65"], ["KIB-39", "KIB-40"], ["KIB-48", "KIB-50"], ["KIB-55", "KIB-59"], ["KIB-65", "KIB-67"], ["KIB-65", "KIB-68"], ["KIB-49", "KIB-70"], ["KIB-49", "KIB-71"], ["KIB-40", "KIB-41"],
  ["KIB-68", "KIB-69"], ["KIB-67", "KIB-69"], ["KIB-70", "KIB-72"], ["KIB-70", "KIB-73"], ["KIB-62", "KIB-73"], ["KIB-71", "KIB-74"], ["KIB-62", "KIB-74"], ["KIB-67", "KIB-75"], ["KIB-68", "KIB-75"]];
const CHAPTERS = [["C0", "Socle", 9, 0], ["C1", "Comptes", 11, 0], ["C2", "Tâches", 8, 0], ["C3", "Recherche", 4, 1], ["C4", "Agenda et liste", 5, 1], ["C5", "Collaboration", 7, 1], ["C6", "Hors ligne et fichiers", 7, 0],
  ["C7", "Accessibilité", 5, 0], ["C8", "Paiement", 4, 0], ["C9", "Publication", 6, 0]];
const WAVES = ["Vague 1 · démarrables et en cours", "Vague 2", "Vague 3", "Vague 4", "Vague 5"];

// ---------- Mise en page ----------
const L = { x0: 24, colW: 222, y0: 52, step: 56, w: 190, h: 44 };
const pos = (o = L) => { const P = {}; W.forEach((col, j) => col.forEach(([k], i) => { P[k] = [o.x0 + j * o.colW, o.y0 + i * o.step]; })); return P; };
const byKey = Object.fromEntries(W.flat().map(t => [t[0], t]));
const edgesSvg = (g, P, o = {}) => { const w = Math.round(g.width), h = Math.round(g.height); const nw = o.w || L.w, nh = o.h || L.h;
  const paths = LINKS.map(([a, b]) => { const [x1, y1] = P[a], [x2, y2] = P[b]; const sx = x1 + nw, sy = y1 + nh / 2, ex = x2, ey = y2 + nh / 2, mx = (sx + ex) / 2;
    const on = o.hl ? o.hl.has(a + ">" + b) : true; return `<path d="M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}" stroke="${on && o.hl ? C.fg : C.mfg}" stroke-width="${on && o.hl ? 1.5 : 1}" stroke-opacity="${on ? (o.hl ? 1 : 0.55) : 0.15}" fill="none"/>`; }).join("");
  const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`); s.name = "Edges"; g.appendChild(s); penpotUtils.setParentXY(s, 0, 0); s.sendToBack(); return s; };
const edgesBack = async (g) => { await wait(2000); g.children.filter(c => /Edges$/.test(c.name)).forEach(c => c.sendToBack()); };
const startable = (p) => { const b = S.box(p, { name: "Startable", stroke: C.border, radius: 999, dir: "row", pad: [1, 6], hs: "auto", vs: "auto" }); S.txt(b, "Démarrable", { size: 10, weight: 500, color: C.mfg }); return b; };
const node = (g, [k, t, st, , ok], x, y, o = {}) => { const n = S.box(g, { name: "Node-" + k, fill: C.card, stroke: o.ring ? C.fg : C.border, sw: o.ring ? 2 : 1, radius: 8, w: L.w, h: L.h, dir: "column", gap: 2, pad: [5, 10] }); penpotUtils.setParentXY(n, x, y);
  const r = S.row(n, { gap: 6 }); S.statusDot(r, st, 7); S.txt(r, k, { size: 10, mono: true, color: C.dim }); if (ok) startable(r);
  S.txt(n, t, { size: 12, weight: 500 }); if (o.dim) n.opacity = 0.25; return n; };
const waveHeads = (g, o = L) => WAVES.forEach((t, j) => { const x = S.txt(g, t, { size: o.small ? 10 : 11, weight: 600, color: C.dim }); penpotUtils.setParentXY(x, o.x0 + j * o.colW, o.small ? o.y0 - 22 : 22); });
const legend = (g) => { const l = S.panel(g, { gap: 4, pad: [8, 12], radius: 8, w: 310 }); S.txt(l, "Bloque · 36 liens tracés", { size: 11, color: C.mfg }); S.txt(l, "24 liens implicites masqués (survol pour les voir)", { size: 11, color: C.dim }); penpotUtils.setParentXY(l, 1144 - 326, 560); return l; };
const zoomBar = (g, z) => { const b = S.box(g, { name: "ZoomBar", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 2, pad: 3, hs: "auto", vs: "auto", align: "center" }); iconButton(b, "scan"); iconButton(b, "plus"); S.txt(b, z, { size: 11, mono: true }); iconButton(b, "minus"); penpotUtils.setParentXY(b, 1144 - 150, 652); return b; };
const screen = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, "Graphe", ["Kibo", "Graphe"], ["graph", "Kibo · Graphe"]); S.topAction(r.frame, "Partager", "outline", "share2");
  const c = r.content; const tb = S.row(c, { gap: 8 }); S.fx.segmented(tb, ["Vagues", "Hiérarchique"], "Vagues");
  S.button(tb, o.shown ? "Masquer les terminés" : "Afficher les terminés (31)", "outline", { sm: true }); S.button(tb, "Démarrables", o.startable ? "secondary" : "outline", { sm: true, icon: "filter" });
  S.button(tb, o.group ? "Affichage · chapitre:" : "Affichage", "outline", { sm: true, icon: "sliders" }); S.spacer(tb); S.txt(tb, "69 tickets · 38 ouverts · 7 démarrables", { size: 12, color: C.mfg });
  const g = S.box(c, { name: "Canvas", fill: C.bg, stroke: C.border, radius: 10, w: 1144, h: 700 }); g.clipContent = true; return { ...r, g }; };

// ---------- 188 · Vagues ----------
S.draw[188] = async () => { const { frame: f, g } = await screen("188 · Graphe : vagues, terminés repliés", 0, 0); const P = pos();
  waveHeads(g); edgesSvg(g, P); W.flat().forEach(t => node(g, t, ...P[t[0]])); legend(g); zoomBar(g, "100 %"); await edgesBack(g); return f.id; };

// ---------- 188b · Focus sur KIB-65, deux niveaux ----------
const FOCUS = "KIB-65";
const neighbours = () => { const keep = new Set([FOCUS]), hl = new Set(); let up = [FOCUS], down = [FOCUS];
  for (let lv = 0; lv < 2; lv++) { const nu = [], nd = []; LINKS.forEach(([a, b]) => { if (up.includes(b)) { nu.push(a); keep.add(a); hl.add(a + ">" + b); } if (down.includes(a)) { nd.push(b); keep.add(b); hl.add(a + ">" + b); } }); up = nu; down = nd; }
  return { keep, hl }; };
S.draw["188b"] = async () => { const { frame: f, g } = await screen("188b · Graphe : focus sur un ticket", 2, 0); const P = pos(); const { keep, hl } = neighbours();
  waveHeads(g); edgesSvg(g, P, { hl }); W.flat().forEach(t => node(g, t, ...P[t[0]], { dim: !keep.has(t[0]), ring: t[0] === FOCUS }));
  const b = S.box(g, { name: "FocusBanner", fill: C.card, stroke: C.border, radius: 8, dir: "row", gap: 10, pad: [8, 12], hs: "auto", vs: "auto", align: "center" });
  S.txt(b, "Focus : KIB-65 · Tutoriel interactif", { size: 12, weight: 600 }); S.txt(b, "3 bloqueurs · débloque 4 tickets, sur deux niveaux", { size: 12, color: C.mfg }); S.txt(b, "Échap pour sortir", { size: 11, color: C.dim });
  penpotUtils.setParentXY(b, 24, 652); zoomBar(g, "100 %"); await edgesBack(g); return f.id; };

// ---------- 188c · Regroupement par étiquette chapitre: ----------
const group = (g, [id, name, n, open], x, y, w) => { const fr = S.box(g, { name: "Group-" + id, fill: C.card, stroke: C.border, radius: 10, w, dir: "column", gap: 6, pad: [8, 10], vs: "auto" }); penpotUtils.setParentXY(fr, x, y);
  const h = S.row(fr, { gap: 6 }); S.icon(h, open ? "chevDown" : "chevRight", 13, C.mfg); S.txt(h, id + " · " + (open ? name : n + " tickets"), { size: 12, weight: 600 }); S.spacer(h);
  if (open) S.txt(h, n + " tickets", { size: 11, color: C.dim });
  if (open) W.flat().filter(t => t[3] === id).forEach(t => { const r = S.row(fr, { name: "Row-" + t[0], gap: 6, pad: [5, 8], radius: 6, stroke: C.border }); S.statusDot(r, t[2], 7); S.txt(r, t[0], { size: 10, mono: true, color: C.dim });
    S.fillX(S.txt(r, t[1], { size: 11 })); if (t[4]) startable(r); });
  if (!open) S.txt(fr, name + (id <= "C2" ? " · terminés" : ""), { size: 11, color: C.dim }); return fr; };
S.draw["188c"] = async () => { const { frame: f, g } = await screen("188c · Graphe : regroupement par chapitre", 0, 1, { group: true });
  const at = { C0: [24, 40, 200], C1: [24, 130, 200], C2: [24, 220, 200], C3: [268, 40, 300], C4: [268, 230, 300], C5: [612, 40, 300], C6: [956, 40, 170], C7: [956, 130, 170], C8: [956, 220, 170], C9: [956, 310, 170] };
  const lines = [["C2", "C3", 2], ["C2", "C4", 3], ["C4", "C5", 1], ["C3", "C5", 1], ["C5", "C6", 2], ["C5", "C7", 1], ["C5", "C9", 2]];
  const ys = id => at[id][1] + 18; const svg = lines.map(([a, b]) => { const sx = at[a][0] + at[a][2], ex = at[b][0], sy = ys(a), ey = ys(b), mx = (sx + ex) / 2; return `<path d="M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}" stroke="${C.mfg}" stroke-opacity="0.55" fill="none"/>`; }).join("");
  const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1144" height="700" viewBox="0 0 1144 700">${svg}</svg>`); s.name = "GroupEdges"; g.appendChild(s); penpotUtils.setParentXY(s, 0, 0); s.sendToBack();
  CHAPTERS.forEach(c => group(g, c, ...at[c[0]]));
  await wait(1500); menu(f, 727, 92 + 24 + 34, ["Affichage", ["Regrouper par étiquette", "check", { hint: "chapitre:" }], ["Zoom sémantique", "check"], "-", ["Déplier tous les cadres", null, { noSlot: false }], ["Replier tous les cadres", null]], 280);
  zoomBar(g, "100 %"); await edgesBack(g); S.frontAbs(f); return f.id; };

// ---------- 188d · Zoom éloigné : clé et pastille ----------
S.draw["188d"] = async () => { const { frame: f, g } = await screen("188d · Graphe : zoom éloigné", 2, 1); const o = { x0: 150, colW: 180, y0: 120, step: 40, w: 86, h: 24, small: true }; const P = pos(o);
  waveHeads(g, o); edgesSvg(g, P, { w: o.w, h: o.h });
  W.flat().forEach(([k, , st]) => { const n = S.box(g, { name: "Pill-" + k, fill: C.card, stroke: C.border, radius: 999, w: o.w, h: o.h, dir: "row", gap: 5, pad: [0, 8], align: "center" }); penpotUtils.setParentXY(n, ...P[k]);
    S.statusDot(n, st, 7); S.txt(n, k, { size: 10, mono: true }); });
  const h = S.txt(g, "De loin : clé et pastille · de près : titre et étiquettes", { size: 11, color: C.dim }); penpotUtils.setParentXY(h, 24, 660); zoomBar(g, "40 %"); await edgesBack(g); return f.id; };

// ---------- Kanban : pastille « Démarrable » ----------
S.draw["188k"] = async () => { const { frame: f, content } = await kanbanAt(PAGE, "188k · Kanban : pastille Démarrable", 0, 2);
  const cd = find(content, "TicketCard / KIB-9"); const meta = cd && cd.children.find(x => x.name === "meta"); if (meta) startable(meta);
  const g = find(f, "Filter-Grouper : statut"); const tb = g && g.parent; if (tb) { const btn = S.button(tb, "Démarrables", "outline", { sm: true, icon: "filter" }); await wait(1500); btn.setParentIndex(tb.children.indexOf(g) + 1); } return f.id; };

S.GRAPHE = [188, "188b", "188c", "188d", "188k"];
return "graphe ok";
