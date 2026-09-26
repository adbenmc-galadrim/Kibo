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
5. **Démon arrêté entre le `POST` de création d'une issue et l'écriture de la ligne de sync** : au redémarrage, la création est adoptée (même auteur, titre et corps depuis `since`) au lieu d'être dupliquée, et le pull n'importe pas l'issue en double tant qu'une création est incertaine (Task 13 « a retried create adopts the issue created by a previous attempt », Task 14 « an uncertain create blocks imports until it resolves »).

## Points d'ancrage des phases 2 à 4

Les plans des phases 2 à 4 n'existent pas encore à l'écriture de ce plan ; leurs specs fixent les noms. **Tout le code de cette phase consomme ces ancrages à travers `IntegrationHost` (Task 2) et trois fichiers de la phase 4 modifiés à des endroits précis.** La Task 2 vérifie chaque ligne dans le code livré ; si un nom diffère, elle n'adapte que `packages/daemon/src/integrations/host.ts` et note l'écart dans le tableau ci-dessous (colonne « Réel »), sans toucher aux autres tâches.

| Ancrage | Attendu (spec) | Utilisé par | Réel |
|---|---|---|---|
| Réf. PR (phase 3) | `GithubPrRef` et `ExternalRef` dans `packages/schema/src/external-ref.ts` ; `Ticket.externalRefs: ExternalRef[]` ; commande réservée `upsertExternalRef { ticketId, ref }` ; core `upsertExternalRef(doc, ticketId, ref)` dans `packages/core/src/external-refs.ts`, stockage JSON sous la clé `externalRefs` du nœud | Task 4 | — |
| `gh` (phase 3) | binaire surchargé par `KIBO_GH`, lancé par `Bun.spawn` en tableau | Task 2 (`GhRunner`) | — |
| Remote git (phase 3) | exécution `git` dans le dossier du projet (`KIBO_GIT`) | Task 2 (`githubRepo`) | — |
| Notifications M1 (phase 2) | fonction de notification système du démon | Task 2 (`notify`) | — |
| Moteur de règles (phase 2) | événements typés, règles par défaut déclaratives | Task 2 (`ruleEvent`), Task 16 | — |
| `brief.md` (phase 2) | générateur du brief d'un run | Task 20 | — |
| Réglages (phase 2) | page Paramètres (écran 14/15) avec navigation latérale | Task 10 | — |
| WebSocket typé (phase 3) | messages `{ type, … }` diffusés à l'UI ; abonnement générique côté client | Task 2, Task 10 | — |
| Manifeste v1 (phase 4) | `ComponentManifest` avec `net`, `data`, `configVersion`, `changes`, `sdk` ; `BuiltinEntityType` ; `BUILTIN_IDS` dans `schema` ; `WRITES` (méthode → entité, `null` = réservé) | Tasks 1, 4, 9 | — |
| `componentCall` (phase 4) | union `ComponentCall`, contrôles §6.4 de la spec B, dispatch côté démon | Tasks 9, 15, 19 | — |
| Proxy `fetch` (phase 4) | contrôle `net`, anti-SSRF, en-têtes retirés, redirections, délai 15 s, 5 Mio | Task 8 | — |
| Backends (phase 4) | `WorkerHost` (`{ type: "load", manifest, code }`, `invoke` d'une action) ; `defineServer` de `@kibo/sdk/server` ; `devkit.buildComponent` | Tasks 1, 13, 19 | — |
| Écran 30 (phase 4) | liste des permissions en langage clair ; `GrantedPermissions` ; diff « nouvelles permissions » | Task 9 | — |
| Entité hors snapshot (phase 4) | `list("note")` servie par le démon hors du doc Loro | Task 9 (`ci_run`) | — |
| Messages `call` des backends (phase 4) | traitement des `{ type: "call" }` du `ComponentBackendHost`, rattachés à l'`instanceId` de l'invocation | Task 19 (`binding:`) | — |
| `devkit` (phase 4) | construction de la cible serveur d'un composant (`buildComponent`) | Task 19 | — |
| Suite de conformité (phase 4) | `runConformance(component, seed, options?)` | Task 22 | — |

## Décisions nouvelles

Chacune est reportée dans la spec F (nouvelle section « §14 Décisions du plan ») par la Task 1, avant tout code, comme l'exige `CLAUDE.md`.

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
| P7 | Sheet ticket, GitHub | chips dans l'en-tête : `#42` (issue, icône cercle ouvert / fermé) et `#12` (PR) ; ligne d'état « Synchronisation en attente » (icône horloge) ; bandeau d'échec (message, Réessayer / Abandonner) ; badge « Lien GitHub rompu » + aide | 18 |
| P8 | Sheet ticket, CI | section « CI » sous Dépendances : une ligne par workflow (pastille réussite / échec / en cours, nom, durée, « Voir les logs ») ; état vide ; Sheet de logs (titre « Logs · build », champ de recherche, bascule « Erreurs seulement », lignes numérotées monospace, lignes d'erreur surlignées en rouge atténué, mention « Log tronqué à 20 Mio. ») | 18 |
| P9 | Sheet ticket, Maquettes | propriété « Maquette » (nom du premier nœud, lien) ; section « Maquettes » : vignettes 16:10 avec nom, badge « Figma non joignable » ou « Aperçu indisponible », « Retirer » ; champ « Colle l'URL d'un nœud Figma… » + « Lier un nœud Figma » ; erreur URL invalide | 18 |
| P10 | Widget Source MCP | carte de widget : titre de l'instance, liste d'éléments (titre, sous-titre, lien externe, bouton « Créer un ticket » ou puce « KIB-31 » si déjà importé), pied « Mis à jour il y a 3 min · Rafraîchir » ; états vide, erreur (« Serveur MCP injoignable »), chargement ; étape de config à l'écran 3 (serveur, mode Outil / Ressource, outil, arguments JSON, correspondance des champs `items`, `id`, `title`, `subtitle`, `url`, rafraîchissement en minutes) | 22 |
| P11 | Kanban / Tickets synchronisés | en-tête d'instance « GitHub · adam/kibo » + bouton « Synchroniser » ; chip CI sur une carte (pastille verte, rouge ou ambre à côté de `#12`) ; état « Liaison supprimée » | 21 |

## File Structure

```
packages/schema/src/
  integrations.ts          RepoSlug, WebUrl, SecretName, refs GitHub/Figma/MCP, Binding, SyncedFields, PushOp, MappedRemote, PullPage, IntegrationId/Status, CI, MCP, SyncState, IntegrationEvent
  integrations-rpc.ts      INTEGRATION_RPC (Zod) + IntegrationRpcResult
  status-projection.ts     remoteStatusId, projectStatus (N3)
  github-graphql.ts        requêtes GraphQL partagées (adaptateur, compte, faux GitHub)
  mcp-rules.ts             mcpCovered, secretHostsCovered
  external-ref.ts          (phase 3) union étendue + externalRefKey
  errors.ts manifest.ts rpc.ts index.ts   (modifiés)
packages/core/src/
  bindings.ts              addBinding, removeBinding, listBindings, getBinding
  external-refs.ts         (phase 3) clés par type, removeExternalRef, importExternalTicket
  sync-plan.ts             projectLocal, planSync, settleAfterPush, canApplyRemote, canonicalFields
packages/daemon/src/
  integrations/            types.ts host.ts db.ts redact.ts events.ts settings.ts registry.ts bootstrap.ts
                           memory-secret-store.ts bun-secret-store.ts github-remote.ts probes.ts
                           net.ts rate-limit.ts testing/fake-host.ts
  github/                  auth.ts api.ts handlers.ts
  sync/                    hash.ts sync-store.ts outbox.ts apply.ts engine.ts scheduler.ts module.ts
                           worker-runner.ts binding-calls.ts builtin-adapter.ts testing/memory-runner.ts
  ci/                      ci-store.ts poller.ts logs.ts module.ts
  mcp/                     config-store.ts command-line.ts stdio-transport.ts result.ts connection.ts hub.ts component-gate.ts module.ts
  figma/                   figma-url.ts figma.ts brief.ts module.ts
  testing/                 fake-github.ts fake-github-graphql.ts fake-mcp.ts fake-mcp-stdio.ts
packages/sdk/src/          adapter.ts source.ts ui/switch.tsx ui/checkbox.tsx (+ types.ts sdk.ts mock.ts conformance.tsx modifiés)
packages/ui/src/
  i18n/fr-integrations.ts
  settings/                IntegrationsPage.tsx IntegrationRow.tsx integration-rows.ts DisconnectDialog.tsx
  dialogs/integrations/    GithubConnectDialog.tsx FigmaConnectDialog.tsx McpServersDialog.tsx McpServerDialog.tsx
  dialogs/sync/            SourcePicker.tsx SyncSourceForm.tsx status-map.ts use-sync-progress.ts
  shell/sheet/             GithubRefs.tsx SyncStatus.tsx CiSection.tsx CiLogSheet.tsx FigmaSection.tsx log-lines.ts ci-format.ts
  shell/                   use-conflict-toasts.ts
  pages/                   SourceHeader.tsx
  state/                   use-integrations.ts use-sync-state.ts
components/github-issues/  kibo.component.json src/{remote.ts,map.ts,cursor.ts,rest.ts,project.ts,adapter.ts,server.ts,index.ts}
components/mcp-source/     kibo.component.json src/{McpSource.tsx,SourceItemRow.tsx,config.ts,extract.ts,index.ts,fr.ts}
packages/ui/src/dialogs/mcp-source/  McpSourceStep.tsx (étape de config à l'écran 3)
e2e/                       integrations.spec.ts (+ serve.ts, token.ts modifiés)
scripts/build-builtin.ts   backends intégrés préconstruits pour le paquet desktop (N7)
```

## Vagues d'exécution

Une tâche démarre quand toutes les tâches de sa colonne « Dépend de » sont intégrées dans `main`. Les tâches d'une même vague touchent des fichiers disjoints, à l'exception de lignes d'enregistrement dans `packages/daemon/src/integrations/bootstrap.ts` (une ligne par module ; conflit trivial résolu au rebase par le chef d'équipe).

| Vague | Tâches (parallèles) | Dépend de | Prérequis Penpot |
|---|---|---|---|
| 0 | 1 Contrats | — | — |
| 0 bis | 2 Socle démon | 1 | — |
| 1 | 3 Trousseau · 4 Réfs et liaisons · 5 Fusion à trois · 6 Faux GitHub · 7 Faux MCP · 8 Réseau · 9 SDK et permissions · 10 Écran 16 | 2 | P1 (10) |
| 2 | 11 Dialogues de connexion · 12 Compte GitHub · 13 Adaptateur GitHub Issues · 14 Moteur de sync · 15 Hub MCP · 17 Source synchronisée · 18 Sheet | 11 : 10 · 12 : 6, 8 · 13 : 4, 6, 9 · 14 : 4, 5, 8 · 15 : 7, 8, 9 · 17 : 10 · 18 : 4, 10 | P2 à P5 (11), P6 (17), P7 à P9 (18) |
| 3 | 16 GitHub Actions · 19 Adaptateur dans le Worker · 20 Figma · 21 Kanban et Tickets synchronisés · 22 Source MCP | 16 : 6, 8, 12 · 19 : 12, 13, 14 · 20 : 15 · 21 : 4, 9, 10 · 22 : 9, 15, 17 | P10 (22), P11 (21) |
| 4 | 23 Test de fuite et E2E | toutes | — |
| Jalon | v0.5 | 23 | — |

Conflits attendus et triviaux (résolus au rebase par le chef d'équipe, une ligne ou un bloc chacun) : `packages/daemon/src/integrations/bootstrap.ts` (un module par tâche : 12, 15, 16, 19, 20), `packages/ui/src/i18n/fr-integrations.ts` (blocs `instance` en 21 et `mcpSource` en 22), `package.json` racine (script `typecheck` : 13 et 22).

---|---|---|---|
| 0 | 1 Contrats | — | — |
| 0 bis | 2 Socle démon | 1 | — |
| 1 | 3 Trousseau · 4 Réfs et liaisons · 5 Fusion à trois · 6 Faux GitHub · 7 Faux MCP · 8 Réseau · 9 SDK et permissions · 10 Écran 16 | 2 | P1 (10) |
| 2 | 11 Dialogues de connexion · 12 Compte GitHub · 13 Adaptateur GitHub Issues · 14 Moteur de sync · 15 Hub MCP · 17 Source synchronisée · 18 Sheet | 11 : 10 · 12 : 6, 8 · 13 : 4, 6, 9 · 14 : 4, 5, 8 · 15 : 7, 8, 9 · 17 : 10 · 18 : 4 | P2 à P5 (11), P6 (17), P7 à P9 (18) |
| 3 | 16 GitHub Actions · 19 Adaptateur dans le Worker · 20 Figma · 21 Kanban et Tickets synchronisés · 22 Source MCP | 16 : 6, 8, 12 · 19 : 12, 13, 14 · 20 : 15 · 21 : 4, 9 · 22 : 9, 15 | P10 (22), P11 (21) |
| 4 | 23 Test de fuite et E2E | toutes | — |
| Jalon | v0.5 | 23 | — |

---

### Task 1: Contrats partagés

Fige tous les types échangés entre tâches. Aucune logique métier ; tout est testé par parsing.

**Files:**
- Create: `packages/schema/src/integrations.ts`, `packages/schema/src/integrations-rpc.ts`, `packages/schema/src/status-projection.ts`, `packages/schema/src/github-graphql.ts`, `packages/schema/src/github-errors.ts`, `packages/schema/src/mcp-rules.ts`, `packages/schema/src/integrations.test.ts`
- Modify: `packages/schema/src/errors.ts`, `packages/schema/src/manifest.ts`, `packages/schema/src/rpc.ts`, `packages/schema/src/index.ts`
- Create: `packages/sdk/src/adapter.ts`, `packages/sdk/src/adapter.test.ts` ; Modify: `packages/sdk/src/index.ts`, `packages/sdk/package.json` (`"zod": "3.25.76"`, déjà verrouillé par `schema` : aucune version nouvelle)
- Create: `packages/ui/src/i18n/fr-integrations.ts` ; Modify: `packages/ui/src/i18n/fr.ts`
- Modify: `CLAUDE.md` (monorepo : `components/github-issues/`, `components/mcp-source/`), `docs/superpowers/specs/2026-09-26-kibo-integrations.md` (§14 « Décisions du plan » : N1 à N21 recopiées de ce plan)

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
  - `BindingState`, `OutboxError`, `SyncState`, `SyncReport`, `IntegrationEvent`
  - `INTEGRATION_RPC`, `IntegrationRpcRequest`, `IntegrationRpcResult`
  - `remoteStatusId(closed, optionId, map)`, `projectStatus(statusId, map, fallback)`
  - `GITHUB_GRAPHQL: { projectItems, addItem, setStatus, issueItems, listProjects }`
  - `githubError(status: number, header: (name: string) => string | null, body: string): KiboError` (partagé par le démon et l'adaptateur)
  - `mcpCovered(rules, server, tool, config | null)`, `secretHostsCovered(manifest): string[]`
  - `ComponentManifest` : `kind` accepte `"adapter"` ; `secrets: { name: SecretName; hosts: string[] }[]` ; `mcp: string[]`
  - codes `KiboError` : `SECRET_STORE_UNAVAILABLE`, `NOT_CONNECTED`, `RATE_LIMITED`, `REMOTE_UNAVAILABLE`, `REMOTE_REJECTED`, `REMOTE_NOT_FOUND`, `REMOTE_CONFLICT`, `MCP_UNAVAILABLE`, `MCP_FAILED` (+ `TIMEOUT` s'il manque)
- Produces (sdk) : `Adapter<R, C>`, `AdapterContext<C>`, `defineAdapter`, `mapRemote`, `adapterActions`, `BINDING_PREFIX = "binding:"`, `bindingIdOf(instanceId)`
- Produces (ui) : `frIntegrations` (tous les textes de la phase), exposé en `fr.integrations`.

- [ ] **Step 1: Reporter les décisions dans la spec**

Ajouter à la fin de `docs/superpowers/specs/2026-09-26-kibo-integrations.md` une section `## 14. Décisions du plan` qui recopie mot pour mot les puces N1 à N21 de ce plan. Mettre à jour la liste du monorepo de `CLAUDE.md` :

```
components/<id>/     composants intégrés (kanban, tickets, github-issues sans UI, mcp-source…) écrits avec le SDK public
```

- [ ] **Step 2: Écrire le test des schémas (échoue : modules absents)**

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
  });
});
```

- [ ] **Step 3: Lancer le test**

Run: `bun test packages/schema/src/integrations.test.ts`
Expected: FAIL (`Cannot find module` / exports manquants).

- [ ] **Step 4: Écrire `packages/schema/src/integrations.ts`**

```ts
import { z } from "zod";
import type { KiboErrorCode } from "./errors";
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
]);
export type IntegrationEvent = z.infer<typeof IntegrationEvent>;
```

- [ ] **Step 5: Écrire `status-projection.ts`, `mcp-rules.ts`, `github-graphql.ts`**

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

- [ ] **Step 6: Étendre le manifeste, les erreurs et le RPC**

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

`packages/schema/src/errors.ts` : ajouter à l'union `KiboErrorCode` :

```ts
  | "SECRET_STORE_UNAVAILABLE"
  | "NOT_CONNECTED"
  | "RATE_LIMITED"
  | "REMOTE_UNAVAILABLE"
  | "REMOTE_REJECTED"
  | "REMOTE_NOT_FOUND"
  | "REMOTE_CONFLICT"
  | "MCP_UNAVAILABLE"
  | "MCP_FAILED"
```

(et `| "TIMEOUT"` s'il n'a pas été ajouté en phase 4).

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

`packages/schema/src/rpc.ts` : ajouter `...INTEGRATION_RPC` à la fin du tableau de `RpcRequest` (`z.discriminatedUnion("method", [ …, ...INTEGRATION_RPC ])`) et `& IntegrationRpcResult` au type `RpcResult` (`export type RpcResult = { … } & IntegrationRpcResult;`).

`packages/schema/src/index.ts` : ajouter

```ts
export * from "./github-errors";
export * from "./github-graphql";
export * from "./integrations";
export * from "./integrations-rpc";
export * from "./mcp-rules";
export * from "./status-projection";
```

- [ ] **Step 7: Lancer le test**

Run: `bun test packages/schema`
Expected: PASS (tous les tests de `schema`, anciens compris).

- [ ] **Step 8: Test du contrat d'adaptateur (échoue)**

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

- [ ] **Step 9: Écrire `packages/sdk/src/adapter.ts`**

```ts
import {
  type GithubIssueRef,
  KiboError,
  type MappedRemote,
  PullInput,
  PushOp,
  type SyncedFields,
} from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { KiboSdk } from "./types";

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

export const BINDING_PREFIX = "binding:";
const ADAPTER_TIMEOUT_MS = 120_000;

export function defineAdapter<R, C>(adapter: Adapter<R, C>): Adapter<R, C> {
  return adapter;
}

