# Penpot — maquettes Kibo

Penpot auto-hébergé : source de vérité des maquettes. Les PDF de `design/pdf/` en sont un export ;
les données affichées suivent `design/donnees-fictives.md`.

## Lancer et importer

```sh
cd design/penpot
docker compose -p kibo-penpot up -d     # http://localhost:9010
xz -dk kibo.penpot.xz                   # → kibo.penpot, à importer (Projets → Importer)
```

Premier lancement : créer un compte local. Secret par défaut : définir `PENPOT_SECRET_KEY` hors usage local.

## Fichier « Kibo »

| Page | Écrans |
|---|---|
| 00 · Fondations | boutons, statuts, icônes, domaines |
| 01 · Shell — variantes | explorations A/B/C (historique) |
| 02 · Écrans MVP | 1–6, 29 créer un composant, 30 permissions |
| 03 · Pages projet | 7–11, 24 nouveau ticket, 25 nouvelle page, 26 projet créé, 27 assigner à un agent |
| 04 · Workspace & paramètres | 12–19, 28 profil d'agent, 31 appairage web |
| 05 · Logo | piste 5 « Kanban » retenue |
| 06 · Onglets, code & fichiers | 20–23 |
| 07 · Agents (suite) | 32–35 (phase 2) |
| 08 · Code (états) | 36–42 (phase 3) |
| 09 · Composants | 43–49 (phase 4) |
| 10 · Intégrations | 50–57, 57b–57n (phase 5 : source synchronisée, Sheet ticket GitHub / CI / Maquettes, Source MCP, vues synchronisées) |
| 11 · IA | 58–64 (phase 6) |
| 12 · Sync & marketplace | 65–97 (phase 7) |
| 13 · Compléments | 76–78 (revue §7) |
| 14 · Finitions UI | 98–106 (phase 9, vague 1 : fiche ticket, menus, confirmations) ; **dessinés** |
| 15 · Projets & réglages | 107–112 (vague 2 : projet, workspace, apparence, historique, avatar) ; **dessinés** |
| 16 · Tickets & boîte de réception | 113–115, 125, 126 (vague 3) ; **dessinés** |
| 17 · Composants & synchronisation | 116–120 (vague 3 ; 116 amendé en vague 4) ; **dessinés** |
| 18 · Agents, code & démarrage | 121–124 (vague 3) ; **dessinés** |
| 19 · Formats & créations | 127–135 (vague 4) ; **dessinés** |
| 20 · Notes, graphe & disposition | 150–155 (phase 12) ; **dessinés** |
| 21 · Composants riches | 30b, 156–160 (phase 13) ; **dessinés** ; 157 : composant retiré (§26.11) |
| 22 · Installation & aide | 19, 19b, 19c, 78, 76, 76b, 76c, 112c, 136–139 (phase 14) ; **dessinés** |
| 23 · Didacticiel | 140–146 (phase 14) ; **dessinés** |
| 24 · Maquettes Figma & Penpot | 16, 16b, 53, 53b, 53c, 147, 148, 149, 4, 4b (phase 15) ; **dessinés** |
| 25 · Questions & session | 166 à 173 (phase 17 : étiquettes, worktrees, mode Automatique, questions, session principale) ; **dessinés** |
| 26 · Agent de projet | 174 à 177 (phase 18 : panneau, lot à valider, anciens agents, profil) ; **dessinés** |
| 27 · Jeux & Storybook | 178 à 182 (phase 19 : widget Jeu itch.io, story Storybook, comparaison, réglage Storybook) ; **dessinés** ; 178, 179 : composant retiré (§26.11) |
| 28 à 28d · Pistes | pistes de brainstorming de la phase 20 (visibilité des agents, pistes épurées, graphe, couleurs du graphe), hors des PDF |
| 29 · Visibilité des agents | 183 à 188k (phase 20 : barre et volet des agents, onglet Activité, mention d'agent, Questions et destinataires, graphe lisible, Kanban « Démarrable ») ; **dessinés** |
| 30 · Signaux des agents | 189 à 191 (phase 21 : boîte à signaux, lot après réveil, fil du run émetteur, Activité, pastille et notification) ; **dessinés** |
| 31 · Agents et skills | 192 à 196 (phase 22 : page Agents et fiche, nouvel agent, « Ce que reçoit l'agent », conflit d'écriture, page Skills, éditeur, notes de review, intégration en diff, historique, fil du run) ; **dessinés** |
| 32 · Doublons entre agents | 197 à 201b (phase 23 : fil `other` et `owner`, fichiers du recouvrement, lien posé et annulé, fiche Détails et Activité, barre, page du run, réglages, « Ce que reçoit l'agent ») ; **dessinés, ajustés après implémentation** |
| 33 · Questions : modifier, rouvrir, archiver | 202 à 206 (phase 23 : réponses modifiables, archives et historique, lot de questions, aperçu au survol, question mise en évidence) ; **dessinés** |
| 34 · Domaines & guidelines | 207 à 209b (phase 23 : arbre de dossiers, état vide, domaine de projet et du workspace, projet partagé en lecture seule, encart, sélecteur groupé, lien du projet) ; **dessinés, ajustés après implémentation** |

Pages 00 à 27 et 29 à 34 dessinées ; les PDF de `design/pdf/` et `kibo.penpot.xz` sont à jour jusqu'à la page 34.
Pages 28 à 28d : pistes de brainstorming (visibilité des agents, pistes épurées, graphe, couleurs du graphe), hors des PDF ; scripts `32b` à `32f`, pistes eux aussi.

Règles :
- Chaque écran existe en **sombre et en clair**, le clair nommé `… (clair)`. Modifier le sombre, puis régénérer le clair (`S.relight`).
- Orange réservé aux agents et à la marque (bouton `#C2410C`) ; « En file » cyan ; profils d'agent sans couleur.
- Statut = pastille ronde (Backlog = anneau) ; domaine = puce carrée, palette `S.domainColors`.
- shadcn/ui, Geist / Geist Mono, une icône Lucide par concept (`S.ICON_OF`).

## Scripts (plugin MCP)

Plugin : Fichier → MCP Server → Connect. Garder l'onglet au premier plan : Chrome ralentit les onglets cachés.

`scripts/0N-*.js` rechargent les helpers dans `storage` (perdus à chaque connexion). Avec
`python3 scripts/receiver.py` lancé (il sert les scripts et reçoit les exports), exécuter dans le plugin :

```js
storage.sleep = (fn, ms = 0) => { if (ms < 30) Promise.resolve().then(fn); else fetch("http://127.0.0.1:8787/sleep?ms=" + ms).then(fn, fn); return 0; };
storage.load = async (n) => new Compartment({ storage, penpot, penpotUtils, setTimeout: storage.sleep, fetch, console, Promise })
  .evaluate("(async()=>{" + await (await fetch("http://127.0.0.1:8787/" + n)).text() + "\n})()");
for (const n of ["01-core", "02-icons", "03-shell", "04-components", "05-tabs", "06-export", "07-data", "08-extra"]) await storage.load(n + ".js");
```

Écrans 32+ : `08-extra.js` (shell reconstruit, menus, alertes, tableaux, `S.relight` + `S.fixLightX`), puis un script par page
(`09-agents`, `10-code`, `11-composants`, `12-integrations`, `13-ia`, `14-sync`, `15-complements`, `16-integrations-suite`) qui définit `S.draw[n]()`.

Écrans 98+ : charger aussi `18-socle.js` puis `17-finitions` et `19-projets-reglages` … `23-formats-creations`. Un écran y est le clone d'une
base (`base · …`, hors champ à gauche, retirée par `S.dropBases()` avant l'export) ; le clair est redessiné avec la palette claire (`S.setMode`),
bien plus rapide qu'un `S.relight`. `S.job(S.FINITIONS)` (ou `S.PROJETS`, `S.TICKETS`, `S.COMPOSANTS`, `S.AGENTS_CODE`, `S.CREATIONS`) dessine
sombre puis clair en tâche de fond ; suivre `storage.jobState`. Garder l'onglet « Ressources » ouvert (l'arbre des calques ralentit tout) et la
vue hors des écrans dessinés.
Un clone ne change pas de page : les écrans de base (`base · n`) sont copiés puis collés (⌘C / ⌘V) sur la page, puis supprimés.
Après un dessin, appeler `S.retext(écran)` (et `S.recenter` pour un dialogue) dans un **second** appel, une fois la mise en page calculée.

Utiles : `S.screen(n, clair)`, `S.relight(id)`, `S.retext(frame)`, `S.setText(t, "…")`, `S.fillKanban(content)`, `S.newScreen(base, nom)`.

Pièges :
- `penpot.openPage` avant toute modification (`S.screen` / `S.open` le font).
- Changer un texte ou cloner un écran ne recalcule pas son rendu : `S.setText` / `S.retext` (sinon l'export garde l'ancien texte ou l'ancienne couleur).
- Dans un conteneur flex, `appendChild` ne réordonne pas : créer sans parent puis `parent.insertChild(i, shape)`.
- Un appel est limité à 120 s : traiter un ou deux écrans par appel.
- Onglet masqué (autre onglet au premier plan, fenêtre cachée, écran verrouillé) : Chrome bride `setTimeout` à une fois par minute, un écran passe
  de 3 à 20 min. Les scripts attendent donc par le receiver (`/sleep?ms=`, passé comme `setTimeout` par `storage.load`).
- Onglet masqué : l'enregistrement côté serveur prend aussi du retard. Après chaque page, recharger l'onglet, reconnecter le plugin et relister
  les boards de la page pour vérifier qu'ils sont bien enregistrés ; redessiner ceux qui manquent.
- Fichier en stockage page par page (flags `enable-feature-fdata-objects-map` et `enable-feature-fdata-pointer-map` de `PENPOT_FLAGS`,
  `docker-compose.yaml`) : une modification ne réécrit plus tout le fichier. Ne pas retirer ces flags, le fichier ne s'ouvrirait plus.
- Jetons d'accès (`enable-access-tokens` dans `PENPOT_FLAGS`, frontend et backend) : sans ce flag Penpot ignore tout jeton et répond un
  profil anonyme ; Kibo refuse alors la connexion (« Penpot a ignoré ce jeton »).
- Persistance : un job annoncé terminé peut n'avoir rien enregistré (onglet figé ou backend redémarré : page 19 entière perdue une fois).
  Dessiner par lots de 2 ou 3 écrans (`S.job([127, "127b"])`), puis comparer le nombre de formes côté serveur (`get-page` depuis l'onglet,
  `fetch("/api/main/methods/get-page?file-id=…&page-id=…&features=…", { credentials: "include" })`) au nombre local
  (`penpotUtils.findShapes(() => true, root).length + 1`) avant le lot suivant. Recharger l'onglet entre deux pages ou au-delà de 3,5 Go de tas.
- Recherche par identifiant : jamais `penpotUtils.findShapeById` (parcourt toute la page, ~1 min par appel sur une page chargée),
  toujours `penpot.currentPage.getShapeById` (immédiat).
- Nom de board : pas de `/`, Penpot le lit comme un chemin de groupe et tronque le nom (« 152b · Notes : menu / » devenait « … menu »).
- Premier écran sombre cloné d'une base toute neuve : la base n'est pas encore mise en page et le clone sort écrasé (barre d'onglets
  étroite). `S.both` le détecte et redessine le sombre une fois la base calculée.
- Ordre des enfants : un `insertChild` fait dans `S.job` (tâche détachée) n'est pas conservé. Après les écrans 157 (page « Jeux ») et 140 à 146b
  (projet de démonstration), lancer `S.fixNav()` sur la page, dans un appel direct, pour remettre la barre latérale dans l'ordre.
- Dessin en Chromium headless : un Chromium sans fenêtre (Playwright, session Penpot enregistrée, port CDP local) garde l'onglet au
  premier plan en permanence, sans le bridage des onglets masqués ; le plugin MCP s'y connecte comme dans Chrome (bouton « MCP » de la
  barre, puis recharger les scripts). Le piloter par CDP (captures, rechargement entre deux pages), jamais par l'extension Chrome.
- Onglet de dessin en rendu SVG : ajouter `&wasm=false` à l'URL du workspace (prime sur l'option WebGL du profil). Avec WebGL, le dessin
  est plus lent et l'onglet finit par se figer.

## Phases 12 à 15 (pages 20 à 24)

Scripts écrits d'après la spec (§18 à §21), `packages/ui/src/i18n` et les captures `screens/`. Même mécanique que les pages 15 à 19
(base clonée, `S.both`, `S.job`). Ordre de chargement, après `01-core` … `08-extra` : `18-socle`, `17-finitions` (pour ses icônes), `24-socle-suite`
(icônes, grille de tableau de bord, widgets, projet de démonstration, panneau du didacticiel : `S.fx2`), puis `25-notes-graphe`, `26-composants-riches`,
`27-installation-aide`, `28-didacticiel` (après 27 : il réutilise l'écran d'accueil) et `29-maquettes`. Listes de job : `S.NOTES_GRAPHE`,
`S.COMPOSANTS_RICHES`, `S.INSTALLATION`, `S.DIDACTICIEL`, `S.MAQUETTES`.

Numéros : 136 à 149 (phases 14 et 15) et 150 à 160 (phases 12 et 13) suivent la spec (§8, §20.7, §21.8). Les variantes d'un écran existant prennent une lettre (30b, 76b, 112c, 4b…).

- 20 · Notes, graphe & disposition : 150 Kanban, colonnes qui défilent · 151 disposition, taille libre (poignées, « 6 × 8 cases ») · 151b raccourcis de taille ·
  151c compaction pendant le glisser · 152 notes, barre d'outils · 152b menu `/` · 152c bulle de sélection · 152d image collée et aperçu en direct ·
  153 graphe, navigation (minimap, zoom, légende) et sélection · 153b sélection multiple · 154 widget Graphe par format · 155 toast « Onglet fermé · Annuler ».
  Rend obsolètes le fantôme rouge de 127b et « Pas de place » de 128 (§18.2).
- 21 · Composants riches : 30b autoriser un composant, capacités · 156 Visionneuse 3D · 156b sans modèle · 156c réglages (fichier du projet) · 157 Serpent ·
  157b plein écran de Kibo · 157c partie perdue (157 à 157c **retirés**, §26.11 : composant Serpent supprimé) · 158 sélection partagée · 159 Fichiers du projet · 159b envois et refus · 159c supprimer un fichier · 160 gabarits.
- 22 · Installation & aide : 19 premier lancement complété · 19b Claude Code non connecté · 19c aide dépliée · 78 Claude Code introuvable ·
  76 Général (Application, Mises à jour, Sauvegardes, Commande kibo ; version de bureau) · 76b supprimer une sauvegarde · 76c sauvegarde en cours, dossier refusé ·
  112c menu de l'avatar, groupe Aide · 136 À propos · 137 Quoi de neuf · 137b aucune note · 138 Signaler un problème · 139 Raccourcis (dialogue `⌘/`).
- 23 · Didacticiel : 140 proposition · 140b reprendre · 141 étape 1 et panneau · 142 étape 2, graphe · 143 étape 3, note · 144 étape 4, disposition ·
  145 étape 5, assigner à l'agent de démonstration · 145b question de l'agent · 145c étape 6, composant · 146 terminé · 146b supprimer la démo.
- 24 · Maquettes Figma & Penpot : 16 Intégrations, lignes Figma et Penpot · 16b menu de la ligne Penpot · 53 Connecter Figma, jeton · 53b serveur MCP ·
  53c jeton refusé · 147 Connecter Penpot · 147b jeton refusé · 147c adresse invalide · 147d déconnecter · 148 widget Maquette · 148b périmé, hors ligne ·
  148c vide et erreurs · 149 réglages du widget · 149b URL invalide · 4 fiche ticket, section Maquettes · 4b URL refusée, aperçu absent.

## Phase 17 (page 25)

`30-questions.js`, chargé après `29-maquettes` ; listes de job `S.QUESTIONS` (170 à 173) et `S.HERITES` (166 à 169). Après le dessin, `S.fixQNav()`
dans un appel direct (élément « Questions » de la barre latérale sous « Notes »), puis `S.dropBases()`. Données : section « Questions » de `donnees-fictives.md`.

- 25 · Questions & session : 166 fiche, étiquettes et branche (infobulle de la base) · 166b étiquette invalide · 167 Modifier le projet, worktrees des agents ·
  167b guillemets simples refusés · 168 profil, mode Automatique et règles d'autorisation · 168b règle Bash sans motif · 169 Tickets, filtre d'étiquettes ·
  170 widget Questions, réponse en ligne · 170b vue filtrée « Répondues » · 170c vue et dialogue « Nouvelle question » · 171 pastille « 2 questions » sur la carte
  Kanban et la fiche (« Session principale : opus-dev-2 · 3 tours ») · 171b pastille dans la ligne Tickets · 172 tiroir du run « Terminé · 1 question », ligne
  `session`, notification système · 172b réponses à transmettre · 173 Assigner, session reprise et « Repartir de zéro » · 173b nouvelle session (transcript introuvable).

## Phase 18 (page 26)

`31-agent-projet.js`, chargé après `24-socle-suite` (indépendant de `30-questions`) ; liste de job `S.AGENT_PROJET`, puis `S.dropBases()`.
Panneau à droite sous la barre du haut (440 px), pour garder visible le bouton « Agent de projet » et sa pastille. Données : section
« Agent de projet (phase 18) » de `donnees-fictives.md`.

- 26 · Agent de projet : 174 panneau ouvert sur le Kanban, bouton à pastille orange, conversation (session, message, lectures, réponse, début du lot) ·
  175 lot n° 1 à valider (quatre groupes, cases, avant → après, pourquoi, « Valider (4) » / « Refuser ») · 175b après décision (Appliquée ×3, Périmée,
  Ignorée) · 176 menu « ⋯ » · 176b anciens agents · 176c ancien agent en lecture seule (lot refusé) · 176d confirmation « Nouvel agent de projet ? » ·
  177 profil « Agent de projet » (modèle, parallélisme fixé à 1, guidelines du profil).

## Phase 19 (page 27)

`32-jeux-storybook.js`, chargé après `24-socle-suite` ; liste de job `S.JEUX`, un écran par appel, puis `S.dropBases()`. Données : section
« Jeux et Storybook (phase 19) » de `donnees-fictives.md`. Le contenu des cadres (jeu, story, maquette Figma) garde des couleurs fixes en sombre et en clair.

- 27 · Jeux & Storybook : (178 à 179 **retirés**, §26.11 : composant Jeu itch.io supprimé) 178 widget Jeu itch.io (« Una war », « Fourni par itch.io ») · 178b hors ligne · 178c intégration refusée · 178d vide et dialogue Réglages ·
  179 plein écran de Kibo · 180 widget Maquette, story `Screens / Home` · 180b Storybook injoignable · 180c menu des origines (Projet, `feat/login` injoignable) ·
  181 comparaison côte à côte (story, cadre Figma « Accueil ») · 181b superposition (opacité 50 %, curseur 40 %) · 182 Modifier le projet, section Storybook.

## Phase 20 (page 29)

`33-visibilite-agents.js`, chargé après `24-socle-suite` et les pistes `32b-pistes-agents` et `32d-pistes-questions` (dont il réutilise les primitives :
`S.vis`, `S.visQ`) ; il recharge lui-même `32e-graphe-lisible` sur la page 29 (`S.graphePage`) et y branche la barre d'outils réelle du graphe
(`S.grapheScreen`). Listes de job `S.VISIBILITE` (183 à 187d) puis `S.VIS_GRAPHE` (188 à 188k, placés trois rangées plus bas) ; après le dessin,
`S.fixVisNav()` et `S.fixVisLogos()` dans un appel direct (élément « Questions » de la barre latérale, logo de l'espace de travail resté à la
position de la base en clair), puis `S.dropBases()`. 185 est une page entière (1440 × 1420).
Pour redessiner la piste 28c, recharger les scripts sans `33` (`S.grapheScreen` et `S.grapheLegend` restent dans `storage`).
Données : section « Visibilité des agents (phase 20) » de `donnees-fictives.md` ; d'après les captures `screens/2026-10-1x-p20-t7` à `t13`.

- 29 · Visibilité des agents : 183 barre des agents repliée (places, file, puces avec étape, « Répondre », poignée) · 184 volet trois colonnes (runs actifs
  et en file, fil avec action en erreur dépliée et réponse, plan 2/5) · 185 fiche en page, Activité large (compte rendu, chronologie plan et fil mêlés,
  plan) · 185b fiche étroite, Activité empilée · 186 carte au survol d'une mention sur le Kanban · 186b volet latéral du run · 186c page dédiée
  (historique des runs, fil avec raisonnement, « Répondre » et « Arrêter le run » dans l'en-tête) · 187 Questions, filtre Tous avec compteurs et menu
  du destinataire · 187b filtre Client, « Exporter tout (2) », question envoyée · 187c « Coller la réponse » · 187d Modifier le projet, destinataires
  des questions · 188 graphe en vagues · 188b focus · 188c regroupement par étiquette `chapitre:` · 188d zoom éloigné · 188k Kanban, pastille
  « Démarrable » et filtre.

## Phase 21 (page 30)

`34-signaux-agents.js`, chargé après `24-socle-suite`, les pistes `32b-pistes-agents` et `32d-pistes-questions` (`S.vis`, `S.visQ`) et
`33-visibilite-agents` ; liste de job `S.SIGNAUX`, puis `S.dropBases()`. Panneau de l'agent de projet repris de la page 26 (440 px), avec les onglets
« Conversation » et « Signaux · n » ; la pastille chiffrée remplace le point orange du bouton. Dans la barre des agents, opus-dev-2 a repris son run
(run 4, plus de « Répondre »). Données : section « Signaux des agents (phase 21) » de `donnees-fictives.md` ; d'après les captures
`screens/2026-10-12-t5` et la piste P5 (page 28).

- 30 · Signaux des agents : 189 conversation, ligne « Réveil automatique · 2 signaux » et lot n° 2 « après réveil » avec la provenance sous chaque
  action · 189a onglet « Signaux · 4 », boîte (Blocage, Ticket à créer, Question, Contexte ; « Ouvrir le ticket », « Ignorer »), « prochain réveil
  à 14:41 » · 189b après « Valider (3) » : boîte à 2, « Traités » (« traité dans le lot n° 2 · KIB-31 »), pastille « 2 » · 189c lot appliqué
  (« Appliquée » ×3, KIB-31) · 190 page dédiée du run opus-dev-2 (KIB-14), ligne de signal et action « Signalé » dépliée · 190b fiche KIB-14, onglet
  Activité, ligne de signal dans la chronologie · 191 Kanban, pastille « 4 » et notification « Blocage signalé par opus-dev-3 · KIB-16 ».

## Phase 22 (page 31)

`35-agents-skills.js`, chargé après `24-socle-suite`, `32b-pistes-agents` et `32d-pistes-questions` (primitives `S.vis`, `S.visQ`) ; liste
`S.AGENTS_SKILLS`. Dessiner **un écran par appel direct** avec `await S.one(n)` (sombre puis clair par `S.both`, puis export PNG des deux
dans `exports/pages/<n>-dark.png` et `<n>-light.png`) : un appel qui dépasse 120 s continue et finit bien, mais une chaîne détachée
(`.then`, `S.job`) perd l'ordre des sous-entrées « Files d'attente » et « Skills » et met la croix des onglets en tête. Après le dessin,
`await S.fixAgSk()` dans un appel direct (sous-entrées sous « Agents », croix des onglets en dernier), puis `S.dropBases()`.
Écrans de 1 120 à 1 180 px de haut pour 192, 192b, 193b, 194, 194b ; rangées espacées de 1,4 × 1 040 px.
Données : section « Agents et skills (phase 22) » de `donnees-fictives.md` ; noms de runs `portée ou projet · agent · ticket` (§28.12).
Ajustés après implémentation sur les captures `screens/2026-10-12-t8` (T9) : fiche d'agent et éditeur de skill ouverts dans la page, fil d'Ariane
« Agents › nom » ou « Skills › nom » sous l'en-tête (qui garde « Agents » ou « Agents › Skills » et son bouton « Nouvel agent » ou « Nouveau skill »),
onglet « Agents » ou « Skills » (icône sparkles), bouton « Renommer » ; historique des runs en colonnes Run, Ticket, Projet, Agent (nom du run
et heure), Durée, Tokens, Résultat, avec la recherche ; 193d en niveaux avec leur chemin `context/…`, puis `CLAUDE.md` complet, `brief.md` et
`agents.json` repliés ; 194b : skill de plugin dans l'éditeur, « Copier pour modifier » en dialogue ; notes de review en troisième colonne ;
intégration en diff sans actions par bloc ; dans le fil, « A utilisé le skill », le refus en rouge et « A laissé une review de 2 skills ».

- 31 · Agents et skills : 192 page Agents (statistiques, cartes « Mes agents » avec portée, modèle, skills et sous-agents, run en cours,
  « masqué », « Nom peu parlant », « fichier illisible », agents de Kibo repliés, historique des runs) · 192b « Nouvel agent » (nom, portée,
  description obligatoire, modèle, gabarits Vide, Livraison, Review, SEO, Chef d'orchestre, aperçu « Dans Claude Code », chemin du fichier) ·
  193 fiche agent, spec en premier · 193b réglages techniques dépliés · 193c sous-agents appelables et skills autorisés · 193d « Ce que reçoit
  l'agent » · 193e conflit d'écriture · 194 page Skills (Cet ordinateur, Projet, Plugins ; groupes repliables, plugins repliés, « Tout déplier », filtres Tous · Utilisés · Avec notes avec compteurs, 0.22.0-alpha.2) · 194b skill de plugin en lecture seule, « Copier pour
  modifier » · 195 éditeur de skill, côte à côte et fichiers annexes · 195b notes de review · 195c intégration en diff · 195d historique des
  versions · 196 fil du run et bloc « Reviews de skills » de l'onglet Activité.

## Phase 23 (page 32)

`36-doublons-agents.js`, chargé après `24-socle-suite`, `32b-pistes-agents` et `32d-pistes-questions` (primitives `S.vis`, `S.visQ`) et
`35-agents-skills` (`S.one`, `S.fixTabX`) ; liste `S.DOUBLONS`. Comme pour la page 31, **un écran par appel direct** avec `await S.one(n)` (sombre
puis clair, export PNG des deux) ; un appel qui dépasse 120 s continue en tâche de fond : attendre ses PNG avant l'appel suivant, sinon deux écrans
se dessinent en même temps. Après le dessin, `S.fixDoublonsNav()` (sous-entrées « Files d'attente » et « Skills » sous « Agents ») et `S.fixBarTip()` (bulle de 200 au-dessus de la puce ⧉ 1) dans un appel direct, puis `S.dropBases()`.
Projet Boutique (BOU) : `toBoutique` renomme Kibo et KIB-… dans la barre latérale, les onglets et le fil d'Ariane de la base. Écrans de 1 040 px
de haut (1 120 pour 199, 1 240 pour 201 et 201b) ; rangées espacées de 1,4 × 1 040 px. Données : section « Doublons entre agents (phase 23) » de
`donnees-fictives.md`. Recouvrement en zinc avec l'icône `Copy`, lien automatique avec l'icône `Link` ; l'orange reste aux agents.

Ajustés après implémentation sur les captures `screens/2026-10-12-p23-t11` (T11) : en-tête du run « Agent livraison · Projet · BOU · titre · démarré à »,
« Arrêter » ; fil ouvert par « Session : nouvelle » et fermé par « Écrire à l'agent » ; colonne de droite « Travail en parallèle », plan et « Compte rendu » ;
puces de la barre « BOU-15 · 3/4 · étape ⧉ 1 ». Écrans ajoutés : 197c, 199b, 200b (dans `S.DOUBLONS`). Pour redessiner un écran renommé, `S.dropScreen(n)`
retire l'ancien (sombre et clair) avant `S.both(n)`.

- 32 · Doublons entre agents : 197 page du run `bou · livraison · BOU-15` (`other`) : ligne « Recouvrement avec … · `formatDate` exporté deux
  fois », « à factoriser », « Ouvert », « Voir les fichiers » et « Ignorer », puis « A regardé le travail de BOU-12 » (`peek_work`) et « Kibo a
  rappelé de factoriser » · 197c dialogue « Fichiers du recouvrement » (deux fichiers côte à côte, lignes en rouge et en vert) · 197b run `bou · livraison · BOU-12` (`owner`) : « repris par bou · livraison · BOU-15 », « Réglé 14:52 », information
  au propriétaire · 198 « Kibo a lié BOU-12 → BOU-15 (BOU-12 bloque BOU-15) », `src/lib/format-date.ts` repris de BOU-12, « Annuler » ·
  198b « Annulé par Adam 15:03 », bouton disparu, run « Terminé » · 199 fiche BOU-15, Détails : « Bloqué par » BOU-12 avec le badge « par Kibo »
  et sa bulle · 199b Activité avec les lignes de recouvrement et de lien, « Recouvrements : 1 réglé · 0 ouvert » sous le compte rendu · 200 barre du
  pied de page (puces avec ⧉ 1, « 2/3 places · 1 recouvrement », bulle) sur la fiche BOU-12 · 200b page du run avec « Travail en parallèle » · 201 « Modifier le projet », section
  « Doublons entre agents » · 201b « Ce que reçoit l'agent » sur BOU-15, niveau « Travail en cours sur le projet (exemple) » déplié.

## Phase 23 (page 33)

`37-questions-edition.js`, chargé après `24-socle-suite`, `32b-pistes-agents` et `32d-pistes-questions` (primitives `S.vis`, `S.visQ`) et `36-doublons-agents`
(`S.dropScreen`) ; liste `S.QUESTIONS_EDITION`. Un écran par appel (`S.both(n)`), puis `S.fixQEditNav()` et `S.fixQPreview()` dans un appel direct (élément « Questions » sous
« Notes », aperçu de 205b sous sa ligne de lot une fois la mise en page calculée) et `S.dropBases()`. Données : section « Questions : modification et archivage (phase 23) » de `donnees-fictives.md`. Actions de la carte
(« Modifier la réponse », « Retirer la réponse », « Rouvrir », « Archiver », « Restaurer ») dans l'en-tête, à droite du titre (demande d'Adam, captures
`screens/2026-10-12-p23-qactions`).

- 33 · Questions : modifier, rouvrir, archiver : 202 filtre « Répondues », réponse non transmise (« à transmettre ») modifiable, réponse transmise
  figée (`Lock`, « transmise à sonnet-review · figée », « Rouvrir ») · 202b formulaire de réponse rouvert, prérempli, « Annuler » / « Enregistrer » ·
  203 filtre « Archivées », « Archivée par Adam », « Restaurer », « Historique (3) » déplié · 204 lot n° 3 de l'agent de projet (destinataire ajouté,
  question créée, question modifiée avec titre et destinataire avant → après, rouverte, archivée) · 205 aperçu de la pastille « 2 questions » de KIB-14
  sur le Kanban · 205b aperçu d'une question sur une ligne du lot · 206 question mise en évidence (fond orange en fondu) et adresse `?question=`.

## Phase 23 (page 34)

`38-domaines-guidelines.js`, chargé après `18-socle`, `17-finitions`, `24-socle-suite`, `32b-pistes-agents`, `32d-pistes-questions` et
`35-agents-skills` (`S.one`) ; liste `S.GUIDELINES`. Un écran par appel (`S.both(n)` ou `S.one(n)`), puis `S.fixGuidelinesNav()` dans un appel direct
(Boutique sous Facturation dans la barre latérale, croix des onglets en dernier) et `S.dropBases()`. Les textes en `auto-height` ne sont mesurés
que si l'onglet est au premier plan et que l'écran est dans la vue : avant l'export, `penpot.viewport.zoomIntoView([sombre, clair])`, puis `S.retext`.
Projets Kibo, Portail, Facturation et Boutique (`projectsShell` renomme Portfolio et API Facturation de la base, ajoute Boutique). Écrans de 1 100 px
de haut (207 à 208, 208c), 1 040 sinon ; rangées espacées de 1,4 × 1 040 px. Données : section « Domaines & guidelines (phase 23) » de `donnees-fictives.md`.

- 34 · Domaines & guidelines : 207 page entière, encart « Comment les agents sont configurés » déplié, arbre (Workspace et « Domaines du workspace »,
  Kibo déplié avec ses fichiers et « Domaines », Portail, Facturation, Boutique repliés ; chemins complets `guidelines/…` ; chevron des dossiers
  dans un bouton séparé), nœud « Projet · Kibo » (dossier tronqué « ~/code/galadrim/kibo-monorepo… · 3 fichiers · 4 domaines », Éditer,
  `guidelines/kibo.md`, Injection « Workspace → Projet Kibo ») · 207b dossier Facturation vide (« Aucune guideline pour ce projet. », « Ajouter un fichier », « Aucun domaine… »,
  « Nouveau domaine ») · 208 domaine Sync de Kibo (« domaine de Kibo · utilisé par 8 tickets », corbeille, `sync.md`, Injection « Workspace → Projet
  Kibo → Domaine Sync ») · 208b encart replié, domaine du workspace Sécurité (« utilisé par 6 tickets dans 2 projets », Injection « Workspace →
  Domaine Sécurité ») · 208c projet partagé Portail dont Adam est lecteur (badge « Lecture seule », ni « + », ni Enregistrer, ni « Supprimer le
  fichier », pas de « Domaines » dans l'arbre) · 209 fiche KIB-14, sélecteur de domaine groupé (« Aucun », « Domaines de Kibo », « Domaines du workspace ») · 209b « Modifier
  le projet », section Guidelines entre Storybook (Adresse, Variable du port) et « Doublons entre agents » (« 7 fichiers .md · 4 domaines » suivi
  du lien « Ouvrir le dossier de guidelines → »). La portée « domaine de Kibo » est une pastille au point de la couleur du projet.

## Exporter

1. PDF : dans le plugin, `await storage.exportPage("00")` … jusqu'à la dernière page dessinée, `("27")`, puis `("29")` à `("34")` aujourd'hui (les pistes 28 à 28d restent hors PDF) (une page par appel ; pour une page chargée, `await storage.exportPart("12", 0, 4)` par tranches), puis
   `scripts/build-pdf.sh` → `design/pdf/kibo-design-{sombre,clair}.pdf`.
2. Source : menu du fichier → Exporter (.penpot), puis `scripts/pack-penpot.sh <fichier>` → `kibo.penpot.xz` (sans les vignettes des boards,
   que Penpot régénère : l'archive reste sous la limite de 100 Mo de GitHub).
