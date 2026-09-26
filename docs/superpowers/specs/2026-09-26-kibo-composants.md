# Kibo — Spec B : système de composants complet (phase 4)

- **Date** : 2026-09-26 · **Phase** : 4 (v0.4) · **Statut** : à valider
- **Parent** : `2026-09-25-kibo-design.md` §5, §6, §10, §11 · **Maquettes** : écrans 3, 6, 7, 10, 11, 29, 30 (sombre et clair)
- **Suppose livrés** : v0.1 (manifeste, SDK, `ProjectCommand`, démon) ; phase 3 (`2026-09-26-kibo-code-onglets.md` : CodeMirror 6, aperçu de fichier, `sdk.openFile`, onglets, table `local_state`). La phase 4 ne dépend pas de la phase 2, sauf pour afficher les agents sur le graphe (lecture de `assignee`, déjà dans le ticket).

## 1. Objectif

Qu'un composant écrit hors du monorepo (par l'utilisateur, plus tard par l'IA ou la marketplace) puisse être créé, validé, versionné, isolé et mis à jour sans risque pour les données, avec la même API que les composants intégrés. Livrer en plus deux composants intégrés : **Graphe de dépendances** et **Notes** (N1 Markdown / Obsidian).

## 2. Périmètre

1. Manifeste v1 (permissions `data`, `net`, `configVersion`, `changes`) et nouvelles entités `note`.
2. Paquet de composant, empreinte, magasin immuable, registre dans le doc workspace.
3. Confiance : `builtin`, `trusted`, `sandboxed` ; empreinte modifiée ⇒ confiance redemandée.
4. Sandbox UI (iframe d'origine séparée, RPC postMessage) et sandbox backend (processus Bun séparé).
5. Permissions vérifiées par le démon à chaque appel d'un composant sandboxé.
6. Backend `server.ts` : actions et jobs planifiés ; données d'instance.
7. Versioning semver, migrations, « Mettre à jour partout » / « Créer une nouvelle version », mise à jour d'une instance.
8. Outillage : `packages/devkit` (générateur, build, validation) et CLI `kibo component new|test|dev|publish`.
9. Composants `graph` et `notes` ; indexation d'un dossier Markdown / vault Obsidian.

## 3. Modèle de données

### 3.1 Manifeste v1 (`packages/schema/src/manifest.ts`)

Compatible avec les manifestes v0 (tous les nouveaux champs sont optionnels avec défaut).

```ts
export const BuiltinEntityType = z.enum(["ticket", "status", "link", "page", "run", "note"]);
export const NetRule = z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~\/-]*)?$/); // "api.github.com/graphql"
export const ComponentManifest = z.object({
  id, version, kind, title, description,          // inchangés
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean().default(false),               // espace de données privé de l'instance
  net: z.array(NetRule).default([]),              // HTTPS via le proxy du démon, jamais en direct
  configSchema: z.record(z.string(), z.unknown()).optional(),
  configVersion: z.number().int().nonnegative().default(0),
  changes: z.array(z.string().min(1)).default([]), // notes de version affichées au publish
  sdk: z.literal(1).default(1),                   // version majeure de l'API du SDK
});
```

- `EntityType` du v0 devient `BuiltinEntityType` (alias conservé). `run` (état du dernier run d'agent de chaque ticket, lecture seule, ajouté en phase 2) est conservé ; `note` s'ajoute (§8.2).
- `net` : hôte + préfixe de chemin, HTTPS uniquement, sans joker, sans port, sans IP. Affichage : `net:api.github.com/graphql` (écran 6).
- La phase 5 ajoute `secrets` et `mcp` (spec F §4.1) ; les phases 6 et 7 n'ajoutent aucun champ.
- **Entités déclarées par un composant** (`acme.bug`, spec §5) : hors périmètre de la phase 4 (voir §14).

### 3.2 Paquet source et empreinte

Arborescence d'un composant utilisateur (spec §6), dans `<KIBO_HOME>/components/src/<id>/` :

```
kibo.component.json  ui.tsx  server.ts?  migrations.ts?  component.test.tsx  (+ *.ts, *.tsx, *.css internes)
```

- **Empreinte** = SHA-256 hex d'un encodage canonique des **sources** : fichiers triés par chemin POSIX, chacun encodé `chemin \0 taille décimale \0 octets`. Sont inclus : manifeste, `*.ts`, `*.tsx`, `*.css`. Sont exclus : `*.test.ts(x)`, `node_modules/`, `dist/`, fichiers cachés. Raison : la confiance porte sur le code qu'on peut relire ; le build en est dérivé par le démon.
- Affichage court : `sha256 3f9a…c21e` (4 premiers + 4 derniers caractères).
- Imports autorisés dans un composant non intégré : chemins relatifs, `@kibo/sdk` et ses sous-chemins, `react`, `lucide-react`. Tout autre import (y compris `node:*`, `bun:*`, `bun`) fait échouer le build (`VALIDATION_FAILED`). Raison : aucune dépendance npm donc aucune chaîne d'approvisionnement ni `postinstall`.

### 3.3 Magasin immuable

`<KIBO_HOME>/components/store/<id>/<version>/<hash>/` (dossiers `0700`, fichiers `0400`) :

```
source/            copie exacte des sources hachées
build/ui.sandbox.js  build/ui.trusted.js  build/ui.css  build/server.js?  build/migrations.js?
build.json         { kiboVersion, builtAt, files: { chemin: sha256 } }
```

Le démon produit `build/` lui-même depuis `source/` (jamais depuis un build fourni). Au chargement, il revérifie l'empreinte de `source/` et les sha256 de `build.json`, puis sert les fichiers **depuis la mémoire** (pas de relecture disque entre vérification et service).

### 3.4 Registre (doc Loro workspace, clé `componentRegistry`)

```ts
export const TrustLevel = z.enum(["builtin", "trusted", "sandboxed"]);
export const ComponentOrigin = z.enum(["kibo", "user", "ai", "marketplace"]);
export const RegistryVersion = z.object({
  version: SemVer,
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  origin: ComponentOrigin,
  trust: TrustLevel.nullable(),          // null = confiance à accorder
  approvedHash: z.string().nullable(),   // empreinte approuvée par l'utilisateur
  granted: GrantedPermissions,           // { reads, writes, data, net } approuvés
  publishedAt: z.number().int(),
});
// componentRegistry : Record<componentId, { title, versions: Record<version, RegistryVersion> }>
```

- Les intégrés (`kanban`, `tickets`, `graph`, `notes`) ne sont pas dans le registre : ils sont compilés dans l'UI, `trust = builtin`, origine `kibo`.
- Le doc workspace n'est jamais synchronisé (spec G) : la confiance reste propre à la machine.
- Une version est **active** si `trust !== null` et `approvedHash === hash` ; sinon ses instances affichent l'état « Autorisation requise ».

### 3.5 Données d'instance

`instances[id].data` : `LoroMap` dans le doc projet (spec §5), valeurs JSON, **256 Kio max** par instance (sérialisé), clés `^[A-Za-z0-9._-]{1,128}$`. Accessible seulement si `manifest.data === true`, et seulement pour sa propre instance.

### 3.6 Nouvelles `ProjectCommand` (réservées au shell et au démon, `WRITES = null`)

```ts
{ method: "setInstanceComponent", instanceId, component: ComponentRef, config: Record<string, unknown>, data: Record<string, unknown> | null }
{ method: "setInstanceConfig", instanceId, config: Record<string, unknown> }
{ method: "setInstanceData", instanceId, key: string, value: unknown | null }  // null = suppression ; appelée par le démon seulement
```

`setInstanceData` n'est pas exposée telle quelle aux composants : le démon la produit à partir de `data.set` après contrôle (§6).

## 4. Confiance et sandbox

### 4.1 Niveaux

| | `builtin` | `trusted` (« Confiance totale ») | `sandboxed` (« Sandboxé », recommandé) |
|---|---|---|---|
| UI | module compilé dans l'UI | module ES chargé dans l'app (§4.3) | iframe d'origine séparée (§4.2) |
| Backend | Worker Bun dans le démon | Worker Bun dans le démon | processus Bun séparé (§4.4) |
| Permissions | déclarées, contrôle SDK | acceptées à l'installation, contrôle SDK | **vérifiées par le démon à chaque appel** |

Défaut proposé dans l'écran 30 : `sandboxed` pour toute origine autre que `kibo`.

### 4.2 UI sandboxée

- Le démon ouvre un **second listener** `127.0.0.1:<sandboxPort>` (par défaut port UI + 1 ; `0` en test), qui ne sert **que** `GET /c/<id>/<version>/<hash>/(index.html|ui.sandbox.js|ui.css)`. Pas d'`/api`, pas de cookie lu, pas de `Set-Cookie`. Toute autre route : 404.
- En-têtes de ces réponses :
  `content-security-policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; frame-ancestors http://127.0.0.1:<uiPort> http://localhost:<uiPort>; base-uri 'none'; form-action 'none'`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `cross-origin-resource-policy: same-site`.
- Le CSP de l'UI principale gagne `frame-src http://127.0.0.1:<sandboxPort>`.
- L'hôte (`packages/ui/src/shell/SandboxFrame.tsx`) crée `<iframe sandbox="allow-scripts" src=… referrerpolicy="no-referrer">` sans `allow-same-origin` : le document a une origine opaque (`"null"`), le port séparé est une défense en profondeur.
- `ui.sandbox.js` est autonome : il embarque React, les primitives shadcn du SDK et `mountSandboxed(manifest, Component)` de `@kibo/sdk/sandbox`.
- Thème : l'hôte transmet `theme: "dark" | "light"` à l'init et à chaque changement ; `ui.css` contient les tokens zinc des deux thèmes.
- Raccourcis : le runtime relaie à l'hôte `⌘K`, `⌘T`, `⌘W`, `⌘1…9`, `Échap` (message `key`). Les dialogues et Sheets d'un composant sandboxé restent dans son cadre (limite acceptée).

### 4.3 UI trusted non intégrée

`ui.trusted.js` est construit avec `react`, `react-dom`, `@kibo/sdk` et `lucide-react` en externes, réécrits vers `globalThis.__kiboShared` (exposé par l'UI au démarrage). Chargé par `import()` depuis `GET /components/<id>/<version>/<hash>/ui.trusted.js` sur le port principal (cookie de session requis), `ui.css` injecté en `<link>`. Rendu dans l'arbre React de l'app avec `SdkProvider`.

### 4.4 Backend

- Hôte unique `ComponentBackendHost` avec deux implémentations au même protocole (§6.3) : `WorkerHost` (intégrés, trusted) et `ProcessHost` (sandboxed).
- `ProcessHost` lance `process.execPath` avec l'argument `component-runtime` (le binaire du démon sert de runtime ; en dev, `bun packages/daemon/src/component-runtime.ts`) :
  - `env` vide sauf `KIBO_COMPONENT=<id>@<version>` ; `cwd` = dossier temporaire vide `0700` supprimé à l'arrêt ; `stdin`/`stdout` = canal IPC Bun (`ipc`) ; `stderr` journalisé (tronqué à 64 Kio).
  - Avant d'évaluer `server.js`, le runtime retire `fetch`, `WebSocket`, `XMLHttpRequest`, `EventSource`, `Bun.spawn`, `Bun.file`, `Bun.write`, `Bun.connect`, `Bun.listen`, `Bun.serve`, `process.binding`, `process.dlopen`, et gèle `globalThis`. Les imports `node:*`/`bun:*` sont déjà refusés au build (§3.2).
  - Un processus par `id@version`, démarré au premier appel, arrêté après 5 min d'inactivité ; délai par appel 30 s ; 4 appels simultanés max ; crash ⇒ erreur `COMPONENT_CRASHED` à l'appelant, redémarrage avec backoff (1 s, 5 s, 30 s).
- **Limite assumée** : en phase 4, l'isolation réseau et disque du processus repose sur le retrait des capacités et le refus des imports, pas sur l'OS. Le durcissement OS (bubblewrap, `sandbox-exec`) est en phase 7 (spec H §8). L'écran 30 ne promet rien de plus que « iframe isolée et processus séparé ».

## 5. SDK (`packages/sdk`)

Ajouts à `KiboSdk` (toutes async, identiques en trusted et en sandboxed) :

```ts
data: {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};
fetch(url: string, init?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers?: Record<string, string>; body?: string }):
  Promise<{ status: number; headers: Record<string, string>; body: string }>;
action<T = unknown>(name: string, input?: unknown): Promise<T>;   // appelle server.ts
notes: { read(path: string): Promise<NoteContent>; write(path: string, markdown: string, expectedMtime: number | null): Promise<NoteMeta>;
         rename(from: string, to: string): Promise<NoteMeta>; remove(path: string): Promise<void> };
```

- `list("note")` renvoie `NoteMeta[]` (§8.2). `notes.read` exige `reads: note`, les autres `writes: note`.
- `@kibo/sdk/server` : `defineServer({ actions?: Record<string, (ctx, input) => Promise<unknown>>, jobs?: Record<string, { everyMinutes: number; run: (ctx) => Promise<void> }> })`. `ctx` = `{ instanceId, config, list, run, data, fetch }` avec les mêmes contrôles. `everyMinutes ≥ 1`. Les jobs tournent **par instance**, dans le démon, même UI fermée.
- `@kibo/sdk/migrations` : `defineMigrations({ [configVersion: number]: { config?: (old) => unknown; data?: (old: Record<string, unknown>) => Record<string, unknown> } })`. La clé `n` migre de `n-1` vers `n`. Fonctions pures, synchrones, sans SDK.
- `@kibo/sdk/sandbox` : `mountSandboxed(manifest, Component)` (runtime iframe, §6.2).
- Le SDK simulé (`createMockSdk`) implémente `data`, `fetch` (réponses programmées par le test), `action` (appel direct des actions) et `notes` (système de fichiers en mémoire), et enregistre **tous** les usages dans `used: UsedPermissions` en plus de `violations`.

## 6. Contrats

### 6.1 RPC démon (ajouts à `RpcRequest`)

| Méthode | Entrée | Sortie | Notes |
|---|---|---|---|
| `listComponents` | — | `ComponentSummary[]` | intégrés + registre ; par version : empreinte, confiance, origine, usages `{projectId, pageId, instanceId}` |
| `componentCall` | `{ projectId, instanceId, call: ComponentCall }` | `unknown` | porte de `data`, `fetch`, `action`, `notes` pour tous les composants, et de tout appel des composants non intégrés ; contrôles §6.4 |
| `approveComponent` | `{ id, version, hash, trust: "trusted" \| "sandboxed" }` | `RegistryVersion` | `HASH_MISMATCH` si l'empreinte courante ≠ `hash` affiché |
| `revokeComponent` | `{ id, version }` | `null` | `trust = null` |
| `previewPublish` | `{ id }` | `PublishPreview` | lit `components/src/<id>`, valide, calcule le diff |
| `publishComponent` | `{ id, strategy: "update-all" \| "new-version" }` | `PublishResult` | refait la validation ; `VERSION_EXISTS` si version publiée avec une autre empreinte |
| `updateInstance` | `{ projectId, instanceId, to: SemVer }` | `Instance` | migre config et données (§7.3) |
| `uninstallComponent` | `{ id, version }` | `null` | `INVALID_INPUT` si la version a des usages |

```ts
type ComponentCall =
  | { kind: "list"; entity: BuiltinEntityType }
  | { kind: "run"; command: ProjectCommand }
  | { kind: "data.get" | "data.delete"; key: string } | { kind: "data.set"; key: string; value: unknown } | { kind: "data.keys" }
  | { kind: "fetch"; url: string; init: FetchInit }
  | { kind: "action"; name: string; input: unknown }
  | { kind: "notes.read"; path: string } | { kind: "notes.write"; path: string; markdown: string; expectedMtime: number | null }
  | { kind: "notes.rename"; from: string; to: string } | { kind: "notes.remove"; path: string };
type PublishPreview = {
  id: string; title: string; from: SemVer | null; to: SemVer; hash: string;
  usages: { projectId: string; projectName: string; pageId: string; pageTitle: string; version: SemVer }[];
  changes: string[]; newPermissions: string[]; migration: { from: number; to: number } | null;
  validation: ValidationReport;
};
```

Nouveaux codes `KiboError` : `HASH_MISMATCH`, `TRUST_REQUIRED`, `VERSION_EXISTS`, `VALIDATION_FAILED`, `MIGRATION_FAILED`, `COMPONENT_CRASHED`, `TIMEOUT`, `CONFLICT`.

### 6.2 Protocole postMessage (iframe ↔ hôte)

Tous les messages : `{ kibo: 1, … }`, validés par Zod des deux côtés ; tout message invalide est ignoré et journalisé.

- hôte → iframe : `{ type: "init", instanceId, config, viewer, theme }`, `{ type: "theme", theme }`, `{ type: "changed" }`, `{ type: "reply", id, ok: true, result } | { type: "reply", id, ok: false, error: { code, message } }`.
- iframe → hôte : `{ type: "ready" }`, `{ type: "call", id, call: ComponentCall }`, `{ type: "openTicket", ticketId }`, `{ type: "openNewTicket", defaults }`, `{ type: "openFile", path, line }` (phase 3, relatif au worktree principal, contrôlé par le démon comme tout chemin), `{ type: "key", combo }`, `{ type: "resize", height }` (widgets à hauteur libre).
- L'hôte n'accepte un message que si `event.source === iframe.contentWindow` ; il **ne lit jamais** d'`instanceId` dans le message : il ajoute celui de l'iframe émettrice avant d'appeler `componentCall`. Il n'inspecte ni ne filtre les appels (le démon décide).
- L'hôte envoie avec `targetOrigin "*"` (origine opaque) uniquement vers `iframe.contentWindow`.
- 64 appels en vol max par iframe ; au-delà, `reply` avec `TIMEOUT`.

### 6.3 Protocole démon ↔ backend (Worker et processus)

Messages JSON : `{ type: "load", manifest, code }` (Worker) ou `{ type: "load", manifest }` (processus, code lu par le runtime depuis un descripteur fourni par le démon), `{ type: "invoke", id, instanceId, config, target: { action: string } | { job: string } | { migrate: { from, to, config, data } } , input }`, `{ type: "call", id, call: ComponentCall }` (le backend demande au démon), `{ type: "result", id, ok, result | error }`. Le démon traite les `call` du backend avec **les mêmes contrôles** que ceux de l'iframe (§6.4), rattachés à l'`instanceId` de l'invocation en cours.

### 6.4 Contrôles du démon sur `componentCall`

Dans l'ordre, chaque échec ⇒ `KiboError` sans effet de bord :

1. L'instance existe dans le projet. Si son `component` est intégré (liste figée `BUILTIN_IDS` dans `schema`) : pas de contrôle 2 et 3, le contrôle du SDK côté client s'applique comme en v0.1 (l'UI est déjà de confiance) ; les contrôles 4 et 5 s'appliquent quand même.
2. La version est au registre, active, et l'empreinte vérifiée au chargement = `approvedHash` (sinon `TRUST_REQUIRED`).
3. L'appel est couvert par les permissions **accordées** (`granted`, pas le manifeste sur disque) : `list` ⇒ `reads` ; `run` ⇒ `WRITES[command.method] ∈ writes` et commande non réservée ; `data.*` ⇒ `data` ; `notes.read` ⇒ `reads: note` ; `notes.*` ⇒ `writes: note` ; `fetch` ⇒ une règle `net` couvre l'URL ; `action` ⇒ nom exporté par `server.js`.
4. `fetch` : `https:` seulement, résolution DNS puis refus des adresses privées, loopback, link-local et multicast (anti-SSRF), puis connexion à l'adresse vérifiée (certificat contrôlé pour le nom demandé) ; connexion toujours directe, les variables `HTTPS_PROXY`, `HTTP_PROXY` et `ALL_PROXY` du démon sont ignorées ; pas de cookies ; en-têtes `cookie`, `authorization`, `host`, `proxy-*` et en-têtes de connexion (`connection`, `keep-alive`, `te`, `trailer`, `transfer-encoding`, `upgrade`, `content-length`, `expect`) retirés ; redirections suivies seulement si la cible est couverte (max 3), et **tous** les en-têtes du composant supprimés quand une redirection change d'origine ; délai 15 s ; réponse tronquée à 5 Mio avec `x-kibo-truncated: 1` (sans couper un caractère UTF-8 en mode texte) ; corps texte (binaire en base64 avec `x-kibo-base64: 1`) ; les en-têtes `x-kibo-*` et `set-cookie` du serveur distant sont retirés.
5. Quotas : 256 Kio de `data` par instance ; 20 `fetch` / min par instance ; 200 appels / s par instance.
6. Chaque refus est ajouté au journal append-only SQLite `component_events` (`at, projectId, instanceId, ref, call.kind, code, count`). Un composant ne doit pas pouvoir s'en servir pour saturer le disque ni noyer un refus : par clé (`instanceId`, `call.kind`, `code`) et par fenêtre de 60 s ouverte au premier refus, les 10 premiers refus ont chacun leur ligne (`count = 1`) ; les suivants ne touchent pas SQLite et sont seulement comptés en mémoire, puis une ligne de synthèse (`count = n`, `at` = dernier refus compté) est ajoutée à la fin de la fenêtre (au refus suivant de la même clé, ou au balayage fait à chaque écriture), à chaque lecture du journal et à l'arrêt du démon. Rétention : 1 000 lignes par instance et 10 000 au total, les plus anciennes supprimées d'abord. L'ordre des contrôles 1 à 5 est inchangé (pas de quota pris avant les permissions) : c'est le journal qui est borné, refus de quota compris.

## 7. Flux

### 7.1 Créer (code) — écran 29, colonne « Depuis le code »

1. `kibo component new burndown [--kind widget|view|both] [--server]` crée `components/src/burndown/` : manifeste (`version 0.1.0`, permissions vides), `ui.tsx`, `server.ts` si demandé, `component.test.tsx` qui appelle `runConformance`, `tsconfig.json` pointant vers la toolchain (§9.2).
2. `kibo component dev burndown` : aperçu local sur `127.0.0.1:<port libre>` avec le SDK simulé chargé du jeu `design/donnees-fictives.md`, rechargement à chaque sauvegarde. Aucun enregistrement au démon.
3. `kibo component test burndown` : validation complète (§7.4).
4. « Mes composants » (écran 3) liste les dossiers de `components/src/` dont la dernière validation est verte, avec l'action « Publier ».

### 7.2 Publier — écran 6

1. `previewPublish` : validation, empreinte, diff avec la dernière version publiée : `changes` du manifeste (`+` vert), permissions nouvelles (`+` orange), migration (`~` bleu, « Migration de config v0 → v1 (automatique) »).
2. Si la version existe déjà avec la même empreinte : rien à publier. Avec une autre empreinte : `VERSION_EXISTS` (« Change la version dans kibo.component.json »). Si la version est inférieure ou égale à la plus haute publiée : `INVALID_INPUT`.
3. Aucun usage ⇒ publication directe. Sinon, dialogue « Publier « <titre> » <version> » : liste des usages (projet › page, version courante), changements, choix **Mettre à jour partout** (défaut) ou **Créer une nouvelle version**.
4. Publication : copie des sources au magasin, build, `build.json`, entrée au registre avec `trust` et `granted` **hérités** de la version précédente si les permissions n'ont pas grandi, sinon `trust = null` et affichage immédiat de l'écran 30 (« La nouvelle permission sera demandée une seule fois »).
5. « Mettre à jour partout » : pour chaque instance, `updateInstance` (§7.3) ; échec d'une migration ⇒ cette instance reste sur l'ancienne version et apparaît en erreur dans le rapport ; les autres continuent.
6. « Créer une nouvelle version » : les instances restent ; chaque instance propose « Mettre à jour vers x.y.z » dans son menu `⋯` (écran à dessiner, §11).

### 7.3 Mettre à jour une instance

1. Si `configVersion` cible > source : le backend de la **version cible** exécute `migrate` (Worker ou processus, jamais l'UI) pour chaque pas `n` ; la config résultante est validée contre `configSchema`, les données contre la limite de taille.
2. Écriture atomique par `setInstanceComponent` (ref, config, données) dans une seule transaction Loro.
3. Rétrogradation : interdite si `configVersion` diminue ; permise sinon.

### 7.4 Validation (commune à la CLI, au publish et à la phase 6)

`ValidationReport = { typecheck, tests, conformance, permissions: { declared, used, missing, unused } , ok }`, exécutée par `packages/devkit` :

1. Manifeste valide, imports autorisés (§3.2).
2. `tsc --noEmit` avec la toolchain.
3. `bun test --preload <devkit>/restrict.ts` dans le dossier du composant (inclut la suite de conformité). Pour tout composant non intégré, `restrict.ts` retire les mêmes capacités que le runtime backend (§4.4 : réseau, fichiers, processus) avant le chargement des tests : le code testé n'a pas plus de droits que le code exécuté (compatibilité avec le runner `bun test` à valider en tâche 1). En phase 7, ce processus passe aussi dans le bac à sable OS (spec H §8).
4. Permissions utilisées = union de (a) **analyse statique** (API du compilateur TypeScript) des appels `useEntities(x)`, `sdk.list(x)`, `sdk.run({ method: x })`, `sdk.data.*`, `sdk.fetch(url)`, `sdk.notes.*`, `ctx.*` du serveur — un argument non littéral est une erreur (« argument non littéral : impossible de vérifier la permission ») ; (b) usages enregistrés par le SDK simulé pendant la conformité.
5. `missing` non vide ⇒ échec. `unused` non vide ⇒ avertissement (affiché, non bloquant).

### 7.5 Confiance — écran 30

Déclenché à l'ajout d'un composant non actif, à une empreinte modifiée, ou à une nouvelle permission. Affiche : titre et version, origine, empreinte courte « vérifiée par le démon », permissions en langage clair (« Lire les tickets du projet — entités : ticket, status », « Stocker ses propres données — espace de nommage de l'instance uniquement », « Aucun accès réseau, aucun fichier local » quand `net` est vide et `note` absent), choix Sandboxé (recommandé) / Confiance totale. « Refuser » : l'instance n'est pas créée (ou reste en « Autorisation requise »).

### 7.6 Empreinte modifiée

Au démarrage et avant chaque (re)lancement de backend, le démon recalcule l'empreinte de `store/.../source`. Divergence ⇒ version marquée `trust = null`, backend arrêté, iframes et modules non servis (`TRUST_REQUIRED`), instances en « Autorisation requise », événement journalisé. Le menu `⋯` de la page Composants propose « Revérifier l'empreinte ».

## 8. Composants intégrés

### 8.1 Graphe de dépendances (`components/graph`, écrans 7 et 10)

- Manifeste : `id graph`, `kind both`, `reads [ticket, status, link]`, `writes []`, `configSchema { filter: mine-and-agents | all, hideDone: boolean }`.
- **Vue** : barre d'outils Hiérarchique · Chemin critique (bascule) · Masquer terminés · Filtrer (domaine, assigné) ; résumé à droite « Chemin critique : n tickets · m bloqué(s) » ; nœud = pastille de statut, clé, titre court, icône d'agent si `assignee.kind = agent` ; arêtes `blocks` pleines, `relates` pointillées, chemin critique en trait épais contrasté ; tickets terminés atténués ; légende en bas à gauche ; zoom `+ / 100 % / −` en bas à droite, déplacement à la souris ; clic ⇒ `openTicket`.
- **Mise en page** (`layout.ts`, pure, déterministe) : couches par plus long chemin sur les arêtes `blocks`, ordre intra-couche par barycentre (4 passes), tickets sans arête `blocks` sur une couche 0 séparée en bas ; SVG natif, sans dépendance.
- **Chemin critique** (`critical-path.ts`, pure) : plus longue chaîne (en nombre de tickets) du sous-graphe `blocks` restreint aux tickets **non terminés** ; égalité départagée par ordre lexicographique des clés. Jeu fictif : `KIB-11 → KIB-21 → KIB-22`, 1 bloqué.
- **Widget** : « Chemin critique · n tickets », la chaîne en puces, motif du premier ticket bloqué de la chaîne, lien « Ouvrir le graphe → » (ouvre la première page Vue du projet qui contient `graph`, sinon en crée une après confirmation).
- Création d'arêtes depuis le graphe : hors périmètre (écran « ajout de dépendance et cycle détecté » non dessiné).

### 8.2 Notes (`components/notes`, écran 11) et N1

**Décision** : les notes sont des **fichiers `.md` sur disque**, source de vérité ; le démon en tient un index dérivé. Raison : écran 16 « Les notes restent des fichiers .md » et compatibilité Obsidian (deux sources de vérité seraient sources de conflits).

- Dossier de notes par projet : réglage **local** (table SQLite `project_settings(projectId, key, value)`, clé `notesDir`), jamais dans le doc projet, car c'est un chemin propre à la machine (voir spec G §3.4). Défaut : `<folder>/notes` si le projet a un dossier, sinon `<KIBO_HOME>/notes/<KEY>` ; modifiable dans le menu du composant. Libellé « Obsidian » si un dossier `.obsidian/` existe dans `notesDir` ou un parent jusqu'à `folder`.
- `NoteMeta = { path, title, mtime, size, tickets: string[] /* clés */, links: string[] /* chemins résolus */ }` ; `NoteContent = NoteMeta & { markdown }`. `title` = premier `# ` sinon nom de fichier.
- Index (`packages/daemon/src/notes/`) : scan au démarrage + `fs.watch` récursif, débounce 200 ms ; tables SQLite `notes(projectId, path, title, mtime, size)`, `note_links(projectId, from, to)`, `note_tickets(projectId, path, key)`. Reconstructible à tout moment.
- Tickets liés : occurrences de `\b<KEY>-\d+\b` (clé du projet) hors blocs de code, et `tickets:` du frontmatter YAML. Rétroliens : `[[Nom]]`, `[[Nom|alias]]` (résolution Obsidian : nom de fichier sans extension, le plus court chemin l'emporte) et liens Markdown relatifs `.md`.
- Écriture : `notes.write` avec `expectedMtime` ; si le fichier a changé depuis ⇒ `CONFLICT` (nouveau code) et l'UI affiche « Modifié hors de Kibo — Recharger / Garder ma version » (« Garder » réécrit avec `expectedMtime: null`). Écriture atomique (fichier temporaire + `rename`).
- Chemins : relatifs à `notesDir`, `.md` uniquement, pas de `..`, pas de lien symbolique sortant de `notesDir` (`realpath` vérifié), fichiers cachés ignorés.
- UI : colonne gauche (recherche plein texte côté démon sur titre et contenu, dossier et badge Obsidian, liste triée par `mtime`, « Nouvelle note ») ; centre : chemin cliquable (aperçu de fichier, phase 3), état « Enregistré · local », rendu Markdown avec puces de tickets cliquables, bascule édition CodeMirror 6 (Markdown), sauvegarde automatique 800 ms après la dernière frappe ; droite : Tickets liés, Rétroliens (« mentionne cette note », « n mentions »).
- Widget (écran 7) : titre et premières lignes de la note épinglée (`config.path`) ou de la plus récente.
- Rendu Markdown : `markdown-it` (nouvelle dépendance, sans `postinstall`, HTML brut désactivé) ; aucun HTML de la note n'est injecté tel quel.
- Manifeste : `id notes`, `kind both`, `reads [note, ticket, status]`, `writes [note]`, `configSchema { path: string | null }`.

## 9. Outillage

### 9.1 `packages/devkit`

Dépend de `schema` seulement. Exporte `scaffold(opts)`, `hashSources(dir)`, `buildComponent(srcDir, outDir)` (`Bun.build` × 2 cibles + Tailwind v4 via `@tailwindcss/node` pour `ui.css`), `validateComponent(dir): Promise<ValidationReport>`, `inferPermissions(dir)`. Utilisé par `packages/cli` et par le démon. **Nouvelles arêtes** : `schema ← devkit ← daemon`, `devkit ← cli` (à reporter dans `CLAUDE.md`).

### 9.2 Toolchain et CLI

- Toolchain = dossier contenant `typescript`, `@kibo/sdk` (sources et types), `react`, `react-dom`, `lucide-react`, `@testing-library/react`, `@happy-dom/global-registrator`. En dev : `node_modules` du monorepo ; packagé : ressource Tauri `toolchain/`. Le `tsconfig.json` généré y pointe par `paths`.
- `bun` pour `bun test` : `process.execPath` avec `BUN_BE_BUN=1` (le binaire compilé se comporte comme `bun`) ; **à valider en tâche 1** ; à défaut, `bun` requis dans le `PATH` et vérifié à l'écran 19.
- `packages/cli` : `kibo component new|test|dev|publish [--update-all|--new-version]`. `publish` passe par le démon (lit `~/.kibo/token`, s'appaire comme l'UI) ; si le composant a des usages, l'une des deux options est obligatoire.
- Le binaire du démon accepte `component <sous-commande>` et `component-runtime` ; Paramètres › Général propose « Installer la commande kibo » (lien symbolique dans `~/.local/bin`).

## 10. Sécurité (récapitulatif)

- Le composant sandboxé ne voit ni cookie, ni jeton, ni réseau, ni disque ; il n'atteint le démon que via l'hôte, qui l'identifie par l'iframe émettrice.
- Le démon contrôle chaque appel contre les permissions **approuvées** et l'empreinte **approuvée**.
- Aucune dépendance npm dans un composant non intégré ; build fait par le démon depuis les sources hachées.
- Migrations exécutées dans le backend de la version cible, jamais dans l'UI ; sorties validées.
- Chemins de notes confinés ; `fetch` anti-SSRF.
- Journal des refus (`component_events`).

## 11. Écrans

Conformité exigée : 3 (catalogue : Intégrés, Mes composants), 6 (tableau et dialogue de publication), 7 (widgets Graphe et Notes), 10, 11, 29 (colonne « Depuis le code » ; la colonne IA est livrée en phase 6), 30, en sombre et en clair.
**À dessiner dans Penpot avant implémentation** (revue §7) : menu `⋯` d'une instance avec « Mettre à jour vers x.y.z », état « Autorisation requise » d'une instance, menu `⋯` de la page Composants (Revérifier l'empreinte, Retirer la confiance, Désinstaller), bandeau de conflit d'une note.

## 12. Tests

| Niveau | Cas |
|---|---|
| schema | manifeste v0 accepté (défauts), `net` refuse IP, port, joker, `http:` |
| devkit | empreinte stable (ordre des fichiers, fins de ligne), change si un octet change, ignore les tests ; imports interdits refusés ; `inferPermissions` sur fixtures (littéraux, non littéral ⇒ erreur) |
| démon | `componentCall` : chaque ligne de §6.4 refusée puis acceptée ; empreinte altérée sur disque ⇒ `TRUST_REQUIRED` ; `approveComponent` avec ancienne empreinte ⇒ `HASH_MISMATCH` ; `fetch` vers `127.0.0.1`, `10.0.0.1`, redirection hors règle ⇒ refus (faux serveur HTTPS de test et résolveur DNS injecté) |
| sandbox | runtime processus : `fetch`, `Bun.file`, `Bun.spawn` indisponibles ; crash ⇒ `COMPONENT_CRASHED` puis redémarrage ; délai ⇒ `TIMEOUT` |
| migrations | 0 → 2 en deux pas ; échec ⇒ instance inchangée ; rétrogradation de `configVersion` refusée |
| conformité v1 | la suite vérifie aussi : `used ⊆ declared`, pas d'accès `data` sans permission, rendu en sombre et en clair |
| **sortie** | composant tiers fixture `evil` sandboxé qui appelle `run({ method: "deleteTicket" })` et `fetch("https://example.com")` sans les déclarer : bloqué par le démon, refus journalisés, aucune donnée modifiée |
| graph | `critical-path` et `layout` sur le jeu fictif ; propriété fast-check : la mise en page ne place jamais une cible `blocks` sur une couche ≤ sa source |
| notes | index (liens, rétroliens, tickets), conflit `expectedMtime`, traversée `../` et lien symbolique refusés, écriture externe détectée |
| e2e | Playwright : publier une v0.2.0 d'un composant fixture utilisé sur 2 pages ⇒ dialogue écran 6 ⇒ « Mettre à jour partout » ⇒ les deux instances en 0.2.0 ; approbation écran 30 ; composant sandboxé rendu dans son iframe ; graphe et notes |

Aucun test ne dépend du réseau réel.

## 13. Critères de sortie

- Le test de sortie « composant tiers sandboxé bloqué » passe en CI macOS et Linux.
- `kibo component new → test → publish` fonctionne sur un composant hors monorepo, en dev et avec le binaire compilé.
- Écrans 6, 10, 11, 29 (code), 30 conformes en sombre et en clair ; Playwright vert.
- Les intégrés existants (Kanban, Tickets) passent la suite de conformité v1 sans modification de leur code métier.

## 14. Hors périmètre

- Entités déclarées par un composant (`acme.bug`, spec §5) : aucune phase ne les porte encore ; à placer dans la feuille de route (proposition : après v1.0).
- Webhooks entrants dans `server.ts` (écoute réseau interdite au démon, spec §10).
- Durcissement OS du backend (phase 7), génération IA (phase 6), adaptateurs de sync et `secrets` / `mcp` (phase 5).
- Création d'arêtes depuis le graphe ; synchronisation des notes entre utilisateurs (voir spec G §3.4).
- Exposition de git dans le SDK (la spec de phase 3 §10 l'évoque pour faire de « Changements » un composant) : « Changements » reste une vue du shell en v0.4 ; aucune permission `git` n'est ajoutée. Raison : donner git à un composant tiers est un risque majeur sans besoin identifié.

## 15. Décisions d'implémentation (plan de phase 4)

Reprises du plan `docs/superpowers/plans/2026-09-26-kibo-composants.md` (« Décisions techniques de ce plan »).

1. **Données d'instance** : `doc.getMap("instanceData")`, une `LoroMap` par `instanceId`. Les instances restent des valeurs JSON dans `instances` (format v0.1 inchangé, pas de migration de docs existants).
2. **Format de `configSchema`** : `Record<clé, { type?: "string"|"number"|"boolean", enum?: (string|number|boolean)[], nullable?: boolean, default?: unknown }>` (compatible avec le manifeste Kanban v0.1). Sans `configSchema`, seule la config `{}` est valide ; toute clé inconnue est refusée.
3. **Appels ajoutés à `ComponentCall`** : `notes.search { query }` (recherche plein texte côté démon, spec §8.2) et `notes.info` (dossier, libellé Obsidian) ; `sdk.notes.search()` et `sdk.notes.info()` exigent `reads: note`.
4. **Contexte SDK** : `surface: "widget" | "view"` (widget et vue d'un composant `both` diffèrent pour Graphe et Notes) et `openView(componentId)` (lien « Ouvrir le graphe → ») ; message iframe `{ type: "openView", componentId }` pour garder une API identique en sandbox.
5. **Codes d'erreur ajoutés** en plus de la spec : `RATE_LIMITED` (quotas d'appels et de `fetch`), `QUOTA_EXCEEDED` (256 Kio de données).
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
16. **Imports refusés en défense en profondeur** : en plus des modules, les identifiants `require`, `eval`, `Function`, `process`, `Bun`, `globalThis`, `module` et `import.meta` sont refusés en position de valeur dans les sources d'un composant non intégré.
17. **`ui.sandbox.js` servi avec `access-control-allow-origin: *`** : le document sandboxé a une origine opaque et un script `type="module"` se charge en mode CORS ; le fichier ne porte ni secret ni cookie. Aucun autre fichier du port sandbox n'a cet en-tête.
18. **`lucide-react` embarqué dans `ui.trusted.js`** (non partagé via `globalThis.__kiboShared`) : icônes sans état ; l'UI n'expose ainsi que React et le SDK, sans gonfler son bundle de toute la bibliothèque d'icônes.
19. **Messages de statut plutôt que toasts** : l'UI v0.1 n'a pas de `Toaster` (celui de shadcn dépend de `next-themes`) ; `useFlash` affiche un `role="status"` 4 s près de l'action. Si une phase antérieure a monté un `Toaster`, les tâches 24 et 28 l'utilisent à la place.
20. **Commandes réservées refusées sur la RPC `command`** : `setInstanceComponent` et `setInstanceData` ne sont émises que par le démon (mise à jour, `data.set`) ; `addInstance`, `removeInstance` et `setInstanceConfig` restent permises au shell.
21. **Brouillons dans `<KIBO_HOME>/components/src/<id>/`** (hors monorepo, spec §3.2) ; `kibo component test` accepte aussi un chemin de dossier.
22. **Point d'entrée unique du binaire** (`apps/desktop/sidecar/entry.ts`) : répartit entre démon, CLI (`component …` ou lien nommé `kibo`) et runtime sandboxé (`component-runtime`), sans créer d'arête `cli ← daemon`.
23. **Démarrage factorisé** : `startDaemon` (tâche 30) sert à `main.ts`, aux tests d'intégration, à la CLI (tests) et à l'E2E.

Ancrages réels constatés par la tâche 2 (phases 2 et 3 livrées après l'écriture du plan) :

- `BuiltinEntityType` = `ticket`, `status`, `link`, `page`, `run`, `note` : `run` (phase 2, lecture seule) est conservé ; `permissionOfCall({ kind: "list", entity: "run" })` = `read:run`.
- `ProjectCommand` garde `upsertExternalRef` (phase 2) avec `COMMAND_WRITES.upsertExternalRef = "ticket"`, comme la table du SDK v0.1 ; les méthodes RPC des phases 2 et 3 restent dans `RpcRequest` et `RpcResult`.
- `KIBO_ERROR_CODES` conserve tous les codes des phases 2 et 3 (`PATH_OUTSIDE_PROJECT`, `GIT_*`, `GH_*`, `FILE_CHANGED`, `TOO_LARGE`…) et ajoute ceux de la phase 4.
- Les textes UI de la phase 4 vivent dans `packages/ui/src/i18n/fr-components.ts` (`frComponents`, étalé dans `fr` comme `frCode`) pour garder `fr.ts` sous ~300 lignes ; l'accès reste `fr.addComponent`, `fr.components`, `fr.publish`…

### Points à arbitrer par Adam

Option A appliquée en attendant l'arbitrage d'Adam.

| # | Sujet | Option A (par défaut) | Option B |
|---|---|---|---|
| E1 | Entités déclarées `acme.bug` : la feuille de route les met en phase 4, la spec de phase §14 les exclut | suivre la spec (hors périmètre, à placer après v1.0) ; la feuille de route est corrigée au jalon | ajouter une tâche « entités déclarées » (schéma namespacé, `reads: ["acme.bug"]`, stockage dans le doc projet) après la tâche 30 |
| E2 | Import dynamique construit (`new Function("return import('node:fs')")`) dans le runtime restreint : si le spike 1-C montre qu'on ne peut pas le bloquer | documenter la limite, garder le durcissement OS en phase 7 (spec H §8), le test de sortie reste vert car il porte sur les appels au démon | avancer en phase 4 le profil `sandbox-exec` (macOS) et `bwrap` (Linux) pour `ProcessHost` |
| E3 | Bouton « Hiérarchique » de l'écran 10 | indicateur de la seule mise en page disponible (bouton pressé, désactivé, infobulle) | bascule qui ajoute les arêtes parent → sous-ticket |
| E4 | Tickets sans arête `blocks` : spec « couche 0 séparée en bas » ; écran 10 : KIB-9 en bas mais KIB-14 et KIB-18 à droite | suivre la spec (tous en bas) ; le chef aligne la maquette | suivre la maquette (colonne à droite pour les tickets assignés à un agent) |
