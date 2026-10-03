// Page « 18 · Agents, code & démarrage » : écrans 121 à 124 (phase 9, plan kibo-phase-9-vague-3). Requiert 18-socle.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "18 · Agents, code & démarrage";
const { find, wait, shadow, abs, rel, alertDialog, input, help, hline, segmented, appScreen, kanbanAt } = S.fx;

// ---------- 121 · Agents : historique et confirmations ----------
const RUNS = [["sonnet-review", "KIB-11", "Terminé", "il y a 41 min", C.green], ["opus-dev-2", "KIB-14", "Attend une réponse", "il y a 3 min", C.amber], ["opus-dev-1", "KIB-9", "Échec", "il y a 2 h", C.red],
  ["opus-dev", "KIB-5", "Terminé", "hier", C.green], ["opus-dev-3", "KIB-26", "Annulé", "hier", C.mfg]];
const agentsScreen = async (name, col, row, o = {}) => { const r = await appScreen(PAGE, name, col, row, null, ["Agents"], ["bot", "Agents"]); S.activate(r.frame, "Agents");
  const c = r.content; S.sub(c, "Un run est le travail d'un agent sur un ticket.", { size: 13 });
  const st = S.row(c, { gap: 12, align: "start" });
  [["2 places sur 3", "runs en cours", C.blue], ["3", "runs en file d'attente", C.cyan], ["1", "attend une réponse (place libérée)", C.amber], ["12 400", "tokens aujourd'hui", C.mfg]].forEach(([v, l, col], i) => {
    const p = S.panel(st, { gap: 4, pad: 16 }); const h = S.row(p, { gap: 8 }); S.dot(h, col, 8); S.txt(h, v, { size: 22, weight: 600 }); S.txt(p, l, { size: 12, color: C.mfg });
    if (i === 3) S.txt(p, "Comptés par Claude Code sur ton abonnement.", { size: 11, color: C.dim }); });
  const hh = S.row(c, { gap: 12 }); S.h(hh, "Historique", { size: 15 }); S.spacer(hh); segmented(hh, ["Tous", "Terminés", "En échec", "Annulés", "En attente"], "Tous"); input(hh, "KIB-12", { placeholder: true, w: 160, icon: "search" });
  S.table(c, [["Run"], ["Ticket", 90], ["État", 190], ["Quand", 120]], RUNS.map(([a, k, s, w, col]) => [
    cell => { S.icon(cell, "bot", 14, C.mfg); S.txt(cell, a, { size: 12, mono: true }); }, cell => S.txt(cell, k, { size: 12, mono: true, color: C.mfg }),
    cell => { S.dot(cell, col, 7); S.txt(cell, s, { size: 12 }); }, cell => S.txt(cell, w, { size: 12, color: C.dim })]), { hl: o.hl });
  return r; };
const drawer = (f, missing) => { const d = S.box(f, { name: "AgentDrawer", fill: C.card, stroke: C.border, w: 1192, h: 330, dir: "column", gap: 0 }); shadow(d); abs(f, d, 248, 570);
  const h = S.row(d, { gap: 10, pad: [10, 16] }); S.border(h); S.icon(h, "bot", 14, C.fg); S.txt(h, "Agents", { size: 13, weight: 500 }); S.txt(h, "2/3 places · 3 en file · 1 attend une réponse", { size: 12, color: C.mfg }); S.spacer(h); S.icon(h, "chevDown", 14, C.mfg);
  const b = S.row(d, { gap: 0, align: "start" }); S.child(b, { v: "fill" });
  const l = S.box(b, { name: "Runs", w: 380, dir: "column", gap: 4, pad: 12, vs: "auto" }); S.label(l, "Terminé · il y a 41 min");
  const sel = S.row(l, { gap: 8, pad: [6, 8], radius: 6, stroke: C.mfg }); S.dot(sel, C.green, 7); S.txt(sel, "sonnet-review", { size: 12, mono: true }); S.txt(sel, "KIB-11 · Démon : auth par jeton local", { size: 12, color: C.mfg });
  const j = S.col(b, { name: "Journal", gap: 8, pad: 12 }); const jh = S.row(j, { gap: 8 }); S.icon(jh, "bot", 14, C.mfg); S.txt(jh, "sonnet-review", { size: 13, mono: true, weight: 600 }); S.txt(jh, "KIB-11 · Démon : auth par jeton local", { size: 12, color: C.mfg }); S.spacer(jh); S.txt(jh, "terminé · 6 min", { size: 12, mono: true, color: C.dim });
  const box = S.panel(j, { gap: 6, pad: [10, 12], fill: C.bg });
  if (missing) S.txt(box, "Journal indisponible pour ce run.", { size: 12, color: C.mfg });
  else [["14:02", "SessionStart", "brief.md + 6 guidelines chargés", C.blue], ["14:03", "PostToolUse", "Read packages/daemon/src/auth.ts", C.blue], ["14:08", "PostToolUse", "Bash gh pr review 15 --comment", C.blue], ["14:09", "Stop", "Review de la PR #15 postée.", C.green], ["14:09", "SessionEnd", "other", C.mfg]].forEach(([t, e, x, col]) => S.hookLine(box, t, e, x, { color: col }));
  return d; };
