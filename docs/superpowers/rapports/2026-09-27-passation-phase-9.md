# Passation : phase 9 (UI/UX), vague 1 en cours

Arrêt demandé par Adam. Aucun agent ni processus de test ne tourne. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `main` : v1.0 et phase 8 livrées. **Release v1.0.0 publiée** (macOS aarch64, Linux AppImage/deb/rpm) ; `latest.json` public contient `darwin-aarch64` et `linux-x86_64`. Correctif Linux : `build-toolchain.ts` n'embarque plus les variantes `-musl` des binaires natifs (`7dab5ee`).
- `phase/9` (`b7aa668`, poussée) : plan de la vague 1 complet (T1 à T16, `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md`), décisions de spec (`kibo-code-onglets` §12, `kibo-mises-a-jour` §3.7/§4, `kibo-design` §8), `bun.lock` en 1.0.0, et les tâches intégrées ci-dessous.
- Budget UI après intégrations : 223,0 kB (plafond 230 kB).

## Tâches de la vague 1

| Tâche | État | Branche (poussée) | Reste à faire |
|---|---|---|---|
| T1 maquettes 98–106 | écart assumé partiel, script intégré | — | voir la note sous Task 1 dans le plan |
| T2 socle SDK | intégrée | — | — |
| T3 démon git | intégrée (1 refus corrigé : dossiers refusés) | — | — |
| T4 coque Tauri | intégrée (reviewer + lead sécurité) | — | smoke manuel macOS (menu, ⌘⇧W, taille min, fenêtre mémorisée) |
| T5 logo | intégrée | — | — |
| T6 fiche ticket | **2e refus en cours de correction** | `feat/p9-t6` (3 commits) | modifs **non commitées** dans le worktree `p9-t6` (TicketTitle, TicketSheet, TicketTab, test) : le titre de la fiche doit rester un `heading` accessible ; l'E2E `mvp.spec.ts:83` échouait (`getByRole("heading", { name: "Préparer la démo" })`). Finir, lancer l'E2E, puis intégrer. Un 3e refus ⇒ `kibo-lead` reprend. |
| T7 pages | acceptée (budget +2,6 kB accepté par le chef : sous-menu partagé) | `feat/p9-t7` | rebase + gate + intégration |
| T8 réglages widget | acceptée après 1 refus (test page à un widget, titres raccourcis) | `feat/p9-t8` | rebase + gate + intégration |
| T9 domaines | acceptée (titre du 2e commit raccourci) | `feat/p9-t9` | rebase + gate + intégration |
| T10 arbre Tickets | en développement | `feat/p9-t10` (1 commit) | modifs **non commitées** dans `p9-t10` (TicketsTree, fr, index, tests ; budget mesuré 222,4 kB) : finir la tâche, gate complète, relecture |
| T11 Kanban | acceptée | `feat/p9-t11` | rebase + gate + intégration |
| T12 notes | livrée, relecture interrompue | `feat/p9-t12` | relire ; **point bloquant probable** : la frappe tapée entre l'autosauvegarde et le renommage automatique (ou un renommage manuel de la note ouverte) part vers l'ancien chemin, est refusée (CONFLICT) et perdue. Exiger : vider le tampon avant de renommer et rediriger les sauvegardes vers le nouveau chemin, avec un test. |
| T13 UI de bureau | à lancer | — | dépend de T2, T4 (faits) et T7 |
| T14, T15 | vague 2 | — | T14 ← T6 ; T15 ← T2, T3 |
| T16 E2E | vague 3 | — | ← T6, T7, T15 |

Ordre d'intégration conseillé : T7, T11, T9, T8, puis T6, T12, T10 ; ensuite T13, vague 2, vague 3, jalon partiel (budget, contrôle visuel 98–106 sombre et clair, rapport de vague).

## Commandes

- Intégrer une tâche acceptée (rebase sur `phase/9`, gate complète avec E2E, fast-forward, push), une à la fois :
  `/Users/galadrim/.claude/jobs/6b7663e6/tmp/integ9.sh t7`. Le script s'arrête sur un rebase en conflit ou une gate rouge ; journaux `gate-<tâche>.log`, `gate-unit-p9-<tâche>.log`, `gate-e2e-p9-<tâche>.log` dans le même dossier. Ce dossier appartient au job courant : s'il a disparu, la gate = `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts` (0 fail), `bun run --cwd e2e test`.
- Chaque dev reçoit son worktree `.claude/worktrees/p9-t<n>` et sa branche `feat/p9-t<n>` ; vérifier avant d'intégrer que chaque titre de commit fait moins de 50 caractères.

## Points d'attention

- Tests instables sous charge (plusieurs agents en parallèle) : `packages/daemon/src/code/watcher.test.ts` (« removing the watched directory itself… », délai 5 s) et `presence-guards.test.ts` ; un échec E2E isolé est passé à la relance. À stabiliser dans une prochaine tâche.
- Budget : T7 consomme +2,6 kB (sous-menu partagé) ; surveiller le cumul avec T6, T8, T10, T13 (plafond 230 kB jamais relevé).
- Réponses d'Adam (2026-09-27), écrites dans la spec §12.3 et les décisions 6, 7, 9 du plan (`phase/9`) : (1) toutes les mutations git de `/api/code` réservées à la machine locale ; (2) aucune note ne reste sans titre (titre obligatoire à la création) ; (3) le glisser-déposer réordonne aussi. Tâches complémentaires T3b, T7b, T10b, T12b listées dans le plan (« Suites des réponses d'Adam ») : `kibo-lead` les rédige à la reprise. T12b couvre aussi la perte de frappe au renommage.
- Le tag `v1.0.0` pointe l'ancien commit (seul `release.yml` diffère) ; la release publiée est correcte.
- Jalon de phase : version `1.1.0`, PR `phase/9` → `main`, CI verte sur tous les jobs, tag `v1.1.0`.
