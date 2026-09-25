# Revue des flows — maquettes Kibo (2026-09-25)

Six relectures en parallèle (projets/pages/onglets, tickets, agents/files, code/git/PR,
composants/paramètres, cohérence visuelle) sur `kibo-design-{sombre,clair}.pdf`.
Doublons fusionnés. Écrans numérotés comme dans Penpot (1 à 23).

**Statut : §1 à §6 corrigés dans Penpot (écrans 24 à 31 ajoutés pour les bloquants). §7 reste à dessiner.**

## 1. Décisions (tranchées)

| # | Question | Recommandation |
|---|---|---|
| D1 | « Bloqué » : statut (colonne Kanban) ou état calculé depuis les liens `blocks` (badge) ? | **Retenu : statut manuel avec motif** (cause externe) ; dépendance ouverte = badge « attend KIB-n » |
| D2 | Orange : réservé aux actions d'agent, ou couleur de tous les CTA principaux ? | Réservé agents/marque, CTA neutres |
| D3 | Clés de ticket : plates (KIB-n) ou hiérarchiques (KIB-12.4.1) ? | Plates, hiérarchie par indentation |
| D4 | Couleur des profils d'agent : identité colorée ou neutre (la couleur = état du run) ? | Neutre (initiales/icône) |
| D5 | Sous-agent haiku-tests : créneau du parent (spec) ou file propre (maquette) ? | Créneau du parent (spec) |

## 2. Bloquants — flows sans écran

| Flow | Déclencheurs existants | À dessiner |
|---|---|---|
| Créer un ticket | « + Ticket » topbar, « + » colonne, « + Sous-ticket », palette | Dialogue + saisie inline (Kanban, arbre) |
| Créer une page | « + » sidebar, palette | Dialogue « Nouvelle page » (Tableau de bord / Vue) |
| Après création de projet | Écran 2 | Arrivée sur le projet + Vue d'ensemble vide |
| Assigner un ticket à un agent / lancer un agent | Sheet, Mes tickets (icône robot) | Popover d'assignation + dialogue « Lancer un agent » |
| Profil d'agent | Écran 13 | Formulaire de profil (modèle, outils, limite, guidelines) |
| Créer un composant | Écran 3 « Créer un composant (code ou IA) » | Parcours code et IA jusqu'à l'ajout sur une page |
| Permissions / confiance | Installation d'un composant sandboxé | Dialogue permissions + confiance |
| Appairage web | Spec (jeton 127.0.0.1) | Écran d'appairage |
| PR sur changements non commités | Écran 22 annonce « 4 fichiers » non commités | PR = commits poussés ; bloquer ou proposer « Commiter d'abord » |

## 3. Majeurs — jeu de données incohérent

Cause commune : pas de jeu de données de référence. Correction : figer une table unique
(tickets, statuts, assignés, arêtes, runs) et la reporter sur tous les écrans.

