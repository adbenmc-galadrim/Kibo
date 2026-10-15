# Journal des versions

Ce qui change pour toi à chaque version de Kibo, de la plus récente à la plus ancienne. Le détail technique est dans les notes de chaque release.

## Non publié

-

## 0.24.0-alpha.1 — 2026-10-15

- La livraison devient un parcours de Kibo. Bouton « Livrer » sur la carte, la fiche et la liste des tickets : Kibo écrit la consigne `/full-delivery <CLÉ>` et lance l'agent de livraison du projet. Un ticket qui regroupe des sous-tickets propose ses sous-tickets prêts, dans l'ordre de leurs dépendances.
- Un ticket parent ne se lance plus directement, quel que soit l'agent.
- Préréglage « Livraison » sur la fiche d'un agent : mode automatique, tous les sous-agents, règles pnpm, git, gh, docker, playwright et kibo, dossiers du skill passés à `--add-dir`. « Ce que reçoit l'agent » montre l'origine de chaque règle et de chaque dossier (agent ou projet).
- Un outil refusé par Claude Code devient une question de Kibo, avec les règles et les dossiers proposés : coche-les, puis « Autoriser et relancer ».
- Les étapes de la livraison (lecture → livré) s'affichent sur la carte, la fiche et la barre des agents. L'agent les pose avec `kibo tickets step`.
- Kibo prépare le worktree avec la recette du projet : fichiers copiés, ports libres, variables d'environnement et commandes à lancer ensuite.
- Les captures d'écran d'un agent s'affichent dans sa question : agrandis-les, puis « Valider » ou « Demander une correction ».
- Section « Livraison » dans « Modifier le projet » : agent de livraison, règles, dossiers, recette, fichiers partagés. Les projets du registre full-delivery s'importent d'un clic.
- Files d'attente montre les verrous de la machine (e2e, heavy, review), avec qui les tient et qui attend.
- En ligne de commande : `kibo tickets list|get|set|step` et `kibo projects list|get`.
- Les sous-agents d'un run (repérage, porte qualité, review…) sont suivis : type, description, prompt, état, durée, résultat et actions dans le fil. La barre a une ligne par sous-agent actif, et la page du run un compteur.
- Les recouvrements entre agents ne bloquent plus jamais la fin d'un tour. Le critère « même fichier » disparaît, et les fichiers partagés par nature (docs, configs, i18n) ne comptent plus.

## 0.23.0-alpha.4 — 2026-10-14

- Les réponses des agents sont mises en forme (listes, code, liens, tableaux) dans le fil d'un run, le compte rendu et le chat de l'agent de projet. Un tableau défile dans son cadre, et « Agrandir » l'ouvre dans un volet avec « Copier en Markdown ».
- La barre des agents ne parle plus des recouvrements : ni liste sous un run, ni pastille, ni compteur. La détection continue en arrière-plan.
- Page Skills : la colonne des fichiers d'un skill défile seule, sans taille ni débordement sur l'éditeur ; les noms longs se coupent avec le chemin complet au survol.

## 0.23.0-alpha.3 — 2026-10-13

- Tape `/` dans une réponse à un run, dans le chat de l'agent de projet ou dans la consigne d'une assignation : Kibo propose les skills autorisés pour l'agent, ceux que tu utilises le plus en premier, et filtre au fil de la frappe (↑ ↓, Entrée ou Tab, Échap). Un `/skill` envoyé passe par les règles de l'agent comme un appel normal.
- L'agent de projet peut utiliser tous les skills de la machine et du projet.
- Fiche d'un agent : « Tous les sous-agents » autorise tout sous-agent de l'ordinateur, du projet ou des plugins. Les skills qui en lancent, comme /full-delivery et sa porte qualité, tournent ainsi dans Kibo sans refus.
- Notes : le volet « Tickets liés » défile seul, la page ne bouge plus ; l'aperçu n'affiche plus le front-matter. Même correction pour les pages « Vue » avec une source, le plan d'un ticket et la page d'un run, dont la zone de réponse reste visible sous le fil.

## 0.23.0-alpha.2 — 2026-10-13

- Sécurité : le SDK MCP passe en 1.31.0 (faille OAuth corrigée en amont).
- Quand deux agents touchent le même fichier, le second est invité à lire la version de l'autre et à la reprendre ou à factoriser, au lieu d'écrire la sienne.
- Un run repris n'affiche plus dans son fil les moments du run d'origine.
- L'ordre des domaines est stable partout (page Domaines, brief des agents, choix de l'agent), et l'usage d'un domaine est compté par projet : une copie inutilisée se supprime sans refus à tort.
- Fiche ticket : si les liens ajoutés par Kibo ne peuvent pas être chargés, une ligne discrète le signale dans Dépendances.
- Un run qui échoue au lancement ou est annulé avant son tour libère tout ce qu'il occupait en mémoire.
- Pour les tests : `KIBO_CLAUDE_ISOLATED=1` lance claude sans ta configuration globale (plugins, hooks, serveurs MCP) et écrit agents et skills sous le dossier Kibo de l'instance.

