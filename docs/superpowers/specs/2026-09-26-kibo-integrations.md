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
- `blocked` n'est jamais appliqué depuis le distant (motif obligatoire, spec §5) ; un ticket local bloqué pousse l'option mappée à `blocked` si elle existe, sinon rien.
- Suppression : supprimer un ticket lié ne supprime ni ne ferme l'issue (la ligne de sync est retirée) ; une issue supprimée ou transférée (404/410) passe la réf. en `url: null` et marque le ticket « Lien GitHub rompu ».
- Sous-tickets : non synchronisés (les sous-issues GitHub sont hors périmètre, §12).

### 5.5 Limites de débit

Lecture de `x-ratelimit-remaining` / `x-ratelimit-reset` et de `retry-after` ; sous 100 requêtes restantes, les jobs de pull de toutes les liaisons GitHub sont suspendus jusqu'au reset ; l'écran 16 affiche « Limite GitHub atteinte, reprise à HH:MM ».

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
- Règle (moteur de la phase 2) : `ci.failed` ⇒ notification système (M1) « CI cassée sur KIB-n » ; aucune règle de statut par défaut.

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

## Comptes et secrets réels

Aucun pour la CI. Optionnel, pour une vérification manuelle : un dépôt GitHub de test avec un Project v2 et un jeton (portées `repo`, `project`), l'application Figma desktop avec le serveur Dev Mode activé (compte Figma avec siège Dev ou Full).