export function bindingIdOf(instanceId: string): string {
  if (!instanceId.startsWith(BINDING_PREFIX)) {
    throw new KiboError("INVALID_INPUT", "adapter actions run for a binding only");
  }
  return instanceId.slice(BINDING_PREFIX.length);
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

- [ ] **Step 10: Textes de l'interface**

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

`packages/ui/src/i18n/fr.ts` : `import { frIntegrations } from "./fr-integrations";` et ajouter la clé `integrations: frIntegrations,` à l'objet `fr`.

- [ ] **Step 11: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS.

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-26-kibo-integrations.md packages/schema/src packages/sdk/src/adapter.ts packages/sdk/src/adapter.test.ts packages/sdk/src/index.ts packages/sdk/package.json bun.lock packages/ui/src/i18n
git commit -m "feat(schema): contrats des intégrations"
```

---

### Task 2: Socle démon des intégrations

Isole les ancrages des phases 2 à 4 derrière `IntegrationHost`, crée les tables, le caviardage, le journal, les réglages, le registre RPC et les sondes. Après cette tâche, chaque module d'intégration se branche en une ligne dans `bootstrap.ts`.

**Files:**
- Create: `packages/daemon/src/integrations/{types.ts,host.ts,db.ts,redact.ts,events.ts,settings.ts,registry.ts,bootstrap.ts,memory-secret-store.ts,github-remote.ts,probes.ts}`
- Create: `packages/daemon/src/integrations/testing/fake-host.ts`
- Test: `packages/daemon/src/integrations/{redact,events,registry,github-remote,bootstrap,host}.test.ts`
- Modify: `packages/daemon/src/store.ts` (`db`, `transaction`), `packages/daemon/src/service.ts` (commande avec origine, observateurs dans la transaction, restauration sur échec, dispatch des RPC d'intégration, événements), `packages/daemon/src/server.ts` (codes HTTP, caviardage des erreurs, diffusion des `IntegrationEvent`), `packages/daemon/src/main.ts` (drapeaux, caviardage de la console), `packages/schema/src/rpc.ts` (`command` accepte `instanceId?`)
- Modify (si un ancrage diffère) : ce plan, tableau « Points d'ancrage », colonne « Réel »

**Interfaces:**
- Consumes: Task 1 (schema) ; ancrages du tableau (phase 2 : notification, règles ; phase 3 : `git`, `gh`, WebSocket typé ; phase 4 : `componentCall { kind: "run" }`).
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

export type CommandOrigin = "user" | "sync";
export type CommandMeta = { origin: CommandOrigin; instanceId: string | null };
export type CommandEvent = { projectId: string; command: ProjectCommand; result: unknown; meta: CommandMeta };
export type SystemNotification = { title: string; body: string; projectId: string; ticketId: string | null };
export type RuleEvent = { type: "ci.failed"; projectId: string; ticketId: string; runId: number; prNumber: number };
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
  ruleEvent(e: RuleEvent): void;
  gitRemoteUrl(projectId: string): Promise<string | null>;
  gitAvailable(): Promise<boolean>;
  gh: GhRunner;
  now(): number;
};
export type CommandInterceptor = (projectId: string, cmd: ProjectCommand, meta: CommandMeta) => ProjectCommand;

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
  - `createIntegrationRpc(parts: { handlers: IntegrationHandlers[]; probes: IntegrationProbe[]; stops: (() => void)[]; hooks: ComponentIntegrationHooks }): IntegrationRpc` avec `IntegrationRpc = { handles(method: string): boolean; handle(req: IntegrationRpcRequest): Promise<unknown>; stop(): void; hooks: ComponentIntegrationHooks }` (les `hooks` sont lus par le `componentCall` et le proxy `fetch` de la phase 4 ; les tâches 8, 12, 15 et 16 remplissent leurs champs)
  - `parseGithubRemote(url: string | null): RepoSlug | null` ; `githubRepoOf(host, projectId): Promise<RepoSlug | null>`
  - `parseIntegrationFlags(values): IntegrationFlags` (`{ testOrigins: string[]; memorySecrets: boolean }`) ; `IntegrationKit` ; `startIntegrations(host, flags, redactor): IntegrationRpc`
  - `createFakeHost(opts?): FakeHost` (tests de toutes les tâches du démon)
  - `Store` gagne `db: Database` et `transaction<T>(fn: () => T): T` ; `Service` gagne `onIntegrationEvent(listener)` et `close()` ; la RPC `command` accepte `instanceId?: string`

- [ ] **Step 1: Vérifier les ancrages**

Lire le code livré des phases 2 à 4 pour chaque ligne du tableau « Points d'ancrage ». Pour chaque écart, noter le nom réel dans la colonne « Réel » (Modify ce plan) et l'utiliser dans `host.ts` et `service.ts` seulement.

- [ ] **Step 2: Tests du caviardage, du journal et des remotes (échouent)**

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

- [ ] **Step 3: Implémenter `db.ts`, `redact.ts`, `events.ts`, `settings.ts`, `github-remote.ts`**

`packages/daemon/src/integrations/db.ts` :

```ts
import type { Database } from "bun:sqlite";

const TABLES = [
  "CREATE TABLE IF NOT EXISTS integration_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS integration_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, integration TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sync_items (binding_id TEXT NOT NULL, remote_id TEXT NOT NULL, ticket_id TEXT NOT NULL, base_json TEXT NOT NULL, remote_updated_at TEXT NOT NULL, last_pushed_hash TEXT, PRIMARY KEY (binding_id, remote_id))",
  "CREATE UNIQUE INDEX IF NOT EXISTS sync_items_ticket ON sync_items (binding_id, ticket_id)",
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

- [ ] **Step 4: Test du registre et de l'amorçage (échoue)**

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

- [ ] **Step 5: Implémenter `registry.ts`, `memory-secret-store.ts`, `probes.ts`, `bootstrap.ts`**

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

function errorStatus(id: IntegrationId, e: unknown): IntegrationStatus {
  if (!(e instanceof KiboError)) console.error(`[kibo-daemon] probe ${id} failed`, e);
  return {
    id,
    state: "error",
    account: null,
    servers: [],
    error: e instanceof KiboError ? { code: e.code, message: e.detail } : { code: "INTERNAL", message: "probe failed" },
    resumeAt: null,
  };
}

export function createIntegrationRpc(parts: {
  handlers: IntegrationHandlers[];
  probes: IntegrationProbe[];
  stops: (() => void)[];
  hooks?: ComponentIntegrationHooks;
}): IntegrationRpc {
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
      return errorStatus(id, e);
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
    hooks: parts.hooks ?? {
      aliases: new Map(),
      observe: () => undefined,
      secret: async () => null,
      mcp: null,
      ciRuns: null,
    },
  };
}
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
import { createIntegrationRpc, type IntegrationRpc } from "./registry";
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
    hooks: { aliases: new Map(), observe: () => undefined, secret: (name) => secrets.get(name), mcp: null, ciRuns: null },
  };
  const modules: IntegrationModule[] = [{ probes: builtinProbes(kit.host) }];
  return createIntegrationRpc({
    handlers: modules.flatMap((m) => (m.handlers ? [m.handlers] : [])),
    probes: modules.flatMap((m) => m.probes ?? []),
    stops: modules.flatMap((m) => (m.stop ? [m.stop] : [])),
    hooks: kit.hooks,
  });
}
```

Run: `bun test packages/daemon/src/integrations` — Expected: PASS.

- [ ] **Step 6: Test de l'hôte réel (échoue)**

`packages/daemon/src/integrations/host.test.ts` (sur le vrai service) :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta } from "@kibo/schema";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import type { CommandEvent, IntegrationHost } from "./types";

let home: string;
let store: Store;
let service: Service;
let host: IntegrationHost;
let project: ProjectMeta;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-host-"));
  store = openStore(home);
  service = createService(store, {
    user: "adam",
    integrations: (h) => {
      host = h;
      return null;
    },
  });
  project = (await service.handle({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#71717A",
  })) as ProjectMeta;
});
afterEach(() => {
  service.close();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

test("commands carry their origin and observers run inside the persistence transaction", () => {
  const seen: CommandEvent[] = [];
  host.onCommand((e) => {
    seen.push(e);
    host.db.query("SELECT 1").get();
  });
  host.command(project.id, { method: "createTicket", title: "A" }, { origin: "sync", instanceId: null });
  expect(seen[0]?.meta).toEqual({ origin: "sync", instanceId: null });
  expect(seen[0]?.command.method).toBe("createTicket");
});

test("a failing observer rolls back persistence and restores the in-memory doc", async () => {
  host.command(project.id, { method: "createTicket", title: "Kept" }, { origin: "user", instanceId: null });
  const off = host.onCommand(() => {
    throw new Error("observer boom");
  });
  expect(() =>
    host.command(project.id, { method: "createTicket", title: "Lost" }, { origin: "user", instanceId: null }),
  ).toThrow("observer boom");
  off();
  expect(host.snapshot(project.id).tickets.map((t) => t.title)).toEqual(["Kept"]);
  service.close();
  const again = createService(store, { user: "adam", integrations: () => null });
  await expect(again.handle({ method: "getProject", projectId: project.id })).resolves.toMatchObject({
    tickets: [{ title: "Kept" }],
  });
  again.close();
});

test("interceptors rewrite a command before observers see it", () => {
  const seen: string[] = [];
  host.intercept((_p, cmd) => (cmd.method === "createTicket" ? { ...cmd, title: `${cmd.title}!` } : cmd));
  host.onCommand((e) => seen.push(e.command.method === "createTicket" ? e.command.title : ""));
  host.command(project.id, { method: "createTicket", title: "A" }, { origin: "user", instanceId: null });
  expect(seen).toEqual(["A!"]);
  expect(host.snapshot(project.id).tickets[0]?.title).toBe("A!");
});

test("integration events reach service listeners", () => {
  const events: unknown[] = [];
  service.onIntegrationEvent((e) => events.push(e));
  host.broadcast({ type: "integrations" });
  expect(events).toEqual([{ type: "integrations" }]);
});
```

Run: `bun test packages/daemon/src/integrations/host.test.ts` — Expected: FAIL.

- [ ] **Step 7: Brancher le store, le service, le serveur et `main.ts`**

`packages/daemon/src/store.ts` : ajouter au type `Store` `db: Database;` et `transaction<T>(fn: () => T): T;`, et au retour d'`openStore` :

```ts
    db,
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
```

`packages/daemon/src/integrations/host.ts` :

```ts
import type { CommandResult, IntegrationEvent, ProjectCommand, ProjectMeta, ProjectSnapshot } from "@kibo/schema";
import type { Store } from "../store";
import type {
  CommandEvent,
  CommandInterceptor,
  CommandMeta,
  GhRunner,
  IntegrationHost,
  RuleEvent,
  SystemNotification,
} from "./types";

export type HostParts = {
  user: string;
  home: string;
  store: Store;
  projects(): ProjectMeta[];
  snapshot(projectId: string): ProjectSnapshot;
  runCommand(projectId: string, cmd: ProjectCommand, meta: CommandMeta): unknown;
  onCommand(listener: (e: CommandEvent) => void): () => void;
  intercept(interceptor: CommandInterceptor): () => void;
  broadcast(event: IntegrationEvent): void;
  notify(n: SystemNotification): void;
  ruleEvent(e: RuleEvent): void;
  git(projectId: string, args: string[]): Promise<{ code: number; stdout: string }>;
  gitAvailable(): Promise<boolean>;
  gh: GhRunner;
  now?: () => number;
};

export function createIntegrationHost(parts: HostParts): IntegrationHost {
  return {
    user: parts.user,
    home: parts.home,
    db: parts.store.db,
    transaction: (fn) => parts.store.transaction(fn),
    projects: parts.projects,
    snapshot: parts.snapshot,
    command<C extends ProjectCommand>(projectId: string, cmd: C, meta: CommandMeta): CommandResult[C["method"]] {
      return parts.runCommand(projectId, cmd, meta) as CommandResult[C["method"]];
    },
    onCommand: parts.onCommand,
    intercept: parts.intercept,
    broadcast: parts.broadcast,
    notify: parts.notify,
    ruleEvent: parts.ruleEvent,
    async gitRemoteUrl(projectId) {
      const meta = parts.projects().find((p) => p.id === projectId);
      if (!meta?.folder) return null;
      const r = await parts.git(projectId, ["remote", "get-url", "origin"]);
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    },
    gitAvailable: parts.gitAvailable,
    gh: parts.gh,
    now: parts.now ?? Date.now,
  };
}
```

(`as CommandResult[…]` : `executeProjectCommand` renvoie `unknown` par conception, comme le SDK depuis la v0.1.)

`packages/daemon/src/service.ts` : `createService(store, opts)` accepte `opts.integrations?: (host: IntegrationHost) => IntegrationRpc | null` et `opts.integrationDeps?: Pick<HostParts, "notify" | "ruleEvent" | "git" | "gitAvailable" | "gh">` (fournis par `main.ts` depuis les services des phases 2 et 3 ; à défaut, `notify` et `ruleEvent` journalisent, `git`/`gh` lancent `KIBO_GIT`/`KIBO_GH`). Toute exécution de commande passe par :

```ts
  const commandListeners = new Set<(e: CommandEvent) => void>();
  const integrationListeners = new Set<(e: IntegrationEvent) => void>();
  const interceptors = new Set<CommandInterceptor>();
  const runCommand = (projectId: string, requested: ProjectCommand, meta: CommandMeta): unknown => {
    const doc = project(projectId);
    let command = requested;
    for (const i of interceptors) command = i(projectId, command, meta);
    const result = executeProjectCommand(doc, command);
    try {
      store.transaction(() => {
        persist(projectDocId(projectId), doc);
        for (const l of commandListeners) l({ projectId, command, result, meta });
      });
    } catch (e) {
      const restored = loadDoc(store, projectDocId(projectId));
      if (!restored) throw new KiboError("STORE_CORRUPT", `project ${projectId} lost its snapshot`);
      projects.set(projectId, restored);
      throw e;
    }
    emit(projectId);
    return result;
  };
```

Les intercepteurs (`host.intercept`) réécrivent une commande avant son exécution (la Task 14 transforme une création depuis une instance synchronisée en import avec référence en attente) ; les observateurs voient la commande réécrite. La RPC `command` appelle `runCommand(req.projectId, req.command, { origin: "user", instanceId: req.instanceId ?? null })` après avoir vérifié que `req.instanceId`, s'il est fourni, désigne une instance du projet (`NOT_FOUND` sinon) ; le traitement `componentCall { kind: "run" }` de la phase 4 passe `{ origin: "user", instanceId }`. `packages/schema/src/rpc.ts` : la requête `command` gagne `instanceId: z.string().min(1).optional()`. Le service construit l'hôte avec `createIntegrationHost({ … runCommand, onCommand: (l) => { commandListeners.add(l); return () => commandListeners.delete(l); }, broadcast: (e) => { for (const l of integrationListeners) l(e); } … })`, appelle `opts.integrations?.(host)` et, dans `handle`, délègue toute méthode pour laquelle `integrations.handles(req.method)` est vrai (`await`). `Service` expose `onIntegrationEvent(listener): () => void` et `close()` (appelle `integrations.stop()`). Le service garde `integrations.hooks` et le passe au traitement `componentCall` et au proxy `fetch` de la phase 4 (utilisé à partir des Tasks 8 et 9 ; sans intégrations, des hooks neutres : aucun alias, aucun secret, `mcp` et `ciRuns` à `null`).

`packages/daemon/src/server.ts` : `STATUS` gagne `SECRET_STORE_UNAVAILABLE: 503, NOT_CONNECTED: 409, RATE_LIMITED: 429, REMOTE_UNAVAILABLE: 502, REMOTE_REJECTED: 502, REMOTE_NOT_FOUND: 404, REMOTE_CONFLICT: 409, MCP_UNAVAILABLE: 502, MCP_FAILED: 502` ; `ServerOptions` gagne `redact: (text: string) => string`, appliqué à `e.detail` dans la réponse d'erreur ; `opts.service.onIntegrationEvent((e) => server.publish("changes", JSON.stringify(e)))`.

`packages/daemon/src/main.ts` : options `"test-origins": { type: "string" }` et `"memory-secrets": { type: "boolean", default: false }` ; au démarrage :

```ts
const redactor = createRedactor();
installConsoleRedaction(redactor);
const flags = parseIntegrationFlags(values);
const service = createService(store, {
  user: userInfo().username,
  integrationDeps,
  integrations: (host) => startIntegrations(host, flags, redactor),
});
```

et `startServer({ …, redact: redactor.redact })`. `integrationDeps` relie la notification (phase 2), le moteur de règles (phase 2), `git` et `gh` (phase 3).

- [ ] **Step 8: Hôte factice pour les tests des autres tâches**

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
import { migrateIntegrations } from "../db";
import type {
  CommandEvent,
  CommandInterceptor,
  CommandMeta,
  IntegrationHost,
  RuleEvent,
  SystemNotification,
} from "../types";