## 0.23.0-alpha.1 — 2026-10-12

- Fini le code en double entre agents : chaque run reçoit à chaque tour ce que font les autres runs du projet (plan, fichiers, exports nouveaux) et peut lire leur travail avec `peek_work`. Kibo vérifie chaque écriture et balaie les espaces de travail toutes les cinq minutes : même fichier, même export, bloc identique. L'agent alerté factorise seul, et quand il reprend du code d'un autre ticket, Kibo pose lui-même le lien « bloque », que tu peux annuler d'un clic. Réglages par projet et recouvrements à ignorer dans « Modifier le projet » ; puce « ⧉ n » dans la barre des agents, section « Travail en parallèle » sur la page du run, « Voir les fichiers » côte à côte.
- L'agent de projet modifie, réassigne, rouvre et archive des questions dans ses lots, et lit leur destinataire ; une réponse déjà transmise à un agent se rouvre d'abord. Toi aussi : tes réponses se modifient ou se retirent tant qu'elles n'ont pas été transmises, et chaque question garde son historique (« Archivées », restaurer).
- Survole une pastille « n questions » (Kanban, Tickets, fiche, lot) pour voir les questions ; clique pour arriver dessus : la question entre en vue, avec un fondu et un rebond (fondu seul si tu réduis les animations). Chaque question a maintenant une adresse propre.
- Les boutons de réponse (Répondre, Modifier, Retirer, Archiver) sont remontés dans l'en-tête de la carte de question.
- Réglages › Domaines & guidelines devient un explorateur : le workspace, puis un dossier par projet avec ses guidelines et ses domaines. Les domaines appartiennent maintenant au projet qui les utilise (migrés au premier démarrage, un domaine partagé ou inutilisé reste au workspace), et chaque projet ouvre son dossier depuis « Modifier le projet ».
- La page « Changements » ne disparaît plus de la liste des écrans.
- Inclut les correctifs de la 0.22.0-alpha.2 : Kanban sans débordement ni barre de défilement ; page Skills repliable par dossier, avec les filtres Tous / Utilisés / Avec notes.

## 0.22.0-alpha.2 — 2026-10-12

- Kanban : un titre très long (chemin, identifiant) passe à la ligne dans la carte au lieu d'en sortir ; les étiquettes et le nom d'agent trop longs s'arrêtent sur une ellipse ; plus aucune colonne ne défile de côté et les barres de défilement sont masquées (le défilement reste possible à la molette, au trackpad et au clavier).
- Page Skills : chaque groupe (cet ordinateur, projet, plugin) se replie, plugins repliés par défaut, « Tout replier / Tout déplier » ; filtres « Tous », « Utilisés » et « Avec notes » avec leurs compteurs ; tes choix sont gardés.

## 0.22.0-alpha.1 — 2026-10-12

- Des agents, plus de profils : chaque agent est un fichier Claude Code (`~/.claude/agents` ou `.claude/agents` du projet) avec sa spec, ses sous-agents appelables et ses skills autorisés. Tes profils ont été migrés en fichiers ; les instances restées en 0.21 ne les verront plus.
- Un espace Skills montre les skills de l'ordinateur, des projets et des plugins, avec un éditeur, un historique des versions restaurable et une protection contre l'écrasement.
- En fin de run, chaque agent laisse une review des skills qu'il a utilisés : tu l'intègres en diff ou tu l'ignores.
- Les runs portent un nom lisible, projet · agent · ticket, repris comme nom de session dans Claude Code.

## 0.21.0-alpha.1 — 2026-10-12

- Les agents parlent à l'agent de projet : un agent qui travaille sur un ticket peut lui signaler un ticket à créer, un blocage, un contexte utile ou une question.
- Rien n'est créé sans toi : l'agent de projet se réveille (au plus une fois par dix minutes par projet), lit les signaux et te propose un lot que tu valides.
- Le panneau de l'agent de projet gagne un onglet Signaux (boîte, réveil, signaux traités), le bouton une pastille chiffrée, le fil de chaque run sa ligne de signal ; un blocage signalé déclenche une notification.

## 0.20.0-alpha.1 — 2026-10-11

