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
| 14 · Finitions UI | 98–106 (phase 9, vague 1 : fiche ticket, menus, confirmations) ; **dessinés : 98 à 101d**, 102 à 106b à dessiner |
| 15 · Projets & réglages | 107–112 (vague 2 : projet, workspace, apparence, historique, avatar) ; **à dessiner** |
| 16 · Tickets & boîte de réception | 113–115, 125, 126 (vague 3) ; **à dessiner** |
| 17 · Composants & synchronisation | 116–120 (vague 3 ; 116 amendé en vague 4) ; **à dessiner** |
| 18 · Agents, code & démarrage | 121–124 (vague 3) ; **à dessiner** |
| 19 · Formats & créations | 127–135 (vague 4) ; **à dessiner** |
| 20 · Notes, graphe & disposition | 150–155 (phase 12) ; **à dessiner** |
| 21 · Composants riches | 30b, 156–160 (phase 13) ; **à dessiner** |
| 22 · Installation & aide | 19, 19b, 19c, 78, 76, 76b, 76c, 112c, 136–139 (phase 14) ; **à dessiner** |
| 23 · Didacticiel | 140–146 (phase 14) ; **à dessiner** |
| 24 · Maquettes Figma & Penpot | 16, 16b, 53, 53b, 53c, 147, 148, 149, 4, 4b (phase 15) ; **à dessiner** |

Pages 15 à 24 : scripts écrits, pas encore créées dans le fichier Penpot. Les PDF et `kibo.penpot.xz` s'arrêtent à la page 13.

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
storage.load = async (n) => new Compartment({ storage, penpot, penpotUtils, setTimeout, fetch, console, Promise })
  .evaluate("(async()=>{" + await (await fetch("http://127.0.0.1:8787/" + n)).text() + "\n})()");
for (const n of ["01-core", "02-icons", "03-shell", "04-components", "05-tabs", "06-export", "07-data", "08-extra"]) await storage.load(n + ".js");
```

Écrans 32+ : `08-extra.js` (shell reconstruit, menus, alertes, tableaux, `S.relight` + `S.fixLightX`), puis un script par page
(`09-agents`, `10-code`, `11-composants`, `12-integrations`, `13-ia`, `14-sync`, `15-complements`, `16-integrations-suite`) qui définit `S.draw[n]()`.

Écrans 98+ (scripts écrits ; seuls 98 à 101d ont été exécutés) : charger aussi `18-socle.js` puis `17-finitions` et `19-projets-reglages` … `23-formats-creations`. Un écran y est le clone d'une
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

## Phases 12 à 15 (pages 20 à 24)

Scripts écrits d'après la spec (§18 à §21), `packages/ui/src/i18n` et les captures `screens/` ; jamais exécutés. Même mécanique que les pages 15 à 19
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

1. PDF : dans le plugin, `await storage.exportPage("00")` … jusqu'à la dernière page dessinée, `("13")` aujourd'hui (une page par appel ; pour une page chargée, `await storage.exportPart("12", 0, 4)` par tranches), puis
   `scripts/build-pdf.sh` → `design/pdf/kibo-design-{sombre,clair}.pdf`.
2. Source : menu du fichier → Exporter (.penpot), puis `scripts/pack-penpot.sh <fichier>` → `kibo.penpot.xz`.
