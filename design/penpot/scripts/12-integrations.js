// Page « 10 · Intégrations » : écrans 50 à 57 (phase 5, plan kibo-integrations P1–P5). Base : copie de l'écran 16 (« base · 16 »).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "10 · Intégrations";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const clear = (b) => [...b.children].forEach(k => k.remove());
const fromBase = async (name, row) => { await S.page(PAGE); const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = root.children.find(c => c.name === "base · 16").clone(); f.name = name; f.x = 0; f.y = row * 1040; fixIcons(f); return f; };
// N15 : Figma = Frame, serveurs MCP = Plug
const swapIc = (row, name) => { const ic = row.children.find(c => c.name === "ic"); if (!ic) return; clear(ic); S.icon(ic, name, 16, C.fg); };
const fixIcons = (f) => { const fg = find(f, "Integ-Figma (MCP)"); if (fg) swapIc(fg, "frame"); const m = find(f, "Integ-Serveurs MCP"); if (m) swapIc(m, "plug"); };
const setState = (f, rowName, o) => { const r = find(f, rowName); const st = r.children.find(c => c.name === "state"); const dot = st.children.find(c => c.name === "dot"); const t = st.children.find(c => c.type === "text");
  if (o.dot) dot.fills = [{ fillColor: o.dot, fillOpacity: 1 }]; S.setText(t, o.label); if (o.color) t.fills = [{ fillColor: o.color, fillOpacity: 1 }];
  if (o.sub) { const tt = r.children.find(c => c.name === "t"); const s = tt.children.filter(c => c.type === "text")[1]; S.setText(s, o.sub); if (o.subColor) s.fills = [{ fillColor: o.subColor, fillOpacity: 1 }]; }
  if (o.button) { const i = r.children.findIndex(c => c.name === "state"); const b = S.button(null, o.button, "outline", { sm: true, icon: o.icon }); r.insertChild(i + 1, b); }
  return r; };
const head = (f) => find(f, "SettingsBody");

S.draw[50] = async () => {
  const f = await fromBase("50 · Intégrations : états", 0);
  setState(f, "Integ-GitHub Actions", { dot: C.red, label: "Erreur", color: C.red, sub: "gh a répondu 401 : reconnecte ton compte", subColor: C.red, button: "Réessayer", icon: "refresh" });
  setState(f, "Integ-GitHub Issues & Projects", { dot: C.amber, label: "Limite GitHub atteinte, reprise à 14:32", color: C.amber });
  const gh = find(f, "Integ-Serveurs MCP"); const more = gh.children.find(c => c.name === "Button / ghost"); more.fills = [{ fillColor: C.accent, fillOpacity: 1 }];
  await new Promise(r => setTimeout(r, 200));
  S.menu(f, more.x - f.x - 220 + more.width, more.y - f.y + more.height + 4, [["Configurer", "settings"], ["Tester la connexion", "activity", { hover: true }], "-", ["Déconnecter", "x", { danger: true }]], 220);
  S.frontAbs(f); return f.id; };

S.draw[51] = async () => {
  const f = await fromBase("51 · Trousseau système indisponible", 1);
  const body = head(f); const grid = body.children.find(c => c.name === "grid");
  const a = S.alert(null, "Trousseau système indisponible", "amber", { icon: "key", desc: "Kibo ne peut ni lire ni enregistrer de secret (Secret Service ne répond pas). Les intégrations qui en ont besoin sont en pause ; rien n'est écrit en clair sur le disque.", actions: [["Réessayer", "outline"]] });
  body.insertChild(body.children.findIndex(c => c.id === grid.id), a); S.fillX(a);
  ["Integ-GitHub", "Integ-GitHub Issues & Projects", "Integ-GitHub Actions", "Integ-Serveurs MCP"].forEach(n => setState(f, n, { dot: C.mfg, label: "Secret indisponible", color: C.mfg }));
  return f.id; };

