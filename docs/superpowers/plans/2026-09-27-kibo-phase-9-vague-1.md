# Kibo · Finitions UI/UX, vague 1 (phase 9, v1.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** exposer dans l'interface ce que le démon sait déjà faire (fiche ticket éditable, dépendances, pages, notes, réglages des widgets, domaines : lot 1 du plan d'action) et donner à l'application le comportement d'un logiciel de bureau (menus contextuels, menu macOS explicite, fenêtre mémorisée, liens externes maîtrisés, logo : lot 4), sans relever le budget de chargement initial ni consommer un token.

**Architecture:** presque tout est de l'interface. Le SDK gagne trois primitives partagées par le shell et les composants intégrés (`ConfirmDialog`, `ReasonDialog`, entrées de menu rendues en menu contextuel ou déroulant), chargées à la demande partout où elles n'y sont pas déjà. Le démon ne gagne que trois requêtes git (`discardChanges`, `stageAll`, `unstageAll`) et le contexte de session sur `/api/code`. La coque Tauri gagne un menu natif explicite, une taille minimale, la mémorisation de la fenêtre et deux permissions IPC de plus (titre de la fenêtre, ouverture d'URL `https`). Le logo est généré depuis une géométrie unique.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, React 19 + shadcn/ui (`context-menu`, `dropdown-menu`, `alert-dialog` déjà dans `packages/sdk/src/ui`), `@dnd-kit/core` 6.3.1 (déjà présent), Vite 7.1.6, happy-dom + Testing Library, Playwright, Tauri 2 (`tauri-plugin-opener`, `tauri-plugin-window-state`, `tauri::menu`), `@tauri-apps/plugin-opener` (nouvelle dépendance de `packages/ui`, import dynamique seulement), cargo 1.98 disponible en local (`~/.cargo/bin/cargo`).

**Spec:** `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` **§12** (décisions de la phase 9, écrites avant ce plan : annuler les changements, tout (dés)indexer, actions locales, menus contextuels, coque de bureau, logo) ; `docs/superpowers/specs/2026-09-27-kibo-mises-a-jour.md` §3.7 et §4 (capacité IPC amendée) ; `docs/superpowers/specs/2026-09-25-kibo-design.md` §5 (liens `blocks` / `relates`, pages imbriquées), §8 (Sheet ticket, écran 4, système visuel : logo), §10 ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` §5 (SDK, `notes`), §8.2 (notes = fichiers `.md`). Plan d'action : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (lots 1 et 4). Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md`. Données des maquettes : `design/donnees-fictives.md`.

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

## Décisions

Les décisions de démon et de coque sont écrites en spec code et onglets **§12** (12.1 à 12.6) et spec I §3.7 / §4 ; le plan ne les répète pas. Décisions d'interface prises par ce plan, à reporter au rapport du jalon :

1. **Primitives dans le SDK, pas dans l'UI** : `ConfirmDialog`, `ReasonDialog` et les entrées de menu (`MenuEntry`, `ContextMenuEntries`, `DropdownMenuEntries`) vivent dans `packages/sdk/src/ui/` (`@kibo/sdk/ui/*`), car les composants intégrés (tickets, kanban, notes) en ont besoin autant que le shell et n'ont pas accès à `packages/ui` (dogfooding). `BlockDialog` du Kanban devient un habillage de `ReasonDialog`.
2. **Un menu = une liste d'entrées** : le même tableau `MenuEntry[]` nourrit le clic droit (`ContextMenu`) et le bouton « ⋯ » (`DropdownMenu`) d'un élément, pour qu'ils ne divergent jamais et que les tests portent sur la liste.
3. **Réduction du chargement initial avant tout ajout** (T2) : `RenameWorkspaceDialog`, `NotesDirDialog`, `TrustDialog` et `OpenViewDialog` sortent de l'entrée (chargés à la demande), ce qui rend la marge nécessaire aux menus de la barre latérale et au menu d'instance.
4. **Fiche ticket** : titre et description s'éditent en place (clic sur le titre, bouton « Modifier » sous la description), statut et assigné par des sélecteurs ; le domaine reste le sélecteur existant ; « Assigner à un agent » reste le seul chemin vers un assigné agent (le sélecteur propose « Personne », « Moi » et, en projet partagé, les membres). Le menu « ⋯ » porte « Ouvrir dans un onglet », « Copier la clé », « Supprimer… ». La suppression ferme la fiche.
5. **Dépendances** : trois groupes dans la fiche, « Bloqué par », « Bloque », « Lié à », lignes cliquables (ouvre l'autre ticket dans la fiche) avec retrait, et un formulaire « Ajouter » (type + recherche par clé ou titre). Les badges « attend » disparaissent de la fiche au profit du groupe « Bloqué par » (les tickets terminés y sont grisés) ; ils restent dans l'arbre et le Kanban.
6. **Pages** : le glisser-déposer **reparente** (déposer sur une page ⇒ sous-page, sur le nom du projet ⇒ racine) ; l'ordre entre sœurs passe par « Monter » / « Descendre » du menu (`movePage` avec `index`). Renommer ouvre un dialogue (un titre de page se saisit rarement en place dans une barre latérale étroite).
7. **Notes** : « Renommer… » demande un titre ; le nom de fichier est son `slug` (`slugify` déjà dans `packages/ui/src/ai/slug.ts`, recopié dans le composant car un composant n'importe pas l'UI) dans le même dossier. À la **première sauvegarde d'une note nouvelle** encore nommée `sans-titre(-n).md`, si le premier titre `# …` donne un slug et que `<slug>.md` est libre, le fichier est renommé ; sinon il garde son nom. Jamais de renommage automatique d'une note existante.
8. **Réglages d'un widget** : formulaire généré depuis `configSchema` du manifeste (`ConfigField` : `enum` ⇒ sélecteur, `boolean` ⇒ interrupteur, `number` ⇒ champ numérique, `string` ⇒ champ texte, `nullable` ⇒ case « Aucune valeur ») ; les clés hors schéma (`source`, configuration MCP) sont conservées telles quelles. Pas d'entrée « Réglages… » quand le schéma est vide ou absent.
9. **Arbre Tickets** : le composant déclare `writes: ["ticket"]` ; le glisser-déposer reparente (déposer sur une ligne ⇒ sous-ticket ; « Déplacer à la racine » dans le menu) ; le statut se change par un sous-menu, « Bloqué » ouvre `ReasonDialog`. Le Kanban gagne le clic droit et « Supprimer… », rien d'autre (carte entière déplaçable et ordre dans la colonne : lot 8).
10. **Titre de fenêtre** : identique au titre de l'onglet actif suivi de « — Kibo » ; « Kibo » seul sur l'Accueil.
11. **Écrans Penpot** : dessinés par le chef d'équipe en tête de vague (T1). Si l'édition Penpot n'est pas faisable par un agent, la vague avance et le rapport du jalon liste ces écrans comme écart assumé ; les tâches UI suivent alors les descriptions textuelles de T1.

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
packages/ui/scripts/bundle-report.ts                              FORBIDDEN_IN_ENTRY (T2, T5, T6, T7, T8, T13)
packages/ui/scripts/app-icon.ts  app-icon.test.ts                 NOUVEAU (T5) : génère app-icon.svg et favicon.svg
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
packages/ui/src/dialogs/RenamePageDialog.tsx                      NOUVEAU (T7)
packages/ui/src/shell/AppSidebar.tsx                              délègue les pages à ProjectPages (T7) ; select-none, libellé ⌘K (T13)
packages/ui/src/i18n/fr.ts                                        nav (T7), domains (T9), common (T2)
packages/ui/src/dialogs/InstanceSettingsDialog.tsx  packages/ui/src/lib/config-form.ts  config-form.test.ts  instance-settings.test.tsx   NOUVEAU (T8)
packages/ui/src/i18n/fr-widgets.ts                                NOUVEAU (T8) ; fr-components.ts › instance (T8)
packages/ui/src/settings/DomainHeader.tsx  domain-header.test.tsx NOUVEAU (T9) ; DomainsPage.tsx, GuidelineFiles.tsx (T9)
components/tickets/src/TicketRowMenu.tsx  ticket-menu.ts  ticket-menu.test.ts  TicketsTree.tsx  fr.ts  kibo.component.json  package.json   (T10)
components/kanban/src/BlockDialog.tsx (habillage ReasonDialog, T2)  KanbanCard.tsx  Kanban.tsx  card-menu.ts  fr.ts   (T11)
components/notes/src/NoteMenu.tsx  RenameNoteDialog.tsx  note-name.ts  note-name.test.ts  NoteList.tsx  NotesView.tsx  fr.ts   (T12)
packages/ui/src/desktop/external-links.ts  native-context-menu.ts  window-title.ts  install.ts  *.test.ts   NOUVEAU (T13)
packages/ui/src/lib/shortcut-label.ts  shortcut-label.test.ts     NOUVEAU (T13) ; TabBar.tsx, AppSidebar.tsx, ShellHeader.tsx (T13)
packages/ui/package.json                                          @tauri-apps/plugin-opener (T13)
packages/ui/src/code/FileList.tsx  file-menu.ts  file-menu.test.ts  ChangesFiles.tsx  ChangesView.tsx  changes-files.test.tsx   (T15)
packages/ui/src/i18n/fr-code.ts                                   changes (T15)
packages/schema/src/code.ts  code.test.ts                         discardChanges, stageAll, unstageAll (T3)
packages/daemon/src/code/index-ops.ts  index-ops.test.ts  code-service.ts  code-service.test.ts   (T3)
packages/daemon/src/server.ts  server-code.test.ts                ctx transmis à code.handle (T3)
apps/desktop/src-tauri/Cargo.toml  Cargo.lock  src/main.rs  src/menu.rs   (T4)
apps/desktop/app-icon.svg  src-tauri/icons/*                      régénérés (T5)
design/penpot/scripts/17-finitions.js  design/penpot/kibo.penpot.xz  design/pdf/*.pdf  design/penpot/README.md   (T1)
e2e/menus.spec.ts  e2e/playwright.config.ts                       (T16)
docs/superpowers/specs/2026-09-26-kibo-code-onglets.md §12, 2026-09-27-kibo-mises-a-jour.md §3.7 §4, 2026-09-25-kibo-design.md §8   (écrits avec ce plan)
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
// et TicketSheet reçoit onDeleted() (= onClose) et onOpenTicket(ticketId) (= set({ sheet: { projectId: sheet.projectId, ticketId } }))  // T6

// shell/ContentView.tsx (T6) : Props gagne onOpenTicket(projectId: string, ticketId: string): void ; Shell passe (projectId, ticketId) => set({ sheet: { projectId, ticketId } })
// shell/TicketDetail.tsx (T6) : Props gagne onOpenTicket(ticketId: string): void ; onDeleted(): void ; canEdit calculé dedans par canEdit(project)
// pages/TicketTab.tsx (T6) : Props gagne onOpenTicket(ticketId: string): void

// ticket/use-ticket-command.ts (T6, réutilisé T14)
export function useTicketCommand(projectId: string): {
  run(command: ProjectCommand): Promise<boolean>;   // false et error renseigné en cas d'échec
  error: string | null;
  busy: boolean;
  clearError(): void;
};

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
export function externalLinkOf(target: EventTarget | null): string | null;      // href https: du <a target="_blank"> le plus proche, sinon null
export function installExternalLinks(root: Document, open: (url: string) => Promise<void>): () => void;
export function allowsNativeMenu(target: EventTarget | null, selection: string): boolean;   // champ de saisie ou sélection non vide
export function blockNativeContextMenu(root: Document, selection: () => string): () => void;
export function windowTitle(tabTitle: string | null): string;                   // null ⇒ "Kibo", sinon `${tabTitle} — Kibo`
export function installDesktop(): () => void;                                   // liens externes + menu natif ; renvoie le nettoyage
export function setNativeTitle(title: string): Promise<void>;                   // @tauri-apps/api/window (import dynamique)
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
export function autoRenameTarget(note: { path: string; title: string }, taken: readonly string[]): string | null;   // cible libre pour une note sans titre, sinon null
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
| 0 | T1 (chef d'équipe), T2, T3, T4, T5 | aucune (spec §12 écrite) | aucun : T2 = `packages/sdk/src/ui`, shell (dialogues), `bundle-report.ts` ; T3 = schéma `code.ts`, `daemon/src/code`, `server.ts` ; T4 = `apps/desktop/src-tauri` ; T5 = `KiboLogo.tsx`, `kibo-mark.ts`, `index.html`, `public/`, `app-icon.svg`, `icons/`, `bundle-report.ts` (une ligne : intégrer T2 avant T5) | T1 dessine 98–106 |
| 1 | T6, T7, T8, T9, T10, T11, T12, T13 | T6, T7, T8, T9 ← T2 · T10, T11 ← T2 (menu-entries, ConfirmDialog, ReasonDialog) · T12 ← T2 · T13 ← T2, T4 | `lazy-dialogs.ts` (T7, T8 : une ligne chacune) ; `bundle-report.ts` (T6, T7, T8, T13 : une regex chacune) ; `fr.ts` (T7 `nav`, T9 `domains`) ; `Shell.tsx` (T6 `onOpenTicket`, T13 `installDesktop`) ; `AppSidebar.tsx` (T7 extrait `ProjectPages`, T13 `select-none` et libellé ⌘K : **T13 après T7**) ; `TabBar.tsx` (T13 seul) | T6 : 98, 99 · T7 : 101 · T8 : 105 · T9 : 106 · T10 : 102, 99 · T11 : 99 · T12 : 103 |
| 2 | T14, T15 | T14 ← T6 · T15 ← T2, T3 | aucun (T14 = `ticket/`, `TicketDetail.tsx`, `fr-ticket-edit.ts` ; T15 = `code/`, `fr-code.ts`) | T14 : 100 · T15 : 104 |
| 3 | T16 | T16 ← T6, T7, T15 (et T3) | `e2e/playwright.config.ts` (T16 seul) | — |
| Jalon partiel | `bun run budget`, contrôle visuel 98–106 sombre et clair, rapport de vague au chef d'équipe | tout | — | toutes |

Ordre d'intégration de la vague 1 : T6, T7, T8, T9, T10, T11, T12, T13. Tâches à risque relues aussi par `kibo-lead` : T3 (git destructif, contexte de session), T4 (capacité IPC, menu natif), T13 (liens externes). T10 modifie le manifeste du composant tickets (`writes`) et sa conformité ; T10 et T11 sont indépendants.

Chemin critique : T2 → T6 → T14 → T16 (4 vagues). Vérification locale de la coque (T4) : `cargo test` est possible ici (`~/.cargo/bin/cargo` 1.98.1) après `bun run --cwd packages/ui build`, `bun apps/desktop/scripts/build-sidecar.ts` et `bun apps/desktop/scripts/build-toolchain.ts` (les binaires du sidecar sont exigés par `tauri-build`) ; le `desktop-smoke` de la CI fait foi pour Linux.

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

- [ ] **Step 1: Écrire `17-finitions.js`** avec un `S.draw[n]` par écran de la liste « Écrans à dessiner », textes **mot pour mot** (ils sont recopiés dans les fichiers `fr-*.ts` des tâches), composants shadcn (menu contextuel : fond `card`, bordure `border`, entrée destructive en rouge `destructive`, séparateur ; AlertDialog centré avec voile ; Select ; Switch). Données : KIB-12 et ses liens (`design/donnees-fictives.md` : KIB-5 → KIB-12, KIB-13 → KIB-12, KIB-12 → KIB-15, relates KIB-12 — KIB-16).

- [ ] **Step 2: Dessiner et exporter.** Charger `01` à `08` puis `17-finitions.js`, appeler `S.draw[98]()` … `S.draw[106]()` (moins de 120 s par appel), `S.retext`, puis `storage.exportPage("14")`, `scripts/build-pdf.sh`, `scripts/pack-penpot.sh`.

- [ ] **Step 3: Vérifier** dans `design/pdf/kibo-design-clair.pdf` que chaque écran a sa variante claire et que l'orange n'apparaît qu'en marque et agents.

- [ ] **Step 4: Commit**

```bash
git add design/penpot/scripts/17-finitions.js design/penpot/README.md design/penpot/kibo.penpot.xz design/pdf/kibo-design-sombre.pdf design/pdf/kibo-design-clair.pdf
git commit -m "docs(design): écrans 98 à 106 des finitions UI"
```

---

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

- [ ] **Step 1: Tests des primitives (rouges)**

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

- [ ] **Step 2: Implémenter les primitives**

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

- [ ] **Step 3: Réduire le chargement initial**

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

- [ ] **Step 4: Tests existants et gate**

Run: `bun test packages/ui/src/shell/workspace-switcher.test.tsx packages/ui/src/pages/instance.test.tsx packages/ui/src/shell/shell.test.tsx`
Expected: PASS après passage à `findBy*` des attentes qui rendent un dialogue désormais chargé à la demande (attente inchangée sur le contenu).

Run: `bun run check && bun run typecheck && bun test packages components ./scripts`
Expected: PASS.

- [ ] **Step 5: Commits**

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

- [ ] **Step 1: Schéma (test rouge puis vert)**

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

- [ ] **Step 2: Tests des opérations git (rouges)**

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

- [ ] **Step 3: Implémenter les opérations**

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

- [ ] **Step 4: Service : contexte de session et branchement (tests rouges puis verts)**

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

- [ ] **Step 5: Test HTTP du refus distant**

Regarder comment `packages/daemon/src/remote/*.test.ts` fabrique une session distante (`startServer` avec `remote` ou `ListenInfo.remote`) ; si un helper existe (`remoteServer`, `pairRemote`), ajouter dans `server-code.test.ts` :
```ts
test("openInEditor over the remote listener answers 403", async () => {
  // même montage que le test distant du dossier remote/, puis :
  const res = await send(remoteUrl, { method: "openInEditor", projectId, worktree: fx.repo, path: "README.md", line: null }, { cookie });
  expect(res.status).toBe(403);
});
```
S'il n'existe aucun helper, ne pas en construire : le test de service (Step 4) couvre le refus et `server.ts` n'a qu'un argument de plus (revue par `kibo-lead`).

- [ ] **Step 6: Gate et commits**

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

**À compléter** (arrêt sur limite d'usage). Cadre déjà fixé : spec §12.5, Contrats partagés › Coque, vague 0. Contenu attendu : `Cargo.toml` (+ `tauri-plugin-opener = "2"`, `tauri-plugin-window-state = "2"`, `Cargo.lock` régénéré) ; `main.rs` : `daemon_capability` (ex-`updater_capability`) + `core:window:allow-set-title` + `permission_scoped("opener:allow-open-url", vec![OpenUrlScope { url: "https://**" }], vec![])` avec `#[derive(Serialize)] struct OpenUrlScope { url: String }`, plugins enregistrés, `min_inner_size(960.0, 600.0)`, `restore_state(StateFlags::SIZE | POSITION | MAXIMIZED)` après `build()`, menu posé sur macOS seulement ; `menu.rs` : `MENU` en données (Kibo / Édition / Fenêtre, « Fermer la fenêtre » `CmdOrCtrl+Shift+W`, aucun `PredefinedMenuItem::close_window`), `build(app)`, `on_event`, test `menu_leaves_tab_shortcuts_to_the_webview` (aucun accélérateur de `MENU` dans `RESERVED_FOR_WEBVIEW`), test de l'origine conservé. Vérification locale : `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` après build de l'UI, du sidecar et de la toolchain ; CI `desktop-smoke`. Commits : `build(desktop): plugins opener et window-state`, `feat(desktop): menu macOS, fenêtre et capacité`.

### Task 5: Logo piste 5, icône, favicon

**À compléter.** Cadre : spec §12.5 et spec générale §8, Contrats partagés (UI › `kibo-mark.ts`), vague 0. Contenu attendu : `packages/ui/src/shell/kibo-mark.ts` (`kiboMarkSvg(mode: "dark" | "light" | "auto", size)` : port fidèle de `S.kanbanLogo` de `design/penpot/scripts/01-core.js`, `auto` = variante claire avec `<style>@media (prefers-color-scheme: dark)` pour le favicon), `KiboLogo.tsx` sur la même géométrie (tuile `bg-card`, cartes `currentColor`, carte orange `#F97316`), `packages/ui/scripts/app-icon.ts` (écrit `apps/desktop/app-icon.svg` en mode clair 1024 et `packages/ui/public/favicon.svg` en mode auto 64) et `app-icon.test.ts` (les deux fichiers égaux au générateur), `index.html` (`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`), `bun run --cwd apps/desktop tauri icon app-icon.svg` (icônes régénérées et commitées), test `pairing-screen.test.tsx` inchangé. Commits : `feat(ui): logo piste 5 et favicon`, `build(desktop): icônes régénérées`.

### Task 6: Fiche ticket éditable

**À compléter.** Cadre : décision 4, écrans 98–99, Contrats partagés (UI › `ticket/`, `ShellDialogs`, `ContentView`), vague 1 ← T2. Contenu attendu : `packages/ui/src/ticket/{TicketTitle,TicketActionsMenu,StatusSelect,AssigneeSelect,DescriptionEditor}.tsx`, `use-ticket-command.ts`, `fr-ticket-edit.ts`, `TicketDetail.tsx` (statut par `StatusSelect`, « Bloqué » ⇒ `ReasonDialog`, assigné, description éditable, sous-tickets cliquables via `onOpenTicket`), `TicketSheet.tsx` et `TicketTab.tsx` (titre éditable, menu « ⋯ » : Ouvrir dans un onglet, Copier la clé, Supprimer… ⇒ `ConfirmDialog` ⇒ `deleteTicket` ⇒ `onDeleted`), `ShellDialogs`/`ContentView`/`Shell` (`onOpenTicket`), lecture seule par `canEdit(project)`, `FORBIDDEN_IN_ENTRY` (+ `ticket/`, `fr-ticket-edit`). Tests `ticket-edit.test.tsx` (titre vide refusé garde l'ancien titre, statut bloqué demande un motif, suppression confirmée envoie `deleteTicket` et appelle `onDeleted`, rien d'éditable en lecture seule).

### Task 7: Pages de la barre latérale : menu, renommer, déplacer, supprimer

**À compléter.** Cadre : décision 6, écran 101, Contrats partagés (UI › `page-menu.ts`, `RenamePageDialog`, `DialogsState.renamePage/deletePage`), vague 1 ← T2. Contenu attendu : `shell/ProjectPages.tsx` (extrait de `AppSidebar.tsx`, `ContextMenu` + `SidebarMenuAction` « ⋯ » par page, `DndContext` reparentage, erreur `role="alert"`), `page-menu.ts` + `page-menu.test.ts` (`moveTargets` exclut la page et ses descendantes ; `pageMenuEntries` sans entrée d'écriture en lecture seule ; Monter/Descendre désactivés aux bornes), `dialogs/RenamePageDialog.tsx` (lazy), `ShellDialogs` (`renamePage`, `deletePage` ⇒ `ConfirmDialog` avec nombre de sous-pages et de widgets), `fr.ts` › `nav` (+ `openNewTab`, `renamePage`, `moveUp`, `moveDown`, `moveTo`, `root`, `deletePage`, `renameTitle`, `deletePageTitle(name)`, `deletePageHelp(subPages, widgets)`), `FORBIDDEN_IN_ENTRY` (+ `RenamePageDialog`).

### Task 8: Réglages d'un widget et retrait confirmé

**À compléter.** Cadre : décision 8, écran 105, Contrats partagés (UI › `config-form.ts`, `InstanceSettingsDialog`), vague 1 ← T2. Contenu attendu : `lib/config-form.ts` + test (`configFields`, `parseFieldInput`, `withFieldValue` conserve `source`, `configSchemaOf` intégré/tiers/vide), `dialogs/InstanceSettingsDialog.tsx` + test (enum ⇒ `Select`, boolean ⇒ `Switch`, number/string ⇒ `Input`, nullable ⇒ case « Aucune valeur », `validateConfig` avant envoi, `setInstanceConfig` avec la config fusionnée), `InstanceMenu.tsx` (« Réglages… » si schéma non vide ; « Retirer de la page… » ⇒ `ConfirmDialog`), `fr-widgets.ts`, `fr-components.ts` › `instance` (+ `settings`, `removeTitle(title)`, `removeHelp`, `removeConfirm`), `FORBIDDEN_IN_ENTRY` (+ `InstanceSettingsDialog`, `fr-widgets`).

### Task 9: Domaines : renommer, couleur, confirmations

**À compléter.** Cadre : écran 106, vague 1 ← T2. Contenu attendu : `settings/DomainHeader.tsx` + test (nom éditable ⇒ `updateDomain { patch: { name } }`, palette `DOMAIN_COLORS` ⇒ `patch: { color }`, nom en doublon ⇒ erreur affichée), `DomainsPage.tsx` (suppression du domaine et d'un fichier de guideline par `ConfirmDialog`), `fr.ts` › `domains` (+ `rename`, `color`, `pickColor(name)`, `deleteTitle(name)`, `deleteHelp(files)`, `removeFileTitle(path)`, `removeFileHelp`).

### Task 10: Arbre Tickets : menu, statut, parent, suppression

**À compléter.** Cadre : décision 9, écrans 102 et 99, Contrats partagés › Composants (`ticket-menu.ts`), vague 1 ← T2. Contenu attendu : `kibo.component.json` `writes: ["ticket"]`, `package.json` `@dnd-kit/core`, `ticket-menu.ts` + test, `TicketRowMenu.tsx` (`ContextMenu` sur la ligne + « ⋯ » au survol, `useReadOnly()`), `TicketsTree.tsx` (`DndContext` reparentage ⇒ `moveTicket`, `TREE_CYCLE` affiché, « Bloqué » ⇒ `ReasonDialog`, suppression ⇒ `ConfirmDialog` ⇒ `deleteTicket`), `fr.ts` du composant, `tickets.test.tsx` (mock SDK : `m.snapshot()` après chaque action ; conformité verte avec le nouveau manifeste).

### Task 11: Kanban : clic droit et suppression

**À compléter.** Cadre : décision 9, écran 99, Contrats partagés › Composants (`card-menu.ts`), vague 1 ← T2. Contenu attendu : `card-menu.ts` + test, `KanbanCard.tsx` (`ContextMenu` autour de l'article ; « ⋯ » rendu par `DropdownMenuEntries` avec Ouvrir, Déplacer vers ▸, Supprimer…), `Kanban.tsx` (`remove` ⇒ `ConfirmDialog` ⇒ `deleteTicket`), `fr.ts` (+ `open`, `remove`, `removeTitle(key)`, `removeHelp(children)`), `kanban.test.tsx` (suppression confirmée retire la carte ; rien en lecture seule).

### Task 12: Notes : renommer, supprimer, nom tiré du titre

**À compléter.** Cadre : décision 7, écran 103, Contrats partagés › Composants (`note-name.ts`), vague 1 ← T2. Contenu attendu : `note-name.ts` + test (`slugify`, `isUntitledPath`, `renamedPath`, `autoRenameTarget` refuse une cible prise), `NoteMenu.tsx` (« ⋯ » + clic droit : Renommer…, Supprimer…), `RenameNoteDialog.tsx` (titre ⇒ aide « Fichier : <slug>.md » ⇒ `sdk.notes.rename`, `CONFLICT` ⇒ « Une note porte déjà ce nom. »), suppression ⇒ `ConfirmDialog` ⇒ `sdk.notes.remove` puis sélection de la note suivante, `NotesView.tsx` (renommage automatique à la première sauvegarde d'une note `sans-titre`), `fr.ts`, tests avec `createMockSdk({ notes })`.

### Task 13: UI de bureau : liens externes, titre, menu natif bloqué, raccourcis

**À compléter.** Cadre : spec §12.4–12.5, Contrats partagés (UI › `desktop/`, `shortcut-label.ts`), vague 1 ← T2, T4, **après T7** (`AppSidebar.tsx`). Contenu attendu : `packages/ui/package.json` (+ `@tauri-apps/plugin-opener`), `desktop/external-links.ts` + test (`externalLinkOf` : `https:` seulement ; `javascript:`, `file:`, `mailto:`, `http:` ⇒ `null` et clic neutralisé), `desktop/native-context-menu.ts` + test (`allowsNativeMenu` vrai pour `input`/`textarea`/`contenteditable` ou sélection non vide), `desktop/window-title.ts` + test (`windowTitle`), `desktop/install.ts` (`installDesktop`, `setNativeTitle` via `@tauri-apps/api/window`), `Shell.tsx` (`if (inTauri()) import("../desktop/install")…` ; `useWindowTitle(describeTarget(active).title)`), `lib/shortcut-label.ts` + test, `TabBar.tsx` / `AppSidebar.tsx` (libellés par plateforme, `select-none` sur le chrome), `ShellHeader.tsx` (`select-none`), `FORBIDDEN_IN_ENTRY` (+ `desktop/`, `@tauri-apps/plugin-opener` déjà couvert par `@tauri-apps`).

### Task 14: Dépendances dans la fiche ticket

**À compléter.** Cadre : décision 5, écran 100, Contrats partagés (UI › `ticket/links.ts`), vague 2 ← T6. Contenu attendu : `ticket/links.ts` + test (`linksOf` : bloqué par / bloque / lié à, `relates` symétrique ; `linkCandidates` exclut lui-même et déjà liés, 8 max), `DependenciesSection.tsx` (trois groupes, lignes cliquables `onOpenTicket`, croix ⇒ `removeLink`, terminés grisés), `AddLinkForm.tsx` (type + recherche ⇒ `addLink` ; `LINK_CYCLE` ⇒ « Impossible : cela créerait une boucle de dépendances. » ; `INVALID_INPUT` ⇒ « Ce lien existe déjà. »), `TicketDetail.tsx` (badges « attend » remplacés par la section), `fr-ticket-edit.ts` (+ `deps.*`), `dependencies.test.tsx`.

### Task 15: Menu des fichiers modifiés et (dés)indexer tout

**À compléter.** Cadre : spec §12.1–12.4, écran 104, vague 2 ← T2, T3. Contenu attendu : `code/file-menu.ts` + test (`fileMenuEntries` : Voir le diff, Ouvrir dans un onglet, Ouvrir dans l'éditeur externe, Copier le chemin, Indexer/Désindexer, Annuler les changements… ; pas d'entrée « Annuler » sur un fichier en conflit), `FileList.tsx` (`ContextMenu` + « ⋯ » par ligne, boutons « Tout indexer » / « Tout désindexer » dans les en-têtes de section), `ChangesFiles.tsx` / `ChangesView.tsx` (`discard` ⇒ `ConfirmDialog` nommant les fichiers supprimés du disque ⇒ `client.code({ method: "discardChanges", ...w, paths })` avec `origPath` pour un renommage ; `stageAll` / `unstageAll` ; copie par `navigator.clipboard.writeText` avec erreur affichée), `fr-code.ts` › `changes` (+ `viewDiff`, `openInTab`, `copyPath`, `stageAll`, `unstageAll`, `discard`, `discardTitle(n)`, `discardRestored(name)`, `discardDeleted(name)`, `discardIrreversible`) et `errors.FORBIDDEN: "Cette action n'est possible que depuis l'ordinateur où tourne Kibo."`, tests `file-menu.test.ts`, `changes-files.test.tsx`.

### Task 16: E2E menus et fiche ticket

**À compléter.** Cadre : vague 3 ← T6, T7, T15 ; ports **4415 / 4416** (`menus-dark` / `menus-light`, scénario `question`). Contenu attendu : `e2e/menus.spec.ts` (projet avec dépôt `createE2eRepo` ; page « Kanban » renommée « Tableau » par clic droit, titre d'onglet mis à jour ; ticket créé par `rpc(page, { method: "command", … createTicket })`, ouvert dans la fiche depuis la carte Kanban, titre édité et enregistré ; fichier modifié dans le dépôt, Changements, clic droit ⇒ « Annuler les changements… » ⇒ confirmation ⇒ le fichier disparaît de la liste ; page supprimée ⇒ onglet « Page introuvable » ; captures `ecran-98`, `ecran-101`, `ecran-104`), `e2e/playwright.config.ts` (deux entrées dans `daemons`).

## Rapport de vague (chef d'équipe)

À la fin de la vague 3 : `bun run budget` (valeur au rapport), contrôle visuel des écrans 98–106 en sombre et en clair, liste des écarts (dont T1 si non dessinée), questions pour Adam : (1) faut-il réserver **toutes** les mutations git de `/api/code` (commit, push, PR) aux sessions locales, comme `discardChanges` ? (2) le renommage automatique des notes sans titre (décision 7) convient-il, ou préfère-t-il un renommage toujours manuel ? (3) glisser-déposer des pages et des tickets limité au reparentage (décisions 6 et 9) : suffisant pour v1.1 ?
