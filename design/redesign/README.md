# Redesign de Kibo — pistes visuelles

Penpot local (`http://localhost:9010`), projet **« Kibo · Redesign »**, fichier **« Kibo · Redesign »**
(projet `594d69fb-262b-814f-8008-cbb89cee4e90`, fichier `594d69fb-262b-814f-8008-cbb89cf3feb4`).
Le fichier « Kibo » de `design/penpot/` n'est pas modifié.

## Brief (décision d'Adam du 2026-10-16)

Kibo devient un **outil de suivi de projet**.

- **Gardé** : tickets, ensembles de tickets (spec §36), Kanban, graphe des dépendances, notes, questions, agent de projet
  (il propose des lots et met le suivi à jour), sync GitHub et PR.
- **Sorti de Kibo** : le développement, fait dans T3 Code par le skill `full-delivery`. L'avancement remonte sans token :
  - git et PR : branche poussée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé ;
  - étapes 0 à 11 posées par `kibo tickets step` (Lecture … Livré) ;
  - en option, un signal « session active ».
- **Masqué par défaut** (réglage) : l'exécution des agents dans Kibo (file, Files d'attente, fil des runs, préréglages).
- **Navigation** : plus d'entrée Agents ni Files d'attente au premier niveau.

Règles de dessin : chaque écran en sombre et en clair (`… (clair)`), shadcn/ui et tokens zinc, **orange réservé aux agents
et à la marque** (agent de projet, session `full-delivery` active, étape en cours, logo), Geist et Geist Mono, une icône
Lucide par concept. Un ensemble n'a jamais d'agent ni d'étape : il porte son avancement `n/m`.

## Trois pistes, trois écrans chacune

| Page Penpot | Piste | Écrans |
|---|---|---|
| A · Tableau de bord sobre | **A** — dense, façon Linear : barre latérale avec l'arbre des projets, tableaux compacts, panneau de l'agent de projet à droite | A1 Vue d'ensemble · A2 Tickets · A3 Graphe |
| B · Éditorial | **B** — aéré, colonne centrée, navigation en haut ; la feuille de route des ensembles au centre, « le point de l'agent » en chapeau | B1 Aperçu · B2 Tickets · B3 Graphe |
| C · Chronologie | **C** — le temps en abscisse : bande des échéances, fil d'activité daté, graphe en couloirs ; rail d'icônes | C1 Chronologie · C2 Tickets · C3 Graphe |

Chaque écran existe en sombre (x = 0) et en clair (x = 1 540), rangées espacées de 1 500 px. 18 boards.

- **Vue d'ensemble** : avancement global (41/68, 60 %), ensembles C2 à C5 avec `n/m`, tickets en review et leurs PR,
  questions ouvertes, activité remontée de git et de `full-delivery`, agent de projet visible (lot n° 6 à valider).
- **Tickets** : liste à plat, sans ligne pour les ensembles ; puce d'ensemble (`C2`, `C4`…), état tiré de git et des PR
  (branche, PR, CI, changements demandés), étape de livraison (barre de 12 segments, stepper ou « étape n/11 »).
- **Graphe** : ensembles en cadres en tirets (A : grille par vagues ; B : colonnes-chapitres ; C : couloirs sur un axe
  de semaines avec la ligne « Aujourd'hui » et les échéances), C0 et C1 livrés repliés, dépendances fléchées.

### Différences clés

| | A · Tableau de bord | B · Éditorial | C · Chronologie |
|---|---|---|---|
| Navigation | barre latérale, arbre des projets | barre du haut, liens de pages | rail d'icônes, sélecteur de projet |
| Densité | forte (13 px, lignes de 40 px) | faible (titres 40–52 px, lignes de 64 px) | moyenne |
| Agent de projet | panneau fixe à droite, lot à cocher | chapeau rédigé en tête de page | entrée « Attend ta réponse » et fil |
| Ensembles | tableau `n/m` + barre | feuille de route, une case par sous-ticket | barres de période (Gantt) |
| Étape de livraison | 12 segments + libellé | « étape 9/11 · Review » + barre fine | stepper 0 → 11 |

## Données

Projet fictif Silo, location de box (`silo-labs/silo-location`, branche `dev`, jeu « Projet Silo » de `design/donnees-fictives.md`), vendredi 16 octobre (S42). Ensembles C0 Socle (12/12),
C1 Connexion (8/8), C2 Périmètre et affectations (4/6, échéance lun. 19 oct.), C3 Saisie des box et constats (9/14),
C4 Fichiers et photos (1/5), C5 Rapports de centre (0/6). Tickets SILO-21 à SILO-60, PR #18 à #23, questions Q14, Q16, Q17,
sessions T3 Code sur SILO-23 et SILO-33. Correction par rapport aux anciennes maquettes : C4 est un ensemble, sans agent ni
étape. Tout est dans `scripts/02-data.js`.

## Procédure

1. `docker info` : environ 8 Gio pour la VM Docker ; Penpot lancé (`docker compose -p kibo-penpot up -d` dans `design/penpot`).
2. `python3 design/redesign/scripts/receiver.py` (port 8787 : sert les scripts, reçoit les PNG dans `exports/`).
3. Chromium headless (Playwright, session Penpot enregistrée), workspace du fichier avec `&wasm=false`, bouton « MCP » de la
   barre pour connecter le plugin. Jamais le Chrome d'Adam.
4. Par le serveur MCP (`execute_code`), exécuter `scripts/00-charger.js` (recharge les helpers dans `storage` à chaque connexion),
   puis pour chaque écran et chaque mode :
   ```js
   await storage.page("A · Tableau de bord sobre"); storage.setMode("dark");   // ou "light"
   const f = await storage.draw["a-vue"](0, 0);                                 // x = 1540 en clair, y = rang × 1500
   await storage.wait(400); storage.replace();                                  // réapplique les positions hors flex
   ```
   Clés : `a-vue`, `a-tickets`, `a-graphe`, `b-vue`, `b-tickets`, `b-graphe`, `c-vue`, `c-tickets`, `c-graphe`.
   B3 : après les deux modes, `storage.setMode(m); storage.edgesB()` dans un second appel (flèches tracées sur la mise en page calculée).
5. `await storage.exportPiste("a")` (puis `b`, `c`) : PNG dans `exports/piste-<x>-<écran>-<dark|light>.png`.
6. Vérifier l'enregistrement côté serveur (`get-page`) avant de passer à la page suivante.

Scripts : `01-base` (palettes, primitives, icônes Lucide), `02-data` (données), `10-shell` (barres et navigation), `20-piste-a`,
`30-piste-b`, `40-piste-c`, `90-export` (pages, export). Pièges de `design/penpot/README.md` appliqués : `getShapeById` jamais
`findShapeById`, appels de moins de 120 s, noms de board sans `/`, page ouverte avant d'y dessiner (`storage.page` attend
le changement de page : sans cela, un écran atterrit sur la page précédente).

## Exports

`exports/piste-{a,b,c}-{vue-ensemble,tickets,graphe}-{dark,light}.png` (18 fichiers), copiés dans `screens/redesign/`.

## Proposition consolidée (2026-10-16)

### Décisions d'Adam
1. **Livrer par fonctionnalité, de A à Z.** Un ensemble n'est plus un sprint ni un domaine technique : c'est une
   **fonctionnalité** complète, démontrable une fois fermée. Ses **étapes sont libres** : ses sous-tickets dans l'ordre des
   dépendances (« Stockage des photos → Route d'envoi → Écran d'envoi hors ligne → Tests E2E → Démo client »). L'avancement
   se lit en fonctionnalités livrées (« 3 livrées sur 9 »), puis la prochaine à finir. Limite de **2 fonctionnalités ouvertes**
   en même temps : finir avant de commencer.
2. **Les sprints sont le plan de livraison.** On assigne une fonctionnalité à un sprint (nom et dates) ; un sprint montre ce
   qui est livré, en cours ou en retard. Une fonctionnalité sans sprint attend dans « À planifier ».
