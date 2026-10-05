// Page « 24 · Maquettes Figma & Penpot » : écrans 16, 53, 147, 148, 149 et 4 (phase 15, spec §21.6 à §21.8). Requiert 18-socle.js et 24-socle-suite.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "24 · Maquettes Figma & Penpot";
const { find, wait, abs, rel, menu, alertDialog, formDialog, input, select, help, labeled, pageHead, settingsScreen, kanbanAt } = S.fx;
const { iconButton, empty, cell, dashboard, widget } = S.fx2;

// ---------- 16 · Paramètres › Intégrations : lignes Figma et Penpot (§21.7) ----------
const INTEG = (o) => [["git", "Git local", "Branches, commits, worktrees, diff", "Actif"], ["github", "GitHub", "PR, reviews, statuts CI · compte adam", "Connecté"],
  ["listTodo", "GitHub Issues & Projects", "Synchronise les tickets d'un composant", null], ["terminal", "GitHub Actions", "Runs et logs liés à la PR et au ticket", null],
  ["frame", "Figma", o.figmaOff ? "Cadres liés aux tickets et widgets Maquette" : "Cadres liés aux tickets et widgets Maquette · compte adam", o.figmaOff ? null : "Connecté"],
  ["penTool", "Penpot", "Cadres liés aux tickets et widgets Maquette · Adam · localhost:9010", "Connecté"], ["plug", "Serveurs MCP", "Outils exposés aux agents", "Actif"], ["bell", "Notifications système", "Agent en attente, run terminé, CI cassée", "Actif"]];
const integRow = (p, [ic, t, d, st], o = {}) => { const r = S.panel(p, { name: "Integ-" + t, dir: "row", gap: 12, pad: [12, 16], align: "center" });
  const b = S.box(r, { name: "ic", stroke: C.border, radius: 8, w: 36, h: 36, dir: "row", align: "center", justify: "center" }); S.icon(b, ic, 16, C.fg);
  const tv = S.col(r, { gap: 2 }); S.txt(tv, t, { size: 13, weight: 600 }); S.txt(tv, d, { size: 12, color: C.mfg });
  if (!st) { S.button(r, "Connecter", "outline", { sm: true }); return r; }
  const s = S.row(r, { gap: 6, hs: "auto" }); S.dot(s, C.green, 7); S.txt(s, st, { size: 12, color: C.mfg }); if (st === "Connecté") iconButton(r, "more", { on: o.menu === t, color: C.fg }); return r; };
const integrations = async (name, col, row, o = {}) => { const r = await settingsScreen(PAGE, name, col, row, "Intégrations");
  pageHead(r.body, "Intégrations", "Les secrets sont stockés dans le trousseau système, jamais dans les données du projet."); INTEG(o).forEach(x => integRow(r.body, x, o)); return r; };
S.draw[16] = async () => { const { frame: f } = await integrations("16 · Paramètres › Intégrations (Figma et Penpot)", 0, 0); return f.id; };
S.draw["16b"] = async () => { const { frame: f, body } = await integrations("16b · Menu de la ligne Penpot", 2, 0, { menu: "Penpot", figmaOff: true }); await wait(2000);
  const b = find(find(body, "Integ-Penpot"), "IconButton-more"); const p = rel(f, b);
  menu(f, p.x + p.w - 220, p.y + p.h + 4, [["Configurer", "settings"], ["Tester la connexion", "activity", { hover: true }], "-", ["Déconnecter", "unlink", { danger: true }]], 220); S.frontAbs(f); return f.id; };

// ---------- 53 · Connecter Figma à deux modes, 147 · Connecter Penpot (§21.4, §21.7) ----------
const choice = (p, on, icon, title, badge, fill) => { const c = S.box(p, { name: "ChoicePanel", fill: on ? C.muted : null, stroke: on ? C.mfg : C.border, radius: 8, dir: "column", gap: 8, pad: 12, vs: "auto" }); S.fillX(c);
  const h = S.row(c, { gap: 8 }); S.icon(h, icon, 15, C.fg); S.txt(h, title, { size: 13, weight: 600 }); if (badge) S.badge(h, badge, C.fg, { fill: C.accent }); S.spacer(h); S.radio(h, on); if (on && fill) fill(c); return c; };
