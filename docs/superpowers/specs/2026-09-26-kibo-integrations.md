# Kibo — Spec F : intégrations V1 (phase 5)

- **Date** : 2026-09-26 · **Phase** : 5 (v0.5) · **Statut** : à valider
- **Parent** : `2026-09-25-kibo-design.md` §5, §6 « Sources de données », §9, §10 · **Maquettes** : écrans 3 (choix de la source), 4 (Sheet), 16 (Intégrations)
- **Suppose livrés** : phase 3 (G2 via `gh`, `externalRefs` et `upsertExternalRef`, suivi des PR par `gh pr view`) ; phase 4 (backend `server.ts` en Worker, `componentCall`, `fetch` proxifié, permissions `net`, `granted`, registre). M1 (notifications système) vient de la phase 2.

## 1. Objectif

Brancher Kibo sur les services où vivent déjà les données (GitHub Issues/Projects, GitHub Actions, Figma, n'importe quel serveur MCP), par des adaptateurs `pull / push / map` déterministes, hors ligne d'abord, sans jamais exposer un secret à un composant, au CRDT ou aux logs.

## 2. Périmètre

| Id | Livré |
|---|---|
| — | Contrat d'adaptateur, moteur de sync générique (boîte d'envoi, fusion à trois, anti-écho), `SecretStore` |
| T1 | GitHub Issues (aller-retour) et champ « Status » d'un GitHub Project v2 (aller-retour) |
| C1 | GitHub Actions : runs, jobs et logs liés à la PR et au ticket (lecture seule) |
| D1 | Figma via MCP : nœuds liés aux tickets, aperçus en cache |
| X1 | Connecteur MCP générique : serveurs configurés, outils appelables par les composants autorisés, composant « Source MCP » |
| UI | Écran 16 complet (états Actif / Connecté / Connecter / Erreur, menu `⋯`), dialogues de connexion, choix de source synchronisée à l'écran 3, sections du Sheet |

## 3. Modèle de données

### 3.1 Références externes (doc projet, champ du ticket)

La phase 3 (`2026-09-26-kibo-code-onglets.md` §6) introduit `externalRefs` et la commande `upsertExternalRef` avec `{ kind: "github_pr", url, number, state }`. La phase 5 étend l'union, sans renommer l'existant :

```ts
export const ExternalRef = z.discriminatedUnion("kind", [
  GithubPrRef,                                                                                      // phase 3, inchangé
  z.object({ kind: z.literal("github_issue"), bindingId: z.string(), repo: RepoSlug,
             number: z.number().int().nullable(), nodeId: z.string().nullable(), url: z.string().url().nullable() }),   // null = création en attente
  z.object({ kind: z.literal("figma_node"), fileKey: z.string(), nodeId: z.string(), url: z.string().url(), name: z.string() }),
  z.object({ kind: z.literal("mcp_item"), server: z.string(), itemId: z.string(), url: z.string().url().nullable(), title: z.string() }),
]);
```

`RepoSlug = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/`. `upsertExternalRef` dédoublonne par une clé propre à chaque type : `url` (`github_pr`), `bindingId` (`github_issue` : une issue par liaison et par ticket), `fileKey + nodeId` (`figma_node`), `server + itemId` (`mcp_item`). Ajout : `removeExternalRef { ticketId, kind, key }`. Ces commandes restent réservées au shell et au démon.

### 3.2 Liaison de synchronisation (doc projet, `bindings: LoroMap`)

```ts
export const Binding = z.object({
  id: z.string(),
  adapter: z.enum(["github-issues"]),
  config: z.object({
    repo: RepoSlug,
    project: z.object({ owner: z.string(), number: z.number().int(), statusFieldId: z.string(),
                        statusMap: z.record(StatusId, z.string()) }).nullable(),   // statut Kibo → optionId
    importClosed: z.boolean().default(false),
    labels: z.array(z.string()).default([]),                                          // filtre d'import, vide = tout
  }),
  createdBy: z.string(),
  runner: z.string(),   // utilisateur dont la machine exécute la sync (spec G §6.4) ; = createdBy en local
});
```

Une instance synchronisée (Kanban, Tickets) porte `config.source = { bindingId }` et n'affiche que les tickets ayant une `externalRef` de cette liaison. Plusieurs instances peuvent partager une liaison.

