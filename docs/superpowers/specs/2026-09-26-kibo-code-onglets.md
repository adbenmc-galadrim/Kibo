# Kibo — complément de spec : code et onglets (phase 3)

- **Date** : 2026-09-26
- **Complète** : `2026-09-25-kibo-design.md` §7 « Code, commits et PR », « Liens de fichiers », §8 (onglets, écrans 18, 20 à 23), §10.
- **Plan** : `docs/superpowers/plans/2026-09-26-kibo-code-onglets.md`.

La spec générale prime. Ce document fixe les points qu'elle laisse ouverts ; chaque décision est la plus simple et la plus sûre.

## 1. Accès au dépôt

- **Binaires** : `git` et `gh` lancés par `Bun.spawn`, arguments en tableau, jamais de shell. Chemins surchargés par `KIBO_GIT` et `KIBO_GH` (tests et E2E). Environnement : `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true`, `LC_ALL=C` ; lectures avec `GIT_OPTIONAL_LOCKS=0` (aucune écriture de `.git/index`, donc pas de boucle avec le watcher). Délai maximal : 30 s (lecture), 5 min (commit, crochets compris), 2 min (push, `gh`).
- **Worktrees autorisés** : le dépôt du projet est `git rev-parse --show-toplevel` du dossier du projet. Une requête ne vise qu'un worktree listé par `git worktree list --porcelain` de ce dépôt (comparaison des `realpath`). Un worktree d'agent situé hors du dossier du projet est donc accepté, parce qu'il est enregistré par le dépôt ; tout autre chemin est refusé (`PATH_OUTSIDE_PROJECT`).
- **Chemins de fichier** : relatifs au worktree, sans `..`, sans NUL, hors de `.git/` ; le `realpath` du plus proche parent existant doit rester dans le worktree. L'écriture refuse un lien symbolique. Les options venues de l'UI passent sous forme `--option=valeur` et les chemins après `--`.
- **Arguments** : la branche de base d'une PR doit figurer dans `git branch -r` ; les reviewers suivent le format de login GitHub.

## 2. État dérivé et watchers

- État = `git status --porcelain=v2 -z --branch --untracked-files=all` + `git diff --numstat -z` (indexé et non indexé) + commits.
- Watcher `fs.watch` récursif sur le worktree, non récursif sur son `git-dir`, récursif sur le `git-common-dir` ; debounce 150 ms ; événement WebSocket `{ type: "code", projectId, worktree, paths? }`. `paths` liste les chemins modifiés, relatifs au worktree (200 au plus), quand le watcher les connaît ; il est absent (« tout a pu changer ») pour un changement de l'état git, un sondage, une mutation ou au-delà de 200 chemins. L'aperçu d'un fichier ne se relit que si son chemin (ou un dossier parent) figure dans `paths`, ou si `paths` est absent. Si `fs.watch` échoue (limite inotify, système sans récursif), repli sur un sondage toutes les 3 s, journalisé.
- Un worktree est surveillé dès sa première lecture d'état, et libéré après 10 minutes sans lecture. Un worktree dont le dossier a disparu (événement, balayage périodique ou lecture) est libéré aussitôt, avec une seule ligne de journal ; il est de nouveau surveillé à la première lecture après sa réapparition.
- **Suivi des PR** : toutes les 60 s, pour chaque ticket portant une référence `github_pr` ouverte ou en brouillon, `gh pr view` met à jour son état (`open`, `draft`, `merged`, `closed`). `gh` absent : aucune mise à jour, erreur journalisée.

## 3. Commits

