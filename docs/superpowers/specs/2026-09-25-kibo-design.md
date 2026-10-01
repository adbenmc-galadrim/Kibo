# Kibo — Spécification de conception

- **Date** : 2026-09-25
- **Statut** : design validé, en relecture
- **Maquettes** : Penpot auto-hébergé, fichier « Kibo » (pages `00` à `06`). Mise en route et export : `design/penpot/README.md`. PDF : `design/pdf/`.

---

## 1. Vision

Kibo est un **centre de contrôle local-first pour projets de code**. Ouvert toute la journée, il remplace les outils éparpillés : tickets, maquettes, trajectoire du projet et agents IA sont réunis dans un seul espace, composé librement par chaque utilisateur.

**Utilisateurs.** D'abord l'auteur, en solo. Ensuite des collègues, jusqu'à ce que le produit soit mûr. Plus tard, peut-être un produit commercial. Le projet n'a aucun lien avec Galadrim.

**Pourquoi.** Kibo doit être moins cher que les outils SaaS, local, entièrement maîtrisé et facile à faire évoluer selon l'usage réel.

**Critère de réussite.** On ouvre Kibo le matin et on voit, pour tous ses projets : ses tickets restants, les tickets et sous-tickets à créer, les tickets assignés à des agents et l'état de ces agents, les guidelines qui s'appliquent, les maquettes liées.

## 2. Principes directeurs

1. **Local-first.** Les données vivent sur la machine. Kibo fonctionne hors ligne. La synchronisation et le multi-utilisateur viendront ensuite, sans réécriture.
2. **Zéro token pour l'état.** Aucun LLM ne « déclare » un état. Tout changement d'état vient d'un événement déterministe (hook Claude Code, git, fichier, API) traité par du code.
3. **Maintenance par l'IA à bas coût.** Un seul langage (TypeScript), des contrats typés, des générateurs scriptés et des tests qui ne consomment pas de tokens. Un agent doit pouvoir contribuer sans relire tout le projet.
4. **Dogfooding du SDK.** Les composants intégrés sont écrits avec le SDK public, comme n'importe quel composant tiers.
5. **Chaque utilisateur module son espace.** Un dev et un designer composent des pages différentes sur le même projet.

## 3. Découpage en sous-systèmes

| # | Sous-système | MVP |
|---|---|---|
| A | **Noyau** : shell, workspace → projets → pages, mise en page, stockage local-first | ✅ |
| B | **SDK composants** : contrat, registre, confiance et sandbox, versioning | ✅ minimal |
| C | **Composants de base** : Kanban et Tickets (MVP), puis Graphe de dépendances et Notes | ✅ Kanban et Tickets |
| D | **Orchestration des agents** : ticket → agent, état en direct, guidelines | ❌ (anticipé dans A) |
| E | **IA dans le produit** : assistant d'onboarding, génération de composants | ❌ |
| F | **Intégrations** (voir §9) | ❌ |
| G | **Sync et multi-utilisateur temps réel** | ❌ (anticipé dans A) |
| H | **Templates et marketplace** | ❌ (templates de projet partiellement dans A) |

**Définition du MVP :** créer un projet, lui ajouter une page, y poser un Kanban et une liste de tickets.

Chaque sous-système hors MVP aura sa propre spec, puis son propre plan.

## 4. Architecture

```
┌─ Tauri (fenêtre native fine) ─┐   ┌─ Navigateur ─────┐
│        UI React / TS          │   │  même UI React   │
└──────────────┬────────────────┘   └────────┬─────────┘
               └──────── HTTP + WebSocket ───┘  (127.0.0.1, jeton d'appairage)
┌─ kibo-daemon (Bun / TypeScript, sidecar) ─────────────────────┐
│ Loro CRDT ↔ SQLite   │ Registre de composants │ Runner d'agents │
│ Récepteur de hooks   │ Watchers git / fs      │ Adaptateurs     │
│ Moteur de règles     │ Workers de composants  │ (GitHub, MCP…)  │
└───────────────────────────────────────────────────────────────┘
```

- **Le démon est l'unique porte d'entrée.** Il détient les données, lance les agents et sert l'UI. Tauri n'est qu'une fenêtre. La version web est l'UI servie par le même démon. La fenêtre garde une seule fonction propre : se mettre à jour (spec I).
- **Plateformes :** macOS et Linux dès le départ.

### Stack

| Couche | Choix | Raison |
|---|---|---|
| Fenêtre desktop | **Tauri 2** | Légère, native, intégration système (notifications, tray) |
| Démon | **Bun + TypeScript**, packagé en sidecar | Un seul langage, rapide, SQLite natif, Agent SDK en TS |
| Données collaboratives | **Loro** | CRDT avec **arbre déplaçable natif** (tickets et pages en profondeur illimitée), performant, prêt pour la sync |
| Persistance et index | **SQLite** (`bun:sqlite`) | Snapshots Loro, événements append-only, index de recherche |
| UI | **React + TypeScript + shadcn/ui** (le maximum de composants shadcn) + Tailwind | Cohérence, accessibilité, vitesse |
| Icônes | **Lucide** | Standard de shadcn |
| Police | **Geist / Geist Mono** | Police par défaut de shadcn |
| Validation | **Zod** | Schémas partagés entre démon, UI et SDK |
| Tests | `bun test`, fast-check, Playwright | Voir §11 |

**Risques notés :** Loro est plus jeune qu'Automerge ou Yjs. Le packaging du sidecar Bun pour macOS et Linux est à valider tôt.

## 5. Modèle de données

```
Workspace (1 doc Loro)
├─ projects[]           → références vers les docs projet
├─ guidelines/          → .md de niveau workspace
├─ domains[]            → ex. Facturation, DevOps, Core — chacun avec ses guidelines
├─ componentRegistry    → composants installés, versions, niveau de confiance, hash
└─ templates[]

Projet (1 doc Loro par projet = future unité de sync et de permissions)
├─ meta       : nom, dossier local, repo git, couleur
├─ pages      : LoroTree  → pages imbriquées, déplaçables ; type = dashboard | view
├─ tickets    : LoroTree  → sous-tickets en profondeur illimitée, déplaçables
│    └─ { id, key (KIB-12), title, description: LoroText, statusId, domainId,
│         assignee: {kind: human|agent, ref}, externalRefs[] (github, figma…) }
├─ links      : arêtes { from, to, type: blocks | relates }  → alimente le graphe
├─ workflow   : statuts configurables (les colonnes du Kanban s'y rattachent)
├─ guidelines/: surcharges de niveau projet
└─ instances  : { id, pageId, componentId@version, layout, config }
     └─ data  : espace de nommage privé par instance
```

**Règles :**
- Les **entités partagées** (ticket, lien, note, statut) ont un **schéma Zod central**. Les composants y accèdent via le SDK (`useEntities('ticket', filtre)`). Un composant peut **déclarer ses propres types d'entités** dans un espace de nommage (`acme.bug`), consommables par d'autres composants.
- Les **sous-tickets** alimentent l'avancement du parent (compteur = enfants directs terminés / enfants directs). Les **liens `blocks`** structurent le graphe de dépendances et la trajectoire.
- **Clés plates et stables** (`KIB-n`), jamais hiérarchiques : la hiérarchie se lit à l'indentation et au fil d'Ariane.
- **Bloqué** est un **statut manuel** avec un **motif obligatoire** : le ticket ne peut pas démarrer à cause d'une condition externe au projet (ex. informations attendues du client). Il a sa colonne dans le Kanban.
- **Dépendance non terminée** ≠ bloqué : état calculé depuis les liens `blocks`, affiché en badge « attend KIB-n », sans changer le statut.
- **Hors CRDT, dans SQLite en append-only :** événements de hooks, runs d'agents, logs. C'est un gros volume, propre à chaque machine, non collaboratif.
- **Index dérivés dans SQLite** (recherche, filtres), toujours reconstructibles depuis Loro.
- **Secrets : jamais dans le CRDT** (voir §10).
- **Guidelines :** la source de vérité est le CRDT, éditable dans Kibo. Au lancement d'un agent, elles sont **matérialisées en `.md`** (CLAUDE.md et skills), dans l'ordre workspace → projet → domaine du ticket.

## 6. Système de composants

### Structure d'un composant

```
components/<id>/
├─ kibo.component.json   → id, version (semver), kind: widget|view|both,
│                          entités lues / déclarées, permissions, configSchema
├─ ui.tsx                → composant React (shadcn/ui réexporté par le SDK)
├─ server.ts (option)    → actions, jobs planifiés, webhooks, adaptateur de sync
├─ migrations.ts (option)→ migrations de données et de config par version majeure
└─ component.test.ts     → tests sur un SDK simulé (Loro en mémoire)
```

### Confiance et sandbox

Il y a **un seul SDK, avec une API asynchrone**. Passer d'un mode à l'autre ne demande aucune modification du code du composant.

