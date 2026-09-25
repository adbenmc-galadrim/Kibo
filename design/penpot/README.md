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
for (const n of ["01-core", "02-icons", "03-shell", "04-components", "05-tabs", "06-export", "07-data"]) await storage.load(n + ".js");
```

Utiles : `S.screen(n, clair)`, `S.relight(id)`, `S.retext(frame)`, `S.setText(t, "…")`, `S.fillKanban(content)`, `S.newScreen(base, nom)`.

Pièges :
- `penpot.openPage` avant toute modification (`S.screen` / `S.open` le font).
- Changer un texte ou cloner un écran ne recalcule pas son rendu : `S.setText` / `S.retext` (sinon l'export garde l'ancien texte ou l'ancienne couleur).
- Dans un conteneur flex, `appendChild` ne réordonne pas : créer sans parent puis `parent.insertChild(i, shape)`.
- Un appel est limité à 120 s : traiter un ou deux écrans par appel.

## Exporter

1. PDF : dans le plugin, `await storage.exportPage("00")` … `("06")` (une page par appel), puis
   `scripts/build-pdf.sh` → `design/pdf/kibo-design-{sombre,clair}.pdf`.
2. Source : menu du fichier → Exporter (.penpot), puis `scripts/pack-penpot.sh <fichier>` → `kibo.penpot.xz`.
