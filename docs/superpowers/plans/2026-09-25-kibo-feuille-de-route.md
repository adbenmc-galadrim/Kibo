# Kibo — feuille de route

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` · Règles de travail : `CLAUDE.md`.

Chaque phase se termine par un **jalon** : tag `v0.<n>`, rapport du chef d'équipe, validation d'Adam avant la phase suivante.
Seule la phase 1 est détaillée en tâches (`2026-09-25-kibo-mvp.md`). Pour chaque phase suivante, `kibo-lead` écrit d'abord la
spec du sous-système quand la spec générale ne suffit pas (§3 : « chaque sous-système hors MVP aura sa propre spec »), puis le plan.

| Phase | Jalon | Sous-systèmes | Plan |
|---|---|---|---|
| 1. MVP | v0.1 | A noyau, B SDK minimal, C Kanban + Tickets | `2026-09-25-kibo-mvp.md` |
| 2. Agents | v0.2 | D orchestration, M1 notifications | à écrire |
| 3. Code et onglets | v0.3 | G1 Git local, G2 GitHub, vue Changements, onglets, aperçu de fichier | à écrire |
| 4. Composants | v0.4 | B complet (versioning, sandbox), C Graphe + Notes, N1 Markdown/Obsidian | à écrire |
| 5. Intégrations | v0.5 | T1 Issues/Projects, C1 Actions, D1 Figma MCP, X1 MCP générique | à écrire |
| 6. IA dans le produit | v0.6 | E onboarding, génération de composants par IA | spec E puis plan |
| 7. Sync et marketplace | v1.0 | G multi-utilisateur, H marketplace, durcissement OS du sandbox | specs G et H puis plan |

## Phase 1 · MVP (v0.1)

Créer un projet, lui ajouter une page, y poser un Kanban et une liste de tickets, sur macOS et Linux, en desktop et dans le navigateur.

- Monorepo Bun, Biome, CI GitHub Actions (macOS + Linux).
- Schémas Zod ; docs Loro workspace et projet ; arbres des pages et des tickets ; workflow et liens.
- Démon : persistance SQLite atomique, API HTTP + WebSocket, appairage par jeton, sert l'UI.
- SDK minimal (manifest, client, SDK simulé, suite de conformité v0) ; composants Tickets et Kanban écrits avec.
- UI : shell (sidebar, projets, pages), dialogues Nouveau projet / Nouvelle page / Nouveau ticket, ajout de composant.
- Coque Tauri avec le démon en sidecar.

**Sortie** : le parcours Playwright projet → page → Kanban → ticket passe en CI sur macOS et Linux ; le smoke test Tauri passe ;
les données survivent à un redémarrage du démon ; écrans conformes aux maquettes 1, 2, 3, 8, 9, 24, 25, 26, 31 en sombre et en clair.

## Phase 2 · Agents (v0.2)

Assigner un ticket à un agent et suivre son run sans consommer de tokens pour l'état.

- Profils d'agent ; file d'attente avec créneaux hôte et profil, seuils CPU/RAM, priorité, `waiting_input` qui libère le créneau.
- Runner Claude Code headless, hooks HTTP à jeton par run, lecture du transcript, `--resume` pour répondre.
- Guidelines workspace → projet → domaine matérialisées en `.md` ; domaines.
- Moteur de règles déclaratif (run terminé → En review, sous-tickets terminés → parent Terminé).
- UI : barre d'état, tiroir, page Files d'attente, Agents, Assigner à un agent, notifications système.
- Faux binaire `claude` qui rejoue des scripts de hooks.

**Sortie** : cycle complet d'un run joué par le faux `claude` en CI (file → run → question → réponse → terminé) ; 4 runs
demandés sur 3 créneaux ⇒ 1 en file ; écrans 5, 13, 14, 17, 27, 28.

## Phase 3 · Code et onglets (v0.3)

Voir, modifier et livrer le code d'un worktree sans quitter Kibo.

- Watchers git et `gh` ; vue Changements (diff unifié et côte à côte, édition CodeMirror 6, indexation par fichier et par bloc).
- Commit en un clic (message déterministe), amend et reformulation des commits non poussés, pousser et créer la PR.
- Liens de fichiers et aperçu (Shiki) ; barre d'onglets avec épinglage persisté ; palette `⌘K`.

**Sortie** : parcours Playwright modifier → commit → amend → PR (sur un dépôt de test et un faux `gh`) ; écrans 18, 20 à 23.

## Phase 4 · Composants (v0.4)

- Versioning semver avec « mettre à jour partout / nouvelle version » et migrations ; sandbox (iframe + processus séparé) avec permissions vérifiées par le démon ; empreinte qui redemande la confiance.
- `kibo component new` ; composants Graphe de dépendances (chemin critique) et Notes (Markdown, Obsidian).

**Sortie** : un composant tiers sandboxé qui tente une action non déclarée est bloqué (test de conformité) ; écrans 6, 10, 11, 29, 30.

## Phase 5 · Intégrations (v0.5)

Adaptateurs `pull / push / map` : GitHub Issues/Projects, GitHub Actions, Figma via MCP, connecteur MCP générique. Secrets dans le trousseau.

**Sortie** : synchronisation aller-retour d'un ticket avec une issue sur un dépôt de test ; écran 16.

## Phase 6 · IA dans le produit (v0.6)

Assistant d'onboarding (rôle → composants conseillés) et génération de composants par IA via le générateur (spec E).

## Phase 7 · Sync et marketplace (v1.0)

Serveur de sync Loro, permissions par projet, multi-utilisateur temps réel (spec G) ; marketplace de composants (spec H) ;
durcissement OS du sandbox (Landlock ou bubblewrap, profil sandbox macOS).