| | Trusted | Sandboxed |
|---|---|---|
| UI | module ES chargé dans l'app | iframe `sandbox="allow-scripts"`, origine séparée, CSP `connect-src 'none'`, RPC postMessage |
| Backend | Worker Bun dans le démon | **processus séparé**, sans réseau ni disque direct, tout passe par le RPC du démon |
| Permissions | affichées et acceptées à l'installation | **vérifiées à chaque appel par le démon** |

- C'est l'utilisateur qui choisit le niveau de confiance. Toute modification du code change le hash et **redemande la confiance**.
- Un composant créé par l'utilisateur lui appartient. Il est privé pour l'instant et pourra être publié sur une marketplace plus tard.

### Sources de données

Un composant est **local** (données dans Kibo) ou **synchronisé** : il implémente alors un adaptateur `pull / push / map` vers un service externe. Ce choix se fait à l'ajout du composant.

### Versioning

- Une instance pointe sur une version précise (`id@x.y.z`), et plusieurs versions peuvent coexister.
- Quand on publie une modification d'un composant utilisé ailleurs, une boîte de dialogue liste les usages, affiche les changements (dont les **nouvelles permissions**) et propose : **Mettre à jour partout** ou **Créer une nouvelle version** (les instances existantes restent sur l'ancienne).

### Création

- **`kibo component new`** : générateur scripté (squelette, manifest, schéma, tests, enregistrement), sans tokens.
- **Génération par IA** : elle passe par le même générateur. L'IA ne remplit que `ui.tsx`, `server.ts` et les tests.
- **Validation avant enregistrement :** typecheck, tests, **suite de conformité** (§11), et comparaison entre permissions déclarées et permissions utilisées.
- Une **procédure standard** (créer, utiliser, tester) sera documentée dans un skill du repo.

## 7. Orchestration des agents (fonctionnalité utilisateur)

L'utilisateur utilise ses propres tokens, via **son abonnement Claude**, en lançant Claude Code en local, sur le modèle des commandes `gereco-*`.

- **Profil d'agent** (configuré par l'utilisateur) : nom, modèle, mode d'exécution (CLI `claude` en headless ou Agent SDK), mode de permissions, stratégie d'espace de travail (dans le repo, un worktree par ticket, ou un dossier isolé), nombre maximum de runs en parallèle.
- **Run :** `queued → starting → running → waiting_input → queued (prioritaire) → running → done | failed | cancelled`.

### File d'attente et créneaux (protection de la machine hôte)

Aucun agent ne démarre directement : **tous les runs passent par une file d'attente**, pour ne jamais saturer la machine hôte.

- **Créneaux hôte :** un nombre maximum de runs simultanés, tous profils confondus. La valeur par défaut est calculée au premier lancement à partir des cœurs et de la RAM (par exemple 3 créneaux pour 8 cœurs et 16 Go), et reste modifiable.
- **Créneaux de profil :** chaque profil a sa propre limite (« Parallèle : 2 max »).
- **Admission :** un run passe de `queued` à `starting` seulement si **un créneau hôte ET un créneau de son profil sont libres**, et si **le CPU et la RAM sont sous leurs seuils** (par défaut 85 % pour le CPU, 90 % pour la RAM). Au-dessus d'un seuil, l'admission est mise en pause automatiquement. L'utilisateur peut aussi la mettre en pause manuellement.
- **Ordre :** FIFO par défaut. On peut réordonner la file par glisser-déposer et marquer un run comme **prioritaire**.
- **`waiting_input` libère le créneau.** La session est suspendue, et quand l'utilisateur répond, le run revient **en tête de file** puis reprend avec `--resume`.
- **Sous-agents :** ils tournent dans la session de leur parent et consomment son créneau. Ils n'ont pas de créneau hôte à eux.
- **Visuels :**
  - barre d'état : créneaux occupés (`▮▮▮ 3/3`) et nombre de runs en file ;
  - tiroir des agents : runs `En file #n` avec la raison de l'attente ;
  - page **Files d'attente** : les créneaux hôte avec leur run, des jauges CPU et RAM avec leurs seuils, une colonne par profil (en cours / en file, réordonnables), et une colonne « En attente de réponse ».
- **Statut « En file »** : couleur cyan `#06B6D4` (token `color.agent.queued`).

**Lancement d'un run :**
1. Matérialisation du contexte : guidelines (workspace → projet → domaine) et `brief.md` (description, sous-tickets, dépendances, liens Figma).
2. Lancement de Claude Code avec des **hooks injectés** (`--settings`) qui envoient les événements à `127.0.0.1/hooks/<runId>`, avec un jeton propre au run.

**Suivi de l'état (zéro token) :**

| Source | Ce qu'elle apporte |
|---|---|
| `SessionStart`, `PreToolUse` / `PostToolUse` | Agent actif, dernier outil utilisé, fichier en cours |
| `Notification` | Attente d'une réponse : badge, notification système, champ « Répondre » |
| `Stop` / `SubagentStop` | Fin du run ou d'un sous-agent |
| Transcript JSONL | Détail des échanges, coût en tokens (champs `usage`) |
| Watchers git et `gh` | Commits, branche, PR, CI |

