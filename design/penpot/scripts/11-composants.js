// Page « 09 · Composants » : écrans 43 à 49 (phase 4, plan kibo-composants « Écrans à dessiner » D1–D9).
// Bases : copies collées des écrans 6, 7 et 11 (« base · n »), supprimées une fois la page finie.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "09 · Composants";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);
const clear = (b) => [...b.children].forEach(k => k.remove());
const fromBase = async (base, name, row) => { await S.page(PAGE); const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const f = root.children.find(c => c.name === "base · " + base).clone(); f.name = name; f.x = 0; f.y = row * 1040; return f; };
const headerOf = (w) => w.children.find(c => c.name === "header");
const setHeader = (w, title, icon) => { const h = headerOf(w); const t = h.children.find(c => c.type === "text"); S.setText(t, title);
  if (icon) { const old = h.children.find(c => /^icon/.test(c.name) && !/more/.test(c.name)); const i = h.children.findIndex(c => c.id === old.id); old.remove(); h.insertChild(i, S.icon(null, icon, 14, C.mfg)); } return h; };
const prRows = (body) => { clear(body);
  [["#12", "Tokens shadcn + thème sombre", "KIB-7 · review sonnet-review"], ["#15", "Démon : auth par jeton local", "KIB-11 · review postée"]].forEach(([n, t, s]) => {
    const r = S.row(body, { gap: 8, pad: [6, 0], align: "start" }); S.icon(r, "pr", 14, C.green); const tv = S.col(r, { gap: 2 }); const t1 = S.row(tv, { gap: 6 }); S.txt(t1, n, { size: 12, mono: true, color: C.mfg }); S.fillX(S.txt(t1, t, { size: 13 })); S.txt(tv, s, { size: 11, color: C.dim }); });
  const ft = S.txt(body, "2 PR ouvertes · adam/kibo", { size: 11, color: C.dim }); };
const toPR = (f) => { const w = find(f, "Widget / Mes tickets"); w.name = "Widget / PR en attente"; setHeader(w, "PR en attente · 0.3.0", "pr"); const body = w.children.find(c => c.name === "body"); prRows(body); return w; };

S.draw[43] = async () => {
  const f = await fromBase(7, "43 · Instance : mettre à jour vers", 0);
  const w = toPR(f); const more = headerOf(w).children.find(c => /more/.test(c.name));
  const hb = S.box(null, { name: "more-active", fill: C.accent, radius: 4, w: 22, h: 22, dir: "row", align: "center", justify: "center" }); const h = headerOf(w); const i = h.children.findIndex(c => c.id === more.id); more.remove(); h.insertChild(i, hb); S.icon(hb, "more", 14, C.fg);
  await new Promise(r => setTimeout(r, 200));
  const bx = hb.x - f.x, by = hb.y - f.y;
  S.menu(f, bx - 240 + 22, by + 28, [["Mettre à jour vers 0.4.0", "arrowUpCircle", { hover: true }], ["Modifier avec l'IA", "sparkles"], "-", ["Retirer de la page", "trash", { danger: true }]], 250);
  // menu d'une instance Notes : « Dossier des notes… »
  return f.id; };

