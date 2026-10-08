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
