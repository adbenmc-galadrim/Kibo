// Page « 28d · Couleurs du graphe » : planche de comparaison de la couleur du statut sur les cartes du graphe (spec §26.9), 5 variantes, sombre et clair.
// Un même extrait de 188 (8 tickets sur 3 vagues, un ticket de chaque statut et un démarrable), puis le même en zoom éloigné. Requiert 18-socle.js.
const S = storage, C = S.C;
const PAGE = "28d · Couleurs du graphe";
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Couleurs des statuts (colonnes du Kanban), l'orange reste aux agents ----------
const PAL = { dark: { gray: "#A1A1AA", blue: "#3B82F6", purple: "#A855F7", red: "#EF4444", green: "#22C55E" },
  light: { gray: "#71717A", blue: "#2563EB", purple: "#9333EA", red: "#DC2626", green: "#16A34A" } };
const HUE = { "Backlog": "gray", "À faire": "gray", "En cours": "blue", "En review": "purple", "Bloqué": "red", "Terminé": "green" };
const color = st => PAL[S.mode === "light" ? "light" : "dark"][HUE[st]];
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (c, a) => { const f = rgb(c), b = rgb(C.card); return hex(f.map((v, i) => v * a + b[i] * (1 - a))); };
const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const onColor = h => { const l = lum(h); return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "#FFFFFF" : "#09090B"; };
const neutral = () => S.mode === "light" ? "#A1A1AA" : "#52525B";

// ---------- Extrait du graphe 188 ----------
const T = [
  [["KIB-35", "Moteur d'indexation", "Terminé"], ["KIB-38", "Recherche plein texte", "En cours"], ["KIB-37", "Barre de recherche", "En review"], ["KIB-44", "Filtres de la liste", "À faire", 1]],
  [["KIB-39", "Index de recherche", "À faire"], ["KIB-62", "Audit accessibilité", "Bloqué"], ["KIB-45", "Tri personnalisé", "Backlog"]],
  [["KIB-40", "Suggestions de recherche", "Backlog"]]];
const LINKS = [["KIB-35", "KIB-39"], ["KIB-38", "KIB-39"], ["KIB-37", "KIB-62"], ["KIB-44", "KIB-45"], ["KIB-39", "KIB-40"], ["KIB-62", "KIB-40"]];
const NEAR = { x0: 16, y0: 34, colW: 206, step: 54, w: 176, h: 44, cw: 620, ch: 260 };
const FAR = { x0: 120, y0: 30, colW: 140, step: 30, w: 66, h: 22, cw: 620, ch: 152 };
const pos = o => { const P = {}; T.forEach((col, j) => col.forEach(([k], i) => { P[k] = [o.x0 + j * o.colW, o.y0 + i * o.step]; })); return P; };

// ---------- Variantes ----------
const V = [
  ["A", "Fond teint 15 % + bordure", "Fond teint à ~15 % de la couleur du statut, bordure pleine de la même couleur"],
  ["B", "Fond plein", "Fond plein à la couleur du statut, texte blanc ou noir selon le contraste"],
  ["C", "Bordure 2 px", "Bordure de 2 px à la couleur du statut, fond neutre"],
  ["D", "Bande latérale 6 px", "Bande de 6 px à gauche à la couleur du statut, fond et bordure neutres"],
  ["E", "Fond teint 25 %, sans bordure", "Fond teint plus soutenu (~25 %), sans bordure"]];
const look = (v, st) => { const c = color(st);
  if (v === "A") return { fill: mix(c, 0.15), stroke: c, sw: 1, fg: C.fg, key: C.mfg };
  if (v === "B") { const t = onColor(c); return { fill: c, stroke: null, fg: t, key: t }; }
  if (v === "C") return { fill: C.card, stroke: c, sw: 2, fg: C.fg, key: C.mfg };
  if (v === "D") return { fill: C.card, stroke: C.border, sw: 1, fg: C.fg, key: C.mfg, band: c };
  return { fill: mix(c, 0.25), stroke: null, fg: C.fg, key: C.mfg }; };

const startable = p => { const b = S.box(p, { name: "Startable", fill: C.bg, stroke: neutral(), radius: 999, dir: "row", pad: [1, 7], hs: "auto", vs: "auto", align: "center" });
  S.txt(b, "Démarrable", { size: 11, weight: 500, color: C.fg }); return b; };
const shell = (g, name, l, x, y, w, h, radius) => { const n = S.box(g, { name, fill: l.fill, stroke: l.stroke, sw: l.sw, radius, w, h, dir: "row", align: "center" }); n.clipContent = true;
  penpotUtils.setParentXY(n, x, y); if (l.band) { const b = S.box(n, { name: "Band", fill: l.band, w: 6, h }); b.layoutChild.verticalSizing = "fill"; } return n; };
const card = (g, v, [k, t, st, ok], x, y) => { const l = look(v, st); const n = shell(g, "Node-" + k, l, x, y, NEAR.w, NEAR.h, 8);
  const body = S.box(n, { name: "Body", dir: "column", gap: 2, pad: [5, 10], vs: "auto" }); body.layoutChild.horizontalSizing = "fill";
  const r = S.row(body, { gap: 6 }); S.txt(r, k, { size: 10, mono: true, color: l.key }); if (ok) startable(r);
  S.txt(body, t, { size: 12, weight: 500, color: l.fg }); return n; };
