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

Projet Emis (`galadrimteam/emis-suivi-chantier`, branche `dev`), vendredi 16 octobre (S42). Ensembles C0 Socle (12/12),
C1 Connexion (8/8), C2 Périmètre et affectations (4/6, échéance lun. 19 oct.), C3 Saisie des ISO et tronçons (9/14),
C4 Fichiers et photos (1/5), C5 Rapports de chantier (0/6). Tickets EMIS-21 à EMIS-60, PR #18 à #23, questions Q14, Q16, Q17,
sessions T3 Code sur EMIS-23 et EMIS-33. Correction par rapport aux anciennes maquettes : C4 est un ensemble, sans agent ni
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
| P1 · Vue d'ensemble | fonctionnalités livrées 3/9 (une case par fonctionnalité), sprint en cours, ouvertes 2/2, PR en review, questions ; « En ce moment » (sessions T3 Code) ; échéances par sprint avec glissement de F5 ; carte du sprint S42 ; « Prochaine à finir » avec `/full-delivery EMIS-45` ; activité ; agent de projet (lot n° 7 : reporter F5, planifier F9, relancer Q14) |
| P2 · Planning | sprints S41 à S44 en colonnes et réserve « À planifier » ; cartes de fonctionnalité avec leurs étapes en cases ; F5 en retard ; F9 glissée vers la zone de dépôt de S44 ; limite d'ouvertes dans l'en-tête |
| P3 · Fonctionnalité | F5 « Envoyer les photos d'un tronçon » : résultat attendu, parcours A→Z en frise verticale (ticket, état git et PR, étape full-delivery, session), « Livrer la prochaine étape » (`/full-delivery EMIS-34`), sprint et proposition de report, dépendances, questions, activité |
| P4 · Tickets | liste à plat filtrée par sprint (S42), puce de fonctionnalité, terminés du sprint repliables, « Hors fonctionnalité » |
| P5 · Graphe | fonctionnalités en cadres placés dans la colonne de leur sprint, étapes listées, dépendances entre fonctionnalités, retard et blocage |

Données : 9 fonctionnalités F1 à F9 (EMIS-1 à EMIS-93), sprints S41 « Accès », S42 « Terrain hors ligne » (en cours, finit
le 16 oct.), S43 « Import et soudures », S44 « Rapports » ; F9 « Exporter le dossier client » à planifier.

Dessin : clés `p-vue`, `p-planning`, `p-fonctionnalite`, `p-tickets`, `p-graphe` sur la page « Proposition » (rangées de
1 300 px), puis `storage.edgesP()` par mode dans un second appel et `await storage.exportProposition()`
→ `exports/proposition-<écran>-<dark|light>.png`.

## Styles hors shadcn et vues d'ensemble (2026-10-16)

Retour d'Adam : la vue d'ensemble de la proposition est trop chargée. Elle doit répondre en 5 secondes à trois questions,
et à rien d'autre : **où en est-on** (fonctionnalités livrées sur le total, sprint en cours, tenue de la mise en production),
**qu'est-ce qui bloque** (questions bloquantes, retards, PR à relire), **quelle est la suite** (prochaine fonctionnalité à
finir, étape suivante). L'agent de projet reste discret : une phrase de synthèse et un lot à valider, sans panneau permanent.
shadcn n'est plus un cadre obligatoire : chaque direction a sa typographie, sa grille, ses couleurs et ses visualisations.

Données : redécoupage réel d'Emis (`~/Documents/emis/redecoupage-fonctionnalites-2026-10-16.md`) : 22 fonctionnalités
F00 à F21 (F00 livrée), F01 et F02 ouvertes, sprints S1 (en cours, dernier jour) à S10, mise en production le 18/12,
pistes P1 staging (bloquée : DSI et compte AWS) et P2 production, F16 à F21 à arbitrer après le 18/12.

Page Penpot « Styles » (`scripts/60-styles.js`, `scripts/70-vues.js`), sombre à x = 0 et clair à x = 1 540, rangées de 1 150 px.

| Board | Idée | Typographie et couleur |
|---|---|---|
| Style 1 · Vue d'ensemble et Planning | **Carnet de chantier** : journal éditorial en trois rubriques numérotées, gros chiffre en sérif ; planning en registre (un sprint par ligne, trait double de la mise en production) | Newsreader et Geist, papier chaud en clair, encre et brique |
| Style 2 · Vue d'ensemble et Planning | **Instrument** : panneaux numérotés, jauge des 22 fonctionnalités coupée par le trait de la mise en production, règle des sprints ; planning en matrice avec histogramme des ouvertes | IBM Plex Sans et Mono, quasi monochrome, un vert signal et un rouge d'alerte |
| Style 3 · Vue d'ensemble et Planning | **Atelier** : trois grandes cartes douces, une couleur en aplat par fonctionnalité, étapes en pastilles ; planning en colonnes de sprint avec carte glissée | Bricolage Grotesque et DM Sans, crème en clair, orange pour l'action principale et l'agent |
| Vue 4 · Une phrase | une synthèse rédigée en grand, trois liens dessous | Newsreader |
| Vue 5 · Frise | toute la page est la frise jusqu'au 18/12 : deux voies (la limite de deux ouvertes), pistes, « aujourd'hui », blocages piqués | Space Grotesk et JetBrains Mono, bleu de plan |
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
données Emis et une légende d'une ligne.

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
