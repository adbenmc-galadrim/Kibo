# import-emis

Importe le projet Emis (`~/Documents/emis`) dans Kibo, par l'API publique du démon (spec §23.7). Le script ne dépend que de `@kibo/schema` : il lit les fichiers d'Emis, calcule un état désiré, le réconcilie avec le projet `EMIS` et n'envoie que des commandes publiques.

## Usage

```sh
bun run --cwd scripts/import-emis import -- --dry-run          # imprime le rapport et les commandes, n'écrit rien
bun run --cwd scripts/import-emis import -- --yes              # import réel dans ~/.kibo
bun run --cwd scripts/import-emis import -- --yes --archive    # puis archive les fichiers de pilotage (§23.10)
```

| Option | Défaut | Rôle |
|---|---|---|
| `--emis <dossier>` | `~/Documents/emis` | dossier d'Emis, lu en lecture seule |
| `--home <dossier>` | `$KIBO_HOME` ou `~/.kibo` | démon visé (`daemon.json` et `token`) |
| `--notes <dossier>` | `<emis>/kibo-notes` | dossier de notes du projet, hors dépôt |
| `--dry-run` | non | aucune écriture : ni démon, ni notes |
| `--no-gh` | non | ne lit pas l'état des PR par `gh` : elles sont importées `open`, sans `base` ni `head` |
| `--yes` | non | obligatoire pour écrire dans le vrai `~/.kibo` |
| `--archive` | non | déplace les fichiers de pilotage dans `<emis>/archive-<date>/` |

Le plan est validé avant toute écriture (invariants de `plan-check.mjs`) : une erreur arrête le script. Rejouer l'import ne crée ni ne modifie rien si les entrées n'ont pas changé ; rien n'est supprimé hors de la migration des questions (`orphan` et `drift` sont seulement listés). Une note modifiée dans Kibo depuis le dernier import n'est pas écrasée (empreintes dans `<notes>/.import-emis.json`).

**Kibo gagne** (spec §23.7) : titre, description, étiquettes, parent, statut (et raison de blocage) et branche d'un ticket sont posés à la création ; ensuite le script ne les réécrit que si Kibo a encore la valeur du dernier import et que le plan a changé. Sinon le rapport dit `status (Kibo)`, `title (Kibo)`… et rien n'est envoyé. Les valeurs importées sont mémorisées dans `<notes>/.import-emis-tickets.json`, écrit seulement après un import réel ; un ticket importé avant cette mémoire garde ses valeurs Kibo.

## Questions

Chaque arbitrage du plan (`arbitrages[].items[]`) devient une question Kibo (spec §23.12.7) : `importRef plan:Qn`, `blocking`, créée par `import:plan`, rattachée à la PR qu'elle bloque, sinon au ticket « Arbitrages ». La réponse vient de `tmp/reponses.json` (`answered`), ou vaut « Résolue dans le plan Emis » pour une question `resolved` ; elle naît non transmise et part avec le brief du premier run du ticket. Une question déjà répondue dans Kibo n'est jamais réécrite : Kibo gagne. Une question ne change jamais le statut d'un ticket : les PR gardent celui du plan.