export type FakeHost = IntegrationHost & {
  projectId: string;
  notifications: SystemNotification[];
  ruleEvents: RuleEvent[];
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
    ruleEvents: [],
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
    notify: (n) => host.notifications.push(n),
    ruleEvent: (e) => host.ruleEvents.push(e),
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

(Adapter `ProjectMeta` aux champs réels si les phases 2 à 4 en ont ajouté.)

- [ ] **Step 9: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS (y compris les tests existants du service et du serveur).

```bash
git add packages/daemon/src packages/schema/src/rpc.ts docs/superpowers/plans/2026-09-26-kibo-integrations.md
git commit -m "feat(daemon): socle des intégrations"
```

---

### Task 3: Trousseau système (`Bun.secrets`)

**Files:**
- Create: `packages/daemon/src/integrations/bun-secret-store.ts`, `packages/daemon/src/integrations/bun-secret-store.test.ts`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (`secretStoreFor`)

**Interfaces:**
- Consumes: `SecretStore`, `Redactor` (Task 2), `SecretNameSchema` (Task 1).
- Produces: `KEYCHAIN_SERVICE = "dev.kibo"` ; `type KeychainBackend` ; `createBunSecretStore(redactor: Redactor, backend?: KeychainBackend): SecretStore`.

- [ ] **Step 1: Test (échoue)**

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

- [ ] **Step 2: Implémenter**

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

Si le type de `Bun.secrets` de Bun 1.4.2 n'est pas structurellement compatible avec `KeychainBackend`, l'envelopper dans un objet de trois fonctions qui l'appellent (jamais de `as`).

- [ ] **Step 3: Brancher dans l'amorçage**

`packages/daemon/src/integrations/bootstrap.ts` :

```ts
function secretStoreFor(flags: IntegrationFlags, redactor: Redactor): SecretStore {
  if (flags.memorySecrets) return createMemorySecretStore(redactor);
  return createBunSecretStore(redactor);
}
```

et, après la création du `kit`, journaliser l'indisponibilité au démarrage :

```ts
  void kit.secrets.availability().then((a) => {
    if (!a.ok) kit.events.log("github", "warn", `keychain unavailable: ${a.reason}`);
  });
```

(`unavailableSecretStore` reste exporté pour les tests.)

- [ ] **Step 4: Vérifier et commiter**

Run: `bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/integrations/bun-secret-store.ts packages/daemon/src/integrations/bun-secret-store.test.ts packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): secrets dans le trousseau système"
```

---

### Task 4: Références externes et liaisons

**Files:**
- Modify: `packages/schema/src/external-ref.ts` (phase 3), `packages/schema/src/rpc.ts` (commandes, `CommandResult`, `ProjectSnapshot.bindings`), emplacement de `WRITES` (phase 4 ; entrées réservées)
- Modify: `packages/core/src/external-refs.ts` (phase 3), `packages/core/src/commands.ts`, `packages/core/src/index.ts`
- Create: `packages/core/src/bindings.ts`, `packages/core/src/bindings.test.ts`, `packages/core/src/external-refs-kinds.test.ts`

**Interfaces:**
- Consumes: `GithubIssueRef`, `FigmaNodeRef`, `McpItemRef`, `Binding` (Task 1) ; `GithubPrRef`, stockage `externalRefs` (phase 3).
- Produces (schema) :
  - `ExternalRef = z.discriminatedUnion("kind", [GithubPrRef, GithubIssueRef, FigmaNodeRef, McpItemRef])`, `ExternalRefKind`, `externalRefKey(ref): string` (`url` · `bindingId` · `fileKey:nodeId` · `server:itemId`), `externalRefTarget(ref): string | null` (objet distant ; `null` pour une issue en attente)
  - `ProjectCommand` gagne (réservées, `WRITES[…] = null`) : `{ method: "removeExternalRef"; ticketId; kind: ExternalRefKind; key: string }`, `{ method: "addBinding"; binding: Binding }`, `{ method: "removeBinding"; bindingId: string }`, `{ method: "importExternalTicket"; title: string; description?: string; statusId?: StatusId; assignee?: Assignee | null; ref: ExternalRef }`
  - `CommandResult` : `removeExternalRef: Ticket`, `addBinding: Binding`, `removeBinding: null`, `importExternalTicket: Ticket`
  - `ProjectSnapshot.bindings: Binding[]`
- Produces (core) : `upsertExternalRef(doc, ticketId, ref): Ticket` (dédoublonné par `kind` + `externalRefKey`, position conservée) ; `removeExternalRef(doc, { ticketId, kind, key }): Ticket` ; `findTicketByRef(doc, ref): Ticket | null` (par `externalRefTarget`) ; `importExternalTicket(doc, input): Ticket` (idempotent par cible) ; `addBinding`, `removeBinding`, `getBinding(doc, id): Binding`, `listBindings(doc): Binding[]`.

- [ ] **Step 1: Tests (échouent)**

`packages/core/src/external-refs-kinds.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { ExternalRef } from "@kibo/schema";
import { executeProjectCommand, readProject } from "./commands";
import { findTicketByRef, importExternalTicket, removeExternalRef, upsertExternalRef } from "./external-refs";
import { createProjectDoc } from "./project";
import { createTicket } from "./tickets";

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

- [ ] **Step 2: Schéma**

`packages/schema/src/external-ref.ts` (garder `GithubPrRef` de la phase 3 tel quel) :

```ts
import { FigmaNodeRef, GithubIssueRef, McpItemRef } from "./integrations";

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

`packages/schema/src/rpc.ts` : ajouter à `ProjectCommand`

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

à `CommandResult` : `removeExternalRef: Ticket; addBinding: Binding; removeBinding: null; importExternalTicket: Ticket;` et à `ProjectSnapshot` : `bindings: Binding[];`. Dans `WRITES` (phase 4) : `removeExternalRef: null, addBinding: null, removeBinding: null, importExternalTicket: null` (commandes réservées au shell et au démon).

- [ ] **Step 3: Core**

`packages/core/src/external-refs.ts` (remplace la version par URL de la phase 3 ; si la phase 3 stocke les réfs autrement que sous la clé JSON `externalRefs` du nœud, garder son stockage et ne changer que la clé de dédoublonnage) :

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
import type { LoroDoc, LoroTreeNode } from "loro-crdt";
import { createTicket, getTicket, listTickets } from "./tickets";
import { getNode } from "./tree";

const RefList = ExternalRef.array();
const tree = (doc: LoroDoc) => doc.getTree("tickets");

function readRefs(node: LoroTreeNode): ExternalRef[] {
  const raw = node.data.get("externalRefs");
  if (raw === undefined || raw === null) return [];
  const parsed = RefList.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid external refs on ${node.id}`);
  return parsed.data;
}

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

`packages/core/src/commands.ts` : cas `removeExternalRef` (`removeExternalRef(doc, { ticketId, kind, key })`), `addBinding`, `removeBinding` (renvoie `null`), `importExternalTicket` (`const { method: _method, ...input } = cmd; return importExternalTicket(doc, input);`) ; `readProject` ajoute `bindings: listBindings(doc)`. `packages/core/src/index.ts` : `export * from "./bindings";`.

- [ ] **Step 4: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck` — Expected: PASS (tests de la phase 3 sur `github_pr` compris).

```bash
git add packages/schema/src packages/core/src packages/sdk/src/sdk.ts
git commit -m "feat(core): références externes et liaisons"
```

(`packages/sdk/src/sdk.ts` seulement si `WRITES` y vit encore.)

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

- [ ] **Step 1: Tests (échouent)**

`packages/core/src/sync-plan.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { remoteStatusId, type StatusId, StatusId as StatusIds, type StatusMap, type SyncedFields } from "@kibo/schema";
import fc from "fast-check";
import { canonicalFields, normalizeText, planSync, projectLocal, settleAfterPush } from "./sync-plan";

const f = (patch: Partial<SyncedFields> = {}): SyncedFields => ({
  title: "A",
  description: "",
  statusId: "todo",
  closed: false,
  ...patch,
});

describe("three-way merge, field by field (spec F §5.3)", () => {
  test("nothing changed", () => {
    expect(planSync({ base: f(), local: f(), remote: f() })).toEqual({ push: {}, apply: {}, conflicts: [], nextBase: f() });
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
  test("closed is never reported as a conflict on its own", () => {
    const p = planSync({
      base: f(),
      local: f({ statusId: "done", closed: true }),
      remote: f({ statusId: "done", closed: true, title: "Z" }),
    });
    expect(p.conflicts).toEqual([]);
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
    expect(canonicalFields(f())).toBe(canonicalFields({ closed: false, statusId: "todo", description: "", title: "A" }));
    expect(normalizeText("a\rb\r\nc")).toBe("a\nb\nc");
  });
});

type Remote = { title: string; description: string; closed: boolean; option: string | null };
type Local = { title: string; description: string; statusId: StatusId };
const toFields = (r: Remote, map: StatusMap | null): SyncedFields => {
  const statusId = remoteStatusId(r.closed, r.option, map);
  return { title: r.title, description: normalizeText(r.description), statusId, closed: statusId === "done" };
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
    { backlog: optionArb, todo: optionArb, in_progress: optionArb, in_review: optionArb, blocked: optionArb, done: optionArb },
    { requiredKeys: [] },
  ),
  { nil: null },
);
const remoteArb = fc.record({
  title: fc.constantFrom("a", "b", "c"),
  description: fc.constantFrom("", "x", "x\r\ny"),
  closed: fc.boolean(),
  option: fc.option(optionArb, { nil: null }),
});
const localArb = fc.record({
  title: fc.constantFrom("a", "b", "c"),
  description: fc.constantFrom("", "x", "x\ny"),
  statusId: statusArb,
});

test("property: after one pull-and-push cycle, the next cycle is a fixed point", () => {
  fc.assert(
    fc.property(mapArb, remoteArb, remoteArb, localArb, (map, origin, remote, local) => {
      const base = toFields(origin, map);
      const p1 = planSync({ base, local: projectLocal(local, base, map), remote: toFields(remote, map) });
      let localNow = applyLocal(local, p1.apply);
      let remoteNow = remote;
      let baseNow = p1.nextBase;
      const pushed = Object.keys(p1.push) as (keyof SyncedFields)[];
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
      const p2 = planSync({ base: baseNow, local: projectLocal(localNow, baseNow, map), remote: toFields(remoteNow, map) });
      expect(p2.push).toEqual({});
      expect(p2.apply).toEqual({});
    }),
    { numRuns: 2000 },
  );
});
```

(`Object.keys(p1.push) as (keyof SyncedFields)[]` : `Object.keys` perd le type des clés d'un objet dont les clés sont exactement celles de `SyncedFields`.)

Run: `bun test packages/core/src/sync-plan.test.ts` — Expected: FAIL (module absent).

- [ ] **Step 2: Implémenter `packages/core/src/sync-plan.ts`**

```ts
import { projectStatus, type StatusId, type StatusMap, type SyncedField, type SyncedFields } from "@kibo/schema";

export const SYNCED_FIELDS: readonly SyncedField[] = ["title", "description", "statusId", "closed"];
export type ConflictField = "title" | "description" | "statusId";
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
  const statusId = projectStatus(ticket.statusId, map, base.statusId);
  return {
    title: ticket.title.trim(),
    description: normalizeText(ticket.description),
    statusId,
    closed: statusId === "done",
  };
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
    if (canApply(field, r)) {
      plan.apply[field] = r;
      plan.nextBase[field] = r;
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
  if (field !== "closed") plan.conflicts.push(field as ConflictField);
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
  return JSON.stringify({ closed: f.closed, description: f.description, statusId: f.statusId, title: f.title });
}
```

(`field as ConflictField` : `field` est exclu de `"closed"` par la condition qui précède ; TypeScript ne rétrécit pas un paramètre générique.) Ajouter `export * from "./sync-plan";` à `packages/core/src/index.ts`.

- [ ] **Step 3: Lancer les tests**

Run: `bun test packages/core/src/sync-plan.test.ts`
Expected: PASS (dont 2 000 exécutions de la propriété). Un contre-exemple de fast-check est un bug de `projectLocal` ou de `settleAfterPush`, jamais du test : le corriger avant de continuer.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/sync-plan.ts packages/core/src/sync-plan.test.ts packages/core/src/index.ts
git commit -m "feat(core): fusion à trois de la sync"
```

---

### Task 6: Faux serveur GitHub

Serveur `Bun.serve` en mémoire qui imite les routes utilisées par Kibo, avec leurs formes exactes. Les requêtes GraphQL sont reconnues **octet pour octet** depuis `GITHUB_GRAPHQL` (Task 1) : une requête modifiée côté client sans le faux échoue en test.

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

- [ ] **Step 1: Test du faux (échoue)**

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

- [ ] **Step 2: Implémenter `fake-github.ts`**

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

- [ ] **Step 3: Implémenter `fake-github-graphql.ts`**

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

- [ ] **Step 4: Vérifier et commiter**

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

- [ ] **Step 1: Ajouter la dépendance**

Run: `cd packages/daemon && bun add --exact @modelcontextprotocol/sdk@1.30.1`
Puis : `bun pm untrusted` — Expected: aucune dépendance listée (aucun script de cycle de vie exécuté). Justification du commit : client MCP officiel, transports stdio et Streamable HTTP ; décision du chef d'équipe.

- [ ] **Step 2: Test (échoue)**

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

- [ ] **Step 3: Implémenter**

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

Si `registerTool`/`registerResource` de la 1.30.1 refusent les formes Zod 3 (`zod` 3.25.76 du dépôt), utiliser `import { z } from "zod/v4"` dans ce seul fichier (sous-chemin fourni par `zod` 3.25) et le noter dans le commit.

- [ ] **Step 4: Vérifier et commiter**

Run: `bun test packages/daemon/src/testing && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/package.json bun.lock packages/daemon/src/testing/fake-mcp.ts packages/daemon/src/testing/fake-mcp-stdio.ts packages/daemon/src/testing/fake-mcp.test.ts
git commit -m "build(daemon): SDK MCP et faux serveur MCP"
```

---

### Task 8: Réseau des intégrations

Un seul chemin sortant pour le démon et les composants : HTTPS, anti-SSRF, redirections contrôlées saut par saut, secret injecté **seulement** vers les hôtes autorisés, origines de test, observation des limites de débit GitHub.

**Files:**
- Create: `packages/daemon/src/integrations/net.ts`, `packages/daemon/src/integrations/net.test.ts`, `packages/daemon/src/integrations/rate-limit.ts`, `packages/daemon/src/integrations/rate-limit.test.ts`
- Modify: proxy `fetch` de la phase 4 (spec B §6.4 point 4 ; fichier noté au tableau des ancrages) et son test ; `packages/daemon/src/integrations/bootstrap.ts`

**Interfaces:**
- Consumes: `IntegrationFetch`, `InternalRule`, `SecretResolver`, `ComponentIntegrationHooks` (Task 2) ; `ComponentManifest.secrets` (Task 1) ; `FakeGithub` (Task 6, tests).
- Produces:
  - `type Resolver = (host: string) => Promise<string[]>` ; `systemResolver`
  - `parseTestOrigins(values: string[]): Map<string, URL>` (clé : hôte logique ; valeur : origine `http://127.0.0.1|localhost:<port>/`)
  - `isBlockedAddress(ip: string): boolean` ; `assertPublicHost(host, resolve): Promise<void>` (`PERMISSION_DENIED`)
  - `hostMatches(rule: InternalRule, host: string): boolean` ; `transportUrl(url: URL, aliases): { target: URL; aliased: boolean }`
  - `secretFor(url: URL, secrets: ComponentManifest["secrets"], covered: (url: URL) => boolean, resolve: SecretResolver): Promise<string | null>`
  - `createIntegrationFetch(deps: { aliases: Map<string, URL>; resolve?: Resolver; fetchImpl?: typeof fetch; observe?: (host: string, headers: Headers) => void }): IntegrationFetch`
  - `GITHUB_API = "api.github.com"`, `GITHUB_RULES: InternalRule[]` (API avec auth), `GITHUB_LOG_RULES: InternalRule[]` (API avec auth + suffixe `actions.githubusercontent.com` sans auth)
  - `scrubSecret(bytes: Uint8Array, secret: string): Uint8Array` (toute occurrence du secret injecté dans un corps de réponse devient `***`)
  - `type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null }` ; `createRateLimitGate(now): RateLimitGate` ; `GITHUB_RATE_FLOOR = 100`
  - `IntegrationKit.net: { fetch: IntegrationFetch; gate: RateLimitGate; aliases: Map<string, URL> }`

- [ ] **Step 1: Tests (échouent)**

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
```

`packages/daemon/src/integrations/net.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import {
  assertPublicHost,
  createIntegrationFetch,
  GITHUB_LOG_RULES,
  GITHUB_RULES,
  isBlockedAddress,
  parseTestOrigins,
  secretFor,
} from "./net";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
});
afterEach(() => gh.stop());

const aliases = () => parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]);

