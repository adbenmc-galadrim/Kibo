// Proposition consolidée : base de la piste A, bande des échéances et « En ce moment » de C, une case par étape (B).
// Un ensemble est une fonctionnalité livrée de A à Z ; ses étapes sont ses sous-tickets, dans l'ordre des dépendances.
// Les sprints sont le plan de livraison : une fonctionnalité est assignée à un sprint.
const S = storage;
S.draw = S.draw || {};
Object.assign(S.ICONS, {
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  sprint: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  grab: '<path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4"/><path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5"/><path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"/>',
  clockAlert: '<path d="M12 6v6l4 2"/><path d="M16 21.16a10 10 0 1 1 5-13.516"/><path d="M20 11.5v6"/><path d="M20 21.5h.01"/>',
});
S.NAV_ICON.Planning = "sprint";
S.PAGES_P = ["Vue d'ensemble", "Planning", "Tickets", "Kanban", "Graphe", "Notes", "Questions"];
S.COUNTS_P = { "Planning": "S42", "Tickets": "24", "Questions": "3" };

// ---------- Données ----------
const T = (key, title, st, o = {}) => ({ key, title, st, ...o });
S.P = {
  sprints: [
    { key: "S41", name: "Accès", dates: "5–9 oct.", state: "Terminé" },
    { key: "S42", name: "Terrain hors ligne", dates: "12–16 oct.", state: "En cours" },
    { key: "S43", name: "Import et soudures", dates: "19–23 oct.", state: "Prévu" },
    { key: "S44", name: "Rapports", dates: "26–30 oct.", state: "Prévu" } ],
  features: [
    { k: "F1", id: "EMIS-1", name: "Se connecter avec Microsoft", sprint: "S41", steps: [T("EMIS-2", "Application Azure", "Terminé"), T("EMIS-3", "Route de connexion", "Terminé"), T("EMIS-4", "Écran de connexion", "Terminé"), T("EMIS-5", "Démo client", "Terminé")] },
    { k: "F2", id: "EMIS-9", name: "Voir ses ISO affectés", sprint: "S41", steps: [T("EMIS-10", "Modèle des affectations", "Terminé"), T("EMIS-11", "Périmètre côté serveur", "Terminé"), T("EMIS-12", "Règles de synchro", "Terminé"), T("EMIS-13", "Liste des ISO", "Terminé"), T("EMIS-14", "Démo client", "Terminé")] },
    { k: "F3", id: "EMIS-17", name: "Réaffecter un ISO", sprint: "S42", deps: ["F2"], steps: [T("EMIS-18", "Historique des affectations", "Terminé"), T("EMIS-19", "Route de réaffectation", "Terminé"), T("EMIS-20", "Écran de réaffectation", "Terminé"), T("EMIS-21", "Démo client", "Terminé", { git: "merged", ref: "#18", step: 11 })] },
    { k: "F4", id: "EMIS-40", name: "Saisir un tronçon hors ligne", sprint: "S42", deps: ["F2"], result: "Sans réseau, un chef de chantier saisit un tronçon ; la saisie remonte seule au retour du réseau.",
      steps: [T("EMIS-41", "Schéma local des tronçons", "Terminé", { git: "merged", ref: "#12", step: 11 }), T("EMIS-42", "Formulaire de saisie", "Terminé", { git: "merged", ref: "#14", step: 11 }), T("EMIS-43", "Synchro au retour du réseau", "Terminé", { git: "merged", ref: "#16", step: 11 }),
        T("EMIS-45", "Conflits de saisie", "En review", { git: "changes", ref: "#20", ci: "ko", step: 9, live: true }), T("EMIS-46", "Démo client", "À faire")] },
    { k: "F5", id: "EMIS-30", name: "Envoyer les photos d'un tronçon", sprint: "S42", late: true, deps: ["F3"],
      result: "Sur le terrain, sans réseau, un chef de chantier photographie un tronçon. Les photos partent seules au retour du réseau et apparaissent dans le dossier de l'affaire.",
      steps: [T("EMIS-31", "Stockage des photos sur MinIO", "Terminé", { git: "merged", ref: "#19", ci: "ok", step: 11, at: "hier 18:22" }), T("EMIS-32", "Route d'envoi des photos", "En review", { git: "pr", ref: "#22", ci: "ok", step: 10, at: "15:04" }),
        T("EMIS-33", "Écran d'envoi hors ligne", "En cours", { git: "branch", ref: "feat/envoi-hors-ligne", step: 7, live: true, at: "14:51" }), T("EMIS-34", "Tests E2E de l'envoi", "À faire", { ref: "attend EMIS-33" }), T("EMIS-35", "Démo client", "À faire", { ref: "attend EMIS-34" })] },
    { k: "F6", id: "EMIS-50", name: "Importer les ISO depuis Excel", sprint: "S43", blocked: "Q14", deps: ["F2"], steps: [T("EMIS-51", "Lecture du fichier Excel", "Bloqué", { ref: "attend Q14", step: 3 }), T("EMIS-52", "Contrôle des repères", "À faire"), T("EMIS-53", "Écran d'import", "À faire"), T("EMIS-54", "Démo client", "À faire")] },
    { k: "F8", id: "EMIS-70", name: "Valider les soudures par lot", sprint: "S43", deps: ["F4"], steps: [T("EMIS-71", "Statuts de soudure", "À faire"), T("EMIS-72", "Sélection multiple", "À faire"), T("EMIS-73", "Validation par lot", "À faire"), T("EMIS-74", "Démo client", "À faire")] },
    { k: "F7", id: "EMIS-80", name: "Rapport de chantier journalier", sprint: "S44", deps: ["F4", "F5"], steps: [T("EMIS-81", "Modèle du rapport", "À faire"), T("EMIS-82", "Génération PDF", "À faire"), T("EMIS-83", "Photos dans le rapport", "À faire"), T("EMIS-84", "Envoi le soir", "À faire"), T("EMIS-85", "Démo client", "À faire")] },
    { k: "F9", id: "EMIS-90", name: "Exporter le dossier client", sprint: null, deps: ["F7"], steps: [T("EMIS-91", "Format du dossier", "À faire"), T("EMIS-92", "Archive ZIP", "À faire"), T("EMIS-93", "Démo client", "À faire")] } ],
  other: T("EMIS-61", "Passage à Expo SDK 54", "En review", { git: "pr", ref: "#23", ci: "run" }),
  questions: [
    { id: "Q14", text: "Un ISO réaffecté garde-t-il ses photos ?", ticket: "EMIS-51", f: "F6", to: "Client", age: "il y a 3 j", blocking: true },
    { id: "Q16", text: "Quota par affaire : 2 Go ou 5 Go ?", ticket: "EMIS-34", f: "F5", to: "Produit", age: "hier" },
    { id: "Q17", text: "Un rapport par chef de chantier ou par affaire ?", ticket: "EMIS-81", f: "F7", to: "Client", age: "il y a 2 h" } ],
  activity: [
    { t: "15:04", icon: "pr", color: "purple", text: "PR #22 ouverte", tk: "EMIS-32", f: "F5", res: "En review" },
    { t: "14:51", icon: "flag", text: "Étape 7 · Porte qualité", tk: "EMIS-33", f: "F5" },
    { t: "14:40", src: "agent", icon: "bot", text: "Suivi mis à jour · lot n° 7 proposé" },
    { t: "14:36", icon: "merge", color: "green", text: "PR #18 fusionnée · F3 livrée", tk: "EMIS-21", f: "F3", res: "Terminé" },
    { t: "13:47", icon: "pr", color: "amber", text: "Changements demandés sur PR #20", tk: "EMIS-45", f: "F4" },
    { t: "11:58", icon: "circleX", color: "red", text: "CI rouge sur PR #20", tk: "EMIS-45", f: "F4" } ],
  lot: [
    { icon: "sprint", text: "Reporter F5 en S43", meta: "4 étapes restantes, S42 finit aujourd'hui" },
    { icon: "sprint", text: "Planifier F9 en S44", meta: "seule fonctionnalité à planifier" },
    { icon: "question", text: "Relancer le client sur Q14", meta: "bloque F6, prévue en S43" } ],
};
S.feat = (k) => S.P.features.find(f => f.k === k);
S.allTickets = () => S.P.features.flatMap(f => f.steps.map(t => ({ ...t, f: f.k })));
S.fDone = (f) => f.steps.filter(t => t.st === "Terminé").length;
S.fState = (f) => S.fDone(f) === f.steps.length ? "Livrée" : f.steps.some(t => t.st !== "À faire" && t.st !== "Bloqué") ? "Ouverte" : f.blocked ? "Bloquée" : "À faire";
S.caseColor = (st) => st === "Terminé" ? S.C.fg : st === "À faire" ? S.C.track : S.statusColor(st);
S.fCases = (p, f, o = {}) => S.segs(p, f.steps.map(t => S.caseColor(t.st)), { w: o.w || 14, h: o.h || 6, gap: o.gap ?? 3, radius: o.r ?? 1.5 });
S.fChip = (p, k, o = {}) => { const C = S.C; const c = S.row(p, { name: "fchip", pad: [1, 6], gap: 4, radius: 4, stroke: C.border });
  S.icon(c, "package", 11, C.dim); S.txt(c, o.name ? `${k} · ${S.feat(k).name}` : k, { size: 10.5, weight: 500, color: C.mfg, mono: !o.name }); return c; };
