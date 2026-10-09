// Page « 27 · Jeux & Storybook » : écrans 178 à 182 (phase 19, spec §25.9). Requiert 18-socle.js et 24-socle-suite.js.
// D'après les captures screens/2026-10-09-t7/ ; données : design/donnees-fictives.md, section « Jeux et Storybook (phase 19) ».
// Le contenu des cadres (jeu, story, maquette Figma) vient de sites tiers : couleurs fixes, identiques en sombre et en clair.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "27 · Jeux & Storybook";
const { find, wait, abs, input, select, listbox, help, labeled, segmented, formDialog } = S.fx;
const { iconButton, empty, cell, dashboard, widget } = S.fx2;

Object.assign(S.ICONS, {
  arrowLeftRight: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
});

// ---------- Données ----------
const GAME = "Una war";
const EMBED = '<iframe frameborder="0" src="https://itch.io/embed-upload/…" allowfullscreen width="960" height="620"><a href="https://sigmatronic.itch.io/una-war">Play Una war on itch.io</a></iframe>';
const STORY = "Screens / Home";
const ORIGINS = [["Projet", "localhost:6006", true], ["feat/login", "localhost:6007", false]];

// ---------- Contenus tiers (couleurs fixes) ----------
const game = (p, w, h) => { const g = S.box(p, { name: "GameCanvas", fill: "#1E1B2E", w, h }); g.clipContent = true;
  const sky = [[0.08, 0.12], [0.22, 0.3], [0.41, 0.08], [0.63, 0.22], [0.78, 0.1], [0.9, 0.34], [0.33, 0.45], [0.55, 0.38]];
  sky.forEach(([x, y]) => { const s = S.box(g, { name: "star", fill: "#E9D5FF", w: 3, h: 3 }); penpotUtils.setParentXY(s, Math.round(x * w), Math.round(y * h)); });
  const ground = S.box(g, { name: "ground", fill: "#3F3A5A", w, h: Math.round(h * 0.22) }); penpotUtils.setParentXY(ground, 0, Math.round(h * 0.78));
  [[0.18, 0.6, "#F472B6"], [0.7, 0.62, "#60A5FA"]].forEach(([x, y, c]) => { const u = S.box(g, { name: "unit", fill: c, w: 28, h: 36, radius: 2 }); penpotUtils.setParentXY(u, Math.round(x * w), Math.round(y * h)); });
  const t = S.txt(g, "UNA WAR", { size: Math.round(h / 9), weight: 700, color: "#FDE68A" }); penpotUtils.setParentXY(t, Math.round(w / 2 - h / 4.2), Math.round(h * 0.24));
  const s = S.txt(g, "Appuie sur Espace pour jouer", { size: 13, color: "#E9D5FF" }); penpotUtils.setParentXY(s, Math.round(w / 2 - 90), Math.round(h * 0.42)); return g; };
const story = (p, w, h, o = {}) => { const s = S.box(p, { name: o.figma ? "FigmaFrame" : "StoryFrame", fill: "#FFFFFF", w, h, dir: "column", gap: 14, pad: [0, 0, 16, 0] }); s.clipContent = true;
  const nav = S.box(s, { name: "nav", fill: "#F4F4F5", h: 40, dir: "row", gap: 16, pad: [0, 16], align: "center" }); S.fillX(nav);
  S.txt(nav, "Emis", { size: 14, weight: 700, color: "#09090B" }); ["Accueil", "Tâches", "Agenda"].forEach((t, i) => S.txt(nav, t, { size: 12, weight: i ? 400 : 600, color: i ? "#52525B" : "#09090B" }));
  const body = S.box(s, { name: "body", dir: "column", gap: 12, pad: [0, 16], vs: "auto" }); S.fillX(body);
  S.txt(body, "Bonjour Adam", { size: o.figma ? 24 : 22, weight: 700, color: "#09090B" }); S.txt(body, "3 tâches pour aujourd'hui", { size: 12, color: "#71717A" });
  const cards = S.box(body, { name: "cards", dir: "row", gap: 10, vs: "auto" }); S.fillX(cards);
  [["En retard", "1"], ["Aujourd'hui", "3"], ["Cette semaine", "8"]].forEach(([k, v]) => { const c = S.box(cards, { name: "card", fill: "#FFFFFF", stroke: "#E4E4E7", radius: 8, dir: "column", gap: 4, pad: [10, 12], vs: "auto" }); S.child(c, { h: "fill" });
    S.txt(c, k, { size: 11, color: "#71717A" }); S.txt(c, v, { size: 18, weight: 700, color: "#09090B" }); });
  const b = S.box(body, { name: "button", fill: o.figma ? "#09090B" : "#18181B", radius: 6, dir: "row", pad: [8, 14], hs: "auto", vs: "auto" }); S.txt(b, "Nouvelle tâche", { size: 12, weight: 600, color: "#FAFAFA" });
  if (o.label) { const l = S.box(s, { name: "label", fill: "#09090B", op: 0.75, radius: 4, dir: "row", pad: [2, 6], hs: "auto", vs: "auto" }); S.txt(l, o.label, { size: 10, color: "#FAFAFA" }); l.layoutChild.absolute = true; penpotUtils.setParentXY(l, w - 150, h - 26); }
  return s; };