const pill = (g, v, [k, , st], x, y) => { const l = look(v, st); const n = shell(g, "Pill-" + k, l, x, y, FAR.w, FAR.h, v === "D" ? 6 : 999);
  const body = S.box(n, { name: "Body", dir: "row", justify: "center", align: "center", vs: "auto" }); body.layoutChild.horizontalSizing = "fill";
  S.txt(body, k, { size: 10, mono: true, weight: 500, color: l.fg }); return n; };
const edges = (g, P, o) => { const paths = LINKS.map(([a, b]) => { const [x1, y1] = P[a], [x2, y2] = P[b]; const sx = x1 + o.w, sy = y1 + o.h / 2, ex = x2, ey = y2 + o.h / 2, mx = (sx + ex) / 2;
    return `<path d="M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}" stroke="${C.mfg}" stroke-opacity="0.55" fill="none"/>`; }).join("");
  const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${o.cw}" height="${o.ch}" viewBox="0 0 ${o.cw} ${o.ch}">${paths}</svg>`); s.name = "Edges"; g.appendChild(s); penpotUtils.setParentXY(s, 0, 0); s.sendToBack(); };
const heads = (g, o) => T.forEach((_, j) => { const h = S.txt(g, j === 0 ? "Vague 1 · démarrables et en cours" : "Vague " + (j + 1), { size: 10, weight: 600, color: C.dim }); penpotUtils.setParentXY(h, o.x0 + j * o.colW, o.y0 - 22); });
const canvas = (p, name, o) => { const g = S.box(p, { name, fill: C.bg, stroke: C.border, radius: 10, w: o.cw, h: o.ch }); g.clipContent = true; return g; };

// ---------- Planche ----------
const boardName = () => "Couleurs du graphe · 5 variantes" + (S.mode === "light" ? " (clair)" : "");
const findBoard = () => penpot.currentPage.root.children.find(c => c.name === boardName());
const legend = p => { const r = S.row(p, { name: "Legend", gap: 20 }); S.txt(r, "Couleurs des statuts (colonnes du Kanban)", { size: 12, color: C.mfg });
  [["Backlog · À faire", "À faire"], ["En cours", "En cours"], ["En review", "En review"], ["Bloqué", "Bloqué"], ["Terminé", "Terminé"]].forEach(([t, st]) => { const c = S.row(r, { gap: 6, hs: "auto" });
    S.box(c, { name: "Swatch", fill: mix(color(st), 0.15), stroke: color(st), radius: 4, w: 14, h: 14 }); S.txt(c, t, { size: 12 }); });
  const n = S.row(r, { gap: 6, hs: "auto" }); startable(n); S.txt(n, "neutre, 11 px, contour", { size: 12, color: C.mfg }); return r; };
S.couleursPlanche = async (mode) => { S.setMode(mode); try { await S.page(PAGE); const old = findBoard(); if (old) old.remove();
  const f = S.box(null, { name: boardName(), fill: C.bg, w: 3420, h: 100, dir: "column", gap: 20, pad: 32, vs: "auto" }); penpot.currentPage.root.appendChild(f);
  f.x = 0; f.y = mode === "light" ? 900 : 0;
  S.txt(f, "Graphe · couleur du statut sur les cartes", { size: 20, weight: 600 }); S.txt(f, "Même extrait de 188 décliné en 5 variantes ; en dessous, le même extrait en zoom éloigné (clé seule).", { size: 13, color: C.mfg });
  legend(f); S.row(f, { name: "Variants", gap: 24, align: "start" }); return f.id; } finally { S.setMode("dark"); } };
S.couleursVariante = async (mode, i) => { S.setMode(mode); try { await S.page(PAGE); const f = findBoard(); const row = f.children.find(c => c.name === "Variants");
  const [v, title, desc] = V[i]; const old = row.children.find(c => c.name === "Variant-" + v); if (old) old.remove();
  const p = S.box(row, { name: "Variant-" + v, fill: C.card, stroke: C.border, radius: 12, w: NEAR.cw + 32, dir: "column", gap: 10, pad: 16, vs: "auto" });
  S.txt(p, v + " · " + title, { size: 15, weight: 600 }); S.txt(p, desc, { size: 12, color: C.mfg });
  const g = canvas(p, "Near", NEAR); const P = pos(NEAR); heads(g, NEAR); edges(g, P, NEAR); T.flat().forEach(t => card(g, v, t, ...P[t[0]]));
  S.txt(p, "Zoom éloigné", { size: 12, weight: 600, color: C.mfg });
  const h = canvas(p, "Far", FAR); const Q = pos(FAR); edges(h, Q, FAR); T.flat().forEach(t => pill(h, v, t, ...Q[t[0]]));
  await wait(1500); [g, h].forEach(x => x.children.filter(c => c.name === "Edges").forEach(c => c.sendToBack())); return p.id; } finally { S.setMode("dark"); } };
S.couleursRetext = (mode) => { S.setMode(mode); try { const f = findBoard(); return S.retext(f); } finally { S.setMode("dark"); } };
S.couleursExport = async (mode, v) => { S.setMode(mode); try { const f = findBoard(); const s = v ? f.children.find(c => c.name === "Variants").children.find(c => c.name === "Variant-" + v) : f;
  const bytes = await s.export({ type: "png", scale: 1 }); const name = (v ? "variante-" + v : "variantes") + "-" + mode + ".png";
  await fetch("http://127.0.0.1:8787/upload?name=" + encodeURIComponent(name), { method: "POST", body: bytes }); return name; } finally { S.setMode("dark"); } };
S.COULEURS = V.map(v => v[0]);
return "couleurs ok";
