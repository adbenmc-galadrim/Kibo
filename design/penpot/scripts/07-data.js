// Jeu de données de référence (design/donnees-fictives.md) et vues qui en dépendent.
const S = storage, C = S.C;

// Couleurs de statut (pastille ronde ; Backlog = anneau creux) et d'état de run d'agent
S.STATUS = { "Backlog": null, "À faire": C.mfg, "En cours": C.blue, "En review": C.purple, "Bloqué": C.red, "Terminé": C.green };
S.RUN = { running: C.blue, waiting: C.amber, queued: C.cyan, done: C.green, failed: C.red };

S.KANBAN = {
  "Backlog": [{ id: "KIB-22", title: "Export Markdown / Obsidian", domain: "Intégrations" }],
  "À faire": [
    { id: "KIB-9", title: "Setup Tauri + sidecar Bun", domain: "DevOps", sub: "2/3" },
    { id: "KIB-15", title: "Kanban : drag & drop entre colonnes", domain: "UI", wait: "KIB-12" },
    { id: "KIB-18", title: "Adaptateur GitHub Issues", domain: "Intégrations", agent: "opus-dev", run: "queued", runL: "En file #2" }],
  "En cours": [
    { id: "KIB-12", title: "Schéma Loro des tickets (LoroTree)", domain: "Core", sub: "3/5", agent: "opus-dev-1", run: "running" },
    { id: "KIB-14", title: "Récepteur de hooks Claude Code", domain: "Agents", agent: "opus-dev-2", run: "waiting", runL: "Attend" },
    { id: "KIB-16", title: "Moteur de règles déclaratif", domain: "Agents", agent: "opus-dev-3", run: "running" },
    { id: "KIB-10", title: "Watcher git et gh", domain: "Agents", agent: "opus-dev", run: "queued", runL: "En file #1" }],
  "En review": [
    { id: "KIB-7", title: "Tokens shadcn + thème sombre", domain: "UI", pr: "#12", agent: "sonnet-review", run: "running", runL: "Review" },
    { id: "KIB-11", title: "Démon : auth par jeton local", domain: "Sécurité", pr: "#15" }],
  "Bloqué": [{ id: "KIB-21", title: "Sandbox iframe des composants", domain: "Sécurité", sub: "0/4", motif: "Audit sécurité externe en attente" }],
  "Terminé": [
    { id: "KIB-5", title: "Monorepo Bun workspaces", domain: "DevOps" },
    { id: "KIB-13", title: "Snapshots Loro ↔ SQLite", domain: "Core" }],
};

S.statusDot = (p, status, sz = 8) => {
  const d = penpot.createEllipse(); d.resize(sz, sz); d.name = "status";
  const c = S.STATUS[status];
  if (c) d.fills = [{ fillColor: c, fillOpacity: 1 }];
  else { d.fills = []; d.strokes = [{ strokeColor: C.mfg, strokeWidth: 1.5, strokeAlignment: "inner", strokeOpacity: 1 }]; }
  p.appendChild(d); return d; };

S.domainChip = (p, domain) => {
  const dom = S.box(p, { name: "domain", stroke: C.border, radius: 4, dir: "row", gap: 4, pad: [1, 6], hs: "auto", vs: "auto", align: "center" });
  S.box(dom, { name: "sq", fill: S.domainColors[domain] || C.mfg, radius: 1, w: 7, h: 7 });
  S.txt(dom, domain, { size: 10, color: C.mfg }); return dom; };

// Badge d'agent : profil neutre, la couleur ne dit que l'état du run
S.agentBadge = (p, name, run, label) => {
  const a = S.box(p, { name: "agent", fill: C.muted, radius: 999, dir: "row", gap: 4, pad: [2, 6], hs: "auto", vs: "auto", align: "center" });
  S.dot(a, S.RUN[run] || C.mfg, 6); S.icon(a, "bot", 12, C.mfg); S.txt(a, name, { size: 10, color: C.mfg });
  if (label) S.txt(a, "· " + label, { size: 10, color: S.RUN[run] || C.mfg });
  return a; };

