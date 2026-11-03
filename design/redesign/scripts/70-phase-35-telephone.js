// Phase 35 · Kibo sur téléphone (spec §52) : quatorze écrans de 390 × 844, sombre (palette §51) et clair, projet Silo au 16 oct. 14:52.
// Chargement : 01-base.js, 02-data.js puis ce script. Page « Phase 35 · Téléphone », sombre à x = 0, clair à x = 490, rangées de 1 000 px.
const S = storage;
S.RECV = S.RECV || "http://127.0.0.1:8787";
Object.assign(S.ICONS, {
  box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  sprint: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  expand: '<path d="m15 15 6 6"/><path d="m15 9 6-6"/><path d="M21 16v5h-5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="m3 21 6-6"/><path d="M3 8V3h5"/><path d="M9 9 3 3"/>',
  wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  share: '<path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  checkSquare: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
});

S.PAL35 = {
  dark: { ...S.PAL.dark, bg: "#212124", panel: "#26262A", card: "#2D2D31", muted: "#343439", hover: "#3A3A3F", border: "#47474D", soft: "#38383D",
    fg: "#FAFAFA", mfg: "#CFCFD6", dim: "#ABABB4", faint: "#7A7A83", brandSoft: "#4E382D", brandLine: "#935024",
    blue: "#7FB5FB", purple: "#CFA1FD", green: "#4ADE80", red: "#FC9494", amber: "#FBBF24",
    blueSoft: "#343841", purpleSoft: "#3A3641", greenSoft: "#2F3B37", redSoft: "#3E3539", amberSoft: "#3D3930", holdSoft: "#2C3A40",
    track: "#47474D", canvas: "#242427", grid: "#323236", frame: "#2A2A2E", onFill: "#09090B", input: "#85858E" },
  light: { ...S.PAL.light, track: "#E4E4E7", frame: "#FFFFFF", onFill: "#FFFFFF", input: "#E4E4E7" },
};
S.setMode35 = (m) => { Object.assign(S.C, S.PAL35[m]); S.mode = m; };

S.TAP35 = 44;
S.tap35 = (b) => { b.flex.verticalSizing = "fix"; b.resize(b.width, S.TAP35); if (!(b.layoutChild && b.layoutChild.horizontalSizing === "fill")) b.flex.horizontalSizing = "auto"; return b; };
S.btn35 = (p, label, variant, o = {}) => S.tap35(S.btn(p, label, variant, o));
S.W35 = 390; S.H35 = 844; S.STEP35 = 1000; S.LIGHT_X35 = 490;
S.KEYS35 = ["graphe", "graphe-prs", "kanban", "planning", "dashboard", "questions", "fiche", "agent", "appairage", "mac-eteint", "kanban-menu", "graphe-legende", "fiche-suite", "dashboard-suite"];
S.TITLES35 = { graphe: "Graphe", "graphe-prs": "Graphe, PRs", kanban: "Kanban", planning: "Planning", dashboard: "Dashboard", questions: "Questions",
  fiche: "Fiche ticket", agent: "Agent de projet", appairage: "Appairage", "mac-eteint": "Mac éteint",
  "kanban-menu": "Kanban, appui long", "graphe-legende": "Graphe, légende et sprints", "fiche-suite": "Fiche ticket, suite et menu", "dashboard-suite": "Dashboard, suite" };
S.TABS35 = [["Graphe", "graph"], ["Kanban", "kanban"], ["Planning", "sprint"], ["Questions", "question"], ["Dashboard", "dashboard"]];
S.name35 = (k) => "P35 · " + S.TITLES35[k];

S.phone35 = (k, mode) => { S.setMode35(mode); const C = S.C, i = S.KEYS35.indexOf(k);
  const f = S.screen(S.name35(k), mode === "light" ? S.LIGHT_X35 : 0, i * S.STEP35, S.W35, S.H35);
  const ph = S.box(f, { name: "phone", w: S.W35, h: S.H35, dir: "column", gap: 0, fill: C.bg });
  S.statusBar35(ph); return { f, ph }; };
S.statusBar35 = (p) => { const C = S.C; const r = S.row(p, { name: "status-bar", fx: true, h: 47, pad: [0, 28, 0, 36], gap: 6 });
  S.txt(r, "14:52", { size: 15, weight: 600, name: "clock" }); S.spacer(r); S.icon(r, "wifi", 16, C.fg, 2.4);
  const bat = S.row(r, { name: "battery", w: 25, h: 12, radius: 3.5, stroke: C.dim, pad: 1.5 }); S.box(bat, { name: "charge", w: 17, h: 9, radius: 2, fill: C.fg }); return r; };
S.agentBtn35 = (p) => { const C = S.C; const b = S.row(p, { name: "Agent de projet", h: 44, pad: [0, 10], gap: 6, radius: 8, stroke: C.border });
  S.icon(b, "bot", 18, C.brand); const k = S.row(b, { name: "count", pad: [1, 6], radius: 9, fill: C.brandBtn }); S.txt(k, "3", { size: 11, weight: 600, color: "#FFFFFF", mono: true }); return b; };
S.header35 = (p, page, o = {}) => { const C = S.C; const h = S.row(p, { name: "header", fx: true, h: 52, pad: [0, 12, 0, 16], gap: 8 });
  const sw = S.row(h, { name: "project-switch", h: 44, gap: 7 }); S.dot(sw, "#14B8A6", 8); S.txt(sw, "Silo", { size: 15, weight: 600 }); S.icon(sw, "chevDown", 14, C.dim);
  S.txt(h, "/", { size: 15, color: C.faint }); S.txt(h, page, { size: 15, weight: 600, name: "page" }); S.spacer(h);
  if (o.right) o.right(h); S.agentBtn35(h); S.hline(p, C.border); return h; };
S.offline35 = (p) => { const C = S.C; const b = S.row(p, { name: "offline-band", fx: true, h: 32, pad: [0, 16], gap: 8, fill: C.muted });
  S.icon(b, "wifiOff", 13, C.dim); S.txt(b, "Mac éteint · dernier état à 14:52", { size: 12.5, weight: 500, color: C.mfg }); S.hline(p, C.border); return b; };
S.tabs35 = (p, active) => { const C = S.C; const w = S.col(p, { name: "tab-bar", fx: true, fill: C.bg }); S.hline(w, C.border);
  const r = S.row(w, { name: "tabs", fx: true, h: 55, gap: 0, align: "center" });
  for (const [label, icon] of S.TABS35) { const on = label === active; const t = S.col(r, { name: "tab " + label, w: 78, h: 55, gap: 4, align: "center", justify: "center" });
    S.icon(t, icon, 22, on ? C.fg : C.dim, on ? 2 : 1.75); S.txt(t, label, { size: 11, weight: on ? 600 : 500, color: on ? C.fg : C.dim }); }
  const safe = S.row(w, { name: "safe-area", fx: true, h: 34, justify: "center", align: "end", pad: [0, 0, 8, 0] }); S.box(safe, { name: "home-indicator", w: 134, h: 5, radius: 3, fill: C.fg });
  return w; };
S.homeBar35 = (p) => { const C = S.C; const safe = S.row(p, { name: "safe-area", fx: true, h: 34, justify: "center", align: "end", pad: [0, 0, 8, 0] }); S.box(safe, { name: "home-indicator", w: 134, h: 5, radius: 3, fill: C.fg }); return safe; };
S.seg35 = (p, items, active) => { const C = S.C; const s = S.row(p, { name: "segmented", pad: 3, radius: 9, fill: C.muted, gap: 2 });
  for (const [l, icon, n] of items) { const on = l === active; const it = S.row(s, { name: "segment " + l, h: 38, pad: [0, 12], gap: 6, radius: 7, fill: on ? C.bg : null, stroke: on ? C.border : null });
    if (icon) S.icon(it, icon, 14, on ? C.fg : C.mfg); S.txt(it, l, { size: 13, weight: 500, color: on ? C.fg : C.mfg }); if (n) S.txt(it, n, { size: 11.5, mono: true, color: C.dim }); }
  return s; };