const figmaDialog = (f, o = {}) => { const d = formDialog(f, "Connecter Figma", 480, "Kibo rend les cadres liés aux tickets et aux widgets Maquette, avec ton compte, et les garde en cache sur cette machine.");
  choice(d, !o.mcp, "key", "Jeton personnel", "Recommandé", c => labeled(c, "Jeton", cc => input(cc, o.refused ? "figd_••••••••••••••••" : "figd_…", { mono: true, icon: "key", placeholder: !o.refused, focus: !o.refused, error: o.refused }),
    { help: "Figma › Settings › Security › Personal access tokens. Portées : current_user:read et file_content:read. Le jeton reste dans le trousseau système." }));
  choice(d, !!o.mcp, "plug", "Serveur MCP de l'application Figma", null, c => labeled(c, "Adresse du serveur", cc => input(cc, "http://127.0.0.1:3845/mcp", { mono: true }),
    { help: "Active « Dev Mode MCP Server » dans les préférences de Figma, puis garde l'application ouverte." }));
  if (o.refused) S.alert(d, "Jeton refusé", "red", { icon: "circleX", desc: "Vérifie le jeton et ses portées, puis réessaie." });
  if (o.mcp) S.alert(d, "Serveur Figma injoignable", "red", { icon: "circleX", desc: "Rien n'écoute sur 127.0.0.1:3845. Vérifie que Figma est lancé et que le serveur MCP est activé." });
  S.footer(d, "Annuler", "Connecter"); return d; };
S.draw[53] = async () => { const { frame: f } = await integrations("53 · Connecter Figma : jeton personnel", 0, 1, { figmaOff: true }); figmaDialog(f); S.frontAbs(f); return f.id; };
S.draw["53b"] = async () => { const { frame: f } = await integrations("53b · Connecter Figma : serveur MCP", 2, 1, { figmaOff: true }); figmaDialog(f, { mcp: true }); S.frontAbs(f); return f.id; };
S.draw["53c"] = async () => { const { frame: f } = await integrations("53c · Connecter Figma : jeton refusé", 4, 1, { figmaOff: true }); figmaDialog(f, { refused: true }); S.frontAbs(f); return f.id; };
const penpotDialog = (f, o = {}) => { const d = formDialog(f, "Connecter Penpot", 480, "Kibo lit les boards de tes fichiers Penpot et affiche leur aperçu dans les tickets et les widgets Maquette.");
  labeled(d, "Adresse de l'instance", c => input(c, o.badUrl ? "http://192.168.1.20:9010" : "https://design.penpot.app", { mono: true, error: !!o.badUrl }), { help: "Ton instance auto-hébergée fonctionne aussi ; http seulement en local (127.0.0.1 ou localhost)." });
  labeled(d, "Jeton d'accès", c => input(c, o.filled ? "••••••••••••••••••••" : "Jeton créé dans Penpot", { mono: true, icon: "key", placeholder: !o.filled, error: !!o.refused }), { help: "Penpot › Compte › Jetons d'accès › Générer un nouveau jeton. Il reste dans le trousseau système." });
  if (o.refused) S.alert(d, "Jeton refusé", "red", { icon: "circleX", desc: "Vérifie le jeton et ses portées, puis réessaie." });
  if (o.badUrl) S.alert(d, "Adresse invalide", "red", { icon: "circleX", desc: "https obligatoire, sauf 127.0.0.1 ou localhost." });
  S.footer(d, "Annuler", "Connecter"); return d; };
S.draw[147] = async () => { const { frame: f } = await integrations("147 · Connecter Penpot", 0, 2); penpotDialog(f, { filled: true }); S.frontAbs(f); return f.id; };
S.draw["147b"] = async () => { const { frame: f } = await integrations("147b · Connecter Penpot : jeton refusé", 2, 2); penpotDialog(f, { filled: true, refused: true }); S.frontAbs(f); return f.id; };
S.draw["147c"] = async () => { const { frame: f } = await integrations("147c · Connecter Penpot : adresse invalide", 4, 2); penpotDialog(f, { filled: true, badUrl: true }); S.frontAbs(f); return f.id; };
S.draw["147d"] = async () => { const { frame: f } = await integrations("147d · Déconnecter Penpot", 6, 2);
  alertDialog(f, "Déconnecter Penpot ?", "Le jeton est supprimé du trousseau. Les liens vers les cadres restent, les aperçus en cache aussi.", "Déconnecter"); S.frontAbs(f); return f.id; };

