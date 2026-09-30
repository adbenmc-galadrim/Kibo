# Kibo · Finitions UI/UX, vague 2 (phase 9, v1.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** donner au démon et à l'interface ce qui manque pour gérer un projet et le workspace (modifier nom, couleur, image et dossier ; supprimer un projet avec confirmation par saisie du nom ; page « Workspace » : lot 2 du plan d'action), et rendre les réglages et l'en-tête honnêtes (thème Système / Clair / Sombre, appairage rangé dans Sécurité, cloche = historique des runs, avatar = menu, écran Raccourcis livré, réglages factices retirés : lot 7), sans relever le budget de chargement initial ni consommer un token.

**Architecture:** le démon gagne quatre opérations écrites en spec §14 (`updateProject`, `deleteProject`, `setIcon`, `updateWorkspace`), un magasin d'images SQLite hors CRDT servi par une route `GET /icons/…`, et un module `projects/` qui porte les opérations d'administration d'un projet avec le contexte de session (dossier et suppression réservés à la machine). L'interface gagne deux champs partagés (`FolderField` avec sélecteur natif, `IconField`), un menu projet complet, deux dialogues et une page de réglages, un thème réglable, deux menus d'en-tête et une page Raccourcis, tous chargés à la demande. La coque Tauri gagne `tauri-plugin-dialog` et la permission `dialog:allow-open`.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, loro-crdt, bun:sqlite, React 19 + shadcn/ui (`packages/sdk/src/ui` : `dropdown-menu`, `context-menu`, `toggle-group`, `dialog`, `confirm-dialog`, `menu-entries` déjà présents), Vite 7.1.6, happy-dom 18 + Testing Library, Playwright 1.55, Tauri 2 (`tauri-plugin-dialog` 2, nouvelle dépendance de la coque ; `@tauri-apps/plugin-dialog` 2, nouvelle dépendance de `packages/ui`, import dynamique seulement), cargo 1.98 (`~/.cargo/bin/cargo`).