S.iconBtn35 = (p, icon, o = {}) => { const C = S.C; const b = S.box(p, { name: o.name || "icon-button " + icon, w: o.size || 44, h: o.size || 44, radius: 8, stroke: o.stroke === false ? null : C.border, dir: "row", align: "center", justify: "center" });
  S.icon(b, icon, o.isz || 16, o.color || C.mfg); return b; };
S.content35 = (p, o = {}) => S.box(p, { name: "content", w: S.W35, h: 10, fx: true, fy: true, clip: true, fill: o.fill || null });

S.COLW35 = 334; S.GAP35 = 16; S.PADX35 = 16;
S.F35 = {
  F3: { title: "Réaffecter un box", n: "4/4", done: true, segs: ["d", "d", "d", "d"] },
  F4: { title: "Saisir un constat hors ligne", n: "3/5", segs: ["d", "d", "d", "p", "t"], steps: [
    ["Schéma local des constats", "Terminé", "merge"], ["Formulaire de saisie", "Terminé", "merge"], ["Synchro au retour du réseau", "Terminé", "merge"],
    ["Conflits de saisie", "En review", "pr", { active: true, ic: "amber" }], ["Démo client", "À faire", null, { startable: true }]] },
  F5: { title: "Envoyer les photos d'un constat", n: "1/5", segs: ["d", "p", "b", "t", "t"], steps: [
    ["Stockage des photos sur MinIO", "Terminé", "merge"], ["Route d'envoi des photos", "En review", "pr"], ["Écran d'envoi hors ligne", "En cours", "branch", { active: true }],
    ["Tests E2E de l'envoi", "À faire"], ["Démo client", "À faire"]] },
  F6: { title: "Importer les box depuis Excel", n: "0/4", segs: ["r", "t", "t", "t"], steps: [["Lecture du fichier Excel", "Bloqué"], ["Contrôle des numéros", "À faire"]] },
};
S.segColor35 = (c) => ({ d: S.C.fg, p: S.C.purple, b: S.C.blue, r: S.C.red, t: S.C.track })[c];
S.stepRow35 = (p, [title, st, icon, o = {}]) => { const C = S.C, done = st === "Terminé";
  const r = S.row(p, { name: "step " + title, fx: true, h: 44, pad: [0, 12], gap: 10, radius: 8, fill: C.card, stroke: o.active ? C.brand : o.startable ? C.green : C.border });
  S.status(r, st, 8); S.txt(r, title, { size: 13, weight: 500, color: done ? C.dim : C.fg }); S.spacer(r);
  if (o.active) S.dot(r, C.brand, 6);
  if (icon) S.icon(r, icon, 15, o.ic ? C[o.ic] : done ? C.green : st === "En review" ? C.purple : C.blue);
  return r; };
S.frame35 = (p, k) => { const C = S.C, d = S.F35[k];
  const fr = S.col(p, { name: "feature " + k, fx: true, pad: 12, gap: 8, radius: 10, fill: C.frame, stroke: C.border, dashed: true });
  const m = S.row(fr, { name: "meta", fx: true, gap: 6 }); S.txt(m, k, { size: 12, mono: true, color: C.dim }); S.spacer(m);
  S.txt(m, d.n, { size: 12, mono: true, color: C.mfg }); if (d.done) S.icon(m, "circleCheck", 14, C.green);
  S.txt(fr, d.title, { size: 15, weight: 600, fill: true });
  const sg = S.row(fr, { name: "segments", fx: true, gap: 3, pad: [2, 0, 2, 0] });
  for (const c of d.segs) S.box(sg, { name: "seg", w: 10, h: 5, radius: 1, fill: S.segColor35(c), fx: true });
  for (const s of d.steps || []) S.stepRow35(fr, s);
  return fr; };
S.sprintCol35 = (p, code, name, sub, frames) => { const C = S.C; const col = S.col(p, { name: "sprint " + code, w: S.COLW35, gap: 12 });
  const h = S.col(col, { name: "sprint-header", fx: true, gap: 2 }); const t = S.row(h, { gap: 6 }); S.txt(t, code, { size: 12.5, weight: 600, mono: true }); S.txt(t, name, { size: 15, weight: 600 });
  S.txt(h, sub, { size: 12.5, color: C.mfg }); for (const k of frames) S.frame35(col, k); return col; };
S.graphToolbar35 = (p, active) => { const C = S.C; const tb = S.row(p, { name: "toolbar", fx: true, h: 56, pad: [0, 12, 0, 16], gap: 8 });
  S.seg35(tb, [["Fonctionnalités", "box"], ["PRs", "pr"]], active); S.spacer(tb);
  if (active === "Fonctionnalités") S.iconBtn35(tb, "expand", { name: "Tout voir" }); S.iconBtn35(tb, "info", { name: "Légende" }); S.hline(p, C.border); return tb; };
S.draw35 = S.draw35 || {};
S.post35 = [];
S.draw35.graphe = (mode) => { const { f, ph } = S.phone35("graphe", mode), C = S.C;
  S.header35(ph, "Graphe"); S.offline35(ph); S.graphToolbar35(ph, "Fonctionnalités");
  const ct = S.content35(ph, { fill: C.canvas });
  const row = S.row(ct, { name: "sprint-columns", x: S.PADX35, y: 14, gap: S.GAP35, align: "start" });
  S.sprintCol35(row, "S42", "Saisie hors ligne", "se termine aujourd'hui", ["F3", "F4", "F5"]);
  S.sprintCol35(row, "S43", "Import et contrats", "prévu · 19 → 23 oct.", ["F6"]);
  S.tabs35(ph, "Graphe"); return f; };

S.prRow35 = (p, o) => { const C = S.C;
  const r = S.col(p, { name: "pr " + o.n, fx: true, pad: [10, 12], gap: 4, radius: 8, fill: C.card, stroke: o.changes ? C.red : o.live ? C.brand : C.border });
  const a = S.row(r, { fx: true, gap: 8 }); S.icon(a, "pr", 15, o.draft ? C.dim : o.changes ? C.amber : C.purple);
  S.txt(a, o.n, { size: 13, weight: 600, mono: true }); S.txt(a, o.title, { size: 13, weight: 500 }); S.spacer(a); if (o.live) S.dot(a, C.brand, 6);
  const b = S.row(r, { fx: true, gap: 8, pad: [0, 0, 0, 23] }); S.txt(b, o.key, { size: 12, mono: true, color: C.mfg });
  S.txt(b, o.state, { size: 12, color: o.changes ? C.amber : C.mfg }); S.spacer(b);
  const ci = S.row(b, { gap: 4 }); if (o.ci === "ok") S.icon(ci, "circleCheck", 13, C.green); else if (o.ci === "error") S.icon(ci, "circleX", 13, C.red); else S.ring(ci, C.amber, 11, 2);
  S.txt(ci, o.ci === "ok" ? "CI verte" : o.ci === "error" ? "CI rouge" : "CI en cours", { size: 12, color: C.mfg }); return r; };
S.pile35 = (p, head, sub, prs) => { const C = S.C; const c = S.col(p, { name: "pile " + head, fx: true, pad: 12, gap: 8, radius: 10, fill: C.frame, stroke: C.border, dashed: true });
  S.txt(c, head, { size: 12, mono: true, color: C.dim }); S.txt(c, sub, { size: 14, weight: 600, fill: true });
  for (const pr of prs) { if (pr.on) { const l = S.row(c, { fx: true, gap: 6, pad: [0, 0, 0, 12] }); S.icon(l, "chevDown", 12, C.dim); S.txt(l, "sur " + pr.on, { size: 11.5, mono: true, color: C.dim }); } S.prRow35(c, pr); }
  const rail = S.row(c, { name: "rail", fx: true, h: 28, gap: 8, pad: [0, 12], radius: 6, fill: C.muted }); S.icon(rail, "branch", 13, C.mfg); S.txt(rail, "dev · branche de base", { size: 12, mono: true, color: C.mfg });
  return c; };