S.sprintChip = (p, key, o = {}) => { const C = S.C; const cur = key === "S42";
  const c = S.row(p, { name: "sprint", pad: [1, 6], gap: 4, radius: 4, fill: cur ? C.muted : null, stroke: C.border });
  S.icon(c, "sprint", 11, cur ? C.fg : C.dim); S.txt(c, key || "À planifier", { size: 10.5, weight: 500, mono: !!key, color: cur ? C.fg : C.mfg }); return c; };
S.lateChip = (p, text) => S.chip(p, text || "en retard", { icon: "clockAlert", ic: S.C.red, color: S.C.red, stroke: null, fill: S.C.redSoft, size: 10.5 });
S.shellP = (f, active, o = {}) => { const C = S.C;
  const root = S.box(f, { name: "root", w: 1440, h: f.height, dir: "row", align: "stretch" });
  S.sidebar(root, active, { pages: S.PAGES_P, counts: S.COUNTS_P });
  const main = S.col(root, { name: "main", fx: true, fy: true });
  S.topbar(main, o.crumbs || ["Emis", active], t => { S.syncChip(t); if (o.right) o.right(t); S.agentButton(t, o.agentOn ? { on: true } : { count: "3" }); });
  return { root, main }; };

// ---------- P1 · Vue d'ensemble ----------
S.draw["p-vue"] = (x, y) => { const C = S.C, P = S.P;
  const f = S.screen("P1 · Vue d'ensemble", x, y, 1440, 1100);
  const { root, main } = S.shellP(f, "Vue d'ensemble", { agentOn: true, right: t => S.btn(t, "Nouveau ticket", "outline", { sm: true, icon: "plus" }) });
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24], gap: 14 });
  const hd = S.row(body, { fx: true, gap: 12 });
  const ht = S.col(hd, { gap: 4 }); S.txt(ht, "Emis", { size: 22, weight: 600 });
  const hs = S.row(ht, { gap: 6 }); S.txt(hs, "Suivi de chantier", { size: 12.5, color: C.mfg }); S.txt(hs, "·", { color: C.faint }); S.icon(hs, "github", 12, C.dim); S.txt(hs, "galadrimteam/emis-suivi-chantier", { size: 12, mono: true, color: C.dim });
  S.spacer(hd);
  // Indicateurs
  const k = S.row(body, { name: "kpis", fx: true, h: 86, stroke: C.border, radius: 8, fill: C.card, align: "stretch" });
  const kpi = (icon, label, value, unit, sub, w) => { const c = S.col(k, { fx: !w, w, pad: [12, 16], gap: 6 });
    const l = S.row(c, { gap: 6 }); S.icon(l, icon, 13, C.dim); S.txt(l, label, { size: 12, color: C.mfg });
    const v = S.row(c, { gap: 6, align: "end" }); S.txt(v, value, { size: 22, weight: 600 }); if (unit) S.txt(v, unit, { size: 12, color: C.dim }); if (sub) sub(c); return c; };
  kpi("package", "Fonctionnalités livrées", "3", "sur 9", c => S.segs(c, P.features.map(ft => { const s = S.fState(ft); return s === "Livrée" ? C.green : s === "Ouverte" ? C.blue : C.track; }), { w: 18, h: 6, gap: 3, radius: 1.5 }), 230);
  S.vline(k, C.soft);
  kpi("sprint", "Sprint en cours", "S42", null, c => S.txt(c, "finit ce soir", { size: 11.5, color: C.dim }));
  S.vline(k, C.soft);
  kpi("target", "Ouvertes", "2", "/ 2 max", c => { const r = S.row(c, { gap: 6 }); S.dot(r, C.amber, 6); S.txt(r, "limite atteinte", { size: 11.5, color: C.dim }); });
  S.vline(k, C.soft);
  kpi("pr", "En review", "3", "PR", c => S.txt(c, "#20 #22 #23", { size: 11.5, color: C.dim }));
  S.vline(k, C.soft);
  kpi("question", "Questions", "3", "ouvertes", c => { const r = S.row(c, { gap: 6 }); S.dot(r, C.red, 6); S.txt(r, "Q14 bloque F6", { size: 11.5, color: C.dim }); });
  // En ce moment (piste C)
  const live = S.col(body, { fx: true, stroke: C.brandLine, radius: 8, fill: C.brandSoft, pad: [3, 0] });
  for (const [fk, tk, since] of [["F5", "EMIS-33", "depuis 42 min"], ["F4", "EMIS-45", "depuis 18 min"]]) { const t = S.feat(fk).steps.find(s => s.key === tk);
    const r = S.row(live, { fx: true, pad: [7, 14], gap: 10 }); S.halo(r, C.brand, 7); S.txt(r, "En ce moment", { size: 11.5, weight: 600, color: C.brandText });
    S.fChip(r, fk); S.txt(r, `${tk} · ${t.title}`, { size: 12.5 }); S.spacer(r);
    S.segs(r, S.stepColors(t.step), { w: 4, h: 10, gap: 1.5, radius: 1 }); S.txt(r, S.stepLabel(t.step), { size: 12, color: C.mfg }); S.txt(r, `T3 Code · ${since}`, { size: 11.5, color: C.dim }); }
  // Bande des échéances (piste C) : sprints en colonnes, fonctionnalités en barres.
  S.bandP(body);
  const cols = S.row(body, { fx: true, gap: 14, align: "start" });
  const left = S.col(cols, { fx: true, gap: 14 });
  const sp = S.card(left, "Sprint S42 · Terrain hors ligne", "sprint", { right: h => { S.txt(h, "12–16 oct.", { size: 12, color: C.dim }); S.chip(h, "2/2 ouvertes", { size: 10.5, color: C.amber, stroke: null, fill: C.amberSoft }); } });
  for (const fk of ["F3", "F4", "F5"]) { const ft = S.feat(fk), r = S.cardRow(sp, { gap: 10 }), done = S.fDone(ft);
    S.txt(r, fk, { size: 12, mono: true, color: C.mfg }); S.fillX(S.txt(r, ft.name, { size: 13, color: done === ft.steps.length ? C.mfg : C.fg }));
    if (ft.late) S.lateChip(r); S.fCases(r, ft, { w: 12 }); const n = S.row(r, { w: 70, justify: "end" });
    if (done === ft.steps.length) { S.icon(n, "circleCheck", 13, C.green); S.txt(n, "livrée", { size: 12, color: C.green }); } else S.txt(n, `${done}/${ft.steps.length} étapes`, { size: 12, color: C.dim }); }
  { const r = S.cardRow(sp, { gap: 8 }); S.icon(r, "target", 13, C.dim); S.txt(r, "Limite de 2 fonctionnalités ouvertes atteinte : F6 attendra la fin de F4 ou de F5.", { size: 12, color: C.dim, fill: true }); }
  // Prochaine à finir
  const nx = S.col(left, { fx: true, stroke: C.border, radius: 8, fill: C.card, pad: [12, 14], gap: 10 });
  const nh = S.row(nx, { fx: true, gap: 8 }); S.icon(nh, "flag", 14, C.mfg); S.txt(nh, "Prochaine à finir", { size: 13, weight: 600 }); S.spacer(nh); S.txt(nh, "la plus avancée du sprint", { size: 12, color: C.dim });
  const nr = S.row(nx, { fx: true, gap: 10 }); S.txt(nr, "F4", { size: 12, mono: true, color: C.mfg }); S.txt(nr, "Saisir un tronçon hors ligne", { size: 14, weight: 500 }); S.fCases(nr, S.feat("F4"), { w: 22, h: 7 }); S.txt(nr, "3/5", { size: 12, mono: true, color: C.dim });
  const nb = S.row(nx, { fx: true, gap: 10 }); S.txt(nb, "Reste : EMIS-45 Conflits de saisie (changements demandés), puis EMIS-46 Démo client.", { size: 12.5, color: C.mfg, fill: true });
  const cmd = S.row(nb, { gap: 6, pad: [4, 9], radius: 6, fill: C.muted, stroke: C.border }); S.txt(cmd, "/full-delivery EMIS-45", { size: 11.5, mono: true, color: C.fg }); S.icon(cmd, "copy", 12, C.mfg);
  // Colonne de droite
  const right = S.col(cols, { w: 300, gap: 14 });
  const rv = S.card(right, "En review", "pr", { count: "3" });
  for (const t of [S.feat("F5").steps[1], S.feat("F4").steps[3], P.other]) { const r = S.cardRow(rv, { align: "start", pad: [8, 14] });
    S.icon(r, "pr", 14, S.gitColor(t.git)); const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, `${t.ref} ${t.title}`, { size: 12.5, fill: true });
    const m = S.row(tc, { gap: 5 }); S.txt(m, t.key, { size: 11, mono: true, color: C.dim }); const fk = S.allTickets().find(x => x.key === t.key)?.f; if (fk) S.fChip(m, fk);
    S.gitRef(m, { ci: t.ci }, { short: true }); if (t.git === "changes") S.txt(m, "changements demandés", { size: 11, color: C.amber }); }
  const qs = S.card(right, "Questions", "question", { count: "3" });
  for (const q of P.questions) { const r = S.cardRow(qs, { align: "start", pad: [8, 14] }); const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, q.text, { size: 12.5, fill: true });
    const m = S.row(tc, { gap: 5 }); S.txt(m, `${q.id} · ${q.to} · ${q.age}`, { size: 11, color: C.dim }); S.fChip(m, q.f); if (q.blocking) S.txt(m, "bloquante", { size: 11, color: C.red }); }
  const act = S.card(left, "Activité", "activity", { right: h => { S.chip(h, "git", { size: 10.5 }); S.chip(h, "full-delivery", { size: 10.5 }); } });
  for (const a of P.activity.slice(0, 4)) { const r = S.cardRow(act, { align: "start", pad: [7, 14], gap: 9 });
    S.icon(r, a.icon, 13, a.src === "agent" ? C.brand : a.color ? C[a.color] : C.mfg);
    const tc = S.col(r, { fx: true, gap: 1 }); S.txt(tc, a.text, { size: 12, fill: true, color: a.src === "agent" ? C.brandText : C.fg });
    if (a.tk) { const m = S.row(tc, { gap: 5 }); S.txt(m, a.tk, { size: 10.5, mono: true, color: C.dim }); S.fChip(m, a.f); }
    S.txt(r, a.t, { size: 11, mono: true, color: C.dim }); }
  S.vline(root, C.soft);
  S.agentPanelP(root);
  return f; };