### 3.3 État local de sync (SQLite, hors CRDT, propre à la machine)

```
sync_items(bindingId, remoteId, ticketId, baseJson, remoteUpdatedAt, lastPushedHash)   -- base de la fusion à trois
sync_cursors(bindingId, cursor, lastPullAt, lastError)
sync_outbox(id, bindingId, ticketId, op, payloadJson, attempts, nextAttemptAt, lastError)  -- append puis supprimé à l'ack
ci_runs(repo, runId, headSha, headBranch, prNumber, workflow, status, conclusion, url, startedAt, updatedAt)
ci_jobs(runId, jobId, name, status, conclusion, logPath, steps_json)
mcp_servers(id, name, transport, command, args_json, env_names_json, url, secretName, enabled, createdAt)
figma_cache(fileKey, nodeId, pngPath, fetchedAt)
integration_events(at, integration, level, message)   -- append-only, messages déjà caviardés
```

La config des serveurs MCP est **locale** (jamais dans le CRDT) : une commande exécutable ne doit jamais arriver par la sync d'un projet.

### 3.4 Secrets

```ts
export type SecretName = `${"github" | "mcp" | "figma"}${"" | `:${string}`}`; // ex. "github", "mcp:context7"
export type SecretStore = {
  has(name: SecretName): Promise<boolean>;
  get(name: SecretName): Promise<string | null>;   // démon seulement
  set(name: SecretName, value: string): Promise<void>;
  delete(name: SecretName): Promise<void>;
};
```

- Implémentation : **`Bun.secrets`** (service `dev.kibo`, compte = `SecretName`), qui appelle Keychain (macOS) et Secret Service/libsecret (Linux) sans passer le secret en argument de processus. Raison : un binaire système (`security add-generic-password -w <secret>`) exposerait le secret dans la liste des processus ; `Bun.secrets` est natif au runtime déjà utilisé, sans nouvelle dépendance. Écart avec la consigne « binaire système », à confirmer par le chef d'équipe.
- Linux sans Secret Service (pas de trousseau déverrouillé) : `SECRET_STORE_UNAVAILABLE`, l'intégration reste « Non connectée » avec l'explication ; **aucun repli en clair**.
- Tests : `MemorySecretStore` injecté ; un test d'intégration optionnel (`KIBO_TEST_KEYCHAIN=1`) exerce le vrai trousseau en local.
- L'UI ne lit jamais un secret : elle ne voit que `has`.
- Caviardage : tout secret lu est ajouté à un ensemble en mémoire ; le logger du démon, `integration_events` et les messages d'erreur remplacent chaque occurrence par `***`.

## 4. Contrat d'adaptateur

```ts
// packages/sdk/src/adapter.ts — utilisable par tout composant synchronisé
export type SyncedFields = { title: string; description: string; statusId: StatusId; closed: boolean };
export type PushOp =
  | { kind: "create"; ticketId: string; fields: SyncedFields }
  | { kind: "update"; remoteId: string; patch: Partial<SyncedFields> };

export type Adapter<R, C> = {
  id: string;
  remote: z.ZodType<R>;                                          // tout objet distant est validé
  pull(ctx: AdapterContext<C>, cursor: string | null): Promise<{ items: R[]; cursor: string | null; more: boolean }>;
  push(ctx: AdapterContext<C>, op: PushOp): Promise<R>;          // renvoie l'état distant après écriture
  map: {
    remoteId(r: R): string;
    updatedAt(r: R): string;                                     // ISO 8601
    toFields(r: R, c: C): SyncedFields;
    toRef(r: R, bindingId: string): ExternalRef;
  };
};
export type AdapterContext<C> = { config: C; fetch: KiboSdk["fetch"]; signal: AbortSignal };
export function defineAdapter<R, C>(a: Adapter<R, C>): Adapter<R, C>;
```

- L'adaptateur est **pur vis-à-vis de Kibo** : il ne lit ni n'écrit de ticket ; il traduit. Le moteur (`packages/daemon/src/sync/engine.ts`) fait le reste.
- Le cœur de décision est une fonction pure de `core` : `planSync({ base, local, remote }): SyncPlan` (champ par champ), testée par propriétés.
- L'adaptateur GitHub Issues vit dans `components/github-issues/server.ts` (composant intégré, Worker, dogfooding du SDK) ; manifeste : `reads [ticket, status]`, `writes []`, `net ["api.github.com"]`, `secrets [{ name: "github", hosts: ["api.github.com"] }]`.