S.draw35["graphe-prs"] = (mode) => { const { f, ph } = S.phone35("graphe-prs", mode), C = S.C;
  S.header35(ph, "Graphe"); S.graphToolbar35(ph, "PRs");
  const ct = S.content35(ph, { fill: C.canvas });
  const list = S.col(ct, { name: "piles", x: 16, y: 14, w: S.W35 - 32, gap: 12 });
  S.txt(list, "5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger", { size: 12.5, color: C.mfg, fill: true });
  S.pile35(list, "3 PR empilées", "F5 · Envoyer les photos d'un constat · #22 à #25", [
    { n: "#25", title: "Tests E2E de l'envoi", key: "SILO-34", state: "brouillon", draft: true, ci: "ok" },
    { n: "#24", title: "Écran d'envoi hors ligne", key: "SILO-33", state: "brouillon", draft: true, ci: "running", live: true, on: "feat/envoi-hors-ligne" },
    { n: "#22", title: "Route d'envoi des photos", key: "SILO-32", state: "en attente de review", ci: "ok", on: "feat/silo-32" }]);
  S.pile35(list, "1 PR", "F4 · Saisir un constat hors ligne · #20", [{ n: "#20", title: "Conflits de saisie", key: "SILO-45", state: "changements demandés", changes: true, ci: "error", live: true }]);
  S.tabs35(ph, "Graphe"); return f; };

S.kbadge35 = (p, text, fg, o = {}) => { const C = S.C; const c = S.row(p, { name: "badge", pad: o.pill ? [3, 9] : [3, 7], gap: 4, radius: o.pill ? 11 : 5, fill: o.bg || null, stroke: o.bg ? null : C.border });
  if (o.icon) S.icon(c, o.icon, 12, o.ic || fg); if (o.ring) S.ring(c, C.amber, 10, 2); S.txt(c, text, { size: 12, weight: 500, mono: o.mono, color: fg }); return c; };
S.kcard35 = (p, t) => { const C = S.C;
  const c = S.col(p, { name: "card " + t.key, fx: true, pad: [12, 14], gap: 8, radius: 10, fill: C.card, stroke: t.live ? C.brandLine : C.border });
  const a = S.row(c, { fx: true, gap: 6 }); S.txt(a, t.key, { size: 12, mono: true, color: C.mfg }); if (t.f) { S.txt(a, "·", { size: 12, color: C.faint }); S.txt(a, t.f, { size: 12, mono: true, color: C.mfg }); }
  S.spacer(a); if (t.live) { const l = S.row(a, { gap: 5, pad: [2, 7], radius: 10, fill: C.brandSoft }); S.dot(l, C.brand, 6); S.txt(l, "T3", { size: 11, weight: 600, color: C.brandText }); } S.icon(a, "more", 16, C.dim);
  S.txt(c, t.title, { size: 14, weight: 500, fill: true });
  const b = S.row(c, { name: "badges", fx: true, gap: 6, wrap: true });
  if (t.pr) S.kbadge35(b, t.pr, C.fg, { icon: "pr", ic: C.purple, mono: true });
  if (t.review === "changes") S.kbadge35(b, "changements demandés", C.amber, { bg: C.amberSoft });
  else if (t.ci === "ok") S.kbadge35(b, "CI", C.mfg, { icon: "circleCheck", ic: C.green }); else if (t.ci === "running") S.kbadge35(b, "CI en cours", C.mfg, { ring: true });
  if (t.blockedQ) S.kbadge35(b, "bloqué · " + t.blockedQ, C.red, { bg: C.redSoft, icon: "lock" });
  if (t.step != null) S.kbadge35(b, `Étape ${t.step}/12 · ${S.STEP[t.step]}`, C.fg, { mono: true, pill: true });
  if (!b.children.length) b.remove(); return c; };
S.kcol35 = (p, name, st, count, cards, w) => { const C = S.C; const col = S.col(p, { name: "column " + name, w, gap: 8, pad: 8, radius: 12, fill: C.panel });
  const h = S.row(col, { fx: true, h: 36, pad: [0, 6], gap: 8 }); S.status(h, st, 8); S.txt(h, name, { size: 14, weight: 600 }); S.txt(h, String(count), { size: 12.5, mono: true, color: C.dim }); S.spacer(h); S.icon(h, "plus", 16, C.dim);
  for (const t of cards) S.kcard35(col, t); return col; };
S.draw35.kanban = (mode) => { const { f, ph } = S.phone35("kanban", mode), C = S.C;
  S.header35(ph, "Kanban");
  const tb = S.box(ph, { name: "filters", w: S.W35, h: 64, fx: true, clip: true });
  const fr = S.row(tb, { name: "filters-row", x: 16, y: 10, gap: 8, align: "center" });
  S.seg35(fr, [["Tous", null, "41"], ["Sprint courant · S42", null, "15"], ["Démarrable", null, "1"], ["À reprendre", "rotate", "1"]], "Tous");
  S.btn35(fr, "Étiquette : toutes", "outline", { sm: true, icon: "tag" }); S.hline(ph, C.border);
  const ct = S.content35(ph);
  const row = S.row(ct, { name: "columns-row", x: 16, y: 12, gap: 16, align: "start" });
  S.kcol35(row, "En review", "En review", 3, [
    { key: "SILO-45", f: "F4", title: "Conflits de saisie", live: true, pr: "#20", review: "changes", step: 9 },
    { key: "SILO-32", f: "F5", title: "Route d'envoi des photos", pr: "#22", ci: "ok", step: 10 },
    { key: "SILO-61", title: "Passage à Expo SDK 54", pr: "#23", ci: "running" }], 332);
  S.kcol35(row, "Bloqué", "Bloqué", 1, [{ key: "SILO-51", f: "F6", title: "Lecture du fichier Excel", blockedQ: "Q14" }], 332);
  S.tabs35(ph, "Kanban"); return f; };

S.pcard35 = (p, o) => { const C = S.C; const c = S.col(p, { name: "feature-card " + o.k, fx: true, pad: [10, 12, 12, 12], gap: 8, radius: 10, fill: C.card, stroke: C.border });
  const a = S.row(c, { fx: true, gap: 6 }); S.icon(a, "grip", 14, C.faint); S.txt(a, o.k, { size: 12, mono: true, color: C.dim }); S.spacer(a);
  if (o.badge) { const b = S.row(a, { gap: 4 }); S.icon(b, o.badge[1], 13, C[o.badge[2]]); S.txt(b, o.badge[0], { size: 12, weight: 500, color: C[o.badge[2]] }); }
  S.txt(c, o.title, { size: 14, weight: 500, fill: true });
  const sg = S.row(c, { fx: true, gap: 3 }); for (const s of o.segs) S.box(sg, { name: "seg", w: 10, h: 5, radius: 1, fill: S.segColor35(s), fx: true });
  const m = S.row(c, { fx: true, gap: 6 }); S.txt(m, o.foot, { size: 12, color: C.mfg }); S.spacer(m); if (o.next) { S.dot(m, C.brand, 6); S.txt(m, o.next, { size: 12, mono: true, color: C.brandText }); } return c; };
