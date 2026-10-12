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

## Phase 19 · Jeux itch.io et Storybook (v0.19.0-alpha.1)

Plan : `2026-10-09-kibo-phase-19.md` (livrée) · Spec : conception §25 (amende §6, §8, §11, §19, §21, §22.9, §23.4), composants §4.2 et §19.

Demande d'Adam du 2026-10-06, planifiée le 2026-10-09 après l'agent de projet ; toutes les décisions prises par le chef d'équipe (délégation d'Adam du 2026-10-09). Un seul mécanisme pour les deux fonctions : la **page relais** `GET /e/<jeton>` du port bac à sable, sans script, dont la CSP `frame-src` ne cite que l'origine vérifiée par le démon ; la CSP de l'interface ne change pas, un composant ne choisit jamais l'origine ni les attributs de l'iframe.

1. **Jeu itch.io** : composant intégré « Jeu itch.io » (`components/itch`), capacité `embed` et déclaration `embeds: ["itch.io"]` dans le manifeste ; le code d'intégration d'itch.io (ou l'adresse `itch.io/embed-upload/<id>`) est la seule saisie, jamais l'URL `html.itch.zone` ; vérification d'intégrabilité par en-têtes (`EMBED_REFUSED` sur `x-frame-options` ou `frame-ancestors`, cache une heure), « Ce jeu a besoin d'Internet. » hors ligne, plein écran par le mode focus, sauvegardes du jeu dans le stockage de son origine hors de Kibo, aucun compte, attribution « Fourni par itch.io ».
2. **Storybook** : fournisseur `storybook` de `DesignFrameKey` et `parseDesignUrl` (`iframe.html?id=…`, `?path=/story/…`, normalisée), rendu par iframe sans cache ni vignette (« Storybook injoignable » quand le serveur est éteint, nom lu dans `index.json`), origine déclarée par projet (réglage local `storybook`, défaut `http://localhost:6006`, section du dialogue « Modifier le projet ») et origines des worktrees (port lu dans `.env`/`.env.local`, menu « Storybook : Projet ▾ » du widget), comparaison avec un cadre Figma ou Penpot côte à côte ou en superposition (opacité, curseur, mêmes dimensions, zoom partagé) ; une story ne se lie pas encore à un ticket.
3. Tests sans réseau : faux itch.io (port + 5000) et faux Storybook (port + 6000), `embeds.spec.ts` sur 4461–4462 (plage E2E portée à 4470, démos 4471–4499). Budget ≤ 226,4 kB avec compensation en T1 (textes marketplace, sécurité et collab sortis de l'entrée). Écrans 178 à 182 (page Penpot 27).

## Phase 20 · Voir et comprendre les agents (v0.20.0-alpha.1)

Plan : `2026-10-10-kibo-phase-20.md` (livrée) · Spec : conception §26 (amende §7, §8, §22.1, §23.12 ; agents §3, §4, §8, §18). **Livrée** le 2026-10-11 (`v0.20.0-alpha.1`, rapport `rapports/2026-10-11-jalon-v0.20.md`) ; planifiée le 2026-10-10 (spec validée par Adam le même jour) ; §26.11 et §26.12 livrés par le correctif `0.19.0-alpha.2`, hors du plan.

Demande d'Adam du 2026-10-09 (« les agents sont tous cachés ») : fil narratif tiré de la transcription et copié dans Kibo, plan et compte rendu tenus par l'agent (`ticket_progress`, partagés avec le ticket), rappels sans blocage, volet du pied de page cliquable et redimensionnable en trois colonnes, onglet Activité du ticket, mentions d'agent cliquables (carte, volet, page dédiée), page Questions refondue avec destinataires par projet, export et réponse collée, tickets démarrables (état calculé), graphe lisible (vagues, terminés repliés, liens réduits, focus). Écrans 183 à 188k (page Penpot 29).

## Phase 21 · Les agents parlent à l'agent de projet (v0.21.0-alpha.1)

Plan : `2026-10-11-kibo-phase-21.md` (livrée) · Spec : conception §27.1 à §27.11 (amende §23.12.2, §24.3, §24.4, §24.5, §24.7, §26.2, §26.3 ; agents §3). **Livrée** le 2026-10-12 (`v0.21.0-alpha.1`, rapport `rapports/2026-10-12-jalon-v0.21.md`) ; planifiée le 2026-10-11 (cadre validé par Adam le 2026-10-10, détail tranché par le lead dev).

Outil `signal_project` (ticket à créer, contexte, blocage, question) pour les runs de ticket, signaux stockés par le démon et visibles dans le fil du run ; réveil automatique de l'agent de projet pour les tickets à créer et les blocages, au plus une fois par 10 minutes par projet, signaux regroupés ; boîte à signaux dans le panneau de l'agent de projet (onglet Signaux, pastille chiffrée) ; les lots citent les signaux (`signals`, `dismissSignal`) et les règlent à la validation ; rien n'est créé sans lot validé. Écrans 189 à 191 (page Penpot 30).

## Phase 22 · Agents et skills (v0.22.0-alpha.1)

Plan : `2026-10-12-kibo-phase-22.md` (livrée) · Spec : conception §28.1 à §28.14 (amende §5, §7, §8, §20.5, §24.2, §26.4 ; agents §3, §5, §7, §8). **Livrée** le 2026-10-12 (`v0.22.0-alpha.1`, rapport `rapports/2026-10-12-jalon-v0.22.md`) ; planifiée le 2026-10-12 (spécifiée le même jour, décisions d'Adam §28.12 : agents de Kibo dans `~/.claude/agents/kibo-*`, nommage lisible, nom de run `projet · agent · ticket` ; maquettes 192 à 196 en cours sur la page Penpot 31, à ajuster après implémentation). Onze tâches en cinq vagues : T0 vérification du CLI sans token, T1 schéma et noyau pur (retrait des profils), T2 fichiers d'agents et migration, T3 skills et reviews, T4 lancement par agent et garde, T5 interface Agents, T6 interface Skills, T7 câblage et découpage de `daemon.ts`, T8 E2E (ports 4469-4470), T9 Penpot, T10 jalon.

Demande d'Adam du 2026-10-12 : des **agents** (plus de « rôles » ni de profils), chacun avec sa spec façon `CLAUDE.md`, **globaux** (`~/.claude/agents`) ou **propres à un projet** (`<projet>/.claude/agents`), stockés dans les fichiers Claude Code avec un historique des versions restaurable ; sous-agents appelables (un chef d'orchestre appelle Livraison, Review et SEO), skills autorisés appliqués par une garde déterministe ; espace **Skills** (cet ordinateur, projets, plugins en lecture seule avec « Copier pour modifier »), éditeur avec aperçu, historique ; **review des skills** par l'agent en fin de run (outil MCP `skill_review`, rappel sans blocage), notes à **intégrer** (diff) ou **ignorer** ; migration des profils et des guidelines de profil ; détection des skills utilisés sans token dans la transcription ; écriture concurrente détectée par empreinte, jamais d'écrasement silencieux.

## Phase 23 · Éviter le code dupliqué entre agents (v0.23.0-alpha.1)

Plan : `2026-10-12-kibo-phase-23.md` · Spec : conception §29 (amende §23.12.2, §24.4, §24.5, §26.2, §26.4, §28.5 ; agents §3 ; §29.15 décisions du lead dev). **Planifiée** le 2026-10-12 (spécifiée le même jour, décisions d'Adam : section « Travail en cours » et `peek_work`, vérification par `PostToolUse` et balayage 5 min avec alerte dédoublonnée par `additionalContext`, factorisation par l'agent seul, lien « bloque » posé par Kibo et annulable, agent de projet non nécessaire ; maquettes 197 à 201b à dessiner sur la page Penpot 32 avant l'interface). Base : `phase/22` fusionnée après la release v0.22. Quatorze tâches en six vagues : T0 vérifications sans token, T1 schéma, T2 Penpot (dessin), T3 noyau pur, T4 index et store, T5 section et `peek_work`, T6 détection et livraison, T7 lien automatique et RPC, T8 et T9 interface, T10 câblage et intégration, T11 E2E (ports 4471-4472), T12 Penpot (export), T13 jalon.

Demande d'Adam du 2026-10-12 : plusieurs agents sur des tickets différents d'un même projet dupliquent du code sans le savoir. Trois couches, zéro token pour l'état : **voir avant de coder** (section « Travail en cours sur le projet » à chaque tour, tirée du diff git et des plans ; outil MCP en lecture seule `peek_work { run, path? }`), **détecter pendant le run** (vérification à chaque écriture par le hook `PostToolUse`, balayage complet toutes les 5 minutes ; trois critères : même fichier, même export, bloc quasi identique par fenêtres de lignes normalisées ; alerte dédoublonnée dans l'`additionalContext` du prochain appel d'outil, moment « Recouvrement » dans le fil des deux runs), **factoriser seul** (l'agent alerté reprend le code de l'autre run à l'identique ou extrait une fonction commune, sans validation) et **lier seul** (dépendance constatée par un import non résolu ou une reprise à l'identique ⇒ lien « BOU-12 bloque BOU-15 » posé par Kibo, exception explicite à §24.4, annulable d'un clic). Réglages par projet, recouvrements ignorables, runs `repo` et `worktree` comparés, espaces partagés jamais comparés entre eux. Écrans 197 à 201b (page Penpot 32).
