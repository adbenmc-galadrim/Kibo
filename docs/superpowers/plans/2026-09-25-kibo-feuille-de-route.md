# Kibo — feuille de route

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` · Règles de travail : `CLAUDE.md`.

Chaque phase se termine par un **jalon** : tag `v0.<n>`, rapport du chef d'équipe, validation d'Adam avant la phase suivante.
Seule la phase 1 est détaillée en tâches (`2026-09-25-kibo-mvp.md`). Pour chaque phase suivante, `kibo-lead` écrit d'abord la
spec du sous-système quand la spec générale ne suffit pas (§3 : « chaque sous-système hors MVP aura sa propre spec »), puis le plan.

| Phase | Jalon | Sous-systèmes | Plan |
|---|---|---|---|
| 1. MVP | v0.1 | A noyau, B SDK minimal, C Kanban + Tickets | `2026-09-25-kibo-mvp.md` |
| 2. Agents | v0.2 | D orchestration, M1 notifications | `2026-09-26-kibo-agents.md` (livrée) |
| 3. Code et onglets | v0.3 | G1 Git local, G2 GitHub, vue Changements, onglets, aperçu de fichier | `2026-09-26-kibo-code-onglets.md` (livrée) |
| 4. Composants | v0.4 | B complet (versioning, sandbox), C Graphe + Notes, N1 Markdown/Obsidian | `2026-09-26-kibo-composants.md` (livrée) |
| 5. Intégrations | v0.5 | T1 Issues/Projects, C1 Actions, D1 Figma MCP, X1 MCP générique | `2026-09-26-kibo-integrations.md` (livrée) |
| 6. IA dans le produit | v0.6 | E onboarding, génération de composants par IA | `2026-09-26-kibo-ia.md` (livrée) |
| 7. Sync et marketplace | v1.0 | G multi-utilisateur, H marketplace, durcissement OS du sandbox | `2026-09-26-kibo-sync-marketplace.md` (livrée) |

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
- Entités déclarées par un composant (`acme.bug`, spec §5) : reportées après v1.0 (spec composants §14).
- Transverse (écarts de v0.3, tâches 35 à 39) : UI chargée à la demande avec un budget du chargement initial (≤ 230 kB gzip), densité 13 px des maquettes, écran 12 « Mes tickets » dans la barre latérale, en-tête de workspace (monogramme, nom, renommage).

**Sortie** : un composant tiers sandboxé qui tente une action non déclarée est bloqué (test de conformité) ; écrans 6, 10, 11, 12, 29, 30 ; `bun run budget` vert.

## Phase 5 · Intégrations (v0.5)

Adaptateurs `pull / push / map` : GitHub Issues/Projects, GitHub Actions, Figma via MCP, connecteur MCP générique. Secrets dans le trousseau.

**Sortie** : synchronisation aller-retour d'un ticket avec une issue sur un dépôt de test ; écran 16.

## Phase 6 · IA dans le produit (v0.6)

Assistant d'onboarding (rôle → composants conseillés) et génération de composants par IA via le générateur (spec E).

## Phase 7 · Sync et marketplace (v1.0)

Serveur de sync Loro, permissions par projet, multi-utilisateur temps réel (spec G) ; marketplace de composants (spec H) ;
durcissement OS du sandbox (Landlock ou bubblewrap, profil sandbox macOS) ;
plusieurs workspaces : création et bascule depuis l'en-tête de la barre latérale (point E6 du plan de phase 4, en attente d'Adam).

## Après v1.0 · Phase 8 (v1.1)

Mises à jour de l'application de bureau par l'updater Tauri et les releases GitHub signées (spec I, plan `2026-09-27-kibo-mises-a-jour.md`) ;
import du projet Kibo dans Kibo (dogfooding).

## Après v1.1 · Phases 9 à 11 (v1.1, v1.2, v1.2.1)

Finitions UI et UX (plan d'action `2026-09-27-kibo-plan-action-ui-ux.md`, lots 1 à 9), un seul démon par dossier de données, durcissements, correctifs (plans `2026-10-03-kibo-phase-10.md` et `2026-10-03-kibo-phase-11.md`).

## Phase 12 (v1.3) · Corrections, notes, graphe, tableau de bord

Plan `2026-10-04-kibo-phase-12.md` : colonnes du Kanban, icône, garde clavier, onglets fermés, historique des runs ; éditeur de notes (barre d'outils, bulle, menu `/`, aperçu en direct, images collées) ; graphe au pavé tactile et widget par format ; tableau de bord sans trou en hauteur et taille libre à la poignée (demandes d'Adam du 2026-10-04).

## Phase 13 · Composants plus riches

Capacités déclarées dans le manifeste et appliquées par la CSP de chaque composant ; kit 3D (three.js) ; fichiers de projet hors CRDT (glTF exporté de Blender, images, audio) ; gabarits (3D, jeu, graphique, tableau) ; jeux (boucle d'animation, clavier et manette, plein écran) ; composants qui se parlent (sélection partagée) ; réglages générés depuis le manifeste ; la création par l'IA connaît ces capacités.

## Phase 14 · Installation et finition

`.dmg` soigné (et version Intel), signature et notarisation Apple (compte d'Adam) ; Linux : dépôt apt et rpm signé, script d'installation, fichier `.desktop` et icônes ; assistant de premier lancement (vérifie `claude`, `git`, `gh`, guide l'installation et la connexion, premier projet) ; « Lancer au démarrage » ; « Quoi de neuf » après mise à jour ; « Signaler un problème » sans secret ; sauvegardes automatiques de `~/.kibo` ; aide des raccourcis (⌘/) ; fenêtre « À propos ».

**Didacticiel après l'assistant** (demande d'Adam du 2026-10-04) : proposé, jamais imposé (on peut le passer et le reprendre plus tard), il fait le tour de Kibo par la pratique dans un projet de démonstration avec des tickets de démonstration. Parcours en petites étapes, chacune faite par l'utilisateur : créer et déplacer un ticket dans le Kanban, lier deux tickets et les voir dans le graphe, écrire une note avec la barre d'outils, réorganiser et redimensionner le tableau de bord, assigner un ticket à un agent (avec le faux agent de démonstration, sans consommer de token), créer un composant en démonstration. Progression visible, reprise à l'étape en cours, projet de démonstration supprimable en un clic.

## Ensuite · Intégrations

Cadres Figma et Penpot affichés dans les composants (intégration côté démon, jeton dans le trousseau, cache local).
