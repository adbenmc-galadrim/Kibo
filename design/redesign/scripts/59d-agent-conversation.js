// Phase 31 (spec §46) : l'agent de projet devient une conversation. « P1 bis · Agent agrandi » clone « P1 bis v3 · Vue d'ensemble » et
// passe le volet à 720 px (liste des agents à gauche, colonne de lecture) ; « Agent de projet, volet » (340 × 1 000, liste ouverte
// par-dessus la conversation) et « Agent de projet, agrandi, liste rétractée » (720 × 1 000) sont des références visuelles.
// Rangées après « P5b · Graphe · en attente », sombre à x = 0, clair à x = 1 540. Conversation et carte de lot : 50-proposition.js.
const S = storage;
S.Y_AC = S.Y_GA + S.STEP27 * S.ROWS_GA.length;
S.ROWS_AC = ["ac-agrandi", "ac-volet", "ac-retractee"];
S.NAMES_AC = { "ac-agrandi": "P1 bis · Agent agrandi", "ac-volet": "Agent de projet, volet", "ac-retractee": "Agent de projet, agrandi, liste rétractée" };
S.FILES_AC = { "P1 bis · Agent agrandi": "agent-agrandi", "Agent de projet, volet": "agent-volet", "Agent de projet, agrandi, liste rétractée": "agent-agrandi-liste-retractee" };
S.WIDE_AC = { panel: 720, list: 210, reading: 520, item: 56, button: 32 };
S.AGENTS_AC = [
  { title: "Fais le point du jour", date: "14:38", messages: "4 messages", current: true },
  { title: "Point de sprint S41", date: "9 oct.", messages: "6 messages" },
  { title: "Relances client", date: "2 oct.", messages: "3 messages" } ];

// ---------- Liste des agents : « Nouvel agent » en tête, puis un item par agent (en cours en tête) ----------
S.agentListAC = (p, o = {}) => { const C = S.C, W = S.WIDE_AC;
  const l = S.col(p, { name: "agent-list", x: o.x, y: o.y, w: o.w, h: o.h, fy: !o.h, pad: 8, gap: 8, fill: C.bg });
  const top = S.row(l, { name: "agent-list-top", w: o.w - 16, gap: 4 });
  const nb = S.btn(top, "Nouvel agent", "outline", { sm: true, icon: "plus" });
  nb.flex.horizontalSizing = "fix"; nb.flex.verticalSizing = "fix"; nb.flex.justifyContent = "start"; nb.resize(nb.width, W.button); nb.layoutChild.horizontalSizing = "fill";
  if (o.close) { const x = S.box(top, { name: "icon-button/Fermer la liste", w: W.button, h: W.button, radius: 6, dir: "row", align: "center", justify: "center" }); S.icon(x, "x", 15, C.dim); }
  const ul = S.col(l, { name: "agents", w: o.w - 16, gap: 2 });
  for (const a of S.AGENTS_AC) {
    const it = S.col(ul, { name: "agent/" + a.title, fx: true, h: W.item, pad: [0, 8], gap: 3, radius: 6, justify: "center", fill: a.current ? C.panel : null });
    S.txt(it, a.title, { size: 13, weight: 500 });
    const m = S.row(it, { gap: 4 }); S.txt(m, `${a.date} · ${a.messages}`, { size: 12, color: C.dim });
    if (a.current) S.txt(m, "en cours", { size: 11, color: C.brandText }); }
  return l; };

// ---------- Volet agrandi (720 px) : liste à gauche si ouverte, conversation en colonne de lecture centrée ----------
S.agentWideAC = (root, list) => { const C = S.C, W = S.WIDE_AC;
  const ap = S.col(root, { name: "agent-panel", w: W.panel, fy: true, fill: C.panel });
  S.agentHeadP(ap, [list ? "panelLeftClose" : "panelLeftOpen", "plus", "minimize2", "x"]);
  const body = S.row(ap, { name: "agent-body", fx: true, fy: true, align: "stretch" });
  if (list) { S.agentListAC(body, { w: W.list }); S.vline(body, C.border); }
  const rd = S.col(body, { name: "agent-reading", fx: true, fy: true, align: "center" });
  const column = (name, o) => list ? S.col(rd, { name, fx: true, ...o }) : S.col(rd, { name, w: W.reading, ...o });
  S.conversationP(column("conversation", { fy: true, pad: [16, 18], gap: 14 }));
  S.hline(rd, C.soft); S.composeP(column("compose-column", {}));
  return ap; };

// ---------- Boards ----------
S.drawACk = {};
S.drawACk["ac-agrandi"] = (x, y) => {
  const f = S.rename(S.cloneScreen("P1 bis v3 · Vue d'ensemble", x, y), S.NAMES_AC["ac-agrandi"]);
  const panel = S.named(f, "agent-panel"), root = S.parentOf(f, panel); panel.remove(); S.agentWideAC(root, true);
  return f; };
