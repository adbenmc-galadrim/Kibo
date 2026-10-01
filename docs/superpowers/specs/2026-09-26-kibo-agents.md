# Kibo — complément de spec : agents (phase 2)

- **Date** : 2026-09-26
- **Complète** : `2026-09-25-kibo-design.md` §5 (données hors CRDT), §7 « Orchestration des agents », §8 (écrans 5, 13, 14, 17, 27, 28), §10 (sécurité), §11 (tests).
- **Plan** : `docs/superpowers/plans/2026-09-26-kibo-agents.md`.

La spec générale prime. Ce document fixe les points qu'elle laisse ouverts ; chaque décision est la plus simple et la plus sûre.

## 1. Faits vérifiés sur Claude Code 2.1.283

Vérifiés le 2026-09-26 avec `claude --help`, la documentation officielle (hooks, headless, settings, MCP) et des lancements réels hors ligne : `ANTHROPIC_BASE_URL` pointé sur un serveur local qui répond 401, `CLAUDE_CONFIG_DIR` temporaire. Aucun token consommé.

| Sujet | Fait |
|---|---|
| Headless | `-p` avec `--output-format stream-json --verbose` : une ligne `system/init`, puis une ligne `result` (`is_error`, `result`, `session_id`, `total_cost_usd`, `usage`, `permission_denials`, `terminal_reason`). Cette ligne est identique à la sortie de `--output-format json`. |
| Prompt | lu sur l'entrée standard ; si l'entrée n'est pas fermée, le CLI attend 3 s puis avertit. |
| Session | `--session-id <uuid>` fixe l'id d'une nouvelle session ; `--resume <id>` reprend. |
| Réglages | `--settings` accepte un JSON en ligne ou un chemin. |
| Permissions | l'aide liste `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan` ; `default` est encore accepté (alias de `manual`) mais n'est plus listé. `--permission-prompts none` retire l'outil `AskUserQuestion` (vérifié : absent de la liste d'outils). |
| Consignes | `--append-system-prompt-file` ajoute le fichier au prompt système (marqueur retrouvé dans la requête API). |
| MCP | `--mcp-config` en JSON en ligne démarre un serveur stdio ; l'outil apparaît sous le nom `mcp__<serveur>__<outil>`. |
| Hooks « commande » | déclenchés en mode `-p` (`SessionStart`, `UserPromptSubmit`, `StopFailure`, `SessionEnd` observés) ; ils héritent de l'environnement du processus (`KIBO_RUN_TOKEN` vu). Entrée JSON : `session_id`, `transcript_path` (`<CLAUDE_CONFIG_DIR>/projects/<cwd, caractères non alphanumériques → ->/<id>.jsonl`), `cwd`, `hook_event_name`, `source`, `reason`, `error`, `last_assistant_message`, `permission_mode`, `agent_id` / `agent_type` (parfois `null`). |
| Hooks « http » | déclenché pour `SessionEnd` (avec interpolation de variable d'environnement), **pas** pour `SessionStart` : on n'utilise que des hooks « commande ». |
| `Notification` | non documenté en mode `-p` ; on ne s'y fie pas. |
| Environnement | un démon lancé depuis une session Claude Code hérite de `CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_EFFORT`… qui modifient l'agent : on les retire. |
| Usage | `usage` du transcript non garanti : les tokens viennent de la ligne `result`, le transcript sert de repli. |

Version minimale : **2.1.259** (première avec `--permission-prompts`).

## 2. Lancement d'un run

- Commande : `claude -p --output-format stream-json --verbose [--permission-mode <m>] --permission-prompts none --model <opus|sonnet|haiku> --settings <json> --mcp-config <json> --append-system-prompt-file <run>/CLAUDE.md [arguments d'appel] (--session-id <uuid> | --resume <uuid>)`, prompt sur l'entrée standard, dans le dossier de l'espace de travail.
- **Mode de permission** : lu dans `claude --help` une fois par binaire ; `default` est passé tel quel s'il est listé, sinon `manual` ; aide illisible ⇒ pas d'option pour `default`. Un mode refusé par le CLI fait échouer le run avec un message clair.
- **Arguments réservés** : `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--permission-mode`, `--permission-prompts`, `--settings`, `--mcp-config`, `--session-id`, `--resume` et toute valeur contenant `bypassPermissions` sont refusés dans les arguments d'appel (`INVALID_INPUT`).
- **Contexte matérialisé** dans `~/.kibo/runs/<runId>/` (dossier `0700`, fichiers `0600`) : `CLAUDE.md` (guidelines + « Protocole Kibo »), `brief.md` (ticket, description, sous-tickets, dépendances, consignes), `context/<n-portée>/<chemin>.md`. Le prompt du premier tour est le brief ; celui d'une reprise est la réponse de l'utilisateur.
- **Binaire** : `--claude-bin` du démon, sinon `PATH` puis `~/.local/bin`, `~/.claude/local`, `/opt/homebrew/bin`, `/usr/local/bin` (l'app Tauri lancée depuis le Finder n'a pas le `PATH` du shell) ; introuvable ⇒ run `failed` (`AGENT_CLI_NOT_FOUND`).
- **Groupe de processus** : chaque agent est lancé dans son propre groupe ; annulation, échec et arrêt du démon tuent le groupe entier.

## 3. Hooks, jeton et question

- Hooks « commande » sur les neuf événements (`SessionStart`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStart`, `SubagentStop`, `StopFailure`, `SessionEnd`), `timeout` 10 s. La commande est le petit exécutable **`kibo-hook event`** (compilé avec le démon, déclaré dans `externalBin`) : il lit l'entrée sur stdin, la réduit (outil, détail court, question, sous-agent ; jamais de contenu de fichier ni de résultat d'outil) et la poste sur `http://127.0.0.1:<port>/hooks/<runId>` avec `Authorization: Bearer <jeton>`. Il sort toujours avec 0 ou 1, jamais 2 (qui bloquerait l'agent).
- **Jeton** : 32 octets aléatoires par lancement de processus, transmis par `KIBO_RUN_TOKEN` (jamais sur la ligne de commande) ; le démon garde son SHA-256 en mémoire et dans `runs.db` (`run_tokens`, append-only). Un hook n'est accepté que si le processus du run est vivant et que le hachage correspond (comparaison à temps constant). La route `/hooks/<uuid>` échappe au cookie et à l'`Origin` mais pas au contrôle `Host`.
- **Question** : l'agent appelle l'outil MCP **`mcp__kibo__ask_user`** (servi par `kibo-hook mcp`, autorisé par `permissions.allow`), qui répond « question transmise, termine ton tour ». Le hook `PostToolUse` de cet outil porte la question ; une fin de tour propre avec une question en attente donne `waiting_input` (le créneau est libéré). La réponse remet le run **en tête de file, prioritaire**, puis `--resume <sessionId>` avec la réponse comme prompt.
- **Garde-fou `PreToolUse`** (point d'extension pour la phase 6) : un appelant peut fournir une fonction déterministe `(outil, entrée) → allow | deny | rien`. `kibo-hook` joint alors l'entrée de l'outil, coupée (2 000 caractères par chaîne, 20 entrées, deux niveaux), et recopie sur sa sortie la décision renvoyée par le démon au format Claude Code (`hookSpecificOutput.permissionDecision`). Pour **tous** les runs, un `PreToolUse` qui n'a pas pu joindre le démon est refusé (fail-closed, sans variable d'environnement). Une exception du garde-fou vaut refus.
- Les sous-agents sont suivis par `SubagentStart` / `SubagentStop` (type et depuis quand) ; ils n'ont pas de créneau. La liste « Sous-agents autorisés » du profil est écrite dans `CLAUDE.md`, pas imposée techniquement (le CLI n'offre pas de filtre fiable).

## 4. Données des runs

- `~/.kibo/runs.db` (SQLite WAL, `0600`) séparé de `kibo.db` : tables `runs`, `run_events`, `run_tokens` protégées par des triggers append-only ; `host_settings` (clé → JSON) modifiable. L'état d'un run est le repli de ses événements (`enqueued`, `admitted`, `spawned`, `hook`, `exited`, `answered`, `cancelled`, `failed`, `reranked`, `prioritized`) par une machine pure ; une transition refusée n'écrit rien (`INVALID_TRANSITION`).
- Un run peut exister **sans ticket** (`projectId`, `ticketId`, `ticketKey` nuls ; `ticketTitle` porte le titre du travail) : dossier, arguments, variables et garde-fou fournis par l'appelant restent en mémoire. Un tel run perdu par un redémarrage échoue (`INTERRUPTED`) au lieu de repartir sans eux. Sa ligne `result` brute est conservée (`output`).
- **Redémarrage** : un run `starting` ou `running` passe `failed` (`INTERRUPTED`) ; son agent orphelin est tué si `ps` montre encore une ligne de commande contenant l'id de session du run (jamais un pid réutilisé). Les runs `queued` et `waiting_input` sont conservés. `stop()` du démon tue les agents sans écrire leur fin, pour que le redémarrage les marque de la même façon.
- Tokens du jour : somme des `exited` depuis minuit local.

## 5. File d'attente

- Ordre : rang croissant puis numéro de run (FIFO) ; réordonner calcule un rang entre les voisins ; « prioritaire » = marque + tête de file ; retirer la marque ne déplace pas.
- Admission, dans l'ordre : pause manuelle, seuil CPU, seuil RAM (raison globale), puis profil supprimé, créneaux du profil, créneaux hôte ; un run bloqué n'empêche pas un run suivant d'un autre profil d'être admis.
- Créneaux hôte par défaut : `max(1, min(8, ⌊cœurs/2⌋, ⌊Go/5⌋))` (3 pour 8 cœurs et 16 Go) ; réglages hôte (créneaux, seuils, pause) dans `host_settings`, locaux à la machine. Affichage : « Créneaux hôte : 3 (auto : 8 cœurs, 16 Go) » tant que la valeur est automatique, « Créneaux hôte : 3 (fixé · auto : 5) » une fois fixée.
- Mesure : CPU = part occupée entre deux échantillons (toutes les 2 s) ; RAM = `memory_pressure -Q` sur macOS (`os.freemem()` y compte le cache comme utilisé : 96 % mesurés), `MemAvailable` de `/proc/meminfo` sur Linux.
- Étiquette d'un run : `<profil>-<créneau du profil>` (`opus-dev-2`) une fois admis, le nom du profil en file.

## 6. Espaces de travail

- `worktree` (défaut) : `<racine du dépôt>/.kibo/worktrees/<clé en minuscules>`, branche `<clé en minuscules>` créée depuis `main` (sinon `HEAD`) ou réutilisée ; `.kibo/` ajouté une fois à `.git/info/exclude` (local, jamais commité). `repo` : le dossier du projet. `isolated` : `~/.kibo/runs/<runId>/workspace`. Projet sans dossier local ⇒ `WORKSPACE_FAILED` pour `worktree` et `repo`. La fenêtre « Assigner » le dit avant le lancement : pour un projet sans dossier local et un profil `worktree` ou `repo`, elle explique quoi faire (choisir un dossier dans les réglages du projet, ou un profil en dossier isolé) et désactive le lancement ; le démon garde le même refus.
- **Écart assumé à la maquette 28** : elle propose « Lecture seule » ; la spec §7 prévoit repo / worktree / dossier isolé. On garde la spec (« Dossier isolé » remplace « Lecture seule ») ; la lecture seule s'obtient avec le mode de permission `plan`.

## 7. Profils, domaines, guidelines, règles

- Profils, domaines et guidelines dans les docs Loro (workspace ; guidelines de portée projet dans le doc du projet) ; règles dans le doc du projet (`rules`), valeurs par défaut sinon.
- Portées de guidelines : workspace → projet → domaine → **profil** (ajout : « Guidelines supplémentaires » de la maquette 28). Chemin : minuscules, chiffres, `-`, `_`, sous-dossiers, extension `.md`, sans `..`. Estimation affichée : `⌈caractères / 4⌉` tokens.
- Noms de profil : `^[a-z0-9][a-z0-9-]{0,31}$`, uniques. Modèles : alias `opus`, `sonnet`, `haiku` (la version suit le CLI). Mode d'exécution : `cli` seul ; « Agent SDK » affiché désactivé (« bientôt »).
- Supprimer un profil qui a des runs actifs est refusé (`PROFILE_IN_USE`) ; supprimer un domaine utilisé par des tickets est refusé. Supprimer l'un ou l'autre supprime ses guidelines.
- Couleur d'un nouveau domaine : palette `#14B8A6, #6366F1, #EC4899, #B45309, #64748B, #84CC16, #D946EF`, dans l'ordre de création.
- **Règles** (données, pas code) : « run lancé → En cours » depuis Backlog, À faire (déclenchée par le démon quand le processus de l'agent démarre, à chaque tour) ; « run terminé → En review » depuis Backlog, À faire, En cours ; « PR ouverte → En review » depuis Backlog, À faire, En cours ; « PR mergée → Terminé » depuis Backlog, À faire, En cours, En review (phase 3) ; « tous les sous-tickets terminés → parent Terminé » depuis Backlog, À faire, En cours, En review (en cascade). Une règle ne met jamais « Bloqué » et ne touche jamais un ticket Bloqué ou Terminé : un statut manuel prime. L'édition des règles dans l'UI viendra plus tard.
- Assigner un ticket fixe son assigné à `{ kind: "agent", ref: <profil> }` ; le statut ne change pas à l'assignation, seulement au lancement puis à la fin du run, par les règles.

## 8. Interface

- Barre des agents toujours visible en bas du contenu, dépliable en tiroir (écran 5) ; Files d'attente (écran 17), Agents (écran 13) et Domaines & guidelines (écran 14) sont des routes (`#/agents/queue`, `#/agents`, `#/settings/domains`) ; « Paramètres » n'active que « Domaines & guidelines » dans cette phase.
- Couleurs d'état : `starting`/`running` bleu, `waiting_input` ambre, `queued` cyan `#06B6D4`, `done` vert, `failed` rouge, `cancelled` zinc ; orange réservé aux actions d'agent (« Répondre », « Envoyer », « Mettre en file »).
- En-tête du shell (écrans 5, 17) : actions de l'écran, « + Ticket » (nouveau ticket dans le projet courant, c'est-à-dire le dernier projet ouvert ; absent tant qu'aucun projet n'a été ouvert), la cloche, puis l'avatar aux initiales de l'utilisateur de la session (deux premiers mots, sinon deux premières lettres).
- Réordonner : glisser-déposer (`@dnd-kit/core`, déjà utilisé par le Kanban) et menu accessible (Monter, Descendre, Prioritaire, Retirer de la file).
- Journal : le tiroir masque `PreToolUse` (doublon de `PostToolUse`), les événements internes (`enqueued`, `admitted`) et les réordonnancements. Un seul `SessionStart` par tour (le lancement, « brief.md + n guidelines chargés », absorbe le hook), un seul `Stop` (le hook) ; la sortie du processus n'ajoute une ligne (`exited`) que si elle échoue (rouge) ou si des actions ont été refusées (ambre). La couleur suit l'événement, jamais l'état final du run : outils et `SessionStart` en bleu, question en ambre, `Stop` en vert, `StopFailure` et échecs en rouge, `SessionEnd` et actions de l'utilisateur en gris.
- Écarts assumés aux maquettes 13 et 5 : les lignes « Déclencheur » et « Rôle » des cartes de profil et le résultat détaillé d'un run (« Review postée · PR #15 ») viennent avec l'éditeur de règles et les intégrations.
- **État du run sur les cartes** (Kanban, Tickets) : entité en lecture seule `run` du SDK (`reads: ["run"]`), un `TicketRun` par ticket (`ticketId`, `runId`, `label`, `state`, `position` en file) pour le dernier run du ticket, rafraîchi sur le sujet `agents`. Badge neutre (pas orange) : icône agent, nom du run, pastille de couleur d'état, état court (« En file #2 », « Attend », « Échec ») ; sans run actif, le nom de l'agent assigné seul.
- Événements WebSocket : `{ projectId }`, `{ topic: "agents" | "config" }` (regroupés à 50 ms) et `{ type: "run.changed", runId, state }` à chaque changement d'état d'un run.

## 9. Notifications

- App Tauri : le démon, lancé avec `KIBO_NATIVE_NOTIFY=1`, écrit `KIBO_NOTIFY {json}` sur sa sortie ; la coque Rust l'affiche avec `tauri-plugin-notification`. Aucune capacité n'est donnée à la fenêtre.
- Navigateur : API `Notification` après un clic explicite sur la cloche (« Activer les notifications ») ; notifications sur l'entrée en `waiting_input`, `done` et `failed`.
- Barre des agents : la pastille « Démon local » suit l'état réel du WebSocket (`client.online()`/`onConnection` du SDK) ; hors connexion, pastille rouge et « Démon injoignable ».
- Sidebar : « Files d'attente » est une sous-entrée d'« Agents », visible quand un écran agents est ouvert.

## 10. Risques connus

- L'agent peut lire son propre jeton dans son environnement et poster de faux hooks pour **son** run : ces hooks ne changent jamais l'état (seules la fin du processus et les RPC le font) ; ils peuvent seulement ajouter une question ou une ligne de journal.
- Les hooks de l'utilisateur (`~/.claude/settings.json`) s'exécutent aussi : un hook bloquant de l'utilisateur peut bloquer un agent.
- Mode `plan` et outil MCP de question : à vérifier sur un vrai run ; en cas de refus, la question passe par `permission_denials` et le run finit en `done` sans question.
- `tauri-plugin-notification` sous Linux dépend de `notify-rust` / D-Bus : sans service de notification, l'affichage échoue (journalisé), le reste fonctionne.
- Seuil CPU en CI : un runner chargé peut retenir un run en file, même avec des seuils à 100 % (une charge saturée les atteint). Les tests E2E lancent donc le démon avec une charge fixe, `--host-load 62,70` (CPU et RAM en %, valeurs de l'écran 17), à la place de la mesure réelle ; les seuils gardent leurs valeurs par défaut.
- La détection du binaire compilé (`/$bunfs`) pour trouver `kibo-hook` à côté du démon est vérifiée par le smoke Tauri.

## 11. Décisions de la phase 9, vague 3

Écrites le 2026-10-01 avec la spec de conception §15 ; elles amendent §8 et §9 sans changer le cycle d'un run.

- **Tickets de la boîte de réception** (spec de conception §15.1) : `assignAgent` et `previewAssign` sur `projectId = "inbox"` répondent `INVALID_INPUT` (« inbox tickets cannot be assigned to an agent ») avant toute lecture du ticket ; un run n'a jamais `projectId = "inbox"`. L'interface ne propose « Assigner à un agent » que pour un ticket d'un projet ; pour un ticket de la boîte, elle propose « Rattacher à un projet… ».
- **En-tête** (amende §8) : « + Ticket » est toujours visible ; sans projet courant, le dialogue présélectionne la boîte de réception.
- **Historique** (amende §8, écran 13) : une ligne de l'historique de la page Agents ouvre le run dans le tiroir (même mécanisme que la cloche, spec de conception §14.5) ; filtre par état et recherche par clé ; quand `getRunLog` répond `NOT_FOUND` ou une liste vide, le tiroir affiche « Journal indisponible pour ce run. ». Arrêter un run, le retirer de la file et supprimer un profil sont confirmés (spec de conception §15.2).
- **Vocabulaire** (amende §9) : la pastille de la barre des agents dit « Kibo · connecté » ou « Kibo · hors ligne » ; « créneaux » devient « places » ; les modes de permission ont un libellé en français ; le mot « run » est conservé et expliqué sur la page Agents.

## 12. Décisions de la phase 9, vague 4

Écrites le 2026-10-01 avec la spec IA §13 ; elles amendent §7 et la décision IA I18.

- **Profils système** : `maxParallel` d'un profil système est modifiable (1 à 4, `INVALID_INPUT` au-delà) ; `generateur` vaut 2 par défaut à la création du profil (deux créations de composant en parallèle quand les créneaux hôte et les seuils le permettent ; un workspace existant garde sa valeur et peut la monter dans la fiche du profil), `assistant` reste à 1. Un brouillon de plus attend en file ; la page Files d'attente et la barre des agents le montrent comme tout run sans ticket (« Composant <titre> »). Une valeur stockée hors bornes (au-delà de 4) est ramenée au défaut du profil au démarrage. Aucune migration ne remonte un workspace existant de 1 à 2 : la fiche du profil le propose.