3. Kibo reste un outil de **suivi** : dev dans T3 Code via `full-delivery`, avancement remonté de git, des PR et de
   `kibo tickets step`, exécution des agents masquée.

### Écrans (page Penpot « Proposition », `scripts/50-proposition.js`)
Base : piste A (densité, barre latérale, panneau de l'agent de projet, colonne « Git et PR »), plus la bande des échéances
et « En ce moment » de la piste C, et « une case par étape » de la piste B. Entrée « Planning » ajoutée à la navigation du projet.

| Board | Contenu |
|---|---|
| P1 · Vue d'ensemble | fonctionnalités livrées 3/9 (une case par fonctionnalité), sprint en cours, ouvertes 2/2, PR en review, questions ; « En ce moment » (sessions T3 Code) ; échéances par sprint avec glissement de F5 ; carte du sprint S42 ; « Prochaine à finir » avec `/full-delivery SILO-45` ; activité ; agent de projet (lot n° 7 : reporter F5, planifier F9, relancer Q14) |
| P2 · Planning | sprints S41 à S44 en colonnes et réserve « À planifier » ; cartes de fonctionnalité avec leurs étapes en cases ; F5 en retard ; F9 glissée vers la zone de dépôt de S44 ; limite d'ouvertes dans l'en-tête |
| P3 · Fonctionnalité | F5 « Envoyer les photos d'un constat » : résultat attendu, parcours A→Z en frise verticale (ticket, état git et PR, étape full-delivery, session), « Livrer la prochaine étape » (`/full-delivery SILO-34`), sprint et proposition de report, dépendances, questions, activité |
| P4 · Tickets | retiré en phase 33 (composant `tickets` retiré) |
| P5 · Graphe | fonctionnalités en cadres placés dans la colonne de leur sprint, étapes listées, dépendances entre fonctionnalités, retard et blocage |

Données : 9 fonctionnalités F1 à F9 (SILO-1 à SILO-93), sprints S41 « Accès », S42 « Saisie hors ligne » (en cours, finit
le 16 oct.), S43 « Import et contrats », S44 « Rapports » ; F9 « Exporter le dossier client » à planifier.

Dessin : clés `p-vue`, `p-planning`, `p-fonctionnalite`, `p-tickets`, `p-graphe` sur la page « Proposition » (rangées de
1 300 px), puis `storage.edgesP()` par mode dans un second appel et `await storage.exportProposition()`
→ `exports/proposition-<écran>-<dark|light>.png`.

## Styles hors shadcn et vues d'ensemble (2026-10-16)

Retour d'Adam : la vue d'ensemble de la proposition est trop chargée. Elle doit répondre en 5 secondes à trois questions,
et à rien d'autre : **où en est-on** (fonctionnalités livrées sur le total, sprint en cours, tenue de la mise en production),
**qu'est-ce qui bloque** (questions bloquantes, retards, PR à relire), **quelle est la suite** (prochaine fonctionnalité à
finir, étape suivante). L'agent de projet reste discret : une phrase de synthèse et un lot à valider, sans panneau permanent.
shadcn n'est plus un cadre obligatoire : chaque direction a sa typographie, sa grille, ses couleurs et ses visualisations.

Données : plan fictif de Silo (location de box, `scripts/60-styles.js`, vocabulaire de `design/donnees-fictives.md`) : 22 fonctionnalités
F00 à F21 (F00 livrée), F01 et F02 ouvertes, sprints S1 (en cours, dernier jour, 11-15 janv. 2027) à S10, mise en production
le 19/03, pistes P1 recette du paiement (bloquée : contrat du prestataire de paiement) et P2 production, F16 à F21 à arbitrer après le 19/03.

Page Penpot « Styles » (`scripts/60-styles.js`, `scripts/70-vues.js`), sombre à x = 0 et clair à x = 1 540, rangées de 1 150 px.

| Board | Idée | Typographie et couleur |
|---|---|---|
| Style 1 · Vue d'ensemble et Planning | **Carnet de centre** : journal éditorial en trois rubriques numérotées, gros chiffre en sérif ; planning en registre (un sprint par ligne, trait double de la mise en production) | Newsreader et Geist, papier chaud en clair, encre et brique |
| Style 2 · Vue d'ensemble et Planning | **Instrument** : panneaux numérotés, jauge des 22 fonctionnalités coupée par le trait de la mise en production, règle des sprints ; planning en matrice avec histogramme des ouvertes | IBM Plex Sans et Mono, quasi monochrome, un vert signal et un rouge d'alerte |
| Style 3 · Vue d'ensemble et Planning | **Atelier** : trois grandes cartes douces, une couleur en aplat par fonctionnalité, étapes en pastilles ; planning en colonnes de sprint avec carte glissée | Bricolage Grotesque et DM Sans, crème en clair, orange pour l'action principale et l'agent |
| Vue 4 · Une phrase | une synthèse rédigée en grand, trois liens dessous | Newsreader |
| Vue 5 · Frise | toute la page est la frise jusqu'au 19/03 : deux voies (la limite de deux ouvertes), pistes, « aujourd'hui », blocages piqués | Space Grotesk et JetBrains Mono, bleu de plan |
| Vue 6 · Trois colonnes | trois colonnes égales, un seul chiffre fort par colonne (1/22, 3, 5) | Inter très gras, noir, rouge et bleu |
| Vue 7 · Tableau de bord minimal | quatre grands chiffres et une seule liste « À faire maintenant », ordonnée | Manrope et Geist, zinc et orange |

Rôle de l'orange : il n'est plus réservé aux agents. Dans Atelier et dans la vue 7, il porte l'action principale (et la
marque) ; dans Carnet, une brique sert d'accent éditorial et d'alerte ; Instrument et Frise ne l'utilisent pas.

Exports : `exports/style-<1|2|3>-<vue-ensemble|planning>-{dark,light}.png` et
`exports/vue-ensemble-<4..7>-<nom>-{dark,light}.png`, copiés dans `screens/redesign/`.
Dessin : clés `s1-vue` … `s3-planning`, `v4` … `v7` (`storage.useStyle(n, mode)` avant le dessin), puis
`await storage.exportStyles()`.

## P1 bis · Vue d'ensemble retravaillée (2026-10-16)

Retour d'Adam : la vue d'ensemble de la proposition est la bonne, seul l'affichage est à optimiser. Les styles hors shadcn
sont écartés. P1 bis (`scripts/55-proposition-v2.js`, clé `p-vue2`, rang 5 de la page « Proposition ») garde tout le
contenu de P1 et ne change que la hiérarchie, l'espacement et la lisibilité :

- indicateurs en cinq cellules égales : libellé, chiffre dominant, sous-ligne de hauteur fixe ;
- « En ce moment » : une seule étiquette pour les deux sessions, étapes et durées en colonnes alignées ;
- échéances : grille stricte, colonne S42 teintée, « aujourd'hui » étiqueté, étapes restantes de F5 tracées en S43,
  blocage « bloquée · Q14 », légende en pied ;
- titres de carte homogènes (14 px, compteur en pastille), espacement régulier de 14 px ;
- Sprint S42 : statut, cases et x/5 en colonnes ; note de limite en pied ;
- Activité sous « Prochaine à finir », une ligne par événement ; En review sur trois lignes (titre, ticket, CI) ;
- texte secondaire en `mfg`, aucune taille sous 12 px ;
- panneau de l'agent : résumé, lot et champ de saisie séparés par des filets.

Exports : `exports/proposition-vue-ensemble-v2-{dark,light}.png` (`await storage.exportP1bis()`).

## Choix illustrés (2026-10-16)

Page Penpot « Choix » (`scripts/80-choix.js`) : un tableau par choix ouvert, sombre à x = 0 et clair à x = 1 300,
rangées de 640 px. Chaque tableau pose la question, puis montre « Recommandé » et « Autre option » côte à côte avec les
données Silo et une légende d'une ligne.