const radioCard = (p, on, title, badge, lines, o = {}) => { const c = S.box(p, { name: "ChoiceCard", fill: on ? C.muted : null, stroke: on ? C.mfg : C.border, radius: 8, dir: "row", gap: 10, pad: 12, vs: "auto", align: "start" }); S.fillX(c);
  if (o.disabled) c.opacity = 0.5; S.radio(c, on); const tv = S.col(c, { gap: 4 }); const t = S.row(tv, { gap: 6 }); S.txt(t, title, { size: 13, weight: 500 }); if (badge) S.badge(t, badge, C.fg, { fill: C.accent });
  lines.forEach(l => { if (typeof l === "function") l(tv); else S.sub(tv, l); }); return c; };

S.draw[52] = async () => {
  const f = await fromBase("52 · Connecter GitHub (dialogue)", 2);
  const d = S.modal(f, 480, "Connecter GitHub", "PR, reviews et statuts CI de tes projets. Le jeton reste dans le trousseau système.");
  radioCard(d, false, "Utiliser gh", "Recommandé", [tv => { const r = S.row(tv, { gap: 6 }); S.dot(r, C.green, 7); S.txt(r, "gh est connecté (adam)", { size: 12, color: C.mfg }); }]);
  radioCard(d, true, "Jeton personnel", null, [tv => { S.field(tv, "Jeton", "github_pat_11A•••••••••••••••••", { mono: true, focus: true, icon: "key" }); }, "Portées requises : repo, project (Projects v2). read:org si le Project appartient à une organisation. workflow n'est pas requis.", tv => { const e = S.row(tv, { gap: 6 }); S.icon(e, "circleX", 13, C.red); S.txt(e, "GitHub a refusé ce jeton.", { size: 12, color: C.red }); }]);
  const ft = S.row(d, { gap: 8, justify: "end" }); S.button(ft, "Annuler", "outline");
  const b = S.button(ft, "Vérification…", "default", {}); b.opacity = 0.7; b.insertChild(0, S.spinner(null, C.pfg, 14));
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[53] = async () => {
  const f = await fromBase("53 · Connecter Figma (MCP)", 3);
  const d = S.modal(f, 480, "Connecter Figma (MCP)", "Kibo lit les nœuds Figma liés aux tickets via le serveur MCP de l'application Figma.");
  S.field(d, "Adresse du serveur", "http://127.0.0.1:3845/mcp", { mono: true, focus: true });
  S.sub(d, "Active « Dev Mode MCP Server » dans les préférences de Figma, puis garde l'application ouverte.");
  S.alert(d, "Serveur Figma injoignable", "red", { icon: "circleX", desc: "Rien n'écoute sur 127.0.0.1:3845. Vérifie que Figma est lancé et que le serveur MCP est activé." });
  S.alert(d, "Ce serveur n'expose pas les outils Figma attendus", "amber", { icon: "alert", desc: "Outils manquants : get_code, get_image. Mets Figma à jour." });
  S.footer(d, "Annuler", "Connecter"); S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[54] = async () => {
  const f = await fromBase("54 · Serveurs MCP (liste)", 4);
  const d = S.modal(f, 640, "Serveurs MCP", "Connecteurs génériques utilisables par les widgets Source MCP et par les agents.");
  const list = S.panel(d, { pad: 0, gap: 0, radius: 8 });
  [["context7", "context7", "Commande locale (stdio)", "2 outils", true, C.green, "Actif"], ["Fichiers", "filesystem", "Commande locale (stdio)", "11 outils", true, C.green, "Actif"], ["Linear", "linear", "Adresse HTTP", "—", false, C.mfg, "Désactivé"]].forEach(([n, id, t, tools, on, col, st]) => {
    const r = S.row(list, { gap: 12, pad: [10, 14] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    S.icon(r, "plug", 16, C.mfg); const tv = S.col(r, { gap: 2 }); const t1 = S.row(tv, { gap: 6 }); S.txt(t1, n, { size: 13, weight: 500 }); S.txt(t1, id, { size: 11, mono: true, color: C.dim }); S.txt(tv, t + " · " + tools, { size: 11, color: C.mfg });
    const s = S.row(r, { hs: "auto", gap: 6 }); S.dot(s, col, 7); S.txt(s, st, { size: 12, color: C.mfg }); S.toggle(r, on); S.button(r, "Retirer", "ghost", { sm: true }); });
  const ft = S.row(d, { gap: 8 }); S.button(ft, "Ajouter un serveur", "outline", { icon: "plus" }); S.spacer(ft); S.button(ft, "Fermer", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[55] = async () => {
  const f = await fromBase("55 · Ajouter un serveur MCP (étape 1)", 5);
  const d = S.modal(f, 560, "Ajouter un serveur MCP", "Étape 1 sur 2 · Décris le serveur.");
  const r = S.row(d, { gap: 12, align: "start" }); S.field(r, "Nom", "Fichiers"); S.field(r, "Identifiant", "filesystem", { mono: true });
  S.txt(d, "Type", { size: 12, weight: 500 }); const tr = S.row(d, { gap: 10, align: "start" });
  radioCard(tr, true, "Commande locale (stdio)", null, ["Kibo lance le processus"]); radioCard(tr, false, "Adresse HTTP", null, ["Serveur déjà lancé"]);
  S.field(d, "Commande", "bunx", { mono: true });
  S.field(d, "Arguments (un par ligne)", "@modelcontextprotocol/server-filesystem\n~/goinfre/Kibo", { mono: true, multi: true });
  S.txt(d, "Variables secrètes", { size: 12, weight: 500 });
  const v = S.row(d, { gap: 8 }); const a = S.box(v, { name: "Input", fill: C.bg, stroke: C.border, radius: 6, dir: "row", pad: [8, 10], vs: "auto", w: 180 }); S.txt(a, "FS_TOKEN", { size: 13, mono: true });
  const b = S.box(v, { name: "Input", fill: C.bg, stroke: C.border, radius: 6, dir: "row", pad: [8, 10], vs: "auto" }); S.fillX(b); S.txt(b, "••••••••••••", { size: 13, mono: true }); S.icon(v, "trash", 14, C.dim);
  S.button(d, "Ajouter une variable", "ghost", { sm: true, icon: "plus" });
  S.footer(d, "Annuler", "Continuer"); S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[56] = async () => {
  const f = await fromBase("56 · Confirmer la commande MCP (étape 2)", 6);
  const d = S.modal(f, 560, "Confirmer la commande", "Étape 2 sur 2 · Kibo lancera exactement ceci, sans shell.");
  S.code(d, [["bunx @modelcontextprotocol/server-filesystem ~/goinfre/Kibo", C.fg]]);
  S.sub(d, "Environnement réduit : PATH, HOME, LANG et FS_TOKEN (lu dans le trousseau). Aucune autre variable n'est transmise.");
  S.alert(d, "Ce processus aura les droits de ton utilisateur", "amber", { icon: "shieldAlert", desc: "N'ajoute qu'un serveur dont tu connais la source." });
  const ft = S.row(d, { gap: 8 }); S.button(ft, "Retour", "ghost", { icon: "arrowLeft" }); S.spacer(ft); S.button(ft, "Annuler", "outline"); S.button(ft, "Ajouter et lancer", "default");
  S.center(f, d); S.frontAbs(f); return f.id; };

S.draw[57] = async () => {
  const f = await fromBase("57 · Déconnecter GitHub (dialogue)", 7);
  const d = S.modal(f, 440, "Déconnecter GitHub ?", "Le jeton est retiré du trousseau. Les PR et statuts CI déjà liés aux tickets restent affichés mais ne sont plus mis à jour.");
  S.footer(d, "Annuler", "Déconnecter", "destructive"); S.center(f, d); S.frontAbs(f); return f.id; };
return "integrations ok";