S.bandP = (p) => { const C = S.C, P = S.P;
  const card = S.col(p, { name: "band", fx: true, stroke: C.border, radius: 8, fill: C.card, clip: true });
  const h = S.row(card, { fx: true, h: 36, pad: [0, 14], gap: 8 }); S.icon(h, "calendar", 14, C.mfg); S.txt(h, "Échéances", { size: 13, weight: 600 }); S.txt(h, "fonctionnalités par sprint", { size: 12, color: C.dim }); S.spacer(h);
  for (const [l, col] of [["étapes livrées", C.fg], ["à faire", C.track]]) { const r = S.row(h, { gap: 6 }); S.box(r, { w: 12, h: 6, radius: 2, fill: col }); S.txt(r, l, { size: 11, color: C.dim }); }
  { const r = S.row(h, { gap: 6 }); S.box(r, { w: 12, h: 6, radius: 2, stroke: C.red, dashed: true }); S.txt(r, "glissement", { size: 11, color: C.dim }); }
  S.hline(card, C.soft);
  const W = 806, LW = 236, RH = 28, rows = ["F4", "F5", "F6", "F8", "F7"], cw = (W - LW) / 4, H = 26 + rows.length * RH + 8;
  const g = S.box(card, { name: "grid", w: W, h: H, fx: true });
  ["S42", "S43", "S44", "S45"].forEach((s, i) => { const x = LW + i * cw; S.box(g, { x, y: 0, w: 1, h: H, fill: C.soft });
    const l = S.row(g, { x: x + 8, y: 6, gap: 5 }); S.txt(l, s, { size: 11, weight: 600, mono: true, color: i === 0 ? C.fg : C.mfg }); S.txt(l, ["12 oct.", "19 oct.", "26 oct.", "2 nov."][i], { size: 11, color: C.dim }); });
  S.box(g, { x: 0, y: 24, w: W, h: 1, fill: C.soft });
  const wk = { S42: 0, S43: 1, S44: 2 };
  rows.forEach((k, i) => { const ft = S.feat(k), y = 26 + i * RH, x1 = LW + wk[ft.sprint] * cw + 6, bw = cw - 12;
    const l = S.row(g, { x: 14, y: y + 6, gap: 6, w: LW - 20 }); S.txt(l, k, { size: 11, mono: true, color: C.dim }); S.txt(l, ft.name, { size: 11.5, color: C.fg });
    const done = S.fDone(ft), n = ft.steps.length, sw = (bw - (n - 1) * 3) / n;
    ft.steps.forEach((t, j) => S.box(g, { x: x1 + j * (sw + 3), y: y + 8, w: sw, h: 12, radius: 2, fill: S.caseColor(t.st) }));
    if (ft.late) { S.box(g, { x: x1 + cw, y: y + 8, w: cw * 0.6, h: 12, radius: 2, stroke: C.red, dashed: true }); const t = S.row(g, { x: x1 + cw + cw * 0.6 + 6, y: y + 6, gap: 4 }); S.txt(t, "glisse en S43", { size: 11, color: C.red }); }
    if (ft.blocked) { const t = S.row(g, { x: x1 + bw + 8, y: y + 6, gap: 4 }); S.icon(t, "lock", 11, C.red); S.txt(t, "Q14", { size: 11, color: C.red }); } });
  const tx = LW + 4.5 / 7 * cw; S.box(g, { name: "today", x: tx, y: 22, w: 1.5, h: H - 22, fill: C.fg });
  return card; };

