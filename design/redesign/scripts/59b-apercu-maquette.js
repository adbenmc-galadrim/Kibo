// Plein écran des maquettes de la fiche ticket (spec §44.8, demande du 2026-10-20) : P8f (fiche défilée jusqu'à la section « Maquettes »)
// et P8g (vue plein écran, cadre à l'échelle 1). Rangées après P5e, sombre à x = 0, clair à x = 1 540.
const S = storage;
Object.assign(S.ICONS, {
  maximize2: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
  frame: '<line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/>',
  minusSm: '<path d="M5 12h14"/>' });
S.Y_AP = S.Y_GR + S.STEP27 * S.ROWS_GR.length;
S.ROWS_AP = ["ap-fiche", "ap-plein-ecran"];
S.NAMES_AP = { "ap-fiche": "P8f · Fiche ticket, Maquettes", "ap-plein-ecran": "P8g · Maquette en plein écran" };
S.FILES_AP = { "P8f · Fiche ticket, Maquettes": "fiche-ticket-maquettes", "P8g · Maquette en plein écran": "apercu-maquette" };
S.FRAME_AP = { name: "Conflit de saisie", w: 444, h: 960, key: "SILO-45", provider: "Figma" };
S.drawAPk = {};

// ---------- Le cadre Figma « Conflit de saisie » : écran mobile de l'app Silo, mêmes couleurs en sombre et en clair ----------
S.APP_AP = { bg: "#FFFFFF", ink: "#0F172A", grey: "#64748B", line: "#E2E8F0", soft: "#F1F5F9", photo: "#E2E8F0", blue: "#2563EB", blueSoft: "#EFF6FF", outline: "#CBD5E1" };
S.CARDS_AP = [
  { y: 140, title: "Version hors ligne · 14:02", state: "Occupé", photos: 3, note: "Cadenas changé", recent: true },
  { y: 396, title: "Version du serveur · 13:47", state: "Libre", photos: 2, note: null } ];
S.stackAP = (shapes) => { for (const s of shapes) s.bringToFront(); };
S.frameAP = (p, w, h, o = {}) => { const A = S.APP_AP, k = w / S.FRAME_AP.w, z = (v) => Math.round(v * k * 100) / 100, made = [];
  const f = S.box(p, { name: o.name || "cadre", x: o.x, y: o.y, w, h, fill: A.bg, clip: true });
  const keep = (s) => { made.push(s); return s; };
  const r = (x, y, ww, hh, st = {}) => keep(S.box(f, { name: st.name || "box", x: z(x), y: z(y), w: z(ww), h: z(hh), fill: st.fill, stroke: st.stroke, sw: (st.sw || 1) * k, radius: st.radius ? z(st.radius) : 0 }));
  const t = (chars, x, y, size, st = {}) => keep(S.txt(f, chars, { x: z(x), y: z(y), size: z(size), weight: st.weight || 400, color: st.color || A.ink, ...(st.w ? { w: z(st.w), align: "center" } : {}) }));
  t("14:02", 28, 14, 15, { weight: 600 });
  [5, 8, 11, 14].forEach((bh, i) => r(352 + i * 6, 28 - bh, 4, bh, { name: "signal", fill: A.ink, radius: 1 }));
  r(386, 15, 28, 14, { name: "battery", stroke: A.ink, radius: 4 }); r(389, 18, 19, 8, { name: "battery level", fill: A.ink, radius: 2 }); r(415, 19, 2, 6, { name: "battery tip", fill: A.ink, radius: 1 });
  t(S.FRAME_AP.name, 20, 62, 24, { weight: 700 });
  t("Deux saisies du constat du box B-114", 20, 100, 15, { color: A.grey });
  for (const c of S.CARDS_AP) { const y = c.y;
    r(20, y, 404, 236, { name: "card", fill: A.bg, stroke: c.recent ? A.blue : A.line, sw: c.recent ? 2 : 1, radius: 14 });
    t(c.title, 36, y + 18, 16, { weight: 600 });
    t("État", 36, y + 59, 13, { color: A.grey });
    const cw = c.state === "Occupé" ? 74 : 56; r(120, y + 54, cw, 26, { name: "state", fill: c.recent ? A.blueSoft : A.soft, radius: 13 });
    t(c.state, 132, y + 59, 13, { weight: 500, color: c.recent ? A.blue : A.grey });
    t("Photos", 36, y + 120, 13, { color: A.grey });
    for (let i = 0; i < c.photos; i++) r(120 + i * 72, y + 96, 64, 64, { name: "photo", fill: A.photo, radius: 8 });
    t(`${c.photos} photos`, 120 + c.photos * 72 + 4, y + 120, 13, { color: A.grey });
    t("Note", 36, y + 186, 13, { color: A.grey });
    if (c.note) t(c.note, 120, y + 184, 15); else r(120, y + 176, 284, 34, { name: "note vide", stroke: A.line, radius: 8 }); }
  r(20, 796, 404, 52, { name: "Garder la plus récente", fill: A.blue, radius: 12 });
  t("Garder la plus récente", 20, 812, 16, { weight: 600, color: "#FFFFFF", w: 404 });
  r(20, 860, 404, 52, { name: "Comparer", fill: A.bg, stroke: A.outline, radius: 12 });
  t("Comparer", 20, 876, 16, { weight: 600, color: A.blue, w: 404 });
  r(155, 940, 134, 5, { name: "home indicator", fill: A.ink, radius: 3 });
  S.stackAP(made); return f; };

