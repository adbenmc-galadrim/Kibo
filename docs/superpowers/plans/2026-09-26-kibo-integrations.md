# Kibo Intégrations (phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** brancher Kibo sur GitHub Issues/Projects (aller-retour), GitHub Actions (lecture), Figma (MCP local) et n'importe quel serveur MCP, par des adaptateurs déterministes, sans jamais exposer un secret à un composant, au CRDT, à SQLite ou aux logs.

**Architecture:** le démon gagne un socle d'intégrations (`packages/daemon/src/integrations/`) : un hôte (`IntegrationHost`) qui isole les points d'ancrage des phases 2 à 4, un trousseau (`SecretStore` sur `Bun.secrets`), un caviardage global, un réseau sortant unique (anti-SSRF, secrets injectés par hôte, origines de test), un registre de RPC et de sondes d'état. Au-dessus : le moteur de sync (boîte d'envoi SQLite, fusion à trois pure dans `core`), l'adaptateur GitHub Issues écrit comme un composant intégré (Worker, SDK public), le sondeur GitHub Actions, le hub MCP (`@modelcontextprotocol/sdk`) et Figma par MCP. L'UI ajoute l'écran 16, les dialogues de connexion, la source synchronisée à l'écran 3, les sections du Sheet, et deux composants (`github-issues` sans UI, `mcp-source`).

**Tech Stack:** Bun 1.4.2 (`Bun.secrets`, `bun:sqlite`, `Bun.serve`), TypeScript 5.9 strict, Zod 3.25.76, loro-crdt 1.16.3, `@modelcontextprotocol/sdk` 1.30.1 (nouvelle, figée), React 19, shadcn/ui (`packages/sdk/src/ui`), Tailwind 4, fast-check 4.3.0, Playwright, Biome 2.2.4.

**Spec:** `docs/superpowers/specs/2026-09-26-kibo-integrations.md` (source principale, « spec F »). Liées : `2026-09-26-kibo-composants.md` (« spec B » : manifeste v1, `net`, proxy `fetch`, `componentCall`, Worker, écran 30), `2026-09-26-kibo-code-onglets.md` (« spec phase 3 » : `externalRefs`, `upsertExternalRef`, `gh`, onglets), `2026-09-25-kibo-design.md` (§5, §6, §9, §10). Maquettes : `design/pdf/kibo-design-{sombre,clair}.pdf` — page PDF 26 (écran 16 Intégrations), 4 (Sheet ticket), 20 (projet créé : « Importer des tickets depuis GitHub Issues »), 8 et 14 (chips `#12` des cartes Kanban), 12 (écran 30). Données : `design/donnees-fictives.md`.

## Global Constraints

- Bun **1.4.2** partout (CI `oven-sh/setup-bun` `bun-version: 1.4.2`), `bun.lock` figé, `bunfig.toml` `exact = true`, aucun script `postinstall` (vérifié par `bun pm untrusted`).
- **Aucun commentaire dans le code** (rédhibitoire en review). Exports nommés, `kebab-case.ts`, composants `PascalCase.tsx`, fichiers < ~300 lignes.
- Code, identifiants, messages d'erreur internes en anglais ; textes d'interface en français, **tutoiement**, dans `packages/ui/src/i18n/fr-integrations.ts` (UI) ou `components/<id>/src/fr.ts` (composants).
- Composants shadcn depuis `packages/sdk/src/ui` ; `useId()` pour tout couple label/champ ; tokens zinc ; orange réservé aux agents (aucun orange dans cette phase) ; chaque écran en sombre **et** en clair.
- Pas de `any`, pas de `as` non justifié ; types issus de Zod (`z.infer`) ; erreurs du domaine en `KiboError` avec code stable ; **aucune erreur avalée** (un `catch` rethrow, convertit en `KiboError`, ou affiche l'erreur).
- **Secrets** : uniquement dans le trousseau (`Bun.secrets`, service `dev.kibo`) ; **aucun repli en clair** si le trousseau est indisponible (`SECRET_STORE_UNAVAILABLE`, message à l'utilisateur) ; jamais dans le CRDT, SQLite, un fichier, un log, un message d'erreur, une réponse RPC, `brief.md`, l'env d'un agent.
- **Réseau sortant** : HTTPS seulement, résolution DNS puis refus des adresses privées, loopback, link-local, multicast (anti-SSRF) ; exception unique : origines de test déclarées par `--test-origins` (démon lancé en mode test).
- **Zéro token pour l'état** : tout changement vient d'une réponse HTTP, d'un résultat MCP ou d'une commande locale, jamais d'un LLM. Tout est en pull, aucune écoute réseau ajoutée.
- Config MCP **locale** (SQLite `mcp_servers`), jamais dans le CRDT ; la commande exacte est affichée et confirmée avant la première exécution ; env réduit (`PATH`, `HOME`, `LANG` + variables secrètes déclarées).
- **Aucun compte réel en CI** : faux GitHub (`Bun.serve`) et faux MCP (SDK serveur MCP) ; secret factice `ghp_TESTSECRET0123456789abcdefghijklmn`.
- Tests TDD à côté du code (`*.test.ts`) ; CI macOS **et** Linux ; E2E Playwright en **sombre et clair** ; `bun run check`, `bun run typecheck`, `bun test packages components` verts avant chaque commit.
- Nouveaux paquets (`components/github-issues`, `components/mcp-source`) ajoutés au script `typecheck` racine et à la liste du monorepo de `CLAUDE.md`.
- Dépendances entre paquets inchangées (`schema ← core ← daemon`, `schema ← sdk ← components`, `sdk ← ui`) ; le démon lit les sources des composants intégrés **par chemin** (jamais par `import`).
- Commits : une ligne, français, préfixe conventionnel, < 50 caractères, sans body, sans mention d'IA ; fichiers stagés explicitement.

## Review Focus

1. **Plusieurs issues modifiées dans la même seconde, au-delà d'une page de 100** : le pull (curseur `since` inclusif, page suivante tant que `since` n'avance pas) n'en manque aucune et n'en duplique aucune (Task 13, test « skips pull requests and walks same-second pages without losing issues »).
2. **Corps d'issue `null` ou en `\r\n`, titre avec espaces de fin** : aucune modification fantôme, aucun aller-retour infini de description (Task 13 « normalizes title, body and labels », Task 5 propriété de point fixe, Task 19 aller-retour `Corps\r\nligne 2`).
3. **URL distante non http(s) (`javascript:`, `data:`) dans une issue, un nœud Figma ou un élément MCP** : refusée par Zod (`WebUrl`), jamais rendue en lien (Task 1 test `WebUrl`, Task 19 test « an adapter output is validated », Task 22 tests « items are mapped, unsafe links are dropped » et « lists the items »).
4. **Secret renvoyé par le service distant dans un corps d'erreur** (serveur qui réécrit l'en-tête `Authorization`) : retiré du corps dès la réception (N18, Task 8 test « a secret echoed by the remote is scrubbed »), caviardé dans le journal, les erreurs RPC, `integration_events` et la console (Task 2 test du caviardage, Task 23 test de fuite avec `failNext(…, ECHO_AUTH)`).
5. **Démon arrêté entre le `POST` de création d'une issue et l'écriture de la ligne de sync** : au redémarrage, la création est adoptée (même auteur, titre et corps depuis `since`) au lieu d'être dupliquée, et le pull n'importe pas l'issue en double tant qu'une création est incertaine (Task 13 « a retried create adopts the issue created by a previous attempt », Task 14 « an uncertain create blocks imports until it resolves », qui vérifie aussi, par N39, qu'aucune issue sautée n'est perdue).

## Points d'ancrage des phases 2 à 4

Ce plan a été écrit avant les phases 2 à 4 ; la tâche T0 (2026-09-26, `main` à `d8e4823`) a vérifié chaque ancrage dans le code livré et corrigé les tâches en conséquence. La colonne « Réel » fait foi ; les tâches citent les noms réels. Un dev qui trouve encore un écart utilise le nom réel sans changer le comportement et le signale dans son rapport.

| Ancrage | Attendu (spec) | Utilisé par | Réel (`main`, `d8e4823`) |
|---|---|---|---|
| Réf. PR (phase 3) | `GithubPrRef` et `ExternalRef` dans `packages/schema/src/external-ref.ts` ; `Ticket.externalRefs: ExternalRef[]` ; commande réservée `upsertExternalRef { ticketId, ref }` ; core `upsertExternalRef(doc, ticketId, ref)` dans `packages/core/src/external-refs.ts`, stockage JSON sous la clé `externalRefs` du nœud | Task 4 | `ExternalRef` = `z.discriminatedUnion("kind", [github_pr { url: z.string().url(), number, state: PrState }])` dans `external-ref.ts`, **sans export `GithubPrRef`** (la Task 4 l'extrait). `Ticket.externalRefs` conforme. `upsertExternalRef` est une commande de `ProjectCommand` (`schema/src/command.ts`) **non réservée** (`COMMAND_WRITES.upsertExternalRef = "ticket"` : tout composant qui écrit `ticket` peut l'appeler ; la Task 4 la réserve). Core : `upsertExternalRef(doc, id, ref)` dans **`packages/core/src/tickets.ts`** (pas de `external-refs.ts`), dédoublonnage par `url` seulement, tableau JSON sous `externalRefs`, relu sans validation (`readTicket`). |
| `gh` (phase 3) | binaire surchargé par `KIBO_GH`, lancé par `Bun.spawn` en tableau | Tasks 2, 12 | `runGh(args, { cwd, env, stdin? }): Promise<RunResult>` dans `packages/daemon/src/code/run.ts` (`env.KIBO_GH ?? process.env.KIBO_GH ?? "gh"`, `cwd` obligatoire, délai 120 s, échec de lancement ⇒ `GH_UNAVAILABLE`, `RunResult { code, stdout, bytes, stderr }`) ; `ghStatus`, `prState`, `createPr` dans `code/remote-ops.ts`. Faux binaire `packages/daemon/src/code/testing/fake-gh.ts` (`auth status`, `pr create`, `pr view` ; état `FAKE_GH_STATE`) : `auth token` à ajouter (Task 12). |
| Remote git (phase 3) | exécution `git` dans le dossier du projet (`KIBO_GIT`) | Task 2 (`gitRemoteUrl`) | `createGit(root, env): Git` dans `code/run.ts` (`KIBO_GIT`, `git.run(args)` ⇒ `RunResult`) ; `openRepo(folder, env)` dans `code/repo.ts`. |
| Notifications M1 (phase 2) | fonction de notification système du démon | Tasks 2, 16 | Double : natif par `DaemonOptions.notify?: (notice: Notice) => void`, `Notice = { title, body }` (`agents/notifier.ts`, `stdoutNotifier` ⇒ ligne `KIBO_NOTIFY` lue par Tauri si `KIBO_NATIVE_NOTIFY=1`) ; navigateur par l'UI (`packages/ui/src/agents/use-run-notifications.ts`, API `Notification`, `Session.notifications`). Voir N25. |
| Moteur de règles (phase 2) | événements typés, règles par défaut déclaratives | Tasks 2, 16 | Règles de **changement de statut seulement** : `Rule { id, enabled, when: run_started \| run_done \| pr_opened \| pr_merged \| children_done, from, to }` et `DEFAULT_RULES` (`schema/src/rule.ts`), `evaluateRules`/`readRules`/`RuleTrigger` (`core/src/rules.ts`), `applyRules(doc, trigger)` (`daemon/src/agents/data-port.ts`), `Service.triggerRules` (suivi des PR). Aucune règle de notification ni d'événement externe : pas de `ruleEvent` (N25). |
| `brief.md` (phase 2) | générateur du brief d'un run | Task 20 | `buildBrief({ project, ticket, domain, note })` et `buildRunContext` dans `packages/core/src/context.ts` (pur) ; appelés par `prepareTicketRun` de `daemon/src/agents/run-launch.ts`, qui écrit `CLAUDE.md` et `brief.md`. |
| Réglages (phase 2) | page Paramètres (écran 14/15) avec navigation latérale | Task 10 | Seul l'écran `domains` existe (`packages/ui/src/settings/DomainsPage.tsx`) ; `settings/SettingsNav.tsx` liste Général, Apparence, Domaines, **Intégrations (`Plug`)**, Sécurité, Raccourcis, toutes désactivées sauf l'entrée active ; `Screen = agents \| queue \| domains \| components \| mine` (`schema/src/tabs.ts`). Voir N30. |
| WebSocket typé (phase 3) | messages `{ type, … }` diffusés à l'UI ; abonnement générique côté client | Tasks 2, 10 | Un canal `changes` : `ChangeMessage = { projectId } \| { topic } \| RunChanged \| CodeEvent` (`schema/src/rpc.ts`), publié par `server.ts` depuis `Service.onChange`. `createClient` (`packages/sdk/src/client.ts`) : `subscribe`, `subscribeTopic`, `onRunChanged`, `subscribeCode` ; **aucun abonnement générique** (un message inconnu part vers les écouteurs de projet). Voir N24. |
| Démon, service, démarrage (phases 1 à 4) | `createService(store, opts)` construit par `main.ts` | Task 2 et tous les modules | `createService(store, { user, notifications? })` ⇒ `Service { handle, onChange, docs: Docs, agentData, attachAgents, attachComponents, triggerRules }` ; `Docs = { workspace, project, projectIds, save, emit }` (`docs.ts`) ; `Store.db` existe déjà (pas de `transaction`). **`startDaemon(opts: DaemonOptions)` (`daemon.ts`) assemble tout** (décision 23 de la phase 4) ; `main.ts` ne lit que les drapeaux. Commandes exécutées **hors du service** : `components/gate-handlers.ts` (`componentCall run`), `agents/data-port.ts` (assignation, règles des runs), `Service.triggerRules`. Voir N22 et N26. |
| Origines de test (`--test-origins`) | drapeau du démon | Tasks 2, 8, 23 | N'existe pas. Équivalents de test livrés : `DaemonOptions.net?: NetProxyOptions` (résolveur, transport, `allowAddress` injectés), faux `gh` (`KIBO_GH`), `--host-load` (E2E). `--test-origins` et `--memory-secrets` sont créés par la Task 2 (N9, N26). |
| `KiboError` (phases 1 à 4) | union de codes | Task 1 | Tableau `KIBO_ERROR_CODES` `as const` (`schema/src/errors.ts`), `KiboError(code, detail)` ; `RATE_LIMITED`, `TIMEOUT`, `CONFLICT`, `TOO_LARGE`, `GH_UNAVAILABLE` existent. Statuts HTTP dans `STATUS` de `daemon/src/server.ts` (`INTERNAL`, `STORE_CORRUPT` masqués). Codes renvoyés par un backend filtrés par `BACKEND_ERROR_CODES` (`components/host-core.ts`, décision 25 de la phase 4 ; voir N23). |
| Textes UI (phases 1 à 4) | `packages/ui/src/i18n/fr.ts` | Tasks 1, 10, 11, 17, 18, 21 | `fr` étale `frCode` (`fr-code.ts`) et `frComponents` (`fr-components.ts`) ; `fr.settings.integrations = "Intégrations"` existe. `fr-integrations.ts` suit ce modèle (clé `fr.integrations`). |
| SDK UI (phases 1 à 4) | primitives shadcn dans `packages/sdk/src/ui` | Tasks 10, 11, 17, 18, 22 | Présentes : alert-dialog, alert, badge, button, card, **checkbox**, command, context-menu, dialog, dropdown-menu, input, label, progress, radio-group, select, separator, sheet, sidebar, skeleton, sonner, table, tabs, textarea, toggle, toggle-group, tooltip. Absente : `switch` (Task 10). Partageables par un composant tiers : `SDK_UI_PRIMITIVES` (`schema/src/component.ts`). Aucun `Toaster` monté (décision 19 de la phase 4 : `lib/use-flash.ts`) ; voir N29. |
| Manifeste v1 (phase 4) | `ComponentManifest` avec `net`, `data`, `configVersion`, `changes`, `sdk` ; `BuiltinEntityType` ; `BUILTIN_IDS` dans `schema` ; `WRITES` (méthode → entité, `null` = réservé) | Tasks 1, 4, 9, 13, 22 | Conforme (`schema/src/manifest.ts`, `kind: widget \| view \| both`) ; `BUILTIN_IDS = ["kanban", "tickets", "graph", "notes"]` et `isBuiltinId` dans `schema/src/component.ts` ; la table s'appelle **`COMMAND_WRITES`** (`schema/src/command.ts`, avec `isReservedCommand`). |
| `componentCall` (phase 4) | union `ComponentCall`, contrôles §6.4 de la spec B, dispatch côté démon | Tasks 9, 15, 19 | `ComponentCall` dans `schema/src/call.ts` ; permissions dans `schema/src/permissions.ts` (`permissionOfCall`, `covers`, `grantedOf`, `permissionList`, `addedPermissions`) ; porte `createGate` (`daemon/src/components/gate.ts` : instance, commandes réservées, `missingPermission` — les intégrés ne sont pas contrôlés —, quotas `createQuotas` (`quotas.ts`, 200 appels/s, 20 `fetch`/min par instance), journal borné `component_events` (`events.ts`)) ; exécution `createGateHandlers` (`gate-handlers.ts`). |
| Proxy `fetch` (phase 4) | contrôle `net`, anti-SSRF, en-têtes retirés, redirections, délai 15 s, 5 Mio | Tasks 8, 15 | `proxyFetch(rules, url, init, opts: NetProxyOptions)` (`components/net-proxy.ts`) ; `isPublicAddress` (`net-proxy-address.ts`) ; `readProxiedBody` (`net-proxy-body.ts`) ; `Transport`, `directTransport`, `createDirectTransport({ ca })` (`net-proxy-transport.ts`) ; connexion épinglée à l'adresse vérifiée, SNI d'origine ; `authorization` et `cookie` retirés ; 3 redirections revérifiées. Voir N27. |
| Backends (phase 4) | `WorkerHost` (`{ type: "load", manifest, code }`, `invoke` d'une action) ; `defineServer` de `@kibo/sdk/server` ; `devkit.buildComponent` | Tasks 1, 13, 19 | `createWorkerHost(opts: HostOptions)` (`components/worker-host.ts`) ⇒ `BackendHost { invoke(req: InvokeRequest), describe(), stop(), running }` (`host-core.ts`) ; `HostOptions { ref, manifest, code: BackendCode, onCall, beforeStart?, timeoutMs… }` ; protocole `DaemonToBackend`/`BackendToDaemon` (`schema/src/protocol.ts`) ; `createBackends` ne sert que les versions approuvées du registre (aucun intégré). `defineServer` et `ServerContext { instanceId, config, list, run, data, fetch }` (`packages/sdk/src/server.ts`). `buildComponent(srcDir, toolchain): Promise<BuildOutput>` (fichiers en mémoire, décision 14 de la phase 4). |
| Écran 30 (phase 4) | liste des permissions en langage clair ; `GrantedPermissions` ; diff « nouvelles permissions » | Task 9 | `packages/ui/src/dialogs/TrustDialog.tsx` + `packages/ui/src/lib/permission-lines.ts` (`permissionLines(g: GrantedPermissions): PermissionLine[]`) ; diff : `addedPermissions` (`schema/src/permissions.ts`). |
| Entité hors snapshot (phase 4) | `list("note")` servie par le démon hors du doc Loro | Task 9 (`ci_run`) | `list note` ⇒ `handlers.notes`, `list run` ⇒ `handlers.list` ⇒ `ComponentsDeps.runs(projectId)` (`gate.ts`, `gate-handlers.ts`) ; côté SDK `EntityMap` (`packages/sdk/src/types.ts`). |
| Messages `call` des backends (phase 4) | traitement des `{ type: "call" }` du `ComponentBackendHost`, rattachés à l'`instanceId` de l'invocation | Task 19 (`binding:`) | Pas de `ComponentBackendHost` : `host-core.ts` rattache chaque `call` à son invocation (`invocation`, décision 15 de la phase 4) et appelle `HostOptions.onCall(projectId, instanceId, call)`. Une liaison fournit son propre `onCall` (`binding-calls.ts`), sans toucher à `host-core.ts`. |
| `devkit` (phase 4) | construction de la cible serveur d'un composant (`buildComponent`) | Task 19 | `buildComponent` et `resolveToolchain` exportés par `@kibo/devkit` ; binaire unique construit par `apps/desktop/scripts/build-sidecar.ts` (tâche 34 de la phase 4 en cours). |
| Suite de conformité (phase 4) | `runConformance(component, seed, options?)` | Task 22 | `runConformance(mod: { manifest, Component }, seed?, opts?)` (`packages/sdk/src/conformance.tsx`). |
| Tâches de phase 4 en cours | — | vagues | 30b (arrêt drainé : `components/service.ts`, `publish.ts`, `daemon.ts`, devkit `validate`) et 34 (binaire, toolchain, CI : `apps/desktop/`, `.github/workflows/ci.yml`, `ui/src/settings/`, `daemon/src/components/install-cli`). Les tâches de phase 5 qui touchent ces fichiers les attendent (tableau des vagues). |

## Réutilisé de la phase 4 (pas de réécriture)

| Besoin de la phase 5 | Livré par la phase 4 | Tâche |
|---|---|---|
| Anti-SSRF, résolution DNS, connexion épinglée avec SNI, lecture plafonnée, en-têtes retirés, redirections revérifiées | `components/net-proxy*.ts` (`isPublicAddress`, `systemResolver`, `Transport`/`directTransport`, `readProxiedBody`) | 8 (N27), 15 |
| Proxy `fetch` des composants | `proxyFetch` étendu (alias de test, secret injecté, observation, écho caviardé), pas de second proxy | 8, 19 |
| Contrôle d'un appel de composant, journal des refus | `createGate`, `missingPermission`, `permissionOfCall`, `component_events` | 9, 15 |
| Quotas d'appels et de `fetch` | `createQuotas` (120 `fetch`/min pour une liaison, N8) | 19 (N28) |
| Exécution d'un backend | `createWorkerHost`, `HostOptions.onCall`, `BACKEND_ERROR_CODES` (étendue, N23) | 19 |
| Construction d'un backend | `buildComponent` de `@kibo/devkit` | 19 |
| Lancement de `gh` et `git` | `runGh`, `createGit`, `ghStatus` (`code/`) | 2, 12 |
| Suivi des PR | `code/pr-poller.ts` (états de PR) ; le sondeur CI ne relit que les runs | 16 |
| Brief d'un run | `buildBrief` (`core/context.ts`) | 20 |
| Notifications | `DaemonOptions.notify` et `use-run-notifications.ts` | 2, 21 (N25) |
| Permissions en clair (écran 30) | `permissionLines` | 9 |
| Primitives UI | `packages/sdk/src/ui/*` (dont `checkbox`, `sonner`, `alert-dialog`, `progress`) | 10, 11, 17, 18 |

## Décisions nouvelles

Toutes sont reportées mot pour mot dans la spec F, section « §14 Décisions du plan », par la tâche T0 (avant tout code, comme l'exige `CLAUDE.md`) ; la Task 1 vérifie seulement que §14 et cette liste coïncident. N1 à N21 datent de l'écriture du plan ; N22 à N36 viennent de la réconciliation T0 avec le code livré des phases 2 à 4 ; N37 et N38, de la revue de la tâche 5 (fusion à trois) ; N39, de la revue de la tâche 14 (moteur de sync) ; N40 et N41, de la revue de la tâche 8 (réseau).

- **N1 · Scope d'une liaison avec Project** : avec un Project v2 configuré, la liaison porte sur les issues **du dépôt présentes dans le Project** ; le pull lit les éléments du Project en GraphQL (balayage complet, 100 par page) et retient ceux dont `max(item.updatedAt, issue.updatedAt) ≥ since`. Sans Project : REST `since`. Raison : le statut d'un élément de Project ne modifie pas `updated_at` de l'issue ; seul le balayage le voit.
- **N2 · `config.project.nodeId`** : l'identifiant GraphQL du Project est stocké dans la liaison (mutations sans requête préalable).
- **N3 · Projection des statuts** : statuts locaux et distants sont comparés dans l'espace distant (`projectStatus` / `remoteStatusId` dans `schema`) : sans Project, `done` ⇔ fermé, tout le reste ⇔ `todo` ; avec Project, un statut est remplacé par le premier statut non terminé qui partage son option. Raison : sans cela, une correspondance non injective ou un statut non représentable produit un aller-retour infini.
- **N4 · 409 et 422** : 409 ⇒ pull immédiat de la liaison puis un seul nouvel essai ; 422 ⇒ erreur conservée avec le message de GitHub (« Réessayer » / « Abandonner »), comme les autres 4xx. Raison : une validation refusée ne se résout pas en réessayant.
- **N5 · Création incertaine** : `PushOp.create` porte `since` (date du premier essai) quand un essai précédent a pu aboutir ; l'adaptateur adopte alors l'issue de même auteur, titre et corps créée depuis `since`. Tant qu'une création est incertaine, le pull de la liaison n'importe pas de nouvelle issue.
- **N6 · Adaptateur sans UI** : `kind: "adapter"` s'ajoute à l'énumération du manifeste ; un tel composant n'apparaît pas au catalogue et n'a pas d'instance. L'adaptateur est invoqué par le démon comme deux actions `adapter.pull` / `adapter.push` avec `instanceId = "binding:<bindingId>"` et `config = binding.config`.
- **N7 · Backends intégrés** : en dev, le démon construit `server.ts` d'un composant intégré avec `devkit` depuis `components/<id>/`, en mémoire ; dans le paquet, `scripts/build-builtin.ts` le préconstruit dans la ressource Tauri `builtin/<id>/{kibo.component.json,server.js}`, trouvée par la variable `KIBO_BUILTIN_DIR` (aucun `node_modules` embarqué). Le backend est chargé dans le `WorkerHost` de la phase 4.
- **N8 · Quota d'une liaison** : 120 `fetch` / min par liaison (au lieu de 20 / min par instance) ; les autres contrôles §6.4 de la spec B s'appliquent.
- **N9 · Origines de test** : `--test-origins host=origine[,…]` (origine `http://127.0.0.1:<port>` ou `http://localhost:<port>` seulement) ; l'URL logique (`https://api.github.com/…`) sert aux contrôles `net`/`secrets`, l'origine de test au transport. `--memory-secrets` (trousseau en mémoire) n'est accepté qu'avec `--test-origins`. Les deux drapeaux sont journalisés en avertissement au démarrage.
- **N10 · Réglages locaux** : table `integration_settings(key, value)` (`github.mode`, `github.login`, `figma.url`) et journal `mcp_calls(at, server, tool, instance_id, duration_ms, ok)`.
- **N11 · Import atomique** : commande réservée `importExternalTicket { title, description?, statusId?, assignee?, ref }` qui crée le ticket **et** sa référence dans une seule transaction Loro, idempotente par clé de référence ; utilisée par le pull et par « Créer un ticket » du composant Source MCP (`sdk.mcp.importItem`, appel `mcp.import`).
- **N12 · Permission MCP d'un intégré** : un manifeste **intégré** peut déclarer `mcp: ["{config.server}"]`, résolu à chaque appel avec la config de l'instance ; refusé par `validateComponent` pour tout composant non intégré.
- **N13 · Figma** : l'adresse du serveur Dev Mode est un réglage local (`figma.url`) ; le hub MCP l'ouvre sous l'identifiant réservé `figma`, absent de la liste « Serveurs MCP ».
- **N14 · Caviardage global** : les méthodes de `console` du démon sont enveloppées au démarrage ; tout secret lu (≥ 8 caractères) est remplacé par `***` dans la console, `integration_events`, les messages d'erreur RPC.
- **N15 · Icône Figma** : Lucide 1.x n'a plus d'icônes de marque ; l'écran 16 utilise `Frame` pour Figma et `Plug` pour les serveurs MCP (écart de maquette assumé, à redessiner dans Penpot).
- **N16 · Création depuis une instance synchronisée** : la commande `command` porte `instanceId` ; le démon réécrit un `createTicket` (sans parent) venu d'une instance synchronisée en `importExternalTicket` avec une réf. d'issue en attente (`number: null`), puis la boîte d'envoi crée l'issue. L'issue créée reçoit les libellés du filtre de la liaison, pour rester dans son périmètre. Un Kanban synchronisé s'ouvre sur le filtre « Tous » (les issues importées n'ont pas d'assigné).
- **N17 · Suppression et rupture** : supprimer un ticket lié ne touche jamais l'issue et l'issue n'est plus réimportée (ligne de sync marquée ignorée) ; une issue supprimée ou transférée (404/410) rompt le lien (`url: null`, badge « Lien GitHub rompu »), sans toucher au ticket.
- **N18 · Écho de secret** : le réseau des intégrations et le proxy des composants remplacent par `***` toute occurrence, dans un corps de réponse, du secret qu'ils viennent d'injecter ; tout message d'erreur conservé en SQLite ou rendu par RPC est en plus caviardé.
- **N19 · Transport MCP stdio** : écrit sur `Bun.spawn` avec un environnement exact (`PATH`, `HOME`, `LANG` + variables secrètes), le transport stdio du SDK ajoutant `LOGNAME`, `SHELL`, `TERM`, `USER` ; un serveur MCP HTTP non loopback passe le contrôle anti-SSRF ; les identifiants réservés (`figma`) sont refusés aux composants.
- **N20 · Notification CI** : `ci.failed` n'est émis qu'une fois par run, et seulement pour un run vu en cours ou terminé depuis moins de 15 min (pas de rafale à la première connexion).
- **N21 · Figma injoignable** : lier un nœud exige le serveur Figma (le nom vient de `get_metadata`) ; l'aperçu, lui, retombe sur le cache (même périmé) avec le badge « Figma non joignable ».
- **N22 · Chemin unique des commandes** : toute commande de projet exécutée par le démon passe par `docs.run(projectId, command, meta)` (nouvelle méthode de `Docs`, implémentée par `service.ts`) : interception, exécution, règles de statut dérivées (après `setStatus`), persistance et observateurs dans une seule transaction SQLite (`Store.transaction`), rechargement du doc depuis SQLite si un observateur ou une commande dérivée échoue, diffusion ; `host.transaction(fn)` (= `Service.transaction`) recharge de même tout projet modifié pendant `fn` si `fn` échoue. L'utilisent : la RPC `command` (avec `instanceId?`), `gate-handlers.ts` (`componentCall run`, meta `{ origin: "user", instanceId }`), `agents/data-port.ts` (`assignTicket`, règles `run_started`/`run_done`, par `docs.trigger`), `Service.triggerRules` (suivi des PR). Les commandes dérivées d'une règle passent par les mêmes observateurs, dans la même transaction, sans redéclencher les règles, avec `origin: "user"` même si le déclencheur vient de la sync. Raison : en phase 4 la porte, les agents et les règles exécutaient `executeProjectCommand` directement ; une modification faite par un agent, une règle (PR fusionnée ⇒ `done`) ou un backend échapperait sinon à la boîte d'envoi.
- **N23 · Codes distants transmis par un backend** : `BACKEND_ERROR_CODES` (`components/host-core.ts`) gagne `REMOTE_UNAVAILABLE`, `REMOTE_REJECTED`, `REMOTE_NOT_FOUND`, `REMOTE_CONFLICT`, `NOT_CONNECTED` (`RATE_LIMITED` y est déjà). Sinon les 409/404/422 de l'adaptateur exécuté dans le Worker deviendraient `INTERNAL` et N4/N17 seraient inapplicables. Ces codes ne donnent aucun pouvoir à un backend (décision 25 de la phase 4 respectée).
- **N24 · Événements d'intégration sur le canal existant** : `ChangeMessage` gagne `IntegrationEvent` ; `host.broadcast(e)` = `docs.emit(e)` ; `createClient` gagne `subscribeIntegrations(listener)` et reconnaît un `IntegrationEvent` (parse Zod) avant le repli « projet ». Pas de `Service.onIntegrationEvent` ni de publication séparée dans `server.ts`.
- **N25 · Notification système réelle** : `host.notify({ title, body })` appelle `DaemonOptions.notify` (mode natif) et diffuse `IntegrationEvent { type: "notice", title, body }`, que l'UI affiche par l'API `Notification` en mode navigateur (comme `use-run-notifications.ts`). La phase 2 n'a pas de règle déclarative sur un événement externe (ses règles ne font que changer un statut) : `ci.failed` n'est pas une règle ; le sondeur CI appelle `host.notify` (« CI cassée sur KIB-n ») ; `IntegrationHost.ruleEvent` et `RuleEvent` sont retirés. Aucune règle de statut par défaut (spec F §7). Même comportement que la spec, formulation « Règle (moteur de la phase 2) » de la spec F §7 corrigée.
- **N26 · Démarrage dans `startDaemon`** : l'hôte et les modules d'intégration sont créés dans `startDaemon` (`daemon.ts`, décision 23 de la phase 4), pas dans `main.ts` ; `main.ts` lit `--test-origins` et `--memory-secrets`, installe le caviardage de la console et passe `DaemonOptions.integrations?: IntegrationFlags` et `DaemonOptions.redactor?` (défaut : aucune origine de test, trousseau système) ; les intégrations sont créées avant `createComponentsService` (qui reçoit leurs `hooks`) et s'arrêtent dans un closer `back`, avant `store.close()`.
- **N27 · Réseau réutilisé** : `createIntegrationFetch` s'appuie sur les briques du proxy de la phase 4 (`isPublicAddress`, `systemResolver`, `checkedAddress`, `pinnedRequest`, `Transport`/`directTransport` épinglé avec SNI, `readCapped`), déplacées dans `components/net-proxy-address.ts` et `net-proxy-body.ts` et réexportées par `net-proxy.ts` ; `integrations/net.ts` n'importe que ces sous-modules (pas de cycle avec `net-proxy.ts`, qui importe `transportUrl` et `secretFor`). `isBlockedAddress` et le `systemResolver` dupliqués disparaissent. Seule une origine de test (`--test-origins`, HTTP en boucle locale) part par `fetch` sans épinglage. `proxyFetch` gagne, par `NetProxyOptions` (`hooks`, `secrets`, `aliasFetch`), les alias de test, l'injection du secret, l'observation des en-têtes et le caviardage de l'écho ; la porte transmet `FetchGrant { net, secrets }`. Un serveur MCP HTTP non loopback passe par le même `fetch` épinglé (`mcp/http-fetch.ts`, Task 15).
- **N28 · Quotas et journaux réutilisés** : un appel de liaison (`binding:<id>`) passe par `createQuotas({ fetchPerMinute: 120 })` de la phase 4 (dépassement : `RATE_LIMITED`) et ses refus vont dans `component_events` ; `integration_events` reste le journal des intégrations (caviardé), `mcp_calls` celui des appels MCP. Le journal des intégrations garde son fichier `integrations/events.ts` ; un module qui importe aussi `components/events.ts` renomme à l'import.
- **N29 · Toasts** : aucun `Toaster` n'est monté en phase 4 ; la phase 5 monte le `Toaster` de `sonner` (déjà dépendance du SDK, ajouté à `packages/ui` sans résolution nouvelle) dans `shell/IntegrationNotices.tsx`, chargé à la demande par `lazyPanel` hors du chargement initial (budget, décision 29 de la phase 4), avec le thème de l'UI ; il affiche les toasts de conflit (N25 : et les `notice` en mode navigateur). Un message lié à une action (connexion réussie, test de connexion) reste un `useFlash` de l'écran 16.
- **N30 · Écran 16 dans les Paramètres** : `Screen` (`schema/src/tabs.ts`) gagne `integrations` (hash `#/settings/integrations`, titre d'onglet, palette, écran différé par `lazyPanel`) ; `SettingsNav` rend `domains` et `integrations` navigables (les autres entrées restent désactivées). La phase 2 n'a livré que « Domaines & guidelines ».
- **N31 · Trousseau lu à la demande** : aucun accès au trousseau système au démarrage du démon ; sa disponibilité est vérifiée par la sonde GitHub et par tout handler qui lit un secret. Raison : `startDaemon` sert aux tests et à l'E2E, qui ne doivent jamais toucher le trousseau réel (invite macOS, erreur libsecret en CI).
- **N32 · Backends intégrés sans UI** (précise N6 et N7) : un intégré sans UI est listé dans `BUILTIN_ADAPTER_IDS` (`schema/src/component.ts`), hors de `BUILTIN_IDS` (qui reste la liste des intégrés affichés : `BUILTIN_COMPONENTS` de l'UI, écran 6) ; `isBuiltinId` couvre les deux. Il est construit par `buildBuiltinBackend` (`packages/devkit/src/build-builtin.ts` : `Bun.build` en CommonJS, `macros: false`, sans le résolveur restreint des composants tiers), parce que `buildComponent` exige une UI et n'autorise que `@kibo/sdk/server` et `@kibo/sdk/migrations`, alors que le code d'un intégré vient du monorepo avec la confiance totale (spec B). Dans le paquet, `apps/desktop/scripts/build-sidecar.ts` le préconstruit dans `builtin/<id>/`, trouvé par `KIBO_BUILTIN_DIR` (remplace `scripts/build-builtin.ts`). L'adaptateur importe `@kibo/sdk/adapter` (nouveau sous-chemin, sans React). `BINDING_PREFIX` et `bindingIdOf` vivent dans `schema` (le démon ne dépend pas du SDK).
- **N33 · Config plate de la Source MCP** : le `configSchema` de la phase 4 n'accepte que des valeurs scalaires (décision 2 de la phase 4) : la config d'instance de `mcp-source` stocke `args` en texte JSON et la correspondance en cinq pointeurs (`itemsPointer`, `idPointer`, `titlePointer`, `subtitlePointer`, `urlPointer`) ; `McpSourceConfig` (Zod) relit cette forme et rend la forme structurée de la spec F §8.3. Comportement inchangé, format de config de la phase 4 non étendu.
- **N34 · `source` hors `configSchema`** : `config.source = { bindingId }` (spec F §3.2) n'est pas déclaré dans le `configSchema` de Kanban et Tickets (valeurs scalaires seulement) ; c'est une clé posée par le shell à l'écran 3 et lue par `readSource`. `validateConfig` ne s'applique qu'à la mise à jour d'une version publiée, jamais à un intégré.
- **N35 · Commandes réservées** : `upsertExternalRef`, `removeExternalRef`, `importExternalTicket`, `addBinding`, `removeBinding` valent `null` dans `COMMAND_WRITES` (réservées au shell et au démon, spec F §3.1). En phase 3 et 4, `upsertExternalRef` était ouverte à tout composant qui écrit `ticket` : un composant tiers pourrait forger une réf. `github_issue` et faire pousser des issues avec le compte de l'utilisateur. `assertShellCommand` ne change pas (le shell garde ces commandes). Dans le périmètre de la spec (application de §3.1).
- **N36 · Permissions `secret:` et `mcp:`** : `GrantedPermissions` gagne `secrets` et `mcp` (défaut `[]` pour les versions déjà approuvées) ; `secret:<name>` apparaît comme permission « non utilisée » dans le rapport de validation (aucune inférence statique ne la détecte), sans effet sur le verdict (seules les permissions manquantes font échouer).
- **N37 · Statut distant refusé** (précise §5.4) : `closed` suit `statusId` dans la fusion ; un changement distant de `closed` n'est appliqué que s'il concorde avec le statut de la base suivante. Un statut distant refusé (`blocked`) n'est jamais appliqué ; s'il accompagne la réouverture d'une issue dont la base est `done`, le ticket passe à `todo` et la base aussi, comme à l'import (Task 14 `importRemote`) et comme une issue rouverte sans Project. Le Project garde son option `Blocked`, le ticket reste ouvert, rien n'est repoussé. Raison : appliquer `closed = false` sans le statut rendait la base incohérente (`done` et ouverte) et l'issue était refermée au cycle suivant ; ignorer la réouverture laissait un ticket `done` sur une issue ouverte.
- **N38 · Statut local inchangé** (précise N3) : `projectLocal` garde le statut de la base quand le statut local lui est égal, sans le projeter. Raison : la base peut porter un statut non canonique (`todo` par défaut d'une issue sans option alors que `todo` partage son option avec `backlog`, ou base calculée avec une ancienne correspondance) ; le projeter produisait une modification fantôme poussée à chaque cycle.
- **N39 · Curseur figé pendant une création incertaine** (précise N5) : tant qu'une création de la liaison est incertaine, le pull applique les issues déjà liées mais ne sauve pas son curseur ; au premier pull après la résolution (création adoptée ou abandonnée), il repart du dernier curseur sauvé et importe les issues nouvelles qu'il avait sautées. Raison : le curseur est opaque (Task 13) et avance au-delà des issues non importées ; le sauver les perdait jusqu'à leur prochaine modification sur GitHub.
- **N40 · Observation de la limite GitHub** (précise spec F §5.5) : la porte de débit n'observe que les réponses d'`api.github.com` à une requête qui portait le jeton du démon (réseau des intégrations : `bearer` non nul ; proxy des composants : secret injecté) ; une réponse dont `x-ratelimit-resource` est présent et n'est ni `core` ni `graphql` est ignorée ; `retry-after` (secondes) ou un reste sous 100 ne font qu'allonger la pause (`until = max(until, …)`), jamais la raccourcir ni la lever. Raison : une requête anonyme (quota de 60/h, reste toujours sous 100) d'un composant tiers autorisé sur `api.github.com` suspendait toutes les liaisons GitHub jusqu'au reset ; une réponse ordinaire effaçait la pause d'une limite secondaire (`retry-after`).
- **N41 · Consentement au secret par hôte** (précise N36) : `permissionList` rend une entrée par couple secret × hôte, `secret:<name>@<host>` (ex. `secret:github@api.github.com`) ; `addedPermissions` signale donc aussi un hôte ajouté à un secret déjà accordé. Raison : avec `secret:<name>` seul, une nouvelle version qui ajoutait à `github` un hôte déjà couvert par `net` recevait le jeton sans que l'écran 30 ni la publication ne l'annoncent.
- **N42 · Drapeaux de test indissociables** (décision du chef d'équipe) : `--test-origins` et `--memory-secrets` vont ensemble ; l'un sans l'autre fait échouer le démarrage (`failStart`, code 1). Raison : un vrai jeton du trousseau ne doit jamais partir en HTTP vers une origine de test en boucle locale.
- **N43 · Création incertaine** (décision du chef d'équipe, révisée après relecture de la tâche 14) : une création GitHub compte plusieurs écritures (issue, fermeture, Project) et un refus peut survenir après le `POST` ; un échec ne prouve donc jamais que l'issue n'existe pas. Toute tentative de création rend la création incertaine (marqueur posé sur la ligne d'envoi au moment de la tentative) jusqu'à l'adoption ou l'abandon, et bloque les imports de la liaison (N39). Chaque nouvel essai passe `since: firstAttemptAt` pour tenter l'adoption (N5). Une vraie 422 bloque donc les imports jusqu'au « Réessayer » ou à l'« Abandonner » de l'utilisateur ; rien n'est perdu (curseur figé, N39).
- **N44 · Réponse compressée malgré `identity`** (décision du chef d'équipe) : quand un secret a été injecté, une réponse dont `content-encoding` n'est ni absent ni `identity` est refusée (échec fermé, `KiboError` réseau, corps jamais transmis), dans le proxy des composants comme dans le réseau des intégrations. Raison : le caviardage porte sur les octets ; un corps compressé l'éviterait.
- **N45 · Hôtes du secret `github`** (décision du chef d'équipe) : le secret réservé `github` n'est injecté que vers `api.github.com` et `uploads.github.com`. Un manifeste qui déclare `github` pour un autre hôte est refusé à la validation (`INVALID_MANIFEST`), et `secretFor` le refuse aussi à l'exécution (défense en profondeur). Raison : le secret peut être le jeton de `gh`, aux portées larges.
- **N46 · Trousseau indisponible** (décision du chef d'équipe) : en mode jeton personnel, la sonde `github` renvoie `error` avec `SECRET_STORE_UNAVAILABLE` quand `availability()` échoue ; le délai borné du trousseau et le regroupement des appels en cours garantissent que `listIntegrations` ne se fige jamais.
- **N47 · Quota des appels MCP** (décision du chef d'équipe) : en plus du quota générique `call`, un quota `mcpPerMinute` de 30 appels par minute et par instance ; au-delà, `RATE_LIMITED`, refus journalisé. Raison : un appel MCP peut durer 60 s et lancer un processus stdio.
- **N48 · Serveur MCP en boucle locale** (décision du chef d'équipe) : un serveur MCP HTTP en boucle locale (`127.0.0.1`, `[::1]`, `localhost`) est joint sans épinglage, mais aucune redirection n'est suivie ; `localhost` n'est accepté que s'il résout vers une adresse de boucle locale. Les arguments et variables d'un serveur stdio refusent les caractères de contrôle et bidi, et les noms `PATH`, `HOME`, `LANG` (environnement minimal non surchargeable).

## Écrans à dessiner dans Penpot (avant les tâches UI)

Le chef d'équipe les dessine en sombre et en clair (page `04 · Workspace & paramètres` et `03 · Pages projet`), réexporte `kibo.penpot.xz` et les PDF, puis lance les tâches UI concernées. Libellés exacts : `packages/ui/src/i18n/fr-integrations.ts` (Task 1).

| Id | Écran | Contenu et états | Tâche |
|---|---|---|---|
| P1 | Écran 16, états | ligne « Connecter » (bouton secondaire à droite, sans `⋯`) ; ligne « Erreur » (pastille rouge, libellé « Erreur », message court en sous-texte rouge, bouton « Réessayer », `⋯`) ; ligne « Limite GitHub atteinte, reprise à 14:32 » (pastille ambre) ; menu `⋯` ouvert (Configurer, Tester la connexion, séparateur, Déconnecter en rouge) ; dialogue « Déconnecter GitHub ? » (texte, Annuler / Déconnecter destructif) ; bandeau « Trousseau système indisponible… » en haut de la liste | 10 |
| P2 | Connecter GitHub | dialogue 480 px : titre, sous-titre ; deux cartes radio « Utiliser gh » (badge « Recommandé », état « gh est connecté (adam) » ou « gh n'est pas installé… » et carte désactivée) et « Jeton personnel » (champ mot de passe, portées requises en texte secondaire) ; pied Annuler / Connecter ; état « Vérification… » (bouton avec spinner) ; erreur « GitHub a refusé ce jeton. » sous le champ ; succès = fermeture + toast « Connecté en tant que adam » | 11 |
| P3 | Connecter Figma | dialogue : champ « Adresse du serveur » pré-rempli `http://127.0.0.1:3845/mcp`, aide ; erreurs « Serveur Figma injoignable… » et « Ce serveur n'expose pas les outils Figma attendus… » | 11 |
| P4 | Serveurs MCP | dialogue liste (Configurer sur « Serveurs MCP ») : une ligne par serveur (nom, `id`, type, « n outils », interrupteur Activé, pastille d'état, « Retirer ») ; état vide ; bouton « Ajouter un serveur » | 11 |
| P5 | Ajouter un serveur MCP | étape 1 : Nom, Identifiant, Type (cartes « Commande locale (stdio) » / « Adresse HTTP »), Commande, Arguments (un par ligne), Variables secrètes (paires nom / valeur masquée, « Ajouter une variable ») ou Adresse + Jeton ; étape 2 « Confirmer la commande » : bloc monospace avec la commande exacte, texte d'environnement réduit, Retour / « Ajouter et lancer » | 11 |
| P6 | Écran 3, source synchronisée | sous le catalogue, bloc « Source » : cartes « Locale » / « Synchronisée · GitHub Issues » ; si GitHub non connecté : texte + lien « Ouvrir les intégrations » ; formulaire : Dépôt (liste filtrable), Project (select, « Aucun Project »), table « Correspondance des statuts » (statut Kibo avec pastille → select d'options, « Non envoyé »), « Filtrer par libellés », case « Importer aussi les issues fermées » ; bouton « Ajouter et synchroniser » ; état progression « Synchronisation… 12 issues importées » ; erreur de première sync | 17 |
| P7 | Sheet ticket, GitHub | chips dans l'en-tête : `#42` (issue, icône cercle ouvert / fermé) et `#12` (PR) ; ligne d'état « Synchronisation en attente » (icône horloge) ; bandeau d'échec (message, Réessayer / Abandonner) ; badge « Lien GitHub rompu » + aide | 18 (implémentation : chips d'issue sur la ligne « Issue » des propriétés, à côté des chips de PR de la phase 3 ; écart d'emplacement assumé, voir Task 18) |
| P8 | Sheet ticket, CI | section « CI » sous Dépendances : une ligne par workflow (pastille réussite / échec / en cours, nom, durée, « Voir les logs ») ; état vide ; Sheet de logs (titre « Logs · build », champ de recherche, bascule « Erreurs seulement », lignes numérotées monospace, lignes d'erreur surlignées en rouge atténué, mention « Log tronqué à 20 Mio. ») | 18 |
| P9 | Sheet ticket, Maquettes | propriété « Maquette » (nom du premier nœud, lien) ; section « Maquettes » : vignettes 16:10 avec nom, badge « Figma non joignable » ou « Aperçu indisponible », « Retirer » ; champ « Colle l'URL d'un nœud Figma… » + « Lier un nœud Figma » ; erreur URL invalide | 18 |
| P10 | Widget Source MCP | carte de widget : titre de l'instance, liste d'éléments (titre, sous-titre, lien externe, bouton « Créer un ticket » ou puce « KIB-31 » si déjà importé), pied « Mis à jour il y a 3 min · Rafraîchir » ; états vide, erreur (« Serveur MCP injoignable »), chargement ; étape de config à l'écran 3 (serveur, mode Outil / Ressource, outil, arguments JSON, correspondance des champs `items`, `id`, `title`, `subtitle`, `url`, rafraîchissement en minutes) | 22 |
| P11 | Kanban / Tickets synchronisés | en-tête d'instance « GitHub · adam/kibo » + bouton « Synchroniser » ; chip CI sur une carte (pastille verte, rouge ou ambre à côté de `#12`) ; état « Liaison supprimée » | 21 |

## File Structure

```
packages/schema/src/
  integrations.ts          RepoSlug, WebUrl, SecretName, refs GitHub/Figma/MCP, Binding, SyncedFields, PushOp, MappedRemote, PullPage, IntegrationId/Status, CI, MCP, SyncState, IntegrationEvent (dont notice), BINDING_PREFIX, bindingIdOf
  integrations-rpc.ts      INTEGRATION_RPC (Zod) + IntegrationRpcResult
  status-projection.ts     remoteStatusId, projectStatus (N3)
  github-graphql.ts        requêtes GraphQL partagées (adaptateur, compte, faux GitHub)
  github-errors.ts         githubError
  mcp-rules.ts             mcpCovered, secretHostsCovered
  external-ref.ts          (phase 3) GithubPrRef extrait, union étendue, externalRefKey
  errors.ts manifest.ts call.ts permissions.ts command.ts component.ts rpc.ts tabs.ts index.ts   (modifiés)
packages/core/src/
  bindings.ts              addBinding, removeBinding, listBindings, getBinding
  external-refs.ts         (nouveau) upsertExternalRef déplacé de tickets.ts, clés par type, removeExternalRef, findTicketByRef, importExternalTicket
  sync-plan.ts             projectLocal, planSync, settleAfterPush, canApplyRemote, canonicalFields
  tickets.ts commands.ts context.ts index.ts   (modifiés : readExternalRefs validé, nouvelles commandes, section Maquettes du brief)
packages/devkit/src/       build-builtin.ts (N32) ; infer-permissions.ts validate.ts fr.ts (modifiés)
packages/daemon/src/
  store.ts docs.ts service.ts daemon.ts main.ts server.ts agents/data-port.ts   (modifiés, N22, N24 à N26)
  components/              gate.ts gate-handlers.ts service.ts host-core.ts net-proxy.ts net-proxy-address.ts net-proxy-body.ts (modifiés, N23, N27)
  integrations/            types.ts host.ts db.ts redact.ts events.ts settings.ts registry.ts methods.ts bootstrap.ts
                           memory-secret-store.ts bun-secret-store.ts github-remote.ts probes.ts
                           net.ts rate-limit.ts testing/fake-host.ts
  github/                  auth.ts api.ts handlers.ts
  sync/                    hash.ts sync-store.ts outbox.ts apply.ts engine.ts scheduler.ts module.ts
                           worker-runner.ts binding-calls.ts builtin-adapter.ts testing/memory-runner.ts
  ci/                      ci-store.ts poller.ts logs.ts module.ts fr.ts
  mcp/                     config-store.ts command-line.ts stdio-transport.ts http-fetch.ts result.ts connection.ts hub.ts component-gate.ts module.ts
  figma/                   figma-url.ts figma.ts module.ts
  testing/                 fake-github.ts fake-github-graphql.ts fake-mcp.ts fake-mcp-stdio.ts
  code/testing/fake-gh.ts  (modifié : auth token)
packages/sdk/src/          adapter.ts (sous-chemin @kibo/sdk/adapter) source.ts ui/switch.tsx (+ types.ts sdk.ts mock.ts client.ts conformance.tsx index.ts modifiés)
packages/ui/src/
  i18n/fr-integrations.ts
  settings/                IntegrationsPage.tsx IntegrationRow.tsx integration-rows.ts integration-dialogs.ts DisconnectDialog.tsx (+ SettingsNav.tsx modifié)
  dialogs/integrations/    GithubConnectDialog.tsx FigmaConnectDialog.tsx McpServersDialog.tsx McpServerDialog.tsx mcp-form.ts
  dialogs/sync/            SourcePicker.tsx SyncSourceForm.tsx status-map.ts use-sync-progress.ts
  dialogs/mcp-source/      McpSourceStep.tsx (étape de config à l'écran 3)
  shell/sheet/             GithubRefs.tsx SyncStatus.tsx CiSection.tsx CiLogSheet.tsx FigmaSection.tsx log-lines.ts ci-format.ts
  shell/                   IntegrationNotices.tsx (Toaster, conflits, notice : N25, N29) ; TicketDetail.tsx lazy-screens.ts ScreenView.tsx Shell.tsx AppSidebar.tsx (modifiés)
  pages/                   SourceHeader.tsx (+ PageView.tsx modifié)
  state/                   use-integrations.ts use-sync-state.ts
  lib/permission-lines.ts  (modifié : lignes secret et MCP de l'écran 30)
components/github-issues/  kibo.component.json package.json tsconfig.json src/{remote.ts,map.ts,cursor.ts,rest.ts,project.ts,adapter.ts,server.ts,index.ts}
components/mcp-source/     kibo.component.json package.json tsconfig.json src/{McpSource.tsx,SourceItemRow.tsx,config.ts,extract.ts,index.ts,fr.ts}
apps/desktop/              scripts/build-sidecar.ts (préconstruit builtin/<id>/, N32) src-tauri/{tauri.conf.json,src/main.rs} (KIBO_BUILTIN_DIR)
e2e/                       integrations.spec.ts (+ serve.ts, token.ts, playwright.config.ts modifiés)
```

## Vagues d'exécution

Une vague démarre quand les tâches dont elle dépend sont intégrées dans `main` (une tâche peut partir plus tôt si sa colonne « Dépend de » est satisfaite). Chaque vague compte au plus quatre tâches confiées en parallèle (un `kibo-dev` par tâche, worktree `.claude/worktrees/p5-t<n>`, branche `feat/p5-t<n>`). Dans une vague, les fichiers touchés sont disjoints, sauf les lignes d'enregistrement listées en bas du tableau.

| Vague | Tâche | Fichiers touchés (périmètre) | Dépend de | Penpot |
|---|---|---|---|---|
| V0 | 1 Contrats | `schema/src/{integrations,integrations-rpc,status-projection,github-graphql,github-errors,mcp-rules,errors,manifest,rpc,index}`, `sdk/src/{adapter,index,conformance}`, `sdk/package.json`, `ui/src/i18n/{fr-integrations,fr}`, `ui/src/dialogs/catalog-choices.ts`, deux tests à manifeste littéral, `CLAUDE.md` | T0 | — |
| V0 | 7 Faux MCP | `daemon/package.json`, `bun.lock`, `daemon/src/testing/fake-mcp*` | T0 | — |
| V1 | 2 Socle démon | `daemon/src/{store,docs,service,server,daemon,main}.ts`, `components/{gate,gate-handlers}.ts`, `agents/data-port.ts`, `integrations/*`, `schema/src/rpc.ts` (`command.instanceId`), `sdk/src/client.ts` | 1 ; **30b** (phase 4) | — |
| V1 | 4 Réfs et liaisons | `schema/src/{external-ref,command,rpc,component.test}`, `core/src/{external-refs,bindings,tickets,commands,index}`, 11 tests à `ProjectSnapshot` littéral (ui, `agents/orchestrator.test.ts`) | 1 | — |
| V1 | 5 Fusion à trois | `core/src/{sync-plan,index}` | 1 | — |
| V1 | 6 Faux GitHub | `daemon/src/testing/fake-github*` | 1 | — |
| V2 | 3 Trousseau | `integrations/{bun-secret-store,bootstrap}` | 2 | — |
| V2 | 8 Réseau | `components/{net-proxy,net-proxy-address,net-proxy-body,gate,gate-handlers,service}.ts`, `daemon.ts`, `integrations/{net,rate-limit,bootstrap}`, `schema/src/permissions.ts`, `core/src/registry.test.ts`, `ui/src/lib/permission-lines.test.ts` | 2, 6 ; **30b** | — |
| V2 | 13 Adaptateur GitHub Issues | `components/github-issues/**`, `package.json` (typecheck), `bun.lock`, `schema/src/component.ts` (`BUILTIN_ADAPTER_IDS`), `sdk/package.json` (sous-chemin) | 1, 6 | — |
| V2 | 10 Écran 16 | `ui/src/settings/*`, `ui/src/state/{use-integrations,use-sync-state}`, `sdk/src/ui/switch.tsx`, `schema/src/tabs.ts`, `ui/src/tabs/{target-hash,screens}`, `ui/src/palette/*`, `ui/src/shell/{lazy-screens,ScreenView,AppSidebar}` | 1, 2 ; **34** (phase 4, `settings/`) | P1 |
| V3 | 9 SDK et permissions | `schema/src/{manifest,call,permissions,schema.test}`, `sdk/src/{types,sdk,mock,conformance,index,source}`, `components/{gate,gate-handlers,gate.test}`, `devkit/src/{infer-permissions,validate,fr}`, `ui/src/lib/permission-lines*`, `core/src/registry.test.ts` | 1, 2, 4, 8 | — |
| V3 | 12 Compte GitHub | `daemon/src/github/*`, `integrations/bootstrap`, `code/testing/{fake-gh,fixture.test}` | 2, 6, 8 | — |
| V3 | 14 Moteur de sync | `daemon/src/sync/{hash,sync-store,outbox,apply,engine,scheduler,module}`, `sync/testing/memory-runner`, `integrations/bootstrap` | 2, 4, 5, 8 | — |
| V3 | 11 Dialogues de connexion | `ui/src/dialogs/integrations/*`, `ui/src/settings/integration-dialogs.ts` | 10 | P2 à P5 |
| V4 | 15 Hub MCP | `daemon/src/mcp/*`, `integrations/bootstrap` | 1, 2, 4, 7, 8, 9 | — |
| V4 | 16 GitHub Actions | `daemon/src/ci/*`, `integrations/bootstrap` | 2, 6, 8, 12 | — |
| V4 | 17 Source synchronisée | `ui/src/dialogs/sync/*`, `ui/src/dialogs/{AddComponentDialog,component-dialogs.test}`, `ui/src/pages/PageView.tsx`, `ui/src/i18n/fr-components.ts` | 1, 2, 10 ; intégrée après 12 et 14 (handlers `getGithubConnectOptions`, `createBinding`, `getSyncState`) | P6 |
| V4 | 18 Sheet ticket | `ui/src/shell/sheet/*`, `ui/src/shell/TicketDetail.tsx`, `fr-integrations.ts` (`sheet`) | 1, 2, 4, 10 ; intégrée après 16 et 20 (handlers `listCiRuns`, `getCiLog`, `getFigmaPreview`, `linkFigmaNode`) | P7 à P9 |
| V5 | 19 Adaptateur dans le Worker | `daemon/src/sync/{worker-runner,binding-calls,builtin-adapter,roundtrip.test}`, `components/host-core*`, `devkit/src/{build-builtin,index}`, `integrations/bootstrap`, `apps/desktop/{scripts/build-sidecar.ts,package.json,tsconfig.json,src-tauri/tauri.conf.json,src-tauri/src/main.rs}`, `.gitignore`, `bun.lock` | 1, 2, 4, 6, 8, 12, 13, 14 ; **34** | — |
| V5 | 20 Figma | `daemon/src/figma/*`, `testing/fake-mcp.ts` (`omit`), `integrations/bootstrap`, `core/src/context*` | 1, 2, 4, 7, 15 | — |
| V5 | 21 Kanban et Tickets synchronisés | `sdk/src/{source,types,sdk,client}*`, `components/{kanban,tickets}/*`, `ui/src/pages/{SourceHeader,PageView}`, `ui/src/shell/{IntegrationNotices,lazy-screens,Shell}`, tests du shell, `ui/src/dialogs/{NewTicketDialog,dialogs.test}`, `ui/package.json`, `bun.lock`, `fr-integrations.ts` (`instance`) | 1, 2, 4, 9, 10, 14 | P11 |
| V5 | 22 Source MCP | `components/mcp-source/**`, `package.json` (typecheck), `bun.lock`, `schema/src/component.ts` (`BUILTIN_IDS`), `sdk/src/conformance.tsx`, `ui/{package.json,tsconfig.json,src/registry.ts}`, `ui/src/dialogs/{AddComponentDialog,mcp-source/*}`, `fr-integrations.ts` (`mcpSource`) | 1, 9, 13, 15, 17 | P10 |
| V6 | 23 Test de fuite et E2E | `daemon/src/integrations/leak.test.ts`, `e2e/{integrations.spec,serve,token,playwright.config}`, `testing/{fake-github,fake-mcp}.ts` (`port`) | toutes ; 34 | — |
| Jalon | v0.5 | — | 23 | — |

Conflits attendus et triviaux dans une même vague (une ligne ou un bloc chacun, résolus au rebase par le chef d'équipe) : `packages/daemon/src/integrations/bootstrap.ts` (un module par tâche : 3 et 8 en V2 ; 12 et 14 en V3 ; 15 et 16 en V4 ; 19 et 20 en V5), `bun.lock` et `package.json` racine (script `typecheck` : 13 en V2 ; 21 et 22 en V5 : `bun install` puis concaténation), `packages/ui/src/i18n/fr-integrations.ts` (blocs `instance` en 21 et `mcpSource` en 22), `packages/ui/src/pages/PageView.tsx` (17 en V4, puis 21 en V5), `packages/ui/src/dialogs/AddComponentDialog.tsx` (17 en V4, puis 22 en V5), `packages/sdk/src/conformance.tsx` (1, 9, 22 : vagues distinctes), `packages/schema/src/component.ts` (13 puis 22). Les couples qui modifient les mêmes fonctions sont sérialisés par leurs dépendances : 8 puis 9 (`permissions.ts`, `gate.ts`, `gate-handlers.ts`), 2 puis 21 (`sdk/src/client.ts`), 2 puis 8 (`daemon.ts`, `gate-handlers.ts`), 10 puis 21 (`lazy-screens.ts`).

Chemin critique : 1 → 2 (après 30b) → 8 → 14 → 19 (après 34) → 23. Si 30b tarde, V1 lance quand même 4, 5 et 6, et V2 la tâche 13 ; si 34 tarde, 10 et 19 attendent seules (11, 17, 18 et 21 suivent 10).

Tâches à risque, relues aussi par `kibo-lead` (en plus de `kibo-reviewer`) :

| Tâche | Motif |
|---|---|
| 2 | persistance transactionnelle et restauration (N22), caviardage de la console et des erreurs RPC, chemin des commandes des backends |
| 3 | secrets (trousseau système, aucun repli en clair, N31) |
| 4 | fermeture de `upsertExternalRef` et des nouvelles commandes aux composants (N35) |
| 8 | réseau (anti-SSRF, épinglage, redirections) et injection du secret dans le proxy des composants (N27) |
| 9 | porte `componentCall` (permissions `mcp`, `secrets`, `ci_run`) |
| 12 | secrets (jeton personnel, jeton de `gh`) |
| 15 | MCP : lancement de processus (stdio, env réduit, groupe de processus), réseau (HTTP épinglé), secrets |
| 19 | chemin `fetch` qui porte le jeton GitHub, Worker hors registre, construction sans le résolveur restreint (N32) |
| 23 | test de fuite de secret, drapeaux `--memory-secrets` et `--test-origins` en E2E |

---

### Task 1: Contrats partagés

Fige tous les types échangés entre tâches. Aucune logique métier ; tout est testé par parsing.

**Files:**
- Create: `packages/schema/src/integrations.ts`, `packages/schema/src/integrations-rpc.ts`, `packages/schema/src/status-projection.ts`, `packages/schema/src/github-graphql.ts`, `packages/schema/src/github-errors.ts`, `packages/schema/src/mcp-rules.ts`, `packages/schema/src/integrations.test.ts`
- Modify: `packages/schema/src/errors.ts` (tableau `KIBO_ERROR_CODES`), `packages/schema/src/manifest.ts`, `packages/schema/src/rpc.ts` (`RpcRequest`, `RpcResult`, `ChangeMessage`), `packages/schema/src/index.ts`
- Create: `packages/sdk/src/adapter.ts`, `packages/sdk/src/adapter.test.ts` ; Modify: `packages/sdk/src/index.ts`, `packages/sdk/package.json` (`"zod": "3.25.76"`, déjà verrouillé par `schema` : aucune version nouvelle), `packages/sdk/src/conformance.tsx` (un `kind: "adapter"` n'a aucune surface de rendu)
- Create: `packages/ui/src/i18n/fr-integrations.ts` ; Modify: `packages/ui/src/i18n/fr.ts`, `packages/ui/src/dialogs/catalog-choices.ts` (`mineChoices` écarte `kind: "adapter"`, N6)
- Modify (manifestes littéraux typés `ComponentManifest`, qui gagnent `secrets: []` et `mcp: []`) : `packages/ui/src/dialogs/component-dialogs.test.tsx`, `packages/ui/src/pages/instance.test.tsx`
- Modify: `CLAUDE.md` (monorepo : `components/github-issues/`, `components/mcp-source/`)
- Vérifier (sans modifier) : `docs/superpowers/specs/2026-09-26-kibo-integrations.md` §14 « Décisions du plan », déjà écrite par la tâche T0 (N1 à N36)

**Interfaces:**
- Consumes: `StatusId`, `NodeId`, `KiboErrorCode`, `ComponentManifest` (phase 4, avec `net`), `defineServer` (`@kibo/sdk/server`, phase 4), `KiboSdk["fetch"]` (phase 4).
- Produces (schema) :
  - `RepoSlug`, `WebUrl`, `McpServerId`, `EnvName`, `SecretName` (type gabarit) + `SecretNameSchema`, `RESERVED_MCP_IDS = ["figma"]`
  - `GithubIssueRef`, `FigmaNodeRef`, `McpItemRef` (Zod + types) ; `githubIssueState(ref): "pending" | "linked" | "broken"`
  - `StatusMap`, `BindingConfig`, `Binding`, `InstanceSource`
  - `SyncedFields`, `PushOp`, `MappedRemote`, `PullPage`, `PullInput`
  - `IntegrationId`, `IntegrationState`, `IntegrationStatus`
  - `CiJobSummary`, `CiRun`, `CiLog`
  - `McpServerInput`, `McpServerView`, `McpToolInfo`, `McpContent`, `McpCallResult`, `McpImportItem`
  - `FigmaPreview`, `GithubRepo`, `GithubProject`, `GithubConnectOptions`
  - `BindingState`, `OutboxError`, `SyncState`, `SyncReport`, `IntegrationEvent` (dont `{ type: "notice", title, body }`, N25)
  - `ChangeMessage` (phase 1, `rpc.ts`) gagne `IntegrationEvent` (N24)
  - `INTEGRATION_RPC`, `IntegrationRpcRequest`, `IntegrationRpcResult`
  - `remoteStatusId(closed, optionId, map)`, `projectStatus(statusId, map, fallback)`
  - `GITHUB_GRAPHQL: { projectItems, addItem, setStatus, issueItems, listProjects }`
  - `githubError(status: number, header: (name: string) => string | null, body: string): KiboError` (partagé par le démon et l'adaptateur)
  - `mcpCovered(rules, server, tool, config | null)`, `secretHostsCovered(manifest): string[]`
  - `ComponentManifest` : `kind` accepte `"adapter"` ; `secrets: { name: SecretName; hosts: string[] }[]` ; `mcp: string[]`
  - codes `KiboError` ajoutés à `KIBO_ERROR_CODES` : `SECRET_STORE_UNAVAILABLE`, `NOT_CONNECTED`, `REMOTE_UNAVAILABLE`, `REMOTE_REJECTED`, `REMOTE_NOT_FOUND`, `REMOTE_CONFLICT`, `MCP_UNAVAILABLE`, `MCP_FAILED` (`RATE_LIMITED` et `TIMEOUT` existent depuis la phase 4)
- Produces (sdk) : `Adapter<R, C>`, `AdapterContext<C>`, `defineAdapter`, `mapRemote`, `adapterActions` ; réexporte `BINDING_PREFIX` et `bindingIdOf` de `schema`
- Produces (schema, `integrations.ts`) : `BINDING_PREFIX = "binding:"`, `bindingIdOf(instanceId)` (le démon ne dépend pas du SDK : Task 19)
- Produces (ui) : `frIntegrations` (tous les textes de la phase), exposé en `fr.integrations`.

- [x] **Step 1: Vérifier les décisions dans la spec, mettre à jour le monorepo**

La section `## 14. Décisions du plan` de `docs/superpowers/specs/2026-09-26-kibo-integrations.md` a été écrite par la tâche T0 ; vérifier qu'elle recopie mot pour mot les puces N1 à N36 de ce plan (une différence ⇒ corriger la spec d'abord, conformément à `CLAUDE.md`). Mettre à jour la liste du monorepo de `CLAUDE.md` :

```
components/<id>/     composants intégrés (kanban, tickets, github-issues sans UI, mcp-source…) écrits avec le SDK public
```

- [x] **Step 2: Écrire le test des schémas (échoue : modules absents)**

`packages/schema/src/integrations.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import {
  Binding,
  ComponentManifest,
  FigmaNodeRef,
  GithubIssueRef,
  githubIssueState,
  IntegrationEvent,
  githubError,
  McpItemRef,
  McpServerInput,
  mcpCovered,
  MappedRemote,
  projectStatus,
  PushOp,
  RepoSlug,
  RpcRequest,
  remoteStatusId,
  SecretNameSchema,
  secretHostsCovered,
  WebUrl,
} from "./index";

describe("integration contracts", () => {
  test("repo slugs follow owner/name", () => {
    expect(RepoSlug.safeParse("adam/kibo").success).toBe(true);
    expect(RepoSlug.safeParse("adam/kibo.js").success).toBe(true);
    expect(RepoSlug.safeParse("adam").success).toBe(false);
    expect(RepoSlug.safeParse("../etc/passwd").success).toBe(false);
  });

  test("web urls refuse other schemes", () => {
    expect(WebUrl.safeParse("https://github.com/adam/kibo/issues/1").success).toBe(true);
    expect(WebUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(WebUrl.safeParse("data:text/html,x").success).toBe(false);
    expect(McpItemRef.safeParse({ kind: "mcp_item", server: "ctx", itemId: "1", url: "javascript:x", title: "T" }).success).toBe(false);
  });

  test("secret names are scoped", () => {
    for (const ok of ["github", "figma", "mcp:context7", "mcp:context7:API_KEY"]) {
      expect(SecretNameSchema.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["aws", "github:", "mcp:Bad", "mcp:ctx:lower", ""]) {
      expect(SecretNameSchema.safeParse(ko).success).toBe(false);
    }
  });

  test("github issue refs expose pending, linked and broken", () => {
    const ref = GithubIssueRef.parse({ kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: null, nodeId: null, url: null });
    expect(githubIssueState(ref)).toBe("pending");
    expect(githubIssueState({ ...ref, number: 4, nodeId: "I_4", url: "https://github.com/adam/kibo/issues/4" })).toBe("linked");
    expect(githubIssueState({ ...ref, number: 4, nodeId: "I_4", url: null })).toBe("broken");
  });

  test("figma node refs need a file key and a node id", () => {
    const ok = { kind: "figma_node", fileKey: "AbCdEf123456", nodeId: "12:34", url: "https://www.figma.com/design/AbCdEf123456/Kibo?node-id=12-34", name: "Tickets" };
    expect(FigmaNodeRef.safeParse(ok).success).toBe(true);
    expect(FigmaNodeRef.safeParse({ ...ok, nodeId: "12-34" }).success).toBe(false);
  });

  test("a binding config defaults filters and validates the status map", () => {
    const b = Binding.parse({
      id: "b1",
      adapter: "github-issues",
      config: { repo: "adam/kibo", project: null },
      createdBy: "adam",
      runner: "adam",
    });
    expect(b.config.labels).toEqual([]);
    expect(b.config.importClosed).toBe(false);
    expect(
      Binding.safeParse({ ...b, config: { ...b.config, project: { owner: "adam", number: 1, nodeId: "P", statusFieldId: "F", statusMap: { nope: "x" } } } }).success,
    ).toBe(false);
  });

  test("push ops and mapped remotes are strict", () => {
    const fields = { title: "T", description: "", statusId: "todo", closed: false };
    expect(PushOp.safeParse({ kind: "create", ticketId: "1@1", fields, since: null }).success).toBe(true);
    expect(PushOp.safeParse({ kind: "update", remoteId: "4", patch: { title: "U" } }).success).toBe(true);
    expect(PushOp.safeParse({ kind: "delete", remoteId: "4" }).success).toBe(false);
    const ref = { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 4, nodeId: "I_4", url: "https://github.com/adam/kibo/issues/4" };
    expect(MappedRemote.safeParse({ remoteId: "4", updatedAt: "2026-09-26T10:00:00Z", fields, ref, labels: [] }).success).toBe(true);
    expect(MappedRemote.safeParse({ remoteId: "4", updatedAt: "hier", fields, ref, labels: [] }).success).toBe(false);
  });

  test("mcp server input requires https unless loopback and refuses reserved ids", () => {
    const stdio = { transport: "stdio", id: "ctx", name: "Context7", command: "npx", args: ["-y", "@upstash/context7-mcp"] };
    const parsed = McpServerInput.parse(stdio);
    expect(parsed.transport === "stdio" ? parsed.envNames : null).toEqual([]);
    expect(McpServerInput.safeParse({ ...stdio, id: "figma" }).success).toBe(false);
    const http = { transport: "http", id: "fs", name: "FS", url: "http://127.0.0.1:9000/mcp" };
    expect(McpServerInput.safeParse(http).success).toBe(true);
    expect(McpServerInput.safeParse({ ...http, url: "http://10.0.0.2/mcp" }).success).toBe(false);
    expect(McpServerInput.safeParse({ ...http, url: "https://mcp.example.com/mcp" }).success).toBe(true);
  });

  test("status projection is consistent on both sides", () => {
    const map = { todo: "O1", in_progress: "O2", in_review: "O2", done: "O3" };
    expect(remoteStatusId(true, "O1", map)).toBe("done");
    expect(remoteStatusId(false, "O2", map)).toBe("in_progress");
    expect(remoteStatusId(false, "O3", map)).toBe("todo");
    expect(remoteStatusId(false, null, null)).toBe("todo");
    expect(projectStatus("in_review", map, "todo")).toBe("in_progress");
    expect(projectStatus("blocked", map, "in_progress")).toBe("in_progress");
    expect(projectStatus("in_progress", null, "done")).toBe("todo");
    expect(projectStatus("done", map, "todo")).toBe("done");
  });

  test("mcp rules cover a whole server or a single tool", () => {
    expect(mcpCovered(["context7"], "context7", "get-library-docs", null)).toBe(true);
    expect(mcpCovered(["context7/resolve"], "context7", "get-library-docs", null)).toBe(false);
    expect(mcpCovered(["context7/resolve"], "context7", null, null)).toBe(false);
    expect(mcpCovered(["{config.server}"], "fs", "read", { server: "fs" })).toBe(true);
    expect(mcpCovered(["{config.server}"], "fs", "read", null)).toBe(false);
  });

  test("manifest v1 accepts adapters, secrets and mcp with defaults", () => {
    const base = { id: "probe", version: "1.0.0", kind: "adapter", title: "Probe", reads: [], writes: [] };
    const m = ComponentManifest.parse({ ...base, net: ["api.github.com"], secrets: [{ name: "github", hosts: ["api.github.com"] }] });
    expect(m.mcp).toEqual([]);
    expect(secretHostsCovered(m)).toEqual([]);
    const loose = ComponentManifest.parse({ ...base, secrets: [{ name: "github", hosts: ["api.github.com"] }] });
    expect(secretHostsCovered(loose)).toEqual(["api.github.com"]);
  });

  test("github statuses map to stable error codes", () => {
    const h = (headers: Record<string, string>) => (name: string) => headers[name] ?? null;
    expect(githubError(404, h({}), "{}").code).toBe("REMOTE_NOT_FOUND");
    expect(githubError(410, h({}), "{}").code).toBe("REMOTE_NOT_FOUND");
    expect(githubError(409, h({}), "{}").code).toBe("REMOTE_CONFLICT");
    expect(githubError(422, h({}), '{"message":"Validation Failed"}').detail).toContain("Validation Failed");
    expect(githubError(403, h({ "x-ratelimit-remaining": "0" }), "{}").code).toBe("RATE_LIMITED");
    expect(githubError(429, h({ "retry-after": "30" }), "{}").code).toBe("RATE_LIMITED");
    expect(githubError(403, h({ "x-ratelimit-remaining": "40" }), "{}").code).toBe("REMOTE_REJECTED");
    expect(githubError(401, h({}), "not json").detail).toBe("github 401: not json");
    expect(githubError(502, h({}), "").code).toBe("REMOTE_UNAVAILABLE");
  });

  test("integration rpc and events are part of the protocol", () => {
    expect(RpcRequest.safeParse({ method: "listIntegrations" }).success).toBe(true);
    expect(RpcRequest.safeParse({ method: "connectGithub", auth: { mode: "token", token: "ghp_x" } }).success).toBe(true);
    expect(RpcRequest.safeParse({ method: "connectGithub", auth: { mode: "oauth" } }).success).toBe(false);
    expect(IntegrationEvent.safeParse({ type: "sync.conflict", projectId: "p", ticketKey: "KIB-1", field: "title" }).success).toBe(true);
    expect(IntegrationEvent.safeParse({ type: "notice", title: "CI cassée sur KIB-7", body: "ci a échoué sur la PR #12." }).success).toBe(true);
    expect(IntegrationEvent.safeParse({ projectId: "p" }).success).toBe(false);
  });
});
```

- [x] **Step 3: Lancer le test**

Run: `bun test packages/schema/src/integrations.test.ts`
Expected: FAIL (`Cannot find module` / exports manquants).

- [x] **Step 4: Écrire `packages/schema/src/integrations.ts`**

```ts
import { z } from "zod";
import { KiboError, type KiboErrorCode } from "./errors";
import { NodeId } from "./ids";
import { StatusId } from "./status";

export const RepoSlug = z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
export type RepoSlug = z.infer<typeof RepoSlug>;

export const WebUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "http(s) url only");

export const McpServerId = z.string().regex(/^[a-z0-9-]{1,32}$/);
export const RESERVED_MCP_IDS: readonly string[] = ["figma"];
export const EnvName = z.string().regex(/^[A-Z_][A-Z0-9_]{0,63}$/);

const SECRET_NAME = /^(github|figma|mcp)(:[a-z0-9-]{1,32}(:[A-Z_][A-Z0-9_]{0,63})?)?$/;
export type SecretName = `${"github" | "mcp" | "figma"}${"" | `:${string}`}`;
export const SecretNameSchema = z.custom<SecretName>(
  (v) => typeof v === "string" && SECRET_NAME.test(v),
  "invalid secret name",
);

export const GithubIssueRef = z.object({
  kind: z.literal("github_issue"),
  bindingId: z.string().min(1),
  repo: RepoSlug,
  number: z.number().int().positive().nullable(),
  nodeId: z.string().min(1).nullable(),
  url: WebUrl.nullable(),
});
export type GithubIssueRef = z.infer<typeof GithubIssueRef>;

export const FigmaNodeRef = z.object({
  kind: z.literal("figma_node"),
  fileKey: z.string().regex(/^[A-Za-z0-9]{6,64}$/),
  nodeId: z.string().regex(/^\d+:\d+$/),
  url: WebUrl,
  name: z.string().max(200),
});
export type FigmaNodeRef = z.infer<typeof FigmaNodeRef>;

export const McpItemRef = z.object({
  kind: z.literal("mcp_item"),
  server: McpServerId,
  itemId: z.string().min(1).max(256),
  url: WebUrl.nullable(),
  title: z.string().min(1).max(500),
});
export type McpItemRef = z.infer<typeof McpItemRef>;

export function githubIssueState(ref: GithubIssueRef): "pending" | "linked" | "broken" {
  if (ref.number === null) return "pending";
  return ref.url === null ? "broken" : "linked";
}

export const BINDING_PREFIX = "binding:";

export function bindingIdOf(instanceId: string): string {
  if (!instanceId.startsWith(BINDING_PREFIX)) {
    throw new KiboError("INVALID_INPUT", "adapter actions run for a binding only");
  }
  return instanceId.slice(BINDING_PREFIX.length);
}

export const StatusMap = z.record(StatusId, z.string().min(1));
export type StatusMap = z.infer<typeof StatusMap>;

export const BindingConfig = z.object({
  repo: RepoSlug,
  project: z
    .object({
      owner: z.string().min(1),
      number: z.number().int().positive(),
      nodeId: z.string().min(1),
      statusFieldId: z.string().min(1),
      statusMap: StatusMap,
    })
    .nullable(),
  importClosed: z.boolean().default(false),
  labels: z.array(z.string().trim().min(1)).max(20).default([]),
});
export type BindingConfig = z.infer<typeof BindingConfig>;

export const Binding = z.object({
  id: z.string().min(1),
  adapter: z.enum(["github-issues"]),
  config: BindingConfig,
  createdBy: z.string().min(1),
  runner: z.string().min(1),
});
export type Binding = z.infer<typeof Binding>;

export const InstanceSource = z.object({ bindingId: z.string().min(1) });
export type InstanceSource = z.infer<typeof InstanceSource>;

export const SyncedFields = z.object({
  title: z.string().min(1),
  description: z.string(),
  statusId: StatusId,
  closed: z.boolean(),
});
export type SyncedFields = z.infer<typeof SyncedFields>;
export type SyncedField = keyof SyncedFields;

const IsoDate = z.string().datetime({ offset: true });

export const PushOp = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), ticketId: NodeId, fields: SyncedFields, since: IsoDate.nullable() }),
  z.object({ kind: z.literal("update"), remoteId: z.string().min(1), patch: SyncedFields.partial() }),
]);
export type PushOp = z.infer<typeof PushOp>;

export const MappedRemote = z.object({
  remoteId: z.string().min(1),
  updatedAt: IsoDate,
  fields: SyncedFields,
  ref: GithubIssueRef,
  labels: z.array(z.string()),
});
export type MappedRemote = z.infer<typeof MappedRemote>;

export const PullInput = z.object({ cursor: z.string().max(4096).nullable() });
export const PullPage = z.object({
  items: z.array(MappedRemote),
  cursor: z.string().max(4096).nullable(),
  more: z.boolean(),
});
export type PullPage = z.infer<typeof PullPage>;

export const IntegrationId = z.enum([
  "git",
  "github",
  "github-issues",
  "github-actions",
  "figma",
  "notifications",
  "markdown",
  "mcp",
]);
export type IntegrationId = z.infer<typeof IntegrationId>;
export type IntegrationState = "active" | "connected" | "disconnected" | "error";
export type IntegrationStatus = {
  id: IntegrationId;
  state: IntegrationState;
  account: string | null;
  servers: string[];
  error: { code: KiboErrorCode; message: string } | null;
  resumeAt: number | null;
};

export const CiJobSummary = z.object({
  jobId: z.number().int(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type CiJobSummary = z.infer<typeof CiJobSummary>;
export type CiRun = {
  repo: RepoSlug;
  runId: number;
  prNumber: number | null;
  ticketKey: string | null;
  headSha: string;
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  startedAt: string | null;
  updatedAt: string;
  jobs: CiJobSummary[];
};
export type CiLog = { text: string; truncated: boolean; errorLines: number[] };

const loopbackHosts = ["127.0.0.1", "localhost", "[::1]"];
const mcpUrlAllowed = (raw: string): boolean => {
  const u = new URL(raw);
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && loopbackHosts.includes(u.hostname);
};

export const McpServerInput = z
  .discriminatedUnion("transport", [
    z.object({
      transport: z.literal("stdio"),
      id: McpServerId,
      name: z.string().trim().min(1).max(60),
      command: z.string().trim().min(1).max(1024),
      args: z.array(z.string().max(4096)).max(64).default([]),
      envNames: z.array(EnvName).max(32).default([]),
    }),
    z.object({
      transport: z.literal("http"),
      id: McpServerId,
      name: z.string().trim().min(1).max(60),
      url: z.string().url().refine(mcpUrlAllowed, "https required unless loopback"),
      bearer: z.boolean().default(false),
    }),
  ])
  .refine((s) => !RESERVED_MCP_IDS.includes(s.id), "reserved server id");
export type McpServerInput = z.infer<typeof McpServerInput>;
export type McpToolInfo = { name: string; description: string | null; inputSchema: Record<string, unknown> };
export type McpServerView = McpServerInput & {
  enabled: boolean;
  state: "idle" | "connected" | "error";
  error: string | null;
  tools: McpToolInfo[];
  secretsSet: string[];
};
export type McpContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export type McpCallResult = { content: McpContent[]; isError: boolean; truncated: boolean };
export const McpImportItem = z.object({
  itemId: z.string().min(1).max(256),
  title: z.string().trim().min(1).max(500),
  url: WebUrl.nullable(),
});
export type McpImportItem = z.infer<typeof McpImportItem>;

export type FigmaPreview = { png: string | null; fetchedAt: number | null; reachable: boolean; available: boolean };
export type GithubRepo = { fullName: RepoSlug; private: boolean; description: string | null };
export type GithubProject = {
  owner: string;
  number: number;
  nodeId: string;
  title: string;
  statusField: { id: string; options: { id: string; name: string }[] } | null;
};
export type GithubConnectOptions = { ghAvailable: boolean; ghLogin: string | null; mode: "gh" | "token" | null };

export type BindingState = {
  bindingId: string;
  repo: RepoSlug;
  runner: string;
  running: boolean;
  lastPullAt: number | null;
  lastError: { code: KiboErrorCode; message: string } | null;
  imported: number;
  resumeAt: number | null;
};
export type OutboxError = { outboxId: number; ticketId: string; code: KiboErrorCode; message: string };
export type SyncState = { bindings: BindingState[]; pending: string[]; errors: OutboxError[] };
export type SyncReport = { pulled: number; created: number; updated: number; pushed: number; conflicts: number };

export const IntegrationEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("integrations") }),
  z.object({
    type: z.literal("sync"),
    projectId: z.string(),
    bindingId: z.string(),
    imported: z.number().int().nonnegative(),
    running: z.boolean(),
  }),
  z.object({
    type: z.literal("sync.conflict"),
    projectId: z.string(),
    ticketKey: z.string(),
    field: z.enum(["title", "description", "statusId"]),
  }),
  z.object({ type: z.literal("ci"), projectId: z.string() }),
  z.object({ type: z.literal("notice"), title: z.string().min(1).max(200), body: z.string().max(1000) }),
]);
export type IntegrationEvent = z.infer<typeof IntegrationEvent>;
```

- [x] **Step 5: Écrire `status-projection.ts`, `mcp-rules.ts`, `github-graphql.ts`**

`packages/schema/src/status-projection.ts` :

```ts
import type { StatusMap } from "./integrations";
import { StatusId } from "./status";

function firstOpenStatus(map: StatusMap, option: string): StatusId | null {
  for (const s of StatusId.options) {
    if (s !== "done" && map[s] === option) return s;
  }
  return null;
}

export function remoteStatusId(closed: boolean, optionId: string | null, map: StatusMap | null): StatusId {
  if (closed) return "done";
  if (map === null || optionId === null) return "todo";
  return firstOpenStatus(map, optionId) ?? "todo";
}

export function projectStatus(statusId: StatusId, map: StatusMap | null, fallback: StatusId): StatusId {
  if (statusId === "done") return "done";
  if (map === null) return "todo";
  const option = map[statusId];
  if (option === undefined) return fallback;
  return firstOpenStatus(map, option) ?? fallback;
}
```

`packages/schema/src/mcp-rules.ts` :

```ts
import type { ComponentManifest } from "./manifest";

export const CONFIG_SERVER_RULE = "{config.server}";

export function mcpCovered(
  rules: readonly string[],
  server: string,
  tool: string | null,
  config: Record<string, unknown> | null,
): boolean {
  const resolved: string[] = [];
  for (const rule of rules) {
    if (rule !== CONFIG_SERVER_RULE) resolved.push(rule);
    else if (config !== null && typeof config.server === "string") resolved.push(config.server);
  }
  return resolved.some((r) => r === server || (tool !== null && r === `${server}/${tool}`));
}

export function secretHostsCovered(manifest: ComponentManifest): string[] {
  const netHosts = new Set(manifest.net.map((rule) => rule.split("/")[0]));
  return manifest.secrets.flatMap((s) => s.hosts.filter((h) => !netHosts.has(h)));
}
```

`packages/schema/src/github-graphql.ts` (les chaînes sont comparées octet à octet par le faux GitHub) :

```ts
export const GITHUB_GRAPHQL = {
  projectItems: `query KiboProjectItems($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          updatedAt
          fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } } } }
          content { ... on Issue { id number title body state updatedAt url repository { nameWithOwner } labels(first: 20) { nodes { name } } } }
        }
      }
    }
  }
}`,
  addItem: `mutation KiboAddItem($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
}`,
  setStatus: `mutation KiboSetStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
}`,
  issueItems: `query KiboIssueItems($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      projectItems(first: 20) {
        nodes {
          id
          project { id }
          fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } } } }
        }
      }
    }
  }
}`,
  listProjects: `query KiboListProjects($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    projectsV2(first: 50) {
      nodes {
        id number title
        owner { ... on Organization { login } ... on User { login } }
        field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
      }
    }
  }
}`,
} as const;
export type GithubOperation = keyof typeof GITHUB_GRAPHQL;
export const GITHUB_OPERATION_NAMES: Record<GithubOperation, string> = {
  projectItems: "KiboProjectItems",
  addItem: "KiboAddItem",
  setStatus: "KiboSetStatus",
  issueItems: "KiboIssueItems",
  listProjects: "KiboListProjects",
};
```

`packages/schema/src/github-errors.ts` :

```ts
import { KiboError } from "./errors";

function messageOf(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed && typeof parsed.message === "string") {
      return `github ${status}: ${parsed.message.slice(0, 200)}`;
    }
    return `github ${status}`;
  } catch {
    return body ? `github ${status}: ${body.slice(0, 200)}` : `github ${status}`;
  }
}

export function githubError(status: number, header: (name: string) => string | null, body: string): KiboError {
  const message = messageOf(status, body);
  const exhausted = header("x-ratelimit-remaining") === "0" || header("retry-after") !== null;
  if ((status === 403 || status === 429) && exhausted) return new KiboError("RATE_LIMITED", message);
  if (status === 404 || status === 410) return new KiboError("REMOTE_NOT_FOUND", message);
  if (status === 409) return new KiboError("REMOTE_CONFLICT", message);
  if (status >= 500) return new KiboError("REMOTE_UNAVAILABLE", message);
  return new KiboError("REMOTE_REJECTED", message);
}
```

(Un corps non JSON n'est pas une erreur : il devient le message, tronqué.)

- [x] **Step 6: Étendre le manifeste, les erreurs et le RPC**

`packages/schema/src/manifest.ts` (manifeste v1 de la phase 4) : `kind` devient `z.enum(["widget", "view", "both", "adapter"])` et l'objet gagne :

```ts
  secrets: z
    .array(z.object({ name: SecretNameSchema, hosts: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).min(1) }))
    .default([]),
  mcp: z
    .array(z.union([z.string().regex(/^[a-z0-9-]+(\/[A-Za-z0-9_.-]+)?$/), z.literal("{config.server}")]))
    .default([]),
```

(`import { SecretNameSchema } from "./integrations";`). L'objet reste un `ZodObject` : la couverture `secrets × net` est vérifiée par `secretHostsCovered` (conformité, Task 9 ; proxy, Task 8).

`packages/schema/src/errors.ts` : ajouter à la fin du tableau `KIBO_ERROR_CODES` (le type `KiboErrorCode` en découle ; `RATE_LIMITED` et `TIMEOUT` y sont déjà) :

```ts
  "SECRET_STORE_UNAVAILABLE",
  "NOT_CONNECTED",
  "REMOTE_UNAVAILABLE",
  "REMOTE_REJECTED",
  "REMOTE_NOT_FOUND",
  "REMOTE_CONFLICT",
  "MCP_UNAVAILABLE",
  "MCP_FAILED",
```

`packages/schema/src/integrations-rpc.ts` :

```ts
import { z } from "zod";
import { NodeId } from "./ids";
import {
  BindingConfig,
  type Binding,
  type CiLog,
  type CiRun,
  type FigmaNodeRef,
  type FigmaPreview,
  type GithubConnectOptions,
  type GithubProject,
  type GithubRepo,
  IntegrationId,
  McpServerId,
  McpServerInput,
  type IntegrationStatus,
  type McpServerView,
  RepoSlug,
  type SyncReport,
  type SyncState,
} from "./integrations";

const projectId = z.string().min(1);
const bindingId = z.string().min(1);

export const INTEGRATION_RPC = [
  z.object({ method: z.literal("listIntegrations") }),
  z.object({ method: z.literal("testIntegration"), id: IntegrationId }),
  z.object({ method: z.literal("disconnectIntegration"), id: z.enum(["github", "figma"]) }),
  z.object({ method: z.literal("getGithubConnectOptions") }),
  z.object({
    method: z.literal("connectGithub"),
    auth: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("gh") }),
      z.object({ mode: z.literal("token"), token: z.string().trim().min(1).max(255) }),
    ]),
  }),
  z.object({ method: z.literal("listGithubRepos"), query: z.string().max(100).default("") }),
  z.object({ method: z.literal("listGithubProjects"), repo: RepoSlug }),
  z.object({ method: z.literal("createBinding"), projectId, config: BindingConfig }),
  z.object({ method: z.literal("deleteBinding"), projectId, bindingId }),
  z.object({ method: z.literal("syncBinding"), projectId, bindingId }),
  z.object({ method: z.literal("getSyncState"), projectId }),
  z.object({
    method: z.literal("resolveOutbox"),
    projectId,
    outboxId: z.number().int().positive(),
    action: z.enum(["retry", "drop"]),
  }),
  z.object({ method: z.literal("listCiRuns"), projectId, ticketId: NodeId.nullable() }),
  z.object({ method: z.literal("getCiLog"), projectId, runId: z.number().int(), jobId: z.number().int() }),
  z.object({ method: z.literal("configureFigma"), url: z.string().url() }),
  z.object({ method: z.literal("linkFigmaNode"), projectId, ticketId: NodeId, url: z.string().url() }),
  z.object({
    method: z.literal("getFigmaPreview"),
    fileKey: z.string().regex(/^[A-Za-z0-9]{6,64}$/),
    nodeId: z.string().regex(/^\d+:\d+$/),
  }),
  z.object({ method: z.literal("listMcpServers") }),
  z.object({ method: z.literal("previewMcpServer"), server: McpServerInput }),
  z.object({
    method: z.literal("addMcpServer"),
    server: McpServerInput,
    confirmedCommandLine: z.string().max(8192),
    secrets: z.record(z.string(), z.string().min(1).max(4096)),
  }),
  z.object({ method: z.literal("removeMcpServer"), id: McpServerId }),
  z.object({ method: z.literal("setMcpServerEnabled"), id: McpServerId, enabled: z.boolean() }),
  z.object({ method: z.literal("testMcpServer"), id: McpServerId }),
] as const;

export type IntegrationRpcRequest = z.infer<(typeof INTEGRATION_RPC)[number]>;

export type IntegrationRpcResult = {
  listIntegrations: IntegrationStatus[];
  testIntegration: IntegrationStatus;
  disconnectIntegration: null;
  getGithubConnectOptions: GithubConnectOptions;
  connectGithub: { login: string };
  listGithubRepos: GithubRepo[];
  listGithubProjects: GithubProject[];
  createBinding: Binding;
  deleteBinding: null;
  syncBinding: SyncReport;
  getSyncState: SyncState;
  resolveOutbox: null;
  listCiRuns: CiRun[];
  getCiLog: CiLog;
  configureFigma: IntegrationStatus;
  linkFigmaNode: FigmaNodeRef;
  getFigmaPreview: FigmaPreview;
  listMcpServers: McpServerView[];
  previewMcpServer: { commandLine: string };
  addMcpServer: McpServerView;
  removeMcpServer: null;
  setMcpServerEnabled: McpServerView;
  testMcpServer: McpServerView;
};
```

`packages/schema/src/rpc.ts` : ajouter `...INTEGRATION_RPC` à la fin du tableau de `RpcRequest` (`z.discriminatedUnion("method", [ …, z.object({ method: z.literal("reportComponentRefusal"), … }), ...INTEGRATION_RPC ])`), `& IntegrationRpcResult` au type `RpcResult` (`export type RpcResult = { … } & IntegrationRpcResult;`) et `IntegrationEvent` à `ChangeMessage` (N24) :

```ts
export type ChangeMessage =
  | { projectId: string | null }
  | { topic: Topic }
  | RunChanged
  | CodeEvent
  | IntegrationEvent;
```

(`import { INTEGRATION_RPC, type IntegrationRpcResult } from "./integrations-rpc";` et `import type { IntegrationEvent } from "./integrations";`). Tant que la Task 2 n'a pas routé ces méthodes, `service.handle` les rejette en `INTERNAL` (`handleAgents`, branche `default`) : aucune UI ne les appelle avant.

`packages/sdk/src/conformance.tsx` : un adaptateur n'a pas d'UI ; la liste des surfaces devient

```ts
    const surfaces: Surface[] =
      manifest.kind === "both" ? ["widget", "view"] : manifest.kind === "adapter" ? [] : [manifest.kind];
```

`packages/ui/src/dialogs/catalog-choices.ts` : dans `mineChoices`, écarter une version dont `v.manifest.kind === "adapter"` (N6 : un adaptateur n'apparaît pas au catalogue ; `builtinChoices` ne lit que les modules UI de `registry.ts`, où l'adaptateur n'est jamais enregistré). Les manifestes littéraux typés `ComponentManifest` des tests `packages/ui/src/dialogs/component-dialogs.test.tsx` et `packages/ui/src/pages/instance.test.tsx` gagnent `secrets: []` et `mcp: []` (le type de sortie de Zod rend ces champs obligatoires). Les autres consommateurs de `manifest.kind` restent corrects : `sdk/src/mock.ts` et `sdk/src/dev.tsx` retombent sur `"widget"`, `devkit/src/scaffold.ts` et `cli/src/index.ts` n'engendrent que `widget | view | both`.

`packages/schema/src/index.ts` : ajouter

```ts
export * from "./github-errors";
export * from "./github-graphql";
export * from "./integrations";
export * from "./integrations-rpc";
export * from "./mcp-rules";
export * from "./status-projection";
```

- [x] **Step 7: Lancer le test**

Run: `bun test packages/schema`
Expected: PASS (tous les tests de `schema`, anciens compris).

- [x] **Step 8: Test du contrat d'adaptateur (échoue)**

`packages/sdk/src/adapter.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { adapterActions, bindingIdOf, defineAdapter } from "./adapter";

const Remote = z.object({ id: z.number(), title: z.string(), at: z.string(), closed: z.boolean() });
const Config = z.object({ repo: z.string() });
const toy = defineAdapter({
  id: "toy",
  remote: Remote,
  config: Config,
  pull: async (_ctx, cursor) => ({
    items: cursor === null ? [{ id: 1, title: "A", at: "2026-09-26T10:00:00Z", closed: false }] : [],
    cursor: "c1",
    more: false,
  }),
  push: async (_ctx, op) => ({
    id: 2,
    title: op.kind === "create" ? op.fields.title : "patched",
    at: "2026-09-26T10:01:00Z",
    closed: false,
  }),
  map: {
    remoteId: (r) => String(r.id),
    updatedAt: (r) => r.at,
    toFields: (r) => ({ title: r.title, description: "", statusId: r.closed ? "done" : "todo", closed: r.closed }),
    toRef: (r, bindingId) => ({
      kind: "github_issue",
      bindingId,
      repo: "adam/kibo",
      number: r.id,
      nodeId: `I_${r.id}`,
      url: `https://github.com/adam/kibo/issues/${r.id}`,
    }),
    labels: () => [],
  },
});
const ctx = {
  instanceId: "binding:b1",
  config: { repo: "adam/kibo" },
  fetch: async () => ({ status: 200, headers: {}, body: "" }),
};

describe("adapter contract", () => {
  test("pull maps and validates every remote item", async () => {
    const page = await adapterActions(toy)["adapter.pull"](ctx, { cursor: null });
    expect(page).toEqual({
      items: [
        {
          remoteId: "1",
          updatedAt: "2026-09-26T10:00:00Z",
          fields: { title: "A", description: "", statusId: "todo", closed: false },
          ref: { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 1, nodeId: "I_1", url: "https://github.com/adam/kibo/issues/1" },
          labels: [],
        },
      ],
      cursor: "c1",
      more: false,
    });
  });

  test("push parses the op and returns the mapped remote", async () => {
    const out = await adapterActions(toy)["adapter.push"](ctx, {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "New", description: "", statusId: "todo", closed: false },
      since: null,
    });
    expect(out.fields.title).toBe("New");
    await expect(adapterActions(toy)["adapter.push"](ctx, { kind: "drop" })).rejects.toThrow();
  });

  test("an invalid remote object is rejected", async () => {
    const bad = defineAdapter({ ...toy, pull: async () => ({ items: [{ id: "x" }], cursor: null, more: false }) });
    await expect(adapterActions(bad)["adapter.pull"](ctx, { cursor: null })).rejects.toThrow();
  });

  test("adapter actions only run for a binding", () => {
    expect(bindingIdOf("binding:b1")).toBe("b1");
    expect(() => bindingIdOf("inst-1")).toThrow("INVALID_INPUT");
  });
});
```

Run: `bun test packages/sdk/src/adapter.test.ts` — Expected: FAIL (module absent).

- [x] **Step 9: Écrire `packages/sdk/src/adapter.ts`**

```ts
import {
  bindingIdOf,
  type GithubIssueRef,
  type MappedRemote,
  PullInput,
  PushOp,
  type SyncedFields,
} from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { KiboSdk } from "./types";

export { BINDING_PREFIX, bindingIdOf } from "@kibo/schema";

export type AdapterContext<C> = { config: C; fetch: KiboSdk["fetch"]; signal: AbortSignal };

export type Adapter<R, C> = {
  id: string;
  remote: ZodType<R, ZodTypeDef, unknown>;
  config: ZodType<C, ZodTypeDef, unknown>;
  pull(ctx: AdapterContext<C>, cursor: string | null): Promise<{ items: unknown[]; cursor: string | null; more: boolean }>;
  push(ctx: AdapterContext<C>, op: PushOp): Promise<unknown>;
  map: {
    remoteId(r: R): string;
    updatedAt(r: R): string;
    toFields(r: R, c: C): SyncedFields;
    toRef(r: R, bindingId: string): GithubIssueRef;
    labels(r: R): string[];
  };
};

export type AdapterActionContext = { instanceId: string; config: unknown; fetch: KiboSdk["fetch"] };

const ADAPTER_TIMEOUT_MS = 120_000;

export function defineAdapter<R, C>(adapter: Adapter<R, C>): Adapter<R, C> {
  return adapter;
}

export function mapRemote<R, C>(adapter: Adapter<R, C>, raw: unknown, config: C, bindingId: string): MappedRemote {
  const r = adapter.remote.parse(raw);
  return {
    remoteId: adapter.map.remoteId(r),
    updatedAt: adapter.map.updatedAt(r),
    fields: adapter.map.toFields(r, config),
    ref: adapter.map.toRef(r, bindingId),
    labels: adapter.map.labels(r),
  };
}

export function adapterActions<R, C>(adapter: Adapter<R, C>) {
  const contextOf = (ctx: AdapterActionContext): AdapterContext<C> => ({
    config: adapter.config.parse(ctx.config),
    fetch: ctx.fetch,
    signal: AbortSignal.timeout(ADAPTER_TIMEOUT_MS),
  });
  return {
    "adapter.pull": async (ctx: AdapterActionContext, input: unknown) => {
      const { cursor } = PullInput.parse(input);
      const c = contextOf(ctx);
      const bindingId = bindingIdOf(ctx.instanceId);
      const page = await adapter.pull(c, cursor);
      return {
        items: page.items.map((raw) => mapRemote(adapter, raw, c.config, bindingId)),
        cursor: page.cursor,
        more: page.more,
      };
    },
    "adapter.push": async (ctx: AdapterActionContext, input: unknown) => {
      const op = PushOp.parse(input);
      const c = contextOf(ctx);
      return mapRemote(adapter, await adapter.push(c, op), c.config, bindingIdOf(ctx.instanceId));
    },
  };
}
```

`pull` et `push` renvoient `unknown` : l'adaptateur ne peut pas contourner la validation, `mapRemote` parse chaque objet avec `remote`. Ajouter `export * from "./adapter";` à `packages/sdk/src/index.ts`.

- [x] **Step 10: Textes de l'interface**

`packages/ui/src/i18n/fr-integrations.ts` (source unique des libellés des Tasks 10, 11, 17, 18, 21 ; tutoiement) :

```ts
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const frIntegrations = {
  nav: "Intégrations",
  title: "Intégrations",
  subtitle: "Les secrets sont stockés dans le trousseau système, jamais dans les données du projet.",
  keychainUnavailable:
    "Trousseau système indisponible : déverrouille-le (Secret Service sur Linux) puis réessaie. Kibo ne stocke jamais de secret en clair.",
  rows: {
    git: { title: "Git local", description: "Branches, commits, worktrees, diff" },
    github: {
      title: "GitHub",
      description: (login: string | null) => (login ? `PR, reviews, statuts CI · compte ${login}` : "PR, reviews, statuts CI"),
    },
    "github-issues": { title: "GitHub Issues & Projects", description: "Synchronise les tickets d'un composant" },
    "github-actions": { title: "GitHub Actions", description: "Runs et logs liés à la PR et au ticket" },
    figma: { title: "Figma (MCP)", description: "Nœuds Figma liés aux tickets, aperçus" },
    notifications: { title: "Notifications système", description: "Agent en attente, run terminé, CI cassée" },
    markdown: { title: "Markdown / Obsidian", description: "Les notes restent des fichiers .md" },
    mcp: {
      title: "Serveurs MCP",
      description: (servers: string[]) =>
        servers.length === 0
          ? "Connecteur générique · aucun serveur"
          : `Connecteur générique · ${servers.length} ${plural(servers.length, "serveur", "serveurs")} (${servers.join(", ")})`,
    },
  },
  state: {
    active: "Actif",
    connected: "Connecté",
    connect: "Connecter",
    error: "Erreur",
    retry: "Réessayer",
    rateLimited: (time: string) => `Limite GitHub atteinte, reprise à ${time}`,
  },
  menu: {
    label: (title: string) => `Actions pour ${title}`,
    configure: "Configurer",
    test: "Tester la connexion",
    disconnect: "Déconnecter",
    tested: "Connexion vérifiée",
  },
  disconnect: {
    title: (title: string) => `Déconnecter ${title} ?`,
    githubToken:
      "Le jeton est supprimé du trousseau. GitHub Issues & Projects et GitHub Actions sont aussi déconnectés ; les tickets déjà importés restent.",
    githubGh: "Kibo cesse d'utiliser ton compte gh. gh reste connecté sur ta machine.",
    figma: "Les liens vers les nœuds restent, les aperçus en cache aussi.",
    confirm: "Déconnecter",
  },
  github: {
    title: "Connecter GitHub",
    subtitle: "Un seul compte GitHub par workspace, partagé par les PR, les issues et Actions.",
    gh: "Utiliser gh",
    ghRecommended: "Recommandé",
    ghHelp: "Kibo lit le jeton de gh à la demande, sans le stocker.",
    ghDetected: (login: string) => `gh est connecté (${login}).`,
    ghMissing: "gh n'est pas installé ou pas connecté (gh auth login).",
    token: "Jeton personnel",
    tokenHelp: "Stocké dans le trousseau système, jamais dans les données du projet.",
    tokenLabel: "Jeton",
    tokenPlaceholder: "ghp_…",
    scopes:
      "Portées requises : repo, project (Projects v2). read:org si le Project appartient à une organisation. workflow n'est pas requis.",
    submit: "Connecter",
    verifying: "Vérification…",
    refused: "GitHub a refusé ce jeton.",
    connected: (login: string) => `Connecté en tant que ${login}`,
  },
  figma: {
    title: "Connecter Figma",
    subtitle: "Kibo utilise le serveur MCP Dev Mode de l'application Figma : aucun compte ni secret stocké.",
    url: "Adresse du serveur",
    urlHelp: "Figma › Préférences › Activer le serveur MCP Dev Mode. Par défaut : http://127.0.0.1:3845/mcp",
    defaultUrl: "http://127.0.0.1:3845/mcp",
    submit: "Connecter",
    unreachable: "Serveur Figma injoignable : ouvre l'application Figma et active le serveur Dev Mode.",
    missingTools: "Ce serveur n'expose pas les outils Figma attendus (get_metadata, get_screenshot).",
  },
  mcpServers: {
    title: "Serveurs MCP",
    subtitle: "La configuration reste sur cette machine : elle n'est jamais synchronisée.",
    add: "Ajouter un serveur",
    empty: "Aucun serveur MCP.",
    tools: (n: number) => `${n} ${plural(n, "outil", "outils")}`,
    enabled: "Activé",
    remove: "Retirer",
    removeConfirm: (name: string) => `Retirer ${name} ? Les composants qui l'utilisent afficheront une erreur.`,
    stdio: "stdio",
    http: "HTTP",
  },
  mcpServer: {
    title: "Ajouter un serveur MCP",
    name: "Nom",
    id: "Identifiant",
    idHelp: "Minuscules, chiffres et tirets. Sert dans les permissions (mcp:context7).",
    idTaken: "Identifiant déjà utilisé.",
    type: "Type",
    stdio: "Commande locale (stdio)",
    stdioHelp: "Kibo lance le serveur sur ta machine.",
    http: "Adresse HTTP",
    httpHelp: "Serveur déjà lancé, local ou distant.",
    command: "Commande",
    args: "Arguments",
    argsHelp: "Un argument par ligne.",
    env: "Variables secrètes",
    envHelp: "La valeur va dans le trousseau et n'est transmise qu'à ce serveur.",
    envName: "Nom",
    envValue: "Valeur",
    envAdd: "Ajouter une variable",
    url: "Adresse",
    urlHelp: "https obligatoire, sauf 127.0.0.1.",
    bearer: "Jeton d'accès (facultatif)",
    next: "Continuer",
    confirmTitle: "Confirmer la commande",
    confirmBody:
      "Kibo exécutera exactement cette commande sur ta machine, avec un environnement réduit (PATH, HOME, LANG et les variables secrètes ci-dessus) :",
    confirmHttp: "Kibo se connectera à cette adresse :",
    confirm: "Ajouter et lancer",
    back: "Retour",
  },
  source: {
    title: "Source",
    local: "Locale",
    localHelp: "Tickets du projet, dans Kibo uniquement.",
    synced: "Synchronisée · GitHub Issues",
    syncedHelp: "Aller-retour avec les issues d'un dépôt.",
    notConnected: "Connecte GitHub dans Paramètres › Intégrations pour synchroniser.",
    openSettings: "Ouvrir les intégrations",
    repo: "Dépôt",
    repoSearch: "Filtrer les dépôts…",
    repoEmpty: "Aucun dépôt.",
    project: "Project (facultatif)",
    noProject: "Aucun Project",
    statusMap: "Correspondance des statuts",
    statusMapHelp: "Pré-remplie par libellés identiques. Un statut sans correspondance n'est pas envoyé.",
    unmapped: "Non envoyé",
    labels: "Filtrer par libellés",
    labelsHelp: "Séparés par des virgules ; vide = toutes les issues.",
    importClosed: "Importer aussi les issues fermées",
    submit: "Ajouter et synchroniser",
    progress: (n: number) => `Synchronisation… ${n} ${plural(n, "issue importée", "issues importées")}`,
    done: (n: number) => `${n} ${plural(n, "issue importée", "issues importées")}`,
    failed: "La première synchronisation a échoué :",
  },
  sheet: {
    issue: (n: number) => `#${n}`,
    openOnGithub: "Ouvrir sur GitHub",
    pending: "Synchronisation en attente",
    pendingCreate: "Création de l'issue en attente",
    broken: "Lien GitHub rompu",
    brokenHelp: "L'issue a été supprimée ou transférée.",
    syncError: "Échec de synchronisation :",
    retry: "Réessayer",
    drop: "Abandonner",
    ci: "CI",
    ciEmpty: "Aucun run pour les PR de ce ticket.",
    viewLogs: "Voir les logs",
    logTitle: (job: string) => `Logs · ${job}`,
    logSearch: "Rechercher dans les logs",
    errorsOnly: "Erreurs seulement",
    logTruncated: "Log tronqué à 20 Mio.",
    logEmpty: "Aucune ligne.",
    conclusion: {
      success: "Réussi",
      failure: "Échec",
      cancelled: "Annulé",
      skipped: "Ignoré",
      timed_out: "Délai dépassé",
      action_required: "Action requise",
      neutral: "Neutre",
      running: "En cours",
      queued: "En file",
    },
    mockups: "Maquettes",
    mockupProperty: "Maquette",
    linkFigma: "Lier un nœud Figma",
    figmaPlaceholder: "Colle l'URL d'un nœud Figma (figma.com/design/…?node-id=…)",
    figmaInvalid: "URL Figma invalide : il faut un lien de nœud (node-id).",
    figmaUnreachable: "Figma non joignable",
    previewUnavailable: "Aperçu indisponible",
    unlink: "Retirer",
    figmaNotConnected: "Connecte Figma dans Paramètres › Intégrations.",
  },
  conflict: (key: string, field: "title" | "description" | "statusId") =>
    `Conflit résolu sur ${key} : ${{ title: "titre", description: "description", statusId: "statut" }[field]} repris de GitHub`,
  permissions: {
    secret: (name: string, hosts: string[]) =>
      name === "github" ? `Utiliser ton compte GitHub (${hosts.join(", ")})` : `Utiliser le secret ${name} (${hosts.join(", ")})`,
    mcp: (rule: string) => {
      const [server, tool] = rule.split("/");
      return tool ? `Appeler l'outil ${tool} du serveur MCP ${server}` : `Appeler le serveur MCP ${server}`;
    },
    mcpFromConfig: "Appeler le serveur MCP choisi à l'ajout",
  },
};
```

`packages/ui/src/i18n/fr.ts` : `import { frIntegrations } from "./fr-integrations";` et ajouter la clé `integrations: frIntegrations,` à l'objet `fr` (`as const`), juste avant `...frCode,` (aucune collision : `fr.settings.integrations` est une chaîne sous `settings`).

- [x] **Step 11: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS.

```bash
git add CLAUDE.md packages/schema/src packages/sdk/src/adapter.ts packages/sdk/src/adapter.test.ts packages/sdk/src/index.ts packages/sdk/src/conformance.tsx packages/sdk/package.json bun.lock packages/ui/src/i18n packages/ui/src/dialogs/catalog-choices.ts packages/ui/src/dialogs/component-dialogs.test.tsx packages/ui/src/pages/instance.test.tsx
git commit -m "feat(schema): contrats des intégrations"
```

---

### Task 2: Socle démon des intégrations

Isole les ancrages des phases 2 à 4 derrière `IntegrationHost`, crée les tables, le caviardage, le journal, les réglages, le registre RPC et les sondes, et fait passer **toute** commande de projet du démon par un chemin unique observable (N22). Après cette tâche, chaque module d'intégration se branche en une ligne dans `bootstrap.ts`. Tâche à risque (persistance transactionnelle, caviardage) : relecture `kibo-lead`. Démarre après l'intégration de la tâche 30b de la phase 4 (`daemon.ts`, `components/service.ts`).

**Files:**
- Create: `packages/daemon/src/integrations/{types.ts,host.ts,db.ts,redact.ts,events.ts,settings.ts,registry.ts,methods.ts,bootstrap.ts,memory-secret-store.ts,github-remote.ts,probes.ts}`
- Create: `packages/daemon/src/integrations/testing/fake-host.ts`
- Test: `packages/daemon/src/integrations/{redact,events,registry,github-remote,bootstrap,host}.test.ts`
- Modify: `packages/daemon/src/store.ts` (`transaction` ; `db` existe déjà), `packages/daemon/src/docs.ts` (`Docs.run`, `Docs.trigger`), `packages/daemon/src/service.ts` (chemin unique des commandes, intercepteurs et observateurs dans la transaction, restauration sur échec, `command` avec `instanceId`, dispatch des RPC d'intégration, `attachIntegrations`, `commands`), `packages/daemon/src/components/gate.ts` et `gate-handlers.ts` (`run` par `docs.run`, avec l'`instanceId`), `packages/daemon/src/agents/data-port.ts` (`assignTicket`, `runStarted`, `runDone` par `docs.run`/`docs.trigger`), `packages/daemon/src/server.ts` et `server.test.ts` (codes HTTP, caviardage de `e.detail`), `packages/daemon/src/daemon.ts` (hôte et intégrations créés dans `startDaemon`, closer, `redact`), `packages/daemon/src/main.ts` (drapeaux, caviardage de la console), `packages/schema/src/rpc.ts` (`command` accepte `instanceId?`), `packages/sdk/src/client.ts` (`subscribeIntegrations`, N24), `packages/sdk/src/client.test.ts`

**Interfaces:**
- Consumes: Task 1 (schema, dont `ChangeMessage` étendu) ; ancrages réels : `Notice` et `DaemonOptions.notify` (`agents/notifier.ts`, `daemon.ts`), `evaluateRules`/`readRules`/`RuleTrigger` (`@kibo/core/rules`), `createGit`/`runGh` (`code/run.ts`), `ChangeMessage` et le canal WebSocket `changes` (`server.ts`, `sdk/src/client.ts`), `createGateHandlers` (`components/gate-handlers.ts`), `createDataPort` (`agents/data-port.ts`), `startDaemon`/`DaemonOptions` (`daemon.ts`).
- Produces (`packages/daemon/src/integrations/types.ts`) :

```ts
import type { Database } from "bun:sqlite";
import type {
  Binding,
  CiRun,
  CommandResult,
  IntegrationEvent,
  IntegrationId,
  IntegrationRpcRequest,
  IntegrationRpcResult,
  IntegrationStatus,
  MappedRemote,
  McpCallResult,
  McpImportItem,
  ProjectCommand,
  ProjectMeta,
  ProjectSnapshot,
  PullPage,
  PushOp,
  SecretName,
  Ticket,
} from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { CommandEvent, CommandInterceptor, CommandMeta } from "../docs";

export type { CommandEvent, CommandInterceptor, CommandMeta, CommandOrigin } from "../docs";
export type SystemNotification = Notice;
export type GhRunner = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

export type IntegrationHost = {
  user: string;
  home: string;
  db: Database;
  transaction<T>(fn: () => T): T;
  projects(): ProjectMeta[];
  snapshot(projectId: string): ProjectSnapshot;
  command<C extends ProjectCommand>(projectId: string, cmd: C, meta: CommandMeta): CommandResult[C["method"]];
  onCommand(listener: (e: CommandEvent) => void): () => void;
  intercept(interceptor: CommandInterceptor): () => void;
  broadcast(event: IntegrationEvent): void;
  notify(n: SystemNotification): void;
  gitRemoteUrl(projectId: string): Promise<string | null>;
  gitAvailable(): Promise<boolean>;
  gh: GhRunner;
  now(): number;
};

export type SecretStore = {
  availability(): Promise<{ ok: true } | { ok: false; reason: string }>;
  has(name: SecretName): Promise<boolean>;
  get(name: SecretName): Promise<string | null>;
  set(name: SecretName, value: string): Promise<void>;
  delete(name: SecretName): Promise<void>;
};
export type SecretResolver = (name: SecretName) => Promise<string | null>;

export type GithubCredentials = {
  token(): Promise<string | null>;
  login(): string | null;
  mode(): "gh" | "token" | null;
};

export type InternalRule = { host: string; suffix: boolean; auth: boolean };
export type IntegrationFetchInit = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  bearer?: string | null;
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};
export type IntegrationResponse = { status: number; headers: Headers; body: Uint8Array; truncated: boolean; url: string };
export type IntegrationFetch = (url: string, init: IntegrationFetchInit, rules: InternalRule[]) => Promise<IntegrationResponse>;

export type AdapterRunner = {
  pull(projectId: string, binding: Binding, cursor: string | null): Promise<PullPage>;
  push(projectId: string, binding: Binding, op: PushOp): Promise<MappedRemote>;
};

export type IntegrationMethod = IntegrationRpcRequest["method"];
export type IntegrationHandlers = {
  [M in IntegrationMethod]?: (req: Extract<IntegrationRpcRequest, { method: M }>) => Promise<IntegrationRpcResult[M]>;
};
export type IntegrationProbe = {
  id: IntegrationId;
  status(): Promise<IntegrationStatus>;
  test?(): Promise<IntegrationStatus>;
  disconnect?(): Promise<void>;
};

export type McpCallContext = { projectId: string; instanceId: string };
export type McpComponentGate = {
  call(ctx: McpCallContext, server: string, tool: string, args: Record<string, unknown>): Promise<McpCallResult>;
  read(ctx: McpCallContext, server: string, uri: string): Promise<McpCallResult>;
  importItem(ctx: McpCallContext, server: string, item: McpImportItem): Promise<Ticket>;
};
export type ComponentIntegrationHooks = {
  aliases: Map<string, URL>;
  observe(host: string, headers: Headers): void;
  secret: SecretResolver;
  mcp: McpComponentGate | null;
  ciRuns: ((projectId: string) => Promise<CiRun[]>) | null;
};
```

- Produces (autres) :
  - `migrateIntegrations(db: Database): void` (toutes les tables de la phase)
  - `createRedactor(): Redactor` avec `Redactor = { add(secret: string): void; redact(text: string): string }` ; `installConsoleRedaction(r: Redactor, target?: Console): () => void`
  - `createEventLog(db, redactor, now): EventLog` avec `EventLog = { log(integration: IntegrationId, level: "info" | "warn" | "error", message: string): void; recent(integration: IntegrationId, limit?: number): { at: number; level: string; message: string }[] }`
  - `createSettings(db): Settings` avec `Settings = { get(key: SettingKey): string | null; set(key: SettingKey, value: string): void; delete(key: SettingKey): void }`, `SettingKey = "github.mode" | "github.login" | "figma.url"`
  - `createMemorySecretStore(redactor, initial?: Record<string, string>): SecretStore & { dump(): Map<string, string> }` ; `unavailableSecretStore(reason: string): SecretStore`
  - `createIntegrationRpc(parts: { handlers: IntegrationHandlers[]; probes: IntegrationProbe[]; stops: (() => void)[]; hooks: ComponentIntegrationHooks; redact?: (text: string) => string }): IntegrationRpc` (`redact`, défaut identité, caviarde le message d'erreur des sondes renvoyé par `listIntegrations`/`testIntegration` : c'est un résultat RPC, que le caviardage de `e.detail` par `server.ts` ne couvre pas ; `startIntegrations` passe `redactor.redact` ; le registre caviarde aussi le message d'un statut `error` renvoyé par une sonde, point de contrôle unique décidé par le chef d'équipe) avec `IntegrationRpc = { handles(method: string): boolean; handle(req: IntegrationRpcRequest): Promise<unknown>; stop(): void; hooks: ComponentIntegrationHooks }` (les `hooks` sont lus par la porte `componentCall` et le proxy `fetch` de la phase 4, `components/gate-handlers.ts` et `net-proxy.ts` ; les tâches 8, 12, 15 et 16 remplissent leurs champs) ; `NEUTRAL_HOOKS: ComponentIntegrationHooks` (aucun alias, aucun secret, `mcp` et `ciRuns` à `null`)
  - `INTEGRATION_METHODS` et `isIntegrationRequest(req: RpcRequest): req is IntegrationRpcRequest` (`integrations/methods.ts`, sur le modèle de `components/methods.ts`)
  - `createIntegrationHost(parts: HostParts): IntegrationHost` (`integrations/host.ts`)
  - `parseGithubRemote(url: string | null): RepoSlug | null` ; `githubRepoOf(host, projectId): Promise<RepoSlug | null>`
  - `parseIntegrationFlags(values): IntegrationFlags` (`{ testOrigins: string[]; memorySecrets: boolean }`) ; `IntegrationKit` ; `startIntegrations(host, flags, redactor): IntegrationRpc`
  - `createFakeHost(opts?): FakeHost` (tests de toutes les tâches du démon)
  - `Store` gagne `transaction<T>(fn: () => T): T` (`db` existe déjà)
  - `docs.ts` : `CommandOrigin = "user" | "sync"`, `CommandMeta = { origin: CommandOrigin; instanceId: string | null }`, `CommandEvent = { projectId: string; command: ProjectCommand; result: unknown; meta: CommandMeta }`, `CommandInterceptor = (projectId: string, cmd: ProjectCommand, meta: CommandMeta) => ProjectCommand`, `USER_COMMAND: CommandMeta = { origin: "user", instanceId: null }` ; `Docs` gagne `run(projectId: string, command: ProjectCommand, meta?: CommandMeta): unknown` et `trigger(projectId: string, trigger: RuleTrigger, meta?: CommandMeta): number` (N22)
  - `Service` gagne `transaction<T>(fn: () => T): T` (restaure les docs touchés si `fn` échoue), `commands: { onCommand(listener: (e: CommandEvent) => void): () => void; intercept(i: CommandInterceptor): () => void }` et `attachIntegrations(rpc: IntegrationRpc): () => void` ; les événements d'intégration passent par `docs.emit` et `service.onChange` (N24 : pas de `onIntegrationEvent`) ; la RPC `command` accepte `instanceId?: string`
  - `DaemonOptions` gagne `integrations?: IntegrationFlags` et `redactor?: Redactor` (N26)
  - `KiboClient.subscribeIntegrations(listener: (e: IntegrationEvent) => void): () => void` (N24)
  - `GateHandlers.run(projectId: string, instanceId: string, command: ProjectCommand)` (l'`instanceId` de l'appelant est transmis à `docs.run`)

- [x] **Step 1: Vérifier les ancrages**

Le tableau « Points d'ancrage » a été rempli par la tâche T0 (colonne « Réel »). Relire chaque ligne contre `main` au moment de démarrer ; un écart apparu depuis (par exemple après la tâche 30b) est noté dans ce tableau et n'est absorbé que dans `host.ts`, `service.ts` et `daemon.ts`.

- [x] **Step 2: Tests du caviardage, du journal et des remotes (échouent)**

`packages/daemon/src/integrations/redact.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { createRedactor, installConsoleRedaction } from "./redact";

describe("redactor", () => {
  test("replaces every occurrence, longest secret first, ignores short values", () => {
    const r = createRedactor();
    r.add("abcdefgh12");
    r.add("abcdefgh1234");
    r.add("short");
    expect(r.redact("x abcdefgh1234 y abcdefgh12 z short")).toBe("x *** y *** z short");
  });

  test("console methods are redacted and restorable", () => {
    const lines: string[] = [];
    const target = {
      log: (...a: unknown[]) => lines.push(a.join(" ")),
      info: (...a: unknown[]) => lines.push(a.join(" ")),
      warn: (...a: unknown[]) => lines.push(a.join(" ")),
      error: (...a: unknown[]) => lines.push(a.join(" ")),
      debug: (...a: unknown[]) => lines.push(a.join(" ")),
    };
    const r = createRedactor();
    r.add("ghp_TESTSECRET0123456789abcdefghijklmn");
    const restore = installConsoleRedaction(r, target);
    target.error("token ghp_TESTSECRET0123456789abcdefghijklmn", new Error("bad ghp_TESTSECRET0123456789abcdefghijklmn"));
    target.log({ auth: "Bearer ghp_TESTSECRET0123456789abcdefghijklmn" });
    restore();
    target.log("ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(lines[0]).not.toContain("TESTSECRET");
    expect(lines[0]).toContain("Error: bad ***");
    expect(lines[1]).toBe('{"auth":"Bearer ***"}');
    expect(lines[2]).toContain("TESTSECRET");
  });
});
```

`packages/daemon/src/integrations/events.test.ts` :

```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { migrateIntegrations } from "./db";
import { createEventLog } from "./events";
import { createRedactor } from "./redact";
import { createSettings } from "./settings";

test("events are redacted, truncated and listed newest first", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const r = createRedactor();
  r.add("s3cret-value-123");
  let now = 1;
  const log = createEventLog(db, r, () => now++);
  log.log("github", "error", "failed with s3cret-value-123");
  log.log("github", "info", "x".repeat(5000));
  const recent = log.recent("github");
  expect(recent[0]?.message).toHaveLength(2000);
  expect(recent[1]?.message).toBe("failed with ***");
  const raw = JSON.stringify(db.query("SELECT * FROM integration_events").all());
  expect(raw).not.toContain("s3cret");
});

test("settings round-trip", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const s = createSettings(db);
  expect(s.get("github.mode")).toBeNull();
  s.set("github.mode", "gh");
  s.set("github.mode", "token");
  expect(s.get("github.mode")).toBe("token");
  s.delete("github.mode");
  expect(s.get("github.mode")).toBeNull();
});
```

`packages/daemon/src/integrations/github-remote.test.ts` :

```ts
import { expect, test } from "bun:test";
import { parseGithubRemote } from "./github-remote";

test("github remotes are recognised in every usual form", () => {
  expect(parseGithubRemote("git@github.com:adam/kibo.git")).toBe("adam/kibo");
  expect(parseGithubRemote("https://github.com/adam/kibo")).toBe("adam/kibo");
  expect(parseGithubRemote("https://github.com/adam/kibo.git/")).toBe("adam/kibo");
  expect(parseGithubRemote("https://token@github.com/adam/kibo.git")).toBe("adam/kibo");
  expect(parseGithubRemote("ssh://git@github.com/adam/kibo.js.git")).toBe("adam/kibo.js");
  expect(parseGithubRemote("git@gitlab.com:adam/kibo.git")).toBeNull();
  expect(parseGithubRemote("https://github.com.evil.io/adam/kibo")).toBeNull();
  expect(parseGithubRemote(null)).toBeNull();
});
```

Run: `bun test packages/daemon/src/integrations` — Expected: FAIL (modules absents).

- [x] **Step 3: Implémenter `db.ts`, `redact.ts`, `events.ts`, `settings.ts`, `github-remote.ts`**

`packages/daemon/src/integrations/db.ts` :

```ts
import type { Database } from "bun:sqlite";

const TABLES = [
  "CREATE TABLE IF NOT EXISTS integration_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS integration_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, integration TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sync_items (binding_id TEXT NOT NULL, remote_id TEXT NOT NULL, ticket_id TEXT NOT NULL, base_json TEXT NOT NULL, remote_updated_at TEXT NOT NULL, last_pushed_hash TEXT, PRIMARY KEY (binding_id, remote_id))",
  "DROP INDEX IF EXISTS sync_items_ticket",
  "CREATE UNIQUE INDEX IF NOT EXISTS sync_items_linked_ticket ON sync_items (binding_id, ticket_id) WHERE ticket_id <> ''",
  "CREATE TABLE IF NOT EXISTS sync_cursors (binding_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, cursor TEXT, last_pull_at INTEGER, last_error TEXT, imported INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, binding_id TEXT NOT NULL, project_id TEXT NOT NULL, ticket_id TEXT NOT NULL, op TEXT NOT NULL, payload_json TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER, first_attempt_at TEXT, last_error TEXT, created_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sync_outbox_binding ON sync_outbox (binding_id, id)",
  "CREATE TABLE IF NOT EXISTS ci_runs (repo TEXT NOT NULL, run_id INTEGER NOT NULL, project_id TEXT NOT NULL, head_sha TEXT NOT NULL, head_branch TEXT, pr_number INTEGER, workflow TEXT NOT NULL, status TEXT NOT NULL, conclusion TEXT, url TEXT NOT NULL, started_at TEXT, updated_at TEXT NOT NULL, notified INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (repo, run_id))",
  "CREATE TABLE IF NOT EXISTS ci_jobs (run_id INTEGER NOT NULL, job_id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, conclusion TEXT, started_at TEXT, completed_at TEXT, log_path TEXT, log_fetched_at INTEGER, steps_json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, transport TEXT NOT NULL, command TEXT, args_json TEXT NOT NULL, env_names_json TEXT NOT NULL, url TEXT, bearer INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, command_line TEXT NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mcp_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, server TEXT NOT NULL, tool TEXT NOT NULL, instance_id TEXT, duration_ms INTEGER NOT NULL, ok INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS figma_cache (file_key TEXT NOT NULL, node_id TEXT NOT NULL, png_path TEXT NOT NULL, fetched_at INTEGER NOT NULL, PRIMARY KEY (file_key, node_id))",
];

export function migrateIntegrations(db: Database): void {
  db.transaction(() => {
    for (const sql of TABLES) db.exec(sql);
  })();
}
```

`packages/daemon/src/integrations/redact.ts` :

```ts
export type Redactor = { add(secret: string): void; redact(text: string): string };

const MIN_SECRET_LENGTH = 8;
const METHODS = ["log", "info", "warn", "error", "debug"] as const;
type ConsoleLike = Record<(typeof METHODS)[number], (...args: unknown[]) => void>;

export function createRedactor(): Redactor {
  const secrets = new Set<string>();
  return {
    add(secret) {
      if (secret.length >= MIN_SECRET_LENGTH) secrets.add(secret);
    },
    redact(text) {
      let out = text;
      for (const s of [...secrets].sort((a, b) => b.length - a.length)) out = out.split(s).join("***");
      return out;
    },
  };
}

function render(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (e) {
    return `[unserializable: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

export function installConsoleRedaction(r: Redactor, target: ConsoleLike = console): () => void {
  const originals = METHODS.map((m) => target[m]);
  for (const m of METHODS) {
    const original = target[m].bind(target);
    target[m] = (...args: unknown[]) => original(...args.map((a) => r.redact(render(a))));
  }
  return () => {
    METHODS.forEach((m, i) => {
      const original = originals[i];
      if (original) target[m] = original;
    });
  };
}
```

`packages/daemon/src/integrations/events.ts` :

```ts
import type { Database } from "bun:sqlite";
import type { IntegrationId } from "@kibo/schema";
import type { Redactor } from "./redact";

export type EventLevel = "info" | "warn" | "error";
export type EventLog = {
  log(integration: IntegrationId, level: EventLevel, message: string): void;
  recent(integration: IntegrationId, limit?: number): { at: number; level: string; message: string }[];
};

const MAX_MESSAGE = 2000;

export function createEventLog(db: Database, redactor: Redactor, now: () => number): EventLog {
  const insert = db.query(
    "INSERT INTO integration_events (at, integration, level, message) VALUES ($at, $integration, $level, $message)",
  );
  const select = db.query(
    "SELECT at, level, message FROM integration_events WHERE integration = $integration ORDER BY id DESC LIMIT $limit",
  );
  return {
    log(integration, level, message) {
      insert.run({ at: now(), integration, level, message: redactor.redact(message).slice(0, MAX_MESSAGE) });
    },
    recent(integration, limit = 50) {
      return select.all({ integration, limit }) as { at: number; level: string; message: string }[];
    },
  };
}
```

Ce journal est distinct du journal des refus des composants (`components/events.ts`, table `component_events`, mêmes noms `createEventLog`/`EventLog`) : un module qui importe les deux renomme à l'import (N28).

`packages/daemon/src/integrations/settings.ts` :

```ts
import type { Database } from "bun:sqlite";

export type SettingKey = "github.mode" | "github.login" | "figma.url";
export type Settings = {
  get(key: SettingKey): string | null;
  set(key: SettingKey, value: string): void;
  delete(key: SettingKey): void;
};

export function createSettings(db: Database): Settings {
  const select = db.query("SELECT value FROM integration_settings WHERE key = $key");
  const upsert = db.query(
    "INSERT INTO integration_settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const remove = db.query("DELETE FROM integration_settings WHERE key = $key");
  return {
    get: (key) => (select.get({ key }) as { value: string } | null)?.value ?? null,
    set: (key, value) => {
      upsert.run({ key, value });
    },
    delete: (key) => {
      remove.run({ key });
    },
  };
}
```

`packages/daemon/src/integrations/github-remote.ts` :

```ts
import type { RepoSlug } from "@kibo/schema";
import type { IntegrationHost } from "./types";

const PATTERNS = [
  /^git@github\.com:([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  /^ssh:\/\/git@github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  /^https:\/\/(?:[^@/]+@)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
];

export function parseGithubRemote(url: string | null): RepoSlug | null {
  if (url === null) return null;
  for (const re of PATTERNS) {
    const m = re.exec(url.trim());
    if (m?.[1] && m[2]) return `${m[1]}/${m[2]}`;
  }
  return null;
}

export async function githubRepoOf(host: IntegrationHost, projectId: string): Promise<RepoSlug | null> {
  return parseGithubRemote(await host.gitRemoteUrl(projectId));
}
```

Run: `bun test packages/daemon/src/integrations` — Expected: les trois fichiers passent.

- [x] **Step 4: Test du registre et de l'amorçage (échoue)**

`packages/daemon/src/integrations/registry.test.ts` :

```ts
import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createIntegrationRpc } from "./registry";

const status = (id: "github" | "git") => async () => ({
  id,
  state: "connected" as const,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
});

test("dispatches to the registered handler and lists probes in screen order", async () => {
  const rpc = createIntegrationRpc({
    handlers: [{ getGithubConnectOptions: async () => ({ ghAvailable: true, ghLogin: "adam", mode: null }) }],
    probes: [
      { id: "github", status: status("github") },
      { id: "git", status: status("git") },
    ],
    stops: [],
  });
  expect(rpc.handles("getGithubConnectOptions")).toBe(true);
  expect(rpc.handles("listIntegrations")).toBe(true);
  expect(rpc.handles("getProject")).toBe(false);
  expect(await rpc.handle({ method: "getGithubConnectOptions" })).toEqual({ ghAvailable: true, ghLogin: "adam", mode: null });
  const list = (await rpc.handle({ method: "listIntegrations" })) as { id: string }[];
  expect(list.map((s) => s.id)).toEqual(["git", "github"]);
});

test("a failing probe becomes an error state, never a crash", async () => {
  const rpc = createIntegrationRpc({
    handlers: [],
    probes: [
      {
        id: "github",
        status: async () => {
          throw new KiboError("NOT_CONNECTED", "token revoked");
        },
      },
    ],
    stops: [],
  });
  const [s] = (await rpc.handle({ method: "listIntegrations" })) as { state: string; error: { code: string } }[];
  expect(s?.state).toBe("error");
  expect(s?.error.code).toBe("NOT_CONNECTED");
});

test("a probe error message is redacted", async () => {
  const rpc = createIntegrationRpc({
    handlers: [],
    probes: [
      {
        id: "github",
        status: async () => {
          throw new KiboError("REMOTE_REJECTED", "github 401: Bearer ghp_TESTSECRET0123456789abcdefghijklmn");
        },
      },
    ],
    stops: [],
    redact: (text) => text.split("ghp_TESTSECRET0123456789abcdefghijklmn").join("***"),
  });
  const [s] = (await rpc.handle({ method: "listIntegrations" })) as { error: { message: string } }[];
  expect(s?.error.message).toBe("github 401: Bearer ***");
});

test("duplicate handlers and unknown methods are refused", async () => {
  const h = { listGithubRepos: async () => [] };
  expect(() => createIntegrationRpc({ handlers: [h, h], probes: [], stops: [] })).toThrow("duplicate");
  const rpc = createIntegrationRpc({ handlers: [], probes: [], stops: [] });
  await expect(rpc.handle({ method: "listGithubRepos", query: "" })).rejects.toThrow("NOT_FOUND");
  await expect(rpc.handle({ method: "testIntegration", id: "figma" })).rejects.toThrow("NOT_FOUND");
  await expect(rpc.handle({ method: "disconnectIntegration", id: "github" })).rejects.toThrow("NOT_FOUND");
});
```

`packages/daemon/src/integrations/bootstrap.test.ts` :

```ts
import { expect, test } from "bun:test";
import { parseIntegrationFlags } from "./bootstrap";

test("memory secrets require test origins", () => {
  expect(parseIntegrationFlags({})).toEqual({ testOrigins: [], memorySecrets: false });
  expect(parseIntegrationFlags({ "test-origins": "api.github.com=http://127.0.0.1:4391" })).toEqual({
    testOrigins: ["api.github.com=http://127.0.0.1:4391"],
    memorySecrets: false,
  });
  expect(() => parseIntegrationFlags({ "memory-secrets": true })).toThrow("INVALID_INPUT");
});
```

Run: `bun test packages/daemon/src/integrations/registry.test.ts packages/daemon/src/integrations/bootstrap.test.ts` — Expected: FAIL.

- [x] **Step 5: Implémenter `registry.ts`, `memory-secret-store.ts`, `probes.ts`, `bootstrap.ts`**

`packages/daemon/src/integrations/registry.ts` :

```ts
import {
  IntegrationId,
  type IntegrationRpcRequest,
  type IntegrationStatus,
  KiboError,
} from "@kibo/schema";
import type { ComponentIntegrationHooks, IntegrationHandlers, IntegrationProbe } from "./types";

export type IntegrationRpc = {
  handles(method: string): boolean;
  handle(req: IntegrationRpcRequest): Promise<unknown>;
  stop(): void;
  hooks: ComponentIntegrationHooks;
};
type AnyHandler = (req: IntegrationRpcRequest) => Promise<unknown>;

function errorStatus(id: IntegrationId, e: unknown, redact: (text: string) => string): IntegrationStatus {
  if (!(e instanceof KiboError)) console.error(`[kibo-daemon] probe ${id} failed`, e);
  return {
    id,
    state: "error",
    account: null,
    servers: [],
    error: e instanceof KiboError ? { code: e.code, message: redact(e.detail) } : { code: "INTERNAL", message: "probe failed" },
    resumeAt: null,
  };
}

export function createIntegrationRpc(parts: {
  handlers: IntegrationHandlers[];
  probes: IntegrationProbe[];
  stops: (() => void)[];
  hooks?: ComponentIntegrationHooks;
  redact?: (text: string) => string;
}): IntegrationRpc {
  const redact = parts.redact ?? ((text: string) => text);
  const table = new Map<string, AnyHandler>();
  for (const group of parts.handlers) {
    for (const [method, fn] of Object.entries(group)) {
      if (table.has(method)) throw new Error(`duplicate integration handler ${method}`);
      if (typeof fn === "function") table.set(method, fn as AnyHandler);
    }
  }
  const probes = new Map(parts.probes.map((p) => [p.id, p]));
  const run = async (id: IntegrationId, fn: () => Promise<IntegrationStatus>) => {
    try {
      return await fn();
    } catch (e) {
      return errorStatus(id, e, redact);
    }
  };
  return {
    handles: (method) =>
      method === "listIntegrations" || method === "testIntegration" || method === "disconnectIntegration" || table.has(method),
    async handle(req) {
      if (req.method === "listIntegrations") {
        const ordered = IntegrationId.options.flatMap((id) => {
          const p = probes.get(id);
          return p ? [p] : [];
        });
        return Promise.all(ordered.map((p) => run(p.id, () => p.status())));
      }
      if (req.method === "testIntegration") {
        const p = probes.get(req.id);
        if (!p) throw new KiboError("NOT_FOUND", `no probe for ${req.id}`);
        return run(p.id, () => (p.test ? p.test() : p.status()));
      }
      if (req.method === "disconnectIntegration") {
        const p = probes.get(req.id);
        if (!p?.disconnect) throw new KiboError("NOT_FOUND", `${req.id} cannot be disconnected`);
        await p.disconnect();
        return null;
      }
      const fn = table.get(req.method);
      if (!fn) throw new KiboError("NOT_FOUND", `no handler for ${req.method}`);
      return fn(req);
    },
    stop() {
      for (const s of parts.stops) s();
    },
    hooks: parts.hooks ?? NEUTRAL_HOOKS,
  };
}

export const NEUTRAL_HOOKS: ComponentIntegrationHooks = {
  aliases: new Map(),
  observe: () => undefined,
  secret: async () => null,
  mcp: null,
  ciRuns: null,
};
```

`packages/daemon/src/integrations/methods.ts` (même modèle que `components/methods.ts`) :

```ts
import { INTEGRATION_RPC, type IntegrationRpcRequest, type RpcRequest } from "@kibo/schema";

export const INTEGRATION_METHODS: ReadonlySet<string> = new Set(INTEGRATION_RPC.map((s) => s.shape.method.value));

export const isIntegrationRequest = (req: RpcRequest): req is IntegrationRpcRequest =>
  INTEGRATION_METHODS.has(req.method);
```

Le `as AnyHandler` est le seul transtypage : `IntegrationHandlers` associe à chaque méthode un handler de sa propre requête, et la table n'est lue qu'avec la méthode de la requête reçue.

`packages/daemon/src/integrations/memory-secret-store.ts` :

```ts
import { KiboError, type SecretName, SecretNameSchema } from "@kibo/schema";
import type { Redactor } from "./redact";
import type { SecretStore } from "./types";

export function createMemorySecretStore(
  redactor: Redactor,
  initial: Record<string, string> = {},
): SecretStore & { dump(): Map<string, string> } {
  const values = new Map(Object.entries(initial));
  for (const v of values.values()) redactor.add(v);
  const check = (name: SecretName) => {
    if (!SecretNameSchema.safeParse(name).success) throw new KiboError("INVALID_INPUT", "invalid secret name");
  };
  return {
    availability: async () => ({ ok: true }),
    has: async (name) => values.has(name),
    get: async (name) => {
      check(name);
      const v = values.get(name) ?? null;
      if (v !== null) redactor.add(v);
      return v;
    },
    set: async (name, value) => {
      check(name);
      if (!value) throw new KiboError("INVALID_INPUT", "empty secret");
      redactor.add(value);
      values.set(name, value);
    },
    delete: async (name) => {
      values.delete(name);
    },
    dump: () => new Map(values),
  };
}

export function unavailableSecretStore(reason: string): SecretStore {
  const fail = async (): Promise<never> => {
    throw new KiboError("SECRET_STORE_UNAVAILABLE", reason);
  };
  return { availability: async () => ({ ok: false, reason }), has: fail, get: fail, set: fail, delete: fail };
}
```

`packages/daemon/src/integrations/probes.ts` :

```ts
import type { IntegrationId, IntegrationStatus } from "@kibo/schema";
import type { IntegrationHost, IntegrationProbe } from "./types";

export const baseStatus = (id: IntegrationId, state: IntegrationStatus["state"]): IntegrationStatus => ({
  id,
  state,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
});

export function builtinProbes(host: IntegrationHost): IntegrationProbe[] {
  return [
    {
      id: "git",
      status: async () =>
        (await host.gitAvailable())
          ? baseStatus("git", "active")
          : { ...baseStatus("git", "error"), error: { code: "NOT_FOUND", message: "git introuvable" } },
    },
    { id: "notifications", status: async () => baseStatus("notifications", "active") },
    { id: "markdown", status: async () => baseStatus("markdown", "connected") },
  ];
}
```

`packages/daemon/src/integrations/bootstrap.ts` (les tâches suivantes y ajoutent chacune une ligne de création de service et une ligne d'enregistrement de module) :

```ts
import { KiboError } from "@kibo/schema";
import { migrateIntegrations } from "./db";
import { createEventLog, type EventLog } from "./events";
import { createMemorySecretStore, unavailableSecretStore } from "./memory-secret-store";
import { builtinProbes } from "./probes";
import type { Redactor } from "./redact";
import { createIntegrationRpc, type IntegrationRpc, NEUTRAL_HOOKS } from "./registry";
import { createSettings, type Settings } from "./settings";
import type {
  ComponentIntegrationHooks,
  IntegrationHandlers,
  IntegrationHost,
  IntegrationProbe,
  SecretStore,
} from "./types";

export type IntegrationFlags = { testOrigins: string[]; memorySecrets: boolean };
export type IntegrationKit = {
  host: IntegrationHost;
  flags: IntegrationFlags;
  redactor: Redactor;
  events: EventLog;
  settings: Settings;
  secrets: SecretStore;
  hooks: ComponentIntegrationHooks;
};
export type IntegrationModule = { handlers?: IntegrationHandlers; probes?: IntegrationProbe[]; stop?: () => void };

export function parseIntegrationFlags(values: { "test-origins"?: string; "memory-secrets"?: boolean }): IntegrationFlags {
  const testOrigins = (values["test-origins"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const memorySecrets = values["memory-secrets"] === true;
  if (memorySecrets && testOrigins.length === 0) {
    throw new KiboError("INVALID_INPUT", "--memory-secrets requires --test-origins");
  }
  return { testOrigins, memorySecrets };
}

function secretStoreFor(flags: IntegrationFlags, redactor: Redactor): SecretStore {
  if (flags.memorySecrets) return createMemorySecretStore(redactor);
  return unavailableSecretStore("system keychain backend not wired yet");
}

export function startIntegrations(host: IntegrationHost, flags: IntegrationFlags, redactor: Redactor): IntegrationRpc {
  migrateIntegrations(host.db);
  if (flags.testOrigins.length > 0) console.warn(`[kibo-daemon] test origins enabled: ${flags.testOrigins.join(", ")}`);
  if (flags.memorySecrets) console.warn("[kibo-daemon] in-memory secret store (test mode)");
  const secrets = secretStoreFor(flags, redactor);
  const kit: IntegrationKit = {
    host,
    flags,
    redactor,
    events: createEventLog(host.db, redactor, host.now),
    settings: createSettings(host.db),
    secrets,
    hooks: { ...NEUTRAL_HOOKS, secret: (name) => secrets.get(name) },
  };
  const modules: IntegrationModule[] = [{ probes: builtinProbes(kit.host) }];
  return createIntegrationRpc({
    handlers: modules.flatMap((m) => (m.handlers ? [m.handlers] : [])),
    probes: modules.flatMap((m) => m.probes ?? []),
    stops: modules.flatMap((m) => (m.stop ? [m.stop] : [])),
    hooks: kit.hooks,
    redact: redactor.redact,
  });
}
```

Run: `bun test packages/daemon/src/integrations` — Expected: PASS.

- [x] **Step 6: Tests du chemin unique et de l'hôte réel (échouent)**

`packages/daemon/src/integrations/host.test.ts` (sur le vrai store et le vrai service ; `call` est l'aide typée de `service.ts`) :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChangeMessage, ProjectMeta, Ticket } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { CommandEvent } from "../docs";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { createIntegrationHost } from "./host";
import type { IntegrationHost } from "./types";

let home: string;
let store: Store;
let service: Service;
let host: IntegrationHost;
let project: ProjectMeta;
let notices: Notice[];

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-host-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  notices = [];
  host = createIntegrationHost({ user: "adam", home, store, service, notify: (n) => notices.push(n) });
  project = call(service, { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#71717A" });
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const createTicket = (title: string) =>
  host.command(project.id, { method: "createTicket", title }, { origin: "user", instanceId: null });

test("commands carry their origin and observers run inside the persistence transaction", () => {
  const seen: CommandEvent[] = [];
  host.onCommand((e) => {
    seen.push(e);
    expect(store.db.inTransaction).toBe(true);
  });
  host.command(project.id, { method: "createTicket", title: "A" }, { origin: "sync", instanceId: null });
  expect(seen[0]?.meta).toEqual({ origin: "sync", instanceId: null });
  expect(seen[0]?.command.method).toBe("createTicket");
});

test("a failing observer rolls back persistence and restores the in-memory doc", () => {
  createTicket("Kept");
  const off = host.onCommand(() => {
    throw new Error("observer boom");
  });
  expect(() => createTicket("Lost")).toThrow("observer boom");
  off();
  expect(host.snapshot(project.id).tickets.map((t) => t.title)).toEqual(["Kept"]);
  const again = createService(store, { user: "adam" });
  expect(call(again, { method: "getProject", projectId: project.id }).tickets.map((t) => t.title)).toEqual(["Kept"]);
});

test("interceptors rewrite a command before observers see it", () => {
  const seen: string[] = [];
  host.intercept((_p, cmd) => (cmd.method === "createTicket" ? { ...cmd, title: `${cmd.title}!` } : cmd));
  host.onCommand((e) => seen.push(e.command.method === "createTicket" ? e.command.title : ""));
  createTicket("A");
  expect(seen).toEqual(["A!"]);
  expect(host.snapshot(project.id).tickets[0]?.title).toBe("A!");
});

test("the command rpc checks its instance and passes it to observers", () => {
  const seen: CommandEvent[] = [];
  host.onCommand((e) => seen.push(e));
  expect(() =>
    call(service, { method: "command", projectId: project.id, instanceId: "nope", command: { method: "createTicket", title: "X" } }),
  ).toThrow("NOT_FOUND");
  call(service, { method: "command", projectId: project.id, command: { method: "createTicket", title: "Y" } });
  expect(seen.map((e) => e.meta)).toEqual([{ origin: "user", instanceId: null }]);
});

test("agents, rules and derived statuses reach the same observers", () => {
  const parent = createTicket("Parent");
  const child = host.command(
    project.id,
    { method: "createTicket", title: "Enfant", parentId: parent.id },
    { origin: "user", instanceId: null },
  );
  const seen: string[] = [];
  host.onCommand((e) => seen.push(`${e.command.method}:${"ticketId" in e.command ? e.command.ticketId : ""}`));
  service.agentData.assignTicket(project.id, child.id, "dev");
  service.triggerRules(project.id, { kind: "pr_merged", ticketId: child.id });
  expect(seen).toEqual([`updateTicket:${child.id}`, `setStatus:${child.id}`, `setStatus:${parent.id}`]);
  const tickets: Ticket[] = host.snapshot(project.id).tickets;
  expect(tickets.map((t) => t.statusId)).toEqual(["done", "done"]);
});

test("broadcasts and notices go through the change channel", () => {
  const messages: ChangeMessage[] = [];
  service.onChange((m) => messages.push(m));
  host.broadcast({ type: "integrations" });
  host.notify({ title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." });
  expect(messages).toEqual([
    { type: "integrations" },
    { type: "notice", title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." },
  ]);
  expect(notices).toEqual([{ title: "CI cassée sur KIB-1", body: "ci a échoué sur la PR #12." }]);
});
```

`packages/sdk/src/client.test.ts`, nouveau test sur le modèle de « topic, run and project messages reach their own listeners » : le serveur envoie `{ type: "integrations" }` puis `{ type: "sync", projectId: "p1", bindingId: "b1", imported: 2, running: true }` puis `{ projectId: "p1" }` ; attendu `seen` = `["integrations", "sync:p1", "project:p1"]` (un événement d'intégration n'atteint jamais les écouteurs de projet).

Run: `bun test packages/daemon/src/integrations/host.test.ts packages/sdk/src/client.test.ts` — Expected: FAIL.

- [x] **Step 7: Chemin unique des commandes, store, service, porte, agents (N22)**

`packages/daemon/src/store.ts` : ajouter au type `Store` `transaction<T>(fn: () => T): T;` et au retour d'`openStore` :

```ts
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
```

`packages/daemon/src/docs.ts` :

```ts
import type { RuleTrigger } from "@kibo/core/rules";
import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

export type CommandOrigin = "user" | "sync";
export type CommandMeta = { origin: CommandOrigin; instanceId: string | null };
export type CommandEvent = { projectId: string; command: ProjectCommand; result: unknown; meta: CommandMeta };
export type CommandInterceptor = (projectId: string, cmd: ProjectCommand, meta: CommandMeta) => ProjectCommand;
export const USER_COMMAND: CommandMeta = { origin: "user", instanceId: null };

export type Docs = {
  workspace: LoroDoc;
  project(id: string): LoroDoc;
  projectIds(): string[];
  save(projectId: string | null): void;
  emit(message: ChangeMessage): void;
  run(projectId: string, command: ProjectCommand, meta?: CommandMeta): unknown;
  trigger(projectId: string, trigger: RuleTrigger, meta?: CommandMeta): number;
};
```

`packages/daemon/src/service.ts` : `runProjectCommand` disparaît au profit de `docs.run` et `docs.trigger`, définis dans l'objet `docs` de `createService` (seul constructeur de `Docs`) :

```ts
  const commandListeners = new Set<(e: CommandEvent) => void>();
  const interceptors = new Set<CommandInterceptor>();
  let integrations: IntegrationRpc | null = null;

  const execute = (doc: LoroDoc, projectId: string, requested: ProjectCommand, meta: CommandMeta, done: CommandEvent[]) => {
    let command = requested;
    for (const i of interceptors) command = i(projectId, command, meta);
    const result = executeProjectCommand(doc, command);
    done.push({ projectId, command, result, meta });
    return { command, result };
  };
  const derive = (doc: LoroDoc, projectId: string, trigger: RuleTrigger, meta: CommandMeta, done: CommandEvent[]) => {
    for (const command of evaluateRules(readRules(doc), trigger, listTickets(doc))) execute(doc, projectId, command, meta, done);
  };
  const restore = (projectId: string) => {
    const restored = loadDoc(store, projectDocId(projectId));
    if (!restored) throw new KiboError("STORE_CORRUPT", `project ${projectId} lost its snapshot`);
    projects.set(projectId, restored);
  };
  const commit = (projectId: string, done: CommandEvent[]) => {
    store.transaction(() => {
      docs.save(projectId);
      for (const e of done) for (const l of commandListeners) l(e);
    });
    docs.emit({ projectId });
    if (done.some((e) => changesDomainUsage(e.command))) docs.emit({ topic: "config" });
    components?.afterCommand(projectId);
  };
  const guarded = <T>(projectId: string, work: (doc: LoroDoc, done: CommandEvent[]) => T): T => {
    const done: CommandEvent[] = [];
    try {
      const out = work(docs.project(projectId), done);
      if (done.length > 0) commit(projectId, done);
      return out;
    } catch (e) {
      if (done.length > 0) restore(projectId);
      throw e;
    }
  };
```

et, dans `docs` :

```ts
    run(projectId, requested, meta = USER_COMMAND) {
      return guarded(projectId, (doc, done) => {
        const { command, result } = execute(doc, projectId, requested, meta, done);
        if (command.method === "setStatus") derive(doc, projectId, { kind: "status_changed", ticketId: command.ticketId }, meta, done);
        return result;
      });
    },
    trigger(projectId, trigger, meta = USER_COMMAND) {
      return guarded(projectId, (doc, done) => {
        derive(doc, projectId, trigger, meta, done);
        return done.length;
      });
    },
```

Les commandes dérivées des règles passent par les intercepteurs et les observateurs, dans la même transaction, sans redéclencher les règles. `emit` est typé `ChangeMessage`, qui inclut `IntegrationEvent` depuis la Task 1 (N24) : le serveur publie déjà tout `service.onChange` sur le canal `changes`, `server.ts` n'a rien de plus à diffuser. Le reste de `service.ts` :
- `transaction<T>(fn: () => T): T` (utilisé par `host.transaction`, Tasks 14, 15, 16) : `store.transaction(fn)` qui note les projets modifiés par `docs.run`/`docs.trigger` pendant `fn` (ensemble `touched`, rempli par `guarded` quand `done.length > 0`) ; si `fn` échoue, chaque projet noté est rechargé depuis SQLite (`restore`) puis `docs.emit({ projectId })`, et l'erreur est relancée. Imbriqué, il ouvre un point de sauvegarde (`store.transaction(fn)`) avec son propre ensemble `touched` : si le `fn` imbriqué échoue, ses projets sont rechargés (le rechargement lit l'état de la transaction englobante, point de sauvegarde annulé) avant de relancer l'erreur ; s'il réussit, ses projets rejoignent l'ensemble englobant. Sinon, une erreur imbriquée rattrapée par le `fn` englobant laisserait en mémoire une commande dont le snapshot et les écritures des observateurs (boîte d'envoi) ont été annulés, puis persistée à la sauvegarde suivante sans être observée (revue de la Task 2). Raison : une écriture SQLite du moteur de sync qui échoue après une commande annulerait le snapshot persisté mais laisserait le ticket dans le doc en mémoire (import en double à la sauvegarde suivante). Tests dans `host.test.ts` : « a failing host transaction restores the docs it touched » (commande dans `host.transaction`, puis `throw` ; le ticket n'est ni en mémoire ni en base) et « a failing nested transaction caught by its parent leaves memory and SQLite equal » (`host.transaction(() => { createTicket("A"); try { host.transaction(() => { createTicket("Lost"); throw … }); } catch {} })` ⇒ mémoire et base valent `["A"]`) ;
- `triggerRules(projectId, trigger)` devient `docs.trigger(projectId, trigger)` (le suivi des PR, `code/pr-poller.ts`, n'est pas modifié) ;
- `case "command"` : `assertShellCommand(req.command)` ; si `req.instanceId` est fourni et absent de `listInstances(docs.project(req.projectId))` ⇒ `KiboError("NOT_FOUND", \`instance ${req.instanceId} not found\`)` ; puis `docs.run(req.projectId, req.command, { origin: "user", instanceId: req.instanceId ?? null })` ;
- `handle` : `if (isIntegrationRequest(req)) return integrationsReady().handle(req);` à côté de `isComponentRequest` (`integrationsReady` rejette en `INTERNAL`, « integrations are not ready », comme `componentsReady`) ;
- le service expose `commands: { onCommand(l) { commandListeners.add(l); return () => commandListeners.delete(l); }, intercept(i) { interceptors.add(i); return () => interceptors.delete(i); } }` et `attachIntegrations(rpc) { integrations = rpc; return () => { integrations = null; }; }` ;
- imports : `evaluateRules`, `readRules` (`@kibo/core/rules`), `listInstances`, `listTickets` (`@kibo/core`), `isIntegrationRequest` (`./integrations/methods`), types `IntegrationRpc` (`./integrations/registry`), `CommandEvent`, `CommandInterceptor`, `CommandMeta`, `USER_COMMAND` (`./docs`). `applyRules` n'est plus importé.

`packages/schema/src/rpc.ts` : la requête `command` gagne `instanceId: z.string().min(1).optional()`.

`packages/daemon/src/components/gate.ts` : `GateHandlers.run(projectId: string, instanceId: string, command: ProjectCommand)` ; `dispatch` appelle `h.run(projectId, inst.id, call.command)`. `packages/daemon/src/components/gate-handlers.ts` : `run: async (projectId, instanceId, command) => docs.run(projectId, command, { origin: "user", instanceId })` (plus d'`executeProjectCommand` ni de `changed` pour `run` ; `data` garde `changed`). Le harnais de `gate.test.ts` (`handler("run")`) n'a rien à changer.

`packages/daemon/src/agents/data-port.ts` : `assignTicket` ⇒ `docs.run(projectId, { method: "updateTicket", ticketId, assignee: { kind: "agent", ref: profileName } })` ; `runStarted` ⇒ `docs.trigger(projectId, { kind: "run_started", ticketId })` ; `runDone` ⇒ `docs.trigger(projectId, { kind: "run_done", ticketId })` ; l'aide `changed` disparaît. `applyRules` reste exportée pour `data-port.test.ts` (fonction pure sur un doc, plus appelée par le démon).

Run: `bun test packages/daemon packages/sdk/src/client.test.ts` — Expected: les tests existants du service, de la porte, des agents et du suivi des PR passent ; seuls ceux de l'hôte échouent encore.

- [x] **Step 8: Hôte, démarrage, serveur, client (N24, N25, N26)**

`packages/daemon/src/integrations/host.ts` :

```ts
import { getProjectMeta, listProjects, readProject } from "@kibo/core";
import { type CommandResult, KiboError, type ProjectCommand } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import { createGit, runGh } from "../code/run";
import type { Service } from "../service";
import type { Store } from "../store";
import type { IntegrationHost } from "./types";

export type HostParts = {
  user: string;
  home: string;
  store: Store;
  service: Service;
  notify(notice: Notice): void;
  now?: () => number;
};

export function createIntegrationHost(parts: HostParts): IntegrationHost {
  const { docs, commands } = parts.service;
  return {
    user: parts.user,
    home: parts.home,
    db: parts.store.db,
    transaction: (fn) => parts.service.transaction(fn),
    projects: () => listProjects(docs.workspace),
    snapshot: (projectId) => readProject(docs.project(projectId)),
    command<C extends ProjectCommand>(projectId: string, cmd: C, meta: CommandMeta): CommandResult[C["method"]] {
      return docs.run(projectId, cmd, meta) as CommandResult[C["method"]];
    },
    onCommand: commands.onCommand,
    intercept: commands.intercept,
    broadcast: (event) => docs.emit(event),
    notify(notice) {
      parts.notify(notice);
      docs.emit({ type: "notice", title: notice.title, body: notice.body });
    },
    async gitRemoteUrl(projectId) {
      const folder = getProjectMeta(docs.project(projectId)).folder;
      if (!folder) return null;
      const r = await createGit(folder).run(["remote", "get-url", "origin"]);
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    },
    async gitAvailable() {
      try {
        return (await createGit(parts.home).run(["--version"])).code === 0;
      } catch (e) {
        if (e instanceof KiboError && e.code === "GIT_FAILED") return false;
        throw e;
      }
    },
    gh: (args) => runGh(args, { cwd: parts.home, env: {} }),
    now: parts.now ?? Date.now,
  };
}
```

(`import type { CommandMeta } from "../docs";` ; `as CommandResult[…]` : `docs.run` renvoie `unknown` par conception, comme `executeProjectCommand` et le SDK depuis la v0.1.) `git` et `gh` sont ceux de la phase 3 (`code/run.ts`) : `KIBO_GIT` et `KIBO_GH` restent les points de substitution des tests ; un échec de lancement de `gh` rejette en `GH_UNAVAILABLE`.

`packages/daemon/src/integrations/bootstrap.ts` : exporter `NO_INTEGRATION_FLAGS: IntegrationFlags = { testOrigins: [], memorySecrets: false }`.

`packages/daemon/src/daemon.ts` (N26) : `DaemonOptions` gagne `integrations?: IntegrationFlags` et `redactor?: Redactor`. Dans `assemble`, juste après `createService` :

```ts
  const redactor = opts.redactor ?? createRedactor();
  const integrations = startIntegrations(
    createIntegrationHost({ user: opts.user, home: opts.home, store, service, notify: opts.notify ?? (() => {}) }),
    opts.integrations ?? NO_INTEGRATION_FLAGS,
    redactor,
  );
  closers.push(service.attachIntegrations(integrations));
  closers.push(() => integrations.stop());
```

(`closers` est la liste `back`, fermée en ordre inverse : les intégrations s'arrêtent après les composants et avant `runs.close()` et `store.close()`.) `startServer({ …, redact: redactor.redact })`. `opts.notify` est la notification système de la phase 2 (`stdoutNotifier` en mode natif, no-op sinon) ; en mode navigateur, l'événement `notice` diffusé par `host.notify` est affiché par l'UI (Task 21).

`packages/daemon/src/main.ts` : options `"test-origins": { type: "string" }` et `"memory-secrets": { type: "boolean", default: false }` ; avant `startDaemon` :

```ts
const redactor = createRedactor();
installConsoleRedaction(redactor);
```

et, dans la chaîne `Promise.resolve().then(() => startDaemon({ …, integrations: parseIntegrationFlags(values), redactor }))` (une erreur de drapeau passe par `failStart`).

`packages/daemon/src/server.ts` : `STATUS` gagne `SECRET_STORE_UNAVAILABLE: 503, NOT_CONNECTED: 409, REMOTE_UNAVAILABLE: 502, REMOTE_REJECTED: 502, REMOTE_NOT_FOUND: 404, REMOTE_CONFLICT: 409, MCP_UNAVAILABLE: 502, MCP_FAILED: 502` (`RATE_LIMITED: 429` existe) ; `ServerOptions` gagne `redact?: (text: string) => string` ; `respond(work, redact)` renvoie `fail(e.code, redact(e.detail), …)` et les deux appels (`/api/rpc`, `/api/code`) passent `opts.redact ?? ((t) => t)`. Test ajouté à `server.test.ts` : une RPC qui rejette `KiboError("REMOTE_REJECTED", "github 401: Bearer ghp_TESTSECRET0123456789abcdefghijklmn")` avec `redact` qui remplace ce secret ⇒ statut 502, message `github 401: Bearer ***`. La diffusion WebSocket passe aussi par `redact` : `publish` envoie `redact(JSON.stringify(message))` sur le canal `changes` (un `IntegrationEvent` ou une `notice` diffusés par un module ne peuvent pas porter un secret en clair) ; test ajouté à `server.test.ts` : un `service.onChange` qui émet `{ type: "notice", title: "CI", body: "Bearer <secret>" }` arrive caviardé au client WebSocket.

`packages/sdk/src/client.ts` (N24) : `KiboClient` gagne `subscribeIntegrations(listener: (e: IntegrationEvent) => void): () => void` ; dans `socket.onmessage`, après le test de `CodeEvent` :

```ts
      const integration = IntegrationEvent.safeParse(data);
      if (integration.success) {
        for (const l of integrationListeners) l(integration.data);
        return;
      }
```

`active()` compte aussi `integrationListeners.size` ; `subscribeIntegrations` suit le modèle de `subscribeCode`.

Run: `bun test packages/daemon packages/sdk` — Expected: PASS.

- [x] **Step 9: Hôte factice pour les tests des autres tâches**

`packages/daemon/src/integrations/testing/fake-host.ts` :

```ts
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import {
  type CommandResult,
  type IntegrationEvent,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
} from "@kibo/schema";
import type { CommandEvent, CommandInterceptor, CommandMeta } from "../../docs";
import { migrateIntegrations } from "../db";
import type { IntegrationHost, SystemNotification } from "../types";

export type FakeHost = IntegrationHost & {
  projectId: string;
  notifications: SystemNotification[];
  events: IntegrationEvent[];
  remoteUrl: string | null;
  clock: { now: number };
  ghCalls: string[][];
  ghReply: { code: number; stdout: string; stderr: string };
  close(): void;
};

export function createFakeHost(opts: { user?: string } = {}): FakeHost {
  const home = mkdtempSync(join(tmpdir(), "kibo-int-"));
  const db = new Database(join(home, "kibo.db"), { create: true, strict: true });
  migrateIntegrations(db);
  const meta: ProjectMeta = { id: "p1", key: "KIB", name: "Kibo", folder: "/tmp/kibo", color: "#71717A" };
  const doc = createProjectDoc(meta);
  const listeners = new Set<(e: CommandEvent) => void>();
  const interceptors = new Set<CommandInterceptor>();
  const host: FakeHost = {
    user: opts.user ?? "adam",
    home,
    db,
    projectId: meta.id,
    notifications: [],
    events: [],
    remoteUrl: "git@github.com:adam/kibo.git",
    clock: { now: Date.parse("2026-09-26T10:00:00Z") },
    ghCalls: [],
    ghReply: { code: 1, stdout: "", stderr: "not logged in" },
    transaction: (fn) => db.transaction(fn)(),
    projects: () => [meta],
    snapshot(projectId) {
      if (projectId !== meta.id) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
      return readProject(doc);
    },
    command<C extends ProjectCommand>(projectId: string, cmd: C, m: CommandMeta): CommandResult[C["method"]] {
      if (projectId !== meta.id) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
      let command: ProjectCommand = cmd;
      for (const i of interceptors) command = i(projectId, command, m);
      const result = executeProjectCommand(doc, command);
      db.transaction(() => {
        for (const l of listeners) l({ projectId, command, result, meta: m });
      })();
      return result as CommandResult[C["method"]];
    },
    onCommand(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    intercept(i) {
      interceptors.add(i);
      return () => interceptors.delete(i);
    },
    broadcast: (e) => host.events.push(e),
    notify: (n) => {
      host.notifications.push(n);
      host.events.push({ type: "notice", title: n.title, body: n.body });
    },
    gitRemoteUrl: async () => host.remoteUrl,
    gitAvailable: async () => true,
    gh: async (args) => {
      host.ghCalls.push(args);
      return host.ghReply;
    },
    now: () => host.clock.now,
    close() {
      db.close();
      rmSync(home, { recursive: true, force: true });
    },
  };
  return host;
}
```

(L'hôte factice n'applique pas les règles de statut dérivées : les tâches qui en dépendent testent sur le vrai service, comme `host.test.ts`.)

- [x] **Step 10: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS (y compris les tests existants du service, du serveur, de la porte, des agents, du suivi des PR et du client).

```bash
git add packages/daemon/src/store.ts packages/daemon/src/docs.ts packages/daemon/src/service.ts packages/daemon/src/components/gate.ts packages/daemon/src/components/gate-handlers.ts packages/daemon/src/agents/data-port.ts packages/schema/src/rpc.ts
git commit -m "refactor(daemon): chemin unique des commandes"
git add packages/daemon/src/integrations packages/daemon/src/daemon.ts packages/daemon/src/main.ts packages/daemon/src/server.ts packages/daemon/src/server.test.ts packages/sdk/src/client.ts packages/sdk/src/client.test.ts
git commit -m "feat(daemon): socle des intégrations"
```

---

### Task 2b: Commandes dérivées d'origine `user` (correction, relecture de la tâche 14)

Constat de la relecture lead de la tâche 14 : `command-path.ts` transmet `meta` tel quel aux commandes dérivées d'une règle ; une règle déclenchée par une commande d'origine `sync` reste d'origine `sync` et l'observateur de la boîte d'envoi l'ignore (un parent passé à `done` par `children_done` n'est jamais poussé). N22 exige l'origine `user` pour les commandes dérivées.

**Files:**
- Modify: `packages/daemon/src/command-path.ts`
- Test: `packages/daemon/src/integrations/host.test.ts`

- [x] **Step 1: Test d'abord** : « a rule derived from a sync command reaches observers as a user command » (commande `sync` qui termine le dernier enfant, observateur qui reçoit la dérivée `setStatus` du parent avec `meta.origin === "user"`).
- [x] **Step 2: Implémenter** : les commandes dérivées d'une règle portent `meta = { origin: "user" }` (sans `instanceId`), quelle que soit l'origine de la commande qui les déclenche.
- [x] **Step 3: Vérifier** : `bun test packages components`, `bun run check`, `bun run typecheck`.
- [x] **Step 4: Commit** : `fix(daemon): règles dérivées d'origine user`

### Task 3: Trousseau système (`Bun.secrets`)

**Files:**
- Create: `packages/daemon/src/integrations/bun-secret-store.ts`, `packages/daemon/src/integrations/bun-secret-store.test.ts`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (`secretStoreFor`)

**Interfaces:**
- Consumes: `SecretStore`, `Redactor`, `secretStoreFor`, `IntegrationKit` (Task 2), `SecretNameSchema` (Task 1), `Bun.secrets` (Bun 1.4.2).
- Produces: `KEYCHAIN_SERVICE = "dev.kibo"` ; `type KeychainBackend` ; `createBunSecretStore(redactor: Redactor, backend?: KeychainBackend): SecretStore`.

- [x] **Step 1: Test (échoue)**

`packages/daemon/src/integrations/bun-secret-store.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { createBunSecretStore, KEYCHAIN_SERVICE, type KeychainBackend } from "./bun-secret-store";
import { createRedactor } from "./redact";

function memoryBackend(): KeychainBackend & { calls: string[] } {
  const values = new Map<string, string>();
  const calls: string[] = [];
  return {
    calls,
    get: async ({ service, name }) => {
      calls.push(`get ${service} ${name}`);
      return values.get(name) ?? null;
    },
    set: async ({ name, value }) => {
      calls.push(`set ${name}`);
      values.set(name, value);
    },
    delete: async ({ name }) => values.delete(name),
  };
}

const broken: KeychainBackend = {
  get: async () => {
    throw new Error("Secret Service is not available");
  },
  set: async () => {
    throw new Error("Secret Service is not available");
  },
  delete: async () => {
    throw new Error("Secret Service is not available");
  },
};

describe("keychain secret store", () => {
  test("stores under the kibo service and registers values for redaction", async () => {
    const backend = memoryBackend();
    const r = createRedactor();
    const store = createBunSecretStore(r, backend);
    await store.set("github", "ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(await store.has("github")).toBe(true);
    expect(await store.get("github")).toBe("ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(backend.calls).toContain(`get ${KEYCHAIN_SERVICE} github`);
    expect(r.redact("x ghp_TESTSECRET0123456789abcdefghijklmn")).toBe("x ***");
    await store.delete("github");
    expect(await store.get("github")).toBeNull();
  });

  test("an unavailable keychain is an explicit error, never a plaintext fallback", async () => {
    const store = createBunSecretStore(createRedactor(), broken);
    expect(await store.availability()).toEqual({ ok: false, reason: "Secret Service is not available" });
    await expect(store.set("github", "ghp_value_123456")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    await expect(store.get("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
    await expect(store.has("github")).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  });

  test("invalid names and empty values never reach the backend", async () => {
    const backend = memoryBackend();
    const store = createBunSecretStore(createRedactor(), backend);
    await expect(store.set("github", "")).rejects.toThrow("INVALID_INPUT");
    await expect(store.get("aws" as "github")).rejects.toThrow("INVALID_INPUT");
    expect(backend.calls).toEqual([]);
  });

  test.if(process.env.KIBO_TEST_KEYCHAIN === "1")("real keychain round-trip", async () => {
    const store = createBunSecretStore(createRedactor());
    await store.set("mcp:kibo-test", "kibo-keychain-test-value");
    expect(await store.get("mcp:kibo-test")).toBe("kibo-keychain-test-value");
    await store.delete("mcp:kibo-test");
    expect(await store.get("mcp:kibo-test")).toBeNull();
  });
});
```

Run: `bun test packages/daemon/src/integrations/bun-secret-store.test.ts` — Expected: FAIL (module absent).

- [x] **Step 2: Implémenter**

`packages/daemon/src/integrations/bun-secret-store.ts` :

```ts
import { KiboError, type SecretName, SecretNameSchema } from "@kibo/schema";
import type { Redactor } from "./redact";
import type { SecretStore } from "./types";

export const KEYCHAIN_SERVICE = "dev.kibo";

export type KeychainBackend = {
  get(o: { service: string; name: string }): Promise<string | null>;
  set(o: { service: string; name: string; value: string }): Promise<void>;
  delete(o: { service: string; name: string }): Promise<boolean>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createBunSecretStore(redactor: Redactor, backend: KeychainBackend = Bun.secrets): SecretStore {
  const key = (name: SecretName) => {
    if (!SecretNameSchema.safeParse(name).success) throw new KiboError("INVALID_INPUT", "invalid secret name");
    return { service: KEYCHAIN_SERVICE, name };
  };
  const call = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw new KiboError("SECRET_STORE_UNAVAILABLE", redactor.redact(`${op}: ${message(e)}`));
    }
  };
  const read = async (name: SecretName): Promise<string | null> => {
    const k = key(name);
    const value = await call("get", () => backend.get(k));
    if (!value) return null;
    redactor.add(value);
    return value;
  };
  return {
    async availability() {
      try {
        await backend.get({ service: KEYCHAIN_SERVICE, name: "probe" });
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: redactor.redact(message(e)) };
      }
    },
    has: async (name) => (await read(name)) !== null,
    get: read,
    async set(name, value) {
      const k = key(name);
      if (!value) throw new KiboError("INVALID_INPUT", "empty secret");
      redactor.add(value);
      await call("set", () => backend.set({ ...k, value }));
    },
    async delete(name) {
      const k = key(name);
      await call("delete", () => backend.delete(k));
    },
  };
}
```

`Bun.secrets` (Bun 1.4.2, `bun-types` : `get({ service, name }): Promise<string | null>`, `set({ service, name, value, allowUnrestrictedAccess? }): Promise<void>`, `delete({ service, name }): Promise<boolean>`) est structurellement compatible avec `KeychainBackend` : aucune enveloppe ni transtypage. `allowUnrestrictedAccess` reste à `false` (défaut) : sous macOS, le trousseau peut demander l'accord de l'utilisateur au premier accès du binaire, ce qui est voulu. Le test « real keychain round-trip » ne tourne qu'avec `KIBO_TEST_KEYCHAIN=1` (jamais en CI, jamais par les devs sans accord) ; les autres tests n'appellent jamais `Bun.secrets`.

- [x] **Step 3: Brancher dans l'amorçage**

`packages/daemon/src/integrations/bootstrap.ts` :

```ts
function secretStoreFor(flags: IntegrationFlags, redactor: Redactor): SecretStore {
  if (flags.memorySecrets) return createMemorySecretStore(redactor);
  return createBunSecretStore(redactor);
}
```

Aucun appel au trousseau au démarrage : `startDaemon` est lancé par des dizaines de tests et par l'E2E, qui ne doivent jamais toucher le trousseau réel (ni invite macOS, ni erreur libsecret en CI). La disponibilité n'est lue qu'à la demande, par la sonde GitHub et les handlers qui lisent un secret (Tasks 10 et 12) ; une indisponibilité y devient `SECRET_STORE_UNAVAILABLE` et le bandeau de l'écran 16, et elle est journalisée dans `integration_events` par le handler qui la rencontre.

(`unavailableSecretStore` reste exporté pour les tests.)

- [x] **Step 4: Vérifier et commiter**

Run: `bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/integrations/bun-secret-store.ts packages/daemon/src/integrations/bun-secret-store.test.ts packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): secrets dans le trousseau système"
```

---

### Task 4: Références externes et liaisons

État réel (phase 3) : `ExternalRef` (`packages/schema/src/external-ref.ts`) est une union à une seule branche écrite en ligne (`github_pr { url: z.string().url(), number, state: PrState }`), sans export `GithubPrRef` ; `upsertExternalRef` vit dans `packages/core/src/tickets.ts`, dédoublonne par `url` seulement, et `readTicket` relit le tableau JSON `externalRefs` du nœud sans le valider ; `COMMAND_WRITES.upsertExternalRef = "ticket"` (`packages/schema/src/command.ts`) : la commande est aujourd'hui ouverte à tout composant qui écrit `ticket`. Cette tâche extrait `GithubPrRef`, déplace `upsertExternalRef` dans un nouveau `packages/core/src/external-refs.ts` (clé par type), valide les réfs à la relecture, et rend réservées (`null`) les commandes de références et de liaisons (spec F §3.1 ; sinon un composant tiers pourrait forger une réf. `github_issue` et faire pousser des issues avec le compte de l'utilisateur). Le shell garde ces commandes (`assertShellCommand` inchangé) : `code/code-service.ts` et `code/pr-poller.ts` passent par la RPC `command`.

**Files:**
- Modify: `packages/schema/src/external-ref.ts`, `packages/schema/src/command.ts` (`ProjectCommand`, `COMMAND_WRITES`, `CommandResult`), `packages/schema/src/rpc.ts` (`ProjectSnapshot.bindings`), `packages/schema/src/component.test.ts` (test « reserved commands » : `upsertExternalRef` devient réservée)
- Create: `packages/core/src/external-refs.ts`, `packages/core/src/bindings.ts`, `packages/core/src/bindings.test.ts`, `packages/core/src/external-refs-kinds.test.ts`
- Modify: `packages/core/src/tickets.ts` (retire `upsertExternalRef`, ajoute `readExternalRefs`), `packages/core/src/commands.ts`, `packages/core/src/index.ts`
- Modify: `packages/daemon/src/components/gate.test.ts` (test « external refs and bindings are refused to every component » : les **cinq** commandes `upsertExternalRef`, `removeExternalRef`, `addBinding`, `removeBinding`, `importExternalTicket` refusées `PERMISSION_DENIED` aux composants tiers et intégrés, `missingPermission` non nul même avec toutes les écritures), `packages/daemon/src/code/pr-poller.ts` (`Tracked.ref: GithubPrRef`), `packages/daemon/src/code/code-service.test.ts` (filtre `github_pr`)
- Modify (littéraux `ProjectSnapshot` des tests et fixtures, `bindings: []` ajouté) : `packages/ui/src/agents/fixtures.ts`, `packages/ui/src/tabs/TabBar.test.tsx`, `packages/ui/src/shell/shell.test.tsx`, `packages/ui/src/shell/screens.test.tsx`, `packages/ui/src/code/agent-slots.test.tsx`, `packages/ui/src/code/changes.test.tsx`, `packages/ui/src/state/use-projects.test.tsx`, `packages/ui/src/state/use-snapshots.test.tsx`, `packages/ui/src/dialogs/dialogs.test.tsx`, `packages/ui/src/palette/palette.test.tsx`, `packages/daemon/src/agents/orchestrator.test.ts` (liste relevée par `grep -rln "nextTicketKey:" packages components` ; la compléter si `typecheck` en signale d'autres)

**Interfaces:**
- Consumes: `GithubIssueRef`, `FigmaNodeRef`, `McpItemRef`, `Binding` (Task 1) ; `PrState`, stockage JSON `externalRefs` du nœud de ticket (phase 3, `core/src/tickets.ts`).
- Produces (schema) :
  - `GithubPrRef` (extrait de l'union de la phase 3, `url: WebUrl`), `ExternalRef = z.discriminatedUnion("kind", [GithubPrRef, GithubIssueRef, FigmaNodeRef, McpItemRef])`, `ExternalRefKind`, `externalRefKey(ref): string` (`url` · `bindingId` · `fileKey:nodeId` · `server:itemId`), `externalRefTarget(ref): string | null` (objet distant ; `null` pour une issue en attente)
  - `ProjectCommand` (`command.ts`) gagne (réservées, `COMMAND_WRITES[…] = null`) : `{ method: "removeExternalRef"; ticketId; kind: ExternalRefKind; key: string }`, `{ method: "addBinding"; binding: Binding }`, `{ method: "removeBinding"; bindingId: string }`, `{ method: "importExternalTicket"; title: string; description?: string; statusId?: StatusId; assignee?: Assignee | null; ref: ExternalRef }` ; `COMMAND_WRITES.upsertExternalRef` passe de `"ticket"` à `null`
  - `CommandResult` : `removeExternalRef: Ticket`, `addBinding: Binding`, `removeBinding: null`, `importExternalTicket: Ticket`
  - `ProjectSnapshot.bindings: Binding[]` (`rpc.ts`)
- Produces (core) : `readExternalRefs(node): ExternalRef[]` (`tickets.ts`, validée, `STORE_CORRUPT` sinon) ; dans `external-refs.ts` : `upsertExternalRef(doc, ticketId, ref): Ticket` (dédoublonné par `kind` + `externalRefKey`, position conservée ; même nom et même signature qu'en phase 3) ; `removeExternalRef(doc, { ticketId, kind, key }): Ticket` ; `findTicketByRef(doc, ref): Ticket | null` (par `externalRefTarget`) ; `importExternalTicket(doc, input): Ticket` (idempotent par cible) ; dans `bindings.ts` : `addBinding`, `removeBinding`, `getBinding(doc, id): Binding`, `listBindings(doc): Binding[]`.

- [x] **Step 1: Tests (échouent)**

`packages/core/src/external-refs-kinds.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { ExternalRef } from "@kibo/schema";
import { executeProjectCommand, readProject } from "./commands";
import { findTicketByRef, importExternalTicket, removeExternalRef, upsertExternalRef } from "./external-refs";
import { createProjectDoc } from "./project";
import { createTicket, getTicket } from "./tickets";

const doc = () => createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
const issue = (patch: Partial<Extract<ExternalRef, { kind: "github_issue" }>> = {}): ExternalRef => ({
  kind: "github_issue",
  bindingId: "b1",
  repo: "adam/kibo",
  number: 4,
  nodeId: "I_4",
  url: "https://github.com/adam/kibo/issues/4",
  ...patch,
});
const figma: ExternalRef = {
  kind: "figma_node",
  fileKey: "AbCdEf123456",
  nodeId: "1:2",
  url: "https://www.figma.com/design/AbCdEf123456/K?node-id=1-2",
  name: "Arbre",
};

describe("external refs of every kind", () => {
  test("one github issue per binding, replaced in place", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    upsertExternalRef(d, t.id, figma);
    upsertExternalRef(d, t.id, issue({ number: null, nodeId: null, url: null }));
    const after = upsertExternalRef(d, t.id, issue());
    expect(after.externalRefs).toEqual([figma, issue()]);
    const other = upsertExternalRef(d, t.id, issue({ bindingId: "b2" }));
    expect(other.externalRefs).toHaveLength(3);
  });

  test("figma nodes are keyed by file and node, mcp items by server and id", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    upsertExternalRef(d, t.id, figma);
    upsertExternalRef(d, t.id, { ...figma, name: "Renamed" });
    const withMcp = upsertExternalRef(d, t.id, { kind: "mcp_item", server: "ctx", itemId: "9", url: null, title: "Doc" });
    expect(withMcp.externalRefs.map((r) => r.kind)).toEqual(["figma_node", "mcp_item"]);
    expect(removeExternalRef(d, { ticketId: t.id, kind: "figma_node", key: "AbCdEf123456:1:2" }).externalRefs).toHaveLength(1);
    expect(() => removeExternalRef(d, { ticketId: t.id, kind: "figma_node", key: "nope" })).toThrow("NOT_FOUND");
  });

  test("import creates the ticket and its ref together, and is idempotent", () => {
    const d = doc();
    const a = importExternalTicket(d, { title: "From GitHub", description: "body", statusId: "done", ref: issue() });
    const b = importExternalTicket(d, { title: "Again", ref: issue() });
    expect(b.id).toBe(a.id);
    expect(a.statusId).toBe("done");
    expect(findTicketByRef(d, issue())?.key).toBe("KIB-1");
    expect(readProject(d).tickets).toHaveLength(1);
    const blocked = importExternalTicket(d, { title: "B", statusId: "blocked", ref: issue({ bindingId: "b9" }) });
    expect(blocked.statusId).toBe("todo");
    const other = importExternalTicket(d, { title: "Autre issue", ref: issue({ number: 5, nodeId: "I_5", url: "https://github.com/adam/kibo/issues/5" }) });
    expect(other.id).not.toBe(a.id);
    const pendingA = importExternalTicket(d, { title: "P1", ref: issue({ number: null, nodeId: null, url: null }) });
    const pendingB = importExternalTicket(d, { title: "P2", ref: issue({ number: null, nodeId: null, url: null }) });
    expect(pendingA.id).not.toBe(pendingB.id);
  });

  test("only http(s) urls are accepted, for every kind", () => {
    const d = doc();
    const t = createTicket(d, { title: "A" });
    const pr: ExternalRef = { kind: "github_pr", url: "javascript:alert(1)", number: 1, state: "open" };
    expect(() => upsertExternalRef(d, t.id, pr)).toThrow("INVALID_INPUT");
    expect(() => upsertExternalRef(d, t.id, { ...figma, url: "javascript:alert(1)" })).toThrow("INVALID_INPUT");
    expect(getTicket(d, t.id).externalRefs).toEqual([]);
  });

  test("new commands go through executeProjectCommand", () => {
    const d = doc();
    const t = executeProjectCommand(d, { method: "importExternalTicket", title: "X", ref: figma }) as { id: string };
    executeProjectCommand(d, { method: "removeExternalRef", ticketId: t.id, kind: "figma_node", key: "AbCdEf123456:1:2" });
    expect(readProject(d).tickets[0]?.externalRefs).toEqual([]);
  });
});
```

`packages/core/src/bindings.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import { addBinding, getBinding, listBindings, removeBinding } from "./bindings";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};

test("bindings are stored in the project doc and listed in the snapshot", () => {
  const d = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  addBinding(d, binding);
  expect(() => addBinding(d, binding)).toThrow("INVALID_INPUT");
  expect(getBinding(d, "b1").config.repo).toBe("adam/kibo");
  expect(readProject(d).bindings).toEqual([binding]);
  executeProjectCommand(d, { method: "addBinding", binding: { ...binding, id: "b2" } });
  expect(listBindings(d).map((b) => b.id)).toEqual(["b1", "b2"]);
  removeBinding(d, "b1");
  expect(() => getBinding(d, "b1")).toThrow("NOT_FOUND");
  expect(() => executeProjectCommand(d, { method: "removeBinding", bindingId: "b1" })).toThrow("NOT_FOUND");
});

test("an invalid binding never reaches the doc", () => {
  const d = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  expect(() => addBinding(d, { ...binding, config: { ...binding.config, repo: "nope" } })).toThrow();
  expect(listBindings(d)).toEqual([]);
});
```

Run: `bun test packages/core` — Expected: FAIL.

- [x] **Step 2: Schéma**

`packages/schema/src/external-ref.ts` (la branche `github_pr` de la phase 3 devient `GithubPrRef` ; seul changement de forme : `url` passe de `z.string().url()` à `WebUrl`, comme les trois autres types, car `z.string().url()` accepte `javascript:` et l'URL est rendue en `href` par `TicketDetail.tsx` ; les réfs `github_pr` déjà stockées viennent de `gh` et sont en `https://`) :

```ts
import { z } from "zod";
import { FigmaNodeRef, GithubIssueRef, McpItemRef, WebUrl } from "./integrations";

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const GithubPrRef = z.object({
  kind: z.literal("github_pr"),
  url: WebUrl,
  number: z.number().int().positive(),
  state: PrState,
});
export type GithubPrRef = z.infer<typeof GithubPrRef>;

export const ExternalRef = z.discriminatedUnion("kind", [GithubPrRef, GithubIssueRef, FigmaNodeRef, McpItemRef]);
export type ExternalRef = z.infer<typeof ExternalRef>;
export const ExternalRefKind = z.enum(["github_pr", "github_issue", "figma_node", "mcp_item"]);
export type ExternalRefKind = z.infer<typeof ExternalRefKind>;

export function externalRefKey(ref: ExternalRef): string {
  switch (ref.kind) {
    case "github_pr":
      return ref.url;
    case "github_issue":
      return ref.bindingId;
    case "figma_node":
      return `${ref.fileKey}:${ref.nodeId}`;
    case "mcp_item":
      return `${ref.server}:${ref.itemId}`;
  }
}

export function externalRefTarget(ref: ExternalRef): string | null {
  if (ref.kind !== "github_issue") return `${ref.kind}:${externalRefKey(ref)}`;
  return ref.number === null ? null : `github_issue:${ref.bindingId}#${ref.number}`;
}
```

`externalRefKey` dédoublonne les réfs **d'un ticket** (une issue par liaison et par ticket, spec F §3.1) ; `externalRefTarget` identifie l'objet distant **entre tickets** (import idempotent) ; une issue en attente de création (`number: null`) n'a pas de cible et n'est jamais confondue avec une autre.

`packages/schema/src/command.ts` (`import { Binding } from "./integrations";` ; `ExternalRef`, `ExternalRefKind`, `NodeId`, `StatusId`, `Assignee` y sont déjà importés ou s'ajoutent à l'import de `./external-ref`) : ajouter à l'union `ProjectCommand`

```ts
  z.object({ method: z.literal("removeExternalRef"), ticketId: NodeId, kind: ExternalRefKind, key: z.string().min(1) }),
  z.object({ method: z.literal("addBinding"), binding: Binding }),
  z.object({ method: z.literal("removeBinding"), bindingId: z.string().min(1) }),
  z.object({
    method: z.literal("importExternalTicket"),
    title: z.string(),
    description: z.string().optional(),
    statusId: StatusId.optional(),
    assignee: Assignee.nullable().optional(),
    ref: ExternalRef,
  }),
```

à `CommandResult` (même fichier) : `removeExternalRef: Ticket; addBinding: Binding; removeBinding: null; importExternalTicket: Ticket;`. Dans `COMMAND_WRITES` (même fichier) : `upsertExternalRef: null` (au lieu de `"ticket"`), `removeExternalRef: null, addBinding: null, removeBinding: null, importExternalTicket: null` (commandes réservées au shell et au démon : la porte `createGate` les refuse à tout composant par `isReservedCommand`, le shell les garde par la RPC `command`). `packages/schema/src/component.test.ts`, test « reserved commands write nothing a component can declare » : remplacer `expect(COMMAND_WRITES.upsertExternalRef).toBe("ticket")` par `toBeNull()` et ajouter les quatre nouvelles commandes.

`packages/schema/src/rpc.ts` : `ProjectSnapshot` gagne `bindings: Binding[];` (`import type { Binding } from "./integrations";`). Les littéraux `ProjectSnapshot` des tests et fixtures listés dans **Files** gagnent `bindings: []`.

- [x] **Step 3: Core**

`packages/core/src/tickets.ts` : retirer `upsertExternalRef` (déplacée ci-dessous, même nom et même signature, réexportée par `index.ts` : `tickets.test.ts`, qui l'importe de `./index`, reste inchangé) et remplacer la lecture non validée de `readTicket` (`externalRefs: (d.get("externalRefs") as ExternalRef[] | undefined) ?? []`) par `externalRefs: readExternalRefs(n)` :

```ts
const RefList = ExternalRef.array();

export function readExternalRefs(node: LoroTreeNode): ExternalRef[] {
  const raw = node.data.get("externalRefs");
  if (raw === undefined || raw === null) return [];
  const parsed = RefList.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid external refs on ${node.id}`);
  return parsed.data;
}
```

(`ExternalRef` passe d'un import de type à un import de valeur.) Le stockage de la phase 3 (tableau JSON sous la clé `externalRefs` du nœud) est conservé ; seule la clé de dédoublonnage change. `external-refs.ts` importe `tickets.ts`, jamais l'inverse (pas de cycle).

`packages/core/src/external-refs.ts` :

```ts
import {
  type Assignee,
  ExternalRef,
  type ExternalRefKind,
  externalRefKey,
  externalRefTarget,
  KiboError,
  type StatusId,
  type Ticket,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createTicket, getTicket, listTickets, readExternalRefs as readRefs } from "./tickets";
import { getNode } from "./tree";

const tree = (doc: LoroDoc) => doc.getTree("tickets");

const sameRef = (a: ExternalRef, b: ExternalRef) => a.kind === b.kind && externalRefKey(a) === externalRefKey(b);

export function upsertExternalRef(doc: LoroDoc, ticketId: string, ref: ExternalRef): Ticket {
  const parsed = ExternalRef.parse(ref);
  const node = getNode(tree(doc), ticketId);
  const refs = readRefs(node);
  const index = refs.findIndex((r) => sameRef(r, parsed));
  node.data.set("externalRefs", index === -1 ? [...refs, parsed] : refs.map((r, i) => (i === index ? parsed : r)));
  doc.commit();
  return getTicket(doc, ticketId);
}

export function removeExternalRef(doc: LoroDoc, input: { ticketId: string; kind: ExternalRefKind; key: string }): Ticket {
  const node = getNode(tree(doc), input.ticketId);
  const refs = readRefs(node);
  const next = refs.filter((r) => !(r.kind === input.kind && externalRefKey(r) === input.key));
  if (next.length === refs.length) throw new KiboError("NOT_FOUND", `no ${input.kind} ref ${input.key}`);
  node.data.set("externalRefs", next);
  doc.commit();
  return getTicket(doc, input.ticketId);
}

export function findTicketByRef(doc: LoroDoc, ref: ExternalRef): Ticket | null {
  const target = externalRefTarget(ref);
  if (target === null) return null;
  return listTickets(doc).find((t) => t.externalRefs.some((r) => externalRefTarget(r) === target)) ?? null;
}

export function importExternalTicket(
  doc: LoroDoc,
  input: { title: string; description?: string; statusId?: StatusId; assignee?: Assignee | null; ref: ExternalRef },
): Ticket {
  const existing = findTicketByRef(doc, input.ref);
  if (existing) return existing;
  const statusId = input.statusId === "blocked" ? "todo" : input.statusId;
  const ticket = createTicket(doc, { title: input.title, description: input.description, statusId, assignee: input.assignee });
  return upsertExternalRef(doc, ticket.id, input.ref);
}
```

`packages/core/src/bindings.ts` :

```ts
import { Binding, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

const map = (doc: LoroDoc) => doc.getMap("bindings");

export function addBinding(doc: LoroDoc, input: Binding): Binding {
  const binding = Binding.parse(input);
  if (map(doc).get(binding.id) !== undefined) throw new KiboError("INVALID_INPUT", `binding ${binding.id} exists`);
  map(doc).set(binding.id, binding);
  doc.commit();
  return binding;
}

export function removeBinding(doc: LoroDoc, id: string): void {
  if (map(doc).get(id) === undefined) throw new KiboError("NOT_FOUND", `binding ${id} not found`);
  map(doc).delete(id);
  doc.commit();
}

export function listBindings(doc: LoroDoc): Binding[] {
  return Object.values(map(doc).toJSON())
    .map((v) => Binding.parse(v))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getBinding(doc: LoroDoc, id: string): Binding {
  const raw = map(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `binding ${id} not found`);
  return Binding.parse(raw);
}
```

`packages/core/src/commands.ts` : `upsertExternalRef` est importée de `./external-refs` (plus de `./tickets`) ; cas `removeExternalRef` (`return removeExternalRef(doc, { ticketId: cmd.ticketId, kind: cmd.kind, key: cmd.key });`), `addBinding` (`return addBinding(doc, cmd.binding);`), `removeBinding` (`removeBinding(doc, cmd.bindingId); return null;`), `importExternalTicket` (`const { method: _method, ...input } = cmd; return importExternalTicket(doc, input);`) dans le `switch` exhaustif d'`executeProjectCommand` ; `readProject` ajoute `bindings: listBindings(doc)`. `packages/core/src/index.ts` : `export * from "./bindings";` et `export * from "./external-refs";`.

- [x] **Step 4: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck` — Expected: PASS (tests de la phase 3 sur `github_pr` compris : `core/src/tickets.test.ts`, `daemon/src/code/code-service.test.ts`, suivi des PR).

```bash
git add packages/schema/src/external-ref.ts packages/schema/src/command.ts packages/schema/src/rpc.ts packages/schema/src/component.test.ts packages/core/src/external-refs.ts packages/core/src/external-refs-kinds.test.ts packages/core/src/bindings.ts packages/core/src/bindings.test.ts packages/core/src/tickets.ts packages/core/src/commands.ts packages/core/src/index.ts \
  packages/ui/src/agents/fixtures.ts packages/ui/src/tabs/TabBar.test.tsx packages/ui/src/shell/shell.test.tsx packages/ui/src/shell/screens.test.tsx packages/ui/src/code/agent-slots.test.tsx packages/ui/src/code/changes.test.tsx packages/ui/src/state/use-projects.test.tsx packages/ui/src/state/use-snapshots.test.tsx packages/ui/src/dialogs/dialogs.test.tsx packages/ui/src/palette/palette.test.tsx packages/daemon/src/agents/orchestrator.test.ts
git commit -m "feat(core): références externes et liaisons"
```

(Un seul commit : `typecheck` ne passe qu'avec les littéraux `ProjectSnapshot` complétés.)

---

### Task 5: Fusion à trois

**Files:**
- Create: `packages/core/src/sync-plan.ts`, `packages/core/src/sync-plan.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `SyncedFields`, `SyncedField`, `StatusMap`, `projectStatus`, `remoteStatusId` (Task 1).
- Produces:
  - `SYNCED_FIELDS: readonly SyncedField[]`
  - `type CanApply = (field: SyncedField, value: SyncedFields[SyncedField]) => boolean` ; `canApplyRemote` (refuse `statusId = "blocked"`)
  - `normalizeText(s: string): string` (`\r\n` et `\r` → `\n`)
  - `projectLocal(ticket: { title: string; description: string; statusId: StatusId }, base: SyncedFields, map: StatusMap | null): SyncedFields`
  - `type SyncPlan = { push: Partial<SyncedFields>; apply: Partial<SyncedFields>; conflicts: ("title" | "description" | "statusId")[]; nextBase: SyncedFields }`
  - `planSync(i: { base; local; remote; canApply?: CanApply }): SyncPlan`
  - `settleAfterPush(i: { base: SyncedFields; pushed: SyncedField[]; returned: SyncedFields; local: SyncedFields; canApply?: CanApply }): SyncPlan`
  - `canonicalFields(f: SyncedFields): string` (JSON à clés triées, entrée du hash anti-écho)

- [x] **Step 1: Tests (échouent)**

`packages/core/src/sync-plan.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import {
  remoteStatusId,
  type StatusId,
  StatusId as StatusIds,
  type StatusMap,
  type SyncedFields,
} from "@kibo/schema";
import fc from "fast-check";
import {
  type CanApply,
  canonicalFields,
  normalizeText,
  planSync,
  projectLocal,
  SYNCED_FIELDS,
  settleAfterPush,
} from "./sync-plan";

const f = (patch: Partial<SyncedFields> = {}): SyncedFields => ({
  title: "A",
  description: "",
  statusId: "todo",
  closed: false,
  ...patch,
});

describe("three-way merge, field by field (spec F §5.3)", () => {
  test("nothing changed", () => {
    expect(planSync({ base: f(), local: f(), remote: f() })).toEqual({
      push: {},
      apply: {},
      conflicts: [],
      nextBase: f(),
    });
  });
  test("local only is pushed", () => {
    expect(planSync({ base: f(), local: f({ title: "B" }), remote: f() }).push).toEqual({ title: "B" });
  });
  test("remote only is applied", () => {
    const p = planSync({ base: f(), local: f(), remote: f({ title: "C" }) });
    expect(p.apply).toEqual({ title: "C" });
    expect(p.nextBase.title).toBe("C");
  });
  test("both changed: remote wins and the conflict is reported", () => {
    const p = planSync({ base: f(), local: f({ title: "B" }), remote: f({ title: "C" }) });
    expect(p).toMatchObject({ push: {}, apply: { title: "C" }, conflicts: ["title"] });
  });
  test("both changed to the same value: no conflict", () => {
    const p = planSync({ base: f(), local: f({ title: "B" }), remote: f({ title: "B" }) });
    expect(p).toMatchObject({ push: {}, apply: {}, conflicts: [], nextBase: { title: "B" } });
  });
  test("blocked is never applied from the remote and does not ping-pong", () => {
    const p = planSync({ base: f(), local: f(), remote: f({ statusId: "blocked" }) });
    expect(p.apply).toEqual({});
    expect(p.push).toEqual({});
    expect(p.nextBase.statusId).toBe("todo");
  });
  test("an issue reopened with a refused status reopens the ticket as todo", () => {
    const base = f({ statusId: "done", closed: true });
    const p = planSync({ base, local: base, remote: f({ statusId: "blocked" }) });
    expect(p).toEqual({ push: {}, apply: { statusId: "todo", closed: false }, conflicts: [], nextBase: f() });
  });
  test("closed is never applied without the status it follows", () => {
    const refuseDone: CanApply = (field, value) => !(field === "statusId" && value === "done");
    const p = planSync({ base: f(), local: f(), remote: f({ statusId: "done", closed: true }), canApply: refuseDone });
    expect(p).toEqual({ push: {}, apply: {}, conflicts: [], nextBase: f() });
  });
  test("closed is never reported as a conflict on its own", () => {
    const p = planSync({
      base: f(),
      local: f({ statusId: "done", closed: true }),
      remote: f({ statusId: "done", closed: true, title: "Z" }),
    });
    expect(p.conflicts).toEqual([]);
  });
  test("the base is not mutated", () => {
    const base = f();
    planSync({ base, local: f({ title: "B" }), remote: f({ description: "d" }) });
    expect(base).toEqual(f());
    expect(SYNCED_FIELDS).toEqual(["title", "description", "statusId", "closed"]);
  });
});

describe("projection and settle", () => {
  test("without a project only done/open is representable", () => {
    expect(projectLocal({ title: " A ", description: "a\r\nb", statusId: "in_review" }, f(), null)).toEqual(
      f({ title: "A", description: "a\nb" }),
    );
    expect(projectLocal({ title: "A", description: "", statusId: "done" }, f(), null)).toEqual(
      f({ statusId: "done", closed: true }),
    );
  });
  test("an unmapped status keeps the base, including open/closed", () => {
    const map: StatusMap = { todo: "O1" };
    const base = f({ statusId: "done", closed: true });
    expect(projectLocal({ title: "A", description: "", statusId: "blocked" }, base, map)).toEqual(base);
  });
  test("a local status equal to the base stays the base when options are shared", () => {
    const map: StatusMap = { backlog: "O1", todo: "O1" };
    expect(projectLocal({ title: "A", description: "", statusId: "todo" }, f(), map).statusId).toBe("todo");
    expect(projectLocal({ title: "A", description: "", statusId: "in_progress" }, f(), map).statusId).toBe(
      "todo",
    );
  });
  test("a server-normalised pushed value is taken locally instead of re-pushed", () => {
    const p = settleAfterPush({
      base: f(),
      pushed: ["title"],
      returned: f({ title: "B" }),
      local: f({ title: "B " }),
    });
    expect(p.push).toEqual({});
    expect(p.apply).toEqual({ title: "B" });
  });
  test("canonical fields are key-order independent", () => {
    expect(canonicalFields(f())).toBe(
      canonicalFields({ closed: false, statusId: "todo", description: "", title: "A" }),
    );
    expect(normalizeText("a\rb\r\nc")).toBe("a\nb\nc");
  });
});

type Remote = { title: string; description: string | null; closed: boolean; option: string | null };
type Local = { title: string; description: string; statusId: StatusId };
const toFields = (r: Remote, map: StatusMap | null): SyncedFields => {
  const statusId = remoteStatusId(r.closed, r.option, map);
  return {
    title: r.title.trim(),
    description: normalizeText(r.description ?? ""),
    statusId,
    closed: statusId === "done",
  };
};
const pushTo = (r: Remote, patch: Partial<SyncedFields>, map: StatusMap | null): Remote => {
  const option = patch.statusId !== undefined && map !== null ? map[patch.statusId] : undefined;
  return {
    title: patch.title ?? r.title,
    description: patch.description ?? r.description,
    closed: patch.closed ?? r.closed,
    option: option ?? r.option,
  };
};
const applyLocal = (l: Local, apply: Partial<SyncedFields>): Local => ({
  title: apply.title ?? l.title,
  description: apply.description ?? l.description,
  statusId: apply.statusId ?? l.statusId,
});

const statusArb = fc.constantFrom(...StatusIds.options);
const optionArb = fc.constantFrom("O1", "O2", "O3");
const mapArb = fc.option(
  fc.record(
    {
      backlog: optionArb,
      todo: optionArb,
      in_progress: optionArb,
      in_review: optionArb,
      blocked: optionArb,
      done: optionArb,
    },
    { requiredKeys: [] },
  ),
  { nil: null },
);
const remoteArb = fc.record({
  title: fc.constantFrom("a", "b", "c", "a "),
  description: fc.constantFrom<string | null>(null, "", "x", "x\r\ny", "x\ny"),
  closed: fc.boolean(),
  option: fc.option(optionArb, { nil: null }),
});
const localArb = fc.record({
  title: fc.constantFrom("a", "b", "c", " b "),
  description: fc.constantFrom("", "x", "x\ny", "x\r\ny"),
  statusId: statusArb,
});

test("property: after one pull-and-push cycle, the next cycle is a fixed point", () => {
  fc.assert(
    fc.property(mapArb, remoteArb, remoteArb, localArb, (map, origin, remote, local) => {
      const base = toFields(origin, map);
      const p1 = planSync({ base, local: projectLocal(local, base, map), remote: toFields(remote, map) });
      let localNow = applyLocal(local, p1.apply);
      let remoteNow: Remote = remote;
      let baseNow = p1.nextBase;
      const pushed = SYNCED_FIELDS.filter((field) => field in p1.push);
      if (pushed.length > 0) {
        remoteNow = pushTo(remote, p1.push, map);
        const s = settleAfterPush({
          base: p1.nextBase,
          pushed,
          returned: toFields(remoteNow, map),
          local: projectLocal(localNow, p1.nextBase, map),
        });
        expect(s.push).toEqual({});
        localNow = applyLocal(localNow, s.apply);
        baseNow = s.nextBase;
      }
      const p2 = planSync({
        base: baseNow,
        local: projectLocal(localNow, baseNow, map),
        remote: toFields(remoteNow, map),
      });
      expect(p2.push).toEqual({});
      expect(p2.apply).toEqual({});
    }),
    { numRuns: 2000 },
  );
});
```

Le modèle du test normalise le distant comme l'adaptateur (Task 13 : titre sans espaces de fin, corps `null` ⇒ `""`, `\r\n` ⇒ `\n`).

Run: `bun test packages/core/src/sync-plan.test.ts` — Expected: FAIL (module absent).

- [x] **Step 2: Implémenter `packages/core/src/sync-plan.ts`**

```ts
import {
  projectStatus,
  type StatusId,
  type StatusMap,
  type SyncedField,
  type SyncedFields,
} from "@kibo/schema";

export const SYNCED_FIELDS: readonly SyncedField[] = ["title", "description", "statusId", "closed"];
export type ConflictField = Exclude<SyncedField, "closed">;
export type SyncPlan = {
  push: Partial<SyncedFields>;
  apply: Partial<SyncedFields>;
  conflicts: ConflictField[];
  nextBase: SyncedFields;
};
export type CanApply = (field: SyncedField, value: SyncedFields[SyncedField]) => boolean;

export const canApplyRemote: CanApply = (field, value) => !(field === "statusId" && value === "blocked");

export function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

export function projectLocal(
  ticket: { title: string; description: string; statusId: StatusId },
  base: SyncedFields,
  map: StatusMap | null,
): SyncedFields {
  const statusId =
    ticket.statusId === base.statusId ? base.statusId : projectStatus(ticket.statusId, map, base.statusId);
  return {
    title: ticket.title.trim(),
    description: normalizeText(ticket.description),
    statusId,
    closed: statusId === "done",
  };
}

function isConflictField(field: SyncedField): field is ConflictField {
  return field !== "closed";
}

function followsBaseStatus(
  field: SyncedField,
  value: SyncedFields[SyncedField],
  nextBase: SyncedFields,
): boolean {
  return field !== "closed" || value === (nextBase.statusId === "done");
}

function reopensWithRefusedStatus(
  field: SyncedField,
  i: { base: SyncedFields; remote: SyncedFields },
): boolean {
  return field === "statusId" && i.base.closed && !i.remote.closed;
}

function planField<K extends SyncedField>(
  field: K,
  i: { base: SyncedFields; local: SyncedFields; remote: SyncedFields },
  canApply: CanApply,
  plan: SyncPlan,
): void {
  const b = i.base[field];
  const l = i.local[field];
  const r = i.remote[field];
  const localChanged = l !== b;
  const remoteChanged = r !== b;
  if (!localChanged && !remoteChanged) return;
  if (localChanged && !remoteChanged) {
    plan.push[field] = l;
    return;
  }
  if (!localChanged) {
    if (canApply(field, r) && followsBaseStatus(field, r, plan.nextBase)) {
      plan.apply[field] = r;
      plan.nextBase[field] = r;
    } else if (reopensWithRefusedStatus(field, i)) {
      plan.apply.statusId = "todo";
      plan.nextBase.statusId = "todo";
    }
    return;
  }
  if (l === r) {
    plan.nextBase[field] = r;
    return;
  }
  if (!canApply(field, r)) {
    plan.push[field] = l;
    return;
  }
  plan.apply[field] = r;
  plan.nextBase[field] = r;
  if (isConflictField(field)) plan.conflicts.push(field);
}

export function planSync(i: {
  base: SyncedFields;
  local: SyncedFields;
  remote: SyncedFields;
  canApply?: CanApply;
}): SyncPlan {
  const plan: SyncPlan = { push: {}, apply: {}, conflicts: [], nextBase: { ...i.base } };
  for (const field of SYNCED_FIELDS) planField(field, i, i.canApply ?? canApplyRemote, plan);
  return plan;
}

function takeReturned<K extends SyncedField>(field: K, base: SyncedFields, returned: SyncedFields): void {
  base[field] = returned[field];
}

function preferReturned<K extends SyncedField>(field: K, plan: SyncPlan, returned: SyncedFields): void {
  delete plan.push[field];
  plan.apply[field] = returned[field];
  plan.nextBase[field] = returned[field];
}

export function settleAfterPush(i: {
  base: SyncedFields;
  pushed: SyncedField[];
  returned: SyncedFields;
  local: SyncedFields;
  canApply?: CanApply;
}): SyncPlan {
  const canApply = i.canApply ?? canApplyRemote;
  const base = { ...i.base };
  for (const field of i.pushed) takeReturned(field, base, i.returned);
  const plan = planSync({ base, local: i.local, remote: i.returned, canApply });
  for (const field of i.pushed) {
    if (field in plan.push && canApply(field, i.returned[field])) preferReturned(field, plan, i.returned);
  }
  return plan;
}

export function canonicalFields(f: SyncedFields): string {
  return JSON.stringify({
    closed: f.closed,
    description: f.description,
    statusId: f.statusId,
    title: f.title,
  });
}
```

`projectLocal` garde la base pour un statut local égal à celui de la base (N38). `closed` suit `statusId` (`followsBaseStatus`, N37), ce qui suppose `statusId` avant `closed` dans `SYNCED_FIELDS` (ordre figé par le test « the base is not mutated ») ; une issue rouverte avec un statut refusé rouvre le ticket en `todo` (`reopensWithRefusedStatus`, N37). Ajouter `export * from "./sync-plan";` à `packages/core/src/index.ts`.

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/core/src/sync-plan.test.ts`
Expected: PASS (dont 2 000 exécutions de la propriété). Un contre-exemple de fast-check est un bug de `projectLocal` ou de `settleAfterPush`, jamais du test : le corriger avant de continuer.

- [x] **Step 4: Commit**

```bash
git add packages/core/src/sync-plan.ts packages/core/src/sync-plan.test.ts packages/core/src/index.ts
git commit -m "feat(core): fusion à trois de la sync"
```

---

### Task 6: Faux serveur GitHub

Serveur `Bun.serve` en mémoire qui imite les routes utilisées par Kibo, avec leurs formes exactes. Les requêtes GraphQL sont reconnues **octet pour octet** depuis `GITHUB_GRAPHQL` (Task 1) : une requête modifiée côté client sans le faux échoue en test.

Dossier nouveau `packages/daemon/src/testing/` (faux de la phase 5) ; le faux binaire `gh` de la phase 3 (`packages/daemon/src/code/testing/fake-gh.ts`, commandes `gh`) reste en place et n'est pas remplacé : ce serveur imite l'API HTTP, lui la CLI.

**Files:**
- Create: `packages/daemon/src/testing/fake-github.ts`, `packages/daemon/src/testing/fake-github-graphql.ts`, `packages/daemon/src/testing/fake-github.test.ts`

**Interfaces:**
- Consumes: `GITHUB_GRAPHQL` (Task 1).
- Produces:

```ts
export type FakeIssue = { number: number; nodeId: string; title: string; body: string | null; state: "open" | "closed"; labels: string[]; createdAt: string; updatedAt: string; creator: string; pullRequest: boolean; gone: 404 | 410 | null };
export type FakeJob = { id: number; name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null; log: string };
export type FakeRun = { id: number; headSha: string; headBranch: string; name: string; status: string; conclusion: string | null; createdAt: string; updatedAt: string; jobs: FakeJob[] };
export type FakeRepo = { issues: Map<number, FakeIssue>; pulls: Map<number, { headSha: string; headRef: string }>; runs: FakeRun[]; private: boolean; description: string | null };
export type FakeProjectItem = { itemId: string; issueNumber: number; optionId: string | null; updatedAt: string };
export type FakeProject = { nodeId: string; owner: string; number: number; title: string; repo: string; fieldId: string; options: { id: string; name: string }[]; items: Map<string, FakeProjectItem> };
export type FakeRequest = { method: string; path: string; auth: string | null; body: string };
export type FakeGithub = {
  url: string; login: string; token: string;
  repos: Map<string, FakeRepo>; project: FakeProject | null;
  rate: { remaining: number; reset: number };
  requests: FakeRequest[];
  now(): string; tick(seconds?: number): string;
  addRepo(slug: string): FakeRepo;
  addIssue(slug: string, patch?: Partial<FakeIssue>): FakeIssue;
  editIssue(slug: string, n: number, patch: Partial<FakeIssue>): FakeIssue;
  setProject(p: Omit<FakeProject, "items">): FakeProject;
  addProjectItem(issueNumber: number, optionId: string | null): FakeProjectItem;
  addRun(slug: string, run: Omit<FakeRun, "createdAt" | "updatedAt">): FakeRun;
  failNext(method: string, path: RegExp, status: number, body?: string, headers?: Record<string, string>): void;
  stop(): void;
};
export function startFakeGithub(opts?: { login?: string; token?: string }): FakeGithub;
export const ECHO_AUTH = "echo-auth";
export const LOGS_HOST = "pipelines.actions.githubusercontent.com";
```

Routes : `GET /user`, `GET /user/repos`, `GET|POST /repos/:o/:r/issues` (`state`, `since` inclusif, `creator`, `per_page`, `page`, tri `updated` croissant, `ETag`/`If-None-Match` → 304, en-tête `Link`), `GET|PATCH /repos/:o/:r/issues/:n` (404/410 si `gone`, 422 si titre vide), `GET /repos/:o/:r/pulls/:n`, `GET /repos/:o/:r/actions/runs?head_sha=`, `GET /repos/:o/:r/actions/runs/:id/jobs`, `GET /repos/:o/:r/actions/jobs/:id/logs` (302 vers `https://pipelines.actions.githubusercontent.com/logs/:id`), `GET /logs/:id` (400 si un en-tête `Authorization` arrive : fuite d'identifiant), `POST /graphql` (5 opérations). Toute réponse porte `x-ratelimit-remaining` et `x-ratelimit-reset` ; à 0 restant : 403 « API rate limit exceeded ». `failNext(…, ECHO_AUTH)` renvoie l'en-tête `Authorization` reçu dans le corps de l'erreur (test de fuite).

- [x] **Step 1: Test du faux (échoue)**

`packages/daemon/src/testing/fake-github.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GITHUB_GRAPHQL } from "@kibo/schema";
import { ECHO_AUTH, type FakeGithub, startFakeGithub } from "./fake-github";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
});
afterEach(() => gh.stop());

const call = (path: string, init: RequestInit = {}) =>
  fetch(`${gh.url}${path}`, { ...init, headers: { authorization: `Bearer ${gh.token}`, ...init.headers } });

describe("fake github rest", () => {
  test("authentication is required", async () => {
    expect((await fetch(`${gh.url}/user`)).status).toBe(401);
    expect(await (await call("/user")).json()).toEqual({ login: "adam" });
  });

  test("issues are listed by update date, since is inclusive, pages and etags work", async () => {
    const a = gh.addIssue("adam/kibo", { title: "A" });
    gh.addIssue("adam/kibo", { title: "B" });
    gh.addIssue("adam/kibo", { title: "PR", pullRequest: true });
    const first = await call(`/repos/adam/kibo/issues?state=all&since=${a.updatedAt}&per_page=2&sort=updated&direction=asc`);
    const page = (await first.json()) as { title: string; pull_request?: unknown }[];
    expect(page.map((i) => i.title)).toEqual(["A", "B"]);
    expect(first.headers.get("link")).toContain('rel="next"');
    const etag = first.headers.get("etag") ?? "";
    const again = await call(`/repos/adam/kibo/issues?state=all&since=${a.updatedAt}&per_page=2&sort=updated&direction=asc`, {
      headers: { "if-none-match": etag },
    });
    expect(again.status).toBe(304);
  });

  test("create, edit, gone and validation", async () => {
    const created = await call("/repos/adam/kibo/issues", { method: "POST", body: JSON.stringify({ title: "New", body: "x" }) });
    expect(created.status).toBe(201);
    const issue = (await created.json()) as { number: number; html_url: string; user: { login: string } };
    expect(issue.user.login).toBe("adam");
    expect(issue.html_url).toBe(`https://github.com/adam/kibo/issues/${issue.number}`);
    const bad = await call(`/repos/adam/kibo/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ title: "" }) });
    expect(bad.status).toBe(422);
    gh.editIssue("adam/kibo", issue.number, { gone: 410 });
    expect((await call(`/repos/adam/kibo/issues/${issue.number}`)).status).toBe(410);
  });

  test("rate limit and injected failures", async () => {
    gh.rate.remaining = 1;
    expect((await call("/user")).headers.get("x-ratelimit-remaining")).toBe("0");
    expect((await call("/user")).status).toBe(403);
    gh.rate.remaining = 50;
    gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
    const echoed = await call("/user");
    expect(echoed.status).toBe(500);
    expect(await echoed.text()).toContain(gh.token);
  });

  test("job logs redirect to the logs host, which refuses credentials", async () => {
    gh.addRun("adam/kibo", {
      id: 7,
      headSha: "abc",
      headBranch: "kib-12",
      name: "ci",
      status: "completed",
      conclusion: "failure",
      jobs: [{ id: 70, name: "build", status: "completed", conclusion: "failure", startedAt: null, completedAt: null, log: "##[error]boom" }],
    });
    const redirect = await call("/repos/adam/kibo/actions/jobs/70/logs", { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://pipelines.actions.githubusercontent.com/logs/70");
    expect((await call("/logs/70")).status).toBe(400);
    expect(await (await fetch(`${gh.url}/logs/70`)).text()).toBe("##[error]boom");
  });
});

describe("fake github graphql", () => {
  test("only the shared queries are understood", async () => {
    gh.setProject({ nodeId: "PVT_1", owner: "adam", number: 1, title: "Roadmap", repo: "adam/kibo", fieldId: "F1", options: [{ id: "O1", name: "Todo" }] });
    const issue = gh.addIssue("adam/kibo", { title: "A" });
    gh.addProjectItem(issue.number, "O1");
    const res = await call("/graphql", {
      method: "POST",
      body: JSON.stringify({ query: GITHUB_GRAPHQL.projectItems, variables: { projectId: "PVT_1", after: null } }),
    });
    const body = (await res.json()) as { data: { node: { items: { nodes: { content: { title: string } }[] } } } };
    expect(body.data.node.items.nodes[0]?.content.title).toBe("A");
    const unknown = await call("/graphql", { method: "POST", body: JSON.stringify({ query: "{ viewer { login } }", variables: {} }) });
    expect(unknown.status).toBe(400);
  });
});
```

Run: `bun test packages/daemon/src/testing/fake-github.test.ts` — Expected: FAIL.

- [x] **Step 2: Implémenter `fake-github.ts`**

```ts
import { createHash } from "node:crypto";
import { handleGraphql } from "./fake-github-graphql";

export type FakeIssue = {
  number: number;
  nodeId: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: string[];
  createdAt: string;
  updatedAt: string;
  creator: string;
  pullRequest: boolean;
  gone: 404 | 410 | null;
};
export type FakeJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  log: string;
};
export type FakeRun = {
  id: number;
  headSha: string;
  headBranch: string;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: FakeJob[];
};
export type FakeRepo = {
  issues: Map<number, FakeIssue>;
  pulls: Map<number, { headSha: string; headRef: string }>;
  runs: FakeRun[];
  private: boolean;
  description: string | null;
};
export type FakeProjectItem = { itemId: string; issueNumber: number; optionId: string | null; updatedAt: string };
export type FakeProject = {
  nodeId: string;
  owner: string;
  number: number;
  title: string;
  repo: string;
  fieldId: string;
  options: { id: string; name: string }[];
  items: Map<string, FakeProjectItem>;
};
export type FakeRequest = { method: string; path: string; auth: string | null; body: string };
type Failure = { method: string; path: RegExp; status: number; body: string; headers: Record<string, string> };

export type FakeGithub = {
  url: string;
  login: string;
  token: string;
  repos: Map<string, FakeRepo>;
  project: FakeProject | null;
  rate: { remaining: number; reset: number };
  requests: FakeRequest[];
  now(): string;
  tick(seconds?: number): string;
  addRepo(slug: string): FakeRepo;
  addIssue(slug: string, patch?: Partial<FakeIssue>): FakeIssue;
  editIssue(slug: string, n: number, patch: Partial<FakeIssue>): FakeIssue;
  setProject(p: Omit<FakeProject, "items">): FakeProject;
  addProjectItem(issueNumber: number, optionId: string | null): FakeProjectItem;
  addRun(slug: string, run: Omit<FakeRun, "createdAt" | "updatedAt">): FakeRun;
  failNext(method: string, path: RegExp, status: number, body?: string, headers?: Record<string, string>): void;
  stop(): void;
};

export const ECHO_AUTH = "echo-auth";
export const LOGS_HOST = "pipelines.actions.githubusercontent.com";

export function startFakeGithub(opts: { login?: string; token?: string } = {}): FakeGithub {
  let clock = Date.parse("2026-09-26T10:00:00Z");
  const failures: Failure[] = [];
  const iso = () => new Date(clock).toISOString().replace(/\.\d{3}Z$/, "Z");
  const repo = (slug: string): FakeRepo => {
    const r = gh.repos.get(slug);
    if (!r) throw new Error(`fake repo ${slug} missing`);
    return r;
  };
  const gh: FakeGithub = {
    url: "",
    login: opts.login ?? "adam",
    token: opts.token ?? "ghp_TESTSECRET0123456789abcdefghijklmn",
    repos: new Map(),
    project: null,
    rate: { remaining: 5000, reset: Math.floor(clock / 1000) + 3600 },
    requests: [],
    now: iso,
    tick(seconds = 1) {
      clock += seconds * 1000;
      return iso();
    },
    addRepo(slug) {
      const r: FakeRepo = { issues: new Map(), pulls: new Map(), runs: [], private: false, description: null };
      gh.repos.set(slug, r);
      return r;
    },
    addIssue(slug, patch = {}) {
      const r = repo(slug);
      const number = Math.max(0, ...r.issues.keys()) + 1;
      const at = gh.tick();
      const issue: FakeIssue = {
        number,
        nodeId: `I_${slug.replace("/", "_")}_${number}`,
        title: `Issue ${number}`,
        body: null,
        state: "open",
        labels: [],
        createdAt: at,
        updatedAt: at,
        creator: gh.login,
        pullRequest: false,
        gone: null,
        ...patch,
      };
      r.issues.set(number, issue);
      return issue;
    },
    editIssue(slug, n, patch) {
      const issue = repo(slug).issues.get(n);
      if (!issue) throw new Error(`fake issue ${n} missing`);
      Object.assign(issue, patch, { updatedAt: patch.updatedAt ?? gh.tick() });
      return issue;
    },
    setProject(p) {
      gh.project = { ...p, items: new Map() };
      return gh.project;
    },
    addProjectItem(issueNumber, optionId) {
      if (!gh.project) throw new Error("fake project missing");
      const item = { itemId: `PVTI_${issueNumber}`, issueNumber, optionId, updatedAt: gh.tick() };
      gh.project.items.set(item.itemId, item);
      return item;
    },
    addRun(slug, run) {
      const at = gh.tick();
      const full = { ...run, createdAt: at, updatedAt: at };
      repo(slug).runs.push(full);
      return full;
    },
    failNext(method, path, status, body = '{"message":"injected"}', headers = {}) {
      failures.push({ method, path, status, body, headers });
    },
    stop: () => server.stop(true),
  };
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (req) => route(gh, failures, req) });
  gh.url = `http://127.0.0.1:${server.port}`;
  return gh;
}

const rateHeaders = (gh: FakeGithub): Record<string, string> => ({
  "x-ratelimit-remaining": String(gh.rate.remaining),
  "x-ratelimit-reset": String(gh.rate.reset),
});
const json = (gh: FakeGithub, status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...rateHeaders(gh), ...headers } });

export const restIssue = (slug: string, i: FakeIssue) => ({
  id: i.number * 1000,
  node_id: i.nodeId,
  number: i.number,
  title: i.title,
  body: i.body,
  state: i.state,
  labels: i.labels.map((name) => ({ name })),
  created_at: i.createdAt,
  updated_at: i.updatedAt,
  html_url: `https://github.com/${slug}/issues/${i.number}`,
  user: { login: i.creator },
  ...(i.pullRequest ? { pull_request: { url: `https://api.github.com/repos/${slug}/pulls/${i.number}` } } : {}),
});

async function route(gh: FakeGithub, failures: Failure[], req: Request): Promise<Response> {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const body = req.method === "GET" ? "" : await req.text();
  gh.requests.push({ method: req.method, path: url.pathname + url.search, auth, body });
  const fi = failures.findIndex((f) => f.method === req.method && f.path.test(url.pathname));
  if (fi !== -1) {
    const [f] = failures.splice(fi, 1);
    if (f) {
      const text = f.body === ECHO_AUTH ? JSON.stringify({ message: `Bad credentials: ${auth}` }) : f.body;
      return new Response(text, { status: f.status, headers: { ...rateHeaders(gh), ...f.headers } });
    }
  }
  const logs = /^\/logs\/(\d+)$/.exec(url.pathname);
  if (logs) {
    if (auth !== null) return new Response("credentials leaked to the logs host", { status: 400 });
    const job = [...gh.repos.values()].flatMap((r) => r.runs.flatMap((run) => run.jobs)).find((j) => j.id === Number(logs[1]));
    return job ? new Response(job.log) : new Response("not found", { status: 404 });
  }
  if (auth !== `Bearer ${gh.token}`) return json(gh, 401, { message: "Bad credentials" });
  if (gh.rate.remaining <= 0) return json(gh, 403, { message: "API rate limit exceeded" });
  gh.rate.remaining -= 1;
  if (url.pathname === "/user") return json(gh, 200, { login: gh.login });
  if (url.pathname === "/user/repos") return listRepos(gh, url);
  if (url.pathname === "/graphql" && req.method === "POST") {
    const out = handleGraphql(gh, JSON.parse(body));
    return json(gh, out.status, out.body);
  }
  const m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)$/.exec(url.pathname);
  const slug = m ? `${m[1]}/${m[2]}` : "";
  const r = gh.repos.get(slug);
  if (!m || !r) return json(gh, 404, { message: "Not Found" });
  return repoRoute(gh, slug, r, req, url, m[3] ?? "", body);
}

function listRepos(gh: FakeGithub, url: URL): Response {
  const perPage = Number(url.searchParams.get("per_page") ?? "30");
  const page = Number(url.searchParams.get("page") ?? "1");
  const all = [...gh.repos.entries()].map(([slug, r]) => ({ full_name: slug, private: r.private, description: r.description }));
  const slice = all.slice((page - 1) * perPage, page * perPage);
  const next = page * perPage < all.length ? { link: `<${gh.url}/user/repos?per_page=${perPage}&page=${page + 1}>; rel="next"` } : {};
  return json(gh, 200, slice, next);
}

function listIssues(gh: FakeGithub, slug: string, r: FakeRepo, req: Request, url: URL): Response {
  const since = url.searchParams.get("since");
  const creator = url.searchParams.get("creator");
  const state = url.searchParams.get("state") ?? "open";
  const perPage = Number(url.searchParams.get("per_page") ?? "30");
  const page = Number(url.searchParams.get("page") ?? "1");
  const all = [...r.issues.values()]
    .filter((i) => i.gone === null)
    .filter((i) => since === null || i.updatedAt >= since)
    .filter((i) => creator === null || i.creator === creator)
    .filter((i) => state === "all" || i.state === state)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.number - b.number);
  const slice = all.slice((page - 1) * perPage, page * perPage).map((i) => restIssue(slug, i));
  const etag = `"${createHash("sha1").update(JSON.stringify(slice)).digest("hex")}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag, ...rateHeaders(gh) } });
  const next = new URL(url);
  next.searchParams.set("page", String(page + 1));
  const link = page * perPage < all.length ? { link: `<${gh.url}${next.pathname}${next.search}>; rel="next"` } : {};
  return json(gh, 200, slice, { etag, ...link });
}

function repoRoute(gh: FakeGithub, slug: string, r: FakeRepo, req: Request, url: URL, rest: string, body: string): Response {
  if (rest === "/issues" && req.method === "GET") return listIssues(gh, slug, r, req, url);
  if (rest === "/issues" && req.method === "POST") {
    const input = JSON.parse(body) as { title?: string; body?: string | null; labels?: string[] };
    if (!input.title?.trim()) return json(gh, 422, { message: "Validation Failed" });
    const issue = gh.addIssue(slug, { title: input.title, body: input.body ?? null, labels: input.labels ?? [] });
    return json(gh, 201, restIssue(slug, issue));
  }
  const one = /^\/issues\/(\d+)$/.exec(rest);
  if (one) {
    const issue = r.issues.get(Number(one[1]));
    if (!issue) return json(gh, 404, { message: "Not Found" });
    if (issue.gone !== null) return json(gh, issue.gone, { message: issue.gone === 410 ? "Gone" : "Not Found" });
    if (req.method === "GET") return json(gh, 200, restIssue(slug, issue));
    if (req.method === "PATCH") {
      const patch = JSON.parse(body) as { title?: string; body?: string | null; state?: "open" | "closed" };
      if (patch.title !== undefined && !patch.title.trim()) return json(gh, 422, { message: "Validation Failed" });
      gh.editIssue(slug, issue.number, {
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.body !== undefined && { body: patch.body }),
        ...(patch.state !== undefined && { state: patch.state }),
      });
      return json(gh, 200, restIssue(slug, issue));
    }
  }
  const pull = /^\/pulls\/(\d+)$/.exec(rest);
  if (pull) {
    const p = r.pulls.get(Number(pull[1]));
    return p
      ? json(gh, 200, { number: Number(pull[1]), head: { sha: p.headSha, ref: p.headRef } })
      : json(gh, 404, { message: "Not Found" });
  }
  if (rest === "/actions/runs") {
    const sha = url.searchParams.get("head_sha");
    const runs = r.runs.filter((run) => sha === null || run.headSha === sha);
    return json(gh, 200, {
      total_count: runs.length,
      workflow_runs: runs.map((run) => ({
        id: run.id,
        name: run.name,
        head_sha: run.headSha,
        head_branch: run.headBranch,
        status: run.status,
        conclusion: run.conclusion,
        html_url: `https://github.com/${slug}/actions/runs/${run.id}`,
        run_started_at: run.createdAt,
        created_at: run.createdAt,
        updated_at: run.updatedAt,
      })),
    });
  }
  const jobs = /^\/actions\/runs\/(\d+)\/jobs$/.exec(rest);
  if (jobs) {
    const run = r.runs.find((x) => x.id === Number(jobs[1]));
    if (!run) return json(gh, 404, { message: "Not Found" });
    return json(gh, 200, {
      total_count: run.jobs.length,
      jobs: run.jobs.map((j) => ({
        id: j.id,
        run_id: run.id,
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        started_at: j.startedAt,
        completed_at: j.completedAt,
        steps: [],
      })),
    });
  }
  const logs = /^\/actions\/jobs\/(\d+)\/logs$/.exec(rest);
  if (logs) {
    return new Response(null, { status: 302, headers: { location: `https://${LOGS_HOST}/logs/${logs[1]}`, ...rateHeaders(gh) } });
  }
  return json(gh, 404, { message: "Not Found" });
}
```

- [x] **Step 3: Implémenter `fake-github-graphql.ts`**

```ts
import { GITHUB_GRAPHQL, type GithubOperation } from "@kibo/schema";
import type { FakeGithub, FakeIssue } from "./fake-github";

type GqlBody = { query?: string; variables?: Record<string, unknown> };
type Out = { status: number; body: unknown };

const OPERATIONS = Object.entries(GITHUB_GRAPHQL) as [GithubOperation, string][];
const PAGE = 100;

function issueNode(slug: string, i: FakeIssue) {
  return {
    id: i.nodeId,
    number: i.number,
    title: i.title,
    body: i.body ?? "",
    state: i.state === "open" ? "OPEN" : "CLOSED",
    updatedAt: i.updatedAt,
    url: `https://github.com/${slug}/issues/${i.number}`,
    repository: { nameWithOwner: slug },
    labels: { nodes: i.labels.map((name) => ({ name })) },
  };
}

const error = (message: string): Out => ({ status: 200, body: { errors: [{ message }] } });

export function handleGraphql(gh: FakeGithub, body: GqlBody): Out {
  const op = OPERATIONS.find(([, q]) => q === body.query)?.[0];
  if (!op) return { status: 400, body: { errors: [{ message: "unknown query" }] } };
  const v = body.variables ?? {};
  const p = gh.project;
  const issues = p ? gh.repos.get(p.repo)?.issues : undefined;
  switch (op) {
    case "projectItems": {
      if (!p || !issues || v.projectId !== p.nodeId) return error("Could not resolve to a node");
      const all = [...p.items.values()];
      const start = typeof v.after === "string" ? Number(v.after) : 0;
      const slice = all.slice(start, start + PAGE);
      return {
        status: 200,
        body: {
          data: {
            node: {
              items: {
                pageInfo: { hasNextPage: start + PAGE < all.length, endCursor: String(start + PAGE) },
                nodes: slice.map((item) => {
                  const issue = issues.get(item.issueNumber);
                  return {
                    id: item.itemId,
                    updatedAt: item.updatedAt,
                    fieldValues: { nodes: item.optionId ? [{ optionId: item.optionId, field: { id: p.fieldId } }] : [] },
                    content: issue && issue.gone === null ? issueNode(p.repo, issue) : {},
                  };
                }),
              },
            },
          },
        },
      };
    }
    case "addItem": {
      if (!p || !issues || v.projectId !== p.nodeId) return error("Could not resolve to a node");
      const issue = [...issues.values()].find((i) => i.nodeId === v.contentId);
      if (!issue) return error("Could not resolve content");
      const existing = [...p.items.values()].find((i) => i.issueNumber === issue.number);
      const item = existing ?? gh.addProjectItem(issue.number, null);
      return { status: 200, body: { data: { addProjectV2ItemById: { item: { id: item.itemId } } } } };
    }
    case "setStatus": {
      const item = p?.items.get(String(v.itemId));
      if (!p || !item || v.fieldId !== p.fieldId) return error("Could not resolve item");
      if (!p.options.some((o) => o.id === v.optionId)) return error("Invalid option");
      item.optionId = String(v.optionId);
      item.updatedAt = gh.tick();
      return { status: 200, body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.itemId } } } } };
    }
    case "issueItems": {
      const slug = `${String(v.owner)}/${String(v.name)}`;
      const issue = gh.repos.get(slug)?.issues.get(Number(v.number));
      if (!issue) return { status: 200, body: { data: { repository: { issue: null } } } };
      const items = p && p.repo === slug ? [...p.items.values()].filter((i) => i.issueNumber === issue.number) : [];
      return {
        status: 200,
        body: {
          data: {
            repository: {
              issue: {
                id: issue.nodeId,
                projectItems: {
                  nodes: items.map((i) => ({
                    id: i.itemId,
                    project: { id: p?.nodeId },
                    fieldValues: { nodes: i.optionId ? [{ optionId: i.optionId, field: { id: p?.fieldId } }] : [] },
                  })),
                },
              },
            },
          },
        },
      };
    }
    case "listProjects": {
      const slug = `${String(v.owner)}/${String(v.name)}`;
      const nodes =
        p && p.repo === slug
          ? [{ id: p.nodeId, number: p.number, title: p.title, owner: { login: p.owner }, field: { id: p.fieldId, options: p.options } }]
          : [];
      return { status: 200, body: { data: { repository: { projectsV2: { nodes } } } } };
    }
  }
}
```

(`Object.entries(…) as […]` : `Object.entries` perd le type des clés d'un objet littéral `as const`.)

- [x] **Step 4: Vérifier et commiter**

Run: `bun test packages/daemon/src/testing && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/testing/fake-github.ts packages/daemon/src/testing/fake-github-graphql.ts packages/daemon/src/testing/fake-github.test.ts
git commit -m "test(daemon): faux serveur GitHub"
```

---

### Task 7: Faux serveur MCP et dépendance `@modelcontextprotocol/sdk`

**Files:**
- Modify: `packages/daemon/package.json` (`"@modelcontextprotocol/sdk": "1.30.1"`), `bun.lock`
- Create: `packages/daemon/src/testing/fake-mcp.ts`, `packages/daemon/src/testing/fake-mcp-stdio.ts`, `packages/daemon/src/testing/fake-mcp.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `buildFakeMcpServer(): McpServer` (outils `echo { text }`, `list_items {}`, `get_metadata { nodeId }`, `get_screenshot { nodeId }`, `slow { ms }`, `fail {}`, `big { bytes }`, `env {}` ; ressource `fake://items`) ; `FAKE_MCP_STDIO` (chemin absolu du script stdio) ; `startFakeMcpHttp(opts?: { bearer?: string }): Promise<{ url: string; stop(): Promise<void> }>` ; `FAKE_ITEMS` (données de `list_items`) ; `FAKE_PNG_BASE64`.

- [x] **Step 1: Ajouter la dépendance**

`@modelcontextprotocol/sdk@1.30.1` est déjà résolu dans `bun.lock` (dépendance de `shadcn` 4.21.0, avec ses dépendances `express`, `hono`, `ajv`, `zod` → le `zod@3.25.76` du dépôt) : l'ajout direct au démon ne crée aucune résolution nouvelle, seulement la ligne du paquet `@kibo/daemon` dans `bun.lock`.

Run: `cd packages/daemon && bun add --exact @modelcontextprotocol/sdk@1.30.1`
Puis : `git diff bun.lock` — Expected: seule l'entrée `"@modelcontextprotocol/sdk": "1.30.1"` du paquet `packages/daemon` change ; et `bun pm untrusted` — Expected: même sortie qu'avant l'ajout (aujourd'hui seulement `@tailwindcss/oxide`, script `postinstall` bloqué ; aucune entrée venant de l'arbre du SDK MCP, qui ne déclare aucun script de cycle de vie). Justification du commit : client MCP officiel, transports stdio et Streamable HTTP ; décision du chef d'équipe.

Imports (vérifiés sur le paquet installé, `node_modules/.bun/@modelcontextprotocol+sdk@1.30.1/.../dist/esm`) : l'export générique `"./*"` du paquet sert les chemins en `.js` : `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer`, `registerTool(name, { description, inputSchema }, cb)`, `registerResource(name, uri, metadata, readCallback)`), `@modelcontextprotocol/sdk/server/stdio.js` (`StdioServerTransport`), `@modelcontextprotocol/sdk/server/streamableHttp.js` (`StreamableHTTPServerTransport({ sessionIdGenerator })`, `handleRequest(req, res, parsedBody?)` sur `IncomingMessage`/`ServerResponse` de `node:http`), `@modelcontextprotocol/sdk/client/index.js` (`Client`), `@modelcontextprotocol/sdk/client/stdio.js` (`StdioClientTransport({ command, args, env, cwd, stderr })`), `@modelcontextprotocol/sdk/client/streamableHttp.js` (`StreamableHTTPClientTransport(url, { requestInit })`). Les schémas d'entrée acceptent Zod 3 et Zod 4 (`ZodRawShapeCompat = Record<string, z3.ZodTypeAny | z4.$ZodType>`) et le SDK MCP résout le même `zod@3.25.76` que le démon : les formes `z.string()` du dépôt passent telles quelles.

- [x] **Step 2: Test (échoue)**

`packages/daemon/src/testing/fake-mcp.test.ts` :

```ts
import { afterAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "./fake-mcp";

const http = await startFakeMcpHttp({ bearer: "mcp-bearer-123456" });
afterAll(() => http.stop());

test("stdio: tools are listed and callable", async () => {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [FAKE_MCP_STDIO] }));
  const tools = (await client.listTools()).tools.map((t) => t.name);
  expect(tools).toEqual(expect.arrayContaining(["echo", "list_items", "get_metadata", "get_screenshot", "slow", "fail", "big", "env"]));
  const out = await client.callTool({ name: "echo", arguments: { text: "salut" } });
  expect(out.content).toEqual([{ type: "text", text: "salut" }]);
  await client.close();
});

test("http: bearer required, resources readable", async () => {
  const anonymous = new Client({ name: "test", version: "1.0.0" });
  await expect(anonymous.connect(new StreamableHTTPClientTransport(new URL(http.url)))).rejects.toThrow();
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(http.url), { requestInit: { headers: { authorization: "Bearer mcp-bearer-123456" } } }),
  );
  const res = await client.readResource({ uri: "fake://items" });
  expect(JSON.stringify(res.contents)).toContain("Premier");
  await client.close();
});
```

Run: `bun test packages/daemon/src/testing/fake-mcp.test.ts` — Expected: FAIL (module absent).

- [x] **Step 3: Implémenter**

`packages/daemon/src/testing/fake-mcp.ts` :

```ts
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

export const FAKE_MCP_STDIO = join(import.meta.dir, "fake-mcp-stdio.ts");
export const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const FAKE_ITEMS = {
  items: [
    { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
    { id: "a2", name: "Second", detail: "Élément deux", link: "javascript:alert(1)" },
  ],
};

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function buildFakeMcpServer(): McpServer {
  const s = new McpServer({ name: "fake-mcp", version: "1.0.0" });
  s.registerTool("echo", { description: "Echo", inputSchema: { text: z.string() } }, async ({ text: t }) => text(t));
  s.registerTool("list_items", { description: "Items" }, async () => text(JSON.stringify(FAKE_ITEMS)));
  s.registerTool("get_metadata", { description: "Node metadata", inputSchema: { nodeId: z.string() } }, async ({ nodeId }) =>
    text(`<frame id="${nodeId}" name="Kibo › Tickets / Arbre" x="0" y="0" width="1440" height="900" />`),
  );
  s.registerTool("get_screenshot", { description: "Node screenshot", inputSchema: { nodeId: z.string() } }, async () => ({
    content: [{ type: "image" as const, data: FAKE_PNG_BASE64, mimeType: "image/png" }],
  }));
  s.registerTool("slow", { description: "Slow", inputSchema: { ms: z.number() } }, async ({ ms }) => {
    await Bun.sleep(ms);
    return text("late");
  });
  s.registerTool("fail", { description: "Fails" }, async () => ({ isError: true, ...text("boom") }));
  s.registerTool("big", { description: "Big", inputSchema: { bytes: z.number() } }, async ({ bytes }) => text("x".repeat(bytes)));
  s.registerTool("env", { description: "Env" }, async () =>
    text(JSON.stringify({ keys: Object.keys(process.env).sort(), cwd: process.cwd(), hasToken: Boolean(process.env.FAKE_TOKEN) })),
  );
  s.registerResource("items", "fake://items", { mimeType: "application/json" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(FAKE_ITEMS) }],
  }));
  return s;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function startFakeMcpHttp(opts: { bearer?: string } = {}): Promise<{ url: string; stop(): Promise<void> }> {
  const http = createServer((req, res) => {
    if (opts.bearer && req.headers.authorization !== `Bearer ${opts.bearer}`) {
      res.writeHead(401).end();
      return;
    }
    const server = buildFakeMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    server
      .connect(transport)
      .then(() => readJson(req))
      .then((body) => transport.handleRequest(req, res, body))
      .catch((e: unknown) => {
        console.error("[fake-mcp] request failed", e);
        if (!res.headersSent) res.writeHead(500).end();
      });
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    stop: () => new Promise<void>((resolve, reject) => http.close((e) => (e ? reject(e) : resolve()))),
  };
}
```

(`http.address() as AddressInfo` : un serveur TCP à l'écoute renvoie toujours un `AddressInfo`, jamais une chaîne de socket Unix.)

`packages/daemon/src/testing/fake-mcp-stdio.ts` :

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildFakeMcpServer } from "./fake-mcp";

await buildFakeMcpServer().connect(new StdioServerTransport());
```

Le dossier `packages/daemon/src/testing/` est nouveau (les faux de la phase 3 vivent dans `packages/daemon/src/code/testing/`, dont `fake-gh.ts`) : il regroupe les faux de la phase 5 (GitHub, MCP).

- [x] **Step 4: Vérifier et commiter**

Run: `bun test packages/daemon/src/testing && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/package.json bun.lock packages/daemon/src/testing/fake-mcp.ts packages/daemon/src/testing/fake-mcp-stdio.ts packages/daemon/src/testing/fake-mcp.test.ts
git commit -m "build(daemon): SDK MCP et faux serveur MCP"
```

---

### Task 8: Réseau des intégrations

Un seul chemin sortant pour le démon et les composants : HTTPS, anti-SSRF, redirections contrôlées saut par saut, secret injecté **seulement** vers les hôtes autorisés, origines de test, observation des limites de débit GitHub. **Réutilise le proxy de la phase 4** (N27) : `isPublicAddress`, la résolution, la connexion épinglée à l'adresse vérifiée (SNI) et la lecture plafonnée de `packages/daemon/src/components/net-proxy*.ts` ; aucune seconde implémentation de l'anti-SSRF.

Tâche à risque (réseau et secrets) : relecture `kibo-lead` en plus de `kibo-reviewer`. Démarre après l'intégration de la tâche 30b de la phase 4 (elle modifie `components/service.ts`).

**Files:**
- Create: `packages/daemon/src/integrations/net.ts`, `packages/daemon/src/integrations/net.test.ts`, `packages/daemon/src/integrations/rate-limit.ts`, `packages/daemon/src/integrations/rate-limit.test.ts`, `packages/daemon/src/components/net-proxy-secrets.test.ts`
- Modify (phase 4) : `packages/daemon/src/components/net-proxy-address.ts` (exporte `Resolver`, `systemResolver`, `bareHost`, `checkedAddress`, `pinnedRequest`, déplacés depuis `net-proxy.ts`), `packages/daemon/src/components/net-proxy-body.ts` (exporte `readCapped`, ajoute `scrubSecret`, `readProxiedBody(res, maxBytes, secret)`), `packages/daemon/src/components/net-proxy.ts` (`NetProxyOptions.hooks`, `.secrets`, `.aliasFetch` ; réexporte ce qui a été déplacé), `packages/daemon/src/components/gate.ts` (`FetchGrant` : `net` et `secrets` accordés), `packages/daemon/src/components/gate-handlers.ts` (`integrations`), `packages/daemon/src/components/service.ts` (`ComponentsDeps.integrations`), `packages/daemon/src/components/gate.test.ts` (gestionnaire `fetch` du harnais), `packages/daemon/src/daemon.ts` (passe les hooks des intégrations au service des composants)
- Modify: `packages/schema/src/permissions.ts` (`GrantedPermissions.secrets`, `grantedOf`, `permissionList` → `secret:<name>@<host>` (N41), `NO_PERMISSIONS`) et les littéraux `GrantedPermissions` des tests existants : `packages/core/src/registry.test.ts`, `packages/daemon/src/components/gate.test.ts`, `packages/ui/src/lib/permission-lines.test.ts` (les autres tests passent par `NO_PERMISSIONS` ou un étalement) (ajouter `secrets: []`)
- Modify: `packages/daemon/src/integrations/bootstrap.ts`

**Interfaces:**
- Consumes: `IntegrationFetch`, `IntegrationFetchInit`, `IntegrationResponse`, `InternalRule`, `SecretResolver`, `ComponentIntegrationHooks`, `IntegrationKit`, `IntegrationRpc.hooks` (Task 2) ; `ComponentManifest.secrets` (Task 1) ; `FakeGithub`, `ECHO_AUTH`, `LOGS_HOST` (Task 6, tests) ; phase 4 : `proxyFetch`, `NetProxyOptions`, `isPublicAddress`, `Transport`, `directTransport`, `readProxiedBody`, `createGate`, `createGateHandlers`, `ActiveVersion`.
- Produces:
  - `components/net-proxy-address.ts` : `type Resolver`, `systemResolver`, `bareHost(u: URL): string`, `checkedAddress(u, resolve, allow, signal): Promise<string>`, `pinnedRequest(u, address): { url; host; tls }` (réexportés par `net-proxy.ts`)
  - `components/net-proxy-body.ts` : `readCapped(res, maxBytes): Promise<{ bytes: Uint8Array; truncated: boolean }>`, `scrubSecret(bytes: Uint8Array, secret: string): Uint8Array` (toute occurrence du secret injecté devient `***`, octet à octet)
  - `NetProxyOptions` gagne `hooks?: ProxyHooks` (`Pick<ComponentIntegrationHooks, "aliases" | "observe" | "secret">`), `secrets?: ComponentManifest["secrets"]`, `aliasFetch?: typeof fetch`
  - `GrantedPermissions.secrets: ComponentManifest["secrets"]` (défaut `[]` pour les versions déjà approuvées) ; « nouvelles permissions » : une entrée `secret:<name>@<host>` par hôte (N41)
  - `FetchGrant = { net: readonly string[]; secrets: ComponentManifest["secrets"] }` ; `GateHandlers.fetch(grant: FetchGrant | null, url, init)` (`null` = intégré, comme `rules === null` en phase 4)
  - `ComponentsDeps.integrations?: () => ComponentIntegrationHooks | null` et `GateHandlersDeps.integrations?` (lus à chaque appel)
  - `integrations/net.ts` : `parseTestOrigins(values: string[]): Map<string, URL>` (clé : hôte logique ; valeur : origine `http://127.0.0.1|localhost:<port>/`), `hostMatches(rule: InternalRule, host: string): boolean`, `transportUrl(url: URL, aliases): { target: URL; aliased: boolean }`, `secretFor(url: URL, secrets: ComponentManifest["secrets"], covered: (url: URL) => boolean, resolve: SecretResolver): Promise<string | null>`, `createIntegrationFetch(deps: { aliases: Map<string, URL>; resolve?: Resolver; transport?: Transport; aliasFetch?: typeof fetch; observe?: (host: string, headers: Headers) => void }): IntegrationFetch`
  - `GITHUB_API = "api.github.com"`, `GITHUB_RULES: InternalRule[]` (API avec auth), `GITHUB_LOG_RULES: InternalRule[]` (API avec auth + suffixe `actions.githubusercontent.com` sans auth)
  - `type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null }` ; `createRateLimitGate(now): RateLimitGate` ; `GITHUB_RATE_FLOOR = 100`
  - `IntegrationKit.net: { fetch: IntegrationFetch; gate: RateLimitGate; aliases: Map<string, URL> }`

- [x] **Step 1: Tests (échouent)**

`packages/daemon/src/integrations/rate-limit.test.ts` :

```ts
import { expect, test } from "bun:test";
import { createRateLimitGate } from "./rate-limit";

test("pauses under the floor until reset, and on retry-after", () => {
  let now = 1_000_000;
  const gate = createRateLimitGate(() => now);
  gate.observe(new Headers({ "x-ratelimit-remaining": "500", "x-ratelimit-reset": "2000" }));
  expect(gate.blockedUntil()).toBeNull();
  gate.observe(new Headers({ "x-ratelimit-remaining": "99", "x-ratelimit-reset": "2000" }));
  expect(gate.blockedUntil()).toBe(2_000_000);
  now = 2_000_001;
  expect(gate.blockedUntil()).toBeNull();
  gate.observe(new Headers({ "retry-after": "60" }));
  expect(gate.blockedUntil()).toBe(2_060_001);
});

test("a later healthy response never lifts or shortens a pause (N40)", () => {
  const now = 1_000_000;
  const gate = createRateLimitGate(() => now);
  gate.observe(new Headers({ "retry-after": "60", "x-ratelimit-remaining": "4000" }));
  gate.observe(new Headers({ "x-ratelimit-remaining": "4999", "x-ratelimit-reset": "5000" }));
  expect(gate.blockedUntil()).toBe(1_060_000);
  gate.observe(new Headers({ "retry-after": "10" }));
  expect(gate.blockedUntil()).toBe(1_060_000);
});

test("other rate-limit resources are ignored (N40)", () => {
  const gate = createRateLimitGate(() => 1_000_000);
  gate.observe(
    new Headers({ "x-ratelimit-resource": "search", "x-ratelimit-remaining": "9", "x-ratelimit-reset": "2000" }),
  );
  expect(gate.blockedUntil()).toBeNull();
});
```

`packages/daemon/src/integrations/net.test.ts` (les adresses privées, de boucle locale, link-local et multicast sont déjà couvertes par `components/net-proxy.test.ts` sur `isPublicAddress` ; on ne teste ici que le chemin des intégrations) :

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { createIntegrationFetch, GITHUB_LOG_RULES, GITHUB_RULES, parseTestOrigins, secretFor } from "./net";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
});
afterEach(() => gh.stop());

const aliases = () => parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]);

describe("addresses and test origins", () => {
  test("a public name resolving to a private address is refused, a public one reaches the pinned transport", async () => {
    const sent: string[] = [];
    const transport = async (url: string) => {
      sent.push(url);
      return new Response("{}", { status: 200 });
    };
    const privateNet = createIntegrationFetch({ aliases: new Map(), resolve: async () => ["10.1.2.3"], transport });
    await expect(privateNet("https://api.github.com/user", {}, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
    const publicNet = createIntegrationFetch({ aliases: new Map(), resolve: async () => ["140.82.112.5"], transport });
    expect((await publicNet("https://api.github.com/user", {}, GITHUB_RULES)).status).toBe(200);
    expect(sent).toEqual(["https://140.82.112.5/user"]);
  });
  test("test origins must be loopback http origins", () => {
    expect(parseTestOrigins(["api.github.com=http://127.0.0.1:4391"]).get("api.github.com")?.port).toBe("4391");
    expect(() => parseTestOrigins(["api.github.com=http://10.0.0.1:80"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["api.github.com=http://127.0.0.1:1/x"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["nope"])).toThrow("INVALID_INPUT");
  });
});

describe("integration fetch", () => {
  test("adds the bearer only to authorised hosts and strips it on redirect", async () => {
    gh.addRun("adam/kibo", {
      id: 1,
      headSha: "s",
      headBranch: "b",
      name: "ci",
      status: "completed",
      conclusion: "failure",
      jobs: [{ id: 11, name: "build", status: "completed", conclusion: "failure", startedAt: null, completedAt: null, log: "log text" }],
    });
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f("https://api.github.com/repos/adam/kibo/actions/jobs/11/logs", { bearer: gh.token }, GITHUB_LOG_RULES);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.body)).toBe("log text");
    const user = await f("https://api.github.com/user", { bearer: gh.token, headers: { authorization: "Bearer forged", cookie: "x=1" } }, GITHUB_RULES);
    expect(user.status).toBe(200);
    expect(gh.requests.at(-1)?.auth).toBe(`Bearer ${gh.token}`);
  });

  test("a secret echoed by the remote is scrubbed from the body", async () => {
    gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES);
    const text = new TextDecoder().decode(res.body);
    expect(text).toContain("Bearer ***");
    expect(text).not.toContain(gh.token);
  });

  test("refuses http, unknown hosts and redirects outside the rules", async () => {
    const f = createIntegrationFetch({ aliases: aliases(), resolve: async () => ["140.82.112.5"] });
    await expect(f("http://api.github.com/user", {}, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
    await expect(f("https://evil.example.com/", {}, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
    gh.failNext("GET", /^\/user$/, 302, "", { location: "https://evil.example.com/steal" });
    await expect(f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
  });

  test("truncates large bodies and reports github rate headers", async () => {
    const seen: string[] = [];
    const f = createIntegrationFetch({ aliases: aliases(), observe: (host) => seen.push(host) });
    gh.failNext("GET", /^\/user$/, 200, "x".repeat(10_000));
    const res = await f("https://api.github.com/user", { bearer: gh.token, maxBytes: 1000 }, GITHUB_RULES);
    expect(res.body.length).toBe(1000);
    expect(res.truncated).toBe(true);
    expect(seen).toEqual(["api.github.com"]);
  });
});

test("a secret is resolved only for listed hosts covered by net", async () => {
  const secrets = [{ name: "github" as const, hosts: ["api.github.com"] }];
  const resolve = async () => "ghp_value_12345678";
  const covered = (u: URL) => u.hostname === "api.github.com";
  expect(await secretFor(new URL("https://api.github.com/user"), secrets, covered, resolve)).toBe("ghp_value_12345678");
  expect(await secretFor(new URL("https://uploads.github.com/x"), secrets, () => true, resolve)).toBeNull();
  expect(await secretFor(new URL("https://api.github.com/user"), secrets, () => false, resolve)).toBeNull();
});
```

`packages/daemon/src/components/net-proxy-secrets.test.ts` (proxy des composants de la phase 4 ; nouveau fichier car `net-proxy.test.ts` approche des 300 lignes) :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { parseTestOrigins } from "../integrations/net";
import { ECHO_AUTH, type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { proxyFetch } from "./net-proxy";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
});
afterEach(() => gh.stop());

const GET = { method: "GET" as const, headers: { authorization: "Bearer forged" } };
const SECRETS = [{ name: "github" as const, hosts: ["api.github.com"] }];
const hooks = (observed: string[] = []) => ({
  aliases: parseTestOrigins([`api.github.com=${gh.url}`]),
  observe: (host: string) => observed.push(host),
  secret: async () => gh.token,
});

test("a granted secret is injected for its host, never exposed to the component", async () => {
  const observed: string[] = [];
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, { hooks: hooks(observed), secrets: SECRETS });
  expect(out.status).toBe(200);
  expect(gh.requests.at(-1)?.auth).toBe(`Bearer ${gh.token}`);
  expect(JSON.stringify(out)).not.toContain(gh.token);
  expect(observed).toEqual(["api.github.com"]);
});

test("without the secrets grant, no credential is sent", async () => {
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, { hooks: hooks(), secrets: [] });
  expect(out.status).toBe(401);
  expect(gh.requests.at(-1)?.auth).toBeNull();
});

test("a secret echoed in the response body is scrubbed", async () => {
  gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, { hooks: hooks(), secrets: SECRETS });
  expect(out.body).toContain("Bearer ***");
  expect(out.body).not.toContain(gh.token);
});

test("an alias exists only through the test hooks", async () => {
  await expect(
    proxyFetch(["api.github.com"], "https://api.github.com/user", GET, { resolve: async () => ["127.0.0.1"] }),
  ).rejects.toThrow("PERMISSION_DENIED");
});
```

Dans `packages/daemon/src/components/gate.test.ts`, le gestionnaire `fetch` du harnais `gate()` reçoit désormais la permission accordée :

```ts
        fetch: async (grant) => {
          handled.push(`fetch:${grant === null ? "any" : grant.net.join(",")}`);
          return { status: 200, headers: {}, body: "" };
        },
```

et la constante `granted` gagne `secrets: []` (les attentes `fetch:any` / `fetch:api.github.com/graphql` restent inchangées). Ajouter :

```ts
test("the granted secrets reach the fetch handler of a sandboxed component only", async () => {
  const seen: unknown[] = [];
  const secrets = [{ name: "github" as const, hosts: ["api.github.com"] }];
  const eventsDb = new Database(":memory:");
  ensureEventsTable(eventsDb);
  const g = createGate({
    instance: (_p, id) => {
      const i = instances[id];
      if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
      return i;
    },
    active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, secrets } }),
    handlers: {
      list: async () => [],
      run: async () => null,
      data: async () => null,
      fetch: async (grant) => {
        seen.push(grant);
        return { status: 200, headers: {}, body: "" };
      },
      action: async () => null,
      notes: async () => null,
    },
    quotas: createQuotas(),
    events: createEventLog(eventsDb, () => 42),
  });
  const call: ComponentCall = { kind: "fetch", url: "https://api.github.com/graphql", init: { method: "GET", headers: {} } };
  await g.call("p", "thirdparty", call);
  await g.call("p", "builtin", call);
  expect(seen).toEqual([{ net: ["api.github.com/graphql"], secrets }, null]);
});
```

Run: `bun test packages/daemon/src/integrations/net.test.ts packages/daemon/src/integrations/rate-limit.test.ts packages/daemon/src/components/net-proxy-secrets.test.ts packages/daemon/src/components/gate.test.ts` — Expected: FAIL.

- [x] **Step 2: Implémenter `rate-limit.ts`**

```ts
export type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null };
export const GITHUB_RATE_FLOOR = 100;

const WATCHED_RESOURCES = new Set(["core", "graphql"]);

function pauseEnd(headers: Headers, now: number): number | null {
  const resource = headers.get("x-ratelimit-resource");
  if (resource !== null && !WATCHED_RESOURCES.has(resource)) return null;
  const retryAfter = Number(headers.get("retry-after"));
  if (headers.has("retry-after") && Number.isFinite(retryAfter)) return now + retryAfter * 1000;
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-remaining") || !Number.isFinite(remaining)) return null;
  return remaining < GITHUB_RATE_FLOOR && Number.isFinite(reset) ? reset * 1000 : null;
}

export function createRateLimitGate(now: () => number): RateLimitGate {
  let until: number | null = null;
  return {
    observe(headers) {
      const end = pauseEnd(headers, now());
      if (end !== null) until = Math.max(until ?? end, end);
    },
    blockedUntil: () => (until !== null && until > now() ? until : null),
  };
}
```

- [x] **Step 3: Exposer les briques du proxy de la phase 4**

Sans changer leur comportement (les tests de `net-proxy.test.ts` et `net-proxy-direct.test.ts` restent verts tels quels) :

1. `packages/daemon/src/components/net-proxy-address.ts` : y déplacer depuis `net-proxy.ts` `type Resolver`, `systemResolver`, `bareHost`, `untilAborted`, `checkedAddress` (renommé export, même corps) et `pinnedRequest`, tous exportés. `net-proxy.ts` les importe et garde `export { isPublicAddress, type Resolver, systemResolver } from "./net-proxy-address";` pour ses importeurs actuels (`gate-handlers.ts`, `service.ts`, `net-proxy-direct-child.ts`, tests).
2. `packages/daemon/src/components/net-proxy-body.ts` : exporter `readCapped` ; ajouter

```ts
const MASK = new TextEncoder().encode("***");

export function scrubSecret(bytes: Uint8Array, secret: string): Uint8Array {
  const needle = Buffer.from(secret);
  const source = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let from = 0;
  for (let at = source.indexOf(needle, from); at >= 0; at = source.indexOf(needle, from)) {
    parts.push(source.subarray(from, at), MASK);
    from = at + needle.length;
  }
  if (from === 0) return bytes;
  parts.push(source.subarray(from));
  return Buffer.concat(parts);
}
```

et `readProxiedBody(res, maxBytes, secret: string | null = null)` applique `scrubSecret` aux octets lus avant décodage (texte ou base64) quand `secret` n'est pas `null`. Le caviardage se fait sur les octets : un corps binaire n'est pas corrompu, et la troncature (`x-kibo-truncated`) reste celle de la lecture.

- [x] **Step 4: Implémenter `integrations/net.ts`**

```ts
import { type ComponentManifest, KiboError } from "@kibo/schema";
import {
  bareHost,
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
  systemResolver,
} from "../components/net-proxy-address";
import { readCapped, scrubSecret } from "../components/net-proxy-body";
import { directTransport, type Transport } from "../components/net-proxy-transport";
import type { IntegrationFetch, InternalRule, SecretResolver } from "./types";

export const GITHUB_API = "api.github.com";
export const GITHUB_RULES: InternalRule[] = [{ host: GITHUB_API, suffix: false, auth: true }];
export const GITHUB_LOG_RULES: InternalRule[] = [
  ...GITHUB_RULES,
  { host: "actions.githubusercontent.com", suffix: true, auth: false },
];

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const STRIPPED = new Set(["cookie", "authorization", "host", "proxy-authorization", "proxy-connection"]);
const MAX_HOPS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function parseTestOrigins(values: string[]): Map<string, URL> {
  const out = new Map<string, URL>();
  for (const v of values) {
    const [host, origin, extra] = v.split("=");
    if (!host || !origin || extra !== undefined || !HOST.test(host) || !URL.canParse(origin)) {
      throw new KiboError("INVALID_INPUT", `bad test origin ${v}`);
    }
    const u = new URL(origin);
    if (u.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(u.hostname) || u.pathname !== "/" || u.search) {
      throw new KiboError("INVALID_INPUT", `test origin must be a loopback http origin: ${v}`);
    }
    out.set(host, u);
  }
  return out;
}

export function hostMatches(rule: InternalRule, host: string): boolean {
  return rule.suffix ? host.endsWith(`.${rule.host}`) : host === rule.host;
}

export function transportUrl(url: URL, aliases: Map<string, URL>): { target: URL; aliased: boolean } {
  const alias = aliases.get(url.hostname);
  return alias ? { target: new URL(`${url.pathname}${url.search}`, alias), aliased: true } : { target: url, aliased: false };
}

export async function secretFor(
  url: URL,
  secrets: ComponentManifest["secrets"],
  covered: (url: URL) => boolean,
  resolve: SecretResolver,
): Promise<string | null> {
  const entry = secrets.find((s) => s.hosts.includes(url.hostname));
  if (!entry || url.protocol !== "https:" || !covered(url)) return null;
  return resolve(entry.name);
}

function outgoing(init: Record<string, string> | undefined, bearer: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(init ?? {})) {
    if (!STRIPPED.has(name.toLowerCase())) headers[name.toLowerCase()] = value;
  }
  headers["user-agent"] = "kibo";
  if (bearer) {
    headers.authorization = `Bearer ${bearer}`;
    headers["accept-encoding"] = "identity";
  }
  return headers;
}

export function createIntegrationFetch(deps: {
  aliases: Map<string, URL>;
  resolve?: Resolver;
  transport?: Transport;
  aliasFetch?: typeof fetch;
  observe?: (host: string, headers: Headers) => void;
}): IntegrationFetch {
  const resolve = deps.resolve ?? systemResolver;
  const transport = deps.transport ?? directTransport;
  const aliasFetch = deps.aliasFetch ?? fetch;
  return async (url, init, rules) => {
    let current = new URL(url);
    const deadline = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (current.protocol !== "https:") throw new KiboError("PERMISSION_DENIED", `https only: ${current.origin}`);
      const rule = rules.find((r) => hostMatches(r, current.hostname));
      if (!rule) throw new KiboError("PERMISSION_DENIED", `host not allowed: ${current.hostname}`);
      const bearer = rule.auth ? (init.bearer ?? null) : null;
      const headers = outgoing(init.headers, bearer);
      const method = hop === 0 ? (init.method ?? "GET") : "GET";
      const body = hop === 0 ? init.body : undefined;
      const { target, aliased } = transportUrl(current, deps.aliases);
      let res: Response;
      if (aliased) {
        res = await aliasFetch(target, { method, headers, body, redirect: "manual", signal });
      } else {
        const address = await checkedAddress(current, resolve, isPublicAddress, signal);
        const pinned = pinnedRequest(current, address);
        res = await transport(pinned.url, { method, headers: { ...headers, host: pinned.host }, body, redirect: "manual", signal, tls: pinned.tls });
      }
      if (bearer) deps.observe?.(bareHost(current), res.headers);
      if (REDIRECTS.has(res.status)) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location || !URL.canParse(location, current.href)) throw new KiboError("REMOTE_REJECTED", "redirect without a valid location");
        current = new URL(location, current);
        continue;
      }
      const { bytes, truncated } = await readCapped(res, init.maxBytes ?? DEFAULT_MAX_BYTES);
      return { status: res.status, headers: res.headers, body: bearer ? scrubSecret(bytes, bearer) : bytes, truncated, url: current.toString() };
    }
    throw new KiboError("REMOTE_REJECTED", "too many redirects");
  };
}
```

Seule une origine de test (`aliased`, possible uniquement avec `--test-origins`, N9) part par `fetch` en HTTP sur la boucle locale sans épinglage ; tout le reste passe par la connexion épinglée de la phase 4 (même garantie contre le TOCTOU DNS que le proxy des composants).

- [x] **Step 5: Proxy des composants (phase 4)**

`packages/schema/src/permissions.ts` : `GrantedPermissions` gagne `secrets: z.array(z.object({ name: SecretNameSchema, hosts: z.array(z.string()).min(1) })).default([])` (même forme que `ComponentManifest.secrets`, Task 1 ; une version approuvée avant la phase 5 se relit avec `[]`) ; `grantedOf` recopie `m.secrets` ; `permissionList` ajoute `...g.secrets.flatMap((s) => s.hosts.map((h) => \`secret:${s.name}@${h}\`))` (N41 : `addedPermissions` signale un secret nouveau **ou un hôte nouveau d'un secret** à l'écran 30 et à la publication ; test : une version qui ajoute `uploads.github.com` aux hôtes de `github`, déjà couvert par `net`, rend `["secret:github@uploads.github.com"]`) ; `NO_PERMISSIONS.secrets = []`.

`packages/daemon/src/components/net-proxy.ts`, dans `proxyFetch`, sans changer ses contrôles existants :
1. `NetProxyOptions` gagne `hooks?: ProxyHooks` (`type ProxyHooks = Pick<ComponentIntegrationHooks, "aliases" | "observe" | "secret">`, importé de `../integrations/types`), `secrets?: ComponentManifest["secrets"]` et `aliasFetch?: typeof fetch` ;
2. à chaque saut, après `checkedUrl` : `const { target, aliased } = transportUrl(current, opts.hooks?.aliases ?? new Map())` ; les contrôles `net` (`rules`), `https:` et identifiants portent sur l'URL logique ; si `aliased`, la requête part par `aliasFetch` vers `target` sans `checkedAddress` ni épinglage, sinon le chemin de la phase 4 est inchangé ;
3. après `outgoingHeaders` (qui retire déjà `authorization`) : `const bearer = opts.hooks ? await secretFor(current, opts.secrets ?? [], (u) => rules === null || rules.some((r) => ruleCovers(r, u.href)), opts.hooks.secret) : null` puis `authorization: Bearer <bearer>` si non nul ; recalculé à chaque saut (une redirection vers un hôte non listé ne porte jamais le secret, et les en-têtes du composant sont déjà vidés hors origine) ;
4. `if (bearer !== null) opts.hooks?.observe(bareHost(current), res.headers)` après chaque réponse (N40 : une réponse anonyme ne compte jamais) ; quand `bearer` n'est pas nul, l'en-tête sortant `accept-encoding` est forcé à `identity` (le transport ne décompresse pas : un corps compressé échapperait au caviardage) ;
5. `readProxiedBody(res, maxBytes, bearer)` : un service qui renvoie l'en-tête `Authorization` dans son corps (Review Focus 4) ne livre jamais la valeur au composant (N18).

`packages/daemon/src/components/gate.ts` : `netRules` devient `fetchGrant(deps, ref, call): FetchGrant | null` (`null` pour un intégré, sinon `{ net: active.granted.net, secrets: active.granted.secrets }`, après le même contrôle `missingPermission`) ; `GateHandlers.fetch(grant, url, init)` ; `dispatch` transmet `grant`.

`packages/daemon/src/components/gate-handlers.ts` : `GateHandlersDeps.integrations?: () => ComponentIntegrationHooks | null` ;

```ts
    fetch: (grant, url, init) => {
      const hooks = deps.integrations?.() ?? null;
      return proxyFetch(grant?.net ?? null, url, init, {
        ...deps.net,
        ...(hooks && { hooks }),
        ...(grant && { secrets: grant.secrets }),
      });
    },
```

Un intégré (`grant === null`) ne reçoit jamais de secret : l'adaptateur GitHub Issues passe par le chemin des liaisons (Task 19), pas par la porte.

`packages/daemon/src/components/service.ts` : `ComponentsDeps.integrations?: () => ComponentIntegrationHooks | null`, transmis à `createGateHandlers`. `packages/daemon/src/daemon.ts` : `createComponentsService({ …, integrations: () => integrations?.hooks ?? null })`, où `integrations` est l'`IntegrationRpc` créé par `startDaemon` (Task 2, N26) ; la fonction est lue à chaque appel, l'ordre de création n'importe donc pas.

- [x] **Step 6: Amorçage**

`packages/daemon/src/integrations/bootstrap.ts` : ajouter `net` à `IntegrationKit` et, avant la création du `kit` :

```ts
  const aliases = parseTestOrigins(flags.testOrigins);
  const gate = createRateLimitGate(host.now);
  const observe = (h: string, headers: Headers) => {
    if (h === GITHUB_API) gate.observe(headers);
  };
  const net = { fetch: createIntegrationFetch({ aliases, observe }), gate, aliases };
```

puis `net` dans le `kit`, et `hooks: { aliases, observe, secret: (name) => secrets.get(name), mcp: null, ciRuns: null }`.

- [x] **Step 7: Vérifier et commiter**

Run: `bun test packages && bun run check && bun run typecheck` — Expected: PASS (dont `net-proxy.test.ts`, `net-proxy-direct.test.ts`, `gate.test.ts` et `exit.test.ts` de la phase 4, inchangés hormis le gestionnaire `fetch` du harnais).

```bash
git add packages/daemon/src/components/net-proxy-address.ts packages/daemon/src/components/net-proxy-body.ts packages/daemon/src/components/net-proxy.ts
git commit -m "refactor(daemon): briques du proxy exportées"
git add packages/daemon/src/integrations/net.ts packages/daemon/src/integrations/net.test.ts packages/daemon/src/integrations/rate-limit.ts packages/daemon/src/integrations/rate-limit.test.ts packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): réseau sortant des intégrations"
git add packages/daemon/src/components/net-proxy.ts packages/daemon/src/components/net-proxy-secrets.test.ts packages/schema/src/permissions.ts packages/core/src/registry.test.ts packages/daemon/src/components/gate.ts packages/daemon/src/components/gate.test.ts packages/daemon/src/components/gate-handlers.ts packages/daemon/src/components/service.ts packages/daemon/src/daemon.ts packages/ui/src/lib/permission-lines.test.ts
git commit -m "feat(daemon): secrets injectés par le proxy"
```

Ordre des étapes pour que chaque commit passe `bun test` : étape 3 (déplacements, premier commit), étapes 2, 4 et 6 (deuxième), étape 5 (troisième).

---

### Task 9: SDK, `componentCall` et permissions

Appels MCP et entité `ci_run` pour les composants, contrôlés par la **porte de la phase 4** (`createGate`, `missingPermission`, `permissionOfCall`, quotas, journal `component_events`) : aucune seconde porte. Les intégrés restent hors contrôle de permissions côté démon (phase 4) ; le SDK les contrôle contre leur manifeste, placeholder `{config.server}` compris.

Démarre après la Task 8 (mêmes fichiers `permissions.ts`, `gate.ts`, `gate-handlers.ts`, `components/service.ts`) et la Task 4 (`importExternalTicket` pour le SDK simulé), donc après 30b.

**Files:**
- Modify: `packages/schema/src/manifest.ts` (`BuiltinEntityType` gagne `"ci_run"`), `packages/schema/src/call.ts` (`ComponentCall`), `packages/schema/src/permissions.ts` (`GrantedPermissions.mcp`, `grantedOf`, `permissionList`, `NO_PERMISSIONS`, `permissionOfCall`, `covers`, `diffPermissions`), `packages/schema/src/schema.test.ts` (ou `component.test.ts` : cas `covers` MCP)
- Modify: littéraux `GrantedPermissions` des tests existants (`mcp: []`) : `packages/core/src/registry.test.ts`, `packages/daemon/src/components/gate.test.ts`, `packages/ui/src/lib/permission-lines.test.ts` (les autres tests passent par `NO_PERMISSIONS` ou un étalement)
- Modify: `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/mock.ts`, `packages/sdk/src/conformance.tsx`, `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/source.ts`, `packages/sdk/src/mcp.test.ts`, `packages/sdk/src/source.test.ts`
- Modify: `packages/daemon/src/components/gate.ts`, `packages/daemon/src/components/gate-handlers.ts`, `packages/daemon/src/components/gate.test.ts`
- Modify: `packages/devkit/src/infer-permissions.ts`, `packages/devkit/src/infer-permissions.test.ts`, `packages/devkit/src/validate.ts`, `packages/devkit/src/validate.test.ts`, `packages/devkit/src/fr.ts`
- Modify: `packages/ui/src/lib/permission-lines.ts`, `packages/ui/src/lib/permission-lines.test.ts` (écran 30, rendu par `packages/ui/src/dialogs/TrustDialog.tsx`, inchangé)

**Interfaces:**
- Consumes: `mcpCovered`, `CONFIG_SERVER_RULE`, `secretHostsCovered`, `McpServerId`, `McpCallResult`, `McpImportItem`, `CiRun`, `InstanceSource` (Task 1) ; `ComponentIntegrationHooks`, `McpComponentGate` (Task 2) ; `GateHandlersDeps.integrations`, `FetchGrant`, `GrantedPermissions.secrets` (Task 8) ; commande `importExternalTicket` (Task 4) ; phase 4 : `createGate`, `GateHandlers`, `missingPermission`, `createGateHandlers`, `ProjectBackend.call`, `createSdk`, `createMockSdk`, `runConformance`, `inferFromSources`, `validateComponent`, `permissionLines`, `fr.trust`.
- Produces:
  - `ComponentCall` gagne `{ kind: "mcp.call"; server; tool; args: Record<string, unknown> }`, `{ kind: "mcp.read"; server; uri }`, `{ kind: "mcp.import"; server; item: McpImportItem }` ; `list` accepte `entity: "ci_run"`
  - `permissionOfCall` : `mcp.call` ⇒ `mcp:<server>/<tool>`, `mcp.read` et `mcp.import` ⇒ `mcp:<server>` ; `covers(declared, used, config = null)` et `diffPermissions(declared, used, config = null)` résolvent une permission `mcp:` par `mcpCovered` (placeholder `{config.server}` compris si `config` est fourni)
  - `GrantedPermissions.mcp: string[]` (défaut `[]`) ; `permissionList` ⇒ `mcp:<règle>` (« nouvelles permissions » à l'écran 30 et à la publication, par `addedPermissions`)
  - `GateHandlers.mcp(projectId, instanceId, call: McpCall): Promise<unknown>` ; `GateHandlers.list` accepte `ci_run` ; `type McpCall = Extract<ComponentCall, { kind: \`mcp.${string}\` }>`
  - `KiboSdk.mcp: { call(server, tool, args?): Promise<McpCallResult>; read(server, uri): Promise<McpCallResult>; importItem(server, item: McpImportItem): Promise<Ticket> }` ; `EntityMap.ci_run = CiRun`
  - `MockSdkOptions` gagne `mcp?: Record<string, McpCallResult>` (clés `"server/tool"` ou `"server@uri"`) et `ciRuns?: CiRun[]` ; `MockSdk.used` (liste de permissions de la phase 4) reçoit `mcp:<server>/<tool>` ou `mcp:<server>` ; les refus vont dans `violations` sous `mcp <server>/<tool>` ou `mcp <server>`
  - `readSource(config: Record<string, unknown>): InstanceSource | null` ; `matchesSource(ticket: TicketView, source: InstanceSource | null): boolean`
  - `permissionLines(g)` (écran 30) ajoute une ligne par secret (`KeyRound`) et par règle MCP (`Plug`)

- [x] **Step 1: Tests SDK (échouent)**

`packages/sdk/src/mcp.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { ComponentManifestInput } from "@kibo/schema";
import { createMockSdk } from "./mock";

const manifest: ComponentManifestInput = {
  id: "probe",
  version: "1.0.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket", "ci_run"],
  writes: ["ticket"],
  mcp: ["ctx"],
};
const ok = { content: [{ type: "text" as const, text: "hi" }], isError: false, truncated: false };

describe("sdk.mcp", () => {
  test("calls declared servers and records the usage", async () => {
    const m = createMockSdk(manifest, { mcp: { "ctx/echo": ok } });
    expect(await m.sdk.mcp.call("ctx", "echo", { text: "hi" })).toEqual(ok);
    expect(m.used).toContain("mcp:ctx/echo");
  });

  test("undeclared servers are denied and recorded", async () => {
    const m = createMockSdk(manifest);
    await expect(m.sdk.mcp.call("fs", "read")).rejects.toThrow("PERMISSION_DENIED");
    expect(m.violations).toContain("mcp fs/read");
  });

  test("a builtin rule resolved from the instance config", async () => {
    const m = createMockSdk({ ...manifest, mcp: ["{config.server}"] }, { config: { server: "fs" }, mcp: { "fs@fake://items": ok } });
    expect(await m.sdk.mcp.read("fs", "fake://items")).toEqual(ok);
    await expect(m.sdk.mcp.read("ctx", "fake://items")).rejects.toThrow("PERMISSION_DENIED");
  });

  test("importItem creates a ticket with its mcp ref, once", async () => {
    const m = createMockSdk(manifest);
    const a = await m.sdk.mcp.importItem("ctx", { itemId: "a1", title: "Premier", url: "https://example.com/a1" });
    const b = await m.sdk.mcp.importItem("ctx", { itemId: "a1", title: "Premier", url: null });
    expect(b.id).toBe(a.id);
    expect(a.externalRefs).toEqual([{ kind: "mcp_item", server: "ctx", itemId: "a1", url: "https://example.com/a1", title: "Premier" }]);
  });

  test("ci runs are readable with the ci_run permission only", async () => {
    const run = {
      repo: "adam/kibo",
      runId: 1,
      prNumber: 12,
      ticketKey: "KIB-7",
      headSha: "abc",
      workflow: "ci",
      status: "completed",
      conclusion: "success",
      url: "https://github.com/adam/kibo/actions/runs/1",
      startedAt: null,
      updatedAt: "2026-09-26T10:00:00Z",
      jobs: [],
    };
    expect(await createMockSdk(manifest, { ciRuns: [run] }).sdk.list("ci_run")).toEqual([run]);
    await expect(createMockSdk({ ...manifest, reads: ["ticket"] }).sdk.list("ci_run")).rejects.toThrow("PERMISSION_DENIED");
  });
});
```

`packages/sdk/src/source.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { matchesSource, readSource } from "./source";

const ticket = (refs: TicketView["externalRefs"]): TicketView => ({
  id: "1@1",
  key: "KIB-1",
  title: "A",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: refs,
  progress: { done: 0, total: 0 },
  waitingOn: [],
});

test("a synced instance only shows tickets of its binding", () => {
  const source = readSource({ source: { bindingId: "b1" } });
  expect(source).toEqual({ bindingId: "b1" });
  const linked = ticket([{ kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 1, nodeId: "I", url: "https://github.com/adam/kibo/issues/1" }]);
  expect(matchesSource(linked, source)).toBe(true);
  expect(matchesSource(ticket([]), source)).toBe(false);
  expect(matchesSource(ticket([]), null)).toBe(true);
  expect(readSource({ source: { bindingId: 3 } })).toBeNull();
  expect(readSource({})).toBeNull();
});
```

Run: `bun test packages/sdk` — Expected: FAIL.

- [x] **Step 2: Schéma**

`packages/schema/src/manifest.ts` : `BuiltinEntityType` gagne `"ci_run"` (lecture seule de fait : aucune commande n'écrit `ci_run`, `COMMAND_WRITES` ne la cite pas).

`packages/schema/src/call.ts`, union `ComponentCall` (import de `McpImportItem`, `McpServerId` depuis `./integrations`) :

```ts
  z.object({ kind: z.literal("mcp.call"), server: McpServerId, tool: z.string().min(1).max(128), args: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal("mcp.read"), server: McpServerId, uri: z.string().min(1).max(2048) }),
  z.object({ kind: z.literal("mcp.import"), server: McpServerId, item: McpImportItem }),
```

`packages/schema/src/permissions.ts` (`secrets` y a été ajouté par la Task 8) :
- `GrantedPermissions` gagne `mcp: z.array(z.string()).default([])` ; `grantedOf` recopie `unique(m.mcp)` ; `permissionList` ajoute `...g.mcp.map((r) => \`mcp:${r}\`)` ; `NO_PERMISSIONS.mcp = []` ;
- `permissionOfCall` (le `switch` est exhaustif, sans `default`) :

```ts
    case "mcp.call":
      return `mcp:${call.server}/${call.tool}`;
    case "mcp.read":
    case "mcp.import":
      return `mcp:${call.server}`;
```

- `covers` et `diffPermissions` gagnent un dernier paramètre `config: Record<string, unknown> | null = null` :

```ts
function mcpUsed(used: string): { server: string; tool: string | null } {
  const [server = "", tool] = used.slice(4).split("/");
  return { server, tool: tool ?? null };
}

export function covers(declared: string[], used: string, config: Record<string, unknown> | null = null): boolean {
  if (used.startsWith("mcp:")) {
    const rules = declared.filter((d) => d.startsWith("mcp:")).map((d) => d.slice(4));
    const { server, tool } = mcpUsed(used);
    return mcpCovered(rules, server, tool, config);
  }
  if (!used.startsWith("net:")) return declared.includes(used);
  const url = used.slice(4);
  return declared.some((d) => d.startsWith("net:") && ruleCovers(d.slice(4), url));
}
```

et `diffPermissions(declared, used, config = null)` passe `config` à ses deux appels de `covers`. Test ajouté à `packages/schema/src/schema.test.ts` : `covers(["mcp:ctx"], "mcp:ctx/echo")` vrai, `covers(["mcp:ctx/resolve"], "mcp:ctx/echo")` faux, `covers(["mcp:{config.server}"], "mcp:fs/read")` faux, `covers(["mcp:{config.server}"], "mcp:fs/read", { server: "fs" })` vrai, et `addedPermissions` d'une version qui gagne `mcp: ["ctx"]` et `secrets: [{ name: "github", … }]` rend `["secret:github@api.github.com", "mcp:ctx"]` (hôte `api.github.com`, N41).

Ajouter `mcp: []` aux littéraux `GrantedPermissions` listés dans **Files**.

- [x] **Step 3: SDK**

`packages/sdk/src/source.ts` :

```ts
import { InstanceSource, type TicketView } from "@kibo/schema";

export function readSource(config: Record<string, unknown>): InstanceSource | null {
  const parsed = InstanceSource.safeParse(config.source);
  return parsed.success ? parsed.data : null;
}

export function matchesSource(ticket: TicketView, source: InstanceSource | null): boolean {
  if (source === null) return true;
  return ticket.externalRefs.some((r) => r.kind === "github_issue" && r.bindingId === source.bindingId);
}
```

`packages/sdk/src/types.ts` : `EntityMap` gagne `ci_run: CiRun` ; `KiboSdk` gagne

```ts
  mcp: {
    call(server: string, tool: string, args?: Record<string, unknown>): Promise<McpCallResult>;
    read(server: string, uri: string): Promise<McpCallResult>;
    importItem(server: string, item: McpImportItem): Promise<Ticket>;
  };
```

`packages/sdk/src/sdk.ts`, dans `createSdk` : `fromSnapshot` gagne `ci_run: () => call<CiRun[]>({ kind: "list", entity: "ci_run" })` (entité hors snapshot, comme `note`) ; une fonction `mcpApi(manifest, guard, call, ctx.config)` à côté de `notesApi` :

```ts
function mcpApi(manifest: ComponentManifest, guard: Guard, call: Call, config: Record<string, unknown>): KiboSdk["mcp"] {
  const need = (server: string, tool: string | null) => {
    if (!mcpCovered(manifest.mcp, server, tool, config)) guard.deny(`mcp ${tool === null ? server : `${server}/${tool}`}`);
  };
  return {
    async call(server, tool, args = {}) {
      need(server, tool);
      return call<McpCallResult>({ kind: "mcp.call", server, tool, args });
    },
    async read(server, uri) {
      need(server, null);
      return call<McpCallResult>({ kind: "mcp.read", server, uri });
    },
    async importItem(server, item) {
      guard.needWrite("ticket");
      need(server, null);
      return call<Ticket>({ kind: "mcp.import", server, item });
    },
  };
}
```

et `mcp: mcpApi(manifest, guard, call, ctx.config)` dans l'objet rendu. En mode `builtin` comme `gated`, ces appels passent par `backend.call` (RPC `componentCall`), seul chemin vers le démon.

`packages/sdk/src/mock.ts` :
- `MockSdkOptions` gagne `mcp?: Record<string, McpCallResult>` et `ciRuns?: CiRun[]` ;
- `listEntity` gagne `ci_run: () => opts.ciRuns ?? []` ;
- `handle` gagne `case "list"` inchangé (passe par `listEntity`), et :

```ts
      case "mcp.call":
      case "mcp.read": {
        const key = c.kind === "mcp.call" ? `${c.server}/${c.tool}` : `${c.server}@${c.uri}`;
        const reply = opts.mcp?.[key];
        if (!reply) throw new KiboError("MCP_FAILED", `no programmed response for ${key}`);
        return reply;
      }
      case "mcp.import":
        return run({
          method: "importExternalTicket",
          title: c.item.title,
          ref: { kind: "mcp_item", server: c.server, itemId: c.item.itemId, url: c.item.url, title: c.item.title },
        });
```

- l'objet `sdk` enveloppe `mcp` comme les autres appels :

```ts
    mcp: {
      call: (server, tool, args) =>
        record(`mcp:${server}/${tool}`, `mcp ${server}/${tool}`, () => inner.mcp.call(server, tool, args)),
      read: (server, uri) => record(`mcp:${server}`, `mcp ${server}`, () => inner.mcp.read(server, uri)),
      importItem: (server, item) =>
        record(`mcp:${server}`, `mcp ${server}`, () => inner.mcp.importItem(server, item)),
    },
```

(`importItem` exige aussi `write:ticket`, contrôlé par le SDK ; le refus porte alors le libellé `mcp <server>` : le test de conformité le voit dans `violations`.)

`packages/sdk/src/conformance.tsx`, dans le `describe` existant :

```ts
    test("secrets are only requested for hosts covered by net", () => {
      expect(secretHostsCovered(manifest)).toEqual([]);
    });
```

et, dans le test de rendu, `diffPermissions(declared, m.used, mockOpts.config ?? null)` au lieu de `diffPermissions(declared, m.used)` (une règle `{config.server}` d'un intégré couvre le serveur de sa config de test).

`packages/sdk/src/index.ts` : `export * from "./source";`.

Run: `bun test packages/sdk` — Expected: PASS.

- [x] **Step 4: Démon (porte `componentCall` de la phase 4)**

`packages/daemon/src/components/gate.ts` :
- `missingPermission` : après le calcul générique (qui couvre `mcp.*` par `covers`, sans config pour un non-intégré : `{config.server}` ne couvre rien), `if (call.kind === "mcp.import" && !covers(permissionList(granted), "write:ticket")) return "write:ticket";` ;
- `GateHandlers` gagne `mcp(projectId: string, instanceId: string, call: McpCall): Promise<unknown>` ; `list` accepte `ci_run` (type `Exclude<BuiltinEntityType, "note">` inchangé) ;
- `dispatch` : `case "mcp.call": case "mcp.read": case "mcp.import": return h.mcp(projectId, inst.id, call);` avant le `default` des notes.

`packages/daemon/src/components/gate-handlers.ts` (les hooks viennent de `deps.integrations`, Task 8) :

```ts
    async list(projectId, entity) {
      if (entity === "run") return deps.runs(projectId);
      if (entity === "ci_run") {
        const ciRuns = deps.integrations?.()?.ciRuns ?? null;
        if (!ciRuns) throw new KiboError("NOT_CONNECTED", "ci not started");
        return ciRuns(projectId);
      }
      const snap = readProject(docs.project(projectId));
      const lists = { ticket: snap.tickets, status: snap.workflow, link: snap.links, page: snap.pages };
      return lists[entity];
    },
    async mcp(projectId, instanceId, call) {
      const gate = deps.integrations?.()?.mcp ?? null;
      if (!gate) throw new KiboError("MCP_UNAVAILABLE", "mcp hub not started");
      const ctx = { projectId, instanceId };
      if (call.kind === "mcp.call") return gate.call(ctx, call.server, call.tool, call.args);
      if (call.kind === "mcp.read") return gate.read(ctx, call.server, call.uri);
      return gate.importItem(ctx, call.server, call.item);
    },
```

Les refus (`PERMISSION_DENIED`, `RATE_LIMITED`) sont journalisés dans `component_events` par la porte, comme tout appel ; un appel MCP compte dans le quota `call` de l'instance.

`packages/daemon/src/components/gate.test.ts` : le harnais `gate()` gagne `mcp: handler("mcp")` dans `handlers` et `mcp: []` dans `granted`. Ajouter :

```ts
describe("mcp calls", () => {
  const mcpCall: ComponentCall = { kind: "mcp.call", server: "ctx", tool: "echo", args: {} };
  const withGranted = (mcp: string[]) => {
    const eventsDb = new Database(":memory:");
    ensureEventsTable(eventsDb);
    return createGate({
      instance: (_p, id) => {
        const i = instances[id];
        if (!i) throw new KiboError("NOT_FOUND", `instance ${id}`);
        return i;
      },
      active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, mcp } }),
      handlers: {
        list: async () => [],
        run: async () => null,
        data: async () => null,
        fetch: async () => ({ status: 200, headers: {}, body: "" }),
        action: async () => null,
        notes: async () => null,
        mcp: async (_p, instanceId, call) => {
          handled.push(`mcp:${instanceId}:${call.kind}`);
          return null;
        },
      },
      quotas: createQuotas(),
      events: createEventLog(eventsDb, () => 42),
    });
  };

  test("follow the granted mcp rules of a sandboxed component", async () => {
    await expect(withGranted([]).call("p", "thirdparty", mcpCall)).rejects.toThrow("PERMISSION_DENIED");
    await withGranted(["ctx/echo"]).call("p", "thirdparty", mcpCall);
    expect(handled).toEqual(["mcp:thirdparty:mcp.call"]);
    await expect(
      withGranted(["{config.server}"]).call("p", "thirdparty", { kind: "mcp.read", server: "ctx", uri: "x" }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("an import also needs write:ticket", async () => {
    const item = { itemId: "a1", title: "A", url: null };
    await expect(withGranted(["ctx"]).call("p", "thirdparty", { kind: "mcp.import", server: "ctx", item })).rejects.toThrow(
      "write:ticket",
    );
  });
});
```

et, dans le `describe` du journal, un refus MCP produit une ligne `component_events` de `kind: "mcp.call"` (même forme que le cas `fetch` existant).

- [x] **Step 5: Devkit**

`packages/devkit/src/infer-permissions.ts`, dans `sdkCall` : `sdk.mcp.call("<server>", "<tool>", …)` ⇒ `mcp:<server>/<tool>` ; `sdk.mcp.read("<server>", …)` ⇒ `mcp:<server>` ; `sdk.mcp.importItem("<server>", …)` ⇒ `mcp:<server>` et `write:ticket` ; un serveur ou un outil non littéral ⇒ `non-literal-argument` (comme `fetch`). Test ajouté à `infer-permissions.test.ts` sur `inferFromSources`.

`packages/devkit/src/validate.ts`, `readManifest` : après le contrôle `reservedId`, `if (parsed.data.mcp.includes(CONFIG_SERVER_RULE)) return [FR_DEVKIT.configServerReserved];` (tout composant validé est non intégré) ; `packages/devkit/src/fr.ts` : `configServerReserved: "{config.server} est réservé aux composants intégrés"`. Test ajouté au cas « an invalid or reserved manifest stops before the tests » de `validate.test.ts` : manifeste `hello` avec `mcp: ["{config.server}"]` ⇒ `report.manifest = { ok: false, errors: ["{config.server} est réservé aux composants intégrés"] }`.

- [x] **Step 6: Écran 30**

`packages/ui/src/lib/permission-lines.test.ts` : ajouter

```ts
test("secrets and mcp rules read in plain French", () => {
  expect(
    titles({
      ...NO_PERMISSIONS,
      net: ["api.github.com"],
      secrets: [{ name: "github", hosts: ["api.github.com"] }],
      mcp: ["context7", "context7/get-library-docs", "{config.server}"],
    }).slice(1),
  ).toEqual([
    ["Utiliser ton compte GitHub (api.github.com)", null],
    ["Appeler le serveur MCP context7", null],
    ["Appeler l'outil get-library-docs du serveur MCP context7", null],
    ["Appeler le serveur MCP choisi à l'ajout", null],
  ]);
});
```

`packages/ui/src/lib/permission-lines.ts` : après la ligne réseau, une ligne `{ icon: KeyRound, title: p.secret(s.name, s.hosts) }` par secret et `{ icon: Plug, title: rule === CONFIG_SERVER_RULE ? p.mcpFromConfig : p.mcp(rule) }` par règle MCP (`p = fr.integrations.permissions`, Task 1) ; `closingLine` ne rend aucune ligne de fermeture quand `mcp` n'est pas vide : un serveur MCP peut accéder au réseau comme aux fichiers locaux. `TrustDialog.tsx` n'est pas modifié : il rend `permissionLines(grantedOf(manifest))`.

- [x] **Step 7: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/schema/src/manifest.ts packages/schema/src/call.ts packages/schema/src/permissions.ts packages/schema/src/schema.test.ts packages/core/src/registry.test.ts packages/sdk/src packages/daemon/src/components/gate.ts packages/daemon/src/components/gate-handlers.ts packages/daemon/src/components/gate.test.ts
git commit -m "feat(sdk): appels MCP et entité ci_run"
git add packages/devkit/src/infer-permissions.ts packages/devkit/src/infer-permissions.test.ts packages/devkit/src/validate.ts packages/devkit/src/validate.test.ts packages/devkit/src/fr.ts packages/ui/src/lib/permission-lines.ts packages/ui/src/lib/permission-lines.test.ts
git commit -m "feat(devkit): permissions MCP et écran 30"
```

(Schéma, SDK et porte vont ensemble : `gate.ts` et `sdk.ts` ne compilent qu'avec les nouveaux cas de `ComponentCall`.)

---

### Task 10: Écran 16 · Intégrations

Référence : page PDF 26 (sombre et clair) et maquette P1 (états). Une ligne par intégration, dans l'ordre de `IntegrationId`.

**Files:**
- Create: `packages/ui/src/state/use-integrations.ts`, `packages/ui/src/state/use-sync-state.ts`, `packages/sdk/src/ui/switch.tsx`, `packages/ui/src/settings/integration-rows.ts`, `packages/ui/src/settings/integration-rows.test.ts`, `packages/ui/src/settings/IntegrationRow.tsx`, `packages/ui/src/settings/IntegrationsPage.tsx`, `packages/ui/src/settings/IntegrationsPage.test.tsx`, `packages/ui/src/settings/DisconnectDialog.tsx`, `packages/ui/src/settings/integration-dialogs.ts`
- Modify (N30, écran de premier niveau) : `packages/schema/src/tabs.ts` (`Screen` gagne `integrations`), `packages/ui/src/tabs/target-hash.ts` (`#/settings/integrations`), `packages/ui/src/tabs/screens.ts` (titre, icône `Plug`, fil d'Ariane), `packages/ui/src/palette/CommandPalette.tsx` (icône de l'écran), `packages/ui/src/palette/screen-items.test.ts`, `packages/ui/src/shell/lazy-screens.ts` (`IntegrationsPage` par `lazyPanel`), `packages/ui/src/shell/ScreenView.tsx`, `packages/ui/src/shell/AppSidebar.tsx` (« Paramètres » actif aussi sur `integrations`), `packages/ui/src/settings/SettingsNav.tsx` (entrées `domains` et `integrations` navigables), `packages/ui/src/settings/domains-page.test.tsx`

**Interfaces:**
- Consumes: `IntegrationStatus`, `IntegrationEvent`, RPC `listIntegrations`, `testIntegration`, `disconnectIntegration`, `getGithubConnectOptions`, `getSyncState` (Task 1) ; `frIntegrations` (Task 1) ; `client.subscribeIntegrations(listener: (e: IntegrationEvent) => void): () => void` (Task 2, N24 : aucun changement de `client.ts` ici) ; `navigateTo` (`packages/ui/src/route.ts`), `lazyPanel` (SDK, décision 29 de la phase 4), `useFlash` (`packages/ui/src/lib/use-flash.ts`, décision 19 de la phase 4).
- Produces:
  - `Screen` : valeur `integrations` (onglet, hash `#/settings/integrations`, palette, fil d'Ariane « Paramètres › Intégrations »)
  - `SettingsNav({ active }: { active: "domains" | "integrations" })` : les deux entrées livrées naviguent (`navigateTo({ kind: "screen", screen })`), les autres restent désactivées « Bientôt »
  - `useIntegrations(): { statuses: IntegrationStatus[]; error: KiboError | null; loading: boolean; reload(): Promise<void> }`
  - `type RowView = { id: IntegrationId; icon: LucideIcon; title: string; description: string; badge: { tone: "ok" | "warn" | "error"; label: string } | null; action: "connect" | "retry" | null; menu: RowMenuItem[]; error: string | null }`, `type RowMenuItem = "configure" | "test" | "disconnect"`
  - `integrationRow(s: IntegrationStatus, opts: { hasDialog(id: IntegrationId): boolean; time(ms: number): string }): RowView`
  - `type IntegrationDialogId = "github" | "figma" | "mcp"` ; `type IntegrationDialogProps = { open: boolean; onOpenChange(open: boolean): void; onDone(message?: string): void }` (le message éventuel, par exemple « Connecté en tant que adam », est affiché par l'écran 16) ; `INTEGRATION_DIALOGS: Partial<Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>>` (rempli par la Task 11) ; `dialogOf(id: IntegrationId): IntegrationDialogId | null`
  - `IntegrationsPage()`
  - `useSyncState(projectId: string): { state: SyncState | null; error: string | null; reload(): Promise<void> }` (utilisé par les Tasks 18 et 21)
  - `Switch` (`@kibo/sdk/ui/switch`, utilisé par les Tasks 11 et 18)

Pas de `Toaster` ici (N29 : il est monté par la Task 21) : les messages de l'écran 16 (test de connexion, connexion réussie, échec) sont des `useFlash` affichés sous l'en-tête (`role="status"` ou `role="alert"`), comme les messages d'action de la phase 4.

- [x] **Step 1: Test du modèle de ligne (échoue)**

`packages/ui/src/settings/integration-rows.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { IntegrationStatus } from "@kibo/schema";
import { integrationRow } from "./integration-rows";

const s = (patch: Partial<IntegrationStatus> & Pick<IntegrationStatus, "id" | "state">): IntegrationStatus => ({
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
  ...patch,
});
const opts = { hasDialog: () => true, time: () => "14:32" };

describe("integration rows (screen 16)", () => {
  test("active rows have a badge and no menu", () => {
    const r = integrationRow(s({ id: "git", state: "active" }), opts);
    expect(r).toMatchObject({ title: "Git local", description: "Branches, commits, worktrees, diff", badge: { tone: "ok", label: "Actif" }, action: null, menu: [] });
  });
  test("connected github shows the account and the full menu", () => {
    const r = integrationRow(s({ id: "github", state: "connected", account: "adam" }), opts);
    expect(r.description).toBe("PR, reviews, statuts CI · compte adam");
    expect(r.badge).toEqual({ tone: "ok", label: "Connecté" });
    expect(r.menu).toEqual(["configure", "test", "disconnect"]);
  });
  test("mcp lists its servers", () => {
    const r = integrationRow(s({ id: "mcp", state: "connected", servers: ["context7", "filesystem"] }), opts);
    expect(r.description).toBe("Connecteur générique · 2 serveurs (context7, filesystem)");
    expect(r.menu).toEqual(["configure", "test"]);
  });
  test("disconnected rows offer Connecter only when a dialog exists", () => {
    expect(integrationRow(s({ id: "figma", state: "disconnected" }), opts)).toMatchObject({ action: "connect", badge: null, menu: [] });
    expect(integrationRow(s({ id: "figma", state: "disconnected" }), { ...opts, hasDialog: () => false }).action).toBeNull();
  });
  test("errors show the message, Réessayer and the menu", () => {
    const r = integrationRow(s({ id: "github", state: "error", error: { code: "REMOTE_REJECTED", message: "Jeton refusé" } }), opts);
    expect(r).toMatchObject({ error: "Jeton refusé", action: "retry", badge: { tone: "error", label: "Erreur" } });
  });
  test("a rate limit pauses with its resume time", () => {
    const r = integrationRow(s({ id: "github-issues", state: "connected", resumeAt: 1 }), opts);
    expect(r.badge).toEqual({ tone: "warn", label: "Limite GitHub atteinte, reprise à 14:32" });
  });
});
```

Run: `bun test packages/ui/src/settings/integration-rows.test.ts` — Expected: FAIL.

- [x] **Step 2: Implémenter le modèle et le registre**

`packages/ui/src/settings/integration-dialogs.ts` :

```ts
import type { IntegrationId } from "@kibo/schema";
import type { ComponentType } from "react";

export type IntegrationDialogId = "github" | "figma" | "mcp";
export type IntegrationDialogProps = { open: boolean; onOpenChange(open: boolean): void; onDone(message?: string): void };
export const INTEGRATION_DIALOGS: Partial<Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>> = {};

export function dialogOf(id: IntegrationId): IntegrationDialogId | null {
  if (id === "github" || id === "github-issues" || id === "github-actions") return "github";
  if (id === "figma" || id === "mcp") return id;
  return null;
}
```

`packages/ui/src/settings/integration-rows.ts` :

```ts
import type { IntegrationId, IntegrationStatus } from "@kibo/schema";
import {
  Bell,
  FileText,
  Frame,
  GitCommitHorizontal,
  GitPullRequestArrow,
  ListTodo,
  type LucideIcon,
  Plug,
  SquareTerminal,
} from "lucide-react";
import { fr } from "../i18n/fr";

export type RowMenuItem = "configure" | "test" | "disconnect";
export type RowView = {
  id: IntegrationId;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: { tone: "ok" | "warn" | "error"; label: string } | null;
  action: "connect" | "retry" | null;
  menu: RowMenuItem[];
  error: string | null;
};

const ICONS: Record<IntegrationId, LucideIcon> = {
  git: GitCommitHorizontal,
  github: GitPullRequestArrow,
  "github-issues": ListTodo,
  "github-actions": SquareTerminal,
  figma: Frame,
  notifications: Bell,
  markdown: FileText,
  mcp: Plug,
};

const MENUS: Record<IntegrationId, RowMenuItem[]> = {
  git: [],
  github: ["configure", "test", "disconnect"],
  "github-issues": ["configure", "test"],
  "github-actions": ["configure", "test"],
  figma: ["configure", "test", "disconnect"],
  notifications: [],
  markdown: ["test"],
  mcp: ["configure", "test"],
};

function describe(s: IntegrationStatus): { title: string; description: string } {
  const r = fr.integrations.rows;
  switch (s.id) {
    case "github":
      return { title: r.github.title, description: r.github.description(s.account) };
    case "mcp":
      return { title: r.mcp.title, description: r.mcp.description(s.servers) };
    default:
      return r[s.id];
  }
}

export function integrationRow(
  s: IntegrationStatus,
  opts: { hasDialog(id: IntegrationId): boolean; time(ms: number): string },
): RowView {
  const t = fr.integrations.state;
  const base = { id: s.id, icon: ICONS[s.id], ...describe(s), error: null, menu: MENUS[s.id] };
  switch (s.state) {
    case "active":
      return { ...base, badge: { tone: "ok", label: t.active }, action: null, menu: [] };
    case "disconnected":
      return { ...base, badge: null, action: opts.hasDialog(s.id) ? "connect" : null, menu: [] };
    case "error":
      return { ...base, badge: { tone: "error", label: t.error }, action: "retry", error: s.error?.message ?? t.error };
    case "connected":
      return {
        ...base,
        badge:
          s.resumeAt !== null
            ? { tone: "warn", label: t.rateLimited(opts.time(s.resumeAt)) }
            : { tone: "ok", label: t.connected },
        action: null,
      };
  }
}
```

Run: `bun test packages/ui/src/settings/integration-rows.test.ts` — Expected: PASS.

- [x] **Step 3: Test de la page (échoue)**

`packages/ui/src/settings/IntegrationsPage.test.tsx` :

```ts
import { beforeEach, expect, mock, test } from "bun:test";
import type { IntegrationStatus, RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let statuses: IntegrationStatus[] = [];
const status = (id: IntegrationStatus["id"], state: IntegrationStatus["state"], patch: Partial<IntegrationStatus> = {}): IntegrationStatus => ({
  id,
  state,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
  ...patch,
});

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listIntegrations") return statuses;
      if (req.method === "testIntegration") return status(req.id, "connected");
      return null;
    },
    subscribeIntegrations: () => () => undefined,
  },
}));

const { IntegrationsPage } = await import("./IntegrationsPage");

beforeEach(() => {
  calls.length = 0;
  statuses = [
    status("git", "active"),
    status("github", "connected", { account: "adam" }),
    status("figma", "disconnected"),
    status("mcp", "connected", { servers: ["context7", "filesystem"] }),
  ];
});

test("renders one row per integration with the screen 16 texts", async () => {
  render(<IntegrationsPage />);
  expect(await screen.findByText("PR, reviews, statuts CI · compte adam")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Intégrations" })).toBeDefined();
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("button", { name: "Intégrations" }).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("button", { name: "Domaines & guidelines" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByText("Les secrets sont stockés dans le trousseau système, jamais dans les données du projet.")).toBeDefined();
  expect(screen.getByText("Connecteur générique · 2 serveurs (context7, filesystem)")).toBeDefined();
  expect(screen.getAllByText("Connecté")).toHaveLength(2);
  expect(screen.getByText("Actif")).toBeDefined();
});

test("tests and disconnects through the row menu, after confirmation", async () => {
  const user = userEvent.setup();
  render(<IntegrationsPage />);
  await user.click(await screen.findByRole("button", { name: "Actions pour GitHub" }));
  await user.click(await screen.findByRole("menuitem", { name: "Tester la connexion" }));
  expect(calls).toContainEqual({ method: "testIntegration", id: "github" });
  expect((await screen.findByRole("status")).textContent).toBe("Connexion vérifiée");
  await user.click(screen.getByRole("button", { name: "Actions pour GitHub" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déconnecter" }));
  const dialog = await screen.findByRole("dialog", { name: "Déconnecter GitHub ?" });
  await user.click(within(dialog).getByRole("button", { name: "Déconnecter" }));
  expect(calls).toContainEqual({ method: "disconnectIntegration", id: "github" });
});

test("a keychain failure shows the banner", async () => {
  statuses = [status("github", "error", { error: { code: "SECRET_STORE_UNAVAILABLE", message: "locked" } })];
  render(<IntegrationsPage />);
  expect(await screen.findByText(/Trousseau système indisponible/)).toBeDefined();
});
```

Run: `bun test packages/ui/src/settings/IntegrationsPage.test.tsx` — Expected: FAIL.

- [x] **Step 4: Implémenter hook, ligne, dialogue de déconnexion, page**

`packages/ui/src/state/use-integrations.ts` :

```ts
import { type IntegrationStatus, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export function useIntegrations() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [error, setError] = useState<KiboError | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setStatuses(await client.rpc({ method: "listIntegrations" }));
      setError(null);
    } catch (e) {
      setError(e instanceof KiboError ? e : new KiboError("INTERNAL", String(e)));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return client.subscribeIntegrations((e) => {
      if (e.type === "integrations") void reload();
    });
  }, [reload]);
  return { statuses, error, loading, reload };
}
```

`client.subscribeIntegrations` (Task 2, N24) ne livre que des `IntegrationEvent` déjà validés : aucun `safeParse` ici.

`packages/ui/src/settings/IntegrationRow.tsx` :

```tsx
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { fr } from "../i18n/fr";
import type { RowMenuItem, RowView } from "./integration-rows";

const DOT = { ok: "bg-green-500", warn: "bg-amber-500", error: "bg-red-500" } as const;

type Props = { row: RowView; onAction(action: "connect" | "retry"): void; onMenu(item: RowMenuItem): void };

export function IntegrationRow({ row, onAction, onMenu }: Props) {
  const t = fr.integrations;
  const Icon = row.icon;
  return (
    <li className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm font-medium">{row.title}</p>
        <p className={`truncate text-xs ${row.error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
          {row.error ?? row.description}
        </p>
      </div>
      {row.badge && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className={`size-1.5 rounded-full ${DOT[row.badge.tone]}`} />
          {row.badge.label}
        </span>
      )}
      {row.action && (
        <Button variant="outline" size="sm" onClick={() => row.action && onAction(row.action)}>
          {row.action === "connect" ? t.state.connect : t.state.retry}
        </Button>
      )}
      {row.menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={t.menu.label(row.title)}>
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.menu.includes("configure") && (
              <DropdownMenuItem onSelect={() => onMenu("configure")}>{t.menu.configure}</DropdownMenuItem>
            )}
            {row.menu.includes("test") && <DropdownMenuItem onSelect={() => onMenu("test")}>{t.menu.test}</DropdownMenuItem>}
            {row.menu.includes("disconnect") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onMenu("disconnect")}>
                  {t.menu.disconnect}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
```

`packages/ui/src/settings/DisconnectDialog.tsx` :

```tsx
import type { IntegrationStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { fr } from "../i18n/fr";

type Props = {
  target: { id: "github" | "figma"; title: string; mode: "gh" | "token" | null } | null;
  onCancel(): void;
  onConfirm(id: "github" | "figma"): void;
};

export function DisconnectDialog({ target, onCancel, onConfirm }: Props) {
  const t = fr.integrations.disconnect;
  if (!target) return null;
  const body = target.id === "figma" ? t.figma : target.mode === "gh" ? t.githubGh : t.githubToken;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(target.title)}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(target.id)}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type DisconnectTarget = NonNullable<Props["target"]>;
export const disconnectable = (s: IntegrationStatus): s is IntegrationStatus & { id: "github" | "figma" } =>
  s.id === "github" || s.id === "figma";
```

`packages/ui/src/settings/IntegrationsPage.tsx` (même gabarit que `DomainsPage` : `SettingsNav` à gauche) :

```tsx
import { type IntegrationId, KiboError } from "@kibo/schema";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { useIntegrations } from "../state/use-integrations";
import { DisconnectDialog, type DisconnectTarget, disconnectable } from "./DisconnectDialog";
import { dialogOf, INTEGRATION_DIALOGS, type IntegrationDialogId } from "./integration-dialogs";
import { IntegrationRow } from "./IntegrationRow";
import { integrationRow, type RowMenuItem } from "./integration-rows";
import { SettingsNav } from "./SettingsNav";

const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const hasDialog = (id: IntegrationId) => {
  const d = dialogOf(id);
  return d !== null && INTEGRATION_DIALOGS[d] !== undefined;
};
const message = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));

export function IntegrationsPage() {
  const t = fr.integrations;
  const { statuses, error, reload } = useIntegrations();
  const flash = useFlash();
  const [dialog, setDialog] = useState<IntegrationDialogId | null>(null);
  const [disconnect, setDisconnect] = useState<DisconnectTarget | null>(null);
  const keychainDown =
    error?.code === "SECRET_STORE_UNAVAILABLE" || statuses.some((s) => s.error?.code === "SECRET_STORE_UNAVAILABLE");

  const test = async (id: IntegrationId) => {
    try {
      const s = await client.rpc({ method: "testIntegration", id });
      if (s.state === "error") flash.flash(s.error?.message ?? t.state.error, "error");
      else flash.flash(t.menu.tested);
    } catch (e) {
      flash.flash(message(e), "error");
    }
    await reload();
  };
  const onMenu = async (id: IntegrationId, item: RowMenuItem) => {
    if (item === "test") return test(id);
    if (item === "configure") return setDialog(dialogOf(id));
    const s = statuses.find((x) => x.id === id);
    if (!s || !disconnectable(s)) return;
    try {
      const opts = s.id === "github" ? await client.rpc({ method: "getGithubConnectOptions" }) : null;
      setDisconnect({ id: s.id, title: t.rows[s.id].title, mode: opts?.mode === "gh" ? "gh" : "token" });
    } catch (e) {
      flash.flash(message(e), "error");
    }
  };
  const confirmDisconnect = async (id: "github" | "figma") => {
    setDisconnect(null);
    try {
      await client.rpc({ method: "disconnectIntegration", id });
    } catch (e) {
      flash.flash(message(e), "error");
    }
    await reload();
  };
  const Dialog = dialog ? INTEGRATION_DIALOGS[dialog] : undefined;

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="integrations" />
      <section className="grid max-w-3xl content-start gap-6 p-8">
        <header className="grid gap-1">
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </header>
        {keychainDown && (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {t.keychainUnavailable}
          </p>
        )}
        {flash.message && (
          <p
            role={flash.tone === "error" ? "alert" : "status"}
            className={`text-sm ${flash.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {flash.message}
          </p>
        )}
        <ul className="grid gap-2">
          {statuses.map((s) => (
            <IntegrationRow
              key={s.id}
              row={integrationRow(s, { hasDialog, time })}
              onAction={(action) => (action === "retry" ? void test(s.id) : setDialog(dialogOf(s.id)))}
              onMenu={(item) => void onMenu(s.id, item)}
            />
          ))}
        </ul>
        {Dialog && (
          <Dialog
            open
            onOpenChange={(o) => !o && setDialog(null)}
            onDone={(done) => {
              setDialog(null);
              if (done) flash.flash(done);
              void reload();
            }}
          />
        )}
        <DisconnectDialog target={disconnect} onCancel={() => setDisconnect(null)} onConfirm={(id) => void confirmDisconnect(id)} />
      </section>
    </div>
  );
}
```

Le texte de déconnexion de GitHub dépend du mode (`getGithubConnectOptions().mode`, lu à l'ouverture de la confirmation) : en mode `gh`, aucun jeton n'est dans le trousseau.

**Écran de premier niveau (N30).** La phase 2 n'a livré que « Domaines & guidelines » (`Screen = agents | queue | domains | components | mine`) :
- `packages/schema/src/tabs.ts` : `Screen = z.enum(["agents", "queue", "domains", "components", "mine", "integrations"])` (un onglet enregistré reste lisible, la valeur est ajoutée en fin).
- `packages/ui/src/tabs/target-hash.ts` : `integrations: "#/settings/integrations"` dans `SCREEN_HASHES`.
- `packages/ui/src/tabs/screens.ts` : `integrations: { title: fr.settings.integrations, icon: Plug, crumbs: [fr.nav.settings, fr.settings.integrations] }`.
- `packages/ui/src/palette/CommandPalette.tsx` : `integrations: SCREENS.integrations.icon` dans la table des icônes ; `screen-items.test.ts` gagne `expect(searchItems(buildItems(context), "intégrations", "pages")[0]?.items[0]?.label).toBe("Intégrations")`.
- `packages/ui/src/shell/lazy-screens.ts` : `export const IntegrationsPage = lazyPanel(() => import("../settings/IntegrationsPage").then((m) => m.IntegrationsPage), fr.lazy);` (hors du chargement initial, décision 29 de la phase 4).
- `packages/ui/src/shell/ScreenView.tsx` : `if (screen === "integrations") return <IntegrationsPage />;` juste après la ligne `components` (l'écran ne dépend ni de `config` ni de `agents`).
- `packages/ui/src/shell/AppSidebar.tsx` : le bouton « Paramètres » est actif pour `screen === "domains" || screen === "integrations"` (il ouvre toujours `domains`).
- `packages/ui/src/settings/SettingsNav.tsx` : `active: "domains" | "integrations"` ; les entrées `domains` et `integrations` sont activées et appellent `navigateTo({ kind: "screen", screen: id })` (`packages/ui/src/route.ts` : le changement de hash ouvre l'écran dans l'onglet courant par `useHashSync`) ; les autres restent `disabled` avec `title={fr.settings.soon}`. `domains-page.test.tsx` : « Intégrations » n'est plus désactivé, « Général » l'est toujours.

- [x] **Step 5: `Switch` shadcn et `useSyncState`**

`packages/sdk/src/ui/switch.tsx` : généré par `bunx shadcn@4.21.0 add switch` lancé depuis `packages/ui` (son `components.json` pointe vers `packages/sdk/src/ui`, règle de la phase 4), `import { Switch as SwitchPrimitive } from "radix-ui"` et `import { cn } from "cn"` comme `checkbox.tsx`. Aucune dépendance nouvelle (`radix-ui` 1.6.7 est déjà une dépendance du SDK). `switch` n'est pas ajouté à `SDK_UI_PRIMITIVES` (primitive de l'application, pas encore offerte aux composants tiers). Livré ici pour que les Tasks 11 et 18 (vague 2) le consomment sans dépendre l'une de l'autre.

`packages/ui/src/state/use-sync-state.ts` (état de sync d'un projet, rechargé sur les événements `sync` et `integrations`) :

```ts
import type { SyncState } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export function useSyncState(projectId: string) {
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setState(await client.rpc({ method: "getSyncState", projectId }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId]);
  useEffect(() => {
    void reload();
    return client.subscribeIntegrations((e) => {
      if (e.type === "integrations" || (e.type === "sync" && e.projectId === projectId)) void reload();
    });
  }, [projectId, reload]);
  return { state, error, reload };
}
```

- [x] **Step 6: Vérifier et commiter**

Run: `bun test packages/schema packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build && bun run budget` — Expected: PASS (budget du chargement initial ≤ 230 kB gzip inchangé : l'écran est différé). Contrôle visuel : ouvrir Paramètres › Intégrations avec le démon de dev en sombre puis en clair et comparer à la page PDF 26 (espacements, pastilles, bouton « Connecter » de Figma).

```bash
git add packages/schema/src/tabs.ts packages/ui/src/tabs packages/ui/src/palette packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ScreenView.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/settings packages/ui/src/state/use-integrations.ts packages/ui/src/state/use-sync-state.ts packages/sdk/src/ui/switch.tsx
git commit -m "feat(ui): écran des intégrations"
```

Dépendances : Task 2 (`subscribeIntegrations`) et tâche 34 de la phase 4 intégrée (elle ajoute la carte « Commande kibo » dans `packages/ui/src/settings/` et touche la navigation des Paramètres).

---

### Task 11: Dialogues de connexion

Référence : maquettes P2 (GitHub), P3 (Figma), P4 (liste des serveurs MCP), P5 (ajout d'un serveur MCP), sombre et clair.

**Files:**
- Create: `packages/ui/src/dialogs/integrations/{GithubConnectDialog.tsx,FigmaConnectDialog.tsx,McpServersDialog.tsx,McpServerDialog.tsx,mcp-form.ts,mcp-form.test.ts,integration-dialogs.test.tsx}`
- Modify: `packages/ui/src/settings/integration-dialogs.ts` (enregistre les trois dialogues)

Aucune dépendance nouvelle : `sonner` n'est pas une dépendance de `packages/ui`, et le `Toaster` n'est monté qu'à la Task 21 (N29). Le message de succès « Connecté en tant que adam » est rendu par l'écran 16 : le dialogue se ferme par `onDone(message)` et `IntegrationsPage` l'affiche (`useFlash`, `role="status"`, Task 10).

**Interfaces:**
- Consumes: `IntegrationDialogProps` (avec `onDone(message?: string)`), `INTEGRATION_DIALOGS` (Task 10) ; RPC `getGithubConnectOptions`, `connectGithub`, `configureFigma`, `listMcpServers`, `previewMcpServer`, `addMcpServer`, `removeMcpServer`, `setMcpServerEnabled` (Task 1) ; `ChoiceCard` (`packages/ui/src/dialogs/ChoiceCard.tsx` : `value`, `icon`, `title`, `description?`, `disabled?`, `badge?`, `aside?`, `stacked?` ; le radio porte `aria-label={title}`) ; primitives `@kibo/sdk/ui/{badge,button,dialog,input,label,radio-group,textarea,alert-dialog}` et `Switch` (Task 10) ; `fr.common.cancel` (`packages/ui/src/i18n/fr.ts`).
- Produces: `GithubConnectDialog`, `FigmaConnectDialog`, `McpServersDialog` (props `IntegrationDialogProps`) ; `McpServerDialog({ open, onOpenChange, onAdded, takenIds })` ; `type McpForm` et `toServerInput(form: McpForm): { server: McpServerInput; secrets: Record<string, string> } | { error: string }` ; `slugId(name: string): string`. Consomme `Switch` (Task 10).

- [x] **Step 1: Test du formulaire MCP (échoue)**

`packages/ui/src/dialogs/integrations/mcp-form.test.ts` :

```ts
import { expect, test } from "bun:test";
import { slugId, toServerInput } from "./mcp-form";

test("ids are slugged from the name", () => {
  expect(slugId("Context 7 · Docs")).toBe("context-7-docs");
  expect(slugId("Élément")).toBe("element");
});

test("a stdio form becomes a server input with secrets kept apart", () => {
  const out = toServerInput({
    transport: "stdio",
    id: "ctx",
    name: "Context7",
    command: "npx",
    args: "-y\n@upstash/context7-mcp\n",
    env: [{ name: "API_KEY", value: "k-123456789" }],
    url: "",
    bearer: "",
  });
  expect(out).toEqual({
    server: { transport: "stdio", id: "ctx", name: "Context7", command: "npx", args: ["-y", "@upstash/context7-mcp"], envNames: ["API_KEY"] },
    secrets: { API_KEY: "k-123456789" },
  });
});

test("an http form with a token asks for the bearer secret", () => {
  const out = toServerInput({ transport: "http", id: "fs", name: "FS", command: "", args: "", env: [], url: "https://mcp.example.com/mcp", bearer: "tok-123456789" });
  expect(out).toEqual({ server: { transport: "http", id: "fs", name: "FS", url: "https://mcp.example.com/mcp", bearer: true }, secrets: { bearer: "tok-123456789" } });
  expect(toServerInput({ transport: "http", id: "fs", name: "FS", command: "", args: "", env: [], url: "http://10.0.0.1/mcp", bearer: "" })).toHaveProperty("error");
});
```

Run: `bun test packages/ui/src/dialogs/integrations/mcp-form.test.ts` — Expected: FAIL.

- [x] **Step 2: Implémenter `mcp-form.ts`**

```ts
import { McpServerInput } from "@kibo/schema";

export type McpForm = {
  transport: "stdio" | "http";
  id: string;
  name: string;
  command: string;
  args: string;
  env: { name: string; value: string }[];
  url: string;
  bearer: string;
};

export function slugId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function toServerInput(
  form: McpForm,
): { server: McpServerInput; secrets: Record<string, string> } | { error: string } {
  const env = form.env.filter((e) => e.name.trim() !== "");
  const raw =
    form.transport === "stdio"
      ? {
          transport: "stdio" as const,
          id: form.id,
          name: form.name,
          command: form.command,
          args: form.args.split("\n").map((a) => a.trim()).filter((a) => a !== ""),
          envNames: env.map((e) => e.name.trim()),
        }
      : { transport: "http" as const, id: form.id, name: form.name, url: form.url, bearer: form.bearer !== "" };
  const parsed = McpServerInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid" };
  const secrets =
    form.transport === "stdio"
      ? Object.fromEntries(env.map((e) => [e.name.trim(), e.value]))
      : form.bearer
        ? { bearer: form.bearer }
        : {};
  return { server: parsed.data, secrets };
}
```

Run: `bun test packages/ui/src/dialogs/integrations/mcp-form.test.ts` — Expected: PASS.

- [x] **Step 3: Test des dialogues (échoue)**

`packages/ui/src/dialogs/integrations/integration-dialogs.test.tsx` :

```ts
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let reply: (req: RpcRequest) => Promise<unknown> = async () => null;
mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return reply(req);
    },
  },
}));

const { GithubConnectDialog } = await import("./GithubConnectDialog");
const { McpServerDialog } = await import("./McpServerDialog");

beforeEach(() => {
  calls.length = 0;
  reply = async (req) => (req.method === "getGithubConnectOptions" ? { ghAvailable: false, ghLogin: null, mode: null } : null);
});

test("github: gh is disabled when missing, a refused token is explained", async () => {
  reply = async (req) => {
    if (req.method === "getGithubConnectOptions") return { ghAvailable: false, ghLogin: null, mode: null };
    throw new KiboError("REMOTE_REJECTED", "401");
  };
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  expect(await screen.findByText("gh n'est pas installé ou pas connecté (gh auth login).")).toBeDefined();
  expect(screen.getByRole("radio", { name: "Utiliser gh" })).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("radio", { name: "Jeton personnel" }));
  await user.type(screen.getByLabelText("Jeton"), "ghp_wrong");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(await screen.findByText("GitHub a refusé ce jeton.")).toBeDefined();
  expect(calls).toContainEqual({ method: "connectGithub", auth: { mode: "token", token: "ghp_wrong" } });
});

test("github: gh is preselected when connected", async () => {
  reply = async (req) => {
    if (req.method === "getGithubConnectOptions") return { ghAvailable: true, ghLogin: "adam", mode: null };
    return { login: "adam" };
  };
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(await screen.findByText("Kibo lit le jeton de gh à la demande, sans le stocker. gh est connecté (adam).")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({ method: "connectGithub", auth: { mode: "gh" } });
  expect(onDone).toHaveBeenCalledWith("Connecté en tant que adam");
});

test("mcp: the exact command is shown and confirmed before adding", async () => {
  reply = async (req) => {
    if (req.method === "previewMcpServer") return { commandLine: "npx -y @upstash/context7-mcp" };
    return null;
  };
  const onAdded = mock(() => {});
  const user = userEvent.setup();
  render(<McpServerDialog open onOpenChange={() => {}} onAdded={onAdded} takenIds={[]} />);
  await user.type(screen.getByLabelText("Nom"), "Context7");
  await user.type(screen.getByLabelText("Commande"), "npx");
  await user.type(screen.getByLabelText("Arguments"), "-y{Enter}@upstash/context7-mcp");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirmer la commande" });
  expect(within(dialog).getByText("npx -y @upstash/context7-mcp")).toBeDefined();
  await user.click(within(dialog).getByRole("button", { name: "Ajouter et lancer" }));
  expect(calls.at(-1)).toEqual({
    method: "addMcpServer",
    server: { transport: "stdio", id: "context7", name: "Context7", command: "npx", args: ["-y", "@upstash/context7-mcp"], envNames: [] },
    confirmedCommandLine: "npx -y @upstash/context7-mcp",
    secrets: {},
  });
  expect(onAdded).toHaveBeenCalled();
});
```

Run: `bun test packages/ui/src/dialogs/integrations` — Expected: FAIL.

- [x] **Step 4: Dialogue GitHub**

`packages/ui/src/dialogs/integrations/GithubConnectDialog.tsx` :

```tsx
import { type GithubConnectOptions, KiboError } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { KeyRound, Loader2, Terminal } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { ChoiceCard } from "../ChoiceCard";

export function GithubConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const t = fr.integrations.github;
  const tokenId = useId();
  const [options, setOptions] = useState<GithubConnectOptions | null>(null);
  const [mode, setMode] = useState<"gh" | "token">("token");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    client.rpc({ method: "getGithubConnectOptions" }).then(
      (o) => {
        setOptions(o);
        setMode(o.ghAvailable ? "gh" : "token");
      },
      (e: unknown) => setError(e instanceof KiboError ? e.detail : String(e)),
    );
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { login } = await client.rpc({
        method: "connectGithub",
        auth: mode === "gh" ? { mode: "gh" } : { mode: "token", token },
      });
      onDone(t.connected(login));
    } catch (e) {
      if (e instanceof KiboError && e.code === "REMOTE_REJECTED") setError(t.refused);
      else if (e instanceof KiboError && e.code === "SECRET_STORE_UNAVAILABLE") setError(fr.integrations.keychainUnavailable);
      else setError(e instanceof KiboError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v === "gh" ? "gh" : "token")} className="grid gap-2">
          <ChoiceCard
            value="gh"
            icon={Terminal}
            title={t.gh}
            badge={<Badge variant="secondary">{t.ghRecommended}</Badge>}
            description={options?.ghAvailable && options.ghLogin ? `${t.ghHelp} ${t.ghDetected(options.ghLogin)}` : t.ghMissing}
            disabled={!options?.ghAvailable}
          />
          <ChoiceCard value="token" icon={KeyRound} title={t.token} description={t.tokenHelp} />
        </RadioGroup>
        {mode === "token" && (
          <div className="grid gap-2">
            <Label htmlFor={tokenId}>{t.tokenLabel}</Label>
            <Input
              id={tokenId}
              type="password"
              autoComplete="off"
              placeholder={t.tokenPlaceholder}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={error !== null}
            />
            <p className="text-xs text-muted-foreground">{t.scopes}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || (mode === "token" && token.trim() === "")} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {busy ? t.verifying : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Le jeton ne quitte le composant que par la RPC `connectGithub` ; il n'est ni journalisé ni gardé après fermeture (état local démonté).

- [x] **Step 5: Dialogue Figma**

`packages/ui/src/dialogs/integrations/FigmaConnectDialog.tsx` :

```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";

export function FigmaConnectDialog({ open, onOpenChange, onDone }: IntegrationDialogProps) {
  const t = fr.integrations.figma;
  const urlId = useId();
  const [url, setUrl] = useState(t.defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await client.rpc({ method: "configureFigma", url });
      if (s.state === "connected") onDone();
      else setError(s.error?.code === "MCP_FAILED" ? t.missingTools : t.unreachable);
    } catch (e) {
      setError(e instanceof KiboError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={urlId}>{t.url}</Label>
          <Input id={urlId} value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={error !== null} />
          <p className="text-xs text-muted-foreground">{t.urlHelp}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 6: Dialogues MCP**

`packages/ui/src/dialogs/integrations/McpServerDialog.tsx` : deux étapes dans un même `Dialog`.

```tsx
import { KiboError, type McpServerInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Globe, Plus, Terminal, X } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { ChoiceCard } from "../ChoiceCard";
import { type McpForm, slugId, toServerInput } from "./mcp-form";

type Props = { open: boolean; onOpenChange(open: boolean): void; onAdded(): void; takenIds: string[] };
type Pending = { server: McpServerInput; secrets: Record<string, string>; commandLine: string };

const EMPTY: McpForm = { transport: "stdio", id: "", name: "", command: "", args: "", env: [], url: "", bearer: "" };

export function McpServerDialog({ open, onOpenChange, onAdded, takenIds }: Props) {
  const t = fr.integrations.mcpServer;
  const ids = { name: useId(), id: useId(), command: useId(), args: useId(), url: useId(), bearer: useId() };
  const [form, setForm] = useState<McpForm>(EMPTY);
  const [idTouched, setIdTouched] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<McpForm>) => setForm((f) => ({ ...f, ...patch }));
  const id = idTouched ? form.id : slugId(form.name);

  const next = async () => {
    setError(null);
    if (takenIds.includes(id)) return setError(t.idTaken);
    const out = toServerInput({ ...form, id });
    if ("error" in out) return setError(out.error);
    try {
      const { commandLine } = await client.rpc({ method: "previewMcpServer", server: out.server });
      setPending({ ...out, commandLine });
    } catch (e) {
      setError(e instanceof KiboError ? e.detail : String(e));
    }
  };
  const confirm = async () => {
    if (!pending) return;
    try {
      await client.rpc({ method: "addMcpServer", server: pending.server, confirmedCommandLine: pending.commandLine, secrets: pending.secrets });
      setForm(EMPTY);
      setPending(null);
      onAdded();
    } catch (e) {
      setError(e instanceof KiboError ? e.detail : String(e));
    }
  };

  if (pending) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t.confirmTitle}</DialogTitle>
            <DialogDescription>{pending.server.transport === "stdio" ? t.confirmBody : t.confirmHttp}</DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">{pending.commandLine}</pre>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t.back}
            </Button>
            <Button onClick={() => void confirm()}>{t.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor={ids.name}>{t.name}</Label>
              <Input id={ids.name} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.id}>{t.id}</Label>
              <Input
                id={ids.id}
                className="font-mono"
                value={id}
                onChange={(e) => {
                  setIdTouched(true);
                  set({ id: e.target.value });
                }}
              />
              <p className="text-xs text-muted-foreground">{t.idHelp}</p>
            </div>
          </div>
          <RadioGroup value={form.transport} onValueChange={(v) => set({ transport: v === "http" ? "http" : "stdio" })} className="grid grid-cols-2 gap-2">
            <ChoiceCard value="stdio" icon={Terminal} title={t.stdio} description={t.stdioHelp} />
            <ChoiceCard value="http" icon={Globe} title={t.http} description={t.httpHelp} />
          </RadioGroup>
          {form.transport === "stdio" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor={ids.command}>{t.command}</Label>
                <Input id={ids.command} className="font-mono" value={form.command} onChange={(e) => set({ command: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={ids.args}>{t.args}</Label>
                <Textarea id={ids.args} className="font-mono" rows={3} value={form.args} onChange={(e) => set({ args: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t.argsHelp}</p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">{t.env}</legend>
                <p className="text-xs text-muted-foreground">{t.envHelp}</p>
                {form.env.map((e, i) => (
                  <div key={`env-${i}`} className="flex gap-2">
                    <Input aria-label={t.envName} className="font-mono" value={e.name} onChange={(ev) => set({ env: form.env.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} />
                    <Input aria-label={t.envValue} type="password" autoComplete="off" value={e.value} onChange={(ev) => set({ env: form.env.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)) })} />
                    <Button variant="ghost" size="icon" aria-label={fr.integrations.mcpServers.remove} onClick={() => set({ env: form.env.filter((_, j) => j !== i) })}>
                      <X aria-hidden className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set({ env: [...form.env, { name: "", value: "" }] })}>
                  <Plus aria-hidden className="size-4" />
                  {t.envAdd}
                </Button>
              </fieldset>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor={ids.url}>{t.url}</Label>
                <Input id={ids.url} className="font-mono" value={form.url} onChange={(e) => set({ url: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t.urlHelp}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={ids.bearer}>{t.bearer}</Label>
                <Input id={ids.bearer} type="password" autoComplete="off" value={form.bearer} onChange={(e) => set({ bearer: e.target.value })} />
              </div>
            </>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button onClick={() => void next()}>{t.next}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

(Les lignes de variables utilisent l'index comme clé : la liste n'est jamais réordonnée, seulement étendue ou réduite par un bouton de la ligne.)

`packages/ui/src/dialogs/integrations/McpServersDialog.tsx` (props `IntegrationDialogProps`) : `Dialog` (titre `mcpServers.title`, description `mcpServers.subtitle`) qui charge `listMcpServers` à l'ouverture ; une ligne par serveur : nom, `id` en monospace, badge `stdio`/`HTTP`, `tools(n)`, pastille d'état (vert `connected`, gris `idle`, rouge `error` + message), `Switch` « Activé » (`setMcpServerEnabled`, `aria-label` = `${enabled} ${name}`), bouton « Retirer » qui ouvre une confirmation (`AlertDialog` de `@kibo/sdk/ui/alert-dialog`, texte `removeConfirm(name)`, Annuler / Retirer destructif) puis `removeMcpServer` ; état vide `mcpServers.empty` ; bouton « Ajouter un serveur » qui ouvre `McpServerDialog` (`takenIds` = ids listés) et recharge la liste à `onAdded`. Toute erreur RPC s'affiche dans un `role="alert"` de la ligne concernée. `onDone` est appelé à la fermeture pour rafraîchir l'écran 16.

- [x] **Step 7: Enregistrer les dialogues**

`packages/ui/src/settings/integration-dialogs.ts` (remplace l'objet vide de la Task 10 ; les dialogues n'importent de ce fichier que des types, sans cycle à l'exécution) :

```ts
import { FigmaConnectDialog } from "../dialogs/integrations/FigmaConnectDialog";
import { GithubConnectDialog } from "../dialogs/integrations/GithubConnectDialog";
import { McpServersDialog } from "../dialogs/integrations/McpServersDialog";

export const INTEGRATION_DIALOGS: Partial<Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>> = {
  github: GithubConnectDialog,
  figma: FigmaConnectDialog,
  mcp: McpServersDialog,
};
```

- [x] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Comparer chaque dialogue à P2 à P5 en sombre et en clair.

```bash
git add packages/ui/src/dialogs/integrations packages/ui/src/settings/integration-dialogs.ts
git commit -m "feat(ui): dialogues de connexion"
```

---

### Task 12: Compte GitHub

Tâche à risque (secrets : jeton personnel, jeton de `gh`) : relecture `kibo-lead` en plus de `kibo-reviewer`.

Reprise de la relecture de la Task 3 : `createBunSecretStore` (`integrations/bun-secret-store.ts`) borne chaque appel au trousseau, `availability()` compris, par un délai (`KEYCHAIN_TIMEOUT_MS = 60_000`, injectable pour les tests) ; au-delà, `SECRET_STORE_UNAVAILABLE` (« keychain timed out »). Raison : sous Linux, un Secret Service verrouillé ou un lancement automatique de D-Bus peut ne jamais répondre, et la sonde `github` (sans délai dans le registre) bloquerait `listIntegrations`. Test : backend dont `get` ne se résout jamais, délai de 10 ms, `availability()` rend `{ ok: false }` et `get` rejette `SECRET_STORE_UNAVAILABLE`.

**Files:**
- Create: `packages/daemon/src/github/api.ts`, `packages/daemon/src/github/auth.ts`, `packages/daemon/src/github/handlers.ts`, `packages/daemon/src/github/github.test.ts`, `packages/daemon/src/github/handlers.test.ts`
- Modify: `packages/daemon/src/integrations/bootstrap.ts`, `packages/daemon/src/code/testing/fake-gh.ts` (sous-commande `auth token`), `packages/daemon/src/code/testing/fixture.test.ts`
- (`zod` 3.25.76 est déjà une dépendance directe du démon : `package.json` inchangé.)

**Interfaces:**
- Consumes: `IntegrationKit` (`settings`, `secrets`, `redactor`, `net`, `host.gh`), `IntegrationProbe`, `GhRunner`, `githubRepoOf` (Tasks 2, 8 ; `host.gh` est construit par la Task 2 sur `runGh(args, { cwd: home, env })` de `packages/daemon/src/code/run.ts`, qui lève `GH_UNAVAILABLE` si `gh` ne peut pas être lancé) ; `GITHUB_GRAPHQL`, `GithubConnectOptions`, `GithubRepo`, `GithubProject` (Task 1) ; faux GitHub (Task 6).
- Produces:
  - `type GithubApi = { rest<T>(method: "GET" | "POST" | "PATCH", path: string, schema: ZodType<T, ZodTypeDef, unknown>, body?: unknown): Promise<T>; raw(path: string, rules: InternalRule[], maxBytes: number): Promise<IntegrationResponse>; graphql<T>(query: string, variables: Record<string, unknown>, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T>; paginate<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>, maxPages: number): Promise<T[]> }`
  - `createGithubApi(deps: { fetch: IntegrationFetch; token(): Promise<string | null>; gate: RateLimitGate }): GithubApi`
  - `type GithubAccount = GithubCredentials & { options(): Promise<GithubConnectOptions>; connect(auth: { mode: "gh" } | { mode: "token"; token: string }): Promise<{ login: string }>; disconnect(): Promise<void>; verify(): Promise<string> }`
  - `createGithubAccount(deps: { settings: Settings; secrets: SecretStore; redactor: Redactor; gh: GhRunner; fetch: IntegrationFetch; now(): number }): GithubAccount`
  - `githubModule(kit: IntegrationKit, github: { account: GithubAccount; api: GithubApi }): IntegrationModule` (handlers `getGithubConnectOptions`, `connectGithub`, `listGithubRepos`, `listGithubProjects` ; sondes `github`, `github-issues`, `github-actions`)
  - `IntegrationKit.github: { account: GithubAccount; api: GithubApi }` ; `kit.hooks.secret` résout `github` par le compte (gh ou jeton)

- [x] **Step 1: Tests (échouent)**

`packages/daemon/src/github/github.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { migrateIntegrations } from "../integrations/db";
import { createMemorySecretStore, unavailableSecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { createGithubApi } from "./api";
import { createGithubAccount } from "./auth";

let gh: FakeGithub;
let host: FakeHost;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  host = createFakeHost();
  migrateIntegrations(host.db);
});
afterEach(() => {
  gh.stop();
  host.close();
});

function setup(secrets = createMemorySecretStore(createRedactor())) {
  const redactor = createRedactor();
  const fetch = createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`]) });
  const account = createGithubAccount({ settings: createSettings(host.db), secrets, redactor, gh: host.gh, fetch, now: host.now });
  const gate = createRateLimitGate(host.now);
  const api = createGithubApi({ fetch, token: () => account.token(), gate });
  return { account, api, secrets, redactor, gate };
}

describe("github account", () => {
  test("a personal token is verified, then stored in the keychain only", async () => {
    const { account, secrets } = setup();
    await expect(account.connect({ mode: "token", token: "ghp_wrong_000000" })).rejects.toThrow("REMOTE_REJECTED");
    expect(await secrets.has("github")).toBe(false);
    expect(await account.connect({ mode: "token", token: gh.token })).toEqual({ login: "adam" });
    expect(await secrets.get("github")).toBe(gh.token);
    expect(account.mode()).toBe("token");
    expect(account.login()).toBe("adam");
    expect(JSON.stringify(host.db.query("SELECT * FROM integration_settings").all())).not.toContain(gh.token);
    await account.disconnect();
    expect(await secrets.has("github")).toBe(false);
    expect(account.mode()).toBeNull();
  });

  test("gh mode reads the token on demand, caches it 10 minutes, never stores it", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const { account, secrets } = setup();
    expect(await account.options()).toEqual({ ghAvailable: true, ghLogin: "adam", mode: null });
    await account.connect({ mode: "gh" });
    expect(await secrets.has("github")).toBe(false);
    const before = host.ghCalls.length;
    expect(await account.token()).toBe(gh.token);
    expect(host.ghCalls.length).toBe(before);
    host.clock.now += 11 * 60_000;
    await account.token();
    expect(host.ghCalls.length).toBe(before + 1);
    expect(host.ghCalls.at(-1)).toEqual(["auth", "token"]);
  });

  test("gh missing: not available; keychain missing: explicit error", async () => {
    expect((await setup().account.options()).ghAvailable).toBe(false);
    const { account } = setup(unavailableSecretStore("locked"));
    await expect(account.connect({ mode: "token", token: gh.token })).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  });
});

describe("github api", () => {
  test("validates responses, paginates and refuses without a token", async () => {
    const { account, api } = setup();
    await expect(api.rest("GET", "/user", z.object({ login: z.string() }))).rejects.toThrow("NOT_CONNECTED");
    await account.connect({ mode: "token", token: gh.token });
    for (let i = 0; i < 3; i++) gh.addRepo(`adam/r${i}`);
    const repos = await api.paginate("/user/repos?per_page=2", z.object({ full_name: z.string() }), 5);
    expect(repos.map((r) => r.full_name)).toEqual(["adam/kibo", "adam/r0", "adam/r1", "adam/r2"]);
    await expect(api.rest("GET", "/user", z.object({ nope: z.string() }))).rejects.toThrow("REMOTE_REJECTED");
  });

  test("a paused gate refuses before calling github", async () => {
    const { account, api, gate } = setup();
    await account.connect({ mode: "token", token: gh.token });
    gate.observe(new Headers({ "x-ratelimit-remaining": "1", "x-ratelimit-reset": String(Math.floor(host.now() / 1000) + 60) }));
    const count = gh.requests.length;
    await expect(api.rest("GET", "/user", z.object({ login: z.string() }))).rejects.toThrow("RATE_LIMITED");
    expect(gh.requests.length).toBe(count);
  });
});
```

`packages/daemon/src/github/handlers.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { migrateIntegrations } from "../integrations/db";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createIntegrationRpc } from "../integrations/registry";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { createGithubApi } from "./api";
import { createGithubAccount } from "./auth";
import { githubModule } from "./handlers";

let gh: FakeGithub;
let host: FakeHost;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  host = createFakeHost();
  migrateIntegrations(host.db);
});
afterEach(() => {
  gh.stop();
  host.close();
});

function rpc() {
  const redactor = createRedactor();
  const aliases = parseTestOrigins([`api.github.com=${gh.url}`]);
  const gate = createRateLimitGate(host.now);
  const fetch = createIntegrationFetch({ aliases });
  const secrets = createMemorySecretStore(redactor);
  const settings = createSettings(host.db);
  const account = createGithubAccount({ settings, secrets, redactor, gh: host.gh, fetch, now: host.now });
  const api = createGithubApi({ fetch, token: () => account.token(), gate });
  const kit = {
    host,
    flags: { testOrigins: [], memorySecrets: true },
    redactor,
    events: createEventLog(host.db, redactor, host.now),
    settings,
    secrets,
    hooks: { aliases, observe: () => undefined, secret: async () => null, mcp: null, ciRuns: null },
    net: { fetch, gate, aliases },
    github: { account, api },
  };
  const m = githubModule(kit, kit.github);
  return createIntegrationRpc({ handlers: m.handlers ? [m.handlers] : [], probes: m.probes ?? [], stops: [] });
}

test("connect, statuses of the three github rows, repos and projects", async () => {
  const r = rpc();
  const statusOf = async (id: string) =>
    ((await r.handle({ method: "listIntegrations" })) as { id: string; state: string; account: string | null }[]).find((s) => s.id === id);
  expect((await statusOf("github"))?.state).toBe("disconnected");
  await r.handle({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  expect(await statusOf("github")).toMatchObject({ state: "connected", account: "adam" });
  expect((await statusOf("github-issues"))?.state).toBe("connected");
  expect((await statusOf("github-actions"))?.state).toBe("connected");
  host.remoteUrl = null;
  expect((await statusOf("github-actions"))?.state).toBe("disconnected");
  expect(host.events).toContainEqual({ type: "integrations" });
  gh.addRepo("adam/other");
  expect(await r.handle({ method: "listGithubRepos", query: "OTH" })).toEqual([{ fullName: "adam/other", private: false, description: null }]);
  gh.setProject({ nodeId: "PVT_1", owner: "adam", number: 3, title: "Roadmap", repo: "adam/kibo", fieldId: "F1", options: [{ id: "O1", name: "Todo" }] });
  expect(await r.handle({ method: "listGithubProjects", repo: "adam/kibo" })).toEqual([
    { owner: "adam", number: 3, nodeId: "PVT_1", title: "Roadmap", statusField: { id: "F1", options: [{ id: "O1", name: "Todo" }] } },
  ]);
  await r.handle({ method: "disconnectIntegration", id: "github" });
  expect((await statusOf("github"))?.state).toBe("disconnected");
});
```

Run: `bun test packages/daemon/src/github` — Expected: FAIL.

- [x] **Step 2: Implémenter `api.ts`**

```ts
import { githubError, KiboError } from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import { z } from "zod";
import { GITHUB_API, GITHUB_RULES } from "../integrations/net";
import type { RateLimitGate } from "../integrations/rate-limit";
import type { IntegrationFetch, IntegrationResponse, InternalRule } from "../integrations/types";

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;
export type GithubApi = {
  rest<T>(method: "GET" | "POST" | "PATCH", path: string, schema: Schema<T>, body?: unknown): Promise<T>;
  raw(path: string, rules: InternalRule[], maxBytes: number): Promise<IntegrationResponse>;
  graphql<T>(query: string, variables: Record<string, unknown>, schema: Schema<T>): Promise<T>;
  paginate<T>(path: string, schema: Schema<T>, maxPages: number): Promise<T[]>;
};

const decoder = new TextDecoder();
const GraphqlEnvelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

function nextLink(headers: Headers): string | null {
  const m = /<([^>]+)>;\s*rel="next"/.exec(headers.get("link") ?? "");
  return m?.[1] ?? null;
}

export function createGithubApi(deps: {
  fetch: IntegrationFetch;
  token(): Promise<string | null>;
  gate: RateLimitGate;
}): GithubApi {
  const send = async (url: string, method: "GET" | "POST" | "PATCH", body: unknown, rules: InternalRule[], maxBytes?: number) => {
    const until = deps.gate.blockedUntil();
    if (until !== null) throw new KiboError("RATE_LIMITED", `github paused until ${new Date(until).toISOString()}`);
    const token = await deps.token();
    if (!token) throw new KiboError("NOT_CONNECTED", "github account not connected");
    return deps.fetch(
      url,
      {
        method,
        bearer: token,
        headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        maxBytes,
      },
      rules,
    );
  };
  const parse = <T>(res: IntegrationResponse, schema: Schema<T>): T => {
    const text = decoder.decode(res.body);
    if (res.status < 200 || res.status >= 300) throw githubError(res.status, (n) => res.headers.get(n), text);
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new KiboError("REMOTE_REJECTED", `unexpected github response: ${parsed.error.issues[0]?.message ?? ""}`);
    return parsed.data;
  };
  const api: GithubApi = {
    async rest(method, path, schema, body) {
      return parse(await send(`https://${GITHUB_API}${path}`, method, body, GITHUB_RULES), schema);
    },
    raw: (path, rules, maxBytes) => send(`https://${GITHUB_API}${path}`, "GET", undefined, rules, maxBytes),
    async graphql(query, variables, schema) {
      const env = parse(await send(`https://${GITHUB_API}/graphql`, "POST", { query, variables }, GITHUB_RULES), GraphqlEnvelope);
      if (env.errors?.length) throw new KiboError("REMOTE_REJECTED", `github graphql: ${env.errors[0]?.message ?? ""}`);
      const parsed = schema.safeParse(env.data);
      if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "unexpected github graphql response");
      return parsed.data;
    },
    paginate: (path, schema, maxPages) =>
      paginateWith((u) => send(u, "GET", undefined, GITHUB_RULES), parse, path, schema, maxPages),
  };
  return api;
}

async function paginateWith<T>(
  send: (url: string) => Promise<IntegrationResponse>,
  parse: <U>(res: IntegrationResponse, schema: Schema<U>) => U,
  path: string,
  schema: Schema<T>,
  maxPages: number,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `https://${GITHUB_API}${path}`;
  for (let page = 0; url !== null && page < maxPages; page++) {
    const res = await send(url);
    out.push(...parse(res, z.array(schema)));
    const next = nextLink(res.headers);
    url = next === null ? null : `https://${GITHUB_API}${new URL(next).pathname}${new URL(next).search}`;
  }
  return out;
}
```

Le lien `next` est réécrit vers l'hôte logique `api.github.com` : une origine de test ou un hôte inattendu dans l'en-tête `Link` ne change jamais la destination.

- [x] **Step 3: Implémenter `auth.ts`**

```ts
import { type GithubConnectOptions, githubError, KiboError } from "@kibo/schema";
import { z } from "zod";
import { GITHUB_API, GITHUB_RULES } from "../integrations/net";
import type { Redactor } from "../integrations/redact";
import type { Settings } from "../integrations/settings";
import type { GhRunner, GithubCredentials, IntegrationFetch, SecretStore } from "../integrations/types";

export type GithubAccount = GithubCredentials & {
  options(): Promise<GithubConnectOptions>;
  connect(auth: { mode: "gh" } | { mode: "token"; token: string }): Promise<{ login: string }>;
  disconnect(): Promise<void>;
  verify(): Promise<string>;
};

const GH_TTL_MS = 10 * 60_000;
const User = z.object({ login: z.string().min(1) });

async function runGhToken(gh: GhRunner): Promise<{ code: number; stdout: string } | null> {
  try {
    return await gh(["auth", "token"]);
  } catch (e) {
    if (e instanceof KiboError && e.code === "GH_UNAVAILABLE") return null;
    throw e;
  }
}

export function createGithubAccount(deps: {
  settings: Settings;
  secrets: SecretStore;
  redactor: Redactor;
  gh: GhRunner;
  fetch: IntegrationFetch;
  now(): number;
}): GithubAccount {
  let ghCache: { token: string; at: number } | null = null;
  const ghToken = async (): Promise<string | null> => {
    if (ghCache && deps.now() - ghCache.at < GH_TTL_MS) return ghCache.token;
    const r = await runGhToken(deps.gh);
    const token = r !== null && r.code === 0 ? r.stdout.trim() : "";
    if (!token) {
      ghCache = null;
      return null;
    }
    deps.redactor.add(token);
    ghCache = { token, at: deps.now() };
    return token;
  };
  const loginOf = async (token: string): Promise<string> => {
    const res = await deps.fetch(`https://${GITHUB_API}/user`, { bearer: token }, GITHUB_RULES);
    const text = new TextDecoder().decode(res.body);
    if (res.status !== 200) throw githubError(res.status, (n) => res.headers.get(n), text);
    return User.parse(JSON.parse(text)).login;
  };
  const mode = (): "gh" | "token" | null => {
    const m = deps.settings.get("github.mode");
    return m === "gh" || m === "token" ? m : null;
  };
  const account: GithubAccount = {
    mode,
    login: () => (mode() === null ? null : deps.settings.get("github.login")),
    async token() {
      const m = mode();
      if (m === "gh") return ghToken();
      if (m === "token") return deps.secrets.get("github");
      return null;
    },
    async options() {
      const token = await ghToken();
      return { ghAvailable: token !== null, ghLogin: token === null ? null : await loginOf(token), mode: mode() };
    },
    async connect(auth) {
      if (auth.mode === "gh") {
        ghCache = null;
        const token = await ghToken();
        if (!token) throw new KiboError("NOT_CONNECTED", "gh is not logged in");
        const login = await loginOf(token);
        if (mode() === "token") await deps.secrets.delete("github");
        deps.settings.set("github.mode", "gh");
        deps.settings.set("github.login", login);
        return { login };
      }
      deps.redactor.add(auth.token);
      const login = await loginOf(auth.token);
      await deps.secrets.set("github", auth.token);
      deps.settings.set("github.mode", "token");
      deps.settings.set("github.login", login);
      return { login };
    },
    async disconnect() {
      if (mode() === "token") await deps.secrets.delete("github");
      ghCache = null;
      deps.settings.delete("github.mode");
      deps.settings.delete("github.login");
    },
    async verify() {
      const token = await account.token();
      if (!token) throw new KiboError("NOT_CONNECTED", "github account not connected");
      const login = await loginOf(token);
      deps.settings.set("github.login", login);
      return login;
    },
  };
  return account;
}
```

- [x] **Step 4: Implémenter `handlers.ts`**

```ts
import { GITHUB_GRAPHQL, type GithubProject, KiboError } from "@kibo/schema";
import { z } from "zod";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import { githubRepoOf } from "../integrations/github-remote";
import { baseStatus } from "../integrations/probes";
import type { GithubApi } from "./api";
import type { GithubAccount } from "./auth";

const Repo = z.object({ full_name: z.string(), private: z.boolean(), description: z.string().nullable() });
const Projects = z.object({
  repository: z
    .object({
      projectsV2: z.object({
        nodes: z.array(
          z
            .object({
              id: z.string(),
              number: z.number().int(),
              title: z.string(),
              owner: z.object({ login: z.string() }),
              field: z.object({ id: z.string(), options: z.array(z.object({ id: z.string(), name: z.string() })) }).nullable().optional(),
            })
            .nullable(),
        ),
      }),
    })
    .nullable(),
});

export function githubModule(kit: IntegrationKit, github: { account: GithubAccount; api: GithubApi }): IntegrationModule {
  const { account, api } = github;
  const connected = () => account.mode() !== null;
  const resumeAt = () => kit.net.gate.blockedUntil();
  const anyRepo = async () => {
    for (const p of kit.host.projects()) if (await githubRepoOf(kit.host, p.id)) return true;
    return false;
  };
  const changed = () => kit.host.broadcast({ type: "integrations" });
  return {
    handlers: {
      getGithubConnectOptions: () => account.options(),
      async connectGithub(req) {
        const out = await account.connect(req.auth);
        kit.events.log("github", "info", `connected as ${out.login} (${req.auth.mode})`);
        changed();
        return out;
      },
      async listGithubRepos(req) {
        const repos = await api.paginate("/user/repos?per_page=100&sort=updated", Repo, 5);
        const q = req.query.trim().toLowerCase();
        return repos
          .filter((r) => q === "" || r.full_name.toLowerCase().includes(q))
          .slice(0, 50)
          .map((r) => ({ fullName: r.full_name, private: r.private, description: r.description }));
      },
      async listGithubProjects(req) {
        const [owner, name] = req.repo.split("/");
        const data = await api.graphql(GITHUB_GRAPHQL.listProjects, { owner, name }, Projects);
        if (!data.repository) throw new KiboError("REMOTE_NOT_FOUND", `repository ${req.repo} not found`);
        return data.repository.projectsV2.nodes.flatMap((n): GithubProject[] =>
          n === null
            ? []
            : [{ owner: n.owner.login, number: n.number, nodeId: n.id, title: n.title, statusField: n.field ?? null }],
        );
      },
    },
    probes: [
      {
        id: "github",
        status: async () =>
          connected() ? { ...baseStatus("github", "connected"), account: account.login(), resumeAt: resumeAt() } : baseStatus("github", "disconnected"),
        test: async () => ({ ...baseStatus("github", "connected"), account: await account.verify(), resumeAt: resumeAt() }),
        async disconnect() {
          await account.disconnect();
          kit.events.log("github", "info", "disconnected");
          changed();
        },
      },
      {
        id: "github-issues",
        status: async () => (connected() ? { ...baseStatus("github-issues", "connected"), resumeAt: resumeAt() } : baseStatus("github-issues", "disconnected")),
        test: async () => {
          await account.verify();
          return { ...baseStatus("github-issues", "connected"), resumeAt: resumeAt() };
        },
      },
      {
        id: "github-actions",
        status: async () =>
          connected() && (await anyRepo()) ? { ...baseStatus("github-actions", "connected"), resumeAt: resumeAt() } : baseStatus("github-actions", "disconnected"),
      },
    ],
  };
}
```

`gh` absent (échec de lancement, `GH_UNAVAILABLE` de `runGh`) équivaut à « gh non connecté » (`ghAvailable: false`), comme `ghStatus` de `code/remote-ops.ts` ; toute autre erreur remonte.

- [x] **Step 5: Faux `gh` : `auth token`**

`packages/daemon/src/code/testing/fake-gh.ts` (faux binaire de la phase 3, utilisé par `KIBO_GH` en E2E) : avant le cas `auth status`,

```ts
if (args[0] === "auth" && args[1] === "token") {
  const token = process.env.FAKE_GH_TOKEN;
  if (!token) {
    process.stderr.write("no oauth token found for github.com\n");
    process.exit(1);
  }
  process.stdout.write(`${token}\n`);
  process.exit(0);
}
```

Test ajouté à `packages/daemon/src/code/testing/fixture.test.ts` (harnais réel : `installFakeGh(fx.dir)` rend l'env `KIBO_GH`, `FAKE_GH_STATE`, `FAKE_GH_LOG`) : `runGh(["auth", "token"], { cwd: fx.dir, env: { ...installFakeGh(fx.dir), FAKE_GH_TOKEN: "ghp_TESTSECRET0123456789abcdefghijklmn" } })` rend `code 0` et le jeton suivi d'un saut de ligne ; sans `FAKE_GH_TOKEN`, `code 1`. Le parcours E2E (Task 23) s'en sert pour le mode « Utiliser gh ».

- [x] **Step 6: Amorçage**

`packages/daemon/src/integrations/bootstrap.ts` : `IntegrationKit` gagne `github: { account: GithubAccount; api: GithubApi }`. Les dépendances sont créées en variables locales **avant** le `kit` (aucun champ optionnel, aucune affectation après coup) :

```ts
  const settings = createSettings(host.db);
  const account = createGithubAccount({ settings, secrets, redactor, gh: host.gh, fetch: net.fetch, now: host.now });
  const github = { account, api: createGithubApi({ fetch: net.fetch, token: () => account.token(), gate: net.gate }) };
  const secret: SecretResolver = (name) => (name === "github" ? account.token() : secrets.get(name));
```

puis `settings`, `github` et `hooks: { aliases: net.aliases, observe, secret, mcp: null, ciRuns: null }` dans le `kit`, et `githubModule(kit, kit.github)` dans `modules`.

- [x] **Step 7: Vérifier et commiter**

Run: `bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/code/testing/fake-gh.ts packages/daemon/src/code/testing/fixture.test.ts
git commit -m "test(daemon): faux gh, auth token"
git add packages/daemon/src/github packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): compte GitHub"
```

---

### Task 13: Adaptateur GitHub Issues (composant intégré)

Composant sans UI (`kind: "adapter"`), écrit avec le SDK public : il traduit, il ne lit ni n'écrit aucun ticket. Tout objet distant est validé par Zod avant usage.

État réel (phase 4) : un composant intégré est un paquet `components/<id>/` (`package.json` `@kibo/component-<id>`, `tsconfig.json` qui étend `../../tsconfig.base.json` avec des `references` vers `schema` et `sdk`, `kibo.component.json`, `src/index.ts` qui exporte `manifest = ComponentManifest.parse(manifestJson)`), enregistré côté UI dans `BUILTIN_COMPONENTS` (`packages/ui/src/registry.ts`). `BUILTIN_IDS = ["kanban", "tickets", "graph", "notes"]` (`packages/schema/src/component.ts`) est la liste des intégrés **avec UI** : `registry-listing.ts` en tire les lignes « Intégré » de l'écran 6, et `packages/ui/src/registry.test.ts` exige `BUILTIN_COMPONENTS` = `BUILTIN_IDS`. Un adaptateur sans UI n'y entre donc pas : cette tâche ajoute `BUILTIN_ADAPTER_IDS = ["github-issues"]` et étend `isBuiltinId` aux deux listes (identifiant réservé : `scaffold`, `validateComponent` et l'approbation du registre refusent `github-issues` à un composant tiers), sans rien ajouter au catalogue (écran 3) ni à la page Composants (écran 6). Le runtime de backend de la phase 4 (`components/runtime-core.ts`) lit l'export CommonJS nommé `server` de `server.js` (`evaluateCjs(code.server, "server")`) et appelle chaque action avec `(ctx: ServerContext, input)` ; `ctx.fetch` renvoie un `FetchResponse` dont les noms d'en-têtes sont en minuscules (`readProxiedBody`, `components/net-proxy-body.ts`). Le SDK est importé par le sous-chemin `@kibo/sdk/adapter` (ajouté ici à `packages/sdk/package.json`) : l'index `@kibo/sdk` tire React et les composants d'interface, inutiles dans le Worker.

**Files:**
- Create: `components/github-issues/kibo.component.json`, `components/github-issues/package.json`, `components/github-issues/tsconfig.json`
- Create: `components/github-issues/src/{remote.ts,map.ts,cursor.ts,rest.ts,project.ts,adapter.ts,server.ts,index.ts}`, `components/github-issues/src/{map.test.ts,adapter.test.ts}`
- Modify: `package.json` racine (script `typecheck` : `components/github-issues`), `packages/schema/src/component.ts` (`BUILTIN_ADAPTER_IDS`, `isBuiltinId`), `packages/sdk/package.json` (export `"./adapter": "./src/adapter.ts"`), `bun.lock` (paquet de l'espace de travail)

**Interfaces:**
- Consumes: `defineAdapter`, `adapterActions`, `AdapterContext` (Task 1, `packages/sdk/src/adapter.ts`) ; `defineServer` (`packages/sdk/src/server.ts`, phase 4) ; `isBuiltinId`, `BUILTIN_IDS` (`packages/schema/src/component.ts`, phase 4) ; `GITHUB_GRAPHQL`, `githubError`, `remoteStatusId`, `BindingConfig`, `GithubIssueRef`, `PushOp` (Task 1).
- Produces:
  - `GhIssue` (Zod) = `{ nodeId; number; title; body; closed; updatedAt; url (https); repo; labels: string[]; optionId: string | null }`
  - `githubIssuesAdapter: Adapter<GhIssue, BindingConfig>` ; `server = defineServer({ actions: adapterActions(githubIssuesAdapter) })` (export nommé `server` lu par le runtime de la phase 4 ; actions `adapter.pull`, `adapter.push`)
  - `BUILTIN_ADAPTER_IDS = ["github-issues"] as const` ; `isBuiltinId(id)` vrai pour `BUILTIN_IDS` et `BUILTIN_ADAPTER_IDS` (`BUILTIN_IDS` inchangé)
  - sous-chemin `@kibo/sdk/adapter`
  - curseur opaque : `{"mode":"rest","since":…,"page":n}` ou `{"mode":"project","since":…,"after":…,"max":…}`
  - issues créées : titre, corps, **libellés du filtre de la liaison** (pour rester dans son périmètre), puis fermeture si `closed`, puis ajout au Project et statut si la correspondance existe

- [x] **Step 1: Paquet**

`components/github-issues/kibo.component.json` :

```json
{
  "id": "github-issues",
  "version": "1.0.0",
  "kind": "adapter",
  "title": "GitHub Issues",
  "description": "Synchronise les tickets avec les issues et un Project GitHub",
  "reads": ["ticket", "status"],
  "writes": [],
  "net": ["api.github.com"],
  "secrets": [{ "name": "github", "hosts": ["api.github.com"] }]
}
```

`components/github-issues/package.json` :

```json
{
  "name": "@kibo/component-github-issues",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./server": "./src/server.ts" },
  "dependencies": { "@kibo/schema": "workspace:*", "@kibo/sdk": "workspace:*", "zod": "3.25.76" }
}
```

`components/github-issues/tsconfig.json` (celui de `components/kanban`, sans DOM ni `paths` d'interface) :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": ".", "lib": ["ES2022"] },
  "include": ["src", "kibo.component.json"],
  "references": [{ "path": "../../packages/schema" }, { "path": "../../packages/sdk" }]
}
```

`packages/sdk/package.json`, `exports` : ajouter `"./adapter": "./src/adapter.ts"` (à côté de `"./server"`).

`packages/schema/src/component.ts` :

```ts
export const BUILTIN_IDS = ["kanban", "tickets", "graph", "notes"] as const;
export const BUILTIN_ADAPTER_IDS = ["github-issues"] as const;
const BUILTIN_ANY: readonly string[] = [...BUILTIN_IDS, ...BUILTIN_ADAPTER_IDS];
export const isBuiltinId = (id: string): boolean => BUILTIN_ANY.includes(id);
```

- [x] **Step 2: Test du mapping (échoue)**

`components/github-issues/src/map.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { BindingConfig } from "@kibo/schema";
import { fromItem, fromRest, toFields, toRef } from "./map";

const rest = {
  node_id: "I_1",
  number: 1,
  title: "Titre  ",
  body: "a\r\nb",
  state: "open" as const,
  updated_at: "2026-09-26T10:00:00Z",
  html_url: "https://github.com/adam/kibo/issues/1",
  labels: [{ name: "bug" }, "ui"],
};
const plain: BindingConfig = { repo: "adam/kibo", project: null, importClosed: false, labels: [] };
const withProject: BindingConfig = {
  ...plain,
  project: { owner: "adam", number: 1, nodeId: "PVT", statusFieldId: "F", statusMap: { todo: "O1", in_progress: "O2", done: "O3" } },
};

describe("github issue mapping", () => {
  test("normalizes title, body and labels", () => {
    expect(fromRest("adam/kibo", rest)).toEqual({
      nodeId: "I_1",
      number: 1,
      title: "Titre",
      body: "a\nb",
      closed: false,
      updatedAt: "2026-09-26T10:00:00Z",
      url: "https://github.com/adam/kibo/issues/1",
      repo: "adam/kibo",
      labels: ["bug", "ui"],
      optionId: null,
    });
    expect(fromRest("adam/kibo", { ...rest, body: null }).body).toBe("");
  });

  test("statuses: closed is done, project options map back", () => {
    const issue = fromRest("adam/kibo", rest);
    expect(toFields({ ...issue, closed: true }, plain)).toMatchObject({ statusId: "done", closed: true });
    expect(toFields(issue, plain).statusId).toBe("todo");
    expect(toFields({ ...issue, optionId: "O2" }, withProject).statusId).toBe("in_progress");
    expect(toFields({ ...issue, optionId: "O9" }, withProject).statusId).toBe("todo");
  });

  test("project items: status of the configured field, latest update wins, drafts are skipped", () => {
    const node = {
      id: "PVTI_1",
      updatedAt: "2026-09-26T11:00:00Z",
      fieldValues: { nodes: [{}, { optionId: "O9", field: { id: "OTHER" } }, { optionId: "O2", field: { id: "F" } }] },
      content: {
        id: "I_1",
        number: 1,
        title: "T",
        body: "",
        state: "OPEN" as const,
        updatedAt: "2026-09-26T10:00:00Z",
        url: "https://github.com/adam/kibo/issues/1",
        repository: { nameWithOwner: "adam/kibo" },
        labels: { nodes: [] },
      },
    };
    expect(fromItem(node, "F")).toMatchObject({ optionId: "O2", updatedAt: "2026-09-26T11:00:00Z", closed: false });
    expect(fromItem({ ...node, content: {} }, "F")).toBeNull();
  });

  test("refs point to the binding", () => {
    expect(toRef(fromRest("adam/kibo", rest), "b1")).toEqual({
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 1,
      nodeId: "I_1",
      url: "https://github.com/adam/kibo/issues/1",
    });
  });
});
```

Run: `bun test components/github-issues/src/map.test.ts` — Expected: FAIL.

- [x] **Step 3: `remote.ts`, `map.ts`, `cursor.ts`**

`components/github-issues/src/remote.ts` :

```ts
import { RepoSlug } from "@kibo/schema";
import { z } from "zod";

export const GhIssue = z.object({
  nodeId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string(),
  closed: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }),
  url: z.string().url().refine((u) => u.startsWith("https://"), "https only"),
  repo: RepoSlug,
  labels: z.array(z.string()),
  optionId: z.string().nullable(),
});
export type GhIssue = z.infer<typeof GhIssue>;

export const RestIssue = z.object({
  node_id: z.string(),
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  updated_at: z.string(),
  html_url: z.string(),
  labels: z.array(z.union([z.string(), z.object({ name: z.string() })])),
  pull_request: z.unknown().optional(),
  user: z.object({ login: z.string() }).nullable().optional(),
});
export type RestIssue = z.infer<typeof RestIssue>;

const FieldValue = z.object({ optionId: z.string().optional(), field: z.object({ id: z.string().optional() }).optional() });
export const ItemContent = z.object({
  id: z.string().optional(),
  number: z.number().int().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["OPEN", "CLOSED"]).optional(),
  updatedAt: z.string().optional(),
  url: z.string().optional(),
  repository: z.object({ nameWithOwner: z.string() }).optional(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }).optional(),
});
export const ProjectItem = z.object({
  id: z.string(),
  updatedAt: z.string(),
  fieldValues: z.object({ nodes: z.array(FieldValue) }),
  content: ItemContent.nullable(),
});
export type ProjectItem = z.infer<typeof ProjectItem>;
export const ProjectItemsData = z.object({
  node: z
    .object({
      items: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(ProjectItem),
      }),
    })
    .nullable(),
});
export const IssueItemsData = z.object({
  repository: z
    .object({
      issue: z
        .object({
          id: z.string(),
          projectItems: z.object({
            nodes: z.array(z.object({ id: z.string(), project: z.object({ id: z.string() }), fieldValues: z.object({ nodes: z.array(FieldValue) }) })),
          }),
        })
        .nullable(),
    })
    .nullable(),
});
export const AddItemData = z.object({ addProjectV2ItemById: z.object({ item: z.object({ id: z.string() }) }) });
export const SetStatusData = z.object({ updateProjectV2ItemFieldValue: z.object({ projectV2Item: z.object({ id: z.string() }) }) });
```

`components/github-issues/src/map.ts` :

```ts
import { type BindingConfig, type GithubIssueRef, remoteStatusId, type SyncedFields } from "@kibo/schema";
import type { GhIssue, ProjectItem, RestIssue } from "./remote";

const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
export const later = (a: string, b: string) => (a > b ? a : b);

export function optionOf(values: ProjectItem["fieldValues"]["nodes"], fieldId: string): string | null {
  return values.find((v) => v.field?.id === fieldId && v.optionId !== undefined)?.optionId ?? null;
}

export function fromRest(repo: string, r: RestIssue): GhIssue {
  return {
    nodeId: r.node_id,
    number: r.number,
    title: r.title.trim(),
    body: normalize(r.body ?? ""),
    closed: r.state === "closed",
    updatedAt: r.updated_at,
    url: r.html_url,
    repo,
    labels: r.labels.map((l) => (typeof l === "string" ? l : l.name)),
    optionId: null,
  };
}

export function fromItem(item: ProjectItem, fieldId: string): GhIssue | null {
  const c = item.content;
  if (!c?.id || c.number === undefined || !c.title || !c.state || !c.updatedAt || !c.url || !c.repository) return null;
  return {
    nodeId: c.id,
    number: c.number,
    title: c.title.trim(),
    body: normalize(c.body ?? ""),
    closed: c.state === "CLOSED",
    updatedAt: later(c.updatedAt, item.updatedAt),
    url: c.url,
    repo: c.repository.nameWithOwner,
    labels: c.labels?.nodes.map((l) => l.name) ?? [],
    optionId: optionOf(item.fieldValues.nodes, fieldId),
  };
}

export function toFields(r: GhIssue, c: BindingConfig): SyncedFields {
  const statusId = remoteStatusId(r.closed, r.optionId, c.project?.statusMap ?? null);
  return { title: r.title, description: r.body, statusId, closed: statusId === "done" };
}

export function toRef(r: GhIssue, bindingId: string): GithubIssueRef {
  return { kind: "github_issue", bindingId, repo: r.repo, number: r.number, nodeId: r.nodeId, url: r.url };
}
```

`components/github-issues/src/cursor.ts` :

```ts
import { z } from "zod";

export const RestCursor = z.object({ mode: z.literal("rest"), since: z.string().nullable(), page: z.number().int().positive() });
export const ProjectCursor = z.object({
  mode: z.literal("project"),
  since: z.string().nullable(),
  after: z.string().nullable(),
  max: z.string().nullable(),
});
export type RestCursor = z.infer<typeof RestCursor>;
export type ProjectCursor = z.infer<typeof ProjectCursor>;

export function readRestCursor(raw: string | null): RestCursor {
  const parsed = raw === null ? null : RestCursor.safeParse(JSON.parse(raw));
  return parsed?.success ? parsed.data : { mode: "rest", since: null, page: 1 };
}

export function readProjectCursor(raw: string | null): ProjectCursor {
  const parsed = raw === null ? null : ProjectCursor.safeParse(JSON.parse(raw));
  return parsed?.success ? parsed.data : { mode: "project", since: null, after: null, max: null };
}
```

(Un curseur d'un autre mode — liaison dont on a ajouté ou retiré le Project — repart de zéro : les éléments déjà connus sont reconnus par le moteur, rien n'est dupliqué.)

Run: `bun test components/github-issues/src/map.test.ts` — Expected: PASS.

- [x] **Step 4: Test de l'adaptateur (échoue)**

`components/github-issues/src/adapter.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { BUILTIN_IDS, type BindingConfig, GITHUB_GRAPHQL, isBuiltinId } from "@kibo/schema";
import { adapterActions } from "@kibo/sdk/adapter";
import { githubIssuesAdapter } from "./adapter";
import { manifest } from "./index";

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
type Handler = (url: URL, body: unknown) => Reply;
type Call = { method: string; path: string; body: unknown };

function fakeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    const body: unknown = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: u.pathname + u.search, body });
    const gql = u.pathname === "/graphql" && typeof body === "object" && body !== null && "query" in body ? body.query : null;
    const op = gql ? Object.entries(GITHUB_GRAPHQL).find(([, q]) => q === gql)?.[0] : undefined;
    const key = op ? `GQL ${op}` : `${method} ${u.pathname}`;
    const h = routes[key];
    if (!h) return { status: 404, headers: {}, body: '{"message":"Not Found"}' };
    const r = h(u, body);
    return { status: r.status, headers: r.headers ?? {}, body: JSON.stringify(r.body) };
  };
  return { fetch, calls };
}

const restIssue = (n: number, patch: Record<string, unknown> = {}) => ({
  node_id: `I_${n}`,
  number: n,
  title: `Issue ${n}`,
  body: null,
  state: "open",
  updated_at: "2026-09-26T10:00:00Z",
  html_url: `https://github.com/adam/kibo/issues/${n}`,
  labels: [],
  user: { login: "adam" },
  ...patch,
});
const plain: BindingConfig = { repo: "adam/kibo", project: null, importClosed: false, labels: ["kibo"] };
const withProject: BindingConfig = {
  ...plain,
  project: { owner: "adam", number: 1, nodeId: "PVT", statusFieldId: "F", statusMap: { todo: "O1", in_progress: "O2", done: "O3" } },
};
const actions = adapterActions(githubIssuesAdapter);
const ctx = (config: BindingConfig, fetch: ReturnType<typeof fakeFetch>["fetch"]) => ({ instanceId: "binding:b1", config, fetch });

test("the manifest is a builtin adapter, absent from the UI built-ins", () => {
  expect(manifest.kind).toBe("adapter");
  expect(isBuiltinId(manifest.id)).toBe(true);
  expect(BUILTIN_IDS).not.toContain(manifest.id);
});

describe("pull (rest)", () => {
  test("skips pull requests and walks same-second pages without losing issues", async () => {
    const all = Array.from({ length: 150 }, (_, i) => restIssue(i + 1));
    const f = fakeFetch({
      "GET /repos/adam/kibo/issues": (u) => {
        const page = Number(u.searchParams.get("page"));
        const slice = all.slice((page - 1) * 100, page * 100);
        return { status: 200, body: page === 1 ? [...slice, restIssue(999, { pull_request: {} })] : slice };
      },
    });
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const page = await actions["adapter.pull"](ctx(plain, f.fetch), { cursor });
      for (const item of page.items) seen.add(item.remoteId);
      cursor = page.cursor;
      if (!page.more) break;
    }
    expect(seen.size).toBe(150);
    expect(seen.has("999")).toBe(false);
    expect(f.calls[0]?.path).toContain("state=all");
    expect(f.calls[0]?.path).toContain("direction=asc");
  });
});

describe("pull (project)", () => {
  test("keeps items of the repo updated since the cursor, with their status", async () => {
    const item = (n: number, repo: string, at: string, option: string | null) => ({
      id: `PVTI_${n}`,
      updatedAt: at,
      fieldValues: { nodes: option ? [{ optionId: option, field: { id: "F" } }] : [] },
      content: {
        id: `I_${n}`,
        number: n,
        title: `T${n}`,
        body: "",
        state: "OPEN",
        updatedAt: "2026-09-26T09:00:00Z",
        url: `https://github.com/${repo}/issues/${n}`,
        repository: { nameWithOwner: repo },
        labels: { nodes: [] },
      },
    });
    const f = fakeFetch({
      "GQL projectItems": (_u, body) => {
        const after = (body as { variables: { after: string | null } }).variables.after;
        const nodes = after === null ? [item(1, "adam/kibo", "2026-09-26T10:00:00Z", "O2"), item(2, "adam/other", "2026-09-26T10:00:00Z", null)] : [item(3, "adam/kibo", "2026-09-26T08:00:00Z", null)];
        return { status: 200, body: { data: { node: { items: { pageInfo: { hasNextPage: after === null, endCursor: "c1" }, nodes } } } } };
      },
    });
    const first = await actions["adapter.pull"](ctx(withProject, f.fetch), { cursor: JSON.stringify({ mode: "project", since: "2026-09-26T09:30:00Z", after: null, max: null }) });
    expect(first.items.map((i) => [i.remoteId, i.fields.statusId])).toEqual([["1", "in_progress"]]);
    expect(first.more).toBe(true);
    const second = await actions["adapter.pull"](ctx(withProject, f.fetch), { cursor: first.cursor });
    expect(second.items).toEqual([]);
    expect(second.more).toBe(false);
    expect(JSON.parse(second.cursor ?? "{}")).toEqual({ mode: "project", since: "2026-09-26T10:00:00Z", after: null, max: null });
  });
});

describe("push", () => {
  test("create carries the filter labels, closes and sets the project status", async () => {
    const created = restIssue(7, { title: "Nouveau" });
    const f = fakeFetch({
      "POST /repos/adam/kibo/issues": () => ({ status: 201, body: created }),
      "PATCH /repos/adam/kibo/issues/7": () => ({ status: 200, body: { ...created, state: "closed" } }),
      "GQL addItem": () => ({ status: 200, body: { data: { addProjectV2ItemById: { item: { id: "PVTI_7" } } } } }),
      "GQL setStatus": () => ({ status: 200, body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_7" } } } } }),
    });
    const out = await actions["adapter.push"](ctx(withProject, f.fetch), {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "Nouveau", description: "", statusId: "done", closed: true },
      since: null,
    });
    expect(f.calls[0]).toMatchObject({ method: "POST", body: { title: "Nouveau", body: "", labels: ["kibo"] } });
    expect(f.calls.map((c) => c.method)).toEqual(["POST", "PATCH", "POST", "POST"]);
    expect(out.fields).toMatchObject({ statusId: "done", closed: true });
    expect(out.ref.number).toBe(7);
  });

  test("a retried create adopts the issue created by a previous attempt", async () => {
    const f = fakeFetch({
      "GET /user": () => ({ status: 200, body: { login: "adam" } }),
      "GET /repos/adam/kibo/issues": (u) => {
        expect(u.searchParams.get("creator")).toBe("adam");
        expect(u.searchParams.get("since")).toBe("2026-09-26T10:00:00Z");
        return { status: 200, body: [restIssue(8, { title: "Déjà là", body: "x" })] };
      },
    });
    const out = await actions["adapter.push"](ctx(plain, f.fetch), {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "Déjà là", description: "x", statusId: "todo", closed: false },
      since: "2026-09-26T10:00:00Z",
    });
    expect(out.remoteId).toBe("8");
    expect(f.calls.some((c) => c.method === "POST")).toBe(false);
  });

  test("update patches only the pushed fields and keeps the current project status", async () => {
    const f = fakeFetch({
      "PATCH /repos/adam/kibo/issues/4": () => ({ status: 200, body: restIssue(4, { title: "Renommé" }) }),
      "GQL issueItems": () => ({
        status: 200,
        body: { data: { repository: { issue: { id: "I_4", projectItems: { nodes: [{ id: "PVTI_4", project: { id: "PVT" }, fieldValues: { nodes: [{ optionId: "O2", field: { id: "F" } }] } }] } } } } },
      }),
    });
    const out = await actions["adapter.push"](ctx(withProject, f.fetch), { kind: "update", remoteId: "4", patch: { title: "Renommé" } });
    expect(f.calls[0]).toMatchObject({ method: "PATCH", body: { title: "Renommé" } });
    expect(out.fields).toMatchObject({ title: "Renommé", statusId: "in_progress" });
  });

  test("github errors keep their stable codes", async () => {
    const gone = fakeFetch({ "PATCH /repos/adam/kibo/issues/4": () => ({ status: 410, body: { message: "Gone" } }) });
    await expect(actions["adapter.push"](ctx(plain, gone.fetch), { kind: "update", remoteId: "4", patch: { title: "X" } })).rejects.toThrow("REMOTE_NOT_FOUND");
    const limited = fakeFetch({
      "GET /repos/adam/kibo/issues": () => ({ status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" } }),
    });
    await expect(actions["adapter.pull"](ctx(plain, limited.fetch), { cursor: null })).rejects.toThrow("RATE_LIMITED");
  });
});
```

Run: `bun test components/github-issues` — Expected: FAIL (`./adapter` absent).

- [x] **Step 5: `rest.ts` et `project.ts`**

`components/github-issues/src/rest.ts` :

```ts
import { type BindingConfig, githubError, KiboError } from "@kibo/schema";
import type { AdapterContext } from "@kibo/sdk/adapter";
import { type ZodType, type ZodTypeDef, z } from "zod";

export type Ctx = AdapterContext<BindingConfig>;
type Method = "GET" | "POST" | "PATCH";
const API = "https://api.github.com";
const HEADERS = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
const etags = new Map<string, { etag: string; body: string }>();

export async function call<T>(ctx: Ctx, method: Method, path: string, schema: ZodType<T, ZodTypeDef, unknown>, body?: unknown): Promise<T> {
  const cached = method === "GET" ? etags.get(path) : undefined;
  const res = await ctx.fetch(`${API}${path}`, {
    method,
    headers: {
      ...HEADERS,
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(cached && { "if-none-match": cached.etag }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const header = (name: string) => res.headers[name] ?? null;
  const text = res.status === 304 && cached ? cached.body : res.body;
  if (res.status !== 304 && (res.status < 200 || res.status >= 300)) throw githubError(res.status, header, res.body);
  const etag = header("etag");
  if (method === "GET" && etag && res.status !== 304) etags.set(path, { etag, body: res.body });
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", `unexpected github response for ${path}`);
  return parsed.data;
}

const Envelope = z.object({ data: z.unknown().optional(), errors: z.array(z.object({ message: z.string() })).optional() });

export async function graphql<T>(ctx: Ctx, query: string, variables: Record<string, unknown>, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const env = await call(ctx, "POST", "/graphql", Envelope, { query, variables });
  if (env.errors?.length) throw new KiboError("REMOTE_REJECTED", `github graphql: ${env.errors[0]?.message ?? ""}`);
  const parsed = schema.safeParse(env.data);
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "unexpected github graphql response");
  return parsed.data;
}
```

(Les en-têtes renvoyés par `ctx.fetch` ont des noms en minuscules : `readProxiedBody` les recopie depuis un `Headers`, qui les normalise.)

`components/github-issues/src/project.ts` :

```ts
import { GITHUB_GRAPHQL, KiboError } from "@kibo/schema";
import { optionOf } from "./map";
import { AddItemData, IssueItemsData, SetStatusData } from "./remote";
import { type Ctx, graphql } from "./rest";

type Project = NonNullable<Ctx["config"]["project"]>;

export async function addItem(ctx: Ctx, project: Project, contentId: string): Promise<string> {
  const d = await graphql(ctx, GITHUB_GRAPHQL.addItem, { projectId: project.nodeId, contentId }, AddItemData);
  return d.addProjectV2ItemById.item.id;
}

export async function setStatus(ctx: Ctx, project: Project, itemId: string, optionId: string): Promise<void> {
  await graphql(
    ctx,
    GITHUB_GRAPHQL.setStatus,
    { projectId: project.nodeId, itemId, fieldId: project.statusFieldId, optionId },
    SetStatusData,
  );
}

export async function currentItem(ctx: Ctx, project: Project, number: number): Promise<{ issueId: string; itemId: string | null; optionId: string | null }> {
  const [owner, name] = ctx.config.repo.split("/");
  const d = await graphql(ctx, GITHUB_GRAPHQL.issueItems, { owner, name, number }, IssueItemsData);
  const issue = d.repository?.issue;
  if (!issue) throw new KiboError("REMOTE_NOT_FOUND", `issue ${number} not found`);
  const item = issue.projectItems.nodes.find((n) => n.project.id === project.nodeId);
  return { issueId: issue.id, itemId: item?.id ?? null, optionId: item ? optionOf(item.fieldValues.nodes, project.statusFieldId) : null };
}
```

- [x] **Step 6: `adapter.ts`, `server.ts`, `index.ts`**

`components/github-issues/src/adapter.ts` :

```ts
import { BindingConfig, GITHUB_GRAPHQL, KiboError, type PushOp, type SyncedFields } from "@kibo/schema";
import { defineAdapter } from "@kibo/sdk/adapter";
import { z } from "zod";
import { readProjectCursor, readRestCursor } from "./cursor";
import { fromItem, fromRest, later, toFields, toRef } from "./map";
import { addItem, currentItem, setStatus } from "./project";
import { GhIssue, ProjectItemsData, RestIssue } from "./remote";
import { type Ctx, call, graphql } from "./rest";

const PER_PAGE = 100;
const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
type Project = NonNullable<Ctx["config"]["project"]>;

async function pullRest(ctx: Ctx, raw: string | null) {
  const cursor = readRestCursor(raw);
  const q = new URLSearchParams({ state: "all", sort: "updated", direction: "asc", per_page: String(PER_PAGE), page: String(cursor.page) });
  if (cursor.since) q.set("since", cursor.since);
  const page = await call(ctx, "GET", `/repos/${ctx.config.repo}/issues?${q}`, z.array(RestIssue));
  const items = page.filter((i) => i.pull_request === undefined).map((i) => fromRest(ctx.config.repo, i));
  const max = page.reduce((m, i) => later(m, i.updated_at), cursor.since ?? "") || null;
  if (page.length < PER_PAGE) return { items, cursor: JSON.stringify({ mode: "rest", since: max, page: 1 }), more: false };
  if (max === cursor.since) return { items, cursor: JSON.stringify({ ...cursor, page: cursor.page + 1 }), more: true };
  return { items, cursor: JSON.stringify({ mode: "rest", since: max, page: 1 }), more: true };
}

async function pullProject(ctx: Ctx, project: Project, raw: string | null) {
  const cursor = readProjectCursor(raw);
  const d = await graphql(ctx, GITHUB_GRAPHQL.projectItems, { projectId: project.nodeId, after: cursor.after }, ProjectItemsData);
  if (!d.node) throw new KiboError("REMOTE_NOT_FOUND", "project not found");
  const mine = d.node.items.nodes.flatMap((n) => {
    const issue = fromItem(n, project.statusFieldId);
    return issue && issue.repo === ctx.config.repo ? [issue] : [];
  });
  const items = mine.filter((i) => cursor.since === null || i.updatedAt >= cursor.since);
  const max = mine.reduce((m, i) => later(m, i.updatedAt), cursor.max ?? "") || null;
  const { hasNextPage, endCursor } = d.node.items.pageInfo;
  if (hasNextPage) return { items, cursor: JSON.stringify({ mode: "project", since: cursor.since, after: endCursor, max }), more: true };
  return { items, cursor: JSON.stringify({ mode: "project", since: max ?? cursor.since, after: null, max: null }), more: false };
}

async function adopt(ctx: Ctx, fields: SyncedFields, since: string) {
  const { login } = await call(ctx, "GET", "/user", z.object({ login: z.string() }));
  const q = new URLSearchParams({ state: "all", creator: login, since, per_page: String(PER_PAGE) });
  const recent = await call(ctx, "GET", `/repos/${ctx.config.repo}/issues?${q}`, z.array(RestIssue));
  const match = recent.find(
    (i) => i.pull_request === undefined && i.title.trim() === fields.title && normalize(i.body ?? "") === fields.description,
  );
  return match ? fromRest(ctx.config.repo, match) : null;
}

async function applyStatus(
  ctx: Ctx,
  project: Project,
  issue: GhIssue,
  itemId: string,
  currentOption: string | null,
  statusId: SyncedFields["statusId"] | undefined,
): Promise<GhIssue> {
  const option = statusId === undefined ? undefined : project.statusMap[statusId];
  if (option === undefined) return { ...issue, optionId: currentOption };
  await setStatus(ctx, project, itemId, option);
  return { ...issue, optionId: option };
}

async function create(ctx: Ctx, op: Extract<PushOp, { kind: "create" }>): Promise<GhIssue> {
  const repo = ctx.config.repo;
  let issue =
    (op.since === null ? null : await adopt(ctx, op.fields, op.since)) ??
    fromRest(
      repo,
      await call(ctx, "POST", `/repos/${repo}/issues`, RestIssue, {
        title: op.fields.title,
        body: op.fields.description,
        ...(ctx.config.labels.length > 0 && { labels: ctx.config.labels }),
      }),
    );
  if (op.fields.closed && !issue.closed) {
    issue = fromRest(repo, await call(ctx, "PATCH", `/repos/${repo}/issues/${issue.number}`, RestIssue, { state: "closed" }));
  }
  const project = ctx.config.project;
  if (!project) return issue;
  const itemId = await addItem(ctx, project, issue.nodeId);
  return applyStatus(ctx, project, issue, itemId, null, op.fields.statusId);
}

async function update(ctx: Ctx, op: Extract<PushOp, { kind: "update" }>): Promise<GhIssue> {
  const path = `/repos/${ctx.config.repo}/issues/${op.remoteId}`;
  const patch = {
    ...(op.patch.title !== undefined && { title: op.patch.title }),
    ...(op.patch.description !== undefined && { body: op.patch.description }),
    ...(op.patch.closed !== undefined && { state: op.patch.closed ? "closed" : "open" }),
  };
  const raw = Object.keys(patch).length > 0 ? await call(ctx, "PATCH", path, RestIssue, patch) : await call(ctx, "GET", path, RestIssue);
  const issue = fromRest(ctx.config.repo, raw);
  const project = ctx.config.project;
  if (!project) return issue;
  const current = await currentItem(ctx, project, issue.number);
  const itemId = current.itemId ?? (await addItem(ctx, project, current.issueId));
  return applyStatus(ctx, project, issue, itemId, current.optionId, op.patch.statusId);
}

export const githubIssuesAdapter = defineAdapter<GhIssue, BindingConfig>({
  id: "github-issues",
  remote: GhIssue,
  config: BindingConfig,
  pull: (ctx, cursor) => (ctx.config.project ? pullProject(ctx, ctx.config.project, cursor) : pullRest(ctx, cursor)),
  push: (ctx, op) => (op.kind === "create" ? create(ctx, op) : update(ctx, op)),
  map: {
    remoteId: (r) => String(r.number),
    updatedAt: (r) => r.updatedAt,
    toFields,
    toRef,
    labels: (r) => r.labels,
  },
});
```

`components/github-issues/src/server.ts` :

```ts
import { adapterActions } from "@kibo/sdk/adapter";
import { defineServer } from "@kibo/sdk/server";
import { githubIssuesAdapter } from "./adapter";

export const server = defineServer({ actions: adapterActions(githubIssuesAdapter) });
```

(Export nommé `server` : c'est celui que `evaluateCjs(code.server, "server")` lit dans `components/runtime-core.ts`.)

`components/github-issues/src/index.ts` :

```ts
import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";

export const manifest = ComponentManifest.parse(manifestJson);
export { githubIssuesAdapter } from "./adapter";
```

- [x] **Step 7: Vérifier et commiter**

Ajouter `components/github-issues` au script `typecheck` racine (après `components/notes`).

Run: `bun install && bun test components/github-issues && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add components/github-issues package.json bun.lock packages/schema/src/component.ts packages/sdk/package.json
git commit -m "feat(components): adaptateur GitHub Issues"
```

---

### Task 14: Moteur de sync

Boîte d'envoi transactionnelle, pull paginé, fusion à trois, anti-écho, reprises. Le moteur ne connaît l'adaptateur qu'à travers `AdapterRunner` : ses tests utilisent un distant en mémoire ; l'aller-retour réel contre le faux GitHub est la Task 19.

Chemin des commandes (N22) : l'observateur de la boîte d'envoi voit **toute** commande de projet exécutée par le démon, parce que la Task 2 fait passer par `docs.run` (donc par `host.command` et ses observateurs) la RPC `command`, `componentCall run` (`components/gate-handlers.ts`), les agents (`agents/data-port.ts` : `assignTicket`, règles `run_started` / `run_done`) et le suivi des PR (`service.triggerRules`, `code/pr-poller.ts`). En phase 4, ces trois derniers chemins appelaient `executeProjectCommand` directement : sans N22, une PR fusionnée (règle `pr_merged` ⇒ `done`) ou un run d'agent (`run_started` ⇒ `in_progress`) ne fermerait jamais l'issue. Les commandes dérivées d'une règle arrivent aux observateurs avec `origin: "user"`, même quand la commande qui les déclenche vient de la sync (sous-tickets fermés sur GitHub ⇒ parent `done` par `children_done`) : c'est une décision locale, poussée comme telle. `createFakeHost` (Task 2) n'applique pas les règles : ce comportement est testé par la Task 2 (`host.test.ts`) ; ici, l'observateur est testé commande par commande.

**Files:**
- Create: `packages/daemon/src/sync/{hash.ts,sync-store.ts,outbox.ts,apply.ts,engine.ts,scheduler.ts,module.ts}`
- Create: `packages/daemon/src/sync/testing/memory-runner.ts`
- Test: `packages/daemon/src/sync/{sync-store.test.ts,engine.test.ts}`

**Interfaces:**
- Consumes: `IntegrationHost` (`command`, `onCommand`, `intercept`, `transaction`, `snapshot`, `broadcast` = `docs.emit` d'un `IntegrationEvent` par N24, `projects`, `user`, `now`), `CommandEvent`, `CommandMeta`, `CommandInterceptor`, `AdapterRunner`, `createFakeHost` (Task 2, `packages/daemon/src/integrations/{types.ts,testing/fake-host.ts}`), `EventLog` du journal des intégrations (`packages/daemon/src/integrations/events.ts`, à ne pas confondre avec `EventLog` de `components/events.ts`), `RateLimitGate` (`integrations/rate-limit.ts`), `IntegrationKit.net.gate` (Tasks 2, 8) ; `projectLocal`, `planSync`, `settleAfterPush`, `canonicalFields`, `normalizeText` (Task 5) ; commandes `importExternalTicket`, `upsertExternalRef`, `addBinding`, `removeBinding`, `ProjectSnapshot.bindings` (Task 4) ; `InstanceSource`, `SyncState`, `SyncReport`, `MappedRemote` (Task 1).
- Transactions : `host.transaction(fn)` est `Service.transaction` (Task 2, N22) : si `fn` échoue, tout projet modifié pendant `fn` est rechargé depuis SQLite ; une écriture de `sync_items` ou de `sync_outbox` qui échoue après une commande ne laisse donc pas de ticket orphelin en mémoire.
- Produces:
  - `fieldsHash(f: SyncedFields): string`
  - `type SyncItem = { bindingId: string; remoteId: string; ticketId: string; base: SyncedFields; remoteUpdatedAt: string; lastPushedHash: string | null }`
  - `type OutboxRow = { id: number; bindingId: string; projectId: string; ticketId: string; op: "create" | "update"; attempts: number; nextAttemptAt: number | null; firstAttemptAt: string | null; lastError: { code: KiboErrorCode; message: string } | null }`
  - `createSyncStore(db): SyncStore` (voir code)
  - `syncInterceptor(host): CommandInterceptor` ; `outboxObserver(store, host, onEnqueue): (e: CommandEvent) => void`
  - `createSyncEngine(deps: { host; store; runner: AdapterRunner; gate: RateLimitGate; events: EventLog; redact(text: string): string }): SyncEngine` (tout message d'erreur conservé en SQLite est caviardé) avec `SyncEngine = { cycle(projectId, bindingId): Promise<SyncReport>; flush(projectId, bindingId): Promise<void>; state(projectId): SyncState; resolveOutbox(projectId, outboxId, action: "retry" | "drop"): void; deleteBinding(projectId, bindingId): void; runnable(): { projectId: string; bindingId: string }[] }`
  - `startSyncScheduler(engine, events, intervalMs?): { kick(projectId, bindingId): void; stop(): void }` (60 s ; `kick` = envoi seul, 1 s après la dernière modification)
  - `syncModule(kit: IntegrationKit, runner: AdapterRunner, connected: () => boolean): IntegrationModule` (handlers `createBinding`, `deleteBinding`, `syncBinding`, `getSyncState`, `resolveOutbox`)
  - `backoffMs(attempts: number): number` = `min(5 s × 2^(attempts−1), 30 min)`

- [x] **Step 1: Distant en mémoire pour les tests**

`packages/daemon/src/sync/testing/memory-runner.ts` :

```ts
import { type Binding, KiboError, type MappedRemote, type PushOp, type SyncedFields } from "@kibo/schema";
import type { AdapterRunner } from "../../integrations/types";

type Issue = { number: number; fields: SyncedFields; updatedAt: string; labels: string[]; gone: boolean };
export type MemoryRunner = AdapterRunner & {
  issues: Map<number, Issue>;
  pulls: number;
  pushes: PushOp[];
  add(fields: Partial<SyncedFields> & { title: string }, labels?: string[]): Issue;
  edit(n: number, patch: Partial<SyncedFields>): void;
  failNext(error: KiboError, times?: number): void;
};

export function createMemoryRunner(clock: { now: number }): MemoryRunner {
  let seq = 0;
  let failures: { error: KiboError; times: number } | null = null;
  const iso = () => new Date(clock.now).toISOString().replace(/\.\d{3}Z$/, "Z");
  const mapped = (b: Binding, i: Issue): MappedRemote => ({
    remoteId: String(i.number),
    updatedAt: i.updatedAt,
    fields: i.fields,
    labels: i.labels,
    ref: {
      kind: "github_issue",
      bindingId: b.id,
      repo: b.config.repo,
      number: i.number,
      nodeId: `I_${i.number}`,
      url: `https://github.com/${b.config.repo}/issues/${i.number}`,
    },
  });
  const maybeFail = () => {
    if (!failures) return;
    failures.times -= 1;
    const e = failures.error;
    if (failures.times <= 0) failures = null;
    throw e;
  };
  const r: MemoryRunner = {
    issues: new Map(),
    pulls: 0,
    pushes: [],
    add(fields, labels = []) {
      seq += 1;
      clock.now += 1000;
      const statusId = fields.closed ? "done" : (fields.statusId ?? "todo");
      const issue: Issue = {
        number: seq,
        fields: { title: fields.title, description: fields.description ?? "", statusId, closed: statusId === "done" },
        updatedAt: iso(),
        labels,
        gone: false,
      };
      r.issues.set(seq, issue);
      return issue;
    },
    edit(n, patch) {
      const i = r.issues.get(n);
      if (!i) throw new Error(`no issue ${n}`);
      clock.now += 1000;
      const fields = { ...i.fields, ...patch };
      const statusId = fields.closed ? "done" : fields.statusId === "done" ? "todo" : fields.statusId;
      i.fields = { ...fields, statusId, closed: statusId === "done" };
      i.updatedAt = iso();
    },
    failNext(error, times = 1) {
      failures = { error, times };
    },
    async pull(_projectId, binding, cursor) {
      r.pulls += 1;
      maybeFail();
      const items = [...r.issues.values()]
        .filter((i) => !i.gone && (cursor === null || i.updatedAt >= cursor))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      return { items: items.map((i) => mapped(binding, i)), cursor: items.at(-1)?.updatedAt ?? cursor, more: false };
    },
    async push(_projectId, binding, op) {
      r.pushes.push(op);
      maybeFail();
      if (op.kind === "create") return mapped(binding, r.add(op.fields));
      const issue = r.issues.get(Number(op.remoteId));
      if (!issue || issue.gone) throw new KiboError("REMOTE_NOT_FOUND", `issue ${op.remoteId}`);
      r.edit(issue.number, op.patch);
      return mapped(binding, issue);
    },
  };
  return r;
}
```

Ce distant se comporte comme GitHub sans Project : `done` ⇔ fermé, tout autre statut ouvert revient en `todo`.

- [x] **Step 2: Tests du moteur (échouent)**

`packages/daemon/src/sync/engine.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Binding, KiboError, type TicketView } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createSyncEngine, type SyncEngine } from "./engine";
import { outboxObserver, syncInterceptor } from "./outbox";
import { createSyncStore, type SyncStore } from "./sync-store";
import { createMemoryRunner, type MemoryRunner } from "./testing/memory-runner";

let host: FakeHost;
let remote: MemoryRunner;
let store: SyncStore;
let engine: SyncEngine;
const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const USER = { origin: "user" as const, instanceId: null };

beforeEach(() => {
  host = createFakeHost();
  remote = createMemoryRunner(host.clock);
  store = createSyncStore(host.db);
  const gate = createRateLimitGate(host.now);
  engine = createSyncEngine({ host, store, runner: remote, gate, events: createEventLog(host.db, createRedactor(), host.now), redact: createRedactor().redact });
  host.intercept(syncInterceptor(host));
  host.onCommand(outboxObserver(store, host, () => undefined));
  host.command(host.projectId, { method: "addBinding", binding }, USER);
  host.command(host.projectId, { method: "addPage", title: "Kanban", kind: "view" }, USER);
  const page = host.snapshot(host.projectId).pages[0];
  if (!page) throw new Error("page missing");
  host.command(host.projectId, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0", config: { source: { bindingId: "b1" } } }, USER);
});
afterEach(() => host.close());

const tickets = (): TicketView[] => host.snapshot(host.projectId).tickets;
const instanceId = () => host.snapshot(host.projectId).instances[0]?.id ?? "";
const cycle = () => engine.cycle(host.projectId, "b1");

describe("pull", () => {
  test("imports open issues with their ref, skips closed ones, then is a fixed point", async () => {
    remote.add({ title: "Ouverte" });
    remote.add({ title: "Fermée", closed: true });
    const report = await cycle();
    expect(report).toMatchObject({ created: 1, pushed: 0 });
    expect(tickets().map((t) => [t.title, t.externalRefs[0]?.kind])).toEqual([["Ouverte", "github_issue"]]);
    const before = remote.pushes.length;
    expect(await cycle()).toMatchObject({ created: 0, updated: 0, pushed: 0 });
    expect(remote.pushes.length).toBe(before);
  });

  test("a remote rename is applied; a remote close marks the ticket done", async () => {
    const issue = remote.add({ title: "A" });
    await cycle();
    remote.edit(issue.number, { title: "B", closed: true });
    await cycle();
    expect(tickets()[0]).toMatchObject({ title: "B", statusId: "done" });
  });

  test("an issue reopened as blocked reopens the ticket as todo and stays open (N37)", async () => {
    remote.add({ title: "A" });
    await cycle();
    host.command(host.projectId, { method: "setStatus", ticketId: tickets()[0]?.id ?? "", statusId: "done" }, USER);
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(true);
    remote.edit(1, { closed: false, statusId: "blocked" });
    await cycle();
    expect(tickets()[0]?.statusId).toBe("todo");
    const before = remote.pushes.length;
    await cycle();
    expect(remote.pushes.length).toBe(before);
    expect(remote.issues.get(1)?.fields).toMatchObject({ closed: false, statusId: "blocked" });
  });
});

describe("push", () => {
  test("a ticket created from a synced instance shows at once, then becomes an issue", async () => {
    host.command(host.projectId, { method: "createTicket", title: "Depuis Kibo" }, { origin: "user", instanceId: instanceId() });
    const created = tickets()[0];
    expect(created?.externalRefs[0]).toMatchObject({ kind: "github_issue", bindingId: "b1", number: null });
    expect(engine.state(host.projectId).pending).toEqual([created?.id]);
    await cycle();
    expect(remote.pushes[0]).toMatchObject({ kind: "create", fields: { title: "Depuis Kibo" }, since: null });
    expect(tickets()[0]?.externalRefs[0]).toMatchObject({ number: 1, url: "https://github.com/adam/kibo/issues/1" });
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("sub-tickets and unlinked tickets are never pushed", async () => {
    host.command(host.projectId, { method: "createTicket", title: "Local" }, USER);
    const parent = tickets()[0];
    host.command(host.projectId, { method: "createTicket", title: "Enfant", parentId: parent?.id ?? null }, { origin: "user", instanceId: instanceId() });
    await cycle();
    expect(remote.pushes).toEqual([]);
  });

  test("a local rename is pushed once, the echo is ignored", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "A2" }, USER);
    await cycle();
    expect(remote.pushes).toEqual([{ kind: "update", remoteId: "1", patch: { title: "A2" } }]);
    await cycle();
    expect(remote.pushes).toHaveLength(1);
  });

  test("offline: the outbox waits with backoff, then resumes", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "setStatus", ticketId: t?.id ?? "", statusId: "done" }, USER);
    remote.failNext(new KiboError("REMOTE_UNAVAILABLE", "offline"));
    await cycle();
    expect(engine.state(host.projectId).pending).toEqual([t?.id]);
    expect(engine.state(host.projectId).errors).toEqual([]);
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(false);
    host.clock.now += 5_000;
    await cycle();
    expect(remote.issues.get(1)?.fields.closed).toBe(true);
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("a rejected change is kept until the user retries or drops it", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "B" }, USER);
    remote.failNext(new KiboError("REMOTE_REJECTED", "github 422: Validation Failed"));
    await cycle();
    const [error] = engine.state(host.projectId).errors;
    expect(error).toMatchObject({ ticketId: t?.id, code: "REMOTE_REJECTED" });
    engine.resolveOutbox(host.projectId, error?.outboxId ?? 0, "retry");
    await cycle();
    expect(remote.issues.get(1)?.fields.title).toBe("B");
  });

  test("a deleted issue breaks the link without touching the ticket", async () => {
    remote.add({ title: "A" });
    await cycle();
    const issue = remote.issues.get(1);
    if (issue) issue.gone = true;
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "B" }, USER);
    await cycle();
    expect(tickets()[0]?.externalRefs[0]).toMatchObject({ number: 1, url: null });
    expect(engine.state(host.projectId).pending).toEqual([]);
  });

  test("an uncertain create blocks imports until it resolves", async () => {
    host.command(host.projectId, { method: "createTicket", title: "Incertaine" }, { origin: "user", instanceId: instanceId() });
    remote.failNext(new KiboError("TIMEOUT", "no answer"));
    await cycle();
    remote.add({ title: "Venue d'ailleurs" });
    remote.add({ title: "Venue ensuite" });
    await cycle();
    expect(tickets().map((t) => t.title)).toEqual(["Incertaine"]);
    host.clock.now += 5_000;
    await cycle();
    await cycle();
    expect(tickets().map((t) => t.title).sort()).toEqual(["Incertaine", "Venue d'ailleurs", "Venue ensuite"]);
    expect(remote.pushes.filter((p) => p.kind === "create").at(-1)).toMatchObject({ since: expect.any(String) });
  });

  test("a ticket deleted while its create is in flight is never imported back", async () => {
    const created = host.command(host.projectId, { method: "createTicket", title: "Fantôme" }, { origin: "user", instanceId: instanceId() });
    const push = remote.push;
    remote.push = async (projectId, b, op) => {
      const m = await push(projectId, b, op);
      host.command(host.projectId, { method: "deleteTicket", ticketId: created.id }, USER);
      return m;
    };
    await cycle();
    remote.push = push;
    await cycle();
    expect(tickets()).toEqual([]);
    expect(remote.issues.get(1)?.fields.closed).toBe(false);
  });
});

describe("conflicts, limits and ownership", () => {
  test("both sides changed: GitHub wins, the conflict is logged and broadcast", async () => {
    remote.add({ title: "A" });
    await cycle();
    const t = tickets()[0];
    host.command(host.projectId, { method: "updateTicket", ticketId: t?.id ?? "", title: "Local" }, USER);
    remote.edit(1, { title: "Distant" });
    remote.failNext(new KiboError("REMOTE_UNAVAILABLE", "flaky"));
    await cycle();
    expect(tickets()[0]?.title).toBe("Distant");
    expect(host.events).toContainEqual({ type: "sync.conflict", projectId: host.projectId, ticketKey: "KIB-1", field: "title" });
    const logged = JSON.stringify(host.db.query("SELECT message FROM integration_events").all());
    expect(logged).toContain("Local");
  });

  test("a paused rate limit skips the pull without calling the adapter", async () => {
    const gate = createRateLimitGate(host.now);
    gate.observe(new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(host.now() / 1000 + 600) }));
    const paused = createSyncEngine({ host, store, runner: remote, gate, events: createEventLog(host.db, createRedactor(), host.now), redact: (t) => t });
    await expect(paused.cycle(host.projectId, "b1")).rejects.toThrow("RATE_LIMITED");
    expect(remote.pulls).toBe(0);
    expect(paused.state(host.projectId).bindings[0]?.resumeAt).toBeGreaterThan(host.now());
  });

  test("only the runner machine syncs a binding", () => {
    expect(engine.runnable()).toEqual([{ projectId: host.projectId, bindingId: "b1" }]);
    host.command(host.projectId, { method: "addBinding", binding: { ...binding, id: "b2", runner: "lea" } }, USER);
    expect(engine.runnable()).toEqual([{ projectId: host.projectId, bindingId: "b1" }]);
  });

  test("deleting a linked ticket forgets it locally and never closes the issue", async () => {
    remote.add({ title: "A" });
    await cycle();
    host.command(host.projectId, { method: "deleteTicket", ticketId: tickets()[0]?.id ?? "" }, USER);
    await cycle();
    expect(remote.pushes).toEqual([]);
    expect(remote.issues.get(1)?.fields.closed).toBe(false);
    expect(tickets()).toEqual([]);
  });
});
```

Supprimer un ticket lié ne touche jamais l'issue (spec F §5) ; la ligne `sync_items` reste avec `ticket_id = ""` (constante `IGNORED`) pour que le pull ne réimporte pas l'issue. Une issue rompue (404) suit la même règle, comme un ticket supprimé pendant que sa création est en vol : `pushCreate` écrit alors la ligne `IGNORED` au lieu de la réf. Plusieurs lignes `IGNORED` coexistent dans une liaison : l'unicité `(binding_id, ticket_id)` est un index partiel `WHERE ticket_id <> ''` (Task 2, `integrations/db.ts`), et `itemByTicket` répète ce prédicat pour que SQLite utilise l'index. Tant qu'une création est incertaine, le pull applique les issues déjà liées mais ne sauve pas le curseur (N39) : les issues nouvelles qu'il a sautées sont relues et importées au premier pull après la résolution.

Run: `bun test packages/daemon/src/sync` — Expected: FAIL.

- [x] **Step 3: `hash.ts` et `sync-store.ts`**

`packages/daemon/src/sync/hash.ts` :

```ts
import { canonicalFields } from "@kibo/core";
import type { SyncedFields } from "@kibo/schema";

export function fieldsHash(f: SyncedFields): string {
  return new Bun.CryptoHasher("sha256").update(canonicalFields(f)).digest("hex");
}
```

`packages/daemon/src/sync/sync-store.ts` :

```ts
import type { Database } from "bun:sqlite";
import { type KiboErrorCode, type OutboxError, SyncedFields } from "@kibo/schema";
import { z } from "zod";

export const IGNORED = "";
export type SyncItem = {
  bindingId: string;
  remoteId: string;
  ticketId: string;
  base: SyncedFields;
  remoteUpdatedAt: string;
  lastPushedHash: string | null;
};
type ErrorInfo = { code: KiboErrorCode; message: string };
export type OutboxRow = {
  id: number;
  bindingId: string;
  projectId: string;
  ticketId: string;
  op: "create" | "update";
  attempts: number;
  nextAttemptAt: number | null;
  firstAttemptAt: string | null;
  lastError: ErrorInfo | null;
};
export type CursorRow = {
  bindingId: string;
  projectId: string;
  cursor: string | null;
  lastPullAt: number | null;
  lastError: ErrorInfo | null;
  imported: number;
};

const ErrorJson = z.object({ code: z.string(), message: z.string() });
const readError = (raw: string | null): ErrorInfo | null => {
  if (raw === null) return null;
  const e = ErrorJson.parse(JSON.parse(raw));
  return { code: e.code as KiboErrorCode, message: e.message };
};

type ItemRow = { binding_id: string; remote_id: string; ticket_id: string; base_json: string; remote_updated_at: string; last_pushed_hash: string | null };
type OutRow = { id: number; binding_id: string; project_id: string; ticket_id: string; op: string; attempts: number; next_attempt_at: number | null; first_attempt_at: string | null; last_error: string | null };
type CurRow = { binding_id: string; project_id: string; cursor: string | null; last_pull_at: number | null; last_error: string | null; imported: number };

const toItem = (r: ItemRow): SyncItem => ({
  bindingId: r.binding_id,
  remoteId: r.remote_id,
  ticketId: r.ticket_id,
  base: SyncedFields.parse(JSON.parse(r.base_json)),
  remoteUpdatedAt: r.remote_updated_at,
  lastPushedHash: r.last_pushed_hash,
});
const toOut = (r: OutRow): OutboxRow => ({
  id: r.id,
  bindingId: r.binding_id,
  projectId: r.project_id,
  ticketId: r.ticket_id,
  op: r.op === "create" ? "create" : "update",
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  firstAttemptAt: r.first_attempt_at,
  lastError: readError(r.last_error),
});

export function createSyncStore(db: Database) {
  const q = {
    item: db.query("SELECT * FROM sync_items WHERE binding_id = $b AND remote_id = $r"),
    itemByTicket: db.query("SELECT * FROM sync_items WHERE binding_id = $b AND ticket_id = $t AND ticket_id <> ''"),
    upsertItem: db.query(
      "INSERT INTO sync_items VALUES ($b, $r, $t, $base, $at, $hash) ON CONFLICT(binding_id, remote_id) DO UPDATE SET ticket_id = excluded.ticket_id, base_json = excluded.base_json, remote_updated_at = excluded.remote_updated_at, last_pushed_hash = excluded.last_pushed_hash",
    ),
    ignoreTicket: db.query("UPDATE sync_items SET ticket_id = '' WHERE ticket_id = $t"),
    deleteItem: db.query("DELETE FROM sync_items WHERE binding_id = $b AND remote_id = $r"),
    outbox: db.query("SELECT * FROM sync_outbox WHERE binding_id = $b ORDER BY id"),
    row: db.query("SELECT * FROM sync_outbox WHERE id = $id"),
    outboxOfTicket: db.query("SELECT * FROM sync_outbox WHERE binding_id = $b AND ticket_id = $t ORDER BY id"),
    enqueue: db.query(
      "INSERT INTO sync_outbox (binding_id, project_id, ticket_id, op, payload_json, created_at) VALUES ($b, $p, $t, $op, $payload, $at)",
    ),
    attempt: db.query(
      "UPDATE sync_outbox SET attempts = $attempts, next_attempt_at = $next, first_attempt_at = $first, last_error = $error WHERE id = $id",
    ),
    deleteOutbox: db.query("DELETE FROM sync_outbox WHERE id = $id"),
    deleteOutboxOfTicket: db.query("DELETE FROM sync_outbox WHERE ticket_id = $t"),
    pending: db.query("SELECT DISTINCT ticket_id FROM sync_outbox WHERE project_id = $p ORDER BY ticket_id"),
    errors: db.query("SELECT * FROM sync_outbox WHERE project_id = $p AND last_error IS NOT NULL AND next_attempt_at IS NULL ORDER BY id"),
    cursor: db.query("SELECT * FROM sync_cursors WHERE binding_id = $b"),
    saveCursor: db.query(
      "INSERT INTO sync_cursors VALUES ($b, $p, $cursor, $at, $error, $imported) ON CONFLICT(binding_id) DO UPDATE SET cursor = excluded.cursor, last_pull_at = excluded.last_pull_at, last_error = excluded.last_error, imported = excluded.imported",
    ),
    dropBinding: [
      db.query("DELETE FROM sync_items WHERE binding_id = $b"),
      db.query("DELETE FROM sync_outbox WHERE binding_id = $b"),
      db.query("DELETE FROM sync_cursors WHERE binding_id = $b"),
    ],
  };
  const json = (e: ErrorInfo | null) => (e === null ? null : JSON.stringify(e));
  return {
    item: (b: string, r: string) => {
      const row = q.item.get({ b, r }) as ItemRow | null;
      return row ? toItem(row) : null;
    },
    itemByTicket: (b: string, t: string) => {
      const row = q.itemByTicket.get({ b, t }) as ItemRow | null;
      return row ? toItem(row) : null;
    },
    upsertItem: (i: SyncItem) => {
      q.upsertItem.run({ b: i.bindingId, r: i.remoteId, t: i.ticketId, base: JSON.stringify(i.base), at: i.remoteUpdatedAt, hash: i.lastPushedHash });
    },
    ignoreTickets: (ids: string[]) => {
      for (const t of ids) q.ignoreTicket.run({ t });
    },
    deleteItem: (b: string, r: string) => {
      q.deleteItem.run({ b, r });
    },
    enqueue(row: { bindingId: string; projectId: string; ticketId: string; op: "create" | "update" }, now: number) {
      const existing = q.outboxOfTicket.all({ b: row.bindingId, t: row.ticketId }) as OutRow[];
      if (existing.length > 0) return;
      q.enqueue.run({ b: row.bindingId, p: row.projectId, t: row.ticketId, op: row.op, payload: JSON.stringify({ op: row.op }), at: now });
    },
    outbox: (b: string) => (q.outbox.all({ b }) as OutRow[]).map(toOut),
    head(b: string, now: number): OutboxRow | null {
      const first = (q.outbox.all({ b }) as OutRow[])[0];
      if (!first) return null;
      const row = toOut(first);
      if (row.nextAttemptAt === null && row.lastError !== null) return null;
      if (row.nextAttemptAt !== null && row.nextAttemptAt > now) return null;
      return row;
    },
    uncertainCreate: (b: string) => (q.outbox.all({ b }) as OutRow[]).some((r) => r.op === "create" && r.attempts > 0),
    attempt(id: number, patch: Pick<OutboxRow, "attempts" | "nextAttemptAt" | "firstAttemptAt" | "lastError">) {
      q.attempt.run({ id, attempts: patch.attempts, next: patch.nextAttemptAt, first: patch.firstAttemptAt, error: json(patch.lastError) });
    },
    row(id: number): OutboxRow | null {
      const r = q.row.get({ id }) as OutRow | null;
      return r ? toOut(r) : null;
    },
    deleteOutbox: (id: number) => {
      q.deleteOutbox.run({ id });
    },
    deleteOutboxOfTickets: (ids: string[]) => {
      for (const t of ids) q.deleteOutboxOfTicket.run({ t });
    },
    pending: (p: string) => (q.pending.all({ p }) as { ticket_id: string }[]).map((r) => r.ticket_id),
    errors: (p: string): OutboxError[] =>
      (q.errors.all({ p }) as OutRow[]).flatMap((r) => {
        const e = readError(r.last_error);
        return e ? [{ outboxId: r.id, ticketId: r.ticket_id, code: e.code, message: e.message }] : [];
      }),
    cursor(b: string): CursorRow | null {
      const r = q.cursor.get({ b }) as CurRow | null;
      return r
        ? { bindingId: r.binding_id, projectId: r.project_id, cursor: r.cursor, lastPullAt: r.last_pull_at, lastError: readError(r.last_error), imported: r.imported }
        : null;
    },
    saveCursor: (c: CursorRow) => {
      q.saveCursor.run({ b: c.bindingId, p: c.projectId, cursor: c.cursor, at: c.lastPullAt, error: json(c.lastError), imported: c.imported });
    },
    dropBinding: (b: string) => {
      for (const s of q.dropBinding) s.run({ b });
    },
  };
}
export type SyncStore = ReturnType<typeof createSyncStore>;
```

(`e.code as KiboErrorCode` : la valeur a été écrite par ce même module à partir d'un `KiboError` ; la relire comme code connu est sûr.)

`packages/daemon/src/sync/sync-store.test.ts` :

```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { migrateIntegrations } from "../integrations/db";
import { createSyncStore } from "./sync-store";

test("one pending row per ticket, FIFO head, manual errors block the binding", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const s = createSyncStore(db);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t1", op: "create" }, 1);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t1", op: "update" }, 2);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t2", op: "update" }, 3);
  expect(s.outbox("b").map((r) => [r.ticketId, r.op])).toEqual([["t1", "create"], ["t2", "update"]]);
  const head = s.head("b", 10);
  expect(head?.ticketId).toBe("t1");
  s.attempt(head?.id ?? 0, { attempts: 1, nextAttemptAt: 100, firstAttemptAt: "2026-09-26T10:00:00Z", lastError: null });
  expect(s.head("b", 10)).toBeNull();
  expect(s.uncertainCreate("b")).toBe(true);
  s.attempt(head?.id ?? 0, { attempts: 1, nextAttemptAt: null, firstAttemptAt: null, lastError: { code: "REMOTE_REJECTED", message: "422" } });
  expect(s.head("b", 1_000)).toBeNull();
  expect(s.errors("p")).toEqual([{ outboxId: head?.id, ticketId: "t1", code: "REMOTE_REJECTED", message: "422" }]);
  expect(s.pending("p")).toEqual(["t1", "t2"]);
});
```

- [x] **Step 4: `outbox.ts` (intercepteur et observateur)**

```ts
import {
  type GithubIssueRef,
  InstanceSource,
  type ProjectCommand,
  type ProjectSnapshot,
} from "@kibo/schema";
import { z } from "zod";
import type { CommandEvent, CommandInterceptor, IntegrationHost } from "../integrations/types";
import type { SyncStore } from "./sync-store";

const IdOf = z.object({ id: z.string() });
const Ids = z.array(z.string());

function sourceBinding(snap: ProjectSnapshot, instanceId: string | null) {
  if (instanceId === null) return null;
  const instance = snap.instances.find((i) => i.id === instanceId);
  const source = InstanceSource.safeParse(instance?.config.source);
  if (!source.success) return null;
  return snap.bindings.find((b) => b.id === source.data.bindingId) ?? null;
}

export function syncInterceptor(host: IntegrationHost): CommandInterceptor {
  return (projectId, cmd, meta): ProjectCommand => {
    if (cmd.method !== "createTicket" || meta.origin !== "user" || cmd.parentId) return cmd;
    const binding = sourceBinding(host.snapshot(projectId), meta.instanceId);
    if (!binding) return cmd;
    const ref: GithubIssueRef = { kind: "github_issue", bindingId: binding.id, repo: binding.config.repo, number: null, nodeId: null, url: null };
    return { method: "importExternalTicket", title: cmd.title, description: cmd.description, statusId: cmd.statusId, assignee: cmd.assignee, ref };
  };
}

export function outboxObserver(
  store: SyncStore,
  host: IntegrationHost,
  onEnqueue: (projectId: string, bindingId: string) => void,
): (e: CommandEvent) => void {
  const enqueue = (projectId: string, bindingId: string, ticketId: string, op: "create" | "update") => {
    store.enqueue({ bindingId, projectId, ticketId, op }, host.now());
    onEnqueue(projectId, bindingId);
  };
  const dirty = (projectId: string, ticketId: string) => {
    const snap = host.snapshot(projectId);
    const ticket = snap.tickets.find((t) => t.id === ticketId);
    for (const ref of ticket?.externalRefs ?? []) {
      if (ref.kind === "github_issue" && ref.url !== null && snap.bindings.some((b) => b.id === ref.bindingId)) {
        enqueue(projectId, ref.bindingId, ticketId, "update");
      }
    }
  };
  return (e) => {
    if (e.meta.origin === "sync") return;
    const c = e.command;
    switch (c.method) {
      case "importExternalTicket":
        if (c.ref.kind === "github_issue" && c.ref.number === null) enqueue(e.projectId, c.ref.bindingId, IdOf.parse(e.result).id, "create");
        return;
      case "updateTicket":
        if (c.title !== undefined || c.description !== undefined) dirty(e.projectId, c.ticketId);
        return;
      case "setStatus":
        dirty(e.projectId, c.ticketId);
        return;
      case "deleteTicket": {
        const ids = Ids.parse(e.result);
        store.ignoreTickets(ids);
        store.deleteOutboxOfTickets(ids);
        return;
      }
      default:
        return;
    }
  };
}
```

(Une réf. déjà rompue — `url: null` et `number` renseigné — n'est plus poussée.)

- [x] **Step 5: `apply.ts`**

```ts
import { canApplyRemote, type ConflictField, planSync, projectLocal, type SyncPlan } from "@kibo/core";
import type { Binding, MappedRemote, SyncedFields, TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { CommandMeta, IntegrationHost } from "../integrations/types";
import { fieldsHash } from "./hash";
import { IGNORED, type SyncItem, type SyncStore } from "./sync-store";

export const SYNC: CommandMeta = { origin: "sync", instanceId: null };
export type ApplyResult = { created: boolean; updated: boolean; conflicts: { ticketKey: string; field: ConflictField; local: string }[] };
const NONE: ApplyResult = { created: false, updated: false, conflicts: [] };
type Deps = { host: IntegrationHost; store: SyncStore; events: EventLog };

export const statusMapOf = (b: Binding) => b.config.project?.statusMap ?? null;

export function applyPlan(deps: Deps, projectId: string, ticket: TicketView, apply: Partial<SyncedFields>): boolean {
  let changed = false;
  if (apply.title !== undefined || apply.description !== undefined) {
    deps.host.command(projectId, { method: "updateTicket", ticketId: ticket.id, title: apply.title, description: apply.description }, SYNC);
    changed = true;
  }
  if (apply.statusId !== undefined && apply.statusId !== ticket.statusId) {
    deps.host.command(projectId, { method: "setStatus", ticketId: ticket.id, statusId: apply.statusId }, SYNC);
    changed = true;
  }
  return changed;
}

function syncRef(deps: Deps, projectId: string, ticket: TicketView, m: MappedRemote): void {
  const current = ticket.externalRefs.find((r) => r.kind === "github_issue" && r.bindingId === m.ref.bindingId);
  if (JSON.stringify(current) !== JSON.stringify(m.ref)) {
    deps.host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
  }
}

function conflictsOf(plan: SyncPlan, ticket: TicketView, local: SyncedFields): ApplyResult["conflicts"] {
  return plan.conflicts.map((field) => ({ ticketKey: ticket.key, field, local: String(local[field]) }));
}

function passes(m: MappedRemote, b: Binding): boolean {
  if (m.fields.closed && !b.config.importClosed) return false;
  return b.config.labels.length === 0 || m.labels.some((l) => b.config.labels.includes(l));
}

function importRemote(deps: Deps, projectId: string, b: Binding, m: MappedRemote): ApplyResult {
  deps.host.transaction(() => {
    const statusId = m.fields.statusId === "blocked" ? "todo" : m.fields.statusId;
    const t = deps.host.command(
      projectId,
      { method: "importExternalTicket", title: m.fields.title, description: m.fields.description, statusId, ref: m.ref },
      SYNC,
    );
    const local = projectLocal(t, m.fields, statusMapOf(b));
    const base = canApplyRemote("statusId", m.fields.statusId) ? m.fields : { ...m.fields, statusId: local.statusId, closed: local.closed };
    deps.store.upsertItem({ bindingId: b.id, remoteId: m.remoteId, ticketId: t.id, base, remoteUpdatedAt: m.updatedAt, lastPushedHash: null });
  });
  return { ...NONE, created: true };
}

export function applyRemote(deps: Deps, projectId: string, b: Binding, m: MappedRemote, allowImport: boolean): ApplyResult {
  const item = deps.store.item(b.id, m.remoteId);
  if (!item) return allowImport && passes(m, b) ? importRemote(deps, projectId, b, m) : NONE;
  if (item.ticketId === IGNORED) return NONE;
  const ticket = deps.host.snapshot(projectId).tickets.find((t) => t.id === item.ticketId);
  if (!ticket) {
    deps.store.upsertItem({ ...item, ticketId: IGNORED });
    return NONE;
  }
  if (item.lastPushedHash === fieldsHash(m.fields) && JSON.stringify(item.base) === JSON.stringify(m.fields)) return NONE;
  return merge(deps, projectId, b, item, ticket, m);
}

function merge(deps: Deps, projectId: string, b: Binding, item: SyncItem, ticket: TicketView, m: MappedRemote): ApplyResult {
  const local = projectLocal(ticket, item.base, statusMapOf(b));
  const plan = planSync({ base: item.base, local, remote: m.fields });
  let updated = false;
  deps.host.transaction(() => {
    updated = applyPlan(deps, projectId, ticket, plan.apply);
    syncRef(deps, projectId, ticket, m);
    deps.store.upsertItem({ ...item, base: plan.nextBase, remoteUpdatedAt: m.updatedAt });
    if (Object.keys(plan.push).length > 0) {
      deps.store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, deps.host.now());
    }
  });
  const conflicts = conflictsOf(plan, ticket, local);
  for (const c of conflicts) {
    deps.events.log("github-issues", "warn", `conflict on ${c.ticketKey}.${c.field}: local value "${c.local}" replaced by GitHub`);
    deps.host.broadcast({ type: "sync.conflict", projectId, ticketKey: c.ticketKey, field: c.field });
  }
  return { created: false, updated, conflicts };
}
```

`packages/core` exporte déjà `ConflictField`, `SyncPlan`, `canApplyRemote`, `planSync`, `projectLocal`, `settleAfterPush` (Task 5).

- [x] **Step 6: `engine.ts`**

```ts
import { planSync, projectLocal, SYNCED_FIELDS, settleAfterPush } from "@kibo/core";
import { type Binding, KiboError, type SyncReport, type SyncState, type TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { RateLimitGate } from "../integrations/rate-limit";
import type { AdapterRunner, IntegrationHost } from "../integrations/types";
import { applyPlan, applyRemote, SYNC, statusMapOf } from "./apply";
import { fieldsHash } from "./hash";
import { IGNORED, type OutboxRow, type SyncStore } from "./sync-store";

export type SyncEngine = {
  cycle(projectId: string, bindingId: string): Promise<SyncReport>;
  flush(projectId: string, bindingId: string): Promise<void>;
  state(projectId: string): SyncState;
  resolveOutbox(projectId: string, outboxId: number, action: "retry" | "drop"): void;
  deleteBinding(projectId: string, bindingId: string): void;
  runnable(): { projectId: string; bindingId: string }[];
};
type Deps = { host: IntegrationHost; store: SyncStore; runner: AdapterRunner; gate: RateLimitGate; events: EventLog; redact(text: string): string };

const MAX_PAGES = 50;
const TRANSIENT = new Set(["REMOTE_UNAVAILABLE", "TIMEOUT", "RATE_LIMITED", "COMPONENT_CRASHED"]);
export const backoffMs = (attempts: number) => Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const asKibo = (e: unknown) => (e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e)));
const emptyReport = (): SyncReport => ({ pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 });

export function createSyncEngine(deps: Deps): SyncEngine {
  const { host, store, runner, gate, events, redact } = deps;
  const running = new Map<string, Promise<unknown>>();
  const bindingOf = (projectId: string, bindingId: string): Binding => {
    const b = host.snapshot(projectId).bindings.find((x) => x.id === bindingId);
    if (!b) throw new KiboError("NOT_FOUND", `binding ${bindingId} not found`);
    return b;
  };
  const ticketOf = (projectId: string, id: string): TicketView | undefined => host.snapshot(projectId).tickets.find((t) => t.id === id);
  const single = <T>(bindingId: string, run: () => Promise<T>): Promise<T> => {
    const prev = running.get(bindingId) ?? Promise.resolve();
    const next = prev.then(run, run);
    running.set(bindingId, next);
    const clear = () => {
      if (running.get(bindingId) === next) running.delete(bindingId);
    };
    next.then(clear, clear);
    return next;
  };

  const pushCreate = async (projectId: string, b: Binding, row: OutboxRow, ticket: TicketView, report: SyncReport) => {
    const m = await runner.push(projectId, b, {
      kind: "create",
      ticketId: ticket.id,
      fields: { title: ticket.title.trim(), description: ticket.description, statusId: ticket.statusId, closed: ticket.statusId === "done" },
      since: row.attempts > 1 ? row.firstAttemptAt : null,
    });
    host.transaction(() => {
      const fresh = ticketOf(projectId, ticket.id);
      const item = { bindingId: b.id, remoteId: m.remoteId, ticketId: ticket.id, base: m.fields, remoteUpdatedAt: m.updatedAt, lastPushedHash: fieldsHash(m.fields) };
      store.deleteOutbox(row.id);
      if (!fresh) return store.upsertItem({ ...item, ticketId: IGNORED });
      host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
      store.upsertItem(item);
      if (JSON.stringify(projectLocal(fresh, m.fields, statusMapOf(b))) !== JSON.stringify(m.fields)) {
        store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, host.now());
      }
    });
    report.pushed += 1;
  };

  const pushUpdate = async (projectId: string, b: Binding, row: OutboxRow, ticket: TicketView, report: SyncReport) => {
    const item = store.itemByTicket(b.id, ticket.id);
    if (!item) return store.deleteOutbox(row.id);
    const map = statusMapOf(b);
    const { push } = planSync({ base: item.base, local: projectLocal(ticket, item.base, map), remote: item.base });
    const pushed = SYNCED_FIELDS.filter((f) => push[f] !== undefined);
    if (pushed.length === 0) return store.deleteOutbox(row.id);
    const m = await runner.push(projectId, b, { kind: "update", remoteId: item.remoteId, patch: push });
    host.transaction(() => {
      store.deleteOutbox(row.id);
      const fresh = ticketOf(projectId, ticket.id);
      if (!fresh) return;
      const settle = settleAfterPush({ base: item.base, pushed, returned: m.fields, local: projectLocal(fresh, item.base, map) });
      applyPlan(deps, projectId, fresh, settle.apply);
      store.upsertItem({ ...item, base: settle.nextBase, remoteUpdatedAt: m.updatedAt, lastPushedHash: fieldsHash(m.fields) });
      if (Object.keys(settle.push).length > 0) store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, host.now());
    });
    report.pushed += 1;
  };

  const onPushError = (projectId: string, b: Binding, row: OutboxRow, ticket: TicketView, e: KiboError): "stop" | "next" => {
    if (TRANSIENT.has(e.code)) {
      store.attempt(row.id, { ...row, nextAttemptAt: host.now() + backoffMs(row.attempts), lastError: null });
      return "stop";
    }
    if (e.code === "REMOTE_NOT_FOUND" && row.op === "update") {
      const ref = ticket.externalRefs.find((r) => r.kind === "github_issue" && r.bindingId === b.id);
      host.transaction(() => {
        if (ref?.kind === "github_issue") host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: { ...ref, url: null } }, SYNC);
        const item = store.itemByTicket(b.id, ticket.id);
        if (item) store.upsertItem({ ...item, ticketId: "" });
        store.deleteOutbox(row.id);
      });
      events.log("github-issues", "warn", `${ticket.key}: issue deleted or transferred, link broken`);
      return "next";
    }
    if (e.code === "REMOTE_CONFLICT" && row.attempts <= 1) {
      store.attempt(row.id, { ...row, nextAttemptAt: host.now(), lastError: null });
      return "stop";
    }
    store.attempt(row.id, { ...row, nextAttemptAt: null, lastError: { code: e.code, message: redact(e.detail) } });
    events.log("github-issues", "error", `${ticket.key}: ${e.detail}`);
    return "stop";
  };

  const flushBinding = async (projectId: string, b: Binding, report: SyncReport) => {
    for (;;) {
      const row = store.head(b.id, host.now());
      if (!row) return;
      const ticket = ticketOf(projectId, row.ticketId);
      if (!ticket) {
        store.deleteOutbox(row.id);
        continue;
      }
      const attempt = { ...row, attempts: row.attempts + 1, firstAttemptAt: row.firstAttemptAt ?? iso(host.now()) };
      store.attempt(row.id, attempt);
      try {
        const known = store.itemByTicket(b.id, ticket.id) !== null;
        if (row.op === "create" && !known) await pushCreate(projectId, b, attempt, ticket, report);
        else await pushUpdate(projectId, b, attempt, ticket, report);
      } catch (e) {
        if (onPushError(projectId, b, attempt, ticket, asKibo(e)) === "stop") return;
      }
    }
  };

  const pullBinding = async (projectId: string, b: Binding, report: SyncReport) => {
    const prev = store.cursor(b.id) ?? { bindingId: b.id, projectId, cursor: null, lastPullAt: null, lastError: null, imported: 0 };
    const until = gate.blockedUntil();
    if (until !== null) throw new KiboError("RATE_LIMITED", `github paused until ${iso(until)}`);
    const allowImport = !store.uncertainCreate(b.id);
    let cursor = prev.cursor;
    let imported = prev.imported;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await runner.pull(projectId, b, cursor);
      for (const m of res.items) {
        const r = applyRemote(deps, projectId, b, m, allowImport);
        report.pulled += 1;
        if (r.created) imported += 1;
        if (r.created) report.created += 1;
        if (r.updated) report.updated += 1;
        report.conflicts += r.conflicts.length;
      }
      cursor = res.cursor;
      store.saveCursor({ ...prev, cursor: allowImport ? cursor : prev.cursor, imported });
      host.broadcast({ type: "sync", projectId, bindingId: b.id, imported, running: true });
      if (!res.more) break;
    }
    store.saveCursor({ ...prev, cursor: allowImport ? cursor : prev.cursor, imported, lastPullAt: host.now(), lastError: null });
  };

  const recordPullError = (projectId: string, b: Binding, e: KiboError) => {
    const prev = store.cursor(b.id) ?? { bindingId: b.id, projectId, cursor: null, lastPullAt: null, lastError: null, imported: 0 };
    store.saveCursor({ ...prev, lastError: { code: e.code, message: redact(e.detail) } });
    events.log("github-issues", e.code === "RATE_LIMITED" ? "warn" : "error", `pull ${b.config.repo}: ${e.detail}`);
  };

  return {
    cycle: (projectId, bindingId) =>
      single(bindingId, async () => {
        const b = bindingOf(projectId, bindingId);
        const report = emptyReport();
        try {
          await flushBinding(projectId, b, report);
          await pullBinding(projectId, b, report);
          await flushBinding(projectId, b, report);
          return report;
        } catch (e) {
          const k = asKibo(e);
          recordPullError(projectId, b, k);
          throw k;
        } finally {
          const imported = store.cursor(b.id)?.imported ?? 0;
          host.broadcast({ type: "sync", projectId, bindingId, imported, running: false });
        }
      }),
    flush: (projectId, bindingId) => single(bindingId, () => flushBinding(projectId, bindingOf(projectId, bindingId), emptyReport())),
    state(projectId) {
      const snap = host.snapshot(projectId);
      return {
        bindings: snap.bindings.map((b) => {
          const c = store.cursor(b.id);
          return {
            bindingId: b.id,
            repo: b.config.repo,
            runner: b.runner,
            running: running.has(b.id),
            lastPullAt: c?.lastPullAt ?? null,
            lastError: c?.lastError ?? null,
            imported: c?.imported ?? 0,
            resumeAt: gate.blockedUntil(),
          };
        }),
        pending: store.pending(projectId),
        errors: store.errors(projectId),
      };
    },
    resolveOutbox(projectId, outboxId, action) {
      const row = store.row(outboxId);
      if (!row || row.projectId !== projectId || row.lastError === null) throw new KiboError("NOT_FOUND", `outbox ${outboxId} has no error`);
      if (action === "drop") return store.deleteOutbox(outboxId);
      store.attempt(outboxId, { ...row, nextAttemptAt: host.now(), lastError: null });
    },
    deleteBinding(projectId, bindingId) {
      host.transaction(() => {
        host.command(projectId, { method: "removeBinding", bindingId }, { origin: "user", instanceId: null });
        store.dropBinding(bindingId);
      });
    },
    runnable: () =>
      host.projects().flatMap((p) =>
        host
          .snapshot(p.id)
          .bindings.filter((b) => b.runner === host.user)
          .map((b) => ({ projectId: p.id, bindingId: b.id })),
      ),
  };
}
```

`asKibo` convertit une exception inattendue en `KiboError("INTERNAL")` : elle est journalisée et remonte, jamais avalée. Un ticket supprimé pendant un envoi : l'observateur retire sa ligne d'envoi et marque l'élément `IGNORED` ; `pushUpdate` relit le ticket dans sa transaction.

- [x] **Step 7: `scheduler.ts` et `module.ts`**

`packages/daemon/src/sync/scheduler.ts` :

```ts
import type { EventLog } from "../integrations/events";
import type { SyncEngine } from "./engine";

export function startSyncScheduler(engine: SyncEngine, events: EventLog, intervalMs = 60_000) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const report = (e: unknown) => events.log("github-issues", "error", e instanceof Error ? e.message : String(e));
  const tick = () => {
    for (const { projectId, bindingId } of engine.runnable()) engine.cycle(projectId, bindingId).catch(report);
  };
  const interval = setInterval(tick, intervalMs);
  return {
    kick(projectId: string, bindingId: string) {
      clearTimeout(timers.get(bindingId));
      timers.set(
        bindingId,
        setTimeout(() => {
          timers.delete(bindingId);
          engine.flush(projectId, bindingId).catch(report);
        }, 1_000),
      );
    },
    stop() {
      clearInterval(interval);
      for (const t of timers.values()) clearTimeout(t);
    },
  };
}
```

`packages/daemon/src/sync/module.ts` (les handlers RPC sont courts et vivent avec le module) :

```ts
import { KiboError } from "@kibo/schema";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { AdapterRunner } from "../integrations/types";
import { createSyncEngine } from "./engine";
import { outboxObserver, syncInterceptor } from "./outbox";
import { startSyncScheduler } from "./scheduler";
import { createSyncStore } from "./sync-store";

export function syncModule(kit: IntegrationKit, runner: AdapterRunner, connected: () => boolean): IntegrationModule {
  const { host, events } = kit;
  const store = createSyncStore(host.db);
  const engine = createSyncEngine({ host, store, runner, gate: kit.net.gate, events, redact: kit.redactor.redact });
  const scheduler = startSyncScheduler(engine, events);
  const offIntercept = host.intercept(syncInterceptor(host));
  const offObserve = host.onCommand(outboxObserver(store, host, (p, b) => scheduler.kick(p, b)));
  const log = (e: unknown) => events.log("github-issues", "error", e instanceof Error ? e.message : String(e));
  return {
    handlers: {
      async createBinding(req) {
        if (!connected()) throw new KiboError("NOT_CONNECTED", "connect github first");
        const binding = { id: crypto.randomUUID(), adapter: "github-issues" as const, config: req.config, createdBy: host.user, runner: host.user };
        host.command(req.projectId, { method: "addBinding", binding }, { origin: "user", instanceId: null });
        engine.cycle(req.projectId, binding.id).catch(log);
        return binding;
      },
      async deleteBinding(req) {
        engine.deleteBinding(req.projectId, req.bindingId);
        return null;
      },
      syncBinding: (req) => engine.cycle(req.projectId, req.bindingId),
      getSyncState: async (req) => engine.state(req.projectId),
      async resolveOutbox(req) {
        const row = store.row(req.outboxId);
        engine.resolveOutbox(req.projectId, req.outboxId, req.action);
        if (row && req.action === "retry") scheduler.kick(req.projectId, row.bindingId);
        return null;
      },
    },
    stop() {
      scheduler.stop();
      offIntercept();
      offObserve();
    },
  };
}
```

(Le module n'est pas encore branché dans `bootstrap.ts` : il attend l'`AdapterRunner` du Worker, Task 19.)

- [x] **Step 8: Vérifier et commiter**

Run: `bun test packages/daemon/src/sync && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/sync
git commit -m "feat(daemon): moteur de sync et boîte d'envoi"
```

---

### Task 15: Hub MCP

Un client MCP par serveur configuré, ouvert à la demande et fermé après 10 min d'inactivité. La configuration vit dans SQLite (`mcp_servers`), jamais dans le CRDT ; les secrets dans le trousseau. Le transport stdio est écrit sur `Bun.spawn` : celui du SDK (`@modelcontextprotocol/sdk/client/stdio.js`) fusionne `getDefaultEnvironment()` (`HOME`, `LOGNAME`, `PATH`, `SHELL`, `TERM`, `USER`) à l'environnement, ce que la spec F §8.1 interdit (N19). Un serveur HTTP non loopback est joint par le transport épinglé du proxy de la phase 4 (N27) : `StreamableHTTPClientTransport` accepte une option `fetch` (`FetchLike`), à laquelle on passe un `fetch` qui résout le nom, refuse toute adresse non publique (`isPublicAddress`) et se connecte à l'adresse vérifiée avec SNI (`directTransport`), sans seconde implémentation de l'anti-SSRF.

Tâche à risque (lancement de processus, réseau, secrets) : relecture `kibo-lead` en plus de `kibo-reviewer`.

Sans recouvrement avec `packages/daemon/src/agents/ask-mcp.ts` : ce dernier est un petit **serveur** MCP stdio écrit à la main (outil `ask_user` offert aux runs d'agent) ; le hub est un **client** MCP du démon. Aucun code partagé.

**Files:**
- Create: `packages/daemon/src/mcp/{config-store.ts,command-line.ts,stdio-transport.ts,http-fetch.ts,result.ts,connection.ts,hub.ts,component-gate.ts,module.ts}`
- Test: `packages/daemon/src/mcp/{command-line.test.ts,result.test.ts,http-fetch.test.ts,hub.test.ts,component-gate.test.ts}`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (hub créé avant le `kit`, `hooks.mcp`, module)

**Interfaces:**
- Consumes: `McpServerInput`, `McpServerView`, `McpToolInfo`, `McpCallResult`, `McpImportItem`, `RESERVED_MCP_IDS`, RPC `listMcpServers`, `previewMcpServer`, `addMcpServer`, `removeMcpServer`, `setMcpServerEnabled`, `testMcpServer` (Task 1) ; `IntegrationHost` (`command`, `transaction`, `home`, `db`, `now`, `broadcast`), `SecretStore`, `EventLog` (`integrations/events.ts`), `McpComponentGate`, `IntegrationKit`, `IntegrationModule`, `baseStatus` (Task 2) ; commande réservée `importExternalTicket` (Task 4) ; faux MCP `FAKE_MCP_STDIO`, `startFakeMcpHttp` (Task 7) ; phase 4 : `isPublicAddress`, `systemResolver`, `type Resolver`, `checkedAddress`, `pinnedRequest` (`components/net-proxy-address.ts`, exportés par la Task 8), `directTransport`, `type Transport` (`components/net-proxy-transport.ts`), `signalGroup` (`process-group.ts`) ; SDK MCP 1.30.1 : `Client` (`@modelcontextprotocol/sdk/client/index.js`), `StreamableHTTPClientTransport` (`…/client/streamableHttp.js`, option `fetch`), `ReadBuffer`, `serializeMessage` (`…/shared/stdio.js`), `Transport`, `FetchLike` (`…/shared/transport.js`), `JSONRPCMessage`, `McpError`, `ErrorCode` (`…/types.js`).
- Produces:
  - `commandLineOf(s: McpServerInput): string` ; `shellQuote(arg: string): string`
  - `toCallResult(raw: unknown, maxBytes?: number): McpCallResult` ; `toReadResult(raw: unknown, maxBytes?: number): McpCallResult` ; `MCP_MAX_RESULT_BYTES = 1_048_576`
  - `type McpHub = { views(): Promise<McpServerView[]>; add(input: McpServerInput, confirmedCommandLine: string, secrets: Record<string, string>): Promise<McpServerView>; remove(id: string): Promise<void>; setEnabled(id: string, enabled: boolean): Promise<McpServerView>; test(id: string): Promise<McpServerView>; tools(id: string): Promise<McpToolInfo[]>; call(id: string, tool: string, args: Record<string, unknown>, instanceId: string | null): Promise<McpCallResult>; read(id: string, uri: string, instanceId: string | null): Promise<McpCallResult>; setReserved(id: "figma", url: string | null): Promise<void>; stop(): Promise<void> }`
  - `createPinnedFetch(deps: { resolve: Resolver; transport?: Transport; allowAddress?: (ip: string) => boolean }): FetchLike` (https seul, adresse publique vérifiée, connexion épinglée avec SNI, aucune redirection suivie)
  - `createMcpHub(deps: { host: IntegrationHost; secrets: SecretStore; events: EventLog; redact(text: string): string; idleMs?: number; callTimeoutMs?: number; resolve?: Resolver }): McpHub` (les messages d'erreur rendus dans `McpServerView.error` sont caviardés)
  - `createMcpGate(hub: McpHub, host: IntegrationHost): McpComponentGate` (serveurs réservés refusés), branché dans `hooks.mcp` ; la porte de la phase 4 (`createGate`, étendue par la Task 9) contrôle les permissions `mcp` avant d'appeler ce `McpComponentGate`
  - `mcpModule(kit: IntegrationKit, hub: McpHub): IntegrationModule` (handlers MCP, sonde `mcp`)
  - secrets : `mcp:<id>:<VAR>` (stdio), `mcp:<id>` (jeton HTTP) ; clé `"bearer"` dans `addMcpServer.secrets` pour le jeton HTTP

- [x] **Step 1: Tests purs (échouent)**

`packages/daemon/src/mcp/command-line.test.ts` :

```ts
import { expect, test } from "bun:test";
import { commandLineOf, shellQuote } from "./command-line";

test("the confirmed command line is exactly what will run", () => {
  expect(shellQuote("npx")).toBe("npx");
  expect(shellQuote("@upstash/context7-mcp")).toBe("@upstash/context7-mcp");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
  expect(shellQuote("")).toBe("''");
  expect(shellQuote("$(rm -rf ~)")).toBe("'$(rm -rf ~)'");
  expect(
    commandLineOf({ transport: "stdio", id: "ctx", name: "Context7", command: "npx", args: ["-y", "@upstash/context7-mcp"], envNames: [] }),
  ).toBe("npx -y @upstash/context7-mcp");
  expect(commandLineOf({ transport: "http", id: "h", name: "H", url: "https://mcp.example.com/mcp", bearer: false })).toBe(
    "https://mcp.example.com/mcp",
  );
});
```

`packages/daemon/src/mcp/result.test.ts` :

```ts
import { expect, test } from "bun:test";
import { toCallResult, toReadResult } from "./result";

test("keeps text and images only, and truncates at the byte limit", () => {
  const raw = {
    content: [
      { type: "text", text: "héllo" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
      { type: "audio", data: "BBBB", mimeType: "audio/wav" },
      { type: "resource_link", uri: "file:///x", name: "x" },
    ],
  };
  expect(toCallResult(raw)).toEqual({
    content: [
      { type: "text", text: "héllo" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
    ],
    isError: false,
    truncated: false,
  });
  const big = toCallResult({ content: [{ type: "text", text: "é".repeat(10) }, { type: "text", text: "tail" }] }, 7);
  expect(big).toEqual({ content: [{ type: "text", text: "ééé" }], isError: false, truncated: true });
  expect(toCallResult({ content: [], isError: true }).isError).toBe(true);
  expect(() => toCallResult({ nope: 1 })).toThrow("MCP_FAILED");
});

test("resources become text or image content", () => {
  const raw = {
    contents: [
      { uri: "fake://a", mimeType: "application/json", text: "{\"a\":1}" },
      { uri: "fake://b", mimeType: "image/png", blob: "AAAA" },
      { uri: "fake://c", mimeType: "application/zip", blob: "ZZZZ" },
    ],
  };
  expect(toReadResult(raw).content).toEqual([
    { type: "text", text: "{\"a\":1}" },
    { type: "image", data: "AAAA", mimeType: "image/png" },
  ]);
});
```

`packages/daemon/src/mcp/http-fetch.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { Transport } from "../components/net-proxy";
import { createPinnedFetch } from "./http-fetch";

test("a remote mcp server is reached at its checked public address only", async () => {
  const sent: { url: string; host: string | undefined; serverName: string | undefined }[] = [];
  const transport: Transport = async (url, init) => {
    sent.push({ url, host: init.headers.host, serverName: init.tls?.serverName });
    return new Response("{}", { status: 200 });
  };
  const pinned = createPinnedFetch({ resolve: async () => ["203.0.113.10"], transport });
  await pinned("https://mcp.example.com/mcp", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
  expect(sent).toEqual([{ url: "https://203.0.113.10/mcp", host: "mcp.example.com", serverName: "mcp.example.com" }]);
  const rebound = createPinnedFetch({ resolve: async () => ["203.0.113.10", "10.0.0.2"], transport });
  await expect(rebound("https://mcp.example.com/mcp", {})).rejects.toThrow("PERMISSION_DENIED");
  await expect(pinned("http://mcp.example.com/mcp", {})).rejects.toThrow("PERMISSION_DENIED");
  expect(sent).toHaveLength(1);
});
```

Run: `bun test packages/daemon/src/mcp` — Expected: FAIL (modules absents).

- [x] **Step 2: `command-line.ts`, `result.ts` et `http-fetch.ts`**

`checkedAddress` et `pinnedRequest` sont exportés par `components/net-proxy-address.ts` depuis la Task 8 (N27) : aucune modification de la phase 4 ici.

`packages/daemon/src/mcp/http-fetch.ts` :

```ts
import { KiboError } from "@kibo/schema";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
} from "../components/net-proxy-address";
import { directTransport, type Transport } from "../components/net-proxy-transport";

export type PinnedFetchDeps = { resolve: Resolver; transport?: Transport; allowAddress?: (ip: string) => boolean };

export function createPinnedFetch(deps: PinnedFetchDeps): FetchLike {
  const transport = deps.transport ?? directTransport;
  const allow = deps.allowAddress ?? isPublicAddress;
  return async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.protocol !== "https:") throw new KiboError("PERMISSION_DENIED", "a remote mcp server must use https");
    if (init.body != null && typeof init.body !== "string") {
      throw new KiboError("INVALID_INPUT", "mcp request body must be text");
    }
    const signal = init.signal ?? new AbortController().signal;
    const address = await checkedAddress(url, deps.resolve, allow, signal);
    const pinned = pinnedRequest(url, address);
    return transport(pinned.url, {
      method: init.method ?? "GET",
      headers: { ...Object.fromEntries(new Headers(init.headers)), host: pinned.host },
      body: typeof init.body === "string" ? init.body : undefined,
      redirect: "manual",
      signal,
      tls: pinned.tls,
    });
  };
}
```

Une redirection n'est jamais suivie (`redirect: "manual"`, réponse 3xx rendue telle quelle au SDK, qui échoue) ; aucun délai global n'est posé ici (le flux SSE d'une connexion Streamable HTTP dure) : les délais sont ceux du client MCP (`timeout` de chaque requête).

`packages/daemon/src/mcp/command-line.ts` :

```ts
import type { McpServerInput } from "@kibo/schema";

const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function shellQuote(arg: string): string {
  if (arg === "") return "''";
  return SAFE.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function commandLineOf(s: McpServerInput): string {
  return s.transport === "stdio" ? [s.command, ...s.args].map(shellQuote).join(" ") : s.url;
}
```

`packages/daemon/src/mcp/result.ts` :

```ts
import { KiboError, type McpCallResult, type McpContent } from "@kibo/schema";
import { z } from "zod";

export const MCP_MAX_RESULT_BYTES = 1_048_576;
const Text = z.object({ type: z.literal("text"), text: z.string() });
const Image = z.object({ type: z.literal("image"), data: z.string(), mimeType: z.string().regex(/^image\//) });
const CallRaw = z.object({ content: z.array(z.unknown()), isError: z.boolean().optional() });
const ReadRaw = z.object({
  contents: z.array(z.object({ uri: z.string(), mimeType: z.string().optional(), text: z.string().optional(), blob: z.string().optional() })),
});
const encoder = new TextEncoder();

function cutUtf8(text: string, maxBytes: number): string {
  let out = "";
  let used = 0;
  for (const ch of text) {
    const size = encoder.encode(ch).length;
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

function limit(items: McpContent[], maxBytes: number): { content: McpContent[]; truncated: boolean } {
  const content: McpContent[] = [];
  let left = maxBytes;
  for (const item of items) {
    const size = item.type === "text" ? encoder.encode(item.text).length : item.data.length;
    if (size <= left) {
      content.push(item);
      left -= size;
      continue;
    }
    if (item.type === "text" && left > 0) content.push({ type: "text", text: cutUtf8(item.text, left) });
    return { content, truncated: true };
  }
  return { content, truncated: false };
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new KiboError("MCP_FAILED", `invalid mcp result: ${r.error.issues[0]?.message ?? "unknown"}`);
  return r.data;
}

export function toCallResult(raw: unknown, maxBytes = MCP_MAX_RESULT_BYTES): McpCallResult {
  const r = parse(CallRaw, raw);
  const items = r.content.flatMap((c): McpContent[] => {
    const t = Text.safeParse(c);
    if (t.success) return [t.data];
    const i = Image.safeParse(c);
    return i.success ? [i.data] : [];
  });
  return { ...limit(items, maxBytes), isError: r.isError === true };
}

export function toReadResult(raw: unknown, maxBytes = MCP_MAX_RESULT_BYTES): McpCallResult {
  const items = parse(ReadRaw, raw).contents.flatMap((c): McpContent[] => {
    if (c.text !== undefined) return [{ type: "text", text: c.text }];
    if (c.blob !== undefined && c.mimeType?.startsWith("image/")) return [{ type: "image", data: c.blob, mimeType: c.mimeType }];
    return [];
  });
  return { ...limit(items, maxBytes), isError: false };
}
```

Run: `bun test packages/daemon/src/mcp/command-line.test.ts packages/daemon/src/mcp/result.test.ts packages/daemon/src/mcp/http-fetch.test.ts` — Expected: PASS.

- [x] **Step 3: Test du hub (échoue)**

`packages/daemon/src/mcp/hub.test.ts` :

```ts
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { McpServerInput } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "../testing/fake-mcp";
import { commandLineOf } from "./command-line";
import { createMcpHub, type McpHub } from "./hub";

const http = await startFakeMcpHttp({ bearer: "mcp-bearer-123456" });
afterAll(() => http.stop());

let host: FakeHost;
let hub: McpHub;
const secrets = () => createMemorySecretStore(createRedactor());
let store: ReturnType<typeof secrets>;
const stdio: McpServerInput = {
  transport: "stdio",
  id: "fake",
  name: "Fake",
  command: process.execPath,
  args: [FAKE_MCP_STDIO],
  envNames: ["FAKE_TOKEN"],
};
const make = (opts: { idleMs?: number; callTimeoutMs?: number } = {}) =>
  createMcpHub({ host, secrets: store, events: createEventLog(host.db, createRedactor(), host.now), redact: createRedactor().redact, ...opts });
const text = (r: { content: { type: string; text?: string }[] }) => r.content.map((c) => c.text ?? "").join("");

beforeEach(() => {
  host = createFakeHost();
  store = secrets();
  hub = make();
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

describe("configuration", () => {
  test("refuses a command line the user did not confirm", async () => {
    await expect(hub.add(stdio, "npx something-else", { FAKE_TOKEN: "tok-123456789" })).rejects.toThrow("INVALID_INPUT");
    expect(await hub.views()).toEqual([]);
  });

  test("requires a value for every declared secret variable", async () => {
    await expect(hub.add(stdio, commandLineOf(stdio), {})).rejects.toThrow("INVALID_INPUT");
  });

  test("stores the config locally and the secret in the keychain only", async () => {
    const view = await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    expect(view).toMatchObject({ id: "fake", enabled: true, state: "connected", secretsSet: ["FAKE_TOKEN"] });
    expect(view.tools.map((t) => t.name)).toContain("echo");
    expect(await store.get("mcp:fake:FAKE_TOKEN")).toBe("tok-123456789");
    expect(JSON.stringify(host.db.query("SELECT * FROM mcp_servers").all())).not.toContain("tok-123456789");
    expect(JSON.stringify(host.snapshot(host.projectId))).not.toContain("fake");
    await hub.remove("fake");
    expect(await store.get("mcp:fake:FAKE_TOKEN")).toBeNull();
  });
});

describe("stdio", () => {
  test("runs with a reduced env and its own 0700 working directory", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    const out = JSON.parse(text(await hub.call("fake", "env", {}, null)));
    expect(out.keys).toEqual(["FAKE_TOKEN", "HOME", "LANG", "PATH"]);
    expect(out.hasToken).toBe(true);
    const dir = join(host.home, "mcp", "fake");
    expect(out.cwd).toBe(dir);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  test("logs each call without its arguments", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    expect(text(await hub.call("fake", "echo", { text: "argument-privé" }, "inst-1"))).toBe("argument-privé");
    const fail = await hub.call("fake", "fail", {}, "inst-1");
    expect(fail.isError).toBe(true);
    const rows = host.db.query("SELECT server, tool, instance_id, ok FROM mcp_calls ORDER BY id").all();
    expect(rows).toEqual([
      { server: "fake", tool: "echo", instance_id: "inst-1", ok: 1 },
      { server: "fake", tool: "fail", instance_id: "inst-1", ok: 0 },
    ]);
    expect(JSON.stringify(host.db.query("SELECT * FROM mcp_calls").all())).not.toContain("argument-privé");
  });

  test("times out, truncates, and closes after inactivity", async () => {
    await hub.stop();
    hub = make({ idleMs: 100, callTimeoutMs: 300 });
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    await expect(hub.call("fake", "slow", { ms: 2_000 }, null)).rejects.toThrow("TIMEOUT");
    const big = await hub.call("fake", "big", { bytes: 2 * 1_048_576 }, null);
    expect(big.truncated).toBe(true);
    expect(text(big).length).toBe(1_048_576);
    await Bun.sleep(250);
    expect((await hub.views())[0]?.state).toBe("idle");
  });

  test("a disabled server cannot be called", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    await hub.setEnabled("fake", false);
    await expect(hub.call("fake", "echo", { text: "x" }, null)).rejects.toThrow("MCP_UNAVAILABLE");
  });
});

describe("http", () => {
  const server = (): McpServerInput => ({ transport: "http", id: "remote", name: "Remote", url: http.url, bearer: true });

  test("sends the bearer from the keychain", async () => {
    const view = await hub.add(server(), commandLineOf(server()), { bearer: "mcp-bearer-123456" });
    expect(view.state).toBe("connected");
    const res = await hub.read("remote", "fake://items", null);
    expect(text(res)).toContain("Premier");
  });

  test("a wrong bearer is an error state, not a crash", async () => {
    const view = await hub.add(server(), commandLineOf(server()), { bearer: "wrong-bearer-0000" });
    expect(view.state).toBe("error");
    expect(view.error).not.toContain("wrong-bearer-0000");
  });

  test("reserved servers are hidden from the list but callable by the daemon", async () => {
    await hub.setReserved("figma", http.url);
    expect(await hub.views()).toEqual([]);
    await expect(hub.tools("figma")).rejects.toThrow("MCP_UNAVAILABLE");
  });
});
```

(Le dernier cas : le faux serveur HTTP de ce test exige un jeton ; un serveur réservé n'en envoie jamais, donc la connexion échoue proprement en `MCP_UNAVAILABLE`. Le chemin nominal de Figma est testé par la Task 20 avec un faux serveur sans jeton.)

`packages/daemon/src/mcp/component-gate.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createMcpGate } from "./component-gate";
import { createMcpHub, type McpHub } from "./hub";

let host: FakeHost;
let hub: McpHub;
beforeEach(() => {
  host = createFakeHost();
  hub = createMcpHub({ host, secrets: createMemorySecretStore(createRedactor()), events: createEventLog(host.db, createRedactor(), host.now), redact: (t) => t });
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

test("components never reach a reserved server", async () => {
  const gate = createMcpGate(hub, host);
  const ctx = { projectId: host.projectId, instanceId: "i1" };
  await expect(gate.call(ctx, "figma", "get_metadata", {})).rejects.toThrow("PERMISSION_DENIED");
  await expect(gate.read(ctx, "figma", "x://y")).rejects.toThrow("PERMISSION_DENIED");
});

test("importing an item twice returns the same ticket", async () => {
  const gate = createMcpGate(hub, host);
  const ctx = { projectId: host.projectId, instanceId: "i1" };
  const item = { itemId: "a1", title: "Premier", url: "https://example.com/a1" };
  const a = await gate.importItem(ctx, "ctx", item);
  const b = await gate.importItem(ctx, "ctx", item);
  expect(b.id).toBe(a.id);
  expect(a.externalRefs).toEqual([{ kind: "mcp_item", server: "ctx", itemId: "a1", url: "https://example.com/a1", title: "Premier" }]);
});
```

Run: `bun test packages/daemon/src/mcp` — Expected: FAIL.

- [x] **Step 4: `config-store.ts` et `stdio-transport.ts`**

`packages/daemon/src/mcp/config-store.ts` :

```ts
import type { Database } from "bun:sqlite";
import { McpServerInput } from "@kibo/schema";
import { z } from "zod";

export type StoredServer = { server: McpServerInput; enabled: boolean; commandLine: string };
type Row = {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args_json: string;
  env_names_json: string;
  url: string | null;
  bearer: number;
  enabled: number;
  command_line: string;
};
const Strings = z.array(z.string());

function toStored(r: Row): StoredServer {
  const server = McpServerInput.parse(
    r.transport === "stdio"
      ? { transport: "stdio", id: r.id, name: r.name, command: r.command, args: Strings.parse(JSON.parse(r.args_json)), envNames: Strings.parse(JSON.parse(r.env_names_json)) }
      : { transport: "http", id: r.id, name: r.name, url: r.url, bearer: r.bearer === 1 },
  );
  return { server, enabled: r.enabled === 1, commandLine: r.command_line };
}

export function createMcpConfigStore(db: Database) {
  const all = db.query("SELECT * FROM mcp_servers ORDER BY created_at, id");
  const one = db.query("SELECT * FROM mcp_servers WHERE id = $id");
  const insert = db.query(
    "INSERT INTO mcp_servers (id, name, transport, command, args_json, env_names_json, url, bearer, enabled, command_line, created_at) VALUES ($id, $name, $transport, $command, $args, $env, $url, $bearer, 1, $line, $at)",
  );
  const remove = db.query("DELETE FROM mcp_servers WHERE id = $id");
  const enable = db.query("UPDATE mcp_servers SET enabled = $enabled WHERE id = $id");
  return {
    list: () => (all.all() as Row[]).map(toStored),
    get(id: string): StoredServer | null {
      const r = one.get({ id }) as Row | null;
      return r ? toStored(r) : null;
    },
    insert(s: McpServerInput, commandLine: string, at: number) {
      insert.run({
        id: s.id,
        name: s.name,
        transport: s.transport,
        command: s.transport === "stdio" ? s.command : null,
        args: JSON.stringify(s.transport === "stdio" ? s.args : []),
        env: JSON.stringify(s.transport === "stdio" ? s.envNames : []),
        url: s.transport === "http" ? s.url : null,
        bearer: s.transport === "http" && s.bearer ? 1 : 0,
        line: commandLine,
        at,
      });
    },
    remove: (id: string) => {
      remove.run({ id });
    },
    setEnabled: (id: string, enabled: boolean) => {
      enable.run({ id, enabled: enabled ? 1 : 0 });
    },
  };
}
export type McpConfigStore = ReturnType<typeof createMcpConfigStore>;
```

(`as Row` : forme fixée par la migration de la Task 2 ; chaque valeur est revalidée par `McpServerInput.parse`.)

`packages/daemon/src/mcp/stdio-transport.ts` :

```ts
import { KiboError } from "@kibo/schema";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { signalGroup } from "../process-group";

type Options = { id: string; cmd: string[]; env: Record<string, string>; cwd: string };
const MAX_STDERR_LINE = 500;
const spawnServer = (o: Options) =>
  Bun.spawn(o.cmd, { env: o.env, cwd: o.cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe", detached: true });
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

async function relayStderr(id: string, stream: ReadableStream<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    const lines = (pending + decoder.decode(chunk, { stream: true })).split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line) console.error(`[kibo-mcp ${id}] ${line.slice(0, MAX_STDERR_LINE)}`);
  }
}

export class BunStdioTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  private proc: ReturnType<typeof spawnServer> | null = null;
  private readonly buffer = new ReadBuffer();

  constructor(private readonly options: Options) {}

  async start(): Promise<void> {
    const proc = spawnServer(this.options);
    this.proc = proc;
    this.pump(proc.stdout).catch((e) => this.onerror?.(asError(e)));
    relayStderr(this.options.id, proc.stderr).catch((e) => this.onerror?.(asError(e)));
    proc.exited.then(
      () => this.onclose?.(),
      (e) => this.onerror?.(asError(e)),
    );
  }

  private async pump(stream: ReadableStream<Uint8Array>): Promise<void> {
    for await (const chunk of stream) {
      this.buffer.append(Buffer.from(chunk));
      for (;;) {
        let message: JSONRPCMessage | null;
        try {
          message = this.buffer.readMessage();
        } catch (e) {
          this.onerror?.(asError(e));
          continue;
        }
        if (message === null) break;
        this.onmessage?.(message);
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.proc) throw new KiboError("MCP_UNAVAILABLE", "stdio transport not started");
    this.proc.stdin.write(serializeMessage(message));
    await this.proc.stdin.flush();
  }

  async close(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    if (proc) signalGroup(proc.pid, "SIGTERM");
  }
}
```

Le serveur est lancé dans son propre groupe (`detached: true`) et `close` signale tout le groupe (`signalGroup` de `process-group.ts`, comme `code/run.ts`) : un `npx …` laisserait sinon son processus `node` orphelin. `stderr` n'est pas hérité : chaque ligne passe par `console.error`, caviardé au démarrage du démon (N14), pour qu'un serveur qui affiche sa variable secrète ne l'écrive pas en clair dans les journaux.

- [x] **Step 5: `connection.ts`**

```ts
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KiboError, type McpServerInput, type McpToolInfo, type SecretName } from "@kibo/schema";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Resolver } from "../components/net-proxy";
import type { SecretResolver } from "../integrations/types";
import { createPinnedFetch } from "./http-fetch";
import { BunStdioTransport } from "./stdio-transport";

export type McpConnection = {
  tools: McpToolInfo[];
  resources: string[];
  client: Client;
  close(): Promise<void>;
};
type Deps = { home: string; secret: SecretResolver; resolve: Resolver; timeoutMs: number };
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

async function secretOrFail(deps: Deps, name: SecretName): Promise<string> {
  const v = await deps.secret(name);
  if (v === null) throw new KiboError("NOT_CONNECTED", `secret ${name} is missing`);
  return v;
}

async function stdioTransport(s: Extract<McpServerInput, { transport: "stdio" }>, deps: Deps): Promise<Transport> {
  const cwd = join(deps.home, "mcp", s.id);
  mkdirSync(cwd, { recursive: true, mode: 0o700 });
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: process.env.HOME ?? homedir(),
    LANG: process.env.LANG ?? "C.UTF-8",
  };
  for (const name of s.envNames) env[name] = await secretOrFail(deps, `mcp:${s.id}:${name}`);
  return new BunStdioTransport({ id: s.id, cmd: [s.command, ...s.args], env, cwd });
}

async function httpTransport(s: Extract<McpServerInput, { transport: "http" }>, deps: Deps): Promise<Transport> {
  const url = new URL(s.url);
  const headers: Record<string, string> = s.bearer ? { authorization: `Bearer ${await secretOrFail(deps, `mcp:${s.id}`)}` } : {};
  if (LOOPBACK.has(url.hostname)) return new StreamableHTTPClientTransport(url, { requestInit: { headers } });
  return new StreamableHTTPClientTransport(url, { requestInit: { headers }, fetch: createPinnedFetch({ resolve: deps.resolve }) });
}

export async function openMcpConnection(s: McpServerInput, deps: Deps): Promise<McpConnection> {
  const transport = s.transport === "stdio" ? await stdioTransport(s, deps) : await httpTransport(s, deps);
  const client = new Client({ name: "kibo", version: "0.5.0" });
  try {
    await client.connect(transport, { timeout: deps.timeoutMs });
    const listed = await client.listTools(undefined, { timeout: deps.timeoutMs });
    const resources = client.getServerCapabilities()?.resources
      ? (await client.listResources(undefined, { timeout: deps.timeoutMs })).resources.map((r) => r.uri)
      : [];
    return {
      client,
      resources,
      tools: listed.tools.map((t) => ({ name: t.name, description: t.description ?? null, inputSchema: t.inputSchema })),
      close: () => client.close(),
    };
  } catch (e) {
    await client.close();
    throw new KiboError("MCP_UNAVAILABLE", `${s.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
```

(`mcp:${s.id}:${name}` satisfait le type gabarit `SecretName`. Seule une adresse loopback part par le `fetch` global (serveur Dev Mode de Figma, faux MCP des tests) : `McpServerInput` refuse déjà tout `http:` non loopback (Task 1). `initialize`, `tools/list` et `resources/list` sont faits une fois par connexion et gardés tant qu'elle vit (spec F §8.1).)

- [x] **Step 6: `hub.ts`**

```ts
import { rmSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type McpCallResult, type McpServerInput, type McpServerView, type McpToolInfo } from "@kibo/schema";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type Resolver, systemResolver } from "../components/net-proxy";
import type { EventLog } from "../integrations/events";
import type { IntegrationHost, SecretStore } from "../integrations/types";
import { commandLineOf } from "./command-line";
import { createMcpConfigStore } from "./config-store";
import { type McpConnection, openMcpConnection } from "./connection";
import { toCallResult, toReadResult } from "./result";

export type McpHub = {
  views(): Promise<McpServerView[]>;
  add(input: McpServerInput, confirmedCommandLine: string, secrets: Record<string, string>): Promise<McpServerView>;
  remove(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<McpServerView>;
  test(id: string): Promise<McpServerView>;
  tools(id: string): Promise<McpToolInfo[]>;
  call(id: string, tool: string, args: Record<string, unknown>, instanceId: string | null): Promise<McpCallResult>;
  read(id: string, uri: string, instanceId: string | null): Promise<McpCallResult>;
  setReserved(id: "figma", url: string | null): Promise<void>;
  stop(): Promise<void>;
};
type Deps = { host: IntegrationHost; secrets: SecretStore; events: EventLog; redact(text: string): string; idleMs?: number; callTimeoutMs?: number; resolve?: Resolver };
type Live = { conn: Promise<McpConnection>; timer: ReturnType<typeof setTimeout> | null };

const CONNECT_TIMEOUT_MS = 30_000;
const secretNames = (s: McpServerInput) => (s.transport === "stdio" ? s.envNames.map((n) => `mcp:${s.id}:${n}` as const) : s.bearer ? [`mcp:${s.id}` as const] : []);

export function createMcpHub(deps: Deps): McpHub {
  const { host, secrets, events } = deps;
  const idleMs = deps.idleMs ?? 10 * 60_000;
  const timeoutMs = deps.callTimeoutMs ?? 60_000;
  const store = createMcpConfigStore(host.db);
  const reserved = new Map<string, McpServerInput>();
  const live = new Map<string, Live>();
  const errors = new Map<string, string>();
  const logCall = host.db.query(
    "INSERT INTO mcp_calls (at, server, tool, instance_id, duration_ms, ok) VALUES ($at, $server, $tool, $instance, $ms, $ok)",
  );

  const configOf = (id: string): { server: McpServerInput; enabled: boolean } => {
    const r = reserved.get(id);
    if (r) return { server: r, enabled: true };
    const s = store.get(id);
    if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
    return s;
  };
  const close = async (id: string) => {
    const l = live.get(id);
    if (!l) return;
    live.delete(id);
    if (l.timer) clearTimeout(l.timer);
    const conn = await l.conn.catch(() => null);
    if (conn) await conn.close();
  };
  const touch = (id: string) => {
    const l = live.get(id);
    if (!l) return;
    if (l.timer) clearTimeout(l.timer);
    l.timer = setTimeout(() => {
      close(id).catch((e) => events.log("mcp", "error", `${id}: close failed: ${String(e)}`));
    }, idleMs);
  };
  const connect = async (id: string): Promise<McpConnection> => {
    const { server, enabled } = configOf(id);
    if (!enabled) throw new KiboError("MCP_UNAVAILABLE", `mcp server ${id} is disabled`);
    let l = live.get(id);
    if (!l) {
      l = { conn: openMcpConnection(server, { home: host.home, secret: (n) => secrets.get(n), resolve: deps.resolve ?? systemResolver, timeoutMs: CONNECT_TIMEOUT_MS }), timer: null };
      live.set(id, l);
    }
    try {
      const conn = await l.conn;
      errors.delete(id);
      touch(id);
      return conn;
    } catch (e) {
      live.delete(id);
      const k = e instanceof KiboError ? e : new KiboError("MCP_UNAVAILABLE", String(e));
      errors.set(id, deps.redact(k.detail));
      events.log("mcp", "error", k.detail);
      throw k;
    }
  };
  const view = async (id: string): Promise<McpServerView> => {
    const s = store.get(id);
    if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
    const l = live.get(id);
    const conn = l ? await l.conn.catch(() => null) : null;
    const set: string[] = [];
    for (const name of s.server.transport === "stdio" ? s.server.envNames : []) if (await secrets.has(`mcp:${id}:${name}`)) set.push(name);
    const error = errors.get(id) ?? null;
    return { ...s.server, enabled: s.enabled, state: error ? "error" : conn ? "connected" : "idle", error, tools: conn?.tools ?? [], secretsSet: set };
  };
  const tryConnect = async (id: string) => {
    try {
      await connect(id);
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
    }
    return view(id);
  };
  const timed = async <T>(id: string, tool: string, instanceId: string | null, run: (c: McpConnection) => Promise<T>, ok: (r: T) => boolean) => {
    const conn = await connect(id);
    const started = performance.now();
    let success = false;
    try {
      const r = await run(conn);
      success = ok(r);
      return r;
    } catch (e) {
      if (e instanceof McpError && e.code === ErrorCode.RequestTimeout) throw new KiboError("TIMEOUT", `${id}/${tool} timed out`);
      if (e instanceof KiboError) throw e;
      throw new KiboError("MCP_FAILED", `${id}/${tool}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      logCall.run({ at: host.now(), server: id, tool, instance: instanceId, ms: Math.round(performance.now() - started), ok: success ? 1 : 0 });
      touch(id);
    }
  };

  return {
    views: async () => Promise.all(store.list().map((s) => view(s.server.id))),
    async add(input, confirmedCommandLine, values) {
      if (commandLineOf(input) !== confirmedCommandLine) throw new KiboError("INVALID_INPUT", "command line was not confirmed");
      if (store.get(input.id) || reserved.has(input.id)) throw new KiboError("INVALID_INPUT", `mcp server ${input.id} already exists`);
      const wanted = input.transport === "stdio" ? input.envNames : input.bearer ? ["bearer"] : [];
      const missing = wanted.filter((n) => !values[n]);
      if (missing.length > 0) throw new KiboError("INVALID_INPUT", `missing secret values: ${missing.join(", ")}`);
      const names = secretNames(input);
      for (const [i, name] of names.entries()) await secrets.set(name, values[wanted[i] ?? ""] ?? "");
      host.transaction(() => store.insert(input, confirmedCommandLine, host.now()));
      events.log("mcp", "info", `server ${input.id} added`);
      return tryConnect(input.id);
    },
    async remove(id) {
      const s = store.get(id);
      if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
      await close(id);
      for (const name of secretNames(s.server)) await secrets.delete(name);
      store.remove(id);
      errors.delete(id);
      rmSync(join(host.home, "mcp", id), { recursive: true, force: true });
    },
    async setEnabled(id, enabled) {
      if (!store.get(id)) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
      store.setEnabled(id, enabled);
      if (!enabled) await close(id);
      errors.delete(id);
      return view(id);
    },
    async test(id) {
      await close(id);
      return tryConnect(id);
    },
    tools: async (id) => (await connect(id)).tools,
    call: (id, tool, args, instanceId) =>
      timed(id, tool, instanceId, async (c) => toCallResult(await c.client.callTool({ name: tool, arguments: args }, undefined, { timeout: timeoutMs })), (r) => !r.isError),
    read: (id, uri, instanceId) =>
      timed(id, "resources/read", instanceId, async (c) => toReadResult(await c.client.readResource({ uri }, { timeout: timeoutMs })), () => true),
    async setReserved(id, url) {
      await close(id);
      errors.delete(id);
      if (url === null) reserved.delete(id);
      else reserved.set(id, { transport: "http", id, name: "Figma", url, bearer: false });
    },
    async stop() {
      await Promise.all([...live.keys()].map(close));
    },
  };
}
```

Précisions pour l'implémenteur :
- `secretNames(…)` et `wanted` sont alignés par position (même ordre) ; `add` écrit donc chaque valeur sous son nom de trousseau.
- `close` : `l.conn.catch(() => null)` n'avale rien : l'échec d'ouverture a déjà été journalisé et enregistré dans `errors` par `connect`.
- `tryConnect` convertit un échec de connexion en vue « error » (état affiché à l'écran) ; toute autre exception remonte.
- `McpError` et `ErrorCode.RequestTimeout` (`-32001`) sont exportés par `@modelcontextprotocol/sdk/types.js` en 1.30.1.

- [x] **Step 7: `component-gate.ts` et `module.ts`**

`packages/daemon/src/mcp/component-gate.ts` :

```ts
import { KiboError, RESERVED_MCP_IDS } from "@kibo/schema";
import type { IntegrationHost, McpComponentGate } from "../integrations/types";
import type { McpHub } from "./hub";

function guard(server: string): void {
  if (RESERVED_MCP_IDS.some((id) => id === server)) throw new KiboError("PERMISSION_DENIED", `mcp server ${server} is reserved`);
}

export function createMcpGate(hub: McpHub, host: IntegrationHost): McpComponentGate {
  return {
    async call(ctx, server, tool, args) {
      guard(server);
      return hub.call(server, tool, args, ctx.instanceId);
    },
    async read(ctx, server, uri) {
      guard(server);
      return hub.read(server, uri, ctx.instanceId);
    },
    async importItem(ctx, server, item) {
      guard(server);
      return host.command(
        ctx.projectId,
        {
          method: "importExternalTicket",
          title: item.title,
          ref: { kind: "mcp_item", server, itemId: item.itemId, url: item.url, title: item.title },
        },
        { origin: "user", instanceId: ctx.instanceId },
      );
    },
  };
}
```

`packages/daemon/src/mcp/module.ts` :

```ts
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import { baseStatus } from "../integrations/probes";
import { commandLineOf } from "./command-line";
import type { McpHub } from "./hub";

export function mcpModule(kit: IntegrationKit, hub: McpHub): IntegrationModule {
  const changed = () => kit.host.broadcast({ type: "integrations" });
  const status = async () => {
    const enabled = (await hub.views()).filter((v) => v.enabled);
    if (enabled.length === 0) return baseStatus("mcp", "disconnected");
    const failing = enabled.find((v) => v.state === "error");
    const servers = enabled.map((v) => v.id);
    return failing
      ? { ...baseStatus("mcp", "error"), servers, error: { code: "MCP_UNAVAILABLE" as const, message: `${failing.id} : ${failing.error ?? ""}` } }
      : { ...baseStatus("mcp", "connected"), servers };
  };
  return {
    handlers: {
      listMcpServers: () => hub.views(),
      previewMcpServer: async (req) => ({ commandLine: commandLineOf(req.server) }),
      async addMcpServer(req) {
        const view = await hub.add(req.server, req.confirmedCommandLine, req.secrets);
        changed();
        return view;
      },
      async removeMcpServer(req) {
        await hub.remove(req.id);
        changed();
        return null;
      },
      async setMcpServerEnabled(req) {
        const view = await hub.setEnabled(req.id, req.enabled);
        changed();
        return view;
      },
      async testMcpServer(req) {
        const view = await hub.test(req.id);
        changed();
        return view;
      },
    },
    probes: [
      {
        id: "mcp",
        status,
        async test() {
          for (const v of await hub.views()) if (v.enabled) await hub.test(v.id);
          return status();
        },
      },
    ],
    stop: () => {
      hub.stop().catch((e) => kit.events.log("mcp", "error", `stop failed: ${String(e)}`));
    },
  };
}
```

`packages/daemon/src/integrations/bootstrap.ts` : créer avant le `kit` `const events = createEventLog(host.db, redactor, host.now);` et `const mcpHub = createMcpHub({ host, secrets, events, redact: redactor.redact });`, passer `events` au `kit`, `hooks.mcp: createMcpGate(mcpHub, host)`, et ajouter `mcpModule(kit, mcpHub)` à `modules`.

- [x] **Step 8: Vérifier et commiter**

Run: `bun test packages/daemon/src/mcp && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/mcp packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): hub MCP"
```

---

### Task 16: GitHub Actions (C1)

Sondeur des runs des PR liées aux tickets, logs téléchargés à la demande, entité SDK `ci_run`, notification « CI cassée » une seule fois par run (N20, N25).

Complète le suivi des PR de la phase 3 sans le dupliquer : `packages/daemon/src/code/pr-poller.ts` suit l'**état** des réf. `github_pr` ouvertes par `gh pr view` (et déclenche les règles `pr_opened`/`pr_merged`) ; ce sondeur ne touche jamais la réf. ni le statut du ticket, il lit par l'API REST (compte GitHub de la Task 12, mode `gh` ou jeton) la tête de chaque PR liée (`gh pr view` de la phase 3 ne demande pas `headRefOid`) puis ses runs.

**Files:**
- Create: `packages/daemon/src/ci/{ci-store.ts,poller.ts,logs.ts,module.ts}`
- Test: `packages/daemon/src/ci/{poller.test.ts,logs.test.ts}`
- Create: `packages/daemon/src/ci/fr.ts` (textes de la notification)
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (sondeur créé avant le `kit`, `hooks.ciRuns`, module). Aucune règle de la phase 2 n'est modifiée : les règles (`packages/schema/src/rule.ts`) ne font que changer un statut et n'ont pas d'événement externe ; `ci.failed` est une notification directe (N25).

**Interfaces:**
- Consumes: `CiRun`, `CiJobSummary`, `CiLog`, `githubError`, `RepoSlug`, RPC `listCiRuns`, `getCiLog` (Task 1) ; `IntegrationHost` (`notify`, `broadcast`, `home`, `snapshot`, `projects`, `now`), `EventLog` (`integrations/events.ts`), `githubRepoOf`, `IntegrationKit` (Task 2) ; `GITHUB_LOG_RULES` (Task 8) ; `GithubApi` (Task 12) ; faux GitHub (Task 6) ; réf. `github_pr` `{ kind: "github_pr", url, number, state: "open" | "draft" | "merged" | "closed" }` (`packages/schema/src/external-ref.ts`, phase 3) ; `TicketView` (`packages/schema/src/rpc.ts`).
- Produces:
  - `createCiStore(db): CiStore` ; `type CiStore = { upsertRun(r: StoredRun): "new" | "changed" | "same"; upsertJobs(runId: number, jobs: CiJobSummary[]): void; runsOf(projectId: string, prNumbers: number[] | null): StoredRun[]; jobsOf(runId: number): CiJobSummary[]; markNotified(repo: string, runId: number): void; job(projectId: string, runId: number, jobId: number): { repo: RepoSlug; completed: boolean; logPath: string | null } | null; setLog(jobId: number, path: string | null, at: number | null): void; staleLogs(before: number): { jobId: number; path: string }[] }`
  - `type StoredRun = Omit<CiRun, "ticketKey" | "jobs"> & { projectId: string; notified: boolean }`
  - `createCiPoller(deps: { host: IntegrationHost; api: GithubApi; store: CiStore; events: EventLog; connected(): boolean }): CiPoller` avec `CiPoller = { tick(): Promise<void>; runs(projectId: string, ticketId: string | null): Promise<CiRun[]>; start(): () => void }`
  - `errorLinesOf(text: string): number[]` (1-based) ; `MAX_LOG_BYTES = 20 * 1024 * 1024` ; `LOG_RETENTION_MS = 14 jours`
  - `readCiLog(deps: { host; api; store }, projectId, runId, jobId): Promise<CiLog>` ; `purgeCiLogs(deps, now): void`
  - `ciModule(kit: IntegrationKit, poller: CiPoller, store: CiStore): IntegrationModule` (handlers `listCiRuns`, `getCiLog`)
  - `IntegrationEvent` `{ type: "ci", projectId }` diffusé quand un run change
  - `frCi = { failedTitle(key: string): string; failedBody(workflow: string, pr: number): string }` (`ci/fr.ts` : « CI cassée sur KIB-1 », « CI a échoué sur la PR #12. »)

- [x] **Step 1: Tests (échouent)**

`packages/daemon/src/ci/poller.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createGithubApi } from "../github/api";
import { createEventLog } from "../integrations/events";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { createCiStore } from "./ci-store";
import { type CiPoller, createCiPoller } from "./poller";

let gh: FakeGithub;
let host: FakeHost;
let poller: CiPoller;
const USER = { origin: "user" as const, instanceId: null };

beforeEach(() => {
  gh = startFakeGithub();
  const repo = gh.addRepo("adam/kibo");
  repo.pulls.set(12, { headSha: "abc123", headRef: "kib-1-arbre" });
  host = createFakeHost();
  const fetch = createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]) });
  const api = createGithubApi({ fetch, token: async () => gh.token, gate: createRateLimitGate(host.now) });
  poller = createCiPoller({ host, api, store: createCiStore(host.db), events: createEventLog(host.db, createRedactor(), host.now), connected: () => true });
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  host.command(
    host.projectId,
    { method: "upsertExternalRef", ticketId: t.id, ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" } },
    USER,
  );
});
afterEach(() => {
  gh.stop();
  host.close();
});

const job = (id: number, conclusion: string | null) => ({
  id,
  name: "build",
  status: conclusion ? "completed" : "in_progress",
  conclusion,
  startedAt: "2026-09-26T10:00:00Z",
  completedAt: conclusion ? "2026-09-26T10:03:12Z" : null,
  log: "step 1\n##[error]Test failed: tree.test.ts\nstep 3\n",
});

test("reads the runs of the head of each linked PR, with the ticket key", async () => {
  gh.addRun("adam/kibo", { id: 900, headSha: "abc123", headBranch: "kib-1-arbre", name: "CI", status: "in_progress", conclusion: null, jobs: [job(70, null)] });
  gh.addRun("adam/kibo", { id: 901, headSha: "other", headBranch: "x", name: "CI", status: "completed", conclusion: "success", jobs: [] });
  await poller.tick();
  const runs = await poller.runs(host.projectId, null);
  expect(runs.map((r) => [r.runId, r.prNumber, r.ticketKey, r.workflow, r.status])).toEqual([[900, 12, "KIB-1", "CI", "in_progress"]]);
  expect(runs[0]?.jobs).toEqual([
    { jobId: 70, name: "build", status: "in_progress", conclusion: null, startedAt: "2026-09-26T10:00:00Z", completedAt: null },
  ]);
  expect(host.events).toContainEqual({ type: "ci", projectId: host.projectId });
});

test("a failure raises ci.failed exactly once", async () => {
  const run = gh.addRun("adam/kibo", { id: 900, headSha: "abc123", headBranch: "b", name: "CI", status: "in_progress", conclusion: null, jobs: [job(70, null)] });
  await poller.tick();
  expect(host.notifications).toEqual([]);
  run.status = "completed";
  run.conclusion = "failure";
  run.updatedAt = gh.tick(30);
  run.jobs = [job(70, "failure")];
  host.clock.now += 60_000;
  await poller.tick();
  host.clock.now += 60_000;
  await poller.tick();
  expect(host.notifications.map(({ title, body }) => ({ title, body }))).toEqual([
    { title: "CI cassée sur KIB-1", body: "CI a échoué sur la PR #12." },
  ]);
});

test("an old failure seen for the first time does not notify", async () => {
  gh.addRun("adam/kibo", { id: 900, headSha: "abc123", headBranch: "b", name: "CI", status: "completed", conclusion: "failure", jobs: [job(70, "failure")] });
  host.clock.now += 60 * 60_000;
  await poller.tick();
  expect(host.notifications).toEqual([]);
});

test("polls every 60 s with an open ticket, every 15 min once all are done", async () => {
  await poller.tick();
  const count = () => gh.requests.filter((r) => r.path.startsWith("/repos/adam/kibo/pulls/12")).length;
  const first = count();
  host.clock.now += 61_000;
  await poller.tick();
  expect(count()).toBe(first + 1);
  const t = host.snapshot(host.projectId).tickets[0];
  host.command(host.projectId, { method: "setStatus", ticketId: t?.id ?? "", statusId: "done" }, USER);
  host.clock.now += 61_000;
  await poller.tick();
  expect(count()).toBe(first + 1);
  host.clock.now += 15 * 60_000;
  await poller.tick();
  expect(count()).toBe(first + 2);
});

test("nothing is polled while GitHub is not connected", async () => {
  const idle = createCiPoller({
    host,
    api: createGithubApi({ fetch: createIntegrationFetch({ aliases: new Map() }), token: async () => null, gate: createRateLimitGate(host.now) }),
    store: createCiStore(host.db),
    events: createEventLog(host.db, createRedactor(), host.now),
    connected: () => false,
  });
  const before = gh.requests.length;
  await idle.tick();
  expect(gh.requests.length).toBe(before);
});
```

`packages/daemon/src/ci/logs.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { createGithubApi } from "../github/api";
import { createEventLog } from "../integrations/events";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { type CiStore, createCiStore } from "./ci-store";
import { errorLinesOf, purgeCiLogs, readCiLog } from "./logs";
import { createCiPoller } from "./poller";

let gh: FakeGithub;
let host: FakeHost;
let store: CiStore;
let deps: Parameters<typeof readCiLog>[0];
beforeEach(async () => {
  gh = startFakeGithub();
  const repo = gh.addRepo("adam/kibo");
  repo.pulls.set(12, { headSha: "abc123", headRef: "b" });
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "b",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [{ id: 70, name: "build", status: "completed", conclusion: "failure", startedAt: null, completedAt: null, log: "ok\n##[error]boom\nfin\n" }],
  });
  host = createFakeHost();
  store = createCiStore(host.db);
  const fetch = createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]) });
  const api = createGithubApi({ fetch, token: async () => gh.token, gate: createRateLimitGate(host.now) });
  deps = { host, api, store };
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, { origin: "user", instanceId: null });
  host.command(
    host.projectId,
    { method: "upsertExternalRef", ticketId: t.id, ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" } },
    { origin: "user", instanceId: null },
  );
  await createCiPoller({ host, api, store, events: createEventLog(host.db, createRedactor(), host.now), connected: () => true }).tick();
});
afterEach(() => {
  gh.stop();
  host.close();
});

test("error lines are detected", () => {
  expect(errorLinesOf("ok\n##[error]boom\nError: x\nall good\nFAILED tests\n")).toEqual([2, 3, 5]);
});

test("a log is downloaded once, without leaking the token to the log host, and cached 0600", async () => {
  const log = await readCiLog(deps, host.projectId, 900, 70);
  expect(log).toEqual({ text: "ok\n##[error]boom\nfin\n", truncated: false, errorLines: [2] });
  const logRequests = gh.requests.filter((r) => r.path === "/logs/70");
  expect(logRequests.map((r) => r.auth)).toEqual([null]);
  const path = store.job(host.projectId, 900, 70)?.logPath ?? "";
  expect(statSync(path).mode & 0o777).toBe(0o600);
  await readCiLog(deps, host.projectId, 900, 70);
  expect(gh.requests.filter((r) => r.path === "/logs/70")).toHaveLength(1);
});

test("a job of another project is not found", async () => {
  await expect(readCiLog(deps, "other", 900, 70)).rejects.toThrow("NOT_FOUND");
  await expect(readCiLog(deps, host.projectId, 900, 71)).rejects.toThrow("NOT_FOUND");
});

test("logs older than 14 days are purged", async () => {
  await readCiLog(deps, host.projectId, 900, 70);
  const path = store.job(host.projectId, 900, 70)?.logPath ?? "";
  purgeCiLogs(deps, host.now() + 15 * 24 * 3_600_000);
  expect(existsSync(path)).toBe(false);
  expect(store.job(host.projectId, 900, 70)?.logPath).toBeNull();
});
```

Run: `bun test packages/daemon/src/ci` — Expected: FAIL (modules absents).

- [x] **Step 2: `ci-store.ts`**

```ts
import type { Database } from "bun:sqlite";
import { type CiJobSummary, type CiRun, RepoSlug } from "@kibo/schema";

export type StoredRun = Omit<CiRun, "ticketKey" | "jobs"> & { projectId: string; notified: boolean };
type RunRow = {
  repo: string;
  run_id: number;
  project_id: string;
  head_sha: string;
  pr_number: number | null;
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  started_at: string | null;
  updated_at: string;
  notified: number;
};
type JobRow = { job_id: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null };

const toRun = (r: RunRow): StoredRun => ({
  repo: RepoSlug.parse(r.repo),
  runId: r.run_id,
  projectId: r.project_id,
  headSha: r.head_sha,
  prNumber: r.pr_number,
  workflow: r.workflow,
  status: r.status,
  conclusion: r.conclusion,
  url: r.url,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  notified: r.notified === 1,
});

export function createCiStore(db: Database) {
  const q = {
    run: db.query("SELECT * FROM ci_runs WHERE repo = $repo AND run_id = $id"),
    upsertRun: db.query(
      "INSERT INTO ci_runs (repo, run_id, project_id, head_sha, head_branch, pr_number, workflow, status, conclusion, url, started_at, updated_at, notified) VALUES ($repo, $id, $project, $sha, NULL, $pr, $workflow, $status, $conclusion, $url, $started, $updated, $notified) ON CONFLICT(repo, run_id) DO UPDATE SET status = excluded.status, conclusion = excluded.conclusion, updated_at = excluded.updated_at, pr_number = excluded.pr_number",
    ),
    runsOfProject: db.query("SELECT * FROM ci_runs WHERE project_id = $project ORDER BY updated_at DESC, run_id DESC"),
    jobs: db.query("SELECT * FROM ci_jobs WHERE run_id = $run ORDER BY job_id"),
    upsertJob: db.query(
      "INSERT INTO ci_jobs (run_id, job_id, name, status, conclusion, started_at, completed_at, steps_json) VALUES ($run, $job, $name, $status, $conclusion, $started, $completed, '[]') ON CONFLICT(job_id) DO UPDATE SET status = excluded.status, conclusion = excluded.conclusion, started_at = excluded.started_at, completed_at = excluded.completed_at",
    ),
    notified: db.query("UPDATE ci_runs SET notified = 1 WHERE repo = $repo AND run_id = $id"),
    job: db.query(
      "SELECT r.repo AS repo, j.status AS status, j.log_path AS log_path FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id WHERE r.project_id = $project AND j.run_id = $run AND j.job_id = $job",
    ),
    setLog: db.query("UPDATE ci_jobs SET log_path = $path, log_fetched_at = $at WHERE job_id = $job"),
    stale: db.query("SELECT job_id, log_path FROM ci_jobs WHERE log_path IS NOT NULL AND log_fetched_at < $before"),
  };
  return {
    upsertRun(r: StoredRun): "new" | "changed" | "same" {
      const prev = q.run.get({ repo: r.repo, id: r.runId }) as RunRow | null;
      q.upsertRun.run({
        repo: r.repo,
        id: r.runId,
        project: r.projectId,
        sha: r.headSha,
        pr: r.prNumber,
        workflow: r.workflow,
        status: r.status,
        conclusion: r.conclusion,
        url: r.url,
        started: r.startedAt,
        updated: r.updatedAt,
        notified: r.notified ? 1 : 0,
      });
      if (!prev) return "new";
      return prev.updated_at === r.updatedAt && prev.status === r.status ? "same" : "changed";
    },
    upsertJobs(runId: number, jobs: CiJobSummary[]) {
      for (const j of jobs) {
        q.upsertJob.run({ run: runId, job: j.jobId, name: j.name, status: j.status, conclusion: j.conclusion, started: j.startedAt, completed: j.completedAt });
      }
    },
    runsOf(projectId: string, prNumbers: number[] | null): StoredRun[] {
      const all = (q.runsOfProject.all({ project: projectId }) as RunRow[]).map(toRun);
      return prNumbers === null ? all : all.filter((r) => r.prNumber !== null && prNumbers.includes(r.prNumber));
    },
    jobsOf: (runId: number): CiJobSummary[] =>
      (q.jobs.all({ run: runId }) as JobRow[]).map((j) => ({
        jobId: j.job_id,
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        startedAt: j.started_at,
        completedAt: j.completed_at,
      })),
    markNotified: (repo: string, runId: number) => {
      q.notified.run({ repo, id: runId });
    },
    job(projectId: string, runId: number, jobId: number) {
      const r = q.job.get({ project: projectId, run: runId, job: jobId }) as { repo: string; status: string; log_path: string | null } | null;
      return r ? { repo: RepoSlug.parse(r.repo), completed: r.status === "completed", logPath: r.log_path } : null;
    },
    setLog: (jobId: number, path: string | null, at: number | null) => {
      q.setLog.run({ job: jobId, path, at });
    },
    staleLogs: (before: number) =>
      (q.stale.all({ before }) as { job_id: number; log_path: string }[]).map((r) => ({ jobId: r.job_id, path: r.log_path })),
  };
}
export type CiStore = ReturnType<typeof createCiStore>;
```

(`as RunRow`, `as JobRow` : formes fixées par la migration de la Task 2 ; les valeurs textuelles contraintes sont revalidées par `RepoSlug.parse`.)

- [x] **Step 3: `poller.ts`**

```ts
import { type CiRun, KiboError, type RepoSlug, type TicketView } from "@kibo/schema";
import { z } from "zod";
import type { GithubApi } from "../github/api";
import type { EventLog } from "../integrations/events";
import { githubRepoOf } from "../integrations/github-remote";
import type { IntegrationHost } from "../integrations/types";
import type { CiStore, StoredRun } from "./ci-store";
import { frCi } from "./fr";

export type CiPoller = { tick(): Promise<void>; runs(projectId: string, ticketId: string | null): Promise<CiRun[]>; start(): () => void };
type Deps = { host: IntegrationHost; api: GithubApi; store: CiStore; events: EventLog; connected(): boolean };
type LinkedPr = { number: number; ticket: TicketView };

const FAST_MS = 60_000;
const SLOW_MS = 15 * 60_000;
const FRESH_MS = 15 * 60_000;
const Pull = z.object({ head: z.object({ sha: z.string().min(1) }) });
const Runs = z.object({
  workflow_runs: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      head_sha: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      html_url: z.string().url().startsWith("https://github.com/"),
      run_started_at: z.string().nullable().optional(),
      updated_at: z.string(),
    }),
  ),
});
const Jobs = z.object({
  jobs: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      started_at: z.string().nullable(),
      completed_at: z.string().nullable(),
    }),
  ),
});

function linkedPrs(tickets: TicketView[], repo: RepoSlug): LinkedPr[] {
  const prefix = `https://github.com/${repo}/pull/`;
  return tickets.flatMap((ticket) =>
    ticket.externalRefs.flatMap((ref) => (ref.kind === "github_pr" && ref.url.startsWith(prefix) ? [{ number: ref.number, ticket }] : [])),
  );
}

export function createCiPoller(deps: Deps): CiPoller {
  const { host, api, store, events } = deps;
  const lastPoll = new Map<string, number>();

  const pollPr = async (projectId: string, repo: RepoSlug, pr: LinkedPr): Promise<boolean> => {
    const head = await api.rest("GET", `/repos/${repo}/pulls/${pr.number}`, Pull);
    const { workflow_runs } = await api.rest("GET", `/repos/${repo}/actions/runs?head_sha=${head.head.sha}&per_page=20`, Runs);
    let changed = false;
    for (const r of workflow_runs) {
      const run: StoredRun = {
        repo,
        runId: r.id,
        projectId,
        headSha: r.head_sha,
        prNumber: pr.number,
        workflow: r.name,
        status: r.status,
        conclusion: r.conclusion,
        url: r.html_url,
        startedAt: r.run_started_at ?? null,
        updatedAt: r.updated_at,
        notified: false,
      };
      const seen = store.upsertRun(run);
      if (seen === "same") continue;
      changed = true;
      const { jobs } = await api.rest("GET", `/repos/${repo}/actions/runs/${r.id}/jobs`, Jobs);
      store.upsertJobs(
        r.id,
        jobs.map((j) => ({ jobId: j.id, name: j.name, status: j.status, conclusion: j.conclusion, startedAt: j.started_at, completedAt: j.completed_at })),
      );
      const failed = r.status === "completed" && r.conclusion === "failure";
      const fresh = seen === "changed" || host.now() - Date.parse(r.updated_at) < FRESH_MS;
      if (failed && fresh && !store.runsOf(projectId, [pr.number]).find((x) => x.runId === r.id)?.notified) {
        host.notify({ title: frCi.failedTitle(pr.ticket.key), body: frCi.failedBody(r.name, pr.number) });
      }
      if (failed) store.markNotified(repo, r.id);
    }
    return changed;
  };

  const pollProject = async (projectId: string) => {
    const repo = await githubRepoOf(host, projectId);
    if (!repo) return;
    const prs = linkedPrs(host.snapshot(projectId).tickets, repo);
    if (prs.length === 0) return;
    const active = prs.some((p) => p.ticket.statusId !== "done");
    const last = lastPoll.get(projectId);
    if (last !== undefined && host.now() - last < (active ? FAST_MS : SLOW_MS)) return;
    lastPoll.set(projectId, host.now());
    let changed = false;
    for (const pr of prs) if (await pollPr(projectId, repo, pr)) changed = true;
    if (changed) host.broadcast({ type: "ci", projectId });
  };

  const poller: CiPoller = {
    async tick() {
      if (!deps.connected()) return;
      for (const p of host.projects()) {
        try {
          await pollProject(p.id);
        } catch (e) {
          const k = e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));
          events.log("github-actions", k.code === "RATE_LIMITED" ? "warn" : "error", `${p.id}: ${k.detail}`);
        }
      }
    },
    async runs(projectId, ticketId) {
      const repo = await githubRepoOf(host, projectId);
      if (!repo) return [];
      const prs = linkedPrs(host.snapshot(projectId).tickets, repo).filter((p) => ticketId === null || p.ticket.id === ticketId);
      const keyOf = new Map(prs.map((p) => [p.number, p.ticket.key]));
      return store.runsOf(projectId, prs.map((p) => p.number)).map(({ projectId: _p, notified: _n, ...r }) => ({
        ...r,
        ticketKey: r.prNumber === null ? null : (keyOf.get(r.prNumber) ?? null),
        jobs: store.jobsOf(r.runId),
      }));
    },
    start() {
      const timer = setInterval(() => {
        poller.tick().catch((e) => events.log("github-actions", "error", String(e)));
      }, FAST_MS);
      return () => clearInterval(timer);
    },
  };
  return poller;
}
```

Précisions :
- `tick` journalise l'échec d'un projet (converti en `KiboError`) et passe au suivant : un dépôt inaccessible ne bloque pas les autres ; l'erreur est visible dans le journal de l'intégration.
- Un run « déjà terminé en échec » vu pour la première fois il y a plus de 15 min est marqué notifié sans événement (pas de rafale à la première connexion).

`packages/daemon/src/ci/fr.ts` (textes affichés en français, comme `agents/fr.ts`) :

```ts
export const frCi = {
  failedTitle: (key: string) => `CI cassée sur ${key}`,
  failedBody: (workflow: string, pr: number) => `${workflow} a échoué sur la PR #${pr}.`,
};
```

`host.notify` (Task 2, N25) envoie la notification native (`DaemonOptions.notify`, Tauri) et la diffuse à l'UI (`IntegrationEvent` `notice`, API `Notification` en mode navigateur).

- [x] **Step 4: `logs.ts`**

```ts
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CiLog, githubError, KiboError } from "@kibo/schema";
import type { GithubApi } from "../github/api";
import { GITHUB_LOG_RULES } from "../integrations/net";
import type { IntegrationHost } from "../integrations/types";
import type { CiStore } from "./ci-store";

export const MAX_LOG_BYTES = 20 * 1024 * 1024;
export const LOG_RETENTION_MS = 14 * 24 * 3_600_000;
type Deps = { host: IntegrationHost; api: GithubApi; store: CiStore };
const ERROR_LINE = /##\[error\]|\b(error|fatal|failed)\b/i;

export function errorLinesOf(text: string): number[] {
  return text.split("\n").flatMap((line, i) => (ERROR_LINE.test(line) ? [i + 1] : []));
}

const toLog = (text: string, truncated: boolean): CiLog => ({ text, truncated, errorLines: errorLinesOf(text) });

export async function readCiLog(deps: Deps, projectId: string, runId: number, jobId: number): Promise<CiLog> {
  const job = deps.store.job(projectId, runId, jobId);
  if (!job) throw new KiboError("NOT_FOUND", `ci job ${jobId} not found`);
  if (job.logPath && existsSync(job.logPath)) {
    return toLog(readFileSync(job.logPath, "utf8"), statSync(job.logPath).size >= MAX_LOG_BYTES);
  }
  const res = await deps.api.raw(`/repos/${job.repo}/actions/jobs/${jobId}/logs`, GITHUB_LOG_RULES, MAX_LOG_BYTES);
  const text = new TextDecoder().decode(res.body);
  if (res.status < 200 || res.status >= 300) throw githubError(res.status, (n) => res.headers.get(n), text);
  if (job.completed) {
    const path = join(deps.host.home, "cache", "ci", String(runId), `${jobId}.log`);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, res.body, { mode: 0o600 });
    chmodSync(path, 0o600);
    deps.store.setLog(jobId, path, deps.host.now());
  }
  return toLog(text, res.truncated);
}

export function purgeCiLogs(deps: Pick<Deps, "store">, now: number): void {
  for (const { jobId, path } of deps.store.staleLogs(now - LOG_RETENTION_MS)) {
    rmSync(path, { force: true });
    deps.store.setLog(jobId, null, null);
  }
}
```

(`chmodSync` après l'écriture : `mode` n'est appliqué qu'à la création du fichier, et l'umask peut le réduire.)

- [x] **Step 5: `module.ts` et amorçage**

```ts
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { CiStore } from "./ci-store";
import { purgeCiLogs, readCiLog } from "./logs";
import type { CiPoller } from "./poller";

export function ciModule(kit: IntegrationKit, poller: CiPoller, store: CiStore): IntegrationModule {
  const deps = { host: kit.host, api: kit.github.api, store };
  purgeCiLogs(deps, kit.host.now());
  const stopPoller = poller.start();
  const purge = setInterval(() => purgeCiLogs(deps, kit.host.now()), 24 * 3_600_000);
  return {
    handlers: {
      listCiRuns: (req) => poller.runs(req.projectId, req.ticketId),
      getCiLog: (req) => readCiLog(deps, req.projectId, req.runId, req.jobId),
    },
    stop() {
      stopPoller();
      clearInterval(purge);
    },
  };
}
```

`packages/daemon/src/integrations/bootstrap.ts`, avant le `kit` (après `github`) :

```ts
  const ciStore = createCiStore(host.db);
  const ciPoller = createCiPoller({ host, api: github.api, store: ciStore, events, connected: () => account.mode() !== null });
```

puis `hooks.ciRuns: (projectId) => ciPoller.runs(projectId, null)` et `ciModule(kit, ciPoller, ciStore)` dans `modules`.

Aucune règle de statut par défaut (spec F §7) et aucune règle ajoutée à `DEFAULT_RULES` (N25).

- [x] **Step 6: Vérifier et commiter**

Run: `bun test packages/daemon/src/ci && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/ci packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): runs et logs GitHub Actions"
```

---

### Task 17: Écran 3 · Source synchronisée

Référence : maquette P6, sombre et clair. Le choix de source n'apparaît que pour les composants qui affichent des tickets (`kanban`, `tickets`).

**Files:**
- Create: `packages/ui/src/dialogs/sync/{status-map.ts,status-map.test.ts,SourcePicker.tsx,SyncSourceForm.tsx,use-sync-progress.ts,SyncSource.test.tsx}`
- Modify: `packages/ui/src/dialogs/AddComponentDialog.tsx` (le bloc « Source des tickets » de `Details`, aujourd'hui un `Segment` désactivé « Disponible avec les intégrations », devient le vrai choix de source), `packages/ui/src/pages/PageView.tsx` (passe `workflow={project.workflow}`), `packages/ui/src/i18n/fr-components.ts` (retire `addComponent.source`, `sourceLocal`, `sourceSynced`, `sourceSoon`, remplacés par `fr.integrations.source`), `packages/ui/src/dialogs/component-dialogs.test.tsx` (le radio désactivé « Synchronisé · GitHub Issues » n'existe plus ; le faux client répond à `getGithubConnectOptions` et expose `subscribeIntegrations`)

`Checkbox` existe déjà (`packages/sdk/src/ui/checkbox.tsx`, phase 1) : pas de création.

**Interfaces:**
- Consumes: RPC `getGithubConnectOptions`, `listGithubRepos`, `listGithubProjects`, `createBinding`, `getSyncState`, `command` (Task 1) ; `BindingConfig`, `GithubProject`, `StatusMap` (Task 1), `Status`, `DEFAULT_WORKFLOW` (`packages/schema/src/status.ts`) ; `client.subscribeIntegrations` (Task 2, N24) ; `fr.integrations.source` (Task 1) ; `ChoiceCard` (`packages/ui/src/dialogs/ChoiceCard.tsx`) ; `StatusDot` (`@kibo/sdk`, `packages/sdk/src/status.tsx`) ; `Checkbox` (`@kibo/sdk/ui/checkbox`, existant) ; `navigateTo` (`packages/ui/src/route.ts`) et l'écran `integrations` (Task 10, N30).
- Produces:
  - `prefillStatusMap(workflow: Status[], options: { id: string; name: string }[]): StatusMap` ; `parseLabels(text: string): string[]`
  - `type SyncForm = { repo: RepoSlug | null; project: GithubProject | null; statusMap: StatusMap; labels: string; importClosed: boolean }` ; `EMPTY_SYNC_FORM` ; `toBindingConfig(f: SyncForm): BindingConfig | null`
  - `useSyncProgress(bindingId: string | null): { imported: number; running: boolean } | null`
  - `SourcePicker({ value, onValueChange, connected, onOpenSettings })`, `SyncSourceForm({ workflow, value, onChange })`
  - `SYNCABLE_COMPONENTS = ["kanban", "tickets"]`
  - `AddComponentDialog` gagne la prop facultative `workflow?: Status[]` (défaut `DEFAULT_WORKFLOW`)

- [x] **Step 1: Tests purs (échouent)**

`packages/ui/src/dialogs/sync/status-map.test.ts` :

```ts
import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW } from "@kibo/schema";
import { EMPTY_SYNC_FORM, parseLabels, prefillStatusMap, toBindingConfig } from "./status-map";

const options = [
  { id: "o1", name: "À faire" },
  { id: "o2", name: " en cours " },
  { id: "o3", name: "Done" },
];

test("statuses are prefilled by identical labels only", () => {
  expect(prefillStatusMap(DEFAULT_WORKFLOW, options)).toEqual({ todo: "o1", in_progress: "o2" });
});

test("labels are split, trimmed, deduplicated", () => {
  expect(parseLabels(" bug, ui ,bug,, ")).toEqual(["bug", "ui"]);
});

test("the form becomes a binding config", () => {
  expect(toBindingConfig(EMPTY_SYNC_FORM)).toBeNull();
  expect(toBindingConfig({ ...EMPTY_SYNC_FORM, repo: "adam/kibo", labels: "bug" })).toEqual({
    repo: "adam/kibo",
    project: null,
    importClosed: false,
    labels: ["bug"],
  });
  const project = { owner: "adam", number: 3, nodeId: "PVT_1", title: "Roadmap", statusField: { id: "F1", options } };
  expect(toBindingConfig({ ...EMPTY_SYNC_FORM, repo: "adam/kibo", project, statusMap: { todo: "o1" } })?.project).toEqual({
    owner: "adam",
    number: 3,
    nodeId: "PVT_1",
    statusFieldId: "F1",
    statusMap: { todo: "o1" },
  });
});
```

Run: `bun test packages/ui/src/dialogs/sync/status-map.test.ts` — Expected: FAIL.

- [x] **Step 2: `status-map.ts`**

```ts
import { BindingConfig, type GithubProject, type RepoSlug, type Status, type StatusMap } from "@kibo/schema";

export const SYNCABLE_COMPONENTS: readonly string[] = ["kanban", "tickets"];
export type SyncForm = { repo: RepoSlug | null; project: GithubProject | null; statusMap: StatusMap; labels: string; importClosed: boolean };
export const EMPTY_SYNC_FORM: SyncForm = { repo: null, project: null, statusMap: {}, labels: "", importClosed: false };

const norm = (s: string) => s.trim().toLocaleLowerCase("fr");

export function prefillStatusMap(workflow: Status[], options: { id: string; name: string }[]): StatusMap {
  const map: StatusMap = {};
  for (const s of workflow) {
    const o = options.find((x) => norm(x.name) === norm(s.label));
    if (o) map[s.id] = o.id;
  }
  return map;
}

export function parseLabels(text: string): string[] {
  return [...new Set(text.split(",").map((l) => l.trim()).filter((l) => l.length > 0))].slice(0, 20);
}

export function toBindingConfig(f: SyncForm): BindingConfig | null {
  if (f.repo === null) return null;
  const field = f.project?.statusField ?? null;
  return BindingConfig.parse({
    repo: f.repo,
    project:
      f.project && field
        ? { owner: f.project.owner, number: f.project.number, nodeId: f.project.nodeId, statusFieldId: field.id, statusMap: f.statusMap }
        : null,
    importClosed: f.importClosed,
    labels: parseLabels(f.labels),
  });
}
```

Run: `bun test packages/ui/src/dialogs/sync/status-map.test.ts` — Expected: PASS.

- [x] **Step 3: Test du dialogue (échoue)**

`packages/ui/src/dialogs/sync/SyncSource.test.tsx` :

```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { IntegrationEvent, RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let listener: ((e: IntegrationEvent) => void) | null = null;
let connected = true;
const binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: ["bug"] },
  createdBy: "adam",
  runner: "adam",
};
const replies: Record<string, () => unknown> = {
  getGithubConnectOptions: () => ({ ghAvailable: true, ghLogin: "adam", mode: connected ? "gh" : null }),
  listGithubRepos: () => [
    { fullName: "adam/kibo", private: false, description: null },
    { fullName: "adam/site", private: true, description: null },
  ],
  listGithubProjects: () => [],
  createBinding: () => binding,
  command: () => ({ id: "i1" }),
  listComponents: () => [],
  listDrafts: () => [],
  getSyncState: () => ({
    bindings: [{ bindingId: "b1", repo: "adam/kibo", runner: "adam", running: false, lastPullAt: 1, lastError: null, imported: 12, resumeAt: null }],
    pending: [],
    errors: [],
  }),
};

mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return replies[req.method]?.() ?? null;
    },
    subscribe: () => () => undefined,
    subscribeIntegrations: (l: (e: IntegrationEvent) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  },
}));

const { AddComponentDialog } = await import("../AddComponentDialog");
const page = { id: "pg1", title: "Vue", kind: "view", parentId: null } as const;

beforeEach(() => {
  calls.length = 0;
  listener = null;
  connected = true;
});

test("a synced Kanban creates the binding, the instance, then shows progress", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  await user.type(screen.getByPlaceholderText("Filtrer les dépôts…"), "kibo");
  expect(screen.queryByRole("radio", { name: "adam/site" })).toBeNull();
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  await user.type(screen.getByLabelText("Filtrer par libellés"), "bug");
  await user.click(screen.getByRole("button", { name: "Ajouter et synchroniser" }));
  expect(calls.filter((c) => c.method === "createBinding" || c.method === "command")).toEqual([
    { method: "createBinding", projectId: "p1", config: { repo: "adam/kibo", project: null, importClosed: false, labels: ["bug"] } },
    {
      method: "command",
      projectId: "p1",
      command: { method: "addInstance", pageId: "pg1", component: "kanban@1.0.0", config: { source: { bindingId: "b1" } } },
    },
  ]);
  act(() => listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 12, running: true }));
  expect(await screen.findByText("Synchronisation… 12 issues importées")).toBeDefined();
  act(() => listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 12, running: false }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("without a GitHub account the synced source explains how to connect", async () => {
  connected = false;
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(await screen.findByText("Connecte GitHub dans Paramètres › Intégrations pour synchroniser.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Ouvrir les intégrations" })).toBeDefined();
  expect(screen.getByRole("radio", { name: "Synchronisée · GitHub Issues" }).hasAttribute("disabled")).toBe(true);
});

test("components that do not show tickets have no source choice", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Graphe de dépendances" }));
  expect(screen.queryByText("Source")).toBeNull();
  expect(calls.some((c) => c.method === "getGithubConnectOptions")).toBe(false);
});
```

Run: `bun test packages/ui/src/dialogs/sync` — Expected: FAIL.

- [x] **Step 4: `use-sync-progress.ts`**

`packages/ui/src/dialogs/sync/use-sync-progress.ts` :

```ts
import { useEffect, useState } from "react";
import { client } from "../../api";

export function useSyncProgress(bindingId: string | null): { imported: number; running: boolean } | null {
  const [progress, setProgress] = useState<{ imported: number; running: boolean } | null>(null);
  useEffect(() => {
    setProgress(null);
    if (bindingId === null) return;
    return client.subscribeIntegrations((e) => {
      if (e.type === "sync" && e.bindingId === bindingId) setProgress({ imported: e.imported, running: e.running });
    });
  }, [bindingId]);
  return progress;
}
```

(`subscribeIntegrations` ne livre que des `IntegrationEvent` validés par le client, Task 2.)

- [x] **Step 5: `SourcePicker.tsx`**

```tsx
import { Button } from "@kibo/sdk/ui/button";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { HardDrive, ListTodo } from "lucide-react";
import { fr } from "../../i18n/fr";
import { ChoiceCard } from "../ChoiceCard";

export type SourceKind = "local" | "synced";
type Props = { value: SourceKind; onValueChange(v: SourceKind): void; connected: boolean; onOpenSettings(): void };
const t = fr.integrations.source;

export function SourcePicker({ value, onValueChange, connected, onOpenSettings }: Props) {
  return (
    <section className="grid gap-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{t.title}</p>
      <RadioGroup
        value={value}
        onValueChange={(v) => onValueChange(v === "synced" ? "synced" : "local")}
        className="grid gap-2 sm:grid-cols-2"
      >
        <ChoiceCard value="local" icon={HardDrive} title={t.local} description={t.localHelp} />
        <ChoiceCard value="synced" icon={ListTodo} title={t.synced} description={t.syncedHelp} disabled={!connected} />
      </RadioGroup>
      {!connected && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t.notConnected}
          <Button variant="link" className="h-auto p-0" onClick={onOpenSettings}>
            {t.openSettings}
          </Button>
        </p>
      )}
    </section>
  );
}
```

(Icônes : `ListTodo`, celle de la ligne « GitHub Issues & Projects » de l'écran 16, et `HardDrive` pour Locale ; Lucide 1.x n'a plus d'icônes de marque, N15. Le radio porte `aria-label={title}` par `ChoiceCard`.)

- [x] **Step 6: `SyncSourceForm.tsx`**

```tsx
import type { GithubProject, GithubRepo, Status, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { prefillStatusMap, type SyncForm } from "./status-map";

type Props = { workflow: Status[]; value: SyncForm; onChange(f: SyncForm): void; onError(message: string): void };
const t = fr.integrations.source;
const NONE = "__none";

type RepoListProps = { labelledBy: string; value: string | null; onChange(r: GithubRepo): void; onError(m: string): void };

function RepoList({ labelledBy, value, onChange, onError }: RepoListProps) {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "listGithubRepos", query })
      .then((r) => live && setRepos(r))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [query, onError]);
  const shown = repos.filter((r) => r.fullName.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="grid gap-2">
      <Input placeholder={t.repoSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
      <RadioGroup
        aria-labelledby={labelledBy}
        value={value ?? ""}
        onValueChange={(v) => {
          const r = repos.find((x) => x.fullName === v);
          if (r) onChange(r);
        }}
        className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-1"
      >
        {shown.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t.repoEmpty}</p>}
        {shown.map((r) => (
          <label key={r.fullName} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
            <RadioGroupItem value={r.fullName} aria-label={r.fullName} />
            <span className="font-mono">{r.fullName}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

export function SyncSourceForm({ workflow, value, onChange, onError }: Props) {
  const ids = { repo: useId(), project: useId(), labels: useId(), closed: useId() };
  const [projects, setProjects] = useState<GithubProject[]>([]);
  useEffect(() => {
    setProjects([]);
    if (value.repo === null) return;
    let live = true;
    client
      .rpc({ method: "listGithubProjects", repo: value.repo })
      .then((p) => live && setProjects(p))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [value.repo, onError]);
  const pickProject = (nodeId: string) => {
    const project = projects.find((p) => p.nodeId === nodeId) ?? null;
    onChange({ ...value, project, statusMap: project?.statusField ? prefillStatusMap(workflow, project.statusField.options) : {} });
  };
  const setOption = (status: StatusId, option: string) => {
    const statusMap = { ...value.statusMap };
    if (option === NONE) delete statusMap[status];
    else statusMap[status] = option;
    onChange({ ...value, statusMap });
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p id={ids.repo} className="text-sm font-medium">
          {t.repo}
        </p>
        <RepoList labelledBy={ids.repo} value={value.repo} onChange={(r) => onChange({ ...value, repo: r.fullName, project: null, statusMap: {} })} onError={onError} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.project}>{t.project}</Label>
        <Select value={value.project?.nodeId ?? NONE} onValueChange={(v) => (v === NONE ? pickProject("") : pickProject(v))} disabled={value.repo === null}>
          <SelectTrigger id={ids.project}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t.noProject}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.nodeId} value={p.nodeId} disabled={p.statusField === null}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.project?.statusField && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t.statusMap}</legend>
          <p className="text-xs text-muted-foreground">{t.statusMapHelp}</p>
          <div className="grid grid-cols-[1fr_1fr] items-center gap-2">
            {workflow.map((s) => (
              <StatusRow key={s.id} status={s} options={value.project?.statusField?.options ?? []} value={value.statusMap[s.id] ?? NONE} onChange={(o) => setOption(s.id, o)} />
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-2">
        <Label htmlFor={ids.labels}>{t.labels}</Label>
        <Input id={ids.labels} value={value.labels} onChange={(e) => onChange({ ...value, labels: e.target.value })} />
        <p className="text-xs text-muted-foreground">{t.labelsHelp}</p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={ids.closed} checked={value.importClosed} onCheckedChange={(c) => onChange({ ...value, importClosed: c === true })} />
        <Label htmlFor={ids.closed}>{t.importClosed}</Label>
      </div>
    </div>
  );
}

function StatusRow({ status, options, value, onChange }: { status: Status; options: { id: string; name: string }[]; value: string; onChange(v: string): void }) {
  const id = useId();
  return (
    <>
      <Label htmlFor={id} className="flex items-center gap-2 font-normal">
        <StatusDot statusId={status.id} />
        {status.label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t.unmapped}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
```

Précisions : la pastille de statut est le `StatusDot` du SDK (mêmes couleurs que les colonnes du Kanban) ; `onError` est stable (`useCallback` dans le parent) pour ne pas relancer les requêtes. `RepoList` est dans ce fichier (< 300 lignes au total) ; s'il dépasse, le sortir en `RepoList.tsx`.

- [x] **Step 7: Brancher dans `AddComponentDialog.tsx`**

Le fichier réel (241 lignes) a un panneau `Details({ choice, page })` qui affiche, pour tout composant qui lit `ticket`, un bloc « Source des tickets » en `Segment` avec « Synchronisé · GitHub Issues » désactivé (« Disponible avec les intégrations »). La sélection est un `Choice` (`catalog-choices.ts` : `ref`, `id`, `title`, `reads`, `pending`…) et l'ajout passe par `addInstance(component)` (directement, ou après `TrustDialog` pour une version à autoriser). Le choix de source remplace ce bloc ; au-delà de ~300 lignes, sortir `Details` dans `dialogs/ComponentDetails.tsx`.

Imports ajoutés :

```tsx
import { type Binding, DEFAULT_WORKFLOW, type Status } from "@kibo/schema";
import { useCallback, useEffect } from "react";
import { navigateTo } from "../route";
import { type SourceKind, SourcePicker } from "./sync/SourcePicker";
import { SyncSourceForm } from "./sync/SyncSourceForm";
import { EMPTY_SYNC_FORM, SYNCABLE_COMPONENTS, type SyncForm, toBindingConfig } from "./sync/status-map";
import { useSyncProgress } from "./sync/use-sync-progress";
```

`Props` gagne `workflow?: Status[]` ; `PageView.tsx` passe `workflow={project.workflow}` (les libellés comparés sont ceux du projet).

`Details` perd son bloc « Source » (`choice.reads.includes("ticket")` et le `Segment`) et reçoit un nœud `source?: ReactNode` rendu à la même place. Dans `AddComponentDialog` :

```tsx
  const [source, setSource] = useState<SourceKind>("local");
  const [form, setForm] = useState<SyncForm>(EMPTY_SYNC_FORM);
  const [connected, setConnected] = useState(false);
  const [binding, setBinding] = useState<Binding | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const progress = useSyncProgress(binding?.id ?? null);
  const syncable = selected !== null && SYNCABLE_COMPONENTS.includes(selected.id);
  const synced = syncable && source === "synced";
  const onFormError = useCallback((m: string) => setSyncError(m), []);
  const openIntegrationSettings = () => {
    onOpenChange(false);
    navigateTo({ kind: "screen", screen: "integrations" });
  };

  useEffect(() => {
    if (!open || !syncable) return;
    client
      .rpc({ method: "getGithubConnectOptions" })
      .then((o) => setConnected(o.mode !== null))
      .catch((e: unknown) => setSyncError(e instanceof Error ? e.message : String(e)));
  }, [open, syncable]);

  useEffect(() => {
    if (!binding || !progress || progress.running) return;
    client
      .rpc({ method: "getSyncState", projectId })
      .then((s) => {
        const b = s.bindings.find((x) => x.bindingId === binding.id);
        if (b?.lastError) setSyncError(`${fr.integrations.source.failed} ${b.lastError.message}`);
        else onOpenChange(false);
      })
      .catch((e: unknown) => setSyncError(e instanceof Error ? e.message : String(e)));
  }, [binding, progress, projectId, onOpenChange]);
```

`addInstance` devient (le `console.error(e)` existant est gardé : l'erreur n'est pas avalée, elle est journalisée et affichée) :

```tsx
  const addInstance = async (component: string) => {
    setFailed(false);
    setSyncError(null);
    try {
      const config = synced ? toBindingConfig(form) : null;
      const created = config ? await client.rpc({ method: "createBinding", projectId, config }) : null;
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
          ...(created && { config: { source: { bindingId: created.id } } }),
        },
      });
      if (created) {
        setBinding(created);
        return;
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
```

Rendu : `Details` reçoit

```tsx
          source={
            syncable ? (
              <div className="grid gap-4">
                <SourcePicker value={source} onValueChange={setSource} connected={connected} onOpenSettings={openIntegrationSettings} />
                {synced && <SyncSourceForm workflow={workflow ?? DEFAULT_WORKFLOW} value={form} onChange={setForm} onError={onFormError} />}
              </div>
            ) : null
          }
```

et, sous la grille, à côté de l'alerte `failed` existante :

```tsx
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {progress.running ? fr.integrations.source.progress(progress.imported) : fr.integrations.source.done(progress.imported)}
            </p>
          )}
          {syncError && (
            <p role="alert" className="text-sm text-destructive">
              {syncError}
            </p>
          )}
```

Bouton principal : libellé `synced ? fr.integrations.source.submit : a.submit`, désactivé si `!selected || (synced && toBindingConfig(form) === null) || binding !== null`. Le flux `TrustDialog` (version à autoriser) est inchangé ; il ne concerne jamais Kanban et Tickets (intégrés).

`fr-components.ts` : retirer `source`, `sourceLocal`, `sourceSynced`, `sourceSoon` de `addComponent` (plus aucun usage). `component-dialogs.test.tsx` : l'assertion sur le radio désactivé « Synchronisé · GitHub Issues » devient `expect(screen.getByRole("radio", { name: "Synchronisée · GitHub Issues" })).toBeTruthy()` ; le faux `client` gagne `subscribeIntegrations: () => () => undefined` et répond `{ ghAvailable: false, ghLogin: null, mode: null }` à `getGithubConnectOptions`.

- [x] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel : écran 3 avec Kanban choisi, source synchronisée ouverte, en sombre puis en clair, comparé à P6.

```bash
git add packages/ui/src/dialogs/sync packages/ui/src/dialogs/AddComponentDialog.tsx packages/ui/src/dialogs/component-dialogs.test.tsx packages/ui/src/pages/PageView.tsx packages/ui/src/i18n/fr-components.ts
git commit -m "feat(ui): source synchronisée à l'ajout"
```

Dépendances : Tasks 1, 2 (`subscribeIntegrations`), 10 (écran `integrations` pour le lien « Ouvrir les intégrations ») ; les RPC `listGithubRepos`/`createBinding` ne sont appelées qu'au travers du faux client dans les tests.

---

### Task 18: Sheet ticket · GitHub, CI, Maquettes

Références : maquettes P7, P8, P9 (sombre et clair) et page PDF 4 (Sheet ticket). Le contenu du Sheet est `packages/ui/src/shell/TicketDetail.tsx` (partagé par `TicketSheet.tsx` et l'onglet ticket `pages/TicketTab.tsx`) : les sections s'y insèrent, donc apparaissent aussi dans l'onglet. État réel : une liste `dl` (Statut, Domaine, Motif de blocage, En attente de, **PR** : chips `#12` des réfs `github_pr` livrés par la phase 3), puis Description (texte brut par `LinkifiedText`, jamais de HTML), puis Sous-tickets. Il n'y a pas de section « Dépendances ».

**Files:**
- Create: `packages/ui/src/shell/sheet/{GithubRefs.tsx,SyncStatus.tsx,CiSection.tsx,CiLogSheet.tsx,FigmaSection.tsx,log-lines.ts,ci-format.ts}`
- Test: `packages/ui/src/shell/sheet/{log-lines.test.ts,ci-format.test.ts,sheet-integrations.test.tsx}`
- Modify: `packages/ui/src/shell/TicketDetail.tsx`, `packages/ui/src/i18n/fr-integrations.ts` (clé `sheet.issueProperty`)

**Interfaces:**
- Consumes: RPC `getSyncState`, `resolveOutbox`, `listCiRuns`, `getCiLog`, `linkFigmaNode`, `getFigmaPreview`, `command` (`removeExternalRef`, réservée mais permise au shell : `assertShellCommand` ne refuse que `setInstanceComponent`/`setInstanceData`) (Task 1, Task 4) ; `githubIssueState`, `GithubIssueRef`, `FigmaNodeRef`, `CiRun`, `SyncState` (Task 1) ; `externalRefKey` (Task 4) ; `client.subscribeIntegrations` (Task 2, N24) ; `useSyncState`, `Switch` (Task 10) ; `fr.integrations.sheet`.
- Produces:
  - `visibleLines(log: CiLog, query: string, errorsOnly: boolean): { n: number; text: string; error: boolean }[]`
  - `formatDuration(ms: number): string` ; `runTone(run: Pick<CiRun, "status" | "conclusion">): "ok" | "error" | "running" | "neutral"` ; `latestPerWorkflow(runs: CiRun[]): CiRun[]` ; `conclusionLabel(run): string`
  - `GithubRefs({ ticket })` (chips d'issue seulement : les chips de PR restent ceux de la phase 3), `SyncStatus({ projectId, ticket })`, `CiSection({ projectId, ticketId })`, `CiLogSheet({ projectId, run, job, onClose })`, `FigmaSection({ projectId, ticket })`, `FigmaProperty({ ticket })`

- [ ] **Step 1: Tests purs (échouent)**

`packages/ui/src/shell/sheet/log-lines.test.ts` :

```ts
import { expect, test } from "bun:test";
import { visibleLines } from "./log-lines";

const log = { text: "setup\n##[error]Test failed\nnpm ERR! code 1\ndone", truncated: false, errorLines: [2, 3] };

test("numbers lines and flags errors", () => {
  expect(visibleLines(log, "", false)).toEqual([
    { n: 1, text: "setup", error: false },
    { n: 2, text: "##[error]Test failed", error: true },
    { n: 3, text: "npm ERR! code 1", error: true },
    { n: 4, text: "done", error: false },
  ]);
});

test("filters by errors and by a case-insensitive query", () => {
  expect(visibleLines(log, "", true).map((l) => l.n)).toEqual([2, 3]);
  expect(visibleLines(log, "NPM", false).map((l) => l.n)).toEqual([3]);
  expect(visibleLines(log, "setup", true)).toEqual([]);
});
```

`packages/ui/src/shell/sheet/ci-format.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { CiRun } from "@kibo/schema";
import { formatDuration, latestPerWorkflow, runTone } from "./ci-format";

test("durations read like the mockup", () => {
  expect(formatDuration(45_000)).toBe("45 s");
  expect(formatDuration(192_000)).toBe("3 min 12 s");
  expect(formatDuration(3_720_000)).toBe("1 h 02 min");
});

test("tone follows status then conclusion", () => {
  expect(runTone({ status: "in_progress", conclusion: null })).toBe("running");
  expect(runTone({ status: "queued", conclusion: null })).toBe("running");
  expect(runTone({ status: "completed", conclusion: "success" })).toBe("ok");
  expect(runTone({ status: "completed", conclusion: "failure" })).toBe("error");
  expect(runTone({ status: "completed", conclusion: "timed_out" })).toBe("error");
  expect(runTone({ status: "completed", conclusion: "skipped" })).toBe("neutral");
});

test("keeps the latest run of each workflow", () => {
  const run = (runId: number, workflow: string, updatedAt: string) =>
    ({ runId, workflow, updatedAt, status: "completed", conclusion: "success", jobs: [] }) as unknown as CiRun;
  const out = latestPerWorkflow([run(1, "CI", "2026-09-26T10:00:00Z"), run(2, "CI", "2026-09-26T11:00:00Z"), run(3, "Lint", "2026-09-26T09:00:00Z")]);
  expect(out.map((r) => r.runId)).toEqual([2, 3]);
});
```

(`as unknown as CiRun` : fixture partielle de test, seuls les champs lus sont fournis.)

Run: `bun test packages/ui/src/shell/sheet` — Expected: FAIL.

- [ ] **Step 2: `log-lines.ts` et `ci-format.ts`**

`packages/ui/src/shell/sheet/log-lines.ts` :

```ts
import type { CiLog } from "@kibo/schema";

export function visibleLines(log: CiLog, query: string, errorsOnly: boolean): { n: number; text: string; error: boolean }[] {
  const errors = new Set(log.errorLines);
  const q = query.trim().toLowerCase();
  return log.text
    .replace(/\n$/, "")
    .split("\n")
    .map((text, i) => ({ n: i + 1, text, error: errors.has(i + 1) }))
    .filter((l) => (!errorsOnly || l.error) && (q === "" || l.text.toLowerCase().includes(q)));
}
```

`packages/ui/src/shell/sheet/ci-format.ts` :

```ts
import type { CiRun } from "@kibo/schema";
import { fr } from "../../i18n/fr";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min`;
}

export function runTone(run: Pick<CiRun, "status" | "conclusion">): "ok" | "error" | "running" | "neutral" {
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "ok";
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") return "error";
  return "neutral";
}

export function conclusionLabel(run: Pick<CiRun, "status" | "conclusion">): string {
  const c = fr.integrations.sheet.conclusion;
  if (run.status === "queued" || run.status === "waiting" || run.status === "pending") return c.queued;
  if (run.status !== "completed") return c.running;
  const key = run.conclusion ?? "neutral";
  return key in c ? c[key as keyof typeof c] : key;
}

export function latestPerWorkflow(runs: CiRun[]): CiRun[] {
  const byName = new Map<string, CiRun>();
  for (const r of runs) {
    const prev = byName.get(r.workflow);
    if (!prev || prev.updatedAt < r.updatedAt) byName.set(r.workflow, r);
  }
  return [...byName.values()].sort((a, b) => a.workflow.localeCompare(b.workflow));
}
```

(`key as keyof typeof c` : garde `key in c` juste avant ; une conclusion inconnue de GitHub s'affiche brute.)

Run: `bun test packages/ui/src/shell/sheet/log-lines.test.ts packages/ui/src/shell/sheet/ci-format.test.ts` — Expected: PASS.

- [ ] **Step 3: Test du Sheet (échoue)**

`packages/ui/src/shell/sheet/sheet-integrations.test.tsx` :

```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
const replies: Record<string, (req: RpcRequest) => unknown> = {
  getSyncState: () => ({
    bindings: [],
    pending: ["t1"],
    errors: [{ outboxId: 7, ticketId: "t1", code: "REMOTE_REJECTED", message: "github 422: Validation Failed" }],
  }),
  listCiRuns: () => [
    {
      repo: "adam/kibo",
      runId: 900,
      prNumber: 12,
      ticketKey: "KIB-1",
      headSha: "abc",
      workflow: "CI",
      status: "completed",
      conclusion: "failure",
      url: "https://github.com/adam/kibo/actions/runs/900",
      startedAt: "2026-09-26T10:00:00Z",
      updatedAt: "2026-09-26T10:03:12Z",
      jobs: [{ jobId: 70, name: "build", status: "completed", conclusion: "failure", startedAt: "2026-09-26T10:00:00Z", completedAt: "2026-09-26T10:03:12Z" }],
    },
  ],
  getCiLog: () => ({ text: "setup\n##[error]Test failed\ndone\n", truncated: false, errorLines: [2] }),
  getFigmaPreview: () => ({ png: null, fetchedAt: null, reachable: false, available: false }),
  linkFigmaNode: () => {
    throw new KiboError("INVALID_INPUT", "not a figma node url");
  },
};
mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return replies[req.method]?.(req) ?? null;
    },
    subscribeIntegrations: () => () => undefined,
  },
}));

const { TicketDetail } = await import("../TicketDetail");

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-2",
  tickets: [
    {
      id: "t1",
      key: "KIB-1",
      title: "Arbre",
      description: "<img src=x onerror=alert(1)> **gras**",
      statusId: "in_progress",
      parentId: null,
      assignee: null,
      domainId: null,
      blockedReason: null,
      externalRefs: [
        { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 42, nodeId: "I_42", url: "https://github.com/adam/kibo/issues/42" },
        { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
        { kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34", name: "Tickets / Arbre" },
      ],
      progress: { done: 0, total: 0 },
      waitingOn: [],
    },
  ],
} as unknown as ProjectSnapshot;
const [ticket] = project.tickets;
if (!ticket) throw new Error("fixture has a ticket");
const show = () => render(<TicketDetail project={project} ticket={ticket} onOpenFile={() => {}} />);

beforeEach(() => {
  calls.length = 0;
});

test("GitHub chips link to the issue and the PR", () => {
  show();
  expect(screen.getByRole("link", { name: "#42" }).getAttribute("href")).toBe("https://github.com/adam/kibo/issues/42");
  expect(screen.getByRole("link", { name: "#12" }).getAttribute("href")).toBe("https://github.com/adam/kibo/pull/12");
});

test("a sync failure can be retried", async () => {
  show();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("github 422: Validation Failed");
  await userEvent.setup().click(within(alert).getByRole("button", { name: "Réessayer" }));
  expect(calls).toContainEqual({ method: "resolveOutbox", projectId: "p1", outboxId: 7, action: "retry" });
});

test("the CI section opens the logs, filterable to errors", async () => {
  show();
  expect(await screen.findByText("3 min 12 s")).toBeDefined();
  expect(screen.getByText("Échec")).toBeDefined();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Voir les logs" }));
  expect(await screen.findByText("Logs · build")).toBeDefined();
  expect(screen.getByText("setup")).toBeDefined();
  await user.click(screen.getByRole("switch", { name: "Erreurs seulement" }));
  expect(screen.queryByText("setup")).toBeNull();
  expect(screen.getByText("##[error]Test failed")).toBeDefined();
});

test("Figma: unreachable badge and invalid URL message", async () => {
  show();
  expect(await screen.findByText("Figma non joignable")).toBeDefined();
  expect(screen.getAllByText("Tickets / Arbre").length).toBeGreaterThan(0);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Colle l'URL d'un nœud Figma (figma.com/design/…?node-id=…)"), "https://example.com/x");
  await user.click(screen.getByRole("button", { name: "Lier un nœud Figma" }));
  expect(await screen.findByText("URL Figma invalide : il faut un lien de nœud (node-id).")).toBeDefined();
});

test("an issue body is never rendered as HTML", () => {
  const { container } = show();
  expect(container.ownerDocument.querySelector("img[src='x']")).toBeNull();
});
```

(`as unknown as ProjectSnapshot` : les réfs `github_issue` et `figma_node` n'existent dans `ExternalRef` qu'après la Task 4, et `bindings` dans `ProjectSnapshot` aussi ; le fixture est complet pour les champs réels (`rules`, `domainId`…). Le lien `#12` est le chip de PR existant de `TicketDetail` (phase 3) : le test vérifie qu'il cohabite avec le chip d'issue.)

Run: `bun test packages/ui/src/shell/sheet/sheet-integrations.test.tsx` — Expected: FAIL.

- [ ] **Step 4: `GithubRefs.tsx` et `SyncStatus.tsx`**

`packages/ui/src/shell/sheet/GithubRefs.tsx` :

```tsx
import { githubIssueState, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { CircleCheck, CircleDot, Unlink } from "lucide-react";
import { fr } from "../../i18n/fr";

const t = fr.integrations.sheet;

export function GithubRefs({ ticket }: { ticket: TicketView }) {
  const chips = ticket.externalRefs.flatMap((ref) => {
    if (ref.kind !== "github_issue" || ref.number === null) return [];
    if (githubIssueState(ref) === "broken") {
      return [
        <Badge key={ref.bindingId} variant="outline" className="gap-1 text-muted-foreground" title={t.brokenHelp}>
          <Unlink aria-hidden className="size-3" />
          {t.broken}
        </Badge>,
      ];
    }
    const Icon = ticket.statusId === "done" ? CircleCheck : CircleDot;
    return [
      <a key={ref.bindingId} href={ref.url ?? undefined} target="_blank" rel="noreferrer noopener" title={t.openOnGithub}>
        <Badge variant="outline" className="gap-1 font-mono">
          <Icon aria-hidden className="size-3" />
          {t.issue(ref.number)}
        </Badge>
      </a>,
    ];
  });
  if (chips.length === 0) return null;
  return (
    <>
      <dt className="text-muted-foreground">{t.issueProperty}</dt>
      <dd className="flex flex-wrap gap-1">{chips}</dd>
    </>
  );
}
```

`fr-integrations.ts`, bloc `sheet` : ajouter `issueProperty: "Issue",` (ligne de la liste de propriétés, au-dessus de la ligne « PR » de la phase 3).

Le nom accessible du lien est le texte du chip (`#42`) ; l'icône est `aria-hidden`. `ref.url` a été validé `https:` par `WebUrl` (Task 1) à l'écriture et à la lecture du doc.

`packages/ui/src/shell/sheet/SyncStatus.tsx` :

```tsx
import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Clock } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { useSyncState } from "../../state/use-sync-state";

const t = fr.integrations.sheet;

export function SyncStatus({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const { state, error, reload } = useSyncState(projectId);
  const [actionError, setActionError] = useState<string | null>(null);
  const failure = state?.errors.find((e) => e.ticketId === ticket.id) ?? null;
  const pendingCreate = ticket.externalRefs.some((r) => r.kind === "github_issue" && r.number === null);
  const pending = state?.pending.includes(ticket.id) ?? false;
  const resolve = async (action: "retry" | "drop") => {
    if (!failure) return;
    try {
      await client.rpc({ method: "resolveOutbox", projectId, outboxId: failure.outboxId, action });
      setActionError(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };
  if (failure) {
    return (
      <div role="alert" className="mx-4 grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p>
          <span className="font-medium">{t.syncError}</span> {failure.message}
        </p>
        {actionError && <p className="text-destructive">{actionError}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void resolve("retry")}>
            {t.retry}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void resolve("drop")}>
            {t.drop}
          </Button>
        </div>
      </div>
    );
  }
  if (error) return <p className="px-4 text-sm text-destructive">{error}</p>;
  if (!pending && !pendingCreate) return null;
  return (
    <p className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
      <Clock aria-hidden className="size-4" />
      {pendingCreate ? t.pendingCreate : t.pending}
    </p>
  );
}
```

- [ ] **Step 5: `CiSection.tsx` et `CiLogSheet.tsx`**

`packages/ui/src/shell/sheet/CiSection.tsx` :

```tsx
import type { CiJobSummary, CiRun } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { CiLogSheet } from "./CiLogSheet";
import { conclusionLabel, formatDuration, latestPerWorkflow, runTone } from "./ci-format";

const t = fr.integrations.sheet;
const DOT = { ok: "bg-emerald-500", error: "bg-red-500", running: "bg-amber-500", neutral: "bg-zinc-400" } as const;

function duration(run: CiRun): string | null {
  const end = run.jobs.map((j) => j.completedAt).filter((x): x is string => x !== null).sort().at(-1);
  if (!run.startedAt || !end || run.status !== "completed") return null;
  return formatDuration(Date.parse(end) - Date.parse(run.startedAt));
}

export function CiSection({ projectId, ticketId }: { projectId: string; ticketId: string }) {
  const [runs, setRuns] = useState<CiRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ run: CiRun; job: CiJobSummary } | null>(null);
  const load = useCallback(async () => {
    try {
      setRuns(await client.rpc({ method: "listCiRuns", projectId, ticketId }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, ticketId]);
  useEffect(() => {
    void load();
    return client.subscribeIntegrations((e) => {
      if (e.type === "ci" && e.projectId === projectId) void load();
    });
  }, [projectId, load]);
  const hasPr = runs !== null;
  if (!hasPr && !error) return null;
  return (
    <section className="grid gap-2 px-4 text-sm">
      <h3 className="font-medium">{t.ci}</h3>
      {error && <p className="text-destructive">{error}</p>}
      {runs?.length === 0 && <p className="text-muted-foreground">{t.ciEmpty}</p>}
      {latestPerWorkflow(runs ?? []).map((run) => {
        const job = run.jobs.find((j) => j.conclusion === "failure") ?? run.jobs[0];
        return (
          <div key={run.runId} className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${DOT[runTone(run)]}`} />
            <span className="font-medium">{run.workflow}</span>
            <span className="text-muted-foreground">{conclusionLabel(run)}</span>
            {duration(run) && <span className="text-muted-foreground">{duration(run)}</span>}
            {job && (
              <Button variant="link" size="sm" className="ml-auto h-auto p-0" onClick={() => setOpen({ run, job })}>
                {t.viewLogs}
              </Button>
            )}
          </div>
        );
      })}
      {open && <CiLogSheet projectId={projectId} run={open.run} job={open.job} onClose={() => setOpen(null)} />}
    </section>
  );
}
```

Pastilles : vert, rouge, ambre, gris sont des couleurs d'état (hors orange des agents), identiques à celles des chips CI du Kanban (Task 21).

`packages/ui/src/shell/sheet/CiLogSheet.tsx` :

```tsx
import type { CiJobSummary, CiLog, CiRun } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Switch } from "@kibo/sdk/ui/switch";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { visibleLines } from "./log-lines";

const t = fr.integrations.sheet;
type Props = { projectId: string; run: CiRun; job: CiJobSummary; onClose(): void };

export function CiLogSheet({ projectId, run, job, onClose }: Props) {
  const [log, setLog] = useState<CiLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const ids = { search: useId(), errors: useId() };
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "getCiLog", projectId, runId: run.runId, jobId: job.jobId })
      .then((l) => live && setLog(l))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [projectId, run.runId, job.jobId]);
  const lines = log ? visibleLines(log, query, errorsOnly) : [];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[720px] sm:max-w-[720px]">
        <SheetHeader>
          <SheetTitle>{t.logTitle(job.name)}</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-4 px-4">
          <Label htmlFor={ids.search} className="sr-only">
            {t.logSearch}
          </Label>
          <Input id={ids.search} placeholder={t.logSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex shrink-0 items-center gap-2">
            <Switch id={ids.errors} checked={errorsOnly} onCheckedChange={setErrorsOnly} aria-label={t.errorsOnly} />
            <Label htmlFor={ids.errors}>{t.errorsOnly}</Label>
          </div>
        </div>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        {log?.truncated && <p className="px-4 text-xs text-muted-foreground">{t.logTruncated}</p>}
        <pre className="mx-4 flex-1 overflow-auto rounded-md border bg-muted/40 py-2 font-mono text-xs">
          {log && lines.length === 0 && <span className="px-3 text-muted-foreground">{t.logEmpty}</span>}
          {lines.map((l) => (
            <div key={l.n} className={`flex gap-3 px-3 ${l.error ? "bg-destructive/10 text-destructive" : ""}`}>
              <span aria-hidden className="w-10 shrink-0 select-none text-right text-muted-foreground">
                {l.n}
              </span>
              <span className="whitespace-pre-wrap break-all">{l.text}</span>
            </div>
          ))}
        </pre>
      </SheetContent>
    </Sheet>
  );
}
```

Le texte du log est rendu comme texte React (jamais `dangerouslySetInnerHTML`) ; les séquences ANSI éventuelles restent visibles telles quelles.

- [ ] **Step 6: `FigmaSection.tsx`**

```tsx
import { type FigmaNodeRef, type FigmaPreview, KiboError, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";

const t = fr.integrations.sheet;
const figmaRefs = (ticket: TicketView) => ticket.externalRefs.filter((r): r is FigmaNodeRef => r.kind === "figma_node");

function linkError(e: unknown): string {
  if (e instanceof KiboError && e.code === "INVALID_INPUT") return t.figmaInvalid;
  if (e instanceof KiboError && e.code === "NOT_CONNECTED") return t.figmaNotConnected;
  if (e instanceof KiboError && e.code === "MCP_UNAVAILABLE") return fr.integrations.figma.unreachable;
  return e instanceof Error ? e.message : String(e);
}

export function FigmaProperty({ ticket }: { ticket: TicketView }) {
  const first = figmaRefs(ticket)[0];
  if (!first) return null;
  return (
    <>
      <dt className="text-muted-foreground">{t.mockupProperty}</dt>
      <dd>
        <a className="underline-offset-4 hover:underline" href={first.url} target="_blank" rel="noreferrer noopener">
          {first.name}
        </a>
      </dd>
    </>
  );
}

function Thumbnail({ projectId, ticketId, node }: { projectId: string; ticketId: string; node: FigmaNodeRef }) {
  const [preview, setPreview] = useState<FigmaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "getFigmaPreview", fileKey: node.fileKey, nodeId: node.nodeId })
      .then((p) => live && setPreview(p))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [node.fileKey, node.nodeId]);
  const unlink = async () => {
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeExternalRef", ticketId, kind: "figma_node", key: `${node.fileKey}:${node.nodeId}` },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <figure className="grid gap-1">
      <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-muted">
        {preview?.png && <img src={`data:image/png;base64,${preview.png}`} alt={node.name} className="size-full object-cover" />}
        <div className="absolute top-2 left-2 flex gap-1">
          {preview && !preview.reachable && <Badge variant="secondary">{t.figmaUnreachable}</Badge>}
          {preview && preview.reachable && !preview.available && <Badge variant="secondary">{t.previewUnavailable}</Badge>}
        </div>
      </div>
      <figcaption className="flex items-center gap-2 text-sm">
        <a className="truncate hover:underline" href={node.url} target="_blank" rel="noreferrer noopener">
          {node.name}
        </a>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </figcaption>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </figure>
  );
}

export function FigmaSection({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nodes = figmaRefs(ticket);
  const link = async () => {
    try {
      await client.rpc({ method: "linkFigmaNode", projectId, ticketId: ticket.id, url: url.trim() });
      setUrl("");
      setError(null);
    } catch (e) {
      setError(linkError(e));
    }
  };
  return (
    <section className="grid gap-2 px-4 text-sm">
      <h3 className="font-medium">{t.mockups}</h3>
      <div className="grid grid-cols-2 gap-3">
        {nodes.map((n) => (
          <Thumbnail key={`${n.fileKey}:${n.nodeId}`} projectId={projectId} ticketId={ticket.id} node={n} />
        ))}
      </div>
      <div className="flex gap-2">
        <Input aria-label={t.linkFigma} placeholder={t.figmaPlaceholder} value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button variant="outline" disabled={url.trim() === ""} onClick={() => void link()}>
          {t.linkFigma}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
```

`linkFigmaNode` est validé `z.string().url()` par le RPC : une chaîne qui n'est pas une URL est refusée `INVALID_INPUT` avant le démon Figma. Le PNG vient du cache du démon (base64 validé côté démon, Task 20), rendu en `data:` : aucune requête du navigateur vers Figma.

- [ ] **Step 7: Brancher dans `TicketDetail.tsx`**

- Liste de propriétés (`dl`) : `<FigmaProperty ticket={t} />` juste après « Statut » ; `<GithubRefs ticket={t} />` juste avant la ligne « PR » existante (qui reste inchangée).
- Juste avant la `dl` : `<SyncStatus projectId={project.meta.id} ticket={t} />`.
- Description : inchangée (texte brut par `LinkifiedText`, `whitespace-pre-wrap`) ; le test « never rendered as HTML » la couvre.
- Après la section « Sous-tickets » (dernière section) : `{prs.length > 0 && <CiSection projectId={project.meta.id} ticketId={t.id} />}` (réutilise la constante `prs` du fichier) puis `<FigmaSection projectId={project.meta.id} ticket={t} />`.
- `FigmaSection` s'affiche toujours (champ d'ajout) ; si Figma n'est pas configuré, le message `figmaNotConnected` apparaît à la première tentative ; si l'application Figma est fermée, `figma.unreachable`.
- `TicketDetail.tsx` reste sous ~300 lignes (les sections sont dans `shell/sheet/`).
- Écart de maquette assumé (à noter au jalon) : P7 place `#42` et `#12` dans l'en-tête ; la phase 3 a livré le chip de PR dans la liste de propriétés, l'issue y rejoint la PR plutôt que de dupliquer l'un des deux.

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel du Sheet et de l'onglet ticket (sombre puis clair) contre P7, P8, P9.

Dépendances : Tasks 1, 2 (`subscribeIntegrations`), 4 (`removeExternalRef`, union étendue), 10 (`useSyncState`, `Switch`).

```bash
git add packages/ui/src/shell/sheet packages/ui/src/shell/TicketDetail.tsx packages/ui/src/i18n/fr-integrations.ts
git commit -m "feat(ui): GitHub, CI et maquettes dans le Sheet"
```

---

### Task 19: Adaptateur dans le Worker et aller-retour complet

Branche le moteur (Task 14) sur l'adaptateur réel (Task 13) exécuté dans un Worker de la phase 4, et vérifie le critère de sortie de la phase : aller-retour ticket ↔ issue contre le faux GitHub.

État réel (phase 4) et conséquences :
- Il n'y a pas de `ComponentBackendHost` à modifier : `createWorkerHost(opts: HostOptions)` (`packages/daemon/src/components/worker-host.ts`) renvoie un `BackendHost { invoke(req: InvokeRequest), describe(), stop(), running }`, et chaque message `call` d'un backend est rattaché à son invocation par `host-core.ts` puis confié à `HostOptions.onCall(projectId, instanceId, call)` (décision 15 de la phase 4). La liaison fournit donc son propre `onCall` (`binding-calls.ts`) ; le traitement des messages `call` de la phase 4 n'est pas touché, et la porte `createGate` n'est pas utilisée (l'instance `binding:<id>` n'existe pas dans le doc).
- `createBackends` (`components/backends.ts`) ne sert que les versions approuvées du registre : un intégré n'y figure pas. Le Worker de l'adaptateur est créé directement par `createWorkerHost`, avec `timeoutMs: 120_000` (une création peut enchaîner adoption, `POST`, `PATCH` et deux mutations GraphQL, chacune bornée à 15 s par le proxy ; le défaut de 30 s de `HOST_DEFAULTS` couperait le Worker).
- `buildComponent(srcDir, toolchain)` (`packages/devkit/src/build.ts`) ne convient pas à un intégré sans UI : il construit toujours `ui.tsx` (cibles `sandbox` et `trusted`), attend les sources à la racine du dossier, et son résolveur `server` n'autorise que `@kibo/sdk/server` et `@kibo/sdk/migrations` (ni `@kibo/sdk/adapter`, ni `@kibo/schema`, ni `zod`). Ces règles protègent contre un composant tiers ; un intégré est du code du monorepo, en confiance totale (spec B). D'où `buildBuiltinBackend` (devkit) : `Bun.build` de `src/server.ts` en CommonJS (`target: "browser"`, `macros: false`, comme la cible serveur de la phase 4), sans le résolveur des composants tiers ; le runtime du Worker lit l'export `server` (`evaluateCjs(code.server, "server")`).
- Le démon ne dépend pas du SDK (`schema ← core ← daemon`, `schema ← devkit ← daemon`) : `BINDING_PREFIX` et `bindingIdOf` sont importés de `@kibo/schema` (Task 1, `integrations.ts` ; le SDK les réexporte).
- Paquet desktop (décision 22 de la phase 4, un seul script de build) : les backends intégrés sont préconstruits par `apps/desktop/scripts/build-sidecar.ts` (déjà appelé par `build:debug` et `dev`) dans `apps/desktop/src-tauri/builtin/<id>/`, embarqués comme ressource Tauri à côté de `ui/`, et trouvés par le démon via `KIBO_BUILTIN_DIR`, posée par `apps/desktop/src-tauri/src/main.rs` au lancement du sidecar (comme `KIBO_NATIVE_NOTIFY`). Pas de script racine ni de `scripts/` hors paquet (hors `typecheck`).
- N26 : pas d'`integrationDeps` ni d'`IntegrationHost.invokeAdapter` ; l'invocateur est créé dans `bootstrap.ts` à partir du `kit`.

Dépend de : Tasks 12, 13, 14 ; Task 8 (`proxyFetch` avec `hooks` et `secrets`) ; tâche 34 de la phase 4 (elle réécrit `apps/desktop/scripts/build-sidecar.ts`, `tauri.conf.json` et `main.rs`).

**Files:**
- Create: `packages/devkit/src/build-builtin.ts`, `packages/devkit/src/build-builtin.test.ts` ; Modify: `packages/devkit/src/index.ts`
- Create: `packages/daemon/src/sync/{worker-runner.ts,binding-calls.ts,builtin-adapter.ts}`
- Test: `packages/daemon/src/sync/{worker-runner.test.ts,binding-calls.test.ts,roundtrip.test.ts}`
- Modify: `packages/daemon/src/components/host-core.ts` (`BACKEND_ERROR_CODES`, N23), `packages/daemon/src/components/host-core.test.ts`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (invocateur, `syncModule`)
- Modify: `apps/desktop/scripts/build-sidecar.ts`, `apps/desktop/package.json` (`@kibo/devkit`, `@kibo/schema` en `workspace:*`), `apps/desktop/tsconfig.json` (`references` vers `packages/schema` et `packages/devkit`), `apps/desktop/src-tauri/tauri.conf.json` (`bundle.resources`), `apps/desktop/src-tauri/src/main.rs` (`KIBO_BUILTIN_DIR`), `.gitignore`, `bun.lock`

**Interfaces:**
- Consumes: `AdapterRunner`, `IntegrationKit`, `IntegrationModule`, `startIntegrations`, `parseIntegrationFlags`, `createRedactor` (Task 2) ; `ProjectSnapshot.bindings` (Task 4) ; `syncModule` (Task 14) ; `proxyFetch(rules, url, init, { hooks, secrets })` (Task 8) ; `kit.github.account.mode()` (Task 12) ; `components/github-issues` (Task 13, construit par chemin) ; `BINDING_PREFIX`, `bindingIdOf`, `PullPage`, `MappedRemote`, `Binding`, `BindingConfig`, `BUILTIN_ADAPTER_IDS` (Tasks 1, 13) ; phase 4 : `createWorkerHost`, `HostOptions`, `CallHandler`, `BackendHost`, `backendError`, `BACKEND_ERROR_CODES` (`components/host-core.ts`, `worker-host.ts`), `createQuotas` (`components/quotas.ts`), `createEventLog`, `ensureEventsTable` (`components/events.ts`, journal des refus), `ComponentCall`, `FetchInit`, `FetchResponse` (`schema/src/call.ts`) ; faux GitHub (Task 6).
- Produces:
  - devkit : `type BuiltinBackend = { manifest: ComponentManifest; server: string }` ; `buildBuiltinBackend(componentDir: string): Promise<BuiltinBackend>` ; `readBuiltinBackend(dir: string): Promise<BuiltinBackend>` ; `writeBuiltinBackend(b: BuiltinBackend, dir: string): Promise<void>`
  - `type AdapterInvoker = (req: { projectId: string; bindingId: string; adapter: Binding["adapter"]; config: BindingConfig; action: "adapter.pull" | "adapter.push"; input: unknown }) => Promise<unknown>` (`sync/builtin-adapter.ts`)
  - `createWorkerRunner(invoke: AdapterInvoker): AdapterRunner`
  - `BINDING_FETCH_PER_MINUTE = 120` ; `createBindingCalls(deps): CallHandler` (seul `fetch`, liaison du projet, quotas et journal des refus de la phase 4)
  - `ADAPTER_TIMEOUT_MS = 120_000` ; `loadBuiltinAdapter(id, env?): Promise<BuiltinBackend>` ; `createAdapterHosts(deps): { invoke: AdapterInvoker; stop(): void }`
  - `BACKEND_ERROR_CODES` gagne `REMOTE_UNAVAILABLE`, `REMOTE_REJECTED`, `REMOTE_NOT_FOUND`, `REMOTE_CONFLICT`, `NOT_CONNECTED` (N23)
  - variable d'environnement `KIBO_BUILTIN_DIR` (paquet : `builtin/<id>/{kibo.component.json,server.js}`)

- [ ] **Step 1: Tests unitaires (échouent)**

`packages/daemon/src/sync/worker-runner.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import type { AdapterInvoker } from "./builtin-adapter";
import { createWorkerRunner } from "./worker-runner";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const mapped = (bindingId: string) => ({
  remoteId: "1",
  updatedAt: "2026-09-26T10:00:00Z",
  fields: { title: "A", description: "", statusId: "todo", closed: false },
  labels: [],
  ref: { kind: "github_issue", bindingId, repo: "adam/kibo", number: 1, nodeId: "I_1", url: "https://github.com/adam/kibo/issues/1" },
});

test("pull and push go through the adapter actions of the binding", async () => {
  const seen: Parameters<AdapterInvoker>[0][] = [];
  const runner = createWorkerRunner(async (req) => {
    seen.push(req);
    return req.action === "adapter.pull" ? { items: [mapped("b1")], cursor: "c1", more: false } : mapped("b1");
  });
  expect((await runner.pull("p1", binding, null)).cursor).toBe("c1");
  const op = { kind: "update" as const, remoteId: "1", patch: { title: "A" } };
  expect((await runner.push("p1", binding, op)).remoteId).toBe("1");
  expect(seen.map((s) => [s.action, s.bindingId, s.input])).toEqual([
    ["adapter.pull", "b1", { cursor: null }],
    ["adapter.push", "b1", op],
  ]);
});

test("an adapter output is validated before the engine sees it", async () => {
  const bad = createWorkerRunner(async () => ({ items: [{ remoteId: 1 }], cursor: null, more: false }));
  await expect(bad.pull("p1", binding, null)).rejects.toThrow("INTERNAL");
  const unsafe = createWorkerRunner(async () => ({ ...mapped("b1"), ref: { ...mapped("b1").ref, url: "javascript:alert(1)" } }));
  await expect(unsafe.push("p1", binding, { kind: "update", remoteId: "1", patch: {} })).rejects.toThrow("INTERNAL");
  const foreign = createWorkerRunner(async () => mapped("b2"));
  await expect(foreign.push("p1", binding, { kind: "update", remoteId: "1", patch: {} })).rejects.toThrow("INTERNAL");
});
```

`packages/daemon/src/sync/binding-calls.test.ts` (quotas et journal réels de la phase 4 : N8, N28) :

```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { type Binding, ComponentManifest } from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "../components/events";
import { createQuotas } from "../components/quotas";
import { BINDING_FETCH_PER_MINUTE, createBindingCalls } from "./binding-calls";

const manifest = ComponentManifest.parse({
  id: "github-issues",
  version: "1.0.0",
  kind: "adapter",
  title: "GitHub Issues",
  reads: ["ticket", "status"],
  writes: [],
  net: ["api.github.com"],
  secrets: [{ name: "github", hosts: ["api.github.com"] }],
});
const binding = (id: string): Binding => ({
  id,
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
});
const FETCH = { kind: "fetch" as const, url: "https://api.github.com/user", init: { method: "GET" as const, headers: {} } };

function setup() {
  const clock = { now: 0 };
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const refusals = createEventLog(db, () => clock.now);
  const fetched: string[] = [];
  const calls = createBindingCalls({
    bindings: (projectId) => (projectId === "p1" ? [binding("b1"), binding("b2")] : []),
    manifest,
    quotas: createQuotas({ now: () => clock.now, fetchPerMinute: BINDING_FETCH_PER_MINUTE }),
    refusals,
    fetch: async (_manifest, url) => {
      fetched.push(url);
      return { status: 200, headers: {}, body: "" };
    },
  });
  return { calls, fetched, refusals, clock };
}

test("an adapter may only fetch, for a binding of the project, and refusals are journaled", async () => {
  const { calls, fetched, refusals } = setup();
  await calls("p1", "binding:b1", FETCH);
  expect(fetched).toEqual(["https://api.github.com/user"]);
  await expect(calls("p1", "binding:b1", { kind: "list", entity: "ticket" })).rejects.toThrow("PERMISSION_DENIED");
  await expect(calls("p1", "binding:b1", { kind: "run", command: { method: "createTicket", title: "x" } })).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  await expect(calls("p1", "binding:inconnu", FETCH)).rejects.toThrow("NOT_FOUND");
  refusals.flush();
  expect(refusals.list().map((e) => [e.instanceId, e.kind, e.code])).toEqual([
    ["binding:b1", "list", "PERMISSION_DENIED"],
    ["binding:b1", "run", "PERMISSION_DENIED"],
    ["binding:inconnu", "fetch", "NOT_FOUND"],
  ]);
});

test("120 fetches per minute per binding", async () => {
  const { calls, clock } = setup();
  for (let i = 0; i < BINDING_FETCH_PER_MINUTE; i++) await calls("p1", "binding:b1", FETCH);
  await expect(calls("p1", "binding:b1", FETCH)).rejects.toThrow("RATE_LIMITED");
  await expect(calls("p1", "binding:b2", FETCH)).resolves.toBeDefined();
  clock.now += 60_000;
  await expect(calls("p1", "binding:b1", FETCH)).resolves.toBeDefined();
});
```

Dans `packages/daemon/src/components/host-core.test.ts`, ajouter (N23) :

```ts
test("remote error codes cross the backend boundary, trust codes do not", () => {
  for (const code of ["REMOTE_UNAVAILABLE", "REMOTE_REJECTED", "REMOTE_NOT_FOUND", "REMOTE_CONFLICT", "NOT_CONNECTED", "RATE_LIMITED"]) {
    expect(backendError({ code, message: "github" }).code).toBe(code);
  }
  expect(backendError({ code: "TRUST_REQUIRED", message: "x" }).code).toBe("INTERNAL");
});
```

(`backendError` importé de `./host-core`.)

Run: `bun test packages/daemon/src/sync/worker-runner.test.ts packages/daemon/src/sync/binding-calls.test.ts packages/daemon/src/components/host-core.test.ts` — Expected: FAIL.

- [ ] **Step 2: `host-core.ts`, `worker-runner.ts` et `binding-calls.ts`**

`packages/daemon/src/components/host-core.ts` : ajouter à `BACKEND_ERROR_CODES` `"REMOTE_UNAVAILABLE"`, `"REMOTE_REJECTED"`, `"REMOTE_NOT_FOUND"`, `"REMOTE_CONFLICT"`, `"NOT_CONNECTED"` (codes créés par la Task 1 ; `RATE_LIMITED` y est déjà). Aucun ne permet à un backend de réclamer une confiance ou un réappairage (décision 25 de la phase 4).

`packages/daemon/src/sync/worker-runner.ts` :

```ts
import { type Binding, KiboError, MappedRemote, PullPage } from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { AdapterRunner } from "../integrations/types";
import type { AdapterInvoker } from "./builtin-adapter";

function checked<T extends { ref: { bindingId: string } }>(binding: Binding, value: T): T {
  if (value.ref.bindingId !== binding.id) throw new KiboError("INTERNAL", "adapter returned a ref for another binding");
  return value;
}

function parseOut<T>(schema: ZodType<T, ZodTypeDef, unknown>, raw: unknown, what: string): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new KiboError("INTERNAL", `adapter returned an invalid ${what}: ${r.error.issues[0]?.message ?? ""}`);
  return r.data;
}

export function createWorkerRunner(invoke: AdapterInvoker): AdapterRunner {
  const call = (projectId: string, b: Binding, action: "adapter.pull" | "adapter.push", input: unknown) =>
    invoke({ projectId, bindingId: b.id, adapter: b.adapter, config: b.config, action, input });
  return {
    async pull(projectId, binding, cursor) {
      const page = parseOut(PullPage, await call(projectId, binding, "adapter.pull", { cursor }), "page");
      for (const item of page.items) checked(binding, item);
      return page;
    },
    async push(projectId, binding, op) {
      return checked(binding, parseOut(MappedRemote, await call(projectId, binding, "adapter.push", op), "item"));
    },
  };
}
```

`INTERNAL` est une erreur manuelle pour le moteur (non transitoire) : la ligne d'envoi reste en erreur visible (« Réessayer » / « Abandonner »), le pull de la liaison échoue avec le message dans l'écran 16.

`packages/daemon/src/sync/binding-calls.ts` :

```ts
import {
  type Binding,
  bindingIdOf,
  type ComponentCall,
  type ComponentManifest,
  type FetchInit,
  type FetchResponse,
  KiboError,
  type KiboErrorCode,
} from "@kibo/schema";
import type { EventLog as RefusalLog } from "../components/events";
import type { CallHandler } from "../components/host-core";
import type { Quotas } from "../components/quotas";

export const BINDING_FETCH_PER_MINUTE = 120;
const REFUSALS = new Set<KiboErrorCode>(["NOT_FOUND", "PERMISSION_DENIED", "RATE_LIMITED"]);

export type BindingCallsDeps = {
  bindings(projectId: string): Binding[];
  manifest: ComponentManifest;
  quotas: Quotas;
  refusals: RefusalLog;
  fetch(manifest: ComponentManifest, url: string, init: FetchInit): Promise<FetchResponse>;
};

export function createBindingCalls(deps: BindingCallsDeps): CallHandler {
  const ref = `${deps.manifest.id}@${deps.manifest.version}`;
  const guarded = async (projectId: string, instanceId: string, call: ComponentCall): Promise<FetchResponse> => {
    const bindingId = bindingIdOf(instanceId);
    if (!deps.bindings(projectId).some((b) => b.id === bindingId)) {
      throw new KiboError("NOT_FOUND", `binding ${bindingId} not found`);
    }
    if (call.kind !== "fetch") throw new KiboError("PERMISSION_DENIED", `adapters may only fetch, not ${call.kind}`);
    if (!deps.quotas.take(instanceId, "call") || !deps.quotas.take(instanceId, "fetch")) {
      throw new KiboError("RATE_LIMITED", `${instanceId} fetches too often`);
    }
    return deps.fetch(deps.manifest, call.url, call.init);
  };
  return async (projectId, instanceId, call) => {
    try {
      return await guarded(projectId, instanceId, call);
    } catch (e) {
      if (e instanceof KiboError && REFUSALS.has(e.code)) {
        deps.refusals.record({ projectId, instanceId, ref, kind: call.kind, code: e.code });
      }
      throw e;
    }
  };
}
```

- Quotas (N8, N28) : `createQuotas({ fetchPerMinute: BINDING_FETCH_PER_MINUTE })` de la phase 4, clé `binding:<id>` ; au-delà, `RATE_LIMITED` comme pour un composant (transitoire pour le moteur : nouvel essai après attente).
- Journal (N28) : les refus vont dans `component_events` par `EventLog.record` de `components/events.ts` (borné, décision 26 de la phase 4), avec `instanceId = binding:<id>` et `ref = github-issues@1.0.0`.
- Les autres contrôles §6.4 de la spec B s'appliquent dans `deps.fetch` = `proxyFetch` (Task 8) : règles `net` et `secrets` du manifeste intégré, https, anti-SSRF, en-têtes, redirections, taille, délai.

Run: `bun test packages/daemon/src/sync/worker-runner.test.ts packages/daemon/src/sync/binding-calls.test.ts packages/daemon/src/components/host-core.test.ts` — Expected: PASS.

- [ ] **Step 3: Construction d'un backend intégré (devkit)**

`packages/devkit/src/build-builtin.test.ts` :

```ts
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBuiltinBackend, readBuiltinBackend, writeBuiltinBackend } from "./build-builtin";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("a builtin adapter builds to a CommonJS server and round-trips on disk", async () => {
  const built = await buildBuiltinBackend(join(import.meta.dir, "..", "..", "..", "components", "github-issues"));
  expect(built.manifest).toMatchObject({ id: "github-issues", kind: "adapter" });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function("module", "exports", built.server)(mod, mod.exports);
  const server = mod.exports.server as { actions: Record<string, unknown> };
  expect(Object.keys(server.actions).sort()).toEqual(["adapter.pull", "adapter.push"]);
  const dir = mkdtempSync(join(tmpdir(), "kibo-builtin-"));
  dirs.push(dir);
  await writeBuiltinBackend(built, join(dir, "github-issues"));
  expect(await readBuiltinBackend(join(dir, "github-issues"))).toEqual(built);
});

test("a missing prebuilt backend is a clear error", async () => {
  await expect(readBuiltinBackend(join(tmpdir(), "kibo-nope-builtin"))).rejects.toThrow();
});
```

(`as { actions … }` : lecture du module évalué dans le test, comme `evaluateCjs` du démon.)

`packages/devkit/src/build-builtin.ts` :

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ComponentManifest, KiboError } from "@kibo/schema";

export type BuiltinBackend = { manifest: ComponentManifest; server: string };

const MANIFEST = "kibo.component.json";
const SERVER = "server.js";

async function readManifest(dir: string): Promise<ComponentManifest> {
  const parsed = ComponentManifest.safeParse(JSON.parse(await readFile(join(dir, MANIFEST), "utf8")));
  if (!parsed.success) throw new KiboError("VALIDATION_FAILED", `${dir}: ${parsed.error.message}`);
  return parsed.data;
}

export async function buildBuiltinBackend(componentDir: string): Promise<BuiltinBackend> {
  const manifest = await readManifest(componentDir);
  const result = await Bun.build({
    entrypoints: [join(componentDir, "src", "server.ts")],
    target: "browser",
    format: "cjs",
    minify: true,
    macros: false,
    throw: false,
  });
  const [output] = result.outputs;
  if (!result.success || !output) {
    const message = result.logs.map((l) => l.message).join("\n");
    throw new KiboError("VALIDATION_FAILED", message || `build failed for ${componentDir}`);
  }
  return { manifest, server: await output.text() };
}

export async function readBuiltinBackend(dir: string): Promise<BuiltinBackend> {
  return { manifest: await readManifest(dir), server: await readFile(join(dir, SERVER), "utf8") };
}

export async function writeBuiltinBackend(b: BuiltinBackend, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, MANIFEST), JSON.stringify(b.manifest));
  await writeFile(join(dir, SERVER), b.server);
}
```

`packages/devkit/src/index.ts` : `export * from "./build-builtin";`.

Run: `bun test packages/devkit/src/build-builtin.test.ts` — Expected: PASS.

- [ ] **Step 4: `builtin-adapter.ts` et amorçage**

`packages/daemon/src/sync/builtin-adapter.ts` :

```ts
import { join } from "node:path";
import { type BuiltinBackend, buildBuiltinBackend, readBuiltinBackend } from "@kibo/devkit";
import { BINDING_PREFIX, type Binding, type BindingConfig, type ComponentManifest, KiboError } from "@kibo/schema";
import type { BackendHost, CallHandler } from "../components/host-core";
import { createWorkerHost } from "../components/worker-host";

export type AdapterInvoker = (req: {
  projectId: string;
  bindingId: string;
  adapter: Binding["adapter"];
  config: BindingConfig;
  action: "adapter.pull" | "adapter.push";
  input: unknown;
}) => Promise<unknown>;
export type AdapterHostsDeps = {
  load(id: Binding["adapter"]): Promise<BuiltinBackend>;
  calls(manifest: ComponentManifest): CallHandler;
  timeoutMs?: number;
};

export const ADAPTER_TIMEOUT_MS = 120_000;
const REPO_COMPONENTS = join(import.meta.dir, "..", "..", "..", "..", "components");

export function loadBuiltinAdapter(id: string, env: Record<string, string | undefined> = process.env): Promise<BuiltinBackend> {
  const packaged = env.KIBO_BUILTIN_DIR;
  return packaged ? readBuiltinBackend(join(packaged, id)) : buildBuiltinBackend(join(REPO_COMPONENTS, id));
}

export function createAdapterHosts(deps: AdapterHostsDeps): { invoke: AdapterInvoker; stop(): void } {
  const hosts = new Map<string, Promise<BackendHost>>();
  const start = async (id: Binding["adapter"]): Promise<BackendHost> => {
    const b = await deps.load(id);
    if (b.manifest.kind !== "adapter" || b.manifest.id !== id) throw new KiboError("INTERNAL", `${id} is not a builtin adapter`);
    return createWorkerHost({
      ref: `${b.manifest.id}@${b.manifest.version}`,
      manifest: b.manifest,
      code: { server: b.server, migrations: null },
      onCall: deps.calls(b.manifest),
      timeoutMs: deps.timeoutMs ?? ADAPTER_TIMEOUT_MS,
    });
  };
  const hostOf = (id: Binding["adapter"]): Promise<BackendHost> => {
    const known = hosts.get(id);
    if (known) return known;
    const next = start(id);
    hosts.set(id, next);
    next.catch(() => hosts.delete(id));
    return next;
  };
  return {
    invoke: async (req) =>
      (await hostOf(req.adapter)).invoke({
        projectId: req.projectId,
        instanceId: `${BINDING_PREFIX}${req.bindingId}`,
        config: req.config,
        target: { action: req.action },
        input: req.input,
      }),
    stop() {
      for (const host of hosts.values()) host.then((h) => h.stop(), () => undefined);
      hosts.clear();
    },
  };
}
```

- `next.catch(() => hosts.delete(id))` et le second argument de `then` dans `stop` n'avalent rien : l'échec de chargement est rendu à l'appelant par `await hostOf(…)` (erreur du moteur, visible à l'écran 16) ; ils permettent seulement un nouvel essai au cycle suivant, et un arrêt sans erreur non gérée.
- En dev, `KIBO_BUILTIN_DIR` est absent : construction depuis `components/<id>/` au premier appel (quelques centaines de millisecondes, une fois par démarrage). Dans le paquet, le backend est préconstruit (étape 6) : aucune construction à l'exécution, aucun `node_modules` embarqué (N7).

`packages/daemon/src/integrations/bootstrap.ts` : après la création du `kit` et du module GitHub (Task 12) :

```ts
  ensureEventsTable(host.db);
  const refusals = createRefusalLog(host.db);
  const adapters = createAdapterHosts({
    load: (id) => loadBuiltinAdapter(id),
    calls: (manifest) =>
      createBindingCalls({
        bindings: (projectId) => host.snapshot(projectId).bindings,
        manifest,
        quotas: createQuotas({ fetchPerMinute: BINDING_FETCH_PER_MINUTE }),
        refusals,
        fetch: (m, url, init) => proxyFetch(m.net, url, init, { hooks: kit.hooks, secrets: m.secrets }),
      }),
  });
```

puis, dans `modules`, `syncModule(kit, createWorkerRunner(adapters.invoke), () => kit.github.account.mode() !== null)` et `{ stop: () => { adapters.stop(); refusals.flush(); } }`. Imports : `createEventLog as createRefusalLog` et `ensureEventsTable` de `../components/events` (renommés : `integrations/events.ts` exporte déjà `createEventLog`, N28), `createQuotas` de `../components/quotas`, `proxyFetch` de `../components/net-proxy`.

- [ ] **Step 5: Test d'aller-retour (échoue tant que les étapes 2 à 4 ne sont pas faites)**

`packages/daemon/src/sync/roundtrip.test.ts` (sur le vrai service, câblé comme dans `startDaemon` (Task 2, N26) : `createService(store, { user })`, hôte `createIntegrationHost({ user, home, store, service, notify, now })` dont `now` est l'horloge du test, `startIntegrations(host, flags, redactor)` puis `service.attachIntegrations(rpc)` ; le Worker réel exécute l'adaptateur construit depuis `components/github-issues`) :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Binding,
  type Instance,
  IntegrationEvent,
  type Page,
  type ProjectMeta,
  type RpcRequest,
  type RpcResult,
  type TicketView,
} from "@kibo/schema";
import { parseIntegrationFlags, startIntegrations } from "../integrations/bootstrap";
import { createIntegrationHost } from "../integrations/host";
import { createRedactor } from "../integrations/redact";
import type { IntegrationRpc } from "../integrations/registry";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";

let gh: FakeGithub;
let home: string;
let store: Store;
let service: Service;
let integrations: IntegrationRpc | null;
let project: ProjectMeta;
let binding: Binding;
let instance: Instance;
const clock = { now: Date.parse("2026-09-26T10:00:00Z") };
const events: IntegrationEvent[] = [];

const rpc = async <R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]> =>
  (await service.handle(req)) as RpcResult[R["method"]];
const sync = () => rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
const tickets = async (): Promise<TicketView[]> => (await rpc({ method: "getProject", projectId: project.id })).tickets;
const byTitle = async (title: string) => (await tickets()).find((t) => t.title === title);
const run = (command: Extract<RpcRequest, { method: "command" }>["command"], instanceId?: string) =>
  rpc({ method: "command", projectId: project.id, command, ...(instanceId && { instanceId }) });

beforeEach(async () => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  home = mkdtempSync(join(tmpdir(), "kibo-roundtrip-"));
  store = openStore(home);
  events.length = 0;
  integrations = null;
  service = createService(store, { user: "adam" });
  const host = createIntegrationHost({ user: "adam", home, store, service, notify: () => {}, now: () => clock.now });
  integrations = startIntegrations(
    host,
    parseIntegrationFlags({ "test-origins": `api.github.com=${gh.url}`, "memory-secrets": true }),
    createRedactor(),
  );
  service.attachIntegrations(integrations);
  service.onChange((m) => {
    const e = IntegrationEvent.safeParse(m);
    if (e.success) events.push(e.data);
  });
  project = await rpc({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#71717A" });
  await rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  binding = await rpc({
    method: "createBinding",
    projectId: project.id,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
  const page = (await run({ method: "addPage", title: "Kanban", kind: "view" })) as Page;
  instance = (await run({
    method: "addInstance",
    pageId: page.id,
    component: "kanban@1.0.0",
    config: { source: { bindingId: binding.id } },
  })) as Instance;
});
afterEach(() => {
  integrations?.stop();
  store.close();
  gh.stop();
  rmSync(home, { recursive: true, force: true });
});

test("issue to ticket, ticket to issue, rename, description, status and close", async () => {
  gh.addIssue("adam/kibo", { title: "Depuis GitHub", body: null });
  await sync();
  const imported = await byTitle("Depuis GitHub");
  expect(imported?.externalRefs[0]).toMatchObject({ kind: "github_issue", number: 1 });

  await run({ method: "createTicket", title: "Depuis Kibo" }, instance.id);
  await sync();
  const issues = () => [...(gh.repos.get("adam/kibo")?.issues.values() ?? [])];
  expect(issues().map((i) => i.title)).toEqual(["Depuis GitHub", "Depuis Kibo"]);
  expect((await byTitle("Depuis Kibo"))?.externalRefs[0]).toMatchObject({ number: 2, url: "https://github.com/adam/kibo/issues/2" });

  gh.editIssue("adam/kibo", 1, { title: "Renommée sur GitHub", body: "Corps\r\nligne 2" });
  await sync();
  expect(await byTitle("Renommée sur GitHub")).toMatchObject({ description: "Corps\nligne 2" });

  const t = await byTitle("Renommée sur GitHub");
  await run({ method: "updateTicket", ticketId: t?.id ?? "", description: "Nouvelle description" });
  await run({ method: "setStatus", ticketId: t?.id ?? "", statusId: "done" });
  await sync();
  expect(issues()[0]).toMatchObject({ body: "Nouvelle description", state: "closed" });

  const before = gh.requests.length;
  await sync();
  expect(gh.requests.slice(before).filter((r) => r.method !== "GET")).toEqual([]);
});

test("offline then back: the outbox waits, a conflict is won by GitHub and reported", async () => {
  gh.addIssue("adam/kibo", { title: "A" });
  await sync();
  const t = await byTitle("A");
  gh.failNext("PATCH", /\/issues\/1$/, 503);
  await run({ method: "updateTicket", ticketId: t?.id ?? "", title: "Local" });
  gh.editIssue("adam/kibo", 1, { title: "Distant" });
  await sync();
  expect((await tickets())[0]?.title).toBe("Distant");
  expect(events).toContainEqual({ type: "sync.conflict", projectId: project.id, ticketKey: "KIB-1", field: "title" });

  await run({ method: "setStatus", ticketId: t?.id ?? "", statusId: "done" });
  await sync();
  expect((await rpc({ method: "getSyncState", projectId: project.id })).pending).toEqual([t?.id]);
  expect(gh.repos.get("adam/kibo")?.issues.get(1)?.state).toBe("open");
  clock.now += 5_000;
  await sync();
  expect(gh.repos.get("adam/kibo")?.issues.get(1)?.state).toBe("closed");
  expect((await rpc({ method: "getSyncState", projectId: project.id })).pending).toEqual([]);
});

test("a 403 rate limit suspends the binding until the reset", async () => {
  gh.rate.remaining = 0;
  gh.addIssue("adam/kibo", { title: "A" });
  await expect(sync()).rejects.toThrow("RATE_LIMITED");
  const before = gh.requests.length;
  await expect(sync()).rejects.toThrow("RATE_LIMITED");
  expect(gh.requests.length).toBe(before);
  const statuses = await rpc({ method: "listIntegrations" });
  expect(statuses.find((s) => s.id === "github-issues")?.resumeAt).toBe(gh.rate.reset * 1000);
});
```

(`as RpcResult[…]`, `as Page`, `as Instance` : `service.handle` renvoie `unknown` par conception ; les formes sont celles du contrat RPC typé. Le 403 passe la frontière du Worker avec son code grâce à N23.)

Run: `bun test packages/daemon/src/sync/roundtrip.test.ts`
Expected: PASS une fois les étapes 2 à 4 faites. En cas d'échec, `gh.requests` (méthode, chemin) situe l'écart : adaptateur (Task 13), proxy (Task 8), frontière du Worker (N23) ou moteur (Task 14).

- [ ] **Step 6: Paquet desktop**

`apps/desktop/scripts/build-sidecar.ts` (tel que livré par la tâche 34 de la phase 4), après la construction des binaires :

```ts
import { buildBuiltinBackend, writeBuiltinBackend } from "@kibo/devkit";
import { BUILTIN_ADAPTER_IDS } from "@kibo/schema";

const builtinOut = join(root, "apps/desktop/src-tauri/builtin");
for (const id of BUILTIN_ADAPTER_IDS) {
  await writeBuiltinBackend(await buildBuiltinBackend(join(root, "components", id)), join(builtinOut, id));
  console.log(`builtin: ${join(builtinOut, id)}`);
}
```

(les deux `import` rejoignent ceux du haut du fichier).
- `apps/desktop/package.json` : `devDependencies` `"@kibo/devkit": "workspace:*"`, `"@kibo/schema": "workspace:*"` ; `apps/desktop/tsconfig.json` : `"references": [{ "path": "../../packages/schema" }, { "path": "../../packages/devkit" }]`.
- `apps/desktop/src-tauri/tauri.conf.json`, `bundle.resources` : `{ "../../../packages/ui/dist/": "ui/", "builtin/": "builtin/" }`.
- `apps/desktop/src-tauri/src/main.rs`, dans `setup`, à côté de `ui_dir` : `let builtin_dir = app.path().resource_dir()?.join("builtin");` et `.env("KIBO_BUILTIN_DIR", builtin_dir.to_string_lossy().to_string())` après `.env("KIBO_NATIVE_NOTIFY", "1")`.
- `.gitignore` : `apps/desktop/src-tauri/builtin/`.
- Contrôle local (la CI GitHub est hors service ; `desktop-smoke` de `.github/workflows/ci.yml` exécute déjà `build:debug`, donc `sidecar`) : après `bun run --cwd apps/desktop build:debug`, `test -f apps/desktop/src-tauri/builtin/github-issues/server.js` réussit.

- [ ] **Step 7: Vérifier et commiter**

Run: `bun test packages/daemon && bun test packages/devkit && bun test components && bun run check && bun run typecheck` — Expected: PASS (dont `roundtrip.test.ts`).

```bash
git add packages/devkit/src/build-builtin.ts packages/devkit/src/build-builtin.test.ts packages/devkit/src/index.ts packages/daemon/src/components/host-core.ts packages/daemon/src/components/host-core.test.ts
git commit -m "feat(devkit): backends intégrés, codes distants"
git add packages/daemon/src/sync/worker-runner.ts packages/daemon/src/sync/worker-runner.test.ts packages/daemon/src/sync/binding-calls.ts packages/daemon/src/sync/binding-calls.test.ts packages/daemon/src/sync/builtin-adapter.ts packages/daemon/src/sync/roundtrip.test.ts packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): adaptateur GitHub dans le Worker"
git add apps/desktop/scripts/build-sidecar.ts apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/src/main.rs .gitignore bun.lock
git commit -m "build(desktop): backends intégrés préconstruits"
```

---

### Task 20: Figma par MCP (D1)

Serveur MCP Dev Mode de l'application Figma, ouvert par le hub sous l'identifiant réservé `figma` (N13) ; aucun secret. Lier un nœud, aperçu en cache, URL des maquettes dans `brief.md` (par `buildBrief` de `core`, déjà pur et déjà nourri du ticket et de ses réfs.).

**Files:**
- Create: `packages/daemon/src/figma/{figma-url.ts,figma.ts,module.ts}`
- Test: `packages/daemon/src/figma/{figma-url.test.ts,figma.test.ts}`
- Modify: `packages/daemon/src/testing/fake-mcp.ts` (option `omit`), `packages/daemon/src/integrations/bootstrap.ts` (module), `packages/core/src/context.ts` (`buildBrief` : section « Maquettes ») et `packages/core/src/context.test.ts`

**Interfaces:**
- Consumes: `McpHub` (`setReserved`, `tools`, `call`) (Task 15) ; `Settings` (`figma.url`), `IntegrationKit`, `IntegrationModule`, `baseStatus`, `EventLog` (`integrations/events.ts`), `IntegrationHost.command` (N22 : passe par `docs.run`) (Task 2) ; `FigmaNodeRef`, `FigmaPreview`, RPC `configureFigma`, `linkFigmaNode`, `getFigmaPreview`, `disconnectIntegration` (Task 1) ; commande `upsertExternalRef` réservée au démon, dédoublonnée par `fileKey + nodeId` pour `figma_node` (Task 4) ; faux MCP `startFakeMcpHttp`, `FAKE_PNG_BASE64` (Task 7) ; `buildBrief` (`packages/core/src/context.ts`, phase 2, pur ; reçoit déjà le `TicketView` avec ses `externalRefs`, appelé par `packages/daemon/src/agents/run-launch.ts` via `buildRunContext`).
- Produces:
  - `parseFigmaUrl(raw: string): { fileKey: string; nodeId: string; url: string } | null` ; `nameFromMetadata(text: string): string | null`
  - `FIGMA_TOOLS = ["get_metadata", "get_screenshot"]` ; `PREVIEW_TTL_MS = 7 jours` ; `MAX_PREVIEW_BYTES = 2 Mio`
  - `createFigma(deps: { host: IntegrationHost; hub: McpHub; settings: Settings; events: EventLog }): Figma` avec `Figma = { start(): Promise<void>; configure(url: string): Promise<IntegrationStatus>; status(): IntegrationStatus; test(): Promise<IntegrationStatus>; link(projectId: string, ticketId: string, url: string): Promise<FigmaNodeRef>; preview(fileKey: string, nodeId: string): Promise<FigmaPreview>; disconnect(): Promise<void> }`
  - `buildBrief` (core) : section `## Maquettes` (une ligne `- <nom> : <url>` par réf. `figma_node`), après « Dépendances » et avant « Consignes », absente sans maquette
  - `figmaModule(kit: IntegrationKit, hub: McpHub): IntegrationModule` (handlers `configureFigma`, `linkFigmaNode`, `getFigmaPreview` ; sonde `figma` avec `test` et `disconnect`)
  - `buildFakeMcpServer(opts?: { omit?: string[] })`, `startFakeMcpHttp(opts?: { bearer?: string; omit?: string[] })`

- [ ] **Step 1: Tests (échouent)**

`packages/daemon/src/figma/figma-url.test.ts` :

```ts
import { expect, test } from "bun:test";
import { nameFromMetadata, parseFigmaUrl } from "./figma-url";

test("node URLs are parsed, everything else is refused", () => {
  expect(parseFigmaUrl("https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=x")).toEqual({
    fileKey: "AbC123xyz",
    nodeId: "12:34",
    url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=x",
  });
  expect(parseFigmaUrl("https://figma.com/file/AbC123xyz/?node-id=12%3A34")?.nodeId).toBe("12:34");
  for (const bad of [
    "https://www.figma.com/design/AbC123xyz/Kibo",
    "http://www.figma.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://evil.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://www.figma.com.evil.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://www.figma.com/design/AbC123xyz/Kibo?node-id=abc",
    "javascript:alert(1)",
    "pas une url",
  ]) {
    expect(parseFigmaUrl(bad)).toBeNull();
  }
});

test("the node name comes from the metadata tool", () => {
  expect(nameFromMetadata('<frame id="12:34" name="Kibo › Tickets &amp; Arbre" x="0" />')).toBe("Kibo › Tickets & Arbre");
  expect(nameFromMetadata("no attributes here")).toBeNull();
});
```

`packages/core/src/context.test.ts` : ajouter, avec l'aide existante `kibo()` du fichier (qui rend `{ project, ticket }`) :

```ts
test("the brief lists the linked mockups, only their URL", () => {
  const { project, ticket } = kibo();
  const figma = {
    kind: "figma_node" as const,
    fileKey: "AbC123xyz",
    nodeId: "12:34",
    url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
    name: "Arbre",
  };
  const withMockup = buildBrief({ project, ticket: { ...ticket, externalRefs: [figma] }, domain: null, note: "" });
  expect(withMockup).toContain("## Maquettes\n\n- Arbre : https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34\n");
  expect(buildBrief({ project, ticket, domain: null, note: "" })).not.toContain("## Maquettes");
});
```


`packages/daemon/src/figma/figma.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createMcpHub, type McpHub } from "../mcp/hub";
import { FAKE_PNG_BASE64, startFakeMcpHttp } from "../testing/fake-mcp";
import { createFigma, type Figma } from "./figma";

let host: FakeHost;
let hub: McpHub;
let figma: Figma;
let server: Awaited<ReturnType<typeof startFakeMcpHttp>>;
const USER = { origin: "user" as const, instanceId: null };

beforeEach(async () => {
  server = await startFakeMcpHttp();
  host = createFakeHost();
  const events = createEventLog(host.db, createRedactor(), host.now);
  hub = createMcpHub({ host, secrets: createMemorySecretStore(createRedactor()), events, redact: (t) => t });
  figma = createFigma({ host, hub, settings: createSettings(host.db), events });
});
afterEach(async () => {
  await hub.stop();
  await server.stop();
  host.close();
});

const calls = () => (host.db.query("SELECT tool FROM mcp_calls WHERE server = 'figma'").all() as { tool: string }[]).map((r) => r.tool);

test("configuring checks reachability and the expected tools", async () => {
  await expect(figma.configure("http://127.0.0.1:1/mcp")).rejects.toThrow("MCP_UNAVAILABLE");
  expect(figma.status().state).toBe("disconnected");
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await expect(figma.configure(partial.url)).rejects.toThrow("MCP_FAILED");
  await partial.stop();
  expect(figma.status().state).toBe("disconnected");
  expect((await figma.configure(server.url)).state).toBe("connected");
  expect(host.db.query("SELECT value FROM integration_settings WHERE key = 'figma.url'").get()).toEqual({ value: server.url });
});

test("linking a node stores its name and URL on the ticket", async () => {
  await figma.configure(server.url);
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await expect(figma.link(host.projectId, t.id, "https://example.com/x")).rejects.toThrow("INVALID_INPUT");
  const ref = await figma.link(host.projectId, t.id, "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34");
  expect(ref).toMatchObject({ kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", name: "Kibo › Tickets / Arbre" });
  expect(host.snapshot(host.projectId).tickets[0]?.externalRefs).toEqual([ref]);
});

test("linking without Figma configured says so", async () => {
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await expect(figma.link(host.projectId, t.id, "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34")).rejects.toThrow("NOT_CONNECTED");
});

test("previews are cached 7 days, 0600, and served from cache when Figma is closed", async () => {
  await figma.configure(server.url);
  const first = await figma.preview("AbC123xyz", "12:34");
  expect(first).toMatchObject({ png: FAKE_PNG_BASE64, reachable: true, available: true });
  const row = host.db.query("SELECT png_path FROM figma_cache").get() as { png_path: string };
  expect(statSync(row.png_path).mode & 0o777).toBe(0o600);
  await figma.preview("AbC123xyz", "12:34");
  expect(calls().filter((c) => c === "get_screenshot")).toHaveLength(1);
  await server.stop();
  await hub.setReserved("figma", server.url);
  host.clock.now += 8 * 24 * 3_600_000;
  expect(await figma.preview("AbC123xyz", "12:34")).toMatchObject({ png: FAKE_PNG_BASE64, reachable: false });
  server = await startFakeMcpHttp();
});

test("a server without a screenshot tool gives 'preview unavailable'", async () => {
  await figma.configure(server.url);
  await hub.stop();
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await hub.setReserved("figma", partial.url);
  expect(await figma.preview("AbC123xyz", "56:78")).toMatchObject({ png: null, reachable: true, available: false });
  await partial.stop();
});

test("disconnecting forgets the address, never the links", async () => {
  await figma.configure(server.url);
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await figma.link(host.projectId, t.id, "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34");
  await figma.disconnect();
  expect(figma.status().state).toBe("disconnected");
  expect(host.snapshot(host.projectId).tickets[0]?.externalRefs).toHaveLength(1);
});
```

Run: `bun test packages/daemon/src/figma` — Expected: FAIL.

- [ ] **Step 2: Option `omit` du faux MCP**

`packages/daemon/src/testing/fake-mcp.ts` : `buildFakeMcpServer(opts: { omit?: string[] } = {})` n'enregistre pas les outils dont le nom figure dans `opts.omit` (garde `if (!omit.includes(name))` autour de chaque `registerTool`, via une fonction locale `tool(name, config, handler)`) ; `startFakeMcpHttp(opts: { bearer?: string; omit?: string[] } = {})` passe `omit` à `buildFakeMcpServer`.

- [ ] **Step 3: `figma-url.ts` et section « Maquettes » du brief**

`packages/daemon/src/figma/figma-url.ts` :

```ts
const HOSTS = new Set(["figma.com", "www.figma.com"]);
const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&#39;": "'", "&apos;": "'" };

export function parseFigmaUrl(raw: string): { fileKey: string; nodeId: string; url: string } | null {
  const text = raw.trim();
  if (!URL.canParse(text)) return null;
  const u = new URL(text);
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) return null;
  const file = /^\/(?:design|file|proto)\/([A-Za-z0-9]{6,64})(?:\/|$)/.exec(u.pathname);
  const node = /^(\d+)[-:](\d+)$/.exec(u.searchParams.get("node-id") ?? "");
  if (!file?.[1] || !node) return null;
  return { fileKey: file[1], nodeId: `${node[1]}:${node[2]}`, url: u.toString() };
}

export function nameFromMetadata(text: string): string | null {
  const m = /\bname="([^"]*)"/.exec(text);
  if (!m?.[1]) return null;
  const name = m[1].replace(/&(?:amp|quot|lt|gt|#39|apos);/g, (e) => ENTITIES[e] ?? e).trim();
  return name ? name.slice(0, 200) : null;
}
```

`packages/core/src/context.ts`, dans `buildBrief`, après le bloc « Dépendances » et avant « Consignes » :

```ts
  const mockups = ticket.externalRefs.filter((r) => r.kind === "figma_node");
  if (mockups.length > 0) {
    lines.push("", "## Maquettes", "", ...mockups.map((m) => `- ${m.name} : ${m.url}`));
  }
```

(`ticket.externalRefs` est l'union `ExternalRef` étendue par la Task 4 ; le filtre sur `kind` la resserre à `figma_node`.) Le brief est pur et déjà écrit dans `brief.md` par `buildRunContext` (`run-launch.ts`) : aucun code démon de plus. Aucun secret ni aperçu dans le brief (URL seulement).

- [ ] **Step 4: `figma.ts`**

```ts
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type FigmaNodeRef, type FigmaPreview, type IntegrationStatus, KiboError } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import { baseStatus } from "../integrations/probes";
import type { Settings } from "../integrations/settings";
import type { IntegrationHost } from "../integrations/types";
import type { McpHub } from "../mcp/hub";
import { nameFromMetadata, parseFigmaUrl } from "./figma-url";

export const FIGMA_TOOLS = ["get_metadata", "get_screenshot"] as const;
export const PREVIEW_TTL_MS = 7 * 24 * 3_600_000;
export const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
type Deps = { host: IntegrationHost; hub: McpHub; settings: Settings; events: EventLog };
type CacheRow = { png_path: string; fetched_at: number };

export type Figma = ReturnType<typeof createFigma>;

const isPng = (b: Buffer) => b.length <= MAX_PREVIEW_BYTES && PNG_SIGNATURE.every((v, i) => b[i] === v);
const asKibo = (e: unknown) => (e instanceof KiboError ? e : new KiboError("MCP_FAILED", String(e)));

export function createFigma(deps: Deps) {
  const { host, hub, settings, events } = deps;
  let lastError: { code: KiboError["code"]; message: string } | null = null;
  const selectCache = host.db.query("SELECT png_path, fetched_at FROM figma_cache WHERE file_key = $f AND node_id = $n");
  const upsertCache = host.db.query(
    "INSERT INTO figma_cache VALUES ($f, $n, $path, $at) ON CONFLICT(file_key, node_id) DO UPDATE SET png_path = excluded.png_path, fetched_at = excluded.fetched_at",
  );

  const checkTools = async () => {
    const names = (await hub.tools("figma")).map((t) => t.name);
    const missing = FIGMA_TOOLS.filter((n) => !names.includes(n));
    if (missing.length > 0) throw new KiboError("MCP_FAILED", `figma server lacks tools: ${missing.join(", ")}`);
  };
  const status = (): IntegrationStatus => {
    if (settings.get("figma.url") === null) return baseStatus("figma", "disconnected");
    return lastError ? { ...baseStatus("figma", "error"), error: lastError } : baseStatus("figma", "connected");
  };
  const cached = (fileKey: string, nodeId: string): { png: string; fetchedAt: number } | null => {
    const row = selectCache.get({ f: fileKey, n: nodeId }) as CacheRow | null;
    if (!row || !existsSync(row.png_path)) return null;
    return { png: readFileSync(row.png_path).toString("base64"), fetchedAt: row.fetched_at };
  };
  const store = (fileKey: string, nodeId: string, png: Buffer) => {
    const path = join(host.home, "cache", "figma", fileKey, `${nodeId.replace(":", "-")}.png`);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, png, { mode: 0o600 });
    chmodSync(path, 0o600);
    upsertCache.run({ f: fileKey, n: nodeId, path, at: host.now() });
  };

  return {
    async start() {
      const url = settings.get("figma.url");
      if (url !== null) await hub.setReserved("figma", url);
    },
    async configure(url: string): Promise<IntegrationStatus> {
      const u = new URL(url);
      if (!(u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK.has(u.hostname)))) {
        throw new KiboError("INVALID_INPUT", "figma server must be https or loopback http");
      }
      const previous = settings.get("figma.url");
      await hub.setReserved("figma", url);
      try {
        await checkTools();
      } catch (e) {
        await hub.setReserved("figma", previous);
        throw asKibo(e);
      }
      settings.set("figma.url", url);
      lastError = null;
      events.log("figma", "info", `configured ${url}`);
      host.broadcast({ type: "integrations" });
      return status();
    },
    status,
    async test(): Promise<IntegrationStatus> {
      if (settings.get("figma.url") === null) return status();
      try {
        await checkTools();
        lastError = null;
      } catch (e) {
        const k = asKibo(e);
        lastError = { code: k.code, message: k.detail };
      }
      return status();
    },
    async link(projectId: string, ticketId: string, raw: string): Promise<FigmaNodeRef> {
      const parsed = parseFigmaUrl(raw);
      if (!parsed) throw new KiboError("INVALID_INPUT", "not a figma node url");
      if (settings.get("figma.url") === null) throw new KiboError("NOT_CONNECTED", "figma is not configured");
      const meta = await hub.call("figma", "get_metadata", { nodeId: parsed.nodeId }, null);
      const text = meta.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
      const ref: FigmaNodeRef = { kind: "figma_node", ...parsed, name: nameFromMetadata(text) ?? parsed.nodeId };
      host.command(projectId, { method: "upsertExternalRef", ticketId, ref }, { origin: "user", instanceId: null });
      return ref;
    },
    async preview(fileKey: string, nodeId: string): Promise<FigmaPreview> {
      const hit = cached(fileKey, nodeId);
      if (hit && host.now() - hit.fetchedAt < PREVIEW_TTL_MS) return { ...hit, reachable: true, available: true };
      const offline: FigmaPreview = { png: hit?.png ?? null, fetchedAt: hit?.fetchedAt ?? null, reachable: false, available: hit !== null };
      if (settings.get("figma.url") === null) return offline;
      try {
        const tools = (await hub.tools("figma")).map((t) => t.name);
        if (!tools.includes("get_screenshot")) return { png: hit?.png ?? null, fetchedAt: hit?.fetchedAt ?? null, reachable: true, available: hit !== null };
        const res = await hub.call("figma", "get_screenshot", { nodeId }, null);
        const image = res.content.find((c) => c.type === "image" && c.mimeType === "image/png");
        const png = image?.type === "image" ? Buffer.from(image.data, "base64") : null;
        if (!png || !isPng(png)) return { png: hit?.png ?? null, fetchedAt: hit?.fetchedAt ?? null, reachable: true, available: hit !== null };
        store(fileKey, nodeId, png);
        return { png: png.toString("base64"), fetchedAt: host.now(), reachable: true, available: true };
      } catch (e) {
        const k = asKibo(e);
        if (k.code !== "MCP_UNAVAILABLE" && k.code !== "TIMEOUT") throw k;
        events.log("figma", "warn", `preview ${fileKey}/${nodeId}: ${k.detail}`);
        return offline;
      }
    },
    async disconnect() {
      settings.delete("figma.url");
      lastError = null;
      await hub.setReserved("figma", null);
    },
  };
}
```

- `KiboError["code"]` est le type `KiboErrorCode`.
- `hub.setReserved("figma", url)` construit l'entrée `McpServerInput` sans la parser (l'identifiant `figma` est refusé par le schéma aux serveurs de l'utilisateur, pas au démon) ; une adresse `https` non loopback passe par le `fetch` épinglé de la Task 15 (N27).
- `host.command(… upsertExternalRef …)` est un appel du démon (N22, `docs.run`) : la commande, réservée (Task 4), n'est jamais ouverte aux composants.
- `preview` : Figma fermé ou lent ⇒ aperçu en cache (même périmé) et badge « Figma non joignable » (journalisé en avertissement) ; toute autre erreur remonte.
- Un PNG invalide ou de plus de 2 Mio n'est jamais écrit.

- [ ] **Step 5: `module.ts` et amorçage**

```ts
import { KiboError } from "@kibo/schema";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { McpHub } from "../mcp/hub";
import { createFigma } from "./figma";

export function figmaModule(kit: IntegrationKit, hub: McpHub): IntegrationModule {
  const figma = createFigma({ host: kit.host, hub, settings: kit.settings, events: kit.events });
  figma.start().catch((e) => kit.events.log("figma", "error", `start failed: ${e instanceof KiboError ? e.detail : String(e)}`));
  return {
    handlers: {
      configureFigma: (req) => figma.configure(req.url),
      linkFigmaNode: (req) => figma.link(req.projectId, req.ticketId, req.url),
      getFigmaPreview: (req) => figma.preview(req.fileKey, req.nodeId),
    },
    probes: [
      {
        id: "figma",
        status: async () => figma.status(),
        test: () => figma.test(),
        async disconnect() {
          await figma.disconnect();
          kit.host.broadcast({ type: "integrations" });
        },
      },
    ],
  };
}
```

`bootstrap.ts` : ajouter `figmaModule(kit, mcpHub)` à `modules`.

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages/daemon/src/figma packages/daemon/src/testing packages/core/src/context.test.ts && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/figma packages/daemon/src/testing/fake-mcp.ts packages/daemon/src/integrations/bootstrap.ts packages/core/src/context.ts packages/core/src/context.test.ts
git commit -m "feat(daemon): nœuds Figma liés et aperçus"
```

---

### Task 21: Kanban et Tickets synchronisés

Référence : maquette P11 (sombre et clair), pages PDF 8 et 14 (cartes Kanban avec chips). Une instance dont la config porte `source: { bindingId }` n'affiche que les tickets de la liaison (et leurs sous-tickets locaux) ; le shell ajoute l'en-tête de source ; la création depuis l'instance porte son `instanceId` pour que le démon crée l'issue (Task 14).

**Files:**
- Modify: `packages/sdk/src/source.ts` (+ `filterBySource`), `packages/sdk/src/source.test.ts`, `packages/sdk/src/types.ts` (`NewTicketDefaults.instanceId`), `packages/sdk/src/sdk.ts` (`openNewTicket` ajoute `instanceId`), `packages/sdk/src/client.ts` (`projectBackend.run` passe `instanceId` à la RPC `command`, N16), `packages/sdk/src/client.test.ts`, `packages/sdk/src/sdk.test.ts` (attendu de `newTicketRequests`)
- Modify: `components/kanban/{kibo.component.json,src/Kanban.tsx,src/KanbanCard.tsx,src/fr.ts,src/kanban.test.tsx}`, `components/tickets/{src/TicketsTree.tsx,src/tickets.test.tsx}`
- Create: `packages/ui/src/pages/SourceHeader.tsx`, `packages/ui/src/pages/SourceHeader.test.tsx`, `packages/ui/src/shell/IntegrationNotices.tsx`, `packages/ui/src/shell/integration-notices.test.tsx`
- Modify: `packages/ui/src/pages/PageView.tsx`, `packages/ui/src/dialogs/NewTicketDialog.tsx` (+ son test dans `dialogs.test.tsx`), `packages/ui/src/shell/lazy-screens.ts`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/package.json` (`"sonner": "2.0.8"`, version déjà verrouillée par le SDK : aucune résolution nouvelle dans `bun.lock`), `packages/ui/src/i18n/fr-integrations.ts` (bloc `instance`)

**Interfaces:**
- Consumes: `readSource`, `matchesSource`, `EntityMap.ci_run`, `createMockSdk({ ciRuns })` (Task 9) ; `ProjectSnapshot.bindings` (Task 4) ; RPC `syncBinding`, `getSyncState`, `command` avec `instanceId` (Tasks 1, 2) ; `IntegrationEvent` avec `sync.conflict` et `notice` (Task 1, N25) ; `client.subscribeIntegrations` (Task 2, N24) ; `useSyncState` (Task 10) ; `Toaster` (`@kibo/sdk/ui/sonner`, phase 1, jamais monté jusqu'ici) ; `useTheme` (`packages/ui/src/theme.ts`) ; `lazyPanel` (décision 29 de la phase 4) ; tons CI identiques à `runTone` (Task 18), recopiés en 6 lignes dans le composant : un composant n'importe jamais `ui`.
- Produces:
  - `filterBySource(tickets: TicketView[], source: InstanceSource | null): TicketView[]` (tickets de la liaison + descendants)
  - `NewTicketDefaults = { statusId?; parentId?; instanceId?: string }` ; `sdk.openNewTicket(d)` complète `instanceId`
  - `SourceHeader({ project, instance })` ; `IntegrationNotices({ notifications })` (N25, N29 : `Toaster` monté une fois, toasts de conflit, notification système en mode navigateur), chargé par `lazyPanel` hors du chargement initial
  - `projectBackend(client, projectId, instanceId).run` envoie `{ method: "command", projectId, command, instanceId }` : une création faite directement par une instance synchronisée (mode `builtin`) est réécrite par le démon (N16)
  - `fr.integrations.instance = { header(repo); sync; syncing; lastSync(time); never; bindingRemoved; bindingRemovedHelp }`
  - N16 : une instance synchronisée ouvre le Kanban sur le filtre « Tous »

- [x] **Step 1: Tests SDK (échouent)**

Ajouter à `packages/sdk/src/source.test.ts` :

```ts
import { filterBySource } from "./source";

test("a synced view keeps the binding's tickets and their local sub-tickets", () => {
  const ref = { kind: "github_issue" as const, bindingId: "b1", repo: "adam/kibo", number: 1, nodeId: "I_1", url: "https://github.com/adam/kibo/issues/1" };
  const t = (id: string, parentId: string | null, refs: unknown[] = []) => ({ id, parentId, externalRefs: refs }) as unknown as TicketView;
  const tickets = [t("a", null, [ref]), t("a1", "a"), t("a11", "a1"), t("b", null), t("c", null, [{ ...ref, bindingId: "b2" }])];
  expect(filterBySource(tickets, { bindingId: "b1" }).map((x) => x.id)).toEqual(["a", "a1", "a11"]);
  expect(filterBySource(tickets, null)).toHaveLength(5);
});

test("new tickets opened from an instance carry its id", () => {
  const m = createMockSdk(manifest, {});
  m.sdk.openNewTicket({ statusId: "todo" });
  expect(m.newTicketRequests).toEqual([{ statusId: "todo", instanceId: "mock-instance" }]);
});
```

(`as unknown as TicketView` : fixture réduite aux champs lus. `manifest` et `createMockSdk` sont ceux déjà importés par le fichier de test de la Task 9 ; `MockSdk.newTicketRequests` existe (`packages/sdk/src/mock.ts`) et l'instance simulée s'appelle `"mock-instance"`.)

Ajouter à `packages/sdk/src/client.test.ts` : `projectBackend(client, "p1", "i1").run({ method: "createTicket", title: "A" })` ⇒ la requête RPC envoyée vaut `{ method: "command", projectId: "p1", command: { method: "createTicket", title: "A" }, instanceId: "i1" }` (même faux `fetch` que les tests existants du fichier).

Run: `bun test packages/sdk/src/source.test.ts` — Expected: FAIL.

- [x] **Step 2: `filterBySource` et `openNewTicket`**

`packages/sdk/src/source.ts`, ajouter :

```ts
export function filterBySource(tickets: TicketView[], source: InstanceSource | null): TicketView[] {
  if (source === null) return tickets;
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const memo = new Map<string, boolean>();
  const inside = (t: TicketView): boolean => {
    const known = memo.get(t.id);
    if (known !== undefined) return known;
    memo.set(t.id, false);
    const parent = t.parentId ? byId.get(t.parentId) : undefined;
    const result = matchesSource(t, source) || (parent !== undefined && inside(parent));
    memo.set(t.id, result);
    return result;
  };
  return tickets.filter(inside);
}
```

(`memo.set(t.id, false)` avant la récursion : un cycle impossible par construction de l'arbre ne boucle jamais.)

`packages/sdk/src/types.ts` : `export type NewTicketDefaults = { statusId?: StatusId; parentId?: string | null; instanceId?: string };`
`packages/sdk/src/sdk.ts`, dans l'objet renvoyé par `createSdk` : juste après `...ctx,`, `openNewTicket: (d) => ctx.openNewTicket({ ...d, instanceId: ctx.instanceId }),`.
`packages/sdk/src/client.ts`, `projectBackend` : `run: (command: ProjectCommand) => client.rpc({ method: "command", projectId, command, instanceId }),` (la requête `command` accepte `instanceId?` depuis la Task 2).

Run: `bun test packages/sdk components` — Expected: PASS après mise à jour des attendus existants qui comparent `newTicketRequests` : `packages/sdk/src/sdk.test.ts` (`[{ statusId: "todo", instanceId: "mock-instance" }]`) et `components/kanban/src/kanban.test.tsx` (`[{ statusId: "in_progress", instanceId: "mock-instance" }]`) ; `tickets.test.tsx` ne lit que `parentId`.

- [x] **Step 3: Tests Kanban (échouent)**

Ajouter à `components/kanban/src/kanban.test.tsx` :

```tsx
const issueRef = (n: number) => ({
  kind: "github_issue" as const,
  bindingId: "b1",
  repo: "adam/kibo",
  number: n,
  nodeId: `I_${n}`,
  url: `https://github.com/adam/kibo/issues/${n}`,
});
const syncedSeed = (run: (cmd: ProjectCommand) => unknown) => {
  const a = run({ method: "importExternalTicket", title: "Issue synchronisée", ref: issueRef(1) }) as Ticket;
  run({ method: "createTicket", title: "Sous-tâche locale", parentId: a.id });
  run({ method: "createTicket", title: "Ticket local", assignee: { kind: "human", ref: "adam" } });
  const b = run({ method: "importExternalTicket", title: "Avec PR", ref: issueRef(2) }) as Ticket;
  run({
    method: "upsertExternalRef",
    ticketId: b.id,
    ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
  });
};
const failedRun = {
  repo: "adam/kibo",
  runId: 900,
  prNumber: 12,
  ticketKey: "KIB-4",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/adam/kibo/actions/runs/900",
  startedAt: null,
  updatedAt: "2026-09-26T10:03:12Z",
  jobs: [],
};

test("a synced Kanban shows only the binding's tickets, on the 'all' filter", async () => {
  const m = createMockSdk(manifest, { seed: syncedSeed, viewer: "adam", config: { source: { bindingId: "b1" } }, ciRuns: [failedRun] });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("Issue synchronisée")).toBeTruthy();
  expect(screen.getByText("Sous-tâche locale")).toBeTruthy();
  expect(screen.queryByText("Ticket local")).toBeNull();
  expect(screen.getByText("3 / 3 tickets")).toBeTruthy();
  expect(screen.getByLabelText("CI cassée")).toBeTruthy();
});
```

(Les commandes réservées `importExternalTicket` et `upsertExternalRef` passent par `run` du seed, qui appelle `executeProjectCommand` directement, sans contrôle `writes` : c'est le `run` interne de `createMockSdk`, `packages/sdk/src/mock.ts`.)

Run: `bun test components/kanban` — Expected: FAIL.

- [x] **Step 4: Kanban**

`components/kanban/kibo.component.json` : `"reads": ["ticket", "status", "run", "ci_run"]` (`run` reste : pastilles d'agent). `configSchema` est **inchangé** : le format de la phase 4 (décision 2) n'accepte que des valeurs scalaires, `source` (objet `{ bindingId }`, spec F §3.2) ne peut pas y être déclaré. `source` est une clé posée par le shell à l'écran 3 et lue par `readSource` ; `validateConfig` n'est appelé que par la mise à jour d'une version publiée (`daemon/src/components/update.ts`), jamais pour un intégré, donc aucune instance synchronisée n'est refusée (voir la décision N34).

`components/kanban/src/fr.ts`, ajouter :

```ts
  ci: { ok: "CI réussie", error: "CI cassée", running: "CI en cours" },
  ciUnavailable: (message: string) => `CI indisponible : ${message}`,
```

`components/kanban/src/Kanban.tsx` :

```tsx
import { type CiRun, KiboError } from "@kibo/schema";
import { filterBySource, readSource } from "@kibo/sdk";
```

(`useEntities`, `useSdk`, `StatusDot` sont déjà importés de `@kibo/sdk` : fusionner dans le même import.)

```tsx
  const source = readSource(sdk.config);
  const { data: ciRuns, error: ciError } = useEntities("ci_run");
  const [filter, setFilter] = useState<KanbanFilter>(
    source !== null || sdk.config.filter === "all" ? "all" : "mine-and-agents",
  );
  const scoped = filterBySource(tickets, source);
  const shown = filterTickets(scoped, filter, sdk.viewer);
  const ciOf = (t: TicketView): CiRun | undefined =>
    ciRuns.filter((r) => r.ticketKey === t.key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const ciProblem = ciError && !(ciError instanceof KiboError && ciError.code === "NOT_CONNECTED") ? ciError.message : null;
```

- Le fichier a déjà `const { data: runs } = useEntities("run")` (runs d'agents) : le nom `ciRuns` évite le conflit. L'état `filter` existant (`useState<KanbanFilter>(sdk.config.filter === "all" ? "all" : "mine-and-agents")`) est remplacé par la version ci-dessus.
- Le compteur (`fr.counter(shown.length, tickets.length)` aujourd'hui) devient `fr.counter(shown.length, scoped.length)`.
- `KanbanCard` reçoit `ci={ciOf(t)}`.
- Dans l'en-tête, à côté de l'alerte existante : `{ciProblem && <p role="alert" className="text-destructive">{fr.ciUnavailable(ciProblem)}</p>}` (GitHub non connecté n'est pas une erreur : aucun chip, aucun message).
- `useEntities` (`packages/sdk/src/react.tsx`) expose déjà `error: KiboError | null`. En mode `builtin`, `list("ci_run")` passe par `componentCall` (Task 9) ; sans sondeur CI, le démon répond `NOT_CONNECTED`, qui n'est pas affiché.

`components/kanban/src/KanbanCard.tsx` : prop `ci?: CiRun`, et dans la rangée de badges (`AgentBadge`, badges `waitingOn`), avant la progression `ml-auto` ; densité 13 px de la phase 4 (`text-3xs` comme les badges voisins) :

```tsx
        {ci && (
          <span aria-label={fr.ci[ciTone(ci)]} title={fr.ci[ciTone(ci)]} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-3xs">
            <span aria-hidden className={`size-2 rounded-full ${CI_DOT[ciTone(ci)]}`} />
            {ci.prNumber !== null && `#${ci.prNumber}`}
          </span>
        )}
```

avec, en tête du fichier :

```tsx
const CI_DOT = { ok: "bg-emerald-500", error: "bg-red-500", running: "bg-amber-500" } as const;
function ciTone(run: Pick<CiRun, "status" | "conclusion">): keyof typeof CI_DOT {
  if (run.status !== "completed") return "running";
  return run.conclusion === "success" || run.conclusion === "skipped" || run.conclusion === "neutral" ? "ok" : "error";
}
```

`KanbanCard` (props réelles : `ticket`, `run`, `statuses`, `onOpen`, `onMove`) n'affiche aujourd'hui aucun chip de PR : ce chip `#12` à pastille est le seul. Couleurs identiques à celles de la section CI du Sheet (Task 18) ; aucun orange.

- [x] **Step 5: Tickets**

`components/tickets/kibo.component.json` : inchangé (même raison que le Kanban). `components/tickets/src/TicketsTree.tsx` : `const { data: all, loading } = useEntities("ticket");` puis `const tickets = filterBySource(all, readSource(sdk.config));` avant `buildTree(tickets)`. Test ajouté à `tickets.test.tsx` : avec `config: { source: { bindingId: "b1" } }` et le même `syncedSeed` (recopié), l'arbre montre « Issue synchronisée » et « Sous-tâche locale », pas « Ticket local ».

Run: `bun test components` — Expected: PASS (conformité comprise : `ci_run` est déclaré dans `reads`).

- [x] **Step 6: En-tête de source et création depuis l'instance**

`packages/ui/src/i18n/fr-integrations.ts`, ajouter :

```ts
  instance: {
    header: (repo: string) => `GitHub · ${repo}`,
    sync: "Synchroniser",
    syncing: "Synchronisation…",
    lastSync: (time: string) => `Synchronisé à ${time}`,
    never: "Jamais synchronisé",
    bindingRemoved: "Liaison supprimée",
    bindingRemovedHelp: "Ce composant n'est plus synchronisé avec GitHub ; ses tickets restent dans le projet.",
  },
```

`packages/ui/src/pages/SourceHeader.test.tsx` :

```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { Instance, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
      return { pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 };
    },
    subscribeIntegrations: () => () => undefined,
  },
}));
const { SourceHeader } = await import("./SourceHeader");

const binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const project = { meta: { id: "p1" }, bindings: [binding] } as unknown as ProjectSnapshot;
const instance = { id: "i1", config: { source: { bindingId: "b1" } } } as unknown as Instance;

beforeEach(() => {
  calls.length = 0;
});

test("a synced instance shows its repo and syncs on demand", async () => {
  render(<SourceHeader project={project} instance={instance} />);
  expect(screen.getByText("GitHub · adam/kibo")).toBeDefined();
  await userEvent.setup().click(screen.getByRole("button", { name: "Synchroniser" }));
  expect(calls).toContainEqual({ method: "syncBinding", projectId: "p1", bindingId: "b1" });
});

test("a removed binding is stated plainly", () => {
  render(<SourceHeader project={{ ...project, bindings: [] }} instance={instance} />);
  expect(screen.getByText("Liaison supprimée")).toBeDefined();
});

test("a local instance has no header", () => {
  const { container } = render(<SourceHeader project={project} instance={{ ...instance, config: {} }} />);
  expect(container.textContent).toBe("");
});
```

(`as unknown as …` : fixtures réduites aux champs lus.)

`packages/ui/src/pages/SourceHeader.tsx` :

```tsx
import { type Instance, InstanceSource, type ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ListTodo, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useSyncState } from "../state/use-sync-state";

const t = fr.integrations.instance;
const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function SourceHeader({ project, instance }: { project: ProjectSnapshot; instance: Instance }) {
  const source = InstanceSource.safeParse(instance.config.source);
  const binding = source.success ? project.bindings.find((b) => b.id === source.data.bindingId) : undefined;
  const { state } = useSyncState(project.meta.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!source.success) return null;
  if (!binding) {
    return (
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
        <Unlink aria-hidden className="size-4" />
        <span className="font-medium text-foreground">{t.bindingRemoved}</span>
        <span>{t.bindingRemovedHelp}</span>
      </div>
    );
  }
  const b = state?.bindings.find((x) => x.bindingId === binding.id);
  const running = busy || b?.running === true;
  const sync = async () => {
    setBusy(true);
    try {
      await client.rpc({ method: "syncBinding", projectId: project.meta.id, bindingId: binding.id });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-10 items-center gap-2 border-b px-3 text-sm">
      <ListTodo aria-hidden className="size-4" />
      <span className="font-medium">{t.header(binding.config.repo)}</span>
      <span className="text-muted-foreground">{b?.lastPullAt ? t.lastSync(time(b.lastPullAt)) : t.never}</span>
      {(error ?? b?.lastError?.message) && (
        <span role="alert" className="truncate text-destructive">
          {error ?? b?.lastError?.message}
        </span>
      )}
      <Button size="sm" variant="ghost" className="ml-auto" disabled={running} onClick={() => void sync()}>
        <RefreshCw aria-hidden className={`size-3.5 ${running ? "animate-spin" : ""}`} />
        {running ? t.syncing : t.sync}
      </Button>
    </div>
  );
}
```

`packages/ui/src/pages/PageView.tsx` (qui a le `project` ; `InstanceFrame.tsx` n'est pas modifié) : page Vue, `<SourceHeader project={project} instance={first} />` entre `ViewActions` et `InstanceFrame` ; widget, `<SourceHeader project={project} instance={i} />` entre `WidgetHeader` et le conteneur de l'`InstanceFrame`. `openNewTicket` du `SdkContext` (`InstanceFrame.tsx`, `Mounted`) reste `host.openNewTicket` : le SDK complète `instanceId`.

`packages/ui/src/dialogs/NewTicketDialog.tsx` (props réelles : `project`, `viewer`, `defaults`, `onClose`) : la requête devient `{ method: "command", projectId: project.meta.id, command: { … }, ...(defaults.instanceId && { instanceId: defaults.instanceId }) }`. Test ajouté à `dialogs.test.tsx` : `defaults={{ statusId: "todo", instanceId: "i1" }}` ⇒ l'appel enregistré contient `instanceId: "i1"`.

**Toasts et notifications (N25, N29).** Aucun `Toaster` n'est monté aujourd'hui (décision 19 de la phase 4). `sonner` et `next-themes` ne doivent pas entrer dans le chargement initial (budget de 230 kB gzip, décision 29 de la phase 4) : tout passe par un composant différé.

Le démon envoie `title` et `body` déjà en français (N25) : aucun texte de notification côté UI.

`packages/ui/src/shell/IntegrationNotices.tsx` :

```tsx
import type { Session } from "@kibo/schema";
import { Toaster } from "@kibo/sdk/ui/sonner";
import { useEffect } from "react";
import { toast } from "sonner";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useTheme } from "../theme";

export function IntegrationNotices({ notifications }: { notifications: Session["notifications"] }) {
  const theme = useTheme();
  useEffect(
    () =>
      client.subscribeIntegrations((e) => {
        if (e.type === "sync.conflict") toast(fr.integrations.conflict(e.ticketKey, e.field));
        if (e.type !== "notice" || notifications !== "browser") return;
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        const shown = new Notification(e.title, { body: e.body });
        shown.onclick = () => window.focus();
      }),
    [notifications],
  );
  return <Toaster theme={theme} position="bottom-right" />;
}
```

En mode natif (`notifications === "native"`), le démon a déjà notifié par `DaemonOptions.notify` (N25) : l'UI ne double pas la notification. Sans permission accordée, rien (même règle que `agents/use-run-notifications.ts`, bouton `NotifyButton` existant).

`packages/ui/src/shell/lazy-screens.ts` : `export const IntegrationNotices = lazyPanel(() => import("./IntegrationNotices").then((m) => m.IntegrationNotices), fr.lazy, { fallback: "sr-only" });`

`packages/ui/src/shell/Shell.tsx` : dans `Shell` (qui reçoit déjà `notifications` et appelle `useRunNotifications`), rendre une fois `<IntegrationNotices notifications={notifications} />` à côté de `Workspace`. Les faux `client` des tests du shell qui montent `Shell` (`shell/shell.test.tsx`, `shell/agents-shell.test.tsx`, `shell/screens.test.tsx`, `shell/workspace-switcher.test.tsx` selon ceux qui le rendent) gagnent `subscribeIntegrations: () => () => undefined`.

`packages/ui/src/shell/integration-notices.test.tsx` : faux `client.subscribeIntegrations` qui garde l'écouteur ; émettre `{ type: "sync.conflict", projectId: "p1", ticketKey: "KIB-7", field: "title" }` ⇒ `await screen.findByText("Conflit résolu sur KIB-7 : titre repris de GitHub")` ; avec `notifications="browser"`, un `Notification` global factice (permission `"granted"`) reçoit `("CI cassée sur KIB-7", …)` pour `{ type: "notice", title: "CI cassée sur KIB-7", body: "CI a échoué sur la PR #12." }` ; avec `"native"`, il n'est pas appelé.

- [x] **Step 7: Vérifier et commiter**

Run: `bun install && bun test packages/sdk packages/ui components && bun run check && bun run typecheck && bun run --cwd packages/ui build && bun run budget` — Expected: PASS (budget inchangé : `IntegrationNotices` et `sonner` sont hors du chargement initial). Contrôle visuel : Kanban synchronisé (en-tête, chip CI rouge, état « Liaison supprimée ») en sombre puis en clair, contre P11.

```bash
git add packages/sdk/src components/kanban components/tickets packages/ui/src/pages packages/ui/src/dialogs/NewTicketDialog.tsx packages/ui/src/dialogs/dialogs.test.tsx packages/ui/src/shell packages/ui/src/i18n/fr-integrations.ts packages/ui/package.json bun.lock
git commit -m "feat(components): Kanban et Tickets synchronisés"
```

---

### Task 22: Composant « Source MCP » (X1)

Référence : maquette P10 (widget et étape de config), sombre et clair. Composant intégré écrit avec le SDK public : il appelle un outil ou lit une ressource d'un serveur MCP, extrait une liste par pointeurs JSON, et crée un ticket par élément sur demande. Aucune synchronisation automatique.

La config d'instance est **plate et scalaire** (N33) : le `configSchema` de la phase 4 (`packages/schema/src/config.ts`) n'accepte que `string`, `number` et `boolean`, et `validateConfig` (appelé à chaque mise à jour d'instance, `components/update.ts`) refuse toute valeur objet. Les arguments de l'outil sont donc stockés en texte JSON (`args`) et la correspondance en cinq pointeurs (`itemsPointer`, `idPointer`, `titlePointer`, `subtitlePointer`, `urlPointer`) ; `McpSourceConfig` (Zod) relit cette forme plate et rend la forme structurée de la spec F §8.3 (`args` objet, `mapping`).

**Files:**
- Create: `components/mcp-source/{kibo.component.json,package.json,tsconfig.json}`, `components/mcp-source/src/{config.ts,extract.ts,extract.test.ts,McpSource.tsx,SourceItemRow.tsx,mcp-source.test.tsx,fr.ts,index.ts}`
- Create: `packages/ui/src/dialogs/mcp-source/{McpSourceStep.tsx,mcp-source-step.test.tsx}`
- Modify: `package.json` racine (script `typecheck` : `components/mcp-source`), `bun.lock` (lien d'espace de travail, aucune version nouvelle), `packages/schema/src/component.ts` (`BUILTIN_IDS` gagne `"mcp-source"`), `packages/sdk/src/conformance.tsx` (`ConformanceOptions` : `"mcp"` ajouté au `Pick` de `MockSdkOptions`, si la Task 9 ne l'a pas déjà fait), `packages/ui/package.json` (`"@kibo/component-mcp-source": "workspace:*"`), `packages/ui/tsconfig.json` (référence `../../components/mcp-source`), `packages/ui/src/registry.ts` (`BUILTIN_COMPONENTS`, icône `Plug` dans `BUILTIN_ICONS`), `packages/ui/src/dialogs/AddComponentDialog.tsx` (étape de config), `packages/ui/src/i18n/fr-integrations.ts` (bloc `mcpSource`). `CLAUDE.md` est déjà à jour (Task 1).

**Interfaces:**
- Consumes: `sdk.mcp.call`, `sdk.mcp.read`, `sdk.mcp.importItem`, `createMockSdk(manifest, { config, mcp })`, `MockSdk.used.mcp` (Task 9) ; `McpServerId`, `WebUrl`, `McpCallResult`, `McpServerView` (Task 1) ; RPC `listMcpServers` (Task 1, Task 15) ; phase 4 : `useEntities`, `useSdk`, `SdkProvider` (`packages/sdk/src/react.tsx`), `sdk.data`, `runConformance(mod, seed?, opts?)` (`@kibo/sdk/conformance`), `createMockSdk(manifest, opts)` (`@kibo/sdk/mock`), `ComponentManifest`, primitives `@kibo/sdk/ui/{badge,button,skeleton,select,radio-group,textarea,input,label}` ; UI : `client` (`packages/ui/src/api.ts`), `BUILTIN_COMPONENTS`/`BUILTIN_ICONS` (`packages/ui/src/registry.ts`), `builtinChoices` (`dialogs/catalog-choices.ts`), `AddComponentDialog` (source Locale/Synchronisée de la Task 17, réservée à Kanban et Tickets).
- Produces:
  - `McpSourceStoredConfig` = `{ server; mode: "tool" | "resource"; tool?; uri?; args: string (JSON, défaut "{}"); refreshMinutes (5 à 1440, défaut 15); itemsPointer; idPointer; titlePointer; subtitlePointer?; urlPointer? }` (config d'instance, scalaire) ; `McpSourceConfig` (Zod : entrée plate, sortie `{ server; mode; tool?; uri?; args: Record<string, unknown>; refreshMinutes; mapping: { items; id; title; subtitle?; url? } }`, pointeurs JSON RFC 6901)
  - `resolvePointer(doc: unknown, pointer: string): unknown` ; `extractItems(result: McpCallResult, mapping): { items: SourceItem[]; error: ExtractError | null }` ; `type SourceItem = { id: string; title: string; subtitle: string | null; url: string | null }` ; `MAX_ITEMS = 200`
  - `defaultMcpSourceConfig(server: string): McpSourceStoredConfig`, exportés par `components/mcp-source/src/index.ts` avec `McpSourceConfig` (l'UI dépend déjà des composants intégrés : `schema ← sdk ← components ← ui`)
  - `McpSourceStep({ value, onChange })` (écran 3)

- [ ] **Step 1: Paquet**

`components/mcp-source/kibo.component.json` :

```json
{
  "id": "mcp-source",
  "version": "1.0.0",
  "kind": "widget",
  "title": "Source MCP",
  "description": "Liste des éléments d'un serveur MCP, un ticket par élément sur demande",
  "reads": ["ticket"],
  "writes": ["ticket"],
  "data": true,
  "mcp": ["{config.server}"],
  "configSchema": {
    "server": { "type": "string" },
    "mode": { "enum": ["tool", "resource"], "default": "tool" },
    "tool": { "type": "string" },
    "uri": { "type": "string" },
    "args": { "type": "string", "default": "{}" },
    "refreshMinutes": { "type": "number", "default": 15 },
    "itemsPointer": { "type": "string", "default": "/items" },
    "idPointer": { "type": "string", "default": "/id" },
    "titlePointer": { "type": "string", "default": "/name" },
    "subtitlePointer": { "type": "string" },
    "urlPointer": { "type": "string" }
  }
}
```

(Format `ConfigSchema` de la phase 4 : `type` ∈ `string | number | boolean`, `enum`, `nullable`, `default` ; aucune valeur objet, voir N33. `"{config.server}"` n'est accepté que pour un intégré, Tasks 1 et 9.)

`components/mcp-source/package.json` et `tsconfig.json` : calqués sur `components/kanban` (`package.json` : nom `@kibo/component-mcp-source`, `exports: { ".": "./src/index.ts" }`, dépendances `@kibo/schema` et `@kibo/sdk` en `workspace:*`, `lucide-react` 1.48.0, `zod` 3.25.76, `react` 19.1.1 en `peerDependencies`, `devDependencies` identiques à Kanban ; `tsconfig.json` identique à celui de Kanban). Ajouter `components/mcp-source` au script `typecheck` racine, `"@kibo/component-mcp-source": "workspace:*"` aux dépendances de `packages/ui/package.json`, `{ "path": "../../components/mcp-source" }` aux `references` de `packages/ui/tsconfig.json`, puis `bun install` (lien d'espace de travail seulement). `packages/schema/src/component.ts` : `BUILTIN_IDS = ["kanban", "tickets", "graph", "notes", "mcp-source"]` (la porte de la phase 4 traite alors l'instance comme intégrée : pas de contrôle de permission côté démon, le SDK contrôle `mcp` avec la config de l'instance).

- [ ] **Step 2: Tests d'extraction (échouent)**

`components/mcp-source/src/extract.test.ts` :

```ts
import { expect, test } from "bun:test";
import { defaultMcpSourceConfig, McpSourceConfig } from "./config";
import { extractItems, resolvePointer } from "./extract";

const mapping = { items: "/items", id: "/id", title: "/name", subtitle: "/detail", url: "/link" };
const result = (doc: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(doc) }], isError: false, truncated: false });

test("JSON pointers follow RFC 6901", () => {
  const doc = { a: [{ "b/c": 1, "d~e": 2 }], "": 3 };
  expect(resolvePointer(doc, "")).toBe(doc);
  expect(resolvePointer(doc, "/a/0/b~1c")).toBe(1);
  expect(resolvePointer(doc, "/a/0/d~0e")).toBe(2);
  expect(resolvePointer(doc, "/")).toBe(3);
  expect(resolvePointer(doc, "/a/5")).toBeUndefined();
  expect(resolvePointer(doc, "/a/-1")).toBeUndefined();
});

test("items are mapped, unsafe links are dropped", () => {
  const out = extractItems(
    result({
      items: [
        { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
        { id: 2, name: "Second", link: "javascript:alert(1)" },
        { id: "a3", name: "" },
        { name: "Sans id" },
      ],
    }),
    mapping,
  );
  expect(out).toEqual({
    items: [
      { id: "a1", title: "Premier", subtitle: "Élément un", url: "https://example.com/a1" },
      { id: "2", title: "Second", subtitle: null, url: null },
    ],
    error: null,
  });
});

test("non-JSON or non-list results are reported, not thrown", () => {
  expect(extractItems({ content: [{ type: "text", text: "pas du json" }], isError: false, truncated: false }, mapping).error).toBe("not-json");
  expect(extractItems(result({ items: {} }), mapping).error).toBe("not-a-list");
  expect(extractItems({ content: [], isError: false, truncated: false }, mapping).error).toBe("empty");
});

test("config needs a tool in tool mode and a uri in resource mode, refresh at least 5 min", () => {
  const base = { server: "ctx", itemsPointer: "/items", idPointer: "/id", titlePointer: "/name" };
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "list_items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool" }).success).toBe(false);
  expect(McpSourceConfig.safeParse({ ...base, mode: "resource", uri: "fake://items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "x", refreshMinutes: 1 }).success).toBe(false);
});

test("the flat stored config becomes arguments and a mapping", () => {
  const parsed = McpSourceConfig.parse({ ...defaultMcpSourceConfig("ctx"), args: '{"limit":5}' });
  expect(parsed.args).toEqual({ limit: 5 });
  expect(parsed.mapping).toEqual({ items: "/items", id: "/id", title: "/name", subtitle: "/detail", url: "/link" });
  expect(McpSourceConfig.safeParse({ ...defaultMcpSourceConfig("ctx"), args: "[1]" }).success).toBe(false);
  expect(McpSourceConfig.safeParse({ ...defaultMcpSourceConfig("ctx"), args: "{pas du json" }).success).toBe(false);
});
```

Run: `bun test components/mcp-source` — Expected: FAIL.

- [ ] **Step 3: `config.ts` et `extract.ts`**

`components/mcp-source/src/config.ts` :

```ts
import { McpServerId } from "@kibo/schema";
import { z } from "zod";

const JsonPointer = z.string().max(256).regex(/^(\/[^/]*)*$/);
const JsonObject = z.record(z.string(), z.unknown());

const Stored = z
  .object({
    server: McpServerId,
    mode: z.enum(["tool", "resource"]),
    tool: z.string().min(1).max(128).optional(),
    uri: z.string().min(1).max(2048).optional(),
    args: z.string().max(8192).default("{}"),
    refreshMinutes: z.number().int().min(5).max(1440).default(15),
    itemsPointer: JsonPointer,
    idPointer: JsonPointer,
    titlePointer: JsonPointer,
    subtitlePointer: JsonPointer.optional(),
    urlPointer: JsonPointer.optional(),
  })
  .refine((c) => (c.mode === "tool" ? c.tool !== undefined : c.uri !== undefined), "tool or uri required by mode");
export type McpSourceStoredConfig = z.input<typeof Stored>;

export function parseArgs(text: string): Record<string, unknown> | null {
  try {
    const parsed = JsonObject.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const McpSourceConfig = Stored.transform((c, ctx) => {
  const args = parseArgs(c.args);
  if (args === null) {
    ctx.addIssue({ code: "custom", path: ["args"], message: "args must be a JSON object" });
    return z.NEVER;
  }
  return {
    server: c.server,
    mode: c.mode,
    tool: c.tool,
    uri: c.uri,
    args,
    refreshMinutes: c.refreshMinutes,
    mapping: {
      items: c.itemsPointer,
      id: c.idPointer,
      title: c.titlePointer,
      subtitle: c.subtitlePointer,
      url: c.urlPointer,
    },
  };
});
export type McpSourceConfig = z.output<typeof McpSourceConfig>;

export function defaultMcpSourceConfig(server: string): McpSourceStoredConfig {
  return {
    server,
    mode: "tool",
    tool: "list_items",
    args: "{}",
    refreshMinutes: 15,
    itemsPointer: "/items",
    idPointer: "/id",
    titlePointer: "/name",
    subtitlePointer: "/detail",
    urlPointer: "/link",
  };
}
```

`parseArgs` : un texte qui n'est pas un objet JSON n'est pas une exception mais une config invalide (état affiché : « Configure la source… » dans le widget, « Arguments : JSON invalide. » à l'écran 3) ; rien n'est avalé.

`components/mcp-source/src/extract.ts` :

```ts
import { type McpCallResult, WebUrl } from "@kibo/schema";
import type { McpSourceConfig } from "./config";

export const MAX_ITEMS = 200;
export type SourceItem = { id: string; title: string; subtitle: string | null; url: string | null };
export type ExtractError = "empty" | "not-json" | "not-a-list";

const unescape = (token: string) => token.replaceAll("~1", "/").replaceAll("~0", "~");

export function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  let cur: unknown = doc;
  for (const token of pointer.slice(1).split("/").map(unescape)) {
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
      cur = cur[Number(token)];
    } else if (typeof cur === "object" && cur !== null && Object.hasOwn(cur, token)) {
      cur = (cur as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return cur;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null);

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export function extractItems(result: McpCallResult, mapping: McpSourceConfig["mapping"]): { items: SourceItem[]; error: ExtractError | null } {
  const raw = result.content.find((c) => c.type === "text");
  if (!raw || raw.type !== "text") return { items: [], error: "empty" };
  const doc = parseJson(raw.text);
  if (!doc.ok) return { items: [], error: "not-json" };
  const list = resolvePointer(doc.value, mapping.items);
  if (!Array.isArray(list)) return { items: [], error: "not-a-list" };
  const items = list.slice(0, MAX_ITEMS).flatMap((entry): SourceItem[] => {
    const id = text(resolvePointer(entry, mapping.id));
    const title = text(resolvePointer(entry, mapping.title));
    if (id === null || title === null) return [];
    const url = WebUrl.safeParse(mapping.url ? resolvePointer(entry, mapping.url) : undefined);
    return [
      {
        id: id.slice(0, 256),
        title: title.slice(0, 500),
        subtitle: mapping.subtitle ? text(resolvePointer(entry, mapping.subtitle)) : null,
        url: url.success ? url.data : null,
      },
    ];
  });
  return { items, error: null };
}
```

- `cur as Record<string, unknown>` : garde `typeof cur === "object" && cur !== null` juste avant ; `Object.hasOwn` écarte `__proto__` et le prototype.
- `parseJson` : un texte non JSON n'est pas une exception mais un état affiché (`not-json` ⇒ message du widget) ; rien n'est avalé.

Run: `bun test components/mcp-source/src/extract.test.ts` — Expected: PASS.

- [ ] **Step 4: Test du widget (échoue)**

`components/mcp-source/src/mcp-source.test.tsx` :

```tsx
import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultMcpSourceConfig } from "./config";
import { Component, manifest } from "./index";

const items = {
  items: [
    { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
    { id: "a2", name: "Second", detail: "Élément deux", link: "javascript:alert(1)" },
  ],
};
const mcp = { "ctx/list_items": { content: [{ type: "text" as const, text: JSON.stringify(items) }], isError: false, truncated: false } };
const config = defaultMcpSourceConfig("ctx");
const seed = (_run: (cmd: ProjectCommand) => unknown) => undefined;

runConformance({ manifest, Component }, seed, { config, mcp });

const setup = (opts: Partial<Parameters<typeof createMockSdk>[1]> = {}) => {
  const m = createMockSdk(manifest, { config, mcp, ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("lists the items and creates a ticket once per item", async () => {
  const m = setup();
  expect(await screen.findByText("Premier")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Premier" }).getAttribute("href")).toBe("https://example.com/a1");
  expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "Créer un ticket" })[0] as HTMLElement);
  expect(await screen.findByText("KIB-1")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Créer un ticket" })).toHaveLength(1);
  expect(m.used.mcp).toEqual(expect.arrayContaining(["ctx/list_items", "ctx"]));
});

test("an unreachable server is stated, not thrown", async () => {
  setup({ mcp: {} });
  expect(await screen.findByRole("alert")).toBeTruthy();
});

test("a missing configuration asks to configure", async () => {
  setup({ config: {} });
  expect(await screen.findByText("Configure la source dans les réglages du composant.")).toBeTruthy();
});
```

(`runConformance(mod, seed, { config, mcp })` : `ConformanceOptions` (`packages/sdk/src/conformance.tsx`) est un `Pick` de `MockSdkOptions` (`"fetch" | "server" | "notes" | "config" | "noteAges"`) ; y ajouter `"mcp"` (option créée par la Task 9) si la Task 9 ne l'a pas fait, la suite transmettant déjà ses options à `createMockSdk`.)

Run: `bun test components/mcp-source` — Expected: FAIL.

- [ ] **Step 5: Widget**

`components/mcp-source/src/fr.ts` :

```ts
export const fr = {
  create: "Créer un ticket",
  refresh: "Rafraîchir",
  updated: (ago: string) => `Mis à jour ${ago}`,
  never: "Jamais mis à jour",
  empty: "Aucun élément.",
  loading: "Chargement…",
  unconfigured: "Configure la source dans les réglages du composant.",
  unreachable: "Serveur MCP injoignable",
  toolError: "L'outil a renvoyé une erreur :",
  extract: { empty: "Réponse vide.", "not-json": "La réponse n'est pas du JSON.", "not-a-list": "Le pointeur « éléments » ne désigne pas une liste." },
  truncated: "Réponse tronquée à 1 Mio.",
  ago: (minutes: number) => (minutes < 1 ? "à l'instant" : `il y a ${minutes} min`),
};
```

`components/mcp-source/src/SourceItemRow.tsx` :

```tsx
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import type { SourceItem } from "./extract";
import { fr } from "./fr";

type Props = { item: SourceItem; ticketKey: string | null; busy: boolean; onCreate(): void; onOpen(): void };

export function SourceItemRow({ item, ticketKey, busy, onCreate, onOpen }: Props) {
  return (
    <li className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
      <div className="grid min-w-0 flex-1 gap-0.5">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer noopener" className="truncate font-medium hover:underline">
            {item.title}
          </a>
        ) : (
          <span className="truncate font-medium">{item.title}</span>
        )}
        {item.subtitle && <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>}
      </div>
      {ticketKey ? (
        <button type="button" onClick={onOpen}>
          <Badge variant="outline" className="font-mono">
            {ticketKey}
          </Badge>
        </button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={onCreate}>
          {fr.create}
        </Button>
      )}
    </li>
  );
}
```

`components/mcp-source/src/McpSource.tsx` :

```tsx
import { KiboError, type McpCallResult } from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { McpSourceConfig } from "./config";
import { type ExtractError, extractItems, type SourceItem } from "./extract";
import { fr } from "./fr";
import { SourceItemRow } from "./SourceItemRow";

type Loaded = { items: SourceItem[]; fetchedAt: number; truncated: boolean };
type Problem = { kind: "unreachable" } | { kind: "tool"; message: string } | { kind: "extract"; error: ExtractError } | { kind: "other"; message: string };

const textOf = (r: McpCallResult) => r.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");

function problemMessage(p: Problem | null): string | null {
  if (p === null) return null;
  if (p.kind === "unreachable") return fr.unreachable;
  if (p.kind === "tool") return `${fr.toolError} ${p.message}`;
  if (p.kind === "extract") return fr.extract[p.error];
  return p.message;
}

export function McpSource() {
  const sdk = useSdk();
  const config = useMemo(() => McpSourceConfig.safeParse(sdk.config), [sdk.config]);
  const { data: tickets } = useEntities("ticket");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!config.success) return;
    const c = config.data;
    try {
      const result = c.mode === "tool" ? await sdk.mcp.call(c.server, c.tool ?? "", c.args) : await sdk.mcp.read(c.server, c.uri ?? "");
      if (result.isError) return setProblem({ kind: "tool", message: textOf(result).slice(0, 300) });
      const out = extractItems(result, c.mapping);
      if (out.error) return setProblem({ kind: "extract", error: out.error });
      const next = { items: out.items, fetchedAt: Date.now(), truncated: result.truncated };
      setLoaded(next);
      setProblem(null);
      await sdk.data.set("last", next);
    } catch (e) {
      setProblem(e instanceof KiboError && e.code === "MCP_UNAVAILABLE" ? { kind: "unreachable" } : { kind: "other", message: e instanceof Error ? e.message : String(e) });
    }
  }, [sdk, config.success, config.data]);

  useEffect(() => {
    if (!config.success) return;
    let live = true;
    sdk.data
      .get<Loaded>("last")
      .then((cached) => live && cached && setLoaded(cached))
      .catch((e: unknown) => setProblem({ kind: "other", message: e instanceof Error ? e.message : String(e) }));
    void load();
    const refresh = setInterval(() => void load(), config.data.refreshMinutes * 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      live = false;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [sdk, load, config.success, config.data?.refreshMinutes]);

  if (!config.success) return <p className="p-4 text-sm text-muted-foreground">{fr.unconfigured}</p>;
  const server = config.data.server;
  const keyOf = (id: string) =>
    tickets.find((t) => t.externalRefs.some((r) => r.kind === "mcp_item" && r.server === server && r.itemId === id))?.key ?? null;
  const create = async (item: SourceItem) => {
    setBusy(item.id);
    try {
      await sdk.mcp.importItem(server, { itemId: item.id, title: item.title, url: item.url });
    } catch (e) {
      setProblem({ kind: "other", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const openKey = (key: string) => {
    const t = tickets.find((x) => x.key === key);
    if (t) sdk.openTicket(t.id);
  };
  const message = problemMessage(problem);

  return (
    <div className="flex h-full flex-col">
      {message && (
        <p role="alert" className="border-b px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}
      {!loaded && !problem && (
        <div className="grid gap-2 p-3" aria-label={fr.loading}>
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
        </div>
      )}
      {loaded && loaded.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{fr.empty}</p>}
      {loaded && (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loaded.items.map((item) => {
            const key = keyOf(item.id);
            return (
              <SourceItemRow
                key={item.id}
                item={item}
                ticketKey={key}
                busy={busy === item.id}
                onCreate={() => void create(item)}
                onOpen={() => key && openKey(key)}
              />
            );
          })}
        </ul>
      )}
      <footer className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>{loaded ? fr.updated(fr.ago(Math.floor((now - loaded.fetchedAt) / 60_000))) : fr.never}</span>
        {loaded?.truncated && <span>· {fr.truncated}</span>}
        <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => void load()}>
          <RefreshCw aria-hidden className="size-3" />
          {fr.refresh}
        </Button>
      </footer>
    </div>
  );
}
```

Précisions :
- `config` est mémoïsé sur `sdk.config` : `load` et l'effet de rafraîchissement restent stables d'un rendu à l'autre.
- Les dates `fetchedAt` viennent de l'horloge locale (affichage seulement).
- Le MCP renvoyé par le serveur (texte, liens) est rendu comme texte React ; un lien n'est rendu que s'il a passé `WebUrl` (Review Focus 3).

`components/mcp-source/src/index.ts` (même forme que `components/kanban/src/index.ts`, plus les aides de config utilisées par l'écran 3) :

```ts
import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";
import { McpSource } from "./McpSource";

export const manifest = ComponentManifest.parse(manifestJson);
export const Component = McpSource;
export { defaultMcpSourceConfig, McpSourceConfig, type McpSourceStoredConfig, parseArgs } from "./config";
```

- [ ] **Step 6: Étape de config à l'écran 3**

`packages/ui/src/dialogs/mcp-source/mcp-source-step.test.tsx` :

```tsx
import { expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) =>
      req.method === "listMcpServers"
        ? [{ transport: "stdio", id: "ctx", name: "Context7", command: "npx", args: [], envNames: [], enabled: true, state: "connected", error: null, tools: [{ name: "list_items", description: null, inputSchema: {} }], secretsSet: [] }]
        : null,
  },
}));
const { McpSourceStep } = await import("./McpSourceStep");

test("server and tool come from the configured MCP servers; bad JSON args are refused", async () => {
  const onChange = mock((_: unknown) => {});
  render(<McpSourceStep value={null} onChange={onChange} />);
  expect(await screen.findByText("Context7 (ctx)")).toBeDefined();
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ server: "ctx", mode: "tool", tool: "list_items" }));
  const user = userEvent.setup();
  const args = screen.getByLabelText("Arguments (JSON)");
  await user.clear(args);
  await user.type(args, "{{pas du json");
  expect(screen.getByText("Arguments : JSON invalide.")).toBeDefined();
  expect(onChange).toHaveBeenLastCalledWith(null);
});
```

`packages/ui/src/i18n/fr-integrations.ts`, ajouter :

```ts
  mcpSource: {
    title: "Source",
    server: "Serveur MCP",
    noServer: "Aucun serveur MCP configuré : ajoute-en un dans Paramètres › Intégrations.",
    mode: "Mode",
    tool: "Outil",
    resource: "Ressource",
    uri: "URI de la ressource",
    args: "Arguments (JSON)",
    argsInvalid: "Arguments : JSON invalide.",
    mapping: "Correspondance des champs",
    items: "Éléments",
    id: "Identifiant",
    itemTitle: "Titre",
    subtitle: "Sous-titre",
    url: "Lien",
    pointerHelp: "Pointeurs JSON, par exemple /items et /name.",
    refresh: "Rafraîchissement (minutes, 5 minimum)",
    serverLabel: (name: string, id: string) => `${name} (${id})`,
  },
```

`packages/ui/src/dialogs/mcp-source/McpSourceStep.tsx` : formulaire contrôlé (P10, étape de config) :
- charge `listMcpServers` (serveurs `enabled` seulement), `Select` « Serveur MCP » avec `serverLabel(name, id)`, premier serveur choisi par défaut ; aucun serveur ⇒ texte `noServer` et `onChange(null)` ;
- `RadioGroup` « Mode » (Outil / Ressource) ; mode outil : `Select` « Outil » alimenté par `tools` du serveur ; mode ressource : `Input` « URI de la ressource » ;
- `Textarea` « Arguments (JSON) » (défaut `{}`) : validé par `parseArgs` importé de `@kibo/component-mcp-source` (objet seulement) ; invalide ⇒ `argsInvalid` et `onChange(null)` ;
- cinq `Input` de pointeurs, préremplis par `defaultMcpSourceConfig(server)` importé de `@kibo/component-mcp-source`, aide `pointerHelp` ;
- `Input type="number"` « Rafraîchissement » (min 5, défaut 15) ;
- à chaque changement, `McpSourceConfig.safeParse(stored)` : valide ⇒ `onChange(stored)` (config plate `McpSourceStoredConfig`, telle qu'elle sera écrite dans l'instance), sinon `onChange(null)` ; chaque couple label / champ par `useId()`. Primitives : `Select`, `RadioGroup`, `Textarea`, `Input`, `Label` de `@kibo/sdk/ui/*`.

`packages/ui/src/registry.ts` : `import * as mcpSource from "@kibo/component-mcp-source";`, ajouter `mcpSource` à `BUILTIN_COMPONENTS` (le catalogue `builtinChoices` le liste alors dans « Intégrés ») et `"mcp-source": Plug` à `BUILTIN_ICONS`. `AddComponentDialog.tsx` : état `mcpConfig: McpSourceStoredConfig | null` ; si le composant choisi a l'id `mcp-source`, afficher `<McpSourceStep value={mcpConfig} onChange={setMcpConfig} />` dans `Details`, désactiver « Ajouter à la page » tant que `mcpConfig === null`, et ajouter `config: mcpConfig` à la commande `addInstance` (champ `config` déjà accepté par `ProjectCommand`). Le bloc « Source » Locale / Synchronisée (Task 17) ne s'affiche pas pour `mcp-source`, bien qu'il lise `ticket` (spec F §9 : Kanban et Tickets seulement). Un widget ne s'ajoute qu'à une page tableau de bord (`kind: "widget"`, comportement de la phase 4). L'écran 30 n'est pas montré pour un intégré ; la ligne « Appeler le serveur MCP choisi à l'ajout » (`fr.integrations.permissions.mcpFromConfig`, Task 9) sert au catalogue et à la page Composants. Budget du chargement initial (`bun run budget`, 230 kB gzip, décision 29 de la phase 4) : `registry.ts` importe les intégrés statiquement ; le widget est petit (zod est déjà dans l'entrée) et le budget est vérifié à l'étape 7.

- [ ] **Step 7: Vérifier et commiter**

Run: `bun test components packages/ui packages/sdk && bun run check && bun run typecheck && bun run --cwd packages/ui build && bun run budget` — Expected: PASS. Contrôle visuel : widget (liste, vide, erreur, chargement) et étape de config, en sombre puis en clair, contre P10.

```bash
git add components/mcp-source package.json bun.lock packages/schema/src/component.ts packages/sdk/src/conformance.tsx packages/ui/package.json packages/ui/tsconfig.json packages/ui/src/dialogs/mcp-source packages/ui/src/dialogs/AddComponentDialog.tsx packages/ui/src/registry.ts packages/ui/src/i18n/fr-integrations.ts
git commit -m "feat(components): Source MCP"
```

---

### Task 23: Test de fuite de secret et parcours E2E

Critères de sortie de la spec F (§10, §12) : zéro occurrence d'un secret partout où il pourrait fuir, et parcours Playwright de l'écran 16 et d'un Kanban synchronisé, en sombre et en clair, contre le faux GitHub et le faux MCP.

**Files:**
- Create: `packages/daemon/src/integrations/leak.test.ts`
- Create: `e2e/integrations.spec.ts`
- Modify: `e2e/serve.ts`, `e2e/token.ts`, `e2e/playwright.config.ts` (deux démons `integrations-dark` / `integrations-light`), `packages/daemon/src/testing/fake-github.ts` (option `port`), `packages/daemon/src/testing/fake-mcp.ts` (option `port`)

**Interfaces:**
- Consumes: tout ce qui précède ; `startDaemon`, `DaemonOptions` (`packages/daemon/src/daemon.ts`, décision 23 de la phase 4) avec `integrations: IntegrationFlags` et le caviardeur partagé (Task 2, N26) ; `installConsoleRedaction`, `createRedactor`, `parseIntegrationFlags` (Task 2) ; `DEV_TOOLCHAIN` (`@kibo/devkit/test-kit`) ; `ECHO_AUTH`, `LOGS_HOST` (Task 6) ; `startFakeMcpHttp`, `FAKE_MCP_STDIO` (Task 7) ; aides E2E réelles `pairAndCreateProject`, `createPage` (`e2e/helpers.ts`), `E2E_TOKEN` (`e2e/token.ts`).
- Produces: `startFakeGithub(opts?: { login?; token?; port?: number })`, `startFakeMcpHttp(opts?: { bearer?; omit?; port?: number })` ; dans `e2e/token.ts` : `E2E_GH_TOKEN`, `fakeGithubPort(daemonPort: number): number` (= port du démon + 100), `fakeMcpPort(daemonPort: number): number` (= + 200).

Réalité E2E : `e2e/playwright.config.ts` lance **un démon par spec et par thème** (`bun serve.ts <port> <scénario> [brouillons]`, ports 4390 à 4401), et `serve.ts` pose déjà `KIBO_GH` sur le faux binaire `gh` de la phase 3 (`packages/daemon/src/code/testing/fake-gh.ts`, requis par `code.spec.ts`). Des ports fixes 4391/4392 pour les faux serveurs entreraient en collision avec les démons `light` et `agents-dark` : les faux serveurs prennent le port du démon + 100 / + 200, et ne sont lancés que pour les deux démons de cette spec. `KIBO_GH` n'est pas remplacé : le parcours choisit explicitement « Jeton personnel ».

- [ ] **Step 1: Ports des faux serveurs**

`fake-github.ts` : `Bun.serve({ port: opts.port ?? 0, hostname: "127.0.0.1", … })`. `fake-mcp.ts` : `http.listen(opts.port ?? 0, "127.0.0.1", …)`. Aucun autre changement.

- [ ] **Step 2: Test de fuite (échoue tant qu'une fuite existe)**

Le test lance le vrai démon par `startDaemon` (comme `packages/daemon/src/daemon.test.ts`) : c'est là que l'hôte et les modules d'intégration sont assemblés (N26). Pas de `build` factice : l'adaptateur GitHub Issues est construit depuis `components/github-issues` avec la toolchain de dev (N7, Task 19).

`packages/daemon/src/integrations/leak.test.ts` :

```ts
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { type Daemon, startDaemon } from "../daemon";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "../testing/fake-mcp";
import { parseIntegrationFlags } from "./bootstrap";
import { createRedactor, installConsoleRedaction } from "./redact";

const SECRET = "ghp_TESTSECRET0123456789abcdefghijklmn";
const MCP_ENV = "mcp-env-secret-0123456789";
const MCP_BEARER = "mcp-bearer-secret-0123456789";
const SECRETS = [SECRET, MCP_ENV, MCP_BEARER];
const METHODS = ["log", "info", "warn", "error", "debug"] as const;

let gh: FakeGithub;
let mcpHttp: Awaited<ReturnType<typeof startFakeMcpHttp>>;
let home: string;
let daemon: Daemon;
let stopped = false;
let cookie = "";
const logs: string[] = [];
const responses: string[] = [];
const originals = METHODS.map((m) => console[m]);
let uninstall: () => void = () => undefined;

async function rpc(body: unknown): Promise<unknown> {
  const res = await fetch(`${daemon.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url, cookie },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  responses.push(text);
  return JSON.parse(text);
}
const result = <T>(r: unknown): T => (r as { result: T }).result;

beforeAll(async () => {
  gh = startFakeGithub({ token: SECRET });
  gh.addRepo("adam/kibo").pulls.set(12, { headSha: "abc123", headRef: "kib-1" });
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "kib-1",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [{ id: 70, name: "build", status: "completed", conclusion: "failure", startedAt: null, completedAt: null, log: "##[error]boom\n" }],
  });
  mcpHttp = await startFakeMcpHttp({ bearer: MCP_BEARER });
  for (const m of METHODS) console[m] = (...args: unknown[]) => void logs.push(args.map(String).join(" "));
  const redactor = createRedactor();
  uninstall = installConsoleRedaction(redactor);
  home = mkdtempSync(join(tmpdir(), "kibo-leak-"));
  daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    redactor,
    integrations: parseIntegrationFlags({
      "test-origins": `api.github.com=${gh.url},${LOGS_HOST}=${gh.url}`,
      "memory-secrets": true,
    }),
  });
  const pair = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  cookie = (pair.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
});

afterAll(async () => {
  if (!stopped) await daemon.stop();
  uninstall();
  METHODS.forEach((m, i) => {
    const original = originals[i];
    if (original) console[m] = original;
  });
  gh.stop();
  await mcpHttp.stop();
  rmSync(home, { recursive: true, force: true });
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("after a full scenario, no secret appears anywhere", async () => {
  await rpc({ method: "connectGithub", auth: { mode: "token", token: SECRET } });
  const project = result<{ id: string }>(await rpc({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#71717A" }));
  const binding = result<{ id: string }>(
    await rpc({ method: "createBinding", projectId: project.id, config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] } }),
  );
  const page = result<{ id: string }>(await rpc({ method: "command", projectId: project.id, command: { method: "addPage", title: "K", kind: "view" } }));
  const instance = result<{ id: string }>(
    await rpc({
      method: "command",
      projectId: project.id,
      command: { method: "addInstance", pageId: page.id, component: "kanban@1.0.0", config: { source: { bindingId: binding.id } } },
    }),
  );
  gh.addIssue("adam/kibo", { title: "Depuis GitHub" });
  await rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
  const created = result<{ id: string }>(
    await rpc({ method: "command", projectId: project.id, instanceId: instance.id, command: { method: "createTicket", title: "Depuis Kibo" } }),
  );
  await rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });

  gh.failNext("GET", /^\/repos\/adam\/kibo\/issues/, 500, ECHO_AUTH);
  gh.failNext("GET", /^\/user$/, 401, ECHO_AUTH);
  await rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
  await rpc({ method: "testIntegration", id: "github" });

  await rpc({
    method: "command",
    projectId: project.id,
    command: { method: "upsertExternalRef", ticketId: created.id, ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" } },
  });
  await rpc({ method: "listCiRuns", projectId: project.id, ticketId: null });
  await rpc({ method: "getCiLog", projectId: project.id, runId: 900, jobId: 70 });

  const stdio = { transport: "stdio", id: "fake", name: "Fake", command: process.execPath, args: [FAKE_MCP_STDIO], envNames: ["FAKE_TOKEN"] };
  const line = result<{ commandLine: string }>(await rpc({ method: "previewMcpServer", server: stdio }));
  await rpc({ method: "addMcpServer", server: stdio, confirmedCommandLine: line.commandLine, secrets: { FAKE_TOKEN: MCP_ENV } });
  const http = { transport: "http", id: "remote", name: "Remote", url: mcpHttp.url, bearer: true };
  await rpc({ method: "addMcpServer", server: http, confirmedCommandLine: mcpHttp.url, secrets: { bearer: MCP_BEARER } });
  await rpc({ method: "testMcpServer", id: "remote" });
  await rpc({ method: "listMcpServers" });
  await rpc({ method: "listIntegrations" });
  await rpc({ method: "getSyncState", projectId: project.id });
  const snapshot = await rpc({ method: "getProject", projectId: project.id });

  expect(responses.some((r) => r.includes("***"))).toBe(true);
  expect(JSON.stringify(snapshot)).toContain("Depuis Kibo");

  await daemon.stop();
  stopped = true;
  const db = new Database(join(home, "kibo.db"), { readonly: true });
  const events = JSON.stringify(db.query("SELECT * FROM integration_events").all());
  db.close();
  const places: [string, string][] = [
    ["rpc responses", responses.join("\n")],
    ["console", logs.join("\n")],
    ["integration_events", events],
    ["loro snapshot", JSON.stringify(snapshot)],
    ...filesUnder(home).map((f): [string, string] => [f, readFileSync(f).toString("latin1")]),
  ];
  for (const [where, content] of places) {
    for (const secret of SECRETS) {
      if (content.includes(secret)) throw new Error(`secret leaked in ${where}`);
    }
  }
});
```

- `redactor` et `integrations` sont les deux options que la Task 2 ajoute à `DaemonOptions` (N26) : `main.ts` fait exactement la même chose avec `--test-origins` et `--memory-secrets`. Si la Task 2 a nommé autrement l'option du caviardeur, utiliser son nom (même rôle : un seul `Redactor` partagé par la console, le serveur et les intégrations).
- `result<T>(r)` : `as { result: T }` sur une réponse du contrat RPC (`{ ok, result }` ou `{ ok, error }`) ; les formes sont celles de `RpcResult`.
- `filesUnder(home)` couvre `kibo.db`, `kibo.db-wal`, `kibo.db-shm`, `runs.db`, `token`, le cache des logs CI, les dossiers `mcp/<id>` et tout fichier écrit par le démon ; `latin1` lit les octets tels quels (un secret ASCII y apparaît à l'identique). La base est relue en lecture seule **après** `daemon.stop()` (le démon ferme `kibo.db` à l'arrêt).
- Le contrôle positif (`***` dans une réponse) prouve que l'écho de l'en-tête `Authorization` a bien eu lieu et a été caviardé.
- Si le snapshot Loro est stocké compressé, la recherche dans `kibo.db` ne suffit pas : c'est pourquoi `getProject` (état complet du doc) est aussi fouillé.

Run: `bun test packages/daemon/src/integrations/leak.test.ts`
Expected: PASS. Un échec nomme l'endroit (`secret leaked in …`) : corriger à la source (caviardage à l'écriture, `scrubSecret`, jamais en retirant l'étape du test).

- [ ] **Step 3: Démons E2E avec faux GitHub et faux MCP**

`e2e/token.ts`, ajouter :

```ts
export const E2E_GH_TOKEN = "ghp_E2ETOKEN0123456789abcdefghijklmnopq";
export const fakeGithubPort = (daemonPort: number): number => daemonPort + 100;
export const fakeMcpPort = (daemonPort: number): number => daemonPort + 200;
```

`e2e/playwright.config.ts` : deux entrées de plus dans `daemons`, `{ name: "integrations-dark", scheme: "dark", port: 4402, spec: /integrations\.spec\.ts/, scenario: "question", integrations: true }` et `{ name: "integrations-light", scheme: "light", port: 4403, … }` ; la commande du `webServer` ajoute l'argument `--integrations` quand `"integrations" in d` (placé avant les brouillons, lus comme les autres arguments positionnels).

`e2e/serve.ts` : lire `--integrations` dans `process.argv` (le retirer avant de lire `[port, scenario, ...drafts]`) ; s'il est présent, avant le `Bun.spawn` :

```ts
import { LOGS_HOST, startFakeGithub } from "../packages/daemon/src/testing/fake-github";
import { startFakeMcpHttp } from "../packages/daemon/src/testing/fake-mcp";
import { E2E_GH_TOKEN, E2E_TOKEN, fakeGithubPort, fakeMcpPort } from "./token";

const gh = startFakeGithub({ token: E2E_GH_TOKEN, port: fakeGithubPort(Number(port)) });
gh.addRepo("adam/kibo");
const mcp = await startFakeMcpHttp({ port: fakeMcpPort(Number(port)) });
```

les arguments du démon gagnent alors `"--test-origins", \`api.github.com=${gh.url},${LOGS_HOST}=${gh.url}\`, "--memory-secrets"` (lus par `main.ts`, N26) ; après `await proc.exited` : `gh.stop(); await mcp.stop();`. Les autres démons E2E sont inchangés (aucune origine de test, trousseau système non sollicité). `KIBO_GH` reste le faux `gh` de la phase 3.

- [ ] **Step 4: Parcours Playwright**

`e2e/integrations.spec.ts` :

```ts
import { expect, type Page, test } from "@playwright/test";
import { createPage, pairAndCreateProject } from "./helpers";
import { E2E_GH_TOKEN, fakeGithubPort } from "./token";

const auth = { authorization: `Bearer ${E2E_GH_TOKEN}`, "content-type": "application/json" };
const githubOf = (baseURL: string | undefined) => `http://127.0.0.1:${fakeGithubPort(Number(new URL(baseURL ?? "").port))}`;

async function ghIssues(gh: string): Promise<{ number: number; title: string }[]> {
  const res = await fetch(`${gh}/repos/adam/kibo/issues?state=all&per_page=100`, { headers: auth });
  return (await res.json()) as { number: number; title: string }[];
}
async function ghCreate(gh: string, title: string): Promise<number> {
  const res = await fetch(`${gh}/repos/adam/kibo/issues`, { method: "POST", headers: auth, body: JSON.stringify({ title }) });
  return ((await res.json()) as { number: number }).number;
}
async function ghRename(gh: string, n: number, title: string): Promise<void> {
  await fetch(`${gh}/repos/adam/kibo/issues/${n}`, { method: "PATCH", headers: auth, body: JSON.stringify({ title }) });
}

async function openIntegrations(page: Page) {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page.getByRole("navigation", { name: "Paramètres" }).getByRole("button", { name: "Intégrations" }).click();
  await expect(page.getByRole("heading", { name: "Intégrations" })).toBeVisible();
}

test("écran 16, connexion GitHub, Kanban synchronisé aller-retour", async ({ page, baseURL }, info) => {
  const gh = githubOf(baseURL);
  const leaked: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      const body = await res.text().catch((e: unknown) => `unreadable: ${String(e)}`);
      if (body.includes(E2E_GH_TOKEN)) leaked.push(res.url());
    }
  });
  const key = info.project.name.endsWith("dark") ? "SYD" : "SYL";
  await pairAndCreateProject(page, info, key);
  await openIntegrations(page);
  const row = (title: string) => page.getByRole("main").getByRole("listitem").filter({ hasText: title });
  await expect(row("Git local").getByText("Actif")).toBeVisible();
  await expect(row("Figma (MCP)").getByRole("button", { name: "Connecter" })).toBeVisible();

  const github = row("PR, reviews, statuts CI");
  await github.getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter GitHub" });
  await dialog.getByRole("radio", { name: "Jeton personnel" }).click();
  await dialog.getByLabel("Jeton").fill(E2E_GH_TOKEN);
  await dialog.getByRole("button", { name: "Connecter" }).click();
  await expect(page.getByText("Connecté en tant que adam")).toBeVisible();
  await expect(github.getByText("compte adam")).toBeVisible();

  const imported = "Issue e2e";
  const n = await ghCreate(gh, imported);

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await createPage(page, "Kanban GitHub", "Vue");
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await page.getByRole("radio", { name: "Synchronisée · GitHub Issues" }).click();
  await page.getByRole("radio", { name: "adam/kibo" }).click();
  await page.getByRole("button", { name: "Ajouter et synchroniser" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(page.getByText("GitHub · adam/kibo")).toBeVisible();
  await expect(page.getByText(imported)).toBeVisible();

  const local = "Ticket e2e";
  await page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }).click();
  await page.getByLabel("Titre").fill(local);
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByText(local)).toBeVisible();
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect.poll(async () => (await ghIssues(gh)).some((i) => i.title === local)).toBe(true);

  const renamed = "Renommée e2e";
  await ghRename(gh, n, renamed);
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  await page.getByText(renamed).click();
  await expect(page.getByRole("link", { name: `#${n}` })).toBeVisible();

  expect(leaked).toEqual([]);
});
```

- Libellés : ceux de `fr-integrations.ts` (Task 1), du Kanban (`components/kanban/src/fr.ts` : « Nouveau ticket dans À faire ») et de l'UI (`fr.newTicket` : « Titre », « Créer le ticket »). « Paramètres » est un bouton de la barre latérale (`AppSidebar.tsx`, il ouvre l'écran `domains`) ; « Intégrations » est un bouton de `SettingsNav` (Task 10, N30).
- `pairAndCreateProject` vérifie aussi le thème (`dark`/`light`) : chaque thème a son propre démon et son propre faux GitHub, les deux exécutions ne partagent rien.
- Le faux `gh` de la phase 3 répond « connecté » à `gh auth status` : le dialogue peut proposer « Utiliser gh » ; le parcours choisit explicitement « Jeton personnel ».
- La lecture d'un corps de réponse qui échoue est enregistrée comme texte (`unreadable: …`), jamais ignorée.

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: PASS en `integrations-dark` et `integrations-light` (et toutes les autres specs toujours vertes).

- [ ] **Step 5: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck && bun run --cwd e2e test` — Expected: PASS. La CI GitHub étant hors service, cette liste est le contrôle local d'intégration ; `.github/workflows/ci.yml` n'est pas modifié (il lance déjà `bun run --cwd e2e test`, la tâche 34 de la phase 4 le réécrit).

```bash
git add packages/daemon/src/integrations/leak.test.ts packages/daemon/src/testing/fake-github.ts packages/daemon/src/testing/fake-mcp.ts e2e/serve.ts e2e/token.ts e2e/playwright.config.ts e2e/integrations.spec.ts
git commit -m "test: fuite de secret et parcours E2E"
```

---

## Jalon v0.5

Aucun code. Le chef d'équipe, quand la Task 23 est intégrée :

- [ ] **Conformité** : CI verte sur `main` en macOS **et** Linux (`bun run check`, `bun run typecheck`, `bun test packages components`, `bun run budget`, E2E `dark` et `light`, smoke test Tauri avec `builtin/github-issues/server.js` présent). CI GitHub hors service : même liste en contrôle local avant chaque intégration et au jalon (workflows maintenus à jour).
- [ ] **Critères de sortie de la spec F §12** : aller-retour ticket ↔ issue (création, titre, description, statut, fermeture) vert en CI (`roundtrip.test.ts`, `integrations.spec.ts`) ; test de fuite vert (`leak.test.ts`) ; écran 16 conforme en sombre et en clair (page PDF 26 + état P1) ; dialogues conformes à P2 à P5.
- [ ] **Contrôle visuel** des écrans 16, 3 (source synchronisée, P6), 4 (Sheet : P7, P8, P9), P10, P11, en sombre et en clair, contre `design/pdf/kibo-design-{sombre,clair}.pdf` ; écarts notés dans le rapport.
- [ ] **Spec** : `docs/superpowers/specs/2026-09-26-kibo-integrations.md` §14 contient N1 à N36 ; tableau « Points d'ancrage » de ce plan à jour (colonne « Réel »).
- [ ] **Tag** : `git tag v0.5 && git push origin v0.5`.
- [ ] **Rapport** : `docs/superpowers/rapports/2026-09-26-jalon-v0.5.md` (livré, écarts de maquette, décisions N1 à N36, risques ouverts : écarts de la réconciliation T0 réellement rencontrés, formes réelles de l'API GitHub non vérifiées en CI, dépendance `@modelcontextprotocol/sdk`, `Bun.secrets` sous Linux, TOCTOU DNS), commit `docs: rapport du jalon v0.5`.
- [ ] **Contrôle manuel optionnel** (non bloquant, spec F « Comptes et secrets réels ») : Adam, sur un dépôt de test avec un Project v2 et un jeton (`repo`, `project`), puis Figma desktop avec le serveur Dev Mode ; retours consignés dans le rapport.
- [ ] **Suite** : sur décision d'Adam, les phases s'enchaînent jusqu'à la 7 sans attente ; le chef d'équipe passe directement au plan de la phase 6.
