# Repérage UI/UX après v1.0

Repérage seul, sans développement, à transformer en plan d'action. Sources : relevé d'Adam (10 points) et parcours du code de l'UI (`packages/ui/src`, composants, coque Tauri) sur `phase/8`.

Gravité : **B** bloquant, **G** gênant, **C** cosmétique. Chemins relatifs à la racine du dépôt ; `ui/` = `packages/ui/src/`.

## Constats de fond

- **Le démon ne prévoit pas plusieurs opérations demandées.** Seul `createProject` existe pour un projet (pas de renommage, suppression, dossier, icône) ; seul `renameWorkspace` pour le workspace ; aucune commande pour déplacer ou redimensionner un widget. Les points 1, 3, 8 et 9 demandent donc un travail démon (schéma, RPC, commandes) en plus de l'UI.
- **Des RPC existent sans être utilisées par l'UI** : `renamePage`, `movePage`, `deletePage`, `deleteTicket`, `moveTicket`, `addLink`, `removeLink`, `setInstanceConfig`, `setInstanceComponent`, `updateDomain`, `addBinding`, `removeBinding`, `deleteBinding`, `exportKpkg`, `testMcpServer`, et les appels `notes.rename` / `notes.remove`. Une bonne partie du travail est de l'exposition dans l'UI, sans changement de démon.
- **Aucune confirmation sur la plupart des actions destructives** (widget, composant, source, appareil, domaine, run, profil).
- **Beaucoup de jargon technique** visible (empreintes, identifiants bruts, commandes CLI, termes git et anglais).

## A. Relevé d'Adam

