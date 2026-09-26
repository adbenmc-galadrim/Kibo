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

- **Le démon est l'unique porte d'entrée.** Il détient les données, lance les agents et sert l'UI. Tauri n'est qu'une fenêtre. La version web est l'UI servie par le même démon.
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
- **Sidebar** (issue de la variante A) : sélecteur de workspace, recherche `⌘K`, Vue d'ensemble, Mes tickets, Agents, arbre des projets et de leurs pages, puis Composants et Paramètres. Repliable en **rail d'icônes** (issu de la variante B).
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

## 12. Hors périmètre de cette spec / décisions ouvertes

- **Conventions et organisation de l'équipe d'agents** : `CLAUDE.md` et feuille de route.
- **Clés de ticket en écriture concurrente** et **sessions d'appairage** : tranchées dans `2026-09-26-kibo-sync.md` (clés allouées par le serveur de sync, sessions persistées hachées, 30 jours glissants).
- **Compléments par phase** : `2026-09-26-kibo-composants.md` (4), `-integrations.md` (5), `-ia.md` (6), `-sync.md` et `-marketplace.md` (7).
- **Assistant d'onboarding** (rôle → composants conseillés) : spec E, après le noyau.
- **Sync et multi-utilisateur temps réel** : spec G (serveur de sync Loro, permissions par projet).
- **Marketplace de composants** : spec H.
- **Durcissement OS du sandbox** : phase ultérieure (§10).

## 13. Glossaire

- **Workspace** : l'espace d'un utilisateur, qui contient projets, domaines, guidelines et composants installés.
- **Projet** : un doc Loro lié à un dossier local ou à un repo git.
- **Page** : un nœud de l'arbre des pages, de type *Tableau de bord* (grille) ou *Vue* (plein écran).
- **Composant** : un module versionné (manifest, UI, backend optionnel). Une **instance** est un composant posé sur une page.
- **Domaine** : une catégorie de ticket (Facturation, DevOps…) qui porte des guidelines.
- **Guideline** : un `.md` lisible, injecté dans le contexte des agents.
- **Run** : une exécution d'un agent sur un ticket.