// ---------- Widget Jeu itch.io ----------
const gameHead = (body, title, o = {}) => { const h = S.row(body, { name: "GameHeader", gap: 8, pad: [8, 12], fill: C.muted }); S.fillX(S.txt(h, title, { size: 13, weight: 600 }));
  S.txt(h, "Fourni par itch.io", { size: 12, color: C.mfg }); iconButton(h, "maximize", { size: 24, icon: 13 }); if (o.link !== false) iconButton(h, "external", { size: 24, icon: 13 }); return h; };
const gameWidget = (g, pos, o = {}) => { const v = widget(g, "Jeu itch.io", "gamepad", pos, { pad: 0, gap: 0, head: h => iconButton(h, "maximize") });
  gameHead(v.body, o.title || GAME, { link: o.link });
  if (o.state) { const e = S.box(v.body, { name: "State", dir: "column", gap: 12, align: "center", justify: "center", pad: 24 }); S.child(e, { h: "fill", v: "fill" });
    o.state.split("\n").forEach(t => S.txt(e, t, { size: 13, color: C.mfg })); const r = S.row(e, { gap: 8, hs: "auto" }); (o.actions || ["Réessayer"]).forEach(a => S.button(r, a, "outline", { sm: true })); return v; }
  const st = S.row(v.body, { name: "Stage", gap: 0, justify: "center", fill: "#0F0D1A" }); S.child(st, { v: "fill" }); st.clipContent = true; game(st, Math.round((pos.h - 110) * 1.55), pos.h - 110);
  const ft = S.row(v.body, { gap: 8, pad: [8, 12] }); S.txt(ft, "Le bouton plein écran d'itch.io est sans effet ici : utilise « Plein écran ».", { size: 12, color: C.mfg }); return v; };
const addButton = (f, y) => { const b = S.button(f, "Ajouter un composant", "outline", { sm: true, icon: "plus" }); abs(f, b, 272, y); return b; };
S.draw[178] = async () => { const { frame: f, g } = await dashboard(PAGE, "178 · Widget Jeu itch.io", 0, 0); gameWidget(g, cell(0, 0, 12, 8)); return f.id; };
S.draw["178b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "178b · Jeu itch.io : hors ligne", 2, 0);
  gameWidget(g, cell(0, 0, 12, 8), { state: "Ce jeu a besoin d'Internet." }); return f.id; };
S.draw["178c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "178c · Jeu itch.io : intégration refusée", 4, 0);
  gameWidget(g, cell(0, 0, 7, 5), { state: "itch.io n'autorise pas l'intégration de ce jeu hors de son site.\nOuvre-le sur itch.io.", actions: ["Ouvrir sur itch.io", "Réessayer"] }); return f.id; };