S.agentPanelP = (root) => { const C = S.C;
  const ap = S.col(root, { name: "agent-panel", w: 330, fy: true, fill: C.panel });
  const h = S.row(ap, { fx: true, h: 56, pad: [0, 16], gap: 10 }); S.agentMark(h, 28);
  const ht = S.col(h, { gap: 1 }); S.txt(ht, "Agent de projet", { size: 13, weight: 600 }); S.txt(ht, "Suivi à jour · il y a 4 min", { size: 11.5, color: C.dim });
  S.spacer(h); S.icon(h, "more", 15, C.dim); S.icon(h, "x", 15, C.dim);
  S.hline(ap, C.soft);
  const b = S.col(ap, { fx: true, fy: true, pad: 16, gap: 14 });
  S.txt(b, "Aujourd'hui", { size: 11, weight: 500, color: C.dim, upper: true, ls: 0.4 });
  S.txt(b, "F3 est livrée : 3 fonctionnalités sur 9. S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.", { size: 13, lh: 1.5, fill: true });
  const lot = S.col(b, { fx: true, stroke: C.brandLine, radius: 8, clip: true, fill: C.card });
  const lh = S.row(lot, { fx: true, pad: [9, 12], gap: 8, fill: C.brandSoft }); S.txt(lh, "Lot n° 7 · à valider", { size: 12.5, weight: 600, color: C.brandText }); S.spacer(lh); S.txt(lh, "3 actions", { size: 11.5, color: C.dim });
  for (const it of S.P.lot) { S.hline(lot, C.soft); const r = S.row(lot, { fx: true, pad: [9, 12], gap: 10, align: "start" });
    const cb = S.box(r, { w: 15, h: 15, radius: 4, fill: C.brandBtn, dir: "row", align: "center", justify: "center" }); S.icon(cb, "check", 11, "#FFFFFF", 3);
    const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, it.text, { size: 12.5, fill: true }); S.txt(tc, it.meta, { size: 11, color: C.dim, fill: true }); }
  S.hline(lot, C.soft);
  const lf = S.row(lot, { fx: true, pad: [10, 12], gap: 8 }); S.btn(lf, "Valider (3)", "brand", { sm: true }); S.btn(lf, "Refuser", "outline", { sm: true });
  const note = S.row(b, { fx: true, gap: 8, align: "start" }); S.icon(note, "refresh", 13, C.dim);
  S.txt(note, "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.", { size: 11.5, color: C.dim, lh: 1.45, fill: true });
  S.box(b, { w: 4, h: 4, fy: true });
  const inp = S.row(b, { fx: true, h: 40, pad: [0, 12], gap: 8, radius: 8, stroke: C.border, fill: C.bg }); S.txt(inp, "Demander à l'agent de projet…", { size: 12.5, color: C.dim }); S.spacer(inp); S.icon(inp, "send", 14, C.dim);
  return ap; };

// ---------- P2 · Planning ----------
S.featCard = (p, ft, o = {}) => { const C = S.C, done = S.fDone(ft), n = ft.steps.length, full = done === n;
  const c = S.col(p, { name: "feature " + ft.k, fx: true, pad: [10, 12], gap: 8, radius: 8, fill: o.ghost ? C.card : C.card, stroke: ft.late ? C.red : o.ghost ? C.fg : C.border, shadow: o.ghost ? 6 : 0, vs: "auto" });
  const r = S.row(c, { fx: true, gap: 6 }); S.icon(r, "grip", 13, C.faint); S.txt(r, ft.k, { size: 11, mono: true, color: C.dim }); S.spacer(r);
  if (full) { S.icon(r, "circleCheck", 13, C.green); S.txt(r, "livrée", { size: 11.5, color: C.green }); }
  else if (ft.late) S.lateChip(r, "en retard"); else if (ft.blocked) S.chip(r, "bloquée · " + ft.blocked, { icon: "lock", ic: C.red, color: C.red, stroke: null, fill: C.redSoft, size: 10.5 });
  else if (S.fState(ft) === "Ouverte") S.chip(r, "ouverte", { color: C.blue, stroke: null, fill: C.blueSoft, size: 10.5 });
  S.txt(c, ft.name, { size: 13, weight: 500, fill: true, color: full ? C.mfg : C.fg });
  if (!o.compact) { const sw = Math.floor((o.w - 24 - (n - 1) * 3) / n); S.segs(c, ft.steps.map(t => S.caseColor(t.st)), { w: sw, h: 8, gap: 3, radius: 2 });
    const m = S.row(c, { fx: true, gap: 6 }); S.txt(m, `${done}/${n} étapes`, { size: 11.5, color: C.dim }); S.spacer(m);
    const live = ft.steps.find(t => t.live); if (live) { S.dot(m, C.brand, 6); S.txt(m, live.key, { size: 11, mono: true, color: C.brandText }); }
    else { const nxt = ft.steps.find(t => t.st !== "Terminé"); if (nxt && !full) S.txt(m, "suivante : " + nxt.key, { size: 11, color: C.dim }); } }
  return c; };
