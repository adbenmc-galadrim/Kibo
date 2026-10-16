// Coques communes : logo, barre latérale (piste A), rail (piste C), barre du haut (piste B), éléments de navigation.
// Navigation simplifiée : ni « Agents » ni « Files d'attente » au premier niveau (exécution masquée par un réglage).
const S = storage;
S.kanbanLogo = (mode, size) => { const u = size / 100, n = v => +(v * u).toFixed(2), dark = mode === "dark";
  const ink = dark ? "#FAFAFA" : "#09090B", base = dark ? "#18181B" : "#FFFFFF", edge = dark ? "#27272A" : "#E4E4E7";
  const rr = (x, y, w, h, r, col, op = 1) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${col}" opacity="${op}"/>`;
  const b = `<rect x="${n(2)}" y="${n(2)}" width="${n(96)}" height="${n(96)}" rx="${n(24)}" fill="${base}" stroke="${edge}" stroke-width="${Math.max(1, n(2))}"/>` + rr(22, 24, 16, 22, 4, ink) + rr(22, 52, 16, 16, 4, ink, 0.45) + rr(42, 24, 16, 16, 4, ink) + rr(42, 46, 16, 30, 4, "#F97316") + rr(62, 24, 16, 12, 4, ink, 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">${b}</svg>`; };
S.logo = (p, size) => S.svg(p, S.kanbanLogo(S.mode, size), "logo");
S.ICONS.dashboard = '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>';
S.NAV_ICON = { "Vue d'ensemble": "dashboard", "Tickets": "list", "Kanban": "kanban", "Graphe": "graph", "Notes": "note", "Questions": "question" };

S.navItem = (p, icon, label, o = {}) => { const C = S.C;
  const r = S.row(p, { name: "nav/" + label, fx: true, h: 30, pad: [0, 8, 0, 8 + (o.indent || 0)], gap: 8, radius: 6, fill: o.active ? C.hover : null });
  if (o.chev) S.icon(r, o.chev, 13, C.dim); if (o.dot) S.dot(r, o.dot, 8); if (icon) S.icon(r, icon, 15, o.active ? C.fg : C.mfg);
  S.txt(r, label, { size: 13, weight: o.active ? 500 : 400, color: o.active ? C.fg : C.mfg }); S.spacer(r);
  if (o.badge) S.dot(r, o.badge, 6);
  if (o.count) S.txt(r, o.count, { size: 11, mono: true, color: C.dim });
  return r; };

// Barre latérale de la piste A : arbre des projets, Emis déplié sur ses pages.
S.sidebar = (p, active, o = {}) => { const C = S.C;
  const sb = S.col(p, { name: "sidebar", w: 240, fy: true, fill: C.panel, pad: [12, 10], gap: 2 });
  const ws = S.row(sb, { fx: true, h: 34, pad: [0, 6], gap: 8 }); S.logo(ws, 22); S.txt(ws, "Galadrim", { size: 13, weight: 600 }); S.icon(ws, "chevDown", 13, C.dim); S.spacer(ws); S.icon(ws, "panelRight", 15, C.dim);
  const se = S.row(sb, { fx: true, h: 30, pad: [0, 8], gap: 8, radius: 6, stroke: C.border, fill: C.bg }); S.icon(se, "search", 14, C.dim); S.txt(se, "Rechercher", { size: 12.5, color: C.dim }); S.spacer(se); S.kbd(se, "⌘K");
  S.box(sb, { w: 4, h: 8 });
  S.navItem(sb, "home", "Accueil", { active: active === "Accueil" });
  S.navItem(sb, "ticket", "Mes tickets", { count: "6" });
  S.navItem(sb, "inbox", "Boîte de réception", { count: "2" });
  S.box(sb, { w: 4, h: 12 });
  const h = S.row(sb, { fx: true, h: 24, pad: [0, 8] }); S.txt(h, "Projets", { size: 11, weight: 500, color: C.dim, ls: 0.4, upper: true }); S.spacer(h); S.icon(h, "plus", 13, C.dim);
  S.navItem(sb, null, "Emis", { chev: "chevDown", dot: S.D.project.color });
  const counts = o.counts || { "Tickets": "27", "Questions": "3" };
  for (const pg of (o.pages || ["Vue d'ensemble", "Tickets", "Kanban", "Graphe", "Notes", "Questions"]))
    S.navItem(sb, S.NAV_ICON[pg], pg, { indent: 18, active: active === pg, count: counts[pg] || null });
  for (const [n, c] of S.D.projects.slice(1)) S.navItem(sb, null, n, { chev: "chevRight", dot: c });
  S.box(sb, { w: 4, h: 4, fy: true });
  S.navItem(sb, "settings", "Paramètres");
  const u = S.row(sb, { fx: true, h: 40, pad: [0, 6], gap: 8 }); S.avatar(u, "AB", 24); S.txt(u, "Adam Ben Mchichi", { size: 12.5, color: C.fg }); S.spacer(u); S.icon(u, "more", 14, C.dim);
  S.vline(p, C.soft);
  return sb; };

// Fil d'Ariane : « ● Emis / Page ».
S.crumbs = (p, items) => { const C = S.C; const r = S.row(p, { gap: 8 });
  items.forEach((it, i) => { if (i) S.txt(r, "/", { size: 13, color: C.faint });
    if (i === 0) S.dot(r, S.D.project.color, 8);
    S.txt(r, it, { size: 13, weight: i === items.length - 1 ? 500 : 400, color: i === items.length - 1 ? C.fg : C.mfg }); });
  return r; };
// Bouton de l'agent de projet (orange : agents) ; o.on = panneau ouvert, o.count = lot en attente.
S.agentButton = (p, o = {}) => { const C = S.C;
  const b = S.row(p, { name: "agent-button", pad: [5, 10], gap: 6, radius: 6, stroke: o.on ? C.brandLine : C.border, fill: o.on ? C.brandSoft : null });
  S.icon(b, "bot", 15, C.brand); S.txt(b, o.label || "Agent de projet", { size: 12.5, weight: 500, color: o.on ? C.brandText : C.fg });
  if (o.count) { const k = S.row(b, { pad: [0, 5], radius: 8, fill: C.brandBtn }); S.txt(k, o.count, { size: 10.5, weight: 600, color: "#FFFFFF", mono: true }); }
  return b; };
S.syncChip = (p, o = {}) => { const C = S.C; const r = S.row(p, { gap: 6 });
  S.icon(r, "github", 14, C.dim); S.txt(r, o.text || "Synchronisé · il y a 1 min", { size: 12, color: C.dim }); return r; };
S.liveChip = (p, o = {}) => { const C = S.C; const r = S.row(p, { gap: 6, pad: [3, 8], radius: 12, stroke: C.brandLine, fill: C.brandSoft });
  S.dot(r, C.brand, 6); S.txt(r, o.text || `${S.D.session.tool} · ${S.D.session.tk} · ${S.D.session.step}`, { size: 11.5, weight: 500, color: C.brandText }); return r; };
S.topbar = (p, crumbs, right) => { const C = S.C;
  const t = S.row(p, { name: "topbar", fx: true, h: 48, pad: [0, 16, 0, 20], gap: 12 }); S.crumbs(t, crumbs); S.spacer(t); if (right) right(t);
  S.hline(p, C.soft); return t; };

// Rail d'icônes de la piste C.
S.rail = (p, active) => { const C = S.C;
  const r = S.col(p, { name: "rail", w: 60, fy: true, fill: C.panel, pad: [14, 0], gap: 6, align: "center" });
  S.logo(r, 28); S.box(r, { w: 4, h: 10 });
  const item = (icon, on, badge) => { const b = S.box(r, { w: 38, h: 38, radius: 8, fill: on ? C.hover : null, dir: "row", align: "center", justify: "center" });
    S.icon(b, icon, 18, on ? C.fg : C.dim); if (badge) S.abs(S.dot(b, badge, 7)); return b; };
  item("search"); item("home", active === "Accueil");
  S.hline(r, C.soft, { w: 28 });
  for (const pg of ["Vue d'ensemble", "Tickets", "Kanban", "Graphe", "Notes", "Questions"]) item(S.NAV_ICON[pg], active === pg);
  S.box(r, { w: 4, h: 4, fy: true }); item("bell"); item("settings"); S.avatar(r, "AB", 28);
  S.vline(p, C.soft); return r; };

// Sélecteur de projet de la barre du haut (pistes B et C).
S.projectSwitch = (p, o = {}) => { const C = S.C; const r = S.row(p, { gap: 8, pad: [5, 10], radius: 6, stroke: o.stroke ? C.border : null });
  S.dot(r, S.D.project.color, 9); S.txt(r, "Emis", { size: o.size || 13.5, weight: 600 }); S.icon(r, "chevDown", 13, C.dim); return r; };
return "shell ok";
