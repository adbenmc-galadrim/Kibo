// Phase 29 (spec §41) : étapes en attente. Boards de la page « Proposition », rangées après celles de la phase 27, sombre à x = 0, clair à x = 1 540.
// Chaque board clone la référence pixel de son écran (retouches du jalon 27 et textes de la phase 28 compris), puis y pose l'attente.
const S = storage;
S.draw = S.draw || {};
Object.assign(S.ICONS, { pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' });
S.HOLDS = [
  { key: "SILO-45", title: "Conflits de saisie", f: "F4", reason: "Règle de fusion à valider par le client" },
  { key: "SILO-33", title: "Écran d'envoi hors ligne", f: "F5", reason: "Serveur MinIO de recette indisponible" },
  { key: "SILO-82", title: "Génération PDF", f: "F7", reason: "Serveur MinIO de recette indisponible" } ];
S.HELD_BY = { "SILO-34": "SILO-33", "SILO-35": "SILO-33" };
S.HOLD_DAY = "16 oct.";
S.shortReason = (reason, max = 24) => { const cp = Array.from(reason); return cp.length <= max ? reason : cp.slice(0, max).join("").trimEnd() + "…"; };
S.holdOf = (key) => S.HOLDS.find(h => h.key === key);
S.heldGroups = () => { const reasons = [...new Set(S.HOLDS.map(h => h.reason))].sort((a, b) => a.localeCompare(b, "fr"));
  return reasons.map(reason => { const steps = S.HOLDS.filter(h => h.reason === reason).sort((a, b) => a.key.localeCompare(b.key, "fr", { numeric: true }));
    const dependents = Object.values(S.HELD_BY).filter(k => steps.some(s => s.key === k)).length; return { reason, steps, dependents }; }); };
S.Y29 = S.Y27 + S.STEP27 * S.ROWS27.length;
S.ROWS29 = ["a-vue", "a-planning", "a-fonctionnalite", "a-kanban", "a-fiche", "a-dialogue", "a-fiche-menu", "a-fiche-menu-reprendre", "a-planning-menu"];
S.SRC29 = { "a-vue": "P1 bis v3 · Vue d'ensemble", "a-planning": "P2 · Planning", "a-fonctionnalite": "P3 · Fonctionnalité", "a-kanban": "P7 · Kanban",
  "a-fiche": "P8 · Fiche ticket", "a-dialogue": "P7 · Kanban · en attente", "a-fiche-menu": "P8 · Fiche ticket", "a-fiche-menu-reprendre": "P8 · Fiche ticket · en attente",
  "a-planning-menu": "P2 · Planning · en attente" };
S.NAMES29 = { "a-vue": "P1 bis · Vue d'ensemble · en attente", "a-planning": "P2 · Planning · en attente", "a-fonctionnalite": "P3 · Fonctionnalité · en attente",
  "a-kanban": "P7 · Kanban · en attente", "a-fiche": "P8 · Fiche ticket · en attente", "a-dialogue": "P8c · Mettre en attente",
  "a-fiche-menu": "P8d · Fiche ticket, menu", "a-fiche-menu-reprendre": "P8e · Fiche ticket en attente, menu", "a-planning-menu": "P2b · Planning, Reprendre dans" };
S.find29 = (scope, pred) => penpotUtils.findShapes(pred, scope)[0];
S.named = (scope, name) => { const s = S.find29(scope, z => z.name === name); if (!s) throw new Error("missing shape: " + name); return s; };
S.shownIndex = (parent, ref) => parent.children.length - 1 - parent.children.findIndex(c => c.id === ref.id);
S.showAfter = (parent, ref, shape) => { parent.insertChild(S.shownIndex(parent, ref) + 1, shape); return shape; };
S.showBefore = (parent, ref, shape) => { parent.insertChild(S.shownIndex(parent, ref), shape); return shape; };
S.showFirst = (parent, shape) => { parent.insertChild(0, shape); return shape; };
S.showLast = (parent, shape) => { parent.insertChild(parent.children.length, shape); return shape; };

// ---------- Puce d'attente (Kanban) et filtre « En attente » ----------
S.holdBadge = (text) => { const C = S.C;
  const b = S.row(null, { name: "badge hold", pad: [2, 6], gap: 4, radius: 4, fill: C.holdSoft });
  S.icon(b, "pause", 12, C.hold); S.txt(b, text, { size: 11, weight: 500, color: C.hold }); return b; };
S.kanbanHolds = (f) => { const C = S.C, sec = C.mfg;
  for (const h of S.HOLDS) { const card = S.find29(f, s => s.name === "card " + h.key); if (!card) continue;
    const badges = card.children.find(c => c.name === "badges"); S.showFirst(badges, S.holdBadge(S.shortReason(h.reason))); }
  for (const [key, src] of Object.entries(S.HELD_BY)) { const card = S.find29(f, s => s.name === "card " + key); if (!card) continue;
    const badges = card.children.find(c => c.name === "badges"); for (const b of [...badges.children]) b.remove();
    S.showLast(badges, S.holdBadge("attend " + src)); }
  const seg = S.named(f, "filter"), last = S.parentOf(seg, S.byText(seg, "À reprendre"));
  const s = S.row(null, { name: "filter held", pad: [4, 10], gap: 6, radius: 5 });
  S.icon(s, "pause", 12, C.hold); S.txt(s, "En attente", { size: 12.5, weight: 500, color: sec }); S.txt(s, "5", { size: 11, mono: true, color: C.dim });
  S.showAfter(seg, last, s); return f; };
S.MINE29 = ["SILO-46", "SILO-34", "SILO-35", "SILO-33", "SILO-45", "SILO-32"];
S.DONE29 = [["SILO-2", "F1", "Application Azure"], ["SILO-3", "F1", "Route de connexion"], ["SILO-4", "F1", "Écran de connexion"], ["SILO-5", "F1", "Démo · F1"],
  ["SILO-10", "F2", "Modèle des affectations"], ["SILO-11", "F2", "Périmètre côté serveur"], ["SILO-12", "F2", "Règles de synchro"], ["SILO-13", "F2", "Liste des box"],
  ["SILO-14", "F2", "Démo · F2"], ["SILO-18", "F3", "Historique des affectations"], ["SILO-19", "F3", "Route de réaffectation"]];
S.badgesOf = (card) => { let b = card.children.find(c => c.name === "badges");
  if (!b) { b = S.row(null, { name: "badges", fx: true, gap: 5, wrap: true }); S.showLast(card, b); b.layoutChild.horizontalSizing = "fill"; } return b; };
S.questionBadge = (n) => { const C = S.C; const q = S.row(null, { name: "badge question", pad: [2, 8], gap: 4, radius: 10, stroke: C.amber });
  S.icon(q, "question", 12, C.amber, 1); S.txt(q, `${n} question`, { size: 11, weight: 500, color: C.amber }); return q; };
S.kanbanSeed29 = (f) => { const C = S.C, sec = C.mfg;
  const seg = S.named(f, "filter"); S.setText(S.parentOf(seg, S.byText(seg, "Démarrable")), "1", "2");
  for (const key of S.MINE29) { const card = S.find29(f, s => s.name === "card " + key); if (!card) continue;
    const b = S.badgesOf(card); S.showLast(b, S.kb(null, "Adam", C.fg, { pill: true }));
    if (key === "SILO-34") S.showLast(b, S.questionBadge(1)); }
  const c54 = S.find29(f, s => s.name === "card SILO-54"), b54 = S.badgesOf(c54); for (const b of [...b54.children]) b.remove();
  S.showLast(b54, S.kb(null, "attend SILO-51, SILO-52, …", sec));
  const todo = S.parentOf(f, c54), c62 = S.showAfter(todo, c54, S.kcard(null, { key: "SILO-62", f: null, title: "Journal des erreurs avec Sentry" }));
  c62.layoutChild.horizontalSizing = "fill";
  const done = S.find29(f, s => s.name === "column Terminé");
  for (const c of [...done.children]) if (c.name.startsWith("card ")) c.remove();
  for (const [key, ft, title] of S.DONE29) { const c = S.showLast(done, S.kcard(null, { key, f: ft, title })); c.layoutChild.horizontalSizing = "fill";
    S.byText(c, title).fills = [{ fillColor: C.fg, fillOpacity: 1 }]; }
  return f; };
// ---------- Gabarit des cartes et des en-têtes de colonne du rendu (Kanban en attente seulement ; P7 garde le sien) ----------
S.CARD_W29 = 147.2;
S.SHORT29 = { "Serveur MinIO de recette…": "Serveur MinIO de rec…", "Règle de fusion à valide…": "Règle de fusion à vali…" };
S.restyle29 = (t, o) => { const f = o.mono ? S.mono : (penpot.fonts.findById(t.fontId) || S.font), w = String(o.weight || t.fontWeight);
  const v = f.variants.find(x => x.fontWeight === w && x.fontStyle === "normal") || f.variants[0], size = String(o.size || t.fontSize), fills = o.color ? [{ fillColor: o.color, fillOpacity: 1 }] : t.fills;
  f.applyToText(t, v); t.fontSize = size; t.fills = fills; t.lineHeight = String(o.lh || 1.2); return t; };
S.pad29 = (b, top, right, bottom, left) => { const fl = b.flex; fl.topPadding = top; fl.rightPadding = right; fl.bottomPadding = bottom; fl.leftPadding = left; return b; };
S.textOf29 = (b) => penpotUtils.findShapes(s => s.type === "text", b)[0];
S.swapIcon29 = (row, name, color, sw) => { const old = row.children.find(x => x.name.replace(/\s/g, "") === "icon/" + name), size = old.width;
  const icon = S.showAfter(row, old, S.icon(null, name, size, color, sw)); old.remove(); return icon; };
S.QUESTION29 = { dark: "#FB923C", light: "#EA580C" };
S.SURFACE29 = { dark: { column: "#151517", card: "#18181B" }, light: { column: "#FBFBFB", card: "#FFFFFF" } };
S.badge29 = (b) => { const t = S.textOf29(b), mono = /Mono/.test(t.fontFamily), pill = b.borderRadius >= 10 || /^(attend SILO-51|sprint )/.test(t.characters);
  if (b.name === "badge question") { const tone = S.QUESTION29[S.mode]; b.borderRadius = 6; S.pad29(b, 3, 7, 3, 7);
    b.strokes = [{ strokeColor: "#F97316", strokeOpacity: 0.4, strokeWidth: 1, strokeAlignment: "inner" }]; S.swapIcon29(b, "question", tone, 2);
    S.restyle29(t, { size: 10, weight: 500, lh: 1.4, color: tone }); return b; }
  if (pill) { b.borderRadius = 10; const px = mono ? 7 : 9; S.pad29(b, 3, px, 3, px); S.restyle29(t, { size: 10, weight: mono || t.characters === "Adam" ? 400 : 500, mono, lh: 1.4 }); return b; }
  const px = b.strokes.length ? 7 : 6; S.pad29(b, 3, px, 3, px);
  if (S.SHORT29[t.characters]) t.characters = S.SHORT29[t.characters];
  S.restyle29(t, { size: 11, weight: 500, mono, lh: 12 / 11 }); return b; };
S.keyRow29 = (c) => { const C = S.C, row = c.children.find(x => x.name === "box"), texts = row.children.filter(x => x.type === "text");
  row.flex.columnGap = 6; for (const t of texts) S.restyle29(t, { size: 11, mono: true, weight: 400, color: C.mfg });
  S.swapIcon29(row, "more", C.fg, 2).layoutChild.rightMargin = 5;
  const halo = row.children.find(x => x.name === "halo"); if (halo) { halo.remove(); S.showAfter(row, texts.find(t => /^F\d$/.test(t.characters)), S.dot(null, C.brand, 7)); } };
S.card29 = (c) => { const badges = c.children.find(x => x.name === "badges"), title = c.children.find(x => x.type === "text");
  S.pad29(c, 11, 13, badges ? 11 : 19, 13); S.keyRow29(c); S.restyle29(title, { size: 13, weight: 500, lh: 20 / 13 });
  if (badges) for (const b of badges.children) S.badge29(b); };
S.header29 = (col) => { const C = S.C, h = S.shown(col)[0], texts = h.children.filter(x => x.type === "text"), count = texts.find(t => /^\d+$/.test(t.characters));
  S.pad29(h, 0, 4, 0, 4); h.flex.columnGap = 8; S.restyle29(texts.find(t => t !== count), { size: 12, weight: 500, lh: 4 / 3 });
  S.restyle29(count, { size: 11, mono: true, weight: 400, color: C.mfg, lh: 16 / 11 }); S.showAfter(h, h.children.find(x => x.name === "spacer"), count);
  const plus = S.swapIcon29(h, "plus", C.fg, 2); plus.layoutChild.leftMargin = 5; plus.layoutChild.rightMargin = 5; };
S.fitBadges29 = (f) => { for (const b of penpotUtils.findShapes(s => s.type === "board" && s.name.startsWith("badge") && s.name !== "badges", f))
  if (b.width > S.CARD_W29 + 0.5 || S.textOf29(b).characters.endsWith("…")) { b.flex.horizontalSizing = "fix"; b.resize(S.CARD_W29, b.height); b.flex.verticalSizing = "auto"; } };
S.FILTER_W29 = { "Tous": 68.4, "Sprint courant · S42": 157.4, "Démarrable": 102.6, "À reprendre": 121.3, "En attente": 112.2 };
S.toolbar29 = (f) => { const C = S.C, tb = S.named(f, "toolbar"), seg = S.named(tb, "filter"); tb.flex.bottomPadding = 1;
  for (const b of seg.children) { const texts = b.children.filter(x => x.type === "text"), label = texts.find(t => S.FILTER_W29[t.characters]); if (!label) continue;
    S.restyle29(label, { size: 12.5, weight: 500 }); for (const t of texts) if (t !== label) S.restyle29(t, { size: 11, mono: true, weight: 400, color: C.mfg });
    b.flex.horizontalSizing = "fix"; b.flex.justifyContent = "center"; b.resize(S.FILTER_W29[label.characters], b.height); }
  const tag = S.named(tb, "Button / outline"); S.pad29(tag, 0, 11, 0, 11); tag.flex.columnGap = 6; S.restyle29(tag.children.find(x => x.type === "text"), { size: 12, weight: 500, color: C.mfg });
  S.showLast(tag, S.icon(null, "chevDown", 14, C.mfg)); tag.flex.horizontalSizing = "fix"; tag.resize(157.6, 25); };
S.kanbanGabarit29 = async (f) => { const row = S.named(f, "columns-row"); row.y -= 1; row.resize(row.width, row.height + 1); S.toolbar29(f);
  const fill = (s, color) => { s.fills = [{ fillColor: color, fillOpacity: 1 }]; }, surface = S.SURFACE29[S.mode];
  for (const col of row.children.filter(x => x.name.startsWith("column "))) { S.header29(col); fill(col, surface.column);
    for (const c of col.children.filter(x => x.name.startsWith("card "))) { S.card29(c); fill(c, surface.card); } }
  const area = S.named(f, "columns"); for (const sh of area.children.filter(x => x.name === "scroll-shadow")) sh.remove();
  for (const col of row.children.filter(x => x.name.startsWith("column ")))
    S.box(area, { name: "scroll-clip", x: Math.round(col.x - area.x) + 8, y: Math.round(col.y + col.height - area.y) - 8, w: Math.round(col.width) - 16, h: 8, fill: surface.column });
  await S.wait(600); S.fitBadges29(f); return f; };
S.draw29k = {};
S.draw29k["a-kanban"] = async (f) => S.kanbanGabarit29(S.kanbanSeed29(S.kanbanHolds(f)));

// ---------- Retouches communes ----------
S.shown = (parent) => [...parent.children].reverse();
S.keepCases = (card, keep, total) => { const segs = S.named(card, "segs"), all = S.shown(segs), gap = segs.flex.columnGap, w = total ? Math.floor((total - (keep.length - 1) * gap) / keep.length) : null;
  all.forEach((c, i) => { if (!keep.includes(i)) c.remove(); else if (w) c.resize(w, c.height); }); return segs; };
S.paint = (s, color) => { s.fills = [{ fillColor: color, fillOpacity: 1 }]; return s; };
S.holdCases = (card, held) => { const all = S.shown(S.named(card, "segs")); for (const i of held) S.paint(all[i], S.C.hold); return all; };
S.heldMark = (parent, n) => { const hb = S.row(parent, { name: "held", gap: 3, pad: [0, 0, 0, 6] }); S.icon(hb, "pause", 11, S.C.hold);
  S.txt(hb, String(n), { size: 11.5, mono: true, color: S.C.hold }); return hb; };
S.rowOf = (scope, chars) => { let s = S.byText(scope, chars); while (s && !(s.type === "board" && Math.round(s.width) === Math.round(scope.width))) s = S.parentOf(scope, s); return s; };
S.delivered29 = (card, label) => { const C = S.C, head = S.shown(card)[0], chip = head.children.find(c => c.name === "chip"); if (chip) chip.remove();
  S.icon(head, "circleCheck", 13, C.green); S.txt(head, label, { size: 11.5, color: C.green });
  const title = S.shown(card).find(c => c.type === "text"); if (title) title.fills = [{ fillColor: C.mfg, fillOpacity: 1 }]; return card; };

// ---------- P2 · Planning : « En attente (3) » en pied de « À planifier » ----------
S.heldSection = () => { const C = S.C, sec = C.mfg, groups = S.heldGroups();
  const s = S.col(null, { name: "held", gap: 12, pad: [10, 2, 2, 2] });
  const h = S.row(s, { fx: true, gap: 6 }); S.icon(h, "pause", 14, C.hold); S.txt(h, `En attente (${S.HOLDS.length})`, { size: 13, weight: 600 });
  for (const g of groups) { const gc = S.col(s, { name: "held group", fx: true, gap: 6 });
    S.txt(gc, g.reason, { size: 13, color: sec, fill: true, lh: 1.35 });
    for (const st of g.steps) { const r = S.col(gc, { name: "held " + st.key, fx: true, pad: [7, 10], gap: 3, radius: 6, fill: C.card, stroke: C.border });
      const a = S.row(r, { fx: true, gap: 5 }); S.txt(a, st.key, { size: 11, mono: true, color: C.dim }); S.txt(a, "·", { size: 11, color: C.faint }); S.txt(a, st.f, { size: 11, mono: true, color: C.dim });
      S.spacer(a); S.icon(a, "more", 13, C.dim); S.txt(r, st.title, { size: 13, weight: 500, fill: true }); }
    if (g.dependents) { const d = S.row(gc, { fx: true, gap: 6, pad: [0, 2] }); S.icon(d, "link", 12, C.dim); S.txt(d, `${g.dependents} en dépendent`, { size: 11.5, color: C.dim }); } }
  return s; };
S.draw29k["a-planning"] = (f) => { const C = S.C;
  S.setText(f, "3 fonctionnalités livrées sur 9 · 1 à planifier", "4 fonctionnalités livrées sur 9 · 1 à planifier");
  S.setText(f, "En cours : 2 / 2", "En cours : 1 / 2");
  const s42 = S.named(f, "col S42"), s44 = S.named(f, "col S44"), res = S.named(f, "col reserve");
  S.setText(s42, "1/3 livrées", "2/3 livrées"); const bar = S.find29(s42, z => z.name === "bar"); const fill = bar && bar.children.find(c => c.name === "fill"); if (fill) fill.resize(Math.round(bar.width * 2 / 3), fill.height);
  S.setText(s42, "14 étapes prévues · capacité 5", "10 étapes prévues · capacité 5");
  S.setText(s44, "5 étapes prévues · capacité 5", "4 étapes prévues · capacité 5");
  const f4 = S.named(s42, "feature F4"), f5 = S.named(s42, "feature F5"), f7 = S.named(s44, "feature F7");
  S.holdCases(f4, [3]); S.setText(f4, "3/5 étapes", "3/4 étapes"); S.delivered29(f4, "livrée · 1 en attente");
  S.holdCases(f5, [2, 3, 4]); S.setText(f5, "1/5 étapes", "1/2 étapes");
  S.holdCases(f7, [1]); S.setText(f7, "0/5 étapes", "0/4 étapes");
  S.parentOf(s42, S.byText(s42, "F4 ne tiendra pas : 1 étape restante")).remove();
  S.parentOf(s42, S.byText(s42, "F5 ne tiendra pas : 4 étapes restantes")).remove();
  const risk = S.find29(f5, z => z.name === "chip"), rh = S.parentOf(f5, risk); risk.remove(); S.chip(rh, "en cours", { color: C.blue, stroke: null, fill: C.blueSoft, size: 10.5 });
  const sp = S.showLast(res, S.box(null, { name: "spacer", w: 10, h: 10 })); sp.layoutChild.verticalSizing = "fill"; sp.layoutChild.horizontalSizing = "fill";
  const held = S.showLast(res, S.heldSection()); held.layoutChild.horizontalSizing = "fill";
  return f; };

// ---------- P3 · Fonctionnalité F5 : étapes actives, puis « En attente · 3 » ----------
S.heldStep = (p, st, own) => { const C = S.C, sec = C.mfg;
  const r = S.row(p, { name: "held step " + st.key, fx: true, gap: 14, align: "start" });
  const n = S.box(r, { w: 28, h: 28, radius: 14, fill: C.holdSoft, dir: "row", align: "center", justify: "center" }); S.icon(n, "pause", 13, C.hold);
  const c = S.col(r, { fx: true, pad: [10, 14], gap: 7, radius: 8, stroke: C.border });
  const a = S.row(c, { fx: true, gap: 8 }); S.txt(a, st.title, { size: 14, weight: 500, color: C.mfg }); S.txt(a, st.key, { size: 12, mono: true, color: C.dim });
  S.spacer(a); const stt = S.row(a, { gap: 6 }); S.status(stt, st.status, 8); S.txt(stt, st.status, { size: 12.5, color: sec });
  const b = S.row(c, { fx: true, gap: 6 });
  if (own) { S.icon(b, "pause", 12, C.hold); S.txt(b, `${own.reason} · depuis le ${S.HOLD_DAY}`, { size: 12.5, color: sec }); S.spacer(b); S.btn(b, "Reprendre", "outline", { sm: true }); }
  else { S.icon(b, "link", 12, sec); S.txt(b, "attend " + st.waits, { size: 12.5, color: sec }); }
  return r; };
S.activityRow = (icon, color, text, time) => { const C = S.C;
  const r = S.row(null, { name: "box", h: 29, pad: [7, 14], gap: 9 }); S.icon(r, icon, 13, color);
  S.txt(r, text, { size: 12, fill: true }); S.txt(r, time, { size: 11, mono: true, color: C.dim }); return r; };
S.draw29k["a-fonctionnalite"] = (f) => { const C = S.C, sec = C.mfg;
  const bar = S.parentOf(f, S.byText(f, "1 étape livrée sur 5")); const segs = bar.children.find(c => c.name === "segs");
  S.shown(segs).forEach((c, i) => { if (i > 1) S.paint(c, C.hold); }); S.setText(bar, "1 étape livrée sur 5", "1 étape livrée sur 2 · 3 en attente");
  S.byText(f, "4 étapes restantes : ne tiendra pas dans S42.").remove();
  const tl = S.find29(f, z => z.type === "board" && Math.round(z.x - f.x) === 269 && Math.round(z.y - f.y) === 351 && Math.round(z.width) === 795);
  const rows = S.shown(tl); for (const r of rows.slice(2)) r.remove();
  const rail = S.find29(rows[1], z => z.type === "board" && Math.round(z.width) === 2); if (rail) rail.remove();
  const content = S.parentOf(f, tl);
  const sec29 = S.col(null, { name: "held steps", gap: 12, pad: [6, 0, 0, 0] });
  const steps = [{ key: "SILO-33", title: "Écran d'envoi hors ligne", status: "En cours" }, { key: "SILO-34", title: "Tests E2E de l'envoi", status: "À faire" }, { key: "SILO-35", title: "Démo client", status: "À faire" }];
  const h = S.row(sec29, { fx: true, gap: 10, h: 25 }); S.icon(h, "pause", 15, C.hold); S.txt(h, `En attente · ${steps.length}`, { size: 15, weight: 600 });
  S.txt(h, "la fonctionnalité avance sans elles", { size: 12.5, color: C.dim });
  for (const st of steps) S.heldStep(sec29, { ...st, waits: S.HELD_BY[st.key] }, S.holdOf(st.key));
  S.showAfter(content, tl, sec29); sec29.layoutChild.horizontalSizing = "fill";
  const act = S.named(f, "card / Activité"), old = S.parentOf(act, S.byText(act, "Phase 11/12 · Livré · SILO-31")), list = S.shown(act);
  const oi = list.findIndex(c => c.id === old.id); list[oi - 1].remove(); old.remove();
  const head = S.shown(act)[0];
  const line = S.showAfter(act, head, S.box(null, { name: "line", w: 10, h: 1, fill: C.soft })); line.layoutChild.horizontalSizing = "fill";
  const row = S.showAfter(act, line, S.activityRow("pause", sec, "Mise en attente · Serveur MinIO de r…", "15:10")); row.layoutChild.horizontalSizing = "fill";
  return f; };

// ---------- P1 bis · Vue d'ensemble : « 3 en attente » sous Fonctionnalités, carte « En attente » sous Échéances ----------
S.heldCard = () => { const C = S.C, sec = C.mfg;
  const card = S.col(null, { name: "card/En attente", w: 810, stroke: C.border, radius: 10, fill: C.card, clip: true });
  const h = S.row(card, { fx: true, h: 44, pad: [0, 16], gap: 8 }); S.icon(h, "pause", 15, sec); S.txt(h, "En attente", { size: 14, weight: 600 });
  const k = S.row(h, { pad: [0, 7], radius: 9, fill: C.muted }); S.txt(k, String(S.HOLDS.length), { size: 12, weight: 500, mono: true, color: sec });
  S.spacer(h); S.txt(h, "étapes mises de côté, par raison · à reprendre depuis le Planning", { size: 12.5, color: sec });
  for (const g of S.heldGroups()) { const r = S.row2(card, { h: 38, gap: 10 }); S.icon(r, "pause", 13, C.hold);
    const b = S.row(r, { fx: true }); S.txt(b, g.reason, { size: 13, weight: 500 });
    S.txt(r, g.steps.map(x => x.key).join(", "), { size: 12, mono: true, color: sec });
    if (g.dependents) S.txt(r, `· ${g.dependents} en dépendent`, { size: 12, color: sec });
    S.icon(r, "chevRight", 13, C.dim); }
  return card; };
S.ACT29 = { "SILO-45": "Mise en attente · Règle de fusion à valider p…", "SILO-33": "Mise en attente · Serveur MinIO de recette i…",
  "SILO-82": "Mise en attente · Serveur MinIO de recette i…" };
S.draw29k["a-vue"] = (f) => { const C = S.C, sec = C.mfg;
  const kpis = S.named(f, "kpis"), cells = S.shown(kpis).filter(c => c.name !== "vline"), fc = cells[0], oc = cells[2];
  S.setText(fc, "3", "4");
  const sub = S.parentOf(fc, S.byText(fc, "2 à risque")); for (const c of [...sub.children]) c.remove();
  S.icon(sub, "pause", 12, C.hold); S.txt(sub, `${S.HOLDS.length} en attente`, { size: 12, weight: 500, color: C.hold });
  S.setText(oc, "2", "1"); S.setText(oc, "limite · bloquée : F6", "bloquée : F6");
  const sp = S.named(f, "card / Sprint S42 · Saisie hors ligne");
  const note = S.rowOf(sp, "Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5."), shown = S.shown(sp), ni = shown.findIndex(c => c.id === note.id);
  shown[ni - 1].remove(); note.remove();
  const r4 = S.rowOf(sp, "Saisir un constat hors ligne"), r5 = S.rowOf(sp, "Envoyer les photos d'un constat");
  S.holdCases(r4, [3]); S.setText(r4, "3/5", "3/4");
  const pill = S.find29(r4, z => z.name === "pill"), pb = S.parentOf(r4, pill); pill.remove(); S.pill(pb, "livrée", C.green, C.greenSoft, "circleCheck");
  S.heldMark(S.parentOf(r4, S.byText(r4, "Saisir un constat hors ligne")), 1);
  S.holdCases(r5, [2, 3, 4]); S.setText(r5, "1/5", "1/2"); S.heldMark(S.parentOf(r5, S.byText(r5, "Envoyer les photos d'un constat")), 3);
  const p5 = S.find29(r5, z => z.name === "pill"), pb5 = S.parentOf(r5, p5); p5.remove(); S.pill(pb5, "en cours", C.blue, C.blueSoft);
  const grid = S.named(f, "grid"), f6 = S.byText(grid, "F6");
  S.byText(grid, "F5").fills = f6.fills;
  const caseAt = (y) => penpotUtils.findShapes(z => z.type === "board" && Math.round(z.y - grid.y) === y && Math.round(z.height) === 12, grid).sort((a, b) => a.x - b.x);
  const row4 = caseAt(40), row5 = caseAt(70), row7 = caseAt(160);
  for (const c of row5.slice(2)) c.remove(); row7[4].remove();
  row5.slice(0, 2).forEach((c, i) => { c.resize(58, c.height); c.x = grid.x + 260 + i * 61; });
  for (const c of row4) c.remove(); S.parentOf(grid, S.byText(grid, "F4")).remove();
  const at = (z) => Math.round(z.y - grid.y), line4 = grid.children.find(z => at(z) === 60 && Math.round(z.height) === 1); line4.remove();
  const full = Math.round(grid.height);
  for (const z of [...grid.children]) { if (z.name === "today" || Math.round(z.height) === full) z.resize(z.width, z.height - 30); else if (at(z) > 60) z.y -= 30; }
  grid.resize(grid.width, grid.height - 30);
  const nx = S.named(f, "card / Prochaine à finir");
  const head = S.rowOf(nx, "Saisir un constat hors ligne"); S.setText(head, "F4", "F5"); S.setText(head, "Saisir un constat hors ligne", "Envoyer les photos d'un constat"); S.setText(head, "3/5", "1/2");
  const nc = S.holdCases(head, []); S.paint(nc[1], nc[3].fills[0].fillColor); S.holdCases(head, [2, 3, 4]);
  const l1 = S.parentOf(nx, S.byText(nx, "Conflits de saisie")), l2 = S.parentOf(nx, S.byText(nx, "Démo client"));
  S.setText(l1, "SILO-45", "SILO-32"); S.setText(l1, "Conflits de saisie", "Route d'envoi des photos"); S.byText(l1, "changements demandés").remove(); l2.remove();
  S.parentOf(nx, S.byText(nx, "Étape suivante")).remove();
  const act = S.named(f, "card / Activité"), base = S.rowOf(act, "PR #22 ouverte"), firstLine = S.shown(act)[1];
  let prev = firstLine;
  for (const h of [...S.HOLDS].reverse()) { const r = base.clone(), l = firstLine.clone();
    S.setText(r, "15:04", "15:10"); S.setText(r, "PR #22 ouverte", S.ACT29[h.key]); S.setText(r, "SILO-32", h.key); S.setText(r, "F5", h.f);
    const icon = r.children.find(z => z.name.startsWith("icon")); icon.remove(); r.insertChild(1, S.icon(null, "pause", 14, sec));
    S.showAfter(act, prev, r); S.showAfter(act, r, l); prev = l; }
  const rows = S.shown(act), keep = rows.findIndex(c => c.id === base.id);
  for (const c of rows.slice(keep + 1)) c.remove();
  const band = S.named(f, "card / Échéances"), body = S.parentOf(f, band);
  const card = S.showAfter(body, band, S.heldCard()); card.layoutChild.horizontalSizing = "fill";
  return f; };

// ---------- Fiche ticket SILO-45 : bandeau « En attente » au-dessus du bandeau PR ----------
S.holdBanner = (h) => { const C = S.C;
  const bn = S.row(null, { name: "hold-banner", pad: [10, 12], gap: 10, radius: 8, fill: C.panel, stroke: C.border });
  S.icon(bn, "pause", 14, C.mfg);
  S.txt(bn, `En attente · ${h.reason} · depuis le ${S.HOLD_DAY}`, { size: 13, weight: 500, fill: true, lh: 1.4 });
  S.btn(bn, "Reprendre", "outline", { sm: true }); return bn; };
S.draw29k["a-fiche"] = (f) => { S.kanbanHolds(f);
  const sheet = S.named(f, "sheet"), pr = S.named(sheet, "tracking-banner"), body = S.parentOf(sheet, pr);
  const bn = S.showBefore(body, pr, S.holdBanner(S.holdOf("SILO-45"))); bn.layoutChild.horizontalSizing = "fill"; return f; };

// ---------- P8c · Mettre en attente : dialogue de 480 px sur le Kanban ----------
S.draw29k["a-dialogue"] = (f) => { const C = S.C, sec = C.mfg, h = S.holdOf("SILO-82");
  S.veil(f).bringToFront();
  const d = S.col(f, { name: "dialog", x: 480, y: 260, w: 480, pad: 24, gap: 18, radius: 12, stroke: C.border, fill: C.bg, shadow: 12 });
  const hd = S.row(d, { fx: true, gap: 12, align: "start" }); const ht = S.col(hd, { fx: true, gap: 6 });
  S.txt(ht, "Mettre SILO-82 en attente", { size: 18, weight: 600 });
  S.txt(ht, "L'étape attend une chose que l'équipe n'a pas encore : un environnement, des accès, une décision du client.", { size: 13, color: sec, fill: true, lh: 1.45 });
  S.icon(hd, "x", 16, sec);
  const fl = S.col(d, { name: "field/Raison", fx: true, gap: 6 }); const lr = S.row(fl, { fx: true }); S.txt(lr, "Raison", { size: 13, weight: 500 }); S.spacer(lr); S.txt(lr, `${Array.from(h.reason).length}/80`, { size: 12, mono: true, color: C.dim });
  S.input(fl, h.reason, { focus: true });
  const sg = S.col(d, { name: "suggestions", fx: true, gap: 8 }); S.txt(sg, "Raisons déjà employées", { size: 12.5, color: sec });
  const sr = S.row(sg, { fx: true, gap: 6, wrap: true }); for (const g of S.heldGroups()) S.btn(sr, g.reason, "outline", { sm: true, icon: "pause", ic: sec });
  const ft = S.row(d, { fx: true, gap: 8, justify: "end", pad: [4, 0, 0, 0] }); S.btn(ft, "Annuler", "outline"); S.btn(ft, "Mettre en attente", "brand");
  d.bringToFront(); return f; };

// ---------- Menus : « ⋯ » de la fiche (Mettre en attente…, Reprendre) et ligne du Planning (Reprendre, Reprendre dans ▸) ----------
S.menu29 = (f, x, y, w, items) => { const C = S.C;
  const m = S.col(f, { name: "menu", x, y, w, pad: 4, gap: 0, radius: 8, stroke: C.border, fill: C.card, shadow: 10 });
  for (const it of items) { if (it === "sep") { const l = S.box(m, { name: "separator", w: 10, h: 9, fx: true, dir: "column", justify: "center", pad: [4, 0] }); S.hline(l, C.border); continue; }
    const r = S.row(m, { name: "item " + it.label, fx: true, h: 30, pad: [0, 8], gap: 8, radius: 5, fill: it.on ? C.hover : null });
    const tone = it.danger ? C.red : C.fg; if (it.icon) S.icon(r, it.icon, 14, it.danger ? C.red : C.mfg);
    S.txt(r, it.label, { size: 13, color: tone }); if (it.chev) { S.spacer(r); S.icon(r, "chevRight", 14, C.mfg); } }
  m.bringToFront(); return m; };
S.ficheMenu = (f, hold) => { const sheet = S.named(f, "sheet"), more = S.find29(sheet, z => z.name.startsWith("icon") && z.name.endsWith("more"));
  const x = Math.round(more.x - f.x + more.width - 224), y = Math.round(more.y - f.y + more.height + 8);
  return S.menu29(f, x, y, 224, [{ label: "Ouvrir dans un onglet", icon: "maximize" }, { label: "Copier la clé", icon: "copy" },
    hold ? { label: "Reprendre", icon: "play", on: true } : { label: "Mettre en attente…", icon: "pause", on: true }, "sep", { label: "Supprimer…", icon: "trash", danger: true }]); };
S.draw29k["a-fiche-menu"] = (f) => { S.ficheMenu(f, false); return f; };
S.draw29k["a-fiche-menu-reprendre"] = (f) => { S.ficheMenu(f, true); return f; };
S.draw29k["a-planning-menu"] = (f) => { const row = S.named(f, "held SILO-45"), more = S.find29(row, z => z.name.startsWith("icon") && z.name.endsWith("more"));
  const x = Math.round(more.x - f.x - 4), y = Math.round(more.y - f.y + more.height + 6);
  S.menu29(f, x, y, 200, [{ label: "Reprendre", icon: "play" }, { label: "Reprendre dans", icon: "sprint", chev: true, on: true }]);
  S.menu29(f, x + 200 + 4, y + 34, 220, [{ label: "S43 · Import et contrats", on: true }, { label: "S44 · Rapports" }]);
  return f; };

// ---------- Dessin (export : 90-export.js, S.export29) ----------
// Un texte changé garde son rendu tant que sa police n'est pas réappliquée (l'export et le canevas montrent l'ancien texte).
S.refont = (t) => { const f = penpot.fonts.findById(t.fontId) || penpot.fonts.findByName(t.fontFamily), w = String(t.fontWeight), st = t.fontStyle || "normal";
  if (!f || [w, st, String(t.fontSize)].includes("mixed")) return t;
  const v = f.variants.find(x => x.fontWeight === w && x.fontStyle === st) || f.variants[0], size = t.fontSize, fills = t.fills, lh = t.lineHeight, ls = t.letterSpacing;
  f.applyToText(t, v); t.fontSize = size; t.fills = fills; if (lh && lh !== "mixed") t.lineHeight = lh; if (ls && ls !== "mixed") t.letterSpacing = ls; return t; };
S.withRefont = async (draw) => { const set = S.setText, touched = [];
  S.setText = (...a) => { const t = set(...a); touched.push(t); return t; };
  try { await draw(); } finally { S.setText = set; }
  let n = 0; for (const t of touched) { try { S.refont(t); n++; } catch (e) { } } return n; };
S.draw29 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS29.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y29 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen(S.SRC29[key], x, y), S.NAMES29[key]);
  const refonts = await S.withRefont(() => S.draw29k[key](f)); await S.wait(400); const moved = S.replace();
  const d = f.children.find(c => c.name === "dialog"); if (d) { await S.wait(1500); d.y = f.y + Math.round((f.height - d.height) / 2); }
  return { board: f.name, shapes: S.count(f), moved, refonts, dialog: d ? d.height : null }; };
return "phase 29 ok";
