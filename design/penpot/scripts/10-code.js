// Page « 08 · Code (états) » : écrans 36 à 42 (phase 3, specs/2026-09-26-kibo-code-onglets.md).
// Base : copie de l'écran 21 collée sur la page (S.base21 = id de cette copie, nommée « base · 21 »).
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "08 · Code (états)";
const find = (f, n) => penpotUtils.findShape(s => s.name === n, f);

S.fromBase = async (baseName, name, row) => { await S.page(PAGE);
  const root = penpot.currentPage.root; const old = root.children.find(c => c.name === name); if (old) old.remove();
  const b = root.children.find(c => c.name === baseName); const f = b.clone(); f.name = name; f.x = 0; f.y = row * 1040; return f; };
const T = (f, from, to) => S.replaceText(f, from, to);
const seg = (f, label) => { const sg = find(f, "Segmented"); sg.children.forEach(s => { const t = s.children.find(c => c.type === "text"); const on = t.characters === label;
  s.fills = on ? [{ fillColor: C.card, fillOpacity: 1 }] : []; t.fills = [{ fillColor: on ? C.fg : C.mfg, fillOpacity: 1 }]; S.setText(t); }); };
const clear = (b) => [...b.children].forEach(k => k.remove());
const hunk = (p, t) => { const h = S.box(p, { name: "hunk", fill: C.muted, dir: "row", pad: [4, 14], vs: "auto", align: "center" }); S.fillX(h); S.fillX(S.txt(h, t, { size: 11, mono: true, color: C.dim })); S.txt(h, "Indexer le bloc", { size: 11, color: C.mfg }); return h; };
const sLine = (p, n, sign, txt) => { const bg = sign === "-" ? "#2A0F0F" : sign === "+" ? "#0D1F12" : null; const col = sign === "-" ? "#FCA5A5" : sign === "+" ? "#86EFAC" : C.fg;
  const l = S.box(p, { name: "line", fill: bg, dir: "row", vs: "auto", h: 19, align: "center" }); S.fillX(l);
  const nb = S.box(l, { name: "n", w: 36, dir: "row", justify: "end", pad: [0, 8, 0, 0], vs: "auto" }); S.txt(nb, n || " ", { size: 12, mono: true, color: C.dim });
  const sb = S.box(l, { name: "s", w: 16, dir: "row", vs: "auto" }); S.txt(sb, sign === " " ? " " : sign || " ", { size: 12, mono: true, color: col });
  S.txt(l, txt || " ", { size: 12, mono: true, color: col }); if (!n && !txt) l.fills = [{ fillColor: C.muted, fillOpacity: 0.5 }]; return l; };