// ---------- P8f : fiche de SILO-45, section « Maquettes » ouverte, feuille défilée jusqu'à elle ----------
S.iconBtnAP = (p, icon, sz = 28, isz = 14, color) => { const b = S.box(p, { name: "Button/ghost icon " + icon, w: sz, h: sz, radius: 6, dir: "row", align: "center", justify: "center" }); S.icon(b, icon, isz, color || S.C.fg); return b; };
S.designSectionAP = (fold) => { const C = S.C;
  const sec = S.sec27(fold, "Maquettes", { chev: "chevDown", meta: "1", gap: 10 });
  S.kv(sec, "Maquette", v => { S.icon(v, "frame", 12, C.fg); S.txt(v, S.FRAME_AP.name, { size: 12.5 }); });
  const th = S.box(sec, { name: "vignette", w: 512, h: 288, radius: 6, stroke: C.border, fill: C.muted, clip: true, fx: true });
  S.frameAP(th, 133.2, 288, { x: 189.4, y: 0 });
  const act = S.row(sec, { name: "actions", fx: true, gap: 4 });
  S.iconBtnAP(act, "maximize2"); S.txt(act, S.FRAME_AP.name, { size: 12.5, weight: 500 }); S.spacer(act);
  S.iconBtnAP(act, "refresh");
  for (const label of ["Ouvrir dans Figma", "Retirer"]) { const b = S.row(act, { name: "Button/ghost " + label, h: 28, pad: [0, 8], radius: 6 }); S.txt(b, label, { size: 12, weight: 500 }); }
  const form = S.row(sec, { name: "lier", fx: true, gap: 8 });
  const inp = S.row(form, { name: "input", fx: true, h: 32, pad: [0, 10], radius: 6, stroke: C.border }); S.txt(inp, "Colle l'URL d'un cadre Figma ou d'un board Penpot", { size: 12, color: C.dim });
  const bt = S.btn(form, "Lier un cadre", "outline", { sm: true, pad: [8, 12] }); bt.opacity = 0.5;
  return sec; };
S.drawAPk["ap-fiche"] = (x, y) => { const C = S.C;
  const f = S.rename(S.cloneScreen("P8 · Fiche ticket", x, y), S.NAMES_AP["ap-fiche"]);
  const sheet = S.named(f, "sheet"), fold = S.named(sheet, "folded"), body = S.parentOf(sheet, fold);
  S.find29(fold, z => z.name.replace(/\s/g, "") === "section/Maquettes").remove(); S.designSectionAP(fold);
  const top = sheet.children.find(c => c.id !== body.id && Math.round(c.height) === 52); top.fills = [{ fillColor: C.bg, fillOpacity: 1 }];
  S.lateAP = async () => { body.layoutChild.absolute = true; body.flex.verticalSizing = "auto";
    for (const c of sheet.children) if (c.id !== body.id) c.layoutChild.zIndex = 2; await S.wait(600);
    const shift = Math.max(0, Math.round(body.y + body.height - (sheet.y + sheet.height))); body.y -= shift; await S.wait(600); return shift; };
  return f; };

