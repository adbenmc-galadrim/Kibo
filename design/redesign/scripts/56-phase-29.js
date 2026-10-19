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
  const b = S.row(null, { name: "badge hold", pad: [2, 6], gap: 4, radius: 4, stroke: C.border, dashed: true });
  S.icon(b, "pause", 12, C.mfg); S.txt(b, text, { size: 11, weight: 500, color: C.mfg }); return b; };
S.kanbanHolds = (f) => { const C = S.C, sec = C.mfg;
  for (const h of S.HOLDS) { const card = S.find29(f, s => s.name === "card " + h.key); if (!card) continue;
    const badges = card.children.find(c => c.name === "badges"); S.showFirst(badges, S.holdBadge(S.shortReason(h.reason))); }
  for (const [key, src] of Object.entries(S.HELD_BY)) { const card = S.find29(f, s => s.name === "card " + key); if (!card) continue;
    const badges = card.children.find(c => c.name === "badges"); for (const b of [...badges.children]) b.remove();
    S.showLast(badges, S.holdBadge("attend " + src)); }
  const seg = S.named(f, "filter"), last = S.parentOf(seg, S.byText(seg, "À reprendre"));
  const s = S.row(null, { name: "filter held", pad: [4, 10], gap: 6, radius: 5 });
  S.icon(s, "pause", 12, sec); S.txt(s, "En attente", { size: 12.5, weight: 500, color: sec }); S.txt(s, "5", { size: 11, mono: true, color: C.dim });
  S.showAfter(seg, last, s); return f; };
S.draw29k = {};
S.draw29k["a-kanban"] = (f) => S.kanbanHolds(f);

// ---------- Retouches communes ----------
S.shown = (parent) => [...parent.children].reverse();
S.keepCases = (card, keep, total) => { const segs = S.named(card, "segs"), all = S.shown(segs), gap = segs.flex.columnGap, w = total ? Math.floor((total - (keep.length - 1) * gap) / keep.length) : null;
  all.forEach((c, i) => { if (!keep.includes(i)) c.remove(); else if (w) c.resize(w, c.height); }); return segs; };
S.rowOf = (scope, chars) => { let s = S.byText(scope, chars); while (s && !(s.type === "board" && Math.round(s.width) === Math.round(scope.width))) s = S.parentOf(scope, s); return s; };
S.delivered29 = (card, label) => { const C = S.C, head = S.shown(card)[0], chip = head.children.find(c => c.name === "chip"); if (chip) chip.remove();
  S.icon(head, "circleCheck", 13, C.green); S.txt(head, label, { size: 11.5, color: C.green });
  const title = S.shown(card).find(c => c.type === "text"); if (title) title.fills = [{ fillColor: C.mfg, fillOpacity: 1 }]; return card; };

// ---------- P2 · Planning : « En attente (3) » en pied de « À planifier » ----------
S.heldSection = () => { const C = S.C, sec = C.mfg, groups = S.heldGroups();
  const s = S.col(null, { name: "held", gap: 12, pad: [10, 2, 2, 2] });
  const h = S.row(s, { fx: true, gap: 6 }); S.icon(h, "pause", 14, sec); S.txt(h, `En attente (${S.HOLDS.length})`, { size: 13, weight: 600 });
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
  S.keepCases(f4, [0, 1, 2, 4], 170); S.setText(f4, "3/5 étapes", "3/4 étapes"); S.delivered29(f4, "livrée · 1 en attente");
  S.keepCases(f5, [0, 1], 170); S.setText(f5, "1/5 étapes", "1/2 étapes");
  S.keepCases(f7, [0, 1, 2, 3], 170); S.setText(f7, "0/5 étapes", "0/4 étapes");
  S.parentOf(s42, S.byText(s42, "F4 ne tiendra pas : 1 étape restante")).remove();
  S.setText(s42, "F5 ne tiendra pas : 4 étapes restantes", "F5 ne tiendra pas : 1 étape restante");
  const sp = S.showLast(res, S.box(null, { name: "spacer", w: 10, h: 10 })); sp.layoutChild.verticalSizing = "fill"; sp.layoutChild.horizontalSizing = "fill";
  const held = S.showLast(res, S.heldSection()); held.layoutChild.horizontalSizing = "fill";
  return f; };