S.draw35.planning = (mode) => { const { f, ph } = S.phone35("planning", mode), C = S.C;
  S.header35(ph, "Planning");
  const tb = S.col(ph, { name: "toolbar", fx: true, pad: [10, 16], gap: 10 });
  S.txt(tb, "3 fonctionnalités livrées sur 9 · 1 à planifier", { size: 12.5, color: C.mfg });
  const bt = S.row(tb, { fx: true, gap: 8 }); S.btn35(bt, "Fonctionnalité", "outline", { sm: true, icon: "plus" }); S.btn35(bt, "Sprint", "outline", { sm: true, icon: "plus" });
  const lim = S.row(bt, { h: 44, gap: 6, pad: [0, 10], radius: 6, stroke: C.border }); S.ring(lim, C.amber, 10, 2); S.txt(lim, "En cours : 2 / 2", { size: 12, weight: 500 }); S.hline(ph, C.border);
  const ct = S.content35(ph);
  const row = S.row(ct, { name: "sprint-columns", x: 16, y: 12, gap: 16, align: "start" });
  const col = S.col(row, { name: "sprint S42", w: S.COLW35, pad: 12, gap: 10, radius: 12, fill: C.card, stroke: C.mfg });
  const h = S.row(col, { fx: true, gap: 6 }); S.txt(h, "S42", { size: 12.5, weight: 600, mono: true }); S.txt(h, "Saisie hors ligne", { size: 15, weight: 600 }); S.icon(h, "pencil", 13, C.dim);
  const d = S.row(col, { fx: true, gap: 8 }); S.txt(d, "12–16 oct.", { size: 12.5, color: C.mfg }); S.spacer(d); S.kbadge35(d, "se termine aujourd'hui", C.fg, { bg: C.muted });
  const pr = S.row(col, { fx: true, gap: 8 }); S.bar(pr, 200, 1 / 3, { h: 4, color: C.green }); S.spacer(pr); S.txt(pr, "1/3 livrées", { size: 12, color: C.mfg });
  S.txt(col, "10 étapes prévues · capacité 5", { size: 12, color: C.amber });
  const al = S.row(col, { name: "alert", fx: true, pad: [8, 10], gap: 8, radius: 8, fill: C.amberSoft }); S.icon(al, "alert", 14, C.amber); S.txt(al, "F5 ne tiendra pas (4 étapes restantes)", { size: 12.5, color: C.amber, fill: true });
  S.pcard35(col, { k: "F3", title: "Réaffecter un box", segs: ["d", "d", "d", "d"], foot: "4/4 étapes", badge: ["livrée", "circleCheck", "green"] });
  S.pcard35(col, { k: "F4", title: "Saisir un constat hors ligne", segs: ["d", "d", "d", "p", "t"], foot: "3/5 étapes", next: "SILO-45", badge: ["à risque", "alert", "amber"] });
  S.pcard35(col, { k: "F5", title: "Envoyer les photos d'un constat", segs: ["d", "p", "b", "t", "t"], foot: "1/5 étapes", next: "SILO-33", badge: ["à risque", "alert", "amber"] });
  const c2 = S.col(row, { name: "sprint S43", w: S.COLW35, pad: 12, gap: 10, radius: 12, fill: C.panel, stroke: C.border });
  const h2 = S.row(c2, { fx: true, gap: 6 }); S.txt(h2, "S43", { size: 12.5, weight: 600, mono: true }); S.txt(h2, "Import et contrats", { size: 15, weight: 600 });
  S.txt(c2, "19–23 oct.", { size: 12.5, color: C.mfg });
  S.tabs35(ph, "Planning"); return f; };

S.tile35 = (p, label, icon, big, unit, foot, o = {}) => { const C = S.C; const t = S.col(p, { name: "tile " + label, w: o.w || 171, pad: [12, 14], gap: 6, radius: 10, fill: C.card, stroke: C.border, fx: !!o.full });
  const h = S.row(t, { gap: 6 }); S.icon(h, icon, 14, C.mfg); S.txt(h, label, { size: 12.5, color: C.mfg });
  const v = S.row(t, { gap: 6, align: "end" }); S.txt(v, big, { size: 26, weight: 600 }); S.txt(v, unit, { size: 12.5, color: C.mfg, w: o.unitW });
  if (o.after) o.after(t); else { const f = S.row(t, { gap: 6 }); if (foot[1]) S.dot(f, C[foot[1]], 6); S.txt(f, foot[0], { size: 12, color: foot[1] ? C[foot[1]] : C.mfg }); } return t; };
S.card35 = (p, title, icon, o = {}) => { const C = S.C; const c = S.col(p, { name: "card " + title, fx: true, radius: 10, fill: C.card, stroke: C.border, gap: 0 });
  const h = S.row(c, { fx: true, h: 44, pad: [0, 14], gap: 8 }); S.icon(h, icon, 15, C.mfg); S.txt(h, title, { size: 14, weight: 600 }); S.spacer(h); if (o.right) o.right(h); return c; };
S.draw35.dashboard = (mode) => { const { f, ph } = S.phone35("dashboard", mode), C = S.C;
  S.header35(ph, "Dashboard");
  const ct = S.content35(ph);
  const s = S.col(ct, { name: "stack", x: 16, y: 16, w: S.W35 - 32, gap: 12 });
  const id = S.col(s, { fx: true, gap: 2 }); S.txt(id, "Silo", { size: 22, weight: 600 }); S.txt(id, "client Silo SA · Location de box", { size: 12.5, color: C.mfg });
  S.tile35(s, "Fonctionnalités", "box", "3", "livrées sur 9", null, { full: true, w: 358, after: (t) => { const r = S.row(t, { fx: true, gap: 3 });
    for (let i = 0; i < 9; i++) S.box(r, { name: "seg", w: 18, h: 6, radius: 1.5, fill: i < 3 ? C.green : i < 5 ? C.blue : C.track }); S.spacer(r); S.txt(r, "2 à risque", { size: 12, color: C.amber }); } });
  const g = S.row(s, { fx: true, gap: 16, align: "start" });
  S.tile35(g, "Sprint en cours", "sprint", "S42", "Saisie ho…", ["se termine aujourd'hui"]);
  S.tile35(g, "En cours", "rotate", "2", "ouvertes", ["limite 2", "amber"]);
  const g2 = S.row(s, { fx: true, gap: 16, align: "start" });
  S.tile35(g2, "En review", "pr", "3", "PR", ["#20 · #22 · #23"]);
  S.tile35(g2, "Questions", "question", "3", "ouvertes", ["Q14 bloque F6", "red"]);
  const lv = S.row(s, { name: "delivered-today", fx: true, pad: [10, 14], gap: 8, radius: 10, fill: C.card, stroke: C.border });
  S.icon(lv, "circleCheck", 15, C.green); S.txt(lv, "Livrée aujourd'hui", { size: 13, weight: 600 }); S.txt(lv, "F3", { size: 12, mono: true, color: C.mfg }); S.txt(lv, "Réaffecter un box", { size: 13 });
  const sp = S.card35(s, "Sprint S42 · Saisie hors ligne", "sprint", { right: (h) => S.txt(h, "12–16 oct.", { size: 12, color: C.mfg }) });
  for (const [k, t, segs, n, b] of [["F3", "Réaffecter un box", ["d", "d", "d", "d"], "4/4", ["livrée", "green"]], ["F4", "Saisir un constat hors ligne", ["d", "d", "d", "p", "t"], "3/5", ["à risque", "amber"]], ["F5", "Envoyer les photos d'un constat", ["d", "p", "b", "t", "t"], "1/5", ["à risque", "amber"]]]) {
    S.hline(sp, C.soft); const r = S.col(sp, { fx: true, pad: [10, 14], gap: 6 }); const a = S.row(r, { fx: true, gap: 8 }); S.txt(a, k, { size: 12, mono: true, color: C.mfg }); S.txt(a, t, { size: 13, weight: 500 }); S.spacer(a); S.txt(a, b[0], { size: 12, color: C[b[1]] });
    const z = S.row(r, { fx: true, gap: 3 }); for (const c of segs) S.box(z, { name: "seg", w: 30, h: 5, radius: 1, fill: S.segColor35(c) }); S.spacer(z); S.txt(z, n, { size: 12, mono: true, color: C.mfg }); }
  const nw = S.card35(s, "En ce moment", "activity", { right: (h) => S.txt(h, "2 sessions T3 Code", { size: 12, color: C.brandText }) });
  S.tabs35(ph, "Dashboard"); return f; };