S.card = (parent, t) => {
  const card = S.box(parent, { name: "TicketCard / " + t.id, fill: C.card, stroke: C.border, radius: 8, dir: "column", gap: 8, pad: 10, vs: "auto" }); S.fillX(card);
  const top = S.box(card, { name: "top", dir: "row", gap: 6, vs: "auto", align: "center" }); S.fillX(top);
  S.fillX(S.txt(top, t.id, { size: 11, color: C.dim, mono: true }));
  if (t.pr) { const pr = S.box(top, { name: "pr", stroke: C.border, radius: 999, dir: "row", gap: 3, pad: [1, 6], hs: "auto", vs: "auto", align: "center" }); S.icon(pr, "git", 11, C.mfg); S.txt(pr, t.pr, { size: 10, color: C.mfg, mono: true }); }
  S.fillX(S.txt(card, t.title, { size: 13, weight: 500, lh: 1.35 }));
  if (t.motif) S.fillX(S.txt(card, "Motif : " + t.motif, { size: 11, color: C.red, lh: 1.3 }));
  const meta = S.box(card, { name: "meta", dir: "row", gap: 6, vs: "auto", align: "center" }); S.fillX(meta);
  meta.flex.wrap = "wrap";
  S.domainChip(meta, t.domain);
  if (t.sub) { const s = S.box(meta, { name: "sub", dir: "row", gap: 3, hs: "auto", vs: "auto", align: "center" }); S.icon(s, "subtask", 12, C.dim); S.txt(s, t.sub, { size: 10, color: C.dim, mono: true }); }
  if (t.wait) { const w = S.box(meta, { name: "wait", stroke: C.border, radius: 4, dir: "row", gap: 3, pad: [1, 6], hs: "auto", vs: "auto", align: "center" }); S.icon(w, "link", 11, C.mfg); S.txt(w, "attend " + t.wait, { size: 10, color: C.mfg }); }
  if (t.agent) S.agentBadge(card, t.agent, t.run, t.runL);
  return card; };

S.column = (parent, name, tickets, w, total) => {
  const col = S.box(parent, { name: "Column / " + name, fill: C.muted, op: 0.5, radius: 10, dir: "column", gap: 8, pad: 6, w: w || 180 });
  S.child(col, { v: "fill" });
  const hd = S.box(col, { name: "header", dir: "row", gap: 6, pad: [4, 4], vs: "auto", align: "center" }); S.fillX(hd);
  S.statusDot(hd, name); S.fillX(S.txt(hd, name, { size: 12, weight: 500 })); S.txt(hd, String(total ?? tickets.length), { size: 11, color: C.dim, mono: true });
  tickets.forEach(t => S.card(col, t));
  if (name !== "Terminé") { const add = S.box(col, { name: "add", radius: 6, dir: "row", gap: 4, pad: [4, 6], vs: "auto", align: "center" }); S.fillX(add); S.icon(add, "plus", 12, C.dim); S.txt(add, "Ticket", { size: 11, color: C.dim }); }
  return col; };

// Remplace le contenu de `content` par la vue Kanban de référence
S.fillKanban = (content, o = {}) => {
  [...content.children].forEach(k => k.remove());
  const fl = content.flex; if (fl) { fl.dir = "column"; fl.rowGap = 12; fl.topPadding = 12; fl.rightPadding = 16; fl.bottomPadding = 12; fl.leftPadding = 16; }
  if (o.toolbar !== false) {
    const tb = S.box(content, { name: "Toolbar", dir: "row", gap: 8, vs: "auto", align: "center" }); S.fillX(tb);
    for (const l of ["Domaine : tous", "Assigné : moi + agents", "Grouper : statut"]) { const f = S.box(tb, { name: "Filter-" + l, stroke: C.border, radius: 6, dir: "row", gap: 4, pad: [4, 8], hs: "auto", vs: "auto", align: "center" }); S.txt(f, l, { size: 12, color: C.mfg }); }
    S.fillX(S.box(tb, { name: "sp", h: 1 }));
    S.txt(tb, "13 / 24 tickets", { size: 12, color: C.dim, mono: true });
  }
  const board = S.box(content, { name: "Board", dir: "row", gap: 8 }); S.child(board, { h: "fill", v: "fill" });
  for (const [name, list] of Object.entries(S.KANBAN)) S.column(board, name, list);
  return board; };

