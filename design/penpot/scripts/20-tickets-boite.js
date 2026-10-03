// Page « 16 · Tickets & boîte de réception » : écrans 113, 114, 115, 125 et 126 (phase 9, plan kibo-phase-9-vague-3). Requiert 18-socle.js.
const S = storage, C = S.C;
S.draw = S.draw || {};
const PAGE = "16 · Tickets & boîte de réception";
const { find, wait, shadow, abs, rel, byText, menu, alertDialog, formDialog, input, select, listbox, help, labeled, pageHead, appScreen, kanbanAt } = S.fx;

const addInbox = (f, active) => { const sb = find(f, "Sidebar"); const mt = sb.children.findIndex(c => /Mes tickets/.test(c.name));
  const it = S.navItem(null, "inbox", "Boîte de réception", { active, count: 3 }); sb.insertChild(mt + 1, it); S.fillX(it); return it; };
const inboxScreen = async (name, col, row) => { const r = await appScreen(PAGE, name, col, row, null, ["Boîte de réception"], ["inbox", "Boîte de réception"]); addInbox(r.frame, true); S.fixIconOrder(r.frame);
  pageHead(r.content, "Boîte de réception", "Les tickets qui n'ont pas encore de projet. Rattache-les quand tu sais où ils vont.", h => S.button(h, "Nouveau ticket", "secondary", { icon: "plus" })); return r; };
const INBOX = [["INB-1", "Appeler le comptable", "À faire", "Adam"], ["INB-2", "Idée : export CSV des tickets", "Backlog", "—"], ["INB-3", "Relire la doc d'onboarding", "En cours", "Adam"]];
const inboxTable = (c, hot) => { let more = null;
  S.table(c, [["Clé", 70], ["Titre"], ["Statut", 120], ["Assigné", 100], ["", 150]], INBOX.map(([k, t, s, a], i) => [
    cell => S.txt(cell, k, { size: 12, mono: true, color: C.mfg }), cell => S.txt(cell, t, { size: 13, weight: 500 }),
    cell => { S.statusDot(cell, s, 8); S.txt(cell, s, { size: 12 }); }, cell => S.txt(cell, a, { size: 12, color: a === "—" ? C.dim : C.fg }),
    cell => { S.button(cell, "Rattacher…", "ghost", { sm: true, icon: "folderInput" }); const m = S.box(cell, { name: "MoreButton", fill: i === hot ? C.accent : null, radius: 4, w: 24, h: 24, dir: "row", align: "center", justify: "center" }); S.icon(m, "more", 14, C.fg); if (i === hot) more = m; }]), { hl: hot });
  return more; };

// ---------- 113 · Boîte de réception ----------
S.draw[113] = async () => { const { frame: f, content: c } = await inboxScreen("113 · Boîte de réception", 0, 0); inboxTable(c, -1); return f.id; };
S.draw["113b"] = async () => { const { frame: f, content: c } = await inboxScreen("113b · Boîte de réception : menu", 2, 0); const more = inboxTable(c, 1); await wait(2000);
  const p = rel(f, more); menu(f, p.x + p.w - 220, p.y + p.h + 4, [["Ouvrir", "ticket"], ["Rattacher à un projet…", "folderInput", { hover: true }], "-", ["Supprimer…", "trash", { danger: true }]], 220); S.frontAbs(f); return f.id; };
S.draw["113c"] = async () => { const { frame: f, content: c } = await inboxScreen("113c · Boîte de réception vide", 4, 0);
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [80, 0], vs: "auto", align: "center" }); S.fillX(e);
  const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 48, h: 48, dir: "row", align: "center", justify: "center" }); S.icon(ic, "inbox", 22, C.mfg);
  S.txt(e, "Rien en attente.", { size: 15, weight: 600 }); S.txt(e, "Les tickets créés sans projet arrivent ici.", { size: 13, color: C.mfg }); S.button(e, "Nouveau ticket", "outline", { sm: true, icon: "plus" }); return f.id; };

