// Pages des pistes et export PNG vers receiver.py (exports/<nom>.png).
const S = storage;
S.page = async (name) => { let p = penpotUtils.getPages().find(p => p.name === name);
  let page = p ? penpotUtils.getPageById(p.id) : null;
  if (!page) { page = penpot.createPage(); page.name = name; }
  if (penpot.currentPage.id !== page.id) penpot.openPage(page);
  for (let i = 0; i < 50 && penpot.currentPage.id !== page.id; i++) await new Promise(r => setTimeout(r, 100));
  if (penpot.currentPage.id !== page.id) throw new Error("page not opened: " + name);
  return page; };
S.board = (name) => penpot.currentPage.root.children.find(c => c.name === name);
S.exportPng = async (board, file, scale = 1) => {
  const bytes = await board.export({ type: "png", scale });
  const r = await fetch(`http://127.0.0.1:8787/upload?name=${encodeURIComponent(file)}`, { method: "POST", body: bytes });
  return file + " " + (r.ok ? bytes.length : "échec"); };
S.count = (b) => penpotUtils.findShapes(() => true, b).length + 1;
S.NAMES = { "a-vue": "A1 · ", "a-tickets": "A2 · ", "a-graphe": "A3 · ", "b-vue": "B1 · ", "b-tickets": "B2 · ", "b-graphe": "B3 · ", "c-vue": "C1 · ", "c-tickets": "C2 · ", "c-graphe": "C3 · " };
S.ROWH = 1500;
Object.assign(S.NAMES, { "p-vue": "P1 · ", "p-planning": "P2 · ", "p-fonctionnalite": "P3 · ", "p-graphe": "P5 · " });
Object.assign(S.NAMES, { "p-vue2": "P1 bis · " });
Object.assign(S.NAMES, { "s1-vue": "Style 1 · Vue", "s1-planning": "Style 1 · Planning", "s2-vue": "Style 2 · Vue", "s2-planning": "Style 2 · Planning", "s3-vue": "Style 3 · Vue", "s3-planning": "Style 3 · Planning",
  "v4": "Vue 4 · ", "v5": "Vue 5 · ", "v6": "Vue 6 · ", "v7": "Vue 7 · " });
S.exportStyles = async () => { await S.page("Styles"); await S.wait(1500); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board")) { const mode = /\(clair\)$/.test(b.name) ? "light" : "dark"; let m;
    if ((m = b.name.match(/^Style (\d) · (Vue|Planning)/))) out.push(await S.exportPng(b, `style-${m[1]}-${m[2] === "Vue" ? "vue-ensemble" : "planning"}-${mode}.png`));
    else if ((m = b.name.match(/^Vue (\d) · ([^(]+)/))) out.push(await S.exportPng(b, `vue-ensemble-${m[1]}-${S.slug(m[2].trim())}-${mode}.png`)); }
  return out; };
S.slug = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
S.PFILES = { 1: "vue-ensemble", 2: "planning", 3: "fonctionnalite", 5: "graphe" };
// Exporte les dix boards de la proposition : proposition-<écran>-<dark|light>.png
S.exportProposition = async () => { await S.page("Proposition"); await S.wait(1500); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && /^P[1235] · /.test(c.name))) {
    const mode = /\(clair\)$/.test(b.name) ? "light" : "dark";
    out.push(await S.exportPng(b, `proposition-${S.PFILES[b.name[1]]}-${mode}.png`)); }
  return out; };
S.PAGES = { a: "A · Tableau de bord sobre", b: "B · Éditorial", c: "C · Chronologie" };
S.FILES = { 1: "vue-ensemble", 2: "tickets", 3: "graphe" };
// Exporte les six boards d'une piste : piste-<x>-<écran>-<dark|light>.png
S.exportPiste = async (x) => { await S.page(S.PAGES[x]); await S.wait(1500); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && /^[ABC][123] · /.test(c.name))) {
    const n = b.name[1], mode = /\(clair\)$/.test(b.name) ? "light" : "dark";
    out.push(await S.exportPng(b, `piste-${x}-${S.FILES[n]}-${mode}.png`)); }
  return out; };
// Phase 27 : boards à partir de y = 8 000 de la page « Proposition » ⇒ proposition-<écran>-<dark|light>.png
S.Y27 = 8000;
Object.assign(S.NAMES, { "p-vue3": "P1 bis v3 · ", "p-commencer": "P1 bis v3 · Pour commencer", "p-nouveau": "P6 · ", "p-kanban": "P7 · ", "p-fiche": "P8 · ",
  "p-fiche-act": "P8b · ", "p-questions": "P9 · ", "p-barre": "Barre repliée · ", "p-agent-q": "Agent · question", "p-agent-recap": "Agent · récapitulatif", "p-vue3-retard": "P1 bis v3 · En retard" });
S.FILES27 = { "P1 bis v3 · Vue d'ensemble": "vue-ensemble-v3", "P1 bis v3 · En retard au 18 oct.": "vue-ensemble-v3-retard", "P1 bis v3 · Pour commencer": "vue-ensemble-v3-pour-commencer", "P6 · Nouveau projet": "nouveau-projet",
  "P7 · Kanban": "kanban", "P8 · Fiche ticket": "fiche-ticket", "P8b · Fiche ticket, Activité": "fiche-ticket-activite", "P9 · Questions": "questions",
  "Barre repliée · Kanban à 1 180 px": "barre-repliee" };
S.export27 = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y27)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES27[base];
    if (!file || (only && !only.includes(file))) continue; out.push(await S.exportPng(b, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); }
  return out; };
// Phase 29 : boards « … · en attente » à partir de S.Y29 ⇒ proposition-attente-<écran>-<dark|light>.png, exportés depuis un clone (board.export() peut rendre l'image d'avant une retouche).
S.FILES29 = { "P1 bis · Vue d'ensemble · en attente": "attente-vue-ensemble", "P2 · Planning · en attente": "attente-planning", "P3 · Fonctionnalité · en attente": "attente-fonctionnalite",
  "P7 · Kanban · en attente": "attente-kanban", "P8 · Fiche ticket · en attente": "attente-fiche-ticket", "P8c · Mettre en attente": "attente-dialogue",
  "P8d · Fiche ticket, menu": "attente-fiche-menu", "P8e · Fiche ticket en attente, menu": "attente-fiche-menu-reprendre", "P2b · Planning, Reprendre dans": "attente-planning-menu" };
S.export29 = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y29)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES29[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y;
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
// 0.29.0-alpha.2 : boards P9b à P9d à partir de S.Y_A2 ⇒ proposition-questions-<écran>-<dark|light>.png, exportés depuis un clone.
S.FILES_A2 = { "P9b · Questions, menu": "questions-menu", "P9c · Supprimer la question": "questions-supprimer", "P9d · Questions, répondues": "questions-repondues" };
S.exportA2 = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_A2)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_A2[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y;
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
// 0.29.0-alpha.3 : rangée S.Y_A3 sans board exporté (« Agent · réveil sur réponse » retiré, spec §46.3).
S.FILES_A3 = {};
S.exportA3 = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_A3)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_A3[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
S.exportP34 = (only) => S.export34(only);
return "export ok";