S.draw["p-planning"] = (x, y) => { const C = S.C, P = S.P;
  const f = S.screen("P2 · Planning", x, y, 1440, 1000);
  const { main } = S.shellP(f, "Planning");
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24], gap: 14 });
  const hd = S.row(body, { fx: true, gap: 10, align: "end" }); S.txt(hd, "Planning", { size: 22, weight: 600 }); S.txt(hd, "3 fonctionnalités livrées sur 9 · 1 à planifier", { size: 12.5, color: C.dim }); S.spacer(hd);
  S.btn(hd, "Fonctionnalité", "outline", { sm: true, icon: "plus" }); S.btn(hd, "Sprint", "outline", { sm: true, icon: "plus" });
  const lim = S.row(hd, { gap: 6, pad: [5, 10], radius: 6, stroke: C.border }); S.icon(lim, "target", 13, C.amber); S.txt(lim, "Ouvertes : 2 / 2", { size: 12.5, weight: 500 }); S.icon(lim, "chevDown", 12, C.dim);
  const seg = S.row(hd, { pad: 2, radius: 7, fill: C.muted, gap: 2 }); for (const [l, on] of [["Colonnes", true], ["Bandes"]]) { const s = S.row(seg, { pad: [4, 10], radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : C.mfg }); }
  const cols = S.row(body, { name: "sprints", fx: true, fy: true, gap: 12, align: "stretch" });
  const CW = 214;
  const column = (sp) => { const cur = sp && sp.key === "S42", res = !sp;
    const c = S.col(cols, { name: "col " + (sp ? sp.key : "reserve"), w: CW, fy: true, pad: 10, gap: 10, radius: 10, fill: res ? null : cur ? C.card : C.panel, stroke: cur ? C.mfg : C.border, dashed: res });
    const h = S.col(c, { fx: true, gap: 4, pad: [2, 2, 4, 2] }); const a = S.row(h, { fx: true, gap: 6 });
    if (sp) { S.txt(a, sp.key, { size: 13, weight: 600, mono: true }); S.txt(a, sp.name, { size: 13, weight: 600 }); }
    else { S.icon(a, "inbox", 14, C.mfg); S.txt(a, "À planifier", { size: 13, weight: 600 }); }
    const m = S.row(h, { fx: true, gap: 6 });
    if (sp) { S.txt(m, sp.dates, { size: 11.5, color: C.dim }); S.spacer(m);
      const fs = P.features.filter(x => x.sprint === sp.key), d = fs.filter(x => S.fState(x) === "Livrée").length;
      if (sp.state === "Terminé") S.chip(m, "terminé", { icon: "circleCheck", ic: C.green, color: C.green, stroke: null, fill: C.greenSoft, size: 10.5 });
      else if (cur) S.chip(m, "se termine aujourd'hui", { color: C.fg, stroke: null, fill: C.muted, size: 10.5 });
      else S.txt(m, `${fs.length} prévue${fs.length > 1 ? "s" : ""}`, { size: 11.5, color: C.dim });
      if (sp.state !== "Prévu") { const pr = S.row(h, { fx: true, gap: 6 }); S.bar(pr, CW - 110, d / fs.length, { h: 3, color: C.green }); S.txt(pr, `${d}/${fs.length} livrées`, { size: 11, color: C.dim }); } }
    else S.txt(m, "Glisse une fonctionnalité vers un sprint", { size: 11.5, color: C.dim });
    return c; };
  const rc = column(null);
  const f9 = S.feat("F9"); const ghostSrc = S.featCard(rc, f9, { w: CW - 20 }); ghostSrc.opacity = 0.35;
  const hint = S.col(rc, { fx: true, gap: 6, pad: [8, 4] }); S.txt(hint, "Une fonctionnalité sans sprint n'apparaît ni dans les échéances ni dans la limite d'ouvertes.", { size: 11.5, color: C.dim, fill: true, lh: 1.45 });
  for (const sp of P.sprints) { const c = column(sp);
    for (const ft of P.features.filter(x => x.sprint === sp.key)) S.featCard(c, ft.k === "F5" ? { ...ft, late: false } : ft, { w: CW - 20, compact: sp.state === "Terminé" });
    if (sp.key === "S42") for (const t of ["F4 ne tiendra pas : 1 étape restante", "F5 ne tiendra pas : 4 étapes restantes"]) { const w = S.row(c, { fx: true, gap: 6, pad: [6, 8], radius: 6, fill: C.amberSoft }); S.icon(w, "clockAlert", 13, C.amber); S.txt(w, t, { size: 11.5, color: C.amber, fill: true }); }
    if (sp.key === "S44") { const dz = S.col(c, { name: "dropzone", fx: true, h: 120, radius: 8, stroke: C.fg, dashed: true, fill: C.muted, align: "center", justify: "center", gap: 6 });
      S.icon(dz, "sprint", 16, C.fg); S.txt(dz, "Déposer pour planifier en S44", { size: 12, weight: 500 }); S.txt(dz, "26–30 oct.", { size: 11, color: C.dim }); } }
  // Carte en cours de glissement, au-dessus de la zone de dépôt de S44.
  const gw = CW - 20, gx = 240 + 1 + 24 + 4 * (CW + 12) + 30, gy = 48 + 1 + 18 + 40 + 14 + 268;
  const g = S.col(f, { name: "dragging F9", x: gx, y: gy, w: gw, pad: [10, 12], gap: 8, radius: 8, fill: C.card, stroke: C.fg, shadow: 8, vs: "auto" });
  const gr = S.row(g, { fx: true, gap: 6 }); S.icon(gr, "grip", 13, C.mfg); S.txt(gr, "F9", { size: 11, mono: true, color: C.dim });
  S.txt(g, f9.name, { size: 13, weight: 500, fill: true }); S.segs(g, f9.steps.map(() => C.track), { w: Math.floor((gw - 24 - 6) / 3), h: 8, gap: 3, radius: 2 });
  S.icon(f, "grab", 22, C.fg, 2, { x: gx + gw - 30, y: gy + 44 });
  const lg = S.row(body, { fx: true, gap: 14 });
  for (const [l, col] of [["étape livrée", C.fg], ["en review", C.purple], ["en cours", C.blue], ["bloquée", C.red], ["à faire", C.track]]) { const r = S.row(lg, { gap: 6 }); S.box(r, { w: 12, h: 8, radius: 2, fill: col }); S.txt(r, l, { size: 11.5, color: C.dim }); }
  S.txt(lg, "· une case par étape, dans l'ordre des dépendances", { size: 11.5, color: C.dim });
  return f; };