S.draw[121] = async () => { const { frame: f } = await agentsScreen("121 · Agents : historique", 0, 0, { hl: 0 }); drawer(f, false); S.frontAbs(f); return f.id; };
S.draw["121b"] = async () => { const { frame: f } = await agentsScreen("121b · Agents : journal indisponible", 2, 0, { hl: 0 }); drawer(f, true); S.frontAbs(f); return f.id; };
S.draw["121c"] = async () => { const { frame: f } = await agentsScreen("121c · Arrêter un run", 4, 0); alertDialog(f, "Arrêter le run opus-dev-2 sur KIB-14 ?", "L'agent est interrompu ; le ticket reste assigné.", "Arrêter"); S.frontAbs(f); return f.id; };
S.draw["121d"] = async () => { const { frame: f } = await agentsScreen("121d · Retirer un run de la file", 6, 0); alertDialog(f, "Retirer KIB-18 de la file ?", "Le run ne démarrera pas ; le ticket reste assigné.", "Retirer"); S.frontAbs(f); return f.id; };
S.draw["121e"] = async () => { const { frame: f } = await agentsScreen("121e · Supprimer un profil", 8, 0); alertDialog(f, "Supprimer le profil opus-dev ?", "Ses runs passés restent dans l'historique.", "Supprimer"); S.frontAbs(f); return f.id; };

// ---------- 122 · Changements : libellés ----------
const KIND = { "Modifié": C.amber, "Ajouté": C.green, "Supprimé": C.red };
const changes = async (name, col, o = {}) => { const r = await appScreen(PAGE, name, col, 1, "Changements", ["Kibo", "Changements"], ["git", "Kibo · Changements"]);
  const c = r.content; c.flex.dir = "row"; c.flex.columnGap = 16; c.flex.alignItems = "start";
  const left = S.panel(c, { name: "ChangedFiles", w: 360, gap: 4, pad: 8 }); S.child(left, { v: "fill" });
  const wt = S.row(left, { gap: 8, pad: [6, 8], stroke: C.border, radius: 6 }); S.icon(wt, "branch", 14, C.mfg); S.fillX(S.txt(wt, "worktree kib-12", { size: 12, mono: true, weight: 600 })); S.icon(wt, "chevDown", 12, C.dim);
  [["Dans le prochain commit (2)", "Tout retirer", [["Modifié", "packages/core/tree.ts", true], ["Modifié", "packages/schema/src/ticket.ts", true]]],
   ["Modifications (3)", "Tout ajouter", [["Modifié", "packages/core/ticket.ts", false], ["Ajouté", "notes.md", false], ["Supprimé", "packages/core/old-tree.ts", false]]]].forEach(([sec, all, list], si) => {
    const h = S.row(left, { gap: 6, pad: [8, 6, 4, 6] }); S.icon(h, "chevDown", 12, C.mfg); S.fillX(S.txt(h, sec, { size: 12, weight: 500, color: C.mfg })); S.button(h, all, "ghost", { sm: true });
    list.forEach(([k, p, on], i) => { const fr = S.row(left, { gap: 8, pad: [6, 8], radius: 6, fill: si === 1 && i === 0 ? C.accent : null }); S.check(fr, on);
      const kk = S.box(fr, { name: "kind", w: 62, dir: "row", vs: "auto" }); S.txt(kk, k, { size: 11, weight: 500, color: KIND[k] }); S.fillX(S.txt(fr, p, { size: 12, mono: true }));
      if (si === 1 && i === 0) S.button(fr, "Ajouter au commit", "ghost", { sm: true }); }); });
  const mid = S.panel(c, { gap: 0, pad: 0 }); S.child(mid, { v: "fill" }); const mh = S.row(mid, { gap: 8, pad: [10, 14] }); S.border(mh);
  S.fillX(S.txt(mh, "packages/core/ticket.ts", { size: 12, mono: true })); S.txt(mh, "+3 −1", { size: 12, mono: true, color: C.mfg }); S.txt(mh, "Retour à la ligne", { size: 12, color: C.mfg }); S.toggle(mh, false);
  const code = S.col(mid, { gap: 0, pad: [6, 0] });
  [["@@ -12,6 +12,9 @@ export const TicketNode", C.dim, null], ["  export const TicketNode = z.object({", C.fg, null], ["    id: TicketId,", C.fg, null], ["-   parent: z.string().nullable(),", C.red, "#2A0F0F"],
   ["+   parentId: TicketId.nullable(),", C.green, "#0D1F12"], ["+   order: z.number().int(),", C.green, "#0D1F12"], ["+   depth: z.number().int().min(0),", C.green, "#0D1F12"], ["    status: Status,", C.fg, null], ["  });", C.fg, null]].forEach(([t, col, bg]) => {
    const l = S.row(code, { gap: 0, pad: [2, 14], fill: bg }); S.fillX(S.txt(l, t, { size: 12, mono: true, color: col, lh: 1.5 })); });
  const right = S.panel(c, { name: "Commit", w: 320, gap: 12, pad: 16 }); S.child(right, { v: "fill" }); const rh = S.row(right, { gap: 8 }); S.icon(rh, "git", 14, C.fg); S.txt(rh, "Commit", { size: 14, weight: 600 }); S.spacer(rh); S.txt(rh, "2 fichiers dans le commit", { size: 11, color: C.dim });
  S.txt(right, "Message", { size: 12, weight: 500 }); input(right, "feat(core): schéma Loro des tickets", { mono: true, size: 12, h: 96 }); help(right, "Pré-rempli depuis le ticket · 0 token");
  S.check(right, false, "Modifier le dernier commit (non poussé)");
  const cb = S.button(right, o.pushing ? "Commit" : "Commit sur kib-12  ⌘↵", "default", { icon: "check" }); S.fillX(cb); cb.flex.justifyContent = "center"; if (o.pushing) cb.opacity = 0.45;
  if (o.pushing) { const pp = S.panel(right, { gap: 8, pad: 12, fill: C.muted }); const pr = S.row(pp, { gap: 8 }); S.spinner(pr, C.mfg, 14); S.fillX(S.txt(pr, "Publication de la branche kib-12 sur origin…", { size: 12 }));
    const dt = S.row(pp, { gap: 6 }); S.icon(dt, "chevDown", 14, C.mfg); S.txt(dt, "Détails", { size: 12, weight: 500, color: C.mfg }); S.code(pp, [["git push -u origin kib-12", C.fg]]); }
  S.spacer(right); const ft = S.row(right, { gap: 8 }); S.button(ft, "Pousser", "outline", { sm: true, icon: "upload" }); S.button(ft, "Pousser et créer la PR", "secondary", { sm: true, icon: "pr" });
  return r; };