// ---------- P3 · Fonctionnalité F5 : étapes actives, puis « En attente · 3 » ----------
S.heldStep = (p, st, own) => { const C = S.C, sec = C.mfg;
  const r = S.row(p, { name: "held step " + st.key, fx: true, gap: 14, align: "start" });
  const n = S.box(r, { w: 28, h: 28, radius: 14, fill: C.muted, stroke: C.border, dir: "row", align: "center", justify: "center" }); S.icon(n, "pause", 13, sec);
  const c = S.col(r, { fx: true, pad: [10, 14], gap: 7, radius: 8, stroke: C.border });
  const a = S.row(c, { fx: true, gap: 8 }); S.txt(a, st.title, { size: 14, weight: 500, color: C.mfg }); S.txt(a, st.key, { size: 12, mono: true, color: C.dim });
  S.spacer(a); const stt = S.row(a, { gap: 6 }); S.status(stt, st.status, 8); S.txt(stt, st.status, { size: 12.5, color: sec });
  const b = S.row(c, { fx: true, gap: 6 });
  if (own) { S.icon(b, "pause", 12, sec); S.txt(b, `${own.reason} · depuis le ${S.HOLD_DAY}`, { size: 12.5, color: sec }); S.spacer(b); S.btn(b, "Reprendre", "outline", { sm: true }); }
  else { S.icon(b, "link", 12, sec); S.txt(b, "attend " + st.waits, { size: 12.5, color: sec }); }
  return r; };
S.activityRow = (icon, color, text, time) => { const C = S.C;
  const r = S.row(null, { name: "box", h: 29, pad: [7, 14], gap: 9 }); S.icon(r, icon, 13, color);
  S.txt(r, text, { size: 12, fill: true }); S.txt(r, time, { size: 11, mono: true, color: C.dim }); return r; };
S.draw29k["a-fonctionnalite"] = (f) => { const C = S.C, sec = C.mfg;
  const bar = S.parentOf(f, S.byText(f, "1 étape livrée sur 5")); const segs = bar.children.find(c => c.name === "segs");
  S.shown(segs).forEach((c, i) => { if (i > 1) c.remove(); }); S.setText(bar, "1 étape livrée sur 5", "1 étape livrée sur 2 · 3 en attente");
  S.setText(f, "4 étapes restantes : ne tiendra pas dans S42.", "1 étape restante : ne tiendra pas dans S42.");
  const tl = S.find29(f, z => z.type === "board" && Math.round(z.x - f.x) === 269 && Math.round(z.y - f.y) === 351 && Math.round(z.width) === 795);
  const rows = S.shown(tl); for (const r of rows.slice(2)) r.remove();
  const rail = S.find29(rows[1], z => z.type === "board" && Math.round(z.width) === 2); if (rail) rail.remove();
  const content = S.parentOf(f, tl);
  const sec29 = S.col(null, { name: "held steps", gap: 12, pad: [6, 0, 0, 0] });
  const steps = [{ key: "SILO-33", title: "Écran d'envoi hors ligne", status: "En cours" }, { key: "SILO-34", title: "Tests E2E de l'envoi", status: "À faire" }, { key: "SILO-35", title: "Démo client", status: "À faire" }];
  const h = S.row(sec29, { fx: true, gap: 10, h: 25 }); S.icon(h, "pause", 15, C.fg); S.txt(h, `En attente · ${steps.length}`, { size: 15, weight: 600 });
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
  for (const g of S.heldGroups()) { const r = S.row2(card, { h: 38, gap: 10 }); S.icon(r, "pause", 13, sec);
    const b = S.row(r, { fx: true }); S.txt(b, g.reason, { size: 13, weight: 500 });
    S.txt(r, g.steps.map(x => x.key).join(", "), { size: 12, mono: true, color: sec });
    if (g.dependents) S.txt(r, `· ${g.dependents} en dépendent`, { size: 12, color: sec });
    S.icon(r, "chevRight", 13, C.dim); }
  return card; };