| # | Point | État constaté | Grav. | Piste |
|---|---|---|---|---|
| 1 | Workspace : créer, supprimer, modifier (nom, image, description) | Renommage seul (`ui/shell/WorkspaceSwitcher.tsx:44-47`) ; un seul workspace, libellé « Workspace local » en dur (`ui/i18n/fr.ts:15`) ; pas d'image ni de description dans `WorkspaceConfig` (`packages/schema/src/agent.ts:120-126`) ; « Paramètres du workspace » ouvre Domaines (`ui/shell/AppSidebar.tsx:172`). | G | Nom, image, description au schéma et page « Workspace » dans Paramètres ; plusieurs workspaces = chantier démon (déjà ticket KIB). |
| 2 | Cloche et profil inutiles | Cloche décorative (`ui/shell/ShellHeader.tsx:72-76`, `NotifyButton.tsx:11`) ; avatar = simple `span` (`UserAvatar.tsx:9-16`). | G | Cloche → historique des runs (terminés, en attente, en échec) ; avatar → menu (nom, thème, sessions, Paramètres) ; sinon les retirer. |
| 3 | Projet : modifier, supprimer, nom, icône importable | Menu « ⋯ » = « Partager » seul (`ui/shell/ShareControls.tsx:24-44`) ; aucune RPC ; couleur tirée d'office (`ui/dialogs/NewProjectDialog.tsx:24,72`) ; pas de champ icône (`packages/schema/src/project.ts:4-10`). | B | RPC `updateProject` / `deleteProject` (confirmation), champ `icon` importable, menu projet complet. |
| 4 | Aperçu de fichier sans retour à la ligne | `whitespace-pre` (`ui/files/CodeLines.tsx:49`) ; éditeur sans `lineWrapping` (`CodeEditor.tsx:45-50`) ; le diff, lui, revient à la ligne (`ui/code/DiffView.tsx:12`). | G | Bascule « Retour à la ligne » mémorisée, commune aperçu, éditeur et diff. |
| 5 | Clic droit natif Tauri ; menus contextuels | Un seul menu contextuel (onglets, `ui/tabs/TabBar.tsx:49-76`) ; menu natif partout ailleurs ; rien dans l'arbre Tickets (`components/tickets/src/TicketsTree.tsx:75-137`), Notes (`components/notes/src/NoteList.tsx:51-69`, suppression absente alors que `notes.remove` existe), Changements (`ui/code/FileList.tsx:43-85`). | B (notes) / G | Bloquer le menu natif hors champs de saisie ; menus : note (renommer, supprimer, révéler), ticket (ouvrir, statut, sous-ticket, supprimer), fichier modifié (ouvrir, éditeur externe, copier le chemin, (dés)indexer, annuler). |
| 6 | Marketplace et page Sync incompréhensibles | États vides sans bouton ni explication (`ui/components-page/MarketplaceTab.tsx:25`, `ui/settings/SyncSettingsPage.tsx:29-40`) ; empreintes `ed25519`/`sha256`, « Index n° » (`ui/settings/SourceRow.tsx:70-71`, `ui/i18n/fr-market.ts:35-36,70,135`) ; `wss://`, certificat racine (`ui/dialogs/ConnectServerDialog.tsx:90,116-121`) ; identifiant de compte brut (`ui/settings/SyncServerCards.tsx:86`) ; titre « Sync » en anglais (`fr-collab.ts:7-8`). Détail en section B. | G | Réécrire les deux écrans pour un utilisateur : à quoi ça sert, que faire ensuite, états vides avec bouton ; identifiants techniques repliés dans « Détails ». |
| 7 | Thème sombre/clair dans Apparence | Apparence ne contient que l'appairage web (`ui/settings/AppearancePage.tsx:20-31`) ; thème seulement par la palette, en cycle (`ui/theme.ts:9-10,31-36`). | G | Choix Système / Clair / Sombre dans Apparence, plus une bascule rapide (menu avatar ou en-tête). |
| 8 | Ticket global ou assignable à un projet | Dialogue lié au dernier projet actif (`ui/shell/ShellDialogs.tsx:121-128`), sans choix de projet (`NewTicketDialog.tsx:22-55`) ; bouton masqué sans projet ouvert (`ShellHeader.tsx:61`) ; assigné forcé à « Moi » ; `createTicket` exige un projet. | G | Sélecteur de projet et d'assigné ; ticket global = boîte de réception du workspace côté démon (décision à prendre). |
| 9 | Réagencer le tableau de bord | Grille figée 12 × 80 px (`ui/pages/PageView.tsx:90-107`) ; widget posé en 6×6 (`ui/lib/next-layout.ts:4-15`) ; aucune commande de layout (`packages/schema/src/command.ts:52-58`). | G | Commande `setInstanceLayout` ; mode « Modifier la disposition » : glisser, redimensionner, ordonner (dnd-kit déjà présent) ; adaptation à la largeur. |
| 10 | Mauvais logo de l'app Tauri | `apps/desktop/app-icon.svg`, `src-tauri/icons/*` et `ui/shell/KiboLogo.tsx:13-16` dessinent un carré orange à 3 barres, absent des pistes de la maquette ; la maquette a retenu la « piste 5 Kanban » (`design/penpot/scripts/01-core.js:22-26`), déjà utilisée par `WorkspaceMark.tsx` ; pas de favicon. | G | Régénérer `app-icon.svg` depuis la piste 5, puis `tauri icon` ; aligner `KiboLogo` ; ajouter le favicon. |

## A bis. Relevé d'Adam, second envoi (2026-09-29)

