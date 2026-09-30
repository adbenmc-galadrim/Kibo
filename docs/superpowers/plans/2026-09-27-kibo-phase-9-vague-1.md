# Kibo · Finitions UI/UX, vague 1 (phase 9, v1.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** exposer dans l'interface ce que le démon sait déjà faire (fiche ticket éditable, dépendances, pages, notes, réglages des widgets, domaines : lot 1 du plan d'action) et donner à l'application le comportement d'un logiciel de bureau (menus contextuels, menu macOS explicite, fenêtre mémorisée, liens externes maîtrisés, logo : lot 4), sans relever le budget de chargement initial ni consommer un token.

**Architecture:** presque tout est de l'interface. Le SDK gagne trois primitives partagées par le shell et les composants intégrés (`ConfirmDialog`, `ReasonDialog`, entrées de menu rendues en menu contextuel ou déroulant), chargées à la demande partout où elles n'y sont pas déjà. Le démon ne gagne que trois requêtes git (`discardChanges`, `stageAll`, `unstageAll`) et le contexte de session sur `/api/code`. La coque Tauri gagne un menu natif explicite, une taille minimale, la mémorisation de la fenêtre et deux permissions IPC de plus (titre de la fenêtre, ouverture d'URL `https`). Le logo est généré depuis une géométrie unique.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, React 19 + shadcn/ui (`context-menu`, `dropdown-menu`, `alert-dialog` déjà dans `packages/sdk/src/ui`), `@dnd-kit/core` 6.3.1 (déjà présent), Vite 7.1.6, happy-dom + Testing Library, Playwright, Tauri 2 (`tauri-plugin-opener`, `tauri-plugin-window-state`, `tauri::menu`), `@tauri-apps/plugin-opener` (nouvelle dépendance de `packages/ui`, import dynamique seulement), cargo 1.98 disponible en local (`~/.cargo/bin/cargo`).

**Spec:** `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` **§12** (décisions de la phase 9, écrites avant ce plan : annuler les changements, tout (dés)indexer, actions locales, menus contextuels, coque de bureau, logo ; **§12.7** : réponses d'Adam du 2026-09-27, glisser-déposer qui réordonne et notes toujours titrées, tâches T3b, T7b, T10b, T12b) ; `docs/superpowers/specs/2026-09-27-kibo-mises-a-jour.md` §3.7 et §4 (capacité IPC amendée) ; `docs/superpowers/specs/2026-09-25-kibo-design.md` §5 (liens `blocks` / `relates`, pages imbriquées), §8 (Sheet ticket, écran 4, système visuel : logo), §10 ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` §5 (SDK, `notes`), §8.2 (notes = fichiers `.md`). Plan d'action : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (lots 1 et 4). Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md`. Données des maquettes : `design/donnees-fictives.md`.

## Vérifié sur le code (`main` = `1b53211`, v1.0 + mises à jour)

Le plan d'action citait des RPC et des appels de mémoire ; tout a été confronté au code. Colonne « Réel » : ce qui fait foi pour toutes les tâches.

| Besoin | Supposé par le plan d'action | Réel (vérifié) |
|---|---|---|
| Envoyer une `ProjectCommand` depuis l'UI | `api.command(...)` | `client.rpc({ method: "command", projectId, command })` (`packages/ui/src/api.ts` n'exporte que `client` et `onUnauthorized` ; `packages/sdk/src/client.ts:148-153`). Résultat typé `unknown` : parser avec le schéma Zod si besoin (`Page.parse` dans `NewPageDialog`). |
| Envoyer une commande depuis un composant | `sdk.command` | `sdk.run(cmd)` (`packages/sdk/src/sdk.ts:162-170`), soumis à `manifest.writes` via `COMMAND_WRITES` ; `PERMISSION_DENIED` sinon. Le composant **tickets** déclare `writes: []` et **graph** aussi : toute action d'écriture exige de compléter le manifeste. |
| `updateTicket`, `setStatus`, `deleteTicket`, `moveTicket` | RPC de premier niveau | Variantes de `ProjectCommand` (`packages/schema/src/command.ts:33-48`). `updateTicket { ticketId, title?, description?, domainId?, assignee? }` n'écrit que les champs définis ; titre vide ⇒ `INVALID_INPUT`. `setStatus` vers `blocked` exige `reason` (`BLOCKED_REASON_REQUIRED`). `moveTicket` refuse un cycle (`TREE_CYCLE`). `deleteTicket` renvoie les ids du sous-arbre supprimé et retire les liens qui le touchent. |
| `addLink`, `removeLink` | idem | `addLink { from, to, type: "blocks" \| "relates" }` renvoie `Link { id, from, to, type }` ; refuse l'auto-lien et le doublon (`INVALID_INPUT`, symétrique pour `relates`) et un cycle de `blocks` (`LINK_CYCLE`). `removeLink { linkId }`. **`TicketView` n'a pas de champ `links`** : ils sont dans `ProjectSnapshot.links` (`packages/schema/src/rpc.ts:43-56`) ; `TicketView.waitingOn` contient des **libellés de clé** (`KIB-12`), pas des ids. |
| `renamePage`, `movePage`, `deletePage` | idem | `renamePage { pageId, title }` (titre nettoyé, vide refusé), `movePage { pageId, parentId, index? }` (cycle ⇒ `TREE_CYCLE`), `deletePage { pageId }` renvoie les ids de la page et de ses sous-pages et supprime leurs instances (`packages/core/src/pages.ts:36-52`). |
| `setInstanceConfig`, `setInstanceComponent` | les deux utilisables | `setInstanceConfig { instanceId, config }` **remplace** la config entière (`Instance.safeParse`). `setInstanceComponent` est **refusée à l'UI** (`PERMISSION_DENIED`, `assertShellCommand`, `packages/core/src/commands.ts:98-107`) : réservée au démon. Ce plan n'utilise que `setInstanceConfig` et conserve les clés hors schéma (`source`, config MCP). |
| `updateDomain` | RPC | `ConfigCommand` : `client.rpc({ method: "config", command: { method: "updateDomain", domainId, patch: { name?, color? } } })` (`packages/schema/src/agent.ts:87`, `DomainInput = { name: trim 1..40, color: /^#[0-9A-Fa-f]{6}$/ }`), nom unique insensible à la casse. Portée **workspace** : les copies de domaines d'un projet partagé (`ProjectSnapshot.domains`) ne suivent pas ; la page Domaines n'édite que le workspace. `deleteDomain` refuse un domaine utilisé (`INVALID_INPUT`). |
| `notes.rename`, `notes.remove` | appels `sdk.call(...)` | `sdk.notes.rename(from, to): Promise<NoteMeta>` et `sdk.notes.remove(path): Promise<void>` (`packages/sdk/src/types.ts:49-56`), permission `writes: note` (déjà déclarée par **notes**). Démon : `CONFLICT` si la cible existe, `NOT_FOUND` si la source manque, chemins confinés (`PATH_OUTSIDE_PROJECT`). Le SDK simulé les implémente (`packages/sdk/src/mock-notes.ts`). Aucun `notes.create` : le composant écrit `sans-titre(-n).md` (`components/notes/src/NotesView.tsx:23-29`). |
| Requêtes git | `isCodeRequest`, `dispatch` | Endpoint dédié `/api/code` (`packages/daemon/src/server.ts:135-140`) ⇒ `CodeService.handle(req)` **sans contexte de session** : ni `requireLocal`, ni `assertWritable`. `openInEditor` est classée lecture. Aucun `discardChanges`. Confinement : `resolveInWorktree(root, relPath)` et `assertNotSymlink` (`code/safe-path.ts`) ; git par `h.git.ok(args)` avec `GIT_LITERAL_PATHSPECS=1` (`code/run.ts`, `code/repo.ts`). Fixture de test : `createGitFixture({ remote? })` (`code/testing/git-fixture.ts`). |
| Lecture seule d'un projet partagé | `sdk.readOnly` | UI : `canEdit(project)` (`packages/ui/src/state/access.ts`) ; composants : `useReadOnly()` (`packages/sdk/src/react.tsx:101`) ou `useSharing().access !== "write"`. Le démon refuse de toute façon (`FORBIDDEN`) : l'UI masque, le démon garantit. |
| Coque Tauri | `capabilities/*.json`, plugins `opener` / `window-state` | Aucun dossier `capabilities/` : la seule capacité est construite **à l'exécution** dans `main.rs:33-41` (`updater:default`, `process:allow-restart`, `core:app:allow-version`) pour l'origine du démon. Plugins présents : `shell`, `notification`, `updater`, `process`. Fenêtre `1440 × 900`, titre « Kibo », sans taille minimale ni menu (le menu macOS par défaut de Tauri porte ⌘W = fermer la fenêtre). Tests Rust existants : 4 (`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`). |
| Budget UI | contrôle en CI | `bun run budget` (`packages/ui/scripts/bundle-budget.ts`, `ENTRY_GZIP_BUDGET = 230_000`, liste `FORBIDDEN_IN_ENTRY`), **non lancé par la CI** : le chef d'équipe le lance avant chaque intégration. Mesure de départ : 229,1 kB. `context-menu`, `dropdown-menu`, `select`, `sheet`, `tooltip` et tout `@kibo/sdk` (index) sont déjà dans l'entrée (`shell/shared-modules.ts`) ; `alert-dialog` n'y est pas. |
| Tests UI | faux client partagé | `mock.module("../api", () => ({ client: { rpc, code, subscribe… } }))` **par fichier**, puis `await import` du composant (63 fichiers). Leçon CI v1.0 : jamais de `mock.module` d'un module partagé (lib, état, i18n), jamais de mémo au niveau du module sans clé. |
| E2E | ports libres | 4390–4414 pris (`e2e/playwright.config.ts`, `sync-fixture.ts`, `market-fixture.ts`) ; ce plan prend **4415–4416** ; 4461–4499 réservés aux démos. |
| Penpot | écran libre | dernier écran dessiné : **97** ; prochaine page : **14** ; numérotation suffixée possible (`57b`). |

## Global Constraints

- Bun **1.4.2**, dépendances figées par `bun.lock`, aucun `postinstall`. Nouvelles dépendances autorisées par ce plan, et seulement elles : `@tauri-apps/plugin-opener` (`packages/ui`, import dynamique, interdit dans l'entrée), `@dnd-kit/core` pour `components/tickets` (version déjà dans `bun.lock` : 6.3.1), crates `tauri-plugin-opener = "2"` et `tauri-plugin-window-state = "2"` (`apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock` régénéré et commité).
- **Aucun commentaire dans le code** ; code, identifiants et messages d'erreur internes en anglais ; textes d'interface en français, **tutoiement**, sans jargon (« Indexer » reste, car déjà dans l'écran ; jamais « stage », « worktree » dans un texte nouveau : dire « dossier de travail »).
- Textes : un fichier `i18n/fr-<sujet>.ts` par tâche quand le module qui l'affiche est chargé à la demande (importé directement, jamais monté dans `fr.ts`, sur le modèle de `fr-share.ts`) ; seules T7 (`nav`), T9 (`domains`) et T8 (`fr-components.ts` › `instance`) touchent des sections existantes. Textes des composants intégrés dans leur `src/fr.ts`.
- **Budget de 230 kB jamais relevé** : T2 réduit d'abord le chargement initial (objectif ≤ 224 kB, mesuré) ; chaque écran ou dialogue nouveau est chargé à la demande (`lazyPanel`) et **ajouté à `FORBIDDEN_IN_ENTRY`** ; chaque tâche UI note la mesure `bun run budget` dans son dernier commit ou son rapport.
- **Toute action destructive est confirmée** (`ConfirmDialog` du SDK) : supprimer une page, un ticket, une note, un domaine, un fichier de guideline, retirer un widget, annuler les changements d'un fichier. La confirmation nomme la cible et ce qui disparaît avec elle.
- **Lecture seule** : en projet partagé avec accès `read-only` ou `revoked`, aucune entrée d'écriture n'est rendue (UI : `canEdit(project)` ; composants : `useReadOnly()`). Les tests le vérifient pour chaque menu nouveau.
- Chaque écran ou dialogue existe **en sombre et en clair** (classes `dark:` des tokens, aucune couleur codée hors tokens sauf l'orange de marque `#F97316`).
- **Tests** : TDD ; `bun test` sans dépendance à l'horloge murale (temps injecté), à l'ordre des fichiers ni à un `mock.module` global ; tests de composants avec `createMockSdk` et `runConformance` ; démon avec `createGitFixture` ; aucune régression E2E (`bun run --cwd e2e test` sur les specs touchées et `menus.spec.ts` ajouté en T16).
- Aucune erreur avalée : chaque `catch` affiche un message (`role="alert"`) ou relance ; jamais `catch {}` vide.
- Sécurité : chemins git confinés (`resolveInWorktree`), pas de motif de pathspec, pas d'exécution arbitraire ; capacité Tauri limitée à l'origine du démon et aux permissions listées en spec §12.5 ; liens externes `https:` seulement ; démon inchangé hors `/api/code`.
- Git : une branche `feat/p9-t<n>` par tâche depuis `phase/9`, worktree `.claude/worktrees/p9-t<n>` ; commits d'une ligne en français, préfixe conventionnel, < 50 caractères, fichiers stagés explicitement, jamais `git stash`, aucune mention d'IA. `bun run check`, `bun run typecheck`, `bun test packages components ./scripts` verts avant chaque commit final.

## Review Focus

1. **Annuler les changements d'un fichier nouveau, renommé, supprimé ou ajouté à l'index** : le fichier revient exactement à `HEAD` (ou disparaît s'il n'y était pas), la source d'un renommage est restaurée, rien d'autre ne bouge dans le dépôt (T3, tests `discardChanges` sur les cinq cas).
2. **Annuler pendant un rebase ou sur un fichier en conflit** : refus `GIT_BUSY` / `INVALID_INPUT` **avant** toute commande qui écrit, disque intact (T3, test « refuses during an operation »).
3. **Session distante** : `discardChanges`, `stageAll`, `unstageAll`, `openInEditor` répondent `FORBIDDEN` ; la même requête en local passe (T3, test avec `RpcContext { remote: true }`).
4. **Titre de ticket ou de page vide** (espaces seuls) : le démon refuse (`INVALID_INPUT`), l'UI garde l'ancien titre affiché et montre l'erreur, le champ reste éditable (T6, T7).
5. **Lien `javascript:`, `file:`, `mailto:` ou `http:` dans la fenêtre Tauri** : jamais transmis à l'ouvreur, clic neutralisé ; seul `https:` s'ouvre (T13, test `installExternalLinks`). **Cycle de dépendance** (`KIB-12 bloque KIB-15` puis `KIB-15 bloque KIB-12`) : refus expliqué en français, rien n'est écrit (T14).
6. **Session distante, toutes mutations** (T3b) : les 13 mutations de `/api/code` et `openInEditor` répondent `FORBIDDEN` avant toute commande (disque et index intacts, aucun événement `code`, aucun programme lancé) ; les 9 lectures passent ; la vue Code distante ne rend ni case, ni bouton de bloc, ni panneau de commit, ni « Abandonner ».
7. **Réordonner par glisser-déposer** (T7b, T10b) : l'`index` envoyé est la position finale parmi les frères, calculée sans l'élément déplacé et sur la liste complète (jamais la liste filtrée) ; déposer juste au-dessus ou au-dessous de sa place actuelle n'envoie rien ; un dépôt dans son propre sous-arbre est ignoré.
8. **Renommage long d'une note** (T12b) : une sauvegarde partie pendant `notes.rename` finit dans le nouveau fichier, l'état revient à « Enregistré » sans bannière « Modifié hors de Kibo » ; la création refuse un nom pris sans rien écrire.

## Décisions

Les décisions de démon et de coque sont écrites en spec code et onglets **§12** (12.1 à 12.6) et spec I §3.7 / §4 ; le plan ne les répète pas. Décisions d'interface prises par ce plan, à reporter au rapport du jalon :

1. **Primitives dans le SDK, pas dans l'UI** : `ConfirmDialog`, `ReasonDialog` et les entrées de menu (`MenuEntry`, `ContextMenuEntries`, `DropdownMenuEntries`) vivent dans `packages/sdk/src/ui/` (`@kibo/sdk/ui/*`), car les composants intégrés (tickets, kanban, notes) en ont besoin autant que le shell et n'ont pas accès à `packages/ui` (dogfooding). `BlockDialog` du Kanban devient un habillage de `ReasonDialog`.
2. **Un menu = une liste d'entrées** : le même tableau `MenuEntry[]` nourrit le clic droit (`ContextMenu`) et le bouton « ⋯ » (`DropdownMenu`) d'un élément, pour qu'ils ne divergent jamais et que les tests portent sur la liste.
3. **Réduction du chargement initial avant tout ajout** (T2) : `RenameWorkspaceDialog`, `NotesDirDialog`, `TrustDialog` et `OpenViewDialog` sortent de l'entrée (chargés à la demande), ce qui rend la marge nécessaire aux menus de la barre latérale et au menu d'instance.
4. **Fiche ticket** : titre et description s'éditent en place (clic sur le titre, bouton « Modifier » sous la description), statut et assigné par des sélecteurs ; le domaine reste le sélecteur existant ; « Assigner à un agent » reste le seul chemin vers un assigné agent (le sélecteur propose « Personne », « Moi » et, en projet partagé, les membres). Le menu « ⋯ » porte « Ouvrir dans un onglet », « Copier la clé », « Supprimer… ». La suppression ferme la fiche.
5. **Dépendances** : trois groupes dans la fiche, « Bloqué par », « Bloque », « Lié à », lignes cliquables (ouvre l'autre ticket dans la fiche) avec retrait, et un formulaire « Ajouter » (type + recherche par clé ou titre). Les badges « attend » disparaissent de la fiche au profit du groupe « Bloqué par » (les tickets terminés y sont grisés) ; ils restent dans l'arbre et le Kanban.
6. **Pages** : le glisser-déposer **reparente** (déposer sur une page ⇒ sous-page, sur le nom du projet ⇒ racine) **et réordonne** (déposer au-dessus ou au-dessous d'une sœur ⇒ `movePage` avec `index`, décision d'Adam du 2026-09-27 : le glisser-déposer ne se limite pas au reparentage) ; « Monter » / « Descendre » restent dans le menu. Renommer ouvre un dialogue (un titre de page se saisit rarement en place dans une barre latérale étroite).
7. **Notes** : « Renommer… » demande un titre ; le nom de fichier est son `slug` (`slugify` déjà dans `packages/ui/src/ai/slug.ts`, recopié dans le composant car un composant n'importe pas l'UI) dans le même dossier. À la **première sauvegarde d'une note nouvelle** encore nommée `sans-titre(-n).md`, si le premier titre `# …` donne un slug et que `<slug>.md` est libre, le fichier est renommé ; sinon il garde son nom. Décision d'Adam (2026-09-27) : **aucune note ne reste sans titre**. « Nouvelle note » demande un titre obligatoire (fichier `<slug>.md`, première ligne `# Titre`) ; une note `sans-titre(-n).md` existante est renommée à sa prochaine sauvegarde si elle a un titre, sinon la liste la signale et propose « Renommer… ». Avant tout renommage, le tampon de l'éditeur est enregistré et les sauvegardes suivantes visent le nouveau chemin (aucune frappe perdue).
8. **Réglages d'un widget** : formulaire généré depuis `configSchema` du manifeste (`ConfigField` : `enum` ⇒ sélecteur, `boolean` ⇒ interrupteur, `number` ⇒ champ numérique, `string` ⇒ champ texte, `nullable` ⇒ case « Aucune valeur ») ; les clés hors schéma (`source`, configuration MCP) sont conservées telles quelles. Pas d'entrée « Réglages… » quand le schéma est vide ou absent.
9. **Arbre Tickets** : le composant déclare `writes: ["ticket"]` ; le glisser-déposer reparente (déposer sur une ligne ⇒ sous-ticket ; « Déplacer à la racine » dans le menu) et réordonne entre frères (déposer au-dessus ou au-dessous d'une ligne, T10b ; **vérifié le 2026-09-30** : `moveTicket { index? }` existe dans le schéma, `core` et le démon, aucune décision de schéma à écrire ; `index` = position finale parmi les frères, comme `movePage`) ; le statut se change par un sous-menu, « Bloqué » ouvre `ReasonDialog`. Le Kanban gagne le clic droit et « Supprimer… », rien d'autre (carte entière déplaçable et ordre dans la colonne : lot 8).
10. **Titre de fenêtre** : identique au titre de l'onglet actif suivi de « — Kibo » ; « Kibo » seul sur l'Accueil.
11. **Écrans Penpot** : dessinés par le chef d'équipe en tête de vague (T1). Si l'édition Penpot n'est pas faisable par un agent, la vague avance et le rapport du jalon liste ces écrans comme écart assumé ; les tâches UI suivent alors les descriptions textuelles de T1.
12. **Zones de dépôt** (T7b, T10b, ajoutées le 2026-09-30) : trois zones par ligne, quart haut (« au-dessus »), milieu (« dans »), quart bas (« au-dessous »), rendues par des calques `aria-hidden` sans événement de pointeur ; collision `pointerWithin` ; le plan de dépôt est une fonction pure testée sans DOM (`page-drop.ts`, `tree-drop.ts`), le glisser ne se simule pas sous happy-dom.
13. **Session distante dans l'UI** (T3b) : `remote = isRemoteView()` en prop par défaut (motif de `ComponentSourcesPage`), jamais lu au niveau du module ; les composants reçoivent `readOnly` et ne rendent aucune action d'écriture (pas de bouton désactivé : absent).

## Écrans à dessiner (Penpot, T1)

Page **« 14 · Finitions UI »**, script `design/penpot/scripts/17-finitions.js` (modèle : `15-complements.js`), écrans **98 à 106**, en sombre et en clair, données de `design/donnees-fictives.md` (projet Kibo, ticket KIB-12, page « Kanban », note « Architecture du sync »). Chaque tâche UI cite les écrans qu'elle implémente.

- **98 · Fiche ticket éditable** (T6) : Sheet de KIB-12, titre en cours d'édition (champ avec le texte « Schéma Loro des tickets (LoroTree) », aide « Entrée pour enregistrer · Échap pour annuler »), lignes Statut (sélecteur « En cours »), Domaine (« Core »), Assigné (sélecteur « opus-dev-1 » désactivé avec infobulle « Choisis un profil via Assigner à un agent »), Description avec bouton « Modifier », Sous-tickets 3/5 cliquables, menu « ⋯ » ouvert : Ouvrir dans un onglet, Copier la clé, séparateur, Supprimer…
- **99 · Supprimer un ticket** (T6, T10, T11) : confirmation « Supprimer KIB-12 ? », « Ses 5 sous-tickets et ses liens seront supprimés aussi. Cette action est irréversible. », boutons Annuler / Supprimer.
- **100 · Dépendances** (T14) : section « Dépendances » de la fiche : « Bloqué par » KIB-5 (Terminé, grisé) et KIB-13 (Terminé, grisé) ; « Bloque » KIB-15 ; « Lié à » KIB-16 ; chaque ligne avec la pastille de statut et une croix « Retirer » ; formulaire « Ajouter une dépendance » ouvert : sélecteur de type (« Bloqué par », « Bloque », « Lié à ») et champ de recherche « KIB-2… » avec 3 résultats ; variante d'erreur « Impossible : cela créerait une boucle de dépendances. »
- **101 · Menu d'une page** (T7) : barre latérale, clic droit sur « Kanban » : Ouvrir dans un nouvel onglet, Nouvelle sous-page, Renommer…, Monter, Descendre, Déplacer vers ▸ (Racine, Tableau de bord), séparateur, Supprimer… ; dialogue « Renommer la page » (champ « Nom ») ; confirmation « Supprimer la page Kanban ? » « Ses 2 sous-pages et 3 widgets disparaîtront. » ; état de dépôt d'un glisser-déposer (ligne cible surlignée).
- **102 · Menu d'un ticket dans l'arbre** (T10) : clic droit sur KIB-27 : Ouvrir, Statut ▸ (Backlog, À faire, En cours ✓, En review, Bloqué…, Terminé), Nouveau sous-ticket, Déplacer à la racine, séparateur, Supprimer… ; même menu en « ⋯ » au survol ; dialogue « Bloquer KIB-27 » (motif).
- **103 · Menu d'une note** (T12) : liste des notes, « ⋯ » sur « Architecture du sync » : Renommer…, Supprimer… ; dialogue « Renommer la note » (champ « Titre », aide « Fichier : architecture-du-sync.md ») ; confirmation « Supprimer la note « Architecture du sync » ? » « Le fichier architecture-du-sync.md sera supprimé du disque. »
- **104 · Menu d'un fichier modifié** (T15) : vue Changements, clic droit sur `packages/core/ticket.ts` : Voir le diff, Ouvrir dans un onglet, Ouvrir dans l'éditeur externe, Copier le chemin, Indexer, séparateur, Annuler les changements… ; en-têtes de section avec « Tout indexer » (Non indexés) et « Tout désindexer » (Indexés) ; confirmation « Annuler les changements de 2 fichiers ? » « ticket.ts reviendra à sa dernière version commitée. notes.md est nouveau : il sera supprimé du disque. Cette action est irréversible. »
- **105 · Réglages d'un widget** (T8) : dialogue « Réglages · Kanban » avec « Filtre » (sélecteur « Moi + agents » / « Tous »), aide « Ces réglages ne concernent que ce widget. », boutons Annuler / Enregistrer ; menu « ⋯ » d'un widget : Mettre à jour vers…, Réglages…, séparateur, Retirer de la page… ; confirmation « Retirer Kanban de la page ? » « Le widget disparaît de la page ; les tickets ne sont pas touchés. »
- **106 · Domaine : nom et couleur** (T9) : en-tête « Domaine · Core » avec crayon (champ de renommage ouvert) et pastille couleur ouverte sur la palette des 7 couleurs de `DOMAIN_COLORS` ; confirmation « Supprimer le domaine Core ? » « Ses 3 fichiers de guidelines seront supprimés. »

Coque de bureau (T4, T13) : pas d'écran Penpot (menu natif, titre de fenêtre) ; le logo (T5) met à jour la page **05 · Logo** si l'export change (sinon rien).

## File Structure

```
packages/sdk/src/ui/
  confirm-dialog.tsx  reason-dialog.tsx  menu-entries.tsx         NOUVEAU (T2) : primitives partagées shell + composants
packages/sdk/src/ui/menu-entries.test.tsx  confirm-dialog.test.tsx NOUVEAU (T2)
packages/ui/scripts/bundle-report.ts                              FORBIDDEN_IN_ENTRY (T2, T6, T7, T8, T13)
packages/ui/scripts/app-icon.ts  app-icon.test.ts  tsconfig.json  NOUVEAU / modifié (T5) : génère app-icon.svg et favicon.svg
packages/ui/src/shell/kibo-mark.test.ts  kibo-logo.test.tsx        NOUVEAU (T5)
packages/ui/public/favicon.svg  packages/ui/index.html            NOUVEAU / modifié (T5)
packages/ui/src/shell/kibo-mark.ts  KiboLogo.tsx                  géométrie unique du logo (T5)
packages/ui/src/shell/lazy-dialogs.ts                             ConfirmDialog (T2), RenamePageDialog (T7), InstanceSettingsDialog (T8)
packages/ui/src/shell/WorkspaceSwitcher.tsx  use-open-view.tsx    dialogues sortis de l'entrée (T2)
packages/ui/src/pages/InstanceMenu.tsx                            NotesDirDialog / TrustDialog à la demande (T2) ; Réglages…, retrait confirmé (T8)
packages/ui/src/ticket/                                           NOUVEAU (T6) : TicketTitle, TicketActionsMenu, StatusSelect, AssigneeSelect,
  DescriptionEditor, use-ticket-command.ts, ticket-edit.test.tsx    chargé avec TicketDetail (déjà à la demande)
packages/ui/src/ticket/DependenciesSection.tsx  AddLinkForm.tsx  links.ts  links.test.ts  dependencies.test.tsx   NOUVEAU (T14)
packages/ui/src/i18n/fr-ticket-edit.ts                            NOUVEAU (T6, complété T14)
packages/ui/src/shell/TicketDetail.tsx  TicketSheet.tsx  ShellDialogs.tsx  ContentView.tsx  Shell.tsx   (T6 : onOpenTicket, onDeleted)
packages/ui/src/pages/TicketTab.tsx                               (T6)
packages/ui/src/shell/ProjectPages.tsx  page-menu.ts  page-menu.test.ts  project-pages.test.tsx   NOUVEAU (T7, extrait d'AppSidebar)
packages/ui/src/dialogs/RenamePageDialog.tsx  rename-page-dialog.test.tsx   NOUVEAU (T7)
packages/ui/src/shell/AppSidebar.tsx                              délègue les pages à ProjectPages (T7) ; select-none, libellé ⌘K (T13)
packages/ui/src/i18n/fr.ts                                        nav (T7), domains (T9), common (T2)
packages/ui/src/dialogs/InstanceSettingsDialog.tsx  packages/ui/src/lib/config-form.ts  config-form.test.ts  instance-settings.test.tsx   NOUVEAU (T8)
packages/ui/src/i18n/fr-widgets.ts                                NOUVEAU (T8) ; fr-components.ts › instance (T8)
packages/ui/src/settings/DomainHeader.tsx  domain-header.test.tsx NOUVEAU (T9) ; DomainsPage.tsx, GuidelineFiles.tsx (T9)
components/tickets/src/TicketRowMenu.tsx  ticket-menu.ts  ticket-menu.test.ts  tree-drop.ts  tree-drop.test.ts  TicketsTree.tsx  fr.ts  kibo.component.json  package.json   (T10)
components/kanban/src/BlockDialog.tsx (habillage ReasonDialog, T2)  KanbanCard.tsx  Kanban.tsx  card-menu.ts  fr.ts   (T11)
components/notes/src/NoteMenu.tsx  RenameNoteDialog.tsx  note-name.ts  note-name.test.ts  NoteList.tsx  NotesView.tsx  fr.ts   (T12)
packages/ui/src/desktop/external-links.ts  native-context-menu.ts  window-title.ts  install.ts  use-window-title.ts  *.test.ts   NOUVEAU (T13)
packages/ui/src/lib/shortcut-label.ts  shortcut-label.test.ts     NOUVEAU (T13) ; TabBar.tsx, AppSidebar.tsx, ShellHeader.tsx (T13)
packages/ui/package.json                                          @tauri-apps/plugin-opener (T13)
packages/ui/src/code/FileList.tsx  file-menu.ts  file-menu.test.ts  ChangesFiles.tsx  ChangesView.tsx  changes-files.test.tsx  changes.test.tsx   (T15) ; ContentView.tsx, Shell.tsx (onOpen newTab)
packages/ui/src/i18n/fr-code.ts                                   changes (T15)
packages/schema/src/code.ts  code.test.ts                         discardChanges, stageAll, unstageAll (T3)
packages/daemon/src/code/index-ops.ts  index-ops.test.ts  code-service.ts  code-service.test.ts   (T3)
packages/daemon/src/server.ts  server-code.test.ts                ctx transmis à code.handle (T3)
apps/desktop/src-tauri/Cargo.toml  Cargo.lock  src/main.rs  src/menu.rs   (T4)
apps/desktop/app-icon.svg  src-tauri/icons/*                      régénérés (T5)
design/penpot/scripts/17-finitions.js  design/penpot/kibo.penpot.xz  design/pdf/*.pdf  design/penpot/README.md   (T1)
e2e/menus.spec.ts  e2e/playwright.config.ts                       (T16)
packages/schema/src/code.ts  code.test.ts                         CODE_MUTATION_METHODS, LOCAL_ONLY_CODE_METHODS élargie, CODE_READ_METHODS (T3b)
packages/daemon/src/code/code-service.ts  code-service.test.ts  server-code.test.ts   liste du schéma, refus distant par méthode (T3b)
packages/ui/src/code/ChangesView.tsx  ChangesFiles.tsx  FileList.tsx  DiffColumn.tsx  DiffToolbar.tsx  DiffView.tsx  OperationBanner.tsx  changes.test.tsx   remote / readOnly (T3b)
packages/ui/src/files/FileTabView.tsx  files.test.tsx             remote (T3b) ; i18n/fr-code.ts (localOnly, errors.FORBIDDEN)
packages/ui/src/shell/page-drop.ts  page-drop.test.ts             NOUVEAU (T7b) : zones et plan de dépôt ; ProjectPages.tsx (T7b)
components/tickets/src/tree-drop.ts  tree-drop.test.ts  TicketsTree.tsx   zones et plan de dépôt (T10b) ; packages/core/src/tickets.test.ts (index)
components/notes/src/NoteTitleDialog.tsx  notes.test-helper.tsx  notes-rename.test.tsx   NOUVEAU (T12b) ; note-name.ts, RenameNoteDialog.tsx, NoteList.tsx, NotesView.tsx, use-note-session.ts, fr.ts, notes.test.tsx (T12b)
docs/superpowers/specs/2026-09-26-kibo-code-onglets.md §12, §12.7 (T3b, T7b, T10b, T12b), 2026-09-27-kibo-mises-a-jour.md §3.7 §4, 2026-09-25-kibo-design.md §8   (écrits avec ce plan)
```

## Contrats partagés

Chaque tâche ne voit que sa propre section : ces signatures font foi entre tâches. Une tâche qui doit en changer une le signale au chef d'équipe, qui corrige ici avant d'intégrer.

### SDK (`@kibo/sdk/ui/*`, T2)

```tsx
// packages/sdk/src/ui/confirm-dialog.tsx — confirmation destructive, asynchrone, reste ouverte sur erreur
export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): Promise<void>;
  describeError?: (error: unknown) => string;   // défaut : message de l'Error, sinon String(error)
};
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;

// packages/sdk/src/ui/reason-dialog.tsx — saisie d'un motif (bloquer un ticket)
export type ReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  error: string | null;
  onConfirm(reason: string): void;   // jamais appelé avec un motif vide (bouton désactivé)
  onCancel(): void;
};
export function ReasonDialog(props: ReasonDialogProps): JSX.Element;

// packages/sdk/src/ui/menu-entries.tsx — une liste, deux rendus
export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect(): void;
};
export type MenuSubmenu = { label: string; icon?: LucideIcon; items: MenuAction[] };
export type MenuSeparator = { separator: true };
export type MenuEntry = MenuAction | MenuSubmenu | MenuSeparator;
export const isSeparator = (e: MenuEntry): e is MenuSeparator => "separator" in e;
export const isSubmenu = (e: MenuEntry): e is MenuSubmenu => "items" in e;
export function ContextMenuEntries({ entries }: { entries: readonly MenuEntry[] }): JSX.Element;   // à poser dans <ContextMenuContent>
export function DropdownMenuEntries({ entries }: { entries: readonly MenuEntry[] }): JSX.Element;  // à poser dans <DropdownMenuContent>
```

Rendu : un `MenuAction` ⇒ `ContextMenuItem` / `DropdownMenuItem` (`variant="destructive"` si `destructive`, `disabled`, icône puis libellé puis `…Shortcut`) ; un `MenuSubmenu` ⇒ `…Sub` + `…SubTrigger` + `…SubContent` ; un `MenuSeparator` ⇒ `…Separator`. Clés React : index.

### UI (`packages/ui`)

```ts
// shell/lazy-dialogs.ts (ajouts)
export const ConfirmDialog = lazyPanel(() => import("@kibo/sdk/ui/confirm-dialog").then((m) => m.ConfirmDialog), fr.lazy, hidden);   // T2
export const RenamePageDialog = lazyPanel(() => import("../dialogs/RenamePageDialog").then((m) => m.RenamePageDialog), fr.lazy, hidden);   // T7
export const InstanceSettingsDialog = lazyPanel(() => import("../dialogs/InstanceSettingsDialog").then((m) => m.InstanceSettingsDialog), fr.lazy, hidden);   // T8

// i18n/fr.ts (T2) : common gagne confirm: "Confirmer", delete: "Supprimer", rename: "Renommer", save: "Enregistrer", copied: "Copié"

// shell/ShellDialogs.tsx (T6, T7) — DialogsState gagne :
renamePage: Page | null;      // T7
deletePage: Page | null;      // T7
// et TicketSheet reçoit viewer: string, onDeleted() (= set({ sheet: null })) et onOpenTicket(ticketId) (= set({ sheet: { projectId: sheet.projectId, ticketId } }))  // T6

// shell/ContentView.tsx (T6, T15) : Props gagne onOpenTicket(projectId: string, ticketId: string): void ; Shell passe (projectId, ticketId) => set({ sheet: { projectId, ticketId } }) ;
//   onOpen devient onOpen(target: TabTarget, newTab?: boolean): void (T15) ; Shell passe (t, newTab) => go(t, newTab)
// shell/TicketDetail.tsx (T6) : Props gagne viewer: string ; onOpenTicket(ticketId: string): void ; canEdit calculé dedans par canEdit(project) (pas d'onDeleted : le menu « ⋯ » vit dans l'en-tête du Sheet et de l'onglet)
// pages/TicketTab.tsx (T6) : Props gagne viewer: string ; onOpenTicket(ticketId: string): void
// (viewer : l'UI n'a pas de hook de session ; ShellDialogs et ContentView le tiennent déjà ; ContentView passe project.viewer ?? viewer)

// ticket/use-ticket-command.ts (T6, réutilisé T14)
export function useTicketCommand(projectId: string, describe?: (error: unknown) => string): {   // describe : défaut describeTicketError (codes → fr-ticket-edit.errors)
  run(command: ProjectCommand): Promise<boolean>;   // false et error renseigné en cas d'échec
  error: string | null;
  busy: boolean;
  clearError(): void;
};
export const describeTicketError: (error: unknown) => string;

// code/file-menu.ts (T15)
export type FileMenuActions = { viewDiff(): void; openInTab(): void; openExternal(): void; copyPath(): void; toggleStage(): void; discard(): void };
export function fileMenuEntries(input: { file: FileChange; texts: typeof frCode.changes; actions: FileMenuActions }): MenuEntry[];
export function discardPaths(file: FileChange): string[];            // [path] ou [path, origPath]
export function discardLines(file: FileChange, texts: typeof frCode.changes): string[];   // restauré / supprimé du disque / renommé
// code/ChangesView.tsx (T15) : Props gagne onOpenInTab(ref: FileRef): void

// ticket/links.ts (T14)
export type TicketLinks = { blockedBy: { link: Link; ticket: TicketView }[]; blocks: { link: Link; ticket: TicketView }[]; related: { link: Link; ticket: TicketView }[] };
export function linksOf(project: ProjectSnapshot, ticketId: string): TicketLinks;
export function linkCandidates(project: ProjectSnapshot, ticketId: string, query: string): TicketView[];   // ni lui-même ni déjà lié, 8 au plus, par clé puis titre

// shell/page-menu.ts (T7)
export type PageMenuActions = { openNewTab(): void; newSubPage(): void; rename(): void; moveUp(): void; moveDown(): void; moveTo(parentId: string | null): void; remove(): void };
export function moveTargets(pages: readonly Page[], page: Page): Page[];   // toutes les pages sauf elle-même et ses descendantes
export function siblingIndex(pages: readonly Page[], page: Page): { index: number; count: number };
export function pageMenuEntries(input: { page: Page; pages: readonly Page[]; editable: boolean; texts: PageMenuTexts; actions: PageMenuActions }): MenuEntry[];
export type PageMenuTexts = { openNewTab: string; newSubPage: string; rename: string; moveUp: string; moveDown: string; moveTo: string; root: string; remove: string };

// dialogs/RenamePageDialog.tsx (T7)
export function RenamePageDialog(props: { projectId: string; page: Page; onClose(): void }): JSX.Element;

// lib/config-form.ts (T8)
export type FieldValue = string | number | boolean | null;
export function configFields(schema: ConfigSchema, config: Record<string, unknown>): { key: string; field: ConfigField; value: FieldValue }[];
export function parseFieldInput(field: ConfigField, raw: string): FieldValue;      // "12" ⇒ 12 pour number ; "" ⇒ null si nullable, sinon ""
export function withFieldValue(config: Record<string, unknown>, key: string, value: FieldValue): Record<string, unknown>;   // conserve les autres clés
export function configSchemaOf(instance: Instance, components: ComponentSummary[] | null): ConfigSchema | null;   // intégré : registre ; tiers : manifest de la version ; null si vide ou absent
// dialogs/InstanceSettingsDialog.tsx (T8)
export function InstanceSettingsDialog(props: { projectId: string; instance: Instance; title: string; schema: ConfigSchema; onClose(): void }): JSX.Element;

// lib/shortcut-label.ts (T13)
export const isMac = (): boolean;                                   // isMacPlatform(navigator.platform)
export function shortcutLabel(keys: readonly string[], mac: boolean): string;   // ["K"] ⇒ "⌘K" | "Ctrl+K" ; ["Shift","P"] ⇒ "⌘⇧P" | "Ctrl+Shift+P"

// desktop/ (T13) — chargé par import dynamique depuis Shell quand inTauri()
export function externalLinkOf(target: EventTarget | null, origin: string): { url: string | null } | null;   // null si le <a> n'est pas sortant ; url https: sinon null
export function installExternalLinks(root: Document, open: (url: string) => Promise<void>): () => void;
export function allowsNativeMenu(target: EventTarget | null, selection: string): boolean;   // champ de saisie ou sélection non vide
export function blockNativeContextMenu(root: Document, selection: () => string): () => void;
export function windowTitle(tabTitle: string | null): string;                   // null ⇒ "Kibo", sinon `${tabTitle} — Kibo`
export function installDesktop(): () => void;                                   // liens externes + menu natif ; renvoie le nettoyage
export function setNativeTitle(title: string): Promise<void>;                   // @tauri-apps/api/window (import dynamique)

// shell/page-drop.ts (T7b)
export type DropZone = { kind: "root" } | { kind: "before" | "inside" | "after"; pageId: string };
export type PageMove = { pageId: string; parentId: string | null; index?: number };   // index absent ⇒ fin des enfants (reparentage)
export function zoneId(zone: DropZone): string;                 // "root" | `${pageId}:before` | `${pageId}:inside` | `${pageId}:after`
export function parseZoneId(id: string): DropZone | null;
export function pageDropPlan(pages: readonly Page[], activeId: string, zone: DropZone): PageMove | null;   // null = rien à envoyer (sur place, soi-même, sous-arbre, inconnu)

// code/ChangesView.tsx (T3b) : Props gagne remote?: boolean (défaut isRemoteView()) ; ChangesFiles, FileList, DiffColumn, DiffToolbar : + readOnly: boolean ;
//   DiffView.onHunk devient optionnel ; ChangesAlerts et OperationBanner : onAbort: (() => void) | null
// files/FileTabView.tsx (T3b) : Props gagne remote?: boolean (défaut isRemoteView()) ; startEditing ignoré quand remote
```

### Composants intégrés

```ts
// components/tickets/src/ticket-menu.ts (T10)
export type TicketMenuActions = { open(): void; setStatus(statusId: StatusId): void; newSubTicket(): void; moveToRoot(): void; remove(): void };
export function ticketMenuEntries(input: { ticket: TicketView; statuses: Status[]; readOnly: boolean; texts: typeof fr; actions: TicketMenuActions }): MenuEntry[];
// components/tickets/kibo.component.json : "writes": ["ticket"] ; components/tickets/package.json : "@dnd-kit/core": "6.3.1"

// components/kanban/src/card-menu.ts (T11)
export type CardMenuActions = { open(): void; move(statusId: StatusId): void; remove(): void };
export function cardMenuEntries(input: { ticket: TicketView; statuses: Status[]; readOnly: boolean; texts: typeof fr; actions: CardMenuActions }): MenuEntry[];
// KanbanCard props gagnent onRemove(): void

// components/notes/src/note-name.ts (T12)
export function slugify(title: string): string;                 // copie de packages/ui/src/ai/slug.ts, sans préfixe c-
export const isUntitledPath = (path: string): boolean;          // /^sans-titre(-\d+)?\.md$/ sur le nom de fichier
export function renamedPath(from: string, title: string): string | null;   // même dossier, `${slug}.md` ; null si slug vide
export function autoRenameTarget(note: { path: string; title: string }, taken: readonly string[]): string | null;   // cible libre pour une note sans titre, sinon null ; jamais un nom sans titre (T12b)
export const createdPath = (title: string): string | null;      // T12b : `${slug}.md` à la racine du dossier, null sans slug

// components/notes/src/NoteTitleDialog.tsx (T12b) — formulaire commun à « Nouvelle note » et « Renommer… »
export function NoteTitleDialog(props: { title: string; initial: string; confirmLabel: string; pathFor(title: string): string | null; unchanged: string | null; submit(path: string, title: string): Promise<unknown>; describeError(error: unknown): string; onClose(): void }): JSX.Element;
// components/notes/src/RenameNoteDialog.tsx : props inchangées (note, onRename(from, to), onClose), habillage de NoteTitleDialog
// components/notes/src/use-note-session.ts (T12) : rename(from, to) vide le tampon, renomme, rebase, puis (T12b) vide à nouveau le tampon tapé pendant le renommage

// components/tickets/src/tree-drop.ts (T10b, en plus de reparentOnDrop de T10)
export type DropZone = { kind: "before" | "inside" | "after"; ticketId: string };
export type TicketMove = { ticketId: string; parentId: string | null; index?: number };
export const zoneId: (zone: DropZone) => string;                 // `${ticketId}:before` | `:inside` | `:after`
export function parseZoneId(id: string): DropZone | null;
export function dropPlan(tickets: readonly TicketView[], activeId: string, zone: DropZone): TicketMove | null;   // inside ⇒ reparentOnDrop ; before/after ⇒ index final parmi les frères, sur la liste complète
```

### Démon et schéma (T3)

```ts
// packages/schema/src/code.ts — CodeRequest gagne
z.object({ method: z.literal("discardChanges"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
z.object({ method: z.literal("stageAll"), ...W }),
z.object({ method: z.literal("unstageAll"), ...W }),
// CodeResult gagne  discardChanges: null; stageAll: null; unstageAll: null;
export const LOCAL_ONLY_CODE_METHODS = ["discardChanges", "stageAll", "unstageAll", "openInEditor"] as const;

// packages/daemon/src/code/index-ops.ts
export async function discardChanges(h: WorktreeHandle, paths: string[]): Promise<void>;
export async function stageAll(h: WorktreeHandle): Promise<void>;
export async function unstageAll(h: WorktreeHandle): Promise<void>;
// packages/daemon/src/code/code-service.ts
export type CodeService = { handle(req: CodeRequest, ctx: RpcContext): Promise<unknown>; onChange(...): () => void; stop(): void };
// packages/daemon/src/rpc-extensions.ts
export const LOCAL_CONTEXT: RpcContext = { sessionHash: "local", remote: false };   // pour les tests et les appels internes
// packages/daemon/src/server.ts : code.handle(parsed.data, ctx)

// packages/schema/src/code.ts (T3b) — source unique des listes ; code-service.ts n'a plus de MUTATION_METHODS
export const CODE_MUTATION_METHODS = ["writeFile", "stageFiles", "unstageFiles", "discardChanges", "stageAll", "unstageAll", "stageHunk", "commit", "reword", "undoCommit", "abortOperation", "push", "createPr"] as const;
export const LOCAL_ONLY_CODE_METHODS = [...CODE_MUTATION_METHODS, "openInEditor"] as const;   // pour l'UI et les tests
export const CODE_READ_METHODS = ["worktrees", "status", "diff", "readFile", "remoteBranches", "compare", "commitDefaults", "ghStatus", "prForBranch"] as const;   // liste blanche : toute autre méthode est refusée en FORBIDDEN depuis une session distante (spec §12.3)
// lectures ouvertes à distance : worktrees, status, diff, readFile, remoteBranches, compare, commitDefaults, ghStatus, prForBranch
```

### Coque (T4)

```rust
// apps/desktop/src-tauri/src/main.rs
fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder   // ex-updater_capability : + core:window:allow-set-title, opener:allow-open-url scoped https://**
const MIN_WINDOW: (f64, f64) = (960.0, 600.0);
// apps/desktop/src-tauri/src/menu.rs
pub const RESERVED_FOR_WEBVIEW: &[&str]   // "CmdOrCtrl+W", "CmdOrCtrl+T", "CmdOrCtrl+K", "CmdOrCtrl+Shift+P", "CmdOrCtrl+1" … "CmdOrCtrl+9"
pub enum Entry { Predefined(Predefined), Custom { id: &'static str, text: &'static str, accelerator: Option<&'static str> }, Separator }
pub const MENU: &[(&str, &[Entry])]
pub fn accelerators(menu: &[(&str, &[Entry])]) -> Vec<&'static str>
#[cfg(target_os = "macos")] pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>>
pub fn on_event(app: &AppHandle, id: &str)   // "close-window" ⇒ ferme la fenêtre "main"
```

## Vagues d'exécution

Une vague démarre quand toutes les tâches dont elle dépend sont intégrées dans `phase/9`. Dans une vague, chaque tâche a son worktree `.claude/worktrees/p9-t<n>` et sa branche `feat/p9-t<n>` ; le chef d'équipe lance tous les `kibo-dev` de la vague en parallèle et intègre ensuite **dans l'ordre du tableau**, en rebasant chaque branche sur la précédente (les conflits listés sont des ajouts de quelques lignes). Après chaque intégration d'une tâche UI : `bun run budget`.

| Vague | Tâches en parallèle | Dépendances (tâche ← tâches) | Fichiers partagés dans la vague | Écrans |
|---|---|---|---|---|
| 0 | T1 (chef d'équipe), T2, T3, T4, T5 | aucune (spec §12 écrite) | aucun : T2 = `packages/sdk/src/ui`, shell (dialogues), `bundle-report.ts` ; T3 = schéma `code.ts`, `daemon/src/code`, `server.ts` ; T4 = `apps/desktop/src-tauri` ; T5 = `KiboLogo.tsx`, `kibo-mark.ts`, `index.html`, `public/`, `scripts/app-icon.ts`, `scripts/tsconfig.json`, `app-icon.svg`, `icons/` | T1 dessine 98–106 |
| 1 | T6, T7, T8, T9, T10, T11, T12, T13 | T6, T7, T8, T9 ← T2 · T10, T11 ← T2 (menu-entries, ConfirmDialog, ReasonDialog) · T12 ← T2 · T13 ← T2, T4 | `lazy-dialogs.ts` (T7, T8 : une ligne chacune) ; `bundle-report.ts` (T6, T7, T8, T13 : une regex chacune) ; `fr.ts` (T7 `nav`, T9 `domains`) ; `Shell.tsx` (T6 `onOpenTicket`, T13 `installDesktop`) ; `AppSidebar.tsx` (T7 extrait `ProjectPages`, T13 `select-none` et libellé ⌘K : **T13 après T7**) ; `TabBar.tsx` (T13 seul) | T6 : 98, 99 · T7 : 101 · T8 : 105 · T9 : 106 · T10 : 102, 99 · T11 : 99 · T12 : 103 |
| 1 bis | T3b, T7b, T10b, T12b (réponses d'Adam du 2026-09-27) | T3b ← T3 (déjà intégrée : démarre dès maintenant) · T7b ← T7 · T10b ← T10 · T12b ← T12 ; chacune démarre dès l'intégration de sa base, sans attendre la fin de la vague 1 | **T3b** = `packages/schema/src/code.ts`, `daemon/src/code/code-service.ts`, `packages/ui/src/code/*`, `files/FileTabView.tsx`, `fr-code.ts` : **avant T15** (qui modifie `FileList`, `ChangesFiles`, `ChangesView`, `fr-code.ts`) ; aucun recouvrement avec la vague 1. **T7b** = `shell/page-drop.ts` (nouveau), `shell/ProjectPages.tsx` seulement : en parallèle de T13 (qui touche `AppSidebar.tsx`, `Shell.tsx`, `TabBar.tsx`, jamais `ProjectPages.tsx`), aucun texte ajouté. **T10b** = `components/tickets/src/tree-drop.ts`, `TicketsTree.tsx` (ou `TicketRow.tsx`), `packages/core/src/tickets.test.ts` : indépendante de T11. **T12b** = `components/notes/src/*` seulement | — |
| 1 bis | T4b (relecture de sécurité de T13) | T4b ← T4, T13 | `apps/desktop/src-tauri/src/main.rs`, `packages/daemon/src/main.ts` (et leurs tests) : aucun recouvrement avec les autres tâches | — |
| 2 | T14, T15 | T14 ← T6 · T15 ← T2, T3, **T3b** (`FileList.readOnly`, `errors.FORBIDDEN`) | aucun (T14 = `ticket/`, `TicketDetail.tsx`, `fr-ticket-edit.ts` ; T15 = `code/`, `fr-code.ts`) | T14 : 100 · T15 : 104 |
| 3 | T16 | T16 ← T6, T7, T15 (et T3) | `e2e/playwright.config.ts` (T16 seul) | — |
| Jalon partiel | `bun run budget`, contrôle visuel 98–106 sombre et clair, rapport de vague au chef d'équipe | tout | — | toutes |

Ordre d'intégration de la vague 1 : T6, T7, T8, T9, T10, T11, T12, T13. Tâches à risque relues aussi par `kibo-lead` : T3 (git destructif, contexte de session), T3b (session distante), T4 (capacité IPC, menu natif), T13 (liens externes). T10 modifie le manifeste du composant tickets (`writes`) et sa conformité ; T10 et T11 sont indépendants.

Vague 1 bis : chaque tâche `<n>b` part de `phase/9` **après** l'intégration de sa base (`feat/p9-t3b` dès maintenant, `feat/p9-t7b` après T7, `feat/p9-t10b` après T10, `feat/p9-t12b` après T12), worktree `.claude/worktrees/p9-t<n>b` ; intégration dans l'ordre d'acceptation, `bun run budget` après T3b et T7b (les deux seules qui touchent `packages/ui`). T3b est intégrée avant le démarrage de T15 (fichiers partagés et contrat `readOnly`).

Chemin critique : T2 → T6 → T14 → T16 (4 vagues) ; en parallèle, T3 → T3b → T15 → T16. Vérification locale de la coque (T4) : `cargo test` est possible ici (`~/.cargo/bin/cargo` 1.98.1) après `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts` et `bun apps/desktop/scripts/build-toolchain.ts` (les binaires du sidecar sont exigés par `tauri-build`) ; le `desktop-smoke` de la CI fait foi pour Linux.

---

### Task 1: Maquettes Penpot des écrans 98 à 106

Vague 0, chef d'équipe (ou `kibo-lead`), sans code de production. Flux : `design/penpot/README.md` (Penpot local `docker compose -p kibo-penpot up -d`, `xz -dk kibo.penpot.xz`, scripts chargés par `storage.load` via `receiver.py`, `S.draw[n]()` puis `S.retext`, export `storage.exportPage("14")`, `scripts/build-pdf.sh`, `scripts/pack-penpot.sh`). Si l'édition Penpot n'est pas possible depuis un agent (extension Chrome indisponible), **ne pas bloquer la vague** : cocher la tâche comme « écart assumé », le noter au rapport du jalon, et les tâches UI suivent les descriptions de « Écrans à dessiner ».

**Files:**
- Create: `design/penpot/scripts/17-finitions.js` (en-tête `// Page « 14 · Finitions UI » : écrans 98 à 106 (phase 9, plan kibo-phase-9-vague-1).`, `S.draw[98]` à `S.draw[106]`, chacun en sombre puis `S.relight` pour la variante `… (clair)`)
- Modify: `design/penpot/README.md` (ligne « 14 · Finitions UI | 98–106 » dans le tableau des pages ; `storage.exportPage("14")` dans la liste d'export)
- Modify: `design/penpot/kibo.penpot.xz`, `design/pdf/kibo-design-sombre.pdf`, `design/pdf/kibo-design-clair.pdf`

**Interfaces:**
- Consumes: `S.shellRef` (shell reconstruit, `08-extra.js`), `S.ticketCard`, `S.C` (couleurs), `S.txt`, `S.box`, `S.kanbanLogo` (`01-core.js`), jeu de données `07-data.js`.
- Produces: écrans 98 à 106 cités par T6 à T15.

- [x] **Step 1: Écrire `17-finitions.js`** avec un `S.draw[n]` par écran de la liste « Écrans à dessiner », textes **mot pour mot** (ils sont recopiés dans les fichiers `fr-*.ts` des tâches), composants shadcn (menu contextuel : fond `card`, bordure `border`, entrée destructive en rouge `destructive`, séparateur ; AlertDialog centré avec voile ; Select ; Switch). Données : KIB-12 et ses liens (`design/donnees-fictives.md` : KIB-5 → KIB-12, KIB-13 → KIB-12, KIB-12 → KIB-15, relates KIB-12 — KIB-16).

- [ ] **Step 2: Dessiner et exporter.** Charger `01` à `08` puis `17-finitions.js`, appeler `S.draw[98]()` … `S.draw[106]()` (moins de 120 s par appel), `S.retext`, puis `storage.exportPage("14")`, `scripts/build-pdf.sh`, `scripts/pack-penpot.sh`.

- [ ] **Step 3: Vérifier** dans `design/pdf/kibo-design-clair.pdf` que chaque écran a sa variante claire et que l'orange n'apparaît qu'en marque et agents.

- [ ] **Step 4: Commit**

```bash
git add design/penpot/scripts/17-finitions.js design/penpot/README.md design/penpot/kibo.penpot.xz design/pdf/kibo-design-sombre.pdf design/pdf/kibo-design-clair.pdf
git commit -m "docs(design): écrans 98 à 106 des finitions UI"
```

---

> Écart assumé (partiel) : `17-finitions.js` écrit et intégré (`3b4721f`) ; seuls 98 et 99 sombres ont été dessinés dans Penpot avant que Chrome ne se fige sur un export PNG. Reste : dessiner 100–106, variantes claires (`S.finish`), `storage.exportPage("14")`, PDF (ajouter les pages par `pdfunite`, ne pas relancer `build-pdf.sh` sur l'export périmé), `pack-penpot.sh`, README. Ne pas exporter de planche entière en PNG par `export_shape`.

### Task 2: Socle : confirmation, motif, entrées de menu, chargement initial réduit

Vague 0. Trois primitives dans le SDK (décision 1), leurs habillages à la demande dans le shell, et la **réduction du chargement initial** (décision 3) qui rend la marge nécessaire aux vagues suivantes. Objectif mesuré : `bun run budget` ≤ 224,0 kB à la fin de la tâche (départ : 229,1 kB).

**Files:**
- Create: `packages/sdk/src/ui/confirm-dialog.tsx`, `packages/sdk/src/ui/reason-dialog.tsx`, `packages/sdk/src/ui/menu-entries.tsx`
- Test: `packages/sdk/src/ui/confirm-dialog.test.tsx`, `packages/sdk/src/ui/menu-entries.test.tsx`
- Modify: `components/kanban/src/BlockDialog.tsx` (habillage de `ReasonDialog`, mêmes props, mêmes textes : `kanban.test.tsx` inchangé)
- Modify: `packages/ui/src/shell/lazy-dialogs.ts` (+ `ConfirmDialog`, `RenameWorkspaceDialog`, `NotesDirDialog`, `TrustDialog`, `OpenViewDialog`), `packages/ui/src/shell/WorkspaceSwitcher.tsx`, `packages/ui/src/pages/InstanceMenu.tsx`, `packages/ui/src/shell/use-open-view.tsx` (imports à la demande), `packages/ui/scripts/bundle-report.ts` (`FORBIDDEN_IN_ENTRY` : `dialogs/(RenameWorkspaceDialog|NotesDirDialog|TrustDialog|OpenViewDialog)`, `node_modules/@kibo/sdk/src/ui/(confirm-dialog|reason-dialog|alert-dialog)` — vérifier le chemin réel des modules du SDK dans les `moduleIds` du build : ce sont des chemins `packages/sdk/src/ui/...` résolus par workspace, pas `node_modules`), `packages/ui/src/i18n/fr.ts` (`common`)
- Test (existants, attentes inchangées) : `packages/ui/src/shell/workspace-switcher.test.tsx`, `packages/ui/src/pages/instance.test.tsx` (attendre le rendu à la demande avec `findBy*` là où `getBy*` échoue)

**Interfaces:**
- Produces: `ConfirmDialog`, `ReasonDialog`, `MenuEntry`, `ContextMenuEntries`, `DropdownMenuEntries`, `isSeparator`, `isSubmenu` (Contrats partagés › SDK) ; `fr.common.{confirm, delete, rename, save, copied}` ; `lazy-dialogs.ConfirmDialog`.
- Consumes: `@kibo/sdk/ui/alert-dialog`, `dialog`, `textarea`, `label`, `button`, `context-menu`, `dropdown-menu` (existants).

- [x] **Step 1: Tests des primitives (rouges)**

`packages/sdk/src/ui/menu-entries.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "./context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, isSeparator, isSubmenu, type MenuEntry } from "./menu-entries";

const entries = (log: string[]): MenuEntry[] => [
  { label: "Ouvrir", onSelect: () => log.push("open") },
  { label: "Statut", items: [{ label: "En cours", onSelect: () => log.push("in_progress") }] },
  { separator: true },
  { label: "Supprimer…", icon: Trash2, destructive: true, onSelect: () => log.push("remove") },
];

test("type guards tell separators and submenus apart", () => {
  const [action, sub, sep] = entries([]);
  expect(isSeparator(sep as MenuEntry)).toBe(true);
  expect(isSubmenu(sub as MenuEntry)).toBe(true);
  expect(isSubmenu(action as MenuEntry)).toBe(false);
});

test("a dropdown renders every entry and runs the selected action", async () => {
  const log: string[] = [];
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuEntries entries={entries(log)} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("separator")).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "Statut" }));
  await user.click(await screen.findByRole("menuitem", { name: "En cours" }));
  expect(log).toEqual(["in_progress"]);
});

test("a context menu opens on right click and marks the destructive entry", async () => {
  const log: string[] = [];
  render(
    <ContextMenu>
      <ContextMenuTrigger>Ligne</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries(log)} />
      </ContextMenuContent>
    </ContextMenu>,
  );
  const user = userEvent.setup();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Ligne") });
  const remove = await screen.findByRole("menuitem", { name: "Supprimer…" });
  expect(remove.getAttribute("data-variant")).toBe("destructive");
  await user.click(remove);
  expect(log).toEqual(["remove"]);
});
```

`packages/sdk/src/ui/confirm-dialog.test.tsx` :
```tsx
import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

const props = (onConfirm: () => Promise<void>, onOpenChange = mock((_o: boolean) => {})) => ({
  open: true,
  onOpenChange,
  title: "Supprimer la page Kanban ?",
  description: "Ses 2 sous-pages disparaîtront.",
  confirmLabel: "Supprimer",
  cancelLabel: "Annuler",
  onConfirm,
});

test("confirming awaits the action then closes", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  let resolve: () => void = () => {};
  const onConfirm = mock(() => new Promise<void>((r) => { resolve = r; }));
  render(<ConfirmDialog {...props(onConfirm, onOpenChange)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  expect((screen.getByRole("button", { name: "Supprimer" }) as HTMLButtonElement).disabled).toBe(true);
  expect(onOpenChange).not.toHaveBeenCalled();
  resolve();
  await screen.findByRole("button", { name: "Supprimer" });
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

test("a failed action keeps the dialog open and shows the error", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  render(<ConfirmDialog {...props(() => Promise.reject(new Error("git refused")), onOpenChange)} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Supprimer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("git refused");
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
  expect((screen.getByRole("button", { name: "Supprimer" }) as HTMLButtonElement).disabled).toBe(false);
});

test("cancel closes without calling the action", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  const onConfirm = mock(() => Promise.resolve());
  render(<ConfirmDialog {...props(onConfirm, onOpenChange)} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Annuler" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});
```

Run: `bun test packages/sdk/src/ui/menu-entries.test.tsx packages/sdk/src/ui/confirm-dialog.test.tsx`
Expected: FAIL (modules introuvables).

- [x] **Step 2: Implémenter les primitives**

`packages/sdk/src/ui/menu-entries.tsx` :
```tsx
import type { LucideIcon } from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@kibo/sdk/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@kibo/sdk/ui/dropdown-menu";

export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect(): void;
};
export type MenuSubmenu = { label: string; icon?: LucideIcon; items: MenuAction[] };
export type MenuSeparator = { separator: true };
export type MenuEntry = MenuAction | MenuSubmenu | MenuSeparator;

export const isSeparator = (e: MenuEntry): e is MenuSeparator => "separator" in e;
export const isSubmenu = (e: MenuEntry): e is MenuSubmenu => "items" in e;

type Parts = {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
  Shortcut: typeof ContextMenuShortcut | typeof DropdownMenuShortcut;
  Sub: typeof ContextMenuSub | typeof DropdownMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent;
};

const CONTEXT: Parts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};
const DROPDOWN: Parts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function Action({ action, parts }: { action: MenuAction; parts: Parts }) {
  const Icon = action.icon;
  return (
    <parts.Item
      disabled={action.disabled}
      variant={action.destructive ? "destructive" : "default"}
      onSelect={action.onSelect}
    >
      {Icon && <Icon aria-hidden />}
      {action.label}
      {action.shortcut && <parts.Shortcut>{action.shortcut}</parts.Shortcut>}
    </parts.Item>
  );
}

function Entries({ entries, parts }: { entries: readonly MenuEntry[]; parts: Parts }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (isSeparator(entry)) return <parts.Separator key={i} />;
        if (isSubmenu(entry)) {
          const Icon = entry.icon;
          return (
            <parts.Sub key={i}>
              <parts.SubTrigger>
                {Icon && <Icon aria-hidden />}
                {entry.label}
              </parts.SubTrigger>
              <parts.SubContent>
                {entry.items.map((item, j) => (
                  <Action key={j} action={item} parts={parts} />
                ))}
              </parts.SubContent>
            </parts.Sub>
          );
        }
        return <Action key={i} action={entry} parts={parts} />;
      })}
    </>
  );
}

export function ContextMenuEntries({ entries }: { entries: readonly MenuEntry[] }) {
  return <Entries entries={entries} parts={CONTEXT} />;
}

export function DropdownMenuEntries({ entries }: { entries: readonly MenuEntry[] }) {
  return <Entries entries={entries} parts={DROPDOWN} />;
}
```
(Vérifier que `ContextMenuItem` et `DropdownMenuItem` du SDK acceptent `variant="destructive"` et posent `data-variant` : c'est le cas des composants shadcn v4 générés ; sinon l'ajouter au composant shadcn par le CLI, jamais à la main dans `packages/ui`.)

`packages/sdk/src/ui/confirm-dialog.tsx` :
```tsx
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Button } from "@kibo/sdk/ui/button";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): Promise<void>;
  describeError?: (error: unknown) => string;
};

const defaultDescribe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function ConfirmDialog(p: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describe = p.describeError ?? defaultDescribe;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.onConfirm();
      p.onOpenChange(false);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={p.open} onOpenChange={(o) => !busy && p.onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p.title}</AlertDialogTitle>
          <AlertDialogDescription>{p.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{p.cancelLabel}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            {p.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

`packages/sdk/src/ui/reason-dialog.tsx` (reprend `components/kanban/src/BlockDialog.tsx` en le rendant générique) :
```tsx
import { useId, useState } from "react";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";

export type ReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  error: string | null;
  onConfirm(reason: string): void;
  onCancel(): void;
};

export function ReasonDialog(p: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <Dialog open={p.open} onOpenChange={(o) => !o && p.onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{p.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>{p.label}</Label>
          <Textarea id={id} value={reason} placeholder={p.placeholder} onChange={(e) => setReason(e.target.value)} />
          {p.error && (
            <p role="alert" className="text-sm text-destructive">
              {p.error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={p.onCancel}>
            {p.cancelLabel}
          </Button>
          <Button disabled={trimmed.length === 0} onClick={() => p.onConfirm(trimmed)}>
            {p.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`components/kanban/src/BlockDialog.tsx` devient :
```tsx
import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { fr } from "./fr";

type Props = { ticketKey: string; error: string | null; onConfirm: (reason: string) => void; onCancel: () => void };

export function BlockDialog({ ticketKey, error, onConfirm, onCancel }: Props) {
  return (
    <ReasonDialog
      open
      title={fr.block.title(ticketKey)}
      description={fr.block.description}
      label={fr.block.reason}
      placeholder={fr.block.placeholder}
      confirmLabel={fr.block.confirm}
      cancelLabel={fr.block.cancel}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
```

Run: `bun test packages/sdk/src/ui components/kanban`
Expected: PASS (les tests du Kanban gardent leurs attentes).

- [x] **Step 3: Réduire le chargement initial**

Mesure de départ : `bun run budget` (noter la valeur). Puis :
- `packages/ui/src/shell/lazy-dialogs.ts` ajoute :
```ts
export const ConfirmDialog = lazyPanel(
  () => import("@kibo/sdk/ui/confirm-dialog").then((m) => m.ConfirmDialog),
  fr.lazy,
  hidden,
);
export const RenameWorkspaceDialog = lazyPanel(
  () => import("../dialogs/RenameWorkspaceDialog").then((m) => m.RenameWorkspaceDialog),
  fr.lazy,
  hidden,
);
export const NotesDirDialog = lazyPanel(
  () => import("../dialogs/NotesDirDialog").then((m) => m.NotesDirDialog),
  fr.lazy,
  hidden,
);
export const TrustDialog = lazyPanel(() => import("../dialogs/TrustDialog").then((m) => m.TrustDialog), fr.lazy, hidden);
export const OpenViewDialog = lazyPanel(
  () => import("../dialogs/OpenViewDialog").then((m) => m.OpenViewDialog),
  fr.lazy,
  hidden,
);
```
- `WorkspaceSwitcher.tsx` : remplacer `import { RenameWorkspaceDialog } from "../dialogs/RenameWorkspaceDialog"` par l'import depuis `./lazy-dialogs`.
- `InstanceMenu.tsx` : `NotesDirDialog` et `TrustDialog` depuis `../shell/lazy-dialogs` ; `trustTargetOf` et `TrustTarget` restent importés depuis `../dialogs/TrustDialog` **seulement s'ils sont légers** : sinon déplacer `trustTargetOf` et le type dans `packages/ui/src/lib/trust-target.ts` (fonction pure, sans JSX) et faire pointer `TrustDialog.tsx` dessus.
- `use-open-view.tsx` : `OpenViewDialog` depuis `./lazy-dialogs`.
- `bundle-report.ts`, `FORBIDDEN_IN_ENTRY` : ajouter
```ts
  /\/packages\/ui\/src\/dialogs\/(RenameWorkspaceDialog|NotesDirDialog|TrustDialog|OpenViewDialog)\.tsx$/,
  /\/packages\/sdk\/src\/ui\/(alert-dialog|confirm-dialog|reason-dialog)\.tsx$/,
```
- `fr.ts` › `common` : `common: { cancel: "Annuler", close: "Fermer", error: "Une erreur est survenue.", confirm: "Confirmer", delete: "Supprimer", rename: "Renommer", save: "Enregistrer", copied: "Copié" }`.

Run: `bun run budget`
Expected: `gzip : ≤ 224.0 kB (budget 230.0 kB)`, aucun « Module interdit ». Si la cible n'est pas atteinte, sortir aussi `dialogs/ShareProjectDialog` déjà lazy ? non : chercher avec `bun packages/ui/scripts/bundle-budget.ts` les plus gros `moduleIds` de l'entrée (ajouter temporairement un `console.log` trié, retiré avant commit) et déplacer le suivant (candidats : `palette/*` déjà lazy ; `agents/AgentPanel` non ; `shell/Overview` ; `dialogs/integrations/*`).

- [x] **Step 4: Tests existants et gate**

Run: `bun test packages/ui/src/shell/workspace-switcher.test.tsx packages/ui/src/pages/instance.test.tsx packages/ui/src/shell/shell.test.tsx`
Expected: PASS après passage à `findBy*` des attentes qui rendent un dialogue désormais chargé à la demande (attente inchangée sur le contenu).

Run: `bun run check && bun run typecheck && bun test packages components ./scripts`
Expected: PASS.

- [x] **Step 5: Commits**

```bash
git add packages/sdk/src/ui/menu-entries.tsx packages/sdk/src/ui/menu-entries.test.tsx packages/sdk/src/ui/confirm-dialog.tsx packages/sdk/src/ui/confirm-dialog.test.tsx packages/sdk/src/ui/reason-dialog.tsx components/kanban/src/BlockDialog.tsx
git commit -m "feat(sdk): confirmation, motif et entrées de menu"
git add packages/ui/src/shell/lazy-dialogs.ts packages/ui/src/shell/WorkspaceSwitcher.tsx packages/ui/src/pages/InstanceMenu.tsx packages/ui/src/shell/use-open-view.tsx packages/ui/scripts/bundle-report.ts packages/ui/src/i18n/fr.ts packages/ui/src/shell/workspace-switcher.test.tsx packages/ui/src/pages/instance.test.tsx
git commit -m "perf(ui): dialogues du shell chargés à la demande"
```
(Ajouter `packages/ui/src/lib/trust-target.ts` et `packages/ui/src/dialogs/TrustDialog.tsx` au second commit si l'extraction a eu lieu.)

---

### Task 3: Démon : annuler les changements, tout indexer, contexte de session

Vague 0. Spec §12.1 à §12.3. Trois requêtes sur `/api/code`, et le contexte de session transmis à `CodeService.handle` pour refuser les actions locales à une session distante.

**Files:**
- Modify: `packages/schema/src/code.ts` (trois variantes de `CodeRequest`, `CodeResult`, `LOCAL_ONLY_CODE_METHODS`), `packages/schema/src/code.test.ts`
- Modify: `packages/daemon/src/code/index-ops.ts` (`discardChanges`, `stageAll`, `unstageAll`), `packages/daemon/src/code/index-ops.test.ts`
- Modify: `packages/daemon/src/code/code-service.ts` (`handle(req, ctx)`, `MUTATION_METHODS` + 3, `requireLocal` pour `LOCAL_ONLY_CODE_METHODS`), `packages/daemon/src/code/code-service.test.ts`
- Modify: `packages/daemon/src/rpc-extensions.ts` (`LOCAL_CONTEXT`), `packages/daemon/src/server.ts` (`code.handle(parsed.data, ctx)`), `packages/daemon/src/server-code.test.ts` (un test : `openInEditor` répond 403 quand la session est distante — voir Step 5)
- Modify: `packages/ui/src/i18n/fr-code.ts` › `errors` : rien (les codes existent) ; le texte `FORBIDDEN` de l'UI est ajouté en T15.

**Interfaces:**
- Consumes: `resolveInWorktree`, `assertNotSymlink` (`code/safe-path.ts`), `readStatus`, `hasHead`, `currentOperation` (`code/read.ts`), `Git.ok` (`code/run.ts`), `requireLocal`, `RpcContext` (`rpc-extensions.ts`), `createGitFixture` (`code/testing/git-fixture.ts`).
- Produces: Contrats partagés › Démon et schéma.

- [x] **Step 1: Schéma (test rouge puis vert)**

`packages/schema/src/code.test.ts`, ajouter :
```ts
test("discardChanges, stageAll and unstageAll are code requests confined to relative paths", () => {
  const w = { projectId: "p1", worktree: "/repo" };
  expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: ["src/a.ts"] }).success).toBe(true);
  expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: [] }).success).toBe(false);
  expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: ["../x"] }).success).toBe(false);
  expect(CodeRequest.safeParse({ method: "stageAll", ...w }).success).toBe(true);
  expect(CodeRequest.safeParse({ method: "unstageAll", ...w }).success).toBe(true);
  expect(LOCAL_ONLY_CODE_METHODS).toEqual(["discardChanges", "stageAll", "unstageAll", "openInEditor"]);
});
```
`packages/schema/src/code.ts` : dans `CodeRequest`, après `unstageFiles` :
```ts
  z.object({ method: z.literal("discardChanges"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({ method: z.literal("stageAll"), ...W }),
  z.object({ method: z.literal("unstageAll"), ...W }),
```
dans `CodeResult` : `discardChanges: null; stageAll: null; unstageAll: null;` et, après `CodeResult` :
```ts
export const LOCAL_ONLY_CODE_METHODS = ["discardChanges", "stageAll", "unstageAll", "openInEditor"] as const satisfies readonly CodeRequest["method"][];
```

Run: `bun test packages/schema/src/code.test.ts` — Expected: PASS.

- [x] **Step 2: Tests des opérations git (rouges)**

`packages/daemon/src/code/index-ops.test.ts`, ajouter (mêmes `fx`, `h`, `areas`, `lines` que le fichier) :
```ts
import { discardChanges, stageAll, unstageAll } from "./index-ops";
import { existsSync } from "node:fs";

test("discarding restores a modified, a deleted and a staged file to HEAD", async () => {
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  fx.write("src/staged.ts", "s\n");
  await stageFiles(h, ["src/staged.ts"]);
  await discardChanges(h, ["src/ticket.ts", "src/legacy.ts", "src/staged.ts"]);
  expect(await areas()).toEqual([]);
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe(lines(40));
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toBe("old\n");
  expect(existsSync(join(fx.repo, "src/staged.ts"))).toBe(false);
});

test("discarding an untracked file deletes it and leaves the others alone", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/keep.ts", "k\n");
  await discardChanges(h, ["src/new.ts"]);
  expect(existsSync(join(fx.repo, "src/new.ts"))).toBe(false);
  expect(await areas()).toEqual(["unstaged:untracked:src/keep.ts"]);
});

test("discarding a staged rename restores the source and removes the target", async () => {
  fx.git("mv", "src/legacy.ts", "src/renamed.ts");
  expect(await areas()).toEqual(["staged:renamed:src/renamed.ts"]);
  await discardChanges(h, ["src/renamed.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual([]);
  expect(existsSync(join(fx.repo, "src/renamed.ts"))).toBe(false);
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toBe("old\n");
});

test("discarding refuses paths outside the worktree before touching anything", async () => {
  fx.write("src/new.ts", "n\n");
  await expect(discardChanges(h, ["src/new.ts", "../outside.ts"])).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  expect(existsSync(join(fx.repo, "src/new.ts"))).toBe(true);
});

test("discarding refuses during an operation and on a conflicted file", async () => {
  fx.git("checkout", "-q", "-b", "other");
  fx.commit("feat: other", { "src/legacy.ts": "theirs\n" });
  fx.git("checkout", "-q", "main");
  fx.commit("feat: main", { "src/legacy.ts": "ours\n" });
  const merge = Bun.spawnSync(["git", "merge", "other"], { cwd: fx.repo, env: { ...process.env, ...fx.env } });
  expect(merge.exitCode).not.toBe(0);
  await expect(discardChanges(h, ["src/legacy.ts"])).rejects.toMatchObject({ code: "GIT_BUSY" });
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toContain("<<<<<<<");
});

test("stageAll indexes every change and unstageAll empties the index without touching files", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  await stageAll(h);
  expect((await areas()).every((a) => a.startsWith("staged:"))).toBe(true);
  await unstageAll(h);
  expect((await areas()).every((a) => a.startsWith("unstaged:"))).toBe(true);
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe(`${lines(40)}more\n`);
});

test("unstageAll works before the first commit", async () => {
  const empty = createGitFixture({ remote: false });
  try {
    empty.write("a.txt", "a\n");
    const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
    await stageAll(eh);
    await unstageAll(eh);
    expect((await readStatus(eh)).files.map((f) => f.area)).toEqual(["unstaged"]);
  } finally {
    empty.cleanup();
  }
});
```
(Le test « refuses during an operation » utilise `git merge` plutôt qu'un rebase : `currentOperation` reconnaît `MERGE_HEAD` ; vérifier dans `code/read.ts:41-49` que `merge` est bien détecté, c'est le cas via `MERGE_HEAD`.)

Run: `bun test packages/daemon/src/code/index-ops.test.ts` — Expected: FAIL (`discardChanges` introuvable).

- [x] **Step 3: Implémenter les opérations**

`packages/daemon/src/code/index-ops.ts`, ajouter (imports : `currentOperation`, `hasHead`, `readStatus` depuis `./read`) :
```ts
async function inHead(h: WorktreeHandle, paths: string[]): Promise<Set<string>> {
  if (!(await hasHead(h))) return new Set();
  const out = await h.git.ok(["ls-tree", "--name-only", "-z", "HEAD", "--", ...paths]);
  return new Set(out.split("\0").filter((p) => p.length > 0));
}

async function assertDiscardable(h: WorktreeHandle, paths: string[]): Promise<void> {
  if ((await currentOperation(h)) !== null)
    throw new KiboError("GIT_BUSY", "finish or abort the current operation before discarding changes");
  const status = await readStatus(h);
  const conflicted = status.files.find((f) => f.kind === "conflicted" && paths.includes(f.path));
  if (conflicted) throw new KiboError("INVALID_INPUT", `${conflicted.path} is conflicted: resolve it first`);
}

export async function discardChanges(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  await assertDiscardable(h, paths);
  const tracked = await inHead(h, paths);
  const restore = paths.filter((p) => tracked.has(p));
  const remove = paths.filter((p) => !tracked.has(p));
  if (restore.length > 0) await h.git.ok(["restore", "--staged", "--worktree", "--source=HEAD", "--", ...restore]);
  if (remove.length > 0) {
    await h.git.ok(["rm", "--cached", "-q", "--ignore-unmatch", "--", ...remove]);
    await h.git.ok(["clean", "-f", "-q", "--", ...remove]);
  }
}

export async function stageAll(h: WorktreeHandle): Promise<void> {
  await h.git.ok(["add", "-A"]);
}

export async function unstageAll(h: WorktreeHandle): Promise<void> {
  if (await hasHead(h)) await h.git.ok(["reset", "-q"]);
  else await h.git.ok(["rm", "--cached", "-r", "-q", "--", "."]);
}
```
Note pour l'implémenteur : `git rm --cached` sur un chemin qui est un dossier de fichiers non suivis échoue-t-il ? Non avec `--ignore-unmatch` ; `git clean -f -- <fichier>` ne supprime qu'un fichier non suivi (jamais un dossier sans `-d`, jamais un fichier ignoré sans `-x`). Un chemin renommé : le client envoie `path` **et** `origPath` (comme `unstageFiles`), donc `src/legacy.ts` est restauré et `src/renamed.ts` supprimé.

Run: `bun test packages/daemon/src/code/index-ops.test.ts` — Expected: PASS.

- [x] **Step 4: Service : contexte de session et branchement (tests rouges puis verts)**

`packages/daemon/src/rpc-extensions.ts`, ajouter :
```ts
export const LOCAL_CONTEXT: RpcContext = { sessionHash: "local", remote: false };
```

`packages/daemon/src/code/code-service.test.ts`, ajouter (`LOCAL_CONTEXT` importé de `../rpc-extensions`, `REMOTE = { sessionHash: "remote", remote: true }`) :
```ts
test("discardChanges, stageAll, unstageAll and openInEditor are refused from a remote session", async () => {
  const c = start();
  fx.write("README.md", "# changed\n");
  for (const req of [
    { method: "discardChanges" as const, ...w(), paths: ["README.md"] },
    { method: "stageAll" as const, ...w() },
    { method: "unstageAll" as const, ...w() },
    { method: "openInEditor" as const, ...w(), path: "README.md", line: null },
  ]) {
    await expect(c.handle(req, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  expect(readFileSync(join(fx.repo, "README.md"), "utf8")).toBe("# changed\n");
  expect(events).toEqual([]);
});

test("discardChanges runs locally, serialised, and emits a code event", async () => {
  const c = start();
  fx.write("README.md", "# changed\n");
  expect(await c.handle({ method: "discardChanges", ...w(), paths: ["README.md"] }, LOCAL_CONTEXT)).toBeNull();
  expect(readFileSync(join(fx.repo, "README.md"), "utf8")).toBe("# kibo\n");
  expect(events).toEqual([event()]);
});

test("stageAll then unstageAll round-trip through the service", async () => {
  const c = start();
  fx.write("new.txt", "n\n");
  await c.handle({ method: "stageAll", ...w() }, LOCAL_CONTEXT);
  expect(((await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT)) as RepoStatus).files[0]?.area).toBe("staged");
  await c.handle({ method: "unstageAll", ...w() }, LOCAL_CONTEXT);
  expect(((await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT)) as RepoStatus).files[0]?.area).toBe("unstaged");
});
```
Tous les appels existants `c.handle(req)` du fichier reçoivent `, LOCAL_CONTEXT` (remplacement mécanique ; aucune attente ne change).

`packages/daemon/src/code/code-service.ts` :
- `MUTATION_METHODS` gagne `"discardChanges", "stageAll", "unstageAll"` ;
- `mutate` gagne
```ts
      case "discardChanges":
        return discardChanges(h, req.paths).then(() => null);
      case "stageAll":
        return stageAll(h).then(() => null);
      case "unstageAll":
        return unstageAll(h).then(() => null);
```
- `handle` devient :
```ts
    async handle(req, ctx) {
      if (LOCAL_ONLY.has(req.method)) requireLocal(ctx);
      if (req.method === "worktrees") return (await repoOf(req.projectId)).worktrees();
      const h = await (await repoOf(req.projectId)).open(req.worktree);
      return isMutation(req) ? mutateAndNotify(h, req) : read(h, req);
    },
```
avec `const LOCAL_ONLY = new Set<string>(LOCAL_ONLY_CODE_METHODS);` et le type `CodeService.handle(req: CodeRequest, ctx: RpcContext): Promise<unknown>`.

`packages/daemon/src/server.ts:139` : `return respond(() => code.handle(parsed.data, ctx), redact);`.

Run: `bun test packages/daemon/src/code/code-service.test.ts packages/daemon/src/server-code.test.ts` — Expected: PASS (`server-code.test.ts` passe sans changement : ses sessions sont locales).

- [x] **Step 5: Test HTTP du refus distant**

Regarder comment `packages/daemon/src/remote/*.test.ts` fabrique une session distante (`startServer` avec `remote` ou `ListenInfo.remote`) ; si un helper existe (`remoteServer`, `pairRemote`), ajouter dans `server-code.test.ts` :
```ts
test("openInEditor over the remote listener answers 403", async () => {
  // même montage que le test distant du dossier remote/, puis :
  const res = await send(remoteUrl, { method: "openInEditor", projectId, worktree: fx.repo, path: "README.md", line: null }, { cookie });
  expect(res.status).toBe(403);
});
```
S'il n'existe aucun helper, ne pas en construire : le test de service (Step 4) couvre le refus et `server.ts` n'a qu'un argument de plus (revue par `kibo-lead`).

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/schema packages/daemon/src/code packages/daemon/src/server-code.test.ts`
Expected: PASS.

```bash
git add packages/schema/src/code.ts packages/schema/src/code.test.ts
git commit -m "feat(schema): requêtes discardChanges et (dés)indexer tout"
git add packages/daemon/src/code/index-ops.ts packages/daemon/src/code/index-ops.test.ts
git commit -m "feat(daemon): annuler les changements d'un fichier"
git add packages/daemon/src/code/code-service.ts packages/daemon/src/code/code-service.test.ts packages/daemon/src/rpc-extensions.ts packages/daemon/src/server.ts packages/daemon/src/server-code.test.ts
git commit -m "feat(daemon): actions git réservées à la machine"
```

---

### Task 4: Coque : menu macOS explicite, fenêtre, capacité IPC

Vague 0. Spec §12.5 et spec I §3.7. La coque reste « Rust minimal » : un module `menu.rs` **en données** (testable sans fenêtre), deux plugins, trois lignes de plus dans la capacité accordée à l'origine du démon. Relue par `kibo-lead` (capacité IPC, menu natif). Le seul comportement observable à l'œil (menu, taille minimale, fenêtre mémorisée) se vérifie à la main sur macOS ; ce qui se teste par `cargo test` : les accélérateurs du menu ne volent aucun raccourci de la webview, la capacité ne porte que l'origine du démon.

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml` (+ `tauri-plugin-opener = "2"`, `tauri-plugin-window-state = "2"`), `apps/desktop/src-tauri/Cargo.lock` (régénéré, commité)
- Create: `apps/desktop/src-tauri/src/menu.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs` (`daemon_capability`, `OpenUrlScope`, `MIN_WINDOW`, plugins, menu sur macOS, `restore_state`)

**Interfaces:**
- Consumes: `tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, IsMenuItem}`, `tauri::ipc::CapabilityBuilder::permission_scoped`, `tauri_plugin_window_state::{StateFlags, WindowExt}`, `tauri_plugin_opener::init`.
- Produces: Contrats partagés › Coque ; permissions `core:window:allow-set-title` et `opener:allow-open-url` (`https://**`) consommées par T13.

- [x] **Step 1: Dépendances Rust et verrou**

`apps/desktop/src-tauri/Cargo.toml`, section `[dependencies]`, après `tauri-plugin-process = "2"` :
```toml
tauri-plugin-opener = "2"
tauri-plugin-window-state = "2"
```
Régénérer le verrou sans compiler (le `build.rs` de `tauri-build` exigerait les binaires du sidecar) :

Run: `~/.cargo/bin/cargo metadata --manifest-path apps/desktop/src-tauri/Cargo.toml --format-version 1 > /dev/null && git -C . diff --stat apps/desktop/src-tauri/Cargo.lock`
Expected: `Cargo.lock` modifié (ajout de `tauri-plugin-opener`, `tauri-plugin-window-state` et de leurs dépendances, dont `open` et `glob`), aucune autre ligne supprimée.

- [x] **Step 2: Test du menu (rouge)**

Créer `apps/desktop/src-tauri/src/menu.rs` avec le seul bloc de tests (le module n'existe pas encore : compilation rouge) :
```rust
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_leaves_tab_shortcuts_to_the_webview() {
        for accelerator in accelerators(MENU) {
            assert!(
                !RESERVED_FOR_WEBVIEW.contains(&accelerator),
                "{accelerator} belongs to the webview"
            );
        }
    }

    #[test]
    fn closing_the_window_takes_shift() {
        assert_eq!(accelerators(MENU), vec!["CmdOrCtrl+Shift+W"]);
    }

    #[test]
    fn menu_has_the_three_macos_submenus() {
        let titles: Vec<&str> = MENU.iter().map(|(title, _)| *title).collect();
        assert_eq!(titles, vec!["Kibo", "Édition", "Fenêtre"]);
    }
}
```
Déclarer le module dans `main.rs`, sous les `use` : `mod menu;`.

Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml menu` (pré-requis locaux : `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts`, `bun apps/desktop/scripts/build-toolchain.ts`, une seule fois)
Expected: FAIL, `cannot find value MENU`.

- [x] **Step 3: Le menu en données, puis sa construction sur macOS**

`apps/desktop/src-tauri/src/menu.rs`, au-dessus des tests :
```rust
pub const RESERVED_FOR_WEBVIEW: &[&str] = &[
    "CmdOrCtrl+W",
    "CmdOrCtrl+T",
    "CmdOrCtrl+K",
    "CmdOrCtrl+Shift+P",
    "CmdOrCtrl+1",
    "CmdOrCtrl+2",
    "CmdOrCtrl+3",
    "CmdOrCtrl+4",
    "CmdOrCtrl+5",
    "CmdOrCtrl+6",
    "CmdOrCtrl+7",
    "CmdOrCtrl+8",
    "CmdOrCtrl+9",
];

pub const CLOSE_WINDOW: &str = "close-window";

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Predefined {
    About,
    Services,
    Hide,
    HideOthers,
    ShowAll,
    Quit,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    Minimize,
    Maximize,
    Fullscreen,
}

impl Predefined {
    pub fn label(self) -> &'static str {
        match self {
            Predefined::About => "À propos de Kibo",
            Predefined::Services => "Services",
            Predefined::Hide => "Masquer Kibo",
            Predefined::HideOthers => "Masquer les autres",
            Predefined::ShowAll => "Tout afficher",
            Predefined::Quit => "Quitter Kibo",
            Predefined::Undo => "Annuler",
            Predefined::Redo => "Rétablir",
            Predefined::Cut => "Couper",
            Predefined::Copy => "Copier",
            Predefined::Paste => "Coller",
            Predefined::SelectAll => "Tout sélectionner",
            Predefined::Minimize => "Réduire",
            Predefined::Maximize => "Agrandir",
            Predefined::Fullscreen => "Plein écran",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Entry {
    Predefined(Predefined),
    Custom {
        id: &'static str,
        text: &'static str,
        accelerator: Option<&'static str>,
    },
    Separator,
}

pub const MENU: &[(&str, &[Entry])] = &[
    (
        "Kibo",
        &[
            Entry::Predefined(Predefined::About),
            Entry::Separator,
            Entry::Predefined(Predefined::Services),
            Entry::Separator,
            Entry::Predefined(Predefined::Hide),
            Entry::Predefined(Predefined::HideOthers),
            Entry::Predefined(Predefined::ShowAll),
            Entry::Separator,
            Entry::Predefined(Predefined::Quit),
        ],
    ),
    (
        "Édition",
        &[
            Entry::Predefined(Predefined::Undo),
            Entry::Predefined(Predefined::Redo),
            Entry::Separator,
            Entry::Predefined(Predefined::Cut),
            Entry::Predefined(Predefined::Copy),
            Entry::Predefined(Predefined::Paste),
            Entry::Predefined(Predefined::SelectAll),
        ],
    ),
    (
        "Fenêtre",
        &[
            Entry::Predefined(Predefined::Minimize),
            Entry::Predefined(Predefined::Maximize),
            Entry::Predefined(Predefined::Fullscreen),
            Entry::Separator,
            Entry::Custom {
                id: CLOSE_WINDOW,
                text: "Fermer la fenêtre",
                accelerator: Some("CmdOrCtrl+Shift+W"),
            },
        ],
    ),
];

pub fn accelerators(menu: &[(&str, &[Entry])]) -> Vec<&'static str> {
    menu.iter()
        .flat_map(|(_, entries)| entries.iter())
        .filter_map(|entry| match entry {
            Entry::Custom { accelerator, .. } => *accelerator,
            _ => None,
        })
        .collect()
}

#[cfg(target_os = "macos")]
mod native {
    use super::{Entry, Predefined, CLOSE_WINDOW, MENU};
    use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::{AppHandle, Manager, Wry};

    fn predefined(app: &AppHandle, item: Predefined) -> tauri::Result<PredefinedMenuItem<Wry>> {
        let text = Some(item.label());
        match item {
            Predefined::About => PredefinedMenuItem::about(app, text, None),
            Predefined::Services => PredefinedMenuItem::services(app, text),
            Predefined::Hide => PredefinedMenuItem::hide(app, text),
            Predefined::HideOthers => PredefinedMenuItem::hide_others(app, text),
            Predefined::ShowAll => PredefinedMenuItem::show_all(app, text),
            Predefined::Quit => PredefinedMenuItem::quit(app, text),
            Predefined::Undo => PredefinedMenuItem::undo(app, text),
            Predefined::Redo => PredefinedMenuItem::redo(app, text),
            Predefined::Cut => PredefinedMenuItem::cut(app, text),
            Predefined::Copy => PredefinedMenuItem::copy(app, text),
            Predefined::Paste => PredefinedMenuItem::paste(app, text),
            Predefined::SelectAll => PredefinedMenuItem::select_all(app, text),
            Predefined::Minimize => PredefinedMenuItem::minimize(app, text),
            Predefined::Maximize => PredefinedMenuItem::maximize(app, text),
            Predefined::Fullscreen => PredefinedMenuItem::fullscreen(app, text),
        }
    }

    fn item(app: &AppHandle, entry: &Entry) -> tauri::Result<Box<dyn IsMenuItem<Wry>>> {
        Ok(match entry {
            Entry::Predefined(p) => Box::new(predefined(app, *p)?),
            Entry::Separator => Box::new(PredefinedMenuItem::separator(app)?),
            Entry::Custom { id, text, accelerator } => {
                Box::new(MenuItem::with_id(app, *id, *text, true, *accelerator)?)
            }
        })
    }

    pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
        let menu = Menu::new(app)?;
        for (title, entries) in MENU {
            let items = entries
                .iter()
                .map(|e| item(app, e))
                .collect::<tauri::Result<Vec<_>>>()?;
            let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i.as_ref()).collect();
            menu.append(&Submenu::with_items(app, *title, true, &refs)?)?;
        }
        Ok(menu)
    }

    pub fn on_event(app: &AppHandle, id: &str) {
        if id != CLOSE_WINDOW {
            return;
        }
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if let Err(e) = window.close() {
            eprintln!("[kibo] cannot close the main window: {e}");
        }
    }
}

#[cfg(target_os = "macos")]
pub use native::{build, on_event};
```
Aucun `Predefined::CloseWindow` : l'énumération ne le permet pas, c'est ce qui garantit que `⌘W` n'est jamais pris par le menu natif (spec §12.5). `Menu::new` puis `append` évite de construire un tableau de `&dyn` de taille variable pour la racine.

Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml menu`
Expected: PASS, 3 tests.

- [x] **Step 4: Capacité, plugins, fenêtre (test rouge puis vert)**

`apps/desktop/src-tauri/src/main.rs`, remplacer le test `grants_the_updater_to_the_daemon_origin_only` par :
```rust
    #[test]
    fn grants_the_daemon_origin_only() {
        let url: Url = "http://127.0.0.1:4317/?token=abc#/settings".parse().unwrap();
        assert_eq!(ipc_origin(&url), "http://127.0.0.1:4317");
    }

    #[test]
    fn opener_scope_is_https_only() {
        let scope = serde_json::to_value(OpenUrlScope::https()).unwrap();
        assert_eq!(scope, serde_json::json!({ "url": "https://**" }));
    }

    #[test]
    fn window_is_never_smaller_than_the_layout() {
        assert_eq!(MIN_WINDOW, (960.0, 600.0));
    }
```
Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — Expected: FAIL (`OpenUrlScope`, `MIN_WINDOW` introuvables).

Puis, dans `main.rs` :
- `use serde::{Deserialize, Serialize};` ; `use tauri_plugin_window_state::{StateFlags, WindowExt};`
- remplacer `updater_capability` par :
```rust
const MIN_WINDOW: (f64, f64) = (960.0, 600.0);
const WINDOW_STATE: StateFlags = StateFlags::SIZE.union(StateFlags::POSITION).union(StateFlags::MAXIMIZED);

#[derive(Serialize)]
struct OpenUrlScope {
    url: String,
}

impl OpenUrlScope {
    fn https() -> Self {
        Self { url: "https://**".into() }
    }
}

fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder {
    CapabilityBuilder::new("daemon")
        .window("main")
        .local(false)
        .remote(ipc_origin(daemon_url))
        .permission("updater:default")
        .permission("process:allow-restart")
        .permission("core:app:allow-version")
        .permission("core:window:allow-set-title")
        .permission_scoped("opener:allow-open-url", vec![OpenUrlScope::https()], Vec::<OpenUrlScope>::new())
}
```
- dans `main()`, la chaîne de plugins devient :
```rust
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::new().with_state_flags(WINDOW_STATE).build());
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(menu::build)
        .on_menu_event(|app, event| menu::on_event(app, event.id().as_ref()));
    let app = builder
        .setup(|app| {
```
(le reste de `setup` inchangé jusqu'à la fenêtre)
- la création de la fenêtre devient :
```rust
                            handle
                                .add_capability(daemon_capability(&url))
                                .expect("cannot grant the daemon origin its capability");
                            let window = WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url))
                                .title("Kibo")
                                .inner_size(1440.0, 900.0)
                                .min_inner_size(MIN_WINDOW.0, MIN_WINDOW.1)
                                .build()
                                .expect("cannot open the main window");
                            if let Err(e) = window.restore_state(WINDOW_STATE) {
                                eprintln!("[kibo] window state not restored: {e}");
                            }
```
Le plugin restaure aussi l'état au `on_window_ready` et l'enregistre à la fermeture dans le dossier de configuration de l'app (`.window-state.json`) ; l'appel explicite est idempotent et garantit la restauration même si la fenêtre est créée après le démarrage, comme ici. Le fichier d'état ne touche pas au CRDT.

Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS, 9 tests (6 dans `main.rs`, 3 dans `menu.rs`), aucun avertissement `dead_code`.

- [x] **Step 5: Vérification à la main (macOS) et smoke**

Run: `bun run --cwd apps/desktop build:debug && KIBO_SMOKE=1 KIBO_HOME=$(mktemp -d) apps/desktop/src-tauri/target/debug/kibo; echo "exit=$?"`
Expected: `exit=0`, aucun `kibo-daemon` restant (`pgrep -f kibo-daemon` vide).

Puis sans `KIBO_SMOKE` : la barre de menu affiche Kibo / Édition / Fenêtre ; `⌘W` ferme l'onglet Kibo actif (pas la fenêtre), `⌘⇧W` ferme la fenêtre ; la fenêtre refuse de descendre sous 960 × 600 ; après redimensionnement, déplacement et relance, elle revient à la même place. Noter le résultat dans le rapport de la tâche.

- [x] **Step 6: Commits**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock
git commit -m "build(desktop): plugins opener et window-state"
git add apps/desktop/src-tauri/src/main.rs apps/desktop/src-tauri/src/menu.rs
git commit -m "feat(desktop): menu macOS, fenêtre et capacité"
```

### Task 5: Logo piste 5, icône, favicon

Vague 0. Spec §12.5 (logo) et spec générale §8 (système visuel). Une **seule géométrie** en TypeScript (`kibo-mark.ts`, port de `S.kanbanLogo` de `design/penpot/scripts/01-core.js:22-26`) nourrit `KiboLogo`, `apps/desktop/app-icon.svg` et `packages/ui/public/favicon.svg` ; un test refuse toute divergence entre les fichiers commités et le générateur. `WorkspaceMark.tsx` (tuile d'espace de travail, déjà en piste 5) ne change pas. La page Penpot `05 · Logo` ne change pas non plus : le logo dessiné est la source, le code s'y conforme.

**Files:**
- Create: `packages/ui/src/shell/kibo-mark.ts`, `packages/ui/src/shell/kibo-mark.test.ts`
- Modify: `packages/ui/src/shell/KiboLogo.tsx` (même géométrie ; `pairing-screen.test.tsx` inchangé)
- Create: `packages/ui/scripts/app-icon.ts`, `packages/ui/scripts/app-icon.test.ts` ; Modify: `packages/ui/scripts/tsconfig.json` (référence au projet `packages/ui`)
- Create: `packages/ui/public/favicon.svg` ; Modify: `packages/ui/index.html`, `apps/desktop/app-icon.svg`, `apps/desktop/src-tauri/icons/*` (six fichiers régénérés)

**Interfaces:**
- Produces: `kiboMarkSvg(mode: "dark" | "light" | "auto", size: number): string` ; `KIBO_MARK` (géométrie : tuile et cinq cartes, unités sur 100) ; `KiboLogo` inchangé en props (`className`, `decorative`).
- Consumes: rien de nouveau.

- [x] **Step 1: Test de la géométrie (rouge)**

`packages/ui/src/shell/kibo-mark.test.ts` :
```ts
import { expect, test } from "bun:test";
import { KIBO_MARK, kiboMarkSvg } from "./kibo-mark";

const PENPOT_DARK_100 =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none">' +
  '<rect x="2" y="2" width="96" height="96" rx="24" fill="#18181B" stroke="#27272A" stroke-width="2"/>' +
  '<rect x="22" y="24" width="16" height="22" rx="4" fill="#FAFAFA" opacity="1"/>' +
  '<rect x="22" y="52" width="16" height="16" rx="4" fill="#FAFAFA" opacity="0.45"/>' +
  '<rect x="42" y="24" width="16" height="16" rx="4" fill="#FAFAFA" opacity="1"/>' +
  '<rect x="42" y="46" width="16" height="30" rx="4" fill="#F97316" opacity="1"/>' +
  '<rect x="62" y="24" width="16" height="12" rx="4" fill="#FAFAFA" opacity="0.45"/>' +
  "</svg>";

test("the dark mark at 100 is byte for byte the Penpot kanbanLogo", () => {
  expect(kiboMarkSvg("dark", 100)).toBe(PENPOT_DARK_100);
});

test("the light mark swaps only the palette", () => {
  const light = kiboMarkSvg("light", 100);
  expect(light).toBe(
    PENPOT_DARK_100.replaceAll("#18181B", "#FFFFFF").replaceAll("#27272A", "#E4E4E7").replaceAll("#FAFAFA", "#09090B"),
  );
});

test("the mark scales with two decimals like the Penpot script", () => {
  const svg = kiboMarkSvg("light", 1024);
  expect(svg).toContain('width="1024" height="1024" viewBox="0 0 1024 1024"');
  expect(svg).toContain('<rect x="20.48" y="20.48" width="983.04" height="983.04" rx="245.76"');
  expect(svg).toContain('stroke-width="20.48"');
  expect(svg).toContain('<rect x="430.08" y="471.04" width="163.84" height="307.2" rx="40.96" fill="#F97316"');
});

test("the auto mark is light by default and follows the dark scheme by CSS", () => {
  const svg = kiboMarkSvg("auto", 64);
  expect(svg).toContain('<rect class="tile" x="1.28" y="1.28" width="61.44" height="61.44" rx="15.36" fill="#FFFFFF" stroke="#E4E4E7"');
  expect(svg).toContain('<rect class="ink" x="14.08" y="15.36"');
  expect(svg).toContain("@media (prefers-color-scheme: dark)");
  expect(svg).toContain(".tile{fill:#18181B;stroke:#27272A}");
  expect(svg).toContain(".ink{fill:#FAFAFA}");
  expect(svg.indexOf("<style>")).toBeLessThan(svg.indexOf("<rect"));
});

test("the geometry has one tile, four ink cards and one brand card", () => {
  expect(KIBO_MARK.tile).toEqual({ x: 2, y: 2, size: 96, radius: 24, stroke: 2 });
  expect(KIBO_MARK.cards).toHaveLength(5);
  expect(KIBO_MARK.cards.filter((c) => c.fill === "brand")).toEqual([{ x: 42, y: 46, w: 16, h: 30, fill: "brand", opacity: 1 }]);
});
```
(`Number((30 * 10.24).toFixed(2))` vaut `307.2`, sans zéro final : le port suit la même conversion que `n()` dans le script Penpot.)

Run: `bun test packages/ui/src/shell/kibo-mark.test.ts`
Expected: FAIL (module introuvable).

- [x] **Step 2: La géométrie et le générateur SVG**

`packages/ui/src/shell/kibo-mark.ts` :
```ts
export type MarkMode = "dark" | "light" | "auto";
export type MarkCard = { x: number; y: number; w: number; h: number; fill: "ink" | "brand"; opacity: number };

export const BRAND = "#F97316";
export const CARD_RADIUS = 4;

const CARDS: readonly MarkCard[] = [
  { x: 22, y: 24, w: 16, h: 22, fill: "ink", opacity: 1 },
  { x: 22, y: 52, w: 16, h: 16, fill: "ink", opacity: 0.45 },
  { x: 42, y: 24, w: 16, h: 16, fill: "ink", opacity: 1 },
  { x: 42, y: 46, w: 16, h: 30, fill: "brand", opacity: 1 },
  { x: 62, y: 24, w: 16, h: 12, fill: "ink", opacity: 0.45 },
];

export const KIBO_MARK = {
  tile: { x: 2, y: 2, size: 96, radius: 24, stroke: 2 },
  cards: CARDS,
};

type Palette = { ink: string; base: string; edge: string };
const DARK: Palette = { ink: "#FAFAFA", base: "#18181B", edge: "#27272A" };
const LIGHT: Palette = { ink: "#09090B", base: "#FFFFFF", edge: "#E4E4E7" };

const DARK_SCHEME_STYLE = `<style>@media (prefers-color-scheme: dark){.tile{fill:${DARK.base};stroke:${DARK.edge}}.ink{fill:${DARK.ink}}}</style>`;

export function kiboMarkSvg(mode: MarkMode, size: number): string {
  const unit = size / 100;
  const n = (v: number) => Number((v * unit).toFixed(2));
  const palette = mode === "dark" ? DARK : LIGHT;
  const classed = mode === "auto";
  const cls = (name: string) => (classed ? `class="${name}" ` : "");
  const { tile, cards } = KIBO_MARK;
  const tileSvg =
    `<rect ${cls("tile")}x="${n(tile.x)}" y="${n(tile.y)}" width="${n(tile.size)}" height="${n(tile.size)}" rx="${n(tile.radius)}" ` +
    `fill="${palette.base}" stroke="${palette.edge}" stroke-width="${Math.max(1, n(tile.stroke))}"/>`;
  const cardSvg = cards
    .map((c) => {
      const fill = c.fill === "brand" ? BRAND : palette.ink;
      const klass = c.fill === "brand" ? "" : cls("ink");
      return `<rect ${klass}x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}" rx="${n(CARD_RADIUS)}" fill="${fill}" opacity="${c.opacity}"/>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">` +
    (classed ? DARK_SCHEME_STYLE : "") +
    tileSvg +
    cardSvg +
    "</svg>"
  );
}
```
Attention à la sortie « mot pour mot » : en mode `dark` / `light`, `cls()` renvoie `""`, donc `<rect x=…` sans double espace ; le premier test l'impose.

Run: `bun test packages/ui/src/shell/kibo-mark.test.ts`
Expected: PASS, 5 tests.

- [x] **Step 3: `KiboLogo` sur la même géométrie (test rouge puis vert)**

Créer `packages/ui/src/shell/kibo-logo.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { KiboLogo } from "./KiboLogo";
import { KIBO_MARK } from "./kibo-mark";

test("the logo draws the tile and the five cards of the mark", () => {
  render(<KiboLogo className="size-14" />);
  const svg = screen.getByRole("img", { name: "Kibo" });
  expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
  const rects = [...svg.querySelectorAll("rect")];
  expect(rects).toHaveLength(1 + KIBO_MARK.cards.length);
  expect(rects[0]?.getAttribute("class")).toContain("fill-card");
  expect(rects.filter((r) => r.getAttribute("fill") === "#F97316")).toHaveLength(1);
  expect(rects.filter((r) => r.getAttribute("fill") === "currentColor")).toHaveLength(4);
});

test("a decorative logo is hidden from assistive tech", () => {
  render(<KiboLogo decorative />);
  expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});
```
Run: `bun test packages/ui/src/shell/kibo-logo.test.tsx` — Expected: FAIL (`viewBox` vaut `0 0 1024 1024`, 4 rects).

`packages/ui/src/shell/KiboLogo.tsx` devient :
```tsx
import { fr } from "../i18n/fr";
import { BRAND, CARD_RADIUS, KIBO_MARK } from "./kibo-mark";

export function KiboLogo({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  const { tile, cards } = KIBO_MARK;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden={decorative}
      aria-label={fr.app.name}
      fill="none"
    >
      <title>{fr.app.name}</title>
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.size}
        height={tile.size}
        rx={tile.radius}
        strokeWidth={tile.stroke}
        className="fill-card stroke-border text-foreground"
      />
      {cards.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={CARD_RADIUS}
          fill={c.fill === "brand" ? BRAND : "currentColor"}
          opacity={c.opacity}
          className="text-foreground"
        />
      ))}
    </svg>
  );
}
```
`fill-card` et `stroke-border` sont des utilitaires Tailwind v4 issus des tokens shadcn (`--color-card`, `--color-border`) : la tuile suit le thème sombre ou clair sans couleur codée ; seule l'orange de marque est littérale.

Run: `bun test packages/ui/src/shell/kibo-logo.test.tsx packages/ui/src/shell/pairing-screen.test.tsx`
Expected: PASS (les 6 tests d'appairage inchangés).

- [x] **Step 4: Générateur des fichiers et test de non-divergence (rouge puis vert)**

`packages/ui/scripts/tsconfig.json` : ajouter `"references": [{ "path": ".." }]` (le script importe `../src/shell/kibo-mark`, hors de son `rootDir` : la référence de projet fait résoudre l'import vers les déclarations de `packages/ui`, et `bun run typecheck` construit `packages/ui` avant `packages/ui/scripts`).

`packages/ui/scripts/app-icon.test.ts` :
```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { kiboMarkSvg } from "../src/shell/kibo-mark";
import { ICON_TARGETS } from "./app-icon";

const repo = resolve(import.meta.dir, "../../..");

test("the committed app icon and favicon are exactly what the generator writes", () => {
  for (const target of ICON_TARGETS) {
    expect(readFileSync(resolve(repo, target.path), "utf8")).toBe(`${kiboMarkSvg(target.mode, target.size)}\n`);
  }
});

test("the app icon is light at 1024 and the favicon follows the system scheme at 64", () => {
  expect(ICON_TARGETS).toEqual([
    { path: "apps/desktop/app-icon.svg", mode: "light", size: 1024 },
    { path: "packages/ui/public/favicon.svg", mode: "auto", size: 64 },
  ]);
});
```
Run: `bun test packages/ui/scripts/app-icon.test.ts` — Expected: FAIL (module `./app-icon` introuvable).

`packages/ui/scripts/app-icon.ts` :
```ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { kiboMarkSvg, type MarkMode } from "../src/shell/kibo-mark";

export type IconTarget = { path: string; mode: MarkMode; size: number };

export const ICON_TARGETS: readonly IconTarget[] = [
  { path: "apps/desktop/app-icon.svg", mode: "light", size: 1024 },
  { path: "packages/ui/public/favicon.svg", mode: "auto", size: 64 },
];

export function writeIcons(repoRoot: string): string[] {
  return ICON_TARGETS.map((target) => {
    const file = resolve(repoRoot, target.path);
    writeFileSync(file, `${kiboMarkSvg(target.mode, target.size)}\n`);
    return file;
  });
}

if (import.meta.main) {
  for (const file of writeIcons(resolve(import.meta.dir, "../../.."))) console.log(`written ${file}`);
}
```
Run: `mkdir -p packages/ui/public && bun packages/ui/scripts/app-icon.ts && bun test packages/ui/scripts/app-icon.test.ts`
Expected: deux lignes `written …`, puis PASS, 2 tests. `git status --short` montre `apps/desktop/app-icon.svg` modifié et `packages/ui/public/favicon.svg` nouveau.

- [x] **Step 5: Favicon dans la page et icônes de la coque**

`packages/ui/index.html`, dans `<head>` après `<meta name="viewport" …>` :
```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
Vite copie `public/` à la racine de `dist/` ; le démon sert tout fichier existant de `dist/` (`serveUi`, `packages/daemon/src/ui-route.ts`), donc `/favicon.svg` répond en `image/svg+xml` avec la CSP (`img-src 'self'`).

Icônes de la coque, régénérées depuis le SVG clair :

Run: `bun run --cwd apps/desktop tauri icon app-icon.svg && rm -rf apps/desktop/src-tauri/icons/android apps/desktop/src-tauri/icons/ios apps/desktop/src-tauri/icons/Square*.png apps/desktop/src-tauri/icons/StoreLogo.png && git status --short apps/desktop/src-tauri/icons`
Expected: exactement six fichiers modifiés (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`), aucun fichier nouveau (la CLI écrit aussi les formats Windows Store, Android et iOS, que `tauri.conf.json` ne référence pas : ils sont supprimés).

Vérification visuelle : ouvrir `apps/desktop/src-tauri/icons/128x128@2x.png` (tuile blanche à bord gris, quatre cartes noires dont deux à 45 %, une carte orange) et `packages/ui/public/favicon.svg` dans un navigateur en thème sombre puis clair.

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui/src/shell packages/ui/scripts && bun run budget`
Expected: PASS ; budget inchangé à ± 0,2 kB (la géométrie remplace quatre rectangles par six : `kibo-mark.ts` pèse moins de 1 kB gzip et reste dans l'entrée, comme `PairingScreen`).

```bash
git add packages/ui/src/shell/kibo-mark.ts packages/ui/src/shell/kibo-mark.test.ts packages/ui/src/shell/KiboLogo.tsx packages/ui/src/shell/kibo-logo.test.tsx packages/ui/scripts/app-icon.ts packages/ui/scripts/app-icon.test.ts packages/ui/scripts/tsconfig.json packages/ui/public/favicon.svg packages/ui/index.html apps/desktop/app-icon.svg
git commit -m "feat(ui): logo piste 5 et favicon"
git add apps/desktop/src-tauri/icons/32x32.png apps/desktop/src-tauri/icons/128x128.png apps/desktop/src-tauri/icons/128x128@2x.png apps/desktop/src-tauri/icons/icon.icns apps/desktop/src-tauri/icons/icon.ico apps/desktop/src-tauri/icons/icon.png
git commit -m "build(desktop): icônes régénérées"
```

### Task 6: Fiche ticket éditable

Vague 1 ← T2. Décision 4, écrans 98 et 99. La fiche (Sheet et onglet) devient éditable : titre en place, statut et assigné par sélecteurs, description par un éditeur, sous-tickets cliquables, menu « ⋯ ». Tout passe par `client.rpc({ method: "command", … })` avec les variantes `updateTicket`, `setStatus`, `deleteTicket` (colonne « Réel »). En lecture seule (`canEdit(project)` faux), rien n'est éditable et le menu ne porte pas « Supprimer… ». Le dossier `ticket/` est chargé avec `TicketDetail` (déjà à la demande) : il entre dans `FORBIDDEN_IN_ENTRY`.

**Précision de contrat (T6 possède ces fichiers, T14 en hérite) :** `TicketSheet`, `TicketTab` et `TicketDetail` reçoivent aussi `viewer: string` (l'UI n'a pas de hook de session ; `ShellDialogs` et `ContentView` l'ont déjà) pour l'option « Moi » du sélecteur d'assigné. `onDeleted` est un prop de `TicketSheet` (le menu « ⋯ » vit dans l'en-tête du Sheet et de l'onglet, pas dans `TicketDetail`) ; `TicketDetail` gagne `onOpenTicket` et `viewer` seulement.

**Files:**
- Create: `packages/ui/src/ticket/use-ticket-command.ts`, `TicketTitle.tsx`, `StatusSelect.tsx`, `AssigneeSelect.tsx`, `DescriptionEditor.tsx`, `TicketActionsMenu.tsx`, `ticket-edit.test.tsx`
- Create: `packages/ui/src/i18n/fr-ticket-edit.ts`
- Modify: `packages/ui/src/shell/TicketDetail.tsx`, `packages/ui/src/shell/TicketSheet.tsx`, `packages/ui/src/pages/TicketTab.tsx`, `packages/ui/src/shell/ShellDialogs.tsx`, `packages/ui/src/shell/ContentView.tsx`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/scripts/bundle-report.ts`
- Test (existants, attentes inchangées) : `packages/ui/src/shell/sheet/sheet-integrations.test.tsx` (ajouter `viewer="adam"`, `onOpenTicket={() => {}}`, `onDeleted={() => {}}` aux rendus), `packages/ui/src/shell/agents-shell.test.tsx`, `packages/ui/src/shell/presence.test.tsx`, `packages/ui/src/palette/palette.test.tsx` (si elles rendent `TicketSheet` directement, mêmes ajouts)

**Interfaces:**
- Consumes: `ConfirmDialog` (`shell/lazy-dialogs`, T2), `ReasonDialog` (`@kibo/sdk/ui/reason-dialog`, T2), `DropdownMenuEntries`, `MenuEntry` (`@kibo/sdk/ui/menu-entries`, T2), `canEdit` (`state/access`), `Select`, `Input`, `Textarea`, `Button`, `Tooltip` du SDK.
- Produces: `useTicketCommand` (réutilisé par T14), `frTicketEdit` (complété par T14 : `deps`), `TicketDetail` props `{ project, ticket, domains?, viewer, onOpenFile, onOpenTicket }`, `TicketSheet` props `+ viewer, onOpenTicket(ticketId), onDeleted()`, `TicketTab` props `+ viewer, onOpenTicket(ticketId)`, `ContentView` props `+ onOpenTicket(projectId, ticketId)`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr-ticket-edit.ts` (importé directement par `ticket/*`, jamais monté dans `fr.ts`) :
```ts
import type { KiboErrorCode } from "@kibo/schema";

const s = (n: number) => (n > 1 ? "s" : "");

export const frTicketEdit = {
  editTitle: "Modifier le titre",
  titleField: "Titre",
  titleHint: "Entrée pour enregistrer · Échap pour annuler",
  editDescription: "Modifier",
  descriptionField: "Description",
  descriptionPlaceholder: "Décris le ticket…",
  save: "Enregistrer",
  cancel: "Annuler",
  assignee: "Assigné",
  nobody: "Personne",
  me: "Moi",
  agentAssignee: "Choisis un profil via Assigner à un agent",
  actions: (key: string) => `Actions ${key}`,
  openInTab: "Ouvrir dans un onglet",
  copyKey: "Copier la clé",
  copied: "Clé copiée",
  copyFailed: "Impossible de copier la clé.",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${s(children)} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    confirm: "Bloquer",
    cancel: "Annuler",
  },
  errors: {
    INVALID_INPUT: "Le titre ne peut pas être vide.",
    BLOCKED_REASON_REQUIRED: "Un motif est requis pour bloquer un ticket.",
    FORBIDDEN: "Ce projet est en lecture seule.",
    NOT_FOUND: "Ce ticket n'existe plus.",
    TREE_CYCLE: "Un ticket ne peut pas devenir son propre sous-ticket.",
  } satisfies Partial<Record<KiboErrorCode, string>>,
  fallback: "Impossible d'enregistrer la modification.",
};
```

- [x] **Step 2: Tests (rouges)**

`packages/ui/src/ticket/ticket-edit.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type ProjectSnapshot, type RpcRequest, type TicketView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
      if (req.method === "getPresence") return [];
      return answer(req);
    },
    subscribe: () => () => undefined,
    subscribeEvents: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
  },
}));

const { TicketSheet } = await import("../shell/TicketSheet");

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "12@1",
  key: "KIB-12",
  pendingSeq: null,
  keyLabel: "KIB-12",
  title: "Schéma Loro des tickets",
  description: "Arbre LoroTree.",
  statusId: "in_progress",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 3, total: 5 },
  waitingOn: [],
  ...patch,
});
const child = (n: number, parentId: string): TicketView =>
  ticket({ id: `${n}@1`, key: `KIB-${n}`, keyLabel: `KIB-${n}`, title: `Sous-tâche ${n}`, parentId, progress: { done: 0, total: 0 } });
const project = (main: TicketView, access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [main, child(20, main.id), child(21, "20@1")],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sync: {
    shared: access !== "write",
    keyAllocator: "local",
    role: null,
    access,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
  },
});

const show = (main = ticket(), access: ProjectSnapshot["sync"]["access"] = "write") => {
  const onDeleted = mock(() => {});
  const onOpenTicket = mock((_id: string) => {});
  const onOpenInTab = mock(() => {});
  render(
    <TicketSheet
      project={project(main, access)}
      ticketId={main.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={onOpenInTab}
      onOpenFile={() => {}}
      onOpenTicket={onOpenTicket}
      onDeleted={onDeleted}
    />,
  );
  return { onDeleted, onOpenTicket, onOpenInTab, user: userEvent.setup() };
};
const command = (req: RpcRequest | undefined) => (req?.method === "command" ? req.command : null);

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
});

test("the title is edited in place and saved on Enter", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier le titre" }));
  const field = screen.getByRole("textbox", { name: "Titre" });
  expect(screen.getByText("Entrée pour enregistrer · Échap pour annuler")).toBeTruthy();
  await user.clear(field);
  await user.type(field, "Schéma Loro des tickets (LoroTree){Enter}");
  expect(command(calls.at(-1))).toEqual({
    method: "updateTicket",
    ticketId: "12@1",
    title: "Schéma Loro des tickets (LoroTree)",
  });
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Titre" })).toBeNull());
});

test("an empty title is refused by the daemon: the error shows, the field stays, Escape restores the old title", async () => {
  answer = () => {
    throw new KiboError("INVALID_INPUT", "ticket title is empty");
  };
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier le titre" }));
  const field = screen.getByRole("textbox", { name: "Titre" });
  await user.clear(field);
  await user.type(field, "   {Enter}");
  expect((await screen.findByRole("alert")).textContent).toBe("Le titre ne peut pas être vide.");
  expect(screen.getByRole("textbox", { name: "Titre" })).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Modifier le titre" }).textContent).toBe("Schéma Loro des tickets");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the status select sends setStatus, Bloqué asks for a reason first", async () => {
  const { user } = show();
  await user.click(screen.getByRole("combobox", { name: "Statut" }));
  await user.click(await screen.findByRole("option", { name: "En review" }));
  expect(command(calls.at(-1))).toEqual({ method: "setStatus", ticketId: "12@1", statusId: "in_review" });
  await user.click(screen.getByRole("combobox", { name: "Statut" }));
  await user.click(await screen.findByRole("option", { name: "Bloqué" }));
  const dialog = await screen.findByRole("dialog", { name: "Bloquer KIB-12" });
  expect(calls.filter((c) => command(c)?.method === "setStatus")).toHaveLength(1);
  await user.type(within(dialog).getByLabelText("Motif"), "Attente du client");
  await user.click(within(dialog).getByRole("button", { name: "Bloquer" }));
  expect(command(calls.at(-1))).toEqual({
    method: "setStatus",
    ticketId: "12@1",
    statusId: "blocked",
    reason: "Attente du client",
  });
});

test("the assignee select offers nobody, me and the members; an agent assignee is not editable here", async () => {
  const { user } = show();
  await user.click(screen.getByRole("combobox", { name: "Assigné" }));
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Personne", "Moi", "Léa"]);
  await user.click(screen.getByRole("option", { name: "Moi" }));
  expect(command(calls.at(-1))).toEqual({
    method: "updateTicket",
    ticketId: "12@1",
    assignee: { kind: "human", ref: "adam" },
  });
});

test("an agent assignee shows a disabled select with the hint", () => {
  show(ticket({ assignee: { kind: "agent", ref: "opus-dev-1" } }));
  const select = screen.getByRole("combobox", { name: "Assigné" });
  expect(select.getAttribute("data-disabled")).not.toBeNull();
  expect(select.textContent).toContain("opus-dev-1");
  expect(screen.getByText("Choisis un profil via Assigner à un agent")).toBeTruthy();
});

test("the description is edited in a textarea and saved", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const field = screen.getByRole("textbox", { name: "Description" });
  await user.clear(field);
  await user.type(field, "Nouveau texte");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(command(calls.at(-1))).toEqual({ method: "updateTicket", ticketId: "12@1", description: "Nouveau texte" });
});

test("sub-tickets open in the sheet", async () => {
  const { user, onOpenTicket } = show();
  await user.click(screen.getByRole("button", { name: /KIB-20/ }));
  expect(onOpenTicket).toHaveBeenCalledWith("20@1");
});

test("the menu opens in a tab, copies the key and deletes after confirmation", async () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t: string) => void written.push(t) },
  });
  answer = (req) => (command(req)?.method === "deleteTicket" ? ["12@1", "20@1", "21@1"] : null);
  const { user, onDeleted, onOpenInTab } = show();
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir dans un onglet",
    "Copier la clé",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Ouvrir dans un onglet" }));
  expect(onOpenInTab).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copier la clé" }));
  expect(written).toEqual(["KIB-12"]);
  expect((await screen.findByRole("status")).textContent).toBe("Clé copiée");
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Supprimer KIB-12 ?" });
  expect(dialog.textContent).toContain("Ses 2 sous-tickets et ses liens seront supprimés aussi. Cette action est irréversible.");
  await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));
  expect(command(calls.at(-1))).toEqual({ method: "deleteTicket", ticketId: "12@1" });
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
});

test("a read-only project shows the ticket without any editing control", async () => {
  const { user } = show(ticket(), "read-only");
  expect(screen.queryByRole("button", { name: "Modifier le titre" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Schéma Loro des tickets" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Statut" })).toBeNull();
  expect(screen.getByText("En cours")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Assigné" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions KIB-12" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir dans un onglet",
    "Copier la clé",
  ]);
});
```
Run: `bun test packages/ui/src/ticket/ticket-edit.test.tsx` — Expected: FAIL (props inconnus, boutons absents).

- [x] **Step 3: Le hook de commande**

`packages/ui/src/ticket/use-ticket-command.ts` :
```ts
import { KiboError, type ProjectCommand } from "@kibo/schema";
import { useCallback, useState } from "react";
import { client } from "../api";
import { frTicketEdit } from "../i18n/fr-ticket-edit";

export type TicketCommand = {
  run(command: ProjectCommand): Promise<boolean>;
  error: string | null;
  busy: boolean;
  clearError(): void;
};

export const describeTicketError = (e: unknown): string =>
  e instanceof KiboError ? (frTicketEdit.errors[e.code as keyof typeof frTicketEdit.errors] ?? frTicketEdit.fallback) : frTicketEdit.fallback;

export function useTicketCommand(
  projectId: string,
  describe: (error: unknown) => string = describeTicketError,
): TicketCommand {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (command: ProjectCommand) => {
      setBusy(true);
      setError(null);
      try {
        await client.rpc({ method: "command", projectId, command });
        return true;
      } catch (e) {
        setError(describe(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [projectId, describe],
  );
  const clearError = useCallback(() => setError(null), []);
  return { run, error, busy, clearError };
}
```
(`e.code as keyof typeof frTicketEdit.errors` : le `as` est justifié par la recherche dans un `Partial<Record<KiboErrorCode, string>>` ; l'alternative sans `as` est `(frTicketEdit.errors as Partial<Record<KiboErrorCode, string>>)[e.code]`, au choix de l'implémenteur, une seule des deux.)

- [x] **Step 4: Titre, statut, assigné, description**

`packages/ui/src/ticket/TicketTitle.tsx` :
```tsx
import { Input } from "@kibo/sdk/ui/input";
import { type KeyboardEvent, useState } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";

type Props = {
  title: string;
  editable: boolean;
  error: string | null;
  onSave(title: string): Promise<boolean>;
  onCancel(): void;
  className?: string;
};

export function TicketTitle({ title, editable, error, onSave, onCancel, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const stop = () => {
    setDraft(null);
    onCancel();
  };
  const save = async () => {
    if (draft === null) return;
    if (await onSave(draft.trim())) setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void save();
    if (e.key === "Escape") stop();
  };
  if (!editable) return <span className={className}>{title}</span>;
  if (draft === null)
    return (
      <button
        type="button"
        aria-label={t.editTitle}
        className={`text-left hover:underline decoration-dotted underline-offset-4 ${className ?? ""}`}
        onClick={() => setDraft(title)}
      >
        {title}
      </button>
    );
  return (
    <span className="grid gap-1">
      <Input
        aria-label={t.titleField}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
      />
      <span className="text-xs text-muted-foreground">{t.titleHint}</span>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
```

`packages/ui/src/ticket/StatusSelect.tsx` :
```tsx
import type { Status, StatusId, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = { ticket: TicketView; workflow: Status[]; editable: boolean; command: TicketCommand };

export function StatusSelect({ ticket, workflow, editable, command }: Props) {
  const [blocking, setBlocking] = useState(false);
  const label = workflow.find((s) => s.id === ticket.statusId)?.label ?? ticket.statusId;
  if (!editable) return <span>{label}</span>;
  const pick = (statusId: StatusId) => {
    if (statusId === ticket.statusId) return;
    if (statusId === "blocked") setBlocking(true);
    else void command.run({ method: "setStatus", ticketId: ticket.id, statusId });
  };
  const block = async (reason: string) => {
    if (await command.run({ method: "setStatus", ticketId: ticket.id, statusId: "blocked", reason })) setBlocking(false);
  };
  return (
    <>
      <Select value={ticket.statusId} onValueChange={(v) => pick(v as StatusId)}>
        <SelectTrigger size="sm" aria-label={fr.ticket.status} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[...workflow]
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <StatusDot statusId={s.id} />
                {s.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {blocking && (
        <ReasonDialog
          open
          title={t.block.title(ticket.keyLabel)}
          description={t.block.description}
          label={t.block.reason}
          placeholder={t.block.placeholder}
          confirmLabel={t.block.confirm}
          cancelLabel={t.block.cancel}
          error={command.error}
          onConfirm={(reason) => void block(reason)}
          onCancel={() => {
            command.clearError();
            setBlocking(false);
          }}
        />
      )}
    </>
  );
}
```
(`v as StatusId` : justifié, `Select` ne renvoie que les valeurs de ses `SelectItem`, tous issus de `workflow`.)

`packages/ui/src/ticket/AssigneeSelect.tsx` :
```tsx
import type { Assignee, MemberInfo, TicketView } from "@kibo/schema";
import { assigneeLabel } from "@kibo/sdk";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = { ticket: TicketView; viewer: string; members: MemberInfo[]; editable: boolean; command: TicketCommand };

const NOBODY = "none";
const ME = "me";

function assigneeOf(value: string, viewer: string): Assignee | null {
  if (value === NOBODY) return null;
  return { kind: "human", ref: value === ME ? viewer : value };
}

function valueOf(assignee: Assignee | null, viewer: string): string {
  if (!assignee) return NOBODY;
  return assignee.ref === viewer ? ME : assignee.ref;
}

export function AssigneeSelect({ ticket, viewer, members, editable, command }: Props) {
  const hintId = useId();
  const others = members.filter((m) => m.userId !== viewer);
  const label = ticket.assignee ? assigneeLabel(ticket.assignee, members) : t.nobody;
  if (!editable) return <span>{label}</span>;
  const agent = ticket.assignee?.kind === "agent";
  const pick = (value: string) =>
    void command.run({ method: "updateTicket", ticketId: ticket.id, assignee: assigneeOf(value, viewer) });
  return (
    <span className="grid gap-1">
      <Select value={agent ? ticket.assignee?.ref : valueOf(ticket.assignee, viewer)} onValueChange={pick} disabled={agent}>
        <SelectTrigger size="sm" aria-label={t.assignee} aria-describedby={agent ? hintId : undefined} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agent && ticket.assignee && <SelectItem value={ticket.assignee.ref}>{ticket.assignee.ref}</SelectItem>}
          <SelectItem value={NOBODY}>{t.nobody}</SelectItem>
          <SelectItem value={ME}>{t.me}</SelectItem>
          {others.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {agent && (
        <span id={hintId} className="text-xs text-muted-foreground">
          {t.agentAssignee}
        </span>
      )}
    </span>
  );
}
```
(Vérifier la signature d'`assigneeLabel(assignee, members)` dans `packages/sdk/src/members.ts` : c'est celle utilisée par `TicketsTree`. Un assigné humain hors membres et différent du viewer s'affiche par son `ref`.)

`packages/ui/src/ticket/DescriptionEditor.tsx` :
```tsx
import { LinkifiedText } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticketId: string;
  description: string;
  editable: boolean;
  command: TicketCommand;
  onOpenFile(ref: { path: string; line: number | null }): void;
};

export function DescriptionEditor({ ticketId, description, editable, command, onOpenFile }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    if (await command.run({ method: "updateTicket", ticketId, description: draft })) setDraft(null);
  };
  return (
    <section className="grid gap-2 px-4 text-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium">{fr.ticket.description}</h3>
        {editable && draft === null && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDraft(description)}>
            {t.editDescription}
          </Button>
        )}
      </div>
      {draft === null ? (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {description ? <LinkifiedText text={description} onOpen={onOpenFile} /> : "-"}
        </p>
      ) : (
        <div className="grid gap-2">
          <Textarea
            aria-label={t.descriptionField}
            value={draft}
            placeholder={t.descriptionPlaceholder}
            autoFocus
            className="min-h-32"
            onChange={(e) => setDraft(e.target.value)}
          />
          {command.error && (
            <p role="alert" className="text-xs text-destructive">
              {command.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={command.busy} onClick={() => void save()}>
              {t.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [x] **Step 5: Le menu « ⋯ » et la suppression confirmée**

`packages/ui/src/ticket/TicketActionsMenu.tsx` :
```tsx
import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, Ellipsis, Maximize2, Trash2 } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { useFlash } from "../lib/use-flash";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { describeTicketError } from "./use-ticket-command";

type Props = {
  projectId: string;
  ticket: TicketView;
  childCount: number;
  editable: boolean;
  onOpenInTab: (() => void) | null;
  onDeleted(): void;
};

export function ticketMenuEntries(p: Props, copy: () => void, remove: () => void): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (p.onOpenInTab) entries.push({ label: t.openInTab, icon: Maximize2, onSelect: p.onOpenInTab });
  entries.push({ label: t.copyKey, icon: Copy, onSelect: copy });
  if (p.editable) entries.push({ separator: true }, { label: t.remove, icon: Trash2, destructive: true, onSelect: remove });
  return entries;
}

export function TicketActionsMenu(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const { message, tone, flash } = useFlash();
  const copy = () => {
    navigator.clipboard.writeText(p.ticket.keyLabel).then(
      () => flash(t.copied),
      () => flash(t.copyFailed, "error"),
    );
  };
  const remove = async () => {
    await client.rpc({ method: "command", projectId: p.projectId, command: { method: "deleteTicket", ticketId: p.ticket.id } });
    p.onDeleted();
  };
  return (
    <>
      {message && (
        <span role={tone === "error" ? "alert" : "status"} className={`text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7" aria-label={t.actions(p.ticket.keyLabel)}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuEntries entries={ticketMenuEntries(p, copy, () => setConfirming(true))} />
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={t.removeTitle(p.ticket.keyLabel)}
          description={t.removeHelp(p.childCount)}
          confirmLabel={t.removeConfirm}
          cancelLabel={t.cancel}
          onConfirm={remove}
          describeError={describeTicketError}
        />
      )}
    </>
  );
}
```
`childCount` = nombre de descendants (tous niveaux), calculé par le parent : `descendantCount(project.tickets, ticket.id)` ci-dessous.

- [x] **Step 6: Brancher la fiche**

`packages/ui/src/shell/TicketDetail.tsx` : Props devient `{ project; ticket; domains?; viewer: string; onOpenFile(ref: FileRef): void; onOpenTicket(ticketId: string): void }`. Dans le corps :
- `const editable = canEdit(project); const command = useTicketCommand(project.meta.id);`
- la ligne Statut devient `<dd><StatusSelect ticket={t} workflow={project.workflow} editable={editable} command={command} /></dd>` ;
- après Domaine, une ligne Assigné : `<dt className="text-muted-foreground">{frTicketEdit.assignee}</dt><dd><AssigneeSelect ticket={t} viewer={viewer} members={project.sync.members} editable={editable} command={command} /></dd>` ;
- `command.error` s'affiche sous la `dl` : `{command.error && <p role="alert" className="px-4 text-sm text-destructive">{command.error}</p>}` ;
- la section Description devient `<DescriptionEditor ticketId={t.id} description={t.description} editable={editable} command={command} onOpenFile={open} />` ;
- chaque sous-ticket devient un bouton : `<button type="button" className="text-left hover:underline" onClick={() => onOpenTicket(c.id)}><span className="font-mono text-2xs text-muted-foreground">{c.keyLabel}</span> {c.title}</button>` ;
- exporter `export const descendantCount = (tickets: readonly TicketView[], id: string): number => tickets.filter((x) => x.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);`.
Les badges « attend » restent (T14 les remplace).

`packages/ui/src/shell/TicketSheet.tsx` : Props `+ viewer: string; onOpenTicket(ticketId: string): void; onDeleted(): void`. Dans l'en-tête : `editable = canEdit(project)` ; le `SheetTitle` devient
```tsx
          <SheetTitle className="text-lg">
            <TicketTitle
              title={t.title}
              editable={editable}
              error={command.error}
              onSave={(title) => command.run({ method: "updateTicket", ticketId: t.id, title })}
              onCancel={command.clearError}
            />
          </SheetTitle>
```
avec `const command = useTicketCommand(project.meta.id);` ; le bouton « Ouvrir dans un onglet » disparaît au profit de `<TicketActionsMenu projectId={project.meta.id} ticket={t} childCount={descendantCount(project.tickets, t.id)} editable={editable} onOpenInTab={onOpenInTab} onDeleted={onDeleted} />` placé dans la ligne de la clé (à droite, `ml-auto`). `TicketDetail` reçoit `viewer` et `onOpenTicket`.

`packages/ui/src/pages/TicketTab.tsx` : Props `+ viewer: string; onOpenTicket(ticketId: string): void`. Le `<h1>` enveloppe `TicketTitle` (même props que le Sheet) ; `TicketActionsMenu` à droite de la clé avec `onOpenInTab={null}` et `onDeleted={() => undefined}` (l'onglet affiche « Ticket introuvable » dès la mise à jour du snapshot).

`packages/ui/src/shell/ShellDialogs.tsx` : `TicketSheet` reçoit `viewer={viewer}`, `onOpenTicket={(ticketId) => set({ sheet: { projectId: sheet.projectId, ticketId } })}`, `onDeleted={() => set({ sheet: null })}`.

`packages/ui/src/shell/ContentView.tsx` : Props `+ onOpenTicket(projectId: string, ticketId: string): void` ; `TicketTab` reçoit `viewer={p.project.viewer ?? p.viewer}` et `onOpenTicket={(ticketId) => p.onOpenTicket(t.projectId, ticketId)}`. `Shell.tsx` passe `onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}`.

`packages/ui/scripts/bundle-report.ts`, `FORBIDDEN_IN_ENTRY` : `/\/packages\/ui\/src\/(ticket\/[A-Za-z-]+\.tsx?|i18n\/fr-ticket-edit\.ts)$/,`.

Run: `bun test packages/ui/src/ticket packages/ui/src/shell/sheet packages/ui/src/shell/agents-shell.test.tsx packages/ui/src/shell/presence.test.tsx packages/ui/src/palette` — Expected: PASS (les tests existants gagnent les props ajoutés, sans autre changement).

- [x] **Step 7: Gate, budget, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; budget inchangé (`ticket/` n'est chargé qu'avec `TicketDetail`), aucun « Module interdit ».

```bash
git add packages/ui/src/i18n/fr-ticket-edit.ts packages/ui/src/ticket/use-ticket-command.ts packages/ui/src/ticket/TicketTitle.tsx packages/ui/src/ticket/StatusSelect.tsx packages/ui/src/ticket/AssigneeSelect.tsx packages/ui/src/ticket/DescriptionEditor.tsx packages/ui/src/ticket/TicketActionsMenu.tsx packages/ui/src/ticket/ticket-edit.test.tsx
git commit -m "feat(ui): champs éditables de la fiche ticket"
git add packages/ui/src/shell/TicketDetail.tsx packages/ui/src/shell/TicketSheet.tsx packages/ui/src/pages/TicketTab.tsx packages/ui/src/shell/ShellDialogs.tsx packages/ui/src/shell/ContentView.tsx packages/ui/src/shell/Shell.tsx packages/ui/scripts/bundle-report.ts packages/ui/src/shell/sheet/sheet-integrations.test.tsx
git commit -m "feat(ui): fiche ticket éditable, menu et suppression"
```
(Ajouter au second commit les autres tests existants modifiés pour les nouveaux props.)

### Task 7: Pages de la barre latérale : menu, renommer, déplacer, supprimer

Vague 1 ← T2. Décision 6, écran 101, spec §12.4 (menu **page**). Les pages du projet courant sortent d'`AppSidebar` dans `ProjectPages`, qui porte le clic droit, le bouton « ⋯ », le glisser-déposer de reparentage et l'erreur de déplacement. Renommer ouvre un dialogue chargé à la demande ; supprimer confirme en nommant les sous-pages et widgets emportés. Le menu est une liste `MenuEntry[]` pure (`page-menu.ts`), testée sans DOM. Sémantique vérifiée de `movePage { index }` (Loro) : `index` est la **position finale** parmi les sœurs (sur `a,b,c`, `movePage(a, null, 1)` donne `b,a,c`) ; « Monter » envoie `index - 1`, « Descendre » `index + 1`.

**Files:**
- Create: `packages/ui/src/shell/page-menu.ts`, `packages/ui/src/shell/page-menu.test.ts`, `packages/ui/src/shell/ProjectPages.tsx`, `packages/ui/src/shell/project-pages.test.tsx`, `packages/ui/src/dialogs/RenamePageDialog.tsx`
- Modify: `packages/ui/src/shell/AppSidebar.tsx` (délègue les pages du projet courant), `packages/ui/src/shell/ShellDialogs.tsx` (`renamePage`, `deletePage`), `packages/ui/src/shell/Shell.tsx` (`onRenamePage`, `onDeletePage` vers `AppSidebar`), `packages/ui/src/shell/lazy-dialogs.ts` (`RenamePageDialog`), `packages/ui/src/i18n/fr.ts` › `nav`, `packages/ui/scripts/bundle-report.ts`
- Test (existant) : `packages/ui/src/shell/shell.test.tsx` (attentes inchangées : les boutons de page gardent leur nom)

**Interfaces:**
- Consumes: `ContextMenuEntries`, `DropdownMenuEntries`, `MenuEntry` (T2), `ConfirmDialog` (`shell/lazy-dialogs`, T2), `@dnd-kit/core` (déjà dans `packages/ui`), `SidebarMenuAction`, `SidebarMenuSub*`, `canEdit`.
- Produces: Contrats partagés › UI › `page-menu.ts`, `RenamePageDialog` ; `AppSidebar` props `+ onRenamePage(page: Page): void; onDeletePage(page: Page): void` ; `DialogsState + renamePage: Page | null; deletePage: Page | null`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr.ts` › `nav`, ajouter :
```ts
    openNewTab: "Ouvrir dans un nouvel onglet",
    renamePage: "Renommer…",
    moveUp: "Monter",
    moveDown: "Descendre",
    moveTo: "Déplacer vers",
    root: "Racine",
    deletePage: "Supprimer…",
    pageActions: (title: string) => `Actions de la page ${title}`,
    renameTitle: "Renommer la page",
    renameName: "Nom",
    renameFailed: "Impossible de renommer la page.",
    deletePageTitle: (title: string) => `Supprimer la page ${title} ?`,
    deletePageHelp: (subPages: number, widgets: number) => {
      const parts = [
        subPages > 0 ? `${subPages} sous-page${subPages > 1 ? "s" : ""}` : null,
        widgets > 0 ? `${widgets} widget${widgets > 1 ? "s" : ""}` : null,
      ].filter((p) => p !== null);
      return parts.length === 0
        ? "La page disparaîtra. Les tickets ne sont pas touchés."
        : `Ses ${parts.join(" et ")} disparaîtront. Les tickets ne sont pas touchés.`;
    },
    moveFailed: "Impossible de déplacer la page.",
    dropHere: "Déposer ici pour en faire une sous-page",
```
(Écran 101 : « Ses 2 sous-pages et 3 widgets disparaîtront. »)

- [x] **Step 2: Le menu en données (test rouge puis vert)**

`packages/ui/src/shell/page-menu.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import type { Page } from "@kibo/schema";
import { isSeparator, isSubmenu, type MenuAction } from "@kibo/sdk/ui/menu-entries";
import { fr } from "../i18n/fr";
import { moveTargets, type PageMenuActions, pageMenuEntries, siblingIndex } from "./page-menu";

const page = (id: string, title: string, parentId: string | null): Page => ({ id, title, kind: "dashboard", parentId });
const pages: Page[] = [
  page("dash", "Tableau de bord", null),
  page("kanban", "Kanban", null),
  page("k1", "Sprint", "kanban"),
  page("k11", "Rétro", "k1"),
  page("notes", "Notes", null),
];
const actions = (): PageMenuActions => ({
  openNewTab: mock(() => {}),
  newSubPage: mock(() => {}),
  rename: mock(() => {}),
  moveUp: mock(() => {}),
  moveDown: mock(() => {}),
  moveTo: mock((_p: string | null) => {}),
  remove: mock(() => {}),
});
const labels = (entries: ReturnType<typeof pageMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));
const action = (entries: ReturnType<typeof pageMenuEntries>, label: string): MenuAction => {
  const found = entries.find((e) => !isSeparator(e) && !isSubmenu(e) && e.label === label);
  if (!found || isSeparator(found) || isSubmenu(found)) throw new Error(`no action ${label}`);
  return found;
};

test("move targets exclude the page itself and its descendants", () => {
  expect(moveTargets(pages, pages[1] as Page).map((p) => p.id)).toEqual(["dash", "notes"]);
  expect(moveTargets(pages, pages[4] as Page).map((p) => p.id)).toEqual(["dash", "kanban", "k1", "k11"]);
});

test("sibling index counts within the same parent, in snapshot order", () => {
  expect(siblingIndex(pages, pages[0] as Page)).toEqual({ index: 0, count: 3 });
  expect(siblingIndex(pages, pages[4] as Page)).toEqual({ index: 2, count: 3 });
  expect(siblingIndex(pages, pages[3] as Page)).toEqual({ index: 0, count: 1 });
});

test("an editable page gets the full menu, bounds disable Monter / Descendre", () => {
  const a = actions();
  const entries = pageMenuEntries({ page: pages[1] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(labels(entries)).toEqual([
    "Ouvrir dans un nouvel onglet",
    "Nouvelle sous-page",
    "Renommer…",
    "Monter",
    "Descendre",
    "Déplacer vers ▸",
    "—",
    "Supprimer…",
  ]);
  expect(action(entries, "Monter").disabled).toBeFalsy();
  expect(action(entries, "Descendre").disabled).toBeFalsy();
  const first = pageMenuEntries({ page: pages[0] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(first, "Monter").disabled).toBe(true);
  const last = pageMenuEntries({ page: pages[4] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(last, "Descendre").disabled).toBe(true);
  const only = pageMenuEntries({ page: pages[3] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(only, "Monter").disabled).toBe(true);
  expect(action(only, "Descendre").disabled).toBe(true);
});

test("Déplacer vers lists Racine then the targets, the current parent disabled", () => {
  const a = actions();
  const entries = pageMenuEntries({ page: pages[2] as Page, pages, editable: true, texts: fr.nav, actions: a });
  const sub = entries.find(isSubmenu);
  expect(sub?.items.map((i) => [i.label, i.disabled ?? false])).toEqual([
    ["Racine", false],
    ["Tableau de bord", false],
    ["Kanban", true],
    ["Notes", false],
  ]);
  sub?.items[0]?.onSelect();
  sub?.items[1]?.onSelect();
  expect(a.moveTo).toHaveBeenNthCalledWith(1, null);
  expect(a.moveTo).toHaveBeenNthCalledWith(2, "dash");
  action(entries, "Supprimer…").onSelect();
  expect(a.remove).toHaveBeenCalledTimes(1);
  expect(action(entries, "Supprimer…").destructive).toBe(true);
});

test("a read-only project only opens the page in a new tab", () => {
  const entries = pageMenuEntries({ page: pages[1] as Page, pages, editable: false, texts: fr.nav, actions: actions() });
  expect(labels(entries)).toEqual(["Ouvrir dans un nouvel onglet"]);
});
```
Run: `bun test packages/ui/src/shell/page-menu.test.ts` — Expected: FAIL (module introuvable).

`packages/ui/src/shell/page-menu.ts` :
```ts
import type { Page } from "@kibo/schema";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ArrowDown, ArrowUp, ExternalLink, FolderInput, Pencil, Plus, Trash2 } from "lucide-react";

export type PageMenuTexts = {
  openNewTab: string;
  newSubPage: string;
  rename: string;
  moveUp: string;
  moveDown: string;
  moveTo: string;
  root: string;
  remove: string;
};
export type PageMenuActions = {
  openNewTab(): void;
  newSubPage(): void;
  rename(): void;
  moveUp(): void;
  moveDown(): void;
  moveTo(parentId: string | null): void;
  remove(): void;
};

export function descendantIds(pages: readonly Page[], id: string): Set<string> {
  const out = new Set<string>();
  const visit = (parentId: string) => {
    for (const p of pages) {
      if (p.parentId === parentId && !out.has(p.id)) {
        out.add(p.id);
        visit(p.id);
      }
    }
  };
  visit(id);
  return out;
}

export function moveTargets(pages: readonly Page[], page: Page): Page[] {
  const excluded = descendantIds(pages, page.id);
  return pages.filter((p) => p.id !== page.id && !excluded.has(p.id));
}

export function siblingIndex(pages: readonly Page[], page: Page): { index: number; count: number } {
  const siblings = pages.filter((p) => p.parentId === page.parentId);
  return { index: siblings.findIndex((p) => p.id === page.id), count: siblings.length };
}

export function pageMenuEntries(input: {
  page: Page;
  pages: readonly Page[];
  editable: boolean;
  texts: PageMenuTexts;
  actions: PageMenuActions;
}): MenuEntry[] {
  const { page, pages, editable, texts, actions } = input;
  const open: MenuAction = { label: texts.openNewTab, icon: ExternalLink, onSelect: actions.openNewTab };
  if (!editable) return [open];
  const { index, count } = siblingIndex(pages, page);
  const targets: MenuAction[] = [
    { label: texts.root, disabled: page.parentId === null, onSelect: () => actions.moveTo(null) },
    ...moveTargets(pages, page).map(
      (p): MenuAction => ({ label: p.title, disabled: p.id === page.parentId, onSelect: () => actions.moveTo(p.id) }),
    ),
  ];
  return [
    open,
    { label: texts.newSubPage, icon: Plus, onSelect: actions.newSubPage },
    { label: texts.rename, icon: Pencil, onSelect: actions.rename },
    { label: texts.moveUp, icon: ArrowUp, disabled: index <= 0, onSelect: actions.moveUp },
    { label: texts.moveDown, icon: ArrowDown, disabled: index >= count - 1, onSelect: actions.moveDown },
    { label: texts.moveTo, icon: FolderInput, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
```
Run: `bun test packages/ui/src/shell/page-menu.test.ts` — Expected: PASS, 5 tests.

- [x] **Step 3: `ProjectPages` (test rouge)**

`packages/ui/src/shell/project-pages.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type Page, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { SidebarMenu, SidebarMenuItem, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return answer(req);
    },
  },
}));
const { ProjectPages } = await import("./ProjectPages");

const page = (id: string, title: string, parentId: string | null): Page => ({ id, title, kind: "view", parentId });
const project = (access: ProjectSnapshot["sync"]["access"] = "write"): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [page("dash", "Tableau de bord", null), page("kanban", "Kanban", null), page("k1", "Sprint", "kanban")],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: access !== "write", keyAllocator: "local", role: null, access, members: [] },
});
const show = (access: ProjectSnapshot["sync"]["access"] = "write") => {
  const onOpen = mock((_t: unknown, _newTab: boolean) => {});
  const onNewPage = mock((_parentId: string | null) => {});
  const onRenamePage = mock((_p: Page) => {});
  const onDeletePage = mock((_p: Page) => {});
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <ProjectPages
            project={project(access)}
            activeTarget={null}
            header={<span>Kibo</span>}
            trailing={null}
            onOpen={onOpen}
            onNewPage={onNewPage}
            onRenamePage={onRenamePage}
            onDeletePage={onDeletePage}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>,
  );
  return { onOpen, onNewPage, onRenamePage, onDeletePage, user: userEvent.setup() };
};
const command = (req: RpcRequest | undefined) => (req?.method === "command" ? req.command : null);

beforeEach(() => {
  calls.length = 0;
  answer = () => null;
});

test("right click on a page opens its menu; the entries call back or send movePage", async () => {
  const { user, onOpen, onNewPage, onRenamePage, onDeletePage } = show();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  const menu = await screen.findByRole("menu");
  expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
    "Ouvrir dans un nouvel onglet",
    "Nouvelle sous-page",
    "Renommer…",
    "Monter",
    "Descendre",
    "Déplacer vers",
    "Supprimer…",
  ]);
  await user.click(within(menu).getByRole("menuitem", { name: "Ouvrir dans un nouvel onglet" }));
  expect(onOpen).toHaveBeenLastCalledWith({ kind: "page", projectId: "p1", pageId: "kanban" }, true);
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
  expect(command(calls.at(-1))).toEqual({ method: "movePage", pageId: "kanban", parentId: null, index: 0 });
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Nouvelle sous-page" }));
  expect(onNewPage).toHaveBeenLastCalledWith("kanban");
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Renommer…" }));
  expect(onRenamePage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "kanban" }));
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  expect(onDeletePage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "kanban" }));
});

test("the ⋯ button carries the same entries and Déplacer vers sends movePage to the target", async () => {
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Actions de la page Sprint" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  const items = await screen.findAllByRole("menuitem", { name: /Racine|Tableau de bord|Kanban/ });
  expect(items.map((i) => i.textContent)).toEqual(["Racine", "Tableau de bord", "Kanban"]);
  await user.click(screen.getByRole("menuitem", { name: "Racine" }));
  expect(command(calls.at(-1))).toEqual({ method: "movePage", pageId: "k1", parentId: null });
});

test("a refused move is shown as an alert", async () => {
  answer = () => {
    throw new KiboError("TREE_CYCLE", "cycle");
  };
  const { user } = show();
  await user.click(screen.getByRole("button", { name: "Actions de la page Kanban" }));
  await user.click(await screen.findByRole("menuitem", { name: "Descendre" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer la page.");
});

test("a read-only project has no ⋯ button and a one-entry menu", async () => {
  const { user } = show("read-only");
  expect(screen.queryByRole("button", { name: /Actions de la page/ })).toBeNull();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Kanban" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir dans un nouvel onglet"]);
});
```
Run: `bun test packages/ui/src/shell/project-pages.test.tsx` — Expected: FAIL (module introuvable).

- [x] **Step 4: `ProjectPages`**

`packages/ui/src/shell/ProjectPages.tsx` :
```tsx
import { DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { Page, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { SidebarMenuAction, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@kibo/sdk/ui/sidebar";
import { Ellipsis } from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";
import { canEdit } from "../state/access";
import { pageMenuEntries, siblingIndex } from "./page-menu";

const ROOT = "root";

type Props = {
  project: ProjectSnapshot;
  activeTarget: TabTarget | null;
  header: ReactNode;
  trailing: ReactNode;
  onOpen(target: TabTarget, newTab: boolean): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

function RootDrop({ children, editable }: { children: ReactNode; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT, disabled: !editable });
  return (
    <div ref={setNodeRef} className={cn("rounded-md", isOver && "ring-2 ring-ring")}>
      {children}
    </div>
  );
}

type RowProps = {
  page: Page;
  depth: number;
  entries: MenuEntry[];
  editable: boolean;
  active: boolean;
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
  children: ReactNode;
  icon: ReactNode;
};

function PageRow({ page, entries, editable, active, onClick, onAuxClick, children, icon }: RowProps) {
  const drop = useDroppable({ id: page.id, disabled: !editable });
  const drag = useDraggable({ id: page.id, disabled: !editable });
  return (
    <SidebarMenuSubItem ref={drop.setNodeRef} className={cn("group/page", drop.isOver && "rounded-md ring-2 ring-ring")}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative">
            <SidebarMenuSubButton asChild isActive={active}>
              <button
                type="button"
                ref={drag.setNodeRef}
                {...drag.attributes}
                {...drag.listeners}
                onClick={onClick}
                onAuxClick={onAuxClick}
                aria-describedby={undefined}
              >
                {icon}
                <span>{page.title}</span>
              </button>
            </SidebarMenuSubButton>
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    aria-label={fr.nav.pageActions(page.title)}
                    className="top-1 right-1 size-5"
                  >
                    <Ellipsis />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                  <DropdownMenuEntries entries={entries} />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      {children}
    </SidebarMenuSubItem>
  );
}

export function ProjectPages(p: Props) {
  const { project, activeTarget, onOpen } = p;
  const projectId = project.meta.id;
  const editable = canEdit(project);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const move = async (pageId: string, parentId: string | null, index?: number) => {
    setError(null);
    try {
      await client.rpc({ method: "command", projectId, command: { method: "movePage", pageId, parentId, ...(index === undefined ? {} : { index }) } });
    } catch {
      setError(fr.nav.moveFailed);
    }
  };
  const entriesFor = (page: Page): MenuEntry[] => {
    const { index } = siblingIndex(project.pages, page);
    return pageMenuEntries({
      page,
      pages: project.pages,
      editable,
      texts: fr.nav,
      actions: {
        openNewTab: () => onOpen({ kind: "page", projectId, pageId: page.id }, true),
        newSubPage: () => p.onNewPage(page.id),
        rename: () => p.onRenamePage(page),
        moveUp: () => void move(page.id, page.parentId, index - 1),
        moveDown: () => void move(page.id, page.parentId, index + 1),
        moveTo: (parentId) => void move(page.id, parentId),
        remove: () => p.onDeletePage(page),
      },
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (overId === undefined || overId === e.active.id) return;
    const page = project.pages.find((x) => x.id === e.active.id);
    const parentId = overId === ROOT ? null : String(overId);
    if (!page || page.parentId === parentId) return;
    void move(page.id, parentId);
  };
  const children = (parentId: string | null) => project.pages.filter((x) => x.parentId === parentId);
  const renderPages = (parentId: string | null, depth: number): ReactNode =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, project.instances);
      const target: TabTarget = { kind: "page", projectId, pageId: page.id };
      return (
        <PageRow
          key={page.id}
          page={page}
          depth={depth}
          entries={entriesFor(page)}
          editable={editable}
          active={activeTarget?.kind === "page" && activeTarget.projectId === projectId && activeTarget.pageId === page.id}
          onClick={(e) => onOpen(target, wantsNewTab(e))}
          onAuxClick={(e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            onOpen(target, true);
          }}
          icon={<Icon />}
        >
          {children(page.id).length > 0 && <SidebarMenuSub>{renderPages(page.id, depth + 1)}</SidebarMenuSub>}
        </PageRow>
      );
    });
  const hasSub = children(null).length > 0 || p.trailing !== null;
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <RootDrop editable={editable}>{p.header}</RootDrop>
      {hasSub && (
        <SidebarMenuSub>
          {renderPages(null, 0)}
          {p.trailing}
        </SidebarMenuSub>
      )}
      {error && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </DndContext>
  );
}
```
Notes : `aria-describedby={undefined}` annule la description que `useDraggable` pose sur le bouton (« To pick up a draggable item… », en anglais) ; `SidebarMenuAction` accepte `showOnHover` (shadcn). Le glisser ne change que le parent (décision 6). Le `trailing` reçoit l'entrée « Changements » d'`AppSidebar`, inchangée.

`packages/ui/src/shell/AppSidebar.tsx` : Props `+ onRenamePage(page: Page): void; onDeletePage(page: Page): void`. Supprimer `children`, `renderPages` et leurs imports (`SidebarMenuSubButton`, `pageIcon` s'ils ne servent plus qu'aux pages ; `changesEntry` reste). Dans la boucle des projets, le corps de `SidebarMenuItem` devient :
```tsx
                  {(() => {
                    const header = (
                      <>
                        <SidebarMenuButton isActive={onTarget("project", project.id)} {...link({ kind: "project", projectId: project.id })}>
                          <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
                          <span>{project.name}</span>
                        </SidebarMenuButton>
                        <ProjectMenu name={project.name} current={current} shifted={current && editable} onShare={() => p.onShare(project.id)} />
                        {current && editable && (
                          <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => p.onNewPage(null)}>
                            <Plus />
                          </SidebarMenuAction>
                        )}
                      </>
                    );
                    return current && active ? (
                      <ProjectPages
                        project={active}
                        activeTarget={activeTarget}
                        header={header}
                        trailing={changesEntry(project.id) || null}
                        onOpen={(t, newTab) => onOpen(t, newTab)}
                        onNewPage={p.onNewPage}
                        onRenamePage={p.onRenamePage}
                        onDeletePage={p.onDeletePage}
                      />
                    ) : (
                      header
                    );
                  })()}
```
(Extraire ce bloc en composant `ProjectEntry` dans le même fichier si l'IIFE gêne la lisibilité ; `changesEntry` renvoie `false` quand `changesCount === null`, d'où le `|| null`.)

`Shell.tsx` passe `onRenamePage={(page) => set({ renamePage: page })}` et `onDeletePage={(page) => set({ deletePage: page })}`.

Run: `bun test packages/ui/src/shell/project-pages.test.tsx packages/ui/src/shell/shell.test.tsx` — Expected: PASS.

- [x] **Step 5: Renommer et supprimer (dialogues)**

`packages/ui/src/dialogs/RenamePageDialog.tsx` :
```tsx
import type { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = { projectId: string; page: Page; onClose(): void };

export function RenamePageDialog({ projectId, page, onClose }: Props) {
  const id = useId();
  const [title, setTitle] = useState(page.title);
  const [failed, setFailed] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailed(false);
    try {
      await client.rpc({ method: "command", projectId, command: { method: "renamePage", pageId: page.id, title: title.trim() } });
      onClose();
    } catch {
      setFailed(true);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.nav.renameTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.nav.renameName}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.nav.renameFailed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {fr.common.rename}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
(Le bouton est désactivé sur un titre vide ; un titre d'espaces trimé reste vide donc désactivé : le démon n'est jamais appelé avec un titre vide depuis ce dialogue ; s'il refuse pour une autre raison, l'erreur s'affiche et le champ reste éditable.)

`lazy-dialogs.ts` : `export const RenamePageDialog = lazyPanel(() => import("../dialogs/RenamePageDialog").then((m) => m.RenamePageDialog), fr.lazy, hidden);`

`ShellDialogs.tsx` : `DialogsState + renamePage: Page | null; deletePage: Page | null` (et `NO_DIALOG` : `renamePage: null, deletePage: null`). Rendu, avec `import { descendantIds } from "./page-menu"` :
```tsx
      {project && state.renamePage && (
        <RenamePageDialog projectId={project.meta.id} page={state.renamePage} onClose={() => set({ renamePage: null })} />
      )}
      {project && state.deletePage && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && set({ deletePage: null })}
          title={fr.nav.deletePageTitle(state.deletePage.title)}
          description={fr.nav.deletePageHelp(
            descendantIds(project.pages, state.deletePage.id).size,
            project.instances.filter((i) => i.pageId === state.deletePage?.id || descendantIds(project.pages, state.deletePage?.id ?? "").has(i.pageId)).length,
          )}
          confirmLabel={fr.common.delete}
          cancelLabel={fr.common.cancel}
          onConfirm={async () => {
            if (!state.deletePage) return;
            await client.rpc({ method: "command", projectId: project.meta.id, command: { method: "deletePage", pageId: state.deletePage.id } });
          }}
          describeError={errorMessage}
        />
      )}
```
(Calculer `const doomed = state.deletePage ? descendantIds(project.pages, state.deletePage.id) : new Set<string>()` une fois au-dessus du `return`, puis `doomed.size` et `project.instances.filter((i) => i.pageId === state.deletePage?.id || doomed.has(i.pageId)).length`.) `client` et `errorMessage` (`lib/error-message`) sont importés dans `ShellDialogs.tsx` ; `fr` aussi.

Test dans `project-pages.test.tsx` ? Non : le dialogue de renommage se teste dans `packages/ui/src/dialogs/rename-page-dialog.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
mock.module("../api", () => ({ client: { rpc: (req: RpcRequest) => { calls.push(req); return outcome(); } } }));
const { RenamePageDialog } = await import("./RenamePageDialog");
const page = { id: "kanban", title: "Kanban", kind: "view" as const, parentId: null };

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("renaming sends the trimmed title and closes", async () => {
  const onClose = mock(() => {});
  render(<RenamePageDialog projectId="p1" page={page} onClose={onClose} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Nom");
  expect((field as HTMLInputElement).value).toBe("Kanban");
  await user.clear(field);
  await user.type(field, "  Tableau ");
  await user.click(screen.getByRole("button", { name: "Renommer" }));
  expect(calls).toEqual([{ method: "command", projectId: "p1", command: { method: "renamePage", pageId: "kanban", title: "Tableau" } }]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a blank title cannot be submitted; a refusal keeps the dialog open with the error", async () => {
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "empty"));
  const onClose = mock(() => {});
  render(<RenamePageDialog projectId="p1" page={page} onClose={onClose} />);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Nom");
  await user.clear(field);
  await user.type(field, "   ");
  expect((screen.getByRole("button", { name: "Renommer" }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(field, "x");
  await user.click(screen.getByRole("button", { name: "Renommer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de renommer la page.");
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Nom")).toBeTruthy();
});
```
`bundle-report.ts` › `FORBIDDEN_IN_ENTRY` : ajouter `RenamePageDialog` à la regex des dialogues de T2 : `/\/packages\/ui\/src\/dialogs\/(RenameWorkspaceDialog|NotesDirDialog|TrustDialog|OpenViewDialog|RenamePageDialog)\.tsx$/`.

Run: `bun test packages/ui/src/dialogs/rename-page-dialog.test.tsx packages/ui/src/shell` — Expected: PASS.

- [x] **Step 6: Gate, budget, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; budget : `ProjectPages` entre dans l'entrée (menu + dnd-kit déjà présents via `TabBar`) : attendre + 1,5 kB au plus par rapport à la mesure après T2 ; noter la valeur.

```bash
git add packages/ui/src/shell/page-menu.ts packages/ui/src/shell/page-menu.test.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): entrées du menu d'une page"
git add packages/ui/src/shell/ProjectPages.tsx packages/ui/src/shell/project-pages.test.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Shell.tsx
git commit -m "feat(ui): menu, ⋯ et glisser-déposer des pages"
git add packages/ui/src/dialogs/RenamePageDialog.tsx packages/ui/src/dialogs/rename-page-dialog.test.tsx packages/ui/src/shell/lazy-dialogs.ts packages/ui/src/shell/ShellDialogs.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): renommer et supprimer une page"
```

### Task 8: Réglages d'un widget et retrait confirmé

Vague 1 ← T2. Décision 8, écran 105. Le menu « ⋯ » d'un widget gagne « Réglages… » quand le manifeste porte un `configSchema` non vide ; le dialogue est **généré** depuis le schéma (`ConfigField` : `enum` ⇒ sélecteur, `boolean` ⇒ interrupteur, `number` ⇒ champ numérique, `string` ⇒ champ texte, `nullable` ⇒ case « Aucune valeur »), valide par `validateConfig` avant d'envoyer `setInstanceConfig` avec la config **fusionnée** (les clés hors schéma, `source` et configuration MCP, sont conservées). « Retirer de la page » devient « Retirer de la page… » et passe par `ConfirmDialog`. Les libellés des champs et valeurs connus (`filter`, `mine-and-agents`, `all`, `mine`) sont traduits ; les autres s'affichent tels quels.

**Files:**
- Create: `packages/ui/src/lib/config-form.ts`, `packages/ui/src/lib/config-form.test.ts`, `packages/ui/src/dialogs/InstanceSettingsDialog.tsx`, `packages/ui/src/dialogs/instance-settings.test.tsx`, `packages/ui/src/i18n/fr-widgets.ts`
- Modify: `packages/ui/src/pages/InstanceMenu.tsx`, `packages/ui/src/pages/instance.test.tsx` (tests D1 : libellé « Retirer de la page… » et confirmation), `packages/ui/src/i18n/fr-components.ts` › `instance`, `packages/ui/src/shell/lazy-dialogs.ts`, `packages/ui/scripts/bundle-report.ts`

**Interfaces:**
- Consumes: `ConfigField`, `ConfigSchema`, `validateConfig` (`@kibo/schema`), `findComponent` (`registry.ts`), `useComponents`, `ConfirmDialog` (T2), `Select`, `Switch`, `Checkbox`, `Input`, `Label` du SDK.
- Produces: Contrats partagés › UI › `config-form.ts`, `InstanceSettingsDialog` ; `lazy-dialogs.InstanceSettingsDialog`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr-widgets.ts` :
```ts
const FIELDS: Record<string, string> = { filter: "Filtre" };
const VALUES: Record<string, string> = { "mine-and-agents": "Moi + agents", all: "Tous", mine: "Mes tickets" };

export const frWidgets = {
  title: (name: string) => `Réglages · ${name}`,
  help: "Ces réglages ne concernent que ce widget.",
  save: "Enregistrer",
  cancel: "Annuler",
  noValue: "Aucune valeur",
  invalid: (errors: string[]) => `Réglages refusés : ${errors.join(" ; ")}`,
  failed: "Impossible d'enregistrer les réglages.",
  fieldLabel: (key: string) => FIELDS[key] ?? key,
  valueLabel: (value: string | number | boolean) => VALUES[String(value)] ?? String(value),
};
```
`packages/ui/src/i18n/fr-components.ts` › `instance` : `remove` devient `"Retirer de la page…"` ; ajouter
```ts
    settings: "Réglages…",
    removeTitle: (title: string) => `Retirer ${title} de la page ?`,
    removeHelp: "Le widget disparaît de la page ; les tickets ne sont pas touchés.",
    removeConfirm: "Retirer",
```

- [x] **Step 2: Le formulaire en données (test rouge puis vert)**

`packages/ui/src/lib/config-form.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { ComponentSummary, ConfigSchema, Instance } from "@kibo/schema";
import { configFields, configSchemaOf, parseFieldInput, withFieldValue } from "./config-form";

const schema: ConfigSchema = {
  filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  compact: { type: "boolean", default: false },
  limit: { type: "number", nullable: true },
  label: { type: "string" },
  level: { enum: [1, 2, 3] },
};

test("fields follow the schema order, take the config value, then the default, then a neutral value", () => {
  const fields = configFields(schema, { filter: "all", limit: 12, source: { bindingId: "b1" } });
  expect(fields.map((f) => [f.key, f.value])).toEqual([
    ["filter", "all"],
    ["compact", false],
    ["limit", 12],
    ["label", ""],
    ["level", 1],
  ]);
  expect(configFields(schema, {}).map((f) => f.value)).toEqual(["mine-and-agents", false, null, "", 1]);
});

test("raw input is parsed by field: numbers, enums of numbers, empty to null when nullable", () => {
  expect(parseFieldInput({ type: "number", nullable: true }, "12")).toBe(12);
  expect(parseFieldInput({ type: "number", nullable: true }, "")).toBeNull();
  expect(parseFieldInput({ type: "number" }, "")).toBe("");
  expect(parseFieldInput({ type: "number" }, "abc")).toBe("abc");
  expect(parseFieldInput({ enum: [1, 2, 3] }, "2")).toBe(2);
  expect(parseFieldInput({ enum: [true, false] }, "false")).toBe(false);
  expect(parseFieldInput({ type: "string" }, " x ")).toBe(" x ");
  expect(parseFieldInput({ type: "string", nullable: true }, "")).toBeNull();
});

test("setting a field keeps every other key, including the ones outside the schema", () => {
  const config = { filter: "all", source: { bindingId: "b1" }, mcp: { server: "s" } };
  expect(withFieldValue(config, "filter", "mine-and-agents")).toEqual({ ...config, filter: "mine-and-agents" });
  expect(withFieldValue(config, "limit", null)).toEqual({ ...config, limit: null });
});

const instance = (component: string): Instance => ({
  id: "i1",
  pageId: "pg",
  component,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: null,
});
const third = (configSchema: ConfigSchema | undefined): ComponentSummary[] => [
  {
    id: "pr-queue",
    title: "PR en attente",
    builtin: false,
    versions: [
      {
        version: "0.3.0",
        hash: "c".repeat(64),
        trust: "sandboxed",
        origin: "ai",
        active: true,
        tampered: false,
        manifest: {
          id: "pr-queue",
          version: "0.3.0",
          kind: "widget",
          title: "PR en attente",
          reads: ["ticket"],
          writes: [],
          data: false,
          net: [],
          secrets: [],
          mcp: [],
          configVersion: 0,
          ...(configSchema && { configSchema }),
        },
        usages: [],
        revoked: null,
        backend: false,
      },
    ],
  },
];

test("the schema comes from the registry for a built-in, from the installed version for a third party, null when empty", () => {
  expect(configSchemaOf(instance("kanban@1.0.0"), null)).toEqual({
    filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  });
  expect(configSchemaOf(instance("graph@1.0.0"), null)).toBeNull();
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third({ limit: { type: "number" } }))).toEqual({ limit: { type: "number" } });
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third({}))).toBeNull();
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third(undefined))).toBeNull();
  expect(configSchemaOf(instance("pr-queue@0.9.0"), third({ limit: { type: "number" } }))).toBeNull();
});
```
(Si le manifeste du graph porte un `configSchema`, remplacer `graph@1.0.0` par un intégré sans schéma, ou retirer l'assertion ; vérifier `components/*/kibo.component.json`. Le type complet de `ComponentVersionSummary` est dans `packages/schema/src/component.ts:128-148` : compléter la fixture si un champ manque.)

Run: `bun test packages/ui/src/lib/config-form.test.ts` — Expected: FAIL.

`packages/ui/src/lib/config-form.ts` :
```ts
import { type ComponentSummary, type ConfigField, type ConfigSchema, type Instance, splitRef } from "@kibo/schema";
import { findComponent } from "../registry";

export type FieldValue = string | number | boolean | null;
export type FieldKind = "enum" | "boolean" | "number" | "string";
export type FormField = { key: string; field: ConfigField; value: FieldValue };

const isFieldValue = (v: unknown): v is FieldValue =>
  v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

export const fieldKind = (field: ConfigField): FieldKind => (field.enum ? "enum" : (field.type ?? "string"));

function neutralValue(field: ConfigField): FieldValue {
  if (field.nullable) return null;
  if (field.enum) return field.enum[0] ?? "";
  if (field.type === "boolean") return false;
  if (field.type === "number") return 0;
  return "";
}

function initialValue(field: ConfigField, raw: unknown): FieldValue {
  if (isFieldValue(raw) && (raw !== null || field.nullable)) return raw;
  if (isFieldValue(field.default)) return field.default;
  return neutralValue(field);
}

export function configFields(schema: ConfigSchema, config: Record<string, unknown>): FormField[] {
  return Object.entries(schema).map(([key, field]) => ({ key, field, value: initialValue(field, config[key]) }));
}

export function parseFieldInput(field: ConfigField, raw: string): FieldValue {
  if (raw === "" && field.nullable) return null;
  if (field.enum) return field.enum.find((e) => String(e) === raw) ?? raw;
  if (field.type === "number") {
    const n = Number(raw);
    return raw.trim() === "" || Number.isNaN(n) ? raw : n;
  }
  if (field.type === "boolean") return raw === "true";
  return raw;
}

export function withFieldValue(config: Record<string, unknown>, key: string, value: FieldValue): Record<string, unknown> {
  return { ...config, [key]: value };
}

const nonEmpty = (schema: ConfigSchema | undefined): ConfigSchema | null =>
  schema && Object.keys(schema).length > 0 ? schema : null;

export function configSchemaOf(instance: Instance, components: ComponentSummary[] | null): ConfigSchema | null {
  const builtin = findComponent(instance.component);
  if (builtin) return nonEmpty(builtin.manifest.configSchema);
  const { id, version } = splitRef(instance.component);
  const summary = components?.find((c) => c.id === id && !c.builtin);
  return nonEmpty(summary?.versions.find((v) => v.version === version)?.manifest?.configSchema);
}
```
Run: `bun test packages/ui/src/lib/config-form.test.ts` — Expected: PASS, 4 tests.

- [x] **Step 3: Le dialogue (test rouge puis vert)**

`packages/ui/src/dialogs/instance-settings.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { ConfigSchema, Instance, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
mock.module("../api", () => ({ client: { rpc: (req: RpcRequest) => { calls.push(req); return outcome(); } } }));
const { InstanceSettingsDialog } = await import("./InstanceSettingsDialog");

const schema: ConfigSchema = {
  filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  compact: { type: "boolean", default: false },
  limit: { type: "number", nullable: true },
  label: { type: "string" },
};
const instance: Instance = {
  id: "i1",
  pageId: "pg",
  component: "kanban@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: { filter: "mine-and-agents", limit: 5, source: { bindingId: "b1" } },
  componentHash: null,
};
const show = () => {
  const onClose = mock(() => {});
  render(<InstanceSettingsDialog projectId="p1" instance={instance} title="Kanban" schema={schema} onClose={onClose} />);
  return { onClose, user: userEvent.setup() };
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("the form is generated from the schema and saves the merged config", async () => {
  const { onClose, user } = show();
  expect(screen.getByRole("dialog", { name: "Réglages · Kanban" })).toBeTruthy();
  expect(screen.getByText("Ces réglages ne concernent que ce widget.")).toBeTruthy();
  await user.click(screen.getByRole("combobox", { name: "Filtre" }));
  await user.click(await screen.findByRole("option", { name: "Tous" }));
  await user.click(screen.getByRole("switch", { name: "compact" }));
  const limit = screen.getByRole("spinbutton", { name: "limit" });
  expect((limit as HTMLInputElement).value).toBe("5");
  await user.clear(limit);
  await user.type(limit, "12");
  await user.type(screen.getByRole("textbox", { name: "label" }), "Sprint");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "setInstanceConfig",
        instanceId: "i1",
        config: { filter: "all", compact: true, limit: 12, label: "Sprint", source: { bindingId: "b1" } },
      },
    },
  ]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Aucune valeur sends null for a nullable field and disables its input", async () => {
  const { user } = show();
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  expect((screen.getByRole("spinbutton", { name: "limit" }) as HTMLInputElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const sent = calls[0];
  expect(sent?.method === "command" && sent.command.method === "setInstanceConfig" && sent.command.config.limit).toBeNull();
});

test("an invalid value is refused before any call", async () => {
  const { onClose, user } = show();
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  const limit = screen.getByRole("spinbutton", { name: "limit" });
  await user.clear(limit);
  await user.type(limit, "abc");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Réglages refusés : limit: expected number");
  expect(calls).toEqual([]);
  expect(onClose).not.toHaveBeenCalled();
});
```
(Un `<input type="number">` refuse la frappe de lettres dans un vrai navigateur ; happy-dom la laisse passer, ce qui exerce la validation. Si `user.type` sur un `spinbutton` ne fait pas passer « abc » en happy-dom, remplacer le champ numérique par `inputMode="decimal"` sur un `type="text"` et adapter le rôle en `textbox` : la validation par `validateConfig` reste la barrière.)

Run: `bun test packages/ui/src/dialogs/instance-settings.test.tsx` — Expected: FAIL.

`packages/ui/src/dialogs/InstanceSettingsDialog.tsx` :
```tsx
import { type ConfigSchema, type Instance, validateConfig } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Switch } from "@kibo/sdk/ui/switch";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frWidgets as t } from "../i18n/fr-widgets";
import { configFields, type FieldValue, fieldKind, type FormField, parseFieldInput, withFieldValue } from "../lib/config-form";

type Props = { projectId: string; instance: Instance; title: string; schema: ConfigSchema; onClose(): void };

function FieldInput({ field, value, onChange }: { field: FormField; value: FieldValue; onChange(v: FieldValue): void }) {
  const kind = fieldKind(field.field);
  const label = t.fieldLabel(field.key);
  const disabled = value === null;
  if (kind === "enum")
    return (
      <Select value={value === null ? "" : String(value)} onValueChange={(v) => onChange(parseFieldInput(field.field, v))} disabled={disabled}>
        <SelectTrigger aria-label={label} className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(field.field.enum ?? []).map((e) => (
            <SelectItem key={String(e)} value={String(e)}>
              {t.valueLabel(e)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  if (kind === "boolean") return <Switch aria-label={label} checked={value === true} disabled={disabled} onCheckedChange={(c) => onChange(c)} />;
  return (
    <Input
      aria-label={label}
      type={kind === "number" ? "number" : "text"}
      value={value === null ? "" : String(value)}
      disabled={disabled}
      className="w-56"
      onChange={(e) => onChange(parseFieldInput(field.field, e.target.value))}
    />
  );
}

export function InstanceSettingsDialog({ projectId, instance, title, schema, onClose }: Props) {
  const baseId = useId();
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(configFields(schema, instance.config).map((f) => [f.key, f.value])),
  );
  const [error, setError] = useState<string | null>(null);
  const fields = configFields(schema, instance.config);
  const set = (key: string, value: FieldValue) => setValues((v) => ({ ...v, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateConfig(schema, values);
    if (errors.length > 0) {
      setError(t.invalid(errors));
      return;
    }
    setError(null);
    const config = fields.reduce((acc, f) => withFieldValue(acc, f.key, values[f.key] ?? null), instance.config);
    try {
      await client.rpc({ method: "command", projectId, command: { method: "setInstanceConfig", instanceId: instance.id, config } });
      onClose();
    } catch {
      setError(t.failed);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title(title)}</DialogTitle>
            <DialogDescription>{t.help}</DialogDescription>
          </DialogHeader>
          {fields.map((f) => {
            const value = values[f.key] ?? null;
            const id = `${baseId}-${f.key}`;
            return (
              <div key={f.key} className="grid gap-2">
                <Label id={id}>{t.fieldLabel(f.key)}</Label>
                <div className="flex items-center gap-3">
                  <FieldInput field={f} value={value} onChange={(v) => set(f.key, v)} />
                  {f.field.nullable && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        aria-label={t.noValue}
                        checked={value === null}
                        onCheckedChange={(c) => set(f.key, c === true ? null : configFields({ [f.key]: { ...f.field, nullable: false } }, {})[0]?.value ?? "")}
                      />
                      {t.noValue}
                    </label>
                  )}
                </div>
              </div>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit">{t.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
(Décocher « Aucune valeur » remet la valeur neutre du champ rendu non nullable : `configFields` sur un schéma d'un seul champ. Plusieurs cases « Aucune valeur » sur un même formulaire portent le même `aria-label` : les tests n'en ont qu'une ; si le schéma réel en a plusieurs, l'a11y reste correcte car chaque case est dans le groupe de son champ.)

`lazy-dialogs.ts` : `export const InstanceSettingsDialog = lazyPanel(() => import("../dialogs/InstanceSettingsDialog").then((m) => m.InstanceSettingsDialog), fr.lazy, hidden);`

Run: `bun test packages/ui/src/dialogs/instance-settings.test.tsx` — Expected: PASS, 3 tests.

- [x] **Step 4: Le menu d'instance (tests existants mis à jour, puis code)**

`packages/ui/src/pages/instance.test.tsx`, test « D1: update to a higher version, remove from the page » : la liste attendue se termine par `"Retirer de la page…"` ; la fin du test devient
```tsx
  await user.click(screen.getByRole("button", { name: "Actions PR en attente" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Retirer PR en attente de la page ?" });
  expect(confirm.textContent).toContain("Le widget disparaît de la page ; les tickets ne sont pas touchés.");
  await user.click(within(confirm).getByRole("button", { name: "Retirer" }));
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({ method: "command", projectId: "p1", command: { method: "removeInstance", instanceId: "i1" } }),
  );
```
(`within` importé de Testing Library.) Test « D1: Notes offers its folder, built-ins no update » : `["Dossier des notes…", "Réglages…", "Retirer de la page…"]` (le manifeste de Notes porte `configSchema: { path: { type: "string", nullable: true, default: null } }` : son dialogue de réglages montre un champ « path » avec la case « Aucune valeur » cochée). Ajouter :
```tsx
test("a widget with a config schema offers its settings", async () => {
  wrap(<InstanceMenu projectId="p1" instance={inst("kanban@1.0.0")} title="Kanban" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Kanban" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Réglages…", "Retirer de la page…"]);
  await user.click(screen.getByRole("menuitem", { name: "Réglages…" }));
  expect(await screen.findByRole("dialog", { name: "Réglages · Kanban" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Filtre" }).textContent).toBe("Moi + agents");
});
```
Run: `bun test packages/ui/src/pages/instance.test.tsx` — Expected: FAIL (libellés, dialogue absent).

`packages/ui/src/pages/InstanceMenu.tsx` :
- imports : `Settings2` (lucide), `configSchemaOf` (`../lib/config-form`), `ConfirmDialog` et `InstanceSettingsDialog` depuis `../shell/lazy-dialogs`, `frWidgets` non nécessaire ;
- état : `const [settings, setSettings] = useState(false); const [removing, setRemoving] = useState(false); const schema = configSchemaOf(instance, components);`
- `remove` devient `async () => { await client.rpc({ method: "command", projectId, command: { method: "removeInstance", instanceId: instance.id } }); }` (l'erreur remonte au `ConfirmDialog`, qui l'affiche : plus de `flash(i.removeFailed)`, retirer `removeFailed` de `fr-components.ts` s'il n'a plus d'usage) ;
- entrées : après l'entrée `notesDir`, `{schema && (<DropdownMenuItem onSelect={() => setSettings(true)}><Settings2 aria-hidden />{i.settings}</DropdownMenuItem>)}` ; la condition du séparateur ajoute `|| schema` ; l'entrée destructive appelle `() => setRemoving(true)` et affiche `i.remove` (« Retirer de la page… ») ;
- rendu, après `NotesDirDialog` :
```tsx
      {settings && schema && (
        <InstanceSettingsDialog projectId={projectId} instance={instance} title={title} schema={schema} onClose={() => setSettings(false)} />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(false)}
          title={i.removeTitle(title)}
          description={i.removeHelp}
          confirmLabel={i.removeConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={remove}
          describeError={errorMessage}
        />
      )}
```
(`errorMessage` de `../lib/error-message`.)

`bundle-report.ts` › `FORBIDDEN_IN_ENTRY` : `/\/packages\/ui\/src\/(dialogs\/InstanceSettingsDialog\.tsx|i18n\/fr-widgets\.ts)$/,`.

Run: `bun test packages/ui/src/pages packages/ui/src/dialogs packages/ui/src/lib` — Expected: PASS.

- [x] **Step 5: Gate, budget, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; `config-form.ts` entre dans l'entrée (moins de 1 kB) ; noter la valeur.

```bash
git add packages/ui/src/lib/config-form.ts packages/ui/src/lib/config-form.test.ts packages/ui/src/i18n/fr-widgets.ts
git commit -m "feat(ui): formulaire de réglages depuis configSchema"
git add packages/ui/src/dialogs/InstanceSettingsDialog.tsx packages/ui/src/dialogs/instance-settings.test.tsx packages/ui/src/shell/lazy-dialogs.ts packages/ui/src/pages/InstanceMenu.tsx packages/ui/src/pages/instance.test.tsx packages/ui/src/i18n/fr-components.ts packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): réglages d'un widget et retrait confirmé"
```

### Task 9: Domaines : renommer, couleur, confirmations

Vague 1 ← T2. Écran 106. L'en-tête « Domaine · Core » sort de `DomainsPage` dans `DomainHeader` : nom éditable en place (crayon, Entrée / Échap), pastille de couleur qui ouvre la palette des sept `DOMAIN_COLORS`, corbeille. `updateDomain` est une `ConfigCommand` de portée workspace (colonne « Réel ») : `client.rpc({ method: "config", command: { method: "updateDomain", domainId, patch } })` ; un nom en doublon (insensible à la casse) est refusé `INVALID_INPUT` et affiché « Un domaine porte déjà ce nom. ». Supprimer un domaine ou un fichier de guidelines passe par `ConfirmDialog` ; le refus « domaine utilisé » reste affiché **avant** toute confirmation.

**Files:**
- Create: `packages/ui/src/settings/DomainHeader.tsx`, `packages/ui/src/settings/domain-header.test.tsx`
- Modify: `packages/ui/src/settings/DomainsPage.tsx`, `packages/ui/src/settings/domains-page.test.tsx` (deux tests existants passent par la confirmation ; deux tests ajoutés), `packages/ui/src/i18n/fr.ts` › `domains`

**Interfaces:**
- Consumes: `DOMAIN_COLORS`, `Domain` (`@kibo/schema`), `ConfirmDialog` (T2), `DropdownMenu*`, `Input`, `Button`.
- Produces: `DomainHeader` props `{ domain: Domain; usage: number; onRename(name: string): Promise<boolean>; onColor(color: string): Promise<boolean>; onDelete(): void }`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr.ts` › `domains`, ajouter :
```ts
    rename: (name: string) => `Renommer le domaine ${name}`,
    renameField: "Nouveau nom",
    renameHint: "Entrée pour enregistrer · Échap pour annuler",
    duplicate: "Un domaine porte déjà ce nom.",
    pickColor: (name: string) => `Couleur du domaine ${name}`,
    colorOption: (color: string) => `Couleur ${color}`,
    deleteTitle: (name: string) => `Supprimer le domaine ${name} ?`,
    deleteHelp: (files: number) =>
      files === 0
        ? "Aucun fichier de guidelines n'est concerné. Cette action est irréversible."
        : `Ses ${files} fichier${files > 1 ? "s" : ""} de guidelines seront supprimés. Cette action est irréversible.`,
    removeFileTitle: (path: string) => `Supprimer ${path} ?`,
    removeFileHelp: "Le fichier de guidelines disparaît du workspace. Cette action est irréversible.",
```

- [x] **Step 2: `DomainHeader` (test rouge puis vert)**

`packages/ui/src/settings/domain-header.test.tsx` :
```tsx
import { expect, mock, test } from "bun:test";
import { DOMAIN_COLORS } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DomainHeader } from "./DomainHeader";

const core = { id: "core", name: "Core", color: "#14B8A6" };
const show = (onRename = mock((_n: string) => Promise.resolve(true))) => {
  const onColor = mock((_c: string) => Promise.resolve(true));
  const onDelete = mock(() => {});
  render(<DomainHeader domain={core} usage={9} onRename={onRename} onColor={onColor} onDelete={onDelete} />);
  return { onRename, onColor, onDelete, user: userEvent.setup() };
};

test("the pencil opens an inline field; Enter renames, Escape cancels", async () => {
  const { user, onRename } = show();
  expect(screen.getByRole("heading", { name: "Domaine · Core" })).toBeTruthy();
  expect(screen.getByText("utilisé par 9 tickets")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  const field = screen.getByRole("textbox", { name: "Nouveau nom" });
  expect((field as HTMLInputElement).value).toBe("Core");
  await user.clear(field);
  await user.type(field, "Noyau{Enter}");
  expect(onRename).toHaveBeenCalledWith("Noyau");
  await screen.findByRole("heading", { name: "Domaine · Core" });
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(onRename).toHaveBeenCalledTimes(1);
});

test("a refused rename keeps the field open", async () => {
  const { user } = show(mock((_n: string) => Promise.resolve(false)));
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau nom" }), "{Enter}");
  expect(screen.getByRole("textbox", { name: "Nouveau nom" })).toBeTruthy();
});

test("the swatch opens the seven palette colors and picks one", async () => {
  const { user, onColor } = show();
  await user.click(screen.getByRole("button", { name: "Couleur du domaine Core" }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.getAttribute("aria-label"))).toEqual(DOMAIN_COLORS.map((c) => `Couleur ${c}`));
  await user.click(items[1] as HTMLElement);
  expect(onColor).toHaveBeenCalledWith("#6366F1");
});

test("the trash asks the page to delete", async () => {
  const { user, onDelete } = show();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Core" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
```
Run: `bun test packages/ui/src/settings/domain-header.test.tsx` — Expected: FAIL.

`packages/ui/src/settings/DomainHeader.tsx` :
```tsx
import { DOMAIN_COLORS, type Domain } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { fr } from "../i18n/fr";

type Props = {
  domain: Domain;
  usage: number;
  onRename(name: string): Promise<boolean>;
  onColor(color: string): Promise<boolean>;
  onDelete(): void;
};

export function DomainHeader({ domain, usage, onRename, onColor, onDelete }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    if (await onRename(draft.trim())) setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void save();
    if (e.key === "Escape") setDraft(null);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={fr.domains.pickColor(domain.name)}
            className="size-3 rounded-[3px] ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: domain.color }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="grid grid-cols-4 gap-1 p-2">
          {DOMAIN_COLORS.map((color) => (
            <DropdownMenuItem
              key={color}
              aria-label={fr.domains.colorOption(color)}
              className="size-7 justify-center p-0"
              onSelect={() => void onColor(color)}
            >
              <span aria-hidden className="size-4 rounded-[3px]" style={{ background: color }} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {draft === null ? (
        <>
          <h2 className="text-md font-semibold">{fr.domains.domainTitle(domain.name)}</h2>
          <Button size="icon" variant="ghost" className="size-6" aria-label={fr.domains.rename(domain.name)} onClick={() => setDraft(domain.name)}>
            <Pencil className="size-3.5" />
          </Button>
        </>
      ) : (
        <span className="grid gap-0.5">
          <Input
            aria-label={fr.domains.renameField}
            value={draft}
            autoFocus
            className="h-7 w-56"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="text-3xs text-muted-foreground">{fr.domains.renameHint}</span>
        </span>
      )}
      <span className="text-xs text-muted-foreground">{fr.domains.usedBy(usage)}</span>
      <span className="flex-1" />
      <Button size="icon" variant="ghost" className="size-7" aria-label={fr.domains.deleteDomain(domain.name)} onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </>
  );
}
```
Run: `bun test packages/ui/src/settings/domain-header.test.tsx` — Expected: PASS, 4 tests.

- [x] **Step 3: La page (tests d'abord)**

`packages/ui/src/settings/domains-page.test.tsx` :
- test « editing a file saves its new content, removing it asks the daemon » : après le clic sur « Supprimer le fichier », ajouter
```tsx
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer guidelines/core.md ?" });
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
```
avant l'assertion sur `calls` (inchangée).
- test « domains are created with the next palette color, and a used domain is never deleted » : après le clic sur « Supprimer le domaine Facturation », ajouter
```tsx
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer le domaine Facturation ?" });
  expect(confirm.textContent).toContain("de guidelines seront supprimés.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
```
(le domaine Core, utilisé, montre toujours l'alerte sans dialogue : `expect(screen.queryByRole("alertdialog")).toBeNull()` juste après l'assertion « Ce domaine est utilisé par des tickets. » ; adapter le texte attendu au nombre de fichiers de Facturation dans `configFixture()` : s'il n'en a aucun, attendre « Aucun fichier de guidelines n'est concerné. »).
- ajouter :
```tsx
test("renaming a domain sends updateDomain; a duplicate name is explained", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  const field = screen.getByRole("textbox", { name: "Nouveau nom" });
  await user.clear(field);
  await user.type(field, "Noyau{Enter}");
  expect(calls).toEqual([{ method: "config", command: { method: "updateDomain", domainId: "core", patch: { name: "Noyau" } } }]);
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "domain name already used"));
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.clear(screen.getByRole("textbox", { name: "Nouveau nom" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau nom" }), "Agents{Enter}");
  expect((await screen.findByRole("alert")).textContent).toBe("Un domaine porte déjà ce nom.");
  expect(screen.getByRole("textbox", { name: "Nouveau nom" })).toBeTruthy();
});

test("picking a color sends updateDomain with the color", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Couleur du domaine Core" }));
  await user.click(await screen.findByRole("menuitem", { name: "Couleur #EC4899" }));
  expect(calls).toEqual([{ method: "config", command: { method: "updateDomain", domainId: "core", patch: { color: "#EC4899" } } }]);
});
```
(`waitFor` importé de Testing Library.)

Run: `bun test packages/ui/src/settings/domains-page.test.tsx` — Expected: FAIL (4 tests).

- [x] **Step 4: La page**

`packages/ui/src/settings/DomainsPage.tsx` :
- imports : `DomainHeader` (`./DomainHeader`), `ConfirmDialog` (`../shell/lazy-dialogs`), `KiboError` (`@kibo/schema`), `errorMessage` (`../lib/error-message`) ; `Trash2` et `Button` restent si utilisés ailleurs, sinon retirer ;
- état : `const [confirming, setConfirming] = useState<{ kind: "domain" } | { kind: "file"; path: string; guidelineId: string } | null>(null);`
- `send` garde son comportement ; ajouter
```tsx
  const updateDomain = async (patch: { name?: string; color?: string }): Promise<boolean> => {
    if (!domain) return false;
    setError(null);
    try {
      await client.rpc({ method: "config", command: { method: "updateDomain", domainId: domain.id, patch } });
      return true;
    } catch (e) {
      setError(e instanceof KiboError && e.code === "INVALID_INPUT" ? fr.domains.duplicate : fr.domains.failed);
      return false;
    }
  };
```
- `removeFile` devient `() => selected && setConfirming({ kind: "file", path: selected.path, guidelineId: selected.id })` ; la suppression effective :
```tsx
  const confirmRemoveFile = async (guidelineId: string) => {
    if (!owner) return;
    await client.rpc({ method: "config", command: { method: "removeGuideline", owner, guidelineId } });
  };
```
- `deleteDomain` devient : si utilisé ⇒ `setError(fr.domains.inUse)` (inchangé), sinon `setConfirming({ kind: "domain" })` ; la suppression effective :
```tsx
  const confirmDeleteDomain = async () => {
    if (!domain) return;
    await client.rpc({ method: "config", command: { method: "deleteDomain", domainId: domain.id } });
    pick({ kind: "workspace" });
  };
```
- dans le `<header>`, remplacer la pastille, le `<h2>`, `usedBy`, le `flex-1` et la corbeille par
```tsx
                {domain ? (
                  <DomainHeader
                    domain={domain}
                    usage={config.domainUsage[domain.id] ?? 0}
                    onRename={(name) => updateDomain({ name })}
                    onColor={(color) => updateDomain({ color })}
                    onDelete={() => void deleteDomain()}
                  />
                ) : (
                  <>
                    <h2 className="text-md font-semibold">{title}</h2>
                    <span className="flex-1" />
                  </>
                )}
```
- avant la fermeture du composant, les confirmations :
```tsx
      {confirming?.kind === "domain" && domain && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(null)}
          title={fr.domains.deleteTitle(domain.name)}
          description={fr.domains.deleteHelp(files.length)}
          confirmLabel={fr.common.delete}
          cancelLabel={fr.common.cancel}
          onConfirm={confirmDeleteDomain}
          describeError={errorMessage}
        />
      )}
      {confirming?.kind === "file" && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(null)}
          title={fr.domains.removeFileTitle(confirming.path)}
          description={fr.domains.removeFileHelp}
          confirmLabel={fr.common.delete}
          cancelLabel={fr.common.cancel}
          onConfirm={() => confirmRemoveFile(confirming.guidelineId)}
          describeError={errorMessage}
        />
      )}
```
(Le `<div className="grid min-h-full …">` racine devient un fragment `<>…</>` autour du `div` et des dialogues, ou les dialogues sont placés dans le `div` : ils sont rendus en portail.) Si `DomainsPage.tsx` dépasse ~300 lignes, extraire `confirmDeleteDomain`/`confirmRemoveFile` et les deux `ConfirmDialog` dans `settings/DomainConfirmations.tsx` (props : `confirming`, `domain`, `files`, `onClose`, `onDeleteDomain`, `onRemoveFile`).

Run: `bun test packages/ui/src/settings` — Expected: PASS.

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui/src/settings && bun run budget`
Expected: PASS ; budget inchangé (`DomainsPage` est déjà hors de l'entrée).

```bash
git add packages/ui/src/settings/DomainHeader.tsx packages/ui/src/settings/domain-header.test.tsx packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): en-tête de domaine, nom et couleur"
git add packages/ui/src/settings/DomainsPage.tsx packages/ui/src/settings/domains-page.test.tsx
git commit -m "feat(ui): confirmations des suppressions de domaine"
```
(Ajouter `packages/ui/src/settings/DomainConfirmations.tsx` au second commit si l'extraction a eu lieu.)

### Task 10: Arbre Tickets : menu, statut, parent, suppression

Vague 1 ← T2. Décision 9, écrans 102 et 99, spec §12.4 (menu **ticket**). Le composant intégré **tickets** déclare enfin `writes: ["ticket"]` (sans quoi `sdk.run` répond `PERMISSION_DENIED`) et gagne un menu par ligne (clic droit et « ⋯ » au survol, même liste `MenuEntry[]`), un sous-menu Statut (« Bloqué… » ouvre `ReasonDialog`), « Nouveau sous-ticket », « Déplacer à la racine », « Supprimer… » confirmé, et le glisser-déposer de **reparentage** (déposer sur une ligne ⇒ sous-ticket). Tout passe par `sdk.run(cmd)` et le SDK simulé (`m.snapshot()` après chaque action). La conformité ne vérifie que les permissions utilisées sans être déclarées (`diffPermissions().missing`) : le manifeste élargi reste conforme.

**Files:**
- Modify: `components/tickets/kibo.component.json` (`"writes": ["ticket"]`), `components/tickets/package.json` (`"@dnd-kit/core": "6.3.1"` dans `dependencies`), `bun.lock` (mis à jour par `bun install`, sans téléchargement : la version est déjà présente)
- Create: `components/tickets/src/ticket-menu.ts`, `components/tickets/src/ticket-menu.test.ts`, `components/tickets/src/tree-drop.ts`, `components/tickets/src/tree-drop.test.ts`, `components/tickets/src/TicketRowMenu.tsx`
- Modify: `components/tickets/src/TicketsTree.tsx`, `components/tickets/src/fr.ts`, `components/tickets/src/tickets.test.tsx`

**Interfaces:**
- Consumes: `ContextMenuEntries`, `DropdownMenuEntries`, `MenuEntry` (`@kibo/sdk/ui/menu-entries`, T2), `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`, T2), `ReasonDialog` (`@kibo/sdk/ui/reason-dialog`, T2), `useReadOnly`, `useSdk`, `useEntities` (`@kibo/sdk`), `@dnd-kit/core`.
- Produces: Contrats partagés › Composants › `ticket-menu.ts` ; `reparentOnDrop(tickets, activeId, overId): { ticketId: string; parentId: string } | null`.

- [x] **Step 1: Manifeste, dépendance, textes**

`components/tickets/kibo.component.json` : `"writes": ["ticket"]`. `components/tickets/package.json` › `dependencies` : `"@dnd-kit/core": "6.3.1"` (la version de `packages/ui`, figée dans `bun.lock`).

Run: `bun install && git status --short bun.lock` — Expected: `bun.lock` modifié (lien du workspace), aucun paquet nouveau téléchargé.

`components/tickets/src/fr.ts`, ajouter :
```ts
  actions: (key: string) => `Actions ${key}`,
  open: "Ouvrir",
  status: "Statut",
  newSub: "Nouveau sous-ticket",
  moveToRoot: "Déplacer à la racine",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${children > 1 ? "s" : ""} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  cancel: "Annuler",
  statusFailed: (key: string) => `Impossible de changer le statut de ${key}.`,
  moveFailed: (key: string) => `Impossible de déplacer ${key}.`,
  cycle: "Un ticket ne peut pas devenir le sous-ticket de l'un de ses sous-tickets.",
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    cancel: "Annuler",
    confirm: "Bloquer",
  },
```

- [x] **Step 2: Menu et dépôt en données (tests rouges puis verts)**

`components/tickets/src/ticket-menu.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type TicketView } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { fr } from "./fr";
import { type TicketMenuActions, ticketMenuEntries } from "./ticket-menu";

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "27@1",
  key: "KIB-27",
  pendingSeq: null,
  keyLabel: "KIB-27",
  title: "Récepteur",
  description: "",
  statusId: "in_progress",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: "12@1",
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  ...patch,
});
const actions = (): TicketMenuActions => ({
  open: mock(() => {}),
  setStatus: mock((_s: string) => {}),
  newSubTicket: mock(() => {}),
  moveToRoot: mock(() => {}),
  remove: mock(() => {}),
});
const labels = (entries: ReturnType<typeof ticketMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable ticket gets open, status submenu, new sub-ticket, move to root, delete", () => {
  const a = actions();
  const entries = ticketMenuEntries({ ticket: ticket(), statuses: DEFAULT_WORKFLOW, readOnly: false, texts: fr, actions: a });
  expect(labels(entries)).toEqual(["Ouvrir", "Statut ▸", "Nouveau sous-ticket", "Déplacer à la racine", "—", "Supprimer…"]);
  const status = entries.find(isSubmenu);
  expect(status?.items.map((i) => [i.label, i.disabled ?? false])).toEqual([
    ["Backlog", false],
    ["À faire", false],
    ["En cours", true],
    ["En review", false],
    ["Bloqué…", false],
    ["Terminé", false],
  ]);
  status?.items[5]?.onSelect();
  expect(a.setStatus).toHaveBeenCalledWith("done");
  status?.items[4]?.onSelect();
  expect(a.setStatus).toHaveBeenCalledWith("blocked");
});

test("a root ticket cannot be moved to the root", () => {
  const entries = ticketMenuEntries({ ticket: ticket({ parentId: null }), statuses: DEFAULT_WORKFLOW, readOnly: false, texts: fr, actions: actions() });
  const root = entries.find((e) => !isSeparator(e) && !isSubmenu(e) && e.label === "Déplacer à la racine");
  expect(root && !isSeparator(root) && !isSubmenu(root) && root.disabled).toBe(true);
});

test("read-only keeps only Ouvrir", () => {
  const entries = ticketMenuEntries({ ticket: ticket(), statuses: DEFAULT_WORKFLOW, readOnly: true, texts: fr, actions: actions() });
  expect(labels(entries)).toEqual(["Ouvrir"]);
});
```
`components/tickets/src/tree-drop.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { reparentOnDrop } from "./tree-drop";

const t = (id: string, parentId: string | null) => ({ id, parentId }) as TicketView;
const tickets = [t("a", null), t("b", "a"), t("c", "b"), t("d", null)];

test("dropping on another ticket reparents under it", () => {
  expect(reparentOnDrop(tickets, "d", "b")).toEqual({ ticketId: "d", parentId: "b" });
});

test("dropping on itself, on its parent or on a descendant does nothing", () => {
  expect(reparentOnDrop(tickets, "b", "b")).toBeNull();
  expect(reparentOnDrop(tickets, "b", "a")).toBeNull();
  expect(reparentOnDrop(tickets, "a", "c")).toBeNull();
  expect(reparentOnDrop(tickets, "a", "zz")).toBeNull();
});
```
(`as TicketView` : fixture partielle d'un test, seuls `id` et `parentId` sont lus.)

Run: `bun test components/tickets/src/ticket-menu.test.ts components/tickets/src/tree-drop.test.ts` — Expected: FAIL.

`components/tickets/src/ticket-menu.ts` :
```ts
import type { Status, StatusId, TicketView } from "@kibo/schema";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { CornerLeftUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type TicketMenuActions = {
  open(): void;
  setStatus(statusId: StatusId): void;
  newSubTicket(): void;
  moveToRoot(): void;
  remove(): void;
};

export function ticketMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  readOnly: boolean;
  texts: typeof fr;
  actions: TicketMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, readOnly, texts, actions } = input;
  const open: MenuAction = { label: texts.open, icon: ExternalLink, onSelect: actions.open };
  if (readOnly) return [open];
  const items: MenuAction[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      label: s.id === "blocked" ? `${s.label}…` : s.label,
      disabled: s.id === ticket.statusId,
      onSelect: () => actions.setStatus(s.id),
    }));
  return [
    open,
    { label: texts.status, items },
    { label: texts.newSub, icon: Plus, onSelect: actions.newSubTicket },
    { label: texts.moveToRoot, icon: CornerLeftUp, disabled: ticket.parentId === null, onSelect: actions.moveToRoot },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}

export const descendantCount = (tickets: readonly TicketView[], id: string): number =>
  tickets.filter((t) => t.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);
```
`components/tickets/src/tree-drop.ts` :
```ts
import type { TicketView } from "@kibo/schema";

const isDescendant = (tickets: readonly TicketView[], id: string, ancestorId: string): boolean => {
  let current = tickets.find((t) => t.id === id)?.parentId ?? null;
  while (current !== null) {
    if (current === ancestorId) return true;
    current = tickets.find((t) => t.id === current)?.parentId ?? null;
  }
  return false;
};

export function reparentOnDrop(
  tickets: readonly TicketView[],
  activeId: string,
  overId: string,
): { ticketId: string; parentId: string } | null {
  const active = tickets.find((t) => t.id === activeId);
  const over = tickets.find((t) => t.id === overId);
  if (!active || !over || activeId === overId) return null;
  if (active.parentId === overId) return null;
  if (isDescendant(tickets, overId, activeId)) return null;
  return { ticketId: activeId, parentId: overId };
}
```
Run: `bun test components/tickets/src/ticket-menu.test.ts components/tickets/src/tree-drop.test.ts` — Expected: PASS, 5 tests.

- [x] **Step 3: Tests de l'arbre (rouges)**

`components/tickets/src/tickets.test.tsx`, ajouter (`userEvent` et `within`, `waitFor` importés ; `SdkProvider`, `createMockSdk` déjà là) :
```tsx
const mount = (m: ReturnType<typeof createMockSdk>) =>
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
const byKey = (m: ReturnType<typeof createMockSdk>, key: string) => m.snapshot().tickets.find((t) => t.key === key);

test("the row menu changes the status; Bloqué asks for a reason", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.pointer({ keys: "[MouseRight]", target: await screen.findByRole("button", { name: /Arbre des pages/ }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir",
    "Statut",
    "Nouveau sous-ticket",
    "Déplacer à la racine",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Statut" }));
  await user.click(await screen.findByRole("menuitem", { name: "Terminé" }));
  await waitFor(() => expect(byKey(m, "KIB-1")?.statusId).toBe("done"));
  await user.click(screen.getByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Statut" }));
  await user.click(await screen.findByRole("menuitem", { name: "Bloqué…" }));
  const dialog = await screen.findByRole("dialog", { name: "Bloquer KIB-1" });
  await user.type(within(dialog).getByLabelText("Motif"), "Attente client");
  await user.click(within(dialog).getByRole("button", { name: "Bloquer" }));
  await waitFor(() => expect(byKey(m, "KIB-1")).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" }));
});

test("new sub-ticket asks the host, move to root reparents, delete asks then removes the subtree", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Nouveau sous-ticket" }));
  expect(m.newTicketRequests.at(-1)?.parentId).toBe(byKey(m, "KIB-2")?.id);
  await user.click(screen.getByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer à la racine" }));
  await waitFor(() => expect(byKey(m, "KIB-2")?.parentId).toBeNull());
  await user.click(screen.getByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer KIB-1 ?" });
  expect(confirm.textContent).toContain("Ses liens seront supprimés aussi. Cette action est irréversible.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(byKey(m, "KIB-1")).toBeUndefined());
  expect(byKey(m, "KIB-2")).toBeDefined();
});

test("a refused command is shown as an alert", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={{ ...m.sdk, run: () => Promise.reject(new Error("daemon unreachable")) }}>
      <Component />
    </SdkProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await user.click(await screen.findByRole("menuitem", { name: "Statut" }));
  await user.click(await screen.findByRole("menuitem", { name: "Terminé" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de changer le statut de KIB-3.");
});

test("a read-only project shows no ⋯ button and a one-entry menu", async () => {
  const m = createMockSdk(manifest, { seed, shared: true });
  m.setAccess("read-only");
  mount(m);
  const user = userEvent.setup();
  await screen.findByText("KIB-1");
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions / })).toBeNull());
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: /Arbre des pages/ }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir"]);
});
```
(Dans le seed, KIB-2 « Déplacement » est le sous-ticket de KIB-1, KIB-3 « Sync » est bloqué. Le premier test utilise « Terminé » sur KIB-1 puis le bloque : l'ordre des assertions suit.)

Run: `bun test components/tickets/src/tickets.test.tsx` — Expected: FAIL (4 tests).

- [x] **Step 4: `TicketRowMenu` et l'arbre**

`components/tickets/src/TicketRowMenu.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

type Props = { entries: MenuEntry[]; label: string; readOnly: boolean; children: ReactNode };

export function TicketRowMenu({ entries, label, readOnly, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TicketRowActions({ entries, label, readOnly }: Omit<Props, "children">) {
  if (readOnly) return <span className="size-6" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100" aria-label={label}>
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
(`TicketRowMenu` ignore `label` et `readOnly` : les retirer de ses props et ne les garder que sur `TicketRowActions` ; un seul fichier pour les deux, ils vont ensemble.)

`components/tickets/src/TicketsTree.tsx` :
- imports : `DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors` (`@dnd-kit/core`), `useReadOnly` (`@kibo/sdk`), `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`), `ReasonDialog` (`@kibo/sdk/ui/reason-dialog`), `descendantCount, ticketMenuEntries` (`./ticket-menu`), `reparentOnDrop` (`./tree-drop`), `TicketRowActions, TicketRowMenu` (`./TicketRowMenu`), `type StatusId` ;
- `COLUMNS` : la dernière colonne passe de `2rem` à `4rem` (deux boutons : « + » et « ⋯ ») dans les deux variantes ;
- état : `const readOnly = useReadOnly(); const [blocking, setBlocking] = useState<TicketView | null>(null); const [removing, setRemoving] = useState<TicketView | null>(null); const [error, setError] = useState<string | null>(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));`
- commandes :
```tsx
  const attempt = async (cmd: ProjectCommand, failure: string): Promise<boolean> => {
    try {
      await sdk.run(cmd);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof KiboError && e.code === "TREE_CYCLE" ? fr.cycle : failure);
      return false;
    }
  };
  const setStatus = (t: TicketView, statusId: StatusId) => {
    if (statusId === "blocked") setBlocking(t);
    else void attempt({ method: "setStatus", ticketId: t.id, statusId }, fr.statusFailed(t.keyLabel));
  };
  const entriesFor = (t: TicketView) =>
    ticketMenuEntries({
      ticket: t,
      statuses,
      readOnly,
      texts: fr,
      actions: {
        open: () => sdk.openTicket(t.id),
        setStatus: (statusId) => setStatus(t, statusId),
        newSubTicket: () => sdk.openNewTicket({ parentId: t.id }),
        moveToRoot: () => void attempt({ method: "moveTicket", ticketId: t.id, parentId: null }, fr.moveFailed(t.keyLabel)),
        remove: () => setRemoving(t),
      },
    });
  const onDragEnd = (e: DragEndEvent) => {
    if (readOnly || e.over === null) return;
    const drop = reparentOnDrop(all, String(e.active.id), String(e.over.id));
    if (drop) void attempt({ method: "moveTicket", ...drop }, fr.moveFailed(all.find((t) => t.id === drop.ticketId)?.keyLabel ?? ""));
  };
```
(`ProjectCommand`, `KiboError` importés de `@kibo/schema`.)
- la ligne : le `<div className={cn(COLUMNS, "group …")}>` est enveloppé par `<TicketRowMenu entries={entriesFor(t)}>` ; il reçoit `ref={setNodeRef}` d'un `useDroppable({ id: t.id, disabled: readOnly })` et la classe `isOver && "ring-2 ring-ring"` ; la `TicketKeyLabel` est enveloppée d'un `<span ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} aria-describedby={undefined}>` avec `useDraggable({ id: t.id, disabled: readOnly })` (poignée : la clé, comme le Kanban). Comme les hooks ne peuvent pas être appelés dans `row`, extraire la ligne en composant `TicketRow` (props : `node`, `open`, `entries`, `readOnly`, `runOf`, `members`, `label`, `onToggle`) dans le même fichier ou dans `TicketRow.tsx` si `TicketsTree.tsx` dépasse ~300 lignes ;
- la dernière cellule devient `<span className="flex items-center justify-end gap-0.5">{!readOnly && <Button … aria-label={fr.newSubTicket(t.keyLabel)} …><Plus /></Button>}<TicketRowActions entries={entries} label={fr.actions(t.keyLabel)} readOnly={readOnly} /></span>` ;
- le bouton « Nouveau ticket » de l'en-tête est masqué en lecture seule ;
- rendu : `<DndContext sensors={sensors} onDragEnd={onDragEnd}>` autour de la liste ; sous l'en-tête `{error && <p role="alert" className="px-3 py-1 text-xs text-destructive">{error}</p>}` ; en fin de section :
```tsx
      {blocking && (
        <ReasonDialog
          open
          title={fr.block.title(blocking.keyLabel)}
          description={fr.block.description}
          label={fr.block.reason}
          placeholder={fr.block.placeholder}
          confirmLabel={fr.block.confirm}
          cancelLabel={fr.block.cancel}
          error={error}
          onConfirm={(reason) =>
            void attempt({ method: "setStatus", ticketId: blocking.id, statusId: "blocked", reason }, fr.statusFailed(blocking.keyLabel)).then(
              (ok) => ok && setBlocking(null),
            )
          }
          onCancel={() => setBlocking(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.keyLabel)}
          description={fr.removeHelp(descendantCount(all, removing.id))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={async () => {
            await sdk.run({ method: "deleteTicket", ticketId: removing.id });
          }}
        />
      )}
```
(`all` est la liste complète `useEntities("ticket").data`, avant filtres, pour compter les descendants et vérifier les cycles.)

Run: `bun test components/tickets` — Expected: PASS (conformité comprise : le manifeste déclare `write:ticket`, les rendus n'écrivent rien, `missing` reste vide).

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test components/tickets packages/sdk && bun run budget`
Expected: PASS ; le composant tickets est chargé à la demande : budget inchangé. Vérifier à la main dans l'app (`bun run start`) qu'un glisser d'une clé de ticket sur une autre ligne fait un sous-ticket, et qu'un clic simple sur le titre ouvre toujours la fiche.

```bash
git add components/tickets/kibo.component.json components/tickets/package.json bun.lock components/tickets/src/fr.ts components/tickets/src/ticket-menu.ts components/tickets/src/ticket-menu.test.ts components/tickets/src/tree-drop.ts components/tickets/src/tree-drop.test.ts
git commit -m "feat(tickets): écriture déclarée et menu en données"
git add components/tickets/src/TicketRowMenu.tsx components/tickets/src/TicketsTree.tsx components/tickets/src/tickets.test.tsx
git commit -m "feat(tickets): menu, statut, parent et suppression"
```
(Ajouter `components/tickets/src/TicketRow.tsx` au second commit si la ligne a été extraite.)

### Task 11: Kanban : clic droit et suppression

Vague 1 ← T2. Décision 9 (« Le Kanban gagne le clic droit et « Supprimer… », rien d'autre »), écran 99, spec §12.4. La carte garde sa poignée (la clé) et son bouton « ⋯ » ; le menu devient une liste `MenuEntry[]` partagée par le clic droit et le « ⋯ » : Ouvrir, Déplacer vers ▸ (statuts autres que le courant, « Bloqué… »), séparateur, Supprimer… confirmé. Le manifeste déclare déjà `writes: ["ticket"]`. Les deux tests existants qui passent par le « ⋯ » traversent désormais le sous-menu « Déplacer vers ».

**Files:**
- Create: `components/kanban/src/card-menu.ts`, `components/kanban/src/card-menu.test.ts`
- Modify: `components/kanban/src/KanbanCard.tsx`, `components/kanban/src/Kanban.tsx`, `components/kanban/src/fr.ts`, `components/kanban/src/kanban.test.tsx`

**Interfaces:**
- Consumes: `ContextMenuEntries`, `DropdownMenuEntries`, `MenuEntry` (T2), `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`, T2), `BlockDialog` (habillage de `ReasonDialog`, T2).
- Produces: Contrats partagés › Composants › `card-menu.ts` ; `KanbanCard` props `+ onRemove(): void`.

- [x] **Step 1: Textes**

`components/kanban/src/fr.ts`, ajouter :
```ts
  open: "Ouvrir",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${children > 1 ? "s" : ""} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  cancel: "Annuler",
```

- [x] **Step 2: Le menu en données (test rouge puis vert)**

`components/kanban/src/card-menu.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type TicketView } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { type CardMenuActions, cardMenuEntries } from "./card-menu";
import { fr } from "./fr";

const ticket = {
  id: "1@1",
  key: "KIB-1",
  pendingSeq: null,
  keyLabel: "KIB-1",
  title: "Arbre",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
} satisfies TicketView;
const actions = (): CardMenuActions => ({ open: mock(() => {}), move: mock((_s: string) => {}), remove: mock(() => {}) });
const labels = (entries: ReturnType<typeof cardMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an editable card offers open, move to the other statuses, delete", () => {
  const a = actions();
  const entries = cardMenuEntries({ ticket, statuses: DEFAULT_WORKFLOW, readOnly: false, texts: fr, actions: a });
  expect(labels(entries)).toEqual(["Ouvrir", "Déplacer vers ▸", "—", "Supprimer…"]);
  const move = entries.find(isSubmenu);
  expect(move?.items.map((i) => i.label)).toEqual(["Backlog", "En cours", "En review", "Bloqué…", "Terminé"]);
  move?.items[3]?.onSelect();
  expect(a.move).toHaveBeenCalledWith("blocked");
});

test("read-only keeps only Ouvrir", () => {
  expect(labels(cardMenuEntries({ ticket, statuses: DEFAULT_WORKFLOW, readOnly: true, texts: fr, actions: actions() }))).toEqual(["Ouvrir"]);
});
```
Run: `bun test components/kanban/src/card-menu.test.ts` — Expected: FAIL.

`components/kanban/src/card-menu.ts` :
```ts
import type { Status, StatusId, TicketView } from "@kibo/schema";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ExternalLink, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type CardMenuActions = { open(): void; move(statusId: StatusId): void; remove(): void };

export function cardMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  readOnly: boolean;
  texts: typeof fr;
  actions: CardMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, readOnly, texts, actions } = input;
  const open: MenuAction = { label: texts.open, icon: ExternalLink, onSelect: actions.open };
  if (readOnly) return [open];
  const targets: MenuAction[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .filter((s) => s.id !== ticket.statusId)
    .map((s) => ({ label: s.id === "blocked" ? `${s.label}…` : s.label, onSelect: () => actions.move(s.id) }));
  return [
    open,
    { label: texts.moveTo, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
```
Run: `bun test components/kanban/src/card-menu.test.ts` — Expected: PASS.

- [x] **Step 3: Tests du tableau (mis à jour puis ajoutés)**

`components/kanban/src/kanban.test.tsx` :
- « moving a card changes its status » et « a failed move shows an alert and keeps the status » : entre le clic sur « Actions KIB-1 » et celui sur « En cours », insérer `await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));`
- « blocking asks for a reason and refuses an empty one » et « a failed block keeps the dialog open… » : même insertion, et le libellé cliqué devient `"Bloqué…"`.
- ajouter :
```tsx
test("right click opens the same menu as ⋯; delete asks then removes the card", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.pointer({ keys: "[MouseRight]", target: await screen.findByRole("button", { name: "Arbre des pages" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir", "Déplacer vers", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer KIB-1 ?" });
  expect(confirm.textContent).toContain("Ses liens seront supprimés aussi. Cette action est irréversible.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")).toBeUndefined());
  await waitFor(() => expect(screen.queryByRole("button", { name: "Arbre des pages" })).toBeNull());
  expect(m.snapshot().links).toEqual([]);
});

test("Ouvrir from the menu opens the ticket in the host", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Ouvrir" }));
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-2")?.id]);
});
```
- « cards cannot be moved in a read-only project » : ajouter à la fin
```tsx
  await userEvent.setup().pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Lecture" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir"]);
```
(Le seed relie KIB-1 → KIB-2 par `blocks` : supprimer KIB-1 retire le lien, d'où `links` vide.)

Run: `bun test components/kanban/src/kanban.test.tsx` — Expected: FAIL (sous-menu absent, pas de clic droit).

- [x] **Step 4: Carte et tableau**

`components/kanban/src/KanbanCard.tsx` :
- props `+ onRemove: () => void` ; imports : `ContextMenu, ContextMenuContent, ContextMenuTrigger` (`@kibo/sdk/ui/context-menu`), `ContextMenuEntries, DropdownMenuEntries` (`@kibo/sdk/ui/menu-entries`), `cardMenuEntries` (`./card-menu`) ; retirer `DropdownMenuItem`, `DropdownMenuLabel` ;
- `const entries = cardMenuEntries({ ticket: t, statuses, readOnly, texts: fr, actions: { open: onOpen, move: onMove, remove: onRemove } });`
- l'`<article>` est enveloppé : `<ContextMenu><ContextMenuTrigger asChild><article …>…</article></ContextMenuTrigger><ContextMenuContent><ContextMenuEntries entries={entries} /></ContextMenuContent></ContextMenu>` ;
- le `DropdownMenuContent` du « ⋯ » ne contient plus que `<DropdownMenuEntries entries={entries} />` (le bouton reste masqué en lecture seule).

`components/kanban/src/Kanban.tsx` :
- import `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`) ; état `const [removing, setRemoving] = useState<TicketView | null>(null);`
- `KanbanCard` reçoit `onRemove={() => setRemoving(t)}` ;
- en fin de composant, après `BlockDialog` :
```tsx
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.keyLabel)}
          description={fr.removeHelp(tickets.filter((x) => x.parentId === removing.id).length)}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={async () => {
            await sdk.run({ method: "deleteTicket", ticketId: removing.id });
          }}
        />
      )}
```
(Le Kanban ne montre qu'un niveau : le nombre annoncé est celui des enfants directs ; l'arbre Tickets (T10) et la fiche (T6) comptent tous les descendants. Si ce décalage gêne, réutiliser un `descendantCount` local identique à celui de T10.)

Run: `bun test components/kanban` — Expected: PASS (conformité comprise).

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test components/kanban && bun run budget`
Expected: PASS ; budget inchangé (Kanban chargé à la demande).

```bash
git add components/kanban/src/card-menu.ts components/kanban/src/card-menu.test.ts components/kanban/src/fr.ts
git commit -m "feat(kanban): entrées du menu d'une carte"
git add components/kanban/src/KanbanCard.tsx components/kanban/src/Kanban.tsx components/kanban/src/kanban.test.tsx
git commit -m "feat(kanban): clic droit et suppression confirmée"
```

### Task 12: Notes : renommer, supprimer, nom tiré du titre

Vague 1 ← T2. Décision 7, écran 103, spec §12.4 (menu **note**) et spec composants §8.2 (notes = fichiers `.md`). Chaque note de la liste gagne un menu (clic droit et « ⋯ ») : « Renommer… » demande un **titre** et montre le fichier cible « Fichier : <slug>.md » dans le même dossier ; « Supprimer… » confirme en nommant le fichier supprimé du disque. À la **première sauvegarde** d'une note encore nommée `sans-titre(-n).md`, si le premier titre `# …` donne un slug et que `<slug>.md` est libre, le fichier est renommé ; sinon il garde son nom. Décision d'Adam (2026-09-27) : **aucune note ne reste sans titre**. « Nouvelle note » demande un titre obligatoire (fichier `<slug>.md`, première ligne `# Titre`) ; une note `sans-titre(-n).md` existante est renommée à sa prochaine sauvegarde si elle a un titre, sinon la liste la signale et propose « Renommer… ». Avant tout renommage, le tampon de l'éditeur est enregistré et les sauvegardes suivantes visent le nouveau chemin (aucune frappe perdue). Tout passe par `sdk.notes.rename` / `sdk.notes.remove` (permission `writes: note`, déjà déclarée ; implémentées par le SDK simulé). En lecture seule (`useReadOnly()`), aucune entrée d'écriture.

**Files:**
- Create: `components/notes/src/note-name.ts`, `components/notes/src/note-name.test.ts`, `components/notes/src/NoteMenu.tsx`, `components/notes/src/RenameNoteDialog.tsx`
- Modify: `components/notes/src/NoteList.tsx`, `components/notes/src/NotesView.tsx`, `components/notes/src/fr.ts`, `components/notes/src/notes.test.tsx`

**Interfaces:**
- Consumes: `ContextMenuEntries`, `DropdownMenuEntries`, `MenuEntry` (T2), `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`, T2), `useReadOnly`, `useSdk`, `NotesApi.rename/remove`, `NoteMeta.title` (premier titre `# …`, calculé par le démon et le SDK simulé).
- Produces: Contrats partagés › Composants › `note-name.ts` ; `NoteList` props `+ readOnly: boolean; onRename(path: string): void; onRemove(path: string): void`.

- [x] **Step 1: Textes**

`components/notes/src/fr.ts`, ajouter :
```ts
  actions: (title: string) => `Actions de ${title}`,
  rename: "Renommer…",
  remove: "Supprimer…",
  renameTitle: "Renommer la note",
  renameField: "Titre",
  renameFile: (file: string) => `Fichier : ${file}`,
  renameNoSlug: "Ce titre ne donne aucun nom de fichier.",
  renameConflict: "Une note porte déjà ce nom.",
  renameFailed: "Impossible de renommer la note.",
  renameConfirm: "Renommer",
  cancel: "Annuler",
  removeTitle: (title: string) => `Supprimer la note « ${title} » ?`,
  removeHelp: (file: string) => `Le fichier ${file} sera supprimé du disque. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
```

- [x] **Step 2: Noms de fichier (test rouge puis vert)**

`components/notes/src/note-name.test.ts` :
```ts
import { expect, test } from "bun:test";
import { autoRenameTarget, isUntitledPath, renamedPath, slugify } from "./note-name";

test("slugify strips accents and punctuation, never starts with a digit prefix", () => {
  expect(slugify("Architecture du sync")).toBe("architecture-du-sync");
  expect(slugify("  Réunion — kick-off !  ")).toBe("reunion-kick-off");
  expect(slugify("2026 bilan")).toBe("2026-bilan");
  expect(slugify("é")).toBe("");
  expect(slugify("#")).toBe("");
  expect(slugify("a".repeat(80))).toHaveLength(40);
});

test("untitled paths are sans-titre.md and sans-titre-<n>.md, in any folder", () => {
  expect(isUntitledPath("sans-titre.md")).toBe(true);
  expect(isUntitledPath("sans-titre-3.md")).toBe(true);
  expect(isUntitledPath("brouillons/sans-titre-12.md")).toBe(true);
  expect(isUntitledPath("sans-titre-final.md")).toBe(false);
  expect(isUntitledPath("mes-sans-titre.md")).toBe(false);
});

test("the renamed path keeps the folder and takes the slug", () => {
  expect(renamedPath("sans-titre.md", "Architecture du sync")).toBe("architecture-du-sync.md");
  expect(renamedPath("brouillons/sans-titre-2.md", "Idées")).toBe("brouillons/idees.md");
  expect(renamedPath("notes/a.md", "???")).toBeNull();
});

test("the automatic target exists only for an untitled note whose slug is new and free", () => {
  const taken = ["sans-titre.md", "architecture-du-sync.md", "journal.md"];
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Plan de test" }, taken)).toBe("plan-de-test.md");
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Architecture du sync" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Sans titre" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre.md", title: "" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "journal.md", title: "Nouveau journal" }, taken)).toBeNull();
});
```
Run: `bun test components/notes/src/note-name.test.ts` — Expected: FAIL.

`components/notes/src/note-name.ts` (copie de `slugify` de `packages/ui/src/ai/slug.ts` sans le préfixe `c-` : un composant n'importe pas l'UI) :
```ts
const MAX_SLUG = 40;
const UNTITLED = /^sans-titre(-\d+)?\.md$/;

export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length < 2) return "";
  return s.slice(0, MAX_SLUG).replace(/-+$/, "");
}

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);

export const isUntitledPath = (path: string): boolean => UNTITLED.test(fileName(path));

export function renamedPath(from: string, title: string): string | null {
  const slug = slugify(title);
  return slug ? `${folderOf(from)}${slug}.md` : null;
}

export function autoRenameTarget(note: { path: string; title: string }, taken: readonly string[]): string | null {
  if (!isUntitledPath(note.path)) return null;
  const target = renamedPath(note.path, note.title);
  if (target === null || target === note.path || taken.includes(target)) return null;
  return target;
}
```
Run: `bun test components/notes/src/note-name.test.ts` — Expected: PASS, 4 tests.

- [x] **Step 3: Tests de la vue (rouges)**

`components/notes/src/notes.test.tsx`, ajouter (mêmes `setup`, `listed`, `editorView`) :
```tsx
test("a note is renamed from its menu; the dialog previews the file, a taken name is refused", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Actions de Journal agents" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Renommer…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  const field = within(dialog).getByLabelText("Titre");
  expect((field as HTMLInputElement).value).toBe("Journal agents");
  await user.clear(field);
  await user.type(field, "Décisions d'architecture");
  expect(within(dialog).getByText("Fichier : decisions-architecture.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Une note porte déjà ce nom.");
  await user.clear(field);
  await user.type(field, "Journal des agents");
  expect(within(dialog).getByText("Fichier : journal-des-agents.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(m.notes.has("journal-des-agents.md")).toBe(true));
  expect(m.notes.has("journal-agents.md")).toBe(false);
  await waitFor(() => expect(listed()).toEqual(expect.arrayContaining([expect.stringContaining("Journal agents")])));
});

test("deleting a note asks, removes the file and selects the next note", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: /^Décisions d'architecture/ }) });
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer la note « Décisions d'architecture » ?" });
  expect(confirm.textContent).toContain("Le fichier decisions-architecture.md sera supprimé du disque.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(m.notes.has("decisions-architecture.md")).toBe(false));
  expect(await screen.findByRole("heading", { level: 1, name: "Journal agents" })).toBeTruthy();
});

test("the first save of an untitled note renames its file after its title", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  await waitFor(() => expect(m.notes.has("sans-titre.md")).toBe(true));
  const view = await editorView();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# Plan de test\n\nPremière ligne.\n" }, userEvent: "input.type" });
  await waitFor(() => expect(m.notes.has("plan-de-test.md")).toBe(true), { timeout: 3000 });
  expect(m.notes.has("sans-titre.md")).toBe(false);
  expect(await screen.findByRole("heading", { level: 1, name: "Plan de test" })).toBeTruthy();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# Autre titre\n" }, userEvent: "input.type" });
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Autre titre\n"), { timeout: 3000 });
  expect(m.notes.has("autre-titre.md")).toBe(false);
});

test("a read-only project shows no note menu", async () => {
  const m = createMockSdk(manifest, { seed, surface: "view", notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES, shared: true });
  m.setAccess("read-only");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByRole("list", { name: "Notes" });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions de / })).toBeNull());
  expect(screen.queryByRole("button", { name: "Nouvelle note" })).toBeNull();
});
```
(La liste `Notes` rend ses entrées comme des boutons dont le texte commence par le titre ; le clic droit vise ce bouton. La note `journal-agents.md` de `DEMO_NOTES` est celle titrée « Journal agents » : vérifier le chemin exact dans `packages/sdk/src/fixtures.ts` et adapter `m.notes.has(...)`. L'autosave attend 800 ms : d'où `timeout: 3000`.)

Run: `bun test components/notes/src/notes.test.tsx` — Expected: FAIL (4 tests).

- [x] **Step 4: Menu, dialogue, liste, vue**

`components/notes/src/NoteMenu.tsx` :
```tsx
import type { NoteMeta } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";

export type NoteMenuActions = { rename(): void; remove(): void };

export const noteMenuEntries = (actions: NoteMenuActions): MenuEntry[] => [
  { label: fr.rename, icon: Pencil, onSelect: actions.rename },
  { label: fr.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
];

type Props = { note: NoteMeta; readOnly: boolean; actions: NoteMenuActions; children: ReactNode };

export function NoteMenu({ note, readOnly, actions, children }: Props) {
  if (readOnly) return <>{children}</>;
  const entries = noteMenuEntries(actions);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/note relative">
          {children}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1.5 right-1.5 size-6 opacity-0 group-hover/note:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                aria-label={fr.actions(note.title)}
              >
                <Ellipsis className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuEntries entries={entries} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

`components/notes/src/RenameNoteDialog.tsx` :
```tsx
import { KiboError, type NoteMeta } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";
import { renamedPath } from "./note-name";

type Props = { note: NoteMeta; onRenamed(path: string): void; onClose(): void };

export function RenameNoteDialog({ note, onRenamed, onClose }: Props) {
  const sdk = useSdk();
  const id = useId();
  const [title, setTitle] = useState(note.title);
  const [error, setError] = useState<string | null>(null);
  const target = renamedPath(note.path, title);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target === null) return;
    setError(null);
    try {
      const meta = await sdk.notes.rename(note.path, target);
      onRenamed(meta.path);
    } catch (err) {
      setError(err instanceof KiboError && err.code === "CONFLICT" ? fr.renameConflict : fr.renameFailed);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.renameTitle}</DialogTitle>
            <DialogDescription>{target ? fr.renameFile(target.slice(target.lastIndexOf("/") + 1)) : fr.renameNoSlug}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.renameField}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.cancel}
            </Button>
            <Button type="submit" disabled={target === null || target === note.path}>
              {fr.renameConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
(Renommer ne change que le **fichier** : le titre `# …` dans le contenu reste celui de la note ; c'est le choix de la décision 7 — le nom de fichier suit le titre saisi. La liste affiche toujours `NoteMeta.title`, lu du contenu.)

`components/notes/src/NoteList.tsx` : Props `+ readOnly: boolean; onRename(path: string): void; onRemove(path: string): void` ; chaque `<li>` enveloppe son bouton dans `<NoteMenu note={n} readOnly={readOnly} actions={{ rename: () => onRename(n.path), remove: () => onRemove(n.path) }}>…</NoteMenu>` ; le bouton « Nouvelle note » n'est rendu que si `!readOnly`.

`components/notes/src/NotesView.tsx` :
- imports : `useReadOnly` (`@kibo/sdk`), `ConfirmDialog` (`@kibo/sdk/ui/confirm-dialog`), `RenameNoteDialog` (`./RenameNoteDialog`), `autoRenameTarget` (`./note-name`) ;
- état : `const readOnly = useReadOnly(); const [renaming, setRenaming] = useState<NoteMeta | null>(null); const [removing, setRemoving] = useState<NoteMeta | null>(null);`
- renommage automatique dans `createAutosave` : `onSaved` devient
```tsx
      onSaved: (meta) => {
        setNote((n) => (n && n.path === meta.path ? { ...n, ...meta } : n));
        const target = autoRenameTarget(meta, listedPaths.current);
        if (target !== null) {
          notesApi.current.rename(meta.path, target).then(
            (renamed) => setSelected(renamed.path),
            fail(fr.renameFailed),
          );
        }
      },
```
avec `const listedPaths = useRef<string[]>([]); listedPaths.current = listed.data.map((n) => n.path);` (un `ref`, pour ne pas recréer l'autosave à chaque liste). Le renommage automatique ne s'applique qu'à un chemin `sans-titre(-n).md` : une note renommée une fois (automatiquement ou à la main) ne bouge plus (troisième test) ;
- `NoteList` reçoit `readOnly={readOnly}`, `onRename={(path) => setRenaming(listed.data.find((n) => n.path === path) ?? null)}`, `onRemove={(path) => setRemoving(listed.data.find((n) => n.path === path) ?? null)}` ;
- suppression : après la note retirée, sélectionner la suivante dans l'ordre de la liste (ou la précédente si c'était la dernière, `null` si plus rien) :
```tsx
  const nextAfter = (path: string): string | null => {
    const paths = notes.map((n) => n.path);
    const i = paths.indexOf(path);
    return paths[i + 1] ?? paths[i - 1] ?? null;
  };
  const remove = async (meta: NoteMeta) => {
    const next = nextAfter(meta.path);
    await sdk.notes.remove(meta.path);
    setNote(null);
    setSelected(next);
  };
```
- rendu, en fin de `div` racine :
```tsx
      {renaming && (
        <RenameNoteDialog
          note={renaming}
          onRenamed={(path) => {
            setRenaming(null);
            setSelected(path);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.title)}
          description={fr.removeHelp(removing.path.slice(removing.path.lastIndexOf("/") + 1))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={() => remove(removing)}
        />
      )}
```
Si `NotesView.tsx` dépasse ~300 lignes, sortir `useSearch`, `resolveTarget`, `freePath`, `backlinksOf`, `linkedOf` dans `notes-view-helpers.ts` (fonctions pures + hook) sans changer leur code.

Run: `bun test components/notes` — Expected: PASS (conformité comprise, `write:note` déclaré).

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test components/notes && bun run budget`
Expected: PASS ; budget inchangé (Notes chargé à la demande).

```bash
git add components/notes/src/note-name.ts components/notes/src/note-name.test.ts components/notes/src/fr.ts
git commit -m "feat(notes): nom de fichier tiré du titre"
git add components/notes/src/NoteMenu.tsx components/notes/src/RenameNoteDialog.tsx components/notes/src/NoteList.tsx components/notes/src/NotesView.tsx components/notes/src/notes.test.tsx
git commit -m "feat(notes): renommer, supprimer, renommage auto"
```
(Ajouter `components/notes/src/notes-view-helpers.ts` au second commit si l'extraction a eu lieu.)

### Task 13: UI de bureau : liens externes, titre, menu natif bloqué, raccourcis

Vague 1 ← T2, T4, **intégrée après T7** (elle touche `AppSidebar.tsx` après l'extraction de `ProjectPages`). Spec §12.4 (menu natif de la webview bloqué sauf champ de saisie ou sélection ; chrome non sélectionnable) et §12.5 (liens externes `https:` seulement via `tauri-plugin-opener` ; titre de fenêtre ; raccourcis affichés selon la plateforme). Tout ce qui touche Tauri est dans `packages/ui/src/desktop/`, chargé par **import dynamique** depuis `Shell` quand `inTauri()` ; la logique (filtrage d'URL, décision « menu natif autorisé », titre) est pure et testée sans Tauri. Relue par `kibo-lead` (liens externes). Dans un navigateur, rien ne change : `installDesktop` n'est jamais appelé, `document.title` n'est pas touché par Tauri mais **l'UI le pose dans tous les cas** (utile aussi dans un onglet de navigateur).

**Files:**
- Modify: `packages/ui/package.json` (`"@tauri-apps/plugin-opener"` en `dependencies`, version exacte de la ligne 2.x installée par `bun add`), `bun.lock`
- Create: `packages/ui/src/desktop/external-links.ts`, `external-links.test.ts`, `native-context-menu.ts`, `native-context-menu.test.ts`, `window-title.ts`, `window-title.test.ts`, `install.ts`, `use-window-title.ts`
- Create: `packages/ui/src/lib/shortcut-label.ts`, `packages/ui/src/lib/shortcut-label.test.ts`
- Modify: `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/tabs/TabBar.tsx`, `packages/ui/src/shell/AppSidebar.tsx`, `packages/ui/src/shell/ShellHeader.tsx`, `packages/ui/scripts/bundle-report.ts`
- Test (existants) : `packages/ui/src/tabs/TabBar.test.tsx` (les raccourcis affichés dépendent de `navigator.platform` : happy-dom répond une plateforme non Mac ⇒ `Ctrl+W`, `Ctrl+Shift+P` ; adapter les attentes qui citent `⌘W` / `⌘⇧P`)

**Interfaces:**
- Consumes: permissions `core:window:allow-set-title` et `opener:allow-open-url` (`https://**`) de T4 ; `inTauri` (`shell/workspace-actions`), `isMacPlatform` (`tabs/use-tab-shortcuts`), `describeTarget` (`tabs/tab-title`), `@tauri-apps/api/window` (`getCurrentWindow().setTitle`), `@tauri-apps/plugin-opener` (`openUrl`).
- Produces: Contrats partagés › UI › `shortcut-label.ts`, `desktop/` ; `useWindowTitle(tabTitle: string | null): void`.

- [x] **Step 1: Dépendance**

Run: `cd packages/ui && bun add --exact @tauri-apps/plugin-opener@^2 && cd ../.. && grep -n "plugin-opener" packages/ui/package.json`
Expected: une ligne `"@tauri-apps/plugin-opener": "2.x.y"` (version exacte, même ligne majeure que la crate `tauri-plugin-opener = "2"` de T4) ; `bun.lock` mis à jour ; aucun script `postinstall` (vérifier `bun pm ls | grep opener` et l'absence de `postinstall` dans `node_modules/@tauri-apps/plugin-opener/package.json`). Justification (commit) : ouverture des liens `https:` dans le navigateur depuis la fenêtre Tauri, spec §12.5.

- [x] **Step 2: Fonctions pures (tests rouges)**

`packages/ui/src/lib/shortcut-label.test.ts` :
```ts
import { expect, test } from "bun:test";
import { shortcutLabel } from "./shortcut-label";

test("mac shows symbols, others show Ctrl and plus signs", () => {
  expect(shortcutLabel(["K"], true)).toBe("⌘K");
  expect(shortcutLabel(["K"], false)).toBe("Ctrl+K");
  expect(shortcutLabel(["Shift", "P"], true)).toBe("⌘⇧P");
  expect(shortcutLabel(["Shift", "P"], false)).toBe("Ctrl+Shift+P");
  expect(shortcutLabel(["W"], true)).toBe("⌘W");
  expect(shortcutLabel(["1"], false)).toBe("Ctrl+1");
});
```
`packages/ui/src/desktop/external-links.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import { externalLinkOf, installExternalLinks } from "./external-links";

const anchor = (href: string, target: string | null = "_blank") => {
  const a = document.createElement("a");
  a.href = href;
  if (target) a.target = target;
  const inner = document.createElement("span");
  a.appendChild(inner);
  document.body.appendChild(a);
  return { a, inner };
};

test("only https links opened in a new tab are external", () => {
  expect(externalLinkOf(anchor("https://github.com/kibo/pull/4").inner)).toBe("https://github.com/kibo/pull/4");
  expect(externalLinkOf(anchor("http://example.org/").a)).toBeNull();
  expect(externalLinkOf(anchor("javascript:alert(1)").a)).toBeNull();
  expect(externalLinkOf(anchor("file:///etc/passwd").a)).toBeNull();
  expect(externalLinkOf(anchor("mailto:a@b.c").a)).toBeNull();
  expect(externalLinkOf(anchor("https://kibo.dev/", null).a)).toBeNull();
  expect(externalLinkOf(document.createElement("div"))).toBeNull();
  expect(externalLinkOf(null)).toBeNull();
});

test("a click on an https link is intercepted and sent to the opener; other schemes are neutralised", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  const https = anchor("https://kibo.dev/docs");
  const ev1 = new MouseEvent("click", { bubbles: true, cancelable: true });
  https.inner.dispatchEvent(ev1);
  expect(ev1.defaultPrevented).toBe(true);
  expect(open).toHaveBeenCalledWith("https://kibo.dev/docs");
  const js = anchor("javascript:alert(1)");
  const ev2 = new MouseEvent("click", { bubbles: true, cancelable: true });
  js.a.dispatchEvent(ev2);
  expect(ev2.defaultPrevented).toBe(true);
  expect(open).toHaveBeenCalledTimes(1);
  const same = anchor("https://kibo.dev/same", null);
  const ev3 = new MouseEvent("click", { bubbles: true, cancelable: true });
  same.a.dispatchEvent(ev3);
  expect(ev3.defaultPrevented).toBe(false);
  off();
  const ev4 = new MouseEvent("click", { bubbles: true, cancelable: true });
  https.inner.dispatchEvent(ev4);
  expect(ev4.defaultPrevented).toBe(false);
});

test("a failed opener is reported, never thrown", async () => {
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const off = installExternalLinks(document, () => Promise.reject(new Error("no browser")));
    anchor("https://kibo.dev/").a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toHaveLength(1);
    off();
  } finally {
    console.error = log;
  }
});
```
`packages/ui/src/desktop/native-context-menu.test.ts` :
```ts
import { expect, test } from "bun:test";
import { allowsNativeMenu, blockNativeContextMenu } from "./native-context-menu";

test("the native menu stays in text fields, editable areas and on a selection", () => {
  expect(allowsNativeMenu(document.createElement("input"), "")).toBe(true);
  expect(allowsNativeMenu(document.createElement("textarea"), "")).toBe(true);
  const editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  const inner = document.createElement("span");
  editable.appendChild(inner);
  document.body.appendChild(editable);
  expect(allowsNativeMenu(inner, "")).toBe(true);
  expect(allowsNativeMenu(document.createElement("div"), "du texte")).toBe(true);
  expect(allowsNativeMenu(document.createElement("div"), "   ")).toBe(false);
  expect(allowsNativeMenu(document.createElement("button"), "")).toBe(false);
  expect(allowsNativeMenu(null, "")).toBe(false);
});

test("contextmenu is prevented on the chrome and left alone in a field", () => {
  let selection = "";
  const off = blockNativeContextMenu(document, () => selection);
  const button = document.createElement("button");
  document.body.appendChild(button);
  const blocked = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(blocked);
  expect(blocked.defaultPrevented).toBe(true);
  const input = document.createElement("input");
  document.body.appendChild(input);
  const allowed = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  input.dispatchEvent(allowed);
  expect(allowed.defaultPrevented).toBe(false);
  selection = "mot";
  const withSelection = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(withSelection);
  expect(withSelection.defaultPrevented).toBe(false);
  off();
  const after = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  selection = "";
  button.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
```
(Les menus Kibo (`ContextMenu` de Radix) écoutent `contextmenu` sur leur déclencheur et appellent `preventDefault` eux-mêmes : bloquer l'événement au niveau du document **en phase de bulle** ne les empêche pas de s'ouvrir, puisqu'ils l'ont déjà traité ; Radix n'appelle pas `stopPropagation`, l'écouteur du document voit donc l'événement déjà `defaultPrevented` et n'a rien à faire. Ne jamais utiliser `capture: true` ici.)

`packages/ui/src/desktop/window-title.test.ts` :
```ts
import { expect, test } from "bun:test";
import { windowTitle } from "./window-title";

test("the window title follows the active tab, Kibo alone on the home", () => {
  expect(windowTitle(null)).toBe("Kibo");
  expect(windowTitle("Kibo · Kanban")).toBe("Kibo · Kanban — Kibo");
  expect(windowTitle("Kibo · KIB-12")).toBe("Kibo · KIB-12 — Kibo");
  expect(windowTitle("")).toBe("Kibo");
});
```
Run: `bun test packages/ui/src/lib/shortcut-label.test.ts packages/ui/src/desktop` — Expected: FAIL (modules introuvables).

- [x] **Step 3: Fonctions pures (vertes)**

`packages/ui/src/lib/shortcut-label.ts` :
```ts
import { isMacPlatform } from "../tabs/use-tab-shortcuts";

const MAC_KEYS: Record<string, string> = { Shift: "⇧", Alt: "⌥", Ctrl: "⌃" };

export const isMac = (): boolean => isMacPlatform(navigator.platform);

export function shortcutLabel(keys: readonly string[], mac: boolean): string {
  if (mac) return `⌘${keys.map((k) => MAC_KEYS[k] ?? k).join("")}`;
  return ["Ctrl", ...keys].join("+");
}
```
`packages/ui/src/desktop/external-links.ts` :
```ts
export function externalLinkOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[target=_blank]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  return url.protocol === "https:" ? url.href : null;
}

export function installExternalLinks(root: Document, open: (url: string) => Promise<void>): () => void {
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const anchor = e.target.closest("a[target=_blank]");
    if (!anchor) return;
    e.preventDefault();
    const url = externalLinkOf(anchor);
    if (url === null) return;
    open(url).catch((err: unknown) => console.error("[kibo] cannot open the external link", err));
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
```
(`a[target=_blank]` sans schéma `https:` ⇒ clic neutralisé et rien d'ouvert : c'est le comportement voulu par la spec pour `javascript:`, `file:`, `mailto:`, `http:`. Correction de la relecture : l'UI produit des liens sortants sans `target` (liens markdown du composant Notes, intégré au document du shell). Un `<a href>` est donc *sortant* si son URL résolue n'a pas l'origine du document (`javascript:`, `mailto:`, `data:` ont l'origine `"null"`) ou si `target` vaut `_blank` sans tenir compte de la casse ; sortant `https:` ⇒ ouvreur, autre schéma ou URL illisible ⇒ clic neutralisé ; même origine sans `_blank` ⇒ non touché (routage par hash, liens de note). Le clic du milieu (`auxclick`, `button === 1`) suit le même chemin. `externalLinkOf(target, origin)` renvoie `null` (non sortant) ou `{ url: string | null }`.)

`packages/ui/src/desktop/native-context-menu.ts` :
```ts
const FIELD = "input, textarea, [contenteditable]:not([contenteditable=false])";

export function allowsNativeMenu(target: EventTarget | null, selection: string): boolean {
  if (selection.trim().length > 0) return true;
  return target instanceof Element && target.closest(FIELD) !== null;
}

export function blockNativeContextMenu(root: Document, selection: () => string): () => void {
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (!allowsNativeMenu(e.target, selection())) e.preventDefault();
  };
  root.addEventListener("contextmenu", onContextMenu);
  return () => root.removeEventListener("contextmenu", onContextMenu);
}
```
`packages/ui/src/desktop/window-title.ts` :
```ts
export const APP_TITLE = "Kibo";

export function windowTitle(tabTitle: string | null): string {
  return tabTitle ? `${tabTitle} — ${APP_TITLE}` : APP_TITLE;
}
```
Run: `bun test packages/ui/src/lib/shortcut-label.test.ts packages/ui/src/desktop` — Expected: PASS, 7 tests.

- [x] **Step 4: Installation Tauri et titre de fenêtre**

`packages/ui/src/desktop/install.ts` (jamais importé statiquement : `FORBIDDEN_IN_ENTRY`) :
```ts
import { installExternalLinks } from "./external-links";
import { blockNativeContextMenu } from "./native-context-menu";

export async function setNativeTitle(title: string): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

const openExternal = async (url: string): Promise<void> => {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
};

export function installDesktop(): () => void {
  const offLinks = installExternalLinks(document, openExternal);
  const offMenu = blockNativeContextMenu(document, () => window.getSelection()?.toString() ?? "");
  return () => {
    offLinks();
    offMenu();
  };
}
```
`packages/ui/src/desktop/use-window-title.ts` (léger : dans l'entrée, sans import Tauri statique) :
```ts
import { useEffect } from "react";
import { inTauri } from "../shell/workspace-actions";
import { windowTitle } from "./window-title";

export function useWindowTitle(tabTitle: string | null): void {
  useEffect(() => {
    const title = windowTitle(tabTitle);
    document.title = title;
    if (!inTauri()) return;
    import("./install")
      .then((m) => m.setNativeTitle(title))
      .catch((e: unknown) => console.error("[kibo] cannot set the window title", e));
  }, [tabTitle]);
}
```
Sous Tauri, `document.title` ne change pas le titre natif de la fenêtre : d'où `setTitle` par IPC, permis par `core:window:allow-set-title` (T4).

`packages/ui/src/shell/Shell.tsx`, dans `Workspace` :
```tsx
  useWindowTitle(active ? describeTarget(active, { projects, snapshots }).title : null);
  useEffect(() => {
    if (!inTauri()) return;
    let off: (() => void) | null = null;
    let alive = true;
    import("../desktop/install").then(
      (m) => {
        if (alive) off = m.installDesktop();
      },
      (e: unknown) => console.error("[kibo] desktop integration failed to load", e),
    );
    return () => {
      alive = false;
      off?.();
    };
  }, []);
```
(`useWindowTitle` importé de `../desktop/use-window-title` ; `describeTarget`, `inTauri`, `useEffect` sont déjà importés.)

`bundle-report.ts` › `FORBIDDEN_IN_ENTRY` : `/\/packages\/ui\/src\/desktop\/install\.ts$/,` (`@tauri-apps/` est déjà interdit par la regex `node_modules/@tauri-apps/` ; `window-title.ts`, `external-links.ts`, `native-context-menu.ts` et `use-window-title.ts` peuvent rester dans l'entrée : moins de 1 kB).

- [x] **Step 5: Raccourcis affichés et chrome non sélectionnable**

- `packages/ui/src/tabs/TabBar.tsx` : `const mac = isMac();` dans `TabMenu` ; `⌘⇧P` devient `{shortcutLabel(["Shift", "P"], mac)}` et `⌘W` devient `{shortcutLabel(["W"], mac)}` ; la `div` racine (`flex h-10 shrink-0 …`) gagne `select-none`.
- `packages/ui/src/shell/AppSidebar.tsx` : `<kbd className="font-mono text-3xs">⌘K</kbd>` devient `<kbd className="font-mono text-3xs">{shortcutLabel(["K"], isMac())}</kbd>` ; `<Sidebar className={p.className}>` devient `<Sidebar className={cn("select-none", p.className)}>` (`cn` de `@kibo/sdk/lib/utils`).
- `packages/ui/src/shell/ShellHeader.tsx` : le `<header className="flex h-12 …">` gagne `select-none`.
- `packages/ui/src/tabs/TabBar.test.tsx` : remplacer les attentes `⌘W` / `⌘⇧P` par `shortcutLabel(["W"], isMac())` / `shortcutLabel(["Shift", "P"], isMac())` (import depuis `../lib/shortcut-label`), pour que le test ne dépende pas de la plateforme d'exécution.

Run: `bun test packages/ui/src/tabs packages/ui/src/shell/shell.test.tsx packages/ui/src/desktop packages/ui/src/lib` — Expected: PASS.

- [x] **Step 6: Vérification dans la coque, gate, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; aucun « Module interdit » (`install.ts` et `@tauri-apps/plugin-opener` restent hors de l'entrée) ; budget + 0,5 kB au plus.

Puis, avec la coque de T4 (`bun run --cwd packages/ui build && bun run --cwd apps/desktop build:debug`, lancer `apps/desktop/src-tauri/target/debug/kibo`) : le titre de la fenêtre suit l'onglet (« Kibo » sur l'Accueil, « Projet · Page — Kibo » ailleurs) ; un lien `https:` d'une description de ticket s'ouvre dans le navigateur ; le clic droit sur la barre latérale n'ouvre pas le menu de la webview mais celui de Kibo sur une page, et le menu natif reste dans un champ de saisie et sur un texte sélectionné. Noter le résultat dans le rapport de la tâche.

```bash
git add packages/ui/package.json bun.lock
git commit -m "build(ui): plugin-opener pour les liens externes"
git add packages/ui/src/lib/shortcut-label.ts packages/ui/src/lib/shortcut-label.test.ts packages/ui/src/desktop/external-links.ts packages/ui/src/desktop/external-links.test.ts packages/ui/src/desktop/native-context-menu.ts packages/ui/src/desktop/native-context-menu.test.ts packages/ui/src/desktop/window-title.ts packages/ui/src/desktop/window-title.test.ts
git commit -m "feat(ui): liens externes, menu natif et titre"
git add packages/ui/src/desktop/install.ts packages/ui/src/desktop/use-window-title.ts packages/ui/src/shell/Shell.tsx packages/ui/src/tabs/TabBar.tsx packages/ui/src/tabs/TabBar.test.tsx packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/ShellHeader.tsx packages/ui/scripts/bundle-report.ts
git commit -m "feat(ui): intégration bureau et raccourcis affichés"
```

### Task 14: Dépendances dans la fiche ticket

Vague 2 ← T6. Décision 5, écran 100, spec générale §5 (liens `blocks` / `relates`). Les liens vivent dans `ProjectSnapshot.links` (pas dans `TicketView`) : la fiche les regroupe en « Bloqué par » (liens `blocks` dont `to` est le ticket), « Bloque » (`from` est le ticket) et « Lié à » (`relates`, symétrique). Chaque ligne ouvre l'autre ticket (`onOpenTicket`) et porte une croix « Retirer » (`removeLink { linkId }`) ; un formulaire « Ajouter une dépendance » (type + recherche par clé ou titre, 8 résultats au plus) envoie `addLink`. Le démon refuse l'auto-lien et le doublon (`INVALID_INPUT`) et un cycle de `blocks` (`LINK_CYCLE`) : les deux sont expliqués en français, rien n'est écrit. Les badges « attend » disparaissent de la fiche (le groupe « Bloqué par » les remplace, les tickets terminés y sont grisés) ; ils restent dans l'arbre et le Kanban.

**Files:**
- Create: `packages/ui/src/ticket/links.ts`, `links.test.ts`, `DependenciesSection.tsx`, `AddLinkForm.tsx`, `dependencies.test.tsx`
- Modify: `packages/ui/src/shell/TicketDetail.tsx` (section remplaçant les badges « attend »), `packages/ui/src/i18n/fr-ticket-edit.ts` (`deps`, `errors.LINK_CYCLE`)

**Interfaces:**
- Consumes: `useTicketCommand(projectId, describe?)` (T6), `TicketDetail` props `{ project, ticket, viewer, onOpenFile, onOpenTicket }` (T6), `StatusDot` (`@kibo/sdk`), `Select`, `Input`, `Button`.
- Produces: Contrats partagés › UI › `links.ts` ; `DependenciesSection` props `{ project: ProjectSnapshot; ticket: TicketView; editable: boolean; onOpenTicket(ticketId: string): void }`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr-ticket-edit.ts`, ajouter dans `errors` : `LINK_CYCLE: "Impossible : cela créerait une boucle de dépendances."` ; et la section
```ts
  deps: {
    title: "Dépendances",
    blockedBy: "Bloqué par",
    blocks: "Bloque",
    related: "Lié à",
    remove: (key: string) => `Retirer ${key}`,
    add: "Ajouter une dépendance",
    type: "Type",
    search: "Ticket",
    searchPlaceholder: "KIB-2…",
    noResult: "Aucun ticket ne correspond.",
    duplicate: "Ce lien existe déjà.",
    failed: "Impossible d'ajouter la dépendance.",
    close: "Fermer",
  },
```

- [x] **Step 2: Fonctions pures (test rouge puis vert)**

`packages/ui/src/ticket/links.test.ts` :
```ts
import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type Link, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { linkCandidates, linksOf } from "./links";

const t = (n: number, title: string, statusId: TicketView["statusId"] = "todo"): TicketView => ({
  id: `${n}@1`,
  key: `KIB-${n}`,
  pendingSeq: null,
  keyLabel: `KIB-${n}`,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});
const link = (id: string, from: number, to: number, type: Link["type"]): Link => ({ id, from: `${from}@1`, to: `${to}@1`, type });
const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [t(5, "Loro", "done"), t(12, "Schéma Loro des tickets"), t(13, "Sync", "done"), t(15, "Kanban"), t(16, "Notes"), t(20, "Schéma des pages"), t(21, "Graph")],
  links: [link("l1", 5, 12, "blocks"), link("l2", 13, 12, "blocks"), link("l3", 12, 15, "blocks"), link("l4", 16, 12, "relates"), link("l5", 20, 21, "relates")],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

test("links are grouped from the ticket's point of view, relates being symmetric", () => {
  const links = linksOf(project, "12@1");
  expect(links.blockedBy.map((l) => [l.link.id, l.ticket.keyLabel])).toEqual([["l1", "KIB-5"], ["l2", "KIB-13"]]);
  expect(links.blocks.map((l) => l.ticket.keyLabel)).toEqual(["KIB-15"]);
  expect(links.related.map((l) => l.ticket.keyLabel)).toEqual(["KIB-16"]);
  expect(linksOf(project, "16@1").related.map((l) => l.ticket.keyLabel)).toEqual(["KIB-12"]);
  expect(linksOf(project, "21@1")).toEqual({ blockedBy: [], blocks: [], related: [{ link: link("l5", 20, 21, "relates"), ticket: t(20, "Schéma des pages") }] });
});

test("a link to a missing ticket is ignored", () => {
  const broken = { ...project, links: [...project.links, link("l9", 12, 99, "blocks")] };
  expect(linksOf(broken, "12@1").blocks.map((l) => l.ticket.keyLabel)).toEqual(["KIB-15"]);
});

test("candidates exclude the ticket and its linked tickets, match key or title, key first, 8 at most", () => {
  expect(linkCandidates(project, "12@1", "").map((c) => c.keyLabel)).toEqual(["KIB-20", "KIB-21"]);
  expect(linkCandidates(project, "12@1", "kib-2").map((c) => c.keyLabel)).toEqual(["KIB-20", "KIB-21"]);
  expect(linkCandidates(project, "12@1", "schéma").map((c) => c.keyLabel)).toEqual(["KIB-20"]);
  expect(linkCandidates(project, "21@1", "SCH").map((c) => c.keyLabel)).toEqual(["KIB-12"]);
  const many = { ...project, tickets: Array.from({ length: 12 }, (_, i) => t(100 + i, `Ticket ${i}`)), links: [] };
  expect(linkCandidates(many, "100@1", "ticket")).toHaveLength(8);
});
```
(KIB-20 est exclu des candidats de KIB-21 car déjà lié ; « SCH » ne trouve donc que KIB-12.)

Run: `bun test packages/ui/src/ticket/links.test.ts` — Expected: FAIL.

`packages/ui/src/ticket/links.ts` :
```ts
import type { Link, ProjectSnapshot, TicketView } from "@kibo/schema";

export type LinkedTicket = { link: Link; ticket: TicketView };
export type TicketLinks = { blockedBy: LinkedTicket[]; blocks: LinkedTicket[]; related: LinkedTicket[] };

const MAX_CANDIDATES = 8;

export function linksOf(project: ProjectSnapshot, ticketId: string): TicketLinks {
  const byId = new Map(project.tickets.map((t) => [t.id, t]));
  const other = (link: Link) => byId.get(link.from === ticketId ? link.to : link.from);
  const out: TicketLinks = { blockedBy: [], blocks: [], related: [] };
  for (const link of project.links) {
    if (link.from !== ticketId && link.to !== ticketId) continue;
    const ticket = other(link);
    if (!ticket) continue;
    if (link.type === "relates") out.related.push({ link, ticket });
    else if (link.to === ticketId) out.blockedBy.push({ link, ticket });
    else out.blocks.push({ link, ticket });
  }
  return out;
}

export function linkCandidates(project: ProjectSnapshot, ticketId: string, query: string): TicketView[] {
  const linked = new Set(project.links.flatMap((l) => (l.from === ticketId ? [l.to] : l.to === ticketId ? [l.from] : [])));
  const q = query.trim().toLowerCase();
  const byKey = (t: TicketView) => t.keyLabel.toLowerCase().includes(q);
  const byTitle = (t: TicketView) => t.title.toLowerCase().includes(q);
  return project.tickets
    .filter((t) => t.id !== ticketId && !linked.has(t.id))
    .filter((t) => q === "" || byKey(t) || byTitle(t))
    .sort((a, b) => Number(byKey(b)) - Number(byKey(a)))
    .slice(0, MAX_CANDIDATES);
}
```
Run: `bun test packages/ui/src/ticket/links.test.ts` — Expected: PASS, 3 tests.

- [x] **Step 3: Tests de la section (rouges)**

`packages/ui/src/ticket/dependencies.test.tsx` (même `mock.module("../api")`, `TicketSheet`, `ticket()`, `show()` que `ticket-edit.test.tsx` : extraire ces aides dans `packages/ui/src/ticket/test-sheet.tsx` ? Non : `mock.module` doit rester dans le fichier de test ; recopier l'en-tête de `ticket-edit.test.tsx` et n'en garder que le nécessaire) :
```tsx
const withLinks = (main: TicketView): ProjectSnapshot => {
  const base = project(main);
  const t = (n: number, title: string, statusId: TicketView["statusId"] = "todo") =>
    ticket({ id: `${n}@1`, key: `KIB-${n}`, keyLabel: `KIB-${n}`, title, statusId, progress: { done: 0, total: 0 } });
  return {
    ...base,
    tickets: [main, t(5, "Loro", "done"), t(13, "Sync", "done"), t(15, "Kanban"), t(16, "Notes"), t(20, "Schéma des pages")],
    links: [
      { id: "l1", from: "5@1", to: main.id, type: "blocks" },
      { id: "l2", from: "13@1", to: main.id, type: "blocks" },
      { id: "l3", from: main.id, to: "15@1", type: "blocks" },
      { id: "l4", from: "16@1", to: main.id, type: "relates" },
    ],
  };
};

test("the three groups list the linked tickets, done ones greyed, and open them", async () => {
  const { user, onOpenTicket } = show(ticket(), "write", withLinks);
  const section = screen.getByRole("region", { name: "Dépendances" });
  const group = (name: string) => within(within(section).getByRole("group", { name }));
  expect(group("Bloqué par").getAllByRole("button", { name: /^KIB-/ }).map((b) => b.textContent)).toEqual(["KIB-5 Loro", "KIB-13 Sync"]);
  expect(group("Bloqué par").getByRole("button", { name: /^KIB-5/ }).className).toContain("text-muted-foreground");
  expect(group("Bloque").getAllByRole("button", { name: /^KIB-/ }).map((b) => b.textContent)).toEqual(["KIB-15 Kanban"]);
  expect(group("Lié à").getAllByRole("button", { name: /^KIB-/ }).map((b) => b.textContent)).toEqual(["KIB-16 Notes"]);
  expect(screen.queryByText("Attend")).toBeNull();
  await user.click(group("Bloque").getByRole("button", { name: /^KIB-15/ }));
  expect(onOpenTicket).toHaveBeenCalledWith("15@1");
});

test("the cross removes the link", async () => {
  const { user } = show(ticket(), "write", withLinks);
  await user.click(screen.getByRole("button", { name: "Retirer KIB-13" }));
  expect(command(calls.at(-1))).toEqual({ method: "removeLink", linkId: "l2" });
});

test("adding a dependency searches by key or title and sends addLink in the right direction", async () => {
  const { user } = show(ticket(), "write", withLinks);
  await user.click(screen.getByRole("button", { name: "Ajouter une dépendance" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "KIB-2");
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["KIB-20 Schéma des pages"]);
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "20@1", to: "12@1", type: "blocks" });
  await user.click(screen.getByRole("combobox", { name: "Type" }));
  await user.click(await screen.findByRole("option", { name: "Bloque" }));
  await user.clear(screen.getByRole("textbox", { name: "Ticket" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "pages");
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "12@1", to: "20@1", type: "blocks" });
  await user.click(screen.getByRole("combobox", { name: "Type" }));
  await user.click(await screen.findByRole("option", { name: "Lié à" }));
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect(command(calls.at(-1))).toEqual({ method: "addLink", from: "12@1", to: "20@1", type: "relates" });
});

test("a cycle and a duplicate are explained, nothing else changes", async () => {
  answer = (req) => {
    if (command(req)?.method !== "addLink") return null;
    throw new KiboError("LINK_CYCLE", "cycle");
  };
  const { user } = show(ticket(), "write", withLinks);
  await user.click(screen.getByRole("button", { name: "Ajouter une dépendance" }));
  await user.type(screen.getByRole("textbox", { name: "Ticket" }), "pages");
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible : cela créerait une boucle de dépendances.");
  answer = () => {
    throw new KiboError("INVALID_INPUT", "duplicate link");
  };
  await user.click(screen.getByRole("option", { name: /KIB-20/ }));
  expect((await screen.findByRole("alert")).textContent).toBe("Ce lien existe déjà.");
  expect(calls.filter((c) => command(c)?.method === "addLink")).toHaveLength(2);
});

test("a read-only project shows the groups without crosses or the add form", () => {
  show(ticket(), "read-only", withLinks);
  expect(screen.getByRole("group", { name: "Bloqué par" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Retirer / })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ajouter une dépendance" })).toBeNull();
});
```
`show(main, access, build = project)` : la fonction `show` de ce fichier prend un troisième argument qui construit le snapshot (`withLinks`), sinon `project`. Écran 100 : les résultats de recherche « KIB-2… » sont rendus avec `role="listbox"` / `role="option"` (liste de boutons `role="option"` dans un `ul role="listbox"` avec `aria-label={deps.search}`).

Run: `bun test packages/ui/src/ticket/dependencies.test.tsx` — Expected: FAIL (section absente).

- [x] **Step 4: Section et formulaire**

`packages/ui/src/ticket/DependenciesSection.tsx` :
```tsx
import type { ProjectSnapshot, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { X } from "lucide-react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { AddLinkForm } from "./AddLinkForm";
import { type LinkedTicket, linksOf } from "./links";
import { useTicketCommand } from "./use-ticket-command";

type Props = { project: ProjectSnapshot; ticket: TicketView; editable: boolean; onOpenTicket(ticketId: string): void };

function Group({ name, items, editable, onOpen, onRemove }: { name: string; items: LinkedTicket[]; editable: boolean; onOpen(id: string): void; onRemove(linkId: string): void }) {
  if (items.length === 0) return null;
  return (
    <div role="group" aria-label={name} className="grid gap-1">
      <h4 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{name}</h4>
      <ul className="grid gap-0.5">
        {items.map(({ link, ticket }) => (
          <li key={link.id} className="flex items-center gap-1">
            <button
              type="button"
              className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent", ticket.statusId === "done" && "text-muted-foreground")}
              onClick={() => onOpen(ticket.id)}
            >
              <StatusDot statusId={ticket.statusId} />
              <span className="font-mono text-2xs">{ticket.keyLabel}</span>
              <span className="truncate">{ticket.title}</span>
            </button>
            {editable && (
              <Button size="icon" variant="ghost" className="size-6" aria-label={t.deps.remove(ticket.keyLabel)} onClick={() => onRemove(link.id)}>
                <X className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DependenciesSection({ project, ticket, editable, onOpenTicket }: Props) {
  const command = useTicketCommand(project.meta.id);
  const links = linksOf(project, ticket.id);
  const remove = (linkId: string) => void command.run({ method: "removeLink", linkId });
  const empty = links.blockedBy.length + links.blocks.length + links.related.length === 0;
  if (empty && !editable) return null;
  return (
    <section aria-label={t.deps.title} className="grid gap-3 px-4 text-xs">
      <h3 className="font-medium">{t.deps.title}</h3>
      <Group name={t.deps.blockedBy} items={links.blockedBy} editable={editable} onOpen={onOpenTicket} onRemove={remove} />
      <Group name={t.deps.blocks} items={links.blocks} editable={editable} onOpen={onOpenTicket} onRemove={remove} />
      <Group name={t.deps.related} items={links.related} editable={editable} onOpen={onOpenTicket} onRemove={remove} />
      {command.error && (
        <p role="alert" className="text-destructive">
          {command.error}
        </p>
      )}
      {editable && <AddLinkForm project={project} ticket={ticket} />}
    </section>
  );
}
```
(Le texte du bouton d'une ligne est « KIB-5 Loro » : `StatusDot` est `aria-hidden` ou sans texte ; vérifier `packages/sdk/src/status.tsx`, sinon les attentes `textContent` s'adaptent.)

`packages/ui/src/ticket/AddLinkForm.tsx` :
```tsx
import { KiboError, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { linkCandidates } from "./links";
import { describeTicketError, useTicketCommand } from "./use-ticket-command";

type Direction = "blockedBy" | "blocks" | "relates";
const DIRECTIONS: Direction[] = ["blockedBy", "blocks", "relates"];
const LABELS: Record<Direction, string> = { blockedBy: t.deps.blockedBy, blocks: t.deps.blocks, relates: t.deps.related };

export const describeLinkError = (e: unknown): string =>
  e instanceof KiboError && e.code === "INVALID_INPUT" ? t.deps.duplicate : e instanceof KiboError && e.code === "LINK_CYCLE" ? t.errors.LINK_CYCLE : describeTicketError(e);

export function linkCommand(ticketId: string, otherId: string, direction: Direction) {
  if (direction === "blockedBy") return { method: "addLink" as const, from: otherId, to: ticketId, type: "blocks" as const };
  return { method: "addLink" as const, from: ticketId, to: otherId, type: direction === "blocks" ? ("blocks" as const) : ("relates" as const) };
}

export function AddLinkForm({ project, ticket }: { project: ProjectSnapshot; ticket: TicketView }) {
  const command = useTicketCommand(project.meta.id, describeLinkError);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("blockedBy");
  const [query, setQuery] = useState("");
  if (!open)
    return (
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t.deps.add}
      </Button>
    );
  const candidates = linkCandidates(project, ticket.id, query);
  const add = async (otherId: string) => {
    if (await command.run(linkCommand(ticket.id, otherId, direction))) setQuery("");
  };
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
          <SelectTrigger size="sm" aria-label={t.deps.type} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIRECTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input aria-label={t.deps.search} placeholder={t.deps.searchPlaceholder} value={query} autoFocus className="h-8" onChange={(e) => setQuery(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.deps.close}
        </Button>
      </div>
      {candidates.length === 0 ? (
        <p className="text-muted-foreground">{t.deps.noResult}</p>
      ) : (
        <ul role="listbox" aria-label={t.deps.search} className="grid gap-0.5">
          {candidates.map((c) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={false} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent" disabled={command.busy} onClick={() => void add(c.id)}>
                <span className="font-mono text-2xs">{c.keyLabel}</span>
                <span className="truncate">{c.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {command.error && (
        <p role="alert" className="text-destructive">
          {command.error}
        </p>
      )}
    </div>
  );
}
```
(`v as Direction` : justifié, `Select` ne renvoie que les valeurs de `DIRECTIONS`.) `useTicketCommand(projectId, describe?)` : second paramètre optionnel ajouté par T6 (Contrats partagés).

`packages/ui/src/shell/TicketDetail.tsx` : supprimer le bloc `t.waitingOn.length > 0 && (…)` et l'import `Badge` s'il ne sert plus ; après la `dl` (et l'erreur de commande), insérer `<DependenciesSection project={project} ticket={t} editable={editable} onOpenTicket={onOpenTicket} />`. `fr.ticket.waiting` reste utilisé ailleurs ? Vérifier avec `grep -rn "ticket.waiting" packages/ui/src` ; s'il n'a plus d'usage, le retirer de `fr.ts`.

Run: `bun test packages/ui/src/ticket packages/ui/src/shell/sheet` — Expected: PASS.

- [x] **Step 5: Gate, budget, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; budget inchangé (`ticket/` hors de l'entrée).

```bash
git add packages/ui/src/ticket/links.ts packages/ui/src/ticket/links.test.ts packages/ui/src/i18n/fr-ticket-edit.ts
git commit -m "feat(ui): liens d'un ticket regroupés"
git add packages/ui/src/ticket/DependenciesSection.tsx packages/ui/src/ticket/AddLinkForm.tsx packages/ui/src/ticket/dependencies.test.tsx packages/ui/src/shell/TicketDetail.tsx
git commit -m "feat(ui): dépendances dans la fiche ticket"
```
(Ajouter `packages/ui/src/i18n/fr.ts` au second commit si `ticket.waiting` a été retiré.)

### Task 15: Menu des fichiers modifiés et (dés)indexer tout

Vague 2 ← T2, T3. Spec §12.1 à §12.4 (menu **fichier modifié**), écran 104. Chaque ligne de la vue Changements gagne un menu (clic droit et « ⋯ », même liste) : Voir le diff, Ouvrir dans un onglet, Ouvrir dans l'éditeur externe, Copier le chemin, Indexer / Désindexer, séparateur, Annuler les changements… ; un fichier **en conflit** n'a ni Indexer ni Annuler. Les en-têtes de section portent « Tout indexer » (Non indexés) et « Tout désindexer » (Indexés). « Annuler les changements… » confirme en disant, fichier par fichier, ce qui revient à sa dernière version commitée et ce qui est **supprimé du disque** (fichier nouveau), puis envoie `discardChanges { paths }` (T3 ; un renommage envoie `path` et `origPath`, comme `unstageFiles`). Une session distante reçoit `FORBIDDEN` : le texte l'explique.

**Complément T3b (vague 1 bis, intégrée avant T15)** : `FileList` et `ChangesFiles` portent déjà `readOnly: boolean` (vrai en session distante). `fileMenuEntries` reçoit `readOnly: boolean` et, quand il est vrai, ne garde que « Voir le diff », « Ouvrir dans un onglet » et « Copier le chemin » (ni éditeur externe, ni Indexer / Désindexer, ni Annuler les changements…) ; les en-têtes de section ne rendent pas « Tout indexer » / « Tout désindexer » quand `readOnly`. Un test de `file-menu.test.ts` le vérifie (même motif que « a read-only project only opens the page in a new tab » de T7). Le test « … a remote session is told why it is refused » reste : le démon garantit, l'UI masque.

**Files:**
- Create: `packages/ui/src/code/file-menu.ts`, `packages/ui/src/code/file-menu.test.ts`
- Modify: `packages/ui/src/code/FileList.tsx`, `packages/ui/src/code/ChangesFiles.tsx`, `packages/ui/src/code/ChangesView.tsx`, `packages/ui/src/code/changes-files.test.tsx`, `packages/ui/src/code/changes.test.tsx`, `packages/ui/src/i18n/fr-code.ts`, `packages/ui/src/shell/ContentView.tsx` (`onOpen(target, newTab?)`, `onOpenInTab` vers `ChangesView`), `packages/ui/src/shell/Shell.tsx` (`onOpen={(t, newTab) => go(t, newTab)}`)

**Interfaces:**
- Consumes: `ContextMenuEntries`, `DropdownMenuEntries`, `MenuEntry` (T2), `ConfirmDialog` (`shell/lazy-dialogs`, T2), `client.code({ method: "discardChanges" | "stageAll" | "unstageAll", … })` (T3), `errorMessage` (`lib/error-message`), `FileChange` (`@kibo/schema`).
- Produces: `fileMenuEntries`, `discardLines` (`code/file-menu.ts`) ; `FileList` props `+ onOpenInTab(file), onOpenExternal(file), onCopyPath(file), onDiscard(file), onStageAll(), onUnstageAll()` ; `ChangesFiles` idem ; `ChangesView` props `+ onOpenInTab(ref: FileRef): void` ; `ContentView.onOpen(target: TabTarget, newTab?: boolean)`.

- [x] **Step 1: Textes**

`packages/ui/src/i18n/fr-code.ts` › `changes`, ajouter :
```ts
    fileActions: (path: string) => `Actions ${path}`,
    viewDiff: "Voir le diff",
    openInTab: "Ouvrir dans un onglet",
    copyPath: "Copier le chemin",
    copied: "Chemin copié",
    copyFailed: "Impossible de copier le chemin.",
    stage: "Indexer",
    unstage: "Désindexer",
    stageAll: "Tout indexer",
    unstageAll: "Tout désindexer",
    discard: "Annuler les changements…",
    discardTitle: (names: string[]) =>
      names.length === 1 ? `Annuler les changements de ${names[0]} ?` : `Annuler les changements de ${names.length} fichiers ?`,
    discardRestored: (name: string) => `${name} reviendra à sa dernière version commitée.`,
    discardDeleted: (name: string) => `${name} est nouveau : il sera supprimé du disque.`,
    discardRenamed: (from: string, to: string) => `${to} disparaîtra et ${from} reviendra à sa dernière version commitée.`,
    discardIrreversible: "Cette action est irréversible.",
    discardConfirm: "Annuler les changements",
```
› `errors` : `FORBIDDEN` est déjà là (ajouté par T3b) ; ne rien ajouter. (« Ouvrir dans l'éditeur externe » existe : `openExternal`.)

- [x] **Step 2: Menu et description en données (test rouge puis vert)**

`packages/ui/src/code/file-menu.test.ts` :
```ts
import { expect, mock, test } from "bun:test";
import type { FileChange } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { fr } from "../i18n/fr";
import { discardLines, type FileMenuActions, fileMenuEntries } from "./file-menu";

const file = (patch: Partial<FileChange>): FileChange => ({
  path: "packages/core/ticket.ts",
  origPath: null,
  area: "unstaged",
  kind: "modified",
  additions: 1,
  deletions: 1,
  ...patch,
});
const actions = (): FileMenuActions => ({
  viewDiff: mock(() => {}),
  openInTab: mock(() => {}),
  openExternal: mock(() => {}),
  copyPath: mock(() => {}),
  toggleStage: mock(() => {}),
  discard: mock(() => {}),
});
const labels = (entries: ReturnType<typeof fileMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));

test("an unstaged file offers Indexer and Annuler, a staged one Désindexer", () => {
  const a = actions();
  const entries = fileMenuEntries({ file: file({}), texts: fr.changes, actions: a });
  expect(labels(entries)).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
    "—",
    "Indexer",
    "—",
    "Annuler les changements…",
  ]);
  expect(labels(fileMenuEntries({ file: file({ area: "staged" }), texts: fr.changes, actions: a }))).toContain("Désindexer");
  const discard = entries.at(-1);
  expect(discard && !isSeparator(discard) && !isSubmenu(discard) && discard.destructive).toBe(true);
});

test("a conflicted file has neither Indexer nor Annuler", () => {
  expect(labels(fileMenuEntries({ file: file({ kind: "conflicted" }), texts: fr.changes, actions: actions() }))).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
  ]);
});

test("discard lines say what is restored and what is deleted from disk", () => {
  expect(discardLines(file({}), fr.changes)).toEqual(["ticket.ts reviendra à sa dernière version commitée."]);
  expect(discardLines(file({ path: "docs/notes.md", kind: "untracked" }), fr.changes)).toEqual(["notes.md est nouveau : il sera supprimé du disque."]);
  expect(discardLines(file({ path: "docs/notes.md", area: "staged", kind: "added" }), fr.changes)).toEqual(["notes.md est nouveau : il sera supprimé du disque."]);
  expect(discardLines(file({ kind: "deleted" }), fr.changes)).toEqual(["ticket.ts reviendra à sa dernière version commitée."]);
  expect(discardLines(file({ path: "src/renamed.ts", origPath: "src/legacy.ts", area: "staged", kind: "renamed" }), fr.changes)).toEqual([
    "renamed.ts disparaîtra et legacy.ts reviendra à sa dernière version commitée.",
  ]);
});
```
Run: `bun test packages/ui/src/code/file-menu.test.ts` — Expected: FAIL.

`packages/ui/src/code/file-menu.ts` :
```ts
import type { FileChange } from "@kibo/schema";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, ExternalLink, FileDiff, Minus, Plus, SquareArrowOutUpRight, Undo2 } from "lucide-react";
import type { frCode } from "../i18n/fr-code";

export type FileMenuTexts = typeof frCode.changes;
export type FileMenuActions = {
  viewDiff(): void;
  openInTab(): void;
  openExternal(): void;
  copyPath(): void;
  toggleStage(): void;
  discard(): void;
};

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const NEW_KINDS = new Set<FileChange["kind"]>(["untracked", "added"]);

export function fileMenuEntries(input: { file: FileChange; texts: FileMenuTexts; actions: FileMenuActions }): MenuEntry[] {
  const { file, texts, actions } = input;
  const entries: MenuEntry[] = [
    { label: texts.viewDiff, icon: FileDiff, onSelect: actions.viewDiff },
    { label: texts.openInTab, icon: ExternalLink, onSelect: actions.openInTab },
    { label: texts.openExternal, icon: SquareArrowOutUpRight, onSelect: actions.openExternal },
    { label: texts.copyPath, icon: Copy, onSelect: actions.copyPath },
  ];
  if (file.kind === "conflicted") return entries;
  const staged = file.area === "staged";
  return [
    ...entries,
    { separator: true },
    { label: staged ? texts.unstage : texts.stage, icon: staged ? Minus : Plus, onSelect: actions.toggleStage },
    { separator: true },
    { label: texts.discard, icon: Undo2, destructive: true, onSelect: actions.discard },
  ];
}

export function discardPaths(file: FileChange): string[] {
  return file.origPath ? [file.path, file.origPath] : [file.path];
}

export function discardLines(file: FileChange, texts: FileMenuTexts): string[] {
  if (file.origPath) return [texts.discardRenamed(basename(file.origPath), basename(file.path))];
  if (NEW_KINDS.has(file.kind)) return [texts.discardDeleted(basename(file.path))];
  return [texts.discardRestored(basename(file.path))];
}
```
Run: `bun test packages/ui/src/code/file-menu.test.ts` — Expected: PASS, 3 tests.

- [x] **Step 3: Tests de la liste et de la vue (rouges)**

`packages/ui/src/code/changes-files.test.tsx` : `renderFiles` passe les nouveaux props (`mock`s) et les renvoie ; ajouter
```tsx
test("each row has a ⋯ menu and a context menu with the same entries; section headers stage or unstage everything", async () => {
  const { onStageAll, onUnstageAll, onDiscard, onCopyPath } = renderFiles([file, { ...file, path: "README.md", area: "unstaged", kind: "untracked" }]);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions packages/core/ticket.ts" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
    "Désindexer",
    "Annuler les changements…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Copier le chemin" }));
  expect(onCopyPath).toHaveBeenCalledWith(file);
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: /README\.md/ }) });
  await user.click(await screen.findByRole("menuitem", { name: "Annuler les changements…" }));
  expect(onDiscard).toHaveBeenCalledWith(expect.objectContaining({ path: "README.md" }));
  await user.click(screen.getByRole("button", { name: "Tout indexer" }));
  expect(onStageAll).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Tout désindexer" }));
  expect(onUnstageAll).toHaveBeenCalledTimes(1);
});

test("empty sections have no bulk button", () => {
  renderFiles([file]);
  expect(screen.getByRole("button", { name: "Tout désindexer" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tout indexer" })).toBeNull();
});
```
`packages/ui/src/code/changes.test.tsx` : `renderView` passe `onOpenInTab={onOpenInTab}` (un `mock` partagé remis à zéro dans `beforeEach`) ; ajouter
```tsx
test("Annuler les changements asks, names the deleted file, then sends discardChanges with the rename source", async () => {
  status = {
    ...baseStatus,
    files: [
      { path: "src/renamed.ts", origPath: "src/legacy.ts", area: "staged", kind: "renamed", additions: 0, deletions: 0 },
      { path: "docs/notes.md", origPath: null, area: "unstaged", kind: "untracked", additions: 3, deletions: 0 },
    ],
  };
  renderView();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions docs/notes.md" }));
  await user.click(await screen.findByRole("menuitem", { name: "Annuler les changements…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Annuler les changements de notes.md ?" });
  expect(confirm.textContent).toContain("notes.md est nouveau : il sera supprimé du disque.");
  expect(confirm.textContent).toContain("Cette action est irréversible.");
  await user.click(within(confirm).getByRole("button", { name: "Annuler les changements" }));
  await waitFor(() => expect(calls.find((c) => c.method === "discardChanges")).toEqual({ method: "discardChanges", projectId: "p1", worktree: "/repo", paths: ["docs/notes.md"] }));
  await user.click(screen.getByRole("button", { name: "Actions src/renamed.ts" }));
  await user.click(await screen.findByRole("menuitem", { name: "Annuler les changements…" }));
  const renamed = await screen.findByRole("alertdialog", { name: "Annuler les changements de renamed.ts ?" });
  expect(renamed.textContent).toContain("renamed.ts disparaîtra et legacy.ts reviendra à sa dernière version commitée.");
  await user.click(within(renamed).getByRole("button", { name: "Annuler les changements" }));
  await waitFor(() => expect(calls.filter((c) => c.method === "discardChanges").at(-1)).toMatchObject({ paths: ["src/renamed.ts", "src/legacy.ts"] }));
});

test("Tout indexer and Tout désindexer call the daemon; a remote session is told why it is refused", async () => {
  renderView();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Tout indexer" }));
  await waitFor(() => expect(calls.find((c) => c.method === "stageAll")).toEqual({ method: "stageAll", projectId: "p1", worktree: "/repo" }));
  overrides = { unstageAll: () => Promise.reject(new KiboError("FORBIDDEN", "local only")) };
  await user.click(screen.getByRole("button", { name: "Tout désindexer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Cette action n'est possible que depuis l'ordinateur où tourne Kibo.");
});

test("Ouvrir dans un onglet and Copier le chemin", async () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void written.push(t) } });
  renderView();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions packages/core/index.ts" }));
  await user.click(await screen.findByRole("menuitem", { name: "Ouvrir dans un onglet" }));
  expect(onOpenInTab).toHaveBeenCalledWith({ projectId: "p1", worktree: "/repo", path: "packages/core/index.ts", line: null, origin: null });
  await user.click(screen.getByRole("button", { name: "Actions packages/core/index.ts" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copier le chemin" }));
  expect(written).toEqual(["packages/core/index.ts"]);
  expect((await screen.findByRole("status")).textContent).toBe("Chemin copié");
});
```
Run: `bun test packages/ui/src/code/changes-files.test.tsx packages/ui/src/code/changes.test.tsx` — Expected: FAIL (5 tests).

- [x] **Step 4: Liste, panneau, vue**

`packages/ui/src/code/FileList.tsx` :
- Props `+ onOpenInTab(file: FileChange): void; onOpenExternal(file: FileChange): void; onCopyPath(file: FileChange): void; onDiscard(file: FileChange): void; onStageAll(): void; onUnstageAll(): void` ;
- `Row` construit `const entries = fileMenuEntries({ file, texts: fr.changes, actions: { viewDiff: () => onSelect(file), openInTab: () => onOpenInTab(file), openExternal: () => onOpenExternal(file), copyPath: () => onCopyPath(file), toggleStage: () => onToggle(file), discard: () => onDiscard(file) } });` ; le `<li>` est enveloppé dans `<ContextMenu><ContextMenuTrigger asChild>…</ContextMenuTrigger><ContextMenuContent><ContextMenuEntries entries={entries} /></ContextMenuContent></ContextMenu>` ; après les compteurs `+/−`, un `DropdownMenu` avec `Button size="icon" variant="ghost" className="size-6" aria-label={fr.changes.fileActions(file.path)}` (`Ellipsis`) et `<DropdownMenuEntries entries={entries} />` ;
- `Section` reçoit `bulk: { label: string; onClick(): void } | null` et rend, après le compteur du titre, `{bulk && files.length > 0 && <Button size="sm" variant="ghost" className="h-6 px-2 text-2xs" disabled={busy} onClick={(e) => { e.stopPropagation(); bulk.onClick(); }}>{bulk.label}</Button>}` — le bouton est **hors** du `<button>` d'en-tête (un bouton dans un bouton est invalide) : transformer l'en-tête en `<div className="flex items-center">` contenant le bouton replier/déplier (`flex-1`) puis le bouton de lot ;
- `FileList` passe `bulk={{ label: fr.changes.unstageAll, onClick: onUnstageAll }}` à la section `staged` et `bulk={{ label: fr.changes.stageAll, onClick: onStageAll }}` à la section `unstaged`.

`packages/ui/src/code/ChangesFiles.tsx` : mêmes props ajoutés, passés à `FileList`.

`packages/ui/src/code/ChangesView.tsx` :
- Props `+ onOpenInTab(ref: FileRef): void` (transmis à `ChangesBody`) ;
- état : `const [discarding, setDiscarding] = useState<FileChange | null>(null);` et `const { message: copyNotice, tone: copyTone, flash } = useFlash();` (`lib/use-flash`) ;
- actions :
```tsx
  const copyPath = (f: FileChange) =>
    navigator.clipboard.writeText(f.path).then(
      () => flash(fr.changes.copied),
      () => flash(fr.changes.copyFailed, "error"),
    );
  const discard = async (f: FileChange) => {
    await client.code({ method: "discardChanges", ...w, paths: discardPaths(f) });
    setSelection(null);
    reload();
  };
```
- `ChangesFiles` reçoit `onOpenInTab={(f) => onOpenInTab({ ...w, path: f.path, line: null, origin: null })}`, `onOpenExternal={(f) => void run(() => client.code({ method: "openInEditor", ...w, path: f.path, line: null }))}`, `onCopyPath={(f) => void copyPath(f)}`, `onDiscard={setDiscarding}`, `onStageAll={() => void run(() => client.code({ method: "stageAll", ...w }))}`, `onUnstageAll={() => void run(() => client.code({ method: "unstageAll", ...w }))}` ;
- `copyNotice` s'affiche près des alertes : `{copyNotice && <p role={copyTone === "error" ? "alert" : "status"} className="px-4 py-1 text-xs text-muted-foreground">{copyNotice}</p>}` (dans `ChangesAlerts` si elle accepte un `notice` : elle en a un, `notice` ; sinon juste sous) ;
- en fin de composant :
```tsx
      {discarding && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDiscarding(null)}
          title={fr.changes.discardTitle([basename(discarding.path)])}
          description={
            <span className="grid gap-1">
              {discardLines(discarding, fr.changes).map((line) => (
                <span key={line}>{line}</span>
              ))}
              <span>{fr.changes.discardIrreversible}</span>
            </span>
          }
          confirmLabel={fr.changes.discardConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={() => discard(discarding)}
          describeError={errorMessage}
        />
      )}
```
(`ConfirmDialog` depuis `../shell/lazy-dialogs` ; `basename` local ou exporté de `file-menu.ts`.)

`packages/ui/src/shell/ContentView.tsx` : `onOpen(target: TabTarget, newTab?: boolean): void` ; `ChangesView` reçoit `onOpenInTab={(ref) => p.onOpen({ kind: "file", projectId: ref.projectId, worktree: ref.worktree, path: ref.path, line: ref.line }, true)}`. `Shell.tsx` : `onOpen={(t, newTab) => go(t, newTab)}`.

Run: `bun test packages/ui/src/code packages/ui/src/shell/shell.test.tsx` — Expected: PASS.

- [x] **Step 5: Gate, budget, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; budget inchangé (`code/` hors de l'entrée via `ChangesView`).

```bash
git add packages/ui/src/code/file-menu.ts packages/ui/src/code/file-menu.test.ts packages/ui/src/i18n/fr-code.ts
git commit -m "feat(ui): menu d'un fichier modifié en données"
git add packages/ui/src/code/FileList.tsx packages/ui/src/code/ChangesFiles.tsx packages/ui/src/code/ChangesView.tsx packages/ui/src/code/changes-files.test.tsx packages/ui/src/code/changes.test.tsx packages/ui/src/shell/ContentView.tsx packages/ui/src/shell/Shell.tsx
git commit -m "feat(ui): annuler, tout indexer, menu des fichiers"
```

### Task 16: E2E menus et fiche ticket

Vague 3 ← T6, T7, T15 (et T3). Un parcours Playwright par thème sur un vrai démon (scénario `question`, sans token consommé : faux `claude`), ports **4415 / 4416** (les faux GitHub et MCP dérivés, `+1000` / `+2000`, restent libres). Le parcours enchaîne les quatre menus livrés : page (renommer, supprimer), fiche ticket (titre en place, ouverture depuis la carte Kanban), fichier modifié (annuler les changements) ; il prend les captures `ecran-98`, `ecran-101`, `ecran-104` en sombre et en clair pour le contrôle visuel du jalon.

**Files:**
- Create: `e2e/menus.spec.ts`
- Modify: `e2e/playwright.config.ts` (deux entrées dans `daemons`)

**Interfaces:**
- Consumes: `createE2eRepo`, `E2eRepo` (`e2e/git-repo.ts`), `createRepoProject`, `projectKey`, `shot` (`e2e/repo-project.ts`), `createPage`, `addComponent` (`e2e/helpers.ts`), `rpc`, `text` (`e2e/agents-seed.ts`), `E2E_TOKEN` (`e2e/token.ts`) ; textes des tâches T6, T7, T15 (mot pour mot).
- Produces: rien (vérification).

- [ ] **Step 1: Configuration**

`e2e/playwright.config.ts`, dans `daemons`, après les entrées `ia-*` :
```ts
  { name: "menus-dark", scheme: "dark", port: 4415, spec: /menus\.spec\.ts/, scenario: "question" },
  { name: "menus-light", scheme: "light", port: 4416, spec: /menus\.spec\.ts/, scenario: "question" },
```

- [ ] **Step 2: Le parcours (rouge tant que T6, T7, T15 ne sont pas intégrées)**

`e2e/menus.spec.ts` :
```ts
import { expect, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { addComponent, createPage } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("menus des pages, fiche ticket éditable, annulation d'un fichier", async ({ page }, info) => {
  const key = projectKey("MNU", info);
  const created = createE2eRepo(key);
  repo = created;
  const name = `Menus ${key}`;
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, name, key, created.repo);

  await createPage(page, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const bar = page.getByRole("tablist", { name: "Onglets" });
  await expect(bar.getByRole("tab", { name: `${name} · Kanban` })).toHaveAttribute("aria-selected", "true");

  const projects = await rpc(page, { method: "listProjects" });
  const project = (projects as { name: string; id: string }[]).find((p) => p.name === name);
  if (!project) throw new Error("project not listed");
  const ticket = await rpc(page, {
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Schéma Loro des tickets", statusId: "todo" },
  });
  const ticketKey = text(ticket, "key");

  const card = page.getByRole("button", { name: "Schéma Loro des tickets" });
  await expect(card).toBeVisible();
  await card.click();
  const sheet = page.getByRole("dialog").filter({ hasText: ticketKey });
  await sheet.getByRole("button", { name: "Modifier le titre" }).click();
  const title = sheet.getByRole("textbox", { name: "Titre" });
  await title.fill("Schéma Loro des tickets (LoroTree)");
  await sheet.getByRole("button", { name: `Actions ${ticketKey}` }).click();
  await expect(page.getByRole("menuitem", { name: "Supprimer…" })).toBeVisible();
  await shot(page, info, "ecran-98");
  await page.keyboard.press("Escape");
  await title.press("Enter");
  await expect(sheet.getByRole("button", { name: "Modifier le titre" })).toHaveText("Schéma Loro des tickets (LoroTree)");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Schéma Loro des tickets (LoroTree)" })).toBeVisible();

  const sidebarPage = page.getByRole("button", { name: "Kanban", exact: true });
  await sidebarPage.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Renommer…" })).toBeVisible();
  await shot(page, info, "ecran-101");
  await page.getByRole("menuitem", { name: "Renommer…" }).click();
  const rename = page.getByRole("dialog", { name: "Renommer la page" });
  await rename.getByLabel("Nom").fill("Tableau");
  await rename.getByRole("button", { name: "Renommer" }).click();
  await expect(rename).toBeHidden();
  await expect(bar.getByRole("tab", { name: `${name} · Tableau` })).toHaveAttribute("aria-selected", "true");

  created.write("README.md", "# test\nligne ajoutée\n");
  created.write("docs/notes.md", "# notes\n");
  await page.getByRole("button", { name: /^Changements/ }).click();
  const unstaged = page.getByRole("group", { name: "Non indexés" });
  await expect(unstaged.getByText("README.md")).toBeVisible();
  await expect(unstaged.getByText("notes.md")).toBeVisible();
  await unstaged.getByRole("button", { name: /notes\.md/ }).first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Annuler les changements…" })).toBeVisible();
  await shot(page, info, "ecran-104");
  await page.getByRole("menuitem", { name: "Annuler les changements…" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Annuler les changements de notes.md ?" });
  await expect(confirm.getByText("notes.md est nouveau : il sera supprimé du disque.")).toBeVisible();
  await confirm.getByRole("button", { name: "Annuler les changements" }).click();
  await expect(confirm).toBeHidden();
  await expect(unstaged.getByText("notes.md")).toBeHidden();
  await expect(unstaged.getByText("README.md")).toBeVisible();
  expect(created.git("status", "--porcelain")).not.toContain("notes.md");

  await page.getByRole("button", { name: "Tableau", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Supprimer…" }).click();
  const remove = page.getByRole("alertdialog", { name: "Supprimer la page Tableau ?" });
  await expect(remove.getByText(/1 widget/)).toBeVisible();
  await remove.getByRole("button", { name: "Supprimer" }).click();
  await expect(remove).toBeHidden();
  await bar.getByRole("tab", { name: "Page introuvable" }).click();
  await expect(page.getByRole("main").getByText("Page introuvable")).toBeVisible();
});
```
Notes : `createPage` clique « Nouvelle page » dans `main` (page d'accueil du projet, affichée après la création) ; `addComponent` ajoute le Kanban à la vue. Le bouton de la carte Kanban porte le titre du ticket (`KanbanCard`, `<button>` du titre). Après `Escape` sur le menu « ⋯ », le champ du titre est toujours ouvert (`Escape` ferme le menu, pas le champ : Radix arrête l'événement) ; si le champ s'est fermé, rouvrir par « Modifier le titre » avant `Enter`. La liste « Non indexés » rend ses lignes comme `button` ; le clic droit sur la ligne ouvre le menu Kibo. Le texte de confirmation de la page dit « Ses 1 widget disparaîtront. Les tickets ne sont pas touchés. » (fonction `deletePageHelp(0, 1)` de T7 : vérifier l'accord et, si le libellé d'un widget seul est ajusté en T7, mettre l'expression à jour). Sur la page supprimée, l'onglet devient « Page introuvable » (`describeTarget`) et le contenu affiche `fr.tabs.missingPage`.

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test -- --project menus-dark --project menus-light`
Expected: PASS sur les deux thèmes ; `e2e/test-results/**/ecran-98.png`, `ecran-101.png`, `ecran-104.png` présents pour chaque thème. Puis `bun run --cwd e2e test -- --project tabs-dark --project code-dark` : aucune régression sur les specs qui touchent les mêmes écrans.

- [ ] **Step 3: Commit**

```bash
git add e2e/menus.spec.ts e2e/playwright.config.ts
git commit -m "test(e2e): menus, fiche ticket et annulation"
```

### Task 3b: Démon : toutes les mutations git réservées à la machine, vue Code distante en lecture

Vague 1 bis ← T3 (intégrée dans `phase/9`). Spec §12.3 (décision d'Adam du 2026-09-27) : **toutes** les requêtes de `/api/code` qui modifient le dépôt ou lancent un programme sont refusées en `FORBIDDEN` depuis une session distante ; seules les lectures restent ouvertes ; l'interface distante masque ces actions. Relue par `kibo-lead` (session distante). Liste établie sur `packages/schema/src/code.ts` et `packages/daemon/src/code/code-service.ts` :

| Réservées à la machine locale (14) | Ouvertes à distance (9 : lectures sans effet) |
|---|---|
| `writeFile`, `stageFiles`, `unstageFiles`, `discardChanges`, `stageAll`, `unstageAll`, `stageHunk`, `commit`, `reword`, `undoCommit`, `abortOperation`, `push`, `createPr` (les 13 `MUTATION_METHODS` du service ; `createPr` pousse puis lance `gh pr create`) et `openInEditor` (lance l'éditeur) | `worktrees`, `status`, `diff`, `readFile`, `remoteBranches`, `compare`, `commitDefaults`, `ghStatus` (`gh auth status`, sans écriture), `prForBranch` (`gh pr view`) |

Le schéma devient la source unique : `CODE_MUTATION_METHODS` (13), `LOCAL_ONLY_CODE_METHODS` (= mutations + `openInEditor`) et `CODE_READ_METHODS` (9). Le service refuse à distance toute méthode absente de `CODE_READ_METHODS` (liste blanche, fermé par défaut : une méthode future non classée est refusée), et un test du schéma oblige à classer toute méthode future dans l'une des deux listes, disjointes. Côté UI, la vue Changements et l'onglet fichier reçoivent `remote` (défaut `isRemoteView()`, motif déjà employé par `ComponentSourcesPage`, `ShareProjectDialog`, `TrustDialog`) et n'affichent alors aucune action d'écriture : ni cases « Indexer », ni boutons de bloc, ni « Édition », ni « Ouvrir dans l'éditeur externe », ni « Abandonner », ni panneau Commit / Pousser / PR ; une ligne explique pourquoi. Le démon garantit, l'UI masque (colonne « Réel »).

**Files:**
- Modify: `packages/schema/src/code.ts` (`CODE_MUTATION_METHODS`, `LOCAL_ONLY_CODE_METHODS`, `CODE_READ_METHODS`), `packages/schema/src/code.test.ts`
- Modify: `packages/daemon/src/code/code-service.ts` (importe `CODE_MUTATION_METHODS` et `CODE_READ_METHODS`), `packages/daemon/src/code/code-service.test.ts` (refus distant des 14 méthodes sans lancer git ni gh, refus d'une méthode non classée, lectures ouvertes), `packages/daemon/src/server-code.test.ts` (le test HTTP distant couvre `commit` et `stageAll` en plus d'`openInEditor`)
- Modify: `packages/ui/src/code/ChangesView.tsx` (`remote`), `packages/ui/src/code/ChangesFiles.tsx`, `packages/ui/src/code/FileList.tsx`, `packages/ui/src/code/DiffColumn.tsx`, `packages/ui/src/code/DiffToolbar.tsx`, `packages/ui/src/code/DiffView.tsx`, `packages/ui/src/code/OperationBanner.tsx`, `packages/ui/src/files/FileTabView.tsx` (`remote`), `packages/ui/src/files/FilePreviewSheet.tsx` (`remote` : ni « Modifier », ni éditeur externe, raccourci inactif), `packages/ui/src/i18n/fr-code.ts` (`changes.localOnly`, `file.localOnly`, `errors.FORBIDDEN`), `packages/ui/src/code/changes.test.tsx`, `packages/ui/src/files/files.test.tsx`

**Interfaces:**
- Consumes: `requireLocal`, `RpcContext`, `LOCAL_CONTEXT` (T3), `isRemoteView` (`lib/remote-view.ts`), `createGitFixture`, `installFakeBin`, `readFakeBinLog` (`code/testing/git-fixture.ts`), `enableSelfSigned`, `remoteCookie`, `remotePost` (`remote/remote.test-helper.ts`).
- Produces: Contrats partagés › Démon et schéma › T3b ; `ChangesView` props `+ remote?: boolean` ; `ChangesFiles`, `FileList`, `DiffColumn`, `DiffToolbar` props `+ readOnly: boolean` ; `DiffView.onHunk?` (optionnel) ; `ChangesAlerts` et `OperationBanner` `onAbort: (() => void) | null` ; `FileTabView` props `+ remote?: boolean`. T15 s'appuie sur `FileList.readOnly` (voir son complément).

- [x] **Step 1: Schéma (test rouge puis vert)**

`packages/schema/src/code.test.ts` : retirer la ligne `expect(LOCAL_ONLY_CODE_METHODS).toEqual([...])` du test de T3 et ajouter (`CODE_MUTATION_METHODS` et `CODE_READ_METHODS` importés) :
```ts
  test("every code request is either a local-only mutation or a listed read", () => {
    expect(CODE_MUTATION_METHODS).toEqual([
      "writeFile",
      "stageFiles",
      "unstageFiles",
      "discardChanges",
      "stageAll",
      "unstageAll",
      "stageHunk",
      "commit",
      "reword",
      "undoCommit",
      "abortOperation",
      "push",
      "createPr",
    ]);
    expect(LOCAL_ONLY_CODE_METHODS).toEqual([...CODE_MUTATION_METHODS, "openInEditor"]);
    expect(CODE_READ_METHODS).toEqual([
      "worktrees",
      "status",
      "diff",
      "readFile",
      "remoteBranches",
      "compare",
      "commitDefaults",
      "ghStatus",
      "prForBranch",
    ]);
    const reads = new Set<string>(CODE_READ_METHODS);
    expect(LOCAL_ONLY_CODE_METHODS.filter((m) => reads.has(m))).toEqual([]);
    const methods = CodeRequest.options.map((o) => o.shape.method.value);
    expect([...methods].sort()).toEqual([...LOCAL_ONLY_CODE_METHODS, ...CODE_READ_METHODS].sort());
  });
```
(Le dernier `expect` fait échouer le test dès qu'une méthode nouvelle n'est classée ni locale ni lecture ; le précédent interdit qu'une méthode soit dans les deux listes. Aucune liste locale au test : classer une méthode oblige à modifier le schéma, donc le service.)

Run: `bun test packages/schema/src/code.test.ts` — Expected: FAIL (`CODE_MUTATION_METHODS`, `CODE_READ_METHODS` introuvables).

`packages/schema/src/code.ts`, remplacer `LOCAL_ONLY_CODE_METHODS` par :
```ts
export const CODE_MUTATION_METHODS = [
  "writeFile",
  "stageFiles",
  "unstageFiles",
  "discardChanges",
  "stageAll",
  "unstageAll",
  "stageHunk",
  "commit",
  "reword",
  "undoCommit",
  "abortOperation",
  "push",
  "createPr",
] as const satisfies readonly CodeRequest["method"][];

export const LOCAL_ONLY_CODE_METHODS = [
  ...CODE_MUTATION_METHODS,
  "openInEditor",
] as const satisfies readonly CodeRequest["method"][];

export const CODE_READ_METHODS = [
  "worktrees",
  "status",
  "diff",
  "readFile",
  "remoteBranches",
  "compare",
  "commitDefaults",
  "ghStatus",
  "prForBranch",
] as const satisfies readonly CodeRequest["method"][];
```

Run: `bun test packages/schema/src/code.test.ts` — Expected: PASS.

- [x] **Step 2: Service : refus par méthode (tests rouges puis verts)**

`packages/daemon/src/code/code-service.test.ts` : remplacer le test « discardChanges, stageAll, unstageAll and openInEditor are refused from a remote session » par (imports : `CodeRequest`, `LOCAL_ONLY_CODE_METHODS`, `RepoStatus` de `@kibo/schema` ; `RpcContext` de `../rpc-extensions`) :
```ts
const REMOTE: RpcContext = { sessionHash: "remote", remote: true };
const localOnlyRequests = (): CodeRequest[] => {
  const sha = "a".repeat(40);
  return [
    { method: "writeFile", ...w(), path: "README.md", content: "x\n", baseHash: sha },
    { method: "stageFiles", ...w(), paths: ["README.md"] },
    { method: "unstageFiles", ...w(), paths: ["README.md"] },
    { method: "discardChanges", ...w(), paths: ["README.md"] },
    { method: "stageAll", ...w() },
    { method: "unstageAll", ...w() },
    { method: "stageHunk", ...w(), path: "README.md", area: "unstaged", index: 0, header: "@@ -1 +1 @@" },
    { method: "commit", ...w(), message: "feat: x", amend: false },
    { method: "reword", ...w(), sha, message: "feat: y" },
    { method: "undoCommit", ...w(), sha },
    { method: "abortOperation", ...w() },
    { method: "push", ...w() },
    { method: "createPr", ...w(), title: "x", body: "", base: "main", draft: false, reviewers: [], ticketId: null },
    { method: "openInEditor", ...w(), path: "README.md", line: null },
  ];
};

test("every mutation and openInEditor are refused from a remote session before anything runs", async () => {
  const editor = installFakeBin(fx.dir, "code");
  const git = installFakeBin(fx.dir, "git");
  const c = start({
    env: { ...fx.env, ...gh, KIBO_GIT: git.path, VISUAL: editor.path, FAKE_BIN_LOG: git.log },
  });
  fx.write("README.md", "# changed\n");
  const requests = localOnlyRequests();
  expect(requests.map((r) => r.method).sort()).toEqual([...LOCAL_ONLY_CODE_METHODS].sort());
  for (const req of requests) {
    await expect(c.handle(req, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  expect(readFileSync(join(fx.repo, "README.md"), "utf8")).toBe("# changed\n");
  expect(fx.git("status", "--porcelain").trim()).toBe("M README.md");
  expect(fx.git("rev-list", "--count", "HEAD").trim()).toBe("1");
  expect(readFakeBinLog(git.log)).toEqual([]);
  expect(readFakeGhLog(gh)).toEqual([]);
  expect(events).toEqual([]);
});

test("a method listed nowhere is refused from a remote session", async () => {
  const c = start();
  const unclassified = { method: "futureMethod", ...w() } as unknown as CodeRequest;
  await expect(c.handle(unclassified, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("reads stay open to a remote session", async () => {
  const c = start();
  fx.write("README.md", "# changed\n");
  expect(await c.handle({ method: "worktrees", projectId: project.id }, REMOTE)).toHaveLength(1);
  expect(((await c.handle({ method: "status", ...w() }, REMOTE)) as RepoStatus).files).toHaveLength(1);
  expect(
    await c.handle({ method: "diff", ...w(), path: "README.md", origPath: null, area: "unstaged" }, REMOTE),
  ).toMatchObject({ path: "README.md" });
  expect(await c.handle({ method: "readFile", ...w(), path: "README.md", revision: "worktree" }, REMOTE)).toMatchObject({
    content: "# changed\n",
  });
  expect(await c.handle({ method: "remoteBranches", ...w() }, REMOTE)).toMatchObject({ remote: "origin" });
  expect(await c.handle({ method: "commitDefaults", ...w() }, REMOTE)).toMatchObject({ message: expect.any(String) });
  expect(await c.handle({ method: "ghStatus", ...w() }, REMOTE)).toMatchObject({ available: expect.any(Boolean) });
});
```
(`fx.git` renvoie la sortie standard ; `as RepoStatus` sur un résultat `unknown`, comme les tests existants du fichier. Le service reçoit un faux `git` par `KIBO_GIT` tandis que `fx.git` garde le vrai : les deux faux binaires écrivent dans le même `FAKE_BIN_LOG`, dont le vide prouve qu'aucun processus n'a été lancé ; `readFakeGhLog(gh)` fait de même pour `gh`, importé de `./testing/git-fixture`. Le cast `as unknown as CodeRequest` simule une méthode ajoutée à l'union sans être classée.)

Run: `bun test packages/daemon/src/code/code-service.test.ts` — Expected: FAIL (`writeFile`, `stageFiles`… passent depuis la session distante ; `futureMethod` n'est pas refusée).

`packages/daemon/src/code/code-service.ts` :
- import : `CODE_MUTATION_METHODS, CODE_READ_METHODS` de `@kibo/schema` ; supprimer la constante locale `MUTATION_METHODS` et `LOCAL_ONLY` (`LOCAL_ONLY_CODE_METHODS` reste pour l'UI et les tests) ;
- `type Mutation = Extract<WorktreeRequest, { method: (typeof CODE_MUTATION_METHODS)[number] }>;`, `const MUTATIONS = new Set<string>(CODE_MUTATION_METHODS);` et `const READS = new Set<string>(CODE_READ_METHODS);` ;
- dans `handle`, remplacer la liste noire de T3 par la liste blanche : `if (!READS.has(req.method)) requireLocal(ctx);` (fermé par défaut : une méthode non classée est refusée à distance).

`packages/daemon/src/server-code.test.ts`, test « openInEditor over the remote listener answers 403 and launches nothing » renommé « local-only requests over the remote listener answer 403 and touch nothing » ; dans son `try`, après `const cookie = await remoteCookie(f);` :
```ts
      fx.write("new.txt", "n\n");
      const w = { projectId, worktree: fx.repo };
      const refused = [
        { method: "openInEditor", ...w, path: "README.md", line: null },
        { method: "commit", ...w, message: "feat: x", amend: false },
        { method: "stageAll", ...w },
      ];
      for (const body of refused) {
        const res = await remotePost(f, "/api/code", body, { cookie });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      }
      const status = await remotePost(f, "/api/code", { method: "status", ...w }, { cookie });
      expect(status.status).toBe(200);
      expect(fx.git("status", "--porcelain").trim()).toBe("?? new.txt");
      expect(readFakeBinLog(editor.log)).toEqual([]);
```
(remplace l'envoi unique de `req` ; `fx.write` existe sur la fixture.)

Run: `bun test packages/daemon/src/code/code-service.test.ts packages/daemon/src/server-code.test.ts` — Expected: PASS.

- [x] **Step 3: Textes**

`packages/ui/src/i18n/fr-code.ts` :
- `changes`, ajouter : `localOnly: "Depuis un autre appareil, tu peux lire les changements mais pas les modifier : indexer, commiter et pousser se font sur l'ordinateur où tourne Kibo.",`
- `file`, ajouter : `localOnly: "Modifier ce fichier ou l'ouvrir dans l'éditeur externe n'est possible que sur l'ordinateur où tourne Kibo.",`
- `errors`, ajouter : `FORBIDDEN: "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.",` (T15 prévoyait cet ajout : il est fait ici, T15 ne l'ajoute plus.)

- [x] **Step 4: Tests UI (rouges)**

`packages/ui/src/code/changes.test.tsx`, ajouter (`LOCAL_ONLY_CODE_METHODS` importé de `@kibo/schema`) :
```tsx
test("a remote view reads the changes but shows no git action", async () => {
  status = { ...baseStatus, operation: "rebase" };
  render(
    <ChangesView project={project} worktree={null} onWorktreeChange={() => {}} onOpenFile={() => {}} remote />,
  );
  expect(await screen.findByRole("region", { name: "@@ -1,2 +1,2 @@" })).toBeTruthy();
  expect(screen.getByText(/se font sur l'ordinateur où tourne Kibo/)).toBeTruthy();
  expect(screen.getByText(/Rebase en cours/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Abandonner" })).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /Indexer le bloc|Désindexer le bloc/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Édition" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ouvrir dans l'éditeur externe" })).toBeNull();
  expect(screen.queryByLabelText("Message")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Commit|Pousser|Pull request/ })).toBeNull();
  const localOnly = new Set<string>(LOCAL_ONLY_CODE_METHODS);
  expect(calls.filter((c) => localOnly.has(c.method))).toEqual([]);
});
```
(Vérifier les libellés exacts des boutons Commit / Pousser / PR dans `fr-code.ts › commit` et adapter la regex ; l'important est qu'aucun bouton d'écriture ne soit rendu.)

`packages/ui/src/files/files.test.tsx`, ajouter (même `ref` et même montage que « the preview shows the header, metadata, highlighted line and footer ») :
```tsx
test("a remote view previews the file without Modifier nor the external editor, even when asked to edit", async () => {
  render(<FileTabView fileRef={ref} startEditing remote />);
  expect(await screen.findByText(/n'est possible que sur l'ordinateur où tourne Kibo/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ouvrir dans l'éditeur externe" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Enregistrer/ })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
```

Run: `bun test packages/ui/src/code/changes.test.tsx packages/ui/src/files/files.test.tsx` — Expected: FAIL (2 tests : prop `remote` ignorée, actions rendues).

- [x] **Step 5: UI distante en lecture**

`packages/ui/src/code/ChangesView.tsx` :
- `Props + remote?: boolean` ; `export function ChangesView({ project, worktree, onWorktreeChange, onOpenFile, useSlots, remote = isRemoteView() }: Props)` (import `isRemoteView` de `../lib/remote-view`) ; `ChangesBody` reçoit `readOnly={remote}` (`BodyProps + readOnly: boolean`) ;
- dans `ChangesBody` : `<ChangesAlerts … onAbort={readOnly ? null : () => void run(() => client.code({ method: "abortOperation", ...w }))} />` ; `<ChangesFiles … readOnly={readOnly} />` ; `<DiffColumn … readOnly={readOnly} />` ; l'`aside` devient
```tsx
        <aside className="flex min-h-0 flex-col gap-5 overflow-auto border-l p-4">
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{fr.changes.localOnly}</p>
          ) : (
            <>
              <CommitPanel … />
              <UnpushedCommits … />
              <PushActions … />
            </>
          )}
        </aside>
```
  et `{!readOnly && branch && baseBranch && (<PushPrDialog … />)}`. Si `ChangesView.tsx` dépasse ~300 lignes, extraire l'`aside` en `CommitColumn.tsx` (props = celles des trois composants, plus `readOnly`) sans changer leur code.
- `packages/ui/src/code/OperationBanner.tsx` : `onAbort: (() => void) | null` dans `Props` et `AlertsProps` ; le bouton « Abandonner » n'est rendu que si `onAbort` n'est pas nul.
- `packages/ui/src/code/ChangesFiles.tsx` et `FileList.tsx` : `Props + readOnly: boolean`, transmis à `Section` et `Row` ; dans `Row`, la `Checkbox` est remplacée par `<span aria-hidden className="size-4 shrink-0" />` quand `readOnly` (alignement conservé).
- `packages/ui/src/code/DiffColumn.tsx` : `Props + readOnly: boolean` ; `<DiffToolbar … readOnly={p.readOnly} canEdit={canEdit && !p.readOnly} />` ; `<DiffView … onHunk={p.readOnly ? undefined : p.onHunk} />` ; `DiffEditorPane` jamais rendu quand `readOnly` (`editing && canEdit && !p.readOnly`).
- `packages/ui/src/code/DiffToolbar.tsx` : `Props + readOnly: boolean` ; le `Toggle` « Édition » et le bouton « Ouvrir dans l'éditeur externe » ne sont rendus que si `!readOnly`.
- `packages/ui/src/code/DiffView.tsx` : `onHunk?: (index: number, header: string) => void` ; le bouton de bloc n'est rendu que si `onHunk` est défini.
- `packages/ui/src/files/FileTabView.tsx` : `Props + remote?: boolean`, `remote = isRemoteView()` ; `useState(startEditing && !remote)` ; quand `remote`, l'en-tête ne rend ni « Modifier » ni le bouton d'éditeur externe, et une ligne `<p className="px-4 py-2 text-xs text-muted-foreground">{fr.file.localOnly}</p>` suit l'en-tête. Le raccourci ⌘⇧O (`hints`) reste : un appel refusé affiche `errors.FORBIDDEN` par `errorMessage`.

Run: `bun test packages/ui/src/code packages/ui/src/files` — Expected: PASS (les tests existants passent sans changement : `remote` vaut `false` sous happy-dom, `location.hostname` étant vide).

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/schema packages/daemon/src/code packages/daemon/src/server-code.test.ts packages/ui/src/code packages/ui/src/files && bun run budget`
Expected: PASS ; la vue Code et l'onglet fichier sont chargés à la demande (`lazy-screens.ts`) : budget inchangé, noter la valeur.

```bash
git add packages/schema/src/code.ts packages/schema/src/code.test.ts
git commit -m "feat(schema): mutations git réservées au local"
git add packages/daemon/src/code/code-service.ts packages/daemon/src/code/code-service.test.ts packages/daemon/src/server-code.test.ts
git commit -m "feat(daemon): refus distant de toute mutation git"
git add packages/ui/src/code/ChangesView.tsx packages/ui/src/code/ChangesFiles.tsx packages/ui/src/code/FileList.tsx packages/ui/src/code/DiffColumn.tsx packages/ui/src/code/DiffToolbar.tsx packages/ui/src/code/DiffView.tsx packages/ui/src/code/OperationBanner.tsx packages/ui/src/files/FileTabView.tsx packages/ui/src/i18n/fr-code.ts packages/ui/src/code/changes.test.tsx packages/ui/src/files/files.test.tsx
git commit -m "feat(ui): vue Code en lecture seule à distance"
```
(Ajouter `packages/ui/src/code/CommitColumn.tsx` au dernier commit si l'extraction a eu lieu.)

---

### Task 7b: Pages : glisser-déposer qui réordonne entre sœurs

Vague 1 bis ← T7. Décision 6 et spec §12.7 (réponse d'Adam du 2026-09-27 : le glisser-déposer ne se limite pas au reparentage). Sur la base du `ProjectPages` de T7 (`feat/p9-t7`), chaque ligne de page offre trois zones de dépôt : le **quart haut** (« au-dessus »), le **milieu** (« dans », reparentage de T7) et le **quart bas** (« au-dessous »). Déposer au-dessus ou au-dessous d'une sœur envoie `movePage { pageId, parentId: <parent de la cible>, index }` ; déposer dans une page l'envoie sans `index` (fin de ses sous-pages, comme T7) ; déposer sur le nom du projet ramène à la racine. La collision passe de `rectIntersection` (défaut) à `pointerWithin` : la zone est celle sous le pointeur, ce qui rend les bandes fines fiables. La décision est une fonction pure (`page-drop.ts`), testée sans DOM ; `ProjectPages` ne fait que la brancher.

Sémantique de `index`, vérifiée sur Loro (`LoroTree.move`) : **position finale parmi les sœurs**. Sur `a,b,c`, `index 1` pour `a` donne `b,a,c` ; sur `a,b,c,p`, `index 3` pour `c` le met en dernier (`a,b,p,c`) ; sous un autre parent dont les enfants sont `q`, `index 1` pour `a` donne `q,a`. L'interface calcule donc l'index sur la liste des sœurs **sans** la page déplacée : avant la cible ⇒ sa position, après ⇒ sa position + 1. Un dépôt qui laisse la page où elle est n'envoie rien.

**Files:**
- Create: `packages/ui/src/shell/page-drop.ts`, `packages/ui/src/shell/page-drop.test.ts`
- Modify: `packages/ui/src/shell/ProjectPages.tsx`, `packages/ui/src/shell/project-pages.test.tsx` (attentes inchangées ; un test vérifie que le menu reste intact après le changement de collision)

**Interfaces:**
- Consumes: `movePage { pageId, parentId, index? }` (colonne « Réel »), `descendantIds` (`shell/page-menu.ts`, T7), `useDroppable`, `pointerWithin`, `DragEndEvent` (`@dnd-kit/core`), `cn`.
- Produces: Contrats partagés › UI › `page-drop.ts`.

- [x] **Step 1: Le plan de dépôt en données (test rouge puis vert)**

`packages/ui/src/shell/page-drop.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { Page } from "@kibo/schema";
import { type DropZone, pageDropPlan, parseZoneId, zoneId } from "./page-drop";

const page = (id: string, parentId: string | null): Page => ({ id, title: id, kind: "view", parentId });
const pages: Page[] = [
  page("dash", null),
  page("kanban", null),
  page("k1", "kanban"),
  page("k11", "k1"),
  page("notes", null),
];
const before = (pageId: string): DropZone => ({ kind: "before", pageId });
const after = (pageId: string): DropZone => ({ kind: "after", pageId });
const inside = (pageId: string): DropZone => ({ kind: "inside", pageId });
const root: DropZone = { kind: "root" };

test("zone ids round-trip and reject anything else", () => {
  expect(zoneId(root)).toBe("root");
  expect(zoneId(before("k1"))).toBe("k1:before");
  for (const zone of [root, before("k1"), inside("k1"), after("k1")]) {
    expect(parseZoneId(zoneId(zone))).toEqual(zone);
  }
  expect(parseZoneId("k1")).toBeNull();
  expect(parseZoneId("k1:nowhere")).toBeNull();
  expect(parseZoneId(":before")).toBeNull();
});

test("dropping next to a sibling gives the final index among the siblings without the moved page", () => {
  expect(pageDropPlan(pages, "dash", after("kanban"))).toEqual({ pageId: "dash", parentId: null, index: 1 });
  expect(pageDropPlan(pages, "notes", before("dash"))).toEqual({ pageId: "notes", parentId: null, index: 0 });
  expect(pageDropPlan(pages, "dash", after("notes"))).toEqual({ pageId: "dash", parentId: null, index: 2 });
});

test("dropping where the page already sits sends nothing", () => {
  expect(pageDropPlan(pages, "dash", before("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("dash"))).toBeNull();
  expect(pageDropPlan(pages, "notes", after("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "dash", root)).toBeNull();
  expect(pageDropPlan(pages, "k1", inside("kanban"))).toBeNull();
});

test("dropping between the children of another page reparents with the index", () => {
  expect(pageDropPlan(pages, "dash", before("k11"))).toEqual({ pageId: "dash", parentId: "k1", index: 0 });
  expect(pageDropPlan(pages, "notes", after("k1"))).toEqual({ pageId: "notes", parentId: "kanban", index: 1 });
});

test("inside appends under the target, root brings back to the top level", () => {
  expect(pageDropPlan(pages, "notes", inside("k1"))).toEqual({ pageId: "notes", parentId: "k1" });
  expect(pageDropPlan(pages, "k11", root)).toEqual({ pageId: "k11", parentId: null });
});

test("a page never lands on itself nor inside its own subtree", () => {
  expect(pageDropPlan(pages, "kanban", before("k1"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("k11"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", inside("k11"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", inside("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "ghost", after("dash"))).toBeNull();
  expect(pageDropPlan(pages, "dash", after("ghost"))).toBeNull();
});
```
Run: `bun test packages/ui/src/shell/page-drop.test.ts` — Expected: FAIL (module introuvable).

`packages/ui/src/shell/page-drop.ts` :
```ts
import type { Page } from "@kibo/schema";
import { descendantIds } from "./page-menu";

export type DropZone = { kind: "root" } | { kind: "before" | "inside" | "after"; pageId: string };
export type PageMove = { pageId: string; parentId: string | null; index?: number };

const ROOT = "root";
const KINDS = ["before", "inside", "after"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (s: string): s is Kind => KINDS.some((k) => k === s);

export function zoneId(zone: DropZone): string {
  return zone.kind === "root" ? ROOT : `${zone.pageId}:${zone.kind}`;
}

export function parseZoneId(id: string): DropZone | null {
  if (id === ROOT) return { kind: "root" };
  const at = id.lastIndexOf(":");
  const pageId = id.slice(0, at);
  const kind = id.slice(at + 1);
  return at > 0 && isKind(kind) ? { kind, pageId } : null;
}

export function pageDropPlan(pages: readonly Page[], activeId: string, zone: DropZone): PageMove | null {
  const active = pages.find((p) => p.id === activeId);
  if (!active) return null;
  if (zone.kind === "root") return active.parentId === null ? null : { pageId: activeId, parentId: null };
  const target = pages.find((p) => p.id === zone.pageId);
  if (!target || target.id === activeId || descendantIds(pages, activeId).has(target.id)) return null;
  if (zone.kind === "inside") {
    return active.parentId === target.id ? null : { pageId: activeId, parentId: target.id };
  }
  const parentId = target.parentId;
  const siblings = pages.filter((p) => p.parentId === parentId && p.id !== activeId);
  const at = siblings.findIndex((p) => p.id === target.id);
  const index = zone.kind === "before" ? at : at + 1;
  const current = pages.filter((p) => p.parentId === parentId).findIndex((p) => p.id === activeId);
  if (active.parentId === parentId && current === index) return null;
  return { pageId: activeId, parentId, index };
}
```
(`parseZoneId` : les ids de page Loro contiennent `@`, jamais `:` ; `lastIndexOf` isole le suffixe ; `isKind` est un prédicat de type, sans `as`.)

Run: `bun test packages/ui/src/shell/page-drop.test.ts` — Expected: PASS, 6 tests.

- [x] **Step 2: Zones de dépôt dans `ProjectPages`**

`packages/ui/src/shell/ProjectPages.tsx` :
- imports : `pointerWithin` (`@dnd-kit/core`), `pageDropPlan, parseZoneId, zoneId` (`./page-drop`) ; la constante `ROOT` disparaît au profit de `zoneId({ kind: "root" })` ;
- `RootDrop` : `useDroppable({ id: zoneId({ kind: "root" }), disabled: !editable })` (rendu inchangé) ;
- `PageRow` : les trois zones remplacent le `useDroppable` unique ; le `ring` passe du `SidebarMenuSubItem` à la ligne :
```tsx
function PageRow({ page, entries, editable, active, onClick, onAuxClick, children, icon }: RowProps) {
  const before = useDroppable({ id: zoneId({ kind: "before", pageId: page.id }), disabled: !editable });
  const inside = useDroppable({ id: zoneId({ kind: "inside", pageId: page.id }), disabled: !editable });
  const after = useDroppable({ id: zoneId({ kind: "after", pageId: page.id }), disabled: !editable });
  const drag = useDraggable({ id: page.id, disabled: !editable });
  return (
    <SidebarMenuSubItem className="group/page">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={cn("relative rounded-md", inside.isOver && "ring-2 ring-ring")}>
            <div ref={before.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/4" />
            <div ref={inside.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-1/4 h-1/2" />
            <div ref={after.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4" />
            {before.isOver && <span aria-hidden className="pointer-events-none absolute inset-x-1 -top-px z-10 h-0.5 rounded bg-ring" />}
            {after.isOver && <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px z-10 h-0.5 rounded bg-ring" />}
            <SidebarMenuSubButton asChild isActive={active}>
              …(bouton, menu « ⋯ » : inchangés)
```
  Les trois `div` de zone ne captent aucun événement (`pointer-events-none`) : le clic, le clic droit et le glisser restent ceux du bouton ; dnd-kit ne lit que leurs rectangles. Les zones couvrent la **ligne** seulement (le `div.relative`), pas les sous-pages rendues dans `children` : chaque sous-page a ses propres zones.
- `onDragEnd` :
```tsx
  const onDragEnd = (e: DragEndEvent) => {
    const zone = e.over ? parseZoneId(String(e.over.id)) : null;
    const plan = zone ? pageDropPlan(project.pages, String(e.active.id), zone) : null;
    if (plan) void move(plan.pageId, plan.parentId, plan.index);
  };
```
  (`move` de T7 omet déjà `index` quand il vaut `undefined`.)
- `<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>`.

`packages/ui/src/shell/project-pages.test.tsx` : aucune attente ne change (les zones sont `aria-hidden`, sans rôle ni texte ; le menu, le bouton « ⋯ » et la lecture seule se comportent comme en T7). Le glisser ne se simule pas sous happy-dom (rectangles nuls) : la couverture vient de `page-drop.test.ts` et de la vérification manuelle du Step 3.

Run: `bun test packages/ui/src/shell` — Expected: PASS.

- [x] **Step 3: Gate, budget, vérification manuelle, commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget`
Expected: PASS ; `pointerWithin` est déjà dans le bundle de `@dnd-kit/core` : attendre + 0,5 kB au plus sur l'entrée ; noter la valeur.

Vérifier à la main (`bun run start`, projet avec trois pages racine et une sous-page) : glisser une page sur le tiers haut d'une sœur la place juste au-dessus (trait), sur le tiers bas juste au-dessous, sur le milieu en fait une sous-page (cadre), sur le nom du projet la remonte à la racine ; un clic simple ouvre toujours la page ; « Monter » / « Descendre » du menu fonctionnent comme avant ; en sombre et en clair, le trait et le cadre sont visibles.

```bash
git add packages/ui/src/shell/page-drop.ts packages/ui/src/shell/page-drop.test.ts
git commit -m "feat(ui): plan de dépôt d'une page"
git add packages/ui/src/shell/ProjectPages.tsx packages/ui/src/shell/project-pages.test.tsx
git commit -m "feat(ui): pages réordonnées au glisser-déposer"
```

---

### Task 10b: Arbre Tickets : glisser-déposer qui réordonne entre frères

Vague 1 bis ← T10. Décision 9 et spec §12.7. **Vérification faite** : `moveTicket { ticketId, parentId, index? }` existe dans le schéma (`packages/schema/src/command.ts:47`, `index` entier ≥ 0 optionnel, même définition que `movePage`), dans le domaine (`packages/core/src/tickets.ts:127`, `moveNode(tree, id, parentId, index)`) et le démon l'exécute (`packages/core/src/commands.ts:56`) : **aucune décision de schéma à écrire**. Sémantique identique à celle de T7b (position finale parmi les frères, vérifiée sur `LoroTree.move`) ; un test de `packages/core` la fige. Sur la base du `TicketsTree` de T10 (`DndContext`, `reparentOnDrop`, `attempt`, ligne extraite ou non en `TicketRow`), chaque ligne offre trois zones (quart haut, milieu, quart bas) ; l'index est calculé sur la **liste complète** `all` (ordre du snapshot = parcours en profondeur de l'arbre Loro, `listTickets`), jamais sur la liste filtrée « Mes tickets » ou par source : des frères masqués comptent dans la position.

**Files:**
- Modify: `packages/core/src/tickets.test.ts` (sémantique de l'index)
- Modify: `components/tickets/src/tree-drop.ts`, `components/tickets/src/tree-drop.test.ts` (`dropPlan`, zones), `components/tickets/src/TicketsTree.tsx` (et `components/tickets/src/TicketRow.tsx` si T10 a extrait la ligne), `components/tickets/src/tickets.test.tsx` (attentes inchangées)

**Interfaces:**
- Consumes: `reparentOnDrop` (T10, conservé pour la zone « dans »), `sdk.run({ method: "moveTicket", … })` via `attempt` (T10), `useDroppable`, `pointerWithin` (`@dnd-kit/core`), `createTicket`, `listTickets`, `moveTicket` (`@kibo/core`, test).
- Produces: Contrats partagés › Composants › `tree-drop.ts` (T10b).

- [x] **Step 1: Sémantique de l'index (test du domaine, vert d'emblée : il fige un comportement)**

`packages/core/src/tickets.test.ts`, ajouter :
```ts
describe("order", () => {
  test("moveTicket with an index puts the ticket at that final position among its siblings", () => {
    const d = doc();
    const a = createTicket(d, { title: "a" });
    createTicket(d, { title: "b" });
    const c = createTicket(d, { title: "c" });
    const p = createTicket(d, { title: "p" });
    createTicket(d, { title: "q", parentId: p.id });
    const order = () => listTickets(d).map((t) => t.title);
    expect(order()).toEqual(["a", "b", "c", "p", "q"]);
    moveTicket(d, a.id, null, 1);
    expect(order()).toEqual(["b", "a", "c", "p", "q"]);
    moveTicket(d, c.id, null, 0);
    expect(order()).toEqual(["c", "b", "a", "p", "q"]);
    moveTicket(d, c.id, null, 3);
    expect(order()).toEqual(["b", "a", "p", "q", "c"]);
    moveTicket(d, a.id, p.id, 1);
    expect(order()).toEqual(["b", "p", "q", "a", "c"]);
  });
});
```
(Attentes établies en exécutant ces mêmes appels sur `@kibo/core` le 2026-09-30 : `index` est la position finale parmi les frères, avec ou sans changement de parent.)

Run: `bun test packages/core/src/tickets.test.ts` — Expected: PASS (si un `expect` échoue, la sémantique diffère de T7b : s'arrêter et le signaler au chef d'équipe avant de toucher au composant).

- [x] **Step 2: Le plan de dépôt en données (test rouge puis vert)**

`components/tickets/src/tree-drop.test.ts`, ajouter (mêmes `t` et `tickets` que le fichier, fixture étendue) :
```ts
import { type DropZone, dropPlan, parseZoneId, zoneId } from "./tree-drop";

const tree = [t("a", null), t("b", "a"), t("c", "b"), t("d", null), t("e", null)];
const before = (ticketId: string): DropZone => ({ kind: "before", ticketId });
const after = (ticketId: string): DropZone => ({ kind: "after", ticketId });
const inside = (ticketId: string): DropZone => ({ kind: "inside", ticketId });

test("zone ids round-trip on Loro ids and reject anything else", () => {
  for (const zone of [before("27@1"), inside("27@1"), after("27@1")]) {
    expect(parseZoneId(zoneId(zone))).toEqual(zone);
  }
  expect(parseZoneId("27@1")).toBeNull();
  expect(parseZoneId("27@1:top")).toBeNull();
});

test("dropping next to a sibling gives the final index among the siblings without the moved ticket", () => {
  expect(dropPlan(tree, "a", after("d"))).toEqual({ ticketId: "a", parentId: null, index: 1 });
  expect(dropPlan(tree, "e", before("a"))).toEqual({ ticketId: "e", parentId: null, index: 0 });
  expect(dropPlan(tree, "a", after("e"))).toEqual({ ticketId: "a", parentId: null, index: 2 });
});

test("dropping where the ticket already sits sends nothing", () => {
  expect(dropPlan(tree, "a", before("d"))).toBeNull();
  expect(dropPlan(tree, "d", after("a"))).toBeNull();
  expect(dropPlan(tree, "b", inside("a"))).toBeNull();
});

test("dropping between the children of another ticket reparents with the index", () => {
  expect(dropPlan(tree, "d", before("c"))).toEqual({ ticketId: "d", parentId: "b", index: 0 });
  expect(dropPlan(tree, "e", after("b"))).toEqual({ ticketId: "e", parentId: "a", index: 1 });
});

test("inside delegates to reparentOnDrop", () => {
  expect(dropPlan(tree, "d", inside("b"))).toEqual({ ticketId: "d", parentId: "b" });
  expect(dropPlan(tree, "a", inside("c"))).toBeNull();
});

test("a ticket never lands on itself nor inside its own subtree", () => {
  expect(dropPlan(tree, "a", before("b"))).toBeNull();
  expect(dropPlan(tree, "a", after("c"))).toBeNull();
  expect(dropPlan(tree, "a", after("a"))).toBeNull();
  expect(dropPlan(tree, "zz", after("a"))).toBeNull();
  expect(dropPlan(tree, "a", after("zz"))).toBeNull();
});
```
Run: `bun test components/tickets/src/tree-drop.test.ts` — Expected: FAIL (`dropPlan` introuvable).

`components/tickets/src/tree-drop.ts`, ajouter (après `reparentOnDrop`, `isDescendant` réutilisé) :
```ts
export type DropZone = { kind: "before" | "inside" | "after"; ticketId: string };
export type TicketMove = { ticketId: string; parentId: string | null; index?: number };

const KINDS = ["before", "inside", "after"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (s: string): s is Kind => KINDS.some((k) => k === s);

export const zoneId = (zone: DropZone): string => `${zone.ticketId}:${zone.kind}`;

export function parseZoneId(id: string): DropZone | null {
  const at = id.lastIndexOf(":");
  const ticketId = id.slice(0, at);
  const kind = id.slice(at + 1);
  return at > 0 && isKind(kind) ? { kind, ticketId } : null;
}

export function dropPlan(tickets: readonly TicketView[], activeId: string, zone: DropZone): TicketMove | null {
  if (zone.kind === "inside") return reparentOnDrop(tickets, activeId, zone.ticketId);
  const active = tickets.find((t) => t.id === activeId);
  const target = tickets.find((t) => t.id === zone.ticketId);
  if (!active || !target || target.id === activeId || isDescendant(tickets, target.id, activeId)) return null;
  const parentId = target.parentId;
  const siblings = tickets.filter((t) => t.parentId === parentId && t.id !== activeId);
  const at = siblings.findIndex((t) => t.id === target.id);
  const index = zone.kind === "before" ? at : at + 1;
  const current = tickets.filter((t) => t.parentId === parentId).findIndex((t) => t.id === activeId);
  if (active.parentId === parentId && current === index) return null;
  return { ticketId: activeId, parentId, index };
}
```
Run: `bun test components/tickets/src/tree-drop.test.ts` — Expected: PASS, 8 tests.

- [x] **Step 3: Zones de dépôt dans l'arbre**

`components/tickets/src/TicketsTree.tsx` (ou `TicketRow.tsx` si T10 a extrait la ligne) :
- imports : `pointerWithin` (`@dnd-kit/core`), `dropPlan, parseZoneId, zoneId` (`./tree-drop`) ; `reparentOnDrop` n'est plus importé par l'arbre (il reste utilisé par `dropPlan`) ;
- dans la ligne, le `useDroppable({ id: t.id, … })` de T10 devient trois zones :
```tsx
  const before = useDroppable({ id: zoneId({ kind: "before", ticketId: t.id }), disabled: readOnly });
  const inside = useDroppable({ id: zoneId({ kind: "inside", ticketId: t.id }), disabled: readOnly });
  const after = useDroppable({ id: zoneId({ kind: "after", ticketId: t.id }), disabled: readOnly });
```
  le `<div className={cn(COLUMNS, "group relative h-8 …", inside.isOver && "ring-2 ring-ring")}>` de la ligne (sans `ref` de dépôt) reçoit, en premiers enfants :
```tsx
            <div ref={before.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/4" />
            <div ref={inside.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-1/4 h-1/2" />
            <div ref={after.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4" />
            {before.isOver && <span aria-hidden className="pointer-events-none absolute inset-x-2 -top-px z-10 h-0.5 rounded bg-ring" />}
            {after.isOver && <span aria-hidden className="pointer-events-none absolute inset-x-2 -bottom-px z-10 h-0.5 rounded bg-ring" />}
```
  (les enfants absolus ne participent pas à la grille `COLUMNS` ; la poignée de glisser reste la clé, comme T10) ;
- `onDragEnd` :
```tsx
  const onDragEnd = (e: DragEndEvent) => {
    if (readOnly || e.over === null) return;
    const zone = parseZoneId(String(e.over.id));
    const plan = zone ? dropPlan(all, String(e.active.id), zone) : null;
    if (!plan) return;
    const key = all.find((t) => t.id === plan.ticketId)?.keyLabel ?? "";
    void attempt({ method: "moveTicket", ...plan }, fr.moveFailed(key));
  };
```
- `<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>`.

`components/tickets/src/tickets.test.tsx` : aucune attente ne change (les zones sont `aria-hidden`, sans rôle ni texte). Le glisser ne se simule pas sous happy-dom : couverture par `tree-drop.test.ts`, `tickets.test.ts` du domaine et la vérification manuelle.

Run: `bun test components/tickets` — Expected: PASS (conformité comprise).

- [x] **Step 4: Gate, vérification manuelle, commits**

Run: `bun run check && bun run typecheck && bun test packages/core components/tickets && bun run budget`
Expected: PASS ; le composant tickets est chargé à la demande : budget inchangé.

Vérifier à la main (`bun run start`, projet Kibo du dogfooding) : glisser la clé d'un ticket sur le quart haut d'un frère le place juste au-dessus (trait), sur le quart bas juste au-dessous, sur le milieu en fait un sous-ticket (cadre) ; avec le filtre « Mes tickets », déposer au-dessous d'un ticket le place bien après lui dans l'arbre complet ; un clic simple sur le titre ouvre toujours la fiche ; en sombre et en clair.

```bash
git add packages/core/src/tickets.test.ts
git commit -m "test(core): index de moveTicket, position finale"
git add components/tickets/src/tree-drop.ts components/tickets/src/tree-drop.test.ts
git commit -m "feat(tickets): plan de dépôt avec index"
git add components/tickets/src/TicketsTree.tsx components/tickets/src/tickets.test.tsx
git commit -m "feat(tickets): réordonner au glisser-déposer"
```
(Ajouter `components/tickets/src/TicketRow.tsx` au dernier commit si la ligne vit dans ce fichier.)

---

### Task 12b: Notes : titre obligatoire à la création, fichiers sans titre signalés, tampon vidé après un renommage long

Vague 1 bis ← T12 (acceptée : `feat/p9-t12`, `c54eef3`). Décision 7 et spec §12.7 : **aucune note ne reste sans titre**. T12 a déjà livré le renommage sans frappe perdue (`components/notes/src/use-note-session.ts` : session à chemin modifiable, `rename(from, to)` unique qui vide le tampon avant, `autosave.ts` avec `flush(): Promise<boolean>`, écritures sérialisées et `rebase(mtime)`) : T12b ne le refait pas. Elle apporte : (A) « Nouvelle note » demande un **titre obligatoire** dans un dialogue (fichier `<slug>.md` à la racine du dossier, première ligne `# Titre`, refus si le nom est pris) ; les fichiers `sans-titre(-n).md` existants sont **signalés** dans la liste (« Fichier sans titre · Renommer… ») et renommés à leur prochaine sauvegarde dès qu'ils ont un titre (déjà le cas dans `onSaved`, à chaque sauvegarde), sans jamais viser un autre nom sans titre ; (B) les deux points retenus par le reviewer de T12 : un **second `flush()`** après `rebase()` dans `rename()`, pour qu'une sauvegarde partie pendant un renommage long (délai de 800 ms écoulé alors que `notes.rename` n'a pas répondu) soit rejouée sur le nouveau fichier au lieu de laisser une fausse bannière « Modifié hors de Kibo » ; et le **découpage** de `notes.test.tsx` (329 lignes) : les tests de renommage et de suppression passent dans `notes-rename.test.tsx`, les aides de montage dans `notes.test-helper.tsx`. Aucune nouvelle dépendance ; le composant est chargé à la demande (budget inchangé).

**Files:**
- Create: `components/notes/src/NoteTitleDialog.tsx` (formulaire générique : titre, aperçu « Fichier : … », erreur), `components/notes/src/notes.test-helper.tsx`, `components/notes/src/notes-rename.test.tsx`
- Modify: `components/notes/src/note-name.ts`, `components/notes/src/note-name.test.ts`, `components/notes/src/RenameNoteDialog.tsx` (habillage de `NoteTitleDialog`, props inchangées), `components/notes/src/NoteList.tsx`, `components/notes/src/NotesView.tsx`, `components/notes/src/use-note-session.ts`, `components/notes/src/fr.ts`, `components/notes/src/notes.test.tsx`

**Interfaces:**
- Consumes: `useNoteSession` (T12 : `rename`, `remove`, `load`, `change`), `sdk.notes.write(path, markdown, null)` (création, permission `writes: note`), `isUntitledPath`, `renamedPath`, `autoRenameTarget` (T12), `KiboError` (`CONFLICT`), `createMockSdk` (`notes`, `noteAges`, `setAccess`), `runConformance`.
- Produces: Contrats partagés › Composants › `note-name.ts` (T12b) ; `NoteTitleDialog` ; `NoteList` inchangée en props (le signalement appelle `onRename`).

- [x] **Step 1: Textes**

`components/notes/src/fr.ts` : retirer `untitled: "Sans titre"` (plus aucune note n'est créée avec ce titre) ; renommer `renameField` en `titleField` (même texte « Titre », lu par le dialogue commun) ; ajouter :
```ts
  createTitle: "Nouvelle note",
  createConfirm: "Créer",
  untitledFile: "Fichier sans titre",
  untitledHint: "Fichier sans titre · Renommer…",
```
(`renameFile`, `renameNoSlug`, `renameConflict` servent aux deux dialogues.)

- [x] **Step 2: Noms de fichier (test rouge puis vert)**

`components/notes/src/note-name.test.ts`, ajouter (`createdPath` importé) :
```ts
test("the created path is the slug at the root of the folder, or null without slug", () => {
  expect(createdPath("Plan de test")).toBe("plan-de-test.md");
  expect(createdPath("  Réunion — kick-off !  ")).toBe("reunion-kick-off.md");
  expect(createdPath("  ")).toBeNull();
  expect(createdPath("#")).toBeNull();
});

test("the automatic target is never itself an untitled name", () => {
  expect(autoRenameTarget({ path: "sans-titre-2.md", title: "Sans titre" }, [])).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre.md", title: "sans-titre-9" }, [])).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre-2.md", title: "Plan" }, [])).toBe("plan.md");
});
```
Run: `bun test components/notes/src/note-name.test.ts` — Expected: FAIL (2 tests).

`components/notes/src/note-name.ts` :
```ts
export const createdPath = (title: string): string | null => renamedPath("", title);
```
et dans `autoRenameTarget`, la condition devient `if (target === null || target === note.path || isUntitledPath(target) || taken.includes(target)) return null;`.

Run: `bun test components/notes/src/note-name.test.ts` — Expected: PASS, 6 tests.

- [x] **Step 3: Découpage des tests (mécanique, vert avant, vert après)**

`components/notes/src/notes.test-helper.tsx` : y déplacer, exportés, `seed`, `setup(surface, notes?)`, `listed()`, `editorView()`, `noConflict()` et un `mount(sdk: KiboSdk)` (= `render(<SdkProvider sdk={sdk}><Component /></SdkProvider>)`), avec leurs imports (`EditorView`, `createMockSdk`, `DEMO_NOTES`, `DEMO_NOTE_AGES`, `seedDemo`, `Component`, `manifest`, `render`, `screen`, `within`). Le suffixe `.test-helper.tsx` n'est pas un motif de test de Bun (même convention que `packages/daemon/src/remote/remote.test-helper.ts`).

`components/notes/src/notes-rename.test.tsx` : y déplacer, inchangés, « a note is renamed from its menu… », « deleting a note asks… », « renaming the open note keeps what was just typed… », « the first save of an untitled note renames its file after its title » (avec ses promesses `saving` / `held`). `notes.test.tsx` garde `runConformance` et les autres tests, importe les aides du helper.

Run: `bun test components/notes` — Expected: PASS, même nombre de tests qu'avant le découpage ; `notes.test.tsx` < 200 lignes, `notes-rename.test.tsx` < 200 lignes.

- [x] **Step 4: Tests de la vue (rouges)**

`components/notes/src/notes.test.tsx`, le test « search asks the daemon, new note creates a file » devient « search asks the daemon, new note asks a title and refuses a taken name » : après `await user.clear(…)`, remplacer la fin par :
```tsx
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  const dialog = await screen.findByRole("dialog", { name: "Nouvelle note" });
  const field = within(dialog).getByLabelText("Titre");
  expect((within(dialog).getByRole("button", { name: "Créer" }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(field, "Journal agents");
  expect(within(dialog).getByText("Fichier : journal-agents.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Créer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Une note porte déjà ce nom.");
  expect(m.notes.get("journal-agents.md")?.markdown).toBe(DEMO_NOTES["journal-agents.md"]);
  await user.clear(field);
  await user.type(field, "Plan de test");
  await user.click(within(dialog).getByRole("button", { name: "Créer" }));
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Plan de test\n"));
  expect(m.notes.has("sans-titre.md")).toBe(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await screen.findByRole("textbox", { name: "Contenu de la note" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: "notes/plan-de-test.md" })).toBeTruthy();
```
Dans « a read-only project shows no note menu », passer `notes: { ...DEMO_NOTES, "sans-titre.md": "Brouillon\n" }` et ajouter à la fin :
```tsx
  expect(screen.getByText("Fichier sans titre")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Fichier sans titre/ })).toBeNull();
```

`components/notes/src/notes-rename.test.tsx`, ajouter :
```tsx
test("untitled files are flagged in the list and renamed at their next save once titled", async () => {
  const m = setup("view", { ...DEMO_NOTES, "sans-titre.md": "Brouillon\n", "sans-titre-2.md": "# Sans titre\n\nNotes.\n" });
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  expect(screen.getAllByRole("button", { name: "Fichier sans titre · Renommer…" })).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: /^Sans titre/ }));
  await screen.findByRole("heading", { level: 1, name: "Sans titre" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({ changes: { from: 0, to: 12, insert: "# Plan de test" }, userEvent: "input.type" });
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Plan de test\n\nNotes.\n"), {
    timeout: 3000,
  });
  expect(m.notes.has("sans-titre-2.md")).toBe(false);
  expect(m.notes.has("sans-titre.md")).toBe(true);
  expect(await screen.findByRole("button", { name: "notes/plan-de-test.md" })).toBeTruthy();
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Fichier sans titre · Renommer…" })).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Fichier sans titre · Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  expect((within(dialog).getByLabelText("Titre") as HTMLInputElement).value).toBe("sans-titre");
});

test("a save that fires during a long rename ends up in the new file, without a conflict banner", async () => {
  const m = createMockSdk(manifest, { seed, surface: "view", notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => {
    release = r;
  });
  mount({
    ...m.sdk,
    notes: {
      ...m.sdk.notes,
      rename: async (from, to) => {
        const meta = await m.sdk.notes.rename(from, to);
        await held;
        return meta;
      },
    },
  });
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  await user.click(screen.getByRole("button", { name: "Actions de Décisions d'architecture" }));
  await user.click(await screen.findByRole("menuitem", { name: "Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  const field = within(dialog).getByLabelText("Titre");
  await user.clear(field);
  await user.type(field, "Choix");
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(m.notes.has("choix.md")).toBe(true));
  view.dispatch({ changes: { from: view.state.doc.length, insert: "\nPendant le renommage" }, userEvent: "input.type" });
  const typed = view.state.doc.toString();
  await new Promise((r) => setTimeout(r, 1000));
  release();
  await waitFor(() => expect(m.notes.get("choix.md")?.markdown).toBe(typed), { timeout: 3000 });
  expect(await screen.findByText("Enregistré • local")).toBeTruthy();
  noConflict();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(view.state.doc.toString()).toBe(typed);
});
```
(Second test : le faux `rename` applique le renommage puis attend ; le délai de 1 s laisse l'autosave de 800 ms écrire vers l'ancien chemin, qui n'existe plus ⇒ `CONFLICT` dans le SDK simulé, état « conflict », bannière ; sans la correction du Step 6, `typed` n'est jamais écrit dans `choix.md` et la bannière reste. Dans le premier test, `from: 0, to: 12` remplace exactement `# Sans titre`, douze caractères.)

Run: `bun test components/notes` — Expected: FAIL (4 tests : création, lecture seule, signalement, renommage long).

- [x] **Step 5: Dialogue générique, création avec titre, signalement (verts)**

`components/notes/src/NoteTitleDialog.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";

type Props = {
  title: string;
  initial: string;
  confirmLabel: string;
  pathFor(title: string): string | null;
  unchanged: string | null;
  submit(path: string, title: string): Promise<unknown>;
  describeError(error: unknown): string;
  onClose(): void;
};

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function NoteTitleDialog(p: Props) {
  const id = useId();
  const [title, setTitle] = useState(p.initial);
  const [error, setError] = useState<string | null>(null);
  const target = p.pathFor(title);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target === null || target === p.unchanged) return;
    setError(null);
    try {
      await p.submit(target, title.trim());
      p.onClose();
    } catch (err) {
      setError(p.describeError(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{p.title}</DialogTitle>
            <DialogDescription>{target ? fr.renameFile(fileName(target)) : fr.renameNoSlug}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{fr.titleField}</Label>
            <Input id={id} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={p.onClose}>
              {fr.cancel}
            </Button>
            <Button type="submit" disabled={target === null || target === p.unchanged}>
              {p.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`components/notes/src/RenameNoteDialog.tsx` devient un habillage (mêmes props qu'en T12 : `note`, `onRename(from, to)`, `onClose`) :
```tsx
import { KiboError, type NoteMeta } from "@kibo/schema";
import { fr } from "./fr";
import { renamedPath } from "./note-name";
import { NoteTitleDialog } from "./NoteTitleDialog";

type Props = { note: NoteMeta; onRename(from: string, to: string): Promise<unknown>; onClose(): void };

export const describeRenameError = (e: unknown): string =>
  e instanceof KiboError && e.code === "CONFLICT" ? fr.renameConflict : fr.renameFailed;

export function RenameNoteDialog({ note, onRename, onClose }: Props) {
  return (
    <NoteTitleDialog
      title={fr.renameTitle}
      initial={note.title}
      confirmLabel={fr.renameConfirm}
      pathFor={(title) => renamedPath(note.path, title)}
      unchanged={note.path}
      submit={(to) => onRename(note.path, to)}
      describeError={describeRenameError}
      onClose={onClose}
    />
  );
}
```
(`fr.renameField` a été renommé `titleField` au Step 1.)

`components/notes/src/NotesView.tsx` :
- supprimer `freePath` ; `const [creating, setCreating] = useState(false);` ; `NoteList` reçoit `onCreate={() => setCreating(true)}` ;
- `create` devient (`createdPath` importé ; `KiboError` de `@kibo/schema`) :
```tsx
  const create = async (path: string, title: string) => {
    if (listed.data.some((n) => n.path === path)) throw new KiboError("CONFLICT", `${path} already exists`);
    await sdk.notes.write(path, `# ${title}\n`, null);
    setQuery("");
    setSelected(path);
    setEditing(true);
  };
```
- rendu, avant `{renaming && …}` :
```tsx
      {creating && (
        <NoteTitleDialog
          title={fr.createTitle}
          initial=""
          confirmLabel={fr.createConfirm}
          pathFor={createdPath}
          unchanged={null}
          submit={create}
          describeError={(e) => (e instanceof KiboError && e.code === "CONFLICT" ? fr.renameConflict : fr.createFailed)}
          onClose={() => setCreating(false)}
        />
      )}
```
(Le contrôle du nom pris se fait sur l'index des notes ; un fichier créé hors Kibo entre deux rafraîchissements serait écrasé par `write(…, null)` : accepté, l'index se rafraîchit en 200 ms et le cas est le même que « Garder ma version ».)

`components/notes/src/NoteList.tsx` : `isUntitledPath` importé ; dans chaque `<li>`, après le `<button>` de la note (toujours à l'intérieur de `NoteMenu`) :
```tsx
              {isUntitledPath(n.path) &&
                (readOnly ? (
                  <span className="block px-2 pb-1.5 text-xs text-muted-foreground">{fr.untitledFile}</span>
                ) : (
                  <button
                    type="button"
                    className="block px-2 pb-1.5 text-left text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => onRename(n.path)}
                  >
                    {fr.untitledHint}
                  </button>
                ))}
```
(Un bouton **à côté** du bouton de la note, jamais dedans : deux boutons imbriqués seraient invalides. `listed()` du helper ignore déjà les boutons « Actions de … » ; il doit aussi ignorer ceux dont le texte commence par « Fichier sans titre » : adapter le filtre dans `notes.test-helper.tsx`.)

Run: `bun test components/notes` — Expected: PASS sauf « a save that fires during a long rename… » (Step 6).

- [x] **Step 6: Second `flush()` après le renommage (vert)**

`components/notes/src/use-note-session.ts`, dans `rename`, après `s.autosave.rebase(meta.mtime);` :
```ts
          await s.autosave.flush();
```
(`flush` ne fait rien si le tampon est vide ; sinon il rejoue le texte tapé pendant le renommage sur `s.path`, désormais le nouveau chemin, avec la base `meta.mtime` : l'état revient à « saved » et la bannière disparaît. Le `moving` reste vrai pendant ce second `flush`, ce qui évite un renommage automatique en cascade.)

Run: `bun test components/notes` — Expected: PASS (conformité comprise).

- [x] **Step 7: Gate et commits**

Run: `bun run check && bun run typecheck && bun test components/notes packages/sdk && bun run budget`
Expected: PASS ; budget inchangé (Notes chargé à la demande) ; `NotesView.tsx` et `notes.test.tsx` sous 300 lignes.

```bash
git add components/notes/src/notes.test-helper.tsx components/notes/src/notes-rename.test.tsx components/notes/src/notes.test.tsx
git commit -m "test(notes): tests de renommage séparés"
git add components/notes/src/note-name.ts components/notes/src/note-name.test.ts components/notes/src/fr.ts
git commit -m "feat(notes): nom de fichier jamais sans titre"
git add components/notes/src/NoteTitleDialog.tsx components/notes/src/RenameNoteDialog.tsx components/notes/src/NoteList.tsx components/notes/src/NotesView.tsx components/notes/src/notes.test.tsx components/notes/src/notes-rename.test.tsx
git commit -m "feat(notes): titre demandé à la création"
git add components/notes/src/use-note-session.ts components/notes/src/notes-rename.test.tsx
git commit -m "fix(notes): tampon vidé après un renommage long"
```
(Si le découpage du Step 3 et les tests du Step 4 ont été écrits dans le même passage, le premier commit porte le découpage seul : les nouveaux tests vont dans les commits qui les font passer.)

### Task 4b: Coque : navigation de la webview limitée aux origines du démon

Vague 1 bis ← T4, T13 (décidée par `kibo-lead` en relecture de sécurité de T13). Spec §12.5 « Navigation de la fenêtre principale ». Depuis T13, l'UI intercepte tout lien hors origine, mais la coque ne pose aucun `on_navigation` : un `window.location = …` d'un composant intégré, ou un chemin non couvert en JS, ferait quitter Kibo à la webview principale sans retour possible. L'UI intercepte, la coque garantit.

Vérifié dans Tauri 2.12.0 et wry 0.57 : `WebviewWindowBuilder::on_navigation<F: Fn(&Url) -> bool + Send + 'static>(self, f: F) -> Self` ; `false` annule la navigation (`WKNavigationActionPolicy::Cancel` sous macOS), la fenêtre reste sur la page courante. Le gestionnaire ne reçoit que l'URL, sans savoir quelle frame navigue : sous macOS et Linux il voit aussi les iframes, dont celle des composants sandboxés (`http://127.0.0.1:<sandboxPort>`, choisi par le démon quand la coque passe `--port 0`). Le démon annonce donc cette origine sur une ligne `KIBO_SANDBOX <origine>` émise juste après `KIBO_READY` ; la coque accorde la capacité sur `KIBO_READY` et n'ouvre la fenêtre qu'à `KIBO_SANDBOX`, avec exactement ces deux origines. Une URL que tauri-runtime-wry ne sait pas analyser est laissée passer **avant** notre gestionnaire (`unwrap_or(true)`) : hors de portée de la coque, noté au rapport.

**Files:**
- Modify: `packages/daemon/src/main.ts`, `packages/daemon/src/main.test.ts`, `packages/daemon/src/main-agents.test.ts` (lecture de la première ligne seulement)
- Modify: `apps/desktop/src-tauri/src/main.rs`

**Interfaces:**
- Consumes: `Daemon.sandboxPort` (`packages/daemon/src/daemon.ts`), `ipc_origin` (T4).
- Produces: ligne de démarrage `KIBO_SANDBOX http://127.0.0.1:<port>` ; `navigation_allowed(target: &Url, allowed: &[String]) -> bool`, `parse_sandbox(line: &str) -> Option<&str>`.

- [ ] **Step 1: Démon, ligne `KIBO_SANDBOX` (test rouge puis vert)**

`main.test.ts` : le test « announces readiness… » lit deux lignes et attend `KIBO_READY http://127.0.0.1:<port>/#pair=<token>` puis `KIBO_SANDBOX http://127.0.0.1:<sandboxPort>`, `sandboxPort` étant celui de `daemon.json`. `main.ts` : `process.stdout.write(\`KIBO_SANDBOX http://127.0.0.1:${daemon.sandboxPort}\n\`)` juste après `KIBO_READY`. Les tests qui ne lisent que la première ligne cessent d'exiger la fin de la sortie (`\n$` ⇒ `\n`).

Run: `bun test packages/daemon/src/main` — Expected: FAIL puis PASS.

- [ ] **Step 2: Fonctions pures de la coque (test rouge)**

Dans `mod tests` de `main.rs` : `navigation_allowed` vrai pour toute URL des deux origines (chemin, requête, fragment quelconques), faux pour un autre port, `localhost`, `https:`, `about:blank`, `javascript:`, `file:`, `data:`, et pour une liste vide ; `parse_sandbox` lit `KIBO_SANDBOX <url>` et ignore les autres lignes.

Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — Expected: FAIL (`navigation_allowed`, `parse_sandbox` introuvables).

- [ ] **Step 3: Implémentation et branchement (vert)**

`navigation_allowed` compare `ipc_origin(target)` à chaque origine autorisée (une origine opaque vaut `"null"` et n'est jamais autorisée). La boucle des événements garde l'URL de `KIBO_READY` et ouvre la fenêtre à `KIBO_SANDBOX` avec `.on_navigation(move |url| navigation_allowed(url, &allowed))`.

Run: `~/.cargo/bin/cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — Expected: PASS.

- [ ] **Step 4: Gate et commits**

Run: `~/.cargo/bin/cargo fmt --check` et `~/.cargo/bin/cargo clippy` dans `apps/desktop/src-tauri`, `bun run check`, `bun test packages/daemon/src/main` — Expected: PASS. Le `desktop-smoke` de la CI fait foi pour Linux.

```bash
git add packages/daemon/src/main.ts packages/daemon/src/main.test.ts packages/daemon/src/main-agents.test.ts
git commit -m "feat(daemon): origine sandbox annoncée"
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): navigation limitée au démon"
```

---

## Suites des réponses d'Adam (2026-09-27)

Les réponses d'Adam (2026-09-27) sont devenues quatre tâches de la vague 1 bis, rédigées ci-dessus par `kibo-lead` le 2026-09-30 : **T3b** (toutes les mutations git de `/api/code` réservées à la machine, vue Code distante en lecture), **T7b** (glisser-déposer des pages qui réordonne entre sœurs), **T10b** (idem pour l'arbre Tickets ; `moveTicket { index }` existait déjà, aucune décision de schéma), **T12b** (titre obligatoire à la création d'une note, fichiers sans titre signalés, tampon vidé après un renommage long ; la garantie « aucune frappe perdue » est déjà dans T12). Décisions consignées en spec code et onglets §12.7.

À la fin de la vague 3 : `bun run budget` (valeur au rapport), contrôle visuel des écrans 98–106 en sombre et en clair, liste des écarts (dont T1 si non dessinée), réponses d'Adam du 2026-09-27 : (1) oui, toutes les mutations git de `/api/code` réservées à la machine locale (spec §12.3) ; (2) oui, et aucune note ne reste sans titre (décision 7) ; (3) non, le glisser-déposer réordonne aussi (décisions 6 et 9)