// Petit Kanban pour widget : 3 colonnes, mêmes cartes
S.fillMiniKanban = (body, cols = ["À faire", "En cours", "En review"]) => {
  [...body.children].forEach(k => k.remove());
  const w = Math.floor((body.width - 16 * 2 - 8 * (cols.length - 1)) / cols.length);
  for (const name of cols) S.column(body, name, S.KANBAN[name].slice(0, 3), w, S.KANBAN[name].length);
  return body; };

// Régénère la version claire d'un écran sombre (même position que l'ancienne)
S.relight = (darkId, dx = 1540) => {
  const d = penpotUtils.findShapeById(darkId);
  const old = penpot.currentPage.root.children.find(c => c.name === d.name + " (clair)");
  const x = old ? old.x : d.x + dx, y = old ? old.y : d.y; if (old) old.remove();
  const cl = d.clone(); cl.name = d.name + " (clair)"; cl.x = x; cl.y = y; S.toLight(cl);
  const tb = penpotUtils.findShape(s => s.name === "TabBar", cl); if (tb) tb.fills = [{ fillColor: "#F4F4F5", fillOpacity: 1 }];
  return cl.id; };

// Change un texte existant : réappliquer la police force le rendu (sinon l'export garde l'ancien texte)
S.setText = (t, chars) => {
  if (chars !== undefined) t.characters = (chars === "" ? " " : chars);
  const font = /Mono/.test(t.fontFamily || "") ? S.mono : S.font;
  const v = font.variants.find(v => v.fontWeight === String(t.fontWeight || 400) && v.fontStyle === "normal") || font.variants[0];
  font.applyToText(t, v); return t; };
// Remplace un texte partout dans un écran
S.replaceText = (root, from, to) => {
  const hits = penpotUtils.findShapes(s => s.type === "text" && (from instanceof RegExp ? from.test(s.characters) : s.characters === from), root);
  hits.forEach(t => S.setText(t, from instanceof RegExp ? t.characters.replace(from, to) : to)); return hits.length; };

// Navigation : ouvrir une page, retrouver un écran par son numéro, capturer un PNG (via receiver.py)
S.open = async (pre) => { const page = penpotUtils.getPageById(penpotUtils.getPages().find(p => p.name.startsWith(pre)).id);
  if (penpot.currentPage.id !== page.id) { penpot.openPage(page); await new Promise(r => setTimeout(r, 600)); } return page; };
S.pageOf = n => ({ 24: "03", 25: "03", 26: "03", 27: "03", 28: "04", 29: "02", 30: "02", 31: "04" })[n] || (n <= 6 ? "02" : n <= 11 ? "03" : n <= 19 ? "04" : "06");
S.screen = async (n, light) => { await S.open(S.pageOf(n));
  return penpot.currentPage.root.children.find(c => c.type === "board" && c.name.startsWith(n + " ·") && /\(clair\)$/.test(c.name) === !!light); };
S.snap = async (shape, name, scale = 0.5) => { const bytes = await shape.export({ type: "png", scale });
  await fetch("http://127.0.0.1:8787/upload?name=" + encodeURIComponent(name), { method: "POST", body: bytes }); return bytes.length; };
// Remonte au premier ancêtre qui vérifie `pred` (borné, pas de boucle infinie)
S.up = (s, pred) => { for (let i = 0; i < 30 && s; i++) { if (pred(s)) return s; s = s.parent; } return null; };

// Icônes : une icône Lucide par concept (recherche limitée à la sidebar et à la barre d'onglets)
S.swapIcon = (item, name) => { const old = item.children.find(c => /^icon/.test(c.name)); if (!old || /icon ?\/ ?/.test(old.name) && old.name.replace(/ /g, "") === "icon/" + name) return 0;
  const col = penpotUtils.findShapes(x => x.strokes?.length, old)[0]?.strokes[0].strokeColor || C.mfg; const sz = Math.round(old.width);
  const i = item.children.findIndex(c => c.id === old.id); old.remove();
  const ic = S.icon(null, name, sz, col); item.insertChild(Math.max(0, i), ic); return 1; };