| n° | Question | Recommandé | Autre option |
|---|---|---|---|
| 1 | Planning | sprints en colonnes | bandes type Gantt |
| 2 | Retard | F5 en retard quand S42 finit avec des étapes restantes | une date d'échéance par fonctionnalité |
| 3 | Report | l'agent propose « Reporter F5 en S43 ? » | report automatique |
| 4 | Limite d'ouvertes | avertissement « 3/2 ouvertes », action possible | bouton bloqué |
| 5 | Démo client | facultative | obligatoire avant « livrée » |
| 6 | Nom dans les listes | une ligne et infobulle | nom complet sur deux lignes |
| 7 | Sprint | fiche avec nom, dates et report en fin | simple étiquette |
| 8 | Graphe | une colonne par sprint | une couleur par sprint |
| 9 | Vue d'ensemble | sprint en cours et suivant | toutes les échéances et Planning tous projets |

Exports : `exports/choix-<n>-<slug>-{dark,light}.png` (`await storage.exportChoix()`), copiés dans `screens/redesign/`.

## Références au pixel près (2026-10-16)

Écrans validés, exportés à l'échelle 1 (1 px Penpot = 1 px), sombre et clair :

| Écran | Fichiers | Dimensions |
|---|---|---|
| P1 bis · Vue d'ensemble | `exports/proposition-vue-ensemble-v2-{dark,light}.png` | 1 440 × 1 260 px |
| P2 · Planning | `exports/proposition-planning-{dark,light}.png` | 1 440 × 1 000 px |
| P3 · Fonctionnalité | `exports/proposition-fonctionnalite-{dark,light}.png` | 1 440 × 1 000 px |
| P5b · Graphe, Fonctionnalités | `exports/proposition-graphe-fonctionnalites-{dark,light}.png` (référence pixel de « graphe » ; exports P5 retirés en phase 30, P5 reste page 35 du fichier « Kibo ») | 1 440 × 1 000 px |

P1 (`proposition-vue-ensemble-*`, 1 440 × 1 100 px) est remplacé par P1 bis. Les tableaux de choix font 1 200 × 560 px.

`cotes.md` donne, pour chaque écran et chaque bloc, la position, la taille, le flex (direction, espacement, marges internes), les polices,
les couleurs en tokens (sombre et clair), les rayons et bordures, ainsi que la liste exacte des textes affichés. Il est relevé depuis Penpot
par `scripts/95-cotes.js`, puis mis en forme par `scripts/cotes.py`. Les écrans sont aussi dans le fichier Penpot « Kibo », page
« 35 · Redesign Silo » (210 à 218).

## Phase 27 (2026-10-18)

Spec §39 : Kibo ne fait que du suivi, création de projet minimale, constats des critiques retenus (§39.6). Couleurs et vocabulaire
des écrans validés inchangés (les couleurs sémantiques, le glossaire et la liste Questions compacte sont seulement proposés à Adam).
Page « Proposition », `scripts/55-phase-27.js` (après `55-proposition-v2`), rangées à partir de y = 8 000, pas de 1 500 px, sombre à
x = 0 et clair à x = 1 540. Données `silo-maquettes` au vendredi 16 octobre (S42).

