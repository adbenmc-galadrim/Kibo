// Page « 21 · Composants riches » : écran 30b et écrans 156 à 160 (phase 13, spec §19 et spec composants §19). Requiert 18-socle.js et 24-socle-suite.js.
// Numéros 156 à 160 proposés ici (la spec ne numérote pas les écrans de la phase 13) ; 30b complète l'écran 30 avec les capacités.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "21 · Composants riches";
const { find, wait, abs, rel, alertDialog, formDialog, input, select, listbox, help, labeled, pageHead, appScreen, kanbanAt } = S.fx;
const { iconButton, empty, cell, dashboard, widget, demoCard } = S.fx2;

// ---------- 30b · Autoriser un composant : capacités (§19, spec composants §19 point 1) ----------
const CAPS = [["box3d", "Afficher de la 3D (WebGL)", "utilise la carte graphique"], ["gamepad", "Lire les manettes branchées"], ["folder", "Lire les fichiers du projet", "dossier des fichiers de ce projet, lecture seule"],
  ["maximize", "Passer en plein écran dans Kibo"], ["x", "Aucun accès réseau"]];
const trustCard = (p, on, title, text) => { const c = S.box(p, { name: "ChoiceCard", stroke: on ? C.fg : C.border, radius: 8, dir: "row", gap: 10, pad: 12, vs: "auto", align: "start" }); S.fillX(c); S.radio(c, on);
  const tv = S.col(c, { gap: 2 }); S.txt(tv, title, { size: 13, weight: 600 }); S.sub(tv, text); return c; };
const componentsPage = async (name, col, row) => { const r = await appScreen(PAGE, name, col, row, null, ["Composants"], ["puzzle", "Composants"]); S.activate(r.frame, "Composants");
  pageHead(r.content, "Composants", "Les widgets et vues disponibles dans tes pages.", h => S.button(h, "Créer un composant", "default", { sm: true, icon: "plus" })); return r; };
S.draw["30b"] = async () => { const { frame: f } = await componentsPage("30b · Autoriser un composant : capacités", 0, 0);
  const d = formDialog(f, "Autoriser « Galerie 3D » 0.1.0 ?", 576, "Composant écrit par toi · empreinte sha256 d930…6247 · vérifiée par le démon");
  S.txt(d, "Il demande :", { size: 13, weight: 600 }); const l = S.panel(d, { gap: 10, pad: 14 });
  CAPS.forEach(([ic, t, h]) => { const r = S.row(l, { gap: 10, align: "start" }); S.icon(r, ic, 16, C.mfg); const tv = S.col(r, { gap: 2 }); S.txt(tv, t, { size: 13 }); if (h) S.txt(tv, h, { size: 12, color: C.mfg }); });
  S.txt(d, "Niveau de confiance", { size: 13, weight: 600 });
  trustCard(d, true, "Isolé (recommandé)", "Interface dans une iframe isolée, backend dans un processus séparé confiné par l'OS : ni réseau direct, ni accès à tes fichiers. Le démon vérifie chaque appel contre les permissions ci-dessus.");
  trustCard(d, false, "Confiance totale", "Chargé dans l'app et exécuté dans le démon, comme les intégrés : rien ne l'empêche de dépasser les permissions ci-dessus. À réserver au code que tu as écrit et relu.");
  help(d, "Si le code du composant change, l'empreinte change : Kibo redemande ton accord."); S.footer(d, "Refuser", "Autoriser"); S.frontAbs(f); return f.id; };

