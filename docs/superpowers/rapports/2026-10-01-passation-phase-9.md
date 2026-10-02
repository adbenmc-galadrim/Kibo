# Passation : phase 9 (UI/UX) close, jalon v1.1.0

Seuil d'usage hebdomadaire fixé par Adam : 80 %. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `phase/9` (poussée) : les quatre vagues sont intégrées (T1 à T55), chaque tâche après relecture et gate complète ; version de l'application `1.1.0`.
- Rapports : `docs/superpowers/rapports/2026-10-01-jalon-v1.1.md` (synthèse, points pour Adam) et les rapports de vague `2026-09-30-phase-9-vague-1.md`, `2026-10-01-phase-9-vague-2.md`, `2026-10-01-phase-9-vague-3.md`, `2026-10-01-phase-9-vague-4.md` (écarts, risques, suivis).
- Mesures sur `phase/9` : budget UI **221,4 kB** (221 449 octets ; exigence de la vague 4 : 222,0 kB ; plafond 230 kB, jamais relevé), **70 parcours E2E** verts (ports 4390 à 4426), **3 952 tests unitaires** (1 ignoré) au jalon ; après les changements du 2 octobre, ports E2E jusqu'à 4428.
- Captures de contrôle (non commitées, `screens/` ignoré par git) : `screens/2026-10-01-t<n>/`.

## État à l'arrêt (2 octobre, usage hebdomadaire 81 %, seuil 80 %)

- `main` = `654f32cd` (PR « base verrouillée, journal des notes » fusionnée), CI verte sur les six jobs, environ cinq minutes. Aucune PR ouverte, aucun agent en cours, aucune tâche à moitié faite.
- Tag `v1.1.0` non posé : il attend la validation d'Adam.
- À reprendre dans cet ordre : deux démons sur le même `KIBO_HOME` (décision à écrire dans la spec, puis garde au démarrage) ; cause d'un run échoué au lieu de « espace de travail indisponible » ; tri des alertes Dependabot (3 hautes, 7 modérées, non examinées) ; décisions d'Adam (A22, « PR ouverte → En review », second run sur un ticket, écriture sur un projet en lecture seule) ; tag. Le reste est dans « Suivis » plus bas.

## Après le jalon (2 octobre)

Intégré dans `main` par la PR « CI en dix minutes, correctifs v1.1 » puis par la PR de la conversation avec un run (état : `gh pr list --state all --limit 5`) :

- CI en dix minutes (section « CI » plus bas).
- Enregistrement de la disposition : « Enregistrer » échouait (« Requête invalide ») avec des widgets enregistrés empilés ; plan d'écriture ordonné (`packages/ui/src/pages/layout-plan.ts`, spec de conception §16.2).
- Fenêtre « Assigner » : projet sans dossier local et profil `worktree` ou `repo` ⇒ alerte, bouton « Modifier le projet », lancement désactivé (spec agents §6).
- Base verrouillée : `busy_timeout` de 5 s à l'ouverture de `kibo.db`, `runs.db` et de la base de `kibo-sync`, transactions de `store.transaction` et de la création d'un run en mode `immediate` ; une note ignorée (plus de 1 Mio, par exemple) n'est journalisée qu'une fois.
- Conversation avec un run (demande d'Adam, spec agents §13) : écrire à un run terminé (reprise de la session par la file), règle « run terminé → En review » retirée des défauts, bouton « Passer en review », message de fin de tour en entier, journal qui suit la dernière ligne.

Suivis nés de ces changements :

- Envoyer un message pendant qu'un tour tourne (zone de saisie désactivée aujourd'hui).
- Points pour Adam : retirer aussi « PR ouverte → En review » ? `assignAgent` doit-il refuser un ticket qui a déjà un run non terminé ? `answerRun` doit-il refuser un projet partagé passé en lecture seule ?
- Texte d'un run échoué : « espace de travail indisponible » ne dit pas la cause (dossier absent, dépôt git inutilisable) ; il faut des codes d'erreur distincts côté démon.
- Durée affichée d'un run repris : compte le temps mort entre deux tours (`packages/ui/src/agents/format.ts`, `elapsed`).
- `assign` met le run en file avant le contrôle d'écriture du ticket (`packages/daemon/src/agents/orchestrator.ts`) : sur un projet en lecture seule la RPC échoue mais le run reste en file. Lu dans le code, sans test.
- La base `~/.kibo/runs.db` d'un démon qui a repris un run terminé ne se relit plus avec une version antérieure (`STORE_CORRUPT`).
- Propriété fast-check de `planLayoutSave` à rejouer sur le vrai `setInstanceLayout` du core ; taille héritée non format d'un widget non touché (cas rare, spec §16.2).
- `orchestrator.ts` à 308 lignes.
- **Deux démons sur le même `KIBO_HOME`** : rien ne l'empêche (constaté chez Adam : `daemon.json` désignait un autre pid que le démon en cours, d'où « database is locked »). Chacun garde ses documents en mémoire et écrit ses snapshots : risque d'écrasement. À décider et écrire dans la spec : refus de démarrer si le démon désigné par `daemon.json` est vivant, et ce que montre la coque dans ce cas.
- Les autres transactions qui lisent puis écrivent restent en mode différé et n'attendent pas le verrou d'un autre processus : `integrations/db.ts`, `components/events.ts`, `collab/sync-db.ts`, `market/market-db.ts`, l'index des notes ; côté `sync-server` : `room.ts`, `members.ts`, `accounts.ts`, `market-store.ts`.
- L'attente de verrou (5 s) bloque le fil du démon et vaut le délai du hook d'un agent (5 s, refus par défaut) : à ramener à 2 ou 3 s si deux processus sur la même base deviennent un cas normal.
- Quota de 1 Mio par note : `docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md` (1,17 Mio) est ignoré quand le dossier de notes du projet est `docs/`.

