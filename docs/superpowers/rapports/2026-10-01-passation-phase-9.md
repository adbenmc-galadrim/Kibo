# Passation : phase 9 (UI/UX), vague 3 en cours

Arrêt au seuil d'usage hebdomadaire (60 %, relevé à 57 % le 2026-10-01 à 02:36 UTC, réinitialisation samedi 21:00). Aucun agent ni processus de test ne tourne. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `main` : v1.0.0 publiée, inchangée depuis la passation précédente.
- `phase/9` (poussée, tête = ce commit de passation) : vague 1 (T1 à T16 et tâches bis) et **vague 2 (T18 à T28) intégrées**, chacune après relecture et gate complète. Rapports : `docs/superpowers/rapports/2026-09-30-phase-9-vague-1.md`, `docs/superpowers/rapports/2026-10-01-phase-9-vague-2.md`. Plans : `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md`, `docs/superpowers/plans/2026-09-30-kibo-phase-9-vague-2.md` (toutes les cases cochées sauf T17, écart assumé).
- Mesures sur `phase/9` : budget UI **218,2 kB** après T36 (plafond 230 kB ; T29 a ramené l'entrée de 229,2 à 216,8 kB), 50 parcours E2E verts (ports 4390 à 4418), 3555 tests unitaires.
- Captures de contrôle (non commitées, `screens/` ignoré par git) : `screens/2026-09-30-vague-1/`, `screens/2026-10-01-t<n>/` (captures des devs + captures E2E de chaque gate).

## Vague 3 (lots 3, 6, 8)

Plan : `docs/superpowers/plans/2026-10-01-kibo-phase-9-vague-3.md` (T29 à T44), décisions de spec dans `2026-09-25-kibo-design.md` §15, `2026-09-26-kibo-composants.md` §16, `2026-09-26-kibo-marketplace.md` D47, `2026-09-26-kibo-agents.md` §11, `2026-09-26-kibo-code-onglets.md` §12.8. Points pour Adam A1 à A10 en tête du plan, défauts appliqués.

| Tâche | État | Reste à faire |
|---|---|---|
| T29 budget (216,8 kB), T30 démon, T31 boîte de réception (démon), T38 vocabulaire git, T34 Composants installés, T39 démarrage et coque, T40 aperçu et diff, T36 Synchronisation | intégrées, cochées | — |
| T42 arbre Tickets et notes, T43 Kanban | à lancer (vague 1 ; T42 ← T30 ; T43 ← T31, relecture lead) | un `kibo-dev` chacune, en parallèle |
| T32 Nouveau ticket + boîte dans le shell, T37 Agents (amendée : libellés de `SyncIndicator`), T35 Composants confirmations et vocabulaire, T41 largeurs et mineures (amendée : tri mémorisé de T34, `placesOf`, pastille `items-start`) | vague 2 | T32 ← T31, T29, T39 · T37 ← T39 · T35 ← T30, T34 · T41 ← T32, T40, T38 |
| T33 page Boîte de réception | vague 3 ← T32, T41 | |
| T44 E2E (`inbox.spec.ts` 4419/4420, `confort.spec.ts` 4421/4422) | vague 4 ← tout | |

Relecture `kibo-lead` exigée : T43 (déjà faites : T29, T31, T39). Ordre d'intégration : T42, T43 · T32, T37, T35, T41 · T33 · T44. Puis rapport de vague 3 dans `docs/superpowers/rapports/`, vague 4 (lot 9, plan à écrire par le lead), lot 5 après la réponse d'Adam sur les formats, jalon `v1.1.0`.

## Commandes

- Intégrer une tâche acceptée (rebase sur `phase/9`, gate complète, copie des captures dans `screens/<date>-<tâche>/`, fast-forward, push), une à la fois : `integ9.sh <tâche>` du dossier de session (`/private/tmp/claude-501/-Users-galadrim-goinfre-Kibo/<session>/scratchpad/`). Si le dossier a disparu : gate = `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts` (0 fail), attendre qu'aucun processus n'écoute sur 4390-4420, `bun run --cwd e2e test` (une relance tolérée), puis `git merge --ff-only` dans `phase/9` et push.
- Un dev par tâche dans `.claude/worktrees/p9-t<n>`, branche `feat/p9-t<n>` ; titres de commits < 50 caractères ; captures sombre et clair dans `screens/t<n>/` du worktree, page de démo hors de la plage 4390-4420 ; un dev ne lance jamais la suite E2E complète pendant une gate.
- Les worktrees des tâches intégrées existent encore (`git worktree list`) : à supprimer quand on veut (`git worktree remove`).

## Mineures en attente (hors plan, à caser)

- T34 : vocabulaire du tableau (« Toi », « IA », « Sandboxé ») à aligner sur les filtres en T35 ; tri confiance/origine sur codes internes ; test « Fiables inclut builtin ».
- T39 : `handle.exit(1)` plutôt que `std::process::exit(1)` dans `main.rs` ; timer de « Réessayer » non annulé (compteur de génération) ; `main.rs` 406 lignes → `startup.rs`.
- T40 : compteur « n / N » sans `role="status"` ; état `copied` ne revient pas à `idle` ; `subscribePref` `external` non testé ; Esc hors champ non testé ; `bg-yellow-*` assumé ; le pied ne suit pas le défilement (écart écran 124).
- T30 : tests RPC manquants pour `refreshMarketSource` (erreur, source désactivée, retirée) ; `sdk/mock.ts` 315 lignes.
- T31 : `fileTicket` n'émet pas `{ topic: "config" }` (usage des domaines périmé) ; `restoreBoth` recharge même sur NOT_FOUND.
- T36 : libellé « Paramètres › Sync » à aligner sur « Synchronisation » (`fr-share.ts`, `share.test.tsx`, spec `kibo-sync` l. 69, 72) : écrit dans T37.
- T38 : « Commit sur <branche> » conservé (écran 122 dit « Valider ») ; `primitives.test.tsx` aria-label « Indexer ».
- Vague 2 (déjà listées au rapport de vague 2) : `tabIndex={-1}` et libellé « Image » de `IconField`, double `role="alert"`, etc. (T41).

## Points d'attention

- **Budget** : T29 faite (modules partagés exposés à la demande : `loadTrusted` attend `expose()` avant d'importer un module trusted). Marge actuelle ≈ 12 kB ; chaque tâche UI note sa mesure.
- Les mocks `mock.module` de bun fuient entre fichiers d'un même lancement : ne mocker que `../api`.
- Régressions E2E classiques à l'intégration : sélecteurs devenus ambigus (`exact: true`), menus déplacés, libellés retirés ; `bun test` sans script ramasse les specs Playwright (préexistant).
- Erreur du plan de la vague 2 corrigée en cours de route : T26 dépendait aussi de T21 ; vérifier les tables de dépendances des plans contre les interfaces listées.
- Points pour Adam (défauts appliqués) : formats de composant du lot 5 ; image d'un projet partagé non synchronisée ; suppression par le propriétaire d'un partage (refus expliqué) ; départ d'un membre sans trame `leave` ; `readFile` distant des fichiers non suivis ou ignorés.
- Jalon de phase : version `1.1.0`, PR `phase/9` → `main`, CI verte sur tous les jobs, tag `v1.1.0`.