// ---------- 114 · Nouveau ticket ----------
const newTicket = (f, o = {}) => { const d = formDialog(f, "Nouveau ticket", 500, o.locked ? "Clé KIB-30" : "Clé KIB-25");
  if (o.locked) { const c = S.col(d, { gap: 4 }); S.txt(c, "Projet : Kibo", { size: 13, weight: 500 }); help(c, "Un sous-ticket reste dans le projet de son parent."); }
  else labeled(d, "Projet", c => select(c, "Kibo", { fill: true, open: o.projectOpen, lead: s => S.box(s, { name: "sq", fill: C.brand, radius: 2, w: 8, h: 8 }) }));
  labeled(d, "Titre", c => input(c, o.locked ? "Tests de migration v0 → v1" : "Export CSV des tickets", { focus: !o.projectOpen }));
  labeled(d, "Description", c => input(c, "Une colonne par champ, encodage UTF-8.", { h: 64 }));
  const r = S.row(d, { gap: 12, align: "start" });
  labeled(r, "Statut", c => select(c, o.blocked ? "Bloqué" : "À faire", { fill: true, lead: s => S.statusDot(s, o.blocked ? "Bloqué" : "À faire", 8) }));
  labeled(r, "Assigné", c => select(c, "Moi (Adam)", { fill: true }));
  if (o.blocked) labeled(d, "Motif", c => input(c, "Informations attendues du client", { placeholder: true }), { help: "Pourquoi ce ticket ne peut pas démarrer." });
  S.footer(d, "Annuler", "Créer le ticket"); return d; };
S.draw[114] = async () => { const { frame: f } = await kanbanAt(PAGE, "114 · Nouveau ticket", 0, 1); const d = newTicket(f, { projectOpen: true }); await wait(2000);
  const s = rel(f, find(d, "Select-Kibo")); const sq = col => r => S.box(r, { name: "sq", fill: col, radius: 2, w: 8, h: 8 });
  listbox(f, s.x, s.y + s.h + 4, [["Boîte de réception", false, r => S.icon(r, "inbox", 14, C.mfg)], ["Kibo", true, sq(C.brand)], ["Portfolio", false, sq(C.purple)], ["API Facturation", false, sq(C.green)]], s.w); S.frontAbs(f); return f.id; };
S.draw["114b"] = async () => { const { frame: f } = await kanbanAt(PAGE, "114b · Nouveau ticket : bloqué", 2, 1); newTicket(f, { blocked: true }); S.frontAbs(f); return f.id; };
S.draw["114c"] = async () => { const { frame: f } = await kanbanAt(PAGE, "114c · Nouveau sous-ticket : projet verrouillé", 4, 1); newTicket(f, { locked: true }); S.frontAbs(f); return f.id; };

// ---------- 115 · Rattacher à un projet ----------
const fileDialog = (f, shared) => { const d = formDialog(f, "Rattacher INB-2 à un projet", 480);
  labeled(d, "Projet", c => select(c, shared ? "Portfolio" : "Kibo", { fill: true, lead: s => S.box(s, { name: "sq", fill: shared ? C.purple : C.brand, radius: 2, w: 8, h: 8 }) }));
  S.sub(d, shared ? "Sa clé sera attribuée par le serveur de sync. Ses sous-tickets suivent. Ses liens vers d'autres tickets de la boîte sont perdus."
    : "Le ticket reçoit une nouvelle clé dans ce projet (la prochaine est KIB-25). Ses sous-tickets suivent. Ses liens vers d'autres tickets de la boîte sont perdus.", { size: 13 });
  S.footer(d, "Annuler", "Rattacher"); return d; };
S.draw[115] = async () => { const { frame: f, content: c } = await inboxScreen("115 · Rattacher à un projet", 0, 2); inboxTable(c, -1); fileDialog(f, false); S.frontAbs(f); return f.id; };
S.draw["115b"] = async () => { const { frame: f, content: c } = await inboxScreen("115b · Rattacher à un projet partagé", 2, 2); inboxTable(c, -1); fileDialog(f, true); S.frontAbs(f); return f.id; };

