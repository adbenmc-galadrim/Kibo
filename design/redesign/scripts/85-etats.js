// États issus des choix validés, pour le fichier « Kibo » : le panneau « Recommandé » de chaque choix, en board autonome.
const S = storage;
S.draw = S.draw || {};
S.ETATS = [
  { n: "215", choix: 7, title: "Fiche de sprint, proposition de report" },
  { n: "216", choix: 4, title: "Avertissement 3 sur 2 ouvertes" },
  { n: "217", choix: 5, title: "Démo client facultative" },
  { n: "218", choix: 6, title: "Infobulle du nom complet" } ];
S.recOf = (n) => { const orig = S.choiceBoard; let rec = null; S.choiceBoard = (ch, x, y, r) => { rec = r; return null; };
  try { S.draw["choix-" + n](0, 0); } finally { S.choiceBoard = orig; } return rec; };
S.etatBoard = (e, x, y) => { const C = S.C, { SW, SH } = S.CH;
  const f = S.screen(`${e.n} · ${e.title}`, x, y, SW + 64, SH + 112);
  const root = S.col(f, { name: "content", w: SW + 64, h: SH + 112, pad: [28, 32], gap: 16 });
  const h = S.row(root, { gap: 10 }); S.txt(h, e.n, { size: 12, mono: true, color: C.mfg }); S.txt(h, e.title, { size: 18, weight: 600 });
  const st = S.box(root, { name: "stage", w: SW, h: SH, fill: C.card, stroke: C.border, radius: 12, clip: true });
  S.recOf(e.choix)(st);
  return f; };
for (const e of S.ETATS) S.draw["etat-" + e.n] = (x, y) => S.etatBoard(e, x, y);
return "etats ok";
