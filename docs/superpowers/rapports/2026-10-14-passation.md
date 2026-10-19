# Passation — 14 octobre 2026

État de Kibo à la reprise : ce qui est publié, ce qui tourne, ce qui reste ouvert, et comment travailler.

## Publié

| Version | PR | Commit de fusion | Contenu |
|---|---|---|---|
| 0.23.0-alpha.1 | #26 | `c2913d44` | Phase 23 : doublons entre agents, actions sur les questions, Domaines & guidelines en dossiers (rapport `2026-10-12-jalon-v0.23.md`) |
| 0.23.0-alpha.2 | #27 | `5485d214` | SDK MCP 1.31.0 (alerte Dependabot haute), alerte « même fichier » plus directive, run repris sans doublons, oubli des états d'un run échoué ou annulé, ordre et usage des domaines par propriétaire, erreur des liens automatiques affichée, `KIBO_CLAUDE_ISOLATED=1` |
| 0.23.0-alpha.3 | #28 | `89610083` | Autocomplétion des skills au `/` (§32), agent de projet avec tous les skills, réglage « Tous les sous-agents » (§28.15), `ScrollPane` du SDK (notes, pages Vue, plan d'un ticket, page d'un run), front-matter masqué dans l'aperçu d'une note |

Chaque tag est une prérelease avec `latest.json`. La CI de `main` est verte sur `89610083`. La feuille de route est terminée : la suite se fait au fil des demandes d'Adam, en versions `0.23.0-alpha.N`.

## Ce qui tourne

- **Démon d'Adam** : 0.23.0-alpha.3 sur `127.0.0.1:4317`, lancé depuis le worktree `.claude/worktrees/run-v0.23a3`, journal `~/.kibo-daemon-v023a3.log` (filtrer `KIBO_READY`, qui contient l'URL d'appairage).
- **Sauvegardes** prises avant chaque mise à jour : `~/.kibo-avant-v023*-2026-10-13`, `~/.claude-agents-avant-v023*-2026-10-13`, `~/.claude-skills-avant-v023*-2026-10-13`. `~/.claude` est resté identique à chaque démarrage.
- **Mise à jour du démon**, dans l'ordre :
  1. Arrêter l'ancien.
  2. Sauvegarder `~/.kibo`, `~/.claude/agents` et `~/.claude/skills`.
  3. Créer un worktree détaché au tag.
  4. Lancer `bun install --frozen-lockfile`, puis `bun run --cwd packages/ui build`.
  5. Démarrer : `bun packages/daemon/src/main.ts --ui packages/ui/dist --port 4317`.
  6. Vérifier avec `diff -rq` que `~/.claude` n'a pas changé.

## /full-delivery dans Kibo

- Le skill `~/.claude/skills/full-delivery` détecte un run Kibo par `KIBO_RUN_TOKEN` et lit alors `reference/kibo.md`. La livraison se fait dans le run lui-même : ni `delivery-queue`, ni `claude --bg`, ni slot `pr`. Les questions passent par `mcp__kibo__ask_user`, les captures sont écrites en chemins dans le fil. Hors Kibo, le comportement est inchangé.
- Sauvegarde du skill d'avant : `~/.claude-skill-full-delivery-avant-kibo-2026-10-13`. Le skill est aussi modifié par une autre session d'Adam : relire avant d'y toucher.
- L'agent `client-livraison` a « Tous les sous-agents » activé (fait par Adam) : la porte qualité et ses relecteurs de plugins passent la garde.
- Limite connue : la livraison travaille dans le worktree de `delivery-worktree`, pas dans celui du run. La page « Changements » ne montre donc pas ce diff.

## Ouvert

| Sujet | État | Qui |
|---|---|---|
| Alerte Dependabot `glib` (modérée, Linux) | Aucune version de Tauri (2.x ni 3.0 alpha) n'embarque glib ≥ 0.20. Code fautif jamais appelé. Laissée ouverte. | Adam : fermer en « risque toléré » ou attendre Tauri, puis `cargo update` |
| `KIBO_CLAUDE_ISOLATED=1` | Jamais observé avec un vrai claude | Au prochain vrai run de test : lire `system/init` (plugins, agents, skills vides) et vérifier si `~/.claude/CLAUDE.md` est encore chargé |
| E2E `project-agent.spec` « renomme, réassigne, rouvre et archive » | Passe seul, échoue en `--repeat-each 2` (état partagé entre passages) ; a aussi échoué une fois en CI | Prochaine version : isoler ses données |
| E2E instables sous charge | `catalog.spec:55`, `visibility.spec:39`, `ia`, `help`, `agents-dock`, test démon `code-service` (watcher) | Relancer quand la charge est sous 16 ; ne jamais conclure sous charge |
| `orchestrator.ts`, `runner.ts` | Respectivement 298 et 300 lignes | Découper avant tout ajout |
| Réécriture d'un `/skill` | Un `/id` dans un bloc de code entouré de blancs est aussi réécrit | Cas marginal, à traiter si gênant |
| PDF du design (65 et 70 Mo) | Au-dessus de l'avertissement GitHub de 50 Mo | Adam : Git LFS ou non |
| Signature Apple | Auto-signé | Adam, à la fin du projet |

## Méthode

- **Une tâche, un worktree** sous `.claude/worktrees/`. Le dev (`kibo-dev`) livre en TDD, puis le `kibo-reviewer` relit. Le chef assemble sur une branche `fix/0.23-alphaN`, ajoute le commit `chore: version …` (`bun apps/desktop/scripts/version.ts set …`) et la section du `CHANGELOG.md`.
- **Gate locale** : `bash .claude/worktrees/_outils/gate.sh <worktree>`, une seule à la fois, sous le verrou `mkdir .claude/worktrees/_outils/.integ.lock`. Elle fait check, typecheck, build UI, budget, smoke desktop si `apps/desktop` change, tests unitaires puis E2E.
- **Charge** : lancer les suites lourdes l'une après l'autre. Avec deux devs en parallèle, la charge monte au-delà de 40 et les E2E échouent par délai.
- **Publication** :
  1. Pousser la branche.
  2. Ouvrir la PR avec `gh pr create`, sans mention d'IA.
  3. Attendre la CI verte. Relancer `--failed` une fois si l'échec vient d'un test instable connu.
  4. Fusionner en `--merge` et taguer le commit de fusion.
  5. Vérifier la release (prérelease et `latest.json`) et la CI de `main`.
- **Budget UI** : l'entrée fait 220,8 kB gzip. Plafond de travail : 223 400 octets. Plafond du script : 230 kB, jamais relevé.
- **Ne jamais** : lire `~/.tauri/kibo-updater.key`, afficher `~/.kibo/token` ou l'URL d'appairage, toucher au trousseau ou à `com.atlas.board`, utiliser `git stash`, `SKIP_GATE` ou un force-push, fusionner une tâche refusée.
- **Classifieur** : il a refusé la modification d'un réglage d'agent par RPC avec le jeton d'Adam. Ne pas contourner : demander à Adam de le faire dans l'interface.

## Ménage possible

Le dépôt compte plus de 300 worktrees sous `.claude/worktrees/` (phases 9 à 23, runs `run-v0.19` à `run-v0.23a2`). Seuls `run-v0.23a3` (démon d'Adam) et `_outils` servent encore. Supprimer les autres relève d'Adam, avec `git worktree remove` puis `git worktree prune`.
