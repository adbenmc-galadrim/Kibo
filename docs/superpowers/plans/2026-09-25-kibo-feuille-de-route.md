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

Plan : `2026-10-04-kibo-phase-13.md` · Spec : composants §19, conception §19, IA §14.

Capacités déclarées dans le manifeste et appliquées par la CSP de chaque composant ; kit 3D (three.js) ; fichiers de projet hors CRDT (glTF exporté de Blender, images, audio) ; gabarits (3D, jeu, graphique, tableau) ; jeux (boucle d'animation, clavier et manette, plein écran) ; composants qui se parlent (sélection partagée) ; réglages générés depuis le manifeste ; la création par l'IA connaît ces capacités.

## Phase 14 · Installation et finition

`.dmg` soigné (et version Intel), signature et notarisation Apple (compte d'Adam) ; Linux : dépôt apt et rpm signé, script d'installation, fichier `.desktop` et icônes ; assistant de premier lancement (vérifie `claude`, `git`, `gh`, guide l'installation et la connexion, premier projet) ; « Lancer au démarrage » ; « Quoi de neuf » après mise à jour ; « Signaler un problème » sans secret ; sauvegardes automatiques de `~/.kibo` ; aide des raccourcis (⌘/) ; fenêtre « À propos ».

**Didacticiel après l'assistant** (demande d'Adam du 2026-10-04) : proposé, jamais imposé (on peut le passer et le reprendre plus tard), il fait le tour de Kibo par la pratique dans un projet de démonstration avec des tickets de démonstration. Parcours en petites étapes, chacune faite par l'utilisateur : créer et déplacer un ticket dans le Kanban, lier deux tickets et les voir dans le graphe, écrire une note avec la barre d'outils, réorganiser et redimensionner le tableau de bord, assigner un ticket à un agent (avec le faux agent de démonstration, sans consommer de token), créer un composant en démonstration. Progression visible, reprise à l'étape en cours, projet de démonstration supprimable en un clic.

## Phase 15 · Intégrations Figma et Penpot (v1.6)

Plan : `2026-10-05-kibo-phase-15.md` · Spec : conception §21, intégrations §15, composants §19 point 13.

Cadres Figma et Penpot affichés dans les composants (intégration côté démon, jeton dans le trousseau, cache local) : Figma par jeton personnel (API REST) en plus du serveur MCP local, Penpot (penpot.app ou instance auto-hébergée) par jeton d'accès, cache hors CRDT revalidé par version et servi hors ligne avec l'état « périmé », images servies par le port bac à sable, capacité `design`, widget intégré « Maquette », liens cadre ⇄ ticket étendus à Penpot, écran 16 et dialogues de connexion ; tests contre de faux serveurs Figma et Penpot locaux.

## Phase 16 · Retours v1.6

Plan : `2026-10-06-kibo-phase-16.md` · Spec : conception §22, composants §20, agents §16.

Quatre défauts repérés au tournage des vidéos (widget et page Graphe cadrés à 41 % : grille compacte des tickets sans dépendance ; cases à cocher rendues en texte dans l'aperçu des notes ; widget Notes en Markdown brut ; widget Tickets étroit qui ne montre que « DEMO- »), éclairage réglable de la visionneuse 3D par le kit `@kibo/sdk/three` (préréglages Doux / Studio / Contraste, intensité, ombres, lumière d'ambiance, défauts plus doux, rendu identique en sombre et en clair), filtre de projet mémorisé sur la page Agents ; parcours E2E étendus, écrans 150 et 151 à dessiner dans une prochaine PR.

## Phase 17 · Emis sur Kibo (v0.17.0-alpha.1)

Plan : `2026-10-07-kibo-phase-17.md` · Spec : conception §23, agents §17, code et onglets §15, composants §21.

Développer Emis uniquement avec Kibo (décision d'Adam du 2026-10-06). Kibo gagne cinq fonctions génériques : étiquettes sur les tickets (convention `clé:valeur`, filtres Tickets et Kanban, fiche) ; références `git_branch` (branche et base d'un ticket) et `import_ref` (identité d'import) ; réglages de worktree locaux par projet (base `origin/dev`, chemin `../emis-{slug}`, commande `pnpm worktree {branch}`, adoption des worktrees existants) ; mode de permission `auto` et règles `allow` par profil, un run par ticket ; `base`/`head` des PR et « Terminé » seulement quand la PR est fusionnée sur la branche d'intégration, cascade des PR empilées. Puis `scripts/import-emis` (plan de 72 PR, chapitres, arbitrages, TODO, notes de pilotage et briefs ; idempotent, testé sur un dossier fictif), sauvegarde de `~/.kibo`, import réel, ticket pilote, bascule (`plan-data.js` et `emis-board` retirés). Écrans 166 à 169 à dessiner dans une prochaine PR.

## Phase 18 · Agent de projet (v0.18.0-alpha.1)

Plan : `2026-10-09-kibo-phase-18.md` · Spec : conception §24.

Demande d'Adam du 2026-10-09 : un agent de gestion de projet par projet, dans un panneau latéral (⌘J), qui garde le contexte (session reprise, note mémoire, digest « depuis ton dernier tour »), lit le projet par le serveur MCP `kibo` étendu et **propose des lots d'actions** (tickets, agents, questions, notes) qu'Adam valide d'un clic ; « Nouvel agent de projet » repart d'une session neuve. Écrans 174 à 177.

## Phase 19 · Jeux itch.io et Storybook (à planifier après la phase 18)

Demande d'Adam du 2026-10-06 ; entrée de feuille de route seulement, le plan détaillé et la spec viennent après la phase 18 (repoussée d'une phase le 2026-10-09 au profit de l'agent de projet).

1. **Jeux HTML5 d'itch.io dans Kibo** (par exemple `https://sigmatronic.itch.io/una-war`) : composant « Jeu » qui affiche l'embed HTML5 d'itch.io dans un cadre. À trancher : embed par iframe de la page d'embed d'itch.io (`itch.io/embed-upload/<id>` ou l'URL `html.itch.zone` servie par la page du jeu), sandbox de l'iframe et permissions (`fullscreen`, `gamepad`, `autoplay` audio, pointeur), CSP du démon et règle réseau de la spec de conception §21.10 (origines `itch.io`, `itch.zone`, `hwcdn.net` déclarées par le composant), capacité `network` ou `embed` dans le manifeste, plein écran par le mode focus du shell (§19), aucun jeton ni compte itch.io, **hors ligne impossible** (à afficher : « Ce jeu a besoin d'Internet. »), stockage local du jeu (localStorage de l'iframe) hors de Kibo, respect des conditions d'itch.io pour l'embed (vérifier qu'un embed hors itch.io est autorisé par le développeur du jeu).
2. **Storybook comme Figma et Penpot** (spec intégrations §15, conception §21) : lier une story (Storybook local d'un worktree ou déployé) dans le composant Maquette pour comparer l'implémentation au design, la story étant interactive. À trancher : forme d'URL acceptée (`<origine>/iframe.html?id=<story>&viewMode=story`, `?path=/story/…` convertie), fournisseur `storybook` dans `DesignRef`/`parseDesignUrl` avec `designUrlProblem`, rendu par iframe plutôt que par image (pas de cache ni de vignette : état « Storybook injoignable » quand le serveur local est éteint), réutilisation de la liste de cadres et de la navigation du composant Maquette (phase 16 T9), **comparaison** côte à côte ou superposition avec un cadre Figma/Penpot (curseur de comparaison, opacité réglable, mêmes dimensions), sécurité de l'iframe (sandbox, origine locale `127.0.0.1:6006` autorisée par §21.10, aucune origine distante sans déclaration), Storybook **du worktree d'un ticket** (le composant propose l'origine du Storybook lancé dans le worktree de la branche du ticket, par un port lu dans `.env` ou un réglage), écran à dessiner. Emis a un Storybook (`pnpm storybook`, `@repo/ui`, port 6006, stories `Screens/*` de toutes les pages Figma) : la fonction est **utile dès la phase 17** mais reste en phase 19 pour ne pas alourdir l'import ; en attendant, l'URL d'une story se met dans la description du ticket.