S.draw[44] = async () => {
  const f = await fromBase(7, "44 · Instance : autorisation requise", 1);
  const w = toPR(f); const body = w.children.find(c => c.name === "body"); clear(body);
  body.flex.alignItems = "center"; body.flex.justifyContent = "center";
  const card = S.col(body, { gap: 8, pad: [12, 16], align: "center" });
  S.icon(card, "shieldAlert", 22, C.brand); S.txt(card, "Autorisation requise", { size: 13, weight: 600 });
  const t1 = S.txt(card, "« PR en attente » 0.3.0 doit être autorisé avant de s'afficher. Son code a changé depuis ton accord.", { size: 12, color: C.mfg, lh: 1.4 }); S.fillX(t1); t1.align = "center";
  S.button(card, "Examiner et autoriser", "outline", { sm: true, icon: "shield" });
  w.strokes = [{ strokeColor: "#7C2D12", strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  return f.id; };

S.draw[45] = async () => {
  const f = await fromBase(6, "45 · Composants : menu, confiance et brouillons", 2);
  f.children.filter(c => c.name === "Overlay" || /^Dialog/.test(c.name)).forEach(c => c.remove());
  const tbl = find(f, "ComponentsTable"); const rows = tbl.children.filter(c => c.name === "row");
  const pr = rows.find(r => r.children.some(c => c.characters === "PR en attente")); const pt = pr.children.filter(c => c.type === "text");
  const conf = pt.find(t => t.characters === "Sandboxé"); if (conf) { S.setText(conf, "Autorisation requise"); conf.fills = [{ fillColor: C.brand, fillOpacity: 1 }]; }
  pr.fills = [{ fillColor: C.muted, fillOpacity: 1 }];
  const moreT = pt[pt.length - 1];
  await new Promise(r => setTimeout(r, 200));
  S.menu(f, moreT.x - f.x - 230, moreT.y - f.y + 20, [["Examiner et autoriser", "shield"], ["Revérifier l'empreinte", "scanSearch", { hover: true }], ["Retirer la confiance", "shieldOff"], ["Modifier avec l'IA", "sparkles"], "-", ["Désinstaller", "trash", { danger: true, disabled: true }]], 250);
  const tip = S.box(f, { name: "Tooltip", fill: C.primary, radius: 6, dir: "row", pad: [6, 8], hs: "auto", vs: "auto" }); tip.layoutChild.absolute = true; S.txt(tip, "Utilisé sur des pages : retire d'abord ses instances.", { size: 11, color: C.pfg });
  penpotUtils.setParentXY(tip, moreT.x - f.x - 230 - 300, moreT.y - f.y + 20 + 116);
  // Brouillons
  const content = find(f, "Content");
  const hd = S.row(content, { gap: 8 }); S.h(hd, "Brouillons", { size: 14 }); S.txt(hd, "components/src · non publiés", { size: 12, color: C.dim });
  const bt = S.panel(content, { pad: 0, gap: 0, radius: 8 });
  [["Burndown", "burndown", "0.1.0", true], ["Suivi des revues", "review-tracker", "0.0.1", false]].forEach(([t, id, v, ok]) => {
    const r = S.row(bt, { gap: 12, pad: [10, 14] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    const tv = S.col(r, { w: 260, gap: 2 }); S.txt(tv, t, { size: 13, weight: 500 }); S.txt(tv, id, { size: 11, mono: true, color: C.dim });
    const vb = S.box(r, { name: "v", w: 80, dir: "row", vs: "auto" }); S.txt(vb, v, { size: 12, mono: true });
    const st = S.row(r, { gap: 6 }); S.dot(st, ok ? C.green : C.mfg, 7); S.txt(st, ok ? "Tests verts" : "À valider", { size: 12, color: ok ? C.green : C.mfg }); if (!ok) S.txt(st, "kibo component test review-tracker", { size: 11, mono: true, color: C.dim });
    S.button(r, "Publier", "outline", { sm: true, icon: "upload", disabled: !ok }); });
  S.frontAbs(f);
  return f.id; };

S.draw[46] = async () => {
  const f = await fromBase(11, "46 · Note modifiée hors de Kibo (conflit)", 3);
  const ed = find(f, "Editor"); const meta = ed.children.find(c => c.name === "meta"); const st = meta.children.filter(c => c.type === "text").pop(); S.setText(st, "Non enregistré"); st.fills = [{ fillColor: C.amber, fillOpacity: 1 }];
  const ban = S.box(null, { name: "ConflictBanner", fill: "#1F1608", stroke: "#78350F", radius: 8, dir: "row", gap: 10, pad: [10, 12], vs: "auto", align: "center" });
  ed.insertChild(1, ban); S.fillX(ban); S.icon(ban, "alert", 16, C.amber); const tv = S.col(ban, { gap: 2 }); S.txt(tv, "Modifié hors de Kibo", { size: 13, weight: 500, color: C.amber }); S.sub(tv, "decisions-architecture.md a changé sur le disque pendant que tu l'éditais.");
  S.button(ban, "Recharger", "secondary", { sm: true }); S.button(ban, "Garder ma version", "default", { sm: true });
  return f.id; };

S.draw[47] = async () => {
  const f = await fromBase(11, "47 · Dossier des notes (dialogue)", 4);
  const d = S.modal(f, 480, "Dossier des notes", "Chemin absolu d'un dossier Markdown ou d'un vault Obsidian. Réglage propre à cette machine.");
  S.field(d, "Dossier", "~/goinfre/Kibo/notes-archive", { mono: true, focus: true, icon: "folder" });
  S.alert(d, "Dossier introuvable ou illisible.", "red", { icon: "circleX" });
  S.footer(d, "Annuler", "Enregistrer"); S.center(f, d); S.frontAbs(f);
  return f.id; };

S.draw[48] = async () => {
  const f = await fromBase(11, "48 · Notes : états vides", 5);
  const nl = find(f, "NoteList"); nl.children.filter(c => /^Note-/.test(c.name)).forEach(c => c.remove());
  const e = S.col(null, { gap: 6, pad: [24, 8], align: "center" }); nl.insertChild(nl.children.findIndex(c => c.name === "sp"), e); S.fillX(e);
  S.icon(e, "note", 20, C.dim); S.txt(e, "Aucune note dans ce dossier.", { size: 12, color: C.mfg });
  const ed = find(f, "Editor"); clear(ed); ed.flex.alignItems = "center"; ed.flex.justifyContent = "center";
  const c = S.col(ed, { gap: 10, align: "center", w: 360 }); S.icon(c, "file", 28, C.dim); S.txt(c, "Choisis une note ou crées-en une.", { size: 14, color: C.mfg }); S.button(c, "Nouvelle note", "outline", { sm: true, icon: "plus" });
  const bl = find(f, "Backlinks"); clear(bl); S.txt(bl, "Tickets liés", { size: 12, weight: 600 }); S.txt(bl, "Aucun ticket lié.", { size: 12, color: C.dim });
  return f.id; };

S.draw[49] = async () => {
  const f = await fromBase(7, "49 · Widgets vides et « Créer une page Graphe ? »", 6);
  const g = find(f, "Widget / Graphe de dépendances"); const gb = g.children.find(c => c.name === "body"); clear(gb); gb.flex.alignItems = "center"; gb.flex.justifyContent = "center";
  const gc = S.col(gb, { gap: 8, align: "center" }); S.icon(gc, "graph", 20, C.dim); S.txt(gc, "Aucun chemin critique : aucun ticket bloquant.", { size: 12, color: C.mfg }); S.txt(gc, "Ouvrir le graphe →", { size: 12, color: C.mfg });
  const n = find(f, "Widget / Notes"); const nb = n.children.find(c => c.name === "body"); clear(nb); nb.flex.alignItems = "center"; nb.flex.justifyContent = "center";
  const nc = S.col(nb, { gap: 8, align: "center" }); S.icon(nc, "note", 20, C.dim); S.txt(nc, "Aucune note pour l'instant.", { size: 12, color: C.mfg });
  const d = S.modal(f, 440, "Créer une page Graphe ?", "Aucune page Vue de ce projet ne contient ce composant.");
  S.footer(d, "Annuler", "Créer la page"); S.center(f, d); S.frontAbs(f);
  return f.id; };
return "composants ok";