// ---------- P3 · Fiche d'une fonctionnalité ----------
S.draw["p-fonctionnalite"] = (x, y) => { const C = S.C, ft = S.feat("F5");
  const f = S.screen("P3 · Fonctionnalité", x, y, 1440, 1000);
  const { main } = S.shellP(f, "Planning", { crumbs: ["Emis", "Planning", "F5 · Envoyer les photos d'un tronçon"] });
  const body = S.row(main, { fx: true, fy: true, pad: [22, 28], gap: 28, align: "start" });
  const L = S.col(body, { fx: true, gap: 18 });
  const ov = S.row(L, { gap: 8 }); S.icon(ov, "package", 14, C.mfg); S.txt(ov, "Fonctionnalité · F5", { size: 12, color: C.mfg }); S.sprintChip(ov, "S42"); S.chip(ov, "ouverte", { color: C.blue, stroke: null, fill: C.blueSoft, size: 10.5 });
  S.txt(L, ft.name, { size: 26, weight: 600, ls: -0.4 });
  const pr = S.row(L, { gap: 12 }); S.fCases(pr, ft, { w: 40, h: 8, gap: 4 }); S.txt(pr, "1 étape livrée sur 5", { size: 13, color: C.mfg });
  const res = S.row(L, { fx: true, gap: 0, align: "stretch", radius: 8, fill: C.card, stroke: C.border, clip: true });
  S.box(res, { w: 3, h: 10, fill: C.fg, fy: true });
  const rt = S.col(res, { fx: true, pad: [12, 16], gap: 6 }); const rh = S.row(rt, { gap: 6 }); S.icon(rh, "target", 14, C.mfg); S.txt(rh, "Résultat attendu · ce qu'on montrera à la démo", { size: 12, weight: 600, color: C.mfg });
  S.txt(rt, ft.result, { size: 14, lh: 1.55, fill: true });
  const ph = S.row(L, { fx: true, gap: 8 }); S.txt(ph, "Parcours de A à Z", { size: 15, weight: 600 }); S.txt(ph, "étapes libres, dans l'ordre des dépendances", { size: 12.5, color: C.dim }); S.spacer(ph); S.btn(ph, "Ajouter une étape", "ghost", { sm: true, icon: "plus" });
  const tl = S.col(L, { fx: true, gap: 0 });
  ft.steps.forEach((t, i) => { const last = i === ft.steps.length - 1, next = t.key === "EMIS-34";
    const r = S.row(tl, { fx: true, gap: 14, align: "stretch" });
    const rail = S.col(r, { w: 28, align: "center" });
    const col = S.caseColor(t.st), done = t.st === "Terminé";
    const n = S.box(rail, { w: 28, h: 28, radius: 14, fill: done ? C.fg : t.st === "À faire" ? C.bg : col, stroke: t.st === "À faire" ? C.border : null, dir: "row", align: "center", justify: "center" });
    if (done) S.icon(n, "check", 14, C.bg, 3); else S.txt(n, String(i + 1), { size: 12, weight: 600, mono: true, color: t.st === "À faire" ? C.mfg : "#FFFFFF" });
    if (!last) S.box(rail, { w: 2, h: 10, fy: true, fill: done ? C.fg : C.border });
    const card = S.col(r, { fx: true, pad: [0, 0, last ? 0 : 16, 0], gap: 0 });
    const c = S.col(card, { fx: true, pad: [10, 14], gap: 7, radius: 8, fill: next ? C.muted : C.card, stroke: t.live ? C.brandLine : next ? C.mfg : C.border });
    const a = S.row(c, { fx: true, gap: 8 }); S.txt(a, t.title, { size: 14, weight: 500, color: done ? C.mfg : C.fg }); S.txt(a, t.key, { size: 11.5, mono: true, color: C.dim });
    if (t.live) S.liveChip(a, { text: "session · T3 Code · 42 min" }); S.spacer(a);
    const st = S.row(a, { gap: 6 }); S.status(st, t.st, 8); S.txt(st, t.st, { size: 12.5 });
    const b = S.row(c, { fx: true, gap: 12 }); S.gitRef(b, t); if (t.at) S.txt(b, t.at, { size: 11.5, color: C.dim }); S.spacer(b); S.stepCell(b, t.step);
    if (next) { const nb = S.row(c, { fx: true, gap: 8, pad: [4, 0, 0, 0] }); S.txt(nb, "Prochaine étape à livrer une fois EMIS-33 fusionné.", { size: 12, color: C.mfg }); S.spacer(nb);
      const cm = S.row(nb, { gap: 6, pad: [5, 10], radius: 6, fill: C.primary }); S.icon(cm, "copy", 13, C.pfg); S.txt(cm, "Livrer la prochaine étape", { size: 12.5, weight: 500, color: C.pfg });
      const cc = S.row(nb, { gap: 6, pad: [5, 9], radius: 6, stroke: C.border }); S.txt(cc, "/full-delivery EMIS-34", { size: 11.5, mono: true, color: C.mfg }); } });
  // Colonne de droite
  const R = S.col(body, { w: 320, gap: 14 });
  const sp = S.card(R, "Sprint", "sprint", { w: 320 });
  { const r = S.cardRow(sp, { gap: 8 }); S.sprintChip(r, "S42"); S.txt(r, "Terrain hors ligne · 12–16 oct.", { size: 12.5 }); S.spacer(r); S.icon(r, "chevDown", 13, C.dim); }
  { const r = S.cardRow(sp, { gap: 8, align: "start" }); S.icon(r, "clockAlert", 14, C.red); const tc = S.col(r, { fx: true, gap: 6 }); S.txt(tc, "4 étapes restantes : ne tiendra pas dans S42.", { size: 12.5, fill: true });
    const b = S.row(tc, { gap: 8 }); S.btn(b, "Déplacer en S43", "outline", { sm: true, icon: "sprint" }); S.txt(b, "proposé par l'agent", { size: 11.5, color: C.brandText }); }
  const addIn = (label) => (h) => S.btn(h, label, "ghost", { sm: true, icon: "plus", pad: [4, 6], size: 11.5 });
  const dp = S.card(R, "Dépendances", "link", { w: 320, right: addIn("Dépendance") });
  { const r = S.cardRow(dp, { gap: 8 }); S.txt(r, "Attend", { size: 12, color: C.dim, w: 56 }); S.txt(r, "F3", { size: 11, mono: true, color: C.mfg }); S.txt(r, "Réaffecter un ISO", { size: 12.5 }); S.spacer(r); S.icon(r, "circleCheck", 13, C.green); }
  { const r = S.cardRow(dp, { gap: 8 }); S.txt(r, "Débloque", { size: 12, color: C.dim, w: 56 }); S.txt(r, "F7", { size: 11, mono: true, color: C.mfg }); S.txt(r, "Rapport de chantier", { size: 12.5 }); S.spacer(r); S.txt(r, "S44", { size: 11, mono: true, color: C.dim }); }
  const q = S.card(R, "Questions", "question", { w: 320, count: "1", right: addIn("Question") });
  { const r = S.cardRow(q, { align: "start" }); const tc = S.col(r, { fx: true, gap: 2 }); S.txt(tc, "Quota par affaire : 2 Go ou 5 Go ?", { size: 12.5, fill: true }); S.txt(tc, "Q16 · Produit · hier · EMIS-34", { size: 11, color: C.dim }); }
  const ac = S.card(R, "Activité", "activity", { w: 320 });
  for (const a of S.P.activity.filter(a => a.f === "F5")) { const r = S.cardRow(ac, { gap: 9, pad: [7, 14] }); S.icon(r, a.icon, 13, a.color ? C[a.color] : C.mfg); S.fillX(S.txt(r, `${a.text} · ${a.tk}`, { size: 12 })); S.txt(r, a.t, { size: 11, mono: true, color: C.dim }); }
  { const r = S.cardRow(ac, { gap: 9, pad: [7, 14] }); S.icon(r, "merge", 13, C.green); S.fillX(S.txt(r, "PR #19 fusionnée · EMIS-31", { size: 12 })); S.txt(r, "hier", { size: 11, color: C.dim }); }
  const nb = S.row(R, { fx: true, gap: 8, align: "start" }); S.icon(nb, "lock", 13, C.dim); S.txt(nb, "Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery.", { size: 11.5, color: C.dim, fill: true, lh: 1.45 });
  return f; };