| # | Point | État constaté | Grav. | Piste |
|---|---|---|---|---|
| 11 | Création de composant en arrière-plan, suivi d'avancement, plusieurs à la fois | Dialogue modal (`ui/dialogs/CreateComponentDialog.tsx:71-104`) ouvert seulement depuis « Ajouter un composant » d'une page (`AddComponentDialog.tsx:297`) ; brouillon persisté par le démon (`daemon/ai/draft-store.ts`) mais seule une bannière « Reprendre » ramène le premier brouillon inachevé (`ai/DescribeCard.tsx:158-181`) ; stepper statique en 5 étapes (`ai/DraftStepper.tsx`) ; un seul brouillon par dialogue côté UI, alors que le démon n'interdit qu'un second brouillon du même id (`draft-lifecycle-conflict.test.ts:24-50`). | G | Écran « Créations » (liste des brouillons, état, journal), création qui continue fermée, indicateur dans l'en-tête, plusieurs brouillons en parallèle (dans la file des agents). |
| 12 | Page de création qui prend toute la hauteur, sans défilement | `DialogContent` sans `max-h` ni `overflow-y-auto` (`sdk/ui/dialog.tsx:63-64`), le diff et le journal débordent de l'écran. | G | Hauteur bornée et défilement interne (vaut pour tous les grands dialogues). |
| 13 | Conception par IA : images, test avant publication, contexte de tailles et d'exemples, style adaptable, composants responsives | Entrée texte seule (`ai/DescribeCard.tsx:41-52`, `schema/ai.ts`) ; revue = diff + rapport de validation, sans aperçu (`ai/DraftDiffReview.tsx`, `ValidationReportView.tsx`), aperçu vivant seulement par `kibo component dev` ; le prompt (`daemon/ai/prompts.ts:77-158`) ne donne ni tailles (grille 12 colonnes, rangées 80 px, 6×6 par défaut), ni composant intégré en exemple, ni tokens de style ; responsive quasi absent (`@container` dans `sdk/ui/card.tsx:22` et `TicketsTree.tsx:152` seulement). | G | Pièces jointes image, aperçu du brouillon dans un bac à sable avec retours à l'agent avant publication, contexte fourni à l'agent (formats, composants intégrés en exemple, tokens), règles responsives vérifiées par la validation. |
| 14 | Tailles de composant : formats imposés (plein écran, widget, demi-page…), chacun adapté, façon widgets Apple | Manifeste sans formats (`schema/manifest.ts:14-47`, seulement `kind`) ; grille `grid-cols-12 auto-rows-[80px]` (`ui/pages/PageView.tsx:90-105`) ; taille figée 6×6 (`ui/lib/next-layout.ts:3-16`) ; aucune commande de déplacement ou redimensionnement (`schema/command.ts`). | G | Jeu de formats nommés (petit, moyen, large, demi-page, plein écran) déclarés par le manifeste, rendu adapté à chaque format, conformité qui teste chaque format ; lié au point 9 (tableau de bord éditable) et au point 1 (workspace). |
| 15 | Agents : consulter le thread d'un run de l'historique | Journaux persistés sans purge (`daemon/agents/run-store.ts:21-36`, `getRunLog`) mais lignes de l'historique non cliquables (`ui/agents/AgentsPage.tsx:134-171`) ; seul le tiroir montre le journal des 5 derniers runs (`AgentDrawer.tsx:168-176`). | G | Ligne cliquable ⇒ journal du run (`RunJournal`) ; « indisponible » si le journal manque. |
| 16 | Composants › Installés : recherche, filtres minimalistes, tri par en-tête | Tableau sans recherche, filtre ni tri (`ui/components-page/ComponentsTable.tsx:48-90`, `ComponentsPage.tsx:70-100`) ; les filtres n'existent que pour la Marketplace (`MarketFilters.tsx`). | C | Barre de recherche, un ou deux filtres (confiance, origine), tri par clic sur l'en-tête. |
| 17 | « Utilisé dans : 3 pages · 3 projets » cliquable | Texte seul (`ComponentsTable.tsx:76-78`), calculé depuis `usages` (`components-page/rows.ts:29-33`) qui contient déjà les couples projet/page. | C | Volet latéral listant projets et pages, clic ⇒ ouvre la page ; même traitement pour « Utilisé dans N projets » (`PublishSections.tsx:45`). |

## B. Points nouveaux, par zone