S.draw[36] = async () => {
  const f = await S.fromBase("base · 21", "36 · Diff côte à côte", 0);
  seg(f, "Côte à côte");
  const code = find(f, "code"); clear(code); code.flex.dir = "column";
  const H = [["@@ -38,5 +38,11 @@ export const TicketSchema", [
      [["38", " ", "export const TicketSchema = z.object({"], ["38", " ", "export const TicketSchema = z.object({"]],
      [["39", " ", "  id: z.string(),"], ["39", " ", "  id: z.string(),"]],
      [["40", "-", "  parentId: z.string().nullable(),"], ["40", "+", "  key: z.string().regex(/^[A-Z]+-\\d+/),"]],
      [[null, null, null], ["41", "+", "  statusId: z.string(),"]],
      [[null, null, null], ["42", "+", "  domainId: z.string().optional(),"]],
      [[null, null, null], ["43", "+", "  assignee: AssigneeSchema.optional(),"]],
      [["41", " ", "});"], ["44", " ", "});"]],
      [["42", " ", " "], ["45", " ", " "]],
      [[null, null, null], ["46", "+", "export function moveTicket(tree: Lo…"]],
      [[null, null, null], ["47", "+", "  tree.move(id, parent)"]],
      [[null, null, null], ["48", "+", "}"]]]],
    ["@@ -44,3 +50,3 @@ export function toIndexRow", [
      [["44", " ", "export function toIndexRow(t: Tic…"], ["50", " ", "export function toIndexRow(t: Tic…"]],
      [["45", "-", "  return { id: t.id, parent: t.pa…"], ["51", "+", "  return { id: t.id, key: t.key, …"]],
      [["46", " ", "}"], ["52", " ", "}"]]]]];
  for (const [h, rows] of H) { hunk(code, h);
    for (const [a, b] of rows) { const r = S.box(code, { name: "pair", dir: "row", vs: "auto" }); S.fillX(r);
      const L = S.box(r, { name: "old", dir: "column", vs: "auto" }); S.fillX(L); const R = S.box(r, { name: "new", dir: "column", vs: "auto" }); S.fillX(R);
      L.clipContent = true; R.clipContent = true; R.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
      sLine(L, a[0], a[1], a[2]); sLine(R, b[0], b[1], b[2]); } }
  const hd = S.box(null, { name: "paneHeads", dir: "row", fill: C.bg, vs: "auto" }); code.insertChild(0, hd); S.fillX(hd);
  for (const t of ["Index (avant)", "Worktree (après) · éditable"]) { const c = S.box(hd, { name: "ph", dir: "row", pad: [6, 14], vs: "auto" }); S.fillX(c); S.txt(c, t, { size: 11, color: C.mfg }); }
  return f.id; };

S.draw[37] = async () => {
  const f = await S.fromBase("base · 21", "37 · Amender le dernier commit", 1);
  const inp = penpotUtils.findShape(s => s.name === "Input", find(f, "Field-Message")); const tx = inp.children.find(c => c.type === "text");
  S.setText(tx, "feat(core): opérations move / reparent (KIB-25)\n\n- move atomique dans LoroTree\n- reparent sans perte d'ordre");
  inp.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  const gen = find(f, "gen"); const gt = gen.children.find(c => c.type === "text"); S.setText(gt, "Message chargé depuis a1f3c2e");
  const am = find(f, "amend"); const cb = am.children.find(c => c.name === "checkbox"); clear(cb); cb.fills = [{ fillColor: C.primary, fillOpacity: 1 }]; cb.strokes = []; if (!cb.flex) { const fl = cb.addFlexLayout(); fl.alignItems = "center"; fl.justifyContent = "center"; } S.icon(cb, "check", 11, C.pfg);
  S.setText(am.children.find(c => c.type === "text"), "Modifier le dernier commit a1f3c2e (non poussé)");
  const cbtn = find(f, "CommitButton"); S.setText(cbtn.children.filter(c => c.type === "text")[0], "Amender a1f3c2e");
  const card = find(f, "Commit-a1f3c2e"); card.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; card.fills = [{ fillColor: C.muted, fillOpacity: 1 }];
  const acts = card.children.find(c => c.name === "actions"); clear(acts); S.badge(acts, "En cours de modification", C.fg, { icon: "pencil" }); S.button(acts, "Annuler la modification", "ghost", { sm: true });
  // aide sous le bouton
  const panel = find(f, "CommitPanel"); const idx = panel.children.findIndex(c => c.name === "CommitButton");
  const help = S.txt(null, "Les fichiers indexés (2) rejoignent a1f3c2e, et le message est remplacé. Le commit n'a jamais été poussé : rien ne change sur GitHub.", { size: 11, color: C.dim, lh: 1.4 }); panel.insertChild(idx + 1, help); S.fillX(help);
  return f.id; };

S.draw[38] = async () => {
  const f = await S.fromBase("base · 21", "38 · Reformuler un commit non poussé", 2);
  const d = S.modal(f, 520, "Reformuler 9bd02e1", "Seul le message change : le contenu du commit reste identique.");
  S.field(d, "Message", "test(core): tests de convergence fast-check (KIB-27)", { focus: true, mono: true });
  S.alert(d, "1 commit plus récent change d'identifiant", "muted", { icon: "info", desc: "Kibo réécrit l'historique local (rebase --autosquash). a1f3c2e deviendra un nouveau commit. Rien n'est poussé, tes fichiers indexés sont conservés." });
  const ft = S.footer(d, "Annuler", "Reformuler"); S.center(f, d); S.frontAbs(f);
  return f.id; };