// ---------- P4 · Tickets ----------
S.draw["p-tickets"] = (x, y) => { const C = S.C, P = S.P;
  const f = S.screen("P4 · Tickets", x, y, 1440, 1000);
  const { main } = S.shellP(f, "Tickets");
  const body = S.col(main, { fx: true, fy: true, pad: [18, 24], gap: 12 });
  const hd = S.row(body, { fx: true, gap: 10, align: "end" }); S.txt(hd, "Tickets", { size: 22, weight: 600 }); S.txt(hd, "sprint S42 · 14 tickets dans 3 fonctionnalités", { size: 12.5, color: C.dim }); S.spacer(hd); S.btn(hd, "Nouveau ticket", "default", { sm: true, icon: "plus" });
  const fr = S.row(body, { fx: true, gap: 8 });
  const ss = S.row(fr, { pad: 2, radius: 7, fill: C.muted, gap: 2 });
  for (const [l, on] of [["Tous les sprints"], ["S41"], ["S42", true], ["S43"], ["S44"], ["À planifier"]]) { const s = S.row(ss, { pad: [4, 10], gap: 5, radius: 5, fill: on ? C.bg : null, stroke: on ? C.border : null }); if (on) S.icon(s, "sprint", 12, C.fg); S.txt(s, l, { size: 12.5, weight: 500, color: on ? C.fg : C.mfg, mono: /^S4/.test(l) }); }
  S.spacer(fr); S.btn(fr, "Ouverts", "outline", { sm: true, icon: "circleCheck" }); S.btn(fr, "Fonctionnalité", "outline", { sm: true, icon: "package" }); S.btn(fr, "Activité récente", "outline", { sm: true, icon: "sort" });
  const W = { key: 74, f: 226, st: 104, git: 196, step: 168, upd: 78 };
  const tb = S.col(body, { fx: true, stroke: C.border, radius: 8, clip: true, fill: C.card });
  const th = S.row(tb, { fx: true, h: 32, pad: [0, 14], gap: 12, fill: C.panel });
  const hc = (l, w) => { const c = S.row(th, { w, fx: !w }); S.txt(c, l, { size: 11.5, weight: 500, color: C.dim }); };
  hc("Clé", W.key); hc("Titre"); hc("Fonctionnalité", W.f); hc("État", W.st); hc("Git et PR", W.git); hc("Livraison", W.step); hc("Mis à jour", W.upd);
  const upd = { "EMIS-33": "il y a 9 min", "EMIS-45": "il y a 18 min", "EMIS-32": "il y a 1 h", "EMIS-34": "hier", "EMIS-35": "hier", "EMIS-46": "lun.", "EMIS-21": "il y a 2 h", "EMIS-31": "hier", "EMIS-43": "mer.", "EMIS-42": "mar.", "EMIS-41": "lun." };
  const rows = ["EMIS-33", "EMIS-45", "EMIS-32", "EMIS-34", "EMIS-35", "EMIS-46"].map(k => S.allTickets().find(t => t.key === k));
  const row = (t, dim) => { S.hline(tb, C.soft); const r = S.row(tb, { fx: true, h: 40, pad: [0, 14], gap: 12 });
    const kc = S.row(r, { w: W.key }); S.txt(kc, t.key, { size: 12, mono: true, color: dim ? C.dim : C.mfg });
    const tc = S.row(r, { fx: true, gap: 8 }); S.txt(tc, t.title, { size: 13, color: dim ? C.mfg : C.fg }); if (t.live) S.dot(tc, C.brand, 7);
    const fc = S.row(r, { w: W.f }); S.fChip(fc, t.f, { name: true });
    const st = S.row(r, { w: W.st, gap: 7 }); S.status(st, t.st, 8); S.txt(st, t.st, { size: 12.5, color: dim ? C.mfg : C.fg });
    const gc = S.row(r, { w: W.git }); S.gitRef(gc, t); S.stepCell(r, t.step, { w: W.step });
    const u = S.row(r, { w: W.upd }); S.txt(u, upd[t.key] || "—", { size: 12, color: C.dim }); };
  rows.forEach(t => row(t));
  S.hline(tb, C.soft);
  { const g = S.row(tb, { fx: true, h: 32, pad: [0, 14], gap: 8, fill: C.panel }); S.icon(g, "chevDown", 13, C.dim); S.status(g, "Terminé", 8); S.txt(g, "Terminés dans S42", { size: 12, weight: 500, color: C.mfg }); S.txt(g, "8", { size: 11, mono: true, color: C.dim }); }
  ["EMIS-21", "EMIS-31", "EMIS-43", "EMIS-42"].map(k => S.allTickets().find(t => t.key === k)).forEach(t => row(t, true));
  S.hline(tb, C.soft);
  { const g = S.row(tb, { fx: true, h: 32, pad: [0, 14], gap: 8, fill: C.panel }); S.icon(g, "chevRight", 13, C.dim); S.txt(g, "Hors fonctionnalité", { size: 12, weight: 500, color: C.mfg }); S.txt(g, "1", { size: 11, mono: true, color: C.dim }); }
  const ft = S.row(body, { fx: true, gap: 8 }); S.icon(ft, "refresh", 13, C.dim);
  S.txt(ft, "États tirés de git : branche poussée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step.", { size: 11.5, color: C.dim });
  return f; };