- **Kanban** : colonnes différentes (Backlog présent en 4/8/20, absent en 5/18/23, widget 7) ; 3 fonds de Kanban différents ; « 24 tickets » pour 9 cartes ; KIB-3/KIB-4 absents malgré le filtre ; KIB-16 absent d'« En cours ».
- **Statuts divergents** : KIB-18 (Backlog / À faire / « En file #2 »), KIB-21 (Backlog / Bloqué), KIB-16 (À faire / en cours).
- **Mes tickets** (1, 12) ne correspond pas aux assignés de l'arbre (9) ; « 7 tickets » pour 5 listés.
- **Graphe** : dépendances de KIB-12 différentes entre Sheet (4) et graphe (10) ; mini-graphe (7) avec des arêtes inexistantes ; chemin critique en deux chaînes et incluant un ticket terminé ; agent de KIB-14 bleu au lieu d'orange.
- **Arbre** : compteurs faux (KIB-3 « 2/4 », KIB-4 « 1/3 ») ; sous-tickets du Sheet incomplets.
- **Agents et file** : la barre d'état (« 3/3 », opus-dev-2 en attente, sonnet terminé) contredit l'écran 17 (opus-dev-1, opus-dev-3, sonnet-review/KIB-7) ; 4 agents actifs pour 3 créneaux sur l'écran 1 ; pas de badge « En file » sur les cartes ; sonnet-review (lecture seule) ouvre la PR #15.
- **PR** : « Ouvrir la PR » actif sur KIB-12 sans PR ; chips PR absentes de l'écran 20.
- **Guidelines** : « Core · 3 guidelines » contre 2 fichiers (14), 7 affichées ailleurs ; domaine Facturation absent.
- **Code** : `ticket.ts` et numéros de ligne différents entre 21 et 23 ; en-têtes `@@` faux.
- **Composants** : listes différentes entre 3 et 6 ; versions « v1.0 » au lieu de x.y.z ; vocabulaire confiance/origine variable.

## 4. Majeurs — flows incomplets

- **Sheet ticket (4)** : seul Statut est éditable ; pas d'ajout de dépendance, pas de « Lié à » (`relates`), menu « ⋯ » absent.
- **Code (21-22)** : pas de sélecteur de worktree, ni d'avertissement « un agent travaille dans ce worktree » ; pas de staging par bloc ; « En review » en case à cocher ; reviewers mêlant agent et compte GitHub.
- **Sidebar/onglets** : pas de menu de page/projet, pas d'imbrication, pas de rail ; règle d'ouverture des onglets non définie ; menus épingler/désépingler incomplets ; libellés d'onglets hétérogènes (format retenu : « Projet · Page »).
- **Palette (18)** : ni pages, ni projets, ni récents ; résultats de recherche incomplets.
- **Composants (3, 6)** : « Vue plein écran » proposée dans un Tableau de bord ; widget « Mes tickets » absent du catalogue ; mise à jour d'une seule instance, rehash et actions du tableau absents.
- **Paramètres** : écrans Général, Sécurité, Raccourcis absents ; Profils d'agents en double avec 13 ; dialogues de connexion des intégrations et état « non connectée » absents ; premier lancement sans cas d'échec.
- **Shell** : les Sheets recouvrent la barre d'état (4, 23).

## 5. Majeurs — visuel et accessibilité

- Backlog et À faire ont la même pastille grise.
- Domaines dans les teintes des statuts (Sécurité rouge = Bloqué, Intégrations vert = Terminé) → puce carrée et palette distincte.
- Clair : orange #F97316 en texte sur blanc (~2,8:1) et texte blanc sur orange plein → orange-600/700 ; texte secondaire trop pâle → zinc-500 minimum.

## 6. Mineurs

- Chevron de la barre d'état absent sur 1, 2, 3, 20, 21, 22.
- Icônes : une icône Lucide par concept (grille utilisée 4 fois, git-commit 2 fois, horloge pour la file et la pause).
- Sombre ≠ clair : bordure de l'élément en file (5), surlignage ligne 42 (23), badge de version (6), tuile workspace restée sombre en clair, voile des dialogues trop léger en clair, Fondations sans version claire.
- Diff : lignes coupées sans fondu, pas de coloration syntaxique ; arêtes du graphe trop pâles en clair.
- Divers : Figma « frames » → « nœuds » ; Penpot cité parmi les MCP ; sélecteur d'accent hors spec ; aperçu Kanban à 4 colonnes ; notion de « sprint » absente de la spec ; icône robot de Mes tickets ambiguë.

## 7. Écrans et états manquants (hors bloquants)

- **Tickets** : édition dans le Sheet (popovers), ajout de dépendance et cycle détecté, suppression, glisser-déposer, ticket en onglet plein écran, vue Liste, configuration du workflow, états vides.
- **Agents** : détail d'un run, transcript, run échoué, run terminé, menu de la file, admission en pause.
- **Code** : diff côte à côte, génération IA du message, amend, reformulation, conflit, push en cours / échec, PR existante, Sheet après la PR, fichier en édition dans un onglet.
- **Projets** : import de dossier, sélection du projet source, menus de page.
- **Composants/paramètres** : mise à jour d'instance, rehash, connexion d'intégration, écrans Général / Sécurité / Raccourcis.