| Board | Contenu | Export | Taille |
|---|---|---|---|
| P1 bis v3 · Vue d'ensemble | P1 bis au vendredi 16 oct. (S42 en cours, donc aucune carte « En retard ») ; sous « Ouvertes », « limite · 1 bloquée » (point rouge : F6, bloquée par Q14). Référence pixel | `proposition-vue-ensemble-v3` | 1 440 × 1 260 |
| P1 bis v3 · En retard au 18 oct. | variante au dimanche 18 oct., entre deux sprints : S42 reste courant (« terminé le 16 oct. »), « 1 en retard » sous Fonctionnalités, carte « En retard » sous Échéances (F5, S42 · terminé le 16 oct., reste 4 étapes) | `proposition-vue-ensemble-v3-retard` | 1 440 × 1 360 |
| P1 bis v3 · Pour commencer | projet neuf (cinq pages, S1 à S6) : « Relier le dépôt », « Créer une fonctionnalité », « Copier /full-delivery SILO-1 » expliqués par des textes d'aide, un seul bouton « Ouvrir le Planning » ; liste des sprints | `proposition-vue-ensemble-v3-pour-commencer` | 1 440 × 1 000 |
| P6 · Nouveau projet | dialogue de 520 px sur la Vue d'ensemble sous voile `bg` 60 % : Nom, Clé, Client, Début, Nombre de sprints, Durée, aperçu des six sprints, Dossier, « Annuler » et « Créer » | `proposition-nouveau-projet` | 1 440 × 1 000 |
| P7 · Kanban | « Tous » par défaut, « Sprint courant · S42 », « À reprendre », étiquettes ; cartes « SILO-45 · F4 », pastilles PR, review et CI, « bloqué · Q14 », « Démo · F6 », point de session, ombre de défilement | `proposition-kanban` | 1 440 × 1 000 |
| P8 · Fiche ticket | Sheet de 560 px sur le Kanban : « F4 · S42 · PR #20 », « Adam (moi) », « Requise pour livrer », « Ajouter une étiquette », bandeau « PR #20 · changements demandés · CI cassée », Suivi (branche « déclarée », « Livraison : Phase 9/12 · Review »), Description et « Modifier », Dépendances « Aucune » et « Ajouter une dépendance », Questions, Domaine et Maquettes repliés, « Fermer » | `proposition-fiche-ticket` | 1 440 × 1 000 |
| P8b · Fiche ticket, Activité | même fiche, onglet Activité : chronologie du journal (session, review, CI, étape, PR, branche) puis « Anciens runs » replié | `proposition-fiche-ticket-activite` | 1 440 × 1 000 |
| P9 · Questions | `Qn`, badge « bloquante », bloquantes en tête, groupes sans vide, texte exporté (« bloque F6, prévue en S43 »), toast « 2 questions marquées envoyées · Annuler » | `proposition-questions` | 1 440 × 1 000 |
| Barre repliée · Kanban à 1 180 px | rail de 48 px (bascule, recherche, Accueil, Mes tickets, Boîte de réception, pastille d'initiales par projet), menu des pages de Silo au survol, clés entières, ombres de défilement en bas et à droite | `proposition-barre-repliee` | 1 180 × 1 000 |
| Agent · question (retiré en phase 31) | panneau de 340 px : résumé du jour épinglé et daté (14:40), question d'Adam, réponse, lot n° 7, « Afficher les lots remplacés » | `proposition-agent-question` | 340 × 1 000 |
| Agent · récapitulatif (retiré en phase 31) | après « Valider » : 3 appliquées, 0 échouée, 0 ignorée, « F5 glissée de S42 », « Copier la relance » sur la relance de Q14 | `proposition-agent-recap` | 340 × 1 000 |

Dessin : `await storage.draw27("p-vue3", "dark")` (clés `p-vue3`, `p-vue3-retard`, `p-commencer`, `p-nouveau`, `p-kanban`, `p-fiche`, `p-fiche-act`,
`p-questions`, `p-barre`, `p-agent-q` et `p-agent-recap` retirés en phase 31), un écran et un mode par appel. `p-nouveau` clone `p-vue3` et `p-fiche` clone
`p-kanban` du même mode : les dessiner après. Avant de recharger l'onglet, attendre que le nombre de formes côté serveur (`get-page`)
égale le nombre local, sinon les derniers écrans sont perdus. Export : `await storage.export27()` (`90-export.js`) ⇒
`exports/proposition-<écran>-<dark|light>.png`. Cotes : `95-cotes.js` par board, puis `python3 scripts/cotes.py <JSON> --phase27`, qui
réécrit seulement la partie « Phase 27 » de `cotes.md` (P1 bis v3, sa variante du 18 oct., Pour commencer, P6 à P9, P8b) ; `--sections 2,3,9`
(numéros des JSON `_dump-<n>-<mode>.json`) ne remplace que les sections de ces boards, sans recalculer les tableaux de tête.

Jalon de la phase 27 (T26) : P2 (« En cours : 2 / 2 », « à risque », ligne de charge « n étapes prévues · capacité 5 », crayon du sprint), P3
(« Prochaine étape SILO-34 : attend SILO-33. », Activité en « Phase n/12 »), P1 bis v3 et ses variantes (client, sans « 2/2 en cours »,
« Phase 7/12 », résumé daté, lots remplacés masqués, « + Nouvelle fonctionnalité », « Dernier sprint · S42 terminé » au 18 oct.), P6 (fond
redessiné), P7 (puces « Phase n/12 · … »), P8 et P8b, la barre repliée et le panneau de l'agent suivent l'application ; copiés dans la page
« 36 · Suivi seul » du fichier « Kibo » (voir `design/penpot/README.md`).

## Phase 28 (2026-10-18)

Données neutralisées : projet fictif Silo (location de box, section « Projet Silo » de `design/donnees-fictives.md`), dans les scripts
et dans les boards des pages « Proposition » et « Choix ». Les boards existants ont gardé leurs tailles, positions et retouches : seuls
leurs textes et noms de calques ont changé (dictionnaire appliqué par le plugin, puis initiales des projets de la barre repliée). Exports,
puis cotes régénérées par `cotes.py <JSON> --sections 1,…,13` sur l'ancien `cotes.md` passé au dictionnaire (en-tête et notes de masques gardés).
Piège : `board.export()` peut renvoyer l'image d'avant une modification de texte (vu sur P5 sombre) ; exporter alors un clone du board
(`b.clone()`, export, `remove()`), puis vérifier chaque PNG à l'œil.

## Phase 29 (2026-10-19)

Spec §41 : une étape mise en attente. Données `silo-attente` (section « Phase 29 · étapes en attente » de
`design/donnees-fictives.md`) : SILO-45 « Règle de fusion à valider par le client », SILO-33 et SILO-82 « Serveur MinIO de recette
indisponible », SILO-34 et SILO-35 en attente de SILO-33. Page « Proposition », `scripts/56-phase-29.js` (après `55-phase-27`), rangées
à partir de `S.Y29` = 24 500 (pas de 1 500 px), sombre à x = 0 et clair à x = 1 540.

Chaque board **clone la référence pixel** de son écran (retouches du jalon 27 et textes de la phase 28 compris, qu'un redessin par les
scripts perdrait), puis y pose l'attente et ses conséquences : un écran sans attente reste identique à sa référence.

| Board | Source clonée | Contenu | Export | Taille |
|---|---|---|---|---|
| P1 bis · Vue d'ensemble · en attente | P1 bis v3 · Vue d'ensemble | « 4 livrées sur 9 » et sous-ligne « 3 en attente », « En cours 1 / 2 », carte « En attente » 3 sous Échéances (une ligne par raison, clés, « 2 en dépendent »), F4 livrée et retirée des Échéances, F5 « en cours » en deux cases, prochaine à finir sans « Étape suivante », Activité de quatre lignes (trois « Mise en attente · … », « PR #22 ouverte ») | `proposition-attente-vue-ensemble` | 1 440 × 1 260 |
| P2 · Planning · en attente | P2 · Planning | « En attente (3) » en pied de « À planifier », un groupe par raison, une carte par étape (clé, fonctionnalité, « ⋯ », titre) ; F4 « livrée · 1 en attente », F5 « en cours » sans « F5 ne tiendra pas », cases et charges sans les étapes en attente | `proposition-attente-planning` | 1 440 × 1 000 |
| P3 · Fonctionnalité · en attente | P3 · Fonctionnalité | frise 31, 32 puis « En attente · 3 » (pause à la place du numéro, raison et « Reprendre » sur SILO-33, « attend SILO-33 » sur 34 et 35), « 1 étape livrée sur 2 · 3 en attente », carte Sprint sans « ne tiendra pas dans S42 » | `proposition-attente-fonctionnalite` | 1 440 × 1 000 |
| P7 · Kanban · en attente | P7 · Kanban | puce pointillée pause + raison courte (24 caractères) en tête des puces, « attend SILO-33 », filtre « En attente » 5 après « À reprendre », « Démarrable 2 », puces « Adam » et « 1 question », colonnes *À faire* et *Terminé* du semis `silo-attente` ; cartes, en-têtes de colonne et barre d'outils au gabarit du rendu (`S.kanbanGabarit29`, P7 garde le sien) | `proposition-attente-kanban` | 1 440 × 1 000 |
| P8 · Fiche ticket · en attente | P8 · Fiche ticket | bandeau neutre « En attente · Règle de fusion à valider par le client · depuis le 16 oct. » et « Reprendre » au-dessus du bandeau PR | `proposition-attente-fiche-ticket` | 1 440 × 1 000 |
| P8c · Mettre en attente | P7 · Kanban · en attente | dialogue de 480 px « Mettre SILO-82 en attente » : raison saisie, « 37/80 », « Raisons déjà employées », « Annuler » et « Mettre en attente » | `proposition-attente-dialogue` | 1 440 × 1 000 |
| P8d · Fiche ticket, menu | P8 · Fiche ticket | menu « ⋯ » ouvert : « Ouvrir dans un onglet », « Copier la clé », « Mettre en attente… » (survolé), « Supprimer… » | `proposition-attente-fiche-menu` | 1 440 × 1 000 |
| P8e · Fiche ticket en attente, menu | P8 · Fiche ticket · en attente | même menu sur l'étape en attente : « Reprendre » à la place de « Mettre en attente… » | `proposition-attente-fiche-menu-reprendre` | 1 440 × 1 000 |
| P2b · Planning, Reprendre dans | P2 · Planning · en attente | menu de la carte SILO-45 : « Reprendre », « Reprendre dans ▸ » ouvert sur « S43 · Import et contrats » et « S44 · Rapports » (offert quand le sprint de la fonctionnalité est terminé ou absent) | `proposition-attente-planning-menu` | 1 440 × 1 000 |

Dessin : `await storage.draw29("a-vue", "dark")` (clés `a-vue`, `a-planning`, `a-fonctionnalite`, `a-kanban`, `a-fiche`, `a-dialogue`, `a-fiche-menu`,
`a-fiche-menu-reprendre`, `a-planning-menu`), un écran et un mode par appel ; `a-dialogue`, `a-fiche-menu-reprendre` et `a-planning-menu` clonent
`a-kanban`, `a-fiche` et `a-planning` du même mode : les dessiner après. Un texte changé par `S.setText` reçoit de nouveau sa police
(`S.refont`) : sans cela, le canevas et l'export gardent l'ancien texte. Avant d'exporter, attendre que le nombre de formes
côté serveur (`get-page`) égale le nombre local. Export : `await storage.export29()` (`90-export.js`, depuis un clone de chaque board) ⇒
`exports/proposition-attente-<écran>-<dark|light>.png`. Cotes : `95-cotes.js` par board (`_dump-14` à `_dump-22`), puis
`python3 scripts/cotes.py <JSON> --phase29`, qui remplace seulement la partie « Phase 29 » de `cotes.md` (`--phase27` la garde).

Pièges vus : dans le runtime de plugins de Penpot 2.18, `insertChild(i)` compte dans l'ordre affiché (0 = premier élément du flex) alors
que `children` est rendu dans l'ordre inverse ; un enfant ajouté par `appendChild` à un board passe sous les autres (voile et dialogue :
`bringToFront()`). `Date.now()` lève une erreur en mode sécurisé : le chargement des scripts n'en dépend pas (`00-charger.js` l'emploie
seulement pour contourner le cache).

## 0.29.0-alpha.2 (2026-10-19)

