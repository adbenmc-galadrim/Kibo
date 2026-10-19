// 0.29.0-alpha.3 (spec §43) : réveil de l'agent de projet sur une réponse, vu dans le panneau Suivi.
// Un board cloné de « Agent · question » (page « Proposition »), rangée après celles de l'alpha 2, sombre à x = 0, clair à x = 1 540.
const S = storage;
Object.assign(S.ICONS, {
  "alarm-clock": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>' });
S.Y_A3 = S.Y_A2 + S.STEP27 * S.ROWS_A2.length;
S.ROWS_A3 = ["p-agent-reveil"];
S.NAMES_A3 = { "p-agent-reveil": "Agent · réveil sur réponse" };
S.WAKE_A3 = { line: "Q16 répondue : « 5 Go »", at: "14:52", text: "Q16 répondue : le quota est de 5 Go par client. Je propose :", read: "Lu : Q16, SILO-34",
  lot: "Lot n° 8", count: "1 action · après réveil", action: "Modifier SILO-34", why: "Quota de 5 Go par client à inscrire dans l'étape.", apply: "Valider (1)" };
S.drawA3k = {};

// ---------- Ligne de réveil : icône, « Qn répondue : « … » », heure à droite ----------
S.wakeLineA3 = (w) => { const C = S.C;
  const r = S.row(null, { name: "wakeup-answer", gap: 6 });
  S.icon(r, "alarm-clock", 13, C.mfg); S.txt(r, w.line, { size: 12, lh: 15 / 12, color: C.mfg }); S.spacer(r); S.txt(r, w.at, { size: 12, lh: 15 / 12, color: C.mfg });
  return r; };
S.rowOfA3 = (lot, text) => S.parentOf(lot, S.parentOf(lot, S.byText(lot, text)));
S.dropRowA3 = (lot, text) => { const r = S.rowOfA3(lot, text), i = S.shownIndex(lot, r), shown = [...lot.children].reverse(), line = shown[i - 1];
  if (line && line.name === "line") line.remove(); r.remove(); };

S.drawA3k["p-agent-reveil"] = (f) => { const w = S.WAKE_A3;
  const q = S.named(f, "user-question"), qrow = S.parentOf(f, q), body = S.parentOf(f, qrow);
  const wake = S.showBefore(body, qrow, S.wakeLineA3(w)); wake.layoutChild.horizontalSizing = "fill"; qrow.remove();
  const said = (start) => S.find29(f, z => z.type === "text" && z.characters.startsWith(start));
  const first = said("Il reste 4 étapes à F5"); S.setText(S.parentOf(f, first), first.characters, w.text);
  said("Je propose de la reporter en S43").remove();
  S.setText(f, "Lu : Planning, F5, journal des étapes", w.read);
  const lot = S.parentOf(f, S.parentOf(f, S.byText(f, "Lot n° 7")));
  S.setText(lot, "Lot n° 7", w.lot); S.setText(lot, "3 actions", w.count);
  S.dropRowA3(lot, "Planifier F9 en S44"); S.dropRowA3(lot, "Relancer le client sur Q14");
  S.setText(lot, "Reporter F5 en S43", w.action); S.setText(lot, "4 étapes restantes, S42 finit aujourd'hui", w.why);
  S.setText(lot, "Valider (3)", w.apply);
  S.parentOf(f, S.byText(f, "1 lot remplacé masqué")).remove();
  return f; };

// ---------- Dessin (export : 90-export.js, S.exportA3) ----------
S.drawA3 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_A3.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_A3 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  S.placed = []; const f = S.rename(S.cloneScreen("Agent · question", x, y), S.NAMES_A3[key]);
  const refonts = await S.withRefont(() => S.drawA3k[key](f)); await S.wait(400); const moved = S.replace();
  return { board: f.name, shapes: S.count(f), moved, refonts }; };
return "alpha 3 reveil ok";