// ---------- P8g : la vue plein écran, barre de 40 px, visualiseur `muted`, cadre à l'échelle 1, barre de zoom ----------
S.drawAPk["ap-plein-ecran"] = (x, y) => { const C = S.C, F = S.FRAME_AP;
  const f = S.screen(S.NAMES_AP["ap-plein-ecran"], x, y, 1440, 1000); f.fills = [{ fillColor: C.card, fillOpacity: 1 }];
  const bar = S.row(f, { name: "bar", x: 0, y: 0, w: 1440, h: 40, pad: [0, 12], gap: 8, fill: C.card });
  S.chip(bar, F.key, { mono: true, size: 11, pad: [0, 4], weight: 400, color: C.fg });
  S.txt(bar, F.name, { size: 13, weight: 500 });
  S.chip(bar, F.provider, { fill: C.muted, stroke: null, size: 12, pad: [2, 8], radius: 6, color: C.fg });
  S.spacer(bar); S.iconBtnAP(bar, "refresh", 24); S.iconBtnAP(bar, "external", 24);
  const exit = S.row(bar, { name: "Button/ghost Quitter", pad: [5, 10], gap: 6, radius: 6 }); S.icon(exit, "x", 13, C.fg); S.txt(exit, "Quitter le plein écran (Échap)", { size: 12.5, weight: 500 });
  const border = S.box(f, { name: "border-b", x: 0, y: 39, w: 1440, h: 1, fill: C.border }), viewer = S.box(f, { name: "viewer", x: 0, y: 40, w: 1440, h: 960, fill: C.muted });
  const sh = S.box(f, { name: "cadre-ombre", x: 498, y: 40, w: F.w, h: F.h, fill: "#FFFFFF" });
  sh.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: { color: "#000000", opacity: 0.1 } }];
  const cadre = S.frameAP(f, F.w, F.h, { x: 498, y: 40 });
  const zw = 2 + 24 + 2 + 44 + 2 + 24 + 2 + 58 + 2, zb = S.row(f, { name: "zoom", x: 1432 - zw, y: 992 - 28, w: zw, h: 28, gap: 2, pad: 2, radius: 6, fill: C.card, stroke: C.border });
  S.iconBtnAP(zb, "minusSm", 24, 12);
  const pc = S.box(zb, { name: "percent", w: 44, h: 24, dir: "row", align: "center", justify: "center" }); S.txt(pc, "100 %", { size: 11, mono: true });
  S.iconBtnAP(zb, "plus", 24, 12);
  const fit = S.box(zb, { name: "Button/ghost Ajuster", w: 58, h: 24, radius: 6, dir: "row", align: "center", justify: "center" }); S.txt(fit, "Ajuster", { size: 12, weight: 500 }); fit.opacity = 0.5;
  S.stackAP([bar, border, viewer, sh, cadre, zb]); return f; };

// ---------- Dessin, export des boards et du cadre seul ----------
S.drawAP = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_AP.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_AP + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; S.lateAP = null; let f;
  const refonts = await S.withRefont(() => { f = S.drawAPk[key](x, y); }); await S.wait(600); const moved = S.replace();
  const shift = S.lateAP ? await S.lateAP() : null; S.lateAP = null;
  return { board: f.name, shapes: S.count(f), moved, refonts, shift }; };
S.exportAP = async (only) => { await S.page("Proposition"); await S.wait(800); const out = [];
  for (const b of penpot.currentPage.root.children.filter(c => c.type === "board" && c.y >= S.Y_AP)) { const base = b.name.replace(/ \(clair\)$/, ""), file = S.FILES_AP[base];
    if (!file || (only && !only.includes(file))) continue; const c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
    try { out.push(await S.exportPng(c, `proposition-${file}-${/\(clair\)$/.test(b.name) ? "light" : "dark"}.png`)); } finally { c.remove(); } }
  return out; };
S.exportFrameAP = async () => { await S.page("Proposition"); await S.wait(800);
  const b = penpot.currentPage.root.children.find(c => c.name === S.NAMES_AP["ap-plein-ecran"]), c = b.clone(); c.x = -5000; c.y = b.y; await S.wait(10000);
  try { return await S.exportPng(c.children.find(s => s.name === "cadre"), "proposition-apercu-maquette-cadre.png"); } finally { c.remove(); } };
return "apercu maquette ok";
