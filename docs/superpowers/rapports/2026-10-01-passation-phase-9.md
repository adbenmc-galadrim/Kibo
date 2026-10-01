# Passation : phase 9 (UI/UX) close, jalon v1.1.0

Seuil d'usage hebdomadaire fixé par Adam : 80 %. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `phase/9` (poussée) : les quatre vagues sont intégrées (T1 à T55), chaque tâche après relecture et gate complète ; version de l'application `1.1.0`.
- Rapports : `docs/superpowers/rapports/2026-10-01-jalon-v1.1.md` (synthèse, points pour Adam) et les rapports de vague `2026-09-30-phase-9-vague-1.md`, `2026-10-01-phase-9-vague-2.md`, `2026-10-01-phase-9-vague-3.md`, `2026-10-01-phase-9-vague-4.md` (écarts, risques, suivis).
- Mesures sur `phase/9` : budget UI **221,4 kB** (221 449 octets ; exigence de la vague 4 : 222,0 kB ; plafond 230 kB, jamais relevé), **70 parcours E2E** verts (ports 4390 à 4426), **3 946 tests unitaires** (1 ignoré).
- Captures de contrôle (non commitées, `screens/` ignoré par git) : `screens/2026-10-01-t<n>/`.

## Jalon v1.1.0 : étapes

1. PR `phase/9` → `main`, description en français, sans mention d'outil.
2. CI de la PR verte sur tous les jobs (`test` et `e2e`, ubuntu et macOS) ; un job rouge se diagnostique depuis ses logs (`gh run view <id> --log-failed`), se corrige sur `phase/9`, et l'on recommence. Jamais de fusion avec une CI rouge ou incomplète.
3. Fusion de la PR.
4. **Tag `v1.1.0` : après la validation de l'ensemble par Adam** (« j'aimerais le poser une fois que j'aurai validé le tout », 1er octobre ; la version reste gérée ici). Le tag déclenche `release.yml`, qui construit et publie la release en « latest », donc en mise à jour automatique des applications installées. Commande, depuis `main` à jour : `git tag v1.1.0 && git push origin v1.1.0`, puis suivre `gh run list --workflow release.yml` et contrôler `latest.json` (`darwin-aarch64`, `linux-x86_64`).

L'état d'avancement de ces étapes se lit sur GitHub : `gh pr list --state all --limit 3`, `gh run list --limit 5`, `git tag --list 'v1.1*'`.

## A22 : la décision de sécurité à valider

L'aperçu d'un brouillon généré par l'IA a besoin de WebAssembly pour ses données de démonstration (Loro). Défaut retenu par le lead, écrit dans la spec composants §17 point 6 : la politique de sécurité du document de l'interface ne change pas ; seul le script du worker de l'aperçu (`workers/draft-preview-worker-<hash>.js`), construit avec l'interface, est servi avec `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. Alternative : `'wasm-unsafe-eval'` pour toute l'interface (plus simple, une protection en moins). Si Adam préfère l'alternative ou refuse les deux, c'est une tâche isolée dans `packages/daemon/src/ui-route.ts` et `packages/ui/vite.config.ts`, à faire avant le tag.

## Corrigé à la CI de la PR

- Interblocage de la coque au démarrage sur macOS (double `restore_state`, depuis la vague 1) : corrigé, test de démarrage vert en local. Pour reproduire un défaut de coque : `CARGO_TARGET_DIR=<dépôt>/apps/desktop/src-tauri/target bun run --cwd apps/desktop build:debug`, puis `KIBO_SMOKE=1 KIBO_HOME=<dossier vide> apps/desktop/src-tauri/target/debug/kibo` (doit sortir en 0 en quelques secondes ; `sample <pid>` montre la pile s'il reste bloqué).
- `creations.spec.ts` et `market.spec.ts` : délais d'assertion explicites (le démon ne répond plus pendant plusieurs secondes sur un runner lent pendant la validation d'un brouillon).

## Suivis à prendre en premier après le jalon

- Démon muet plusieurs secondes pendant la validation d'un brouillon sur une machine lente : localiser le travail synchrone et le sortir du fil du démon.
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
- Dossiers temporaires laissés par des agents, dont la suppression leur a été refusée (à supprimer à la main) : `/tmp/t54-base2`, `/tmp/t54-base3`, `/tmp/t54-*`, `.claude/worktrees/_outils/tmp-lead-t54/`, `.claude/worktrees/p9-t55/e2e/playwright-report/`.

## Points d'attention

- **Budget** : 551 octets de marge sous 222,0 kB ; toute liste de codes d'erreur ou tout module de `@kibo/core` dans l'entrée la dépasse. La construction échoue si `@kibo/core` ou `loro-crdt` entre dans le graphe principal, ou si le worker de l'aperçu n'est pas émis sous `workers/`.
- Régressions E2E classiques à l'intégration : sélecteurs devenus ambigus (`exact: true`, restriction à `[data-sidebar="sidebar"]`), libellés changés. `bun test` sans script ramasse les specs Playwright (préexistant).
- Les mocks `mock.module` de bun fuient entre fichiers d'un même lancement : ne mocker que `../api`.
- Fichiers à la limite : `Shell.tsx` 301 lignes, `room.test.ts` 523, `fake-claude-ai.test.ts` 298, `draft-lifecycle.ts` 293.
