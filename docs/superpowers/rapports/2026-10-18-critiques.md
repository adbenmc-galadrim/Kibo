# Critiques UX de la phase 27 (boucle §39.4)

Trois personas ont utilisé Kibo (build `phase/27` @ `4cc76cf6`, données « Emis maquettes », 1440 et 1024 px, sombre et clair). Captures : `screens/2026-10-18-critique-chef-de-projet/`, `screens/2026-10-18-critique-developpeur/`, `screens/2026-10-18-critique-nouveau-venu/`.

## Tour 1 : constats retenus (spec §39.6)

| # | Constat | Gravité | Relevé par | Tâche | Re-vérifié |
|---|---|---|---|---|---|
| 1 | Sprint courant différent selon l'écran (« aucun » sur la Vue d'ensemble, S42 au Planning) | bloquant | les trois | T1, T2, T10, T15, T17 | |
| 2 | Fonctionnalités en retard invisibles entre deux sprints | bloquant | chef de projet | T1, T10 | |
| 3 | `set branch=`/`pr=` ne fait pas avancer le statut | bloquant | développeur | T6 | |
| 4 | « Bloqué » différent selon l'écran (statut vs question bloquante) | gênant | chef de projet | T1, T10, T11, T12 | |
| 5 | Compteurs incohérents, Accueil figé, chemin à la place de la clé | gênant | les trois | T1, T11 | |
| 6 | Review et CI absentes de la fiche et du Kanban | bloquant | développeur | T12, T13 | |
| 7 | Fiche ticket sans suivi (PR, CI, sprint, étapes), Activité des anciens runs, pas d'URL par clé, « Close » | gênant | développeur, nouveau venu | T13, T3 | |
| 8 | Restes de l'ère agents (Agents, Skills, Créations, Composants, Domaines, Changements) | gênant | nouveau venu | T7, T15 | |
| 9 | Création de projet de l'ancien modèle, pas de sprints, pas de client, pas d'accueil guidé | bloquant | chef de projet, nouveau venu | T5, T8, T10, T17 | |
| 10 | Clés de fonctionnalité qui consomment des numéros, ticket hors fonctionnalité perdu | gênant | chef de projet | T1, T2, T17 | |
| 11 | Copie sans retour, copie d'un ticket bloqué sans avertissement, ⌘K sans copie | gênant | développeur | T3, T15 | |
| 12 | Questions sans numéro ni badge, export silencieux, pas de « débloquée » | gênant | les trois | T2, T14 | |
| 13 | Panne affichée comme des données vides, pas de page introuvable | bloquant | nouveau venu | T15 | |
| 14 | Kanban filtré sur « Moi », pas de filtre de sprint, « Démo client » anonymes | gênant | chef de projet | T12 | |
| 15 | Panneau de l'agent : question invisible, résumé remplacé, lots remplacés visibles | gênant | chef de projet | T16 | |
| 16 | 1024 px : barre fixe, clés coupées, débordements sans indice, légende du Graphe | gênant | les trois | T15 | |
| 17 | CLI : démon visé, `--project` de `set`, « aucun » | gênant | développeur | T6 | |

Proposés à Adam (non retenus sans son avis) : couleurs sémantiques, glossaire unifié, liste Questions compacte. Reportés : point client exportable, navigation par liens et j/k, couloirs et priorités du Kanban, accueil « santé des projets » complet.

## Tour 2

Build `phase/27` @ `53347ed4` (T1 à T21 intégrées). Captures : `screens/2026-10-18-critique-t2-{chef,developpeur,nouveau-venu}/`.

Re-vérification du tour 1 : fermés 3, 5, 9, 12, 13, 14, 15 ; partiellement 1 (libellé « terminé » le jour même), 4 (colonne Bloqué, fiche), 6 et 7 (lien du job, chronologie review et CI, volet et URL), 8 (accueil, didacticiel, Ajouter un composant), 10 (CLI), 11 (copie d'un ticket bloqué), 16 (barre en icônes, panneau à 1024 px), 17 (erreurs de la CLI).

Incident : un critique a lancé une fois `kibo tickets set` sans `--home` ; le démon d'Adam (0.23) l'a refusée, rien n'a été écrit. Au tour 3, la commande est donnée complète avec `--home`.

| # | Constat (tour 2) | Gravité | Relevé par | Tâche | Re-vérifié |
|---|---|---|---|---|---|
| 18 | Sprint « terminé » le jour même, retard dès 14 h | gênant | développeur, nouveau venu | T23.1, T23.3, T23.4, T23.8 | |
| 19 | Bloqué par une question absent de la colonne, de la fiche et de la copie | gênant | les trois | T23.1, T23.2, T23.6 | |
| 20 | « Démarrable » ignore sprint et limite ; filtres exclusifs | gênant | développeur, chef de projet | T23.1, T23.2, T23.7 | |
| 21 | « Ouvertes » à deux sens, pas d'« à risque », glissement oublié | gênant | chef de projet | T23.1, T23.3 | |
| 22 | « Pour commencer » non actionnable, « À planifier » hors écran | gênant | chef de projet, nouveau venu | T23.3, T23.4 | |
| 23 | Fiche fonctionnalité : chevauchements, F1 F1, facultative par défaut | gênant | chef de projet, nouveau venu | T23.4 | |
| 24 | Export client en jargon, relance sans texte | gênant | chef de projet | T23.5, T23.8 | |
| 25 | Chronologie sans review ni CI, pas de lien du job, deux fiches, vocabulaire « étape » | gênant | développeur, nouveau venu | T23.6 | |
| 26 | Mes tickets sans suivi | gênant | développeur | T23.8 | |
| 27 | CLI : branche absente, UUID, erreur muette sur le démon | gênant | développeur | T23.7 | |
| 28 | 1024 px : barre en points, panneau envahissant ; onglets, palette | gênant | les trois | T23.8 | |
| 29 | Didacticiel et premier écran de l'ancien Kibo | bloquant | nouveau venu | T23.9 | |

Non retenus au tour 2 : orange hors agent et glossaire (décision d'Adam en attente), gras vide dans les notes (à reproduire), heures réelles du seed (montage de test).

## Tour 3

(À remplir.)