S.draw[122] = async () => { const { frame: f } = await changes("122 · Changements : libellés", 0); return f.id; };
S.draw["122b"] = async () => { const { frame: f } = await changes("122b · Changements : publication", 2, { pushing: true }); return f.id; };

// ---------- 123 · Chargement et Kibo ne répond pas ----------
const bare = async (name, col) => { await S.page(PAGE); const light = S.mode === "light"; const full = light ? name + " (clair)" : name;
  const old = penpot.currentPage.root.children.find(c => c.name === full); if (old) old.remove();
  const f = S.box(null, { name: full, w: 1440, h: 940, fill: C.bg, dir: "column", gap: 16, align: "center", justify: "center" }); f.x = (col + (light ? 1 : 0)) * 1540; f.y = 2 * 1040; S.fresh = new Set(); return f; };
S.draw[123] = async () => { const f = await bare("123 · Chargement de Kibo", 0); S.logo(f, 56, S.mode); S.txt(f, "Chargement de Kibo…", { size: 14, color: C.mfg }); return f.id; };
const unreachable = (f, tip) => { S.logo(f, 56, S.mode); const c = S.box(f, { name: "Unreachable", w: 440, dir: "column", gap: 10, vs: "auto", align: "center" });
  S.txt(c, "Kibo ne répond pas", { size: 20, weight: 600 }); S.txt(c, "Kibo n'est pas lancé, ou il ne répond pas à cette adresse.", { size: 13, color: C.mfg }); S.txt(c, tip, { size: 13, color: C.mfg });
  S.box(c, { name: "gap", w: 1, h: 6 }); S.button(c, "Réessayer", "default", { icon: "refresh" }); S.txt(c, "Nouvelle tentative dans 3 s…", { size: 12, color: C.dim }); };
