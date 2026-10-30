const S = storage;
S.draw = S.draw || {};

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

Object.assign(S.ICONS, {
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  shrink: '<path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8"/><path d="M9 19.8V15m0 0H4.2M9 15l-6 6"/><path d="M15 4.2V9m0 0h4.8M15 9l6-6"/><path d="M9 4.2V9m0 0H4.2M9 9 3 3"/>',
  expand: '<path d="m15 15 6 6"/><path d="m15 9 6-6"/><path d="M21 16v5h-5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="m3 21 6-6"/><path d="M3 8V3h5"/><path d="M9 9 3 3"/>',
  circleDot: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
});
S.legendButton34 = (p) => { const k = S.box(p, { name: "legend-toggle", w: 20, h: 20, radius: 5, dir: "row", align: "center", justify: "center" }); S.icon(k, "info", 13, S.C.dim); return k; };
S.modeOf = (b) => (/\(clair\)$/.test(b.name) ? "light" : "dark");
S.find34 = (scope, pred) => penpotUtils.findShapes(pred, scope)[0];
S.texts34 = (scope) => penpotUtils.findShapes(s => s.type === "text", scope).map(t => t.characters);

S.stepChip = (p, n) => S.chip(p, `Étape ${n}/12`, { mono: true, size: 11, weight: 400, color: S.C.mfg, stroke: S.C.border, pad: [2, 6] });
S.prChip = (p, ref) => S.chip(p, ref, { icon: "pr", isz: 11, ic: S.C.mfg, size: 11, weight: 500, color: S.C.mfg, stroke: S.C.border, pad: [2, 6] });
S.signalChip = (p, sig) => { const C = S.C;
  if (sig.kind === "hold") return S.showLast(p, S.holdBadge(sig.text));
  if (sig.kind === "blocked") return S.chip(p, sig.text, { icon: "lock", isz: 11, ic: C.red, color: C.red, fill: C.redSoft, stroke: null, pad: [2, 6] });
  if (sig.kind === "changes") return S.chip(p, "changements demandés", { icon: "pr", isz: 11, ic: C.amber, color: C.amber, fill: C.amberSoft, stroke: null, pad: [2, 6] });
  return S.chip(p, sig.text, { icon: "hourglass", isz: 11, ic: C.mfg, color: C.mfg, stroke: C.border, pad: [2, 6] }); };
S.T3_RUNNING = "T3 · en cours depuis 12 min"; S.T3_WAITING = "T3 · attend ta réponse";
S.t3Chip = (p, waiting) => { const C = S.C, col = waiting ? C.amber : C.brandText;
  const r = S.row(p, { name: "t3-chip", pad: [2, 7], gap: 5, radius: 10, fill: waiting ? C.amberSoft : C.brandSoft });
  S.dot(r, waiting ? C.amber : C.brand, 6); S.txt(r, waiting ? S.T3_WAITING : S.T3_RUNNING, { size: 11, weight: 500, color: col }); return r; };
