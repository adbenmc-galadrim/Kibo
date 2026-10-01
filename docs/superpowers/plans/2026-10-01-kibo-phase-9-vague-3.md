# Kibo · Finitions UI/UX, vague 3 (phase 9, v1.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer les trois derniers lots du plan d'action UI/UX avant le jalon `v1.1.0` : les **tickets sans projet** (boîte de réception du workspace, clé `INB-n`, rattachement à un projet avec nouvelle clé, dialogue « Nouveau ticket » avec projet et assigné : lot 3) ; la **lisibilité des écrans avancés** (Composants et Marketplace, Synchronisation, Agents, Code : titres, explications, états vides, confirmations, jargon replié : lot 6) ; le **confort de lecture et la robustesse** (retour à la ligne, recherche dans un fichier, écrans de chargement et « Kibo ne répond pas », largeurs adaptatives, arbre Tickets, Kanban : lot 8), en ouvrant par une tâche qui **ramène le chargement initial sous 226 kB** et en casant les mineures restées en attente des vagues 1 et 2, sans relever le budget de 230 kB ni consommer un token.

**Architecture:** le démon gagne une boîte de réception écrite en spec de conception §15.1 (un doc Loro de la forme d'un doc projet, jamais inscrit dans la liste des projets, jamais partagé), une RPC `fileTicket` (rattachement transactionnel avec nouvelle clé, via la garde d'écriture du projet cible), un refus d'assignation d'agent sur la boîte, et trois compléments (`isLocked` et `detail` de `deleteProject`, `notes.create` exclusif, `refreshMarketSource`). L'interface gagne un écran « Boîte de réception », un dialogue « Nouveau ticket » complet, un dialogue « Rattacher à un projet », la réécriture textuelle de quatre écrans avancés avec confirmations, une recherche et des filtres côté interface (Composants, arbre Tickets), une préférence « retour à la ligne » par appareil, des écrans de chargement et d'échec, et des largeurs adaptatives ; tout écran, dialogue et contenu de menu nouveau est chargé à la demande. Le Kanban range l'ordre manuel de ses colonnes dans ses données d'instance (spec composants §16). Aucune dépendance nouvelle.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, loro-crdt, bun:sqlite, React 19 + shadcn/ui (`packages/sdk/src/ui` : `collapsible`, `confirm-dialog`, `context-menu`, `dropdown-menu`, `menu-entries`, `select`, `sheet`, `table`, `toggle-group`, `tooltip` déjà présents), `@dnd-kit/core` 6.3.1 + `sortable` 10 (déjà présents), CodeMirror 6 (`@codemirror/view` 6.43 : `EditorView.lineWrapping`, `@codemirror/search` **non installé** : la recherche de l'aperçu est maison), shiki 4.4, Vite 7.1.6, happy-dom 18 + Testing Library, Playwright 1.55, Tauri 2 (coque : un seul fichier Rust touché, `main.rs`), cargo 1.98.

**Spec:** `docs/superpowers/specs/2026-09-25-kibo-design.md` **§15** (décisions de cette vague, écrites avant ce plan : 15.1 boîte de réception, 15.2 lisibilité, 15.3 confort, 15.4 démon, 15.5 codes), §11 (ports E2E 4390–4430), §13 (glossaire : boîte de réception), §14 (vague 2 : 14.3 `deleteProject`, 14.5 cloche et avatar) ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` **§16** (`notes.create`, ordre du Kanban, filtres de l'arbre, tri des notes) ; `docs/superpowers/specs/2026-09-26-kibo-marketplace.md` **D47** (`refreshMarketSource`) ; `docs/superpowers/specs/2026-09-26-kibo-agents.md` **§11** (boîte de réception, en-tête, historique, vocabulaire) ; `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` **§12.8** (vocabulaire git, retour à la ligne) ; `docs/superpowers/specs/2026-09-26-kibo-sync.md` §13 (D9, D17, D30, D32, D39). Plan d'action : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (lots 3, 6, 8). Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md` (points 4, 6, 8, 15, 16, 17 ; zones Shell, Tickets, Kanban, Notes, Code, Aperçu, Composants, Sync, Agents, Largeurs). Plans des vagues 1 et 2 (forme et contrats hérités) : `docs/superpowers/plans/2026-09-27-kibo-phase-9-vague-1.md`, `docs/superpowers/plans/2026-09-30-kibo-phase-9-vague-2.md`. Données des maquettes : `design/donnees-fictives.md`.

## Points pour Adam (défaut retenu en attendant)

Ces points sont écrits dans la spec avec leur défaut ; le plan les applique tels quels. Une réponse différente d'Adam change la tâche indiquée, rien d'autre.

| # | Question | Défaut retenu (spec) | Tâches concernées |
|---|---|---|---|
| A1 | La boîte de réception doit-elle rester **plate** (ni sous-tickets ni dépendances), plus simple à expliquer ? | Structure permise ; un sous-arbre est rattaché en bloc, les liens internes suivent, les liens vers la boîte sont perdus (§15.1) | T31 (core `transferTicket`), T33 (texte de confirmation) |
| A2 | Rattacher à un **projet partagé** : la clé arrive du serveur (`KIB-…` en attente) ; faut-il interdire le rattachement hors ligne ? | Permis, comme toute création dans un projet partagé (spec G §5) | T31 |
| A3 | Clé `INB` **réservée** à la création d'un projet ; un projet rejoint de clé `INB` est toléré | Refus à la création (`INVALID_INPUT`), tolérance au `joinProject` | T31, T32 |
| A4 | « Mes tickets » et la vue d'ensemble comptent-ils les tickets de la boîte assignés à moi ? | Oui, groupe « Boîte de réception » | T32 |
| A5 | L'ordre manuel des colonnes du Kanban est **par instance** (chaque page Kanban a le sien) et se synchronise avec le projet | Par instance, données d'instance (spec composants §16.2) | T43 |
| A6 | Vocabulaire git : « Ajouter au commit / Retirer du commit » remplace « Indexer / Désindexer » | Appliqué (§15.2, spec code §12.8) | T38 |
| A7 | Retour à la ligne **activé par défaut** pour le code (aperçu, éditeur) comme pour le diff | `on` par défaut, bascule mémorisée par appareil (§15.3) | T40 |
| A8 | Écran « Kibo ne répond pas » : texte « comment obtenir un serveur » de la page Synchronisation renvoie à la documentation de `kibo-sync` (pas d'offre hébergée) | Lien vers `docs/` du dépôt, texte neutre (§15.2) | T36, T39 |
| A9 | Historique des agents : une ligne ouvre le **tiroir** (pas une page de détail) | Tiroir, mécanisme `focusRun` (spec agents §11) | T37 |
| A10 | Appareils de sync : révocation confirmée, **pas de renommage** (aucune RPC) | Confirmation seule | T36 |

## Vérifié sur le code (`phase/9` = `71fe758`, lots 1, 2, 4, 7 intégrés ; vague 2 T28 non livrée)

Le plan d'action et le repérage citaient des noms de mémoire ; tout a été confronté au code. Colonne « Réel » : ce qui fait foi pour toutes les tâches.

| Besoin | Supposé | Réel (vérifié) |
|---|---|---|
| Budget UI | 229,1 kB | **229,2 kB** mesurés sur ce worktree (`bun run budget`, après `bun install --frozen-lockfile`), marge 0,8 kB. Le chunk d'entrée (`index-*.js`, 118 kB gzip) contient **`shell/shared-modules.ts`**, importé par `main.tsx` pour exposer `globalThis.__kiboShared` aux composants trusted : il tire `@radix-ui/react-select` (44 kB bruts), `react-radio-group` (12 kB), `ui/dialog`, `textarea`, `skeleton`, `label` dans l'entrée alors qu'aucun écran initial ne les rend. `@dnd-kit/core` (76 kB bruts) est dans l'entrée par `TabBar` (onglets triables) et `ProjectPages` (pages). `@radix-ui/react-context-menu` (9 kB) par `AppSidebar`, `ProjectPages`, `TabBar`. Détail : `bundle-report.ts` (`FORBIDDEN_IN_ENTRY`, 23 motifs), `bundle-budget.ts`. |
| Tickets hors projet | arbre dans le doc workspace | **Aucun** : le doc workspace (`core/workspace.ts`) n'a que `projects`, `settings`, `domains`, `guidelines`, `profiles`, `componentRegistry` ; `requireWorkspace` reconnaît un workspace à l'absence de `meta.id`. Tout le code des tickets est écrit pour un doc projet : `createTicket(doc, NewTicket)` lit `getProjectMeta(doc).key` et `nextTicketSeq(doc)` (`core/tickets.ts:72-93`), `readProject(doc)` (`core/commands.ts:109`), `executeProjectCommand`, `links.ts` (ids du même doc). D'où §15.1 : la boîte est un doc projet non inscrit. `createProjectDoc(meta)` (`core/project.ts:6-16`) ; `projectDocId(id)` = `project:<id>` (`daemon/projects/doc-ids.ts`) ; `loadDoc(store, id)`. |
| Clé `INB` | libre | `ProjectKey = /^[A-Z]{2,6}$/`, `TicketKey = /^[A-Z]{2,6}-\d+$/` (`schema/ids.ts`) : `INB` et `INB-1` passent. `registerProject` ne refuse que les doublons de la liste (`core/workspace.ts:19`). Le formulaire valide avec `ProjectKey` (`dialogs/NewProjectDialog.tsx:51`) ; `suggestProjectKey` (`lib/project-key.ts`). |
| Chemin des commandes | `service.handle` → core | `service.ts:295-304` (`assertShellCommand`, contrôle d'`instanceId`, `docs.run(projectId, command, { origin: "user", instanceId })`) → `command-path.ts` `guarded` (`assertWritable`, `execute`, `persist` dans `store.transaction`, `restoreAll` sur erreur, `published`). `CommandPath.transaction<T>(fn)` enveloppe plusieurs projets (rollback de tous les projets touchés avec `emit`). `service.ts` fait **322 lignes** ; `handle` (l. 256-316) porte `getSession`, `listProjects`, `createProject`, `getProject`, `command`, `getConfig`, `config`, `getTabs`, `saveTabs`. |
| `createTicket` et « Bloqué » | motif acceptable | `ProjectCommand.createTicket` n'a **pas** de `blockedReason` (`schema/command.ts:27-34`) ; `NewTicket` non plus ; `createTicket` avec `statusId: "blocked"` ⇒ `BLOCKED_REASON_REQUIRED`. Le dialogue exclut « Bloqué » (`NewTicketDialog.tsx`). |
| Agents sur un ticket | dossier vérifié à l'assignation | `orchestrator.assign` vérifie seulement `ticket.key !== null` ; le dossier n'est exigé qu'au lancement (`workspace-prep.ts:38-42`, `WORKSPACE_FAILED`). Routage : `agents-rpc.ts:26-34`. UI : `AssignDialog.tsx` (avis `noProject`, `noProfile`, `noTicket`), `KeyRequired`, `MyTicketRow.canRun = project.folder !== null`. |
| Nouveau ticket | sélecteur de projet | `NewTicketDialog { project: ProjectSnapshot; viewer; defaults: NewTicketDefaults; onClose }` ; assigné forcé `{ kind: "human", ref: viewer }` (l. 37-49) ; ouvert seulement si `ticketProject` (`ShellDialogs.tsx:183-190`) ; bouton d'en-tête masqué sans `ticketProject && canEdit` (`ShellHeader.tsx:66-76`). `ticketProject = useProject(activeProjectId ?? lastProjectId)` (`Shell.tsx:78`). `NewTicketDefaults = { statusId?; parentId?; instanceId? }` (`sdk/types.ts:38`). Tests : `dialogs/dialogs.test.tsx`. |
| « Mes tickets », palette | RPC dédiée | Aucune : `useSnapshots(projects.map(p => p.id))` fait un `getProject` par projet et recharge sur `client.subscribe` (`state/use-snapshots.ts`) ; `myTickets(projects, snapshots, viewer, tab)` groupe par projet (`mine/my-tickets.ts`) ; la palette lit `snapshot.tickets` par projet (`palette/palette-items.ts:112-129`) et n'offre `newTicket` que si un projet est actif. `describeTarget` lit `project.name` dans `ctx.projects` (`tabs/tab-title.ts`) : le nom affiché de la boîte passe par un helper UI. |
| Composants : recherche, filtres, usages | RPC à ajouter | **UI seule** : `ComponentSummary = { id, title, builtin, versions: ComponentVersionSummary[] }` et chaque version porte `trust`, `origin`, `usages: ComponentUsage[] { projectId, projectName, pageId, pageTitle, instanceId }` (`schema/component.ts:130-154`) ; `componentRows(components, statuses)` (`components-page/rows.ts`) calcule déjà `pages`, `projects`, `used`. Table : `ComponentsTable.tsx` (colonnes name, version, trust, origin, usedIn), texte `fr.components.usage(pages, projects)`. `CreateComponentDialog { open; onOpenChange; target: … \| null; onAdded? }` accepte `target = null` (test `component-dialogs.test.tsx:320`). |
| Marketplace : rafraîchir une source | `refreshSource` | **Absente** : `refreshMarket` est global (`schema/market-rpc.ts`), `MarketService.refresh(sourceId?)` (`daemon/market/market-service.ts:139`) accepte déjà un id, `refreshOne(id)` l. 259 ; `ComponentSourcesPage.requestOf` (l. 16-17) envoie `refreshMarket` pour une ligne. D'où D47. Sources : `MarketSourceInfo { id, name, url, publicKey, fingerprint, lastSerial, lastFetchedAt, lastError, enabled }`. |
| Sync : appareils et projets | `renameDevice`, `leaveProject` | **Absentes** ; `addDevice` ⇒ `{ code, expiresAt }` (15 min), `revokeDevice { deviceId }`, `unshareProject { projectId }` (propriétaire), quitter = `deleteProject` d'un membre (§14.3). `SyncStatus { state, serverUrl, user: { id, name } \| null, deviceId, retryAt, lastError, projects: SyncProjectStatus[] { projectId, name, role, lastSyncAt, lastError, accessRevoked } }`. Pages : `SyncSettingsPage.tsx` (147 l., `EmptyState` l. 29-41, `DisconnectDialog` déjà confirmé), `SyncServerCards.tsx` (URL brute l. 55, `user.id.slice(0, 8)` l. 86), `SyncDevicesCard.tsx` (révocation sans confirmation l. 63), `SyncProjectsCard.tsx` (aucune action), `ConnectServerDialog.tsx` (`wss://` l. 90, certificat l. 116-125), `AddDeviceDialog.tsx`. Textes `fr-collab.ts`. Les dialogues `ShareProjectDialog` (membres, invitation, arrêt) et `DeleteProjectDialog` (quitter) existent. |
| Agents : historique | lignes cliquables | `AgentsPage.tsx:134-173` : `TableRow` sans `onClick` ; `history = [...state.runs].sort(seq desc)`. Le tiroir s'ouvre sur un run par `focusRunId` (`AgentPanel.tsx:31-36`), posé par `Shell.setFocusRun` et déjà passé à `ScreenView` comme `onAnswer`. `useRunLog(runId)` (`state/use-agents.ts:41-56`) relance toute erreur hors `UNAUTHORIZED` ; `getRunLog` ⇒ `RunLogEntry[]`, `NOT_FOUND` pour un run inconnu, `[]` sans événement. `RunJournal({ label, log, files })` sans état vide. Sans confirmation : `AgentDrawer.tsx:108` (`cancelRun`), `QueuePage.tsx:146`, `ProfileSheet.tsx:115-125` (`config deleteProfile`). Modes de permission bruts : `AgentsPage.tsx:32`, `ProfileSheet.tsx:213-216` (`MODES = ["plan", "acceptEdits", "default"]`). |
| Code : libellés | — | `fr-code.ts:81` `kind: { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "A", conflicted: "U" }`, `kindLabel` l. 82-89, rendu `FileList.tsx:125-130` ; `changes.staged` / `unstaged` l. 56-57 ; `pushCommand` l. 144 affiché par `PushActions.tsx:52` ; `⌘↵` en dur `CommitPanel.tsx:74-76`, `CommandPalette.tsx:206` ; `⌘⇧O` dans `fr-code.ts:196` (`file.hints`). `shortcutLabel(keys, mac)`, `isMac()` (`lib/shortcut-label.ts`). Entrées de menu : `code/file-menu.ts`. E2E qui citent « Indexer » : à relever par `grep -rn "Indexer\|Désindexer\|Indexés" e2e/`. |
| Aperçu, éditeur, diff | — | `CodeLines.tsx:49` `whitespace-pre` ; `CodeEditor.tsx:45-50` sans `EditorView.lineWrapping` ; `DiffView.tsx:12` déjà `whitespace-pre-wrap` ; `FilePreviewSheet.tsx:112` `fileRef.line ?? 1` ; aucun bouton copier ; `FileTabView.tsx`. `localStorage` : deux helpers `withStorage` dupliqués (`theme.ts:12-19`, `shell/run-history.ts:20-27`), clés `kibo.theme`, `kibo.runs.seenAt`. |
| Chargement, démon injoignable | — | `App.tsx:28` `void bootstrap().then(setSession)` **sans catch** ; l. 31 `return null` ; `Shell.tsx:54` `if (!projects \|\| !tabs) return null` ; `useProjects` relance toute erreur hors `UNAUTHORIZED` (`state/use-projects.ts:5-7`). Une panne réseau rejette avec la `TypeError` native de `fetch` (`sdk/client.ts:54-63`), pas une `KiboError`. `AgentBar.tsx:91-96` « Démon local / injoignable » (`fr.agents.daemon`, `daemonOffline`, l. 186-187). `main.rs` : `expect` l. 153, 156, 165, 168, 180, 198 ; `exit(1)` sans message l. 186-188. |
| Largeurs | — | 9 pages `grid min-h-full grid-cols-[14rem_1fr]` (`settings/*Page.tsx`, `SettingsNav.tsx:68`) ; `TicketSheet.tsx:51` `w-[480px] sm:max-w-[480px]` ; `shell/sheet/CiLogSheet.tsx:45` `w-[720px]` ; `code/ChangesBody.tsx:181` `grid-cols-[272px_minmax(0,1fr)_340px]` (298 l.) ; `Breadcrumb.tsx` (`crumbsFor`, `Crumb` sans lien, seul appelant `ShellHeader.tsx:53-56`). |
| Arbre Tickets, Kanban, Notes | — | `components/tickets/src/TicketsTree.tsx` (171 l. : `loading ? null` l. 121, état vide l. 122, `DndContext` + `dropPlan`, menu déjà en données) ; `components/kanban/src/Kanban.tsx` (191 l. : filtre local l. 71-73, « + » absent de `blocked` l. 142-144, `DndContext` sans `SortableContext`, ordre = ordre de l'arbre), `KanbanCard.tsx` (poignée = clé l. 66-68, `CI_DOT.neutral = "bg-zinc-400"` l. 18), manifeste sans `data` ; `components/notes/src/NoteList.tsx` (liste plate, `ORDER BY mtime DESC` côté démon), `NotesView.tsx:120-126` (`create` : contrôle d'existence côté client puis `write(path, …, null)`). Données d'instance : `ComponentCall data.*` (`schema/call.ts`), `KiboSdk.data` (`sdk/types.ts:42-47`), gardé par `manifest.data` (`sdk/sdk.ts:57`), simulé (`sdk/mock.ts:148-157`). |
| Mineures | — | `IconField.tsx:49-59` `<input type="file" class="sr-only">` sans `tabIndex`, prop `label` non affichée ; `EditProjectDialog.tsx` peut rendre trois `role="alert"` (`IconField`, `FolderField.tsx:61`, l. 137) ; `workspace-page.test.tsx:87-93` **réappelle `mock.module("../api")`** dans un test (le `rpcImpl` du brief n'existe pas : c'est ce double mock qu'il faut remplacer par une variable réassignable) ; `UserMenuContent.tsx:45-56` `DropdownMenuRadioItem` (puce) ; `fr.nav.shareProject` (`fr.ts:28`) = `frShare.action` (`fr-share.ts:9`) ; `AppSidebar.tsx` 318 l. (`ProjectEntry` l. 118-186) ; `Shell.tsx` 337 l. ; `projects/admin.ts` `deleteProject` sans `assertWritable` ni verrou, `project-hosts.ts` `locked` sans accesseur (`setLocked` l. 65-68) ; `notes-fs.ts:77-96` `writeNoteFile(dir, rel, markdown, expectedMtime)` ; `DeleteProjectDialog.tsx:99` `t.keeps(project.folder)` dans un `DialogDescription` sans `break-all`, `Overview.tsx:49-51` `truncate` (le chemin coupé n'est pas lisible). |
| Tests UI | helpers | `mock.module("../api", …)` par fichier puis `await import` ; variables `let outcome` réassignables (modèle `files/files.test.tsx:1-43`) ; jamais deux `mock.module` du même module dans un fichier. Composants : `createMockSdk(manifest, { seed, viewer, notes, shared })`, `SdkProvider`, `runConformance`. Fixtures : `agents/fixtures.ts` (`agentsFixture`, `runFixture`, `configFixture`, `kiboProject`, `projectsFixture`), `mine/fixtures.ts` (`mineTicket`). |
| Tests démon | — | `service.test.ts` : `openStore(tmp())`, `createService(store, { user: "adam" })`, `newProject`, `call(service, req)` ; `projects/delete.test.ts`, `admin.test.ts` (modèle avec `ProjectAdminDeps` simulées) ; sync réelle : `testing/sync-harness.ts`. |
| E2E | ports | 4390–4416 pris, **4417–4418 réservés à T28** (vague 2, non livrée) ; ce plan prend **4419–4422** (deux specs, sombre et clair chacune) ; la plage documentée passe à 4390–4430 (spec §11). Aucun script ne vérifie la plage. |
| Penpot | écran libre | Dernier écran scripté : **106** ; 107–112 décrits textuellement par la vague 2 (T17 non dessinée). Ce plan prend **113 à 126**, décrits textuellement ; Penpot reste un écart assumé au jalon. |

## Global Constraints

- Bun **1.4.2**, dépendances figées par `bun.lock`, aucun `postinstall`, **aucune dépendance nouvelle** dans cette vague (la recherche de l'aperçu est maison ; `@codemirror/search` n'est pas ajouté).
- **Aucun commentaire dans le code** ; code, identifiants et messages d'erreur internes en anglais ; textes d'interface en français, **tutoiement**, sans jargon (§15.2 : « places », « Isolé », « Bloquer ce composant », « Ajouter au commit »…). Un texte nouveau d'un module chargé à la demande vit dans son `i18n/fr-<sujet>.ts` importé directement (jamais monté dans `fr.ts`) : `fr-inbox.ts` (T32, T33), `fr-components-list.ts` (T34), `fr-sync-page.ts` (T36), `fr-file-tools.ts` (T40), `fr-startup.ts` (T39) ; les sections existantes (`fr.ts › nav, newTicket, agents, queue, agentsPage, profile, mine, overview`, `fr-code.ts`, `fr-components.ts`, `fr-market.ts`, `fr-collab.ts`, `components/*/src/fr.ts`) sont modifiées en place par la tâche qui les cite.
- **Budget de 230 kB jamais relevé** : T29 ouvre la vague, mesure, et ramène le chargement initial **≤ 226,0 kB** (objectif ≈ 212 kB avec le repli des modules partagés) avant toute autre intégration UI ; chaque écran, dialogue, volet ou contenu de menu nouveau est chargé à la demande (`lazyPanel`) et **ajouté à `FORBIDDEN_IN_ENTRY`** ; ce qui entre dans l'entrée est limité à quelques lignes (une entrée de barre latérale, un sélecteur, un texte de chargement) et chaque tâche UI note sa mesure `bun run budget` dans son rapport ; le chef d'équipe la relance après chaque intégration et refuse une tâche qui dépasse 226,0 kB tant que le repli de T29 n'est pas épuisé.
- **Toute action destructive est confirmée** (§15.2) ; la confirmation nomme la cible, ce qui disparaît et ce qui reste. Aucune suppression sans `ConfirmDialog`.
- **Boîte de réception** : jamais inscrite dans `projects`, jamais partagée, refusée partout où un projet se modifie ou se partage ; `fileTicket` passe par `assertWritable` du projet cible ; un ticket de la boîte n'est jamais assigné à un agent (démon et UI).
- **Lecture seule et session distante** : en projet partagé avec accès `read-only` ou `revoked`, aucune entrée d'écriture (ni rattachement vers ce projet, ni réordonnancement du Kanban) ; en session distante, les actions réservées à la machine restent absentes (`isRemoteView()` en prop par défaut, décision 13 de la vague 1).
- Chaque écran ou dialogue existe **en sombre et en clair** (jetons `dark:`, aucune couleur codée hors jetons sauf l'orange de marque et les couleurs de projet ; `bg-zinc-400` de la pastille CI est remplacé).
- **Tests** : TDD ; `bun test` sans horloge murale (temps injecté), sans dépendance à l'ordre des fichiers, sans `mock.module` d'un module partagé (seul `../api` par fichier, une seule fois) ; démon avec `openStore(tmp())` ; composants avec `createMockSdk` et la suite de conformité ; CRDT avec fast-check (T31) ; coque avec `cargo test` ; E2E en T44 sur les ports 4419–4422, et les specs existantes touchées par un changement de libellé (T38) relancées. Aucun test ne consomme de token.
- Aucune erreur avalée : chaque `catch` affiche (`role="alert"`) ou relance ; jamais `catch {}` vide ; `useRunLog` ne relance plus `NOT_FOUND` mais le rend (T37).
- Fichiers ≤ ~300 lignes : `service.ts` (322), `Shell.tsx` (337), `AppSidebar.tsx` (318) redescendent sous 300 dans les tâches qui les touchent (T31, T39, T29) ; `ChangesBody.tsx` (298) ne grossit pas (T41 extrait la mise en page).
- Git : une branche `feat/p9-t<n>` par tâche depuis `phase/9`, worktree `.claude/worktrees/p9-t<n>` ; commits d'une ligne en français, préfixe conventionnel, < 50 caractères, fichiers stagés explicitement, jamais `git stash`, aucune mention d'IA. `bun run check`, `bun run typecheck`, `bun test packages components ./scripts` (et `bun run budget` pour une tâche UI) verts avant chaque commit final.

## Review Focus

1. **Boîte de réception étanche** (T31) : `listProjects` ne la liste jamais ; `shareProject`, `createProjectInvite`, `updateProject`, `deleteProject`, `setIcon`, `setNotesDir`, `getNotesDir` sur `inbox` ⇒ `INVALID_INPUT` sans rien modifier ; une commande `addPage` ou `addInstance` sur `inbox` ⇒ `INVALID_INPUT` ; `createProject` avec la clé `INB` ⇒ `INVALID_INPUT` ; un redémarrage du démon retrouve les tickets de la boîte et continue la numérotation (test « survives a restart »).
2. **Rattachement transactionnel** (T31) : vers un projet en lecture seule ⇒ `FORBIDDEN`, la boîte et le projet intacts ; vers un projet en cours de partage ⇒ `CONFLICT` ; `parentId` inconnu ⇒ `NOT_FOUND` et rien n'est créé ; sous-arbre de 3 tickets avec 2 liens internes et 1 lien externe ⇒ 3 tickets créés dans l'ordre, clés `KIB-n` consécutives, 2 liens recréés, le lien externe perdu, la boîte vidée du sous-arbre ; vers un projet partagé (`keyAllocator = server`) ⇒ `key: null`, `pendingSeq` posé, puis clé attribuée par le serveur (`startSyncHarness`). Propriété fast-check : après un rattachement, les clés du projet cible restent uniques et `ticketSeq` cohérent.
3. **Agent jamais sur la boîte** (T31, T33) : `assignAgent { projectId: "inbox" }` ⇒ `INVALID_INPUT` avant tout accès à l'orchestrateur ; la fiche d'un ticket de la boîte n'a pas « Assigner », la palette ne propose pas `assign` pour `INB-n`.
4. **Modules partagés à la demande** (T29) : un composant trusted chargé après le repli trouve `globalThis.__kiboShared` complet **avant** l'évaluation de son module (`loadTrusted` attend l'exposition) ; `shared-modules.test.ts` inchangé ; le chunk d'entrée ne contient plus `react-select` (`bun run budget` ≤ 226,0 kB, `FORBIDDEN_IN_ENTRY` gagne `shell/shared-modules.ts` et `@radix-ui/react-select`).
5. **Confirmations et détails** (T35, T36, T37) : aucune action destructive sans `ConfirmDialog` ; `Escape` ou « Annuler » ne déclenche aucune RPC ; une erreur de la RPC s'affiche dans le dialogue sans le fermer ; aucun identifiant brut (`hit.id`, `user.id`, `sha256:`) hors d'un bloc « Détails » replié par défaut.
6. **Démon injoignable** (T39) : `fetch` qui rejette (`TypeError`) ⇒ écran « Kibo ne répond pas » avec « Réessayer » et nouvelle tentative automatique (temps injecté) ; `UNAUTHORIZED` ⇒ écran d'appairage comme avant ; une `KiboError` autre ⇒ message et « Réessayer », jamais un écran blanc ; `main.rs` : un démon qui meurt ⇒ message sur stderr et `exit(1)`, pas de `panic`.
7. **Ordre du Kanban** (T43) : l'ordre persiste par `sdk.data.set("order", …)` et se relit au montage ; un identifiant inconnu est ignoré ; en lecture seule, aucun glisser ; la conformité du composant passe avec `data: true`.

## Décisions

Les décisions de démon, de schéma et de vocabulaire sont écrites en spec (§15, composants §16, marketplace D47, agents §11, code §12.8) ; le plan ne les répète pas. Décisions d'interface prises par ce plan, à reporter au rapport du jalon :

1. **`lazyPanel` gagne `fallback: "children"`** (SDK, T29) : pendant le chargement, le panneau rend `props.children` tel quel, pour envelopper un élément déjà visible (le bouton d'un projet) d'un menu chargé à la demande sans le faire disparaître. `ProjectHeaderMenu` (menu contextuel + « ⋯ » du projet, dans le chunk `share-entry`) remplace `ProjectMenu` ; `ProjectEntry` sort de `AppSidebar.tsx` ; le contenu du menu des onglets devient `TabMenuContent`, chargé à l'ouverture.
2. **Repli de budget exécuté d'office** (T29) : `exposeSharedModules()` quitte `main.tsx` ; `loadTrusted` l'attend (`import("./shared-modules")`) avant d'importer un module trusted. C'est la marge de toute la vague ; il n'y a pas d'autre repli prévu, donc chaque tâche UI reste à la demande.
3. **La boîte dans l'interface = un `ProjectSnapshot` comme un autre, jamais un projet** : `lib/inbox.ts` fournit `inboxMeta()` (nom « Boîte de réception »), `displayName(meta)`, `withInbox(projects, snapshots)` ; `useSnapshots` reçoit `INBOX_ID` en plus des projets ; les listes de projets (barre latérale, vue d'ensemble, palette « projets », sélecteur de dossier) ne reçoivent jamais la boîte, les listes de tickets (« Mes tickets », palette « tickets », fiche, onglet ticket) la reçoivent par `withInbox`.
4. **Un dialogue « Nouveau ticket » autonome** : il reçoit la liste des projets et charge lui-même le snapshot du projet choisi (`useProject`), pour que le sélecteur fonctionne sans que le shell précharge chaque projet ; verrouillé sur un projet quand un parent ou une instance est donné.
5. **Recherche et filtres côté interface** (Composants, arbre Tickets) : fonctions pures testées sans DOM (`filter-components.ts`, `filter-tickets.ts`), état local non persisté (un filtre est un geste, pas un réglage) ; seul le tri et la bascule de retour à la ligne, qui sont des préférences, vont dans `localStorage` par un helper partagé `lib/local-pref.ts` (qui absorbe les deux `withStorage` dupliqués).
6. **Confirmations par `ConfirmDialog` du SDK** partout, avec `describeError` qui traduit le code (`error-message.ts`) ; les textes nomment la cible.
7. **Historique des agents** : la ligne entière est un bouton (`role="button"` sur la ligne, clavier compris) ; le filtre est un `ToggleGroup` et la recherche un champ ; `useRunLog` renvoie `{ log, missing }` au lieu de relancer `NOT_FOUND`.
8. **Changements en largeur réduite** : sous `lg`, la liste des fichiers devient un panneau repliable au-dessus du diff (`Collapsible`, ouvert par défaut) et le commit passe sous le diff ; au-dessus, les trois colonnes actuelles. Un composant `ChangesLayout` pur de mise en page, testé sur ses classes.
9. **Écrans Penpot** : décrits textuellement ci-dessous (113 à 126) ; Penpot reste un écart assumé listé au jalon, comme en vague 2.

## Écrans décrits (113 à 126 ; 1, 108 et 112 amendés)

Page Penpot « 14 · Finitions UI » si elle est dessinée un jour ; sinon ces descriptions font foi, en sombre et en clair, données de `design/donnees-fictives.md` (workspace « Perso », projets Kibo (KIB), Portfolio (POR), API Facturation (FAC), utilisateur Adam, runs opus-dev-2 KIB-14 « attend », sonnet-review KIB-11 terminé il y a 41 min). Chaque tâche UI cite les écrans qu'elle implémente.

- **113 · Boîte de réception** (T33) : barre latérale avec « Boîte de réception » (icône `Inbox`) entre « Mes tickets » et « Agents », badge « 3 » ; en-tête « Boîte de réception », sous-titre « Les tickets qui n'ont pas encore de projet. Rattache-les quand tu sais où ils vont. », bouton « Nouveau ticket » ; tableau : clé (`INB-1`, `INB-2`, `INB-3`), titre (« Appeler le comptable », « Idée : export CSV des tickets », « Relire la doc d'onboarding »), statut (pastille + libellé), assigné (« Adam » ou « — »), bouton « Rattacher… » ; menu ⋯ et clic droit : « Ouvrir », « Rattacher à un projet… », séparateur, « Supprimer… ». Variante vide : icône, « Rien en attente. », « Les tickets créés sans projet arrivent ici. », bouton « Nouveau ticket ».
- **114 · Nouveau ticket** (T32) : dialogue « Nouveau ticket » ; sélecteur « Projet » (« Boîte de réception », puis « Kibo », « Portfolio », « API Facturation » ; « Kibo » sélectionné quand un onglet Kibo est ouvert), sous-titre « Clé KIB-25 » (ou « Clé attribuée à la synchronisation » pour un projet partagé, « Clé INB-4 » pour la boîte) ; champ « Titre », « Description », sélecteur « Statut » (Backlog, À faire, En cours, En review, Bloqué, Terminé), champ « Motif » visible seulement pour « Bloqué » ; sélecteur « Assigné » (« Moi (Adam) » par défaut, « Personne », et les membres en projet partagé) ; boutons Annuler / Créer. Variante verrouillée : « Projet : Kibo » en texte, aide « Un sous-ticket reste dans le projet de son parent. »
- **115 · Rattacher à un projet** (T33) : dialogue « Rattacher INB-2 à un projet », sélecteur « Projet » (projets modifiables ; « Kibo » sélectionné), texte « Le ticket reçoit une nouvelle clé dans ce projet (la prochaine est KIB-25). Ses sous-tickets suivent ; ses liens vers d'autres tickets de la boîte sont perdus. » (phrase sur les sous-tickets et les liens seulement s'il en a), boutons Annuler / Rattacher ; après confirmation, la fiche s'ouvre sur `KIB-25`. Variante partagé : « Sa clé sera attribuée par le serveur de sync. »
- **116 · Composants › Installés** (T34) : en-tête « Composants », sous-titre « Les widgets et vues disponibles dans tes pages. Les composants intégrés viennent avec Kibo ; les autres sont à toi, créés par l'IA ou installés depuis une marketplace. », bouton « Créer un composant » ; barre : champ « Rechercher un composant », filtre « Confiance » (Tous / Fiables / Isolés / À examiner), filtre « Origine » (Tous / Kibo / Les miens / Créés par l'IA / Marketplace) ; tableau à en-têtes cliquables (flèche de tri) : Nom ↑, Version, Confiance, Origine, Utilisé dans ; la cellule « 3 pages · 2 projets » est un bouton ; volet latéral « Utilisé dans » : « Kanban 1.0.0 », liste « Kibo › Tableau de bord », « Kibo › Sprint », « Portfolio › Accueil », chaque ligne un bouton qui ouvre la page. Variante : « Aucun composant ne correspond. » avec « Effacer les filtres ».
- **117 · Composants : confirmations et Marketplace** (T35) : menu ⋯ d'un composant : « Vérifier le code », « Bloquer ce composant », « Modifier avec l'IA », « Publier sur la marketplace », séparateur, « Désinstaller… » ; dialogue « Désinstaller Météo 1.2.0 ? » (« Le composant est retiré de ton workspace. Il n'est posé sur aucune page. ») ; dialogue « Bloquer Météo 1.2.0 ? » (« Ses instances n'affichent plus rien tant que tu ne l'examines pas de nouveau. ») ; carte marketplace sans identifiant, avec « Détails » replié (identifiant, empreinte) ; onglet Marketplace vide : « Aucune source de composants », « Une source est un catalogue signé, publié par ton équipe ou par un tiers. », bouton « Ajouter une source » qui ouvre le dialogue d'ajout sur place, lien « Gérer les sources ».
- **118 · Sources de composants** (T35) : Paramètres › « Sources de composants », sous-titre « Les catalogues où tu installes des composants. Chaque catalogue est signé par sa source. » ; colonnes : Nom, Adresse, Version du catalogue, Mise à jour, État ; menu ⋯ : « Rafraîchir cette source », « Retirer… » ; dialogue « Retirer la source Galadrim ? » (« Les composants déjà installés restent. Si tu la rajoutes plus tard, Kibo reconnaîtra ses éditeurs. ») ; bouton « Tout rafraîchir » dans l'en-tête.
- **119 · Synchronisation** (T36) : Paramètres › « Synchronisation ». État vide : icône, « Partage tes projets entre tes appareils et avec ton équipe. », « Il te faut un serveur kibo-sync, hébergé par ton équipe. » avec lien « Comment en installer un », deux cartes : « Se connecter à un serveur » (« Avec l'adresse et le code reçus de l'administrateur. », bouton « Se connecter ») et « C'est mon autre appareil » (« Sur l'appareil déjà connecté : Paramètres › Synchronisation › Appareils › Ajouter un appareil. Le code vaut 15 minutes. », bouton « Entrer le code »). État connecté : carte « Serveur » (« sync.galadrim.fr », pastille « Connecté », « Détails » replié avec l'adresse complète), carte « Compte » (« Adam », « Détails » avec l'identifiant), carte « Appareils » (« MacBook d'Adam · Cet appareil », « PC maison · vu il y a 2 h », bouton « Révoquer… » → dialogue « Révoquer PC maison ? » « Cet appareil ne pourra plus se connecter. »), carte « Projets partagés » (« Kibo · propriétaire · synchronisé il y a 1 min », menu ⋯ : « Ouvrir », « Gérer le partage… », « Arrêter le partage… » ; pour un membre : « Quitter… »).
- **120 · Se connecter et Ajouter un appareil** (T36) : dialogue « Se connecter à un serveur » : « Adresse du serveur » (aide « Donnée par ton équipe, elle commence par wss:// »), « Code » (aide « Code d'invitation (48 h) ou code d'appareil (15 min). »), « Nom de cet appareil », « Options avancées » replié (certificat racine) ; dialogue « Ajouter un appareil » : code `A7K2 9FQ3 …` avec « Copier », « Adresse du serveur : sync.galadrim.fr » avec « Copier », étapes « 1. Sur l'autre appareil, ouvre Paramètres › Synchronisation. 2. Choisis « C'est mon autre appareil ». 3. Saisis l'adresse et ce code (15 minutes). »
- **121 · Agents : historique et confirmations** (T37) : en-tête « Agents », sous-titre « Un run est le travail d'un agent sur un ticket. » ; cartes « 2 places sur 3 », « 3 en file », « 1 attend une réponse », « 12 400 tokens aujourd'hui » (aide) ; section « Historique » : filtre segmenté « Tous · Terminés · En échec · Annulés · En attente », champ « Clé du ticket », lignes cliquables (survol, focus) ; tiroir ouvert sur « sonnet-review · KIB-11 » avec son journal ; variante « Journal indisponible pour ce run. » ; dialogues « Arrêter le run opus-dev-2 sur KIB-14 ? » (« L'agent est interrompu ; le ticket reste assigné. »), « Retirer KIB-18 de la file ? », « Supprimer le profil opus-dev ? » (« Ses runs passés restent dans l'historique. »).
- **122 · Changements : libellés** (T38) : liste des fichiers avec « Modifié », « Ajouté », « Supprimé » en toutes lettres ; sections « Dans le prochain commit (2) » et « Modifications (3) » ; actions « Ajouter au commit », « Retirer du commit », « Tout ajouter », « Tout retirer » ; bouton de commit « Valider · ⌘↵ » (`Ctrl+↵` ailleurs) ; en cours de push : « Publication de la branche kib-12 sur origin… » avec « Détails » (commande).
- **123 · Chargement et Kibo ne répond pas** (T39) : écran « Chargement de Kibo… » (logo, texte, apparaît après 300 ms) ; écran « Kibo ne répond pas » : logo, titre, « Kibo n'est pas lancé, ou il ne répond pas à cette adresse. », conseils (application : « Relance Kibo. » ; navigateur : « Vérifie que Kibo tourne sur l'ordinateur, puis réessaie. »), bouton « Réessayer », ligne « Nouvelle tentative dans 3 s… » ; barre des agents : « Kibo · connecté » / « Kibo · hors ligne ».
- **124 · Aperçu de fichier** (T40) : en-tête avec « Copier le chemin », bascule « Retour à la ligne » (interrupteur), recherche (champ « Rechercher ou :ligne », compteur « 3 / 12 », boutons ↑ ↓, Esc ferme) ; occurrences surlignées ; pied « Ligne 42 · Col 1 » qui suit la ligne visée ; même en-tête dans l'onglet fichier et la vue Changements (bascule seule).
- **125 · Arbre Tickets** (T42) : barre « Rechercher (clé ou titre) », filtres « Statut » (multi), « Assigné » (Tous / Moi / Agents / Personne) ; état vide : « Aucun ticket pour l'instant. », « Les tickets s'organisent en arbre : un ticket, ses sous-tickets, leurs dépendances. », bouton « Nouveau ticket » ; squelette de 5 lignes au chargement ; variante filtrée vide : « Aucun ticket ne correspond. » avec « Effacer ».
- **126 · Kanban** (T43) : carte entière saisissable (curseur `grab`), carte en cours de déplacement surélevée, indicateur d'insertion entre deux cartes ; colonne « Bloqué » avec « + » ; en-tête : « 13 / 24 · Moi + agents » et « 11 masqués · Tout afficher » ; pastille CI neutre lisible en clair et en sombre.
- **1 et 108 amendés** (T29) : un chemin de dossier de 120 caractères se coupe (`break-all`) dans la carte projet de la vue d'ensemble et dans le dialogue « Supprimer le projet », le champ et les boutons gardant leur marge.
- **112 amendé** (T41) : le sous-menu « Thème » marque le choix par une coche ✓ ; sans compte de sync, l'en-tête du menu n'affiche que le nom système, sans sous-ligne (constaté en T28, accepté).

## File Structure

```
packages/sdk/src/lazy.tsx  lazy.test.tsx                                     fallback "children" (T29)
packages/sdk/src/ui/dropdown-menu.tsx                                         coche ✓ des DropdownMenuRadioItem (T41)
packages/ui/src/shell/ProjectHeaderMenu.tsx  project-header-menu.test.tsx    NOUVEAU (T29, chunk share-entry) ; ShareControls.tsx perd ProjectMenu
packages/ui/src/shell/ProjectEntry.tsx                                        NOUVEAU (T29, sorti de AppSidebar.tsx)
packages/ui/src/shell/share-entry.ts  lazy-screens.ts  AppSidebar.tsx         ProjectHeaderMenu (T29) ; entrée Boîte de réception (T32)
packages/ui/src/tabs/TabMenuContent.tsx  TabBar.tsx  tab-bar.test.tsx         contenu du menu à la demande (T29)
packages/ui/src/shell/shared-modules.ts  trusted-loader.ts  trusted-loader.test.ts  main.tsx   exposition à la demande (T29)
packages/ui/src/shell/project-menu.ts                                         déplacé dans le chunk share-entry (T29) ; fr.nav.shareProject retirée
packages/ui/src/dialogs/DeleteProjectDialog.tsx  delete-project-dialog.test.tsx  shell/Overview.tsx  overview.test.tsx   chemin long coupé (T29)
packages/ui/scripts/bundle-report.ts                                          FORBIDDEN_IN_ENTRY (T29, T32, T33, T34, T36, T39, T40)
packages/daemon/src/projects/admin.ts  admin.test.ts  daemon.ts               isLocked, detail (T30)
packages/daemon/src/collab/project-hosts.ts  collab/types.ts                  isLocked (T30)
packages/schema/src/call.ts  packages/sdk/src/types.ts  sdk.ts  mock.ts  mock-notes.ts   notes.create (T30)
packages/daemon/src/notes/notes-fs.ts  notes-fs.test.ts  service.ts  gate-handlers.ts   notes.create (T30)
packages/devkit/src/analyze-permissions.ts (ou équivalent : grep "notes.write")      notes.create sous writes: note (T30)
components/notes/src/NotesView.tsx  notes.test.tsx                            create (T30)
packages/schema/src/market-rpc.ts  packages/daemon/src/market/rpc.ts  market-rpc.test.ts   refreshMarketSource (T30)
packages/schema/src/inbox.ts  inbox.test.ts  index.ts                        NOUVEAU (T31) : INBOX_ID, INBOX_KEY, isInbox, inboxAllows
packages/schema/src/command.ts  rpc.ts                                        createTicket.blockedReason, fileTicket (T31)
packages/core/src/tickets.ts  tickets.test.ts                                 NewTicket.blockedReason (T31)
packages/core/src/transfer.ts  transfer.test.ts  index.ts                     NOUVEAU (T31) : transferTicket
packages/daemon/src/inbox/inbox-doc.ts  inbox-rules.ts  file-ticket.ts  *.test.ts   NOUVEAU (T31)
packages/daemon/src/projects/project-rpc.ts  project-rpc.test.ts             NOUVEAU (T31) : handleProjectRequest sorti de service.ts
packages/daemon/src/service.ts  service.test.ts  agents-rpc.ts  agents-rpc.test.ts  collab/share.ts  projects/admin.ts  notes/service.ts   boîte refusée (T31)
packages/ui/src/lib/inbox.ts  inbox.test.ts                                   NOUVEAU (T32) : inboxMeta, displayName, withInbox
packages/ui/src/i18n/fr-inbox.ts                                              NOUVEAU (T32 ; complété T33)
packages/ui/src/dialogs/NewTicketDialog.tsx  dialogs.test.tsx                 projet, assigné, motif (T32)
packages/ui/src/shell/ShellDialogs.tsx  ShellHeader.tsx  Shell.tsx  AppSidebar.tsx  Overview.tsx  ScreenView.tsx  lazy-screens.ts   (T32)
packages/schema/src/tabs.ts  packages/ui/src/tabs/target-hash.ts  screens.ts  tabs.test.ts  palette/CommandPalette.tsx   écran inbox (T32)
packages/ui/src/mine/my-tickets.ts  MyTicketsPage.tsx  MyTicketRow.tsx  my-tickets-page.test.tsx   boîte dans Mes tickets (T32)
packages/ui/src/tabs/tab-title.ts  tab-title.test.ts  shell/Breadcrumb.tsx    displayName (T32)
packages/ui/src/inbox/InboxPage.tsx  InboxRow.tsx  inbox-menu.ts  inbox-menu.test.ts  inbox-page.test.tsx   NOUVEAU (T33)
packages/ui/src/dialogs/FileTicketDialog.tsx  file-ticket-dialog.test.tsx    NOUVEAU (T33)
packages/ui/src/shell/TicketSheet.tsx  ticket/TicketActionsMenu.tsx  agents/AssignDialog.tsx  palette/palette-items.ts  palette-items.test.ts   (T33)
packages/ui/src/components-page/filter-components.ts  filter-components.test.ts  ComponentsFilters.tsx  UsagesSheet.tsx  ComponentsPage.tsx  ComponentsTable.tsx  components-page.test.tsx   (T34)
packages/ui/src/i18n/fr-components-list.ts                                    NOUVEAU (T34)
packages/ui/src/components-page/ComponentRowMenu.tsx  MarketCard.tsx  MarketplaceTab.tsx  PublishSections.tsx  marketplace.test.tsx   (T35)
packages/ui/src/settings/ComponentSourcesPage.tsx  SourceRow.tsx  sources.test.tsx  SettingsNav.tsx  i18n/fr-market.ts  fr-components.ts   (T35)
packages/ui/src/settings/SyncSettingsPage.tsx  SyncEmptyState.tsx  SyncServerCards.tsx  SyncDevicesCard.tsx  SyncProjectsCard.tsx  sync-settings.test.tsx   (T36)
packages/ui/src/dialogs/ConnectServerDialog.tsx  AddDeviceDialog.tsx  i18n/fr-collab.ts  i18n/fr-sync-page.ts   (T36)
packages/ui/src/agents/AgentsPage.tsx  RunHistory.tsx  run-filter.ts  run-filter.test.ts  AgentDrawer.tsx  RunJournal.tsx  QueuePage.tsx  ProfileSheet.tsx  permission-mode.ts  state/use-agents.ts  agents-page.test.tsx  agent-panel.test.tsx  queue-page.test.tsx   (T37)
packages/ui/src/i18n/fr.ts (agents, queue, agentsPage, profile)              (T37)
packages/ui/src/i18n/fr-code.ts  code/FileList.tsx  file-menu.ts  PushActions.tsx  CommitPanel.tsx  palette/CommandPalette.tsx  files/FilePreviewSheet.tsx  e2e/*.spec.ts (libellés)   (T38)
packages/ui/src/App.tsx  app.test.tsx  shell/Startup.tsx  DaemonUnreachable.tsx  RootBoundary.tsx  startup.test.tsx  i18n/fr-startup.ts   (T39)
packages/ui/src/shell/Shell.tsx  use-shell-dialogs.ts  shell-actions.ts  state/use-projects.ts  agents/AgentBar.tsx   (T39)
apps/desktop/src-tauri/src/main.rs                                            message et exit(1) (T39)
packages/ui/src/lib/local-pref.ts  local-pref.test.ts  theme.ts  shell/run-history.ts   NOUVEAU (T40) : helper localStorage partagé
packages/ui/src/files/wrap-pref.ts  find-in-file.ts  find-in-file.test.ts  FileToolbar.tsx  CodeLines.tsx  CodeEditor.tsx  FilePreviewSheet.tsx  FileTabView.tsx  files.test.tsx  code/DiffView.tsx  ChangesBody.tsx   (T40)
packages/ui/src/i18n/fr-file-tools.ts                                         NOUVEAU (T40)
packages/ui/src/settings/SettingsLayout.tsx  (9 pages)  shell/TicketSheet.tsx  shell/sheet/CiLogSheet.tsx  code/ChangesLayout.tsx  changes-layout.test.tsx  ChangesBody.tsx   (T41)
packages/ui/src/shell/Breadcrumb.tsx  breadcrumb.test.tsx  ShellHeader.tsx    fil d'Ariane cliquable (T41)
packages/ui/src/dialogs/IconField.tsx  FolderField.tsx  EditProjectDialog.tsx  settings/workspace-page.test.tsx  shell/UserMenuContent.tsx   mineures (T41)
components/tickets/src/filter-tickets.ts  filter-tickets.test.ts  TicketsToolbar.tsx  TicketsTree.tsx  TicketsEmpty.tsx  fr.ts  tickets.test.tsx   (T42)
components/notes/src/note-sort.ts  note-sort.test.ts  NoteList.tsx  fr.ts  notes.test.tsx   (T42)
components/kanban/kibo.component.json  src/column-order.ts  column-order.test.ts  Kanban.tsx  KanbanCard.tsx  KanbanToolbar.tsx  fr.ts  kanban.test.tsx   (T43)
e2e/inbox.spec.ts  e2e/confort.spec.ts  e2e/playwright.config.ts              (T44)
docs/superpowers/specs/*.md (§15, composants §16, marketplace D47, agents §11, code §12.8)   écrits avec ce plan
```

## Contrats partagés

Chaque tâche ne voit que sa propre section : ces signatures font foi entre tâches. Une tâche qui doit en changer une le signale au chef d'équipe, qui corrige ici avant d'intégrer.

### Schéma (T30, T31)

```ts
// packages/schema/src/inbox.ts (T31)
export const INBOX_ID = "inbox";
export const INBOX_KEY = "INB";
export const isInbox = (projectId: string): boolean => projectId === INBOX_ID;
export const INBOX_ENTITIES: ReadonlySet<EntityType> = new Set(["ticket", "link"]);
export const inboxAllows = (method: ProjectCommand["method"]): boolean => { const w = COMMAND_WRITES[method]; return w !== null && INBOX_ENTITIES.has(w); };
export const RESERVED_PROJECT_KEYS: readonly string[] = [INBOX_KEY];

// packages/schema/src/command.ts (T31) : createTicket gagne  blockedReason: z.string().optional()
// packages/schema/src/rpc.ts (T31)
z.object({ method: z.literal("fileTicket"), ticketId: NodeId, projectId: z.string().min(1), parentId: NodeId.nullable().optional() }),
// RpcResult gagne  fileTicket: { ticketId: string; key: string | null };

// packages/schema/src/call.ts (T30) : ComponentCall gagne
z.object({ kind: z.literal("notes.create"), path: NotePath, markdown: z.string().max(1_048_576) }),
// packages/schema/src/market-rpc.ts (T30) : MARKET_RPC_REQUESTS gagne
z.object({ method: z.literal("refreshMarketSource"), id: z.string().min(1) }),   // résultat : MarketSourceInfo
```

### Core (T31)

```ts
// packages/core/src/tickets.ts : NewTicket gagne blockedReason?: string | null ; createTicket l'écrit (statusId "blocked" sans motif ⇒ BLOCKED_REASON_REQUIRED, inchangé)
// packages/core/src/transfer.ts
export type TransferredTicket = { from: string; to: string; key: string | null };
export type TransferResult = { ticketId: string; key: string | null; created: TransferredTicket[]; recreatedLinks: number; droppedLinks: number };
export function transferTicket(from: LoroDoc, to: LoroDoc, ticketId: string, parentId: string | null): TransferResult;
// NOT_FOUND si ticketId absent de `from` ou parentId absent de `to` ; recrée le sous-arbre en profondeur (createTicket de `to`, clé allouée par `to`),
// recrée les liens internes au sous-arbre, supprime le sous-arbre de `from` (deleteTicket) ; commit des deux docs ; pur, sans I/O.
```

### Démon (T30, T31)

```ts
// packages/daemon/src/collab/types.ts (T30) : ProjectHostRegistry gagne isLocked(projectId: string): boolean
// packages/daemon/src/projects/admin.ts (T30) : ProjectAdminDeps gagne isLocked(projectId: string): boolean ;
//   deleteProject ⇒ CONFLICT `project ${id} is being shared` (après activeRuns, avant ownsActiveShare) ; details stables :
//   `project ${id} has active runs` | `project ${id} is shared: stop sharing first` | `project ${id} is being shared`
// packages/daemon/src/notes/notes-fs.ts (T30)
export async function createNoteFile(dir: string, rel: string, markdown: string): Promise<NoteFile>;   // flag "wx" ; CONFLICT `${rel} already exists`
// packages/daemon/src/market/rpc.ts (T30) : case "refreshMarketSource" ⇒ await market.refresh(req.id) puis la source relue (NOT_FOUND si inconnue, avant tout réseau)
// packages/daemon/src/inbox/inbox-doc.ts (T31)
export const INBOX_META: ProjectMeta = { id: INBOX_ID, key: INBOX_KEY, name: "Inbox", folder: null, color: "#64748B" };
export function loadInbox(store: Store): LoroDoc;        // loadDoc(store, projectDocId(INBOX_ID)) ?? createProjectDoc(INBOX_META) (sauvé au premier save)
// packages/daemon/src/inbox/inbox-rules.ts (T31)
export function assertInboxCommand(command: ProjectCommand): void;       // INVALID_INPUT "the inbox only holds tickets" si !inboxAllows
export function assertNotInbox(projectId: string, operation: string): void;   // INVALID_INPUT `${operation} is not available for the inbox`
export function assertProjectKeyAllowed(key: string): void;              // INVALID_INPUT `project key ${key} is reserved`
// packages/daemon/src/inbox/file-ticket.ts (T31)
export type FileTicketDeps = { docs: Pick<Docs, "project" | "assertWritable" | "save" | "emit">; store: Pick<Store, "transaction">; restore(projectId: string): void };
export function createFileTicket(deps: FileTicketDeps): (req: Extract<RpcRequest, { method: "fileTicket" }>) => { ticketId: string; key: string | null };
// packages/daemon/src/projects/project-rpc.ts (T31)
export type ProjectRpcDeps = { workspace: LoroDoc; docs: Docs; icons: Pick<IconStore, "version">; collab(): CollabPort | null; adopt(id: string, doc: LoroDoc): void; fileTicket: ReturnType<typeof createFileTicket> };
export function handleProjectRequest(deps: ProjectRpcDeps, req: RpcRequest): unknown | typeof NOT_HANDLED;   // listProjects, createProject, getProject, command, fileTicket
// Docs.project("inbox") renvoie le doc de la boîte ; Docs.save("inbox") l'écrit sous project:inbox ; projectIds() ne la liste jamais.
// agents-rpc.ts (T31) : previewAssign / assignAgent ⇒ assertNotInbox(req.projectId, "assigning an agent") avant port.*
// collab/share.ts (T31) : shareProject / createProjectInvite ⇒ assertNotInbox ; projects/admin.ts : updateProject / deleteProject / setIcon(project:inbox) ⇒ assertNotInbox ; notes/service.ts : getNotesDir / setNotesDir ⇒ assertNotInbox
```

### SDK (T29, T30)

```ts
// packages/sdk/src/lazy.tsx (T29) : LazyOptions = { fallback?: "visible" | "sr-only" | "children" }   // "children" : Suspense fallback = (props as { children?: ReactNode }).children ?? null
// packages/sdk/src/types.ts (T30) : NotesApi gagne create(path: string, markdown: string): Promise<NoteMeta>   // writes: note
```

### UI (`packages/ui`)

```ts
// shell/ProjectHeaderMenu.tsx (T29, chunk share-entry)
export type ProjectHeaderMenuProps = { project: ProjectMeta; current: boolean; shifted: boolean; editable: boolean; actions: ProjectMenuActions; children: ReactNode };
export function ProjectHeaderMenu(p: ProjectHeaderMenuProps): JSX.Element;   // ContextMenu(trigger = children) + SidebarMenuAction « ⋯ » (DropdownMenu) ; entrées = projectMenuEntries({ editable, texts: { newPage: fr.nav.newPage, share: frShare.action, edit: fr.nav.editProject, remove: fr.nav.deleteProject }, actions })
// shell/lazy-screens.ts (T29) : export const ProjectHeaderMenu = lazyPanel(() => shareEntry().then((m) => m.ProjectHeaderMenu), fr.lazy, { fallback: "children" });   (ProjectMenu retiré)
// shell/ProjectEntry.tsx (T29) : export function ProjectEntry(p: ProjectEntryProps)   (mêmes props qu'aujourd'hui, `menuEditable` conservé)
// tabs/TabMenuContent.tsx (T29) : props { tab: Tab; dispatch(action: TabsAction): void; onOpenWindow: ((target: TabTarget) => void) | null } ; TabBar : <ContextMenuContent className="w-72"><TabMenuContent …/></ContextMenuContent>
// shell/trusted-loader.ts (T29) : loadTrusted(id, version, hash, importer = defaultImporter, expose: () => Promise<void> = defaultExpose)   // defaultExpose = import("./shared-modules").then((m) => m.exposeSharedModules())

// lib/inbox.ts (T32)
export function inboxMeta(): ProjectMeta;                                       // { ...INBOX_META-like, name: frInbox.title }
export const displayName = (meta: Pick<ProjectMeta, "id" | "name">): string;   // isInbox ? frInbox.title : meta.name
export function withInbox<T extends ProjectMeta>(projects: readonly T[], snapshots: ReadonlyMap<string, ProjectSnapshot>): (T | ProjectSummary)[];   // ajoute inboxSummary(snapshot) en tête si snapshots.has(INBOX_ID)
export function inboxSummary(snapshot: ProjectSnapshot): ProjectSummary;        // counts par countByStatus(snapshot.tickets)
export const openInboxCount = (snapshot: ProjectSnapshot | undefined): number; // tickets dont statusId !== "done"
// i18n/fr-inbox.ts (T32, T33) : frInbox = { title: "Boîte de réception", subtitle, empty, emptyHelp, newTicket, file: "Rattacher…", fileTo: "Rattacher à un projet…", open: "Ouvrir", remove: "Supprimer…", dialog: { title: (key) => `Rattacher ${key} à un projet`, project: "Projet", nextKey: (key) => `Le ticket reçoit une nouvelle clé dans ce projet (la prochaine est ${key}).`, serverKey: "Sa clé sera attribuée par le serveur de sync.", children: "Ses sous-tickets suivent.", links: "Ses liens vers d'autres tickets de la boîte sont perdus.", confirm: "Rattacher", cancel: "Annuler", noProject: "Aucun projet modifiable : crée un projet d'abord." }, noAgent: "Rattache d'abord ce ticket à un projet : un agent travaille dans le dossier d'un projet." }
// fr.ts (T32) : nav.inbox: "Boîte de réception" ; newTicket gagne project: "Projet", projectLocked: "Un sous-ticket reste dans le projet de son parent.", assignee: "Assigné", nobody: "Personne", me: (viewer) => `Moi (${viewer})`, reason: "Motif", reasonHelp: "Pourquoi ce ticket ne peut pas démarrer." ; newTicket.subtitle(name, key) et keyPending conservés
// dialogs/NewTicketDialog.tsx (T32) : props { projects: readonly ProjectMeta[]; initialProjectId: string; lockProject: boolean; viewer: string; defaults: NewTicketDefaults; onClose(): void }   (charge useProject(projectId) ; projets proposés = withInbox filtré canEdit ; assigné : Personne / Moi / membres)
// shell/ShellDialogs.tsx (T32) : newTicket rendu dès que state.newTicket ≠ null ; initialProjectId = ticketProject?.meta.id ?? INBOX_ID ; lockProject = defaults.parentId != null || defaults.instanceId != null
// shell/ShellHeader.tsx (T32) : bouton « Nouveau ticket » toujours rendu ; title = fr.header.newTicketIn(displayName(ticketProject?.meta ?? inboxMeta()))
// shell/AppSidebar.tsx (T32) : Props gagne inboxCount: number | null ; entrée après « Mes tickets », target { kind: "screen", screen: "inbox" }
// shell/Overview.tsx (T32) : Props gagne inboxCount: number ; onOpenInbox(): void ; carte « Boîte de réception · n tickets sans projet »
// Screen gagne "inbox" (T32) : hash "#/inbox", SCREENS.inbox = { title: fr.nav.inbox, icon: Inbox, crumbs: [fr.nav.inbox] }, HEADING_SCREENS gagne "inbox"

// inbox/InboxPage.tsx (T33) : props { snapshot: ProjectSnapshot | null; projects: ProjectSummary[]; viewer: string; onOpenTicket(ticketId: string): void; onNewTicket(): void }
// inbox/inbox-menu.ts (T33) : export function inboxMenuEntries(input: { texts: typeof frInbox; actions: { open(): void; file(): void; remove(): void } }): MenuEntry[]
// dialogs/FileTicketDialog.tsx (T33) : props { ticket: TicketView; hasChildren: boolean; hasLinks: boolean; projects: ProjectSummary[]; snapshots: ReadonlyMap<string, ProjectSnapshot>; onClose(): void; onFiled(projectId: string, ticketId: string): void }   // rpc fileTicket ; projets proposés = canEdit && !isInbox
// shell/ShellDialogs.tsx (T33) : DialogsState gagne fileTicket: { ticketId: string } | null
// ticket/TicketActionsMenu.tsx (T33) : props gagne onFile?: () => void (entrée « Rattacher à un projet… » quand isInbox(projectId)) ; TicketSheet masque « Assigner » et passe onFile pour la boîte

// components-page/filter-components.ts (T34)
export type TrustFilter = "all" | "trusted" | "sandboxed" | "pending";
export type OriginFilter = "all" | ComponentOrigin;
export type SortKey = "title" | "version" | "trust" | "origin" | "usage";
export type ComponentsQuery = { text: string; trust: TrustFilter; origin: OriginFilter; sort: SortKey; descending: boolean };
export const DEFAULT_QUERY: ComponentsQuery;
export function filterComponents(rows: readonly ComponentRow[], query: ComponentsQuery): ComponentRow[];   // normalise accents et casse, trie (localeCompare "fr" ; semver pour version ; usages = pages)
export const toggleSort = (q: ComponentsQuery, key: SortKey): ComponentsQuery;
// components-page/UsagesSheet.tsx (T34, à la demande) : props { row: UsagesTarget | null; onClose(): void; onOpenPage(projectId: string, pageId: string): void } ; UsagesTarget = { title; version; usages } (une ComponentRow convient ; ComponentRow.usages ajouté dans rows.ts)
// components-page/ComponentsPage.tsx (T34, livré) : props { onOpen(target: TabTarget): void } ; la page monte elle-même CreateComponentDialog (target null) ; ScreenView passe onOpen = go

// settings/SyncEmptyState.tsx (T36, à la demande) : props { onConnect(): void; onJoinDevice(): void; remote: boolean }
// dialogs/ConnectServerDialog.tsx (T36) : props gagne mode: "server" | "device" (texte d'aide), le reste inchangé
// settings/SyncProjectsCard.tsx (T36) : props { status: SyncStatus; projects: ProjectSummary[]; onOpen(projectId: string): void; onManage(projectId: string): void; onDelete(projectId: string): void }

// agents/run-filter.ts (T37)
export type RunFilter = "all" | "done" | "failed" | "cancelled" | "waiting";
export function filterRuns(runs: readonly RunView[], filter: RunFilter, query: string): RunView[];   // tri seq décroissant, query sur ticketKey (insensible à la casse)
// agents/AgentsPage.tsx (T37) : props gagne onOpenRun(runId: string): void ; ScreenView passe onOpenRun = onAnswer
// state/use-agents.ts (T37) : useRunLog(runId): { log: RunLogEntry[] | null; missing: boolean }
// agents/RunJournal.tsx (T37) : props gagne missing?: boolean ; AgentDrawer : props log: { log, missing }
// agents/permission-mode.ts (T37) : export const permissionModeLabel = (mode: PermissionMode): string

// i18n/fr-code.ts (T38) : changes.kind devient des mots ; staged: "Dans le prochain commit", unstaged: "Modifications" ; stage/unstage/stageAll/unstageAll renommés ; commit.pushing: (branch, remote) => `Publication de la branche ${branch} sur ${remote}…` ; pushCommand conservé pour Détails ; file.hints: (mac: boolean) => string

// App.tsx (T39) : export function App({ now = Date.now, retryMs = 3000 }: { now?: () => number; retryMs?: number })  — états : "loading" | "unreachable" | "pairing" | "ready"
// shell/Startup.tsx (T39, dans l'entrée, < 40 lignes) : LoadingScreen({ delayMs = 300 }) ; shell/DaemonUnreachable.tsx (à la demande) : props { error: unknown; inApp: boolean; nextRetryInMs: number; onRetry(): void }
// shell/RootBoundary.tsx (T39) : ErrorBoundary racine (« Quelque chose s'est mal passé », bouton Recharger)
// state/use-projects.ts (T39) : useProjects(): { projects: ProjectSummary[] | null; error: unknown; retry(): void }
// shell/use-shell-dialogs.ts (T39) : export function useShellDialogs(): { dialogs: DialogsState; set(patch: Partial<DialogsState>): void; focusRun: string | null; setFocusRun(id: string | null): void; clearFocus(): void; palette: PaletteRequest | null; setPalette(r: PaletteRequest | null): void }
// shell/shell-actions.ts (T39) : export function paletteActionHandler(deps): (a: PaletteAction) => void ; export function fileTabOpener(deps): (ref: FileRef, edit: boolean) => void

// lib/local-pref.ts (T40)
export function readPref(key: string, fallback: string): string;    // try/catch, journalise une fois
export function writePref(key: string, value: string | null): void;
export function usePref(key: string, fallback: string): [string, (v: string) => void];   // useSyncExternalStore + événement storage
// files/wrap-pref.ts (T40) : WRAP_KEY = "kibo.wrap" ; useWrap(): [boolean, (on: boolean) => void]
// files/find-in-file.ts (T40)
export type FindState = { query: string; matches: { line: number; col: number }[]; index: number };
export function findMatches(lines: readonly string[], query: string): { line: number; col: number }[];   // insensible à la casse, vide si query === ""
export const parseGoTo = (query: string): number | null;   // ":42" ⇒ 42
export const stepMatch = (state: FindState, delta: 1 | -1): FindState;
// files/FileToolbar.tsx (T40, à la demande avec FilePreviewSheet / FileTabView) : props { path: string; wrap: boolean; onWrap(on: boolean): void; find: FindState | null; onFind(query: string): void; onStep(delta: 1 | -1): void; onCloseFind(): void }
// files/CodeLines.tsx (T40) : props gagne wrap: boolean ; highlight: { line: number; col: number } | null (occurrence courante) ; matches: readonly { line: number; col: number }[]
// files/CodeEditor.tsx (T40) : props gagne wrap: boolean (compartiment EditorView.lineWrapping)
// code/DiffView.tsx (T40) : props gagne wrap: boolean

// settings/SettingsLayout.tsx (T41) : props { active: SettingsScreen; children: ReactNode }   // grid md:grid-cols-[14rem_1fr], nav au-dessus sous md
// code/ChangesLayout.tsx (T41) : props { files: ReactNode; diff: ReactNode; commit: ReactNode; filesTitle: string }   // lg: trois colonnes ; sinon Collapsible + pile
// shell/Breadcrumb.tsx (T41) : Breadcrumb({ crumbs: Crumb[]; heading?: boolean }) avec Crumb = { label: string; target: TabTarget | null } ; crumbsFor renvoie Crumb[]
```

### Composants intégrés (T42, T43)

```ts
// components/tickets/src/filter-tickets.ts (T42)
export type AssigneeFilter = "all" | "me" | "agents" | "nobody";
export type TicketsQuery = { text: string; statuses: ReadonlySet<StatusId>; assignee: AssigneeFilter };
export const EMPTY_QUERY: TicketsQuery;
export const isActive = (q: TicketsQuery): boolean;
export function filterTickets(tickets: readonly Ticket[], q: TicketsQuery, viewer: string): Set<string>;   // ids visibles : ceux qui correspondent + leurs ancêtres
// components/notes/src/note-sort.ts (T42)
export type NoteSort = "recent" | "title";
export const NOTE_SORT_KEY = "kibo.notes.sort";
export function groupNotes(notes: readonly NoteMeta[], sort: NoteSort): { dir: string; notes: NoteMeta[] }[];   // "" (racine) en premier, puis dossiers par nom
// components/kanban/src/column-order.ts (T43)
export type ColumnOrder = Record<string, string[]>;
export function orderColumn<T extends { id: string }>(tickets: readonly T[], order: readonly string[] | undefined): T[];
export function placeInColumn(order: readonly string[], columnIds: readonly string[], movedId: string, overId: string | null, place: "before" | "after"): string[];   // liste complète de la colonne après dépôt, movedId inclus
export const ORDER_KEY = "order";
```

## Vagues d'exécution

Une vague démarre quand toutes les tâches dont elle dépend sont intégrées dans `phase/9`. Dans une vague, chaque tâche a son worktree `.claude/worktrees/p9-t<n>` et sa branche `feat/p9-t<n>` ; le chef d'équipe lance les `kibo-dev` de la vague en parallèle et intègre ensuite **dans l'ordre du tableau**, en rebasant chaque branche sur la précédente (les conflits listés sont des ajouts de quelques lignes : `bundle-report.ts`, `lazy-screens.ts`, `fr.ts`, `ScreenView.tsx`, `Shell.tsx`). Après chaque intégration d'une tâche UI : `bun run budget`.

| Vague | Tâches en parallèle | Dépendances (tâche ← tâches) | Fichiers partagés dans la vague | Écrans |
|---|---|---|---|---|
| 0 | T29, T30, T31 | aucune (spec écrite). **T29 est intégrée la première** et conditionne toute tâche UI | T29 = UI seule (`shell/`, `tabs/`, `sdk/lazy.tsx`, `bundle-report.ts`, `DeleteProjectDialog`, `Overview`) ; T30 = démon, schéma `call.ts` et `market-rpc.ts`, SDK notes, `components/notes` ; T31 = schéma (`inbox.ts`, `command.ts`, `rpc.ts`), core, démon (`inbox/`, `projects/project-rpc.ts`, `service.ts`, `agents-rpc.ts`, `collab/share.ts`, `projects/admin.ts`, `notes/service.ts`). T30 et T31 touchent tous deux `projects/admin.ts` et `notes/service.ts` (quelques lignes : **T30 avant T31**) | T29 : 1 et 108 amendés |
| 1 | T34, T36, T38, T39, T40, T42, T43 | toutes ← T29 (budget). T43 ← T31 (`blockedReason` dans `createTicket` pour le « + » de Bloqué : si T31 n'est pas intégrée, T43 livre le « + » en dernier Step après rebase) ; T42 ← T30 (`notes.create` déjà dans `NotesView`) | T39 touche `Shell.tsx`, `App.tsx`, `state/use-projects.ts`, `AgentBar.tsx`, `fr.ts › agents` ; T38 touche `fr-code.ts`, `code/*`, `CommandPalette.tsx`, `FilePreviewSheet.tsx` (`hints`) ; T40 touche `files/*`, `code/DiffView.tsx`, `ChangesBody.tsx` (prop `wrap`), `FilePreviewSheet.tsx` : **T38 avant T40** (`FilePreviewSheet.tsx`, `fr-code.ts`) ; T34 = `components-page/*` (Installés) ; T36 = `settings/Sync*`, `dialogs/ConnectServerDialog`, `AddDeviceDialog`, `fr-collab.ts` ; T42 = `components/tickets`, `components/notes` ; T43 = `components/kanban` ; chacune ajoute une ligne à `bundle-report.ts` | T34 : 116 · T36 : 119, 120 · T38 : 122 · T39 : 123 · T40 : 124 · T42 : 125 · T43 : 126 |
| 2 | T32, T35, T37, T41 | T32 ← T31, T29, T39 (`Shell.tsx` allégé, `use-shell-dialogs`) ; T35 ← T30 (`refreshMarketSource`), T34 (`ComponentsPage` remaniée) ; T37 ← T39 (`ScreenView` inchangé mais `Shell.tsx` allégé) ; T41 ← T32 (`ShellHeader.tsx`), T40 (`ChangesBody.tsx` prop `wrap`), T38 | T32 touche `Shell.tsx`, `ShellHeader.tsx`, `ShellDialogs.tsx`, `AppSidebar.tsx`, `Overview.tsx`, `ScreenView.tsx`, tables des écrans, `mine/*`, `tab-title.ts`, `Breadcrumb.tsx` (displayName) ; T41 touche `Breadcrumb.tsx`, `ShellHeader.tsx` : **T32 avant T41** ; T37 touche `ScreenView.tsx` (prop) et `fr.ts` : **T32, puis T37, puis T41** ; T35 = `components-page/*` (menus, marketplace), `settings/ComponentSources*`, `SettingsNav.tsx`, `fr-market.ts`, `fr-components.ts` | T32 : 114 · T35 : 117, 118 · T37 : 121 · T41 : 112 amendé |
| 3 | T33 | T33 ← T32 (tables, `fr-inbox.ts`, `withInbox`), T41 (`Breadcrumb` cliquable : les crumbs de l'écran inbox) | `inbox/*`, `dialogs/FileTicketDialog.tsx`, `ShellDialogs.tsx`, `TicketSheet.tsx`, `TicketActionsMenu.tsx`, `AssignDialog.tsx`, `palette-items.ts` | 113, 115 |
| 4 | T44 | T44 ← tout | `e2e/playwright.config.ts`, `e2e/inbox.spec.ts`, `e2e/confort.spec.ts` | — |
| Jalon | `bun run budget`, contrôle visuel 113–126 (et 1, 108, 112) sombre et clair, rapport de vague au chef d'équipe | tout | — | toutes |

Ordre d'intégration : vague 0 : **T29**, T30, T31 ; vague 1 : T39, T38, T40, T34, T36, T42, T43 ; vague 2 : T32, T37, T35, T41 ; vague 3 : T33 ; vague 4 : T44. Tâches à risque relues aussi par `kibo-lead` : **T29** (exposition des modules partagés à la demande), **T31** (boîte de réception, transfert transactionnel, refus), **T39** (démarrage), **T43** (ordre du Kanban dans les données d'instance).

Chemin critique : T31 → T32 → T33 → T44 (4 vagues) ; en parallèle T29 → T39 → T32 et T30 → T34 → T35 → T44.

**Budget attendu** : 229,2 kB au départ ; T29 : −1,0 kB (`ProjectHeaderMenu` et `project-menu.ts` dans `share-entry`), −0,8 kB (`TabMenuContent`), −12 à −18 kB (`shared-modules.ts` à la demande : `react-select` ≈ 13 kB gzip, `react-radio-group` ≈ 3,7 kB, `ui/dialog`, `textarea`, `skeleton`, `label`) ⇒ **≈ 210 à 215 kB après T29**, exigence ≤ 226,0 kB. Entrées ensuite : T32 (+0,6 kB : entrée de barre latérale, sélecteur de projet verrouillé n'entre pas), T39 (+0,8 kB : `Startup.tsx`, `RootBoundary`, états d'`App`), T41 (+0,3 kB : `Breadcrumb` cliquable), le reste à la demande ⇒ **≈ 213 à 218 kB à la fin de la vague**, marge ≥ 8 kB pour le lot 9.

---

### Task 29: Budget : menus à la demande, modules partagés à la demande, chemins longs

Vague 0, **intégrée la première**. Spec §15.3 (chemins longs). Décisions 1 et 2. Mesure de départ **229,2 kB**. Trois gains : `ProjectHeaderMenu` et le contenu du menu des onglets chargés à la demande, puis le repli : `shared-modules.ts` exposé à la demande par `loadTrusted`. Au passage : `ProjectEntry` sort de `AppSidebar.tsx`, `fr.nav.shareProject` disparaît au profit de `frShare.action`, et deux débordements de chemin long (écrans 1 et 108) sont corrigés avec un test.

**Files:**
- Modify: `packages/sdk/src/lazy.tsx`, `packages/sdk/src/lazy.test.tsx`
- Create: `packages/ui/src/shell/ProjectHeaderMenu.tsx`, `project-header-menu.test.tsx`, `packages/ui/src/shell/ProjectEntry.tsx`, `packages/ui/src/tabs/TabMenuContent.tsx`
- Modify: `packages/ui/src/shell/ShareControls.tsx` (retrait de `ProjectMenu`), `share-entry.ts`, `lazy-screens.ts`, `AppSidebar.tsx`, `shell.test.tsx`, `packages/ui/src/tabs/TabBar.tsx`, `TabBar.test.tsx`, `packages/ui/src/i18n/fr.ts` (`nav.shareProject` retirée), `packages/ui/src/shell/project-menu.ts` (inchangé, mais plus importé par l'entrée)
- Modify: `packages/ui/src/shell/trusted-loader.ts`, `trusted-loader.test.ts`, `packages/ui/src/main.tsx`, `packages/ui/scripts/bundle-report.ts`
- Modify: `packages/ui/src/dialogs/DeleteProjectDialog.tsx`, `delete-project-dialog.test.tsx`, `packages/ui/src/shell/Overview.tsx`, `welcome.test.tsx` ou `shell.test.tsx` (là où la vue d'ensemble est testée : `grep -ln "Vue d'ensemble\|Overview" packages/ui/src/shell/*.test.tsx`)

**Interfaces:**
- Consumes: `lazyPanel`, `projectMenuEntries`, `ContextMenuEntries`, `DropdownMenuEntries`, `SidebarMenuAction`, `shortcutLabel`, `exposeSharedModules`.
- Produces: `LazyOptions.fallback: "children"` ; `ProjectHeaderMenu` ; `ProjectEntry` ; `TabMenuContent` ; `loadTrusted(…, importer, expose)`.

- [x] **Step 1: Mesure de départ**

Run: `bun install --frozen-lockfile && bun run budget` — Expected: `gzip : 229.2 kB (budget 230.0 kB)` (noter la valeur exacte dans le rapport).

- [x] **Step 2: `lazyPanel` rend ses enfants pendant le chargement (test rouge puis vert)**

`packages/sdk/src/lazy.test.tsx`, dans `describe("lazyPanel")` :
```tsx
  test("fallback \"children\" keeps the wrapped element visible while loading", async () => {
    let resolve: (c: typeof Wrapper) => void = () => {};
    const Wrapper = ({ children }: { children: ReactNode }) => <div data-wrapped>{children}</div>;
    const Panel = lazyPanel<{ children: ReactNode }>(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      labels,
      { fallback: "children" },
    );
    const { container } = render(
      <Panel>
        <button type="button">Kibo</button>
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "Kibo" })).toBeTruthy();
    expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull();
    await act(async () => resolve(Wrapper));
    expect(container.querySelector("[data-wrapped]")?.textContent).toBe("Kibo");
  });
```
Run: `bun test packages/sdk/src/lazy.test.tsx` — Expected: FAIL (type et `Chargement…` rendu).

`packages/sdk/src/lazy.tsx` : `export type LazyOptions = { fallback?: "visible" | "sr-only" | "children" };` ; dans `LazyPanel`, calculer le repli :
```tsx
    const fallback =
      opts.fallback === "children"
        ? ((props as { children?: ReactNode }).children ?? null)
        : <Loading label={labels.loading} srOnly={opts.fallback === "sr-only"} />;
    return (
      <LoadBoundary key={attempt} labels={labels} onRetry={retry}>
        <Suspense fallback={fallback}>
          <Loaded {...props} />
        </Suspense>
      </LoadBoundary>
    );
```
Run: `bun test packages/sdk/src/lazy.test.tsx` — Expected: PASS.

- [x] **Step 3: `ProjectHeaderMenu` dans le chunk `share-entry` (test rouge puis vert)**

`packages/ui/src/shell/project-header-menu.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { ProjectHeaderMenu } from "./ProjectHeaderMenu";

const project = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };
const actions = () => ({ newPage: () => {}, share: () => {}, edit: () => {}, remove: () => {} });

function mount(editable: boolean, shifted: boolean) {
  return render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectHeaderMenu project={project} current editable={editable} shifted={shifted} actions={actions()}>
            <SidebarMenuButton>Kibo</SidebarMenuButton>
          </ProjectHeaderMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
}

test("the ⋯ action is a sibling of the project button and shifts when a + follows (screen 107)", () => {
  mount(true, true);
  const item = screen.getByRole("button", { name: "Kibo" }).closest('[data-sidebar="menu-item"]');
  const more = within(item as HTMLElement).getByRole("button", { name: "Menu du projet Kibo" });
  expect(more.parentElement).toBe(item);
  expect(more.className).toContain("right-7");
});

test("⋯ and right click render the same entries, share labelled by frShare", () => {
  mount(true, false);
  fireEvent.click(screen.getByRole("button", { name: "Menu du projet Kibo" }));
  const names = () => screen.getAllByRole("menuitem").map((m) => m.textContent);
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Supprimer…"]);
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(names()).toEqual(["Nouvelle page", "Partager", "Modifier…", "Supprimer…"]);
});

test("a non editable project only shares and removes", () => {
  mount(false, false);
  fireEvent.contextMenu(screen.getByRole("button", { name: "Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Partager", "Supprimer…"]);
});
```
(`frShare.menu(name)` donne « Menu du projet Kibo » : vérifier le texte exact dans `fr-share.ts` et l'ajuster dans le test, jamais dans le texte.)
Run: `bun test packages/ui/src/shell/project-header-menu.test.tsx` — Expected: FAIL (module absent).

`packages/ui/src/shell/ProjectHeaderMenu.tsx` :
```tsx
import type { ProjectMeta } from "@kibo/schema";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { SidebarMenuAction } from "@kibo/sdk/ui/sidebar";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { frShare } from "../i18n/fr-share";
import { type ProjectMenuActions, projectMenuEntries } from "./project-menu";

export type ProjectHeaderMenuProps = {
  project: ProjectMeta;
  current: boolean;
  shifted: boolean;
  editable: boolean;
  actions: ProjectMenuActions;
  children: ReactNode;
};

export function ProjectHeaderMenu({ project, current, shifted, editable, actions, children }: ProjectHeaderMenuProps) {
  const entries = projectMenuEntries({
    editable,
    texts: { newPage: fr.nav.newPage, share: frShare.action, edit: fr.nav.editProject, remove: fr.nav.deleteProject },
    actions,
  });
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover={!current} className={shifted ? "right-7" : undefined} aria-label={frShare.menu(project.name)}>
            <Ellipsis />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuEntries entries={entries} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
```
`share-entry.ts` : `export { ProjectHeaderMenu } from "./ProjectHeaderMenu";` et retirer `ProjectMenu` de l'export de `ShareControls` (supprimer la fonction `ProjectMenu` et ses imports devenus inutiles). `lazy-screens.ts` : remplacer `ProjectMenu` par `export const ProjectHeaderMenu = lazyPanel(() => shareEntry().then((m) => m.ProjectHeaderMenu), fr.lazy, { fallback: "children" });`.
Run: `bun test packages/ui/src/shell/project-header-menu.test.tsx` — Expected: PASS.

- [x] **Step 4: `ProjectEntry` extrait, `AppSidebar` sans `ContextMenu` ni `project-menu` (tests existants verts)**

Créer `packages/ui/src/shell/ProjectEntry.tsx` avec le composant `ProjectEntry` et son type `ProjectEntryProps` tels qu'ils sont dans `AppSidebar.tsx:118-186`, en remplaçant le bloc `header` par :
```tsx
  const header = (
    <>
      <ProjectHeaderMenu
        project={project}
        current={current}
        shifted={editable}
        editable={p.menuEditable}
        actions={{ newPage, share: p.onShare, edit: p.onEdit, remove: p.onDelete }}
      >
        <SidebarMenuButton isActive={p.projectActive} {...link({ kind: "project", projectId: project.id })}>
          <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
          <span>{project.name}</span>
        </SidebarMenuButton>
      </ProjectHeaderMenu>
      {editable && (
        <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => p.onNewPage(null)}>
          <Plus />
        </SidebarMenuAction>
      )}
    </>
  );
```
(`ProjectHeaderMenu` importé depuis `./lazy-screens`, `Link` exporté de `AppSidebar.tsx` ou déplacé dans `ProjectEntry.tsx` et importé par `AppSidebar`). `AppSidebar.tsx` perd `ContextMenu*`, `ContextMenuEntries`, `projectMenuEntries`, `ProjectMenu`, et importe `ProjectEntry` ; il passe sous 250 lignes. `fr.ts` : supprimer `nav.shareProject` (`grep -rn "shareProject" packages/ui/src` doit ne rien renvoyer ; `project-menu.test.ts` utilise ses propres textes).
Run: `bun run typecheck && bun test packages/ui/src/shell` — Expected: PASS (`shell.test.tsx` trouve toujours le bouton « Menu du projet … » et les entrées : adapter uniquement les `await import` si le test attendait `ProjectMenu`).

- [x] **Step 5: Contenu du menu des onglets à la demande (test rouge puis vert)**

`packages/ui/src/tabs/TabBar.test.tsx` : repérer le test du menu contextuel (`grep -n "contextMenu" packages/ui/src/tabs/TabBar.test.tsx`) et le rendre asynchrone : après `fireEvent.contextMenu(tab)`, `expect(await screen.findByRole("menuitem", { name: /Épingler/ })).toBeTruthy()` ; ajouter :
```tsx
test("the tab menu content is not part of the TabBar module", async () => {
  const source = await Bun.file(new URL("./TabBar.tsx", import.meta.url)).text();
  expect(source).not.toContain("ContextMenuItem");
  expect(source).toContain("TabMenuContent");
});
```
Run: `bun test packages/ui/src/tabs/TabBar.test.tsx` — Expected: FAIL.

Créer `packages/ui/src/tabs/TabMenuContent.tsx` avec le corps de `TabMenu` (les `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuShortcut`, icônes `Pin`, `PinOff`, `Copy`, `AppWindow`, `X`, `shortcutLabel`, `isMac`) sous la forme `export function TabMenuContent({ tab, dispatch, onOpenWindow }: TabMenuContentProps)` qui rend un fragment d'items (sans `ContextMenuContent`). Dans `TabBar.tsx` :
```tsx
const TabMenuContent = lazyPanel(() => import("./TabMenuContent").then((m) => m.TabMenuContent), fr.lazy);
…
      <ContextMenuContent className="w-72">
        <TabMenuContent tab={tab} dispatch={dispatch} onOpenWindow={onOpenWindow} />
      </ContextMenuContent>
```
(`TabBar.tsx` garde `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent` et l'icône `X` du bouton de fermeture ; `lazyPanel` importé de `@kibo/sdk`.) `bundle-report.ts` : ajouter `/\/packages\/ui\/src\/tabs\/TabMenuContent\.tsx$/,` et `/\/packages\/ui\/src\/shell\/(ProjectHeaderMenu\.tsx|project-menu\.ts)$/,`.
Run: `bun test packages/ui/src/tabs && bun run budget` — Expected: PASS ; budget ≈ 227,4 kB (noter).

- [x] **Step 6: Modules partagés exposés à la demande (test rouge puis vert)**

`packages/ui/src/shell/trusted-loader.test.ts` :
```ts
test("the shared modules are exposed before the trusted module is imported", async () => {
  const order: string[] = [];
  const importer = async (url: string) => {
    order.push(`import ${url}`);
    return { manifest: { ...manifest, id: "order" }, Component: () => null };
  };
  await loadTrusted("order", "1.0.0", H, importer, async () => {
    order.push("expose");
  });
  expect(order).toEqual(["expose", `import /components/order/1.0.0/${H}/ui.trusted.js`]);
});
```
Run: `bun test packages/ui/src/shell/trusted-loader.test.ts` — Expected: FAIL (5e argument inconnu).

`trusted-loader.ts` : `export type Exposer = () => Promise<void>;` ; `const defaultExpose: Exposer = () => import("./shared-modules").then((m) => m.exposeSharedModules());` ; `load(id, version, hash, importer, expose)` fait `await expose();` avant `importer(…)` ; `loadTrusted(id, version, hash, importer = defaultImporter, expose: Exposer = defaultExpose)`. `main.tsx` : retirer l'import et l'appel `exposeSharedModules()`. `bundle-report.ts` : ajouter `/\/packages\/ui\/src\/shell\/shared-modules\.ts$/,` et `/\/node_modules\/@radix-ui\/react-(select|radio-group)\//,`.
Run: `bun test packages/ui/src/shell && bun run build --cwd packages/ui && bun run budget` — Expected: PASS ; **budget ≤ 226,0 kB** (attendu ≈ 210–215 kB : noter). Si `react-select` reste dans l'entrée, `bun packages/ui/scripts/bundle-budget.ts` affiche le module interdit : chercher l'importateur restant (`grep -rln "ui/select\"" packages/ui/src/shell packages/ui/src/pages packages/ui/src/tabs packages/ui/src/agents/AgentBar.tsx`) et le charger à la demande de la même façon.

Vérification manuelle (notée dans le rapport) : `bun run --cwd packages/daemon start` puis l'UI, installer un composant trusted de test ou ouvrir une page qui en contient un (E2E `catalog.spec.ts` le fait : `cd e2e && bunx playwright test --project=catalog-dark`), le composant se rend.

- [x] **Step 7: Chemins longs coupés (tests rouges puis verts, écrans 1 et 108)**

`packages/ui/src/dialogs/delete-project-dialog.test.tsx` :
```tsx
test("a 120-character folder wraps instead of overflowing (screen 108)", async () => {
  const folder = `/Users/adam/${"dossier-tres-long/".repeat(6)}kibo`;
  render(<DeleteProjectDialog project={{ ...project, folder }} snapshot={snapshot} activeRuns={0} onClose={() => {}} onDeleted={() => {}} onOpenAgents={() => {}} onShare={() => {}} />);
  const text = await screen.findByText(new RegExp(folder.slice(0, 30)));
  expect(text.className).toContain("break-all");
  expect(text.closest("[data-slot=dialog-description]")?.className).toContain("min-w-0");
});
```
(`project` et `snapshot` sont les fixtures déjà présentes dans ce fichier ; `data-slot="dialog-description"` est posé par `sdk/ui/dialog.tsx` : vérifier l'attribut exact.) Même test pour la carte de la vue d'ensemble (`Overview`) : le chemin rendu porte `break-all` et plus `truncate`, et son conteneur `min-w-0`.
Run: `bun test packages/ui/src/dialogs/delete-project-dialog.test.tsx packages/ui/src/shell` — Expected: FAIL.

`DeleteProjectDialog.tsx` : `DialogDescription className="grid min-w-0 gap-1"` et `<span className="break-all">{keeps}</span>` ; `Overview.tsx:49-51` : `className="break-all font-mono text-2xs text-muted-foreground"` (le titre garde `truncate`).
Run: `bun test packages/ui/src/dialogs/delete-project-dialog.test.tsx packages/ui/src/shell` — Expected: PASS.

- [x] **Step 8: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/sdk packages/ui && bun run budget` — Expected: PASS, budget ≤ 226,0 kB.

```bash
git add packages/sdk/src/lazy.tsx packages/sdk/src/lazy.test.tsx
git commit -m "feat(sdk): lazyPanel garde ses enfants au chargement"
git add packages/ui/src/shell/ProjectHeaderMenu.tsx packages/ui/src/shell/project-header-menu.test.tsx packages/ui/src/shell/ProjectEntry.tsx packages/ui/src/shell/ShareControls.tsx packages/ui/src/shell/share-entry.ts packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/shell.test.tsx packages/ui/src/i18n/fr.ts packages/ui/src/tabs/TabMenuContent.tsx packages/ui/src/tabs/TabBar.tsx packages/ui/src/tabs/TabBar.test.tsx packages/ui/scripts/bundle-report.ts
git commit -m "refactor(ui): menus du projet et des onglets à la demande"
git add packages/ui/src/shell/trusted-loader.ts packages/ui/src/shell/trusted-loader.test.ts packages/ui/src/main.tsx packages/ui/scripts/bundle-report.ts
git commit -m "perf(ui): modules partagés exposés à la demande"
git add packages/ui/src/dialogs/DeleteProjectDialog.tsx packages/ui/src/dialogs/delete-project-dialog.test.tsx packages/ui/src/shell/Overview.tsx <test de la vue d'ensemble>
git commit -m "fix(ui): chemins longs coupés dans les cartes"
```

---

### Task 30: Démon : verrou de suppression, création exclusive d'une note, rafraîchir une source

Vague 0. Spec §15.4, composants §16.1, marketplace D47. Trois compléments indépendants du démon, chacun avec sa tranche verticale minimale (schéma, SDK, composant notes), **avant T31** (qui touche `projects/admin.ts` et `notes/service.ts` à son tour).

**Files:**
- Modify: `packages/daemon/src/collab/types.ts`, `collab/project-hosts.ts`, `collab/project-hosts.test.ts` (ou le test existant du registre : `grep -ln "createProjectHosts" packages/daemon/src/collab/*.test.ts`), `packages/daemon/src/projects/admin.ts`, `admin.test.ts`, `delete.test.ts`, `packages/daemon/src/daemon.ts`
- Modify: `packages/schema/src/call.ts`, `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/mock.ts`, `packages/sdk/src/mock-notes.ts`, `packages/sdk/src/mock.test.ts` (ou `mock-notes.test.ts`), `packages/daemon/src/notes/notes-fs.ts`, `notes-fs.test.ts`, `notes/service.ts`, `notes/service.test.ts`, `packages/daemon/src/components/gate-handlers.ts` (si le routage énumère les kinds), `packages/devkit/src/infer-permissions.ts`, `infer-permissions.test.ts`, `components/notes/src/NotesView.tsx`, `components/notes/src/notes.test.tsx`
- Modify: `packages/schema/src/market-rpc.ts`, `packages/daemon/src/market/rpc.ts`, `packages/daemon/src/market/market-rpc.test.ts` (ou le test existant : `grep -ln "refreshMarket" packages/daemon/src/market/*.test.ts`)

**Interfaces:**
- Consumes: `locked` de `project-hosts.ts`, `writeNoteFile`, `resolveNotePath`, `MarketService.refresh(sourceId?)`, `listSources()`.
- Produces: `ProjectHostRegistry.isLocked`, `ProjectAdminDeps.isLocked`, `notes.create`, `NotesApi.create`, `createNoteFile`, `refreshMarketSource`.

- [x] **Step 1: `isLocked` et `detail` stables (tests rouges puis verts)**

Test du registre (fichier existant de `createProjectHosts`) :
```ts
test("isLocked follows setLocked and is cleared when the project is removed", () => {
  const hosts = createProjectHosts(docs, "adam");
  expect(hosts.isLocked(p.id)).toBe(false);
  hosts.setLocked(p.id, true);
  expect(hosts.isLocked(p.id)).toBe(true);
  hosts.setLocked(p.id, false);
  expect(hosts.isLocked(p.id)).toBe(false);
});
```
`projects/admin.test.ts` (modèle des deps simulées déjà présent) :
```ts
test("deleteProject is refused while the project is being shared, with a stable detail", () => {
  const admin = createProjectAdmin({ ...deps, isLocked: () => true });
  expect(() => admin.deleteProject({ method: "deleteProject", projectId: p.id }, local)).toThrow(
    new KiboError("CONFLICT", `project ${p.id} is being shared`),
  );
  expect(removed).toEqual([]);
});
test("the three CONFLICT details are distinct", () => { /* runs ⇒ "has active runs" ; owner ⇒ "is shared: stop sharing first" ; locked ⇒ "is being shared" */ });
```
Run: `bun test packages/daemon/src/collab packages/daemon/src/projects` — Expected: FAIL.

`collab/types.ts` : `isLocked(projectId: string): boolean;` ; `project-hosts.ts` : `isLocked: (projectId) => locked.has(projectId),` ; `admin.ts` : `isLocked(projectId: string): boolean` dans `ProjectAdminDeps`, et dans `deleteProject`, après `refuseActiveRuns` : `if (deps.isLocked(projectId)) throw new KiboError("CONFLICT", \`project ${projectId} is being shared\`);` ; `daemon.ts` : `isLocked: (projectId) => collab.hosts.isLocked(projectId)` (lire comment `daemon.ts` accède au registre : `collab.hosts` ou équivalent ; sinon exposer `isLocked` sur l'objet `collab`). Tous les tests existants qui construisent `ProjectAdminDeps` gagnent `isLocked: () => false`.
Run: `bun test packages/daemon/src/collab packages/daemon/src/projects packages/daemon/src/daemon.test.ts` — Expected: PASS.

- [x] **Step 2: `notes.create` exclusif, de la schéma au composant (tests rouges puis verts)**

`packages/daemon/src/notes/notes-fs.test.ts` :
```ts
test("createNoteFile writes a new file and refuses an existing one without touching it", async () => {
  const dir = tmp();
  const created = await createNoteFile(dir, "idees.md", "# Idées\n");
  expect(created.markdown).toBe("# Idées\n");
  await expect(createNoteFile(dir, "idees.md", "# Autre\n")).rejects.toThrow(new KiboError("CONFLICT", "idees.md already exists"));
  expect(await Bun.file(join(dir, "idees.md")).text()).toBe("# Idées\n");
});
```
`notes-fs.ts` :
```ts
export async function createNoteFile(dir: string, rel: string, markdown: string): Promise<NoteFile> {
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.byteLength > MAX_NOTE_BYTES) throw tooLarge(rel);
  const full = await resolveNotePath(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await resolveNotePath(dir, rel);
  try {
    await writeFile(full, bytes, { flag: "wx" });
  } catch (e) {
    if (isExisting(e)) throw new KiboError("CONFLICT", `${rel} already exists`);
    throw e;
  }
  const info = await stat(full);
  return { markdown, mtime: mtimeOf(info.mtimeMs), size: info.size };
}
```
(`isExisting` = `code === "EEXIST"`, à côté d'`isMissing`.) Schéma `call.ts` : `z.object({ kind: z.literal("notes.create"), path: NotePath, markdown: z.string().max(1_048_576) })`. `notes/service.ts` : `case "notes.create"` ⇒ `mkdir` + `createNoteFile` + `metaOf`, même chemin que `notes.write` ; test de service : « create refuses an existing note with CONFLICT ». Permissions : là où `notes.write` exige `writes: note` (`packages/daemon/src/components/gate*.ts`, `packages/schema/src/permissions.ts` : `grep -rn "notes.write"`), ajouter `notes.create` ; `devkit/infer-permissions.ts` : `sdk.notes.create` ⇒ `writes: note` (test à côté). SDK : `types.ts` `create(path, markdown): Promise<NoteMeta>` ; `sdk.ts` `create: (path, markdown) => call<NoteMeta>({ kind: "notes.create", path, markdown })` sous la même garde que `write` ; `mock.ts` `case "notes.create"` ⇒ `CONFLICT` si présent, sinon création (`mock-notes.ts` gagne `create(path, markdown)`), usage enregistré sous `writes: note` ; test du mock : « notes.create refuses an existing path ». Composant : `components/notes/src/NotesView.tsx:120-126`, `create` appelle `sdk.notes.create(path, \`# ${title}\n\`)` et supprime le `listed.data.some(...)` ; le message « Une note porte déjà ce nom. » est affiché sur `CONFLICT` (`describeError`). Test `notes.test.tsx` : le cas « a title whose slug is taken is refused » passe par un mock qui répond `CONFLICT`.
Run: `bun test packages/schema packages/sdk packages/daemon/src/notes packages/devkit components/notes` — Expected: PASS ; `bun run --cwd components/notes test` (conformité) — Expected: PASS.

- [x] **Step 3: `refreshMarketSource` (test rouge puis vert)**

Test RPC marketplace (fichier existant) :
```ts
test("refreshMarketSource refreshes one source and returns it; unknown id is NOT_FOUND", async () => {
  const refreshed: (string | undefined)[] = [];
  const market = fakeMarket({ refresh: async (id) => { refreshed.push(id); }, listSources: () => [sourceA, sourceB] });
  const rpc = createMarketRpc(market, install, publish);
  expect(await rpc({ method: "refreshMarketSource", id: sourceB.id }, local)).toEqual({ handled: true, result: sourceB });
  expect(refreshed).toEqual([sourceB.id]);
  await expect(rpc({ method: "refreshMarketSource", id: "nope" }, local)).rejects.toThrow("NOT_FOUND");
});
```
`market-rpc.ts` : `z.object({ method: z.literal("refreshMarketSource"), id: z.string().min(1) })` et `refreshMarketSource: MarketSourceInfo` dans `MarketRpcResult`. `market/rpc.ts` :
```ts
      case "refreshMarketSource": {
        const known = market.listSources().find((s) => s.id === req.id);
        if (!known) throw new KiboError("NOT_FOUND", `market source ${req.id} not found`);
        await market.refresh(req.id);
        return done(market.listSources().find((s) => s.id === req.id) ?? known);
      }
```
Run: `bun test packages/schema packages/daemon/src/market` — Expected: PASS.

- [x] **Step 4: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages components` — Expected: PASS.

```bash
git add packages/daemon/src/collab/types.ts packages/daemon/src/collab/project-hosts.ts <test registre> packages/daemon/src/projects/admin.ts packages/daemon/src/projects/admin.test.ts packages/daemon/src/projects/delete.test.ts packages/daemon/src/daemon.ts
git commit -m "fix(daemon): suppression refusée pendant le partage"
git add packages/schema/src/call.ts packages/sdk/src/types.ts packages/sdk/src/sdk.ts packages/sdk/src/mock.ts packages/sdk/src/mock-notes.ts <tests sdk> packages/daemon/src/notes/notes-fs.ts packages/daemon/src/notes/notes-fs.test.ts packages/daemon/src/notes/service.ts packages/daemon/src/notes/service.test.ts <gate/permissions> packages/devkit/src/infer-permissions.ts packages/devkit/src/infer-permissions.test.ts components/notes/src/NotesView.tsx components/notes/src/notes.test.tsx
git commit -m "feat(notes): création exclusive d'une note"
git add packages/schema/src/market-rpc.ts packages/daemon/src/market/rpc.ts <test rpc marketplace>
git commit -m "feat(market): rafraîchir une seule source"
```

---

### Task 31: Schéma, core et démon : boîte de réception, `fileTicket`, refus

Vague 0, après T30 (quelques lignes communes dans `projects/admin.ts` et `notes/service.ts`). Spec §15.1, agents §11. Le démon charge un doc projet « inbox » hors liste, route les commandes de tickets dessus, recrée un sous-arbre dans un projet cible dans une transaction, et refuse partout ailleurs. `createTicket` gagne `blockedReason`. `service.ts` passe sous 300 lignes par l'extraction de `projects/project-rpc.ts`.

**Files:**
- Create: `packages/schema/src/inbox.ts`, `inbox.test.ts` ; Modify: `packages/schema/src/index.ts`, `command.ts`, `command.test.ts` (si présent), `rpc.ts`
- Modify: `packages/core/src/tickets.ts`, `tickets.test.ts` ; Create: `packages/core/src/transfer.ts`, `transfer.test.ts` ; Modify: `packages/core/src/index.ts`
- Create: `packages/daemon/src/inbox/inbox-doc.ts`, `inbox-doc.test.ts`, `inbox-rules.ts`, `inbox-rules.test.ts`, `file-ticket.ts`, `file-ticket.test.ts`, `file-ticket-shared.test.ts`, `packages/daemon/src/projects/project-rpc.ts`, `project-rpc.test.ts`
- Modify: `packages/daemon/src/service.ts`, `service.test.ts`, `agents-rpc.ts`, `agents-rpc.test.ts` (créer s'il manque), `collab/rpc.ts`, `collab/rpc.test.ts` (ou `share.test.ts`), `projects/admin.ts`, `admin.test.ts`, `components/service.ts` (gestionnaire de `getNotesDir` / `setNotesDir`, cf. `components/methods.ts`) et `components/service.test.ts`, `packages/daemon/src/docs.ts` (aucun changement de type attendu ; vérifier)

**Interfaces:**
- Consumes: `createProjectDoc`, `loadDoc`, `projectDocId`, `createTicket`, `setStatus`, `addLink`, `listLinks`, `deleteTicket`, `walkDepthFirst`, `getNode`, `upsertExternalRef`, `countTicketsByStatus`, `readProject`, `docs.assertWritable`, `store.transaction`, `requireLocal`.
- Produces: `INBOX_ID`, `INBOX_KEY`, `isInbox`, `inboxAllows`, `RESERVED_PROJECT_KEYS`, `createTicket.blockedReason`, `fileTicket`, `transferTicket`, `loadInbox`, `assertInboxCommand`, `assertNotInbox`, `assertProjectKeyAllowed`, `createFileTicket`, `handleProjectRequest`.

- [x] **Step 1: Schéma (tests rouges puis verts)**

`packages/schema/src/inbox.test.ts` :
```ts
import { expect, test } from "bun:test";
import { INBOX_ID, INBOX_KEY, inboxAllows, isInbox, RESERVED_PROJECT_KEYS } from "./inbox";
import { RpcRequest } from "./rpc";
import { ProjectCommand } from "./command";

test("the inbox has a fixed id and key, and only ticket and link commands", () => {
  expect(isInbox(INBOX_ID)).toBe(true);
  expect(isInbox("p1")).toBe(false);
  expect(RESERVED_PROJECT_KEYS).toEqual([INBOX_KEY]);
  expect(["createTicket", "updateTicket", "setStatus", "moveTicket", "deleteTicket", "addLink", "removeLink"].every(inboxAllows)).toBe(true);
  expect(["addPage", "addInstance", "addBinding", "importExternalTicket", "upsertExternalRef", "setInstanceData"].some(inboxAllows)).toBe(false);
});

test("createTicket accepts a blocked reason and fileTicket is an RPC", () => {
  expect(ProjectCommand.parse({ method: "createTicket", title: "A", statusId: "blocked", blockedReason: "Audit" }).method).toBe("createTicket");
  expect(RpcRequest.parse({ method: "fileTicket", ticketId: "1@1", projectId: "p1" })).toEqual({ method: "fileTicket", ticketId: "1@1", projectId: "p1" });
  expect(RpcRequest.safeParse({ method: "fileTicket", ticketId: "1@1", projectId: "" }).success).toBe(false);
});
```
(`NodeId` : lire sa regex dans `ids.ts` et utiliser une valeur valide.) Run: `bun test packages/schema/src/inbox.test.ts` — Expected: FAIL.

`packages/schema/src/inbox.ts` : contrat « Schéma » ci-dessus (importer `COMMAND_WRITES`, `ProjectCommand` de `./command`, `EntityType` de `./manifest`). `index.ts` : `export * from "./inbox";` (ordre alphabétique). `command.ts` : `blockedReason: z.string().optional()` dans `createTicket`. `rpc.ts` : requête et `RpcResult.fileTicket`.
Run: `bun test packages/schema` — Expected: PASS.

- [x] **Step 2: Core : `blockedReason` à la création et `transferTicket` (tests rouges puis verts)**

`packages/core/src/tickets.test.ts` :
```ts
test("a ticket can be born blocked when a reason is given, and not otherwise", () => {
  const doc = createProjectDoc(meta);
  const t = createTicket(doc, { title: "Audit", statusId: "blocked", blockedReason: "Audit externe en attente" });
  expect([t.statusId, t.blockedReason]).toEqual(["blocked", "Audit externe en attente"]);
  expect(() => createTicket(doc, { title: "B", statusId: "blocked", blockedReason: "   " })).toThrow("BLOCKED_REASON_REQUIRED");
  expect(() => createTicket(doc, { title: "C", statusId: "blocked" })).toThrow("BLOCKED_REASON_REQUIRED");
});
```
`tickets.ts` : `NewTicket` gagne `blockedReason?: string | null` ; `createTicket` :
```ts
  const blockedReason = input.statusId === "blocked" ? cleanReason(input.blockedReason) : null;
  …
  node.data.set("blockedReason", blockedReason);
```
avec `cleanReason` qui lève `BLOCKED_REASON_REQUIRED` sur une valeur vide (réutiliser celle de `setStatus` si elle existe, sinon la factoriser). `commands.ts` : `createTicket` passe `blockedReason: cmd.blockedReason`.

`packages/core/src/transfer.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { addLink, createProjectDoc, createTicket, enableServerAllocation, getTicket, listLinks, listTickets, readProject, transferTicket } from "./index";

const inboxMeta = { id: "inbox", key: "INB", name: "Inbox", folder: null, color: "#64748B" };
const kibo = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function seeded() {
  const from = createProjectDoc(inboxMeta);
  const to = createProjectDoc(kibo);
  createTicket(to, { title: "Existing" });
  const root = createTicket(from, { title: "Root", description: "desc", statusId: "blocked", blockedReason: "Audit", domainId: "core", assignee: { kind: "human", ref: "adam" } });
  const child = createTicket(from, { title: "Child", parentId: root.id });
  const grand = createTicket(from, { title: "Grand", parentId: child.id, statusId: "in_progress" });
  const other = createTicket(from, { title: "Other" });
  addLink(from, { from: child.id, to: grand.id, type: "blocks" });
  addLink(from, { from: other.id, to: root.id, type: "relates" });
  return { from, to, root, child, grand, other };
}

describe("transferTicket", () => {
  test("recreates the subtree in order with new keys, keeps internal links, drops external ones, empties the source", () => {
    const { from, to, root, other } = seeded();
    const result = transferTicket(from, to, root.id, null);
    expect(result.created.map((c) => c.key)).toEqual(["KIB-2", "KIB-3", "KIB-4"]);
    expect([result.recreatedLinks, result.droppedLinks]).toEqual([1, 1]);
    const moved = getTicket(to, result.ticketId);
    expect([moved.title, moved.description, moved.statusId, moved.blockedReason, moved.domainId, moved.assignee]).toEqual(["Root", "desc", "blocked", "Audit", "core", { kind: "human", ref: "adam" }]);
    expect(listTickets(to).map((t) => [t.title, t.parentId === null ? null : getTicket(to, t.parentId).title])).toEqual([["Existing", null], ["Root", null], ["Child", "Root"], ["Grand", "Child"]]);
    expect(listLinks(to)).toHaveLength(1);
    expect(listTickets(from).map((t) => t.title)).toEqual(["Other"]);
    expect(listLinks(from)).toEqual([]);
    expect(getTicket(from, other.id).title).toBe("Other");
  });

  test("a parent in the target is honoured; unknown ids are NOT_FOUND and nothing changes", () => {
    const { from, to, root } = seeded();
    const [existing] = listTickets(to);
    const result = transferTicket(from, to, root.id, existing?.id ?? null);
    expect(getTicket(to, result.ticketId).parentId).toBe(existing?.id ?? null);
    const fresh = seeded();
    expect(() => transferTicket(fresh.from, fresh.to, "9@9", null)).toThrow("NOT_FOUND");
    expect(() => transferTicket(fresh.from, fresh.to, fresh.root.id, "9@9")).toThrow("NOT_FOUND");
    expect(listTickets(fresh.from)).toHaveLength(4);
    expect(listTickets(fresh.to)).toHaveLength(1);
  });

  test("into a shared project the keys are pending", () => {
    const { from, to, root } = seeded();
    enableServerAllocation(to);
    const result = transferTicket(from, to, root.id, null);
    expect(result.key).toBeNull();
    expect(getTicket(to, result.ticketId).pendingSeq).toBe(1);
    expect(readProject(to).nextTicketKey).toBeNull();
  });

  test("keys stay unique and ticketSeq consistent after any sequence of transfers", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 8 }), (picks) => {
        const from = createProjectDoc(inboxMeta);
        const to = createProjectDoc(kibo);
        const roots = [0, 1, 2, 3].map((i) => createTicket(from, { title: `R${i}` }));
        for (const r of roots) createTicket(from, { title: "c", parentId: r.id });
        for (const pick of picks) {
          const root = roots[pick];
          if (root && listTickets(from).some((t) => t.id === root.id)) transferTicket(from, to, root.id, null);
        }
        const keys = listTickets(to).map((t) => t.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.every((k) => k !== null && /^KIB-\d+$/.test(k))).toBe(true);
        expect(readProject(to).nextTicketKey).toBe(`KIB-${keys.length + 1}`);
      }),
    );
  });
});
```
Run: `bun test packages/core/src/transfer.test.ts` — Expected: FAIL (module absent).

`packages/core/src/transfer.ts` :
```ts
import { KiboError, type Ticket } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { upsertExternalRef } from "./external-refs";
import { addLink, listLinks } from "./links";
import { createTicket, deleteTicket, getTicket, ticketTree } from "./tickets";
import { getNode, subtreeIds } from "./tree";

export type TransferredTicket = { from: string; to: string; key: string | null };
export type TransferResult = { ticketId: string; key: string | null; created: TransferredTicket[]; recreatedLinks: number; droppedLinks: number };

function recreate(to: LoroDoc, source: Ticket, parentId: string | null): Ticket {
  const created = createTicket(to, {
    title: source.title,
    description: source.description,
    statusId: source.statusId,
    blockedReason: source.blockedReason,
    parentId,
    domainId: source.domainId,
    assignee: source.assignee?.kind === "human" ? source.assignee : null,
  });
  return source.externalRefs.reduce((t, ref) => upsertExternalRef(to, t.id, ref), created);
}

export function transferTicket(from: LoroDoc, to: LoroDoc, ticketId: string, parentId: string | null): TransferResult {
  const rootNode = getNode(ticketTree(from), ticketId);
  if (parentId !== null) getNode(ticketTree(to), parentId);
  const ids = subtreeIds(rootNode);
  const mapping = new Map<string, string>();
  const created: TransferredTicket[] = [];
  const visit = (id: string, targetParent: string | null) => {
    const source = getTicket(from, id);
    const next = recreate(to, source, targetParent);
    mapping.set(id, next.id);
    created.push({ from: id, to: next.id, key: next.key });
    for (const child of getNode(ticketTree(from), id).children() ?? []) visit(child.id, next.id);
  };
  visit(ticketId, parentId);
  let recreatedLinks = 0;
  let droppedLinks = 0;
  for (const link of listLinks(from)) {
    const touches = ids.includes(link.from) || ids.includes(link.to);
    if (!touches) continue;
    const a = mapping.get(link.from);
    const b = mapping.get(link.to);
    if (a && b) {
      addLink(to, { from: a, to: b, type: link.type });
      recreatedLinks += 1;
    } else droppedLinks += 1;
  }
  deleteTicket(from, ticketId);
  const root = created[0];
  if (!root) throw new KiboError("INTERNAL", "transfer created nothing");
  return { ticketId: root.to, key: root.key, created, recreatedLinks, droppedLinks };
}
```
(`subtreeIds(node)` et `getNode(tree, id)` sont dans `tree.ts` ; l'accesseur `tree` de `tickets.ts:30` est privé : l'exporter sous le nom `ticketTree` ; `children()` renvoie les enfants dans l'ordre fractionnaire. `core/index.ts` : `export * from "./transfer";`.)
Run: `bun test packages/core` — Expected: PASS (fast-check compris).

- [x] **Step 3: Doc de la boîte et règles (tests rouges puis verts)**

`packages/daemon/src/inbox/inbox-doc.test.ts` :
```ts
test("the inbox doc is created once, persisted under project:inbox, and never registered", () => {
  const dir = tmp();
  const store = openStore(dir);
  const doc = loadInbox(store);
  expect(getProjectMeta(doc)).toEqual(INBOX_META);
  createTicket(doc, { title: "A" });
  store.save(projectDocId(INBOX_ID), doc.export({ mode: "snapshot" }));
  store.close();
  const again = openStore(dir);
  expect(listTickets(loadInbox(again)).map((t) => t.key)).toEqual(["INB-1"]);
  expect(listProjects(loadDoc(again, WORKSPACE_DOC_ID) ?? createWorkspaceDoc())).toEqual([]);
  again.close();
});
```
(`store.save(id, bytes)` : lire la méthode réelle d'écriture d'un snapshot dans `store.ts`.) `inbox-rules.test.ts` : `assertInboxCommand` accepte `createTicket`, refuse `addPage` avec `INVALID_INPUT` « the inbox only holds tickets » ; `assertNotInbox("inbox", "sharing")` lève `INVALID_INPUT` « sharing is not available for the inbox », `assertNotInbox("p1", …)` ne lève pas ; `assertProjectKeyAllowed("INB")` lève, `("KIB")` passe.
Run: `bun test packages/daemon/src/inbox` — Expected: FAIL.

`inbox-doc.ts` et `inbox-rules.ts` : contrat « Démon ». Run: `bun test packages/daemon/src/inbox` — Expected: PASS.

- [x] **Step 4: Service : la boîte chargée, routée, refusée ; `project-rpc.ts` extrait (tests rouges puis verts)**

`packages/daemon/src/service.test.ts` :
```ts
describe("inbox", () => {
  test("tickets live in the inbox without any project, survive a restart, and never show in listProjects", () => {
    const dir = tmp();
    const store = openStore(dir);
    const s = createService(store, { user: "adam" });
    const a = s.handle({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "Appeler le comptable" } }) as Ticket;
    expect(a.key).toBe("INB-1");
    expect(s.handle({ method: "listProjects" })).toEqual([]);
    const snapshot = s.handle({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot;
    expect([snapshot.meta.key, snapshot.pages, snapshot.instances, snapshot.sync.shared, snapshot.nextTicketKey]).toEqual(["INB", [], [], false, "INB-2"]);
    store.close();
    const s2 = createService(openStore(dir), { user: "adam" });
    const b = s2.handle({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "B" } }) as Ticket;
    expect(b.key).toBe("INB-2");
  });

  test("the inbox refuses pages, instances, sharing-like operations and the INB project key", () => {
    const s = createService(openStore(tmp()), { user: "adam" });
    expect(() => s.handle({ method: "command", projectId: INBOX_ID, command: { method: "addPage", title: "P", kind: "dashboard" } })).toThrow("INVALID_INPUT");
    expect(() => s.handle({ ...newProject, key: "INB" })).toThrow("INVALID_INPUT");
    expect(() => s.handle({ method: "getNotesDir", projectId: INBOX_ID })).toThrow("INVALID_INPUT");
  });

  test("filing a ticket recreates it in the project with a new key and empties the inbox, in one transaction", () => {
    const s = createService(openStore(tmp()), { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const root = s.handle({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "Root" } }) as Ticket;
    s.handle({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "Child", parentId: root.id } });
    const seen: (string | null)[] = [];
    s.onChange((m) => { if ("projectId" in m) seen.push(m.projectId); });
    const filed = s.handle({ method: "fileTicket", ticketId: root.id, projectId: p.id }) as { ticketId: string; key: string | null };
    expect(filed.key).toBe("KIB-1");
    const target = s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot;
    expect(target.tickets.map((t) => [t.title, t.key])).toEqual([["Root", "KIB-1"], ["Child", "KIB-2"]]);
    expect((s.handle({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot).tickets).toEqual([]);
    expect(seen).toEqual([INBOX_ID, p.id]);
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: p.id })).toThrow("NOT_FOUND");
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: INBOX_ID })).toThrow("INVALID_INPUT");
  });

  test("filing into a read-only project is refused and both docs are intact", () => {
    const s = createService(openStore(tmp()), { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const t = s.handle({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "T" } }) as Ticket;
    s.docs.setWriteGuard((id) => { if (id === p.id) throw new KiboError("FORBIDDEN", "read-only"); });
    expect(() => s.handle({ method: "fileTicket", ticketId: t.id, projectId: p.id })).toThrow("FORBIDDEN");
    expect((s.handle({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot).tickets).toHaveLength(1);
    expect((s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot).tickets).toHaveLength(0);
  });
});
```
`packages/daemon/src/inbox/file-ticket-shared.test.ts` avec `startSyncHarness({ daemons: 1 })` (modèle `collab/share.test.ts`) : partager `p`, créer un ticket dans la boîte, `fileTicket` ⇒ `key: null`, puis attendre l'attribution (`KIB-n`) comme les tests de clés en attente ; `fileTicket` pendant `setLocked(p, true)` ⇒ `CONFLICT`.
Run: `bun test packages/daemon/src/service.test.ts packages/daemon/src/inbox` — Expected: FAIL.

Implémentation :
- `service.ts` : après le chargement des projets, `projects.set(INBOX_ID, loadInbox(store));` ; `adopt(id, doc)` ne notifie `docListeners` que si `!isInbox(id)` ; `docs.save(id)` fonctionne tel quel (`projectDocId(INBOX_ID)`) ; `docs.projectIds()` reste la liste du workspace (vérifier qu'il ne lit pas `projects.keys()`) ; dans `restore(id)` du `createCommandPath`, pour la boîte : `projects.set` sans `adopt` (ou `adopt` qui filtre, cf. ci-dessus).
- `projects/project-rpc.ts` : `handleProjectRequest(deps, req)` porte les cas `listProjects` (inchangé), `createProject` (avec `assertProjectKeyAllowed(req.key)` avant `registerProject`), `getProject` (inchangé : `readProject(docs.project(id))` fonctionne pour la boîte ; `docs.projectMeta(INBOX_ID)` doit renvoyer `INBOX_META` : vérifier `withLocalFolder`, qui lit `project_settings`, sans effet), `command` (si `isInbox(req.projectId)` : `assertInboxCommand(req.command)` et `instanceId` refusé en `INVALID_INPUT`), `fileTicket` (délégué) ; renvoie `NOT_HANDLED` (symbole exporté) sinon. `service.handle` délègue avant le `switch` restant et perd ces cas ; `service.ts` ≤ 300 lignes (vérifier `wc -l`).
- `inbox/file-ticket.ts` :
```ts
export function createFileTicket(deps: FileTicketDeps) {
  return (req: FileRequest) => {
    if (isInbox(req.projectId)) throw new KiboError("INVALID_INPUT", "a ticket cannot be filed into the inbox");
    const target = deps.docs.project(req.projectId);
    deps.docs.assertWritable(req.projectId);
    const inbox = deps.docs.project(INBOX_ID);
    try {
      const result = deps.store.transaction(() => {
        const moved = transferTicket(inbox, target, req.ticketId, req.parentId ?? null);
        deps.docs.save(INBOX_ID);
        deps.docs.save(req.projectId);
        return moved;
      });
      deps.docs.emit({ projectId: INBOX_ID });
      deps.docs.emit({ projectId: req.projectId });
      return { ticketId: result.ticketId, key: result.key };
    } catch (e) {
      deps.restore(INBOX_ID);
      deps.restore(req.projectId);
      throw e;
    }
  };
}
```
(`restore` = celui du `createCommandPath`, exposé par le service ; si `store.transaction` relance l'erreur après rollback SQLite, les docs en mémoire sont restaurés depuis leur dernier snapshot : c'est ce que `restoreAll` fait déjà. Un projet partagé : la création dans `target` passe par `createTicket` de core, donc `pendingSeq` ; le push vers le serveur suit par `onLocalChange` comme pour toute commande, car `transferTicket` commit le doc : vérifier que `docs.save` + le `subscribeLocalUpdates` du registre des hôtes suffisent, sinon appeler `docs.imported`/le même chemin que `guarded`.)
- `agents-rpc.ts` : `previewAssign`, `assignAgent` ⇒ `assertNotInbox(req.projectId, "assigning an agent")` ; test `agents-rpc.test.ts` avec un port simulé : l'orchestrateur n'est jamais appelé.
- `collab/rpc.ts` : `shareProject`, `createProjectInvite` ⇒ `assertNotInbox(req.projectId, "sharing")` ; test.
- `projects/admin.ts` : `updateProject`, `deleteProject`, `setIcon` (propriétaire `project` dont `projectId` est la boîte) ⇒ `assertNotInbox` ; tests dans `admin.test.ts`.
- `components/service.ts` : `getNotesDir` / `setNotesDir` ⇒ `assertNotInbox(projectId, "notes")` ; test dans `components/service.test.ts`.
Run: `bun test packages/daemon` — Expected: PASS.

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages` — Expected: PASS ; `wc -l packages/daemon/src/service.ts` ≤ 300.

```bash
git add packages/schema/src/inbox.ts packages/schema/src/inbox.test.ts packages/schema/src/index.ts packages/schema/src/command.ts packages/schema/src/rpc.ts packages/core/src/tickets.ts packages/core/src/tickets.test.ts packages/core/src/commands.ts packages/core/src/transfer.ts packages/core/src/transfer.test.ts packages/core/src/index.ts
git commit -m "feat(core): transfert d'un ticket et motif à la création"
git add packages/daemon/src/inbox packages/daemon/src/projects/project-rpc.ts packages/daemon/src/projects/project-rpc.test.ts packages/daemon/src/service.ts packages/daemon/src/service.test.ts packages/daemon/src/agents-rpc.ts packages/daemon/src/agents-rpc.test.ts packages/daemon/src/collab/rpc.ts <test collab> packages/daemon/src/projects/admin.ts packages/daemon/src/projects/admin.test.ts <gestionnaire notes dir et test>
git commit -m "feat(daemon): boîte de réception et rattachement"
```

---

### Task 32: UI : Nouveau ticket avec projet et assigné, entrée « Boîte de réception », Mes tickets

Vague 2 ← T31 (schéma), T29, T39 (`Shell.tsx` allégé). Spec §15.1 ; écran **114**. Le dialogue devient autonome (décision 4), le bouton d'en-tête est toujours visible, la barre latérale et la vue d'ensemble montrent la boîte, `useSnapshots` la charge, « Mes tickets », la palette et les titres d'onglet la nomment « Boîte de réception ». L'écran `inbox` entre dans les tables (sa page vient en T33 ; d'ici là `ScreenView` rend un `InboxPage` minimal « Chargement… » ? Non : T32 enregistre l'écran et rend un `lazyPanel` vers `../inbox/InboxPage`, dont le fichier est créé ici avec le seul état vide, complété en T33).

**Files:**
- Create: `packages/ui/src/lib/inbox.ts`, `inbox.test.ts`, `packages/ui/src/i18n/fr-inbox.ts`, `packages/ui/src/inbox/InboxPage.tsx` (état vide seul)
- Modify: `packages/schema/src/tabs.ts`, `packages/ui/src/tabs/target-hash.ts`, `screens.ts`, `tabs.test.ts`, `palette/CommandPalette.tsx`, `shell/ScreenView.tsx`, `shell/lazy-screens.ts`, `shell/ShellHeader.tsx` (`HEADING_SCREENS`, bouton), `packages/ui/scripts/bundle-report.ts`
- Modify: `packages/ui/src/dialogs/NewTicketDialog.tsx`, `dialogs/dialogs.test.tsx`, `shell/ShellDialogs.tsx`, `shell/Shell.tsx`, `shell/AppSidebar.tsx`, `shell/Overview.tsx`, `shell/shell.test.tsx` (ou `agents-shell.test.tsx`), `mine/my-tickets.ts`, `mine/MyTicketsPage.tsx`, `mine/MyTicketRow.tsx`, `mine/my-tickets-page.test.tsx`, `tabs/tab-title.ts`, `tabs/tab-title.test.ts` (créer si absent), `shell/Breadcrumb.tsx` (nom), `palette/palette-items.ts`, `palette/palette-items.test.ts`, `i18n/fr.ts` (`nav.inbox`, `newTicket.*`, `mine.noFolderInbox`, `overview.inbox`), `dialogs/NewProjectDialog.tsx` (clé réservée), `NewProjectDialog.test.tsx`

**Interfaces:**
- Consumes: `INBOX_ID`, `INBOX_KEY`, `isInbox`, `RESERVED_PROJECT_KEYS`, `useProject`, `useSnapshots`, `canEdit`, `AssigneeSelect` (`ticket/AssigneeSelect.tsx` : lire ses props ; sinon un `Select` local), `StatusSelect`.
- Produces: contrat « UI » (T32) : `inboxMeta`, `displayName`, `withInbox`, `inboxSummary`, `openInboxCount`, `NewTicketDialog` props, `AppSidebar.inboxCount`, `Overview.inboxCount/onOpenInbox`, `Screen "inbox"`.

- [x] **Step 1: `lib/inbox.ts` (test rouge puis vert)**

```ts
test("withInbox puts the inbox first only when its snapshot is loaded, and counts open tickets", () => {
  const snapshots = new Map([[INBOX_ID, inboxSnapshot([{ statusId: "todo" }, { statusId: "done" }])]]);
  expect(withInbox(projectsFixture, new Map()).map((p) => p.id)).toEqual(projectsFixture.map((p) => p.id));
  const all = withInbox(projectsFixture, snapshots);
  expect(all[0]?.id).toBe(INBOX_ID);
  expect(all[0]?.name).toBe("Boîte de réception");
  expect(openInboxCount(snapshots.get(INBOX_ID))).toBe(1);
  expect(displayName({ id: INBOX_ID, name: "Inbox" })).toBe("Boîte de réception");
  expect(displayName({ id: "p1", name: "Kibo" })).toBe("Kibo");
});
```
(`inboxSnapshot(tickets)` : petit constructeur local du test à partir de `kiboProject()`.) Implémenter selon le contrat. Run: `bun test packages/ui/src/lib/inbox.test.ts` — Expected: PASS après implémentation.

- [x] **Step 2: Écran `inbox` dans les tables (test rouge puis vert)**

`tabs.test.ts` : `targetToHash({ kind: "screen", screen: "inbox" })` ⇒ `#/inbox` et retour. `Screen` gagne `"inbox"` (après `"mine"`), `SCREEN_HASHES.inbox`, `SCREENS.inbox = { title: fr.nav.inbox, icon: Inbox, crumbs: [fr.nav.inbox] }`, `CommandPalette` icône, `ShellHeader.HEADING_SCREENS` gagne `"inbox"`, `ScreenView` : `if (screen === "inbox") return <InboxPage snapshot={snapshots.get(INBOX_ID) ?? null} projects={projects} viewer={viewer} onOpenTicket={(id) => onOpenTicket(INBOX_ID, id)} onNewTicket={onNewTicket} />` (prop `onNewTicket` ajoutée à `ScreenView` et passée par `Shell`), `lazy-screens.ts` : `InboxPage`, `bundle-report.ts` : `/\/packages\/ui\/src\/(inbox\/[A-Za-z-]+\.tsx?|i18n\/fr-inbox\.ts)$/`. `inbox/InboxPage.tsx` (T32) rend l'en-tête et l'état vide (écran 113, variante vide) et, si des tickets existent, une liste provisoire `<ul>` clé · titre (remplacée en T33).
Run: `bun run typecheck && bun test packages/ui/src/tabs packages/ui/src/shell/screens.test.tsx` — Expected: PASS.

- [x] **Step 3: Dialogue « Nouveau ticket » autonome (tests rouges puis verts, écran 114)**

`dialogs/dialogs.test.tsx`, remplacer les tests de `NewTicketDialog` :
```tsx
test("the project selector lists the inbox first then editable projects, preselects the given one, and creates there", async () => {
  render(<NewTicketDialog projects={[inboxMeta(), kibo.meta, readOnly.meta]} initialProjectId={kibo.meta.id} lockProject={false} viewer="adam" defaults={{}} onClose={() => {}} />);
  const select = screen.getByRole("combobox", { name: "Projet" });
  expect(select.textContent).toBe("Kibo");
  expect(await screen.findByText("Clé KIB-25")).toBeTruthy();
  fireEvent.click(select);
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Boîte de réception", "Kibo"]);
  fireEvent.click(screen.getByRole("option", { name: "Boîte de réception" }));
  expect(await screen.findByText("Clé INB-4")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Appeler le comptable" } });
  fireEvent.click(screen.getByRole("button", { name: "Créer" }));
  await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: "command", projectId: INBOX_ID, command: { method: "createTicket", title: "Appeler le comptable", assignee: { kind: "human", ref: "adam" } } }));
});

test("assignee can be nobody, and a blocked status requires a reason", async () => { /* « Personne » ⇒ assignee: null ; statut Bloqué ⇒ champ Motif, bouton désactivé tant qu'il est vide, puis blockedReason transmis */ });

test("with a parent the project is locked and explained", () => { /* lockProject ⇒ pas de combobox, texte « Projet : Kibo » et fr.newTicket.projectLocked */ });
```
(`getProject` du mock renvoie `kibo` ou un snapshot de la boîte selon `projectId`, avec `nextTicketKey` « KIB-25 » / « INB-4 ».) `NewTicketDialog.tsx` : props du contrat ; `const [projectId, setProjectId] = useState(initialProjectId)` ; `const project = useProject(projectId)` ; sélecteur `Select` (label `fr.newTicket.project`) sur `projects.filter((p) => isInbox(p.id) || canEditMeta(p))` (`canEdit` attend un snapshot : les `ProjectMeta` passés par le shell sont déjà filtrés en amont par `withInbox(projects, snapshots).filter(p => isInbox(p.id) || canEdit(snapshots.get(p.id)))`, le dialogue ne refiltre pas) ; statut : `StatusSelect` ou le `Select` existant **avec** « Bloqué » ; champ « Motif » (`Textarea`, `required`) quand `blocked` ; assigné : `Select` « Moi (adam) » / « Personne » / membres (`project.sync.members` quand partagé) ; soumission : `createTicket { title, description, statusId, blockedReason?, parentId, assignee }` ; en attente de `project` (snapshot nul) le bouton « Créer » est désactivé. `ShellDialogs.tsx` : rendu dès `state.newTicket`, `projects={editableWithInbox}`, `initialProjectId={ticketProject?.meta.id ?? INBOX_ID}`, `lockProject={...}`. `ShellHeader.tsx` : bouton toujours rendu, `title = fr.header.newTicketIn(displayName(ticketProject?.meta ?? inboxMeta()))`. `Host.openNewTicket` (Shell) garde sa garde `canEdit` pour un projet, et ouvre sur la boîte sans projet.
Run: `bun test packages/ui/src/dialogs packages/ui/src/shell` — Expected: PASS.

- [x] **Step 4: Barre latérale, vue d'ensemble, snapshots, Mes tickets, palette, titres (tests rouges puis verts)**

- `Shell.tsx` : `useSnapshots([...projects.map((p) => p.id), INBOX_ID])` ; `inboxCount = openInboxCount(snapshots.get(INBOX_ID))` ; `mineCount = countMine(myTickets(withInbox(projects, snapshots), snapshots, viewer, "assigned"))`.
- `AppSidebar.tsx` : prop `inboxCount`, entrée `fr.nav.inbox` (icône `Inbox`) après « Mes tickets », badge si > 0, active sur `screen === "inbox"`. Test dans `shell.test.tsx` : l'entrée est présente avec le badge « 3 » et ouvre `#/inbox`.
- `Overview.tsx` : props `inboxCount`, `onOpenInbox` ; carte sobre « Boîte de réception · 3 tickets sans projet » (`fr.overview.inbox(n)`), absente si 0 ; `ContentView` les passe.
- `MyTicketsPage.tsx` : reçoit `projects = withInbox(projects, snapshots)` depuis `ScreenView` ; en-tête de groupe par `displayName` ; `MyTicketRow` : pour la boîte, le bouton « Confier à un agent » est remplacé par « Rattacher… » désactivé avec `title = fr.mine.noFolderInbox` (le dialogue de rattachement arrive en T33 : ici l'entrée est désactivée et le test le constate ; T33 l'active).
- `tab-title.ts` : `project.name` ⇒ `displayName(project)` ; `Breadcrumb.crumbsFor` idem ; test : un onglet `{ kind: "ticket", projectId: INBOX_ID }` s'intitule « Boîte de réception · INB-3 ».
- `palette-items.ts` : les tickets viennent de `withInbox(projects, snapshots)` ; les cibles « projet » excluent `isInbox` ; aucune action `assign` sur un ticket de la boîte ; test.
- `NewProjectDialog.tsx` : la clé `INB` affiche `fr.newProject.keyReserved` et désactive « Créer » ; test.
Run: `bun test packages/ui && bun run budget` — Expected: PASS ; budget noté (entrée : +≈0,6 kB).

- [x] **Step 5: Gate et commits**

```bash
git add packages/ui/src/lib/inbox.ts packages/ui/src/lib/inbox.test.ts packages/ui/src/i18n/fr-inbox.ts packages/ui/src/inbox/InboxPage.tsx packages/schema/src/tabs.ts packages/ui/src/tabs/target-hash.ts packages/ui/src/tabs/screens.ts packages/ui/src/tabs/tabs.test.ts packages/ui/src/palette/CommandPalette.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ShellHeader.tsx packages/ui/scripts/bundle-report.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): écran Boîte de réception enregistré"
git add packages/ui/src/dialogs/NewTicketDialog.tsx packages/ui/src/dialogs/dialogs.test.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/ShellHeader.tsx
git commit -m "feat(ui): nouveau ticket avec projet et assigné"
git add packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Overview.tsx packages/ui/src/shell/ContentView.tsx packages/ui/src/shell/shell.test.tsx packages/ui/src/mine packages/ui/src/tabs/tab-title.ts packages/ui/src/tabs/tab-title.test.ts packages/ui/src/shell/Breadcrumb.tsx packages/ui/src/palette/palette-items.ts packages/ui/src/palette/palette-items.test.ts packages/ui/src/dialogs/NewProjectDialog.tsx packages/ui/src/dialogs/NewProjectDialog.test.tsx
git commit -m "feat(ui): la boîte de réception dans le shell"
```

---

### Task 33: UI : page Boîte de réception, Rattacher à un projet, fiche adaptée

Vague 3 ← T32, T41. Spec §15.1 ; écrans **113** et **115**. La page liste les tickets avec menu ⋯ et clic droit (même liste), le dialogue de rattachement appelle `fileTicket` puis ouvre la fiche du ticket recréé ; la fiche d'un ticket de la boîte perd « Assigner » et gagne « Rattacher à un projet… » ; « Mes tickets » active son bouton « Rattacher… » ; `AssignDialog` explique.

**Files:**
- Modify: `packages/ui/src/inbox/InboxPage.tsx` ; Create: `packages/ui/src/inbox/InboxRow.tsx`, `inbox-menu.ts`, `inbox-menu.test.ts`, `inbox-page.test.tsx`, `packages/ui/src/dialogs/FileTicketDialog.tsx`, `file-ticket-dialog.test.tsx`
- Modify: `packages/ui/src/i18n/fr-inbox.ts`, `shell/ShellDialogs.tsx`, `shell/lazy-dialogs.ts`, `shell/TicketSheet.tsx`, `ticket/TicketActionsMenu.tsx`, `ticket/ticket-actions.test.tsx` (ou le test existant), `agents/AssignDialog.tsx`, `agents/assign-dialog.test.tsx`, `mine/MyTicketRow.tsx`, `mine/MyTicketsPage.tsx`, `mine/my-tickets-page.test.tsx`, `packages/ui/scripts/bundle-report.ts`

**Interfaces:**
- Consumes: `fileTicket`, `withInbox`, `displayName`, `MenuEntry`, `ContextMenuEntries`, `DropdownMenuEntries`, `ConfirmDialog`, `useTicketCommand`, `canEdit`.
- Produces: `InboxPage` (complète), `inboxMenuEntries`, `FileTicketDialog`, `DialogsState.fileTicket`, `TicketActionsMenu.onFile`.

- [ ] **Step 1: Menu en données (test rouge puis vert)**

`inbox-menu.test.ts` : `inboxMenuEntries({ texts: frInbox, actions })` ⇒ labels `["Ouvrir", "Rattacher à un projet…", <séparateur>, "Supprimer…"]`, le dernier `destructive`. Implémenter. Run: `bun test packages/ui/src/inbox/inbox-menu.test.ts` — Expected: PASS.

- [ ] **Step 2: Page (tests rouges puis verts, écran 113)**

`inbox-page.test.tsx` (mock `../api` : `command deleteTicket` capturé) :
```tsx
test("lists inbox tickets with status and assignee, opens on click, and offers the same menu on ⋯ and right click (screen 113)", async () => {
  const opened: string[] = [];
  render(<InboxPage snapshot={inboxSnapshot} projects={projectsFixture} viewer="adam" onOpenTicket={(id) => opened.push(id)} onNewTicket={() => {}} />);
  expect(screen.getByRole("heading", { level: 1, name: "Boîte de réception" })).toBeTruthy();
  const row = screen.getByRole("row", { name: /INB-2/ });
  expect(within(row).getByText("À faire")).toBeTruthy();
  fireEvent.click(within(row).getByRole("button", { name: /Appeler le comptable/ }));
  expect(opened).toEqual([ticketId("INB-2")]);
  fireEvent.click(within(row).getByRole("button", { name: "Actions pour INB-2" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Ouvrir", "Rattacher à un projet…", "Supprimer…"]);
});
test("the empty state explains and offers a new ticket", () => { /* « Rien en attente. », bouton « Nouveau ticket » appelle onNewTicket */ });
test("removing asks for confirmation then sends deleteTicket on the inbox", async () => { /* ConfirmDialog ; calls ⇒ { method: "command", projectId: INBOX_ID, command: { method: "deleteTicket" } } */ });
```
`InboxPage.tsx` : `Table` du SDK, une `InboxRow` par ticket (clé en mono, titre bouton, pastille et libellé du statut via `snapshot.workflow`, assigné `ref` ou « — », bouton « Rattacher… », `⋯`), `ContextMenu` sur la ligne avec `ContextMenuEntries`, état `removing` + `ConfirmDialog`, état `filing` + `FileTicketDialog` (lazy : `lazy-dialogs.ts`). La page reçoit `projects` pour le dialogue de rattachement.
Run: `bun test packages/ui/src/inbox` — Expected: PASS.

- [ ] **Step 3: Dialogue « Rattacher à un projet » (tests rouges puis verts, écran 115)**

`file-ticket-dialog.test.tsx` :
```tsx
test("files into the chosen editable project, explains the new key, children and lost links, then opens the new ticket (screen 115)", async () => {
  const filed: [string, string][] = [];
  render(<FileTicketDialog ticket={ticket("INB-2")} hasChildren hasLinks projects={projectsFixture} snapshots={snapshots} onClose={() => {}} onFiled={(p, t) => filed.push([p, t])} />);
  expect(screen.getByRole("dialog", { name: "Rattacher INB-2 à un projet" })).toBeTruthy();
  expect(screen.getByText(/la prochaine est KIB-25/)).toBeTruthy();
  expect(screen.getByText("Ses sous-tickets suivent.")).toBeTruthy();
  expect(screen.getByText(/liens vers d'autres tickets de la boîte sont perdus/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "fileTicket", ticketId: ticket("INB-2").id, projectId: "p1" }));
  await waitFor(() => expect(filed).toEqual([["p1", "new-id"]]));
});
test("a shared target says the key comes from the server; a read-only project is not offered; no project ⇒ explanation", () => { /* … */ });
test("a FORBIDDEN answer is shown in the dialog, which stays open", () => { /* … */ });
```
Implémenter selon le contrat (`Select` des projets `canEdit(snapshots.get(p.id))`, texte `nextKey(snapshot.nextTicketKey)` ou `serverKey`, phrases conditionnelles, `role="alert"` sur erreur, `describeError`). `ShellDialogs.tsx` : `fileTicket: { ticketId } | null` rendu avec `snapshots.get(INBOX_ID)` ; `onFiled` ⇒ `set({ fileTicket: null, sheet: { projectId, ticketId } })`.
Run: `bun test packages/ui/src/dialogs/file-ticket-dialog.test.tsx` — Expected: PASS.

- [ ] **Step 4: Fiche, Mes tickets, AssignDialog (tests rouges puis verts)**

- `TicketActionsMenu.tsx` : prop `onFile?` ⇒ entrée « Rattacher à un projet… » (après « Copier la clé ») ; `TicketSheet.tsx` : si `isInbox(project.meta.id)`, pas de bouton « Assigner », `onFile` passé ; section « Dépendances » conservée (A1). Test : la fiche d'un ticket `INB-n` n'a pas « Assigner » et son menu a « Rattacher à un projet… ».
- `MyTicketRow.tsx` / `MyTicketsPage.tsx` : bouton « Rattacher… » actif pour la boîte ⇒ `onFile(ticketId)` (prop nouvelle remontée à `ScreenView` → `set({ fileTicket })`).
- `AssignDialog.tsx` : si `project && isInbox(project.meta.id)` ⇒ avis `frInbox.noAgent` au lieu du formulaire ; test.
- `palette-items.ts` : vérifié en T32.
Run: `bun test packages/ui && bun run budget` — Expected: PASS ; budget noté.

- [ ] **Step 5: Gate et commits**

```bash
git add packages/ui/src/inbox packages/ui/src/i18n/fr-inbox.ts packages/ui/src/shell/lazy-dialogs.ts packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): page Boîte de réception"
git add packages/ui/src/dialogs/FileTicketDialog.tsx packages/ui/src/dialogs/file-ticket-dialog.test.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/shell/TicketSheet.tsx packages/ui/src/ticket/TicketActionsMenu.tsx <test ticket actions> packages/ui/src/agents/AssignDialog.tsx packages/ui/src/agents/assign-dialog.test.tsx packages/ui/src/mine packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/Shell.tsx
git commit -m "feat(ui): rattacher un ticket à un projet"
```

---

### Task 34: Composants › Installés : titre, recherche, filtres, tri, « Créer un composant », volet « Utilisé dans »

Vague 1 ← T29. Spec §15.2 ; écran **116**. UI seule : `listComponents` fournit déjà confiance, origine et usages par version. Fonctions pures testées sans DOM, barre de filtres et volet chargés avec la page (déjà à la demande).

**Files:**
- Create: `packages/ui/src/components-page/filter-components.ts`, `filter-components.test.ts`, `ComponentsFilters.tsx`, `UsagesSheet.tsx`, `packages/ui/src/i18n/fr-components-list.ts`
- Modify: `packages/ui/src/components-page/ComponentsPage.tsx`, `ComponentsTable.tsx`, `components-page.test.tsx`, `PublishSections.tsx` (bouton « Utilisé dans n projets » ⇒ même volet), `packages/ui/src/shell/ScreenView.tsx` (props `onOpen`, `onCreate`), `packages/ui/src/dialogs/CreateComponentDialog.tsx` (aucun changement attendu : `target: null` accepté), `packages/ui/scripts/bundle-report.ts` (`UsagesSheet`, `fr-components-list.ts` : déjà couverts par le motif `components-page/ComponentsPage` ? non : ajouter `/\/packages\/ui\/src\/(components-page\/(ComponentsFilters|UsagesSheet)\.tsx|i18n\/fr-components-list\.ts)$/`)

**Interfaces:**
- Consumes: `ComponentRow` (`rows.ts`), `componentRows`, `Sheet`, `ToggleGroup`, `Select`, `Input`, `Table`, `TabTarget`.
- Produces: contrat « UI » (T34) : `filterComponents`, `toggleSort`, `DEFAULT_QUERY`, `UsagesSheet`, `ComponentsPage { onOpen, onCreate }`.

- [x] **Step 1: Filtre et tri purs (tests rouges puis verts)**

`filter-components.test.ts` :
```ts
import { expect, test } from "bun:test";
import { DEFAULT_QUERY, filterComponents, toggleSort } from "./filter-components";

const row = (over: Partial<ComponentRow>): ComponentRow => ({ key: "k", id: "kanban", title: "Kanban", version: "1.0.0", builtin: true, trust: "builtin", tampered: false, origin: "kibo", pages: 2, projects: 1, used: true, summary: null, revoked: null, market: null, ...over });
const rows = [row({}), row({ key: "m", id: "meteo", title: "Météo", builtin: false, trust: "sandboxed", origin: "marketplace", pages: 0, projects: 0, used: false }), row({ key: "a", id: "acme.bug", title: "Bugs Acme", builtin: false, trust: "pending", origin: "ai", version: "2.1.0", pages: 5, projects: 3 })];

test("text search ignores case and accents, on title and id", () => {
  expect(filterComponents(rows, { ...DEFAULT_QUERY, text: "meteo" }).map((r) => r.id)).toEqual(["meteo"]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, text: "acme" }).map((r) => r.id)).toEqual(["acme.bug"]);
});
test("trust and origin filters combine", () => {
  expect(filterComponents(rows, { ...DEFAULT_QUERY, trust: "pending" }).map((r) => r.id)).toEqual(["acme.bug"]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, origin: "kibo", trust: "sandboxed" })).toEqual([]);
});
test("sorting by usage puts the most used first when descending, and toggleSort flips", () => {
  const q = toggleSort(DEFAULT_QUERY, "usage");
  expect([q.sort, q.descending]).toEqual(["usage", true]);
  expect(filterComponents(rows, q).map((r) => r.id)).toEqual(["acme.bug", "kanban", "meteo"]);
  expect(toggleSort(q, "usage").descending).toBe(false);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, sort: "version", descending: true })[0]?.version).toBe("2.1.0");
});
```
Implémenter (`normalize = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()` ; tri par `localeCompare("fr")` pour `title`, `trust`, `origin`, `compareSemver` de `@kibo/schema` pour `version`, `pages` pour `usage` ; `DEFAULT_QUERY = { text: "", trust: "all", origin: "all", sort: "title", descending: false }` ; `toggleSort` : même clé ⇒ inverse, autre clé ⇒ `descending: key === "usage"`).
Run: `bun test packages/ui/src/components-page/filter-components.test.ts` — Expected: PASS.

- [x] **Step 2: Page : en-tête, barre, en-têtes triables, « Créer un composant » (tests rouges puis verts, écran 116)**

`components-page.test.tsx`, nouveaux tests (mock existant) :
```tsx
test("screen 116: title, explanation, search, filters and sortable headers", async () => {
  components = [kanbanSummary, meteoSummary, acmeSummary];
  render(<ComponentsPage onOpen={() => {}} onCreate={() => {}} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Composants" })).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un composant" }), { target: { value: "météo" } });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un composant" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("radio", { name: "À examiner" }));
  expect(screen.getByRole("row", { name: /Bugs Acme/ })).toBeTruthy();
  expect(screen.queryByRole("row", { name: /Kanban/ })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Tous", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Trier par Utilisé dans" }));
  const titles = screen.getAllByRole("row").slice(1).map((r) => r.textContent?.slice(0, 5));
  expect(titles[0]).toContain("Bugs");
  expect(screen.getByRole("columnheader", { name: /Utilisé dans/ }).getAttribute("aria-sort")).toBe("descending");
});
test("no match offers to clear the filters; Créer un composant opens the creation dialog without a page", async () => { /* onCreate appelé ; CreateComponentDialog monté par la page avec target null, ou onCreate remonte au shell : choisir « la page monte le dialogue » (il est déjà lazy) */ });
```
`ComponentsFilters.tsx` : `Input type="search"` (aria-label), deux `ToggleGroup` (`type="single"`, libellés de `fr-components-list.ts`), bouton « Effacer les filtres » quand `query !== DEFAULT_QUERY`. `ComponentsTable.tsx` : props `query`, `onSort(key)` ; en-têtes = `<button aria-label={t.sortBy(label)}>` avec `aria-sort` sur le `th` ; colonne « Utilisé dans » = bouton `t.usage(pages, projects)` ⇒ `onUsages(row)` (désactivé si `pages === 0`). `ComponentsPage.tsx` : `h1` + sous-titre + bouton « Créer un composant » (`CreateComponentDialog target={null}` monté par la page, `onAdded` ⇒ `reload`), état `query`, `rows = filterComponents(componentRows(…), query)`, état `usages: ComponentRow | null` ⇒ `UsagesSheet`.
Run: `bun test packages/ui/src/components-page` — Expected: PASS.

- [x] **Step 3: Volet « Utilisé dans » (test rouge puis vert)**

```tsx
test("the usages sheet lists project › page and opens the page", async () => {
  const opened: TabTarget[] = [];
  render(<ComponentsPage onOpen={(t) => opened.push(t)} onCreate={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "2 pages · 1 projet" }));
  const sheet = screen.getByRole("dialog", { name: "Utilisé dans" });
  expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(["Kibo › Tableau de bord", "Kibo › Sprint"]);
  fireEvent.click(within(sheet).getByRole("button", { name: "Kibo › Sprint" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p1", pageId: "page-sprint" }]);
});
```
`UsagesSheet.tsx` : `Sheet` côté droit, titre `t.usagesTitle`, sous-titre « Kanban 1.0.0 », liste dédoublonnée par `projectId/pageId` (une instance par ligne sinon), tri projet puis page ; `PublishSections.tsx:45` : le texte devient un bouton qui ouvre le même volet (prop `onUsages`). `ScreenView.tsx` : `<ComponentsPage onOpen={(t) => onOpen(t)} onCreate=… />` (prop `onOpen` ajoutée à `ScreenView`, passée par `Shell` : `go`).
Run: `bun test packages/ui && bun run budget` — Expected: PASS ; budget noté (inchangé : tout est dans le chunk de la page).

- [x] **Step 4: Gate et commits**

```bash
git add packages/ui/src/components-page/filter-components.ts packages/ui/src/components-page/filter-components.test.ts packages/ui/src/i18n/fr-components-list.ts
git commit -m "feat(ui): filtre et tri des composants"
git add packages/ui/src/components-page/ComponentsFilters.tsx packages/ui/src/components-page/UsagesSheet.tsx packages/ui/src/components-page/ComponentsPage.tsx packages/ui/src/components-page/ComponentsTable.tsx packages/ui/src/components-page/PublishSections.tsx packages/ui/src/components-page/components-page.test.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/Shell.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): page Composants lisible et filtrable"
```

---

### Task 35: Composants : confirmations, vocabulaire, Marketplace vide, Sources

Vague 2 ← T30 (`refreshMarketSource`), T34 (`ComponentsPage` remaniée). Spec §15.2, marketplace D47 ; écrans **117** et **118**. Confirmations (désinstaller, bloquer, retirer une source), vocabulaire (« Isolé », « Vérifier le code », « Bloquer ce composant », « Version du catalogue », « ko »), identifiants et empreintes dans « Détails », état vide de la Marketplace avec « Ajouter une source » sur place, « Sources de composants » clarifiée avec rafraîchissement par ligne, menu ⋯ absent (pas désactivé) pour un intégré.

**Files:**
- Modify: `packages/ui/src/components-page/ComponentRowMenu.tsx`, `MarketCard.tsx`, `MarketplaceTab.tsx`, `ComponentsTable.tsx` (menu absent pour `builtin`), `components-page.test.tsx`, `marketplace.test.tsx`, `packages/ui/src/settings/ComponentSourcesPage.tsx`, `SourceRow.tsx`, `sources.test.tsx`, `SettingsNav.tsx` (libellé), `packages/ui/src/i18n/fr-market.ts`, `fr-components.ts`, `packages/ui/src/lib/fingerprint.ts` (inchangé), `packages/ui/src/components-page/DraftsSection.tsx` (texte `draftPending`), `packages/ui/src/dialogs/AddSourceDialog.tsx` (aucun changement attendu : réutilisé)

**Interfaces:**
- Consumes: `ConfirmDialog`, `Collapsible`, `refreshMarketSource`, `removeMarketSource`, `uninstallComponent`, `revokeComponent`, `AddSourceDialog`, `describeError`/`marketErrorText`.
- Produces: rien de partagé (textes et composants de la page).

- [x] **Step 1: Confirmations du menu d'un composant (tests rouges puis verts, écran 117)**

`components-page.test.tsx`, test « D3: rehash, revoke and uninstall from the ⋯ menu » adapté :
```tsx
test("blocking and uninstalling ask for confirmation, Escape sends nothing, an error stays in the dialog", async () => {
  components = [meteoSummary];
  render(<ComponentsPage onOpen={() => {}} onCreate={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Actions pour Météo 1.2.0" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Bloquer ce composant…" }));
  const dialog = screen.getByRole("alertdialog", { name: "Bloquer Météo 1.2.0 ?" });
  expect(within(dialog).getByText(/n'affichent plus rien/)).toBeTruthy();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(calls.filter((c) => c.method === "revokeComponent")).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Actions pour Météo 1.2.0" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Désinstaller…" }));
  action = () => Promise.reject(new KiboError("CONFLICT", "used"));
  fireEvent.click(screen.getByRole("button", { name: "Désinstaller" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});
test("a built-in component has no ⋯ button at all", () => { /* queryByRole("button", { name: "Actions pour Kanban 1.0.0" }) ⇒ null */ });
```
(`ConfirmDialog` du SDK rend un `AlertDialog` : vérifier le rôle dans `confirm-dialog.test.tsx`.) `ComponentRowMenu.tsx` : entrées `t.rehash` (« Vérifier le code »), `t.revoke` (« Bloquer ce composant… ») ⇒ `ConfirmDialog` (`title: t.revokeTitle(title, version)`, `description: t.revokeHelp`), `t.uninstall` (« Désinstaller… ») ⇒ `ConfirmDialog` (`t.uninstallTitle`, `t.uninstallHelp` : « Le composant est retiré de ton workspace. Il n'est posé sur aucune page. »), `describeError: marketErrorText` ; `ComponentsTable.tsx` : `row.builtin ? null : <ComponentRowMenu …/>`. `fr-components.ts` : `trust.sandboxed: "Isolé"`, `trust.sandboxedHelp`, `rehash: "Vérifier le code"`, `revoke: "Bloquer ce composant…"`, `revokeTitle`, `revokeHelp`, `uninstall: "Désinstaller…"`, `uninstallTitle`, `uninstallHelp`, `draftPending: (id) => "À valider : lance les tests du composant (commande dans Détails)"` + `draftCommand: (id) => \`kibo component test ${id}\`` affichée dans un `Collapsible` « Détails » de `DraftsSection`.
Run: `bun test packages/ui/src/components-page` — Expected: PASS.

- [x] **Step 2: Marketplace : état vide, carte sans identifiant (tests rouges puis verts)**

`marketplace.test.tsx` : « without any source the tab explains… » devient : texte « Aucune source de composants », bouton « Ajouter une source » ouvre `AddSourceDialog` (dialogue « Ajouter une source » visible), lien « Gérer les sources » cible `#/settings/components` ; « cards show… » : `hit.id` absent du texte visible, présent sous « Détails » (`Collapsible` fermé : `screen.getByText("meteo")` absent avant clic sur « Détails », présent après). `MarketplaceTab.tsx` : `EmptySources` avec le dialogue (prop `remote` : bouton absent à distance, texte `t.localOnly`) ; `MarketCard.tsx` : `Collapsible` « Détails » (id, empreinte `hashText`). `fr-market.ts` : `noSource` réécrit, `noSourceHelp`, `addSource`, `manageSources`, `details`, `serial: "Version du catalogue"`, `published: (serial) => \`Publié · version du catalogue ${serial}\``, `ko` ⇒ « ko », `dialog.found` ⇒ « version du catalogue n° … ».
Run: `bun test packages/ui/src/components-page` — Expected: PASS.

- [x] **Step 3: Sources : titre, rafraîchir par ligne, retrait confirmé (tests rouges puis verts, écran 118)**

`sources.test.tsx` : « refreshing asks the daemon… » ⇒ `refreshMarketSource { id }` pour une ligne et `refreshMarket` pour « Tout rafraîchir » ; « removing a source shows that it is waiting » ⇒ un `ConfirmDialog` « Retirer la source Galadrim ? » avec le texte sur les éditeurs reconnus, puis `removeMarketSource` ; `h1` « Sources de composants » et sous-titre ; colonne « Version du catalogue ». `ComponentSourcesPage.tsx` : `requestOf("refresh", id)` ⇒ `{ method: "refreshMarketSource", id }`, bouton d'en-tête « Tout rafraîchir » ⇒ `refreshMarket` ; `SourceRow.tsx` : `ConfirmDialog` sur « Retirer… » ; `SettingsNav.tsx` : l'entrée « Composants » devient « Sources de composants » ; `fr-market.ts › marketSources` : `title`, `subtitle`, `refreshOne`, `refreshAll`, `removeTitle(name)`, `removeHelp`.
Run: `bun test packages/ui/src/settings/sources.test.tsx packages/ui/src/settings/settings-nav.test.tsx` (si présent) — Expected: PASS.

- [x] **Step 4: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget && grep -rn "Sandboxé\|Revérifier\|Retirer la confiance\|Index n°" packages/ui/src` — Expected: PASS, aucune occurrence.

```bash
git add packages/ui/src/components-page/ComponentRowMenu.tsx packages/ui/src/components-page/ComponentsTable.tsx packages/ui/src/components-page/DraftsSection.tsx packages/ui/src/components-page/components-page.test.tsx packages/ui/src/i18n/fr-components.ts
git commit -m "feat(ui): confirmations et vocabulaire des composants"
git add packages/ui/src/components-page/MarketplaceTab.tsx packages/ui/src/components-page/MarketCard.tsx packages/ui/src/components-page/marketplace.test.tsx packages/ui/src/settings/ComponentSourcesPage.tsx packages/ui/src/settings/SourceRow.tsx packages/ui/src/settings/sources.test.tsx packages/ui/src/settings/SettingsNav.tsx packages/ui/src/i18n/fr-market.ts
git commit -m "feat(ui): marketplace vide et sources clarifiées"
```

---

### Task 36: Synchronisation : écran réécrit, appareils, projets partagés

Vague 1 ← T29. Spec §15.2 ; écrans **119** et **120**. UI seule, aucune RPC nouvelle : état vide pédagogique avec deux chemins, dialogue de connexion réorganisé (certificat dans « Options avancées », aide des codes), « Ajouter un appareil » complet (code, adresse, étapes), révocation confirmée, cartes serveur et compte sans identifiant brut, projets partagés avec actions qui réutilisent `ShareProjectDialog` et `DeleteProjectDialog`.

**Files:**
- Create: `packages/ui/src/settings/SyncEmptyState.tsx`, `packages/ui/src/i18n/fr-sync-page.ts`
- Modify: `packages/ui/src/settings/SyncSettingsPage.tsx`, `SyncServerCards.tsx`, `SyncDevicesCard.tsx`, `SyncProjectsCard.tsx`, `sync-settings.test.tsx`, `packages/ui/src/dialogs/ConnectServerDialog.tsx`, `AddDeviceDialog.tsx`, `packages/ui/src/i18n/fr-collab.ts` (titre « Synchronisation », `connectErrors` inchangés), `packages/ui/src/tabs/screens.ts` (titre de l'écran `sync`), `packages/ui/src/settings/SettingsNav.tsx` (libellé), `packages/ui/src/shell/ScreenView.tsx` (`SyncSettingsPage` reçoit `onOpen`, `onShare`, `onDeleteProject`), `packages/ui/scripts/bundle-report.ts` (`SyncEmptyState`, `fr-sync-page.ts`)

**Interfaces:**
- Consumes: `getSyncStatus`, `addDevice`, `revokeDevice`, `connectSyncServer`, `ConfirmDialog`, `Collapsible`, `CopyButton` (déjà dans `AddDeviceDialog`), `ShareProjectDialog` (via `ShellDialogs.share`), `DeleteProjectDialog` (via `ShellDialogs.deleteProject`), `projects: ProjectSummary[]`.
- Produces: `SyncEmptyState`, `ConnectServerDialog.mode`, `SyncProjectsCard` props (contrat).

- [x] **Step 1: État vide et dialogue de connexion (tests rouges puis verts, écrans 119 et 120)**

`sync-settings.test.tsx` :
```tsx
test("screen 119: the empty state explains, links to the docs, and offers both paths", async () => {
  results.getSyncStatus = async () => ({ ...status, state: "unconfigured" });
  render(<SyncSettingsPage viewer="adam" projects={[]} remote={false} onOpen={() => {}} onShare={() => {}} onDeleteProject={() => {}} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Synchronisation" })).toBeTruthy();
  expect(screen.getByText(/Partage tes projets entre tes appareils/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Comment en installer un" }).getAttribute("href")).toContain("kibo-sync");
  fireEvent.click(screen.getByRole("button", { name: "Entrer le code" }));
  const dialog = screen.getByRole("dialog", { name: "Se connecter à un serveur" });
  expect(within(dialog).getByText(/Ajouter un appareil/)).toBeTruthy();
  expect(within(dialog).queryByLabelText(/Certificat/)).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Options avancées" }));
  expect(within(dialog).getByLabelText(/Certificat racine/)).toBeTruthy();
  expect(within(dialog).getByText(/commence par wss:\/\//)).toBeTruthy();
});
```
`SyncEmptyState.tsx` : deux `Card` (titres, aides, boutons), lien `https://github.com/adbenmc-galadrim/Kibo/tree/main/docs` (A8), `remote` ⇒ boutons absents et `t.localOnly`. `ConnectServerDialog.tsx` : prop `mode: "server" | "device"` (texte d'aide sous le champ « Code » : `t.codeHelpServer` / `t.codeHelpDevice`), champ « Adresse du serveur » avec aide, `Collapsible` « Options avancées » autour du certificat. `fr-sync-page.ts` : textes de l'écran 119 ; `fr-collab.ts` : `title: "Synchronisation"`, `codeHelpServer`, `codeHelpDevice`, `urlHelp`, `advanced`.
Run: `bun test packages/ui/src/settings/sync-settings.test.tsx` — Expected: PASS.

- [x] **Step 2: Ajouter un appareil, révocation confirmée, cartes sans identifiant brut (tests rouges puis verts)**

Tests : « adding a device shows the code once… » gagne : l'adresse du serveur (`status.serverUrl` sans le schéma `wss://`), un bouton « Copier » pour chaque, trois étapes numérotées ; « revoking another device… » ⇒ `ConfirmDialog` « Révoquer PC maison ? » puis `revokeDevice` ; nouveau test : « the server and account cards fold the raw url and id under Détails » (texte `sync.galadrim.fr` visible, `wss://sync.galadrim.fr` et `user.id` seulement après ouverture de « Détails »). `AddDeviceDialog.tsx` : reçoit `serverUrl` ; `SyncDevicesCard.tsx` : état `revoking: DeviceInfo | null` + `ConfirmDialog` ; `SyncServerCards.tsx` : `hostOf(url)` (`new URL(url).host`), `Collapsible` « Détails ».
Run: `bun test packages/ui/src/settings/sync-settings.test.tsx` — Expected: PASS.

- [x] **Step 3: Projets partagés avec actions (tests rouges puis verts)**

```tsx
test("shared projects offer Ouvrir, Gérer le partage, and Arrêter / Quitter according to the role", async () => {
  results.getSyncStatus = async () => ({ ...status, projects: [{ projectId: "p1", name: "Kibo", role: "owner", lastSyncAt: 1, lastError: null, accessRevoked: false }, { projectId: "p2", name: "Portfolio", role: "editor", lastSyncAt: 1, lastError: null, accessRevoked: false }] });
  const opened: string[] = []; const shared: string[] = []; const deleted: string[] = [];
  render(<SyncSettingsPage viewer="adam" projects={projectsFixture} remote={false} onOpen={(id) => opened.push(id)} onShare={(id) => shared.push(id)} onDeleteProject={(id) => deleted.push(id)} />);
  const kibo = await screen.findByRole("row", { name: /Kibo/ });
  fireEvent.click(within(kibo).getByRole("button", { name: "Actions pour Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Ouvrir", "Gérer le partage…", "Arrêter le partage…"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Arrêter le partage…" }));
  expect(shared).toEqual(["p1"]);
  const portfolio = screen.getByRole("row", { name: /Portfolio/ });
  fireEvent.click(within(portfolio).getByRole("button", { name: "Actions pour Portfolio" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Ouvrir", "Gérer le partage…", "Quitter…"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Quitter…" }));
  expect(deleted).toEqual(["p2"]);
});
```
(« Arrêter le partage… » ouvre le dialogue de partage, qui porte déjà l'arrêt confirmé ; « Quitter… » ouvre `DeleteProjectDialog`, variante « Quitter le projet » de la vague 2.) `SyncProjectsCard.tsx` : menu ⋯ en données (`MenuEntry[]`), props du contrat ; `SyncSettingsPage` les reçoit de `ScreenView` (`onOpen` ⇒ `go({ kind: "project", projectId })`, `onShare` ⇒ `set({ share })`, `onDeleteProject` ⇒ `set({ deleteProject })`).
Run: `bun test packages/ui && bun run budget` — Expected: PASS ; budget noté.

- [x] **Step 4: Gate et commits**

```bash
git add packages/ui/src/settings/SyncEmptyState.tsx packages/ui/src/i18n/fr-sync-page.ts packages/ui/src/settings/SyncSettingsPage.tsx packages/ui/src/dialogs/ConnectServerDialog.tsx packages/ui/src/i18n/fr-collab.ts packages/ui/src/tabs/screens.ts packages/ui/src/settings/SettingsNav.tsx packages/ui/src/settings/sync-settings.test.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): page Synchronisation expliquée"
git add packages/ui/src/dialogs/AddDeviceDialog.tsx packages/ui/src/settings/SyncDevicesCard.tsx packages/ui/src/settings/SyncServerCards.tsx packages/ui/src/settings/SyncProjectsCard.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/settings/sync-settings.test.tsx
git commit -m "feat(ui): appareils confirmés, projets partagés actifs"
```

---

### Task 37: Agents : confirmations, historique cliquable et filtré, journal indisponible, vocabulaire

Vague 2 ← T39 (`Shell.tsx` allégé). Spec §15.2, agents §11 ; écran **121**. UI seule.

Complément (T36) : la section s'appelle « Synchronisation » ; aligner le libellé « Paramètres › Sync » restant dans `fr-share.ts` (l. 39), `share.test.tsx` et la spec `2026-09-26-kibo-sync.md` (l. 69, 72). Complément (décision lead T39, spec §15.3) : `AgentBar.tsx` / `SyncIndicator.tsx` : « connecté » ne se combine jamais avec un état de sync (`base = fr.app.name` quand `kind` n'est ni `local` ni `down`) ; `fr.sync.indicator.offline` renommé « sync hors ligne » ; adapter `sync-settings.test.tsx` et `e2e/sync.spec.ts`.

**Files:**
- Create: `packages/ui/src/agents/run-filter.ts`, `run-filter.test.ts`, `RunHistory.tsx`, `permission-mode.ts`, `permission-mode.test.ts`
- Modify: `packages/ui/src/agents/AgentsPage.tsx`, `agents-page.test.tsx`, `AgentDrawer.tsx`, `AgentPanel.tsx`, `agent-panel.test.tsx`, `RunJournal.tsx`, `run-journal.test.tsx`, `QueuePage.tsx`, `QueueItem.tsx`, `queue-page.test.tsx`, `ProfileSheet.tsx`, `profile-sheet.test.tsx` (ou `agents-page.test.tsx`), `AgentBar.tsx` (texte « Kibo · connecté » : **si T39 ne l'a pas déjà fait** ; sinon rien), `packages/ui/src/state/use-agents.ts`, `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/i18n/fr.ts` (`agents`, `queue`, `agentsPage`, `profile`)

**Interfaces:**
- Consumes: `AgentsState`, `RunView`, `runSubject`, `isTerminal`, `getRunLog`, `cancelRun`, `config deleteProfile`, `ConfirmDialog`, `ToggleGroup`, `Input`, `focusRun` (`onAnswer` de `ScreenView`).
- Produces: contrat « UI » (T37) : `filterRuns`, `AgentsPage.onOpenRun`, `useRunLog(): { log, missing }`, `RunJournal.missing`, `permissionModeLabel`.

- [x] **Step 1: Filtre pur et libellés (tests rouges puis verts)**

`run-filter.test.ts` : `filterRuns(runs, "all", "")` trié par `seq` décroissant ; `"failed"` ne garde que `failed` ; `"waiting"` = `waiting_input` ; `"done"` = `done` ; `"cancelled"` ; `query "kib-1"` garde `KIB-1`, `KIB-12` (préfixe insensible à la casse, sur `ticketKey`). `permission-mode.test.ts` : `plan` ⇒ « Lecture seule (plan) », `acceptEdits` ⇒ « Modifications acceptées », `default` ⇒ « Demande à chaque action ». Implémenter.
Run: `bun test packages/ui/src/agents/run-filter.test.ts packages/ui/src/agents/permission-mode.test.ts` — Expected: PASS.

- [x] **Step 2: Historique cliquable et filtré (tests rouges puis verts, écran 121)**

`agents-page.test.tsx` :
```tsx
test("screen 121: a history line opens the run, the filter and the key search narrow it", () => {
  const opened: string[] = [];
  render(<AgentsPage state={agentsFixture()} config={configFixture()} now={NOW} onOpenRun={(id) => opened.push(id)} />);
  expect(screen.getByText("Un run est le travail d'un agent sur un ticket.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /sonnet-review · KIB-11/ }));
  expect(opened).toEqual([runId("KIB-11")]);
  fireEvent.click(screen.getByRole("radio", { name: "En échec" }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(screen.getByRole("searchbox", { name: "Clé du ticket" }), { target: { value: "KIB-9" } });
  expect(screen.getByRole("row", { name: /KIB-9/ })).toBeTruthy();
  expect(screen.getByText("2 places sur 3")).toBeTruthy();
});
```
`RunHistory.tsx` (sorti d'`AgentsPage.tsx` pour la taille) : `ToggleGroup` + `Input type="search"` + table dont chaque ligne contient un bouton plein (`aria-label = \`${profile} · ${runSubject(run)}\``) ; `AgentsPage` : prop `onOpenRun`, sous-titre, cartes « places ». `ScreenView.tsx` : `onOpenRun={onAnswer}`. `fr.ts` : `agentsPage.subtitle`, `agentsPage.stats.slots: (used, total) => \`${used} place${used > 1 ? "s" : ""} sur ${total}\``, `agentsPage.filters.*`, `agentsPage.searchKey`, `agentsPage.stats.tokensHelp`, `queue.capacityHelp` et `hostSlots` sans « créneau », `agents.groups.*`, `agents.reasons.*`, `agents.reply.hint: "Reprend la session"`, `agents.events.resumed: "reprise de la session"`, `profile.cli: "Claude Code en ligne de commande"`, `profile.neverBypass: "Les permissions ne sont jamais contournées."` ; `AgentsPage.ProfileCard` et `ProfileSheet` affichent `permissionModeLabel(mode)`.
Run: `bun test packages/ui/src/agents/agents-page.test.tsx` — Expected: PASS.

- [x] **Step 3: Journal indisponible (tests rouges puis verts)**

`agent-panel.test.tsx` : avec `getRunLog` qui rejette `NOT_FOUND`, le tiroir affiche « Journal indisponible pour ce run. » et aucune erreur n'est relancée ; avec `[]`, même texte. `use-agents.ts` : `useRunLog(runId): { log: RunLogEntry[] | null; missing: boolean }` (`missing = NOT_FOUND || log.length === 0`, toute autre erreur relancée comme avant) ; `AgentPanel` passe `log` et `missing` à `AgentDrawer` → `RunJournal missing` ⇒ `<p>` (`fr.agents.journalMissing`). `run-journal.test.tsx` : test de l'état.
Run: `bun test packages/ui/src/agents` — Expected: PASS.

- [x] **Step 4: Confirmations (tests rouges puis verts)**

`agent-panel.test.tsx` « stopping a run cancels it… » ⇒ `ConfirmDialog` « Arrêter le run opus-dev-2 sur KIB-14 ? » (texte « L'agent est interrompu ; le ticket reste assigné. ») puis `cancelRun` ; `queue-page.test.tsx` « the item menu moves, prioritizes and removes queued runs » ⇒ « Retirer KIB-18 de la file ? » puis `cancelRun` ; test de `ProfileSheet` « Supprimer le profil opus-dev ? » (« Ses runs passés restent dans l'historique. ») puis `deleteProfile` ; `PROFILE_IN_USE` affiché dans le dialogue. `fr.ts` : `agents.stopTitle(profile, key)`, `stopHelp`, `queue.cancelTitle(key)`, `queue.cancelHelp`, `profile.deleteTitle(name)`, `profile.deleteHelp`.
Run: `bun test packages/ui && bun run budget && grep -rn "créneau\|--resume\|claude -p\|dangerously" packages/ui/src/i18n` — Expected: PASS, aucune occurrence (hors `fr-ai.ts` si elle cite une commande dans un bloc « Détails »).

- [x] **Step 5: Gate et commits**

```bash
git add packages/ui/src/agents/run-filter.ts packages/ui/src/agents/run-filter.test.ts packages/ui/src/agents/permission-mode.ts packages/ui/src/agents/permission-mode.test.ts packages/ui/src/agents/RunHistory.tsx packages/ui/src/agents/AgentsPage.tsx packages/ui/src/agents/agents-page.test.tsx packages/ui/src/agents/ProfileSheet.tsx packages/ui/src/shell/ScreenView.tsx packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): historique des runs cliquable et filtré"
git add packages/ui/src/state/use-agents.ts packages/ui/src/agents/AgentPanel.tsx packages/ui/src/agents/AgentDrawer.tsx packages/ui/src/agents/RunJournal.tsx packages/ui/src/agents/run-journal.test.tsx packages/ui/src/agents/agent-panel.test.tsx packages/ui/src/agents/QueuePage.tsx packages/ui/src/agents/QueueItem.tsx packages/ui/src/agents/queue-page.test.tsx <test ProfileSheet>
git commit -m "feat(ui): confirmations et journal des agents"
```

---

### Task 38: Code : libellés git en toutes lettres, publication de la branche, raccourcis par plateforme

Vague 1 ← T29. Spec §15.2, code §12.8 ; écran **122**. UI seule ; les E2E qui citent « Indexer » sont mis à jour dans la même tâche.

**Files:**
- Modify: `packages/ui/src/i18n/fr-code.ts`, `packages/ui/src/code/FileList.tsx`, `file-menu.ts`, `file-menu.test.ts`, `PushActions.tsx`, `CommitPanel.tsx`, `commit.test.tsx`, `code/*.test.tsx` touchés par les libellés (`grep -rln "Indexer\|Indexés\|Non indexés\|git push" packages/ui/src`), `packages/ui/src/palette/CommandPalette.tsx`, `palette/command-palette.test.tsx` (si présent), `packages/ui/src/files/FilePreviewSheet.tsx` (`hints`), `packages/ui/src/settings/shortcuts.ts` (inchangé, vérifier la cohérence), `e2e/*.spec.ts` (`grep -rln "Indexer\|Désindexer\|Indexés" e2e/`)

**Interfaces:**
- Consumes: `shortcutLabel`, `isMac`, `Collapsible`.
- Produces: `fr-code.ts` : `changes.kind` en mots, `staged`/`unstaged`, `stage`/`unstage`/`stageAll`/`unstageAll` renommés, `commit.pushing(branch, remote)`, `file.hints(mac)`.

- [x] **Step 1: Libellés (tests rouges puis verts, écran 122)**

Adapter d'abord les tests : `file-menu.test.ts` attend « Ajouter au commit » / « Retirer du commit » ; le test de `FileList` attend `screen.getByText("Modifié")` (plus de lettre `aria-hidden`) et les titres « Dans le prochain commit (2) » / « Modifications (3) » ; `commit.test.tsx` attend `kbd` « ⌘↵ » sur Mac et « Ctrl+↵ » ailleurs (`isMac` simulé par `Object.defineProperty(navigator, "platform", …)` comme dans `shortcut-label.test.ts`) ; test de `PushActions` : pendant le push, « Publication de la branche kib-12 sur origin… » visible et `git push -u origin kib-12` seulement sous « Détails ». Puis le code : `fr-code.ts` (`kind: { modified: "Modifié", added: "Ajouté", deleted: "Supprimé", renamed: "Renommé", untracked: "Ajouté", conflicted: "Conflit" }`, `kindLabel` fusionné, `staged: "Dans le prochain commit"`, `unstaged: "Modifications"`, `stage: "Ajouter au commit"`, `unstage: "Retirer du commit"`, `stageAll: "Tout ajouter"`, `unstageAll: "Tout retirer"`, `commit.pushing`, `file.hints: (mac) => \`${shortcutLabel(["Shift", "O"], mac)} ouvrir dans l'éditeur externe · Esc fermer\``), `FileList.tsx` (badge texte `text-2xs` à la place de la lettre), `PushActions.tsx` (`PushProgress` reçoit `title` et `command` dans un `Collapsible`), `CommitPanel.tsx` et `CommandPalette.tsx` (`shortcutLabel(["↵"], isMac())`), `FilePreviewSheet.tsx` (`fr.file.hints(isMac())`).
Run: `bun test packages/ui/src/code packages/ui/src/palette packages/ui/src/files` — Expected: PASS.

- [x] **Step 2: E2E alignés**

`grep -rn "Indexer\|Désindexer\|Indexés\|Non indexés\|Tout indexer" e2e/` : remplacer par les nouveaux libellés ; `cd e2e && bunx playwright test --project=code-dark --project=menus-dark` — Expected: PASS.

- [x] **Step 3: Gate et commit**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget && grep -rn "⌘" packages/ui/src --include=*.tsx --include=*.ts | grep -v "shortcut-label\|test\|fr-shortcuts"` — Expected: PASS, aucun raccourci codé en dur.

```bash
git add packages/ui/src/i18n/fr-code.ts packages/ui/src/code packages/ui/src/palette/CommandPalette.tsx packages/ui/src/files/FilePreviewSheet.tsx e2e/
git commit -m "feat(ui): vocabulaire git en toutes lettres"
```

---

### Task 39: Chargement, « Kibo ne répond pas », Shell allégé, coque sans panique

Vague 1 ← T29. Spec §15.3 ; écran **123**. L'interface n'affiche plus d'écran blanc : `App` devient une petite machine à états (temps injecté), `useProjects` expose son erreur, une frontière racine attrape le reste ; `Shell.tsx` redescend sous 300 lignes par deux extractions ; la coque remplace ses `expect` de la boucle de démarrage par un message et `exit(1)`.

**Files:**
- Modify: `packages/ui/src/App.tsx` ; Create: `packages/ui/src/app.test.tsx`, `packages/ui/src/shell/Startup.tsx`, `DaemonUnreachable.tsx`, `RootBoundary.tsx`, `startup.test.tsx`, `packages/ui/src/i18n/fr-startup.ts`
- Modify: `packages/ui/src/state/use-projects.ts`, `use-projects.test.ts` (créer si absent), `packages/ui/src/shell/Shell.tsx` ; Create: `packages/ui/src/shell/use-shell-dialogs.ts`, `shell-actions.ts`, `shell-actions.test.ts`
- Modify: `packages/ui/src/agents/AgentBar.tsx`, `agent-bar.test.tsx` (ou `agent-panel.test.tsx`), `packages/ui/src/i18n/fr.ts` (`agents.daemon`, `daemonOffline`), `packages/ui/src/main.tsx` (`RootBoundary`), `packages/ui/scripts/bundle-report.ts` (`DaemonUnreachable`, `fr-startup.ts`)
- Modify: `apps/desktop/src-tauri/src/main.rs`

**Interfaces:**
- Consumes: `client.rpc`, `client.pair`, `onUnauthorized`, `KiboError`, `inTauri()`, `PairingScreen`, `lazyPanel`.
- Produces: contrat « UI » (T39) : `App({ now, retryMs })`, `LoadingScreen`, `DaemonUnreachable`, `RootBoundary`, `useProjects(): { projects, error, retry }`, `useShellDialogs`, `paletteActionHandler`, `fileTabOpener`.

- [x] **Step 1: Démarrage (tests rouges puis verts, écran 123)**

`packages/ui/src/app.test.tsx` (mock `../api` avec `let session: () => Promise<Session>`) :
```tsx
test("a network failure shows « Kibo ne répond pas » with retry, then the shell once the daemon answers", async () => {
  session = () => Promise.reject(new TypeError("Failed to fetch"));
  const { App } = await import("./App");
  render(<App retryMs={50} />);
  expect(await screen.findByRole("heading", { name: "Kibo ne répond pas" })).toBeTruthy();
  expect(screen.getByText(/Vérifie que Kibo tourne/)).toBeTruthy();
  session = () => Promise.resolve({ user: "adam", notifications: "browser" });
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByRole("navigation", { name: "Barre latérale" })).toBeTruthy();
});
test("UNAUTHORIZED still leads to pairing; another KiboError is shown with retry; the loading text appears after 300 ms", async () => { /* … */ });
test("the automatic retry fires every retryMs while unreachable", async () => { /* compter les appels à getSession avec retryMs = 20 */ });
```
(`aria-label` réel de la barre latérale : lire `sdk/ui/sidebar.tsx` ; sinon viser « Vue d'ensemble ».) `App.tsx` : état `{ kind: "loading" } | { kind: "unreachable"; error: unknown; attempt: number } | { kind: "pairing" } | { kind: "ready"; session: Session }` ; `bootstrap` inchangé mais encadré : `UNAUTHORIZED` ⇒ `pairing`, toute autre erreur ⇒ `unreachable` ; `useEffect` de relance par `setTimeout(retryMs)` tant que `unreachable` ; `LoadingScreen` (dans `Startup.tsx`, ≤ 40 lignes, dans l'entrée) rend `null` pendant `delayMs` puis le logo et « Chargement de Kibo… » ; `DaemonUnreachable` à la demande (`lazyPanel`, `fr-startup.ts`), `inApp = inTauri()` choisit le conseil ; `RootBoundary` dans `main.tsx` autour d'`<App />`. `startup.test.tsx` : `DaemonUnreachable` rend le bon conseil selon `inApp` et appelle `onRetry`.
Run: `bun test packages/ui/src/app.test.tsx packages/ui/src/shell/startup.test.tsx` — Expected: PASS.

- [x] **Step 2: `useProjects` avec erreur, Shell qui l'affiche (tests rouges puis verts)**

`use-projects.test.ts` : `listProjects` qui rejette une `TypeError` ⇒ `{ projects: null, error: TypeError }` sans rejection non gérée ; `retry()` relance ; `UNAUTHORIZED` ⇒ `error: null` (le `onUnauthorized` global prend le relais). `Shell.tsx` : `const { projects, error, retry } = useProjects()` ; `if (error) return <DaemonUnreachable error={error} inApp={inTauri()} nextRetryInMs={0} onRetry={retry} />` ; `if (!projects || !tabs) return <LoadingScreen />`. `AgentBar.tsx` : `fr.agents.daemon: "Kibo · connecté"`, `daemonOffline: "Kibo · hors ligne"` (test adapté).
Run: `bun test packages/ui/src/state packages/ui/src/shell packages/ui/src/agents` — Expected: PASS.

- [x] **Step 3: Shell allégé (tests existants verts, aucun comportement nouveau)**

`use-shell-dialogs.ts` : `useState<DialogsState>`, `set`, `focusRun`, `setFocusRun`, `clearFocus`, `palette`, `setPalette` (contrat) ; `shell-actions.ts` : `paletteActionHandler({ set, setFocusRun, go, activeProjectId, cycleTheme })` et `fileTabOpener({ editRequests, set, go })`, fonctions pures sur leurs dépendances, testées (`shell-actions.test.ts` : `newProject` ⇒ `set({ newProject: true })`, `newTicket` sur un autre projet ⇒ `go` puis `set`, `openFileTab(ref, true)` ⇒ `editRequests` contient le hash et `go(target, true)`). `Shell.tsx` les consomme ; `wc -l` ≤ 300.
Run: `bun test packages/ui/src/shell && bun run typecheck` — Expected: PASS.

- [x] **Step 4: Coque : message et `exit(1)` au lieu de `expect` (test rouge puis vert)**

`apps/desktop/src-tauri/src/main.rs` : extraire la boucle de `CommandEvent` dans `fn handle_daemon_event(handle: &AppHandle, event: CommandEvent, state: &mut StartupState) -> Result<(), String>` ; les `expect` des lignes 153, 156, 165, 168 et 180 deviennent des `map_err(|e| format!("…: {e}"))?` ; l'appelant fait `if let Err(message) = … { eprintln!("Kibo s'est arrêté : {message}. Relance l'application."); std::process::exit(1); }` ; le cas `Terminated` affiche de même « Kibo s'est arrêté : le démon a quitté (code …) » avant `exit(1)`. Test unitaire Rust (`#[cfg(test)]`) : `parse_ready_line("KIBO_READY not a url")` renvoie `Err` au lieu de paniquer (découper la lecture de l'URL en fonction pure `parse_daemon_url(&str) -> Result<Url, String>`). `expect` conservés hors boucle : `lock().expect("daemon lock")` (poison = bug) et `.expect("cannot build the Kibo app")` (hors boucle de démarrage).
Run: `cd apps/desktop/src-tauri && ~/.cargo/bin/cargo test` — Expected: PASS (après `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts`, `bun apps/desktop/scripts/build-toolchain.ts` si le build les exige ; sinon le `desktop-smoke` de la CI fait foi).

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS ; budget noté (entrée +≈0,8 kB).

```bash
git add packages/ui/src/App.tsx packages/ui/src/app.test.tsx packages/ui/src/shell/Startup.tsx packages/ui/src/shell/DaemonUnreachable.tsx packages/ui/src/shell/RootBoundary.tsx packages/ui/src/shell/startup.test.tsx packages/ui/src/i18n/fr-startup.ts packages/ui/src/main.tsx packages/ui/src/state/use-projects.ts packages/ui/src/state/use-projects.test.ts packages/ui/src/agents/AgentBar.tsx <test AgentBar> packages/ui/src/i18n/fr.ts packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): écrans de chargement et démon injoignable"
git add packages/ui/src/shell/Shell.tsx packages/ui/src/shell/use-shell-dialogs.ts packages/ui/src/shell/shell-actions.ts packages/ui/src/shell/shell-actions.test.ts
git commit -m "refactor(ui): Shell allégé"
git add apps/desktop/src-tauri/src/main.rs
git commit -m "fix(desktop): arrêt propre si le démon meurt"
```

---

### Task 40: Aperçu, éditeur et diff : retour à la ligne, recherche, aller à la ligne, copier le chemin

Vague 1 ← T29, après T38 (`FilePreviewSheet.tsx`, `fr-code.ts`). Spec §15.3, code §12.8 ; écran **124**. Préférence par appareil par un helper partagé (`local-pref.ts`, qui absorbe les deux `withStorage`), recherche maison sur les lignes (pas de dépendance), barre d'outils commune à l'aperçu et à l'onglet fichier, bascule seule dans la vue Changements.

**Files:**
- Create: `packages/ui/src/lib/local-pref.ts`, `local-pref.test.ts`, `packages/ui/src/files/wrap-pref.ts`, `find-in-file.ts`, `find-in-file.test.ts`, `FileToolbar.tsx`, `packages/ui/src/i18n/fr-file-tools.ts`
- Modify: `packages/ui/src/theme.ts`, `packages/ui/src/shell/run-history.ts` (utilisent `local-pref`), `packages/ui/src/files/CodeLines.tsx`, `CodeEditor.tsx`, `FilePreviewSheet.tsx`, `FileTabView.tsx`, `files.test.tsx`, `packages/ui/src/code/DiffView.tsx`, `ChangesBody.tsx`, `diff-view.test.tsx` (ou le test existant), `packages/ui/scripts/bundle-report.ts` (`FileToolbar`, `fr-file-tools.ts`)

**Interfaces:**
- Consumes: `useSyncExternalStore`, `EditorView.lineWrapping`, `Compartment`, `Switch`, `Input`, `navigator.clipboard`.
- Produces: contrat « UI » (T40) : `readPref`, `writePref`, `usePref`, `useWrap`, `findMatches`, `parseGoTo`, `stepMatch`, `FileToolbar`, `CodeLines { wrap, highlight, matches }`, `CodeEditor { wrap }`, `DiffView { wrap }`.

- [x] **Step 1: Helper de préférence et recherche pure (tests rouges puis verts)**

`local-pref.test.ts` : `readPref("k", "x")` ⇒ `"x"` sans valeur ; `writePref("k", "y")` puis lecture ⇒ `"y"` ; `writePref("k", null)` efface ; un `localStorage` qui lève (simulé par `Object.defineProperty(globalThis, "localStorage", { get() { throw … } })` dans le test, restauré ensuite) ⇒ valeur par défaut, une ligne `console.error`, pas d'exception ; `usePref` suit `writePref` et l'événement `storage`. Puis `theme.ts` et `run-history.ts` réécrits sur `readPref`/`writePref` (tests existants verts, comportement identique : `removeItem` pour `system` ⇒ `writePref(KEY, null)`).

`find-in-file.test.ts` :
```ts
test("findMatches is case-insensitive, lists every occurrence in order, and is empty for an empty query", () => {
  expect(findMatches(["const Kibo = 1;", "kibo.run(); KIBO"], "kibo")).toEqual([{ line: 1, col: 7 }, { line: 2, col: 1 }, { line: 2, col: 13 }]);
  expect(findMatches(["a"], "")).toEqual([]);
});
test("parseGoTo reads :42 and nothing else; stepMatch wraps around", () => {
  expect(parseGoTo(":42")).toBe(42);
  expect(parseGoTo("42")).toBeNull();
  const s = { query: "k", matches: [{ line: 1, col: 1 }, { line: 3, col: 1 }], index: 1 };
  expect(stepMatch(s, 1).index).toBe(0);
  expect(stepMatch(s, -1).index).toBe(0);
});
```
Implémenter. Run: `bun test packages/ui/src/lib/local-pref.test.ts packages/ui/src/files/find-in-file.test.ts packages/ui/src/theme.test.ts packages/ui/src/shell/run-history.test.ts` — Expected: PASS.

- [x] **Step 2: Barre d'outils, aperçu, onglet (tests rouges puis verts, écran 124)**

`files.test.tsx` :
```tsx
test("screen 124: wrap is on by default and remembered, the search highlights and steps, :n goes to a line, the path is copied", async () => {
  const { FilePreviewSheet } = await import("./FilePreviewSheet");
  render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
  const wrap = await screen.findByRole("switch", { name: "Retour à la ligne" });
  expect(wrap.getAttribute("aria-checked")).toBe("true");
  expect(document.querySelector("code")?.className).toContain("whitespace-pre-wrap");
  fireEvent.click(wrap);
  expect(localStorage.getItem("kibo.wrap")).toBe("off");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "f", metaKey: true });
  const find = screen.getByRole("searchbox", { name: "Rechercher ou :ligne" });
  fireEvent.change(find, { target: { value: "kibo" } });
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.keyDown(find, { key: "Enter" });
  expect(screen.getByText("2 / 3")).toBeTruthy();
  fireEvent.change(find, { target: { value: ":2" } });
  expect(screen.getByText("Ligne 2 · Col 1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copier le chemin" }));
  expect(copied).toEqual(["src/app.ts"]);
});
```
(`copied` : `navigator.clipboard.writeText` remplacé dans le test par `Object.assign(navigator, { clipboard: { writeText: async (t) => { copied.push(t) } } })`.) `FileToolbar.tsx` : `Switch` + `Input type="search"` + compteur + ↑ ↓ + « Copier le chemin » ; `CodeLines.tsx` : `wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre"`, surlignage des `matches` (`<mark>` par découpe des spans de la ligne : découper le texte des jetons à la colonne, sans toucher aux couleurs shiki) et `aria-current` sur l'occurrence courante avec `scrollIntoView` ; `CodeEditor.tsx` : compartiment `wrapping` reconfiguré sur la prop ; `FilePreviewSheet.tsx` et `FileTabView.tsx` : état `find`, raccourci ⌘/Ctrl+F dans le volet (`onKeyDown` du conteneur), pied `fr.file.position(currentLine, col)` où `currentLine = fileRef.line ?? find courant ?? 1`.
Run: `bun test packages/ui/src/files` — Expected: PASS.

- [x] **Step 3: Diff (test rouge puis vert)**

Test de `DiffView` : `wrap={false}` ⇒ `whitespace-pre`, `wrap={true}` ⇒ `whitespace-pre-wrap` ; `ChangesBody.tsx` : `const [wrap, setWrap] = useWrap()` et un `Switch` « Retour à la ligne » dans l'en-tête du diff.
Run: `bun test packages/ui/src/code && bun run budget` — Expected: PASS ; budget noté.

- [x] **Step 4: Gate et commits**

```bash
git add packages/ui/src/lib/local-pref.ts packages/ui/src/lib/local-pref.test.ts packages/ui/src/theme.ts packages/ui/src/shell/run-history.ts
git commit -m "refactor(ui): préférences locales partagées"
git add packages/ui/src/files packages/ui/src/i18n/fr-file-tools.ts packages/ui/src/code/DiffView.tsx packages/ui/src/code/ChangesBody.tsx <test diff> packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): retour à la ligne et recherche dans un fichier"
```

---

### Task 41: Largeurs adaptatives, fil d'Ariane cliquable, mineures

Vague 2 ← T32 (`ShellHeader.tsx`), T40 (`ChangesBody.tsx`), T38. Spec §15.3 ; écran **112 amendé**. Une mise en page de Paramètres partagée, une mise en page de Changements pure, des largeurs en `min(90vw, …)`, un fil d'Ariane qui ouvre, et les mineures restantes : `tabIndex={-1}` et libellé « Image » visible, un seul `role="alert"` à la fois dans « Modifier le projet », coche ✓ du sous-menu Thème, test de la page Workspace sans double `mock.module`, tri de Composants › Installés mémorisé via `lib/local-pref.ts` (décision 5, raccord T34 ← T40, avec test « tri conservé après remontage »), `placesOf` du volet « Utilisé dans » trié par projet puis page, pastille de la carte projet en `items-start` quand le chemin passe sur plusieurs lignes.

**Files:**
- Create: `packages/ui/src/settings/SettingsLayout.tsx`, `settings-layout.test.tsx`, `packages/ui/src/code/ChangesLayout.tsx`, `changes-layout.test.tsx`, `packages/ui/src/shell/breadcrumb.test.tsx`
- Modify: les 9 pages `packages/ui/src/settings/*Page.tsx` (`grid min-h-full grid-cols-[14rem_1fr]` ⇒ `SettingsLayout`), `SettingsNav.tsx`, `packages/ui/src/shell/TicketSheet.tsx`, `packages/ui/src/shell/sheet/CiLogSheet.tsx`, `packages/ui/src/code/ChangesBody.tsx`, `packages/ui/src/shell/Breadcrumb.tsx`, `ShellHeader.tsx`, `packages/ui/src/dialogs/IconField.tsx`, `icon-field.test.tsx`, `FolderField.tsx`, `EditProjectDialog.tsx`, `edit-project-dialog.test.tsx`, `packages/ui/src/settings/workspace-page.test.tsx`, `packages/sdk/src/ui/dropdown-menu.tsx`, `packages/ui/src/shell/user-menu.test.tsx`, `packages/ui/src/i18n/fr-fields.ts`

**Interfaces:**
- Consumes: `SettingsNav`, `Collapsible`, `targetToHash`, `TabTarget`, `onOpen` de `ShellHeader`.
- Produces: contrat « UI » (T41) : `SettingsLayout`, `ChangesLayout`, `Breadcrumb { crumbs: Crumb[] }`, `crumbsFor(): Crumb[]`.

- [ ] **Step 1: Mises en page (tests rouges puis verts)**

`settings-layout.test.tsx` : le conteneur porte `md:grid-cols-[14rem_1fr]` et pas `grid-cols-[14rem_1fr]` ; la navigation est rendue avant le contenu. `changes-layout.test.tsx` : le conteneur porte `lg:grid-cols-[272px_minmax(0,1fr)_340px]`, les trois zones sont rendues, la liste des fichiers est dans un `Collapsible` ouvert par défaut avec un bouton `filesTitle` (visible sous `lg` : classe `lg:hidden`). Puis : les 9 pages utilisent `<SettingsLayout active="…">`, `ChangesBody.tsx` rend `<ChangesLayout files=… diff=… commit=… filesTitle={fr.changes.files(n)} />` (reste ≤ 300 lignes), `TicketSheet.tsx` : `w-full sm:max-w-[min(90vw,560px)]`, `CiLogSheet.tsx` : `w-full sm:max-w-[min(90vw,720px)]` (tests existants : adapter les attentes de classes s'il y en a).
Run: `bun test packages/ui/src/settings packages/ui/src/code packages/ui/src/shell` — Expected: PASS.

- [ ] **Step 2: Fil d'Ariane cliquable (tests rouges puis verts)**

`breadcrumb.test.tsx` :
```tsx
test("intermediate crumbs open their target; the last one is plain text", () => {
  const opened: TabTarget[] = [];
  render(<Breadcrumb crumbs={[{ label: "Kibo", target: { kind: "project", projectId: "p1" } }, { label: "KIB-12", target: null }]} onOpen={(t) => opened.push(t)} />);
  fireEvent.click(screen.getByRole("button", { name: "Kibo" }));
  expect(opened).toEqual([{ kind: "project", projectId: "p1" }]);
  expect(screen.queryByRole("button", { name: "KIB-12" })).toBeNull();
});
test("crumbsFor gives a project target to the project crumb and a page target to the page crumb", () => { /* … */ });
```
`Breadcrumb.tsx` : `Crumb = { label: string; target: TabTarget | null }`, prop `onOpen` ; `crumbsFor(target, ctx)` renvoie des cibles (écran : `null` ; projet : `{ kind: "project" }` pour le premier élément ; page : projet puis `null` ; ticket : projet puis `null` ; fichier : projet, changes, `null`) ; `ShellHeader.tsx` passe `onOpen`.
Run: `bun test packages/ui/src/shell` — Expected: PASS.

- [ ] **Step 3: Mineures (tests rouges puis verts)**

- `icon-field.test.tsx` : l'`input[type=file]` a `tabIndex -1` ; un libellé « Image » visible (`<Label>` lié au bouton « Choisir une image… » par `aria-describedby`, ou un `<p>` titre du champ : `screen.getByText("Image")`). `IconField.tsx` et `fr-fields.ts` (`icon.label: "Image"`).
- `edit-project-dialog.test.tsx` : avec une erreur de sélecteur de dossier **et** une erreur de soumission, un seul `role="alert"` est rendu (la plus récente ; les champs remontent leur erreur par `onError(message)` au dialogue, qui la fusionne) ; `FolderField` et `IconField` gagnent `onError?` et n'affichent leur `<p role="alert">` que sans `onError`.
- `workspace-page.test.tsx` : remplacer le second `mock.module` (l. 87-93) par `let rpcOutcome: (req) => Promise<unknown>` réassignée dans le test.
- `sdk/ui/dropdown-menu.tsx` : `DropdownMenuRadioItem` rend `CheckIcon` au lieu de `CircleIcon` ; `user-menu.test.tsx` : l'item coché contient un `svg.lucide-check`.
Run: `bun test packages/ui packages/sdk && bun run budget` — Expected: PASS ; budget noté (+≈0,3 kB).

- [ ] **Step 4: Gate et commits**

```bash
git add packages/ui/src/settings packages/ui/src/code/ChangesLayout.tsx packages/ui/src/code/changes-layout.test.tsx packages/ui/src/code/ChangesBody.tsx packages/ui/src/shell/TicketSheet.tsx packages/ui/src/shell/sheet/CiLogSheet.tsx
git commit -m "feat(ui): largeurs adaptatives"
git add packages/ui/src/shell/Breadcrumb.tsx packages/ui/src/shell/breadcrumb.test.tsx packages/ui/src/shell/ShellHeader.tsx
git commit -m "feat(ui): fil d'Ariane cliquable"
git add packages/ui/src/dialogs/IconField.tsx packages/ui/src/dialogs/icon-field.test.tsx packages/ui/src/dialogs/FolderField.tsx packages/ui/src/dialogs/EditProjectDialog.tsx packages/ui/src/dialogs/edit-project-dialog.test.tsx packages/ui/src/settings/workspace-page.test.tsx packages/sdk/src/ui/dropdown-menu.tsx packages/ui/src/shell/user-menu.test.tsx packages/ui/src/i18n/fr-fields.ts
git commit -m "fix(ui): mineures des champs et du menu Thème"
```

---

### Task 42: Arbre Tickets : état vide, chargement, recherche et filtres ; Notes : tri et dossiers

Vague 1 ← T29, T30 (`notes.create` déjà posé). Spec §15.3, composants §16.3 et §16.4 ; écran **125**. Côté composants intégrés, sur le SDK public (dogfooding), avec la suite de conformité.

**Files:**
- Create: `components/tickets/src/filter-tickets.ts`, `filter-tickets.test.ts`, `TicketsToolbar.tsx`, `TicketsEmpty.tsx` ; Modify: `components/tickets/src/TicketsTree.tsx`, `TicketRow.tsx` (prop `hidden`/`dimmed` si nécessaire), `fr.ts`, `tickets.test.tsx`
- Create: `components/notes/src/note-sort.ts`, `note-sort.test.ts` ; Modify: `components/notes/src/NoteList.tsx`, `NotesView.tsx` (prop `sort`), `fr.ts`, `notes.test.tsx`

**Interfaces:**
- Consumes: `useEntities("ticket")`, `useSdk().viewer`, `useReadOnly`, `Skeleton`, `Input`, `ToggleGroup`, `Select`, `Collapsible`, `NoteMeta`, `window.localStorage`.
- Produces: contrat « Composants intégrés » (T42) : `filterTickets`, `TicketsQuery`, `groupNotes`, `NoteSort`.

- [x] **Step 1: Filtre pur de l'arbre (tests rouges puis verts)**

`filter-tickets.test.ts` :
```ts
test("a matching child keeps its ancestors visible; statuses and assignee combine; accents are ignored", () => {
  const visible = filterTickets(tickets, { ...EMPTY_QUERY, text: "schema" }, "adam");
  expect([...visible].map(keyOf).sort()).toEqual(["KIB-12", "KIB-3"]);
  expect(filterTickets(tickets, { ...EMPTY_QUERY, assignee: "me" }, "adam").size).toBe(countAssignedTo("adam") + ancestorsCount);
  expect(filterTickets(tickets, { ...EMPTY_QUERY, statuses: new Set(["done"]), assignee: "agents" }, "adam").size).toBe(0);
  expect(isActive(EMPTY_QUERY)).toBe(false);
});
```
(Fixtures : le jeu `design/donnees-fictives.md` déjà encodé dans `tickets.test.tsx`, à extraire dans `fixtures.ts` du composant s'il n'y est pas.) Implémenter (`normalize` comme T34 ; `agents` = `assignee?.kind === "agent"`, `nobody` = `assignee === null`).
Run: `bun test components/tickets/src/filter-tickets.test.ts` — Expected: PASS.

- [x] **Step 2: Barre, état vide, squelette (tests rouges puis verts, écran 125)**

`tickets.test.tsx` :
```tsx
test("screen 125: search and filters narrow the tree, drag is disabled meanwhile, clearing restores", async () => { /* champ « Rechercher (clé ou titre) », ToggleGroup « Assigné », sélecteur « Statut » ; les lignes masquées ne sont pas rendues ; aucun attribut draggable pendant un filtre ; « Effacer » */ });
test("the empty state explains the tree and offers a new ticket; a loading snapshot shows a skeleton", async () => { /* createMockSdk sans tickets ⇒ texte et bouton (openNewTicket enregistré) ; état loading ⇒ 5 `[data-slot=skeleton]` */ });
```
`TicketsToolbar.tsx` (query + `onChange`), `TicketsEmpty.tsx`, `TicketsTree.tsx` : `const [query, setQuery] = useState(EMPTY_QUERY)` ; `visible = filterTickets(...)` ; `canDrag = !readOnly && !isActive(query)` ; `loading ? <Skeleton ×5/>` ; `fr.ts` : textes. Conformité : `bun run --cwd components/tickets test`.
Run: `bun test components/tickets` — Expected: PASS.

- [x] **Step 3: Notes : tri et dossiers (tests rouges puis verts)**

`note-sort.test.ts` : `groupNotes(notes, "recent")` ⇒ racine `""` en premier (tri `mtime` décroissant), puis `"idees"`, `"reunions"` par nom ; `"title"` ⇒ `localeCompare("fr")` sur `title`. `NoteList.tsx` : `Select` « Trier » (`recent` / `title`), groupes `Collapsible` par dossier (ouverts par défaut, en-tête = nom du dossier, racine sans en-tête), préférence lue/écrite par `window.localStorage[NOTE_SORT_KEY]` dans `try/catch` (le composant n'importe pas `packages/ui`). `notes.test.tsx` : un jeu `createMockSdk(manifest, { notes: { "a.md": …, "idees/b.md": …, "reunions/c.md": … } })` rend trois groupes et le tri par titre réordonne. Conformité : `bun run --cwd components/notes test`.
Run: `bun test components/notes` — Expected: PASS.

- [x] **Step 4: Gate et commits**

```bash
git add components/tickets/src/filter-tickets.ts components/tickets/src/filter-tickets.test.ts components/tickets/src/TicketsToolbar.tsx components/tickets/src/TicketsEmpty.tsx components/tickets/src/TicketsTree.tsx components/tickets/src/TicketRow.tsx components/tickets/src/fr.ts components/tickets/src/tickets.test.tsx <fixtures>
git commit -m "feat(tickets): recherche, filtres et état vide"
git add components/notes/src/note-sort.ts components/notes/src/note-sort.test.ts components/notes/src/NoteList.tsx components/notes/src/NotesView.tsx components/notes/src/fr.ts components/notes/src/notes.test.tsx
git commit -m "feat(notes): tri et dossiers"
```

---

### Task 43: Kanban : carte déplaçable, ordre dans la colonne, « + » dans Bloqué, filtre explicite

Vague 1 ← T29, T31 (`createTicket.blockedReason` pour le « + » de Bloqué ; si T31 n'est pas intégrée au lancement, livrer le Step 4 après rebase). Spec §15.3, composants §16.2 ; écran **126**. Le composant déclare `data: true`, range l'ordre par colonne dans ses données d'instance et se réordonne par `@dnd-kit/sortable`.

**Files:**
- Modify: `components/kanban/kibo.component.json` (`"data": true`) ; Create: `components/kanban/src/column-order.ts`, `column-order.test.ts`, `KanbanToolbar.tsx` ; Modify: `components/kanban/src/Kanban.tsx`, `KanbanCard.tsx`, `fr.ts`, `kanban.test.tsx`, `packages/ui/src/registry.ts` (si les manifestes intégrés y sont recopiés : `grep -n "kanban" packages/ui/src/registry.ts`)

**Interfaces:**
- Consumes: `useSortable`, `SortableContext`, `verticalListSortingStrategy`, `useDroppable`, `sdk.data.get/set`, `sdk.subscribe`, `sdk.openNewTicket({ statusId: "blocked" })`, `useReadOnly`.
- Produces: contrat « Composants intégrés » (T43) : `orderColumn`, `placeInColumn`, `ORDER_KEY`.

- [ ] **Step 1: Ordre pur (tests rouges puis verts)**

`column-order.test.ts` :
```ts
test("orderColumn follows the saved order, appends the rest in tree order, ignores unknown ids", () => {
  const t = (id: string) => ({ id });
  expect(orderColumn([t("a"), t("b"), t("c")], ["c", "zz", "a"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  expect(orderColumn([t("a"), t("b")], undefined).map((x) => x.id)).toEqual(["a", "b"]);
});
test("placeInColumn moves before or after the target, into an empty column, and purges unknown ids", () => {
  expect(placeInColumn(["a", "b", "c"], ["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
  expect(placeInColumn(["a", "b"], ["a", "b"], "a", "b", "after")).toEqual(["b", "a"]);
  expect(placeInColumn([], [], "x", null, "after")).toEqual(["x"]);
  expect(placeInColumn(["gone", "a"], ["a"], "n", "a", "after")).toEqual(["a", "n"]);
});
```
Implémenter. Run: `bun test components/kanban/src/column-order.test.ts` — Expected: PASS.

- [ ] **Step 2: Carte entière déplaçable et ordre persistant (tests rouges puis verts, écran 126)**

`kanban.test.tsx` :
```tsx
test("screen 126: the whole card is the drag handle, the menu is not; the saved order is applied and written on drop", async () => {
  const sdk = createMockSdk(manifest, { seed, viewer: "adam" });
  await sdk.data.set("order", { todo: [idOf("KIB-15"), idOf("KIB-9")] });
  render(<SdkProvider sdk={sdk}><Kanban /></SdkProvider>);
  const todo = await screen.findByRole("region", { name: /À faire/ });
  expect(within(todo).getAllByRole("article").map((a) => a.getAttribute("data-key"))).toEqual(["KIB-15", "KIB-9", "KIB-18"]);
  const card = within(todo).getByRole("article", { name: /KIB-9/ });
  expect(card.getAttribute("aria-roledescription")).toBe("sortable");
  expect(within(card).getByRole("button", { name: "Actions pour KIB-9" }).getAttribute("data-dnd-ignore")).toBe("true");
  expect(sdk.used.data).toBe(true);
});
```
(Le glisser ne se simule pas sous happy-dom : l'écriture est testée par la fonction `onDragEnd` extraite, `dropInColumn(order, event)`, appelée directement avec un `DragEndEvent` construit, qui doit produire `sdk.data.set("order", …)` et `setStatus` si la colonne change.) `KanbanCard.tsx` : `useSortable({ id })` sur l'`article` (`cursor-grab`, `activationConstraint: { distance: 6 }` via un `PointerSensor` dans `Kanban.tsx`), menu et boutons avec `onPointerDown={(e) => e.stopPropagation()}` et `data-dnd-ignore` ; `Kanban.tsx` : `SortableContext` par colonne (`verticalListSortingStrategy`), `order` lu par `sdk.data.get(ORDER_KEY)` au montage et sur `sdk.subscribe`, `onDragEnd` ⇒ `placeInColumn` puis `sdk.data.set` (`readOnly` ⇒ aucun capteur), `useDroppable` conservé pour une colonne vide ; `kibo.component.json` : `"data": true` ; `CI_DOT.neutral: "bg-muted-foreground/60"`.
Run: `bun test components/kanban` — Expected: PASS ; la conformité tourne dans `kanban.test.tsx` (`runConformance`, `data: true`).

- [ ] **Step 3: Filtre explicite (test rouge puis vert)**

Test : en-tête « 13 / 24 · Moi + agents » et lien « 11 masqués · Tout afficher » qui passe le filtre à « Tous » ; avec « Tous », pas de lien. `KanbanToolbar.tsx` (compteur, `ToggleGroup` Moi + agents / Tous, lien) ; `fr.ts` : `hidden: (n) => \`${n} masqué${n > 1 ? "s" : ""} · Tout afficher\``.
Run: `bun test components/kanban` — Expected: PASS.

- [ ] **Step 4: « + » dans Bloqué (test rouge puis vert ; après T31)**

Test : la colonne Bloqué a un bouton « Nouveau ticket dans Bloqué » qui appelle `sdk.openNewTicket({ statusId: "blocked" })` (`newTicketRequests` du mock). `Kanban.tsx:142-144` : `onAdd` sans l'exception `blocked` (le dialogue de T32 demande le motif).
Run: `bun test components/kanban` — Expected: PASS.

- [ ] **Step 5: Gate et commits**

```bash
git add components/kanban/kibo.component.json components/kanban/src/column-order.ts components/kanban/src/column-order.test.ts components/kanban/src/Kanban.tsx components/kanban/src/KanbanCard.tsx components/kanban/src/kanban.test.tsx <registry si touché>
git commit -m "feat(kanban): carte déplaçable et ordre mémorisé"
git add components/kanban/src/KanbanToolbar.tsx components/kanban/src/Kanban.tsx components/kanban/src/fr.ts components/kanban/src/kanban.test.tsx
git commit -m "feat(kanban): filtre explicite et plus dans Bloqué"
```

---

### Task 44: Parcours E2E de la boîte de réception et du confort

Vague 4 ← tout. Deux specs Playwright, en sombre et en clair (ports **4419–4422**, scénario `question`), qui capturent les écrans 113 à 126 (et 108 amendé) et vérifient de bout en bout : création d'un ticket sans projet, rattachement avec nouvelle clé, fiche sans « Assigner » ; Composants filtrés et volet « Utilisé dans » ; Synchronisation vide ; Agents : historique cliquable et confirmation d'arrêt ; Changements en toutes lettres ; retour à la ligne mémorisé ; arbre Tickets filtré ; Kanban réordonné.

**Files:**
- Create: `e2e/inbox.spec.ts`, `e2e/confort.spec.ts`
- Modify: `e2e/playwright.config.ts`

**Interfaces:**
- Consumes: `pairAndCreateProject`, `createRepoProject`, `projectKey`, `shot`, `rpc`, `seedWorkspace`, `assign` (`agents-seed.ts`), `E2E_TOKEN`, `createE2eRepo`, `createSidebarPage`, `addComponent`.
- Produces: rien (dernière tâche).

- [ ] **Step 1: Quatre démons de plus**

`e2e/playwright.config.ts`, après la ligne `projects-light` (T28) ou `menus-light` si T28 n'est pas livrée :
```ts
  { name: "inbox-dark", scheme: "dark", port: 4419, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "inbox-light", scheme: "light", port: 4420, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "confort-dark", scheme: "dark", port: 4421, spec: /confort\.spec\.ts/, scenario: "question" },
  { name: "confort-light", scheme: "light", port: 4422, spec: /confort\.spec\.ts/, scenario: "question" },
```

- [ ] **Step 2: Boîte de réception (rouge tant que l'UI n'est pas intégrée, vert ensuite)**

`e2e/inbox.spec.ts` :
```ts
import { expect, test } from "@playwright/test";
import { pairAndCreateProject } from "./helpers";
import { shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

test("un ticket sans projet, puis rattaché avec une nouvelle clé", async ({ page }, info) => {
  await page.goto("/#/");
  await page.goto(`/#pair=${process.env.E2E_TOKEN ?? ""}`);
  const header = page.locator("header").first();
  await header.getByRole("button", { name: "Nouveau ticket" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(dialog.getByRole("combobox", { name: "Projet" })).toHaveText("Boîte de réception");
  await expect(dialog.getByText("Clé INB-1")).toBeVisible();
  await dialog.getByLabel("Titre").fill("Appeler le comptable");
  await shot(page, info, "ecran-114");
  await dialog.getByRole("button", { name: "Créer" }).click();
  await expect(dialog).toBeHidden();
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByRole("button", { name: /Boîte de réception/ })).toContainText("1");
  await sidebar.getByRole("button", { name: /Boîte de réception/ }).click();
  await expect(page).toHaveURL(/#\/inbox$/);
  await expect(page.getByRole("row", { name: /INB-1/ })).toBeVisible();
  await shot(page, info, "ecran-113");

  await page.getByRole("row", { name: /INB-1/ }).getByRole("button", { name: /Appeler le comptable/ }).click();
  const sheet = page.getByRole("dialog", { name: /INB-1/ });
  await expect(sheet.getByRole("button", { name: /Assigner/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await pairAndCreateProject(page, info, "INX");
  await page.goto("/#/inbox");
  await page.getByRole("row", { name: /INB-1/ }).getByRole("button", { name: "Rattacher…" }).click();
  const file = page.getByRole("dialog", { name: "Rattacher INB-1 à un projet" });
  await expect(file.getByText(/la prochaine est INX/)).toBeVisible();
  await shot(page, info, "ecran-115");
  await file.getByRole("button", { name: "Rattacher" }).click();
  await expect(file).toBeHidden();
  await expect(page.getByRole("dialog", { name: /INX-1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Rien en attente.")).toBeVisible();
});
```
(`pairAndCreateProject` appaire déjà : vérifier son comportement si la page est déjà appairée et, si besoin, créer le projet par `rpc(page, { method: "createProject", … })` à la place ; la clé `INX` évite tout doublon.)
Run: `cd e2e && bunx playwright test --project=inbox-dark --project=inbox-light` — Expected: PASS, captures `ecran-113/114/115.png`.

- [ ] **Step 3: Confort et lisibilité**

`e2e/confort.spec.ts` : un test par zone, dans un même fichier (démon partagé) :
- **Composants** : `/#/components`, recherche « kanban », filtre « Kibo », tri par « Utilisé dans », clic sur « n pages · n projets » d'un composant posé par `createSidebarPage` + `addComponent`, le volet ouvre la page ; capture `ecran-116`.
- **Synchronisation** : `/#/settings/sync`, état vide avec les deux cartes ; « Entrer le code » ouvre le dialogue avec « Options avancées » replié ; capture `ecran-119` et `ecran-120`.
- **Agents** : `seedWorkspace` + `assign(page, seeded, 12, "opus-dev", "running")` ; `/#/agents`, filtre « Tous », clic sur la ligne ⇒ le tiroir montre le run ; « Arrêter » ⇒ dialogue de confirmation, « Annuler » ne change rien ; capture `ecran-121`.
- **Changements** : `createRepoProject` avec un fichier modifié (`createE2eRepo`), onglet Changements : « Modifié », « Modifications (1) », « Ajouter au commit » ⇒ « Dans le prochain commit (1) » ; bascule « Retour à la ligne » puis rechargement ⇒ toujours décochée ; capture `ecran-122` et `ecran-124` (aperçu d'un fichier : recherche « kibo », compteur).
- **Tickets et Kanban** : page Vue « Tickets » : recherche « schéma » ⇒ une ligne et son parent ; capture `ecran-125` ; page Vue « Kanban » : « 13 / 24 · Moi + agents » (ou les compteurs du seed), « Tout afficher », « + » de Bloqué ouvre le dialogue avec « Motif » ; glisser `KIB-15` sous `KIB-9` par `page.dragTo` et vérifier l'ordre après rechargement ; capture `ecran-126`.
- **Chargement** : impossible avec `webServer` (le démon tourne) : couvert par `app.test.tsx` ; noter l'écart.
Run: `cd e2e && bunx playwright test --project=confort-dark --project=confort-light` — Expected: PASS.

- [ ] **Step 4: Gate et commit**

Run: `bun run check && bun run typecheck` — Expected: PASS.

```bash
git add e2e/inbox.spec.ts e2e/confort.spec.ts e2e/playwright.config.ts
git commit -m "test(e2e): boîte de réception et confort"
```

---

## Auto-revue du plan

- **Couverture de la spec §15** : 15.1 → T31 (schéma, core, démon), T32 (dialogue, barre latérale, Mes tickets, palette, titres, clé réservée), T33 (page, rattachement, fiche, AssignDialog) ; 15.2 → T34 (Installés), T35 (confirmations, vocabulaire, Marketplace, Sources), T36 (Synchronisation), T37 (Agents), T38 (Code) ; 15.3 → T40 (retour à la ligne, recherche, chemin), T39 (chargement, injoignable, coque), T41 (largeurs, fil d'Ariane, chemins longs côté T29), T42 (arbre, notes), T43 (Kanban) ; 15.4 → T30 ; 15.5 → aucune tâche (aucun code). Composants §16 → T30 (16.1), T43 (16.2), T42 (16.3, 16.4). Marketplace D47 → T30, T35. Agents §11 → T31, T32, T37, T39. Code §12.8 → T38, T40.
- **Review Focus** : 1 → T31 Steps 3, 4 ; 2 → T31 Steps 2, 4 et `file-ticket-shared.test.ts` ; 3 → T31 Step 4, T33 Step 4 ; 4 → T29 Step 6 ; 5 → T35 Steps 1-3, T36 Steps 2-3, T37 Step 4 ; 6 → T39 Steps 1, 2, 4 ; 7 → T43 Step 2.
- **Mineures en attente casées** : `tabIndex={-1}` et libellé « Image » → T41 ; double `role="alert"` → T41 ; `fr.nav.shareProject` → T29 ; `ProjectEntry` extrait → T29 ; `Shell.tsx` allégé → T39 ; `service.ts` → T31 ; `isLocked` et `detail` → T30 ; `rpcImpl` (double `mock.module`) → T41 ; raccourcis codés en dur → T38 ; création exclusive d'une note → T30 ; `expect` de `main.rs` → T39 ; chemins longs (écrans 1 et 108) → T29 ; coche du Thème et sous-ligne de l'écran 112 → T41 et description de l'écran 112.
- **Cohérence des noms** : `INBOX_ID`, `INBOX_KEY`, `isInbox`, `inboxAllows`, `RESERVED_PROJECT_KEYS` ; `transferTicket`, `TransferResult` ; `loadInbox`, `INBOX_META`, `assertInboxCommand`, `assertNotInbox`, `assertProjectKeyAllowed`, `createFileTicket`, `handleProjectRequest`, `NOT_HANDLED` ; `createNoteFile`, `notes.create`, `refreshMarketSource`, `isLocked` ; `ProjectHeaderMenu`, `ProjectEntry`, `TabMenuContent`, `loadTrusted(…, expose)` ; `inboxMeta`, `displayName`, `withInbox`, `inboxSummary`, `openInboxCount` ; `InboxPage`, `inboxMenuEntries`, `FileTicketDialog` ; `filterComponents`, `toggleSort`, `UsagesSheet` ; `SyncEmptyState` ; `filterRuns`, `permissionModeLabel`, `RunHistory` ; `LoadingScreen`, `DaemonUnreachable`, `RootBoundary`, `useShellDialogs`, `paletteActionHandler`, `fileTabOpener` ; `readPref`, `writePref`, `usePref`, `useWrap`, `findMatches`, `parseGoTo`, `stepMatch`, `FileToolbar` ; `SettingsLayout`, `ChangesLayout`, `Crumb` ; `filterTickets`, `groupNotes`, `orderColumn`, `placeInColumn`, `ORDER_KEY` ; `frInbox`, `frSyncPage`, `frStartup`, `frFileTools`, `frComponentsList`.
- **Points laissés à l'exécutant, sans placeholder** : le nom exact du registre des hôtes dans `daemon.ts` (T30 Step 1), le rôle rendu par `ConfirmDialog` (T35 Step 1), le libellé ARIA de la barre latérale (T39 Step 1), la façon dont `pairAndCreateProject` réagit à une page déjà appairée (T44 Step 2) : à lire dans le code, la consigne est donnée pour chaque cas.