S.draw["123b"] = async () => { const f = await bare("123b · Kibo ne répond pas (application)", 2); unreachable(f, "Relance Kibo."); return f.id; };
S.draw["123c"] = async () => { const f = await bare("123c · Kibo ne répond pas (navigateur)", 4); unreachable(f, "Vérifie que Kibo tourne sur l'ordinateur, puis réessaie."); return f.id; };
S.draw["123d"] = async () => { const { frame: f } = await kanbanAt(PAGE, "123d · Barre des agents hors ligne", 6, 2);
  const bar = find(f, "AgentStatusBar"); const t = penpotUtils.findShape(s => s.type === "text" && /Démon local/.test(s.characters), bar); if (t) { S.setText(t, "● Kibo · hors ligne"); t.fills = [{ fillColor: C.red, fillOpacity: 1 }]; }
  return f.id; };

// ---------- 124 · Aperçu de fichier ----------
const SRC = ['import { z } from "zod";', 'import { Status } from "./status";', "", "export const TicketId = z.string().regex(/^[A-Z]{2,6}-\\d+$/);", "export type TicketId = z.infer<typeof TicketId>;", "",
  "export const TicketNode = z.object({", "  id: TicketId,", "  parentId: TicketId.nullable(),", "  order: z.number().int(),", "  depth: z.number().int().min(0),", "  status: Status,", "});", "",
  "export type TicketNode = z.infer<typeof TicketNode>;"];
const preview = async (name, col, o) => { const r = await appScreen(PAGE, name, col, 3, null, ["Kibo", "packages/core/ticket.ts"], ["fileCode", "ticket.ts"]);
  const c = r.content; const p = S.panel(c, { gap: 0, pad: 0 }); S.child(p, { v: "fill" });
  const h = S.row(p, { gap: 10, pad: [8, 14] }); S.border(h); S.icon(h, "fileCode", 14, C.mfg); S.fillX(S.txt(h, "packages/core/ticket.ts", { size: 12, mono: true })); S.button(h, "Copier le chemin", "ghost", { sm: true, icon: "copy" });
  S.txt(h, "Retour à la ligne", { size: 12, color: C.mfg }); S.toggle(h, true);
  const fb = S.row(p, { gap: 6, pad: [6, 14] }); S.border(fb); S.spacer(fb); input(fb, o.query, { mono: true, w: 260, icon: "search", focus: true }); S.txt(fb, o.count, { size: 12, mono: true, color: C.mfg });
  S.button(fb, null, "ghost", { sm: true, icon: "arrowUp" }); S.button(fb, null, "ghost", { sm: true, icon: "arrowDown" }); S.button(fb, null, "ghost", { sm: true, icon: "x" });
  const code = S.col(p, { gap: 0, pad: [8, 0] }); S.child(code, { v: "fill" });
  o.lines.forEach(([n, t]) => { const cur = n === o.current; const l = S.row(code, { gap: 16, pad: [1, 14], fill: cur ? C.muted : null }); const nn = S.box(l, { name: "ln", w: 28, dir: "row", vs: "auto", justify: "end" }); S.txt(nn, String(n), { size: 12, mono: true, color: cur ? C.fg : C.dim });
    const tx = S.row(l, { gap: 0 }); if (o.mark && t.includes(o.mark)) { const parts = t.split(o.mark); parts.forEach((pt, i) => { if (pt) S.txt(tx, pt, { size: 12, mono: true, lh: 1.6 }); if (i < parts.length - 1) { const m = S.box(tx, { name: "Match", fill: "#1F1608", stroke: n === o.current && i === 0 ? C.amber : null, radius: 2, dir: "row", hs: "auto", vs: "auto" }); S.txt(m, o.mark, { size: 12, mono: true, lh: 1.6 }); } }); }
    else S.txt(tx, t || " ", { size: 12, mono: true, lh: 1.6 }); });
  const ft = S.row(p, { gap: 8, pad: [6, 14] }); ft.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; S.spacer(ft); S.txt(ft, o.footer, { size: 11, mono: true, color: C.dim });
  return r; };
S.draw[124] = async () => { const { frame: f } = await preview("124 · Aperçu de fichier : recherche", 0, { query: "TicketId", count: "3 / 12", mark: "TicketId", current: 8, footer: "Ligne 8 · Col 7", lines: SRC.map((t, i) => [i + 1, t]) }); return f.id; };
S.draw["124b"] = async () => { const lines = SRC.map((t, i) => [i + 35, t]); const { frame: f } = await preview("124b · Aperçu de fichier : aller à la ligne", 2, { query: ":42", count: "", current: 42, footer: "Ligne 42 · Col 1", lines }); return f.id; };

S.AGENTS_CODE = [121, "121b", "121c", "121d", "121e", 122, "122b", 123, "123b", "123c", "123d", 124, "124b"];
return "agents-code ok";
