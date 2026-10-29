// Phase 34 (spec §50) : barre latérale sans « Mes tickets » ni « Boîte de réception », écrans existants retouchés en place,
// page « Phase 34 » des nouveaux boards (rangées de 1 300 px, sombre à x = 0, clair à x = 1 540).
const S = storage;
S.draw = S.draw || {};

// ---------- Barre latérale (spec §50.2) : Aujourd'hui, Projets, Paramètres ----------
// Retrait en place sur un board déjà dessiné : entrées retirées, « Accueil » renommé, menu des pages de la barre repliée remonté.
S.p34Sidebar = (b) => { const out = { removed: 0, renamed: 0, menu: 0 };
  const flat = (s) => s.name.replace(/\s/g, "");
  let lift = 0;
  for (const s of penpotUtils.findShapes(z => ["nav/Mestickets", "nav/Boîtederéception", "nav-icon/ticket", "nav-icon/inbox"].includes(flat(z)), b)) {
    if (flat(s).startsWith("nav-icon")) lift += 36;
    s.remove(); out.removed++; }
  for (const s of penpotUtils.findShapes(z => flat(z) === "nav/Accueil", b)) { s.name = "nav/Aujourd'hui";
    const t = s.children.find(c => c.type === "text" && c.characters === "Accueil"); if (t) { t.characters = "Aujourd'hui"; t.name = "Aujourd'hui"; S.refont(t); }
    out.renamed++; }
  if (lift) for (const m of b.children.filter(c => c.name === "pages-menu")) { m.y -= lift; out.menu++; }
  return out; };

return "phase 34 ok";