- Tu vois ce que font les agents : un fil lisible par run (phrases de l'agent, actions en français, détail technique au dépli), un plan et un compte rendu tenus par l'agent et gardés sur le ticket, des rappels sans blocage.
- La barre des agents s'ouvre d'un clic sur toute sa largeur et se redimensionne ; le volet montre les runs, le fil et le plan.
- La fiche gagne un onglet Activité : compte rendu, chronologie, plan.
- Chaque nom d'agent est cliquable : carte au survol, volet au clic, page dédiée.
- Questions : un destinataire par question (Moi, Produit, Client, modifiables par projet), export prêt à coller, réponse collée.
- Tickets démarrables : pastille et filtre dans Kanban et Tickets.
- Graphe lisible : colonnes par vague, terminés repliés, liens réduits, focus, zoom sémantique, couleur du statut, regroupement par étiquette.

## 0.19.0-alpha.3 — 2026-10-11

- Le démon ne s'arrête plus quand GitHub met trop de temps à répondre : une commande qui dépasse son délai est abandonnée, et si le système refuse de l'arrêter, Kibo le note dans son journal et continue.

## 0.19.0-alpha.2 — 2026-10-10

- Les composants « Jeu itch.io » et « Serpent » sont retirés : les jeux d'itch.io refusent de s'afficher hors de leur site. Un widget déjà posé s'affiche comme composant absent et se retire de la page depuis son menu. Storybook dans le widget Maquette reste inchangé.
- « Ajouter un composant » tient dans la fenêtre : la liste à gauche et la description à droite défilent chacune seule, « Annuler » et « Ajouter à la page » restent toujours visibles, et sur une fenêtre étroite les deux volets s'empilent.

## 0.19.0-alpha.1 — 2026-10-09

- Jeu itch.io : un widget qui affiche un jeu HTML5 d'itch.io depuis son code d'intégration, plein écran dans Kibo, sans compte ; hors ligne, il le dit.
- Storybook : une story s'affiche dans le widget Maquette comme un cadre Figma ou Penpot, interactive, avec le Storybook du projet ou celui d'un worktree, et se compare à la maquette côte à côte ou en superposition (opacité, curseur).
- Réglage Storybook dans Modifier le projet.
- Correctifs : le bouton « Transmettre à l'agent » n'apparaît que s'il y a une réponse d'Adam à transmettre ; un projet s'ouvre sur son tableau de bord (plus de page blanche) et le retour arrière reste sain ; la minimap du graphe n'est jamais sélectionnable.

## 0.18.0-alpha.1 — 2026-10-09

- Agent de projet : un chef de projet par projet, dans un panneau latéral (⌘J). Il lit le projet, garde sa mémoire et propose des lots d'actions (tickets, agents, questions, notes) que tu valides d'un clic ; aucune action sans ta validation.
- Il reste à jour : à chaque message, il reçoit ce qui a changé depuis son dernier tour ; « Nouvel agent de projet » repart d'une session neuve en gardant la note mémoire, et les anciens agents restent lisibles.
- Lot à valider : actions groupées, avant → après, raison, cases à cocher ; une action dont la cible a changé entre-temps est marquée « Périmée » et n'écrase rien.
- Fiabilité : arrêt du démon sans erreur avalée, note absente lue sans erreur au premier tour.

## 0.17.0-alpha.1 — 2026-10-09

- Étiquettes sur les tickets (`clé:valeur`), dans la fiche, avec filtres et pastilles dans Tickets et Kanban.
- Branche de travail d'un ticket, affichée sur sa fiche.
- Worktrees des agents configurables par projet : branche de base, chemin, commande de préparation ; « Assigner » rappelle le worktree prévu.
- Mode Automatique et autorisations des profils d'agent ; un seul run à la fois par ticket.
- PR : « En review » dès la PR brouillon, même ouverte hors de Kibo ; « Terminé » quand elle est fusionnée sur la branche d'intégration, y compris pour les PR empilées.
- Changements : le travail de toute la branche depuis sa base, ses commits poussés ou non, « Voir la PR ».
- Questions des agents : bloquantes ou à valider, composant Questions (widget et vue), pastille « n questions », « Terminé · n questions », « Transmettre à l'agent ».
- Le même agent reprend sa session sur un ticket ; « Repartir de zéro » dans « Assigner ».
- Import du projet Emis rejouable, sans jamais écraser ce que tu as modifié dans Kibo.
- Le toast « Onglet fermé » disparaît (⌘⇧T rouvre toujours l'onglet).

## 0.16.0-alpha.1 — 2026-10-07

- Kibo passe en alpha jusqu'au lancement : versions `0.<phase>.0-alpha.N`, publiées en pré-release, mises à jour par le canal `alpha`.
- Graphe : les tickets sans dépendance se rangent en grille compacte.
- Notes : vraies cases à cocher dans l'aperçu, widget rendu en Markdown.
- Tickets : le widget étroit reste lisible.
- Visionneuse 3D : éclairage plus doux, volet de réglages appliqués en direct (préréglages, ombres, tons, environnement).
- Agents et Files d'attente : filtre par projet mémorisé, colonne Projet.
- Penpot : connexion expliquée, profil anonyme refusé, causes précises quand un board ne s'affiche pas.
- Widget « Maquette » : plusieurs cadres, zoom, plein écran, actualisation animée.
- Kanban : la carte glissée passe au-dessus des colonnes.
- Onglets d'aperçu à la VSCode : un seul onglet d'aperçu, gardé dès que tu modifies, « Garder ouvert » et double-clic.
- Imports : barre de progression lissée, qui ne recule plus.
- Fiabilité : tests sans aucun accès réseau, parcours de bout en bout stabilisés.

## 1.6.0 — 2026-10-05

- Figma par jeton personnel, en plus du serveur MCP de l'application Figma.
- Penpot : connexion à ton instance (penpot.app ou locale) avec un jeton d'accès.
- Widget « Maquette » : un cadre Figma ou un board Penpot dans une page, avec ses tickets liés.
- Maquettes dans la fiche d'un ticket, avec un aperçu rendu par Kibo.
- Aperçus gardés en cache : toujours visibles hors ligne, marqués « Périmé ».

## 1.5.0 — 2026-10-04

- Installation : image disque macOS (Apple Silicon et Intel), paquets Linux, script `install.sh` avec vérification des sommes.
- Premier lancement complété : vérifications avec aide pour Claude Code, git et gh, bouton Réessayer.
- Didacticiel par la pratique sur un projet de démonstration, avec un agent de démonstration qui ne consomme aucun token.
- Sauvegardes automatiques de tes données, et une sauvegarde avant chaque mise à jour.
- Lancer Kibo à l'ouverture de session, « À propos », « Quoi de neuf » après une mise à jour.
- Aide des raccourcis `⌘/` et « Signaler un problème » avec un rapport sans secret.

## 1.4.0 — 2026-10-04

- Composants en 3D : kit `@kibo/sdk/three`, modèles GLB du projet, intégré « Visionneuse 3D ».
- Jeux dans un composant : boucle à pas fixe, clavier, manette, son, plein écran ; intégré « Serpent ».
- Fichiers du projet : envoi par morceaux, quota, dialogue « Fichiers du projet ».
- Capacités déclarées par chaque composant (WebGL, audio, plein écran, manette, fichiers), affichées avant l'installation.
- Sélection partagée : le Graphe sélectionne, Kanban et Tickets suivent.

## 1.3.0 — 2026-10-04

- Notes : barre d'outils, bulle de mise en forme, menu `/`, aperçu en direct, images collées.
- Graphe : pincement, minimap, sélection au clavier ; widget adapté à chaque format.
- Tableau de bord : taille libre, compaction sans trou, aperçu pendant le glisser.
- Onglets : ⌘⇧T rouvre les dix derniers onglets fermés.
- Correctif : Effacer ne ferme plus la note hors d'un champ texte.

## 1.2.1 — 2026-10-03

- File d'attente : un simple message et une réponse à une question sont distingués.
- Un run interrompu par un redémarrage est clos proprement, sans compter le temps d'arrêt.
- Le corps d'un composant prend toute la hauteur de son format.

## 1.2.0 — 2026-10-03

- Un seul démon par dossier de données : un second Kibo réutilise le premier.
- Causes distinctes d'un run échoué (dossier absent, pas un dépôt git, erreur git).
- Écrire à un agent pendant son tour : le message part au tour suivant.
- Durée d'un run sans les temps d'attente.
- Sécurité : routes de l'interface confinées, dépendances mises à jour.

## 1.1.0 — 2026-10-01

- Menus contextuels, glisser-déposer et confirmations partout.
- Projets, page Workspace, thème par appareil, page Raccourcis.
- Boîte de réception, cloche des runs, Kanban au clavier.
- Tableau de bord éditable sur une grille de douze colonnes.
- Création de composants par l'IA en arrière-plan, écran Créations.

## 1.0.0 — 2026-09-27

- Projets en pages et composants : Kanban, tickets, graphe des dépendances, notes.
- Agents Claude Code lancés en local sur les tickets, avec file d'attente et seuils CPU et RAM.
- Synchronisation d'équipe avec `kibo-sync` et partage de projets.
- Marketplace de composants signés, installés et isolés.
- Application de bureau macOS et Linux avec mises à jour automatiques.