S.p34Card = (card, colName, o = {}) => { const bad = card.children.find(c => c.name === "badges"); if (!bad) return null;
  let pr = null, step = null; const sigs = [];
  for (const b of [...bad.children].reverse()) { const t = S.find34(b, s => s.type === "text"); const x = t ? t.characters : "";
    if (b.name.replace(/\s/g, "") === "badgehold") sigs.push({ kind: "hold", rank: 2, text: x });
    else if (/^bloqué/.test(x)) sigs.push({ kind: "blocked", rank: 0, text: x });
    else if (x === "changements demandés") sigs.push({ kind: "changes", rank: 1 });
    else if (/^attend /.test(x)) sigs.push({ kind: "wait", rank: 3, text: x });
    else if (/^#\d+$/.test(x)) pr = x;
    else { const m = x.match(/^Phase (\d+)\/12/); if (m) step = +m[1]; } }
  for (const c of [...bad.children]) c.remove();
  sigs.sort((a, b) => a.rank - b.rank);
  if (sigs[0]) S.signalChip(bad, sigs[0]);
  if (o.t3) S.t3Chip(bad, o.t3 === "waiting");
  if (pr && (colName === "En review" || colName === "En cours")) { S.prChip(bad, pr); if (step != null) S.stepChip(bad, step); }
  if (!bad.children.length) bad.remove();
  return { sig: sigs[0] ? sigs[0].kind : null, pr, step }; };
S.p34Cards = (b, t3 = {}) => { S.setMode(S.modeOf(b)); const out = {};
  for (const col of penpotUtils.findShapes(s => /^column /.test(s.name), b)) { const colName = col.name.replace(/^column /, "");
    for (const card of col.children.filter(c => /^card /.test(c.name))) out[card.name] = S.p34Card(card, colName, { t3: t3[card.name.replace(/^card /, "")] }); }
  return out; };
S.p34Collapse = (b) => { const C = S.C, row = S.find34(b, s => s.name === "columns-row"); if (!row) return null;
  const cols = row.children.filter(c => /^column /.test(c.name)); const gap = row.flex.columnGap, W = row.width;
  const empty = cols.filter(c => !c.children.some(k => /^card /.test(k.name)));
  if (!empty.length) return 0;
  const full = cols.length - empty.length, cw = Math.floor((W - 40 * empty.length - gap * (cols.length - 1)) / full);
  for (const col of cols) { if (empty.includes(col)) continue; col.resize(cw, col.height); }
  for (const col of empty) { const head = col.children.find(c => c.name === "box"), name = col.name.replace(/^column /, "");
    const ring = S.find34(head, s => s.name === "ring" || s.name === "dot"); const ringColor = ring && (ring.strokes[0] || {}).strokeColor;
    head.remove(); col.resize(40, col.height); col.name = "column " + name + " · repliée";
    const fl = col.flex; fl.alignItems = "center"; fl.topPadding = 12; fl.rightPadding = 0; fl.leftPadding = 0; fl.rowGap = 10;
    if (ring) S.ring(col, ringColor || C.dim, 8); else S.dot(col, C.dim, 8);
    const label = S.txt(col, name, { size: 12.5, weight: 600, color: C.fg }); label.rotation = 90;
    const n = S.txt(col, "0 ticket", { size: 11, mono: true, color: C.dim }); n.rotation = 90; }
  return { cw, empty: empty.length }; };
S.p34KanbanCounter = (b) => { const t = S.find34(b, s => s.type === "text" && / tickets · Tous$/.test(s.characters)); if (t) { t.characters = t.characters.replace(" · Tous", ""); S.refont(t); } return !!t; };

S.p34Kanban = async (b, t3 = {}) => { S.setMode(S.modeOf(b)); const row = S.find34(b, s => s.name === "columns-row");
  const cols = row ? row.children.filter(c => /^column /.test(c.name)) : [];
  const shadows = penpotUtils.findShapes(s => s.name === "scroll-shadow", b).map(s => [s, cols.find(c => Math.abs(c.x - s.x) < 1)]);
  const cards = S.p34Cards(b, t3), counter = S.p34KanbanCounter(b), collapsed = S.p34Collapse(b);
  await S.wait(800); for (const [s, col] of shadows) if (col) { s.x = col.x; s.resize(col.width, s.height); }
  return { cards: Object.keys(cards).length, counter, collapsed }; };
S.sheetBar = (b) => { const sheet = S.find34(b, s => s.name === "sheet"); return sheet && sheet.children.find(c => c.name === "box" && c.flex && c.flex.dir === "row"); };
S.launchButton = (bar, ref) => { const C = S.C;
  const btn = S.btn(null, "Lancer dans T3", "default", { sm: true, icon: "play" }); btn.name = "launch-t3";
  S.showBefore(bar, ref, btn); return btn; };
S.p34FicheBar = (b) => { const bar = S.sheetBar(b); if (!bar) return null;
  const copy = bar.children.find(c => c.name.replace(/\s/g, "") === "Button/outline" && S.texts34(c).some(t => /^Copier \/full-delivery/.test(t)));
  if (!copy) return "no copy"; S.launchButton(bar, copy); copy.remove(); return "launch"; };
S.p34Suivi = (b, o = {}) => { const C = S.C, sheet = S.find34(b, s => s.name === "sheet"); if (!sheet) return null; const out = [];
  const hl = S.find34(sheet, s => s.name === "header-line");
  if (hl) { const kids = [...hl.children]; const i = kids.findIndex(c => c.type === "text" && /^PR #/.test(c.characters));
    if (i >= 0) { for (const c of kids.slice(i, i + 3)) c.remove(); out.push("header-line"); } }
  const banner = S.find34(sheet, s => s.name === "tracking-banner"); if (banner) { banner.remove(); out.push("banner"); }
  const sw = S.find34(sheet, s => s.name === "switch"); let feat = "F4";
  const fchip = S.find34(sheet, s => s.name === "fchip"); if (fchip) feat = S.texts34(fchip)[0];
  if (sw) { const holder = S.parentOf(sheet, sw); holder.remove(); out.push("toggle"); }
  const suivi = S.find34(sheet, s => s.name.replace(/\s/g, "") === "section/Suivi");
  if (suivi) {
    const rowOf = (label) => suivi.children.find(r => r.children && r.children.some(c => c.name === "box" && S.texts34(c)[0] === label));
    const pr = rowOf("PR"); if (pr) { const v = pr.children.find(c => c.name === "box" && c.width > 200);
      if (v && !S.texts34(v).includes("GitHub")) { S.spacer(v); S.txt(v, "GitHub", { size: 12.5, color: C.mfg }); S.icon(v, "externalLink", 12, C.mfg); out.push("github"); } }
    const ci = rowOf("CI"); if (ci) { const t = S.find34(ci, z => z.type === "text" && z.characters === "CI cassée"); if (t) { t.characters = "rouge"; S.refont(t); out.push("ci"); } }
    for (const t of penpotUtils.findShapes(z => z.type === "text" && /^Phase \d+\/12/.test(z.characters), suivi)) { t.characters = t.characters.replace(/^Phase/, "Étape"); S.refont(t); out.push("étape"); }
    const liv = rowOf("Livraison");
    if (liv && !rowOf("Requise")) { const r = S.row(null, { name: "box", fx: true, h: 30, gap: 10 });
      const l = S.row(r, { w: 96 }); S.txt(l, "Requise", { size: 12.5, color: C.mfg });
      const v = S.row(r, { gap: 8, fx: true }); const k = S.row(v, { name: "switch", w: 32, h: 18, radius: 9, fill: o.optional ? C.track : C.primary, pad: [0, 2], justify: o.optional ? "start" : "end" });
      S.dot(k, o.optional ? C.fg : C.bg, 14); S.txt(v, o.optional ? "facultative" : "requise pour livrer " + feat, { size: 12.5, color: C.fg });
      S.showAfter(suivi, liv, r); out.push("requise"); } }
  return out; };
S.p34Fiche = async (b) => { S.setMode(S.modeOf(b)); const k = await S.p34Kanban(b); const bar = S.p34FicheBar(b); const suivi = S.p34Suivi(b); return { k, bar, suivi }; };
S.t3Group = (bar, ref, waiting) => { const C = S.C, col = waiting ? C.amber : C.brandText;
  const g = S.row(null, { name: waiting ? "t3-waiting" : "t3-running", pad: [3, 3, 3, 10], gap: 8, radius: 7, stroke: waiting ? C.amber : C.brandLine, fill: waiting ? C.amberSoft : C.brandSoft });
  S.dot(g, waiting ? C.amber : C.brand, 7); S.txt(g, waiting ? S.T3_WAITING : S.T3_RUNNING, { size: 12, weight: 500, color: col });
  const o = S.btn(g, "Ouvrir dans T3", "outline", { sm: true, pad: [3, 8] }); o.fills = [{ fillColor: C.bg, fillOpacity: 1 }]; S.icon(o, "externalLink", 12, C.fg);
  S.showBefore(bar, ref, g); return g; };
S.p34FicheT3 = (b, waiting) => { const bar = S.sheetBar(b), btn = bar.children.find(c => c.name === "launch-t3"); S.t3Group(bar, btn, waiting); btn.remove(); };
S.p34FicheCopied = (b) => { const C = S.C, bar = S.sheetBar(b), key = bar.children.find(c => c.type === "text" && c.name === "key");
  const ic = bar.children.find(c => c.name.replace(/\s/g, "") === "icon/ticket");
  const g = S.row(null, { name: "key-copied", pad: [3, 8], gap: 5, radius: 6, fill: C.greenSoft }); S.icon(g, "check", 13, C.green); S.txt(g, "Copiée", { size: 12.5, weight: 500, color: C.green });
  S.showBefore(bar, ic || key, g); if (ic) ic.remove(); key.remove(); return g; };

S.card34 = (b, prefix) => S.find34(b, s => s.name.replace(/\s/g, "").startsWith(("card/" + prefix).replace(/\s/g, "")));
S.p34Tile = (b) => { const C = S.C, kpis = S.find34(b, s => s.name === "kpis"); if (!kpis) return null;
  const label = S.find34(kpis, s => s.type === "text" && s.characters === "En cours"); if (!label) return null;
  const tile = S.parentOf(kpis, S.parentOf(kpis, label)), rows = [...tile.children].reverse();
  const big = rows[1], sub = rows[2], unit = big.children.find(c => c.type === "text" && /^\/ \d+/.test(c.characters));
  if (!unit) return "done"; const limit = +unit.characters.replace(/\D/g, ""), open = +S.find34(big, s => s.type === "text" && /^\d+$/.test(s.characters)).characters;
  unit.characters = "fonctionnalités ouvertes"; unit.fontSize = "12"; S.refont(unit); unit.growType = "auto-height"; unit.resize(tile.width - 36 - 24, unit.height);
  big.flex.verticalSizing = "auto"; big.flex.alignItems = "center";
  for (const c of [...sub.children]) c.remove(); const reached = open >= limit;
  S.dot(sub, reached ? C.amber : C.dim, 7); S.txt(sub, "limite " + limit, { size: 12, color: reached ? C.amber : C.mfg });
  return { open, limit, reached }; };
S.p34Order = (b) => { const sp = S.card34(b, "Sprint"), left = S.parentOf(b, sp), row = S.parentOf(b, left), main = S.parentOf(b, row);
  const right = row.children.find(c => c.id !== left.id), kpis = main.children.find(c => c.name === "kpis");
  const q = S.card34(b, "Questions"), rev = S.card34(b, "En review"), next = S.card34(b, "Prochaine"), act = S.card34(b, "Activité"), held = S.card34(b, "En attente");
  const ech = S.card34(b, "Échéances"), live = main.children.find(c => c.name === "live"), late = S.card34(b, "En retard");
  if (held) { S.showFirst(left, held); held.layoutChild.horizontalSizing = "fill"; S.showAfter(left, held, sp); } else S.showFirst(left, sp);
  if (next) S.showAfter(left, sp, next);
  if (q) { S.showFirst(right, q); if (rev) S.showAfter(right, q, rev); }
  let ref = kpis; if (late) { S.showAfter(main, ref, late); ref = late; }
  S.showAfter(main, ref, row); ref = row;
  for (const c of [ech, live, act]) if (c) { S.showAfter(main, ref, c); ref = c; }
  if (act) act.layoutChild.horizontalSizing = "fill";
  return { held: !!held, late: !!late }; };
S.p34QuestionsHead = (b) => { const C = S.C, q = S.card34(b, "Questions"); if (!q) return null;
  const head = [...q.children].reverse()[0]; if (S.texts34(head).some(t => /bloquante/.test(t))) return "done";
  const n = penpotUtils.findShapes(s => s.type === "text" && s.characters === "bloquante", q).length; if (!n) return 0;
  S.spacer(head); S.dot(head, C.red, 6); S.txt(head, n + (n > 1 ? " bloquantes" : " bloquante"), { size: 12, weight: 500, color: C.red }); return n; };
S.p34Legend = (b) => { const ech = S.card34(b, "Échéances"); if (!ech) return null; const kids = [...ech.children].reverse();
  const leg = kids[kids.length - 1], line = kids[kids.length - 2];
  for (const c of ech.children.filter(c => c.name === "legend-bar" || c.name === "legend-line")) c.remove();
  let out = "none"; if (leg && S.texts34(leg).includes("étape livrée")) { leg.remove(); if (line && line.name === "line") line.remove(); out = "removed"; }
  S.hline(ech, S.C.soft).name = "legend-line"; const bar = S.row(ech, { name: "legend-bar", fx: true, h: 35, pad: [0, 14], fill: S.C.panel }); S.legendButton34(bar);
  return out + "+toggle"; };
S.p34Steps = (b) => { let n = 0;
  for (const t of penpotUtils.findShapes(s => s.type === "text" && (/^Phase \d+\/12/.test(s.characters) || /^\d+ · (Lecture|Mémoire|Repérage|Questions|Worktree|Conception|Code|Porte qualité|PR|Review|Démo|Livré)$/.test(s.characters)), b)) {
    t.characters = /^Phase/.test(t.characters) ? t.characters.replace(/^Phase/, "Étape") : t.characters.replace(/^(\d+) · /, "Étape $1/12 · "); S.refont(t); n++; }
  return n; };
S.livreeRow = (o = {}) => { o.total = o.total || "3 livrées sur 9"; const C = S.C;
  const r = S.row(null, { name: "card/Livrée aujourd'hui", fx: true, h: 44, pad: [0, 16], gap: 10, radius: 10, stroke: C.border, fill: C.card });
  S.icon(r, "circleCheck", 15, C.green); S.txt(r, "Livrée aujourd'hui", { size: 13, weight: 600, color: C.fg });
  S.txt(r, "F3", { size: 12, mono: true, color: C.mfg }); S.txt(r, "Réaffecter un box", { size: 13, weight: 500, color: C.fg });
  S.segs(r, [C.green, C.green, C.green, C.green], { w: 22, h: 6, gap: 3, radius: 2 });
  S.txt(r, "4/4 étapes · dernière fusion #18 à 14:36", { size: 12.5, color: C.mfg }); S.spacer(r);
  S.txt(r, o.total, { size: 12.5, color: C.mfg }); return r; };
S.p34Livree = (b) => { if (S.card34(b, "Livrée aujourd'hui")) return "done"; const kpis = S.find34(b, s => s.name === "kpis"), main = S.parentOf(b, kpis);
  const done = S.find34(kpis, z => z.type === "text" && /^livrées sur \d+$/.test(z.characters)), n = done && S.find34(S.parentOf(kpis, done), z => z.type === "text" && /^\d+$/.test(z.characters));
  const r = S.showAfter(main, kpis, S.livreeRow({ total: n ? `${n.characters} ${done.characters}` : null })); r.layoutChild.horizontalSizing = "fill"; return "added"; };
S.p34Fit = async (b) => { await S.wait(800); const main = S.find34(b, s => s.name === "kpis"), body = S.parentOf(b, main);
  const last = [...body.children].reverse().pop(); const need = Math.ceil(Math.max(...body.children.map(c => c.y + c.height)) - b.y + body.flex.bottomPadding);
  const h = need <= 1440 ? 1440 : Math.ceil(need / 40) * 40; if (h !== b.height) S.resizeScreen(b, h); return h; };
S.p34Vue = async (b, o = {}) => { S.setMode(S.modeOf(b)); const out = {};
  out.tile = S.p34Tile(b); out.legend = S.p34Legend(b); out.steps = S.p34Steps(b); out.q = S.p34QuestionsHead(b);
  out.order = S.p34Order(b); if (o.livree) out.livree = S.p34Livree(b); out.h = await S.p34Fit(b); return out; };
S.settle34 = async (read, step = 400, max = 12) => { let v = read(); for (let i = 0; i < max; i++) { await S.wait(step); const w = read(); if (Math.abs(w - v) < 0.5) return w; v = w; } return v; };
S.P34_CURRENT = "S42"; S.P34_NEXT = "S43";
S.p34Alerts = (col) => { const boxes = col.children.filter(c => c.name === "box" && S.find34(c, z => z.name.replace(/\s/g, "") === "icon/clockAlert"));
  if (boxes.length < 2) return boxes.length; const shown = [...boxes].sort((a, b) => a.y - b.y);
  const phrase = (t) => t.replace(/ : (\d+ étapes? restantes?)$/, " ($1)");
  const text = shown.map(bx => phrase(S.find34(bx, z => z.type === "text").characters)).join(" · ");
  const keep = S.find34(shown[0], z => z.type === "text"); keep.characters = text; S.refont(keep);
  for (const bx of shown.slice(1)) bx.remove(); return shown.length; };
S.p34Capacity = (col) => { const C = S.C, code = col.name.replace(/^col /, ""), load = S.find34(col, z => z.type === "text" && z.name === "load"); if (!load) return null;
  const m = load.characters.match(/^(\d+) étapes? prévues? · capacité (\d+)/); if (!m) return null;
  const amber = (code === S.P34_CURRENT || code === S.P34_NEXT) && +m[1] > +m[2];
  load.fills = [{ fillColor: amber ? C.amber : C.dim, fillOpacity: 1 }]; return amber; };
S.p34PlanLegend = (b) => { const sprints = S.find34(b, z => z.name === "sprints"), body = S.parentOf(b, sprints);
  const leg = body.children.find(c => c.name === "box" && S.texts34(c).includes("étape livrée")); if (leg) leg.remove();
  for (const c of body.children.filter(c => c.name === "legend-bar")) c.remove();
  sprints.layoutChild.verticalSizing = "fill"; const bar = S.row(body, { name: "legend-bar", fx: true, h: 20 }); S.legendButton34(bar); return !!leg; };
S.heldBand = (o = {}) => { const C = S.C, groups = S.heldGroups(), n = S.HOLDS.length;
  const band = S.col(null, { name: "held band", fx: true, pad: [10, 14], gap: 8, radius: 10, stroke: C.border, fill: C.panel });
  const h = S.row(band, { fx: true, gap: 8 }); S.icon(h, "pause", 14, C.hold); S.txt(h, "En attente", { size: 13, weight: 600 });
  S.chip(h, String(n), { size: 10.5, mono: true, color: C.mfg, stroke: null, fill: C.muted, pad: [0, 5] });
  S.txt(h, "étapes mises de côté, hors sprint", { size: 12, color: C.dim }); S.spacer(h);
  const fold = S.row(h, { name: "fold", gap: 4 }); S.txt(fold, o.collapsed ? "Déplier" : "Replier", { size: 12, color: C.mfg }); S.icon(fold, o.collapsed ? "chevDown" : "chevUp", 13, C.mfg);
  if (o.collapsed) return band;
  for (const g of groups) { const r = S.row(band, { name: "held reason", fx: true, gap: 8 });
    S.txt(r, g.reason, { size: 12.5, color: C.mfg });
    g.steps.forEach((st, i) => { const c = S.row(r, { name: "held " + st.key, pad: [3, 8], gap: 6, radius: 6, stroke: C.border, fill: C.card });
      S.txt(c, st.key, { size: 11.5, mono: true, color: C.mfg }); S.txt(c, "·", { size: 11.5, color: C.faint });
      S.txt(c, st.f, { size: 11.5, mono: true, color: C.mfg }); S.txt(c, st.title, { size: 12.5, weight: 500, color: C.fg }); });
    if (g.dependents) { const d = S.row(r, { name: "dependents", gap: 4 }); S.icon(d, "link", 12, C.dim); S.txt(d, `${g.dependents} en dépendent`, { size: 12, color: C.dim }); S.icon(d, "chevRight", 12, C.dim); } }
  return band; };
S.p34Planning = async (b, o = {}) => { S.setMode(S.modeOf(b)); const out = { alerts: [], cap: {} };
  for (const col of penpotUtils.findShapes(z => /^col S\d+$/.test(z.name), b)) { out.alerts.push(S.p34Alerts(col)); out.cap[col.name] = S.p34Capacity(col); }
  out.legend = S.p34PlanLegend(b);
  const held = S.find34(b, z => z.name === "held"); out.held = !!held; const dz = S.find34(b, z => z.name === "dropzone");
  const floats = dz ? b.children.filter(c => c.name !== "root").map(c => [c, c.y - dz.y]) : [];
  if (held) { const sprints = S.find34(b, z => z.name === "sprints"), body = S.parentOf(b, sprints); held.remove();
    const band = S.showBefore(body, sprints, S.heldBand(o)); band.layoutChild.horizontalSizing = "fill"; }
  await S.settle34(() => dz ? dz.y : 0); for (const [c, off] of floats) c.y = dz.y + off;
  out.floats = floats.length; return out; };

S.EDGES_P34 = [["F1", "F3"], ["F2", "F3"], ["F2", "F4"], ["F3", "F5"], ["F2", "F6"], ["F4", "F8"], ["F4", "F7"], ["F5", "F7"], ["F7", "F9"]];
S.frames34 = (b) => penpotUtils.findShapes(z => /^frame F\d+$/.test(z.name), b);
S.stepRows34 = (fr) => fr.children.filter(c => c.name === "box" && c.height >= 20 && c.strokes && c.strokes.length);
S.p34Frame = (fr) => { const C = S.C, k = fr.strokes[0], col = String(k.strokeColor).toUpperCase();
  const keep = [S.PAL.dark.red, S.PAL.light.red, S.PAL.dark.hold, S.PAL.light.hold].map(x => x.toUpperCase()).includes(col);
  fr.strokes = [{ strokeColor: keep ? k.strokeColor : C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, strokeStyle: "solid" }];
  for (const r of S.stepRows34(fr)) { r.flex.topPadding = 7; r.flex.bottomPadding = 7; r.resize(r.width, 28);
    const kids = [...r.children].reverse(), st = kids[0]; if (st && st.type === "ellipse" && st.width < 9) st.resize(10, 10);
    for (const ic of r.children.filter(c => c.type === "group" && /^icon/.test(c.name.replace(/\s/g, "")))) ic.resize(15, 15); }
  return keep; };
S.restack34 = (b, gap = 30) => { const cv = S.find34(b, z => z.name === "canvas"), lanes = {};
  for (const fr of S.frames34(cv)) (lanes[Math.round(fr.x)] = lanes[Math.round(fr.x)] || []).push(fr);
  for (const list of Object.values(lanes)) { list.sort((a, c) => a.y - c.y); for (let i = 1; i < list.length; i++) list[i].y = list[i - 1].y + list[i - 1].height + gap; }
  return Object.keys(lanes).length; };
S.startableRow34 = (b) => { const f4 = S.find34(b, z => z.name === "frame F4"); const t = f4 && S.find34(f4, z => z.type === "text" && z.characters === "Démo client"); return t ? S.parentOf(f4, t) : null; };
S.startable34 = (b) => { const r = S.startableRow34(b); if (!r) return null; r.strokes = [{ strokeColor: S.C.green, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, strokeStyle: "solid" }]; return r; };
S.graphHover34 = (b) => { const r = S.startableRow34(b); if (!r) return null; const ic = r.children.find(c => c.type === "group" && /^icon/.test(c.name.replace(/\s/g, "")));
  const btn = S.btn(null, "Lancer dans T3", "default", { sm: true, icon: "play", pad: [2, 8], size: 11.5 }); btn.name = "launch-t3"; if (ic) { S.showBefore(r, ic, btn); ic.remove(); } else S.showLast(r, btn);
  r.flex.topPadding = 2; r.flex.bottomPadding = 2; return btn; };
S.noEdges34 = (b) => { const cv = S.find34(b, z => z.name === "canvas"); let n = 0; for (const e of cv.children.filter(c => c.name === "edges")) { e.remove(); n++; } return n; };
S.graphLegend34 = (b) => { const cv = S.find34(b, z => z.name === "canvas"); for (const c of cv.children.filter(c => c.name === "legend" || c.name === "legend-bar")) c.remove();
  const bar = S.row(cv, { name: "legend-bar", x: 16, y: Math.round(cv.height) - 18 - 30, w: 32, h: 30, pad: [0, 6], radius: 8, fill: S.C.card, stroke: S.C.border }); S.legendButton34(bar); bar.bringToFront(); return true; };
S.edges34 = (b, anchor) => { const cv = S.find34(b, z => z.name === "canvas"), old = S.find34(cv, z => z.name === "edges"); const first = old && penpotUtils.findShapes(z => z.type === "path", old)[0];
  const col = first ? first.strokes[0].strokeColor : S.C.mfg, pairs = /en attente/.test(b.name) ? S.EDGES_GA : S.EDGES_P34;
  const box = (k) => { const n = S.find34(cv, z => z.name === "frame " + k); return { x: Math.round(n.x - cv.x), y: Math.round(n.y - cv.y), w: Math.round(n.width), h: Math.round(n.height) }; };
  const head = (x, y) => `<path d="M${x - 7},${y - 4} L${x},${y} L${x - 7},${y + 4}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const at = (P) => P.y + (anchor || Math.min(38, Math.round(P.h / 2))); let d = "";
  for (const [a, c] of pairs) { const P = box(a), Q = box(c), y1 = at(P), y2 = at(Q), x2 = Q.x - 1;
    if (Math.abs(P.x - Q.x) < 20) { const cx = P.x - 16; d += `<path d="M${P.x},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(x2, y2); continue; }
    const x1 = P.x + P.w, mx = Math.round((x1 + x2) / 2); d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/>` + head(x2, y2); }
  if (old) old.remove();
  const sv = S.svg(cv, `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.width}" height="${cv.height}" viewBox="0 0 ${cv.width} ${cv.height}" fill="none">${d}</svg>`, "edges", { x: 0, y: 0 });
  const idx = cv.children.findIndex(c => c.name && c.name.startsWith("frame ")); if (idx >= 0) cv.insertChild(idx, sv); return pairs.length; };
S.graphToolbar34 = (b, collapsed) => { const main = S.find34(b, z => z.name === "main"), bar = main && main.children.find(c => c.name === "box" && S.texts34(c).some(t => /fonctionnalités · /.test(t)));
  if (!bar) return null; for (const o of bar.children.filter(c => c.name === "toggle-all")) o.remove();
  const btn = S.btn(bar, collapsed ? "Déplier tout" : "Tout voir", "outline", { sm: true, icon: collapsed ? "expand" : "shrink" }); btn.name = "toggle-all"; return true; };
S.p34Graph = async (b) => { S.setMode(S.modeOf(b)); const out = { frames: 0 };
  for (const fr of S.frames34(b)) { S.p34Frame(fr); out.frames++; }
  out.toolbar = S.graphToolbar34(b, false); await S.wait(800); out.lanes = S.restack34(b); await S.wait(300); out.edges = S.noEdges34(b); out.legend = S.graphLegend34(b); out.startable = !!S.startable34(b); return out; };
S.collapse34 = (fr) => { const C = S.C, kids = [...fr.children].reverse(), head = kids[0], title = kids.find(c => c.type === "text"), segs = kids.find(c => c.name === "segs");
  const key = S.find34(head, z => z.type === "text" && /^F\d+$/.test(z.characters)).characters;
  for (const c of kids) if (c !== title && c !== segs) c.remove();
  const row = S.showFirst(fr, S.row(null, { name: "collapsed head", gap: 6 })); row.layoutChild.horizontalSizing = "fill";
  S.txt(row, key, { size: 11, mono: true, color: C.dim }); const max = Math.floor((fr.width - 20 - 24) / 6.9);
  const late = String(fr.strokes[0] && fr.strokes[0].strokeColor).toUpperCase() === String(C.red).toUpperCase(), room = late ? max - 3 : max;
  const full = title.characters; title.remove(); S.txt(row, full.length > room ? full.slice(0, room - 1).trimEnd() + "…" : full, { size: 12.5, weight: 600, color: C.fg });
  if (late) { S.spacer(row); S.icon(row, "clockAlert", 12, C.red); }
  fr.flex.topPadding = 13; fr.flex.bottomPadding = 13; fr.flex.rowGap = 8; fr.flex.verticalSizing = "fix"; fr.resize(fr.width, 56); return key; };
S.p34GraphAll = async (b, open = []) => { S.setMode(S.modeOf(b)); const out = [];
  for (const fr of S.frames34(b)) { const k = fr.name.replace(/^frame /, ""); if (open.includes(k)) continue; S.collapse34(fr); out.push(k); }
  S.graphToolbar34(b, true); await S.wait(800); S.restack34(b); await S.wait(300); S.noEdges34(b); return out; };
S.t3Pill34 = (row) => { const C = S.C, ic = row.children.find(c => c.type === "group" && /^icon/.test(c.name.replace(/\s/g, "")));
  const p = S.row(null, { name: "t3-pill", pad: [1, 6], gap: 4, radius: 9, fill: C.brandSoft }); S.dot(p, C.brand, 6); S.txt(p, "T3", { size: 11, weight: 600, color: C.brandText });
  if (ic) { S.showBefore(row, ic, p); ic.remove(); } else S.showLast(row, p);
  row.strokes = [{ strokeColor: C.brandLine, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1, strokeStyle: "solid" }]; return p; };

S.Q34 = [
  { id: "Q14", text: "Un box réaffecté garde-t-il ses photos ?", to: "Client", blocking: true, ticket: "SILO-51", age: "3 j", asked: "il y a 3 j" },
  { id: "Q16", text: "Quota par client : 2 Go ou 5 Go ?", to: "Produit", ticket: "SILO-34", age: "1 j", asked: "hier" },
  { id: "Q17", text: "Un rapport par chef de centre ou par client ?", to: "Client", ticket: "SILO-81", age: "2 h", asked: "il y a 2 h" } ];
S.QCOLS34 = { id: 56, to: 120, flag: 110, ticket: 90, age: 52, chev: 20 };
S.qHead34 = (t) => { const C = S.C, W = S.QCOLS34, r = S.row(t, { name: "head", fx: true, h: 32, pad: [0, 16], gap: 12, fill: C.panel });
  const cell = (label, w) => { const c = S.row(r, w ? { w } : { fx: true }); if (!w) c.layoutChild.horizontalSizing = "fill"; if (label) S.txt(c, label, { size: 11.5, weight: 500, color: C.dim }); return c; };
  cell("N°", W.id); cell("Question"); cell("Pour", W.to); cell("", W.flag); cell("Ticket", W.ticket); cell("Âge", W.age); cell("", W.chev); return r; };
S.qRow34 = (t, q, o = {}) => { const C = S.C, W = S.QCOLS34, r = S.row(t, { name: "question " + q.id, fx: true, h: 40, pad: [0, 16], gap: 12, fill: o.open ? C.muted : null });
  const cell = (w) => { const c = S.row(r, w ? { w, gap: 5 } : { gap: 5 }); if (!w) c.layoutChild.horizontalSizing = "fill"; return c; };
  S.txt(cell(W.id), q.id, { size: 12, mono: true, color: C.mfg });
  const qc = cell(); S.txt(qc, q.text, { size: 13, weight: o.open ? 600 : 400, color: C.fg });
  const to = cell(W.to); S.chip(to, q.to, { icon: "user", isz: 11, ic: C.mfg, size: 11.5, weight: 400, color: C.mfg, stroke: C.border, pad: [2, 6] });
  const fl = cell(W.flag); if (o.state) S.txt(fl, o.state, { size: 12, color: C.mfg }); else if (q.blocking) S.chip(fl, "bloquante", { icon: "lock", isz: 11, ic: C.red, color: C.red, fill: C.redSoft, stroke: null, pad: [2, 6] });
  S.txt(cell(W.ticket), q.ticket, { size: 12, mono: true, color: C.mfg });
  S.txt(cell(W.age), q.age, { size: 12, color: C.dim });
  S.icon(cell(W.chev), o.open ? "chevUp" : "chevDown", 14, C.dim); return r; };
S.qOpen34 = (t, q, o = {}) => { const C = S.C, d = S.col(t, { name: "detail " + q.id, fx: true, pad: [4, 16, 14, 84], gap: 10, fill: C.muted });
  S.txt(d, q.text, { size: 13, color: C.fg, fill: true });
  const m = S.row(d, { fx: true, gap: 10 }); const pour = S.row(m, { pad: [3, 8], gap: 5, radius: 6, stroke: C.border, fill: C.bg });
  S.icon(pour, "user", 12, C.mfg); S.txt(pour, "Pour : " + q.to, { size: 12, color: C.fg }); S.icon(pour, "chevDown", 12, C.dim);
  S.txt(m, "posée par Adam · " + q.asked, { size: 12, color: C.dim }); S.txt(m, "·", { size: 12, color: C.faint });
  const h = S.row(m, { gap: 4 }); S.icon(h, "history", 12, C.dim); S.txt(h, "Historique", { size: 12, color: C.dim });
  S.spacer(m); const more = S.box(m, { name: "more", w: 26, h: 26, radius: 6, fill: o.menu ? C.hover : null, dir: "row", align: "center", justify: "center" }); S.icon(more, "more", 15, C.mfg);
  const a = S.row(d, { fx: true, gap: 8 }); const inp = S.row(a, { h: 34, pad: [0, 12], radius: 6, stroke: C.border, fill: C.bg }); inp.layoutChild.horizontalSizing = "fill";
  S.txt(inp, "Votre réponse…", { size: 13, color: C.dim }); S.btn(a, "Coller la réponse", "outline", { sm: true, icon: "copy" }); S.btn(a, "Répondre", "default", { sm: true });
  return d; };
S.qTable34 = (list, qs, o = {}) => { const C = S.C, t = S.col(list, { name: "questions table", fx: true, radius: 10, stroke: C.border, fill: C.card, clip: true });
  S.qHead34(t);
  qs.forEach((q) => { S.hline(t, C.soft); S.qRow34(t, q, { open: o.open === q.id, state: o.state }); if (o.open === q.id) S.qOpen34(t, q, o); });
  return t; };
S.p34Questions = async (b, o = {}) => { const C = S.C; S.setMode(S.modeOf(b)); const out = {};
  const tb = S.find34(b, z => z.name === "toolbar"), top = S.find34(b, z => z.name === "topbar"), list = S.find34(b, z => z.name === "list");
  const exp = tb.children.find(c => S.texts34(c).some(x => /^Exporter pour le client/.test(x))), add = tb.children.find(c => S.texts34(c).includes("Nouvelle question"));
  const agent = top.children.find(c => c.name === "agent-button");
  if (exp) S.showBefore(top, agent, exp); if (add) S.showBefore(top, agent, add);
  const filt = tb.children.filter(c => c.name === "box"); const seg = filt.find(c => S.texts34(c).includes("Ouvertes")), recip = filt.find(c => c !== seg);
  if (recip) recip.remove();
  if (seg && o.counts !== false) { const t = S.find34(seg, z => z.type === "text" && z.characters === "Ouvertes"), cell = S.parentOf(seg, t);
    if (!S.texts34(cell).some(x => /^\d+$/.test(x))) S.chip(cell, String(o.openCount ?? 3), { size: 10, color: C.mfg, stroke: null, fill: C.muted, pad: [0, 5], mono: true }); }
  const spacer = tb.children.find(c => c.name === "spacer");
  const menuBtn = (icon, label) => { const bt = S.btn(null, label, "outline", { sm: true, icon }); S.icon(bt, "chevDown", 12, C.dim); return bt; };
  S.showBefore(tb, spacer, menuBtn("user", "Pour : tous")); S.showBefore(tb, spacer, menuBtn("ticket", "Ticket : tous"));
  const right = S.row(tb, { gap: 6 }); S.icon(right, "lock", 12, C.red); S.txt(right, o.summary || "1 bloquante en tête · 3 ouvertes", { size: 12, color: C.mfg });
  for (const c of [...list.children]) c.remove();
  const qs = o.qs || [...S.Q34].sort((a, c) => (c.blocking ? 1 : 0) - (a.blocking ? 1 : 0) || +a.id.slice(1) - +c.id.slice(1));
  const table = S.qTable34(list, qs, o); table.layoutChild.horizontalSizing = "fill";
  await S.wait(800); const pv = b.children.find(c => c.name === "export-preview");
  if (pv && exp) { pv.x = Math.round(exp.x + exp.width - pv.width); pv.y = Math.round(top.y + top.height + 6); out.preview = true; }
  out.rows = qs.length; return out; };

S.TODAY34 = {
  sub: "vendredi 16 octobre · 4 projets · 31 tickets ouverts",
  blocked: { right: "1 ticket bloqué · 1 question bloquante · tous projets", rows: [{ key: "SILO-51", title: "Lecture du fichier Excel", reason: "question · bloque F6 · Q14", project: "SILO" }] },
  prs: [{ pr: "#20", title: "Conflits de saisie", state: "changements demandés", amber: true, key: "SILO-45", project: "SILO" },
    { pr: "#22", title: "Route d'envoi des photos", state: "à relire · CI verte", key: "SILO-32", project: "SILO" },
    { pr: "#23", title: "Passage à Expo SDK 54", state: "à relire · CI en cours", key: "SILO-61", project: "SILO" }],
  startable: { right: "aucune dépendance en attente", rows: [{ key: "SILO-46", title: "Démo client", feat: "F4 · Saisir un constat hors ligne", project: "SILO" },
    { key: "SILO-62", title: "Journal des erreurs avec Sentry", feat: "hors fonctionnalité", project: "SILO" }] },
  projects: [{ name: "Silo", key: "SILO", client: "client Silo SA", color: "#14B8A6", ratio: 3 / 9, progress: "3/9", open: 23, blocked: 1, risk: 1, sprint: "S42" },
    { name: "Kibo", key: "KIB", color: "#6366F1", ratio: 19 / 24, progress: "19/24", open: 5 },
    { name: "Atlas", key: "ATL", color: "#84CC16", ratio: 4 / 7, progress: "4/7", open: 3 },
    { name: "Nimbus", key: "NIM", color: "#EC4899", fresh: true }] };
S.section34 = (p, icon, title, n, right) => { const C = S.C, c = S.col(p, { name: "section " + title, fx: true, radius: 10, stroke: C.border, fill: C.card, clip: true });
  c.layoutChild.horizontalSizing = "fill";
  const h = S.row(c, { fx: true, h: 40, pad: [0, 16], gap: 8 }); S.icon(h, icon, 15, C.mfg); S.txt(h, title, { size: 13.5, weight: 600 });
  S.chip(h, String(n), { size: 10.5, mono: true, color: C.mfg, stroke: null, fill: C.muted, pad: [0, 5] }); S.spacer(h); if (right) S.txt(h, right, { size: 12, color: C.dim });
  return c; };
S.line34 = (c, o) => { const C = S.C; S.hline(c, C.soft); const r = S.row(c, { name: "line " + o.key, fx: true, h: 38, pad: [0, 16], gap: 10, fill: o.hover ? C.hover : null });
  S.dot(r, o.dot, 7); const k = S.row(r, { w: o.kw || 64 }); S.txt(k, o.key, { size: 12, mono: true, color: C.mfg }); S.txt(r, o.title, { size: 13, weight: 500, color: C.fg });
  S.spacer(r); for (const t of o.right || []) S.txt(r, t.text, { size: 12, mono: !!t.mono, color: t.color || C.mfg, weight: t.weight || 400 });
  if (o.after) o.after(r); return r; };
S.today34 = (f, o = {}) => { const C = S.C, D = S.TODAY34;
  const root = S.box(f, { name: "root", w: f.width, h: f.height, dir: "row", align: "stretch" });
  S.sidebar(root, "Aujourd'hui", { folded: true });
  const main = S.col(root, { name: "main", fx: true, fy: true });
  const t = S.row(main, { name: "topbar", fx: true, h: 48, pad: [0, 16, 0, 20], gap: 12 }); S.txt(t, "Aujourd'hui", { size: 13, weight: 500 }); S.hline(main, C.soft);
  const body = S.col(main, { name: "body", fx: true, fy: true, pad: [20, 24, 24, 24], gap: 14 });
  const hd = S.row(body, { fx: true, gap: 10, align: "start" }); const tt = S.col(hd, { gap: 4 }); S.txt(tt, "Aujourd'hui", { size: 22, weight: 600 }); S.txt(tt, D.sub, { size: 12.5, color: C.mfg });
  S.spacer(hd); S.btn(hd, "Nouveau projet", "outline", { sm: true, icon: "plus" });
  const sb = S.section34(body, "lock", "Ce qui bloque", D.blocked.rows.length, D.blocked.right);
  for (const r of D.blocked.rows) S.line34(sb, { key: r.key, title: r.title, dot: C.red, right: [{ text: r.reason }, { text: r.project, mono: true, color: C.dim }] });
  const sp = S.section34(body, "pr", "PR à relire", D.prs.length);
  for (const r of D.prs) S.line34(sp, { key: r.pr, kw: 40, title: r.title, dot: C.purple, right: [{ text: r.state, color: r.amber ? C.amber : C.mfg, weight: r.amber ? 500 : 400 }, { text: r.key, mono: true }, { text: r.project, mono: true, color: C.dim }] });
  const ss = S.section34(body, "play", "Démarrable", D.startable.rows.length, D.startable.right);
  D.startable.rows.forEach((r, i) => S.line34(ss, { key: r.key, title: r.title, dot: C.green, hover: o.hover && i === 0, right: [{ text: r.feat }, { text: r.project, mono: true, color: C.dim }],
    after: (row) => { const b = S.btn(row, "Lancer dans T3", "outline", { sm: true, icon: "play", pad: [3, 8] }); b.name = "launch-t3"; S.icon(row, "more", 14, C.dim); } }));
  S.txt(body, "Projets", { size: 12, weight: 500, color: C.dim, upper: true, ls: 0.4 });
  const pc = S.col(body, { name: "projects", fx: true, radius: 10, stroke: C.border, fill: C.card, clip: true }); pc.layoutChild.horizontalSizing = "fill";
  D.projects.forEach((p, i) => { if (i) S.hline(pc, C.soft); const r = S.row(pc, { name: "project " + p.name, fx: true, h: 52, pad: [0, 16], gap: 12 });
    const a = S.box(r, { w: 26, h: 26, radius: 6, fill: p.color, dir: "row", align: "center", justify: "center" }); S.txt(a, p.name[0], { size: 12, weight: 600, color: "#FFFFFF" });
    const n = S.col(r, { w: 150, gap: 2 }); S.txt(n, p.name, { size: 13, weight: 600 }); S.txt(n, p.client || p.key, { size: 11.5, color: C.dim, mono: !p.client });
    if (p.fresh) { const g = S.row(r, { gap: 4 }); S.txt(g, "Pour commencer", { size: 12.5, weight: 500, color: C.fg }); S.icon(g, "chevRight", 13, C.mfg); S.spacer(r); return; }
    S.bar(r, 160, p.ratio, { h: 6, color: C.fg }); S.txt(r, p.progress, { size: 12, mono: true, color: C.mfg }); S.spacer(r);
    S.txt(r, p.open + " ouverts", { size: 12.5, color: C.mfg });
    if (p.blocked) { const g = S.row(r, { gap: 5 }); S.dot(g, C.red, 6); S.txt(g, p.blocked + (p.blocked > 1 ? " bloqués" : " bloqué"), { size: 12.5, color: C.red }); }
    if (p.risk) { const g = S.row(r, { gap: 5 }); S.dot(g, C.amber, 6); S.txt(g, p.risk + " à risque", { size: 12.5, color: C.amber }); }
    if (p.sprint) S.txt(r, p.sprint, { size: 12, mono: true, color: C.dim }); });
  return f; };

// Penpot ne relance pas la mise en page flex d’une rangée créée après coup : un écart modifié puis rétabli la force.
S.relayout34 = async (f) => { const off = (g) => g.children.some(c => c.x < g.x - 1 || c.y < g.y - 1 || c.x + c.width > g.x + g.width + 1 || c.y + c.height > g.y + g.height + 1);
  const bad = penpotUtils.findShapes(z => z.type === "board" && z.flex && z.children && z.children.length && !z.clipContent && off(z), f);
  for (const g of bad) { const k = g.flex.dir === "row" ? "columnGap" : "rowGap", v = g.flex[k]; g.flex[k] = v + 1; await S.wait(50); g.flex[k] = v; }
  await S.wait(600); return bad.length; };

S.toast34 = (f) => { const C = S.C, t = S.col(f, { name: "toast livraison", w: 340, pad: [12, 14], gap: 8, radius: 10, stroke: C.border, fill: C.card, shadow: 8 });
  const h = S.row(t, { fx: true, gap: 8 }); S.icon(h, "circleCheck", 15, C.green); S.txt(h, "F3", { size: 12, mono: true, color: C.mfg });
  S.txt(h, "Réaffecter un box", { size: 13, weight: 600 }); S.txt(h, "· livrée", { size: 12.5, color: C.mfg }); S.spacer(h); S.icon(h, "x", 13, C.dim);
  const r = S.row(t, { gap: 10, pad: [0, 0, 0, 23] }); S.segs(r, [C.green, C.green, C.green, C.green], { w: 22, h: 6, gap: 3, radius: 2 }); S.txt(r, "4/4 étapes", { size: 12, color: C.mfg });
  return t; };
S.recap34 = (f) => { const C = S.C, t = S.col(f, { name: "récapitulatif S42", w: 440, pad: [14, 16], gap: 10, radius: 10, stroke: C.border, fill: C.card, shadow: 10 });
  const h = S.row(t, { fx: true, gap: 8 }); S.icon(h, "sprint", 15, C.mfg); S.txt(h, "Sprint S42 terminé", { size: 14, weight: 600 }); S.txt(h, "12–16 oct.", { size: 12.5, color: C.mfg }); S.spacer(h); S.icon(h, "x", 13, C.dim);
  const line = (dot, strong, rest) => { const r = S.row(t, { fx: true, gap: 8 }); S.dot(r, dot, 7); S.txt(r, strong, { size: 13, weight: 600 }); S.txt(r, rest, { size: 12.5, color: C.mfg }); return r; };
  line(C.green, "1 fonctionnalité livrée", "F3 Réaffecter un box"); line(C.fg, "8 étapes fusionnées", "sur 14 prévues · capacité 5"); line(C.amber, "F5 passe en S43", "4 étapes restantes");
  S.hline(t, C.soft); const ft = S.row(t, { fx: true, gap: 8 }); S.txt(ft, "Suivant : S43 · 19–23 oct. · 8 étapes prévues", { size: 12.5, color: C.mfg }); S.spacer(ft);
  const b = S.btn(ft, "Ouvrir le planning", "outline", { sm: true }); S.icon(b, "arrowRight", 13, C.fg); return t; };
S.place34 = (f, s, x, y) => { s.bringToFront(); s.x = f.x + x; s.y = f.y + y; for (const e of S.placed) if (e[0].id === s.id) { e[2] = x; e[3] = y; } return s; };
S.cornerOf = (f, s, m = 16) => S.place34(f, s, Math.round(f.width - s.width - m), Math.round(f.height - s.height - m));

S.confirm34 = (f) => { const C = S.C; const v = S.veil(f); v.name = "veil t3"; v.bringToFront();
  const d = S.col(f, { name: "dialog", w: 520, pad: 20, gap: 14, radius: 12, stroke: C.border, fill: C.card, shadow: 12 });
  S.txt(d, "Lancer SILO-45 dans T3", { size: 16, weight: 600 }); S.txt(d, "Kibo ouvre une session T3 Code qui livre l'étape avec /full-delivery.", { size: 13, color: C.mfg, fill: true });
  const cmd = S.row(d, { fx: true, pad: [10, 12], radius: 8, stroke: C.border, fill: C.bg }); S.txt(cmd, 't3 thread start ~/Documents/silo "/full-delivery SILO-45"', { size: 12, mono: true, color: C.fg });
  const kv = (k, v, mono) => { const r = S.row(d, { fx: true, gap: 10 }); const l = S.row(r, { w: 90 }); S.txt(l, k, { size: 12.5, color: C.mfg }); S.txt(r, v, { size: 12.5, mono, color: C.fg }); };
  kv("Projet T3", "~/Documents/silo", true); kv("Modèle", "par défaut");
  const a = S.row(d, { fx: true, gap: 8, justify: "end" }); S.btn(a, "Annuler", "outline", { sm: true }); S.btn(a, "Lancer", "default", { sm: true, icon: "play" });
  return d; };

S.tooltip34 = (f, card, rows) => { const C = S.C, t = S.col(f, { name: "card tooltip", w: 300, pad: [10, 12], gap: 6, radius: 8, stroke: C.border, fill: C.card, shadow: 8 });
  for (const [k, v, mono] of rows) { const r = S.row(t, { fx: true, gap: 10, align: "start" }); const l = S.row(r, { w: 76 }); S.txt(l, k, { size: 12, color: C.dim });
    const tv = S.txt(r, v, { size: 12, mono, color: C.fg }); tv.layoutChild.horizontalSizing = "fill"; tv.growType = "auto-height"; }
  S.place34(f, t, Math.round(card.x - f.x + card.width + 10), Math.round(card.y - f.y)); card.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; return t; };
S.TIP34 = [["Étiquettes", "area:mobile", true], ["Branche", "feat/envoi-hors-ligne", true], ["En attente", "Serveur MinIO de recette indisponible"], ["Questions", "1 ouverte"]];
S.questionCount34 = (b, n) => { const t = S.find34(b, z => z.type === "text" && z.characters === "Questions" && S.parentOf(b, z) && S.parentOf(b, z).children.some(c => c.type === "text" && /^\d+$/.test(c.characters)));
  if (!t) return null; const c = S.parentOf(b, t).children.find(c => c.type === "text" && /^\d+$/.test(c.characters)); c.characters = n; S.refont(c); return n; };
S.planningAtRest34 = (b) => { let n = 0; const dz = S.find34(b, z => z.name === "dropzone"); if (dz) { dz.remove(); n++; }
  for (const c of b.children.filter(c => c.name !== "root")) { c.remove(); n++; }
  const f9 = S.find34(b, z => z.name === "feature F9"); if (f9) f9.opacity = 1;
  return { removed: n, alert: !!S.alert34(b, "S42", "F5 ne tiendra pas (4 étapes restantes)") }; };
S.alert34 = (b, code, text) => { const C = S.C, col = S.find34(b, z => z.name === "col " + code); if (!col) return null;
  for (const o of col.children.filter(c => c.name === "alert")) o.remove();
  const w = S.row(null, { name: "alert", fx: true, gap: 6, pad: [6, 8], radius: 6, fill: C.amberSoft }); S.icon(w, "clockAlert", 13, C.amber); S.txt(w, text, { size: 11.5, color: C.amber, fill: true });
  const load = col.children.find(c => S.find34(c, z => z.type === "text" && z.name === "load")) || col.children.find(c => c.type === "text" && c.name === "load");
  if (load) S.showAfter(col, load, w); else S.showFirst(col, w); w.layoutChild.horizontalSizing = "fill"; return w; };
S.hoverLaunch34 = (card) => { const C = S.C, title = card.children.find(c => c.type === "text");
  const b = S.btn(null, "Lancer dans T3", "default", { sm: true, icon: "play", pad: [3, 8] }); b.name = "launch-t3"; S.showAfter(card, title, b);
  card.strokes = [{ strokeColor: C.mfg, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }]; return b; };

S.COLORS34 = [["Bloque", "red", "--tracking-red", "lock", "ticket bloqué, question bloquante, fonctionnalité en retard", "bloqué · Q14"],
  ["Attention", "amber", "--tracking-amber", "triangleAlert", "à risque, limite atteinte, changements demandés, T3 attend", "changements demandés"],
  ["Attente", "hold", "--tracking-hold", "pause", "étape mise de côté", "Serveur MinIO de r…"],
  ["Review", "purple", "--tracking-purple", "pr", "PR ouverte", "#22"],
  ["Livré ou démarrable", "green", "--tracking-green", "circleCheck", "étape ou fonctionnalité livrée, démarrable, CI verte", "livrée"],
  ["En cours", "blue", "--tracking-blue", "circleDot", "étape en cours", "en cours"],
  ["Agent", "brand", "--tracking-brand", "bot", "agent de projet, session T3 active, logo", "T3 · en cours"]];
S.colors34 = (f) => { const C = S.C; const body = S.col(f, { name: "body", w: f.width, pad: [40, 48], gap: 18 });
  S.txt(body, "Code couleur : une couleur par sens, une marque par élément", { size: 26, weight: 600 });
  S.txt(body, "Le rouge dit « bloque », l'orange dit « agent ». Le reste de l'élément reste en zinc, et une couleur ne vient jamais seule : une icône ou un libellé l'accompagne.", { size: 14, color: C.mfg });
  const row = S.row(body, { fx: true, gap: 12, align: "stretch" });
  for (const [name, tok, css, icon, where, sample] of S.COLORS34) { const col = C[tok], soft = C[tok + "Soft"] || C.brandSoft;
    const c = S.col(row, { name: "couleur " + name, w: 180, pad: 14, gap: 8, radius: 10, stroke: C.border, fill: C.card });
    const h = S.row(c, { gap: 6 }); S.box(h, { w: 14, h: 14, radius: 4, fill: col }); S.txt(h, name, { size: 13, weight: 600 });
    S.txt(c, css, { size: 11, mono: true, color: C.dim }); S.txt(c, where, { size: 12, color: C.mfg, w: 152 });
    S.chip(c, sample, { icon, isz: 11, ic: col, color: col, fill: soft, stroke: null, pad: [2, 6] }); }
  S.txt(body, "Règles", { size: 15, weight: 600 });
  for (const t of ["Une marque colorée par élément ; le reste de l'élément en zinc.", "Jamais la couleur seule : icône ou libellé toujours présents.",
    "L'orange n'est que l'agent : « Coller la réponse », « Créer » et « Mettre en attente » passent en bouton neutre.",
    "Une question bloquante perd sa bordure rouge ; seule la pastille « bloquante » reste rouge.",
    "Carte avec PR et changements demandés : l'ambre seul, la PR reste en zinc ; la CI verte n'est pas répétée."]) {
    const r = S.row(body, { gap: 8 }); S.dot(r, C.dim, 5); S.txt(r, t, { size: 13, color: C.fg }); }
  const ex = S.row(body, { gap: 16, align: "start" });
  const card = (key, f2, title, sig) => { const c = S.col(ex, { w: 220, pad: [10, 12], gap: 8, radius: 8, stroke: C.border, fill: C.card });
    const h = S.row(c, { fx: true, gap: 5 }); S.txt(h, key, { size: 11.5, mono: true, color: C.mfg }); S.txt(h, "·", { size: 11.5, color: C.faint }); S.txt(h, f2, { size: 11.5, color: C.mfg }); S.spacer(h); S.icon(h, "more", 14, C.dim);
    S.txt(c, title, { size: 13, weight: 500, w: 196 }); const b = S.row(c, { gap: 5, wrap: true }); S.signalChip(b, sig); return c; };
  card("SILO-51", "F6", "Lecture du fichier Excel", { kind: "blocked", text: "bloqué · Q14" });
  const c2 = card("SILO-45", "F4", "Conflits de saisie", { kind: "changes" }); const b2 = S.row(c2, { gap: 5 }); S.prChip(b2, "#20"); S.stepChip(b2, 9);
  const q = S.row(ex, { pad: [10, 12], gap: 10, radius: 8, stroke: C.border, fill: C.card }); S.txt(q, "Q14", { size: 12, mono: true, color: C.mfg });
  S.txt(q, "Un box réaffecté garde-t-il ses photos ?", { size: 13 }); S.chip(q, "bloquante", { icon: "lock", isz: 11, ic: C.red, color: C.red, fill: C.redSoft, stroke: null, pad: [2, 6] });
  const bt = S.row(ex, { gap: 8 }); S.btn(bt, "Coller la réponse", "outline", { sm: true, icon: "copy" }); S.agentButton(bt);
  return body; };

S.ficheSilo34 = (b) => { const C = S.C, sheet = S.find34(b, z => z.name === "sheet"), set = (from, to) => { const t = S.byText(sheet, from); if (t) { t.characters = to; S.refont(t); } return !!t; };
  set("SILO-45", "SILO-34"); set("F4", "F5"); set("Conflits de saisie", "Tests E2E de l'envoi"); set("En review", "À faire"); set("feat/silo-45", "feat/silo-34");
  const st = S.find34(sheet, z => z.type === "ellipse" && String((z.fills[0] || {}).fillColor).toUpperCase() === C.purple.toUpperCase()); if (st) { st.fills = []; st.strokes = [{ strokeColor: C.dim, strokeWidth: 1.5, strokeAlignment: "inner", strokeOpacity: 1 }]; }
  const suivi = S.find34(sheet, z => z.name.replace(/\s/g, "") === "section/Suivi");
  for (const r of [...suivi.children]) { const l = r.children && r.children.find(c => c.name === "box" && c.width < 120); const lab = l && S.texts34(l)[0]; if (["PR", "Review", "CI", "Session"].includes(lab)) r.remove(); }
  for (const seg of penpotUtils.findShapes(z => z.name === "seg", suivi)) seg.fills = [{ fillColor: C.track, fillOpacity: 1 }];
  set("Étape 9/12 · Review", "pas encore commencée"); const nx = S.byText(suivi, "· suivante : Démo"); if (nx) nx.remove(); set("requise pour livrer F4", "requise pour livrer F5");
  set("Deux saisies hors ligne du même constat : garder la plus récente et signaler l'autre au chef de centre au retour du réseau.", "Aucune description.");
  const dep = S.find34(sheet, z => z.name.replace(/\s/g, "") === "section/Dépendances"), aucune = S.byText(dep, "Aucune");
  if (aucune) { const r = S.row(null, { gap: 8 }); S.dot(r, C.blue, 7); S.txt(r, "SILO-33", { size: 12, mono: true, color: C.mfg }); S.txt(r, "Écran d'envoi hors ligne", { size: 13 }); S.txt(r, "· attend", { size: 12.5, color: C.dim }); S.showBefore(dep, aucune, r); aucune.remove(); }
  const qs = S.find34(sheet, z => z.name.replace(/\s/g, "") === "section/Questions"); const zero = S.find34(qs, z => z.type === "text" && z.characters === "0"); if (zero) { zero.characters = "1"; S.refont(zero); }
  const none = S.byText(qs, "Aucune question sur ce ticket."); if (none) { const r = S.row(null, { gap: 8 }); S.txt(r, "Q16", { size: 12, mono: true, color: C.mfg }); S.txt(r, "Quota par client : 2 Go ou 5 Go ?", { size: 13 }); S.showBefore(qs, none, r); none.remove(); }
  return true; };

S.ROWS34 = ["p34-aujourdhui", "p34-vue-ensemble-livree", "p34-planning", "p34-graphe-tout-voir", "p34-graphe-redeplie", "p34-kanban-replie", "p34-kanban-infobulle",
  "p34-kanban-survol-t3", "p34-questions", "p34-questions-depliee", "p34-fiche-ticket", "p34-fiche-confirmation", "p34-fiche-lancee", "p34-fiche-attend",
  "p34-fiche-copiee", "p34-toast-livree", "p34-recap-sprint", "p34-couleurs", "p34-graphe-survol-t3"];
S.STEP34 = 1600;
S.NAMES34 = { "p34-aujourdhui": "P34 · Aujourd'hui", "p34-vue-ensemble-livree": "P34 · Vue d'ensemble, livrée aujourd'hui", "p34-planning": "P34 · Planning",
  "p34-graphe-tout-voir": "P34 · Graphe, Tout voir", "p34-graphe-redeplie": "P34 · Graphe, F5 redépliée", "p34-kanban-replie": "P34 · Kanban, colonne vide repliée",
  "p34-kanban-infobulle": "P34 · Kanban, infobulle", "p34-kanban-survol-t3": "P34 · Kanban, Lancer dans T3", "p34-graphe-survol-t3": "P34 · Graphe, Lancer dans T3", "p34-questions": "P34 · Questions",
  "p34-questions-depliee": "P34 · Questions, Q14 dépliée", "p34-fiche-ticket": "P34 · Fiche ticket", "p34-fiche-confirmation": "P34 · Fiche ticket, confirmation",
  "p34-fiche-lancee": "P34 · Fiche ticket, T3 en cours", "p34-fiche-attend": "P34 · Fiche ticket, T3 attend", "p34-fiche-copiee": "P34 · Fiche ticket, clé copiée",
  "p34-toast-livree": "P34 · Toast de livraison", "p34-recap-sprint": "P34 · Récapitulatif de sprint", "p34-couleurs": "P34 · Code couleur" };
S.SRC34 = { "p34-vue-ensemble-livree": "P1 bis v3 · Vue d'ensemble", "p34-toast-livree": "P1 bis v3 · Vue d'ensemble", "p34-planning": "P2 · Planning · en attente",
  "p34-graphe-tout-voir": "P5b · Graphe, Fonctionnalités", "p34-graphe-redeplie": "P5b · Graphe, Fonctionnalités", "p34-kanban-replie": "P7 · Kanban · en attente",
  "p34-kanban-infobulle": "P7 · Kanban · en attente", "p34-kanban-survol-t3": "P7 · Kanban · en attente", "p34-graphe-survol-t3": "P5b · Graphe, Fonctionnalités", "p34-questions": "P9 · Questions", "p34-questions-depliee": "P9 · Questions",
  "p34-fiche-ticket": "P8 · Fiche ticket", "p34-fiche-confirmation": "P8 · Fiche ticket", "p34-fiche-lancee": "P8 · Fiche ticket", "p34-fiche-attend": "P8 · Fiche ticket",
  "p34-fiche-copiee": "P8 · Fiche ticket", "p34-recap-sprint": "P1 bis v3 · En retard au 18 oct." };
S.draw34k = {
  "p34-aujourdhui": async (f) => S.today34(f),
  "p34-couleurs": async (f) => { S.colors34(f); },
  "p34-vue-ensemble-livree": async (f) => S.p34Vue(f, { livree: true }),
  "p34-toast-livree": async (f) => { await S.p34Vue(f, { livree: true }); const t = S.toast34(f); await S.settle34(() => t.height); S.cornerOf(f, t); },
  "p34-recap-sprint": async (f) => { await S.p34Vue(f); const t = S.recap34(f); await S.settle34(() => t.height); S.cornerOf(f, t); },
  "p34-planning": async (f) => { await S.p34Planning(f); return S.planningAtRest34(f); },
  "p34-graphe-tout-voir": async (f) => { await S.p34Graph(f); return S.p34GraphAll(f, []); },
  "p34-graphe-redeplie": async (f) => { await S.p34Graph(f); await S.p34GraphAll(f, ["F5"]); S.t3Pill34(S.parentOf(f, S.byText(f, "Tests E2E de l'envoi"))); },
  "p34-kanban-replie": async (f) => { await S.p34Kanban(f); S.questionCount34(f, "4"); },
  "p34-kanban-infobulle": async (f) => { await S.p34Kanban(f); await S.wait(600); const card = S.find34(f, z => z.name === "card SILO-33");
    S.tooltip34(f, card, S.TIP34); S.questionCount34(f, "4"); },
  "p34-graphe-survol-t3": async (f) => { await S.p34Graph(f); S.t3Pill34(S.parentOf(f, S.byText(f, "Tests E2E de l'envoi"))); return S.graphHover34(f); },
  "p34-kanban-survol-t3": async (f) => { await S.p34Kanban(f, { "SILO-34": "running" }); S.hoverLaunch34(S.find34(f, z => z.name === "card SILO-46")); S.questionCount34(f, "4"); },
  "p34-questions": async (f) => { for (const c of f.children.filter(c => c.name !== "root")) c.remove(); return S.p34Questions(f); },
  "p34-questions-depliee": async (f) => { for (const c of f.children.filter(c => c.name !== "root")) c.remove(); return S.p34Questions(f, { open: "Q14" }); },
  "p34-fiche-ticket": async (f) => S.p34Fiche(f),
  "p34-fiche-confirmation": async (f) => { await S.p34Fiche(f); const d = S.confirm34(f); await S.settle34(() => d.height); S.place34(f, d, Math.round((f.width - d.width) / 2), Math.round((f.height - d.height) / 2)); },
  "p34-fiche-lancee": async (f) => { await S.p34Fiche(f); S.ficheSilo34(f); S.p34FicheT3(f, false); for (const card of penpotUtils.findShapes(z => z.name === "card SILO-34", f)) { const bad = card.children.find(c => c.name === "badges") || S.row(card, { name: "badges", gap: 5, wrap: true }); S.t3Chip(bad, false); } },
  "p34-fiche-attend": async (f) => { await S.p34Fiche(f); S.p34FicheT3(f, true); },
  "p34-fiche-copiee": async (f) => { await S.p34Fiche(f); S.p34FicheCopied(f); },
};
S.draw34 = async (key, mode) => { await S.page("Phase 34"); S.setMode(mode);
  const i = S.ROWS34.indexOf(key), x = mode === "light" ? 1540 : 0, y = i * S.STEP34;
  for (const b of penpot.currentPage.root.children.filter(c => Math.abs(c.y - y) < 1 && Math.abs(c.x - x) < 1)) b.remove();
  S.placed = []; let f;
  if (S.SRC34[key]) { const src = penpot.currentPage.root.children.find(c => c.name === "src · " + S.SRC34[key] + (mode === "light" ? " (clair)" : ""));
    if (!src) throw new Error("missing source: " + S.SRC34[key]); f = src.clone(); f.x = x; f.y = y; S.rename(f, S.NAMES34[key]); }
  else f = S.screen(S.NAMES34[key], x, y, 1440, key === "p34-couleurs" ? 680 : 1000);
  const r = await S.withRefont(() => S.draw34k[key](f)); await S.wait(600); const moved = S.replace(); const relaid = await S.relayout34(f);
  return { board: f.name, shapes: S.count(f), moved, relaid, refonts: r }; };
S.export34 = async (only) => { await S.page("Phase 34"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && /^P34 · /.test(c.name))) {
    const base = b.name.replace(/ \(clair\)$/, ""), key = Object.keys(S.NAMES34).find(k => S.NAMES34[k] === base); if (!key || (only && !only.includes(key))) continue;
    const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(3000);
    try { out.push(await S.exportPng(c, `proposition-${key}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };

S.neutral34 = (b, label) => { const C = S.C; let n = 0;
  for (const bt of penpotUtils.findShapes(z => /Button ?\/ ?brand/.test(z.name) && S.texts34(z).includes(label), b)) {
    bt.fills = [{ fillColor: C.primary, fillOpacity: 1 }]; bt.name = "Button/default";
    for (const t of penpotUtils.findShapes(z => z.type === "text", bt)) { t.fills = [{ fillColor: C.pfg, fillOpacity: 1 }]; S.refont(t); }
    for (const ic of penpotUtils.findShapes(z => z.type === "path", bt)) if (ic.strokes && ic.strokes.length) ic.strokes = [{ ...ic.strokes[0], strokeColor: C.pfg }];
    n++; }
  return n; };
S.ficheMenu34 = (b, hold) => { for (const m of b.children.filter(c => c.name === "menu")) m.remove();
  const sheet = S.named(b, "sheet"), more = S.find34(sheet, z => z.name.replace(/\s/g, "") === "icon/more");
  const x = Math.round(more.x - b.x + more.width - 240), y = Math.round(more.y - b.y + more.height + 8);
  return S.menu29(b, x, y, 240, [{ label: "Copier /full-delivery SILO-45", icon: "copy" }, hold ? { label: "Reprendre", icon: "play", on: true } : { label: "Mettre en attente…", icon: "pause", on: true },
    { label: "Ouvrir dans un onglet", icon: "maximize" }, "sep", { label: "Supprimer…", icon: "trash", danger: true }]); };
S.planMenu34 = async (b) => { for (const m of b.children.filter(c => c.name === "menu")) m.remove(); await S.wait(600);
  const chip = S.find34(b, z => z.name === "held SILO-45"), x = Math.round(chip.x - b.x), y = Math.round(chip.y - b.y + chip.height + 6);
  S.menu29(b, x, y, 200, [{ label: "Reprendre", icon: "play" }, { label: "Reprendre dans", icon: "sprint", chev: true, on: true }]);
  S.menu29(b, x + 204, y + 34, 220, [{ label: "S43 · Import et contrats", on: true }, { label: "S44 · Rapports" }]); return true; };
S.qMenu34 = async (b) => { for (const m of b.children.filter(c => c.name === "menu" || c.name === "more pressed")) m.remove();
  await S.p34Questions(b, { open: "Q16", menu: true }); await S.wait(600);
  const more = S.find34(b, z => z.name === "more" && z.parent && /^detail Q16/.test(S.parentOf(b, z) ? S.parentOf(b, z).name : "") ) || penpotUtils.findShapes(z => z.name === "more", b).pop();
  const x = Math.round(more.x - b.x + more.width - 220), y = Math.round(more.y - b.y + more.height + 6);
  S.menu29(b, x, y, 220, [{ label: "Modifier", icon: "pencil" }, { label: "Archiver", icon: "archive", on: true }, { label: "Exporter cette question", icon: "upload" }, "sep", { label: "Supprimer", icon: "trash", danger: true }]); return true; };
S.INPLACE34 = {
  "P1 bis v3 · Vue d'ensemble": (b) => S.p34Vue(b, { livree: true }),
  "P1 bis · Vue d'ensemble · en attente": (b) => S.p34Vue(b, { livree: true }),
  "P1 bis · Agent agrandi": (b) => S.p34Vue(b, { livree: true }),
  "P1 bis · Vue d'ensemble": (b) => S.p34Vue(b, { livree: true }),
  "P1 bis v3 · En retard au 18 oct.": (b) => S.p34Vue(b),
  "P2 · Planning": (b) => S.p34Planning(b),
  "P2 · Planning · en attente": (b) => S.p34Planning(b),
  "P2b · Planning, Reprendre dans": async (b) => { await S.p34Planning(b); return S.planMenu34(b); },
  "P5b · Graphe, Fonctionnalités": (b) => S.p34Graph(b),
  "P5b · Graphe · en attente": (b) => S.p34Graph(b),
  "P7 · Kanban": (b) => S.p34Kanban(b),
  "P7 · Kanban · en attente": (b) => S.p34Kanban(b),
  "Barre repliée · Kanban à 1 180 px": (b) => S.p34Kanban(b),
  "P8 · Fiche ticket": (b) => S.p34Fiche(b),
  "P8b · Fiche ticket, Activité": (b) => S.p34Fiche(b),
  "P8f · Fiche ticket, Maquettes": (b) => S.p34Fiche(b),
  "P8 · Fiche ticket · en attente": (b) => S.p34Fiche(b),
  "P8d · Fiche ticket, menu": async (b) => { await S.p34Fiche(b); await S.wait(600); return S.ficheMenu34(b, false); },
  "P8e · Fiche ticket en attente, menu": async (b) => { await S.p34Fiche(b); await S.wait(600); return S.ficheMenu34(b, true); },
  "P8c · Mettre en attente": async (b) => { await S.p34Kanban(b); return S.neutral34(b, "Mettre en attente"); },
  "P6 · Nouveau projet": (b) => S.neutral34(b, "Créer"),
  "P3 · Fonctionnalité": () => null,
  "P3 · Fonctionnalité · en attente": () => null,
  "P9 · Questions": (b) => S.p34Questions(b),
  "P9b · Questions, menu": (b) => S.qMenu34(b),
  "P9c · Supprimer la question": async (b) => { const r = await S.p34Questions(b); for (const n of ["veil", "dialog"]) { const d = b.children.find(c => c.name === n); if (d) d.bringToFront(); } return r; },
  "P9d · Questions, répondues": (b) => S.p34Questions(b, { qs: [S.Q34[1]], state: "répondue", openCount: 2, summary: "1 répondue" }),
};
S.FIX34 = { vue: (b) => S.p34Legend(b), planning: (b) => S.p34PlanLegend(b), graph: (b) => ({ edges: S.noEdges34(b), legend: S.graphLegend34(b), startable: !!S.startable34(b) }) };
S.fix34 = async (name, kind) => { await S.page("Proposition"); const b = penpot.currentPage.root.children.find(c => c.name === name); if (!b) throw new Error("missing board: " + name);
  S.setMode(S.modeOf(b)); S.placed = []; const r = S.FIX34[kind](b); await S.wait(600); const relaid = await S.relayout34(b); return { r, relaid, bottom: S.bottom34(b) }; };
S.bottom34 = (b) => Math.round(Math.max(...penpotUtils.findShapes(z => z.type === "text", b).map(t => t.y + t.height - b.y)));
S.inPlace34 = async (name) => { await S.page("Proposition"); const b = penpot.currentPage.root.children.find(c => c.name === name); if (!b) throw new Error("missing board: " + name);
  S.setMode(S.modeOf(b)); S.placed = []; const base = name.replace(/ \(clair\)$/, ""), fn = S.INPLACE34[base]; if (!fn) return null;
  const r = await fn(b); const steps = S.p34Steps(b); await S.wait(600); S.replace(); const relaid = await S.relayout34(b); return { r, steps, relaid, h: b.height }; };

return "phase 34 ok";