S.qRow35 = (p, o) => { const C = S.C; const c = S.col(p, { name: "question " + o.q, fx: true, pad: [12, 14], gap: 8, radius: 10, fill: C.card, stroke: o.open ? C.mfg : C.border });
  const a = S.row(c, { fx: true, gap: 8 }); S.txt(a, o.q, { size: 12, mono: true, color: C.mfg }); if (o.blocking) S.kbadge35(a, "bloquante", C.red, { bg: C.redSoft, icon: "lock" }); S.spacer(a); S.txt(a, o.age, { size: 12, color: C.dim }); S.icon(a, o.open ? "chevDown" : "chevRight", 15, C.dim);
  S.txt(c, o.text, { size: 14, weight: 500, fill: true });
  const m = S.row(c, { fx: true, gap: 8 }); S.kbadge35(m, o.to, C.mfg, { icon: "user" }); S.txt(m, o.key, { size: 12, mono: true, color: C.mfg }); S.txt(m, "· " + o.f, { size: 12, color: C.mfg });
  if (o.open) { S.hline(c, C.soft);
    const fld = S.col(c, { name: "answer", fx: true, h: 84, pad: [10, 12], radius: 8, stroke: C.input, fill: C.bg }); S.txt(fld, "Écris ta réponse…", { size: 14, color: C.dim });
    const b = S.row(c, { fx: true, gap: 8 }); S.btn35(b, "Répondre", "default", { sm: true, icon: "send" }); S.btn35(b, "Marquer envoyée", "outline", { sm: true, icon: "check" }); S.spacer(b); S.iconBtn35(b, "more"); }
  return c; };
S.draw35.questions = (mode) => { const { f, ph } = S.phone35("questions", mode), C = S.C;
  S.header35(ph, "Questions", { right: (h) => S.iconBtn35(h, "plus", { name: "Nouvelle question" }) });
  const tb = S.col(ph, { name: "toolbar", fx: true, pad: [10, 16], gap: 10 });
  S.seg35(tb, [["Ouvertes", null, "3"], ["Répondues"], ["Toutes"], ["Archivées"]], "Ouvertes");
  const r = S.row(tb, { fx: true, gap: 8 }); S.btn35(r, "Pour : tous", "outline", { sm: true, icon: "user" }); S.btn35(r, "Ticket : tous", "outline", { sm: true, icon: "ticket" }); S.spacer(r); S.iconBtn35(r, "share", { name: "Exporter (copie)" });
  S.hline(ph, C.border);
  const ct = S.content35(ph);
  const l = S.col(ct, { name: "list", x: 16, y: 12, w: S.W35 - 32, gap: 10 });
  const sm = S.row(l, { gap: 6 }); S.icon(sm, "lock", 13, C.red); S.txt(sm, "1 bloquante en tête · 3 ouvertes", { size: 12.5, color: C.mfg });
  S.qRow35(l, { q: "Q14", text: "Un box réaffecté garde-t-il ses photos ?", to: "Client", key: "SILO-51", f: "F6", age: "3 j", blocking: true, open: true });
  S.qRow35(l, { q: "Q16", text: "Quota par client : 2 Go ou 5 Go ?", to: "Produit", key: "SILO-34", f: "F5", age: "1 j" });
  S.qRow35(l, { q: "Q17", text: "Un rapport par chef de centre ou par client ?", to: "Client", key: "SILO-81", f: "F7", age: "2 h" });
  S.tabs35(ph, "Questions"); return f; };

S.kv35 = (p, label, build) => { const C = S.C; const r = S.row(p, { fx: true, h: 36, gap: 10 }); const l = S.row(r, { w: 84 }); S.txt(l, label, { size: 13, color: C.mfg }); const v = S.row(r, { fx: true, gap: 6 }); build(v); return r; };
S.select35 = (p, build, o = {}) => { const C = S.C; const s = S.row(p, { name: o.name || "select", h: 44, gap: 6, pad: [0, 10], radius: 8, stroke: C.border, fill: o.off ? C.muted : null });
  build(s); S.icon(s, "chevDown", 13, C.dim); if (o.off) s.opacity = 0.5; return s; };
S.ficheTop35 = (p, key) => { const C = S.C; const t = S.row(p, { name: "sheet-header", fx: true, h: 52, pad: [0, 8, 0, 6], gap: 4 });
  const bk = S.row(t, { name: "back", h: 44, pad: [0, 8, 0, 2], gap: 2 }); S.icon(bk, "chevLeft", 22, C.fg); S.txt(bk, "Kanban", { size: 15, color: C.fg });
  S.spacer(t); const k = S.row(t, { gap: 6, pad: [0, 8] }); S.txt(k, key, { size: 13, mono: true, color: C.mfg, name: "key" }); S.icon(k, "copy", 14, C.dim);
  S.iconBtn35(t, "more", { stroke: false }); S.hline(p, C.border); return t; };
S.fiche35 = (ph, o) => { const C = S.C, off = !!o.off;
  const ct = S.content35(ph); const b = S.col(ct, { name: "sheet-body", x: 16, y: 16, w: S.W35 - 32, gap: 14 });
  const hl = S.row(b, { gap: 6 }); S.kbadge35(hl, o.f, C.mfg, { icon: "box", mono: true }); S.kbadge35(hl, "S42", C.mfg, { icon: "sprint", mono: true }); if (o.pr) S.kbadge35(hl, "PR " + o.pr, C.fg, { icon: "pr", ic: C.purple, mono: true });
  S.txt(b, o.title, { size: 22, weight: 600, ls: -0.3, fill: true });
  const m = S.row(b, { fx: true, gap: 8, wrap: true });
  S.select35(m, (s) => { S.status(s, o.status, 8); S.txt(s, o.status, { size: 13 }); }, { name: "status", off });
  S.select35(m, (s) => { S.avatar(s, "A", 20); S.txt(s, "Adam (moi)", { size: 13 }); }, { name: "assignee", off });
  if (o.banner) { const bn = S.row(b, { name: "tracking-banner", fx: true, h: 44, pad: [0, 12], gap: 6, radius: 8, fill: C.amberSoft, stroke: C.border });
    S.icon(bn, "pr", 14, C.amber); S.txt(bn, "PR #20", { size: 13, weight: 600, mono: true }); S.txt(bn, "· changements demandés", { size: 13, weight: 500, color: C.amber }); S.spacer(bn); S.txt(bn, "GitHub ↗", { size: 12.5, weight: 500 }); }
  const go = S.btn35(b, off ? "Lancer dans T3 · indisponible, Mac éteint" : "Lancer dans T3", off ? "soft" : "outline", { icon: "terminal", pad: [11, 14] }); S.fillX(go);
  if (off) { go.opacity = 0.6; }
  else if (o.live) { const lv = S.row(b, { gap: 6 }); S.dot(lv, C.brand, 6); S.txt(lv, "T3 · attend ta réponse", { size: 12.5, weight: 500, color: C.brandText }); }
  const tw = S.col(b, { name: "tabs-wrap", fx: true }); const tabs = S.row(tw, { fx: true });
  for (const [l, on] of [["Détails", true], ["Activité", false]]) { const t = S.col(tabs, { gap: 10, pad: [6, 14, 0, 14] }); S.txt(t, l, { size: 14, weight: on ? 600 : 400, color: on ? C.fg : C.mfg }); S.box(t, { w: 10, h: 2, fx: true, fill: on ? C.fg : null }); }
  S.hline(tw, C.soft);
  const tr = S.col(b, { name: "Suivi", fx: true, gap: 0 }); S.txt(tr, "Suivi", { size: 14, weight: 600 });
  for (const [l, fn] of o.kv) S.kv35(tr, l, fn);
  const ds = S.col(b, { name: "Description", fx: true, gap: 6 }); const dh = S.row(ds, { fx: true }); S.txt(dh, "Description", { size: 14, weight: 600 }); S.spacer(dh); S.txt(dh, "Modifier", { size: 13, weight: 500, color: off ? C.faint : C.fg });
  S.txt(ds, o.desc, { size: 14, lh: 1.5, fill: true });
  return b; };