// ---------- 125 · Arbre Tickets ----------
const TREE = [[0, "KIB-3", "Noyau de données", "En cours", "—", "1/2", true], [1, "KIB-12", "Schéma Loro des tickets (LoroTree)", "En cours", "opus-dev-1", "3/5", true],
  [2, "KIB-24", "Types Zod Ticket / Link / Status", "Terminé", "opus-dev-1", ""], [2, "KIB-25", "Opérations move / reparent", "Terminé", "opus-dev-1", ""],
  [2, "KIB-27", "Tests de convergence (fast-check)", "En cours", "opus-dev-1", "0/1"], [1, "KIB-13", "Snapshots Loro ↔ SQLite", "Terminé", "Adam", ""],
  [0, "KIB-4", "Orchestration des agents", "En cours", "—", "0/2"], [0, "KIB-9", "Setup Tauri + sidecar Bun", "À faire", "Adam", "2/3"], [0, "KIB-21", "Sandbox iframe des composants", "Bloqué", "Adam", "0/4"]];
const treeScreen = async (name, col, o = {}) => { const r = await appScreen(PAGE, name, col, 3, "Tickets", ["Kibo", "Tickets"], ["list", "Kibo · Tickets"]);
  const c = r.content; const tb = S.row(c, { gap: 8 }); const q = input(tb, o.query || "Rechercher (clé ou titre)", { icon: "search", placeholder: !o.query, w: 280 });
  const st = S.button(tb, o.statusLabel || "Statut", "outline", { sm: true, icon: "filter" }); select(tb, "Assigné : " + (o.assignee || "Tous"));
  if (o.query || o.statusLabel) S.button(tb, "Effacer", "ghost", { sm: true, icon: "x" });
  S.spacer(tb); S.button(tb, "Nouveau ticket", "outline", { sm: true, icon: "plus" }); return { ...r, st, q }; };
const tree = (c, rows) => S.table(c, [["Ticket"], ["Statut", 130], ["Assigné", 150], ["Sous-tickets", 90]], rows.map(([lvl, k, ti, st, who, sub, open]) => [
  cell => { if (lvl) S.box(cell, { name: "indent", w: 20 * lvl, h: 1 }); if (open) S.icon(cell, "chevDown", 14, C.dim); else S.box(cell, { name: "indent", w: 14, h: 1 }); S.txt(cell, k, { size: 12, mono: true, color: C.dim }); S.txt(cell, ti, { size: 13 }); },
  cell => { S.statusDot(cell, st, 8); S.txt(cell, st, { size: 12 }); }, who, cell => S.txt(cell, sub || " ", { size: 12, mono: true, color: C.mfg })]));
S.draw[125] = async () => { const { frame: f, content: c, st } = await treeScreen("125 · Arbre Tickets : filtres", 0, { statusLabel: "Statut : 2" }); tree(c, TREE.filter(t => t[3] !== "Terminé")); await wait(2000);
  const p = rel(f, st); const pop = S.box(f, { name: "StatusFilter", fill: C.card, stroke: C.border, radius: 8, w: 200, dir: "column", gap: 2, pad: 6, vs: "auto" }); shadow(pop); abs(f, pop, p.x, p.y + p.h + 4);
  ["Backlog", "À faire", "En cours", "En review", "Bloqué", "Terminé"].forEach(s => { const r = S.row(pop, { gap: 8, pad: [5, 6] }); S.check(r, s === "En cours" || s === "Bloqué"); S.statusDot(r, s, 8); S.txt(r, s, { size: 13 }); });
  S.frontAbs(f); return f.id; };
S.draw["125b"] = async () => { const { frame: f, content: c } = await treeScreen("125b · Arbre Tickets vide", 2);
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [80, 0], vs: "auto", align: "center" }); S.fillX(e);
  const ic = S.box(e, { name: "EmptyIcon", fill: C.muted, radius: 999, w: 48, h: 48, dir: "row", align: "center", justify: "center" }); S.icon(ic, "list", 22, C.mfg);
  S.txt(e, "Aucun ticket pour l'instant.", { size: 15, weight: 600 }); S.txt(e, "Les tickets s'organisent en arbre : un ticket, ses sous-tickets, leurs dépendances.", { size: 13, color: C.mfg });
  S.button(e, "Nouveau ticket", "outline", { sm: true, icon: "plus" }); return f.id; };
