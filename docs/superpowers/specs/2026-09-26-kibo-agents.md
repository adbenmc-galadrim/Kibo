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
- **Question** : l'agent appelle l'outil MCP **`mcp__kibo__ask_user`** (servi par `kibo-hook mcp`, autorisé par `permissions.allow`), qui répond « question transmise, termine ton tour ». Le hook `PostToolUse` de cet outil porte la question ; une fin de tour propre avec une question en attente donne `waiting_input` (le créneau est libéré). La réponse remet le run **en tête de file, prioritaire**, puis `--resume <sessionId>` avec la réponse comme prompt. Depuis le 2 octobre, l'utilisateur peut aussi écrire à un run terminé (§13).
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
- **Règles** (données, pas code) : « run lancé → En cours » depuis Backlog, À faire (déclenchée par le démon quand le processus de l'agent démarre, à chaque tour) ; « run terminé → En review » depuis Backlog, À faire, En cours (retirée des règles par défaut le 2 octobre, §13 : la fin d'un run ne change plus le statut) ; « PR ouverte → En review » depuis Backlog, À faire, En cours ; « PR mergée → Terminé » depuis Backlog, À faire, En cours, En review (phase 3) ; « tous les sous-tickets terminés → parent Terminé » depuis Backlog, À faire, En cours, En review (en cascade). Une règle ne met jamais « Bloqué » et ne touche jamais un ticket Bloqué ou Terminé : un statut manuel prime. L'édition des règles dans l'UI viendra plus tard.
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

## 13. Conversation avec un run et passage en review (décision d'Adam, 2 octobre)

Demande : « si un agent a des questions, on doit pouvoir y répondre ; le statut du ticket ne passe en review qu'à la demande de l'utilisateur ; le chat doit toujours être ouvert, ou alors on doit pouvoir répondre ou interagir avec l'agent ». Ces décisions amendent §3, §7 et §8.