// ---------- P5 · Graphe ----------
S.draw["p-graphe"] = (x, y) => { const C = S.C, P = S.P;
  const f = S.screen("P5 · Graphe", x, y, 1440, 1000);
  const { main } = S.shellP(f, "Graphe");
  const tb = S.row(main, { fx: true, h: 46, pad: [0, 16], gap: 8 });
  S.btn(tb, "Regrouper : Fonctionnalités", "outline", { sm: true, icon: "package" }); S.btn(tb, "Colonnes : Sprints", "outline", { sm: true, icon: "sprint" }); S.btn(tb, "Livrées repliées", "outline", { sm: true, icon: "circleCheck" });
  S.spacer(tb); S.txt(tb, "9 fonctionnalités · 13 dépendances entre étapes, 7 entre fonctionnalités", { size: 12, color: C.dim });
  S.hline(main, C.soft);
  const CW = 1199, CH = 1000 - 48 - 1 - 46 - 1, cv = S.box(main, { name: "canvas", w: CW, h: CH, fill: C.canvas, fx: true, fy: true, clip: true });
  const lanes = [["S41", "Accès", "terminé"], ["S42", "Terrain hors ligne", "en cours"], ["S43", "Import et soudures", "prévu"], ["S44", "Rapports", "prévu"], [null, "À planifier", ""]];
  const LW = [150, 290, 260, 250, 210], X = []; let xx = 0; LW.forEach(w => { X.push(xx); xx += w; });
  lanes.forEach(([k, n, st], i) => { const cur = k === "S42";
    S.box(cv, { name: "lane " + (k || "reserve"), x: X[i], y: 0, w: LW[i], h: CH, fill: i % 2 ? C.panel : C.canvas });
    const h = S.col(cv, { x: X[i] + 14, y: 12, gap: 2 }); const a = S.row(h, { gap: 6 });
    if (k) { S.icon(a, "sprint", 12, cur ? C.fg : C.dim); S.txt(a, k, { size: 12, weight: 600, mono: true, color: cur ? C.fg : C.mfg }); } else { S.icon(a, "inbox", 12, C.dim); }
    S.txt(a, n, { size: 12, weight: 600, color: cur ? C.fg : C.mfg }); if (st) S.txt(h, st, { size: 11, color: cur ? C.fg : C.dim }); });
  S.box(cv, { x: 0, y: 50, w: CW, h: 1, fill: C.border });
  const pos = {};
  const frame = (k, lx, y, w) => { const ft = S.feat(k), done = S.fDone(ft), n = ft.steps.length, full = done === n;
    const fr = S.col(cv, { name: "frame " + k, x: lx, y, w, pad: [10, 10], gap: 6, radius: 10, stroke: ft.late ? C.red : C.mfg, dashed: true, fill: C.bg, vs: "auto" });
    const h = S.row(fr, { fx: true, gap: 6 }); S.txt(h, k, { size: 11, mono: true, color: C.dim }); S.spacer(h); S.txt(h, `${done}/${n}`, { size: 11, mono: true, color: C.mfg }); if (full) S.icon(h, "circleCheck", 12, C.green);
    S.txt(fr, ft.name, { size: 12.5, weight: 600, fill: true });
    S.segs(fr, ft.steps.map(t => S.caseColor(t.st)), { w: Math.floor((w - 20 - (n - 1) * 3) / n), h: 5, gap: 3, radius: 1 });
    if (!full) for (const t of ft.steps) { const s = S.row(fr, { fx: true, gap: 6, pad: [5, 8], radius: 6, fill: C.card, stroke: t.live ? C.brandLine : C.border });
      S.status(s, t.st, 7); S.txt(s, t.title, { size: 11.5, color: t.st === "Terminé" ? C.dim : C.fg }); S.spacer(s); if (t.live) S.dot(s, C.brand, 6); if (t.git) S.icon(s, S.gitIcon[t.git], 11, S.gitColor(t.git)); }
    if (ft.late) { const l = S.row(fr, { gap: 5 }); S.icon(l, "clockAlert", 12, C.red); S.txt(l, "en retard · glisse en S43", { size: 11, color: C.red }); }
    if (ft.blocked) { const l = S.row(fr, { gap: 5 }); S.icon(l, "lock", 12, C.red); S.txt(l, "bloquée par Q14", { size: 11, color: C.red }); }
    pos[k] = fr; return fr; };
  frame("F1", X[0] + 12, 70, 126); frame("F2", X[0] + 12, 190, 126);
  frame("F3", X[1] + 14, 70, 262); frame("F4", X[1] + 14, 180, 262); frame("F5", X[1] + 14, 460, 262);
  frame("F6", X[2] + 14, 120, 232); frame("F8", X[2] + 14, 340, 232);
  frame("F7", X[3] + 14, 400, 222); frame("F9", X[4] + 14, 400, 182);
  const lg = S.row(cv, { name: "legend", x: 16, y: CH - 48, pad: [8, 12], gap: 14, radius: 8, stroke: C.border, fill: C.card });
  for (const st of ["À faire", "En cours", "En review", "Bloqué"]) { const r = S.row(lg, { gap: 6 }); S.status(r, st, 8); S.txt(r, st, { size: 11.5, color: C.mfg }); }
  { const r = S.row(lg, { gap: 6 }); S.box(r, { w: 14, h: 10, radius: 3, stroke: C.mfg, dashed: true }); S.txt(r, "Fonctionnalité", { size: 11.5, color: C.mfg }); }
  { const r = S.row(lg, { gap: 6 }); S.icon(r, "sprint", 12, C.mfg); S.txt(r, "Colonne = sprint", { size: 11.5, color: C.mfg }); }
  { const r = S.row(lg, { gap: 6 }); S.dot(r, C.brand, 7); S.txt(r, "Session active", { size: 11.5, color: C.mfg }); }
  return f; };
// Flèches entre fonctionnalités, tracées sur la mise en page calculée (second appel), derrière les cadres.
S.edgesP = () => { const C = S.C; const f = penpot.currentPage.root.children.find(c => c.name === (S.mode === "light" ? "P5 · Graphe (clair)" : "P5 · Graphe"));
  const cv = penpotUtils.findShapes(s => s.name === "canvas", f)[0]; penpotUtils.findShapes(s => s.name === "edges", cv).forEach(o => o.remove());
  const box = k => { const n = penpotUtils.findShapes(s => s.name === "frame " + k, cv)[0]; return { x: n.x - cv.x, y: n.y - cv.y, w: n.width, h: n.height }; };
  const pairs = [["F1", "F3"], ["F2", "F3"], ["F2", "F4"], ["F3", "F5"], ["F2", "F6"], ["F4", "F8"], ["F4", "F7"], ["F5", "F7"], ["F7", "F9"]];
  let d = "";
  for (const [a, b] of pairs) { const A = box(a), B = box(b);
    if (Math.abs(A.x - B.x) < 20) { const xa = A.x - 8, ya = A.y + 30, yb = B.y + 30, col = C.mfg;
      d += `<path d="M${A.x},${ya} L${xa + 4},${ya} Q${xa},${ya} ${xa},${ya + 4} L${xa},${yb - 4} Q${xa},${yb} ${xa + 4},${yb} L${B.x - 1},${yb}" stroke="${col}" stroke-width="1.5" fill="none"/><path d="M${B.x - 7},${yb - 4} L${B.x - 1},${yb} L${B.x - 7},${yb + 4}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; continue; }
    const x1 = A.x + A.w, y1 = A.y + Math.min(A.h / 2, 40), x2 = B.x - 1, y2 = B.y + Math.min(B.h / 2, 40), mx = (x1 + x2) / 2, col = C.mfg;
    d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="1.5" fill="none"/><path d="M${x2 - 7},${y2 - 4} L${x2},${y2} L${x2 - 7},${y2 + 4}" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; }
  const s = S.svg(cv, `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.width}" height="${cv.height}" viewBox="0 0 ${cv.width} ${cv.height}" fill="none">${d}</svg>`, "edges", { x: 0, y: 0 });
  const idx = cv.children.findIndex(c => c.name && c.name.startsWith("frame "));
  if (idx >= 0) cv.insertChild(idx, s);
  return s.id; };
return "proposition ok";