## Jalon v1.1.0 : étapes

1. PR `phase/9` → `main`, description en français, sans mention d'outil.
2. CI de la PR verte sur tous les jobs (voir « CI » plus bas) ; un job rouge se diagnostique depuis ses logs (`gh run view <id> --log-failed`), se corrige sur `phase/9`, et l'on recommence. Jamais de fusion avec une CI rouge ou incomplète.
3. Fusion de la PR.
4. **Tag `v1.1.0` : après la validation de l'ensemble par Adam** (« j'aimerais le poser une fois que j'aurai validé le tout », 1er octobre ; la version reste gérée ici). Le tag déclenche `release.yml`, qui construit et publie la release en « latest », donc en mise à jour automatique des applications installées. Commande, depuis `main` à jour : `git tag v1.1.0 && git push origin v1.1.0`, puis suivre `gh run list --workflow release.yml` et contrôler `latest.json` (`darwin-aarch64`, `linux-x86_64`).

L'état d'avancement de ces étapes se lit sur GitHub : `gh pr list --state all --limit 3`, `gh run list --limit 5`, `git tag --list 'v1.1*'`.

## A22 : la décision de sécurité à valider

L'aperçu d'un brouillon généré par l'IA a besoin de WebAssembly pour ses données de démonstration (Loro). Défaut retenu par le lead, écrit dans la spec composants §17 point 6 : la politique de sécurité du document de l'interface ne change pas ; seul le script du worker de l'aperçu (`workers/draft-preview-worker-<hash>.js`), construit avec l'interface, est servi avec `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. Alternative : `'wasm-unsafe-eval'` pour toute l'interface (plus simple, une protection en moins). Si Adam préfère l'alternative ou refuse les deux, c'est une tâche isolée dans `packages/daemon/src/ui-route.ts` et `packages/ui/vite.config.ts`, à faire avant le tag.

## Corrigé à la CI de la PR

- Interblocage de la coque au démarrage sur macOS (double `restore_state`, depuis la vague 1) : corrigé, test de démarrage vert en local. Pour reproduire un défaut de coque : `CARGO_TARGET_DIR=<dépôt>/apps/desktop/src-tauri/target bun run --cwd apps/desktop build:debug`, puis `KIBO_SMOKE=1 KIBO_HOME=<dossier vide> apps/desktop/src-tauri/target/debug/kibo` (doit sortir en 0 en quelques secondes ; `sample <pid>` montre la pile s'il reste bloqué).
- Démon muet pendant la validation d'un composant (contrôle de types synchrone dans son processus, 6 à 10,5 s sur le runner ; le hook d'un agent parallèle expirait à 5 s et son écriture était refusée) : contrôle de types et inférence déplacés dans un sous-processus de la chaîne d'outils (`packages/devkit/src/static-check*.ts`, spec composants §7.4).
- `creations.spec.ts` et `market.spec.ts` : délais d'assertion explicites ; titre « Composants » ciblé sans ambiguïté.
- Lire une CI rouge : `gh run view <run> --log-failed`, `gh run download <run> -n playwright-ubuntu` (le `trace.zip` contient les requêtes réseau et leurs durées, `error-context.md` l'état de la page). Un job annulé par l'échec de l'autre système n'apprend rien.

## CI : dix minutes au plus (demande d'Adam, 2 octobre)

L'ancienne CI prenait 32 minutes : `e2e` et `desktop-smoke` attendaient `test`, et tout tournait deux fois (ubuntu et macOS). Depuis `ci: jobs en parallèle, moins de dix minutes`, les jobs sont indépendants et démarrent ensemble :

- `check` (ubuntu) : lint, types, build et test de démarrage de `kibo-sync`, build de l'interface, budget, `cli-smoke`.
- `unit` (ubuntu), deux groupes en parallèle : `packages/daemon`, et le reste (`packages/*` hors démon, `components`, `scripts`). Mêmes 3 952 tests qu'avant. Ne pas découper fichier par fichier : les `mock.module` fuient entre fichiers d'un même processus et l'ordre compte (`app.test.tsx` casse).
- `e2e` (ubuntu), thème sombre seulement (`KIBO_E2E_THEME=dark`, 35 parcours sur 70 ; sans la variable, `playwright.config.ts` lance les deux thèmes).
- `desktop-smoke` (ubuntu et macOS) : compilation de la coque, tests Rust, test de démarrage.

Retiré de la CI, et couvert seulement par la gate locale (macOS, les deux thèmes, obligatoire avant chaque intégration) : les tests unitaires et E2E sur macOS, les parcours E2E en thème clair. Chaque retrait se rétablit en une ligne de `ci.yml` (matrice `os`, variable `KIBO_E2E_THEME`). Mesuré sur la PR du 2 octobre (run 36943283874) : 5 min 05 s en tout ; `check` 1 min 40, `unit` démon 5 min 01, `unit` reste 3 min 56, `e2e` 3 min 29, `desktop-smoke` 2 min 45 (ubuntu) et 3 min 07 (macOS, cache Rust chaud). Si un groupe de `unit` approche huit minutes, le redécouper par paquet.

## Suivis à prendre en premier après le jalon

- Texte dédié au délai du contrôle de types (`FR_DEVKIT.timeout` dit « les tests ont dépassé N s ») ; rapport partiel quand ce délai expire (`static-check-run.ts:57-60`).
- Sous-processus de contrôle de types à placer dans le bac à sable OS (décider d'abord du comportement sans bac à sable) ; construction Tailwind encore sur le fil du démon.
- Deux `h1` sur Composants et Boîte de réception (`HEADING_SCREENS` dans `packages/ui/src/shell/ShellHeader.tsx` et le `h1` de la page) : retirer ces écrans de la liste.
- Test de démarrage de la coque dans la gate locale des tâches qui touchent `apps/desktop`.
- Relecture non remise à zéro si l'interface n'observe pas `generating` après une révision (`packages/ui/src/ai/AiDraftPanel.tsx:48-52`, déclencher aussi sur `details.revisions`).
- Ligne de l'écran Créations identique pour un brouillon en échec et en relecture (`packages/ui/src/creations/CreationRow.tsx`) : point pour Adam.
- Carte de l'aperçu qui n'occupe que le haut du cadre en Large et Demi-page ; débordement horizontal de l'aperçu dans le dialogue.
- `ui.trusted.js` servi sans CSP (`packages/daemon/src/components/trusted-route.ts:15-19`) ; confinement de `ui-route.ts` lexical (`realpathSync` possible).
- Maquettes : écrans 98 à 135 à dessiner dans Penpot, `kibo.penpot.xz` et PDF à réexporter.
- Le reste : sections « Risques et suivis » des rapports des vagues 3 et 4.

## Outillage local (hors git)

- `.claude/worktrees/_outils/` : `gate.sh <worktree>` (install, check, typecheck, build UI, budget, tests unitaires, attente des ports 4390-4430, E2E avec une relance), `integ9.sh <tâche> [gate-only]` (rebase sur `phase/9`, gate, copie des captures, fast-forward et push), `notes-vague-4.md` (journal détaillé). Sans ces scripts : `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts`, `bun run --cwd e2e test`.
- Un dev par tâche dans `.claude/worktrees/p9-<tâche>`, branche `feat/p9-<tâche>` ; un dev ne lance jamais la suite E2E complète (config Playwright temporaire limitée à ses ports).
- Les worktrees des tâches intégrées existent encore (`git worktree list`) : `git worktree remove` quand on veut.
- Dossiers temporaires laissés par des agents, dont la suppression leur a été refusée (à supprimer à la main) : `/tmp/t54-base2`, `/tmp/t54-base3`, `/tmp/t54-*`, `.claude/worktrees/_outils/tmp-lead-t54/`, `.claude/worktrees/_outils/tmp-lead-valid/` (contient trois liens symboliques `node_modules` vers le worktree `p9-valid`), `.claude/worktrees/p9-t55/e2e/playwright-report/`, `/tmp/kibo-e2e-4450` à `/tmp/kibo-e2e-4453`, `/tmp/kibo-review-p9/`.

## Points d'attention

- **Budget** : 551 octets de marge sous 222,0 kB ; toute liste de codes d'erreur ou tout module de `@kibo/core` dans l'entrée la dépasse. La construction échoue si `@kibo/core` ou `loro-crdt` entre dans le graphe principal, ou si le worker de l'aperçu n'est pas émis sous `workers/`.
- Régressions E2E classiques à l'intégration : sélecteurs devenus ambigus (`exact: true`, restriction à `[data-sidebar="sidebar"]`), libellés changés. `bun test` sans script ramasse les specs Playwright (préexistant).
- Les mocks `mock.module` de bun fuient entre fichiers d'un même lancement : ne mocker que `../api`.
- Fichiers à la limite : `Shell.tsx` 301 lignes, `room.test.ts` 523, `fake-claude-ai.test.ts` 298, `draft-lifecycle.ts` 293.