S.draw29k["a-vue"] = (f) => { const C = S.C, sec = C.mfg;
  const kpis = S.named(f, "kpis"), cells = S.shown(kpis).filter(c => c.name !== "vline"), fc = cells[0], oc = cells[2];
  S.setText(fc, "3", "4");
  const sub = S.parentOf(fc, S.byText(fc, "2 à risque")); for (const c of [...sub.children]) c.remove();
  S.icon(sub, "pause", 12, sec); S.txt(sub, `${S.HOLDS.length} en attente`, { size: 12, weight: 500, color: sec });
  S.setText(oc, "2", "1"); S.setText(oc, "limite · bloquée : F6", "bloquée : F6");
  const sp = S.named(f, "card / Sprint S42 · Saisie hors ligne");
  const note = S.rowOf(sp, "Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5."), shown = S.shown(sp), ni = shown.findIndex(c => c.id === note.id);
  shown[ni - 1].remove(); note.remove();
  const r4 = S.rowOf(sp, "Saisir un constat hors ligne"), r5 = S.rowOf(sp, "Envoyer les photos d'un constat");
  S.keepCases(r4, [0, 1, 2, 4]); S.setText(r4, "3/5", "3/4");
  const pill = S.find29(r4, z => z.name === "pill"), pb = S.parentOf(r4, pill); pill.remove(); S.pill(pb, "livrée", C.green, C.greenSoft, "circleCheck");
  const tb = S.parentOf(r4, S.byText(r4, "Saisir un constat hors ligne")); const hb = S.row(tb, { name: "held", gap: 3, pad: [0, 0, 0, 6] }); S.icon(hb, "pause", 11, C.dim); S.txt(hb, "1", { size: 11.5, mono: true, color: C.dim });
  S.keepCases(r5, [0, 1]); S.setText(r5, "1/5", "1/2");
  const grid = S.named(f, "grid"), f6 = S.byText(grid, "F6");
  const f4 = S.byText(grid, "F4"); f4.fills = f6.fills;
  const caseAt = (y) => penpotUtils.findShapes(z => z.type === "board" && Math.round(z.y - grid.y) === y && Math.round(z.height) === 12, grid).sort((a, b) => a.x - b.x);
  const row4 = caseAt(40), row5 = caseAt(70), row7 = caseAt(160);
  row4[4].x = row4[3].x; row4[3].remove(); for (const c of row5.slice(2)) c.remove(); row7[4].remove();
  const nx = S.named(f, "card / Prochaine à finir");
  const head = S.rowOf(nx, "Saisir un constat hors ligne"); S.setText(head, "F4", "F5"); S.setText(head, "Saisir un constat hors ligne", "Envoyer les photos d'un constat"); S.setText(head, "3/5", "1/2"); S.keepCases(head, [0, 3]);
  const l1 = S.parentOf(nx, S.byText(nx, "Conflits de saisie")), l2 = S.parentOf(nx, S.byText(nx, "Démo client"));
  S.setText(l1, "SILO-45", "SILO-32"); S.setText(l1, "Conflits de saisie", "Route d'envoi des photos"); S.byText(l1, "changements demandés").remove(); l2.remove();
  S.setText(nx, "/full-delivery SILO-45", "/full-delivery SILO-32");
  const act = S.named(f, "card / Activité"), base = S.rowOf(act, "PR #22 ouverte"), firstLine = S.shown(act)[1];
  let prev = firstLine;
  for (const h of [...S.HOLDS].reverse()) { const r = base.clone(), l = firstLine.clone();
    S.setText(r, "15:04", "15:10"); S.setText(r, "PR #22 ouverte", S.shortReason(`${h.key} en attente · ${h.reason}`, 40)); S.setText(r, "SILO-32", h.key); S.setText(r, "F5", h.f);
    const icon = r.children.find(z => z.name.startsWith("icon")); icon.remove(); r.insertChild(1, S.icon(null, "pause", 14, sec));
    S.showAfter(act, prev, r); S.showAfter(act, r, l); prev = l; }
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
S.draw29 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS29.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y29 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen(S.SRC29[key], x, y), S.NAMES29[key]);
  await S.draw29k[key](f); await S.wait(400); const moved = S.replace();
  const d = f.children.find(c => c.name === "dialog"); if (d) { await S.wait(1500); d.y = f.y + Math.round((f.height - d.height) / 2); }
  return { board: f.name, shapes: S.count(f), moved, dialog: d ? d.height : null }; };
return "phase 29 ok";