### Shell et en-tête
- **B** Écran blanc au démarrage : `App.tsx:31` et `Shell.tsx:46` rendent `null` pendant le chargement ; un échec de `bootstrap` hors `KiboError` laisse l'écran blanc. → écran de chargement et « démon injoignable » avec Réessayer.
- **C** Fil d'Ariane non cliquable (`ui/shell/Breadcrumb.tsx:28-51`).
- **C** Erreur git tronquée, sans détail ni action (`ShellHeader.tsx:54-58`).
- **C** Raccourcis toujours affichés en ⌘, même sous Linux (`AppSidebar.tsx:181`, `TabBar.tsx:53,71`, `CommitPanel.tsx`, `fr-code.ts:175`).
- **C** Jargon « Démon local / injoignable » (`fr.ts:165-166`, `AgentBar.tsx:91-96`) ; indicateur de sync non cliquable hors sync configurée (`SyncIndicator.tsx:44-50`).
- **C** Anglais dans la palette : « ouvrir dans le Sheet » (`fr-code.ts:38`).

### Barre latérale
- **B** Pages : ni renommer, ni supprimer, ni déplacer, ni sous-page (RPC existantes non utilisées ; `fr.nav.newSubPage` jamais utilisé, `AppSidebar.tsx:229`). → menu de page et glisser-déposer.
- **C** Pages visibles seulement pour le projet courant ; « + Nouvelle page » au survol seulement (la maquette en fait une entrée, `design/penpot/scripts/03-shell.js:19`).
- **C** Projets ni triables, ni filtrables, ni réordonnables.

### Workspace et projets
- **B** Impossible de lier un dossier après création alors que l'app le demande (`fr-code.ts:71`, `fr.ts:117`). → réglage « Dossier » du projet.
- **G** Chemins de dossier saisis à la main (nouveau projet, dossier des notes, Rejoindre) ; pas de plugin Tauri `dialog`. → bouton « Parcourir… ».
- **C** Option « Depuis un projet » grisée « Bientôt » (`NewProjectForm.tsx:92-100`) ; libellé de clé « 2 à 6 majuscules » (`fr.ts:74`).

### Tickets
- **B** Fiche ticket en lecture seule : titre, statut, description, assigné non modifiables (`ui/shell/TicketSheet.tsx:52`, `TicketDetail.tsx:86-121`) alors que `updateTicket` / `setStatus` existent ; pas de suppression ni de menu « ⋯ ».
- **B** Aucune création de dépendance (`addLink` / `removeLink` non utilisées) : le Graphe affiche « Aucune dépendance » sans moyen d'en créer (`components/graph/src/GraphView.tsx:160-161`).
- **G** Sous-tickets et badges « attend » non cliquables (`TicketDetail.tsx:105-131`).
- **G** Arbre : ni recherche, ni tri, ni filtre, ni changement de parent (`moveTicket` non utilisée) ; écran vide au chargement (`TicketsTree.tsx:149`).
- **C** Sélecteur de domaine affiché en lecture seule (`TicketDetail.tsx:47`) ; onglet « Créés par moi » désactivé en permanence (`ui/mine/MyTicketsPage.tsx:43`).

### Kanban
- **G** Glisser peu découvrable : seule la clé sert de poignée (`components/kanban/src/KanbanCard.tsx:59`).
- **G** Ni réordonnancement dans une colonne, ni édition, ni suppression ; menu « ⋯ » réduit à « Déplacer vers » (`KanbanCard.tsx:70-79`).
- **C** Colonne « Bloqué » sans « + » (`Kanban.tsx:50-52,141`) ; filtre par défaut « Moi + agents » qui masque les tickets des autres (`Kanban.tsx:70-72`).

### Notes
- **B** Ni suppression ni renommage ; nouvelle note toujours `sans-titre-N.md` (`components/notes/src/NotesView.tsx:23-29,150-160`). → `notes.remove` / `notes.rename`, nom tiré du titre.
- **G** Pas d'arborescence de dossiers ni de tri (`NoteList.tsx`).

