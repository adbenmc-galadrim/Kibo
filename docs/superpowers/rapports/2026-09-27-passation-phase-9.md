# Passation : phase 9 (UI/UX) et release v1.0.0

Arrêt au seuil d'usage hebdomadaire (25 %). Ce document permet de reprendre sans contexte.

## État

- `main` : v1.0 et phase 8 livrées (PR #1 et #2 fusionnées), CI verte. Dernier commit `58012da ci: AppImage sans strip`.
- Plan d'action UI/UX : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (8 lots, 3 vagues, jalon `v1.1.0`).
- Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md`.

## Release v1.0.0

- Le premier run (tag `v1.0.0`) a échoué sur Linux : `failed to run linuxdeploy` à l'étape AppImage. Correctif : `NO_STRIP: "true"` et `--verbose` dans `release.yml`.
- Relance par `workflow_dispatch` sur `main` (run 36319589374), qui réutilise le brouillon v1.0.0. Le tag `v1.0.0` pointe encore l'ancien commit (seul le workflow diffère).
- À vérifier : run vert (macOS aarch64, Linux x86_64, publish), puis
  `curl -sL https://github.com/adbenmc-galadrim/Kibo/releases/latest/download/latest.json` contient `darwin-aarch64` et `linux-x86_64`.
- Run 36319589374 : macOS vert, Linux encore rouge, publish sauté. Cause réelle (log verbeux) : `ERROR: Could not find dependency: libc.musl-x86_64.so.1` ; linuxdeploy analyse un binaire embarqué lié à musl (probablement une ressource produite par `build-toolchain.ts` ou le sidecar). `NO_STRIP` n'y change rien.
- Correctif `7dab5ee` : `build-toolchain.ts` n'embarque plus les variantes `-musl` des binaires natifs (`@tailwindcss/oxide`, `lightningcss`) que Bun installe à côté des variantes glibc. Release relancée : run 36337886622, résultat non vérifié. S'il est vert, contrôler `latest.json` ; sinon relire `gh run view 36337886622 --log-failed`.

## Phase 9

- Branche d'intégration `phase/9` (depuis `main`), aucune tâche intégrée. `feat/p9-plan` est rebasée sur `main` (`615e53b`) et la gate locale est verte : il reste à pousser la branche rebasée et à avancer `phase/9` dessus en fast-forward.
- Plan détaillé de la vague 1 (lots 1 et 4) commité par `kibo-lead` sur `feat/p9-plan` (`7a5368b`, poussé, worktree `.claude/worktrees/p9-plan`) : `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md` et décisions de spec (`kibo-code-onglets` §12, `kibo-mises-a-jour` §3.7/§4, `kibo-design` §8).
- T1 (maquettes), T2 (socle SDK, chargement initial ≤ 224 kB) et T3 (démon : `discardChanges`, `stageAll`, `unstageAll`) sont rédigées en entier ; T4 à T16 cadrées mais marquées « À compléter » : `kibo-lead` doit écrire leurs étapes TDD avant de les confier.
- Questions pour Adam : réserver toutes les mutations git de `/api/code` aux sessions locales ? renommage automatique des notes `sans-titre` à la première sauvegarde ? glisser-déposer limité au reparentage ?

## Reprise

1. Relire et intégrer `feat/p9-plan` sur `phase/9` (fast-forward après gate).
2. Pour chaque tâche du plan de vague 1 : `kibo-dev` dans `.claude/worktrees/p9-<tâche>`, branche `feat/p9-<tâche>`, puis `kibo-reviewer`, gate locale, intégration sur `phase/9`.
3. Vagues 2 et 3 : `kibo-lead` écrit leurs plans (décisions de spec des lots 2, 3 et 5 d'abord).
4. Jalon : contrôle visuel sombre et clair, rapport, version `1.1.0` (`bun apps/desktop/scripts/version.ts set 1.1.0`), PR `phase/9` → `main`, CI verte sur tous les jobs, fusion, tag `v1.1.0`.

## Suivis ouverts

- Test de debounce du watcher instable sur macOS ; job e2e sans `timeout-minutes` ; bruit du poller de PR en e2e.
- Dépendances d'ordre entre tests ; `mock.ts` au-delà de 300 lignes ; `AddComponentDialog.tsx` à 306 lignes.
- Clé d'appareil rangée dans le trousseau sous un nom fixe.