**Moteur de règles** (déclaratif, modifiable dans l'UI), par exemple :
- run terminé → ticket passe en *En review* ;
- PR mergée → ticket passe en *Terminé* ;
- tous les sous-tickets sont terminés → le parent passe en *Terminé*.

**Répondre à un agent :** depuis la barre ou le tiroir des agents, la réponse relance la session avec `--resume <sessionId>`.

### Code, commits et PR

Kibo permet de **voir, modifier et livrer le code** sans quitter l'application, que ce code vienne d'un agent ou de l'utilisateur.

- **Vue « Changements »**, disponible par projet et par worktree de run :
  - arbre des fichiers modifiés (`M` / `A` / `D` / `R`, avec le nombre de lignes ajoutées et supprimées) ;
  - diff en mode **unifié ou côte à côte** ;
  - **édition directe** dans le diff (éditeur CodeMirror 6) ;
  - staging par fichier ou par bloc de modifications.
- **Commit en un clic :**
  - le message est **pré-rempli de façon déterministe, sans tokens**, à partir du ticket et des conventions du projet (par exemple `feat(core): schéma Loro des tickets (KIB-12)`) ;
  - un bouton optionnel « Générer avec Claude » propose un message à partir du diff, sur l'abonnement de l'utilisateur.
- **Modifier un commit non poussé :**
  - Kibo détecte les commits locaux absents de la branche distante (`git rev-list @{u}..HEAD`) ;
  - le dernier commit non poussé peut être **amendé** (contenu et message) ;
  - le message d'un commit non poussé plus ancien peut être **reformulé** (via un rebase non interactif avec `--autosquash`) ;
  - un commit déjà poussé ne peut jamais être modifié : les actions sont désactivées et une infobulle explique pourquoi.
- **Créer la PR :**
  - le bouton « Pousser et créer la PR » ouvre une boîte de dialogue : titre (depuis le ticket), description générée depuis un gabarit (ticket, sous-tickets, lien de la maquette), branche de base, brouillon ou non, reviewers ;
  - la création passe par `gh pr create` ;
  - la PR est ensuite rattachée au ticket (`externalRefs`), et le moteur de règles fait avancer le statut du ticket.

### Liens de fichiers

**Tout chemin de fichier affiché est cliquable** : timeline des hooks, diff, notes, `brief.md`, logs, commentaires. Un clic ouvre un **aperçu du fichier dans un Sheet** : coloration syntaxique (Shiki), numéros de ligne, et arrivée directe sur la ligne visée (`ticket.ts:42`). Depuis l'aperçu, on peut **ouvrir le fichier dans un onglet**, **le modifier**, ou **l'ouvrir dans l'éditeur externe**.

**Sans objet pour ce produit :** l'équipe d'agents qui *construit* Kibo (voir CLAUDE.md et feuille de route) est un sujet distinct de cette fonctionnalité.

## 8. UI / UX

Toutes les maquettes sont dans Penpot, en **thème sombre et en thème clair**.

### Shell hybride (validé)

- **Barre d'onglets** en haut de la fenêtre, à la façon de l'application Figma. Dans la version Tauri, elle intègre les boutons de fenêtre macOS.
  - Un onglet **Accueil** fixe (Vue d'ensemble), puis les **onglets ouverts**. Un onglet peut contenir n'importe quelle page : page projet, ticket, fichier, Changements, Files d'attente…
  - **Épingler un onglet** le place à gauche, en version compacte (icône et pastille de projet). Il ne peut pas être fermé par erreur et reste présent au redémarrage.
  - Raccourcis : `⌘T` nouvel onglet (ouvre la palette `⌘K`), `⌘W` fermer, `⌘1…9` aller à un onglet, clic du milieu pour fermer, glisser-déposer pour réordonner.
  - Menu contextuel d'un onglet : Épingler / Désépingler, Dupliquer, Fermer les autres, Ouvrir dans une nouvelle fenêtre.
  - Les onglets sont **persistés par workspace** (donnée locale, hors CRDT partagé).
- **Sidebar** (issue de la variante A) : sélecteur de workspace (en-tête et renommage en phase 4 ; création et bascule entre workspaces : point E6 du plan de phase 4), recherche `⌘K`, Vue d'ensemble, Mes tickets, Agents, arbre des projets et de leurs pages, puis Composants et Paramètres. Repliable en **rail d'icônes** (issu de la variante B).
- **Deux types de pages :**
  - **Tableau de bord** : grille de widgets (variante A) ;
  - **Vue** : un composant en plein écran (variante B).
- **Détail d'un ticket :** **Sheet** latéral (shadcn) ouvert depuis n'importe quel composant (variante C).
- **Agents :** **barre d'état** en bas, toujours visible, dépliable en **tiroir** (liste des runs, journal, réponse).

### Écrans MVP (page `02 · Écrans MVP`)

1. **Vue d'ensemble** : cartes projet (avancement, statuts, agents, dossier et branche), mes tickets de tous les projets, fil d'activité.
2. **Nouveau projet** : nom, dossier local (repo git détecté), point de départ (vide, *Projet dev*, copie d'un projet existant).
3. **Ajouter un composant** : page en mode édition, catalogue (intégrés et custom), aperçu, choix widget ou vue, choix de la source (locale ou synchronisée), permissions.
4. **Détail d'un ticket (Sheet)** : propriétés, description, sous-tickets, dépendances, timeline de l'agent, actions (diff, PR, arrêt).
5. **Agents dépliés** : runs, journal des hooks, réponse à une `Notification`.
6. **Versioning d'un composant** : tableau des composants et boîte de dialogue « mettre à jour partout » ou « nouvelle version ».

### Autres pages (pages `03 · Pages projet` et `04 · Workspace & paramètres`)

7. Tableau de bord · 8. Kanban (vue) · 9. Tickets (arbre avec colonnes) · 10. Graphe de dépendances (chemin critique) · 11. Notes (Markdown, tickets liés, rétroliens)
12. Mes tickets · 13. Agents (statistiques, profils, historique) · 14. Domaines & guidelines (éditeur et chaîne d'injection) · 15. Apparence et démon · 16. Intégrations · 17. Files d'attente des agents · 18. Palette `⌘K` · 19. Premier lancement (vérifications de l'environnement)

### Onglets, code et flows (pages `06` et suivantes)

20. Barre d'onglets (épingler) · 21. Changements (diff, indexation par bloc, commit, amend) · 22. Pousser et créer la PR (seuls les commits poussés entrent dans la PR) · 23. Aperçu de fichier
24. Nouveau ticket · 25. Nouvelle page · 26. Projet créé (vide) · 27. Assigner un ticket à un agent (file d'attente annoncée) · 28. Profil d'agent · 29. Créer un composant (IA ou code) · 30. Permissions et confiance · 31. Appairage du navigateur

### Écrans des phases 2 à 7 (pages `07` et suivantes)

- `07 · Agents (suite)` : 32. Détail d'un run (timeline des hooks, transcript, fichiers touchés) · 33. Run échoué (sortie des tests, Relancer) · 34. Admission en pause (seuil RAM dépassé) · 35. Notification système « réponse attendue » et réponse depuis la barre d'état
- `08 · Code (états)` : 36. Diff côte à côte · 37. Amender le dernier commit · 38. Reformuler un commit non poussé · 39. Conflit (rebase en cours, Abandonner) · 40. Push en cours · 41. Push en échec · 42. PR existante (Voir la PR)
- `09 · Composants` : 43. Menu d'instance « Mettre à jour vers » · 44. Instance « Autorisation requise » · 45. Page Composants : menu `⋯`, confiance, brouillons · 46. Note modifiée hors de Kibo · 47. Dossier des notes · 48. Notes vides · 49. Widgets vides et « Créer une page Graphe ? »
- `10 · Intégrations` : 50. États des intégrations (erreur, limite, menu) · 51. Trousseau système indisponible · 52. Connecter GitHub · 53. Connecter Figma (MCP) · 54. Serveurs MCP · 55. Ajouter un serveur MCP · 56. Confirmer la commande MCP · 57. Déconnecter GitHub
- `11 · IA` : 58. Nouveau projet · Ton rôle (proposition de Claude) · 59. Suggestion indisponible · 60. Créer un composant : génération (agent) · 61. Rapport de validation · 62. Tentatives épuisées · 63. Relire le diff · 64. Modifier avec l'IA
- `12 · Sync & marketplace` : 65. Partager le projet · 66. Membres et invitation · 67. Présence et ticket à clé provisoire · 68. Projet en lecture seule · 69. Paramètres › Sync · 70. Ajouter un appareil · 71. Paramètres › Sécurité (accès distant, sessions) · 72. Activer l'accès distant · 73. Marketplace · 74. Détail d'un paquet · 75. Installation refusée (signature invalide)
- `13 · Compléments` : 76. Paramètres › Général · 77. Paramètres › Raccourcis · 78. Premier lancement : échec d'une vérification

**Règles d'affichage :** le Kanban affiche les tickets filtrés (« moi + agents » par défaut) avec le compteur `affichés / total` ; les onglets sont nommés « Projet · Page » ; la palette cherche aussi les pages, projets et éléments récents.

**Reste à dessiner** (détail : `design/revue-flows.md` §7) : édition inline dans le Sheet, ajout de dépendance et cycle détecté, suppression, glisser-déposer, ticket en onglet, vue Liste, workflow configurable, états vides du Kanban ; run terminé, menu de la file ; génération IA du message de commit ; import de dossier, menus de page, rail ; source synchronisée (écran 3), sections CI et Maquettes du Sheet, widget Source MCP ; rejoindre un projet, connexion au serveur de sync, composant absent, sources de marketplace.

### Système visuel

- **Tokens shadcn zinc**, avec les sets `shadcn/dark` et `shadcn/light`, un accent **orange `#F97316`** réservé aux **agents et à la marque** (boutons principaux neutres ; en clair, texte orange en orange-600/700 pour le contraste), des couleurs de statut (backlog, à faire, en cours, en review, terminé, bloqué) et des couleurs d'agent (running, waiting, done, failed). Les **profils d'agent n'ont pas de couleur** : la couleur ne dit que l'état du run. Les **domaines** ont une palette propre, distincte des statuts, en puce carrée (statuts : pastille ronde).
- **Thème :** celui du système par défaut, avec un choix clair / sombre / système dans les paramètres.
- **Règle de design :** toute proposition de style est livrée en sombre et en clair.
- **Logo :** la piste 5 « Kanban » de la page Penpot `05 · Logo` (tuile, trois colonnes de cartes, une carte orange) est la seule marque : icône de l'application, favicon, `KiboLogo` et `WorkspaceMark` en dérivent (spec code et onglets §12.5).

## 9. Intégrations V1

Chaque intégration est un adaptateur activé par un composant synchronisé. Les secrets sont stockés dans le trousseau système.

| Id | Intégration |
|---|---|
| G1 | Git local : branches, commits, worktrees, diff |
| G2 | GitHub : PR, reviews, statuts CI |
| T1 | GitHub Issues et Projects |
| D1 | Figma via MCP : nœuds liés aux tickets, aperçus |
| C1 | GitHub Actions : runs et logs liés à la PR et au ticket |
| M1 | Notifications système |
| N1 | Dossier Markdown local et vault Obsidian |
| X1 | **Connecteur MCP générique** : n'importe quel serveur MCP comme source de données |

**Plus tard :** GitLab, Penpot MCP, Linear, Jira, Vercel/Netlify, Sentry, Slack, Discord, Notion, webhooks.

## 10. Sécurité

- **Démon :** il n'écoute que sur `127.0.0.1`. L'UI s'y appaire avec un jeton local (`~/.kibo`), échangé contre un cookie `HttpOnly`. Vérification de l'`Origin`, protection CSRF, WebSocket authentifié. L'accès distant ne sera possible qu'en opt-in explicite, avec TLS.
- **Hooks :** un jeton par run, pour empêcher un processus local de forger des événements.
- **Secrets :** trousseau système (Keychain sur macOS, Secret Service/libsecret sur Linux). Jamais dans le CRDT. Fichiers de données en `0600`.
- **Composants :** voir §6. Le durcissement au niveau de l'OS pour le backend sandboxé (Landlock ou bubblewrap sur Linux, profil sandbox sur macOS) est prévu **dans une phase ultérieure**.
- **Agents :** ils tournent avec le mode de permissions choisi par l'utilisateur. **Jamais `--dangerously-skip-permissions` par défaut.** L'isolation par worktree est recommandée.
- **Chaîne d'approvisionnement :** lockfile, aucun script `postinstall` pour les composants.

## 11. Stratégie de test

| Niveau | Outil | Ce qu'on teste |
|---|---|---|
| Domaine | `bun test` | Schémas Zod, moteur de règles, opérations sur les arbres |
| CRDT | tests par propriétés (fast-check) | Des opérations concurrentes aléatoires convergent toujours |
| Composants | **suite de conformité commune** et SDK simulé | Rendu, respect des permissions, migrations. Obligatoire pour tout composant, y compris ceux générés par IA |
| Démon | intégration | API, SQLite temporaire, authentification |
| Agents | **faux binaire `claude`** qui rejoue des scripts d'événements de hooks | Tout le cycle d'un run, sans consommer de tokens |
| Bout en bout | Playwright | Parcours MVP : projet → page → Kanban → ticket |
| Desktop | smoke test Tauri | CI sur macOS et Linux (GitHub Actions) |

Ports des démons E2E (`e2e/playwright.config.ts`) : **4390 à 4430** (sync 4406–4411, marketplace 4412–4414, chaque spec prend une paire sombre/clair à la suite) ; 4461–4499 sont réservés aux démos. Faux serveurs dérivés : GitHub = port + 1000, MCP = port + 2000.

## 12. Hors périmètre de cette spec / décisions ouvertes

- **Conventions et organisation de l'équipe d'agents** : `CLAUDE.md` et feuille de route.
- **Clés de ticket en écriture concurrente** et **sessions d'appairage** : tranchées dans `2026-09-26-kibo-sync.md` (clés allouées par le serveur de sync, sessions persistées hachées, 30 jours glissants).
- **Compléments par phase** : `2026-09-26-kibo-composants.md` (4), `-integrations.md` (5), `-ia.md` (6), `-sync.md` et `-marketplace.md` (7).
- **Assistant d'onboarding** (rôle → composants conseillés) : spec E, après le noyau.
- **Sync et multi-utilisateur temps réel** : spec G (serveur de sync Loro, permissions par projet).
- **Marketplace de composants** : spec H.
- **Durcissement OS du sandbox** : phase ultérieure (§10).
- **Mises à jour de l'application de bureau** (updater Tauri, releases GitHub signées) : spec I, `2026-09-27-kibo-mises-a-jour.md`. Seule exception à « l'UI ne parle qu'au démon » : l'UI appelle l'IPC Tauri pour vérifier et installer une mise à jour, sur une capacité accordée à l'origine du démon.

## 13. Glossaire

- **Workspace** : l'espace d'un utilisateur, qui contient projets, domaines, guidelines et composants installés.
- **Projet** : un doc Loro lié à un dossier local ou à un repo git.
- **Page** : un nœud de l'arbre des pages, de type *Tableau de bord* (grille) ou *Vue* (plein écran).
- **Composant** : un module versionné (manifest, UI, backend optionnel). Une **instance** est un composant posé sur une page.
- **Domaine** : une catégorie de ticket (Facturation, DevOps…) qui porte des guidelines.
- **Guideline** : un `.md` lisible, injecté dans le contexte des agents.
- **Run** : une exécution d'un agent sur un ticket.
- **Boîte de réception** : les tickets du workspace qui n'ont pas encore de projet (clé `INB-n`), locale à la machine, jamais partagée (§15.1).

## 14. Décisions de la phase 9 : projets, workspace, réglages et en-tête

Écrites le 2026-09-30, avant le plan `docs/superpowers/plans/2026-09-30-kibo-phase-9-vague-2.md` (lots 2 et 7 du plan d'action UI/UX). Elles complètent §5, §8 et §10 et les décisions de la spec G (§13 : D17, D20, D32, D38, D39) sans les contredire ; là où elles amendent D20 et D38, c'est dit. Toute opération nouvelle du démon est écrite ici avant le code.

### 14.1 Modifier un projet : `updateProject`

- RPC `updateProject { projectId, patch: { name?, color?, folder? } }` ⇒ `ProjectMeta` (dossier local réinjecté, D32). Un patch vide est refusé (`INVALID_INPUT`). `name` est nettoyé et non vide, `color` un `#RRGGBB` ; `key` et `id` ne changent jamais (D22, D39).
- `name` et `color` sont écrits dans `meta` du doc projet **et** dans l'entrée du projet de la liste `projects` du doc workspace, qui en garde une copie (D32 ; `listProjects` lit cette copie, `getProject` lit le doc). Dans un projet partagé, ce sont les deux seuls champs de `meta` qu'un éditeur peut modifier (D39) ; un lecteur ou un accès retiré est refusé en `FORBIDDEN` par la garde d'écriture (D9, D30).
- `folder` est un chemin de cette machine : la requête qui le porte est réservée aux sessions locales (`FORBIDDEN` à distance, comme D17) ; le chemin est absolu et désigne un dossier existant (`INVALID_INPUT` sinon) ; `null` délie le dossier. Stockage : `project_settings(projectId, "folder")` dès que le projet est partagé ou que son doc porte `keyAllocator = server` (partage suspendu, accès retiré), comme le lit `docs.projectMeta` ; sinon `meta.folder` du doc, et la clé `project_settings` est alors effacée pour que le doc reste la seule source (D32) ; dans les deux cas la copie de la liste du workspace. Changer ou délier le dossier est refusé en `CONFLICT` tant qu'un run du projet n'est pas terminal (les worktrees et le répertoire de travail des runs en dérivent, §7). Le dossier des notes n'est pas touché (`setNotesDir` reste séparé).
- Événements : `{ projectId }` puis `{ projectId: null }` (liste et fiche rechargées).

### 14.2 Images importées : `setIcon`

- RPC `setIcon { owner: { kind: "project", projectId } | { kind: "workspace" }, icon: { mime, data } | null }` ⇒ `{ icon: string | null }`, où `icon` est l'empreinte SHA-256 (hex) des octets, qui sert de version. `null` retire l'image.
- Bornes : **256 kB décodés au plus** (`TOO_LARGE`), formats **PNG, JPEG, WebP** seulement, vérifiés par les octets de signature du fichier et non par le `mime` déclaré (`INVALID_INPUT` si discordance ; SVG exclu, car il peut porter un script). `data` est du base64 standard, rempli et canonique (le ré-encodage doit redonner la chaîne, sinon `INVALID_INPUT`). Aucun décodage d'image ni redimensionnement côté démon (le décodeur est celui du navigateur) ; l'interface refuse avant l'envoi un fichier trop lourd ou d'un autre format et conseille une image carrée.
- **Jamais dans un CRDT**, ni dans le doc projet ni dans le doc workspace : table SQLite `icons(owner TEXT PRIMARY KEY, mime TEXT, bytes BLOB, sha256 TEXT)` de `kibo.db` (`0600`), avec `owner` = `workspace` ou `project:<id>`. Raisons : D39 fige `meta` d'un projet partagé à `name` et `color` et le validateur refuse tout champ inconnu ; le snapshot partagé est borné à 8 Mio ; une image est une donnée d'affichage propre à la machine, comme le dossier. Conséquence assumée : l'image d'un projet partagé n'est pas synchronisée, chaque membre choisit la sienne (**à confirmer par Adam** : la synchroniser demanderait un blob côté serveur, hors périmètre de la v1.1).
- Servie par `GET /icons/project/<id>?v=<sha256>` et `GET /icons/workspace?v=<sha256>` : cookie de session obligatoire (401 sinon), en-tête `Origin` absent ou autorisé et `sec-fetch-site` absent ou `same-origin` (403 sinon, mêmes contrôles que `/components/`), 404 sans image ; `content-type` = mime stocké, `x-content-type-options: nosniff`, `cross-origin-resource-policy: same-origin`, `cache-control: private, max-age=31536000, immutable` (l'URL change avec l'empreinte). Ce n'est pas une route `/api/` : une balise `<img>` n'envoie pas d'en-tête `Origin`.
- Exposition : `ProjectSummary.icon` et `ProjectSnapshot.icon` (`string | null`, absent = aucune) et `WorkspaceConfig.workspaceIcon`. Événements : projet ⇒ `{ projectId }` et `{ projectId: null }` ; workspace ⇒ `{ topic: "config" }`.
- `setIcon` est permis depuis toute session appairée, distante comprise, et sans garde d'écriture : l'image est une donnée d'affichage locale, bornée, hors CRDT ; elle n'est ni un chemin de la machine (14.1) ni une destruction (14.3), seuls cas réservés aux sessions locales. Un lecteur d'un projet partagé peut donc choisir son image.
- Suppression : l'image d'un projet disparaît avec lui (14.3).

### 14.3 Supprimer un projet : `deleteProject`

- RPC `deleteProject { projectId }` ⇒ `null`, réservée aux sessions locales (`FORBIDDEN` à distance, D17) ; `NOT_FOUND` si le projet est inconnu. L'interface la confirme toujours par la **saisie du nom du projet**.
- **Refus** (rien n'est modifié) : `CONFLICT` si un run du projet n'est pas terminal (`queued`, `starting`, `running`, `waiting_input`) : l'utilisateur les arrête d'abord (`cancelRun`), Kibo ne tue pas un agent en silence ; `CONFLICT` si le projet est partagé et que l'utilisateur en est `owner` avec un accès actif : il fait d'abord « Arrêter le partage » (`unshareProject`, qui supprime le projet du serveur pour tous, D3), puis supprime sa copie. Pendant « Partager » (verrou du registre des hôtes, D20), `deleteProject` répond `CONFLICT` ; le verrou est exposé au module d'administration par le registre des hôtes, pas par `ProjectSyncInfo` (à câbler dans une prochaine tâche : `isLocked(projectId)`). **À confirmer par Adam** : faut-il enchaîner les deux en une action (« Supprimer pour tout le monde ») ; ce plan livre le refus expliqué et le bouton vers le partage.
- **Membre** (`editor` ou `viewer`) ou **accès retiré** : supprimer = quitter localement. Le démon se désabonne (trame `unsubscribe` s'il est en ligne) et supprime la ligne `sync_projects` (`detachProject`), puis supprime la copie locale ; le tout dans la même transaction que les effets locaux, restaurée si une étape échoue. L'appartenance côté serveur n'est pas modifiée (le protocole n'a pas de trame de départ) : un propriétaire voit toujours le membre et une nouvelle invitation est nécessaire pour revenir. **À confirmer par Adam** : une trame `leave` (hors périmètre v1.1).
- **Effets locaux**, dans une transaction SQLite : l'entrée quitte la liste `projects` du doc workspace ; le doc `project:<id>` est supprimé de `docs` ; les lignes `project_settings` du projet (dossier, dossier des notes), son image (`icons`) et sa ligne `sync_projects` sont supprimées ; le service des notes ferme son observateur et vide son index pour ce projet ; le registre des hôtes de sync oublie le doc. Les instances, pages, tickets, liens et liaisons d'intégration vivaient dans le doc : ils disparaissent avec lui (les lignes d'état de sync d'intégration restent orphelines, sans effet, purgées à une phase ultérieure). Événement : `{ projectId: null }` ; l'interface ferme les onglets du projet (épinglés compris) et retire ses entrées récentes.
- **Ce que Kibo ne touche jamais** : le dossier du projet et son contenu, y compris les worktrees `<dossier>/.kibo/worktrees/*` créés pour les agents (à supprimer à la main, `git worktree remove`), les fichiers de notes (`.md`) et le dossier de notes par défaut `<KIBO_HOME>/notes/<clé>`. L'historique des runs est conservé (SQLite en ajout seul, §5) : ses lignes gardent l'ancien `projectId` et restent lisibles. Les composants installés sont au workspace et ne bougent pas. La confirmation le dit en clair.

### 14.4 Workspace : `updateWorkspace` et page « Workspace »

- `ConfigCommand.updateWorkspace { patch: { name?, description? } }` ⇒ `{ name, description }` remplace `renameWorkspace` (retirée avec l'unique dialogue qui l'appelait). `name` : 1 à 40 caractères nettoyés ; `description` : 500 caractères au plus, `null` l'efface. Stockage : `settings.name` et `settings.description` du doc workspace, qui ne quitte jamais la machine (spec G §3.4). `WorkspaceConfig` gagne `workspaceDescription` et `workspaceIcon` ; l'image passe par `setIcon` (14.2). Un patch vide est refusé (`INVALID_INPUT`).
- Nouvelle page **Paramètres › Workspace** (`Screen` `workspace`, `#/settings/workspace`), première entrée de la navigation des Paramètres : nom, image (aperçu, choisir, retirer), description. « Paramètres du workspace » du sélecteur de workspace y mène (jusqu'ici : Domaines) ; l'entrée « Renommer le workspace… » disparaît. Plusieurs workspaces restent hors périmètre (ticket KIB existant).

### 14.5 Apparence, appairage, en-tête et réglages retirés

- **Thème** : préférence **par appareil**, dans `localStorage["kibo.theme"]` (`system` par défaut, `light`, `dark`), appliquée avant le premier rendu et suivie en direct (`prefers-color-scheme`) : ni le démon ni un CRDT ne la portent, car un navigateur distant, un téléphone et l'application ont chacun leur réglage et un aller-retour au démon ferait clignoter l'écran. Elle se règle dans Paramètres › Apparence (Système / Clair / Sombre), dans le menu de l'avatar et par la commande de la palette. Amende D38 : l'écran 15 « Apparence » livre le bloc « Thème » ; les blocs « État du démon » et « Données » restent un écart listé au jalon.
- **Appairage web** : le bloc « Accès web » (générer un code d'appairage) quitte Apparence pour **Sécurité**, avant « Sessions » (amende D20 et D38). Le texte de l'écran d'appairage du navigateur indique « Paramètres › Sécurité › Accès web › Générer un code ».
- **Cloche** : elle ouvre l'**historique des runs** (les 20 derniers runs terminés, en échec, annulés ou en attente d'une réponse, du plus récent au plus ancien), à partir de l'état des agents déjà reçu par l'interface, sans requête nouvelle. Une pastille compte les runs passés en attente, terminés ou en échec depuis la dernière ouverture (horodatage `localStorage["kibo.runs.seenAt"]`, par appareil). Une ligne ouvre le run dans le tiroir des agents ; une ligne « attend une réponse » y mène directement pour répondre. Dans un navigateur, la demande d'autorisation des notifications se fait depuis ce menu.
- **Avatar** : un menu avec le nom de l'utilisateur (compte de sync et serveur s'il y en a un), un sous-menu « Thème », « Sessions » (Paramètres › Sécurité) et « Paramètres ».
- **Raccourcis** : Paramètres › Raccourcis (`Screen` `shortcuts`, `#/settings/shortcuts`) livre l'écran 77 : la liste des raccourcis, affichés selon la plateforme (`⌘` sur macOS, `Ctrl` ailleurs). Ils ne se personnalisent pas.
- **Réglages retirés** (plutôt que grisés) : la carte « Application » de Général (langue : le français est la seule ; ouverture à la connexion et dossier des données : sans mise en œuvre) ; l'onglet « Créés par moi » de Mes tickets, tant que l'auteur d'un ticket n'est pas enregistré ; « Depuis un projet » du dialogue Nouveau projet (§8 écran 2 : la copie d'un projet existant reste à concevoir, sans date) ; « Générer avec Claude » du panneau de commit, que le lot 9 livrera par la file d'attente des agents. Un réglage revient le jour où il fonctionne.

### 14.6 Coque de bureau : sélecteur de dossier

- `tauri-plugin-dialog` est enregistré et la capacité accordée à l'origine du démon (spec I §3.7) gagne **`dialog:allow-open`** seulement (ni `save`, ni `message`, ni `ask`, ni `confirm`). L'interface l'appelle (`@tauri-apps/plugin-dialog`, import dynamique, interdit dans le chargement initial) avec `directory: true, multiple: false` pour choisir le dossier d'un projet, le dossier des notes ou le dossier local d'un projet rejoint ; le sélecteur ne rend qu'un chemin, que le démon vérifie comme un chemin saisi. Hors de la fenêtre Tauri (navigateur, accès distant), le bouton « Parcourir… » est absent et le champ reste saisi à la main : un navigateur ne fournit pas de chemin.

### 14.7 Codes d'erreur

Aucun nouveau code : `INVALID_INPUT`, `TOO_LARGE`, `CONFLICT`, `FORBIDDEN`, `NOT_FOUND` suffisent.

## 15. Décisions de la phase 9, vague 3 : boîte de réception, lisibilité, confort

Écrites le 2026-10-01, avant le plan `docs/superpowers/plans/2026-10-01-kibo-phase-9-vague-3.md` (lots 3, 6 et 8 du plan d'action UI/UX). Mêmes garde-fous que §14 : local-first, zéro token pour l'état, rien de secret ni de nouveau dans un CRDT partagé sans décision, mutations sensibles réservées aux sessions locales. Toute opération nouvelle du démon est écrite ici avant le code ; ce qui relève d'une autre spec y est renvoyé (composants §16, marketplace D47, agents §11).

### 15.1 Boîte de réception : tickets sans projet

- Un ticket peut être créé **sans projet** : il vit dans la **boîte de réception** du workspace, identifiée par `INBOX_ID = "inbox"`, de clé `INBOX_KEY = "INB"` (tickets `INB-1`, `INB-2`…). Elle est propre à la machine, comme le doc workspace (D32) : elle n'est **jamais partagée**.
- **Stockage** : un doc Loro **de la forme d'un doc projet** (`createProjectDoc`, `meta = { id: "inbox", key: "INB", name: "Inbox", folder: null, color: "#64748B" }`, `keyAllocator = local`), enregistré sous `project:inbox` dans la table `docs` de `kibo.db`, chargé ou créé au démarrage du démon, et **jamais inscrit dans la liste `projects` du doc workspace**. Conséquences : absent de `listProjects`, donc des cartes de la vue d'ensemble, des agents, des notes, des intégrations, des composants et de la sync, qui tous partent de cette liste ; `shareProject`, `createProjectInvite`, `updateProject`, `deleteProject`, `setIcon` (propriétaire `project:inbox`), `getNotesDir` et `setNotesDir` répondent `INVALID_INPUT` pour `inbox`. Raison du choix contre un arbre de tickets dans le doc workspace : tout le code des tickets (`createTicket` et l'allocation des clés, liens, `readProject`, garde d'écriture, chemin des commandes, fiche ticket, palette) est écrit pour un doc projet ; le réécrire pour le doc workspace doublerait le domaine pour un gain nul, et la boîte est tout aussi locale puisqu'aucun chemin de sync ne la connaît. `requireWorkspace` continue de distinguer le doc workspace par l'absence de `meta.id`.
- **Commandes** : `command { projectId: "inbox", command }` accepte les commandes dont `COMMAND_WRITES` vaut `ticket` ou `link` (`createTicket`, `updateTicket`, `setStatus`, `moveTicket`, `deleteTicket`, `addLink`, `removeLink`) ; toute autre commande (pages, instances, liaisons, références externes, import, données d'instance) répond `INVALID_INPUT` (« the inbox only holds tickets »). Sous-tickets et dépendances sont permis dans la boîte (une structure capturée tôt est rattachée telle quelle). **À confirmer par Adam** : une boîte plate (ni sous-tickets ni dépendances) serait plus simple à expliquer ; défaut retenu : structure permise.
- **Lecture** : `getProject("inbox")` renvoie un `ProjectSnapshot` ordinaire (pages, instances, liaisons et règles vides, `sync.shared = false`, `nextTicketKey = "INB-n"`) ; l'interface affiche « Boîte de réception » partout où le nom d'un projet apparaît (onglet, fil d'Ariane, fiche, « Mes tickets », palette) et ne propose jamais la boîte comme projet (ni page, ni widget, ni partage). Événement de changement : `{ projectId: "inbox" }`, comme un projet.
- **Rattachement** : RPC `fileTicket { ticketId, projectId, parentId?: NodeId | null }` ⇒ `{ ticketId, key: string | null }` (identifiant et clé du ticket recréé). Contrôles, dans l'ordre : `projectId ≠ "inbox"` et projet connu (`INVALID_INPUT`, `NOT_FOUND`) ; garde d'écriture du projet cible (`assertWritable`, D30 : `FORBIDDEN` pour un lecteur ou un accès retiré, `CONFLICT` pendant « Partager ») ; ticket présent dans la boîte et `parentId` nul ou présent dans le projet cible (`NOT_FOUND`). Le ticket et son sous-arbre sont **recréés** dans le projet cible, dans l'ordre de l'arbre, avec titre, description, statut (et motif de blocage), domaine, assigné humain et références externes ; chaque ticket reçoit une **nouvelle clé** allouée par le projet cible (immédiate en local ; en attente, `pendingSeq`, dans un projet partagé, affichée `KIB-…` jusqu'à l'attribution par le serveur, spec G §5) ; les liens dont les deux extrémités sont dans le sous-arbre sont recréés, les liens vers un ticket resté dans la boîte sont perdus (la confirmation le dit) ; puis le sous-arbre est supprimé de la boîte (`deleteTicket`, qui purge ses liens). Le tout dans une transaction SQLite, avec restauration des deux docs depuis leur snapshot si une étape échoue ; événements `{ projectId: "inbox" }` puis `{ projectId }`. L'opération est ouverte à toute session appairée, comme `command` : c'est une écriture ordinaire sur des données locales, ni un chemin de la machine ni une destruction (§14.1, §14.3).
- **Agents** : `assignAgent` et `previewAssign` sur `projectId = "inbox"` répondent `INVALID_INPUT` (« inbox tickets cannot be assigned to an agent ») : un agent travaille dans le dossier d'un projet, la boîte n'en a pas. L'interface n'offre pour un ticket de la boîte que « Rattacher à un projet… » (fiche, « Mes tickets », palette), jamais « Assigner à un agent ». Amende la spec agents §8 : voir §11 de cette spec.
- **Nouveau ticket** : le dialogue gagne un sélecteur « Projet » (« Boîte de réception » en tête, puis les projets dont l'accès est `write` ; présélection : le projet courant s'il y en a un, sinon la boîte ; verrouillé quand le ticket a un parent ou vient d'un widget, car le parent et l'instance appartiennent à un projet) et un sélecteur « Assigné » (« Personne », « Moi », puis les membres dans un projet partagé ; défaut « Moi ») ; la commande `createTicket` gagne `blockedReason?` (schéma et core) pour qu'un ticket puisse naître « Bloqué » avec son motif (le Kanban le demande, §15.3), le dialogue affichant alors un champ « Motif » obligatoire. Le bouton « Nouveau ticket » de l'en-tête est **toujours visible** (amende la spec agents §8 « absent tant qu'aucun projet n'a été ouvert »).
- **Interface** : entrée « Boîte de réception » dans la barre latérale, après « Mes tickets », avec le nombre de tickets non terminés ; écran `inbox` (`#/inbox`, écran 113) : liste (clé, titre, statut, assigné), actions « Ouvrir », « Rattacher à un projet… », « Supprimer… » (menu ⋯ et clic droit, même liste), état vide avec « Nouveau ticket » ; dialogue « Rattacher à un projet » (écran 115) : projet cible parmi les projets modifiables, texte « Le ticket reçoit une nouvelle clé dans ce projet ; ses sous-tickets suivent ; ses liens vers d'autres tickets de la boîte sont perdus. », confirmation, puis la fiche s'ouvre sur le ticket recréé. « Mes tickets » et la vue d'ensemble comptent les tickets de la boîte assignés à moi (groupe « Boîte de réception ») ; le Kanban, l'arbre Tickets et le Graphe d'un projet ne voient jamais la boîte ; la palette trouve `INB-n`.
- **Clé réservée** : `createProject` refuse la clé `INB` (`INVALID_INPUT`) et le formulaire « Nouveau projet » la signale ; un projet **rejoint** dont la clé serait `INB` n'est pas refusé (sa clé vient du serveur, D39) : cas marginal, les clés restent lisibles avec le nom du projet. **À confirmer par Adam**. Un projet rejoint dont l'**identifiant** serait `inbox` est refusé (`INVALID_INPUT`, l'invitation est consommée) : seul un serveur défaillant peut l'émettre, et l'accepter écraserait la boîte.
- Un ticket de la boîte se supprime comme un autre (`deleteTicket`, confirmé) ; la boîte n'a pas de suppression ni de réglage. Aucun nouveau code d'erreur.

### 15.2 Lisibilité des écrans avancés (lot 6)

- **Toute action destructive est confirmée** (`ConfirmDialog` du SDK, texte qui nomme la cible, ce qui disparaît et ce qui reste) : désinstaller un composant, bloquer un composant (retrait de la confiance), retirer une source de composants, révoquer un appareil, arrêter un run, retirer un run de la file, supprimer un profil d'agent. Déjà confirmés : se déconnecter du serveur, supprimer un projet, arrêter le partage.
- **Détails techniques repliés** : empreintes (`sha256:`, `ed25519:`), identifiant de composant, numéro d'index d'une source, identifiant de compte, adresse complète du serveur, chemin du certificat, commande git exécutée vont dans un bloc « Détails » replié (`Collapsible` du SDK), jamais en première ligne d'une carte ou d'un tableau. Les tailles s'écrivent « ko », « Mo ».
- **Vocabulaire** (textes de `packages/ui/src/i18n/`) : « Sandboxé » → « Isolé » (aide : « Le composant tourne dans un bac à sable, sans accès à ta machine. ») ; « Revérifier l'empreinte » → « Vérifier le code » ; « Retirer la confiance » → « Bloquer ce composant » ; « Index n° » → « Version du catalogue » ; « À valider : kibo component test <id> » → « À valider : lance les tests du composant (commande dans Détails) » ; « créneaux » → « places » (« 2 places sur 3 ») ; « tokens aujourd'hui (abonnement) » → « tokens aujourd'hui » avec l'aide « Comptés par Claude Code sur ton abonnement. » ; `--resume` → « reprise de la session » ; « CLI headless (claude -p) » → « Claude Code en ligne de commande » ; modes de permission : `plan` → « Lecture seule (plan) », `acceptEdits` → « Modifications acceptées », `default` → « Demande à chaque action » ; « Jamais --dangerously-skip-permissions. » → « Les permissions ne sont jamais contournées. » ; « Démon local / injoignable » → « Kibo · connecté / hors ligne ». Le mot **run** est conservé (glossaire §13) et expliqué une fois par page (« Un run est le travail d'un agent sur un ticket. »).
- **Composants › Installés** (écran 116) : titre « Composants », explication, bouton « Créer un composant » (ouvre le dialogue de création avec `target = null` : le composant est créé sans être posé sur une page) ; champ de recherche (titre et identifiant), deux filtres (confiance : Tous / Fiables / Isolés / À examiner ; origine : Tous / Kibo / Les miens / Créés par l'IA / Marketplace), tri par clic sur l'en-tête (nom, version, confiance, origine, usages), tout **côté interface** sur `listComponents` (aucune RPC nouvelle : le démon renvoie déjà `trust`, `origin` et `usages` par version). « Utilisé dans » devient un bouton qui ouvre un volet listant projet › page (usages déjà fournis), un clic ouvre la page ; même traitement dans l'aperçu de publication.
- **Marketplace** (écran 117) : état vide avec explication et bouton « Ajouter une source » qui ouvre le dialogue d'ajout sur place ; carte sans identifiant brut (dans Détails) ; « Paramètres › Composants › Sources » s'intitule « Sources de composants » avec un sous-titre qui dit à quoi sert une source, et l'onglet Marketplace y renvoie par un lien.
- **Sources** (écran 118) : « Rafraîchir » d'une ligne ne rafraîchit que cette source (`refreshMarketSource { id }`, spec marketplace D47) ; « Tout rafraîchir » reste au niveau de la page ; « Retirer » est confirmé.
- **Synchronisation** (écrans 119 et 120) : l'écran s'intitule « Synchronisation ». État vide : à quoi ça sert (partager des projets entre appareils et collègues), comment obtenir un serveur (un serveur `kibo-sync` hébergé par l'équipe ; lien vers la documentation), puis deux chemins : « Se connecter à un serveur » (adresse et code reçus de l'administrateur) et « C'est mon autre appareil » (même dialogue, aide : « Sur l'appareil déjà connecté : Paramètres › Synchronisation › Appareils › Ajouter un appareil ; le code vaut 15 minutes. »). Le dialogue de connexion présente « Adresse du serveur » (aide : « Donnée par ton équipe, elle commence par wss:// »), « Code » (aide : « Code d'invitation (48 h) ou code d'appareil (15 min). »), « Nom de cet appareil », et range le certificat racine dans « Options avancées » replié. « Ajouter un appareil » affiche le code, l'adresse du serveur à saisir et les trois étapes. Connecté : carte serveur (nom d'hôte ; adresse complète dans Détails), compte (nom ; identifiant dans Détails), appareils (révocation confirmée), projets partagés avec des actions par ligne (« Ouvrir », « Gérer le partage… », « Arrêter le partage… » pour le propriétaire, « Quitter… » pour un membre) qui réutilisent les dialogues de partage et de suppression existants. Aucune RPC nouvelle.
- **Agents** (écran 121) : une ligne de l'historique ouvre le run dans le tiroir (mécanisme `focusRun` existant) ; filtre « Tous / Terminés / En échec / Annulés / En attente » et recherche par clé de ticket ; « Journal indisponible pour ce run. » quand `getRunLog` répond `NOT_FOUND` ou une liste vide ; vocabulaire de §15.2.
- **Code** (écran 122) : les lettres M/A/D/R/U deviennent des mots (« Modifié », « Ajouté », « Supprimé », « Renommé », « Conflit ») ; les sections « Indexés / Non indexés » deviennent « Dans le prochain commit / Modifications » et les actions « Indexer / Désindexer / Tout indexer / Tout désindexer » deviennent « Ajouter au commit / Retirer du commit / Tout ajouter / Tout retirer » ; la ligne « git push -u … » devient « Publication de la branche <branche> sur <distant>… » (commande dans Détails) ; les raccourcis affichés passent par `shortcutLabel` (⌘ ou Ctrl) partout, y compris `⌘↵` et `⌘⇧O`. Amende la spec code et onglets §12.4 pour le nom des entrées de menu des fichiers.

### 15.3 Confort de lecture et robustesse (lot 8)

- **Retour à la ligne** : préférence **par appareil**, `localStorage["kibo.wrap"]` (`on` par défaut, `off`), commune à l'aperçu de fichier, à l'onglet fichier (lecture et édition, `EditorView.lineWrapping`) et au diff, réglée par une bascule dans l'en-tête de chacun ; ni le démon ni un CRDT ne la portent (même raison que le thème, §14.5).
- **Aperçu et onglet fichier** (écran 124) : barre de recherche (⌘F quand le volet a le focus ; occurrences surlignées, compteur « 3 / 12 », Entrée et ⇧Entrée pour naviguer) ; « aller à la ligne » par la même barre avec la syntaxe `:42` ; bouton « Copier le chemin » (chemin relatif au dossier du projet, presse-papiers) ; le pied de page affiche la ligne courante (ligne visée ou première ligne visible), plus un « 1 » en dur.
- **Chargement et démon injoignable** (écran 123) : l'interface n'affiche plus un écran blanc. Après 300 ms sans session, « Chargement de Kibo… » ; si `getSession` ou `listProjects` échoue par une erreur qui n'est pas une `KiboError` (réseau : Kibo n'est pas lancé, ou l'adresse est fausse), l'écran « Kibo ne répond pas » explique quoi faire (dans l'application : relancer Kibo ; dans un navigateur : vérifier que Kibo tourne sur l'ordinateur et l'adresse) avec un bouton « Réessayer » et une nouvelle tentative automatique toutes les 3 s ; une erreur de rendu non prévue tombe dans une frontière racine « Quelque chose s'est mal passé » avec « Recharger ». Dans la coque, si le démon meurt, l'application affiche un message (« Kibo s'est arrêté : …, relance l'application ») sur sa sortie d'erreur et quitte avec le code 1 plutôt que de paniquer sur un `expect`. Aucune RPC nouvelle, aucun code d'erreur nouveau.
- **Largeurs adaptatives** : navigation des Paramètres en colonne à partir de `md`, empilée en dessous ; fiche ticket `w-full sm:max-w-[min(90vw,560px)]` ; journal CI `sm:max-w-[min(90vw,720px)]` ; vue Changements en trois colonnes à partir de `lg`, sinon liste des fichiers repliable au-dessus du diff et panneau de commit en dessous ; aucun contenu ne déborde horizontalement (chemins longs coupés par `break-all`, conteneurs `min-w-0`), y compris dans le dialogue « Supprimer le projet » et les cartes de la vue d'ensemble (écrans 108 et 1 amendés). Fil d'Ariane cliquable (projet ⇒ onglet projet, page ⇒ page ; le dernier élément reste du texte).
- **Arbre Tickets** (écran 125) : état vide avec « Nouveau ticket » et un mot sur l'arbre ; squelette pendant le chargement ; recherche (clé ou titre) et filtres (statut, assigné : Tous / Moi / Agents / Personne), côté composant (aucune RPC ; spec composants §16). **Notes** : tri « Modifiées récemment » ou « Titre », mémorisé par appareil (`localStorage["kibo.notes.sort"]`), et regroupement par sous-dossier du dossier de notes (en-têtes repliables) ; les fichiers viennent toujours de `list("note")`.
- **Kanban** (écran 126) : la carte entière se déplace (poignée = carte, activation après 6 px ; menu et boutons ne déclenchent pas le glisser) ; l'ordre dans une colonne se réordonne par glisser-déposer et persiste par instance (spec composants §16) ; la colonne « Bloqué » a son « + » (le dialogue demande le motif, §15.1) ; le filtre par défaut est explicite : compteur « 13 / 24 » accompagné de « Moi + agents » et, quand des tickets sont masqués, d'un lien « 11 masqués · Tout afficher » ; la pastille CI sans verdict prend une couleur à jeton (`bg-muted-foreground/60`), lisible en sombre et en clair.
- **Démarrage en erreur** : une `KiboError` autre qu'`UNAUTHORIZED` au démarrage affiche « Kibo n'a pas pu s'ouvrir », le message de l'erreur (`errorMessage`) et « Réessayer », avec la même relance automatique toutes les 3 s que « Kibo ne répond pas ».
- **Barre des agents** : « Kibo · connecté » / « Kibo · hors ligne » ; avec un serveur de sync configuré, l'état de sync remplace « connecté » : « Kibo · synchronisé », « Kibo · synchronisation… », « Kibo · sync hors ligne », « Kibo · erreur de sync » (le mot « connecté » ne se combine jamais avec un état de sync).
- **Coque** : les messages adressés à l'utilisateur sur la sortie d'erreur (arrêt de Kibo) sont en français, raison comprise ; les journaux techniques préfixés `[kibo]` restent en anglais.


### 15.4 Démon : compléments

- `ProjectAdminDeps` gagne `isLocked(projectId)` (lu dans le registre des hôtes de sync) : `deleteProject` répond `CONFLICT` pendant « Partager » (§14.3, déjà écrit) ; le `detail` de chaque `CONFLICT` de `deleteProject` est stable et distinct (`has active runs`, `is shared: stop sharing first`, `is being shared`) pour que l'interface explique le bon cas quand l'état a changé entre l'ouverture du dialogue et la confirmation.
- Notes : appel `notes.create { path, markdown }` ⇒ `NoteMeta`, **création exclusive** (`CONFLICT` si le fichier existe, ouverture en `wx`, jamais d'écrasement) ; `NotesApi.create` dans le SDK et le SDK simulé ; « Nouvelle note » l'utilise, et la vérification d'existence côté composant disparaît (elle ne voyait pas un fichier créé hors Kibo entre deux listes). Spec composants §16.
- `refreshMarketSource { id }` : spec marketplace D47.

### 15.5 Codes d'erreur

Aucun nouveau code : `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` suffisent.

## 16. Décisions de la phase 9, vague 4 : formats de composant, tableau de bord éditable, créations par l'IA

Écrites le 2026-10-01, avant le plan `docs/superpowers/plans/2026-10-01-kibo-phase-9-vague-4.md` (lots 5 et 9 du plan d'action UI/UX). Mêmes garde-fous que §14 et §15 : local-first, zéro token pour l'état, rien de nouveau dans un CRDT partagé sans décision, aucune confiance implicite au code généré. Le détail technique vit dans les specs concernées : composants §17 (manifeste, SDK, conformité, aperçu d'un brouillon), IA §13 (brouillons), sync D48 (contrôle serveur des instances), agents §12 (profil générateur).

### 16.1 Formats de composant

- Cinq formats nommés, façon widgets Apple, **retenus par défaut en attendant la confirmation d'Adam** ; une autre liste ne changerait que la table ci-dessous, les manifestes des composants intégrés et la table du skill de l'agent (tâche isolée dans le plan) :

| Format | `ComponentFormat` | Taille (colonnes × rangées) | Usage |
|---|---|---|---|
| Petit | `small` | 3 × 3 | un chiffre, un état |
| Moyen | `medium` | 6 × 3 | une liste courte, une ligne de widgets |
| Large | `large` | 6 × 6 | tableau ou graphe compact |
| Demi-page | `half` | 12 × 6 | tableau complet |
| Plein écran | `full` | 12 × 9 sur un tableau de bord ; toute la page sur une page « vue » | vue |

- Grille d'un tableau de bord : 12 colonnes (`GRID_COLUMNS`), rangées de 80 px, écart de 16 px (inchangé), hauteur bornée à `MAX_GRID_ROWS = 400` rangées. **Pas de taille libre** : `Layout` reste `{ x, y, w, h }` mais une disposition n'est acceptée que si `(w, h)` est la taille d'un format (`formatOf(layout) !== null`), avec `x + w ≤ 12` et `y + h ≤ 400`.
- Un composant déclare les formats qu'il prend en charge (`manifest.formats`, spec composants §17.1), lit `sdk.format` et s'y adapte ; la suite de conformité rend chaque format déclaré, en sombre et en clair. Les composants intégrés déclarent leurs formats (§17.3).
- Instances existantes : 6 × 6 (défaut de l'interface) est `large`, 12 × 6 (défaut du core) est `half` : aucune migration. Une disposition héritée qui n'est la taille d'aucun format (doc modifié à la main) s'affiche telle quelle et reçoit le format le plus proche (`nearestFormat` : le format dont l'aire en cellules est la plus proche, égalité tranchée par l'ordre `medium, large, half, small, full` ; 5 × 5 ⇒ `medium`) à sa première modification.
- Largeur adaptative : à partir de `lg` (1024 px), 12 colonnes et respect de `(x, y)` ; en dessous, une seule colonne, les widgets dans l'ordre de lecture (`y` puis `x`), chacun à la hauteur de son format ; le mode « Modifier la disposition » n'est proposé qu'à partir de `lg`.
- Chevauchements (deux membres posent deux widgets au même endroit hors ligne, D48) : le rendu pousse vers le bas le widget le plus récent dans l'ordre (`y`, `x`, id) jusqu'à la première rangée libre (`resolveOverlaps`), de façon déterministe et sans écriture ; aucun widget n'est perdu.

### 16.2 Tableau de bord éditable : `setInstanceLayout`

- `ProjectCommand` gagne `{ method: "setInstanceLayout", instanceId, layout: Layout }` ⇒ `Instance`, réservée au shell (`WRITES = null`, comme `setInstanceConfig`, spec composants §3.6) : acceptée du shell, refusée aux composants par la passerelle ; ce n'est pas une commande réservée au démon. Le core refuse en `INVALID_INPUT` une disposition hors grille, qui n'est pas la taille d'un format, ou qui chevauche une autre instance de la même page ; `NOT_FOUND` pour une instance inconnue. La commande passe par la garde d'écriture (sync D30) : lecture seule ou accès retiré ⇒ `FORBIDDEN`, partage en cours ⇒ `CONFLICT`. Le démon ne vérifie pas que le format appartient au manifeste du composant : l'interface n'offre que les formats déclarés et un composant doit s'afficher dans tout format (§17.2). `addInstance` sans `layout` garde `half` (12 × 6) comme défaut du core ; l'interface pose toujours une disposition : la taille du format par défaut du composant (`defaultFormatOf`) à la première place libre.
- Serveur de sync : D48 (forme, bornes et taille de format vérifiées pour toute instance écrite ; le chevauchement n'est pas refusé).
- Interface (écrans 127 à 129) : un bouton « Modifier la disposition » sur un tableau de bord modifiable, à partir de `lg`, passe la page en mode disposition. Chaque widget y a une poignée (son en-tête, curseur `grab`), un menu « Format » (les formats déclarés par son composant, le courant coché ; un format impossible à poser sans chevauchement est désactivé, aide « Pas de place »), et « Retirer… » (confirmation existante). Déplacement par dnd-kit (`@dnd-kit/core`, déjà présent) : cible calculée en cellules depuis le déplacement du pointeur, aperçu de la cellule visée (contour accentué si la place est libre, contour destructif sinon), un dépôt impossible ne change rien. Le mode tient un **brouillon local** : « Enregistrer » envoie une commande `setInstanceLayout` par widget déplacé ou redimensionné, dans l'ordre de lecture ; « Annuler » ou Échap rétablit la disposition d'origine ; une commande refusée laisse le mode ouvert avec le message de l'erreur et les commandes déjà passées restent (le brouillon ne garde que les widgets refusés). Les widgets restent lisibles pendant le mode ; l'ajout d'un composant passe par le dialogue existant.
- Retrait d'un widget : déjà confirmé (« Retirer X de la page ? »), inchangé.

### 16.3 Créations par l'IA

Résumé ; décisions détaillées dans la spec IA §13. Plusieurs brouillons en parallèle, chacun un run de la file (créneaux et seuils CPU/RAM, sans exception) ; fermer le dialogue n'interrompt rien ; écran « Créations » (`#/creations`, écran 130) et indicateur dans l'en-tête (écran 131) ; images jointes à la description (4 au plus, 256 kB chacune, PNG, JPEG ou WebP, stockées à côté du brouillon, jamais dans un CRDT ni dans le dossier du brouillon) ; aperçu du brouillon validé dans le bac à sable existant avec les données simulées du SDK, format par format, et « Demander une modification » (retour envoyé à l'agent, `reviseComponentDraft`) ; publication seulement après validation (inchangé) ; contexte de l'agent enrichi (formats, exemple intégré, tokens, règles responsives) ; validation qui rend chaque format déclaré et refuse les largeurs fixes.

### 16.4 Dialogues bornés

`DialogContent` du SDK borne sa hauteur à `calc(100dvh - 2rem)` et défile en interne ; la règle vaut pour tous les dialogues (écran 135). Un dialogue qui gère son propre défilement (palette de commandes) garde `overflow-hidden` par sa propre classe.

### 16.5 Ports, écrans, codes

- E2E : `layout.spec.ts` sur les ports 4423–4424, `creations.spec.ts` sur 4425–4426 (plage §11 inchangée : 4390–4430).
- Écrans 127 à 135, décrits textuellement dans le plan ; Penpot reste un écart assumé listé au jalon.
- Aucun nouveau code d'erreur : `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `TOO_LARGE`, `UPDATE_REJECTED` suffisent.
- CSP : inchangée pour le document de l'interface ; les scripts de worker de l'interface (`/workers/*.js`, aujourd'hui le seul worker de l'aperçu d'un brouillon) sont servis avec `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'` (spec composants §17, point 6). **À confirmer par Adam (A22).**
