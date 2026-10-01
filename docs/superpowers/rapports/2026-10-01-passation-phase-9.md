# Passation : phase 9 (UI/UX), vague 3 close, vague 4 à lancer

Arrêt au seuil d'usage hebdomadaire (65 % inclus, fixé par Adam). Aucun agent ni processus de test ne tourne. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `main` : v1.0.0 publiée, inchangée depuis la passation précédente.
- `phase/9` (poussée) : vagues 1, 2 et **3** intégrées, chaque tâche après relecture et gate complète. Rapports : `docs/superpowers/rapports/2026-09-30-phase-9-vague-1.md`, `2026-10-01-phase-9-vague-2.md`, `2026-10-01-phase-9-vague-3.md` (ce dernier liste les écarts, les risques, les mineures à caser et les points pour Adam). Plans : `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md`, `2026-09-30-kibo-phase-9-vague-2.md`, `2026-10-01-kibo-phase-9-vague-3.md`, toutes les cases cochées (T1 et T17, maquettes, écarts assumés).
- Mesures sur `phase/9` : budget UI **220,1 kB** (plafond 230 kB, jamais relevé), **62 parcours E2E** verts (ports 4390 à 4422), **3 636 tests unitaires** (1 ignoré).
- Captures de contrôle (non commitées, `screens/` ignoré par git) : `screens/2026-09-30-vague-1/`, `screens/2026-10-01-t<n>/` (captures des devs + captures E2E de chaque gate).

## Vague 4 (lots 5 et 9)

__VAGUE4__

Lot 5 (tableau de bord éditable) retient par défaut les cinq formats de composant proposés à Adam (petit, moyen, large, demi-page, plein écran) ; une réponse différente change la tâche indiquée dans le plan, rien d'autre. Lot 9 (création de composants par l'IA) dépend du lot 5.

## Commandes

- Intégrer une tâche acceptée (rebase sur `phase/9`, gate complète, copie des captures dans `screens/<date>-<tâche>/`, fast-forward, push), une à la fois : `integ9.sh <tâche>` du dossier de session (`/private/tmp/claude-501/-Users-galadrim-goinfre-Kibo/<session>/scratchpad/`). Si le dossier a disparu : gate = `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts` (0 fail), attendre qu'aucun processus n'écoute sur 4390-4430, `bun run --cwd e2e test` (une relance tolérée), puis `git merge --ff-only` dans `phase/9` et push. Pour relire avant d'intégrer, lancer la gate seule (`gate.sh <worktree>`) et fast-forwarder après le verdict.
- Un dev par tâche dans `.claude/worktrees/p9-t<n>`, branche `feat/p9-t<n>` (`bun install --frozen-lockfile` dans un worktree neuf) ; titres de commits < 50 caractères ; captures sombre et clair dans `screens/t<n>/` du worktree ; page de démo hors de la plage 4390-4430 ; un dev ne lance jamais la suite E2E complète (la config Playwright démarre tous les démons quel que soit le filtre : un dev E2E utilise une config temporaire limitée à ses ports).
- Cocher le plan : worktree `p9-plan` (branche `feat/p9-plan-suite`), rebase sur `phase/9`, commit `docs:`, fast-forward, push.
- Les worktrees des tâches intégrées existent encore (`git worktree list`) : `git worktree remove` quand on veut.

## Points d'attention

- **Budget** : marge 9,9 kB ; chaque tâche UI note sa mesure et complète `FORBIDDEN_IN_ENTRY` (`packages/ui/scripts/bundle-report.ts`) pour tout module à la demande ; conflit de rebase typique = une ligne ajoutée de chaque côté, garder les deux.
- Régressions E2E classiques à l'intégration : sélecteurs devenus ambigus (`exact: true`, restriction à `[data-sidebar="sidebar"]` depuis que le fil d'Ariane est cliquable ; dans un `filter({ has })`, le locateur interne est relatif à l'élément filtré), libellés changés. `bun test` sans script ramasse les specs Playwright (préexistant).
- Les mocks `mock.module` de bun fuient entre fichiers d'un même lancement : ne mocker que `../api`.
- Fichiers à la limite : `Shell.tsx` 301 lignes, `sdk/mock.ts` 315, `service.ts` 322, `AppSidebar.tsx` 318 : extraire à la prochaine modification.
- Points pour Adam toujours ouverts (défauts appliqués) : formats de composant du lot 5 ; section « Maquettes » sur la fiche d'un ticket de la boîte ; « Créer » ou « Créer le ticket » et ordre du sélecteur Assigné (écran 114) ; image d'un projet partagé non synchronisée ; suppression par le propriétaire d'un partage ; départ d'un membre sans trame `leave` ; `readFile` distant des fichiers non suivis.
- Jalon de phase (après la vague 4) : version `1.1.0`, PR `phase/9` → `main`, CI verte sur tous les jobs, tag `v1.1.0`.
