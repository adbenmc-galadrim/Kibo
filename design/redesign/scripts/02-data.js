// Données du redesign : projet Silo, ensembles C0 à C5, tickets SILO-n, PR, questions, activité (README, « Données »).
// Un ensemble n'a jamais d'agent ni d'étape : il porte seulement son avancement n/m.
const S = storage;
S.D = {
  project: { name: "Silo", sub: "Location de box", repo: "silo-labs/silo-location", base: "dev", color: "#14B8A6",
    done: 41, total: 68, open: 27, wip: 3, review: 4, blocked: 1, todo: 19, questions: 3, today: "ven. 16 oct.", week: "S42" },
  projects: [["Silo", "#14B8A6"], ["Kibo", "#6366F1"], ["Atlas", "#84CC16"], ["Nimbus", "#EC4899"]],
  sets: [
    { key: "C0", id: "SILO-1", title: "Socle et déploiement", done: 12, total: 12, start: 0, end: 1, due: "3 oct." },
    { key: "C1", id: "SILO-9", title: "Connexion et comptes", done: 8, total: 8, start: 0.6, end: 2, due: "10 oct." },
    { key: "C2", id: "SILO-17", title: "Périmètre et affectations", done: 4, total: 6, start: 1.2, end: 3.1, due: "lun. 19 oct.",
      line: "Chaque chef de centre ne voit que ses box.", subs: ["Terminé", "Terminé", "Terminé", "Terminé", "En review", "En cours"] },
    { key: "C3", id: "SILO-36", title: "Saisie des box et constats", done: 9, total: 14, start: 1.6, end: 3.7, due: "ven. 23 oct.",
      line: "Saisie hors ligne, contrats et import Excel.", subs: ["Terminé", "Terminé", "Terminé", "Terminé", "Terminé", "Terminé", "Terminé", "Terminé", "Terminé", "En review", "En cours", "Bloqué", "À faire", "À faire"] },
    { key: "C4", id: "SILO-30", title: "Fichiers et photos", done: 1, total: 5, start: 2.4, end: 4.7, due: "ven. 30 oct.",
      line: "Photos de constat, aperçu hors ligne, quotas.", subs: ["Terminé", "En review", "En cours", "À faire", "À faire"] },
    { key: "C5", id: "SILO-50", title: "Rapports de centre", done: 0, total: 6, start: 4, end: 6.7, due: "ven. 13 nov.",
      line: "Rapport journalier PDF et export client.", subs: ["À faire", "À faire", "À faire", "À faire", "À faire", "À faire"] },
  ],
  // git : branch | pr | changes (changements demandés) | merged ; ci : ok | ko | run
  tickets: [
    { key: "SILO-23", set: "C2", title: "404 indiscernable hors périmètre", st: "En cours", git: "branch", ref: "feat/perimetre-404", step: 6, live: true, upd: "il y a 4 min", due: "19 oct." },
    { key: "SILO-33", set: "C4", title: "Aperçu des photos hors ligne", st: "En cours", git: "branch", ref: "feat/apercu-hors-ligne", step: 7, live: true, upd: "il y a 9 min", due: "30 oct." },
    { key: "SILO-22", set: "C2", title: "Périmètre côté serveur et côté synchro", st: "En review", git: "pr", ref: "#21", note: "2 commentaires", ci: "ok", step: 9, upd: "il y a 26 min", due: "19 oct." },
    { key: "SILO-32", set: "C4", title: "Envoi des photos de constat", st: "En review", git: "pr", ref: "#22", note: "CI verte", ci: "ok", step: 10, upd: "il y a 1 h", due: "30 oct." },
    { key: "SILO-41", set: "C3", title: "Saisie d'un constat hors ligne", st: "En review", git: "changes", ref: "#20", note: "changements demandés", ci: "ko", step: 9, upd: "il y a 3 h", due: "23 oct." },
    { key: "SILO-60", set: null, title: "Passage à Expo SDK 54", st: "En review", git: "pr", ref: "#23", note: "CI en cours", ci: "run", step: null, upd: "il y a 5 h", due: "—" },
    { key: "SILO-43", set: "C3", title: "Validation des contrats par lot", st: "En cours", git: "branch", ref: "feat/contrats-lot", step: 4, upd: "il y a 5 h", due: "23 oct." },
    { key: "SILO-44", set: "C3", title: "Import des box depuis Excel", st: "Bloqué", git: null, ref: "attend Q14", step: 3, upd: "hier", due: "23 oct." },
    { key: "SILO-21", set: "C2", title: "Réaffectation d'un box", st: "Terminé", git: "merged", ref: "#18", step: 11, upd: "il y a 2 h", due: "—" },
    { key: "SILO-31", set: "C4", title: "Stockage des fichiers sur MinIO", st: "Terminé", git: "merged", ref: "#19", step: 11, upd: "hier", due: "—" },
    { key: "SILO-34", set: "C4", title: "Quotas de stockage par client", st: "À faire", git: null, ref: "attend SILO-32", step: null, upd: "hier", due: "30 oct." },
    { key: "SILO-46", set: "C3", title: "Recherche d'un box par numéro", st: "À faire", git: null, ref: null, step: null, upd: "mar. 13", due: "23 oct." },
    { key: "SILO-35", set: "C4", title: "Purge des fichiers orphelins", st: "À faire", git: null, ref: null, step: null, upd: "lun. 12", due: "30 oct." },
    { key: "SILO-52", set: "C5", title: "Rapport journalier en PDF", st: "À faire", git: null, ref: "attend SILO-23", step: null, upd: "lun. 12", due: "6 nov." },
  ],
  questions: [
    { id: "Q14", text: "Un box réaffecté garde-t-il ses photos ?", ticket: "SILO-44", to: "Client", age: "il y a 3 j", blocking: true },
    { id: "Q16", text: "Quota par client : 2 Go ou 5 Go ?", ticket: "SILO-34", to: "Produit", age: "hier" },
    { id: "Q17", text: "Un rapport par chef de centre ou par client ?", ticket: "SILO-52", to: "Client", age: "il y a 2 h" },
  ],
  // src : git | step | agent | session | question | ci
  activity: [
    { t: "15:04", src: "git", icon: "pr", color: "purple", text: "PR #22 ouverte", tk: "SILO-32", set: "C4", res: "En review", day: "Aujourd'hui" },
    { t: "14:51", src: "step", icon: "flag", text: "Étape 7 · Porte qualité", tk: "SILO-33", set: "C4", day: "Aujourd'hui" },
    { t: "14:40", src: "agent", icon: "bot", text: "Agent de projet · lot n° 6 proposé", tk: null, day: "Aujourd'hui" },
    { t: "14:36", src: "git", icon: "merge", color: "green", text: "PR #18 fusionnée dans dev", tk: "SILO-21", set: "C2", res: "Terminé", day: "Aujourd'hui" },
    { t: "14:20", src: "git", icon: "branch", color: "blue", text: "Branche feat/perimetre-404 poussée", tk: "SILO-23", set: "C2", res: "En cours", day: "Aujourd'hui" },
    { t: "13:47", src: "step", icon: "flag", text: "Étape 9 · Review · 2 commentaires à traiter", tk: "SILO-22", set: "C2", day: "Aujourd'hui" },
    { t: "13:10", src: "question", icon: "question", text: "Q17 posée au client", tk: "SILO-52", set: "C5", day: "Aujourd'hui" },
    { t: "11:58", src: "ci", icon: "circleX", color: "red", text: "CI rouge sur PR #20", tk: "SILO-41", set: "C3", day: "Aujourd'hui" },
    { t: "18:22", src: "git", icon: "merge", color: "green", text: "PR #19 fusionnée dans dev", tk: "SILO-31", set: "C4", res: "Terminé", day: "Hier" },
    { t: "16:05", src: "step", icon: "flag", text: "Étape 3 · Questions · attend Q14", tk: "SILO-44", set: "C3", day: "Hier" },
  ],
  session: { tool: "T3 Code", tk: "SILO-33", step: "7 · Porte qualité", since: "42 min" },
  lot: { n: 6, items: [
    { icon: "plus", text: "Créer SILO-61 · Compresser les photos avant envoi", meta: "dans C4 · après SILO-32" },
    { icon: "link", text: "Lier SILO-34 : attend la fusion de PR #22", meta: "SILO-34 → SILO-32" },
    { icon: "question", text: "Relancer le client sur Q14", meta: "SILO-44 bloqué depuis 3 j" } ] },
};
S.STEP = ["Lecture", "Mémoire", "Repérage", "Questions", "Worktree", "Conception", "Code", "Porte qualité", "PR", "Review", "Démo", "Livré"];
S.stepLabel = (n) => n == null ? "—" : `${n} · ${S.STEP[n]}`;
S.tk = (key) => S.D.tickets.find(t => t.key === key);
S.gitIcon = { branch: "branch", pr: "pr", changes: "pr", merged: "merge" };
S.gitColor = (g) => ({ branch: S.C.blue, pr: S.C.purple, changes: S.C.amber, merged: S.C.green })[g] || S.C.dim;
S.gitText = (t) => ({ branch: t.ref, pr: "PR " + t.ref, changes: "PR " + t.ref, merged: "PR " + t.ref + " fusionnée" })[t.git] || (t.ref || "—");
return "data ok";
