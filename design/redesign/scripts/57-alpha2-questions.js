// 0.29.0-alpha.2 (spec §42) : menu « ⋯ » de la carte, dialogue de suppression, questions répondues sans transmission.
// Trois boards clonés de « P9 · Questions » (page « Proposition »), rangées après celles de la phase 29, sombre à x = 0, clair à x = 1 540.
const S = storage;
S.draw = S.draw || {};
Object.assign(S.ICONS, {
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  undo2: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>' });
S.Y_A2 = S.Y29 + S.STEP27 * S.ROWS29.length;
S.ROWS_A2 = ["q-menu", "q-supprimer", "q-repondues"];
S.NAMES_A2 = { "q-menu": "P9b · Questions, menu", "q-supprimer": "P9c · Supprimer la question", "q-repondues": "P9d · Questions, répondues" };
S.Q16_A2 = { id: "Q16", title: "Quota par client : 2 Go ou 5 Go ?", answer: "5 Go", by: "Adam", age: "il y a 2 h" };
S.drawA2k = {};

// ---------- Commun : P9 sans aperçu d'export ni toast ----------
S.quietA2 = (f) => { for (const n of ["export-preview", "toast"]) { const s = f.children.find(c => c.name === n); if (s) s.remove(); } return f; };
S.cardA2 = (f) => S.named(f, "question " + S.Q16_A2.id);
S.headA2 = (card) => S.parentOf(card, S.byText(card, S.Q16_A2.id));
S.moreA2 = (card) => S.find29(S.headA2(card), z => z.name.replace(/\s/g, "") === "icon/more");

// ---------- P9b : « ⋯ » enfoncé, menu « Archiver », séparateur, « Supprimer » ----------
S.pressA2 = (f, more) => { const C = S.C, head = S.parentOf(f, more), x = Math.round(more.x - 4 - f.x), y = Math.round(more.y - 4 - f.y);
  S.showAfter(head, more, S.box(null, { name: "more slot", w: 15, h: 15 })); more.remove();
  const bg = S.box(f, { name: "more pressed", x, y, w: 23, h: 23, radius: 6, fill: C.hover, dir: "row", align: "center", justify: "center" });
  S.icon(bg, "more", 15, C.fg); bg.bringToFront(); return bg; };
S.drawA2k["q-menu"] = (f) => { S.quietA2(f); const more = S.moreA2(S.cardA2(f)), mx = more.x - f.x, my = more.y - f.y, w = 176;
  S.pressA2(f, more);
  S.menu29(f, Math.round(mx + more.width + 4 - w), Math.round(my + more.height + 4 + 4), w,
    [{ label: "Archiver", icon: "archive" }, "sep", { label: "Supprimer", icon: "trash", danger: true }]);
  return f; };

// ---------- P9c : dialogue « Supprimer « … » ? » sur fond assombri ----------
S.dangerBtnA2 = (p, label) => { const C = S.C;
  const b = S.row(p, { name: "Button/destructive", fill: C.red, op: S.mode === "dark" ? 0.6 : 1, radius: 6, pad: [7, 14], gap: 6, justify: "center" });
  S.txt(b, label, { size: 13, weight: 500, color: "#FFFFFF" }); return b; };
S.drawA2k["q-supprimer"] = (f) => { const C = S.C, q = S.Q16_A2;
  S.quietA2(f); S.veil(f).bringToFront();
  const d = S.col(f, { name: "dialog", x: Math.round((f.width - 512) / 2), y: 360, w: 512, pad: 24, gap: 16, radius: 10, stroke: C.border, fill: C.bg, shadow: 12 });
  const hd = S.col(d, { fx: true, gap: 6 });
  S.txt(hd, `Supprimer « ${q.title} » ?`, { size: 18, weight: 600, fill: true, lh: 1.35 });
  S.txt(hd, "Suppression définitive, pour tous les membres du projet : la question, sa réponse et son historique. Pour la masquer sans la perdre, archive-la.",
    { size: 14, color: C.mfg, fill: true, lh: 1.45 });
  const ft = S.row(d, { fx: true, gap: 8, justify: "end" }); S.btn(ft, "Annuler", "outline"); S.dangerBtnA2(ft, "Supprimer");
  d.bringToFront(); return f; };

// ---------- P9d : filtre « Répondues », Q16 répondue « 5 Go », sans marque de transmission ----------
S.segOnA2 = (seg, label, on) => { const C = S.C, t = S.byText(seg, label), b = S.parentOf(seg, t);
  b.fills = on ? [{ fillColor: C.bg, fillOpacity: 1 }] : [];
  b.strokes = on ? [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }] : [];
  t.fills = [{ fillColor: on ? C.fg : C.mfg, fillOpacity: 1 }]; S.refont(t); };
S.ghostA2 = (p, icon, label) => { const C = S.C;
  const b = S.row(p, { name: "Button/ghost " + label, h: 24, pad: [0, 8], gap: 5, radius: 6 });
  S.icon(b, icon, 12, C.mfg); S.txt(b, label, { size: 12, weight: 500, color: C.mfg }); return b; };
S.answerBlockA2 = (q) => { const C = S.C;
  const a = S.col(null, { name: "answer", pad: [8, 10], gap: 4, radius: 6, fill: C.muted, op: 0.5 });
  S.txt(a, `Réponse : ${q.answer}`, { size: 12, weight: 500, fill: true });
  S.txt(a, `Répondu par ${q.by} · ${q.age}`, { size: 11, color: C.mfg, fill: true }); return a; };
S.drawA2k["q-repondues"] = (f) => { const C = S.C, q = S.Q16_A2;
  S.quietA2(f);
  const tb = S.named(f, "toolbar"), seg = S.parentOf(tb, S.byText(tb, "Ouvertes")), scope = S.parentOf(tb, seg);
  S.segOnA2(scope, "Ouvertes", false); S.segOnA2(scope, "Répondues", true);
  const tous = S.parentOf(tb, S.byText(tb, "Tous")); S.setText(tous, "3", "2");
  S.parentOf(tb, S.byText(tb, "Produit")).remove();
  const nav = S.named(f, "nav / Questions"); S.setText(nav, "3", "2");
  const list = S.named(f, "list");
  S.parentOf(list, S.byText(list, "1 bloquante en tête · 3 ouvertes")).remove();
  for (const g of ["group SILO-51", "group SILO-81"]) S.named(list, g).remove();
  const card = S.cardA2(f), head = S.headA2(card), more = S.moreA2(card);
  S.parentOf(card, S.parentOf(card, S.byText(card, "Répondre"))).remove();
  S.showBefore(head, more, S.ghostA2(null, "pencil", "Modifier la réponse"));
  S.showBefore(head, more, S.ghostA2(null, "undo2", "Retirer la réponse"));
  head.flex.columnGap = 8;
  const ans = S.showLast(card, S.answerBlockA2(q)); ans.layoutChild.horizontalSizing = "fill";
  return f; };

// ---------- Dessin (export : 90-export.js, S.exportA2) ----------
S.drawA2 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_A2.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_A2 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen("P9 · Questions", x, y), S.NAMES_A2[key]);
  const refonts = await S.withRefont(() => S.drawA2k[key](f)); await S.wait(400); const moved = S.replace();
  const d = f.children.find(c => c.name === "dialog"); if (d) { await S.wait(1500); d.y = f.y + Math.round((f.height - d.height) / 2); }
  return { board: f.name, shapes: S.count(f), moved, refonts, dialog: d ? d.height : null }; };
return "alpha 2 questions ok";