**Migration** : les anciens sous-tickets `plan:Qn` et les groupes `plan:arbitrages/<groupe>` sont remplacés. La question est créée (réponse reprise de la section `## Réponse` du ticket si `reponses.json` n'en donne pas), les liens du ticket sont retirés, puis le ticket est supprimé et compté `migrated`. C'est la **seule suppression** du script, bornée à ces références ; un groupe qui porte un autre ticket est gardé (`drift`), un sous-ticket dont la question a quitté le plan est gardé (`orphan`). En `--dry-run`, chaque suppression est imprimée (`would delete ticket EMIS-12 · …`) sans être faite.

## Sauvegarde avant l'import réel

1. Sans `--dry-run`, le script demande d'abord une sauvegarde au démon (`createBackup`, raison `manual`).
2. Sur le vrai `~/.kibo`, il refuse de tourner sans `--yes` et imprime la copie à froid : quitter Kibo, `cp -Rp ~/.kibo ~/.kibo-avant-emis-<date>`, relancer Kibo.

## Ce que le script ne fait pas

- Les réglages de worktree du projet (base `origin/dev`, gabarit `../emis-{slug}`, commande `pnpm worktree {branch}`) : Adam les saisit dans « Modifier le projet ».
- L'arrêt d'`emis-board` (`launchctl unload` du LaunchAgent).
- La copie des README du dépôt : `pilotage/depot.md` liste seulement leurs chemins.
- La lecture des secrets d'Emis (`.env*`, `.board/`, `control.key`).

## Rebase (§39.3)

`rebase-emis.ts` recrée Emis sur un projet neuf : fonctionnalités `F1` à `F15` (C0 … CL), étapes `EMIS-1` à `EMIS-n` contiguës dans l'ordre fonctionnalité puis étape, titres sans préfixe de chapitre, étiquettes sans `sprint:*` ni `phase:*`, aucun `assignee`. « TODO » et « Arbitrages » ne sont pas recréés : leurs tickets rejoignent leur fonctionnalité (`src/rebase/todo-placement.ts`), DATA-1 et DATA-2 deviennent des questions au client, les questions suivent leur ticket (`src/rebase/question-placement.ts` pour les cas sans cible). Les sprints d'une semaine partent du lundi 2026-10-19 ; leur capacité est la vitesse observée (étapes `done` dont la PR est fusionnée, par semaine ISO, lue par `gh pr list --state merged`), 5 sans `gh` ou avec moins de deux semaines.

```sh
bun run --cwd scripts/import-emis rebase -- --dry-run                      # lit EMIS par getProject, écrit le rapport et le plan
bun run --cwd scripts/import-emis rebase -- --dry-run --no-gh              # vitesse par défaut (5)
bun run --cwd scripts/import-emis rebase -- --dry-run --from-list          # sans démon : lit tickets-list.json (aperçu, plan non applicable)
bun run --cwd scripts/import-emis rebase -- --apply --plan <export>/rebase-plan.json --yes
```

| Option | Défaut | Rôle |
|---|---|---|
| `--export <dossier>` | `~/Documents/emis/kibo-export-2026-10-18` | où lire l'export et écrire les fichiers |
| `--home <dossier>` | `$KIBO_HOME` ou `~/.kibo` | démon lu par `--dry-run`, écrit par `--apply` |
| `--no-gh` | non | ne lit pas les dates de fusion : vitesse 5 |
| `--from-list` | non | lit `<export>/tickets-list.json` (`kibo tickets list --json`) au lieu du démon : ni descriptions, ni questions, ni liens `relates` |
| `--plan <fichier>`, `--yes` | — | obligatoires pour `--apply` |

**`--dry-run`** n'écrit rien dans le démon. Il écrit `<export>/project-old.json` (le `getProject` de l'ancien projet), `<export>/rebase-report.md` (points « à placer », placement de TODO, ancienne clé ⇒ nouvelle clé · fonctionnalité · sprint, questions et cibles, liens tombés, vitesse et sa source, plan par sprint avec dates, comptes attendus) et `<export>/rebase-plan.json` (plan exact, empreinte sha256 du contenu de l'ancien projet). Une dépendance qui ferait un cycle entre fonctionnalités est ignorée dans le sens contraire à l'ordre du plan et listée « à placer ».

**`--apply`** (tâche T19) rejoue le plan relu, dans cet ordre : sauvegarde (`createBackup`) et export complet ⇒ vérification de l'empreinte du plan ⇒ répétition sur un démon temporaire ⇒ `deleteProject` de l'ancien ⇒ `createProject { setup }` ⇒ semis des commandes du plan ⇒ vérification contre `project-old.json`, puis `<export>/rebase-result.md`. Il refuse sans plan relu, avec une empreinte qui ne correspond plus, ou avec un point « à placer ». Tant que T19 n'est pas intégrée, `--apply` sort en code 2 sans rien écrire.

**Restauration à froid** (le démon n'a pas de RPC de restauration) : quitter Kibo, recopier dans `~/.kibo/` le contenu du dossier `~/.kibo/backups/<id>/` pris avant `--apply` (`kibo.db`, `runs.db`, `components/`, `notes/`), relancer Kibo. L'historique de l'agent de projet et le journal `project_events` de l'ancien projet ne sont pas transférés : ils restent dans la sauvegarde.