### Code et changements
- **G** Impossible d'annuler les changements d'un fichier ; pas de « Tout indexer / Tout désindexer » (`FileList.tsx:125-134`, RPC absentes dans `packages/schema/src/code.ts`).
- **G** Mise en page figée en 3 colonnes (272 px / reste / 340 px, `ChangesView.tsx:191`), débordement en fenêtre étroite.
- **C** Jargon git : M/A/D/R/U, « Indexés », « worktree », « HEAD détachée », cherry-pick / revert / rebase, `git push -u` (`fr-code.ts:55-123`) ; « Générer avec Claude » grisé en permanence (`CommitPanel.tsx:57-68`).

### Aperçu de fichier
- **C** Ni recherche dans le fichier, ni copie du chemin, ni aller à la ligne ; numéro de ligne affiché à 1 en dur (`FilePreviewSheet.tsx:106`).

### Tableau de bord et widgets
- **B** Réglages d'une instance inaccessibles après création (`setInstanceConfig` non utilisée), alors que le widget Source MCP renvoie vers ces réglages (`components/mcp-source/src/fr.ts:15`). → « Réglages… » dans `ui/pages/InstanceMenu.tsx`.
- **G** Retrait d'un widget sans confirmation (`InstanceMenu.tsx:65-76,119-122`).
- **C** Graphe : bouton « Hiérarchique » grisé mais d'apparence active (`GraphView.tsx:74-90`).