// ---------- 148 · Widget Maquette, 149 · réglages (§21.6) ----------
const shot = (p, w, h) => { const s = S.box(p, { name: "FrameImage", fill: "#FAFAFA", w, h, dir: "column", gap: 10, pad: [16, 20] }); s.clipContent = true;
  S.txt(s, "Tickets", { size: 16, weight: 700, color: "#09090B" }); for (let i = 0; i < 8; i++) { const r = S.box(s, { name: "Row", fill: i % 2 ? "#F4F4F5" : "#FFFFFF", radius: 3, h: 22, dir: "row", gap: 8, pad: [0, 8], align: "center" }); S.fillX(r);
    S.box(r, { name: "k", fill: "#A1A1AA", w: 30, h: 6 }); S.box(r, { name: "t", fill: "#52525B", w: 120 + (i * 37) % 90, h: 6 }); } return s; };
const badges = (h, o) => { S.badge(h, o.provider || "Figma", C.fg, { fill: C.accent, round: true }); if (o.stale) S.badge(h, "Périmé", C.fg); if (o.offline) S.badge(h, "Hors ligne", C.fg);
  iconButton(h, "refresh"); iconButton(h, "external"); };
const linked = (b, list) => { const l = S.col(b, { gap: 6, pad: [8, 12] }); S.border(l); S.txt(l, "Tickets liés", { size: 11, color: C.mfg });
  if (!list.length) { S.txt(l, "Aucun ticket lié à ce cadre.", { size: 12, color: C.mfg }); return l; } const r = S.row(l, { gap: 6 }); list.forEach(t => S.badge(r, t, C.fg, { round: true })); return r; };
const mockup = (g, pos, o = {}) => { const v = widget(g, "Maquette", "frame", pos, { pad: 0, gap: 0 });
  if (o.state) { empty(v.body, o.state, { fill: true }); linked(v.body, []); return v; }
  const h = S.row(v.body, { gap: 6, pad: [8, 12] }); S.fillX(S.txt(h, o.name || "Tickets · liste", { size: 13, weight: 600 })); badges(h, o);
  const st = S.row(v.body, { justify: "center" }); S.child(st, { v: "fill" }); st.clipContent = true; shot(st, Math.round(pos.w * 0.55), pos.h - 120);
  linked(v.body, ["KIB-30 · Écran liste des tickets", "KIB-31 · Filtres de la liste"]); return v; };