S.drawACk["ac-volet"] = (x, y) => { const C = S.C;
  const f = S.screen(S.NAMES_AC["ac-volet"], x, y, 340, 1000);
  const root = S.box(f, { name: "root", w: 340, h: 1000, dir: "row", align: "stretch" }); S.agentPanelP(root);
  S.find29(f, z => z.name.replace(/\s/g, "") === "icon-button/list").fills = [{ fillColor: C.muted, fillOpacity: 1 }];
  S.agentListAC(f, { x: 0, y: 57, w: 340, h: 943, close: true }).bringToFront();
  return f; };
S.drawACk["ac-retractee"] = (x, y) => {
  const f = S.screen(S.NAMES_AC["ac-retractee"], x, y, S.WIDE_AC.panel, 1000);
  S.agentWideAC(S.box(f, { name: "root", w: S.WIDE_AC.panel, h: 1000, dir: "row", align: "stretch" }), false);
  return f; };

// ---------- Volet redessiné en place sur un board existant (P1 bis v3, En retard, P6, « en attente ») ----------
// Équivaut à rejouer S.draw27 / S.draw29, sans redessiner le board entier (l'onglet headless plante sur ces redessins).
S.LATE_AC = [["S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.",
  "S42 est terminé depuis vendredi et F5 n'y a pas tenu : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo."],
  ["4 étapes restantes, S42 finit aujourd'hui", "4 étapes restantes, S42 terminé le 16 oct."], ["14:38", "16 oct. · 14:38"]];
S.swapPanelAC = async (name, mode, late) => { await S.page("Proposition"); S.setMode(mode);
  const f = S.board(mode === "light" ? name + " (clair)" : name); if (!f) throw new Error("missing board: " + name);
  const panel = S.named(f, "agent-panel"), root = S.parentOf(f, panel); panel.remove();
  const refonts = await S.withRefont(() => { const ap = S.agentPanelP(root); if (late) for (const [a, b] of S.LATE_AC) S.setText(ap, a, b); });
  return { board: f.name, shapes: S.count(f), refonts }; };

// ---------- Board sombre refait depuis son clair (le redessin complet plante l'onglet headless) ----------
// Couleur par couleur : celle du nœud de même chemin dans la paire de référence (clair ⇒ sombre), sinon la table des jetons.
S.DARK_AC = { text: { "#C2410C": "#FB923C", "#FFFFFF": "#FFFFFF", "#F4F4F5": "#18181B", "#FAFAFA": "#18181B" },
  other: { "#C2410C": "#C2410C", "#FFFFFF": "#111113", "#F4F4F5": "#18181B", "#FAFAFA": "#0C0C0E" } };
S.darkColorAC = (type, c) => { const u = String(c).toUpperCase(), L = S.PAL.light, D = S.PAL.dark, own = S.DARK_AC[type === "text" ? "text" : "other"];
  if (own[u]) return own[u]; const k = Object.keys(L).find(t => L[t] === u); return k ? D[k] : u; };
S.pathsAC = (b) => { const out = new Map(); const walk = (s, p) => { out.set(p, s); const seen = {};
  for (const c of [...(s.children || [])]) { seen[c.name] = (seen[c.name] || 0) + 1; walk(c, p + "/" + c.name + "#" + seen[c.name]); } }; walk(b, ""); return out; };
S.darkFromLightAC = async (name, refName) => { await S.page("Proposition"); S.setMode("dark");
  const light = S.board(name + " (clair)"), refL = S.pathsAC(S.board(refName + " (clair)")), refD = S.pathsAC(S.board(refName));
  const f = light.clone(); f.x = 0; f.y = light.y; f.name = name;
  const cols = (s) => [...(s.fills || []).map(x => x.fillColor), ...(s.strokes || []).map(x => x.strokeColor)].map(c => String(c).toUpperCase()).join();
  let same = 0, mapped = 0; const texts = [];
  for (const [p, s] of S.pathsAC(f)) { const l = refL.get(p), d = refD.get(p), byRef = l && d && cols(l) === cols(s) && cols(l) !== "";
    const fill = (x, i) => ({ ...x, fillColor: byRef ? d.fills[i].fillColor : S.darkColorAC(s.type, x.fillColor) });
    const stroke = (x, i) => ({ ...x, strokeColor: byRef ? d.strokes[i].strokeColor : S.darkColorAC(s.type, x.strokeColor) });
    if ((s.fills || []).length) s.fills = s.fills.map(fill); if ((s.strokes || []).length) s.strokes = s.strokes.map(stroke);
    if (byRef) same++; else mapped++; if (s.type === "text") texts.push(s); }
  for (const t of texts) { try { S.refont(t); } catch (e) { } }
  return { board: f.name, shapes: S.count(f), same, mapped }; };

// ---------- Dessin et export ----------
S.drawAC = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_AC.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_AC + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.drawACk[key](x, y); await S.wait(600); const moved = S.replace();
  return { board: f.name, shapes: S.count(f), moved }; };
S.exportAC = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_AC)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_AC[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
return "agent conversation ok";