S.draw[39] = async () => {
  const f = await S.fromBase("base · 21", "39 · Conflit (rebase en cours)", 3);
  const content = find(f, "Content"); const main = content.parent;
  const ban = S.box(null, { name: "ConflictBanner", fill: "#2A0F0F", dir: "row", gap: 10, pad: [10, 20], vs: "auto", align: "center" });
  main.insertChild(main.children.findIndex(c => c.name === "Content"), ban); S.fillX(ban);
  ban.strokes = [{ strokeColor: "#7F1D1D", strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
  S.icon(ban, "alert", 16, C.red); const tv = S.col(ban, { gap: 2 }); S.txt(tv, "Rebase en cours : conflit dans packages/core/src/ticket.ts", { size: 13, weight: 500, color: C.red });
  S.sub(tv, "Résous le conflit dans ton éditeur puis lance « git rebase --continue ». Kibo ne commite rien tant que l'opération est en cours.");
  S.button(ban, "Ouvrir dans l'éditeur", "outline", { sm: true, icon: "external" }); S.button(ban, "Abandonner le rebase", "destructive", { sm: true, icon: "undo" });
  // fichiers : section « En conflit »
  const cf = find(f, "ChangedFiles"); const secs = cf.children.filter(c => c.name === "sec");
  const t0 = secs[0].children.filter(c => c.type === "text"); S.setText(t0[0], "EN CONFLIT"); S.setText(t0[1], "1"); t0[0].fills = [{ fillColor: C.red, fillOpacity: 1 }];
  const tf = find(f, "File-packages / core / ticket.ts"); const mk = tf.children.filter(c => c.type === "text")[0]; S.setText(mk, "U"); mk.fills = [{ fillColor: C.red, fillOpacity: 1 }];
  const tr = find(f, "File-packages / core / tree.ts"); tr.remove(); const ck = tf.children.find(c => c.name === "checkbox"); if (ck) { clear(ck); ck.fills = []; ck.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; }
  // diff : marqueurs de conflit
  const code = find(f, "code"); clear(code); hunk(code, "@@ ticket.ts · conflit 1 sur 1");
  [["38", " ", "export const TicketSchema = z.object({"], ["39", " ", "  id: z.string(),"], ["40", "<", "<<<<<<< HEAD (main)"], ["41", " ", "  parentId: z.string().nullable(),"], ["42", " ", "  rank: z.number(),"], ["43", "=", "======="],
   ["44", " ", "  key: z.string().regex(/^[A-Z]+-\\d+/),"], ["45", " ", "  statusId: z.string(),"], ["46", ">", ">>>>>>> a1f3c2e (feat(core): opérations move / reparent)"], ["47", " ", "});"]]
    .forEach(([n, s, t]) => { const l = sLine(code, n, " ", t); if (/[<=>]/.test(s)) { l.fills = [{ fillColor: "#1F1608", fillOpacity: 1 }]; l.children.filter(c => c.type === "text" || c.children).forEach(() => {}); penpotUtils.findShapes(x => x.type === "text", l).slice(1).forEach(x => x.fills = [{ fillColor: C.amber, fillOpacity: 1 }]); } });
  const seg0 = find(f, "EditToggle"); if (seg0) seg0.opacity = 0.45;
  // commit désactivé
  const cb = find(f, "CommitButton"); cb.opacity = 0.45; S.setText(cb.children.filter(c => c.type === "text")[0], "Commit indisponible");
  const w = find(f, "AgentWarning"); const wt = w.children.find(c => c.type === "text"); S.setText(wt, "Opération git en cours : commit, amend, reformulation et push sont désactivés jusqu'à la fin du rebase.");
  ["Commit-a1f3c2e", "Commit-9bd02e1"].forEach(n => { const a = find(f, n).children.find(c => c.name === "actions"); a.opacity = 0.45; });
  find(f, "PushRow").opacity = 0.45;
  return f.id; };

const pushArea = (f) => { const pr = find(f, "PushRow"); const panel = pr.parent; const c = find(f, "Commit-47ce0aa"); if (c) c.remove(); const aw = find(f, "AgentWarning"); if (aw) aw.remove(); return { pr, panel }; };
S.draw[40] = async () => {
  const f = await S.fromBase("base · 21", "40 · Push en cours", 4);
  const { pr, panel } = pushArea(f); clear(pr);
  const b = S.button(pr, "Envoi vers origin/kib-12…", "outline", {}); S.fillX(b); b.opacity = 0.7; b.flex.justifyContent = "center"; const ic = S.spinner(null, C.fg, 14); b.insertChild(0, ic);
  const st = S.col(null, { gap: 6, pad: [10, 12], fill: C.muted, radius: 8, w: 308 }); panel.insertChild(panel.children.findIndex(c => c.name === "PushRow"), st); S.fillX(st);
  const r1 = S.row(st, { gap: 8 }); S.spinner(r1, C.blue, 12); S.txt(r1, "git push -u origin kib-12", { size: 12, mono: true }); S.spacer(r1); S.txt(r1, "4 s", { size: 11, mono: true, color: C.dim });
  S.sub(st, "2 commits (a1f3c2e, 9bd02e1). Jamais de force-push. Délai maximal : 2 min.", { size: 11 });
  ["Commit-a1f3c2e", "Commit-9bd02e1"].forEach(n => { const a = find(f, n).children.find(c => c.name === "actions"); a.opacity = 0.45; });
  return f.id; };

S.draw[41] = async () => {
  const f = await S.fromBase("base · 21", "41 · Push en échec", 5);
  const { pr, panel } = pushArea(f);
  const a = S.alert(null, "Le push a échoué", "red", { icon: "circleX", desc: "origin/kib-12 contient des commits que tu n'as pas (non-fast-forward). Récupère-les avec git pull --rebase, puis réessaie. Kibo ne force jamais le push." });
  panel.insertChild(panel.children.findIndex(c => c.name === "PushRow"), a); S.fillX(a);
  const out = S.code(null, [["! [rejected] kib-12 -> kib-12 (fetch first)", C.red], ["error: failed to push some refs to 'github.com:adam/kibo.git'", C.mfg]]);
  panel.insertChild(panel.children.findIndex(c => c.name === "PushRow"), out); S.fillX(out);
  const t = pr.children.find(c => c.name === "Button / outline"); const tt = penpotUtils.findShape(s => s.type === "text", t); S.setText(tt, "Réessayer");
  return f.id; };

S.draw[42] = async () => {
  const f = await S.fromBase("base · 21", "42 · PR existante", 6);
  T(f, /kib-12/g, "kib-7"); 
  const cf = find(f, "ChangedFiles"); [...cf.children].filter(c => /^File-/.test(c.name)).forEach((c, i) => { if (i > 1) c.remove(); });
  const files = cf.children.filter(c => /^File-/.test(c.name));
  const ren = (fb, name, path, add, del) => { const ts = penpotUtils.findShapes(s => s.type === "text", fb); S.setText(ts.find(t => /\.ts$/.test(t.characters) && !/\//.test(t.characters)) || ts[1], name);
    const p = ts.find(t => /packages/.test(t.characters)); if (p) S.setText(p, path); const nums = ts.filter(t => /^[+-]\d+$/.test(t.characters)); if (nums[0]) S.setText(nums[0], add); if (nums[1]) S.setText(nums[1], del); };
  ren(files[0], "theme.css", "packages/ui/src/", "+64", "-12"); ren(files[1], "button.tsx", "packages/ui/src/components/ui/", "+8", "-2");
  const secs = cf.children.filter(c => c.name === "sec"); if (secs[1]) { const st = secs[1].children.filter(c => c.type === "text"); S.setText(st[1], "0"); }
  const code = find(f, "code"); clear(code); hunk(code, "@@ -1,6 +1,14 @@ :root");
  [["1", "1", " ", ":root {"], ["2", " ", "-", "  --background: #ffffff;"], [" ", "2", "+", "  --background: 0 0% 100%;"], [" ", "3", "+", "  --muted-foreground: 240 3.8% 46.1%;"], [" ", "4", "+", "  --brand: 21 90% 40%;"], ["3", "5", " ", "}"]]
    .forEach(([a, b, s, t]) => { const l = sLine(code, b !== " " ? b : a, s, t); });
  S.replaceText(f, "packages/core/ticket.ts", "packages/ui/src/theme.css");
  const fl = find(f, "FileLink"); if (fl) { const t = penpotUtils.findShape(s => s.type === "text", fl); if (t) S.setText(t, "packages/ui/src/theme.css"); }
  // panneau : commits poussés, PR ouverte
  const panel = find(f, "CommitPanel");
  ["Commit-a1f3c2e", "Commit-9bd02e1"].forEach(n => find(f, n).remove());
  const sh = find(f, "sh"); const sht = sh.children.filter(c => c.type === "text"); S.setText(sht[0], "Commits poussés"); S.setText(sht[1], "0");
  const c47 = find(f, "Commit-47ce0aa"); const c47t = penpotUtils.findShapes(s => s.type === "text", c47); S.setText(c47t[0], "5c21d0b"); S.setText(c47t[1], "feat(ui): tokens shadcn + thème sombre (KIB-7)");
  const prc = S.panel(null, { name: "PRCard", gap: 8, pad: 12, fill: C.muted });
  panel.insertChild(panel.children.findIndex(c => c.name === "spacer"), prc); S.fillX(prc);
  const h = S.row(prc, { gap: 8 }); S.icon(h, "pr", 16, C.green); S.txt(h, "PR #12 ouverte", { size: 13, weight: 600 }); S.spacer(h); S.badge(h, "Review en cours", C.blue, { dot: C.blue, round: true });
  S.sub(prc, "Tokens shadcn + thème sombre · kib-7 → main · rattachée à KIB-7");
  const ci = S.row(prc, { gap: 6 }); S.dot(ci, C.green, 7); S.txt(ci, "CI : 3 vérifications réussies", { size: 12, color: C.mfg });
  const rv = S.row(prc, { gap: 6 }); S.icon(rv, "bot", 13, C.mfg); S.txt(rv, "sonnet-review relit la PR (1 min)", { size: 12, color: C.mfg });
  const pr = find(f, "PushRow"); clear(pr); const b1 = S.button(pr, "Pousser", "outline", { icon: "push", disabled: true }); const b2 = S.button(pr, "Voir la PR #12", "default", { icon: "external" }); S.fillX(b2);
  const help = S.txt(null, "Rien à pousser : la branche est à jour avec origin/kib-7.", { size: 11, color: C.dim }); panel.appendChild(help); S.fillX(help);
  // bouton commit : rien d'indexé
  const cb = find(f, "CommitButton"); cb.opacity = 0.45; S.setText(cb.children.filter(c => c.type === "text")[0], "Rien à commiter");
  const inp = penpotUtils.findShape(s => s.name === "Input", find(f, "Field-Message")); S.setText(inp.children.find(c => c.type === "text"), " ");
  const aw = find(f, "AgentWarning"); const ai = panel.children.findIndex(c => c.name === "AgentWarning"); aw.remove();
  const info = S.alert(null, "sonnet-review relit la PR #12 (lecture seule)", "muted", { icon: "bot" }); panel.insertChild(ai, info); S.fillX(info);
  return f.id; };
return "code ok";