describe("addresses", () => {
  test("private, loopback, link-local and multicast are blocked", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.4.2", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
    for (const ip of ["140.82.112.5", "2606:50c0:8000::154"]) expect(isBlockedAddress(ip)).toBe(false);
  });
  test("a public name resolving to a private address is refused", async () => {
    await expect(assertPublicHost("api.github.com", async () => ["10.1.2.3"])).rejects.toThrow("PERMISSION_DENIED");
    await expect(assertPublicHost("api.github.com", async () => ["140.82.112.5"])).resolves.toBeUndefined();
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

Run: `bun test packages/daemon/src/integrations/net.test.ts packages/daemon/src/integrations/rate-limit.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implémenter `rate-limit.ts`**

```ts
export type RateLimitGate = { observe(headers: Headers): void; blockedUntil(): number | null };
export const GITHUB_RATE_FLOOR = 100;

export function createRateLimitGate(now: () => number): RateLimitGate {
  let until: number | null = null;
  return {
    observe(headers) {
      const retryAfter = Number(headers.get("retry-after"));
      if (headers.has("retry-after") && Number.isFinite(retryAfter)) {
        until = now() + retryAfter * 1000;
        return;
      }
      const remaining = Number(headers.get("x-ratelimit-remaining"));
      const reset = Number(headers.get("x-ratelimit-reset"));
      if (!headers.has("x-ratelimit-remaining") || !Number.isFinite(remaining)) return;
      if (remaining < GITHUB_RATE_FLOOR && Number.isFinite(reset)) until = reset * 1000;
      else if (remaining >= GITHUB_RATE_FLOOR) until = null;
    },
    blockedUntil: () => (until !== null && until > now() ? until : null),
  };
}
```

- [ ] **Step 3: Implémenter `net.ts`**

```ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { type ComponentManifest, KiboError } from "@kibo/schema";
import type { IntegrationFetch, InternalRule, SecretResolver } from "./types";

export type Resolver = (host: string) => Promise<string[]>;
export const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

export const GITHUB_API = "api.github.com";
export const GITHUB_RULES: InternalRule[] = [{ host: GITHUB_API, suffix: false, auth: true }];
export const GITHUB_LOG_RULES: InternalRule[] = [
  ...GITHUB_RULES,
  { host: "actions.githubusercontent.com", suffix: true, auth: false },
];

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const STRIPPED = ["cookie", "authorization", "host", "proxy-authorization", "proxy-connection"];
const MAX_HOPS = 3;

export function parseTestOrigins(values: string[]): Map<string, URL> {
  const out = new Map<string, URL>();
  for (const v of values) {
    const [host, origin, extra] = v.split("=");
    if (!host || !origin || extra !== undefined || !HOST.test(host)) throw new KiboError("INVALID_INPUT", `bad test origin ${v}`);
    const u = new URL(origin);
    if (u.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(u.hostname) || u.pathname !== "/" || u.search) {
      throw new KiboError("INVALID_INPUT", `test origin must be a loopback http origin: ${v}`);
    }
    out.set(host, u);
  }
  return out;
}

function v4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isBlockedAddress(ip: string): boolean {
  if (isIP(ip) === 4) return v4Blocked(ip);
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return v4Blocked(mapped[1]);
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower);
}

export async function assertPublicHost(host: string, resolve: Resolver): Promise<void> {
  const ips = isIP(host) ? [host] : await resolve(host);
  if (ips.length === 0 || ips.some(isBlockedAddress)) {
    throw new KiboError("PERMISSION_DENIED", `address of ${host} is not public`);
  }
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

async function readCapped(res: Response, max: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) return { bytes: Buffer.concat(chunks), truncated: false };
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel();
  return { bytes: Buffer.concat(chunks).subarray(0, max), truncated: true };
}

export function scrubSecret(bytes: Uint8Array, secret: string): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  return text.includes(secret) ? new TextEncoder().encode(text.split(secret).join("***")) : bytes;
}

export function createIntegrationFetch(deps: {
  aliases: Map<string, URL>;
  resolve?: Resolver;
  fetchImpl?: typeof fetch;
  observe?: (host: string, headers: Headers) => void;
}): IntegrationFetch {
  const resolve = deps.resolve ?? systemResolver;
  const doFetch = deps.fetchImpl ?? fetch;
  return async (url, init, rules) => {
    let current = new URL(url);
    const deadline = AbortSignal.timeout(init.timeoutMs ?? 15_000);
    const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (current.protocol !== "https:") throw new KiboError("PERMISSION_DENIED", `https only: ${current.origin}`);
      const rule = rules.find((r) => hostMatches(r, current.hostname));
      if (!rule) throw new KiboError("PERMISSION_DENIED", `host not allowed: ${current.hostname}`);
      const { target, aliased } = transportUrl(current, deps.aliases);
      if (!aliased) await assertPublicHost(current.hostname, resolve);
      const headers = new Headers(init.headers);
      for (const h of STRIPPED) headers.delete(h);
      if (rule.auth && init.bearer) headers.set("authorization", `Bearer ${init.bearer}`);
      headers.set("user-agent", "kibo");
      const res = await doFetch(target, {
        method: hop === 0 ? (init.method ?? "GET") : "GET",
        headers,
        body: hop === 0 ? init.body : undefined,
        redirect: "manual",
        signal,
      });
      deps.observe?.(current.hostname, res.headers);
      if (REDIRECTS.has(res.status)) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new KiboError("REMOTE_REJECTED", "redirect without location");
        current = new URL(location, current);
        continue;
      }
      const { bytes, truncated } = await readCapped(res, init.maxBytes ?? 5 * 1024 * 1024);
      const body = rule.auth && init.bearer ? scrubSecret(bytes, init.bearer) : bytes;
      return { status: res.status, headers: res.headers, body, truncated, url: current.toString() };
    }
    throw new KiboError("REMOTE_REJECTED", "too many redirects");
  };
}
```

- [ ] **Step 4: Proxy des composants (phase 4)**

Dans le proxy `fetch` de la phase 4, sans changer ses contrôles existants :
1. les options du proxy reçoivent `hooks: ComponentIntegrationHooks` et les permissions accordées gagnent `secrets` ;
2. avant chaque saut, `const { target, aliased } = transportUrl(url, hooks.aliases)` : les contrôles `net` et l'appartenance aux règles portent sur l'URL logique ; la requête part vers `target` ; le contrôle anti-SSRF est sauté **seulement** si `aliased` (possible uniquement avec `--test-origins`) ;
3. après le retrait des en-têtes interdits : `const bearer = await secretFor(url, granted.secrets, (u) => netCovers(granted.net, u), hooks.secret); if (bearer) headers.set("authorization", \`Bearer ${bearer}\`)` (recalculé à chaque saut : une redirection vers un autre hôte ne porte jamais le secret) ;
4. `hooks.observe(url.hostname, res.headers)` après chaque réponse ;
5. si un secret a été injecté, le corps rendu au composant passe par `scrubSecret(body, bearer)` : un service qui renvoie l'en-tête `Authorization` dans son corps (Review Focus 4) ne livre jamais la valeur au composant.

Ajouter au test du proxy de la phase 4 (même fichier, même harnais), avec le faux GitHub et `aliases = parseTestOrigins([\`api.github.com=${gh.url}\`])` :

```ts
test("a granted secret is injected for its host, never exposed to the component", async () => {
  const out = await callProxy({
    url: "https://api.github.com/user",
    init: { headers: { authorization: "Bearer forged" } },
    granted: { net: ["api.github.com"], secrets: [{ name: "github", hosts: ["api.github.com"] }] },
    hooks: { ...hooks, secret: async () => gh.token },
  });
  expect(out.status).toBe(200);
  expect(gh.requests.at(-1)?.auth).toBe(`Bearer ${gh.token}`);
  expect(JSON.stringify(out)).not.toContain(gh.token);
});

test("without the secrets grant, no credential is sent", async () => {
  const out = await callProxy({
    url: "https://api.github.com/user",
    init: {},
    granted: { net: ["api.github.com"], secrets: [] },
    hooks: { ...hooks, secret: async () => gh.token },
  });
  expect(out.status).toBe(401);
  expect(gh.requests.at(-1)?.auth).toBeNull();
});
```

(`callProxy` : l'aide d'appel existante du test de la phase 4 ; lui ajouter les champs `granted.secrets` et `hooks`.)

- [ ] **Step 5: Amorçage**

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

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/integrations/net.ts packages/daemon/src/integrations/net.test.ts packages/daemon/src/integrations/rate-limit.ts packages/daemon/src/integrations/rate-limit.test.ts packages/daemon/src/integrations/bootstrap.ts packages/daemon/src/components
git commit -m "feat(daemon): réseau sortant des intégrations"
```

(`packages/daemon/src/components` : dossier réel du proxy de la phase 4, à ajuster.)

---

### Task 9: SDK, `componentCall` et permissions

**Files:**
- Modify: `packages/schema/src/manifest.ts` (`BuiltinEntityType` gagne `"ci_run"`), union `ComponentCall` (phase 4, `schema`), `GrantedPermissions` (phase 4)
- Modify: `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/mock.ts`, `packages/sdk/src/conformance.tsx`, `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/source.ts`, `packages/sdk/src/mcp.test.ts`, `packages/sdk/src/source.test.ts`
- Modify: traitement `componentCall` du démon (phase 4) et son test ; `validateComponent` de `packages/devkit` (phase 4) : refuse `"{config.server}"` hors intégré
- Create: `packages/ui/src/lib/integration-permissions.ts`, `packages/ui/src/lib/integration-permissions.test.ts` ; Modify : liste des permissions de l'écran 30 (phase 4)

**Interfaces:**
- Consumes: `mcpCovered`, `secretHostsCovered`, `McpCallResult`, `McpImportItem`, `CiRun`, `InstanceSource` (Task 1) ; `ComponentIntegrationHooks`, `McpComponentGate` (Task 2) ; `ProjectBackend.call` (phase 4).
- Produces:
  - `ComponentCall` gagne `{ kind: "mcp.call"; server: string; tool: string; args: Record<string, unknown> }`, `{ kind: "mcp.read"; server: string; uri: string }`, `{ kind: "mcp.import"; server: string; item: McpImportItem }` ; `list` accepte `entity: "ci_run"`
  - `KiboSdk.mcp: { call(server: string, tool: string, args?: Record<string, unknown>): Promise<McpCallResult>; read(server: string, uri: string): Promise<McpCallResult>; importItem(server: string, item: McpImportItem): Promise<Ticket> }` ; `EntityMap.ci_run = CiRun`
  - `createMockSdk(manifest, { …, mcp?: Record<string, McpCallResult>, ciRuns?: CiRun[] })` ; `MockSdk.used.mcp: string[]` ; clés de `mcp` : `"server/tool"` ou `"server@uri"`
  - `readSource(config: Record<string, unknown>): InstanceSource | null` ; `matchesSource(ticket: TicketView, source: InstanceSource | null): boolean`
  - `GrantedPermissions` gagne `secrets` et `mcp` ; « nouvelles permissions » : `secret:<name>` et `mcp:<règle>`
  - `integrationPermissionLines(m: Pick<ComponentManifest, "secrets" | "mcp">): string[]`

- [ ] **Step 1: Tests SDK (échouent)**

`packages/sdk/src/mcp.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import type { ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";

const manifest: ComponentManifest = {
  id: "probe",
  version: "1.0.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket", "ci_run"],
  writes: ["ticket"],
  data: false,
  net: [],
  configVersion: 0,
  changes: [],
  sdk: 1,
  secrets: [],
  mcp: ["ctx"],
};
const ok = { content: [{ type: "text" as const, text: "hi" }], isError: false, truncated: false };

describe("sdk.mcp", () => {
  test("calls declared servers and records the usage", async () => {
    const m = createMockSdk(manifest, { mcp: { "ctx/echo": ok } });
    expect(await m.sdk.mcp.call("ctx", "echo", { text: "hi" })).toEqual(ok);
    expect(m.used.mcp).toEqual(["ctx/echo"]);
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

(Adapter l'objet `TicketView` aux champs réels si les phases 2 à 4 en ont ajouté.)

Run: `bun test packages/sdk` — Expected: FAIL.

- [ ] **Step 2: Schéma**

`BuiltinEntityType` : ajouter `"ci_run"`. Union `ComponentCall` : ajouter

```ts
  z.object({ kind: z.literal("mcp.call"), server: McpServerId, tool: z.string().min(1).max(128), args: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal("mcp.read"), server: McpServerId, uri: z.string().min(1).max(2048) }),
  z.object({ kind: z.literal("mcp.import"), server: McpServerId, item: McpImportItem }),
```

`GrantedPermissions` : ajouter `secrets: ComponentManifest["secrets"]` et `mcp: string[]` (défaut `[]` pour les versions déjà approuvées) ; la fonction de diff des permissions de la phase 4 produit en plus `secret:<name>` pour chaque secret et `mcp:<règle>` pour chaque règle absents de la version précédente.

- [ ] **Step 3: SDK**

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

`packages/sdk/src/sdk.ts` (dans `createSdk`, à côté de `list`/`run`) :

```ts
    mcp: {
      async call(server, tool, args = {}) {
        if (!mcpCovered(manifest.mcp, server, tool, ctx.config)) {
          throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare mcp ${server}/${tool}`);
        }
        return (await backend.call({ kind: "mcp.call", server, tool, args })) as McpCallResult;
      },
      async read(server, uri) {
        if (!mcpCovered(manifest.mcp, server, null, ctx.config)) {
          throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare mcp ${server}`);
        }
        return (await backend.call({ kind: "mcp.read", server, uri })) as McpCallResult;
      },
      async importItem(server, item) {
        if (!manifest.writes.includes("ticket") || !mcpCovered(manifest.mcp, server, null, ctx.config)) {
          throw new KiboError("PERMISSION_DENIED", `${manifest.id} cannot import from mcp ${server}`);
        }
        return (await backend.call({ kind: "mcp.import", server, item })) as Ticket;
      },
    },
```

(Transtypages : `backend.call` renvoie `unknown`, comme `run` depuis la v0.1 ; le démon a validé.) `list("ci_run")` suit le chemin de `list("note")` (phase 4) : contrôle `reads`, puis `backend.call({ kind: "list", entity: "ci_run" })`.

`packages/sdk/src/mock.ts` : options `mcp?: Record<string, McpCallResult>` et `ciRuns?: CiRun[]` ; `used.mcp: string[]` ; le backend simulé répond à `mcp.call` par `opts.mcp[\`${server}/${tool}\`]`, à `mcp.read` par `opts.mcp[\`${server}@${uri}\`]` (absent ⇒ `KiboError("MCP_FAILED", "no programmed response")`), à `mcp.import` par `executeProjectCommand(doc, { method: "importExternalTicket", title: item.title, ref: { kind: "mcp_item", server, itemId: item.itemId, url: item.url, title: item.title } })`, à `list ci_run` par `opts.ciRuns ?? []`. Les refus sont enregistrés `mcp <server>/<tool>` (ou `mcp <server>`) dans `violations`, les usages `<server>/<tool>` (ou `<server>`) dans `used.mcp`.

`packages/sdk/src/conformance.tsx` : deux vérifications de plus dans le `describe` existant :

```ts
    test("secrets are only requested for hosts covered by net", () => {
      expect(secretHostsCovered(ComponentManifest.parse(mod.manifest))).toEqual([]);
    });
```

et, dans le test de rendu, `for (const u of m.used.mcp) expect(mcpCovered(mod.manifest.mcp, u.split("/")[0] ?? "", u.split("/")[1] ?? null, m.sdk.config)).toBe(true);`.

`packages/sdk/src/index.ts` : `export * from "./source";`.

Run: `bun test packages/sdk` — Expected: PASS.

- [ ] **Step 4: Démon (`componentCall`)**

Dans le traitement `componentCall` de la phase 4 (spec B §6.4), après les contrôles 1 et 2 :
- contrôle 3 : `mcp.call` ⇒ `mcpCovered(rules, call.server, call.tool, config)`, `mcp.read` ⇒ `mcpCovered(rules, call.server, null, config)`, `mcp.import` ⇒ idem **et** `writes` contient `ticket` ; `rules` = `granted.mcp` et `config = null` pour un non-intégré, `manifest.mcp` et la config de l'instance pour un intégré ; `list ci_run` ⇒ `reads` contient `ci_run` ;
- exécution : `mcp.*` ⇒ `hooks.mcp` (`null` ⇒ `KiboError("MCP_UNAVAILABLE", "mcp hub not started")`) avec `{ projectId, instanceId }` ; `list ci_run` ⇒ `hooks.ciRuns` (`null` ⇒ `KiboError("NOT_CONNECTED", "ci not started")`).

Ajouter au test du `componentCall` de la phase 4 :

```ts
test("mcp calls follow the granted mcp rules of a sandboxed component", async () => {
  const calls: string[] = [];
  const hooks = {
    ...neutralHooks,
    mcp: {
      call: async (ctx: { instanceId: string }, server: string, tool: string) => {
        calls.push(`${ctx.instanceId} ${server}/${tool}`);
        return { content: [], isError: false, truncated: false };
      },
      read: async () => ({ content: [], isError: false, truncated: false }),
      importItem: async () => {
        throw new Error("unexpected");
      },
    },
  };
  const denied = await componentCall(sandboxed({ mcp: [] }), { kind: "mcp.call", server: "ctx", tool: "echo", args: {} }, hooks);
  expect(denied).toMatchObject({ ok: false, error: { code: "PERMISSION_DENIED" } });
  const granted = await componentCall(sandboxed({ mcp: ["ctx/echo"] }), { kind: "mcp.call", server: "ctx", tool: "echo", args: {} }, hooks);
  expect(granted.ok).toBe(true);
  expect(calls).toEqual([`${SANDBOXED_INSTANCE} ctx/echo`]);
  const placeholder = await componentCall(sandboxed({ mcp: ["{config.server}"] }, { server: "ctx" }), { kind: "mcp.read", server: "ctx", uri: "x" }, hooks);
  expect(placeholder).toMatchObject({ ok: false, error: { code: "PERMISSION_DENIED" } });
});
```

(`componentCall`, `sandboxed(granted, config?)`, `SANDBOXED_INSTANCE`, `neutralHooks` : aides du harnais de test de la phase 4, à compléter avec `mcp` dans les permissions accordées et `hooks` en paramètre.)

`validateComponent` (devkit, phase 4) : un manifeste non intégré qui contient `"{config.server}"` échoue (`VALIDATION_FAILED`, « {config.server} est réservé aux composants intégrés »), avec son test de fixture.

- [ ] **Step 5: Écran 30**

`packages/ui/src/lib/integration-permissions.test.ts` :

```ts
import { expect, test } from "bun:test";
import { integrationPermissionLines } from "./integration-permissions";

test("secrets and mcp rules read in plain French", () => {
  expect(
    integrationPermissionLines({
      secrets: [{ name: "github", hosts: ["api.github.com"] }],
      mcp: ["context7", "context7/get-library-docs", "{config.server}"],
    }),
  ).toEqual([
    "Utiliser ton compte GitHub (api.github.com)",
    "Appeler le serveur MCP context7",
    "Appeler l'outil get-library-docs du serveur MCP context7",
    "Appeler le serveur MCP choisi à l'ajout",
  ]);
});
```

`packages/ui/src/lib/integration-permissions.ts` :

```ts
import type { ComponentManifest } from "@kibo/schema";
import { CONFIG_SERVER_RULE } from "@kibo/schema";
import { fr } from "../i18n/fr";

export function integrationPermissionLines(m: Pick<ComponentManifest, "secrets" | "mcp">): string[] {
  const p = fr.integrations.permissions;
  return [
    ...m.secrets.map((s) => p.secret(s.name, s.hosts)),
    ...m.mcp.map((rule) => (rule === CONFIG_SERVER_RULE ? p.mcpFromConfig : p.mcp(rule))),
  ];
}
```

La liste des permissions de l'écran 30 (phase 4) ajoute ces lignes après les siennes, avec l'icône `KeyRound` pour un secret et `Plug` pour MCP ; « Aucun accès réseau, aucun fichier local » ne s'affiche plus si `secrets` ou `mcp` est non vide.

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/schema/src packages/sdk/src packages/daemon/src packages/devkit/src packages/ui/src/lib/integration-permissions.ts packages/ui/src/lib/integration-permissions.test.ts packages/ui/src/components
git commit -m "feat(sdk): appels MCP et entité ci_run"
```

(Ajuster le dernier chemin au fichier réel de l'écran 30.)

---

### Task 10: Écran 16 · Intégrations

Référence : page PDF 26 (sombre et clair) et maquette P1 (états). Une ligne par intégration, dans l'ordre de `IntegrationId`.

**Files:**
- Create: `packages/ui/src/state/use-integrations.ts`, `packages/ui/src/state/use-sync-state.ts`, `packages/sdk/src/ui/switch.tsx`, `packages/ui/src/settings/integration-rows.ts`, `packages/ui/src/settings/integration-rows.test.ts`, `packages/ui/src/settings/IntegrationRow.tsx`, `packages/ui/src/settings/IntegrationsPage.tsx`, `packages/ui/src/settings/IntegrationsPage.test.tsx`, `packages/ui/src/settings/DisconnectDialog.tsx`, `packages/ui/src/settings/integration-dialogs.ts`
- Modify: navigation des Paramètres (phase 2) : entrée « Intégrations » (icône `Plug`) après « Domaines & guidelines » ; `packages/sdk/src/client.ts` si l'abonnement générique aux événements n'existe pas encore

**Interfaces:**
- Consumes: `IntegrationStatus`, `IntegrationEvent`, RPC `listIntegrations`, `testIntegration`, `disconnectIntegration`, `getGithubConnectOptions` (Task 1) ; `frIntegrations` (Task 1).
- Produces:
  - `useIntegrations(): { statuses: IntegrationStatus[]; error: KiboError | null; loading: boolean; reload(): Promise<void> }`
  - `type RowView = { id: IntegrationId; icon: LucideIcon; title: string; description: string; badge: { tone: "ok" | "warn" | "error"; label: string } | null; action: "connect" | "retry" | null; menu: RowMenuItem[]; error: string | null }`, `type RowMenuItem = "configure" | "test" | "disconnect"`
  - `integrationRow(s: IntegrationStatus, opts: { hasDialog(id: IntegrationId): boolean; time(ms: number): string }): RowView`
  - `type IntegrationDialogId = "github" | "figma" | "mcp"` ; `type IntegrationDialogProps = { open: boolean; onOpenChange(open: boolean): void; onDone(): void }` ; `INTEGRATION_DIALOGS: Partial<Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>>` (rempli par la Task 11) ; `dialogOf(id: IntegrationId): IntegrationDialogId | null`
  - `client.onEvent(listener: (event: unknown) => void): () => void` (si absent)
  - `IntegrationsPage()`
  - `useSyncState(projectId: string): { state: SyncState | null; error: string | null; reload(): Promise<void> }` (utilisé par les Tasks 18 et 21)
  - `Switch` (`@kibo/sdk/ui/switch`, utilisé par les Tasks 11 et 18)

- [ ] **Step 1: Test du modèle de ligne (échoue)**

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

- [ ] **Step 2: Implémenter le modèle et le registre**

`packages/ui/src/settings/integration-dialogs.ts` :

```ts
import type { IntegrationId } from "@kibo/schema";
import type { ComponentType } from "react";

export type IntegrationDialogId = "github" | "figma" | "mcp";
export type IntegrationDialogProps = { open: boolean; onOpenChange(open: boolean): void; onDone(): void };
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

- [ ] **Step 3: Test de la page (échoue)**

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
    onEvent: () => () => undefined,
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

- [ ] **Step 4: Implémenter hook, ligne, dialogue de déconnexion, page**

`packages/ui/src/state/use-integrations.ts` :

```ts
import { IntegrationEvent, type IntegrationStatus, KiboError } from "@kibo/schema";
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
    return client.onEvent((raw) => {
      const e = IntegrationEvent.safeParse(raw);
      if (e.success && e.data.type === "integrations") void reload();
    });
  }, [reload]);
  return { statuses, error, loading, reload };
}
```

Si `client.onEvent` n'existe pas encore (phase 3), l'ajouter à `packages/sdk/src/client.ts` : un second ensemble d'écouteurs qui reçoit chaque message WebSocket après `JSON.parse`, avec reconnexion partagée ; son test dans `client.test.ts` (un faux `WebSocket` global qui émet `{"type":"integrations"}` ⇒ l'écouteur le reçoit).

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

`packages/ui/src/settings/IntegrationsPage.tsx` :

```tsx
import { type IntegrationId, KiboError } from "@kibo/schema";
import { toast } from "sonner";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useIntegrations } from "../state/use-integrations";
import { DisconnectDialog, type DisconnectTarget, disconnectable } from "./DisconnectDialog";
import { dialogOf, INTEGRATION_DIALOGS, type IntegrationDialogId } from "./integration-dialogs";
import { IntegrationRow } from "./IntegrationRow";
import { integrationRow, type RowMenuItem } from "./integration-rows";

const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const hasDialog = (id: IntegrationId) => {
  const d = dialogOf(id);
  return d !== null && INTEGRATION_DIALOGS[d] !== undefined;
};
const message = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));

export function IntegrationsPage() {
  const t = fr.integrations;
  const { statuses, error, reload } = useIntegrations();
  const [dialog, setDialog] = useState<IntegrationDialogId | null>(null);
  const [disconnect, setDisconnect] = useState<DisconnectTarget | null>(null);
  const keychainDown =
    error?.code === "SECRET_STORE_UNAVAILABLE" || statuses.some((s) => s.error?.code === "SECRET_STORE_UNAVAILABLE");

  const test = async (id: IntegrationId) => {
    try {
      const s = await client.rpc({ method: "testIntegration", id });
      if (s.state === "error") toast.error(s.error?.message ?? t.state.error);
      else toast.success(t.menu.tested);
    } catch (e) {
      toast.error(message(e));
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
      toast.error(message(e));
    }
  };
  const confirmDisconnect = async (id: "github" | "figma") => {
    setDisconnect(null);
    try {
      await client.rpc({ method: "disconnectIntegration", id });
    } catch (e) {
      toast.error(message(e));
    }
    await reload();
  };
  const Dialog = dialog ? INTEGRATION_DIALOGS[dialog] : undefined;

  return (
    <section className="grid max-w-3xl gap-6 p-8">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>
      {keychainDown && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {t.keychainUnavailable}
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
          onDone={() => {
            setDialog(null);
            void reload();
          }}
        />
      )}
      <DisconnectDialog target={disconnect} onCancel={() => setDisconnect(null)} onConfirm={(id) => void confirmDisconnect(id)} />
    </section>
  );
}
```

Le texte de déconnexion de GitHub dépend du mode (`getGithubConnectOptions().mode`, lu à l'ouverture de la confirmation) : en mode `gh`, aucun jeton n'est dans le trousseau.

Ajouter l'entrée « Intégrations » à la navigation des Paramètres de la phase 2, qui rend `IntegrationsPage`, et le `<Toaster />` de `@kibo/sdk/ui/sonner` s'il n'est pas déjà monté dans le shell.

- [ ] **Step 5: `Switch` shadcn et `useSyncState`**

`packages/sdk/src/ui/switch.tsx` : composant `Switch` de shadcn/ui (variante new-york, `import { Switch as SwitchPrimitive } from "radix-ui"`), tel que généré par `bunx shadcn@latest add switch`, avec le même import `cn` que les fichiers voisins (`import { cn } from "cn"`). Aucune dépendance nouvelle. Livré ici pour que les Tasks 11 et 18 (vague 2) le consomment sans dépendre l'une de l'autre.

`packages/ui/src/state/use-sync-state.ts` (état de sync d'un projet, rechargé sur les événements `sync` et `integrations`) :

```ts
import { IntegrationEvent, type SyncState } from "@kibo/schema";
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
    return client.onEvent((raw) => {
      const e = IntegrationEvent.safeParse(raw);
      if (e.success && (e.data.type === "integrations" || (e.data.type === "sync" && e.data.projectId === projectId))) void reload();
    });
  }, [projectId, reload]);
  return { state, error, reload };
}
```

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel : `bun run --cwd e2e test` n'est pas encore concerné ; ouvrir Paramètres › Intégrations avec le démon de dev en sombre puis en clair et comparer à la page PDF 26 (espacements, pastilles, bouton « Connecter » de Figma).

```bash
git add packages/ui/src/state/use-integrations.ts packages/ui/src/state/use-sync-state.ts packages/sdk/src/ui/switch.tsx packages/ui/src/settings packages/sdk/src/client.ts packages/sdk/src/client.test.ts
git commit -m "feat(ui): écran des intégrations"
```

---

### Task 11: Dialogues de connexion

Référence : maquettes P2 (GitHub), P3 (Figma), P4 (liste des serveurs MCP), P5 (ajout d'un serveur MCP), sombre et clair.

**Files:**
- Create: `packages/ui/src/dialogs/integrations/{GithubConnectDialog.tsx,FigmaConnectDialog.tsx,McpServersDialog.tsx,McpServerDialog.tsx,mcp-form.ts,mcp-form.test.ts,integration-dialogs.test.tsx}`
- Modify: `packages/ui/src/settings/integration-dialogs.ts` (enregistre les trois dialogues)

**Interfaces:**
- Consumes: `IntegrationDialogProps`, `INTEGRATION_DIALOGS` (Task 10) ; RPC `getGithubConnectOptions`, `connectGithub`, `configureFigma`, `listMcpServers`, `previewMcpServer`, `addMcpServer`, `removeMcpServer`, `setMcpServerEnabled` (Task 1) ; `ChoiceCard` (v0.1).
- Produces: `GithubConnectDialog`, `FigmaConnectDialog`, `McpServersDialog` (props `IntegrationDialogProps`) ; `McpServerDialog({ open, onOpenChange, onAdded, takenIds })` ; `type McpForm` et `toServerInput(form: McpForm): { server: McpServerInput; secrets: Record<string, string> } | { error: string }` ; `slugId(name: string): string`. Consomme `Switch` (Task 10).

- [ ] **Step 1: Test du formulaire MCP (échoue)**

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

- [ ] **Step 2: Implémenter `mcp-form.ts`**

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
    .replace(/[̀-ͯ]/g, "")
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

- [ ] **Step 3: Test des dialogues (échoue)**

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
  const onDone = mock(() => {});
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(await screen.findByText("gh est connecté (adam).")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({ method: "connectGithub", auth: { mode: "gh" } });
  expect(onDone).toHaveBeenCalled();
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

- [ ] **Step 4: Dialogue GitHub**

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
import { toast } from "sonner";
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
      toast.success(t.connected(login));
      onDone();
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

- [ ] **Step 5: Dialogue Figma**

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

- [ ] **Step 6: Dialogues MCP**

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

`packages/ui/src/dialogs/integrations/McpServersDialog.tsx` : `Dialog` (titre `mcpServers.title`, description `mcpServers.subtitle`) qui charge `listMcpServers` à l'ouverture ; une ligne par serveur : nom, `id` en monospace, badge `stdio`/`HTTP`, `tools(n)`, pastille d'état (vert `connected`, gris `idle`, rouge `error` + message), `Switch` « Activé » (`setMcpServerEnabled`, `aria-label` = `${enabled} ${name}`), bouton « Retirer » qui ouvre une confirmation (`removeConfirm(name)`, Annuler / Retirer destructif) puis `removeMcpServer` ; état vide `mcpServers.empty` ; bouton « Ajouter un serveur » qui ouvre `McpServerDialog` (`takenIds` = ids listés) et recharge la liste à `onAdded`. Toute erreur RPC s'affiche dans un `role="alert"` de la ligne concernée. `onDone` est appelé à la fermeture pour rafraîchir l'écran 16.

- [ ] **Step 7: Enregistrer les dialogues**

`packages/ui/src/settings/integration-dialogs.ts` :

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

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Comparer chaque dialogue à P2 à P5 en sombre et en clair.

```bash
git add packages/ui/src/dialogs/integrations packages/ui/src/settings/integration-dialogs.ts
git commit -m "feat(ui): dialogues de connexion"
```

---

### Task 12: Compte GitHub

**Files:**
- Create: `packages/daemon/src/github/api.ts`, `packages/daemon/src/github/auth.ts`, `packages/daemon/src/github/handlers.ts`, `packages/daemon/src/github/github.test.ts`
- Modify: `packages/daemon/package.json` (`"zod": "3.25.76"`, version déjà verrouillée), `packages/daemon/src/integrations/bootstrap.ts`

**Interfaces:**
- Consumes: `IntegrationKit` (`settings`, `secrets`, `redactor`, `net`, `host.gh`), `IntegrationProbe`, `githubRepoOf` (Tasks 2, 8) ; `GITHUB_GRAPHQL`, `GithubConnectOptions`, `GithubRepo`, `GithubProject` (Task 1) ; faux GitHub (Task 6).
- Produces:
  - `type GithubApi = { rest<T>(method: "GET" | "POST" | "PATCH", path: string, schema: ZodType<T, ZodTypeDef, unknown>, body?: unknown): Promise<T>; raw(path: string, rules: InternalRule[], maxBytes: number): Promise<IntegrationResponse>; graphql<T>(query: string, variables: Record<string, unknown>, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T>; paginate<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>, maxPages: number): Promise<T[]> }`
  - `createGithubApi(deps: { fetch: IntegrationFetch; token(): Promise<string | null>; gate: RateLimitGate }): GithubApi`
  - `type GithubAccount = GithubCredentials & { options(): Promise<GithubConnectOptions>; connect(auth: { mode: "gh" } | { mode: "token"; token: string }): Promise<{ login: string }>; disconnect(): Promise<void>; verify(): Promise<string> }`
  - `createGithubAccount(deps: { settings: Settings; secrets: SecretStore; redactor: Redactor; gh: GhRunner; fetch: IntegrationFetch; now(): number }): GithubAccount`
  - `githubModule(kit: IntegrationKit, github: { account: GithubAccount; api: GithubApi }): IntegrationModule` (handlers `getGithubConnectOptions`, `connectGithub`, `listGithubRepos`, `listGithubProjects` ; sondes `github`, `github-issues`, `github-actions`)
  - `IntegrationKit.github: { account: GithubAccount; api: GithubApi }` ; `kit.hooks.secret` résout `github` par le compte (gh ou jeton)

- [ ] **Step 1: Tests (échouent)**

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

- [ ] **Step 2: Implémenter `api.ts`**

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

- [ ] **Step 3: Implémenter `auth.ts`**

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
    const r = await deps.gh(["auth", "token"]);
    const token = r.code === 0 ? r.stdout.trim() : "";
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

- [ ] **Step 4: Implémenter `handlers.ts`**

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

- [ ] **Step 5: Amorçage**

`packages/daemon/src/integrations/bootstrap.ts` : `IntegrationKit` gagne `github: { account: GithubAccount; api: GithubApi }`. Les dépendances sont créées en variables locales **avant** le `kit` (aucun champ optionnel, aucune affectation après coup) :

```ts
  const settings = createSettings(host.db);
  const account = createGithubAccount({ settings, secrets, redactor, gh: host.gh, fetch: net.fetch, now: host.now });
  const github = { account, api: createGithubApi({ fetch: net.fetch, token: () => account.token(), gate: net.gate }) };
  const secret: SecretResolver = (name) => (name === "github" ? account.token() : secrets.get(name));
```

puis `settings`, `github` et `hooks: { aliases: net.aliases, observe, secret, mcp: null, ciRuns: null }` dans le `kit`, et `githubModule(kit, kit.github)` dans `modules`.

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/package.json bun.lock packages/daemon/src/github packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): compte GitHub"
```

---

### Task 13: Adaptateur GitHub Issues (composant intégré)

Composant sans UI (`kind: "adapter"`), écrit avec le SDK public : il traduit, il ne lit ni n'écrit aucun ticket. Tout objet distant est validé par Zod avant usage.

**Files:**
- Create: `components/github-issues/kibo.component.json`, `components/github-issues/package.json`, `components/github-issues/tsconfig.json`
- Create: `components/github-issues/src/{remote.ts,map.ts,cursor.ts,rest.ts,project.ts,adapter.ts,server.ts,index.ts}`, `components/github-issues/src/{map.test.ts,adapter.test.ts}`
- Modify: `package.json` racine (script `typecheck` : `components/github-issues`), `BUILTIN_IDS` (phase 4, `schema`) : ajouter `"github-issues"`

**Interfaces:**
- Consumes: `defineAdapter`, `adapterActions`, `AdapterContext` (Task 1) ; `defineServer` (`@kibo/sdk/server`, phase 4) ; `GITHUB_GRAPHQL`, `githubError`, `remoteStatusId`, `BindingConfig`, `GithubIssueRef`, `PushOp` (Task 1).
- Produces:
  - `GhIssue` (Zod) = `{ nodeId; number; title; body; closed; updatedAt; url (https); repo; labels: string[]; optionId: string | null }`
  - `githubIssuesAdapter: Adapter<GhIssue, BindingConfig>` ; `server = defineServer({ actions: adapterActions(githubIssuesAdapter) })` (actions `adapter.pull`, `adapter.push`)
  - curseur opaque : `{"mode":"rest","since":…,"page":n}` ou `{"mode":"project","since":…,"after":…,"max":…}`
  - issues créées : titre, corps, **libellés du filtre de la liaison** (pour rester dans son périmètre), puis fermeture si `closed`, puis ajout au Project et statut si la correspondance existe

- [ ] **Step 1: Paquet**

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

`components/github-issues/tsconfig.json` : comme `components/kanban/tsconfig.json`, avec `"lib": ["ES2022"]` (pas de DOM), `include: ["src", "kibo.component.json"]`.

- [ ] **Step 2: Test du mapping (échoue)**

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

- [ ] **Step 3: `remote.ts`, `map.ts`, `cursor.ts`**

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

- [ ] **Step 4: Test de l'adaptateur (échoue)**

`components/github-issues/src/adapter.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { type BindingConfig, GITHUB_GRAPHQL } from "@kibo/schema";
import { adapterActions } from "@kibo/sdk";
import { githubIssuesAdapter } from "./adapter";

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

- [ ] **Step 5: `rest.ts` et `project.ts`**

`components/github-issues/src/rest.ts` :

```ts
import { type BindingConfig, githubError, KiboError } from "@kibo/schema";
import type { AdapterContext } from "@kibo/sdk";
import type { ZodType, ZodTypeDef } from "zod";
import { z } from "zod";

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

(Les en-têtes renvoyés par `sdk.fetch` ont des noms en minuscules, comme le proxy de la phase 4 les produit ; sinon, normaliser ici.)

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

- [ ] **Step 6: `adapter.ts`, `server.ts`, `index.ts`**

`components/github-issues/src/adapter.ts` :

```ts
import { BindingConfig, GITHUB_GRAPHQL, KiboError, type PushOp, type SyncedFields } from "@kibo/schema";
import { defineAdapter } from "@kibo/sdk";
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
import { adapterActions } from "@kibo/sdk";
import { defineServer } from "@kibo/sdk/server";
import { githubIssuesAdapter } from "./adapter";

export const server = defineServer({ actions: adapterActions(githubIssuesAdapter) });
```

(Suivre la convention d'export du `server.ts` fixée par la phase 4 si elle diffère de l'export nommé `server`.)

`components/github-issues/src/index.ts` :

```ts
import { ComponentManifest } from "@kibo/schema";
import manifestJson from "../kibo.component.json";

export const manifest = ComponentManifest.parse(manifestJson);
export { githubIssuesAdapter } from "./adapter";
```

- [ ] **Step 7: Vérifier et commiter**

Ajouter `components/github-issues` au script `typecheck` racine et `"github-issues"` à `BUILTIN_IDS`.

Run: `bun install && bun test components/github-issues && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add components/github-issues package.json bun.lock packages/schema/src
git commit -m "feat(components): adaptateur GitHub Issues"
```

---

### Task 14: Moteur de sync

Boîte d'envoi transactionnelle, pull paginé, fusion à trois, anti-écho, reprises. Le moteur ne connaît l'adaptateur qu'à travers `AdapterRunner` : ses tests utilisent un distant en mémoire ; l'aller-retour réel contre le faux GitHub est la Task 19.

**Files:**
- Create: `packages/daemon/src/sync/{hash.ts,sync-store.ts,outbox.ts,apply.ts,engine.ts,scheduler.ts,module.ts}`
- Test: `packages/daemon/src/sync/{sync-store.test.ts,engine.test.ts}`, `packages/daemon/src/sync/testing/memory-runner.ts`

**Interfaces:**
- Consumes: `IntegrationHost` (`command`, `onCommand`, `intercept`, `transaction`, `snapshot`, `broadcast`), `AdapterRunner`, `EventLog`, `RateLimitGate`, `IntegrationKit.net.gate` (Tasks 2, 8) ; `projectLocal`, `planSync`, `settleAfterPush`, `canonicalFields`, `normalizeText` (Task 5) ; commandes `importExternalTicket`, `upsertExternalRef`, `addBinding`, `removeBinding`, `ProjectSnapshot.bindings` (Task 4) ; `InstanceSource`, `SyncState`, `SyncReport`, `MappedRemote` (Task 1).
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

- [ ] **Step 1: Distant en mémoire pour les tests**

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

- [ ] **Step 2: Tests du moteur (échouent)**

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
    await cycle();
    expect(tickets().map((t) => t.title)).toEqual(["Incertaine"]);
    host.clock.now += 5_000;
    await cycle();
    await cycle();
    expect(tickets().map((t) => t.title).sort()).toEqual(["Incertaine", "Venue d'ailleurs"]);
    expect(remote.pushes.filter((p) => p.kind === "create").at(-1)).toMatchObject({ since: expect.any(String) });
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

Supprimer un ticket lié ne touche jamais l'issue (spec F §5) ; la ligne `sync_items` reste avec `ticket_id = ""` (constante `IGNORED`) pour que le pull ne réimporte pas l'issue. Une issue rompue (404) suit la même règle.

Run: `bun test packages/daemon/src/sync` — Expected: FAIL.

- [ ] **Step 3: `hash.ts` et `sync-store.ts`**

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
    itemByTicket: db.query("SELECT * FROM sync_items WHERE binding_id = $b AND ticket_id = $t"),
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

- [ ] **Step 4: `outbox.ts` (intercepteur et observateur)**

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

- [ ] **Step 5: `apply.ts`**

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

- [ ] **Step 6: `engine.ts`**

```ts
import { planSync, projectLocal, SYNCED_FIELDS, settleAfterPush } from "@kibo/core";
import { type Binding, KiboError, type SyncReport, type SyncState, type TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { RateLimitGate } from "../integrations/rate-limit";
import type { AdapterRunner, IntegrationHost } from "../integrations/types";
import { applyPlan, applyRemote, SYNC, statusMapOf } from "./apply";
import { fieldsHash } from "./hash";
import type { OutboxRow, SyncStore } from "./sync-store";

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
      host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
      store.upsertItem({ bindingId: b.id, remoteId: m.remoteId, ticketId: ticket.id, base: m.fields, remoteUpdatedAt: m.updatedAt, lastPushedHash: fieldsHash(m.fields) });
      store.deleteOutbox(row.id);
      const fresh = ticketOf(projectId, ticket.id);
      if (fresh && JSON.stringify(projectLocal(fresh, m.fields, statusMapOf(b))) !== JSON.stringify(m.fields)) {
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
      store.saveCursor({ ...prev, cursor, imported });
      host.broadcast({ type: "sync", projectId, bindingId: b.id, imported, running: true });
      if (!res.more) break;
    }
    store.saveCursor({ ...prev, cursor, imported, lastPullAt: host.now(), lastError: null });
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

- [ ] **Step 7: `scheduler.ts` et `module.ts`**

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

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/daemon/src/sync && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/sync
git commit -m "feat(daemon): moteur de sync et boîte d'envoi"
```

---

### Task 15: Hub MCP

Un client MCP par serveur configuré, ouvert à la demande et fermé après 10 min d'inactivité. La configuration vit dans SQLite (`mcp_servers`), jamais dans le CRDT ; les secrets dans le trousseau. Le transport stdio est écrit sur `Bun.spawn` : celui du SDK ajoute `LOGNAME`, `SHELL`, `TERM` et `USER` à l'environnement, ce que la spec F §8.1 interdit.

**Files:**
- Create: `packages/daemon/src/mcp/{config-store.ts,command-line.ts,stdio-transport.ts,result.ts,connection.ts,hub.ts,component-gate.ts,module.ts}`
- Test: `packages/daemon/src/mcp/{command-line.test.ts,result.test.ts,hub.test.ts,component-gate.test.ts}`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (hub créé avant le `kit`, `hooks.mcp`, module)

**Interfaces:**
- Consumes: `McpServerInput`, `McpServerView`, `McpToolInfo`, `McpCallResult`, `McpImportItem`, `RESERVED_MCP_IDS`, RPC `listMcpServers`, `previewMcpServer`, `addMcpServer`, `removeMcpServer`, `setMcpServerEnabled`, `testMcpServer` (Task 1) ; `IntegrationHost`, `SecretStore`, `EventLog`, `McpComponentGate`, `IntegrationKit`, `baseStatus` (Task 2) ; `assertPublicHost`, `systemResolver` (Task 8) ; faux MCP (Task 7).
- Produces:
  - `commandLineOf(s: McpServerInput): string` ; `shellQuote(arg: string): string`
  - `toCallResult(raw: unknown, maxBytes?: number): McpCallResult` ; `toReadResult(raw: unknown, maxBytes?: number): McpCallResult` ; `MCP_MAX_RESULT_BYTES = 1_048_576`
  - `type McpHub = { views(): Promise<McpServerView[]>; add(input: McpServerInput, confirmedCommandLine: string, secrets: Record<string, string>): Promise<McpServerView>; remove(id: string): Promise<void>; setEnabled(id: string, enabled: boolean): Promise<McpServerView>; test(id: string): Promise<McpServerView>; tools(id: string): Promise<McpToolInfo[]>; call(id: string, tool: string, args: Record<string, unknown>, instanceId: string | null): Promise<McpCallResult>; read(id: string, uri: string, instanceId: string | null): Promise<McpCallResult>; setReserved(id: "figma", url: string | null): Promise<void>; stop(): Promise<void> }`
  - `createMcpHub(deps: { host: IntegrationHost; secrets: SecretStore; events: EventLog; redact(text: string): string; idleMs?: number; callTimeoutMs?: number; resolve?: Resolver }): McpHub` (les messages d'erreur rendus dans `McpServerView.error` sont caviardés)
  - `createMcpGate(hub: McpHub, host: IntegrationHost): McpComponentGate` (serveurs réservés refusés)
  - `mcpModule(kit: IntegrationKit, hub: McpHub): IntegrationModule` (handlers MCP, sonde `mcp`)
  - secrets : `mcp:<id>:<VAR>` (stdio), `mcp:<id>` (jeton HTTP) ; clé `"bearer"` dans `addMcpServer.secrets` pour le jeton HTTP

- [ ] **Step 1: Tests purs (échouent)**

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

Run: `bun test packages/daemon/src/mcp` — Expected: FAIL (modules absents).

- [ ] **Step 2: `command-line.ts` et `result.ts`**

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

Run: `bun test packages/daemon/src/mcp/command-line.test.ts packages/daemon/src/mcp/result.test.ts` — Expected: PASS.

- [ ] **Step 3: Test du hub (échoue)**

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

- [ ] **Step 4: `config-store.ts` et `stdio-transport.ts`**

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

type Options = { cmd: string[]; env: Record<string, string>; cwd: string };
const spawnServer = (o: Options) =>
  Bun.spawn(o.cmd, { env: o.env, cwd: o.cwd, stdin: "pipe", stdout: "pipe", stderr: "inherit" });
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

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
    this.proc?.kill();
    this.proc = null;
  }
}
```

- [ ] **Step 5: `connection.ts`**

```ts
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KiboError, type McpServerInput, type McpToolInfo, type SecretName } from "@kibo/schema";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { assertPublicHost, type Resolver } from "../integrations/net";
import type { SecretResolver } from "../integrations/types";
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
  return new BunStdioTransport({ cmd: [s.command, ...s.args], env, cwd });
}

async function httpTransport(s: Extract<McpServerInput, { transport: "http" }>, deps: Deps): Promise<Transport> {
  const url = new URL(s.url);
  if (!LOOPBACK.has(url.hostname)) await assertPublicHost(url.hostname, deps.resolve);
  const headers: Record<string, string> = s.bearer ? { authorization: `Bearer ${await secretOrFail(deps, `mcp:${s.id}`)}` } : {};
  return new StreamableHTTPClientTransport(url, { requestInit: { headers } });
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

(`mcp:${s.id}:${name}` satisfait le type gabarit `SecretName`. `initialize`, `tools/list` et `resources/list` sont faits une fois par connexion et gardés tant qu'elle vit (spec F §8.1).)

- [ ] **Step 6: `hub.ts`**

```ts
import { rmSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type McpCallResult, type McpServerInput, type McpServerView, type McpToolInfo } from "@kibo/schema";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EventLog } from "../integrations/events";
import { type Resolver, systemResolver } from "../integrations/net";
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

const REQUEST_TIMEOUT = -32001;
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
      if (e instanceof McpError && e.code === REQUEST_TIMEOUT) throw new KiboError("TIMEOUT", `${id}/${tool} timed out`);
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
- `McpError` et le code `-32001` (`ErrorCode.RequestTimeout`) viennent du SDK ; importer `ErrorCode` et écrire `ErrorCode.RequestTimeout` si l'énumération est exportée dans la 1.30.1, au lieu de la constante.

- [ ] **Step 7: `component-gate.ts` et `module.ts`**

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

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/daemon/src/mcp && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/mcp packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): hub MCP"
```

---

### Task 16: GitHub Actions (C1)

Sondeur des runs des PR liées aux tickets, logs téléchargés à la demande, entité SDK `ci_run`, événement `ci.failed` une seule fois par run.

**Files:**
- Create: `packages/daemon/src/ci/{ci-store.ts,poller.ts,logs.ts,module.ts}`
- Test: `packages/daemon/src/ci/{poller.test.ts,logs.test.ts}`
- Modify: `packages/daemon/src/integrations/bootstrap.ts` (sondeur créé avant le `kit`, `hooks.ciRuns`, module) ; règles par défaut de la phase 2 (fichier des règles déclaratives, voir « Points d'ancrage ») : règle `ci.failed ⇒ notification « CI cassée sur KIB-n »`

**Interfaces:**
- Consumes: `CiRun`, `CiJobSummary`, `CiLog`, `githubError`, `RepoSlug`, RPC `listCiRuns`, `getCiLog` (Task 1) ; `IntegrationHost` (`ruleEvent`, `broadcast`, `home`), `EventLog`, `githubRepoOf`, `IntegrationKit` (Task 2) ; `GITHUB_LOG_RULES` (Task 8) ; `GithubApi` (Task 12) ; faux GitHub (Task 6) ; réf. `github_pr` `{ kind, url, number, state }` (phase 3).
- Produces:
  - `createCiStore(db): CiStore` ; `type CiStore = { upsertRun(r: StoredRun): "new" | "changed" | "same"; upsertJobs(runId: number, jobs: CiJobSummary[]): void; runsOf(projectId: string, prNumbers: number[] | null): StoredRun[]; jobsOf(runId: number): CiJobSummary[]; markNotified(repo: string, runId: number): void; job(projectId: string, runId: number, jobId: number): { repo: RepoSlug; completed: boolean; logPath: string | null } | null; setLog(jobId: number, path: string | null, at: number | null): void; staleLogs(before: number): { jobId: number; path: string }[] }`
  - `type StoredRun = Omit<CiRun, "ticketKey" | "jobs"> & { projectId: string; notified: boolean }`
  - `createCiPoller(deps: { host: IntegrationHost; api: GithubApi; store: CiStore; events: EventLog; connected(): boolean }): CiPoller` avec `CiPoller = { tick(): Promise<void>; runs(projectId: string, ticketId: string | null): Promise<CiRun[]>; start(): () => void }`
  - `errorLinesOf(text: string): number[]` (1-based) ; `MAX_LOG_BYTES = 20 * 1024 * 1024` ; `LOG_RETENTION_MS = 14 jours`
  - `readCiLog(deps: { host; api; store }, projectId, runId, jobId): Promise<CiLog>` ; `purgeCiLogs(deps, now): void`
  - `ciModule(kit: IntegrationKit, poller: CiPoller, store: CiStore): IntegrationModule` (handlers `listCiRuns`, `getCiLog`)
  - `IntegrationEvent` `{ type: "ci", projectId }` diffusé quand un run change

- [ ] **Step 1: Tests (échouent)**

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
  expect(host.ruleEvents).toEqual([]);
  run.status = "completed";
  run.conclusion = "failure";
  run.updatedAt = gh.tick(30);
  run.jobs = [job(70, "failure")];
  host.clock.now += 60_000;
  await poller.tick();
  host.clock.now += 60_000;
  await poller.tick();
  const ticket = host.snapshot(host.projectId).tickets[0];
  expect(host.ruleEvents).toEqual([{ type: "ci.failed", projectId: host.projectId, ticketId: ticket?.id, runId: 900, prNumber: 12 }]);
});

test("an old failure seen for the first time does not notify", async () => {
  gh.addRun("adam/kibo", { id: 900, headSha: "abc123", headBranch: "b", name: "CI", status: "completed", conclusion: "failure", jobs: [job(70, "failure")] });
  host.clock.now += 60 * 60_000;
  await poller.tick();
  expect(host.ruleEvents).toEqual([]);
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

- [ ] **Step 2: `ci-store.ts`**

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

- [ ] **Step 3: `poller.ts`**

```ts
import { type CiRun, KiboError, type RepoSlug, type TicketView } from "@kibo/schema";
import { z } from "zod";
import type { GithubApi } from "../github/api";
import type { EventLog } from "../integrations/events";
import { githubRepoOf } from "../integrations/github-remote";
import type { IntegrationHost } from "../integrations/types";
import type { CiStore, StoredRun } from "./ci-store";

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
        host.ruleEvent({ type: "ci.failed", projectId, ticketId: pr.ticket.id, runId: r.id, prNumber: pr.number });
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

- [ ] **Step 4: `logs.ts`**

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

- [ ] **Step 5: `module.ts` et amorçage**

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

Règle par défaut (phase 2) : dans le fichier des règles déclaratives livré par la phase 2, ajouter la règle `{ id: "ci-failed-notify", on: "ci.failed", do: { notify: { title: "CI cassée sur {ticketKey}", body: "{workflow} a échoué sur la PR #{prNumber}." } } }` (syntaxe réelle de la phase 2 ; texte français exact « CI cassée sur KIB-n »). Aucune règle de statut par défaut (spec F §7). Si la phase 2 n'offre pas de règle déclarative sur un événement externe, `host.ruleEvent` appelle `host.notify` directement dans `host.ts` (colonne « Réel » du tableau d'ancrage).

- [ ] **Step 6: Vérifier et commiter**

Run: `bun test packages/daemon/src/ci && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/ci packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): runs et logs GitHub Actions"
```

(Ajouter au `git add` le fichier des règles par défaut de la phase 2 modifié.)

---

### Task 17: Écran 3 · Source synchronisée

Référence : maquette P6, sombre et clair. Le choix de source n'apparaît que pour les composants qui affichent des tickets (`kanban`, `tickets`).

**Files:**
- Create: `packages/sdk/src/ui/checkbox.tsx`
- Create: `packages/ui/src/dialogs/sync/{status-map.ts,status-map.test.ts,SourcePicker.tsx,SyncSourceForm.tsx,use-sync-progress.ts,SyncSource.test.tsx}`
- Modify: `packages/ui/src/dialogs/AddComponentDialog.tsx`

**Interfaces:**
- Consumes: RPC `getGithubConnectOptions`, `listGithubRepos`, `listGithubProjects`, `createBinding`, `getSyncState`, `command` (Task 1) ; `IntegrationEvent`, `BindingConfig`, `GithubProject`, `StatusMap`, `Status` (Task 1, v0.1) ; `client.onEvent` (Task 10) ; `fr.integrations.source` (Task 1) ; `ChoiceCard` (v0.1) ; navigation vers Paramètres › Intégrations (phase 2).
- Produces:
  - `prefillStatusMap(workflow: Status[], options: { id: string; name: string }[]): StatusMap` ; `parseLabels(text: string): string[]`
  - `type SyncForm = { repo: RepoSlug | null; project: GithubProject | null; statusMap: StatusMap; labels: string; importClosed: boolean }` ; `EMPTY_SYNC_FORM` ; `toBindingConfig(f: SyncForm): BindingConfig | null`
  - `useSyncProgress(bindingId: string | null): { imported: number; running: boolean } | null`
  - `SourcePicker({ value, onValueChange, connected, onOpenSettings })`, `SyncSourceForm({ workflow, value, onChange })`
  - `SYNCABLE_COMPONENTS = ["kanban", "tickets"]`
  - `Checkbox` (`@kibo/sdk/ui/checkbox`)

- [ ] **Step 1: Tests purs (échouent)**

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

- [ ] **Step 2: `status-map.ts`**

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

- [ ] **Step 3: Test du dialogue (échoue)**

`packages/ui/src/dialogs/sync/SyncSource.test.tsx` :

```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let listener: ((e: unknown) => void) | null = null;
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
    onEvent: (l: (e: unknown) => void) => {
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
  const other = screen.getAllByRole("radio").find((r) => !["Kanban", "Tickets"].includes(r.getAttribute("aria-label") ?? ""));
  if (other) await user.click(other);
  expect(screen.queryByText("Source")).toBeNull();
});
```

Run: `bun test packages/ui/src/dialogs/sync` — Expected: FAIL.

- [ ] **Step 4: `Checkbox` shadcn et `use-sync-progress.ts`**

`packages/sdk/src/ui/checkbox.tsx` : composant `Checkbox` de shadcn/ui (new-york, `import { Checkbox as CheckboxPrimitive } from "radix-ui"`, icône `CheckIcon`), tel que généré par `bunx shadcn@latest add checkbox`, avec l'import `cn` des fichiers voisins. Aucune dépendance nouvelle.

`packages/ui/src/dialogs/sync/use-sync-progress.ts` :

```ts
import { IntegrationEvent } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../../api";

export function useSyncProgress(bindingId: string | null): { imported: number; running: boolean } | null {
  const [progress, setProgress] = useState<{ imported: number; running: boolean } | null>(null);
  useEffect(() => {
    setProgress(null);
    if (bindingId === null) return;
    return client.onEvent((raw) => {
      const e = IntegrationEvent.safeParse(raw);
      if (e.success && e.data.type === "sync" && e.data.bindingId === bindingId) {
        setProgress({ imported: e.data.imported, running: e.data.running });
      }
    });
  }, [bindingId]);
  return progress;
}
```

(Un message WebSocket d'un autre type n'est pas une erreur : `safeParse` l'écarte.)

- [ ] **Step 5: `SourcePicker.tsx`**

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

(Icônes : `ListTodo`, celle de la ligne « GitHub Issues & Projects » de l'écran 16, et `HardDrive` pour Locale ; Lucide 1.x n'a plus d'icônes de marque, N15.)

- [ ] **Step 6: `SyncSourceForm.tsx`**

```tsx
import type { GithubProject, GithubRepo, Status, StatusId } from "@kibo/schema";
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
        <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--status-${status.id})` }} />
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

Précisions : la pastille de statut reprend la variable CSS ou la classe utilisée par les colonnes du Kanban v0.1 (même couleur que le reste de l'application) ; `onError` est stable (`useCallback` dans le parent) pour ne pas relancer les requêtes. `RepoList` est dans ce fichier (< 300 lignes au total) ; s'il dépasse, le sortir en `RepoList.tsx`.

- [ ] **Step 7: Brancher dans `AddComponentDialog.tsx`**

Ajouts (le reste du fichier inchangé) :

```tsx
import { type Binding, DEFAULT_WORKFLOW } from "@kibo/schema";
import { useCallback, useEffect } from "react";
import { SourcePicker, type SourceKind } from "./sync/SourcePicker";
import { SyncSourceForm } from "./sync/SyncSourceForm";
import { EMPTY_SYNC_FORM, SYNCABLE_COMPONENTS, type SyncForm, toBindingConfig } from "./sync/status-map";
import { useSyncProgress } from "./sync/use-sync-progress";
```

Dans le composant :

```tsx
  const [source, setSource] = useState<SourceKind>("local");
  const [form, setForm] = useState<SyncForm>(EMPTY_SYNC_FORM);
  const [connected, setConnected] = useState(false);
  const [binding, setBinding] = useState<Binding | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const progress = useSyncProgress(binding?.id ?? null);
  const syncable = selected !== undefined && SYNCABLE_COMPONENTS.includes(selected.manifest.id);
  const synced = syncable && source === "synced";
  const onFormError = useCallback((m: string) => setSyncError(m), []);

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

`add` devient :

```tsx
  const add = async () => {
    if (!ref) return;
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
          component: ref,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
          ...(created && { config: { source: { bindingId: created.id } } }),
        },
      });
      if (created) return setBinding(created);
    } catch {
      setFailed(true);
      return;
    }
    onOpenChange(false);
  };
```

Sous la grille du catalogue, si `syncable` :

```tsx
        {syncable && (
          <div className="grid gap-4 border-t pt-4">
            <SourcePicker value={source} onValueChange={setSource} connected={connected} onOpenSettings={openIntegrationSettings} />
            {synced && <SyncSourceForm workflow={DEFAULT_WORKFLOW} value={form} onChange={setForm} onError={onFormError} />}
          </div>
        )}
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

et le bouton principal : libellé `synced ? fr.integrations.source.submit : fr.addComponent.submit`, désactivé si `!ref || (synced && toBindingConfig(form) === null) || binding !== null`.

- `openIntegrationSettings` : fonction de navigation vers Paramètres › Intégrations de la phase 2 (ancrage « Réglages ») ; elle ferme d'abord le dialogue (`onOpenChange(false)`).
- `DEFAULT_WORKFLOW` : remplacer par le workflow du projet si le dialogue le reçoit déjà (prop `workflow` ajoutée par la phase 2 ou 4) ; la correspondance porte sur les libellés affichés.
- Le `catch { setFailed(true) }` existant (v0.1) affiche l'erreur générique ; il reste inchangé.

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel : écran 3 avec Kanban choisi, source synchronisée ouverte, en sombre puis en clair, comparé à P6.

```bash
git add packages/sdk/src/ui/checkbox.tsx packages/ui/src/dialogs/sync packages/ui/src/dialogs/AddComponentDialog.tsx
git commit -m "feat(ui): source synchronisée à l'ajout"
```

---

### Task 18: Sheet ticket · GitHub, CI, Maquettes

Références : maquettes P7, P8, P9 (sombre et clair) et page PDF 4 (Sheet ticket). Les sections s'insèrent dans le Sheet tel que livré par les phases 2 à 4 ; les emplacements sont donnés par rapport aux sections existantes.

**Files:**
- Create: `packages/ui/src/shell/sheet/{GithubRefs.tsx,SyncStatus.tsx,CiSection.tsx,CiLogSheet.tsx,FigmaSection.tsx,log-lines.ts,ci-format.ts}`
- Test: `packages/ui/src/shell/sheet/{log-lines.test.ts,ci-format.test.ts,sheet-integrations.test.tsx}`
- Modify: `packages/ui/src/shell/TicketSheet.tsx`

**Interfaces:**
- Consumes: RPC `getSyncState`, `resolveOutbox`, `listCiRuns`, `getCiLog`, `linkFigmaNode`, `getFigmaPreview`, `command` (`removeExternalRef`) (Task 1, Task 4) ; `githubIssueState`, `GithubIssueRef`, `FigmaNodeRef`, `CiRun`, `SyncState`, `IntegrationEvent` (Task 1) ; `externalRefKey` (Task 4) ; `client.onEvent`, `useSyncState`, `Switch` (Task 10) ; `fr.integrations.sheet`.
- Produces:
  - `visibleLines(log: CiLog, query: string, errorsOnly: boolean): { n: number; text: string; error: boolean }[]`
  - `formatDuration(ms: number): string` ; `runTone(run: Pick<CiRun, "status" | "conclusion">): "ok" | "error" | "running" | "neutral"` ; `latestPerWorkflow(runs: CiRun[]): CiRun[]` ; `conclusionLabel(run): string`
  - `GithubRefs({ ticket })`, `SyncStatus({ projectId, ticket })`, `CiSection({ projectId, ticketId })`, `CiLogSheet({ projectId, run, job, onClose })`, `FigmaSection({ projectId, ticket })`, `FigmaProperty({ ticket })`

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
    onEvent: () => () => undefined,
  },
}));