// ---------- 156 · Visionneuse 3D (spec composants §19 points 3 et 6) ----------
const cube = (p) => { const s = penpot.createShapeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="170" viewBox="0 0 180 170"><polygon points="20,40 110,20 160,50 70,72" fill="${C.mfg}"/><polygon points="20,40 70,72 76,160 26,128" fill="${C.dim}"/><polygon points="70,72 160,50 154,136 76,160" fill="${C.border}"/></svg>`);
  s.name = "Model"; p.appendChild(s); return s; };
const viewerWidget = (g, pos, o = {}) => { const v = widget(g, "Visionneuse 3D", "box3d", pos); if (o.empty) { empty(v.body, "Choisis un fichier .glb dans les réglages du widget.", { fill: true }); return v; }
  S.txt(v.body, "robot.glb", { size: 12, color: C.mfg }); const st = S.row(v.body, { justify: "center" }); S.child(st, { v: "fill" }); cube(st); return v; };
S.draw[156] = async () => { const { frame: f, g } = await dashboard(PAGE, "156 · Visionneuse 3D", 0, 1); viewerWidget(g, cell(0, 0, 6, 4)); return f.id; };
S.draw["156b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "156b · Visionneuse 3D : sans modèle", 2, 1); viewerWidget(g, cell(0, 0, 6, 4), { empty: true }); return f.id; };
S.draw["156c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "156c · Réglages de la Visionneuse 3D", 4, 1); viewerWidget(g, cell(0, 0, 6, 4));
  const d = formDialog(f, "Réglages · Visionneuse 3D", 440, "Ces réglages ne concernent que ce widget."); let sel = null;
  labeled(d, "Modèle (.glb)", c => { sel = select(c, "robot.glb", { w: 250, open: true }); }, { help: "Exporté de Blender en glTF binaire. Les fichiers viennent de Fichiers du projet." });
  labeled(d, "Vitesse de rotation", c => input(c, "1", { w: 220 }), { help: "Entre 0,5 et 4 tours par minute." });
  labeled(d, "Fil de fer", c => S.toggle(c, false)); S.footer(d, "Annuler", "Enregistrer"); await wait(2000);
  const p = rel(f, sel); listbox(f, p.x, p.y + p.h + 4, [["robot.glb", true], ["cube-demo.glb", false], ["stand-salon.glb", false]], 250); S.frontAbs(f); return f.id; };

// ---------- 157 · Serpent et plein écran de Kibo (§19, spec composants §19 points 4 et 8) ----------
const board = (p, w, h, o = {}) => { const b = S.box(p, { name: "GameBoard", fill: C.muted, w, h }); const u = Math.round(w / 20);
  [[9, 7], [10, 7], [11, 7]].forEach(([x, y]) => { const s = S.box(b, { name: "Snake", fill: C.fg, w: u - 2, h: u - 2 }); penpotUtils.setParentXY(s, x * u, y * u); });
  const a = S.box(b, { name: "Apple", fill: C.red, w: u - 2, h: u - 2 }); penpotUtils.setParentXY(a, 17 * u, 11 * u);
  if (o.lost) { const m = S.box(b, { name: "GameOver", fill: C.card, stroke: C.border, radius: 8, dir: "column", gap: 4, pad: [12, 16], hs: "auto", vs: "auto", align: "center" }); S.txt(m, "Partie perdue", { size: 14, weight: 600 }); S.txt(m, "Score 12 · Meilleur 31 · Espace pour rejouer", { size: 12, color: C.mfg }); penpotUtils.setParentXY(m, Math.round(w / 2) - 150, Math.round(h / 2) - 30); }
  return b; };
const snakeWidget = (g, pos, o = {}) => { const v = widget(g, "Serpent", "gamepad", pos, { head: h => iconButton(h, "maximize", { color: C.fg }) });
  S.txt(v.body, o.lost ? "Score 12 · Meilleur 31" : "Score 0 · Meilleur 31 · Appuie sur Espace pour jouer · F : plein écran", { size: 12, color: C.mfg }); const st = S.row(v.body, { justify: "center" }); board(st, 300, 200, o); return v; };
S.draw[157] = async () => { const { frame: f, g } = await dashboard(PAGE, "157 · Serpent", 0, 2, { crumbs: ["Kibo", "Jeux"], tab: ["dashboard", "Kibo · Jeux"] }); snakeWidget(g, cell(0, 0, 6, 4)); return f.id; };
S.draw["157b"] = async () => { const { frame: f, g } = await dashboard(PAGE, "157b · Serpent : plein écran de Kibo", 2, 2, { crumbs: ["Kibo", "Jeux"], tab: ["dashboard", "Kibo · Jeux"] }); snakeWidget(g, cell(0, 0, 6, 4));
  const fs = S.box(f, { name: "FocusMode", fill: C.card, w: 1440, h: 940, dir: "column" }); abs(f, fs, 0, 0);
  const bar = S.row(fs, { gap: 8, pad: [10, 12] }); S.border(bar); S.icon(bar, "gamepad", 14, C.mfg); S.fillX(S.txt(bar, "Serpent", { size: 13, weight: 600 })); S.button(bar, "Quitter le plein écran (Échap)", "ghost", { sm: true, icon: "x" });
  const body = S.col(fs, { gap: 10, pad: [12, 12] }); S.child(body, { v: "fill" }); S.txt(body, "Score 0 · Meilleur 31 · Appuie sur Espace pour jouer · F : plein écran", { size: 12, color: C.mfg });
  const st = S.row(body, { justify: "center" }); board(st, 1160, 800); S.frontAbs(f); return f.id; };
S.draw["157c"] = async () => { const { frame: f, g } = await dashboard(PAGE, "157c · Serpent : partie perdue", 4, 2, { crumbs: ["Kibo", "Jeux"], tab: ["dashboard", "Kibo · Jeux"] }); snakeWidget(g, cell(0, 0, 6, 4), { lost: true }); return f.id; };

// ---------- 158 · Sélection partagée (spec composants §19 point 7) ----------
S.draw[158] = async () => { const { frame: f, g } = await dashboard(PAGE, "158 · Sélection partagée", 0, 3);
  const gr = widget(g, "Graphe de dépendances", "graph", cell(0, 0, 6, 4)); const cv = S.box(gr.body, { name: "Canvas", w: 520, h: 200 });
  [["KIB-11", "Démon : auth par jeton local", "En review", 10, 20, false], ["KIB-21", "Sandbox iframe", "Bloqué", 260, 20, true], ["KIB-22", "Export Markdown", "Backlog", 260, 120, false]].forEach(([k, t, s, x, y, on]) => {
    const n = S.box(cv, { name: "Node-" + k, fill: C.card, stroke: on ? C.fg : C.border, sw: on ? 2 : 1, radius: 8, w: 200, h: 52, dir: "column", gap: 2, pad: [8, 12] }); penpotUtils.setParentXY(n, x, y); if (!on) n.opacity = 0.5;
    const r = S.row(n, { gap: 6 }); S.statusDot(r, s, 7); S.txt(r, k, { size: 11, mono: true, color: C.dim }); S.txt(n, t, { size: 12, weight: 500 }); });
  const kb = widget(g, "Kanban", "kanban", cell(6, 0, 6, 6)); const tb = S.row(kb.body, { gap: 8 }); S.badge(tb, "1 sélectionné", C.fg, { icon: "x", round: true }); S.spacer(tb); S.txt(tb, "13 / 24 · Moi + agents", { size: 12, mono: true, color: C.mfg });
  const cols = S.row(kb.body, { gap: 8, align: "start" }); [["À faire", [{ id: "KIB-15", title: "Kanban : drag & drop entre colonnes", dim: true }]], ["Bloqué", [{ id: "KIB-21", title: "Sandbox iframe des composants", ring: true, motif: "Audit sécurité externe en attente" }]], ["Backlog", [{ id: "KIB-22", title: "Export Markdown / Obsidian", dim: true }]]].forEach(([n, ts]) => {
    const c = S.col(cols, { gap: 6, pad: 6, fill: C.muted, radius: 8 }); const h = S.row(c, { gap: 6 }); S.statusDot(h, n, 7); S.txt(h, n, { size: 11, weight: 500 }); ts.forEach(t => demoCard(c, t)); });
  help(gr.body, "Le Graphe sélectionne ; Kanban et Tickets suivent. La sélection reste en mémoire, sur cette page."); return f.id; };

// ---------- 159 · Fichiers du projet (§19, spec composants §19 point 2) ----------
const FILES = [["robot.glb", "Modèle", "2,4 Mio"], ["cube-demo.glb", "Modèle", "880 o"], ["stand-salon.glb", "Modèle", "6,1 Mio"], ["fond-stand.png", "Image", "312 Kio"], ["bip.ogg", "Son", "18 Kio"]];
const filesDialog = (f, o = {}) => { const d = formDialog(f, "Fichiers du projet", 672, "Modèles 3D, images et sons utilisables par les composants. Ils restent sur cet appareil.");
  const r = S.row(d, { gap: 8 }); S.fillX(S.txt(r, "Dossier : ~/.kibo/files/KIB · 9,7 Mio utilisés", { size: 12, color: C.mfg })); S.button(r, "Changer…", "outline", { sm: true, icon: "folderOpen" });
  const z = S.box(d, { name: "DropZone", stroke: C.border, dashed: true, radius: 8, dir: "row", gap: 8, pad: 12, vs: "auto", align: "center" }); S.fillX(z);
  S.fillX(S.txt(z, "Dépose des fichiers ici : .glb, images (.png, .jpg, .webp, .gif), sons (.mp3, .ogg, .wav).", { size: 12, color: C.mfg, lh: 1.4 })); S.button(z, "Importer…", "outline", { sm: true, icon: "upload" });
  if (o.uploads) { S.txt(d, "Envois en cours", { size: 12, weight: 600 }); const u = S.col(d, { gap: 4 }); S.txt(u, "Envoi de scene-bureau.glb · 42 %", { size: 12 }); const tr = S.box(u, { name: "Progress", fill: C.muted, radius: 999, h: 6, dir: "row" }); S.fillX(tr); S.box(tr, { name: "bar", fill: C.fg, radius: 999, w: 250, h: 6 });
    S.alert(d, "2 fichiers refusés", "red", { icon: "circleX", desc: "maquette.blend · Format non pris en charge : .blend\ndecor-complet.glb · Trop gros : 64 Mio maximum." }); }
  S.table(d, [["Nom"], ["Genre", 90], ["Taille", 80], ["Date", 100], ["", 90]], FILES.map(([n, k, s]) => [cell2 => S.txt(cell2, n, { size: 12, mono: true }), k, s, "4 oct. 2026", cell2 => S.button(cell2, "Supprimer", "ghost", { sm: true })]));
  return d; };
S.draw[159] = async () => { const { frame: f } = await kanbanAt(PAGE, "159 · Fichiers du projet", 0, 4); filesDialog(f); S.frontAbs(f); return f.id; };
S.draw["159b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "159b · Fichiers du projet : envois et refus", 2, 4); filesDialog(f, { uploads: true }); S.frontAbs(f); return f.id; };
S.draw["159c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "159c · Supprimer un fichier du projet", 4, 4);
  alertDialog(f, "Supprimer robot.glb ?", "Le fichier est effacé de cet appareil. Les widgets qui l'utilisent afficheront « Fichier introuvable »."); S.frontAbs(f); return f.id; };

// ---------- 160 · Gabarits de « Créer un composant » (spec composants §19 point 9) ----------
S.draw[160] = async () => { const { frame: f } = await componentsPage("160 · Créer un composant : gabarits", 0, 5);
  const d = formDialog(f, "Créer un composant", 560, "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.");
  labeled(d, "Ce que doit faire le composant", c => input(c, "Affiche le modèle du stand en 3D et le fait tourner.", { h: 56 }));
  labeled(d, "Identifiant", c => input(c, "affiche-le-modele", { mono: true }));
  const tr = S.row(d, { gap: 12, align: "start" }); labeled(tr, "Type", c => select(c, "Widget", { fill: true })); let g = null; labeled(tr, "Gabarit", c => { g = select(c, "3D", { fill: true, open: true }); });
  help(d, "Un gabarit donne un point de départ (kit 3D, boucle de jeu, graphique, tableau) ; les capacités utiles sont ajoutées au manifeste.");
  const ft = S.row(d, { gap: 8, justify: "end" }); S.spacer(ft); S.button(ft, "Annuler", "outline"); S.button(ft, "Générer avec un agent", "brand", { icon: "bot" }); await wait(2000);
  const p = rel(f, g); listbox(f, p.x, p.y + p.h + 4, [["Vide", false], ["3D", true, null, { hint: "webgl, assets" }], ["Jeu", false, null, { hint: "gamepad, audio, fullscreen" }], ["Graphique", false], ["Tableau", false]], Math.max(220, p.w)); S.frontAbs(f); return f.id; };

S.COMPOSANTS_RICHES = ["30b", 156, "156b", "156c", 157, "157b", "157c", 158, 159, "159b", "159c", 160];
return "composants-riches ok";