### Composants et marketplace
- **G** Marketplace vide sans bouton, renvoie à un chemin de réglages (`MarketplaceTab.tsx:25`, `fr-market.ts:16`).
- **G** Page Composants sans titre, sans explication, sans « Créer un composant » (accessible seulement depuis « Ajouter un composant » d'une page).
- **G** Jargon : identifiant brut sur la carte (`MarketCard.tsx:42`), « Sandboxé », « Revérifier l'empreinte », « Retirer la confiance », `kibo component test <id>`, `kibo.component.json`, `sha256:`, `ed25519:`, « Index n° », `INDEX_ROLLBACK`, « Mio ».
- **G** Désinstaller et retirer la confiance sans confirmation (`ComponentRowMenu.tsx:86-119`) ; « ⋯ » affiché mais désactivé pour un composant intégré (`:60`).
- **G** Sources : retrait sans confirmation (`SourceRow.tsx:95`) ; « Rafraîchir » d'une ligne rafraîchit tout (`ComponentSourcesPage.tsx:17`) ; pas de renommage ; rangement confus « Paramètres › Composants › Sources » face à l'écran « Composants » de la barre latérale.

### Sync et partage
- **G** État vide sans explication : « Aucun serveur de sync configuré. » ne dit ni ce que c'est ni comment en obtenir un (`fr-collab.ts:11`).
- **G** Parcours incohérent entre appareils : « Ajouter un appareil » renvoie à « Paramètres › Sync », dont le dialogue demande une adresse `wss://` et un « Code d'invitation » (`fr-collab.ts:87`, `ConnectServerDialog.tsx:85-121`).
- **G** Révocation d'appareil sans confirmation ni renommage (`SyncDevicesCard.tsx:41-68`).
- **C** Jargon : certificat racine, chemin `/etc/ssl/…pem`, `wss://`, identifiant de compte hexadécimal ; tableau « Projets partagés » sans action (`SyncProjectsCard.tsx:65-85`).

### Agents
- **G** Arrêter un run, retirer de la file, supprimer un profil : sans confirmation (`AgentDrawer.tsx:108`, `QueuePage.tsx:146`, `ProfileSheet.tsx:119`).
- **G** Historique non cliquable (ni journal, ni ticket), sans filtre ni pagination (`AgentsPage.tsx:152-166`).
- **C** Jargon : « Runs », « créneaux », « tokens (abonnement) », `--resume`, `claude -p`, nom de l'option de permissions du CLI ; « Agent SDK · bientôt » grisé (`ProfileSheet.tsx:176`).

### Paramètres
- **G** Réglages factices : « Raccourcis » grisé (écran 77 de la maquette absent) ; carte « Application » (langue, ouverture à la connexion, dossier des données) entièrement désactivée (`GeneralPage.tsx:38-62`).
- **G** Rangement : appairage web dans Apparence (sa place est Sécurité) ; texte d'appairage citant un chemin inexistant « Paramètres › Apparence & général › Accès web » (`fr.ts:49`) ; « Paramètres du workspace » → Domaines.
- **G** Domaines : ni renommage ni couleur (`updateDomain` non utilisée) ; suppression du domaine et des guidelines sans confirmation (`DomainsPage.tsx:116-259`).

### Desktop (Tauri)
- **G** Menu natif (Recharger, Inspecter) et sélection de texte partout ; pas de `select-none` sur la coque.
- **G** Pas de taille minimale de fenêtre, ni mémorisation de taille et position ; titre fixe « Kibo » (`apps/desktop/src-tauri/src/main.rs:101-105`).
- **G** Liens externes (`target="_blank"`) sans plugin `opener` exposé : risquent de ne rien ouvrir (`PushActions.tsx:70`, `GithubRefs.tsx:12`, `FigmaSection.tsx:94`, `UpdateCard.tsx:81`, `components/mcp-source/src/SourceItemRow.tsx:15`). À vérifier dans l'app.
- **G** ⌘W / ⌘T / ⌘1-9 peuvent entrer en conflit avec le menu macOS par défaut (⌘W fermerait la fenêtre) (`ui/tabs/use-tab-shortcuts.ts:13-23`). À vérifier ; définir un menu natif explicite.
- **C** Zoom et taille de texte non réglables ; glisser-déposer de fichiers sans effet ni retour.

### Largeurs et thèmes
- **G** Largeurs fixes : Paramètres `grid-cols-[14rem_1fr]`, fiche ticket 480 px (`TicketSheet.tsx:39`), journal CI 720 px, Changements en 3 colonnes.
- **C** Pastille CI `bg-zinc-400` sans variante sombre (`KanbanCard.tsx:21`).

### Écarts avec les maquettes
- Logo (point 10) ; « Ajouter une page » en entrée de la barre latérale ; écran Raccourcis (77) absent.
- Flux encore marqués « Reste » dans `design/revue-flows.md:84-90`, donc ni dessinés ni codés : édition dans la fiche ticket, dépendances, suppression, menus de page et de projet, états vides du Kanban et des Tickets.

## Pistes de regroupement pour le plan d'action

1. **Gestion des entités** (démon + UI) : workspace, projet (nom, icône, dossier, suppression), pages, tickets (édition, suppression, dépendances, parent), notes, domaines, widgets (réglages), sources, appareils.
2. **Menus contextuels et comportement desktop** : blocage du menu natif, menus par volet, liens externes, sélecteur de dossier, fenêtre, raccourcis et menu macOS, logo et favicon.
3. **Tableau de bord** : layout éditable et adaptatif.
4. **Lisibilité** : réécriture des écrans Marketplace, Composants, Sync et Agents ; jargon ; états vides ; confirmations des actions destructives.
5. **Réglages** : Apparence avec thème, rangement Sécurité / Workspace, réglages factices à livrer ou retirer, en-tête (cloche, avatar).
6. **Confort de lecture** : retour à la ligne, recherche dans le fichier, largeurs adaptatives, écran de chargement.
7. **Création de composants** : création en arrière-plan et suivie, plusieurs à la fois, images, aperçu avant publication, contexte donné à l'agent, formats de composant (points 11 à 14).

Chaque lot passe par les maquettes Penpot (sombre et clair) avant le code, et par une décision dans la spec quand le démon change.