S.draw["125c"] = async () => { const { frame: f, content: c } = await treeScreen("125c · Arbre Tickets : chargement", 4);
  const t = S.panel(c, { name: "Skeleton", gap: 0, pad: 0, radius: 8 }); [0, 1, 2, 3, 4].forEach(i => { const r = S.row(t, { gap: 12, pad: [12, 14] }); r.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "inner", strokeOpacity: 1 }];
    S.box(r, { name: "sk", fill: C.muted, radius: 4, w: 56, h: 12 }); S.box(r, { name: "sk", fill: C.muted, radius: 4, w: [320, 260, 380, 220, 300][i], h: 12 }); S.spacer(r); S.box(r, { name: "sk", fill: C.muted, radius: 4, w: 80, h: 12 }); S.box(r, { name: "sk", fill: C.muted, radius: 4, w: 100, h: 12 }); }); return f.id; };
S.draw["125d"] = async () => { const { frame: f, content: c } = await treeScreen("125d · Arbre Tickets : aucun résultat", 6, { query: "facture", assignee: "Agents" });
  const e = S.box(c, { name: "Empty", dir: "column", gap: 10, pad: [80, 0], vs: "auto", align: "center" }); S.fillX(e);
  S.txt(e, "Aucun ticket ne correspond.", { size: 15, weight: 600 }); S.button(e, "Effacer", "outline", { sm: true }); return f.id; };

// ---------- 126 · Kanban ----------
S.draw[126] = async () => { const { frame: f, content: c } = await kanbanAt(PAGE, "126 · Kanban : glisser-déposer", 0, 4);
  const tb = find(c, "Toolbar"); [...tb.children].forEach(k => k.remove());
  const seg = S.box(tb, { name: "ToggleGroup", stroke: C.border, radius: 6, dir: "row", hs: "auto", vs: "auto" });
  [["Moi + agents", true], ["Tous", false]].forEach(([t, on]) => { const b = S.box(seg, { name: "Toggle-" + t, fill: on ? C.accent : null, radius: 5, dir: "row", pad: [5, 10], hs: "auto", vs: "auto" }); S.txt(b, t, { size: 12, weight: 500, color: on ? C.fg : C.mfg }); });
  S.spacer(tb); S.txt(tb, "13 / 24 · Moi + agents", { size: 12, mono: true, color: C.dim }); S.button(tb, "11 masqués · Tout afficher", "ghost", { sm: true });
  const blocked = find(c, "Column / Bloqué"); const hd = blocked && blocked.children.find(k => k.name === "header"); if (hd) S.icon(hd, "plus", 14, C.mfg);
  const ci = find(c, "TicketCard / KIB-7"); if (ci) { const top = ci.children.find(k => k.name === "top"); const b = S.box(top, { name: "CI", stroke: C.border, radius: 999, dir: "row", gap: 4, pad: [1, 6], hs: "auto", vs: "auto", align: "center" });
    S.dot(b, C.mfg, 6); S.txt(b, "CI", { size: 10, color: C.mfg, mono: true }); }
  await wait(2000);
  const src = find(c, "TicketCard / KIB-15") || find(c, "TicketCard / KIB-18"); const p = rel(f, src);
  const ghost = src.clone(); f.appendChild(ghost); abs(f, ghost, p.x + 230, p.y - 40); ghost.rotation = -2; shadow(ghost, 0.5); ghost.name = "DragOverlay"; src.opacity = 0.35;
  const enc = find(c, "Column / En cours"); const cards = enc.children.filter(k => /^TicketCard/.test(k.name)); const a = rel(f, cards[0]);
  const line = S.box(f, { name: "DropIndicator", fill: C.fg, radius: 2, w: a.w, h: 2 }); abs(f, line, a.x, a.y + a.h + 3);
  S.frontAbs(f); return f.id; };

S.TICKETS = [113, "113b", "113c", 114, "114b", "114c", 115, "115b", 125, "125b", "125c", "125d", 126];
return "tickets-boite ok";