S.draw35.fiche = (mode) => { const { f, ph } = S.phone35("fiche", mode), C = S.C;
  S.ficheTop35(ph, "SILO-45");
  S.fiche35(ph, { f: "F4", pr: "#20", title: "Conflits de saisie", status: "En review", banner: true, live: true,
    desc: "Deux saisies hors ligne du même constat : garder la plus récente et signaler l'autre au chef de centre au retour du réseau.",
    kv: [["Branche", (v) => { S.icon(v, "branch", 13, C.blue); S.txt(v, "feat/silo-45", { size: 13, mono: true }); }],
      ["CI", (v) => { S.icon(v, "circleX", 13, C.red); S.txt(v, "rouge · job e2e", { size: 13, color: C.mfg }); }],
      ["Livraison", (v) => { S.segs(v, S.stepColors(9), { w: 5, h: 12, gap: 2, radius: 1 }); S.txt(v, "Étape 9/12 · Review", { size: 13 }); }],
      ["Requise", (v) => { S.txt(v, "oui", { size: 13 }); }]] });
  S.tabs35(ph, "Kanban"); return f; };

S.draw35["mac-eteint"] = (mode) => { const { f, ph } = S.phone35("mac-eteint", mode), C = S.C;
  S.ficheTop35(ph, "SILO-46"); S.offline35(ph);
  S.fiche35(ph, { f: "F4", title: "Démo client", status: "À faire", off: true,
    desc: "Aucune description.",
    kv: [["Démarrable", (v) => { S.dot(v, C.green, 8); S.txt(v, "aucune dépendance en attente", { size: 13, color: C.mfg }); }],
      ["Facultative", (v) => { S.txt(v, "oui", { size: 13 }); }]] });
  S.tabs35(ph, "Kanban");
  const toast = S.row(f, { name: "toast", x: 16, y: S.H35 - 90 - 16 - 64, w: S.W35 - 32, h: 64, pad: [0, 14], gap: 10, radius: 12, fill: C.card, stroke: C.border, shadow: 8 });
  S.icon(toast, "wifiOff", 16, C.red); const tt = S.col(toast, { fx: true, gap: 2 }); S.txt(tt, "Mac éteint : lancement refusé", { size: 13.5, weight: 600 });
  S.txt(tt, "Rien n'est mis en attente. Réessaie Mac allumé.", { size: 12.5, color: C.mfg, fill: true }); return f; };

