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
S.PAGES = { a: "A · Tableau de bord sobre", b: "B · Éditorial", c: "C · Chronologie" };
S.FILES = { 1: "vue-ensemble", 2: "tickets", 3: "graphe" };
// Exporte les six boards d'une piste : piste-<x>-<écran>-<dark|light>.png
S.exportPiste = async (x) => { await S.page(S.PAGES[x]); await S.wait(1500); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && /^[ABC][123] · /.test(c.name))) {
    const n = b.name[1], mode = /\(clair\)$/.test(b.name) ? "light" : "dark";
    out.push(await S.exportPng(b, `piste-${x}-${S.FILES[n]}-${mode}.png`)); }
  return out; };
return "export ok";