S.ICON_OF = { "SidebarItem / Vue d'ensemble": "home", "SidebarItem / Tableau de bord": "dashboard", "SidebarItem / Composants": "puzzle",
  "Tab-Kibo · Tableau de bord": "dashboard", "Tab-KIB-12 · Schéma Loro": "ticket", "Tab-Composants": "puzzle" };
S.fixIcons = (f) => { let n = 0; const scopes = [penpotUtils.findShape(s => s.name === "Sidebar", f), penpotUtils.findShape(s => s.name === "TabBar", f)].filter(Boolean);
  for (const sc of scopes) for (const it of sc.children) { const ic = S.ICON_OF[it.name]; if (ic) n += S.swapIcon(it, ic); } return n; };

// Nouvel écran à partir d'un écran existant de la même page (rangée sous les écrans existants)
S.newScreen = async (baseNum, name, col = 0, row = 0) => { const base = await S.screen(baseNum);
  const root = penpot.currentPage.root; const bottom = Math.max(...root.children.map(c => c.y + c.height));
  const rowY = S._rowY?.[penpot.currentPage.id] ?? (Math.ceil((bottom + 100) / 100) * 100);
  S._rowY = { ...(S._rowY || {}), [penpot.currentPage.id]: rowY };
  const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = base.clone(); f.name = name; f.x = col * 1540; f.y = rowY + row * 1040; return f; };
// Voile + dialogue centré
S.modal = (f, w, title, desc) => { S.overlay(f); const d = S.dialog(f, w, title, desc); return d; };
S.center = (f, d) => { penpotUtils.setParentXY(d, Math.round((f.width - d.width) / 2), Math.max(60, Math.round((f.height - d.height) / 2))); };
S.footer = (d, cancel, ok, variant = "default") => { const ft = S.box(d, { name: "footer", dir: "row", gap: 8, vs: "auto", justify: "end", align: "center" }); S.fillX(ft);
  if (cancel) S.button(ft, cancel, "outline"); S.button(ft, ok, variant); return ft; };

// Contraste du texte coloré en clair (mêmes couleurs que textMap de toLight)
S.LIGHT_TEXT = { "#06B6D4": "#0E7490", "#F59E0B": "#B45309", "#22C55E": "#15803D", "#EF4444": "#B91C1C", "#3B82F6": "#1D4ED8", "#F97316": "#C2410C", "#FCD34D": "#92400E" };
S.fixLightText = (f) => { let n = 0; penpotUtils.findShapes(s => s.type === "text" && S.LIGHT_TEXT[(s.fills?.[0]?.fillColor || "").toUpperCase()], f)
  .forEach(t => { t.fills = t.fills.map(x => ({ ...x, fillColor: S.LIGHT_TEXT[(x.fillColor || "").toUpperCase()] || x.fillColor })); n++; }); return n; };

// Après un clone (relight), le rendu des textes garde l'ancien calcul : réappliquer la police à chaque texte
S.retext = (f) => { let n = 0; for (const t of penpotUtils.findShapes(s => s.type === "text", f)) { try { S.setText(t); n++; } catch (e) {} } return n; };
// Icône avant le libellé dans la sidebar, la barre d'onglets et la nav des paramètres
S.fixIconOrder = (f) => { let n = 0; const scopes = ["Sidebar", "TabBar", "SettingsNav"].map(nm => penpotUtils.findShape(s => s.name === nm, f)).filter(Boolean);
  for (const sc of scopes) for (const it of sc.children) { if (it.type !== "board") continue; const ic = it.children.find(c => /^icon/.test(c.name)); const tx = it.children.find(c => c.type === "text");
    if (ic && tx && ic.x > tx.x) { it.insertChild(0, ic); n++; } } return n; };
S.fixLight = async (n) => { const l = await S.screen(n, true); if (!l) return n + ":none"; return n + ":" + S.retext(l) + "/" + S.fixIconOrder(l); };