- **Écrire à un run terminé** : `answerRun` est accepté dans l'état `waiting_input` (inchangé) et dans les états `done`, `failed` et `cancelled` d'un run de ticket dont la session a démarré au moins une fois (`startedAt` non nul). Le run reprend le même chemin qu'une réponse : `queued` en tête de file, prioritaire, puis `--resume <sessionId>` avec le message comme prompt, dans le même espace de travail. C'est le même run (même identifiant, même étiquette, jetons cumulés) ; chaque tour passe par la file. Refus en `INVALID_TRANSITION` : un run qui n'a jamais démarré (par exemple `WORKSPACE_FAILED`), un run sans ticket (profils système : un brouillon de composant garde sa propre révision, spec IA), un run qui n'est pas le dernier run de son ticket (deux sessions ne travaillent pas dans le même worktree), et un run en file ou en cours.
- **Pendant qu'un tour tourne** (`queued`, `starting`, `running`) : la zone de saisie reste affichée mais désactivée, avec l'aide « L'agent travaille : écris-lui à la fin de son tour, ou arrête-le. ». L'envoi d'un message pendant un tour viendra dans une prochaine PR.
- **Une question en texte libre** (l'agent finit son tour par une question sans appeler `mcp__kibo__ask_user`) donne toujours `done` : aucun modèle n'interprète le texte (zéro token pour l'état). L'utilisateur y répond par la zone de saisie, comme ci-dessus.
- **Journal lisible comme une conversation** : le dernier message de l'agent à chaque fin de tour et chaque message de l'utilisateur sont affichés en entier dans le journal du tiroir (texte sur plusieurs lignes, jamais coupé à une ligne).
- **Statut du ticket** : la règle par défaut « run terminé → En review » est retirée. À la fin d'un run, le ticket reste dans son statut (« En cours » en général). Le passage en review est une action de l'utilisateur : un bouton « Passer en review » dans le détail du run (tiroir), affiché quand le ticket du run est en Backlog, À faire ou En cours, qui envoie la commande de changement de statut existante ; le Kanban et la fiche du ticket restent utilisables comme avant. Le déclencheur `run_done` reste dans le schéma (une règle enregistrée dans un projet continue de s'appliquer). Les règles « PR ouverte → En review » et « PR mergée → Terminé » ne changent pas (point pour Adam : faut-il aussi retirer « PR ouverte → En review » ?).
- **Interface** : la zone de saisie du tiroir s'affiche pour tout run de ticket ; libellé « Répondre » quand le run attend une réponse, « Écrire à l'agent » sinon ; orange réservé à l'envoi (§8). Un run non reprenable (jamais démarré, ou remplacé par un run plus récent du même ticket) n'a pas de zone de saisie.
- **Précisions après relecture** :
  - *Run reprenable* : état terminal, run de ticket, `startedAt` non nul, plus grand `seq` du couple (projet, ticket), processus du tour précédent sorti, profil toujours présent. Le démon calcule la liste et l'expose dans `AgentsState.resumable` ; `answerRun` applique la même règle.
  - L'étiquette est recalculée à l'admission : le créneau du profil peut changer d'un tour à l'autre.
  - Un message dont le tour est arrêté ou interrompu avant le lancement de l'agent n'est pas remis à l'agent ; il reste dans le journal.
  - Le message de fin de tour affiché dans le journal vient du résultat de la sortie du processus (`exited.result`, complet) ; le détail des hooks reste borné à 2 000 caractères (§3).
  - « Passer en review » n'est proposé qu'à qui peut modifier le projet.
  - Données (§4) : un journal contenant `answered` après un état terminal ne se rejoue pas sur un démon plus ancien (`STORE_CORRUPT` au démarrage) ; pas de retour à une version antérieure sans perdre ces runs.
  - Projets partagés (§7) : la règle est appliquée par le pair qui fait tourner l'agent ; un pair resté sur une version plus ancienne passe encore ses tickets en review à la fin de ses propres runs. Pas de divergence du CRDT.
  - Points pour Adam, défaut actuel conservé : `assignAgent` accepte un ticket qui a déjà un run non terminé (deux sessions peuvent partager le worktree) ; `answerRun` ne vérifie pas le droit d'écriture sur un projet partagé passé en lecture seule (les runs sont locaux à la machine).

## 14. Décisions de la phase 10 (suivis après v1.1)

Écrites le 2026-10-03 avec la spec de conception §17 ; elles amendent §6, §8 et §13.

### 14.1 Causes distinctes d'un run échoué

- `prepareWorkspace` distingue les causes au lieu d'un `WORKSPACE_FAILED` unique : `PROJECT_FOLDER_MISSING` (projet sans dossier local, profils `worktree` et `repo`) ; `PROJECT_FOLDER_NOT_FOUND` (dossier configuré absent ou qui n'est pas un dossier ; détail : le chemin) ; `NOT_A_REPO` (dossier qui n'est pas un dépôt git, profil `worktree`) ; `GIT_FAILED` (git a refusé : `worktree add`, `info/exclude`, chemin `.kibo/worktrees/<clé>` occupé par autre chose qu'un worktree). `WORKSPACE_FAILED` ne reste que pour les défauts internes (clé de ticket invalide, fichier de contexte hors du dossier du run). `run.error` garde la forme `CODE: détail`.
- Interface (`fr.agents.errors`, même texte dans la notification d'échec, l'historique et le journal) : `PROJECT_FOLDER_MISSING` « projet sans dossier local », `PROJECT_FOLDER_NOT_FOUND` « dossier du projet introuvable », `NOT_A_REPO` « le dossier du projet n'est pas un dépôt git », `GIT_FAILED` « git n'a pas pu préparer l'espace de travail » ; « espace de travail indisponible » ne reste que pour `WORKSPACE_FAILED`.

### 14.2 Durée affichée d'un run

`RunView` gagne deux champs dérivés du journal par la machine à états (aucun changement des événements ni de `runs.db`) : `activeMs`, somme des durées des tours terminés (de `spawned` à `exited`, `failed` ou `cancelled`), et `turnStartedAt`, début du tour en cours (`null` hors tour). La durée affichée (tiroir, historique, files d'attente) vaut `activeMs + (now − turnStartedAt)` : le temps en file et le temps mort entre deux tours (y compris `waiting_input`) n'y entrent pas. Un run jamais démarré affiche « - » comme aujourd'hui.

### 14.3 `assignAgent` : ordre des contrôles

`assign` vérifie le profil, le ticket et sa clé, puis le droit d'écriture sur le projet (`AgentDataPort.assertWritable`, même garde que les commandes : `FORBIDDEN` sur un projet partagé en lecture seule), écrit l'assigné sur le ticket, et met le run en file **en dernier**. Une RPC refusée ne laisse donc aucun run en file ; si la mise en file échoue après l'écriture (base indisponible), le ticket reste assigné sans run, ce qui est visible et réversible.

### 14.4 Écrire à un run pendant son tour (remplace le deuxième point de §13)

- `answerRun` est accepté dans tous les états d'un run **de ticket**, sauf un run terminé non reprenable (§13) ; un run sans ticket n'accepte toujours qu'une réponse à sa question (`waiting_input`). Pendant `queued`, `starting` ou `running`, le message est **mis en attente** : il est journalisé aussitôt (`answered`, affiché dans le journal comme un message de l'utilisateur), s'ajoute aux messages déjà en attente (séparés par une ligne vide), et devient le prompt du **tour suivant** ; l'état et le rang du run ne changent pas. Le message n'est jamais injecté dans la session en cours (Claude Code ne lit pas d'entrée pendant un tour).
- **Fin du tour.** Quand le processus sort alors qu'un message attend, le run ne reste pas `done`, `failed` ni `waiting_input` : le démon applique l'événement `requeued { rank }` (tête de file, prioritaire, même mécanique que la réponse à une question) et le tour suivant démarre par `--resume` avec les messages en attente comme prompt, que le tour finisse propre, en question ou en échec. Un tour qui finit par une question alors qu'un message attend prend ce message comme réponse (aucune interprétation : zéro token pour l'état). Un run en file pour son **premier** tour qui reçoit un message démarre avec le brief suivi du message.
- **Arrêt.** `cancelled` et `failed` (décision du démon : arrêt par l'utilisateur, redémarrage) effacent le message en attente : il n'est pas remis à l'agent et reste dans le journal (précision de §13 conservée). Un run `queued` conservé au redémarrage garde son message.
- **Interface.** La zone de saisie n'est plus désactivée pendant un tour : libellé « Écrire à l'agent », aide « L'agent travaille : ton message lui sera remis au début de son prochain tour. », le message envoyé apparaît dans le journal ; « Arrêter » reste. Le journal masque `requeued` comme `enqueued` et `admitted`.
- **Files d'attente** (phase 11) : la ligne d'un run remis en file pour un tour suivant dit pourquoi il reprend : « réponse reçue · reprise de la session » quand il reprend pour répondre à une question de l'agent (réponse en `waiting_input`, ou message en attente quand le tour finit par une question), « message reçu · reprise de la session » quand un message relance un run terminé ou suit un tour fini sans question. Un premier tour en file garde sa raison d'attente, même avec un message. Pour que la file le sache sans interpréter le journal, `question` reste portée par la vue du run de la remise en file (`answered`, `requeued`) jusqu'au début du tour suivant (`spawned`), qui l'efface ; la colonne « En attente de réponse » et les notifications ne lisent `question` qu'en `waiting_input`.
- **Données** (§4) : un journal contenant `requeued` ne se rejoue pas sur un démon plus ancien (`STORE_CORRUPT` au démarrage), comme pour `answered` après un état terminal.

### 14.5 Attente de verrou et délai du hook

`busy_timeout` reste à 5 s (spec de conception §17.2) : un seul démon par `KIBO_HOME` retire le cas qui faisait durer l'attente.

### 14.6 Run interrompu par un redémarrage du démon (phase 11)

Au démarrage, un run laissé en `starting` ou `running` par le démon précédent reçoit l'événement `failed` (`INTERRUPTED: the daemon restarted during the run`) **daté du dernier événement de son journal**, et non de l'instant du redémarrage : sa fin (`endedAt`, `stateSince`) et sa durée (`activeMs`, §14.2) s'arrêtent à la dernière chose que le démon a vue de lui, jamais pendant le temps d'arrêt. La date est déterministe (lue dans `runs.db`), le journal reste ordonné par identifiant d'événement et aucun événement nouveau n'est introduit : les journaux écrits par un démon antérieur, dont le `failed` porte la date du redémarrage, se relisent sans changement et gardent la durée qu'ils affichaient. Un run `queued` ou `waiting_input` n'est pas touché (§14.4).

## 15. Décisions de la phase 14 : agent de démonstration

Écrites le 2026-10-04 (spec de conception §20.8). Le didacticiel assigne un ticket à un agent sans consommer de token.

- **Profil système `demo`** : `SYSTEM_PROFILE_IDS` gagne `"demo"` (nom `demo`, « Agent de démonstration » à l'écran, `permissionMode: "acceptEdits"`, `workspace: "isolated"`, `maxParallel: 1`, `subagents: []`), créé par `ensureSystemProfiles` comme `assistant` et `generateur` (spec IA I18). Il est le seul profil système **assignable à un ticket**, et seulement à un ticket d'un projet marqué `demo` (`project_settings`) : `assignAgent` répond `INVALID_INPUT` « the demo agent only works in the demo project » ailleurs ; l'inverse (un profil utilisateur sur un ticket de démonstration) reste permis.
- **Binaire** : pour un run du profil `demo`, le lanceur remplace `resolveClaudeBin` par `demoAgentBin()` : dans le binaire compilé, `<dossier de l'exécutable>/kibo-demo-agent` (troisième `externalBin`, compilé depuis `packages/daemon/src/agents/fake-claude.ts` par `build-sidecar.ts`) ; en développement, le script lui-même (exécutable, shebang `bun`). Variables ajoutées à l'environnement du run : `KIBO_FAKE_CLAUDE_SCENARIO=<KIBO_HOME>/demo-agent/routes.json`, `KIBO_FAKE_CLAUDE_STATE=<KIBO_HOME>/demo-agent/state`, `KIBO_FAKE_CLAUDE_FIXTURES=<KIBO_HOME>/demo-agent/fixtures`. Les scénarios et fixtures sont des constantes TypeScript du démon (`packages/daemon/src/demo/agent-scenarios.ts`) écrites sur disque avant le premier run (`ensureDemoAgentFiles`), en `0600` ; le faux `claude` apprend à résoudre `fixture` depuis `KIBO_FAKE_CLAUDE_FIXTURES` quand la variable est définie (sinon depuis `scenarios/ai/fixtures`, inchangé pour les tests). Le reste de la chaîne (hooks `kibo-hook`, jeton de run, transcript, file d'attente, créneaux, `waiting_input`, `--resume`) est strictement celui des vrais runs : le didacticiel montre le vrai Kibo.
- **Scénarios** : `ticket` (tour 1 : `SessionStart`, `PreToolUse`/`PostToolUse` `Read` de `brief.md`, question « Faut-il aussi mettre à jour la documentation ? » par `mcp__kibo__ask_user` ⇒ `waiting_input` ; tour 2 après la réponse : `Write` de `notes-de-l-agent.md` dans l'espace isolé, `Stop`, `result` « Terminé : j'ai relu le ticket et noté le plan dans notes-de-l-agent.md », `tokens: 0`, `total_cost_usd: 0`) et `component` (le scénario `generate-ok` des tests avec la fixture « Graphique d'avancement » du gabarit `chart`, `tokens: 0`). Le routage se fait par sous-chaîne du prompt (« Écris le composant Kibo » et « Modifie le composant Kibo » ⇒ `component`, repli `ticket`) ; le scénario choisi est mémorisé par session, donc une révision ou une correction en `--resume` rejoue `component`.
- **Brouillons du projet de démonstration** (décision du lead, 2026-10-04, après la relecture de T6) : un brouillon de composant dont le `projectId` est un projet marqué `demo` est généré par `kibo-demo-agent` sous le **profil `demo`** (pas `generateur`), pour la génération, la modification, les révisions et les corrections : la démo ne consomme jamais de token et fonctionne sans `claude`. Le démon décide seul d'après `project_settings` (`isDemoProject`), jamais d'après un drapeau de l'interface. Contrat (spec IA §15) : `StartComponentDraftInput` (`create` et `modify`) gagne `projectId?: string`, `ComponentDraft` gagne `projectId: string | null` (persisté, colonne ajoutée à `component_drafts`) ; `AgentRunRequest.profileId` admet `"demo"` ; `launchDraft` pose `profileId: isDemo ? "demo" : "generateur"` ; `requireGenerator` ne vérifie ni `AiStatus.available` ni `profiles.generateur` pour un brouillon de démonstration (la chaîne d'outils `@kibo/sdk` reste exigée : la validation en a besoin). Le choix du binaire reste le seul `profile.id === "demo"` du lanceur : aucun drapeau `demo` sur les tâches. La garde du brouillon (§7 de la spec IA) et la garde de l'espace de démonstration s'appliquent toutes deux, le refus l'emporte.
- **Honnêteté** : `RunView.costUsd` et `tokens` valent 0 ; l'interface affiche « Agent de démonstration · aucun token consommé » sur le profil, dans « Assigner » et dans le tiroir ; la sonde `claude` ignore le profil `demo` (`AiStatus.profiles` ne le liste pas) et un run de démonstration fonctionne sans `claude` installé.
- **Sécurité** : `kibo-demo-agent` refuse `--dangerously-skip-permissions` (déjà le cas du faux `claude`), ne lit que le brief et n'écrit que dans l'espace isolé du run (`<KIBO_HOME>/runs/<id>/workspace`) ; les gardes `PreToolUse` du démon s'appliquent (un `Write` hors espace est refusé et journalisé) ; la garde de démonstration n'autorise la lecture de `brief.md` (hors cwd) que pour un run de ticket, un brouillon n'en a pas. Le binaire est signé avec l'application (ad hoc sur macOS, spec de conception §20.1).

## 16. Décisions de la phase 16 : filtre de projet sur les pages Agents et Files d'attente

Écrites le 2026-10-06 (spec de conception §22.5), étendues le même jour à la page Files d'attente sur réponse d'Adam ; elles amendent §5 (« réordonner »), §8 et §11 (« Historique ») sans toucher au cycle d'un run ni aux RPC.

- **Filtre** : en tête de la page Agents (écran 13 ⇒ 162), à droite du sous-titre, et en tête de la page Files d'attente (écran 17 ⇒ 163), au-dessus de la capacité, le **même** menu déroulant à choix unique (`DropdownMenuRadioGroup`, comme le filtre de source de la Marketplace) : « Tous les projets » puis chaque projet de `listProjects` dans l'ordre de la barre latérale, avec sa pastille de couleur ; libellé du bouton « Projet : tous » ou « Projet : <nom> », `aria-label` « Filtrer par projet » ; clavier Radix (flèches, Entrée, Échap). Textes dans `packages/ui/src/i18n/fr-agents-page.ts` (différé).
- **Mémoire** : `localStorage["kibo.agents.project"]` = `"*"` ou identifiant de projet (`usePref`, comme `kibo.components.sort`), **une seule préférence pour les deux pages** ; un identifiant absent de la liste vaut « tous » à l'affichage sans réécrire la préférence (le projet peut revenir par la synchronisation).
- **Portée** : `projectRuns(runs, projectId)` (pur) garde les runs du projet ; s'appliquent au filtre : page Agents, compteurs « En file » et « En attente », runs actifs des cartes de profil, historique (avant le filtre d'état et la recherche) ; page Files d'attente, listes « En cours » et « En file » de chaque colonne de profil, sous-agents (projet du run parent), colonne « En attente de réponse », ordre des colonnes (`orderProfiles` sur les runs visibles). **Globaux** : places (compteur et cartes « Place n »), jauges CPU et RAM, compteur `n/max` de chaque colonne de profil, tokens du jour, numéros de file `#n`. Sous un projet, la page Files d'attente affiche en tête « Places, CPU et RAM : toute la machine · les numéros de file comptent tous les projets. ». Un run `projectId: null` (création de composant) n'apparaît que sous « Tous les projets ».
- **Réordonner sous un filtre** (amende §5) : déposer un run sur un run visible lui prend sa place dans la file entière (`moveRun` avec l'index global du run visé, inchangé) ; « Monter » et « Descendre » visent la position du **voisin visible** précédent ou suivant (`queueNeighbours(visibleQueue, runId)`, pur) et sont désactivés sans voisin ; le `#n` affiché reste la position globale. Sans filtre, le comportement est identique à aujourd'hui.
- **Colonne « Projet »** (amende §11 « Historique ») : sous « Tous les projets », l'historique gagne une colonne « Projet » entre « Ticket » et « Profil » (pastille de couleur et nom ; « — » si le run n'a pas de projet ou si le projet n'est plus dans `listProjects`) ; sous un projet, la colonne est masquée.

## 17. Décisions de la phase 17 : worktree configurable, mode `auto`, un run par ticket (spec de conception §23)

Écrites le 2026-10-06 ; elles amendent §2 (lancement), §6 (espaces de travail) et §7 (profils) sans toucher au cycle d'un run, aux hooks ni à la file.

- **Espaces de travail** (amende §6, détail en conception §23.4) : la stratégie `worktree` lit les réglages locaux du projet `WorktreeSettings { baseRef, pathTemplate, setup }` (défauts `main`/`HEAD`, `.kibo/worktrees/{slug}`, aucune commande : comportement actuel inchangé). Branche = `git_branch` du ticket, sinon la clé en minuscules ; base = `git_branch.base`, sinon `baseRef`. Un worktree existant au chemin calculé est adopté ; sinon `git fetch` de la base distante, `git branch --no-track`, puis `git worktree add` ou la commande `setup` (`sh -c`, racine du dépôt, 10 min, `KIBO_BRANCH`, `KIBO_WORKTREE`, `KIBO_TICKET`, sortie dans `<run>/setup.log`). Tout échec est un `GIT_FAILED` ou `WORKSPACE_FAILED` explicite. Les réglages ne quittent jamais la machine (`ProjectSettings`, comme le dossier local d'un projet partagé).
- **Mode `auto`** (amende §2 et §7, conception §23.5) : `PermissionMode = default | acceptEdits | plan | auto` ; `auto` est passé tel quel au CLI qui le liste ; `--permission-prompts none` reste : une action jugée risquée est refusée et comptée dans `denied`. `bypassPermissions` et `dontAsk` restent des arguments réservés. Un profil gagne `allow: string[]` (50 règles au plus, `Outil` ou `Outil(motif)`, `Bash` nu, `Bash(*)` et toute règle contenant `dangerously` refusés à la validation), ajoutées à `permissions.allow` du `--settings` après `mcp__kibo__ask_user`. Dialogue de profil : option « Automatique (l'agent décide, sans contournement) » et champ « Autorisations » (une règle par ligne).
- **Durcissement** (tâche T9, conception §23.4 et §23.5) : `isSafeAllowRule` refuse aussi `Outil(*)` et `Outil(**)` pour tout outil, et pour `Bash` les enveloppes qui reviennent au shell entier (motif qui commence par `*`, premier mot shell ou enveloppe d'exécution, chemin vers un shell, glob qui peut les désigner, affectation en tête). `setup` refuse une variable entre guillemets simples. L'exécution de `setup` journalise deux événements `setup` (`running`, puis `done`/`failed` avec la durée), affichés « Préparation : … ». La fenêtre « Assigner » montre la base et le chemin calculé du worktree.
- **Un run par ticket** (conception §23.8) : `assignAgent` et `previewAssign` refusent (`CONFLICT`) quand un run non terminal (`queued`, `starting`, `running`, `waiting_input`) existe pour le ticket ; la fenêtre « Assigner » affiche « Un run de ce ticket est déjà en cours ou en file. » et désactive le lancement.
- **Brief** (amende §2 « contexte matérialisé ») : `brief.md` gagne `- Branche : <branche> (base <base>)` quand le ticket porte une `git_branch`, et `- Étiquettes : …` quand il en a.
