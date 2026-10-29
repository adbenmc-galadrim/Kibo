# CLI `kibo`

Page de référence de la commande `kibo` : lire et écrire les tickets, les fonctionnalités, les sprints et les questions d'un projet Kibo depuis un terminal, appliquer un plan d'un bloc, et parler directement à l'API du démon pour le reste. Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md`, §34 et §48.

Les exemples utilisent le projet fictif « Silo » (clé `SILO`).

## Accès au démon

La CLI parle au démon Kibo local (l'application Kibo doit être ouverte) :

1. elle lit le port dans `$KIBO_HOME/daemon.json` et le jeton d'appairage dans `$KIBO_HOME/token` (`KIBO_HOME` vaut `~/.kibo` par défaut ; `--home <dossier>` le remplace) ;
2. elle s'appaire (`POST /api/pair`) et reçoit un cookie de session ;
3. elle envoie ses requêtes à `POST /api/rpc` ;
4. elle ferme sa session à la fin, même en cas d'erreur.

Le jeton n'apparaît jamais dans une sortie. Démon absent : « Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie. » (sortie `1`).

Depuis le dépôt, la commande se lance par `bun packages/cli/src/bin.ts <portée> …` ; `kibo --help` et `kibo <portée> --help` donnent l'usage.

## Résolution du projet

`--project <p>` accepte la clé du projet (`SILO`, casse ignorée), son nom exact ou son id. Pour les commandes qui portent sur un ticket, il est facultatif :

- une clé préfixée suffit (`SILO-12` désigne le projet `SILO`) ;
- sinon, le dossier courant, s'il est le dossier d'un projet (ou un de ses sous-dossiers) ;
- une clé de fonctionnalité (`F12`) ne suffit pas : elle existe dans chaque projet, donnez `--project`.

`--project` est **obligatoire** pour `tickets list`, `sprints …`, `questions answer` et `plan export`. Pour `features create`, `tickets create` (dont la cible `--feature F…` ne porte pas de préfixe) et `plan apply`, il est facultatif quand le dossier courant désigne un projet.

## Vocabulaire

- **Ticket racine** : un ticket sans parent.
- **Fonctionnalité** : un ticket racine qui regroupe des étapes. Sa clé courte est `F<n>` (`F1`, `F2`…), attribuée par Kibo dans l'ordre. `kibo features create` en crée une.
- **Étape** : un enfant d'une fonctionnalité, avec une clé du projet (`SILO-12`). Une étape peut être **facultative** : elle ne compte pas dans l'avancement de sa fonctionnalité.
- **Sprint** : il se pose **sur la fonctionnalité**, et ses étapes en héritent. On ne pose pas de sprint sur une étape : pour changer le sprint d'une étape, posez-le sur sa fonctionnalité, ou déplacez l'étape dans une autre fonctionnalité.
- **Dépendance** : `A bloque B` veut dire que B attend A. Voir « Sens des liens » plus bas.

## Lire

```
kibo projects list [--json]
kibo projects get <clé|nom|id> [--json]
kibo tickets list --project <p> [--ready] [--status <s>[,<s>…]] [--sprint <id|code|nom|current|none>] [--feature <F|clé>] [--label <a[,b]>] [--fields <champs>] [--json]
kibo tickets get <clé|id du plan> [--project <p>] [--json]
kibo sprints list --project <p> [--json]
kibo questions list <clé> [--all] [--project <p>] [--json]
kibo plan export [--md] --project <p>
```

- **`tickets list`** : une ligne par ticket, ou un tableau JSON. Chaque ticket a `key`, `id`, `planId`, `title`, `status` (normalisé : `todo`, `wip`, `done`, `blocked`), `kiboStatus`, `column`, `blockedReason`, `parent`, `children`, `deps` (les tickets qui le **bloquent**), `pr`, `assignee`, `branch`, `labels`, `sprint` (sprint effectif, hérité de la fonctionnalité), `feature`, `optional`, `onHold`, `startable`, `startReason`…
  - `--ready` : à faire, sans enfant, toutes ses dépendances terminées ;
  - `--status` : statuts normalisés ou de Kibo (`backlog`, `todo`, `in_progress`, `in_review`, `blocked`, `done`), séparés par des virgules ;
  - `--sprint` : id, code, nom, `current` ou `none` ;
  - `--feature F5` : la fonctionnalité et ses étapes (une clé d'étape est refusée : donnez la fonctionnalité) ;
  - `--label area:web,area:api` : les tickets qui portent au moins une de ces étiquettes ;
  - `--fields key,title,status,sprint` : seulement ces champs, dans cet ordre (tous les champs de `list`, plus `sprint` = code du sprint et `feature` = clé de la fonctionnalité). Sans `--json`, un en-tête puis une ligne par ticket, colonnes séparées par des tabulations.
- **`tickets get`** : les champs de `list`, plus la description complète, les questions ouvertes, les notes qui citent le ticket et le brief.
- **`questions list`** : les questions non archivées du ticket (`--all` ajoute les archivées) : `#n [état] titre → destinataire`, puis les options.
- **`plan export`** : le plan du projet en Markdown, sans date, sur la sortie standard. Une section par sprint, une sous-section par fonctionnalité, une case par étape (`[x]` terminée, `[~]` en cours ou en review, `[⏸]` en attente, `[ ]` sinon), avec ce qu'elle attend. Pour tenir un `plan.md` à jour : `kibo plan export --project SILO > plan.md`.

```markdown
## S1 · Import (2026-11-02 → 2026-11-13, prévu)

### F1 · Import des relevés — à faire (0/1)

- [ ] SILO-1 Lire le fichier — À faire
- [ ] SILO-2 Contrôler les lignes — À faire · attend SILO-1 · facultative
```

## Écrire

Toutes les écritures passent par la même API que l'interface (méthode `command`), au nom de l'utilisateur de la machine. Sans `--json`, une ligne `✓ …` ; avec `--json`, l'objet créé ou modifié, relu après l'écriture (un ticket a la forme de `tickets list`).

Textes (`--description`, `--append`, `--prepend`, `--context`) : le texte donné, `@fichier` (chemin relatif au dossier courant, UTF-8) ou `@-` (entrée standard).

### Fonctionnalités et étapes

```
kibo features create "<titre>" [--sprint <S>] [--description <texte|@fichier|@->] [--labels a,b] [--project <p>] [--json]
kibo tickets create "<titre>" --feature <F|clé> [--description …] [--labels a,b] [--optional] [--project <p>] [--json]
kibo tickets update <clé> [--title <t>] [--description …|--append …|--prepend …] [--labels a,b] [--project <p>] [--json]
kibo tickets move <clé> --feature <F|clé> [--project <p>] [--json]
```

- `features create` crée un ticket racine à clé `F<n>` ; `--sprint` y pose le sprint (id, code ou nom).
- `tickets create` crée une étape sous la fonctionnalité `--feature` (clé courte `F5` ou clé du ticket racine) ; `--optional` la marque facultative.
- `tickets update` : `--description` remplace la description ; `--append` ajoute un paragraphe à la fin, `--prepend` au début (séparés par une ligne vide ; sur une description vide, le texte seul). Les trois s'excluent. `--labels` remplace toutes les étiquettes ; `--labels ""` les retire.
- `tickets move` déplace une étape sous une autre fonctionnalité. Une fonctionnalité ne se déplace pas sous un autre ticket.

```sh
kibo features create "Import des relevés" --sprint S1 --project SILO
# ✓ F1 créée : Import des relevés · S1
kibo tickets create "Lire le fichier" --feature F1 --project SILO
kibo tickets update SILO-1 --append @notes/detail.md
```

`--append` et `--prepend` lisent la description courante puis la réécrivent : une modification faite entre les deux, dans l'interface par exemple, serait écrasée.

### Dépendances

```
kibo tickets link <A> --blocks <B> [--project <p>] [--json]
kibo tickets unlink <A> <B> [--project <p>] [--json]
```

`link A --blocks B` : **A bloque B**, B attend A. A apparaît dans les `deps` de B.

```
SILO-1 --blocks--> SILO-2      SILO-2 attend SILO-1 ; deps de SILO-2 = [SILO-1]
```

`unlink A B` retire le lien « A bloque B ». Un lien qui créerait un cycle est refusé : `link SILO-2 --blocks SILO-1` après l'exemple ci-dessus répond « Cette dépendance créerait un cycle : SILO-2 dépend déjà de SILO-1. »

### Sprints

```
kibo sprints create <code> [--name <nom>] --start AAAA-MM-JJ --end AAAA-MM-JJ --project <p> [--json]
kibo sprints update <code> [--code <c>] [--name <n>] [--start <d>] [--end <d>] --project <p> [--json]
kibo sprints assign <F> <S|--none> --project <p> [--json]
```

- `create` : le nom vaut le code par défaut ; la fin ne peut pas précéder le début.
- `assign F1 S1` pose le sprint `S1` sur la fonctionnalité `F1`, et donc sur toutes ses étapes ; `--none` le retire. Sur une étape, la commande refuse sans rien écrire et dit quoi faire :

```sh
kibo sprints assign SILO-1 S1 --project SILO
# Le sprint d'une étape vient de sa fonctionnalité : posez S1 sur F1.
```

### Questions

```
kibo questions add <clé> "<titre>" --option "A" [--option "B"…] [--context …] [--recipient <nom|id>] [--provisional "A"] [--blocking] [--project <p>] [--json]
kibo questions answer <id|n°> "<réponse>" --project <p> [--json]
```

- `add` : au moins une `--option` ; `--provisional` doit être une des options ; `--recipient` désigne un destinataire du projet par son nom ou son id ; `--blocking` marque la question comme bloquante.
- `answer` : la question par son numéro (`3` ou `#3`, comme dans `questions list`) ou son id. Une réponse égale à une option est enregistrée comme ce choix ; sinon comme une réponse libre.

## Appliquer un plan : `kibo plan apply`

```
kibo plan apply <fichier.yaml|json> [--dry-run] [--project <p>] [--json]
```

Le plan est un fichier YAML (ou JSON pour un `.json`) : un `summary` facultatif et une liste `actions`. On y décrit d'un coup les fonctionnalités, les étapes, les dépendances, les sprints et les questions, avec des références `new:<n>` vers les tickets créés plus haut dans le même fichier. Exemple commenté : [`cli-plan-exemple.yaml`](cli-plan-exemple.yaml).

1. **`--dry-run`** valide le plan et affiche une ligne par action, avec les clés que prendront les tickets créés. Rien n'est écrit.
2. **Sans `--dry-run`**, le plan est validé en entier puis appliqué dans l'ordre.

```
$ kibo plan apply docs/cli-plan-exemple.yaml --dry-run --project SILO
Plan : Tournée et dépôt des relevés
1. crée le sprint S2 « Tournée » du 2026-11-16 au 2026-11-27
2. crée la fonctionnalité « Tournée et dépôt » → F2
3. crée l'étape « Préparer la tournée » sous new:1 (→ F2) → SILO-3
…
6. new:2 (→ SILO-3) bloque new:3 (→ SILO-4)
…
8. pose S2 sur new:1 (→ F2)
10 actions, rien n'est écrit (--dry-run).
```

Règles :

- **Tout ou rien à la validation** : une seule action invalide (référence inconnue, cycle, sprint sur une étape, statut inconnu…) et rien n'est écrit ; la sortie liste les problèmes (`#id type : message`) et sort en `1`.
- **Arrêt à la première erreur à l'exécution** : si une action échoue malgré la validation, le plan s'arrête ; les actions suivantes sont ignorées, la sortie dit ce qui a déjà été créé (`Créés : new:1 → F2, new:2 → SILO-3`) et sort en `1`. Il n'y a pas de transaction : ce qui précède reste écrit. Retirez du fichier ce qui est passé avant de le relancer (relancer un fichier recrée ses tickets).
- **Clés prédites** : les clés de `--dry-run` sont celles que prendront les tickets si rien d'autre n'écrit dans le projet entre-temps ; ce n'est pas une réservation. Elles sont inconnues (`(clé inconnue)`) sur un projet qui reçoit ses clés du serveur de synchronisation.
- Le plan est refusé sur un projet en lecture seule et sur la boîte de réception.
- `--json` écrit l'aperçu (`PlanPreview`) ou le résultat (`PlanOutcome`) ; les codes de sortie restent les mêmes.

### Format des actions

Chaque action a un `type` ; `id` (entier) et `why` (texte court) sont facultatifs : sans `id`, l'action prend sa position (donnez un `id` à toutes les actions, ou à aucune). Au plus 500 actions. Un ticket se désigne par sa clé (`SILO-12`, `F3`) ou par `new:<n>`.

| `type` | Champs | Effet |
|---|---|---|
| `createTicket` | `ref: new:<n>`, `title`, `feature?: true`, `parent?`, `description?`, `labels?`, `statusId?`, `blockedReason?` | `feature: true` crée une fonctionnalité (sans `parent`) ; avec `parent`, une étape |
| `updateTicket` | `ticket`, `title?`, `description?`, `labels?`, `parent?` | remplace les champs donnés |
| `setStatus` | `ticket`, `statusId`, `blockedReason?` | change le statut (`blocked` demande une raison) |
| `setHold` | `ticket`, `reason` (`null` lève l'attente) | met une étape en attente |
| `link` | `from`, `to`, `kind: blocks` | **`from` bloque `to`** |
| `unlink` | `from`, `to`, `kind: blocks` | retire le lien |
| `createSprint` | `code`, `name`, `start`, `end` (`AAAA-MM-JJ`) | crée un sprint |
| `setSprint` | `ticket` (une fonctionnalité), `sprint` (code, ou `null`) | pose ou retire le sprint |
| `createQuestion` | `ticket`, `title`, `options?`, `provisional?`, `context?`, `blocking?`, `recipient?` | pose une question |
| `answerQuestion` | `questionId`, `answer: { kind: option, option }` ou `{ kind: text, text }` | répond à une question existante |
| `updateQuestion`, `reopenQuestion`, `deleteQuestion` | `questionId`, … | modifie, rouvre ou supprime une question existante |
| `addRecipient` | `name` | ajoute un destinataire de questions au projet |

Une étape facultative ne s'exprime pas dans un plan : créez-la ensuite avec `kibo tickets create … --optional`, ou marquez-la par la commande `setTicketOptional` (voir l'API).

## Codes de sortie

| Code | Sens |
|---|---|
| `0` | Succès |
| `1` | Erreur : démon absent, projet ou ticket introuvable, écriture refusée, plan invalide ou arrêté. Le message est sur la sortie d'erreur ; une erreur sans traduction s'écrit `Erreur <CODE> : <détail>`. |
| `2` | Usage : commande, option ou valeur manquante ou inconnue. L'usage est rappelé. |

Les erreurs connues disent quoi faire, par exemple « Une fonctionnalité est un ticket racine : elle ne se déplace pas sous un autre ticket. », « Ce lien existe déjà. », « Le statut bloqué demande une raison (reason=…). », « Le code S1 est déjà pris par un autre sprint. ».

## `kibo rpc` : l'échappatoire

```
kibo rpc '<json>' | @fichier | @-
```

Envoie la requête telle quelle à `POST /api/rpc`, avec l'appairage et la fermeture de session gérés par la CLI, et écrit le `result` en JSON indenté. Rien n'est validé côté CLI : le démon vérifie la requête. Une erreur du démon s'écrit `Erreur <CODE> : <message>` (sortie `1`) ; un JSON illisible est une erreur d'usage (`2`).

```sh
kibo rpc '{"method":"listProjects"}'
kibo rpc '{"method":"getProject","projectId":"<id du projet>"}'
```

## L'API derrière la CLI

Tout ce que fait la CLI passe par l'API HTTP du démon, sur `127.0.0.1` uniquement. Pour un script, `kibo rpc` évite de gérer l'appairage ; voici ce qu'il fait.

### Appairage et session

`POST /api/pair` avec le jeton de `$KIBO_HOME/token` répond `204` et pose un cookie de session `kibo_session` (`HttpOnly`). L'en-tête `Origin` doit être l'adresse du démon (`http://127.0.0.1:<port>`), sinon la requête est refusée (`403`). Un jeton faux répond `401`.

```sh
PORT=$(jq .port ~/.kibo/daemon.json)
BASE=http://127.0.0.1:$PORT
curl -s -c /tmp/kibo.cookies -X POST "$BASE/api/pair" \
  -H "Origin: $BASE" -H "Content-Type: application/json" \
  -d "{\"token\":\"$(cat ~/.kibo/token)\"}"
```

Chaque appairage ouvre une session, visible dans le menu de l'utilisateur (**Sessions**). Fermez-la à la fin : `listSessions` donne la session courante (`current: true`), `revokeSession { id }` la ferme.

### `POST /api/rpc`

Le corps est une requête `{ "method": "…", … }` ; la réponse est `{ "ok": true, "result": … }` ou `{ "ok": false, "error": { "code": "…", "message": "…" } }`. Les codes d'erreur sont stables (`NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `READ_ONLY`…).

```sh
rpc() { curl -s -b /tmp/kibo.cookies -X POST "$BASE/api/rpc" \
  -H "Origin: $BASE" -H "Content-Type: application/json" -d "$1"; }
rpc '{"method":"listProjects"}'
rpc '{"method":"getProject","projectId":"<id du projet>"}'
```

`getProject` rend l'instantané du projet : `tickets` (avec `id`, `key`, `shortKey`, `parentId`, `effectiveSprintId`, `waitingOn`…), `links`, `sprints`, `questions`, `nextTicketKey`, `viewer`.

### La méthode `command`

Toutes les écritures passent par une seule méthode : `{ "method": "command", "projectId": "<id>", "command": { "method": "<commande>", … } }`. La commande est une `ProjectCommand` (`packages/schema/src/command.ts`). Les commandes désignent les tickets, sprints et questions par leur **id** (champ `id` de `getProject` ou de `kibo tickets get --json`), jamais par leur clé.

```sh
rpc '{"method":"command","projectId":"<id du projet>","command":{"method":"createTicket","title":"Import des relevés","feature":true}}'
```

Commandes utiles pour mettre un projet au plan :

| Commande | Champs | Résultat |
|---|---|---|
| `createTicket` | `title`, `feature?`, `parentId?`, `description?`, `statusId?`, `blockedReason?`, `assignee?`, `labels?` | le ticket créé, avec sa clé (`F<n>` pour `feature: true`, sinon `SILO-<n>`) |
| `updateTicket` | `ticketId`, `title?`, `description?`, `labels?`, `assignee?`, `domainId?`, `shortKey?` | remplace les champs donnés (toute la description) |
| `moveTicket` | `ticketId`, `parentId`, `index?` | déplace le ticket sous `parentId` |
| `setStatus` | `ticketId`, `statusId`, `reason?` | change le statut (`blocked` demande `reason`) |
| `addLink` | `from`, `to`, `type: "blocks"` | le lien créé : **`from` bloque `to`** |
| `removeLink` | `linkId` | retire le lien (`links` de `getProject` donne son id) |
| `createSprint` | `code`, `name`, `start`, `end` | le sprint créé |
| `updateSprint` | `sprintId`, `patch: { code?, name?, start?, end? }` | modifie le sprint |
| `setTicketSprint` | `ticketId` (une fonctionnalité), `sprintId` ou `null` | pose ou retire le sprint |
| `setTicketOptional` | `ticketId` (une étape), `optional` | marque l'étape facultative |
| `setHold` | `ticketId`, `reason` ou `null` | met une étape en attente, ou lève l'attente |
| `createQuestion` | `ticketId`, `title`, `options?`, `provisional?`, `context?`, `blocking?`, `recipient?`, `createdBy: { kind: "human", ref }` | la question créée |
| `answerQuestion` | `questionId`, `answer: { kind: "option", option }` ou `{ kind: "text", text }`, `by: { kind: "human", ref }` | la question répondue |

Ce qu'il faut savoir :

- **Sens des liens** : `addLink { from: A, to: B, type: "blocks" }` veut dire **A bloque B**. B attend A : la clé de A figure dans `waitingOn` de B (`getProject`) et dans `deps` de B (`kibo tickets list`). Un lien en double, vers soi-même ou qui créerait un cycle est refusé.
- **Ticket racine** : un ticket sans parent (`parentId: null`). Une fonctionnalité est une racine à clé courte `F<n>`, créée par `createTicket { feature: true }` ; elle ne peut pas avoir de parent. Ses étapes sont ses enfants (`createTicket { parentId: <id de la fonctionnalité> }`).
- **Le sprint se pose sur la fonctionnalité** : `setTicketSprint` sur une fonctionnalité donne ce sprint à toutes ses étapes (`effectiveSprintId`). Sur une étape, il est refusé : `a step inherits the sprint of its feature: set it on F1` (posez-le sur `F1`).
- Une étape seule peut être facultative ou en attente ; une fonctionnalité ne peut être ni l'une ni l'autre.
- `createdBy` et `by` des questions sont réécrits par le démon avec l'utilisateur de la session.

### `previewPlan` et `applyPlan`

`kibo plan apply` lit le fichier, puis envoie ses actions au démon :

- `{ "method": "previewPlan", "projectId": "<id>", "actions": [...] }` → `{ ok: true, keys: { "new:1": "F2", … } }` ou `{ ok: false, problems: [{ actionId, type, message }] }` ;
- `{ "method": "applyPlan", "projectId": "<id>", "actions": [...] }` → `{ problems, results, created: [{ ref, ticketId, key }], stoppedAt }`. `problems` non vide : rien n'a été écrit. `stoppedAt` : l'`id` de l'action qui a échoué, ou `null`.

Les actions sont celles du tableau « Format des actions », avec `id` et `why` obligatoires dans l'API (la CLI les complète).