**Spec:** `docs/superpowers/specs/2026-09-25-kibo-design.md` **§14** (décisions de cette vague, écrites avant ce plan : 14.1 `updateProject`, 14.2 `setIcon`, 14.3 `deleteProject`, 14.4 workspace, 14.5 apparence, appairage, en-tête, réglages retirés, 14.6 sélecteur de dossier, 14.7 codes d'erreur), §5 (modèle), §8 (écrans 12, 15, 76, 77) ; `docs/superpowers/specs/2026-09-26-kibo-sync.md` §13 (D9, D17, D20, D30, D32, D38, D39) ; `docs/superpowers/specs/2026-09-27-kibo-mises-a-jour.md` §3.7 et §4 (capacité IPC amendée) ; `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` §12.4 (menu projet), §12.5 (coque). Plan d'action : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (lots 2 et 7). Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md` (points 1, 2, 3, 7 ; Workspace et projets B ; Paramètres G). Plan de la vague 1 (forme et contrats hérités) : `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md`. Données des maquettes : `design/donnees-fictives.md`.

## Vérifié sur le code (`phase/9` = `d580bfc`, lots 1 et 4 intégrés)

Le plan d'action et le repérage citaient des noms de mémoire ; tout a été confronté au code. Colonne « Réel » : ce qui fait foi pour toutes les tâches.

| Besoin | Supposé | Réel (vérifié) |
|---|---|---|
| Modifier / supprimer un projet | RPC `updateProject`, `deleteProject` | **Aucune** : `RpcRequest` (`packages/schema/src/rpc.ts:69-163`) n'a que `listProjects`, `createProject { name, key, folder, color }`, `getProject`. `ProjectMeta = { id, key, name, folder: string \| null, color }` (`project.ts`), aucun champ image ni description nulle part. |
| Deux copies des métadonnées | une seule | Le doc workspace garde une **copie** de chaque `ProjectMeta` dans sa liste `projects` (`packages/core/src/workspace.ts` : `registerProject` ajoute seulement, ni mise à jour ni retrait) ; `listProjects` lit cette copie, `getProject` lit `meta` du doc projet via `docs.projectMeta` (`service.ts:162`, `withLocalFolder` réinjecte `project_settings.folder` pour un projet partagé, D32). Ce plan met à jour **les deux** copies. |
| Renommer le workspace | RPC | `ConfigCommand.renameWorkspace { name: WorkspaceName }` (`agent.ts:103`, `WorkspaceName = trim 1..40`), exécutée par `executeConfigCommand` (`core/agent-config.ts:187-193`, `settingsMap(doc).set("name")`), branchée par `runConfigCommand` (`daemon/workspace-config.ts:38-59`, `docs.save(null)` + `{ topic: "config" }`). `WorkspaceConfig.workspaceName: string \| null` (`readConfig`). Appelants : `ui/shell/workspace-actions.ts:5`, `WorkspaceSwitcher` → `RenameWorkspaceDialog`, tests `core/agent-config.test.ts:195-210`, `daemon/service.test.ts:182`, `ui/shell/agents-shell.test.tsx:199-212`, `ui/shell/workspace-switcher.test.tsx`. |
| Contexte de session dans le service | `service.handle(req, ctx)` | **`service.handle(req)` n'a pas le contexte.** Le contexte `RpcContext { sessionHash, remote }` n'arrive qu'aux extensions et aux `RpcHandler` de `dispatchRpc` (`rpc-extensions.ts`), câblés dans `daemon.ts:173` : `handlers: [componentTrustGuard, market.handler, collab.handler]`. `requireLocal(ctx)` lève `FORBIDDEN`. Ce plan ajoute un handler `projects/admin.ts` pour les opérations qui exigent le contexte. |
| Projet partagé | `syncInfo` | `collab.syncInfo(projectId)` ⇒ `ProjectSyncInfo { shared, keyAllocator, role, access, members }` (`daemon.ts:130`, `collab/bootstrap.ts`). `unshareProject` (`collab/share.ts:239-249`) : trame `unshare`, `client.detachProject` (supprime `sync_projects`, accès `write`, `collab.changed`), clés rendues, assignés et liaisons rendus, `members` retiré ; côté serveur le projet est supprimé pour tous (`revoked reason: deleted`). `SyncClient.detachProject(projectId)` (`sync-client.ts:162`) sert seul pour « quitter ». |
| Runs d'un projet | `activeRuns(projectId)` | `Orchestrator.activeRuns(profileId)` compte par **profil** ; par projet : `state().runs.filter((r) => r.projectId === id && !isTerminal(r.state))` (`RunView.projectId`, `isTerminal` de `@kibo/schema`). `cancelRun` existe. Les tables `runs*` de `runs.db` sont **en ajout seul** (triggers) : l'historique d'un projet supprimé est conservé. |
| Worktrees des agents | sous `KIBO_HOME` | `<racine git du projet>/.kibo/worktrees/<clé-ticket>` (`agents/workspace-prep.ts:66-89`), jamais nettoyés par le démon : Kibo ne les supprime pas (spec §14.3). |
| Stockage | `data.sqlite` | `kibo.db` (`store.ts`) : tables `docs`, `local_state`, `project_settings(project_id, key, value)` (`notes/settings.ts`, clés `folder`, `notesDir`, ni `remove` ni `delete`), `sync_projects`, sessions… `Store` n'a **pas** de `delete`. |
| Route qui sert des octets | `/api/...` | `/api/*` exige un en-tête `Origin` autorisé (`server.ts:144-146`), qu'une balise `<img>` n'envoie pas. Modèle à suivre : `/components/*` → `serveTrusted` (`components/trusted-route.ts` : `Origin` absent ou autorisé, `sec-fetch-site` absent ou `same-origin`, cookie de session, `GET` seul, en-têtes `nosniff` et `cross-origin-resource-policy: same-origin`). `MAX_BODY_BYTES = 1_048_576` pour `/api/rpc` : 256 kB d'image en base64 (≈ 350 kB) passent. |
| État des agents dans l'en-tête | RPC `listRuns` | **Aucune RPC de liste** : `getAgents` ⇒ `AgentsState { runs: RunView[] (tous, triés par seq), queue, host, tokensToday }`, déjà passé à `ShellHeader` (`agents` prop). `RunState = queued \| starting \| running \| waiting_input \| done \| failed \| cancelled` ; `question`, `endedAt`, `stateSince`, `label`, `runSubject(run, text?)`. Ouvrir un run dans le tiroir : `setFocusRun(runId)` de `Shell.tsx:84` (`AgentPanel.focusRunId`). Journal : `getRunLog`. Identité : `Session.user` (nom du compte OS), `SyncStatus.user: { id, name } \| null` et `serverUrl` (`getSyncStatus`, hook `useSyncServerStatus`). |
| Thème | à créer | `packages/ui/src/theme.ts` : `ThemePreference = system \| light \| dark`, `localStorage["kibo.theme"]`, `readThemePreference`, `cycleTheme` (palette), `followSystemTheme` (`main.tsx`), `useTheme()` (thème effectif). Il manque un setter et un hook de **préférence**. `matchMedia` est fourni par happy-dom. |
| Paramètres | `SettingsPage` | Pas de page conteneur : un écran par valeur de `Screen` (`schema/tabs.ts:8-21`), tables à étendre pour tout écran nouveau : `tabs/target-hash.ts` (`SCREEN_HASHES`), `tabs/screens.ts` (`SCREENS`), `palette/CommandPalette.tsx:55` (icônes), `shell/AppSidebar.tsx:67` (`SETTINGS_SCREENS`), `settings/SettingsNav.tsx` (`ITEMS`, `SettingsScreen`), `shell/ScreenView.tsx`, `shell/lazy-screens.ts`, `bundle-report.ts`. « Raccourcis » est un item sans `screen` (bouton désactivé « Bientôt »). Apparence = seule carte « Accès web » (`AppearancePage.tsx`, textes `fr.security.appearance`), testée dans `settings/security-page.test.tsx:230-238`. |
| Sélecteur de dossier | plugin présent | Ni `tauri-plugin-dialog` (`Cargo.toml`) ni `@tauri-apps/plugin-dialog` (`packages/ui/package.json`, `bun.lock`). Capacité construite à l'exécution : `daemon_capability` (`main.rs:62-76`). `inTauri()` vit dans `ui/shell/workspace-actions.ts:9`. Modèle d'import dynamique : `desktop/install.ts` ; modèle de test : `updates/tauri-updater.test.ts` (`mock.module("@tauri-apps/plugin-…")`). |
| Budget UI | 229,1 kB | **`bun run budget` échoue dans un worktree sans `bun install`** (`@tauri-apps/plugin-opener` absent de `node_modules`) : chaque tâche UI commence par `bun install --frozen-lockfile`. Dernière mesure sur `phase/9` : **227,3 kB** (marge 2,7 kB). `FORBIDDEN_IN_ENTRY` : `packages/ui/scripts/bundle-report.ts:23-38`. |
| Réglages factices | — | `settings/GeneralPage.tsx:35-66` (`ApplicationCard`, testée par `general-page.test.tsx` « shown but not yet available »), `mine/MyTicketsPage.tsx:40-49` (`created`, `MineTab` dans `mine/my-tickets.ts:3`), `dialogs/NewProjectForm.tsx:92-100` (`copy`, grille `sm:grid-cols-3`), `code/CommitPanel.tsx:54-69` (`fr.commit.generate`, `generateSoon`). |
| Tests UI | helpers partagés | Aucun : `mock.module("../api", …)` **par fichier** puis `await import` (modèle : `settings/general-page.test.tsx`). Jamais de `mock.module` d'un module partagé. Fixtures : `agents/fixtures.ts` (`agentsFixture`, `runFixture`, `configFixture`, `projectsFixture`, `kiboProject`). |
| Tests démon | `createTestDaemon` | `service.test.ts` : `openStore(tmp())` + `createService(store, { user: "adam" })` + `newProject`. HTTP : `daemon.test.ts` (`launch`, `pairCookie`, `rpcWith`). Sync réelle : `testing/sync-harness.ts` (`startSyncHarness({ daemons: 2 })`, `h.connect(i, name)`, `d(i).service.handle`, `d(i).share`, modèle `collab/share.test.ts`). |
| E2E | ports libres | 4390–4414 pris, **4415–4416 réservés à T16** (menus, non livrée) ; ce plan prend **4417–4418** ; 4461–4499 réservés aux démos. Modèle : `e2e/tabs.spec.ts`, aides `helpers.ts`, `repo-project.ts`, `git-repo.ts`. |
| Penpot | écran libre | Dernier écran scripté : **106** (`17-finitions.js`, page « 14 · Finitions UI » ; seuls 98 et 99 sombres sont dessinés) ; écran 77 « Raccourcis » existe (`15-complements.js:36-43`) ; écran 15 (Apparence : Thème + Démon local) et 71 (Sécurité) existent. Ce plan prend **107 à 112**. |

## Global Constraints

- Bun **1.4.2**, dépendances figées par `bun.lock` (`exact = true`), aucun `postinstall`. Nouvelles dépendances autorisées par ce plan, et seulement elles : `@tauri-apps/plugin-dialog` (`packages/ui`, 2.x compatible `@tauri-apps/api` 2.12.0, import dynamique, interdit dans l'entrée) et la crate `tauri-plugin-dialog = "2"` (`apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock` régénéré et commité).
- **Aucun commentaire dans le code** ; code, identifiants et messages d'erreur internes en anglais ; textes d'interface en français, **tutoiement**, sans jargon (« dossier », jamais « worktree » ni « repo » dans un texte nouveau ; « image », pas « icône », pour ce que l'utilisateur importe).
- Textes : un fichier `i18n/fr-<sujet>.ts` par tâche quand le module qui l'affiche est chargé à la demande (importé directement, jamais monté dans `fr.ts`, sur le modèle de `fr-share.ts`) : `fr-fields.ts` (T18), `fr-shortcuts.ts` (T25), `fr-workspace.ts` (T26), `fr-project.ts` (T27). Seules T23 (`fr-security.ts`, `fr.pairing`), T24 (`fr.header`), T25 (`fr.settings`, `fr.mine`, `fr.newProject`, `fr-code.ts › commit`) et T26 (`fr.workspace`) touchent des sections existantes.
- **Budget de 230 kB jamais relevé** : T18 mesure d'abord et réduit le chargement initial si la marge est inférieure à 4 kB (objectif ≤ 226,0 kB après T18) ; chaque écran, dialogue ou contenu de menu nouveau est chargé à la demande (`lazyPanel`) et **ajouté à `FORBIDDEN_IN_ENTRY`** ; chaque tâche UI note la mesure `bun run budget` dans son rapport ; le chef d'équipe la relance après chaque intégration.
- **Toute action destructive est confirmée** : supprimer un projet exige la **saisie de son nom** ; retirer une image et délier un dossier passent par le dialogue « Modifier le projet » (annulable avant Enregistrer). La confirmation nomme la cible et ce qui disparaît, et ce qui ne disparaît pas (dossier, notes, historique des runs).
- **Lecture seule** : en projet partagé avec accès `read-only` ou `revoked`, ni « Modifier… » ni « Nouvelle page » dans le menu projet (UI : `canEdit(project)`) ; « Supprimer… » reste (quitter localement) ; le démon refuse de toute façon (`FORBIDDEN`). **Session distante** : « Parcourir… » absent, le dossier et la suppression sont refusés par le démon (`FORBIDDEN`) et l'UI affiche le message `localOnly` ; le thème est celui du navigateur distant.
- Chaque écran ou dialogue existe **en sombre et en clair** (classes `dark:` des tokens, aucune couleur codée hors tokens sauf l'orange de marque `#F97316` et les couleurs de projet).
- **Tests** : TDD ; `bun test` sans horloge murale (temps injecté), sans dépendance à l'ordre des fichiers ni à un `mock.module` global ; démon avec `openStore(tmp())` et `startSyncHarness` ; coque avec `cargo test` ; aucune régression E2E (`bun run --cwd e2e test` sur les specs touchées et `projects.spec.ts` ajouté en T28). Aucun test ne consomme de token.
- Aucune erreur avalée : chaque `catch` affiche un message (`role="alert"`) ou relance ; jamais `catch {}` vide.
- Sécurité : images bornées et vérifiées par signature (spec §14.2), route `/icons/` sous cookie de session, `dialog:allow-open` seule permission nouvelle, dossier et suppression réservés aux sessions locales, aucune donnée nouvelle dans un CRDT partagé (D39).
- Git : une branche `feat/p9-<tâche>` par tâche depuis `phase/9`, worktree `.claude/worktrees/p9-<tâche>` (`p9-t18`…) ; commits d'une ligne en français, préfixe conventionnel, < 50 caractères, fichiers stagés explicitement, jamais `git stash`, aucune mention d'IA. `bun run check`, `bun run typecheck`, `bun test packages components ./scripts` verts avant chaque commit final.

## Review Focus

1. **Image piégée** (T21) : un fichier `.png` renommé qui contient du SVG, un JPEG de 300 kB, un base64 corrompu, un `mime` déclaré `image/png` sur des octets WebP : refus `INVALID_INPUT` / `TOO_LARGE` avant toute écriture, table `icons` intacte, et la route `/icons/` ne sert jamais un autre `content-type` que celui vérifié (tests `decode-icon.test.ts` et `icon-route.test.ts`).
2. **Suppression pendant que ça tourne** (T22) : un run `queued` ou `waiting_input` sur le projet ⇒ `CONFLICT`, rien n'est supprimé ; un run `done` ne bloque pas ; après suppression, `getProject` répond `NOT_FOUND`, `listProjects` ne le liste plus, `kibo.db` n'a plus ni doc, ni `project_settings`, ni `icons`, ni `sync_projects` pour cet id, et un redémarrage du démon ne le fait pas revenir (test « survives a restart »).
3. **Projet partagé** (T22) : propriétaire ⇒ `CONFLICT` et rien ne change sur le serveur ; membre ⇒ copie locale supprimée, `sync_projects` vidée, aucune trame envoyée au serveur autre que le désabonnement, le propriétaire garde son projet intact (test avec `startSyncHarness`).
4. **Dossier depuis une session distante ou un chemin qui n'existe pas** (T21) : `updateProject { folder }` avec `ctx.remote = true` ⇒ `FORBIDDEN` avant toute lecture du disque ; un chemin relatif ou un fichier ⇒ `INVALID_INPUT` ; `null` délie ; un projet partagé écrit dans `project_settings` et jamais dans `meta.folder` (le validateur du serveur refuserait le lot, D39).
5. **Nom de projet vide ou déjà pris pour la confirmation** (T27) : « Supprimer » reste désactivé tant que la saisie n'est pas exactement le nom (espaces autour ignorés, casse respectée) ; renommer avec un titre d'espaces ⇒ `INVALID_INPUT` expliqué, ancien nom conservé à l'écran.
6. **Cloche sans état** (T24) : `agents = null` (démon injoignable) ⇒ bouton inerte sans pastille ; `localStorage` indisponible ⇒ pastille calculée depuis 0 et erreur journalisée, jamais d'exception ; ouvrir le menu marque tout comme vu.

## Décisions

Les décisions de démon, de coque et de rangement des réglages sont écrites en spec de conception **§14** (14.1 à 14.7) et spec I §3.7 / §4 ; le plan ne les répète pas. Décisions d'interface prises par ce plan, à reporter au rapport du jalon :

1. **Un module d'administration des projets** (`packages/daemon/src/projects/admin.ts`) branché comme `RpcHandler` (contexte de session disponible) plutôt que dans `service.handle` : `updateProject`, `setIcon`, `deleteProject` y vivent ; `Docs` gagne `updateProjectMeta`, `removeProject` et `onProjectRemoved` ; `Store` gagne `delete`. Le service crée et expose le magasin d'images (`service.icons`) pour que `listProjects`, `getProject` et `readConfig` renseignent les empreintes.
2. **Deux champs partagés dans `packages/ui/src/dialogs/`** : `FolderField` (champ + « Parcourir… » quand `inTauri()`) utilisé par Nouveau projet, Dossier des notes, Rejoindre et Modifier le projet ; `IconField` (aperçu, choisir, retirer, vérification taille et format côté client) utilisé par Modifier le projet et par la page Workspace. Tous deux hors de l'entrée.
3. **Un dialogue « Modifier le projet »** (nom, couleur parmi les six de `PROJECT_COLORS`, image, dossier) plutôt que quatre entrées de menu : une seule confirmation, un seul appel `updateProject` (champs modifiés seulement) suivi de `setIcon` si l'image a changé. Le menu projet devient : Nouvelle page, Partager, Modifier…, séparateur, Supprimer… ; clic droit et « ⋯ » rendent la même liste (`projectMenuEntries`, décision 2 de la vague 1).
4. **Le dialogue de suppression s'adapte** au projet : refus expliqué (runs actifs : bouton « Voir les agents » ; propriétaire d'un projet partagé : bouton « Ouvrir le partage »), « Quitter le projet » pour un membre, « Supprimer le projet » sinon ; dans tous les cas la saisie du nom. Les onglets du projet sont fermés par une action `closeProject` du réducteur d'onglets (épinglés compris, récents purgés).
5. **Contenus de menus à la demande** : la cloche et l'avatar sont deux `DropdownMenu` dans l'entrée (déclencheur, pastille et compte des runs non vus : quelques lignes), dont le contenu (`RunHistoryList`, `UserMenuContent`) est chargé à l'ouverture (`lazyPanel`, `FORBIDDEN_IN_ENTRY`). Le bouton « Activer les notifications » passe dans le menu de la cloche.
6. **Thème** : `theme.ts` gagne `setThemePreference` et `useThemePreference` (préférence, pas thème effectif) ; `cycleTheme` reste pour la palette et se réécrit dessus. Apparence et le menu de l'avatar partagent `THEME_PREFERENCES` et les libellés `fr.security.appearance`.
7. **Page Raccourcis** : liste statique construite par `shortcutGroups(mac)` depuis `fr-shortcuts.ts` et `shortcutLabel` ; touches sans modificateur (`↵`, `Tab`) rendues telles quelles.
8. **`renameWorkspace` disparaît** avec `RenameWorkspaceDialog` (T26) : `updateWorkspace` la remplace en schéma, core, démon et UI ; T20 ajoute la nouvelle commande sans retirer l'ancienne pour que chaque tâche reste verte seule.
9. **Écrans Penpot** dessinés par le chef d'équipe en tête de vague (T17). Si l'édition Penpot n'est pas faisable, la vague avance et le rapport liste ces écrans comme écart assumé ; les tâches UI suivent les descriptions textuelles de T17.

## Lot 5 (tableau de bord éditable, formats de composant) : place réservée

Non rédigé : en attente de la réponse d'Adam sur les formats (petit, moyen, large, demi-page, plein écran). Ses tâches prendront les numéros **T29 et suivants** et un plan `2026-10-xx-kibo-phase-9-lot-5.md`. Interfaces avec cette vague : aucune commande commune (`setInstanceLayout` et le champ `formats` du manifeste ne touchent ni `ProjectMeta`, ni `WorkspaceConfig`, ni les fichiers de ce plan) ; `ProjectSnapshot.icon` (T21) est un champ optionnel que le lot 5 ignore ; `deleteProject` (T22) supprime les instances avec le doc, sans rien de particulier pour un layout. Seul point de contact : `packages/ui/src/pages/PageView.tsx` et `lib/next-layout.ts`, que **cette vague ne modifie pas**.

## Écrans à dessiner (Penpot, T17)

Page **« 14 · Finitions UI »**, script `design/penpot/scripts/18-projets-reglages.js` (modèle : `17-finitions.js` pour les menus et confirmations, `15-complements.js` pour les pages de réglages), écrans **107 à 112**, en sombre et en clair, données de `design/donnees-fictives.md` (workspace « Perso », projet Kibo (KIB), dossier `/Users/adam/code/kibo`, runs opus-dev-2 KIB-14 « attend une réponse », sonnet-review KIB-11 terminé il y a 41 min). Chaque tâche UI cite les écrans qu'elle implémente.

- **107 · Menu et modification d'un projet** (T27) : barre latérale, clic droit sur « Kibo » : Nouvelle page, Partager, Modifier…, séparateur, Supprimer… ; dialogue « Modifier le projet » : champ « Nom » (« Kibo »), « Couleur » (six pastilles carrées, l'orange cochée), « Image » (aperçu carré 48 px, boutons « Choisir une image… » et « Retirer l'image », aide « PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux. »), « Dossier » (champ mono `/Users/adam/code/kibo` avec bouton « Parcourir… », aide « Le dossier reste sur ta machine. Vide pour délier. »), boutons Annuler / Enregistrer ; variante d'erreur « Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier. »
- **108 · Supprimer un projet** (T27) : dialogue « Supprimer le projet Kibo ? », texte « 24 tickets, 5 pages et 3 widgets seront supprimés. Le dossier /Users/adam/code/kibo et ses fichiers ne sont pas touchés ; les notes restent sur le disque ; l'historique des runs est conservé. », champ « Tape Kibo pour confirmer », bouton « Supprimer » désactivé puis actif ; trois variantes : « Des agents travaillent sur ce projet » (« 2 runs en cours ou en file : arrête-les avant de supprimer le projet. », bouton « Voir les agents ») ; « Ce projet est partagé » (« Tu en es propriétaire : arrête d'abord le partage, ce qui le supprime du serveur pour tout le monde. », bouton « Ouvrir le partage ») ; « Quitter le projet Kibo ? » (« Ta copie locale sera supprimée. Le projet reste sur le serveur : il te faudra une nouvelle invitation pour y revenir. »).
- **109 · Paramètres › Workspace** (T26) : navigation des Paramètres avec « Workspace » en première entrée et active ; titre « Workspace », sous-titre « Nom, image et description de ton espace. » ; carte « Identité » : « Image » (aperçu 48 px, « Choisir une image… », « Retirer l'image »), « Nom » (« Perso », aide « 40 caractères au plus »), « Description » (zone de texte « Mes projets et ceux de l'équipe », aide « 500 caractères au plus »), bouton « Enregistrer » et mention « Enregistré » ; barre latérale avec l'image du workspace dans la tuile.
- **110 · Apparence et Sécurité** (T23) : Apparence = titre, sous-titre « Kibo suit le thème de ton système par défaut. », carte « Thème » avec le segmenté Système / Clair / Sombre (« Système » actif) et l'aide « Le thème système suit les réglages de ton ordinateur. » ; Sécurité (écran 71 amendé) = carte « Accès web » (« Appaire un navigateur de cet ordinateur ou du réseau local avec un code à usage unique. », bouton « Générer un code ») insérée avant « Sessions ».
- **111 · Historique des runs** (T24) : en-tête, cloche avec pastille « 2 », menu ouvert (largeur 360 px) : titre « Historique des runs », lignes « opus-dev-2 · KIB-14 · Attend une réponse · il y a 3 min · Répondre », « sonnet-review · KIB-11 · Terminé · il y a 41 min », « opus-dev-1 · KIB-9 · Échec · il y a 2 h », pied « Activer les notifications » (variante navigateur) ; variante vide « Aucun run pour l'instant. »
- **112 · Menu de l'avatar** (T24) : avatar « AD » ouvert : en-tête « adam », sous-ligne « Adam · sync.galadrim.fr » ; sous-menu « Thème » déplié (Système ✓, Clair, Sombre) ; séparateur ; « Sessions », « Paramètres ».

Écrans existants qui font foi sans redessin : **77** (Raccourcis, T25), **76** amendé par retrait de la carte « Application » (T25 : noter l'écart dans le rapport plutôt que redessiner). Coque (T19) : pas d'écran.

## File Structure

```
packages/schema/src/icon.ts  icon.test.ts                        NOUVEAU (T20) : IconMime, IconInput, IconOwner, MAX_ICON_BYTES, iconOwnerKey, iconUrl
packages/schema/src/project.ts  project.test.ts                  ProjectPatch (T20)
packages/schema/src/agent.ts  agent.test.ts                      WorkspaceDescription, WorkspacePatch, updateWorkspace, WorkspaceConfig (T20 ; renameWorkspace retirée en T26)
packages/schema/src/rpc.ts                                       updateProject, deleteProject, setIcon ; ProjectSummary.icon, ProjectSnapshot.icon (T20, T21)
packages/schema/src/index.ts                                     export ./icon (T20)
packages/core/src/workspace.ts  project.ts  project.test.ts      updateRegisteredProject, unregisterProject, setProjectMeta (T20)
packages/core/src/agent-config.ts  agent-config.test.ts          workspaceDescription, updateWorkspace (T20)
packages/daemon/src/icons/icon-store.ts  decode-icon.ts  icon-route.ts  *.test.ts   NOUVEAU (T21)
packages/daemon/src/projects/admin.ts  admin.test.ts             NOUVEAU (T21 : updateProject, setIcon ; T22 : deleteProject)
packages/daemon/src/projects/delete.test.ts  delete-shared.test.ts   NOUVEAU (T22)
packages/daemon/src/docs.ts  service.ts  service.test.ts         updateProjectMeta, icons (T21) ; removeProject, onProjectRemoved (T22)
packages/daemon/src/workspace-config.ts                          readConfig(docs, icons) (T21)
packages/daemon/src/server.ts  daemon.ts  daemon.test.ts         route /icons/, handler projects (T21) ; détachement sync (T22)
packages/daemon/src/store.ts  store.test.ts                      delete (T22)
packages/daemon/src/notes/settings.ts  service.ts  index.ts      remove, forget, clear (T22)
packages/daemon/src/components/service.ts  collab/project-hosts.ts   onProjectRemoved (T22)
apps/desktop/src-tauri/Cargo.toml  Cargo.lock  src/main.rs       tauri-plugin-dialog, PLAIN_PERMISSIONS (T19)
packages/ui/package.json                                         @tauri-apps/plugin-dialog (T18)
packages/ui/scripts/bundle-report.ts                             FORBIDDEN_IN_ENTRY (T18, T24, T25, T26, T27)
packages/ui/src/desktop/pick-folder.ts  pick-folder.test.ts      NOUVEAU (T18)
packages/ui/src/dialogs/FolderField.tsx  IconField.tsx  icon-file.ts  folder-field.test.tsx  icon-field.test.tsx  icon-file.test.ts   NOUVEAU (T18)
packages/ui/src/i18n/fr-fields.ts                                NOUVEAU (T18)
packages/ui/src/dialogs/NewProjectForm.tsx  NotesDirDialog.tsx  JoinProjectDialog.tsx   FolderField (T18)
packages/ui/src/shell/ScreenActions.tsx  lazy-screens.ts  ShellHeader.tsx   ScreenActions à la demande si le budget l'exige (T18)
packages/ui/src/theme.ts  theme.test.ts                          setThemePreference, useThemePreference, THEME_PREFERENCES (T23)
packages/ui/src/settings/AppearancePage.tsx  appearance-page.test.tsx  WebAccessCard.tsx  SecurityPage.tsx  security-page.test.tsx   (T23)
packages/ui/src/i18n/fr-security.ts  fr.ts (pairing)             (T23)
packages/ui/src/shell/run-history.ts  run-history.test.ts  RunHistoryButton.tsx  RunHistoryList.tsx  run-history-button.test.tsx   NOUVEAU (T24)
packages/ui/src/shell/UserMenu.tsx  UserMenuContent.tsx  user-menu.test.tsx   NOUVEAU (T24)
packages/ui/src/shell/ShellHeader.tsx  Shell.tsx  NotifyButton.tsx  lazy-screens.ts   (T24) ; i18n/fr.ts › header
packages/ui/src/settings/ShortcutsPage.tsx  shortcuts.ts  shortcuts.test.ts  shortcuts-page.test.tsx   NOUVEAU (T25)
packages/ui/src/i18n/fr-shortcuts.ts                             NOUVEAU (T25)
packages/schema/src/tabs.ts  packages/ui/src/tabs/target-hash.ts  screens.ts  palette/CommandPalette.tsx  shell/AppSidebar.tsx  settings/SettingsNav.tsx  shell/ScreenView.tsx  shell/lazy-screens.ts   écran shortcuts (T25), écran workspace (T26)
packages/ui/src/settings/GeneralPage.tsx  general-page.test.tsx  mine/MyTicketsPage.tsx  mine/my-tickets.ts  dialogs/NewProjectForm.tsx  code/CommitPanel.tsx  i18n/fr.ts  i18n/fr-code.ts   réglages retirés (T25)
packages/ui/src/settings/WorkspacePage.tsx  workspace-page.test.tsx   NOUVEAU (T26)
packages/ui/src/i18n/fr-workspace.ts                             NOUVEAU (T26)
packages/ui/src/shell/WorkspaceSwitcher.tsx  WorkspaceMark.tsx  workspace-switcher.test.tsx  AppSidebar.tsx  Shell.tsx  workspace-actions.ts  agents-shell.test.tsx  lazy-dialogs.ts   (T26)
packages/ui/src/dialogs/RenameWorkspaceDialog.tsx                SUPPRIMÉ (T26) ; renameWorkspace retirée de schema, core, daemon (T26)
packages/ui/src/lib/project-colors.ts                            NOUVEAU (T27) : PROJECT_COLORS (sorti de NewProjectDialog)
packages/ui/src/shell/project-menu.ts  project-menu.test.ts      NOUVEAU (T27)
packages/ui/src/shell/ShareControls.tsx  AppSidebar.tsx  ShellDialogs.tsx  Shell.tsx  lazy-dialogs.ts   menu projet (T27)
packages/ui/src/dialogs/EditProjectDialog.tsx  DeleteProjectDialog.tsx  edit-project-dialog.test.tsx  delete-project-dialog.test.tsx   NOUVEAU (T27)
packages/ui/src/i18n/fr-project.ts                               NOUVEAU (T27)
packages/ui/src/tabs/tabs-model.ts  tabs-model.test.ts           closeProject (T27)
design/penpot/scripts/18-projets-reglages.js  design/penpot/kibo.penpot.xz  design/pdf/*.pdf  design/penpot/README.md   (T17)
e2e/projects.spec.ts  e2e/playwright.config.ts                   (T28)
docs/superpowers/specs/2026-09-25-kibo-design.md §14, 2026-09-27-kibo-mises-a-jour.md §3.7 §4, 2026-09-26-kibo-sync.md D38   (écrits avec ce plan)
```

## Contrats partagés

Chaque tâche ne voit que sa propre section : ces signatures font foi entre tâches. Une tâche qui doit en changer une le signale au chef d'équipe, qui corrige ici avant d'intégrer.

### Schéma (T20, complété T21)

```ts
// packages/schema/src/icon.ts (T20)
export const ICON_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IconMime = z.enum(ICON_MIMES);
export type IconMime = z.infer<typeof IconMime>;
export const MAX_ICON_BYTES = 256 * 1024;
export const MAX_ICON_BASE64 = 350_000;
export const IconInput = z.object({ mime: IconMime, data: z.string().min(1).max(MAX_ICON_BASE64).regex(/^[A-Za-z0-9+/]+={0,2}$/) });
export type IconInput = z.infer<typeof IconInput>;
export const IconOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
  z.object({ kind: z.literal("workspace") }),
]);
export type IconOwner = z.infer<typeof IconOwner>;
export const iconOwnerKey = (owner: IconOwner): string => (owner.kind === "workspace" ? "workspace" : `project:${owner.projectId}`);
export const iconUrl = (owner: IconOwner, version: string): string =>
  owner.kind === "workspace" ? `/icons/workspace?v=${version}` : `/icons/project/${encodeURIComponent(owner.projectId)}?v=${version}`;

// packages/schema/src/project.ts (T20)
export const ProjectPatch = z
  .object({ name: ProjectMeta.shape.name.optional(), color: ProjectMeta.shape.color.optional(), folder: z.string().min(1).max(4096).nullable().optional() })
  .refine((p) => p.name !== undefined || p.color !== undefined || p.folder !== undefined, { message: "empty patch" });
export type ProjectPatch = z.infer<typeof ProjectPatch>;

// packages/schema/src/agent.ts (T20)
export const WorkspaceDescription = z.string().trim().max(500);
export const WorkspacePatch = z
  .object({ name: WorkspaceName.optional(), description: WorkspaceDescription.nullable().optional() })
  .refine((p) => p.name !== undefined || p.description !== undefined, { message: "empty patch" });
export type WorkspacePatch = z.infer<typeof WorkspacePatch>;
// ConfigCommand gagne  z.object({ method: z.literal("updateWorkspace"), patch: WorkspacePatch })
// ConfigResult gagne   updateWorkspace: { name: string | null; description: string | null };
// WorkspaceConfig gagne (T20) workspaceDescription: string | null ; (T21) workspaceIcon: string | null

// packages/schema/src/rpc.ts (T20)
z.object({ method: z.literal("updateProject"), projectId: z.string().min(1), patch: ProjectPatch }),
z.object({ method: z.literal("deleteProject"), projectId: z.string().min(1) }),
z.object({ method: z.literal("setIcon"), owner: IconOwner, icon: IconInput.nullable() }),
// RpcResult gagne  updateProject: ProjectMeta; deleteProject: null; setIcon: { icon: string | null };
// (T21) ProjectSummary = ProjectMeta & { counts: Record<StatusId, number>; icon?: string | null } ; ProjectSnapshot gagne icon?: string | null
```

### Core (T20)

```ts
// packages/core/src/workspace.ts
export type RegisteredProjectPatch = { name?: string; color?: string; folder?: string | null };
export function updateRegisteredProject(ws: LoroDoc, projectId: string, patch: RegisteredProjectPatch): ProjectMeta;   // NOT_FOUND si absent ; n'écrit que les champs définis ; commit
export function unregisterProject(ws: LoroDoc, projectId: string): void;                                                // NOT_FOUND si absent ; commit
// packages/core/src/project.ts
export function setProjectMeta(doc: LoroDoc, patch: RegisteredProjectPatch): ProjectMeta;   // meta.name / meta.color / meta.folder (null ⇒ set(null)) ; commit
// packages/core/src/agent-config.ts
export function workspaceDescription(ws: LoroDoc): string | null;
// executeConfigCommand › updateWorkspace : settings.name / settings.description (null ⇒ delete) ; renvoie { name, description } ; configTarget ⇒ null
```

### Démon (T21, T22)

```ts
// packages/daemon/src/icons/icon-store.ts (T21)
export type StoredIcon = { mime: IconMime; bytes: Uint8Array; sha256: string };
export type IconStore = { get(owner: string): StoredIcon | null; version(owner: string): string | null; set(owner: string, mime: IconMime, bytes: Uint8Array): string; remove(owner: string): void };
export function ensureIconsTable(db: Database): void;   // CREATE TABLE IF NOT EXISTS icons (owner TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, sha256 TEXT NOT NULL)
export function createIconStore(db: Database): IconStore;
// packages/daemon/src/icons/decode-icon.ts (T21)
export function decodeIcon(input: IconInput): { mime: IconMime; bytes: Uint8Array };   // TOO_LARGE > MAX_ICON_BYTES ; INVALID_INPUT si base64 invalide ou signature ≠ mime
export function sniffIconMime(bytes: Uint8Array): IconMime | null;                     // PNG 89 50 4E 47 0D 0A 1A 0A ; JPEG FF D8 FF ; WebP "RIFF" + "WEBP" (octets 8-11)
// packages/daemon/src/icons/icon-route.ts (T21)
export type IconRouteDeps = { icons: Pick<IconStore, "get">; origins(): string[]; hasSession(req: Request): boolean };
export function parseIconPath(pathname: string): IconOwner | null;      // /icons/workspace | /icons/project/<id>
export function serveIcon(req: Request, url: URL, deps: IconRouteDeps): Response;
// packages/daemon/src/docs.ts (T21, T22)
updateProjectMeta(projectId: string, patch: ProjectPatch, folderInDoc: boolean): ProjectMeta;   // doc (name, color, folder si folderInDoc) + copie workspace (tous) ; save des deux ; emit { projectId } puis { projectId: null }
removeProject(projectId: string): void;                        // T22 : liste workspace, Map, store.delete, save(null), listeners onProjectRemoved, emit { projectId: null }
onProjectRemoved(listener: (projectId: string) => void): () => void;   // T22
// packages/daemon/src/service.ts (T21) : Service gagne icons: IconStore (créé par createService : ensureIconsTable + createIconStore)
// packages/daemon/src/workspace-config.ts (T21) : readConfig(docs: Docs, icons: Pick<IconStore, "version">): WorkspaceConfig
// packages/daemon/src/store.ts (T22) : Store gagne delete(id: string): void
// packages/daemon/src/notes/settings.ts (T22) : ProjectSettings gagne remove(projectId: string): void
// packages/daemon/src/notes/index.ts (T22) : NotesIndex gagne clear(projectId: string): void ; notes/service.ts : NotesService gagne forget(projectId: string): void
// packages/daemon/src/projects/admin.ts (T21, T22)
export type ProjectAdminDeps = {
  docs: Docs;
  settings: ProjectSettings;
  icons: IconStore;
  store: Pick<Store, "transaction">;
  sharing(projectId: string): ProjectSyncInfo;       // collab.syncInfo
  activeRuns(projectId: string): number;             // runs non terminaux du projet
  detach(projectId: string): void;                   // T22 : client.detachProject (membre qui quitte)
  folderExists(path: string): boolean;               // défaut : statSync(path).isDirectory() sur un chemin absolu
};
export type ProjectAdmin = {
  updateProject(req: Extract<RpcRequest, { method: "updateProject" }>, ctx: RpcContext): ProjectMeta;
  setIcon(req: Extract<RpcRequest, { method: "setIcon" }>): { icon: string | null };
  deleteProject(req: Extract<RpcRequest, { method: "deleteProject" }>, ctx: RpcContext): null;   // T22
  handler: RpcHandler;
};
export function createProjectAdmin(deps: ProjectAdminDeps): ProjectAdmin;
// packages/daemon/src/server.ts (T21) : ServerOptions gagne icons?: Pick<IconStore, "get"> ; route `/icons/` avant `/api/`
// packages/daemon/src/daemon.ts (T21) : handlers: [componentTrustGuard, market.handler, collab.handler, admin.handler]
```

### Coque (T19)

```rust
// apps/desktop/src-tauri/src/main.rs
const PLAIN_PERMISSIONS: &[&str] = &["updater:default", "process:allow-restart", "core:app:allow-version", "core:window:allow-set-title", "dialog:allow-open"];
fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder   // itère PLAIN_PERMISSIONS puis opener:allow-open-url scoped https://**
```

### UI (`packages/ui`)

```ts
// desktop/pick-folder.ts (T18) — @tauri-apps/plugin-dialog, import dynamique
export async function pickFolder(defaultPath: string | null): Promise<string | null>;   // open({ directory: true, multiple: false, defaultPath? }) ; null si annulé

// dialogs/FolderField.tsx (T18)
export type FolderFieldProps = { id: string; value: string; onChange(value: string): void; placeholder?: string; describedBy?: string; canBrowse?: boolean; pick?: (current: string | null) => Promise<string | null>; autoFocus?: boolean };
export function FolderField(props: FolderFieldProps): JSX.Element;   // canBrowse défaut inTauri() ; pick défaut pickFolder ; bouton « Parcourir… » aria-label `${fr.folder.browse}` ; erreur role="alert"

// dialogs/icon-file.ts (T18)
export type IconFileRefusal = "too-large" | "format";
export class IconFileError extends Error { constructor(readonly reason: IconFileRefusal) }
export async function readIconFile(file: File): Promise<IconInput>;   // vérifie file.type ∈ ICON_MIMES et size ≤ MAX_ICON_BYTES, encode en base64
export const bytesToBase64 = (bytes: Uint8Array): string;

// dialogs/IconField.tsx (T18)
export type IconFieldProps = { label: string; currentUrl: string | null; pending: IconInput | null; onPick(icon: IconInput): void; onRemove(): void; removed: boolean };
export function IconField(props: IconFieldProps): JSX.Element;   // aperçu : pending (data URL) > currentUrl (sauf removed) > vignette vide ; input file caché, boutons « Choisir une image… » / « Retirer l'image » ; erreur role="alert"

// i18n/fr-fields.ts (T18)
export const frFields = { folder: { browse: "Parcourir…", pickFailed: "Impossible d'ouvrir le sélecteur de dossier." }, icon: { choose: "Choisir une image…", remove: "Retirer l'image", help: "PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux.", tooLarge: "Image trop lourde : 256 kB au plus.", badFormat: "Format non pris en charge : PNG, JPEG ou WebP.", readFailed: "Impossible de lire ce fichier.", preview: (label: string) => `Image · ${label}`, none: "Aucune image" } } as const;

// theme.ts (T23)
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
export function setThemePreference(preference: ThemePreference): void;   // écrit (removeItem pour system), applique, notifie
export const useThemePreference = (): ThemePreference;                    // useSyncExternalStore ; suit setThemePreference et l'événement storage

// shell/run-history.ts (T24)
export const HISTORY_STATES: readonly RunState[] = ["waiting_input", "done", "failed", "cancelled"];
export const NOTICE_STATES: readonly RunState[] = ["waiting_input", "done", "failed"];
export const runMoment = (run: RunView): number;                                      // endedAt ?? stateSince
export function runHistory(state: AgentsState, limit = 20): RunView[];               // HISTORY_STATES, tri runMoment décroissant
export function unseenCount(runs: readonly RunView[], seenAt: number): number;      // NOTICE_STATES et runMoment > seenAt
export function readSeenAt(): number;                                                // localStorage["kibo.runs.seenAt"], 0 par défaut, try/catch journalisé
export function markSeen(now: number): void;
// shell/RunHistoryButton.tsx (T24) : props { agents: AgentsState | null; notifications: Session["notifications"]; now: number; onOpenRun(runId: string): void }
// shell/RunHistoryList.tsx (T24, à la demande) : props { runs: RunView[]; now: number; notifications: Session["notifications"]; onOpenRun(runId: string): void }
// shell/UserMenu.tsx (T24) : props { viewer: string; onOpen(target: TabTarget): void } ; UserMenuContent.tsx (à la demande) : mêmes props
// shell/ShellHeader.tsx (T24) : Props gagne now: number ; onOpenRun(runId: string): void ; onOpen(target: TabTarget): void ; Shell passe now, setFocusRun, (t) => go(t)
// i18n/fr.ts › header (T24) : runHistory: "Historique des runs", unseen: (n: number) => `${n} nouveau${n > 1 ? "x" : ""}`, userMenu: (user: string) => `Menu de ${user}`, theme: "Thème", sessions: "Sessions", settings: "Paramètres", account: (name: string, host: string) => `${name} · ${host}`

// settings/shortcuts.ts (T25)
export type ShortcutItem = { label: string; keys: string[]; range?: boolean };
export type ShortcutGroup = { title: string; items: ShortcutItem[] };
export function shortcutGroups(mac: boolean): ShortcutGroup[];
// settings/ShortcutsPage.tsx (T25) : sans props ; Screen "shortcuts", hash "#/settings/shortcuts"
// mine/my-tickets.ts (T25) : MineTab = "assigned" | "agents"

// settings/WorkspacePage.tsx (T26) : props { config: WorkspaceConfig | null } ; Screen "workspace", hash "#/settings/workspace"
// shell/WorkspaceSwitcher.tsx (T26) : props { name: string; icon: string | null; onSettings(): void }   (onRename retirée)
// shell/WorkspaceMark.tsx (T26) : WorkspaceTile props { size: "sm" | "md"; src?: string | null; alt?: string }
// shell/AppSidebar.tsx (T26) : Props perd onRenameWorkspace, gagne workspaceIcon: string | null ; (T27) gagne onEditProject(projectId: string): void, onDeleteProject(projectId: string): void

// lib/project-colors.ts (T27)
export const PROJECT_COLORS = ["#14B8A6", "#6366F1", "#EC4899", "#84CC16", "#D946EF", "#64748B"] as const;   // sorti de NewProjectDialog (COLORS)
// shell/project-menu.ts (T27)
export type ProjectMenuActions = { newPage(): void; share(): void; edit(): void; remove(): void };
export type ProjectMenuTexts = { newPage: string; share: string; edit: string; remove: string };
export function projectMenuEntries(input: { editable: boolean; texts: ProjectMenuTexts; actions: ProjectMenuActions }): MenuEntry[];
// shell/ShareControls.tsx (T27) : ProjectMenu props { name: string; current: boolean; shifted: boolean; entries: readonly MenuEntry[] }
// shell/ShellDialogs.tsx (T27) : DialogsState gagne editProject: string | null ; deleteProject: string | null
// dialogs/EditProjectDialog.tsx (T27) : props { project: ProjectSummary; onClose(): void }
// dialogs/DeleteProjectDialog.tsx (T27) : props { project: ProjectSummary; snapshot: ProjectSnapshot | null; activeRuns: number; onClose(): void; onDeleted(projectId: string): void; onOpenAgents(): void; onShare(): void }
// tabs/tabs-model.ts (T27) : TabsAction gagne { type: "closeProject"; projectId: string }   (ferme même les onglets épinglés, purge recents)
```

## Vagues d'exécution

Une vague démarre quand toutes les tâches dont elle dépend sont intégrées dans `phase/9`. Dans une vague, chaque tâche a son worktree `.claude/worktrees/p9-t<n>` et sa branche `feat/p9-t<n>` ; le chef d'équipe lance tous les `kibo-dev` de la vague en parallèle et intègre ensuite **dans l'ordre du tableau**, en rebasant chaque branche sur la précédente (les conflits listés sont des ajouts de quelques lignes). Après chaque intégration d'une tâche UI : `bun run budget`.

| Vague | Tâches en parallèle | Dépendances (tâche ← tâches) | Fichiers partagés dans la vague | Écrans |
|---|---|---|---|---|
| 0 | T17 (chef d'équipe), T19, T20, T23, T25 | aucune (spec §14 écrite) | T19 = `apps/desktop/src-tauri` seul ; T20 = `packages/schema`, `packages/core`, `daemon/workspace-config.ts` (description), `ui/agents/fixtures.ts` (une ligne) ; T23 = `theme.ts`, `settings/AppearancePage`, `SecurityPage`, `WebAccessCard`, `fr-security.ts`, `fr.ts › pairing` ; T25 = `schema/tabs.ts`, `target-hash`, `screens`, `CommandPalette`, `AppSidebar` (`SETTINGS_SCREENS`), `SettingsNav`, `ScreenView`, `GeneralPage`, `MyTicketsPage`, `my-tickets.ts`, `NewProjectForm`, `CommitPanel`, `fr.ts`, `fr-code.ts` | T17 dessine 107–112 ; T23 : 110 ; T25 : 77, 76 amendé |
| 0 bis | T18 | T18 ← T20 (`ICON_MIMES`, `MAX_ICON_BYTES`, `IconInput`) : démarre dès l'intégration de T20, sans attendre la fin de la vague 0 | `bundle-report.ts` et `lazy-screens.ts` (T25 dans la même période : une regex et une ligne chacune, **T18 avant T25**) ; `NewProjectForm.tsx` (T25 retire « Depuis un projet » : **T18 avant T25**) | — |
| 1 | T21, T24, T26 | T21 ← T20 · T24 ← T23 (thème), T18 (budget) · T26 ← T18 (`IconField`), T20 (`updateWorkspace`), T25 (tables des écrans : **T26 après T25**) | T24 = `ShellHeader.tsx`, `Shell.tsx` (props `now`, `onOpenRun`, `onOpen`), `NotifyButton.tsx`, `lazy-screens.ts`, `fr.ts › header` ; T26 = `AppSidebar.tsx`, `Shell.tsx` (`workspaceIcon`, retrait de `renameWorkspace`), `WorkspaceSwitcher`, `WorkspaceMark`, `lazy-dialogs.ts`, `lazy-screens.ts`, `fr.ts › workspace`, tables des écrans, schéma/core/démon (`renameWorkspace` retirée) : **T24 puis T26** (`Shell.tsx`, `lazy-screens.ts` : quelques lignes) ; T21 = `packages/daemon/src/{icons,projects}`, `docs.ts`, `service.ts`, `server.ts`, `daemon.ts`, `workspace-config.ts`, `schema/rpc.ts` (`icon?`), `schema/agent.ts` (`workspaceIcon`) : aucun recouvrement UI | T24 : 111, 112 · T26 : 109 |
| 2 | T22, T27 | T22 ← T21 · T27 ← T18, T20, T26 (`AppSidebar`, `Shell.tsx`, `lazy-dialogs.ts` déjà remaniés), T24 (`ShellHeader` props) | T22 = démon seul (`projects/admin.ts`, `docs.ts`, `service.ts`, `store.ts`, `notes/*`, `components/service.ts`, `collab/project-hosts.ts`, `daemon.ts`) ; T27 = UI seule (`project-menu.ts`, `ShareControls`, `AppSidebar`, `ShellDialogs`, `Shell.tsx`, `lazy-dialogs.ts`, dialogues, `tabs-model.ts`, `NewProjectDialog.tsx` (couleurs), `fr-project.ts`, `bundle-report.ts`) | T27 : 107, 108 |
| 3 | T28 | T28 ← T21, T22, T23, T24, T25, T26, T27 | `e2e/playwright.config.ts` (T28 seul) | — |
| Jalon partiel | `bun run budget`, contrôle visuel 107–112 (et 77, 110) sombre et clair, rapport de vague au chef d'équipe | tout | — | toutes |

Ordre d'intégration : vague 0 : T20, T19, T23, puis T18 dès qu'elle est acceptée, puis T25 (T17 quand elle est prête) ; vague 1 : T21, T24, T26 ; vague 2 : T22, T27 ; vague 3 : T28. Tâches à risque relues aussi par `kibo-lead` : **T19** (capacité IPC), **T21** (validation d'images, route HTTP hors `/api/`, dossier réservé à la machine), **T22** (suppression, projet partagé), **T27** (confirmation par saisie du nom, fermeture des onglets).

Chemin critique : T20 → T21 → T22 → T28 (4 vagues) ; en parallèle, T18 → T26 → T27 → T28 et T23 → T24 → T28. Vérification locale de la coque (T19) : `cargo test` après `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts` et `bun apps/desktop/scripts/build-toolchain.ts` ; le `desktop-smoke` de la CI fait foi pour Linux.

---

### Task 17: Maquettes Penpot des écrans 107 à 112

Vague 0, chef d'équipe (ou `kibo-lead`), sans code de production. Flux : `design/penpot/README.md` (Penpot local `docker compose -p kibo-penpot up -d`, `xz -dk kibo.penpot.xz`, scripts chargés par `storage.load` via `receiver.py`, `S.draw[n]()` puis `S.retext`, export `storage.exportPage("14")`, `scripts/build-pdf.sh`, `scripts/pack-penpot.sh`). Si l'édition Penpot n'est pas possible depuis un agent, **ne pas bloquer la vague** : cocher la tâche comme « écart assumé », le noter au rapport du jalon, et les tâches UI suivent les descriptions de « Écrans à dessiner ». Ne pas exporter de planche entière en PNG par `export_shape` (Chrome se fige, leçon de T1).

**Files:**
- Create: `design/penpot/scripts/18-projets-reglages.js` (en-tête `// Page « 14 · Finitions UI » : écrans 107 à 112 (phase 9, plan kibo-phase-9-vague-2).`, `S.draw[107]` à `S.draw[112]`, chacun en sombre puis `S.relight` pour la variante `… (clair)`, rangée `row` = 9 + (n − 107) pour ne pas chevaucher 98–106)
- Modify: `design/penpot/README.md` (ligne « 14 · Finitions UI | 98–112 » dans le tableau des pages ; `storage.exportPage("14")` dans la liste d'export)
- Modify: `design/penpot/kibo.penpot.xz`, `design/pdf/kibo-design-sombre.pdf`, `design/pdf/kibo-design-clair.pdf`

**Interfaces:**
- Consumes: `S.screenX` (shell reconstruit, `08-extra.js`), `menu`, `confirm` (`17-finitions.js`), `settings`, `head`, `block`, `line`, `kbd` (`15-complements.js`, à recopier dans le nouveau script : un script n'importe pas l'autre), `S.avatar`, `S.C`, `S.txt`, `S.box`, `S.toggle`, `S.button`, jeu de données `07-data.js`.
- Produces: écrans 107 à 112 cités par T23, T24, T26, T27.

- [ ] **Step 1: Écrire `18-projets-reglages.js`** avec un `S.draw[n]` par écran de la liste « Écrans à dessiner », textes **mot pour mot** (ils sont recopiés dans les fichiers `fr-*.ts` des tâches), composants shadcn (menu contextuel : fond `card`, bordure `border`, entrée destructive en rouge `destructive`, séparateur ; Dialog centré avec voile ; segmenté `ToggleGroup` : fond `muted`, segment actif fond `background` ; champ mono pour les chemins ; pastilles de couleur carrées 16 px, cochée par un anneau `ring`).

- [ ] **Step 2: Dessiner et exporter.** Charger `01` à `08` puis `18-projets-reglages.js`, appeler `S.draw[107]()` … `S.draw[112]()` (moins de 120 s par appel), `S.retext`, puis `storage.exportPage("14")`, `scripts/build-pdf.sh` (ajouter les pages par `pdfunite` si l'export complet est périmé), `scripts/pack-penpot.sh`.

- [ ] **Step 3: Vérifier** dans `design/pdf/kibo-design-clair.pdf` que chaque écran a sa variante claire et que l'orange n'apparaît qu'en marque, agents et couleur du projet Kibo.

- [ ] **Step 4: Commit**

```bash
git add design/penpot/scripts/18-projets-reglages.js design/penpot/README.md design/penpot/kibo.penpot.xz design/pdf/kibo-design-sombre.pdf design/pdf/kibo-design-clair.pdf
git commit -m "docs(design): écrans 107 à 112, projets et réglages"
```

---

### Task 18: Socle UI : budget mesuré, sélecteur de dossier, champ image

Vague 0 bis (← T20). Décision 2, spec §14.6. Trois briques hors de l'entrée que les dialogues de la vague partagent : `pickFolder` (plugin Tauri, import dynamique), `FolderField` (champ + « Parcourir… » dans la fenêtre Tauri seulement) et `IconField` (aperçu, choisir, retirer, refus avant envoi d'un fichier trop lourd ou d'un autre format). Les trois dialogues qui saisissent un chemin à la main (Nouveau projet, Dossier des notes, Rejoindre) passent à `FolderField`. La tâche **mesure le budget avant et après** et réduit le chargement initial si la marge est inférieure à 4 kB.

**Files:**
- Modify: `packages/ui/package.json`, `bun.lock` (`@tauri-apps/plugin-dialog`)
- Create: `packages/ui/src/desktop/pick-folder.ts`, `packages/ui/src/desktop/pick-folder.test.ts`
- Create: `packages/ui/src/i18n/fr-fields.ts`
- Create: `packages/ui/src/dialogs/FolderField.tsx`, `packages/ui/src/dialogs/folder-field.test.tsx`
- Create: `packages/ui/src/dialogs/icon-file.ts`, `packages/ui/src/dialogs/icon-file.test.ts`, `packages/ui/src/dialogs/IconField.tsx`, `packages/ui/src/dialogs/icon-field.test.tsx`
- Modify: `packages/ui/src/dialogs/NewProjectForm.tsx:58-69`, `packages/ui/src/dialogs/NotesDirDialog.tsx:55-60`, `packages/ui/src/dialogs/JoinProjectDialog.tsx:80-97`
- Modify: `packages/ui/scripts/bundle-report.ts` (`FORBIDDEN_IN_ENTRY`)
- Modify (seulement si le budget l'exige, Step 9) : `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/src/shell/ShellHeader.tsx`

**Interfaces:**
- Consumes: `ICON_MIMES`, `MAX_ICON_BYTES`, `IconInput`, `IconMime` (`@kibo/schema`, T20, intégrée avant le démarrage de T18), `inTauri` (`shell/workspace-actions.ts`), `Button`, `Input`.
- Produces: `pickFolder`, `FolderField`, `IconField`, `readIconFile`, `iconDataUrl`, `IconFileError`, `frFields` (contrats « UI »).

- [ ] **Step 1: Mesure de départ**

Run: `bun install --frozen-lockfile && bun run budget`
Expected: `gzip : 227,3 kB (budget 230,0 kB)` (à 0,3 kB près). Noter la valeur exacte pour le rapport.

- [ ] **Step 2: Dépendance**

Run: `bun add --cwd packages/ui @tauri-apps/plugin-dialog@2`
Expected: `packages/ui/package.json` gagne `"@tauri-apps/plugin-dialog": "2.x.y"` (version exacte, `bunfig` `exact = true`), `bun.lock` mis à jour, aucun `postinstall`. Vérifier que la version dépend de `@tauri-apps/api ^2.12` ou moins (`grep -A3 'plugin-dialog@' bun.lock`).

```bash
git add packages/ui/package.json bun.lock
git commit -m "build(ui): plugin dialog de Tauri"
```

- [ ] **Step 3: `pickFolder` (test rouge puis vert)**

`packages/ui/src/desktop/pick-folder.test.ts` :
```ts
import { expect, mock, test } from "bun:test";

const open = mock(async (_opts: unknown): Promise<string | string[] | null> => "/Users/adam/code/kibo");
mock.module("@tauri-apps/plugin-dialog", () => ({ open }));
const { pickFolder } = await import("./pick-folder");

test("asks the native dialog for one directory, starting from the current folder", async () => {
  expect(await pickFolder("/Users/adam")).toBe("/Users/adam/code/kibo");
  expect(open).toHaveBeenLastCalledWith({ directory: true, multiple: false, defaultPath: "/Users/adam" });
});

test("a cancelled dialog gives null, and no default path is sent when none is known", async () => {
  open.mockImplementationOnce(async () => null);
  expect(await pickFolder(null)).toBeNull();
  expect(open).toHaveBeenLastCalledWith({ directory: true, multiple: false });
});
```
Run: `bun test packages/ui/src/desktop/pick-folder.test.ts` — Expected: FAIL (module introuvable).

`packages/ui/src/desktop/pick-folder.ts` :
```ts
export async function pickFolder(defaultPath: string | null): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, ...(defaultPath !== null && { defaultPath }) });
  return typeof picked === "string" ? picked : null;
}
```
Run: `bun test packages/ui/src/desktop/pick-folder.test.ts` — Expected: PASS, 2 tests.

- [ ] **Step 4: Textes**

`packages/ui/src/i18n/fr-fields.ts` (importé directement par les champs, jamais monté dans `fr.ts`) :
```ts
export const frFields = {
  folder: {
    browse: "Parcourir…",
    pickFailed: "Impossible d'ouvrir le sélecteur de dossier.",
  },
  icon: {
    choose: "Choisir une image…",
    remove: "Retirer l'image",
    help: "PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux.",
    tooLarge: "Image trop lourde : 256 kB au plus.",
    badFormat: "Format non pris en charge : PNG, JPEG ou WebP.",
    readFailed: "Impossible de lire ce fichier.",
    preview: (label: string) => `Image · ${label}`,
    none: "Aucune image",
  },
} as const;
```

- [ ] **Step 5: `FolderField` (test rouge puis vert)**

`packages/ui/src/dialogs/folder-field.test.tsx` :
```tsx
import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FolderField } from "./FolderField";

type Pick = (current: string | null) => Promise<string | null>;

function Harness({ pick, canBrowse }: { pick: Pick; canBrowse: boolean }) {
  const [value, setValue] = useState("/tmp/a");
  return (
    <>
      <label htmlFor="f">Dossier</label>
      <FolderField id="f" value={value} onChange={setValue} canBrowse={canBrowse} pick={pick} />
    </>
  );
}
const field = () => screen.getByLabelText("Dossier") as HTMLInputElement;

test("Parcourir… fills the field with the picked folder, starting from the current value", async () => {
  const pick = mock(async (_current: string | null): Promise<string | null> => "/Users/adam/code/kibo");
  render(<Harness pick={pick} canBrowse />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Parcourir…" }));
  expect(pick).toHaveBeenCalledWith("/tmp/a");
  expect(field().value).toBe("/Users/adam/code/kibo");
});

test("a cancelled picker keeps the value and a failing one is explained", async () => {
  const pick = mock(async (_current: string | null): Promise<string | null> => null);
  render(<Harness pick={pick} canBrowse />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Parcourir…" }));
  expect(field().value).toBe("/tmp/a");
  pick.mockImplementationOnce(async () => {
    throw new Error("no dialog");
  });
  const log = console.error;
  console.error = () => {};
  try {
    await user.click(screen.getByRole("button", { name: "Parcourir…" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ouvrir le sélecteur de dossier.");
  } finally {
    console.error = log;
  }
});

test("the field stays editable by hand and there is no browse button outside the desktop app", async () => {
  render(<Harness pick={async () => null} canBrowse={false} />);
  expect(screen.queryByRole("button", { name: "Parcourir…" })).toBeNull();
  await userEvent.setup().type(field(), "/b");
  expect(field().value).toBe("/tmp/a/b");
});
```
Run: `bun test packages/ui/src/dialogs/folder-field.test.tsx` — Expected: FAIL.

`packages/ui/src/dialogs/FolderField.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { pickFolder } from "../desktop/pick-folder";
import { frFields } from "../i18n/fr-fields";
import { inTauri } from "../shell/workspace-actions";

export type FolderFieldProps = {
  id: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  describedBy?: string;
  canBrowse?: boolean;
  pick?: (current: string | null) => Promise<string | null>;
  autoFocus?: boolean;
};

export function FolderField({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  canBrowse = inTauri(),
  pick = pickFolder,
  autoFocus = false,
}: FolderFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const browse = async () => {
    setError(null);
    try {
      const picked = await pick(value.trim() || null);
      if (picked !== null) onChange(picked);
    } catch (e) {
      console.error(e);
      setError(frFields.folder.pickFailed);
    }
  };
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          className="font-mono"
        />
        {canBrowse && (
          <Button type="button" variant="outline" onClick={() => void browse()}>
            <FolderOpen aria-hidden />
            {frFields.folder.browse}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```
Run: `bun test packages/ui/src/dialogs/folder-field.test.tsx` — Expected: PASS, 3 tests.

- [ ] **Step 6: Lecture d'un fichier image (test rouge puis vert)**

`packages/ui/src/dialogs/icon-file.test.ts` :
```ts
import { expect, test } from "bun:test";
import { MAX_ICON_BYTES } from "@kibo/schema";
import { bytesToBase64, iconDataUrl, readIconFile } from "./icon-file";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("a small png is encoded in base64 with its mime", async () => {
  const icon = await readIconFile(new File([PNG], "logo.png", { type: "image/png" }));
  expect(icon).toEqual({ mime: "image/png", data: "iVBORw0KGgo=" });
  expect(iconDataUrl(icon)).toBe("data:image/png;base64,iVBORw0KGgo=");
});

test("a file over 256 kB or of another type is refused before reading", async () => {
  const big = new File([new Uint8Array(MAX_ICON_BYTES + 1)], "big.png", { type: "image/png" });
  await expect(readIconFile(big)).rejects.toMatchObject({ reason: "too-large" });
  const svg = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
  await expect(readIconFile(svg)).rejects.toMatchObject({ reason: "format" });
});

test("base64 encoding works beyond one 32 kB chunk", () => {
  const bytes = new Uint8Array(70_000).fill(65);
  expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
});
```
Run: `bun test packages/ui/src/dialogs/icon-file.test.ts` — Expected: FAIL.

`packages/ui/src/dialogs/icon-file.ts` :
```ts
import { ICON_MIMES, type IconInput, type IconMime, MAX_ICON_BYTES } from "@kibo/schema";

export type IconFileRefusal = "too-large" | "format";

export class IconFileError extends Error {
  constructor(readonly reason: IconFileRefusal) {
    super(reason);
    this.name = "IconFileError";
  }
}

const isIconMime = (type: string): type is IconMime => (ICON_MIMES as readonly string[]).includes(type);

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function readIconFile(file: File): Promise<IconInput> {
  if (!isIconMime(file.type)) throw new IconFileError("format");
  if (file.size > MAX_ICON_BYTES) throw new IconFileError("too-large");
  return { mime: file.type, data: bytesToBase64(new Uint8Array(await file.arrayBuffer())) };
}

export const iconDataUrl = (icon: IconInput): string => `data:${icon.mime};base64,${icon.data}`;
```
Run: `bun test packages/ui/src/dialogs/icon-file.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 7: `IconField` (test rouge puis vert)**

`packages/ui/src/dialogs/icon-field.test.tsx` :
```tsx
import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconField } from "./IconField";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const show = (p: Partial<Parameters<typeof IconField>[0]> = {}) => {
  const onPick = mock((_icon: { mime: string; data: string }) => {});
  const onRemove = mock(() => {});
  render(
    <IconField label="Kibo" currentUrl={null} pending={null} removed={false} onPick={onPick} onRemove={onRemove} {...p} />,
  );
  return { onPick, onRemove, user: userEvent.setup() };
};

test("choosing a png hands the encoded icon to the parent", async () => {
  const { onPick, user } = show();
  expect(screen.getByRole("img", { name: "Aucune image" })).toBeTruthy();
  await user.upload(screen.getByLabelText("Choisir une image…"), new File([PNG], "logo.png", { type: "image/png" }));
  expect(onPick).toHaveBeenCalledWith({ mime: "image/png", data: "iVBORw0KGgo=" });
});

test("a refused file is explained and nothing is handed over", async () => {
  const { onPick, user } = show();
  await user.upload(screen.getByLabelText("Choisir une image…"), new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Format non pris en charge : PNG, JPEG ou WebP.");
  expect(onPick).not.toHaveBeenCalled();
});

test("the preview shows the pending image first, then the current one, and Retirer asks the parent", async () => {
  const { onRemove, user } = show({ currentUrl: "/icons/project/p1?v=abc", pending: { mime: "image/png", data: "iVBORw0KGgo=" } });
  expect(screen.getByRole("img", { name: "Image · Kibo" }).getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgo=");
  await user.click(screen.getByRole("button", { name: "Retirer l'image" }));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("a removed image shows the empty tile even when the server still has one", () => {
  show({ currentUrl: "/icons/project/p1?v=abc", removed: true });
  expect(screen.getByRole("img", { name: "Aucune image" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retirer l'image" })).toBeNull();
});
```
Run: `bun test packages/ui/src/dialogs/icon-field.test.tsx` — Expected: FAIL.

`packages/ui/src/dialogs/IconField.tsx` :
```tsx
import type { IconInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { frFields } from "../i18n/fr-fields";
import { IconFileError, iconDataUrl, readIconFile } from "./icon-file";

export type IconFieldProps = {
  label: string;
  currentUrl: string | null;
  pending: IconInput | null;
  removed: boolean;
  onPick(icon: IconInput): void;
  onRemove(): void;
};

const t = frFields.icon;
const refusalText = (e: unknown): string =>
  e instanceof IconFileError ? (e.reason === "too-large" ? t.tooLarge : t.badFormat) : t.readFailed;

export function IconField({ label, currentUrl, pending, removed, onPick, onRemove }: IconFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const src = pending ? iconDataUrl(pending) : removed ? null : currentUrl;
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onPick(await readIconFile(file));
    } catch (e) {
      if (!(e instanceof IconFileError)) console.error(e);
      setError(refusalText(e));
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        {src ? (
          <img src={src} alt={t.preview(label)} className="size-12 rounded-md border object-cover" />
        ) : (
          <span
            role="img"
            aria-label={t.none}
            className="grid size-12 place-items-center rounded-md border bg-muted text-muted-foreground"
          >
            <ImagePlus aria-hidden className="size-5" />
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label={t.choose}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          {t.choose}
        </Button>
        {src && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden />
            {t.remove}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t.help}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```
Run: `bun test packages/ui/src/dialogs/icon-field.test.tsx` — Expected: PASS, 4 tests. (Si `e.target.value = ""` lève sous happy-dom, le remplacer par `if (input.current) input.current.value = ""` dans un `try` qui journalise : le rejet d'un fichier doit laisser le champ prêt pour le suivant.)

- [ ] **Step 8: Les trois dialogues passent à `FolderField`**

`packages/ui/src/dialogs/NewProjectForm.tsx` (l. 58-69) : remplacer le `<Input id={\`${id}-folder\`} …/>` par
```tsx
        <FolderField
          id={`${id}-folder`}
          value={p.fields.folder}
          onChange={(folder) => p.onFields({ folder })}
          autoFocus={p.focusFolder}
          placeholder="/Users/adam/code/kibo"
          describedBy={`${id}-folder-help`}
        />
        <p id={`${id}-folder-help`} className="text-xs text-muted-foreground">
          {fr.newProject.folderHelp}
        </p>
```
(import `FolderField` de `./FolderField` ; `Input` reste importé pour le nom et la clé).

`packages/ui/src/dialogs/NotesDirDialog.tsx` (l. 57-60) : `<FolderField id={id} value={dir} onChange={setDir} />` à la place de l'`Input` (retirer l'import `Input` s'il devient inutilisé).

`packages/ui/src/dialogs/JoinProjectDialog.tsx` (l. 80-97) : remplacer le `div.relative` (icône `Folder` + `Input`) par `<FolderField id={folderId} value={folder} onChange={setFolder} describedBy={folderHelpId} />` ; retirer l'import `Folder` de lucide.

Run: `bun test packages/ui/src/dialogs packages/ui/src/shell` — Expected: PASS (les tests existants trouvent toujours « Dossier du projet », « Dossier local » et le champ des notes par leur libellé ; aucun bouton « Parcourir… » hors Tauri).

- [ ] **Step 9: Budget : interdictions, mesure, réduction si nécessaire**

`packages/ui/scripts/bundle-report.ts`, ajouter à `FORBIDDEN_IN_ENTRY` :
```ts
  /\/packages\/ui\/src\/(desktop\/pick-folder\.ts|dialogs\/(FolderField|IconField)\.tsx|dialogs\/icon-file\.ts|i18n\/fr-fields\.ts)$/,
```
Run: `bun run budget` — Expected: aucun module interdit ; valeur ≤ 227,3 kB (rien de nouveau n'entre dans l'entrée).

**Si la valeur dépasse 226,0 kB** (marge < 4 kB, insuffisante pour T23 et T24), sortir `ScreenActions` de l'entrée : dans `shell/lazy-screens.ts`
```ts
export const ScreenActions = lazyPanel(
  () => import("./ScreenActions").then((m) => m.ScreenActions),
  fr.lazy,
  { fallback: "sr-only" },
);
```
`ShellHeader.tsx` importe `ScreenActions` de `./lazy-screens` au lieu de `./ScreenActions` ; regex ajoutée : `/\/packages\/ui\/src\/(shell\/ScreenActions|agents\/PauseAdmission)\.tsx$/`. Les tests qui cherchent « Nouveau profil » ou « Mettre en pause l'admission » dans l'en-tête passent à `findByRole` (`agents-shell.test.tsx:218-227`). Mesurer de nouveau ; si toujours > 226,0 kB, le signaler au chef d'équipe **avant** de continuer (candidat suivant, décidé par le lead : le contenu du menu contextuel des onglets, `tabs/TabBar.tsx`).

- [ ] **Step 10: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; noter la valeur finale du budget dans le rapport.

```bash
git add packages/ui/src/desktop/pick-folder.ts packages/ui/src/desktop/pick-folder.test.ts packages/ui/src/i18n/fr-fields.ts packages/ui/src/dialogs/FolderField.tsx packages/ui/src/dialogs/folder-field.test.tsx packages/ui/src/dialogs/icon-file.ts packages/ui/src/dialogs/icon-file.test.ts packages/ui/src/dialogs/IconField.tsx packages/ui/src/dialogs/icon-field.test.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): champs dossier et image partagés"
git add packages/ui/src/dialogs/NewProjectForm.tsx packages/ui/src/dialogs/NotesDirDialog.tsx packages/ui/src/dialogs/JoinProjectDialog.tsx
git commit -m "feat(ui): sélecteur de dossier dans les dialogues"
```
(Troisième commit `perf(ui): actions d'écran à la demande` avec `lazy-screens.ts`, `ShellHeader.tsx`, `agents-shell.test.tsx`, `bundle-report.ts` si le Step 9 l'a exigé.)

---

### Task 19: Coque : plugin dialog et permission `dialog:allow-open`

Vague 0. Spec §14.6, spec I §3.7 (amendée). La coque enregistre `tauri-plugin-dialog` et accorde à l'origine du démon la seule permission `dialog:allow-open` ; la liste des permissions simples devient une constante testée. Rien d'autre ne change (menu, fenêtre, navigation : T4, T4b).

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml` (`[dependencies]`), `apps/desktop/src-tauri/Cargo.lock`
- Modify: `apps/desktop/src-tauri/src/main.rs:62-90` (`daemon_capability`, plugins), `mod tests`

**Interfaces:**
- Consumes: `CapabilityBuilder` (`tauri::ipc`), `OpenUrlScope` (existant), `ipc_origin` (T4).
- Produces: `PLAIN_PERMISSIONS: &[&str]` (contrat « Coque »).

- [ ] **Step 1: Test rouge**

Dans `mod tests` de `main.rs`, ajouter :
```rust
    #[test]
    fn plain_permissions_are_the_documented_set() {
        assert_eq!(
            PLAIN_PERMISSIONS,
            &[
                "updater:default",
                "process:allow-restart",
                "core:app:allow-version",
                "core:window:allow-set-title",
                "dialog:allow-open",
            ]
        );
    }

    #[test]
    fn dialog_permission_is_open_only() {
        let dialog: Vec<&&str> = PLAIN_PERMISSIONS
            .iter()
            .filter(|p| p.starts_with("dialog:"))
            .collect();
        assert_eq!(dialog, vec![&"dialog:allow-open"]);
    }
```
Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — Expected: FAIL (`PLAIN_PERMISSIONS` introuvable). (Prérequis des binaires du sidecar : `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts`, `bun apps/desktop/scripts/build-toolchain.ts`.)

- [ ] **Step 2: Dépendance et plugin**

`Cargo.toml`, `[dependencies]` : ajouter `tauri-plugin-dialog = "2"` après `tauri-plugin-window-state`.
Run: `~/.cargo/bin/cargo metadata --manifest-path apps/desktop/src-tauri/Cargo.toml --format-version 1 > /dev/null` — Expected: `Cargo.lock` gagne `tauri-plugin-dialog` (et ses dépendances `rfd`…), rien d'autre ne change de version.

`main.rs`, dans `main()` après `.plugin(tauri_plugin_window_state::…)` : `.plugin(tauri_plugin_dialog::init())`.

- [ ] **Step 3: Capacité (vert)**

Remplacer `daemon_capability` par :
```rust
const PLAIN_PERMISSIONS: &[&str] = &[
    "updater:default",
    "process:allow-restart",
    "core:app:allow-version",
    "core:window:allow-set-title",
    "dialog:allow-open",
];

fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder {
    let mut capability = CapabilityBuilder::new("daemon")
        .window("main")
        .local(false)
        .remote(ipc_origin(daemon_url));
    for permission in PLAIN_PERMISSIONS {
        capability = capability.permission(*permission);
    }
    capability.permission_scoped(
        "opener:allow-open-url",
        vec![OpenUrlScope::https()],
        Vec::<OpenUrlScope>::new(),
    )
}
```
Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — Expected: PASS (11 tests, dont `opener_scope_is_https_only` inchangé).

- [ ] **Step 4: Gate et commit**

Run: `~/.cargo/bin/cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml && ~/.cargo/bin/cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings && bun run check` — Expected: PASS. Le `desktop-smoke` de la CI fait foi pour Linux (le plugin dialog compile avec GTK, dépendance déjà présente).

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): sélecteur de dossier natif"
```

---

### Task 20: Schéma et core : patch de projet, images, workspace

Vague 0. Spec §14.1, §14.2, §14.4. Les contrats Zod des quatre opérations et les fonctions pures du domaine : mise à jour et retrait d'un projet dans la liste du workspace, écriture de `meta` d'un doc projet, nom et description du workspace. `renameWorkspace` **reste** jusqu'à T26 (décision 8). `WorkspaceConfig` gagne `workspaceDescription` : `readConfig` du démon et la fixture de l'UI suivent (deux lignes chacune) pour que la vague reste verte.

**Files:**
- Create: `packages/schema/src/icon.ts`, `packages/schema/src/icon.test.ts`
- Modify: `packages/schema/src/project.ts`, `packages/schema/src/agent.ts:80-126`, `packages/schema/src/rpc.ts:69-204`, `packages/schema/src/index.ts`
- Test: `packages/schema/src/project.test.ts` (créer s'il n'existe pas), `packages/schema/src/agent.test.ts` (idem)
- Modify: `packages/core/src/workspace.ts`, `packages/core/src/project.ts`, `packages/core/src/agent-config.ts:33-36,187-193`
- Test: `packages/core/src/project.test.ts` (`describe("workspace")`, `describe("project meta")`), `packages/core/src/agent-config.test.ts:195-210`
- Modify: `packages/daemon/src/workspace-config.ts:25-36`, `packages/daemon/src/service.test.ts:163-190`, `packages/ui/src/agents/fixtures.ts:264`

**Interfaces:**
- Consumes: `ProjectMeta`, `WorkspaceName`, `settingsMap`, `valid`, `requireWorkspace` (`core/config-store.ts`), `LoroList`, `LoroMap`.
- Produces: tout le contrat « Schéma (T20) » et « Core (T20) » ; `WorkspaceConfig.workspaceDescription`.

- [ ] **Step 1: Schéma des images (test rouge puis vert)**

`packages/schema/src/icon.test.ts` :
```ts
import { expect, test } from "bun:test";
import { IconInput, IconOwner, iconOwnerKey, iconUrl, MAX_ICON_BASE64 } from "./icon";

test("an icon input is a known mime and standard base64 within the size bound", () => {
  expect(IconInput.safeParse({ mime: "image/png", data: "iVBORw0KGgo=" }).success).toBe(true);
  expect(IconInput.safeParse({ mime: "image/svg+xml", data: "PHN2Zy8+" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "not base64!" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "A".repeat(MAX_ICON_BASE64 + 4) }).success).toBe(false);
});

test("owners map to a storage key and a versioned url", () => {
  const project = IconOwner.parse({ kind: "project", projectId: "p1" });
  expect(iconOwnerKey(project)).toBe("project:p1");
  expect(iconOwnerKey({ kind: "workspace" })).toBe("workspace");
  expect(iconUrl(project, "abc")).toBe("/icons/project/p1?v=abc");
  expect(iconUrl({ kind: "workspace" }, "abc")).toBe("/icons/workspace?v=abc");
});
```
Run: `bun test packages/schema/src/icon.test.ts` — Expected: FAIL.

`packages/schema/src/icon.ts` :
```ts
import { z } from "zod";

export const ICON_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IconMime = z.enum(ICON_MIMES);
export type IconMime = z.infer<typeof IconMime>;
export const MAX_ICON_BYTES = 256 * 1024;
export const MAX_ICON_BASE64 = 350_000;

export const IconInput = z.object({
  mime: IconMime,
  data: z
    .string()
    .min(1)
    .max(MAX_ICON_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type IconInput = z.infer<typeof IconInput>;

export const IconOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
  z.object({ kind: z.literal("workspace") }),
]);
export type IconOwner = z.infer<typeof IconOwner>;

export const iconOwnerKey = (owner: IconOwner): string =>
  owner.kind === "workspace" ? "workspace" : `project:${owner.projectId}`;

export const iconUrl = (owner: IconOwner, version: string): string =>
  owner.kind === "workspace"
    ? `/icons/workspace?v=${version}`
    : `/icons/project/${encodeURIComponent(owner.projectId)}?v=${version}`;
```
`packages/schema/src/index.ts` : ajouter `export * from "./icon";` (ordre alphabétique, après `./github-graphql`).
Run: `bun test packages/schema/src/icon.test.ts` — Expected: PASS, 2 tests.

- [ ] **Step 2: Patchs de projet et de workspace (tests rouges puis verts)**

`packages/schema/src/project.test.ts` (nouveau) :
```ts
import { expect, test } from "bun:test";
import { ProjectPatch } from "./project";

test("a project patch carries at least one field and validates each", () => {
  expect(ProjectPatch.safeParse({}).success).toBe(false);
  expect(ProjectPatch.safeParse({ name: "  Kibo  " }).data).toEqual({ name: "Kibo" });
  expect(ProjectPatch.safeParse({ name: "   " }).success).toBe(false);
  expect(ProjectPatch.safeParse({ color: "orange" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ folder: null }).data).toEqual({ folder: null });
  expect(ProjectPatch.safeParse({ folder: "" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ key: "KIB" }).success).toBe(false);
});
```
`packages/schema/src/agent.test.ts` (nouveau ou complété) :
```ts
import { expect, test } from "bun:test";
import { ConfigCommand, WorkspacePatch } from "./agent";

test("a workspace patch needs a field; the description is bounded and can be cleared", () => {
  expect(WorkspacePatch.safeParse({}).success).toBe(false);
  expect(WorkspacePatch.safeParse({ description: null }).success).toBe(true);
  expect(WorkspacePatch.safeParse({ description: "x".repeat(501) }).success).toBe(false);
  expect(WorkspacePatch.safeParse({ name: "x".repeat(41) }).success).toBe(false);
  const parsed = ConfigCommand.parse({ method: "updateWorkspace", patch: { name: " Maison ", description: " Mes projets " } });
  expect(parsed).toEqual({ method: "updateWorkspace", patch: { name: "Maison", description: "Mes projets" } });
});
```
Run: `bun test packages/schema/src/project.test.ts packages/schema/src/agent.test.ts` — Expected: FAIL.

`packages/schema/src/project.ts`, après `ProjectMeta` :
```ts
export const ProjectPatch = z
  .object({
    name: ProjectMeta.shape.name.optional(),
    color: ProjectMeta.shape.color.optional(),
    folder: z.string().min(1).max(4096).nullable().optional(),
  })
  .strict()
  .refine((p) => p.name !== undefined || p.color !== undefined || p.folder !== undefined, {
    message: "empty patch",
  });
export type ProjectPatch = z.infer<typeof ProjectPatch>;
```
`packages/schema/src/agent.ts`, après `WorkspaceName` :
```ts
export const WorkspaceDescription = z.string().trim().max(500);
export const WorkspacePatch = z
  .object({ name: WorkspaceName.optional(), description: WorkspaceDescription.nullable().optional() })
  .strict()
  .refine((p) => p.name !== undefined || p.description !== undefined, { message: "empty patch" });
export type WorkspacePatch = z.infer<typeof WorkspacePatch>;
```
dans `ConfigCommand`, après `renameWorkspace` : `z.object({ method: z.literal("updateWorkspace"), patch: WorkspacePatch }),` ; dans `ConfigResult` : `updateWorkspace: { name: string | null; description: string | null };` ; dans `WorkspaceConfig` : `workspaceDescription: string | null;` après `workspaceName`.

`packages/schema/src/rpc.ts` : importer `ProjectPatch` (`./project`) et `IconInput, IconOwner` (`./icon`) ; ajouter à `RpcRequest` après `getProject` :
```ts
  z.object({ method: z.literal("updateProject"), projectId: z.string().min(1), patch: ProjectPatch }),
  z.object({ method: z.literal("deleteProject"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("setIcon"), owner: IconOwner, icon: IconInput.nullable() }),
```
et à `RpcResult` : `updateProject: ProjectMeta; deleteProject: null; setIcon: { icon: string | null };`.

Run: `bun test packages/schema` puis `bun run typecheck` — Expected: PASS ; le typecheck signale les `switch` exhaustifs à compléter : `packages/daemon/src/agents-rpc.ts` (`handleAgentRequest`, `default` lève déjà `INTERNAL` : rien à faire si le `switch` n'est pas exhaustif) et `packages/daemon/src/components/methods.ts` (`ShellRequest`) : ajouter les trois méthodes là où le typecheck l'exige, sans autre logique. `readConfig` (Step 5) et la fixture UI (Step 6) corrigent `workspaceDescription`.

- [ ] **Step 3: Core, liste du workspace et `meta` (tests rouges puis verts)**

`packages/core/src/project.test.ts`, dans `describe("workspace")`, ajouter :
```ts
  test("a registered project is updated in place and can be removed", () => {
    const ws = createWorkspaceDoc();
    registerProject(ws, meta);
    registerProject(ws, { ...meta, id: "p2", key: "FAC", name: "API Facturation" });
    expect(updateRegisteredProject(ws, "p1", { name: "Kibo 2", folder: null })).toEqual({ ...meta, name: "Kibo 2", folder: null });
    expect(listProjects(ws).map((p) => [p.id, p.name, p.folder])).toEqual([
      ["p1", "Kibo 2", null],
      ["p2", "API Facturation", "/tmp/kibo"],
    ]);
    expect(() => updateRegisteredProject(ws, "p1", {})).toThrow("empty patch");
    expect(() => updateRegisteredProject(ws, "p9", { name: "x" })).toThrow("NOT_FOUND");
    unregisterProject(ws, "p1");
    expect(listProjects(ws).map((p) => p.id)).toEqual(["p2"]);
    expect(() => unregisterProject(ws, "p1")).toThrow("NOT_FOUND");
    registerProject(ws, meta);
    expect(listProjects(ws).map((p) => p.id)).toEqual(["p2", "p1"]);
  });
```
et un nouveau `describe("project meta")` :
```ts
describe("project meta", () => {
  test("setProjectMeta writes only the given fields and keeps key and id", () => {
    const doc = createProjectDoc(meta);
    expect(setProjectMeta(doc, { color: "#6366F1" })).toEqual({ ...meta, color: "#6366F1" });
    expect(setProjectMeta(doc, { name: "Noyau", folder: null })).toEqual({ ...meta, name: "Noyau", color: "#6366F1", folder: null });
    expect(() => setProjectMeta(doc, { name: " " })).toThrow("INVALID_INPUT");
    expect(getProjectMeta(doc).key).toBe("KIB");
  });
});
```
(`updateRegisteredProject`, `unregisterProject`, `setProjectMeta` importés de `./index`.)
Run: `bun test packages/core/src/project.test.ts` — Expected: FAIL.

`packages/core/src/workspace.ts`, ajouter :
```ts
export type RegisteredProjectPatch = { name?: string; color?: string; folder?: string | null };

function entryOf(ws: LoroDoc, projectId: string): { list: LoroList; index: number } {
  const list: LoroList = ws.getList("projects");
  const index = listProjects(ws).findIndex((p) => p.id === projectId);
  if (index < 0) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
  return { list, index };
}

export function updateRegisteredProject(ws: LoroDoc, projectId: string, patch: RegisteredProjectPatch): ProjectMeta {
  const fields = valid(ProjectPatch.safeParse(patch));
  const { list, index } = entryOf(ws, projectId);
  const entry = list.get(index);
  if (!(entry instanceof LoroMap)) throw new KiboError("STORE_CORRUPT", `project ${projectId} entry is not a map`);
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) entry.set(key, value);
  ws.commit();
  return stored(ProjectMeta.safeParse(listProjects(ws)[index]), "project");
}

export function unregisterProject(ws: LoroDoc, projectId: string): void {
  const { list, index } = entryOf(ws, projectId);
  list.delete(index, 1);
  ws.commit();
}
```
(imports : `ProjectPatch` de `@kibo/schema`, `stored`, `valid` de `./config-store`.)

`packages/core/src/project.ts`, ajouter :
```ts
export function setProjectMeta(doc: LoroDoc, patch: RegisteredProjectPatch): ProjectMeta {
  const fields = valid(ProjectPatch.safeParse(patch));
  const m = doc.getMap("meta");
  if (fields.name !== undefined) m.set("name", fields.name);
  if (fields.color !== undefined) m.set("color", fields.color);
  if (fields.folder !== undefined) m.set("folder", fields.folder);
  doc.commit();
  return getProjectMeta(doc);
}
```
(imports : `ProjectPatch`, `valid`, `RegisteredProjectPatch` de `./workspace`.)
Run: `bun test packages/core/src/project.test.ts` — Expected: PASS.

- [ ] **Step 4: Core, `updateWorkspace` (test rouge puis vert)**

`packages/core/src/agent-config.test.ts`, dans `describe("workspace name")`, ajouter :
```ts
  test("updateWorkspace sets the name and the description, and null clears the description", () => {
    const ws = createWorkspaceDoc();
    expect(
      executeConfigCommand(ws, ConfigCommand.parse({ method: "updateWorkspace", patch: { name: " Maison ", description: " Mes projets " } })),
    ).toEqual({ name: "Maison", description: "Mes projets" });
    expect(workspaceDescription(ws)).toBe("Mes projets");
    expect(executeConfigCommand(ws, { method: "updateWorkspace", patch: { description: null } })).toEqual({ name: "Maison", description: null });
    expect(workspaceDescription(ws)).toBeNull();
    expect(() => executeConfigCommand(ws, { method: "updateWorkspace", patch: {} })).toThrow("INVALID_INPUT");
    expect(configTarget({ method: "updateWorkspace", patch: { name: "x" } })).toBeNull();
  });
```
Run: `bun test packages/core/src/agent-config.test.ts` — Expected: FAIL.

`packages/core/src/agent-config.ts` : après `workspaceName`,
```ts
export function workspaceDescription(ws: LoroDoc): string | null {
  const description = settingsMap(ws).get("description");
  return typeof description === "string" ? description : null;
}
```
dans `executeConfigCommand`, après le cas `renameWorkspace` :
```ts
    case "updateWorkspace": {
      requireWorkspace(doc);
      const patch = valid(WorkspacePatch.safeParse(cmd.patch));
      const settings = settingsMap(doc);
      if (patch.name !== undefined) settings.set("name", patch.name);
      if (patch.description === null) settings.delete("description");
      else if (patch.description !== undefined) settings.set("description", patch.description);
      doc.commit();
      return { name: workspaceName(doc), description: workspaceDescription(doc) };
    }
```
(import `WorkspacePatch` de `@kibo/schema` ; `configTarget` renvoie déjà `null` par défaut.)
Run: `bun test packages/core` — Expected: PASS.

- [ ] **Step 5: Démon, `readConfig` et test de persistance**

`packages/daemon/src/workspace-config.ts` : importer `workspaceDescription` de `@kibo/core/agent-config` et ajouter `workspaceDescription: workspaceDescription(docs.workspace),` dans `readConfig`. Dans `service.test.ts`, test « configuration survives a restart » : après `renameWorkspace`, ajouter
```ts
    s1.handle({ method: "config", command: { method: "updateWorkspace", patch: { description: "Mes projets" } } });
```
et après `expect(config.workspaceName).toBe("Maison");` : `expect(config.workspaceDescription).toBe("Mes projets");`.
Run: `bun test packages/daemon/src/service.test.ts` — Expected: PASS.

- [ ] **Step 6: Fixture UI, gate et commits**

`packages/ui/src/agents/fixtures.ts:264` : ajouter `workspaceDescription: null,` après `workspaceName: "Perso",`.

Run: `bun run check && bun run typecheck && bun test packages` — Expected: PASS.

```bash
git add packages/schema/src/icon.ts packages/schema/src/icon.test.ts packages/schema/src/index.ts packages/schema/src/project.ts packages/schema/src/project.test.ts packages/schema/src/agent.ts packages/schema/src/agent.test.ts packages/schema/src/rpc.ts packages/daemon/src/components/methods.ts
git commit -m "feat(schema): patch de projet, images, workspace"
git add packages/core/src/workspace.ts packages/core/src/project.ts packages/core/src/project.test.ts packages/core/src/agent-config.ts packages/core/src/agent-config.test.ts packages/daemon/src/workspace-config.ts packages/daemon/src/service.test.ts packages/ui/src/agents/fixtures.ts
git commit -m "feat(core): meta de projet et description du workspace"
```
(Retirer `packages/daemon/src/components/methods.ts` du premier commit s'il n'a pas eu besoin de changer.)

---

### Task 21: Démon : images, `updateProject`, `updateWorkspace` exposé

Vague 1 ← T20. Spec §14.1, §14.2, §14.4. Décision 1. Le magasin d'images SQLite et sa route `GET /icons/…`, le décodage vérifié par signature, `Docs.updateProjectMeta` (doc + copie du workspace), et le module `projects/admin.ts` branché comme `RpcHandler` pour `updateProject` (dossier réservé à la machine, refus si runs actifs) et `setIcon`. `listProjects`, `getProject` et `getConfig` renseignent les empreintes. **Relue par `kibo-lead`.**

**Files:**
- Create: `packages/daemon/src/icons/icon-store.ts`, `icon-store.test.ts`, `decode-icon.ts`, `decode-icon.test.ts`, `icon-route.ts`, `icon-route.test.ts`
- Create: `packages/daemon/src/projects/admin.ts`, `packages/daemon/src/projects/admin.test.ts`
- Modify: `packages/daemon/src/docs.ts`, `packages/daemon/src/service.ts:76-300`, `packages/daemon/src/workspace-config.ts`, `packages/daemon/src/notes/settings.ts` (`unset`), `packages/daemon/src/server.ts:59-190`, `packages/daemon/src/daemon.ts:156-175`
- Modify: `packages/schema/src/rpc.ts:57` (`ProjectSummary.icon?`, `ProjectSnapshot.icon?`), `packages/schema/src/agent.ts` (`WorkspaceConfig.workspaceIcon`), `packages/ui/src/agents/fixtures.ts:264` (`workspaceIcon: null`)
- Test: `packages/daemon/src/service.test.ts`, `packages/daemon/src/daemon.test.ts`

**Interfaces:**
- Consumes: `IconInput`, `IconMime`, `ICON_MIMES`, `MAX_ICON_BYTES`, `iconOwnerKey`, `ProjectPatch`, `isTerminal` (`@kibo/schema`), `setProjectMeta`, `updateRegisteredProject` (`@kibo/core`, T20), `RpcContext`, `RpcHandler`, `requireLocal` (`rpc-extensions.ts`), `ProjectSettings`, `withLocalFolder`, `LOCAL_FOLDER_KEY`, `collab.syncInfo`, `Orchestrator.state`.
- Produces: contrat « Démon (T21) » (`IconStore`, `decodeIcon`, `sniffIconMime`, `serveIcon`, `parseIconPath`, `Docs.updateProjectMeta`, `Service.icons`, `readConfig(docs, icons)`, `createProjectAdmin` avec `updateProject`, `setIcon`, `handler` ; `ProjectSettings.unset`).

- [ ] **Step 1: Magasin d'images (test rouge puis vert)**

`packages/daemon/src/icons/icon-store.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createIconStore, ensureIconsTable } from "./icon-store";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const open = () => {
  const db = new Database(":memory:", { strict: true });
  ensureIconsTable(db);
  return createIconStore(db);
};

test("stores bytes by owner and versions them by sha256", () => {
  const icons = open();
  expect(icons.get("project:p1")).toBeNull();
  expect(icons.version("project:p1")).toBeNull();
  const version = icons.set("project:p1", "image/png", PNG);
  expect(version).toBe(new Bun.CryptoHasher("sha256").update(PNG).digest("hex"));
  expect(icons.version("project:p1")).toBe(version);
  expect(icons.get("project:p1")).toEqual({ mime: "image/png", bytes: PNG, sha256: version });
});

test("replacing and removing an icon", () => {
  const icons = open();
  icons.set("workspace", "image/png", PNG);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  expect(icons.set("workspace", "image/jpeg", jpeg)).not.toBe(icons.version("project:none"));
  expect(icons.get("workspace")?.mime).toBe("image/jpeg");
  icons.remove("workspace");
  expect(icons.get("workspace")).toBeNull();
  icons.remove("workspace");
});
```
Run: `bun test packages/daemon/src/icons/icon-store.test.ts` — Expected: FAIL.

`packages/daemon/src/icons/icon-store.ts` :
```ts
import type { Database } from "bun:sqlite";
import { IconMime, KiboError } from "@kibo/schema";

export type StoredIcon = { mime: IconMime; bytes: Uint8Array; sha256: string };
export type IconStore = {
  get(owner: string): StoredIcon | null;
  version(owner: string): string | null;
  set(owner: string, mime: IconMime, bytes: Uint8Array): string;
  remove(owner: string): void;
};

type Row = { mime: string; bytes: Uint8Array; sha256: string };
type Owner = { owner: string };

export const sha256Hex = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

export function ensureIconsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS icons (owner TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, sha256 TEXT NOT NULL)",
  );
}

export function createIconStore(db: Database): IconStore {
  const select = db.query<Row, Owner>("SELECT mime, bytes, sha256 FROM icons WHERE owner = $owner");
  const selectVersion = db.query<{ sha256: string }, Owner>("SELECT sha256 FROM icons WHERE owner = $owner");
  const upsert = db.query<never, Row & Owner>(
    "INSERT INTO icons (owner, mime, bytes, sha256) VALUES ($owner, $mime, $bytes, $sha256) " +
      "ON CONFLICT(owner) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, sha256 = excluded.sha256",
  );
  const remove = db.query<never, Owner>("DELETE FROM icons WHERE owner = $owner");
  return {
    get(owner) {
      const row = select.get({ owner });
      if (!row) return null;
      const mime = IconMime.safeParse(row.mime);
      if (!mime.success) throw new KiboError("STORE_CORRUPT", `icon ${owner} has mime ${row.mime}`);
      return { mime: mime.data, bytes: new Uint8Array(row.bytes), sha256: row.sha256 };
    },
    version: (owner) => selectVersion.get({ owner })?.sha256 ?? null,
    set(owner, mime, bytes) {
      const sha256 = sha256Hex(bytes);
      upsert.run({ owner, mime, bytes, sha256 });
      return sha256;
    },
    remove(owner) {
      remove.run({ owner });
    },
  };
}
```
Run: `bun test packages/daemon/src/icons/icon-store.test.ts` — Expected: PASS, 2 tests.

- [ ] **Step 2: Décodage vérifié (test rouge puis vert)**

`packages/daemon/src/icons/decode-icon.test.ts` :
```ts
import { expect, test } from "bun:test";
import { MAX_ICON_BYTES } from "@kibo/schema";
import { decodeIcon, sniffIconMime } from "./decode-icon";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0, 0]);
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

test("sniffs png, jpeg and webp by their signatures and nothing else", () => {
  expect(sniffIconMime(PNG)).toBe("image/png");
  expect(sniffIconMime(JPEG)).toBe("image/jpeg");
  expect(sniffIconMime(WEBP)).toBe("image/webp");
  expect(sniffIconMime(new Uint8Array(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")))).toBeNull();
  expect(sniffIconMime(new Uint8Array([0x89, 0x50]))).toBeNull();
});

test("decodes bytes that match the declared mime", () => {
  expect(decodeIcon({ mime: "image/png", data: b64(PNG) })).toEqual({ mime: "image/png", bytes: PNG });
});

test("refuses a mismatch, an oversized image and broken base64 without touching anything", () => {
  expect(() => decodeIcon({ mime: "image/png", data: b64(JPEG) })).toThrow("INVALID_INPUT");
  expect(() => decodeIcon({ mime: "image/png", data: b64(new Uint8Array(Buffer.from("<svg/>"))) })).toThrow("INVALID_INPUT");
  const big = new Uint8Array(MAX_ICON_BYTES + 1);
  big.set(PNG);
  expect(() => decodeIcon({ mime: "image/png", data: b64(big) })).toThrow("TOO_LARGE");
  expect(() => decodeIcon({ mime: "image/png", data: "iVBORw0KGgo" })).toThrow("INVALID_INPUT");
});
```
Run: `bun test packages/daemon/src/icons/decode-icon.test.ts` — Expected: FAIL.

`packages/daemon/src/icons/decode-icon.ts` :
```ts
import { ICON_MIMES, type IconInput, type IconMime, KiboError, MAX_ICON_BYTES } from "@kibo/schema";

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((b, i) => bytes[i] === b);
const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCharCode(...bytes.subarray(from, to));

const SIGNATURES: Record<IconMime, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "image/webp": (b) => b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
};

export function sniffIconMime(bytes: Uint8Array): IconMime | null {
  return ICON_MIMES.find((mime) => SIGNATURES[mime](bytes)) ?? null;
}

export function decodeIcon(input: IconInput): { mime: IconMime; bytes: Uint8Array } {
  if (input.data.length % 4 !== 0) throw new KiboError("INVALID_INPUT", "icon data is not valid base64");
  const buffer = Buffer.from(input.data, "base64");
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (bytes.byteLength > MAX_ICON_BYTES) {
    throw new KiboError("TOO_LARGE", `icon is ${bytes.byteLength} bytes, at most ${MAX_ICON_BYTES}`);
  }
  if (sniffIconMime(bytes) !== input.mime) {
    throw new KiboError("INVALID_INPUT", `icon bytes are not ${input.mime}`);
  }
  return { mime: input.mime, bytes };
}
```
Run: `bun test packages/daemon/src/icons/decode-icon.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 3: Route `GET /icons/…` (test rouge puis vert)**

`packages/daemon/src/icons/icon-route.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { StoredIcon } from "./icon-store";
import { parseIconPath, serveIcon } from "./icon-route";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const stored: StoredIcon = { mime: "image/png", bytes: PNG, sha256: "abc" };
const deps = (paired = true) => ({
  icons: { get: (owner: string) => (owner === "project:p1" ? stored : null) },
  origins: () => ["http://127.0.0.1:4317"],
  hasSession: () => paired,
});
const get = (path: string, headers: Record<string, string> = {}) => {
  const url = new URL(`http://127.0.0.1:4317${path}`);
  return serveIcon(new Request(url, { headers }), url, deps());
};

test("parses the two owner paths and nothing else", () => {
  expect(parseIconPath("/icons/workspace")).toEqual({ kind: "workspace" });
  expect(parseIconPath("/icons/project/p1")).toEqual({ kind: "project", projectId: "p1" });
  expect(parseIconPath("/icons/project/p1/more")).toBeNull();
  expect(parseIconPath("/icons/project/")).toBeNull();
  expect(parseIconPath("/icons/other")).toBeNull();
});

test("serves the stored bytes with the verified mime and an immutable private cache", async () => {
  const res = get("/icons/project/p1?v=abc");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
});

test("refuses without a session, from another site or origin, and 404s the rest", () => {
  const url = new URL("http://127.0.0.1:4317/icons/project/p1");
  expect(serveIcon(new Request(url), url, deps(false)).status).toBe(401);
  expect(get("/icons/project/p1", { "sec-fetch-site": "cross-site" }).status).toBe(403);
  expect(get("/icons/project/p1", { origin: "https://evil.example" }).status).toBe(403);
  expect(get("/icons/project/p2").status).toBe(404);
  expect(get("/icons/workspace").status).toBe(404);
  expect(serveIcon(new Request(url, { method: "POST" }), url, deps()).status).toBe(404);
});
```
Run: `bun test packages/daemon/src/icons/icon-route.test.ts` — Expected: FAIL.

`packages/daemon/src/icons/icon-route.ts` :
```ts
import { type IconOwner, iconOwnerKey } from "@kibo/schema";
import type { IconStore } from "./icon-store";

export type IconRouteDeps = {
  icons: Pick<IconStore, "get">;
  origins(): string[];
  hasSession(req: Request): boolean;
};

const HEADERS = { "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" };
const PROJECT_PATH = /^\/icons\/project\/([A-Za-z0-9-]+)$/;

const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { ...HEADERS, "cache-control": "no-store" } });

export function parseIconPath(pathname: string): IconOwner | null {
  if (pathname === "/icons/workspace") return { kind: "workspace" };
  const projectId = PROJECT_PATH.exec(pathname)?.[1];
  return projectId ? { kind: "project", projectId } : null;
}

export function serveIcon(req: Request, url: URL, deps: IconRouteDeps): Response {
  const origin = req.headers.get("origin");
  if (origin !== null && !deps.origins().includes(origin)) return plain("forbidden origin", 403);
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return plain("forbidden site", 403);
  if (!deps.hasSession(req)) return plain("unauthorized", 401);
  const owner = parseIconPath(url.pathname);
  if (req.method !== "GET" || !owner) return plain("not found", 404);
  const icon = deps.icons.get(iconOwnerKey(owner));
  if (!icon) return plain("not found", 404);
  return new Response(icon.bytes, {
    headers: { ...HEADERS, "content-type": icon.mime, "cache-control": "private, max-age=31536000, immutable" },
  });
}
```
Run: `bun test packages/daemon/src/icons/icon-route.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 4: `Docs.updateProjectMeta`, `Service.icons`, empreintes (tests rouges puis verts)**

`packages/daemon/src/service.test.ts`, dans `describe("service")`, ajouter :
```ts
  test("updateProjectMeta writes the doc and the workspace copy, and folder only where asked", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const seen: unknown[] = [];
    s.onChange((m) => seen.push(m));
    expect(s.docs.updateProjectMeta(p.id, { name: "Noyau", color: "#6366F1", folder: "/tmp/kibo" }, true)).toEqual({
      ...p,
      name: "Noyau",
      color: "#6366F1",
      folder: "/tmp/kibo",
    });
    expect(seen).toEqual([{ projectId: p.id }, { projectId: null }]);
    const [summary] = s.handle({ method: "listProjects" }) as ProjectSummary[];
    expect([summary.name, summary.color, summary.folder]).toEqual(["Noyau", "#6366F1", "/tmp/kibo"]);
    s.docs.updateProjectMeta(p.id, { folder: "/tmp/elsewhere" }, false);
    expect((s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot).meta.folder).toBe("/tmp/kibo");
    expect((s.handle({ method: "listProjects" }) as ProjectSummary[])[0]?.folder).toBe("/tmp/elsewhere");
    store.close();
  });

  test("projects and the workspace expose their icon version", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    expect((s.handle({ method: "listProjects" }) as ProjectSummary[])[0]?.icon).toBeNull();
    const version = s.icons.set(`project:${p.id}`, "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect((s.handle({ method: "listProjects" }) as ProjectSummary[])[0]?.icon).toBe(version);
    expect((s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot).icon).toBe(version);
    expect((s.handle({ method: "getConfig" }) as WorkspaceConfig).workspaceIcon).toBeNull();
    s.icons.set("workspace", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect((s.handle({ method: "getConfig" }) as WorkspaceConfig).workspaceIcon).not.toBeNull();
    store.close();
  });
```
Run: `bun test packages/daemon/src/service.test.ts` — Expected: FAIL.

Schéma : `packages/schema/src/rpc.ts:57` ⇒ `export type ProjectSummary = ProjectMeta & { counts: Record<StatusId, number>; icon?: string | null };` et dans `ProjectSnapshot` ajouter `icon?: string | null;` après `viewer?`. `packages/schema/src/agent.ts` › `WorkspaceConfig` : `workspaceIcon: string | null;`. `packages/ui/src/agents/fixtures.ts:265` : `workspaceIcon: null,`.

`packages/daemon/src/docs.ts` : importer `ProjectPatch` ; `Docs` gagne
```ts
  updateProjectMeta(projectId: string, patch: ProjectPatch, folderInDoc: boolean): ProjectMeta;
```
`packages/daemon/src/service.ts` :
- `Service` gagne `icons: IconStore` ; après `const settings = …` : `ensureIconsTable(store.db); const icons = createIconStore(store.db);` ; l'objet renvoyé porte `icons` ;
- dans `docs`, après `projectMeta` :
```ts
    updateProjectMeta(projectId, patch, folderInDoc) {
      const doc = docs.project(projectId);
      const docPatch: ProjectPatch = folderInDoc ? patch : docFields(patch);
      if (Object.keys(docPatch).length > 0) setProjectMeta(doc, docPatch);
      updateRegisteredProject(workspace, projectId, patch);
      docs.save(projectId);
      docs.save(null);
      docs.emit({ projectId });
      docs.emit({ projectId: null });
      return docs.projectMeta(projectId);
    },
```
avec, hors de l'objet :
```ts
const docFields = (patch: ProjectPatch): ProjectPatch => ({
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.color !== undefined && { color: patch.color }),
});
```
(`folder` n'entre dans le doc que si `folderInDoc` ; la copie du workspace, locale, reçoit toujours le patch entier.)
- `listProjects` : `({ ...meta, counts: …, icon: icons.version(iconOwnerKey({ kind: "project", projectId: meta.id })) })` ; `getProject` : `icon: icons.version(iconOwnerKey({ kind: "project", projectId: req.projectId }))` dans `snapshot` ; `getConfig` : `readConfig(docs, icons)`.
- `packages/daemon/src/workspace-config.ts` : `readConfig(docs: Docs, icons: Pick<IconStore, "version">)` avec `workspaceIcon: icons.version("workspace")`. Adapter les autres appelants de `readConfig` (`grep -rn "readConfig(" packages/daemon/src`).

Run: `bun test packages/daemon/src/service.test.ts packages/daemon/src/workspace-config.test.ts` — Expected: PASS.

- [ ] **Step 5: `ProjectSettings.unset`**

`packages/daemon/src/notes/settings.ts` : `ProjectSettings` gagne `unset(projectId: string, key: string): void` ; requête `DELETE FROM project_settings WHERE project_id = $projectId AND key = $key`. Test dans `packages/daemon/src/notes/settings.test.ts` (créer s'il manque) : `set` puis `unset` puis `get` ⇒ `null` ; `unset` d'une clé absente ne lève pas.

- [ ] **Step 6: Module d'administration : `updateProject` et `setIcon` (tests rouges puis verts)**

`packages/daemon/src/projects/admin.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta, ProjectSnapshot, ProjectSummary, ProjectSyncInfo } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_FOLDER_KEY } from "../project-folder";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin } from "./admin";

const REMOTE: RpcContext = { sessionHash: "r", remote: true };
const LOCAL_SYNC: ProjectSyncInfo = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
const SHARED_SYNC: ProjectSyncInfo = { ...LOCAL_SYNC, shared: true, keyAllocator: "server", role: "editor" };
const PNG = "iVBORw0KGgoAAA==";
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-admin-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(opts: { sharing?: ProjectSyncInfo; activeRuns?: number } = {}) {
  const store = openStore(tmp());
  const service = createService(store, { user: "adam" });
  const settings = createProjectSettings(store.db);
  const project = service.handle({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" }) as ProjectMeta;
  const admin = createProjectAdmin({
    docs: service.docs,
    settings,
    icons: service.icons,
    store,
    sharing: () => opts.sharing ?? LOCAL_SYNC,
    activeRuns: () => opts.activeRuns ?? 0,
    detach: () => {},
    folderExists: (path) => path.startsWith("/tmp/ok"),
  });
  const summary = () => (service.handle({ method: "listProjects" }) as ProjectSummary[])[0];
  const snapshot = () => service.handle({ method: "getProject", projectId: project.id }) as ProjectSnapshot;
  return { service, settings, project, admin, summary, snapshot, close: () => store.close() };
}

test("renames and recolors through the doc and the workspace list", () => {
  const s = setup();
  const meta = s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch: { name: "Noyau", color: "#6366F1" } }, REMOTE);
  expect([meta.name, meta.color, meta.key]).toEqual(["Noyau", "#6366F1", "KIB"]);
  expect([s.summary()?.name, s.snapshot().meta.name]).toEqual(["Noyau", "Noyau"]);
  s.close();
});

test("the folder is local only, must exist, and is refused while runs are active", () => {
  const s = setup();
  const req = { method: "updateProject", projectId: s.project.id, patch: { folder: "/tmp/ok/kibo" } } as const;
  expect(() => s.admin.updateProject(req, REMOTE)).toThrow("FORBIDDEN");
  expect(() => s.admin.updateProject({ ...req, patch: { folder: "/tmp/missing" } }, LOCAL_CONTEXT)).toThrow("INVALID_INPUT");
  expect(s.admin.updateProject(req, LOCAL_CONTEXT).folder).toBe("/tmp/ok/kibo");
  expect(s.snapshot().meta.folder).toBe("/tmp/ok/kibo");
  expect(s.admin.updateProject({ ...req, patch: { folder: null } }, LOCAL_CONTEXT).folder).toBeNull();
  s.close();
  const busy = setup({ activeRuns: 1 });
  expect(() => busy.admin.updateProject({ method: "updateProject", projectId: busy.project.id, patch: { folder: "/tmp/ok/x" } }, LOCAL_CONTEXT)).toThrow("CONFLICT");
  expect(busy.admin.updateProject({ method: "updateProject", projectId: busy.project.id, patch: { name: "Encore" } }, LOCAL_CONTEXT).name).toBe("Encore");
  busy.close();
});

test("a shared project keeps its folder out of the doc", () => {
  const s = setup({ sharing: SHARED_SYNC });
  s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch: { folder: "/tmp/ok/shared" } }, LOCAL_CONTEXT);
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBe("/tmp/ok/shared");
  expect(s.service.docs.project(s.project.id).getMap("meta").get("folder")).toBeNull();
  expect(s.summary()?.folder).toBe("/tmp/ok/shared");
  s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch: { folder: null } }, LOCAL_CONTEXT);
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBeNull();
  s.close();
});

test("an unknown project or an empty name is refused", () => {
  const s = setup();
  expect(() => s.admin.updateProject({ method: "updateProject", projectId: "nope", patch: { name: "x" } }, LOCAL_CONTEXT)).toThrow("NOT_FOUND");
  expect(() => s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch: { name: "   " } }, LOCAL_CONTEXT)).toThrow("INVALID_INPUT");
  expect(s.summary()?.name).toBe("Kibo");
  s.close();
});

test("setIcon stores a verified image for a project or the workspace, and null removes it", () => {
  const s = setup();
  const seen: unknown[] = [];
  s.service.onChange((m) => seen.push(m));
  const { icon } = s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: s.project.id }, icon: { mime: "image/png", data: PNG } });
  expect(icon).toMatch(/^[0-9a-f]{64}$/);
  expect(s.summary()?.icon).toBe(icon);
  expect(seen).toEqual([{ projectId: s.project.id }, { projectId: null }]);
  expect(() => s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: s.project.id }, icon: { mime: "image/jpeg", data: PNG } })).toThrow("INVALID_INPUT");
  expect(s.summary()?.icon).toBe(icon);
  expect(s.admin.setIcon({ method: "setIcon", owner: { kind: "workspace" }, icon: { mime: "image/png", data: PNG } }).icon).toBe(icon);
  expect(seen.at(-1)).toEqual({ topic: "config" });
  expect(s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: s.project.id }, icon: null }).icon).toBeNull();
  expect(s.summary()?.icon).toBeNull();
  expect(() => s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: "nope" }, icon: null })).toThrow("NOT_FOUND");
  s.close();
});

test("the handler answers its two methods and leaves the rest alone", async () => {
  const s = setup();
  expect(await s.admin.handler({ method: "listProjects" }, LOCAL_CONTEXT)).toEqual({ handled: false });
  const out = await s.admin.handler({ method: "updateProject", projectId: s.project.id, patch: { name: "Via handler" } }, LOCAL_CONTEXT);
  expect(out).toMatchObject({ handled: true, result: { name: "Via handler" } });
  s.close();
});
```
Run: `bun test packages/daemon/src/projects/admin.test.ts` — Expected: FAIL.

`packages/daemon/src/projects/admin.ts` :
```ts
import { isAbsolute } from "node:path";
import { statSync } from "node:fs";
import { iconOwnerKey, KiboError, type ProjectMeta, type ProjectSyncInfo, type RpcRequest } from "@kibo/schema";
import type { Docs } from "../docs";
import { decodeIcon } from "../icons/decode-icon";
import type { IconStore } from "../icons/icon-store";
import type { ProjectSettings } from "../notes/settings";
import { LOCAL_FOLDER_KEY } from "../project-folder";
import { type RpcContext, type RpcHandler, requireLocal } from "../rpc-extensions";
import type { Store } from "../store";

export type ProjectAdminDeps = {
  docs: Docs;
  settings: ProjectSettings;
  icons: IconStore;
  store: Pick<Store, "transaction">;
  sharing(projectId: string): ProjectSyncInfo;
  activeRuns(projectId: string): number;
  detach(projectId: string): void;
  folderExists?(path: string): boolean;
};
type UpdateRequest = Extract<RpcRequest, { method: "updateProject" }>;
type IconRequest = Extract<RpcRequest, { method: "setIcon" }>;
export type ProjectAdmin = {
  updateProject(req: UpdateRequest, ctx: RpcContext): ProjectMeta;
  setIcon(req: IconRequest): { icon: string | null };
  handler: RpcHandler;
};

export const folderIsDirectory = (path: string): boolean =>
  isAbsolute(path) && (statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false);

export function createProjectAdmin(deps: ProjectAdminDeps): ProjectAdmin {
  const folderExists = deps.folderExists ?? folderIsDirectory;
  const admin: ProjectAdmin = {
    updateProject(req, ctx) {
      const { projectId, patch } = req;
      deps.docs.project(projectId);
      const touchesDoc = patch.name !== undefined || patch.color !== undefined;
      if (patch.folder !== undefined) {
        requireLocal(ctx);
        if (patch.folder !== null && !folderExists(patch.folder)) {
          throw new KiboError("INVALID_INPUT", `${patch.folder} is not an existing folder`);
        }
        if (deps.activeRuns(projectId) > 0) {
          throw new KiboError("CONFLICT", `project ${projectId} has active runs`);
        }
      }
      if (touchesDoc) deps.docs.assertWritable(projectId);
      const shared = deps.sharing(projectId).shared;
      const meta = deps.docs.updateProjectMeta(projectId, patch, !shared);
      if (shared && patch.folder !== undefined) {
        if (patch.folder === null) deps.settings.unset(projectId, LOCAL_FOLDER_KEY);
        else deps.settings.set(projectId, LOCAL_FOLDER_KEY, patch.folder);
      }
      return shared ? deps.docs.projectMeta(projectId) : meta;
    },
    setIcon(req) {
      const owner = req.owner;
      if (owner.kind === "project") deps.docs.project(owner.projectId);
      const key = iconOwnerKey(owner);
      let icon: string | null = null;
      if (req.icon === null) deps.icons.remove(key);
      else {
        const decoded = decodeIcon(req.icon);
        icon = deps.icons.set(key, decoded.mime, decoded.bytes);
      }
      if (owner.kind === "project") {
        deps.docs.emit({ projectId: owner.projectId });
        deps.docs.emit({ projectId: null });
      } else deps.docs.emit({ topic: "config" });
      return { icon };
    },
    handler: async (req, ctx) => {
      switch (req.method) {
        case "updateProject":
          return { handled: true, result: admin.updateProject(req, ctx) };
        case "setIcon":
          return { handled: true, result: admin.setIcon(req) };
        default:
          return { handled: false };
      }
    },
  };
  return admin;
}
```
Run: `bun test packages/daemon/src/projects/admin.test.ts` — Expected: PASS, 6 tests. (`updateProjectMeta` avec `folderInDoc = false` écrit `folder` dans la copie du workspace mais pas dans le doc : c'est voulu, D32.)

- [ ] **Step 7: Branchement : serveur et démon (test HTTP rouge puis vert)**

`packages/daemon/src/daemon.test.ts`, ajouter :
```ts
test("icons are set by rpc and served under the session cookie only", async () => {
  const { d } = await launch();
  const rpc = await pair(d);
  const cookie = await pairCookie(d);
  const created = await (await rpc({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" })).json();
  const projectId = (created as { result: { id: string } }).result.id;
  const set = await (await rpc({ method: "setIcon", owner: { kind: "project", projectId }, icon: { mime: "image/png", data: "iVBORw0KGgoAAA==" } })).json();
  const version = (set as { result: { icon: string } }).result.icon;
  const ok = await fetch(`${d.url}/icons/project/${projectId}?v=${version}`, { headers: { cookie } });
  expect(ok.status).toBe(200);
  expect(ok.headers.get("content-type")).toBe("image/png");
  expect(ok.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  expect((await fetch(`${d.url}/icons/project/${projectId}?v=${version}`)).status).toBe(401);
  expect((await fetch(`${d.url}/icons/workspace`, { headers: { cookie } })).status).toBe(404);
  const projects = await (await rpc({ method: "listProjects" })).json();
  expect((projects as { result: { icon: string | null }[] }).result[0]?.icon).toBe(version);
  const renamed = await (await rpc({ method: "updateProject", projectId, patch: { name: "Noyau" } })).json();
  expect((renamed as { result: { name: string } }).result.name).toBe("Noyau");
});
```
Run: `bun test packages/daemon/src/daemon.test.ts -t "icons are set"` — Expected: FAIL (401/404 : route absente, méthode non gérée).

`packages/daemon/src/server.ts` : `ServerOptions` gagne `icons?: Pick<IconStore, "get">` ; dans `makeFetch`, avant le bloc `if (!url.pathname.startsWith("/api/"))` :
```ts
      if (url.pathname.startsWith("/icons/")) {
        return serveIcon(req, url, {
          icons: opts.icons ?? { get: () => null },
          origins: () => allowedOrigins(l),
          hasSession,
        });
      }
```
`packages/daemon/src/daemon.ts` : après `const collab = …` et la création de `components` (le `settings` des notes existe dans `service` : réutiliser `createProjectSettings(store.db)`),
```ts
  const admin = createProjectAdmin({
    docs: service.docs,
    settings: createProjectSettings(store.db),
    icons: service.icons,
    store,
    sharing: (projectId) => collab.syncInfo(projectId),
    activeRuns: (projectId) =>
      agents ? agents.state().runs.filter((r) => r.projectId === projectId && !isTerminal(r.state)).length : 0,
    detach: (projectId) => collab.client.detachProject(projectId),
  });
```
et `startServer({ …, icons: service.icons, handlers: [componentTrustGuard, market.handler, collab.handler, admin.handler] })`.

Run: `bun test packages/daemon/src/daemon.test.ts packages/daemon/src/server*.test.ts` — Expected: PASS.

- [ ] **Step 8: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/daemon packages/schema packages/core` — Expected: PASS.

```bash
git add packages/daemon/src/icons/icon-store.ts packages/daemon/src/icons/icon-store.test.ts packages/daemon/src/icons/decode-icon.ts packages/daemon/src/icons/decode-icon.test.ts packages/daemon/src/icons/icon-route.ts packages/daemon/src/icons/icon-route.test.ts
git commit -m "feat(daemon): magasin et route des images"
git add packages/schema/src/rpc.ts packages/schema/src/agent.ts packages/ui/src/agents/fixtures.ts packages/daemon/src/docs.ts packages/daemon/src/service.ts packages/daemon/src/service.test.ts packages/daemon/src/workspace-config.ts packages/daemon/src/notes/settings.ts packages/daemon/src/notes/settings.test.ts
git commit -m "feat(daemon): meta de projet et empreintes d'images"
git add packages/daemon/src/projects/admin.ts packages/daemon/src/projects/admin.test.ts packages/daemon/src/server.ts packages/daemon/src/daemon.ts packages/daemon/src/daemon.test.ts
git commit -m "feat(daemon): updateProject et setIcon"
```

---

### Task 22: Démon : `deleteProject`

Vague 2 ← T21. Spec §14.3. Décision 1. Suppression d'un projet en une transaction SQLite après les refus (session distante, runs actifs, propriétaire d'un projet partagé) ; un membre quitte (désabonnement) ; le service des notes, le registre des hôtes de sync et le magasin d'images oublient le projet ; l'historique des runs reste. **Relue par `kibo-lead`.**

**Files:**
- Modify: `packages/daemon/src/store.ts` (`delete`), `packages/daemon/src/store.test.ts`
- Modify: `packages/daemon/src/notes/settings.ts` (`remove`), `packages/daemon/src/notes/settings.test.ts`, `packages/daemon/src/notes/index.ts` (`clear`), `packages/daemon/src/notes/index.test.ts`, `packages/daemon/src/notes/service.ts` (`forget`)
- Modify: `packages/daemon/src/docs.ts`, `packages/daemon/src/service.ts` (`removeProject`, `onProjectRemoved`), `packages/daemon/src/components/service.ts:100-108`, `packages/daemon/src/collab/project-hosts.ts:20-35`
- Modify: `packages/daemon/src/projects/admin.ts` (`deleteProject`, handler), `packages/daemon/src/daemon.ts` (rien de plus si `detach` est déjà câblé en T21)
- Create: `packages/daemon/src/projects/delete.test.ts`, `packages/daemon/src/projects/delete-shared.test.ts`

**Interfaces:**
- Consumes: `unregisterProject` (`@kibo/core`, T20), `createProjectAdmin` (T21), `startSyncHarness` (`testing/sync-harness.ts`), `SyncClient.detachProject`, `NotesIndex`, `ProjectSettings`.
- Produces: `Store.delete`, `ProjectSettings.remove`, `NotesIndex.clear`, `NotesService.forget`, `Docs.removeProject`, `Docs.onProjectRemoved`, `ProjectAdmin.deleteProject`.

- [ ] **Step 1: Briques de stockage (tests rouges puis verts)**

`packages/daemon/src/store.test.ts` (compléter) : « delete removes a doc and ignores an unknown id » : `save("project:x", bytes)`, `delete("project:x")`, `load` ⇒ `null`, `ids()` sans `project:x`, `delete("project:x")` de nouveau sans erreur. Implémentation `store.ts` : requête `DELETE FROM docs WHERE id = $id`, méthode `delete: (id) => { remove.run({ id }); }`.

`packages/daemon/src/notes/settings.test.ts` : « remove drops every key of a project and nothing else » : `set(p1, "folder")`, `set(p1, "notesDir")`, `set(p2, "folder")`, `remove(p1)` ⇒ `get(p1, …)` nuls, `get(p2, "folder")` intact. Implémentation : `DELETE FROM project_settings WHERE project_id = $projectId`.

`packages/daemon/src/notes/index.test.ts` : « clear drops the notes, links and ticket mentions of one project » : `replace(p1, "KIB", [note avec lien et mention])`, `replace(p2, …)`, `clear(p1)` ⇒ `list(p1)` vide, `search(p1, …)` vide, `list(p2)` intact. Implémentation `index.ts` : `clear(projectId)` = `DELETE FROM notes / note_links / note_tickets WHERE project_id = $projectId` (mêmes tables que `replace`, dans une transaction).

`packages/daemon/src/notes/service.ts` : `NotesService` gagne `forget(projectId: string): void` = `release(projectId); indexed.delete(projectId); index.clear(projectId);`. Test dans `notes/service.test.ts` : après un `list` qui a indexé un dossier, `forget` ⇒ le watcher est fermé (le faux `watch` du fichier de test compte les `close`) et `index.list(projectId)` est vide.

Run: `bun test packages/daemon/src/store.test.ts packages/daemon/src/notes` — Expected: PASS.

- [ ] **Step 2: `Docs.removeProject` et écouteurs (test rouge puis vert)**

`packages/daemon/src/service.test.ts`, ajouter :
```ts
  test("removeProject forgets the doc everywhere, tells its listeners, and survives a restart", () => {
    const home = tmp();
    const store1 = openStore(home);
    const s1 = createService(store1, { user: "adam" });
    const p = s1.handle(newProject) as ProjectMeta;
    const other = s1.handle({ ...newProject, name: "Facturation", key: "FAC" }) as ProjectMeta;
    const removed: string[] = [];
    const seen: unknown[] = [];
    s1.docs.onProjectRemoved((id) => removed.push(id));
    s1.onChange((m) => seen.push(m));
    s1.docs.removeProject(p.id);
    expect(removed).toEqual([p.id]);
    expect(seen).toEqual([{ projectId: null }]);
    expect(() => s1.docs.project(p.id)).toThrow("NOT_FOUND");
    expect((s1.handle({ method: "listProjects" }) as ProjectSummary[]).map((x) => x.id)).toEqual([other.id]);
    expect(store1.load(`project:${p.id}`)).toBeNull();
    expect(() => s1.docs.removeProject(p.id)).toThrow("NOT_FOUND");
    store1.close();
    const s2 = createService(openStore(home), { user: "adam" });
    expect((s2.handle({ method: "listProjects" }) as ProjectSummary[]).map((x) => x.id)).toEqual([other.id]);
  });
```
Run: `bun test packages/daemon/src/service.test.ts -t removeProject` — Expected: FAIL.

`docs.ts` : `Docs` gagne `removeProject(projectId: string): void;` et `onProjectRemoved(listener: (projectId: string) => void): () => void;`. `service.ts` : `const removedListeners = new Set<(projectId: string) => void>();` et, dans `docs` :
```ts
    removeProject(projectId) {
      docs.project(projectId);
      unregisterProject(workspace, projectId);
      projects.delete(projectId);
      store.delete(projectDocId(projectId));
      docs.save(null);
      for (const listener of removedListeners) listener(projectId);
      docs.emit({ projectId: null });
    },
    onProjectRemoved(listener) {
      removedListeners.add(listener);
      return () => removedListeners.delete(listener);
    },
```
(import `unregisterProject` de `@kibo/core`.)
Run: `bun test packages/daemon/src/service.test.ts` — Expected: PASS.

`packages/daemon/src/components/service.ts`, après la création de `notes` : `const offRemoved = docs.onProjectRemoved((id) => notes.forget(id));` et `offRemoved()` dans `stop()` avant `notes.close()`. `packages/daemon/src/collab/project-hosts.ts`, après `docs.onProjectDoc(watch);` :
```ts
  docs.onProjectRemoved((projectId) => {
    watching.get(projectId)?.();
    watching.delete(projectId);
    access.delete(projectId);
    locked.delete(projectId);
  });
```
(adapter aux noms réels des maps `access` et `locked` du fichier.) Test dans `collab/project-hosts.test.ts` : après `removeProject`, une mutation locale du doc retiré ne notifie plus `onLocalChange`.

- [ ] **Step 3: `deleteProject` (tests rouges puis verts)**

`packages/daemon/src/projects/delete.test.ts` (même `setup` que `admin.test.ts`, recopié, avec un `detach` espion `mock(() => {})`) :
```ts
test("deletes a local project with its settings and icon, in one go", () => {
  const s = setup();
  s.settings.set(s.project.id, "notesDir", "/tmp/ok/notes");
  s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: s.project.id }, icon: { mime: "image/png", data: PNG } });
  expect(s.admin.deleteProject({ method: "deleteProject", projectId: s.project.id }, LOCAL_CONTEXT)).toBeNull();
  expect(s.service.handle({ method: "listProjects" })).toEqual([]);
  expect(() => s.service.handle({ method: "getProject", projectId: s.project.id })).toThrow("NOT_FOUND");
  expect(s.settings.get(s.project.id, "notesDir")).toBeNull();
  expect(s.service.icons.get(`project:${s.project.id}`)).toBeNull();
  expect(s.detach).not.toHaveBeenCalled();
  s.close();
});

test("refuses from a remote session, with active runs, or for the owner of a shared project", () => {
  const remote = setup();
  expect(() => remote.admin.deleteProject({ method: "deleteProject", projectId: remote.project.id }, REMOTE)).toThrow("FORBIDDEN");
  expect(remote.summary()?.id).toBe(remote.project.id);
  remote.close();
  const busy = setup({ activeRuns: 2 });
  expect(() => busy.admin.deleteProject({ method: "deleteProject", projectId: busy.project.id }, LOCAL_CONTEXT)).toThrow("CONFLICT");
  expect(busy.summary()?.id).toBe(busy.project.id);
  busy.close();
  const owner = setup({ sharing: { ...SHARED_SYNC, role: "owner" } });
  expect(() => owner.admin.deleteProject({ method: "deleteProject", projectId: owner.project.id }, LOCAL_CONTEXT)).toThrow("CONFLICT");
  expect(owner.detach).not.toHaveBeenCalled();
  owner.close();
  const unknown = setup();
  expect(() => unknown.admin.deleteProject({ method: "deleteProject", projectId: "nope" }, LOCAL_CONTEXT)).toThrow("NOT_FOUND");
  unknown.close();
});

test("a member or a revoked copy leaves the project: detached, then deleted", () => {
  for (const sharing of [SHARED_SYNC, { ...SHARED_SYNC, role: "owner" as const, access: "revoked" as const }]) {
    const s = setup({ sharing });
    s.admin.deleteProject({ method: "deleteProject", projectId: s.project.id }, LOCAL_CONTEXT);
    expect(s.detach).toHaveBeenCalledWith(s.project.id);
    expect(s.service.handle({ method: "listProjects" })).toEqual([]);
    s.close();
  }
});

test("the handler routes deleteProject", async () => {
  const s = setup();
  expect(await s.admin.handler({ method: "deleteProject", projectId: s.project.id }, LOCAL_CONTEXT)).toEqual({ handled: true, result: null });
  s.close();
});
```
Run: `bun test packages/daemon/src/projects/delete.test.ts` — Expected: FAIL.

`admin.ts` : `ProjectAdmin` gagne `deleteProject(req: Extract<RpcRequest, { method: "deleteProject" }>, ctx: RpcContext): null;` :
```ts
    deleteProject(req, ctx) {
      requireLocal(ctx);
      const { projectId } = req;
      deps.docs.project(projectId);
      if (deps.activeRuns(projectId) > 0) {
        throw new KiboError("CONFLICT", `project ${projectId} has active runs`);
      }
      const sync = deps.sharing(projectId);
      if (sync.shared && sync.role === "owner" && sync.access !== "revoked") {
        throw new KiboError("CONFLICT", `project ${projectId} is shared: stop sharing first`);
      }
      if (sync.shared) deps.detach(projectId);
      deps.store.transaction(() => {
        deps.icons.remove(iconOwnerKey({ kind: "project", projectId }));
        deps.settings.remove(projectId);
        deps.docs.removeProject(projectId);
      });
      return null;
    },
```
et le cas `case "deleteProject": return { handled: true, result: admin.deleteProject(req, ctx) };` dans `handler`.
Run: `bun test packages/daemon/src/projects` — Expected: PASS.

- [ ] **Step 4: Projet partagé, serveur réel (test rouge puis vert)**

`packages/daemon/src/projects/delete-shared.test.ts` (modèle `collab/share.test.ts` : `startSyncHarness({ daemons: 2 })`, `h.connect(0, "Adam")`, `h.connect(1, "Léa")`) :
```ts
test("a member who deletes the project leaves it; the owner keeps it and cannot delete it while shared", async () => {
  const id = await sharedProject();
  const code = await h.inviteRaw(0, id, "editor");
  await h.joinRaw(1, code);
  const adminOf = (i: number) => createProjectAdmin({ docs: d(i).service.docs, settings: d(i).share.settings, icons: d(i).service.icons, store: { transaction: (fn) => fn() }, sharing: d(i).share.syncInfo, activeRuns: () => 0, detach: (projectId) => d(i).client.detachProject(projectId) });
  adminOf(1).deleteProject({ method: "deleteProject", projectId: id }, LOCAL_CONTEXT);
  expect(d(1).service.handle({ method: "listProjects" })).toEqual([]);
  expect(d(1).client.status().projects).toEqual([]);
  expect(() => adminOf(0).deleteProject({ method: "deleteProject", projectId: id }, LOCAL_CONTEXT)).toThrow("CONFLICT");
  expect((d(0).service.handle({ method: "listProjects" }) as ProjectSummary[]).map((p) => p.id)).toEqual([id]);
  expect(serverBytes().length).toBeGreaterThan(0);
  await unshareProject(d(0).share, id);
  adminOf(0).deleteProject({ method: "deleteProject", projectId: id }, LOCAL_CONTEXT);
  expect(d(0).service.handle({ method: "listProjects" })).toEqual([]);
});
```
(`sharedProject`, `serverBytes`, `d` recopiés de `share.test.ts` ; `unshareProject` de `../collab/share`.) Run: `bun test packages/daemon/src/projects/delete-shared.test.ts` — Expected: PASS après Step 3 (rouge seulement si le désabonnement ne vide pas `syncDb` : corriger `detach` alors).

- [ ] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/daemon` — Expected: PASS.

```bash
git add packages/daemon/src/store.ts packages/daemon/src/store.test.ts packages/daemon/src/notes/settings.ts packages/daemon/src/notes/settings.test.ts packages/daemon/src/notes/index.ts packages/daemon/src/notes/index.test.ts packages/daemon/src/notes/service.ts packages/daemon/src/notes/service.test.ts
git commit -m "feat(daemon): oubli d'un projet par les magasins"
git add packages/daemon/src/docs.ts packages/daemon/src/service.ts packages/daemon/src/service.test.ts packages/daemon/src/components/service.ts packages/daemon/src/collab/project-hosts.ts packages/daemon/src/collab/project-hosts.test.ts
git commit -m "feat(daemon): retrait d'un projet des docs"
git add packages/daemon/src/projects/admin.ts packages/daemon/src/projects/delete.test.ts packages/daemon/src/projects/delete-shared.test.ts packages/daemon/src/daemon.ts
git commit -m "feat(daemon): deleteProject"
```

---

### Task 23: Thème par appareil, « Accès web » dans Sécurité, texte d'appairage

Vague 0. Spec §14.5 (thème, Accès web, appairage). Décision 6. `theme.ts` expose la préférence (`setThemePreference`, `useThemePreference`) ; Apparence livre le segmenté Système / Clair / Sombre ; la carte « Accès web » (code d'appairage) passe dans Sécurité avant « Sessions » ; le texte de l'écran d'appairage cite le nouveau chemin. Écran **110**.

**Files:**
- Modify: `packages/ui/src/theme.ts`, `packages/ui/src/theme.test.ts`
- Modify: `packages/ui/src/settings/AppearancePage.tsx`, `packages/ui/src/settings/SecurityPage.tsx`, `packages/ui/src/settings/security-page.test.tsx:230-238`
- Create: `packages/ui/src/settings/WebAccessCard.tsx`, `packages/ui/src/settings/appearance-page.test.tsx`
- Modify: `packages/ui/src/i18n/fr-security.ts` (`appearance`, `webAccess`), `packages/ui/src/i18n/fr.ts:71` (`pairing.help`)

**Interfaces:**
- Consumes: `readThemePreference`, `cycleTheme`, `nextTheme`, `PairingCodeDialog { open, onOpenChange }`, `ToggleGroup`/`ToggleGroupItem` (`@kibo/sdk/ui/toggle-group`).
- Produces: `THEME_PREFERENCES`, `setThemePreference(preference)`, `useThemePreference()` (T24 s'en sert dans le sous-menu Thème) ; `fr.security.appearance = { title, subtitle, theme, themeHelp, system, light, dark }` ; `fr.security.webAccess = { title, help, generate }` ; `WebAccessCard`.

- [ ] **Step 1: Préférence de thème observable (test rouge puis vert)**

`packages/ui/src/theme.test.ts`, ajouter :
```ts
import { setThemePreference, THEME_PREFERENCES, useThemePreference } from "./theme";

test("the preference is set directly, applied, and observed by the hook", () => {
  expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
  const { result } = renderHook(() => useThemePreference());
  expect(result.current).toBe("system");
  act(() => setThemePreference("dark"));
  expect(result.current).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("kibo.theme")).toBe("dark");
  act(() => setThemePreference("system"));
  expect(result.current).toBe("system");
  expect(localStorage.getItem("kibo.theme")).toBeNull();
  act(() => {
    localStorage.setItem("kibo.theme", "light");
    window.dispatchEvent(new StorageEvent("storage", { key: "kibo.theme", newValue: "light" }));
  });
  expect(result.current).toBe("light");
  expect(cycleTheme()).toBe("dark");
  expect(result.current).toBe("dark");
});
```
Run: `bun test packages/ui/src/theme.test.ts` — Expected: FAIL.

`packages/ui/src/theme.ts` :
```ts
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

export function setThemePreference(preference: ThemePreference): void {
  withStorage((s) => (preference === "system" ? s.removeItem(KEY) : s.setItem(KEY, preference)), undefined);
  apply(preference);
  notify();
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  setThemePreference(next);
  return next;
}

function subscribePreference(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) {
      apply(readThemePreference());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const useThemePreference = (): ThemePreference =>
  useSyncExternalStore(subscribePreference, readThemePreference);
```
(`cycleTheme` remplace l'ancienne version ; `followSystemTheme`, `currentTheme`, `useTheme` inchangés.)
Run: `bun test packages/ui/src/theme.test.ts` — Expected: PASS.

- [ ] **Step 2: Textes**

`packages/ui/src/i18n/fr-security.ts` : remplacer le bloc `appearance` par
```ts
  appearance: {
    title: "Apparence",
    subtitle: "Kibo suit le thème de ton système par défaut.",
    theme: "Thème",
    themeHelp: "Le thème système suit les réglages de ton ordinateur.",
    system: "Système",
    light: "Clair",
    dark: "Sombre",
  },
  webAccess: {
    title: "Accès web",
    help: "Appaire un navigateur de cet ordinateur ou du réseau local avec un code à usage unique.",
    generate: "Générer un code",
  },
```
`packages/ui/src/i18n/fr.ts:71` : `help: "Dans l'app Kibo : Paramètres › Sécurité › Accès web › Générer un code. Entre le code à 6 caractères ci-dessous.",`. `grep -rn "Apparence & général" packages/ui/src e2e` doit ne rien renvoyer ensuite (adapter `shell/pairing-screen.test.tsx` s'il cite le texte).

- [ ] **Step 3: Page Apparence (test rouge puis vert)**

`packages/ui/src/settings/appearance-page.test.tsx` :
```tsx
import { afterEach, beforeEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearancePage } from "./AppearancePage";

beforeEach(() => localStorage.clear());
afterEach(() => document.documentElement.classList.remove("dark"));

test("the theme segment reflects and sets the preference (screen 110)", async () => {
  render(<AppearancePage />);
  expect(screen.getByRole("heading", { level: 1, name: "Apparence" })).toBeTruthy();
  expect(screen.getByText("Le thème système suit les réglages de ton ordinateur.")).toBeTruthy();
  const group = screen.getByRole("group", { name: "Thème" });
  expect(screen.getByRole("radio", { name: "Système" }).getAttribute("aria-checked")).toBe("true");
  await userEvent.setup().click(screen.getByRole("radio", { name: "Sombre" }));
  expect(screen.getByRole("radio", { name: "Sombre" }).getAttribute("aria-checked")).toBe("true");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("kibo.theme")).toBe("dark");
  expect(group.querySelectorAll("[role=radio]")).toHaveLength(3);
  expect(screen.queryByText("Accès web")).toBeNull();
});
```
Run: `bun test packages/ui/src/settings/appearance-page.test.tsx` — Expected: FAIL.

`packages/ui/src/settings/AppearancePage.tsx` :
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { fr } from "../i18n/fr";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";
import { SettingsNav } from "./SettingsNav";

const t = fr.security.appearance;
const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm";
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);

export function ThemeSegment() {
  const preference = useThemePreference();
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={t.theme}
      className="rounded-lg bg-muted p-[3px]"
      value={preference}
      onValueChange={(v) => {
        if (isPreference(v)) setThemePreference(v);
      }}
    >
      {THEME_PREFERENCES.map((p) => (
        <ToggleGroupItem key={p} value={p} className={SEGMENT}>
          {t[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function AppearancePage() {
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="appearance" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{t.theme}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 text-sm">
            <p className="text-xs text-muted-foreground">{t.themeHelp}</p>
            <ThemeSegment />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```
(Un `ToggleGroup type="single"` de Radix rend `role="group"` et des `role="radio"` ; si le rôle réel diffère dans happy-dom, adapter le test au rôle rendu, pas l'inverse.)
Run: `bun test packages/ui/src/settings/appearance-page.test.tsx` — Expected: PASS.

- [ ] **Step 4: Carte « Accès web » dans Sécurité (test rouge puis vert)**

`packages/ui/src/settings/security-page.test.tsx` : remplacer le test « the appearance page offers to generate a pairing code (screen 15) » par
```tsx
test("web access sits in security before sessions and generates a pairing code (screen 110)", async () => {
  codeExpiresAt = Date.now() + 300_000;
  render(<SecurityPage />);
  const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(titles.indexOf("Accès web")).toBeGreaterThan(titles.indexOf("Accès distant"));
  expect(titles.indexOf("Accès web")).toBeLessThan(titles.indexOf("Sessions"));
  expect(
    screen.getByText("Appaire un navigateur de cet ordinateur ou du réseau local avec un code à usage unique."),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Générer un code" }));
  expect(await screen.findByText("K7Q-4M2")).toBeTruthy();
});
```
(`CardTitle` rend un `div` : si `getAllByRole("heading")` ne trouve rien, comparer l'ordre avec `screen.getByText("Accès web").compareDocumentPosition(screen.getByText("Sessions"))` et `Node.DOCUMENT_POSITION_FOLLOWING`.)
Run: `bun test packages/ui/src/settings/security-page.test.tsx` — Expected: FAIL.

`packages/ui/src/settings/WebAccessCard.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { PairingCodeDialog } from "./PairingCodeDialog";

const t = fr.security.webAccess;

export function WebAccessCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 text-sm">
        <p className="text-xs text-muted-foreground">{t.help}</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t.generate}
        </Button>
        {open && <PairingCodeDialog open onOpenChange={setOpen} />}
      </CardContent>
    </Card>
  );
}
```
`SecurityPage.tsx` : `<RemoteAccessCard /> <WebAccessCard /> <SessionsCard /> <IsolationCard />`.
Run: `bun test packages/ui/src/settings` — Expected: PASS.

- [ ] **Step 5: Gate et commits**

Run: `bun install --frozen-lockfile && bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS, budget ≤ celui mesuré en T18 (Apparence et Sécurité sont déjà hors de l'entrée ; `theme.ts` grossit de quelques lignes).

```bash
git add packages/ui/src/theme.ts packages/ui/src/theme.test.ts
git commit -m "feat(ui): préférence de thème observable"
git add packages/ui/src/settings/AppearancePage.tsx packages/ui/src/settings/appearance-page.test.tsx packages/ui/src/settings/WebAccessCard.tsx packages/ui/src/settings/SecurityPage.tsx packages/ui/src/settings/security-page.test.tsx packages/ui/src/i18n/fr-security.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): thème dans Apparence, accès web dans Sécurité"
```
(Ajouter `packages/ui/src/shell/pairing-screen.test.tsx` au second commit s'il a changé.)

---

### Task 24: En-tête : historique des runs et menu de l'avatar

Vague 1 ← T23 (thème), T18 (budget mesuré). Spec §14.5 (cloche, avatar). Décisions 5 et 6. La cloche devient un menu : les 20 derniers runs (`waiting_input`, `done`, `failed`, `cancelled`), une pastille des runs non vus depuis `localStorage["kibo.runs.seenAt"]`, « Répondre » ouvre le run dans le tiroir, « Activer les notifications » en pied dans un navigateur. L'avatar ouvre : nom, compte de sync, sous-menu Thème, Sessions, Paramètres. Les contenus sont chargés à l'ouverture. Écrans **111**, **112**.

**Files:**
- Create: `packages/ui/src/shell/run-history.ts`, `run-history.test.ts`, `RunHistoryButton.tsx`, `RunHistoryList.tsx`, `run-history-button.test.tsx`, `UserMenu.tsx`, `UserMenuContent.tsx`, `user-menu.test.tsx`
- Modify: `packages/ui/src/shell/ShellHeader.tsx`, `packages/ui/src/shell/Shell.tsx:229-241`, `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/src/shell/agents-shell.test.tsx:286-295`, `packages/ui/src/i18n/fr.ts:65-68` (`header`), `packages/ui/scripts/bundle-report.ts`

**Interfaces:**
- Consumes: `AgentsState`, `RunView`, `RunState`, `runSubject`, `fr.agents.states`, `relativeTime`, `NotifyButton`, `UserAvatar`, `useSyncServerStatus`, `setThemePreference`, `useThemePreference`, `THEME_PREFERENCES` (T23), `fr.security.appearance.{system,light,dark}` (T23), `lazyPanel`, `DropdownMenu*` dont `DropdownMenuSub`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`.
- Produces: contrat « shell/run-history.ts (T24) » ; `RunHistoryButton`, `RunHistoryList`, `UserMenu`, `UserMenuContent` ; `ShellHeader` props `now`, `onOpenRun`, `onOpen` ; `fr.header` étendu.

- [ ] **Step 1: Modèle de l'historique (test rouge puis vert)**

`packages/ui/src/shell/run-history.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";
import { markSeen, readSeenAt, runHistory, runMoment, unseenCount } from "./run-history";

const MIN = 60_000;
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("history keeps finished and waiting runs, newest first, twenty at most", () => {
  const state = agentsFixture();
  state.runs = [
    runFixture({ id: "r1", state: "running", stateSince: NOW - MIN }),
    runFixture({ id: "r2", state: "done", stateSince: NOW - 50 * MIN, endedAt: NOW - 41 * MIN }),
    runFixture({ id: "r3", state: "waiting_input", stateSince: NOW - 3 * MIN, endedAt: null }),
    runFixture({ id: "r4", state: "failed", stateSince: NOW - 3 * 60 * MIN, endedAt: NOW - 2 * 60 * MIN }),
    runFixture({ id: "r5", state: "cancelled", stateSince: NOW - 10 * MIN, endedAt: NOW - 10 * MIN }),
    runFixture({ id: "r6", state: "queued", stateSince: NOW }),
    ...Array.from({ length: 25 }, (_, i) =>
      runFixture({ id: `old${i}`, state: "done", stateSince: 0, endedAt: NOW - (60 + i) * 60 * MIN }),
    ),
  ];
  expect(runMoment(state.runs[1] as never)).toBe(NOW - 41 * MIN);
  expect(runMoment(state.runs[2] as never)).toBe(NOW - 3 * MIN);
  const history = runHistory(state);
  expect(history).toHaveLength(20);
  expect(history.slice(0, 5).map((r) => r.id)).toEqual(["r3", "r5", "r2", "r4", "old0"]);
  expect(runHistory(state, 2).map((r) => r.id)).toEqual(["r3", "r5"]);
});

test("unseen counts waiting, done and failed runs after the seen mark, never cancelled ones", () => {
  const runs = [
    runFixture({ id: "a", state: "waiting_input", stateSince: NOW - MIN, endedAt: null }),
    runFixture({ id: "b", state: "done", stateSince: 0, endedAt: NOW - 2 * MIN }),
    runFixture({ id: "c", state: "cancelled", stateSince: 0, endedAt: NOW - MIN }),
    runFixture({ id: "d", state: "failed", stateSince: 0, endedAt: NOW - 30 * MIN }),
  ];
  expect(unseenCount(runs, 0)).toBe(3);
  expect(unseenCount(runs, NOW - 10 * MIN)).toBe(2);
  expect(unseenCount(runs, NOW)).toBe(0);
});

test("the seen mark lives in localStorage and defaults to zero, even without storage", () => {
  expect(readSeenAt()).toBe(0);
  markSeen(NOW);
  expect(readSeenAt()).toBe(NOW);
  expect(localStorage.getItem("kibo.runs.seenAt")).toBe(String(NOW));
  localStorage.setItem("kibo.runs.seenAt", "garbage");
  expect(readSeenAt()).toBe(0);
  const storage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  try {
    expect(readSeenAt()).toBe(0);
    markSeen(NOW);
    expect(errors).toHaveLength(2);
  } finally {
    console.error = log;
    if (storage) Object.defineProperty(window, "localStorage", storage);
  }
});
```
Run: `bun test packages/ui/src/shell/run-history.test.ts` — Expected: FAIL.

`packages/ui/src/shell/run-history.ts` :
```ts
import type { AgentsState, RunState, RunView } from "@kibo/schema";

export const HISTORY_STATES: readonly RunState[] = ["waiting_input", "done", "failed", "cancelled"];
export const NOTICE_STATES: readonly RunState[] = ["waiting_input", "done", "failed"];
const SEEN_KEY = "kibo.runs.seenAt";

export const runMoment = (run: RunView): number => run.endedAt ?? run.stateSince;

export function runHistory(state: AgentsState, limit = 20): RunView[] {
  return state.runs
    .filter((r) => HISTORY_STATES.includes(r.state))
    .sort((a, b) => runMoment(b) - runMoment(a))
    .slice(0, limit);
}

export function unseenCount(runs: readonly RunView[], seenAt: number): number {
  return runs.filter((r) => NOTICE_STATES.includes(r.state) && runMoment(r) > seenAt).length;
}

function withStorage<T>(work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.localStorage);
  } catch (e) {
    console.error("run history storage unavailable", e);
    return fallback;
  }
}

export function readSeenAt(): number {
  const raw = withStorage((s) => s.getItem(SEEN_KEY), null);
  const value = raw === null ? 0 : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function markSeen(now: number): void {
  withStorage((s) => s.setItem(SEEN_KEY, String(now)), undefined);
}
```
Run: `bun test packages/ui/src/shell/run-history.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 2: Textes**

`packages/ui/src/i18n/fr.ts` › `header` :
```ts
  header: {
    newTicket: "Ticket",
    newTicketIn: (project: string) => `Nouveau ticket dans ${project}`,
    runHistory: "Historique des runs",
    unseen: (n: number) => `${n} nouveau${n > 1 ? "x" : ""}`,
    noRuns: "Aucun run pour l'instant.",
    reply: "Répondre",
    userMenu: (user: string) => `Menu de ${user}`,
    theme: "Thème",
    sessions: "Sessions",
    settings: "Paramètres",
    account: (name: string, host: string) => `${name} · ${host}`,
  },
```

- [ ] **Step 3: Cloche et liste (tests rouges puis verts)**

`packages/ui/src/shell/run-history-button.test.tsx` :
```tsx
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";

mock.module("../state/use-sync-server", () => ({
  useSyncServerStatus: () => ({ status: null, error: null, reload() {} }),
}));
const { RunHistoryButton } = await import("./RunHistoryButton");

const MIN = 60_000;
const state = () => {
  const s = agentsFixture();
  s.runs = [
    runFixture({ id: "r3", label: "opus-dev-2", ticketKey: "KIB-14", ticketTitle: "Vue graphe", state: "waiting_input", stateSince: NOW - 3 * MIN, endedAt: null, question: "Quel schéma ?" }),
    runFixture({ id: "r2", label: "sonnet-review", ticketKey: "KIB-11", ticketTitle: "Revue", state: "done", stateSince: 0, endedAt: NOW - 41 * MIN }),
    runFixture({ id: "r4", label: "opus-dev-1", ticketKey: "KIB-9", ticketTitle: "Sidecar", state: "failed", stateSince: 0, endedAt: NOW - 2 * 60 * MIN }),
    runFixture({ id: "r1", state: "running", stateSince: NOW - MIN }),
  ];
  return s;
};
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("the bell counts unseen runs, lists the history on open and marks it seen (screen 111)", async () => {
  const opened: string[] = [];
  render(<RunHistoryButton agents={state()} notifications="native" now={NOW} onOpenRun={(id) => opened.push(id)} />);
  const bell = screen.getByRole("button", { name: "Historique des runs · 3 nouveaux" });
  expect(bell.textContent).toContain("3");
  await userEvent.setup().click(bell);
  const menu = await screen.findByRole("menu", { name: "Historique des runs" });
  const items = within(menu).getAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual([
    "opus-dev-2 · KIB-14 · Attend une réponse · il y a 3 minRépondre",
    "sonnet-review · KIB-11 · Terminé · il y a 41 min",
    "opus-dev-1 · KIB-9 · Échec · il y a 2 h",
  ]);
  expect(within(menu).queryByRole("button", { name: "Activer les notifications" })).toBeNull();
  await userEvent.setup().click(items[0] as HTMLElement);
  expect(opened).toEqual(["r3"]);
  expect(localStorage.getItem("kibo.runs.seenAt")).toBe(String(NOW));
  await waitFor(() => expect(screen.getByRole("button", { name: "Historique des runs" }).textContent).not.toContain("3"));
});

test("without daemon state the bell is inert; without history the list says so; the browser gets the notification switch", async () => {
  const { unmount } = render(<RunHistoryButton agents={null} notifications="browser" now={NOW} onOpenRun={() => {}} />);
  expect(screen.getByRole("button", { name: "Historique des runs" }).hasAttribute("disabled")).toBe(true);
  unmount();
  const empty = agentsFixture();
  empty.runs = [];
  render(<RunHistoryButton agents={empty} notifications="browser" now={NOW} onOpenRun={() => {}} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Historique des runs" }));
  const menu = await screen.findByRole("menu", { name: "Historique des runs" });
  expect(within(menu).getByText("Aucun run pour l'instant.")).toBeTruthy();
  expect(within(menu).getByRole("button", { name: "Activer les notifications" })).toBeTruthy();
});
```
(Le second test suppose `Notification.permission === "default"` : reprendre `fakeNotification` de `agents-shell.test.tsx` si l'environnement expose `Notification` autrement.)
Run: `bun test packages/ui/src/shell/run-history-button.test.tsx` — Expected: FAIL.

`packages/ui/src/shell/RunHistoryList.tsx` :
```tsx
import { type RunView, runSubject, type Session } from "@kibo/schema";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@kibo/sdk/ui/dropdown-menu";
import { fr } from "../i18n/fr";
import { relativeTime } from "../lib/relative-time";
import { NotifyButton } from "./NotifyButton";

type Props = { runs: RunView[]; now: number; notifications: Session["notifications"]; onOpenRun(runId: string): void };

export function RunHistoryList({ runs, now, notifications, onOpenRun }: Props) {
  return (
    <>
      <DropdownMenuLabel>{fr.header.runHistory}</DropdownMenuLabel>
      {runs.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{fr.header.noRuns}</p>}
      {runs.map((run) => (
        <DropdownMenuItem key={run.id} className="grid gap-0.5" onSelect={() => onOpenRun(run.id)}>
          <span className="truncate text-sm">
            {run.label} · {runSubject(run, fr.agents.states[run.state])} · {relativeTime(run.endedAt ?? run.stateSince, now)}
          </span>
          {run.state === "waiting_input" && <span className="text-xs text-brand">{fr.header.reply}</span>}
        </DropdownMenuItem>
      ))}
      {notifications === "browser" && (
        <>
          <DropdownMenuSeparator />
          <div className="flex justify-end px-1 py-0.5">
            <NotifyButton />
          </div>
        </>
      )}
    </>
  );
}
```
(`runSubject(run, text)` rend `KIB-14 · text` ; le libellé attendu est `opus-dev-2 · KIB-14 · Attend une réponse · il y a 3 min`.) `NotifyButton` rend une `Bell` inerte quand la permission n'est plus `default` : garder tel quel.

`packages/ui/src/shell/lazy-screens.ts`, ajouter :
```ts
export const RunHistoryList = lazyPanel(
  () => import("./RunHistoryList").then((m) => m.RunHistoryList),
  fr.lazy,
  hidden,
);
export const UserMenuContent = lazyPanel(
  () => import("./UserMenuContent").then((m) => m.UserMenuContent),
  fr.lazy,
  hidden,
);
```

`packages/ui/src/shell/RunHistoryButton.tsx` :
```tsx
import type { AgentsState, Session } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { fr } from "../i18n/fr";
import { RunHistoryList } from "./lazy-screens";
import { markSeen, readSeenAt, runHistory, unseenCount } from "./run-history";

type Props = { agents: AgentsState | null; notifications: Session["notifications"]; now: number; onOpenRun(runId: string): void };

export function RunHistoryButton({ agents, notifications, now, onOpenRun }: Props) {
  const [seenAt, setSeenAt] = useState(readSeenAt);
  const [open, setOpen] = useState(false);
  const runs = useMemo(() => (agents ? runHistory(agents) : []), [agents]);
  const unseen = agents ? unseenCount(runs, seenAt) : 0;
  const label = unseen > 0 ? `${fr.header.runHistory} · ${fr.header.unseen(unseen)}` : fr.header.runHistory;
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      markSeen(now);
      setSeenAt(now);
    }
  };
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative size-7" aria-label={label} disabled={agents === null}>
          <Bell />
          {unseen > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-3.5 place-items-center rounded-full bg-brand px-0.5 text-3xs font-semibold text-white">
              {unseen}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-90" aria-label={fr.header.runHistory}>
        {open && <RunHistoryList runs={runs} now={now} notifications={notifications} onOpenRun={onOpenRun} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
Run: `bun test packages/ui/src/shell/run-history-button.test.tsx` — Expected: PASS, 2 tests.

- [ ] **Step 4: Menu de l'avatar (test rouge puis vert)**

`packages/ui/src/shell/user-menu.test.tsx` :
```tsx
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { SyncStatus, TabTarget } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let status: SyncStatus | null = null;
mock.module("../state/use-sync-server", () => ({
  useSyncServerStatus: () => ({ status, error: null, reload() {} }),
}));
const { UserMenu } = await import("./UserMenu");

beforeEach(() => {
  localStorage.clear();
  status = null;
});
afterEach(() => document.documentElement.classList.remove("dark"));

test("the avatar opens a menu with the theme submenu, sessions and settings (screen 112)", async () => {
  status = { state: "connected", serverUrl: "https://sync.galadrim.fr", user: { id: "u1", name: "Adam" }, deviceId: "d", retryAt: null, lastError: null, projects: [] };
  const opened: TabTarget[] = [];
  render(<UserMenu viewer="adam" onOpen={(t) => opened.push(t)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  const menu = await screen.findByRole("menu", { name: "Menu de adam" });
  expect(within(menu).getByText("adam")).toBeTruthy();
  expect(within(menu).getByText("Adam · sync.galadrim.fr")).toBeTruthy();
  await user.click(within(menu).getByRole("menuitem", { name: "Thème" }));
  const system = await screen.findByRole("menuitemradio", { name: "Système" });
  expect(system.getAttribute("aria-checked")).toBe("true");
  await user.click(screen.getByRole("menuitemradio", { name: "Sombre" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  await user.click(await screen.findByRole("menuitem", { name: "Sessions" }));
  await user.click(screen.getByRole("button", { name: "Menu de adam" }));
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres" }));
  expect(opened).toEqual([
    { kind: "screen", screen: "security" },
    { kind: "screen", screen: "general" },
  ]);
});

test("without a sync account only the name shows", async () => {
  render(<UserMenu viewer="adam" onOpen={() => {}} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Menu de adam" }));
  const menu = await screen.findByRole("menu", { name: "Menu de adam" });
  expect(within(menu).queryByText(/·/)).toBeNull();
});
```
Run: `bun test packages/ui/src/shell/user-menu.test.tsx` — Expected: FAIL.

`packages/ui/src/shell/UserMenuContent.tsx` :
```tsx
import type { TabTarget } from "@kibo/schema";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Settings, Shield, SunMoon } from "lucide-react";
import { fr } from "../i18n/fr";
import { useSyncServerStatus } from "../state/use-sync-server";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";

type Props = { viewer: string; onOpen(target: TabTarget): void };
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);
const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function UserMenuContent({ viewer, onOpen }: Props) {
  const preference = useThemePreference();
  const { status } = useSyncServerStatus();
  const account = status?.user && status.serverUrl ? fr.header.account(status.user.name, hostOf(status.serverUrl)) : null;
  return (
    <>
      <DropdownMenuLabel className="grid gap-0.5">
        <span>{viewer}</span>
        {account && <span className="text-xs font-normal text-muted-foreground">{account}</span>}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SunMoon aria-hidden />
          {fr.header.theme}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(v) => {
              if (isPreference(v)) setThemePreference(v);
            }}
          >
            {THEME_PREFERENCES.map((p) => (
              <DropdownMenuRadioItem key={p} value={p}>
                {fr.security.appearance[p]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpen({ kind: "screen", screen: "security" })}>
        <Shield aria-hidden />
        {fr.header.sessions}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpen({ kind: "screen", screen: "general" })}>
        <Settings aria-hidden />
        {fr.header.settings}
      </DropdownMenuItem>
    </>
  );
}
```
(Les `catch {}` sans variable sont acceptés par Biome ; l'URL du serveur vient du démon, la garde évite une exception sur une valeur inattendue.)

`packages/ui/src/shell/UserMenu.tsx` :
```tsx
import type { TabTarget } from "@kibo/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { UserMenuContent } from "./lazy-screens";
import { UserAvatar } from "./UserAvatar";

type Props = { viewer: string; onOpen(target: TabTarget): void };

export function UserMenu({ viewer, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={fr.header.userMenu(viewer)}
      >
        <UserAvatar user={viewer} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" aria-label={fr.header.userMenu(viewer)}>
        {open && <UserMenuContent viewer={viewer} onOpen={onOpen} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
(`UserAvatar` garde `role="img"` : le déclencheur est un `button` de Radix, son nom accessible vient d'`aria-label`.)
Run: `bun test packages/ui/src/shell/user-menu.test.tsx` — Expected: PASS, 2 tests.

- [ ] **Step 5: En-tête et Shell (test adapté)**

`packages/ui/src/shell/ShellHeader.tsx` : retirer les imports `Bell`, `NotifyButton`, `UserAvatar` ; `Props` gagne `now: number; onOpenRun(runId: string): void; onOpen(target: TabTarget): void;` ; remplacer le bloc `{notifications === "browser" ? <NotifyButton /> : <Bell … />}` et `<UserAvatar user={viewer} />` par
```tsx
      <RunHistoryButton agents={agents} notifications={notifications} now={now} onOpenRun={onOpenRun} />
      <UserMenu viewer={viewer} onOpen={onOpen} />
```
(imports `RunHistoryButton` de `./RunHistoryButton`, `UserMenu` de `./UserMenu`). `Shell.tsx:229-241` : ajouter `now={now}`, `onOpenRun={setFocusRun}`, `onOpen={(t) => go(t)}`.

`agents-shell.test.tsx` : remplacer « the bell is offered in the browser only » par
```tsx
test("the notification switch lives in the bell menu, in the browser only", async () => {
  const fake = fakeNotification("default");
  const user = userEvent.setup();
  const view = render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  await user.click(header().getByRole("button", { name: /Historique des runs/ }));
  let menu = await screen.findByRole("menu", { name: "Historique des runs" });
  expect(within(menu).queryByRole("button", { name: "Activer les notifications" })).toBeNull();
  await user.keyboard("{Escape}");
  view.unmount();
  render(<Shell viewer="adam" notifications="browser" />);
  await go("#/");
  await user.click(header().getByRole("button", { name: /Historique des runs/ }));
  menu = await screen.findByRole("menu", { name: "Historique des runs" });
  expect(within(menu).getByRole("button", { name: "Activer les notifications" })).toBeTruthy();
  fake.restore();
});
```
et ajouter, dans le même fichier, le parcours « Répondre » : ouvrir la cloche, cliquer la ligne `waiting_input` de `agentsFixture()`, vérifier que le tiroir des agents affiche la question du run (même attente que le test existant sur `onAnswer`, `grep -n "onAnswer\|focusRunId" packages/ui/src/shell/agents-shell.test.tsx` pour le motif).

`packages/ui/scripts/bundle-report.ts` : ajouter `/\/packages\/ui\/src\/shell\/(RunHistoryList|UserMenuContent)\.tsx$/,`.

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS ; budget ≤ 230 000 (attendu : + ~0,6 kB pour les deux déclencheurs et `run-history.ts`, contenus hors de l'entrée). Au-delà, `ScreenActions` sort de l'entrée comme prévu en T18 (Step 9) si ce n'est pas déjà fait.

- [ ] **Step 6: Commits**

```bash
git add packages/ui/src/shell/run-history.ts packages/ui/src/shell/run-history.test.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): modèle de l'historique des runs"
git add packages/ui/src/shell/RunHistoryButton.tsx packages/ui/src/shell/RunHistoryList.tsx packages/ui/src/shell/run-history-button.test.tsx packages/ui/src/shell/UserMenu.tsx packages/ui/src/shell/UserMenuContent.tsx packages/ui/src/shell/user-menu.test.tsx packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ShellHeader.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/agents-shell.test.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): cloche d'historique et menu de l'avatar"
```

---

### Task 25: Page Raccourcis et réglages factices retirés

Vague 0 (après T18 pour `bundle-report.ts`, `lazy-screens.ts`, `NewProjectForm.tsx`). Spec §14.5 (Raccourcis, réglages retirés). Décision 7. Nouvel écran `shortcuts` (`#/settings/shortcuts`, écran **77**), liste statique depuis `fr-shortcuts.ts` ; retrait de la carte « Application » (Général, écran 76 amendé), de « Créés par moi » (Mes tickets), de « Depuis un projet » (Nouveau projet) et de « Générer avec Claude » (commit, livré au lot 9).

**Files:**
- Modify: `packages/schema/src/tabs.ts:8-20`, `packages/ui/src/tabs/target-hash.ts:5-17`, `packages/ui/src/tabs/screens.ts`, `packages/ui/src/tabs/tabs.test.ts` (codec), `packages/ui/src/palette/CommandPalette.tsx:50-60`, `packages/ui/src/shell/AppSidebar.tsx:64-72` (`SETTINGS_SCREENS`), `packages/ui/src/settings/SettingsNav.tsx`, `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/scripts/bundle-report.ts`
- Create: `packages/ui/src/settings/shortcuts.ts`, `shortcuts.test.ts`, `ShortcutsPage.tsx`, `shortcuts-page.test.tsx`, `packages/ui/src/i18n/fr-shortcuts.ts`
- Modify: `packages/ui/src/settings/GeneralPage.tsx`, `general-page.test.tsx`, `packages/ui/src/mine/my-tickets.ts:3,19-24`, `MyTicketsPage.tsx:22-50`, `my-tickets-page.test.tsx:60`, `packages/ui/src/dialogs/NewProjectForm.tsx:92-100`, `packages/ui/src/code/CommitPanel.tsx:54-67`, `packages/ui/src/code/commit.test.tsx:56`, `packages/ui/src/i18n/fr.ts` (`settings`, `mine`, `newProject`), `packages/ui/src/i18n/fr-code.ts:118-119`

**Interfaces:**
- Consumes: `shortcutLabel(keys, mac)`, `isMac()`, `SettingsNav`, `Screen`, `targetToHash`.
- Produces: `Screen` gagne `"shortcuts"` ; `shortcutGroups(mac): ShortcutGroup[]` ; `ShortcutsPage` ; `MineTab = "assigned" | "agents"` ; `SettingsNav` accepte `active="shortcuts"` (T26 ajoute `"workspace"` de la même façon).

- [ ] **Step 1: Écran `shortcuts` dans les tables (test rouge puis vert)**

`packages/ui/src/tabs/tabs.test.ts`, dans la liste `targets` du codec : ajouter `{ kind: "screen", screen: "shortcuts" }` ; et un test :
```ts
test("the shortcuts screen has its settings hash", () => {
  expect(targetToHash({ kind: "screen", screen: "shortcuts" })).toBe("#/settings/shortcuts");
  expect(hashToTarget("#/settings/shortcuts")).toEqual({ kind: "screen", screen: "shortcuts" });
});
```
Run: `bun test packages/ui/src/tabs/tabs.test.ts` — Expected: FAIL (typecheck / hash inconnu).

`packages/schema/src/tabs.ts` : ajouter `"shortcuts"` à `Screen` après `"sync"`. `target-hash.ts` : `shortcuts: "#/settings/shortcuts",`. `screens.ts` : `shortcuts: { title: fr.settings.shortcuts, icon: Keyboard, crumbs: [fr.nav.settings, fr.settings.shortcuts] },` (import `Keyboard`). `CommandPalette.tsx` : `shortcuts: SCREENS.shortcuts.icon,`. `AppSidebar.tsx` `SETTINGS_SCREENS` : `"shortcuts"`. `SettingsNav.tsx` : `SettingsScreen` inclut `"shortcuts"` ; l'entrée devient `{ id: "shortcuts", label: fr.settings.shortcuts, icon: Keyboard, screen: "shortcuts" }` ; la branche `if (!screen)` et `fr.settings.soon` disparaissent (`screen` devient obligatoire dans `Item`). `ScreenView.tsx` : `if (screen === "shortcuts") return <ShortcutsPage />;`. `lazy-screens.ts` : `export const ShortcutsPage = lazyPanel(() => import("../settings/ShortcutsPage").then((m) => m.ShortcutsPage), fr.lazy);`. `bundle-report.ts` : `/\/packages\/ui\/src\/(settings\/ShortcutsPage\.tsx|i18n\/fr-shortcuts\.ts)$/,`.
Run: `bun run typecheck && bun test packages/ui/src/tabs` — Expected: PASS (le typecheck signale tout `Record<Screen, …>` oublié).

- [ ] **Step 2: Liste des raccourcis (test rouge puis vert)**

`packages/ui/src/i18n/fr-shortcuts.ts` :
```ts
export const frShortcuts = {
  title: "Raccourcis",
  subtitle:
    "⌘ sur macOS, Ctrl ailleurs. Dans un navigateur, certains raccourcis restent pris par le navigateur ; ils fonctionnent dans la fenêtre Kibo.",
  navigation: "Navigation",
  palette: "Palette",
  code: "Code",
  items: {
    palette: "Palette de commandes",
    newTab: "Nouvel onglet (palette)",
    closeTab: "Fermer l'onglet",
    home: "Aller à l'Accueil",
    goToTab: "Aller à un onglet",
    lastTab: "Dernier onglet",
    togglePin: "Épingler ou détacher l'onglet",
    openSelection: "Ouvrir la sélection",
    openInSheet: "Ouvrir un ticket dans le Sheet",
    nextFilter: "Filtre suivant (Tout, Tickets, Pages…)",
    save: "Enregistrer le fichier édité",
    externalEditor: "Ouvrir dans l'éditeur externe",
    commit: "Valider le commit",
  },
  range: "…",
} as const;
```
`packages/ui/src/settings/shortcuts.test.ts` :
```ts
import { expect, test } from "bun:test";
import { shortcutGroups } from "./shortcuts";

test("groups follow screen 77, with platform labels", () => {
  const mac = shortcutGroups(true);
  expect(mac.map((g) => g.title)).toEqual(["Navigation", "Palette", "Code"]);
  expect(mac[0]?.items.map((i) => [i.label, i.keys, i.range ?? false])).toEqual([
    ["Palette de commandes", ["⌘K"], false],
    ["Nouvel onglet (palette)", ["⌘T"], false],
    ["Fermer l'onglet", ["⌘W"], false],
    ["Épingler ou détacher l'onglet", ["⌘⇧P"], false],
    ["Aller à l'Accueil", ["⌘1"], false],
    ["Aller à un onglet", ["⌘2", "⌘8"], true],
    ["Dernier onglet", ["⌘9"], false],
  ]);
  expect(mac[1]?.items.map((i) => i.keys)).toEqual([["↵"], ["⌘↵"], ["Tab"]]);
  expect(mac[2]?.items.map((i) => i.keys)).toEqual([["⌘S"], ["⌘⇧O"], ["⌘↵"]]);
  const pc = shortcutGroups(false);
  expect(pc[0]?.items[0]?.keys).toEqual(["Ctrl+K"]);
  expect(pc[0]?.items[5]?.keys).toEqual(["Ctrl+2", "Ctrl+8"]);
  expect(pc[1]?.items.map((i) => i.keys)).toEqual([["↵"], ["Ctrl+↵"], ["Tab"]]);
});
```
Run: `bun test packages/ui/src/settings/shortcuts.test.ts` — Expected: FAIL.

`packages/ui/src/settings/shortcuts.ts` :
```ts
import { frShortcuts } from "../i18n/fr-shortcuts";
import { shortcutLabel } from "../lib/shortcut-label";

export type ShortcutItem = { label: string; keys: string[]; range?: boolean };
export type ShortcutGroup = { title: string; items: ShortcutItem[] };

const t = frShortcuts.items;

export function shortcutGroups(mac: boolean): ShortcutGroup[] {
  const mod = (...keys: string[]) => shortcutLabel(keys, mac);
  return [
    {
      title: frShortcuts.navigation,
      items: [
        { label: t.palette, keys: [mod("K")] },
        { label: t.newTab, keys: [mod("T")] },
        { label: t.closeTab, keys: [mod("W")] },
        { label: t.togglePin, keys: [mod("Shift", "P")] },
        { label: t.home, keys: [mod("1")] },
        { label: t.goToTab, keys: [mod("2"), mod("8")], range: true },
        { label: t.lastTab, keys: [mod("9")] },
      ],
    },
    {
      title: frShortcuts.palette,
      items: [
        { label: t.openSelection, keys: ["↵"] },
        { label: t.openInSheet, keys: [mod("↵")] },
        { label: t.nextFilter, keys: ["Tab"] },
      ],
    },
    {
      title: frShortcuts.code,
      items: [
        { label: t.save, keys: [mod("S")] },
        { label: t.externalEditor, keys: [mod("Shift", "O")] },
        { label: t.commit, keys: [mod("↵")] },
      ],
    },
  ];
}
```
Run: `bun test packages/ui/src/settings/shortcuts.test.ts` — Expected: PASS.

- [ ] **Step 3: Page (test rouge puis vert)**

`packages/ui/src/settings/shortcuts-page.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { ShortcutsPage } from "./ShortcutsPage";

test("the shortcuts page lists the groups with kbd keys and an active nav entry (screen 77)", () => {
  render(<ShortcutsPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Paramètres" });
  expect(within(nav).getByRole("link", { name: "Raccourcis" }).getAttribute("aria-current")).toBe("page");
  const navigation = screen.getByRole("region", { name: "Navigation" });
  const row = within(navigation).getByText("Aller à un onglet").closest("li");
  expect(row?.querySelectorAll("kbd")).toHaveLength(2);
  expect(row?.textContent).toContain("…");
  expect(screen.getByRole("region", { name: "Palette" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Code" })).toBeTruthy();
  expect(within(nav).queryByRole("button")).toBeNull();
});
```
Run: `bun test packages/ui/src/settings/shortcuts-page.test.tsx` — Expected: FAIL.

`packages/ui/src/settings/ShortcutsPage.tsx` :
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Fragment, useId } from "react";
import { frShortcuts } from "../i18n/fr-shortcuts";
import { isMac } from "../lib/shortcut-label";
import { SettingsNav } from "./SettingsNav";
import { type ShortcutGroup, shortcutGroups } from "./shortcuts";

const KBD = "rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground";

function Group({ group }: { group: ShortcutGroup }) {
  const id = useId();
  return (
    <Card className="gap-3" role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id}>{group.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {group.items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="flex items-center gap-1.5">
                {item.keys.map((key, i) => (
                  <Fragment key={key}>
                    {i > 0 && item.range && <span className="text-xs text-muted-foreground">{frShortcuts.range}</span>}
                    <kbd className={KBD}>{key}</kbd>
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ShortcutsPage() {
  const groups = shortcutGroups(isMac());
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="shortcuts" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{frShortcuts.title}</h1>
          <p className="text-sm text-muted-foreground">{frShortcuts.subtitle}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map((g) => (
            <Group key={g.title} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
```
Run: `bun test packages/ui/src/settings/shortcuts-page.test.tsx` — Expected: PASS.

- [ ] **Step 4: Réglages factices retirés (tests adaptés d'abord)**

Modifier les tests avant le code, les voir échouer, puis :
- `general-page.test.tsx` : retirer les attentes sur « Application », « Langue » ; attendre le sous-titre « Mises à jour et outils en ligne de commande. » et l'absence de `screen.queryByText("Application")`. `GeneralPage.tsx` : supprimer `ApplicationCard`, `Setting`, les imports `Select*`, `Switch`, `FolderOpen`, `useId`, `ReactNode` ; `fr.settings` perd `application`, `language`, `french`, `openAtLogin`, `openAtLoginHelp`, `dataDir`, `dataDirHelp`, `open`, `soon` ; `generalSubtitle: "Mises à jour et outils en ligne de commande."`.
- `my-tickets-page.test.tsx:60` : remplacer par `expect(screen.queryByRole("radio", { name: "Créés par moi" })).toBeNull();` et attendre exactement deux radios dans le groupe « Filtre des tickets ». `my-tickets.ts` : `MineTab = "assigned" | "agents"`, `isMine` sans le `return false` final (`tab === "agents"` devient la dernière branche : `return t.assignee?.kind === "agent";`). `MyTicketsPage.tsx` : supprimer le troisième `ToggleGroupItem`, le `Tooltip*` et leurs imports si plus utilisés ; `onValueChange` inchangée. `fr.mine` perd `created`, `createdLater`.
- `NewProjectForm.tsx:92-100` : supprimer la `ChoiceCard value="copy"` et les imports `Folder`, `Badge` s'ils ne servent plus ; `fr.newProject` perd `startCopy`, `startCopyHelp`, `soon`. Vérifier `NewProjectDialog.test.tsx` (`grep -n "Depuis un projet\|Bientôt"`).
- `commit.test.tsx:56` : remplacer par `expect(screen.queryByRole("button", { name: /Générer avec Claude/ })).toBeNull();`. `CommitPanel.tsx:54-67` : supprimer le bloc `TooltipProvider` et les imports `Sparkles`, `Tooltip*` s'ils ne servent plus ; garder `<span>{p.prefilled ? fr.commit.prefilled : ""}</span>`. `fr-code.ts` perd `generate`, `generateSoon`.

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS ; le budget baisse (carte Application, Tooltip du commit et carte « Depuis un projet » sortent de l'entrée ou des chunks).

- [ ] **Step 5: Commits**

```bash
git add packages/schema/src/tabs.ts packages/ui/src/tabs/target-hash.ts packages/ui/src/tabs/screens.ts packages/ui/src/tabs/tabs.test.ts packages/ui/src/palette/CommandPalette.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/settings/SettingsNav.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/lazy-screens.ts packages/ui/scripts/bundle-report.ts packages/ui/src/settings/shortcuts.ts packages/ui/src/settings/shortcuts.test.ts packages/ui/src/settings/ShortcutsPage.tsx packages/ui/src/settings/shortcuts-page.test.tsx packages/ui/src/i18n/fr-shortcuts.ts
git commit -m "feat(ui): page des raccourcis"
git add packages/ui/src/settings/GeneralPage.tsx packages/ui/src/settings/general-page.test.tsx packages/ui/src/mine/my-tickets.ts packages/ui/src/mine/MyTicketsPage.tsx packages/ui/src/mine/my-tickets-page.test.tsx packages/ui/src/dialogs/NewProjectForm.tsx packages/ui/src/code/CommitPanel.tsx packages/ui/src/code/commit.test.tsx packages/ui/src/i18n/fr.ts packages/ui/src/i18n/fr-code.ts
git commit -m "refactor(ui): réglages factices retirés"
```

---

### Task 26: Page Paramètres › Workspace, `renameWorkspace` retirée

Vague 1 ← T18 (`IconField`), T20 (`updateWorkspace`), T25 (tables des écrans ; **T24 puis T26** sur `Shell.tsx` et `lazy-screens.ts`). Spec §14.4, §14.2 (image du workspace). Décision 8. Nouvel écran `workspace` (`#/settings/workspace`, première entrée des Paramètres, écran **109**) : image, nom, description ; la tuile de la barre latérale montre l'image ; « Paramètres du workspace » y mène ; l'entrée « Renommer le workspace… », `RenameWorkspaceDialog` et la commande `renameWorkspace` disparaissent partout.

**Files:**
- Modify: `packages/schema/src/tabs.ts`, `packages/ui/src/tabs/target-hash.ts`, `packages/ui/src/tabs/screens.ts`, `packages/ui/src/tabs/tabs.test.ts`, `packages/ui/src/palette/CommandPalette.tsx`, `packages/ui/src/shell/AppSidebar.tsx`, `packages/ui/src/settings/SettingsNav.tsx`, `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/scripts/bundle-report.ts`
- Create: `packages/ui/src/settings/WorkspacePage.tsx`, `workspace-page.test.tsx`, `packages/ui/src/i18n/fr-workspace.ts`
- Modify: `packages/ui/src/shell/WorkspaceSwitcher.tsx`, `WorkspaceMark.tsx`, `workspace-switcher.test.tsx`, `Shell.tsx`, `workspace-actions.ts`, `lazy-dialogs.ts`, `agents-shell.test.tsx:198-213`, `packages/ui/src/i18n/fr.ts:13-24` (`workspace`)
- Delete: `packages/ui/src/dialogs/RenameWorkspaceDialog.tsx`
- Modify: `packages/schema/src/agent.ts` (`renameWorkspace` retirée de `ConfigCommand` et `ConfigResult`), `packages/core/src/agent-config.ts:187-193`, `packages/core/src/agent-config.test.ts:195-210`, `packages/daemon/src/service.test.ts:182`

**Interfaces:**
- Consumes: `IconField`, `readIconFile` (T18), `iconUrl`, `IconInput`, `WorkspaceConfig.{workspaceName, workspaceDescription, workspaceIcon}` (T20, T21), `updateWorkspace` (T20), `useFlash`, `Textarea`, `errorMessage`.
- Produces: `Screen` gagne `"workspace"` ; `WorkspacePage { config }` ; `WorkspaceSwitcher { name, icon, onSettings }` ; `WorkspaceTile { size, src?, alt? }` ; `AppSidebar` props `workspaceIcon` (sans `onRenameWorkspace`) ; `frWorkspace`.

- [ ] **Step 1: Écran `workspace` dans les tables (test rouge puis vert)**

`tabs.test.ts` : ajouter `{ kind: "screen", screen: "workspace" }` au codec et `expect(targetToHash({ kind: "screen", screen: "workspace" })).toBe("#/settings/workspace");`. Puis, comme en T25 Step 1 : `Screen` gagne `"workspace"` (après `"shortcuts"`), `SCREEN_HASHES.workspace = "#/settings/workspace"`, `SCREENS.workspace = { title: fr.settings.workspace, icon: Building2, crumbs: [fr.nav.settings, fr.settings.workspace] }`, palette `workspace: SCREENS.workspace.icon`, `SETTINGS_SCREENS` += `"workspace"`, `SettingsNav` : `SettingsScreen` inclut `"workspace"` et `ITEMS` commence par `{ id: "workspace", label: fr.settings.workspace, icon: Building2, screen: "workspace" }`, `ScreenView` : `if (screen === "workspace") return <WorkspacePage config={config} />;` (avant `if (!config) return null;`), `lazy-screens.ts` : `WorkspacePage`, `bundle-report.ts` : `/\/packages\/ui\/src\/(settings\/WorkspacePage\.tsx|i18n\/fr-workspace\.ts)$/,`.
Run: `bun run typecheck && bun test packages/ui/src/tabs` — Expected: PASS.

- [ ] **Step 2: Textes**

`packages/ui/src/i18n/fr-workspace.ts` :
```ts
export const frWorkspace = {
  title: "Workspace",
  subtitle: "Nom, image et description de ton espace.",
  identity: "Identité",
  image: "Image",
  name: "Nom",
  nameHelp: "40 caractères au plus",
  description: "Description",
  descriptionHelp: "500 caractères au plus",
  descriptionPlaceholder: "Mes projets et ceux de l'équipe",
  save: "Enregistrer",
  saved: "Enregistré",
  failed: "Impossible d'enregistrer le workspace.",
  iconAlt: (name: string) => `Image du workspace ${name}`,
} as const;
```
`fr.ts` › `workspace` : ne garder que `defaultName`, `local`, `menu`, `settings`.

- [ ] **Step 3: Page Workspace (test rouge puis vert)**

`packages/ui/src/settings/workspace-page.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture } from "../agents/fixtures";

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    subscribe: () => () => {},
    subscribeTopic: () => () => {},
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "config") return { name: "Maison", description: "Mes projets" };
      if (req.method === "setIcon") return { icon: req.icon ? "abc" : null };
      throw new Error(`unexpected ${req.method}`);
    },
  },
}));
const { WorkspacePage } = await import("./WorkspacePage");

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", { type: "image/png" });
beforeEach(() => {
  calls.length = 0;
});

test("shows the identity card from the config, workspace first in the nav (screen 109)", () => {
  render(<WorkspacePage config={{ ...configFixture(), workspaceDescription: "Mes projets", workspaceIcon: "v1" }} />);
  expect(screen.getByRole("heading", { level: 1, name: "Workspace" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Paramètres" });
  expect(nav.querySelector("a")?.textContent).toBe("Workspace");
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Perso");
  expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Mes projets");
  expect(screen.getByRole("img", { name: "Image · Image" }).getAttribute("src")).toBe("/icons/workspace?v=v1");
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
});

test("saves only what changed: patch first, then the icon", async () => {
  const user = userEvent.setup();
  render(<WorkspacePage config={configFixture()} />);
  const name = screen.getByLabelText("Nom");
  await user.clear(name);
  await user.type(name, " Maison ");
  await user.type(screen.getByLabelText("Description"), "Mes projets");
  await user.upload(screen.getByLabelText("Choisir une image…"), PNG);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(screen.getByText("Enregistré")).toBeTruthy());
  expect(calls).toEqual([
    { method: "config", command: { method: "updateWorkspace", patch: { name: "Maison", description: "Mes projets" } } },
    { method: "setIcon", owner: { kind: "workspace" }, icon: { mime: "image/png", data: "iVBORw0KGgo=" } },
  ]);
});

test("removing the image and clearing the description send null", async () => {
  const user = userEvent.setup();
  render(<WorkspacePage config={{ ...configFixture(), workspaceDescription: "Mes projets", workspaceIcon: "v1" }} />);
  await user.click(screen.getByRole("button", { name: "Retirer l'image" }));
  await user.clear(screen.getByLabelText("Description"));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls).toEqual([
    { method: "config", command: { method: "updateWorkspace", patch: { description: null } } },
    { method: "setIcon", owner: { kind: "workspace" }, icon: null },
  ]);
});

test("without config the form waits; a daemon error is shown", async () => {
  const { unmount } = render(<WorkspacePage config={null} />);
  expect(screen.getByLabelText("Nom").hasAttribute("disabled")).toBe(true);
  unmount();
  calls.length = 0;
  mock.module("../api", () => ({
    client: {
      rpc: async () => {
        throw new Error("boom");
      },
    },
  }));
  render(<WorkspacePage config={configFixture()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nom"), "2");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible d'enregistrer le workspace.");
});
```
Run: `bun test packages/ui/src/settings/workspace-page.test.tsx` — Expected: FAIL.

`packages/ui/src/settings/WorkspacePage.tsx` :
```tsx
import { type IconInput, iconUrl, type WorkspaceConfig, type WorkspacePatch } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useEffect, useId, useState } from "react";
import { client } from "../api";
import { IconField } from "../dialogs/IconField";
import { frWorkspace as t } from "../i18n/fr-workspace";
import { errorMessage } from "../lib/error-message";
import { useFlash } from "../lib/use-flash";
import { SettingsNav } from "./SettingsNav";

type Props = { config: WorkspaceConfig | null };

export function workspacePatch(config: WorkspaceConfig, name: string, description: string): WorkspacePatch | null {
  const patch: WorkspacePatch = {};
  const trimmedName = name.trim();
  if (trimmedName !== config.workspaceName) patch.name = trimmedName;
  const trimmedDescription = description.trim();
  const current = config.workspaceDescription ?? "";
  if (trimmedDescription !== current) patch.description = trimmedDescription === "" ? null : trimmedDescription;
  return Object.keys(patch).length === 0 ? null : patch;
}

export function WorkspacePage({ config }: Props) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(config?.workspaceName ?? "");
  const [description, setDescription] = useState(config?.workspaceDescription ?? "");
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = useFlash();
  useEffect(() => {
    if (!config) return;
    setName(config.workspaceName);
    setDescription(config.workspaceDescription ?? "");
    setPending(null);
    setRemoved(false);
  }, [config]);

  const patch = config ? workspacePatch(config, name, description) : null;
  const iconChanged = pending !== null || (removed && config?.workspaceIcon !== null);
  const dirty = config !== null && name.trim().length > 0 && (patch !== null || iconChanged);
  const currentUrl = config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!config || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      if (patch) await client.rpc({ method: "config", command: { method: "updateWorkspace", patch } });
      if (iconChanged) await client.rpc({ method: "setIcon", owner: { kind: "workspace" }, icon: pending });
      flash.flash(t.saved);
    } catch (err) {
      setError(`${t.failed} ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="workspace" />
      <form onSubmit={submit} className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{t.identity}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <IconField
              label={t.image}
              currentUrl={currentUrl}
              pending={pending}
              removed={removed}
              onPick={(icon) => {
                setPending(icon);
                setRemoved(false);
              }}
              onRemove={() => {
                setPending(null);
                setRemoved(true);
              }}
            />
            <div className="grid gap-1.5">
              <Label htmlFor={nameId}>{t.name}</Label>
              <Input id={nameId} value={name} maxLength={40} disabled={!config} onChange={(e) => setName(e.target.value)} />
              <p className="text-2xs text-muted-foreground">{t.nameHelp}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={descriptionId}>{t.description}</Label>
              <Textarea
                id={descriptionId}
                value={description}
                maxLength={500}
                rows={3}
                disabled={!config}
                placeholder={t.descriptionPlaceholder}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-2xs text-muted-foreground">{t.descriptionHelp}</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={!dirty || busy}>
                {t.save}
              </Button>
              {flash.message && <span className="text-xs text-muted-foreground">{flash.message}</span>}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
```
(`IconField` de T18 rend l'aperçu avec `alt={frFields.icon.preview(label)}` : « Image · Image » ici. `WorkspacePatch` est le type Zod de T20 ; `patch.name = …` sur un objet vide reste typé grâce aux champs optionnels.)
Run: `bun test packages/ui/src/settings/workspace-page.test.tsx` — Expected: PASS, 4 tests.

- [ ] **Step 4: Tuile, sélecteur et barre latérale (tests adaptés puis verts)**

`workspace-switcher.test.tsx` : réécrire avec trois tests : « shows the name and the local subtitle » (inchangé sauf props `icon={null}`), « lists the current workspace and the settings entry only » (items `["PersoWorkspace local", "Paramètres du workspace"]`), « shows the workspace image in the tile when there is one » (`icon="/icons/workspace?v=v1"` ⇒ `screen.getAllByRole("img", { name: "Image du workspace Perso" })[0]?.getAttribute("src")` vaut l'URL), « settings entry opens the workspace settings » (inchangé). Supprimer les tests de renommage.
Run: `bun test packages/ui/src/shell/workspace-switcher.test.tsx` — Expected: FAIL.

`WorkspaceMark.tsx` :
```tsx
export function WorkspaceTile({ size, src = null, alt = "" }: { size: "sm" | "md"; src?: string | null; alt?: string }) {
  const box = size === "md" ? "size-6 rounded-md" : "size-5 rounded-[5px]";
  if (src) return <img src={src} alt={alt} className={cn("shrink-0 border object-cover", box)} />;
  return (
    <span className={cn("grid shrink-0 place-items-center border bg-card text-foreground", box)}>
      <WorkspaceMark className={size === "md" ? "size-3.5" : "size-3"} />
    </span>
  );
}
```
`WorkspaceSwitcher.tsx` : `Props = { name: string; icon: string | null; onSettings(): void }` ; retirer `useState`, `Pencil`, `RenameWorkspaceDialog`, l'entrée « Renommer » et le fragment ; `<WorkspaceTile size="md" src={icon} alt={frWorkspace.iconAlt(name)} />` aux deux endroits. `AppSidebar.tsx` : `Props` perd `onRenameWorkspace`, gagne `workspaceIcon: string | null` ; `<WorkspaceSwitcher name={…} icon={p.workspaceIcon} onSettings={() => onOpen(screenTarget("workspace"), false)} />`. `Shell.tsx` : `workspaceIcon={config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null}` à la place de `onRenameWorkspace`, import `renameWorkspace` retiré. `workspace-actions.ts` : supprimer `renameWorkspace` et l'import `client`. `lazy-dialogs.ts` : supprimer `RenameWorkspaceDialog` ; `git rm packages/ui/src/dialogs/RenameWorkspaceDialog.tsx` ; `bundle-report.ts:33` : retirer `RenameWorkspaceDialog|`.

`agents-shell.test.tsx:198-213` : remplacer le test par
```tsx
test("the workspace header leads to the workspace settings", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Perso/ }));
  expect(screen.queryByRole("menuitem", { name: "Renommer le workspace…" })).toBeNull();
  await user.click(await screen.findByRole("menuitem", { name: "Paramètres du workspace" }));
  expect(location.hash).toBe("#/settings/workspace");
  expect(await screen.findByRole("heading", { level: 1, name: "Workspace" })).toBeTruthy();
});
```
(`configFixture()` porte déjà `workspaceDescription` et `workspaceIcon` depuis T20/T21 ; le mock `rpc` du fichier renvoie `null` pour `config`, ce qui suffit.)
Run: `bun test packages/ui/src/shell` — Expected: PASS.

- [ ] **Step 5: `renameWorkspace` retirée du schéma, du core et du démon**

`packages/core/src/agent-config.test.ts:195-210` : le test « renameWorkspace … » devient un test `updateWorkspace` (celui de T20 existe déjà : supprimer l'ancien et ses assertions `safeParse` sur `renameWorkspace`, reporter les deux `safeParse` de validation sur `{ method: "updateWorkspace", patch: { name: "   " } }` et `{ …, patch: { name: "x".repeat(41) } }`). `packages/schema/src/agent.ts` : supprimer la ligne `z.object({ method: z.literal("renameWorkspace"), name: WorkspaceName })` et `renameWorkspace: { name: string };`. `packages/core/src/agent-config.ts:187-193` : supprimer le `case "renameWorkspace"`. `packages/daemon/src/service.test.ts:182` : `s1.handle({ method: "config", command: { method: "updateWorkspace", patch: { name: "Maison", description: "Mes projets" } } });` (et retirer la ligne `updateWorkspace` ajoutée en T20 juste après, devenue redondante). `grep -rn renameWorkspace packages e2e` doit ne rien renvoyer.

Run: `bun run check && bun run typecheck && bun test packages && bun run budget` — Expected: PASS ; budget ≤ 230 000 (la page est hors de l'entrée ; `WorkspaceSwitcher` perd le dialogue).

- [ ] **Step 6: Commits**

```bash
git add packages/schema/src/tabs.ts packages/ui/src/tabs/target-hash.ts packages/ui/src/tabs/screens.ts packages/ui/src/tabs/tabs.test.ts packages/ui/src/palette/CommandPalette.tsx packages/ui/src/settings/SettingsNav.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/lazy-screens.ts packages/ui/scripts/bundle-report.ts packages/ui/src/settings/WorkspacePage.tsx packages/ui/src/settings/workspace-page.test.tsx packages/ui/src/i18n/fr-workspace.ts
git commit -m "feat(ui): page Paramètres › Workspace"
git add packages/ui/src/shell/WorkspaceSwitcher.tsx packages/ui/src/shell/WorkspaceMark.tsx packages/ui/src/shell/workspace-switcher.test.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/workspace-actions.ts packages/ui/src/shell/lazy-dialogs.ts packages/ui/src/shell/agents-shell.test.tsx packages/ui/src/i18n/fr.ts packages/ui/src/dialogs/RenameWorkspaceDialog.tsx packages/schema/src/agent.ts packages/core/src/agent-config.ts packages/core/src/agent-config.test.ts packages/daemon/src/service.test.ts
git commit -m "refactor: renameWorkspace remplacée par updateWorkspace"
```

---

### Task 27: Menu projet : Modifier et Supprimer

Vague 2 ← T18 (`FolderField`, `IconField`), T20 (`ProjectPatch`), T24 (`ShellHeader` props), T26 (`AppSidebar`, `Shell.tsx`, `lazy-dialogs.ts` remaniés). Spec §14.1, §14.2, §14.3. Décisions 3 et 4. Le menu d'un projet (clic droit et « ⋯ », même liste) offre Nouvelle page, Partager, Modifier…, Supprimer… ; « Modifier le projet » édite nom, couleur, image et dossier ; « Supprimer » exige la saisie du nom, s'adapte (runs actifs, propriétaire d'un projet partagé, membre qui quitte) et ferme les onglets du projet. Écrans **107**, **108**. **Relue par `kibo-lead`.**

**Files:**
- Create: `packages/ui/src/lib/project-colors.ts`, `packages/ui/src/shell/project-menu.ts`, `project-menu.test.ts`, `packages/ui/src/dialogs/EditProjectDialog.tsx`, `edit-project-dialog.test.tsx`, `DeleteProjectDialog.tsx`, `delete-project-dialog.test.tsx`, `packages/ui/src/i18n/fr-project.ts`
- Modify: `packages/ui/src/dialogs/NewProjectDialog.tsx:24,72`, `packages/ui/src/shell/ShareControls.tsx`, `AppSidebar.tsx`, `ShellDialogs.tsx`, `Shell.tsx`, `lazy-dialogs.ts`, `packages/ui/src/tabs/tabs-model.ts`, `tabs.test.ts`, `packages/ui/src/i18n/fr.ts` (`nav`), `packages/ui/scripts/bundle-report.ts`, `packages/ui/src/shell/agents-shell.test.tsx`

**Interfaces:**
- Consumes: `MenuEntry`, `MenuAction`, `ContextMenuEntries`, `DropdownMenuEntries` (`@kibo/sdk/ui/menu-entries`), `ContextMenu*` (`@kibo/sdk/ui/context-menu`), `FolderField`, `IconField` (T18), `iconUrl`, `ProjectPatch`, `ProjectSummary.icon`, `ProjectSnapshot.sync`, `isTerminal`, `isRemoteView`, `errorMessage`, `KiboError`, `RadioGroup`/`RadioGroupItem` (`@kibo/sdk/ui/radio-group`), `frShare.action`, `fr.nav.newPage`.
- Produces: `PROJECT_COLORS` ; `projectMenuEntries` ; `ProjectMenu { name, current, shifted, entries }` ; `DialogsState.editProject`, `DialogsState.deleteProject` ; `EditProjectDialog`, `DeleteProjectDialog` ; `TabsAction closeProject` ; `AppSidebar` props `onEditProject`, `onDeleteProject` ; `frProject`.

- [ ] **Step 1: Couleurs partagées et entrées de menu (test rouge puis vert)**

`packages/ui/src/lib/project-colors.ts` : `export const PROJECT_COLORS = ["#14B8A6", "#6366F1", "#EC4899", "#84CC16", "#D946EF", "#64748B"] as const;` ; `NewProjectDialog.tsx` : supprimer `COLORS`, importer `PROJECT_COLORS`, `color: PROJECT_COLORS[count % PROJECT_COLORS.length] ?? "#64748B"`.

`fr.ts` › `nav` : ajouter `editProject: "Modifier…"`, `deleteProject: "Supprimer…"`.

`packages/ui/src/shell/project-menu.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import { isSeparator } from "@kibo/sdk/ui/menu-entries";
import { projectMenuEntries } from "./project-menu";

const texts = { newPage: "Nouvelle page", share: "Partager", edit: "Modifier…", remove: "Supprimer…" };
const actions = () => ({ newPage: mock(() => {}), share: mock(() => {}), edit: mock(() => {}), remove: mock(() => {}) });

test("an editable project offers new page, share, edit, then delete after a separator", () => {
  const a = actions();
  const entries = projectMenuEntries({ editable: true, texts, actions: a });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual(["Nouvelle page", "Partager", "Modifier…", "—", "Supprimer…"]);
  const last = entries[4];
  if (!last || isSeparator(last) || !("onSelect" in last)) throw new Error("expected an action");
  expect(last.destructive).toBe(true);
  last.onSelect();
  expect(a.remove).toHaveBeenCalledTimes(1);
});

test("a read-only project keeps share and delete only", () => {
  const entries = projectMenuEntries({ editable: false, texts, actions: actions() });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual(["Partager", "—", "Supprimer…"]);
});
```
Run: `bun test packages/ui/src/shell/project-menu.test.ts` — Expected: FAIL.

`packages/ui/src/shell/project-menu.ts` :
```ts
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Pencil, Plus, Share2, Trash2 } from "lucide-react";

export type ProjectMenuActions = { newPage(): void; share(): void; edit(): void; remove(): void };
export type ProjectMenuTexts = { newPage: string; share: string; edit: string; remove: string };

export function projectMenuEntries(input: { editable: boolean; texts: ProjectMenuTexts; actions: ProjectMenuActions }): MenuEntry[] {
  const { editable, texts, actions } = input;
  const share: MenuEntry = { label: texts.share, icon: Share2, onSelect: actions.share };
  const remove: MenuEntry = { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove };
  if (!editable) return [share, { separator: true }, remove];
  return [
    { label: texts.newPage, icon: Plus, onSelect: actions.newPage },
    share,
    { label: texts.edit, icon: Pencil, onSelect: actions.edit },
    { separator: true },
    remove,
  ];
}
```
Run: `bun test packages/ui/src/shell/project-menu.test.ts` — Expected: PASS.

- [ ] **Step 2: Menu dans la barre latérale (test rouge puis vert)**

`agents-shell.test.tsx`, ajouter :
```tsx
test("right click and the ellipsis open the same project menu; edit and delete open their dialogs", async () => {
  render(<Shell viewer="adam" notifications="native" />);
  await go("#/p/kibo/");
  const user = userEvent.setup();
  const entry = await screen.findByRole("button", { name: "Kibo", exact: true });
  await user.pointer({ keys: "[MouseRight]", target: entry });
  const names = () => screen.getAllByRole("menuitem").map((i) => i.textContent);
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Supprimer…"]);
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Modifier…" }));
  expect(await screen.findByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions de Kibo" }));
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  expect(await screen.findByRole("dialog", { name: "Supprimer le projet Kibo ?" })).toBeTruthy();
});
```
Run: `bun test packages/ui/src/shell/agents-shell.test.tsx -t "same project menu"` — Expected: FAIL.

`ShareControls.tsx` › `ProjectMenu` :
```tsx
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
type MenuProps = { name: string; current: boolean; shifted: boolean; entries: readonly MenuEntry[] };
export function ProjectMenu({ name, current, shifted, entries }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover={!current} className={shifted ? "right-7" : undefined} aria-label={frShare.menu(name)}>
          <Ellipsis />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
`AppSidebar.tsx` : `Props` gagne `onEditProject(projectId: string): void; onDeleteProject(projectId: string): void;` ; `ProjectEntryProps` gagne `onEdit(): void; onDelete(): void;` ; dans `ProjectEntry` :
```tsx
  const entries = projectMenuEntries({
    editable,
    texts: { newPage: fr.nav.newPage, share: frShare.action, edit: fr.nav.editProject, remove: fr.nav.deleteProject },
    actions: { newPage: () => p.onNewPage(null), share: p.onShare, edit: p.onEdit, remove: p.onDelete },
  });
  const header = (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarMenuButton isActive={p.projectActive} {...link({ kind: "project", projectId: project.id })}>
            <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
            <span>{project.name}</span>
          </SidebarMenuButton>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      <ProjectMenu name={project.name} current={current} shifted={editable} entries={entries} />
      {editable && ( … inchangé … )}
    </>
  );
```
avec, à l'appel, `onEdit={() => p.onEditProject(project.id)}` et `onDelete={() => p.onDeleteProject(project.id)}`. `editable` d'un projet non actif : `ProjectEntry` reçoit `editable={current && editable}` aujourd'hui ; pour le menu, calculer `menuEditable = active === null ? true : canEdit(active)` dans `AppSidebar` (le snapshot n'est chargé que pour le projet courant ; un projet en lecture seule non ouvert affiche « Modifier… », et le dialogue reçoit l'erreur du démon). Imports : `ContextMenu, ContextMenuContent, ContextMenuTrigger` (`@kibo/sdk/ui/context-menu`), `ContextMenuEntries` (`@kibo/sdk/ui/menu-entries`), `frShare`, `projectMenuEntries`. `ProjectMenu` reste chargé à la demande (`share-entry`).

`ShellDialogs.tsx` : `DialogsState` gagne `editProject: string | null; deleteProject: string | null;` (et `NO_DIALOG` les deux `null`) ; `Props` remplace `projectsCount: number` par `projects: ProjectSummary[]` (`count={projects.length}` pour `NewProjectDialog`) et gagne `onCloseProject(projectId: string): void` ; rendu :
```tsx
      {editing && <EditProjectDialog project={editing} onClose={() => set({ editProject: null })} />}
      {doomedProject && (
        <DeleteProjectDialog
          project={doomedProject}
          snapshot={snapshots.get(doomedProject.id) ?? null}
          activeRuns={agents ? agents.runs.filter((r) => r.projectId === doomedProject.id && !isTerminal(r.state)).length : 0}
          onClose={() => set({ deleteProject: null })}
          onDeleted={(projectId) => {
            set({ deleteProject: null });
            p.onCloseProject(projectId);
          }}
          onOpenAgents={() => {
            set({ deleteProject: null });
            p.onOpenTarget({ kind: "screen", screen: "agents" }, false);
          }}
          onShare={() => set({ deleteProject: null, share: doomedProject.id })}
        />
      )}
```
avec `const editing = state.editProject ? (projects.find((x) => x.id === state.editProject) ?? null) : null;` et `doomedProject` de même. `lazy-dialogs.ts` : `EditProjectDialog`, `DeleteProjectDialog` (`hidden`). `Shell.tsx` : `projects={projects}` à la place de `projectsCount`, `onCloseProject={(projectId) => { tabs.dispatch({ type: "closeProject", projectId }); go(null); }}`, `AppSidebar` reçoit `onEditProject={(id) => set({ editProject: id })}` et `onDeleteProject={(id) => set({ deleteProject: id })}`. `bundle-report.ts` : `/\/packages\/ui\/src\/(dialogs\/(EditProjectDialog|DeleteProjectDialog)\.tsx|i18n\/fr-project\.ts)$/,`.
Run (après Steps 3 à 5) : `bun test packages/ui/src/shell/agents-shell.test.tsx` — Expected: PASS.

- [ ] **Step 3: Textes des dialogues**

`packages/ui/src/i18n/fr-project.ts` :
```ts
export const frProject = {
  edit: {
    title: "Modifier le projet",
    name: "Nom",
    color: "Couleur",
    colorOption: (hex: string) => `Couleur ${hex}`,
    image: "Image",
    folder: "Dossier",
    folderHelp: "Le dossier reste sur ta machine. Vide pour délier.",
    save: "Enregistrer",
    cancel: "Annuler",
    folderBusy: "Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier.",
    failed: "Impossible de modifier le projet.",
  },
  remove: {
    title: (name: string) => `Supprimer le projet ${name} ?`,
    leaveTitle: (name: string) => `Quitter le projet ${name} ?`,
    summary: (tickets: number, pages: number, widgets: number) =>
      `${tickets} ticket${tickets > 1 ? "s" : ""}, ${pages} page${pages > 1 ? "s" : ""} et ${widgets} widget${widgets > 1 ? "s" : ""} seront supprimés.`,
    keeps: (folder: string) =>
      `Le dossier ${folder} et ses fichiers ne sont pas touchés ; les notes restent sur le disque ; l'historique des runs est conservé.`,
    keepsNoFolder: "Les notes restent sur le disque ; l'historique des runs est conservé.",
    leaveHelp: "Ta copie locale sera supprimée. Le projet reste sur le serveur : il te faudra une nouvelle invitation pour y revenir.",
    confirmLabel: (name: string) => `Tape ${name} pour confirmer`,
    confirm: "Supprimer",
    leave: "Quitter le projet",
    cancel: "Annuler",
    busyTitle: "Des agents travaillent sur ce projet",
    busy: (n: number) => `${n} run${n > 1 ? "s" : ""} en cours ou en file : arrête-les avant de supprimer le projet.`,
    seeAgents: "Voir les agents",
    sharedTitle: "Ce projet est partagé",
    sharedOwner: "Tu en es propriétaire : arrête d'abord le partage, ce qui le supprime du serveur pour tout le monde.",
    openShare: "Ouvrir le partage",
    failed: "Impossible de supprimer le projet.",
  },
} as const;
```

- [ ] **Step 4: Dialogue « Modifier le projet » (test rouge puis vert)**

`packages/ui/src/dialogs/edit-project-dialog.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let fail: KiboError | null = null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (fail) throw fail;
      if (req.method === "updateProject") return { id: "kibo", key: "KIB", name: "Noyau", folder: null, color: "#6366F1" };
      if (req.method === "setIcon") return { icon: req.icon ? "abc" : null };
      throw new Error(`unexpected ${req.method}`);
    },
  },
}));
mock.module("../shell/workspace-actions", () => ({ inTauri: () => false, openWindow: () => {} }));
const { EditProjectDialog } = await import("./EditProjectDialog");

const project: ProjectSummary = { id: "kibo", key: "KIB", name: "Kibo", folder: "/Users/adam/code/kibo", color: "#F97316", counts: {}, icon: "v1" };
const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", { type: "image/png" });
beforeEach(() => {
  calls.length = 0;
  fail = null;
});

test("shows the current values and saves only the changed fields, then the icon (screen 107)", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} onClose={closed} />);
  expect(screen.getByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Kibo");
  expect((screen.getByLabelText("Dossier") as HTMLInputElement).value).toBe("/Users/adam/code/kibo");
  expect(screen.getByRole("img", { name: "Image · Image" }).getAttribute("src")).toBe("/icons/project/kibo?v=v1");
  const user = userEvent.setup();
  const name = screen.getByLabelText("Nom");
  await user.clear(name);
  await user.type(name, "Noyau");
  await user.click(screen.getByRole("radio", { name: "Couleur #6366F1" }));
  await user.clear(screen.getByLabelText("Dossier"));
  await user.upload(screen.getByLabelText("Choisir une image…"), PNG);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([
    { method: "updateProject", projectId: "kibo", patch: { name: "Noyau", color: "#6366F1", folder: null } },
    { method: "setIcon", owner: { kind: "project", projectId: "kibo" }, icon: { mime: "image/png", data: "iVBORw0KGgo=" } },
  ]);
});

test("nothing changed keeps the button disabled; a blank name is refused before any call", async () => {
  render(<EditProjectDialog project={project} onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Nom"));
  await user.type(screen.getByLabelText("Nom"), "   ");
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
  expect(calls).toEqual([]);
});

test("a busy folder explains itself and keeps the dialog open with the old name on screen", async () => {
  fail = new KiboError("CONFLICT", "project kibo has active runs");
  render(<EditProjectDialog project={project} onClose={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Dossier"), "2");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier.",
  );
  expect(screen.getByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  fail = new KiboError("INVALID_INPUT", "empty name");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible de modifier le projet.");
});
```
Run: `bun test packages/ui/src/dialogs/edit-project-dialog.test.tsx` — Expected: FAIL.

`packages/ui/src/dialogs/EditProjectDialog.tsx` :
```tsx
import { type IconInput, iconUrl, KiboError, type ProjectPatch, type ProjectSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frProject } from "../i18n/fr-project";
import { errorMessage } from "../lib/error-message";
import { PROJECT_COLORS } from "../lib/project-colors";
import { isRemoteView } from "../lib/remote-view";
import { FolderField } from "./FolderField";
import { IconField } from "./IconField";

type Props = { project: ProjectSummary; onClose(): void };
const t = frProject.edit;

export function projectPatch(project: ProjectSummary, fields: { name: string; color: string; folder: string }): ProjectPatch | null {
  const patch: ProjectPatch = {};
  const name = fields.name.trim();
  if (name !== project.name) patch.name = name;
  if (fields.color !== project.color) patch.color = fields.color;
  const folder = fields.folder.trim() || null;
  if (folder !== (project.folder ?? null)) patch.folder = folder;
  return Object.keys(patch).length === 0 ? null : patch;
}

const failure = (e: unknown): string => {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.folderBusy;
  return `${t.failed} ${errorMessage(e)}`;
};

export function EditProjectDialog({ project, onClose }: Props) {
  const nameId = useId();
  const folderId = useId();
  const folderHelpId = useId();
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string>(project.color);
  const [folder, setFolder] = useState(project.folder ?? "");
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remote = isRemoteView();
  const patch = projectPatch(project, { name, color, folder });
  const iconChanged = pending !== null || (removed && (project.icon ?? null) !== null);
  const dirty = name.trim().length > 0 && (patch !== null || iconChanged);
  const currentUrl = project.icon ? iconUrl({ kind: "project", projectId: project.id }, project.icon) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      if (patch) await client.rpc({ method: "updateProject", projectId: project.id, patch });
      if (iconChanged) await client.rpc({ method: "setIcon", owner: { kind: "project", projectId: project.id }, icon: pending });
      onClose();
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>{t.name}</Label>
            <Input id={nameId} value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t.color}</span>
            <RadioGroup value={color} onValueChange={setColor} aria-label={t.color} className="flex gap-2">
              {PROJECT_COLORS.map((hex) => (
                <RadioGroupItem
                  key={hex}
                  value={hex}
                  aria-label={t.colorOption(hex)}
                  className="size-6 rounded-md border-2 border-transparent data-[state=checked]:border-foreground"
                  style={{ background: hex }}
                />
              ))}
            </RadioGroup>
          </div>
          <IconField
            label={t.image}
            currentUrl={currentUrl}
            pending={pending}
            removed={removed}
            onPick={(icon) => {
              setPending(icon);
              setRemoved(false);
            }}
            onRemove={() => {
              setPending(null);
              setRemoved(true);
            }}
          />
          {!remote && (
            <div className="grid gap-1.5">
              <Label htmlFor={folderId}>{t.folder}</Label>
              <FolderField id={folderId} value={folder} onChange={setFolder} describedBy={folderHelpId} />
              <p id={folderHelpId} className="text-2xs text-muted-foreground">
                {t.folderHelp}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!dirty || busy}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
(`RadioGroupItem` de shadcn rend un `button role="radio"` ; si le pastillage par `style` est masqué par la classe par défaut, ajouter `[&>span]:hidden` pour cacher l'indicateur. La couleur courante du projet peut ne pas être dans `PROJECT_COLORS` (orange `#F97316` des projets importés) : elle n'est alors cochée nulle part et reste inchangée tant qu'aucune pastille n'est choisie.)
Run: `bun test packages/ui/src/dialogs/edit-project-dialog.test.tsx` — Expected: PASS, 3 tests.

- [ ] **Step 5: Dialogue « Supprimer le projet » (test rouge puis vert)**

`packages/ui/src/dialogs/delete-project-dialog.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type ProjectSnapshot, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";

const calls: RpcRequest[] = [];
let fail: KiboError | null = null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (fail) throw fail;
      return null;
    },
  },
}));
const { DeleteProjectDialog } = await import("./DeleteProjectDialog");

const project: ProjectSummary = { id: "kibo", key: "KIB", name: "Kibo", folder: "/Users/adam/code/kibo", color: "#F97316", counts: {} };
const local = (): ProjectSnapshot => kiboProject();
const shared = (role: "owner" | "editor", access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  ...kiboProject(),
  sync: { shared: true, keyAllocator: "server", role, access, members: [] },
});
const handlers = () => ({ onClose: mock(() => {}), onDeleted: mock(() => {}), onOpenAgents: mock(() => {}), onShare: mock(() => {}) });
beforeEach(() => {
  calls.length = 0;
  fail = null;
});

test("deletes after the exact name is typed, spaces around ignored, case respected (screen 108)", async () => {
  const h = handlers();
  const snapshot = local();
  render(<DeleteProjectDialog project={project} snapshot={snapshot} activeRuns={0} {...h} />);
  expect(screen.getByRole("dialog", { name: "Supprimer le projet Kibo ?" })).toBeTruthy();
  expect(
    screen.getByText(`${snapshot.tickets.length} tickets, ${snapshot.pages.length} pages et ${snapshot.instances.length} widgets seront supprimés.`),
  ).toBeTruthy();
  expect(screen.getByText(/Le dossier \/Users\/adam\/code\/kibo et ses fichiers ne sont pas touchés/)).toBeTruthy();
  const confirm = screen.getByRole("button", { name: "Supprimer" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Tape Kibo pour confirmer");
  await user.type(field, "kibo");
  expect(confirm.hasAttribute("disabled")).toBe(true);
  await user.clear(field);
  await user.type(field, "  Kibo ");
  expect(confirm.hasAttribute("disabled")).toBe(false);
  await user.click(confirm);
  await waitFor(() => expect(h.onDeleted).toHaveBeenCalledWith("kibo"));
  expect(calls).toEqual([{ method: "deleteProject", projectId: "kibo" }]);
});

test("active runs block the deletion and lead to the agents", async () => {
  const h = handlers();
  render(<DeleteProjectDialog project={project} snapshot={local()} activeRuns={2} {...h} />);
  expect(screen.getByRole("dialog", { name: "Des agents travaillent sur ce projet" })).toBeTruthy();
  expect(screen.getByText("2 runs en cours ou en file : arrête-les avant de supprimer le projet.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Voir les agents" }));
  expect(h.onOpenAgents).toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("the owner of a shared project is sent to the sharing dialog", async () => {
  const h = handlers();
  render(<DeleteProjectDialog project={project} snapshot={shared("owner")} activeRuns={0} {...h} />);
  expect(screen.getByRole("dialog", { name: "Ce projet est partagé" })).toBeTruthy();
  expect(screen.getByText(/Tu en es propriétaire/)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le partage" }));
  expect(h.onShare).toHaveBeenCalled();
});

test("a member or a revoked owner leaves the project", async () => {
  for (const snapshot of [shared("editor"), shared("owner", "revoked")]) {
    const h = handlers();
    const view = render(<DeleteProjectDialog project={project} snapshot={snapshot} activeRuns={0} {...h} />);
    expect(screen.getByRole("dialog", { name: "Quitter le projet Kibo ?" })).toBeTruthy();
    expect(screen.getByText(/Ta copie locale sera supprimée/)).toBeTruthy();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tape Kibo pour confirmer"), "Kibo");
    await user.click(screen.getByRole("button", { name: "Quitter le projet" }));
    await waitFor(() => expect(h.onDeleted).toHaveBeenCalledWith("kibo"));
    view.unmount();
  }
  expect(calls).toHaveLength(2);
});

test("without a snapshot the generic text shows; a daemon refusal is displayed", async () => {
  fail = new KiboError("CONFLICT", "project kibo has active runs");
  const h = handlers();
  render(<DeleteProjectDialog project={{ ...project, folder: null }} snapshot={null} activeRuns={0} {...h} />);
  expect(screen.getByText("Les notes restent sur le disque ; l'historique des runs est conservé.")).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Tape Kibo pour confirmer"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible de supprimer le projet.");
  expect(h.onDeleted).not.toHaveBeenCalled();
});
```
Run: `bun test packages/ui/src/dialogs/delete-project-dialog.test.tsx` — Expected: FAIL.

`packages/ui/src/dialogs/DeleteProjectDialog.tsx` :
```tsx
import type { ProjectSnapshot, ProjectSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frProject } from "../i18n/fr-project";
import { errorMessage } from "../lib/error-message";

type Props = {
  project: ProjectSummary;
  snapshot: ProjectSnapshot | null;
  activeRuns: number;
  onClose(): void;
  onDeleted(projectId: string): void;
  onOpenAgents(): void;
  onShare(): void;
};
export type DeleteVariant = "busy" | "shared-owner" | "leave" | "delete";
const t = frProject.remove;

export function deleteVariant(snapshot: ProjectSnapshot | null, activeRuns: number): DeleteVariant {
  if (activeRuns > 0) return "busy";
  const sync = snapshot?.sync;
  if (!sync?.shared) return "delete";
  if (sync.role === "owner" && sync.access !== "revoked") return "shared-owner";
  return "leave";
}

export const nameMatches = (typed: string, name: string): boolean => typed.trim() === name;

function Blocked({ title, text, action, onAction, onClose }: { title: string; text: string; action: string; onAction(): void; onClose(): void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{text}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" onClick={onAction}>
          {action}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DeleteProjectDialog({ project, snapshot, activeRuns, onClose, onDeleted, onOpenAgents, onShare }: Props) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variant = deleteVariant(snapshot, activeRuns);
  const leaving = variant === "leave";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameMatches(typed, project.name)) return;
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "deleteProject", projectId: project.id });
      onDeleted(project.id);
    } catch (err) {
      setError(`${t.failed} ${errorMessage(err)}`);
      setBusy(false);
    }
  };

  const summary = snapshot ? t.summary(snapshot.tickets.length, snapshot.pages.length, snapshot.instances.length) : null;
  const keeps = leaving ? t.leaveHelp : project.folder ? t.keeps(project.folder) : t.keepsNoFolder;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {variant === "busy" && (
          <Blocked title={t.busyTitle} text={t.busy(activeRuns)} action={t.seeAgents} onAction={onOpenAgents} onClose={onClose} />
        )}
        {variant === "shared-owner" && (
          <Blocked title={t.sharedTitle} text={t.sharedOwner} action={t.openShare} onAction={onShare} onClose={onClose} />
        )}
        {(variant === "delete" || leaving) && (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{leaving ? t.leaveTitle(project.name) : t.title(project.name)}</DialogTitle>
              <DialogDescription className="grid gap-1">
                {!leaving && summary && <span>{summary}</span>}
                <span>{keeps}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor={id}>{t.confirmLabel(project.name)}</Label>
              <Input id={id} value={typed} autoFocus autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t.cancel}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || !nameMatches(typed, project.name)}>
                {leaving ? t.leave : t.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```
Run: `bun test packages/ui/src/dialogs/delete-project-dialog.test.tsx` — Expected: PASS, 5 tests.

- [ ] **Step 6: Fermeture des onglets du projet (test rouge puis vert)**

`tabs.test.ts`, dans le `describe` du réducteur :
```ts
  test("closeProject closes every tab of the project, pinned included, and purges its recents", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    s = open(s, { kind: "ticket", projectId: "p1", ticketId: "x" }, "t2", true);
    s = tabsReducer(s, { type: "pin", id: "t2", pinned: true });
    s = open(s, { kind: "project", projectId: "p2" }, "t3", true);
    s = open(s, { kind: "screen", screen: "agents" }, "t4", true);
    s = tabsReducer(s, { type: "activate", id: "t2" });
    const out = tabsReducer(s, { type: "closeProject", projectId: "p1" });
    expect(out.tabs.map((t) => t.id)).toEqual(["t3", "t4"]);
    expect(out.activeId).toBe("t3");
    expect(out.recents.every((r) => r.kind === "screen" || r.projectId !== "p1")).toBe(true);
    expect(out.recents.some((r) => r.kind === "project" && r.projectId === "p2")).toBe(true);
    expect(tabsReducer(out, { type: "closeProject", projectId: "nope" })).toBe(out);
  });
```
Run: `bun test packages/ui/src/tabs/tabs.test.ts` — Expected: FAIL.

`tabs-model.ts` : `TabsAction` gagne `| { type: "closeProject"; projectId: string }` ; dans `tabsReducer` :
```ts
    case "closeProject": {
      const ofProject = (target: TabTarget) => target.kind !== "screen" && target.projectId === action.projectId;
      const ids = new Set(state.tabs.filter((t) => ofProject(t.target)).map((t) => t.id));
      const recents = state.recents.filter((r) => !ofProject(r));
      if (ids.size === 0 && recents.length === state.recents.length) return state;
      return { ...closeIds(state, ids), recents };
    }
```
Run: `bun test packages/ui/src/tabs/tabs.test.ts` — Expected: PASS.

- [ ] **Step 7: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS ; budget ≤ 230 000 (`project-menu.ts` et le `ContextMenu` de la barre latérale entrent dans l'entrée : ~0,5 kB ; `ContextMenu*` y est déjà par `ProjectPages`). Sinon : `ProjectMenu` et le `ContextMenu` du projet passent ensemble dans `share-entry` (composant `ProjectHeaderMenu` chargé à la demande, `hidden`).

```bash
git add packages/ui/src/lib/project-colors.ts packages/ui/src/dialogs/NewProjectDialog.tsx packages/ui/src/shell/project-menu.ts packages/ui/src/shell/project-menu.test.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): entrées du menu projet"
git add packages/ui/src/i18n/fr-project.ts packages/ui/src/dialogs/EditProjectDialog.tsx packages/ui/src/dialogs/edit-project-dialog.test.tsx packages/ui/src/dialogs/DeleteProjectDialog.tsx packages/ui/src/dialogs/delete-project-dialog.test.tsx packages/ui/src/tabs/tabs-model.ts packages/ui/src/tabs/tabs.test.ts
git commit -m "feat(ui): dialogues modifier et supprimer un projet"
git add packages/ui/src/shell/ShareControls.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/lazy-dialogs.ts packages/ui/src/shell/agents-shell.test.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): menu projet branché dans la barre latérale"
```

---

### Task 28: Parcours E2E des projets et des réglages

Vague 3 ← T21 à T27. Un parcours Playwright, en sombre et en clair (ports **4417** et **4418**, scénario `question`), qui capture les écrans 107, 108, 109, 110, 111, 112 et 77 et vérifie de bout en bout : modification d'un projet (nom, couleur), page Workspace (nom, description, image), thème par appareil, cloche et avatar, Raccourcis, « Accès web » dans Sécurité, suppression confirmée par le nom.

**Files:**
- Create: `e2e/projects.spec.ts`
- Modify: `e2e/playwright.config.ts:44-46`

**Interfaces:**
- Consumes: `pairAndCreateProject`, `createRepoProject`, `projectKey`, `shot`, `rpc` (`agents-seed.ts`), `E2E_TOKEN`, `createE2eRepo`.
- Produces: rien (dernière tâche).

- [ ] **Step 1: Deux démons de plus**

`e2e/playwright.config.ts`, après la ligne `menus-light` :
```ts
  { name: "projects-dark", scheme: "dark", port: 4417, spec: /projects\.spec\.ts/, scenario: "question" },
  { name: "projects-light", scheme: "light", port: 4418, spec: /projects\.spec\.ts/, scenario: "question" },
```

- [ ] **Step 2: Parcours (rouge tant que l'UI n'est pas intégrée, vert ensuite)**

`e2e/projects.spec.ts` :
```ts
import { expect, test } from "@playwright/test";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("modifier, workspace, en-tête, réglages et suppression d'un projet", async ({ page }, info) => {
  const key = projectKey("PRJ", info);
  const created = createE2eRepo(key);
  repo = created;
  const name = `Projets ${key}`;
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, name, key, created.repo);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const entry = sidebar.getByRole("button", { name, exact: true });

  await entry.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Modifier…" })).toBeVisible();
  await shot(page, info, "ecran-107");
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Dossier")).toHaveValue(created.repo);
  await expect(edit.getByRole("button", { name: "Parcourir…" })).toHaveCount(0);
  await edit.getByLabel("Nom").fill(`${name} bis`);
  await edit.getByRole("radio", { name: "Couleur #6366F1" }).click();
  await edit.getByLabel("Choisir une image…").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(edit.getByRole("img", { name: "Image · Image" })).toBeVisible();
  await edit.getByRole("button", { name: "Enregistrer" }).click();
  await expect(edit).toBeHidden();
  const renamed = sidebar.getByRole("button", { name: `${name} bis`, exact: true });
  await expect(renamed).toBeVisible();

  await page.goto("/#/settings/workspace");
  await expect(page.getByRole("heading", { level: 1, name: "Workspace" })).toBeVisible();
  await page.getByLabel("Nom").fill("Maison");
  await page.getByLabel("Description").fill("Mes projets et ceux de l'équipe");
  await page.getByLabel("Choisir une image…").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Maison/ })).toBeVisible();
  await expect(sidebar.getByRole("img", { name: "Image du workspace Maison" })).toHaveAttribute("src", /\/icons\/workspace\?v=/);
  await shot(page, info, "ecran-109");
  await sidebar.getByRole("button", { name: /Maison/ }).click();
  await expect(page.getByRole("menuitem", { name: "Renommer le workspace…" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto("/#/settings/appearance");
  await expect(page.getByRole("radio", { name: "Système" })).toHaveAttribute("aria-checked", "true");
  await shot(page, info, "ecran-110");
  await page.getByRole("radio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Clair" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Système" }).click();

  await page.goto("/#/settings/security");
  await expect(page.getByText("Accès web")).toBeVisible();
  await expect(page.getByRole("button", { name: "Générer un code" })).toBeVisible();
  await page.goto("/#/settings/general");
  await expect(page.getByText("Application")).toHaveCount(0);
  await page.goto("/#/settings/shortcuts");
  await expect(page.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Navigation" })).toBeVisible();
  await shot(page, info, "ecran-77");

  const header = page.locator("header").first();
  await header.getByRole("button", { name: /Historique des runs/ }).click();
  const bell = page.getByRole("menu", { name: "Historique des runs" });
  await expect(bell.getByText("Aucun run pour l'instant.")).toBeVisible();
  await expect(bell.getByRole("button", { name: "Activer les notifications" })).toBeVisible();
  await shot(page, info, "ecran-111");
  await page.keyboard.press("Escape");
  await header.getByRole("button", { name: /^Menu de / }).click();
  const menu = page.getByRole("menu", { name: /^Menu de / });
  await menu.getByRole("menuitem", { name: "Thème" }).hover();
  await expect(page.getByRole("menuitemradio", { name: "Système" })).toHaveAttribute("aria-checked", "true");
  await shot(page, info, "ecran-112");
  await menu.getByRole("menuitem", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sécurité" })).toBeVisible();

  await page.goto("/#/");
  await renamed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Supprimer…" }).click();
  const remove = page.getByRole("dialog", { name: `Supprimer le projet ${name} bis ?` });
  await expect(remove.getByText(new RegExp(`Le dossier ${created.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} et ses fichiers ne sont pas touchés`))).toBeVisible();
  const confirm = remove.getByRole("button", { name: "Supprimer" });
  await expect(confirm).toBeDisabled();
  await remove.getByLabel(`Tape ${name} bis pour confirmer`).fill(`${name} bis`);
  await shot(page, info, "ecran-108");
  await confirm.click();
  await expect(remove).toBeHidden();
  await expect(renamed).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("tablist", { name: "Onglets" }).getByRole("tab", { name: new RegExp(name) })).toHaveCount(0);
});
```
(`pairAndCreateProject` n'est pas utilisé : le projet a besoin d'un dossier pour vérifier « Le dossier … n'est pas touché ». Le viewer E2E est `userInfo().username` de la machine (`daemon/src/main.ts:44`) : le menu de l'avatar est visé par `/^Menu de /`. L'écran d'appairage E2E utilise `#pair=` et ne passe pas par le texte de `fr.pairing.help`.)

Run: `cd e2e && bunx playwright test --project=projects-dark --project=projects-light` — Expected: PASS, captures `ecran-107/108/109/110/111/112/77.png` dans `test-results`.

- [ ] **Step 3: Gate et commit**

Run: `bun run check && bun run typecheck` — Expected: PASS.

```bash
git add e2e/projects.spec.ts e2e/playwright.config.ts
git commit -m "test(e2e): projets, workspace et réglages"
```

---

## Auto-revue du plan

- **Couverture de la spec §14** : 14.1 → T20 (schéma, core), T21 (démon), T27 (UI) ; 14.2 → T20, T21, T18 (`IconField`), T26 (workspace), T27 (projet) ; 14.3 → T22, T27 (dialogue), T28 ; 14.4 → T20, T26 ; 14.5 → T23 (thème, Accès web, appairage), T24 (cloche, avatar), T25 (Raccourcis, retraits) ; 14.6 → T19, T18 ; 14.7 → aucune tâche (aucun code nouveau). Spec I §3.7 / §4 → T19.
- **Review Focus** : 1 → T21 Steps 2, 3 ; 2 → T22 Steps 2, 3 ; 3 → T22 Steps 3, 4 ; 4 → T21 Step 6 ; 5 → T27 Steps 4, 5 ; 6 → T24 Steps 1, 3.
- **Cohérence des noms** : `unregisterProject` (core) / `Docs.removeProject` (démon) ; `updateRegisteredProject`, `setProjectMeta`, `updateProjectMeta(projectId, patch, folderInDoc)` ; `createProjectAdmin`, `ProjectAdmin.{updateProject, setIcon, deleteProject, handler}` ; `IconStore.{get, version, set, remove}` ; `decodeIcon`, `sniffIconMime`, `serveIcon`, `parseIconPath` ; `setThemePreference`, `useThemePreference`, `THEME_PREFERENCES` ; `runHistory`, `unseenCount`, `readSeenAt`, `markSeen` ; `shortcutGroups` ; `projectMenuEntries` ; `closeProject` ; `frFields`, `frShortcuts`, `frWorkspace`, `frProject`.
- **Points laissés à l'exécutant, sans placeholder** : les noms exacts des maps de `collab/project-hosts.ts` (T22 Step 2) et les rôles ARIA rendus par Radix dans happy-dom (T23 Step 3, T27 Step 4) sont à lire dans le code, la consigne est donnée pour chaque cas.
