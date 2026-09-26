# Kibo Composants (phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** qu'un composant écrit hors du monorepo soit créé, validé, versionné, isolé (iframe + processus séparé) et mis à jour sans risque pour les données, avec la même API que les intégrés ; livrer les composants intégrés Graphe de dépendances et Notes (Markdown / Obsidian).

**Architecture:** un nouveau paquet `packages/devkit` (empreinte, contrôle des imports, inférence des permissions, build, validation) est utilisé par la CLI `packages/cli` et par le démon. Le démon tient un magasin immuable des composants publiés (`<KIBO_HOME>/components/store`), un registre dans le doc Loro workspace, une porte unique `componentCall` qui contrôle chaque appel d'un composant non intégré contre les permissions et l'empreinte **approuvées**, des hôtes de backend (Worker pour `trusted`, processus Bun restreint pour `sandboxed`), un second listener loopback qui ne sert que les fichiers d'UI sandboxée, et un index des notes Markdown. L'UI rend chaque instance selon sa confiance : module intégré, module `trusted` chargé par `import()`, ou iframe `sandbox="allow-scripts"` pilotée par un protocole postMessage validé par Zod.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25, loro-crdt 1.16, bun:sqlite, React 19, Tailwind 4.1 (`@tailwindcss/node`, `@tailwindcss/oxide`), API du compilateur TypeScript, markdown-it 14, CodeMirror 6 (versions figées par la phase 3), fast-check, Playwright, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-09-26-kibo-composants.md` (source principale), avec `docs/superpowers/specs/2026-09-25-kibo-design.md` §5, §6, §10, §11 et `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` (interfaces de la phase 3). Données : `design/donnees-fictives.md`. Maquettes : `design/pdf/kibo-design-sombre.pdf` et `design/pdf/kibo-design-clair.pdf`.

**Correspondance écran → page PDF** (même numéro de page dans les deux PDF) :

| Écran | Contenu | Page PDF |
|---|---|---|
| 3 | Ajouter un composant (catalogue Intégrés / Mes composants) | 7 |
| 6 | Page Composants + dialogue « Publier « … » x.y.z » | 10 |
| 7 | Tableau de bord : widgets Graphe de dépendances et Notes | 13 |
| 10 | Graphe de dépendances (vue) | 16 |
| 11 | Notes (vue) | 17 |
| 29 | Créer un composant (colonnes IA / Depuis le code) | 11 |
| 30 | Autoriser « … » x.y.z ? (permissions et confiance) | 12 |
| 1 | Vue d'ensemble (densité, en-tête de workspace) | 5 |
| 8 | Kanban (vue) | 8 |
| 9 | Tickets (vue) | 15 |
| 12 | Mes tickets | 22 |
| 13 | Agents | 23 |
| 14 | Domaines & guidelines | 24 |
| 17 | Files d'attente | 27 |
| 21 | Changements | 34 |

## Global Constraints

- **Bun 1.4.2** partout (CI `oven-sh/setup-bun` `bun-version: 1.4.2`, `@types/bun` 1.4.2) ; dépendances figées par `bun.lock`, `bunfig.toml` `exact = true`, aucun script `postinstall`.
- **Aucun commentaire dans le code** (TS, TSX, CSS, JSON, scripts) : rédhibitoire en review. Les justifications vont dans le commit ou dans ce plan.
- Code, identifiants et messages d'erreur internes (`KiboError.detail`) en anglais ; textes affichés (UI, CLI, rapports de validation) en français, **tutoiement**. Textes de l'app dans `packages/ui/src/i18n/fr.ts` ; textes d'un composant intégré dans son `src/fr.ts` ; textes de la CLI dans `packages/cli/src/fr.ts` ; messages de validation dans `packages/devkit/src/fr.ts`.
- TypeScript `strict`, ESM, exports nommés uniquement, pas de `any`, pas de `as` sauf aux frontières listées dans la tâche (réponse RPC typée par méthode, `import()` dynamique) ; types dérivés des schémas Zod (`z.infer`).
- Fichiers `kebab-case.ts`, composants React `PascalCase.tsx`, ~300 lignes max par fichier.
- Erreurs : `KiboError` avec un code stable de `packages/schema/src/errors.ts` ; **jamais d'erreur avalée** : toute erreur attrapée est soit relancée, soit transformée en `KiboError`, soit affichée à l'utilisateur dans un élément `role="alert"`, soit journalisée (`console.error` côté démon, table `component_events` pour les refus).
- UI : primitives shadcn **dans `packages/sdk/src/ui`** (ajout par `bunx shadcn@4.21.0 add <nom>` depuis `packages/ui`, le `components.json` y pointe déjà), tokens zinc, orange `#F97316` réservé aux agents et à la marque (en clair : `text-orange-700`), identifiants de champ par `useId()`, chaque écran en sombre et en clair.
- **Nouveaux paquets** (`packages/devkit`, `packages/cli`, `components/graph`, `components/notes`) : ajoutés au script `typecheck` de `package.json` et, pour `devkit` et `cli`, à la ligne des dépendances autorisées de `CLAUDE.md`, **dans la tâche qui les crée**.
- **Tout exécutable** (démon, CLI `kibo`, runtime de composant) sort de `apps/desktop/scripts/build-sidecar.ts` : un seul binaire compilé, sous-commandes `component …` et `component-runtime`.
- Sécurité : toute route HTTP du port principal passe par les contrôles `Host`, `Origin` et session existants ; le port sandbox est un **second listener `127.0.0.1` dédié** qui contrôle `Host` et ne sert que `GET /c/<id>/<version>/<hash>/(index.html|ui.sandbox.js|ui.css)`, sans cookie ni `/api`.
- Aucune dépendance npm dans un composant non intégré : imports autorisés = chemins relatifs, `react`, `react/jsx-runtime`, `lucide-react`, `@kibo/sdk` et les sous-chemins listés dans `SHARED_SPECIFIERS` (tâche 2).
- Tests : `bun test` (happy-dom préchargé), fast-check pour les propriétés, Playwright en **sombre et en clair**, CI macOS + Linux ; aucun test ne touche le réseau réel ni ne consomme de tokens.
- Commits : une ligne, français, préfixe conventionnel, < 50 caractères, sans body, fichiers stagés explicitement, aucune mention d'IA.

## Review Focus

1. **Un composant sandboxé appelle `run` avec une commande réservée (`setInstanceData`, `addInstance`, `setInstanceComponent`) ou une entité qu'on ne lui a pas accordée** : refus `PERMISSION_DENIED`, une ligne dans `component_events`, aucune écriture dans le doc projet (tâche 15, test « reserved commands »).
2. **Un fichier du magasin est modifié sur disque après l'approbation** (`source/ui.tsx` ou `build/ui.sandbox.js`) : au prochain chargement ou lancement de backend, la version passe à `trust = null`, l'iframe renvoie 404, le module `trusted` 403, le backend n'est pas lancé, et l'instance affiche « Autorisation requise » (tâches 14, 21, 22 : tests « tampered source », « tampered build »).
3. **Chemin de note hostile** : `../x.md`, `a/../../x.md`, `/etc/passwd.md`, `.obsidian/x.md`, `notes.txt`, lien symbolique `evil.md → /etc/hosts` ou dossier lié hors de `notesDir` : refus `PATH_OUTSIDE_PROJECT` ou note ignorée par l'index, jamais de lecture ni d'écriture hors du dossier (tâche 18, test « confinement »).
4. **« Mettre à jour partout » quand la migration échoue sur une seule instance** (config résultante invalide) : les autres instances passent à la nouvelle version, l'instance fautive garde sa version, sa config et ses données, et figure dans `PublishResult.failed` (tâches 16 et 27, test « partial failure »).
5. **Message postMessage forgé** : envoyé par une autre fenêtre (`event.source` ≠ iframe), portant un `instanceId` d'une autre instance, ou 65e appel en vol : ignoré et journalisé, `instanceId` toujours celui de l'iframe émettrice, `reply` en `TIMEOUT` au-delà de 64 (tâche 23, test « bridge »).

## Ancrages sur les phases 2 et 3

Les plans des phases 2 et 3 s'exécutent avant celui-ci mais n'existaient pas à son écriture. Les tâches s'appuient sur les interfaces **annoncées par la spec de phase 3** ; le dev vérifie chaque ancrage par `grep` au début de la tâche qui le consomme et, si le nom réel diffère, utilise le nom réel sans changer le comportement (écart signalé dans son rapport).

| Ancrage | Attendu (spec phase 3 ou 2) | Consommé par | Si absent |
|---|---|---|---|
| `Service.handle(req): Promise<unknown>` | démon asynchrone (opérations git) | 30 | la tâche 30, étape 1, le rend asynchrone (le serveur fait `await`) |
| `Store.db: Database` (bun:sqlite) | tables `local_state`, runs | 30 (les tâches 15 et 18 testent sur une base `:memory:`) | la tâche 30, étape 1, ajoute `db` au type `Store` retourné par `openStore` |
| `KiboSdk.openFile({ path, line? })`, `Host.openFile` | spec phase 3 §9 | 7, 23, 26, 28 | la tâche 7 l'ajoute au type ; la tâche 28 le relie à l'aperçu de fichier (ou à un no-op si l'aperçu n'existe pas, écart signalé) |
| Cible d'onglet (`kind: "project" \| "page" \| "changes" \| "file" \| "ticket"`) et `openTarget` | spec phase 3 §7 | 24 | la tâche 24 ajoute une route `#/components` à `route.ts` |
| CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`) | vue Changements | 26 | la tâche 26 les ajoute aux versions `6.x` courantes, figées dans `bun.lock` |
| Codes d'erreur de la phase 3 (`PATH_OUTSIDE_PROJECT`…) | spec phase 3 §11 | 2, 18 | la tâche 2 ajoute `PATH_OUTSIDE_PROJECT` s'il manque |
| Assigné agent (`assignee.kind === "agent"`) | déjà dans le ticket | 25 | — |

## Décisions techniques de ce plan

La spec de phase laisse ces points ouverts ; chaque choix est le plus simple et le plus sûr. La tâche 2 les reporte dans la spec (§15 « Décisions d'implémentation ») avant tout code, conformément à `CLAUDE.md`.

1. **Données d'instance** : `doc.getMap("instanceData")`, une `LoroMap` par `instanceId`. Les instances restent des valeurs JSON dans `instances` (format v0.1 inchangé, pas de migration de docs existants).
2. **Format de `configSchema`** : `Record<clé, { type?: "string"|"number"|"boolean", enum?: (string|number|boolean)[], nullable?: boolean, default?: unknown }>` (compatible avec le manifeste Kanban v0.1). Sans `configSchema`, seule la config `{}` est valide ; toute clé inconnue est refusée.
3. **Appels ajoutés à `ComponentCall`** : `notes.search { query }` (recherche plein texte côté démon, spec §8.2) et `notes.info` (dossier, libellé Obsidian) ; `sdk.notes.search()` et `sdk.notes.info()` exigent `reads: note`.
4. **Contexte SDK** : `surface: "widget" | "view"` (widget et vue d'un composant `both` diffèrent pour Graphe et Notes) et `openView(componentId)` (lien « Ouvrir le graphe → ») ; message iframe `{ type: "openView", componentId }` pour garder une API identique en sandbox.
5. **Codes d'erreur ajoutés** en plus de la spec : `RATE_LIMITED` (quotas d'appels et de `fetch`), `QUOTA_EXCEEDED` (256 Kio de données), `SANDBOX_UNAVAILABLE` (aucun bac à sable OS utilisable, décision 24).
6. **RPC ajoutées** : `rehashComponent` (menu « Revérifier l'empreinte »), `listDrafts` (« Mes composants » non publiés), `getNotesDir` / `setNotesDir`, `getRuntimeInfo` (origine du port sandbox pour l'UI), `installCli` (Paramètres › Général).
7. **Mise à jour différée** : `RegistryVersion.autoUpdate: boolean` (défaut `false`). « Mettre à jour partout » sur une version qui demande une nouvelle permission ne lance aucune migration (ce serait exécuter du code non approuvé) : la version est publiée avec `trust = null` et `autoUpdate = true`, et `approveComponent` applique alors la mise à jour à toutes les instances.
8. **Découverte du démon par la CLI** : le démon écrit `<KIBO_HOME>/daemon.json` (`{ port, sandboxPort, pid }`, `0600`) au démarrage et le supprime à l'arrêt.
9. **Validation sur copie** : `validateComponent` copie les fichiers du composant dans un dossier temporaire (avec un lien `node_modules` vers la toolchain) et valide cette copie ; l'empreinte du rapport est celle de la copie (pas d'écart entre ce qui est validé et ce qui est publié). Tampon de dernière validation : `<dossier>/.kibo/validation.json` (caché, donc hors empreinte).
10. **Empreinte** : octets bruts, sans normalisation des fins de ligne ; un lien symbolique dans les sources fait échouer la validation ; plafonds 200 fichiers hachés, 2 Mio.
11. **Graphe** : couches par plus long chemin **vers un puits** (alignement à droite), ce qui reproduit l'écran 10 (KIB-16 en colonne 2) ; égalité du chemin critique départagée par ordre naturel des clés (`KIB-5` < `KIB-11`).
12. **Notes** : `NoteMeta.links` contient une entrée par occurrence (le compteur « n mentions » en découle) ; recherche par `instr(lower(title || body), lower(q))` sur une colonne `body` de l'index (pas de FTS5, dont la présence varie selon la SQLite du système).
13. **Chargement dynamique depuis la toolchain** : `typescript`, `@tailwindcss/node` et `@tailwindcss/oxide` sont chargés au runtime depuis la toolchain (et non embarqués dans le binaire), ce qui évite d'embarquer un module natif et règle le chemin des `lib.d.ts`.
14. **`buildComponent(srcDir, toolchain)`** renvoie les fichiers en mémoire (`Record<nom, Uint8Array>`) au lieu d'écrire dans `outDir` : le démon les écrit lui-même dans le magasin.
15. **Appels d'un backend rattachés à leur invocation** : le message `call` du backend porte `invocation` (l'`id` de l'`invoke` en cours) ; le démon en déduit projet et instance, et refuse (`PERMISSION_DENIED`) un appel dont l'invocation est terminée ou inconnue (un `ctx` conservé après la fin d'une action ne sert plus à rien). Limite résiduelle : pendant deux invocations simultanées du même `id@version`, le code peut choisir l'une ou l'autre ; les deux instances ont les mêmes permissions accordées.
16. **Imports refusés en défense en profondeur** : en plus des modules, les identifiants `require`, `eval`, `Function`, `process`, `Bun`, `globalThis`, `global`, `self`, `module`, `Worker`, `SharedWorker` et `import.meta` sont refusés en position de valeur dans les sources d'un composant non intégré, ainsi que tout attribut d'import (macros Bun). Défense en profondeur seulement (voir décision 24).
17. **`ui.sandbox.js` et `ui.css` servis avec `access-control-allow-origin: *`** (relecture sécurité de la tâche 22) : le document sandboxé a une origine opaque (`null`) ; le script `type="module"` se charge en mode CORS, et la feuille de style est liée avec `crossorigin="anonymous"` dans `SANDBOX_INDEX` pour passer elle aussi en mode CORS. Sans cela, `<link rel="stylesheet">` part en mode `no-cors` et `cross-origin-resource-policy: same-site` la bloque (Chromium et WebKit tiennent un initiateur opaque pour inter-site). Ces fichiers ne portent ni secret ni cookie, et une requête CORS depuis une origine opaque n'envoie pas de cookie ; `*` équivaut ici à `null`, que toute iframe sandboxée présente. `index.html` n'a pas cet en-tête (navigation, CORP non appliqué sans COEP).
18. **`lucide-react` embarqué dans `ui.trusted.js`** (non partagé via `globalThis.__kiboShared`) : icônes sans état ; l'UI n'expose ainsi que React et le SDK, sans gonfler son bundle de toute la bibliothèque d'icônes.
19. **Messages de statut plutôt que toasts** : l'UI v0.1 n'a pas de `Toaster` (celui de shadcn dépend de `next-themes`) ; `useFlash` affiche un `role="status"` 4 s près de l'action. Si une phase antérieure a monté un `Toaster`, les tâches 24 et 28 l'utilisent à la place.
20. **Commandes réservées refusées sur la RPC `command`** : `setInstanceComponent` et `setInstanceData` ne sont émises que par le démon (mise à jour, `data.set`) ; `addInstance`, `removeInstance` et `setInstanceConfig` restent permises au shell.
21. **Brouillons dans `<KIBO_HOME>/components/src/<id>/`** (hors monorepo, spec §3.2) ; `kibo component test` accepte aussi un chemin de dossier.
22. **Point d'entrée unique du binaire** (`apps/desktop/sidecar/entry.ts`) : répartit entre démon, CLI (`component …` ou lien nommé `kibo`) et runtime sandboxé (`component-runtime`), sans créer d'arête `cli ← daemon`.
23. **Démarrage factorisé** : `startDaemon` (tâche 30) sert à `main.ts`, aux tests d'intégration, à la CLI (tests) et à l'E2E.
24. **Bac à sable OS dès la phase 4 (point E2 tranché)** : le spike 1-C montre que le runtime restreint ne bloque pas l'import construit, et la relecture en a mesuré d'autres (même Bun 1.4.2) : `(() => 0).constructor("return import('node:fs')")()` passe l'analyse statique (propriété `constructor`) et le runtime ; `new Worker(URL.createObjectURL(new Blob([…])))` démarre un Worker dont `Bun.spawn` et `fetch` sont intacts ; `import("bun:ffi")` reste chargeable ; `Bun.build` exécute les macros (`import … with { type: "macro" }`) dans le processus qui construit, sans passer par `onResolve`. Sans barrière OS, un backend « sandboxé » lit `~/.ssh` et `~/.kibo`, lance des processus et ouvre le réseau. Donc : le `ProcessHost` **et** les tests exécutés par la validation (code non encore approuvé) tournent sous `sandbox-exec` (macOS) ou `bwrap` (Linux) dès la phase 4 (tâche 11b, profil de la spec H §8 adapté), en échec fermé (`SANDBOX_UNAVAILABLE`, aucun repli sans isolation) ; la tâche 4 refuse les attributs d'import et `Worker`, `global`, `self` ; la tâche 6 construit avec `macros: false`. Restent en phase 7 : réglage « Autoriser les backends sandboxés sans isolation OS », écran 19, filtre seccomp. Les backends `trusted` restent en Worker (confiance totale explicite à l'écran 30). Lancement de processus (relecture de la tâche 11b) : sous macOS, le profil n'autorise que l'exécution du binaire du runtime (`process-exec` littéral, `fork` refusé) ; sous Linux, `bwrap` n'a pas de liste d'exécutables (le runtime, interprète complet, peut exécuter tout fichier visible), donc on réduit ce qui est visible (bibliothèques système et binaire du runtime, pas `/usr/bin`) et tout processus lancé hérite du même bac à sable (espaces de noms, aucun réseau, aucune capacité, `no_new_privs`, mêmes montages, arrêté avec le runtime) ; interdire `execve` relève du filtre seccomp (phase 7). Un autre exécutable n'ajoute aucun accès à ce que le runtime a déjà.
25. **Frontière démon ↔ backend durcie** (relecture de la tâche 11) : (a) les codes d'erreur renvoyés par un backend passent par une liste blanche (`BACKEND_ERROR_CODES`, tâche 11) ; tout autre code (`TRUST_REQUIRED`, `UNAUTHORIZED`, `COMPONENT_CRASHED`…) devient `INTERNAL`, le code d'origine restant dans le message : un backend ne peut pas faire croire à l'UI qu'il faut accorder la confiance ou se réappairer ; (b) tout message invalide d'un backend (schéma, `ready` inattendu, JSON illisible, ligne trop longue) est une violation de protocole : arrêt du backend, compté comme un crash (attente croissante), au lieu d'une ligne de journal qu'un backend répéterait sans fin ; (c) l'attente d'un créneau est bornée par `timeoutMs` (`TIMEOUT`, tâche 11) et un job n'est pas relancé tant que son exécution précédente n'est pas finie (tâche 17) ; (d) le `ProcessHost` n'utilise plus le canal IPC de Bun, dont le tampon de lecture est sans limite : deux tubes JSON par ligne (descripteur 3 démon → runtime, descripteur 4 runtime → démon) ; une ligne reçue de plus de `BACKEND_MESSAGE_LIMIT` (4 Mio) arrête le backend, et le runtime honnête renvoie `TOO_LARGE` au lieu d'un résultat trop gros (tâche 11b). Reste pour la phase 7 (avec le filtre seccomp) : plafond mémoire et CPU du processus backend lui-même.
26. **Journal des refus borné** (relecture de la tâche 15) : l'ordre de la spec §6.4 (permissions avant quotas) laisse un composant enchaîner des refus sans limite ; prendre un quota avant les permissions ne suffirait pas (les refus `RATE_LIMITED` sont eux aussi journalisés). C'est donc le journal qui est borné (spec §6.4, point 6) : colonne `count`, par clé (`instanceId`, `call.kind`, `code`) et fenêtre de 60 s, 10 lignes puis une ligne de synthèse `count = n` sans écriture SQLite par refus ; rétention 1 000 lignes par instance et 10 000 au total. Le premier refus de chaque clé est toujours écrit immédiatement, avec son horodatage : un flot de refus d'un autre type ne le remplace pas avant la rétention, et le compteur montre l'ampleur du flot.
27. **Notes : balayage de secours** (relecture de la tâche 18, spec §8.2) : la surveillance du dossier est ouverte avant sa lecture, et un balayage des signatures des `.md` (chemin, `mtime`, taille) toutes les 3 s (`pollMs`) rattrape un événement FSEvents perdu juste après l'ouverture du flux ; même cause que le `worktree-watch` de la tâche de stabilisation. Le débounce de 200 ms reste le chemin normal.
28. **Le graphe lit `run`** (tâche 25, spec §8.1) : manifeste `reads [ticket, status, link, run]` ; pastille d'état du run d'agent sur le nœud, comme la carte Kanban ; lecture seule.
29. **UI chargée à la demande, budget du chargement initial** (tâche 35, écart de v0.3) : vues Notes et Graphe (CodeMirror, Lezer, markdown-it), écrans Agents, Files d'attente, Domaines, Composants, Changements, onglet et aperçu de fichier (Shiki, CodeMirror) chargés par `import()` au travers de `lazyPanel` du SDK public : repli `role="status"` pendant le chargement, échec affiché (`role="alert"`, « Réessayer » relance l'import), cause journalisée ; une erreur de rendu du module chargé n'est pas déguisée en échec de chargement. Budget : JS du chargement initial (chunk d'entrée et ses imports statiques, gzip niveau 9) ≤ **230 kB**, et aucun de ces modules dans l'entrée ; vérifié par `bun run budget` (build Vite réel en mémoire), par chaque tâche UI suivante et au jalon. Mesure de départ : 485 kB gzip (1,47 Mo brut) ; estimation après découpage : ~218 kB. On ne relève pas le seuil pour faire passer une tâche : toute hausse est justifiée dans le plan.
30. **Densité 13 px** (tâche 36, écart de v0.3) : les PDF sont à 0,75 pt par pixel ; échelle relevée : 10, 11, 12, 13, 14, 20, 22 px. Tokens Tailwind redéfinis dans `packages/sdk/src/theme.css` (partagé par l'UI, les intégrés et les composants construits par le devkit) : `text-sm` 13 px, `text-2xs` 11 px (nouveau), `text-3xs` 10 px (nouveau), `text-md` 14 px (nouveau), `text-2xl` 22 px ; `body` en 13 px ; `text-xs`, `text-base`, `text-lg`, `text-xl` inchangés. Hauteurs de ligne de `text-sm` gardées à 20 px. Contrôlé par un test Playwright (tailles calculées, sombre et clair).
31. **« Mes tickets » en phase 4** (tâche 37, écart de v0.3) : écran 12 comme écran de premier niveau (`Screen` gagne `mine` : onglet, palette, fil d'Ariane), calculé dans l'UI depuis les instantanés que le shell charge déjà (aucune RPC). « Assignés à moi » : non terminés, assigné humain = utilisateur (c'est le compteur de la barre latérale) ; « Mes agents » : non terminés, assignés à un agent ; « Créés par moi » : point E5. Groupes par projet dans l'ordre de la barre latérale ; tri Bloqué, En cours, À faire, En review, Backlog, puis ticket en attente d'un bloquant d'abord, puis ordre naturel des clés (reproduit la page 22). « Assigner » complet si le projet a un dossier, sinon bouton icône désactivé : un run exige un dossier (`workspace-prep.ts`), ce qui explique les boutons réduits de FAC et POR sur la maquette.
32. **En-tête de workspace** (tâche 38, écart de v0.3) : monogramme de la maquette (glyphe à cinq barres dans une tuile bordée, aussi sur l'onglet Accueil), nom du workspace et « Workspace local » ; nom stocké dans le doc workspace (`settings.name`, affiché « Perso » par défaut), changé par la commande de configuration `renameWorkspace` (1 à 40 caractères) ; menu : workspace courant coché, « Renommer le workspace… », « Paramètres du workspace ». Création et bascule entre plusieurs workspaces : point E6.

### Points à arbitrer par Adam (option A appliquée par défaut, l'équipe ne s'arrête pas)

| # | Sujet | Option A (par défaut) | Option B |
|---|---|---|---|
| E1 | Entités déclarées `acme.bug` : la feuille de route les met en phase 4, la spec de phase §14 les exclut | suivre la spec (hors périmètre, à placer après v1.0) ; la feuille de route est corrigée au jalon | ajouter une tâche « entités déclarées » (schéma namespacé, `reads: ["acme.bug"]`, stockage dans le doc projet) après la tâche 30 |
| E2 | **Tranché le 2026-09-26 : option B étendue** (décision 24, tâche 11b). Import dynamique construit (`new Function("return import('node:fs')")`) dans le runtime restreint : le spike 1-C montre qu'on ne peut pas le bloquer | écartée : l'analyse statique se contourne par `(() => 0).constructor`, le runtime par un Worker `blob:` ; « Sandboxé » n'isolerait rien jusqu'en phase 7, alors que la phase 6 fait écrire des composants par des agents | **retenue** : `sandbox-exec` (macOS) et `bwrap` (Linux) pour `ProcessHost` et pour les tests de la validation, échec fermé `SANDBOX_UNAVAILABLE` ; macros et attributs d'import refusés (tâches 4 et 6) |
| E3 | Bouton « Hiérarchique » de l'écran 10 | indicateur de la seule mise en page disponible (bouton pressé, désactivé, infobulle) | bascule qui ajoute les arêtes parent → sous-ticket |
| E4 | Tickets sans arête `blocks` : spec « couche 0 séparée en bas » ; écran 10 : KIB-9 en bas mais KIB-14 et KIB-18 à droite | suivre la spec (tous en bas) ; le chef aligne la maquette | suivre la maquette (colonne à droite pour les tickets assignés à un agent) |
| E5 | Onglet « Créés par moi » de l'écran 12 : un ticket n'enregistre pas son auteur | onglet affiché mais désactivé, infobulle « Kibo n'enregistre pas encore l'auteur d'un ticket. » (tâche 37) | champ `createdBy: string \| null` ajouté au ticket, rempli par `createTicket` (tickets existants à `null`), onglet actif |
| E6 | Plusieurs workspaces (création, bascule) : la spec générale §8 cite un « sélecteur de workspace », aucune spec ne le décrit (un démon = un `KIBO_HOME` = un doc workspace ; l'écran 15 montre `~/.kibo/workspaces/perso`) | phase 7, avec la sync (spec G à compléter : un dossier par workspace, bascule = redémarrage du démon sur l'autre dossier) ; la phase 4 livre l'en-tête et le renommage (tâche 38) | après v1.0 |

## Écrans à dessiner (Penpot, sombre et clair, avant les tâches UI concernées)

Le chef d'équipe les ajoute dans Penpot ; les tâches UI les implémentent tels que décrits ici, et le contrôle visuel du jalon les compare aux dessins.

| # | Écran | Contenu et états | Tâche |
|---|---|---|---|
| D1 | Menu `⋯` d'une instance | Dans l'en-tête d'un widget (à droite du titre, comme l'écran 7) et, pour une page Vue, à droite du fil d'Ariane. Entrées : « Mettre à jour vers 0.4.0 » (icône `ArrowUpCircle`, seulement si une version publiée plus haute existe ; plusieurs versions ⇒ une entrée par version, la plus haute d'abord), « Dossier des notes… » (Notes uniquement), séparateur, « Retirer de la page » (texte destructif). Message de statut (4 s, à droite du `⋯`) après mise à jour : « Instance mise à jour en 0.4.0. » ; échec : alerte « Impossible de mettre à jour l'instance. » | 28 |
| D2 | Instance « Autorisation requise » | Carte centrée dans le cadre de l'instance : icône `ShieldAlert`, titre « Autorisation requise », texte « « PR en attente » 0.3.0 doit être autorisé avant de s'afficher. » (+ « Son code a changé depuis ton accord. » quand l'empreinte a divergé), bouton « Examiner et autoriser » qui ouvre l'écran 30. Même carte en widget (compacte) et en vue (centrée). | 28 |
| D3 | Menu `⋯` de la page Composants | Pour une version non intégrée : « Revérifier l'empreinte » (`ScanSearch`), « Retirer la confiance » (`ShieldOff`, masqué si déjà sans confiance), séparateur, « Désinstaller » (destructif, désactivé avec infobulle « Utilisé sur des pages : retire d'abord ses instances. » si la version a des usages). Pour un intégré : bouton `⋯` désactivé. Colonne Confiance « Autorisation requise » en orange-600/400 avec bouton « Examiner ». Message de statut sous le tableau : « Empreinte vérifiée. » ou alerte « L'empreinte a changé : la confiance est redemandée. » | 24 |
| D4 | Bandeau de conflit d'une note | Au-dessus du contenu de la note (écran 11), bandeau ambre pleine largeur : icône `TriangleAlert`, « Modifié hors de Kibo », boutons « Recharger » (secondaire) et « Garder ma version » (principal) ; l'état « Enregistré · local » devient « Non enregistré ». | 26 |
| D5 | Brouillons (« Mes composants » non publiés) | Page Composants : section « Brouillons » sous le tableau : ligne par dossier de `components/src` (titre, version en mono, pastille verte « Tests verts » ou grise « À valider » avec `kibo component test <id>`, bouton « Publier »). Écran 3 : un brouillon vert apparaît dans « Mes composants » avec le badge « Brouillon » et un bouton « Publier » à la place de la version. | 19, 24 |
| D6 | Dialogue « Dossier des notes » | Titre « Dossier des notes », aide « Chemin absolu d'un dossier Markdown ou d'un vault Obsidian. Réglage propre à cette machine. », champ « Dossier » prérempli, boutons « Annuler » / « Enregistrer », alerte « Dossier introuvable ou illisible. » | 28 |
| D7 | Confirmation « Ouvrir le graphe » sans page | « Créer une page Graphe ? » — « Aucune page Vue de ce projet ne contient ce composant. » — « Annuler » / « Créer la page ». | 28 |
| D8 | Paramètres › Général : commande `kibo` | Carte « Commande kibo » : texte « Installe la commande kibo dans ~/.local/bin pour créer, tester et publier tes composants. », bouton « Installer la commande kibo », état « Installée : ~/.local/bin/kibo », alerte en cas d'échec. | 34 |
| D9 | États vides Graphe et Notes | Graphe vue : « Aucune dépendance entre les tickets affichés. » ; widget : « Aucun chemin critique : aucun ticket bloquant. » Notes vue : colonne gauche « Aucune note dans ce dossier. » + « Nouvelle note » ; centre « Choisis une note ou crées-en une. » ; widget : « Aucune note pour l'instant. » | 25, 26 |
| D10 | Rapport de publication partielle | Sous le dialogue de l'écran 6 après publication : alerte « 1 instance n'a pas pu être migrée et reste sur l'ancienne version. » + liste « Projet › Page — motif ». | 24 |
| D11 | Menu du workspace et « Renommer le workspace » | Déclencheur de l'en-tête (tuile, « Perso », « Workspace local », chevron) ouvert : libellé « Workspaces », ligne du workspace courant (tuile, nom, sous-titre, coche), séparateur, « Renommer le workspace… » (`Pencil`), « Paramètres du workspace » (`Settings`). Dialogue : titre « Renommer le workspace », champ « Nom » prérempli, « Annuler » / « Enregistrer », alerte « Impossible de renommer le workspace. » | 38 |
| D12 | États de l'écran 12 | Onglet « Mes agents » (ligne : action remplacée par `Bot` + nom du profil) ; états vides « Aucun ticket ouvert ne t'est assigné. » et « Aucun ticket ouvert n'est confié à un agent. » ; « Créés par moi » désactivé avec son infobulle (point E5). | 37 |

## File Structure

```
packages/schema/src/
  semver.ts  config.ts  net.ts  permissions.ts  command.ts  component.ts  protocol.ts  note.ts  migrations.ts
  manifest.ts errors.ts instance.ts rpc.ts index.ts (modifiés)  *.test.ts
packages/core/src/
  instance-data.ts  registry.ts  note-parse.ts   instances.ts commands.ts index.ts (modifiés)
packages/devkit/                     (nouveau : schema ← devkit ← daemon, devkit ← cli)
  src/toolchain.ts bun-command.ts restrict.ts preload/{restrict,happydom}.ts tailwind.ts
  src/hash.ts imports.ts scaffold.ts infer-permissions.ts build.ts validate.ts fr.ts index.ts
  spikes/*.test.ts   fixtures/{hello,bad-import,non-literal,undeclared,failing,evil}/
packages/sdk/src/
  types.ts sdk.ts client.ts mock.ts conformance.tsx (modifiés)
  server.ts migrations.ts sandbox.tsx fixtures.ts dev.tsx theme.css
packages/daemon/src/
  components/{net-proxy,runtime-core,process-host,worker-host,component-worker,store,gate,quotas,events,
              update,backends,jobs,registry-service,publish,drafts,sandbox-server,daemon-info,service}.ts
  component-runtime.ts   notes/{settings,notes-fs,index,watch,service}.ts
  server.ts main.ts service.ts (modifiés)
packages/cli/src/                    (nouveau)
  index.ts bin.ts args.ts daemon-client.ts fr.ts commands/{new,test,dev,publish}.ts
packages/ui/src/
  i18n/fr.ts  registry.ts  main.tsx  theme.ts  route.ts (modifiés)
  state/{use-components,use-runtime-info}.ts  lib/permission-lines.ts
  shell/{SandboxFrame.tsx,frame-bridge.ts,trusted-loader.ts,shared-modules.ts,page-actions.tsx}  lib/use-flash.ts
  dialogs/{TrustDialog,CreateComponentDialog,AddComponentDialog,NotesDirDialog,OpenViewDialog}.tsx
  components-page/{ComponentsPage,ComponentRowMenu,PublishDialog,DraftsSection}.tsx
  pages/{PageView,InstanceFrame,InstanceMenu,PendingTrust}.tsx  settings/CliInstallCard.tsx
  shell/{lazy-screens.ts,WorkspaceMark.tsx,WorkspaceSwitcher.tsx}  dialogs/RenameWorkspaceDialog.tsx
  mine/{my-tickets.ts,MyTicketsPage.tsx,MyTicketRow.tsx}
packages/ui/scripts/                 (nouveau) bundle-report.ts bundle-budget.ts tsconfig.json
packages/sdk/src/                    lazy.tsx (tâche 35)  theme.css (tokens de densité, tâche 36)
components/graph/   kibo.component.json src/{layout,critical-path,filter,GraphView,GraphCanvas,GraphWidget,fr,index}.ts(x)
components/notes/   kibo.component.json src/{markdown,dates,NotesView,NoteList,NoteDocument,MarkdownEditor,NotesWidget,fr,index}.ts(x)
apps/desktop/       sidecar/entry.ts  scripts/{build-sidecar,build-toolchain,cli-smoke}.ts  src-tauri/{tauri.conf.json,src/main.rs}
e2e/                components.spec.ts helpers.ts e2e-home.ts serve.ts fixtures/components/hello/
```

---

## Résultats des spikes (rempli par la tâche 1)

| Spike | Question | Résultat | Décision appliquée |
|---|---|---|---|
| A | `BUN_BE_BUN=1 <binaire compilé> test` se comporte comme `bun test` | **OK** (macOS arm64, Bun 1.4.2) : `kd --version` → `1.4.2` ; `kd test --preload happydom --preload restrict` dans un dossier dont `node_modules` pointe vers la toolchain → `1 pass` (import de `react` résolu) | `BUN_BE_BUN_SUPPORTED = true` |
| B | `bun test --preload happydom --preload restrict` : capacités retirées, DOM intact | **OK après correction** : le descripteur prévu échouait (`INTERNAL: cannot remove capability spawn`) car les membres de `Bun` sont `writable: true, configurable: false` ; `Reflect.defineProperty` refuse de changer `enumerable`. `remove` redéfinit donc `{ value: undefined, writable: false }` sur une propriété non configurable (verrouillage complet sinon). `Bun.plugin` est `writable: false, configurable: false` : impossible à retirer | liste `RESTRICTED` inchangée ; `restrict.ts` adapté |
| C | Import dynamique construit bloqué après restriction | **NON** : `Bun.plugin` `onResolve` (filtre `/.*/`) n'est jamais appelé pour `node:fs`, `fs`, `node:child_process`, `bun` ; `build.module("node:fs")` lève `module() cannot be used to override builtin module`. Après `restrictGlobals({ freeze: true })`, `import("bun")` rend le `Bun` restreint (`spawn` absent) mais `node:child_process.spawnSync` et `node:fs.readFileSync("/etc/hosts")` restent disponibles ; `require("fs")` aussi | plugin retiré ; **point E2 escaladé**, option B étendue (décision 24, tâche 11b) ; test renommé « KNOWN LIMIT E2 » |
| D | Tailwind v4 via `@tailwindcss/node` + `@tailwindcss/oxide` chargés depuis la toolchain, y compris dans un binaire compilé | **OK avec `compile.autoloadPackageJson: true`** (`--compile-autoload-package-json`). Sans cette option, un exécutable autonome ne résout aucun paquet sur disque : `Cannot find module '@tailwindcss/node' from '<toolchain>'` ; l'import par chemin absolu échoue ensuite (`Cannot find package 'enhanced-resolve'`, oxide `Failed to load native binding`) | pas de repli : **tout `Bun.build` compilé qui charge la toolchain passe `autoloadPackageJson: true`** (`spike-kit.ts`, tâche 34 `build-sidecar.ts`) |
| E | API TypeScript chargée depuis la toolchain dans un binaire compilé (`lib.*.d.ts` trouvés) | **OK** (même option) : `getDefaultLibFilePath` → `<toolchain>/node_modules/.bun/typescript@5.9.2/node_modules/typescript/lib/lib.es2022.full.d.ts`, 0 diagnostic. Piège : sans `types: []`, TypeScript inclut les `@types/*` visibles depuis le dossier courant (13 diagnostics `Cannot find module 'undici-types'` quand le cwd est le monorepo) | pas de repli ; les tâches 4, 5 et 20 (et le `tsconfig.json` généré) fixent `types` explicitement |
| F | `new Worker("./component-worker.ts")` dans un binaire compilé (entrée supplémentaire) | **OK** : `pong:x` | Worker pour les backends `trusted` |
| G | Code du backend transmis au processus par le descripteur 3 | **OK avec `Bun.file(fd).writer()` + `end()` + `closeSync(fd)`**. Le `Bun.write(Bun.file(fd), payload)` prévu ne ferme pas le descripteur (l'enfant attend EOF : délai de 60 s dépassé) et, même suivi de `closeSync`, livre 208 192 octets pour `"x".repeat(200_000)` (corruption reproductible, Bun 1.4.2 macOS) ; `fs.writeSync` lève `EAGAIN` (socket non bloquante) ; `createWriteStream({ fd })` ne se termine pas | descripteur 3 retenu ; **ne jamais utiliser `Bun.write` sur un tube** (tâche 11) |

Remarques de la tâche 1 :
- Linker isolé de Bun (`node_modules/.bun`) : les `devDependencies` de `packages/devkit` ne sont pas visibles depuis `node_modules` à la racine. La toolchain de dev étant la racine du monorepo (spec §9.2), `@kibo/sdk` (`workspace:*`), `@tailwindcss/node`, `@tailwindcss/oxide`, `tailwindcss` et `tw-animate-css` sont aussi déclarés dans le `package.json` racine ; `lucide-react` devra l'être quand un composant non intégré l'importera.
- Commandes : `bun test packages/devkit` (10 tests, ~3 s) ; sondes manuelles dans `/tmp` pour C, D et G (descripteurs de propriétés, `onResolve`, variantes d'écriture).
- Tâche 11 (`ProcessHost`) : remplacer `await Bun.write(Bun.file(Number(fd)), …)` par `const sink = Bun.file(fd).writer(); sink.write(…); await sink.end(); closeSync(fd);` (spike G).
- Un exécutable compilé charge par défaut `bunfig.toml` et `.env` du dossier courant (`autoloadBunfig`, `autoloadDotenv` à `true`) : à désactiver pour le binaire du démon en tâche 34.

---

### Task 1: Spikes de la toolchain (paquet devkit)

Valide les quatre points « à valider » de la spec (§7.4 et §9.2 : `BUN_BE_BUN=1`, `--preload restrict.ts`, Tailwind via `@tailwindcss/node`, toolchain embarquée) et trois points dont dépend l'architecture (import dynamique construit, Worker et descripteur 3 dans un binaire compilé). Les spikes restent comme tests de non-régression de la plateforme (macOS et Linux en CI).

**Files:**
- Create: `packages/devkit/package.json`, `packages/devkit/tsconfig.json`, `packages/devkit/src/index.ts`, `packages/devkit/src/toolchain.ts`, `packages/devkit/src/typescript.ts`, `packages/devkit/src/issues.ts`, `packages/devkit/src/bun-command.ts`, `packages/devkit/src/restrict.ts`, `packages/devkit/src/preload/restrict.ts`, `packages/devkit/src/preload/happydom.ts`, `packages/devkit/src/tailwind.ts`, `packages/devkit/src/toolchain.test.ts`, `packages/devkit/src/spikes/spike-kit.ts`, `packages/devkit/src/spikes/bun-be-bun.test.ts`, `packages/devkit/src/spikes/restrict.test.ts`, `packages/devkit/src/spikes/tailwind.test.ts`, `packages/devkit/src/spikes/compiled.test.ts`
- Modify: `package.json` (script `typecheck`), `CLAUDE.md` (arbre du monorepo et dépendances autorisées), `bun.lock`, ce plan (section « Résultats des spikes »)

**Interfaces:**
- Consumes: `KiboError` (`@kibo/schema`).
- Produces:
  - `type Toolchain = { root: string }` ; `resolveToolchain(opts?: { explicit?: string | null; env?: Record<string, string | undefined>; execPath?: string; here?: string }): Toolchain` ; `isCompiled(): boolean`.
  - `type BunCommand = { argv: string[]; env: Record<string, string> }` ; `bunCommand(opts?: { compiled?: boolean; execPath?: string; which?: (bin: string) => string | null }): BunCommand` ; `BUN_BE_BUN_SUPPORTED: boolean`.
  - `restrictGlobals(opts: { freeze: boolean }): void` ; `RESTRICTED: { globals: readonly string[]; bun: readonly string[]; process: readonly string[] }`.
  - Préchargements `@kibo/devkit/preload/happydom` et `@kibo/devkit/preload/restrict` (dans cet ordre).
  - `compileCss(input: { css: string; sources: string[]; toolchain: Toolchain }): Promise<string>`.
  - `type TypeScript = typeof import("typescript")` ; `loadTypeScript(t: Toolchain): Promise<TypeScript>`.
  - `type SourceIssueCode`, `type SourceIssue = { file: string; line: number; code: SourceIssueCode; detail: string }`, `issueAt(file, line, code, detail)`.

- [x] **Step 1: Créer le paquet**

`packages/devkit/package.json` :
```json
{
  "name": "@kibo/devkit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./preload/happydom": "./src/preload/happydom.ts",
    "./preload/restrict": "./src/preload/restrict.ts"
  },
  "dependencies": {
    "@kibo/schema": "workspace:*"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "18.0.1",
    "@tailwindcss/node": "4.1.13",
    "@tailwindcss/oxide": "4.1.13",
    "@testing-library/react": "16.3.0",
    "tailwindcss": "4.1.13",
    "tw-animate-css": "1.4.0",
    "typescript": "5.9.2"
  }
}
```
Les paquets de `devDependencies` ne sont jamais importés statiquement par le code de `src/` : ils sont chargés depuis la toolchain au runtime (décision 13) ; les déclarer ici les place dans le `node_modules` du monorepo, qui est la toolchain de dev.

`packages/devkit/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "lib": ["ES2022", "DOM"] },
  "include": ["src"],
  "references": [{ "path": "../schema" }]
}
```

`package.json` racine, script `typecheck` : ajouter `packages/devkit` juste après `packages/core`.

`CLAUDE.md` : dans l'arbre, après la ligne `packages/core/` :
```
packages/devkit/     outillage des composants : empreinte, imports, build, validation (CLI et démon)
```
et remplacer la phrase des dépendances par :
```
Dépendances autorisées entre paquets : `schema ← core ← daemon`, `schema ← sdk ← components`, `sdk ← ui`, `schema ← devkit ← daemon`.
```

Run: `bun install`
Expected: `bun.lock` mis à jour, aucun script lancé.

- [x] **Step 2: Écrire le test de la résolution de toolchain**

`packages/devkit/src/toolchain.test.ts` :
```ts
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bunCommand } from "./bun-command";
import { resolveToolchain } from "./toolchain";

const repo = resolve(import.meta.dir, "../../..");

test("in the monorepo the toolchain is the repository root", () => {
  expect(resolveToolchain({ env: {} }).root).toBe(repo);
});

test("an explicit toolchain must contain @kibo/sdk", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-tc-"));
  expect(() => resolveToolchain({ explicit: dir })).toThrow("NOT_FOUND");
  mkdirSync(join(dir, "node_modules", "@kibo", "sdk"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "@kibo", "sdk", "package.json"), "{}");
  expect(resolveToolchain({ explicit: dir }).root).toBe(dir);
});

test("a packaged binary finds Resources/toolchain next to it", () => {
  const app = mkdtempSync(join(tmpdir(), "kibo-app-"));
  const macos = join(app, "Kibo.app", "Contents", "MacOS");
  const sdk = join(app, "Kibo.app", "Contents", "Resources", "toolchain", "node_modules", "@kibo", "sdk");
  mkdirSync(macos, { recursive: true });
  mkdirSync(sdk, { recursive: true });
  writeFileSync(join(sdk, "package.json"), "{}");
  writeFileSync(join(macos, "kibo-daemon"), "");
  const found = resolveToolchain({ env: {}, execPath: join(macos, "kibo-daemon"), here: "/$bunfs/root" });
  expect(found.root).toBe(join(app, "Kibo.app", "Contents", "Resources", "toolchain"));
});

test("bun is the current executable in dev and the binary itself once compiled", () => {
  expect(bunCommand({ compiled: false, execPath: "/usr/bin/bun" })).toEqual({ argv: ["/usr/bin/bun"], env: {} });
  expect(bunCommand({ compiled: true, execPath: "/app/kibo-daemon" }).argv).toEqual(["/app/kibo-daemon"]);
});
```

Run: `bun test packages/devkit/src/toolchain.test.ts`
Expected: FAIL (`Cannot find module './toolchain'`).

- [x] **Step 3: Implémenter `toolchain.ts` et `bun-command.ts`**

`packages/devkit/src/toolchain.ts` :
```ts
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { KiboError } from "@kibo/schema";

export type Toolchain = { root: string };

export const isCompiled = (): boolean => Bun.main.startsWith("/$bunfs/");

const hasSdk = (root: string): boolean => existsSync(join(root, "node_modules", "@kibo", "sdk", "package.json"));

function candidates(execPath: string, here: string): string[] {
  const execDir = dirname(existsSync(execPath) ? realpathSync(execPath) : execPath);
  return [
    join(execDir, "..", "Resources", "toolchain"),
    join(execDir, "..", "lib", "Kibo", "toolchain"),
    join(execDir, "toolchain"),
    resolve(here, "..", "..", ".."),
  ];
}

export function resolveToolchain(
  opts: { explicit?: string | null; env?: Record<string, string | undefined>; execPath?: string; here?: string } = {},
): Toolchain {
  const env = opts.env ?? process.env;
  const explicit = opts.explicit ?? env.KIBO_TOOLCHAIN;
  if (explicit) {
    if (!hasSdk(explicit)) throw new KiboError("NOT_FOUND", `toolchain not found in ${explicit}`);
    return { root: explicit };
  }
  const found = candidates(opts.execPath ?? process.execPath, opts.here ?? import.meta.dir).find(hasSdk);
  if (!found) throw new KiboError("NOT_FOUND", "toolchain not found, set KIBO_TOOLCHAIN");
  return { root: found };
}

export const toolchainModules = (t: Toolchain): string => join(t.root, "node_modules");
```

`packages/devkit/src/bun-command.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { isCompiled } from "./toolchain";

export type BunCommand = { argv: string[]; env: Record<string, string> };

export const BUN_BE_BUN_SUPPORTED = true;

export function bunCommand(
  opts: { compiled?: boolean; execPath?: string; which?: (bin: string) => string | null } = {},
): BunCommand {
  const compiled = opts.compiled ?? isCompiled();
  const execPath = opts.execPath ?? process.execPath;
  if (!compiled) return { argv: [execPath], env: {} };
  if (BUN_BE_BUN_SUPPORTED) return { argv: [execPath], env: { BUN_BE_BUN: "1" } };
  const found = (opts.which ?? Bun.which)("bun");
  if (!found) throw new KiboError("VALIDATION_FAILED", "bun is not installed or not in PATH");
  return { argv: [found], env: {} };
}
```

`packages/devkit/src/typescript.ts` (chargement de l'API TypeScript depuis la toolchain, décision 13, partagé par les tâches 4, 5 et 20) :
```ts
import type * as TS from "typescript";
import type { Toolchain } from "./toolchain";

export type TypeScript = typeof TS;

export async function loadTypeScript(t: Toolchain): Promise<TypeScript> {
  const ts: TypeScript = await import(Bun.resolveSync("typescript", t.root));
  return ts;
}
```

`packages/devkit/src/issues.ts` (problèmes de source structurés ; la mise en français est faite par la validation, tâche 20) :
```ts
export type SourceIssueCode =
  | "forbidden-import"
  | "outside-import"
  | "non-literal-import"
  | "banned-identifier"
  | "non-literal-argument"
  | "reserved-command"
  | "unknown-entity";

export type SourceIssue = { file: string; line: number; code: SourceIssueCode; detail: string };

export const issueAt = (file: string, line: number, code: SourceIssueCode, detail: string): SourceIssue => ({
  file,
  line,
  code,
  detail,
});
```

`packages/devkit/src/index.ts` :
```ts
export * from "./bun-command";
export * from "./issues";
export * from "./restrict";
export * from "./tailwind";
export * from "./toolchain";
export * from "./typescript";
```

Run: `bun test packages/devkit/src/toolchain.test.ts`
Expected: FAIL tant que `restrict.ts` et `tailwind.ts` n'existent pas (import de l'index non utilisé par ce test : il doit PASSER ; si Bun résout l'index, créer d'abord les deux fichiers des étapes 4 et 6).

- [x] **Step 4: Écrire `restrict.ts` et les préchargements**

`packages/devkit/src/restrict.ts` :
```ts
import { KiboError } from "@kibo/schema";

const GLOBALS = ["fetch", "WebSocket", "XMLHttpRequest", "EventSource"] as const;
const BUN_CAPS = ["spawn", "spawnSync", "file", "write", "connect", "listen", "serve", "udpSocket", "$", "openInEditor"] as const;
const PROCESS_CAPS = ["binding", "_linkedBinding", "dlopen", "getBuiltinModule", "kill", "chdir"] as const;

export const RESTRICTED = { globals: GLOBALS, bun: BUN_CAPS, process: PROCESS_CAPS } as const;

function remove(target: object, name: string): void {
  if (!Reflect.has(target, name)) return;
  const done = Reflect.defineProperty(target, name, {
    value: undefined,
    writable: false,
    configurable: false,
    enumerable: false,
  });
  if (!done) Reflect.deleteProperty(target, name);
  if (Reflect.get(target, name) !== undefined) throw new KiboError("INTERNAL", `cannot remove capability ${name}`);
}

export function restrictGlobals(opts: { freeze: boolean }): void {
  for (const name of GLOBALS) remove(globalThis, name);
  for (const name of BUN_CAPS) remove(Bun, name);
  for (const name of PROCESS_CAPS) remove(process, name);
  if (opts.freeze) Object.freeze(globalThis);
}
```
`Reflect.defineProperty` renvoie `false` au lieu de lever une exception : aucune erreur n'est avalée, et le contrôle final lève `INTERNAL` si une capacité survit (le runtime refuse alors de charger le code : échec fermé).

`packages/devkit/src/preload/happydom.ts` :
```ts
import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);
```

`packages/devkit/src/preload/restrict.ts` :
```ts
import { restrictGlobals } from "../restrict";

restrictGlobals({ freeze: false });
```
Ordre obligatoire : `happydom` puis `restrict` (happy-dom installe son propre `fetch`, que `restrict` retire ensuite). Pas de gel de `globalThis` sous `bun test` : happy-dom et testing-library écrivent des globales pendant les tests.

- [x] **Step 5: Écrire les spikes A, B et C**

`packages/devkit/src/spikes/spike-kit.ts` :
```ts
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dir, "../../../..");

export function tempDir(prefix: string): { dir: string; dispose(): void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

export function linkModules(dir: string): void {
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "dir");
}

export async function compileBinary(entrypoints: string[], outfile: string): Promise<void> {
  const result = await Bun.build({ entrypoints, compile: { outfile } });
  if (!result.success) throw new AggregateError(result.logs, "compile failed");
}
```

`packages/devkit/src/spikes/bun-be-bun.test.ts` (spike A) :
```ts
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileBinary, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-a-");
afterAll(tmp.dispose);

test("a compiled binary behaves like bun when BUN_BE_BUN=1", async () => {
  const entry = join(tmp.dir, "main.ts");
  writeFileSync(entry, 'console.log("daemon-main");\n');
  const bin = join(tmp.dir, "kd");
  await compileBinary([entry], bin);
  expect(Bun.spawnSync([bin]).stdout.toString()).toContain("daemon-main");
  const version = Bun.spawnSync([bin, "--version"], { env: { BUN_BE_BUN: "1" } });
  expect(version.stdout.toString().trim()).toBe(Bun.version);
  const suite = join(tmp.dir, "suite");
  mkdirSync(suite);
  writeFileSync(join(suite, "a.test.ts"), 'import { expect, test } from "bun:test";\ntest("ok", () => expect(1).toBe(1));\n');
  const run = Bun.spawnSync([bin, "test"], { cwd: suite, env: { BUN_BE_BUN: "1" } });
  expect(run.exitCode).toBe(0);
}, 120_000);
```

`packages/devkit/src/spikes/restrict.test.ts` (spikes B et C) :
```ts
import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { linkModules, REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-b-");
afterAll(tmp.dispose);

const SUITE = `import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

test("capabilities are gone", () => {
  expect(globalThis.fetch).toBeUndefined();
  expect(globalThis.WebSocket).toBeUndefined();
  expect(Bun.spawn).toBeUndefined();
  expect(Bun.file).toBeUndefined();
  expect(Bun.write).toBeUndefined();
  expect(process.binding).toBeUndefined();
  expect(process.getBuiltinModule).toBeUndefined();
});

test("the DOM still works", () => {
  render(createElement("p", null, "ok"));
  expect(screen.getByText("ok")).toBeTruthy();
});

test("a constructed dynamic import is refused", async () => {
  const load = new Function("s", "return import(s)");
  await expect(load("node:fs")).rejects.toThrow();
});
`;

test("bun test runs a suite with happy-dom then restrict preloaded", () => {
  linkModules(tmp.dir);
  writeFileSync(join(tmp.dir, "suite.test.ts"), SUITE);
  const preload = join(REPO, "packages/devkit/src/preload");
  const run = Bun.spawnSync(
    [process.execPath, "test", "--preload", join(preload, "happydom.ts"), "--preload", join(preload, "restrict.ts")],
    { cwd: tmp.dir, env: { HOME: tmp.dir, TMPDIR: tmp.dir } },
  );
  const output = run.stderr.toString();
  expect(output).toContain("3 pass");
  expect(run.exitCode).toBe(0);
}, 60_000);
```

Run: `bun test packages/devkit/src/spikes/bun-be-bun.test.ts packages/devkit/src/spikes/restrict.test.ts`
Expected: A PASS ; B PASS ; C (« a constructed dynamic import is refused ») probablement FAIL.

- [x] **Step 6: Tenter de bloquer l'import construit (spike C)**

Ajouter à `restrict.ts` un plugin runtime qui refuse les modules intégrés (`bun:test` reste permis, il est déjà chargé par le runner) :
```ts
const DENIED = /^(node:|bun:(?!test$)|bun$|fs$|child_process$|net$|http$|https$|os$|worker_threads$|module$|vm$)/;

function denyBuiltins(): void {
  Bun.plugin({
    name: "kibo-deny-builtins",
    setup(build) {
      build.onResolve({ filter: DENIED }, (args) => {
        throw new KiboError("PERMISSION_DENIED", `import denied: ${args.path}`);
      });
    },
  });
}
```
Appeler `denyBuiltins()` en tête de `restrictGlobals` (runtime et préchargement de test), puis ajouter `"plugin"` à `BUN_CAPS` pour qu'un composant ne puisse pas retirer le plugin.
Relancer : `bun test packages/devkit/src/spikes/restrict.test.ts`.
- Si C passe et que B passe toujours (happy-dom peut charger paresseusement des modules intégrés : le vérifier) : garder le plugin, consigner « bloqué par un plugin runtime » dans le tableau des résultats.
- Si C échoue toujours (Bun ne fait pas passer les modules intégrés par `onResolve`) ou si le plugin casse B : retirer le plugin, renommer le test en `"KNOWN LIMIT E2: a constructed dynamic import is not blocked"` avec `await expect(load("node:fs")).resolves.toBeDefined()` (le compte reste « 3 pass »), consigner le résultat et **prévenir le chef d'équipe** (point E2).

- [x] **Step 7: Écrire `tailwind.ts` et le spike D**

`packages/devkit/src/tailwind.ts` :
```ts
import type { Toolchain } from "./toolchain";

type TailwindCompiler = { build(candidates: string[]): string };
type TailwindNode = {
  compile(css: string, opts: { base: string; onDependency: (path: string) => void }): Promise<TailwindCompiler>;
};
type OxideScanner = { scan(): string[] };
type Oxide = {
  Scanner: new (opts: { sources: { base: string; pattern: string; negated: boolean }[] }) => OxideScanner;
};

async function loadTailwind(t: Toolchain): Promise<{ node: TailwindNode; oxide: Oxide }> {
  const node: TailwindNode = await import(Bun.resolveSync("@tailwindcss/node", t.root));
  const oxide: Oxide = await import(Bun.resolveSync("@tailwindcss/oxide", t.root));
  return { node, oxide };
}

export async function compileCss(input: { css: string; sources: string[]; toolchain: Toolchain }): Promise<string> {
  const { node, oxide } = await loadTailwind(input.toolchain);
  const dependencies: string[] = [];
  const compiler = await node.compile(input.css, {
    base: input.toolchain.root,
    onDependency: (path) => dependencies.push(path),
  });
  const scanner = new oxide.Scanner({
    sources: input.sources.map((base) => ({ base, pattern: "**/*", negated: false })),
  });
  return compiler.build(scanner.scan());
}
```

`packages/devkit/src/spikes/tailwind.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileCss } from "../tailwind";
import { REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-d-");
afterAll(tmp.dispose);

test("tailwind compiles only the classes used by a folder outside the monorepo", async () => {
  writeFileSync(join(tmp.dir, "ui.tsx"), 'export const A = () => <p className="bg-emerald-500 p-3">a</p>;\n');
  const css = await compileCss({ css: '@import "tailwindcss";', sources: [tmp.dir], toolchain: { root: REPO } });
  expect(css).toContain(".bg-emerald-500");
  expect(css).toContain(".p-3");
  expect(css).not.toContain(".bg-rose-500");
}, 30_000);
```

Run: `bun test packages/devkit/src/spikes/tailwind.test.ts`
Expected: PASS. Si l'API de `@tailwindcss/node` 4.1.13 diffère (signature de `compile`, `Scanner`), l'adapter en lisant `node_modules/@tailwindcss/node/dist/index.d.ts` et `node_modules/@tailwindcss/oxide/index.d.ts` ; si le chargement natif échoue, appliquer le repli du tableau (spike D).

- [x] **Step 8: Écrire les spikes D, E, F, G dans un binaire compilé**

`packages/devkit/src/spikes/compiled.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileBinary, REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-c-");
afterAll(tmp.dispose);

test("tailwind and typescript load from the toolchain inside a compiled binary", async () => {
  const entry = join(tmp.dir, "probe.ts");
  writeFileSync(
    entry,
    `import { join } from "node:path";
import { compileCss } from ${JSON.stringify(join(REPO, "packages/devkit/src/tailwind.ts"))};
const [src, root] = process.argv.slice(2);
const css = await compileCss({ css: '@import "tailwindcss";', sources: [src], toolchain: { root } });
const ts = await import(Bun.resolveSync("typescript", root));
const program = ts.createProgram([join(src, "ok.ts")], { noEmit: true, strict: true, target: 9 });
console.log(JSON.stringify({ css: css.includes(".bg-emerald-500"), diagnostics: ts.getPreEmitDiagnostics(program).length }));
`,
  );
  writeFileSync(join(tmp.dir, "ui.tsx"), 'export const A = () => <p className="bg-emerald-500">a</p>;\n');
  writeFileSync(join(tmp.dir, "ok.ts"), "export const answer: number = [1, 2].map((n) => n * 21)[1] ?? 0;\n");
  const bin = join(tmp.dir, "probe");
  await compileBinary([entry], bin);
  const run = Bun.spawnSync([bin, tmp.dir, REPO]);
  expect(run.stderr.toString()).toBe("");
  expect(JSON.parse(run.stdout.toString())).toEqual({ css: true, diagnostics: 0 });
}, 120_000);

test("a compiled binary starts a worker given as an extra entrypoint", async () => {
  const main = join(tmp.dir, "main-worker.ts");
  const worker = join(tmp.dir, "echo-worker.ts");
  writeFileSync(worker, 'self.onmessage = (e) => postMessage(`pong:${e.data}`);\n');
  writeFileSync(
    main,
    'const w = new Worker("./echo-worker.ts");\nw.onmessage = (e) => { console.log(e.data); process.exit(0); };\nw.postMessage("x");\n',
  );
  const bin = join(tmp.dir, "with-worker");
  await compileBinary([main, worker], bin);
  expect(Bun.spawnSync([bin]).stdout.toString().trim()).toBe("pong:x");
}, 120_000);

test("a child process reads a payload from file descriptor 3", async () => {
  const child = join(tmp.dir, "fd3-child.ts");
  writeFileSync(child, "const text = await Bun.file(3).text();\nconsole.log(text.length);\n");
  const payload = "x".repeat(200_000);
  const proc = Bun.spawn([process.execPath, child], { stdio: ["ignore", "pipe", "pipe", "pipe"] });
  const fd3 = proc.stdio[3];
  expect(typeof fd3).toBe("number");
  await Bun.write(Bun.file(Number(fd3)), payload);
  expect((await new Response(proc.stdout).text()).trim()).toBe("200000");
}, 60_000);
```
Le troisième test documente l'API réelle : si `Bun.spawn` n'expose pas d'écriture sur le descripteur 3, le réécrire avec l'API disponible (voir `node_modules/bun-types/bun.d.ts`, `SpawnOptions.stdio`) ; si aucune ne fonctionne, le supprimer et appliquer le repli G (code dans le message IPC `load`, tâche 11).

Run: `bun test packages/devkit/src/spikes`
Expected: PASS, ou échecs documentés et replis appliqués.

- [x] **Step 9: Consigner les résultats et vérifier**

Remplir le tableau « Résultats des spikes » de ce plan (colonne Résultat : « OK » ou le message d'échec, colonne Décision : ce qui est appliqué). Mettre `BUN_BE_BUN_SUPPORTED` à `false` si le spike A a échoué.

Run: `bun test packages/devkit && bun run check && bun run typecheck`
Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add package.json bun.lock CLAUDE.md packages/devkit docs/superpowers/plans/2026-09-26-kibo-composants.md
git commit -m "test(devkit): spikes de la toolchain"
```

---

### Task 2: Interfaces figées (schéma v1, protocoles, RPC, textes UI)

Toutes les tâches suivantes consomment ces types ; aucune ne les modifie sans passer par le chef d'équipe. Inclut les correctifs minimaux de compilation dans `sdk` et le report des décisions dans la spec.

**Files:**
- Create: `packages/schema/src/semver.ts`, `config.ts`, `net.ts`, `permissions.ts`, `command.ts`, `call.ts`, `note.ts`, `component.ts`, `protocol.ts`, `migrations.ts`, `packages/schema/src/component.test.ts`, `packages/schema/src/protocol.test.ts`
- Modify: `packages/schema/src/errors.ts`, `manifest.ts`, `instance.ts`, `rpc.ts`, `index.ts`, `schema.test.ts` ; `packages/sdk/package.json` (exports), `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/sdk.test.ts` ; `packages/ui/src/i18n/fr.ts` ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` (§15)

**Interfaces:**
- Consumes: schéma v0.1 (`ProjectCommand`, `Instance`, `Ticket`…).
- Produces (tout exporté par `@kibo/schema`) :
  - `KIBO_ERROR_CODES`, `KiboErrorCode`, `isKiboErrorCode(v): v is KiboErrorCode`.
  - `SemVer`, `compareSemver(a, b): -1 | 0 | 1`.
  - `BuiltinEntityType` (alias `EntityType`), `NetRule`, `ComponentManifest` (v1, `z.infer` = sortie avec défauts), `ComponentManifestInput` (`z.input`), `ConfigField`, `ConfigSchema`, `configDefaults(schema)`, `validateConfig(schema, config): string[]`.
  - `ruleCovers(rule, url): boolean`.
  - `GrantedPermissions`, `NO_PERMISSIONS`, `grantedOf(m)`, `permissionList(g): string[]`, `permissionOfCall(call): string | null`, `covers(declared, used)`, `diffPermissions(declared, used)`, `addedPermissions(prev, next)`.
  - `ProjectCommand` (+ `setInstanceComponent`, `setInstanceConfig`, `setInstanceData`), `COMMAND_WRITES`, `isReservedCommand(method)`, `CommandResult`.
  - `DataKey`, `INSTANCE_DATA_LIMIT = 262_144`, `splitRef(ref)`, `formatRef(id, version)`.
  - `FetchInit`, `FetchResponse`, `ComponentCall`.
  - `NotePath`, `isSafeNotePath(p)`, `NoteMeta`, `NoteContent`, `NotesInfo`.
  - `BUILTIN_IDS`, `isBuiltinId`, `TrustLevel`, `ApprovableTrust`, `ComponentOrigin`, `Sha256`, `RegistryVersion`, `RegistryEntry`, `isActive(v)`, `shortHash(h)`, `SDK_UI_PRIMITIVES`, `SHARED_SPECIFIERS`, `SERVER_SPECIFIERS`, `TEST_SPECIFIERS`, `USED_MARKER`, `sandboxPath(...)`, `trustedPath(...)`, `ValidationReport`, `ComponentUsage`, `ComponentVersionSummary`, `ComponentSummary`, `DraftSummary`, `PublishUsage`, `PublishPreview`, `PublishResult`, `RuntimeInfo`.
  - `Theme`, `Surface`, `KeyCombo`, `HostToFrame`, `FrameToHost`, `InvokeTarget`, `BackendCode`, `DaemonToBackend`, `BackendToDaemon`, `BackendDescription`.
  - `MigrationStep`, `Migrations`, `applyMigrations(m, from, to, input)`.
  - `RpcRequest` (+ 15 méthodes) et `RpcResult` correspondant.
  - `fr.components`, `fr.publish`, `fr.trust`, `fr.addComponent` (complété), `fr.createComponent`, `fr.instance`, `fr.notesDir`, `fr.openView`, `fr.cli`.

- [x] **Step 1: Reporter les décisions dans la spec**

Ajouter à la fin de `docs/superpowers/specs/2026-09-26-kibo-composants.md` une section `## 15. Décisions d'implémentation (plan de phase 4)` qui reprend mot pour mot la liste « Décisions techniques de ce plan » (points 1 à 23) et le tableau des points E1 à E4 avec la mention « option A appliquée en attendant l'arbitrage d'Adam ».

- [x] **Step 2: Écrire les tests du schéma v1**

`packages/schema/src/component.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import {
  addedPermissions,
  applyMigrations,
  COMMAND_WRITES,
  ComponentCall,
  ComponentManifest,
  compareSemver,
  configDefaults,
  diffPermissions,
  grantedOf,
  isActive,
  isSafeNotePath,
  NetRule,
  permissionList,
  permissionOfCall,
  ruleCovers,
  shortHash,
  splitRef,
  validateConfig,
} from "./index";

const v0 = { id: "kanban", version: "1.0.0", kind: "both", title: "Kanban", reads: ["ticket"], writes: [] };

describe("manifest v1", () => {
  test("a v0 manifest is accepted with defaults", () => {
    const m = ComponentManifest.parse(v0);
    expect(m.data).toBe(false);
    expect(m.net).toEqual([]);
    expect(m.configVersion).toBe(0);
    expect(m.changes).toEqual([]);
    expect(m.sdk).toBe(1);
  });
  test("note is a builtin entity", () => {
    expect(ComponentManifest.safeParse({ ...v0, reads: ["note"] }).success).toBe(true);
  });
  test("net rules are https host + path prefix only", () => {
    for (const ok of ["api.github.com", "api.github.com/graphql", "a.b-c.io/x/y_z.~"]) {
      expect(NetRule.safeParse(ok).success).toBe(true);
    }
    for (const bad of ["10.0.0.1", "api.github.com:443", "*.github.com", "http://api.github.com", "localhost", ""]) {
      expect(NetRule.safeParse(bad).success).toBe(false);
    }
  });
  test("configSchema uses field descriptors", () => {
    const m = ComponentManifest.parse({
      ...v0,
      configSchema: { filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" } },
    });
    expect(configDefaults(m.configSchema)).toEqual({ filter: "mine-and-agents" });
    expect(validateConfig(m.configSchema, { filter: "all" })).toEqual([]);
    expect(validateConfig(m.configSchema, { filter: "mine" })).toHaveLength(1);
    expect(validateConfig(m.configSchema, { other: 1 })).toEqual(["other: unknown key"]);
    expect(validateConfig(undefined, {})).toEqual([]);
    expect(validateConfig({ path: { type: "string", nullable: true } }, { path: null })).toEqual([]);
    expect(validateConfig({ path: { type: "string" } }, { path: null })).toHaveLength(1);
  });
});

describe("net", () => {
  test("a rule covers https URLs on its host under its path prefix", () => {
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql")).toBe(true);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql/x?y=1")).toBe(true);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphqlx")).toBe(false);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql/../admin")).toBe(false);
    expect(ruleCovers("api.github.com", "http://api.github.com/")).toBe(false);
    expect(ruleCovers("api.github.com", "https://api.github.com:8443/")).toBe(false);
    expect(ruleCovers("api.github.com", "https://evil.com/?h=api.github.com")).toBe(false);
    expect(ruleCovers("api.github.com", "https://user@api.github.com/")).toBe(false);
    expect(ruleCovers("api.github.com", "not a url")).toBe(false);
  });
});

describe("permissions", () => {
  const m = ComponentManifest.parse({ ...v0, writes: ["ticket"], data: true, net: ["api.github.com/graphql"] });
  test("a manifest lists its permissions", () => {
    expect(permissionList(grantedOf(m))).toEqual(["read:ticket", "write:ticket", "data", "net:api.github.com/graphql"]);
  });
  test("each call maps to one permission", () => {
    expect(permissionOfCall({ kind: "list", entity: "status" })).toBe("read:status");
    expect(permissionOfCall({ kind: "run", command: { method: "deleteTicket", ticketId: "1@1" } })).toBe("write:ticket");
    expect(
      permissionOfCall({ kind: "run", command: { method: "setInstanceData", instanceId: "i", key: "k", value: 1 } }),
    ).toBe("write:setInstanceData");
    expect(permissionOfCall({ kind: "data.keys" })).toBe("data");
    expect(permissionOfCall({ kind: "notes.search", query: "x" })).toBe("read:note");
    expect(permissionOfCall({ kind: "notes.remove", path: "a.md" })).toBe("write:note");
    expect(permissionOfCall({ kind: "action", name: "x", input: null })).toBeNull();
  });
  test("used net URLs are covered by declared rules", () => {
    const declared = permissionList(grantedOf(m));
    const d = diffPermissions(declared, ["read:ticket", "net:https://api.github.com/graphql", "write:link"]);
    expect(d.missing).toEqual(["write:link"]);
    expect(d.unused).toEqual(["write:ticket", "data"]);
  });
  test("added permissions compare two grants", () => {
    const before = grantedOf(ComponentManifest.parse(v0));
    expect(addedPermissions(before, grantedOf(m))).toEqual(["write:ticket", "data", "net:api.github.com/graphql"]);
    expect(addedPermissions(null, before)).toEqual(["read:ticket"]);
  });
  test("reserved commands write nothing a component can declare", () => {
    expect(COMMAND_WRITES.setInstanceData).toBeNull();
    expect(COMMAND_WRITES.setInstanceComponent).toBeNull();
    expect(COMMAND_WRITES.addInstance).toBeNull();
  });
});

describe("calls", () => {
  test("component calls are validated", () => {
    expect(ComponentCall.safeParse({ kind: "data.set", key: "a.b-c_1", value: { x: 1 } }).success).toBe(true);
    expect(ComponentCall.safeParse({ kind: "data.get", key: "../x" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "notes.read", path: "../x.md" }).success).toBe(false);
    const f = ComponentCall.parse({ kind: "fetch", url: "https://api.github.com/x", init: {} });
    expect(f.kind === "fetch" && f.init.method).toBe("GET");
  });
  test("note paths stay relative, visible and markdown", () => {
    expect(isSafeNotePath("notes/decisions.md")).toBe(true);
    for (const bad of ["../x.md", "a/../../x.md", "/etc/x.md", ".obsidian/x.md", "a//b.md", "x.txt", "a\\b.md"]) {
      expect(isSafeNotePath(bad)).toBe(false);
    }
  });
});

describe("versions", () => {
  test("semver compares numerically", () => {
    expect(compareSemver("0.10.0", "0.9.9")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
  });
  test("refs split on the last @", () => {
    expect(splitRef("acme.pr-bar@0.3.0")).toEqual({ id: "acme.pr-bar", version: "0.3.0" });
    expect(() => splitRef("nope")).toThrow("INVALID_INPUT");
  });
  test("a version is active when its approved hash is its hash", () => {
    const h = "a".repeat(64);
    expect(isActive({ trust: "sandboxed", hash: h, approvedHash: h })).toBe(true);
    expect(isActive({ trust: null, hash: h, approvedHash: h })).toBe(false);
    expect(isActive({ trust: "trusted", hash: h, approvedHash: "b".repeat(64) })).toBe(false);
    expect(shortHash(`3f9a${"0".repeat(56)}c21e`)).toBe("3f9a…c21e");
  });
  test("migrations run from n-1 to n and refuse a downgrade", () => {
    const m = {
      1: { config: (c: Record<string, unknown>) => ({ ...c, v: 1 }) },
      2: { data: (d: Record<string, unknown>) => ({ ...d, moved: true }) },
    };
    expect(applyMigrations(m, 0, 2, { config: {}, data: {} })).toEqual({ config: { v: 1 }, data: { moved: true } });
    expect(() => applyMigrations(m, 2, 1, { config: {}, data: {} })).toThrow("INVALID_INPUT");
  });
});
```

`packages/schema/src/protocol.test.ts` :
```ts
import { expect, test } from "bun:test";
import { BackendToDaemon, DaemonToBackend, FrameToHost, HostToFrame } from "./index";

test("frame messages are validated and never carry an instance id", () => {
  const call = FrameToHost.parse({
    kibo: 1,
    type: "call",
    id: 1,
    call: { kind: "list", entity: "ticket" },
    instanceId: "someone-else",
  });
  expect("instanceId" in call).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 2, type: "ready" }).success).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 1, type: "key", combo: "mod+q" }).success).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 1, type: "resize", height: -1 }).success).toBe(false);
});

test("host messages include init with surface and theme", () => {
  const init = HostToFrame.parse({
    kibo: 1,
    type: "init",
    instanceId: "i",
    config: {},
    viewer: "adam",
    theme: "dark",
    surface: "widget",
  });
  expect(init.type).toBe("init");
  expect(HostToFrame.safeParse({ kibo: 1, type: "reply", id: 1, ok: false, error: { code: "X", message: "m" } }).success).toBe(true);
});

test("backend messages carry invocations and calls", () => {
  expect(
    DaemonToBackend.safeParse({
      type: "invoke",
      id: 1,
      instanceId: "i",
      config: {},
      target: { migrate: { from: 0, to: 1, config: {}, data: {} } },
      input: null,
    }).success,
  ).toBe(true);
  expect(BackendToDaemon.safeParse({ type: "call", id: 3, invocation: 1, call: { kind: "data.keys" } }).success).toBe(true);
  expect(BackendToDaemon.safeParse({ type: "call", id: 3, call: { kind: "data.keys" } }).success).toBe(false);
  expect(BackendToDaemon.safeParse({ type: "ready", actions: ["ping"], jobs: [{ name: "sync", everyMinutes: 0 }] }).success).toBe(false);
});
```

Dans `schema.test.ts`, le test « manifest » existant reste valide (les nouveaux champs ont des défauts).

Run: `bun test packages/schema`
Expected: FAIL (exports manquants).

- [x] **Step 3: Écrire `errors.ts`, `semver.ts`, `net.ts`, `config.ts`**

`packages/schema/src/errors.ts` :
```ts
export const KIBO_ERROR_CODES = [
  "TREE_CYCLE",
  "NOT_FOUND",
  "BLOCKED_REASON_REQUIRED",
  "INVALID_INPUT",
  "LINK_CYCLE",
  "STORE_CORRUPT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "PERMISSION_DENIED",
  "INTERNAL",
  "PATH_OUTSIDE_PROJECT",
  "HASH_MISMATCH",
  "TRUST_REQUIRED",
  "VERSION_EXISTS",
  "VALIDATION_FAILED",
  "MIGRATION_FAILED",
  "COMPONENT_CRASHED",
  "TIMEOUT",
  "CONFLICT",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
] as const;

export type KiboErrorCode = (typeof KIBO_ERROR_CODES)[number];

export const isKiboErrorCode = (v: unknown): v is KiboErrorCode =>
  typeof v === "string" && (KIBO_ERROR_CODES as readonly string[]).includes(v);

export class KiboError extends Error {
  constructor(
    readonly code: KiboErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "KiboError";
  }
}
```
Les codes ajoutés par les phases 2 et 3 (déjà présents dans l'union) sont conservés dans le tableau.

`packages/schema/src/semver.ts` :
```ts
import { z } from "zod";

export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/);
export type SemVer = z.infer<typeof SemVer>;

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
```

`packages/schema/src/net.ts` :
```ts
import { z } from "zod";

export const NetRule = z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~/-]*)?$/);
export type NetRule = z.infer<typeof NetRule>;

export function ruleCovers(rule: string, url: string): boolean {
  if (!URL.canParse(url)) return false;
  const u = new URL(url);
  if (u.protocol !== "https:" || u.port !== "" || u.username !== "" || u.password !== "") return false;
  const slash = rule.indexOf("/");
  const host = slash < 0 ? rule : rule.slice(0, slash);
  const prefix = slash < 0 ? "" : rule.slice(slash);
  if (u.hostname !== host) return false;
  if (prefix === "" || prefix === "/") return true;
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return u.pathname === base || u.pathname.startsWith(`${base}/`);
}
```

`packages/schema/src/config.ts` :
```ts
import { z } from "zod";

export const ConfigField = z
  .object({
    type: z.enum(["string", "number", "boolean"]).optional(),
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .min(1)
      .optional(),
    nullable: z.boolean().optional(),
    default: z.unknown().optional(),
  })
  .strict();
export type ConfigField = z.infer<typeof ConfigField>;

export const ConfigSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), ConfigField);
export type ConfigSchema = z.infer<typeof ConfigSchema>;

export function configDefaults(schema: ConfigSchema | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema ?? {})) if (field.default !== undefined) out[key] = field.default;
  return out;
}

const SCALAR = new Set(["string", "number", "boolean"]);

function fieldError(key: string, field: ConfigField, value: unknown): string | null {
  if (value === null) return field.nullable ? null : `${key}: null not allowed`;
  if (field.enum && !field.enum.some((e) => e === value)) return `${key}: not one of ${field.enum.join(", ")}`;
  if (field.type && typeof value !== field.type) return `${key}: expected ${field.type}`;
  if (!SCALAR.has(typeof value)) return `${key}: unsupported value`;
  return null;
}

export function validateConfig(schema: ConfigSchema | undefined, config: Record<string, unknown>): string[] {
  const fields = schema ?? {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const field = fields[key];
    const error = field ? fieldError(key, field, value) : `${key}: unknown key`;
    if (error) errors.push(error);
  }
  return errors;
}
```

- [x] **Step 4: Écrire `manifest.ts`, `instance.ts`, `command.ts`, `note.ts`, `call.ts`**

`packages/schema/src/manifest.ts` :
```ts
import { z } from "zod";
import { ConfigSchema } from "./config";
import { NetRule } from "./net";
import { SemVer } from "./semver";

export const BuiltinEntityType = z.enum(["ticket", "status", "link", "page", "note"]);
export type BuiltinEntityType = z.infer<typeof BuiltinEntityType>;
export const EntityType = BuiltinEntityType;
export type EntityType = BuiltinEntityType;

export const ComponentManifest = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/),
  version: SemVer,
  kind: z.enum(["widget", "view", "both"]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean().default(false),
  net: z.array(NetRule).default([]),
  configSchema: ConfigSchema.optional(),
  configVersion: z.number().int().nonnegative().default(0),
  changes: z.array(z.string().min(1)).default([]),
  sdk: z.literal(1).default(1),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;
export type ComponentManifestInput = z.input<typeof ComponentManifest>;
```

`packages/schema/src/instance.ts` :
```ts
import { z } from "zod";
import { KiboError } from "./errors";
import { NodeId } from "./ids";

export const ComponentRef = z.string().regex(/^[a-z][a-z0-9.-]*@\d+\.\d+\.\d+$/);
export const Layout = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type Layout = z.infer<typeof Layout>;
export const Instance = z.object({
  id: z.string(),
  pageId: NodeId,
  component: ComponentRef,
  layout: Layout,
  config: z.record(z.string(), z.unknown()),
});
export type Instance = z.infer<typeof Instance>;

export const DataKey = z.string().regex(/^[A-Za-z0-9._-]{1,128}$/);
export const INSTANCE_DATA_LIMIT = 262_144;

export function splitRef(ref: string): { id: string; version: string } {
  const at = ref.lastIndexOf("@");
  if (at <= 0) throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
  return { id: ref.slice(0, at), version: ref.slice(at + 1) };
}

export const formatRef = (id: string, version: string): string => `${id}@${version}`;
```

`packages/schema/src/command.ts` (déplacement de `ProjectCommand` depuis `rpc.ts`, plus les trois commandes réservées) :
```ts
import { z } from "zod";
import { NodeId } from "./ids";
import { ComponentRef, DataKey, type Instance, Layout } from "./instance";
import type { Link } from "./link";
import type { EntityType } from "./manifest";
import { type Page, PageKind } from "./page";
import { StatusId } from "./status";
import { Assignee, type Ticket } from "./ticket";

const index = z.number().int().nonnegative().optional();
const JsonRecord = z.record(z.string(), z.unknown());

export const ProjectCommand = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("addPage"),
    title: z.string(),
    kind: PageKind,
    parentId: NodeId.nullable().optional(),
  }),
  z.object({ method: z.literal("renamePage"), pageId: NodeId, title: z.string() }),
  z.object({ method: z.literal("movePage"), pageId: NodeId, parentId: NodeId.nullable(), index }),
  z.object({ method: z.literal("deletePage"), pageId: NodeId }),
  z.object({
    method: z.literal("createTicket"),
    title: z.string(),
    description: z.string().optional(),
    statusId: StatusId.optional(),
    parentId: NodeId.nullable().optional(),
    assignee: Assignee.nullable().optional(),
  }),
  z.object({
    method: z.literal("updateTicket"),
    ticketId: NodeId,
    title: z.string().optional(),
    description: z.string().optional(),
    domainId: z.string().nullable().optional(),
    assignee: Assignee.nullable().optional(),
  }),
  z.object({
    method: z.literal("setStatus"),
    ticketId: NodeId,
    statusId: StatusId,
    reason: z.string().optional(),
  }),
  z.object({ method: z.literal("moveTicket"), ticketId: NodeId, parentId: NodeId.nullable(), index }),
  z.object({ method: z.literal("deleteTicket"), ticketId: NodeId }),
  z.object({ method: z.literal("addLink"), from: NodeId, to: NodeId, type: z.enum(["blocks", "relates"]) }),
  z.object({ method: z.literal("removeLink"), linkId: z.string() }),
  z.object({
    method: z.literal("addInstance"),
    pageId: NodeId,
    component: ComponentRef,
    layout: Layout.optional(),
    config: JsonRecord.optional(),
  }),
  z.object({ method: z.literal("removeInstance"), instanceId: z.string() }),
  z.object({
    method: z.literal("setInstanceComponent"),
    instanceId: z.string(),
    component: ComponentRef,
    config: JsonRecord,
    data: JsonRecord.nullable(),
  }),
  z.object({ method: z.literal("setInstanceConfig"), instanceId: z.string(), config: JsonRecord }),
  z.object({ method: z.literal("setInstanceData"), instanceId: z.string(), key: DataKey, value: z.unknown() }),
]);
export type ProjectCommand = z.infer<typeof ProjectCommand>;

export const COMMAND_WRITES: Record<ProjectCommand["method"], EntityType | null> = {
  addPage: "page",
  renamePage: "page",
  movePage: "page",
  deletePage: "page",
  createTicket: "ticket",
  updateTicket: "ticket",
  setStatus: "ticket",
  moveTicket: "ticket",
  deleteTicket: "ticket",
  addLink: "link",
  removeLink: "link",
  addInstance: null,
  removeInstance: null,
  setInstanceComponent: null,
  setInstanceConfig: null,
  setInstanceData: null,
};

export const isReservedCommand = (method: ProjectCommand["method"]): boolean => COMMAND_WRITES[method] === null;

export type CommandResult = {
  addPage: Page;
  renamePage: null;
  movePage: null;
  deletePage: string[];
  createTicket: Ticket;
  updateTicket: Ticket;
  setStatus: Ticket;
  moveTicket: null;
  deleteTicket: string[];
  addLink: Link;
  removeLink: null;
  addInstance: Instance;
  removeInstance: null;
  setInstanceComponent: Instance;
  setInstanceConfig: Instance;
  setInstanceData: null;
};
```

`packages/schema/src/note.ts` :
```ts
import { z } from "zod";

export function isSafeNotePath(p: string): boolean {
  if (!p.endsWith(".md") || p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s.length > 0 && s !== "." && s !== ".." && !s.startsWith("."));
}

export const NotePath = z.string().min(4).max(512).refine(isSafeNotePath, "invalid note path");

export const NoteMeta = z.object({
  path: z.string(),
  title: z.string(),
  mtime: z.number(),
  size: z.number().int().nonnegative(),
  tickets: z.array(z.string()),
  links: z.array(z.string()),
});
export type NoteMeta = z.infer<typeof NoteMeta>;
export const NoteContent = NoteMeta.extend({ markdown: z.string() });
export type NoteContent = z.infer<typeof NoteContent>;

export const NotesInfo = z.object({
  dir: z.string(),
  displayDir: z.string(),
  obsidian: z.boolean(),
  folderRelative: z.string().nullable(),
});
export type NotesInfo = z.infer<typeof NotesInfo>;
```

`packages/schema/src/call.ts` :
```ts
import { z } from "zod";
import { ProjectCommand } from "./command";
import { DataKey } from "./instance";
import { BuiltinEntityType } from "./manifest";
import { NotePath } from "./note";

export const FetchInit = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(1_048_576).optional(),
});
export type FetchInit = z.infer<typeof FetchInit>;
export type FetchInitInput = z.input<typeof FetchInit>;
export type FetchResponse = { status: number; headers: Record<string, string>; body: string };

export const ComponentCall = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), entity: BuiltinEntityType }),
  z.object({ kind: z.literal("run"), command: ProjectCommand }),
  z.object({ kind: z.literal("data.get"), key: DataKey }),
  z.object({ kind: z.literal("data.delete"), key: DataKey }),
  z.object({ kind: z.literal("data.set"), key: DataKey, value: z.unknown() }),
  z.object({ kind: z.literal("data.keys") }),
  z.object({ kind: z.literal("fetch"), url: z.string().max(4096), init: FetchInit }),
  z.object({ kind: z.literal("action"), name: z.string().min(1).max(128), input: z.unknown() }),
  z.object({ kind: z.literal("notes.read"), path: NotePath }),
  z.object({
    kind: z.literal("notes.write"),
    path: NotePath,
    markdown: z.string().max(1_048_576),
    expectedMtime: z.number().nullable(),
  }),
  z.object({ kind: z.literal("notes.rename"), from: NotePath, to: NotePath }),
  z.object({ kind: z.literal("notes.remove"), path: NotePath }),
  z.object({ kind: z.literal("notes.search"), query: z.string().max(200) }),
  z.object({ kind: z.literal("notes.info") }),
]);
export type ComponentCall = z.infer<typeof ComponentCall>;
```

- [x] **Step 5: Écrire `permissions.ts`, `migrations.ts`, `component.ts`, `protocol.ts`**

`packages/schema/src/permissions.ts` :
```ts
import { z } from "zod";
import type { ComponentCall } from "./call";
import { COMMAND_WRITES } from "./command";
import { BuiltinEntityType, type ComponentManifest } from "./manifest";
import { NetRule, ruleCovers } from "./net";

export const GrantedPermissions = z.object({
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean(),
  net: z.array(NetRule),
});
export type GrantedPermissions = z.infer<typeof GrantedPermissions>;

export const NO_PERMISSIONS: GrantedPermissions = { reads: [], writes: [], data: false, net: [] };

const unique = <T>(xs: T[]): T[] => [...new Set(xs)];

export function grantedOf(m: Pick<ComponentManifest, "reads" | "writes" | "data" | "net">): GrantedPermissions {
  return { reads: unique(m.reads), writes: unique(m.writes), data: m.data, net: unique(m.net) };
}

export function permissionList(g: GrantedPermissions): string[] {
  return [
    ...g.reads.map((e) => `read:${e}`),
    ...g.writes.map((e) => `write:${e}`),
    ...(g.data ? ["data"] : []),
    ...g.net.map((r) => `net:${r}`),
  ];
}

export function permissionOfCall(call: ComponentCall): string | null {
  switch (call.kind) {
    case "list":
      return `read:${call.entity}`;
    case "run": {
      const entity = COMMAND_WRITES[call.command.method];
      return entity === null ? `write:${call.command.method}` : `write:${entity}`;
    }
    case "data.get":
    case "data.set":
    case "data.delete":
    case "data.keys":
      return "data";
    case "fetch":
      return `net:${call.url}`;
    case "action":
      return null;
    case "notes.read":
    case "notes.search":
    case "notes.info":
      return "read:note";
    case "notes.write":
    case "notes.rename":
    case "notes.remove":
      return "write:note";
  }
}

export function covers(declared: string[], used: string): boolean {
  if (!used.startsWith("net:")) return declared.includes(used);
  const url = used.slice(4);
  return declared.some((d) => d.startsWith("net:") && ruleCovers(d.slice(4), url));
}

export function diffPermissions(declared: string[], used: string[]): { missing: string[]; unused: string[] } {
  const u = unique(used);
  return {
    missing: u.filter((x) => !covers(declared, x)),
    unused: declared.filter((d) => !u.some((x) => covers([d], x))),
  };
}

export function addedPermissions(prev: GrantedPermissions | null, next: GrantedPermissions): string[] {
  const before = new Set(prev ? permissionList(prev) : []);
  return permissionList(next).filter((p) => !before.has(p));
}
```

`packages/schema/src/migrations.ts` :
```ts
import { KiboError } from "./errors";

type Json = Record<string, unknown>;
export type MigrationStep = { config?: (old: Json) => Json; data?: (old: Json) => Json };
export type Migrations = Readonly<Record<number, MigrationStep>>;

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export function applyMigrations(
  migrations: Migrations,
  from: number,
  to: number,
  input: { config: Json; data: Json },
): { config: Json; data: Json } {
  if (to < from) throw new KiboError("INVALID_INPUT", "configVersion cannot decrease");
  let { config, data } = input;
  for (let n = from + 1; n <= to; n += 1) {
    const step = migrations[n];
    if (step?.config) config = step.config(structuredClone(config));
    if (step?.data) data = step.data(structuredClone(data));
    if (!isRecord(config) || !isRecord(data)) throw new KiboError("MIGRATION_FAILED", `step ${n} returned a non-object`);
  }
  return { config, data };
}
```

`packages/schema/src/component.ts` :
```ts
import { z } from "zod";
import type { KiboErrorCode } from "./errors";
import type { ComponentManifest } from "./manifest";
import { GrantedPermissions } from "./permissions";
import { SemVer } from "./semver";

export const BUILTIN_IDS = ["kanban", "tickets", "graph", "notes"] as const;
export const isBuiltinId = (id: string): boolean => (BUILTIN_IDS as readonly string[]).includes(id);

export const TrustLevel = z.enum(["builtin", "trusted", "sandboxed"]);
export type TrustLevel = z.infer<typeof TrustLevel>;
export const ApprovableTrust = z.enum(["trusted", "sandboxed"]);
export type ApprovableTrust = z.infer<typeof ApprovableTrust>;
export const ComponentOrigin = z.enum(["kibo", "user", "ai", "marketplace"]);
export type ComponentOrigin = z.infer<typeof ComponentOrigin>;
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const RegistryVersion = z.object({
  version: SemVer,
  hash: Sha256,
  origin: ComponentOrigin,
  trust: TrustLevel.nullable(),
  approvedHash: Sha256.nullable(),
  granted: GrantedPermissions,
  publishedAt: z.number().int(),
  autoUpdate: z.boolean().default(false),
});
export type RegistryVersion = z.infer<typeof RegistryVersion>;

export const RegistryEntry = z.object({ title: z.string().min(1), versions: z.record(SemVer, RegistryVersion) });
export type RegistryEntry = z.infer<typeof RegistryEntry>;

export const isActive = (v: Pick<RegistryVersion, "trust" | "hash" | "approvedHash">): boolean =>
  v.trust !== null && v.approvedHash === v.hash;

export const shortHash = (hash: string): string => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

export const SDK_UI_PRIMITIVES = [
  "badge",
  "button",
  "card",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "radio-group",
  "select",
  "separator",
  "sheet",
  "skeleton",
  "textarea",
  "tooltip",
] as const;

export const SHARED_SPECIFIERS: readonly string[] = [
  "react",
  "react/jsx-runtime",
  "lucide-react",
  "@kibo/sdk",
  "@kibo/sdk/lib/utils",
  ...SDK_UI_PRIMITIVES.map((n) => `@kibo/sdk/ui/${n}`),
];
export const SERVER_SPECIFIERS: readonly string[] = ["@kibo/sdk/server", "@kibo/sdk/migrations"];
export const TEST_SPECIFIERS: readonly string[] = [
  "bun:test",
  "@kibo/sdk/conformance",
  "@kibo/sdk/mock",
  "@kibo/sdk/fixtures",
  "@testing-library/react",
];
export const USED_MARKER = "::kibo-used::";

export type SandboxFile = "index.html" | "ui.sandbox.js" | "ui.css";
export type TrustedFile = "ui.trusted.js" | "ui.css";
export const sandboxPath = (id: string, version: string, hash: string, file: SandboxFile): string =>
  `/c/${id}/${version}/${hash}/${file}`;
export const trustedPath = (id: string, version: string, hash: string, file: TrustedFile): string =>
  `/components/${id}/${version}/${hash}/${file}`;

const Step = z.object({ ok: z.boolean(), errors: z.array(z.string()) });
export const ValidationReport = z.object({
  manifest: Step,
  imports: Step,
  typecheck: Step,
  tests: z.object({ ok: z.boolean(), passed: z.number().int(), failed: z.number().int(), output: z.string() }),
  conformance: Step,
  permissions: z.object({
    declared: z.array(z.string()),
    used: z.array(z.string()),
    missing: z.array(z.string()),
    unused: z.array(z.string()),
    errors: z.array(z.string()),
  }),
  hash: Sha256.nullable(),
  ok: z.boolean(),
});
export type ValidationReport = z.infer<typeof ValidationReport>;

export type ComponentUsage = {
  projectId: string;
  projectName: string;
  pageId: string;
  pageTitle: string;
  instanceId: string;
};
export type ComponentVersionSummary = {
  version: string;
  hash: string | null;
  trust: TrustLevel | null;
  origin: ComponentOrigin;
  active: boolean;
  tampered: boolean;
  manifest: ComponentManifest | null;
  usages: ComponentUsage[];
};
export type ComponentSummary = { id: string; title: string; builtin: boolean; versions: ComponentVersionSummary[] };
export type DraftSummary = {
  id: string;
  title: string;
  version: string;
  hash: string | null;
  validated: boolean;
  publishedVersion: string | null;
};
export type PublishUsage = ComponentUsage & { version: string };
export type PublishPreview = {
  id: string;
  title: string;
  from: string | null;
  to: string;
  hash: string;
  status: "new" | "update" | "unchanged";
  usages: PublishUsage[];
  changes: string[];
  newPermissions: string[];
  migration: { from: number; to: number } | null;
  validation: ValidationReport;
};
export type PublishResult = {
  version: RegistryVersion;
  needsApproval: boolean;
  updated: string[];
  failed: { instanceId: string; projectName: string; pageTitle: string; code: KiboErrorCode; message: string }[];
};
export type RuntimeInfo = { sandboxOrigin: string };
```

`packages/schema/src/protocol.ts` :
```ts
import { z } from "zod";
import { ComponentCall } from "./call";
import { ComponentManifest } from "./manifest";
import { StatusId } from "./status";

export const Theme = z.enum(["dark", "light"]);
export type Theme = z.infer<typeof Theme>;
export const Surface = z.enum(["widget", "view"]);
export type Surface = z.infer<typeof Surface>;
export const KeyCombo = z.enum([
  "mod+k",
  "mod+t",
  "mod+w",
  "mod+1",
  "mod+2",
  "mod+3",
  "mod+4",
  "mod+5",
  "mod+6",
  "mod+7",
  "mod+8",
  "mod+9",
  "escape",
]);
export type KeyCombo = z.infer<typeof KeyCombo>;

const Json = z.record(z.string(), z.unknown());
const WireError = z.object({ code: z.string(), message: z.string() });
const Reply = z.object({
  kibo: z.literal(1),
  type: z.literal("reply"),
  id: z.number().int(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: WireError.optional(),
});

export const HostToFrame = z.discriminatedUnion("type", [
  z.object({
    kibo: z.literal(1),
    type: z.literal("init"),
    instanceId: z.string(),
    config: Json,
    viewer: z.string(),
    theme: Theme,
    surface: Surface,
  }),
  z.object({ kibo: z.literal(1), type: z.literal("theme"), theme: Theme }),
  z.object({ kibo: z.literal(1), type: z.literal("changed") }),
  Reply,
]);
export type HostToFrame = z.infer<typeof HostToFrame>;
export type InitMessage = Extract<HostToFrame, { type: "init" }>;

export const FrameToHost = z.discriminatedUnion("type", [
  z.object({ kibo: z.literal(1), type: z.literal("ready") }),
  z.object({ kibo: z.literal(1), type: z.literal("call"), id: z.number().int().nonnegative(), call: ComponentCall }),
  z.object({ kibo: z.literal(1), type: z.literal("openTicket"), ticketId: z.string().min(1) }),
  z.object({
    kibo: z.literal(1),
    type: z.literal("openNewTicket"),
    defaults: z.object({ statusId: StatusId.optional(), parentId: z.string().nullable().optional() }),
  }),
  z.object({
    kibo: z.literal(1),
    type: z.literal("openFile"),
    path: z.string().min(1).max(1024),
    line: z.number().int().positive().optional(),
  }),
  z.object({ kibo: z.literal(1), type: z.literal("openView"), componentId: z.string().min(1).max(128) }),
  z.object({ kibo: z.literal(1), type: z.literal("key"), combo: KeyCombo }),
  z.object({ kibo: z.literal(1), type: z.literal("resize"), height: z.number().int().min(0).max(10_000) }),
]);
export type FrameToHost = z.infer<typeof FrameToHost>;

export const InvokeTarget = z.union([
  z.object({ action: z.string().min(1) }),
  z.object({ job: z.string().min(1) }),
  z.object({ migrate: z.object({ from: z.number().int(), to: z.number().int(), config: Json, data: Json }) }),
]);
export type InvokeTarget = z.infer<typeof InvokeTarget>;

export const BackendCode = z.object({ server: z.string().nullable(), migrations: z.string().nullable() });
export type BackendCode = z.infer<typeof BackendCode>;

const BackendResult = z.object({
  type: z.literal("result"),
  id: z.number().int(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: WireError.optional(),
});

export const DaemonToBackend = z.discriminatedUnion("type", [
  z.object({ type: z.literal("load"), manifest: ComponentManifest, code: BackendCode.optional() }),
  z.object({
    type: z.literal("invoke"),
    id: z.number().int(),
    instanceId: z.string(),
    config: Json,
    target: InvokeTarget,
    input: z.unknown(),
  }),
  BackendResult,
]);
export type DaemonToBackend = z.infer<typeof DaemonToBackend>;

export const BackendDescription = z.object({
  actions: z.array(z.string()),
  jobs: z.array(z.object({ name: z.string(), everyMinutes: z.number().int().min(1) })),
});
export type BackendDescription = z.infer<typeof BackendDescription>;

export const BackendToDaemon = z.discriminatedUnion("type", [
  BackendDescription.extend({ type: z.literal("ready") }),
  z.object({ type: z.literal("call"), id: z.number().int(), invocation: z.number().int(), call: ComponentCall }),
  BackendResult,
]);
export type BackendToDaemon = z.infer<typeof BackendToDaemon>;
```

- [x] **Step 6: Étendre `rpc.ts` et `index.ts`**

`packages/schema/src/rpc.ts` : supprimer la définition de `ProjectCommand`, `COMMAND`… (désormais dans `command.ts`) et `CommandResult` ; importer ce qu'il faut ; ajouter les requêtes et résultats :
```ts
import { z } from "zod";
import { ComponentCall } from "./call";
import { ProjectCommand } from "./command";
import type {
  ComponentSummary,
  DraftSummary,
  PublishPreview,
  PublishResult,
  RegistryVersion,
  RuntimeInfo,
} from "./component";
import { ApprovableTrust, Sha256 } from "./component";
import type { KiboErrorCode } from "./errors";
import { ProjectKey } from "./ids";
import type { Instance } from "./instance";
import type { Link } from "./link";
import type { NotesInfo } from "./note";
import type { Page } from "./page";
import type { ProjectMeta } from "./project";
import { SemVer } from "./semver";
import type { Status, StatusId } from "./status";
import type { Ticket } from "./ticket";

const ComponentId = z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/);

export type TicketView = Ticket & { progress: { done: number; total: number }; waitingOn: string[] };
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  instances: Instance[];
  nextTicketKey: string;
};
export type ProjectSummary = ProjectMeta & { counts: Record<StatusId, number> };
export type Session = { user: string };

export const RpcRequest = z.discriminatedUnion("method", [
  z.object({ method: z.literal("getSession") }),
  z.object({ method: z.literal("listProjects") }),
  z.object({
    method: z.literal("createProject"),
    name: z.string().trim().min(1),
    key: ProjectKey,
    folder: z.string().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  z.object({ method: z.literal("getProject"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("command"), projectId: z.string().min(1), command: ProjectCommand }),
  z.object({ method: z.literal("listComponents") }),
  z.object({
    method: z.literal("componentCall"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1),
    call: ComponentCall,
  }),
  z.object({
    method: z.literal("approveComponent"),
    id: ComponentId,
    version: SemVer,
    hash: Sha256,
    trust: ApprovableTrust,
  }),
  z.object({ method: z.literal("revokeComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("rehashComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("previewPublish"), id: ComponentId }),
  z.object({ method: z.literal("publishComponent"), id: ComponentId, strategy: z.enum(["update-all", "new-version"]) }),
  z.object({
    method: z.literal("updateInstance"),
    projectId: z.string().min(1),
    instanceId: z.string().min(1),
    to: SemVer,
  }),
  z.object({ method: z.literal("uninstallComponent"), id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("listDrafts") }),
  z.object({ method: z.literal("getNotesDir"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("setNotesDir"), projectId: z.string().min(1), dir: z.string().min(1).max(4096) }),
  z.object({ method: z.literal("getRuntimeInfo") }),
  z.object({ method: z.literal("installCli") }),
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = {
  getSession: Session;
  listProjects: ProjectSummary[];
  createProject: ProjectMeta;
  getProject: ProjectSnapshot;
  command: unknown;
  listComponents: ComponentSummary[];
  componentCall: unknown;
  approveComponent: RegistryVersion;
  revokeComponent: null;
  rehashComponent: RegistryVersion;
  previewPublish: PublishPreview;
  publishComponent: PublishResult;
  updateInstance: Instance;
  uninstallComponent: null;
  listDrafts: DraftSummary[];
  getNotesDir: NotesInfo;
  setNotesDir: NotesInfo;
  getRuntimeInfo: RuntimeInfo;
  installCli: { path: string };
};

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
```
Conserver les méthodes RPC ajoutées par les phases 2 et 3 (elles restent dans l'union et dans `RpcResult`).

`packages/schema/src/index.ts` :
```ts
export * from "./call";
export * from "./command";
export * from "./component";
export * from "./config";
export * from "./errors";
export * from "./ids";
export * from "./instance";
export * from "./link";
export * from "./manifest";
export * from "./migrations";
export * from "./net";
export * from "./note";
export * from "./page";
export * from "./permissions";
export * from "./project";
export * from "./protocol";
export * from "./rpc";
export * from "./semver";
export * from "./status";
export * from "./ticket";
```
(plus les modules ajoutés par les phases 2 et 3, conservés).

Run: `bun test packages/schema`
Expected: PASS.

- [x] **Step 7: Correctifs de compilation dans le SDK**

`packages/sdk/package.json`, `exports` :
```json
{
  ".": "./src/index.ts",
  "./mock": "./src/mock.ts",
  "./conformance": "./src/conformance.tsx",
  "./fixtures": "./src/fixtures.ts",
  "./sandbox": "./src/sandbox.tsx",
  "./server": "./src/server.ts",
  "./migrations": "./src/migrations.ts",
  "./dev": "./src/dev.tsx",
  "./theme.css": "./src/theme.css",
  "./ui/*": "./src/ui/*.tsx",
  "./lib/*": "./src/lib/*.ts",
  "./hooks/*": "./src/hooks/*.ts"
}
```

`packages/sdk/src/types.ts` : `EntityMap` gagne `note: NoteMeta` (import de `NoteMeta` depuis `@kibo/schema`).

`packages/sdk/src/sdk.ts` : supprimer la table locale `WRITES` et utiliser `COMMAND_WRITES` de `@kibo/schema` ; dans `list`, la table devient :
```ts
      const s = await backend.snapshot();
      const lists: { [K in EntityType]: () => EntityMap[K][] } = {
        ticket: () => s.tickets,
        status: () => s.workflow,
        link: () => s.links,
        page: () => s.pages,
        note: () => {
          throw new KiboError("PERMISSION_DENIED", "notes are served by componentCall");
        },
      };
      return lists[type]();
```
(remplacé par la tâche 7).

`packages/sdk/src/sdk.test.ts` : la constante `manifest` devient `ComponentManifest.parse({ …mêmes champs… })` avec `import { ComponentManifest } from "@kibo/schema"` (import de valeur).

Run: `bun test packages/sdk && bun run typecheck`
Expected: PASS.

- [x] **Step 8: Ajouter les textes UI de la phase**

`packages/ui/src/i18n/fr.ts` : remplacer la section `addComponent` et ajouter les sections suivantes (avant `common`) :
```ts
  addComponent: {
    title: "Ajouter un composant",
    search: "Rechercher un composant…",
    builtin: "Intégrés",
    mine: "Mes composants",
    draft: "Brouillon",
    publish: "Publier",
    create: "Créer un composant (code ou IA)",
    noResult: "Aucun composant ne correspond.",
    pick: "Choisis un composant pour voir ce qu'il lit et modifie.",
    display: "Affichage",
    widget: "Widget dans la grille",
    view: "Vue plein écran",
    permissions: "Permissions",
    reads: "Lit",
    writes: "Modifie",
    local: "Source : locale",
    builtinTrust: (reads: string, writes: string) =>
      `Intégré · confiance totale · lit : ${reads || "rien"}${writes ? ` · écrit : ${writes}` : ""}`,
    mineLine: (origin: string, trust: string) => `${origin} · ${trust}`,
    submit: "Ajouter à la page",
    failed: "Impossible d'ajouter le composant.",
    loadFailed: "Impossible de charger tes composants.",
  },
  components: {
    title: "Composants",
    column: { name: "Composant", version: "Version", trust: "Confiance", origin: "Origine", usedIn: "Utilisé dans" },
    trust: {
      builtin: "Intégré",
      trusted: "Confiance totale",
      sandboxed: "Sandboxé",
      pending: "Autorisation requise",
    },
    origin: { kibo: "Kibo", user: "Toi", ai: "IA", marketplace: "Marketplace" },
    usage: (pages: number, projects: number) =>
      pages === 0
        ? "Aucune page"
        : `${pages} page${pages > 1 ? "s" : ""} · ${projects} projet${projects > 1 ? "s" : ""}`,
    actions: (title: string, version: string) => `Actions ${title} ${version}`,
    review: "Examiner",
    rehash: "Revérifier l'empreinte",
    revoke: "Retirer la confiance",
    uninstall: "Désinstaller",
    uninstallBlocked: "Utilisé sur des pages : retire d'abord ses instances.",
    rehashOk: "Empreinte vérifiée.",
    rehashChanged: "L'empreinte a changé : la confiance est redemandée.",
    drafts: "Brouillons",
    draftValidated: "Tests verts",
    draftPending: (id: string) => `À valider : kibo component test ${id}`,
    publish: "Publier",
    empty: "Aucun composant installé en dehors des intégrés.",
    failed: "Impossible de charger les composants.",
    actionFailed: "L'action a échoué.",
  },
  publish: {
    title: (name: string, version: string) => `Publier « ${name} » ${version}`,
    subtitle: "Ce composant est utilisé ailleurs. Choisis comment appliquer la modification.",
    usedIn: (projects: number) => `Utilisé dans ${projects} projet${projects > 1 ? "s" : ""}`,
    updateOne: "Mettre à jour",
    changes: "Changements",
    permission: (p: string) => `Permission ${p}`,
    migration: (from: number, to: number) => `Migration de config v${from} → v${to} (automatique)`,
    updateAll: "Mettre à jour partout",
    updateAllHelp: (n: number, version: string, asks: boolean) =>
      `${n > 1 ? `Les ${n} instances passent` : "L'instance passe"} en ${version}.${
        asks ? " La nouvelle permission sera demandée une seule fois." : ""
      }`,
    newVersion: "Créer une nouvelle version",
    newVersionHelp: (from: string) =>
      `Les instances existantes restent en ${from} ; tu les mets à jour une par une depuis leur page.`,
    submit: (version: string) => `Publier ${version}`,
    unchanged: "Rien à publier : cette version est déjà publiée avec le même code.",
    versionExists: "Cette version existe déjà avec un autre code. Change la version dans kibo.component.json.",
    versionTooLow: "La version doit être plus haute que la dernière publiée.",
    invalid: (id: string) => `La validation a échoué : corrige le composant puis lance kibo component test ${id}.`,
    partial: (n: number) =>
      `${n} instance${n > 1 ? "s n'ont" : " n'a"} pas pu être migrée${n > 1 ? "s" : ""} et reste${
        n > 1 ? "nt" : ""
      } sur l'ancienne version.`,
    done: (version: string) => `Version ${version} publiée.`,
    failed: "Impossible de publier le composant.",
  },
  trust: {
    title: (name: string, version: string) => `Autoriser « ${name} » ${version} ?`,
    subtitle: (origin: string, hash: string) => `${origin} · empreinte sha256 ${hash} · vérifiée par le démon`,
    origin: {
      kibo: "Composant Kibo",
      user: "Composant écrit par toi",
      ai: "Composant généré par IA",
      marketplace: "Composant de la marketplace",
    },
    asks: "Il demande :",
    readTickets: "Lire les tickets du projet",
    readNotes: "Lire les notes du projet",
    readData: "Lire les données du projet",
    writeData: "Modifier les données du projet",
    entities: (list: string) => `entités : ${list}`,
    ownData: "Stocker ses propres données",
    ownDataHelp: "espace de nommage de l'instance uniquement",
    network: "Accéder au réseau",
    networkHelp: (rules: string) => `HTTPS via le démon uniquement : ${rules}`,
    noNetworkNoFiles: "Aucun accès réseau, aucun fichier local",
    noNetwork: "Aucun accès réseau",
    noFiles: "Aucun fichier local",
    level: "Niveau de confiance",
    sandboxed: "Sandboxé (recommandé)",
    sandboxedHelp: "iframe isolée et processus séparé. Les permissions ci-dessus sont appliquées par le démon.",
    trusted: "Confiance totale",
    trustedHelp: "Même accès que les composants intégrés. À réserver au code que tu as écrit et relu.",
    footer: "Si le code du composant change, l'empreinte change : Kibo redemande ton accord.",
    refuse: "Refuser",
    approve: "Autoriser",
    approveAndAdd: "Autoriser et ajouter",
    hashMismatch: "Le code a changé depuis l'ouverture de cette fenêtre : vérifie la nouvelle empreinte.",
    failed: "Impossible d'autoriser le composant.",
  },
  createComponent: {
    title: "Créer un composant",
    subtitle: "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.",
    ai: "Décrire à l'IA",
    aiLabel: "Ce que doit faire le composant",
    aiPlaceholder: "Burndown du sprint : tickets restants par jour, ligne idéale, filtre par domaine.",
    aiHelp:
      "Un agent génère le code avec le SDK public, dans un worktree, puis lance la suite de conformité. Tu relis le diff avant l'ajout.",
    aiSubmit: "Générer avec un agent",
    soon: "Bientôt",
    code: "Depuis le code",
    codeHelp: "Génère le squelette dans le dossier des composants du workspace :",
    codeFooter: "Le composant apparaît dans « Mes composants » dès que les tests passent.",
    copy: "Copier les commandes",
    copied: "Commandes copiées.",
    steps: ["1 · Décrire", "2 · Générer (agent)", "3 · Tests de conformité", "4 · Permissions", "5 · Ajouter à la page"],
  },
  instance: {
    menu: (title: string) => `Actions ${title}`,
    updateTo: (version: string) => `Mettre à jour vers ${version}`,
    notesDir: "Dossier des notes…",
    remove: "Retirer de la page",
    updated: (version: string) => `Instance mise à jour en ${version}.`,
    updateFailed: "Impossible de mettre à jour l'instance.",
    removeFailed: "Impossible de retirer le composant.",
    pendingTitle: "Autorisation requise",
    pendingHelp: (title: string, version: string) => `« ${title} » ${version} doit être autorisé avant de s'afficher.`,
    pendingChanged: "Son code a changé depuis ton accord.",
    review: "Examiner et autoriser",
    loadFailed: "Impossible de charger le composant.",
  },
  notesDir: {
    title: "Dossier des notes",
    help: "Chemin absolu d'un dossier Markdown ou d'un vault Obsidian. Réglage propre à cette machine.",
    label: "Dossier",
    submit: "Enregistrer",
    failed: "Dossier introuvable ou illisible.",
  },
  openView: {
    title: (name: string) => `Créer une page ${name} ?`,
    help: "Aucune page Vue de ce projet ne contient ce composant.",
    submit: "Créer la page",
    failed: "Impossible de créer la page.",
  },
  cli: {
    title: "Commande kibo",
    help: "Installe la commande kibo dans ~/.local/bin pour créer, tester et publier tes composants.",
    install: "Installer la commande kibo",
    installed: (path: string) => `Installée : ${path}`,
    failed: "Impossible d'installer la commande.",
  },
```
Les clés existantes de `addComponent` (`builtin`, `pick`, `permissions`, `reads`, `writes`, `local`, `submit`, `failed`) sont conservées avec les mêmes textes : le dialogue actuel continue de compiler.

Run: `bun run typecheck && bun test packages && bun run check`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add packages/schema packages/sdk/package.json packages/sdk/src/types.ts packages/sdk/src/sdk.ts packages/sdk/src/sdk.test.ts packages/ui/src/i18n/fr.ts docs/superpowers/specs/2026-09-26-kibo-composants.md
git commit -m "feat(schema): contrats des composants v1"
```

---

### Task 3: Core, données d'instance, commandes réservées et registre

**Files:**
- Create: `packages/core/src/instance-data.ts`, `packages/core/src/registry.ts`, `packages/core/src/instance-data.test.ts`, `packages/core/src/registry.test.ts`
- Modify: `packages/core/src/instances.ts`, `packages/core/src/commands.ts`, `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Instance`, `DataKey`, `INSTANCE_DATA_LIMIT`, `RegistryEntry`, `RegistryVersion`, `compareSemver`, `isActive` (tâche 2).
- Produces:
  - `readInstanceData(doc, instanceId): Record<string, unknown>` ; `writeInstanceData(doc, instanceId, key, value: unknown): void` (`null`/`undefined` = suppression, `QUOTA_EXCEEDED` au-delà de 256 Kio) ; `assertInstanceData(data)` ; `dataSize(data): number`.
  - `getInstance(doc, id): Instance` ; `setInstanceComponent(doc, { instanceId, component, config, data }): Instance` (atomique) ; `setInstanceConfig(doc, instanceId, config): Instance` ; `removeInstance` et `removeInstancesOfPages` suppriment aussi les données.
  - `executeProjectCommand` gère `setInstanceComponent`, `setInstanceConfig`, `setInstanceData`.
  - `readRegistry(ws): Record<string, RegistryEntry>` ; `getRegistryVersion(ws, id, version): RegistryVersion | null` ; `putRegistryVersion(ws, id, title, v: RegistryVersion): void` ; `updateRegistryVersion(ws, id, version, patch): RegistryVersion` ; `removeRegistryVersion(ws, id, version): void` ; `highestVersion(entry): string | null`.

- [x] **Step 1: Écrire les tests**

`packages/core/src/instance-data.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import type { Instance, Page } from "@kibo/schema";
import { executeProjectCommand } from "./commands";
import { readInstanceData, writeInstanceData } from "./instance-data";
import { getInstance, removeInstance } from "./instances";
import { createProjectDoc } from "./project";

function setup() {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const page = executeProjectCommand(doc, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
  const inst = executeProjectCommand(doc, {
    method: "addInstance",
    pageId: page.id,
    component: "hello@0.1.0",
  }) as Instance;
  return { doc, inst };
}

describe("instance data", () => {
  test("keys are set, read and deleted", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "count", 3);
    writeInstanceData(doc, inst.id, "list", [1, "a"]);
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 3, list: [1, "a"] });
    writeInstanceData(doc, inst.id, "count", null);
    expect(readInstanceData(doc, inst.id)).toEqual({ list: [1, "a"] });
  });
  test("invalid keys, unknown instances and oversize data are refused without change", () => {
    const { doc, inst } = setup();
    expect(() => writeInstanceData(doc, inst.id, "../x", 1)).toThrow("INVALID_INPUT");
    expect(() => writeInstanceData(doc, "nope", "k", 1)).toThrow("NOT_FOUND");
    writeInstanceData(doc, inst.id, "a", "x".repeat(200_000));
    expect(() => writeInstanceData(doc, inst.id, "b", "x".repeat(70_000))).toThrow("QUOTA_EXCEEDED");
    expect(Object.keys(readInstanceData(doc, inst.id))).toEqual(["a"]);
  });
  test("removing an instance removes its data", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "k", 1);
    removeInstance(doc, inst.id);
    expect(readInstanceData(doc, inst.id)).toEqual({});
  });
});

describe("reserved commands", () => {
  test("setInstanceComponent swaps ref, config and data in one step", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "old", 1);
    const next = executeProjectCommand(doc, {
      method: "setInstanceComponent",
      instanceId: inst.id,
      component: "hello@0.2.0",
      config: { mode: "compact" },
      data: { migrated: true },
    }) as Instance;
    expect(next.component).toBe("hello@0.2.0");
    expect(getInstance(doc, inst.id).config).toEqual({ mode: "compact" });
    expect(readInstanceData(doc, inst.id)).toEqual({ migrated: true });
  });
  test("a bad ref or oversize data leaves the instance untouched", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "keep", 1);
    expect(() =>
      executeProjectCommand(doc, {
        method: "setInstanceComponent",
        instanceId: inst.id,
        component: "hello@0.2.0",
        config: {},
        data: { big: "x".repeat(300_000) },
      }),
    ).toThrow("QUOTA_EXCEEDED");
    expect(getInstance(doc, inst.id).component).toBe("hello@0.1.0");
    expect(readInstanceData(doc, inst.id)).toEqual({ keep: 1 });
  });
  test("null data keeps the existing data", () => {
    const { doc, inst } = setup();
    writeInstanceData(doc, inst.id, "keep", 1);
    executeProjectCommand(doc, {
      method: "setInstanceComponent",
      instanceId: inst.id,
      component: "hello@0.2.0",
      config: {},
      data: null,
    });
    expect(readInstanceData(doc, inst.id)).toEqual({ keep: 1 });
  });
  test("setInstanceConfig and setInstanceData go through the command bus", () => {
    const { doc, inst } = setup();
    executeProjectCommand(doc, { method: "setInstanceConfig", instanceId: inst.id, config: { a: 1 } });
    executeProjectCommand(doc, { method: "setInstanceData", instanceId: inst.id, key: "k", value: "v" });
    expect(getInstance(doc, inst.id).config).toEqual({ a: 1 });
    expect(readInstanceData(doc, inst.id)).toEqual({ k: "v" });
  });
});
```

`packages/core/src/registry.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { RegistryVersion } from "@kibo/schema";
import {
  getRegistryVersion,
  highestVersion,
  putRegistryVersion,
  readRegistry,
  removeRegistryVersion,
  updateRegistryVersion,
} from "./registry";
import { createWorkspaceDoc } from "./workspace";

const version = (v: string, hash = "a".repeat(64)): RegistryVersion => ({
  version: v,
  hash,
  origin: "user",
  trust: null,
  approvedHash: null,
  granted: { reads: ["ticket"], writes: [], data: false, net: [] },
  publishedAt: 1,
  autoUpdate: false,
});

test("versions are stored per component and survive a snapshot", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "hello", "Hello", version("0.1.0"));
  putRegistryVersion(ws, "hello", "Hello", version("0.10.0", "b".repeat(64)));
  const copy = createWorkspaceDoc();
  copy.import(ws.export({ mode: "snapshot" }));
  const entry = readRegistry(copy).hello;
  expect(entry?.title).toBe("Hello");
  expect(Object.keys(entry?.versions ?? {}).sort()).toEqual(["0.1.0", "0.10.0"]);
  expect(entry && highestVersion(entry)).toBe("0.10.0");
});

test("trust is updated in place and unknown versions are refused", () => {
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "hello", "Hello", version("0.1.0"));
  const next = updateRegistryVersion(ws, "hello", "0.1.0", { trust: "sandboxed", approvedHash: "a".repeat(64) });
  expect(next.trust).toBe("sandboxed");
  expect(getRegistryVersion(ws, "hello", "0.1.0")?.approvedHash).toBe("a".repeat(64));
  expect(() => updateRegistryVersion(ws, "hello", "9.9.9", { trust: null })).toThrow("NOT_FOUND");
  removeRegistryVersion(ws, "hello", "0.1.0");
  expect(readRegistry(ws).hello).toBeUndefined();
});
```

Run: `bun test packages/core`
Expected: FAIL (modules manquants).

- [x] **Step 2: Implémenter `instance-data.ts`**

```ts
import { DataKey, INSTANCE_DATA_LIMIT, KiboError } from "@kibo/schema";
import { type LoroDoc, LoroMap } from "loro-crdt";

type Json = Record<string, unknown>;

const root = (doc: LoroDoc) => doc.getMap("instanceData");

export const dataSize = (data: Json): number => new TextEncoder().encode(JSON.stringify(data)).byteLength;

export function readInstanceData(doc: LoroDoc, instanceId: string): Json {
  const map = root(doc).get(instanceId);
  if (!(map instanceof LoroMap)) return {};
  const json: Json = map.toJSON();
  return json;
}

export function assertInstanceData(data: Json): void {
  for (const key of Object.keys(data)) {
    if (!DataKey.safeParse(key).success) throw new KiboError("INVALID_INPUT", `invalid data key ${key}`);
  }
  if (dataSize(data) > INSTANCE_DATA_LIMIT) {
    throw new KiboError("QUOTA_EXCEEDED", `instance data exceeds ${INSTANCE_DATA_LIMIT} bytes`);
  }
}

function assertInstance(doc: LoroDoc, instanceId: string): void {
  if (doc.getMap("instances").get(instanceId) === undefined) {
    throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
  }
}

const container = (doc: LoroDoc, instanceId: string): LoroMap =>
  root(doc).getOrCreateContainer(instanceId, new LoroMap());

export function writeInstanceData(doc: LoroDoc, instanceId: string, key: string, value: unknown): void {
  assertInstance(doc, instanceId);
  const removing = value === null || value === undefined;
  const next = { ...readInstanceData(doc, instanceId) };
  if (removing) delete next[key];
  else next[key] = value;
  assertInstanceData({ ...next, [key]: removing ? 0 : value });
  const map = container(doc, instanceId);
  if (removing) map.delete(key);
  else map.set(key, value);
  doc.commit();
}

export function replaceInstanceData(doc: LoroDoc, instanceId: string, data: Json): void {
  assertInstanceData(data);
  const map = container(doc, instanceId);
  map.clear();
  for (const [key, value] of Object.entries(data)) map.set(key, value);
}

export function dropInstanceData(doc: LoroDoc, instanceId: string): void {
  if (root(doc).get(instanceId) !== undefined) root(doc).delete(instanceId);
}
```
`assertInstanceData({ ...next, [key]: … })` valide aussi la clé supprimée (une clé invalide est refusée même pour une suppression). Si `LoroMap.getOrCreateContainer` n'existe pas dans loro-crdt 1.16.3, utiliser `root(doc).get(id) instanceof LoroMap ? … : root(doc).setContainer(id, new LoroMap())`.

- [x] **Step 3: Étendre `instances.ts`**

Remplacer `removeInstance` et `removeInstancesOfPages`, ajouter `getInstance`, `setInstanceComponent`, `setInstanceConfig` :
```ts
import { Instance, KiboError, type Layout } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { assertInstanceData, dropInstanceData, replaceInstanceData } from "./instance-data";
import { getNode } from "./tree";

const DEFAULT_LAYOUT: Layout = { x: 0, y: 0, w: 12, h: 6 };
const instances = (doc: LoroDoc) => doc.getMap("instances");

export function listInstances(doc: LoroDoc, pageId?: string): Instance[] {
  const all = Object.values(instances(doc).toJSON() as Record<string, Instance>);
  return pageId === undefined ? all : all.filter((i) => i.pageId === pageId);
}

export function getInstance(doc: LoroDoc, id: string): Instance {
  const raw = instances(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `instance ${id} not found`);
  return Instance.parse(raw);
}
```
(`addInstance` inchangé.)
```ts
export function removeInstance(doc: LoroDoc, id: string): void {
  getInstance(doc, id);
  instances(doc).delete(id);
  dropInstanceData(doc, id);
  doc.commit();
}

export function removeInstancesOfPages(doc: LoroDoc, pageIds: string[]): void {
  const gone = new Set(pageIds);
  for (const i of listInstances(doc)) {
    if (!gone.has(i.pageId)) continue;
    instances(doc).delete(i.id);
    dropInstanceData(doc, i.id);
  }
  doc.commit();
}

export function setInstanceComponent(
  doc: LoroDoc,
  input: { instanceId: string; component: string; config: Record<string, unknown>; data: Record<string, unknown> | null },
): Instance {
  const current = getInstance(doc, input.instanceId);
  const parsed = Instance.safeParse({ ...current, component: input.component, config: input.config });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  if (input.data !== null) assertInstanceData(input.data);
  instances(doc).set(current.id, parsed.data);
  if (input.data !== null) replaceInstanceData(doc, current.id, input.data);
  doc.commit();
  return parsed.data;
}

export function setInstanceConfig(doc: LoroDoc, instanceId: string, config: Record<string, unknown>): Instance {
  const next = Instance.parse({ ...getInstance(doc, instanceId), config });
  instances(doc).set(next.id, next);
  doc.commit();
  return next;
}
```
Toutes les validations précèdent la première écriture : un échec ne laisse aucune opération Loro non committée qui partirait avec le commit suivant.

- [x] **Step 4: Brancher les commandes et écrire `registry.ts`**

`packages/core/src/commands.ts`, dans le `switch` de `executeProjectCommand` :
```ts
    case "setInstanceComponent": {
      const { method: _method, ...input } = cmd;
      return setInstanceComponent(doc, input);
    }
    case "setInstanceConfig":
      return setInstanceConfig(doc, cmd.instanceId, cmd.config);
    case "setInstanceData":
      writeInstanceData(doc, cmd.instanceId, cmd.key, cmd.value);
      return null;
```
(imports : `setInstanceComponent`, `setInstanceConfig` depuis `./instances`, `writeInstanceData` depuis `./instance-data`).

`packages/core/src/registry.ts` :
```ts
import { compareSemver, KiboError, RegistryEntry, type RegistryVersion } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

const registry = (ws: LoroDoc) => ws.getMap("componentRegistry");

export function readRegistry(ws: LoroDoc): Record<string, RegistryEntry> {
  const out: Record<string, RegistryEntry> = {};
  for (const [id, raw] of Object.entries(registry(ws).toJSON() as Record<string, unknown>)) {
    const parsed = RegistryEntry.safeParse(raw);
    if (!parsed.success) throw new KiboError("STORE_CORRUPT", `registry entry ${id} is invalid`);
    out[id] = parsed.data;
  }
  return out;
}

export function getRegistryVersion(ws: LoroDoc, id: string, version: string): RegistryVersion | null {
  return readRegistry(ws)[id]?.versions[version] ?? null;
}

export function putRegistryVersion(ws: LoroDoc, id: string, title: string, v: RegistryVersion): void {
  const entry = readRegistry(ws)[id];
  registry(ws).set(id, { title, versions: { ...(entry?.versions ?? {}), [v.version]: v } });
  ws.commit();
}

export function updateRegistryVersion(
  ws: LoroDoc,
  id: string,
  version: string,
  patch: Partial<Pick<RegistryVersion, "trust" | "approvedHash" | "granted" | "autoUpdate">>,
): RegistryVersion {
  const entry = readRegistry(ws)[id];
  const current = entry?.versions[version];
  if (!entry || !current) throw new KiboError("NOT_FOUND", `component ${id}@${version} is not installed`);
  const next = { ...current, ...patch };
  registry(ws).set(id, { ...entry, versions: { ...entry.versions, [version]: next } });
  ws.commit();
  return next;
}

export function removeRegistryVersion(ws: LoroDoc, id: string, version: string): void {
  const entry = readRegistry(ws)[id];
  if (!entry?.versions[version]) throw new KiboError("NOT_FOUND", `component ${id}@${version} is not installed`);
  const { [version]: _gone, ...rest } = entry.versions;
  if (Object.keys(rest).length === 0) registry(ws).delete(id);
  else registry(ws).set(id, { ...entry, versions: rest });
  ws.commit();
}

export function highestVersion(entry: RegistryEntry): string | null {
  return Object.keys(entry.versions).sort(compareSemver).at(-1) ?? null;
}
```
`packages/core/src/index.ts` : ajouter `export * from "./instance-data";` et `export * from "./registry";`.

- [x] **Step 5: Vérifier**

Run: `bun test packages/core && bun run typecheck && bun run check`
Expected: PASS (les tests existants de `commands.test.ts` et la propriété de convergence restent verts).

- [x] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): données d'instance et registre"
```

---

### Task 4: Devkit, empreinte, imports autorisés et squelette

**Files:**
- Create: `packages/devkit/src/hash.ts`, `packages/devkit/src/imports.ts`, `packages/devkit/src/scaffold.ts`, `packages/devkit/src/test-kit.ts`, `packages/devkit/src/hash.test.ts`, `packages/devkit/src/imports.test.ts`, `packages/devkit/src/scaffold.test.ts`, `packages/devkit/fixtures/hello/{kibo.component.json,ui.tsx,component.test.tsx.fixture}`
- Modify: `packages/devkit/src/index.ts`, `packages/devkit/package.json` (export `./test-kit`)

**Interfaces:**
- Consumes: `Toolchain`, `loadTypeScript`, `SourceIssue`, `issueAt` (tâche 1) ; `ComponentManifest`, `isBuiltinId`, `SHARED_SPECIFIERS`, `SERVER_SPECIFIERS`, `TEST_SPECIFIERS`, `KiboError` (tâche 2).
- Produces:
  - `type SourceFile = { path: string; bytes: Uint8Array }` ; `listSourceFiles(dir): Promise<string[]>` (tous les fichiers, tests compris, chemins POSIX triés) ; `isHashed(path): boolean` ; `hashFiles(files: SourceFile[]): string` ; `readSources(dir): Promise<{ hash: string; files: SourceFile[] }>` ; `hashSources(dir): Promise<string>` ; `MAX_SOURCE_FILES = 200`, `MAX_SOURCE_BYTES = 2_097_152`.
  - `checkImports(ts: TypeScript, files: { path: string; text: string }[]): SourceIssue[]`.
  - `scaffold(opts: { root: string; id: string; kind: "widget" | "view" | "both"; server: boolean; toolchain: Toolchain }): Promise<string>` (renvoie le dossier créé).
  - Aide de test `@kibo/devkit/test-kit` : `REPO`, `DEV_TOOLCHAIN`, `copyFixture(name: string, opts?: { linkModules?: boolean; from?: string }): { dir: string; dispose(): void }` (copie `fixtures/<name>` — ou `<from>/<name>` — dans un dossier temporaire hors du monorepo, renomme `*.fixture`, lie `node_modules` à la toolchain de dev). Réutilisée par les tâches 14, 20, 27, 31 et 32.

- [x] **Step 1: Créer la fixture `hello`**

`packages/devkit/fixtures/hello/kibo.component.json` :
```json
{
  "id": "hello",
  "version": "0.1.0",
  "kind": "both",
  "title": "Hello",
  "description": "Composant de test",
  "reads": ["ticket"],
  "writes": [],
  "changes": ["Premier jet"]
}
```

`packages/devkit/fixtures/hello/ui.tsx` :
```tsx
import { useEntities, useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <Card className="h-full bg-emerald-500">
      <CardHeader>
        <CardTitle>Hello {sdk.viewer}</CardTitle>
      </CardHeader>
      <CardContent>{tickets.data.length} tickets</CardContent>
    </Card>
  );
}
```

`packages/devkit/fixtures/hello/component.test.tsx.fixture` :
```tsx
import { runConformance } from "@kibo/sdk/conformance";
import manifest from "./kibo.component.json";
import { Component } from "./ui";

runConformance({ manifest, Component });
```
Le suffixe `.fixture` empêche `bun test packages` d'exécuter ce test dans le monorepo ; `copyFixture` le retire.

- [x] **Step 2: Écrire l'aide de test et les tests**

`packages/devkit/src/test-kit.ts` :
```ts
import { cpSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dir, "../../..");
export const DEV_TOOLCHAIN = { root: REPO };

function unsuffix(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) unsuffix(path);
    else if (entry.name.endsWith(".fixture")) renameSync(path, path.slice(0, -".fixture".length));
  }
}

export function copyFixture(
  name: string,
  opts: { linkModules?: boolean; from?: string } = {},
): { dir: string; dispose(): void } {
  const base = mkdtempSync(join(tmpdir(), "kibo-fixture-"));
  const dir = join(base, name);
  cpSync(join(opts.from ?? join(REPO, "packages/devkit/fixtures"), name), dir, { recursive: true });
  unsuffix(dir);
  if (opts.linkModules ?? true) symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "dir");
  return { dir, dispose: () => rmSync(base, { recursive: true, force: true }) };
}
```

`packages/devkit/src/hash.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashSources, isHashed, listSourceFiles, readSources } from "./hash";

function dir(files: [string, string][]): string {
  const d = mkdtempSync(join(tmpdir(), "kibo-hash-"));
  for (const [path, text] of files) {
    mkdirSync(join(d, path, ".."), { recursive: true });
    writeFileSync(join(d, path), text);
  }
  return d;
}

const MANIFEST: [string, string] = ["kibo.component.json", '{"id":"x"}'];

describe("hash", () => {
  test("the hash does not depend on the order files were written", async () => {
    const a = dir([MANIFEST, ["ui.tsx", "a"], ["lib/b.ts", "b"]]);
    const b = dir([["lib/b.ts", "b"], ["ui.tsx", "a"], MANIFEST]);
    expect(await hashSources(a)).toBe(await hashSources(b));
  });
  test("one changed byte, including a line ending, changes the hash", async () => {
    const base = await hashSources(dir([MANIFEST, ["ui.tsx", "a\n"]]));
    expect(await hashSources(dir([MANIFEST, ["ui.tsx", "b\n"]]))).not.toBe(base);
    expect(await hashSources(dir([MANIFEST, ["ui.tsx", "a\r\n"]]))).not.toBe(base);
  });
  test("tests, hidden files, node_modules, dist and other extensions are not hashed", async () => {
    const base = await hashSources(dir([MANIFEST, ["ui.tsx", "a"]]));
    const noisy = dir([
      MANIFEST,
      ["ui.tsx", "a"],
      ["component.test.tsx", "t"],
      ["x.test.ts", "t"],
      [".kibo/validation.json", "{}"],
      ["dist/ui.js", "x"],
      ["README.md", "r"],
    ]);
    expect(await hashSources(noisy)).toBe(base);
    expect(await listSourceFiles(noisy)).toEqual(["README.md", "component.test.tsx", "kibo.component.json", "ui.tsx", "x.test.ts"]);
    expect(isHashed("styles/a.css")).toBe(true);
  });
  test("a symbolic link or a missing manifest fails validation", async () => {
    const withLink = dir([MANIFEST, ["ui.tsx", "a"]]);
    symlinkSync("/etc/hosts", join(withLink, "evil.ts"));
    await expect(readSources(withLink)).rejects.toThrow("VALIDATION_FAILED");
    await expect(readSources(dir([["ui.tsx", "a"]]))).rejects.toThrow("VALIDATION_FAILED");
  });
});
```

`packages/devkit/src/imports.test.ts` :
```ts
import { expect, test } from "bun:test";
import { checkImports } from "./imports";
import { DEV_TOOLCHAIN } from "./test-kit";
import { loadTypeScript } from "./typescript";

const ts = await loadTypeScript(DEV_TOOLCHAIN);
const codes = (path: string, text: string) => checkImports(ts, [{ path, text }]).map((i) => `${i.code}:${i.detail}`);

test("shared modules and relative paths are allowed", () => {
  const text = `import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import manifest from "./kibo.component.json";
import { helper } from "./lib/helper";
export { manifest, helper, useSdk, Button, Plus, useState };`;
  expect(codes("ui.tsx", text)).toEqual([]);
});

test("anything else is refused, with the file and the line", () => {
  expect(codes("ui.tsx", 'import fs from "node:fs";')).toEqual(["forbidden-import:node:fs"]);
  expect(codes("ui.tsx", 'import x from "lodash";')).toEqual(["forbidden-import:lodash"]);
  expect(codes("ui.tsx", 'import { x } from "../outside";')).toEqual(["outside-import:../outside"]);
  expect(codes("ui.tsx", 'export * from "bun";')).toEqual(["forbidden-import:bun"]);
  expect(checkImports(ts, [{ path: "ui.tsx", text: '\n\nimport x from "zod";' }])[0]?.line).toBe(3);
});

test("test-only and server-only modules are allowed where they belong", () => {
  expect(codes("component.test.tsx", 'import { runConformance } from "@kibo/sdk/conformance";')).toEqual([]);
  expect(codes("ui.tsx", 'import { runConformance } from "@kibo/sdk/conformance";')).toEqual([
    "forbidden-import:@kibo/sdk/conformance",
  ]);
  expect(codes("server.ts", 'import { defineServer } from "@kibo/sdk/server";')).toEqual([]);
});

test("dynamic loading and escape hatches are refused", () => {
  expect(codes("ui.tsx", "const m = await import(name);")).toEqual(["non-literal-import:import(name)"]);
  expect(codes("ui.tsx", 'const m = await import("node:fs");')).toEqual(["forbidden-import:node:fs"]);
  expect(codes("ui.tsx", 'require("fs");')).toContain("banned-identifier:require");
  expect(codes("ui.tsx", 'eval("1");')).toContain("banned-identifier:eval");
  expect(codes("ui.tsx", 'new Function("return 1");')).toContain("banned-identifier:Function");
  expect(codes("ui.tsx", "process.exit(1);")).toContain("banned-identifier:process");
  expect(codes("ui.tsx", "Bun.spawn([]);")).toContain("banned-identifier:Bun");
  expect(codes("ui.tsx", "console.log(import.meta.url);")).toContain("banned-identifier:import.meta");
  expect(codes("ui.tsx", "const o = { process: 1, eval: 2 }; o.process;")).toEqual([]);
});

test("macros, import attributes and worker escapes are refused", () => {
  expect(codes("ui.tsx", 'import { m } from "./m" with { type: "macro" };')).toEqual(["banned-identifier:import attributes"]);
  expect(codes("ui.tsx", 'export { m } from "./m" with { type: "macro" };')).toEqual(["banned-identifier:import attributes"]);
  expect(codes("ui.tsx", 'const m = await import("./m", { with: { type: "macro" } });')).toEqual([
    "banned-identifier:import attributes",
  ]);
  expect(codes("server.ts", "new Worker(url);")).toContain("banned-identifier:Worker");
  expect(codes("server.ts", "global.fetch;")).toContain("banned-identifier:global");
  expect(codes("server.ts", "self.postMessage(1);")).toContain("banned-identifier:self");
});
```

`packages/devkit/src/scaffold.test.ts` :
```ts
import { expect, test } from "bun:test";
import { existsSync, lstatSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import { scaffold } from "./scaffold";
import { DEV_TOOLCHAIN } from "./test-kit";

test("new creates a valid 0.1.0 component with its conformance test", async () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-scaffold-"));
  const dir = await scaffold({ root, id: "burndown", kind: "widget", server: true, toolchain: DEV_TOOLCHAIN });
  expect(dir).toBe(join(root, "burndown"));
  const manifest = ComponentManifest.parse(JSON.parse(readFileSync(join(dir, "kibo.component.json"), "utf8")));
  expect(manifest).toMatchObject({ id: "burndown", version: "0.1.0", kind: "widget", title: "Burndown", reads: [], writes: [] });
  for (const f of ["ui.tsx", "server.ts", "component.test.tsx", "tsconfig.json"]) expect(existsSync(join(dir, f))).toBe(true);
  expect(readFileSync(join(dir, "component.test.tsx"), "utf8")).toContain("runConformance");
  expect(lstatSync(join(dir, "node_modules")).isSymbolicLink()).toBe(true);
});

test("new refuses an existing folder, a built-in id and an invalid id", async () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-scaffold-"));
  await scaffold({ root, id: "x-y", kind: "both", server: false, toolchain: DEV_TOOLCHAIN });
  await expect(scaffold({ root, id: "x-y", kind: "both", server: false, toolchain: DEV_TOOLCHAIN })).rejects.toThrow("INVALID_INPUT");
  await expect(scaffold({ root, id: "kanban", kind: "both", server: false, toolchain: DEV_TOOLCHAIN })).rejects.toThrow("INVALID_INPUT");
  await expect(scaffold({ root, id: "Bad Id", kind: "both", server: false, toolchain: DEV_TOOLCHAIN })).rejects.toThrow("INVALID_INPUT");
  expect(existsSync(join(root, "x-y", "server.ts"))).toBe(false);
});
```

Run: `bun test packages/devkit/src/hash.test.ts packages/devkit/src/imports.test.ts packages/devkit/src/scaffold.test.ts`
Expected: FAIL (modules manquants).

- [x] **Step 3: Implémenter `hash.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { KiboError } from "@kibo/schema";

export type SourceFile = { path: string; bytes: Uint8Array };

export const MAX_SOURCE_FILES = 200;
export const MAX_SOURCE_BYTES = 2_097_152;

const SKIPPED = new Set(["node_modules", "dist"]);
const HASHED = /\.(ts|tsx|css)$/;
const TEST = /\.test\.tsx?$/;

export function isHashed(path: string): boolean {
  if (path.split("/").some((p) => p.startsWith(".") || SKIPPED.has(p))) return false;
  return path === "kibo.component.json" || (HASHED.test(path) && !TEST.test(path));
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIPPED.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    const rel = relative(root, abs).split(sep).join("/");
    if (entry.isSymbolicLink()) throw new KiboError("VALIDATION_FAILED", `symbolic link not allowed: ${rel}`);
    if (entry.isDirectory()) await walk(root, abs, out);
    else if (entry.isFile()) out.push(rel);
  }
}

const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  await walk(dir, dir, out);
  return out.map((path) => ({ path })).sort(byPath).map((f) => f.path);
}

export function hashFiles(files: SourceFile[]): string {
  const hasher = new Bun.CryptoHasher("sha256");
  const encoder = new TextEncoder();
  for (const f of [...files].sort(byPath)) {
    hasher.update(encoder.encode(`${f.path}\0${f.bytes.byteLength}\0`));
    hasher.update(f.bytes);
  }
  return hasher.digest("hex");
}

export async function readSources(dir: string): Promise<{ hash: string; files: SourceFile[] }> {
  const paths = (await listSourceFiles(dir)).filter(isHashed);
  if (!paths.includes("kibo.component.json")) throw new KiboError("VALIDATION_FAILED", "kibo.component.json is missing");
  if (paths.length > MAX_SOURCE_FILES) throw new KiboError("VALIDATION_FAILED", `more than ${MAX_SOURCE_FILES} source files`);
  const files = await Promise.all(paths.map(async (path) => ({ path, bytes: new Uint8Array(await readFile(join(dir, path))) })));
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
  if (total > MAX_SOURCE_BYTES) throw new KiboError("VALIDATION_FAILED", `sources exceed ${MAX_SOURCE_BYTES} bytes`);
  return { hash: hashFiles(files), files };
}

export async function hashSources(dir: string): Promise<string> {
  return (await readSources(dir)).hash;
}
```
Le tri se fait par unités de code (`<`), jamais par `localeCompare` (dépend de la locale).

- [x] **Step 4: Implémenter `imports.ts`**

```ts
import { dirname, normalize } from "node:path/posix";
import { SERVER_SPECIFIERS, SHARED_SPECIFIERS, TEST_SPECIFIERS } from "@kibo/schema";
import type * as TS from "typescript";
import { issueAt, type SourceIssue } from "./issues";
import type { TypeScript } from "./typescript";

const BANNED = new Set([
  "require",
  "eval",
  "Function",
  "process",
  "Bun",
  "globalThis",
  "global",
  "self",
  "module",
  "Worker",
  "SharedWorker",
]);
const isTest = (path: string) => /\.test\.tsx?$/.test(path);

function allowedFor(path: string): Set<string> {
  return new Set([
    ...SHARED_SPECIFIERS,
    "react/jsx-dev-runtime",
    ...SERVER_SPECIFIERS,
    ...(isTest(path) ? TEST_SPECIFIERS : []),
  ]);
}

function isValueIdentifier(ts: TypeScript, node: TS.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if (ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) return parent.name !== node;
  if (ts.isTypeReferenceNode(parent) || ts.isQualifiedName(parent)) return false;
  return true;
}

export function checkImports(ts: TypeScript, files: { path: string; text: string }[]): SourceIssue[] {
  const issues: SourceIssue[] = [];
  for (const file of files) {
    const kind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
    const allowed = allowedFor(file.path);
    const lineOf = (node: TS.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const check = (spec: string, node: TS.Node) => {
      if (spec.startsWith(".")) {
        const target = normalize(`${dirname(file.path)}/${spec}`);
        if (target.startsWith("..")) issues.push(issueAt(file.path, lineOf(node), "outside-import", spec));
        return;
      }
      if (!allowed.has(spec)) issues.push(issueAt(file.path, lineOf(node), "forbidden-import", spec));
    };
    const visit = (node: TS.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (node.attributes) issues.push(issueAt(file.path, lineOf(node), "banned-identifier", "import attributes"));
        else if (ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text, node);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [arg, attributes] = node.arguments;
        if (attributes) issues.push(issueAt(file.path, lineOf(node), "banned-identifier", "import attributes"));
        else if (arg && ts.isStringLiteralLike(arg)) check(arg.text, node);
        else issues.push(issueAt(file.path, lineOf(node), "non-literal-import", node.getText(source)));
      } else if (ts.isImportEqualsDeclaration(node)) {
        issues.push(issueAt(file.path, lineOf(node), "banned-identifier", "import ="));
      } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        issues.push(issueAt(file.path, lineOf(node), "banned-identifier", "import.meta"));
      } else if (ts.isIdentifier(node) && BANNED.has(node.text) && isValueIdentifier(ts, node)) {
        issues.push(issueAt(file.path, lineOf(node), "banned-identifier", node.text));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}
```
Les identifiants `require`, `eval`, `Function`, `process`, `Bun`, `globalThis`, `global`, `self`, `module`, `Worker` et `SharedWorker` sont refusés en position de valeur ; comme clé d'objet ou nom de propriété, ils restent permis. Tout attribut d'import (`with { … }`, statique ou dynamique) est refusé : `Bun.build` exécute les macros (`type: "macro"`) dans le processus qui construit, sans passer par `onResolve` (constaté à la relecture de la tâche 1). Cette analyse est une **défense en profondeur, pas une barrière** : `(() => 0).constructor("return import('node:fs')")()` la contourne ; la barrière est le bac à sable OS (décision 24, tâche 11b).

- [x] **Step 5: Implémenter `scaffold.ts`**

```ts
import { existsSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ComponentManifest, isBuiltinId, KiboError } from "@kibo/schema";
import { type Toolchain, toolchainModules } from "./toolchain";

export type ScaffoldOptions = {
  root: string;
  id: string;
  kind: "widget" | "view" | "both";
  server: boolean;
  toolchain: Toolchain;
};

const titleOf = (id: string) => {
  const words = (id.split(".").at(-1) ?? id).split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const UI = (title: string) => `import { useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>${title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{sdk.surface === "view" ? "Vue" : "Widget"}</CardContent>
    </Card>
  );
}
`;

const SERVER = `import { defineServer } from "@kibo/sdk/server";

export const server = defineServer({
  actions: {
    ping: async () => "pong",
  },
});
`;

const TEST = `import { runConformance } from "@kibo/sdk/conformance";
import manifest from "./kibo.component.json";
import { Component } from "./ui";

runConformance({ manifest, Component });
`;

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    lib: ["ES2022", "DOM"],
    types: ["bun"],
  },
  include: ["**/*.ts", "**/*.tsx", "kibo.component.json"],
};

export async function scaffold(opts: ScaffoldOptions): Promise<string> {
  const dir = join(opts.root, opts.id);
  const title = titleOf(opts.id);
  const manifest = {
    id: opts.id,
    version: "0.1.0",
    kind: opts.kind,
    title,
    description: `${title} : à décrire`,
    reads: [],
    writes: [],
    changes: [],
  };
  if (!ComponentManifest.safeParse(manifest).success) throw new KiboError("INVALID_INPUT", `invalid component id ${opts.id}`);
  if (isBuiltinId(opts.id)) throw new KiboError("INVALID_INPUT", `${opts.id} is a built-in component`);
  if (existsSync(dir)) throw new KiboError("INVALID_INPUT", `${dir} already exists`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, "kibo.component.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(dir, "ui.tsx"), UI(title));
  if (opts.server) await writeFile(join(dir, "server.ts"), SERVER);
  await writeFile(join(dir, "component.test.tsx"), TEST);
  await writeFile(join(dir, "tsconfig.json"), `${JSON.stringify(TSCONFIG, null, 2)}\n`);
  await symlink(toolchainModules(opts.toolchain), join(dir, "node_modules"), "dir");
  return dir;
}
```
Le lien `node_modules` (ignoré par l'empreinte) sert l'éditeur et un `bun test` manuel ; la validation n'utilise jamais le `tsconfig.json` du composant (tâche 20).

`packages/devkit/src/index.ts` : ajouter `export * from "./hash";`, `export * from "./imports";`, `export * from "./scaffold";` (pas `test-kit`, réservé aux tests). `packages/devkit/package.json`, `exports` : ajouter `"./test-kit": "./src/test-kit.ts"`.

- [x] **Step 6: Vérifier et committer**

Run: `bun test packages/devkit && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/devkit
git commit -m "feat(devkit): empreinte, imports et squelette"
```

---

### Task 5: Devkit, inférence des permissions

**Files:**
- Create: `packages/devkit/src/infer-permissions.ts`, `packages/devkit/src/infer-permissions.test.ts`
- Modify: `packages/devkit/src/index.ts`

**Interfaces:**
- Consumes: `TypeScript`, `loadTypeScript`, `SourceIssue`, `issueAt` (tâche 1) ; `BuiltinEntityType`, `COMMAND_WRITES`, `ProjectCommand` (tâche 2).
- Produces: `type Inference = { used: string[]; issues: SourceIssue[] }` ; `inferFromSources(ts: TypeScript, files: { path: string; text: string }[]): Inference` (fichiers de test ignorés) ; `inferPermissions(dir: string, toolchain: Toolchain): Promise<Inference>`. Chaînes de `used` au format de `permissionList` : `read:<entité>`, `write:<entité>`, `write:<méthode réservée>`, `data`, `net:<url>`.

- [x] **Step 1: Écrire les tests**

`packages/devkit/src/infer-permissions.test.ts` :
```ts
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { inferFromSources } from "./infer-permissions";
import { loadTypeScript } from "./typescript";

const ts = await loadTypeScript({ root: resolve(import.meta.dir, "../../..") });
const infer = (text: string, path = "ui.tsx") => inferFromSources(ts, [{ path, text }]);

test("literal SDK calls give the permissions they need", () => {
  const { used, issues } = infer(`
    const tickets = useEntities("ticket");
    const sdk = useSdk();
    await sdk.list("status");
    await useSdk().list("link");
    await sdk.run({ method: "setStatus", ticketId: "1", statusId: "done" });
    await sdk.data.set("k", 1);
    await sdk.fetch("https://api.github.com/graphql", { method: "POST" });
    await sdk.fetch(\`https://api.github.com/repos\`);
    await sdk.notes.read("a.md");
    await sdk.notes.write("a.md", "x", null);
    await sdk.action("ping");
  `);
  expect(issues).toEqual([]);
  expect(used.sort()).toEqual(
    [
      "read:ticket",
      "read:status",
      "read:link",
      "write:ticket",
      "data",
      "net:https://api.github.com/graphql",
      "net:https://api.github.com/repos",
      "read:note",
      "write:note",
    ].sort(),
  );
});

test("server code is analysed through ctx", () => {
  const { used } = infer(`export const server = defineServer({ actions: { go: async (ctx) => ctx.list("ticket") } });`, "server.ts");
  expect(used).toEqual(["read:ticket"]);
});

test("a non literal argument is an issue, not a guess", () => {
  const { used, issues } = infer(`
    const kind = "ticket";
    await sdk.list(kind);
    await sdk.fetch(base + "/x");
    await sdk.run(command);
    await sdk.run({ method: m });
  `);
  expect(used).toEqual([]);
  expect(issues.map((i) => [i.code, i.line])).toEqual([
    ["non-literal-argument", 3],
    ["non-literal-argument", 4],
    ["non-literal-argument", 5],
    ["non-literal-argument", 6],
  ]);
});

test("reserved commands and unknown entities are issues", () => {
  const { issues } = infer(`
    await sdk.run({ method: "addInstance", pageId: "p", component: "x@1.0.0" });
    await sdk.list("acme.bug");
  `);
  expect(issues.map((i) => `${i.code}:${i.detail}`)).toEqual(["reserved-command:addInstance", "unknown-entity:acme.bug"]);
});

test("unrelated receivers and test files are ignored", () => {
  expect(infer(`const list = [1]; list.map(String); cart.run({ method: "x" }); other.fetch("http://a");`).used).toEqual([]);
  expect(infer(`await sdk.list("ticket");`, "component.test.tsx").used).toEqual([]);
});
```

Run: `bun test packages/devkit/src/infer-permissions.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `infer-permissions.ts`**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BuiltinEntityType, COMMAND_WRITES, ProjectCommand } from "@kibo/schema";
import type * as TS from "typescript";
import { listSourceFiles } from "./hash";
import { issueAt, type SourceIssue } from "./issues";
import type { Toolchain } from "./toolchain";
import { loadTypeScript, type TypeScript } from "./typescript";

export type Inference = { used: string[]; issues: SourceIssue[] };

const RECEIVERS = new Set(["sdk", "ctx"]);
const NOTE_READS = new Set(["read", "search", "info"]);
const NOTE_WRITES = new Set(["write", "rename", "remove"]);
const METHODS = new Set(ProjectCommand.options.map((o) => o.shape.method.value));

function chain(ts: TypeScript, expr: TS.Expression): string[] | null {
  if (ts.isIdentifier(expr)) return RECEIVERS.has(expr.text) ? [expr.text] : null;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "useSdk") return ["sdk"];
  if (ts.isPropertyAccessExpression(expr)) {
    const head = chain(ts, expr.expression);
    return head ? [...head, expr.name.text] : null;
  }
  return null;
}

function literal(ts: TypeScript, node: TS.Node | undefined): string | null {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return null;
}

export function inferFromSources(ts: TypeScript, files: { path: string; text: string }[]): Inference {
  const used = new Set<string>();
  const issues: SourceIssue[] = [];
  for (const file of files) {
    if (/\.test\.tsx?$/.test(file.path)) continue;
    const kind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
    const lineOf = (n: TS.Node) => source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
    const nonLiteral = (n: TS.Node) => issues.push(issueAt(file.path, lineOf(n), "non-literal-argument", n.getText(source)));
    const entity = (call: TS.CallExpression, prefix: "read" | "write") => {
      const value = literal(ts, call.arguments[0]);
      if (value === null) return nonLiteral(call);
      if (!BuiltinEntityType.safeParse(value).success) {
        issues.push(issueAt(file.path, lineOf(call), "unknown-entity", value));
        return;
      }
      used.add(`${prefix}:${value}`);
    };
    const run = (call: TS.CallExpression) => {
      const arg = call.arguments[0];
      const prop =
        arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "method")
          : undefined;
      const method = prop && ts.isPropertyAssignment(prop) ? literal(ts, prop.initializer) : null;
      if (method === null) return nonLiteral(call);
      if (!METHODS.has(method)) {
        issues.push(issueAt(file.path, lineOf(call), "unknown-entity", method));
        return;
      }
      const target = COMMAND_WRITES[method as keyof typeof COMMAND_WRITES];
      if (target === null) {
        issues.push(issueAt(file.path, lineOf(call), "reserved-command", method));
        return;
      }
      used.add(`write:${target}`);
    };
    const visit = (node: TS.Node): void => {
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression) && node.expression.text === "useEntities") entity(node, "read");
        const path = chain(ts, node.expression);
        if (path && path.length >= 2) {
          const [, first, second] = path;
          if (path.length === 2 && first === "list") entity(node, "read");
          else if (path.length === 2 && first === "run") run(node);
          else if (path.length === 2 && first === "fetch") {
            const url = literal(ts, node.arguments[0]);
            if (url === null) nonLiteral(node);
            else used.add(`net:${url}`);
          } else if (path.length === 3 && first === "data") used.add("data");
          else if (path.length === 3 && first === "notes" && second && NOTE_READS.has(second)) used.add("read:note");
          else if (path.length === 3 && first === "notes" && second && NOTE_WRITES.has(second)) used.add("write:note");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { used: [...used], issues };
}

export async function inferPermissions(dir: string, toolchain: Toolchain): Promise<Inference> {
  const ts = await loadTypeScript(toolchain);
  const paths = (await listSourceFiles(dir)).filter((p) => /\.tsx?$/.test(p));
  const files = await Promise.all(paths.map(async (path) => ({ path, text: await readFile(join(dir, path), "utf8") })));
  return inferFromSources(ts, files);
}
```
`method as keyof typeof COMMAND_WRITES` est justifié : `METHODS.has(method)` vient de le vérifier. `ProjectCommand.options` est la liste des membres de l'union discriminée Zod.

`packages/devkit/src/index.ts` : ajouter `export * from "./infer-permissions";`.

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/devkit && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/devkit/src
git commit -m "feat(devkit): inférence des permissions"
```

---

### Task 6: Devkit, build d'un composant (sandbox, trusted, serveur, CSS)

**Files:**
- Create: `packages/devkit/src/build.ts`, `packages/devkit/src/build.test.ts`, `packages/sdk/src/theme.css`
- Modify: `packages/devkit/src/index.ts`, `packages/ui/src/index.css`

**Interfaces:**
- Consumes: `Toolchain`, `compileCss` (tâche 1) ; `ComponentManifest`, `SHARED_SPECIFIERS`, `SERVER_SPECIFIERS`, `KiboError` (tâche 2) ; `@kibo/sdk/sandbox` → `mountSandboxed(manifest, Component)` (tâche 13, résolu seulement quand le bundle sandbox est construit : le test de la tâche 6 fournit un `mountSandboxed` factice, voir étape 1).
- Produces:
  - `type BuildFile = "ui.sandbox.js" | "ui.trusted.js" | "ui.css" | "server.js" | "migrations.js"` ; `type BuildOutput = { manifest: ComponentManifest; files: Partial<Record<BuildFile, Uint8Array>> }` ; `buildComponent(srcDir: string, toolchain: Toolchain): Promise<BuildOutput>`.
  - `componentCss(srcDir: string, toolchain: Toolchain): Promise<string>` (utilisé aussi par `kibo component dev`).
  - Contrat du module `ui.trusted.js` : `export const manifest` (JSON brut du manifeste) et `export function Component`, avec `react`, `react/jsx-runtime` et `@kibo/sdk…` lus sur `globalThis.__kiboShared[<spécificateur>]` ; `lucide-react` est embarqué dans le module (icônes sans état : inutile de le partager, et l'UI n'a pas à exposer toute la bibliothèque, ce qui gonflerait son bundle).
  - Contrat de `server.js` / `migrations.js` : CommonJS, `module.exports.server` (valeur de `defineServer`) et `module.exports.migrations` (valeur de `defineMigrations`).
  - `packages/sdk/src/theme.css` : tokens zinc sombre et clair, variante `dark`, `@theme inline`, couche `base` (partagés par l'UI et les composants).

- [x] **Step 1: Extraire les tokens dans `theme.css`**

Créer `packages/sdk/src/theme.css` avec, **déplacés depuis `packages/ui/src/index.css` sans modification**, les blocs `@custom-variant dark …`, les deux `@theme inline { … }`, `:root { … }` (les deux), `.dark { … }` et `@layer base { … }`. `packages/ui/src/index.css` devient :
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "../../sdk/src/theme.css";
@source "../../sdk/src";
@source "../../../components";
```

Run: `bun run --cwd packages/ui build`
Expected: build vert ; comparer à l'œil l'appli (sombre et clair) : rien ne change.

- [x] **Step 2: Écrire le test du build**

`packages/devkit/src/build.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildComponent } from "./build";

const repo = resolve(import.meta.dir, "../../..");
const toolchain = { root: repo };
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function component(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "kibo-build-"));
  roots.push(root);
  const dir = join(root, "hello");
  mkdirSync(dir);
  for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
  symlinkSync(join(repo, "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

const manifest = JSON.stringify({
  id: "hello",
  version: "0.1.0",
  kind: "both",
  title: "Hello",
  reads: ["ticket"],
  writes: [],
});
const ui = `import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
export function Component() {
  const sdk = useSdk();
  return <Button className="bg-emerald-500"><Plus />{sdk.viewer}</Button>;
}
`;

test("builds sandbox, trusted and css outputs from the sources", async () => {
  const out = await buildComponent(component({ "kibo.component.json": manifest, "ui.tsx": ui }), toolchain);
  expect(out.manifest.id).toBe("hello");
  expect(Object.keys(out.files).sort()).toEqual(["ui.css", "ui.sandbox.js", "ui.trusted.js"]);
  const trusted = new TextDecoder().decode(out.files["ui.trusted.js"]);
  expect(trusted).toContain("__kiboShared");
  expect(trusted).not.toContain("react.production");
  const sandbox = new TextDecoder().decode(out.files["ui.sandbox.js"]);
  expect(sandbox.length).toBeGreaterThan(trusted.length * 5);
  const css = new TextDecoder().decode(out.files["ui.css"]);
  expect(css).toContain(".bg-emerald-500");
  expect(css).toContain(".dark");
}, 60_000);

test("server and migrations are CommonJS bundles", async () => {
  const out = await buildComponent(
    component({
      "kibo.component.json": manifest,
      "ui.tsx": ui,
      "server.ts": `import { defineServer } from "@kibo/sdk/server";\nexport const server = defineServer({ actions: { ping: async () => "pong" } });\n`,
      "migrations.ts": `import { defineMigrations } from "@kibo/sdk/migrations";\nexport const migrations = defineMigrations({ 1: { config: (c) => ({ ...c, v: 1 }) } });\n`,
    }),
    toolchain,
  );
  const server = new TextDecoder().decode(out.files["server.js"]);
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function("module", "exports", server)(mod, mod.exports);
  expect(typeof mod.exports.server).toBe("object");
  expect(out.files["migrations.js"]).toBeDefined();
}, 60_000);

test("a forbidden import fails the build", async () => {
  const bad = component({ "kibo.component.json": manifest, "ui.tsx": `import fs from "node:fs";\nexport const Component = () => String(fs);\n` });
  await expect(buildComponent(bad, toolchain)).rejects.toThrow("VALIDATION_FAILED");
}, 60_000);

test("a macro never runs at build time", async () => {
  const marker = join(mkdtempSync(join(tmpdir(), "kibo-macro-")), "ran");
  roots.push(dirname(marker));
  const dir = component({
    "kibo.component.json": manifest,
    "m.ts": `import { writeFileSync } from "node:fs";\nexport function pwn() { writeFileSync(${JSON.stringify(marker)}, "x"); return 1; }\n`,
    "ui.tsx": `import { pwn } from "./m.ts" with { type: "macro" };\nexport const Component = () => <p>{pwn()}</p>;\n`,
  });
  await expect(buildComponent(dir, toolchain)).rejects.toThrow("VALIDATION_FAILED");
  expect(existsSync(marker)).toBe(false);
}, 60_000);
```
Ajouter `dirname` à l'import de `node:path` et `existsSync` à celui de `node:fs` dans ce test.
Tant que la tâche 13 n'a pas livré `packages/sdk/src/sandbox.tsx`, le premier test échoue à la résolution de `@kibo/sdk/sandbox`. Pour rester indépendante, cette tâche crée `packages/sdk/src/sandbox.tsx` **uniquement s'il n'existe pas encore**, avec le contenu minimal :
```tsx
import type { ComponentType } from "react";

export function mountSandboxed(_manifest: unknown, _Component: ComponentType): void {
  throw new Error("mountSandboxed is provided by task 13");
}
```
La tâche 13 remplace ce fichier (conflit de rebase attendu et trivial : garder la version de la tâche 13).

Run: `bun test packages/devkit/src/build.test.ts`
Expected: FAIL (`./build` manquant).

- [x] **Step 3: Implémenter `build.ts`**

```ts
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { ComponentManifest, KiboError, SERVER_SPECIFIERS, SHARED_SPECIFIERS } from "@kibo/schema";
import type { BunPlugin } from "bun";
import { compileCss } from "./tailwind";
import type { Toolchain } from "./toolchain";

export type BuildFile = "ui.sandbox.js" | "ui.trusted.js" | "ui.css" | "server.js" | "migrations.js";
export type BuildOutput = { manifest: ComponentManifest; files: Partial<Record<BuildFile, Uint8Array>> };

type Mode = "sandbox" | "trusted" | "server";

const inside = (path: string, dir: string) => {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};
const IDENT = /^[A-Za-z_$][\w$]*$/;

async function sharedShim(spec: string, toolchain: Toolchain): Promise<string> {
  const mod: Record<string, unknown> = await import(Bun.resolveSync(spec, toolchain.root));
  const names = Object.keys(mod).filter((n) => n !== "default" && IDENT.test(n));
  return [
    `const m = globalThis.__kiboShared[${JSON.stringify(spec)}];`,
    "export default m.default ?? m;",
    ...names.map((n) => `export const ${n} = m.${n};`),
  ].join("\n");
}

function resolver(opts: { srcDir: string; entryDir: string; toolchain: Toolchain; mode: Mode }): BunPlugin {
  const allowed = new Set(
    opts.mode === "server"
      ? SERVER_SPECIFIERS
      : [...SHARED_SPECIFIERS, "react/jsx-dev-runtime", "@kibo/sdk/sandbox"],
  );
  return {
    name: "kibo-resolve",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const fromComponent =
          args.importer === "" || inside(args.importer, opts.srcDir) || inside(args.importer, opts.entryDir);
        if (!fromComponent) return undefined;
        const spec = args.path;
        if (spec.startsWith(".") || isAbsolute(spec)) {
          const target = isAbsolute(spec) ? spec : resolve(dirname(args.importer), spec);
          if (!inside(target, opts.srcDir) && !inside(target, opts.entryDir)) {
            throw new KiboError("VALIDATION_FAILED", `import outside the component: ${spec}`);
          }
          return undefined;
        }
        if (!allowed.has(spec)) throw new KiboError("VALIDATION_FAILED", `forbidden import: ${spec}`);
        if (opts.mode === "trusted" && spec !== "@kibo/sdk/sandbox" && spec !== "lucide-react") {
          return { path: spec, namespace: "kibo-shared" };
        }
        return { path: Bun.resolveSync(spec, opts.toolchain.root) };
      });
      build.onLoad({ filter: /.*/, namespace: "kibo-shared" }, async (args) => ({
        contents: await sharedShim(args.path, opts.toolchain),
        loader: "js",
      }));
    },
  };
}

async function bundle(entry: string, mode: Mode, opts: { srcDir: string; entryDir: string; toolchain: Toolchain }) {
  const target: Target = mode === "server" ? "bun" : "browser";
  const format: "cjs" | "esm" = mode === "server" ? "cjs" : "esm";
  const config = {
    entrypoints: [entry],
    target,
    format,
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [resolver({ ...opts, mode })],
    throw: false,
    macros: false,
  };
  const result = await Bun.build(config);
  const [output] = result.outputs;
  if (!result.success || !output) {
    const message = result.logs.map((l) => l.message).join("\n");
    throw new KiboError("VALIDATION_FAILED", message || `build failed for ${entry}`);
  }
  return new Uint8Array(await output.arrayBuffer());
}

export async function componentCss(srcDir: string, toolchain: Toolchain): Promise<string> {
  const sdk = join(toolchain.root, "node_modules", "@kibo", "sdk", "src");
  return compileCss({
    css: [
      '@import "tailwindcss";',
      '@import "tw-animate-css";',
      '@import "shadcn/tailwind.css";',
      '@import "./node_modules/@kibo/sdk/src/theme.css";',
    ].join("\n"),
    sources: [srcDir, sdk],
    toolchain,
  });
}

export async function buildComponent(srcDir: string, toolchain: Toolchain): Promise<BuildOutput> {
  const manifestFile = join(srcDir, "kibo.component.json");
  const parsed = ComponentManifest.safeParse(JSON.parse(await readFile(manifestFile, "utf8")));
  if (!parsed.success) throw new KiboError("VALIDATION_FAILED", parsed.error.message);
  const entryDir = await mkdtemp(join(tmpdir(), "kibo-entry-"));
  try {
    const opts = { srcDir, entryDir, toolchain };
    const ui = JSON.stringify(join(srcDir, "ui.tsx"));
    const json = JSON.stringify(manifestFile);
    await writeFile(
      join(entryDir, "sandbox.tsx"),
      `import { mountSandboxed } from "@kibo/sdk/sandbox";\nimport manifest from ${json};\nimport { Component } from ${ui};\nmountSandboxed(manifest, Component);\n`,
    );
    await writeFile(
      join(entryDir, "trusted.tsx"),
      `import manifestJson from ${json};\nexport { Component } from ${ui};\nexport const manifest = manifestJson;\n`,
    );
    const files: BuildOutput["files"] = {
      "ui.sandbox.js": await bundle(join(entryDir, "sandbox.tsx"), "sandbox", opts),
      "ui.trusted.js": await bundle(join(entryDir, "trusted.tsx"), "trusted", opts),
      "ui.css": new TextEncoder().encode(await componentCss(srcDir, toolchain)),
    };
    if (existsSync(join(srcDir, "server.ts"))) files["server.js"] = await bundle(join(srcDir, "server.ts"), "server", opts);
    if (existsSync(join(srcDir, "migrations.ts"))) {
      files["migrations.js"] = await bundle(join(srcDir, "migrations.ts"), "server", opts);
    }
    return { manifest: parsed.data, files };
  } finally {
    await rm(entryDir, { recursive: true, force: true });
  }
}
```
Import de type en tête : `import type { BunPlugin, Target } from "bun";`. `macros: false` n'est pas déclaré dans les types de `bun` 1.4.2 mais est honoré par `Bun.build` (constaté : « Macros are disabled ») ; passer par la variable `config` (et non un littéral) évite le contrôle des propriétés en trop sans `as` (vérifié avec `tsc` strict). Le test « a macro never runs » en est la preuve ; le refus des attributs d'import (tâche 4) est la seconde barrière.
Points à respecter : le plugin ne s'occupe que des imports venant du composant (les fichiers de la toolchain se résolvent normalement) ; en mode `trusted` les modules partagés (sauf `lucide-react`, embarqué) deviennent des lectures de `globalThis.__kiboShared` ; `@tailwindcss/node` résout les `@import` depuis `toolchain.root`, d'où le chemin `./node_modules/@kibo/sdk/src/theme.css`. Si `Bun.build` n'accepte pas `throw: false` en 1.4.2, entourer l'appel d'un `try` qui transforme l'`AggregateError` en `KiboError("VALIDATION_FAILED", …)` (erreur transformée, pas avalée).

`packages/devkit/src/index.ts` : ajouter `export * from "./build";`.

- [x] **Step 4: Vérifier et committer**

Run: `bun test packages/devkit && bun run typecheck && bun run check && bun run --cwd packages/ui build`
Expected: PASS.

```bash
git add packages/devkit/src packages/sdk/src/theme.css packages/ui/src/index.css
git commit -m "feat(devkit): build des composants"
```
(ajouter `packages/sdk/src/sandbox.tsx` au `git add` seulement si l'étape 2 l'a créé.)

Écarts livrés : serveur et migrations construits en `target: "browser"` au format `cjs`, parce que `"bun"` enveloppe la sortie et que `new Function` n'y trouve aucun export. La construction part d'une copie de travail des seules sources hachées, dans un dossier temporaire dont le `node_modules` est lié à la toolchain (`build-resolve.ts`). Cela évite une seconde copie de React et contourne un bug de tree-shaking de Bun 1.4.2 avec un `onResolve` `/.*/`. En trusted, les modules partagés passent par `__kiboShared` quel que soit l'importeur, `lucide-react` compris. `lucide-react` et `shadcn` sont ajoutés à la racine pour le linker isolé.

---

### Task 7: SDK v1, API asynchrone complète

**Files:**
- Create: `packages/sdk/src/server.ts`, `packages/sdk/src/migrations.ts`, `packages/sdk/src/sdk-v1.test.ts`
- Modify: `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/client.ts`, `packages/ui/src/pages/PageView.tsx`, `packages/ui/src/shell/Host.tsx`, `packages/ui/src/shell/Shell.tsx`

**Interfaces:**
- Consumes: `COMMAND_WRITES`, `ComponentCall`, `FetchInitInput`, `FetchResponse`, `NoteMeta`, `NoteContent`, `NotesInfo`, `Surface`, `ruleCovers`, `Migrations`, `KiboError` (tâche 2).
- Produces (`@kibo/sdk`) :
  - `KiboSdk` complet : `instanceId`, `config`, `viewer`, `surface`, `list`, `run`, `subscribe`, `openTicket`, `openNewTicket`, `openFile(target: FileTarget)`, `openView(componentId)`, `data: InstanceData`, `fetch(url, init?)`, `action<T>(name, input?)`, `notes: NotesApi`.
  - `type FileTarget = { path: string; line?: number }`, `InstanceData`, `NotesApi`, `SdkMode = "builtin" | "gated"`.
  - `ProjectBackend` gagne `call(call: ComponentCall): Promise<unknown>`.
  - `createSdk(backend, manifest, ctx, mode = "builtin")` : en `builtin`, `list`/`run` passent par `snapshot`/`run` (v0.1) ; en `gated`, par `call`. `data`, `fetch`, `action`, `notes` et `list("note")` passent toujours par `call`. Le contrôle côté client (manifeste) reste fait dans les deux modes.
  - `projectBackend(client, projectId, instanceId)` (troisième paramètre ajouté) : `call` ⇒ RPC `componentCall`.
  - `@kibo/sdk/server` : `ServerContext`, `ServerAction`, `ServerJob`, `ServerDefinition`, `defineServer(def)`.
  - `@kibo/sdk/migrations` : `defineMigrations(m)`, types `MigrationStep`, `Migrations`.
  - `Host` (UI) gagne `openView(componentId: string): void` (et `openFile` s'il manque, voir « Ancrages »).

- [x] **Step 1: Écrire les tests du SDK v1**

`packages/sdk/src/sdk-v1.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { createProjectDoc, readProject } from "@kibo/core";
import { type ComponentCall, ComponentManifest } from "@kibo/schema";
import { defineMigrations } from "./migrations";
import { createSdk } from "./sdk";
import { defineServer } from "./server";
import type { ProjectBackend, SdkContext, SdkMode } from "./types";

const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "widget",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};

function setup(extra: Record<string, unknown>, mode: SdkMode = "builtin") {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const calls: ComponentCall[] = [];
  const runs: unknown[] = [];
  const backend: ProjectBackend = {
    snapshot: async () => readProject(doc),
    run: async (cmd) => {
      runs.push(cmd);
      return null;
    },
    call: async (c) => {
      calls.push(c);
      return c.kind === "data.keys" ? ["a"] : [];
    },
    subscribe: () => () => undefined,
  };
  const manifest = ComponentManifest.parse({ id: "probe", version: "1.0.0", kind: "both", title: "Probe", reads: [], writes: [], ...extra });
  return { sdk: createSdk(backend, manifest, ctx, mode), calls, runs };
}

describe("builtin mode", () => {
  test("entities come from the snapshot, notes from componentCall", async () => {
    const { sdk, calls } = setup({ reads: ["status", "note"] });
    expect((await sdk.list("status")).length).toBe(6);
    await sdk.list("note");
    expect(calls).toEqual([{ kind: "list", entity: "note" }]);
    expect(sdk.surface).toBe("widget");
  });
  test("run goes to the command bus", async () => {
    const { sdk, runs, calls } = setup({ writes: ["ticket"] });
    await sdk.run({ method: "createTicket", title: "A" });
    expect(runs).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});

describe("gated mode", () => {
  test("list and run go through componentCall", async () => {
    const { sdk, calls, runs } = setup({ reads: ["ticket"], writes: ["ticket"] }, "gated");
    await sdk.list("ticket");
    await sdk.run({ method: "createTicket", title: "A" });
    expect(calls.map((c) => c.kind)).toEqual(["list", "run"]);
    expect(runs).toEqual([]);
  });
});

describe("new capabilities", () => {
  test("data needs data: true", async () => {
    const denied = setup({});
    await expect(denied.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
    expect(denied.calls).toEqual([]);
    const allowed = setup({ data: true });
    await allowed.sdk.data.set("k", 1);
    expect(await allowed.sdk.data.keys()).toEqual(["a"]);
    expect(allowed.calls[0]).toEqual({ kind: "data.set", key: "k", value: 1 });
  });
  test("fetch needs a covering net rule and sends a complete init", async () => {
    const { sdk, calls } = setup({ net: ["api.github.com/graphql"] });
    await expect(sdk.fetch("https://example.com")).rejects.toThrow("PERMISSION_DENIED");
    await sdk.fetch("https://api.github.com/graphql", { method: "POST", body: "{}" });
    expect(calls).toEqual([
      { kind: "fetch", url: "https://api.github.com/graphql", init: { method: "POST", headers: {}, body: "{}" } },
    ]);
  });
  test("notes need read or write note", async () => {
    const reader = setup({ reads: ["note"] });
    await reader.sdk.notes.read("a.md");
    await reader.sdk.notes.search("loro");
    await reader.sdk.notes.info();
    await expect(reader.sdk.notes.write("a.md", "x", null)).rejects.toThrow("PERMISSION_DENIED");
    expect(reader.calls.map((c) => c.kind)).toEqual(["notes.read", "notes.search", "notes.info"]);
  });
  test("actions always reach the backend, reserved commands never do", async () => {
    const { sdk, calls } = setup({ writes: ["ticket"] }, "gated");
    await sdk.action("ping");
    expect(calls).toEqual([{ kind: "action", name: "ping", input: null }]);
    await expect(
      sdk.run({ method: "setInstanceData", instanceId: "x", key: "k", value: 1 }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });
});

test("defineServer and defineMigrations validate their shape", () => {
  expect(() => defineServer({ jobs: { sync: { everyMinutes: 0, run: async () => undefined } } })).toThrow("INVALID_INPUT");
  expect(defineServer({ actions: { ping: async () => "pong" } }).actions?.ping).toBeDefined();
  expect(() => defineMigrations({ 0: {} })).toThrow("INVALID_INPUT");
  expect(Object.keys(defineMigrations({ 1: {}, 2: {} }))).toEqual(["1", "2"]);
});
```

Run: `bun test packages/sdk/src/sdk-v1.test.ts`
Expected: FAIL.

- [x] **Step 2: Écrire `types.ts`**

```ts
import type {
  CommandResult,
  ComponentCall,
  ComponentManifest,
  EntityType,
  FetchInitInput,
  FetchResponse,
  Link,
  NoteContent,
  NoteMeta,
  NotesInfo,
  Page,
  ProjectCommand,
  ProjectSnapshot,
  Status,
  StatusId,
  Surface,
  TicketView,
} from "@kibo/schema";
import type { ComponentType } from "react";

export type EntityMap = { ticket: TicketView; status: Status; link: Link; page: Page; note: NoteMeta };
export type NewTicketDefaults = { statusId?: StatusId; parentId?: string | null };
export type FileTarget = { path: string; line?: number };

export type InstanceData = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

export type NotesApi = {
  read(path: string): Promise<NoteContent>;
  write(path: string, markdown: string, expectedMtime: number | null): Promise<NoteMeta>;
  rename(from: string, to: string): Promise<NoteMeta>;
  remove(path: string): Promise<void>;
  search(query: string): Promise<NoteMeta[]>;
  info(): Promise<NotesInfo>;
};

export type KiboSdk = {
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  list<T extends EntityType>(type: T): Promise<EntityMap[T][]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  subscribe(listener: () => void): () => void;
  openTicket(ticketId: string): void;
  openNewTicket(defaults: NewTicketDefaults): void;
  openFile(target: FileTarget): void;
  openView(componentId: string): void;
  data: InstanceData;
  fetch(url: string, init?: FetchInitInput): Promise<FetchResponse>;
  action<T = unknown>(name: string, input?: unknown): Promise<T>;
  notes: NotesApi;
};

export type ProjectBackend = {
  snapshot(): Promise<ProjectSnapshot>;
  run(cmd: ProjectCommand): Promise<unknown>;
  call(call: ComponentCall): Promise<unknown>;
  subscribe(listener: () => void): () => void;
};

export type SdkContext = Pick<
  KiboSdk,
  "instanceId" | "config" | "viewer" | "surface" | "openTicket" | "openNewTicket" | "openFile" | "openView"
>;
export type SdkMode = "builtin" | "gated";
export type ComponentModule = { manifest: ComponentManifest; Component: ComponentType };
```
Si la phase 3 a déjà défini `openFile` avec une autre signature, garder la sienne partout dans ce plan.

- [x] **Step 3: Écrire `sdk.ts`**

```ts
import {
  COMMAND_WRITES,
  type CommandResult,
  type ComponentCall,
  type ComponentManifest,
  type EntityType,
  type FetchInitInput,
  type FetchResponse,
  KiboError,
  type NoteContent,
  type NoteMeta,
  type NotesInfo,
  type ProjectCommand,
  ruleCovers,
} from "@kibo/schema";
import type { EntityMap, KiboSdk, ProjectBackend, SdkContext, SdkMode } from "./types";

export function createSdk(
  backend: ProjectBackend,
  manifest: ComponentManifest,
  ctx: SdkContext,
  mode: SdkMode = "builtin",
): KiboSdk {
  const deny = (what: string): never => {
    throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare ${what}`);
  };
  const needRead = (e: EntityType) => {
    if (!manifest.reads.includes(e)) deny(`read ${e}`);
  };
  const needWrite = (e: EntityType) => {
    if (!manifest.writes.includes(e)) deny(`write ${e}`);
  };
  const needData = () => {
    if (!manifest.data) deny("data");
  };
  const call = async <T>(c: ComponentCall): Promise<T> => (await backend.call(c)) as T;

  const fromSnapshot = <T extends EntityType>(type: T): Promise<EntityMap[T][]> => {
    const lists: { [K in EntityType]: () => Promise<EntityMap[K][]> } = {
      ticket: async () => (await backend.snapshot()).tickets,
      status: async () => (await backend.snapshot()).workflow,
      link: async () => (await backend.snapshot()).links,
      page: async () => (await backend.snapshot()).pages,
      note: () => call<NoteMeta[]>({ kind: "list", entity: "note" }),
    };
    return lists[type]();
  };

  return {
    ...ctx,
    async list<T extends EntityType>(type: T): Promise<EntityMap[T][]> {
      needRead(type);
      return mode === "gated" ? call<EntityMap[T][]>({ kind: "list", entity: type }) : fromSnapshot(type);
    },
    async run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]> {
      const entity = COMMAND_WRITES[cmd.method];
      if (entity === null) deny(`write ${cmd.method}`);
      else needWrite(entity);
      const result = mode === "gated" ? await backend.call({ kind: "run", command: cmd }) : await backend.run(cmd);
      return result as CommandResult[C["method"]];
    },
    subscribe: backend.subscribe,
    data: {
      async get<T = unknown>(key: string): Promise<T | undefined> {
        needData();
        return call<T | undefined>({ kind: "data.get", key });
      },
      async set(key, value) {
        needData();
        await call({ kind: "data.set", key, value });
      },
      async delete(key) {
        needData();
        await call({ kind: "data.delete", key });
      },
      async keys() {
        needData();
        return call<string[]>({ kind: "data.keys" });
      },
    },
    async fetch(url: string, init: FetchInitInput = {}): Promise<FetchResponse> {
      if (!manifest.net.some((rule) => ruleCovers(rule, url))) deny(`net ${url}`);
      return call<FetchResponse>({
        kind: "fetch",
        url,
        init: {
          method: init.method ?? "GET",
          headers: init.headers ?? {},
          ...(init.body !== undefined && { body: init.body }),
        },
      });
    },
    async action<T = unknown>(name: string, input?: unknown): Promise<T> {
      return call<T>({ kind: "action", name, input: input ?? null });
    },
    notes: {
      async read(path) {
        needRead("note");
        return call<NoteContent>({ kind: "notes.read", path });
      },
      async write(path, markdown, expectedMtime) {
        needWrite("note");
        return call<NoteMeta>({ kind: "notes.write", path, markdown, expectedMtime });
      },
      async rename(from, to) {
        needWrite("note");
        return call<NoteMeta>({ kind: "notes.rename", from, to });
      },
      async remove(path) {
        needWrite("note");
        await call({ kind: "notes.remove", path });
      },
      async search(query) {
        needRead("note");
        return call<NoteMeta[]>({ kind: "notes.search", query });
      },
      async info() {
        needRead("note");
        return call<NotesInfo>({ kind: "notes.info" });
      },
    },
  };
}
```
Les deux `as` sont les frontières RPC autorisées : la réponse du démon est typée par le genre d'appel, comme `client.rpc` le fait déjà par méthode.

- [x] **Step 4: Écrire `server.ts`, `migrations.ts`, étendre `client.ts`**

`packages/sdk/src/server.ts` :
```ts
import { KiboError } from "@kibo/schema";
import type { InstanceData, KiboSdk } from "./types";

export type ServerContext = {
  instanceId: string;
  config: Record<string, unknown>;
  list: KiboSdk["list"];
  run: KiboSdk["run"];
  data: InstanceData;
  fetch: KiboSdk["fetch"];
};
export type ServerAction = (ctx: ServerContext, input: unknown) => Promise<unknown>;
export type ServerJob = { everyMinutes: number; run: (ctx: ServerContext) => Promise<void> };
export type ServerDefinition = { actions?: Record<string, ServerAction>; jobs?: Record<string, ServerJob> };

export function defineServer(def: ServerDefinition): ServerDefinition {
  for (const [name, job] of Object.entries(def.jobs ?? {})) {
    if (!Number.isInteger(job.everyMinutes) || job.everyMinutes < 1) {
      throw new KiboError("INVALID_INPUT", `job ${name}: everyMinutes must be an integer >= 1`);
    }
  }
  return def;
}
```

`packages/sdk/src/migrations.ts` :
```ts
import { KiboError, type Migrations } from "@kibo/schema";

export type { MigrationStep, Migrations } from "@kibo/schema";

export function defineMigrations(m: Migrations): Migrations {
  for (const key of Object.keys(m)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1) throw new KiboError("INVALID_INPUT", `migration ${key} must be an integer >= 1`);
  }
  return m;
}
```

`packages/sdk/src/client.ts`, `projectBackend` :
```ts
export function projectBackend(client: KiboClient, projectId: string, instanceId: string): ProjectBackend {
  return {
    snapshot: () => client.rpc({ method: "getProject", projectId }),
    run: (command: ProjectCommand) => client.rpc({ method: "command", projectId, command }),
    call: (call: ComponentCall) => client.rpc({ method: "componentCall", projectId, instanceId, call }),
    subscribe: (listener) =>
      client.subscribe((id) => {
        if (id === projectId) listener();
      }),
  };
}
```

- [x] **Step 5: Garder l'UI compilable**

`packages/ui/src/shell/Host.tsx` : `Host` gagne `openView(componentId: string): void` (et `openFile(target: FileTarget): void` si la phase 3 ne l'a pas ajouté). Dans `Shell.tsx`, `openView` ouvre la première page `view` du projet actif dont l'instance a pour composant `componentId` (`splitRef(i.component).id === componentId`) ; s'il n'y en a pas, il ne fait rien pour l'instant (la tâche 28 ajoute la confirmation de l'écran D7 ; aucun composant n'appelle `openView` avant la tâche 25).

`packages/ui/src/pages/PageView.tsx`, dans `InstanceFrame` :
```tsx
      createSdk(projectBackend(client, projectId, instance.id), mod.manifest, {
        instanceId: instance.id,
        config: instance.config,
        viewer,
        surface,
        openTicket: host.openTicket,
        openNewTicket: host.openNewTicket,
        openFile: host.openFile,
        openView: host.openView,
      }),
```
où `surface` est une nouvelle prop de `InstanceFrame` (`page.kind === "view" ? "view" : "widget"`), ajoutée aux dépendances du `useMemo`.

- [x] **Step 6: Vérifier et committer**

Run: `bun test packages components && bun run typecheck && bun run check`
Expected: PASS (les tests v0.1 de Kanban et Tickets passent sans modification).

```bash
git add packages/sdk/src packages/ui/src/pages/PageView.tsx packages/ui/src/shell/Host.tsx packages/ui/src/shell/Shell.tsx
git commit -m "feat(sdk): API v1 asynchrone"
```

---

### Task 8: Proxy `fetch` anti-SSRF du démon

**Files:**
- Create: `packages/daemon/src/components/net-proxy.ts`, `packages/daemon/src/components/net-proxy.test.ts`

**Interfaces:**
- Consumes: `FetchInit`, `FetchResponse`, `ruleCovers`, `KiboError` (tâche 2).
- Produces:
  - `type Resolver = (host: string) => Promise<string[]>` ; `systemResolver: Resolver`.
  - `isPublicAddress(ip: string): boolean`.
  - `type NetProxyOptions = { resolve?: Resolver; transport?: typeof fetch; allowAddress?: (ip: string) => boolean; timeoutMs?: number; maxBytes?: number; maxRedirects?: number }`.
  - `proxyFetch(rules: readonly string[] | null, url: string, init: FetchInit, opts?: NetProxyOptions): Promise<FetchResponse>` (`rules = null` : pas de contrôle de règle, seulement anti-SSRF ; utilisé pour les intégrés).

- [x] **Step 1: Écrire les tests**

`packages/daemon/src/components/net-proxy.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { isPublicAddress, proxyFetch } from "./net-proxy";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/echo") return Response.json({ headers: Object.fromEntries(req.headers), method: req.method });
    if (url.pathname === "/redirect-out") return Response.redirect("https://api.kibo.dev/admin", 302);
    if (url.pathname === "/redirect-in") return Response.redirect("https://api.kibo.dev/v1/echo", 302);
    if (url.pathname.startsWith("/v1/loop")) return Response.redirect("https://api.kibo.dev/v1/loop", 302);
    if (url.pathname === "/v1/echo") return Response.json({ ok: true });
    if (url.pathname === "/big") return new Response("x".repeat(2_000));
    if (url.pathname === "/bin") return new Response(new Uint8Array([0, 1, 2]), { headers: { "content-type": "image/png" } });
    if (url.pathname === "/slow") return new Promise(() => undefined);
    return new Response("nope", { status: 404 });
  },
});
afterAll(() => server.stop(true));

const transport = ((input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(input));
  return fetch(`http://127.0.0.1:${server.port}${u.pathname}${u.search}`, init);
}) as typeof fetch;
const opts = { resolve: async () => ["203.0.113.10"], transport };
const GET = { method: "GET" as const, headers: {} };

describe("proxyFetch", () => {
  test("a covered https URL is fetched without credentials headers", async () => {
    const res = await proxyFetch(
      ["api.kibo.dev/echo"],
      "https://api.kibo.dev/echo",
      { method: "POST", headers: { cookie: "a=1", Authorization: "x", "x-ok": "1", "Proxy-Authorization": "p" } },
      opts,
    );
    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.method).toBe("POST");
    expect(body.headers["x-ok"]).toBe("1");
    expect(body.headers.cookie).toBeUndefined();
    expect(body.headers.authorization).toBeUndefined();
    expect(body.headers["proxy-authorization"]).toBeUndefined();
  });
  test("non https, uncovered URLs and private addresses are refused", async () => {
    await expect(proxyFetch(null, "http://api.kibo.dev/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(["api.kibo.dev/v1"], "https://api.kibo.dev/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(null, "https://127.0.0.1/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(null, "https://10.0.0.1/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    const rebinding = { ...opts, resolve: async () => ["203.0.113.10", "10.0.0.1"] };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", GET, rebinding)).rejects.toThrow("PERMISSION_DENIED");
  });
  test("redirects are followed only to covered targets, three times at most", async () => {
    await expect(proxyFetch(["api.kibo.dev"], "https://api.kibo.dev/redirect-in", GET, opts)).resolves.toMatchObject({ status: 200 });
    await expect(
      proxyFetch(["api.kibo.dev/redirect-out"], "https://api.kibo.dev/redirect-out", GET, opts),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(["api.kibo.dev/v1"], "https://api.kibo.dev/v1/loop", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
  });
  test("large bodies are truncated, binary bodies are base64", async () => {
    expect((await proxyFetch(null, "https://api.kibo.dev/big", GET, { ...opts, maxBytes: 100 })).body).toHaveLength(100);
    const bin = await proxyFetch(null, "https://api.kibo.dev/bin", GET, opts);
    expect(bin.headers["x-kibo-base64"]).toBe("1");
    expect(bin.body).toBe("AAEC");
  });
  test("a slow server times out", async () => {
    await expect(proxyFetch(null, "https://api.kibo.dev/slow", GET, { ...opts, timeoutMs: 100 })).rejects.toThrow("TIMEOUT");
  });
});

test("private, loopback, link-local and multicast addresses are not public", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1"]) {
    expect(isPublicAddress(ip)).toBe(false);
  }
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
    expect(isPublicAddress(ip)).toBe(false);
  }
  for (const ip of ["1.1.1.1", "203.0.113.10", "2606:4700:4700::1111"]) expect(isPublicAddress(ip)).toBe(true);
  expect(isPublicAddress("not-an-ip")).toBe(false);
});
```
Le faux serveur est joint par un `transport` injecté (la logique du proxy est identique à un vrai HTTPS ; aucun test ne touche le réseau réel). Le cast `as typeof fetch` du test est la frontière avec le type surchargé de `fetch`.

Run: `bun test packages/daemon/src/components/net-proxy.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `net-proxy.ts`**

```ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { type FetchInit, type FetchResponse, KiboError, ruleCovers } from "@kibo/schema";

export type Resolver = (host: string) => Promise<string[]>;
export type NetProxyOptions = {
  resolve?: Resolver;
  transport?: typeof fetch;
  allowAddress?: (ip: string) => boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

function isPublicV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || b === 0)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

function mappedV4(ip: string): string | null {
  const rest = ip.slice("::ffff:".length);
  if (rest.includes(".")) return rest;
  const [hi, lo] = rest.split(":").map((h) => Number.parseInt(h, 16));
  if (hi === undefined || lo === undefined || Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicV4(ip);
  if (version !== 6) return false;
  const x = ip.toLowerCase();
  if (x === "::" || x === "::1") return false;
  if (x.startsWith("::ffff:")) {
    const v4 = mappedV4(x);
    return v4 !== null && isPublicV4(v4);
  }
  const first = Number.parseInt(x.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return false;
  if (x.startsWith("64:ff9b:") || x.startsWith("2001:db8:")) return false;
  return true;
}

const STRIPPED = new Set(["cookie", "authorization", "host"]);
const cleanHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).filter(([k]) => {
      const n = k.toLowerCase();
      return !STRIPPED.has(n) && !n.startsWith("proxy-");
    }),
  );

async function assertAllowed(
  rules: readonly string[] | null,
  url: string,
  resolve: Resolver,
  allow: (ip: string) => boolean,
): Promise<void> {
  if (!URL.canParse(url)) throw new KiboError("INVALID_INPUT", "invalid url");
  const u = new URL(url);
  if (u.protocol !== "https:") throw new KiboError("PERMISSION_DENIED", "only https is allowed");
  if (rules !== null && !rules.some((r) => ruleCovers(r, url))) {
    throw new KiboError("PERMISSION_DENIED", `no net rule covers ${u.hostname}${u.pathname}`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0 || !addresses.every(allow)) {
    throw new KiboError("PERMISSION_DENIED", `address not allowed for ${host}`);
  }
}

const TEXT = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/;

async function readBody(res: Response, maxBytes: number): Promise<FetchResponse> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value.subarray(0, Math.max(0, maxBytes - total)));
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  const headers = Object.fromEntries([...res.headers].filter(([k]) => k !== "set-cookie"));
  const type = res.headers.get("content-type") ?? "";
  if (type === "" || TEXT.test(type)) return { status: res.status, headers, body: new TextDecoder().decode(bytes) };
  return {
    status: res.status,
    headers: { ...headers, "x-kibo-base64": "1" },
    body: Buffer.from(bytes).toString("base64"),
  };
}

export async function proxyFetch(
  rules: readonly string[] | null,
  url: string,
  init: FetchInit,
  opts: NetProxyOptions = {},
): Promise<FetchResponse> {
  const resolve = opts.resolve ?? systemResolver;
  const transport = opts.transport ?? fetch;
  const allow = opts.allowAddress ?? isPublicAddress;
  const maxRedirects = opts.maxRedirects ?? 3;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 15_000);
  let current = url;
  let method = init.method;
  let body = init.body;
  try {
    for (let hop = 0; ; hop += 1) {
      await assertAllowed(rules, current, resolve, allow);
      const res = await transport(current, { method, headers: cleanHeaders(init.headers), body, redirect: "manual", signal });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || location === null) return await readBody(res, opts.maxBytes ?? 5_242_880);
      await res.body?.cancel();
      if (hop >= maxRedirects) throw new KiboError("PERMISSION_DENIED", "too many redirects");
      current = new URL(location, current).href;
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
    }
  } catch (e) {
    if (e instanceof KiboError) throw e;
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new KiboError("TIMEOUT", `fetch ${url} timed out`);
    }
    throw new KiboError("INTERNAL", `fetch ${url} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
```
Limite notée (risques du jalon) : la résolution DNS est vérifiée avant chaque saut mais la connexion refait sa propre résolution ; un rebinding à TTL nul reste théoriquement possible jusqu'au durcissement OS (phase 7).

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/daemon/src/components/net-proxy.test.ts && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/net-proxy.ts packages/daemon/src/components/net-proxy.test.ts
git commit -m "feat(daemon): proxy fetch anti-SSRF"
```

---

### Task 9: Analyse des notes Markdown (pure)

**Files:**
- Create: `packages/core/src/note-parse.ts`, `packages/core/src/note-parse.test.ts`
- Modify: `packages/core/package.json` (export `./notes`)

**Interfaces:**
- Consumes: rien (TypeScript pur, **aucun import `node:*`** : le module est aussi embarqué dans le SDK simulé côté navigateur).
- Produces (`@kibo/core/notes`) :
  - `splitFrontmatter(markdown): { tickets: string[]; body: string }`.
  - `stripCode(markdown): string` (blocs clôturés et code en ligne remplacés par des espaces).
  - `noteTitle(path, markdown): string` (premier `# ` hors code, sinon nom du fichier sans `.md`).
  - `ticketKeys(markdown, projectKey): string[]` (uniques, dans l'ordre d'apparition, frontmatter d'abord).
  - `type RawLink = { kind: "wiki" | "relative"; target: string }` ; `rawLinks(markdown): RawLink[]` (une entrée par occurrence).
  - `resolveLinks(fromPath, links, allPaths): string[]` (une entrée par occurrence résolue ; résolution Obsidian).
  - `parseNote(path, markdown, projectKey, allPaths): { title: string; tickets: string[]; links: string[] }`.

- [x] **Step 1: Écrire les tests**

`packages/core/src/note-parse.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { noteTitle, parseNote, rawLinks, resolveLinks, splitFrontmatter, ticketKeys } from "./note-parse";

const DOC = `---
tickets: [KIB-3, KIB-13]
aliases:
  - archi
---
# Décisions d'architecture

On garde Loro (voir KIB-12 et KIB-12, pas FAC-31).

\`\`\`ts
const key = "KIB-99";
# not a title
\`\`\`

Inline \`KIB-98\` ignoré. Voir [[Journal agents]], [[idees/Idées composants|idées]] et [le kick-off](./reunions/kick-off.md#ordre).
Encore [[Journal agents#Mardi]] et [site](https://example.com/x.md).
`;

describe("frontmatter and title", () => {
  test("tickets come from the frontmatter list", () => {
    expect(splitFrontmatter(DOC).tickets).toEqual(["KIB-3", "KIB-13"]);
    expect(splitFrontmatter("---\ntickets:\n  - KIB-1\n  - KIB-2\n---\nx").tickets).toEqual(["KIB-1", "KIB-2"]);
    expect(splitFrontmatter("no frontmatter").body).toBe("no frontmatter");
  });
  test("the title is the first heading outside code, else the file name", () => {
    expect(noteTitle("notes/decisions.md", DOC)).toBe("Décisions d'architecture");
    expect(noteTitle("notes/journal-agents.md", "texte")).toBe("journal-agents");
  });
});

describe("tickets", () => {
  test("keys of the project outside code, unique, frontmatter first", () => {
    expect(ticketKeys(DOC, "KIB")).toEqual(["KIB-3", "KIB-13", "KIB-12"]);
    expect(ticketKeys("KIB-120 et XKIB-1 et KIB-1a", "KIB")).toEqual(["KIB-120"]);
  });
});

describe("links", () => {
  test("wiki and relative markdown links, one per occurrence", () => {
    expect(rawLinks(DOC)).toEqual([
      { kind: "wiki", target: "Journal agents" },
      { kind: "wiki", target: "idees/Idées composants" },
      { kind: "relative", target: "./reunions/kick-off.md" },
      { kind: "wiki", target: "Journal agents" },
    ]);
  });
  test("Obsidian resolution: file name without extension, shortest path wins", () => {
    const all = ["notes/decisions.md", "Journal agents.md", "archive/Journal agents.md", "notes/idees/Idées composants.md", "notes/reunions/kick-off.md"];
    const links = rawLinks(DOC);
    expect(resolveLinks("notes/decisions.md", links, all)).toEqual([
      "Journal agents.md",
      "notes/idees/Idées composants.md",
      "notes/reunions/kick-off.md",
      "Journal agents.md",
    ]);
    expect(resolveLinks("a.md", [{ kind: "relative", target: "../../etc/x.md" }], all)).toEqual([]);
    expect(resolveLinks("a.md", [{ kind: "wiki", target: "Absente" }], all)).toEqual([]);
  });
  test("parseNote combines everything", () => {
    const parsed = parseNote("notes/decisions.md", DOC, "KIB", ["notes/decisions.md", "notes/Journal agents.md"]);
    expect(parsed.title).toBe("Décisions d'architecture");
    expect(parsed.links).toEqual(["notes/Journal agents.md", "notes/Journal agents.md"]);
  });
});
```

Run: `bun test packages/core/src/note-parse.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `note-parse.ts`**

```ts
export type RawLink = { kind: "wiki" | "relative"; target: string };

export function splitFrontmatter(markdown: string): { tickets: string[]; body: string } {
  const text = markdown.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { tickets: [], body: markdown };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { tickets: [], body: markdown };
  const yaml = text.slice(4, end).split("\n");
  const afterEnd = text.indexOf("\n", end + 4);
  const body = afterEnd < 0 ? "" : text.slice(afterEnd + 1);
  const tickets: string[] = [];
  const at = yaml.findIndex((l) => /^tickets\s*:/.test(l));
  if (at >= 0) {
    const inline = (yaml[at] ?? "").replace(/^tickets\s*:/, "").trim();
    if (inline) tickets.push(...inline.replace(/^\[|\]$/g, "").split(","));
    for (let i = at + 1; i < yaml.length && /^\s+-\s+/.test(yaml[i] ?? ""); i += 1) {
      tickets.push((yaml[i] ?? "").replace(/^\s+-\s+/, ""));
    }
  }
  return {
    tickets: tickets.map((t) => t.trim().replace(/^["']|["']$/g, "")).filter((t) => /^[A-Z]{2,6}-\d+$/.test(t)),
    body,
  };
}

export function stripCode(markdown: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank);
}

export function noteTitle(path: string, markdown: string): string {
  const match = /^# +(.+?)\s*#*\s*$/m.exec(stripCode(splitFrontmatter(markdown).body));
  if (match?.[1]) return match[1].trim();
  return (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
}

export function ticketKeys(markdown: string, projectKey: string): string[] {
  const { tickets, body } = splitFrontmatter(markdown);
  const re = new RegExp(`(?<![A-Za-z0-9_-])${projectKey}-\\d+(?![A-Za-z0-9_])`, "g");
  const inBody = [...stripCode(body).matchAll(re)].map((m) => m[0]);
  const own = tickets.filter((t) => t.startsWith(`${projectKey}-`));
  return [...new Set([...own, ...inBody])];
}

const WIKI = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;
const MARKDOWN = /\[[^\]\n]*\]\(([^)\s]+?\.md)(?:#[^)\s]*)?\)/g;

export function rawLinks(markdown: string): RawLink[] {
  const text = stripCode(splitFrontmatter(markdown).body);
  const found: { index: number; link: RawLink }[] = [];
  for (const m of text.matchAll(WIKI)) found.push({ index: m.index ?? 0, link: { kind: "wiki", target: (m[1] ?? "").trim() } });
  for (const m of text.matchAll(MARKDOWN)) {
    const target = m[1] ?? "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) continue;
    found.push({ index: m.index ?? 0, link: { kind: "relative", target } });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.link);
}

function normalize(path: string): string | null {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(segment);
  }
  return out.join("/");
}

const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const byLength = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);

function resolveWiki(target: string, allPaths: string[]): string | null {
  const wanted = target.toLowerCase().replace(/\.md$/, "");
  const matches = allPaths.filter((p) => {
    const lower = p.toLowerCase().replace(/\.md$/, "");
    return wanted.includes("/") ? lower === wanted || lower.endsWith(`/${wanted}`) : (lower.split("/").at(-1) ?? "") === wanted;
  });
  return matches.sort(byLength)[0] ?? null;
}

export function resolveLinks(fromPath: string, links: RawLink[], allPaths: string[]): string[] {
  const known = new Set(allPaths);
  const out: string[] = [];
  for (const link of links) {
    if (link.kind === "wiki") {
      const hit = resolveWiki(link.target, allPaths);
      if (hit) out.push(hit);
      continue;
    }
    let target: string;
    try {
      target = decodeURIComponent(link.target);
    } catch (e) {
      if (e instanceof URIError) continue;
      throw e;
    }
    const resolved = normalize(`${dirOf(fromPath)}/${target}`);
    if (resolved !== null && known.has(resolved)) out.push(resolved);
  }
  return out;
}

export function parseNote(
  path: string,
  markdown: string,
  projectKey: string,
  allPaths: string[],
): { title: string; tickets: string[]; links: string[] } {
  return {
    title: noteTitle(path, markdown),
    tickets: ticketKeys(markdown, projectKey),
    links: resolveLinks(path, rawLinks(markdown), allPaths),
  };
}
```
Le seul `catch` n'avale que `URIError` (lien mal encodé, ignoré comme un lien non résolu) et relance tout le reste.

`packages/core/package.json`, `exports` : ajouter `"./notes": "./src/note-parse.ts"`.

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/core && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/core/src/note-parse.ts packages/core/src/note-parse.test.ts packages/core/package.json
git commit -m "feat(core): analyse des notes Markdown"
```

---

### Task 10: Graphe, mise en page et chemin critique (purs)

**Files:**
- Create: `components/graph/package.json`, `components/graph/tsconfig.json`, `components/graph/kibo.component.json`, `components/graph/src/critical-path.ts`, `components/graph/src/layout.ts`, `components/graph/src/demo-graph.ts`, `components/graph/src/critical-path.test.ts`, `components/graph/src/layout.test.ts`
- Modify: `package.json` (script `typecheck` : `components/graph`), `bun.lock`

**Interfaces:**
- Consumes: `StatusId` (`@kibo/schema`).
- Produces:
  - `type GraphTicket = { id: string; key: string; statusId: StatusId }` ; `type GraphEdge = { from: string; to: string; type: "blocks" | "relates" }`.
  - `compareKeys(a, b): number` (ordre naturel `KIB-5` < `KIB-11`).
  - `criticalPath(tickets, edges): string[]` (ids ; `[]` s'il n'y a aucune chaîne de 2 tickets ou plus).
  - `NODE_W = 176`, `NODE_H = 52`, `GAP_X = 96`, `GAP_Y = 40`, `ISOLATED_GAP = 64` ; `type NodePosition = { id: string; layer: number; order: number; x: number; y: number; isolated: boolean }` ; `type GraphLayout = { nodes: NodePosition[]; width: number; height: number }` ; `layoutGraph(tickets, edges): GraphLayout`.

- [x] **Step 1: Créer le paquet**

`components/graph/package.json` :
```json
{
  "name": "@kibo/component-graph",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@kibo/schema": "workspace:*",
    "@kibo/sdk": "workspace:*",
    "lucide-react": "1.48.0"
  },
  "peerDependencies": {
    "react": "19.1.1"
  },
  "devDependencies": {
    "@testing-library/react": "16.3.0",
    "@types/react": "19.1.13",
    "fast-check": "4.3.0",
    "react": "19.1.1",
    "react-dom": "19.1.1"
  }
}
```
`components/graph/tsconfig.json` : copie de `components/kanban/tsconfig.json`.

`components/graph/kibo.component.json` :
```json
{
  "id": "graph",
  "version": "1.0.0",
  "kind": "both",
  "title": "Graphe de dépendances",
  "description": "Généré depuis les liens bloque / bloqué par",
  "reads": ["ticket", "status", "link"],
  "writes": [],
  "configSchema": {
    "filter": { "enum": ["mine-and-agents", "all"], "default": "mine-and-agents" },
    "hideDone": { "type": "boolean", "default": false }
  }
}
```
Racine `package.json` : ajouter `components/graph` au script `typecheck` après `components/kanban`. Run: `bun install`.

- [x] **Step 2: Écrire le jeu de test et les tests**

`components/graph/src/demo-graph.ts` (liens `blocks` et statuts de `design/donnees-fictives.md`) :
```ts
import type { GraphEdge, GraphTicket } from "./critical-path";

const t = (key: string, statusId: GraphTicket["statusId"]): GraphTicket => ({ id: key, key, statusId });

export const DEMO_TICKETS: GraphTicket[] = [
  t("KIB-5", "done"),
  t("KIB-13", "done"),
  t("KIB-12", "in_progress"),
  t("KIB-15", "todo"),
  t("KIB-11", "in_review"),
  t("KIB-21", "blocked"),
  t("KIB-22", "backlog"),
  t("KIB-16", "in_progress"),
  t("KIB-14", "in_progress"),
  t("KIB-18", "todo"),
  t("KIB-9", "todo"),
];

const b = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

export const DEMO_EDGES: GraphEdge[] = [
  b("KIB-5", "KIB-12"),
  b("KIB-13", "KIB-12"),
  b("KIB-12", "KIB-15"),
  b("KIB-11", "KIB-21"),
  b("KIB-21", "KIB-22"),
  b("KIB-16", "KIB-22"),
  { from: "KIB-12", to: "KIB-16", type: "relates" },
];
```

`components/graph/src/critical-path.test.ts` :
```ts
import { expect, test } from "bun:test";
import { compareKeys, criticalPath } from "./critical-path";
import { DEMO_EDGES, DEMO_TICKETS } from "./demo-graph";

test("the critical path of the demo data is KIB-11 → KIB-21 → KIB-22", () => {
  expect(criticalPath(DEMO_TICKETS, DEMO_EDGES)).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
});

test("done tickets are left out and ties go to the smallest keys", () => {
  const tickets = DEMO_TICKETS.map((x) => (x.key === "KIB-11" ? { ...x, statusId: "done" as const } : x));
  expect(criticalPath(tickets, DEMO_EDGES)).toEqual(["KIB-12", "KIB-15"]);
  expect(compareKeys("KIB-5", "KIB-11")).toBeLessThan(0);
});

test("no chain means no critical path", () => {
  expect(criticalPath(DEMO_TICKETS, [])).toEqual([]);
});
```

`components/graph/src/layout.test.ts` :
```ts
import { expect, test } from "bun:test";
import fc from "fast-check";
import type { GraphEdge, GraphTicket } from "./critical-path";
import { DEMO_EDGES, DEMO_TICKETS } from "./demo-graph";
import { layoutGraph } from "./layout";

const layerOf = (layout: ReturnType<typeof layoutGraph>) => Object.fromEntries(layout.nodes.map((n) => [n.id, n.layer]));

test("demo layout is right-aligned like screen 10", () => {
  const layout = layoutGraph(DEMO_TICKETS, DEMO_EDGES);
  expect(layerOf(layout)).toMatchObject({
    "KIB-5": 0,
    "KIB-13": 0,
    "KIB-11": 0,
    "KIB-12": 1,
    "KIB-16": 1,
    "KIB-21": 1,
    "KIB-15": 2,
    "KIB-22": 2,
  });
  const isolated = layout.nodes.filter((n) => n.isolated).map((n) => n.id);
  expect(isolated).toEqual(["KIB-9", "KIB-14", "KIB-18"]);
  const bottom = Math.max(...layout.nodes.filter((n) => !n.isolated).map((n) => n.y));
  for (const n of layout.nodes.filter((x) => x.isolated)) expect(n.y).toBeGreaterThan(bottom);
});

const dag = fc
  .integer({ min: 1, max: 14 })
  .chain((n) =>
    fc.tuple(
      fc.constant(n),
      fc.array(fc.tuple(fc.integer({ min: 0, max: n - 1 }), fc.integer({ min: 0, max: n - 1 })), { maxLength: 30 }),
    ),
  )
  .map(([n, pairs]) => {
    const tickets: GraphTicket[] = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, key: `KIB-${i + 1}`, statusId: "todo" }));
    const edges: GraphEdge[] = pairs
      .filter(([a, b]) => a < b)
      .map(([a, b]) => ({ from: `t${a}`, to: `t${b}`, type: "blocks" }));
    return { tickets, edges };
  });

test("a blocks target is always on a later layer than its source", () => {
  fc.assert(
    fc.property(dag, ({ tickets, edges }) => {
      const layers = layerOf(layoutGraph(tickets, edges));
      return edges.every((e) => (layers[e.to] ?? -1) > (layers[e.from] ?? Number.POSITIVE_INFINITY));
    }),
  );
});

test("the layout is deterministic and positions never overlap", () => {
  fc.assert(
    fc.property(dag, ({ tickets, edges }) => {
      const a = layoutGraph(tickets, edges);
      const b = layoutGraph([...tickets].reverse(), [...edges].reverse());
      const spots = new Set(a.nodes.map((n) => `${n.x},${n.y}`));
      return JSON.stringify(a) === JSON.stringify(b) && spots.size === a.nodes.length;
    }),
  );
});
```

Run: `bun test components/graph`
Expected: FAIL.

- [x] **Step 3: Implémenter `critical-path.ts`**

```ts
import type { StatusId } from "@kibo/schema";

export type GraphTicket = { id: string; key: string; statusId: StatusId };
export type GraphEdge = { from: string; to: string; type: "blocks" | "relates" };

export function compareKeys(a: string, b: string): number {
  const [pa = "", na = "0"] = a.split("-");
  const [pb = "", nb = "0"] = b.split("-");
  if (pa !== pb) return pa < pb ? -1 : 1;
  return Number(na) - Number(nb);
}

const compareChains = (a: string[], b: string[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const c = compareKeys(a[i] ?? "", b[i] ?? "");
    if (c !== 0) return c;
  }
  return a.length - b.length;
};

export function criticalPath(tickets: GraphTicket[], edges: GraphEdge[]): string[] {
  const open = new Map(tickets.filter((t) => t.statusId !== "done").map((t) => [t.id, t]));
  const next = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "blocks" || !open.has(e.from) || !open.has(e.to)) continue;
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  }
  const keyOf = (id: string) => open.get(id)?.key ?? id;
  const better = (a: string[], b: string[]) =>
    a.length > b.length || (a.length === b.length && compareChains(a.map(keyOf), b.map(keyOf)) < 0);
  const memo = new Map<string, string[]>();
  const longest = (id: string, path: Set<string>): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    let best = [id];
    for (const n of next.get(id) ?? []) {
      if (path.has(n)) continue;
      path.add(n);
      const candidate = [id, ...longest(n, path)];
      path.delete(n);
      if (better(candidate, best)) best = candidate;
    }
    memo.set(id, best);
    return best;
  };
  let result: string[] = [];
  for (const id of open.keys()) {
    const chain = longest(id, new Set([id]));
    if (better(chain, result)) result = chain;
  }
  return result.length > 1 ? result : [];
}
```

- [x] **Step 4: Implémenter `layout.ts`**

```ts
import { compareKeys, type GraphEdge, type GraphTicket } from "./critical-path";

export const NODE_W = 176;
export const NODE_H = 52;
export const GAP_X = 96;
export const GAP_Y = 40;
export const ISOLATED_GAP = 64;

export type NodePosition = { id: string; layer: number; order: number; x: number; y: number; isolated: boolean };
export type GraphLayout = { nodes: NodePosition[]; width: number; height: number };

const PASSES = 4;

export function layoutGraph(tickets: GraphTicket[], edges: GraphEdge[]): GraphLayout {
  const byKey = [...tickets].sort((a, b) => compareKeys(a.key, b.key));
  const ids = new Set(byKey.map((t) => t.id));
  const keyOf = new Map(byKey.map((t) => [t.id, t.key]));
  const blocks = edges.filter((e) => e.type === "blocks" && ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  for (const e of blocks) {
    succ.set(e.from, [...(succ.get(e.from) ?? []), e.to]);
    pred.set(e.to, [...(pred.get(e.to) ?? []), e.from]);
  }
  const connected = byKey.filter((t) => succ.has(t.id) || pred.has(t.id)).map((t) => t.id);
  const isolated = byKey.filter((t) => !succ.has(t.id) && !pred.has(t.id)).map((t) => t.id);

  const height = new Map<string, number>();
  const heightOf = (id: string, seen: Set<string>): number => {
    const known = height.get(id);
    if (known !== undefined) return known;
    let h = 0;
    for (const s of succ.get(id) ?? []) if (!seen.has(s)) h = Math.max(h, 1 + heightOf(s, new Set([...seen, s])));
    height.set(id, h);
    return h;
  };
  const top = Math.max(0, ...connected.map((id) => heightOf(id, new Set([id]))));
  const layerOf = new Map(connected.map((id) => [id, top - (height.get(id) ?? 0)]));

  const layers: string[][] = Array.from({ length: connected.length ? top + 1 : 0 }, () => []);
  for (const id of connected) layers[layerOf.get(id) ?? 0]?.push(id);
  const byKeyId = (a: string, b: string) => compareKeys(keyOf.get(a) ?? a, keyOf.get(b) ?? b);
  for (const layer of layers) layer.sort(byKeyId);

  const position = new Map<string, number>();
  const index = () => {
    for (const layer of layers) layer.forEach((id, i) => position.set(id, i));
  };
  index();
  for (let pass = 0; pass < PASSES; pass += 1) {
    const down = pass % 2 === 0;
    const order = down ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).slice(0, -1).reverse();
    for (const li of order) {
      const layer = layers[li] ?? [];
      const bary = new Map(
        layer.map((id) => {
          const refs = (down ? pred.get(id) : succ.get(id)) ?? [];
          const values = refs.map((r) => position.get(r) ?? 0);
          return [id, values.length ? values.reduce((a, b) => a + b, 0) / values.length : (position.get(id) ?? 0)];
        }),
      );
      layer.sort((a, b) => (bary.get(a) ?? 0) - (bary.get(b) ?? 0) || byKeyId(a, b));
      index();
    }
  }

  const nodes: NodePosition[] = [];
  layers.forEach((layer, li) =>
    layer.forEach((id, order) =>
      nodes.push({ id, layer: li, order, x: li * (NODE_W + GAP_X), y: order * (NODE_H + GAP_Y), isolated: false }),
    ),
  );
  const rows = Math.max(0, ...layers.map((l) => l.length));
  const isolatedY = rows === 0 ? 0 : rows * (NODE_H + GAP_Y) - GAP_Y + ISOLATED_GAP;
  isolated.forEach((id, i) =>
    nodes.push({ id, layer: -1, order: i, x: i * (NODE_W + GAP_X), y: isolatedY, isolated: true }),
  );
  const width = Math.max(0, ...nodes.map((n) => n.x + NODE_W));
  const heightPx = Math.max(0, ...nodes.map((n) => n.y + NODE_H));
  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  return { nodes, width, height: heightPx };
}
```
L'ordre final des `nodes` est trié par position : deux entrées dans un ordre différent produisent le même JSON (propriété de déterminisme).

- [x] **Step 5: Vérifier et committer**

Run: `bun test components/graph && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add package.json bun.lock components/graph
git commit -m "feat(graph): mise en page et chemin critique"
```

---

### Task 11: Runtime des backends, hôtes processus et Worker

**Files:**
- Create: `packages/daemon/src/components/runtime-core.ts`, `packages/daemon/src/component-runtime.ts`, `packages/daemon/src/components/component-worker.ts`, `packages/daemon/src/components/host-core.ts`, `packages/daemon/src/components/process-host.ts`, `packages/daemon/src/components/worker-host.ts`, `packages/daemon/src/components/backend-code.test-helper.ts`, `packages/daemon/src/components/process-host.test.ts`, `packages/daemon/src/components/worker-host.test.ts`
- Modify: `packages/daemon/package.json` (dépendance `@kibo/devkit`), `packages/daemon/tsconfig.json` (référence `../devkit`), `bun.lock`

**Interfaces:**
- Consumes: `restrictGlobals`, `isCompiled` (tâche 1) ; `BackendCode`, `BackendDescription`, `BackendToDaemon`, `DaemonToBackend`, `ComponentCall`, `ComponentManifest`, `InvokeTarget`, `applyMigrations`, `isKiboErrorCode`, `KiboError` (tâche 2).
- Produces:
  - `createRuntime(send: (m: BackendToDaemon) => void, code: BackendCode | null): { handle(m: DaemonToBackend): void }` ; `evaluateCjs(code, exportName): unknown`.
  - `startComponentRuntime(): Promise<void>` (entrée du processus) ; `component-worker.ts` (entrée du Worker).
  - `type InvokeRequest = { projectId: string; instanceId: string; config: Record<string, unknown>; target: InvokeTarget; input: unknown }` ; `type CallHandler = (projectId: string, instanceId: string, call: ComponentCall) => Promise<unknown>` ; `type HostOptions = { ref: string; manifest: ComponentManifest; code: BackendCode; onCall: CallHandler; beforeStart?: () => Promise<void>; idleMs?: number; timeoutMs?: number; readyTimeoutMs?: number; maxConcurrent?: number; backoffMs?: readonly number[]; now?: () => number; log?: (line: string) => void }` ; `type BackendHost = { invoke(req: InvokeRequest): Promise<unknown>; describe(): Promise<BackendDescription>; stop(): void; readonly running: boolean }`.
  - `createProcessHost(opts: HostOptions & { command?: string[] }): BackendHost` ; `runtimeCommand(): string[]` ; `createWorkerHost(opts: HostOptions): BackendHost`.
  - Défauts : délai 30 s par appel, 4 appels simultanés (au-delà : file FIFO), arrêt après 5 min d'inactivité, redémarrage après crash avec attente 1 s, 5 s puis 30 s.

- [x] **Step 1: Ajouter la dépendance**

`packages/daemon/package.json`, `dependencies` : `"@kibo/devkit": "workspace:*"` ; `packages/daemon/tsconfig.json`, `references` : `{ "path": "../devkit" }`. Run: `bun install`.

- [x] **Step 2: Écrire l'aide et les tests**

`packages/daemon/src/components/backend-code.test-helper.ts` :
```ts
import { ComponentManifest } from "@kibo/schema";

export const TEST_MANIFEST = ComponentManifest.parse({
  id: "probe",
  version: "0.1.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket"],
  writes: [],
  configVersion: 2,
});

export const SERVER_JS = `
let saved = null;
module.exports.server = {
  actions: {
    ping: async () => "pong",
    caps: async () => [typeof fetch, typeof Bun.file, typeof Bun.spawn, typeof process.binding].join(","),
    tickets: async (ctx) => ctx.list("ticket"),
    save: async (ctx) => { saved = ctx; return null; },
    late: async () => saved.list("ticket"),
    hang: () => new Promise(() => {}),
    crash: async () => { process.exit(3); },
    fail: async () => { const e = new Error("nope"); e.code = "CONFLICT"; e.detail = "nope"; throw e; },
  },
  jobs: { sync: { everyMinutes: 5, run: async () => undefined } },
};
`;

export const MIGRATIONS_JS = `
module.exports.migrations = {
  1: { config: (c) => ({ ...c, v: 1 }) },
  2: { data: (d) => ({ ...d, moved: true }) },
};
`;
```
Le suffixe `.test-helper.ts` n'est pas un motif de test de Bun : le fichier n'est pas exécuté seul.

`packages/daemon/src/components/process-host.test.ts` :
```ts
import { afterEach, describe, expect, test } from "bun:test";
import type { ComponentCall } from "@kibo/schema";
import { MIGRATIONS_JS, SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import type { BackendHost, HostOptions } from "./host-core";
import { createProcessHost } from "./process-host";

const hosts: BackendHost[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.stop();
});

function host(extra: Partial<HostOptions> = {}, calls: [string, string, ComponentCall][] = []) {
  const h = createProcessHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: MIGRATIONS_JS },
    onCall: async (projectId, instanceId, call) => {
      calls.push([projectId, instanceId, call]);
      return [{ key: "KIB-1" }];
    },
    backoffMs: [0],
    ...extra,
  });
  hosts.push(h);
  return h;
}
const action = (name: string, instanceId = "i1") => ({
  projectId: "p1",
  instanceId,
  config: {},
  target: { action: name },
  input: null,
});

describe("process host", () => {
  test("runs an action and describes the backend", async () => {
    const h = host();
    expect(await h.invoke(action("ping"))).toBe("pong");
    expect(await h.describe()).toEqual({
      actions: ["ping", "caps", "tickets", "save", "late", "hang", "crash", "fail"],
      jobs: [{ name: "sync", everyMinutes: 5 }],
    });
    expect(h.running).toBe(true);
  });
  test("network, file and process capabilities are gone before the code runs", async () => {
    expect(await host().invoke(action("caps"))).toBe("undefined,undefined,undefined,undefined");
  });
  test("calls reach the daemon bound to the running invocation", async () => {
    const calls: [string, string, ComponentCall][] = [];
    const h = host({}, calls);
    expect(await h.invoke(action("tickets", "i7"))).toEqual([{ key: "KIB-1" }]);
    expect(calls).toEqual([["p1", "i7", { kind: "list", entity: "ticket" }]]);
  });
  test("a context kept after its invocation is useless", async () => {
    const calls: [string, string, ComponentCall][] = [];
    const h = host({}, calls);
    await h.invoke(action("save"));
    await expect(h.invoke(action("late"))).rejects.toThrow("PERMISSION_DENIED");
    expect(calls).toEqual([]);
  });
  test("unknown actions, errors, timeouts and crashes become KiboErrors", async () => {
    const h = host({ timeoutMs: 300 });
    await expect(h.invoke(action("nope"))).rejects.toThrow("PERMISSION_DENIED");
    await expect(h.invoke(action("fail"))).rejects.toThrow("CONFLICT");
    await expect(h.invoke(action("hang"))).rejects.toThrow("TIMEOUT");
    await expect(h.invoke(action("crash"))).rejects.toThrow("COMPONENT_CRASHED");
    expect(await h.invoke(action("ping"))).toBe("pong");
  });
  test("after a crash, the backend waits for its backoff", async () => {
    const h = host({ backoffMs: [60_000] });
    await expect(h.invoke(action("crash"))).rejects.toThrow("COMPONENT_CRASHED");
    await expect(h.invoke(action("ping"))).rejects.toThrow("COMPONENT_CRASHED");
  });
  test("migrations run in the backend of the target version", async () => {
    const h = host();
    const out = await h.invoke({
      projectId: "p1",
      instanceId: "i1",
      config: {},
      target: { migrate: { from: 0, to: 2, config: { a: 1 }, data: {} } },
      input: null,
    });
    expect(out).toEqual({ config: { a: 1, v: 1 }, data: { moved: true } });
  });
  test("a refused start check never spawns the process", async () => {
    const h = host({
      beforeStart: async () => {
        throw new Error("TRUST_REQUIRED: tampered");
      },
    });
    await expect(h.invoke(action("ping"))).rejects.toThrow("TRUST_REQUIRED");
    expect(h.running).toBe(false);
  });
});
```

`packages/daemon/src/components/worker-host.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import type { BackendHost } from "./host-core";
import { createWorkerHost } from "./worker-host";

const hosts: BackendHost[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.stop();
});

test("a trusted backend runs in a worker with the same protocol", async () => {
  const seen: string[] = [];
  const h = createWorkerHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: null },
    onCall: async (_p, instanceId) => {
      seen.push(instanceId);
      return [];
    },
  });
  hosts.push(h);
  expect(await h.invoke({ projectId: "p", instanceId: "i1", config: {}, target: { action: "ping" }, input: null })).toBe("pong");
  expect(await h.invoke({ projectId: "p", instanceId: "i2", config: {}, target: { action: "tickets" }, input: null })).toEqual([]);
  expect(seen).toEqual(["i2"]);
});
```

Run: `bun test packages/daemon/src/components/process-host.test.ts packages/daemon/src/components/worker-host.test.ts`
Expected: FAIL.

- [x] **Step 3: Implémenter `runtime-core.ts`**

```ts
import {
  applyMigrations,
  type BackendCode,
  type BackendDescription,
  type BackendToDaemon,
  type ComponentCall,
  type DaemonToBackend,
  type InvokeTarget,
  isKiboErrorCode,
  KiboError,
  type Migrations,
} from "@kibo/schema";

type Json = Record<string, unknown>;
type Fn = (...args: unknown[]) => Promise<unknown>;
type Loaded = { actions: Record<string, Fn>; jobs: Record<string, { everyMinutes: number; run: Fn }>; migrations: Migrations };

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isFn = (v: unknown): v is Fn => typeof v === "function";

export function evaluateCjs(code: string, exportName: string): unknown {
  const mod: { exports: Json } = { exports: {} };
  const factory = new Function("module", "exports", code);
  factory(mod, mod.exports);
  return mod.exports[exportName];
}

function load(code: BackendCode | null): Loaded {
  const server = code?.server ? evaluateCjs(code.server, "server") : {};
  const migrations = code?.migrations ? evaluateCjs(code.migrations, "migrations") : {};
  if (!isRecord(server) || !isRecord(migrations)) throw new KiboError("VALIDATION_FAILED", "invalid backend exports");
  const actions: Record<string, Fn> = {};
  for (const [name, fn] of Object.entries(isRecord(server.actions) ? server.actions : {})) if (isFn(fn)) actions[name] = fn;
  const jobs: Loaded["jobs"] = {};
  for (const [name, job] of Object.entries(isRecord(server.jobs) ? server.jobs : {})) {
    if (isRecord(job) && isFn(job.run) && Number.isInteger(job.everyMinutes) && Number(job.everyMinutes) >= 1) {
      jobs[name] = { everyMinutes: Number(job.everyMinutes), run: job.run };
    }
  }
  const steps: Record<number, { config?: (o: Json) => Json; data?: (o: Json) => Json }> = {};
  for (const [key, step] of Object.entries(migrations)) {
    if (!isRecord(step)) continue;
    steps[Number(key)] = {
      ...(isFn(step.config) && { config: step.config as unknown as (o: Json) => Json }),
      ...(isFn(step.data) && { data: step.data as unknown as (o: Json) => Json }),
    };
  }
  return { actions, jobs, migrations: steps };
}

const describe = (l: Loaded): BackendDescription => ({
  actions: Object.keys(l.actions),
  jobs: Object.entries(l.jobs).map(([name, j]) => ({ name, everyMinutes: j.everyMinutes })),
});

export function toWire(e: unknown): { code: string; message: string } {
  if (isRecord(e) && isKiboErrorCode(e.code)) {
    return { code: e.code, message: typeof e.detail === "string" ? e.detail : String(e.message ?? "") };
  }
  return { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
}

export function createRuntime(send: (m: BackendToDaemon) => void, code: BackendCode | null): { handle(m: DaemonToBackend): void } {
  let loaded: Loaded | null = null;
  let seq = 0;
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: unknown): void }>();

  const ctxFor = (invocation: number, instanceId: string, config: Json) => {
    const call = (c: ComponentCall) =>
      new Promise<unknown>((resolve, reject) => {
        seq += 1;
        pending.set(seq, { resolve, reject });
        send({ type: "call", id: seq, invocation, call: c });
      });
    return {
      instanceId,
      config,
      list: (entity: never) => call({ kind: "list", entity }),
      run: (command: never) => call({ kind: "run", command }),
      data: {
        get: (key: string) => call({ kind: "data.get", key }),
        set: async (key: string, value: unknown) => {
          await call({ kind: "data.set", key, value });
        },
        delete: async (key: string) => {
          await call({ kind: "data.delete", key });
        },
        keys: () => call({ kind: "data.keys" }),
      },
      fetch: (url: string, init: { method?: "GET"; headers?: Record<string, string>; body?: string } = {}) =>
        call({
          kind: "fetch",
          url,
          init: { method: init.method ?? "GET", headers: init.headers ?? {}, ...(init.body !== undefined && { body: init.body }) },
        }),
    };
  };

  const invoke = async (id: number, target: InvokeTarget, instanceId: string, config: Json, input: unknown) => {
    if (!loaded) throw new KiboError("INTERNAL", "backend is not loaded");
    if ("action" in target) {
      const fn = loaded.actions[target.action];
      if (!fn) throw new KiboError("PERMISSION_DENIED", `unknown action ${target.action}`);
      return fn(ctxFor(id, instanceId, config), input);
    }
    if ("job" in target) {
      const job = loaded.jobs[target.job];
      if (!job) throw new KiboError("NOT_FOUND", `unknown job ${target.job}`);
      await job.run(ctxFor(id, instanceId, config));
      return null;
    }
    const m = target.migrate;
    return applyMigrations(loaded.migrations, m.from, m.to, { config: m.config, data: m.data });
  };

  return {
    handle(msg) {
      if (msg.type === "load") {
        loaded = load(msg.code ?? code);
        send({ type: "ready", ...describe(loaded) });
        return;
      }
      if (msg.type === "invoke") {
        invoke(msg.id, msg.target, msg.instanceId, msg.config, msg.input).then(
          (result) => send({ type: "result", id: msg.id, ok: true, result: result ?? null }),
          (e: unknown) => send({ type: "result", id: msg.id, ok: false, error: toWire(e) }),
        );
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result ?? null);
      else p.reject(new KiboError(isKiboErrorCode(msg.error?.code) ? msg.error.code : "INTERNAL", msg.error?.message ?? ""));
    },
  };
}
```
Les `as unknown as` de `load` sont la frontière avec du code non typé évalué à l'exécution (`isFn` a vérifié que c'est une fonction). Les paramètres `entity: never` / `command: never` sont validés par le démon (Zod) : le runtime ne fait que relayer.

- [x] **Step 4: Implémenter les entrées processus et Worker**

`packages/daemon/src/component-runtime.ts` :
```ts
import { restrictGlobals } from "@kibo/devkit";
import { BackendCode, DaemonToBackend } from "@kibo/schema";
import { createRuntime } from "./components/runtime-core";

export async function startComponentRuntime(): Promise<void> {
  const code = BackendCode.parse(JSON.parse(await Bun.file(3).text()));
  const send = process.send?.bind(process);
  if (!send) throw new Error("component runtime needs an IPC channel");
  restrictGlobals({ freeze: true });
  const runtime = createRuntime((m) => send(m), code);
  process.on("message", (raw) => {
    const parsed = DaemonToBackend.safeParse(raw);
    if (!parsed.success) {
      console.error(`[kibo-runtime] invalid message: ${parsed.error.message}`);
      return;
    }
    runtime.handle(parsed.data);
  });
  process.on("disconnect", () => process.exit(0));
}

if (import.meta.main) await startComponentRuntime();
```
Repli G (spike) : si le descripteur 3 n'est pas utilisable, remplacer la lecture par `null` (`createRuntime(send, null)`) et le démon envoie le code dans `load` (`codeInLoad = true` pour le processus, étape 5).

`packages/daemon/src/components/component-worker.ts` :
```ts
import { DaemonToBackend } from "@kibo/schema";
import { createRuntime } from "./runtime-core";

declare const self: Worker;

const runtime = createRuntime((m) => self.postMessage(m), null);
self.addEventListener("message", (e: MessageEvent) => {
  const parsed = DaemonToBackend.safeParse(e.data);
  if (!parsed.success) {
    console.error(`[kibo-worker] invalid message: ${parsed.error.message}`);
    return;
  }
  runtime.handle(parsed.data);
});
```

- [x] **Step 5: Implémenter `host-core.ts`, `process-host.ts`, `worker-host.ts`**

`packages/daemon/src/components/host-core.ts` :
```ts
import {
  type BackendCode,
  type BackendDescription,
  BackendToDaemon,
  type ComponentCall,
  type ComponentManifest,
  type DaemonToBackend,
  type InvokeTarget,
  isKiboErrorCode,
  KiboError,
} from "@kibo/schema";
import { toWire } from "./runtime-core";

export type Channel = { send(msg: DaemonToBackend): void; close(): void };
export type ChannelFactory = (handlers: { message(raw: unknown): void; exit(reason: string): void }) => Promise<Channel>;
export type InvokeRequest = {
  projectId: string;
  instanceId: string;
  config: Record<string, unknown>;
  target: InvokeTarget;
  input: unknown;
};
export type CallHandler = (projectId: string, instanceId: string, call: ComponentCall) => Promise<unknown>;
export type HostOptions = {
  ref: string;
  manifest: ComponentManifest;
  code: BackendCode;
  onCall: CallHandler;
  beforeStart?: () => Promise<void>;
  idleMs?: number;
  timeoutMs?: number;
  readyTimeoutMs?: number;
  maxConcurrent?: number;
  backoffMs?: readonly number[];
  now?: () => number;
  log?: (line: string) => void;
};
export type BackendHost = {
  invoke(req: InvokeRequest): Promise<unknown>;
  describe(): Promise<BackendDescription>;
  stop(): void;
  readonly running: boolean;
};

type Pending = { req: InvokeRequest; resolve(v: unknown): void; reject(e: unknown): void; timer: ReturnType<typeof setTimeout> };

export function createHost(opts: HostOptions, open: ChannelFactory, codeInLoad: boolean): BackendHost {
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const idleMs = opts.idleMs ?? 300_000;
  const maxConcurrent = opts.maxConcurrent ?? 4;
  const backoff = opts.backoffMs ?? [1_000, 5_000, 30_000];
  let channel: Channel | null = null;
  let generation = 0;
  let description: BackendDescription | null = null;
  let starting: Promise<BackendDescription> | null = null;
  let onReady: ((d: BackendDescription) => void) | null = null;
  let crashes = 0;
  let retryAt = 0;
  let seq = 0;
  let active = 0;
  let idle: ReturnType<typeof setTimeout> | null = null;
  const inflight = new Map<number, Pending>();
  const waiting: (() => void)[] = [];

  const failAll = (error: KiboError) => {
    for (const [id, p] of inflight) {
      clearTimeout(p.timer);
      inflight.delete(id);
      p.reject(error);
    }
  };
  const shutdown = (reason: string) => {
    const c = channel;
    generation += 1;
    channel = null;
    description = null;
    starting = null;
    c?.close();
    failAll(new KiboError("COMPONENT_CRASHED", `${opts.ref} stopped: ${reason}`));
  };
  const scheduleIdle = () => {
    if (idle) clearTimeout(idle);
    if (active === 0 && channel) idle = setTimeout(() => active === 0 && shutdown("idle"), idleMs);
  };

  const onMessage = (raw: unknown) => {
    const parsed = BackendToDaemon.safeParse(raw);
    if (!parsed.success) {
      opts.log?.(`invalid backend message from ${opts.ref}: ${parsed.error.message}`);
      return;
    }
    const msg = parsed.data;
    if (msg.type === "ready") {
      description = { actions: msg.actions, jobs: msg.jobs };
      onReady?.(description);
      return;
    }
    if (msg.type === "result") {
      const p = inflight.get(msg.id);
      if (!p) return;
      inflight.delete(msg.id);
      clearTimeout(p.timer);
      crashes = 0;
      if (msg.ok) p.resolve(msg.result ?? null);
      else p.reject(new KiboError(isKiboErrorCode(msg.error?.code) ? msg.error.code : "INTERNAL", msg.error?.message ?? ""));
      return;
    }
    const c = channel;
    const owner = inflight.get(msg.invocation);
    if (!owner) {
      c?.send({ type: "result", id: msg.id, ok: false, error: { code: "PERMISSION_DENIED", message: "call outside of a running invocation" } });
      return;
    }
    opts.onCall(owner.req.projectId, owner.req.instanceId, msg.call).then(
      (result) => c?.send({ type: "result", id: msg.id, ok: true, result: result ?? null }),
      (e: unknown) => c?.send({ type: "result", id: msg.id, ok: false, error: toWire(e) }),
    );
  };

  const onExit = (gen: number) => (reason: string) => {
    if (gen !== generation) return;
    opts.log?.(`backend ${opts.ref} exited: ${reason}`);
    crashes += 1;
    retryAt = now() + (backoff[Math.min(crashes - 1, backoff.length - 1)] ?? 0);
    shutdown(reason);
  };

  const start = async (): Promise<BackendDescription> => {
    if (now() < retryAt) throw new KiboError("COMPONENT_CRASHED", `${opts.ref} is restarting`);
    await opts.beforeStart?.();
    const gen = generation + 1;
    generation = gen;
    const ready = new Promise<BackendDescription>((resolve, reject) => {
      onReady = resolve;
      setTimeout(() => reject(new KiboError("TIMEOUT", `${opts.ref} did not start`)), opts.readyTimeoutMs ?? 10_000);
    });
    channel = await open({ message: (m) => gen === generation && onMessage(m), exit: onExit(gen) });
    channel.send({ type: "load", manifest: opts.manifest, ...(codeInLoad && { code: opts.code }) });
    try {
      return await ready;
    } catch (e) {
      shutdown("start failed");
      throw e;
    }
  };

  const ensure = (): Promise<BackendDescription> => {
    if (channel && description) return Promise.resolve(description);
    starting ??= start().catch((e: unknown) => {
      starting = null;
      throw e;
    });
    return starting;
  };

  const acquire = async () => {
    if (active >= maxConcurrent) await new Promise<void>((r) => waiting.push(r));
    active += 1;
  };
  const release = () => {
    active -= 1;
    waiting.shift()?.();
    scheduleIdle();
  };

  return {
    async invoke(req) {
      await acquire();
      try {
        await ensure();
        const c = channel;
        if (!c) throw new KiboError("COMPONENT_CRASHED", `${opts.ref} is not running`);
        if (idle) clearTimeout(idle);
        seq += 1;
        const id = seq;
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            inflight.delete(id);
            reject(new KiboError("TIMEOUT", `${opts.ref} took more than ${timeoutMs} ms`));
            shutdown("timeout");
          }, timeoutMs);
          inflight.set(id, { req, resolve, reject, timer });
          c.send({ type: "invoke", id, instanceId: req.instanceId, config: req.config, target: req.target, input: req.input });
        });
      } finally {
        release();
      }
    },
    describe: ensure,
    stop: () => {
      if (idle) clearTimeout(idle);
      shutdown("stopped");
    },
    get running() {
      return channel !== null;
    },
  };
}
```
Un arrêt volontaire (inactivité, délai dépassé, `stop`) passe par `shutdown`, qui incrémente `generation` : l'événement de sortie qui suit est ignoré et ne compte pas comme un crash. Seule une sortie inattendue incrémente `crashes` et impose l'attente.

`packages/daemon/src/components/process-host.ts` :
```ts
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { type BackendHost, createHost, type HostOptions } from "./host-core";

const LOG_LIMIT = 65_536;

export function runtimeCommand(): string[] {
  return isCompiled()
    ? [process.execPath, "component-runtime"]
    : [process.execPath, join(import.meta.dir, "..", "component-runtime.ts")];
}

async function pipeLog(stream: ReadableStream<Uint8Array>, log: (line: string) => void): Promise<void> {
  let seen = 0;
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    if (seen >= LOG_LIMIT) continue;
    const part = chunk.subarray(0, LOG_LIMIT - seen);
    seen += part.byteLength;
    log(decoder.decode(part));
  }
}

export function createProcessHost(opts: HostOptions & { command?: string[] }): BackendHost {
  const log = opts.log ?? ((line: string) => console.error(`[kibo-daemon] ${opts.ref}: ${line}`));
  return createHost(
    { ...opts, log },
    async (handlers) => {
      const cwd = mkdtempSync(join(tmpdir(), "kibo-backend-"));
      chmodSync(cwd, 0o700);
      const proc = Bun.spawn(opts.command ?? runtimeCommand(), {
        cwd,
        env: { KIBO_COMPONENT: opts.ref },
        stdio: ["ignore", "ignore", "pipe", "pipe"],
        serialization: "json",
        ipc: (message) => handlers.message(message),
        onExit: (_p, code, signal) => {
          rmSync(cwd, { recursive: true, force: true });
          handlers.exit(`code ${code ?? "none"}, signal ${signal ?? "none"}`);
        },
      });
      pipeLog(proc.stderr, log).catch((e: unknown) => log(`stderr closed: ${String(e)}`));
      const fd = proc.stdio[3];
      await Bun.write(Bun.file(Number(fd)), JSON.stringify(opts.code));
      return { send: (m) => proc.send(m), close: () => proc.kill() };
    },
    false,
  );
}
```
L'écriture sur le descripteur 3 suit le résultat du spike G (tâche 1) ; en repli, supprimer les deux lignes `fd`, passer `stdio: ["ignore", "ignore", "pipe"]` et `codeInLoad = true`.

`packages/daemon/src/components/worker-host.ts` :
```ts
import { isCompiled } from "@kibo/devkit";
import { type BackendHost, createHost, type HostOptions } from "./host-core";

const entry = () => (isCompiled() ? "./component-worker.ts" : new URL("./component-worker.ts", import.meta.url).href);

export function createWorkerHost(opts: HostOptions): BackendHost {
  return createHost(
    opts,
    async (handlers) => {
      const worker = new Worker(entry());
      worker.addEventListener("message", (e: MessageEvent) => handlers.message(e.data));
      worker.addEventListener("error", (e: ErrorEvent) => handlers.exit(e.message));
      worker.addEventListener("close", () => handlers.exit("closed"));
      return { send: (m) => worker.postMessage(m), close: () => worker.terminate() };
    },
    true,
  );
}
```

- [x] **Step 6: Vérifier et committer**

Run: `bun test packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/package.json packages/daemon/tsconfig.json bun.lock packages/daemon/src/component-runtime.ts packages/daemon/src/components
git commit -m "feat(daemon): runtime et hôtes de backend"
```

---

### Task 11b: Bac à sable OS du `ProcessHost` et de la validation (point E2)

Applique la décision 24 : sans barrière OS, le runtime restreint ne protège de rien (spike 1-C et contournements mesurés à la relecture de la tâche 1). Profil `sandbox-exec` validé à la main sur macOS arm64, Bun 1.4.2 : canal IPC Bun et descripteur 3 intacts ; lecture d'un fichier hors politique, `readdir` de `$HOME`, écriture hors du `cwd`, `execSync`, `fetch` et `net.connect` bloqués (`EPERM`, `ENOTFOUND`, `ECONNREFUSED`) ; écriture dans le `cwd` permise. Sans `(literal "/")` en lecture, Bun meurt au démarrage (`SIGABRT`).

**Files:**
- Create: `packages/devkit/src/os-sandbox.ts`, `packages/devkit/src/os-sandbox.test.ts`, `packages/daemon/src/components/process-host-sandbox.test.ts`, `packages/daemon/src/components/line-channel.ts`, `packages/daemon/src/components/line-channel.test.ts`
- Modify: `packages/schema/src/errors.ts` (code `SANDBOX_UNAVAILABLE`), `packages/devkit/src/index.ts`, `packages/daemon/src/components/process-host.ts`, `packages/daemon/src/component-runtime.ts`, `packages/daemon/src/components/runtime-core.ts`, `.github/workflows/ci.yml`, `docs/superpowers/specs/2026-09-26-kibo-composants.md` (§4.4, §10, §15, E2), `docs/superpowers/specs/2026-09-26-kibo-marketplace.md` (§8)

**Interfaces:**
- Consumes: `bunCommand` (tâche 1) ; `KiboError` (tâche 2) ; `createProcessHost`, `runtimeCommand`, `HostOptions`, `TEST_MANIFEST` (tâche 11).
- Produces:
  - `type SandboxPolicy = { read: string[]; write: string[]; exec: string[]; cwd: string }` ; `type OsSandbox = { ready(): Promise<void>; wrap(argv: string[], policy: SandboxPolicy): string[] }`.
  - `macosProfile(policy): string` ; `bwrapArgv(bwrap: string, policy, argv): string[]` ; `createOsSandbox(opts?: { platform?: NodeJS.Platform; which?: (bin: string) => string | null }): OsSandbox` ; `osSandbox(): OsSandbox` (instance partagée).
  - `createProcessHost(opts: HostOptions & { command?: string[]; sandbox?: OsSandbox })` ; `runtimePolicy(command: string[], cwd: string): SandboxPolicy`.
  - Code d'erreur `SANDBOX_UNAVAILABLE` : aucun bac à sable utilisable ⇒ le backend sandboxé ne démarre pas, les tests d'une validation ne sont pas lancés. Jamais de repli sans isolation.
  - Canal borné (décision 25) : `BACKEND_MESSAGE_LIMIT = 4 * 1024 * 1024` ; `type LineSink = { line(text: string): void; overflow(): void }` ; `readLines(stream: ReadableStream<Uint8Array>, limit: number, sink: LineSink): Promise<void>`. Protocole du runtime : descripteur 3 = une ligne `BackendCode` puis un `DaemonToBackend` par ligne (fin du flux ⇒ le runtime s'arrête) ; descripteur 4 = un `BackendToDaemon` par ligne. Plus de canal IPC Bun (`ipc`, `serialization`) dans le `ProcessHost` ; le `WorkerHost` (backends `trusted`) est inchangé.
  - Consommé par la tâche 20 (`ValidateOptions.sandbox`, tests du composant dans le bac à sable) et, sans changement d'interface, par les tâches 17, 30 et 32 (le `ProcessHost` réel est isolé).

- [x] **Step 1: Écrire la spec avant le code**

`docs/superpowers/specs/2026-09-26-kibo-composants.md` :
- §4.4, remplacer la puce « **Limite assumée** … » par : « **Bac à sable OS** (décision 24) : le runtime est lancé sous `sandbox-exec` (macOS) ou `bwrap` (Linux) : lecture du binaire (en dev : du dépôt) et des bibliothèques système, écriture dans son `cwd` temporaire seulement, aucun réseau ; sous macOS, aucun autre exécutable ; sous Linux, seuls les bibliothèques système et le binaire du runtime sont visibles, et tout processus lancé reste dans le même bac à sable (interdire `execve` : filtre seccomp, phase 7). Sans bac à sable utilisable : `SANDBOX_UNAVAILABLE`, le backend ne démarre pas (l'UI sandboxée fonctionne). Le retrait des capacités et le refus des imports restent en défense en profondeur. Les tests d'un composant lancés par la validation (§7.4) tournent dans le même bac à sable (lecture de la toolchain et de la copie, écriture dans la copie). »
- §10 : « Backend sandboxé et tests de la validation isolés par l'OS (`sandbox-exec`, `bwrap`) : ni réseau, ni disque hors de leur dossier, ni processus hors du bac à sable ; sans bac à sable, `SANDBOX_UNAVAILABLE` et rien ne démarre. » ; §15 : ajouter la décision 24 de ce plan (texte identique) et le code `SANDBOX_UNAVAILABLE` ; tableau des points à arbitrer : ligne E2 identique à celle de ce plan.

`docs/superpowers/specs/2026-09-26-kibo-marketplace.md` §8, en tête : « Livré dès la phase 4 (spec B, décision 24) pour `ProcessHost` et les tests de la validation. Restent en phase 7 : le réglage « Autoriser les backends sandboxés sans isolation OS », l'écran 19, le filtre seccomp, et l'exécution des tests d'installation du marketplace dans ce bac à sable. » ; dans le tableau §8.3, colonne « Phase 4 », remplacer chaque cellule par « bloqué par l'OS (décision 24) ».

- [x] **Step 2: Ajouter le code d'erreur**

`packages/schema/src/errors.ts` : ajouter `"SANDBOX_UNAVAILABLE",` après `"QUOTA_EXCEEDED",`.

- [x] **Step 3: Écrire les tests du bac à sable**

`packages/devkit/src/os-sandbox.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bwrapArgv, createOsSandbox, macosProfile } from "./os-sandbox";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
};

const policy = {
  read: ["/opt/kibo/toolchain"],
  write: ["/tmp/kibo-work"],
  exec: ["/opt/kibo/bin/kibo-daemon"],
  cwd: "/tmp/kibo-work",
};

describe("profiles", () => {
  test("macOS denies by default, denies the network and only writes the work folder", () => {
    const profile = macosProfile(policy);
    expect(profile).toContain("(deny default)");
    expect(profile).toContain("(deny network*)");
    expect(profile).toContain('(allow process-exec (literal "/opt/kibo/bin/kibo-daemon"))');
    expect(profile).toContain('(subpath "/opt/kibo/toolchain")');
    expect(profile).toContain('(allow file-write* (literal "/dev/null") (subpath "/tmp/kibo-work"))');
    expect(profile).not.toContain(process.env.HOME ?? "/nonexistent-home");
  });
  test("a quote in a path is refused rather than escaped", () => {
    expect(() => macosProfile({ ...policy, read: ['/tmp/a"b'] })).toThrow("INTERNAL");
  });
  test("bubblewrap unshares everything and binds only the policy", () => {
    const argv = bwrapArgv("/usr/bin/bwrap", policy, ["/opt/kibo/bin/kibo-daemon", "component-runtime"]);
    expect(argv.slice(0, 2)).toEqual(["/usr/bin/bwrap", "--unshare-all"]);
    expect(argv).toContain("--die-with-parent");
    expect(argv.join(" ")).toContain("--ro-bind /opt/kibo/toolchain /opt/kibo/toolchain");
    expect(argv.join(" ")).toContain("--ro-bind /opt/kibo/bin/kibo-daemon /opt/kibo/bin/kibo-daemon");
    expect(argv.join(" ")).not.toContain("/opt/kibo/bin /opt/kibo/bin");
    expect(argv.join(" ")).not.toMatch(/--ro-bind(-try)? \/usr \/usr /);
    expect(argv.join(" ")).toContain("--bind /tmp/kibo-work /tmp/kibo-work");
    expect(argv.slice(-3)).toEqual(["--", "/opt/kibo/bin/kibo-daemon", "component-runtime"]);
  });
  test("no sandbox on the platform means SANDBOX_UNAVAILABLE, never an unsandboxed command", () => {
    expect(() => createOsSandbox({ platform: "linux", which: () => null }).wrap(["/bin/true"], policy)).toThrow(
      "SANDBOX_UNAVAILABLE",
    );
    expect(() => createOsSandbox({ platform: "win32" }).wrap(["/bin/true"], policy)).toThrow("SANDBOX_UNAVAILABLE");
  });
});

test("on this machine the sandbox blocks reads, writes, processes and the network outside the policy", async () => {
  const sandbox = createOsSandbox();
  await sandbox.ready();
  const secret = temp("kibo-secret-");
  writeFileSync(join(secret, "token"), "s3cret");
  const work = temp("kibo-work-");
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("open") });
  const script = `
const load = (() => 0).constructor("s", "return import(s)");
const out = {};
const attempt = async (name, fn) => { try { await fn(); out[name] = "open"; } catch (e) { out[name] = "blocked"; } };
const fs = await load("node:fs");
await attempt("read", () => fs.readFileSync(${JSON.stringify(join(secret, "token"))}, "utf8"));
await attempt("write", () => fs.writeFileSync(${JSON.stringify(join(secret, "pwned"))}, "x"));
const cp = await load("node:child_process");
await attempt("spawn", () => cp.execFileSync("/bin/echo", ["x"]));
await attempt("spawnUsr", () => cp.execFileSync("/usr/bin/echo", ["x"]));
await attempt("child", () => cp.execFileSync(process.execPath, ["-e", ${JSON.stringify(`require("node:fs").readFileSync(${JSON.stringify(join(secret, "token"))})`)}], { stdio: "ignore" }));
await attempt("connect", () => fetch("http://127.0.0.1:${listener.port}/"));
await attempt("inside", () => fs.writeFileSync("inside", "x"));
console.log(JSON.stringify(out));
`;
  try {
    const argv = sandbox.wrap([process.execPath, "-e", script], { read: [], write: [work], exec: [process.execPath], cwd: work });
    const proc = Bun.spawn(argv, { cwd: work, env: {}, stdout: "pipe", stderr: "pipe" });
    const out: unknown = JSON.parse((await new Response(proc.stdout).text()).trim());
    expect(out).toEqual({
      read: "blocked",
      write: "blocked",
      spawn: "blocked",
      spawnUsr: "blocked",
      child: "blocked",
      connect: "blocked",
      inside: "open",
    });
    expect(existsSync(join(secret, "pwned"))).toBe(false);
  } finally {
    listener.stop(true);
  }
}, 30_000);
```
Le script est une chaîne exécutée dans le processus isolé (pas du code du dépôt) : il simule un composant hostile qui a passé l'analyse statique. `child` relance le binaire du runtime (seul exécutable visible sous Linux) pour lire le secret : bloqué par `process-fork` sous macOS, lancé mais confiné sous Linux (lecture refusée, code de sortie non nul) ; dans les deux cas `execFileSync` lève.

`packages/daemon/src/components/process-host-sandbox.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { TEST_MANIFEST } from "./backend-code.test-helper";
import { createProcessHost } from "./process-host";

const ESCAPE_JS = `
module.exports.server = {
  actions: {
    escape: async (_ctx, input) => {
      const load = (() => 0).constructor("s", "return import(s)");
      const out = {};
      const attempt = async (name, fn) => { try { await fn(); out[name] = "open"; } catch (e) { out[name] = "blocked"; } };
      const fs = await load("node:fs");
      await attempt("read", () => fs.readFileSync(input.secret, "utf8"));
      const cp = await load("node:child_process");
      await attempt("spawn", () => cp.execFileSync("/usr/bin/echo", ["x"]));
      await attempt("child", () => cp.execFileSync(process.execPath, ["-e", 'require("node:fs").readFileSync(' + JSON.stringify(input.secret) + ")"], { stdio: "ignore" }));
      const net = await load("node:net");
      await attempt("connect", () => new Promise((ok, ko) => {
        const s = net.connect(input.port, "127.0.0.1");
        s.on("connect", ok);
        s.on("error", ko);
        setTimeout(() => ko(new Error("timeout")), 3000);
      }));
      return out;
    },
  },
};
`;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const escape = (input: unknown) => ({ projectId: "p1", instanceId: "i1", config: {}, target: { action: "escape" }, input });

test("a sandboxed backend cannot escape through a constructed import", async () => {
  const secret = realpathSync(mkdtempSync(join(tmpdir(), "kibo-secret-")));
  dirs.push(secret);
  writeFileSync(join(secret, "token"), "s3cret");
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("open") });
  const host = createProcessHost({ ref: "escape@0.1.0", manifest: TEST_MANIFEST, code: { server: ESCAPE_JS }, onCall: async () => null });
  try {
    const out = await host.invoke(escape({ secret: join(secret, "token"), port: listener.port }));
    expect(out).toEqual({ read: "blocked", spawn: "blocked", child: "blocked", connect: "blocked" });
  } finally {
    host.stop();
    listener.stop(true);
  }
}, 30_000);

test("without an OS sandbox the backend does not start", async () => {
  const unavailable = {
    ready: async () => {
      throw new KiboError("SANDBOX_UNAVAILABLE", "bwrap is not installed");
    },
    wrap: () => [],
  };
  const host = createProcessHost({
    ref: "escape@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: ESCAPE_JS },
    onCall: async () => null,
    sandbox: unavailable,
  });
  await expect(host.invoke(escape(null))).rejects.toThrow("SANDBOX_UNAVAILABLE");
  expect(host.running).toBe(false);
});
```
Si `BackendCode` exige `migrations`, passer `migrations: ""` (ou la forme réelle du schéma de la tâche 2).

Run: `bun test packages/devkit/src/os-sandbox.test.ts packages/daemon/src/components/process-host-sandbox.test.ts`
Expected: FAIL (`./os-sandbox` manquant).

- [x] **Step 4: Implémenter `os-sandbox.ts`**

```ts
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { bunCommand } from "./bun-command";

export type SandboxPolicy = { read: string[]; write: string[]; exec: string[]; cwd: string };
export type OsSandbox = { ready(): Promise<void>; wrap(argv: string[], policy: SandboxPolicy): string[] };

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const MACOS_SYSTEM = [
  "/usr/lib",
  "/usr/share/zoneinfo",
  "/System/Library",
  "/private/var/db/dyld",
  "/private/var/db/timezone",
];
const MACOS_LITERALS = ["/", "/dev/null", "/dev/random", "/dev/urandom", "/private/etc/localtime"];
const LINUX_SYSTEM = ["/usr/lib", "/usr/lib64", "/lib", "/lib64", "/usr/share/zoneinfo", "/etc/localtime"];

const real = (path: string): string => (existsSync(path) ? realpathSync(path) : path);
const unique = (paths: string[]): string[] => [...new Set(paths)];
const execDirs = (policy: SandboxPolicy): string[] => policy.exec.map((p) => dirname(real(p)));

function sbpl(path: string): string {
  if (/["\\\n]/.test(path)) throw new KiboError("INTERNAL", `path not allowed in a sandbox profile: ${path}`);
  return `"${path}"`;
}

export function macosProfile(policy: SandboxPolicy): string {
  const literal = (paths: string[]) => paths.map((p) => `(literal ${sbpl(p)})`).join(" ");
  const subpath = (paths: string[]) => unique(paths.map(real)).map((p) => `(subpath ${sbpl(p)})`).join(" ");
  const exec = unique(policy.exec.flatMap((p) => [p, real(p)]));
  return [
    "(version 1)",
    "(deny default)",
    `(allow process-exec ${literal(exec)})`,
    `(allow file-read* ${literal(MACOS_LITERALS)} ${subpath([...MACOS_SYSTEM, ...execDirs(policy), ...policy.read, ...policy.write])})`,
    "(allow file-read-metadata)",
    `(allow file-write* (literal "/dev/null") ${subpath(policy.write)})`,
    "(allow sysctl-read)",
    "(deny network*)",
  ].join("\n");
}

export function bwrapArgv(bwrap: string, policy: SandboxPolicy, argv: string[]): string[] {
  const bind = (flag: string, paths: string[]) => unique(paths).flatMap((p) => [flag, p, p]);
  return [
    bwrap,
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    ...bind("--ro-bind-try", LINUX_SYSTEM),
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    ...bind("--ro-bind", [...policy.exec, ...policy.read].map(real)),
    ...bind("--bind", policy.write.map(real)),
    "--chdir",
    real(policy.cwd),
    "--",
    ...argv,
  ];
}

export function createOsSandbox(
  opts: { platform?: NodeJS.Platform; which?: (bin: string) => string | null } = {},
): OsSandbox {
  const platform = opts.platform ?? process.platform;
  const which = opts.which ?? Bun.which;
  let probe: Promise<void> | null = null;

  const wrap = (argv: string[], policy: SandboxPolicy): string[] => {
    const [head, ...rest] = argv;
    if (!head) throw new KiboError("INTERNAL", "empty sandboxed command");
    const command = [real(head), ...rest];
    if (platform === "darwin" && existsSync(SANDBOX_EXEC)) return [SANDBOX_EXEC, "-p", macosProfile(policy), ...command];
    const bwrap = platform === "linux" ? which("bwrap") : null;
    if (bwrap) return bwrapArgv(bwrap, policy, command);
    throw new KiboError("SANDBOX_UNAVAILABLE", `no OS sandbox on ${platform}`);
  };

  const check = async (): Promise<void> => {
    const bun = bunCommand();
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "kibo-sandbox-probe-")));
    try {
      const argv = wrap([...bun.argv, "--version"], { read: [], write: [cwd], exec: bun.argv.slice(0, 1), cwd });
      const proc = Bun.spawn(argv, { cwd, env: bun.env, stdout: "ignore", stderr: "pipe" });
      const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
      if (code !== 0) throw new KiboError("SANDBOX_UNAVAILABLE", `sandbox probe exited with ${code}: ${stderr.slice(0, 500)}`);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  return {
    wrap,
    ready() {
      probe ??= check().catch((e: unknown) => {
        probe = null;
        throw e;
      });
      return probe;
    },
  };
}

let shared: OsSandbox | null = null;

export function osSandbox(): OsSandbox {
  shared ??= createOsSandbox();
  return shared;
}
```
Règles : chemins de la politique toujours résolus (`realpath` : `/tmp` est `/private/tmp` sous macOS, et le profil compare des chemins réels) ; les chemins système Linux ne le sont **pas** (`/lib` et `/lib64` sont des liens vers `/usr/lib*` sur Ubuntu : les résoudre ferait disparaître `/lib64/ld-linux-x86-64.so.2`, l'interpréteur ELF de Bun) ; sous Linux, le binaire du runtime est monté seul (fichier, pas son dossier : installé par le `.deb` dans `/usr/bin`, son dossier exposerait tous les outils du système) et `/usr` n'est pas monté en entier (seulement `/usr/lib`, `/usr/lib64`, `/usr/share/zoneinfo` : mesuré sous Debian arm64, `oven/bun:1.4.2`, `bwrap` non root : `bun --version` passe, `/bin/echo`, `/usr/bin/echo` et `/bin/sh` sont introuvables, un `bun` relancé à l'intérieur ne lit pas le secret) ; sous macOS, `file-read-metadata` reste global (Bun fait `lstat` sur les ancêtres de ses chemins) : un backend peut savoir qu'un fichier existe et sa taille, pas le lire ; un guillemet, une barre oblique inverse ou un saut de ligne dans un chemin est refusé (jamais d'échappement dans le profil SBPL) ; l'environnement n'est pas vidé par le bac à sable (`--clearenv` absent) car `Bun.spawn` fournit déjà un `env` minimal ; le canal passe par les descripteurs 3 et 4, hérités à travers `sandbox-exec` et `bwrap` sans variable d'environnement (vérifié sous Linux par la CI de la branche). La sonde (`ready`) lance `bun --version` (ou le binaire avec `BUN_BE_BUN=1`) dans le bac à sable une fois par processus ; un échec est oublié pour qu'une installation ultérieure de `bwrap` soit prise en compte. Toute lecture système ajoutée plus tard (`MACOS_SYSTEM`, `LINUX_SYSTEM`) est justifiée dans ce plan par le test qui l'exige. Preuves : `os-sandbox.test.ts` prouve la politique (processus Bun non restreint sous le même `wrap`) ; `process-host-sandbox.test.ts` prouve que le `ProcessHost` l'applique, par `read` et `connect` (`node:fs` et `node:net` ne sont pas retirés par le runtime) ; ses tentatives `spawn` et `child` peuvent échouer dès le runtime restreint (`Bun.spawnSync` retiré) et n'y valent que comme défense en profondeur. Vérification sous Docker : `bwrap` non root exige `--privileged --security-opt systempaths=unconfined` (sinon `/proc` ne se monte pas et la sonde lève `SANDBOX_UNAVAILABLE`), contrainte du conteneur seulement.

`packages/devkit/src/index.ts` : ajouter `export * from "./os-sandbox";`.

- [x] **Step 5: Isoler le `ProcessHost`**

`packages/daemon/src/components/process-host.ts` :
- imports : `realpathSync` en plus depuis `node:fs`, `resolve` en plus depuis `node:path`, `import { isCompiled, type OsSandbox, osSandbox, type SandboxPolicy } from "@kibo/devkit";` ;
- ajouter :
```ts
const DEV_ROOT = resolve(import.meta.dir, "../../../..");

export function runtimePolicy(command: string[], cwd: string): SandboxPolicy {
  return { read: isCompiled() ? [] : [DEV_ROOT], write: [cwd], exec: command.slice(0, 1), cwd };
}
```
- `createProcessHost(opts: HostOptions & { command?: string[]; sandbox?: OsSandbox })` : `const sandbox = opts.sandbox ?? osSandbox();` ; passer à `createHost` `{ ...opts, log, beforeStart: async () => { await sandbox.ready(); await opts.beforeStart?.(); } }` (la sonde passe avant la création de la promesse `ready` du démarrage : un échec ne laisse ni minuterie ni rejet orphelin, et ne compte pas comme un crash) ;
- dans la fabrique de canal : `const cwd = realpathSync(mkdtempSync(join(tmpdir(), "kibo-backend-")));`, puis `const command = opts.command ?? runtimeCommand();` et `Bun.spawn(sandbox.wrap(command, runtimePolicy(command, cwd)), { … })` (options inchangées).

En dev, le runtime lit le dépôt (`component-runtime.ts` et `node_modules`) ; dans le binaire compilé, il ne lit que le binaire. Les tests existants de la tâche 11 (`process-host.test.ts`) passent désormais par le bac à sable réel : ils doivent rester verts sans modification (c'est la preuve que les tubes des descripteurs 3 et 4, les délais et les redémarrages fonctionnent isolés).

- [x] **Step 5b: Canal borné entre le démon et le runtime (décision 25)**

Le canal IPC de Bun accumule sans limite ce que le runtime écrit jusqu'au saut de ligne : un backend qui écrit 1 Gio sur son socket (import construit de `node:fs`, puis `writeSync` sur le descripteur déjà ouvert, que le bac à sable n'interdit pas) sature la mémoire du démon avant tout contrôle. Le démon lit donc lui-même la sortie du runtime, ligne par ligne, avec un plafond. Mesuré (Bun 1.4.2, macOS) : un tube supplémentaire (`stdio[4]: "pipe"`) se lit côté parent par `Bun.file(fd).stream()` et s'écrit côté enfant par `Bun.file(4).writer()` ; les écritures non attendues d'un `FileSink` sur un tube sont mises en tampon (6 Mo reçus intacts) ; `FileSink.end()` ne ferme pas un descripteur numérique (`closeSync` explicite pour signaler la fin) ; Bun ne ferme pas `stdio[3]` ni `stdio[4]` à la sortie de l'enfant (à fermer par le démon, sinon fuite de descripteurs).

`packages/daemon/src/components/line-channel.test.ts` :
```ts
import { expect, test } from "bun:test";
import { readLines } from "./line-channel";

const bytes = (text: string) => new TextEncoder().encode(text);
const stream = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });

async function collect(limit: number, ...chunks: Uint8Array[]) {
  const lines: string[] = [];
  let overflow = false;
  await readLines(stream(...chunks), limit, {
    line: (l) => lines.push(l),
    overflow: () => {
      overflow = true;
    },
  });
  return { lines, overflow };
}

test("lines are split across chunks, even inside a multibyte character", async () => {
  const e = bytes('{"b":"é"}\n');
  expect(await collect(100, bytes('{"a":'), bytes('1}\n{"b'), e.subarray(3, 7), e.subarray(7), bytes('{"c":3}\n'))).toEqual({
    lines: ['{"a":1}', '{"b":"é"}', '{"c":3}'],
    overflow: false,
  });
});

test("a line longer than the limit stops the reading, with or without its newline", async () => {
  expect(await collect(8, bytes("12345678\n"), bytes("123456789\nlost\n"))).toEqual({ lines: ["12345678"], overflow: true });
  expect(await collect(8, bytes("1234"), bytes("56789"))).toEqual({ lines: [], overflow: true });
});
```
(Le premier test coupe `é`, deux octets `c3 a9`, entre deux morceaux : `e.subarray(3, 7)` finit au milieu du caractère ; les octets sont concaténés avant décodage.)

Dans `packages/daemon/src/components/process-host-sandbox.test.ts`, ajouter :
```ts
const LIMITS_JS = `
module.exports.server = {
  actions: {
    ping: async () => "pong",
    huge: async () => "x".repeat(5 * 1024 * 1024),
    flood: async () => {
      const fs = await (() => 0).constructor("s", "return import(s)")("node:fs");
      fs.writeSync(4, "x".repeat(10 * 1024 * 1024));
      return null;
    },
  },
};
`;
const limits = (log: (line: string) => void = () => undefined) =>
  createProcessHost({ ref: "limits@0.1.0", manifest: TEST_MANIFEST, code: { server: LIMITS_JS, migrations: null }, onCall: async () => null, log });
const call = (name: string) => ({ projectId: "p1", instanceId: "i1", config: {}, target: { action: name }, input: null });

test("a result over the limit is refused by the runtime and the backend keeps running", async () => {
  const host = limits();
  try {
    await expect(host.invoke(call("huge"))).rejects.toThrow("TOO_LARGE");
    expect(await host.invoke(call("ping"))).toBe("pong");
  } finally {
    host.stop();
  }
}, 30_000);

test("a backend writing past the limit on its output is killed, the daemon never buffers it", async () => {
  const lines: string[] = [];
  const host = limits((l) => lines.push(l));
  try {
    await expect(host.invoke(call("flood"))).rejects.toThrow("COMPONENT_CRASHED");
    expect(host.running).toBe(false);
    expect(lines.some((l) => l.includes("larger than"))).toBe(true);
  } finally {
    host.stop();
  }
}, 30_000);
```
Si `BackendCode` n'accepte pas `migrations: null`, reprendre la forme du schéma de la tâche 2.

Run: `bun test packages/daemon/src/components/line-channel.test.ts packages/daemon/src/components/process-host-sandbox.test.ts`
Expected: FAIL (`./line-channel` manquant).

`packages/daemon/src/components/line-channel.ts` :
```ts
export const BACKEND_MESSAGE_LIMIT = 4 * 1024 * 1024;

export type LineSink = { line(text: string): void; overflow(): void };

const NEWLINE = 10;

export async function readLines(stream: ReadableStream<Uint8Array>, limit: number, sink: LineSink): Promise<void> {
  const decoder = new TextDecoder();
  let parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    let start = 0;
    for (let end = chunk.indexOf(NEWLINE); end !== -1; end = chunk.indexOf(NEWLINE, start)) {
      size += end - start;
      if (size > limit) return sink.overflow();
      parts.push(chunk.subarray(start, end));
      sink.line(decoder.decode(Buffer.concat(parts)));
      parts = [];
      size = 0;
      start = end + 1;
    }
    size += chunk.byteLength - start;
    if (size > limit) return sink.overflow();
    parts.push(chunk.slice(start));
  }
}
```
Le reste d'un morceau est copié (`slice`) : le tampon d'un flux peut être réutilisé après l'itération. Sortir de la boucle annule le flux ; le démon tue alors le runtime.

`packages/daemon/src/components/runtime-core.ts`, dans `contextFactory` : envoyer **avant** d'enregistrer l'attente, pour qu'un envoi refusé (`TOO_LARGE`, levé dans l'exécuteur de la promesse) ne laisse aucune entrée orpheline :
```ts
      return new Promise<unknown>((resolve, reject) => {
        seq += 1;
        const id = seq;
        send({ type: "call", id, invocation, call: parsed.data });
        pending.set(id, { resolve, reject });
      });
```
(La réponse arrive toujours dans un message ultérieur : l'ordre est sûr.)

`packages/daemon/src/component-runtime.ts` (remplace la lecture du descripteur 3 et le canal IPC) :
```ts
import type { FileSink } from "bun";
import { restrictGlobals } from "@kibo/devkit";
import { BackendCode, type BackendToDaemon, DaemonToBackend, KiboError } from "@kibo/schema";
import { BACKEND_MESSAGE_LIMIT, readLines } from "./components/line-channel";
import { createRuntime } from "./components/runtime-core";

const INPUT_FD = 3;
const OUTPUT_FD = 4;

function lineWriter(sink: FileSink): (m: BackendToDaemon) => void {
  const encoder = new TextEncoder();
  const tooLarge = (what: string) => `${what} larger than ${BACKEND_MESSAGE_LIMIT} bytes`;
  const send = (m: BackendToDaemon): void => {
    const line = JSON.stringify(m);
    if (encoder.encode(line).byteLength <= BACKEND_MESSAGE_LIMIT) {
      sink.write(`${line}\n`);
      sink.flush();
      return;
    }
    if (m.type !== "result") throw new KiboError("TOO_LARGE", tooLarge(m.type));
    send({ type: "result", id: m.id, ok: false, error: { code: "TOO_LARGE", message: tooLarge("result") } });
  };
  return send;
}

export async function startComponentRuntime(): Promise<void> {
  const input = Bun.file(INPUT_FD).stream();
  const send = lineWriter(Bun.file(OUTPUT_FD).writer());
  restrictGlobals({ freeze: true });
  let runtime: { handle(m: DaemonToBackend): void } | null = null;
  await readLines(input, Number.POSITIVE_INFINITY, {
    line(text) {
      const raw: unknown = JSON.parse(text);
      if (!runtime) {
        runtime = createRuntime(send, BackendCode.parse(raw));
        return;
      }
      const parsed = DaemonToBackend.safeParse(raw);
      if (!parsed.success) return console.error(`[kibo-runtime] invalid message: ${parsed.error.message}`);
      runtime.handle(parsed.data);
    },
    overflow: () => undefined,
  });
  process.exit(0);
}

if (import.meta.main) await startComponentRuntime();
```
Le flux du descripteur 3 et l'écrivain du descripteur 4 sont créés **avant** `restrictGlobals` (qui retire `Bun.file`) ; la lecture et l'écriture continuent ensuite sur ces objets. Le démon est de confiance : pas de plafond en entrée du runtime.

`packages/daemon/src/components/process-host.ts` :
- `spawnRuntime` : `stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"]`, retirer `serialization` et `ipc` ; supprimer `writeCode` ;
- ajouter :
```ts
function closeQuietly(fd: number, log: (line: string) => void): void {
  try {
    closeSync(fd);
  } catch (e) {
    log(`cannot close descriptor ${fd}: ${String(e)}`);
  }
}

function parseLine(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
```
- la fabrique de canal devient :
```ts
  const open = async (handlers: ChannelHandlers): Promise<Channel> => {
    const proc = spawnRuntime(opts, handlers, log);
    const close = () => killGroup(proc.pid, log);
    pipeLog(proc.stderr, log).catch((e: unknown) => log(`stderr closed: ${String(e)}`));
    const input = proc.stdio[3];
    const output = proc.stdio[4];
    if (typeof input !== "number" || typeof output !== "number") {
      close();
      throw new KiboError("COMPONENT_CRASHED", "the runtime pipes are missing");
    }
    const reading = readLines(Bun.file(output).stream(), BACKEND_MESSAGE_LIMIT, {
      line: (text) => {
        const parsed = parseLine(text);
        if (parsed.ok) handlers.message(parsed.value);
        else handlers.exit("invalid JSON from the runtime");
      },
      overflow: () => handlers.exit(`message larger than ${BACKEND_MESSAGE_LIMIT} bytes`),
    }).catch((e: unknown) => log(`runtime output closed: ${String(e)}`));
    Promise.all([proc.exited, reading]).then(() => {
      closeQuietly(input, log);
      closeQuietly(output, log);
    });
    const sink = Bun.file(input).writer();
    const write = (m: unknown) => {
      sink.write(`${JSON.stringify(m)}\n`);
      sink.flush();
    };
    write(opts.code);
    return { send: write, close };
  };
```
Un JSON illisible ou une ligne trop longue passent par `handlers.exit` : même chemin qu'un crash (arrêt du groupe, attente croissante, invocations rejetées en `COMPONENT_CRASHED`), conformément à la décision 25 (b). L'échec de `parseLine` n'est pas avalé : il devient cette violation. Vérifier qu'une écriture sur le tube d'un runtime déjà mort (`EPIPE`) ne produit ni exception non gérée ni rejet orphelin (test `crash` existant, puis `ping` sur le runtime redémarré) ; sinon, protéger `write` et journaliser.

Run: `bun test packages/daemon/src/components`
Expected: PASS, tests existants de la tâche 11 compris (sans modification).

- [x] **Step 6: CI Linux**

`.github/workflows/ci.yml`, jobs `test` et `e2e`, juste après `oven-sh/setup-bun` :
```yaml
      - if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y bubblewrap && sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```
Ubuntu 24.04 interdit par défaut les espaces de noms utilisateur non privilégiés (AppArmor) : sans le `sysctl`, `bwrap` échoue et la sonde lève `SANDBOX_UNAVAILABLE`. macOS : `sandbox-exec` est présent sur les runners, rien à installer.

- [x] **Step 7: Vérifier et committer**

Run: `bun test packages/devkit packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS (sur macOS en local ; Linux vérifié par la CI de la branche).

```bash
git add packages/schema/src/errors.ts packages/devkit/src/os-sandbox.ts packages/devkit/src/os-sandbox.test.ts packages/devkit/src/index.ts packages/daemon/src/components/process-host.ts packages/daemon/src/components/process-host-sandbox.test.ts packages/daemon/src/components/line-channel.ts packages/daemon/src/components/line-channel.test.ts packages/daemon/src/components/runtime-core.ts packages/daemon/src/component-runtime.ts .github/workflows/ci.yml docs/superpowers/specs/2026-09-26-kibo-composants.md docs/superpowers/specs/2026-09-26-kibo-marketplace.md
git commit -m "feat(daemon): bac à sable OS des backends"
```

---

### Task 12: SDK simulé v1, suite de conformité v1 et jeu fictif

**Files:**
- Create: `packages/sdk/src/fixtures.ts`, `packages/sdk/src/fixtures.test.ts`, `packages/sdk/src/mock-v1.test.ts`
- Modify: `packages/sdk/src/mock.ts`, `packages/sdk/src/conformance.tsx`, `packages/sdk/package.json` (dépendance `@kibo/core` déjà présente ; rien à ajouter si `@kibo/core/notes` est résolu)

**Interfaces:**
- Consumes: `createSdk`, `KiboSdk`, `ServerDefinition`, `ServerContext` (tâche 7) ; `parseNote` (`@kibo/core/notes`, tâche 9) ; `ComponentManifest`, `ComponentManifestInput`, `permissionOfCall`, `permissionList`, `grantedOf`, `diffPermissions`, `USED_MARKER` (tâche 2).
- Produces:
  - `createMockSdk(manifest: ComponentManifest | ComponentManifestInput, opts?: MockSdkOptions): MockSdk`.
  - `type MockSdkOptions = { seed?; viewer?; config?; surface?: Surface; fetch?: MockFetch; server?: ServerDefinition; notes?: Record<string, string>; noteAges?: Record<string, number> }` ; `type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>`.
  - `type MockSdk = { sdk; violations: string[]; used: string[]; opened: string[]; newTicketRequests; openedFiles: FileTarget[]; openedViews: string[]; data: Map<string, unknown>; notes: Map<string, { markdown: string; mtime: number }>; run(cmd); snapshot(); touchNote(path, markdown): void }`.
  - `runConformance(mod: { manifest: unknown; Component: ComponentType }, seed?, opts?: ConformanceOptions)` : manifeste valide ; pour chaque surface (`widget`, `view` selon `kind`) × thème (`dark`, `light`) × projet (vide, peuplé) : rendu non vide, `violations` vide, `used ⊆ declared` ; imprime `USED_MARKER + JSON(used)` sur la sortie standard.
  - `@kibo/sdk/fixtures` : `seedDemo(run, viewer = "adam"): Record<string, string>` (clé → id, tickets et liens de `design/donnees-fictives.md`) ; `DEMO_NOTES: Record<string, string>` ; `DEMO_NOTE_AGES: Record<string, number>` (âge en jours).

- [x] **Step 1: Écrire les tests**

`packages/sdk/src/mock-v1.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createMockSdk } from "./mock";
import { defineServer } from "./server";

const base = { id: "probe", version: "0.1.0", kind: "widget" as const, title: "Probe" };

test("every attempt is recorded in used, denials also in violations", async () => {
  const m = createMockSdk({ ...base, reads: ["ticket"], writes: [] });
  await m.sdk.list("ticket");
  await expect(m.sdk.data.set("k", 1)).rejects.toThrow("PERMISSION_DENIED");
  await expect(m.sdk.fetch("https://example.com/x")).rejects.toThrow("PERMISSION_DENIED");
  expect(m.used).toEqual(["read:ticket", "data", "net:https://example.com/x"]);
  expect(m.violations).toEqual(["data", "net https://example.com/x"]);
});

test("data, programmed fetch and actions work in memory", async () => {
  const m = createMockSdk(
    { ...base, reads: ["ticket"], writes: [], data: true, net: ["api.github.com"] },
    {
      fetch: (url) => ({ status: 200, headers: {}, body: url }),
      server: defineServer({ actions: { count: async (ctx) => (await ctx.list("ticket")).length } }),
      seed: (run) => run({ method: "createTicket", title: "A" }),
    },
  );
  await m.sdk.data.set("k", { a: 1 });
  expect(await m.sdk.data.get("k")).toEqual({ a: 1 });
  expect(await m.sdk.data.keys()).toEqual(["k"]);
  expect((await m.sdk.fetch("https://api.github.com/x")).body).toBe("https://api.github.com/x");
  expect(await m.sdk.action("count")).toBe(1);
  await expect(m.sdk.action("nope")).rejects.toThrow("PERMISSION_DENIED");
});

test("notes live in an in-memory folder with conflict detection", async () => {
  const m = createMockSdk(
    { ...base, reads: ["note", "ticket"], writes: ["note"] },
    { notes: { "a.md": "# A\n\nVoir [[b]] et KIB-1.", "b.md": "# B" } },
  );
  const list = await m.sdk.list("note");
  expect(list.map((n) => [n.path, n.title, n.links, n.tickets])).toEqual([
    ["a.md", "A", ["b.md"], ["KIB-1"]],
    ["b.md", "B", [], []],
  ]);
  const a = await m.sdk.notes.read("a.md");
  m.touchNote("a.md", "# A modifiée");
  await expect(m.sdk.notes.write("a.md", "# A2", a.mtime)).rejects.toThrow("CONFLICT");
  await m.sdk.notes.write("a.md", "# A2", null);
  expect((await m.sdk.notes.search("a2")).map((n) => n.path)).toEqual(["a.md"]);
  expect((await m.sdk.notes.info()).displayDir).toBe("~/goinfre/Kibo/notes");
});
```

`packages/sdk/src/fixtures.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createMockSdk } from "./mock";
import { DEMO_NOTES, seedDemo } from "./fixtures";

test("the demo data matches design/donnees-fictives.md", async () => {
  const m = createMockSdk({ id: "probe", version: "0.1.0", kind: "view", title: "Probe", reads: ["ticket", "link", "note"], writes: [] }, {
    seed: (run) => seedDemo(run),
    notes: DEMO_NOTES,
  });
  const tickets = await m.sdk.list("ticket");
  const byKey = Object.fromEntries(tickets.map((t) => [t.key, t]));
  expect(tickets).toHaveLength(22);
  expect(byKey["KIB-21"]?.statusId).toBe("blocked");
  expect(byKey["KIB-21"]?.blockedReason).toBe("Audit sécurité externe en attente");
  expect(byKey["KIB-12"]?.assignee).toEqual({ kind: "agent", ref: "opus-dev-1" });
  expect(byKey["KIB-15"]?.waitingOn).toEqual(["KIB-12"]);
  expect((await m.sdk.list("link")).filter((l) => l.type === "blocks")).toHaveLength(6);
  const notes = await m.sdk.list("note");
  const decisions = notes.find((n) => n.title === "Décisions d'architecture");
  expect(decisions?.tickets).toEqual(["KIB-12", "KIB-13", "KIB-14"]);
  expect(notes.filter((n) => n.links.includes(decisions?.path ?? "")).map((n) => n.links.length)).toEqual([1, 2]);
});
```

Run: `bun test packages/sdk/src/mock-v1.test.ts packages/sdk/src/fixtures.test.ts`
Expected: FAIL.

- [x] **Step 2: Réécrire `mock.ts`**

```ts
import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import { parseNote } from "@kibo/core/notes";
import {
  type ComponentCall,
  ComponentManifest,
  type ComponentManifestInput,
  type EntityType,
  type FetchInit,
  type FetchResponse,
  KiboError,
  type NoteContent,
  type NoteMeta,
  permissionOfCall,
  type ProjectCommand,
  type ProjectSnapshot,
  type Surface,
} from "@kibo/schema";
import { createSdk } from "./sdk";
import type { ServerContext, ServerDefinition } from "./server";
import type { EntityMap, FileTarget, KiboSdk, NewTicketDefaults } from "./types";

export type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>;
export type MockNote = { markdown: string; mtime: number };
export type MockSdk = {
  sdk: KiboSdk;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  data: Map<string, unknown>;
  notes: Map<string, MockNote>;
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  touchNote(path: string, markdown: string): void;
};
export type MockSdkOptions = {
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  fetch?: MockFetch;
  server?: ServerDefinition;
  notes?: Record<string, string>;
  noteAges?: Record<string, number>;
};

const DAY = 86_400_000;

export function createMockSdk(manifestInput: ComponentManifest | ComponentManifestInput, opts: MockSdkOptions = {}): MockSdk {
  const manifest = ComponentManifest.parse(manifestInput);
  const doc = createProjectDoc({ id: "mock", key: "KIB", name: "Mock", folder: null, color: "#71717A" });
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  const run = (cmd: ProjectCommand) => {
    const result = executeProjectCommand(doc, cmd);
    emit();
    return result;
  };
  opts.seed?.(run);
  let clock = Date.now();
  const tick = () => {
    clock += 1;
    return clock;
  };
  const notes = new Map<string, MockNote>(
    Object.entries(opts.notes ?? {}).map(([path, markdown]) => [
      path,
      { markdown, mtime: Date.now() - (opts.noteAges?.[path] ?? 0) * DAY },
    ]),
  );
  const data = new Map<string, unknown>();
  const violations: string[] = [];
  const used: string[] = [];
  const opened: string[] = [];
  const newTicketRequests: NewTicketDefaults[] = [];
  const openedFiles: FileTarget[] = [];
  const openedViews: string[] = [];

  const metaOf = (path: string): NoteMeta => {
    const note = notes.get(path);
    if (!note) throw new KiboError("NOT_FOUND", `note ${path} not found`);
    const parsed = parseNote(path, note.markdown, "KIB", [...notes.keys()]);
    return { path, ...parsed, mtime: note.mtime, size: new TextEncoder().encode(note.markdown).byteLength };
  };
  const allNotes = () => [...notes.keys()].sort().map(metaOf);

  const handle = async (c: ComponentCall): Promise<unknown> => {
    switch (c.kind) {
      case "list":
        return c.entity === "note" ? allNotes() : null;
      case "run":
        return run(c.command);
      case "data.get":
        return data.get(c.key);
      case "data.set":
        data.set(c.key, structuredClone(c.value));
        return null;
      case "data.delete":
        data.delete(c.key);
        return null;
      case "data.keys":
        return [...data.keys()];
      case "fetch": {
        if (!opts.fetch) throw new KiboError("NOT_FOUND", `no response programmed for ${c.url}`);
        return opts.fetch(c.url, c.init);
      }
      case "action": {
        const action = opts.server?.actions?.[c.name];
        if (!action) throw new KiboError("PERMISSION_DENIED", `unknown action ${c.name}`);
        const ctx: ServerContext = { instanceId: sdk.instanceId, config: sdk.config, list: sdk.list, run: sdk.run, data: sdk.data, fetch: sdk.fetch };
        return action(ctx, c.input);
      }
      case "notes.read": {
        const note = notes.get(c.path);
        if (!note) throw new KiboError("NOT_FOUND", `note ${c.path} not found`);
        const content: NoteContent = { ...metaOf(c.path), markdown: note.markdown };
        return content;
      }
      case "notes.write": {
        const current = notes.get(c.path);
        if (c.expectedMtime !== null && current?.mtime !== c.expectedMtime) throw new KiboError("CONFLICT", `${c.path} changed`);
        notes.set(c.path, { markdown: c.markdown, mtime: tick() });
        emit();
        return metaOf(c.path);
      }
      case "notes.rename": {
        const note = notes.get(c.from);
        if (!note) throw new KiboError("NOT_FOUND", `note ${c.from} not found`);
        if (notes.has(c.to)) throw new KiboError("CONFLICT", `${c.to} exists`);
        notes.delete(c.from);
        notes.set(c.to, { ...note, mtime: tick() });
        emit();
        return metaOf(c.to);
      }
      case "notes.remove":
        notes.delete(c.path);
        emit();
        return null;
      case "notes.search": {
        const q = c.query.toLowerCase();
        return allNotes().filter((n) => `${n.title}\n${notes.get(n.path)?.markdown ?? ""}`.toLowerCase().includes(q));
      }
      case "notes.info":
        return { dir: "/Users/adam/goinfre/Kibo/notes", displayDir: "~/goinfre/Kibo/notes", obsidian: true, folderRelative: "notes" };
    }
  };

  const inner = createSdk(
    {
      snapshot: async () => readProject(doc),
      run: async (cmd) => run(cmd),
      call: handle,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    manifest,
    {
      instanceId: "mock-instance",
      config: opts.config ?? {},
      viewer: opts.viewer ?? "adam",
      surface: opts.surface ?? (manifest.kind === "view" ? "view" : "widget"),
      openTicket: (id) => opened.push(id),
      openNewTicket: (d) => newTicketRequests.push(d),
      openFile: (target) => openedFiles.push(target),
      openView: (componentId) => openedViews.push(componentId),
    },
  );

  const record = async <T>(permission: string | null, label: string, work: () => Promise<T>): Promise<T> => {
    if (permission !== null && !used.includes(permission)) used.push(permission);
    try {
      return await work();
    } catch (e) {
      if (e instanceof KiboError && e.code === "PERMISSION_DENIED") violations.push(label);
      throw e;
    }
  };

  const sdk: KiboSdk = {
    ...inner,
    list: <T extends EntityType>(type: T): Promise<EntityMap[T][]> => record(`read:${type}`, `read ${type}`, () => inner.list(type)),
    run: (cmd) => record(permissionOfCall({ kind: "run", command: cmd }), `write ${cmd.method}`, () => inner.run(cmd)),
    data: {
      get: (key) => record("data", "data", () => inner.data.get(key)),
      set: (key, value) => record("data", "data", () => inner.data.set(key, value)),
      delete: (key) => record("data", "data", () => inner.data.delete(key)),
      keys: () => record("data", "data", () => inner.data.keys()),
    },
    fetch: (url, init) => record(`net:${url}`, `net ${url}`, () => inner.fetch(url, init)),
    action: (name, input) => record(null, `action ${name}`, () => inner.action(name, input)),
    notes: {
      read: (p) => record("read:note", "read note", () => inner.notes.read(p)),
      search: (q) => record("read:note", "read note", () => inner.notes.search(q)),
      info: () => record("read:note", "read note", () => inner.notes.info()),
      write: (p, md, m) => record("write:note", "write note", () => inner.notes.write(p, md, m)),
      rename: (a, b) => record("write:note", "write note", () => inner.notes.rename(a, b)),
      remove: (p) => record("write:note", "write note", () => inner.notes.remove(p)),
    },
  };

  return {
    sdk,
    violations,
    used,
    opened,
    newTicketRequests,
    openedFiles,
    openedViews,
    data,
    notes,
    run,
    snapshot: () => readProject(doc),
    touchNote: (path, markdown) => {
      notes.set(path, { markdown, mtime: tick() + 1000 });
      emit();
    },
  };
}
```
Les libellés de `violations` gardent le format v0.1 (`read link`, `write addPage`) : le test existant de `sdk.test.ts` passe sans changement. `data.get` typé générique : `get: <T>(key: string) => record("data", "data", () => inner.data.get<T>(key))`.

- [x] **Step 3: Réécrire `conformance.tsx`**

```tsx
import { describe, expect, test } from "bun:test";
import {
  ComponentManifest,
  diffPermissions,
  grantedOf,
  permissionList,
  type ProjectCommand,
  type Surface,
  type Theme,
  USED_MARKER,
} from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMockSdk, type MockSdkOptions } from "./mock";
import { SdkProvider } from "./react";

export type ConformanceModule = { manifest: unknown; Component: ComponentType };
export type ConformanceOptions = Pick<MockSdkOptions, "fetch" | "server" | "notes" | "config" | "noteAges">;

const THEMES: Theme[] = ["dark", "light"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

export function runConformance(
  mod: ConformanceModule,
  seed?: (run: (cmd: ProjectCommand) => unknown) => void,
  opts: ConformanceOptions = {},
): void {
  const parsed = ComponentManifest.safeParse(mod.manifest);
  const id = parsed.success ? parsed.data.id : "invalid";
  describe(`conformance v1 · ${id}`, () => {
    test("manifest is valid", () => {
      expect(parsed.success).toBe(true);
    });
    if (!parsed.success) return;
    const manifest = parsed.data;
    const declared = permissionList(grantedOf(manifest));
    const surfaces: Surface[] = manifest.kind === "both" ? ["widget", "view"] : [manifest.kind];
    const projects = [
      ["empty project", undefined],
      ["seeded project", seed],
    ] as const;
    for (const surface of surfaces) {
      for (const theme of THEMES) {
        for (const [label, s] of projects) {
          test(`renders an ${label} as a ${surface} in ${theme} within its declared permissions`, async () => {
            document.documentElement.classList.toggle("dark", theme === "dark");
            const m = createMockSdk(manifest, { ...opts, surface, ...(s && { seed: s }) });
            const { container } = render(
              <SdkProvider sdk={m.sdk}>
                <mod.Component />
              </SdkProvider>,
            );
            await waitFor(() => expect(container.childElementCount).toBeGreaterThan(0));
            await settle();
            console.log(`${USED_MARKER}${JSON.stringify(m.used)}`);
            expect(m.violations).toEqual([]);
            expect(diffPermissions(declared, m.used).missing).toEqual([]);
            cleanup();
          });
        }
      }
    }
  });
}
```

- [x] **Step 4: Écrire `fixtures.ts`**

```ts
import type { Assignee, ProjectCommand, StatusId, Ticket } from "@kibo/schema";

type Row = [number, string, number | null, StatusId, string | null];

const ROWS: Row[] = [
  [3, "Noyau de données", null, "in_progress", null],
  [4, "Orchestration des agents", null, "in_progress", null],
  [5, "Monorepo Bun workspaces", null, "done", "adam"],
  [6, "UI de base", null, "in_progress", null],
  [7, "Tokens shadcn + thème sombre", 6, "in_review", "adam"],
  [9, "Setup Tauri + sidecar Bun", null, "todo", "adam"],
  [10, "Watcher git et gh", null, "in_progress", "agent:opus-dev"],
  [11, "Démon : auth par jeton local", null, "in_review", "adam"],
  [12, "Schéma Loro des tickets (LoroTree)", 3, "in_progress", "agent:opus-dev-1"],
  [13, "Snapshots Loro ↔ SQLite", 3, "done", "adam"],
  [14, "Récepteur de hooks Claude Code", 4, "in_progress", "agent:opus-dev-2"],
  [15, "Kanban : drag & drop entre colonnes", 6, "todo", "adam"],
  [16, "Moteur de règles déclaratif", 4, "in_progress", "agent:opus-dev-3"],
  [18, "Adaptateur GitHub Issues", null, "todo", "agent:opus-dev"],
  [21, "Sandbox iframe des composants", null, "blocked", "adam"],
  [22, "Export Markdown / Obsidian", null, "backlog", "adam"],
  [24, "Types Zod Ticket / Link / Status", 12, "done", "agent:opus-dev-1"],
  [25, "Opérations move / reparent", 12, "done", "agent:opus-dev-1"],
  [26, "Index SQLite dérivé", 12, "done", "agent:opus-dev-1"],
  [27, "Tests de convergence (fast-check)", 12, "in_progress", "agent:opus-dev-1"],
  [28, "Générateur d'opérations concurrentes", 27, "in_progress", "agent:haiku-tests"],
  [29, "Migration v0 → v1", 12, "todo", "agent:opus-dev"],
];

const BLOCKS: [number, number][] = [
  [5, 12],
  [13, 12],
  [12, 15],
  [11, 21],
  [21, 22],
  [16, 22],
];

const assignee = (ref: string | null, viewer: string): Assignee | null => {
  if (ref === null) return null;
  if (ref.startsWith("agent:")) return { kind: "agent", ref: ref.slice("agent:".length) };
  return { kind: "human", ref: ref === "adam" ? viewer : ref };
};

export function seedDemo(run: (cmd: ProjectCommand) => unknown, viewer = "adam"): Record<string, string> {
  const ids: Record<string, string> = {};
  const fillers: string[] = [];
  for (let n = 1; n <= 29; n += 1) {
    const row = ROWS.find((r) => r[0] === n);
    const parentKey = row?.[2] ? `KIB-${row[2]}` : null;
    const ticket = run({
      method: "createTicket",
      title: row?.[1] ?? "—",
      parentId: parentKey ? (ids[parentKey] ?? null) : null,
      assignee: assignee(row?.[4] ?? null, viewer),
    }) as Ticket;
    ids[ticket.key] = ticket.id;
    if (!row) fillers.push(ticket.id);
    else if (row[3] === "blocked") {
      run({ method: "setStatus", ticketId: ticket.id, statusId: "blocked", reason: "Audit sécurité externe en attente" });
    } else if (row[3] !== "todo") run({ method: "setStatus", ticketId: ticket.id, statusId: row[3] });
  }
  for (const id of fillers) run({ method: "deleteTicket", ticketId: id });
  for (const [from, to] of BLOCKS) {
    run({ method: "addLink", from: ids[`KIB-${from}`] ?? "", to: ids[`KIB-${to}`] ?? "", type: "blocks" });
  }
  run({ method: "addLink", from: ids["KIB-12"] ?? "", to: ids["KIB-16"] ?? "", type: "relates" });
  return ids;
}

export const DEMO_NOTES: Record<string, string> = {
  "decisions-architecture.md": `# Décisions d'architecture

## Stockage

On garde Loro comme CRDT : c'est le seul à gérer nativement le déplacement dans un arbre, indispensable pour les sous-tickets en profondeur illimitée.

Voir KIB-12 et KIB-13.

## Agents

- L'état vient uniquement des hooks Claude Code (KIB-14)
- Un jeton par run pour le récepteur
- Réponse à un agent = --resume sessionId

\`\`\`sh
claude -p --settings .kibo/run-42/settings.json \\
  --append-system-prompt-file brief.md
\`\`\`
`,
  "journal-agents.md": "# Journal agents\n\nRelire [[decisions-architecture]] avant de brancher le récepteur.\n",
  "idees-composants.md": "# Idées composants\n\n- Burndown, voir [[decisions-architecture]]\n- Graphe, voir [[decisions-architecture]]\n",
  "reunion-kick-off.md": "# Réunion kick-off\n\nPremière réunion de cadrage.\n",
};

export const DEMO_NOTE_AGES: Record<string, number> = {
  "decisions-architecture.md": 0,
  "journal-agents.md": 1,
  "idees-composants.md": 4,
  "reunion-kick-off.md": 8,
};
```
Le cast `as Ticket` est la frontière du bus de commandes (`run` renvoie `unknown`), comme dans les tests existants. Les tickets non listés dans le jeu (KIB-1, 2, 8, 17, 19, 20, 23) sont créés puis supprimés pour que les clés correspondent au document.

- [ ] **Step 5: Vérifier que les intégrés passent la conformité v1 sans changement**

Run: `bun test packages/sdk components && bun run typecheck && bun run check`
Expected: PASS, y compris `components/kanban` et `components/tickets` (critère de sortie §13 : aucune modification de leur code métier).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src
git commit -m "feat(sdk): SDK simulé et conformité v1"
```

---

### Task 13: Runtime de l'iframe sandboxée (`@kibo/sdk/sandbox`)

**Files:**
- Create (ou remplace le fichier minimal de la tâche 6): `packages/sdk/src/sandbox.tsx`, `packages/sdk/src/sandbox.test.tsx`

**Interfaces:**
- Consumes: `createSdk`, `SdkProvider` (tâche 7) ; `HostToFrame`, `FrameToHost`, `InitMessage`, `KeyCombo`, `ComponentManifest`, `isKiboErrorCode` (tâche 2).
- Produces:
  - `type FramePort = { post(msg: FrameToHost): void; listen(cb: (msg: HostToFrame) => void): () => void }` ; `windowPort(win?: Window): FramePort` (accepte seulement `event.source === win.parent`, valide par Zod, journalise et ignore le reste).
  - `createFrameSdk(manifest, init: InitMessage, port): { sdk: KiboSdk; dispose(): void }` (mode `gated`).
  - `comboOf(e: KeyboardEvent): KeyCombo | null`.
  - `mountSandboxed(manifest: unknown, Component: ComponentType, port?: FramePort): void` : envoie `ready`, attend `init`, applique le thème, monte le composant dans `#root`, relaie les raccourcis, signale la hauteur des widgets.

- [x] **Step 1: Écrire les tests**

`packages/sdk/src/sandbox.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import type { FrameToHost, HostToFrame } from "@kibo/schema";
import { screen, waitFor } from "@testing-library/react";
import { useEntities, useSdk } from "./react";
import { type FramePort, mountSandboxed, windowPort } from "./sandbox";

function fakePort() {
  const sent: FrameToHost[] = [];
  let listener: ((m: HostToFrame) => void) | null = null;
  const port: FramePort = {
    post: (m) => sent.push(m),
    listen: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
  };
  return { port, sent, deliver: (m: HostToFrame) => listener?.(m) };
}

const manifest = { id: "probe", version: "0.1.0", kind: "widget", title: "Probe", reads: ["ticket"], writes: [] };

function Probe() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <button type="button" onClick={() => sdk.openTicket("t1")}>
      {sdk.viewer} {tickets.data.length} {tickets.error?.code ?? ""}
    </button>
  );
}

test("the frame says ready, mounts on init and calls the host for data", async () => {
  const { port, sent, deliver } = fakePort();
  mountSandboxed(manifest, Probe, port);
  expect(sent[0]).toEqual({ kibo: 1, type: "ready" });
  deliver({ kibo: 1, type: "init", instanceId: "i1", config: {}, viewer: "adam", theme: "dark", surface: "widget" });
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await waitFor(() => expect(sent.some((m) => m.type === "call")).toBe(true));
  const call = sent.find((m) => m.type === "call");
  expect(call?.type === "call" && call.call).toEqual({ kind: "list", entity: "ticket" });
  deliver({ kibo: 1, type: "reply", id: call?.type === "call" ? call.id : 0, ok: true, result: [{ id: "a" }, { id: "b" }] });
  expect(await screen.findByText(/adam 2/)).toBeTruthy();
  screen.getByRole("button").click();
  expect(sent.at(-1)).toEqual({ kibo: 1, type: "openTicket", ticketId: "t1" });
  deliver({ kibo: 1, type: "theme", theme: "light" });
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("error replies become KiboErrors and changes trigger a reload", async () => {
  const { port, sent, deliver } = fakePort();
  mountSandboxed(manifest, Probe, port);
  deliver({ kibo: 1, type: "init", instanceId: "i1", config: {}, viewer: "adam", theme: "light", surface: "view" });
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(1));
  const first = sent.find((m) => m.type === "call");
  deliver({ kibo: 1, type: "reply", id: first?.type === "call" ? first.id : 0, ok: false, error: { code: "TRUST_REQUIRED", message: "x" } });
  expect(await screen.findByText(/TRUST_REQUIRED/)).toBeTruthy();
  deliver({ kibo: 1, type: "changed" });
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(2));
});

test("shortcuts are relayed to the host", () => {
  const { port, sent, deliver } = fakePort();
  mountSandboxed(manifest, Probe, port);
  deliver({ kibo: 1, type: "init", instanceId: "i1", config: {}, viewer: "adam", theme: "light", surface: "view" });
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "q", metaKey: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(sent.filter((m) => m.type === "key")).toEqual([
    { kibo: 1, type: "key", combo: "mod+k" },
    { kibo: 1, type: "key", combo: "escape" },
  ]);
});

test("the window port ignores other senders and invalid messages", () => {
  const seen: HostToFrame[] = [];
  const off = windowPort(window).listen((m) => seen.push(m));
  window.dispatchEvent(new MessageEvent("message", { data: { kibo: 1, type: "changed" }, source: null }));
  window.dispatchEvent(new MessageEvent("message", { data: { nope: true }, source: window.parent }));
  window.dispatchEvent(new MessageEvent("message", { data: { kibo: 1, type: "changed" }, source: window.parent }));
  off();
  expect(seen).toEqual([{ kibo: 1, type: "changed" }]);
});
```
Sous happy-dom, `window.parent === window` : le dernier message est accepté, le premier (`source: null`) refusé.

Run: `bun test packages/sdk/src/sandbox.test.tsx`
Expected: FAIL.

- [x] **Step 2: Implémenter `sandbox.tsx`**

```tsx
import {
  type ComponentCall,
  ComponentManifest,
  type FrameToHost,
  HostToFrame,
  type InitMessage,
  isKiboErrorCode,
  KeyCombo,
  KiboError,
  type Theme,
} from "@kibo/schema";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { SdkProvider } from "./react";
import { createSdk } from "./sdk";
import type { KiboSdk } from "./types";

export type FramePort = { post(msg: FrameToHost): void; listen(cb: (msg: HostToFrame) => void): () => void };

export function windowPort(win: Window = window): FramePort {
  return {
    post: (msg) => win.parent.postMessage(msg, "*"),
    listen: (cb) => {
      const on = (e: MessageEvent) => {
        if (e.source !== win.parent) return;
        const parsed = HostToFrame.safeParse(e.data);
        if (!parsed.success) {
          console.warn(`[kibo-sandbox] ignored message: ${parsed.error.message}`);
          return;
        }
        cb(parsed.data);
      };
      win.addEventListener("message", on);
      return () => win.removeEventListener("message", on);
    },
  };
}

export function createFrameSdk(
  manifest: ComponentManifest,
  init: InitMessage,
  port: FramePort,
): { sdk: KiboSdk; dispose(): void } {
  let seq = 0;
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: unknown): void }>();
  const listeners = new Set<() => void>();
  const off = port.listen((m) => {
    if (m.type === "changed") {
      for (const l of listeners) l();
      return;
    }
    if (m.type !== "reply") return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.result ?? null);
    else p.reject(new KiboError(isKiboErrorCode(m.error?.code) ? m.error.code : "INTERNAL", m.error?.message ?? ""));
  });
  const call = (c: ComponentCall) =>
    new Promise<unknown>((resolve, reject) => {
      seq += 1;
      pending.set(seq, { resolve, reject });
      port.post({ kibo: 1, type: "call", id: seq, call: c });
    });
  const unsupported = () => Promise.reject(new KiboError("INTERNAL", "a sandboxed component reads through componentCall"));
  const sdk = createSdk(
    {
      snapshot: unsupported,
      run: unsupported,
      call,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    manifest,
    {
      instanceId: init.instanceId,
      config: init.config,
      viewer: init.viewer,
      surface: init.surface,
      openTicket: (ticketId) => port.post({ kibo: 1, type: "openTicket", ticketId }),
      openNewTicket: (defaults) => port.post({ kibo: 1, type: "openNewTicket", defaults }),
      openFile: ({ path, line }) => port.post({ kibo: 1, type: "openFile", path, ...(line !== undefined && { line }) }),
      openView: (componentId) => port.post({ kibo: 1, type: "openView", componentId }),
    },
    "gated",
  );
  return {
    sdk,
    dispose: () => {
      off();
      for (const p of pending.values()) p.reject(new KiboError("INTERNAL", "frame disposed"));
      pending.clear();
    },
  };
}

export function comboOf(e: KeyboardEvent): KeyCombo | null {
  if (e.key === "Escape") return "escape";
  if (!(e.metaKey || e.ctrlKey)) return null;
  const parsed = KeyCombo.safeParse(`mod+${e.key.toLowerCase()}`);
  return parsed.success ? parsed.data : null;
}

const applyTheme = (theme: Theme) => document.documentElement.classList.toggle("dark", theme === "dark");

export function mountSandboxed(manifestInput: unknown, Component: ComponentType, port: FramePort = windowPort()): void {
  const manifest = ComponentManifest.parse(manifestInput);
  let mounted = false;
  port.listen((m) => {
    if (m.type === "theme") applyTheme(m.theme);
    if (m.type !== "init" || mounted) return;
    mounted = true;
    applyTheme(m.theme);
    document.body.classList.add(m.surface === "widget" ? "bg-card" : "bg-background", "text-foreground");
    const existing = document.getElementById("root");
    const root = existing ?? document.body.appendChild(document.createElement("div"));
    root.id = "root";
    const { sdk } = createFrameSdk(manifest, m, port);
    createRoot(root).render(
      <SdkProvider sdk={sdk}>
        <Component />
      </SdkProvider>,
    );
    document.addEventListener("keydown", (e) => {
      const combo = comboOf(e);
      if (!combo) return;
      if (combo !== "escape") e.preventDefault();
      port.post({ kibo: 1, type: "key", combo });
    });
    if (m.surface === "widget") {
      new ResizeObserver(() =>
        port.post({ kibo: 1, type: "resize", height: Math.min(10_000, Math.ceil(document.documentElement.scrollHeight)) }),
      ).observe(document.body);
    }
  });
  port.post({ kibo: 1, type: "ready" });
}
```

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/sdk && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/sdk/src/sandbox.tsx packages/sdk/src/sandbox.test.tsx
git commit -m "feat(sdk): runtime de l'iframe sandboxée"
```

---

### Task 14: Magasin immuable des composants

**Files:**
- Create: `packages/daemon/src/components/store.ts`, `packages/daemon/src/components/store.test.ts`

**Interfaces:**
- Consumes: `readSources`, `hashFiles`, `buildComponent`, `BuildFile`, `BuildOutput`, `Toolchain` (tâches 1, 4, 6) ; `copyFixture` (`@kibo/devkit/test-kit`) ; `ComponentManifest`, `BackendCode`, `KiboError` (tâche 2).
- Produces:
  - `type StoredVersion = { id: string; version: string; hash: string; manifest: ComponentManifest; build: Partial<Record<BuildFile, Uint8Array>> }`.
  - `type ComponentStore = { root: string; put(srcDir: string, expectedHash?: string): Promise<StoredVersion>; load(id, version, hash): Promise<StoredVersion>; verify(id, version, hash): Promise<boolean>; get(id, version): StoredVersion | undefined; remove(id, version): Promise<void> }`.
  - `createComponentStore(deps: { home: string; toolchain: Toolchain; build?: (srcDir: string, t: Toolchain) => Promise<BuildOutput>; kiboVersion?: string; now?: () => number }): ComponentStore`.
  - `backendCodeOf(v: StoredVersion): BackendCode`.
  - Disposition : `<home>/components/store/<id>/<version>/<hash>/{source/…, build/…, build.json, tsconfig.json}`, dossiers `0700`, fichiers `0400`.

- [x] **Step 1: Écrire les tests**

`packages/daemon/src/components/store.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildOutput } from "@kibo/devkit";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { ComponentManifest } from "@kibo/schema";
import { backendCodeOf, createComponentStore } from "./store";

const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups) c();
});

function setup(real = false) {
  const home = mkdtempSync(join(tmpdir(), "kibo-store-"));
  const fixture = copyFixture("hello");
  cleanups.push(() => rmSync(home, { recursive: true, force: true }), fixture.dispose);
  const fakeBuild = async (): Promise<BuildOutput> => ({
    manifest: ComponentManifest.parse({ id: "hello", version: "0.1.0", kind: "both", title: "Hello", reads: [], writes: [] }),
    files: {
      "ui.sandbox.js": new TextEncoder().encode("sandbox"),
      "ui.trusted.js": new TextEncoder().encode("trusted"),
      "ui.css": new TextEncoder().encode(".x{}"),
      "server.js": new TextEncoder().encode("module.exports.server={}"),
    },
  });
  const store = createComponentStore({ home, toolchain: DEV_TOOLCHAIN, ...(real ? {} : { build: fakeBuild }) });
  return { home, src: fixture.dir, store };
}

describe("component store", () => {
  test("put copies the hashed sources, builds and locks the files", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    expect(v.manifest.id).toBe("hello");
    const dir = join(store.root, "hello", "0.1.0", v.hash);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, "source", "ui.tsx")).mode & 0o777).toBe(0o400);
    expect(statSync(join(dir, "build", "ui.sandbox.js")).mode & 0o777).toBe(0o400);
    expect(() => statSync(join(dir, "source", "component.test.tsx"))).toThrow();
    expect(backendCodeOf(v)).toEqual({ server: "module.exports.server={}", migrations: null });
    expect((await store.put(src)).hash).toBe(v.hash);
    expect(store.get("hello", "0.1.0")?.hash).toBe(v.hash);
  });
  test("a tampered source or build file fails verification", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    const dir = join(store.root, "hello", "0.1.0", v.hash);
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(true);
    const file = join(dir, "build", "ui.sandbox.js");
    chmodSync(file, 0o600);
    writeFileSync(file, "evil");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    await expect(store.load("hello", "0.1.0", v.hash)).rejects.toThrow("TRUST_REQUIRED");
  });
  test("tampered sources are detected too, and a wrong expected hash is refused", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    const file = join(store.root, "hello", "0.1.0", v.hash, "source", "ui.tsx");
    chmodSync(file, 0o600);
    writeFileSync(file, "export const Component = () => null;");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    await expect(store.put(src, "f".repeat(64))).rejects.toThrow("HASH_MISMATCH");
  });
  test("a missing version is not verified and remove deletes it", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    await store.remove("hello", "0.1.0");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    expect(store.get("hello", "0.1.0")).toBeUndefined();
  });
  test("the real build runs from the stored copy", async () => {
    const { src, store } = setup(true);
    const v = await store.put(src);
    expect(new TextDecoder().decode(v.build["ui.css"])).toContain(".bg-emerald-500");
  }, 60_000);
});
```

Run: `bun test packages/daemon/src/components/store.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `store.ts`**

```ts
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type BuildFile, type BuildOutput, buildComponent, readSources, type Toolchain } from "@kibo/devkit";
import { type BackendCode, ComponentManifest, KiboError } from "@kibo/schema";

export type StoredVersion = {
  id: string;
  version: string;
  hash: string;
  manifest: ComponentManifest;
  build: Partial<Record<BuildFile, Uint8Array>>;
};
export type ComponentStore = {
  root: string;
  put(srcDir: string, expectedHash?: string): Promise<StoredVersion>;
  load(id: string, version: string, hash: string): Promise<StoredVersion>;
  verify(id: string, version: string, hash: string): Promise<boolean>;
  get(id: string, version: string): StoredVersion | undefined;
  remove(id: string, version: string): Promise<void>;
};
export type StoreDeps = {
  home: string;
  toolchain: Toolchain;
  build?: (srcDir: string, t: Toolchain) => Promise<BuildOutput>;
  kiboVersion?: string;
  now?: () => number;
};

const BUILD_FILES: BuildFile[] = ["ui.sandbox.js", "ui.trusted.js", "ui.css", "server.js", "migrations.js"];
const TSCONFIG = JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", target: "ES2022" } });
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const text = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : null);

export const backendCodeOf = (v: StoredVersion): BackendCode => ({
  server: text(v.build["server.js"]),
  migrations: text(v.build["migrations.js"]),
});

async function writeLocked(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { mode: 0o400 });
}

export function createComponentStore(deps: StoreDeps): ComponentStore {
  const root = join(deps.home, "components", "store");
  const build = deps.build ?? buildComponent;
  const cache = new Map<string, StoredVersion>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const dirOf = (id: string, version: string, hash: string) => join(root, id, version, hash);

  const load = async (id: string, version: string, hash: string): Promise<StoredVersion> => {
    const dir = dirOf(id, version, hash);
    if (!existsSync(join(dir, "build.json"))) throw new KiboError("TRUST_REQUIRED", `${id}@${version} is not in the store`);
    const sources = await readSources(join(dir, "source"));
    if (sources.hash !== hash) throw new KiboError("TRUST_REQUIRED", `${id}@${version} sources changed on disk`);
    const meta = JSON.parse(await readFile(join(dir, "build.json"), "utf8")) as { files: Record<string, string> };
    const files: StoredVersion["build"] = {};
    for (const name of BUILD_FILES) {
      const expected = meta.files[name];
      if (expected === undefined) continue;
      const bytes = new Uint8Array(await readFile(join(dir, "build", name)));
      if (sha256(bytes) !== expected) throw new KiboError("TRUST_REQUIRED", `${id}@${version} build ${name} changed on disk`);
      files[name] = bytes;
    }
    const manifestFile = sources.files.find((f) => f.path === "kibo.component.json");
    const manifest = ComponentManifest.parse(JSON.parse(text(manifestFile?.bytes) ?? "{}"));
    const stored = { id, version, hash, manifest, build: files };
    cache.set(key(id, version), stored);
    return stored;
  };

  return {
    root,
    async put(srcDir, expectedHash) {
      const sources = await readSources(srcDir);
      if (expectedHash !== undefined && sources.hash !== expectedHash) {
        throw new KiboError("HASH_MISMATCH", "sources changed since the preview");
      }
      const manifestFile = sources.files.find((f) => f.path === "kibo.component.json");
      const parsed = ComponentManifest.safeParse(JSON.parse(text(manifestFile?.bytes) ?? "{}"));
      if (!parsed.success) throw new KiboError("VALIDATION_FAILED", parsed.error.message);
      const { id, version } = parsed.data;
      const final = dirOf(id, version, sources.hash);
      if (existsSync(join(final, "build.json"))) return load(id, version, sources.hash);
      const staging = join(root, `.staging-${crypto.randomUUID()}`);
      try {
        await mkdir(join(staging, "source"), { recursive: true, mode: 0o700 });
        for (const f of sources.files) await writeLocked(join(staging, "source", f.path), f.bytes);
        await writeFile(join(staging, "tsconfig.json"), TSCONFIG, { mode: 0o400 });
        const out = await build(join(staging, "source"), deps.toolchain);
        const shas: Record<string, string> = {};
        for (const [name, bytes] of Object.entries(out.files)) {
          await writeLocked(join(staging, "build", name), bytes);
          shas[name] = sha256(bytes);
        }
        const meta = { kiboVersion: deps.kiboVersion ?? "0.4.0", builtAt: (deps.now ?? Date.now)(), files: shas };
        await writeLocked(join(staging, "build.json"), JSON.stringify(meta));
        for (const d of [staging, join(staging, "source"), join(staging, "build")]) await chmod(d, 0o700);
        await mkdir(dirname(final), { recursive: true, mode: 0o700 });
        await rename(staging, final);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
      return load(id, version, sources.hash);
    },
    load,
    async verify(id, version, hash) {
      try {
        await load(id, version, hash);
        return true;
      } catch (e) {
        if (e instanceof KiboError && (e.code === "TRUST_REQUIRED" || e.code === "VALIDATION_FAILED")) {
          cache.delete(key(id, version));
          return false;
        }
        throw e;
      }
    },
    get: (id, version) => cache.get(key(id, version)),
    async remove(id, version) {
      cache.delete(key(id, version));
      await rm(join(root, id, version), { recursive: true, force: true });
    },
  };
}
```
`verify` ne transforme en `false` que les deux codes qui signifient « contenu absent ou modifié » ; toute autre erreur (disque plein, permission) est relancée. `readSources` sur un dossier source modifié (fichier ajouté, lien symbolique) lève `VALIDATION_FAILED`, traité comme une altération. Le `tsconfig.json` est posé **à côté** de `source/` (Bun le trouve en remontant) : `source/` reste la copie exacte des fichiers hachés.

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/daemon/src/components/store.test.ts && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/store.ts packages/daemon/src/components/store.test.ts
git commit -m "feat(daemon): magasin immuable des composants"
```

---

### Task 15: Porte `componentCall` (contrôles, quotas, journal des refus)

**Files:**
- Create: `packages/daemon/src/components/gate.ts`, `packages/daemon/src/components/quotas.ts`, `packages/daemon/src/components/events.ts`, `packages/daemon/src/components/gate.test.ts`, `packages/daemon/src/components/quotas.test.ts`

**Interfaces:**
- Consumes: `ComponentCall`, `Instance`, `GrantedPermissions`, `FetchInit`, `FetchResponse`, `isBuiltinId`, `isReservedCommand`, `permissionOfCall`, `permissionList`, `covers`, `splitRef`, `KiboError` (tâche 2).
- Produces:
  - `type ActiveVersion = { ref: string; trust: "trusted" | "sandboxed"; granted: GrantedPermissions }`.
  - `type GateHandlers = { list(projectId, entity): Promise<unknown>; run(projectId, command): Promise<unknown>; data(projectId, instanceId, call): Promise<unknown>; fetch(rules: readonly string[] | null, url, init): Promise<FetchResponse>; action(ref, projectId, instanceId, config, name, input): Promise<unknown>; notes(projectId, call): Promise<unknown> }`.
  - `type GateDeps = { instance(projectId, instanceId): Instance; active(ref): ActiveVersion; handlers: GateHandlers; quotas: Quotas; events: EventLog }` ; `createGate(deps): { call(projectId, instanceId, call: ComponentCall): Promise<unknown> }`.
  - `missingPermission(granted, call): string | null`.
  - `type Quotas = { take(instanceId: string, kind: "call" | "fetch"): boolean }` ; `createQuotas(opts?: { now?; callsPerSecond?: number; fetchPerMinute?: number }): Quotas` (défauts 200 / s et 20 / min).
  - `type ComponentEvent = { at; projectId; instanceId; ref; kind; code; count: number }` ; `ensureEventsTable(db)` ; `type EventLogLimits = { maxRows?: number; maxPerInstance?: number; burst?: number; windowMs?: number }` (défauts 10 000, 1 000, 10, 60 000) ; `createEventLog(db, now?, limits?): { record(e: Omit<ComponentEvent, "at" | "count">): void; list(limit?: number): ComponentEvent[]; flush(): void }` (append-only, aucune API de modification ; `list` et `flush` écrivent d'abord les synthèses en attente ; décision 26).

- [x] **Step 1: Écrire les tests**

`packages/daemon/src/components/quotas.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createQuotas } from "./quotas";

test("calls and fetches are limited per instance on sliding windows", () => {
  let now = 0;
  const q = createQuotas({ now: () => now, callsPerSecond: 3, fetchPerMinute: 2 });
  expect([q.take("a", "call"), q.take("a", "call"), q.take("a", "call"), q.take("a", "call")]).toEqual([true, true, true, false]);
  expect(q.take("b", "call")).toBe(true);
  now = 1001;
  expect(q.take("a", "call")).toBe(true);
  expect([q.take("a", "fetch"), q.take("a", "fetch"), q.take("a", "fetch")]).toEqual([true, true, false]);
  now = 61_002;
  expect(q.take("a", "fetch")).toBe(true);
});
```

`packages/daemon/src/components/gate.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { type ComponentCall, type GrantedPermissions, type Instance, KiboError } from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate, missingPermission } from "./gate";
import { createQuotas } from "./quotas";

const granted: GrantedPermissions = { reads: ["ticket"], writes: [], data: true, net: ["api.github.com/graphql"] };
const instances: Record<string, Instance> = {
  thirdparty: { id: "thirdparty", pageId: "pg", component: "evil@0.1.0", layout: { x: 0, y: 0, w: 6, h: 4 }, config: {} },
  builtin: { id: "builtin", pageId: "pg", component: "notes@1.0.0", layout: { x: 0, y: 0, w: 6, h: 4 }, config: {} },
  untrusted: { id: "untrusted", pageId: "pg", component: "pending@0.1.0", layout: { x: 0, y: 0, w: 6, h: 4 }, config: {} },
};

let handled: string[] = [];
let db: Database;
function gate(quotas = createQuotas()) {
  db = new Database(":memory:");
  ensureEventsTable(db);
  const events = createEventLog(db, () => 42);
  const handler = (name: string) => async () => {
    handled.push(name);
    return name;
  };
  return {
    events,
    gate: createGate({
      instance: (_p, id) => {
        const i = instances[id];
        if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
        return i;
      },
      active: (ref) => {
        if (ref === "evil@0.1.0") return { ref, trust: "sandboxed", granted };
        throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
      },
      handlers: {
        list: handler("list"),
        run: handler("run"),
        data: handler("data"),
        fetch: async (rules) => {
          handled.push(`fetch:${rules === null ? "any" : rules.join(",")}`);
          return { status: 200, headers: {}, body: "" };
        },
        action: handler("action"),
        notes: handler("notes"),
      },
      quotas,
      events,
    }),
  };
}

beforeEach(() => {
  handled = [];
});

const refused = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toThrow(code);
};

describe("componentCall checks, in order", () => {
  test("1. the instance must exist", async () => {
    const { gate: g, events } = gate();
    await refused(g.call("p1", "ghost", { kind: "list", entity: "ticket" }), "NOT_FOUND");
    expect(events.list().map((e) => e.code)).toEqual(["NOT_FOUND"]);
  });
  test("2. a third-party version must be approved", async () => {
    const { gate: g } = gate();
    await refused(g.call("p1", "untrusted", { kind: "list", entity: "ticket" }), "TRUST_REQUIRED");
    expect(handled).toEqual([]);
  });
  test("3. granted permissions decide, not the manifest on disk", async () => {
    const { gate: g, events } = gate();
    await g.call("p1", "thirdparty", { kind: "list", entity: "ticket" });
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "link" }), "PERMISSION_DENIED");
    await refused(g.call("p1", "thirdparty", { kind: "run", command: { method: "deleteTicket", ticketId: "t" } }), "PERMISSION_DENIED");
    await refused(g.call("p1", "thirdparty", { kind: "notes.read", path: "a.md" }), "PERMISSION_DENIED");
    await refused(g.call("p1", "thirdparty", { kind: "fetch", url: "https://example.com", init: { method: "GET", headers: {} } }), "PERMISSION_DENIED");
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await g.call("p1", "thirdparty", { kind: "fetch", url: "https://api.github.com/graphql", init: { method: "POST", headers: {} } });
    await g.call("p1", "thirdparty", { kind: "action", name: "ping", input: null });
    expect(handled).toEqual(["list", "data", "fetch:api.github.com/graphql", "action"]);
    expect(events.list()).toHaveLength(4);
    expect(events.list()[0]).toEqual({ at: 42, projectId: "p1", instanceId: "thirdparty", ref: "evil@0.1.0", kind: "list", code: "PERMISSION_DENIED" });
  });
  test("reserved commands are refused for everyone, built-ins included", async () => {
    const { gate: g } = gate();
    const reserved: ComponentCall = { kind: "run", command: { method: "setInstanceData", instanceId: "x", key: "k", value: 1 } };
    await refused(g.call("p1", "thirdparty", reserved), "PERMISSION_DENIED");
    await refused(g.call("p1", "builtin", reserved), "PERMISSION_DENIED");
    await refused(
      g.call("p1", "builtin", { kind: "run", command: { method: "addInstance", pageId: "pg", component: "x@1.0.0" } }),
      "PERMISSION_DENIED",
    );
    expect(handled).toEqual([]);
  });
  test("built-ins skip trust and grant checks but not the fetch guard", async () => {
    const { gate: g } = gate();
    await g.call("p1", "builtin", { kind: "notes.read", path: "a.md" });
    await g.call("p1", "builtin", { kind: "fetch", url: "https://example.com", init: { method: "GET", headers: {} } });
    expect(handled).toEqual(["notes", "fetch:any"]);
  });
  test("5. quotas refuse bursts and are journaled", async () => {
    const { gate: g, events } = gate(createQuotas({ callsPerSecond: 1, now: () => 0 }));
    await g.call("p1", "thirdparty", { kind: "data.keys" });
    await refused(g.call("p1", "thirdparty", { kind: "data.keys" }), "RATE_LIMITED");
    expect(events.list().map((e) => e.code)).toEqual(["RATE_LIMITED"]);
  });
  test("refusals raised by handlers are journaled too", async () => {
    const { gate: g, events } = gate();
    const deny = createGate({
      instance: () => instances.thirdparty as Instance,
      active: (ref) => ({ ref, trust: "sandboxed", granted }),
      handlers: {
        list: async () => null,
        run: async () => null,
        data: async () => {
          throw new KiboError("QUOTA_EXCEEDED", "too big");
        },
        fetch: async () => {
          throw new KiboError("PERMISSION_DENIED", "private address");
        },
        action: async () => null,
        notes: async () => null,
      },
      quotas: createQuotas(),
      events,
    });
    await refused(deny.call("p1", "thirdparty", { kind: "data.set", key: "k", value: 1 }), "QUOTA_EXCEEDED");
    await refused(deny.call("p1", "thirdparty", { kind: "fetch", url: "https://api.github.com/graphql", init: { method: "GET", headers: {} } }), "PERMISSION_DENIED");
    expect(events.list().map((e) => e.code)).toEqual(["QUOTA_EXCEEDED", "PERMISSION_DENIED"]);
    expect(g).toBeDefined();
  });
});

test("missingPermission names what is lacking", () => {
  expect(missingPermission(granted, { kind: "list", entity: "status" })).toBe("read:status");
  expect(missingPermission(granted, { kind: "data.get", key: "k" })).toBeNull();
  expect(missingPermission(granted, { kind: "fetch", url: "https://api.github.com/graphql/x", init: { method: "GET", headers: {} } })).toBeNull();
});
```

Run: `bun test packages/daemon/src/components/gate.test.ts packages/daemon/src/components/quotas.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `quotas.ts` et `events.ts`**

`packages/daemon/src/components/quotas.ts` :
```ts
export type Quotas = { take(instanceId: string, kind: "call" | "fetch"): boolean };

export function createQuotas(opts: { now?: () => number; callsPerSecond?: number; fetchPerMinute?: number } = {}): Quotas {
  const now = opts.now ?? Date.now;
  const limits = {
    call: { max: opts.callsPerSecond ?? 200, window: 1_000 },
    fetch: { max: opts.fetchPerMinute ?? 20, window: 60_000 },
  };
  const seen = new Map<string, number[]>();
  return {
    take(instanceId, kind) {
      const { max, window } = limits[kind];
      const key = `${kind}:${instanceId}`;
      const t = now();
      const recent = (seen.get(key) ?? []).filter((at) => t - at < window);
      if (recent.length >= max) {
        seen.set(key, recent);
        return false;
      }
      recent.push(t);
      seen.set(key, recent);
      return true;
    },
  };
}
```

`packages/daemon/src/components/events.ts` :
```ts
import type { Database } from "bun:sqlite";

export type ComponentEvent = { at: number; projectId: string; instanceId: string; ref: string; kind: string; code: string };
export type EventLog = { record(e: Omit<ComponentEvent, "at">): void; list(limit?: number): ComponentEvent[] };

export function ensureEventsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS component_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, " +
      "project_id TEXT NOT NULL, instance_id TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, code TEXT NOT NULL)",
  );
}

export function createEventLog(db: Database, now: () => number = Date.now): EventLog {
  const insert = db.query(
    "INSERT INTO component_events (at, project_id, instance_id, ref, kind, code) VALUES ($at, $projectId, $instanceId, $ref, $kind, $code)",
  );
  const select = db.query(
    "SELECT at, project_id AS projectId, instance_id AS instanceId, ref, kind, code FROM component_events ORDER BY id LIMIT $limit",
  );
  return {
    record: (e) => {
      insert.run({ at: now(), ...e });
    },
    list: (limit = 1_000) => select.all({ limit }) as ComponentEvent[],
  };
}
```
Le cast de `select.all` est la frontière SQLite (colonnes renommées par `AS`, même motif que `store.ts` v0.1). La base est ouverte avec `strict: true` : les paramètres s'écrivent `$nom` dans la requête et sans `$` dans l'objet.

**Journal borné (décision 26, remplace le code ci-dessus sur ces points).** Colonne `count INTEGER NOT NULL DEFAULT 1` et index `(instance_id, id)`. `record` : clé `instanceId`, `kind`, `code` ; fenêtre de `windowMs` ouverte au premier refus ; les `burst` premiers refus de la fenêtre sont insérés (`count = 1`), les suivants incrémentent un compteur en mémoire sans accès SQLite ; une ligne de synthèse (`count = n`, `at` = dernier refus compté, mêmes `projectId` et `ref`) est insérée quand un refus de la même clé arrive après la fin de la fenêtre (avant d'ouvrir la nouvelle), pour toutes les fenêtres expirées à chaque insertion (balayage, puis entrée retirée de la table en mémoire), et par `list()` et `flush()` pour les compteurs non nuls (la fenêtre reste ouverte, compteur remis à 0). Chaque insertion, dans une transaction, supprime au-delà de `maxPerInstance` lignes pour l'instance puis de `maxRows` au total, les plus anciennes d'abord. Tests à ajouter dans `events.test.ts` : (1) 50 refus identiques avec `burst: 3` ⇒ 3 lignes puis, à `list()`, une 4e ligne `count: 47` ; (2) 30 refus identiques puis 1 refus d'une autre clé ⇒ ce dernier a sa ligne immédiatement ; (3) après la fin de la fenêtre, le refus suivant de la même clé écrit la synthèse puis sa propre ligne `count: 1` ; (4) aucune écriture SQLite pendant les refus comptés : `SELECT count(*)` lu directement sur la base reste à `burst` pendant le flot ; (5) les tests de rétention existants. Dans `gate.test.ts`, les objets attendus de `events.list()` gagnent `count: 1`.

- [x] **Step 3: Implémenter `gate.ts`**

```ts
import {
  type ComponentCall,
  covers,
  type FetchInit,
  type FetchResponse,
  type GrantedPermissions,
  type Instance,
  isBuiltinId,
  isReservedCommand,
  KiboError,
  type KiboErrorCode,
  permissionList,
  permissionOfCall,
  type ProjectCommand,
  splitRef,
  type BuiltinEntityType,
} from "@kibo/schema";
import type { EventLog } from "./events";
import type { Quotas } from "./quotas";

export type ActiveVersion = { ref: string; trust: "trusted" | "sandboxed"; granted: GrantedPermissions };
type DataCall = Extract<ComponentCall, { kind: "data.get" | "data.set" | "data.delete" | "data.keys" }>;
type NotesCall = Extract<ComponentCall, { kind: `notes.${string}` }> | { kind: "list"; entity: "note" };

export type GateHandlers = {
  list(projectId: string, entity: BuiltinEntityType): Promise<unknown>;
  run(projectId: string, command: ProjectCommand): Promise<unknown>;
  data(projectId: string, instanceId: string, call: DataCall): Promise<unknown>;
  fetch(rules: readonly string[] | null, url: string, init: FetchInit): Promise<FetchResponse>;
  action(ref: string, projectId: string, instanceId: string, config: Record<string, unknown>, name: string, input: unknown): Promise<unknown>;
  notes(projectId: string, call: NotesCall): Promise<unknown>;
};
export type GateDeps = {
  instance(projectId: string, instanceId: string): Instance;
  active(ref: string): ActiveVersion;
  handlers: GateHandlers;
  quotas: Quotas;
  events: EventLog;
};

const REFUSALS = new Set<KiboErrorCode>([
  "NOT_FOUND",
  "TRUST_REQUIRED",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "PATH_OUTSIDE_PROJECT",
]);

export function missingPermission(granted: GrantedPermissions, call: ComponentCall): string | null {
  if (call.kind === "run" && isReservedCommand(call.command.method)) return `write:${call.command.method}`;
  const needed = permissionOfCall(call);
  if (needed === null) return null;
  return covers(permissionList(granted), needed) ? null : needed;
}

export function createGate(deps: GateDeps): { call(projectId: string, instanceId: string, call: ComponentCall): Promise<unknown> } {
  const dispatch = (projectId: string, inst: Instance, rules: readonly string[] | null, call: ComponentCall) => {
    const h = deps.handlers;
    switch (call.kind) {
      case "list":
        return call.entity === "note" ? h.notes(projectId, { kind: "list", entity: "note" }) : h.list(projectId, call.entity);
      case "run":
        return h.run(projectId, call.command);
      case "data.get":
      case "data.set":
      case "data.delete":
      case "data.keys":
        return h.data(projectId, inst.id, call);
      case "fetch":
        return h.fetch(rules, call.url, call.init);
      case "action":
        return h.action(inst.component, projectId, inst.id, inst.config, call.name, call.input);
      default:
        return h.notes(projectId, call);
    }
  };

  return {
    async call(projectId, instanceId, call) {
      let ref = "unknown";
      try {
        const inst = deps.instance(projectId, instanceId);
        ref = inst.component;
        const builtin = isBuiltinId(splitRef(ref).id);
        if (call.kind === "run" && isReservedCommand(call.command.method)) {
          throw new KiboError("PERMISSION_DENIED", `${call.command.method} is reserved to the shell`);
        }
        let rules: readonly string[] | null = null;
        if (!builtin) {
          const active = deps.active(ref);
          const missing = missingPermission(active.granted, call);
          if (missing) throw new KiboError("PERMISSION_DENIED", `${ref} was not granted ${missing}`);
          rules = active.granted.net;
        }
        if (!deps.quotas.take(instanceId, "call")) throw new KiboError("RATE_LIMITED", `${ref} makes too many calls`);
        if (call.kind === "fetch" && !deps.quotas.take(instanceId, "fetch")) {
          throw new KiboError("RATE_LIMITED", `${ref} fetches too often`);
        }
        return await dispatch(projectId, inst, rules, call);
      } catch (e) {
        if (e instanceof KiboError && REFUSALS.has(e.code)) {
          deps.events.record({ projectId, instanceId, ref, kind: call.kind, code: e.code });
        }
        throw e;
      }
    },
  };
}
```
Ordre de la spec §6.4 respecté : 1 (instance), 2 (version active, via `active`), 3 (permissions accordées), 4 (garde `fetch`, dans le handler qui appelle `proxyFetch`), 5 (quotas), 6 (journal). Un intégré garde les contrôles 4 et 5 et le refus des commandes réservées.

- [x] **Step 4: Vérifier et committer**

Run: `bun test packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/gate.ts packages/daemon/src/components/quotas.ts packages/daemon/src/components/events.ts packages/daemon/src/components/gate.test.ts packages/daemon/src/components/quotas.test.ts
git commit -m "feat(daemon): porte des appels de composants"
```

---

### Task 16: Mise à jour d'une instance et migrations

**Files:**
- Create: `packages/daemon/src/components/update.ts`, `packages/daemon/src/components/update.test.ts`

**Interfaces:**
- Consumes: `getInstance`, `setInstanceComponent`, `readInstanceData`, `dataSize` (tâche 3) ; `ComponentManifest`, `validateConfig`, `splitRef`, `formatRef`, `INSTANCE_DATA_LIMIT`, `KiboError` (tâche 2).
- Produces:
  - `type MigrateRequest = { projectId: string; instanceId: string; from: number; to: number; config: Record<string, unknown>; data: Record<string, unknown> }`.
  - `type UpdateDeps = { doc(projectId): LoroDoc; persist(projectId): void; manifestOf(ref): Promise<ComponentManifest>; migrate(targetRef, req: MigrateRequest): Promise<{ config; data }> }`.
  - `updateInstance(deps, projectId, instanceId, to: string): Promise<Instance>` : même version ⇒ inchangé ; `configVersion` cible < source ⇒ `INVALID_INPUT` ; cible > source ⇒ migration par le backend de la **version cible** ; config validée contre `configSchema`, données ≤ 256 Kio ; écriture unique `setInstanceComponent` ; tout échec de migration ou de validation ⇒ `MIGRATION_FAILED`, instance inchangée ; instance modifiée pendant la migration ⇒ `CONFLICT`.

- [x] **Step 1: Écrire les tests**

`packages/daemon/src/components/update.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { createProjectDoc, executeProjectCommand, getInstance, readInstanceData, writeInstanceData } from "@kibo/core";
import { ComponentManifest, type Instance, type Page } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { type MigrateRequest, updateInstance } from "./update";

const manifest = (version: string, configVersion: number, configSchema?: Record<string, unknown>) =>
  ComponentManifest.parse({ id: "hello", version, kind: "widget", title: "Hello", reads: [], writes: [], configVersion, configSchema });

const MANIFESTS: Record<string, ComponentManifest> = {
  "hello@0.1.0": manifest("0.1.0", 0),
  "hello@0.1.5": manifest("0.1.5", 0),
  "hello@0.2.0": manifest("0.2.0", 2, { mode: { enum: ["compact", "full"], default: "full" }, v: { type: "number" } }),
};

function setup(migrate?: (ref: string, req: MigrateRequest) => Promise<{ config: Record<string, unknown>; data: Record<string, unknown> }>) {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const page = executeProjectCommand(doc, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
  const inst = executeProjectCommand(doc, { method: "addInstance", pageId: page.id, component: "hello@0.1.0" }) as Instance;
  writeInstanceData(doc, inst.id, "count", 1);
  const persisted: string[] = [];
  const migrations: MigrateRequest[] = [];
  const deps = {
    doc: (): LoroDoc => doc,
    persist: (id: string) => persisted.push(id),
    manifestOf: async (ref: string) => {
      const m = MANIFESTS[ref];
      if (!m) throw new Error(`NOT_FOUND: ${ref}`);
      return m;
    },
    migrate:
      migrate ??
      (async (_ref: string, req: MigrateRequest) => {
        migrations.push(req);
        return { config: { ...req.config, mode: "compact", v: req.to }, data: { ...req.data, migrated: true } };
      }),
  };
  return { doc, inst, deps, persisted, migrations };
}

describe("updateInstance", () => {
  test("same configVersion: the ref changes, nothing runs", async () => {
    const { doc, inst, deps, migrations, persisted } = setup();
    const next = await updateInstance(deps, "p", inst.id, "0.1.5");
    expect(next.component).toBe("hello@0.1.5");
    expect(migrations).toEqual([]);
    expect(persisted).toEqual(["p"]);
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 1 });
  });
  test("configVersion 0 → 2 migrates config and data in the target backend", async () => {
    const { doc, inst, deps, migrations } = setup();
    await updateInstance(deps, "p", inst.id, "0.2.0");
    expect(migrations).toEqual([{ projectId: "p", instanceId: inst.id, from: 0, to: 2, config: {}, data: { count: 1 } }]);
    expect(getInstance(doc, inst.id)).toMatchObject({ component: "hello@0.2.0", config: { mode: "compact", v: 2 } });
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 1, migrated: true });
  });
  test("a failing or invalid migration leaves the instance unchanged", async () => {
    for (const migrate of [
      async () => {
        throw new Error("boom");
      },
      async () => ({ config: { mode: "weird" }, data: {} }),
      async () => ({ config: {}, data: { big: "x".repeat(300_000) } }),
    ]) {
      const { doc, inst, deps, persisted } = setup(migrate);
      await expect(updateInstance(deps, "p", inst.id, "0.2.0")).rejects.toThrow("MIGRATION_FAILED");
      expect(getInstance(doc, inst.id).component).toBe("hello@0.1.0");
      expect(readInstanceData(doc, inst.id)).toEqual({ count: 1 });
      expect(persisted).toEqual([]);
    }
  });
  test("configVersion never goes down; a lower version with the same configVersion is fine", async () => {
    const { inst, deps } = setup();
    await updateInstance(deps, "p", inst.id, "0.2.0");
    await expect(updateInstance(deps, "p", inst.id, "0.1.5")).rejects.toThrow("INVALID_INPUT");
    const other = setup();
    await updateInstance(other.deps, "p", other.inst.id, "0.1.5");
    expect((await updateInstance(other.deps, "p", other.inst.id, "0.1.0")).component).toBe("hello@0.1.0");
  });
  test("an instance changed during the migration is a conflict", async () => {
    const holder: { doc?: LoroDoc; id?: string } = {};
    const { doc, inst, deps } = setup(async (_ref, req) => {
      executeProjectCommand(holder.doc as LoroDoc, { method: "setInstanceConfig", instanceId: holder.id ?? "", config: { v: 9 } });
      return { config: req.config, data: req.data };
    });
    holder.doc = doc;
    holder.id = inst.id;
    await expect(updateInstance(deps, "p", inst.id, "0.2.0")).rejects.toThrow("CONFLICT");
  });
});
```

Run: `bun test packages/daemon/src/components/update.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `update.ts`**

```ts
import { dataSize, getInstance, readInstanceData, setInstanceComponent } from "@kibo/core";
import {
  type ComponentManifest,
  formatRef,
  INSTANCE_DATA_LIMIT,
  type Instance,
  KiboError,
  splitRef,
  validateConfig,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

type Json = Record<string, unknown>;
export type MigrateRequest = { projectId: string; instanceId: string; from: number; to: number; config: Json; data: Json };
export type UpdateDeps = {
  doc(projectId: string): LoroDoc;
  persist(projectId: string): void;
  manifestOf(ref: string): Promise<ComponentManifest>;
  migrate(targetRef: string, req: MigrateRequest): Promise<{ config: Json; data: Json }>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function updateInstance(deps: UpdateDeps, projectId: string, instanceId: string, to: string): Promise<Instance> {
  const doc = deps.doc(projectId);
  const before = getInstance(doc, instanceId);
  const { id, version } = splitRef(before.component);
  if (version === to) return before;
  const target = formatRef(id, to);
  const [source, next] = await Promise.all([deps.manifestOf(before.component), deps.manifestOf(target)]);
  if (next.configVersion < source.configVersion) {
    throw new KiboError("INVALID_INPUT", `${target} has an older config version than ${before.component}`);
  }
  let config: Json = before.config;
  let data: Json | null = null;
  if (next.configVersion > source.configVersion) {
    try {
      const out = await deps.migrate(target, {
        projectId,
        instanceId,
        from: source.configVersion,
        to: next.configVersion,
        config: before.config,
        data: readInstanceData(doc, instanceId),
      });
      config = out.config;
      data = out.data;
    } catch (e) {
      throw new KiboError("MIGRATION_FAILED", `${target}: ${message(e)}`);
    }
  }
  const errors = validateConfig(next.configSchema, config);
  if (errors.length > 0) throw new KiboError("MIGRATION_FAILED", `${target}: invalid config (${errors.join("; ")})`);
  if (data !== null && dataSize(data) > INSTANCE_DATA_LIMIT) throw new KiboError("MIGRATION_FAILED", `${target}: data too large`);
  const current = getInstance(doc, instanceId);
  if (current.component !== before.component || JSON.stringify(current.config) !== JSON.stringify(before.config)) {
    throw new KiboError("CONFLICT", `instance ${instanceId} changed during the update`);
  }
  const updated = setInstanceComponent(doc, { instanceId, component: target, config, data });
  deps.persist(projectId);
  return updated;
}
```

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/daemon/src/components/update.test.ts && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/update.ts packages/daemon/src/components/update.test.ts
git commit -m "feat(daemon): mise à jour et migration d'instance"
```

---

### Task 17: Registre des backends, actions et jobs planifiés

**Files:**
- Create: `packages/daemon/src/components/backends.ts`, `packages/daemon/src/components/jobs.ts`, `packages/daemon/src/components/backends.test.ts`, `packages/daemon/src/components/jobs.test.ts`

**Interfaces:**
- Consumes: `createProcessHost`, `createWorkerHost`, `BackendHost`, `CallHandler`, `HostOptions` (tâche 11) ; `BackendCode`, `BackendDescription`, `ComponentManifest`, `KiboError` (tâche 2).
- Produces:
  - `type BackendSource = { manifest: ComponentManifest; code: BackendCode; trust: "trusted" | "sandboxed" }`.
  - `type BackendsDeps = { source(ref): BackendSource | null; verify(ref): Promise<void>; onCall: CallHandler; processCommand?: string[]; hostOptions?: Partial<HostOptions> }`.
  - `type Backends = { action(ref, req: { projectId; instanceId; config; name; input }): Promise<unknown>; migrate(ref, req: MigrateRequest): Promise<{ config; data }>; runJob(ref, req: { projectId; instanceId; config; job }): Promise<void>; describe(ref): Promise<BackendDescription>; stop(ref): void; stopAll(): void }` ; `createBackends(deps): Backends`. Sans source (version non active) ⇒ `TRUST_REQUIRED` ; sans `server.js` ni `migrations.js` ⇒ `PERMISSION_DENIED` pour une action, migration identité (`applyMigrations` avec aucun pas) pour `migrate`.
  - `type JobTarget = { projectId: string; instanceId: string; ref: string; config: Record<string, unknown> }` ; `createJobScheduler(deps: { targets(): JobTarget[]; describe(ref): Promise<BackendDescription>; run(target, job): Promise<void>; setInterval?; clearInterval?; log?: (line: string) => void }): { refresh(): Promise<void>; stop(): void; scheduled(): string[] }` (clé `instanceId:job`).

- [x] **Step 1: Écrire les tests**

`packages/daemon/src/components/backends.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { MIGRATIONS_JS, SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import { type Backends, createBackends } from "./backends";

const all: Backends[] = [];
afterEach(() => {
  for (const b of all.splice(0)) b.stopAll();
});

function backends(opts: { trust?: "trusted" | "sandboxed" | null; server?: boolean; verify?: () => Promise<void> } = {}) {
  const trust = opts.trust === undefined ? "sandboxed" : opts.trust;
  const b = createBackends({
    source: () =>
      trust === null
        ? null
        : { manifest: TEST_MANIFEST, trust, code: { server: opts.server === false ? null : SERVER_JS, migrations: MIGRATIONS_JS } },
    verify: opts.verify ?? (async () => undefined),
    onCall: async () => [],
  });
  all.push(b);
  return b;
}

const req = { projectId: "p", instanceId: "i", config: {}, input: null };

test("actions run in a sandboxed process or a trusted worker", async () => {
  expect(await backends().action("probe@0.1.0", { ...req, name: "ping" })).toBe("pong");
  expect(await backends({ trust: "trusted" }).action("probe@0.1.0", { ...req, name: "ping" })).toBe("pong");
});

test("an unapproved version has no backend", async () => {
  await expect(backends({ trust: null }).action("probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow("TRUST_REQUIRED");
});

test("the hash is checked again before each launch", async () => {
  const b = backends({
    verify: async () => {
      throw new Error("TRUST_REQUIRED: tampered");
    },
  });
  await expect(b.action("probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow("TRUST_REQUIRED");
});

test("describe lists jobs, migrate runs the steps", async () => {
  const b = backends();
  expect((await b.describe("probe@0.1.0")).jobs).toEqual([{ name: "sync", everyMinutes: 5 }]);
  expect(await b.migrate("probe@0.1.0", { projectId: "p", instanceId: "i", from: 0, to: 1, config: {}, data: {} })).toEqual({
    config: { v: 1 },
    data: {},
  });
});
```

`packages/daemon/src/components/jobs.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createJobScheduler, type JobTarget } from "./jobs";

test("each instance gets its own timer per job, removed with the instance", async () => {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let seq = 0;
  const runs: string[] = [];
  let targets: JobTarget[] = [
    { projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} },
    { projectId: "p", instanceId: "b", ref: "x@1.0.0", config: {} },
    { projectId: "p", instanceId: "c", ref: "broken@1.0.0", config: {} },
  ];
  const logs: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => targets,
    describe: async (ref) => {
      if (ref === "broken@1.0.0") throw new Error("TRUST_REQUIRED: nope");
      return { actions: [], jobs: [{ name: "sync", everyMinutes: 5 }] };
    },
    run: async (t, job) => {
      runs.push(`${t.instanceId}:${job}`);
    },
    setInterval: (fn, ms) => {
      seq += 1;
      timers.set(seq, { fn, ms });
      return seq;
    },
    clearInterval: (id) => {
      timers.delete(Number(id));
    },
    log: (line) => logs.push(line),
  });
  await scheduler.refresh();
  expect(scheduler.scheduled()).toEqual(["a:sync", "b:sync"]);
  expect([...timers.values()].map((t) => t.ms)).toEqual([300_000, 300_000]);
  for (const t of timers.values()) t.fn();
  await Promise.resolve();
  expect(runs.sort()).toEqual(["a:sync", "b:sync"]);
  expect(logs).toHaveLength(1);
  targets = targets.filter((t) => t.instanceId !== "b");
  await scheduler.refresh();
  expect(scheduler.scheduled()).toEqual(["a:sync"]);
  scheduler.stop();
  expect(timers.size).toBe(0);
});

test("a job is not started again while its previous run is still going", async () => {
  const ticks: (() => void)[] = [];
  const finish = Promise.withResolvers<void>();
  let runs = 0;
  const logs: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => [{ projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} }],
    describe: async () => ({ actions: [], jobs: [{ name: "sync", everyMinutes: 1 }] }),
    run: async () => {
      runs += 1;
      await finish.promise;
    },
    setInterval: (fn) => {
      ticks.push(fn);
      return ticks.length;
    },
    clearInterval: () => undefined,
    log: (line) => logs.push(line),
  });
  await scheduler.refresh();
  ticks[0]?.();
  ticks[0]?.();
  expect(runs).toBe(1);
  expect(logs.some((l) => l.includes("skipped"))).toBe(true);
  finish.resolve();
  await new Promise((r) => setTimeout(r, 0));
  ticks[0]?.();
  expect(runs).toBe(2);
  scheduler.stop();
});
```

Run: `bun test packages/daemon/src/components/backends.test.ts packages/daemon/src/components/jobs.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `backends.ts`**

```ts
import {
  applyMigrations,
  type BackendCode,
  type BackendDescription,
  type ComponentManifest,
  KiboError,
} from "@kibo/schema";
import type { BackendHost, CallHandler, HostOptions } from "./host-core";
import { createProcessHost } from "./process-host";
import type { MigrateRequest } from "./update";
import { createWorkerHost } from "./worker-host";

type Json = Record<string, unknown>;
export type BackendSource = { manifest: ComponentManifest; code: BackendCode; trust: "trusted" | "sandboxed" };
export type BackendsDeps = {
  source(ref: string): BackendSource | null;
  verify(ref: string): Promise<void>;
  onCall: CallHandler;
  processCommand?: string[];
  hostOptions?: Partial<HostOptions>;
};
export type Backends = {
  action(ref: string, req: { projectId: string; instanceId: string; config: Json; name: string; input: unknown }): Promise<unknown>;
  migrate(ref: string, req: MigrateRequest): Promise<{ config: Json; data: Json }>;
  runJob(ref: string, req: { projectId: string; instanceId: string; config: Json; job: string }): Promise<void>;
  describe(ref: string): Promise<BackendDescription>;
  stop(ref: string): void;
  stopAll(): void;
};

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export function createBackends(deps: BackendsDeps): Backends {
  const hosts = new Map<string, { host: BackendHost; trust: BackendSource["trust"] }>();

  const sourceOf = (ref: string): BackendSource => {
    const source = deps.source(ref);
    if (!source) throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
    return source;
  };
  const hostFor = (ref: string, source: BackendSource): BackendHost => {
    const existing = hosts.get(ref);
    if (existing && existing.trust === source.trust) return existing.host;
    existing?.host.stop();
    const opts: HostOptions = {
      ref,
      manifest: source.manifest,
      code: source.code,
      onCall: deps.onCall,
      beforeStart: () => deps.verify(ref),
      ...deps.hostOptions,
    };
    const host =
      source.trust === "trusted"
        ? createWorkerHost(opts)
        : createProcessHost({ ...opts, ...(deps.processCommand && { command: deps.processCommand }) });
    hosts.set(ref, { host, trust: source.trust });
    return host;
  };

  return {
    async action(ref, req) {
      const source = sourceOf(ref);
      if (!source.code.server) throw new KiboError("PERMISSION_DENIED", `${ref} has no server`);
      const { name, ...rest } = req;
      return hostFor(ref, source).invoke({ ...rest, target: { action: name } });
    },
    async migrate(ref, req) {
      const source = sourceOf(ref);
      if (!source.code.migrations) return applyMigrations({}, req.from, req.to, { config: req.config, data: req.data });
      const out = await hostFor(ref, source).invoke({
        projectId: req.projectId,
        instanceId: req.instanceId,
        config: req.config,
        target: { migrate: { from: req.from, to: req.to, config: req.config, data: req.data } },
        input: null,
      });
      if (!isRecord(out) || !isRecord(out.config) || !isRecord(out.data)) {
        throw new KiboError("MIGRATION_FAILED", `${ref} returned an invalid migration result`);
      }
      return { config: out.config, data: out.data };
    },
    async runJob(ref, req) {
      const source = sourceOf(ref);
      const { job, ...rest } = req;
      await hostFor(ref, source).invoke({ ...rest, target: { job }, input: null });
    },
    async describe(ref) {
      const source = sourceOf(ref);
      if (!source.code.server) return { actions: [], jobs: [] };
      return hostFor(ref, source).describe();
    },
    stop(ref) {
      hosts.get(ref)?.host.stop();
      hosts.delete(ref);
    },
    stopAll() {
      for (const { host } of hosts.values()) host.stop();
      hosts.clear();
    },
  };
}
```

- [x] **Step 3: Implémenter `jobs.ts`**

```ts
import type { BackendDescription } from "@kibo/schema";

export type JobTarget = { projectId: string; instanceId: string; ref: string; config: Record<string, unknown> };
type Timer = unknown;
export type JobSchedulerDeps = {
  targets(): JobTarget[];
  describe(ref: string): Promise<BackendDescription>;
  run(target: JobTarget, job: string): Promise<void>;
  setInterval?: (fn: () => void, ms: number) => Timer;
  clearInterval?: (timer: Timer) => void;
  log?: (line: string) => void;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createJobScheduler(deps: JobSchedulerDeps): { refresh(): Promise<void>; stop(): void; scheduled(): string[] } {
  const every = deps.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
  const clear = deps.clearInterval ?? ((t: Timer) => clearInterval(t as ReturnType<typeof setInterval>));
  const log = deps.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  const timers = new Map<string, Timer>();
  const running = new Set<string>();

  return {
    async refresh() {
      const wanted = new Map<string, { target: JobTarget; job: string; minutes: number }>();
      const targets = deps.targets();
      const refs = [...new Set(targets.map((t) => t.ref))];
      const described = new Map<string, BackendDescription>();
      for (const ref of refs) {
        try {
          described.set(ref, await deps.describe(ref));
        } catch (e) {
          log(`jobs of ${ref} not scheduled: ${message(e)}`);
        }
      }
      for (const target of targets) {
        for (const job of described.get(target.ref)?.jobs ?? []) {
          wanted.set(`${target.instanceId}:${job.name}`, { target, job: job.name, minutes: job.everyMinutes });
        }
      }
      for (const [key, timer] of timers) {
        if (wanted.has(key)) continue;
        clear(timer);
        timers.delete(key);
      }
      for (const [key, w] of wanted) {
        if (timers.has(key)) continue;
        timers.set(
          key,
          every(() => {
            if (running.has(key)) return log(`job ${key} of ${w.target.ref} skipped: previous run not finished`);
            running.add(key);
            deps
              .run(w.target, w.job)
              .catch((e: unknown) => log(`job ${key} of ${w.target.ref} failed: ${message(e)}`))
              .finally(() => running.delete(key));
          }, w.minutes * 60_000),
        );
      }
    },
    stop() {
      for (const timer of timers.values()) clear(timer);
      timers.clear();
    },
    scheduled: () => [...timers.keys()].sort(),
  };
}
```
Le cast de `clear` est la frontière avec le type opaque des minuteries injectées (le défaut est un vrai `setInterval`). Un job dont l'exécution précédente n'est pas finie n'est pas relancé (décision 25 c) : sans cela, un job lent empilerait des invocations dans la file du backend. Une instance dont la version n'est pas active est journalisée et ignorée ; elle sera planifiée au `refresh` qui suit son approbation (tâche 30).

- [x] **Step 4: Vérifier et committer**

Run: `bun test packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/backends.ts packages/daemon/src/components/jobs.ts packages/daemon/src/components/backends.test.ts packages/daemon/src/components/jobs.test.ts
git commit -m "feat(daemon): backends, actions et jobs"
```

---

### Task 18: Notes côté démon (dossier, fichiers confinés, index, surveillance)

**Files:**
- Create: `packages/daemon/src/notes/settings.ts`, `packages/daemon/src/notes/notes-fs.ts`, `packages/daemon/src/notes/index.ts`, `packages/daemon/src/notes/watch.ts`, `packages/daemon/src/notes/service.ts`
- Test: `packages/daemon/src/notes/notes-fs.test.ts`, `packages/daemon/src/notes/index.test.ts`, `packages/daemon/src/notes/watch.test.ts`, `packages/daemon/src/notes/service.test.ts`

**Interfaces:**
- Consumes: `parseNote` (`@kibo/core/notes`, tâche 9) ; `isSafeNotePath`, `NoteMeta`, `NotesInfo`, `ComponentCall`, `KiboError` (tâche 2).
- Produces:
  - `ensureSettingsTable(db)` ; `createProjectSettings(db): { get(projectId, key): string | null; set(projectId, key, value: string): void }` (table `project_settings`).
  - `resolveNotePath(dir, rel): Promise<string>` (`PATH_OUTSIDE_PROJECT` pour tout chemin non sûr ou traversant un lien symbolique) ; `listNoteFiles(dir): Promise<string[]>` ; `readNoteFile(dir, rel): Promise<NoteFile>` ; `writeNoteFile(dir, rel, markdown, expectedMtime: number | null): Promise<NoteFile>` (atomique, `CONFLICT`) ; `renameNoteFile(dir, from, to)` ; `removeNoteFile(dir, rel)` ; `type NoteFile = { markdown: string; mtime: number; size: number }` ; `MAX_NOTE_BYTES = 1_048_576`.
  - `ensureNotesTables(db)` ; `createNotesIndex(db): NotesIndex` avec `replace(projectId, projectKey, notes: IndexedNote[]): void`, `list(projectId): NoteMeta[]` (tri `mtime` décroissant), `get(projectId, path): NoteMeta | null`, `search(projectId, query): NoteMeta[]` ; `type IndexedNote = { path: string; markdown: string; mtime: number; size: number }`.
  - `type WatchFn = (dir: string, onEvent: () => void) => { close(): void }` ; `watchNotes(dir, onChange, opts?: { debounceMs?: number; pollMs?: number; watch?: WatchFn; log?: (line: string) => void }): { close(): void; readonly polling: boolean }`.
  - `type NotesProject = { id: string; key: string; folder: string | null }` ; `createNotesService(deps: { db: Database; home: string; homeDir?: string; project(projectId): NotesProject; onChange?: (projectId: string) => void; watch?: WatchFn; debounceMs?: number }): NotesService` avec `info(projectId): NotesInfo`, `setDir(projectId, dir): Promise<NotesInfo>`, `handle(projectId, call: ComponentCall): Promise<unknown>`, `refresh(projectId): Promise<void>`, `close(): void`.

- [x] **Step 1: Écrire les tests des fichiers**

`packages/daemon/src/notes/notes-fs.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listNoteFiles, readNoteFile, removeNoteFile, renameNoteFile, resolveNotePath, writeNoteFile } from "./notes-fs";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
function folder() {
  const root = mkdtempSync(join(tmpdir(), "kibo-notes-"));
  roots.push(root);
  const dir = join(root, "notes");
  mkdirSync(dir);
  writeFileSync(join(root, "secret.md"), "secret");
  return { root, dir };
}

describe("confinement", () => {
  test("hostile paths are refused", async () => {
    const { root, dir } = folder();
    symlinkSync(join(root, "secret.md"), join(dir, "evil.md"));
    symlinkSync(root, join(dir, "linked"));
    for (const p of ["../secret.md", "a/../../secret.md", "/etc/passwd.md", ".obsidian/x.md", "notes.txt", "evil.md", "linked/secret.md"]) {
      await expect(resolveNotePath(dir, p)).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    }
    await expect(readNoteFile(dir, "evil.md")).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    await expect(writeNoteFile(dir, "linked/new.md", "x", null)).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    expect(readdirSync(root).sort()).toEqual(["notes", "secret.md"]);
  });
  test("listing skips hidden entries, symbolic links and non-Markdown files", async () => {
    const { root, dir } = folder();
    mkdirSync(join(dir, ".obsidian"));
    mkdirSync(join(dir, "projets"));
    writeFileSync(join(dir, ".obsidian", "app.md"), "x");
    writeFileSync(join(dir, "projets", "b.md"), "b");
    writeFileSync(join(dir, "a.md"), "a");
    writeFileSync(join(dir, "image.png"), "x");
    symlinkSync(join(root, "secret.md"), join(dir, "evil.md"));
    symlinkSync(root, join(dir, "linked"));
    expect(await listNoteFiles(dir)).toEqual(["a.md", "projets/b.md"]);
  });
});

describe("writes", () => {
  test("write is atomic, creates folders and reports the new mtime", async () => {
    const { dir } = folder();
    const first = await writeNoteFile(dir, "projets/a.md", "# A", null);
    expect(readFileSync(join(dir, "projets", "a.md"), "utf8")).toBe("# A");
    expect(readdirSync(join(dir, "projets"))).toEqual(["a.md"]);
    expect((await readNoteFile(dir, "projets/a.md")).mtime).toBe(first.mtime);
  });
  test("an external change since the read is a conflict; null forces the write", async () => {
    const { dir } = folder();
    const first = await writeNoteFile(dir, "a.md", "# A", null);
    writeFileSync(join(dir, "a.md"), "# changé ailleurs");
    utimesSync(join(dir, "a.md"), new Date(), new Date(first.mtime + 5_000));
    await expect(writeNoteFile(dir, "a.md", "# mine", first.mtime)).rejects.toThrow("CONFLICT");
    await writeNoteFile(dir, "a.md", "# mine", null);
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe("# mine");
    await expect(writeNoteFile(dir, "b.md", "# B", 123)).rejects.toThrow("CONFLICT");
  });
  test("rename refuses to overwrite, remove deletes, missing notes are NOT_FOUND", async () => {
    const { dir } = folder();
    await writeNoteFile(dir, "a.md", "# A", null);
    await writeNoteFile(dir, "b.md", "# B", null);
    await expect(renameNoteFile(dir, "a.md", "b.md")).rejects.toThrow("CONFLICT");
    await renameNoteFile(dir, "a.md", "archive/a.md");
    expect(await listNoteFiles(dir)).toEqual(["archive/a.md", "b.md"]);
    await removeNoteFile(dir, "b.md");
    await expect(readNoteFile(dir, "b.md")).rejects.toThrow("NOT_FOUND");
    await expect(removeNoteFile(dir, "b.md")).rejects.toThrow("NOT_FOUND");
  });
});
```

Run: `bun test packages/daemon/src/notes/notes-fs.test.ts`
Expected: FAIL (module absent).

- [x] **Step 2: Implémenter `notes-fs.ts`**

```ts
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";
import { isSafeNotePath, KiboError } from "@kibo/schema";

export type NoteFile = { markdown: string; mtime: number; size: number };
export const MAX_NOTE_BYTES = 1_048_576;

const outside = (p: string) => new KiboError("PATH_OUTSIDE_PROJECT", `note path ${p} leaves the notes folder`);
const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";
const mtimeOf = (ms: number) => Math.floor(ms);

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export async function resolveNotePath(dir: string, rel: string): Promise<string> {
  if (!isSafeNotePath(rel)) throw outside(rel);
  const root = await realpath(dir);
  let current = root;
  for (const segment of rel.split("/")) {
    current = join(current, segment);
    const info = await lstatOrNull(current);
    if (info === null) break;
    if (info.isSymbolicLink()) throw outside(rel);
  }
  if (!current.startsWith(root + sep)) throw outside(rel);
  return join(root, ...rel.split("/"));
}

export async function listNoteFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(abs, entry.name), childRel);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(childRel);
    }
  };
  await walk(await realpath(dir), "");
  return out.sort();
}

export async function readNoteFile(dir: string, rel: string): Promise<NoteFile> {
  const full = await resolveNotePath(dir, rel);
  try {
    const info = await stat(full);
    if (info.size > MAX_NOTE_BYTES) throw new KiboError("QUOTA_EXCEEDED", `${rel} is larger than 1 MiB`);
    return { markdown: await readFile(full, "utf8"), mtime: mtimeOf(info.mtimeMs), size: info.size };
  } catch (e) {
    if (isMissing(e)) throw new KiboError("NOT_FOUND", `note ${rel} not found`);
    throw e;
  }
}

export async function writeNoteFile(dir: string, rel: string, markdown: string, expectedMtime: number | null): Promise<NoteFile> {
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.byteLength > MAX_NOTE_BYTES) throw new KiboError("QUOTA_EXCEEDED", `${rel} is larger than 1 MiB`);
  const full = await resolveNotePath(dir, rel);
  if (expectedMtime !== null) {
    const current = await lstatOrNull(full);
    if (current === null || mtimeOf(current.mtimeMs) !== expectedMtime) throw new KiboError("CONFLICT", `${rel} changed on disk`);
  }
  await mkdir(dirname(full), { recursive: true });
  await resolveNotePath(dir, rel);
  const temp = join(dirname(full), `.${basename(full)}.${crypto.randomUUID()}.tmp`);
  try {
    await writeFile(temp, bytes);
    await rename(temp, full);
  } finally {
    await rm(temp, { force: true });
  }
  const info = await stat(full);
  return { markdown, mtime: mtimeOf(info.mtimeMs), size: info.size };
}

export async function renameNoteFile(dir: string, from: string, to: string): Promise<void> {
  const source = await resolveNotePath(dir, from);
  const target = await resolveNotePath(dir, to);
  if ((await lstatOrNull(source)) === null) throw new KiboError("NOT_FOUND", `note ${from} not found`);
  if ((await lstatOrNull(target)) !== null) throw new KiboError("CONFLICT", `${to} already exists`);
  await mkdir(dirname(target), { recursive: true });
  await resolveNotePath(dir, to);
  await rename(source, target);
}

export async function removeNoteFile(dir: string, rel: string): Promise<void> {
  const full = await resolveNotePath(dir, rel);
  if ((await lstatOrNull(full)) === null) throw new KiboError("NOT_FOUND", `note ${rel} not found`);
  await rm(full);
}
```
La deuxième `resolveNotePath` après `mkdir` revérifie qu'aucun lien symbolique n'a été glissé entre-temps dans les dossiers créés. Le fichier temporaire est caché : l'index et la surveillance l'ignorent.

- [x] **Step 3: Écrire les tests de l'index et implémenter `settings.ts` et `index.ts`**

`packages/daemon/src/notes/index.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createNotesIndex, ensureNotesTables } from "./index";
import { createProjectSettings, ensureSettingsTable } from "./settings";

function index() {
  const db = new Database(":memory:", { strict: true });
  ensureNotesTables(db);
  return createNotesIndex(db);
}

const NOTES = [
  { path: "decisions-architecture.md", markdown: "# Décisions d'architecture\n\nVoir KIB-12 et KIB-13.\n\n```\nKIB-99\n```", mtime: 300, size: 10 },
  { path: "journal-agents.md", markdown: "# Journal agents\n\n[[decisions-architecture]] puis [[decisions-architecture|encore]]", mtime: 200, size: 10 },
  { path: "idees.md", markdown: "---\ntickets: [KIB-21]\n---\nPas de titre, voir [archi](decisions-architecture.md)", mtime: 100, size: 10 },
];

test("the index keeps titles, tickets and one link per occurrence, newest first", () => {
  const idx = index();
  idx.replace("p1", "KIB", NOTES);
  expect(idx.list("p1").map((n) => [n.path, n.title, n.tickets, n.links])).toEqual([
    ["decisions-architecture.md", "Décisions d'architecture", ["KIB-12", "KIB-13"], []],
    ["journal-agents.md", "Journal agents", [], ["decisions-architecture.md", "decisions-architecture.md"]],
    ["idees.md", "idees", ["KIB-21"], ["decisions-architecture.md"]],
  ]);
  expect(idx.get("p1", "idees.md")?.mtime).toBe(100);
  expect(idx.get("p1", "absent.md")).toBeNull();
});

test("search matches title and body, case-insensitively, per project", () => {
  const idx = index();
  idx.replace("p1", "KIB", NOTES);
  idx.replace("p2", "API", [{ path: "x.md", markdown: "# Agents", mtime: 1, size: 1 }]);
  expect(idx.search("p1", "AGENTS").map((n) => n.path)).toEqual(["journal-agents.md"]);
  expect(idx.search("p1", "titre").map((n) => n.path)).toEqual(["idees.md"]);
  expect(idx.search("p1", "%").map((n) => n.path)).toEqual([]);
  idx.replace("p1", "KIB", []);
  expect(idx.list("p1")).toEqual([]);
  expect(idx.list("p2")).toHaveLength(1);
});

test("project settings are local key/values", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const s = createProjectSettings(db);
  expect(s.get("p1", "notesDir")).toBeNull();
  s.set("p1", "notesDir", "/a");
  s.set("p1", "notesDir", "/b");
  expect(s.get("p1", "notesDir")).toBe("/b");
});
```

`packages/daemon/src/notes/settings.ts` :
```ts
import type { Database } from "bun:sqlite";

export type ProjectSettings = { get(projectId: string, key: string): string | null; set(projectId: string, key: string, value: string): void };

export function ensureSettingsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS project_settings (project_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (project_id, key))",
  );
}

export function createProjectSettings(db: Database): ProjectSettings {
  const select = db.query("SELECT value FROM project_settings WHERE project_id = $projectId AND key = $key");
  const upsert = db.query(
    "INSERT INTO project_settings (project_id, key, value) VALUES ($projectId, $key, $value) " +
      "ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value",
  );
  return {
    get: (projectId, key) => (select.get({ projectId, key }) as { value: string } | null)?.value ?? null,
    set: (projectId, key, value) => {
      upsert.run({ projectId, key, value });
    },
  };
}
```

`packages/daemon/src/notes/index.ts` :
```ts
import type { Database } from "bun:sqlite";
import { parseNote } from "@kibo/core/notes";
import type { NoteMeta } from "@kibo/schema";

export type IndexedNote = { path: string; markdown: string; mtime: number; size: number };
export type NotesIndex = {
  replace(projectId: string, projectKey: string, notes: IndexedNote[]): void;
  list(projectId: string): NoteMeta[];
  get(projectId: string, path: string): NoteMeta | null;
  search(projectId: string, query: string): NoteMeta[];
};

type NoteRow = { path: string; title: string; mtime: number; size: number };

export function ensureNotesTables(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS notes (project_id TEXT NOT NULL, path TEXT NOT NULL, title TEXT NOT NULL, " +
      "mtime INTEGER NOT NULL, size INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY (project_id, path))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS note_links (project_id TEXT NOT NULL, from_path TEXT NOT NULL, to_path TEXT NOT NULL, ord INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS note_tickets (project_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL, ord INTEGER NOT NULL)",
  );
}

export function createNotesIndex(db: Database): NotesIndex {
  const insertNote = db.query(
    "INSERT INTO notes (project_id, path, title, mtime, size, body) VALUES ($projectId, $path, $title, $mtime, $size, $body)",
  );
  const insertLink = db.query("INSERT INTO note_links (project_id, from_path, to_path, ord) VALUES ($projectId, $from, $to, $ord)");
  const insertTicket = db.query("INSERT INTO note_tickets (project_id, path, key, ord) VALUES ($projectId, $path, $key, $ord)");
  const selectNotes = db.query("SELECT path, title, mtime, size FROM notes WHERE project_id = $projectId ORDER BY mtime DESC, path");
  const searchNotes = db.query(
    "SELECT path, title, mtime, size FROM notes WHERE project_id = $projectId AND instr(lower(title || ' ' || body), lower($q)) > 0 ORDER BY mtime DESC, path",
  );
  const selectLinks = db.query("SELECT from_path AS path, to_path AS target FROM note_links WHERE project_id = $projectId ORDER BY from_path, ord");
  const selectTickets = db.query("SELECT path, key AS target FROM note_tickets WHERE project_id = $projectId ORDER BY path, ord");

  const replace = db.transaction((projectId: string, projectKey: string, notes: IndexedNote[]) => {
    for (const table of ["notes", "note_links", "note_tickets"]) db.query(`DELETE FROM ${table} WHERE project_id = $projectId`).run({ projectId });
    const paths = notes.map((n) => n.path);
    for (const n of notes) {
      const parsed = parseNote(n.path, n.markdown, projectKey, paths);
      insertNote.run({ projectId, path: n.path, title: parsed.title, mtime: n.mtime, size: n.size, body: n.markdown });
      parsed.links.forEach((to, ord) => insertLink.run({ projectId, from: n.path, to, ord }));
      parsed.tickets.forEach((key, ord) => insertTicket.run({ projectId, path: n.path, key, ord }));
    }
  });

  const grouped = (rows: { path: string; target: string }[]) => {
    const out = new Map<string, string[]>();
    for (const r of rows) out.set(r.path, [...(out.get(r.path) ?? []), r.target]);
    return out;
  };
  const withRelations = (projectId: string, rows: NoteRow[]): NoteMeta[] => {
    const links = grouped(selectLinks.all({ projectId }) as { path: string; target: string }[]);
    const tickets = grouped(selectTickets.all({ projectId }) as { path: string; target: string }[]);
    return rows.map((r) => ({ ...r, tickets: tickets.get(r.path) ?? [], links: links.get(r.path) ?? [] }));
  };

  return {
    replace: (projectId, projectKey, notes) => {
      replace(projectId, projectKey, notes);
    },
    list: (projectId) => withRelations(projectId, selectNotes.all({ projectId }) as NoteRow[]),
    get: (projectId, path) => withRelations(projectId, selectNotes.all({ projectId }) as NoteRow[]).find((n) => n.path === path) ?? null,
    search: (projectId, query) => withRelations(projectId, searchNotes.all({ projectId, q: query }) as NoteRow[]),
  };
}
```
`instr` (et non `LIKE`) : `%` et `_` sont cherchés littéralement. Les casts de lignes sont la frontière SQLite, comme dans `store.ts`.

Run: `bun test packages/daemon/src/notes/index.test.ts packages/daemon/src/notes/notes-fs.test.ts`
Expected: PASS.

- [x] **Step 4: Écrire les tests de la surveillance et du service**

`packages/daemon/src/notes/watch.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchNotes } from "./watch";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
const until = async (check: () => boolean, ms = 4_000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  return check();
};

test("an external write is detected once, after the debounce", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  const w = watchNotes(dir, () => {
    changes += 1;
  });
  writeFileSync(join(dir, "a.md"), "# A");
  writeFileSync(join(dir, "a.md"), "# A2");
  expect(await until(() => changes > 0)).toBe(true);
  await new Promise((r) => setTimeout(r, 400));
  expect(changes).toBe(1);
  w.close();
});

test("polling takes over when fs.watch is unavailable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-watch-"));
  roots.push(dir);
  let changes = 0;
  const logs: string[] = [];
  const w = watchNotes(
    dir,
    () => {
      changes += 1;
    },
    {
      pollMs: 50,
      watch: () => {
        throw new Error("ENOSYS");
      },
      log: (l) => logs.push(l),
    },
  );
  expect(w.polling).toBe(true);
  expect(logs[0]).toContain("ENOSYS");
  await new Promise((r) => setTimeout(r, 120));
  writeFileSync(join(dir, "b.md"), "# B");
  expect(await until(() => changes > 0)).toBe(true);
  w.close();
});
```

`packages/daemon/src/notes/service.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NoteContent, NoteMeta, NotesInfo } from "@kibo/schema";
import { ensureNotesTables } from "./index";
import { createNotesService, type NotesProject } from "./service";
import { ensureSettingsTable } from "./settings";

const roots: string[] = [];
const services: { close(): void }[] = [];
afterAll(() => {
  for (const s of services) s.close();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function setup(folder: "repo" | null = "repo") {
  const root = mkdtempSync(join(tmpdir(), "kibo-notes-svc-"));
  roots.push(root);
  const repo = join(root, "users", "adam", "goinfre", "Kibo");
  mkdirSync(repo, { recursive: true });
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  ensureNotesTables(db);
  const changed: string[] = [];
  const projects: Record<string, NotesProject> = { p1: { id: "p1", key: "KIB", folder: folder === "repo" ? repo : null } };
  const svc = createNotesService({
    db,
    home: join(root, "kibo-home"),
    homeDir: join(root, "users", "adam"),
    project: (id) => {
      const p = projects[id];
      if (!p) throw new Error(`NOT_FOUND: ${id}`);
      return p;
    },
    onChange: (id) => changed.push(id),
    watch: () => ({ close: () => undefined }),
  });
  services.push(svc);
  return { root, repo, svc, changed };
}

describe("notes folder", () => {
  test("defaults to <folder>/notes, shown with ~ and relative to the project", () => {
    const { repo, svc } = setup();
    expect(svc.info("p1")).toEqual({ dir: join(repo, "notes"), displayDir: "~/goinfre/Kibo/notes", obsidian: false, folderRelative: "notes" });
  });
  test("without a project folder, notes live under KIBO_HOME/notes/<KEY>", () => {
    const { root, svc } = setup(null);
    expect(svc.info("p1")).toMatchObject({ dir: join(root, "kibo-home", "notes", "KIB"), folderRelative: null });
  });
  test("an Obsidian vault is recognised in the folder or a parent up to the project", async () => {
    const { repo, svc } = setup();
    mkdirSync(join(repo, ".obsidian"));
    expect(svc.info("p1").obsidian).toBe(true);
  });
  test("setDir accepts an existing absolute folder only", async () => {
    const { root, svc } = setup();
    const vault = join(root, "vault");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    await expect(svc.setDir("p1", "relative/path")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.setDir("p1", join(root, "absent"))).rejects.toThrow("INVALID_INPUT");
    const info: NotesInfo = await svc.setDir("p1", vault);
    expect(info).toMatchObject({ dir: vault, obsidian: true, folderRelative: null });
  });
});

describe("notes calls", () => {
  test("write, list, read, search, rename, remove, with change notifications", async () => {
    const { svc, changed } = setup();
    const a = (await svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# A\n\nVoir KIB-12.", expectedMtime: null })) as NoteMeta;
    await svc.handle("p1", { kind: "notes.write", path: "b.md", markdown: "# B\n\n[[a]]", expectedMtime: null });
    expect(a.tickets).toEqual(["KIB-12"]);
    const list = (await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[];
    expect(list.map((n) => [n.path, n.links])).toEqual(expect.arrayContaining([["b.md", ["a.md"]], ["a.md", []]]));
    const read = (await svc.handle("p1", { kind: "notes.read", path: "a.md" })) as NoteContent;
    expect(read.markdown).toBe("# A\n\nVoir KIB-12.");
    expect(((await svc.handle("p1", { kind: "notes.search", query: "voir" })) as NoteMeta[]).map((n) => n.path)).toEqual(["a.md"]);
    await svc.handle("p1", { kind: "notes.rename", from: "a.md", to: "archive/a.md" });
    await svc.handle("p1", { kind: "notes.remove", path: "b.md" });
    expect(((await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[]).map((n) => n.path)).toEqual(["archive/a.md"]);
    expect(changed.length).toBeGreaterThanOrEqual(4);
  });
  test("an external write is picked up by refresh and makes the old mtime conflict", async () => {
    const { repo, svc } = setup();
    const a = (await svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# A", expectedMtime: null })) as NoteMeta;
    writeFileSync(join(repo, "notes", "a.md"), "# Modifiée dans Obsidian");
    utimesSync(join(repo, "notes", "a.md"), new Date(), new Date(a.mtime + 5_000));
    await svc.refresh("p1");
    expect(((await svc.handle("p1", { kind: "list", entity: "note" })) as NoteMeta[])[0]?.title).toBe("Modifiée dans Obsidian");
    await expect(svc.handle("p1", { kind: "notes.write", path: "a.md", markdown: "# mine", expectedMtime: a.mtime })).rejects.toThrow("CONFLICT");
  });
  test("a missing folder lists nothing, and hostile paths never touch the disk", async () => {
    const { svc } = setup();
    expect(await svc.handle("p1", { kind: "list", entity: "note" })).toEqual([]);
    await expect(svc.handle("p1", { kind: "notes.read", path: "../x.md" })).rejects.toThrow("PATH_OUTSIDE_PROJECT");
  });
  test("non-note calls are refused", async () => {
    const { svc } = setup();
    await expect(svc.handle("p1", { kind: "data.keys" })).rejects.toThrow("INTERNAL");
  });
});
```
Note : `ComponentCall` valide les chemins par Zod côté RPC ; le service revérifie avec `resolveNotePath` (défense en profondeur), d'où le test `../x.md` appelé directement.

Run: `bun test packages/daemon/src/notes`
Expected: FAIL (modules `watch` et `service` absents).

- [x] **Step 5: Implémenter `watch.ts`**

```ts
import { watch as fsWatch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type WatchFn = (dir: string, onEvent: () => void) => { close(): void };
export type NotesWatcher = { close(): void; readonly polling: boolean };

const defaultWatch: WatchFn = (dir, onEvent) => {
  const w = fsWatch(dir, { recursive: true }, onEvent);
  return { close: () => w.close() };
};

async function signature(dir: string): Promise<string> {
  const parts: string[] = [];
  const walk = async (abs: string) => {
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith(".md")) parts.push(`${child}:${(await stat(child)).mtimeMs}`);
    }
  };
  await walk(dir);
  return parts.sort().join("\n");
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function watchNotes(
  dir: string,
  onChange: () => void,
  opts: { debounceMs?: number; pollMs?: number; watch?: WatchFn; log?: (line: string) => void } = {},
): NotesWatcher {
  const debounceMs = opts.debounceMs ?? 200;
  const log = opts.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };
  try {
    const handle = (opts.watch ?? defaultWatch)(dir, fire);
    return {
      polling: false,
      close: () => {
        if (timer) clearTimeout(timer);
        handle.close();
      },
    };
  } catch (e) {
    log(`fs.watch unavailable on ${dir} (${message(e)}): polling every ${opts.pollMs ?? 3_000} ms`);
  }
  let last: string | null = null;
  let busy = false;
  const poll = setInterval(() => {
    if (busy) return;
    busy = true;
    signature(dir)
      .then((sig) => {
        if (last !== null && sig !== last) fire();
        last = sig;
      })
      .catch((e: unknown) => log(`polling ${dir} failed: ${message(e)}`))
      .finally(() => {
        busy = false;
      });
  }, opts.pollMs ?? 3_000);
  return {
    polling: true,
    close: () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
    },
  };
}
```

- [x] **Step 6: Implémenter `service.ts`**

```ts
import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { type ComponentCall, KiboError, type NoteContent, type NoteMeta, type NotesInfo } from "@kibo/schema";
import { createNotesIndex, type IndexedNote } from "./index";
import { listNoteFiles, readNoteFile, removeNoteFile, renameNoteFile, writeNoteFile } from "./notes-fs";
import { createProjectSettings } from "./settings";
import { type NotesWatcher, type WatchFn, watchNotes } from "./watch";

export type NotesProject = { id: string; key: string; folder: string | null };
export type NotesServiceDeps = {
  db: Database;
  home: string;
  homeDir?: string;
  project(projectId: string): NotesProject;
  onChange?: (projectId: string) => void;
  watch?: WatchFn;
  debounceMs?: number;
};
export type NotesService = {
  info(projectId: string): NotesInfo;
  setDir(projectId: string, dir: string): Promise<NotesInfo>;
  handle(projectId: string, call: ComponentCall): Promise<unknown>;
  refresh(projectId: string): Promise<void>;
  close(): void;
};

const inside = (parent: string, child: string) => child === parent || child.startsWith(parent + sep);
const isDirectory = async (p: string) => {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
};

export function createNotesService(deps: NotesServiceDeps): NotesService {
  const settings = createProjectSettings(deps.db);
  const index = createNotesIndex(deps.db);
  const homeDir = deps.homeDir ?? homedir();
  const indexed = new Set<string>();
  const watchers = new Map<string, NotesWatcher>();

  const dirOf = (projectId: string): string => {
    const saved = settings.get(projectId, "notesDir");
    if (saved) return saved;
    const p = deps.project(projectId);
    return p.folder ? join(p.folder, "notes") : join(deps.home, "notes", p.key);
  };

  const info = (projectId: string): NotesInfo => {
    const dir = dirOf(projectId);
    const folder = deps.project(projectId).folder;
    let obsidian = false;
    for (let d = dir; ; d = dirname(d)) {
      if (existsSync(join(d, ".obsidian"))) {
        obsidian = true;
        break;
      }
      if (!folder || !inside(folder, d) || d === folder || dirname(d) === d) break;
    }
    return {
      dir,
      displayDir: inside(homeDir, dir) ? `~${dir.slice(homeDir.length)}` : dir,
      obsidian,
      folderRelative: folder && inside(folder, dir) ? relative(folder, dir) || "." : null,
    };
  };

  const refresh = async (projectId: string): Promise<void> => {
    const dir = dirOf(projectId);
    const notes: IndexedNote[] = [];
    if (await isDirectory(dir)) {
      for (const path of await listNoteFiles(dir)) {
        try {
          const file = await readNoteFile(dir, path);
          notes.push({ path, markdown: file.markdown, mtime: file.mtime, size: file.size });
        } catch (e) {
          if (!(e instanceof KiboError && (e.code === "NOT_FOUND" || e.code === "QUOTA_EXCEEDED"))) throw e;
          console.error(`[kibo-daemon] note ${path} skipped: ${e.message}`);
        }
      }
      if (!watchers.has(projectId)) {
        const w = watchNotes(
          dir,
          () => {
            refresh(projectId).catch((e: unknown) => console.error(`[kibo-daemon] notes refresh failed: ${String(e)}`));
          },
          { ...(deps.watch && { watch: deps.watch }), ...(deps.debounceMs !== undefined && { debounceMs: deps.debounceMs }) },
        );
        watchers.set(projectId, w);
      }
    }
    index.replace(projectId, deps.project(projectId).key, notes);
    indexed.add(projectId);
    deps.onChange?.(projectId);
  };

  const ensure = async (projectId: string) => {
    if (!indexed.has(projectId)) await refresh(projectId);
  };
  const metaOf = async (projectId: string, path: string): Promise<NoteMeta> => {
    await refresh(projectId);
    const meta = index.get(projectId, path);
    if (!meta) throw new KiboError("NOT_FOUND", `note ${path} not found`);
    return meta;
  };

  return {
    info,
    async setDir(projectId, dir) {
      if (!isAbsolute(dir) || !(await isDirectory(dir))) throw new KiboError("INVALID_INPUT", `${dir} is not an existing folder`);
      settings.set(projectId, "notesDir", dir);
      watchers.get(projectId)?.close();
      watchers.delete(projectId);
      await refresh(projectId);
      return info(projectId);
    },
    async handle(projectId, call) {
      const dir = dirOf(projectId);
      switch (call.kind) {
        case "list":
          if (call.entity !== "note") break;
          await ensure(projectId);
          return index.list(projectId);
        case "notes.read": {
          const file = await readNoteFile(dir, call.path);
          await ensure(projectId);
          const meta = index.get(projectId, call.path) ?? (await metaOf(projectId, call.path));
          const content: NoteContent = { ...meta, mtime: file.mtime, size: file.size, markdown: file.markdown };
          return content;
        }
        case "notes.write":
          if (!(await isDirectory(dir))) await Bun.write(join(dir, ".keep"), "");
          await writeNoteFile(dir, call.path, call.markdown, call.expectedMtime);
          return metaOf(projectId, call.path);
        case "notes.rename":
          await renameNoteFile(dir, call.from, call.to);
          return metaOf(projectId, call.to);
        case "notes.remove":
          await removeNoteFile(dir, call.path);
          await refresh(projectId);
          return null;
        case "notes.search":
          await ensure(projectId);
          return index.search(projectId, call.query);
        case "notes.info":
          return info(projectId);
      }
      throw new KiboError("INTERNAL", `${call.kind} is not a notes call`);
    },
    refresh,
    close() {
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
```
`Bun.write` d'un fichier caché `.keep` crée le dossier par défaut (et ses parents) à la première écriture seulement : lire ne crée jamais rien sur le disque. `isDirectory` renvoie `false` sur toute erreur de `stat` : c'est la question posée (« ce dossier est-il utilisable ? »), l'erreur n'est pas perdue puisque l'appelant répond `INVALID_INPUT` ou une liste vide.

- [x] **Step 7: Vérifier et committer**

Run: `bun test packages/daemon/src/notes && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/notes
git commit -m "feat(daemon): notes Markdown indexées"
```

---

### Task 19: UI, confiance (écran 30), catalogue (écran 3) et création (écran 29)

**Files:**
- Create: `packages/ui/src/state/use-components.ts`, `packages/ui/src/lib/permission-lines.ts`, `packages/ui/src/lib/permission-lines.test.ts`, `packages/ui/src/dialogs/TrustDialog.tsx`, `packages/ui/src/dialogs/CreateComponentDialog.tsx`, `packages/ui/src/dialogs/ComponentPreview.tsx`, `packages/ui/src/dialogs/component-dialogs.test.tsx`
- Modify: `packages/ui/src/dialogs/AddComponentDialog.tsx` (réécrit), `packages/ui/src/dialogs/dialogs.test.tsx` (tests `AddComponentDialog` déplacés), `packages/ui/src/i18n/fr.ts` (section `addComponent` seulement)

**Interfaces:**
- Consumes: `client.rpc` (`listComponents`, `listDrafts`, `approveComponent`, `command/addInstance`) ; `ComponentSummary`, `ComponentVersionSummary`, `DraftSummary`, `GrantedPermissions`, `grantedOf`, `RegistryVersion`, `shortHash`, `ComponentOrigin`, `KiboError` (tâche 2) ; `BUILTIN_COMPONENTS`, `componentIcon`, `componentRef` (`registry.ts`) ; `ChoiceCard` ; `fr.addComponent`, `fr.trust`, `fr.createComponent`.
- Produces:
  - `useComponents(): { components: ComponentSummary[] | null; drafts: DraftSummary[] | null; error: boolean; reload(): void }` (recharge sur `client.subscribe(null)`).
  - `type PermissionLine = { icon: LucideIcon; title: string; detail?: string }` ; `permissionLines(g: GrantedPermissions): PermissionLine[]`.
  - `type TrustTarget = { id: string; title: string; version: string; hash: string; origin: ComponentOrigin; permissions: GrantedPermissions }` ; `TrustDialog({ target, mode: "approve" | "approveAndAdd", open, onOpenChange, onApproved(v: RegistryVersion) })`.
  - `AddComponentDialog({ projectId, page, taken, open, onOpenChange, onPublishDraft? })` : `onPublishDraft(id)` affiché seulement s'il est fourni (branché en tâche 28).
  - `CreateComponentDialog({ open, onOpenChange })`.
  - `trustTargetOf(id, title, v: ComponentVersionSummary): TrustTarget | null` (exportée par `TrustDialog.tsx`, réutilisée par les tâches 24 et 28).

Fidélité : écran 3 (page 7 du PDF), écran 29 (page 11), écran 30 (page 12). Écran 3 : champ « Rechercher un composant… » avec icône loupe ; sections en petites capitales « INTÉGRÉS » puis « MES COMPOSANTS » ; chaque ligne = icône dans un carré `size-8 rounded-md border`, titre, description sur une ligne, version en `font-mono text-xs` dans une pastille bordée à droite ; ligne pointillée « Créer un composant (code ou IA) » avec icône `Sparkles` ; colonne droite : aperçu schématique, titre, description, « Affichage » (une seule option, pleine largeur, selon le type de page), « Source des tickets » (segmenté « Local (Kibo) » actif et « Synchronisé · GitHub Issues » désactivé jusqu'à la phase 5, affiché seulement si le composant lit `ticket`), ligne verte avec coche « Intégré · confiance totale · lit et écrit : ticket, status ». Si une phase antérieure a ajouté un intégré « Mes tickets » à `BUILTIN_COMPONENTS`, il apparaît naturellement (aucun code spécifique).

- [x] **Step 1: Ajuster les textes de `fr.addComponent`**

Dans `packages/ui/src/i18n/fr.ts`, section `addComponent` uniquement : remplacer `builtinTrust` et `mineLine`, ajouter `source`, `sourceLocal`, `sourceSynced`, `sourceSoon`, `pendingTrust` :
```ts
    builtinTrust: (reads: string[], writes: string[]) => {
      const same = reads.length > 0 && reads.join() === writes.join();
      if (same) return `Intégré · confiance totale · lit et écrit : ${reads.join(", ")}`;
      return `Intégré · confiance totale · lit : ${reads.join(", ") || "rien"}${writes.length ? ` · écrit : ${writes.join(", ")}` : ""}`;
    },
    mineLine: (origin: string, trust: string, hosts: string[]) => [origin, trust, ...hosts].join(" · "),
    source: "Source des tickets",
    sourceLocal: "Local (Kibo)",
    sourceSynced: "Synchronisé · GitHub Issues",
    sourceSoon: "Disponible avec les intégrations",
    pendingTrust: "Autorisation requise",
```
Les hôtes réseau sont affichés par leur nom court : `api.github.com/graphql` ⇒ « GitHub » via une table `{ "api.github.com": "GitHub", "gitlab.com": "GitLab", "linear.app": "Linear" }` dans `AddComponentDialog.tsx`, sinon l'hôte brut.

- [x] **Step 2: Écrire les tests des lignes de permissions**

`packages/ui/src/lib/permission-lines.test.ts` :
```ts
import { expect, test } from "bun:test";
import { NO_PERMISSIONS } from "@kibo/schema";
import { permissionLines } from "./permission-lines";

const titles = (g: Parameters<typeof permissionLines>[0]) => permissionLines(g).map((l) => [l.title, l.detail ?? null]);

test("screen 30: tickets, own data, no network and no files", () => {
  expect(titles({ ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true })).toEqual([
    ["Lire les tickets du projet", "entités : ticket, status"],
    ["Stocker ses propres données", "espace de nommage de l'instance uniquement"],
    ["Aucun accès réseau, aucun fichier local", null],
  ]);
});

test("writes, notes and network are spelled out", () => {
  expect(
    titles({ reads: ["note", "page"], writes: ["ticket", "note"], data: false, net: ["api.github.com/graphql"] }),
  ).toEqual([
    ["Lire les données du projet", "entités : page"],
    ["Lire les notes du projet", null],
    ["Modifier les données du projet", "entités : ticket, note"],
    ["Accéder au réseau", "HTTPS via le démon uniquement : api.github.com/graphql"],
    ["Aucun fichier local", null],
  ]);
  expect(titles({ ...NO_PERMISSIONS, reads: ["note"] }).at(-1)).toEqual(["Aucun accès réseau", null]);
});
```

Run: `bun test packages/ui/src/lib/permission-lines.test.ts`
Expected: FAIL.

- [x] **Step 3: Implémenter `permission-lines.ts` et `use-components.ts`**

`packages/ui/src/lib/permission-lines.ts` :
```ts
import type { GrantedPermissions } from "@kibo/schema";
import { Database, File, Globe, type LucideIcon, NotebookText, Pencil, Ticket, X } from "lucide-react";
import { fr } from "../i18n/fr";

export type PermissionLine = { icon: LucideIcon; title: string; detail?: string };

export function permissionLines(g: GrantedPermissions): PermissionLine[] {
  const t = fr.trust;
  const lines: PermissionLine[] = [];
  const reads = g.reads.filter((e) => e !== "note");
  if (reads.length > 0) {
    lines.push({
      icon: reads.includes("ticket") ? Ticket : Database,
      title: reads.includes("ticket") ? t.readTickets : t.readData,
      detail: t.entities(reads.join(", ")),
    });
  }
  if (g.reads.includes("note")) lines.push({ icon: NotebookText, title: t.readNotes });
  if (g.writes.length > 0) lines.push({ icon: Pencil, title: t.writeData, detail: t.entities(g.writes.join(", ")) });
  if (g.data) lines.push({ icon: File, title: t.ownData, detail: t.ownDataHelp });
  if (g.net.length > 0) lines.push({ icon: Globe, title: t.network, detail: t.networkHelp(g.net.join(", ")) });
  const notes = g.reads.includes("note") || g.writes.includes("note");
  if (g.net.length === 0 && !notes) lines.push({ icon: X, title: t.noNetworkNoFiles });
  else if (g.net.length === 0) lines.push({ icon: X, title: t.noNetwork });
  else if (!notes) lines.push({ icon: X, title: t.noFiles });
  return lines;
}
```

`packages/ui/src/state/use-components.ts` :
```ts
import { type ComponentSummary, type DraftSummary, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export type ComponentsState = {
  components: ComponentSummary[] | null;
  drafts: DraftSummary[] | null;
  error: boolean;
  reload(): void;
};

export function useComponents(): ComponentsState {
  const [components, setComponents] = useState<ComponentSummary[] | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    Promise.all([client.rpc({ method: "listComponents" }), client.rpc({ method: "listDrafts" })]).then(
      ([c, d]) => {
        setComponents(c);
        setDrafts(d);
        setError(false);
      },
      (e: unknown) => {
        if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
        console.error(e);
        setError(true);
      },
    );
  }, []);
  useEffect(() => {
    reload();
    return client.subscribe((id) => {
      if (id === null) reload();
    });
  }, [reload]);
  return { components, drafts, error, reload };
}
```

Run: `bun test packages/ui/src/lib/permission-lines.test.ts`
Expected: PASS.

- [x] **Step 4: Écrire les tests des dialogues**

Retirer de `packages/ui/src/dialogs/dialogs.test.tsx` les trois tests `AddComponentDialog…` et l'import correspondant (ils sont réécrits ci-dessous).

`packages/ui/src/dialogs/component-dialogs.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentSummary,
  type DraftSummary,
  KiboError,
  NO_PERMISSIONS,
  type RegistryVersion,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
const HASH = "3f9a".padEnd(60, "0") + "c21e";
let components: ComponentSummary[] = [];
let drafts: DraftSummary[] = [];
let approve: () => Promise<unknown> = () => Promise.resolve(null);
let add: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "listDrafts") return Promise.resolve(drafts);
      if (req.method === "approveComponent") return approve();
      return add();
    },
    subscribe: () => () => undefined,
  },
}));

const { AddComponentDialog } = await import("./AddComponentDialog");
const { TrustDialog } = await import("./TrustDialog");
const { CreateComponentDialog } = await import("./CreateComponentDialog");

const burndown: ComponentSummary = {
  id: "burndown",
  title: "Burndown",
  builtin: false,
  versions: [
    {
      version: "0.1.0",
      hash: HASH,
      trust: null,
      origin: "ai",
      active: false,
      tampered: false,
      manifest: {
        id: "burndown",
        version: "0.1.0",
        kind: "widget",
        title: "Burndown",
        description: "Tickets restants par jour",
        reads: ["ticket", "status"],
        writes: [],
        data: true,
        net: [],
        configVersion: 0,
        changes: [],
        sdk: 1,
      },
      usages: [],
    },
  ],
};
const approved: RegistryVersion = {
  version: "0.1.0",
  hash: HASH,
  origin: "ai",
  trust: "sandboxed",
  approvedHash: HASH,
  granted: { ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true },
  publishedAt: 1,
  autoUpdate: false,
};
const page = { id: "pg1", title: "Tableau de bord", kind: "dashboard", parentId: null } as const;

beforeEach(() => {
  calls.length = 0;
  components = [burndown];
  drafts = [];
  approve = () => Promise.resolve(approved);
  add = () => Promise.resolve(null);
});

test("screen 3: built-ins and my components, search, preview and display", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(await screen.findByRole("radio", { name: "Burndown" })).toBeTruthy();
  expect(screen.getByText("Intégrés")).toBeTruthy();
  expect(screen.getByText("Mes composants")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(screen.getByText("Widget dans la grille")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Synchronisé · GitHub Issues" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Intégré · confiance totale · lit : ticket, status · écrit : ticket")).toBeTruthy();
  await user.type(screen.getByPlaceholderText("Rechercher un composant…"), "burn");
  expect(screen.queryByRole("radio", { name: "Kanban" })).toBeNull();
  await user.clear(screen.getByPlaceholderText("Rechercher un composant…"));
  await user.type(screen.getByPlaceholderText("Rechercher un composant…"), "zzz");
  expect(screen.getByText("Aucun composant ne correspond.")).toBeTruthy();
});

test("a built-in is added directly in the next free slot", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[{ x: 0, y: 0, w: 6, h: 6 }]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: { method: "addInstance", pageId: "pg1", component: "kanban@1.0.0", layout: { x: 6, y: 0, w: 6, h: 6 } },
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a component that is not approved goes through screen 30 before being added", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Burndown" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(await screen.findByText("Autoriser « Burndown » 0.1.0 ?")).toBeTruthy();
  expect(screen.getByText("Composant généré par IA · empreinte sha256 3f9a…c21e · vérifiée par le démon")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  await waitFor(() => expect(calls.some((c) => c.method === "command")).toBe(true));
  expect(calls.filter((c) => c.method !== "listComponents" && c.method !== "listDrafts")).toEqual([
    { method: "approveComponent", id: "burndown", version: "0.1.0", hash: HASH, trust: "sandboxed" },
    { method: "command", projectId: "p1", command: { method: "addInstance", pageId: "pg1", component: "burndown@0.1.0", layout: { x: 0, y: 0, w: 6, h: 6 } } },
  ]);
});

test("refusing on screen 30 adds nothing", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Burndown" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  await user.click(await screen.findByRole("button", { name: "Refuser" }));
  expect(calls.some((c) => c.method === "approveComponent" || c.method === "command")).toBe(false);
});

test("TrustDialog: full trust is a choice, a changed hash is explained", async () => {
  const onApproved = mock((_: RegistryVersion) => {});
  const target = { id: "burndown", title: "Burndown", version: "0.1.0", hash: HASH, origin: "ai" as const, permissions: approved.granted };
  render(<TrustDialog target={target} mode="approve" open onOpenChange={() => {}} onApproved={onApproved} />);
  const user = userEvent.setup();
  expect(screen.getByText("Lire les tickets du projet")).toBeTruthy();
  expect(screen.getByText("Aucun accès réseau, aucun fichier local")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Sandboxé \(recommandé\)/ }).getAttribute("data-state")).toBe("checked");
  await user.click(screen.getByRole("radio", { name: /Confiance totale/ }));
  approve = () => Promise.reject(new KiboError("HASH_MISMATCH", "changed"));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Le code a changé depuis l'ouverture de cette fenêtre : vérifie la nouvelle empreinte.",
  );
  expect(calls.at(-1)).toMatchObject({ method: "approveComponent", trust: "trusted" });
  approve = () => Promise.resolve(approved);
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(onApproved).toHaveBeenCalledWith(approved));
});

test("a validated draft shows Publier only when the page can publish", async () => {
  drafts = [{ id: "burndown", title: "Burndown", version: "0.2.0", hash: HASH, validated: true, publishedVersion: "0.1.0" }];
  const onPublishDraft = mock((_: string) => {});
  const { unmount } = render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} onPublishDraft={onPublishDraft} />);
  const user = userEvent.setup();
  expect(await screen.findByText("Brouillon")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Publier" }));
  expect(onPublishDraft).toHaveBeenCalledWith("burndown");
  unmount();
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  await screen.findByText("Brouillon");
  expect(screen.queryByRole("button", { name: "Publier" })).toBeNull();
});

test("a failure to load or add is shown, never swallowed", async () => {
  add = () => Promise.reject(new KiboError("INTERNAL", "boom"));
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ajouter le composant.");
});

test("screen 29: the AI column waits for phase 6, commands can be copied", async () => {
  const writes: string[] = [];
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => writes.push(t) }, configurable: true });
  render(<CreateComponentDialog open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(screen.getByRole("button", { name: /Générer avec un agent/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Bientôt")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Copier les commandes" }));
  expect(writes).toEqual(["kibo component new burndown\nkibo component test burndown\nkibo component dev burndown"]);
  expect(await screen.findByText("Commandes copiées.")).toBeTruthy();
  expect(screen.getAllByText(/^\d · /).map((e) => e.textContent)).toEqual([
    "1 · Décrire",
    "2 · Générer (agent)",
    "3 · Tests de conformité",
    "4 · Permissions",
    "5 · Ajouter à la page",
  ]);
});
```

Run: `bun test packages/ui/src/dialogs/component-dialogs.test.tsx`
Expected: FAIL.

- [x] **Step 5: Implémenter `TrustDialog.tsx`**

```tsx
import {
  type ComponentOrigin,
  type ComponentVersionSummary,
  type GrantedPermissions,
  grantedOf,
  KiboError,
  type RegistryVersion,
  shortHash,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { permissionLines } from "../lib/permission-lines";

export type TrustTarget = {
  id: string;
  title: string;
  version: string;
  hash: string;
  origin: ComponentOrigin;
  permissions: GrantedPermissions;
};

export function trustTargetOf(id: string, title: string, v: ComponentVersionSummary): TrustTarget | null {
  if (!v.hash || !v.manifest) return null;
  return { id, title, version: v.version, hash: v.hash, origin: v.origin, permissions: grantedOf(v.manifest) };
}

type Props = {
  target: TrustTarget;
  mode: "approve" | "approveAndAdd";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApproved: (v: RegistryVersion) => void;
};

function LevelCard({ value, title, help }: { value: "sandboxed" | "trusted"; title: string; help: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground/70"
    >
      <RadioGroupItem id={id} value={value} aria-label={title} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="text-sm font-medium leading-none">{title}</span>
        <span className="text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}

export function TrustDialog({ target, mode, open, onOpenChange, onApproved }: Props) {
  const t = fr.trust;
  const [level, setLevel] = useState<"sandboxed" | "trusted">("sandboxed");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await client.rpc({ method: "approveComponent", id: target.id, version: target.version, hash: target.hash, trust: level });
      onApproved(v);
      onOpenChange(false);
    } catch (e) {
      if (!(e instanceof KiboError)) console.error(e);
      setError(e instanceof KiboError && e.code === "HASH_MISMATCH" ? t.hashMismatch : t.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.title(target.title, target.version)}</DialogTitle>
          <DialogDescription>{t.subtitle(t.origin[target.origin], shortHash(target.hash))}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{t.asks}</p>
        <ul className="grid gap-3 rounded-lg border p-4">
          {permissionLines(target.permissions).map((line) => (
            <li key={line.title} className="flex items-start gap-3">
              <line.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="grid gap-0.5">
                <span className="text-sm">{line.title}</span>
                {line.detail && <span className="text-xs text-muted-foreground">{line.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium">{t.level}</p>
        <RadioGroup value={level} onValueChange={(v) => setLevel(v === "trusted" ? "trusted" : "sandboxed")} className="grid gap-2">
          <LevelCard value="sandboxed" title={t.sandboxed} help={t.sandboxedHelp} />
          <LevelCard value="trusted" title={t.trusted} help={t.trustedHelp} />
        </RadioGroup>
        <p className="text-xs text-muted-foreground">{t.footer}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.refuse}
          </Button>
          <Button disabled={busy} onClick={() => void approve()}>
            {mode === "approveAndAdd" ? t.approveAndAdd : t.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 6: Implémenter `ComponentPreview.tsx` et `CreateComponentDialog.tsx`**

`packages/ui/src/dialogs/ComponentPreview.tsx` (aperçu schématique de l'écran 3, couleurs des statuts du workflow par défaut) :
```tsx
import type { LucideIcon } from "lucide-react";

const DOTS = ["bg-zinc-400", "bg-blue-500", "bg-violet-500", "bg-green-500"];

function Bars({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-5 rounded-sm bg-muted" />
      ))}
    </>
  );
}

export function ComponentPreview({ id, icon: Icon }: { id: string; icon: LucideIcon }) {
  if (id === "kanban") {
    return (
      <div aria-hidden className="grid h-36 grid-cols-4 gap-2 rounded-lg bg-muted/60 p-2">
        {DOTS.map((dot, i) => (
          <div key={dot} className="grid content-start gap-1.5 rounded-md bg-background/60 p-1.5">
            <span className={`size-1.5 rounded-full ${dot}`} />
            <Bars n={[2, 3, 1, 2][i] ?? 1} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "tickets" || id === "notes") {
    return (
      <div aria-hidden className="grid h-36 content-start gap-1.5 rounded-lg bg-muted/60 p-3">
        <Bars n={5} />
      </div>
    );
  }
  if (id === "graph") {
    return (
      <svg aria-hidden viewBox="0 0 240 110" className="h-36 w-full rounded-lg bg-muted/60 text-muted-foreground">
        <path d="M60 30 H110 M60 30 L110 80 M150 30 H190" stroke="currentColor" fill="none" />
        {[
          [20, 20],
          [110, 20],
          [110, 70],
          [190, 20],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="40" height="20" rx="4" className="fill-background" />
        ))}
      </svg>
    );
  }
  return (
    <div aria-hidden className="grid h-36 place-items-center rounded-lg bg-muted/60">
      <Icon className="size-8 text-muted-foreground" />
    </div>
  );
}
```

`packages/ui/src/dialogs/CreateComponentDialog.tsx` :
```tsx
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot, Copy, Sparkles, SquareTerminal } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";

const COMMANDS = ["kibo component new burndown", "kibo component test burndown", "kibo component dev burndown"];

export function CreateComponentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = fr.createComponent;
  const describeId = useId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      setCopied(true);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <section aria-disabled className="grid content-start gap-3 rounded-lg border p-4 opacity-70">
            <h3 className="flex items-center gap-2 font-semibold">
              <Sparkles aria-hidden className="size-4" />
              {t.ai}
              <Badge variant="secondary">{t.soon}</Badge>
            </h3>
            <Label htmlFor={describeId}>{t.aiLabel}</Label>
            <Textarea id={describeId} disabled placeholder={t.aiPlaceholder} />
            <p className="text-xs text-muted-foreground">{t.aiHelp}</p>
            <Button disabled className="w-fit bg-orange-600 text-white hover:bg-orange-600/90 dark:bg-orange-500">
              <Bot aria-hidden />
              {t.aiSubmit}
            </Button>
          </section>
          <section className="grid content-start gap-3 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <SquareTerminal aria-hidden className="size-4" />
              {t.code}
            </h3>
            <p className="text-sm text-muted-foreground">{t.codeHelp}</p>
            <div className="relative rounded-md border bg-muted/40 p-3 pr-10 font-mono text-xs">
              {COMMANDS.map((c) => (
                <div key={c}>$ {c}</div>
              ))}
              <Button
                size="icon"
                variant="ghost"
                aria-label={t.copy}
                className="absolute top-1.5 right-1.5 size-7"
                onClick={() => void copy()}
              >
                <Copy aria-hidden />
              </Button>
            </div>
            {copied && <p className="text-xs text-muted-foreground">{t.copied}</p>}
            {failed && (
              <p role="alert" className="text-xs text-destructive">
                {fr.common.error}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t.codeFooter}</p>
          </section>
        </div>
        <ol className="flex flex-wrap gap-2">
          {t.steps.map((s, i) => (
            <li key={s} className={`rounded-md border px-2 py-1 text-xs ${i === 0 ? "bg-accent" : "text-muted-foreground"}`}>
              {s}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
```
L'orange est réservé aux agents : le bouton « Générer avec un agent » l'est, désactivé jusqu'à la phase 6 qui branchera la génération.

- [x] **Step 7: Réécrire `AddComponentDialog.tsx`**

```tsx
import type { ComponentVersionSummary, Layout, Page } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Blocks, Check, Search, Sparkles } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { nextLayout } from "../lib/next-layout";
import { BUILTIN_COMPONENTS, componentIcon, componentRef } from "../registry";
import { useComponents } from "../state/use-components";
import { ChoiceCard } from "./ChoiceCard";
import { ComponentPreview } from "./ComponentPreview";
import { CreateComponentDialog } from "./CreateComponentDialog";
import { type TrustTarget, TrustDialog, trustTargetOf } from "./TrustDialog";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublishDraft?: (id: string) => void;
};

type Choice = {
  ref: string;
  id: string;
  title: string;
  description: string | undefined;
  version: string;
  reads: string[];
  writes: string[];
  builtin: boolean;
  line: string;
  pending: ComponentVersionSummary | null;
};

const HOSTS: Record<string, string> = { "api.github.com": "GitHub", "gitlab.com": "GitLab", "linear.app": "Linear" };
const hostLabel = (rule: string) => {
  const host = rule.split("/")[0] ?? rule;
  return HOSTS[host] ?? host;
};
function Section({ label }: { label: string }) {
  return <p className="pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>;
}
const version = (v: string) => <span className="rounded border px-1.5 font-mono text-xs text-muted-foreground">{v}</span>;
const matches = (c: Choice, q: string) => `${c.title} ${c.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());

function Segment({ options, value }: { options: { value: string; label: string; disabled?: boolean }[]; value: string }) {
  const base = useId();
  return (
    <RadioGroup value={value} className="grid grid-flow-col gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <label
          key={o.value}
          htmlFor={`${base}-${o.value}`}
          className={`flex items-center justify-center rounded-sm px-3 py-1.5 text-sm has-[[data-state=checked]]:bg-background has-[[data-state=checked]]:shadow-xs ${
            o.disabled ? "cursor-not-allowed text-muted-foreground" : ""
          }`}
          title={o.disabled ? fr.addComponent.sourceSoon : undefined}
        >
          <RadioGroupItem id={`${base}-${o.value}`} value={o.value} aria-label={o.label} disabled={o.disabled} className="sr-only" />
          {o.label}
        </label>
      ))}
    </RadioGroup>
  );
}

export function AddComponentDialog({ projectId, page, taken, open, onOpenChange, onPublishDraft }: Props) {
  const a = fr.addComponent;
  const { components, drafts, error } = useComponents();
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const builtins: Choice[] = BUILTIN_COMPONENTS.map(({ manifest: m }) => ({
    ref: componentRef(m),
    id: m.id,
    title: m.title,
    description: m.description,
    version: m.version,
    reads: m.reads,
    writes: m.writes,
    builtin: true,
    line: a.builtinTrust(m.reads, m.writes),
    pending: null,
  }));
  const mine: Choice[] = useMemo(
    () =>
      (components ?? [])
        .filter((c) => !c.builtin)
        .flatMap((c) => {
          const v = [...c.versions].reverse().find((x) => x.manifest !== null && !x.tampered) ?? null;
          if (!v?.manifest) return [];
          const trustLabel = v.active && v.trust ? fr.components.trust[v.trust].toLowerCase() : a.pendingTrust;
          return [
            {
              ref: `${c.id}@${v.version}`,
              id: c.id,
              title: c.title,
              description: v.manifest.description,
              version: v.version,
              reads: v.manifest.reads,
              writes: v.manifest.writes,
              builtin: false,
              line: a.mineLine(fr.components.origin[v.origin], trustLabel, v.manifest.net.map(hostLabel)),
              pending: v.active ? null : v,
            },
          ];
        }),
    [components, a],
  );
  const shownBuiltins = builtins.filter((c) => matches(c, query));
  const shownMine = mine.filter((c) => matches(c, query));
  const shownDrafts = (drafts ?? []).filter((d) => d.validated && d.title.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = [...builtins, ...mine].find((c) => c.ref === ref) ?? null;
  const selectedIcon = selected ? componentIcon(selected.ref) : Blocks;

  const addInstance = async (component: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
        },
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  const submit = () => {
    if (!selected) return;
    if (selected.pending) {
      const target = trustTargetOf(selected.id, selected.title, selected.pending);
      if (target) setTrust(target);
      return;
    }
    void addInstance(selected.ref);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{a.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-1">
              <div className="relative">
                <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input className="pl-8" placeholder={a.search} aria-label={a.search} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <RadioGroup value={ref ?? ""} onValueChange={setRef} className="grid gap-1">
                {shownBuiltins.length > 0 && <Section label={a.builtin} />}
                {shownBuiltins.map((c) => (
                  <ChoiceCard key={c.ref} value={c.ref} icon={componentIcon(c.ref)} title={c.title} description={c.description} aside={version(c.version)} />
                ))}
                {(shownMine.length > 0 || shownDrafts.length > 0) && <Section label={a.mine} />}
                {shownMine.map((c) => (
                  <ChoiceCard key={c.ref} value={c.ref} icon={Blocks} title={c.title} description={c.line} aside={version(c.version)} />
                ))}
              </RadioGroup>
              {shownDrafts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2">
                  <Blocks aria-hidden className="size-4 shrink-0" />
                  <span className="flex flex-1 items-center gap-2 text-sm font-medium">
                    {d.title}
                    <Badge variant="secondary">{a.draft}</Badge>
                  </span>
                  {onPublishDraft ? (
                    <Button size="sm" variant="outline" onClick={() => onPublishDraft(d.id)}>
                      {a.publish}
                    </Button>
                  ) : (
                    version(d.version)
                  )}
                </div>
              ))}
              {shownBuiltins.length + shownMine.length + shownDrafts.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{a.noResult}</p>
              )}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
              >
                <Sparkles aria-hidden className="size-4" />
                {a.create}
              </button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {a.loadFailed}
                </p>
              )}
            </div>
            <div className="grid content-start gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
              {selected ? (
                <>
                  <ComponentPreview id={selected.id} icon={selectedIcon} />
                  <div className="grid gap-1">
                    <p className="text-base font-semibold">{selected.title}</p>
                    {selected.description && <p className="text-muted-foreground">{selected.description}</p>}
                  </div>
                  <div className="grid gap-2">
                    <p className="font-medium">{a.display}</p>
                    <Segment
                      value={page.kind}
                      options={[{ value: page.kind, label: page.kind === "dashboard" ? a.widget : a.view }]}
                    />
                  </div>
                  {selected.reads.includes("ticket") && (
                    <div className="grid gap-2">
                      <p className="font-medium">{a.source}</p>
                      <Segment
                        value="local"
                        options={[
                          { value: "local", label: a.sourceLocal },
                          { value: "synced", label: a.sourceSynced, disabled: true },
                        ]}
                      />
                    </div>
                  )}
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check aria-hidden className="size-3.5 text-green-600 dark:text-green-400" />
                    {selected.line}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">{a.pick}</p>
              )}
            </div>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {a.failed}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button disabled={!selected} onClick={submit}>
              {a.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {trust && (
        <TrustDialog
          target={trust}
          mode="approveAndAdd"
          open
          onOpenChange={(o) => !o && setTrust(null)}
          onApproved={(v) => void addInstance(`${trust.id}@${v.version}`)}
        />
      )}
      <CreateComponentDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
```
Choix de la version d'un composant tiers : la plus haute version non altérée ; si elle n'est pas active, la sélection mène à l'écran 30 puis à l'ajout. La ligne d'un composant tiers reprend la maquette (« IA · sandboxé · GitHub ») : origine, niveau de confiance en minuscules, hôtes réseau.

Écart assumé avec la maquette : l'écran 3 écrit « lit et écrit : ticket, status » pour Kanban, alors que son manifeste n'écrit que `ticket`. Le texte affiché suit le manifeste (« lit : ticket, status · écrit : ticket ») : un résumé de permissions faux serait un défaut de sécurité. Le chef corrige la maquette au jalon.

- [x] **Step 8: Vérifier et committer**

Run: `bun test packages/ui && bun run typecheck && bun run check`
Expected: PASS (dont `dialogs.test.tsx` sans les tests déplacés).

```bash
git add packages/ui/src/state/use-components.ts packages/ui/src/lib/permission-lines.ts packages/ui/src/lib/permission-lines.test.ts packages/ui/src/dialogs packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): catalogue, confiance et création"
```

---

### Task 20: Devkit, validation complète d'un composant

**Files:**
- Create: `packages/devkit/src/validate.ts`, `packages/devkit/src/fr.ts`, `packages/devkit/src/validate.test.ts`, `packages/devkit/src/fr.test.ts`
- Create: `packages/devkit/fixtures/bad-import/{kibo.component.json,ui.tsx,component.test.tsx.fixture}`, `packages/devkit/fixtures/non-literal/{kibo.component.json,ui.tsx,component.test.tsx.fixture}`, `packages/devkit/fixtures/undeclared/{kibo.component.json,ui.tsx,component.test.tsx.fixture}`, `packages/devkit/fixtures/failing/{kibo.component.json,ui.tsx,component.test.tsx.fixture}`
- Modify: `packages/devkit/src/index.ts`

**Interfaces:**
- Consumes: `Toolchain`, `loadTypeScript`, `bunCommand`, `BunCommand`, `SourceIssue` (tâche 1) ; `listSourceFiles`, `readSources`, `checkImports` (tâche 4) ; `inferPermissions` (tâche 5) ; `OsSandbox`, `osSandbox` (tâche 11b) ; `ComponentManifest`, `ValidationReport`, `grantedOf`, `permissionList`, `diffPermissions`, `isBuiltinId`, `USED_MARKER`, `KiboError` (tâche 2) ; `copyFixture` (test-kit).
- Produces:
  - `type ValidateOptions = { toolchain: Toolchain; bun?: BunCommand; sandbox?: OsSandbox; timeoutMs?: number; now?: () => number }` (`sandbox` : bac à sable OS de la tâche 11b, `osSandbox()` par défaut ; les tests du composant ne tournent jamais hors bac à sable).
  - `validateComponent(dir: string, opts: ValidateOptions): Promise<ValidationReport>` : valide une **copie** du dossier (décision 9), écrit le tampon `<dir>/.kibo/validation.json`, ne lève jamais pour un défaut du composant (tout est dans le rapport).
  - `type ValidationStamp = { hash: string; version: string; ok: boolean; at: number }` ; `readValidationStamp(dir): Promise<ValidationStamp | null>`.
  - `formatIssue(i: SourceIssue): string` et `FR_DEVKIT` (textes français de la validation, affichés par la CLI et l'écran 6).

- [x] **Step 1: Créer les fixtures**

Chaque fixture reprend le `component.test.tsx.fixture` de `hello` (`runConformance({ manifest, Component })`) sauf `failing`.

`packages/devkit/fixtures/bad-import/kibo.component.json` : `{ "id": "bad-import", "version": "0.1.0", "kind": "widget", "title": "Bad import", "reads": [], "writes": [] }` ; `ui.tsx` :
```tsx
import { readFileSync } from "node:fs";

export function Component() {
  return <p>{String(readFileSync)}</p>;
}
```

`packages/devkit/fixtures/non-literal/kibo.component.json` : `{ "id": "non-literal", "version": "0.1.0", "kind": "widget", "title": "Non literal", "reads": ["ticket"], "writes": [] }` ; `ui.tsx` :
```tsx
import { useEntities } from "@kibo/sdk";

const ENTITY = ["ticket"][0] ?? "ticket";

export function Component() {
  const rows = useEntities(ENTITY as "ticket");
  return <p>{rows.data.length}</p>;
}
```

`packages/devkit/fixtures/undeclared/kibo.component.json` : `{ "id": "undeclared", "version": "0.1.0", "kind": "widget", "title": "Undeclared", "reads": ["ticket"], "writes": [] }` ; `ui.tsx` :
```tsx
import { useEntities } from "@kibo/sdk";

export function Component() {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  return (
    <p>
      {tickets.data.length} / {links.data.length}
    </p>
  );
}
```

`packages/devkit/fixtures/failing/kibo.component.json` : `{ "id": "failing", "version": "0.1.0", "kind": "widget", "title": "Failing", "reads": [], "writes": [] }` ; `ui.tsx` : `export function Component() { return <p>ok</p>; }` ; `component.test.tsx.fixture` :
```tsx
import { expect, test } from "bun:test";
import { runConformance } from "@kibo/sdk/conformance";
import manifest from "./kibo.component.json";
import { Component } from "./ui";

runConformance({ manifest, Component });
test("fails on purpose", () => {
  expect(1).toBe(2);
});
```

- [x] **Step 2: Écrire les tests**

`packages/devkit/src/fr.test.ts` :
```ts
import { expect, test } from "bun:test";
import { formatIssue } from "./fr";
import { issueAt } from "./issues";

test("issues are explained in French with their location", () => {
  expect(formatIssue(issueAt("ui.tsx", 3, "forbidden-import", "node:fs"))).toBe("ui.tsx:3 · import interdit : node:fs");
  expect(formatIssue(issueAt("ui.tsx", 7, "non-literal-argument", "useEntities"))).toBe(
    "ui.tsx:7 · argument non littéral : impossible de vérifier la permission (useEntities)",
  );
  expect(formatIssue(issueAt("server.ts", 2, "banned-identifier", "process"))).toBe("server.ts:2 · identifiant interdit : process");
});
```

`packages/devkit/src/validate.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { copyFixture, DEV_TOOLCHAIN } from "./test-kit";
import { readValidationStamp, validateComponent } from "./validate";

const disposers: (() => void)[] = [];
afterAll(() => {
  for (const d of disposers) d();
});
const fixture = (name: string) => {
  const f = copyFixture(name);
  disposers.push(f.dispose);
  return f.dir;
};
const opts = { toolchain: DEV_TOOLCHAIN, now: () => 1_000 };

describe("validateComponent", () => {
  test("hello passes every step and gets stamped", async () => {
    const dir = fixture("hello");
    const report = await validateComponent(dir, opts);
    expect(report.ok).toBe(true);
    expect(report.tests.passed).toBeGreaterThanOrEqual(9);
    expect(report.permissions).toMatchObject({ declared: ["read:ticket"], used: ["read:ticket"], missing: [], unused: [] });
    expect(report.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await readValidationStamp(dir)).toEqual({ hash: report.hash ?? "", version: "0.1.0", ok: true, at: 1_000 });
    expect(readdirSync(dir).sort()).toEqual([".kibo", "component.test.tsx", "kibo.component.json", "node_modules", "ui.tsx"]);
  }, 120_000);
  test("a forbidden import fails the imports step", async () => {
    const report = await validateComponent(fixture("bad-import"), opts);
    expect(report.ok).toBe(false);
    expect(report.imports.errors).toEqual(["ui.tsx:1 · import interdit : node:fs"]);
  }, 120_000);
  test("a non-literal argument cannot be checked", async () => {
    const report = await validateComponent(fixture("non-literal"), opts);
    expect(report.ok).toBe(false);
    expect(report.permissions.errors[0]).toContain("argument non littéral");
  }, 120_000);
  test("an undeclared read is missing, both statically and at runtime", async () => {
    const report = await validateComponent(fixture("undeclared"), opts);
    expect(report.ok).toBe(false);
    expect(report.permissions.missing).toEqual(["read:link"]);
    expect(report.conformance.ok).toBe(false);
  }, 120_000);
  test("a failing test fails the report with the runner output", async () => {
    const report = await validateComponent(fixture("failing"), opts);
    expect(report.tests).toMatchObject({ ok: false, failed: 1 });
    expect(report.tests.output).toContain("fails on purpose");
  }, 120_000);
  test("an invalid or reserved manifest stops before the tests", async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ id: "kanban", version: "0.1.0", kind: "widget", title: "K", reads: [], writes: [] }));
    const report = await validateComponent(dir, opts);
    expect(report.manifest).toEqual({ ok: false, errors: ["identifiant réservé à un composant intégré : kanban"] });
    expect(report.tests.passed + report.tests.failed).toBe(0);
    writeFileSync(join(dir, "kibo.component.json"), "{");
    expect((await validateComponent(dir, opts)).manifest.ok).toBe(false);
  }, 120_000);
  test("the stamp lives in a hidden folder and never changes the hash", async () => {
    const dir = fixture("hello");
    const first = await validateComponent(dir, opts);
    const second = await validateComponent(dir, opts);
    expect(second.hash).toBe(first.hash);
    expect(existsSync(join(dir, ".kibo", "validation.json"))).toBe(true);
  }, 240_000);
  test("without an OS sandbox the component tests are not run", async () => {
    const unavailable = {
      ready: async () => {
        throw new KiboError("SANDBOX_UNAVAILABLE", "bwrap is not installed");
      },
      wrap: () => [],
    };
    const report = await validateComponent(fixture("hello"), { ...opts, sandbox: unavailable });
    expect(report.ok).toBe(false);
    expect(report.tests).toMatchObject({ ok: false, passed: 0, failed: 0 });
    expect(report.tests.output).toContain("bac à sable du système indisponible");
  }, 120_000);
});
```

Run: `bun test packages/devkit/src/validate.test.ts packages/devkit/src/fr.test.ts`
Expected: FAIL (modules absents).

- [x] **Step 3: Implémenter `fr.ts`**

```ts
import type { SourceIssue, SourceIssueCode } from "./issues";

const ISSUES: Record<SourceIssueCode, (detail: string) => string> = {
  "forbidden-import": (d) => `import interdit : ${d}`,
  "outside-import": (d) => `import hors du dossier du composant : ${d}`,
  "non-literal-import": (d) => `import non littéral : ${d}`,
  "banned-identifier": (d) => `identifiant interdit : ${d}`,
  "non-literal-argument": (d) => `argument non littéral : impossible de vérifier la permission (${d})`,
  "reserved-command": (d) => `commande réservée au shell : ${d}`,
  "unknown-entity": (d) => `entité inconnue : ${d}`,
};

export const formatIssue = (i: SourceIssue): string => `${i.file}:${i.line} · ${ISSUES[i.code](i.detail)}`;

export const FR_DEVKIT = {
  reservedId: (id: string) => `identifiant réservé à un composant intégré : ${id}`,
  manifestUnreadable: "kibo.component.json est absent ou n'est pas du JSON valide",
  sourcesRefused: (detail: string) => `sources refusées : ${detail}`,
  typeError: (file: string, line: number, text: string) => `${file}:${line} · ${text}`,
  noConformance: "la suite de conformité ne s'est pas exécutée (runConformance manquant)",
  missing: (p: string) => `permission utilisée mais non déclarée : ${p}`,
  unused: (p: string) => `permission déclarée mais jamais utilisée : ${p}`,
  timeout: (s: number) => `les tests ont dépassé ${s} s`,
  sandboxUnavailable: (detail: string) =>
    `tests non lancés : bac à sable du système indisponible (${detail}). Sous Linux, installe bubblewrap (sudo apt install bubblewrap) puis relance.`,
};
```

- [x] **Step 4: Implémenter `validate.ts`**

```ts
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ComponentManifest,
  diffPermissions,
  grantedOf,
  isBuiltinId,
  KiboError,
  permissionList,
  USED_MARKER,
  type ValidationReport,
} from "@kibo/schema";
import { type BunCommand, bunCommand } from "./bun-command";
import { FR_DEVKIT, formatIssue } from "./fr";
import { listSourceFiles, readSources } from "./hash";
import { checkImports } from "./imports";
import { inferPermissions } from "./infer-permissions";
import { type OsSandbox, osSandbox } from "./os-sandbox";
import type { Toolchain } from "./toolchain";
import { loadTypeScript, type TypeScript } from "./typescript";

export type ValidateOptions = {
  toolchain: Toolchain;
  bun?: BunCommand;
  sandbox?: OsSandbox;
  timeoutMs?: number;
  now?: () => number;
};
export type ValidationStamp = { hash: string; version: string; ok: boolean; at: number };

const STAMP = join(".kibo", "validation.json");
const OUTPUT_LIMIT = 8_000;
const pass = { ok: true, errors: [] as string[] };
const failed = (errors: string[]) => ({ ok: errors.length === 0, errors });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function emptyReport(): ValidationReport {
  return {
    manifest: pass,
    imports: pass,
    typecheck: pass,
    tests: { ok: false, passed: 0, failed: 0, output: "" },
    conformance: { ok: false, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: null,
    ok: false,
  };
}

export async function readValidationStamp(dir: string): Promise<ValidationStamp | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(join(dir, STAMP), "utf8"));
    if (typeof raw !== "object" || raw === null) return null;
    const { hash, version, ok, at } = raw as Record<string, unknown>;
    if (typeof hash !== "string" || typeof version !== "string" || typeof ok !== "boolean" || typeof at !== "number") return null;
    return { hash, version, ok, at };
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function typecheck(ts: TypeScript, copy: string, files: string[], toolchain: Toolchain): string[] {
  const program = ts.createProgram({
    rootNames: files.filter((f) => /\.tsx?$/.test(f)).map((f) => join(copy, f)),
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      resolveJsonModule: true,
      types: ["bun"],
      typeRoots: [join(toolchain.root, "node_modules", "@types")],
    },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file || d.start === undefined) return text;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return FR_DEVKIT.typeError(d.file.fileName.slice(copy.length + 1), line + 1, text);
  });
}

async function runTests(copy: string, opts: ValidateOptions): Promise<{ report: ValidationReport["tests"]; used: string[] | null }> {
  const bun = opts.bun ?? bunCommand();
  const sandbox = opts.sandbox ?? osSandbox();
  const base = dirname(copy);
  const junit = join(base, "junit.xml");
  const preload = (name: string) => Bun.resolveSync(`@kibo/devkit/preload/${name}`, opts.toolchain.root);
  try {
    await sandbox.ready();
  } catch (e) {
    if (!(e instanceof KiboError) || e.code !== "SANDBOX_UNAVAILABLE") throw e;
    return { report: { ok: false, passed: 0, failed: 0, output: FR_DEVKIT.sandboxUnavailable(e.detail) }, used: null };
  }
  const argv = [...bun.argv, "test", "--preload", preload("happydom"), "--preload", preload("restrict"), "--reporter=junit", `--reporter-outfile=${junit}`];
  const policy = { read: [opts.toolchain.root, base], write: [base], exec: bun.argv.slice(0, 1), cwd: copy };
  const proc = Bun.spawn(sandbox.wrap(argv, policy), {
    cwd: copy,
    env: { ...bun.env, PATH: process.env.PATH ?? "", HOME: base, TMPDIR: base, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  const output = `${stdout}\n${stderr}`;
  const xml = await Bun.file(junit).text().catch(() => "");
  const count = (attr: string) => Number(xml.match(new RegExp(`<testsuites[^>]*\\b${attr}="(\\d+)"`))?.[1] ?? 0);
  const total = count("tests");
  const failures = count("failures") + count("errors");
  const used = new Set<string>();
  let sawMarker = false;
  for (const line of output.split("\n")) {
    const at = line.indexOf(USED_MARKER);
    if (at < 0) continue;
    sawMarker = true;
    const parsed: unknown = JSON.parse(line.slice(at + USED_MARKER.length));
    if (Array.isArray(parsed)) for (const p of parsed) if (typeof p === "string") used.add(p);
  }
  const timedOut = proc.signalCode !== null && code !== 0;
  return {
    report: {
      ok: code === 0 && total > 0 && failures === 0,
      passed: total - failures,
      failed: timedOut ? Math.max(1, failures) : failures,
      output: (timedOut ? `${FR_DEVKIT.timeout(timeoutMs / 1000)}\n${output}` : output).slice(-OUTPUT_LIMIT),
    },
    used: sawMarker ? [...used].sort() : null,
  };
}

export async function validateComponent(dir: string, opts: ValidateOptions): Promise<ValidationReport> {
  const report = emptyReport();
  const base = await mkdtemp(join(tmpdir(), "kibo-validate-"));
  try {
    let manifest: ComponentManifest;
    try {
      const raw: unknown = JSON.parse(await readFile(join(dir, "kibo.component.json"), "utf8"));
      const parsed = ComponentManifest.safeParse(raw);
      if (!parsed.success) {
        report.manifest = failed(parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`));
        return report;
      }
      manifest = parsed.data;
    } catch (e) {
      if (!(e instanceof SyntaxError || (e instanceof Error && "code" in e && e.code === "ENOENT"))) throw e;
      report.manifest = failed([FR_DEVKIT.manifestUnreadable]);
      return report;
    }
    if (isBuiltinId(manifest.id)) {
      report.manifest = failed([FR_DEVKIT.reservedId(manifest.id)]);
      return report;
    }
    const copy = join(base, manifest.id);
    const all = await listSourceFiles(dir);
    for (const f of all) {
      await mkdir(dirname(join(copy, f)), { recursive: true });
      await cp(join(dir, f), join(copy, f));
    }
    await symlink(join(opts.toolchain.root, "node_modules"), join(copy, "node_modules"), "dir");
    await writeFile(join(base, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    try {
      report.hash = (await readSources(copy)).hash;
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      report.manifest = failed([FR_DEVKIT.sourcesRefused(e.detail)]);
      return report;
    }

    const ts = await loadTypeScript(opts.toolchain);
    const texts = await Promise.all(all.map(async (path) => ({ path, text: await readFile(join(copy, path), "utf8") })));
    report.imports = failed(checkImports(ts, texts.filter((f) => /\.(tsx?|css)$/.test(f.path))).map(formatIssue));
    report.typecheck = failed(typecheck(ts, copy, all, opts.toolchain));
    const tests = await runTests(copy, opts);
    report.tests = tests.report;

    const inference = await inferPermissions(copy, opts.toolchain);
    const declared = permissionList(grantedOf(manifest));
    const used = [...new Set([...inference.used, ...(tests.used ?? [])])].sort();
    const diff = diffPermissions(declared, used);
    report.permissions = { declared, used, missing: diff.missing, unused: diff.unused, errors: inference.issues.map(formatIssue) };
    report.conformance = failed([
      ...(tests.used === null ? [FR_DEVKIT.noConformance] : []),
      ...(tests.used ?? []).filter((p) => diff.missing.includes(p)).map(FR_DEVKIT.missing),
    ]);
    report.ok =
      report.manifest.ok &&
      report.imports.ok &&
      report.typecheck.ok &&
      report.tests.ok &&
      report.conformance.ok &&
      diff.missing.length === 0 &&
      report.permissions.errors.length === 0;
    return report;
  } catch (e) {
    throw new KiboError("INTERNAL", `validation of ${dir} crashed: ${message(e)}`);
  } finally {
    await rm(base, { recursive: true, force: true });
    if (report.hash !== null && report.manifest.ok) {
      const version = JSON.parse(await readFile(join(dir, "kibo.component.json"), "utf8")).version;
      await mkdir(join(dir, ".kibo"), { recursive: true });
      await writeFile(join(dir, STAMP), JSON.stringify({ hash: report.hash, version: String(version), ok: report.ok, at: (opts.now ?? Date.now)() }));
    }
  }
}
```
Points notables : les tests du composant sont du code **non approuvé** : ils tournent dans le bac à sable OS (tâche 11b, décision 24 : lecture de la toolchain et du dossier de copie, écriture dans ce dossier seulement, aucun réseau) ; sans bac à sable, ils ne sont pas lancés et le rapport l'explique (`FR_DEVKIT.sandboxUnavailable`) ; si `bun test` exige d'autres lectures système sous `sandbox-exec` (constaté par le test « hello passes »), les ajouter à `MACOS_SYSTEM` (tâche 11b) avec leur raison dans ce plan ; le processus de test reçoit un environnement minimal (`PATH`, `HOME` et `TMPDIR` temporaires) ; la sortie est tronquée à 8 000 caractères (fin conservée, où sont les échecs) ; le compteur « unused » est informatif (non bloquant, spec §7.4). Une erreur d'infrastructure (toolchain absente, disque) lève `INTERNAL` : ce n'est pas un défaut du composant.

`packages/devkit/src/index.ts` : ajouter `export * from "./validate";` et `export * from "./fr";`.

- [x] **Step 5: Vérifier et committer**

Run: `bun test packages/devkit && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/devkit/src/validate.ts packages/devkit/src/validate.test.ts packages/devkit/src/fr.ts packages/devkit/src/fr.test.ts packages/devkit/src/index.ts packages/devkit/fixtures
git commit -m "feat(devkit): validation d'un composant"
```

---

### Task 21: Service du registre (confiance, empreinte, désinstallation)

**Files:**
- Create: `packages/daemon/src/components/registry-service.ts`, `packages/daemon/src/components/registry-service.test.ts`, `packages/daemon/src/components/fake-store.test-helper.ts`

**Interfaces:**
- Consumes: `readRegistry`, `getRegistryVersion`, `putRegistryVersion`, `updateRegistryVersion`, `removeRegistryVersion`, `readProject` (tâche 3 et v0.1) ; `ComponentStore`, `StoredVersion`, `backendCodeOf` (tâche 14) ; `EventLog` (tâche 15) ; `ActiveVersion` (tâche 15) ; `BackendSource` (tâche 17) ; `RegistryVersion`, `ComponentSummary`, `ComponentUsage`, `ApprovableTrust`, `BUILTIN_IDS`, `isBuiltinId`, `isActive`, `grantedOf`, `splitRef`, `formatRef`, `KiboError` (tâche 2).
- Produces:
  - `type ProjectRef = { id: string; name: string; doc: LoroDoc }`.
  - `type RegistryServiceDeps = { workspace: LoroDoc; persistWorkspace(): void; projects(): ProjectRef[]; store: ComponentStore; events: EventLog; stopBackend(ref: string): void; emit(): void; onApproved?: (id: string, v: RegistryVersion) => Promise<void> }`.
  - `createRegistryService(deps): RegistryService` avec `list(): ComponentSummary[]`, `usages(id, version?): ComponentUsage[]`, `active(ref): ActiveVersion`, `source(ref): BackendSource | null`, `stored(ref): StoredVersion | null` (version active et chargée), `manifestOf(ref): Promise<ComponentManifest>`, `approve(id, version, hash, trust): Promise<RegistryVersion>`, `revoke(id, version): RegistryVersion`, `rehash(id, version): Promise<RegistryVersion>`, `uninstall(id, version): Promise<void>`, `verify(ref): Promise<void>`, `verifyAll(): Promise<string[]>`, `isTampered(ref): boolean`.
  - `createFakeStore(): ComponentStore & { add(v: StoredVersion): void; tamper(id, version): void }` (aide de test partagée avec les tâches 27 et 30).

- [x] **Step 1: Écrire l'aide de test et les tests**

`packages/daemon/src/components/fake-store.test-helper.ts` :
```ts
import { type ComponentManifest, KiboError } from "@kibo/schema";
import type { ComponentStore, StoredVersion } from "./store";

export type FakeStore = ComponentStore & { add(v: StoredVersion): void; tamper(id: string, version: string): void };

export function storedVersion(manifest: ComponentManifest, hash: string, server: string | null = null): StoredVersion {
  const enc = (s: string) => new TextEncoder().encode(s);
  return {
    id: manifest.id,
    version: manifest.version,
    hash,
    manifest,
    build: {
      "ui.sandbox.js": enc(`sandbox:${manifest.id}@${manifest.version}`),
      "ui.trusted.js": enc(`trusted:${manifest.id}@${manifest.version}`),
      "ui.css": enc(".c{}"),
      ...(server !== null && { "server.js": enc(server) }),
    },
  };
}

export function createFakeStore(): FakeStore {
  const disk = new Map<string, StoredVersion>();
  const tampered = new Set<string>();
  const cache = new Map<string, StoredVersion>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const load = async (id: string, version: string, hash: string) => {
    const v = disk.get(key(id, version));
    if (!v || v.hash !== hash || tampered.has(key(id, version))) throw new KiboError("TRUST_REQUIRED", `${id}@${version} tampered`);
    cache.set(key(id, version), v);
    return v;
  };
  return {
    root: "/fake",
    add: (v) => {
      disk.set(key(v.id, v.version), v);
    },
    tamper: (id, version) => {
      tampered.add(key(id, version));
    },
    put: async () => {
      throw new KiboError("INTERNAL", "use add() in tests");
    },
    load,
    verify: async (id, version, hash) => {
      try {
        await load(id, version, hash);
        return true;
      } catch {
        cache.delete(key(id, version));
        return false;
      }
    },
    get: (id, version) => cache.get(key(id, version)),
    remove: async (id, version) => {
      disk.delete(key(id, version));
      cache.delete(key(id, version));
    },
  };
}
```
Le `catch` nu de `verify` imite le contrat du vrai magasin (absent ou altéré ⇒ `false`) ; il est limité à l'aide de test.

`packages/daemon/src/components/registry-service.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { createProjectDoc, createWorkspaceDoc, executeProjectCommand, getRegistryVersion, putRegistryVersion } from "@kibo/core";
import { ComponentManifest, NO_PERMISSIONS, type Page, type RegistryVersion } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createEventLog, ensureEventsTable } from "./events";
import { createFakeStore, type FakeStore, storedVersion } from "./fake-store.test-helper";
import { createRegistryService, type RegistryService } from "./registry-service";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const manifest = (version: string, extra: Record<string, unknown> = {}) =>
  ComponentManifest.parse({ id: "pr-queue", version, kind: "widget", title: "PR en attente", reads: ["ticket"], writes: [], ...extra });
const entry = (version: string, hash: string, patch: Partial<RegistryVersion> = {}): RegistryVersion => ({
  version,
  hash,
  origin: "ai",
  trust: null,
  approvedHash: null,
  granted: NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
  ...patch,
});

let ws: LoroDoc;
let project: LoroDoc;
let store: FakeStore;
let svc: RegistryService;
let stopped: string[];
let emitted: number;
let approvedHooks: string[];
let db: Database;

beforeEach(() => {
  ws = createWorkspaceDoc();
  project = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  store = createFakeStore();
  stopped = [];
  emitted = 0;
  approvedHooks = [];
  db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  putRegistryVersion(ws, "pr-queue", "PR en attente", entry("0.3.0", H1));
  store.add(storedVersion(manifest("0.3.0", { net: ["api.github.com/graphql"] }), H1));
  svc = createRegistryService({
    workspace: ws,
    persistWorkspace: () => undefined,
    projects: () => [{ id: "p1", name: "Kibo", doc: project }],
    store,
    events: createEventLog(db, () => 7),
    stopBackend: (ref) => stopped.push(ref),
    emit: () => {
      emitted += 1;
    },
    onApproved: async (id, v) => {
      approvedHooks.push(`${id}@${v.version}`);
    },
  });
});

describe("approval", () => {
  test("approving grants the stored manifest's permissions and activates the version", async () => {
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    const v = await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    expect(v).toMatchObject({ trust: "sandboxed", approvedHash: H1, granted: { reads: ["ticket"], net: ["api.github.com/graphql"] } });
    expect(svc.active("pr-queue@0.3.0")).toEqual({ ref: "pr-queue@0.3.0", trust: "sandboxed", granted: v.granted });
    expect(svc.source("pr-queue@0.3.0")?.trust).toBe("sandboxed");
    expect(stopped).toEqual(["pr-queue@0.3.0"]);
    expect(emitted).toBe(1);
    expect(approvedHooks).toEqual([]);
  });
  test("an old hash or a tampered store is a HASH_MISMATCH; built-ins cannot be approved", async () => {
    await expect(svc.approve("pr-queue", "0.3.0", H2, "trusted")).rejects.toThrow("HASH_MISMATCH");
    store.tamper("pr-queue", "0.3.0");
    await expect(svc.approve("pr-queue", "0.3.0", H1, "trusted")).rejects.toThrow("HASH_MISMATCH");
    await expect(svc.approve("kanban", "1.0.0", H1, "trusted")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.approve("pr-queue", "9.9.9", H1, "trusted")).rejects.toThrow("NOT_FOUND");
  });
  test("a deferred update-all runs once, after approval", async () => {
    putRegistryVersion(ws, "pr-queue", "PR en attente", entry("0.4.0", H2, { autoUpdate: true }));
    store.add(storedVersion(manifest("0.4.0"), H2));
    const v = await svc.approve("pr-queue", "0.4.0", H2, "sandboxed");
    expect(approvedHooks).toEqual(["pr-queue@0.4.0"]);
    expect(v.autoUpdate).toBe(false);
    expect(getRegistryVersion(ws, "pr-queue", "0.4.0")?.autoUpdate).toBe(false);
  });
  test("revoke stops the backend and deactivates", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "trusted");
    expect(svc.revoke("pr-queue", "0.3.0")).toMatchObject({ trust: null, approvedHash: null });
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    expect(stopped).toEqual(["pr-queue@0.3.0", "pr-queue@0.3.0"]);
  });
});

describe("tampering", () => {
  test("verifyAll marks a tampered version, journals it and stops its backend", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    expect(await svc.verifyAll()).toEqual(["pr-queue@0.3.0"]);
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(true);
    expect(getRegistryVersion(ws, "pr-queue", "0.3.0")?.trust).toBeNull();
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    expect(createEventLog(db).list().map((e) => [e.ref, e.kind, e.code])).toEqual([["pr-queue@0.3.0", "verify", "TRUST_REQUIRED"]]);
    expect(svc.list()[0]?.versions[0]).toMatchObject({ tampered: true, active: false });
  });
  test("verify before a backend launch refuses a tampered version", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    await expect(svc.verify("pr-queue@0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    expect(svc.source("pr-queue@0.3.0")).toBeNull();
  });
  test("rehash keeps the flag while the files differ", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    await svc.verifyAll();
    await expect(svc.rehash("pr-queue", "0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(true);
  });
  test("rehash of an intact version confirms the hash", async () => {
    expect((await svc.rehash("pr-queue", "0.3.0")).hash).toBe(H1);
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(false);
  });
});

describe("listing and uninstall", () => {
  test("usages come from every project, built-ins included", async () => {
    const page = executeProjectCommand(project, { method: "addPage", title: "Tableau de bord", kind: "dashboard" }) as Page;
    executeProjectCommand(project, { method: "addInstance", pageId: page.id, component: "pr-queue@0.3.0" });
    executeProjectCommand(project, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    const list = svc.list();
    expect(list.map((c) => [c.id, c.builtin])).toEqual([
      ["kanban", true],
      ["tickets", true],
      ["graph", true],
      ["notes", true],
      ["pr-queue", false],
    ]);
    expect(list[0]?.versions).toEqual([
      expect.objectContaining({ version: "1.0.0", trust: "builtin", origin: "kibo", active: true, usages: [expect.objectContaining({ pageTitle: "Tableau de bord", projectName: "Kibo" })] }),
    ]);
    expect(list[4]?.versions[0]).toMatchObject({ version: "0.3.0", hash: H1, active: false, usages: [expect.objectContaining({ projectId: "p1" })] });
    await expect(svc.uninstall("pr-queue", "0.3.0")).rejects.toThrow("INVALID_INPUT");
  });
  test("an unused version is uninstalled from the registry and the store", async () => {
    await svc.uninstall("pr-queue", "0.3.0");
    expect(getRegistryVersion(ws, "pr-queue", "0.3.0")).toBeNull();
    expect(await store.verify("pr-queue", "0.3.0", H1)).toBe(false);
    expect(svc.list().map((c) => c.id)).toEqual(["kanban", "tickets", "graph", "notes"]);
  });
});
```
Run: `bun test packages/daemon/src/components/registry-service.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `registry-service.ts`**

```ts
import {
  getRegistryVersion,
  readProject,
  readRegistry,
  removeRegistryVersion,
  updateRegistryVersion,
} from "@kibo/core";
import {
  type ApprovableTrust,
  BUILTIN_IDS,
  type ComponentManifest,
  type ComponentSummary,
  type ComponentUsage,
  compareSemver,
  formatRef,
  grantedOf,
  isActive,
  isBuiltinId,
  KiboError,
  type RegistryVersion,
  splitRef,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { BackendSource } from "./backends";
import type { EventLog } from "./events";
import type { ActiveVersion } from "./gate";
import { backendCodeOf, type ComponentStore, type StoredVersion } from "./store";

export type ProjectRef = { id: string; name: string; doc: LoroDoc };
export type RegistryServiceDeps = {
  workspace: LoroDoc;
  persistWorkspace(): void;
  projects(): ProjectRef[];
  store: ComponentStore;
  events: EventLog;
  stopBackend(ref: string): void;
  emit(): void;
  onApproved?: (id: string, v: RegistryVersion) => Promise<void>;
};
export type RegistryService = {
  list(): ComponentSummary[];
  usages(id: string, version?: string): ComponentUsage[];
  active(ref: string): ActiveVersion;
  source(ref: string): BackendSource | null;
  stored(ref: string): StoredVersion | null;
  manifestOf(ref: string): Promise<ComponentManifest>;
  approve(id: string, version: string, hash: string, trust: ApprovableTrust): Promise<RegistryVersion>;
  revoke(id: string, version: string): RegistryVersion;
  rehash(id: string, version: string): Promise<RegistryVersion>;
  uninstall(id: string, version: string): Promise<void>;
  verify(ref: string): Promise<void>;
  verifyAll(): Promise<string[]>;
  isTampered(ref: string): boolean;
};

export function createRegistryService(deps: RegistryServiceDeps): RegistryService {
  const tampered = new Set<string>();
  const ws = deps.workspace;
  const changed = () => {
    deps.persistWorkspace();
    deps.emit();
  };
  const versionOf = (id: string, version: string): RegistryVersion => {
    const v = getRegistryVersion(ws, id, version);
    if (!v) throw new KiboError("NOT_FOUND", `${id}@${version} is not installed`);
    return v;
  };
  const markTampered = (id: string, version: string) => {
    const ref = formatRef(id, version);
    if (tampered.has(ref)) return;
    tampered.add(ref);
    updateRegistryVersion(ws, id, version, { trust: null });
    deps.events.record({ projectId: "-", instanceId: "-", ref, kind: "verify", code: "TRUST_REQUIRED" });
    deps.stopBackend(ref);
    changed();
  };
  const usages = (id: string, version?: string): ComponentUsage[] =>
    deps.projects().flatMap((p) => {
      const snap = readProject(p.doc);
      return snap.instances
        .filter((i) => {
          const r = splitRef(i.component);
          return r.id === id && (version === undefined || r.version === version);
        })
        .map((i) => ({
          projectId: p.id,
          projectName: p.name,
          pageId: i.pageId,
          pageTitle: snap.pages.find((pg) => pg.id === i.pageId)?.title ?? "",
          instanceId: i.id,
        }));
    });
  const active = (ref: string): ActiveVersion => {
    const { id, version } = splitRef(ref);
    const v = getRegistryVersion(ws, id, version);
    if (!v || !isActive(v) || tampered.has(ref) || v.trust === "builtin" || v.trust === null) {
      throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
    }
    return { ref, trust: v.trust, granted: v.granted };
  };
  const stored = (ref: string): StoredVersion | null => {
    try {
      active(ref);
    } catch (e) {
      if (e instanceof KiboError && e.code === "TRUST_REQUIRED") return null;
      throw e;
    }
    const { id, version } = splitRef(ref);
    return deps.store.get(id, version) ?? null;
  };
  const verify = async (ref: string) => {
    const { id, version } = splitRef(ref);
    const v = versionOf(id, version);
    if (!(await deps.store.verify(id, version, v.hash))) {
      markTampered(id, version);
      throw new KiboError("TRUST_REQUIRED", `${ref} changed on disk`);
    }
  };

  return {
    list() {
      const builtins: ComponentSummary[] = BUILTIN_IDS.map((id) => {
        const byVersion = new Map<string, ComponentUsage[]>();
        for (const u of usages(id)) {
          const ref = deps.projects().find((p) => p.id === u.projectId);
          const inst = ref ? readProject(ref.doc).instances.find((i) => i.id === u.instanceId) : undefined;
          const version = inst ? splitRef(inst.component).version : "";
          byVersion.set(version, [...(byVersion.get(version) ?? []), u]);
        }
        return {
          id,
          title: id,
          builtin: true,
          versions: [...byVersion].map(([version, list]) => ({
            version,
            hash: null,
            trust: "builtin" as const,
            origin: "kibo" as const,
            active: true,
            tampered: false,
            manifest: null,
            usages: list,
          })),
        };
      });
      const installed: ComponentSummary[] = Object.entries(readRegistry(ws))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, e]) => ({
          id,
          title: e.title,
          builtin: false,
          versions: Object.values(e.versions)
            .sort((a, b) => compareSemver(a.version, b.version))
            .map((v) => {
              const ref = formatRef(id, v.version);
              return {
                version: v.version,
                hash: v.hash,
                trust: v.trust,
                origin: v.origin,
                active: isActive(v) && !tampered.has(ref),
                tampered: tampered.has(ref),
                manifest: deps.store.get(id, v.version)?.manifest ?? null,
                usages: usages(id, v.version),
              };
            }),
        }));
      return [...builtins, ...installed];
    },
    usages,
    active,
    stored,
    source(ref) {
      const s = stored(ref);
      if (!s) return null;
      const { trust } = active(ref);
      return { manifest: s.manifest, code: backendCodeOf(s), trust };
    },
    async manifestOf(ref) {
      const { id, version } = splitRef(ref);
      const v = versionOf(id, version);
      return (deps.store.get(id, version) ?? (await deps.store.load(id, version, v.hash))).manifest;
    },
    async approve(id, version, hash, trust) {
      if (isBuiltinId(id)) throw new KiboError("INVALID_INPUT", `${id} is a built-in component`);
      const v = versionOf(id, version);
      if (hash !== v.hash) throw new KiboError("HASH_MISMATCH", `${id}@${version} hash is ${v.hash}`);
      let s: StoredVersion;
      try {
        s = await deps.store.load(id, version, hash);
      } catch (e) {
        if (e instanceof KiboError && e.code === "TRUST_REQUIRED") throw new KiboError("HASH_MISMATCH", `${id}@${version} changed on disk`);
        throw e;
      }
      tampered.delete(formatRef(id, version));
      let updated = updateRegistryVersion(ws, id, version, { trust, approvedHash: hash, granted: grantedOf(s.manifest) });
      deps.stopBackend(formatRef(id, version));
      changed();
      if (updated.autoUpdate) {
        updated = updateRegistryVersion(ws, id, version, { autoUpdate: false });
        changed();
        await deps.onApproved?.(id, updated);
      }
      return updated;
    },
    revoke(id, version) {
      versionOf(id, version);
      const updated = updateRegistryVersion(ws, id, version, { trust: null, approvedHash: null });
      deps.stopBackend(formatRef(id, version));
      changed();
      return updated;
    },
    async rehash(id, version) {
      const v = versionOf(id, version);
      if (!(await deps.store.verify(id, version, v.hash))) {
        markTampered(id, version);
        throw new KiboError("TRUST_REQUIRED", `${id}@${version} still differs from its hash`);
      }
      if (tampered.delete(formatRef(id, version))) changed();
      return versionOf(id, version);
    },
    async uninstall(id, version) {
      versionOf(id, version);
      if (usages(id, version).length > 0) throw new KiboError("INVALID_INPUT", `${id}@${version} is still used on pages`);
      deps.stopBackend(formatRef(id, version));
      removeRegistryVersion(ws, id, version);
      await deps.store.remove(id, version);
      tampered.delete(formatRef(id, version));
      changed();
    },
    verify,
    async verifyAll() {
      const bad: string[] = [];
      for (const [id, e] of Object.entries(readRegistry(ws))) {
        for (const v of Object.values(e.versions)) {
          if (!(await deps.store.verify(id, v.version, v.hash))) {
            markTampered(id, v.version);
            bad.push(formatRef(id, v.version));
          }
        }
      }
      return bad;
    },
    isTampered: (ref) => tampered.has(ref),
  };
}
```
Un intégré reçoit une ligne par version réellement utilisée ; l'UI complète titre, description et version courante avec `BUILTIN_COMPONENTS` (tâche 24). L'état « altéré » vit en mémoire et se recalcule au démarrage par `verifyAll` (tâche 30) : la confiance, elle, est bien retirée du registre (`trust = null`).

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/registry-service.ts packages/daemon/src/components/registry-service.test.ts packages/daemon/src/components/fake-store.test-helper.ts
git commit -m "feat(daemon): registre et confiance"
```

---

### Task 22: Serveurs, port sandbox, modules trusted, CSP et `daemon.json`

**Files:**
- Create: `packages/daemon/src/components/sandbox-server.ts`, `packages/daemon/src/components/sandbox-server.test.ts`, `packages/daemon/src/components/daemon-info.ts`, `packages/daemon/src/components/daemon-info.test.ts`
- Modify: `packages/daemon/src/server.ts`, `packages/daemon/src/server.test.ts`, `packages/daemon/src/main.ts`

**Interfaces:**
- Consumes: `StoredVersion` (tâche 14) ; `SandboxFile`, `TrustedFile`, `sandboxPath`, `trustedPath` (tâche 2).
- Produces:
  - `type AssetLookup = (id: string, version: string, hash: string) => { stored: StoredVersion; trust: "trusted" | "sandboxed" } | null` (version active, empreinte = celle de l'URL, fichiers déjà vérifiés en mémoire ; branché en tâche 30 sur `registry.stored` + `registry.active`).
  - `sandboxHeaders(uiPort): Record<string, string>` ; `SANDBOX_INDEX: string` ; `startSandboxServer(opts: { port: number; uiPort: number; assets: AssetLookup }): { url: string; port: number; stop(): void }`.
  - `ServerOptions` gagne `assets?: AssetLookup` et `sandboxOrigin?: () => string | null` (fonction : l'origine n'est connue qu'après le démarrage du serveur sandbox, qui dépend lui-même du port de l'UI) ; routes `GET /components/<id>/<version>/<hash>/(ui.trusted.js|ui.css)` (Host, session, `Origin` s'il est présent, `trust === "trusted"`) ; CSP de l'UI avec `frame-src <sandboxOrigin>`.
  - `writeDaemonInfo(home, info: DaemonInfo): void` ; `readDaemonInfo(home): DaemonInfo | null` ; `removeDaemonInfo(home): void` ; `type DaemonInfo = { port: number; sandboxPort: number; pid: number }`.
  - `main.ts` : options `--sandbox-port` (défaut : `0` si `--port 0`, sinon port + 1) et `--toolchain` ; `daemon.json` écrit au démarrage et supprimé à l'arrêt.

- [x] **Step 1: Écrire les tests du serveur sandbox**

`packages/daemon/src/components/sandbox-server.test.ts` :
```ts
import { afterEach, describe, expect, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import { storedVersion } from "./fake-store.test-helper";
import { type AssetLookup, startSandboxServer } from "./sandbox-server";

const H = "c".repeat(64);
const stored = storedVersion(ComponentManifest.parse({ id: "pr-queue", version: "0.3.0", kind: "widget", title: "PR", reads: [], writes: [] }), H);
let trust: "trusted" | "sandboxed" | null = "sandboxed";
const assets: AssetLookup = (id, version, hash) =>
  trust && id === "pr-queue" && version === "0.3.0" && hash === H ? { stored, trust } : null;
const servers: { stop(): void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
  trust = "sandboxed";
});
function start() {
  const s = startSandboxServer({ port: 0, uiPort: 4317, assets });
  servers.push(s);
  return s;
}
const get = (s: { port: number }, path: string, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${s.port}${path}`, { headers: { host: `127.0.0.1:${s.port}`, ...headers } });

describe("sandbox server", () => {
  test("serves the three files of an active version with the sandbox headers", async () => {
    const s = start();
    const html = await get(s, `/c/pr-queue/0.3.0/${H}/index.html`);
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(await html.text()).toContain('<script type="module" src="ui.sandbox.js"></script>');
    expect(html.headers.get("content-security-policy")).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
        "connect-src 'none'; frame-ancestors http://127.0.0.1:4317 http://localhost:4317; base-uri 'none'; form-action 'none'",
    );
    expect(html.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(html.headers.get("set-cookie")).toBeNull();
    const js = await get(s, `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`);
    expect(await js.text()).toBe("sandbox:pr-queue@0.3.0");
    expect(js.headers.get("content-type")).toContain("javascript");
    expect(js.headers.get("access-control-allow-origin")).toBe("*");
    expect(html.headers.get("access-control-allow-origin")).toBeNull();
    expect(await html.text()).toContain('<link rel="stylesheet" href="ui.css" crossorigin="anonymous">');
    const css = await get(s, `/c/pr-queue/0.3.0/${H}/ui.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get("access-control-allow-origin")).toBe("*");
  });
  test("anything else is a 404, even with a session cookie", async () => {
    const s = start();
    for (const path of [
      `/c/pr-queue/0.3.0/${H}/ui.trusted.js`,
      `/c/pr-queue/0.3.0/${"d".repeat(64)}/index.html`,
      `/c/pr-queue/0.3.0/${H}/../../x`,
      "/api/rpc",
      "/",
    ]) {
      expect((await get(s, path, { cookie: "kibo_session=x" })).status).toBe(404);
    }
    const post = await fetch(`http://127.0.0.1:${s.port}/c/pr-queue/0.3.0/${H}/index.html`, { method: "POST" });
    expect(post.status).toBe(405);
  });
  test("a version that loses its trust stops being served; a wrong Host is refused", async () => {
    const s = start();
    trust = null;
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/index.html`)).status).toBe(404);
    trust = "sandboxed";
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/index.html`, { host: "evil.test" })).status).toBe(403);
  });
});
```

`packages/daemon/src/components/daemon-info.test.ts` :
```ts
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDaemonInfo, removeDaemonInfo, writeDaemonInfo } from "./daemon-info";

test("daemon.json is private, readable back and removed on stop", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-info-"));
  expect(readDaemonInfo(home)).toBeNull();
  writeDaemonInfo(home, { port: 4317, sandboxPort: 4318, pid: 42 });
  expect(statSync(join(home, "daemon.json")).mode & 0o777).toBe(0o600);
  expect(readDaemonInfo(home)).toEqual({ port: 4317, sandboxPort: 4318, pid: 42 });
  removeDaemonInfo(home);
  expect(readDaemonInfo(home)).toBeNull();
  rmSync(home, { recursive: true, force: true });
});
```

Run: `bun test packages/daemon/src/components/sandbox-server.test.ts packages/daemon/src/components/daemon-info.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `sandbox-server.ts` et `daemon-info.ts`**

`packages/daemon/src/components/sandbox-server.ts` :
```ts
import type { SandboxFile } from "@kibo/schema";
import type { StoredVersion } from "./store";

export type AssetLookup = (
  id: string,
  version: string,
  hash: string,
) => { stored: StoredVersion; trust: "trusted" | "sandboxed" } | null;

export const SANDBOX_INDEX =
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="ui.css" crossorigin="anonymous"></head>' +
  '<body><div id="root"></div><script type="module" src="ui.sandbox.js"></script></body></html>';

const PATH = /^\/c\/([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*)\/(\d+\.\d+\.\d+)\/([0-9a-f]{64})\/(index\.html|ui\.sandbox\.js|ui\.css)$/;
const TYPES: Record<SandboxFile, string> = {
  "index.html": "text/html; charset=utf-8",
  "ui.sandbox.js": "text/javascript; charset=utf-8",
  "ui.css": "text/css; charset=utf-8",
};

export function sandboxHeaders(uiPort: number): Record<string, string> {
  return {
    "content-security-policy":
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
      `connect-src 'none'; frame-ancestors http://127.0.0.1:${uiPort} http://localhost:${uiPort}; base-uri 'none'; form-action 'none'`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-site",
    "cache-control": "no-store",
  };
}

export function startSandboxServer(opts: { port: number; uiPort: number; assets: AssetLookup }): {
  url: string;
  port: number;
  stop(): void;
} {
  const notFound = () => new Response("not found", { status: 404 });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: 0,
    fetch(req) {
      const port = server.port;
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.get("host") ?? "")) {
        return new Response("forbidden host", { status: 403 });
      }
      if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
      const match = PATH.exec(new URL(req.url).pathname);
      if (!match) return notFound();
      const [, id = "", version = "", hash = "", file = ""] = match;
      const found = opts.assets(id, version, hash);
      if (!found) return notFound();
      const name = file as SandboxFile;
      const body = name === "index.html" ? SANDBOX_INDEX : found.stored.build[name];
      if (body === undefined) return notFound();
      const headers: Record<string, string> = { ...sandboxHeaders(opts.uiPort), "content-type": TYPES[name] };
      if (name !== "index.html") headers["access-control-allow-origin"] = "*";
      return new Response(body, { headers });
    },
  });
  const port = server.port ?? opts.port;
  return { url: `http://127.0.0.1:${port}`, port, stop: () => server.stop(true) };
}
```
Le cast `file as SandboxFile` est sûr : l'expression régulière n'accepte que ces trois noms. `access-control-allow-origin: *` sur `ui.sandbox.js` et `ui.css`, jamais sur `index.html` (décision 17) : le document sandboxé a une origine opaque (`null`), le script `type="module"` est chargé en mode CORS et la feuille de style aussi grâce à `crossorigin="anonymous"` ; en mode `no-cors`, `cross-origin-resource-policy: same-site` bloquerait `ui.css` (initiateur opaque tenu pour inter-site). Ces fichiers ne contiennent aucun secret (code du composant, déjà approuvé) et la réponse ne porte ni cookie ni identifiant.

`packages/daemon/src/components/daemon-info.ts` :
```ts
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type DaemonInfo = { port: number; sandboxPort: number; pid: number };

const fileOf = (home: string) => join(home, "daemon.json");

export function writeDaemonInfo(home: string, info: DaemonInfo): void {
  writeFileSync(fileOf(home), JSON.stringify(info), { mode: 0o600 });
}

export function readDaemonInfo(home: string): DaemonInfo | null {
  if (!existsSync(fileOf(home))) return null;
  const raw: unknown = JSON.parse(readFileSync(fileOf(home), "utf8"));
  if (typeof raw !== "object" || raw === null) return null;
  const { port, sandboxPort, pid } = raw as Record<string, unknown>;
  if (typeof port !== "number" || typeof sandboxPort !== "number" || typeof pid !== "number") return null;
  return { port, sandboxPort, pid };
}

export function removeDaemonInfo(home: string): void {
  rmSync(fileOf(home), { force: true });
}
```

- [x] **Step 3: Tests des routes trusted et du CSP de l'UI**

Ajouter à `packages/daemon/src/server.test.ts` (réutiliser l'aide qui démarre le serveur et appaire une session, déjà présente dans ce fichier ; la paramétrer par `assets` et `sandboxOrigin`) :
```ts
describe("trusted component modules", () => {
  const H = "e".repeat(64);
  const manifest = ComponentManifest.parse({ id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [] });
  const stored = storedVersion(manifest, H);
  let trust: "trusted" | "sandboxed" = "trusted";
  const assets: AssetLookup = (id, version, hash) => (id === "mine" && version === "1.0.0" && hash === H ? { stored, trust } : null);

  test("served from memory to a paired session only", async () => {
    const { base, cookie, stop } = await startPaired({ assets, sandboxOrigin: () => "http://127.0.0.1:4318" });
    const url = `${base}/components/mine/1.0.0/${H}/ui.trusted.js`;
    expect((await fetch(url)).status).toBe(401);
    const ok = await fetch(url, { headers: { cookie } });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("trusted:mine@1.0.0");
    expect(ok.headers.get("content-type")).toContain("javascript");
    expect((await fetch(url, { headers: { cookie, origin: "http://evil.test" } })).status).toBe(403);
    expect((await fetch(`${base}/components/mine/1.0.0/${H}/ui.css`, { headers: { cookie } })).status).toBe(200);
    expect((await fetch(`${base}/components/mine/1.0.0/${H}/server.js`, { headers: { cookie } })).status).toBe(404);
    trust = "sandboxed";
    expect((await fetch(url, { headers: { cookie } })).status).toBe(403);
    trust = "trusted";
    stop();
  });

  test("the UI CSP allows frames from the sandbox origin only", async () => {
    const { base, stop } = await startPaired({ assets, sandboxOrigin: () => "http://127.0.0.1:4318" });
    const csp = (await fetch(`${base}/`)).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-src http://127.0.0.1:4318;");
    expect(csp).toContain("script-src 'self';");
    stop();
  });
});
```
`startPaired(extra)` : aide du fichier (à créer si elle n'existe pas sous ce nom) qui démarre `startServer({ service, token, port: 0, uiDir, ...extra })`, appelle `POST /api/pair` avec l'`Origin` du serveur et renvoie `{ base, cookie, stop }`. Imports à ajouter : `ComponentManifest` (`@kibo/schema`), `storedVersion` (`./components/fake-store.test-helper`), `type AssetLookup` (`./components/sandbox-server`).

Run: `bun test packages/daemon/src/server.test.ts`
Expected: FAIL.

- [x] **Step 4: Modifier `server.ts`**

Ajouts à `ServerOptions` :
```ts
  assets?: AssetLookup;
  sandboxOrigin?: () => string | null;
```
Dans `fetch`, avant le test `/api/` :
```ts
      if (url.pathname.startsWith("/components/")) return serveTrusted(req, url);
```
Nouvelle fonction interne (dans `startServer`, pour lire `hasSession` et `origins`) :
```ts
  const TRUSTED = /^\/components\/([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*)\/(\d+\.\d+\.\d+)\/([0-9a-f]{64})\/(ui\.trusted\.js|ui\.css)$/;
  const serveTrusted = (req: Request, url: URL): Response => {
    const origin = req.headers.get("origin");
    if (origin !== null && !origins().includes(origin)) return new Response("forbidden origin", { status: 403 });
    if (!hasSession(req)) return new Response("unauthorized", { status: 401 });
    const match = TRUSTED.exec(url.pathname);
    if (req.method !== "GET" || !match || !opts.assets) return new Response("not found", { status: 404 });
    const [, id = "", version = "", hash = "", file = ""] = match;
    const found = opts.assets(id, version, hash);
    if (!found) return new Response("not found", { status: 404 });
    if (found.trust !== "trusted") return new Response("not trusted", { status: 403 });
    const body = found.stored.build[file === "ui.css" ? "ui.css" : "ui.trusted.js"];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, {
      headers: {
        "content-type": file === "ui.css" ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  };
```
Le CSP de l'UI devient une fonction :
```ts
const uiHeaders = (sandboxOrigin: string | null) => ({
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    `font-src 'self' data:; connect-src 'self'; ${sandboxOrigin ? `frame-src ${sandboxOrigin}; ` : ""}frame-ancestors 'none'; ` +
    "base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});
```
et `withUiHeaders(res, opts.sandboxOrigin?.() ?? null)` applique `uiHeaders(...)`.

`STATUS` gagne les codes de la phase : `TRUST_REQUIRED: 403, PERMISSION_DENIED: 403, RATE_LIMITED: 429, TIMEOUT: 504, COMPONENT_CRASHED: 502, PATH_OUTSIDE_PROJECT: 403` (les autres restent en 400, `INTERNAL` en 500).

- [x] **Step 5: Options de `main.ts`**

Ajouter à `packages/daemon/src/components/daemon-info.ts` une fonction pure, et son test à `daemon-info.test.ts` :
```ts
export const sandboxPortFor = (port: number, explicit: string | undefined): number =>
  explicit !== undefined ? Number(explicit) : port === 0 ? 0 : port + 1;
```
```ts
test("the sandbox port follows the UI port unless given", () => {
  expect(sandboxPortFor(4317, undefined)).toBe(4318);
  expect(sandboxPortFor(0, undefined)).toBe(0);
  expect(sandboxPortFor(4317, "9000")).toBe(9000);
});
```
`main.ts` accepte les nouvelles options, sans encore s'en servir (l'assemblage — serveur sandbox, `assets`, `daemon.json` — est la tâche 30) :
```ts
const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4317" },
    "sandbox-port": { type: "string" },
    toolchain: { type: "string" },
    ui: { type: "string" },
    dev: { type: "boolean", default: false },
  },
});
```
Le calcul `sandboxPortFor(Number(values.port), values["sandbox-port"])` et la lecture de `values.toolchain` sont écrits par la tâche 30, qui les consomme ; ici, seules les options sont déclarées (une option inconnue ferait échouer `parseArgs` en mode strict).

- [x] **Step 6: Vérifier et committer**

Run: `bun test packages/daemon && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/sandbox-server.ts packages/daemon/src/components/sandbox-server.test.ts packages/daemon/src/components/daemon-info.ts packages/daemon/src/components/daemon-info.test.ts packages/daemon/src/server.ts packages/daemon/src/server.test.ts packages/daemon/src/main.ts
git commit -m "feat(daemon): port sandbox et modules trusted"
```

Écarts livrés : `readDaemonInfo` lève `STORE_CORRUPT` sur un JSON illisible ou de forme invalide (absent ⇒ `null`) et `writeDaemonInfo` refait un `chmod 0600` ; la route trusted refuse aussi `sec-fetch-site` présent et différent de `same-origin` (403, avant la session) et pose `cross-origin-resource-policy: same-origin` ; analyse des chemins partagée dans `asset-path.ts`, route trusted dans `trusted-route.ts`.

---

### Task 23: UI, pont iframe, chargement trusted et modules partagés

**Files:**
- Create: `packages/ui/src/shell/frame-bridge.ts`, `packages/ui/src/shell/frame-bridge.test.ts`, `packages/ui/src/shell/SandboxFrame.tsx`, `packages/ui/src/shell/trusted-loader.ts`, `packages/ui/src/shell/trusted-loader.test.ts`, `packages/ui/src/shell/shared-modules.ts`, `packages/ui/src/shell/shared-modules.test.ts`, `packages/ui/src/state/use-runtime-info.ts`
- Modify: `packages/ui/src/theme.ts` (`currentTheme`, `useTheme`), `packages/ui/src/main.tsx` (`exposeSharedModules()` avant le rendu)

**Interfaces:**
- Consumes: `HostToFrame`, `FrameToHost`, `InitMessage`, `KeyCombo`, `ComponentCall`, `ComponentManifest`, `Theme`, `Surface`, `SHARED_SPECIFIERS`, `SDK_UI_PRIMITIVES`, `trustedPath`, `isKiboErrorCode`, `KiboError` (tâche 2) ; `client.rpc` (`componentCall`, `getRuntimeInfo`) ; `useHost` (`openTicket`, `openNewTicket`, `openFile`, `openView` ; tâche 7).
- Produces:
  - `MAX_IN_FLIGHT = 64` ; `type BridgeDeps = { frame(): Window | null; init(): Omit<InitMessage, "kibo" | "type">; call(call: ComponentCall): Promise<unknown>; onOpenTicket(id); onOpenNewTicket(d); onOpenFile(t: { path: string; line?: number }); onOpenView(componentId); onKey(combo: KeyCombo); onResize(height: number); log?: (line: string) => void }` ; `createFrameBridge(deps): { handle(e: MessageEvent): void; changed(): void; theme(t: Theme): void; dispose(): void }`.
  - `dispatchCombo(combo: KeyCombo, target?: EventTarget): void` (rejoue le raccourci dans l'app).
  - `SandboxFrame({ projectId, instanceId, config, viewer, surface, src, title })` (hauteur auto pour les widgets).
  - `type TrustedModule = { manifest: ComponentManifest; Component: ComponentType }` ; `loadTrusted(id, version, hash, importer?): Promise<TrustedModule>` (cache par URL, `<link>` CSS injecté une fois, forme du module vérifiée).
  - `SHARED_MODULES: Record<string, unknown>` ; `exposeSharedModules(): void`.
  - `useRuntimeInfo(): RuntimeInfo | null` ; `currentTheme(): Theme` ; `useTheme(): Theme`.

- [x] **Step 1: Écrire les tests du pont**

`packages/ui/src/shell/frame-bridge.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import { type ComponentCall, type HostToFrame, KiboError } from "@kibo/schema";
import { createFrameBridge, dispatchCombo, MAX_IN_FLIGHT } from "./frame-bridge";

function setup(call: (c: ComponentCall) => Promise<unknown> = async () => ["ok"]) {
  const posted: HostToFrame[] = [];
  const frame = { postMessage: (m: HostToFrame) => posted.push(m) } as unknown as Window;
  const other = {} as Window;
  const logs: string[] = [];
  const calls: ComponentCall[] = [];
  const handlers = {
    onOpenTicket: mock((_: string) => {}),
    onOpenNewTicket: mock(() => {}),
    onOpenFile: mock(() => {}),
    onOpenView: mock((_: string) => {}),
    onKey: mock(() => {}),
    onResize: mock((_: number) => {}),
  };
  const bridge = createFrameBridge({
    frame: () => frame,
    init: () => ({ instanceId: "inst-1", config: { filter: "all" }, viewer: "adam", theme: "dark", surface: "widget" }),
    call: (c) => {
      calls.push(c);
      return call(c);
    },
    ...handlers,
    log: (l) => logs.push(l),
  });
  const from = (source: Window, data: unknown) => bridge.handle(new MessageEvent("message", { data, source: source as MessageEventSource }));
  return { bridge, posted, frame, other, logs, calls, handlers, from };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("ready gets the init message, bound to the frame's own instance", () => {
  const { posted, frame, from } = setup();
  from(frame, { kibo: 1, type: "ready" });
  expect(posted).toEqual([
    { kibo: 1, type: "init", instanceId: "inst-1", config: { filter: "all" }, viewer: "adam", theme: "dark", surface: "widget" },
  ]);
});

test("calls are forwarded without any instanceId read from the message, errors keep their code", async () => {
  const { posted, frame, calls, from } = setup(async (c) => {
    if (c.kind === "data.keys") throw new KiboError("PERMISSION_DENIED", "no data");
    return [1];
  });
  from(frame, { kibo: 1, type: "call", id: 1, call: { kind: "list", entity: "ticket" }, instanceId: "someone-else" });
  from(frame, { kibo: 1, type: "call", id: 2, call: { kind: "data.keys" } });
  await flush();
  expect(calls).toEqual([{ kind: "list", entity: "ticket" }, { kind: "data.keys" }]);
  expect(posted).toEqual([
    { kibo: 1, type: "reply", id: 1, ok: true, result: [1] },
    { kibo: 1, type: "reply", id: 2, ok: false, error: { code: "PERMISSION_DENIED", message: "no data" } },
  ]);
});

test("messages from another window or with a bad shape are ignored and logged", () => {
  const { posted, other, frame, logs, calls, from } = setup();
  from(other, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  from(frame, { kibo: 1, type: "call", id: "x" });
  from(frame, { kibo: 2, type: "ready" });
  expect(calls).toEqual([]);
  expect(posted).toEqual([]);
  expect(logs).toHaveLength(3);
});

test("the 65th call in flight is answered with TIMEOUT", async () => {
  const pending: ((v: unknown) => void)[] = [];
  const { posted, frame, from } = setup(() => new Promise((resolve) => pending.push(resolve)));
  for (let id = 1; id <= MAX_IN_FLIGHT + 1; id += 1) from(frame, { kibo: 1, type: "call", id, call: { kind: "data.keys" } });
  expect(posted).toEqual([{ kibo: 1, type: "reply", id: 65, ok: false, error: { code: "TIMEOUT", message: "too many calls in flight" } }]);
  pending[0]?.(null);
  await flush();
  from(frame, { kibo: 1, type: "call", id: 66, call: { kind: "data.keys" } });
  expect(posted.filter((m) => m.type === "reply" && m.id === 66)).toEqual([]);
});

test("navigation, shortcuts, resize, theme and change notifications", () => {
  const { bridge, posted, frame, handlers, from } = setup();
  from(frame, { kibo: 1, type: "openTicket", ticketId: "t1" });
  from(frame, { kibo: 1, type: "openView", componentId: "graph" });
  from(frame, { kibo: 1, type: "key", combo: "mod+k" });
  from(frame, { kibo: 1, type: "resize", height: 240 });
  expect(handlers.onOpenTicket).toHaveBeenCalledWith("t1");
  expect(handlers.onOpenView).toHaveBeenCalledWith("graph");
  expect(handlers.onKey).toHaveBeenCalledWith("mod+k");
  expect(handlers.onResize).toHaveBeenCalledWith(240);
  bridge.theme("light");
  bridge.changed();
  expect(posted).toEqual([
    { kibo: 1, type: "theme", theme: "light" },
    { kibo: 1, type: "changed" },
  ]);
});

test("dispose answers nothing more", async () => {
  const pending: ((v: unknown) => void)[] = [];
  const { bridge, posted, frame, from } = setup(() => new Promise((resolve) => pending.push(resolve)));
  from(frame, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  bridge.dispose();
  pending[0]?.(null);
  await flush();
  expect(posted).toEqual([]);
});

test("dispatchCombo replays the shortcut as a keydown in the app", () => {
  const seen: string[] = [];
  const target = new EventTarget();
  target.addEventListener("keydown", (e) => {
    const k = e as KeyboardEvent;
    seen.push(`${k.metaKey || k.ctrlKey ? "mod+" : ""}${k.key}`);
  });
  dispatchCombo("mod+k", target);
  dispatchCombo("escape", target);
  expect(seen).toEqual(["mod+k", "Escape"]);
});
```
Les casts `as unknown as Window` et `as MessageEventSource` sont limités au test (faux objets fenêtre).

Run: `bun test packages/ui/src/shell/frame-bridge.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter `frame-bridge.ts`**

```ts
import {
  type ComponentCall,
  FrameToHost,
  type HostToFrame,
  type InitMessage,
  isKiboErrorCode,
  type KeyCombo,
  KiboError,
  type Theme,
} from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";

export const MAX_IN_FLIGHT = 64;

export type BridgeDeps = {
  frame(): Window | null;
  init(): Omit<InitMessage, "kibo" | "type">;
  call(call: ComponentCall): Promise<unknown>;
  onOpenTicket(ticketId: string): void;
  onOpenNewTicket(defaults: NewTicketDefaults): void;
  onOpenFile(target: { path: string; line?: number }): void;
  onOpenView(componentId: string): void;
  onKey(combo: KeyCombo): void;
  onResize(height: number): void;
  log?: (line: string) => void;
};

const wireError = (e: unknown) => {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  console.error("[kibo-ui] component call failed", e);
  return { code: "INTERNAL", message: "internal error" };
};

export function createFrameBridge(deps: BridgeDeps): {
  handle(e: MessageEvent): void;
  changed(): void;
  theme(t: Theme): void;
  dispose(): void;
} {
  const log = deps.log ?? ((line: string) => console.warn(`[kibo-ui] ${line}`));
  let inFlight = 0;
  let disposed = false;
  const send = (msg: HostToFrame) => {
    if (!disposed) deps.frame()?.postMessage(msg, "*");
  };
  return {
    handle(e) {
      const frame = deps.frame();
      if (!frame || e.source !== frame) {
        log("message from another window ignored");
        return;
      }
      const parsed = FrameToHost.safeParse(e.data);
      if (!parsed.success) {
        log(`invalid frame message ignored: ${parsed.error.message}`);
        return;
      }
      const m = parsed.data;
      switch (m.type) {
        case "ready":
          send({ kibo: 1, type: "init", ...deps.init() });
          return;
        case "call": {
          if (inFlight >= MAX_IN_FLIGHT) {
            send({ kibo: 1, type: "reply", id: m.id, ok: false, error: { code: "TIMEOUT", message: "too many calls in flight" } });
            return;
          }
          inFlight += 1;
          deps.call(m.call).then(
            (result) => send({ kibo: 1, type: "reply", id: m.id, ok: true, result: result ?? null }),
            (err: unknown) => {
              const error = wireError(err);
              send({ kibo: 1, type: "reply", id: m.id, ok: false, error: { code: isKiboErrorCode(error.code) ? error.code : "INTERNAL", message: error.message } });
            },
          ).finally(() => {
            inFlight -= 1;
          });
          return;
        }
        case "openTicket":
          deps.onOpenTicket(m.ticketId);
          return;
        case "openNewTicket":
          deps.onOpenNewTicket(m.defaults);
          return;
        case "openFile":
          deps.onOpenFile(m.line === undefined ? { path: m.path } : { path: m.path, line: m.line });
          return;
        case "openView":
          deps.onOpenView(m.componentId);
          return;
        case "key":
          deps.onKey(m.combo);
          return;
        case "resize":
          deps.onResize(m.height);
          return;
      }
    },
    changed: () => send({ kibo: 1, type: "changed" }),
    theme: (theme) => send({ kibo: 1, type: "theme", theme }),
    dispose: () => {
      disposed = true;
    },
  };
}

export function dispatchCombo(combo: KeyCombo, target: EventTarget = window): void {
  if (combo === "escape") {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return;
  }
  const key = combo.slice("mod+".length);
  const mac = navigator.platform.startsWith("Mac");
  target.dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: mac, ctrlKey: !mac, bubbles: true }));
}
```
L'hôte n'envoie qu'à `iframe.contentWindow` avec `targetOrigin "*"` (origine opaque, spec §6.2) et ne filtre aucun appel : c'est le démon qui décide.

- [x] **Step 3: Tests et code du chargement trusted, des modules partagés et du thème**

`packages/ui/src/shell/shared-modules.test.ts` :
```ts
import { expect, test } from "bun:test";
import { SHARED_SPECIFIERS } from "@kibo/schema";
import { exposeSharedModules, SHARED_MODULES } from "./shared-modules";

test("every shared specifier except lucide-react is exposed to trusted modules", () => {
  expect(Object.keys(SHARED_MODULES).sort()).toEqual(SHARED_SPECIFIERS.filter((s) => s !== "lucide-react").sort());
  exposeSharedModules();
  expect(Reflect.get(globalThis, "__kiboShared")).toBe(SHARED_MODULES);
});
```

`packages/ui/src/shell/shared-modules.ts` :
```ts
import * as sdk from "@kibo/sdk";
import * as utils from "@kibo/sdk/lib/utils";
import * as badge from "@kibo/sdk/ui/badge";
import * as button from "@kibo/sdk/ui/button";
import * as card from "@kibo/sdk/ui/card";
import * as dialog from "@kibo/sdk/ui/dialog";
import * as dropdownMenu from "@kibo/sdk/ui/dropdown-menu";
import * as input from "@kibo/sdk/ui/input";
import * as label from "@kibo/sdk/ui/label";
import * as radioGroup from "@kibo/sdk/ui/radio-group";
import * as select from "@kibo/sdk/ui/select";
import * as separator from "@kibo/sdk/ui/separator";
import * as sheet from "@kibo/sdk/ui/sheet";
import * as skeleton from "@kibo/sdk/ui/skeleton";
import * as textarea from "@kibo/sdk/ui/textarea";
import * as tooltip from "@kibo/sdk/ui/tooltip";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";

export const SHARED_MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "@kibo/sdk": sdk,
  "@kibo/sdk/lib/utils": utils,
  "@kibo/sdk/ui/badge": badge,
  "@kibo/sdk/ui/button": button,
  "@kibo/sdk/ui/card": card,
  "@kibo/sdk/ui/dialog": dialog,
  "@kibo/sdk/ui/dropdown-menu": dropdownMenu,
  "@kibo/sdk/ui/input": input,
  "@kibo/sdk/ui/label": label,
  "@kibo/sdk/ui/radio-group": radioGroup,
  "@kibo/sdk/ui/select": select,
  "@kibo/sdk/ui/separator": separator,
  "@kibo/sdk/ui/sheet": sheet,
  "@kibo/sdk/ui/skeleton": skeleton,
  "@kibo/sdk/ui/textarea": textarea,
  "@kibo/sdk/ui/tooltip": tooltip,
};

export function exposeSharedModules(): void {
  Object.defineProperty(globalThis, "__kiboShared", { value: SHARED_MODULES, writable: false, configurable: false });
}
```
`exposeSharedModules` n'est appelée qu'une fois (dans `main.tsx`) ; dans le test, elle est appelée une fois par processus (le fichier de test est le seul à l'appeler).

`packages/ui/src/shell/trusted-loader.test.ts` :
```ts
import { expect, test } from "bun:test";
import { loadTrusted } from "./trusted-loader";

const H = "f".repeat(64);
const manifest = { id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [] };

test("the module is imported once, its CSS linked once, and its shape checked", async () => {
  const urls: string[] = [];
  const importer = async (url: string) => {
    urls.push(url);
    return { manifest, Component: () => null };
  };
  const a = await loadTrusted("mine", "1.0.0", H, importer);
  const b = await loadTrusted("mine", "1.0.0", H, importer);
  expect(a).toBe(b);
  expect(urls).toEqual([`/components/mine/1.0.0/${H}/ui.trusted.js`]);
  expect(document.querySelectorAll(`link[href="/components/mine/1.0.0/${H}/ui.css"]`)).toHaveLength(1);
  expect(a.manifest.title).toBe("Mine");
});

test("a module without a valid manifest or Component is refused", async () => {
  await expect(loadTrusted("bad", "1.0.0", H, async () => ({ manifest: {}, Component: () => null }))).rejects.toThrow("VALIDATION_FAILED");
  await expect(loadTrusted("bad2", "1.0.0", H, async () => ({ manifest }))).rejects.toThrow("VALIDATION_FAILED");
});

test("a failed import is not cached", async () => {
  let fail = true;
  const importer = async () => {
    if (fail) throw new Error("network");
    return { manifest: { ...manifest, id: "flaky" }, Component: () => null };
  };
  await expect(loadTrusted("flaky", "1.0.0", H, importer)).rejects.toThrow("network");
  fail = false;
  expect((await loadTrusted("flaky", "1.0.0", H, importer)).manifest.id).toBe("flaky");
});
```

`packages/ui/src/shell/trusted-loader.ts` :
```ts
import { ComponentManifest, KiboError, trustedPath } from "@kibo/schema";
import type { ComponentType } from "react";

export type TrustedModule = { manifest: ComponentManifest; Component: ComponentType };
type Importer = (url: string) => Promise<unknown>;

const cache = new Map<string, Promise<TrustedModule>>();
const defaultImporter: Importer = (url) => import(/* @vite-ignore */ url);

function linkCss(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function load(id: string, version: string, hash: string, importer: Importer): Promise<TrustedModule> {
  const mod = await importer(trustedPath(id, version, hash, "ui.trusted.js"));
  if (typeof mod !== "object" || mod === null) throw new KiboError("VALIDATION_FAILED", `${id}@${version} is not a module`);
  const manifest = ComponentManifest.safeParse(Reflect.get(mod, "manifest"));
  const Component: unknown = Reflect.get(mod, "Component");
  if (!manifest.success || typeof Component !== "function") {
    throw new KiboError("VALIDATION_FAILED", `${id}@${version} does not export manifest and Component`);
  }
  linkCss(trustedPath(id, version, hash, "ui.css"));
  return { manifest: manifest.data, Component: Component as ComponentType };
}

export function loadTrusted(id: string, version: string, hash: string, importer: Importer = defaultImporter): Promise<TrustedModule> {
  const url = trustedPath(id, version, hash, "ui.trusted.js");
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = load(id, version, hash, importer);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}
```
Le cast `Component as ComponentType` suit la vérification `typeof === "function"` (un composant React est une fonction). Le `catch` ne fait que retirer l'entrée du cache : la promesse rejetée est rendue à l'appelant, qui affiche l'erreur.

`packages/ui/src/theme.ts` (ajouts) :
```ts
import type { Theme } from "@kibo/schema";
import { useSyncExternalStore } from "react";

export const currentTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export const useTheme = (): Theme => useSyncExternalStore(subscribeTheme, currentTheme);
```

`packages/ui/src/state/use-runtime-info.ts` :
```ts
import { KiboError, type RuntimeInfo } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

let cached: Promise<RuntimeInfo> | null = null;

export function useRuntimeInfo(): { info: RuntimeInfo | null; error: boolean } {
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    cached ??= client.rpc({ method: "getRuntimeInfo" });
    let live = true;
    cached.then(
      (i) => live && setInfo(i),
      (e: unknown) => {
        cached = null;
        if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
        console.error(e);
        if (live) setError(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return { info, error };
}
```

`packages/ui/src/main.tsx` : `import { exposeSharedModules } from "./shell/shared-modules";` puis `exposeSharedModules();` juste après `followSystemTheme();`.

- [x] **Step 4: Implémenter `SandboxFrame.tsx`**

```tsx
import type { Surface } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { useTheme } from "../theme";
import { createFrameBridge, dispatchCombo } from "./frame-bridge";
import { useHost } from "./Host";

type Props = {
  projectId: string;
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  src: string;
  title: string;
};

export function SandboxFrame({ projectId, instanceId, config, viewer, surface, src, title }: Props) {
  const host = useHost();
  const theme = useTheme();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const latest = useRef({ config, viewer, theme, surface, host });
  latest.current = { config, viewer, theme, surface, host };
  const bridge = useRef<ReturnType<typeof createFrameBridge> | null>(null);

  useEffect(() => {
    const b = createFrameBridge({
      frame: () => ref.current?.contentWindow ?? null,
      init: () => ({
        instanceId,
        config: latest.current.config,
        viewer: latest.current.viewer,
        theme: latest.current.theme,
        surface: latest.current.surface,
      }),
      call: (call) => client.rpc({ method: "componentCall", projectId, instanceId, call }),
      onOpenTicket: (id) => latest.current.host.openTicket(id),
      onOpenNewTicket: (d) => latest.current.host.openNewTicket(d),
      onOpenFile: (t) => latest.current.host.openFile(t),
      onOpenView: (id) => latest.current.host.openView(id),
      onKey: (combo) => dispatchCombo(combo),
      onResize: (h) => setHeight(h),
    });
    bridge.current = b;
    window.addEventListener("message", b.handle);
    const off = client.subscribe((id) => {
      if (id === projectId || id === null) b.changed();
    });
    return () => {
      window.removeEventListener("message", b.handle);
      off();
      b.dispose();
      bridge.current = null;
    };
  }, [projectId, instanceId]);

  useEffect(() => {
    bridge.current?.theme(theme);
  }, [theme]);

  return (
    <iframe
      ref={ref}
      title={title}
      src={src}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-transparent"
      style={surface === "widget" && height !== null ? { height } : { height: "100%" }}
    />
  );
}
```
Pas de `allow-same-origin` : le document a une origine opaque. Changement de config : `SandboxFrame` est rendu avec `key={instance.component + JSON.stringify(instance.config)}` par la tâche 28, ce qui recrée l'iframe et renvoie `init`.

- [x] **Step 5: Vérifier et committer**

Run: `bun test packages/ui && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/ui/src/shell/frame-bridge.ts packages/ui/src/shell/frame-bridge.test.ts packages/ui/src/shell/SandboxFrame.tsx packages/ui/src/shell/trusted-loader.ts packages/ui/src/shell/trusted-loader.test.ts packages/ui/src/shell/shared-modules.ts packages/ui/src/shell/shared-modules.test.ts packages/ui/src/state/use-runtime-info.ts packages/ui/src/theme.ts packages/ui/src/main.tsx
git commit -m "feat(ui): iframe sandboxée et modules trusted"
```

---

### Task 24: UI, page Composants (écran 6) et dialogue de publication

**Files:**
- Create: `packages/sdk/src/ui/table.tsx`, `packages/ui/src/lib/use-flash.ts`, `packages/ui/src/components-page/rows.ts`, `packages/ui/src/components-page/rows.test.ts`, `packages/ui/src/components-page/ComponentsPage.tsx`, `packages/ui/src/components-page/ComponentRowMenu.tsx`, `packages/ui/src/components-page/PublishDialog.tsx`, `packages/ui/src/components-page/DraftsSection.tsx`, `packages/ui/src/components-page/components-page.test.tsx`
- Modify: `packages/ui/src/route.ts` (ou le système d'onglets de la phase 3, voir étape 5), `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/shell/AppSidebar.tsx`, `packages/ui/src/i18n/fr.ts` (sections `components`, `publish` et `nav`)

**Interfaces:**
- Consumes: `useComponents` (tâche 19) ; `TrustDialog`, `trustTargetOf` (tâche 19) ; `useProjects` ; `BUILTIN_COMPONENTS`, `componentIcon` ; RPC `previewPublish`, `publishComponent`, `rehashComponent`, `revokeComponent`, `uninstallComponent`, `listComponents` ; `ComponentSummary`, `PublishPreview`, `PublishResult`, `KiboError` (tâche 2).
- Produces:
  - `type ComponentRow = { key: string; id: string; title: string; version: string; builtin: boolean; trust: "builtin" | "trusted" | "sandboxed" | "pending"; tampered: boolean; origin: ComponentOrigin; pages: number; projects: number; used: boolean; summary: ComponentVersionSummary | null }` ; `componentRows(components: ComponentSummary[]): ComponentRow[]` (intégrés depuis `BUILTIN_COMPONENTS`, une ligne par version installée, tri par titre puis version décroissante).
  - `useFlash(): { message: string | null; tone: "ok" | "error"; flash(message: string, tone?: "ok" | "error"): void }` (message de statut affiché 4 s ; remplace les toasts, l'UI n'a pas de `Toaster`).
  - `ComponentsPage()` ; `PublishDialog({ id, open, onOpenChange })` ; `ComponentRowMenu({ row, onDone })` ; `DraftsSection({ drafts, onPublish })`.
  - Route `#/components` (`Route` gagne `screen: "components" | null`) et `navigateToComponents()`, ou cible d'onglet `{ kind: "components" }` si la phase 3 a livré les onglets.

Fidélité : écran 6 (page 10 du PDF). Tableau dans une carte arrondie, en-têtes en `text-xs text-muted-foreground`, colonnes Composant · Version (`font-mono`) · Confiance · Origine · Utilisé dans · `⋯` ; « Sandboxé » et « Autorisation requise » en `text-orange-600 dark:text-orange-400` (comme la maquette) ; dialogue « Publier « PR en attente » 0.4.0 » : encadré « Utilisé dans 3 projets » (pastille couleur du projet, `Projet › Page`, version en mono, état à droite), « Changements » (`+` vert pour le manifeste, `+` orange pour une permission, `~` bleu pour la migration), deux cartes radio, la carte choisie en `border-orange-600 bg-orange-50 dark:bg-orange-950/60`, pied « Annuler » / « Publier 0.4.0 ». États à dessiner D3, D5, D10.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr.ts` : `nav` gagne `components: "Composants"` ; `publish` gagne `keep: "Inchangée"` et `loading: "Validation en cours…"` ; `components` gagne `loading: "Chargement…"` ; `common` gagne `close: "Fermer"`.

- [x] **Step 2: Ajouter la primitive `table`**

`packages/sdk/src/ui/table.tsx` (composant shadcn `table`, sans modification ; ajouté par `bunx shadcn@4.21.0 add table` dans `packages/sdk` ou recopié tel quel) :
```tsx
import type * as React from "react";
import { cn } from "../lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("h-10 px-3 text-left align-middle text-xs font-normal whitespace-nowrap text-muted-foreground", className)}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-3 py-2.5 align-middle whitespace-nowrap", className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
```
`table` n'entre pas dans `SDK_UI_PRIMITIVES` (réservée à l'UI en v0.4 ; l'exposer aux composants tiers demanderait de figer une nouvelle interface).

- [x] **Step 3: Écrire les tests**

`packages/ui/src/components-page/rows.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { ComponentSummary } from "@kibo/schema";
import { componentRows } from "./rows";

const usage = (projectId: string, pageId: string) => ({ projectId, projectName: projectId, pageId, pageTitle: pageId, instanceId: `${projectId}-${pageId}` });

test("built-ins come from the UI registry, installed versions one row each, sorted by title", () => {
  const summaries: ComponentSummary[] = [
    { id: "kanban", title: "kanban", builtin: true, versions: [{ version: "1.0.0", hash: null, trust: "builtin", origin: "kibo", active: true, tampered: false, manifest: null, usages: [usage("p1", "a"), usage("p1", "b"), usage("p2", "c")] }] },
    {
      id: "pr-queue",
      title: "PR en attente",
      builtin: false,
      versions: [
        { version: "0.3.0", hash: "a".repeat(64), trust: "sandboxed", origin: "ai", active: true, tampered: false, manifest: null, usages: [usage("p1", "a")] },
        { version: "0.4.0", hash: "b".repeat(64), trust: null, origin: "ai", active: false, tampered: false, manifest: null, usages: [] },
      ],
    },
  ];
  expect(componentRows(summaries).map((r) => [r.title, r.version, r.trust, r.pages, r.projects, r.used])).toEqual([
    ["Kanban", "1.0.0", "builtin", 3, 2, true],
    ["PR en attente", "0.4.0", "pending", 0, 0, false],
    ["PR en attente", "0.3.0", "sandboxed", 1, 1, true],
    ["Tickets", "1.0.0", "builtin", 0, 0, false],
  ]);
});
```
(La liste des intégrés vient de `BUILTIN_COMPONENTS` : si la tâche 29 a déjà ajouté Graphe et Notes à la date d'exécution, ajouter leurs lignes attendues — « Graphe de dépendances » et « Notes » — à la place attendue par le tri.)

`packages/ui/src/components-page/components-page.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentSummary,
  type DraftSummary,
  KiboError,
  type PublishPreview,
  type PublishResult,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const H = "a".repeat(64);
const calls: RpcRequest[] = [];
let components: ComponentSummary[] = [];
let drafts: DraftSummary[] = [];
let preview: () => Promise<PublishPreview> = async () => {
  throw new Error("unset");
};
let publish: () => Promise<PublishResult> = async () => {
  throw new Error("unset");
};
let action: () => Promise<unknown> = async () => null;

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "listDrafts") return Promise.resolve(drafts);
      if (req.method === "listProjects") return Promise.resolve([{ id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#F97316", counts: {} }]);
      if (req.method === "previewPublish") return preview();
      if (req.method === "publishComponent") return publish();
      return action();
    },
    subscribe: () => () => undefined,
  },
}));

const { ComponentsPage } = await import("./ComponentsPage");

const prQueue = (versions: ComponentSummary["versions"]): ComponentSummary => ({ id: "pr-queue", title: "PR en attente", builtin: false, versions });
const v030 = {
  version: "0.3.0",
  hash: H,
  trust: "sandboxed" as const,
  origin: "ai" as const,
  active: true,
  tampered: false,
  manifest: null,
  usages: [{ projectId: "p1", projectName: "Kibo", pageId: "pg", pageTitle: "Tableau de bord", instanceId: "i1" }],
};
const basePreview: PublishPreview = {
  id: "pr-queue",
  title: "PR en attente",
  from: "0.3.0",
  to: "0.4.0",
  hash: "b".repeat(64),
  status: "update",
  usages: [{ ...v030.usages[0]!, version: "0.3.0" }],
  changes: ["Filtre par auteur de la PR"],
  newPermissions: ["net:api.github.com/graphql"],
  migration: { from: 0, to: 1 },
  validation: {
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: true, errors: [] },
    tests: { ok: true, passed: 9, failed: 0, output: "" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: "b".repeat(64),
    ok: true,
  },
};

beforeEach(() => {
  calls.length = 0;
  components = [prQueue([v030])];
  drafts = [{ id: "pr-queue", title: "PR en attente", version: "0.4.0", hash: "b".repeat(64), validated: true, publishedVersion: "0.3.0" }];
  preview = async () => basePreview;
  publish = async () => ({ version: { ...basePreview, version: "0.4.0" } as never, needsApproval: false, updated: ["i1"], failed: [] });
  action = async () => null;
});

test("screen 6: the table lists built-ins and installed versions", async () => {
  render(<ComponentsPage />);
  const row = (await screen.findByText("PR en attente")).closest("tr");
  expect(row && within(row).getByText("0.3.0")).toBeTruthy();
  expect(row && within(row).getByText("Sandboxé")).toBeTruthy();
  expect(row && within(row).getByText("IA")).toBeTruthy();
  expect(row && within(row).getByText("1 page · 1 projet")).toBeTruthy();
  const kanban = screen.getByText("Kanban").closest("tr");
  expect(kanban && within(kanban).getByText("Intégré")).toBeTruthy();
  expect(kanban && within(kanban).getByRole("button", { name: "Actions Kanban 1.0.0" }).hasAttribute("disabled")).toBe(true);
});

test("publishing: usages, changes, strategy, then the report", async () => {
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Publier" }));
  expect(await screen.findByText("Publier « PR en attente » 0.4.0")).toBeTruthy();
  expect(screen.getByText("Utilisé dans 1 projet")).toBeTruthy();
  expect(screen.getByText("Filtre par auteur de la PR")).toBeTruthy();
  expect(screen.getByText("Permission net:api.github.com/graphql")).toBeTruthy();
  expect(screen.getByText("Migration de config v0 → v1 (automatique)")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Mettre à jour partout/ }).getAttribute("data-state")).toBe("checked");
  await user.click(screen.getByRole("radio", { name: /Créer une nouvelle version/ }));
  expect(screen.getByText("Inchangée")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /Mettre à jour partout/ }));
  await user.click(screen.getByRole("button", { name: "Publier 0.4.0" }));
  await waitFor(() => expect(calls.some((c) => c.method === "publishComponent")).toBe(true));
  expect(calls.find((c) => c.method === "publishComponent")).toEqual({ method: "publishComponent", id: "pr-queue", strategy: "update-all" });
  expect(await screen.findByText("Version 0.4.0 publiée.")).toBeTruthy();
});

test("D10: a partial failure lists the instances left behind", async () => {
  publish = async () => ({
    version: {} as never,
    needsApproval: false,
    updated: [],
    failed: [{ instanceId: "i1", projectName: "Kibo", pageTitle: "Tableau de bord", code: "MIGRATION_FAILED", message: "config invalide" }],
  });
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Publier" }));
  await user.click(await screen.findByRole("button", { name: "Publier 0.4.0" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("1 instance n'a pas pu être migrée et reste sur l'ancienne version.");
  expect(alert.textContent).toContain("Kibo › Tableau de bord — config invalide");
});

test("publishing errors are explained", async () => {
  for (const [error, text] of [
    [new KiboError("VERSION_EXISTS", "x"), "Cette version existe déjà avec un autre code. Change la version dans kibo.component.json."],
    [new KiboError("INVALID_INPUT", "x"), "La version doit être plus haute que la dernière publiée."],
  ] as const) {
    preview = async () => {
      throw error;
    };
    const { unmount } = render(<ComponentsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    unmount();
  }
  preview = async () => ({ ...basePreview, status: "unchanged" });
  render(<ComponentsPage />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Publier" }));
  expect(await screen.findByText("Rien à publier : cette version est déjà publiée avec le même code.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publier 0.4.0" })).toBeNull();
});

test("D3: rehash, revoke and uninstall from the ⋯ menu", async () => {
  components = [prQueue([{ ...v030, usages: [] }])];
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Revérifier l'empreinte" }));
  expect(await screen.findByText("Empreinte vérifiée.")).toBeTruthy();
  action = async () => {
    throw new KiboError("TRUST_REQUIRED", "changed");
  };
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Revérifier l'empreinte" }));
  expect(await screen.findByText("L'empreinte a changé : la confiance est redemandée.")).toBeTruthy();
  action = async () => null;
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Désinstaller" }));
  expect(calls.at(-1)).toEqual({ method: "uninstallComponent", id: "pr-queue", version: "0.3.0" });
});

test("a used version cannot be uninstalled; a pending one can be reviewed", async () => {
  components = [prQueue([v030, { ...v030, version: "0.4.0", hash: "b".repeat(64), trust: null, active: false, usages: [] }])];
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente 0.3.0" }));
  expect((await screen.findByRole("menuitem", { name: "Désinstaller" })).getAttribute("aria-disabled")).toBe("true");
  await user.keyboard("{Escape}");
  const pending = screen.getByText("Autorisation requise").closest("tr");
  expect(pending && within(pending).getByRole("button", { name: "Examiner" })).toBeTruthy();
});

test("drafts: validated ones can be published, others show the command", async () => {
  drafts = [
    { id: "pr-queue", title: "PR en attente", version: "0.4.0", hash: "b".repeat(64), validated: true, publishedVersion: "0.3.0" },
    { id: "burndown", title: "Burndown", version: "0.1.0", hash: null, validated: false, publishedVersion: null },
  ];
  render(<ComponentsPage />);
  expect(await screen.findByText("Brouillons")).toBeTruthy();
  expect(screen.getByText("Tests verts")).toBeTruthy();
  expect(screen.getByText("À valider : kibo component test burndown")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Publier" })).toHaveLength(1);
});
```
Les casts `as never` sur `version` sont limités au test (le champ n'est pas affiché).

Run: `bun test packages/ui/src/components-page`
Expected: FAIL.

- [x] **Step 4: Implémenter `use-flash.ts`, `rows.ts`, `ComponentRowMenu.tsx`, `DraftsSection.tsx`**

`packages/ui/src/lib/use-flash.ts` :
```ts
import { useCallback, useEffect, useRef, useState } from "react";

export function useFlash(ms = 4_000): { message: string | null; tone: "ok" | "error"; flash(message: string, tone?: "ok" | "error"): void } {
  const [state, setState] = useState<{ message: string | null; tone: "ok" | "error" }>({ message: null, tone: "ok" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const flash = useCallback(
    (message: string, tone: "ok" | "error" = "ok") => {
      if (timer.current) clearTimeout(timer.current);
      setState({ message, tone });
      timer.current = setTimeout(() => setState((s) => ({ ...s, message: null })), ms);
    },
    [ms],
  );
  return { ...state, flash };
}
```

`packages/ui/src/components-page/rows.ts` :
```ts
import { type ComponentOrigin, type ComponentSummary, type ComponentVersionSummary, compareSemver } from "@kibo/schema";
import { BUILTIN_COMPONENTS } from "../registry";

export type ComponentRow = {
  key: string;
  id: string;
  title: string;
  version: string;
  builtin: boolean;
  trust: "builtin" | "trusted" | "sandboxed" | "pending";
  tampered: boolean;
  origin: ComponentOrigin;
  pages: number;
  projects: number;
  used: boolean;
  summary: ComponentVersionSummary | null;
};

const counts = (usages: ComponentVersionSummary["usages"]) => ({
  pages: new Set(usages.map((u) => `${u.projectId}/${u.pageId}`)).size,
  projects: new Set(usages.map((u) => u.projectId)).size,
  used: usages.length > 0,
});

export function componentRows(components: ComponentSummary[]): ComponentRow[] {
  const builtins = BUILTIN_COMPONENTS.map(({ manifest: m }): ComponentRow => {
    const usages = components.find((c) => c.builtin && c.id === m.id)?.versions.flatMap((v) => v.usages) ?? [];
    return { key: m.id, id: m.id, title: m.title, version: m.version, builtin: true, trust: "builtin", tampered: false, origin: "kibo", ...counts(usages), summary: null };
  });
  const installed = components
    .filter((c) => !c.builtin)
    .flatMap((c) =>
      c.versions.map((v): ComponentRow => ({
        key: `${c.id}@${v.version}`,
        id: c.id,
        title: c.title,
        version: v.version,
        builtin: false,
        trust: v.active && (v.trust === "trusted" || v.trust === "sandboxed") ? v.trust : "pending",
        tampered: v.tampered,
        origin: v.origin,
        ...counts(v.usages),
        summary: v,
      })),
    );
  return [...builtins, ...installed].sort(
    (a, b) => a.title.localeCompare(b.title, "fr") || compareSemver(b.version, a.version),
  );
}
```

`packages/ui/src/components-page/ComponentRowMenu.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Ellipsis, ScanSearch, ShieldOff, Trash2 } from "lucide-react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import type { ComponentRow } from "./rows";

type Props = { row: ComponentRow; onDone(message: string, tone: "ok" | "error"): void };

export function ComponentRowMenu({ row, onDone }: Props) {
  const c = fr.components;
  const label = c.actions(row.title, row.version);
  if (row.builtin) {
    return (
      <Button size="icon" variant="ghost" className="size-7" aria-label={label} disabled>
        <Ellipsis aria-hidden />
      </Button>
    );
  }
  const run = async (work: () => Promise<unknown>, ok: string, onError?: (e: unknown) => string | null) => {
    try {
      await work();
      onDone(ok, "ok");
    } catch (e) {
      const custom = onError?.(e) ?? null;
      if (custom === null) console.error(e);
      onDone(custom ?? c.actionFailed, "error");
    }
  };
  const ref = { id: row.id, version: row.version };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7" aria-label={label}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            void run(() => client.rpc({ method: "rehashComponent", ...ref }), c.rehashOk, (e) =>
              e instanceof KiboError && e.code === "TRUST_REQUIRED" ? c.rehashChanged : null,
            )
          }
        >
          <ScanSearch aria-hidden />
          {c.rehash}
        </DropdownMenuItem>
        {row.trust !== "pending" && (
          <DropdownMenuItem onSelect={() => void run(() => client.rpc({ method: "revokeComponent", ...ref }), c.revoke)}>
            <ShieldOff aria-hidden />
            {c.revoke}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {row.used ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem disabled variant="destructive">
                <Trash2 aria-hidden />
                {c.uninstall}
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent>{c.uninstallBlocked}</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void run(() => client.rpc({ method: "uninstallComponent", ...ref }), c.uninstall)}
          >
            <Trash2 aria-hidden />
            {c.uninstall}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
Le message de succès de « Retirer la confiance » et « Désinstaller » reprend le libellé de l'action (la ligne disparaît ou change d'état sous les yeux de l'utilisateur ; pas de texte dédié à inventer). Si `TooltipProvider` n'est pas monté au-dessus (`Shell`), l'envelopper localement dans `<TooltipProvider>`.

`packages/ui/src/components-page/DraftsSection.tsx` :
```tsx
import type { DraftSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "../i18n/fr";

export function DraftsSection({ drafts, onPublish }: { drafts: DraftSummary[]; onPublish(id: string): void }) {
  if (drafts.length === 0) return null;
  const c = fr.components;
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">{c.drafts}</h2>
      <ul className="divide-y rounded-lg border">
        {drafts.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className="flex-1 font-medium">{d.title}</span>
            <span className="font-mono text-xs text-muted-foreground">{d.version}</span>
            {d.validated ? (
              <>
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">{c.draftValidated}</span>
                <Button size="sm" variant="outline" onClick={() => onPublish(d.id)}>
                  {c.publish}
                </Button>
              </>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.draftPending(d.id)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [x] **Step 5: Implémenter `PublishDialog.tsx` et `ComponentsPage.tsx`**

`packages/ui/src/components-page/PublishDialog.tsx` :
```tsx
import { KiboError, type PublishPreview, type PublishResult } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { useProjects } from "../state/use-projects";

type Strategy = "update-all" | "new-version";
type Props = { id: string; open: boolean; onOpenChange(o: boolean): void; onPublished?(result: PublishResult): void };

function explain(e: unknown, id: string): string {
  const p = fr.publish;
  if (!(e instanceof KiboError)) {
    console.error(e);
    return p.failed;
  }
  if (e.code === "VERSION_EXISTS") return p.versionExists;
  if (e.code === "INVALID_INPUT") return p.versionTooLow;
  if (e.code === "VALIDATION_FAILED") return p.invalid(id);
  return p.failed;
}

function StrategyCard({ value, title, help }: { value: Strategy; title: string; help: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-orange-600 has-[[data-state=checked]]:bg-orange-50 dark:has-[[data-state=checked]]:bg-orange-950/60"
    >
      <RadioGroupItem id={id} value={value} aria-label={title} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="text-sm font-medium leading-none">{title}</span>
        <span className="text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}

export function PublishDialog({ id, open, onOpenChange, onPublished }: Props) {
  const p = fr.publish;
  const projects = useProjects() ?? [];
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setPreview(null);
    setError(null);
    setResult(null);
    client.rpc({ method: "previewPublish", id }).then(
      (pv) => live && setPreview(pv),
      (e: unknown) => live && setError(explain(e, id)),
    );
    return () => {
      live = false;
    };
  }, [id, open]);

  const submit = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const r = await client.rpc({ method: "publishComponent", id, strategy: preview.usages.length > 0 ? strategy : "new-version" });
      setResult(r);
      onPublished?.(r);
      if (r.needsApproval) {
        const list = await client.rpc({ method: "listComponents" });
        const v = list.find((c) => c.id === id)?.versions.find((x) => x.version === preview.to);
        const target = v ? trustTargetOf(id, preview.title, v) : null;
        if (target) setTrust(target);
      }
    } catch (e) {
      setError(explain(e, id));
    } finally {
      setBusy(false);
    }
  };

  const colorOf = (projectId: string) => projects.find((x) => x.id === projectId)?.color ?? "#71717A";
  const projectCount = preview ? new Set(preview.usages.map((u) => u.projectId)).size : 0;
  const publishable = preview !== null && preview.status !== "unchanged" && preview.validation.ok && result === null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{preview ? p.title(preview.title, preview.to) : p.loading}</DialogTitle>
            {preview && preview.usages.length > 0 && <DialogDescription>{p.subtitle}</DialogDescription>}
          </DialogHeader>
          {!preview && !error && <Skeleton className="h-40 w-full" />}
          {preview?.status === "unchanged" && <p className="text-sm text-muted-foreground">{p.unchanged}</p>}
          {preview && !preview.validation.ok && (
            <div role="alert" className="grid gap-1 text-sm text-destructive">
              <p>{p.invalid(id)}</p>
              {[
                ...preview.validation.manifest.errors,
                ...preview.validation.imports.errors,
                ...preview.validation.typecheck.errors,
                ...preview.validation.conformance.errors,
                ...preview.validation.permissions.errors,
              ].map((line) => (
                <p key={line} className="font-mono text-xs">
                  {line}
                </p>
              ))}
            </div>
          )}
          {publishable && preview.usages.length > 0 && (
            <div className="grid gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{p.usedIn(projectCount)}</p>
              {preview.usages.map((u) => (
                <div key={u.instanceId} className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: colorOf(u.projectId) }} />
                  <span>{u.projectName}</span>
                  <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 text-muted-foreground">{u.pageTitle}</span>
                  <span className="font-mono text-xs text-muted-foreground">{u.version}</span>
                  <span className="text-xs text-muted-foreground">{strategy === "update-all" ? p.updateOne : p.keep}</span>
                </div>
              ))}
            </div>
          )}
          {publishable && (preview.changes.length > 0 || preview.newPermissions.length > 0 || preview.migration) && (
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{p.changes}</p>
              <ul className="grid gap-1 text-muted-foreground">
                {preview.changes.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="text-green-600 dark:text-green-400">+</span>
                    <span>{c}</span>
                  </li>
                ))}
                {preview.newPermissions.map((perm) => (
                  <li key={perm} className="flex gap-2">
                    <span aria-hidden className="text-orange-600 dark:text-orange-400">+</span>
                    <span>{p.permission(perm)}</span>
                  </li>
                ))}
                {preview.migration && (
                  <li className="flex gap-2">
                    <span aria-hidden className="text-blue-600 dark:text-blue-400">~</span>
                    <span>{p.migration(preview.migration.from, preview.migration.to)}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {publishable && preview.usages.length > 0 && (
            <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v === "new-version" ? "new-version" : "update-all")} className="grid gap-2">
              <StrategyCard
                value="update-all"
                title={p.updateAll}
                help={p.updateAllHelp(preview.usages.length, preview.to, preview.newPermissions.length > 0)}
              />
              <StrategyCard value="new-version" title={p.newVersion} help={p.newVersionHelp(preview.from ?? preview.to)} />
            </RadioGroup>
          )}
          {result && result.failed.length === 0 && (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {p.done(preview?.to ?? "")}
            </p>
          )}
          {result && result.failed.length > 0 && (
            <div role="alert" className="grid gap-1 text-sm text-destructive">
              <p>{p.partial(result.failed.length)}</p>
              {result.failed.map((f) => (
                <p key={f.instanceId}>{`${f.projectName} › ${f.pageTitle} — ${f.message}`}</p>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {result ? fr.common.close : fr.common.cancel}
            </Button>
            {publishable && (
              <Button disabled={busy} onClick={() => void submit()}>
                {p.submit(preview.to)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {trust && <TrustDialog target={trust} mode="approve" open onOpenChange={(o) => !o && setTrust(null)} onApproved={() => setTrust(null)} />}
    </>
  );
}
```
Sans usage, la stratégie envoyée est `new-version` (aucune instance à migrer, spec §7.2 étape 3 : publication directe).

`packages/ui/src/components-page/ComponentsPage.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { useState } from "react";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { useComponents } from "../state/use-components";
import { ComponentRowMenu } from "./ComponentRowMenu";
import { DraftsSection } from "./DraftsSection";
import { PublishDialog } from "./PublishDialog";
import { type ComponentRow, componentRows } from "./rows";

const ORANGE = "text-orange-600 dark:text-orange-400";

function TrustCell({ row, onReview }: { row: ComponentRow; onReview(): void }) {
  const t = fr.components.trust;
  if (row.trust === "pending") {
    return (
      <span className="flex items-center gap-2">
        <span className={ORANGE}>{t.pending}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={onReview} disabled={row.tampered}>
          {fr.components.review}
        </Button>
      </span>
    );
  }
  return <span className={row.trust === "sandboxed" ? ORANGE : "text-muted-foreground"}>{t[row.trust]}</span>;
}

export function ComponentsPage() {
  const c = fr.components;
  const { components, drafts, error, reload } = useComponents();
  const { message, tone, flash } = useFlash();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const rows = components ? componentRows(components) : null;

  return (
    <div className="grid content-start gap-6 overflow-auto p-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c.column.name}</TableHead>
              <TableHead>{c.column.version}</TableHead>
              <TableHead>{c.column.trust}</TableHead>
              <TableHead>{c.column.origin}</TableHead>
              <TableHead>{c.column.usedIn}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.version}</TableCell>
                <TableCell>
                  <TrustCell
                    row={row}
                    onReview={() => {
                      const target = row.summary ? trustTargetOf(row.id, row.title, row.summary) : null;
                      if (target) setTrust(target);
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{c.origin[row.origin]}</TableCell>
                <TableCell className="text-muted-foreground">{c.usage(row.pages, row.projects)}</TableCell>
                <TableCell>
                  <ComponentRowMenu
                    row={row}
                    onDone={(m, t) => {
                      flash(m, t);
                      reload();
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && !error && <p className="p-4 text-sm text-muted-foreground">{c.loading}</p>}
      </div>
      {rows && rows.every((r) => r.builtin) && <p className="text-sm text-muted-foreground">{c.empty}</p>}
      {message && (
        <p role={tone === "error" ? "alert" : "status"} className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {c.failed}
        </p>
      )}
      <DraftsSection drafts={drafts ?? []} onPublish={setPublishing} />
      {publishing && (
        <PublishDialog id={publishing} open onOpenChange={(o) => !o && setPublishing(null)} onPublished={() => reload()} />
      )}
      {trust && (
        <TrustDialog
          target={trust}
          mode="approve"
          open
          onOpenChange={(o) => !o && setTrust(null)}
          onApproved={() => {
            setTrust(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
```
Une version altérée n'est pas « examinable » (bouton désactivé) : son code sur disque ne correspond plus à l'empreinte publiée, il faut republier (le menu propose « Revérifier l'empreinte »).

- [x] **Step 6: Navigation (route ou onglet) et entrée de la barre latérale**

Vérifier d'abord : `grep -rn "openTarget\|kind: \"changes\"" packages/ui/src`.

- **Onglets de la phase 3 présents** : ajouter la cible `{ kind: "components" }` au type de cible d'onglet (titre `fr.nav.components`, icône `Puzzle`), la rendre avec `<ComponentsPage />` à l'endroit où les autres cibles sont rendues, et `openTarget({ kind: "components" })` depuis la barre latérale.
- **Sinon** (repli) : `packages/ui/src/route.ts` :
```ts
export type Route = { projectId: string | null; pageId: string | null; screen: "components" | null };

function parse(hash: string): Route {
  if (hash === "#/components") return { projectId: null, pageId: null, screen: "components" };
  const m = /^#\/p\/([^/]+)(?:\/([^/]+))?/.exec(hash);
  return { projectId: m?.[1] ?? null, pageId: m?.[2] ? decodeURIComponent(m[2]) : null, screen: null };
}

export function navigateToComponents(): void {
  location.hash = "#/components";
}
```
Dans `Shell.tsx` : `{route.screen === "components" && <ComponentsPage />}` et `!route.projectId && route.screen === null` pour la Vue d'ensemble ; le fil d'Ariane affiche `fr.nav.components`.

`AppSidebar.tsx` : un `SidebarFooter` (importé de `@kibo/sdk/ui/sidebar`) contenant un `SidebarMenuButton` « Composants » (icône `Puzzle`) actif sur l'écran Composants, placé au-dessus de « Paramètres » si cette entrée existe déjà (maquettes : bas de la barre latérale).

Test à ajouter à `packages/ui/src/shell/shell.test.tsx` (ou au fichier de test des routes de la phase 3) :
```tsx
test("the sidebar opens the Components screen", async () => {
  renderShell();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Composants" }));
  expect(await screen.findByRole("columnheader", { name: "Confiance" })).toBeTruthy();
});
```
(`renderShell` : l'aide de rendu existante du fichier ; le faux client répond `[]` à `listComponents` et `listDrafts`.)

- [x] **Step 7: Vérifier et committer**

Run: `bun test packages/ui && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/sdk/src/ui/table.tsx packages/ui/src/lib/use-flash.ts packages/ui/src/components-page packages/ui/src/route.ts packages/ui/src/shell packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): page Composants et publication"
```

---

### Task 25: Graphe, vue (écran 10) et widget (écran 7)

**Files:**
- Create: `components/graph/src/filter.ts`, `components/graph/src/filter.test.ts`, `components/graph/src/fr.ts`, `components/graph/src/GraphCanvas.tsx`, `components/graph/src/GraphView.tsx`, `components/graph/src/GraphWidget.tsx`, `components/graph/src/index.ts`, `components/graph/src/graph.test.tsx`

**Interfaces:**
- Consumes: `criticalPath`, `compareKeys`, `layoutGraph`, `NODE_W`, `NODE_H`, `GraphTicket`, `GraphEdge`, `NodePosition` (tâche 10) ; `useSdk`, `useEntities`, `StatusDot`, `SdkProvider` (SDK) ; `createMockSdk`, `runConformance`, `seedDemo` (tâche 12) ; `TicketView`, `Link`, `ComponentManifest` (schéma).
- Produces:
  - `type GraphFilter = { assignee: "mine-and-agents" | "all"; hideDone: boolean; domain: string | null }` ; `graphInput(tickets: TicketView[], links: Link[], f: GraphFilter, viewer: string): { tickets: TicketView[]; edges: GraphEdge[] }` ; `domainsOf(tickets): string[]`.
  - `@kibo/component-graph` : `manifest`, `Component` (vue si `sdk.surface === "view"`, widget sinon).

Fidélité : écran 10 (page 16 du PDF) et widget de l'écran 7 (page 13). Vue : barre d'outils (boutons `outline` de 28 px : « Hiérarchique » pressé et désactivé — point E3 —, « Chemin critique » bascule pressée par défaut, « Masquer terminés » bascule, « Filtrer » avec icône entonnoir ouvrant un menu Assigné / Domaine) ; à droite « Chemin critique : 3 tickets · 1 bloqué » ; fond à points (`radial-gradient` 1 px tous les 16 px) ; nœud `176 × 52` arrondi 6 px, `bg-card`, bordure, ligne 1 : pastille de statut + clé en `font-mono text-xs text-muted-foreground`, à droite icône `Bot` si l'assigné est un agent ; ligne 2 : titre tronqué `text-sm font-medium` ; ticket terminé à 45 % d'opacité ; nœud du chemin critique : bordure 2 px `border-foreground` ; arêtes `blocks` courbes avec flèche, `relates` pointillées, arêtes du chemin critique en trait 2 px `stroke-foreground` ; légende en bas à gauche (Bloque, Chemin critique, Lié à) ; zoom en bas à droite `+ | 100 % | −`. Pastille d'état du run d'agent (orange « attend », cyan « en file ») à côté de l'icône `Bot` : le graphe lit `run` en lecture seule, comme le Kanban (spec §8.1).

- [x] **Step 1: Écrire les tests**

`components/graph/src/filter.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { Link, TicketView } from "@kibo/schema";
import { domainsOf, graphInput } from "./filter";

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key: id,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: { kind: "human", ref: "adam" },
  parentId: null,
  progress: { done: 0, total: 0 },
  waitingOn: [],
  ...patch,
});
const link = (from: string, to: string, type: Link["type"] = "blocks"): Link => ({ id: `${from}-${to}`, from, to, type });

test("assignee, done and domain filters drop tickets and the edges that touch them", () => {
  const tickets = [
    ticket("A"),
    ticket("B", { statusId: "done" }),
    ticket("C", { assignee: { kind: "human", ref: "lea" } }),
    ticket("D", { assignee: { kind: "agent", ref: "opus-dev" }, domainId: "Core" }),
  ];
  const links = [link("A", "B"), link("A", "C"), link("A", "D"), link("B", "D", "relates")];
  const f = { assignee: "mine-and-agents" as const, hideDone: false, domain: null };
  expect(graphInput(tickets, links, f, "adam").tickets.map((t) => t.id)).toEqual(["A", "B", "D"]);
  expect(graphInput(tickets, links, f, "adam").edges).toEqual([
    { from: "A", to: "B", type: "blocks" },
    { from: "A", to: "D", type: "blocks" },
    { from: "B", to: "D", type: "relates" },
  ]);
  expect(graphInput(tickets, links, { ...f, hideDone: true }, "adam").edges).toEqual([{ from: "A", to: "D", type: "blocks" }]);
  expect(graphInput(tickets, links, { ...f, domain: "Core" }, "adam").tickets.map((t) => t.id)).toEqual(["D"]);
  expect(graphInput(tickets, links, { ...f, assignee: "all" }, "adam").tickets).toHaveLength(4);
  expect(domainsOf(tickets)).toEqual(["Core"]);
});
```
`Link` a la forme v0.1 (`id`, `from`, `to`, `type`) ; si la phase 2 ou 3 lui a ajouté des champs, les compléter dans l'aide `link`.

`components/graph/src/graph.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

runConformance({ manifest, Component }, seed);

const setup = (surface: "view" | "widget", seedFn: typeof seed | undefined = seed) => {
  const m = createMockSdk(manifest, { ...(seedFn && { seed: seedFn }), surface, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("screen 10: nodes, critical path summary, legend and zoom", async () => {
  const m = setup("view");
  expect(await screen.findByText("Chemin critique : 3 tickets · 1 bloqué")).toBeTruthy();
  const canvas = screen.getByRole("group", { name: "Graphe des dépendances" });
  const node = within(canvas).getByRole("button", { name: /KIB-21 Sandbox iframe des composants/ });
  expect(node.getAttribute("data-critical")).toBe("true");
  expect(within(canvas).getByRole("button", { name: /KIB-12/ }).getAttribute("data-critical")).toBe("false");
  expect(within(canvas).getByRole("button", { name: /KIB-5 / }).className).toContain("opacity-45");
  expect(screen.getByText("Lié à")).toBeTruthy();
  await userEvent.setup().click(node);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-21")?.id]);
});

test("toolbar: hide done, critical path toggle, zoom", async () => {
  setup("view");
  const user = userEvent.setup();
  await screen.findByText("Chemin critique : 3 tickets · 1 bloqué");
  expect(screen.getByRole("button", { name: "Hiérarchique" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Masquer terminés" }));
  expect(screen.queryByRole("button", { name: /KIB-5 / })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Chemin critique" }));
  expect(screen.getByRole("button", { name: /KIB-21/ }).getAttribute("data-critical")).toBe("false");
  await user.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("110 %");
  await user.click(screen.getByRole("button", { name: "Taille réelle" }));
  expect(screen.getByRole("button", { name: "Taille réelle" }).textContent).toBe("100 %");
});

test("screen 7 widget: chain, blocked reason and a link to the view", async () => {
  const m = setup("widget");
  expect(await screen.findByText("Chemin critique · 3 tickets")).toBeTruthy();
  const chain = screen.getByRole("list", { name: "Chemin critique" });
  expect(within(chain).getAllByRole("button").map((b) => b.textContent)).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
  expect(screen.getByText("KIB-21 bloqué : audit sécurité externe en attente")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le graphe →" }));
  expect(m.openedViews).toEqual(["graph"]);
});

test("D9: empty states", async () => {
  setup("view", undefined);
  expect(await screen.findByText("Aucune dépendance entre les tickets affichés.")).toBeTruthy();
});

test("D9: empty widget", async () => {
  setup("widget", undefined);
  expect(await screen.findByText("Aucun chemin critique : aucun ticket bloquant.")).toBeTruthy();
});
```

Run: `bun test components/graph`
Expected: FAIL (fichiers absents).

- [x] **Step 2: Implémenter `fr.ts` et `filter.ts`**

`components/graph/src/fr.ts` :
```ts
const s = (n: number) => (n > 1 ? "s" : "");

export const fr = {
  canvas: "Graphe des dépendances",
  hierarchical: "Hiérarchique",
  hierarchicalHelp: "Seule mise en page disponible pour l'instant",
  critical: "Chemin critique",
  hideDone: "Masquer terminés",
  filter: "Filtrer",
  assignee: "Assigné",
  mineAndAgents: "Moi + agents",
  all: "Tous",
  domain: "Domaine",
  allDomains: "Tous les domaines",
  summary: (n: number, blocked: number) => `Chemin critique : ${n} ticket${s(n)} · ${blocked} bloqué${s(blocked)}`,
  widgetTitle: (n: number) => `Chemin critique · ${n} ticket${s(n)}`,
  blocked: (key: string, reason: string) => `${key} bloqué : ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`,
  open: "Ouvrir le graphe →",
  legend: { blocks: "Bloque", critical: "Chemin critique", relates: "Lié à" },
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  zoomReset: "Taille réelle",
  agent: "Assigné à un agent",
  emptyView: "Aucune dépendance entre les tickets affichés.",
  emptyWidget: "Aucun chemin critique : aucun ticket bloquant.",
  loadFailed: "Impossible de charger les tickets.",
};
```

`components/graph/src/filter.ts` :
```ts
import type { Link, TicketView } from "@kibo/schema";
import type { GraphEdge } from "./critical-path";

export type GraphFilter = { assignee: "mine-and-agents" | "all"; hideDone: boolean; domain: string | null };

export function graphInput(tickets: TicketView[], links: Link[], f: GraphFilter, viewer: string): { tickets: TicketView[]; edges: GraphEdge[] } {
  const shown = tickets.filter(
    (t) =>
      (f.assignee === "all" || t.assignee?.kind === "agent" || (t.assignee?.kind === "human" && t.assignee.ref === viewer)) &&
      (!f.hideDone || t.statusId !== "done") &&
      (f.domain === null || t.domainId === f.domain),
  );
  const ids = new Set(shown.map((t) => t.id));
  const edges = links
    .filter((l) => (l.type === "blocks" || l.type === "relates") && ids.has(l.from) && ids.has(l.to))
    .map((l): GraphEdge => ({ from: l.from, to: l.to, type: l.type === "blocks" ? "blocks" : "relates" }));
  return { tickets: shown, edges };
}

export const domainsOf = (tickets: TicketView[]): string[] =>
  [...new Set(tickets.flatMap((t) => (t.domainId ? [t.domainId] : [])))].sort((a, b) => a.localeCompare(b, "fr"));
```

- [x] **Step 3: Implémenter `GraphCanvas.tsx`**

```tsx
import type { TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, Minus, Plus } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { type GraphLayout, NODE_H, NODE_W } from "./layout";

type Props = {
  tickets: TicketView[];
  edges: GraphEdge[];
  layout: GraphLayout;
  critical: ReadonlySet<string>;
  onOpen(id: string): void;
};

const MARGIN = 48;
const clampZoom = (z: number) => Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, relates: boolean): string {
  if (relates && Math.abs(a.x - b.x) < 1) {
    const x = a.x + NODE_W / 2;
    return a.y < b.y ? `M${x} ${a.y + NODE_H} V${b.y}` : `M${x} ${a.y} V${b.y + NODE_H}`;
  }
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

export function GraphCanvas({ tickets, edges, layout, critical, onOpen }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const isCriticalEdge = (e: GraphEdge) => e.type === "blocks" && critical.has(e.from) && critical.has(e.to);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
  };

  return (
    <div
      role="group"
      aria-label={fr.canvas}
      className="relative h-full min-h-[320px] cursor-grab overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${pan.x + MARGIN}px, ${pan.y + MARGIN}px) scale(${zoom})`, width: layout.width, height: layout.height }}
      >
        <svg aria-hidden className="absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
          <defs>
            <marker id="kibo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" className="fill-muted-foreground" />
            </marker>
            <marker id="kibo-arrow-critical" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" className="fill-foreground" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const hot = isCriticalEdge(e);
            return (
              <path
                key={`${e.from}-${e.to}-${e.type}`}
                d={edgePath(a, b, e.type === "relates")}
                fill="none"
                strokeWidth={hot ? 2 : 1}
                strokeDasharray={e.type === "relates" ? "4 4" : undefined}
                className={hot ? "stroke-foreground" : "stroke-muted-foreground"}
                markerEnd={e.type === "blocks" ? `url(#${hot ? "kibo-arrow-critical" : "kibo-arrow"})` : undefined}
              />
            );
          })}
        </svg>
        {layout.nodes.map((n) => {
          const t = byId.get(n.id);
          if (!t) return null;
          const hot = critical.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              data-critical={hot ? "true" : "false"}
              aria-label={`${t.key} ${t.title}`}
              onClick={() => onOpen(t.id)}
              className={cn(
                "absolute grid content-center gap-1 rounded-md border bg-card px-3 text-left hover:bg-accent",
                hot && "border-2 border-foreground",
                t.statusId === "done" && "opacity-45",
              )}
              style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
            >
              <span className="flex items-center gap-1.5">
                <StatusDot statusId={t.statusId} />
                <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                <span className="flex-1" />
                {t.assignee?.kind === "agent" && <Bot aria-label={fr.agent} className="size-3.5 text-muted-foreground" />}
              </span>
              <span className="truncate text-sm font-medium">{t.title}</span>
            </button>
          );
        })}
      </div>
      <div className="absolute bottom-3 left-3 grid gap-1 rounded-md border bg-card p-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-px w-5 bg-muted-foreground" />
          {fr.legend.blocks}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 bg-foreground" />
          {fr.legend.critical}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="w-5 border-t border-dashed border-muted-foreground" />
          {fr.legend.relates}
        </span>
      </div>
      <div className="absolute right-3 bottom-3 flex items-center rounded-md border bg-card">
        <Button size="icon" variant="ghost" className="size-7" aria-label={fr.zoomIn} onClick={() => setZoom((z) => clampZoom(z + 0.1))}>
          <Plus aria-hidden />
        </Button>
        <Button variant="ghost" className="h-7 px-2 font-mono text-xs" aria-label={fr.zoomReset} onClick={() => setZoom(1)}>
          {`${Math.round(zoom * 100)} %`}
        </Button>
        <Button size="icon" variant="ghost" className="size-7" aria-label={fr.zoomOut} onClick={() => setZoom((z) => clampZoom(z - 0.1))}>
          <Minus aria-hidden />
        </Button>
      </div>
    </div>
  );
}
```
Le cast `e.target as HTMLElement` vise la cible DOM d'un événement pointeur (toujours un élément ici). L'import `GraphLayout` vient de `./layout` (tâche 10).

- [x] **Step 4: Implémenter `GraphView.tsx`, `GraphWidget.tsx` et `index.ts`**

`components/graph/src/GraphView.tsx` :
```tsx
import { useEntities, useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Filter, Network, Sparkle } from "lucide-react";
import { useMemo, useState } from "react";
import { criticalPath } from "./critical-path";
import { domainsOf, type GraphFilter, graphInput } from "./filter";
import { fr } from "./fr";
import { GraphCanvas } from "./GraphCanvas";
import { layoutGraph } from "./layout";

export function GraphView() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const [showCritical, setShowCritical] = useState(true);
  const [filter, setFilter] = useState<GraphFilter>({
    assignee: sdk.config.filter === "all" ? "all" : "mine-and-agents",
    hideDone: sdk.config.hideDone === true,
    domain: null,
  });
  const input = useMemo(() => graphInput(tickets.data, links.data, filter, sdk.viewer), [tickets.data, links.data, filter, sdk.viewer]);
  const layout = useMemo(() => layoutGraph(input.tickets, input.edges), [input]);
  const path = useMemo(() => criticalPath(input.tickets, input.edges), [input]);
  const blocked = path.filter((id) => input.tickets.find((t) => t.id === id)?.statusId === "blocked").length;
  const hasBlocks = input.edges.some((e) => e.type === "blocks");
  const toggle = "h-7 aria-pressed:bg-accent";

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" variant="outline" className={toggle} aria-pressed disabled>
                  <Network aria-hidden />
                  {fr.hierarchical}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{fr.hierarchicalHelp}</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="outline" className={toggle} aria-pressed={showCritical} onClick={() => setShowCritical((v) => !v)}>
            <Sparkle aria-hidden />
            {fr.critical}
          </Button>
          <Button size="sm" variant="outline" className={toggle} aria-pressed={filter.hideDone} onClick={() => setFilter((f) => ({ ...f, hideDone: !f.hideDone }))}>
            {fr.hideDone}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7">
                <Filter aria-hidden />
                {fr.filter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{fr.assignee}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filter.assignee} onValueChange={(v) => setFilter((f) => ({ ...f, assignee: v === "all" ? "all" : "mine-and-agents" }))}>
                <DropdownMenuRadioItem value="mine-and-agents">{fr.mineAndAgents}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="all">{fr.all}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{fr.domain}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filter.domain ?? ""} onValueChange={(v) => setFilter((f) => ({ ...f, domain: v === "" ? null : v }))}>
                <DropdownMenuRadioItem value="">{fr.allDomains}</DropdownMenuRadioItem>
                {domainsOf(tickets.data).map((d) => (
                  <DropdownMenuRadioItem key={d} value={d}>
                    {d}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="flex-1" />
          {path.length > 0 && <span className="text-sm text-muted-foreground">{fr.summary(path.length, blocked)}</span>}
        </div>
        {(tickets.error || links.error) && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {fr.loadFailed}
          </p>
        )}
        {!tickets.loading && !links.loading && !hasBlocks ? (
          <p className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">{fr.emptyView}</p>
        ) : (
          <div className="min-h-0 flex-1">
            <GraphCanvas
              tickets={input.tickets}
              edges={input.edges}
              layout={layout}
              critical={new Set(showCritical ? path : [])}
              onOpen={(id) => sdk.openTicket(id)}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
```

`components/graph/src/GraphWidget.tsx` :
```tsx
import { StatusDot, useEntities, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { useMemo } from "react";
import { criticalPath } from "./critical-path";
import { graphInput } from "./filter";
import { fr } from "./fr";

export function GraphWidget() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const input = useMemo(
    () =>
      graphInput(
        tickets.data,
        links.data,
        { assignee: sdk.config.filter === "all" ? "all" : "mine-and-agents", hideDone: true, domain: null },
        sdk.viewer,
      ),
    [tickets.data, links.data, sdk.config.filter, sdk.viewer],
  );
  const chain = useMemo(() => criticalPath(input.tickets, input.edges).flatMap((id) => input.tickets.find((t) => t.id === id) ?? []), [input]);
  const firstBlocked = chain.find((t) => t.statusId === "blocked" && t.blockedReason);

  if (tickets.error || links.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (tickets.loading || links.loading) return <div className="h-full" />;
  if (chain.length === 0) return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  return (
    <div className="grid h-full content-center gap-3 p-4 text-sm">
      <p className="text-muted-foreground">{fr.widgetTitle(chain.length)}</p>
      <ol aria-label={fr.critical} className="flex flex-wrap items-center gap-2">
        {chain.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
            <button
              type="button"
              onClick={() => sdk.openTicket(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs",
                t.statusId === "blocked" && "border-red-600 dark:border-red-500",
              )}
            >
              <StatusDot statusId={t.statusId} />
              {t.key}
            </button>
          </li>
        ))}
      </ol>
      {firstBlocked?.blockedReason && (
        <p className="text-red-600 dark:text-red-500">{fr.blocked(firstBlocked.key, firstBlocked.blockedReason)}</p>
      )}
      <Button variant="link" className="h-auto w-fit p-0 text-muted-foreground" onClick={() => sdk.openView("graph")}>
        {fr.open}
      </Button>
    </div>
  );
}
```

`components/graph/src/index.ts` :
```ts
import { ComponentManifest } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { GraphView } from "./GraphView";
import { GraphWidget } from "./GraphWidget";

export const manifest = ComponentManifest.parse(manifestJson);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? GraphView : GraphWidget);
}
```

- [x] **Step 5: Vérifier et committer**

Run: `bun test components/graph && bun run typecheck && bun run check`
Expected: PASS (conformité v1 comprise : widget et vue, sombre et clair, vide et peuplé).

```bash
git add components/graph/src
git commit -m "feat(graph): vue et widget du graphe"
```

---

### Task 26: Composant Notes (écran 11 et widget de l'écran 7)

**Files:**
- Create: `components/notes/package.json`, `components/notes/tsconfig.json`, `components/notes/kibo.component.json`, `components/notes/src/fr.ts`, `components/notes/src/dates.ts`, `components/notes/src/dates.test.ts`, `components/notes/src/markdown.ts`, `components/notes/src/markdown.test.ts`, `components/notes/src/autosave.ts`, `components/notes/src/autosave.test.ts`, `components/notes/src/MarkdownEditor.tsx`, `components/notes/src/NoteList.tsx`, `components/notes/src/NoteDocument.tsx`, `components/notes/src/NotesView.tsx`, `components/notes/src/NotesWidget.tsx`, `components/notes/src/index.ts`, `components/notes/src/notes.test.tsx`
- Modify: `package.json` (script `typecheck` : `components/notes`), `packages/sdk/src/status.tsx` (export `statusDotClass`), `bun.lock`

**Interfaces:**
- Consumes: `useSdk`, `useEntities`, `StatusDot`, `SdkProvider` ; `sdk.notes.*`, `sdk.list("note")`, `sdk.openFile`, `sdk.openView`, `sdk.openTicket` (tâche 7) ; `createMockSdk` (options `notes`, `noteAges`, méthode `touchNote`), `runConformance`, `seedDemo`, `DEMO_NOTES`, `DEMO_NOTE_AGES` (tâche 12) ; `NoteMeta`, `NoteContent`, `NotesInfo`, `KiboError`, `TicketView` (schéma).
- Produces:
  - `statusDotClass(statusId): string` (`@kibo/sdk`, mêmes classes que `StatusDot`).
  - `noteDate(mtime: number, now?: number): string` (« aujourd'hui », « hier », sinon `jj/mm`).
  - `type TicketRef = { id: string; title: string; statusId: StatusId }` ; `renderNote(markdown: string, tickets: ReadonlyMap<string, TicketRef>): string` (HTML sûr : `html: false`, puces de tickets `button[data-ticket-key]`, liens `a[data-note-href]`).
  - `type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error"` ; `createAutosave(opts): Autosave` avec `change(markdown)`, `flush()`, `setBase(mtime | null)`, `keepMine()`, `dispose()`.
  - `@kibo/component-notes` : `manifest`, `Component`.

Fidélité : écran 11 (page 17 du PDF), trois colonnes (gauche 256 px : recherche « Rechercher une note… », ligne `~/goinfre/Kibo/notes · Obsidian` en `font-mono text-xs`, liste triée par date — titre puis `aujourd'hui · 3 liens`, `hier`, `22/09` —, bouton « Nouvelle note » en bas ; centre : lien du chemin `notes/decisions-architecture.md` souligné en `font-mono text-xs` avec icône fichier, « Enregistré • local » à droite, titre `text-3xl font-bold`, `h2` `text-xl font-semibold`, paragraphes `text-muted-foreground`, puces de tickets `● KIB-12 Schéma Loro` bordées, puces `•`, bloc de code `bg-muted rounded-md font-mono text-sm` ; droite 256 px : « Tickets liés » (cartes bordées : pastille, clé mono, titre), « Rétroliens » (titre + « mentionne cette note » ou « 2 mentions »)). Le compteur « n liens » d'une note = nombre de tickets liés (la maquette l'affiche pour « Décisions d'architecture », 3 tickets). Bascule édition : bouton `ghost` « Modifier » / « Aperçu » à gauche de l'état d'enregistrement (non dessiné : bouton de 28 px, icône `Pencil` / `Eye`). États D4 et D9.

- [x] **Step 1: Créer le paquet**

`components/notes/package.json` :
```json
{
  "name": "@kibo/component-notes",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@codemirror/commands": "6.8.1",
    "@codemirror/lang-markdown": "6.3.4",
    "@codemirror/state": "6.5.2",
    "@codemirror/view": "6.38.2",
    "@kibo/schema": "workspace:*",
    "@kibo/sdk": "workspace:*",
    "lucide-react": "1.48.0",
    "markdown-it": "14.1.0"
  },
  "peerDependencies": {
    "react": "19.1.1"
  },
  "devDependencies": {
    "@testing-library/react": "16.3.0",
    "@testing-library/user-event": "14.6.1",
    "@types/markdown-it": "14.1.2",
    "@types/react": "19.1.13",
    "react": "19.1.1",
    "react-dom": "19.1.1"
  }
}
```
Versions CodeMirror : si la phase 3 a déjà ajouté ces paquets au monorepo, reprendre **ses** versions exactes (une seule version par paquet dans `bun.lock`). Dépendances nouvelles justifiées : `markdown-it` (rendu Markdown sans HTML brut, spec §8.2), CodeMirror 6 (édition, spec §8.2) ; aucune n'a de script `postinstall` (vérifier avec `bun pm ls --all | grep -i postinstall` ou la lecture des `package.json` installés).

`components/notes/tsconfig.json` : copie de `components/kanban/tsconfig.json`.

`components/notes/kibo.component.json` :
```json
{
  "id": "notes",
  "version": "1.0.0",
  "kind": "both",
  "title": "Notes",
  "description": "Markdown local, compatible Obsidian",
  "reads": ["note", "ticket", "status"],
  "writes": ["note"],
  "configSchema": { "path": { "type": "string", "nullable": true, "default": null } }
}
```
Racine `package.json` : ajouter `components/notes` au script `typecheck` après `components/graph`. Run: `bun install`.

`packages/sdk/src/status.tsx` : exporter `export const statusDotClass = (statusId: StatusId): string => DOT[statusId];` (et `StatusDot` l'utilise).

- [x] **Step 2: Écrire les tests purs**

`components/notes/src/dates.test.ts` :
```ts
import { expect, test } from "bun:test";
import { noteDate } from "./dates";

test("today, yesterday, then day/month", () => {
  const now = new Date(2026, 8, 26, 15, 0).getTime();
  expect(noteDate(new Date(2026, 8, 26, 1, 0).getTime(), now)).toBe("aujourd'hui");
  expect(noteDate(new Date(2026, 8, 25, 23, 0).getTime(), now)).toBe("hier");
  expect(noteDate(new Date(2026, 8, 22, 9, 0).getTime(), now)).toBe("22/09");
  expect(noteDate(new Date(2025, 11, 3, 9, 0).getTime(), now)).toBe("03/12");
});
```

`components/notes/src/markdown.test.ts` :
```ts
import { expect, test } from "bun:test";
import { renderNote } from "./markdown";

const tickets = new Map([["KIB-12", { id: "t12", title: "Schéma Loro des tickets", statusId: "in_progress" as const }]]);

test("ticket keys become chips, except inside code", () => {
  const html = renderNote("Voir KIB-12 et KIB-99.\n\n`KIB-12`\n\n```\nKIB-12\n```", tickets);
  expect(html.match(/data-ticket-key="KIB-12"/g)).toHaveLength(1);
  expect(html).toContain("Schéma Loro des tickets");
  expect(html).toContain("KIB-99");
  expect(html).not.toContain('data-ticket-key="KIB-99"');
});

test("raw HTML is escaped and dangerous links are not rendered", () => {
  const html = renderNote('<img src=x onerror="alert(1)"> [x](javascript:alert(1)) <script>boom()</script>', tickets);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("&lt;img");
});

test("wiki links and relative Markdown links are marked for in-app navigation", () => {
  const html = renderNote("[[decisions-architecture|archi]] et [idées](idees.md) et [site](https://kibo.dev)", tickets);
  expect(html).toContain('data-note-href="decisions-architecture"');
  expect(html).toContain(">archi<");
  expect(html).toContain('data-note-href="idees.md"');
  expect(html).toContain('href="https://kibo.dev"');
});
```

`components/notes/src/autosave.test.ts` :
```ts
import { expect, test } from "bun:test";
import { KiboError, type NoteMeta } from "@kibo/schema";
import { createAutosave, type SaveState } from "./autosave";

function harness(save: (md: string, mtime: number | null) => Promise<NoteMeta>) {
  const timers: (() => void)[] = [];
  const states: SaveState[] = [];
  const auto = createAutosave({
    delayMs: 800,
    save,
    onState: (s) => states.push(s),
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: (id) => {
      timers[Number(id) - 1] = () => undefined;
    },
  });
  return { auto, timers, states };
}
const meta = (mtime: number): NoteMeta => ({ path: "a.md", title: "A", mtime, size: 1, tickets: [], links: [] });
const flush = () => new Promise((r) => setTimeout(r, 0));

test("typing debounces, then saves once with the base mtime", async () => {
  const saves: [string, number | null][] = [];
  const { auto, timers, states } = harness(async (md, m) => {
    saves.push([md, m]);
    return meta(20);
  });
  auto.setBase(10);
  auto.change("a");
  auto.change("ab");
  timers.at(-1)?.();
  await flush();
  expect(saves).toEqual([["ab", 10]]);
  expect(states).toEqual(["dirty", "dirty", "saving", "saved"]);
  auto.change("abc");
  timers.at(-1)?.();
  await flush();
  expect(saves.at(-1)).toEqual(["abc", 20]);
});

test("a conflict keeps the text; keepMine forces the write", async () => {
  let conflict = true;
  const saves: [string, number | null][] = [];
  const { auto, timers, states } = harness(async (md, m) => {
    saves.push([md, m]);
    if (conflict) throw new KiboError("CONFLICT", "changed");
    return meta(30);
  });
  auto.setBase(10);
  auto.change("mine");
  timers.at(-1)?.();
  await flush();
  expect(states.at(-1)).toBe("conflict");
  conflict = false;
  await auto.keepMine();
  expect(saves.at(-1)).toEqual(["mine", null]);
  expect(states.at(-1)).toBe("saved");
});

test("other failures are reported, not swallowed", async () => {
  const { auto, timers, states } = harness(async () => {
    throw new KiboError("PATH_OUTSIDE_PROJECT", "nope");
  });
  auto.change("x");
  timers.at(-1)?.();
  await flush();
  expect(states.at(-1)).toBe("error");
});
```

Run: `bun test components/notes`
Expected: FAIL.

- [x] **Step 3: Implémenter `fr.ts`, `dates.ts`, `markdown.ts`, `autosave.ts`**

`components/notes/src/fr.ts` :
```ts
const s = (n: number) => (n > 1 ? "s" : "");

export const fr = {
  search: "Rechercher une note…",
  obsidian: "Obsidian",
  newNote: "Nouvelle note",
  untitled: "Sans titre",
  today: "aujourd'hui",
  yesterday: "hier",
  links: (n: number) => `${n} lien${s(n)}`,
  saved: "Enregistré",
  local: "local",
  unsaved: "Non enregistré",
  saving: "Enregistrement…",
  edit: "Modifier",
  preview: "Aperçu",
  editor: "Contenu de la note",
  linkedTickets: "Tickets liés",
  backlinks: "Rétroliens",
  mentionsOnce: "mentionne cette note",
  mentions: (n: number) => `${n} mentions`,
  conflict: "Modifié hors de Kibo",
  reload: "Recharger",
  keepMine: "Garder ma version",
  emptyList: "Aucune note dans ce dossier.",
  noResult: "Aucune note ne correspond.",
  pick: "Choisis une note ou crées-en une.",
  emptyWidget: "Aucune note pour l'instant.",
  loadFailed: "Impossible de lire les notes.",
  saveFailed: "Impossible d'enregistrer la note.",
  createFailed: "Impossible de créer la note.",
};
```

`components/notes/src/dates.ts` :
```ts
import { fr } from "./fr";

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function noteDate(mtime: number, now: number = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(mtime)) / 86_400_000);
  if (days <= 0) return fr.today;
  if (days === 1) return fr.yesterday;
  const d = new Date(mtime);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
```

`components/notes/src/markdown.ts` :
```ts
import type { StatusId } from "@kibo/schema";
import { statusDotClass } from "@kibo/sdk";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

export type TicketRef = { id: string; title: string; statusId: StatusId };

const KEY = /\b[A-Z][A-Z0-9]{1,5}-\d+\b/g;
const WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const escape = (s: string) => md.utils.escapeHtml(s);

function chip(key: string, t: TicketRef): string {
  return (
    `<button type="button" data-ticket-key="${escape(key)}" class="mx-0.5 inline-flex max-w-[14rem] items-center gap-1.5 rounded border bg-card px-1.5 align-baseline font-mono text-xs text-foreground hover:bg-accent">` +
    `<span aria-hidden="true" class="inline-block size-2 shrink-0 rounded-full ${statusDotClass(t.statusId)}"></span>${escape(key)}` +
    `<span class="truncate font-sans text-muted-foreground">${escape(t.title)}</span></button>`
  );
}

function expandText(text: string, tickets: ReadonlyMap<string, TicketRef>): string {
  let out = "";
  let last = 0;
  const pieces: { at: number; end: number; html: string }[] = [];
  for (const m of text.matchAll(WIKI)) {
    const target = m[1]?.trim() ?? "";
    const label = m[2]?.trim() || target;
    pieces.push({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length, html: `<a href="#" data-note-href="${escape(target)}">${escape(label)}</a>` });
  }
  for (const m of text.matchAll(KEY)) {
    const at = m.index ?? 0;
    const t = tickets.get(m[0]);
    if (!t || pieces.some((p) => at >= p.at && at < p.end)) continue;
    pieces.push({ at, end: at + m[0].length, html: chip(m[0], t) });
  }
  for (const p of pieces.sort((a, b) => a.at - b.at)) {
    out += escape(text.slice(last, p.at)) + p.html;
    last = p.end;
  }
  return out + escape(text.slice(last));
}

export function renderNote(markdown: string, tickets: ReadonlyMap<string, TicketRef>): string {
  const env = {};
  const tokens = md.parse(markdown, env);
  const walk = (list: Token[]) => {
    for (const token of list) {
      if (token.type === "inline" && token.children) {
        let inLink = false;
        for (const child of token.children) {
          if (child.type === "link_open") {
            inLink = true;
            const href = child.attrGet("href") ?? "";
            if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && href.endsWith(".md")) {
              child.attrSet("data-note-href", href);
              child.attrSet("href", "#");
            }
          }
          if (child.type === "link_close") inLink = false;
          if (child.type === "text" && !inLink) {
            child.type = "html_inline";
            child.content = expandText(child.content, tickets);
          }
        }
      }
    }
  };
  walk(tokens);
  return md.renderer.render(tokens, md.options, env);
}
```
Sûreté : `html: false` empêche tout HTML de la note ; les seuls `html_inline` produits sont ceux construits ici, à partir de texte échappé ; `markdown-it` refuse `javascript:` via `validateLink`. Chemin d'import du type `Token` : `markdown-it/lib/token.mjs` (v14) ; si `@types/markdown-it` l'expose autrement, utiliser `ReturnType<MarkdownIt["parse"]>[number]`.

`components/notes/src/autosave.ts` :
```ts
import { KiboError, type NoteMeta } from "@kibo/schema";

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
type Timer = unknown;
export type AutosaveOptions = {
  delayMs: number;
  save(markdown: string, expectedMtime: number | null): Promise<NoteMeta>;
  onState(state: SaveState): void;
  onSaved?: (meta: NoteMeta) => void;
  setTimeout?: (fn: () => void, ms: number) => Timer;
  clearTimeout?: (t: Timer) => void;
};
export type Autosave = {
  change(markdown: string): void;
  flush(): Promise<void>;
  setBase(mtime: number | null): void;
  keepMine(): Promise<void>;
  dispose(): void;
};

export function createAutosave(opts: AutosaveOptions): Autosave {
  const later = opts.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel = opts.clearTimeout ?? ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let base: number | null = null;
  let pending: string | null = null;
  let timer: Timer | null = null;
  let disposed = false;

  const write = async (force: boolean) => {
    if (pending === null || disposed) return;
    const text = pending;
    opts.onState("saving");
    try {
      const meta = await opts.save(text, force ? null : base);
      base = meta.mtime;
      if (pending === text) pending = null;
      opts.onSaved?.(meta);
      opts.onState(pending === null ? "saved" : "dirty");
    } catch (e) {
      if (e instanceof KiboError && e.code === "CONFLICT") {
        opts.onState("conflict");
        return;
      }
      console.error(e);
      opts.onState("error");
    }
  };

  return {
    change(markdown) {
      pending = markdown;
      opts.onState("dirty");
      if (timer !== null) cancel(timer);
      timer = later(() => {
        timer = null;
        void write(false);
      }, opts.delayMs);
    },
    async flush() {
      if (timer !== null) cancel(timer);
      timer = null;
      await write(false);
    },
    setBase(mtime) {
      base = mtime;
    },
    keepMine: () => write(true),
    dispose() {
      disposed = true;
      if (timer !== null) cancel(timer);
    },
  };
}
```
Le cast de `cancel` est la frontière avec le type opaque des minuteries injectées.

Run: `bun test components/notes/src/dates.test.ts components/notes/src/markdown.test.ts components/notes/src/autosave.test.ts`
Expected: PASS.

- [x] **Step 4: Écrire le test des écrans**

`components/notes/src/notes.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

runConformance({ manifest, Component }, seed, { notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });

function setup(surface: "view" | "widget", notes: Record<string, string> = DEMO_NOTES) {
  const m = createMockSdk(manifest, { seed, surface, notes, noteAges: DEMO_NOTE_AGES });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}

test("screen 11: list, document, linked tickets and backlinks", async () => {
  const m = setup("view");
  const list = await screen.findByRole("list", { name: "Notes" });
  expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Décisions d'architectureaujourd'hui · 3 liens",
    "Journal agentshier",
    expect.stringMatching(/^Idées composants\d{2}\/\d{2}$/),
    expect.stringMatching(/^Réunion kick-off\d{2}\/\d{2}$/),
  ]);
  expect(screen.getByText("~/goinfre/Kibo/notes")).toBeTruthy();
  expect(screen.getByText("Obsidian")).toBeTruthy();
  expect(await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" })).toBeTruthy();
  expect(screen.getByText("Enregistré")).toBeTruthy();
  const linked = screen.getByRole("region", { name: "Tickets liés" });
  expect(within(linked).getAllByRole("button").map((b) => b.textContent)).toEqual([
    expect.stringContaining("KIB-12"),
    expect.stringContaining("KIB-13"),
    expect.stringContaining("KIB-14"),
  ]);
  const back = screen.getByRole("region", { name: "Rétroliens" });
  expect(within(back).getByText("mentionne cette note")).toBeTruthy();
  expect(within(back).getByText("2 mentions")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "notes/decisions-architecture.md" }));
  expect(m.openedFiles).toEqual([{ path: "notes/decisions-architecture.md" }]);
});

test("ticket chips and backlinks navigate", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  const doc = screen.getByRole("article");
  await user.click(within(doc).getAllByRole("button", { name: /KIB-12/ })[0] as HTMLElement);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-12")?.id]);
  await user.click(within(screen.getByRole("region", { name: "Rétroliens" })).getByRole("button", { name: /Journal agents/ }));
  expect(await screen.findByRole("heading", { level: 1, name: "Journal agents" })).toBeTruthy();
});

test("search asks the daemon, new note creates a file", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  await user.type(screen.getByPlaceholderText("Rechercher une note…"), "récepteur");
  await waitFor(() =>
    expect(within(screen.getByRole("list", { name: "Notes" })).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("Décisions d'architecture"),
    ]),
  );
  await user.clear(screen.getByPlaceholderText("Rechercher une note…"));
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  await waitFor(() => expect(m.notes.has("sans-titre.md")).toBe(true));
  expect(m.notes.get("sans-titre.md")?.markdown).toBe("# Sans titre\n");
});

test("D4: the conflict banner offers reload and keep mine", async () => {
  const { NoteConflictBanner } = await import("./NoteDocument");
  const calls: string[] = [];
  render(<NoteConflictBanner onReload={() => calls.push("reload")} onKeepMine={() => calls.push("keep")} />);
  const user = userEvent.setup();
  expect(screen.getByRole("alert").textContent).toContain("Modifié hors de Kibo");
  await user.click(screen.getByRole("button", { name: "Recharger" }));
  await user.click(screen.getByRole("button", { name: "Garder ma version" }));
  expect(calls).toEqual(["reload", "keep"]);
});

test("D9: empty folder, and the widget", async () => {
  setup("view", {});
  expect(await screen.findByText("Aucune note dans ce dossier.")).toBeTruthy();
  expect(screen.getByText("Choisis une note ou crées-en une.")).toBeTruthy();
});

test("screen 7 widget: the most recent note, title and first lines", async () => {
  const m = setup("widget");
  expect(await screen.findByRole("heading", { name: "Décisions d'architecture" })).toBeTruthy();
  expect(screen.getByText(/On garde Loro comme CRDT/)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Décisions d'architecture" }));
  expect(m.openedViews).toEqual(["notes"]);
});

test("D9: empty widget", async () => {
  setup("widget", {});
  expect(await screen.findByText("Aucune note pour l'instant.")).toBeTruthy();
});
```
La frappe dans CodeMirror n'est pas simulable de façon fiable sous happy-dom : le scénario complet (frappe, conflit, bandeau, « Garder ma version ») est couvert par `autosave.test.ts` et par le parcours Playwright (tâche 33).

Run: `bun test components/notes`
Expected: FAIL (écrans absents).

- [x] **Step 5: Implémenter `MarkdownEditor.tsx`, `NoteList.tsx`, `NoteDocument.tsx`**

`components/notes/src/MarkdownEditor.tsx` :
```tsx
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { fr } from "./fr";

type Props = { value: string; onChange(markdown: string): void };

export function MarkdownEditor({ value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": fr.editor, role: "textbox", "aria-multiline": "true" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) change.current(u.state.doc.toString());
          }),
          EditorView.theme({ "&": { fontSize: "14px" }, ".cm-content": { fontFamily: "var(--font-mono)" } }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="min-h-[60vh] rounded-md border bg-background p-2" />;
}
```
Le premier `useEffect` crée l'éditeur une seule fois (la valeur initiale suffit) ; le second resynchronise le contenu quand la note est rechargée depuis le disque.

`components/notes/src/NoteList.tsx` :
```tsx
import type { NoteMeta, NotesInfo } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus, Search } from "lucide-react";
import { noteDate } from "./dates";
import { fr } from "./fr";

type Props = {
  notes: NoteMeta[];
  info: NotesInfo | null;
  selected: string | null;
  query: string;
  onQuery(q: string): void;
  onSelect(path: string): void;
  onCreate(): void;
};

export function NoteList({ notes, info, selected, query, onQuery, onSelect, onCreate }: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r p-3">
      <div className="relative">
        <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder={fr.search} aria-label={fr.search} value={query} onChange={(e) => onQuery(e.target.value)} />
      </div>
      {info && (
        <p className="truncate font-mono text-xs text-muted-foreground">
          <span>{info.displayDir}</span>
          {info.obsidian && (
            <>
              {" · "}
              <span>{fr.obsidian}</span>
            </>
          )}
        </p>
      )}
      <ul aria-label="Notes" className="grid flex-1 content-start gap-1 overflow-auto">
        {notes.map((n) => (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path)}
              aria-current={selected === n.path ? "true" : undefined}
              className={cn("grid w-full gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent", selected === n.path && "bg-accent")}
            >
              <span className="truncate text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">
                {noteDate(n.mtime)}
                {n.tickets.length > 0 && ` · ${fr.links(n.tickets.length)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {notes.length === 0 && <p className="text-sm text-muted-foreground">{query ? fr.noResult : fr.emptyList}</p>}
      <Button variant="outline" className="w-fit" onClick={onCreate}>
        <Plus aria-hidden />
        {fr.newNote}
      </Button>
    </aside>
  );
}
```

`components/notes/src/NoteDocument.tsx` :
```tsx
import type { NoteContent, NotesInfo } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Eye, FileText, Pencil, TriangleAlert } from "lucide-react";
import type { SyntheticEvent } from "react";
import type { SaveState } from "./autosave";
import { fr } from "./fr";
import { MarkdownEditor } from "./MarkdownEditor";
import { renderNote, type TicketRef } from "./markdown";

export function NoteConflictBanner({ onReload, onKeepMine }: { onReload(): void; onKeepMine(): void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
      <TriangleAlert aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">{fr.conflict}</span>
      <Button size="sm" variant="outline" onClick={onReload}>
        {fr.reload}
      </Button>
      <Button size="sm" onClick={onKeepMine}>
        {fr.keepMine}
      </Button>
    </div>
  );
}

type Props = {
  note: NoteContent;
  info: NotesInfo | null;
  tickets: ReadonlyMap<string, TicketRef>;
  editing: boolean;
  draft: string;
  state: SaveState;
  onToggleEdit(): void;
  onChange(markdown: string): void;
  onReload(): void;
  onKeepMine(): void;
  onOpenNote(target: string): void;
};

const stateLabel = (s: SaveState) =>
  s === "saved" ? `${fr.saved} • ${fr.local}` : s === "saving" ? fr.saving : s === "error" ? fr.saveFailed : fr.unsaved;

export function NoteDocument({ note, info, tickets, editing, draft, state, onToggleEdit, onChange, onReload, onKeepMine, onOpenNote }: Props) {
  const sdk = useSdk();
  const shownPath = info?.folderRelative ? `${info.folderRelative === "." ? "" : `${info.folderRelative}/`}${note.path}` : null;
  const onActivate = (e: SyntheticEvent<HTMLElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    const chip = target?.closest<HTMLElement>("[data-ticket-key]");
    if (chip) {
      const t = tickets.get(chip.dataset.ticketKey ?? "");
      if (t) sdk.openTicket(t.id);
      return;
    }
    const link = target?.closest<HTMLAnchorElement>("a");
    if (!link) return;
    e.preventDefault();
    if (link.dataset.noteHref) onOpenNote(link.dataset.noteHref);
  };
  return (
    <article className="mx-auto grid w-full max-w-3xl content-start gap-4 px-8 py-6">
      <div className="flex items-center gap-2 text-xs">
        <FileText aria-hidden className="size-3.5 text-muted-foreground" />
        {shownPath ? (
          <button type="button" className="font-mono text-blue-600 underline dark:text-blue-400" onClick={() => sdk.openFile({ path: shownPath })}>
            {shownPath}
          </button>
        ) : (
          <span className="font-mono text-muted-foreground">{note.path}</span>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7" onClick={onToggleEdit}>
          {editing ? <Eye aria-hidden /> : <Pencil aria-hidden />}
          {editing ? fr.preview : fr.edit}
        </Button>
        <span role={state === "error" ? "alert" : "status"} className={state === "error" ? "text-destructive" : "text-muted-foreground"}>
          {stateLabel(state)}
        </span>
      </div>
      {state === "conflict" && <NoteConflictBanner onReload={onReload} onKeepMine={onKeepMine} />}
      {editing ? (
        <MarkdownEditor value={draft} onChange={onChange} />
      ) : (
        <div
          className="grid gap-3 text-muted-foreground [&_code]:font-mono [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-['•_'] [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-foreground"
          onClick={onActivate}
          onKeyDown={(e) => e.key === "Enter" && onActivate(e)}
          dangerouslySetInnerHTML={{ __html: renderNote(draft, tickets) }}
        />
      )}
    </article>
  );
}
```
`dangerouslySetInnerHTML` est sûr par construction (`renderNote` : `html: false`, texte échappé). Le code ne porte pas de commentaire : si Biome signale `noDangerouslySetInnerHtml`, désactiver cette règle pour le seul fichier `components/notes/src/NoteDocument.tsx` via `overrides` dans `biome.json` (justification dans le plan, ici). Les puces sont des `button` : elles reçoivent le focus et `Enter` déclenche `click` ; le `onKeyDown` du conteneur couvre les liens de notes.

- [x] **Step 6: Implémenter `NotesView.tsx`, `NotesWidget.tsx`, `index.ts`**

`components/notes/src/NotesView.tsx` :
```tsx
import { KiboError, type NoteContent, type NoteMeta, type NotesInfo } from "@kibo/schema";
import { StatusDot, useEntities, useSdk } from "@kibo/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAutosave, type SaveState } from "./autosave";
import { fr } from "./fr";
import { NoteDocument } from "./NoteDocument";
import { NoteList } from "./NoteList";
import type { TicketRef } from "./markdown";

function resolveTarget(target: string, notes: NoteMeta[]): string | null {
  const clean = target.replace(/^\.\//, "");
  const withExt = clean.endsWith(".md") ? clean : `${clean}.md`;
  const exact = notes.find((n) => n.path === withExt);
  if (exact) return exact.path;
  const base = withExt.split("/").pop() ?? withExt;
  const byName = notes.filter((n) => n.path.split("/").pop() === base).sort((a, b) => a.path.length - b.path.length);
  return byName[0]?.path ?? null;
}

function freePath(notes: NoteMeta[]): string {
  const taken = new Set(notes.map((n) => n.path));
  for (let i = 1; ; i += 1) {
    const path = i === 1 ? "sans-titre.md" : `sans-titre-${i}.md`;
    if (!taken.has(path)) return path;
  }
}

export function NotesView() {
  const sdk = useSdk();
  const listed = useEntities("note");
  const ticketList = useEntities("ticket");
  const [info, setInfo] = useState<NotesInfo | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<NoteMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const autosave = useRef<ReturnType<typeof createAutosave> | null>(null);

  const tickets = useMemo(
    () => new Map<string, TicketRef>(ticketList.data.map((t) => [t.key, { id: t.id, title: t.title, statusId: t.statusId }])),
    [ticketList.data],
  );
  const notes = found ?? listed.data;

  useEffect(() => {
    sdk.notes.info().then(setInfo, (e: unknown) => {
      console.error(e);
      setError(fr.loadFailed);
    });
  }, [sdk]);

  useEffect(() => {
    if (!query.trim()) {
      setFound(null);
      return;
    }
    const timer = setTimeout(() => {
      sdk.notes.search(query.trim()).then(setFound, (e: unknown) => {
        console.error(e);
        setError(fr.loadFailed);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [sdk, query]);

  useEffect(() => {
    if (selected === null && listed.data[0]) setSelected(listed.data[0].path);
  }, [selected, listed.data]);

  const load = useCallback(
    async (path: string) => {
      try {
        const content = await sdk.notes.read(path);
        setNote(content);
        setDraft(content.markdown);
        setState("saved");
        autosave.current?.setBase(content.mtime);
      } catch (e) {
        if (!(e instanceof KiboError)) console.error(e);
        setError(fr.loadFailed);
      }
    },
    [sdk],
  );

  useEffect(() => {
    if (selected === null) return;
    const a = createAutosave({
      delayMs: 800,
      save: (md, mtime) => sdk.notes.write(selected, md, mtime),
      onState: setState,
    });
    autosave.current = a;
    void load(selected);
    return () => {
      void a.flush().finally(() => a.dispose());
      autosave.current = null;
    };
  }, [sdk, selected, load]);

  useEffect(() => {
    const current = listed.data.find((n) => n.path === selected);
    if (current && note && current.mtime !== note.mtime && state === "saved" && !editing) void load(current.path);
  }, [listed.data, selected, note, state, editing, load]);

  const create = async () => {
    try {
      const path = freePath(listed.data);
      await sdk.notes.write(path, `# ${fr.untitled}\n`, null);
      setQuery("");
      setSelected(path);
      setEditing(true);
    } catch (e) {
      console.error(e);
      setError(fr.createFailed);
    }
  };

  const backlinks = note
    ? listed.data
        .map((n) => ({ note: n, count: n.links.filter((l) => l === note.path).length }))
        .filter((b) => b.count > 0 && b.note.path !== note.path)
    : [];
  const linked = note
    ? note.tickets.flatMap((k) => {
        const t = tickets.get(k);
        return t ? [{ key: k, ...t }] : [];
      })
    : [];

  return (
    <div className="flex h-full min-h-0">
      <NoteList
        notes={notes}
        info={info}
        selected={selected}
        query={query}
        onQuery={setQuery}
        onSelect={(p) => {
          setEditing(false);
          setSelected(p);
        }}
        onCreate={() => void create()}
      />
      <main className="min-w-0 flex-1 overflow-auto">
        {error && (
          <p role="alert" className="px-8 pt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {note ? (
          <NoteDocument
            note={note}
            info={info}
            tickets={tickets}
            editing={editing}
            draft={draft}
            state={state}
            onToggleEdit={() => setEditing((v) => !v)}
            onChange={(md) => {
              setDraft(md);
              autosave.current?.change(md);
            }}
            onReload={() => note && void load(note.path)}
            onKeepMine={() => void autosave.current?.keepMine()}
            onOpenNote={(target) => {
              const path = resolveTarget(target, listed.data);
              if (path) setSelected(path);
            }}
          />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted-foreground">{fr.pick}</p>
        )}
      </main>
      <aside className="grid w-64 shrink-0 content-start gap-6 border-l p-4 text-sm">
        <section aria-label={fr.linkedTickets} className="grid gap-2">
          <h2 className="font-medium">{fr.linkedTickets}</h2>
          {linked.map((t) => (
            <button key={t.key} type="button" onClick={() => sdk.openTicket(t.id)} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-accent">
              <StatusDot statusId={t.statusId} />
              <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </section>
        <section aria-label={fr.backlinks} className="grid gap-2">
          <h2 className="font-medium">{fr.backlinks}</h2>
          {backlinks.map((b) => (
            <button key={b.note.path} type="button" onClick={() => setSelected(b.note.path)} className="grid text-left">
              <span>{b.note.title}</span>
              <span className="text-xs text-muted-foreground">{b.count === 1 ? fr.mentionsOnce : fr.mentions(b.count)}</span>
            </button>
          ))}
        </section>
      </aside>
    </div>
  );
}
```

`components/notes/src/NotesWidget.tsx` :
```tsx
import { useEntities, useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";
import { fr } from "./fr";

const firstLines = (markdown: string) =>
  markdown
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("```") && !l.startsWith("---"))
    .slice(0, 4);

export function NotesWidget() {
  const sdk = useSdk();
  const notes = useEntities("note");
  const pinned = typeof sdk.config.path === "string" ? sdk.config.path : null;
  const target = notes.data.find((n) => n.path === pinned) ?? notes.data[0] ?? null;
  const [lines, setLines] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!target) return;
    let live = true;
    sdk.notes.read(target.path).then(
      (c) => live && setLines(firstLines(c.markdown)),
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [sdk, target?.path, target?.mtime]);

  if (notes.error || failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (notes.loading) return <div className="h-full" />;
  if (!target) return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  return (
    <div className="grid content-start gap-2 p-4 text-sm">
      <h3 className="text-base font-semibold">
        <button type="button" className="text-left hover:underline" onClick={() => sdk.openView("notes")}>
          {target.title}
        </button>
      </h3>
      <ul className="grid gap-1 text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l.replace(/^[-*]\s+/, "• ")}</li>
        ))}
      </ul>
    </div>
  );
}
```

`components/notes/src/index.ts` :
```ts
import { ComponentManifest } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { NotesView } from "./NotesView";
import { NotesWidget } from "./NotesWidget";

export const manifest = ComponentManifest.parse(manifestJson);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? NotesView : NotesWidget);
}
```

- [x] **Step 7: Vérifier et committer**

Run: `bun install && bun test components/notes && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add components/notes package.json bun.lock packages/sdk/src/status.tsx
git commit -m "feat(notes): composant Notes Markdown"
```

---

### Task 27: Publication, brouillons et « Mettre à jour partout »

**Files:**
- Create: `packages/daemon/src/components/drafts.ts`, `packages/daemon/src/components/drafts.test.ts`, `packages/daemon/src/components/publish.ts`, `packages/daemon/src/components/publish.test.ts`
- Modify: `packages/daemon/src/components/fake-store.test-helper.ts` (`put` réel en mémoire)

**Interfaces:**
- Consumes: `hashSources`, `readSources`, `readValidationStamp`, `ValidationStamp` (tâches 4 et 20) ; `readRegistry`, `getRegistryVersion`, `putRegistryVersion`, `highestVersion` (tâche 3) ; `ComponentStore` (tâche 14) ; `RegistryService` (tâche 21) ; `ComponentManifest`, `ValidationReport`, `PublishPreview`, `PublishResult`, `DraftSummary`, `RegistryVersion`, `NO_PERMISSIONS`, `grantedOf`, `permissionList`, `addedPermissions`, `compareSemver`, `isActive`, `formatRef`, `KiboError`, `isKiboErrorCode` (tâche 2).
- Produces:
  - `draftsDir(home): string` (`<home>/components/src`) ; `listDrafts(home, workspace): Promise<DraftSummary[]>` (brouillons non publiés à l'identique, tri par titre).
  - `type PublisherDeps = { home: string; workspace: LoroDoc; persistWorkspace(): void; emit(): void; store: ComponentStore; registry: RegistryService; validate(dir: string): Promise<ValidationReport>; update(projectId: string, instanceId: string, to: string): Promise<unknown>; now?: () => number }`.
  - `createPublisher(deps): { preview(id): Promise<PublishPreview>; publish(id, strategy): Promise<PublishResult>; applyUpdateAll(id, version): Promise<PublishResult["failed"]> }`.
  - Règles : même version et même empreinte ⇒ `status: "unchanged"` (publish renvoie la version existante, rien ne change) ; même version, autre empreinte ⇒ `VERSION_EXISTS` ; version ≤ plus haute publiée ⇒ `INVALID_INPUT` ; confiance héritée si la version précédente est active et qu'aucune permission n'est ajoutée ; sinon `trust = null` et, pour « Mettre à jour partout » avec des usages, `autoUpdate = true` (décision 7).

- [x] **Step 1: Rendre `put` utilisable dans le faux magasin**

`packages/daemon/src/components/fake-store.test-helper.ts`, remplacer `put` :
```ts
    put: async (srcDir, expectedHash) => {
      const { hash, files } = await readSources(srcDir);
      if (expectedHash !== undefined && expectedHash !== hash) throw new KiboError("HASH_MISMATCH", "sources changed");
      const raw = files.find((f) => f.path === "kibo.component.json");
      const manifest = ComponentManifest.parse(JSON.parse(new TextDecoder().decode(raw?.bytes ?? new Uint8Array())));
      const v = storedVersion(manifest, hash);
      disk.set(key(v.id, v.version), v);
      cache.set(key(v.id, v.version), v);
      return v;
    },
```
Imports : `ComponentManifest` en valeur (`@kibo/schema`), `readSources` (`@kibo/devkit`).

- [x] **Step 2: Écrire les tests**

`packages/daemon/src/components/drafts.test.ts` :
```ts
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceDoc, putRegistryVersion } from "@kibo/core";
import { hashSources } from "@kibo/devkit";
import { NO_PERMISSIONS } from "@kibo/schema";
import { draftsDir, listDrafts } from "./drafts";

const homes: string[] = [];
afterAll(() => {
  for (const h of homes) rmSync(h, { recursive: true, force: true });
});

async function draft(home: string, id: string, version: string, stamp: "ok" | "failed" | "stale" | null) {
  const dir = join(draftsDir(home), id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ id, version, kind: "widget", title: id.toUpperCase(), reads: [], writes: [] }));
  writeFileSync(join(dir, "ui.tsx"), "export function Component() { return null; }");
  const hash = await hashSources(dir);
  if (stamp) {
    mkdirSync(join(dir, ".kibo"));
    writeFileSync(
      join(dir, ".kibo", "validation.json"),
      JSON.stringify({ hash: stamp === "stale" ? "0".repeat(64) : hash, version, ok: stamp !== "failed", at: 1 }),
    );
  }
  return hash;
}

test("drafts are listed with their validation state and hide what is already published", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-drafts-"));
  homes.push(home);
  const ws = createWorkspaceDoc();
  await draft(home, "burndown", "0.1.0", "ok");
  await draft(home, "pending", "0.1.0", "stale");
  await draft(home, "broken", "0.1.0", "failed");
  const publishedHash = await draft(home, "done", "1.0.0", "ok");
  const pr = await draft(home, "pr-queue", "0.4.0", "ok");
  mkdirSync(join(draftsDir(home), "not-a-component"));
  putRegistryVersion(ws, "done", "DONE", { version: "1.0.0", hash: publishedHash, origin: "user", trust: null, approvedHash: null, granted: NO_PERMISSIONS, publishedAt: 1, autoUpdate: false });
  putRegistryVersion(ws, "pr-queue", "PR", { version: "0.3.0", hash: "a".repeat(64), origin: "user", trust: null, approvedHash: null, granted: NO_PERMISSIONS, publishedAt: 1, autoUpdate: false });
  expect(await listDrafts(home, ws)).toEqual([
    { id: "broken", title: "BROKEN", version: "0.1.0", hash: expect.any(String), validated: false, publishedVersion: null },
    { id: "burndown", title: "BURNDOWN", version: "0.1.0", hash: expect.any(String), validated: true, publishedVersion: null },
    { id: "pending", title: "PENDING", version: "0.1.0", hash: expect.any(String), validated: false, publishedVersion: null },
    { id: "pr-queue", title: "PR-QUEUE", version: "0.4.0", hash: pr, validated: true, publishedVersion: "0.3.0" },
  ]);
});

test("no drafts folder means no drafts", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-drafts-"));
  homes.push(home);
  expect(await listDrafts(home, createWorkspaceDoc())).toEqual([]);
});
```

`packages/daemon/src/components/publish.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectDoc, createWorkspaceDoc, executeProjectCommand, getRegistryVersion } from "@kibo/core";
import { hashSources } from "@kibo/devkit";
import { KiboError, type Page, type ValidationReport } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { draftsDir } from "./drafts";
import { createEventLog, ensureEventsTable } from "./events";
import { createFakeStore } from "./fake-store.test-helper";
import { createPublisher } from "./publish";
import { createRegistryService, type RegistryService } from "./registry-service";

const homes: string[] = [];
afterAll(() => {
  for (const h of homes) rmSync(h, { recursive: true, force: true });
});

let home: string;
let ws: LoroDoc;
let project: LoroDoc;
let registry: RegistryService;
let updates: string[];
let failFor: string | null;
let validationOk: boolean;
let publisher: ReturnType<typeof createPublisher>;

function writeDraft(version: string, extra: Record<string, unknown> = {}, ui = "export function Component() { return null; }") {
  const dir = join(draftsDir(home), "pr-queue");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "kibo.component.json"),
    JSON.stringify({ id: "pr-queue", version, kind: "widget", title: "PR en attente", reads: ["ticket"], writes: [], ...extra }),
  );
  writeFileSync(join(dir, "ui.tsx"), ui);
  return dir;
}

const report = async (dir: string): Promise<ValidationReport> => ({
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: true, errors: [] },
  tests: { ok: validationOk, passed: 9, failed: validationOk ? 0 : 1, output: "" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: await hashSources(dir),
  ok: validationOk,
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-publish-"));
  homes.push(home);
  ws = createWorkspaceDoc();
  project = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  updates = [];
  failFor = null;
  validationOk = true;
  const store = createFakeStore();
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const common = { workspace: ws, persistWorkspace: () => undefined, emit: () => undefined };
  registry = createRegistryService({
    ...common,
    projects: () => [{ id: "p1", name: "Kibo", doc: project }],
    store,
    events: createEventLog(db),
    stopBackend: () => undefined,
    onApproved: async (id, v) => {
      await publisher.applyUpdateAll(id, v.version);
    },
  });
  publisher = createPublisher({
    ...common,
    home,
    store,
    registry,
    validate: report,
    update: async (_projectId, instanceId, to) => {
      if (instanceId === failFor) throw new KiboError("MIGRATION_FAILED", "config invalide");
      executeProjectCommand(project, { method: "setInstanceComponent", instanceId, component: `pr-queue@${to}`, config: {}, data: null });
      updates.push(`${instanceId}→${to}`);
    },
    now: () => 42,
  });
});

async function publishApproved(version: string) {
  writeDraft(version);
  const r = await publisher.publish("pr-queue", "new-version");
  const v = getRegistryVersion(ws, "pr-queue", version);
  await registry.approve("pr-queue", version, v?.hash ?? "", "sandboxed");
  return r;
}
function place(n: number): string[] {
  const page = executeProjectCommand(project, { method: "addPage", title: "Tableau de bord", kind: "dashboard" }) as Page;
  return Array.from({ length: n }, () => (executeProjectCommand(project, { method: "addInstance", pageId: page.id, component: "pr-queue@0.3.0" }) as { id: string }).id);
}

describe("preview", () => {
  test("a first publication is new, needs approval and lists all permissions", async () => {
    writeDraft("0.1.0", { changes: ["Premier jet"] });
    const p = await publisher.preview("pr-queue");
    expect(p).toMatchObject({ id: "pr-queue", from: null, to: "0.1.0", status: "new", usages: [], changes: ["Premier jet"], newPermissions: ["read:ticket"], migration: null });
    const r = await publisher.publish("pr-queue", "new-version");
    expect(r).toMatchObject({ needsApproval: true, updated: [], failed: [] });
    expect(r.version).toMatchObject({ version: "0.1.0", trust: null, origin: "user", publishedAt: 42, autoUpdate: false });
  });
  test("same version: unchanged if same code, VERSION_EXISTS otherwise; lower versions refused", async () => {
    await publishApproved("0.3.0");
    expect((await publisher.preview("pr-queue")).status).toBe("unchanged");
    writeDraft("0.3.0", {}, "export function Component() { return 1; }");
    await expect(publisher.preview("pr-queue")).rejects.toThrow("VERSION_EXISTS");
    writeDraft("0.2.0");
    await expect(publisher.preview("pr-queue")).rejects.toThrow("INVALID_INPUT");
  });
  test("usages, new permissions and migration against the highest published version", async () => {
    await publishApproved("0.3.0");
    place(2);
    writeDraft("0.4.0", { net: ["api.github.com/graphql"], configVersion: 1, changes: ["Filtre par auteur de la PR"] });
    const p = await publisher.preview("pr-queue");
    expect(p).toMatchObject({
      from: "0.3.0",
      to: "0.4.0",
      status: "update",
      newPermissions: ["net:api.github.com/graphql"],
      migration: { from: 0, to: 1 },
      changes: ["Filtre par auteur de la PR"],
    });
    expect(p.usages.map((u) => [u.projectName, u.pageTitle, u.version])).toEqual([
      ["Kibo", "Tableau de bord", "0.3.0"],
      ["Kibo", "Tableau de bord", "0.3.0"],
    ]);
  });
  test("a failing validation is reported by preview and refused by publish", async () => {
    validationOk = false;
    writeDraft("0.1.0");
    expect((await publisher.preview("pr-queue")).validation.ok).toBe(false);
    await expect(publisher.publish("pr-queue", "new-version")).rejects.toThrow("VALIDATION_FAILED");
    await expect(publisher.preview("absent")).rejects.toThrow("NOT_FOUND");
  });
});

describe("publish", () => {
  test("same permissions: trust is inherited and update-all migrates every instance", async () => {
    await publishApproved("0.3.0");
    const [a, b] = place(2);
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r.needsApproval).toBe(false);
    expect(r.version).toMatchObject({ trust: "sandboxed", approvedHash: r.version.hash, autoUpdate: false });
    expect(updates.sort()).toEqual([`${a}→0.4.0`, `${b}→0.4.0`].sort());
    expect(r.updated.sort()).toEqual([a, b].sort());
  });
  test("partial failure: the other instances move on, the failing one is reported", async () => {
    await publishApproved("0.3.0");
    const [a, b] = place(2);
    failFor = b ?? null;
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r.updated).toEqual([a]);
    expect(r.failed).toEqual([{ instanceId: b, projectName: "Kibo", pageTitle: "Tableau de bord", code: "MIGRATION_FAILED", message: "config invalide" }]);
  });
  test("a new permission defers update-all until approval, which then runs it once", async () => {
    await publishApproved("0.3.0");
    const [a] = place(1);
    writeDraft("0.4.0", { net: ["api.github.com/graphql"] });
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r).toMatchObject({ needsApproval: true, updated: [], failed: [] });
    expect(r.version).toMatchObject({ trust: null, autoUpdate: true });
    expect(updates).toEqual([]);
    await registry.approve("pr-queue", "0.4.0", r.version.hash, "sandboxed");
    expect(updates).toEqual([`${a}→0.4.0`]);
  });
  test("new-version leaves instances where they are", async () => {
    await publishApproved("0.3.0");
    place(1);
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "new-version");
    expect(r.updated).toEqual([]);
    expect(updates).toEqual([]);
  });
});
```

Run: `bun test packages/daemon/src/components/drafts.test.ts packages/daemon/src/components/publish.test.ts`
Expected: FAIL.

- [x] **Step 3: Implémenter `drafts.ts`**

```ts
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { highestVersion, readRegistry } from "@kibo/core";
import { hashSources, readValidationStamp } from "@kibo/devkit";
import { ComponentManifest, type DraftSummary, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

export const draftsDir = (home: string): string => join(home, "components", "src");

async function readManifest(dir: string): Promise<ComponentManifest | null> {
  const file = join(dir, "kibo.component.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = ComponentManifest.safeParse(JSON.parse(await readFile(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function listDrafts(home: string, workspace: LoroDoc): Promise<DraftSummary[]> {
  const root = draftsDir(home);
  if (!existsSync(root)) return [];
  const registry = readRegistry(workspace);
  const out: DraftSummary[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    const manifest = await readManifest(dir);
    if (!manifest) continue;
    let hash: string | null = null;
    try {
      hash = await hashSources(dir);
    } catch (e) {
      if (!(e instanceof KiboError && e.code === "VALIDATION_FAILED")) throw e;
    }
    const published = registry[manifest.id];
    if (hash !== null && published?.versions[manifest.version]?.hash === hash) continue;
    const stamp = await readValidationStamp(dir);
    out.push({
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      hash,
      validated: hash !== null && stamp !== null && stamp.ok && stamp.hash === hash && stamp.version === manifest.version,
      publishedVersion: published ? highestVersion(published) : null,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "fr"));
}
```
Un dossier sans manifeste lisible n'est pas un brouillon (il n'apparaît pas) ; des sources refusées par l'empreinte (lien symbolique, trop gros) donnent un brouillon non validé, `hash: null`.

- [x] **Step 4: Implémenter `publish.ts`**

```ts
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRegistryVersion, highestVersion, putRegistryVersion, readRegistry } from "@kibo/core";
import {
  addedPermissions,
  ComponentManifest,
  compareSemver,
  formatRef,
  grantedOf,
  isActive,
  isKiboErrorCode,
  KiboError,
  NO_PERMISSIONS,
  permissionList,
  type PublishPreview,
  type PublishResult,
  type RegistryVersion,
  type ValidationReport,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { draftsDir } from "./drafts";
import type { RegistryService } from "./registry-service";
import type { ComponentStore } from "./store";

export type PublisherDeps = {
  home: string;
  workspace: LoroDoc;
  persistWorkspace(): void;
  emit(): void;
  store: ComponentStore;
  registry: RegistryService;
  validate(dir: string): Promise<ValidationReport>;
  update(projectId: string, instanceId: string, to: string): Promise<unknown>;
  now?: () => number;
};

export function createPublisher(deps: PublisherDeps) {
  const ws = deps.workspace;

  const context = async (id: string) => {
    const dir = join(draftsDir(deps.home), id);
    if (!existsSync(join(dir, "kibo.component.json"))) throw new KiboError("NOT_FOUND", `no draft for ${id}`);
    const parsed = ComponentManifest.safeParse(JSON.parse(await readFile(join(dir, "kibo.component.json"), "utf8")));
    if (!parsed.success || parsed.data.id !== id) throw new KiboError("VALIDATION_FAILED", `invalid manifest for ${id}`);
    return { dir, manifest: parsed.data };
  };

  const preview = async (id: string): Promise<PublishPreview> => {
    const { dir, manifest } = await context(id);
    const validation = await deps.validate(dir);
    const hash = validation.hash ?? "";
    const entry = readRegistry(ws)[id];
    const same = entry?.versions[manifest.version];
    const from = entry ? highestVersion(entry) : null;
    let status: PublishPreview["status"] = from === null ? "new" : "update";
    if (same) {
      if (same.hash !== hash) throw new KiboError("VERSION_EXISTS", `${id}@${manifest.version} is published with another hash`);
      status = "unchanged";
    } else if (from !== null && compareSemver(manifest.version, from) <= 0) {
      throw new KiboError("INVALID_INPUT", `${manifest.version} must be higher than ${from}`);
    }
    const prev = from ? getRegistryVersion(ws, id, from) : null;
    const prevManifest = from
      ? await deps.registry.manifestOf(formatRef(id, from)).catch((e: unknown) => {
          if (e instanceof KiboError && e.code === "TRUST_REQUIRED") return null;
          throw e;
        })
      : null;
    const granted = grantedOf(manifest);
    const usages = deps.registry.list().flatMap((c) =>
      c.id === id ? c.versions.flatMap((v) => v.usages.map((u) => ({ ...u, version: v.version }))) : [],
    );
    return {
      id,
      title: manifest.title,
      from,
      to: manifest.version,
      hash,
      status,
      usages,
      changes: manifest.changes,
      newPermissions: prev && isActive(prev) ? addedPermissions(prev.granted, granted) : permissionList(granted),
      migration: prevManifest && manifest.configVersion > prevManifest.configVersion ? { from: prevManifest.configVersion, to: manifest.configVersion } : null,
      validation,
    };
  };

  const applyUpdateAll = async (id: string, version: string): Promise<PublishResult["failed"]> => {
    const failed: PublishResult["failed"] = [];
    for (const u of deps.registry.usages(id)) {
      try {
        await deps.update(u.projectId, u.instanceId, version);
      } catch (e) {
        if (!(e instanceof KiboError)) console.error(`[kibo-daemon] update of ${u.instanceId} failed`, e);
        const code = e instanceof KiboError && isKiboErrorCode(e.code) ? e.code : "INTERNAL";
        failed.push({ instanceId: u.instanceId, projectName: u.projectName, pageTitle: u.pageTitle, code, message: e instanceof KiboError ? e.detail : "internal error" });
      }
    }
    return failed;
  };

  return {
    preview,
    applyUpdateAll,
    async publish(id: string, strategy: "update-all" | "new-version"): Promise<PublishResult> {
      const p = await preview(id);
      if (!p.validation.ok) throw new KiboError("VALIDATION_FAILED", `${id} did not pass validation`);
      if (p.status === "unchanged") {
        const existing = getRegistryVersion(ws, id, p.to);
        if (!existing) throw new KiboError("INTERNAL", `${id}@${p.to} vanished`);
        return { version: existing, needsApproval: !isActive(existing), updated: [], failed: [] };
      }
      const { dir, manifest } = await context(id);
      const stored = await deps.store.put(dir, p.hash);
      const prev = p.from ? getRegistryVersion(ws, id, p.from) : null;
      const inherit = prev !== null && isActive(prev) && p.newPermissions.length === 0 && prev.trust !== "builtin" && prev.trust !== null;
      const usages = deps.registry.usages(id);
      const version: RegistryVersion = {
        version: stored.version,
        hash: stored.hash,
        origin: "user",
        trust: inherit ? prev.trust : null,
        approvedHash: inherit ? stored.hash : null,
        granted: inherit ? grantedOf(manifest) : NO_PERMISSIONS,
        publishedAt: (deps.now ?? Date.now)(),
        autoUpdate: !inherit && strategy === "update-all" && usages.length > 0,
      };
      putRegistryVersion(ws, id, manifest.title, version);
      deps.persistWorkspace();
      deps.emit();
      if (!inherit || strategy === "new-version" || usages.length === 0) {
        return { version, needsApproval: !inherit, updated: [], failed: [] };
      }
      const failed = await applyUpdateAll(id, version.version);
      const failedIds = new Set(failed.map((f) => f.instanceId));
      return { version, needsApproval: false, updated: usages.map((u) => u.instanceId).filter((x) => !failedIds.has(x)), failed };
    },
  };
}
```
`applyUpdateAll` met à jour toutes les instances de `id` (y compris celles déjà sur une version intermédiaire) ; une instance déjà sur la cible est laissée telle quelle par `updateInstance` (tâche 16). Un échec non `KiboError` est journalisé puis rapporté en `INTERNAL` : il ne bloque pas les autres instances (spec §7.2 étape 5).

- [x] **Step 5: Vérifier et committer**

Run: `bun test packages/daemon/src/components && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/daemon/src/components/drafts.ts packages/daemon/src/components/drafts.test.ts packages/daemon/src/components/publish.ts packages/daemon/src/components/publish.test.ts packages/daemon/src/components/fake-store.test-helper.ts
git commit -m "feat(daemon): publication des composants"
```

---

### Task 28: UI, cadres d'instance, menu `⋯`, « Autorisation requise », dossier des notes et « Ouvrir le graphe »

**Files:**
- Create: `packages/ui/src/pages/InstanceFrame.tsx`, `packages/ui/src/pages/InstanceMenu.tsx`, `packages/ui/src/pages/PendingTrust.tsx`, `packages/ui/src/pages/instance.test.tsx`, `packages/ui/src/dialogs/NotesDirDialog.tsx`, `packages/ui/src/dialogs/OpenViewDialog.tsx`, `packages/ui/src/shell/page-actions.tsx`
- Modify: `packages/ui/src/pages/PageView.tsx` (utilise `InstanceFrame`, en-tête de widget, `onPublishDraft`), `packages/ui/src/shell/Shell.tsx` (emplacement d'actions dans l'en-tête, `openView` avec D7), `packages/ui/src/shell/shell.test.tsx`, `packages/ui/src/registry.ts` (`findBuiltin`)

**Interfaces:**
- Consumes: `useComponents` (tâche 19) ; `TrustDialog`, `trustTargetOf` (tâche 19) ; `SandboxFrame`, `loadTrusted`, `useRuntimeInfo` (tâche 23) ; `PublishDialog`, `useFlash` (tâche 24) ; `findComponent`, `componentIcon` (`registry.ts`) ; `createSdk(…, "builtin" | "gated")`, `projectBackend(client, projectId, instanceId)`, `SdkProvider` (tâche 7) ; RPC `updateInstance`, `command/removeInstance`, `command/addPage`, `command/addInstance`, `getNotesDir`, `setNotesDir` ; `splitRef`, `isBuiltinId`, `compareSemver`, `sandboxPath`, `KiboError` (tâche 2).
- Produces:
  - `InstanceFrame({ projectId, instance, viewer, surface })` : intégré ⇒ module de l'UI (mode `builtin`) ; tiers actif `sandboxed` ⇒ `SandboxFrame` ; tiers actif `trusted` ⇒ `loadTrusted` puis rendu dans l'arbre avec un SDK `gated` ; tiers inactif ou altéré ⇒ `PendingTrust` (D2).
  - `InstanceMenu({ projectId, instance, title })` (D1) ; `PendingTrust({ id, title, version, summary, tampered, compact })` (D2).
  - `NotesDirDialog({ projectId, open, onOpenChange })` (D6) ; `OpenViewDialog({ projectId, componentId, title, open, onOpenChange, onCreated(pageId) })` (D7).
  - `PageActionsProvider`, `PageActionsSlot`, `PageActions({ children })` (portail : les actions d'une page Vue s'affichent à droite du fil d'Ariane).

Fidélité : en-tête de widget de l'écran 7 (page 13) : barre de 40 px, bordure basse, icône du composant, titre `text-sm font-medium`, `⋯` à droite (bouton `ghost` 28 px, `aria-label` « Actions <titre> »). Page Vue : le `⋯` est dans l'en-tête de l'app, à droite du fil d'Ariane. États D1, D2, D6, D7.

- [x] **Step 1: Écrire les tests**

`packages/ui/src/pages/instance.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { type ComponentSummary, type Instance, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const H = "c".repeat(64);
const calls: RpcRequest[] = [];
let components: ComponentSummary[] = [];
let answer: (req: RpcRequest) => Promise<unknown> = async () => null;

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "listDrafts") return Promise.resolve([]);
      if (req.method === "getRuntimeInfo") return Promise.resolve({ sandboxOrigin: "http://127.0.0.1:4318" });
      return answer(req);
    },
    subscribe: () => () => undefined,
  },
}));
mock.module("../shell/trusted-loader", () => ({
  loadTrusted: async () => ({
    manifest: { id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [], data: false, net: [], configVersion: 0, changes: [], sdk: 1 },
    Component: () => <p>trusted content</p>,
  }),
}));

const { InstanceFrame } = await import("./InstanceFrame");
const { InstanceMenu } = await import("./InstanceMenu");
const { NotesDirDialog } = await import("../dialogs/NotesDirDialog");
const { HostProvider } = await import("../shell/Host");

const host = { openTicket: () => undefined, openNewTicket: () => undefined, openFile: () => undefined, openView: () => undefined };
const wrap = (node: ReactNode) => render(<HostProvider host={host}>{node}</HostProvider>);
const inst = (component: string): Instance => ({ id: "i1", pageId: "pg", component, layout: { x: 0, y: 0, w: 6, h: 6 }, config: {} });
const version = (v: string, patch: Partial<ComponentSummary["versions"][number]> = {}): ComponentSummary["versions"][number] => ({
  version: v,
  hash: H,
  trust: "sandboxed",
  origin: "ai",
  active: true,
  tampered: false,
  manifest: { id: "pr-queue", version: v, kind: "widget", title: "PR en attente", reads: ["ticket"], writes: [], data: false, net: [], configVersion: 0, changes: [], sdk: 1 },
  usages: [],
  ...patch,
});

beforeEach(() => {
  calls.length = 0;
  components = [];
  answer = async () => null;
});

test("a sandboxed version is rendered in an isolated iframe served by the sandbox port", async () => {
  components = [{ id: "pr-queue", title: "PR en attente", builtin: false, versions: [version("0.3.0")] }];
  wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="widget" />);
  const frame = await screen.findByTitle("PR en attente");
  expect(frame.getAttribute("src")).toBe(`http://127.0.0.1:4318/c/pr-queue/0.3.0/${H}/index.html`);
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
});

test("a trusted version is loaded as a module", async () => {
  components = [{ id: "mine", title: "Mine", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] }];
  wrap(<InstanceFrame projectId="p1" instance={inst("mine@1.0.0")} viewer="adam" surface="widget" />);
  expect(await screen.findByText("trusted content")).toBeTruthy();
});

test("D2: an unapproved or tampered version asks for trust", async () => {
  components = [{ id: "pr-queue", title: "PR en attente", builtin: false, versions: [version("0.3.0", { active: false, trust: null })] }];
  const { unmount } = wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="view" />);
  expect(await screen.findByText("Autorisation requise")).toBeTruthy();
  expect(screen.getByText("« PR en attente » 0.3.0 doit être autorisé avant de s'afficher.")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Examiner et autoriser" }));
  expect(await screen.findByText("Autoriser « PR en attente » 0.3.0 ?")).toBeTruthy();
  unmount();
  components = [{ id: "pr-queue", title: "PR en attente", builtin: false, versions: [version("0.3.0", { active: false, trust: null, tampered: true })] }];
  wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="widget" />);
  expect(await screen.findByText("Son code a changé depuis ton accord.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Examiner et autoriser" }).hasAttribute("disabled")).toBe(true);
});

test("a built-in is rendered from the UI bundle, an unknown ref says so", async () => {
  const { unmount } = wrap(<InstanceFrame projectId="p1" instance={inst("kanban@1.0.0")} viewer="adam" surface="widget" />);
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  unmount();
  wrap(<InstanceFrame projectId="p1" instance={inst("ghost@9.9.9")} viewer="adam" surface="widget" />);
  expect(await screen.findByText(/ghost@9\.9\.9/)).toBeTruthy();
});

test("D1: update to a higher version, remove from the page", async () => {
  components = [{ id: "pr-queue", title: "PR en attente", builtin: false, versions: [version("0.3.0"), version("0.4.0"), version("0.5.0")] }];
  answer = async (req) => (req.method === "updateInstance" ? inst(`pr-queue@${req.to}`) : null);
  wrap(<InstanceMenu projectId="p1" instance={inst("pr-queue@0.3.0")} title="PR en attente" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente" }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual(["Mettre à jour vers 0.5.0", "Mettre à jour vers 0.4.0", "Retirer de la page"]);
  await user.click(items[0] as HTMLElement);
  expect(calls.at(-1)).toEqual({ method: "updateInstance", projectId: "p1", instanceId: "i1", to: "0.5.0" });
  expect(await screen.findByText("Instance mise à jour en 0.5.0.")).toBeTruthy();
  answer = async () => {
    throw new KiboError("MIGRATION_FAILED", "x");
  };
  await user.click(screen.getByRole("button", { name: "Actions PR en attente" }));
  await user.click((await screen.findAllByRole("menuitem"))[0] as HTMLElement);
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de mettre à jour l'instance.");
  answer = async () => null;
  await user.click(screen.getByRole("button", { name: "Actions PR en attente" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page" }));
  expect(calls.at(-1)).toEqual({ method: "command", projectId: "p1", command: { method: "removeInstance", instanceId: "i1" } });
});

test("D1: Notes offers its folder, built-ins no update", async () => {
  wrap(<InstanceMenu projectId="p1" instance={inst("notes@1.0.0")} title="Notes" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Notes" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Dossier des notes…", "Retirer de la page"]);
});

test("D6: the notes folder dialog shows and saves the folder", async () => {
  answer = async (req) => {
    if (req.method === "getNotesDir") return { dir: "/Users/adam/goinfre/Kibo/notes", displayDir: "~/goinfre/Kibo/notes", obsidian: true, folderRelative: "notes" };
    if (req.method === "setNotesDir" && req.dir === "/nope") throw new KiboError("INVALID_INPUT", "missing");
    return { dir: "/vault", displayDir: "/vault", obsidian: true, folderRelative: null };
  };
  const onOpenChange = mock((_: boolean) => {});
  wrap(<NotesDirDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  const field = await screen.findByLabelText("Dossier");
  expect((field as HTMLInputElement).value).toBe("/Users/adam/goinfre/Kibo/notes");
  await user.clear(field);
  await user.type(field, "/nope");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Dossier introuvable ou illisible.");
  await user.clear(field);
  await user.type(field, "/vault");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
```
Le test « built-in » vérifie seulement que le Kanban lit le projet via `getProject` (mode `builtin`) : son rendu est déjà couvert par ses propres tests.

Run: `bun test packages/ui/src/pages/instance.test.tsx`
Expected: FAIL.

- [x] **Step 2: Implémenter `page-actions.tsx`, `PendingTrust.tsx`, `NotesDirDialog.tsx`, `OpenViewDialog.tsx`**

`packages/ui/src/shell/page-actions.tsx` :
```tsx
import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

const Slot = createContext<{ el: HTMLElement | null; set(el: HTMLElement | null): void } | null>(null);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [el, set] = useState<HTMLElement | null>(null);
  return <Slot.Provider value={{ el, set }}>{children}</Slot.Provider>;
}

export function PageActionsSlot() {
  const slot = useContext(Slot);
  return <div ref={(node) => slot?.set(node)} className="ml-auto flex items-center gap-2" />;
}

export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(Slot);
  return slot?.el ? createPortal(children, slot.el) : null;
}
```

`packages/ui/src/pages/PendingTrust.tsx` :
```tsx
import type { ComponentVersionSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { TrustDialog, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";

type Props = { id: string; title: string; version: string; summary: ComponentVersionSummary | null; tampered: boolean; compact: boolean };

export function PendingTrust({ id, title, version, summary, tampered, compact }: Props) {
  const i = fr.instance;
  const [open, setOpen] = useState(false);
  const target = summary ? trustTargetOf(id, title, summary) : null;
  return (
    <div className={`grid h-full place-items-center text-center ${compact ? "p-4" : "p-10"}`}>
      <div className="grid max-w-sm justify-items-center gap-2">
        <ShieldAlert aria-hidden className="size-6 text-orange-600 dark:text-orange-400" />
        <p className="font-medium">{i.pendingTitle}</p>
        <p className="text-sm text-muted-foreground">{i.pendingHelp(title, version)}</p>
        {tampered && <p className="text-sm text-muted-foreground">{i.pendingChanged}</p>}
        <Button size="sm" variant="outline" disabled={tampered || !target} onClick={() => setOpen(true)}>
          {i.review}
        </Button>
      </div>
      {open && target && <TrustDialog target={target} mode="approve" open onOpenChange={setOpen} onApproved={() => setOpen(false)} />}
    </div>
  );
}
```

`packages/ui/src/dialogs/NotesDirDialog.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export function NotesDirDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange(o: boolean): void }) {
  const n = fr.notesDir;
  const id = useId();
  const [dir, setDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    client.rpc({ method: "getNotesDir", projectId }).then(
      (info) => setDir(info.dir),
      (e: unknown) => {
        console.error(e);
        setError(fr.common.error);
      },
    );
  }, [open, projectId]);
  const save = async () => {
    setError(null);
    try {
      await client.rpc({ method: "setNotesDir", projectId, dir: dir.trim() });
      onOpenChange(false);
    } catch (e) {
      if (!(e instanceof KiboError && e.code === "INVALID_INPUT")) console.error(e);
      setError(n.failed);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{n.title}</DialogTitle>
          <DialogDescription>{n.help}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>{n.label}</Label>
          <Input id={id} className="font-mono" value={dir} onChange={(e) => setDir(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={!dir.trim()} onClick={() => void save()}>
            {n.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`packages/ui/src/dialogs/OpenViewDialog.tsx` :
```tsx
import type { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = { projectId: string; componentRef: string; title: string; open: boolean; onOpenChange(o: boolean): void; onCreated(pageId: string): void };

export function OpenViewDialog({ projectId, componentRef, title, open, onOpenChange, onCreated }: Props) {
  const o = fr.openView;
  const [failed, setFailed] = useState(false);
  const create = async () => {
    setFailed(false);
    try {
      const page = (await client.rpc({ method: "command", projectId, command: { method: "addPage", title, kind: "view" } })) as Page;
      await client.rpc({ method: "command", projectId, command: { method: "addInstance", pageId: page.id, component: componentRef } });
      onCreated(page.id);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{o.title(title)}</DialogTitle>
          <DialogDescription>{o.help}</DialogDescription>
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {o.failed}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button onClick={() => void create()}>{o.submit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
Le cast `as Page` est la frontière du bus de commandes (`command` renvoie `unknown`), comme dans les dialogues v0.1. Le titre de la page créée est celui du composant (« Graphe de dépendances » ou « Notes ») ; la maquette nomme la page « Graphe » : le titre reste modifiable par l'utilisateur.

- [x] **Step 3: Implémenter `InstanceMenu.tsx` et `InstanceFrame.tsx`**

`packages/ui/src/pages/InstanceMenu.tsx` :
```tsx
import { compareSemver, type Instance, isBuiltinId, splitRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ArrowUpCircle, Ellipsis, FolderOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { NotesDirDialog } from "../dialogs/NotesDirDialog";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { useComponents } from "../state/use-components";

type Props = { projectId: string; instance: Instance; title: string };

export function InstanceMenu({ projectId, instance, title }: Props) {
  const i = fr.instance;
  const { id, version } = splitRef(instance.component);
  const { components } = useComponents();
  const { message, tone, flash } = useFlash();
  const [notesDir, setNotesDir] = useState(false);
  const [trust, setTrust] = useState<{ target: TrustTarget; to: string } | null>(null);
  const summary = components?.find((c) => c.id === id && !c.builtin);
  const higher = isBuiltinId(id)
    ? []
    : (summary?.versions ?? []).filter((v) => compareSemver(v.version, version) > 0).sort((a, b) => compareSemver(b.version, a.version));

  const update = async (to: string) => {
    try {
      await client.rpc({ method: "updateInstance", projectId, instanceId: instance.id, to });
      flash(i.updated(to));
    } catch (e) {
      console.error(e);
      flash(i.updateFailed, "error");
    }
  };
  const remove = async () => {
    try {
      await client.rpc({ method: "command", projectId, command: { method: "removeInstance", instanceId: instance.id } });
    } catch (e) {
      console.error(e);
      flash(i.removeFailed, "error");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7" aria-label={i.menu(title)}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {higher.map((v) => (
            <DropdownMenuItem
              key={v.version}
              onSelect={() => {
                const target = !v.active && summary ? trustTargetOf(id, summary.title, v) : null;
                if (target) setTrust({ target, to: v.version });
                else void update(v.version);
              }}
            >
              <ArrowUpCircle aria-hidden />
              {i.updateTo(v.version)}
            </DropdownMenuItem>
          ))}
          {id === "notes" && (
            <DropdownMenuItem onSelect={() => setNotesDir(true)}>
              <FolderOpen aria-hidden />
              {i.notesDir}
            </DropdownMenuItem>
          )}
          {(higher.length > 0 || id === "notes") && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
            <Trash2 aria-hidden />
            {i.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {message && (
        <span role={tone === "error" ? "alert" : "status"} className={`text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
      {notesDir && <NotesDirDialog projectId={projectId} open onOpenChange={setNotesDir} />}
      {trust && (
        <TrustDialog
          target={trust.target}
          mode="approve"
          open
          onOpenChange={(o) => !o && setTrust(null)}
          onApproved={() => {
            const to = trust.to;
            setTrust(null);
            void update(to);
          }}
        />
      )}
    </>
  );
}
```

`packages/ui/src/pages/InstanceFrame.tsx` :
```tsx
import { type Instance, isBuiltinId, sandboxPath, splitRef, type Surface } from "@kibo/schema";
import { createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { useEffect, useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { findComponent } from "../registry";
import { useHost } from "../shell/Host";
import { SandboxFrame } from "../shell/SandboxFrame";
import { loadTrusted, type TrustedModule } from "../shell/trusted-loader";
import { useComponents } from "../state/use-components";
import { useRuntimeInfo } from "../state/use-runtime-info";
import { PendingTrust } from "./PendingTrust";

type Props = { projectId: string; instance: Instance; viewer: string; surface: Surface };

function Mounted({ projectId, instance, viewer, surface, mod, mode }: Props & { mod: TrustedModule; mode: "builtin" | "gated" }) {
  const host = useHost();
  const sdk = useMemo(
    () =>
      createSdk(
        projectBackend(client, projectId, instance.id),
        mod.manifest,
        {
          instanceId: instance.id,
          config: instance.config,
          viewer,
          surface,
          openTicket: host.openTicket,
          openNewTicket: host.openNewTicket,
          openFile: host.openFile,
          openView: host.openView,
        },
        mode,
      ),
    [mod, mode, projectId, instance.id, instance.config, viewer, surface, host],
  );
  return (
    <SdkProvider sdk={sdk}>
      <mod.Component />
    </SdkProvider>
  );
}

function Trusted(props: Props & { id: string; version: string; hash: string }) {
  const [mod, setMod] = useState<TrustedModule | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadTrusted(props.id, props.version, props.hash).then(
      (m) => live && setMod(m),
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [props.id, props.version, props.hash]);
  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.instance.loadFailed}
      </p>
    );
  }
  return mod ? <Mounted {...props} mod={mod} mode="gated" /> : null;
}

export function InstanceFrame(props: Props) {
  const { instance, surface } = props;
  const { id, version } = splitRef(instance.component);
  const builtin = isBuiltinId(id) ? findComponent(instance.component) : undefined;
  const { components, error } = useComponents();
  const runtime = useRuntimeInfo();
  if (builtin) return <Mounted {...props} mod={builtin} mode="builtin" />;
  const unknown = <p className="p-6 text-sm text-destructive">{fr.page.unknownComponent(instance.component)}</p>;
  if (isBuiltinId(id)) return unknown;
  if (error || runtime.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.instance.loadFailed}
      </p>
    );
  }
  if (!components) return null;
  const summary = components.find((c) => c.id === id && !c.builtin);
  const v = summary?.versions.find((x) => x.version === version) ?? null;
  if (!summary || !v) return unknown;
  if (!v.active || !v.hash || v.tampered) {
    return <PendingTrust id={id} title={summary.title} version={version} summary={v} tampered={v.tampered} compact={surface === "widget"} />;
  }
  if (v.trust === "trusted") return <Trusted {...props} id={id} version={version} hash={v.hash} />;
  if (!runtime.info) return null;
  return (
    <SandboxFrame
      key={`${instance.component}:${JSON.stringify(instance.config)}`}
      projectId={props.projectId}
      instanceId={instance.id}
      config={instance.config}
      viewer={props.viewer}
      surface={surface}
      title={summary.title}
      src={`${runtime.info.sandboxOrigin}${sandboxPath(id, version, v.hash, "index.html")}`}
    />
  );
}
```
`findComponent` renvoie un `ComponentModule` (`{ manifest, Component }`), compatible avec `TrustedModule`.

- [x] **Step 4: Brancher `PageView` et `Shell`**

`packages/ui/src/pages/PageView.tsx` : supprimer l'ancien `InstanceFrame` local ; importer `InstanceFrame` et `InstanceMenu`. Dans la grille, chaque cellule devient :
```tsx
            <div
              key={i.id}
              className="flex flex-col overflow-hidden rounded-lg border bg-card"
              style={{ gridColumn: `${i.layout.x + 1} / span ${i.layout.w}`, gridRow: `${i.layout.y + 1} / span ${i.layout.h}` }}
            >
              <WidgetHeader projectId={project.meta.id} instance={i} />
              <div className="min-h-0 flex-1 overflow-auto">
                <InstanceFrame projectId={project.meta.id} instance={i} viewer={viewer} surface="widget" />
              </div>
            </div>
```
avec, dans le même fichier :
```tsx
function WidgetHeader({ projectId, instance }: { projectId: string; instance: Instance }) {
  const Icon = componentIcon(instance.component);
  const title = useInstanceTitle(instance.component);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium">{title}</span>
      <InstanceMenu projectId={projectId} instance={instance} title={title} />
    </div>
  );
}
```
et `useInstanceTitle(ref)` (dans `packages/ui/src/pages/InstanceMenu.tsx`, exportée) : titre du manifeste intégré (`findComponent`) sinon titre du registre (`useComponents`), sinon la ref. Pour une page Vue :
```tsx
        <>
          <PageActions>
            <InstanceMenu projectId={project.meta.id} instance={first} title={title} />
          </PageActions>
          <InstanceFrame projectId={project.meta.id} instance={first} viewer={viewer} surface="view" />
        </>
```
Si la phase 3 a déjà livré un en-tête de widget ou un mode édition (écran 7 : « Modifier la page »), y insérer `InstanceMenu` à la place du `⋯` existant au lieu de créer `WidgetHeader`. `AddComponentDialog` reçoit `onPublishDraft={(id) => setPublishing(id)}` et `PageView` rend `{publishing && <PublishDialog id={publishing} open onOpenChange={(o) => !o && setPublishing(null)} />}`.

`packages/ui/src/shell/Shell.tsx` : envelopper l'arbre dans `<PageActionsProvider>`, placer `<PageActionsSlot />` dans le `header` après le fil d'Ariane ; `openView` devient :
```tsx
  const [openViewFor, setOpenViewFor] = useState<string | null>(null);
  const openView = useCallback(
    (componentId: string) => {
      if (!project) return;
      const page = project.pages.find(
        (p) => p.kind === "view" && project.instances.some((i) => i.pageId === p.id && splitRef(i.component).id === componentId),
      );
      if (page) navigate(project.meta.id, page.id);
      else setOpenViewFor(componentId);
    },
    [project],
  );
```
et rend le dialogue D7 pour un intégré connu (`findBuiltin(id) = BUILTIN_COMPONENTS.find((c) => c.manifest.id === id)`, ajoutée à `registry.ts`) :
```tsx
  const viewTarget = openViewFor ? findBuiltin(openViewFor) : undefined;
```
```tsx
        {project && viewTarget && (
          <OpenViewDialog
            projectId={project.meta.id}
            componentRef={componentRef(viewTarget.manifest)}
            title={viewTarget.manifest.title}
            open
            onOpenChange={(o) => !o && setOpenViewFor(null)}
            onCreated={(pageId) => navigate(project.meta.id, pageId)}
          />
        )}
```
Le `host` mémorisé inclut `openView` dans ses dépendances.

Test à ajouter à `packages/ui/src/shell/shell.test.tsx` : un projet dont une page Vue contient `graph@1.0.0` ⇒ `host.openView("graph")` navigue vers elle ; sans page ⇒ le dialogue « Créer une page Graphe de dépendances ? » s'ouvre et « Créer la page » envoie `addPage` puis `addInstance` (même faux client que les autres tests du fichier).

- [x] **Step 5: Vérifier et committer**

Run: `bun test packages/ui && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/ui/src/pages packages/ui/src/dialogs/NotesDirDialog.tsx packages/ui/src/dialogs/OpenViewDialog.tsx packages/ui/src/shell/page-actions.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/shell.test.tsx packages/ui/src/registry.ts
git commit -m "feat(ui): cadres et menu des instances"
```

---

### Task 29: Graphe et Notes dans le catalogue de l'UI

**Files:**
- Modify: `packages/ui/package.json` (dépendances `@kibo/component-graph`, `@kibo/component-notes`), `packages/ui/src/registry.ts`, `packages/ui/src/registry.test.ts`, `packages/ui/src/components-page/rows.test.ts`, `packages/ui/tsconfig.json` (références), `bun.lock`

**Interfaces:**
- Consumes: `@kibo/component-graph` et `@kibo/component-notes` (`manifest`, `Component`, tâches 25 et 26).
- Produces: `BUILTIN_COMPONENTS = [kanban, tickets, graph, notes]` ; icônes `graph` ⇒ `Network`, `notes` ⇒ `FileText` (celles de la barre latérale des maquettes : « Graphe » et « Notes »).

- [x] **Step 1: Test**

`packages/ui/src/registry.test.ts`, ajouter :
```ts
test("graph and notes are built-ins with their sidebar icons", () => {
  expect(BUILTIN_COMPONENTS.map((c) => c.manifest.id)).toEqual(["kanban", "tickets", "graph", "notes"]);
  expect(componentIcon("graph@1.0.0")).toBe(Network);
  expect(componentIcon("notes@1.0.0")).toBe(FileText);
  expect(BUILTIN_COMPONENTS.map((c) => c.manifest.id)).toEqual([...BUILTIN_IDS]);
});
```
(imports : `Network`, `FileText` de `lucide-react`, `BUILTIN_IDS` de `@kibo/schema`).

`packages/ui/src/components-page/rows.test.ts` : la liste attendue devient
```ts
    ["Graphe de dépendances", "1.0.0", "builtin", 0, 0, false],
    ["Kanban", "1.0.0", "builtin", 3, 2, true],
    ["Notes", "1.0.0", "builtin", 0, 0, false],
    ["PR en attente", "0.4.0", "pending", 0, 0, false],
    ["PR en attente", "0.3.0", "sandboxed", 1, 1, true],
    ["Tickets", "1.0.0", "builtin", 0, 0, false],
```

Run: `bun test packages/ui/src/registry.test.ts packages/ui/src/components-page/rows.test.ts`
Expected: FAIL.

- [x] **Step 2: Implémenter**

`packages/ui/package.json`, `dependencies` : `"@kibo/component-graph": "workspace:*"`, `"@kibo/component-notes": "workspace:*"` ; `packages/ui/tsconfig.json`, `references` : `{ "path": "../../components/graph" }`, `{ "path": "../../components/notes" }`. Run: `bun install`.

`packages/ui/src/registry.ts` :
```ts
import * as graph from "@kibo/component-graph";
import * as kanban from "@kibo/component-kanban";
import * as notes from "@kibo/component-notes";
import * as tickets from "@kibo/component-tickets";
import type { ComponentManifest, Instance, Page } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import { AppWindow, Blocks, FileText, LayoutDashboard, ListTree, type LucideIcon, Network, SquareKanban } from "lucide-react";

export const BUILTIN_COMPONENTS: ComponentModule[] = [kanban, tickets, graph, notes];

const BUILTIN_ICONS: Record<string, LucideIcon> = { kanban: SquareKanban, tickets: ListTree, graph: Network, notes: FileText };
```
(le reste du fichier inchangé, `findBuiltin` compris).

Vérifier aussi que les tests existants de l'UI qui comptent les intégrés (catalogue de l'écran 3, dialogue de la tâche 19) passent : ils cherchent des noms précis, pas un nombre.

- [x] **Step 3: Vérifier et committer**

Run: `bun test packages/ui && bun run typecheck && bun run check && bun run --cwd packages/ui build`
Expected: PASS ; le build Vite inclut CodeMirror et markdown-it.

```bash
git add packages/ui/package.json packages/ui/tsconfig.json packages/ui/src/registry.ts packages/ui/src/registry.test.ts packages/ui/src/components-page/rows.test.ts bun.lock
git commit -m "feat(ui): Graphe et Notes intégrés"
```

---

### Task 30: Assemblage du démon (service des composants, RPC, démarrage)

**Files:**
- Create: `packages/daemon/src/components/service.ts`, `packages/daemon/src/components/service.test.ts`, `packages/daemon/src/daemon.ts`, `packages/daemon/src/daemon.test.ts`
- Modify: `packages/daemon/src/store.ts` (`Store.db`), `packages/daemon/src/service.ts` (asynchrone, délégation ; le refus des commandes réservées sur la RPC `command` est déjà livré par la tâche 3 via `assertShellCommand`), `packages/daemon/src/service.test.ts`, `packages/daemon/src/server.ts` (`await` de `handle`), `packages/daemon/src/server.test.ts`, `packages/daemon/src/main.ts` (démarrage via `startDaemon`), `packages/daemon/src/components/sandbox-server.ts` et son test (`extraAncestors`)

**Interfaces:**
- Consumes: toutes les briques du démon : `createComponentStore` (14), `createGate`, `createQuotas`, `createEventLog`, `ensureEventsTable` (15), `updateInstance` (16), `createBackends`, `createJobScheduler` (17), `createNotesService`, `ensureNotesTables`, `ensureSettingsTable` (18), `validateComponent` (20), `createRegistryService` (21), `startSandboxServer`, `AssetLookup`, `writeDaemonInfo`, `removeDaemonInfo`, `sandboxPortFor` (22), `createPublisher`, `listDrafts` (27), `proxyFetch`, `systemResolver` (8) ; `readProject`, `executeProjectCommand`, `readInstanceData`, `writeInstanceData`, `listProjects` (core) ; `resolveToolchain`, `Toolchain`, `BuildOutput` (devkit).
- Produces:
  - `COMPONENT_METHODS: ReadonlySet<RpcRequest["method"]>`.
  - `type ComponentsDeps = { home: string; toolchain: Toolchain; db: Database; workspace: LoroDoc; persistWorkspace(): void; projects(): ProjectRef[]; projectDoc(id): LoroDoc; persistProject(id): void; emit(projectId: string | null): void; sandboxOrigin(): string; build?: (srcDir, t) => Promise<BuildOutput>; validate?: (dir) => Promise<ValidationReport>; processCommand?: string[]; net?: NetProxyOptions; installCli?: () => Promise<{ path: string }> }`.
  - `createComponentsService(deps): { handle(req: RpcRequest): Promise<unknown>; assets: AssetLookup; start(): Promise<void>; stop(): void; afterCommand(projectId: string): void }`.
  - `Service.handle(req): Promise<unknown>` ; `createService(store, opts: { user; home; toolchain; sandboxOrigin(): string; build?; validate?; processCommand?; net?; installCli? })` ; `Service.start()`, `Service.stop()`, `Service.assets`.
  - `startDaemon(opts: { home; port; sandboxPort; uiDir; dev; toolchain: Toolchain; user; build?; validate? }): Promise<{ url: string; port: number; sandboxPort: number; token: string; stop(): Promise<void> }>` (utilisé par `main.ts`, les tests de sortie et l'E2E).
  - RPC `command` : `setInstanceComponent` et `setInstanceData` refusées (`PERMISSION_DENIED`) : elles ne passent que par le démon (mise à jour, `data.set`).

- [ ] **Step 1: `Store.db`, `handle` asynchrone**

`packages/daemon/src/store.ts` : `Store` gagne `db: Database` (la base déjà ouverte, exposée telle quelle) ; si la phase 2 ou 3 l'a déjà ajouté, ne rien changer.

`packages/daemon/src/server.ts` : `result: (await opts.service.handle(parsed.data)) ?? null` (si la phase 3 l'a déjà rendu asynchrone, rien à faire).

- [ ] **Step 2: Écrire les tests du service des composants**

`packages/daemon/src/components/service.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildOutput } from "@kibo/devkit";
import { hashSources } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { ComponentManifest, type Instance, type Page, type RpcRequest, type ValidationReport } from "@kibo/schema";
import { openStore, type Store } from "../store";
import { createService, type Service } from "../service";

let home: string;
let store: Store;
let service: Service;

const fakeBuild = async (srcDir: string): Promise<BuildOutput> => {
  const manifest = ComponentManifest.parse(JSON.parse(await Bun.file(join(srcDir, "kibo.component.json")).text()));
  const enc = (s: string) => new TextEncoder().encode(s);
  return { manifest, files: { "ui.sandbox.js": enc("sandbox"), "ui.trusted.js": enc("trusted"), "ui.css": enc(".c{}") } };
};
const okReport = async (dir: string): Promise<ValidationReport> => ({
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: true, errors: [] },
  tests: { ok: true, passed: 1, failed: 0, output: "" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: await hashSources(dir),
  ok: true,
});

function draft(version: string, reads: string[] = ["ticket"]) {
  const dir = join(home, "components", "src", "hello");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ id: "hello", version, kind: "both", title: "Hello", reads, writes: [], data: true }));
  writeFileSync(join(dir, "ui.tsx"), `export function Component() { return "${version}"; }`);
}

async function boot() {
  store = openStore(home);
  service = createService(store, {
    user: "adam",
    home,
    toolchain: DEV_TOOLCHAIN,
    sandboxOrigin: () => "http://127.0.0.1:4318",
    build: fakeBuild,
    validate: okReport,
  });
  await service.start();
}
const rpc = <T = unknown>(req: RpcRequest) => service.handle(req) as Promise<T>;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-daemon-"));
  await boot();
});
afterEach(() => {
  service.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

async function project() {
  const meta = await rpc<{ id: string }>({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" });
  const page = await rpc<Page>({ method: "command", projectId: meta.id, command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" } });
  return { projectId: meta.id, pageId: page.id };
}

describe("components over RPC", () => {
  test("publish, approve, add, then calls are checked against the grant", async () => {
    const { projectId, pageId } = await project();
    await rpc({ method: "command", projectId, command: { method: "createTicket", title: "A" } });
    draft("0.1.0");
    expect((await rpc<{ status: string }>({ method: "previewPublish", id: "hello" })).status).toBe("new");
    const published = await rpc<{ version: { hash: string }; needsApproval: boolean }>({ method: "publishComponent", id: "hello", strategy: "new-version" });
    expect(published.needsApproval).toBe(true);
    await rpc({ method: "approveComponent", id: "hello", version: "0.1.0", hash: published.version.hash, trust: "sandboxed" });
    const inst = await rpc<Instance>({ method: "command", projectId, command: { method: "addInstance", pageId, component: "hello@0.1.0" } });
    const call = (c: unknown) => rpc({ method: "componentCall", projectId, instanceId: inst.id, call: c as never });
    expect(await call({ kind: "list", entity: "ticket" })).toHaveLength(1);
    await expect(call({ kind: "list", entity: "link" })).rejects.toThrow("PERMISSION_DENIED");
    await expect(call({ kind: "run", command: { method: "createTicket", title: "B" } })).rejects.toThrow("PERMISSION_DENIED");
    await call({ kind: "data.set", key: "k", value: { a: 1 } });
    expect(await call({ kind: "data.get", key: "k" })).toEqual({ a: 1 });
    expect(service.assets("hello", "0.1.0", published.version.hash)?.trust).toBe("sandboxed");
    expect(await rpc({ method: "getRuntimeInfo" })).toEqual({ sandboxOrigin: "http://127.0.0.1:4318" });
  });

  test("reserved commands cannot be sent through the command RPC", async () => {
    const { projectId, pageId } = await project();
    const inst = await rpc<Instance>({ method: "command", projectId, command: { method: "addInstance", pageId, component: "kanban@1.0.0" } });
    await expect(
      rpc({ method: "command", projectId, command: { method: "setInstanceComponent", instanceId: inst.id, component: "kanban@2.0.0", config: {}, data: null } }),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(rpc({ method: "command", projectId, command: { method: "setInstanceData", instanceId: inst.id, key: "k", value: 1 } })).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });

  test("a store file changed while the daemon was off is caught at start", async () => {
    draft("0.1.0");
    const published = await rpc<{ version: { hash: string } }>({ method: "publishComponent", id: "hello", strategy: "new-version" });
    await rpc({ method: "approveComponent", id: "hello", version: "0.1.0", hash: published.version.hash, trust: "sandboxed" });
    service.stop();
    store.close();
    const file = join(home, "components", "store", "hello", "0.1.0", published.version.hash, "build", "ui.sandbox.js");
    Bun.spawnSync(["chmod", "600", file]);
    writeFileSync(file, "evil");
    await boot();
    const list = await rpc<{ id: string; versions: { tampered: boolean; active: boolean }[] }[]>({ method: "listComponents" });
    expect(list.find((c) => c.id === "hello")?.versions[0]).toMatchObject({ tampered: true, active: false });
    expect(service.assets("hello", "0.1.0", published.version.hash)).toBeNull();
  });

  test("notes RPCs and the built-in notes component share the same folder", async () => {
    const { projectId, pageId } = await project();
    const info = await rpc<{ dir: string }>({ method: "getNotesDir", projectId });
    expect(info.dir).toBe(join(home, "notes", "KIB"));
    const inst = await rpc<Instance>({ method: "command", projectId, command: { method: "addInstance", pageId, component: "notes@1.0.0" } });
    await rpc({ method: "componentCall", projectId, instanceId: inst.id, call: { kind: "notes.write", path: "a.md", markdown: "# A", expectedMtime: null } });
    expect(await rpc({ method: "componentCall", projectId, instanceId: inst.id, call: { kind: "list", entity: "note" } })).toHaveLength(1);
  });

  test("drafts are listed until published", async () => {
    draft("0.1.0");
    expect(await rpc({ method: "listDrafts" })).toHaveLength(1);
    await rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    expect(await rpc({ method: "listDrafts" })).toEqual([]);
  });
});
```
Le cast `c as never` est limité à l'aide `call` du test (appels volontairement invalides pour le contrôle).

`packages/daemon/src/daemon.test.ts` :
```ts
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { readDaemonInfo } from "./components/daemon-info";
import { startDaemon } from "./daemon";

test("the daemon starts both listeners, writes daemon.json and removes it on stop", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-start-"));
  const d = await startDaemon({ home, port: 0, sandboxPort: 0, uiDir: null, dev: false, toolchain: DEV_TOOLCHAIN, user: "adam" });
  expect(readDaemonInfo(home)).toEqual({ port: d.port, sandboxPort: d.sandboxPort, pid: process.pid });
  expect(d.sandboxPort).not.toBe(d.port);
  const sandbox = await fetch(`http://127.0.0.1:${d.sandboxPort}/api/rpc`, { headers: { host: `127.0.0.1:${d.sandboxPort}` } });
  expect(sandbox.status).toBe(404);
  const ui = await fetch(`${d.url}/`, { headers: { host: `127.0.0.1:${d.port}` } });
  expect(ui.headers.get("content-security-policy")).toContain(`frame-src http://127.0.0.1:${d.sandboxPort};`);
  await d.stop();
  expect(readDaemonInfo(home)).toBeNull();
  rmSync(home, { recursive: true, force: true });
});
```

Run: `bun test packages/daemon/src/components/service.test.ts packages/daemon/src/daemon.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `components/service.ts`**

```ts
import type { Database } from "bun:sqlite";
import { executeProjectCommand, readInstanceData, readProject, writeInstanceData } from "@kibo/core";
import { type BuildOutput, type Toolchain, validateComponent } from "@kibo/devkit";
import {
  type BackendDescription,
  type ComponentCall,
  isBuiltinId,
  KiboError,
  type ProjectCommand,
  type RpcRequest,
  splitRef,
  type ValidationReport,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createNotesService } from "../notes/service";
import { ensureNotesTables } from "../notes/index";
import { ensureSettingsTable } from "../notes/settings";
import { createBackends } from "./backends";
import { listDrafts } from "./drafts";
import { createEventLog, ensureEventsTable } from "./events";
import { createGate } from "./gate";
import { createJobScheduler, type JobTarget } from "./jobs";
import { type NetProxyOptions, proxyFetch } from "./net-proxy";
import { createPublisher } from "./publish";
import { createQuotas } from "./quotas";
import { createRegistryService, type ProjectRef } from "./registry-service";
import type { AssetLookup } from "./sandbox-server";
import { createComponentStore } from "./store";
import { updateInstance } from "./update";

export const COMPONENT_METHODS: ReadonlySet<RpcRequest["method"]> = new Set<RpcRequest["method"]>([
  "listComponents",
  "componentCall",
  "approveComponent",
  "revokeComponent",
  "rehashComponent",
  "previewPublish",
  "publishComponent",
  "updateInstance",
  "uninstallComponent",
  "listDrafts",
  "getNotesDir",
  "setNotesDir",
  "getRuntimeInfo",
  "installCli",
]);

export type ComponentsDeps = {
  home: string;
  toolchain: Toolchain;
  db: Database;
  workspace: LoroDoc;
  persistWorkspace(): void;
  projects(): ProjectRef[];
  projectDoc(id: string): LoroDoc;
  persistProject(id: string): void;
  emit(projectId: string | null): void;
  sandboxOrigin(): string;
  build?: (srcDir: string, t: Toolchain) => Promise<BuildOutput>;
  validate?: (dir: string) => Promise<ValidationReport>;
  processCommand?: string[];
  net?: NetProxyOptions;
  installCli?: () => Promise<{ path: string }>;
};

type DataCall = Extract<ComponentCall, { kind: "data.get" | "data.set" | "data.delete" | "data.keys" }>;

export function createComponentsService(deps: ComponentsDeps) {
  ensureEventsTable(deps.db);
  ensureSettingsTable(deps.db);
  ensureNotesTables(deps.db);
  const events = createEventLog(deps.db);
  const store = createComponentStore({ home: deps.home, toolchain: deps.toolchain, ...(deps.build && { build: deps.build }) });
  const described = new Map<string, Promise<BackendDescription>>();
  const changedProject = (projectId: string) => {
    deps.persistProject(projectId);
    deps.emit(projectId);
  };
  const metaOf = (projectId: string) => {
    const p = deps.projects().find((x) => x.id === projectId);
    if (!p) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
    return readProject(p.doc).meta;
  };

  const notes = createNotesService({
    db: deps.db,
    home: deps.home,
    project: (id) => {
      const m = metaOf(id);
      return { id: m.id, key: m.key, folder: m.folder };
    },
    onChange: (id) => deps.emit(id),
  });

  let jobs: ReturnType<typeof createJobScheduler> | null = null;
  const refreshJobs = () => {
    jobs?.refresh().catch((e: unknown) => console.error("[kibo-daemon] jobs refresh failed", e));
  };

  const registry = createRegistryService({
    workspace: deps.workspace,
    persistWorkspace: deps.persistWorkspace,
    projects: deps.projects,
    store,
    events,
    stopBackend: (ref) => {
      described.delete(ref);
      backends.stop(ref);
    },
    emit: () => deps.emit(null),
    onApproved: async (id, v) => {
      await publisher.applyUpdateAll(id, v.version);
    },
  });

  const gate = createGate({
    instance: (projectId, instanceId) => {
      const inst = readProject(deps.projectDoc(projectId)).instances.find((i) => i.id === instanceId);
      if (!inst) throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
      return inst;
    },
    active: (ref) => registry.active(ref),
    quotas: createQuotas(),
    events,
    handlers: {
      list: async (projectId, entity) => {
        const snap = readProject(deps.projectDoc(projectId));
        const lists = { ticket: snap.tickets, status: snap.workflow, link: snap.links, page: snap.pages };
        if (entity === "note") throw new KiboError("INTERNAL", "notes are listed by the notes service");
        return lists[entity];
      },
      run: async (projectId, command: ProjectCommand) => {
        const result = executeProjectCommand(deps.projectDoc(projectId), command);
        changedProject(projectId);
        return result;
      },
      data: async (projectId, instanceId, call: DataCall) => {
        const doc = deps.projectDoc(projectId);
        switch (call.kind) {
          case "data.get":
            return readInstanceData(doc, instanceId)[call.key] ?? null;
          case "data.keys":
            return Object.keys(readInstanceData(doc, instanceId));
          case "data.set":
            writeInstanceData(doc, instanceId, call.key, call.value);
            changedProject(projectId);
            return null;
          case "data.delete":
            writeInstanceData(doc, instanceId, call.key, null);
            changedProject(projectId);
            return null;
        }
      },
      fetch: (rules, url, init) => proxyFetch(rules, url, init, deps.net),
      action: (ref, projectId, instanceId, config, name, input) => backends.action(ref, { projectId, instanceId, config, name, input }),
      notes: (projectId, call) => notes.handle(projectId, call),
    },
  });

  const backends = createBackends({
    source: (ref) => registry.source(ref),
    verify: (ref) => registry.verify(ref),
    onCall: (projectId, instanceId, call) => gate.call(projectId, instanceId, call),
    ...(deps.processCommand && { processCommand: deps.processCommand }),
  });

  const updateDeps = {
    doc: deps.projectDoc,
    persist: deps.persistProject,
    manifestOf: (ref: string) => registry.manifestOf(ref),
    migrate: (ref: string, req: Parameters<typeof backends.migrate>[1]) => backends.migrate(ref, req),
  };
  const update = async (projectId: string, instanceId: string, to: string) => {
    const inst = await updateInstance(updateDeps, projectId, instanceId, to);
    deps.emit(projectId);
    refreshJobs();
    return inst;
  };

  const publisher = createPublisher({
    home: deps.home,
    workspace: deps.workspace,
    persistWorkspace: deps.persistWorkspace,
    emit: () => deps.emit(null),
    store,
    registry,
    validate: deps.validate ?? ((dir) => validateComponent(dir, { toolchain: deps.toolchain })),
    update,
  });

  jobs = createJobScheduler({
    targets: () =>
      deps.projects().flatMap((p) =>
        readProject(p.doc).instances.flatMap((i): JobTarget[] =>
          isBuiltinId(splitRef(i.component).id) || registry.source(i.component) === null
            ? []
            : [{ projectId: p.id, instanceId: i.id, ref: i.component, config: i.config }],
        ),
      ),
    describe: (ref) => {
      const cached = described.get(ref);
      if (cached) return cached;
      const next = backends.describe(ref);
      described.set(ref, next);
      next.catch(() => described.delete(ref));
      return next;
    },
    run: (t, job) => backends.runJob(t.ref, { projectId: t.projectId, instanceId: t.instanceId, config: t.config, job }),
  });

  const assets: AssetLookup = (id, version, hash) => {
    const ref = `${id}@${version}`;
    const stored = registry.stored(ref);
    if (!stored || stored.hash !== hash) return null;
    return { stored, trust: registry.active(ref).trust };
  };

  return {
    assets,
    afterCommand: (_projectId: string) => refreshJobs(),
    async start() {
      await registry.verifyAll();
      refreshJobs();
    },
    stop() {
      jobs?.stop();
      backends.stopAll();
      notes.close();
      events.flush();
    },
    async handle(req: RpcRequest): Promise<unknown> {
      switch (req.method) {
        case "listComponents":
          return registry.list();
        case "componentCall":
          return gate.call(req.projectId, req.instanceId, req.call);
        case "approveComponent": {
          const v = await registry.approve(req.id, req.version, req.hash, req.trust);
          refreshJobs();
          return v;
        }
        case "revokeComponent":
          registry.revoke(req.id, req.version);
          refreshJobs();
          return null;
        case "rehashComponent":
          return registry.rehash(req.id, req.version);
        case "previewPublish":
          return publisher.preview(req.id);
        case "publishComponent": {
          const r = await publisher.publish(req.id, req.strategy);
          refreshJobs();
          return r;
        }
        case "updateInstance":
          return update(req.projectId, req.instanceId, req.to);
        case "uninstallComponent":
          await registry.uninstall(req.id, req.version);
          return null;
        case "listDrafts":
          return listDrafts(deps.home, deps.workspace);
        case "getNotesDir":
          return notes.info(req.projectId);
        case "setNotesDir":
          return notes.setDir(req.projectId, req.dir);
        case "getRuntimeInfo":
          return { sandboxOrigin: deps.sandboxOrigin() };
        case "installCli":
          if (!deps.installCli) throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
          return deps.installCli();
        default:
          throw new KiboError("INTERNAL", `${req.method} is not a component method`);
      }
    },
  };
}
```
`registry`, `gate`, `backends`, `publisher` et `jobs` se référencent mutuellement uniquement dans des fermetures appelées après la construction (jamais pendant) : l'ordre des déclarations est sans effet à l'exécution.

- [ ] **Step 4: Brancher `service.ts`**

`packages/daemon/src/service.ts` :
```ts
export type Service = {
  handle(req: RpcRequest): Promise<unknown>;
  onChange(listener: (projectId: string | null) => void): () => void;
  assets: AssetLookup;
  start(): Promise<void>;
  stop(): void;
};
export type ServiceOptions = {
  user: string;
  home: string;
  toolchain: Toolchain;
  sandboxOrigin(): string;
  build?: ComponentsDeps["build"];
  validate?: ComponentsDeps["validate"];
  processCommand?: string[];
  net?: NetProxyOptions;
  installCli?: () => Promise<{ path: string }>;
};
```
Dans `createService(store, opts)`, après la création de `projects` et `emit` :
```ts
  const components = createComponentsService({
    home: opts.home,
    toolchain: opts.toolchain,
    db: store.db,
    workspace,
    persistWorkspace: () => persist(WORKSPACE, workspace),
    projects: () => listProjects(workspace).map((m) => ({ id: m.id, name: m.name, doc: project(m.id) })),
    projectDoc: project,
    persistProject: (id) => persist(projectDocId(id), project(id)),
    emit,
    sandboxOrigin: opts.sandboxOrigin,
    ...(opts.build && { build: opts.build }),
    ...(opts.validate && { validate: opts.validate }),
    ...(opts.processCommand && { processCommand: opts.processCommand }),
    ...(opts.net && { net: opts.net }),
    ...(opts.installCli && { installCli: opts.installCli }),
  });
```
`handle` devient `async handle(req)` ; en tête : `if (COMPONENT_METHODS.has(req.method)) return components.handle(req);` ; le cas `command` refuse les commandes que seul le démon émet, puis prévient le planificateur :
```ts
        case "command": {
          if (req.command.method === "setInstanceComponent" || req.command.method === "setInstanceData") {
            throw new KiboError("PERMISSION_DENIED", `${req.command.method} is issued by the daemon only`);
          }
          const doc = project(req.projectId);
          const result = executeProjectCommand(doc, req.command);
          persist(projectDocId(req.projectId), doc);
          emit(req.projectId);
          components.afterCommand(req.projectId);
          return result;
        }
```
et l'objet renvoyé expose `assets: components.assets`, `start: () => components.start()`, `stop: () => components.stop()`. Les appels existants de `createService(store, { user })` dans les tests v0.1 passent désormais `{ user, home, toolchain: DEV_TOOLCHAIN, sandboxOrigin: () => "http://127.0.0.1:0" }` (ajuster `service.test.ts`, `server.test.ts`) et leurs `expect(service.handle(…))` deviennent `expect(await service.handle(…))`.

- [ ] **Step 5: `daemon.ts` et `main.ts`**

`packages/daemon/src/daemon.ts` :
```ts
import type { Toolchain } from "@kibo/devkit";
import { loadOrCreateToken } from "./auth";
import { removeDaemonInfo, writeDaemonInfo } from "./components/daemon-info";
import { startSandboxServer } from "./components/sandbox-server";
import type { ServiceOptions } from "./service";
import { createService } from "./service";
import { startServer } from "./server";
import { openStore } from "./store";

export type DaemonOptions = {
  home: string;
  port: number;
  sandboxPort: number;
  uiDir: string | null;
  dev: boolean;
  toolchain: Toolchain;
  user: string;
  build?: ServiceOptions["build"];
  validate?: ServiceOptions["validate"];
  installCli?: ServiceOptions["installCli"];
};

export async function startDaemon(opts: DaemonOptions) {
  const store = openStore(opts.home);
  const token = loadOrCreateToken(opts.home);
  let sandboxOrigin = "";
  const service = createService(store, {
    user: opts.user,
    home: opts.home,
    toolchain: opts.toolchain,
    sandboxOrigin: () => sandboxOrigin,
    ...(opts.build && { build: opts.build }),
    ...(opts.validate && { validate: opts.validate }),
    ...(opts.installCli && { installCli: opts.installCli }),
  });
  await service.start();
  const server = startServer({
    service,
    token,
    port: opts.port,
    uiDir: opts.uiDir,
    extraOrigins: opts.dev ? ["http://localhost:5173"] : [],
    assets: service.assets,
    sandboxOrigin: () => sandboxOrigin || null,
  });
  const sandbox = startSandboxServer({
    port: opts.sandboxPort,
    uiPort: server.port,
    assets: service.assets,
    extraAncestors: opts.dev ? ["http://localhost:5173"] : [],
  });
  sandboxOrigin = sandbox.url;
  writeDaemonInfo(opts.home, { port: server.port, sandboxPort: sandbox.port, pid: process.pid });
  return {
    url: server.url,
    port: server.port,
    sandboxPort: sandbox.port,
    token,
    async stop() {
      removeDaemonInfo(opts.home);
      sandbox.stop();
      server.stop();
      service.stop();
      store.close();
    },
  };
}
```
En mode `--dev` (Vite sur `localhost:5173`), le `frame-ancestors` du port sandbox accepte aussi `http://localhost:5173` : `startSandboxServer` gagne l'option `extraAncestors?: string[]` (défaut `[]`), passée à `sandboxHeaders(uiPort, extraAncestors)` qui les ajoute à la fin de `frame-ancestors` ; test ajouté dans `sandbox-server.test.ts` : avec `extraAncestors: ["http://localhost:5173"]`, l'en-tête se termine par `frame-ancestors http://127.0.0.1:4317 http://localhost:4317 http://localhost:5173; base-uri 'none'; form-action 'none'`.

`packages/daemon/src/main.ts` :
```ts
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { resolveToolchain } from "@kibo/devkit";
import { sandboxPortFor } from "./components/daemon-info";
import { startDaemon } from "./daemon";
import { kiboHome } from "./paths";

const parentPid = process.ppid;
const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4317" },
    "sandbox-port": { type: "string" },
    toolchain: { type: "string" },
    ui: { type: "string" },
    dev: { type: "boolean", default: false },
  },
});
const port = Number(values.port);
const daemon = await startDaemon({
  home: kiboHome(),
  port,
  sandboxPort: sandboxPortFor(port, values["sandbox-port"]),
  uiDir: values.ui ?? null,
  dev: values.dev,
  toolchain: resolveToolchain({ explicit: values.toolchain ?? null }),
  user: userInfo().username,
});
const shutdown = async () => {
  await daemon.stop();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
setInterval(() => {
  if (process.ppid !== parentPid) void shutdown();
}, 2000).unref();
process.stdout.write(`KIBO_READY ${daemon.url}/#pair=${daemon.token}\n`);
```
(La tâche 34 ajoute en tête la répartition des sous-commandes `component` et `component-runtime`.)

- [ ] **Step 6: Vérifier et committer**

Run: `bun test packages components && bun run typecheck && bun run check && bun run --cwd e2e test`
Expected: PASS (les parcours Playwright v0.1 restent verts : la ligne `KIBO_READY` et l'appairage sont inchangés).

```bash
git add packages/daemon/src
git commit -m "feat(daemon): assemblage des composants"
```

---

### Task 31: CLI `kibo component new | test | dev | publish`

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/src/index.ts`, `packages/cli/src/bin.ts`, `packages/cli/src/fr.ts`, `packages/cli/src/args.ts`, `packages/cli/src/daemon-client.ts`, `packages/cli/src/commands/new.ts`, `packages/cli/src/commands/test.ts`, `packages/cli/src/commands/dev.ts`, `packages/cli/src/commands/publish.ts`, `packages/cli/src/cli.test.ts`, `packages/sdk/src/dev.tsx`, `packages/sdk/src/dev-fr.ts`
- Modify: `package.json` (script `typecheck` : `packages/cli`), `CLAUDE.md` (arbre du monorepo et ligne des dépendances : `devkit ← cli`), `bun.lock`

**Interfaces:**
- Consumes: `scaffold`, `validateComponent`, `componentCss`, `resolveToolchain`, `Toolchain`, `formatIssue` (devkit) ; `readDaemonInfo` (tâche 22, dupliquée en lecture seule dans `daemon-client.ts` pour ne pas dépendre du démon) ; `startDaemon` (tâche 30, dans les tests seulement) ; `createMockSdk`, `seedDemo`, `DEMO_NOTES`, `DEMO_NOTE_AGES`, `SdkProvider` (SDK) ; `RpcRequest`, `RpcResult`, `PublishPreview`, `PublishResult`, `ValidationReport`, `KiboError`, `isKiboErrorCode` (schéma).
- Produces:
  - `type CliIo = { home: string; toolchain: Toolchain; out(line: string): void; err(line: string): void }` ; `runCli(argv: string[], io: CliIo): Promise<number>` (code de sortie) ; `@kibo/cli` exporte `runCli` et `cliIo()` (valeurs réelles : `KIBO_HOME`, toolchain résolue, `console`).
  - `type DaemonClient = { rpc<M extends RpcRequest["method"]>(req: Extract<RpcRequest, { method: M }>): Promise<RpcResult[M]> }` ; `connectDaemon(home): Promise<DaemonClient>` (lit `daemon.json` et `token`, s'appaire comme l'UI).
  - `startDevServer(dir, toolchain, opts?: { port?: number }): Promise<{ url: string; stop(): void }>` (aperçu local, rechargement à chaque sauvegarde).
  - `@kibo/sdk/dev` : `mountDev(manifest: unknown, Component: ComponentType): void` (SDK simulé chargé du jeu fictif, bascules widget / vue et sombre / clair).

- [ ] **Step 1: Créer le paquet et déclarer les dépendances**

`packages/cli/package.json` :
```json
{
  "name": "@kibo/cli",
  "version": "0.4.0",
  "private": true,
  "type": "module",
  "bin": { "kibo": "./src/bin.ts" },
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@kibo/devkit": "workspace:*",
    "@kibo/schema": "workspace:*"
  },
  "devDependencies": {
    "@kibo/daemon": "workspace:*",
    "@types/bun": "1.4.2"
  }
}
```
`@kibo/daemon` n'est qu'une dépendance de test (démarrer un vrai démon dans `cli.test.ts`) : aucune arête d'exécution `daemon ← cli`. `packages/cli/tsconfig.json` : comme `packages/devkit/tsconfig.json`, références `../schema`, `../devkit`. Racine : `packages/cli` ajouté au script `typecheck` après `packages/sdk`. `CLAUDE.md` : ajouter `packages/cli/  commande kibo (création, test, aperçu, publication de composants)` dans l'arbre et `devkit ← cli` à la ligne des dépendances autorisées. Run: `bun install`.

`packages/cli/src/fr.ts` :
```ts
export const fr = {
  usage: [
    "Usage :",
    "  kibo component new <id> [--kind widget|view|both] [--server]",
    "  kibo component test <id|dossier>",
    "  kibo component dev <id|dossier> [--port <n>]",
    "  kibo component publish <id> [--update-all|--new-version]",
  ].join("\n"),
  created: (dir: string) => `Composant créé : ${dir}`,
  next: (id: string) => `Ensuite : kibo component dev ${id}, puis kibo component test ${id}`,
  step: (name: string, ok: boolean) => `${ok ? "✓" : "✗"} ${name}`,
  steps: { manifest: "Manifeste", imports: "Imports", typecheck: "Types", tests: "Tests", conformance: "Conformité", permissions: "Permissions" },
  tests: (passed: number, failed: number) => `Tests : ${passed} réussi${passed > 1 ? "s" : ""}, ${failed} en échec`,
  missing: (p: string) => `  permission utilisée mais non déclarée : ${p}`,
  unused: (p: string) => `  permission déclarée mais inutilisée : ${p}`,
  valid: "Composant valide : il apparaît dans « Mes composants ».",
  invalid: "Composant invalide.",
  dev: (url: string) => `Aperçu : ${url} (Ctrl+C pour arrêter)`,
  noDaemon: "Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.",
  pairingFailed: "Appairage refusé : le jeton de ~/.kibo/token ne correspond pas.",
  strategyRequired: (n: number) =>
    `Ce composant est utilisé par ${n} instance${n > 1 ? "s" : ""} : ajoute --update-all ou --new-version.`,
  unchanged: "Rien à publier : cette version est déjà publiée avec le même code.",
  published: (version: string) => `Version ${version} publiée.`,
  needsApproval: "Autorisation requise : ouvre Kibo (écran « Composants ») pour l'accorder.",
  partial: (n: number) => `${n} instance${n > 1 ? "s" : ""} restée${n > 1 ? "s" : ""} sur l'ancienne version :`,
  failedLine: (project: string, page: string, message: string) => `  ${project} › ${page} — ${message}`,
  error: (code: string, message: string) => `Erreur ${code} : ${message}`,
};
```

- [ ] **Step 2: Écrire les tests**

`packages/cli/src/cli.test.ts` :
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { startDaemon } from "@kibo/daemon/daemon";
import { startDevServer } from "./commands/dev";
import { runCli } from "./index";

const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups.reverse()) c();
});
function io() {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  const out: string[] = [];
  const err: string[] = [];
  return { home, out, err, io: { home, toolchain: DEV_TOOLCHAIN, out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
}

describe("kibo component", () => {
  test("usage on unknown commands", async () => {
    const t = io();
    expect(await runCli(["nope"], t.io)).toBe(2);
    expect(t.err.join("\n")).toContain("kibo component new <id>");
  });

  test("new scaffolds into KIBO_HOME/components/src", async () => {
    const t = io();
    expect(await runCli(["component", "new", "burndown", "--kind", "widget", "--server"], t.io)).toBe(0);
    const dir = join(t.home, "components", "src", "burndown");
    expect(existsSync(join(dir, "server.ts"))).toBe(true);
    expect(t.out).toEqual([`Composant créé : ${dir}`, "Ensuite : kibo component dev burndown, puis kibo component test burndown"]);
    expect(await runCli(["component", "new", "burndown"], t.io)).toBe(1);
    expect(await runCli(["component", "new", "Bad_Id"], t.io)).toBe(1);
  });

  test("test validates a folder outside the monorepo and reports each step", async () => {
    const t = io();
    const f = copyFixture("hello");
    cleanups.push(f.dispose);
    expect(await runCli(["component", "test", f.dir], t.io)).toBe(0);
    expect(t.out).toContain("✓ Tests");
    expect(t.out).toContain("Composant valide : il apparaît dans « Mes composants ».");
    const bad = copyFixture("undeclared");
    cleanups.push(bad.dispose);
    expect(await runCli(["component", "test", bad.dir], t.io)).toBe(1);
    expect(t.out).toContain("  permission utilisée mais non déclarée : read:link");
  }, 240_000);

  test("publish talks to the running daemon and asks for a strategy when needed", async () => {
    const t = io();
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(1);
    expect(t.err).toContain("Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.");
    const daemon = await startDaemon({ home: t.home, port: 0, sandboxPort: 0, uiDir: null, dev: false, toolchain: DEV_TOOLCHAIN, user: "adam" });
    cleanups.push(() => void daemon.stop());
    const f = copyFixture("hello", { linkModules: false });
    cleanups.push(f.dispose);
    Bun.spawnSync(["cp", "-R", f.dir, join(t.home, "components", "src", "hello")]);
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(0);
    expect(t.out).toContain("Version 0.1.0 publiée.");
    expect(t.out).toContain("Autorisation requise : ouvre Kibo (écran « Composants ») pour l'accorder.");
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(0);
    expect(t.out.at(-1)).toBe("Rien à publier : cette version est déjà publiée avec le même code.");
  }, 240_000);

  test("dev serves a live preview", async () => {
    const f = copyFixture("hello");
    cleanups.push(f.dispose);
    const dev = await startDevServer(f.dir, DEV_TOOLCHAIN, { port: 0 });
    cleanups.push(dev.stop);
    const html = await (await fetch(dev.url)).text();
    expect(html).toContain('<script type="module" src="/app.js"></script>');
    const js = await fetch(`${dev.url}/app.js`);
    expect(js.status).toBe(200);
    expect((await fetch(`${dev.url}/app.css`)).status).toBe(200);
    expect((await fetch(`${dev.url}/version`)).status).toBe(200);
  }, 120_000);
});
```
`@kibo/daemon/daemon` : ajouter l'export `"./daemon": "./src/daemon.ts"` au `package.json` du démon (s'il n'expose pas encore de chemins, ajouter aussi `".": "./src/main.ts"` n'est pas souhaité : `main.ts` démarre un démon à l'import).

Run: `bun test packages/cli`
Expected: FAIL.

- [ ] **Step 3: Implémenter `args.ts`, `daemon-client.ts`, les commandes et `index.ts`**

`packages/cli/src/args.ts` :
```ts
export type Parsed = { positional: string[]; flags: Record<string, string | true> };

export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && (name === "kind" || name === "port")) {
      flags[name] = next;
      i += 1;
    } else flags[name] = true;
  }
  return { positional, flags };
}
```

`packages/cli/src/daemon-client.ts` :
```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isKiboErrorCode, KiboError, type RpcRequest, type RpcResult } from "@kibo/schema";

export type DaemonClient = {
  rpc<M extends RpcRequest["method"]>(req: Extract<RpcRequest, { method: M }>): Promise<RpcResult[M]>;
};

export async function connectDaemon(home: string): Promise<DaemonClient> {
  const infoFile = join(home, "daemon.json");
  const tokenFile = join(home, "token");
  if (!existsSync(infoFile) || !existsSync(tokenFile)) throw new KiboError("NOT_FOUND", "daemon not running");
  const info: unknown = JSON.parse(readFileSync(infoFile, "utf8"));
  const port = typeof info === "object" && info !== null ? Reflect.get(info, "port") : null;
  if (typeof port !== "number") throw new KiboError("NOT_FOUND", "daemon.json is invalid");
  const base = `http://127.0.0.1:${port}`;
  const headers = { origin: base, "content-type": "application/json" };
  let pair: Response;
  try {
    pair = await fetch(`${base}/api/pair`, { method: "POST", headers, body: JSON.stringify({ token: readFileSync(tokenFile, "utf8").trim() }) });
  } catch (e) {
    throw new KiboError("NOT_FOUND", `daemon not reachable: ${String(e)}`);
  }
  if (pair.status !== 204) throw new KiboError("UNAUTHORIZED", "pairing refused");
  const cookie = (pair.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  return {
    async rpc(req) {
      const res = await fetch(`${base}/api/rpc`, { method: "POST", headers: { ...headers, cookie }, body: JSON.stringify(req) });
      const body: unknown = await res.json();
      if (typeof body !== "object" || body === null) throw new KiboError("INTERNAL", "invalid daemon response");
      if (Reflect.get(body, "ok") === true) return Reflect.get(body, "result") as never;
      const error: unknown = Reflect.get(body, "error");
      const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") : null;
      const message = typeof error === "object" && error !== null ? String(Reflect.get(error, "message")) : "";
      throw new KiboError(isKiboErrorCode(code) ? code : "INTERNAL", message);
    },
  };
}
```
Le cast `as never` est la frontière réseau typée par `RpcResult[M]` (même contrat que `createClient` du SDK, qui ne peut pas être réutilisé ici : il dépend du `fetch` du navigateur et du cookie géré par celui-ci).

`packages/cli/src/commands/new.ts` :
```ts
import { join } from "node:path";
import { scaffold } from "@kibo/devkit";
import { fr } from "../fr";
import type { CliIo } from "../index";

export async function newCommand(id: string, kind: "widget" | "view" | "both", server: boolean, io: CliIo): Promise<number> {
  const dir = await scaffold({ root: join(io.home, "components", "src"), id, kind, server, toolchain: io.toolchain });
  io.out(fr.created(dir));
  io.out(fr.next(id));
  return 0;
}
```

`packages/cli/src/commands/test.ts` :
```ts
import { isAbsolute, join, resolve } from "node:path";
import { validateComponent } from "@kibo/devkit";
import { fr } from "../fr";
import type { CliIo } from "../index";

export const componentDir = (target: string, io: CliIo): string =>
  target.includes("/") || target === "." ? (isAbsolute(target) ? target : resolve(target)) : join(io.home, "components", "src", target);

export async function testCommand(target: string, io: CliIo): Promise<number> {
  const r = await validateComponent(componentDir(target, io), { toolchain: io.toolchain });
  const s = fr.steps;
  io.out(fr.step(s.manifest, r.manifest.ok));
  for (const e of r.manifest.errors) io.out(`  ${e}`);
  io.out(fr.step(s.imports, r.imports.ok));
  for (const e of r.imports.errors) io.out(`  ${e}`);
  io.out(fr.step(s.typecheck, r.typecheck.ok));
  for (const e of r.typecheck.errors) io.out(`  ${e}`);
  io.out(fr.step(s.tests, r.tests.ok));
  io.out(fr.tests(r.tests.passed, r.tests.failed));
  if (!r.tests.ok && r.tests.output) io.out(r.tests.output);
  io.out(fr.step(s.conformance, r.conformance.ok));
  for (const e of r.conformance.errors) io.out(`  ${e}`);
  io.out(fr.step(s.permissions, r.permissions.missing.length === 0 && r.permissions.errors.length === 0));
  for (const p of r.permissions.missing) io.out(fr.missing(p));
  for (const e of r.permissions.errors) io.out(`  ${e}`);
  for (const p of r.permissions.unused) io.out(fr.unused(p));
  io.out(r.ok ? fr.valid : fr.invalid);
  return r.ok ? 0 : 1;
}
```

`packages/cli/src/commands/publish.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { connectDaemon } from "../daemon-client";
import { fr } from "../fr";
import type { CliIo } from "../index";

export async function publishCommand(id: string, strategy: "update-all" | "new-version" | null, io: CliIo): Promise<number> {
  let client: Awaited<ReturnType<typeof connectDaemon>>;
  try {
    client = await connectDaemon(io.home);
  } catch (e) {
    if (e instanceof KiboError && e.code === "UNAUTHORIZED") io.err(fr.pairingFailed);
    else if (e instanceof KiboError && e.code === "NOT_FOUND") io.err(fr.noDaemon);
    else throw e;
    return 1;
  }
  const preview = await client.rpc({ method: "previewPublish", id });
  if (preview.status === "unchanged") {
    io.out(fr.unchanged);
    return 0;
  }
  if (!preview.validation.ok) {
    io.err(fr.invalid);
    return 1;
  }
  if (preview.usages.length > 0 && strategy === null) {
    io.err(fr.strategyRequired(preview.usages.length));
    return 1;
  }
  const r = await client.rpc({ method: "publishComponent", id, strategy: strategy ?? "new-version" });
  io.out(fr.published(r.version.version));
  if (r.needsApproval) io.out(fr.needsApproval);
  if (r.failed.length > 0) {
    io.out(fr.partial(r.failed.length));
    for (const f of r.failed) io.out(fr.failedLine(f.projectName, f.pageTitle, f.message));
  }
  return 0;
}
```

`packages/cli/src/commands/dev.ts` :
```ts
import { watch } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { componentCss, type Toolchain } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

const PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>Kibo · aperçu</title><link rel="stylesheet" href="/app.css"></head>' +
  '<body><div id="root"></div><script type="module" src="/app.js"></script>' +
  "<script>let v=null;setInterval(async()=>{const r=await fetch('/version');const t=await r.text();if(v!==null&&t!==v)location.reload();v=t;},500);</script>" +
  "</body></html>";

export async function startDevServer(dir: string, toolchain: Toolchain, opts: { port?: number } = {}): Promise<{ url: string; stop(): void }> {
  const entryDir = await mkdtemp(join(tmpdir(), "kibo-dev-"));
  await writeFile(
    join(entryDir, "entry.tsx"),
    `import { mountDev } from "@kibo/sdk/dev";\nimport manifest from ${JSON.stringify(join(dir, "kibo.component.json"))};\nimport { Component } from ${JSON.stringify(join(dir, "ui.tsx"))};\nmountDev(manifest, Component);\n`,
  );
  let version = 0;
  let js = "";
  let css = "";
  let failure: string | null = null;
  const rebuild = async () => {
    const result = await Bun.build({
      entrypoints: [join(entryDir, "entry.tsx")],
      target: "browser",
      format: "esm",
      define: { "process.env.NODE_ENV": JSON.stringify("development") },
      plugins: [
        {
          name: "kibo-dev-resolve",
          setup(build) {
            build.onResolve({ filter: /^(react|react-dom|@kibo\/|lucide-react)/ }, (args) => ({ path: Bun.resolveSync(args.path, toolchain.root) }));
          },
        },
      ],
      throw: false,
    });
    const [out] = result.outputs;
    if (!result.success || !out) {
      failure = result.logs.map((l) => l.message).join("\n");
    } else {
      js = await out.text();
      css = await componentCss(dir, toolchain);
      failure = null;
    }
    version += 1;
  };
  await rebuild();
  let pending: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(dir, { recursive: true }, (_e, name) => {
    if (!name || name.startsWith(".") || name.startsWith("node_modules")) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      rebuild().catch((e: unknown) => {
        failure = String(e);
      });
    }, 150);
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/") return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (path === "/version") return new Response(String(version));
      if (path === "/app.css") return new Response(css, { headers: { "content-type": "text/css; charset=utf-8" } });
      if (path === "/app.js") {
        const body = failure ? `document.body.textContent = ${JSON.stringify(failure)};` : js;
        return new Response(body, { headers: { "content-type": "text/javascript; charset=utf-8" } });
      }
      return new Response("not found", { status: 404 });
    },
  });
  if (server.port === undefined) throw new KiboError("INTERNAL", "dev server did not bind");
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => {
      watcher.close();
      server.stop(true);
      void rm(entryDir, { recursive: true, force: true });
    },
  };
}
```
Une erreur de build est affichée dans la page d'aperçu (et non avalée) ; le serveur n'écoute que sur `127.0.0.1`.

`packages/cli/src/index.ts` :
```ts
import { join } from "node:path";
import { resolveToolchain, type Toolchain } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { parseArgs } from "./args";
import { startDevServer } from "./commands/dev";
import { newCommand } from "./commands/new";
import { publishCommand } from "./commands/publish";
import { componentDir, testCommand } from "./commands/test";
import { fr } from "./fr";

export type CliIo = { home: string; toolchain: Toolchain; out(line: string): void; err(line: string): void };

export function cliIo(): CliIo {
  return {
    home: process.env.KIBO_HOME ?? join(process.env.HOME ?? "", ".kibo"),
    toolchain: resolveToolchain(),
    out: (l) => console.log(l),
    err: (l) => console.error(l),
  };
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const [scope, command, target] = positional;
  if (scope !== "component" || !command || !target) {
    io.err(fr.usage);
    return 2;
  }
  try {
    switch (command) {
      case "new": {
        const kind = flags.kind === "view" || flags.kind === "both" ? flags.kind : "widget";
        return await newCommand(target, kind, flags.server === true, io);
      }
      case "test":
        return await testCommand(target, io);
      case "dev": {
        const port = typeof flags.port === "string" ? Number(flags.port) : 0;
        const dev = await startDevServer(componentDir(target, io), io.toolchain, { port });
        io.out(fr.dev(dev.url));
        await new Promise<void>((resolve) => process.once("SIGINT", () => resolve()));
        dev.stop();
        return 0;
      }
      case "publish": {
        const strategy = flags["update-all"] === true ? "update-all" : flags["new-version"] === true ? "new-version" : null;
        return await publishCommand(target, strategy, io);
      }
      default:
        io.err(fr.usage);
        return 2;
    }
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(fr.error(e.code, e.detail));
    return 1;
  }
}
```

`packages/cli/src/bin.ts` :
```ts
#!/usr/bin/env bun
import { cliIo, runCli } from "./index";

process.exit(await runCli(process.argv.slice(2), cliIo()));
```

- [ ] **Step 4: `@kibo/sdk/dev`**

`packages/sdk/src/dev-fr.ts` :
```ts
export const devFr = {
  widget: "Widget",
  view: "Vue",
  dark: "Sombre",
  light: "Clair",
  surface: "Affichage",
  theme: "Thème",
  hint: "Aperçu local avec le jeu de données fictif ; rien n'est envoyé au démon.",
};
```

`packages/sdk/src/dev.tsx` :
```tsx
import { ComponentManifest, type Surface, type Theme } from "@kibo/schema";
import { type ComponentType, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { devFr } from "./dev-fr";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "./fixtures";
import { createMockSdk } from "./mock";
import { SdkProvider } from "./react";
import { Button } from "./ui/button";

function DevShell({ manifest, Component }: { manifest: ComponentManifest; Component: ComponentType }) {
  const [surface, setSurface] = useState<Surface>(manifest.kind === "view" ? "view" : "widget");
  const [theme, setTheme] = useState<Theme>(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  const mock = useMemo(
    () => createMockSdk(manifest, { seed: (run) => seedDemo(run), surface, notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES }),
    [manifest, surface],
  );
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {manifest.kind === "both" &&
          (["widget", "view"] as const).map((s) => (
            <Button key={s} size="sm" variant={surface === s ? "default" : "outline"} onClick={() => setSurface(s)}>
              {devFr[s]}
            </Button>
          ))}
        {(["dark", "light"] as const).map((t) => (
          <Button key={t} size="sm" variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>
            {devFr[t]}
          </Button>
        ))}
        <span className="text-muted-foreground">{devFr.hint}</span>
      </div>
      <div className={surface === "widget" ? "h-80 w-[480px] overflow-hidden rounded-lg border bg-card" : "flex-1 rounded-lg border"}>
        <SdkProvider sdk={mock.sdk}>
          <Component />
        </SdkProvider>
      </div>
    </div>
  );
}

export function mountDev(manifestInput: unknown, Component: ComponentType): void {
  const manifest = ComponentManifest.parse(manifestInput);
  const root = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
  createRoot(root).render(<DevShell manifest={manifest} Component={Component} />);
}
```

- [ ] **Step 5: Vérifier et committer**

Run: `bun install && bun test packages/cli packages/sdk && bun run typecheck && bun run check`
Expected: PASS.

```bash
git add packages/cli packages/sdk/src/dev.tsx packages/sdk/src/dev-fr.ts packages/daemon/package.json package.json CLAUDE.md bun.lock
git commit -m "feat(cli): commande kibo component"
```

---

### Task 32: Test de sortie « composant tiers sandboxé bloqué »

**Files:**
- Create: `packages/devkit/fixtures/evil/{kibo.component.json,ui.tsx,server.ts,component.test.tsx.fixture}`, `packages/daemon/src/components/exit.test.ts`

**Interfaces:**
- Consumes: `createService` (tâche 30, avec la vraie construction et le vrai `ProcessHost`) ; `copyFixture`, `DEV_TOOLCHAIN` (test-kit) ; `createEventLog` (tâche 15).
- Produces: le test qui porte le critère de sortie §13 (CI macOS et Linux).

- [ ] **Step 1: La fixture `evil`**

`packages/devkit/fixtures/evil/kibo.component.json` :
```json
{ "id": "evil", "version": "0.1.0", "kind": "widget", "title": "Evil", "reads": ["ticket"], "writes": [] }
```
`packages/devkit/fixtures/evil/ui.tsx` :
```tsx
import { useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";

export function Component() {
  const sdk = useSdk();
  const [state, setState] = useState("…");
  useEffect(() => {
    sdk
      .list("ticket")
      .then((tickets) => {
        const first = tickets[0];
        return first ? sdk.run({ method: "deleteTicket", ticketId: first.id }) : null;
      })
      .then(
        () => setState("deleted"),
        (e: unknown) => setState(String(e)),
      );
  }, [sdk]);
  return <p>{state}</p>;
}
```
`packages/devkit/fixtures/evil/server.ts` :
```ts
import { defineServer } from "@kibo/sdk/server";

export const server = defineServer({
  actions: {
    attack: async (ctx) => {
      const tickets = await ctx.list("ticket");
      const results: string[] = [];
      for (const attempt of [
        () => ctx.run({ method: "deleteTicket", ticketId: tickets[0]?.id ?? "" }),
        () => ctx.fetch("https://example.com"),
        () => ctx.data.set("k", 1),
      ]) {
        try {
          await attempt();
          results.push("allowed");
        } catch (e) {
          results.push(e instanceof Error ? e.message : String(e));
        }
      }
      return { results, fetchGlobal: typeof fetch, bunFile: typeof Bun.file };
    },
  },
});
```
`packages/devkit/fixtures/evil/component.test.tsx.fixture` : `runConformance({ manifest, Component })` comme `hello`.

Le code `server.ts` utilise `Bun` et `fetch` en position de valeur : la validation du devkit le refuserait (décision 16). Le test **contourne volontairement la validation** (fonction `validate` injectée qui renvoie « vert ») : il vérifie la défense du démon, pas celle du devkit. Le build accepte ces identifiants (ce ne sont pas des imports) ; c'est le runtime restreint qui a retiré `fetch` et `Bun.file`.

- [ ] **Step 2: Écrire le test**

`packages/daemon/src/components/exit.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { Instance, Page, RpcRequest, TicketView, ValidationReport } from "@kibo/schema";
import { createService } from "../service";
import { openStore } from "../store";
import { createEventLog } from "./events";

const home = mkdtempSync(join(tmpdir(), "kibo-exit-"));
const store = openStore(home);
const bypass = async (): Promise<ValidationReport> => {
  const { hashSources } = await import("@kibo/devkit");
  return {
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: true, errors: [] },
    tests: { ok: true, passed: 1, failed: 0, output: "" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: ["read:ticket"], used: ["read:ticket"], missing: [], unused: [], errors: [] },
    hash: await hashSources(join(home, "components", "src", "evil")),
    ok: true,
  };
};
const service = createService(store, { user: "adam", home, toolchain: DEV_TOOLCHAIN, sandboxOrigin: () => "http://127.0.0.1:0", validate: bypass });
afterAll(() => {
  service.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});
const rpc = <T = unknown>(req: RpcRequest) => service.handle(req) as Promise<T>;

test("a sandboxed third-party component cannot delete a ticket nor reach the network", async () => {
  await service.start();
  const evil = copyFixture("evil", { linkModules: false });
  Bun.spawnSync(["cp", "-R", evil.dir, join(home, "components", "src", "evil")]);
  evil.dispose();

  const { id: projectId } = await rpc<{ id: string }>({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" });
  await rpc({ method: "command", projectId, command: { method: "createTicket", title: "Précieux" } });
  const page = await rpc<Page>({ method: "command", projectId, command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" } });

  const published = await rpc<{ version: { hash: string } }>({ method: "publishComponent", id: "evil", strategy: "new-version" });
  await rpc({ method: "approveComponent", id: "evil", version: "0.1.0", hash: published.version.hash, trust: "sandboxed" });
  const inst = await rpc<Instance>({ method: "command", projectId, command: { method: "addInstance", pageId: page.id, component: "evil@0.1.0" } });
  const tickets = await rpc<{ tickets: TicketView[] }>({ method: "getProject", projectId });
  const ticketId = tickets.tickets[0]?.id ?? "";

  const ui = (call: unknown) => rpc({ method: "componentCall", projectId, instanceId: inst.id, call: call as never });
  await expect(ui({ kind: "run", command: { method: "deleteTicket", ticketId } })).rejects.toThrow("PERMISSION_DENIED");
  await expect(ui({ kind: "fetch", url: "https://example.com", init: { method: "GET", headers: {} } })).rejects.toThrow("PERMISSION_DENIED");
  await expect(ui({ kind: "run", command: { method: "setInstanceData", instanceId: inst.id, key: "k", value: 1 } })).rejects.toThrow("PERMISSION_DENIED");

  const attack = (await ui({ kind: "action", name: "attack", input: null })) as { results: string[]; fetchGlobal: string; bunFile: string };
  expect(attack.results.every((r) => r.includes("PERMISSION_DENIED"))).toBe(true);
  expect(attack.fetchGlobal).toBe("undefined");
  expect(attack.bunFile).toBe("undefined");

  const after = await rpc<{ tickets: TicketView[] }>({ method: "getProject", projectId });
  expect(after.tickets.map((t) => t.title)).toEqual(["Précieux"]);
  const refused = createEventLog(store.db).list().filter((e) => e.ref === "evil@0.1.0");
  expect(refused.map((e) => [e.kind, e.code])).toEqual([
    ["run", "PERMISSION_DENIED"],
    ["fetch", "PERMISSION_DENIED"],
    ["run", "PERMISSION_DENIED"],
    ["run", "PERMISSION_DENIED"],
    ["fetch", "PERMISSION_DENIED"],
    ["data.set", "PERMISSION_DENIED"],
  ]);
  expect(new Database(join(home, "kibo.db"), { readonly: true }).query("SELECT count(*) AS n FROM component_events").get()).toEqual({ n: 6 });
}, 120_000);
```
Le cast `call as never` est limité à l'aide `ui` du test. Le test lance le vrai processus sandboxé (`component-runtime.ts`) : c'est ce qui en fait le test de sortie.

Run: `bun test packages/daemon/src/components/exit.test.ts`
Expected: PASS (la défense existe déjà : ce test fige le critère de sortie ; s'il échoue, c'est un défaut des tâches 11, 15 ou 30, à corriger avant de continuer).

- [ ] **Step 3: Commit**

```bash
git add packages/devkit/fixtures/evil packages/daemon/src/components/exit.test.ts
git commit -m "test(daemon): composant tiers bloqué"
```

---

### Task 33: Parcours Playwright des composants (sombre et clair)

**Files:**
- Create: `e2e/components.spec.ts`, `e2e/helpers.ts`, `e2e/fixtures/components/hello/{kibo.component.json,ui.tsx,component.test.tsx}`, `e2e/e2e-home.ts`
- Modify: `e2e/serve.ts` (dossier `KIBO_HOME` connu, brouillons copiés), `e2e/mvp.spec.ts` (aides déplacées dans `helpers.ts`, sans changement de comportement), `e2e/playwright.config.ts` (délai des parcours de composants), `biome.json` (si les fixtures `e2e/fixtures` doivent être ignorées par le linter : non, elles sont conformes)

**Interfaces:**
- Consumes: tout le produit : écrans 3, 6, 7, 10, 11, 29, 30 et D1–D10 ; démon démarré par `serve.ts` avec la vraie validation, la vraie construction et le vrai port sandbox (`4391`).
- Produces: `E2E_HOME` (`e2e/e2e-home.ts`) ; aides `pairAndCreateProject`, `createPage`, `addComponent` (`e2e/helpers.ts`, `addComponent` accepte tout titre).

- [ ] **Step 1: Préparer le démon de test**

`e2e/e2e-home.ts` :
```ts
import { tmpdir } from "node:os";
import { join } from "node:path";

export const E2E_HOME = join(tmpdir(), "kibo-e2e-4390");
```

`e2e/fixtures/components/hello/kibo.component.json` :
```json
{ "id": "hello", "version": "0.1.0", "kind": "widget", "title": "Hello", "reads": ["ticket"], "writes": [], "changes": ["Premier jet"] }
```
`e2e/fixtures/components/hello/ui.tsx` :
```tsx
import { useEntities, useSdk } from "@kibo/sdk";
import manifest from "./kibo.component.json";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <div className="grid gap-1 p-4 text-sm">
      <p className="font-medium">Hello {sdk.viewer}</p>
      <p className="text-muted-foreground">Version {manifest.version}</p>
      <p>{tickets.data.length} tickets</p>
    </div>
  );
}
```
`e2e/fixtures/components/hello/component.test.tsx` :
```tsx
import { runConformance } from "@kibo/sdk/conformance";
import manifest from "./kibo.component.json";
import { Component } from "./ui";

runConformance({ manifest, Component });
```
Ces fichiers ne sont pas exécutés par `bun test packages components` (hors de ces dossiers) ; `e2e/tsconfig.json` exclut `fixtures/**` (les modules `@kibo/sdk` sont résolus par la toolchain du démon, pas par le projet e2e).

`e2e/serve.ts` : remplacer `mkdtempSync(...)` par :
```ts
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { E2E_HOME } from "./e2e-home";

const home = E2E_HOME;
rmSync(home, { recursive: true, force: true });
mkdirSync(join(home, "components", "src"), { recursive: true, mode: 0o700 });
for (const variant of ["dark", "light"]) {
  const dir = join(home, "components", "src", `hello-${variant}`);
  cpSync(join(import.meta.dir, "fixtures", "components", "hello"), dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "kibo.component.json"), "utf8"));
  writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ ...manifest, id: `hello-${variant}`, title: `Hello ${variant}` }));
}
```
(les imports `mkdtempSync` et `tmpdir` deviennent inutiles). Les projets Playwright `dark` et `light` partagent un démon : chacun publie son propre composant, le parcours est rejouable dans n'importe quel ordre.

`e2e/playwright.config.ts` : `timeout` reste à 30 s ; `components.spec.ts` appelle `test.setTimeout(240_000)` (validation réelle : typecheck et `bun test`).

- [ ] **Step 2: Extraire les aides**

`e2e/helpers.ts` : y déplacer `projectKey`, `pairAndCreateProject`, `createPage` et `addComponent` de `mvp.spec.ts` (exportées, corps inchangés ; `addComponent(page, title: string)`), et `mvp.spec.ts` les importe. Si la phase 3 a déjà créé un module d'aides, y ajouter seulement ce qui manque.

- [ ] **Step 3: Écrire le parcours**

`e2e/components.spec.ts` :
```ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { E2E_HOME } from "./e2e-home";
import { addComponent, createPage, pairAndCreateProject, projectKey } from "./helpers";

test.setTimeout(240_000);

async function openComponents(page: Page) {
  await page.getByRole("button", { name: "Composants" }).click();
  await expect(page.getByRole("columnheader", { name: "Confiance" })).toBeVisible();
}

async function publishDraft(page: Page, title: string, version: string, strategy?: "Mettre à jour partout") {
  await openComponents(page);
  const drafts = page.getByRole("region", { name: "Brouillons" }).or(page.locator("section", { hasText: "Brouillons" }));
  await drafts.getByRole("button", { name: "Publier" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Publier « ${title} » ${version}`)).toBeVisible({ timeout: 120_000 });
  if (strategy) await dialog.getByRole("radio", { name: new RegExp(strategy) }).check();
  await dialog.getByRole("button", { name: `Publier ${version}` }).click();
}

test("publier, autoriser, rendre en sandbox, mettre à jour partout", async ({ page }, info) => {
  const variant = info.project.name;
  const id = `hello-${variant}`;
  const title = `Hello ${variant}`;
  const key = projectKey("CMP", info);
  await pairAndCreateProject(page, info, key);

  await publishDraft(page, title, "0.1.0");
  const trust = page.getByRole("dialog", { name: `Autoriser « ${title} » 0.1.0 ?` });
  await expect(trust.getByText("Lire les tickets du projet")).toBeVisible();
  await expect(trust.getByText("Aucun accès réseau, aucun fichier local")).toBeVisible();
  await expect(trust.getByRole("radio", { name: /Sandboxé \(recommandé\)/ })).toBeChecked();
  await trust.getByRole("button", { name: "Autoriser" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${title}.*0\\.1\\.0.*Sandboxé`) })).toBeVisible();

  await page.getByRole("button", { name: `Kibo ${key}` }).click();
  for (const pageTitle of ["Tableau A", "Tableau B"]) {
    await createPage(page, pageTitle, "Tableau de bord");
    await addComponent(page, title);
    const frame = page.frameLocator(`iframe[title="${title}"]`);
    await expect(frame.getByText("Hello")).toBeVisible();
    await expect(frame.getByText("Version 0.1.0")).toBeVisible();
    await expect(page.locator(`iframe[title="${title}"]`)).toHaveAttribute("sandbox", "allow-scripts");
  }

  const manifestFile = join(E2E_HOME, "components", "src", id, "kibo.component.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  writeFileSync(manifestFile, JSON.stringify({ ...manifest, version: "0.2.0", changes: ["Affiche la version"] }));

  await publishDraft(page, title, "0.2.0", "Mettre à jour partout");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Utilisé dans 1 projet")).toBeVisible();
  await expect(dialog.getByText("Affiche la version")).toBeVisible();
  await expect(dialog.getByText("Version 0.2.0 publiée.")).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${title}.*0\\.2\\.0.*2 pages · 1 projet`) })).toBeVisible();

  await page.getByRole("button", { name: `Kibo ${key}` }).click();
  await page.getByRole("button", { name: "Tableau A" }).click();
  await expect(page.frameLocator(`iframe[title="${title}"]`).getByText("Version 0.2.0")).toBeVisible();
});

test("graphe et notes intégrés", async ({ page }, info) => {
  const key = projectKey("GRN", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Graphe", "Vue");
  await addComponent(page, "Graphe de dépendances");
  await expect(page.getByText("Aucune dépendance entre les tickets affichés.")).toBeVisible();

  await page.getByRole("button", { name: `Kibo ${key}` }).click();
  await createPage(page, "Notes", "Vue");
  await addComponent(page, "Notes");
  await expect(page.getByText("Aucune note dans ce dossier.")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle note" }).click();
  const editor = page.getByRole("textbox", { name: "Contenu de la note" });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(`# Décisions\n\nVoir ${key}-1.`);
  await expect(page.getByText("Enregistré • local")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Décisions" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Notes" }).getByText("Décisions")).toBeVisible();

  const notesDir = join(E2E_HOME, "notes", key);
  writeFileSync(join(notesDir, "sans-titre.md"), "# Changé ailleurs\n");
  await expect(page.getByRole("heading", { level: 1, name: "Changé ailleurs" })).toBeVisible({ timeout: 5_000 });
});
```
Le titre du bouton de projet (`Kibo ${key}`) et le bouton de page suivent la barre latérale v0.1 ; si la phase 3 a remplacé la navigation (onglets), adapter les deux sélecteurs aux aides partagées de la phase 3.

- [ ] **Step 4: Lancer et committer**

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: PASS dans les projets `dark` et `light`.

```bash
git add e2e/components.spec.ts e2e/helpers.ts e2e/e2e-home.ts e2e/fixtures e2e/serve.ts e2e/mvp.spec.ts e2e/tsconfig.json
git commit -m "test(e2e): parcours des composants"
```

---

### Task 34: Binaire, toolchain embarquée, installation de `kibo` et CI

**Files:**
- Create: `apps/desktop/sidecar/entry.ts`, `apps/desktop/scripts/build-toolchain.ts`, `apps/desktop/scripts/cli-smoke.ts`, `packages/daemon/src/components/install-cli.ts`, `packages/daemon/src/components/install-cli.test.ts`, `packages/ui/src/settings/CliInstallCard.tsx`, `packages/ui/src/settings/cli-install.test.tsx`
- Modify: `apps/desktop/scripts/build-sidecar.ts` (entrée `entry.ts`, Worker, option `--out`), `apps/desktop/src-tauri/tauri.conf.json` (ressource `toolchain/` ; `bundle.linux.deb.depends` et `bundle.linux.rpm.depends` : `["bubblewrap"]`, décision 24), `apps/desktop/src-tauri/src/main.rs` (`--toolchain`), `apps/desktop/package.json` (scripts), `packages/daemon/src/main.ts` (`installCli`), `.github/workflows/ci.yml` (étape « CLI compilée »), `.gitignore` (`apps/desktop/src-tauri/toolchain/`), l'écran Paramètres › Général (ou la page Composants, voir étape 5)

**Interfaces:**
- Consumes: `runCli`, `cliIo` (tâche 31) ; `startComponentRuntime` (tâche 11) ; `startDaemon` (tâche 30) ; `isCompiled` (tâche 1) ; RPC `installCli` ; `fr.cli` (tâche 2).
- Produces:
  - Binaire unique `kibo-daemon` : sans argument ⇒ démon ; `component …` ⇒ CLI ; `component-runtime` ⇒ runtime sandboxé ; lancé via un lien nommé `kibo` sans sous-commande ⇒ usage de la CLI.
  - `installCli(opts?: { execPath?: string; binDir?: string; compiled?: boolean }): Promise<{ path: string }>` (lien symbolique `~/.local/bin/kibo` → binaire ; hors binaire compilé ⇒ `INVALID_INPUT`).
  - Toolchain packagée `toolchain/node_modules/…` (fermeture des dépendances de : `typescript`, `@kibo/sdk`, `@kibo/schema`, `@kibo/core`, `@kibo/devkit`, `react`, `react-dom`, `lucide-react`, `@testing-library/react`, `@testing-library/dom`, `@happy-dom/global-registrator`, `@types/bun`, `@types/react`, `tailwindcss`, `@tailwindcss/node`, `@tailwindcss/oxide` et son binaire de plateforme, `tw-animate-css`, `shadcn`).
  - `CliInstallCard` (D8).

- [ ] **Step 1: Point d'entrée unique**

`apps/desktop/sidecar/entry.ts` :
```ts
import { basename } from "node:path";

const args = process.argv.slice(2);
if (args[0] === "component-runtime") {
  const { startComponentRuntime } = await import("../../../packages/daemon/src/component-runtime");
  await startComponentRuntime();
} else if (args[0] === "component" || basename(process.argv0) === "kibo") {
  const { cliIo, runCli } = await import("../../../packages/cli/src/index");
  process.exit(await runCli(args, cliIo()));
} else {
  await import("../../../packages/daemon/src/main");
}
```
`component-runtime.ts` ne démarre seul que si `import.meta.main` : importé ici, il attend l'appel explicite. `main.ts` démarre le démon à l'import (comportement voulu pour cette branche).

`apps/desktop/scripts/build-sidecar.ts` : `entrypoints: [join(root, "apps/desktop/sidecar/entry.ts"), join(root, "packages/daemon/src/components/component-worker.ts")]` (le Worker est une entrée supplémentaire du binaire, spike F) ; option `--out <fichier>` (lue par `parseArgs`) qui remplace le chemin calculé depuis le triplet Rust (utilisée par la CI hors Tauri). Si le spike F a conclu au repli, retirer l'entrée Worker (les `trusted` passent par `ProcessHost` non restreint, décidé en tâche 1).

- [ ] **Step 2: Toolchain packagée**

`apps/desktop/scripts/build-toolchain.ts` :
```ts
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dir, "../../..");
const { values } = parseArgs({ options: { out: { type: "string" } } });
const out = values.out ?? join(root, "apps/desktop/src-tauri/toolchain");
const ROOTS = [
  "typescript",
  "@kibo/sdk",
  "@kibo/schema",
  "@kibo/core",
  "@kibo/devkit",
  "react",
  "react-dom",
  "lucide-react",
  "@testing-library/react",
  "@testing-library/dom",
  "@happy-dom/global-registrator",
  "@types/bun",
  "@types/react",
  "tailwindcss",
  "@tailwindcss/node",
  "@tailwindcss/oxide",
  "tw-animate-css",
  "shadcn",
];

function packageDir(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

rmSync(out, { recursive: true, force: true });
const seen = new Map<string, string>();
const queue: [string, string][] = ROOTS.map((n) => [n, root]);
while (queue.length > 0) {
  const [name, from] = queue.shift() ?? ["", root];
  if (seen.has(name)) continue;
  const dir = packageDir(name, from);
  if (!dir) {
    if (ROOTS.includes(name)) throw new Error(`toolchain package ${name} is not installed`);
    continue;
  }
  seen.set(name, dir);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]) {
    queue.push([dep, dir]);
  }
}
for (const [name, dir] of seen) {
  const target = join(out, "node_modules", name);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(dir, target, { recursive: true, dereference: true, filter: (src) => !src.includes(`${dir}/node_modules`) });
}
console.log(`toolchain: ${seen.size} packages in ${out}`);
```
Les dépendances optionnelles couvrent le binaire natif de `@tailwindcss/oxide` de la plateforme courante (le paquet d'une autre plateforme n'est pas installé, donc ignoré) ; `.gitignore` gagne `apps/desktop/src-tauri/toolchain/`. `apps/desktop/package.json` : le script `build:debug` (et `build`) exécute `bun scripts/build-toolchain.ts` avant `tauri build`.

`apps/desktop/src-tauri/tauri.conf.json`, `bundle.resources` :
```json
    "resources": { "../../../packages/ui/dist/": "ui/", "toolchain/": "toolchain/" }
```
`apps/desktop/src-tauri/src/main.rs` : à côté de `ui_dir`, `let toolchain_dir = resource_dir.join("toolchain");` et `.args(["--port", "0", "--ui", &ui_dir.to_string_lossy(), "--toolchain", &toolchain_dir.to_string_lossy()])` ; le test Rust existant qui vérifie les arguments du sidecar (s'il existe) est mis à jour en conséquence.

- [ ] **Step 3: `installCli`**

`packages/daemon/src/components/install-cli.test.ts` :
```ts
import { expect, test } from "bun:test";
import { lstatSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCli } from "./install-cli";

test("links ~/.local/bin/kibo to the compiled binary, idempotently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const exe = join(dir, "kibo-daemon");
  writeFileSync(exe, "");
  const binDir = join(dir, "bin");
  expect(await installCli({ execPath: exe, binDir, compiled: true })).toEqual({ path: join(binDir, "kibo") });
  expect(await installCli({ execPath: exe, binDir, compiled: true })).toEqual({ path: join(binDir, "kibo") });
  expect(lstatSync(join(binDir, "kibo")).isSymbolicLink()).toBe(true);
  expect(readlinkSync(join(binDir, "kibo"))).toBe(exe);
  await expect(installCli({ execPath: exe, binDir, compiled: false })).rejects.toThrow("INVALID_INPUT");
  rmSync(join(binDir, "kibo"));
  writeFileSync(join(binDir, "kibo"), "not ours");
  await expect(installCli({ execPath: exe, binDir, compiled: true })).rejects.toThrow("CONFLICT");
  rmSync(dir, { recursive: true, force: true });
});
```

`packages/daemon/src/components/install-cli.ts` :
```ts
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

export async function installCli(opts: { execPath?: string; binDir?: string; compiled?: boolean } = {}): Promise<{ path: string }> {
  if (!(opts.compiled ?? isCompiled())) throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
  const execPath = opts.execPath ?? process.execPath;
  const binDir = opts.binDir ?? join(homedir(), ".local", "bin");
  const path = join(binDir, "kibo");
  await mkdir(binDir, { recursive: true });
  const existing = await lstat(path).catch((e: unknown) => {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  });
  if (existing) {
    if (!existing.isSymbolicLink()) throw new KiboError("CONFLICT", `${path} exists and is not a Kibo link`);
    if ((await readlink(path)) === execPath) return { path };
    await rm(path);
  }
  await symlink(execPath, path);
  return { path };
}
```
Un lien symbolique existant vers un ancien binaire Kibo est remplacé ; un fichier réel n'est jamais écrasé. `packages/daemon/src/main.ts` passe `installCli: () => installCli()` à `startDaemon`.

- [ ] **Step 4: Écran D8**

`packages/ui/src/settings/cli-install.test.tsx` :
```tsx
import { expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let answer: () => Promise<unknown> = async () => ({ path: "/Users/adam/.local/bin/kibo" });
mock.module("../api", () => ({ client: { rpc: (_: RpcRequest) => answer(), subscribe: () => () => undefined } }));
const { CliInstallCard } = await import("./CliInstallCard");

test("D8: install the kibo command, or explain why not", async () => {
  render(<CliInstallCard />);
  const user = userEvent.setup();
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Installer la commande kibo" }));
  expect(await screen.findByText("Installée : ~/.local/bin/kibo")).toBeTruthy();
  answer = async () => {
    throw new KiboError("INVALID_INPUT", "dev");
  };
  await user.click(screen.getByRole("button", { name: "Installer la commande kibo" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'installer la commande.");
});
```

`packages/ui/src/settings/CliInstallCard.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { SquareTerminal } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";

export function CliInstallCard() {
  const c = fr.cli;
  const [path, setPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const install = async () => {
    setFailed(false);
    try {
      setPath((await client.rpc({ method: "installCli" })).path);
    } catch (e) {
      if (!(e instanceof KiboError)) console.error(e);
      setFailed(true);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SquareTerminal aria-hidden className="size-4" />
          {c.title}
        </CardTitle>
        <CardDescription>{c.help}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" className="w-fit" onClick={() => void install()}>
          {c.install}
        </Button>
        {path && <p className="font-mono text-xs text-muted-foreground">{c.installed(abbreviateHome(path))}</p>}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {c.failed}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```
L'affichage remplace le dossier personnel par `~` (`abbreviateHome`, déjà utilisé par l'UI).

- [ ] **Step 5: Placer la carte**

Si l'écran Paramètres › Général existe (phase 2 ou 3 : `grep -rn "Paramètres" packages/ui/src`), y ajouter `<CliInstallCard />` sous les réglages existants. Sinon, l'ajouter en bas de la page Composants (`ComponentsPage`, après les brouillons) et signaler l'écart au jalon (D8 prévoit Paramètres › Général).

- [ ] **Step 6: CI et fumée de la CLI compilée**

`apps/desktop/scripts/cli-smoke.ts` :
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "kibo-cli-smoke-"));
const bin = join(work, "kibo-daemon");
const toolchain = join(work, "toolchain");
const home = join(work, "home");
const run = (cmd: string[], env: Record<string, string> = {}) => {
  const p = Bun.spawnSync(cmd, { env: { ...process.env, KIBO_HOME: home, KIBO_TOOLCHAIN: toolchain, ...env }, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) throw new Error(`${cmd.join(" ")} exited with ${p.exitCode}`);
};
try {
  run(["bun", join(root, "apps/desktop/scripts/build-sidecar.ts"), "--out", bin]);
  run(["bun", join(root, "apps/desktop/scripts/build-toolchain.ts"), "--out", toolchain]);
  run([bin, "component", "new", "smoke", "--kind", "widget"]);
  run([bin, "component", "test", "smoke"]);
  const daemon = Bun.spawn([bin, "--port", "0", "--toolchain", toolchain], { env: { ...process.env, KIBO_HOME: home }, stdout: "pipe", stderr: "inherit" });
  const reader = daemon.stdout.getReader();
  let seen = "";
  while (!seen.includes("KIBO_READY")) {
    const { value, done } = await reader.read();
    if (done) throw new Error("daemon exited before KIBO_READY");
    seen += new TextDecoder().decode(value);
  }
  run([bin, "component", "publish", "smoke"]);
  daemon.kill();
  await daemon.exited;
  console.log("cli smoke: ok");
} finally {
  rmSync(work, { recursive: true, force: true });
}
```
`.github/workflows/ci.yml`, job `test`, après `bun test packages components` :
```yaml
      - run: bun apps/desktop/scripts/cli-smoke.ts
```
La fumée prouve le critère de sortie « new → test → publish avec le binaire compilé » sur macOS et Linux (`BUN_BE_BUN`, préchargements, Tailwind et TypeScript chargés depuis la toolchain, `component-runtime`).

- [ ] **Step 7: Vérifier et committer**

Run: `bun test packages components && bun run typecheck && bun run check && bun apps/desktop/scripts/cli-smoke.ts && bun run --cwd apps/desktop build:debug`
Expected: PASS ; `cli smoke: ok`.

```bash
git add apps/desktop/sidecar apps/desktop/scripts apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/src/main.rs apps/desktop/package.json packages/daemon/src/components/install-cli.ts packages/daemon/src/components/install-cli.test.ts packages/daemon/src/main.ts packages/ui/src/settings .github/workflows/ci.yml .gitignore
git commit -m "build(desktop): binaire, toolchain et CLI"
```

---

### Task 35: UI chargée à la demande et budget du bundle d'entrée

Écart de v0.3 : le chunk d'entrée de l'UI fait 1,47 Mo (485 kB gzip, mesuré le 2026-09-26 sur `main` après la tâche 29). En cause, surtout : CodeMirror, Lezer et markdown-it tirés statiquement par la vue Notes (`registry.ts` → `@kibo/component-notes` → `NotesView` → `NoteDocument` → `MarkdownEditor` et `markdown.ts`), puis les écrans secondaires. Mesure faite en excluant ces modules : ~218 kB gzip. Décision 29.

**Files:**
- Create: `packages/sdk/src/lazy.tsx`, `packages/sdk/src/lazy.test.tsx`, `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/scripts/bundle-report.ts`, `packages/ui/scripts/bundle-report.test.ts`, `packages/ui/scripts/bundle-budget.ts`, `packages/ui/scripts/tsconfig.json`
- Modify: `packages/sdk/src/index.ts`, `packages/sdk/src/conformance.tsx` (attendre la fin du repli), `packages/ui/src/shell/ContentView.tsx`, `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/shell/ShellDialogs.tsx`, `packages/ui/src/i18n/fr.ts` (`lazy`), `components/notes/src/index.ts`, `components/notes/src/fr.ts`, `components/graph/src/index.ts`, `components/graph/src/fr.ts`, `package.json` (scripts `budget` et `typecheck`), tests existants qui rendent un écran devenu différé (`packages/ui/src/shell/screens.test.tsx`, `agents-shell.test.tsx`, `shell.test.tsx`, `components/notes/src/notes.test.tsx`, `components/graph/src/graph.test.tsx` : `getBy*` → `await findBy*`, comportement inchangé)

**Interfaces:**
- Consumes: `Button` (`packages/sdk/src/ui/button.tsx`) ; build Vite de `packages/ui` (`vite.config.ts` inchangé) ; `runConformance` (tâche 12).
- Produces:
  - `type LazyLabels = { loading: string; failed: string; retry: string }` ; `LAZY_FALLBACK_SELECTOR = "[data-kibo-loading]"`.
  - `lazyPanel<P extends object>(load: () => Promise<ComponentType<P>>, labels: LazyLabels, opts?: { fallback?: "visible" | "sr-only" }): ComponentType<P>` : repli `role="status"` (attribut `data-kibo-loading`) pendant le chargement ; échec du chargement ⇒ `role="alert"` avec `labels.failed` et un bouton `labels.retry` qui relance `load` ; l'erreur d'origine est journalisée (`console.error`) ; une erreur de **rendu** du module chargé n'est pas prise pour un échec de chargement : elle remonte à la frontière d'erreur parente.
  - `packages/ui/src/shell/lazy-screens.ts` : `AgentsPage`, `QueuePage`, `DomainsPage`, `ComponentsPage`, `ChangesView`, `FileTabView`, `FilePreviewSheet` (mêmes props que les modules d'origine).
  - `type BuiltChunk = { fileName: string; isEntry: boolean; imports: string[]; code: string; moduleIds: string[] }` ; `type EntryReport = { files: string[]; gzipBytes: number; budget: number; forbidden: { file: string; module: string }[]; ok: boolean }` ; `initialChunks(chunks): BuiltChunk[]` ; `reportEntry(chunks, opts?: { budget: number; forbidden: readonly RegExp[]; gzip(bytes: Uint8Array): number }): EntryReport` ; `ENTRY_GZIP_BUDGET = 230_000` ; `FORBIDDEN_IN_ENTRY: readonly RegExp[]` ; `gzipLevel9(bytes): number`.
  - Script racine `bun run budget` : build Vite réel en mémoire, affiche les fichiers initiaux et leur taille gzip, code de sortie 1 si le budget est dépassé ou si un module interdit est dans l'entrée.

- [ ] **Step 1: Tests du panneau différé**

`packages/sdk/src/lazy.test.tsx` :
```tsx
import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { LAZY_FALLBACK_SELECTOR, lazyPanel } from "./lazy";

const labels = { loading: "Chargement…", failed: "Impossible de charger cet écran.", retry: "Réessayer" };
const Hello = ({ name }: { name: string }) => <p>Bonjour {name}</p>;

function silenced<T>(run: (errors: unknown[]) => Promise<T>): Promise<T> {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args[0]);
  };
  return run(errors).finally(() => {
    console.error = original;
  });
}

class Outer extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? <p>outer: {this.state.error}</p> : this.props.children;
  }
}

describe("lazyPanel", () => {
  test("shows the fallback, then the loaded component with its props", async () => {
    let resolve: (c: typeof Hello) => void = () => {};
    const Panel = lazyPanel(() => new Promise<typeof Hello>((r) => { resolve = r; }), labels);
    const { container } = render(<Panel name="Adam" />);
    expect(screen.getByRole("status").textContent).toBe("Chargement…");
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).not.toBeNull();
    await act(async () => resolve(Hello));
    expect(await screen.findByText("Bonjour Adam")).toBeTruthy();
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull();
  });

  test("a failed load shows an alert, logs the cause, and retry loads again", () =>
    silenced(async (errors) => {
      let calls = 0;
      const Panel = lazyPanel(async () => {
        calls += 1;
        if (calls === 1) throw new Error("chunk missing");
        return Hello;
      }, labels);
      render(<Panel name="Adam" />);
      expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger cet écran.");
      expect(errors.some((e) => e instanceof Error && e.message === "chunk missing")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      expect(await screen.findByText("Bonjour Adam")).toBeTruthy();
      expect(calls).toBe(2);
    }));

  test("a render error of the loaded module reaches the parent boundary", () =>
    silenced(async () => {
      const Broken = (): ReactNode => {
        throw new Error("boom");
      };
      const Panel = lazyPanel(async () => Broken, labels);
      render(
        <Outer>
          <Panel />
        </Outer>,
      );
      expect(await screen.findByText("outer: boom")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    }));

  test("the sr-only fallback stays out of the layout", () => {
    const Panel = lazyPanel(() => new Promise<typeof Hello>(() => {}), labels, { fallback: "sr-only" });
    render(<Panel name="Adam" />);
    expect(screen.getByRole("status").className).toContain("sr-only");
  });
});
```

Run: `bun test packages/sdk/src/lazy.test.tsx`
Expected: FAIL (`./lazy` absent).

- [ ] **Step 2: Implémenter `lazyPanel`**

`packages/sdk/src/lazy.tsx` :
```tsx
import { Component, type ComponentType, lazy, type ReactNode, Suspense, useState } from "react";
import { cn } from "./lib/utils";
import { Button } from "./ui/button";

export type LazyLabels = { loading: string; failed: string; retry: string };
export type LazyOptions = { fallback?: "visible" | "sr-only" };

export const LAZY_FALLBACK_SELECTOR = "[data-kibo-loading]";

class LazyLoadError extends Error {
  constructor(readonly original: unknown) {
    super("lazy module failed to load");
  }
}

type BoundaryProps = { labels: LazyLabels; onRetry(): void; children: ReactNode };

class LoadBoundary extends Component<BoundaryProps, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (error instanceof LazyLoadError) console.error(error.original);
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (!(error instanceof LazyLoadError)) throw error;
    return (
      <div role="alert" className="flex items-center gap-3 p-4 text-sm text-destructive">
        <span>{this.props.labels.failed}</span>
        <Button variant="outline" size="sm" onClick={this.props.onRetry}>
          {this.props.labels.retry}
        </Button>
      </div>
    );
  }
}

function Loading({ label, srOnly }: { label: string; srOnly: boolean }) {
  return (
    <div role="status" data-kibo-loading="" className={cn("p-4 text-sm text-muted-foreground", srOnly && "sr-only")}>
      {label}
    </div>
  );
}

export function lazyPanel<P extends object>(
  load: () => Promise<ComponentType<P>>,
  labels: LazyLabels,
  opts: LazyOptions = {},
): ComponentType<P> {
  const create = () =>
    lazy(() =>
      load().then(
        (Loaded) => ({ default: Loaded }),
        (e: unknown) => {
          throw new LazyLoadError(e);
        },
      ),
    );
  let Loaded = create();
  function LazyPanel(props: P) {
    const [attempt, setAttempt] = useState(0);
    const retry = () => {
      Loaded = create();
      setAttempt((n) => n + 1);
    };
    return (
      <LoadBoundary key={attempt} labels={labels} onRetry={retry}>
        <Suspense fallback={<Loading label={labels.loading} srOnly={opts.fallback === "sr-only"} />}>
          <Loaded {...props} />
        </Suspense>
      </LoadBoundary>
    );
  }
  return LazyPanel;
}
```
Si le compilateur refuse `<Loaded {...props} />` pour un `P` générique (`IntrinsicAttributes`), écrire `createElement(Loaded, props)` ; aucun `as`. Le `throw error` du rendu est voulu : une erreur de rendu du module n'est pas un échec de chargement et doit atteindre la frontière parente (test 3).

`packages/sdk/src/index.ts` : ajouter `export * from "./lazy";`.

Run: `bun test packages/sdk/src/lazy.test.tsx`
Expected: PASS.

- [ ] **Step 3: Tests du rapport de budget**

`packages/ui/scripts/bundle-report.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { type BuiltChunk, FORBIDDEN_IN_ENTRY, initialChunks, reportEntry } from "./bundle-report";

const chunk = (fileName: string, over: Partial<BuiltChunk> = {}): BuiltChunk => ({
  fileName,
  isEntry: false,
  imports: [],
  code: "x",
  moduleIds: [],
  ...over,
});
const rawSize = (bytes: Uint8Array) => bytes.length;
const pkg = (name: string, file: string) => `/r/node_modules/.bun/${name.replace("/", "+")}@1.0.0/node_modules/${name}/${file}`;

describe("bundle report", () => {
  test("initial chunks are the entry and its static imports, transitively, never dynamic ones", () => {
    const chunks = [
      chunk("index.js", { isEntry: true, imports: ["react.js"] }),
      chunk("react.js", { imports: ["scheduler.js", "index.js"] }),
      chunk("scheduler.js"),
      chunk("NotesView.js"),
    ];
    expect(initialChunks(chunks).map((c) => c.fileName)).toEqual(["index.js", "react.js", "scheduler.js"]);
  });

  test("sums the gzip size of initial chunks against the budget", () => {
    const chunks = [
      chunk("index.js", { isEntry: true, imports: ["a.js"], code: "1234" }),
      chunk("a.js", { code: "56" }),
      chunk("lazy.js", { code: "7".repeat(100) }),
    ];
    expect(reportEntry(chunks, { budget: 6, forbidden: [], gzip: rawSize })).toMatchObject({ gzipBytes: 6, ok: true });
    expect(reportEntry(chunks, { budget: 5, forbidden: [], gzip: rawSize }).ok).toBe(false);
  });

  test("a forbidden module in an initial chunk fails, even under budget", () => {
    const md = pkg("markdown-it", "index.mjs");
    const chunks = [
      chunk("index.js", { isEntry: true, moduleIds: [md] }),
      chunk("lazy.js", { moduleIds: [pkg("@codemirror/view", "dist/index.js")] }),
    ];
    const report = reportEntry(chunks, { budget: 1_000_000, forbidden: FORBIDDEN_IN_ENTRY, gzip: rawSize });
    expect(report.ok).toBe(false);
    expect(report.forbidden).toEqual([{ file: "index.js", module: md }]);
  });

  test("default rules forbid heavy editors and secondary screens, not widgets", () => {
    const forbidden = [
      pkg("@codemirror/view", "dist/index.js"),
      pkg("@lezer/markdown", "dist/index.js"),
      pkg("codemirror", "dist/index.js"),
      pkg("markdown-it", "index.mjs"),
      pkg("shiki", "dist/index.mjs"),
      pkg("@shikijs/langs", "dist/tsx.mjs"),
      "/Kibo/packages/ui/src/agents/AgentsPage.tsx",
      "/Kibo/packages/ui/src/agents/QueuePage.tsx",
      "/Kibo/packages/ui/src/settings/DomainsPage.tsx",
      "/Kibo/packages/ui/src/components-page/ComponentsPage.tsx",
      "/Kibo/packages/ui/src/code/ChangesView.tsx",
      "/Kibo/packages/ui/src/files/FileTabView.tsx",
      "/Kibo/packages/ui/src/files/FilePreviewSheet.tsx",
      "/Kibo/components/graph/src/GraphView.tsx",
      "/Kibo/components/notes/src/NotesView.tsx",
    ];
    for (const id of forbidden) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(true);
    for (const id of ["/Kibo/components/notes/src/NotesWidget.tsx", "/Kibo/components/graph/src/GraphWidget.tsx", "/Kibo/packages/ui/src/agents/AgentPanel.tsx"])
      expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(id))).toBe(false);
  });
});
```

Run: `bun test packages/ui/scripts/bundle-report.test.ts`
Expected: FAIL (`./bundle-report` absent).

- [ ] **Step 4: Implémenter le rapport et le script**

`packages/ui/scripts/bundle-report.ts` :
```ts
export type BuiltChunk = { fileName: string; isEntry: boolean; imports: string[]; code: string; moduleIds: string[] };
export type EntryReport = {
  files: string[];
  gzipBytes: number;
  budget: number;
  forbidden: { file: string; module: string }[];
  ok: boolean;
};
export type ReportOptions = { budget: number; forbidden: readonly RegExp[]; gzip(bytes: Uint8Array): number };

export const ENTRY_GZIP_BUDGET = 230_000;

export const FORBIDDEN_IN_ENTRY: readonly RegExp[] = [
  /\/node_modules\/(@codemirror|@lezer|@shikijs)\//,
  /\/node_modules\/(codemirror|markdown-it|shiki)\//,
  /\/packages\/ui\/src\/(agents\/(AgentsPage|QueuePage)|settings\/DomainsPage|components-page\/ComponentsPage|code\/ChangesView|files\/(FileTabView|FilePreviewSheet))\.tsx$/,
  /\/components\/(graph\/src\/GraphView|notes\/src\/NotesView)\.tsx$/,
];

export const gzipLevel9 = (bytes: Uint8Array): number => Bun.gzipSync(bytes, { level: 9 }).length;

export function initialChunks(chunks: readonly BuiltChunk[]): BuiltChunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Map<string, BuiltChunk>();
  const visit = (c: BuiltChunk) => {
    if (seen.has(c.fileName)) return;
    seen.set(c.fileName, c);
    for (const name of c.imports) {
      const next = byName.get(name);
      if (!next) throw new Error(`unknown chunk ${name}`);
      visit(next);
    }
  };
  for (const c of chunks) if (c.isEntry) visit(c);
  return [...seen.values()];
}

const DEFAULTS: ReportOptions = { budget: ENTRY_GZIP_BUDGET, forbidden: FORBIDDEN_IN_ENTRY, gzip: gzipLevel9 };

export function reportEntry(chunks: readonly BuiltChunk[], opts: ReportOptions = DEFAULTS): EntryReport {
  const initial = initialChunks(chunks);
  const encoder = new TextEncoder();
  const gzipBytes = initial.reduce((n, c) => n + opts.gzip(encoder.encode(c.code)), 0);
  const forbidden = initial.flatMap((c) =>
    c.moduleIds.filter((id) => opts.forbidden.some((r) => r.test(id))).map((module) => ({ file: c.fileName, module })),
  );
  return {
    files: initial.map((c) => c.fileName),
    gzipBytes,
    budget: opts.budget,
    forbidden,
    ok: gzipBytes <= opts.budget && forbidden.length === 0,
  };
}
```

`packages/ui/scripts/bundle-budget.ts` :
```ts
import { resolve } from "node:path";
import { build, type Rollup } from "vite";
import { type BuiltChunk, reportEntry } from "./bundle-report";

const root = resolve(import.meta.dir, "..");
const result = await build({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "warn", build: { write: false } });
const outputs: Rollup.RollupOutput[] = Array.isArray(result) ? result : "output" in result ? [result] : [];
if (outputs.length === 0) throw new Error("vite build returned a watcher");
const chunks: BuiltChunk[] = outputs.flatMap((o) =>
  o.output.flatMap((c) =>
    c.type === "chunk"
      ? [{ fileName: c.fileName, isEntry: c.isEntry, imports: c.imports, code: c.code, moduleIds: Object.keys(c.modules) }]
      : [],
  ),
);
const report = reportEntry(chunks);
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
console.log(`Chargement initial : ${report.files.join(", ")}`);
console.log(`gzip : ${kb(report.gzipBytes)} (budget ${kb(report.budget)})`);
for (const f of report.forbidden) console.error(`Module interdit au chargement initial : ${f.module} (${f.file})`);
if (!report.ok) process.exit(1);
```
L'API `build` de Vite tourne sous Bun (sonde du 2026-09-26 : 1,7 s, mêmes chunks que `vite build`). Les messages du script sont en français (sortie affichée).

`packages/ui/scripts/tsconfig.json` :
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "outDir": "../dist-types/scripts", "rootDir": ".", "lib": ["ES2022"] },
  "include": ["."]
}
```
`package.json` racine : `"budget": "bun packages/ui/scripts/bundle-budget.ts"` ; ajouter `packages/ui/scripts` au script `typecheck` (après `packages/ui`).

Run: `bun test packages/ui/scripts && bun run budget`
Expected: tests PASS ; `bun run budget` **FAIL** (≈ 485 kB et modules interdits listés : `@codemirror/*`, `@lezer/*`, `markdown-it`, `NotesView`, `GraphView`, `AgentsPage`…). C'est l'état de départ.

- [ ] **Step 5: Différer les écrans de l'UI**

`packages/ui/src/i18n/fr.ts` : `lazy: { loading: "Chargement…", failed: "Impossible de charger cet écran.", retry: "Réessayer" }`.

`packages/ui/src/shell/lazy-screens.ts` :
```ts
import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const AgentsPage = lazyPanel(() => import("../agents/AgentsPage").then((m) => m.AgentsPage), fr.lazy);
export const QueuePage = lazyPanel(() => import("../agents/QueuePage").then((m) => m.QueuePage), fr.lazy);
export const DomainsPage = lazyPanel(() => import("../settings/DomainsPage").then((m) => m.DomainsPage), fr.lazy);
export const ComponentsPage = lazyPanel(
  () => import("../components-page/ComponentsPage").then((m) => m.ComponentsPage),
  fr.lazy,
);
export const ChangesView = lazyPanel(() => import("../code/ChangesView").then((m) => m.ChangesView), fr.lazy);
export const FileTabView = lazyPanel(() => import("../files/FileTabView").then((m) => m.FileTabView), fr.lazy);
export const FilePreviewSheet = lazyPanel(
  () => import("../files/FilePreviewSheet").then((m) => m.FilePreviewSheet),
  fr.lazy,
  { fallback: "sr-only" },
);
```
- `ScreenView.tsx` : importer `AgentsPage`, `QueuePage`, `ComponentsPage`, `DomainsPage` depuis `./lazy-screens` (aucun autre changement).
- `ContentView.tsx` : retirer `lazy`, `Suspense` et les deux `lazy(...)` locaux ; importer `ChangesView` et `FileTabView` depuis `./lazy-screens` ; supprimer les `<Suspense fallback={null}>` qui les entourent.
- `ShellDialogs.tsx` : même chose pour `FilePreviewSheet` (le repli `sr-only` ne décale pas la mise en page pendant l'ouverture de l'aperçu).
- Vérifier par `grep -rn 'from "\.\./agents/AgentsPage"\|from "\.\./agents/QueuePage"\|from "\.\./settings/DomainsPage"\|from "\.\./components-page/ComponentsPage"\|from "\.\./code/ChangesView"\|from "\.\./files/FileTabView"\|from "\.\./files/FilePreviewSheet"' packages/ui/src` qu'aucun fichier hors tests n'importe plus ces modules statiquement (le script de l'étape 7 le vérifie aussi).

Les tests de l'UI qui rendent ces écrans passent de `getBy*` à `await findBy*` (le premier rendu montre le repli) ; aucun autre changement.

- [ ] **Step 6: Différer les vues Notes et Graphe**

`components/notes/src/fr.ts` : `lazy: { loading: "Chargement des notes…", failed: "Impossible de charger les notes.", retry: "Réessayer" }` ; `components/graph/src/fr.ts` : `lazy: { loading: "Chargement du graphe…", failed: "Impossible de charger le graphe.", retry: "Réessayer" }`.

`components/notes/src/index.ts` :
```ts
import { ComponentManifest } from "@kibo/schema";
import { lazyPanel, useSdk } from "@kibo/sdk";
import { createElement } from "react";
import manifestJson from "../kibo.component.json";
import { fr } from "./fr";
import { NotesWidget } from "./NotesWidget";

export const manifest = ComponentManifest.parse(manifestJson);

const NotesView = lazyPanel(() => import("./NotesView").then((m) => m.NotesView), fr.lazy);

export function Component() {
  const sdk = useSdk();
  return createElement(sdk.surface === "view" ? NotesView : NotesWidget);
}
```
`components/graph/src/index.ts` : même forme avec `GraphView` (`import("./GraphView")`) et `GraphWidget` statique. Le widget du graphe (`critical-path`, `filter`) et celui des notes restent dans l'entrée : ils sont légers et s'affichent sur le tableau de bord.

`lazyPanel` vient du SDK public (règle de dogfooding : aucun accès privilégié).

`packages/sdk/src/conformance.tsx`, dans le test de rendu, après l'attente `container.childElementCount > 0` :
```ts
await waitFor(() => expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull());
```
(import de `LAZY_FALLBACK_SELECTOR` depuis `./lazy`) : sans cela, la conformité d'une vue différée ne vérifierait que le repli.

Run: `bun test packages components`
Expected: PASS (tests d'écrans adaptés en `findBy*`).

- [ ] **Step 7: Mesurer et vérifier le budget**

Run: `bun run budget`
Expected: PASS ; chargement initial ≤ 230 kB gzip (estimation ~218 kB), aucun module interdit. Reporter la valeur mesurée dans la décision 29 (« mesure après la tâche 35 : n kB »). Si le budget n'est pas tenu alors que tous les modules listés sont différés, **ne pas relever le seuil** : chercher la dépendance restante (`bun run budget` liste les fichiers initiaux ; un `console.log` temporaire des `moduleIds` du plus gros chunk suffit) et, faute de piste, remonter au `kibo-lead`.

Vérifier aussi à la main, dans l'app (`bun run start`), sombre puis clair : ouvrir Agents, Files d'attente, Paramètres, Composants, Changements, un aperçu de fichier, la vue Notes et la vue Graphe ; le repli « Chargement… » est bref et chaque écran s'affiche. Couper le démon puis ouvrir un écran jamais chargé : l'alerte « Impossible de charger cet écran. » et « Réessayer » apparaissent ; relancer le démon, « Réessayer » affiche l'écran.

- [ ] **Step 8: Vérifier et committer**

Run: `bun test packages components && bun run typecheck && bun run check && bun run budget && bun run --cwd packages/ui build`
Expected: PASS ; Vite n'affiche plus l'avertissement « Some chunks are larger than 500 kB ».

```bash
git add packages/sdk/src/lazy.tsx packages/sdk/src/lazy.test.tsx packages/sdk/src/index.ts packages/sdk/src/conformance.tsx
git commit -m "feat(sdk): panneau chargé à la demande"
git add packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ContentView.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/i18n/fr.ts components/notes/src/index.ts components/notes/src/fr.ts components/graph/src/index.ts components/graph/src/fr.ts
git add <tests d'écrans adaptés, listés un par un>
git commit -m "feat(ui): écrans chargés à la demande"
git add packages/ui/scripts package.json
git commit -m "build(ui): budget du chargement initial"
```

---

### Task 36: Densité 13 px (UI et composants intégrés)

Écart de v0.3 : le texte courant est en 14 px, les maquettes en 13 px. Les PDF sont exportés à 0,75 pt par pixel : 9,75 pt = 13 px. Échelle relevée sur toutes les pages (sombre, histogramme des tailles) : 10 px (1 018 occurrences : libellés de section « PROJETS », badges de domaine, méta des cartes), 11 px (2 712 : clés de ticket, compteurs, « Workspace local », avatar), 12 px (2 135 : onglets, barres d'outils, « Rechercher… », en-têtes de colonne), 13 px (2 285 : texte courant, navigation, titres de ligne), 14 px (109 : titres de panneau), 16, 17, 18, 20 px (titres des Paramètres), 22 px (« Bonjour Adam », chiffres des statistiques), 26 px (titre d'une note), 28 px (premier lancement). Décision 30.

**Files:**
- Create: `packages/sdk/src/theme.test.ts`
- Modify: `packages/sdk/src/theme.css` (tokens, `body`), `packages/sdk/src/ui/sidebar.tsx` (`SidebarGroupLabel` 10 px, `SidebarMenuBadge` 11 px), puis les fichiers dont une taille diverge de la maquette après le changement de tokens, repérés à l'étape 3 dans `packages/ui/src/**`, `packages/sdk/src/{ui,*.tsx}`, `components/{kanban,tickets,graph,notes}/src/*.tsx` (classes seulement), `e2e/screens.spec.ts` (test de densité)

**Interfaces:**
- Consumes: `theme.css` du SDK, importé par `packages/ui/src/index.css` et par le build des composants (tâche 6) : un seul endroit pour l'UI, les intégrés et les composants tiers.
- Produces: tokens Tailwind `text-sm` = 13 px / 20 px, `text-2xs` = 11 px / 16 px, `text-3xs` = 10 px / 14 px, `text-md` = 14 px / 20 px, `text-2xl` = 22 px / 28 px ; `body` en 13 px ; `text-xs` (12), `text-base` (16), `text-lg` (18), `text-xl` (20) inchangés.

Correspondance maquette → classe (à appliquer pendant la revue écran par écran) :

| Maquette | Classe | Exemples |
|---|---|---|
| 10 px | `text-3xs` | libellés de section en capitales (« PROJETS », « INDEXÉS », « NIVEAUX »), badges de domaine, méta sous une carte (`opus-dev · En file #2`) |
| 11 px | `text-2xs` | clés `KIB-12` (mono), compteurs de la barre latérale, `3/5`, « Workspace local », horodatages, avatar |
| 12 px | `text-xs` | libellés d'onglet, boutons de barre d'outils, en-têtes de colonne Kanban, champ « Rechercher… » |
| 13 px | `text-sm` | navigation, titres de ligne et de carte, boutons, champs, texte courant |
| 14 px | `text-md` | titres de panneau (barre Agents, cartes de la Vue d'ensemble) |
| 20 px | `text-xl` | titres des Paramètres |
| 22 px | `text-2xl` | « Bonjour Adam », chiffres des statistiques (écran 13) |

- [ ] **Step 1: Test des tokens**

`packages/sdk/src/theme.test.ts` :
```ts
import { expect, test } from "bun:test";

const css = await Bun.file(new URL("./theme.css", import.meta.url)).text();

test("density tokens follow the 13 px mockups", () => {
  const expected: [string, string][] = [
    ["--text-sm", "0.8125rem"],
    ["--text-sm--line-height", "1.25rem"],
    ["--text-2xs", "0.6875rem"],
    ["--text-2xs--line-height", "1rem"],
    ["--text-3xs", "0.625rem"],
    ["--text-3xs--line-height", "0.875rem"],
    ["--text-md", "0.875rem"],
    ["--text-md--line-height", "1.25rem"],
    ["--text-2xl", "1.375rem"],
    ["--text-2xl--line-height", "1.75rem"],
  ];
  for (const [token, value] of expected) expect(css).toContain(`${token}: ${value};`);
});
```

Run: `bun test packages/sdk/src/theme.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tokens**

`packages/sdk/src/theme.css`, nouveau bloc après le premier `@theme inline` :
```css
@theme {
  --text-3xs: 0.625rem;
  --text-3xs--line-height: 0.875rem;
  --text-2xs: 0.6875rem;
  --text-2xs--line-height: 1rem;
  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.25rem;
  --text-md: 0.875rem;
  --text-md--line-height: 1.25rem;
  --text-2xl: 1.375rem;
  --text-2xl--line-height: 1.75rem;
}
```
et dans `@layer base`, `body { @apply bg-background text-foreground text-sm; }`. Les hauteurs de ligne gardent 20 px pour `text-sm` : les hauteurs de ligne des listes (`h-8`) ne bougent pas, seul le corps du texte change ; l'étape 3 ajuste ce qui diverge.

Vérifier que Tailwind prend bien la valeur redéfinie (le `@theme` du SDK est lu après `@import "tailwindcss"`) : `bun run --cwd packages/ui build` puis `grep -o "\.text-sm{[^}]*}" packages/ui/dist/assets/*.css` ⇒ `font-size:var(--text-sm)` et `--text-sm:.8125rem` dans `:root`.

Run: `bun test packages/sdk/src/theme.test.ts`
Expected: PASS.

- [ ] **Step 3: Revue écran par écran (sombre puis clair)**

Lancer l'app avec le jeu fictif (`bun run start`, projet de démonstration comme au jalon) à 1440 × 940, et comparer côte à côte avec les deux PDF, **sombre puis clair** : écran 1 (page 5), 7 (13), 8 (8), 9 (15), 10 (16), 11 (17), 13 (23), 14 (24), 17 (27), 21 (34), 3 (7), 6 (10), 30 (12). Pour chaque texte qui diverge, appliquer la classe du tableau ci-dessus. Primitives d'abord (`packages/sdk/src/ui/sidebar.tsx` : `SidebarGroupLabel` → `text-3xs font-medium uppercase tracking-wide`, `SidebarMenuBadge` → `text-2xs` ; `badge.tsx` inchangé, les badges de domaine passent `className="text-3xs"`), puis écrans. Inventaire de départ : `grep -rn "text-\(xs\|sm\|base\|lg\|xl\|2xl\)\|text-\[" packages/ui/src packages/sdk/src components/*/src --include=*.tsx` (≈ 182 `text-sm`, 142 `text-xs`, 12 autres).

Kanban et Tickets : seules des classes changent (aucune logique), pour que le critère du jalon « conformité v1 sans modification du code métier » reste vrai ; le rapport du jalon liste ces fichiers comme changements de présentation.

- [ ] **Step 4: Test Playwright de densité**

`e2e/screens.spec.ts` (tourne en `screens-dark` et `screens-light`), à la fin :
```ts
test("densité 13 px des maquettes", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  const doing = page.getByRole("region", { name: "En cours" });
  await expect(doing).toBeVisible();
  const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
  expect(await size(page.locator("body"))).toBe("13px");
  expect(await size(sideButton("Vue d'ensemble"))).toBe("13px");
  expect(await size(page.getByText("Projets", { exact: true }).first())).toBe("10px");
  expect(await size(doing.getByText("KIB-12", { exact: true }))).toBe("11px");
  expect(await size(bar().getByRole("tab").first())).toBe("12px");
  await capture(info, "densite-kanban");
});
```
(ajouter `type Locator` à l'import de `@playwright/test`). Si un sélecteur ne trouve pas l'élément (libellé réel différent), prendre le libellé réel sans changer la taille attendue.

Run: `bun run --cwd e2e test --project screens-dark --project screens-light`
Expected: PASS.

- [ ] **Step 5: Vérifier et committer**

Run: `bun test packages components && bun run typecheck && bun run check && bun run budget && bun run --cwd e2e test`
Expected: PASS ; `bun run budget` toujours sous 230 kB (si la tâche 35 est intégrée).

```bash
git add packages/sdk/src/theme.css packages/sdk/src/theme.test.ts
git commit -m "feat(sdk): tokens de densité 13 px"
git add packages/sdk/src/ui/sidebar.tsx <fichiers de l'étape 3, listés un par un>
git commit -m "feat(ui): densité 13 px des maquettes"
git add e2e/screens.spec.ts
git commit -m "test(e2e): tailles de texte des maquettes"
```

---

### Task 37: « Mes tickets » (écran 12) et son entrée dans la barre latérale

Écart de v0.3 (absent de la barre latérale). Écran 12, page 22 des PDF. Décision 31, point E5.

**Files:**
- Create: `packages/ui/src/mine/my-tickets.ts`, `packages/ui/src/mine/my-tickets.test.ts`, `packages/ui/src/mine/MyTicketsPage.tsx`, `packages/ui/src/mine/MyTicketRow.tsx`, `packages/ui/src/mine/my-tickets-page.test.tsx`
- Modify: `packages/schema/src/tabs.ts` (`Screen` gagne `mine`) et son test s'il énumère les écrans, `packages/ui/src/tabs/screens.ts` (`SCREENS.mine`), `packages/ui/src/tabs/target-hash.ts` et son test (si le hachage des écrans n'est pas générique), `packages/ui/src/shell/lazy-screens.ts` (`MyTicketsPage`), `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/shell/ShellDialogs.tsx` (assignation d'un ticket d'un autre projet), `packages/ui/src/shell/AppSidebar.tsx`, `packages/ui/src/shell/Breadcrumb.tsx` (titre de l'écran), `packages/ui/src/i18n/fr.ts` (`nav.mine`, `mine`), `packages/ui/src/palette/screen-items.test.ts` (nouvel écran), `packages/ui/scripts/bundle-report.ts` et son test (`mine/MyTicketsPage` interdit dans l'entrée), `e2e/screens.spec.ts`

**Interfaces:**
- Consumes: `useSnapshots` (instantanés de tous les projets, déjà chargés par `Shell`), `ProjectSnapshot`, `TicketView` (`waitingOn`), `WorkspaceConfig.domains` et `profiles`, `StatusDot`, `Badge`, `Button`, `Tooltip` (SDK), `lazyPanel` (tâche 35), `AssignDialog` (phase 2).
- Produces:
  - `type MineTab = "assigned" | "agents" | "created"` ; `type MineGroup = { project: ProjectMeta; tickets: TicketView[] }` ; `MINE_STATUS_ORDER: readonly StatusId[]` ; `isMine(t, viewer, tab): boolean` ; `compareMine(a, b): number` ; `myTickets(projects: readonly ProjectMeta[], snapshots: ReadonlyMap<string, ProjectSnapshot>, viewer: string, tab: MineTab): MineGroup[]` ; `countMine(groups): number`.
  - `MyTicketsPage(props: { viewer: string; projects: ProjectMeta[]; snapshots: ReadonlyMap<string, ProjectSnapshot>; config: WorkspaceConfig | null; onOpenTicket(projectId: string, ticketId: string): void; onAssign(projectId: string, ticketId: string): void })`.
  - `Screen` = `agents | queue | domains | components | mine` ; hachage `#/mine` (ou la forme générique existante).
  - `DialogsState.assign: { projectId: string | null; ticketId: string | null } | null` (projet `null` = projet actif, comportement actuel).
  - `AppSidebar` gagne `mineCount: number | null`.

Règles (décision 31) : « Assignés à moi » = non terminés, assigné humain égal à l'utilisateur (compteur de la barre latérale) ; « Mes agents » = non terminés, assignés à un agent ; « Créés par moi » = onglet désactivé (point E5, option A). Groupes par projet dans l'ordre de la barre latérale, projets vides masqués ; tri : Bloqué, En cours, À faire, En review, Backlog, puis ticket en attente d'un bloquant d'abord, puis ordre naturel des clés. Ligne : pastille de statut, clé (mono, 11 px), titre, badge de domaine (carré de couleur + nom, 10 px), libellé du statut (workflow du projet), puis « Assigner » (icône `Bot` + texte) si le projet a un dossier, sinon bouton icône `Bot` désactivé avec infobulle (un run exige un dossier : `workspace-prep.ts`, « the project has no local folder ») ; dans « Mes agents », la colonne d'action montre `Bot` + nom du profil. Clic sur la ligne ⇒ sheet du ticket. En-tête : segmenté « Assignés à moi · Mes agents · Créés par moi » à gauche, « 9 tickets · 3 projets » à droite.

- [ ] **Step 1: Tests du calcul**

`packages/ui/src/mine/my-tickets.test.ts` (jeu fictif, `design/donnees-fictives.md` § Mes tickets) :
```ts
import { describe, expect, test } from "bun:test";
import type { Assignee, ProjectMeta, ProjectSnapshot, StatusId, TicketView } from "@kibo/schema";
import { kiboProject } from "../agents/fixtures";
import { countMine, myTickets } from "./my-tickets";

let seq = 0;
function ticket(key: string, statusId: StatusId, assignee: Assignee | null, waitingOn: string[] = []): TicketView {
  seq += 1;
  return {
    id: `${seq}@1`,
    key,
    title: key,
    description: "",
    statusId,
    blockedReason: statusId === "blocked" ? "Audit sécurité externe en attente" : null,
    domainId: null,
    assignee,
    parentId: null,
    externalRefs: [],
    progress: { done: 0, total: 0 },
    waitingOn,
  };
}
const adam: Assignee = { kind: "human", ref: "adam" };
const agent: Assignee = { kind: "agent", ref: "opus-dev" };
const base = kiboProject();
const meta = (id: string, name: string, key: string): ProjectMeta => ({ ...base.meta, id, name, key });
const snapshot = (m: ProjectMeta, tickets: TicketView[]): ProjectSnapshot => ({ ...base, meta: m, tickets });

const kib = meta("kib", "Kibo", "KIB");
const fac = meta("fac", "API Facturation", "FAC");
const por = meta("por", "Portfolio", "POR");
const snapshots = new Map([
  [kib.id, snapshot(kib, [
    ticket("KIB-9", "todo", adam),
    ticket("KIB-22", "backlog", adam),
    ticket("KIB-11", "in_review", adam),
    ticket("KIB-15", "todo", adam, ["KIB-12"]),
    ticket("KIB-7", "in_review", adam),
    ticket("KIB-21", "blocked", adam),
    ticket("KIB-5", "done", adam),
    ticket("KIB-12", "in_progress", agent),
    ticket("KIB-3", "in_progress", null),
  ])],
  [fac.id, snapshot(fac, [ticket("FAC-34", "todo", adam), ticket("FAC-31", "in_progress", adam)])],
  [por.id, snapshot(por, [ticket("POR-9", "todo", adam)])],
]);
const keys = (tab: "assigned" | "agents" | "created") =>
  myTickets([kib, por, fac], snapshots, "adam", tab).map((g) => [g.project.key, g.tickets.map((t) => t.key)]);

describe("my tickets", () => {
  test("assigned to me: open tickets, grouped in sidebar order, mockup order within a project", () => {
    expect(keys("assigned")).toEqual([
      ["KIB", ["KIB-21", "KIB-15", "KIB-9", "KIB-7", "KIB-11", "KIB-22"]],
      ["POR", ["POR-9"]],
      ["FAC", ["FAC-31", "FAC-34"]],
    ]);
    expect(countMine(myTickets([kib, por, fac], snapshots, "adam", "assigned"))).toBe(9);
  });
  test("my agents: open tickets assigned to any agent", () => {
    expect(keys("agents")).toEqual([["KIB", ["KIB-12"]]]);
  });
  test("created by me is empty until tickets record their author (E5)", () => {
    expect(keys("created")).toEqual([]);
  });
  test("a project without snapshot yet is skipped", () => {
    expect(myTickets([meta("x", "X", "X")], snapshots, "adam", "assigned")).toEqual([]);
  });
});
```

Run: `bun test packages/ui/src/mine/my-tickets.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implémenter le calcul**

`packages/ui/src/mine/my-tickets.ts` :
```ts
import type { ProjectMeta, ProjectSnapshot, StatusId, TicketView } from "@kibo/schema";

export type MineTab = "assigned" | "agents" | "created";
export type MineGroup = { project: ProjectMeta; tickets: TicketView[] };

export const MINE_STATUS_ORDER: readonly StatusId[] = ["blocked", "in_progress", "todo", "in_review", "backlog"];

const rank = (s: StatusId) => MINE_STATUS_ORDER.indexOf(s);
const keyNumber = (key: string) => Number(key.slice(key.lastIndexOf("-") + 1));
const waits = (t: TicketView) => (t.waitingOn.length > 0 ? 0 : 1);

export function isMine(t: TicketView, viewer: string, tab: MineTab): boolean {
  if (t.statusId === "done") return false;
  if (tab === "assigned") return t.assignee?.kind === "human" && t.assignee.ref === viewer;
  if (tab === "agents") return t.assignee?.kind === "agent";
  return false;
}

export function compareMine(a: TicketView, b: TicketView): number {
  return rank(a.statusId) - rank(b.statusId) || waits(a) - waits(b) || keyNumber(a.key) - keyNumber(b.key);
}

export function myTickets(
  projects: readonly ProjectMeta[],
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
  viewer: string,
  tab: MineTab,
): MineGroup[] {
  return projects.flatMap((project) => {
    const tickets = (snapshots.get(project.id)?.tickets ?? []).filter((t) => isMine(t, viewer, tab)).sort(compareMine);
    return tickets.length > 0 ? [{ project, tickets }] : [];
  });
}

export const countMine = (groups: readonly MineGroup[]): number => groups.reduce((n, g) => n + g.tickets.length, 0);
```

Run: `bun test packages/ui/src/mine/my-tickets.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests de la page**

`packages/ui/src/i18n/fr.ts` : `nav.mine: "Mes tickets"` et
```ts
  mine: {
    assigned: "Assignés à moi",
    agents: "Mes agents",
    created: "Créés par moi",
    createdLater: "Kibo n'enregistre pas encore l'auteur d'un ticket.",
    summary: (tickets: number, projects: number) =>
      `${tickets} ticket${tickets > 1 ? "s" : ""} · ${projects} projet${projects > 1 ? "s" : ""}`,
    assign: "Assigner",
    noFolder: "Ajoute un dossier au projet pour lancer un agent.",
    empty: { assigned: "Aucun ticket ouvert ne t'est assigné.", agents: "Aucun ticket ouvert n'est confié à un agent." },
  },
```

`packages/ui/src/mine/my-tickets-page.test.tsx` : reprendre le jeu de l'étape 1 (extraire `ticket`, `meta`, `snapshot` et le jeu dans `packages/ui/src/mine/fixtures.ts` si les deux tests le partagent ; `fac.folder = null`, `kib.folder = "/tmp/kibo"`), `config = configFixture()` :
```tsx
test("groups my tickets by project with the mockup summary", async () => {
  render(<MyTicketsPage viewer="adam" projects={[kib, por, fac]} snapshots={snapshots} config={configFixture()} onOpenTicket={() => {}} onAssign={() => {}} />);
  expect(screen.getByText("9 tickets · 3 projets")).toBeTruthy();
  const kibo = screen.getByRole("region", { name: "Kibo" });
  expect(within(kibo).getAllByRole("button", { name: /^KIB-\d+/ }).map((b) => b.getAttribute("aria-label")?.split(" ")[0])).toEqual([
    "KIB-21", "KIB-15", "KIB-9", "KIB-7", "KIB-11", "KIB-22",
  ]);
});
test("opening a row and assigning report the project", async () => {
  const opened: string[][] = [];
  const assigned: string[][] = [];
  render(<MyTicketsPage viewer="adam" projects={[kib, por, fac]} snapshots={snapshots} config={configFixture()}
    onOpenTicket={(p, t) => opened.push([p, t])} onAssign={(p, t) => assigned.push([p, t])} />);
  const kibo = screen.getByRole("region", { name: "Kibo" });
  fireEvent.click(within(kibo).getByRole("button", { name: /^KIB-21/ }));
  fireEvent.click(within(kibo).getAllByRole("button", { name: "Assigner" })[0]);
  expect(opened[0]?.[0]).toBe("kib");
  expect(assigned[0]?.[0]).toBe("kib");
  const facturation = screen.getByRole("region", { name: "API Facturation" });
  expect(within(facturation).getAllByRole("button", { name: "Assigner" })[0]?.hasAttribute("disabled")).toBe(true);
});
test("my agents tab and the disabled created tab", async () => {
  render(<MyTicketsPage viewer="adam" projects={[kib, por, fac]} snapshots={snapshots} config={configFixture()} onOpenTicket={() => {}} onAssign={() => {}} />);
  expect(screen.getByRole("radio", { name: "Créés par moi" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Mes agents" }));
  expect(screen.getByText("1 ticket · 1 projet")).toBeTruthy();
  expect(screen.getByRole("button", { name: /^KIB-12/ })).toBeTruthy();
});
```
(le segmenté réutilise le `ToggleGroup` du SDK en mode `single`, d'où le rôle `radio` ; si la primitive expose un autre rôle, prendre le rôle réel.)

Run: `bun test packages/ui/src/mine`
Expected: FAIL.

- [ ] **Step 4: Implémenter la page et la ligne**

`MyTicketsPage.tsx` : état local `tab` (défaut `assigned`) ; `groups = myTickets(...)` mémorisé ; en-tête `flex items-center justify-between border-b px-6 py-3` avec le `ToggleGroup` (fond `bg-muted`, élément actif `bg-background shadow-sm`, `text-xs`) et le résumé `text-xs text-muted-foreground` ; « Créés par moi » désactivé, enveloppé d'un `Tooltip` `fr.mine.createdLater` ; corps `grid gap-6 p-6` ; un `section` par groupe `aria-labelledby` sur le titre (pastille carrée de la couleur du projet, nom `text-sm font-semibold`, nombre `text-2xs text-muted-foreground`) puis une liste de `MyTicketRow` ; état vide `text-sm text-muted-foreground` (`fr.mine.empty[tab]`).

`MyTicketRow.tsx` : `div` `flex h-12 items-center gap-3 rounded-lg border bg-card px-4` ; bouton principal (toute la zone gauche, `aria-label` = `"<clé> <titre>"`) : `StatusDot`, clé `font-mono text-2xs text-muted-foreground`, titre `truncate text-sm` ; à droite : badge de domaine (`Badge variant="outline" className="gap-1 text-3xs"` avec carré `size-1.5` de la couleur du domaine), libellé du statut `w-24 text-sm text-muted-foreground` ; action : onglet `agents` ⇒ `Bot` + nom du profil (`config.profiles`, sinon `assignee.ref`) ; sinon `Button variant="ghost" size="sm"` `Bot` + « Assigner » si `project.folder`, ou `Button size="icon"` désactivé `aria-label={fr.mine.assign}` avec `Tooltip` `fr.mine.noFolder`. Tailles selon la table de la tâche 36 (si elle n'est pas encore intégrée, les mêmes classes s'appliqueront telles quelles : `text-2xs`/`text-3xs` n'ont d'effet qu'une fois les tokens présents).

Run: `bun test packages/ui/src/mine`
Expected: PASS.

- [ ] **Step 5: Brancher l'écran**

- `packages/schema/src/tabs.ts` : `Screen = z.enum(["agents", "queue", "domains", "components", "mine"])`. Un onglet persisté reste valide (ajout seulement).
- `SCREENS.mine = { title: fr.nav.mine, icon: List, crumbs: [fr.nav.mine] }` ; `Breadcrumb` : `heading` vrai pour `mine`.
- `lazy-screens.ts` : `export const MyTicketsPage = lazyPanel(() => import("../mine/MyTicketsPage").then((m) => m.MyTicketsPage), fr.lazy);` ; `FORBIDDEN_IN_ENTRY` : ajouter `mine\/MyTicketsPage` à l'alternative des écrans de `packages/ui/src` (et l'identifiant au test des règles par défaut).
- `ScreenView` : nouvelles props `viewer`, `snapshots`, `onOpenTicket`, `onAssign` ; `if (screen === "mine") return <MyTicketsPage viewer={viewer} projects={projects} snapshots={snapshots} config={config} onOpenTicket={onOpenTicket} onAssign={onAssign} />` (avant le `if (!config)` : la page accepte `config` nul, badges de domaine et noms de profil absents).
- `Shell.tsx` : `mine = useMemo(() => countMine(myTickets(projects, snapshots, viewer, "assigned")), [projects, snapshots, viewer])` passé en `mineCount` ; `onOpenTicket = (projectId, ticketId) => set({ sheet: { projectId, ticketId } })` ; `onAssign = (projectId, ticketId) => set({ assign: { projectId, ticketId } })`. Les appels existants passent `{ projectId: null, ticketId }`.
- `ShellDialogs.tsx` : `AssignDialog` reçoit `state.assign.projectId ? (snapshots.get(state.assign.projectId) ?? null) : project` (nouvelle prop `snapshots`).
- `AppSidebar.tsx`, entre « Vue d'ensemble » et `AgentsEntry` :
```tsx
<SidebarMenuItem>
  <SidebarMenuButton isActive={screen === "mine"} {...link(screenTarget("mine"))}>
    <List />
    <span>{fr.nav.mine}</span>
  </SidebarMenuButton>
  {p.mineCount !== null && p.mineCount > 0 && <SidebarMenuBadge>{p.mineCount}</SidebarMenuBadge>}
</SidebarMenuItem>
```
- La palette liste l'écran automatiquement (`Screen.options`) : mettre à jour `screen-items.test.ts`.

`e2e/screens.spec.ts` :
```ts
test("12 · Mes tickets", async () => {
  const info = test.info();
  await sideButton("Mes tickets").click();
  const count = Number(await page.getByRole("button", { name: "Mes tickets" }).locator("..").getByText(/^\d+$/).textContent());
  await expect(page.getByRole("radio", { name: "Assignés à moi" })).toBeVisible();
  await expect(page.getByText(new RegExp(`^${count} tickets? · \\d+ projets?$`))).toBeVisible();
  await capture(info, "12");
});
```
(adapter la lecture du badge à la structure réelle ; l'assertion à garder : le compteur de la barre latérale égale le nombre de tickets du résumé.)

Run: `bun test packages components && bun run --cwd e2e test --project screens-dark --project screens-light`
Expected: PASS.

- [ ] **Step 6: Contrôle visuel, vérifier et committer**

Comparer l'écran 12 à la page 22 des deux PDF (sombre puis clair) avec le jeu fictif : groupes, ordre, badges, « Assigner », résumé, entrée de la barre latérale et son compteur.

Run: `bun test packages components && bun run typecheck && bun run check && bun run budget`
Expected: PASS.

```bash
git add packages/ui/src/mine
git commit -m "feat(ui): calcul et page Mes tickets"
git add packages/schema/src/tabs.ts packages/ui/src/tabs packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Breadcrumb.tsx packages/ui/src/i18n/fr.ts packages/ui/src/palette/screen-items.test.ts packages/ui/scripts e2e/screens.spec.ts
git commit -m "feat(ui): Mes tickets dans la barre latérale"
```

---

### Task 38: En-tête de workspace (monogramme, nom, menu)

Écart de v0.3 : « Kibo » et le logo orange à la place du sélecteur de workspace ; onglet Accueil avec le logo orange au lieu du monogramme. Toutes les pages des PDF (en-tête de la barre latérale, onglet Accueil). Décision 32, point E6, écran D11.

Monogramme relevé dans le PDF (page 22, vecteurs) : tuile carrée bordée de 23 px (`bg-card`, `border`), glyphe de 5 barres de 3,84 px de large sur une grille de 0,48 px : colonne 1 hauteurs 11 et 8 (écart 3), colonne 2 hauteurs 8 et 15 (écart 3, la seconde en orange `#F97316`), colonne 3 hauteur 6 ; barres en couleur du texte, la colonne 1 basse et la colonne 3 à 45 % d'opacité (rendu des PDF).

**Files:**
- Create: `packages/ui/src/shell/WorkspaceMark.tsx`, `packages/ui/src/shell/WorkspaceSwitcher.tsx`, `packages/ui/src/dialogs/RenameWorkspaceDialog.tsx`, `packages/ui/src/shell/workspace-switcher.test.tsx`
- Modify: `packages/schema/src/agent.ts` (`WorkspaceName`, `ConfigCommand` `renameWorkspace`, `ConfigResult`, `WorkspaceConfig.workspaceName`), `packages/core/src/agent-config.ts` et son test, `packages/daemon/src/workspace-config.ts`, `packages/ui/src/agents/fixtures.ts` (`workspaceName: "Perso"`), `packages/ui/src/shell/AppSidebar.tsx` (en-tête), `packages/ui/src/shell/Shell.tsx` (nom et renommage), `packages/ui/src/tabs/TabBar.tsx` (onglet Accueil), `packages/ui/src/i18n/fr.ts` (`workspace`), `e2e/screens.spec.ts`

**Interfaces:**
- Consumes: `executeConfigCommand`, `configTarget` (core, phase 2), `readConfig` (démon), `useConfig` (UI), `DropdownMenu`, `Dialog`, `Input`, `Label`, `Button` (SDK).
- Produces:
  - `WorkspaceName = z.string().trim().min(1).max(40)` ; `ConfigCommand` gagne `{ method: "renameWorkspace"; name: WorkspaceName }` ; `ConfigResult.renameWorkspace = { name: string }` ; `WorkspaceConfig.workspaceName: string | null`.
  - `workspaceName(ws: LoroDoc): string | null` (core, `ws.getMap("settings").get("name")`).
  - `WorkspaceMark({ className? })` (SVG `viewBox="0 0 28 26"`) ; `WorkspaceTile({ size: "sm" | "md" })` (tuile bordée : `md` = `size-6` pour la barre latérale, `sm` = `size-5` pour l'onglet Accueil).
  - `WorkspaceSwitcher(props: { name: string; onRename(name: string): Promise<void>; onSettings(): void })`.
  - `AppSidebar` gagne `workspaceName: string | null` et `onRenameWorkspace(name): Promise<void>`.

Menu (D11) : déclencheur pleine largeur (tuile, nom `text-sm font-semibold`, « Workspace local » `text-2xs text-muted-foreground`, `ChevronDown` à droite) ; contenu aligné au début, largeur du déclencheur : libellé « Workspaces », workspace courant (tuile, nom, sous-titre, `Check`), séparateur, « Renommer le workspace… » (`Pencil`), « Paramètres du workspace » (`Settings`, écran Domaines & guidelines, comme l'entrée Paramètres). Dialogue « Renommer le workspace » : champ « Nom » prérempli, « Annuler » / « Enregistrer », alerte « Impossible de renommer le workspace. » (message de `KiboError` via `errorMessage` s'il existe). Création et bascule entre workspaces : point E6, pas d'entrée désactivée dans le menu.

- [ ] **Step 1: Tests du core**

`packages/core/src/agent-config.test.ts`, ajouter :
```ts
test("the workspace name is stored in the workspace doc and trimmed", () => {
  const ws = createWorkspaceDoc();
  expect(workspaceName(ws)).toBeNull();
  expect(executeConfigCommand(ws, ConfigCommand.parse({ method: "renameWorkspace", name: "  Maison  " }))).toEqual({ name: "Maison" });
  expect(workspaceName(ws)).toBe("Maison");
  expect(configTarget({ method: "renameWorkspace", name: "Maison" })).toBeNull();
});
test("an empty or too long workspace name is refused by the schema", () => {
  expect(ConfigCommand.safeParse({ method: "renameWorkspace", name: "   " }).success).toBe(false);
  expect(ConfigCommand.safeParse({ method: "renameWorkspace", name: "x".repeat(41) }).success).toBe(false);
});
```

Run: `bun test packages/core/src/agent-config.test.ts`
Expected: FAIL.

- [ ] **Step 2: Schéma, core, démon**

`packages/schema/src/agent.ts` : `export const WorkspaceName = z.string().trim().min(1).max(40);` ; dans `ConfigCommand`, `z.object({ method: z.literal("renameWorkspace"), name: WorkspaceName })` ; `ConfigResult` : `renameWorkspace: { name: string }` ; `WorkspaceConfig` : `workspaceName: string | null`.

`packages/core/src/agent-config.ts` :
```ts
const settingsMap = (ws: LoroDoc) => ws.getMap("settings");

export function workspaceName(ws: LoroDoc): string | null {
  const name = settingsMap(ws).get("name");
  return typeof name === "string" ? name : null;
}
```
et, dans `executeConfigCommand`, le cas `renameWorkspace` : `settingsMap(doc).set("name", cmd.name)` puis le `commit` comme les autres cas ; retour `{ name: cmd.name }`. `configTarget` renvoie `null` pour ce cas (doc workspace), comme pour les profils.

`packages/daemon/src/workspace-config.ts`, `readConfig` : `workspaceName: workspaceName(docs.workspace)`. `runConfigCommand` émet déjà `{ topic: "config" }` : l'UI se met à jour sans autre code. Aucun changement de `service.ts` (pas de conflit avec la tâche 30).

`packages/ui/src/agents/fixtures.ts`, `configFixture()` : `workspaceName: "Perso"`.

Run: `bun test packages/core packages/daemon/src && bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Tests de l'en-tête**

`packages/ui/src/i18n/fr.ts` :
```ts
  workspace: {
    defaultName: "Perso",
    local: "Workspace local",
    menu: "Workspaces",
    rename: "Renommer le workspace…",
    settings: "Paramètres du workspace",
    renameTitle: "Renommer le workspace",
    name: "Nom",
    cancel: "Annuler",
    save: "Enregistrer",
    renameFailed: "Impossible de renommer le workspace.",
  },
```

`packages/ui/src/shell/workspace-switcher.test.tsx` :
```tsx
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

describe("workspace switcher", () => {
  test("shows the name and the local subtitle", () => {
    render(<WorkspaceSwitcher name="Perso" onRename={async () => {}} onSettings={() => {}} />);
    expect(screen.getByRole("button", { name: /Perso/ }).textContent).toContain("Workspace local");
  });
  test("renames from the menu", async () => {
    const names: string[] = [];
    render(<WorkspaceSwitcher name="Perso" onRename={async (n) => { names.push(n); }} onSettings={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Perso/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Renommer le workspace…" }));
    const field = await screen.findByLabelText("Nom");
    await userEvent.clear(field);
    await userEvent.type(field, "Maison");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(names).toEqual(["Maison"]);
  });
  test("a failed rename is shown, the dialog stays open", async () => {
    render(<WorkspaceSwitcher name="Perso" onRename={async () => { throw new Error("nope"); }} onSettings={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Perso/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Renommer le workspace…" }));
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de renommer le workspace.");
    expect(screen.getByRole("dialog", { name: "Renommer le workspace" })).toBeTruthy();
  });
  test("settings entry opens the workspace settings", async () => {
    let opened = 0;
    render(<WorkspaceSwitcher name="Perso" onRename={async () => {}} onSettings={() => { opened += 1; }} />);
    await userEvent.click(screen.getByRole("button", { name: /Perso/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
    expect(opened).toBe(1);
  });
});
```
(si l'ouverture des menus Radix sous happy-dom demande `pointerDown` dans les tests existants, reprendre la méthode de `packages/ui/src/pages/instance.test.tsx`.)

Run: `bun test packages/ui/src/shell/workspace-switcher.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implémenter**

`WorkspaceMark.tsx` :
```tsx
export function WorkspaceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 26" className={className} aria-hidden="true">
      <rect x="0" y="0" width="8" height="11" rx="1.5" fill="currentColor" />
      <rect x="0" y="14" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="10" y="0" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="10" y="11" width="8" height="15" rx="1.5" fill="#F97316" />
      <rect x="20" y="0" width="8" height="6" rx="1.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function WorkspaceTile({ size }: { size: "sm" | "md" }) {
  return (
    <span className={size === "md" ? "grid size-6 shrink-0 place-items-center rounded-md border bg-card" : "grid size-5 shrink-0 place-items-center rounded-[5px] border bg-card"}>
      <WorkspaceMark className={size === "md" ? "size-3.5" : "size-3"} />
    </span>
  );
}
```
(l'orange du glyphe est la marque, autorisée par `CLAUDE.md` à côté des agents.)

`WorkspaceSwitcher.tsx` : `DropdownMenu` (SDK) avec le déclencheur et le contenu décrits plus haut ; état local `renaming: boolean` ; `RenameWorkspaceDialog({ name, onSubmit, onClose })` : formulaire, `useId()` pour le champ, erreur attrapée ⇒ `role="alert"` `fr.workspace.renameFailed` et le dialogue reste ouvert (aucune erreur avalée : elle est affichée), succès ⇒ fermeture.

`AppSidebar.tsx`, `SidebarHeader` : remplacer le `span` « Kibo » par `<WorkspaceSwitcher name={p.workspaceName ?? fr.workspace.defaultName} onRename={p.onRenameWorkspace} onSettings={() => onOpen(screenTarget("domains"), false)} />` ; le bouton de recherche reste dessous.

`Shell.tsx` : `workspaceName={config?.workspaceName ?? null}` ; `onRenameWorkspace={async (name) => { await client.rpc({ method: "config", command: { method: "renameWorkspace", name } }); }}`.

`TabBar.tsx`, onglet Accueil : `<WorkspaceTile size="sm" />` au lieu de `<KiboLogo className="size-4" decorative />` (`KiboLogo` reste utilisé par l'écran d'appairage).

`e2e/screens.spec.ts`, dans le test de densité de la tâche 36 s'il est intégré, sinon dans un test « en-tête de workspace » :
```ts
const header = page.getByRole("button", { name: /Perso/ }).first();
await expect(header).toContainText("Workspace local");
```

Run: `bun test packages components && bun run --cwd e2e test --project screens-dark --project screens-light`
Expected: PASS.

- [ ] **Step 5: Contrôle visuel, vérifier et committer**

Comparer l'en-tête et l'onglet Accueil avec la page 22 (et n'importe quelle autre page) des deux PDF, sombre puis clair : tuile, glyphe, graisse du nom, sous-titre, chevron ; ouvrir le menu et le dialogue (écran D11).

Run: `bun test packages components && bun run typecheck && bun run check && bun run budget`
Expected: PASS.

```bash
git add packages/schema/src/agent.ts packages/core/src/agent-config.ts packages/core/src/agent-config.test.ts packages/daemon/src/workspace-config.ts packages/ui/src/agents/fixtures.ts
git commit -m "feat(core): nom du workspace"
git add packages/ui/src/shell/WorkspaceMark.tsx packages/ui/src/shell/WorkspaceSwitcher.tsx packages/ui/src/dialogs/RenameWorkspaceDialog.tsx packages/ui/src/shell/workspace-switcher.test.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/tabs/TabBar.tsx packages/ui/src/i18n/fr.ts e2e/screens.spec.ts
git commit -m "feat(ui): en-tête et menu du workspace"
```

---

### Task 39: Resynchroniser la spec §15 avec les décisions du plan

Documentation seulement (tâche du chef ou d'un `kibo-runner`). Écarts constatés le 2026-09-26 entre « Décisions techniques de ce plan » et `docs/superpowers/specs/2026-09-26-kibo-composants.md` §15 :
- décisions 1 à 4, 6 à 15, 17 à 25 : identiques (la 17 révisée par la relecture de la tâche 22, CORS de `ui.css`, et les 24 et 25 sont déjà reportées) ;
- décision 5 : la spec est en avance (`SANDBOX_UNAVAILABLE`) ; le plan est aligné sur elle (fait avec l'ajout des tâches 35 à 39) ;
- décision 16 : la spec a l'ancienne liste (sans `global`, `self`, `Worker`, `SharedWorker`, ni les attributs d'import) ;
- décision 26 (journal des refus borné) : absente de §15 (elle est décrite en §6.4, point 6, mais pas listée) ;
- décisions 27 (balayage de secours des notes) et 28 (le graphe lit `run`) : écrites en §8.1 et §8.2 (commits `docs: notes, balayage de secours`, `docs: le graphe lit l'état des runs`) mais absentes de §15 ;
- décisions 29 à 32 (tâches 35 à 38) et points E5, E6 : nouvelles.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-26-kibo-composants.md` (§15), `docs/superpowers/specs/2026-09-25-kibo-design.md` (§8, ligne « Sidebar »)

- [ ] **Step 1: §15**

Dans §15 de la spec de phase :
1. remplacer le texte de la décision 16 par celui du plan (décision 16 ci-dessus, mot pour mot) ;
2. ajouter, après la décision 25, les décisions 26 à 32 du plan, mot pour mot ;
3. ajouter les lignes E5 et E6 au tableau « Points à arbitrer par Adam » de la spec, mot pour mot.

- [ ] **Step 2: Spec générale**

`docs/superpowers/specs/2026-09-25-kibo-design.md` §8, ligne « **Sidebar** » : après « sélecteur de workspace », ajouter « (en-tête et renommage en phase 4 ; création et bascule entre workspaces : point E6 du plan de phase 4) ».

- [ ] **Step 3: Vérifier et committer**

Run: `diff <(sed -n '/^## Décisions techniques/,/^### Points à arbitrer/p' docs/superpowers/plans/2026-09-26-kibo-composants.md | grep -E '^[0-9]+\. ') <(sed -n '/^## 15\./,/^Ancrages/p' docs/superpowers/specs/2026-09-26-kibo-composants.md | grep -E '^[0-9]+\. ')`
Expected: aucune différence.

```bash
git add docs/superpowers/specs/2026-09-26-kibo-composants.md docs/superpowers/specs/2026-09-25-kibo-design.md
git commit -m "docs: spec §15, décisions 16 et 26 à 32"
```

---

## Tâche de stabilisation (décision du chef d'équipe)

- [x] **Tests intermittents sous charge** (branche `feat/p4-stab`) : chaque cause corrigée, preuve par passages répétés pendant une charge CPU et une suite complète en parallèle.
  - `worktree-watch` : un événement de fichier n'est pas garanti (le flux FSEvents démarre après le retour de `fs.watch`). Le worktree est désormais surveillé avant la lecture de sa signature, et le balayage vérifie la disparition au moins chaque seconde au lieu de 60 s.
  - `run.test.ts` (sortie sans fin) : le groupe était tué avant que le shell n'écrive les pids (1 Mo de stderr en ~20 ms). Chaque processus note son pid avant toute sortie.
  - E2E agents et écrans : des seuils à 100 % retiennent quand même un run sur une machine saturée. Le démon E2E tourne avec une charge fixe `--host-load 62,70` (valeurs de l'écran 17) ; spec agents §10 mise à jour.

## Vagues d'exécution

Une vague démarre quand toutes les tâches de la vague précédente sont intégrées à `main`. Dans une vague, les tâches sont confiées en parallèle (un `kibo-dev` par tâche, worktree `.claude/worktrees/p4-t<n>`, branche `feat/p4-t<n>`). Les seuls fichiers partagés dans une même vague sont `package.json` (script `typecheck`), `bun.lock` et `packages/devkit/src/index.ts` (lignes `export *` ajoutées) : conflits triviaux, résolus au rebase par `bun install` et la concaténation des lignes.

| Vague | Tâches en parallèle | Fichiers (périmètre) | Attend |
|---|---|---|---|
| V1 | 1 Spikes · 2 Interfaces figées | `packages/devkit/` (création) · `packages/schema/`, `packages/sdk/{package.json,types,sdk}`, `packages/ui/src/i18n/fr.ts`, spec §15 | — |
| V2 | 3 Core · 4 Empreinte/imports/squelette · 7 SDK v1 · 8 Proxy `fetch` · 9 Analyse des notes · 10 Graphe pur · 11 Runtime et hôtes | `packages/core/src/{instance-data,registry,instances,commands}` · `packages/devkit/src/{hash,imports,scaffold,test-kit}`, `fixtures/hello` · `packages/sdk/src/{types,sdk,client,server,migrations}`, `packages/ui/src/{pages/PageView,shell/Host,shell/Shell}` · `packages/daemon/src/components/net-proxy` · `packages/core/src/note-parse` · `components/graph/` · `packages/daemon/src/{component-runtime,components/{runtime-core,host-core,process-host,worker-host,component-worker}}` | V1 |
| V3 | 5 Inférence · 6 Build · 11b Bac à sable OS · 12 SDK simulé et conformité · 13 Runtime iframe · 15 Porte · 16 Mise à jour · 18 Notes démon · 19 Confiance/catalogue/création | `devkit/src/infer-permissions` · `devkit/src/build`, `sdk/src/theme.css`, `ui/src/index.css` · `devkit/src/os-sandbox`, `daemon/src/components/process-host`, `schema/src/errors.ts`, `ci.yml`, specs · `sdk/src/{mock,conformance,fixtures}` · `sdk/src/sandbox` · `daemon/src/components/{gate,quotas,events}` · `daemon/src/components/update` · `daemon/src/notes/` · `ui/src/{dialogs,state/use-components,lib/permission-lines}` | V2 |
| V4 | 14 Magasin · 17 Backends et jobs · 20 Validation · 23 Pont iframe et trusted · 24 Page Composants · 25 Graphe UI · 26 Notes | `daemon/src/components/store` · `daemon/src/components/{backends,jobs}` · `devkit/src/{validate,fr}`, fixtures · `ui/src/shell/{frame-bridge,SandboxFrame,trusted-loader,shared-modules}`, `ui/src/theme.ts`, `main.tsx` · `ui/src/components-page/`, `sdk/src/ui/table.tsx`, `route.ts`, `AppSidebar.tsx` · `components/graph/src/` · `components/notes/`, `sdk/src/status.tsx` | V3 |
| V5 | 21 Registre et confiance · 28 Cadres d'instance · 29 Graphe et Notes au catalogue | `daemon/src/components/{registry-service,fake-store.test-helper}` · `ui/src/pages/`, `ui/src/dialogs/{NotesDirDialog,OpenViewDialog}`, `shell/{page-actions,Shell}` · `ui/src/registry.ts`, `ui/package.json`, `rows.test.ts` | V4 |
| V6 | 22 Serveurs et CSP · 27 Publication et brouillons | `daemon/src/components/{sandbox-server,daemon-info}`, `daemon/src/{server,main}.ts` · `daemon/src/components/{publish,drafts}`, `fake-store.test-helper` (`put`) | V5 |
| V7 | 30 Assemblage du démon | `daemon/src/{service,store,daemon,main}.ts`, `daemon/src/components/service.ts` | V6 |
| V8 | 31 CLI · 32 Test de sortie · 33 Playwright | `packages/cli/`, `sdk/src/dev*.tsx`, `CLAUDE.md` · `devkit/fixtures/evil`, `daemon/src/components/exit.test.ts` · `e2e/` | V7 |
| V9 | 34 Binaire, toolchain, installation de `kibo`, CI | `apps/desktop/`, `daemon/src/components/install-cli`, `ui/src/settings/`, `.github/workflows/ci.yml` | V8 |

**Piste transverse (écarts de v0.3, tâches 35 à 39).** Elle court en parallèle des vagues V7 à V9 : ni la tâche 30 ni les vagues suivantes ne l'attendent, et elle n'attend pas la tâche 30 (aucune ne touche `daemon/src/{service,store,daemon,main}.ts` ni `components/service.ts`). Seul le jalon v0.4 attend toute la piste. Worktrees `.claude/worktrees/p4-t<n>`, branches `feat/p4-t<n>`.

| Étape | Tâches en parallèle | Fichiers (périmètre) | Attend |
|---|---|---|---|
| X1 | 35 Chargement à la demande et budget · 36 Densité 13 px · 39 Spec §15 | `sdk/src/{lazy,index,conformance}`, `ui/src/shell/{lazy-screens,ContentView,ScreenView,ShellDialogs}`, `components/{notes,graph}/src/{index,fr}.ts`, `ui/scripts/`, `package.json` · `sdk/src/theme.css`, `sdk/src/ui/sidebar.tsx`, classes de `ui/src/**` et `components/*/src/*.tsx`, `e2e/screens.spec.ts` · `docs/superpowers/specs/` | V5 (intégrée) : peut démarrer tout de suite, à côté de la relecture de 22 et de 28b |
| X2 | 37 Mes tickets · 38 En-tête de workspace | `ui/src/mine/`, `schema/src/tabs.ts`, `ui/src/{tabs,palette}`, `ui/src/shell/{Shell,ShellDialogs,ScreenView,AppSidebar,Breadcrumb,lazy-screens}`, `ui/scripts/bundle-report*` · `schema/src/agent.ts`, `core/src/agent-config*`, `daemon/src/workspace-config.ts`, `ui/src/shell/{WorkspaceMark,WorkspaceSwitcher,AppSidebar,Shell}`, `ui/src/tabs/TabBar.tsx`, `ui/src/dialogs/RenameWorkspaceDialog.tsx` | 35 et 36 (37 s'appuie sur `lazyPanel`, le budget et les tokens ; 38 sur les tokens), 39 (décisions écrites en spec avant le code) |

Fichiers partagés dans la piste et avec V7 à V9 : `package.json` (scripts, tâches 31 et 35), `packages/ui/src/i18n/fr.ts` (ajouts en fin d'objet), `AppSidebar.tsx` et `Shell.tsx` (37 et 38 : blocs distincts), `e2e/screens.spec.ts` (36, 37, 38 : tests ajoutés en fin de fichier ; la tâche 33 crée `e2e/components.spec.ts`, sans conflit) : conflits triviaux, résolus au rebase. La tâche 28b (`ui/src/shell/SandboxFrame.tsx`) et la tâche 35 ne touchent pas les mêmes fichiers.

Tâches à risque à faire relire aussi par `kibo-lead` (en plus de `kibo-reviewer`) : 1, 11, 11b, 15, 22, 23, 30, 32, 34, 35 (chemin de démarrage de l'UI et conformité des vues différées).

## Jalon v0.4

1. **CI verte** sur `main`, macOS et Linux : `bun run check`, `bun run typecheck`, `bun test packages components` (dont le test de sortie de la tâche 32), `bun run budget` (chargement initial ≤ 230 kB gzip, tâche 35), fumée CLI compilée (tâche 34), Playwright `dark` et `light` (tâches 33, 36 à 38), fumée desktop. CI GitHub hors service : même liste en contrôle local.
2. **Critères de sortie de la spec (§13)** cochés un par un dans le rapport, avec le test qui les prouve : composant tiers sandboxé bloqué (tâche 32) ; `new → test → publish` hors monorepo en dev (tâche 31) et compilé (tâche 34) ; écrans conformes (point 3) ; Kanban et Tickets passent la conformité v1 sans modification de leur code métier (tâche 12, étape 5 : `git diff v0.3..HEAD -- components/kanban/src components/tickets/src` ne touche aucun fichier métier ; les changements de classes de la tâche 36, s'il y en a dans ces dossiers, sont de la présentation et sont listés un par un dans le rapport).
3. **Conformité visuelle** : le chef lance l'app (`bun run --cwd apps/desktop dev` ou démon + UI), charge le jeu fictif (`seedDemo` et `DEMO_NOTES` via un projet de démonstration) et compare côte à côte, **en sombre puis en clair**, avec les PDF : écran 3 (page 7), 6 (page 10), 7 (page 13, widgets Graphe et Notes), 10 (page 16), 11 (page 17), 29 (page 11), 30 (page 12), 12 (page 22, tâche 37), l'en-tête de workspace et l'onglet Accueil (toutes les pages, tâche 38), la densité 13 px sur les écrans 1, 8, 9, 13, 14, 17 et 21 (pages 5, 8, 15, 23, 24, 27, 34, tâche 36), et les écrans dessinés D1 à D12. Chaque écart est corrigé (tâche de correction ajoutée au plan) ou consigné comme écart assumé : « lit et écrit » de l'écran 3 (tâche 19), placement des tickets isolés (E4), bouton « Hiérarchique » (E3), carte D8 hors Paramètres si l'écran n'existe pas (tâche 34).
4. **Maquettes** : si un écran a changé pendant la phase, réexporter `design/penpot/kibo.penpot.xz` et `design/pdf/` (règle `CLAUDE.md`).
5. **Feuille de route** : corriger la ligne « phase 4 » pour les entités déclarées `acme.bug` selon l'option retenue pour E1 (par défaut : retirées de la phase 4, reportées après v1.0).
6. **Tag** `v0.4` sur `main`, poussé.
7. **Rapport** `docs/superpowers/rapports/2026-xx-xx-v0.4.md` : livré (par tâche), écarts (liste du point 3, résultats des spikes A–G, ancrages phases 2/3 réellement rencontrés), risques ouverts (voir ci-dessous), décisions E1, E3 à E6 en attente d'Adam.
8. **Pas d'attente** : la phase 5 démarre aussitôt (décision d'Adam) ; E1, E3 à E6 restent en option A jusqu'à son arbitrage.

Risques à suivre dans le rapport : contournement du runtime restreint par import dynamique construit (E2, spike C : neutralisé par le bac à sable OS de la tâche 11b ; restent la dépréciation de `sandbox-exec`, les espaces de noms utilisateur désactivés sur certaines distributions Linux (Ubuntu ≥ 23.10 par AppArmor : échec fermé chez l'utilisateur, profil AppArmor du paquet `.deb` à étudier), l'absence de seccomp (sous Linux, un processus lancé dans le bac à sable y reste confiné mais n'est pas interdit), `file-read-metadata` global sous macOS (existence et taille des fichiers visibles), et le binaire compilé sous `bwrap` non vérifié hors CI) ; TOCTOU DNS du proxy (résolution puis connexion : atténué par la connexion à l'adresse résolue, tâche 8) ; appels d'un backend rattachés à une invocation en cours (limite résiduelle de la décision 15) ; chargement natif de Tailwind et de TypeScript depuis la toolchain dans le binaire (spikes D, E) ; `BUN_BE_BUN` (spike A) ; descripteur 3 (spike G) ; Worker dans le binaire compilé (spike F) ; taille de la toolchain packagée ; ancrages non vérifiés sur les phases 2 et 3.
