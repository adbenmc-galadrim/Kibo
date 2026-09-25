// Exporte chaque board d'une page en PDF vers scripts/receiver.py (127.0.0.1:8787).
// Sombre puis clair (board dont le nom contient « (clair) »), triés par y puis x.
// Rester sur la page ~3 s avant l'export, sinon les textes sortent vides.
storage.exportPage = async (prefix) => {
  const pg = penpotUtils.getPages().find(p => p.name.startsWith(prefix));
  const page = penpotUtils.getPageById(pg.id);
  penpot.openPage(page); await new Promise(r => setTimeout(r, 3000));
  const boards = page.root.children.filter(c => c.type === "board");
  const isLight = b => /\(clair\)/.test(b.name);
  const sortFn = (a, b) => (Math.round(a.y) - Math.round(b.y)) || (a.x - b.x);
  const res = [];
  for (const [kind, list] of [["dark", boards.filter(b => !isLight(b)).sort(sortFn)], ["light", boards.filter(isLight).sort(sortFn)]]) {
    let i = 0;
    for (const b of list) {
      i++;
      const bytes = await b.export({ type: "pdf", scale: 1 });
      const name = `${kind}-${prefix}-${String(i).padStart(2, "0")}.pdf`;
      await fetch(`http://127.0.0.1:8787/upload?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes });
      res.push(name + " ← " + b.name);
    }
  }
  return res;
};
return "export ok";
