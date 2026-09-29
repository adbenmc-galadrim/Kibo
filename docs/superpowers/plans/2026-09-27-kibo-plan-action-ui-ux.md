# Plan d'action UI/UX (phase 9)

Source : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md` (relevé d'Adam et repérage du code). Ce plan découpe le travail en lots livrables ; chaque lot reçoit ensuite son plan détaillé (tâches TDD) par `kibo-lead` avant le développement. Jalon visé : `v1.1.0`, publié par le workflow de release (mise à jour proposée aux apps installées).

## Principes

- Maquettes Penpot d'abord, en sombre et en clair, pour tout écran nouveau ou modifié ; export `kibo.penpot.xz` et PDF.
- Toute opération nouvelle du démon passe par une décision écrite dans la spec avant le code.
- Toute action destructive est confirmée ; tout texte visible est en français sans jargon, les détails techniques repliés dans « Détails ».
- Budget UI de 230 kB jamais relevé : écrans et dialogues nouveaux chargés à la demande.
- Les manques qui ne demandent que l'UI (RPC déjà présentes) passent en premier : gain rapide, aucun risque côté données.

## Lots

### Lot 1 : exposer ce que le démon sait déjà faire (UI seule)

Aucune décision de spec ; RPC existantes.

| Élément | RPC existantes | Réf. repérage |
|---|---|---|
| Fiche ticket éditable (titre, statut, description, assigné) et suppression confirmée | `updateTicket`, `setStatus`, `deleteTicket` | Tickets B |
| Dépendances « bloque » / « lié à » dans la fiche, sous-tickets et badges cliquables | `addLink`, `removeLink` | Tickets B, G |
| Changement de parent d'un ticket dans l'arbre | `moveTicket` | Tickets G |
| Pages : renommer, supprimer (confirmé), sous-page, glisser-déposer | `renamePage`, `deletePage`, `movePage` | Barre latérale B |
| Notes : renommer, supprimer (confirmé), nom tiré du titre | `notes.rename`, `notes.remove` | Notes B, point 5 |
| Réglages d'un widget (« Réglages… » dans le menu d'instance) | `setInstanceConfig`, `setInstanceComponent` | Tableau de bord B |
| Domaines : renommer, couleur | `updateDomain` | Paramètres G |

Livrable : tickets, pages, notes, widgets et domaines complets dans l'UI. Maquettes : fiche ticket éditable, section Dépendances, menus de page.

### Lot 2 : projets et workspace (démon + UI)

Décision de spec à écrire : `updateProject` (nom, couleur, icône importée, dossier), `deleteProject` (effets sur tickets, runs, worktrees, projet partagé : refus ou arrêt du partage), `updateWorkspace` (nom, image, description). Plusieurs workspaces : hors lot, reste le ticket KIB existant.

- Menu projet complet : modifier, changer d'icône (import d'image bornée en taille, stockée hors CRDT si partagée), lier ou changer le dossier, supprimer (confirmation en saisissant le nom).
- Page « Workspace » dans Paramètres : nom, image, description ; « Paramètres du workspace » y mène.
- Sélecteur de dossier natif (`tauri-plugin-dialog`) pour nouveau projet, dossier des notes, Rejoindre, dossier d'un projet.

Points 1 et 3 d'Adam ; Workspace et projets B.

### Lot 3 : tickets globaux

Décision de spec à écrire : un ticket sans projet vit dans une boîte de réception du workspace (clé propre, ex. `INB-`), puis peut être rattaché à un projet (déplacement avec nouvelle clé) ; effet sur « Mes tickets », le Kanban et les agents (un ticket non rattaché n'est pas assignable à un agent faute de dossier).

- Dialogue « Nouveau ticket » : sélecteur « Boîte de réception / projet », assigné choisi ; bouton toujours visible.
- Vue « Boîte de réception » et rattachement.

Point 8 d'Adam.

### Lot 4 : menus contextuels et comportement desktop

- Menu natif de la webview bloqué hors champs de saisie ; menus contextuels : arbre Tickets, Kanban, Notes, Changements (ouvrir, éditeur externe, copier le chemin, indexer / désindexer, annuler les changements), pages, projets.
- RPC à ajouter côté démon pour « annuler les changements d'un fichier » et « tout indexer / désindexer » (décision courte dans la spec code).
- Liens externes par `tauri-plugin-opener`, capacité limitée à l'ouverture d'URL `https` ; menu natif macOS explicite (⌘W ferme l'onglet, pas la fenêtre ; ⌘T, ⌘1-9) ; raccourcis affichés selon la plateforme.
- Fenêtre : taille minimale, mémorisation taille et position, titre avec projet courant.
- Logo : `app-icon.svg` régénéré depuis la piste 5 Kanban, `tauri icon`, `KiboLogo` aligné, favicon.

Points 5 et 10 d'Adam ; Desktop G.

### Lot 5 : tableau de bord éditable

Décision de spec : commande `setInstanceLayout` (x, y, largeur, hauteur bornées à la grille), validée côté serveur de sync pour un projet partagé.

- Mode « Modifier la disposition » : glisser, redimensionner, ordonner (dnd-kit), grille adaptative à la largeur, retour visuel, annulation.
- Retrait d'un widget confirmé.
- Formats de composant nommés (petit, moyen, large, demi-page, plein écran), inspirés des widgets Apple : le manifeste déclare les formats pris en charge, le redimensionnement passe d'un format à l'autre (pas de taille libre), chaque composant intégré s'adapte à chacun de ses formats et la suite de conformité rend chaque format. Décision de spec : champ `formats` du manifeste et valeur par défaut pour les composants existants.

Points 9 et 14 d'Adam.

### Lot 6 : lisibilité des écrans avancés

- Marketplace et Composants : titre et explication, état vide avec bouton « Ajouter une source », carte sans identifiant brut, empreintes et index dans « Détails », « Créer un composant » accessible, confirmations (désinstaller, retirer la confiance, retirer une source), rafraîchissement par ligne, rangement Paramètres › Sources clarifié.
- Sync : écran réécrit (à quoi ça sert, comment obtenir un serveur, étapes numérotées), parcours « Ajouter un appareil » cohérent des deux côtés, jargon replié, confirmations de révocation, actions sur les projets partagés, titre français.
- Agents : confirmations (arrêter un run, retirer de la file, supprimer un profil), historique cliquable avec filtre (une ligne ouvre le journal du run, « Journal indisponible » s'il manque), vocabulaire (« Runs », « créneaux », options du CLI) expliqué ou remplacé.
- Code : libellés git explicités (M/A/D/R/U en toutes lettres, « Indexés »), commande `git push -u` remplacée par une action.

- Composants › Installés : barre de recherche, filtres minimalistes (confiance, origine), tri par clic sur l'en-tête de colonne.
- « Utilisé dans : N pages · N projets » cliquable : volet latéral qui liste projets et pages, un clic ouvre la page (données `usages` déjà fournies par le démon).

Points 6, 15, 16 et 17 d'Adam ; Composants, Sync, Agents, Code G et C.

### Lot 7 : réglages et en-tête

- Apparence : choix Système / Clair / Sombre, appairage web déplacé dans Sécurité, texte d'appairage corrigé.
- En-tête : cloche → historique des runs (terminés, en attente de réponse, en échec) ; avatar → menu (nom, thème, sessions, Paramètres).
- Réglages factices : écran Raccourcis (maquette 77) livré ; carte « Application » livrée ou retirée ; onglet « Créés par moi » retiré tant que l'auteur n'est pas enregistré ; « Depuis un projet » et « Générer avec Claude » retirés ou livrés.

Points 2 et 7 d'Adam ; Paramètres G.

### Lot 8 : confort de lecture et robustesse

- Aperçu, éditeur et diff : bascule « Retour à la ligne » mémorisée, recherche dans le fichier, copie du chemin, aller à la ligne.
- Écran de chargement et écran « démon injoignable » avec Réessayer.
- Largeurs adaptatives (Paramètres, fiche ticket, journal CI, Changements), fil d'Ariane cliquable, état vide et chargement de l'arbre Tickets, recherche et filtres de l'arbre, tri des notes et dossiers.
- Kanban : carte entière déplaçable, réordonnancement dans une colonne, « + » dans Bloqué, filtre par défaut explicite.

Point 4 d'Adam ; lots C du repérage.

### Lot 9 : création de composants par l'IA

Décisions de spec à écrire : brouillons multiples et en arrière-plan (chacun est un run de la file d'attente, avec ses créneaux), pièces jointes image (taille et format bornés, stockées avec le brouillon, jamais dans un CRDT), aperçu du brouillon (bac à sable existant des composants tiers, données simulées), contexte fourni à l'agent.

- Création qui continue quand on ferme la fenêtre ; écran « Créations » (brouillons en cours, étape, journal, reprise) et indicateur dans l'en-tête ; plusieurs créations à la fois.
- « Créer un composant » accessible depuis la page Composants ; dialogues de hauteur bornée avec défilement interne.
- Description avec images (glisser, coller, choisir un fichier).
- Aperçu du composant dans chacun de ses formats avant publication, avec retours envoyés à l'agent ; publication seulement après validation.
- Contexte donné à l'agent : formats et tailles (lot 5), un composant intégré en exemple, tokens de style et règles responsives ; la validation vérifie le rendu de chaque format déclaré.

Points 11, 12 et 13 d'Adam. Dépend du lot 5 (formats).

## Ordre et parallélisme

1. **Vague 1** : lot 1 (UI seule) et lot 4 (desktop) en parallèle ; maquettes des lots 2, 3, 5 pendant ce temps ; décisions de spec des lots 2, 3, 5 écrites par `kibo-lead`.
2. **Vague 2** : lots 2 et 5 (démon + UI) ; lot 7.
3. **Vague 3** : lots 3, 6 et 8.
4. **Vague 4** : lot 9 (après le lot 5, dont il reprend les formats).
5. **Jalon `v1.1.0`** : contrôle visuel sombre et clair face aux maquettes, rapport, version `1.1.0`, PR de phase, CI verte, tag : la release est publiée et proposée aux apps installées.

## Risques

- Suppression d'un projet partagé et tickets globaux : effets sur la sync (D39, D46) à trancher avant le code.
- Budget UI déjà à 229,1 kB : chaque lot charge ses écrans à la demande ; un lot qui ne tient pas le budget réduit d'abord le chargement initial existant.
- Icônes et images importées : taille et format bornés, jamais dans le CRDT d'un projet partagé sans décision.
- Lot 4 touche la coque Rust : vérifiable seulement en CI (desktop-smoke) ou sur la machine d'Adam.