Spec §42 : une réponse est disponible pour l'agent de projet dès qu'elle est enregistrée (plus de « à transmettre » ni de
« Transmettre à l'agent ») et une question se supprime depuis le menu « ⋯ » de sa carte. Données : sous-section « 0.29.0-alpha.2 »
du projet Silo (`design/donnees-fictives.md`). Page « Proposition », `scripts/57-alpha2-questions.js` (après `56-phase-29`), rangées à
partir de `S.Y_A2` = 38 000 (après les rangées de la phase 29, pas de 1 500 px), sombre à x = 0 et clair à x = 1 540.

Chaque board **clone « P9 · Questions »** sans l'aperçu d'export ni le toast ; P9 et sa référence pixel (`proposition-questions-*`)
ne changent pas.

| Board | Contenu | Export | Taille |
|---|---|---|---|
| P9b · Questions, menu | « ⋯ » de Q16 enfoncé, menu ouvert : « Archiver », séparateur, « Supprimer » en rouge | `proposition-questions-menu` | 1 440 × 1 000 |
| P9c · Supprimer la question | fond assombri, dialogue de 512 px centré « Supprimer « Quota par client : 2 Go ou 5 Go ? » ? », aide, « Annuler » et « Supprimer » (destructif) | `proposition-questions-supprimer` | 1 440 × 1 000 |
| P9d · Questions, répondues | segment « Répondues » actif, groupe SILO-34 seul, Q16 avec « Modifier la réponse », « Retirer la réponse », « ⋯ » et le bloc « Réponse : 5 Go » / « Répondu par Adam · il y a 2 h », sans marque de transmission ; filtres « Tous 2 », « Silo SA 2 » (comptes des ouvertes), Questions 2 dans la barre | `proposition-questions-repondues` | 1 440 × 1 000 |

Dessin : `await storage.drawA2("q-menu", "dark")` (clés `q-menu`, `q-supprimer`, `q-repondues`), un écran et un mode par appel. Avant
d'exporter, attendre que le nombre de formes côté serveur (`get-page`) égale le nombre local. Export : `await storage.exportA2()`
(`90-export.js`, depuis un clone de chaque board) ⇒ `exports/proposition-questions-<menu|supprimer|repondues>-<dark|light>.png`. Cotes :
`95-cotes.js` par board (`_dump-23` à `_dump-25`), puis `python3 scripts/cotes.py <JSON> --alpha2`, qui remplace seulement la partie
« 0.29.0-alpha.2 » de `cotes.md` (`--phase29` la garde). Aucun spec pixel nouveau : menu et dialogue sont des états modaux, capturés en E2E.
Copiés en page « 36 · Suivi seul » du fichier « Kibo » (232 à 234, voir `design/penpot/README.md`).

Piège vu : le fond d'un bouton enfoncé posé en absolu dans un flex passe au-dessus de l'icône quel que soit son rang ; le fond porte
donc lui-même l'icône, et un emplacement vide de même taille garde la mise en page de la ligne.

## 0.29.0-alpha.3 (2026-10-19)

Spec §43 : une réponse enregistrée réveille l'agent de projet, qui la lit et propose un lot si besoin. Dans le panneau Suivi, la ligne de
réveil « Q16 répondue : « 5 Go » » ouvre le dernier échange comme une question d'Adam. Données : sous-section « 0.29.0-alpha.3 » du projet
Silo (`design/donnees-fictives.md`). Page « Proposition », `scripts/58-alpha3-reveil.js` (après `57-alpha2-questions`), rangée `S.Y_A3`
= 42 500 (après les rangées de l'alpha 2), sombre à x = 0 et clair à x = 1 540.

**Retiré en phase 31** (agent de projet en conversation, §46) : le board, ses exports `proposition-agent-reveil-*` et ceux d'« Agent · question » sont supprimés ; la section ne sert plus que d'historique.

| Board | Contenu | Export | Taille |
|---|---|---|---|
| Agent · réveil sur réponse | résumé du jour épinglé (14:40), ligne de réveil à la place de la bulle d'Adam (icône `alarm-clock` 13 px, « Q16 répondue : « 5 Go » », « 14:52 » à droite, texte secondaire 12 px), texte de l'agent « Q16 répondue : le quota est de 5 Go par client. Je propose : », « Lu : Q16, SILO-34 », lot n° 8 « 1 action · après réveil » (« Modifier SILO-34 », « Quota de 5 Go par client à inscrire dans l'étape. »), « Valider (1) » et « Refuser » | `proposition-agent-reveil` | 340 × 1 000 |

Dessin : `await storage.drawA3("p-agent-reveil", "dark")` puis `"light"`. Avant d'exporter, attendre que le nombre de formes côté serveur
(`get-page`) égale le nombre local. Export : `await storage.exportA3()` (`90-export.js`, depuis un clone, après 10 s d'attente : un clone
pas encore enregistré côté serveur fait échouer l'exporteur, « http error ») ⇒ `exports/proposition-agent-reveil-<dark|light>.png`. Cotes :
`95-cotes.js` (`_dump-26`), puis `python3 scripts/cotes.py <JSON> --alpha3`, qui remplace seulement la partie « 0.29.0-alpha.3 » de
`cotes.md` (`--alpha2` la garde). Pas de spec pixel (panneau, capturé en E2E). Copié en page « 36 · Suivi seul » du fichier « Kibo »
(235, voir `design/penpot/README.md`). **Retiré en phase 31** (spec §46.3) avec « Agent · question » et « Agent · récapitulatif » : boards et exports
supprimés, voir « Agent de projet en conversation ».

## Phase 30 (2026-10-20)

Spec §44 : la page Graphe n'a plus qu'un sélecteur « Fonctionnalités | PRs » et un compteur ; « Regrouper », « Colonnes », « Livrées
repliées » et « Options » disparaissent. La vue PRs dessine chaque PR vivante en carte, empilée de bas en haut sur la PR dont elle part,
une colonne par pile, au-dessus du rail « dev · branche de base ». Données : sous-section « Phase 30 · PR empilées » du projet Silo
(`design/donnees-fictives.md`, scénario `silo-prs`). Page « Proposition », `scripts/59-graphe-prs.js` (après `58-alpha3-reveil`), rangées à
partir de `S.Y_GR` = 44 000 (après la rangée de l'alpha 3, pas de 1 500 px), sombre à x = 0 et clair à x = 1 540.

Chaque board **clone « P5 · Graphe »** puis remplace la barre (`S.toolbarGR`) ; P5 reste au fichier, sa référence `proposition-graphe-*`
est retirée des exports avec le changement de référence pixel.

| Board | Contenu | Export | Taille |
|---|---|---|---|
| P5b · Graphe, Fonctionnalités | colonnes par sprint de P5, barre réduite au sélecteur (« Fonctionnalités » actif) et au compteur « 9 fonctionnalités · 13 dépendances entre étapes, 7 entre fonctionnalités » | `proposition-graphe-fonctionnalites` | 1 440 × 1 000 |
| P5c · Graphe, PRs | « PRs » actif, compteur « 5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger », trois colonnes (#22 → #24 → #25 F5, #20 F4, #23 hors fonctionnalité) avec leur en-tête, cartes 364 × 92 (icône, numéro, titre du ticket, « session » sur #24 et #20, clé et fonctionnalité, puces de review et de CI, branche `head`), traits « sur feat/… », rail « dev · branche de base », légende (dont « Approuvée ») | `proposition-graphe-prs` | 1 440 × 1 000 |
| P5e · Graphe, aucune PR | « PRs » actif, compteur « 0 PR ouverte · 0 pile », canevas vide : « Aucune PR ouverte » (14 px, 500, `mfg`) et « Les PR ouvertes des étapes apparaissent ici, empilées sur leur branche de base. » (13 px, `dim`) centrés, ni rail ni légende | `proposition-graphe-prs-vide` | 1 440 × 1 000 |

Correction de P5c (2026-10-20) : #20 porte « session » (session T3 Code de SILO-45) et non « en retard » (« en retard » ne vient que d'une
fonctionnalité en retard, et aucune ne l'est au 16 oct.) ; la légende gagne « Approuvée » (point vert) après « Changements demandés ».
La variante **P5d « PRs par fonctionnalité »** (un cadre par fonctionnalité, la pile dedans) est **écartée** : boards supprimés du fichier,
dessin (`miniGR`, `stemGR`, `frameGR`, `alignFramesGR`) et exports `proposition-graphe-prs-variante-*` retirés ; P5e occupe sa rangée (y = 47 000).

Dessin : `await storage.drawGR("g-prs", "dark")` (clés `g-fonctionnalites`, `g-prs`, `g-prs-vide`), un écran et un mode par appel. Avant
d'exporter, attendre que le nombre de formes côté serveur (`get-page`) égale le nombre local. Export : `await storage.exportGR(["graphe-prs",
"graphe-prs-vide"])` (depuis un clone, après 10 s d'attente) ⇒ `exports/proposition-graphe-<fonctionnalites|prs|prs-vide>-<dark|light>.png`.
Cotes : `95-cotes.js` par board (`_dump-27` à `_dump-29`), puis `python3 scripts/cotes.py <JSON> --phase30`, qui remplace seulement la
partie « Phase 30 » de `cotes.md` (`--alpha3` la garde). Comparaison au pixel : « graphe » sur P5b (`silo-maquettes`) et « graphe-prs » sur
P5c (`silo-prs`) ; P5e a une capture seulement. À copier en page « 36 · Suivi seul » du fichier « Kibo » (236, 237, 237b, voir
`design/penpot/README.md`).

Piège vu : `Date.now()` lève une erreur dans le compartiment du plugin piloté depuis Chromium headless ; `00-charger.js` s'en sert pour
contourner le cache, il faut alors un compteur à la place pour charger les scripts.

### Aperçu de maquette

Spec §44.8 : les maquettes de la fiche ticket s'ouvrent en plein écran de Kibo (vue qui couvre la fenêtre, jamais l'API Fullscreen du
navigateur). Données : sous-section « Phase 30 · Aperçu de maquette » du projet Silo (`design/donnees-fictives.md`, scénario
`silo-apercu`) : SILO-45 lié au cadre Figma « Conflit de saisie » (444 × 960, écran mobile de l'app Silo). Page « Proposition »,
`scripts/59b-apercu-maquette.js` (après `59-graphe-prs`), rangées à partir de `S.Y_AP` = 48 500 (après P5e, pas de 1 500 px), sombre à
x = 0 et clair à x = 1 540.

| Board | Contenu | Export | Taille |
|---|---|---|---|
| P8f · Fiche ticket, Maquettes | clone de « P8 · Fiche ticket » ; section « Maquettes » ouverte (« 1 ») : propriété « Maquette · Conflit de saisie » (icône `frame`), vignette 512 × 288 (`muted`, bord, rayon 6) avec le cadre réduit (`S.frameAP(p, 133.2, 288)`, échelle 0,3, centré), ligne d'actions « Plein écran » (`maximize-2`, 28 × 28, en tête) · « Conflit de saisie » · « Actualiser » · « Ouvrir dans Figma » · « Retirer », champ « Colle l'URL d'un cadre Figma ou d'un board Penpot » et « Lier un cadre » (désactivé) ; corps de la feuille sorti du flux et remonté jusqu'à ce que la section touche le bas (386 px en sombre, 383 en clair), en-tête de la feuille au-dessus | `proposition-fiche-ticket-maquettes` | 1 440 × 1 000 |
| P8g · Maquette en plein écran | fond `card` ; barre de 40 px (bord bas `border`) : puce « SILO-45 » (mono 11), « Conflit de saisie » (13, 500), badge « Figma », puis « Actualiser » et « Ouvrir dans Figma » (icônes 14 dans 24 × 24) et « Quitter le plein écran (Échap) » (`x`, 12,5, 500) ; visualiseur `muted` 1 440 × 960 ; **cadre** (forme « cadre », 444 × 960, échelle 1) en (498, 40) sur une ombre `shadow-sm` portée par une forme à part (« cadre-ombre ») ; barre de zoom en bas à droite (8 px des bords) : « − », « 100 % » (mono 11), « + », « Ajuster » (grisé) | `proposition-apercu-maquette` | 1 440 × 1 000 |

Le cadre « Conflit de saisie » (`S.frameAP(p, w, h)`, dessiné à l'échelle `w / 444`) a les couleurs de l'app Silo, identiques en sombre et
en clair : barre d'état « 14:02 », titre, « Deux saisies du constat du box B-114 », cartes « Version hors ligne · 14:02 » (bord bleu
`#2563EB`, « Occupé », 3 photos, « Cadenas changé ») et « Version du serveur · 13:47 » (« Libre », 2 photos, note vide), boutons
« Garder la plus récente » (plein) et « Comparer » (contour).

Dessin : `await storage.drawAP("ap-fiche", "dark")` (clés `ap-fiche`, `ap-plein-ecran`), un écran et un mode par appel ; attendre que
les formes côté serveur (`get-page`) égalent les formes locales. Export : `await storage.exportAP(["fiche-ticket-maquettes",
"apercu-maquette"])` (depuis un clone, après 10 s) ⇒ `exports/proposition-<fiche-ticket-maquettes|apercu-maquette>-<dark|light>.png`.
Export du cadre seul : `await storage.exportFrameAP()` ⇒ `exports/proposition-apercu-maquette-cadre.png` (444 × 960, forme « cadre »
du board sombre, échelle 1), l'image que le faux Figma sert pour le nœud `45:1` ; ses pixels égalent la zone (498, 40, 444 × 960) de
`proposition-apercu-maquette-dark.png` à l'anticrénelage près (34 pixels, écart ≤ 7 / 255). Cotes : `_dump-30` et `_dump-31`, dans la
partie « Phase 30 » de `cotes.md` (`--phase30`). Comparaison au pixel : « apercu-maquette » sur P8g (`silo-apercu`, aucun masque) ; P8f a une
capture seulement. À copier en page « 36 · Suivi seul » du fichier « Kibo » (238, 238b, voir `design/penpot/README.md`).

Pièges vus : dans un board sans flex, une forme ajoutée par `appendChild` passe sous les précédentes ; `S.stackAP` les remet dans l'ordre
du dessin (`bringToFront`). Un enfant absolu d'un flex reste au-dessus des autres : l'en-tête de la feuille reçoit `layoutChild.zIndex = 2`.
Les formes du plugin se comparent par `id`, jamais par `===`.

## Phase 31 (2026-10-21)

Spec §45 : un cadre du Graphe ne déborde plus (titre sur trois lignes au plus, hauteur qui suit) et les étapes en attente (§41) ne
sont plus cachées : elles restent à leur place, en cyan, partout où une fonctionnalité affiche ses étapes. Données : sous-section
« Phase 31 · Graphe en attente et couleur de l'attente » du projet Silo (`design/donnees-fictives.md`, scénario `silo-graphe` =
`silo-attente` puis F1 renommée « Connexion, environnements et hébergement »).

Jeton de l'attente (`scripts/01-base.js`, `S.PAL`) : `hold` `#22D3EE` en sombre et `#0E7490` en clair (texte AA sur le fond et les
cartes), fond `holdSoft` `#082F35` / `#ECFEFF` ; icône `pause`. Côté code : `--tracking-hold` et `--tracking-hold-soft`.

| Board | Script | Changement | Export | Taille |
|---|---|---|---|---|
| P5b · Graphe, Fonctionnalités | `59-graphe-prs.js` (`S.legendHoldGR`) | légende : « En attente » (point `hold`) après « Bloqué » | `proposition-graphe-fonctionnalites` | 1 440 × 1 000 |
| P5b · Graphe · en attente (nouveau) | `59c-graphe-attente.js` | clone de P5b : F1 sur trois lignes (cadre de 96 px, F2 descendue de 15) ; F4 livrée ne garde que SILO-45 (point et ⏸ `hold`, cadre de 212 × 96, « 3/4 ⏸ 1 ✓ », segments ■■■◆□) ; F5 « 1/2 ⏸ 3 », lignes 33 à 35 en `hold` (33 garde sa bordure et son point de session), sans pied « en retard », remontée sous F4 ; F7 « 0/4 ⏸ 1 », ligne 82 en `hold` ; flèches recalculées | `proposition-attente-graphe` | 1 440 × 1 000 |
| P1 bis · Vue d'ensemble · en attente | `56-phase-29.js` | « ⏸ 3 en attente » en `hold` ; carte Sprint : F4 ■■■◆□ « ⏸ 1 », F5 ■■◆◆◆ « ⏸ 3 » ; Prochaine à finir F5 ■■◆◆◆ ; ⏸ `hold` sur les lignes de la carte « En attente » ; Échéances et Activité inchangées | `proposition-attente-vue-ensemble` | 1 440 × 1 260 |
| P2 · Planning · en attente | `56-phase-29.js` | cases F4 ■■■◆□, F5 ■■◆◆◆, F7 □◆□□□ (toutes les étapes, dans leur ordre) ; ⏸ `hold` du titre « En attente (3) » | `proposition-attente-planning` | 1 440 × 1 000 |
| P3 · Fonctionnalité · en attente | `56-phase-29.js` | barre de cinq segments (2 à 4 en `hold`), texte inchangé ; ⏸ `hold` du titre, pastilles `holdSoft` sans bordure avec ⏸ `hold`, ⏸ `hold` devant la raison de SILO-33 (le lien de « attend SILO-33 » reste gris) | `proposition-attente-fonctionnalite` | 1 440 × 1 000 |
| P7 · Kanban · en attente | `56-phase-29.js` (`S.holdBadge`) | puces pleines `holdSoft`, sans bordure, ⏸ et texte `hold` ; ⏸ `hold` du filtre « En attente » | `proposition-attente-kanban` | 1 440 × 1 000 |

Restent gris (spec §45.3) : le bandeau de la fiche SILO-45 (P8 · Fiche ticket · en attente), l'Activité, les menus et le dialogue
(P8c à P8e, P2b) ; ces boards ne sont pas redessinés.

Dessin, un écran et un mode par appel : `await storage.drawGR("g-fonctionnalites", mode)`, `await storage.drawGA("g-attente", mode)` puis,
dans un second appel, `await storage.edgesDrawGA("g-attente", mode)` (flèches sur la mise en page calculée), et
`await storage.draw29(clé, mode)` pour `a-vue`, `a-planning`, `a-fonctionnalite`, `a-kanban`. Rangée du nouveau board : `S.Y_GA` = 51 500
(après P8g), sombre à x = 0, clair à x = 1 540. Export : `await storage.exportGR(["graphe-fonctionnalites"])`, `await storage.exportGA()`
(depuis un clone, après 10 s) et `await storage.export29([fichier])` par board. Cotes : `95-cotes.js` (`_dump-14` à `_dump-17`, `_dump-27`,
`_dump-32`), puis `python3 scripts/cotes.py <JSON> --sections 14,15,16,17,27` et `--phase31`. Comparaison au pixel : « graphe » (P5b),
« attente-graphe » (nouveau board, `silo-graphe`), « attente-vue-ensemble », « attente-planning », « attente-fonctionnalite »,
« attente-kanban ».

Piège vu : l'onglet headless finit par planter (« Target crashed ») après plusieurs redessins d'une page chargée, et les boards dessinés
juste avant sont perdus. Garder la vue hors des boards (`penpot.viewport.center` loin à gauche, zoom 0,25), lancer Chromium avec
`--js-flags=--max-old-space-size=6144`, et vérifier l'enregistrement après chaque board en lisant `get-page` hors de l'onglet (requête du
contexte Playwright) : le `get-page` lancé depuis l'onglet charge des dizaines de Mo dans le tas et précipite le plantage.


### Agent de projet en conversation

Spec §46 : le volet de l'agent de projet ne montre plus que la conversation de l'agent choisi (plus de Suivi, de « Résumé du jour »
épinglé, de lots remplacés, de menu « ⋯ » ni de phrase de pied). Données : sous-section « Phase 31 · Agent de projet en conversation »
de `design/donnees-fictives.md`.

Volet étroit (`S.agentPanelP`, `scripts/50-proposition.js`, 340 px) : en-tête de 56 px (`S.agentMark` 28, « Agent de projet · Silo »
13/600, boutons de 28 px `list`, `plus`, `maximize2`, `x` à icône de 15 px `dim`) ; conversation (`pad` 16 × 18, `gap` 14) : bulle
d'Adam à droite (240 px, rayon 10, `muted`, « Fais le point du jour » 13, « 14:38 » 12 `dim`), réponse de l'agent (`S.agentMark` 24, deux
paragraphes 13 / 1,55, « Lu : Planning, F5, journal des étapes » 12 `dim`), carte du lot n° 7 (celle de l'ancien « Agent · question ») ;
saisie de 40 px « Écris à l'agent de projet… » en pied. Briques réutilisées : `S.agentHeadP`, `S.conversationP`, `S.lotCardP`, `S.composeP`.

| Board | Script | Contenu | Export | Taille |
|---|---|---|---|---|
| P1 bis v3 · Vue d'ensemble, En retard au 18 oct., P6 · Nouveau projet, P1 bis · Vue d'ensemble · en attente | `55-phase-27.js` (`S.vue3`), `59d-agent-conversation.js` (`S.swapPanelAC`) | volet redessiné en conversation ; « En retard » : « 16 oct. · 14:38 » dans la bulle, texte et pourquoi au passé | inchangés (régénérés) | inchangées |
| P1 bis · Agent agrandi (nouveau) | `59d-agent-conversation.js` | clone de P1 bis v3 rendu à sa pleine largeur sans volet étroit (`S.stretchGridAC` : colonnes des semaines étirées, libellés fixes), puis volet de 720 px en **calque** à droite (`agent-overlay`, ombre portée vers la gauche, bord gauche `border`), qui recouvre la page sans la compresser (décision d'Adam du 2026-10-21, spec §46.2) : en-tête (`panelLeftClose`, `plus`, `minimize2`, `x`), liste des agents de 210 px (fond `bg`, bord droit `border`, « Nouvel agent » de 32 px, items de 56 px : titre 13/500, « 14:38 · 4 messages » 12 `dim`, en cours sur `panel` avec « en cours » 11 `brandText`), conversation et saisie dans la colonne de lecture | `proposition-agent-agrandi` | 1 440 × 1 260 |
| Agent de projet, volet (nouveau) | `59d-agent-conversation.js` | volet étroit, bouton `list` enfoncé, liste en calque sous l'en-tête (« Nouvel agent » et « Fermer la liste ») | `proposition-agent-volet` | 340 × 1 000 |
| Agent de projet, agrandi, liste rétractée (nouveau) | `59d-agent-conversation.js` | volet de 720 px sans liste, bouton `panelLeftOpen`, colonne de lecture de 520 px centrée | `proposition-agent-agrandi-liste-retractee` | 720 × 1 000 |

Boards retirés de la page « Proposition » : « Agent · question », « Agent · récapitulatif », « Agent · réveil sur réponse » (sombre et
clair) et leurs exports ; leurs rangées restent vides (`S.draw["p-agent-q"]`, `["p-agent-recap"]` et `S.drawA3k["p-agent-reveil"]`
rendent `null`).

Dessin : `await storage.drawAC(clé, mode)` pour `ac-agrandi`, `ac-volet`, `ac-retractee` (rangées à `S.Y_AC` = 53 000, pas de 1 500) ;
le volet des quatre boards existants se redessine en place par `await storage.swapPanelAC(nom, mode, retard)` (équivaut à rejouer
`S.draw27` et `S.draw29`). Export : `await storage.exportAC()` (depuis un clone, après 10 s), `export27` et `export29` pour les autres.
Cotes : `_dump-6`, `_dump-13`, `_dump-8`, `_dump-14` (`--sections 6,13,8,14`) et `_dump-33` (`--phase31`). Comparaison au pixel : le
mode étroit reste comparé sur « vue-ensemble », « attente-vue-ensemble » et « nouveau-projet » ; le mode agrandi sur « agent-agrandi ».

Pièges vus : un redessin complet de P1 bis v3 (`S.draw27("p-vue3")`, environ 1 000 formes) fait planter l'onglet headless (« Target
crashed », rendu à 2,3 Go) sur la page « Proposition » chargée ; d'où le volet redessiné en place. Le board sombre « P1 bis v3 · En retard
au 18 oct. » manquait au fichier : il est refait depuis son clair par `S.darkFromLightAC` (couleur du nœud de même chemin dans la paire
P1 bis v3, sinon la table des jetons), à l'identique de l'ancien export hors du volet. Un nom avec `/` devient `a / b` : chercher
`icon-button / list` en retirant les espaces.
## Phase 33 : barre du haut sans sync, barre latérale sans Tickets ni Notes (2026-10-29)

Spec §49.5 et §49.11 (composants `tickets` et `notes` retirés, décision du 2026-10-29). Sur la page « Proposition » (et sur les pistes A et C
pour la puce) : puce « Synchronisé · il y a 1 min » de la barre du haut retirée (`S.syncChip` supprimé de `10-shell.js` et de ses appels) ;
entrées « Tickets » et « Notes » retirées de la barre latérale du projet et du menu des pages de la barre repliée (`S.PAGES_P` : Vue d'ensemble,
Planning, Kanban, Graphe, Questions, comme §39.2) ; boards « P4 · Tickets » (sombre et clair) retirés avec leurs exports et `S.draw["p-tickets"]`.
Retrait en place dans Penpot (formes supprimées, mise en page flex recalculée), sans redessin.

Exports : les boards de Penpot ne rendent plus exactement les anciens PNG (textes remesurés à chaque chargement). Les exports
`proposition-*` ne sont donc pas refaits en entier : seule la zone qui change est recopiée du nouveau rendu dans l'ancien PNG (puce : sa
boîte élargie de 3 px, barre latérale : x 0 à 240 sur toute la hauteur, barre repliée : x 0 à 340, y 150 à 580 pour le menu et son ombre).
Hors de ces zones, aucun pixel ne change (vérifié par différence). Cotes : lignes de la puce et des deux entrées retirées de `cotes.md`,
positions des entrées suivantes de la barre latérale remontées de 32 px par entrée retirée (vérifié sur les positions Penpot), section P4 retirée.
Les pistes historiques (A2, B2, C2 « Tickets », pages « Styles » et « Choix ») restent en archive dans Penpot ; seules leurs listes de
navigation sont alignées dans les scripts.

## Phase 34 : Aujourd'hui, fin de parcours et lancement dans T3 (2026-10-30)

Spec §50 et arbitrages du plan de la phase 34. Données : section « Phase 34 · Aujourd'hui, fin de parcours et lancement dans T3 » de
`design/donnees-fictives.md` (horloge au vendredi 16 octobre, S42). Script : `scripts/61-phase-34.js` (chargé après `59d`).

Barre latérale (tous les boards de la page « Proposition », pistes comprises) : « Mes tickets » et « Boîte de réception » retirées,
« Accueil » devient « Aujourd'hui » ; barre repliée : icônes correspondantes retirées, menu des pages remonté (`10-shell.js`,
`55-phase-27.js`, `S.p34Sidebar`). Exports : zone de la barre seule recopiée du nouveau rendu (x 8 à 232, y 97 à 504 ; barre repliée
x 6 à 323, y 75 à 453), comme en phase 33. Cotes : entrées retirées, « Accueil » renommé, positions suivantes remontées de 32 px par entrée.

Écrans redessinés en place sur la page « Proposition » (`S.INPLACE34`, `await storage.inPlace34(nom)` par board, sombre puis
« (clair) ») :
- Vue d'ensemble (P1 bis, P1 bis v3, en attente, Agent agrandi, En retard) : tuile « En cours » en fonctionnalités ouvertes et limite,
  colonnes réordonnées (En retard sous les indicateurs ; Sprint et Prochaine à gauche, Questions puis En review à droite ; Échéances,
  En ce moment et Activité en pleine largeur), légende de la frise retirée, rangée « Livrée aujourd'hui » sous les indicateurs.
  Les boards passent à 1 400 px (En retard et récapitulatif de sprint : 1 440 px), même hauteur en sombre et en clair, `root` et
  calque `agent-overlay` étirés ; leurs exports sont refaits en entier et `e2e/pixel-masks.ts` suit (Vue d'ensemble : 1 400).
- Planning (P2, en attente, P2b) : alertes fusionnées en une ligne par sprint, ambre de capacité sur S42 et S43 seulement, légende
  retirée ; bande « En attente » au-dessus des sprints sur la variante en attente.
- Graphe (P5b, en attente) : cadres à bord plein `border`, lignes de 28 px, points de 10 px, icônes de 15 px, bouton « Tout voir ».
- Kanban (P7, en attente, barre repliée, P8c) : un seul signal par carte (bloqué > changements > attente > attend), PR et « Étape n/12 »
  seulement en En cours et En review, colonne vide repliée en bande de 40 px, compteur « 41 tickets ».
- Fiche ticket (P8, P8b, P8f, en attente, P8d, P8e) : « Lancer dans T3 » remplace « Copier /full-delivery » (passé au menu « ⋯ »),
  PR une seule fois avec « GitHub ↗ », CI « rouge », ligne « Requise ».
- Questions (P9, P9b, P9c, P9d) : une rangée de filtres, « Exporter » et « Nouvelle question » dans la barre du haut.
- Boutons neutres : « Créer » (P6) et « Mettre en attente » (P8c). « Phase n/12 » devient « Étape n/12 » partout (`S.p34Steps`,
  P3 compris).
Exports : rendu avant et après dans la même session, différence en boîte englobante, boîte recopiée du nouveau rendu dans l'ancien PNG ;
export complet si la taille du board change.

Page « Phase 34 » : dix-huit boards `P34 · …` (clés `S.ROWS34`), sombre à x = 0, clair à x = 1 540, rangées de **1 600 px**
(`S.STEP34`). Chaque board clone sa référence (copies « src · <board> » rangées à x = −20 000, collées depuis « Proposition » par
copier-coller, car le plugin ne déplace pas un board entre pages) ou est dessiné de zéro (Aujourd'hui, code couleur), puis reçoit ses
patchs (`S.draw34k`). Dessin : `await storage.draw34(clé, "dark" | "light")` ; export : `await storage.exportP34([clés])` ⇒
`exports/proposition-p34-<clé sans p34->-<dark|light>.png`. Cotes : `95-cotes.js` par board (`_dump-34` à `_dump-51`), puis
`python3 scripts/cotes.py <JSON> --phase34` ; écrans en place : `--sections 1,2,3,6,8,…,33`.

Pièges relevés :
- Penpot ne persiste qu'après coup : après un lot, attendre 45 à 60 s avant de rouvrir l'onglet, sinon les modifications et la
  suppression des clones d'export sont perdues ; vérifier les textes du board dans un onglet neuf.
- Un clone d'export resté à x = −5 000 (onglet fermé trop tôt) doit être supprimé à la main.
- Après des changements de texte en masse, une carte flex peut garder son ancienne hauteur : changer puis rétablir l'espacement de chaque
  board flex (`S.relayout34`, ou tous les boards flex du board) force le recalcul.
- `S.replace()` ramène les calques libres à leur position enregistrée : déplacer un calque par `S.place34`, qui met `S.placed` à jour,
  puis `bringToFront()` pour les superpositions (infobulle, toast, récapitulatif, dialogue).
- L'onglet plante sur la page « Phase 34 » après de longs lots : dessiner par deux ou trois clés, exporter chaque clé dans un onglet neuf.
