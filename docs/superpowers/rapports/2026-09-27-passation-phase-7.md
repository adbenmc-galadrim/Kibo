# Passation : phase 7, jalon v1.0

Arrêt demandé par Adam à 20 % d'usage hebdomadaire. Ce document permet de reprendre avec une réanalyse légère.

## État

- Toutes les tâches du plan `docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md` sont intégrées sur `phase/7` (0 à 34, plus 7b et 7c), porte locale complète verte sous macOS à chaque intégration.
- Rapport du jalon : `docs/superpowers/rapports/2026-09-27-jalon-v1.0.md` (commit `6fa9d26`).
- PR ouverte : https://github.com/adbenmc-galadrim/Kibo/pull/1 (`phase/7` → `main`).
- CI de la PR : premier passage (run 36292664366) rouge sur 36 tests ; six correctifs de `kibo-lead` (mock global retiré, watcher Linux sans nom de fichier, sandbox Linux, secrets en mémoire, espace de pid, délais) intégrés en `6be3576`.
- Deuxième passage (run 36294718477) : ubuntu 3134 pass / 2 fail (délais de 1 s de testing-library sur le runner lent), macOS annulé par fail-fast.
- Troisième correctif : `3a7bd2e` (délai global 4 s des tests UI, `test/happydom.ts`) et `2c329bd` (budget de chargement de la suite de conformité), sur `fix/p7-ci`, passés par la porte locale puis intégrés et poussés sur `phase/7` (voir `git log -1 phase/7`) ; la CI de la PR tournait au moment de l'arrêt.
- Aucun agent actif ; worktree `.claude/worktrees/p7-ci` à supprimer après la fusion.

## Reprendre

1. Vérifier que `phase/7` contient `2c329bd` ; sinon, intégrer `fix/p7-ci` en fast-forward après la porte locale et pousser.
2. `gh pr checks 1` jusqu'à la fin ; si rouge : `gh api repos/adbenmc-galadrim/Kibo/actions/jobs/<job>/logs`, corriger, pousser, recommencer. Jamais de fusion avec une CI rouge ou incomplète (ubuntu, macOS, e2e, desktop-smoke).
3. CI verte : cocher dans le plan les cases « `main` verte en CI », critères G §10 et H §10, puis fusionner la PR, taguer `v1.0` sur `main` et pousser le tag. Mettre à jour le rapport si la CI a demandé des correctifs (section « Écarts au plan »).
4. Arrêt jusqu'à la validation d'Adam.

## Règles de travail (rappel)

- Commits : une ligne, français, préfixe conventionnel, < 50 caractères, un seul `-m`, aucune mention d'IA, fichiers stagés explicitement ; jamais `git stash`, jamais `NO_COLOR=1`, toujours `bun test packages components`.
- Ports : démos 4461–4499, E2E 4390–4415 (sync 4406–4411, market 4412–4414).
- Budget UI : 230 kB, jamais relevé (228,9 kB au jalon).

## Suivis pour après v1.0

Voir la section « Risques » du rapport du jalon.