const { TicketSheet } = await import("../TicketSheet");

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  instances: [],
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

beforeEach(() => {
  calls.length = 0;
});

test("GitHub chips link to the issue and the PR", () => {
  render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
  expect(screen.getByRole("link", { name: "#42" }).getAttribute("href")).toBe("https://github.com/adam/kibo/issues/42");
  expect(screen.getByRole("link", { name: "#12" }).getAttribute("href")).toBe("https://github.com/adam/kibo/pull/12");
});

test("a sync failure can be retried", async () => {
  render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("github 422: Validation Failed");
  await userEvent.setup().click(within(alert).getByRole("button", { name: "Réessayer" }));
  expect(calls).toContainEqual({ method: "resolveOutbox", projectId: "p1", outboxId: 7, action: "retry" });
});

test("the CI section opens the logs, filterable to errors", async () => {
  render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
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
  render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
  expect(await screen.findByText("Figma non joignable")).toBeDefined();
  expect(screen.getAllByText("Tickets / Arbre").length).toBeGreaterThan(0);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Colle l'URL d'un nœud Figma (figma.com/design/…?node-id=…)"), "https://example.com/x");
  await user.click(screen.getByRole("button", { name: "Lier un nœud Figma" }));
  expect(await screen.findByText("URL Figma invalide : il faut un lien de nœud (node-id).")).toBeDefined();
});