S.draw["178d"] = async () => { const { frame: f, g } = await dashboard(PAGE, "178d · Jeu itch.io : vide et réglages", 6, 0);
  gameWidget(g, cell(0, 0, 12, 8), { title: "Jeu itch.io", link: false, state: "Colle le code d'intégration d'un jeu itch.io dans les réglages du widget.", actions: ["Réglages"] });
  const d = formDialog(f, "Réglages · Jeu itch.io", 448, "Ces réglages ne concernent que ce widget.");
  const field = (label, value, none, hint, o = {}) => labeled(d, label, c => { const r = S.row(c, { gap: 12 }); input(r, value, { focus: !!o.focus, placeholder: !value, size: 12 }); S.check(r, none, "Aucune valeur"); }, { help: hint });
  field("Jeu", "… Play Una war on itch.io</a></iframe>", false, "Sur la page du jeu : Partager › Intégrer, puis colle le code ou l'adresse https://itch.io/embed-upload/<id>. Sauvegardes liées au port de l'interface : perdues s'il change.", { focus: true });
  field("Page du jeu", "", true, "Adresse de la page itch.io du jeu, pour le lien « Ouvrir sur itch.io ».");
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

// ---------- 179 · Plein écran de Kibo ----------
S.draw[179] = async () => { const { frame: f } = await dashboard(PAGE, "179 · Jeu itch.io : plein écran de Kibo", 0, 1);
  const fs = S.box(f, { name: "KiboFullscreen", fill: C.bg, w: 1440, h: 940, dir: "column", gap: 0 }); abs(f, fs, 0, 0);
  gameHead(fs, GAME); const st = S.row(fs, { name: "Stage", gap: 0, justify: "center", fill: "#0F0D1A" }); S.child(st, { v: "fill" }); st.clipContent = true; game(st, 1376, 888);
  S.frontAbs(f); return f.id; };

// ---------- 180 · Widget Maquette : story Storybook ----------
const originSelect = (h, name, o = {}) => select(h, "Storybook : " + name, { open: !!o.open });
const mockHead = (body, o = {}) => { const h = S.row(body, { name: "MockupHeader", gap: 8, pad: [8, 12] }); S.border(h); S.fillX(S.txt(h, o.title === undefined ? STORY : o.title, { size: 13, weight: 600 }));
  if (o.title !== "") S.badge(h, "Storybook", C.fg, { fill: C.accent, round: true }); originSelect(h, o.origin || "Projet", o);
  if (o.title !== "") { S.button(h, "Comparer", "ghost", { sm: true, icon: "split" }); iconButton(h, "refresh"); iconButton(h, "external"); } return h; };
const compareBar = (body, mode) => { const r = S.row(body, { name: "CompareBar", gap: 12, pad: [6, 12] }); S.border(r); select(r, "Référence : Accueil");
  segmented(r, ["Côte à côte", "Superposition"], mode);
  if (mode === "Superposition") [["Maquette 50 %", 0.5], ["Curseur 40 %", 0.4]].forEach(([t, v]) => { const s = S.row(r, { gap: 8, hs: "auto" }); const sl = S.box(s, { name: "Slider", w: 96, h: 14 }); const tr = S.box(sl, { name: "track", fill: C.accent, radius: 999, w: 96, h: 4 }); penpotUtils.setParentXY(tr, 0, 5);
    const k = S.box(sl, { name: "thumb", fill: C.fg, radius: 999, w: 14, h: 14 }); penpotUtils.setParentXY(k, Math.round(96 * v) - 7, 0); k.bringToFront(); S.txt(s, t, { size: 12, color: C.mfg }); });
  S.button(r, "Permuter", "ghost", { sm: true, icon: "arrowLeftRight" }); S.spacer(r); iconButton(r, "x"); return r; };
const zoomBar = (body) => { const z = S.row(body, { name: "ZoomBar", gap: 8, pad: [6, 12], justify: "end" }); iconButton(z, "minus", { size: 22, icon: 12 }); S.txt(z, "100 %", { size: 11, mono: true }); iconButton(z, "plus", { size: 22, icon: 12 }); S.txt(z, "Ajuster", { size: 12, color: C.mfg }); return z; };
const mockWidget = (g, pos, o = {}) => { const v = widget(g, "Maquette", "frame", pos, { pad: 0, gap: 0 }); mockHead(v.body, o);
  if (o.compare) compareBar(v.body, o.compare);
  const st = S.row(v.body, { name: "Stage", gap: 16, pad: 16, justify: "center", align: "start" }); S.child(st, { v: "fill" }); st.clipContent = true;
  if (o.state) { st.flex.alignItems = "center"; const e = S.col(st, { gap: 12, align: "center" }); o.state.split("\n").forEach(t => S.txt(e, t, { size: 13, color: C.mfg })); S.button(e, "Réessayer", "outline", { sm: true }); return v; }
  const H = pos.h - (o.compare ? 170 : 130);
  if (o.compare === "Côte à côte") { const W = Math.round((pos.w - 64) / 2); [["Storybook · " + STORY, false], ["Figma · Accueil", true]].forEach(([t, fig]) => { const c = S.col(st, { gap: 6, w: W }); S.txt(c, t, { size: 11, color: C.mfg }); story(c, W, H - 20, { figma: fig }); }); }
  else if (o.compare === "Superposition") { const W = Math.min(760, pos.w - 32); const wrap = S.box(st, { name: "Overlay", w: W, h: H }); story(wrap, W, H);
    const clip = S.box(wrap, { name: "FigmaClip", w: Math.round(W * 0.4), h: H }); clip.clipContent = true; const fig = story(clip, W, H, { figma: true }); fig.opacity = 0.5; penpotUtils.setParentXY(fig, 6, 8);
    const line = S.box(wrap, { name: "Cursor", fill: "#18181B", w: 2, h: H }); penpotUtils.setParentXY(line, Math.round(W * 0.4), 0);
    const hd = S.box(wrap, { name: "CursorHandle", fill: "#18181B", stroke: "#FFFFFF", sw: 2, radius: 999, w: 16, h: 16 }); penpotUtils.setParentXY(hd, Math.round(W * 0.4) - 7, Math.round(H / 2) - 8);
    [clip, line, hd].forEach(x => x.bringToFront()); }
  else story(st, Math.min(760, pos.w - 32), H);
  zoomBar(v.body); return v; };
S.draw[180] = async () => { const { frame: f, g } = await dashboard(PAGE, "180 · Maquette : story Storybook", 0, 2); mockWidget(g, cell(0, 0, 12, 9)); return f.id; };
S.draw["180b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "180b · Maquette : Storybook injoignable", 2, 2);
  mockWidget(g, cell(0, 0, 12, 9), { title: "", origin: "feat/login", state: "Storybook injoignable (localhost:6007). Lance-le (pnpm storybook), puis réessaie." }); return f.id; };
S.draw["180c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "180c · Maquette : menu des origines Storybook", 4, 2); const v = mockWidget(g, cell(0, 0, 12, 9), { open: true });
  await wait(1500); const sel = penpotUtils.findShape(s => /^Select-Storybook/.test(s.name), v.w); const p = S.fx.rel(f, sel);
  listbox(f, p.x, p.y + p.h + 4, ORIGINS.map(([n, host, ok], i) => [n, i === 0, null, { hint: host + (ok ? "" : " · injoignable") }]), 260); S.frontAbs(f); return f.id; };

// ---------- 181 · Comparaison ----------
S.draw[181] = async () => { const { frame: f, g } = await dashboard(PAGE, "181 · Maquette : comparaison côte à côte", 0, 3); mockWidget(g, cell(0, 0, 12, 9), { origin: "feat/login", compare: "Côte à côte" }); return f.id; };
S.draw["181b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "181b · Maquette : superposition, opacité et curseur", 2, 3); mockWidget(g, cell(0, 0, 12, 9), { origin: "feat/login", compare: "Superposition" }); return f.id; };

// ---------- 182 · Modifier le projet › Storybook ----------
S.draw[182] = async () => { const { frame: f, g } = await dashboard(PAGE, "182 · Modifier le projet › Storybook", 0, 4); mockWidget(g, cell(0, 0, 12, 9));
  const d = formDialog(f, "Modifier le projet", 520);
  labeled(d, "Nom", c => input(c, "Kibo")); labeled(d, "Dossier", c => input(c, "~/code/kibo", { mono: true, size: 12 }), { help: "Le dossier reste sur ta machine. Vide pour délier." });
  const kv = (p, k, v, x = {}) => { const r = S.row(p, { gap: 12 }); const kk = S.box(r, { name: "k", w: 150, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, weight: 500 }); input(r, v, { mono: true, size: 12, focus: !!x.focus, placeholder: !!x.ph }); return r; };
  S.txt(d, "Worktrees des agents", { size: 13, weight: 600 }); kv(d, "Base", "origin/main"); kv(d, "Chemin", "../kibo-{slug}");
  S.txt(d, "Storybook", { size: 13, weight: 600 }); kv(d, "Adresse", "http://localhost:6006"); kv(d, "Variable du port (.env)", "STORYBOOK_PORT", { focus: true });
  help(d, "Storybook local (pnpm storybook) ou déployé en https ; http seulement en local. Chaque worktree qui définit cette variable dans .env ou .env.local apparaît comme un Storybook de sa branche.");
  S.footer(d, "Annuler", "Enregistrer"); await wait(1500); S.recenter(f); S.frontAbs(f); return f.id; };

S.JEUX = [178, "178b", "178c", "178d", 179, 180, "180b", "180c", 181, "181b", 182];
return "jeux-storybook ok";