S.draw[148] = async () => { const { frame: f, g } = await dashboard(PAGE, "148 · Widget Maquette", 0, 3); mockup(g, cell(0, 0, 12, 7)); return f.id; };
S.draw["148b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "148b · Widget Maquette : périmé, hors ligne", 2, 3); mockup(g, cell(0, 0, 12, 7), { provider: "Penpot", name: "Accueil", stale: true, offline: true }); return f.id; };
S.draw["148c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "148c · Widget Maquette : vide et erreurs", 4, 3);
  mockup(g, cell(0, 0, 6, 4), { state: "Colle l'URL d'un cadre Figma ou d'un board Penpot dans les réglages du widget." });
  mockup(g, cell(6, 0, 6, 4), { state: "Connecte Figma ou Penpot dans Paramètres › Intégrations." });
  mockup(g, cell(0, 4, 6, 4), { state: "Aucun aperçu : ouvre le fichier dans Penpot pour le générer." });
  mockup(g, cell(6, 4, 6, 4), { state: "Maquette indisponible." }); return f.id; };
const settingsDialog = (f, o = {}) => { const d = formDialog(f, "Réglages · Maquette", 448, "Ces réglages ne concernent que ce widget.");
  labeled(d, "Cadre", c => input(c, o.bad ? "https://www.figma.com/design/AbC123xyz/Kibo" : "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34", { focus: !o.bad, error: !!o.bad, size: 12 }),
    { help: o.bad ? "URL de cadre invalide : lien Figma (node-id) ou Penpot (board-id) attendu." : "Colle l'URL d'un cadre Figma ou d'un board Penpot.", helpColor: o.bad ? C.red : undefined });
  labeled(d, "Ajustement", c => select(c, "contain", { w: 224 })); S.footer(d, "Annuler", "Enregistrer"); return d; };
S.draw[149] = async () => { const { frame: f, g } = await dashboard(PAGE, "149 · Réglages du widget Maquette", 0, 4); mockup(g, cell(0, 0, 6, 4), { state: "Colle l'URL d'un cadre Figma ou d'un board Penpot dans les réglages du widget." });
  settingsDialog(f); S.frontAbs(f); return f.id; };
S.draw["149b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "149b · Réglages du widget Maquette : URL invalide", 2, 4); mockup(g, cell(0, 0, 6, 4), { state: "Colle l'URL d'un cadre Figma ou d'un board Penpot dans les réglages du widget." });
  settingsDialog(f, { bad: true }); S.frontAbs(f); return f.id; };

// ---------- 4 · Fiche ticket : section Maquettes (§21.1, §21.2) ----------
const sheet = (f, o = {}) => { const sh = S.box(f, { name: "Sheet", fill: C.card, stroke: C.border, w: 560, h: 900, dir: "column", gap: 14, pad: [20, 24] }); S.fx.shadow(sh); abs(f, sh, 1440 - 560, 40); sh.clipContent = true;
  const hd = S.row(sh, { gap: 6 }); S.fillX(S.txt(hd, "KIB-30", { size: 12, mono: true, color: C.mfg })); iconButton(hd, "more"); iconButton(hd, "x");
  S.txt(sh, "Écran liste des tickets", { size: 20, weight: 600 }); S.button(sh, "Assigner à un agent", "outline", { sm: true, icon: "bot" });
  const props = S.col(sh, { gap: 8 }); const prop = (k, fn) => { const r = S.row(props, { gap: 8 }); const kk = S.box(r, { name: "k", w: 110, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 12, color: C.mfg }); fn(r); };
  prop("Statut", r => select(r, "À faire", { lead: s => S.statusDot(s, "À faire", 8) })); prop("Domaine", r => select(r, "UI", { lead: s => S.box(s, { name: "sq", fill: S.domainColors.UI, radius: 1, w: 7, h: 7 }) }));
  prop("Maquette", r => { S.icon(r, "frame", 13, C.mfg); S.txt(r, "Tickets · liste", { size: 12 }); });
  S.txt(sh, "Maquettes", { size: 13, weight: 600 });
  const thumb = (name, provider, x = {}) => { const t = S.col(sh, { gap: 6 }); const img = S.box(t, { name: "Thumb", fill: C.muted, stroke: C.border, radius: 8, h: 200, dir: "row", justify: "center", align: "center" }); S.fillX(img); img.clipContent = true;
    if (x.none) S.txt(img, "Aucun aperçu : ouvre le fichier dans Penpot pour le générer.", { size: 12, color: C.mfg }); else { shot(img, 300, 200); if (x.stale) { const bb = S.row(null, { gap: 6, hs: "auto" }); img.appendChild(bb); abs(img, bb, 10, 10); S.badge(bb, "Périmé", C.fg, { fill: C.card }); S.badge(bb, "Hors ligne", C.fg, { fill: C.card }); } }
    const r = S.row(t, { gap: 6 }); S.icon(r, provider === "Figma" ? "frame" : "penTool", 13, C.mfg); S.fillX(S.txt(r, name, { size: 12, weight: 500 })); S.button(r, null, "ghost", { sm: true, icon: "refresh" });
    S.button(r, "Ouvrir dans " + provider, "ghost", { sm: true }); S.button(r, "Retirer", "ghost", { sm: true }); };
  thumb("Tickets · liste", "Figma"); thumb("Liste · filtres", "Penpot", o.none ? { none: true } : { stale: true });
  const ln = S.row(sh, { gap: 8 }); input(ln, o.bad ? "https://design.penpot.app/#/workspace/team/projet" : "Colle l'URL d'un cadre Figma ou d'un board Penpot", { placeholder: !o.bad, error: !!o.bad, size: 12 }); S.button(ln, "Lier un cadre", "outline", { sm: true, icon: "link" });
  if (o.bad) help(sh, "URL invalide : il faut un lien de cadre Figma (node-id) ou de board Penpot (board-id).", C.red); return sh; };
S.draw[4] = async () => { const { frame: f } = await kanbanAt(PAGE, "4 · Fiche ticket : section Maquettes", 0, 5); sheet(f); S.frontAbs(f); return f.id; };
S.draw["4b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "4b · Fiche ticket : URL refusée, aperçu absent", 2, 5); sheet(f, { bad: true, none: true }); S.frontAbs(f); return f.id; };

S.MAQUETTES = [16, "16b", 53, "53b", "53c", 147, "147b", "147c", "147d", 148, "148b", "148c", 149, "149b", 4, "4b"];
return "maquettes ok";
