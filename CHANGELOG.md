# Journal des versions

Ce qui change pour toi à chaque version de Kibo, de la plus récente à la plus ancienne. Le détail technique est dans les notes de chaque release.

## Non publié

-

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
