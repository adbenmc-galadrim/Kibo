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
| 21 · Composants riches | 30b, 156–160 (phase 13) ; **dessinés** |
| 22 · Installation & aide | 19, 19b, 19c, 78, 76, 76b, 76c, 112c, 136–139 (phase 14) ; **dessinés** |
| 23 · Didacticiel | 140–146 (phase 14) ; **dessinés** |
| 24 · Maquettes Figma & Penpot | 16, 16b, 53, 53b, 53c, 147, 148, 149, 4, 4b (phase 15) ; **dessinés** |

Pages 00 à 24 dessinées ; les PDF de `design/pdf/` et `kibo.penpot.xz` sont à jour jusqu'à la page 24.

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
  157b plein écran de Kibo · 157c partie perdue · 158 sélection partagée · 159 Fichiers du projet · 159b envois et refus · 159c supprimer un fichier · 160 gabarits.
- 22 · Installation & aide : 19 premier lancement complété · 19b Claude Code non connecté · 19c aide dépliée · 78 Claude Code introuvable ·
  76 Général (Application, Mises à jour, Sauvegardes, Commande kibo ; version de bureau) · 76b supprimer une sauvegarde · 76c sauvegarde en cours, dossier refusé ·
  112c menu de l'avatar, groupe Aide · 136 À propos · 137 Quoi de neuf · 137b aucune note · 138 Signaler un problème · 139 Raccourcis (dialogue `⌘/`).
- 23 · Didacticiel : 140 proposition · 140b reprendre · 141 étape 1 et panneau · 142 étape 2, graphe · 143 étape 3, note · 144 étape 4, disposition ·
  145 étape 5, assigner à l'agent de démonstration · 145b question de l'agent · 145c étape 6, composant · 146 terminé · 146b supprimer la démo.
- 24 · Maquettes Figma & Penpot : 16 Intégrations, lignes Figma et Penpot · 16b menu de la ligne Penpot · 53 Connecter Figma, jeton · 53b serveur MCP ·
  53c jeton refusé · 147 Connecter Penpot · 147b jeton refusé · 147c adresse invalide · 147d déconnecter · 148 widget Maquette · 148b périmé, hors ligne ·
  148c vide et erreurs · 149 réglages du widget · 149b URL invalide · 4 fiche ticket, section Maquettes · 4b URL refusée, aperçu absent.

## Exporter

1. PDF : dans le plugin, `await storage.exportPage("00")` … jusqu'à la dernière page dessinée, `("24")` aujourd'hui (une page par appel ; pour une page chargée, `await storage.exportPart("12", 0, 4)` par tranches), puis
   `scripts/build-pdf.sh` → `design/pdf/kibo-design-{sombre,clair}.pdf`.
2. Source : menu du fichier → Exporter (.penpot), puis `scripts/pack-penpot.sh <fichier>` → `kibo.penpot.xz` (sans les vignettes des boards,
   que Penpot régénère : l'archive reste sous la limite de 100 Mo de GitHub).