- **Non poussé** = accessible depuis `HEAD` mais depuis aucune branche distante : `git rev-list HEAD --not --remotes`. C'est plus strict que `@{u}..HEAD` (un commit présent sur n'importe quelle branche distante est considéré comme poussé) et cela fonctionne sans upstream.
- **Message pré-rempli** : la clé du ticket est lue dans le nom de branche (`kib-12`, `feat/KIB-12-schema`, insensible à la casse, clé du projet uniquement). Message : `feat: <titre> (<KEY>)`, où le titre perd sa première majuscule (sauf sigle) et une parenthèse finale ; corps : une puce par sous-ticket direct terminé. Pas de ticket reconnu ⇒ champ vide. Le scope (`feat(core)`) viendra du domaine du ticket quand les domaines exposent un libellé (phase 2).
- **Amend** : seulement si `HEAD` n'est pas poussé ; `git commit --amend -F -`. « Modifier » sur le dernier commit charge son message et coche l'amend.
- **Reformuler** : `HEAD` ⇒ `git commit --amend --only -F -` (l'index est conservé). Commit plus ancien ⇒ commit vide `amend! <sujet>` puis `git rebase -i --autosquash --autostash <sha>^` avec `GIT_SEQUENCE_EDITOR=true` ; l'index est sauvegardé avant (`git write-tree`) et restauré après (`git read-tree`), car l'arbre de `HEAD` ne change pas. Refusé si la plage contient un commit de fusion ou si une opération git est en cours (`GIT_BUSY`).
- **Annuler** (maquette 21) = `git reset --soft <sha>^` : le commit et les commits plus récents sont retirés de la branche, leurs modifications reviennent dans l'index. Rien n'est perdu, aucun conflit possible. Une confirmation indique le nombre de commits concernés. Commit racine : `git update-ref -d HEAD`.
- Un commit poussé n'est jamais modifié : le démon revérifie à chaque requête (`GIT_PUSHED`).
- **Générer avec Claude** : bouton affiché désactivé (« Bientôt ») ; il passera par la file d'attente des agents avec l'IA dans le produit (phase 6).
- **Conflit** : une opération en cours (rebase, fusion, cherry-pick, revert) est signalée par un bandeau avec « Abandonner » (`git <op> --abort`). La résolution se fait dans l'éditeur.

## 4. Indexation par bloc

- Le diff non indexé compare l'index au worktree ; le diff indexé, `HEAD` à l'index. « Indexer le bloc » applique le patch du bloc (`git apply --cached`), « Désindexer le bloc » l'applique à l'envers (`--reverse`).
- La requête porte l'en-tête `@@` du bloc : s'il ne correspond plus au diff recalculé, refus `GIT_STALE` et rechargement.
- Fichier non suivi, supprimé, binaire ou renommé : indexation par fichier seulement.

## 5. Édition

- Mode « Édition » du diff : CodeMirror 6 avec `@codemirror/merge` (unifié : `unifiedMergeView` ; côte à côte : `MergeView`, gauche en lecture seule). Original = version indexée (diff non indexé) ou `HEAD` (diff indexé).
- Enregistrement (`⌘S`) : écriture atomique (fichier temporaire puis `rename`, mode conservé), seulement si l'empreinte SHA-1 lue n'a pas changé (sinon `FILE_CHANGED`). Création de fichier non prise en charge. Taille maximale : 1 Mo.

## 6. Pousser et créer la PR

- « Pousser » : `git push -u <remote> <branche>` (remote de l'upstream, sinon `origin`), jamais de force.
- « Pousser et créer la PR » : pousse, puis `gh pr create --head --base --title --body-file - [--draft] [--reviewer]`. Seuls les commits poussés entrent dans la PR ; des fichiers indexés non commités déclenchent l'avertissement de la maquette 22 avec « Commiter d'abord ».
- Description par défaut : sections `## Ticket`, `## Changements` (sujets des commits de la branche), `## Sous-tickets` (cases cochées si terminé), `## Maquette` seulement si un lien Figma existe (phase 5).
- PR rattachée au ticket par `upsertExternalRef` (`{ kind: "github_pr", url, number, state }`, dédoublonné par URL). Une PR déjà ouverte pour la branche remplace le bouton par « Voir la PR #n ».
- **Règles** : créer une PR non brouillon liée à un ticket, ou voir (suivi) une PR liée passer de `draft` à `open`, déclenche `pr_opened` (règle par défaut : *En review* depuis Backlog, À faire, En cours) ; une PR créée en brouillon ne déclenche rien. Le suivi qui voit une PR passer à `merged` déclenche `pr_merged` (*Terminé* depuis Backlog, À faire, En cours, En review, puis cascade des parents). Une règle en échec est journalisée et ne fait échouer ni la création de la PR ni le suivi. La modale de PR signale la règle tant que `pr_opened` est active.
- **Agent dans le worktree** : un run `running` ou `waiting_input` dont le dossier de travail (`cwd` du run, chemin réel) est le worktree affiché ou l'un de ses sous-dossiers ajoute un bandeau ambré au-dessus du formulaire de commit. Un sous-dossier qui est lui-même un worktree (`.kibo/worktrees/…`) appartient à ce worktree, pas au worktree principal.

## 7. Onglets

- **Cibles** : `project`, `page`, `changes` (worktree), `file` (worktree, chemin, ligne), `ticket`, `screen` (écran hors projet : `agents`, `queue` pour les Files d'attente, `domains`). L'Accueil (Vue d'ensemble) est fixe et n'est pas stocké.
- **Écrans** : un écran est une cible comme les autres (spec générale §8) : la barre latérale et la palette l'ouvrent avec les règles d'ouverture ci-dessous, il a son onglet, son titre (« Agents », « Files d'attente », « Domaines & guidelines ») et sa place dans les récents. Adresses inchangées (`#/agents`, `#/agents/queue`, `#/settings/domains`). L'ajout de la cible est rétrocompatible : un état persisté avant elle reste valide ; un onglet dont la cible n'est plus reconnue est écarté à la lecture, les autres sont conservés.
- **Ouverture** : une cible déjà ouverte est activée. Sinon, un clic ordinaire remplace la cible de l'onglet actif, sauf si l'Accueil ou un onglet épinglé est actif (nouvel onglet). `⌘`-clic, clic du milieu et `⌘T` ouvrent un nouvel onglet.
- **Raccourcis** : `⌘` sur macOS, `Ctrl` ailleurs. `⌘1` = Accueil, `⌘2…8` = onglets dans l'ordre, `⌘9` = dernier onglet. `⌘W` ne ferme ni l'Accueil ni un onglet épinglé. Dans un navigateur, certains raccourcis restent pris par le navigateur ; ils fonctionnent dans la fenêtre Tauri.
- **Persistance** : un seul état `{ tabs, activeId, recents }` par workspace dans la table SQLite `local_state` du démon (hors CRDT), 50 onglets et 10 récents au plus, enregistré 300 ms après chaque changement. Deux fenêtres ouvertes : la dernière écriture gagne.
- **Titre** : « Projet · Page », « Projet · Changements », « Projet · KIB-12 », nom du fichier pour un fichier. Cible disparue : « Page introuvable », « Projet introuvable » ou « Ticket introuvable », l'onglet reste fermable.
- **Pastille** d'un onglet Changements : présente quand le worktree a des changements non commités.
- **Nouvelle fenêtre** : `window.open` de l'URL de l'onglet dans le navigateur ; entrée masquée dans Tauri (aucune capacité de fenêtre exposée).
- **Barre de titre Tauri** : la barre native reste en place (intégrer les boutons macOS exige une capacité `start-dragging`, hors périmètre de sécurité actuel).

## 8. Palette `⌘K`

- Groupes : Récents (requête vide), Tickets (4 premiers puis « + n autres »), Pages (dont les écrans Agents, Files d'attente et Domaines & guidelines), Projets, Actions (nouveau ticket, sous-ticket du ticket actif, nouvelle page, nouveau projet, changements du projet, thème).
- `↵` ouvre (ticket ⇒ onglet ticket), `⌘↵` ouvre un ticket dans le Sheet, `Tab` fait défiler le filtre Tout → Tickets → Pages → Projets → Actions. `⌘T` ouvre la palette en mode « nouvel onglet ».
- Thème : système → clair → sombre, préférence gardée dans `localStorage` (commodité propre au navigateur).
- Écart assumé à la maquette 22 : la case « Lancer <profil de review> sur la PR » vient avec l'éditeur de règles (comme le « Rôle » des profils, spec agents §8) ; l'emplacement `prOptions` reste vide.
- Groupe **Agents** (après Actions ; filtre `Tab` après Actions) : « Répondre à <agent> (<clé>) » pour chaque run en attente de réponse (ouvre le tiroir sur ce run), « Assigner <clé> à un agent… » pour le ticket actif (ouvre le dialogue d'assignation). Un ticket dont le run est en file affiche « En file #n » à la place de son statut.

## 9. Aperçu et liens de fichiers

- `FileLink` (SDK) reconnaît `chemin`, `chemin:ligne` et `chemin:ligne:colonne` ; `linkifyPaths` découpe un texte libre. Un composant ouvre un fichier par `sdk.openFile({ path, line })`, relatif au worktree principal.
- **Journal d'un run** : ses chemins s'ouvrent dans le worktree qui contient le dossier de travail du run (le plus profond, comme le bandeau du §6), même si l'agent travaille dans un sous-dossier. Un run `isolated` (hors dépôt) ou dont le dossier n'appartient à aucun worktree du projet affiche ses chemins en texte simple.
- Aperçu : Shiki (moteur d'expressions régulières JavaScript, sans WebAssembly, compatible avec la CSP), thèmes `github-light` / `github-dark` par variables CSS, coloration jusqu'à 5 000 lignes, aperçu refusé au-delà de 1 Mo ou pour un binaire.
- Éditeur externe : `$VISUAL` puis `$EDITOR`, seulement si le binaire est dans la liste `code`, `code-insiders`, `cursor`, `windsurf`, `zed`, `subl`, `webstorm`, `idea` ; sinon `open` (macOS) ou `xdg-open` (Linux), sans numéro de ligne. Raccourci `⌘⇧O`.

## 10. Vue Changements dans l'arbre

- « Changements » est une vue du shell, pas un composant : une entrée fixe sous les pages du projet actif (avec le nombre de fichiers modifiés), seulement si le projet a un dossier git. Elle rejoindra le catalogue quand le SDK exposera git (phase 4).

## 11. Codes d'erreur ajoutés

`NOT_A_REPO`, `PATH_OUTSIDE_PROJECT` (403), `GIT_FAILED`, `GIT_STALE` (409), `GIT_PUSHED` (409), `GIT_BUSY` (409), `FILE_CHANGED` (409), `GH_UNAVAILABLE` (502), `GH_FAILED` (502), `EDITOR_UNAVAILABLE`.

## 12. Décisions de la phase 9 : menus contextuels et coque de bureau

Écrites avant le plan `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md` (lot 4 du plan d'action UI/UX). Elles complètent §1, §4, §7 et §9 sans les contredire.

### 12.1 Annuler les changements d'un fichier

- Nouvelle requête `discardChanges { projectId, worktree, paths: RelPath[] (1 à 1000) }` sur `/api/code`, résultat `null`. **Sens** : chaque fichier revient à son état dans `HEAD`, index et worktree compris ; un fichier absent de `HEAD` (nouveau, non suivi ou ajouté à l'index) est supprimé du disque. C'est la seule opération de Kibo qui perd du travail non commité : l'UI la confirme toujours (nombre de fichiers, mention « irréversible », nom des fichiers qui seront supprimés).
- Mise en œuvre : `git ls-tree --name-only HEAD -- <paths>` sépare les chemins présents dans `HEAD` (`git restore --staged --worktree --source=HEAD -- …`) des autres (`git rm --cached -q --ignore-unmatch -- …` puis `git clean -f -q -- …`). Sans `HEAD`, tous les chemins sont « absents de `HEAD` ». Un chemin renommé dans l'index est traité avec sa source (`origPath`), comme `unstageFiles`.
- Sécurité : chemins confinés par `resolveInWorktree` (§1 : relatifs, sans `..`, hors `.git/`, `realpath` dans le worktree) ; `GIT_LITERAL_PATHSPECS=1` (aucun motif) ; `git clean` sans `-d` ni `-x` (jamais de dossier entier, jamais les fichiers ignorés) ; un lien symbolique est remplacé ou supprimé lui-même, jamais sa cible (comportement de git). Refus en `GIT_BUSY` si une opération (rebase, fusion, cherry-pick, revert) est en cours, en `INVALID_INPUT` pour un fichier en conflit (résoudre ou abandonner d'abord).
- Mutation sérialisée par worktree, suivie de l'événement `code` comme les autres.

### 12.2 Tout indexer, tout désindexer

- `stageAll { projectId, worktree }` = `git add -A` (fichiers nouveaux compris) ; `unstageAll { projectId, worktree }` = `git reset -q` (index remis à `HEAD`, worktree intact), ou `git rm --cached -r -q -- .` sans `HEAD`. Résultat `null`, mutations sérialisées, événement `code`.

### 12.3 Actions réservées à la machine locale

- `/api/code` reçoit désormais le contexte de session (`RpcContext { sessionHash, remote }`) : `CodeService.handle(req, ctx)`. `discardChanges`, `stageAll`, `unstageAll` et **`openInEditor`** (qui lance un programme sur la machine) sont refusées en `FORBIDDEN` depuis une session distante, comme les RPC de la spec G décision 17. Décision d'Adam (2026-09-27) : **toutes** les requêtes de `/api/code` qui modifient le dépôt ou lancent un programme (indexer, désindexer, commit, push, création de PR, changement de branche, annulation, ouverture dans l'éditeur) sont réservées à la machine locale et refusées en `FORBIDDEN` depuis une session distante ; seules les lectures (statut, diff, contenu, historique) restent ouvertes. L'interface distante masque ces actions.

### 12.4 Menus contextuels de l'interface

- Dans la fenêtre Tauri, le menu natif de la webview (Recharger, Inspecter…) est bloqué **sauf** dans un champ de saisie (`input`, `textarea`, `contenteditable`) et quand du texte est sélectionné (le menu natif « Copier » reste disponible). Dans un navigateur, rien ne change.
- Menus Kibo (composant `ContextMenu` de shadcn, même contenu que le bouton « ⋯ » de l'élément quand il existe) : onglet (§7, inchangé), **page** de la barre latérale (Ouvrir dans un nouvel onglet, Nouvelle sous-page, Renommer, Monter / Descendre, Déplacer vers, Supprimer), **ticket** dans l'arbre Tickets et carte Kanban (Ouvrir, Changer le statut, Nouveau sous-ticket, Déplacer à la racine, Supprimer), **note** (Renommer, Supprimer), **fichier modifié** (Voir le diff, Ouvrir dans un onglet, Ouvrir dans l'éditeur externe, Copier le chemin, Indexer / Désindexer, Annuler les changements), **projet** (Nouvelle page, Partager). Toute entrée destructive ouvre une confirmation ; en lecture seule (projet partagé, rôle lecteur), les entrées d'écriture sont absentes.
- Le chrome du shell (barre d'onglets, barre latérale, en-têtes) n'est pas sélectionnable (`select-none`) ; le contenu des pages le reste.

### 12.5 Coque de bureau

- **Menu natif macOS explicite** : « Kibo » (À propos, Services, Masquer, Masquer les autres, Tout afficher, Quitter), « Édition » (Annuler, Rétablir, Couper, Copier, Coller, Tout sélectionner), « Fenêtre » (Réduire, Agrandir, Plein écran, Fermer la fenêtre `⌘⇧W`). Aucune entrée ne porte `⌘W`, `⌘T`, `⌘K`, `⌘1…9` ni `⌘⇧P` : ces raccourcis arrivent à la webview (§7). Le menu par défaut de Tauri fermait la fenêtre sur `⌘W`. Linux et Windows : pas de barre de menu.
- **Fenêtre** : taille minimale 960 × 600, taille et position mémorisées entre deux lancements (`tauri-plugin-window-state`, fichier dans le dossier de configuration de l'app, hors CRDT). Le titre de la fenêtre suit `document.title` : « Kibo », « Projet · Page — Kibo », « Projet · KIB-12 — Kibo » (mêmes libellés que les onglets, §7), posé par l'UI (`core:window:allow-set-title`).
- **Liens externes** : dans la fenêtre Tauri, un clic sur `<a target="_blank">` est intercepté par l'UI et ouvert dans le navigateur par `tauri-plugin-opener`, **pour les seules URL `https:`** ; tout autre schéma est ignoré. Plus largement, tout `<a>` dont l'URL résolue est hors de l'origine du démon, avec ou sans `target="_blank"`, est intercepté : `https:` s'ouvre dans le navigateur, tout autre schéma est ignoré ; la webview ne quitte jamais l'origine du démon. Le clic du milieu sur un lien `https:` sortant suit le même chemin. La capacité accordée à l'exécution à l'origine du démon (spec I §3.7) gagne `opener:allow-open-url` limitée au motif `https://**` et `core:window:allow-set-title` ; aucune ouverture de chemin de fichier ni de programme.
- **Navigation de la fenêtre principale** : la coque refuse toute navigation de la webview principale vers une autre origine que celle du démon (`on_navigation`) ; l'UI intercepte les liens, la coque garantit. Deux origines exactes sont autorisées : celle du démon (`KIBO_READY`) et celle du serveur sandbox des composants (`http://127.0.0.1:<sandboxPort>`, annoncée par le démon sur une ligne `KIBO_SANDBOX <origine>` émise juste après `KIBO_READY`), car sous macOS (WKWebView) et Linux (WebKitGTK) le gestionnaire de navigation voit aussi celle des iframes ; tout le reste est refusé (`about:blank`, `javascript:`, `file:`, `https:`…). Point faible accepté pour cette phase : la fenêtre principale pourrait naviguer vers l'origine sandbox, qui ne porte ni capacité IPC ni accès au démon ; `window.open` passe par `new_window_handler`, non posé, et wry abandonne alors la nouvelle fenêtre.
- **Raccourcis affichés** selon la plateforme : `⌘` sur macOS, `Ctrl` ailleurs (§7 le prévoyait pour le comportement, pas pour l'affichage).
- **Logo** : icône de l'application, favicon et `KiboLogo` dessinent la piste 5 « Kanban » de la page Penpot `05 · Logo` (`design/penpot/scripts/01-core.js`, `S.kanbanLogo`) ; un script génère `apps/desktop/app-icon.svg` et `packages/ui/public/favicon.svg` depuis la même géométrie, et un test refuse toute divergence.

### 12.6 Codes d'erreur

Aucun nouveau code : `FORBIDDEN`, `GIT_BUSY`, `INVALID_INPUT`, `PATH_OUTSIDE_PROJECT`, `GIT_FAILED` suffisent.

### 12.7 Réponses d'Adam du 2026-09-27 : glisser-déposer et notes

Écrites le 2026-09-30, à la rédaction des tâches T3b, T7b, T10b et T12b du plan de la phase 9 (vague 1 bis). La réponse (1), « toutes les mutations git de `/api/code` réservées à la machine locale », est déjà consignée en §12.3 ; l'interface distante montre la vue Changements et l'aperçu d'un fichier **en lecture** (diff, contenu, historique) sans aucune action d'écriture, avec une ligne qui dit pourquoi.

- **Glisser-déposer des pages (barre latérale) et des tickets (arbre)** : il reparente **et** réordonne. Déposer sur un élément en fait le parent (à la fin de ses enfants) ; déposer au-dessus ou au-dessous d'un élément place le déplacé juste avant ou juste après lui, chez le même parent, par `movePage` / `moveTicket { parentId, index }`. `index` est la **position finale** parmi les frères (sémantique de `LoroTree.move`, vérifiée : sur `a,b,c`, déplacer `a` à l'index 1 donne `b,a,c` ; déplacer `c` à l'index 3 parmi `a,b,c,p` le met en dernier ; sous un autre parent dont l'enfant est `q`, l'index 1 donne `q,a`). L'interface calcule cet index sur la liste complète des frères sans l'élément déplacé, jamais sur une liste filtrée (« Mes tickets », filtre de source) ; « Monter » / « Descendre » restent dans le menu. Un dépôt qui ne change rien n'envoie rien ; un dépôt sur soi-même ou dans son propre sous-arbre est ignoré (le démon refuserait de toute façon, `TREE_CYCLE`). Trois zones par ligne : quart haut, milieu, quart bas ; la zone est celle sous le pointeur.
- **Aucune note sans titre** : « Nouvelle note » demande un titre obligatoire ; le fichier créé est `<slug>.md` à la racine du dossier de notes et sa première ligne `# Titre` ; un titre dont le slug est déjà pris est refusé (« Une note porte déjà ce nom. ») sans rien écrire. Un fichier `sans-titre(-n).md` existant est signalé dans la liste (« Fichier sans titre · Renommer… ») et renommé à sa prochaine sauvegarde dès qu'il a un titre `# …` dont le slug est libre et n'est pas lui-même un nom sans titre. Un renommage n'entraîne jamais de frappe perdue : le tampon est enregistré avant, les sauvegardes suivantes visent le nouveau chemin, et une sauvegarde partie pendant un renommage long est rejouée sur le nouveau fichier (état « Enregistré », pas de bannière « Modifié hors de Kibo »).