test("an issue body is never rendered as HTML", () => {
  const { container } = render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
  expect(container.ownerDocument.querySelector("img[src='x']")).toBeNull();
});
```

(`as unknown as ProjectSnapshot` : les champs ajoutés par les phases 2 à 4 au ticket sont complétés par l'implémenteur ; le cast reste limité à ce fixture.)

Run: `bun test packages/ui/src/shell/sheet/sheet-integrations.test.tsx` — Expected: FAIL.

- [ ] **Step 4: `GithubRefs.tsx` et `SyncStatus.tsx`**

`packages/ui/src/shell/sheet/GithubRefs.tsx` :

```tsx
import { githubIssueState, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { CircleCheck, CircleDot, GitPullRequestArrow, Unlink } from "lucide-react";
import { fr } from "../../i18n/fr";

const t = fr.integrations.sheet;

export function GithubRefs({ ticket }: { ticket: TicketView }) {
  const chips = ticket.externalRefs.flatMap((ref) => {
    if (ref.kind === "github_pr") {
      return [
        <a key={ref.url} href={ref.url} target="_blank" rel="noreferrer noopener" title={t.openOnGithub}>
          <Badge variant="outline" className="gap-1 font-mono">
            <GitPullRequestArrow aria-hidden className="size-3" />
            {t.issue(ref.number)}
          </Badge>
        </a>,
      ];
    }
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
  return chips.length > 0 ? <div className="flex flex-wrap gap-1">{chips}</div> : null;
}
```

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
import { type CiJobSummary, type CiRun, IntegrationEvent } from "@kibo/schema";
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
    return client.onEvent((raw) => {
      const e = IntegrationEvent.safeParse(raw);
      if (e.success && e.data.type === "ci" && e.data.projectId === projectId) void load();
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

- [ ] **Step 7: Brancher dans `TicketSheet.tsx`**

- En-tête : `<GithubRefs ticket={t} />` sous `SheetTitle` (à côté des chips de l'en-tête s'il y en a déjà, phase 3).
- Sous l'en-tête : `<SyncStatus projectId={project.meta.id} ticket={t} />`.
- Liste de propriétés (`dl`) : `<FigmaProperty ticket={t} />` après « Statut » (et après les propriétés ajoutées par les phases 2 à 4).
- Description : rendue par le moteur Markdown du produit (phase 4, `Notes`) **avec le HTML brut désactivé** (option `html: false` / pas de `rehype-raw`) ; tant qu'aucun moteur n'existe, texte brut `whitespace-pre-wrap` comme en v0.1. Le test « never rendered as HTML » couvre les deux cas.
- Après la section « Dépendances » (phase 2/3), ou à défaut après « Sous-tickets » : `<CiSection projectId={project.meta.id} ticketId={t.id} />` puis `<FigmaSection projectId={project.meta.id} ticket={t} />`.
- `CiSection` ne s'affiche que si le ticket porte au moins une réf. `github_pr` : entourer de `{t.externalRefs.some((r) => r.kind === "github_pr") && …}`.
- `FigmaSection` s'affiche toujours (champ d'ajout) ; si Figma n'est pas configuré, le message `figmaNotConnected` apparaît à la première tentative ; si l'application Figma est fermée, `figma.unreachable`.

- [ ] **Step 8: Vérifier et commiter**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel du Sheet (sombre puis clair) contre P7, P8, P9.

```bash
git add packages/ui/src/shell/sheet packages/ui/src/shell/TicketSheet.tsx
git commit -m "feat(ui): GitHub, CI et maquettes dans le Sheet"
```

---

### Task 19: Adaptateur dans le Worker et aller-retour complet

Branche le moteur (Task 14) sur l'adaptateur réel (Task 13) exécuté dans le `WorkerHost` de la phase 4, et vérifie le critère de sortie de la phase : aller-retour ticket ↔ issue contre le faux GitHub.

**Files:**
- Create: `packages/daemon/src/sync/{worker-runner.ts,binding-calls.ts,builtin-adapter.ts}`
- Test: `packages/daemon/src/sync/{worker-runner.test.ts,binding-calls.test.ts,roundtrip.test.ts}`
- Create: `scripts/build-builtin.ts` (préconstruction des backends intégrés pour le paquet)
- Modify: `packages/daemon/src/integrations/{types.ts,host.ts,bootstrap.ts,testing/fake-host.ts}`, `packages/daemon/src/service.ts` (`integrationDeps`), traitement des messages `call` des backends (phase 4, fichier du `ComponentBackendHost`), `apps/desktop/src-tauri/tauri.conf.json` (`bundle.resources`), lancement du sidecar (`apps/desktop/src-tauri/src/…`, variable `KIBO_BUILTIN_DIR`), `package.json` racine (script `build:builtin`, appelé par le build desktop)

**Interfaces:**
- Consumes: `AdapterRunner` (Task 2) ; `syncModule` (Task 14) ; `githubIssuesAdapter`, `server` (Task 13, par chemin) ; `BINDING_PREFIX`, `bindingIdOf`, `PullPage`, `MappedRemote`, `BindingConfig` (Task 1) ; `ComponentCall`, `ComponentBackendHost`, `devkit.buildComponent`, proxy `fetch` (phase 4, modifié Task 8) ; `IntegrationKit.github.account` (Task 12) ; faux GitHub (Task 6).
- Produces:
  - `type AdapterInvoker = (req: { projectId: string; bindingId: string; adapter: Binding["adapter"]; config: BindingConfig; action: "adapter.pull" | "adapter.push"; input: unknown }) => Promise<unknown>`
  - `IntegrationHost.invokeAdapter: AdapterInvoker` ; `HostParts.invokeAdapter` ; `integrationDeps` accepte `invokeAdapter` et `now`
  - `createWorkerRunner(invoke: AdapterInvoker): AdapterRunner`
  - `BINDING_FETCH_PER_MINUTE = 120` ; `createMinuteQuota(limit: number, now: () => number): { take(key: string): void }` (`PERMISSION_DENIED` au-delà) ; `assertBindingCall(call: ComponentCall): void` (seul `fetch` est permis)
  - `builtinDir(id: string): string` ; `createAdapterInvoker(deps: { backends: ComponentBackendHost; build: (srcDir: string) => Promise<{ manifest: ComponentManifest; code: string }> }): AdapterInvoker`
  - variable d'environnement `KIBO_BUILTIN_DIR` (paquet : backends préconstruits `builtin/<id>/{kibo.component.json,server.js}`)

- [ ] **Step 1: Tests unitaires (échouent)**

`packages/daemon/src/sync/worker-runner.test.ts` :

```ts
import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import type { AdapterInvoker } from "../integrations/types";
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

`packages/daemon/src/sync/binding-calls.test.ts` :

```ts
import { expect, test } from "bun:test";
import { assertBindingCall, BINDING_FETCH_PER_MINUTE, createMinuteQuota } from "./binding-calls";

test("an adapter may only fetch", () => {
  expect(() => assertBindingCall({ kind: "fetch", url: "https://api.github.com/user", init: {} })).not.toThrow();
  expect(() => assertBindingCall({ kind: "list", entity: "ticket" })).toThrow("PERMISSION_DENIED");
  expect(() => assertBindingCall({ kind: "run", command: { method: "createTicket", title: "x" } })).toThrow("PERMISSION_DENIED");
});

test("120 fetches per minute per binding", () => {
  const clock = { now: 0 };
  const quota = createMinuteQuota(BINDING_FETCH_PER_MINUTE, () => clock.now);
  for (let i = 0; i < 120; i++) quota.take("binding:b1");
  expect(() => quota.take("binding:b1")).toThrow("PERMISSION_DENIED");
  expect(() => quota.take("binding:b2")).not.toThrow();
  clock.now += 60_000;
  expect(() => quota.take("binding:b1")).not.toThrow();
});
```

(Les formes exactes de `fetch`, `list` et `run` dans `ComponentCall` sont celles de la phase 4 ; ajuster les littéraux du test à ces formes, pas l'inverse.)

Run: `bun test packages/daemon/src/sync/worker-runner.test.ts packages/daemon/src/sync/binding-calls.test.ts` — Expected: FAIL.

- [ ] **Step 2: `worker-runner.ts` et `binding-calls.ts`**

`packages/daemon/src/integrations/types.ts` : ajouter

```ts
export type AdapterInvoker = (req: {
  projectId: string;
  bindingId: string;
  adapter: Binding["adapter"];
  config: BindingConfig;
  action: "adapter.pull" | "adapter.push";
  input: unknown;
}) => Promise<unknown>;
```

et `invokeAdapter: AdapterInvoker;` à `IntegrationHost`. `host.ts` : `HostParts.invokeAdapter` recopié tel quel. `testing/fake-host.ts` : champ `invokeAdapter` qui lève `KiboError("COMPONENT_CRASHED", "no adapter in fake host")`, remplaçable par le test (`host.invokeAdapter = …`).

`packages/daemon/src/sync/worker-runner.ts` :

```ts
import { type Binding, KiboError, MappedRemote, PullPage } from "@kibo/schema";
import type { ZodType, ZodTypeDef } from "zod";
import type { AdapterInvoker, AdapterRunner } from "../integrations/types";

function checked<T extends { ref: { bindingId: string } }>(binding: Binding, value: T): T {
  if (value.ref.bindingId !== binding.id) throw new KiboError("INTERNAL", `adapter returned a ref for another binding`);
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
import { type ComponentCall, KiboError } from "@kibo/schema";

export const BINDING_FETCH_PER_MINUTE = 120;

export function assertBindingCall(call: ComponentCall): void {
  if (call.kind !== "fetch") throw new KiboError("PERMISSION_DENIED", `adapters may only fetch, not ${call.kind}`);
}

export function createMinuteQuota(limit: number, now: () => number) {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key: string): void {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= 60_000) {
        windows.set(key, { start: t, count: 1 });
        return;
      }
      if (w.count >= limit) throw new KiboError("PERMISSION_DENIED", `quota exceeded: ${limit} fetch per minute for ${key}`);
      w.count += 1;
    },
  };
}
```

Run: `bun test packages/daemon/src/sync/worker-runner.test.ts packages/daemon/src/sync/binding-calls.test.ts` — Expected: PASS.

- [ ] **Step 3: Invocations `binding:` dans le backend de la phase 4**

Dans le traitement des messages `{ type: "call", id, call }` du `ComponentBackendHost` (phase 4), avant la résolution de l'instance :

```ts
if (invocation.instanceId.startsWith(BINDING_PREFIX)) {
  const bindingId = bindingIdOf(invocation.instanceId);
  const binding = service.snapshot(invocation.projectId).bindings.find((b) => b.id === bindingId);
  if (!binding) throw new KiboError("NOT_FOUND", `binding ${bindingId} not found`);
  assertBindingCall(msg.call);
  bindingQuota.take(invocation.instanceId);
  return proxyFetch(msg.call, { manifest: builtinManifest(binding.adapter), config: binding.config, hooks: integrations.hooks });
}
```

- `bindingQuota = createMinuteQuota(BINDING_FETCH_PER_MINUTE, Date.now)` (N8) remplace le quota de 20 / min pour ces invocations ; les autres contrôles §6.4 s'appliquent (règles `net` et `secrets` du manifeste intégré, anti-SSRF, en-têtes, redirections, taille, délai).
- `builtinManifest(id)` : manifeste validé du composant intégré, lu au chargement (étape 4).
- `proxyFetch` : la fonction du proxy de la phase 4 telle que modifiée par la Task 8 (hooks d'alias, de secrets et d'observation des limites).
- Test (dans le fichier de test du backend de la phase 4) : une invocation `binding:b1` qui demande `list` est refusée `PERMISSION_DENIED` ; une invocation `binding:inconnu` est refusée `NOT_FOUND`.

- [ ] **Step 4: `builtin-adapter.ts`**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentManifest, ComponentManifest as ManifestSchema, KiboError } from "@kibo/schema";
import type { AdapterInvoker } from "../integrations/types";

type Built = { manifest: ComponentManifest; code: string };
type BackendHost = {
  load(ref: string, manifest: ComponentManifest, code: string): Promise<void>;
  invoke(ref: string, req: { projectId: string; instanceId: string; config: unknown; target: { action: string }; input: unknown }): Promise<unknown>;
};

const REPO_COMPONENTS = join(import.meta.dir, "..", "..", "..", "..", "components");

export function builtinDir(id: string): string {
  const packaged = process.env.KIBO_BUILTIN_DIR;
  return packaged ? join(packaged, id) : join(REPO_COMPONENTS, id);
}

function readPrebuilt(dir: string): Built | null {
  const code = join(dir, "server.js");
  if (!existsSync(code)) return null;
  return { manifest: ManifestSchema.parse(JSON.parse(readFileSync(join(dir, "kibo.component.json"), "utf8"))), code: readFileSync(code, "utf8") };
}

export function createAdapterInvoker(deps: { backends: BackendHost; build(srcDir: string): Promise<Built> }): AdapterInvoker {
  const loaded = new Map<string, Promise<string>>();
  const load = (id: string): Promise<string> => {
    let ref = loaded.get(id);
    if (!ref) {
      ref = (async () => {
        const dir = builtinDir(id);
        const built = readPrebuilt(dir) ?? (await deps.build(dir));
        if (built.manifest.kind !== "adapter") throw new KiboError("INTERNAL", `${id} is not an adapter`);
        const r = `${built.manifest.id}@${built.manifest.version}`;
        await deps.backends.load(r, built.manifest, built.code);
        return r;
      })();
      loaded.set(id, ref);
      ref.catch(() => loaded.delete(id));
    }
    return ref;
  };
  return async (req) => {
    const ref = await load(req.adapter);
    return deps.backends.invoke(ref, {
      projectId: req.projectId,
      instanceId: `binding:${req.bindingId}`,
      config: req.config,
      target: { action: req.action },
      input: req.input,
    });
  };
}
```

- `BackendHost` décrit le `ComponentBackendHost` de la phase 4 (`WorkerHost` pour un intégré) ; si ses méthodes portent d'autres noms, écrire l'adaptation dans ce seul fichier et la noter dans la colonne « Réel » des ancrages.
- `ref.catch(() => loaded.delete(id))` n'avale pas l'échec : il est renvoyé à l'appelant par `await load(…)` ; la suppression permet seulement un nouvel essai au cycle suivant.
- `deps.build` = `devkit.buildComponent` réduit à la cible serveur (sortie en mémoire : `{ manifest, code }`).
- En dev, `KIBO_BUILTIN_DIR` est absent : construction depuis `components/<id>/`. Dans le paquet, les backends sont **préconstruits** (étape 7), la construction à l'exécution n'est jamais nécessaire (pas de `node_modules` dans le paquet). (N7.)

Service et amorçage :
- `packages/daemon/src/service.ts` : `integrationDeps` accepte `invokeAdapter` et `now` ; à défaut, `invokeAdapter = createAdapterInvoker({ backends: <WorkerHost du service>, build: buildServer })` et `now = Date.now`.
- `packages/daemon/src/integrations/bootstrap.ts` : ajouter à `modules` `syncModule(kit, createWorkerRunner(host.invokeAdapter), () => account.mode() !== null)`.

- [ ] **Step 5: Test d'aller-retour (échoue tant que les étapes 3 et 4 ne sont pas faites)**

`packages/daemon/src/sync/roundtrip.test.ts` :

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Binding, Instance, IntegrationEvent, Page, ProjectMeta, RpcRequest, RpcResult, TicketView } from "@kibo/schema";
import { parseIntegrationFlags, startIntegrations } from "../integrations/bootstrap";
import { createRedactor } from "../integrations/redact";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";

let gh: FakeGithub;
let home: string;
let store: Store;
let service: Service;
let project: ProjectMeta;
let binding: Binding;
let instance: Instance;
const clock = { now: Date.parse("2026-09-26T10:00:00Z") };
const events: IntegrationEvent[] = [];

const rpc = <R extends RpcRequest>(req: R) => service.handle(req) as Promise<RpcResult[R["method"]]>;
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
  service = createService(store, {
    user: "adam",
    integrationDeps: { now: () => clock.now },
    integrations: (host) =>
      startIntegrations(host, parseIntegrationFlags({ "test-origins": `api.github.com=${gh.url}`, "memory-secrets": true }), createRedactor()),
  });
  service.onIntegrationEvent((e) => events.push(e));
  project = await rpc({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#71717A" });
  await rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  binding = await rpc({
    method: "createBinding",
    projectId: project.id,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
  const page = (await run({ method: "addPage", title: "Kanban", kind: "view" })) as Page;
  instance = (await run({ method: "addInstance", pageId: page.id, component: "kanban@1.0.0", config: { source: { bindingId: binding.id } } })) as Instance;
});
afterEach(() => {
  service.close();
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

(`as Promise<RpcResult[…]>`, `as Page`, `as Instance` : `service.handle` renvoie `unknown` par conception ; les formes sont celles du contrat RPC typé.)

Run: `bun test packages/daemon/src/sync/roundtrip.test.ts`
Expected: PASS une fois les étapes 3 et 4 faites. En cas d'échec, le message `gh.requests` (méthode, chemin) situe l'écart : adaptateur (Task 13), proxy (Task 8) ou moteur (Task 14).

- [ ] **Step 6: Paquet desktop**

`scripts/build-builtin.ts` :

```ts
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildServer } from "@kibo/devkit";

const ADAPTERS = ["github-issues"];
const out = join(import.meta.dir, "..", "apps", "desktop", "src-tauri", "builtin");

for (const id of ADAPTERS) {
  const src = join(import.meta.dir, "..", "components", id);
  const built = await buildServer(src);
  mkdirSync(join(out, id), { recursive: true });
  cpSync(join(src, "kibo.component.json"), join(out, id, "kibo.component.json"));
  writeFileSync(join(out, id, "server.js"), built.code);
}
```

- `buildServer` : l'export de `@kibo/devkit` (phase 4) qui construit la cible serveur en mémoire (même fonction que `deps.build`) ; si la phase 4 ne l'exporte que sous `buildComponent(srcDir, outDir)`, construire dans un dossier temporaire et lire `server.js`.
- `package.json` racine : `"build:builtin": "bun scripts/build-builtin.ts"`, appelé avant `tauri build` par le script de build desktop existant ; `apps/desktop/src-tauri/builtin/` ajouté au `.gitignore`.
- `tauri.conf.json` : `"bundle": { "resources": { "builtin/": "builtin/" } }`.
- Lancement du sidecar (Rust, quelques lignes) : `.env("KIBO_BUILTIN_DIR", app.path().resource_dir()?.join("builtin"))`.
- Le smoke test Tauri de la v0.1 vérifie en plus que `builtin/github-issues/server.js` est présent dans le bundle.

- [ ] **Step 7: Vérifier et commiter**

Run: `bun test packages/daemon && bun test components && bun run check && bun run typecheck` — Expected: PASS (dont `roundtrip.test.ts`).

```bash
git add packages/daemon/src/sync packages/daemon/src/integrations packages/daemon/src/service.ts scripts/build-builtin.ts package.json .gitignore apps/desktop/src-tauri
git commit -m "feat(daemon): adaptateur GitHub dans le Worker"
```

(Ajouter au `git add` le fichier du backend de la phase 4 modifié à l'étape 3.)

---

### Task 20: Figma par MCP (D1)

Serveur MCP Dev Mode de l'application Figma, ouvert par le hub sous l'identifiant réservé `figma` (N13) ; aucun secret. Lier un nœud, aperçu en cache, URL des maquettes dans `brief.md`.

**Files:**
- Create: `packages/daemon/src/figma/{figma-url.ts,figma.ts,brief.ts,module.ts}`
- Test: `packages/daemon/src/figma/{figma-url.test.ts,figma.test.ts}`
- Modify: `packages/daemon/src/testing/fake-mcp.ts` (option `omit`), `packages/daemon/src/integrations/bootstrap.ts` (module), générateur de `brief.md` (phase 2, voir ancrages)

**Interfaces:**
- Consumes: `McpHub` (`setReserved`, `tools`, `call`) (Task 15) ; `Settings` (`figma.url`), `IntegrationKit`, `baseStatus`, `EventLog` (Task 2) ; `FigmaNodeRef`, `FigmaPreview`, RPC `configureFigma`, `linkFigmaNode`, `getFigmaPreview`, `disconnectIntegration` (Task 1) ; `upsertExternalRef` (phase 3 / Task 4) ; faux MCP (Task 7).
- Produces:
  - `parseFigmaUrl(raw: string): { fileKey: string; nodeId: string; url: string } | null` ; `nameFromMetadata(text: string): string | null`
  - `FIGMA_TOOLS = ["get_metadata", "get_screenshot"]` ; `PREVIEW_TTL_MS = 7 jours` ; `MAX_PREVIEW_BYTES = 2 Mio`
  - `createFigma(deps: { host: IntegrationHost; hub: McpHub; settings: Settings; events: EventLog }): Figma` avec `Figma = { start(): Promise<void>; configure(url: string): Promise<IntegrationStatus>; status(): IntegrationStatus; test(): Promise<IntegrationStatus>; link(projectId: string, ticketId: string, url: string): Promise<FigmaNodeRef>; preview(fileKey: string, nodeId: string): Promise<FigmaPreview>; disconnect(): Promise<void> }`
  - `figmaBriefSection(ticket: Pick<Ticket, "externalRefs">): string | null`
  - `figmaModule(kit: IntegrationKit, hub: McpHub): IntegrationModule` (handlers `configureFigma`, `linkFigmaNode`, `getFigmaPreview` ; sonde `figma` avec `test` et `disconnect`)
  - `buildFakeMcpServer(opts?: { omit?: string[] })`, `startFakeMcpHttp(opts?: { bearer?: string; omit?: string[] })`

- [ ] **Step 1: Tests (échouent)**

`packages/daemon/src/figma/figma-url.test.ts` :

```ts
import { expect, test } from "bun:test";
import { figmaBriefSection } from "./brief";
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

test("brief.md lists the linked mockups", () => {
  const ticket = {
    externalRefs: [
      { kind: "figma_node" as const, fileKey: "AbC123xyz", nodeId: "12:34", url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34", name: "Arbre" },
    ],
  };
  expect(figmaBriefSection(ticket)).toBe("## Maquettes\n\n- Arbre : https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34\n");
  expect(figmaBriefSection({ externalRefs: [] })).toBeNull();
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

- [ ] **Step 3: `figma-url.ts` et `brief.ts`**

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

`packages/daemon/src/figma/brief.ts` :

```ts
import type { FigmaNodeRef, Ticket } from "@kibo/schema";

export function figmaBriefSection(ticket: Pick<Ticket, "externalRefs">): string | null {
  const nodes = ticket.externalRefs.filter((r): r is FigmaNodeRef => r.kind === "figma_node");
  if (nodes.length === 0) return null;
  return `## Maquettes\n\n${nodes.map((n) => `- ${n.name} : ${n.url}`).join("\n")}\n`;
}
```

Générateur de `brief.md` (phase 2) : ajouter `figmaBriefSection(ticket)` à la liste des sections, après la description ; `null` ⇒ section absente. Aucun secret ni aperçu dans le brief (URL seulement).

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

Run: `bun test packages/daemon/src/figma packages/daemon/src/testing && bun test packages/daemon && bun run check && bun run typecheck` — Expected: PASS.

```bash
git add packages/daemon/src/figma packages/daemon/src/testing/fake-mcp.ts packages/daemon/src/integrations/bootstrap.ts
git commit -m "feat(daemon): nœuds Figma liés et aperçus"
```

(Ajouter au `git add` le générateur de `brief.md` de la phase 2 modifié.)

---

### Task 21: Kanban et Tickets synchronisés

Référence : maquette P11 (sombre et clair), pages PDF 8 et 14 (cartes Kanban avec chips). Une instance dont la config porte `source: { bindingId }` n'affiche que les tickets de la liaison (et leurs sous-tickets locaux) ; le shell ajoute l'en-tête de source ; la création depuis l'instance porte son `instanceId` pour que le démon crée l'issue (Task 14).

**Files:**
- Modify: `packages/sdk/src/source.ts` (+ `filterBySource`), `packages/sdk/src/source.test.ts`, `packages/sdk/src/types.ts` (`NewTicketDefaults.instanceId`), `packages/sdk/src/sdk.ts` (`openNewTicket` ajoute `instanceId`)
- Modify: `components/kanban/{kibo.component.json,src/Kanban.tsx,src/KanbanCard.tsx,src/fr.ts,src/kanban.test.tsx}`, `components/tickets/{kibo.component.json,src/TicketsTree.tsx,src/tickets.test.tsx}`
- Create: `packages/ui/src/pages/SourceHeader.tsx`, `packages/ui/src/pages/SourceHeader.test.tsx`, `packages/ui/src/shell/use-conflict-toasts.ts`
- Modify: `packages/ui/src/pages/PageView.tsx`, `packages/ui/src/dialogs/NewTicketDialog.tsx` (+ son test dans `dialogs.test.tsx`), `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/i18n/fr-integrations.ts` (bloc `instance`)

**Interfaces:**
- Consumes: `readSource`, `matchesSource`, `EntityMap.ci_run`, `createMockSdk({ ciRuns })` (Task 9) ; `ProjectSnapshot.bindings` (Task 4) ; RPC `syncBinding`, `getSyncState`, `command` avec `instanceId` (Tasks 1, 2) ; `IntegrationEvent` (Task 1) ; `useSyncState` (Task 10) ; tons CI identiques à `runTone` (Task 18), recopiés en 6 lignes dans le composant : un composant n'importe jamais `ui`.
- Produces:
  - `filterBySource(tickets: TicketView[], source: InstanceSource | null): TicketView[]` (tickets de la liaison + descendants)
  - `NewTicketDefaults = { statusId?; parentId?; instanceId?: string }` ; `sdk.openNewTicket(d)` complète `instanceId`
  - `SourceHeader({ project, instance })` ; `useConflictToasts(): void`
  - `fr.integrations.instance = { header(repo); sync; syncing; lastSync(time); never; bindingRemoved; bindingRemovedHelp }`
  - N16 : une instance synchronisée ouvre le Kanban sur le filtre « Tous »

- [ ] **Step 1: Tests SDK (échouent)**

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

(`as unknown as TicketView` : fixture réduite aux champs lus. `manifest` et `createMockSdk` sont ceux déjà importés par le fichier de test de la Task 9 ; `newTicketRequests` est exposé par `MockSdk` depuis la v0.1, sinon l'ajouter.)

Run: `bun test packages/sdk/src/source.test.ts` — Expected: FAIL.

- [ ] **Step 2: `filterBySource` et `openNewTicket`**

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
`packages/sdk/src/sdk.ts`, dans `createSdk` : après `...ctx`, `openNewTicket: (d) => ctx.openNewTicket({ ...d, instanceId: ctx.instanceId }),`.

Run: `bun test packages/sdk` — Expected: PASS (les tests v0.1 qui comparent `newTicketRequests` gagnent `instanceId: "mock-instance"` : mettre à jour leurs attendus).

- [ ] **Step 3: Tests Kanban (échouent)**

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

(Les commandes réservées `importExternalTicket` et `upsertExternalRef` passent par `run` du seed, qui appelle `executeProjectCommand` directement, sans contrôle `writes` : c'est la voie du seed depuis la v0.1.)

Run: `bun test components/kanban` — Expected: FAIL.

- [ ] **Step 4: Kanban**

`components/kanban/kibo.component.json` : `"reads": ["ticket", "status", "ci_run"]` ; `configSchema` gagne l'entrée `source` au format de la phase 4 (objet `{ bindingId: string }`, défaut `null`, non éditable dans le panneau de config : posée par l'écran 3).

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

```tsx
  const source = readSource(sdk.config);
  const { data: runs, error: ciError } = useEntities("ci_run");
  const [filter, setFilter] = useState<KanbanFilter>(
    source !== null || sdk.config.filter === "all" ? "all" : "mine-and-agents",
  );
  const scoped = filterBySource(tickets, source);
  const shown = filterTickets(scoped, filter, sdk.viewer);
  const ciOf = (t: TicketView): CiRun | undefined =>
    runs.filter((r) => r.ticketKey === t.key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const ciProblem = ciError && !(ciError instanceof KiboError && ciError.code === "NOT_CONNECTED") ? ciError.message : null;
```

- Le compteur devient `fr.counter(shown.length, scoped.length)`.
- `KanbanCard` reçoit `ci={ciOf(t)}`.
- Dans l'en-tête, à côté de l'alerte existante : `{ciProblem && <p role="alert" className="text-destructive">{fr.ciUnavailable(ciProblem)}</p>}` (GitHub non connecté n'est pas une erreur : aucun chip, aucun message).
- `useEntities` (v0.1, `packages/sdk/src/react.tsx`) expose déjà `error: KiboError | null`.

`components/kanban/src/KanbanCard.tsx` : prop `ci?: CiRun`, et dans la rangée de badges, avant la progression :

```tsx
        {ci && (
          <span aria-label={fr.ci[ciTone(ci)]} title={fr.ci[ciTone(ci)]} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs">
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

Si la phase 3 affiche déjà un chip `#12` de PR sur la carte, y placer la pastille (un seul chip `#12`, pastille à gauche du numéro) au lieu d'en ajouter un second. Couleurs identiques à celles de la section CI du Sheet (Task 18) ; aucun orange.

- [ ] **Step 5: Tickets**

`components/tickets/kibo.component.json` : `configSchema` gagne `source` (même entrée). `components/tickets/src/TicketsTree.tsx` : `const tickets = filterBySource(all, readSource(sdk.config));` avant `buildTree`. Test ajouté à `tickets.test.tsx` : avec `config: { source: { bindingId: "b1" } }` et le même `syncedSeed` (recopié), l'arbre montre « Issue synchronisée » et « Sous-tâche locale », pas « Ticket local ».

Run: `bun test components` — Expected: PASS (conformité comprise : `ci_run` est déclaré dans `reads`).

- [ ] **Step 6: En-tête de source et création depuis l'instance**

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
    onEvent: () => () => undefined,
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

`packages/ui/src/pages/PageView.tsx` : dans `InstanceFrame`, rendre `<SourceHeader project={project} instance={instance} />` au-dessus de `<mod.Component />` (passer `project` à `InstanceFrame`) ; `openNewTicket` du `SdkContext` reste `host.openNewTicket` (le SDK complète `instanceId`).

`packages/ui/src/dialogs/NewTicketDialog.tsx` : la requête devient `{ method: "command", projectId, command: { … }, ...(defaults.instanceId && { instanceId: defaults.instanceId }) }`. Test ajouté à `dialogs.test.tsx` : `defaults={{ statusId: "todo", instanceId: "i1" }}` ⇒ l'appel enregistré contient `instanceId: "i1"`.

`packages/ui/src/shell/use-conflict-toasts.ts` :

```ts
import { IntegrationEvent } from "@kibo/schema";
import { toast } from "@kibo/sdk/ui/sonner";
import { useEffect } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export function useConflictToasts(): void {
  useEffect(
    () =>
      client.onEvent((raw) => {
        const e = IntegrationEvent.safeParse(raw);
        if (e.success && e.data.type === "sync.conflict") toast(fr.integrations.conflict(e.data.ticketKey, e.data.field));
      }),
    [],
  );
}
```

`Shell.tsx` : appeler `useConflictToasts()` une fois. (`toast` : réexporté par `@kibo/sdk/ui/sonner` ; sinon l'importer depuis `sonner`, déjà dépendance de `sdk`.)

- [ ] **Step 7: Vérifier et commiter**

Run: `bun test packages/sdk packages/ui components && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel : Kanban synchronisé (en-tête, chip CI rouge, état « Liaison supprimée ») en sombre puis en clair, contre P11.

```bash
git add packages/sdk/src components/kanban components/tickets packages/ui/src/pages packages/ui/src/dialogs/NewTicketDialog.tsx packages/ui/src/dialogs/dialogs.test.tsx packages/ui/src/shell packages/ui/src/i18n/fr-integrations.ts
git commit -m "feat(components): Kanban et Tickets synchronisés"
```

---

### Task 22: Composant « Source MCP » (X1)

Référence : maquette P10 (widget et étape de config), sombre et clair. Composant intégré écrit avec le SDK public : il appelle un outil ou lit une ressource d'un serveur MCP, extrait une liste par pointeurs JSON, et crée un ticket par élément sur demande. Aucune synchronisation automatique.

**Files:**
- Create: `components/mcp-source/{kibo.component.json,package.json,tsconfig.json}`, `components/mcp-source/src/{config.ts,extract.ts,extract.test.ts,McpSource.tsx,SourceItemRow.tsx,mcp-source.test.tsx,fr.ts,index.ts}`
- Create: `packages/ui/src/dialogs/mcp-source/{McpSourceStep.tsx,mcp-source-step.test.tsx}`
- Modify: `package.json` racine (script `typecheck`), `CLAUDE.md` (liste du monorepo : `components/mcp-source` ; fait en Task 1 si déjà listé), `BUILTIN_IDS` (phase 4, `schema`) : `"mcp-source"`, `packages/ui/src/registry.ts` (composant intégré), `packages/ui/src/dialogs/AddComponentDialog.tsx` (étape de config)

**Interfaces:**
- Consumes: `sdk.mcp.call`, `sdk.mcp.read`, `sdk.mcp.importItem`, `createMockSdk({ mcp })` (Task 9) ; `CONFIG_SERVER_RULE`, `McpServerId`, `WebUrl`, `McpCallResult`, `McpImportItem` (Task 1) ; RPC `listMcpServers` (Task 1) ; `useEntities`, `useSdk`, `sdk.data` (v0.1, phase 4).
- Produces:
  - `McpSourceConfig` (Zod) = `{ server; mode: "tool" | "resource"; tool?; args: Record<string, unknown>; uri?; refreshMinutes (5 à 1440, défaut 15); mapping: { items; id; title; subtitle?; url? } }` (pointeurs JSON RFC 6901)
  - `resolvePointer(doc: unknown, pointer: string): unknown` ; `extractItems(result: McpCallResult, mapping): { items: SourceItem[]; error: string | null }` ; `type SourceItem = { id: string; title: string; subtitle: string | null; url: string | null }` ; `MAX_ITEMS = 200`
  - `McpSourceStep({ value, onChange })` (écran 3) ; `defaultMcpSourceConfig(server: string): McpSourceConfig`

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
    "args": { "type": "object", "default": {} },
    "uri": { "type": "string" },
    "refreshMinutes": { "type": "number", "default": 15 },
    "mapping": { "type": "object" }
  }
}
```

(Format de `configSchema` : celui de la phase 4 ; recopier la syntaxe exacte des manifestes Graphe et Notes.)

`components/mcp-source/package.json` et `tsconfig.json` : calqués sur `components/kanban` (nom `@kibo/component-mcp-source`, dépendances `@kibo/schema`, `@kibo/sdk`, `react`, `lucide-react`, `zod` aux versions du dépôt). Ajouter `components/mcp-source` au script `typecheck` racine.

- [ ] **Step 2: Tests d'extraction (échouent)**

`components/mcp-source/src/extract.test.ts` :

```ts
import { expect, test } from "bun:test";
import { McpSourceConfig } from "./config";
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
  const base = { server: "ctx", args: {}, mapping: { items: "/items", id: "/id", title: "/name" } };
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "list_items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool" }).success).toBe(false);
  expect(McpSourceConfig.safeParse({ ...base, mode: "resource", uri: "fake://items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "x", refreshMinutes: 1 }).success).toBe(false);
});
```

Run: `bun test components/mcp-source` — Expected: FAIL.

- [ ] **Step 3: `config.ts` et `extract.ts`**

`components/mcp-source/src/config.ts` :

```ts
import { McpServerId } from "@kibo/schema";
import { z } from "zod";

const JsonPointer = z.string().max(256).regex(/^(\/[^/]*)*$/);

export const McpSourceConfig = z
  .object({
    server: McpServerId,
    mode: z.enum(["tool", "resource"]),
    tool: z.string().min(1).max(128).optional(),
    args: z.record(z.string(), z.unknown()).default({}),
    uri: z.string().min(1).max(2048).optional(),
    refreshMinutes: z.number().int().min(5).max(1440).default(15),
    mapping: z.object({
      items: JsonPointer,
      id: JsonPointer,
      title: JsonPointer,
      subtitle: JsonPointer.optional(),
      url: JsonPointer.optional(),
    }),
  })
  .refine((c) => (c.mode === "tool" ? c.tool !== undefined : c.uri !== undefined), "tool or uri required by mode");
export type McpSourceConfig = z.infer<typeof McpSourceConfig>;

export function defaultMcpSourceConfig(server: string): McpSourceConfig {
  return McpSourceConfig.parse({
    server,
    mode: "tool",
    tool: "list_items",
    mapping: { items: "/items", id: "/id", title: "/name", subtitle: "/detail", url: "/link" },
  });
}
```

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

(`runConformance(…, { config, mcp })` : troisième argument d'options de la suite de conformité de la phase 4 ; si la suite ne l'accepte pas encore, l'ajouter dans ce commit : il transmet `config` et `mcp` à `createMockSdk`.)

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

`components/mcp-source/src/index.ts` : `export { McpSource as Component } from "./McpSource";` et `export const manifest = ComponentManifest.parse(raw)` depuis `kibo.component.json`, comme `components/kanban/src/index.ts`.

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
    onEvent: () => () => undefined,
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
- `Textarea` « Arguments (JSON) » (défaut `{}`) : `JSON.parse` dans une fonction `parseArgs(text): Record<string, unknown> | null` (objet seulement) ; invalide ⇒ `argsInvalid` et `onChange(null)` ;
- cinq `Input` de pointeurs (valeurs par défaut de `defaultMcpSourceConfig`, recopiées ici : `ui` n'importe pas un composant), aide `pointerHelp` ;
- `Input type="number"` « Rafraîchissement » (min 5, défaut 15) ;
- à chaque changement valide, `onChange({ server, mode, tool | uri, args, refreshMinutes, mapping })` ; chaque couple label / champ par `useId()`.

`packages/ui/src/registry.ts` : ajouter le composant intégré `mcp-source` (import de `components/mcp-source`, comme Kanban). `AddComponentDialog.tsx` : si le composant choisi est `mcp-source`, afficher `<McpSourceStep value={mcpConfig} onChange={setMcpConfig} />` sous le catalogue, désactiver « Ajouter à la page » tant que `mcpConfig === null`, et passer `config: mcpConfig` à `addInstance`. L'écran 30 (phase 4) affiche la permission « Appeler le serveur MCP choisi à l'ajout » (`fr.integrations.permissions.mcpFromConfig`, Task 9).

- [ ] **Step 7: Vérifier et commiter**

Run: `bun test components packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build` — Expected: PASS. Contrôle visuel : widget (liste, vide, erreur, chargement) et étape de config, en sombre puis en clair, contre P10.

```bash
git add components/mcp-source package.json packages/ui/src/dialogs/mcp-source packages/ui/src/dialogs/AddComponentDialog.tsx packages/ui/src/registry.ts packages/ui/src/i18n/fr-integrations.ts
git commit -m "feat(components): Source MCP"
```

(Ajouter au `git add` `CLAUDE.md`, le fichier de `BUILTIN_IDS` et la suite de conformité s'ils ont changé.)

---

### Task 23: Test de fuite de secret et parcours E2E

Critères de sortie de la spec F (§10, §12) : zéro occurrence d'un secret partout où il pourrait fuir, et parcours Playwright de l'écran 16 et d'un Kanban synchronisé, en sombre et en clair, contre le faux GitHub et le faux MCP.

**Files:**
- Create: `packages/daemon/src/integrations/leak.test.ts`
- Create: `e2e/integrations.spec.ts`
- Modify: `e2e/serve.ts`, `e2e/token.ts`, `packages/daemon/src/testing/fake-github.ts` (option `port`), `packages/daemon/src/testing/fake-mcp.ts` (option `port`)

**Interfaces:**
- Consumes: tout ce qui précède ; `startServer` (v0.1, `redact` ajouté en Task 2) ; `installConsoleRedaction`, `createRedactor` (Task 2) ; `ECHO_AUTH`, `LOGS_HOST` (Task 6) ; `startFakeMcpHttp`, `FAKE_MCP_STDIO` (Task 7).
- Produces: `startFakeGithub(opts?: { login?; token?; port?: number })`, `startFakeMcpHttp(opts?: { bearer?; omit?; port?: number })` ; constantes E2E `E2E_GH_TOKEN`, `FAKE_GH_PORT = 4391`, `FAKE_MCP_PORT = 4392`.

- [ ] **Step 1: Ports fixes des faux serveurs**

`fake-github.ts` : `Bun.serve({ port: opts.port ?? 0, hostname: "127.0.0.1", … })`. `fake-mcp.ts` : `http.listen(opts.port ?? 0, "127.0.0.1", …)`. Aucun autre changement.

- [ ] **Step 2: Test de fuite (échoue tant qu'une fuite existe)**

`packages/daemon/src/integrations/leak.test.ts` :

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "../testing/fake-mcp";
import { parseIntegrationFlags, startIntegrations } from "./bootstrap";
import { createRedactor, installConsoleRedaction } from "./redact";

const SECRET = "ghp_TESTSECRET0123456789abcdefghijklmn";
const MCP_ENV = "mcp-env-secret-0123456789";
const MCP_BEARER = "mcp-bearer-secret-0123456789";
const SECRETS = [SECRET, MCP_ENV, MCP_BEARER];
const TOKEN = "c".repeat(64);
const METHODS = ["log", "info", "warn", "error", "debug"] as const;

let gh: FakeGithub;
let mcpHttp: Awaited<ReturnType<typeof startFakeMcpHttp>>;
let home: string;
let store: Store;
let service: Service;
let server: ReturnType<typeof startServer>;
let cookie = "";
const logs: string[] = [];
const responses: string[] = [];
const originals = METHODS.map((m) => console[m]);
let uninstall: () => void = () => undefined;

async function rpc(body: unknown): Promise<unknown> {
  const res = await fetch(`${server.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url, cookie },
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
  store = openStore(home);
  service = createService(store, {
    user: "adam",
    integrations: (host) =>
      startIntegrations(
        host,
        parseIntegrationFlags({ "test-origins": `api.github.com=${gh.url},${LOGS_HOST}=${gh.url}`, "memory-secrets": true }),
        redactor,
      ),
  });
  server = startServer({ service, token: TOKEN, port: 0, uiDir: null, redact: redactor.redact });
  const pair = await fetch(`${server.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url },
    body: JSON.stringify({ token: TOKEN }),
  });
  cookie = (pair.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
});

afterAll(async () => {
  server.stop();
  service.close();
  store.close();
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

  service.close();
  const db = store.db;
  const events = JSON.stringify(db.query("SELECT * FROM integration_events").all());
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

- `result<T>(r)` : `as { result: T }` sur une réponse du contrat RPC v0.1 (`{ result }` ou `{ error }`) ; les formes sont celles de `RpcResult`.
- `filesUnder(home)` couvre `kibo.db`, `kibo.db-wal`, `kibo.db-shm`, le cache des logs CI, les dossiers `mcp/<id>` et tout fichier écrit par le démon ; `latin1` lit les octets tels quels (un secret ASCII y apparaît à l'identique).
- Le contrôle positif (`***` dans une réponse) prouve que l'écho de l'en-tête `Authorization` a bien eu lieu et a été caviardé.
- Si le snapshot Loro est stocké compressé, la recherche dans `kibo.db` ne suffit pas : c'est pourquoi `getProject` (état complet du doc) est aussi fouillé.

Run: `bun test packages/daemon/src/integrations/leak.test.ts`
Expected: PASS. Un échec nomme l'endroit (`secret leaked in …`) : corriger à la source (caviardage à l'écriture, `scrubSecret`, jamais en retirant l'étape du test).

- [ ] **Step 3: Serveur E2E avec faux GitHub et faux MCP**

`e2e/token.ts`, ajouter :

```ts
export const E2E_GH_TOKEN = "ghp_E2ETOKEN0123456789abcdefghijklmnopq";
export const FAKE_GH_PORT = 4391;
export const FAKE_MCP_PORT = 4392;
```

`e2e/serve.ts` : avant le `Bun.spawn` :

```ts
import { LOGS_HOST, startFakeGithub } from "../packages/daemon/src/testing/fake-github";
import { startFakeMcpHttp } from "../packages/daemon/src/testing/fake-mcp";
import { E2E_GH_TOKEN, E2E_TOKEN, FAKE_GH_PORT, FAKE_MCP_PORT } from "./token";

const gh = startFakeGithub({ token: E2E_GH_TOKEN, port: FAKE_GH_PORT });
gh.addRepo("adam/kibo");
const mcp = await startFakeMcpHttp({ port: FAKE_MCP_PORT });
```

les arguments du démon gagnent `"--test-origins", \`api.github.com=${gh.url},${LOGS_HOST}=${gh.url}\`, "--memory-secrets"`, l'environnement `KIBO_GH: join(home, "no-gh")` (aucun `gh` réel, même sur un runner CI qui en a un) ; après `await proc.exited` : `gh.stop(); await mcp.stop();`.

- [ ] **Step 4: Parcours Playwright**

`e2e/integrations.spec.ts` :

```ts
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { E2E_GH_TOKEN, E2E_TOKEN, FAKE_GH_PORT } from "./token";

const GH = `http://127.0.0.1:${FAKE_GH_PORT}`;
const auth = { authorization: `Bearer ${E2E_GH_TOKEN}`, "content-type": "application/json" };
const suffix = (info: TestInfo) => (info.project.name === "light" ? "L" : "D");

async function ghIssues(): Promise<{ number: number; title: string }[]> {
  const res = await fetch(`${GH}/repos/adam/kibo/issues?state=all&per_page=100`, { headers: auth });
  return (await res.json()) as { number: number; title: string }[];
}
async function ghCreate(title: string): Promise<number> {
  const res = await fetch(`${GH}/repos/adam/kibo/issues`, { method: "POST", headers: auth, body: JSON.stringify({ title }) });
  return ((await res.json()) as { number: number }).number;
}
async function ghRename(n: number, title: string): Promise<void> {
  await fetch(`${GH}/repos/adam/kibo/issues/${n}`, { method: "PATCH", headers: auth, body: JSON.stringify({ title }) });
}

async function openIntegrations(page: Page) {
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Intégrations" }).click();
  await expect(page.getByRole("heading", { name: "Intégrations" })).toBeVisible();
}

test("écran 16, connexion GitHub, Kanban synchronisé aller-retour", async ({ page }, info) => {
  const leaked: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      const body = await res.text().catch((e: unknown) => `unreadable: ${String(e)}`);
      if (body.includes(E2E_GH_TOKEN)) leaked.push(res.url());
    }
  });
  const s = suffix(info);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await openIntegrations(page);
  const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
  await expect(row("Git local").getByText("Actif")).toBeVisible();
  await expect(row("Figma (MCP)").getByRole("button", { name: "Connecter" })).toBeVisible();

  const github = row("PR, reviews, statuts CI");
  if (await github.getByRole("button", { name: "Connecter" }).isVisible()) {
    await github.getByRole("button", { name: "Connecter" }).click();
    await expect(page.getByRole("radio", { name: "Utiliser gh" })).toBeDisabled();
    await page.getByRole("radio", { name: "Jeton personnel" }).click();
    await page.getByLabel("Jeton").fill(E2E_GH_TOKEN);
    await page.getByRole("button", { name: "Connecter", exact: true }).last().click();
    await expect(page.getByText("Connecté en tant que adam")).toBeVisible();
  }
  await expect(github.getByText("compte adam")).toBeVisible();

  const imported = `Issue e2e ${s}`;
  const n = await ghCreate(imported);

  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await page.getByLabel("Nom").fill(`Sync ${s}`);
  await page.getByLabel("Clé").fill(`SY${s}`);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom").fill("Kanban GitHub");
  await page.getByRole("radio", { name: "Vue", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await page.getByRole("radio", { name: "Synchronisée · GitHub Issues" }).click();
  await page.getByRole("radio", { name: "adam/kibo" }).click();
  await page.getByRole("button", { name: "Ajouter et synchroniser" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(page.getByText("GitHub · adam/kibo")).toBeVisible();
  await expect(page.getByText(imported)).toBeVisible();

  const local = `Ticket e2e ${s}`;
  await page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }).click();
  await page.getByLabel("Titre").fill(local);
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByText(local)).toBeVisible();
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect.poll(async () => (await ghIssues()).some((i) => i.title === local)).toBe(true);

  const renamed = `Renommée e2e ${s}`;
  await ghRename(n, renamed);
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  await page.getByText(renamed).click();
  await expect(page.getByRole("link", { name: `#${n}` })).toBeVisible();

  expect(leaked).toEqual([]);
});
```

- Libellés : ceux de `fr-integrations.ts` (Task 1) et de la v0.1 ; la navigation « Paramètres › Intégrations » suit la phase 2 (si le lien porte un autre nom, l'utiliser tel qu'il est livré).
- Chaque projet Playwright (sombre, clair) crée son propre projet et ses propres issues (suffixe `D` / `L`) : les deux exécutions partagent le démon et le faux GitHub.
- La connexion GitHub est faite par la première exécution et constatée par la seconde.
- La lecture d'un corps de réponse qui échoue est enregistrée comme texte (`unreadable: …`), jamais ignorée.

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: PASS en `dark` et `light` (et le parcours v0.1 `mvp.spec.ts` toujours vert).

- [ ] **Step 5: Vérifier et commiter**

Run: `bun test packages components && bun run check && bun run typecheck && bun run --cwd e2e test` — Expected: PASS.

```bash
git add packages/daemon/src/integrations/leak.test.ts packages/daemon/src/testing/fake-github.ts packages/daemon/src/testing/fake-mcp.ts e2e/serve.ts e2e/token.ts e2e/integrations.spec.ts
git commit -m "test: fuite de secret et parcours E2E"
```

---

## Jalon v0.5

Aucun code. Le chef d'équipe, quand la Task 23 est intégrée :

- [ ] **Conformité** : CI verte sur `main` en macOS **et** Linux (`bun run check`, `bun run typecheck`, `bun test packages components`, E2E `dark` et `light`, smoke test Tauri avec `builtin/github-issues/server.js` présent).
- [ ] **Critères de sortie de la spec F §12** : aller-retour ticket ↔ issue (création, titre, description, statut, fermeture) vert en CI (`roundtrip.test.ts`, `integrations.spec.ts`) ; test de fuite vert (`leak.test.ts`) ; écran 16 conforme en sombre et en clair (page PDF 26 + état P1) ; dialogues conformes à P2 à P5.
- [ ] **Contrôle visuel** des écrans 16, 3 (source synchronisée, P6), 4 (Sheet : P7, P8, P9), P10, P11, en sombre et en clair, contre `design/pdf/kibo-design-{sombre,clair}.pdf` ; écarts notés dans le rapport.
- [ ] **Spec** : `docs/superpowers/specs/2026-09-26-kibo-integrations.md` §14 contient N1 à N21 ; tableau « Points d'ancrage » de ce plan à jour (colonne « Réel »).
- [ ] **Tag** : `git tag v0.5 && git push origin v0.5`.
- [ ] **Rapport** : `docs/superpowers/rapports/2026-09-26-jalon-v0.5.md` (livré, écarts de maquette, décisions N1 à N21, risques ouverts : formes réelles de l'API GitHub non vérifiées en CI, dépendance `@modelcontextprotocol/sdk`, `Bun.secrets` sous Linux, TOCTOU DNS), commit `docs: rapport du jalon v0.5`.
- [ ] **Contrôle manuel optionnel** (non bloquant, spec F « Comptes et secrets réels ») : Adam, sur un dépôt de test avec un Project v2 et un jeton (`repo`, `project`), puis Figma desktop avec le serveur Dev Mode ; retours consignés dans le rapport.
- [ ] **Suite** : sur décision d'Adam, les phases s'enchaînent jusqu'à la 7 sans attente ; le chef d'équipe passe directement au plan de la phase 6.