### 4.1 Ajout au manifeste (phase 5)

```ts
secrets: z.array(z.object({ name: SecretNameSchema, hosts: z.array(z.string()).min(1) })).default([]),
mcp: z.array(z.string().regex(/^[a-z0-9-]+(\/[A-Za-z0-9_.-]+)?$/)).default([]),   // "context7" ou "context7/get-library-docs"
```

- `secrets` : le proxy `fetch` du démon ajoute `authorization: Bearer <secret>` **seulement** vers les hôtes listés et couverts par `net`. Le composant ne voit jamais la valeur. Libellé écran 30 : « Utiliser ton compte GitHub (api.github.com) ».
- `mcp` : autorise `sdk.mcp.call(server, tool, args)` et `sdk.mcp.read(server, uri)` sur ces serveurs ou outils (§8). Libellé : « Appeler le serveur MCP context7 ».
- `componentCall` gagne `{ kind: "mcp.call", server, tool, args }` et `{ kind: "mcp.read", server, uri }`, contrôlés comme au §6.4 de la spec B.

## 5. Moteur de sync (T1)

### 5.1 Pull

1. Job de liaison toutes les **60 s** (et à la demande : bouton « Synchroniser », ouverture d'une page liée), jamais deux en parallèle pour une liaison, seulement si `binding.runner` = utilisateur local.
2. `adapter.pull(cursor)` jusqu'à `more = false` ; GitHub : `GET /repos/{repo}/issues?state=all&since=<cursor>&per_page=100&sort=updated&direction=asc`, `If-None-Match` sur l'ETag ; les PR (`pull_request` présent) sont ignorées.
3. Pour chaque élément : si `sync_items` le connaît ⇒ fusion (§5.3) ; sinon, s'il passe les filtres (`labels`, `importClosed`) ⇒ `createTicket` + `upsertExternalRef` (statut initial : `done` si fermé, sinon statut mappé du Project, sinon `todo`).
4. Curseur = plus grand `updated_at` vu ; écrit après application des éléments.

### 5.2 Push (boîte d'envoi)

- Un changement local d'un champ synchronisé sur un ticket lié (ou `createTicket` depuis une instance liée) ajoute une ligne à `sync_outbox` dans la même transaction que la persistance du doc. Hors ligne, la boîte s'accumule.
- Envoi FIFO par liaison ; échec réseau ou 5xx ⇒ backoff exponentiel (5 s → 30 min) ; 4xx non 409/422 ⇒ erreur affichée sur le ticket et la liaison, ligne conservée jusqu'à action (« Réessayer » / « Abandonner »).
- Création : `POST /repos/{repo}/issues`, puis la réf. est complétée (`number`, `nodeId`, `url`). Si le Project est configuré : `addProjectV2ItemById` puis `updateProjectV2ItemFieldValue` (GraphQL).
- Mise à jour : `PATCH /repos/{repo}/issues/{n}` (`title`, `body`, `state`) et champ Status du Project.
- Anti-écho : après chaque push, `lastPushedHash` = hash des champs renvoyés, `base` = ces champs ; le pull suivant qui renvoie le même hash n'est pas une modification distante.

### 5.3 Fusion à trois (champ par champ)

| local ≠ base | distant ≠ base | Résultat |
|---|---|---|
| non | non | rien |
| oui | non | push du champ |
| non | oui | application locale |
| oui | oui | **le distant gagne** ; la valeur locale écrasée est journalisée (`integration_events`) et signalée par un toast « Conflit résolu sur KIB-n : titre repris de GitHub » |

Raison : pour un ticket lié, GitHub est l'espace partagé de référence ; la valeur perdue reste consultable.

### 5.4 Correspondance des statuts

- Sans Project : `closed = true` ⇔ `statusId = done`. Distant rouvert ⇒ `todo` si le statut local était `done`. Statut local ≠ `done` ⇒ `state = open`.
- Avec Project : `statusMap` fait foi dans les deux sens ; un statut sans correspondance n'est pas poussé.
- `blocked` n'est jamais appliqué depuis le distant (motif obligatoire, spec §5) ; un ticket local bloqué pousse l'option mappée à `blocked` si elle existe, sinon rien ; une issue rouverte avec l'option de `blocked` rouvre un ticket `done` en `todo` (N37).
- Suppression : supprimer un ticket lié ne supprime ni ne ferme l'issue (la ligne de sync est retirée) ; une issue supprimée ou transférée (404/410) passe la réf. en `url: null` et marque le ticket « Lien GitHub rompu ».
- Sous-tickets : non synchronisés (les sous-issues GitHub sont hors périmètre, §12).

### 5.5 Limites de débit

Lecture de `x-ratelimit-remaining` / `x-ratelimit-reset` et de `retry-after` ; sous 100 requêtes restantes, les jobs de pull de toutes les liaisons GitHub sont suspendus jusqu'au reset (seules comptent les réponses à une requête portant le jeton, N40) ; l'écran 16 affiche « Limite GitHub atteinte, reprise à HH:MM ».

## 6. GitHub : authentification et configuration

- **Connexion** (écran 16, GitHub › Connecter) : deux choix.
  1. **Utiliser `gh`** (recommandé si `gh auth status` réussit) : le démon lit `gh auth token` à la demande (cache mémoire 10 min), **ne le stocke pas**.
  2. **Jeton personnel** : saisi dans le dialogue, vérifié par `GET /user`, stocké par `SecretStore.set("github")`.
- Portées requises affichées : `repo`, `project` (Projects v2), `workflow` non requis ; `read:org` si le Project appartient à une organisation.
- Une seule identité GitHub par workspace (sous-texte « compte adam »). GitHub, GitHub Issues & Projects et GitHub Actions partagent ce compte ; chaque ligne de l'écran 16 a son propre état (Actions « Connecté » dès que le compte l'est et qu'un projet a un dépôt GitHub).
- Base d'API configurable pour les tests : `KIBO_GITHUB_API` (défaut `https://api.github.com`) ; le proxy `fetch` accepte alors cette origine de test **uniquement** si le démon est lancé avec `--test-origins` (refusé sinon).
- OAuth (device flow) : hors périmètre (exige une application OAuth enregistrée, §12).

## 7. C1 · GitHub Actions

- Job par projet ayant un dépôt GitHub, toutes les **60 s** tant qu'une PR liée à un ticket non terminé existe, sinon toutes les 15 min : `GET /repos/{repo}/actions/runs?head_sha=<sha>` pour la tête de chaque PR liée (`github_pr`), puis `GET /actions/runs/{id}/jobs`.
- Logs : téléchargés **à la demande** (`GET /actions/jobs/{id}/logs`, redirection suivie vers `*.actions.githubusercontent.com`, hôte ajouté aux règles internes de l'intégration), stockés dans `<KIBO_HOME>/cache/ci/<runId>/<jobId>.log` (`0600`), 20 Mio max par job, purge après 14 jours.
- Entité SDK en lecture seule `ci_run` (`reads: ci_run`) : `{ repo, runId, prNumber, ticketKey | null, workflow, status, conclusion, url, updatedAt, jobs: { name, status, conclusion }[] }`.
- UI : section « CI » du Sheet ticket (dernier run par workflow, pastille, durée, « Voir les logs » ⇒ aperçu dans un Sheet avec recherche, lignes d'erreur surlignées) ; chip de CI sur les cartes Kanban liées à une PR (état seulement).
- Échec de CI : `ci.failed` ⇒ notification système (M1) « CI cassée sur KIB-n », émise par le sondeur CI (le moteur de règles de la phase 2 ne change que des statuts, voir §14 N25) ; aucune règle de statut par défaut.

## 8. MCP (D1 et X1)

### 8.1 Hub MCP (`packages/daemon/src/mcp/`)

- Dépendance nouvelle : `@modelcontextprotocol/sdk` (client officiel ; transports stdio et Streamable HTTP ; aucun `postinstall`).
- Serveur configuré : `{ id, name, transport: "stdio" | "http", command?, args?, envNames?, url?, secretName? }`.
  - stdio : lancé avec `env` réduit à `PATH`, `HOME`, `LANG` et aux variables nommées dans `envNames` dont les valeurs viennent du `SecretStore` (`mcp:<id>:<VAR>`) ; `cwd` = `<KIBO_HOME>/mcp/<id>` ; arrêté après 10 min d'inactivité.
  - http : `https:` obligatoire sauf loopback ; `Authorization: Bearer` depuis `mcp:<id>` si configuré.
- Au démarrage d'une connexion : `initialize`, `tools/list`, `resources/list` mis en cache ; état exposé à l'écran 16 (« Connecté · 2 serveurs (context7, filesystem) », ou erreur).
- Appel : délai 60 s, résultat tronqué à 1 Mio, contenu texte et images (base64) seulement ; chaque appel journalisé (`at, server, tool, instanceId, durationMs, ok`), jamais ses arguments.
- Ajout d'un serveur : dialogue (Nom, Type, Commande + arguments ou URL, Variables secrètes) ; confirmation explicite qui **affiche la commande exacte** qui sera exécutée. Import depuis la config Claude Code : hors périmètre.

### 8.2 D1 · Figma

- Serveur MCP Figma **local** (serveur Dev Mode de l'application Figma, `http://127.0.0.1:3845/mcp` par défaut, modifiable) : aucun secret stocké par Kibo. Raison : le serveur distant exige OAuth et une application enregistrée.
- Lier un nœud : coller une URL `figma.com/design/<fileKey>/…?node-id=<a-b>` dans le Sheet (section « Maquettes ») ⇒ `upsertExternalRef { kind: "figma_node" }` ; le nom vient de l'outil de métadonnées du serveur.
- Aperçu : outil de capture du serveur (`get_screenshot` à la date de la spec ; noms d'outils vérifiés par `tools/list`, sinon « Aperçu indisponible »), PNG mis en cache (`figma_cache`, 7 jours, 2 Mio max).
- `brief.md` (phase 2) inclut les URL des nœuds liés.
- Figma hors ligne ou appli fermée : la réf. reste, l'aperçu en cache s'affiche, badge « Figma non joignable ».

### 8.3 X1 · Composant « Source MCP » (`components/mcp-source`)

- Manifeste : `kind widget`, `reads [ticket]`, `writes [ticket]`, `mcp` rempli à l'ajout (le serveur choisi), `data true`.
- Config : `{ server, mode: "tool" | "resource", tool?, args?, uri?, refreshMinutes (≥ 5), mapping: { items: JSONPointer, id, title, subtitle?, url? } }`.
- Affiche la liste des éléments ; action « Créer un ticket » ⇒ `createTicket` + réf. `mcp_item`. Pas de synchronisation automatique de tickets.
- Tout composant tiers peut utiliser `sdk.mcp` avec la permission `mcp` ; en sandboxé, contrôle par le démon à chaque appel.

## 9. Flux UI

- **Écran 16** : une ligne par intégration (Git local, GitHub, GitHub Issues & Projects, GitHub Actions, Figma (MCP), Notifications système, Markdown / Obsidian, Serveurs MCP) ; états `Actif` (sans compte), `Connecté` (+ sous-texte), `Connecter` (bouton), `Erreur` (message court + « Réessayer ») ; menu `⋯` : Configurer, Tester la connexion, Déconnecter (supprime le secret après confirmation).
- **Ajouter un composant (écran 3)** pour Kanban / Tickets : Source « Locale » ou « Synchronisée · GitHub Issues » ⇒ dépôt (liste depuis `GET /user/repos`, filtrable), Project optionnel et correspondance des statuts (pré-remplie par libellés identiques), filtre par libellés, import des fermées ; première sync lancée à la validation avec progression.
- **Sheet ticket** : chips GitHub (issue, PR), section CI, section Maquettes (Figma), état « Synchronisation en attente » tant que la boîte d'envoi contient le ticket.
- **À dessiner dans Penpot avant implémentation** : dialogues de connexion GitHub / Figma / serveur MCP, état « non connectée » et erreur de l'écran 16, choix de source synchronisée de l'écran 3, sections CI et Maquettes du Sheet, widget Source MCP.

## 10. Sécurité

- Secrets uniquement dans le trousseau ; jamais dans le CRDT, SQLite, fichiers, logs, messages d'erreur, `brief.md`, env d'un agent.
- Un composant n'obtient une authentification que via `secrets` × `net`, jamais la valeur.
- Config MCP locale ; commande affichée avant la première exécution ; env minimal.
- Tout objet distant validé par Zod avant usage ; Markdown des issues rendu sans HTML brut.
- Aucune écoute réseau ajoutée (pas de webhooks entrants) : tout est en pull.
- Test « fuite de secret » : après un scénario complet avec le secret factice `ghp_TESTSECRET…`, recherche de la valeur dans le snapshot Loro exporté, `kibo.db`, les logs capturés et les réponses RPC : zéro occurrence.

## 11. Tests (aucun compte réel en CI)

| Niveau | Cas |
|---|---|
| core | `planSync` : table §5.3 ; propriété fast-check : après pull puis push sans nouvelle modification, un second cycle ne produit aucune opération (point fixe) |
| faux GitHub | `packages/daemon/src/testing/fake-github.ts` (Bun.serve) : issues REST (liste `since`, ETag/304, création, PATCH, 404, 422, limites de débit), GraphQL Projects v2 (3 mutations et requête des champs), Actions (runs, jobs, logs avec redirection) ; état en mémoire manipulable par le test |
| sync | aller-retour : ticket créé ⇒ issue ; issue renommée ⇒ ticket renommé ; conflit ⇒ distant gagne et événement ; hors ligne ⇒ boîte d'envoi ⇒ reprise ; 403 limite ⇒ suspension |
| faux MCP | `fake-mcp.ts` : serveur MCP stdio et HTTP construit avec le SDK serveur MCP (outils `echo`, `list_items`, `get_screenshot`, `get_metadata`, outil lent, outil en erreur) |
| MCP | listage, appel, délai, troncature, permission `mcp` refusée pour un composant sandboxé non autorisé |
| secrets | `MemorySecretStore` ; caviardage ; test de fuite (§10) |
| e2e | Playwright : écran 16 (sombre et clair) avec faux GitHub et faux MCP ; ajout d'un Kanban synchronisé ; aller-retour visible |

## 12. Critères de sortie

- Aller-retour ticket ↔ issue (création, titre, description, statut, fermeture) contre le faux GitHub en CI macOS et Linux.
- Test de fuite de secret vert.
- Écran 16 conforme en sombre et en clair ; dialogues de connexion conformes à leurs maquettes une fois dessinées.
- Contrôle manuel optionnel par Adam sur un vrai dépôt de test (voir « comptes requis ») ; non bloquant pour la CI.

## 13. Hors périmètre

- OAuth GitHub (device flow), comptes GitHub multiples, GitHub Enterprise.
- Sous-issues GitHub ⇔ sous-tickets, assignés GitHub ⇔ assignés Kibo, commentaires.
- Webhooks entrants ; GitLab, Linear, Jira et les autres intégrations « plus tard » de la spec §9.
- Figma distant (OAuth) ; édition Figma depuis Kibo.
- Synchronisation automatique de tickets depuis un serveur MCP.

## 14. Décisions du plan

Recopiées mot pour mot de `docs/superpowers/plans/2026-09-26-kibo-integrations.md` (« Décisions nouvelles »). N1 à N21 : écriture du plan ; N22 à N36 : réconciliation avec le code livré des phases 2 à 4 (tâche T0, 2026-09-26) ; N37 et N38 : revue de la tâche 5 (fusion à trois), 2026-09-26 ; N39 : revue de la tâche 14 (moteur de sync), 2026-09-26 ; N40 et N41 : revue de la tâche 8 (réseau), 2026-09-26.

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
- **N43 · Création refusée, création incertaine** (décision du chef d'équipe) : seule une tentative de création à issue inconnue (délai dépassé, erreur réseau, 5xx) rend la création incertaine et bloque les imports de la liaison (N39) ; ce marqueur, posé sur la ligne d'envoi, reste jusqu'à l'adoption ou l'abandon. Un refus définitif (4xx) d'une création jamais incertaine ne bloque pas les imports : l'issue n'existe pas côté GitHub, aucun doublon possible (N5).

## Comptes et secrets réels

Aucun pour la CI. Optionnel, pour une vérification manuelle : un dépôt GitHub de test avec un Project v2 et un jeton (portées `repo`, `project`), l'application Figma desktop avec le serveur Dev Mode activé (compte Figma avec siège Dev ou Full).