S.lotLine35 = (p, title, sub) => { const C = S.C; const r = S.row(p, { fx: true, pad: [10, 14], gap: 10, align: "start" });
  const cb = S.box(r, { name: "checkbox", w: 18, h: 18, radius: 4, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(cb, "check", 12, "#FFFFFF", 3);
  const t = S.col(r, { fx: true, gap: 2 }); S.txt(t, title, { size: 14, weight: 500 }); S.txt(t, sub, { size: 12.5, color: C.mfg, fill: true }); return r; };
S.draw35.agent = (mode) => { const { f, ph } = S.phone35("agent", mode), C = S.C;
  const h = S.row(ph, { name: "agent-header", fx: true, h: 52, pad: [0, 8, 0, 6], gap: 8 });
  S.iconBtn35(h, "chevLeft", { stroke: false, isz: 22, color: C.fg, name: "Fermer" }); S.agentMark(h, 28); S.txt(h, "Agent de projet · Silo", { size: 15, weight: 600 }); S.spacer(h);
  S.iconBtn35(h, "list", { stroke: false, name: "Sessions passées" }); S.hline(ph, C.border);
  const ct = S.content35(ph); const cv = S.col(ct, { name: "conversation", x: 16, y: 16, w: S.W35 - 32, gap: 14 });
  const ub = S.row(cv, { fx: true, justify: "end" }); const bub = S.col(ub, { w: 240, pad: [10, 14], gap: 4, radius: 12, fill: C.muted }); S.txt(bub, "Fais le point du jour", { size: 14 }); S.txt(bub, "14:38", { size: 12, color: C.dim });
  const ar = S.row(cv, { fx: true, gap: 10, align: "start" }); S.agentMark(ar, 24); const at = S.col(ar, { fx: true, gap: 8 });
  S.txt(at, "F3 est livrée : 3 fonctionnalités sur 9.", { size: 14, lh: 1.5, fill: true });
  S.txt(at, "S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.", { size: 14, lh: 1.5, fill: true });
  S.txt(at, "Lu : Planning, F5, journal des étapes", { size: 12.5, color: C.dim });
  const lot = S.col(cv, { name: "lot", fx: true, radius: 12, fill: C.brandSoft, stroke: C.brandLine, gap: 0 });
  const lh = S.row(lot, { fx: true, h: 44, pad: [0, 14], gap: 8 }); S.txt(lh, "Lot n° 7", { size: 14, weight: 600, color: C.brandText }); S.spacer(lh); S.txt(lh, "3 actions", { size: 12.5, color: C.mfg });
  for (const [t, s] of [["SILO-30 (F5) vers S43", "4 étapes restantes, S42 finit aujourd'hui"], ["SILO-90 (F9) vers S44", "seule fonctionnalité à planifier"], ["Relancer Q14", "bloque F6, prévue en S43"]]) { S.hline(lot, C.brandLine); S.lotLine35(lot, t, s); }
  S.hline(lot, C.brandLine); const lb = S.row(lot, { fx: true, pad: [10, 14], gap: 8 }); S.btn35(lb, "Valider (3)", "brand", { sm: true }); S.btn35(lb, "Refuser", "outline", { sm: true }); S.btn35(lb, "Commenter", "ghost", { sm: true, icon: "message" });
  const cp = S.col(ph, { name: "compose", fx: true, fill: C.bg }); S.hline(cp, C.border);
  const ci = S.row(cp, { fx: true, pad: [10, 16, 6, 16], gap: 8 }); const fld = S.row(ci, { name: "input", fx: true, h: 44, pad: [0, 8, 0, 14], gap: 8, radius: 22, stroke: C.input });
  S.txt(fld, "Écris à l'agent de projet…", { size: 14, color: C.dim }); S.spacer(fld); const sd = S.box(fld, { name: "send", w: 32, h: 32, radius: 16, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(sd, "send", 15, "#FFFFFF");
  S.homeBar35(cp); return f; };

S.draw35.appairage = (mode) => { const { f, ph } = S.phone35("appairage", mode), C = S.C;
  const ct = S.col(ph, { name: "pairing", fx: true, fy: true, pad: [24, 24, 0, 24], gap: 18 });
  const lg = S.row(ct, { gap: 10 }); const mk = S.box(lg, { name: "logo", w: 32, h: 32, radius: 8, fill: C.fg, dir: "row", align: "center", justify: "center", gap: 2 });
  for (const hh of [14, 9, 18]) S.box(mk, { name: "bar", w: 4, h: hh, radius: 1, fill: C.bg }); S.txt(lg, "Kibo", { size: 18, weight: 600 });
  const tt = S.col(ct, { fx: true, gap: 6 }); S.txt(tt, "Appairer ce téléphone", { size: 24, weight: 600, ls: -0.3 });
  S.txt(tt, "Sur le Mac : Paramètres › Téléphone › Appairer. Scanne le QR code qui s'affiche.", { size: 14, lh: 1.5, color: C.mfg, fill: true });
  const cam = S.box(ct, { name: "scanner", w: 342, h: 300, radius: 16, fill: "#0E0E10", clip: true });
  const sq = 200, ox = (342 - sq) / 2, oy = 34, L = 34, T = 4;
  for (const [x, y, w, h] of [[ox, oy, L, T], [ox, oy, T, L], [ox + sq - L, oy, L, T], [ox + sq - T, oy, T, L], [ox, oy + sq - T, L, T], [ox, oy + sq - L, T, L], [ox + sq - L, oy + sq - T, L, T], [ox + sq - T, oy + sq - L, T, L]])
    S.box(cam, { name: "corner", x, y, w, h, radius: 2, fill: "#FFFFFF" });
  S.box(cam, { name: "scan-line", x: ox + 12, y: oy + sq / 2, w: sq - 24, h: 2, radius: 1, fill: "#F97316" });
  const hint = S.row(cam, { name: "hint", x: 0, y: oy + sq + 22, w: 342, justify: "center", gap: 6 }); S.icon(hint, "camera", 14, "#D4D4D8"); S.txt(hint, "Vise le QR code affiché sur le Mac", { size: 13, color: "#D4D4D8" });
  const or = S.row(ct, { fx: true, gap: 10 }); S.hline(or, C.border); S.txt(or, "ou", { size: 12.5, color: C.dim }); S.hline(or, C.border);
  const fl = S.col(ct, { fx: true, gap: 6 }); S.txt(fl, "Coller le code", { size: 13, weight: 500 });
  const inp = S.row(fl, { name: "code-input", fx: true, h: 44, pad: [0, 14], radius: 8, stroke: C.input, fill: C.bg }); S.txt(inp, "KIBO-XXXX-XXXX-XXXX", { size: 14, mono: true, color: C.dim });
  const go = S.btn35(ct, "Appairer", "default", {}); S.fillX(go);
  const nt = S.row(ct, { fx: true, gap: 8, align: "start" }); S.icon(nt, "shield", 14, C.mfg); S.txt(nt, "La clé reste sur ce téléphone et sur le Mac : le serveur ne la voit jamais.", { size: 12.5, color: C.mfg, fill: true });
  S.homeBar35(ph); return f; };

S.scrim35 = (f) => S.box(f, { name: "scrim", x: 0, y: 0, w: S.W35, h: S.H35, fill: "#000000", op: S.mode === "dark" ? 0.6 : 0.4 });
S.sheet35 = (f, title, build) => { const C = S.C; S.scrim35(f);
  const sh = S.col(f, { name: "bottom-sheet", x: 0, y: 200, w: S.W35, fill: C.bg, stroke: C.border, pad: [8, 16, 0, 16], gap: 4, shadow: 12 });
  sh.borderRadiusTopLeft = 16; sh.borderRadiusTopRight = 16;
  const gr = S.row(sh, { fx: true, h: 12, justify: "center" }); S.box(gr, { name: "grabber", w: 36, h: 5, radius: 3, fill: C.border });
  if (title) { const h = S.row(sh, { name: "sheet-title", fx: true, h: 44, gap: 8 }); title(h); }
  build(sh); S.homeBar35(sh);
  S.post35.push(() => { sh.x = f.x; sh.y = f.y + S.H35 - sh.height; }); return sh; };
S.menuItem35 = (p, icon, label, o = {}) => { const C = S.C; const r = S.row(p, { name: "menu-item " + label, fx: true, h: 48, pad: [0, 4], gap: 12 });
  S.icon(r, icon, 18, o.danger ? C.red : o.brand ? C.brand : C.mfg); S.txt(r, label, { size: 15, weight: 500, color: o.danger ? C.red : C.fg }); S.spacer(r);
  if (o.hint) S.txt(r, o.hint, { size: 13, color: C.dim }); if (o.chev) S.icon(r, "chevRight", 16, C.dim); return r; };

S.draw35["kanban-menu"] = (mode) => { const f = S.draw35.kanban(mode), C = S.C;
  f.name = S.name35("kanban-menu") + (mode === "light" ? " (clair)" : ""); f.y = S.KEYS35.indexOf("kanban-menu") * S.STEP35;
  S.sheet35(f, (h) => { S.txt(h, "SILO-45", { size: 13, mono: true, color: C.mfg }); S.txt(h, "Conflits de saisie", { size: 15, weight: 600 }); }, (sh) => {
    S.menuItem35(sh, "arrowRight", "Déplacer vers…", { hint: "En review", chev: true });
    S.menuItem35(sh, "terminal", "Lancer dans T3", { brand: true });
    S.menuItem35(sh, "external", "Ouvrir la fiche");
    S.menuItem35(sh, "copy", "Copier la clé");
    S.hline(sh, C.soft);
    S.menuItem35(sh, "lock", "Bloquer…", { hint: "avec un motif" });
    S.menuItem35(sh, "pause", "Mettre en attente…");
    S.menuItem35(sh, "x", "Retirer", { danger: true }); });
  return f; };

S.draw35["graphe-legende"] = (mode) => { const f = S.draw35.graphe(mode), C = S.C;
  f.name = S.name35("graphe-legende") + (mode === "light" ? " (clair)" : ""); f.y = S.KEYS35.indexOf("graphe-legende") * S.STEP35;
  S.sheet35(f, (h) => { S.txt(h, "Légende et sprints", { size: 16, weight: 600 }); S.spacer(h); S.btn35(h, "OK", "ghost", { sm: true }); }, (sh) => {
    S.txt(sh, "Sprint affiché", { size: 13, weight: 600, color: C.mfg });
    const ch = S.row(sh, { fx: true, gap: 8, wrap: true, pad: [4, 0, 8, 0] });
    for (const [l, on] of [["Tous", false], ["S41", false], ["S42", true], ["S43", false], ["S44", false], ["À planifier", false]]) {
      const c = S.row(ch, { name: "sprint-chip " + l, h: 44, pad: [0, 14], radius: 22, fill: on ? C.fg : null, stroke: on ? null : C.border }); S.txt(c, l, { size: 14, weight: 500, mono: /^S\d/.test(l), color: on ? C.bg : C.fg }); }
    S.hline(sh, C.soft);
    S.txt(sh, "Statut des étapes", { size: 13, weight: 600, color: C.mfg });
    const g = S.row(sh, { fx: true, gap: 16, wrap: true, pad: [4, 0, 8, 0] });
    for (const st of ["À faire", "En cours", "En review", "Bloqué", "Terminé"]) { const r = S.row(g, { h: 28, gap: 8 }); S.status(r, st, 9); S.txt(r, st, { size: 14 }); }
    const hr = S.row(g, { h: 28, gap: 8 }); S.dot(hr, C.hold, 9); S.txt(hr, "En attente", { size: 14 });
    S.hline(sh, C.soft);
    S.txt(sh, "Bordures et repères", { size: 13, weight: 600, color: C.mfg });
    const leg = (build, text) => { const r = S.row(sh, { fx: true, h: 36, gap: 12 }); build(r); S.txt(r, text, { size: 14 }); };
    leg((r) => { const b = S.row(r, { w: 28, h: 18, radius: 5, stroke: C.brand, justify: "center" }); S.dot(b, C.brand, 6); }, "Session T3 active");
    leg((r) => S.box(r, { w: 28, h: 18, radius: 5, stroke: C.green }), "Démarrable : appui long, Lancer dans T3");
    leg((r) => S.box(r, { w: 28, h: 18, radius: 5, stroke: C.red }), "Fonctionnalité en retard");
    leg((r) => S.box(r, { w: 28, h: 18, radius: 5, stroke: C.border, dashed: true }), "Fonctionnalité, segments = étapes");
    leg((r) => { const g2 = S.row(r, { w: 28, gap: 2 }); for (const c of [C.fg, C.purple, C.blue, C.track]) S.box(g2, { w: 5.5, h: 5, radius: 1, fill: c }); }, "Fait · review · en cours · à faire"); });
  return f; };

S.section35 = (p, title, o = {}) => { const C = S.C; const c = S.col(p, { name: "section " + title, fx: true, gap: 8 });
  const h = S.row(c, { fx: true, h: 28, gap: 8 }); S.txt(h, title, { size: 14, weight: 600 }); if (o.count) S.txt(h, o.count, { size: 12.5, mono: true, color: C.dim }); return c; };
S.draw35["fiche-suite"] = (mode) => { const { f, ph } = S.phone35("fiche-suite", mode), C = S.C;
  S.ficheTop35(ph, "SILO-45");
  const ct = S.content35(ph); const b = S.col(ct, { name: "sheet-body", x: 16, y: 12, w: S.W35 - 32, gap: 18 });
  const ds = S.section35(b, "Description"); S.txt(ds, "Deux saisies hors ligne du même constat : garder la plus récente et signaler l'autre au chef de centre au retour du réseau.", { size: 14, lh: 1.5, fill: true });
  const lb = S.section35(b, "Étiquettes"); S.btn35(lb, "Ajouter une étiquette", "outline", { sm: true, icon: "tag" });
  const dp = S.section35(b, "Liens et dépendances", { count: "1" });
  const ln = S.row(dp, { name: "link SILO-46", fx: true, h: 44, pad: [0, 12], gap: 8, radius: 8, stroke: C.border, fill: C.card });
  S.txt(ln, "requise par", { size: 12.5, color: C.mfg }); S.ring(ln, C.dim, 8); S.txt(ln, "SILO-46", { size: 12.5, mono: true, color: C.mfg }); S.txt(ln, "Démo client", { size: 13.5, weight: 500 }); S.spacer(ln); S.icon(ln, "x", 15, C.dim);
  S.btn35(dp, "Ajouter une dépendance", "outline", { sm: true, icon: "plus" });
  const qs = S.section35(b, "Questions", { count: "0" }); S.txt(qs, "Aucune question sur ce ticket.", { size: 13, color: C.mfg }); S.btn35(qs, "Poser une question", "outline", { sm: true, icon: "question" });
  const st = S.section35(b, "Sous-tickets", { count: "0" }); S.btn35(st, "Ajouter un sous-ticket", "outline", { sm: true, icon: "plus" });
  const hd = S.section35(b, "Mise en attente"); S.txt(hd, "Met l'étape de côté sans changer son statut.", { size: 13, color: C.mfg, fill: true }); S.btn35(hd, "Mettre en attente…", "outline", { sm: true, icon: "pause" });
  S.tabs35(ph, "Kanban");
  S.scrim35(f);
  const mn = S.col(f, { name: "more-menu", x: S.W35 - 16 - 264, y: 47 + 52 - 4, w: 264, pad: 6, gap: 0, radius: 12, fill: C.card, stroke: C.border, shadow: 12 });
  S.menuItem35(mn, "terminal", "Lancer dans T3", { brand: true }); S.menuItem35(mn, "copy", "Copier /full-delivery SILO-45"); S.menuItem35(mn, "link", "Copier le lien");
  S.menuItem35(mn, "pause", "Mettre en attente…"); S.hline(mn, C.soft); S.menuItem35(mn, "x", "Supprimer le ticket", { danger: true });
  return f; };

S.draw35["dashboard-suite"] = (mode) => { const { f, ph } = S.phone35("dashboard-suite", mode), C = S.C;
  S.header35(ph, "Dashboard");
  const ct = S.content35(ph); const s = S.col(ct, { name: "stack", x: 16, y: 12, w: S.W35 - 32, gap: 12 });
  const nx = S.card35(s, "Prochaine à finir", "flag", { right: (h) => S.txt(h, "la plus avancée", { size: 12, color: C.mfg }) });
  const nb = S.col(nx, { fx: true, pad: [0, 14, 12, 14], gap: 8 }); const a = S.row(nb, { fx: true, gap: 8 }); S.txt(a, "F4", { size: 12, mono: true, color: C.mfg }); S.txt(a, "Saisir un constat hors ligne", { size: 14, weight: 600 }); S.spacer(a); S.txt(a, "3/5", { size: 12, mono: true, color: C.mfg });
  const r1 = S.row(nb, { fx: true, gap: 8 }); S.dot(r1, C.purple, 8); S.txt(r1, "SILO-45", { size: 12, mono: true, color: C.mfg }); S.txt(r1, "Conflits de saisie", { size: 13 }); S.txt(r1, "changements demandés", { size: 12, color: C.amber });
  const r2 = S.row(nb, { fx: true, gap: 8 }); S.ring(r2, C.dim, 8); S.txt(r2, "SILO-46", { size: 12, mono: true, color: C.mfg }); S.txt(r2, "Démo client", { size: 13 });
  const go = S.btn35(nb, "Lancer SILO-45 dans T3", "outline", { sm: true, icon: "terminal" }); S.fillX(go);
  const ec = S.card35(s, "Échéances", "calendar", { right: (h) => S.txt(h, "aujourd'hui · ven. 16 oct.", { size: 12, color: C.mfg }) });
  for (const [k, t, sp, note, col] of [["F4", "Saisir un constat hors ligne", "S42", "finit ce soir", "mfg"], ["F5", "Envoyer les photos d'un constat", "S42", "glisse en S43", "amber"], ["F6", "Importer les box depuis Excel", "S43", "bloquée · Q14", "red"], ["F8", "Valider les contrats par lot", "S43", "19–23 oct.", "mfg"], ["F7", "Rapport de centre journalier", "S44", "26–30 oct.", "mfg"]]) {
    S.hline(ec, C.soft); const r = S.row(ec, { fx: true, h: 44, pad: [0, 14], gap: 8 }); S.txt(r, k, { size: 12, mono: true, color: C.mfg }); S.txt(r, t, { size: 13 }); S.spacer(r);
    const z = S.col(r, { gap: 1, align: "end" }); S.txt(z, sp, { size: 12, mono: true, weight: 600 }); S.txt(z, note, { size: 11.5, color: C[col] }); }
  const av = S.card35(s, "Activité", "activity");
  for (const [t, ic, col, text, key] of [["14:51", "flag", "mfg", "Étape 7/12 · Porte qualité", "SILO-33"], ["14:40", "bot", "brand", "Agent de projet · lot n° 7 proposé", null], ["14:36", "merge", "green", "PR #18 fusionnée · F3 livrée", "SILO-21"], ["13:47", "pr", "amber", "Changements demandés sur PR #20", "SILO-45"]]) {
    S.hline(av, C.soft); const r = S.row(av, { fx: true, h: 44, pad: [0, 14], gap: 10 }); S.txt(r, t, { size: 12, mono: true, color: C.mfg }); S.icon(r, ic, 14, C[col]);
    S.txt(r, text, { size: 13, color: ic === "bot" ? C.brandText : C.fg }); S.spacer(r); if (key) S.txt(r, key, { size: 11.5, mono: true, color: C.mfg }); }
  S.tabs35(ph, "Dashboard"); return f; };

S.drawP35 = async (k, mode) => { await S.page("Phase 35 · Téléphone"); S.placed = [];
  for (const c of penpot.currentPage.root.children) if (c.name === S.name35(k) + (mode === "light" ? " (clair)" : "")) c.remove();
  S.post35 = []; const f = S.draw35[k](mode); await S.wait(500); S.replace(); for (const fn of S.post35) fn(); if (S.post35.length) { await S.wait(300); for (const fn of S.post35) fn(); } return { id: f.id, name: f.name, shapes: S.count(f) }; };
S.exportP35 = async (keys = S.KEYS35) => { await S.page("Phase 35 · Téléphone"); const out = [];
  for (const k of keys) for (const mode of ["dark", "light"]) { const b = S.board(S.name35(k) + (mode === "light" ? " (clair)" : ""));
    if (!b) { out.push(k + " " + mode + " absent"); continue; }
    const bytes = await b.export({ type: "png", scale: 2 }); const file = `proposition-p35-${k}-${mode}.png`;
    const r = await fetch(`${S.RECV}/upload?name=${encodeURIComponent(file)}`, { method: "POST", body: bytes }); out.push(file + " " + (r.ok ? bytes.length : "échec")); }
  return out; };
return "phase 35 ok";
