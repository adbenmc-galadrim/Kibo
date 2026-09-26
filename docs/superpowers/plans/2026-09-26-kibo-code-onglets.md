# Kibo Code et onglets (phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** voir, modifier et livrer le code d'un worktree sans quitter Kibo : vue Changements (diff unifié et côte à côte, édition CodeMirror 6, indexation par fichier et par bloc), commit en un clic, amend, reformulation et annulation des commits non poussés, pousser et créer la PR, aperçu de fichier, barre d'onglets persistée et palette `⌘K`.

**Architecture:** le démon ajoute un service `code` asynchrone (route `POST /api/code`, mêmes contrôles Host/Origin/session que `/api/rpc`) qui lance `git` et `gh` par `Bun.spawn` avec des arguments en tableau, n'accepte que les worktrees enregistrés du dépôt du projet, surveille les worktrees ouverts (`fs.watch` + debounce) et pousse des événements `{ type: "code" }` sur le WebSocket existant. L'état des onglets est une donnée locale (table SQLite `local_state`, RPC `getTabs` / `saveTabs`). L'UI ajoute la barre d'onglets au-dessus du shell, la palette, la vue Changements et l'aperçu de fichier ; les composants tiers ouvrent un fichier par `sdk.openFile`.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25, git ≥ 2.36 (`worktree list -z`), GitHub CLI `gh`, React 19, shadcn/ui (context-menu, command, toggle-group, checkbox, alert-dialog), cmdk 1.1.1, CodeMirror 6 (`codemirror` 6.0.2, `@codemirror/merge` 6.12.2, `@codemirror/language-data` 6.5.2), Shiki 4.4.3 (moteur JavaScript), @dnd-kit/sortable 10.0.0, Playwright 1.55.

**Spec:** `docs/superpowers/specs/2026-09-25-kibo-design.md` (§7 « Code, commits et PR » et « Liens de fichiers », §8 onglets, écrans 18, 20 à 23, §10, §11) et son complément `docs/superpowers/specs/2026-09-26-kibo-code-onglets.md` (décisions de cette phase, à lire en entier). Maquettes : `design/pdf/kibo-design-{sombre,clair}.pdf`, pages 28 (écran 18, palette), 33 (écran 20, onglets), 34 (écran 21, Changements), 35 (écran 22, PR), 36 (écran 23, aperçu). Revue : `design/revue-flows.md` §7 (Code).

## Global Constraints

- Bun **1.4.2** (CI), dépendances figées par `bun.lock` (`bunfig.toml` : `exact = true`), aucun script `postinstall`.
- **Aucun commentaire dans le code** (rédhibitoire en review). Seule exception : une contrainte externe invisible, en une ligne.
- Code, identifiants, messages d'erreur internes en anglais ; textes UI en français **tutoyé**, tous dans `packages/ui/src/i18n/fr.ts` (ajoutés une fois pour toutes à la tâche 1 ; une tâche UI qui manque d'un texte l'ajoute dans `fr.ts` sans toucher aux autres clés).
- Primitives shadcn dans `packages/sdk/src/ui` (importées par `@kibo/sdk/ui/<nom>`), tokens zinc, orange `#F97316` réservé aux agents et à la marque (exceptions dictées par les maquettes : bouton « Édition » actif, pastille de l'onglet Changements, compteur `↑n`).
- Identifiants de formulaire par `useId()`. Aucune erreur avalée : toute erreur visible par l'utilisateur est rendue dans un élément `role="alert"` ; côté démon, une erreur de fond est journalisée par `console.error("[kibo-daemon] …")`.
- Dépendances entre paquets : `schema ← core ← daemon`, `schema ← sdk ← components ← ui`. L'UI n'importe jamais `@kibo/core` et ne parle qu'au démon.
- Tout nouveau paquet ou dossier TypeScript entre dans `bun run typecheck` (script racine). Tout nouvel écran existe en sombre et en clair ; E2E Playwright dans les deux thèmes ; CI macOS + Linux.
- Git et `gh` : `Bun.spawn` avec un tableau d'arguments, jamais de shell ; options venues de l'UI sous forme `--option=valeur`, chemins après `--`. Aucune écriture hors d'un worktree enregistré du dépôt du projet. Un commit poussé n'est jamais modifié.
- Chaque route nouvelle passe par les contrôles Host, Origin et session du serveur existant.
- Tests sans réseau ni tokens : dépôts git temporaires réels (`createGitFixture`), faux `gh` (`installFakeGh`), faux éditeur (`installFakeBin`).
- Commits : une ligne en français, préfixe conventionnel, moins de 50 caractères, sans body, sans aucune mention d'IA ; `git add` des fichiers explicites.

## Review Focus

1. **Un agent modifie un fichier pendant que l'utilisateur l'édite dans Kibo** : l'enregistrement est refusé (`FILE_CHANGED`) et le fichier sur disque garde la version de l'agent (tâche 17).
2. **« Indexer le bloc » après une modification du fichier sur disque** : si l'en-tête `@@` du bloc a changé, refus `GIT_STALE`, index inchangé, l'UI recharge le diff (tâches 17 et 16).
3. **Amend, reformulation ou annulation d'un commit déjà poussé, par une UI périmée ou une requête forgée** : refus `GIT_PUSHED`, historique identique (tâche 18).
4. **Chemin `../`, lien symbolique vers l'extérieur, chemin sous `.git/` ou worktree non enregistré** : refus `PATH_OUTSIDE_PROJECT` (403), rien n'est lu ni écrit (tâches 3, 15, 21).
5. **Reformuler un commit ancien avec des fichiers indexés et non indexés en cours** : après l'opération, l'index et le worktree sont exactement ceux d'avant (tâche 18).

## File Structure

```
packages/schema/src/   code.ts (git, fichiers, PR, CodeRequest/CodeResult, CodeEvent) · tabs.ts (TabTarget, Tab, TabsState)
                       external-ref.ts (ExternalRef, PrState) · errors.ts, ticket.ts, rpc.ts, index.ts (modifiés)
packages/core/src/     tickets.ts, commands.ts (externalRefs, upsertExternalRef) · commit-message.ts (message, clé depuis la branche,
                       description de PR, défauts de commit)
packages/daemon/src/   store.ts (table local_state) · service.ts (getTabs, saveTabs, call) · server.ts (/api/code, événements)
                       main.ts (service code)
packages/daemon/src/code/
                       run.ts (spawn git/gh) · safe-path.ts · parse-status.ts · parse-diff.ts · parse-log.ts · patch.ts
                       repo.ts (dépôt, worktrees autorisés) · read.ts (état, diff, fichier, branches, comparaison)
                       index-ops.ts (indexation, écriture) · history-ops.ts (commit, amend, reformuler, annuler, abandon)
                       remote-ops.ts (push, gh, PR) · editor.ts (éditeur externe) · watcher.ts · code-service.ts
                       testing/git-fixture.ts · testing/fake-gh.ts
packages/sdk/src/      client.ts (code(), subscribeCode()) · types.ts, sdk.ts, mock.ts (openFile) · file-link.tsx
                       ui/{context-menu,command,toggle,toggle-group,checkbox,alert-dialog}.tsx (shadcn)
packages/ui/src/       i18n/fr.ts · lib/{error-message,relative-time}.ts · theme.ts · route.ts · state/use-snapshots.ts
                       tabs/{target-hash,tabs-model,tab-title,use-tabs,use-tab-shortcuts,use-hash-sync}.ts · tabs/TabBar.tsx
                       palette/{palette-items.ts,agent-items.ts,CommandPalette.tsx}
                       code/{diff-rows.ts,DiffView.tsx,DiffToolbar.tsx,FileList.tsx,CommitPanel.tsx,UnpushedCommits.tsx,
                             RewordDialog.tsx,UndoCommitDialog.tsx,PushPrDialog.tsx,pr-command.ts,use-code.ts,
                             WorktreePicker.tsx,DiffEditorPane.tsx,ChangesView.tsx,use-worktrees.ts,
                             use-project-git.ts,agent-slots.tsx}
                       files/{language.ts,highlight.ts,use-file-content.ts,CodeLines.tsx,CodeEditor.tsx,FilePreviewSheet.tsx,FileTabView.tsx}
                       shell/{Shell,AppSidebar,Breadcrumb,Host,TicketSheet,TicketDetail,ContentView}.tsx · pages/TicketTab.tsx
e2e/                   serve.ts (faux gh) · git-repo.ts · code.spec.ts · tabs.spec.ts · screens.spec.ts
```

Chaque fichier a une responsabilité ; les parseurs git sont purs et testés sur des chaînes ; les opérations git sont testées sur des dépôts temporaires réels ; les composants UI reçoivent leurs données par props et sont testés sans démon.

---

### Task 1: Contrats partagés (schémas, SDK, textes)

Tâche courte et bloquante : elle fige tous les types, requêtes, événements et textes UI de la phase, pour que les tâches suivantes travaillent sur des fichiers disjoints.

**Files:**
- Create: `packages/schema/src/external-ref.ts`, `packages/schema/src/code.ts`, `packages/schema/src/tabs.ts`, `packages/schema/src/code.test.ts`, `packages/ui/src/lib/error-message.ts`, `packages/ui/src/lib/error-message.test.ts`, `packages/ui/src/state/use-snapshots.ts`, `packages/ui/src/state/use-snapshots.test.tsx`
- Modify: `packages/schema/src/errors.ts`, `packages/schema/src/ticket.ts`, `packages/schema/src/rpc.ts`, `packages/schema/src/index.ts`, `packages/schema/src/schema.test.ts`, `packages/core/src/tickets.ts`, `packages/core/src/commands.ts`, `packages/core/src/tickets.test.ts`, `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/mock.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/client.test.ts`, `packages/sdk/src/sdk.test.ts`, `packages/ui/src/i18n/fr.ts`, `packages/ui/src/shell/Host.tsx`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/pages/PageView.tsx`, `components/tickets/src/build-tree.test.ts`, `components/kanban/src/filter.test.ts`

**Interfaces:**
- Consumes: `KiboError`, `NodeId`, `ProjectSnapshot`, `ProjectSummary`, `createClient` (existants).
- Produces (`@kibo/schema`) :
  - `PrState = "open" | "draft" | "merged" | "closed"`, `ExternalRef = { kind: "github_pr"; url: string; number: number; state: PrState }` ; `Ticket.externalRefs: ExternalRef[]`.
  - `KiboErrorCode` + `"NOT_A_REPO" | "PATH_OUTSIDE_PROJECT" | "GIT_FAILED" | "GIT_STALE" | "GIT_PUSHED" | "GIT_BUSY" | "FILE_CHANGED" | "GH_UNAVAILABLE" | "GH_FAILED" | "EDITOR_UNAVAILABLE"`.
  - `ProjectCommand` + `{ method: "upsertExternalRef"; ticketId: string; ref: ExternalRef }` (résultat `Ticket`).
  - `RpcRequest` + `{ method: "getTabs" }` (→ `TabsState`) et `{ method: "saveTabs"; state: TabsState }` (→ `null`).
  - `code.ts` : `RelPath`, `Sha`, `GhLogin`, `ChangeKind`, `ChangeArea`, `FileChange`, `Worktree`, `CommitInfo`, `GitOperation`, `RepoStatus`, `DiffLine`, `Hunk`, `FileDiff`, `FileRevision`, `FileContent`, `RemoteBranches`, `CompareResult`, `PrInfo`, `GhStatus`, `CommitDefaults`, `FileRef`, `CodeEvent`, `CodeRequest`, `CodeResult` (types exacts dans le code ci-dessous).
  - `tabs.ts` : `TabTarget`, `Tab`, `TabsState`, `EMPTY_TABS`, `MAX_TABS = 50`, `MAX_RECENTS = 10`.
- Produces (`@kibo/core`) : `upsertExternalRef(doc, ticketId, ref): Ticket` ; `createTicket` initialise `externalRefs: []`.
- Produces (`@kibo/sdk`) : `FileOpenRequest = { path: string; line?: number | null; origin?: string | null }` ; `KiboSdk.openFile(req)` ; `MockSdk.openedFiles: FileOpenRequest[]` ; `KiboClient.code(req)` et `KiboClient.subscribeCode(listener: (e: CodeEvent) => void): () => void`.
- Produces (`packages/ui`) : `fr` complet de la phase ; `errorMessage(e: unknown): string` ; `useSnapshots(projectIds: string[]): Map<string, ProjectSnapshot>` ; `Host.openFile(ref: FileRef): void`.

- [x] **Step 1: Écrire les tests des schémas**

`packages/schema/src/code.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { CodeEvent, CodeRequest, GhLogin, RelPath } from "./code";
import { ExternalRef } from "./external-ref";
import { EMPTY_TABS, TabsState, TabTarget } from "./tabs";

describe("code contracts", () => {
  test("RelPath refuses absolute paths, parent segments and NUL", () => {
    expect(RelPath.safeParse("packages/core/src/ticket.ts").success).toBe(true);
    expect(RelPath.safeParse("/etc/passwd").success).toBe(false);
    expect(RelPath.safeParse("a/../../b").success).toBe(false);
    expect(RelPath.safeParse("a\0b").success).toBe(false);
  });

  test("GhLogin accepts logins and org/team, refuses options", () => {
    expect(GhLogin.safeParse("adam").success).toBe(true);
    expect(GhLogin.safeParse("kibo/core-team").success).toBe(true);
    expect(GhLogin.safeParse("--admin").success).toBe(false);
  });

  test("CodeRequest validates each method", () => {
    const base = { projectId: "p1", worktree: "/tmp/repo" };
    expect(CodeRequest.safeParse({ method: "status", ...base }).success).toBe(true);
    expect(
      CodeRequest.safeParse({ method: "stageHunk", ...base, path: "a.ts", area: "unstaged", index: 0, header: "@@ -1 +1 @@" })
        .success,
    ).toBe(true);
    expect(CodeRequest.safeParse({ method: "commit", ...base, message: "   ", amend: false }).success).toBe(false);
    expect(CodeRequest.safeParse({ method: "reword", ...base, sha: "not-a-sha", message: "x" }).success).toBe(false);
    expect(
      CodeRequest.safeParse({
        method: "createPr",
        ...base,
        title: "feat: x",
        body: "",
        base: "main",
        draft: true,
        reviewers: ["--admin"],
        ticketId: null,
      }).success,
    ).toBe(false);
  });

  test("CodeEvent is tagged", () => {
    expect(CodeEvent.safeParse({ type: "code", projectId: "p", worktree: "/w" }).success).toBe(true);
    expect(CodeEvent.safeParse({ projectId: "p" }).success).toBe(false);
  });

  test("ExternalRef describes a GitHub PR", () => {
    const ref = { kind: "github_pr", url: "https://github.com/kibo/test/pull/1", number: 1, state: "draft" };
    expect(ExternalRef.safeParse(ref).success).toBe(true);
    expect(ExternalRef.safeParse({ ...ref, state: "unknown" }).success).toBe(false);
  });
});

describe("tabs contracts", () => {
  test("targets are discriminated by kind", () => {
    expect(TabTarget.safeParse({ kind: "page", projectId: "p", pageId: "1@1" }).success).toBe(true);
    expect(TabTarget.safeParse({ kind: "file", projectId: "p", worktree: null, path: "a.ts", line: 4 }).success).toBe(true);
    expect(TabTarget.safeParse({ kind: "file", projectId: "p", worktree: null, path: "../a", line: null }).success).toBe(
      false,
    );
  });

  test("the empty state is valid and the tab count is bounded", () => {
    expect(TabsState.parse(EMPTY_TABS)).toEqual({ tabs: [], activeId: null, recents: [] });
    const tab = { id: "t", target: { kind: "project", projectId: "p" }, pinned: false };
    expect(TabsState.safeParse({ tabs: Array.from({ length: 51 }, () => tab), activeId: null, recents: [] }).success).toBe(
      false,
    );
  });
});
```

Dans `packages/schema/src/schema.test.ts`, ajouter `externalRefs: [],` à l'objet `base` du bloc `describe("ticket")`. Même ajout (`externalRefs: [],`) dans les fabriques de `components/tickets/src/build-tree.test.ts` et `components/kanban/src/filter.test.ts`.

- [x] **Step 2: Lancer les tests pour les voir échouer**

Run: `bun test packages/schema`
Expected: FAIL, `Cannot find module './code'`.

- [x] **Step 3: Écrire les schémas**

`packages/schema/src/external-ref.ts` :
```ts
import { z } from "zod";

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const ExternalRef = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("github_pr"),
    url: z.string().url(),
    number: z.number().int().positive(),
    state: PrState,
  }),
]);
export type ExternalRef = z.infer<typeof ExternalRef>;
```

`packages/schema/src/code.ts` :
```ts
import { z } from "zod";
import { PrState } from "./external-ref";
import { NodeId } from "./ids";

export const RelPath = z
  .string()
  .min(1)
  .max(4096)
  .refine((p) => !p.includes("\0") && !p.startsWith("/") && !p.split(/[\\/]/).includes(".."), {
    message: "path must be relative and stay inside the worktree",
  });
export const Sha = z.string().regex(/^[0-9a-f]{7,64}$/);
export const GhLogin = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\/[A-Za-z0-9._-]{1,100})?$/);
const Hash = z.string().regex(/^[0-9a-f]{40}$/);

export const ChangeKind = z.enum(["modified", "added", "deleted", "renamed", "untracked", "conflicted"]);
export type ChangeKind = z.infer<typeof ChangeKind>;
export const ChangeArea = z.enum(["staged", "unstaged"]);
export type ChangeArea = z.infer<typeof ChangeArea>;

export const FileChange = z.object({
  path: z.string(),
  origPath: z.string().nullable(),
  area: ChangeArea,
  kind: ChangeKind,
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
});
export type FileChange = z.infer<typeof FileChange>;

export const Worktree = z.object({
  path: z.string(),
  branch: z.string().nullable(),
  head: z.string().nullable(),
  isMain: z.boolean(),
});
export type Worktree = z.infer<typeof Worktree>;

export const CommitInfo = z.object({
  sha: z.string(),
  shortSha: z.string(),
  subject: z.string(),
  body: z.string(),
  author: z.string(),
  time: z.number().int(),
  pushed: z.boolean(),
});
export type CommitInfo = z.infer<typeof CommitInfo>;

export const GitOperation = z.enum(["rebase", "merge", "cherry-pick", "revert"]);
export type GitOperation = z.infer<typeof GitOperation>;

export const RepoStatus = z.object({
  worktree: z.string(),
  branch: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  hasHead: z.boolean(),
  operation: GitOperation.nullable(),
  files: z.array(FileChange),
  commits: z.array(CommitInfo),
});
export type RepoStatus = z.infer<typeof RepoStatus>;

export const DiffLine = z.object({
  kind: z.enum(["context", "add", "del"]),
  text: z.string(),
  oldNo: z.number().int().nullable(),
  newNo: z.number().int().nullable(),
  noEol: z.boolean(),
});
export type DiffLine = z.infer<typeof DiffLine>;

export const Hunk = z.object({
  header: z.string(),
  oldStart: z.number().int(),
  oldLines: z.number().int(),
  newStart: z.number().int(),
  newLines: z.number().int(),
  section: z.string(),
  lines: z.array(DiffLine),
});
export type Hunk = z.infer<typeof Hunk>;

export const FileDiff = z.object({
  path: z.string(),
  origPath: z.string().nullable(),
  binary: z.boolean(),
  hunkStaging: z.boolean(),
  additions: z.number().int(),
  deletions: z.number().int(),
  hunks: z.array(Hunk),
});
export type FileDiff = z.infer<typeof FileDiff>;

export const FileRevision = z.enum(["worktree", "index", "head"]);
export type FileRevision = z.infer<typeof FileRevision>;

export const FileContent = z.object({
  path: z.string(),
  revision: FileRevision,
  content: z.string().nullable(),
  hash: z.string().nullable(),
  size: z.number().int().nonnegative(),
  binary: z.boolean(),
  tooLarge: z.boolean(),
  lines: z.number().int().nonnegative(),
  modifiedAt: z.number().int().nullable(),
  tracked: z.boolean(),
  dirty: z.boolean(),
});
export type FileContent = z.infer<typeof FileContent>;

export const RemoteBranches = z.object({
  remote: z.string().nullable(),
  branches: z.array(z.string()),
  defaultBase: z.string().nullable(),
});
export type RemoteBranches = z.infer<typeof RemoteBranches>;

export const CompareResult = z.object({ commits: z.array(CommitInfo), fileCount: z.number().int().nonnegative() });
export type CompareResult = z.infer<typeof CompareResult>;

export const PrInfo = z.object({ number: z.number().int().positive(), url: z.string().url(), state: PrState });
export type PrInfo = z.infer<typeof PrInfo>;

export const GhStatus = z.object({ available: z.boolean(), detail: z.string().nullable() });
export type GhStatus = z.infer<typeof GhStatus>;

export const CommitDefaults = z.object({
  ticketId: z.string().nullable(),
  ticketKey: z.string().nullable(),
  message: z.string(),
  prTitle: z.string(),
  prBody: z.string(),
});
export type CommitDefaults = z.infer<typeof CommitDefaults>;

export const FileRef = z.object({
  projectId: z.string().min(1),
  worktree: z.string().min(1).nullable(),
  path: RelPath,
  line: z.number().int().positive().nullable(),
  origin: z.string().nullable(),
});
export type FileRef = z.infer<typeof FileRef>;

export const CodeEvent = z.object({ type: z.literal("code"), projectId: z.string(), worktree: z.string() });
export type CodeEvent = z.infer<typeof CodeEvent>;

const P = { projectId: z.string().min(1) };
const W = { ...P, worktree: z.string().min(1) };
const Message = z.string().trim().min(1).max(100_000);
const BranchName = z.string().min(1).max(255);

export const CodeRequest = z.discriminatedUnion("method", [
  z.object({ method: z.literal("worktrees"), ...P }),
  z.object({ method: z.literal("status"), ...W }),
  z.object({ method: z.literal("diff"), ...W, path: RelPath, origPath: RelPath.nullable(), area: ChangeArea }),
  z.object({ method: z.literal("readFile"), ...W, path: RelPath, revision: FileRevision }),
  z.object({ method: z.literal("writeFile"), ...W, path: RelPath, content: z.string().max(1_000_000), baseHash: Hash }),
  z.object({ method: z.literal("stageFiles"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({ method: z.literal("unstageFiles"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({
    method: z.literal("stageHunk"),
    ...W,
    path: RelPath,
    area: ChangeArea,
    index: z.number().int().nonnegative(),
    header: z.string().startsWith("@@"),
  }),
  z.object({ method: z.literal("commit"), ...W, message: Message, amend: z.boolean() }),
  z.object({ method: z.literal("reword"), ...W, sha: Sha, message: Message }),
  z.object({ method: z.literal("undoCommit"), ...W, sha: Sha }),
  z.object({ method: z.literal("abortOperation"), ...W }),
  z.object({ method: z.literal("push"), ...W }),
  z.object({ method: z.literal("remoteBranches"), ...W }),
  z.object({ method: z.literal("compare"), ...W, base: BranchName }),
  z.object({ method: z.literal("commitDefaults"), ...W }),
  z.object({ method: z.literal("ghStatus"), ...W }),
  z.object({ method: z.literal("prForBranch"), ...W }),
  z.object({
    method: z.literal("createPr"),
    ...W,
    title: z.string().trim().min(1).max(256),
    body: z.string().max(65_536),
    base: BranchName,
    draft: z.boolean(),
    reviewers: z.array(GhLogin).max(15),
    ticketId: NodeId.nullable(),
  }),
  z.object({ method: z.literal("openInEditor"), ...W, path: RelPath, line: z.number().int().positive().nullable() }),
]);
export type CodeRequest = z.infer<typeof CodeRequest>;

export type CodeResult = {
  worktrees: Worktree[];
  status: RepoStatus;
  diff: FileDiff;
  readFile: FileContent;
  writeFile: { hash: string };
  stageFiles: null;
  unstageFiles: null;
  stageHunk: null;
  commit: CommitInfo;
  reword: null;
  undoCommit: null;
  abortOperation: null;
  push: null;
  remoteBranches: RemoteBranches;
  compare: CompareResult;
  commitDefaults: CommitDefaults;
  ghStatus: GhStatus;
  prForBranch: PrInfo | null;
  createPr: PrInfo;
  openInEditor: null;
};
```

`packages/schema/src/tabs.ts` :
```ts
import { z } from "zod";
import { RelPath } from "./code";
import { NodeId } from "./ids";

const ProjectId = z.string().min(1);
const WorktreePath = z.string().min(1).nullable();

export const TabTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: ProjectId }),
  z.object({ kind: z.literal("page"), projectId: ProjectId, pageId: NodeId }),
  z.object({ kind: z.literal("changes"), projectId: ProjectId, worktree: WorktreePath }),
  z.object({
    kind: z.literal("file"),
    projectId: ProjectId,
    worktree: WorktreePath,
    path: RelPath,
    line: z.number().int().positive().nullable(),
  }),
  z.object({ kind: z.literal("ticket"), projectId: ProjectId, ticketId: NodeId }),
]);
export type TabTarget = z.infer<typeof TabTarget>;

export const Tab = z.object({ id: z.string().min(1), target: TabTarget, pinned: z.boolean() });
export type Tab = z.infer<typeof Tab>;

export const MAX_TABS = 50;
export const MAX_RECENTS = 10;

export const TabsState = z.object({
  tabs: z.array(Tab).max(MAX_TABS),
  activeId: z.string().nullable(),
  recents: z.array(TabTarget).max(MAX_RECENTS),
});
export type TabsState = z.infer<typeof TabsState>;

export const EMPTY_TABS: TabsState = { tabs: [], activeId: null, recents: [] };
```

`packages/schema/src/errors.ts`, union complétée :
```ts
export type KiboErrorCode =
  | "TREE_CYCLE"
  | "NOT_FOUND"
  | "BLOCKED_REASON_REQUIRED"
  | "INVALID_INPUT"
  | "LINK_CYCLE"
  | "STORE_CORRUPT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED"
  | "INTERNAL"
  | "NOT_A_REPO"
  | "PATH_OUTSIDE_PROJECT"
  | "GIT_FAILED"
  | "GIT_STALE"
  | "GIT_PUSHED"
  | "GIT_BUSY"
  | "FILE_CHANGED"
  | "GH_UNAVAILABLE"
  | "GH_FAILED"
  | "EDITOR_UNAVAILABLE";
```
(Si la phase 2 a déjà ajouté des codes, garder les siens et ajouter ceux-ci.)

`packages/schema/src/ticket.ts` : importer `ExternalRef` depuis `./external-ref` et ajouter le champ `externalRefs: z.array(ExternalRef),` après `parentId` dans `z.object({...})`.

`packages/schema/src/rpc.ts` :
- importer `ExternalRef` depuis `./external-ref` et `TabsState` depuis `./tabs` ;
- ajouter à `ProjectCommand` : `z.object({ method: z.literal("upsertExternalRef"), ticketId: NodeId, ref: ExternalRef }),` ;
- ajouter à `CommandResult` : `upsertExternalRef: Ticket;` ;
- ajouter à `RpcRequest` : `z.object({ method: z.literal("getTabs") }),` et `z.object({ method: z.literal("saveTabs"), state: TabsState }),` ;
- ajouter à `RpcResult` : `getTabs: TabsState;` et `saveTabs: null;`.

`packages/schema/src/index.ts` : ajouter `export * from "./code";`, `export * from "./external-ref";`, `export * from "./tabs";`.

- [x] **Step 4: Relancer les tests du schéma**

Run: `bun test packages/schema`
Expected: PASS.

- [x] **Step 5: Test du noyau pour `upsertExternalRef`**

Ajouter à `packages/core/src/tickets.test.ts` (même style que les tests existants, avec l'import `upsertExternalRef` depuis `./tickets`) :
```ts
test("upsertExternalRef adds a PR once per URL and keeps the latest state", () => {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  const t = createTicket(doc, { title: "Schéma" });
  expect(t.externalRefs).toEqual([]);
  const url = "https://github.com/kibo/test/pull/3";
  upsertExternalRef(doc, t.id, { kind: "github_pr", url, number: 3, state: "draft" });
  const after = upsertExternalRef(doc, t.id, { kind: "github_pr", url, number: 3, state: "merged" });
  expect(after.externalRefs).toEqual([{ kind: "github_pr", url, number: 3, state: "merged" }]);
});
```

Run: `bun test packages/core/src/tickets.test.ts`
Expected: FAIL, `upsertExternalRef` introuvable.

- [x] **Step 6: Implémenter dans le noyau**

`packages/core/src/tickets.ts` :
- importer `type ExternalRef` depuis `@kibo/schema` ;
- dans `readTicket`, ajouter `externalRefs: (d.get("externalRefs") as ExternalRef[] | undefined) ?? [],` (même motif que `assignee`) ;
- dans `createTicket`, ajouter `node.data.set("externalRefs", []);` avant `writeDescription` ;
- ajouter :
```ts
export function upsertExternalRef(doc: LoroDoc, id: string, ref: ExternalRef): Ticket {
  const node = getNode(tree(doc), id);
  const current = (node.data.get("externalRefs") as ExternalRef[] | undefined) ?? [];
  node.data.set("externalRefs", [...current.filter((r) => r.url !== ref.url), ref]);
  doc.commit();
  return readTicket(node);
}
```

`packages/core/src/commands.ts` : importer `upsertExternalRef` et ajouter le cas
```ts
    case "upsertExternalRef":
      return upsertExternalRef(doc, cmd.ticketId, cmd.ref);
```

Run: `bun test packages/core`
Expected: PASS.

- [x] **Step 7: Tests du SDK (client et openFile)**

Ajouter à `packages/sdk/src/client.test.ts` :
```ts
test("code posts to /api/code and returns the result", async () => {
  const seen: string[] = [];
  const fetchStub = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify({ ok: true, result: { remote: "origin", branches: ["main"], defaultBase: "main" } }));
  }) as unknown as typeof fetch;
  const client = createClient({ baseUrl: "http://127.0.0.1:1", fetch: fetchStub });
  const res = await client.code({ method: "remoteBranches", projectId: "p", worktree: "/w" });
  expect(res.branches).toEqual(["main"]);
  expect(seen).toEqual(["http://127.0.0.1:1/api/code"]);
});

test("code rejects with the daemon error code", async () => {
  const client = createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: stubFetch(409, { ok: false, error: { code: "GIT_PUSHED", message: "pushed" } }),
  });
  await expect(client.code({ method: "undoCommit", projectId: "p", worktree: "/w", sha: "abcdef1" })).rejects.toMatchObject(
    { code: "GIT_PUSHED" },
  );
});

test("socket messages are routed to project or code listeners", () => {
  const sockets: { onmessage: ((e: { data: string }) => void) | null; close(): void }[] = [];
  class FakeSocket {
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    constructor() {
      sockets.push(this);
    }
    close() {}
  }
  const original = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  try {
    const client = createClient({ baseUrl: "http://127.0.0.1:1", fetch: stubFetch(200, {}) });
    const projects: (string | null)[] = [];
    const code: string[] = [];
    const offProject = client.subscribe((id) => projects.push(id));
    const offCode = client.subscribeCode((e) => code.push(e.worktree));
    sockets[0]?.onmessage?.({ data: JSON.stringify({ projectId: "p1" }) });
    sockets[0]?.onmessage?.({ data: JSON.stringify({ type: "code", projectId: "p1", worktree: "/w" }) });
    expect(projects).toEqual(["p1"]);
    expect(code).toEqual(["/w"]);
    expect(sockets).toHaveLength(1);
    offProject();
    offCode();
  } finally {
    globalThis.WebSocket = original;
  }
});
```
(Le double `as unknown as` est la seule façon de fournir un faux `fetch` / `WebSocket` typé ; même motif que `stubFetch`.)

Ajouter à `packages/sdk/src/sdk.test.ts` :
```ts
test("openFile is forwarded to the host and recorded by the mock", () => {
  const m = createMockSdk(manifest);
  m.sdk.openFile({ path: "packages/core/src/ticket.ts", line: 42 });
  expect(m.openedFiles).toEqual([{ path: "packages/core/src/ticket.ts", line: 42 }]);
});
```
(`manifest` : réutiliser celui déjà défini en tête de `sdk.test.ts`.)

Run: `bun test packages/sdk`
Expected: FAIL (`client.code` et `openFile` absents).

- [x] **Step 8: Implémenter le SDK**

`packages/sdk/src/types.ts` :
```ts
export type FileOpenRequest = { path: string; line?: number | null; origin?: string | null };
```
ajouter `openFile(request: FileOpenRequest): void;` à `KiboSdk` et `"openFile"` à la liste de `SdkContext`.

`packages/sdk/src/sdk.ts` : ajouter `upsertExternalRef: "ticket",` à `WRITES`.

`packages/sdk/src/mock.ts` : ajouter `openedFiles: FileOpenRequest[];` au type `MockSdk`, créer `const openedFiles: FileOpenRequest[] = [];`, passer `openFile: (r) => openedFiles.push(r),` dans le contexte et renvoyer `openedFiles` dans l'objet final.

`packages/sdk/src/client.ts`, version complète :
```ts
import {
  type CodeEvent as CodeEventType,
  CodeEvent,
  type CodeRequest,
  type CodeResult,
  KiboError,
  type ProjectCommand,
  type RpcRequest,
  type RpcResponse,
  type RpcResult,
} from "@kibo/schema";
import type { ProjectBackend } from "./types";

export type KiboClient = {
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  code<R extends CodeRequest>(req: R): Promise<CodeResult[R["method"]]>;
  pair(token: string): Promise<void>;
  subscribe(listener: (projectId: string | null) => void): () => void;
  subscribeCode(listener: (event: CodeEventType) => void): () => void;
};

export type ClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  onUnauthorized?: () => void;
};

export function createClient(opts: ClientOptions): KiboClient {
  const f = opts.fetch ?? fetch;
  const listeners = new Set<(projectId: string | null) => void>();
  const codeListeners = new Set<(event: CodeEventType) => void>();
  let socket: WebSocket | null = null;
  const listening = () => listeners.size + codeListeners.size > 0;

  const post = (path: string, body: unknown) =>
    f(`${opts.baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const call = async (path: string, body: unknown): Promise<unknown> => {
    const res = await post(path, body);
    if (res.status === 401) {
      opts.onUnauthorized?.();
      throw new KiboError("UNAUTHORIZED", "pairing required");
    }
    const payload = (await res.json()) as RpcResponse;
    if (!payload.ok) throw new KiboError(payload.error.code, payload.error.message);
    return payload.result;
  };

  const dispatch = (raw: string) => {
    const data: unknown = JSON.parse(raw);
    const code = CodeEvent.safeParse(data);
    if (code.success) {
      for (const l of codeListeners) l(code.data);
      return;
    }
    const projectId =
      typeof data === "object" && data !== null && "projectId" in data && typeof data.projectId === "string"
        ? data.projectId
        : null;
    for (const l of listeners) l(projectId);
  };

  const connect = () => {
    const url = new URL("/api/events", opts.baseUrl || globalThis.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(url);
    socket.onmessage = (e) => dispatch(String(e.data));
    socket.onclose = () => {
      socket = null;
      if (listening()) setTimeout(connect, 1000);
    };
  };
  const release = () => {
    if (!listening()) socket?.close();
  };

  return {
    async rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]> {
      return (await call("/api/rpc", req)) as RpcResult[R["method"]];
    },
    async code<R extends CodeRequest>(req: R): Promise<CodeResult[R["method"]]> {
      return (await call("/api/code", req)) as CodeResult[R["method"]];
    },
    async pair(token) {
      const res = await post("/api/pair", { token });
      if (res.status !== 204) throw new KiboError("UNAUTHORIZED", "invalid pairing token");
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!socket) connect();
      return () => {
        listeners.delete(listener);
        release();
      };
    },
    subscribeCode(listener) {
      codeListeners.add(listener);
      if (!socket) connect();
      return () => {
        codeListeners.delete(listener);
        release();
      };
    },
  };
}

export function projectBackend(client: KiboClient, projectId: string): ProjectBackend {
  return {
    snapshot: () => client.rpc({ method: "getProject", projectId }),
    run: (command: ProjectCommand) => client.rpc({ method: "command", projectId, command }),
    subscribe: (listener) =>
      client.subscribe((id) => {
        if (id === projectId) listener();
      }),
  };
}
```
Les deux `as` sur le résultat sont justifiés : `RpcResult` / `CodeResult` sont le contrat de la réponse du démon, déjà utilisé ainsi au MVP. Si la phase 2 a ajouté d'autres types d'événements WebSocket, conserver leur routage et ajouter celui-ci avant le cas par défaut.

Run: `bun test packages/sdk`
Expected: PASS.

- [x] **Step 9: Textes UI de la phase**

Dans `packages/ui/src/i18n/fr.ts`, ajouter en tête du fichier `const s = (n: number) => (n > 1 ? "s" : "");`, puis :
- dans `nav` : `changes: "Changements",`, `changesCount: (n: number) => \`${n} fichier${s(n)} modifié${s(n)}\`,` et `search: "Rechercher…",` ;
- dans `ticket` : `prs: "Pull requests",` et `prState: { open: "ouverte", draft: "brouillon", merged: "fusionnée", closed: "fermée" },` et `openInTab: "Ouvrir dans un onglet",` ;
- les blocs suivants, au même niveau que `common` :
```ts
  tabs: {
    bar: "Onglets",
    home: "Accueil",
    newTab: "Nouvel onglet",
    close: (title: string) => `Fermer ${title}`,
    pin: "Épingler l'onglet",
    unpin: "Désépingler l'onglet",
    duplicate: "Dupliquer",
    newWindow: "Ouvrir dans une nouvelle fenêtre",
    closeTab: "Fermer",
    closeOthers: "Fermer les autres onglets",
    closeRight: "Fermer les onglets à droite",
    changes: "Changements",
    missingProject: "Projet introuvable",
    missingPage: "Page introuvable",
    missingTicket: "Ticket introuvable",
    dirty: "Changements non commités",
    title: (project: string, item: string) => `${project} · ${item}`,
    saveFailed: "Impossible d'enregistrer les onglets.",
    loadFailed: "Impossible de charger les onglets.",
  },
  palette: {
    label: "Palette de commandes",
    placeholder: "Rechercher un ticket, une page, un projet ou une action…",
    empty: "Aucun résultat.",
    recents: "Récents",
    tickets: "Tickets",
    pages: "Pages",
    projects: "Projets",
    actions: "Actions",
    all: "Tout",
    more: (n: number, keys: string) => `+ ${n} autre${s(n)} : ${keys}`,
    hintNavigate: "naviguer",
    hintOpen: "ouvrir",
    hintSheet: "ouvrir dans le Sheet",
    hintFilter: "filtrer par type",
    esc: "esc",
    newTicket: "Nouveau ticket",
    newSubTicket: (key: string) => `Créer un sous-ticket de ${key}`,
    newPage: "Nouvelle page",
    newProject: "Nouveau projet",
    openChanges: (project: string) => `Voir les changements de ${project}`,
    toggleTheme: "Basculer le thème (système / clair / sombre)",
    agents: "Agents",
    reply: (agent: string, key: string) => `Répondre à ${agent} (${key})`,
    assign: (key: string) => `Assigner ${key} à un agent…`,
  },
  changes: {
    title: "Changements",
    worktree: (branch: string) => `worktree ${branch}`,
    worktreePicker: "Choisir le worktree",
    detached: "HEAD détachée",
    staged: "Indexés",
    unstaged: "Non indexés",
    stageFile: (path: string) => `Indexer ${path}`,
    unstageFile: (path: string) => `Désindexer ${path}`,
    stageHunk: "Indexer le bloc",
    unstageHunk: "Désindexer le bloc",
    viewMode: "Affichage du diff",
    unified: "Unifié",
    split: "Côte à côte",
    edit: "Édition",
    openExternal: "Ouvrir dans l'éditeur externe",
    binary: "Fichier binaire : aucun diff à afficher.",
    noSelection: "Choisis un fichier pour voir ses changements.",
    clean: "Aucun changement dans ce worktree.",
    notRepo: "Ce projet n'est lié à aucun dépôt git. Renseigne son dossier pour voir ses changements.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    reload: "Recharger",
    operation: (op: string) => `${op} en cours : résous les conflits dans ton éditeur ou abandonne l'opération.`,
    operations: { rebase: "Rebase", merge: "Fusion", "cherry-pick": "Cherry-pick", revert: "Revert" },
    abortOperation: "Abandonner",
    kind: { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "A", conflicted: "U" },
    kindLabel: {
      modified: "modifié",
      added: "ajouté",
      deleted: "supprimé",
      renamed: "renommé",
      untracked: "nouveau",
      conflicted: "en conflit",
    },
  },
  commit: {
    title: "Commit",
    stagedCount: (n: number) => `${n} fichier${s(n)} indexé${s(n)}`,
    message: "Message",
    placeholder: "Message du commit",
    prefilled: "Pré-rempli depuis le ticket · 0 token",
    generate: "Générer avec Claude",
    generateSoon: "Bientôt : la génération passera par la file d'attente des agents.",
    amend: "Modifier le dernier commit (non poussé)",
    amendDisabled: "Le dernier commit est déjà poussé : il ne peut plus être modifié.",
    submit: (branch: string) => `Commit sur ${branch}`,
    submitAmend: (branch: string) => `Modifier le commit sur ${branch}`,
    nothingStaged: "Indexe au moins un fichier pour commiter.",
    unpushed: "Commits non poussés",
    modify: "Modifier",
    reword: "Reformuler",
    undo: "Annuler",
    pushed: "Poussé · ne peut plus être modifié",
    rewordTitle: "Reformuler le commit",
    rewordHelp: (sha: string) => `Seul le message de ${sha} change ; son contenu reste identique.`,
    rewordSubmit: "Reformuler",
    undoTitle: "Annuler des commits",
    undoHelp: (sha: string, newer: number) =>
      newer === 0
        ? `Le commit ${sha} est retiré de la branche : ses modifications reviennent dans l'index.`
        : `Le commit ${sha} et ${newer} commit${s(newer)} plus récent${s(newer)} sont retirés de la branche : leurs modifications reviennent dans l'index.`,
    undoSubmit: "Annuler les commits",
    push: "Pousser",
    pushing: "Poussée…",
    pushAndPr: "Pousser et créer la PR",
    viewPr: (n: number) => `Voir la PR #${n}`,
    ghUnavailable: "GitHub CLI (gh) introuvable ou non connecté.",
    noBranch: "HEAD détachée : impossible de pousser.",
    agentWorking: (agent: string) =>
      `${agent} travaille dans ce worktree. Tes modifications peuvent entrer en conflit avec les siennes.`,
  },
  pr: {
    title: "Pousser et créer la PR",
    subtitle: (branch: string, base: string, commits: number, files: number) =>
      `${branch} → ${base} · ${commits} commit${s(commits)} non poussé${s(commits)} · ${files} fichier${s(files)}`,
    prTitle: "Titre",
    description: "Description",
    base: "Branche de base",
    reviewers: "Reviewers",
    reviewersPlaceholder: "@login, @autre",
    invalidReviewer: (login: string) => `Login GitHub invalide : ${login}`,
    staged: (n: number) =>
      n > 1
        ? `${n} fichiers indexés ne sont pas commités : ils ne seront pas dans la PR.`
        : "1 fichier indexé n'est pas commité : il ne sera pas dans la PR.",
    commitFirst: "Commiter d'abord",
    draft: "Brouillon (draft)",
    link: (key: string) => `Lier la PR à ${key}`,
    submit: "Créer la PR",
    creating: "Création…",
    created: (n: number) => `PR #${n} créée`,
    review: (agent: string) => `Lancer ${agent} sur la PR`,
    rule: (key: string) => `À l'ouverture de la PR, ${key} passe en « En review » (règle du workflow).`,
  },
  file: {
    openInTab: "Ouvrir dans un onglet",
    edit: "Modifier",
    external: "Ouvrir dans l'éditeur externe",
    close: "Fermer l'aperçu",
    origin: (origin: string) => `Ouvert depuis ${origin}`,
    worktree: (branch: string) => `worktree ${branch}`,
    lines: (n: number) => `${n} ligne${s(n)}`,
    modified: (ago: string) => `modifié ${ago}`,
    uncommitted: "non commité",
    position: (line: number, col: number) => `Ligne ${line}, col ${col}`,
    hints: "⌘⇧O ouvrir dans l'éditeur externe · Esc fermer",
    binary: "Fichier binaire : aperçu indisponible.",
    tooLarge: "Fichier trop volumineux pour l'aperçu (plus de 1 Mo).",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré",
    plainText: "Texte brut",
    languageFailed: "Coloration indisponible pour ce fichier.",
  },
  time: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
  },
  errors: {
    NOT_A_REPO: "Ce dossier n'est pas un dépôt git.",
    PATH_OUTSIDE_PROJECT: "Chemin hors du projet : accès refusé.",
    GIT_FAILED: "La commande git a échoué.",
    GIT_STALE: "Le diff a changé entre-temps : il a été rechargé.",
    GIT_PUSHED: "Ce commit est déjà poussé : il ne peut plus être modifié.",
    GIT_BUSY: "Une opération git est déjà en cours dans ce worktree.",
    FILE_CHANGED: "Le fichier a changé sur le disque : recharge-le avant d'enregistrer.",
    GH_UNAVAILABLE: "GitHub CLI (gh) introuvable ou non connecté.",
    GH_FAILED: "GitHub a refusé la demande.",
    EDITOR_UNAVAILABLE: "Aucun éditeur externe autorisé n'a été trouvé.",
    INVALID_INPUT: "Requête invalide.",
    NOT_FOUND: "Élément introuvable.",
  },
```

- [x] **Step 10: `errorMessage` et `useSnapshots` (test d'abord)**

`packages/ui/src/lib/error-message.test.ts` :
```ts
import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { errorMessage } from "./error-message";

test("known codes map to French text, git failures keep the first line of stderr", () => {
  expect(errorMessage(new KiboError("GIT_PUSHED", "abc"))).toBe("Ce commit est déjà poussé : il ne peut plus être modifié.");
  expect(errorMessage(new KiboError("GIT_FAILED", "fatal: bad revision\nmore"))).toBe(
    "La commande git a échoué. (fatal: bad revision)",
  );
  expect(errorMessage(new KiboError("INTERNAL", "x"))).toBe("Une erreur est survenue.");
  expect(errorMessage(new Error("boom"))).toBe("Une erreur est survenue.");
});
```

`packages/ui/src/lib/error-message.ts` :
```ts
import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";

const KNOWN: Partial<Record<KiboErrorCode, string>> = fr.errors;
const WITH_DETAIL = new Set<KiboErrorCode>(["GIT_FAILED", "GH_FAILED"]);

export function errorMessage(e: unknown): string {
  if (!(e instanceof KiboError)) return fr.common.error;
  const text = KNOWN[e.code] ?? fr.common.error;
  const detail = e.detail.split("\n")[0]?.trim().slice(0, 200) ?? "";
  return WITH_DETAIL.has(e.code) && detail ? `${text} (${detail})` : text;
}
```

`packages/ui/src/state/use-snapshots.test.tsx` :
```ts
import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";

const snapshot = (id: string): ProjectSnapshot => ({
  meta: { id, name: id, key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  nextTicketKey: "KIB-1",
});
const requested: string[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getProject") requested.push(req.projectId);
      return req.method === "getProject" ? Promise.resolve(snapshot(req.projectId)) : Promise.resolve(null);
    },
    subscribe: () => () => {},
  },
}));
const { useSnapshots } = await import("./use-snapshots");

test("loads each distinct project once", async () => {
  const { result } = renderHook(() => useSnapshots(["a", "b", "a"]));
  await waitFor(() => expect(result.current.size).toBe(2));
  expect(result.current.get("b")?.meta.name).toBe("b");
  expect(requested.sort()).toEqual(["a", "b"]);
});
```

`packages/ui/src/state/use-snapshots.ts` :
```ts
import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useMemo, useState } from "react";
import { client } from "../api";

export function useSnapshots(projectIds: string[]): Map<string, ProjectSnapshot> {
  const key = useMemo(() => [...new Set(projectIds)].sort().join("\n"), [projectIds]);
  const [snapshots, setSnapshots] = useState<Map<string, ProjectSnapshot>>(new Map());
  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    let alive = true;
    const load = (id: string) =>
      client.rpc({ method: "getProject", projectId: id }).then(
        (s) => alive && setSnapshots((prev) => new Map(prev).set(id, s)),
        (e: unknown) => {
          if (e instanceof KiboError && (e.code === "NOT_FOUND" || e.code === "UNAUTHORIZED")) {
            if (alive) setSnapshots((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            return;
          }
          throw e;
        },
      );
    for (const id of ids) void load(id);
    const off = client.subscribe((changed) => {
      if (changed !== null && ids.includes(changed)) void load(changed);
    });
    return () => {
      alive = false;
      off();
    };
  }, [key]);
  return snapshots;
}
```

Run: `bun test packages/ui/src/lib packages/ui/src/state`
Expected: PASS.

- [x] **Step 11: Hôte et page : `openFile`**

`packages/ui/src/shell/Host.tsx` : importer `type FileRef` depuis `@kibo/schema` et étendre
```ts
export type Host = {
  openTicket(id: string): void;
  openNewTicket(d: NewTicketDefaults): void;
  openFile(ref: FileRef): void;
};
```

`packages/ui/src/shell/Shell.tsx` : ajouter `const [, setFileRef] = useState<FileRef | null>(null);` et passer `openFile: setFileRef` dans l'objet `host` (la tâche 20 affiche l'aperçu).

`packages/ui/src/pages/PageView.tsx` : dans le contexte du SDK, ajouter
```ts
        openFile: (r) =>
          host.openFile({ projectId, worktree: null, path: r.path, line: r.line ?? null, origin: r.origin ?? null }),
```

- [x] **Step 12: Vérifier et commiter**

Run: `bun test && bun run check && bun run typecheck`
Expected: tout vert.

```bash
git add packages/schema/src packages/core/src/tickets.ts packages/core/src/commands.ts packages/core/src/tickets.test.ts packages/sdk/src/types.ts packages/sdk/src/sdk.ts packages/sdk/src/mock.ts packages/sdk/src/client.ts packages/sdk/src/client.test.ts packages/sdk/src/sdk.test.ts packages/ui/src/i18n/fr.ts packages/ui/src/lib/error-message.ts packages/ui/src/lib/error-message.test.ts packages/ui/src/state/use-snapshots.ts packages/ui/src/state/use-snapshots.test.tsx packages/ui/src/shell/Host.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/pages/PageView.tsx components/tickets/src/build-tree.test.ts components/kanban/src/filter.test.ts
git commit -m "feat(schema): contrats du code et des onglets"
```

---

### Task 2: Dépendances et primitives shadcn

**Files:**
- Create: `packages/sdk/src/ui/context-menu.tsx`, `packages/sdk/src/ui/command.tsx`, `packages/sdk/src/ui/toggle.tsx`, `packages/sdk/src/ui/toggle-group.tsx`, `packages/sdk/src/ui/checkbox.tsx`, `packages/sdk/src/ui/alert-dialog.tsx`, `packages/sdk/src/primitives.test.tsx`
- Modify: `packages/sdk/package.json`, `packages/ui/package.json`, `bun.lock`

**Interfaces:**
- Consumes: configuration shadcn de `packages/ui/components.json` (alias `ui` → `@kibo/sdk/ui`).
- Produces : `@kibo/sdk/ui/context-menu` (`ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuShortcut`), `@kibo/sdk/ui/command` (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`), `@kibo/sdk/ui/toggle-group` (`ToggleGroup`, `ToggleGroupItem`), `@kibo/sdk/ui/checkbox` (`Checkbox`), `@kibo/sdk/ui/alert-dialog` (`AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`). Paquets installés pour les tâches UI : `cmdk`, `codemirror`, `@codemirror/*`, `shiki`, `@shikijs/*`, `@dnd-kit/*`.

Justification des dépendances (à reprendre dans le plan, pas dans le commit) : `cmdk` est la base de `Command` shadcn (palette) ; CodeMirror 6 est imposé par la spec (§7), `@codemirror/merge` fournit l'édition dans le diff, `@codemirror/language-data` charge les langages à la demande ; Shiki est imposé par la spec (aperçu), avec `@shikijs/langs` et `@shikijs/themes` pour n'embarquer que les langages utiles et le moteur JavaScript (pas de WebAssembly, compatible avec la CSP `script-src 'self'`) ; `@dnd-kit/sortable` réordonne les onglets avec la même bibliothèque que le Kanban. Aucun de ces paquets n'a de script `postinstall`.

- [x] **Step 1: Test de fumée des primitives**

`packages/sdk/src/primitives.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogTitle } from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";
import { Command, CommandInput, CommandItem, CommandList } from "./ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "./ui/context-menu";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

test("the new shadcn primitives render and are accessible", async () => {
  render(
    <>
      <Checkbox aria-label="Indexer" />
      <ToggleGroup type="single" defaultValue="unified" aria-label="Affichage">
        <ToggleGroupItem value="unified">Unifié</ToggleGroupItem>
        <ToggleGroupItem value="split">Côte à côte</ToggleGroupItem>
      </ToggleGroup>
      <Command label="Palette">
        <CommandInput placeholder="Rechercher" />
        <CommandList>
          <CommandItem>KIB-12</CommandItem>
        </CommandList>
      </Command>
      <ContextMenu>
        <ContextMenuTrigger>Onglet</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Dupliquer</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Annuler des commits</AlertDialogTitle>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>,
  );
  expect(screen.getByRole("checkbox", { name: "Indexer" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Unifié" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("option", { name: "KIB-12" })).toBeTruthy();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  await userEvent.click(screen.getByRole("checkbox", { name: "Indexer" }));
  expect(screen.getByRole("checkbox", { name: "Indexer" }).getAttribute("aria-checked")).toBe("true");
});
```

Run: `bun test packages/sdk/src/primitives.test.tsx`
Expected: FAIL, modules `./ui/*` introuvables.

- [x] **Step 2: Générer les primitives**

Run: `cd packages/ui && bunx shadcn@4.21.0 add context-menu command toggle toggle-group checkbox alert-dialog`
Expected: six fichiers créés dans `packages/sdk/src/ui/` (alias de `components.json`). Si la CLI installe `cmdk` dans `packages/ui`, le retirer (`bun remove --cwd packages/ui cmdk`) : il appartient au SDK.

- [x] **Step 3: Installer les dépendances exactes**

Run :
```bash
bun add --cwd packages/sdk cmdk@1.1.1
bun add --cwd packages/ui codemirror@6.0.2 @codemirror/state@6.7.6 @codemirror/view@6.43.13 @codemirror/language@6.12.4 @codemirror/language-data@6.5.2 @codemirror/merge@6.12.2 shiki@4.4.3 @shikijs/langs@4.4.3 @shikijs/themes@4.4.3 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2
```
Vérifier qu'aucun paquet ajouté n'exécute de script : `bun pm untrusted` ne liste rien de nouveau.

- [x] **Step 4: Vérifier**

Run: `bun test packages/sdk && bun run check && bun run typecheck && bun run --cwd packages/ui build`
Expected: PASS ; le build Vite réussit (les primitives sont exclues de Biome par `biome.json`).

- [x] **Step 5: Commit**

```bash
git add packages/sdk/src/ui/context-menu.tsx packages/sdk/src/ui/command.tsx packages/sdk/src/ui/toggle.tsx packages/sdk/src/ui/toggle-group.tsx packages/sdk/src/ui/checkbox.tsx packages/sdk/src/ui/alert-dialog.tsx packages/sdk/src/primitives.test.tsx packages/sdk/package.json packages/ui/package.json bun.lock
git commit -m "build: primitives shadcn et dépendances code"
```

---

### Task 3: Exécuteur git/gh, chemins sûrs et dépôts de test

**Files:**
- Create: `packages/daemon/src/code/run.ts`, `packages/daemon/src/code/run.test.ts`, `packages/daemon/src/code/safe-path.ts`, `packages/daemon/src/code/safe-path.test.ts`, `packages/daemon/src/code/testing/git-fixture.ts`, `packages/daemon/src/code/testing/fake-gh.ts`, `packages/daemon/src/code/testing/fixture.test.ts`

**Interfaces:**
- Consumes: `KiboError` (tâche 1).
- Produces :
  - `type Env = Record<string, string>` ; `type RunResult = { code: number; stdout: string; bytes: Uint8Array; stderr: string }` ;
  - `run(cmd: string[], opts: { cwd: string; stdin?: string; env?: Env; timeoutMs?: number; failCode?: "GIT_FAILED" | "GH_UNAVAILABLE" }): Promise<RunResult>` ;
  - `type Git = { root: string; env: Env; run(args: string[], opts?: GitRunOptions): Promise<RunResult>; ok(args: string[], opts?: GitRunOptions): Promise<string> }` avec `GitRunOptions = { stdin?: string; env?: Env; timeoutMs?: number }` ; `createGit(root: string, env?: Env): Git` ;
  - `runGh(args: string[], opts: { cwd: string; env: Env; stdin?: string }): Promise<RunResult>` ;
  - `firstLine(text: string): string` ; constantes `READ_TIMEOUT_MS = 30_000`, `WRITE_TIMEOUT_MS = 300_000`, `NETWORK_TIMEOUT_MS = 120_000` ;
  - `isInside(root: string, target: string): boolean`, `resolveInWorktree(root: string, relPath: string): string`, `assertNotSymlink(abs: string): void` ;
  - fixtures : `createGitFixture(opts?: { remote?: boolean }): GitFixture` avec `GitFixture = { dir; repo; remote; env: Env; git(...args: string[]): string; write(path: string, content: string): void; commit(message: string, files: Record<string, string>): string; cleanup(): void }`, `installFakeGh(dir: string): Env` (clés `KIBO_GH`, `FAKE_GH_STATE`, `FAKE_GH_LOG`), `readFakeGhLog(env: Env): { args: string[]; stdin: string }[]`, `installFakeBin(dir: string, name: string): { path: string; log: string }`, `readFakeBinLog(log: string): string[][]`.

- [x] **Step 1: Tests de l'exécuteur**

`packages/daemon/src/code/run.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createGit, firstLine, run } from "./run";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture({ remote: false });
});
afterEach(() => fx.cleanup());

test("run returns code, stdout and stderr without a shell", async () => {
  const r = await run(["git", "rev-parse", "--is-inside-work-tree"], { cwd: fx.repo, env: fx.env });
  expect(r).toMatchObject({ code: 0, stdout: "true\n" });
  const bad = await run(["git", "rev-parse", "$(echo pwned)"], { cwd: fx.repo, env: fx.env });
  expect(bad.code).not.toBe(0);
  expect(bad.stderr).toContain("$(echo pwned)");
});

test("stdin is passed to the process", async () => {
  const git = createGit(fx.repo, fx.env);
  const sha = await git.ok(["hash-object", "--stdin"], { stdin: "hello\n" });
  expect(sha.trim()).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
});

test("ok throws GIT_FAILED with the first stderr line", async () => {
  const git = createGit(fx.repo, fx.env);
  await expect(git.ok(["rev-parse", "--verify", "nope"])).rejects.toMatchObject({ code: "GIT_FAILED" });
});

test("a missing binary and a timeout are reported", async () => {
  await expect(run(["kibo-no-such-binary"], { cwd: fx.repo })).rejects.toMatchObject({ code: "GIT_FAILED" });
  await expect(
    run(["kibo-no-such-binary"], { cwd: fx.repo, failCode: "GH_UNAVAILABLE" }),
  ).rejects.toMatchObject({ code: "GH_UNAVAILABLE" });
  await expect(run(["sleep", "5"], { cwd: fx.repo, timeoutMs: 100 })).rejects.toMatchObject({ code: "GIT_FAILED" });
});

test("firstLine trims and keeps one line", () => {
  expect(firstLine("  fatal: x\nhint: y")).toBe("fatal: x");
});
```

`packages/daemon/src/code/safe-path.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertNotSymlink, isInside, resolveInWorktree } from "./safe-path";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture({ remote: false });
  fx.write("src/a.ts", "a\n");
});
afterEach(() => fx.cleanup());

test("isInside compares path segments, not prefixes", () => {
  expect(isInside("/a/repo", "/a/repo/x")).toBe(true);
  expect(isInside("/a/repo", "/a/repo")).toBe(true);
  expect(isInside("/a/repo", "/a/repo-evil/x")).toBe(false);
  expect(isInside("/a/repo", "/a")).toBe(false);
});

test("relative paths inside the worktree resolve, including new nested ones", () => {
  expect(resolveInWorktree(fx.repo, "src/a.ts")).toBe(join(fx.repo, "src/a.ts"));
  expect(resolveInWorktree(fx.repo, "src/new/b.ts")).toBe(join(fx.repo, "src/new/b.ts"));
});

test("traversal, absolute paths and .git are refused", () => {
  for (const p of ["../x", "src/../../x", "/etc/passwd", ".git/config", ".GIT/HEAD", "a\0b"]) {
    expect(() => resolveInWorktree(fx.repo, p)).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" }));
  }
});

test("a symlink leading outside is refused, one staying inside is allowed", () => {
  const outside = join(fx.dir, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret"), "s");
  symlinkSync(outside, join(fx.repo, "escape"));
  symlinkSync(join(fx.repo, "src"), join(fx.repo, "alias"));
  expect(() => resolveInWorktree(fx.repo, "escape/secret")).toThrow(
    expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" }),
  );
  expect(resolveInWorktree(fx.repo, "alias/a.ts")).toBe(join(fx.repo, "alias/a.ts"));
  expect(() => assertNotSymlink(join(fx.repo, "alias"))).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" }));
  expect(() => assertNotSymlink(join(fx.repo, "src/a.ts"))).not.toThrow();
});
```

`packages/daemon/src/code/testing/fixture.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createGitFixture, type GitFixture, installFakeBin, installFakeGh, readFakeBinLog, readFakeGhLog } from "./git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture();
});
afterEach(() => fx.cleanup());

test("the fixture has an isolated identity and a bare remote", () => {
  const sha = fx.commit("chore: init", { "README.md": "# test\n" });
  expect(sha).toMatch(/^[0-9a-f]{40}$/);
  expect(fx.git("log", "-1", "--format=%an <%ae>").trim()).toBe("Adam <adam@example.test>");
  fx.git("push", "-q", "origin", "main");
  expect(fx.git("ls-remote", "origin").trim()).toContain("refs/heads/main");
});

test("the fake gh records calls and creates numbered PRs", async () => {
  const env = installFakeGh(fx.dir);
  const gh = env.KIBO_GH ?? "";
  const create = Bun.spawnSync([gh, "pr", "create", "--head=kib-12", "--body-file", "-"], {
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode("corps"),
  });
  expect(create.stdout.toString().trim()).toBe("https://github.com/kibo/test/pull/1");
  const view = Bun.spawnSync([gh, "pr", "view", "kib-12", "--json", "number,url,state,isDraft"], {
    env: { ...process.env, ...env },
  });
  expect(JSON.parse(view.stdout.toString())).toMatchObject({ number: 1, state: "OPEN" });
  expect(readFakeGhLog(env)[0]).toEqual({ args: ["pr", "create", "--head=kib-12", "--body-file", "-"], stdin: "corps" });
});

test("a fake binary logs its arguments", () => {
  const bin = installFakeBin(fx.dir, "code");
  Bun.spawnSync([bin.path, "--goto", "a.ts:3"], { env: { ...process.env, FAKE_BIN_LOG: bin.log } });
  expect(readFakeBinLog(bin.log)).toEqual([["--goto", "a.ts:3"]]);
});
```

- [x] **Step 2: Lancer les tests pour les voir échouer**

Run: `bun test packages/daemon/src/code`
Expected: FAIL, modules introuvables.

- [x] **Step 3: Implémenter l'exécuteur**

`packages/daemon/src/code/run.ts` :
```ts
import { KiboError } from "@kibo/schema";

export type Env = Record<string, string>;
export type RunResult = { code: number; stdout: string; bytes: Uint8Array; stderr: string };
export type RunOptions = {
  cwd: string;
  stdin?: string;
  env?: Env;
  timeoutMs?: number;
  failCode?: "GIT_FAILED" | "GH_UNAVAILABLE";
};
export type GitRunOptions = { stdin?: string; env?: Env; timeoutMs?: number };
export type Git = {
  root: string;
  env: Env;
  run(args: string[], opts?: GitRunOptions): Promise<RunResult>;
  ok(args: string[], opts?: GitRunOptions): Promise<string>;
};

export const READ_TIMEOUT_MS = 30_000;
export const WRITE_TIMEOUT_MS = 300_000;
export const NETWORK_TIMEOUT_MS = 120_000;

const BASE_ENV: Env = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_EDITOR: "true",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  GH_PROMPT_DISABLED: "1",
  NO_COLOR: "1",
};

export function firstLine(text: string): string {
  return text.trim().split("\n")[0]?.trim() ?? "";
}

function spawn(cmd: string[], opts: RunOptions) {
  return Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...BASE_ENV, ...opts.env },
    stdin: opts.stdin === undefined ? "ignore" : new TextEncoder().encode(opts.stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
}

export async function run(cmd: string[], opts: RunOptions): Promise<RunResult> {
  const failCode = opts.failCode ?? "GIT_FAILED";
  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn(cmd, opts);
  } catch (e) {
    throw new KiboError(failCode, `cannot start ${cmd[0]}: ${String(e)}`);
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGKILL");
  }, opts.timeoutMs ?? READ_TIMEOUT_MS);
  const [buffer, stderr, code] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  if (timedOut) throw new KiboError(failCode, `${cmd[0]} ${cmd[1] ?? ""} timed out`);
  const bytes = new Uint8Array(buffer);
  return { code, stdout: new TextDecoder().decode(bytes), bytes, stderr };
}

export function createGit(root: string, env: Env = {}): Git {
  const binary = env.KIBO_GIT ?? process.env.KIBO_GIT ?? "git";
  const exec = (args: string[], opts: GitRunOptions = {}) =>
    run([binary, ...args], { cwd: root, env: { ...env, ...opts.env }, stdin: opts.stdin, timeoutMs: opts.timeoutMs });
  return {
    root,
    env,
    run: exec,
    async ok(args, opts) {
      const r = await exec(args, opts);
      if (r.code !== 0) throw new KiboError("GIT_FAILED", `git ${args[0]}: ${firstLine(r.stderr) || `exit ${r.code}`}`);
      return r.stdout;
    },
  };
}

export function runGh(args: string[], opts: { cwd: string; env: Env; stdin?: string }): Promise<RunResult> {
  const binary = opts.env.KIBO_GH ?? process.env.KIBO_GH ?? "gh";
  return run([binary, ...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdin: opts.stdin,
    timeoutMs: NETWORK_TIMEOUT_MS,
    failCode: "GH_UNAVAILABLE",
  });
}
```

`packages/daemon/src/code/safe-path.ts` :
```ts
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { KiboError } from "@kibo/schema";

const refuse = (detail: string) => new KiboError("PATH_OUTSIDE_PROJECT", detail);

export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function nearestExisting(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

export function resolveInWorktree(root: string, relPath: string): string {
  if (relPath.includes("\0") || isAbsolute(relPath)) throw refuse(`${relPath} is not a relative path`);
  const segments = relPath.split(/[\\/]/);
  if (segments.includes("..")) throw refuse(`${relPath} leaves the worktree`);
  if (segments[0]?.toLowerCase() === ".git") throw refuse(`${relPath} is inside .git`);
  const realRoot = realpathSync(root);
  const abs = resolve(realRoot, relPath);
  if (!isInside(realRoot, abs)) throw refuse(`${relPath} leaves the worktree`);
  if (!isInside(realRoot, realpathSync(nearestExisting(abs)))) throw refuse(`${relPath} resolves outside the worktree`);
  return abs;
}

export function assertNotSymlink(abs: string): void {
  if (existsSync(abs) && lstatSync(abs).isSymbolicLink()) throw refuse(`${abs} is a symbolic link`);
}
```

- [x] **Step 4: Implémenter les fixtures**

`packages/daemon/src/code/testing/git-fixture.ts` :
```ts
import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Env } from "../run";

export type GitFixture = {
  dir: string;
  repo: string;
  remote: string;
  env: Env;
  git(...args: string[]): string;
  write(path: string, content: string): void;
  commit(message: string, files: Record<string, string>): string;
  cleanup(): void;
};

export function gitSync(cwd: string, args: string[], env: Env): string {
  const r = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...env } });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString()}`);
  return r.stdout.toString();
}

export function createGitFixture(opts: { remote?: boolean } = {}): GitFixture {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-git-")));
  const home = join(dir, "home");
  mkdirSync(home);
  const env: Env = {
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Adam",
    GIT_AUTHOR_EMAIL: "adam@example.test",
    GIT_COMMITTER_NAME: "Adam",
    GIT_COMMITTER_EMAIL: "adam@example.test",
  };
  const repo = join(dir, "repo");
  mkdirSync(repo);
  const git = (...args: string[]) => gitSync(repo, args, env);
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  const remote = join(dir, "remote.git");
  if (opts.remote !== false) {
    gitSync(dir, ["init", "-q", "--bare", "-b", "main", remote], env);
    git("remote", "add", "origin", remote);
  }
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  return {
    dir,
    repo,
    remote,
    env,
    git,
    write,
    commit(message, files) {
      for (const [path, content] of Object.entries(files)) write(path, content);
      git("add", "-A");
      git("commit", "-q", "-m", message);
      return git("rev-parse", "HEAD").trim();
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function installFakeGh(dir: string): Env {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const path = join(bin, "gh");
  copyFileSync(join(import.meta.dir, "fake-gh.ts"), path);
  chmodSync(path, 0o755);
  return { KIBO_GH: path, FAKE_GH_STATE: join(dir, "gh-state.json"), FAKE_GH_LOG: join(dir, "gh-log.jsonl") };
}

export function readFakeGhLog(env: Env): { args: string[]; stdin: string }[] {
  const log = env.FAKE_GH_LOG;
  if (!log || !existsSync(log)) return [];
  return readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { args: string[]; stdin: string });
}

export function installFakeBin(dir: string, name: string): { path: string; log: string } {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const path = join(bin, name);
  const log = join(dir, `${name}.log`);
  writeFileSync(
    path,
    '#!/usr/bin/env bun\nimport { appendFileSync } from "node:fs";\nappendFileSync(process.env.FAKE_BIN_LOG ?? "/dev/null", `${JSON.stringify(process.argv.slice(2))}\\n`);\n',
  );
  chmodSync(path, 0o755);
  appendFileSync(log, "");
  return { path, log };
}

export function readFakeBinLog(log: string): string[][] {
  return readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}
```
(Les `as` sur `JSON.parse` sont limités aux journaux écrits par les faux binaires de test.)

`packages/daemon/src/code/testing/fake-gh.ts` :
```ts
#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

type FakePr = { number: number; url: string; state: "OPEN" | "MERGED" | "CLOSED"; isDraft: boolean; head: string };

const statePath = process.env.FAKE_GH_STATE;
const logPath = process.env.FAKE_GH_LOG;
if (!statePath || !logPath) {
  process.stderr.write("FAKE_GH_STATE and FAKE_GH_LOG are required\n");
  process.exit(2);
}
const args = process.argv.slice(2);
const stdin = args.includes("--body-file") ? await Bun.stdin.text() : "";
appendFileSync(logPath, `${JSON.stringify({ args, stdin })}\n`);
const prs: FakePr[] = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : [];
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

if (process.env.FAKE_GH_FAIL === "1") {
  process.stderr.write("fake gh failure\n");
  process.exit(1);
}
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("Logged in to github.com as adam\n");
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "create") {
  const number = prs.length + 1;
  const url = `https://github.com/kibo/test/pull/${number}`;
  prs.push({ number, url, state: "OPEN", isDraft: args.includes("--draft"), head: flag("head") ?? "" });
  writeFileSync(statePath, JSON.stringify(prs));
  process.stdout.write(`${url}\n`);
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "view") {
  const pr = prs.find((p) => p.url === args[2] || p.head === args[2]);
  if (!pr) {
    process.stderr.write("no pull requests found for branch\n");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ number: pr.number, url: pr.url, state: pr.state, isDraft: pr.isDraft }));
  process.exit(0);
}
process.stderr.write(`unsupported: ${args.join(" ")}\n`);
process.exit(1);
```

- [x] **Step 5: Lancer les tests**

Run: `bun test packages/daemon/src/code`
Expected: PASS (sur macOS, `realpathSync` de `mkdtemp` résout `/var` → `/private/var` : les fixtures l'appliquent déjà).

- [x] **Step 6: Commit**

```bash
git add packages/daemon/src/code/run.ts packages/daemon/src/code/run.test.ts packages/daemon/src/code/safe-path.ts packages/daemon/src/code/safe-path.test.ts packages/daemon/src/code/testing
git commit -m "feat(daemon): exécuteur git et chemins sûrs"
```

---

### Task 4: Parseurs git purs

**Files:**
- Create: `packages/daemon/src/code/parse-status.ts`, `packages/daemon/src/code/parse-diff.ts`, `packages/daemon/src/code/parse-log.ts`, `packages/daemon/src/code/patch.ts`, `packages/daemon/src/code/parse.test.ts`

**Interfaces:**
- Consumes: types `ChangeKind`, `Worktree`, `CommitInfo`, `FileDiff`, `Hunk` (tâche 1).
- Produces :
  - `type StatusEntry = { path: string; origPath: string | null; staged: ChangeKind | null; unstaged: ChangeKind | null }` ; `type ParsedStatus = { head: string | null; branch: string | null; upstream: string | null; ahead: number; behind: number; entries: StatusEntry[] }` ; `parseStatus(raw: string): ParsedStatus` (sortie de `status --porcelain=v2 -z --branch`) ;
  - `type LineCounts = { additions: number | null; deletions: number | null }` ; `parseNumstat(raw: string): Map<string, LineCounts>` (sortie de `diff --numstat -z`) ;
  - `parseWorktrees(raw: string): Worktree[]` (sortie de `worktree list --porcelain -z`) ;
  - `parseDiff(raw: string, path: string, origPath: string | null): FileDiff` ;
  - `LOG_FORMAT: string`, `parseLog(raw: string, isPushed: (sha: string) => boolean): CommitInfo[]` ;
  - `hunkPatch(diff: FileDiff, index: number): string`.

- [x] **Step 1: Tests**

`packages/daemon/src/code/parse.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { parseDiff } from "./parse-diff";
import { LOG_FORMAT, parseLog } from "./parse-log";
import { parseNumstat, parseStatus, parseWorktrees } from "./parse-status";
import { hunkPatch } from "./patch";

describe("parseStatus", () => {
  test("branch headers, ordinary, renamed, unmerged and untracked entries", () => {
    const raw = [
      "# branch.oid 1111111111111111111111111111111111111111",
      "# branch.head kib-12",
      "# branch.upstream origin/kib-12",
      "# branch.ab +2 -1",
      "1 M. N... 100644 100644 100644 aaa bbb packages/core/ticket.ts",
      "1 .M N... 100644 100644 100644 aaa aaa packages/core/index.ts",
      "1 MM N... 100644 100644 100644 aaa bbb both.ts",
      "1 .D N... 100644 100644 000000 aaa aaa packages/core/legacy-tree.ts",
      "2 R. N... 100644 100644 100644 aaa aaa R100 new name.ts",
      "old name.ts",
      "u UU N... 100644 100644 100644 100644 a b c conflict.ts",
      "? packages/core/tree.ts",
      "",
    ].join("\0");
    const s = parseStatus(raw);
    expect(s).toMatchObject({ head: "1111111111111111111111111111111111111111", branch: "kib-12", upstream: "origin/kib-12", ahead: 2, behind: 1 });
    expect(s.entries).toEqual([
      { path: "packages/core/ticket.ts", origPath: null, staged: "modified", unstaged: null },
      { path: "packages/core/index.ts", origPath: null, staged: null, unstaged: "modified" },
      { path: "both.ts", origPath: null, staged: "modified", unstaged: "modified" },
      { path: "packages/core/legacy-tree.ts", origPath: null, staged: null, unstaged: "deleted" },
      { path: "new name.ts", origPath: "old name.ts", staged: "renamed", unstaged: null },
      { path: "conflict.ts", origPath: null, staged: null, unstaged: "conflicted" },
      { path: "packages/core/tree.ts", origPath: null, staged: null, unstaged: "untracked" },
    ]);
  });

  test("initial commit and detached head", () => {
    expect(parseStatus("# branch.oid (initial)\0# branch.head main\0")).toMatchObject({ head: null, branch: "main" });
    expect(parseStatus("# branch.oid abc\0# branch.head (detached)\0")).toMatchObject({ branch: null });
  });
});

test("parseNumstat handles binaries and renames", () => {
  const raw = "42\t8\tpackages/core/ticket.ts\0-\t-\tlogo.png\0" + "3\t1\t\0old.ts\0new.ts\0";
  const counts = parseNumstat(raw);
  expect(counts.get("packages/core/ticket.ts")).toEqual({ additions: 42, deletions: 8 });
  expect(counts.get("logo.png")).toEqual({ additions: null, deletions: null });
  expect(counts.get("new.ts")).toEqual({ additions: 3, deletions: 1 });
});

test("parseWorktrees marks the first as main and skips bare entries", () => {
  const raw = [
    "worktree /repo", "HEAD 1111111111111111111111111111111111111111", "branch refs/heads/main", "",
    "worktree /wt/kib-12", "HEAD 2222222222222222222222222222222222222222", "branch refs/heads/kib-12", "",
    "worktree /wt/detached", "HEAD 3333333333333333333333333333333333333333", "detached", "", "",
  ].join("\0");
  expect(parseWorktrees(raw)).toEqual([
    { path: "/repo", head: "1111111111111111111111111111111111111111", branch: "main", isMain: true },
    { path: "/wt/kib-12", head: "2222222222222222222222222222222222222222", branch: "kib-12", isMain: false },
    { path: "/wt/detached", head: "3333333333333333333333333333333333333333", branch: null, isMain: false },
  ]);
  expect(parseWorktrees("worktree /bare\0bare\0\0")).toEqual([]);
});

const DIFF = [
  "diff --git a/src/ticket.ts b/src/ticket.ts",
  "index 1111111..2222222 100644",
  "--- a/src/ticket.ts",
  "+++ b/src/ticket.ts",
  "@@ -38,3 +38,4 @@ export const TicketSchema",
  " export const TicketSchema = z.object({",
  "-  parentId: z.string().nullable(),",
  "+  key: z.string(),",
  "+  statusId: z.string(),",
  " });",
  "@@ -50 +51 @@ export function toIndexRow",
  "-  return 1",
  "\\ No newline at end of file",
  "+  return 2",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("parseDiff", () => {
  test("hunks, line numbers, counts and missing final newline", () => {
    const d = parseDiff(DIFF, "src/ticket.ts", null);
    expect(d).toMatchObject({ binary: false, hunkStaging: true, additions: 3, deletions: 2 });
    expect(d.hunks).toHaveLength(2);
    expect(d.hunks[0]).toMatchObject({ oldStart: 38, oldLines: 3, newStart: 38, newLines: 4, section: "export const TicketSchema" });
    expect(d.hunks[0]?.lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 38, 38],
      ["del", 39, null],
      ["add", null, 39],
      ["add", null, 40],
      ["context", 40, 41],
    ]);
    expect(d.hunks[1]).toMatchObject({ oldLines: 1, newLines: 1 });
    expect(d.hunks[1]?.lines.map((l) => l.noEol)).toEqual([true, true]);
  });

  test("binary, new, deleted and renamed files disable hunk staging", () => {
    expect(parseDiff("diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n", "x.png", null)).toMatchObject({
      binary: true,
      hunkStaging: false,
      hunks: [],
    });
    expect(parseDiff("diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n", "n", null)).toMatchObject({
      hunkStaging: false,
      additions: 1,
    });
    expect(parseDiff("diff --git a/o b/n\nsimilarity index 90%\nrename from o\nrename to n\n", "n", "o").hunkStaging).toBe(false);
  });
});

test("hunkPatch rebuilds a patch git apply accepts", () => {
  const d = parseDiff(DIFF, "src/ticket.ts", null);
  expect(hunkPatch(d, 1)).toBe(
    [
      "diff --git a/src/ticket.ts b/src/ticket.ts",
      "--- a/src/ticket.ts",
      "+++ b/src/ticket.ts",
      "@@ -50 +51 @@ export function toIndexRow",
      "-  return 1",
      "\\ No newline at end of file",
      "+  return 2",
      "\\ No newline at end of file",
      "",
    ].join("\n"),
  );
  expect(() => hunkPatch(d, 5)).toThrow(expect.objectContaining({ code: "GIT_STALE" }));
});

test("parseLog reads the NUL separated format", () => {
  expect(LOG_FORMAT).toBe("%H%x00%h%x00%s%x00%b%x00%an%x00%at%x1e");
  const raw = `${"a".repeat(40)}\0aaaaaaa\0feat: x\0- body\n\0Adam\x001700000000\x1e\n${"b".repeat(40)}\0bbbbbbb\0chore: y\0\0Adam\x001690000000\x1e\n`;
  const commits = parseLog(raw, (sha) => sha.startsWith("b"));
  expect(commits).toEqual([
    { sha: "a".repeat(40), shortSha: "aaaaaaa", subject: "feat: x", body: "- body", author: "Adam", time: 1_700_000_000_000, pushed: false },
    { sha: "b".repeat(40), shortSha: "bbbbbbb", subject: "chore: y", body: "", author: "Adam", time: 1_690_000_000_000, pushed: true },
  ]);
});
```

Run: `bun test packages/daemon/src/code/parse.test.ts`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter les parseurs**

`packages/daemon/src/code/parse-status.ts` :
```ts
import type { ChangeKind, Worktree } from "@kibo/schema";

export type StatusEntry = { path: string; origPath: string | null; staged: ChangeKind | null; unstaged: ChangeKind | null };
export type ParsedStatus = {
  head: string | null;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
};
export type LineCounts = { additions: number | null; deletions: number | null };

const KIND: Record<string, ChangeKind> = { M: "modified", T: "modified", A: "added", D: "deleted", R: "renamed", C: "added" };

const kindOf = (code: string | undefined): ChangeKind | null => (code ? (KIND[code] ?? null) : null);

function readHeader(out: ParsedStatus, record: string): void {
  const [, key, ...rest] = record.split(" ");
  const value = rest.join(" ");
  if (key === "branch.oid") out.head = value === "(initial)" ? null : value;
  if (key === "branch.head") out.branch = value === "(detached)" ? null : value;
  if (key === "branch.upstream") out.upstream = value;
  if (key === "branch.ab") {
    const m = /^\+(\d+) -(\d+)$/.exec(value);
    out.ahead = Number(m?.[1] ?? 0);
    out.behind = Number(m?.[2] ?? 0);
  }
}

export function parseStatus(raw: string): ParsedStatus {
  const out: ParsedStatus = { head: null, branch: null, upstream: null, ahead: 0, behind: 0, entries: [] };
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const fields = record.split(" ");
    const xy = fields[1] ?? "..";
    if (record.startsWith("# ")) readHeader(out, record);
    else if (record[0] === "1")
      out.entries.push({ path: fields.slice(8).join(" "), origPath: null, staged: kindOf(xy[0]), unstaged: kindOf(xy[1]) });
    else if (record[0] === "2") {
      i += 1;
      out.entries.push({ path: fields.slice(9).join(" "), origPath: records[i] ?? null, staged: kindOf(xy[0]), unstaged: kindOf(xy[1]) });
    } else if (record[0] === "u")
      out.entries.push({ path: fields.slice(10).join(" "), origPath: null, staged: null, unstaged: "conflicted" });
    else if (record[0] === "?") out.entries.push({ path: record.slice(2), origPath: null, staged: null, unstaged: "untracked" });
  }
  return out;
}

export function parseNumstat(raw: string): Map<string, LineCounts> {
  const out = new Map<string, LineCounts>();
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const [added, deleted, path] = record.split("\t");
    const counts = {
      additions: added === "-" || added === undefined ? null : Number(added),
      deletions: deleted === "-" || deleted === undefined ? null : Number(deleted),
    };
    if (path) {
      out.set(path, counts);
      continue;
    }
    i += 2;
    const target = records[i];
    if (target) out.set(target, counts);
  }
  return out;
}

export function parseWorktrees(raw: string): Worktree[] {
  const out: Worktree[] = [];
  let current: Worktree | null = null;
  let bare = false;
  const flush = () => {
    if (current && !bare) out.push({ ...current, isMain: out.length === 0 });
    current = null;
    bare = false;
  };
  for (const record of raw.split("\0")) {
    if (record === "") flush();
    else if (record.startsWith("worktree ")) {
      flush();
      current = { path: record.slice(9), head: null, branch: null, isMain: false };
    } else if (current && record.startsWith("HEAD ")) current.head = /^0+$/.test(record.slice(5)) ? null : record.slice(5);
    else if (current && record.startsWith("branch ")) current.branch = record.slice(7).replace(/^refs\/heads\//, "");
    else if (record === "bare") bare = true;
  }
  flush();
  return out;
}
```

`packages/daemon/src/code/parse-diff.ts` :
```ts
import type { FileDiff, Hunk } from "@kibo/schema";

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const NO_HUNK_STAGING = ["new file mode", "deleted file mode", "rename from", "similarity index", "copy from"];

export function parseDiff(raw: string, path: string, origPath: string | null): FileDiff {
  const diff: FileDiff = { path, origPath, binary: false, hunkStaging: true, additions: 0, deletions: 0, hunks: [] };
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const line of raw.split("\n")) {
    const m = HUNK.exec(line);
    if (m) {
      hunk = {
        header: line,
        oldStart: Number(m[1]),
        oldLines: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newLines: m[4] === undefined ? 1 : Number(m[4]),
        section: m[5] ?? "",
        lines: [],
      };
      diff.hunks.push(hunk);
      oldNo = hunk.oldStart;
      newNo = hunk.newStart;
      continue;
    }
    if (!hunk) {
      if (line.startsWith("Binary files ") || line === "GIT binary patch") diff.binary = true;
      if (NO_HUNK_STAGING.some((p) => line.startsWith(p))) diff.hunkStaging = false;
      continue;
    }
    const sign = line[0];
    const text = line.slice(1);
    if (sign === "+") {
      hunk.lines.push({ kind: "add", text, oldNo: null, newNo: newNo++, noEol: false });
      diff.additions += 1;
    } else if (sign === "-") {
      hunk.lines.push({ kind: "del", text, oldNo: oldNo++, newNo: null, noEol: false });
      diff.deletions += 1;
    } else if (sign === " ") {
      hunk.lines.push({ kind: "context", text, oldNo: oldNo++, newNo: newNo++, noEol: false });
    } else if (sign === "\\") {
      const last = hunk.lines.at(-1);
      if (last) last.noEol = true;
    }
  }
  if (diff.binary) diff.hunkStaging = false;
  return diff;
}
```

`packages/daemon/src/code/parse-log.ts` :
```ts
import type { CommitInfo } from "@kibo/schema";

export const LOG_FORMAT = "%H%x00%h%x00%s%x00%b%x00%an%x00%at%x1e";

export function parseLog(raw: string, isPushed: (sha: string) => boolean): CommitInfo[] {
  return raw
    .split("\x1e")
    .map((record) => record.replace(/^\n/, ""))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [sha = "", shortSha = "", subject = "", body = "", author = "", at = "0"] = record.split("\0");
      return { sha, shortSha, subject, body: body.trim(), author, time: Number(at) * 1000, pushed: isPushed(sha) };
    });
}
```

`packages/daemon/src/code/patch.ts` :
```ts
import { type DiffLine, type FileDiff, KiboError } from "@kibo/schema";

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "-", context: " " };

export function hunkPatch(diff: FileDiff, index: number): string {
  const hunk = diff.hunks[index];
  if (!hunk) throw new KiboError("GIT_STALE", `hunk ${index} of ${diff.path} no longer exists`);
  const oldPath = diff.origPath ?? diff.path;
  const body = hunk.lines.flatMap((l) => {
    const line = `${SIGN[l.kind]}${l.text}`;
    return l.noEol ? [line, "\\ No newline at end of file"] : [line];
  });
  return [`diff --git a/${oldPath} b/${diff.path}`, `--- a/${oldPath}`, `+++ b/${diff.path}`, hunk.header, ...body, ""].join(
    "\n",
  );
}
```

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/parse.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/daemon/src/code/parse-status.ts packages/daemon/src/code/parse-diff.ts packages/daemon/src/code/parse-log.ts packages/daemon/src/code/patch.ts packages/daemon/src/code/parse.test.ts
git commit -m "feat(daemon): parseurs de sorties git"
```

---

### Task 5: Messages de commit et description de PR

**Files:**
- Create: `packages/core/src/commit-message.ts`, `packages/core/src/commit-message.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `ProjectSnapshot`, `CommitDefaults` (tâche 1).
- Produces (`@kibo/core`) :
  - `ticketKeyFromBranch(branch: string | null, projectKey: string): string | null` ;
  - `commitSubject(ticket: { key: string; title: string }, scope: string | null): string` ;
  - `commitMessage(input: { ticket: { key: string; title: string } | null; scope: string | null; doneChildren: string[] }): string` ;
  - `prBody(input: { ticket: { key: string; title: string } | null; commitSubjects: string[]; children: { key: string; done: boolean }[]; mockupUrl: string | null }): string` ;
  - `commitDefaults(snapshot: ProjectSnapshot, branch: string | null, commitSubjects: string[]): CommitDefaults`.

- [x] **Step 1: Tests**

`packages/core/src/commit-message.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { commitDefaults, commitMessage, commitSubject, prBody, ticketKeyFromBranch } from "./commit-message";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";

describe("ticketKeyFromBranch", () => {
  test("finds the project key in common branch names, case-insensitively", () => {
    expect(ticketKeyFromBranch("kib-12", "KIB")).toBe("KIB-12");
    expect(ticketKeyFromBranch("feat/KIB-12-schema-loro", "KIB")).toBe("KIB-12");
    expect(ticketKeyFromBranch("agent/kib-007", "KIB")).toBe("KIB-7");
  });
  test("ignores other keys, partial words and detached heads", () => {
    expect(ticketKeyFromBranch("feat/API-3", "KIB")).toBeNull();
    expect(ticketKeyFromBranch("kibble-12", "KIB")).toBeNull();
    expect(ticketKeyFromBranch(null, "KIB")).toBeNull();
  });
});

describe("messages", () => {
  test("subject lowercases the first letter, drops a trailing parenthesis and keeps acronyms", () => {
    expect(commitSubject({ key: "KIB-12", title: "Schéma Loro des tickets (LoroTree)" }, null)).toBe(
      "feat: schéma Loro des tickets (KIB-12)",
    );
    expect(commitSubject({ key: "KIB-12", title: "Schéma Loro des tickets" }, "core")).toBe(
      "feat(core): schéma Loro des tickets (KIB-12)",
    );
    expect(commitSubject({ key: "KIB-3", title: "API de facturation" }, null)).toBe("feat: API de facturation (KIB-3)");
    expect(commitSubject({ key: "KIB-4", title: "(WIP)" }, null)).toBe("feat: (WIP) (KIB-4)");
  });
  test("body lists the done sub-tickets", () => {
    expect(
      commitMessage({
        ticket: { key: "KIB-12", title: "Schéma Loro des tickets" },
        scope: null,
        doneChildren: ["LoroTree pour les sous-tickets", "index SQLite dérivé"],
      }),
    ).toBe("feat: schéma Loro des tickets (KIB-12)\n\n- LoroTree pour les sous-tickets\n- index SQLite dérivé");
    expect(commitMessage({ ticket: null, scope: null, doneChildren: [] })).toBe("");
  });
  test("PR body has one section per available information", () => {
    expect(
      prBody({
        ticket: { key: "KIB-12", title: "Schéma Loro des tickets" },
        commitSubjects: ["feat: opérations move", "test: convergence"],
        children: [
          { key: "KIB-24", done: true },
          { key: "KIB-27", done: false },
        ],
        mockupUrl: null,
      }),
    ).toBe(
      "## Ticket\nKIB-12 · Schéma Loro des tickets\n\n## Changements\n- feat: opérations move\n- test: convergence\n\n## Sous-tickets\n- [x] KIB-24\n- [x] KIB-27",
    );
  });
});

test("commitDefaults reads the ticket named by the branch", () => {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: "/repo", color: "#F97316" });
  const parent = executeProjectCommand(doc, { method: "createTicket", title: "Schéma Loro des tickets (LoroTree)" }) as { id: string };
  const child = executeProjectCommand(doc, { method: "createTicket", title: "Index SQLite dérivé", parentId: parent.id }) as {
    id: string;
  };
  executeProjectCommand(doc, { method: "setStatus", ticketId: child.id, statusId: "done" });
  const d = commitDefaults(readProject(doc), "kib-1", ["feat: premier jet"]);
  expect(d).toEqual({
    ticketId: parent.id,
    ticketKey: "KIB-1",
    message: "feat: schéma Loro des tickets (KIB-1)\n\n- Index SQLite dérivé",
    prTitle: "feat: schéma Loro des tickets (KIB-1)",
    prBody: "## Ticket\nKIB-1 · Schéma Loro des tickets (LoroTree)\n\n## Changements\n- feat: premier jet\n\n## Sous-tickets\n- [x] KIB-2",
  });
  expect(commitDefaults(readProject(doc), "main", ["chore: x"])).toEqual({
    ticketId: null,
    ticketKey: null,
    message: "",
    prTitle: "chore: x",
    prBody: "## Changements\n- chore: x",
  });
});
```
(Les `as { id: string }` lisent le résultat non typé de `executeProjectCommand`, comme dans les tests existants du noyau.)

Run: `bun test packages/core/src/commit-message.test.ts`
Expected: FAIL, module introuvable.

- [x] **Step 2: Implémenter**

`packages/core/src/commit-message.ts` :
```ts
import type { CommitDefaults, ProjectSnapshot } from "@kibo/schema";

export type MessageTicket = { key: string; title: string };

const TRAILING_PAREN = /\s*\([^()]*\)\s*$/;

export function ticketKeyFromBranch(branch: string | null, projectKey: string): string | null {
  if (!branch) return null;
  const m = new RegExp(`(?:^|[/_.-])(${projectKey})-(\\d+)(?=$|[/_.-])`, "i").exec(branch);
  return m ? `${projectKey}-${Number(m[2])}` : null;
}

function lowerFirst(title: string): string {
  const [first, second] = [...title];
  if (!first) return title;
  const secondIsUpper = second !== undefined && second !== second.toLowerCase();
  return secondIsUpper ? title : first.toLowerCase() + title.slice(first.length);
}

export function commitSubject(ticket: MessageTicket, scope: string | null): string {
  const stripped = ticket.title.replace(TRAILING_PAREN, "").trim();
  const title = lowerFirst(stripped || ticket.title.trim());
  return `feat${scope ? `(${scope})` : ""}: ${title} (${ticket.key})`;
}

export function commitMessage(input: { ticket: MessageTicket | null; scope: string | null; doneChildren: string[] }): string {
  if (!input.ticket) return "";
  const subject = commitSubject(input.ticket, input.scope);
  if (input.doneChildren.length === 0) return subject;
  return `${subject}\n\n${input.doneChildren.map((t) => `- ${t}`).join("\n")}`;
}

export function prBody(input: {
  ticket: MessageTicket | null;
  commitSubjects: string[];
  children: { key: string; done: boolean }[];
  mockupUrl: string | null;
}): string {
  const sections: string[] = [];
  if (input.ticket) sections.push(`## Ticket\n${input.ticket.key} · ${input.ticket.title}`);
  if (input.commitSubjects.length) sections.push(`## Changements\n${input.commitSubjects.map((s) => `- ${s}`).join("\n")}`);
  if (input.children.length)
    sections.push(`## Sous-tickets\n${input.children.map((c) => `- [${c.done ? "x" : " "}] ${c.key}`).join("\n")}`);
  if (input.mockupUrl) sections.push(`## Maquette\n${input.mockupUrl}`);
  return sections.join("\n\n");
}

export function commitDefaults(snapshot: ProjectSnapshot, branch: string | null, commitSubjects: string[]): CommitDefaults {
  const key = ticketKeyFromBranch(branch, snapshot.meta.key);
  const ticket = key ? (snapshot.tickets.find((t) => t.key === key) ?? null) : null;
  const children = ticket ? snapshot.tickets.filter((t) => t.parentId === ticket.id) : [];
  const message = commitMessage({
    ticket,
    scope: null,
    doneChildren: children.filter((c) => c.statusId === "done").map((c) => c.title),
  });
  return {
    ticketId: ticket?.id ?? null,
    ticketKey: ticket?.key ?? null,
    message,
    prTitle: ticket ? commitSubject(ticket, null) : (commitSubjects[0] ?? ""),
    prBody: prBody({
      ticket,
      commitSubjects,
      children: children.map((c) => ({ key: c.key, done: c.statusId === "done" })),
      mockupUrl: null,
    }),
  };
}
```
Les titres de section de la description (« Ticket », « Changements »…) sont du contenu produit dans la PR, pas du texte d'interface : ils restent ici.

`packages/core/src/index.ts` : ajouter `export * from "./commit-message";`.

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/core`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/core/src/commit-message.ts packages/core/src/commit-message.test.ts packages/core/src/index.ts
git commit -m "feat(core): message de commit déterministe"
```

---

### Task 6: État local et RPC des onglets

**Files:**
- Modify: `packages/daemon/src/store.ts`, `packages/daemon/src/store.test.ts`, `packages/daemon/src/service.ts`, `packages/daemon/src/service.test.ts`

**Interfaces:**
- Consumes: `TabsState`, `EMPTY_TABS`, requêtes `getTabs` / `saveTabs` (tâche 1).
- Produces : `Store.getLocal(key: string): string | null`, `Store.setLocal(key: string, value: string): void` ; `Service.handle({ method: "getTabs" })` → `TabsState` ; `Service.handle({ method: "saveTabs", state })` → `null` ; `call<R extends RpcRequest>(service: Service, req: R): RpcResult[R["method"]]` (exporté par `service.ts`, utilisé par la tâche 21).

- [x] **Step 1: Tests**

Ajouter à `packages/daemon/src/store.test.ts` :
```ts
test("local state survives a reopen and never touches the docs table", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-local-"));
  const first = openStore(home);
  first.setLocal("tabs:workspace", '{"a":1}');
  first.setLocal("tabs:workspace", '{"a":2}');
  first.close();
  const again = openStore(home);
  expect(again.getLocal("tabs:workspace")).toBe('{"a":2}');
  expect(again.getLocal("missing")).toBeNull();
  expect(again.ids()).toEqual([]);
  again.close();
  rmSync(home, { recursive: true, force: true });
});
```
(Réutiliser les imports `mkdtempSync`, `rmSync`, `tmpdir`, `join` déjà présents dans le fichier ; les ajouter sinon.)

Ajouter à `packages/daemon/src/service.test.ts` :
```ts
describe("tabs", () => {
  const state = {
    tabs: [{ id: "t1", target: { kind: "project" as const, projectId: "p1" }, pinned: true }],
    activeId: "t1",
    recents: [{ kind: "project" as const, projectId: "p1" }],
  };
  test("getTabs defaults to the empty state, saveTabs persists across services", () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-tabs-"));
    const store = openStore(home);
    expect(createService(store, { user: "adam" }).handle({ method: "getTabs" })).toEqual(EMPTY_TABS);
    expect(createService(store, { user: "adam" }).handle({ method: "saveTabs", state })).toBeNull();
    expect(createService(store, { user: "adam" }).handle({ method: "getTabs" })).toEqual(state);
    store.close();
    rmSync(home, { recursive: true, force: true });
  });
  test("an unreadable stored state is reported and replaced by the empty state", () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-tabs-"));
    const store = openStore(home);
    store.setLocal("tabs:workspace", "{not json");
    const errors = spyOn(console, "error").mockImplementation(() => {});
    expect(createService(store, { user: "adam" }).handle({ method: "getTabs" })).toEqual(EMPTY_TABS);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    store.close();
    rmSync(home, { recursive: true, force: true });
  });
});
```
(Importer `EMPTY_TABS` depuis `@kibo/schema` et `spyOn` depuis `bun:test`.)

Run: `bun test packages/daemon/src/store.test.ts packages/daemon/src/service.test.ts`
Expected: FAIL (`setLocal` absent, `getTabs` renvoie `undefined`).

- [x] **Step 2: Implémenter**

`packages/daemon/src/store.ts` :
- ajouter à `Store` : `getLocal(key: string): string | null;` et `setLocal(key: string, value: string): void;` ;
- après la création de `docs`, exécuter `db.exec("CREATE TABLE IF NOT EXISTS local_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");` ;
- préparer :
```ts
  const upsertLocal = db.query(
    "INSERT INTO local_state (key, value, updated_at) VALUES ($key, $value, $at) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  );
  const selectLocal = db.query("SELECT value FROM local_state WHERE key = $key");
```
- et dans l'objet renvoyé :
```ts
    getLocal: (key) => (selectLocal.get({ key }) as { value: string } | null)?.value ?? null,
    setLocal: (key, value) => {
      upsertLocal.run({ key, value, at: Date.now() });
    },
```

`packages/daemon/src/service.ts` :
- importer `EMPTY_TABS`, `type RpcResult`, `TabsState` depuis `@kibo/schema` ;
- ajouter la constante `const TABS_KEY = "tabs:workspace";` et la fonction :
```ts
function readTabs(store: Store): TabsState {
  const raw = store.getLocal(TABS_KEY);
  if (raw === null) return EMPTY_TABS;
  try {
    const parsed = TabsState.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    console.error("[kibo-daemon] stored tabs are invalid, starting empty", parsed.error.message);
  } catch (e) {
    console.error("[kibo-daemon] stored tabs are unreadable, starting empty", e);
  }
  return EMPTY_TABS;
}
```
- ajouter dans le `switch` de `handle` :
```ts
        case "getTabs":
          return readTabs(store);
        case "saveTabs":
          store.setLocal(TABS_KEY, JSON.stringify(req.state));
          return null;
```
- exporter l'accès typé :
```ts
export function call<R extends RpcRequest>(service: Service, req: R): RpcResult[R["method"]] {
  return service.handle(req) as RpcResult[R["method"]];
}
```
(`as` justifié : `RpcResult` est le contrat de `handle`. Si la phase 2 a rendu `handle` asynchrone, écrire `async function call(...): Promise<RpcResult[R["method"]]>` avec `await`.)

Les onglets sont un confort local : un état illisible est journalisé et remplacé, sans bloquer le démarrage (au contraire des docs, protégés par `STORE_CORRUPT`).

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/daemon`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/daemon/src/store.ts packages/daemon/src/store.test.ts packages/daemon/src/service.ts packages/daemon/src/service.test.ts
git commit -m "feat(daemon): état local des onglets"
```

---

### Task 7: Watcher de worktree

**Files:**
- Create: `packages/daemon/src/code/watcher.ts`, `packages/daemon/src/code/watcher.test.ts`

**Interfaces:**
- Produces : `type WatchTarget = { path: string; recursive: boolean }` ; `type WatchHandle = { mode(): "watch" | "poll"; close(): void }` ; `watchPaths(targets: WatchTarget[], onChange: () => void, opts?: { debounceMs?: number; pollMs?: number; onError?: (e: unknown) => void }): WatchHandle` ; `dedupeTargets(targets: WatchTarget[]): WatchTarget[]`.

- [x] **Step 1: Tests**

`packages/daemon/src/code/watcher.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupeTargets, watchPaths } from "./watcher";

let dir: string;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-watch-")));
  mkdirSync(join(dir, "src"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a burst of writes produces a single debounced call", async () => {
  let calls = 0;
  const handle = watchPaths([{ path: dir, recursive: true }], () => calls++, { debounceMs: 80 });
  expect(handle.mode()).toBe("watch");
  for (let i = 0; i < 5; i++) writeFileSync(join(dir, "src", `f${i}.ts`), "x");
  await wait(400);
  expect(calls).toBe(1);
  handle.close();
  writeFileSync(join(dir, "src", "after.ts"), "x");
  await wait(200);
  expect(calls).toBe(1);
});

test("an unwatchable path falls back to polling and reports the error", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const handle = watchPaths([{ path: join(dir, "missing"), recursive: true }], () => calls++, {
    pollMs: 30,
    onError: (e) => errors.push(e),
  });
  expect(handle.mode()).toBe("poll");
  expect(errors).toHaveLength(1);
  await wait(120);
  expect(calls).toBeGreaterThan(1);
  handle.close();
});

test("targets covered by a recursive parent are dropped", () => {
  expect(
    dedupeTargets([
      { path: "/repo", recursive: true },
      { path: "/repo/.git", recursive: false },
      { path: "/repo/.git/worktrees/kib", recursive: false },
      { path: "/elsewhere/.git", recursive: true },
    ]),
  ).toEqual([
    { path: "/repo", recursive: true },
    { path: "/elsewhere/.git", recursive: true },
  ]);
});
```

Run: `bun test packages/daemon/src/code/watcher.test.ts`
Expected: FAIL, module introuvable.

- [x] **Step 2: Implémenter**

`packages/daemon/src/code/watcher.ts` :
```ts
import { type FSWatcher, watch } from "node:fs";
import { isInside } from "./safe-path";

export type WatchTarget = { path: string; recursive: boolean };
export type WatchHandle = { mode(): "watch" | "poll"; close(): void };
export type WatchOptions = { debounceMs?: number; pollMs?: number; onError?: (e: unknown) => void };

export function dedupeTargets(targets: WatchTarget[]): WatchTarget[] {
  return targets.filter(
    (t, i) => !targets.some((o, j) => j !== i && o.recursive && o.path !== t.path && isInside(o.path, t.path)),
  );
}

export function watchPaths(targets: WatchTarget[], onChange: () => void, opts: WatchOptions = {}): WatchHandle {
  const report = opts.onError ?? ((e: unknown) => console.error("[kibo-daemon] watcher failed", e));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  const watchers: FSWatcher[] = [];
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, opts.debounceMs ?? 150);
  };
  const closeWatchers = () => {
    for (const w of watchers.splice(0)) w.close();
  };
  const fallBack = (e: unknown) => {
    report(e);
    closeWatchers();
    poll ??= setInterval(onChange, opts.pollMs ?? 3000);
  };
  try {
    for (const t of dedupeTargets(targets)) {
      const w = watch(t.path, { recursive: t.recursive }, fire);
      w.on("error", fallBack);
      watchers.push(w);
    }
  } catch (e) {
    fallBack(e);
  }
  return {
    mode: () => (poll ? "poll" : "watch"),
    close() {
      closeWatchers();
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
      poll = null;
      timer = null;
    },
  };
}
```

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/watcher.test.ts`
Expected: PASS sur macOS et Linux (sur Linux, `fs.watch` récursif de Bun s'appuie sur inotify ; si la CI Linux échoue sur le premier test, relever `debounceMs` et le délai d'attente, jamais retirer l'assertion).

- [x] **Step 4: Commit**

```bash
git add packages/daemon/src/code/watcher.ts packages/daemon/src/code/watcher.test.ts
git commit -m "feat(daemon): watcher de worktree"
```

---

### Task 8: Ouverture dans l'éditeur externe

**Files:**
- Create: `packages/daemon/src/code/editor.ts`, `packages/daemon/src/code/editor.test.ts`

**Interfaces:**
- Consumes: `installFakeBin`, `readFakeBinLog` (tâche 3).
- Produces : `ALLOWED_EDITORS: readonly string[]` ; `editorCommand(file: string, line: number | null, env: Record<string, string | undefined>, platform: NodeJS.Platform): string[]` ; `openInEditor(cmd: string[], env?: Record<string, string>): void`.

- [x] **Step 1: Tests**

`packages/daemon/src/code/editor.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editorCommand, openInEditor } from "./editor";
import { installFakeBin, readFakeBinLog } from "./testing/git-fixture";

test("allowed editors receive the line in their own syntax", () => {
  expect(editorCommand("/r/a.ts", 42, { VISUAL: "/usr/local/bin/code --wait" }, "darwin")).toEqual([
    "/usr/local/bin/code",
    "--goto",
    "/r/a.ts:42",
  ]);
  expect(editorCommand("/r/a.ts", 42, { EDITOR: "zed" }, "linux")).toEqual(["zed", "/r/a.ts:42"]);
  expect(editorCommand("/r/a.ts", 7, { EDITOR: "webstorm" }, "linux")).toEqual(["webstorm", "--line", "7", "/r/a.ts"]);
  expect(editorCommand("/r/a.ts", null, { EDITOR: "subl" }, "linux")).toEqual(["subl", "/r/a.ts"]);
});

test("unknown or terminal editors fall back to the system opener", () => {
  expect(editorCommand("/r/a.ts", 3, { EDITOR: "vim" }, "darwin")).toEqual(["open", "/r/a.ts"]);
  expect(editorCommand("/r/a.ts", 3, { VISUAL: "sh -c 'rm -rf /'" }, "linux")).toEqual(["xdg-open", "/r/a.ts"]);
  expect(editorCommand("/r/a.ts", 3, {}, "linux")).toEqual(["xdg-open", "/r/a.ts"]);
  expect(() => editorCommand("/r/a.ts", 3, {}, "win32")).toThrow(expect.objectContaining({ code: "EDITOR_UNAVAILABLE" }));
});

let dir: string;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-editor-")));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("openInEditor spawns the command detached, without a shell", async () => {
  const bin = installFakeBin(dir, "code");
  openInEditor([bin.path, "--goto", "/r/a.ts:42"], { FAKE_BIN_LOG: bin.log });
  await new Promise((r) => setTimeout(r, 300));
  expect(readFakeBinLog(bin.log)).toEqual([["--goto", "/r/a.ts:42"]]);
  expect(() => openInEditor([join(dir, "missing-editor")])).toThrow(expect.objectContaining({ code: "EDITOR_UNAVAILABLE" }));
});
```

Run: `bun test packages/daemon/src/code/editor.test.ts`
Expected: FAIL, module introuvable.

- [x] **Step 2: Implémenter**

`packages/daemon/src/code/editor.ts` :
```ts
import { basename } from "node:path";
import { KiboError } from "@kibo/schema";

export const ALLOWED_EDITORS: readonly string[] = ["code", "code-insiders", "cursor", "windsurf", "zed", "subl", "webstorm", "idea"];
const GOTO_FLAG = new Set(["code", "code-insiders", "cursor", "windsurf"]);
const LINE_FLAG = new Set(["webstorm", "idea"]);

function lineArgs(name: string, file: string, line: number | null): string[] {
  if (line === null) return [file];
  if (GOTO_FLAG.has(name)) return ["--goto", `${file}:${line}`];
  if (LINE_FLAG.has(name)) return ["--line", String(line), file];
  return [`${file}:${line}`];
}

export function editorCommand(
  file: string,
  line: number | null,
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): string[] {
  const configured = (env.VISUAL || env.EDITOR || "").trim().split(/\s+/)[0] ?? "";
  const name = basename(configured);
  if (configured && ALLOWED_EDITORS.includes(name)) return [configured, ...lineArgs(name, file, line)];
  if (platform === "darwin") return ["open", file];
  if (platform === "linux") return ["xdg-open", file];
  throw new KiboError("EDITOR_UNAVAILABLE", `no allowed editor on ${platform}`);
}

export function openInEditor(cmd: string[], env: Record<string, string> = {}): void {
  try {
    Bun.spawn(cmd, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "ignore"] }).unref();
  } catch (e) {
    throw new KiboError("EDITOR_UNAVAILABLE", `cannot start ${cmd[0]}: ${String(e)}`);
  }
}
```
Les arguments supplémentaires de `$EDITOR` (comme `--wait`) sont volontairement ignorés : seul le binaire de la liste blanche est lancé.

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/editor.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/daemon/src/code/editor.ts packages/daemon/src/code/editor.test.ts
git commit -m "feat(daemon): ouverture dans l'éditeur externe"
```

---

### Task 9: Onglets (modèle, barre, persistance, raccourcis)

Écran 20 (PDF page 33). Onglet Accueil fixe (logo), onglets épinglés compacts (pastille du projet + icône) séparés par un trait, onglets « Projet · Page » avec croix, bouton `+`, menu contextuel de la maquette.

**Files:**
- Create: `packages/ui/src/tabs/target-hash.ts`, `packages/ui/src/tabs/tabs-model.ts`, `packages/ui/src/tabs/tab-title.ts`, `packages/ui/src/tabs/use-tabs.ts`, `packages/ui/src/tabs/use-tab-shortcuts.ts`, `packages/ui/src/tabs/TabBar.tsx`, `packages/ui/src/tabs/tabs.test.ts`, `packages/ui/src/tabs/TabBar.test.tsx`

**Interfaces:**
- Consumes: `TabTarget`, `Tab`, `TabsState`, `EMPTY_TABS`, `MAX_TABS`, `MAX_RECENTS` (tâche 1) ; `client.rpc({ method: "getTabs" | "saveTabs" })` ; `fr.tabs` ; `ContextMenu*` (tâche 2) ; `pageIcon` (`registry.ts`) ; `KiboLogo`.
- Produces :
  - `targetToHash(target: TabTarget | null): string`, `hashToTarget(hash: string): TabTarget | null` (null = Accueil) ;
  - `type TabsAction = { type: "open"; target: TabTarget; newTab: boolean; id: string } | { type: "activate"; id: string | null } | { type: "activateIndex"; index: number } | { type: "close"; id: string } | { type: "closeOthers"; id: string } | { type: "closeRight"; id: string } | { type: "pin"; id: string; pinned: boolean } | { type: "duplicate"; id: string; newId: string } | { type: "move"; id: string; toIndex: number } | { type: "replace"; state: TabsState }` ; `tabsReducer(state: TabsState, action: TabsAction): TabsState` ; `sameTarget(a: TabTarget, b: TabTarget): boolean` ; `activeTarget(state: TabsState): TabTarget | null` ;
  - `type TabDescription = { title: string; icon: LucideIcon; color: string | null; missing: boolean }` ; `describeTarget(target: TabTarget, ctx: { projects: ProjectSummary[]; snapshots: Map<string, ProjectSnapshot> }): TabDescription` ;
  - `type TabsApi = { state: TabsState; error: string | null; dispatch(a: TabsAction): void; open(target: TabTarget | null, opts?: { newTab?: boolean }): void }` ; `useTabs(): TabsApi | null` (null tant que non chargé) ;
  - `type TabShortcut = { kind: "newTab" } | { kind: "palette" } | { kind: "close" } | { kind: "togglePin" } | { kind: "activate"; index: number }` ; `shortcutFor(e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, mac: boolean): TabShortcut | null` ; `useTabShortcuts(onShortcut: (s: TabShortcut) => void): void` ;
  - `TabBar(props: { state: TabsState; describe(t: TabTarget): TabDescription; isDirty(t: TabTarget): boolean; dispatch(a: TabsAction): void; onNewTab(): void; onOpenWindow: ((t: TabTarget) => void) | null; error: string | null })`.

- [x] **Step 1: Tests du modèle**

`packages/ui/src/tabs/tabs.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { EMPTY_TABS, type TabsState, type TabTarget } from "@kibo/schema";
import { hashToTarget, targetToHash } from "./target-hash";
import { shortcutFor } from "./use-tab-shortcuts";
import { activeTarget, tabsReducer } from "./tabs-model";

const page = (pageId: string): TabTarget => ({ kind: "page", projectId: "p1", pageId });
const open = (s: TabsState, target: TabTarget, id: string, newTab = false) =>
  tabsReducer(s, { type: "open", target, newTab, id });

describe("hash codec", () => {
  const targets: TabTarget[] = [
    { kind: "project", projectId: "p1" },
    page("1@2"),
    { kind: "ticket", projectId: "p1", ticketId: "4@2" },
    { kind: "changes", projectId: "p1", worktree: null },
    { kind: "changes", projectId: "p1", worktree: "/wt/kib 12" },
    { kind: "file", projectId: "p1", worktree: "/wt", path: "packages/core/ticket.ts", line: 42 },
  ];
  test("round-trips every target kind", () => {
    for (const t of targets) expect(hashToTarget(targetToHash(t))).toEqual(t);
    expect(targetToHash(null)).toBe("#/");
    expect(hashToTarget("#/")).toBeNull();
  });
  test("keeps MVP URLs and rejects invalid ones", () => {
    expect(hashToTarget("#/p/p1/1%401")).toEqual(page("1@1"));
    expect(hashToTarget("#/p/p1/")).toEqual({ kind: "project", projectId: "p1" });
    expect(hashToTarget("#/p/p1/file?path=..%2Fetc")).toBeNull();
    expect(hashToTarget("#/p/%E0%A4%A/")).toBeNull();
  });
});

describe("tabsReducer", () => {
  test("a plain open replaces the active tab, a new-tab open appends, a known target is focused", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1"]);
    s = open(s, page("b"), "t2");
    expect(s.tabs).toEqual([{ id: "t1", target: page("b"), pinned: false }]);
    s = open(s, page("c"), "t3", true);
    expect(s.activeId).toBe("t3");
    s = open(s, page("b"), "t4", true);
    expect(s.tabs).toHaveLength(2);
    expect(s.activeId).toBe("t1");
    expect(s.recents.map((r) => (r.kind === "page" ? r.pageId : ""))).toEqual(["b", "c", "a"]);
  });

  test("home and pinned tabs are never replaced", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: true });
    s = open(s, page("b"), "t2");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    s = tabsReducer(s, { type: "activate", id: null });
    s = open(s, page("c"), "t3");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  test("closing focuses the right neighbour, then the left, then home; pinned tabs resist", () => {
    let s = open(open(open(EMPTY_TABS, page("a"), "t1"), page("b"), "t2", true), page("c"), "t3", true);
    s = tabsReducer(s, { type: "activate", id: "t2" });
    s = tabsReducer(s, { type: "close", id: "t2" });
    expect(s.activeId).toBe("t3");
    s = tabsReducer(s, { type: "close", id: "t3" });
    expect(s.activeId).toBe("t1");
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: true });
    expect(tabsReducer(s, { type: "close", id: "t1" })).toEqual(s);
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: false });
    s = tabsReducer(s, { type: "close", id: "t1" });
    expect(s.activeId).toBeNull();
  });

  test("close others and close to the right keep pinned tabs", () => {
    let s = EMPTY_TABS;
    for (const id of ["t1", "t2", "t3", "t4"]) s = open(s, page(id), id, true);
    s = tabsReducer(s, { type: "pin", id: "t4", pinned: true });
    expect(s.tabs.map((t) => t.id)).toEqual(["t4", "t1", "t2", "t3"]);
    expect(tabsReducer(s, { type: "closeOthers", id: "t2" }).tabs.map((t) => t.id)).toEqual(["t4", "t2"]);
    expect(tabsReducer(s, { type: "closeRight", id: "t1" }).tabs.map((t) => t.id)).toEqual(["t4", "t1"]);
  });

  test("duplicate, move within the group and index shortcuts", () => {
    let s = EMPTY_TABS;
    for (const id of ["t1", "t2", "t3"]) s = open(s, page(id), id, true);
    s = tabsReducer(s, { type: "duplicate", id: "t1", newId: "t1b" });
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t1b", "t2", "t3"]);
    expect(s.activeId).toBe("t1b");
    s = tabsReducer(s, { type: "pin", id: "t3", pinned: true });
    s = tabsReducer(s, { type: "move", id: "t2", toIndex: 0 });
    expect(s.tabs.map((t) => t.id)).toEqual(["t3", "t2", "t1", "t1b"]);
    expect(activeTarget(tabsReducer(s, { type: "activateIndex", index: 0 }))).toBeNull();
    expect(tabsReducer(s, { type: "activateIndex", index: 1 }).activeId).toBe("t3");
    expect(tabsReducer(s, { type: "activateIndex", index: 8 }).activeId).toBe("t1b");
    expect(tabsReducer(s, { type: "activateIndex", index: 7 })).toEqual(s);
  });

  test("the tab count stays bounded", () => {
    let s = EMPTY_TABS;
    for (let i = 0; i < 55; i++) s = open(s, page(`p${i}`), `t${i}`, true);
    expect(s.tabs).toHaveLength(50);
    expect(s.activeId).toBe("t54");
  });
});

test("shortcuts use ⌘ on macOS and Ctrl elsewhere", () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  expect(shortcutFor(key("t", { metaKey: true }), true)).toEqual({ kind: "newTab" });
  expect(shortcutFor(key("t", { ctrlKey: true }), true)).toBeNull();
  expect(shortcutFor(key("w", { ctrlKey: true }), false)).toEqual({ kind: "close" });
  expect(shortcutFor(key("k", { metaKey: true }), true)).toEqual({ kind: "palette" });
  expect(shortcutFor(key("3", { metaKey: true }), true)).toEqual({ kind: "activate", index: 2 });
  expect(shortcutFor(key("P", { metaKey: true, shiftKey: true }), true)).toEqual({ kind: "togglePin" });
  expect(shortcutFor(key("t"), true)).toBeNull();
});
```

Run: `bun test packages/ui/src/tabs/tabs.test.ts`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter le codec, le modèle et les raccourcis**

`packages/ui/src/tabs/target-hash.ts` :
```ts
import { TabTarget } from "@kibo/schema";

const enc = encodeURIComponent;

export function targetToHash(target: TabTarget | null): string {
  if (!target) return "#/";
  const base = `#/p/${enc(target.projectId)}`;
  switch (target.kind) {
    case "project":
      return `${base}/`;
    case "page":
      return `${base}/${enc(target.pageId)}`;
    case "ticket":
      return `${base}/t/${enc(target.ticketId)}`;
    case "changes":
      return target.worktree ? `${base}/changes?wt=${enc(target.worktree)}` : `${base}/changes`;
    case "file": {
      const q = new URLSearchParams({ path: target.path });
      if (target.worktree) q.set("wt", target.worktree);
      if (target.line !== null) q.set("line", String(target.line));
      return `${base}/file?${q.toString()}`;
    }
  }
}

function candidate(projectId: string, rest: string, q: URLSearchParams): unknown {
  if (rest === "") return { kind: "project", projectId };
  if (rest === "changes") return { kind: "changes", projectId, worktree: q.get("wt") };
  if (rest === "file") {
    const line = q.get("line");
    return { kind: "file", projectId, worktree: q.get("wt"), path: q.get("path") ?? "", line: line ? Number(line) : null };
  }
  if (rest.startsWith("t/")) return { kind: "ticket", projectId, ticketId: decodeURIComponent(rest.slice(2)) };
  return { kind: "page", projectId, pageId: decodeURIComponent(rest) };
}

export function hashToTarget(hash: string): TabTarget | null {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const m = /^\/p\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!m?.[1]) return null;
  try {
    const parsed = TabTarget.safeParse(candidate(decodeURIComponent(m[1]), m[2] ?? "", new URLSearchParams(query)));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}
```

`packages/ui/src/tabs/tabs-model.ts` :
```ts
import { MAX_RECENTS, MAX_TABS, type Tab, type TabsState, type TabTarget } from "@kibo/schema";
import { targetToHash } from "./target-hash";

export type TabsAction =
  | { type: "open"; target: TabTarget; newTab: boolean; id: string }
  | { type: "activate"; id: string | null }
  | { type: "activateIndex"; index: number }
  | { type: "close"; id: string }
  | { type: "closeOthers"; id: string }
  | { type: "closeRight"; id: string }
  | { type: "pin"; id: string; pinned: boolean }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "move"; id: string; toIndex: number }
  | { type: "replace"; state: TabsState };

export const sameTarget = (a: TabTarget, b: TabTarget): boolean => targetToHash(a) === targetToHash(b);

export const activeTarget = (s: TabsState): TabTarget | null => s.tabs.find((t) => t.id === s.activeId)?.target ?? null;

const pinnedFirst = (tabs: Tab[]): Tab[] => [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];

const remember = (recents: TabTarget[], target: TabTarget): TabTarget[] =>
  [target, ...recents.filter((r) => !sameTarget(r, target))].slice(0, MAX_RECENTS);

function closeIds(state: TabsState, ids: Set<string>): TabsState {
  const tabs = state.tabs.filter((t) => !ids.has(t.id));
  if (!state.activeId || !ids.has(state.activeId)) return { ...state, tabs };
  const index = state.tabs.findIndex((t) => t.id === state.activeId);
  const right = state.tabs.slice(index + 1).find((t) => !ids.has(t.id));
  const left = [...state.tabs.slice(0, index)].reverse().find((t) => !ids.has(t.id));
  return { ...state, tabs, activeId: (right ?? left)?.id ?? null };
}

function openTarget(state: TabsState, target: TabTarget, newTab: boolean, id: string): TabsState {
  const recents = remember(state.recents, target);
  const existing = state.tabs.find((t) => sameTarget(t.target, target));
  if (existing) return { ...state, activeId: existing.id, recents };
  const active = state.tabs.find((t) => t.id === state.activeId);
  if (!newTab && active && !active.pinned) {
    return { ...state, tabs: state.tabs.map((t) => (t.id === active.id ? { ...t, target } : t)), recents };
  }
  let tabs = state.tabs;
  if (tabs.length >= MAX_TABS) {
    const victim = tabs.find((t) => !t.pinned && t.id !== state.activeId);
    if (!victim) return { ...state, recents };
    tabs = tabs.filter((t) => t.id !== victim.id);
  }
  return { tabs: [...tabs, { id, target, pinned: false }], activeId: id, recents };
}

function move(state: TabsState, id: string, toIndex: number): TabsState {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return state;
  const rest = state.tabs.filter((t) => t.id !== id);
  const pinnedCount = rest.filter((t) => t.pinned).length;
  const [min, max] = tab.pinned ? [0, pinnedCount] : [pinnedCount, rest.length];
  const at = Math.min(max, Math.max(min, toIndex));
  return { ...state, tabs: [...rest.slice(0, at), tab, ...rest.slice(at)] };
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "open":
      return openTarget(state, action.target, action.newTab, action.id);
    case "activate":
      return action.id === null || state.tabs.some((t) => t.id === action.id) ? { ...state, activeId: action.id } : state;
    case "activateIndex": {
      if (action.index === 0) return { ...state, activeId: null };
      const tab = action.index >= 8 ? state.tabs.at(-1) : state.tabs[action.index - 1];
      return tab ? { ...state, activeId: tab.id } : state;
    }
    case "close": {
      const tab = state.tabs.find((t) => t.id === action.id);
      return tab && !tab.pinned ? closeIds(state, new Set([tab.id])) : state;
    }
    case "closeOthers":
      return {
        ...closeIds(state, new Set(state.tabs.filter((t) => !t.pinned && t.id !== action.id).map((t) => t.id))),
        activeId: action.id,
      };
    case "closeRight": {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      if (index < 0) return state;
      const ids = new Set(state.tabs.slice(index + 1).filter((t) => !t.pinned).map((t) => t.id));
      return closeIds({ ...state, activeId: ids.has(state.activeId ?? "") ? action.id : state.activeId }, ids);
    }
    case "pin":
      return { ...state, tabs: pinnedFirst(state.tabs.map((t) => (t.id === action.id ? { ...t, pinned: action.pinned } : t))) };
    case "duplicate": {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      const tab = state.tabs[index];
      if (!tab || state.tabs.length >= MAX_TABS) return state;
      const copy = { id: action.newId, target: tab.target, pinned: false };
      return { ...state, tabs: pinnedFirst([...state.tabs.slice(0, index + 1), copy, ...state.tabs.slice(index + 1)]), activeId: copy.id };
    }
    case "move":
      return move(state, action.id, action.toIndex);
    case "replace":
      return action.state;
  }
}
```

`packages/ui/src/tabs/use-tab-shortcuts.ts` :
```ts
import { useEffect, useRef } from "react";

export type TabShortcut =
  | { kind: "newTab" }
  | { kind: "palette" }
  | { kind: "close" }
  | { kind: "togglePin" }
  | { kind: "activate"; index: number };
type KeyInput = { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };

export const isMacPlatform = (platform: string): boolean => /mac|iphone|ipad/i.test(platform);

export function shortcutFor(e: KeyInput, mac: boolean): TabShortcut | null {
  const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!mod || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (e.shiftKey) return key === "p" ? { kind: "togglePin" } : null;
  if (key === "t") return { kind: "newTab" };
  if (key === "k") return { kind: "palette" };
  if (key === "w") return { kind: "close" };
  if (/^[1-9]$/.test(key)) return { kind: "activate", index: Number(key) - 1 };
  return null;
}

export function useTabShortcuts(onShortcut: (s: TabShortcut) => void): void {
  const handler = useRef(onShortcut);
  handler.current = onShortcut;
  useEffect(() => {
    const mac = isMacPlatform(navigator.platform);
    const listener = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e, mac);
      if (!shortcut) return;
      e.preventDefault();
      handler.current(shortcut);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
```
`⌘1` donne l'index 0 (Accueil), `⌘9` l'index 8 (dernier onglet), conformément au complément de spec §7.

Run: `bun test packages/ui/src/tabs/tabs.test.ts`
Expected: PASS.

- [x] **Step 3: Titres, persistance et barre (test d'abord)**

`packages/ui/src/tabs/TabBar.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type ProjectSummary, type RpcRequest, type TabsState } from "@kibo/schema";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TabsAction } from "./tabs-model";

const saved: RpcRequest[] = [];
let stored: TabsState = { tabs: [], activeId: null, recents: [] };
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getTabs") return Promise.resolve(stored);
      saved.push(req);
      return Promise.resolve(null);
    },
  },
}));
const { TabBar } = await import("./TabBar");
const { describeTarget } = await import("./tab-title");
const { useTabs } = await import("./use-tabs");

const summary: ProjectSummary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const snapshot: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Kanban", kind: "view", parentId: null }],
  tickets: [],
  links: [],
  instances: [],
  nextTicketKey: "KIB-1",
};
const ctx = { projects: [summary], snapshots: new Map([["p1", snapshot]]) };
const state: TabsState = {
  tabs: [
    { id: "pinned", target: { kind: "project", projectId: "p1" }, pinned: true },
    { id: "board", target: { kind: "page", projectId: "p1", pageId: "1@1" }, pinned: false },
    { id: "changes", target: { kind: "changes", projectId: "p1", worktree: null }, pinned: false },
    { id: "gone", target: { kind: "page", projectId: "p1", pageId: "9@9" }, pinned: false },
  ],
  activeId: "board",
  recents: [],
};

beforeEach(() => {
  saved.length = 0;
});

function renderBar(onOpenWindow: ((t: unknown) => void) | null = null) {
  const actions: TabsAction[] = [];
  render(
    <TabBar
      state={state}
      describe={(t) => describeTarget(t, ctx)}
      isDirty={(t) => t.kind === "changes"}
      dispatch={(a) => actions.push(a)}
      onNewTab={() => actions.push({ type: "activate", id: "new" })}
      onOpenWindow={onOpenWindow}
      error={null}
    />,
  );
  return actions;
}

test("titles follow « Projet · Page », pinned tabs are compact, missing targets are named", () => {
  renderBar();
  const bar = screen.getByRole("tablist", { name: "Onglets" });
  expect(within(bar).getByRole("tab", { name: "Accueil" }).getAttribute("aria-selected")).toBe("false");
  expect(within(bar).getByRole("tab", { name: "Kibo · Kanban" }).getAttribute("aria-selected")).toBe("true");
  expect(within(bar).getByRole("tab", { name: "Kibo" }).textContent).toBe("");
  expect(within(bar).getByRole("tab", { name: "Page introuvable" })).toBeTruthy();
  expect(within(bar).getByRole("img", { name: "Changements non commités" })).toBeTruthy();
  expect(within(bar).queryByRole("button", { name: "Fermer Kibo" })).toBeNull();
});

test("click activates, the cross and the middle button close, + opens a new tab", async () => {
  const actions = renderBar();
  await userEvent.click(screen.getByRole("tab", { name: "Kibo · Changements" }));
  await userEvent.click(screen.getByRole("button", { name: "Fermer Kibo · Kanban" }));
  fireEvent(screen.getByRole("tab", { name: "Page introuvable" }), new MouseEvent("auxclick", { bubbles: true, button: 1 }));
  await userEvent.click(screen.getByRole("button", { name: "Nouvel onglet" }));
  expect(actions).toEqual([
    { type: "activate", id: "changes" },
    { type: "close", id: "board" },
    { type: "close", id: "gone" },
    { type: "activate", id: "new" },
  ]);
});

test("the context menu pins, duplicates, closes others and opens a window when allowed", async () => {
  const windows: unknown[] = [];
  const actions = renderBar((t) => windows.push(t));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Épingler l'onglet/ }));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Ouvrir dans une nouvelle fenêtre" }));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Fermer les autres onglets" }));
  expect(actions[0]).toEqual({ type: "pin", id: "board", pinned: true });
  expect(windows).toEqual([{ kind: "page", projectId: "p1", pageId: "1@1" }]);
  expect(actions[1]).toEqual({ type: "closeOthers", id: "board" });
});

test("useTabs loads the stored state and saves changes after a debounce", async () => {
  stored = state;
  const { result } = renderHook(() => useTabs());
  await waitFor(() => expect(result.current?.state).toEqual(state));
  expect(saved).toHaveLength(0);
  act(() => result.current?.dispatch({ type: "activate", id: "changes" }));
  await waitFor(() => expect(saved).toHaveLength(1), { timeout: 1000 });
  expect(saved[0]).toEqual({ method: "saveTabs", state: { ...state, activeId: "changes" } });
});
```

Run: `bun test packages/ui/src/tabs`
Expected: FAIL (`TabBar`, `tab-title`, `use-tabs` absents).

`packages/ui/src/tabs/tab-title.ts` :
```ts
import type { ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import { FileCode, FolderKanban, GitCommitHorizontal, LayoutDashboard, type LucideIcon, Ticket } from "lucide-react";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";

export type TabDescription = { title: string; icon: LucideIcon; color: string | null; missing: boolean };
export type DescribeContext = { projects: ProjectSummary[]; snapshots: Map<string, ProjectSnapshot> };

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function describeTarget(target: TabTarget, ctx: DescribeContext): TabDescription {
  const project = ctx.projects.find((p) => p.id === target.projectId);
  if (!project) return { title: fr.tabs.missingProject, icon: FolderKanban, color: null, missing: true };
  const snapshot = ctx.snapshots.get(target.projectId);
  const color = project.color;
  const titled = (item: string) => fr.tabs.title(project.name, item);
  switch (target.kind) {
    case "project":
      return { title: project.name, icon: FolderKanban, color, missing: false };
    case "changes":
      return { title: titled(fr.tabs.changes), icon: GitCommitHorizontal, color, missing: false };
    case "file":
      return { title: basename(target.path), icon: FileCode, color, missing: false };
    case "page": {
      const page = snapshot?.pages.find((p) => p.id === target.pageId);
      if (!page) return { title: snapshot ? fr.tabs.missingPage : project.name, icon: LayoutDashboard, color, missing: !!snapshot };
      return { title: titled(page.title), icon: pageIcon(page, snapshot?.instances ?? []), color, missing: false };
    }
    case "ticket": {
      const ticket = snapshot?.tickets.find((t) => t.id === target.ticketId);
      if (!ticket) return { title: snapshot ? fr.tabs.missingTicket : project.name, icon: Ticket, color, missing: !!snapshot };
      return { title: titled(ticket.key), icon: Ticket, color, missing: false };
    }
  }
}
```

`packages/ui/src/tabs/use-tabs.ts` :
```ts
import { EMPTY_TABS, KiboError, type TabsState, type TabTarget } from "@kibo/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { type TabsAction, tabsReducer } from "./tabs-model";

export type TabsApi = {
  state: TabsState;
  error: string | null;
  dispatch(action: TabsAction): void;
  open(target: TabTarget | null, opts?: { newTab?: boolean }): void;
};

export function useTabs(): TabsApi | null {
  const [state, setState] = useState<TabsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getTabs" }).then(
      (s) => {
        if (!alive) return;
        lastSaved.current = JSON.stringify(s);
        setState(s);
      },
      (e: unknown) => {
        if (!alive || (e instanceof KiboError && e.code === "UNAUTHORIZED")) return;
        lastSaved.current = JSON.stringify(EMPTY_TABS);
        setState(EMPTY_TABS);
        setError(fr.tabs.loadFailed);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => {
      client.rpc({ method: "saveTabs", state }).then(
        () => {
          lastSaved.current = serialized;
          setError(null);
        },
        () => setError(fr.tabs.saveFailed),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const dispatch = useCallback((action: TabsAction) => setState((s) => (s ? tabsReducer(s, action) : s)), []);
  const open = useCallback(
    (target: TabTarget | null, opts: { newTab?: boolean } = {}) =>
      dispatch(
        target === null
          ? { type: "activate", id: null }
          : { type: "open", target, newTab: opts.newTab ?? false, id: crypto.randomUUID() },
      ),
    [dispatch],
  );
  return useMemo(() => (state ? { state, error, dispatch, open } : null), [state, error, dispatch, open]);
}
```

`packages/ui/src/tabs/TabBar.tsx` :
```tsx
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tab, TabsState, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@kibo/sdk/ui/context-menu";
import { AppWindow, Copy, Pin, PinOff, Plus, X } from "lucide-react";
import { fr } from "../i18n/fr";
import { KiboLogo } from "../shell/KiboLogo";
import type { TabDescription } from "./tab-title";
import type { TabsAction } from "./tabs-model";

type Props = {
  state: TabsState;
  describe(target: TabTarget): TabDescription;
  isDirty(target: TabTarget): boolean;
  dispatch(action: TabsAction): void;
  onNewTab(): void;
  onOpenWindow: ((target: TabTarget) => void) | null;
  error: string | null;
};

type ItemProps = {
  tab: Tab;
  active: boolean;
  description: TabDescription;
  dirty: boolean;
  dispatch(action: TabsAction): void;
  onOpenWindow: ((target: TabTarget) => void) | null;
};

function TabItem({ tab, active, description, dirty, dispatch, onOpenWindow }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const Icon = description.icon;
  const close = () => dispatch({ type: "close", id: tab.id });
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{ transform: CSS.Transform.toString(transform), transition }}
          className={cn(
            "group flex h-8 shrink-0 items-center rounded-md text-sm",
            active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-accent/60",
          )}
          onAuxClick={(e) => {
            if (e.button !== 1 || tab.pinned) return;
            e.preventDefault();
            close();
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={description.title}
            title={description.title}
            className="flex h-full items-center gap-2 px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => dispatch({ type: "activate", id: tab.id })}
            {...attributes}
            {...listeners}
          >
            {tab.pinned && (
              <span aria-hidden className="size-2 rounded-full" style={{ background: description.color ?? undefined }} />
            )}
            <Icon aria-hidden className="size-4 shrink-0" />
            {!tab.pinned && (
              <span className={cn("max-w-48 truncate", description.missing && "italic")}>{description.title}</span>
            )}
            {!tab.pinned && dirty && (
              <span role="img" aria-label={fr.tabs.dirty} className="size-1.5 shrink-0 rounded-full bg-orange-500" />
            )}
          </button>
          {!tab.pinned && (
            <button
              type="button"
              aria-label={fr.tabs.close(description.title)}
              className="mr-1 rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
              onClick={close}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={() => dispatch({ type: "pin", id: tab.id, pinned: !tab.pinned })}>
          {tab.pinned ? <PinOff /> : <Pin />}
          {tab.pinned ? fr.tabs.unpin : fr.tabs.pin}
          <ContextMenuShortcut>⌘⇧P</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => dispatch({ type: "duplicate", id: tab.id, newId: crypto.randomUUID() })}>
          <Copy />
          {fr.tabs.duplicate}
        </ContextMenuItem>
        {onOpenWindow && (
          <ContextMenuItem onSelect={() => onOpenWindow(tab.target)}>
            <AppWindow />
            {fr.tabs.newWindow}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={tab.pinned} onSelect={close}>
          <X />
          {fr.tabs.closeTab}
          <ContextMenuShortcut>⌘W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => dispatch({ type: "closeOthers", id: tab.id })}>
          <X />
          {fr.tabs.closeOthers}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => dispatch({ type: "closeRight", id: tab.id })}>
          <X />
          {fr.tabs.closeRight}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TabBar({ state, describe, isDirty, dispatch, onNewTab, onOpenWindow, error }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const pinned = state.tabs.filter((t) => t.pinned);
  const open = state.tabs.filter((t) => !t.pinned);
  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (overId === undefined || overId === e.active.id) return;
    dispatch({ type: "move", id: String(e.active.id), toIndex: state.tabs.findIndex((t) => t.id === overId) });
  };
  const item = (tab: Tab) => (
    <TabItem
      key={tab.id}
      tab={tab}
      active={state.activeId === tab.id}
      description={describe(tab.target)}
      dirty={isDirty(tab.target)}
      dispatch={dispatch}
      onOpenWindow={onOpenWindow}
    />
  );
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-sidebar px-2">
      <div role="tablist" aria-label={fr.tabs.bar} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={state.activeId === null}
          aria-label={fr.tabs.home}
          title={fr.tabs.home}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            state.activeId === null ? "bg-background shadow-xs" : "hover:bg-accent/60",
          )}
          onClick={() => dispatch({ type: "activate", id: null })}
        >
          <KiboLogo className="size-4" decorative />
        </button>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={pinned.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            {pinned.map(item)}
          </SortableContext>
          {pinned.length > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
          <SortableContext items={open.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            {open.map(item)}
          </SortableContext>
        </DndContext>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={fr.tabs.newTab} onClick={onNewTab}>
          <Plus />
        </Button>
      </div>
      {error && (
        <p role="alert" className="shrink-0 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 4: Lancer les tests**

Run: `bun test packages/ui/src/tabs && bun run check`
Expected: PASS. Si Radix n'ouvre pas le menu contextuel sous happy-dom avec `fireEvent.contextMenu`, déclencher `fireEvent.pointerDown(el, { button: 2, pointerType: "mouse" })` puis `fireEvent.contextMenu(el)` ; ne pas supprimer le test.

- [x] **Step 5: Commit**

```bash
git add packages/ui/src/tabs
git commit -m "feat(ui): barre d'onglets et persistance"
```

---

### Task 10: Palette ⌘K

Écran 18 (PDF page 28). Sections Tickets (pastille de statut, clé · titre, statut à droite, « + n autres : … »), Actions (icône, libellé, raccourci), pied de page d'aide ; recherche sur les pages, projets et récents (spec §8).

**Files:**
- Create: `packages/ui/src/palette/palette-items.ts`, `packages/ui/src/palette/CommandPalette.tsx`, `packages/ui/src/palette/palette.test.tsx`, `packages/ui/src/theme.test.ts`
- Modify: `packages/ui/src/theme.ts`

**Interfaces:**
- Consumes: `ProjectSummary`, `ProjectSnapshot`, `TabTarget`, `StatusId` ; `Command*`, `Dialog*` ; `StatusDot` (`@kibo/sdk`) ; `fr.palette`.
- Produces :
  - `type PaletteAction = { kind: "newTicket"; projectId: string; parentId: string | null } | { kind: "newPage"; projectId: string } | { kind: "newProject" } | { kind: "toggleTheme" }` ;
  - `type PaletteContext = { projects: ProjectSummary[]; snapshots: Map<string, ProjectSnapshot>; recents: TabTarget[]; activeProjectId: string | null; activeTicketId: string | null }` ;
  - `type PaletteFilter = "all" | "tickets" | "pages" | "projects" | "actions"`, `buildItems(ctx: PaletteContext): PaletteItem[]`, `searchItems(items: PaletteItem[], query: string, filter: PaletteFilter): PaletteSection[]` ;
  - `CommandPalette(props: { open: boolean; onOpenChange(open: boolean): void; newTab: boolean; context: PaletteContext; onOpenTarget(target: TabTarget, newTab: boolean): void; onOpenTicketSheet(projectId: string, ticketId: string): void; onAction(action: PaletteAction): void })` ;
  - `theme.ts` : `type ThemePreference = "system" | "light" | "dark"`, `nextTheme(p): ThemePreference`, `readThemePreference(): ThemePreference`, `cycleTheme(): ThemePreference`, `followSystemTheme(): void` (existant, respecte désormais la préférence).

- [x] **Step 1: Tests**

`packages/ui/src/palette/palette.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type ProjectSummary, type TicketView } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const ticket = (n: number, title: string, statusId: TicketView["statusId"] = "in_progress"): TicketView => ({
  id: `${n}@1`,
  key: `KIB-${n}`,
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
const summary: ProjectSummary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const snapshot: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@9", title: "Kanban", kind: "view", parentId: null }],
  tickets: [
    ticket(12, "Schéma Loro des tickets (LoroTree)"),
    ticket(14, "Récepteur de hooks Claude Code"),
    ticket(16, "Moteur de règles déclaratif"),
    ticket(18, "Adaptateur GitHub Issues", "todo"),
    ticket(10, "Watcher git et gh"),
    ticket(11, "Démon : auth par jeton local", "in_review"),
    ticket(2, "Graphe"),
  ],
  links: [],
  instances: [],
  nextTicketKey: "KIB-19",
};
const context: PaletteContext = {
  projects: [summary],
  snapshots: new Map([["p1", snapshot]]),
  recents: [{ kind: "page", projectId: "p1", pageId: "1@9" }],
  activeProjectId: "p1",
  activeTicketId: "12@1",
};

test("tickets are capped at four with a summary of the others", () => {
  const sections = searchItems(buildItems(context), "kib-1", "all");
  const tickets = sections.find((s) => s.group === "tickets");
  expect(tickets?.items.map((i) => i.label)).toEqual([
    "KIB-12 · Schéma Loro des tickets (LoroTree)",
    "KIB-14 · Récepteur de hooks Claude Code",
    "KIB-16 · Moteur de règles déclaratif",
    "KIB-18 · Adaptateur GitHub Issues",
  ]);
  expect(tickets?.more).toEqual(["KIB-10", "KIB-11"]);
});

test("search ignores accents, the filter narrows groups and lifts the cap", () => {
  expect(searchItems(buildItems(context), "recepteur", "all").find((s) => s.group === "tickets")?.items).toHaveLength(1);
  const onlyTickets = searchItems(buildItems(context), "kib-1", "tickets");
  expect(onlyTickets.map((s) => s.group)).toEqual(["tickets"]);
  expect(onlyTickets[0]?.items).toHaveLength(6);
  expect(searchItems(buildItems(context), "kanban", "all").map((s) => s.group)).toEqual(["pages"]);
});

test("an empty query shows recents, projects and contextual actions", () => {
  const sections = searchItems(buildItems(context), "", "all");
  expect(sections.map((s) => s.group)).toEqual(["recents", "projects", "actions"]);
  expect(sections[0]?.items[0]?.label).toBe("Kibo · Kanban");
  expect(sections[2]?.items.map((i) => i.label)).toEqual([
    "Nouveau ticket",
    "Créer un sous-ticket de KIB-12",
    "Nouvelle page",
    "Voir les changements de Kibo",
    "Nouveau projet",
    "Basculer le thème (système / clair / sombre)",
  ]);
});

test("Enter opens a target, ⌘Enter opens the ticket sheet, Tab cycles the filter", async () => {
  const opened: unknown[] = [];
  const sheets: string[] = [];
  const actions: unknown[] = [];
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={(t, newTab) => opened.push({ t, newTab })}
      onOpenTicketSheet={(_, id) => sheets.push(id)}
      onAction={(a) => actions.push(a)}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Palette de commandes" });
  const input = within(dialog).getByRole("combobox");
  await userEvent.type(input, "kib-12");
  await userEvent.keyboard("{Enter}");
  expect(opened).toEqual([{ t: { kind: "ticket", projectId: "p1", ticketId: "12@1" }, newTab: false }]);
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  expect(sheets).toEqual(["12@1"]);
  await userEvent.clear(input);
  await userEvent.keyboard("{Tab}");
  expect(within(dialog).getByText("Tickets", { selector: "[data-filter]" })).toBeTruthy();
});
```

`packages/ui/src/theme.test.ts` :
```ts
import { beforeEach, expect, test } from "bun:test";
import { cycleTheme, nextTheme, readThemePreference } from "./theme";

beforeEach(() => localStorage.clear());

test("the theme cycles system → light → dark and is remembered", () => {
  expect(nextTheme("system")).toBe("light");
  expect(nextTheme("light")).toBe("dark");
  expect(nextTheme("dark")).toBe("system");
  expect(readThemePreference()).toBe("system");
  expect(cycleTheme()).toBe("light");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(cycleTheme()).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(readThemePreference()).toBe("dark");
});
```

Run: `bun test packages/ui/src/palette packages/ui/src/theme.test.ts`
Expected: FAIL, modules et fonctions introuvables.

- [x] **Step 2: Implémenter le thème**

`packages/ui/src/theme.ts` :
```ts
export type ThemePreference = "system" | "light" | "dark";

const KEY = "kibo.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export const nextTheme = (p: ThemePreference): ThemePreference =>
  p === "system" ? "light" : p === "light" ? "dark" : "system";

export function readThemePreference(): ThemePreference {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function apply(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  if (next === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, next);
  apply(next);
  return next;
}

export function followSystemTheme(): void {
  apply(readThemePreference());
  media().addEventListener("change", () => apply(readThemePreference()));
}
```

- [x] **Step 3: Implémenter les éléments de la palette**

`packages/ui/src/palette/palette-items.ts` :
```ts
import type { ProjectSnapshot, ProjectSummary, StatusId, TabTarget } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { targetToHash } from "../tabs/target-hash";

export type PaletteGroup = "recents" | "tickets" | "pages" | "projects" | "actions";
export type PaletteFilter = "all" | "tickets" | "pages" | "projects" | "actions";
export const FILTERS: PaletteFilter[] = ["all", "tickets", "pages", "projects", "actions"];

export type PaletteAction =
  | { kind: "newTicket"; projectId: string; parentId: string | null }
  | { kind: "newPage"; projectId: string }
  | { kind: "newProject" }
  | { kind: "toggleTheme" };

export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  keywords: string;
  detail: string | null;
  statusId: StatusId | null;
  color: string | null;
  icon: "ticket" | "page" | "project" | "changes" | "new" | "theme";
  run: { kind: "target"; target: TabTarget } | { kind: "action"; action: PaletteAction };
  ticket: { projectId: string; ticketId: string; key: string } | null;
};
export type PaletteSection = { group: PaletteGroup; items: PaletteItem[]; more: string[] };
export type PaletteContext = {
  projects: ProjectSummary[];
  snapshots: Map<string, ProjectSnapshot>;
  recents: TabTarget[];
  activeProjectId: string | null;
  activeTicketId: string | null;
};

const TICKET_CAP = 4;
export const normalize = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const base = { detail: null, statusId: null, color: null, ticket: null };

function targets(ctx: PaletteContext): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const project of ctx.projects) {
    const snapshot = ctx.snapshots.get(project.id);
    out.push({
      ...base,
      id: `project:${project.id}`,
      group: "projects",
      label: project.name,
      keywords: normalize(`${project.name} ${project.key}`),
      color: project.color,
      icon: "project",
      run: { kind: "target", target: { kind: "project", projectId: project.id } },
    });
    for (const page of snapshot?.pages ?? []) {
      out.push({
        ...base,
        id: `page:${project.id}:${page.id}`,
        group: "pages",
        label: fr.tabs.title(project.name, page.title),
        keywords: normalize(`${page.title} ${project.name}`),
        icon: "page",
        run: { kind: "target", target: { kind: "page", projectId: project.id, pageId: page.id } },
      });
    }
    for (const t of snapshot?.tickets ?? []) {
      out.push({
        ...base,
        id: `ticket:${project.id}:${t.id}`,
        group: "tickets",
        label: `${t.key} · ${t.title}`,
        keywords: normalize(`${t.key} ${t.title} ${project.name}`),
        detail: snapshot?.workflow.find((s) => s.id === t.statusId)?.label ?? null,
        statusId: t.statusId,
        icon: "ticket",
        run: { kind: "target", target: { kind: "ticket", projectId: project.id, ticketId: t.id } },
        ticket: { projectId: project.id, ticketId: t.id, key: t.key },
      });
    }
  }
  return out;
}

function actions(ctx: PaletteContext): PaletteItem[] {
  const project = ctx.projects.find((p) => p.id === ctx.activeProjectId);
  const ticket = project ? ctx.snapshots.get(project.id)?.tickets.find((t) => t.id === ctx.activeTicketId) : undefined;
  const action = (id: string, label: string, icon: PaletteItem["icon"], run: PaletteItem["run"]): PaletteItem => ({
    ...base,
    id: `action:${id}`,
    group: "actions",
    label,
    keywords: normalize(label),
    icon,
    run,
  });
  const out: PaletteItem[] = [];
  if (project) {
    out.push(action("newTicket", fr.palette.newTicket, "new", { kind: "action", action: { kind: "newTicket", projectId: project.id, parentId: null } }));
    if (ticket)
      out.push(
        action("newSubTicket", fr.palette.newSubTicket(ticket.key), "new", {
          kind: "action",
          action: { kind: "newTicket", projectId: project.id, parentId: ticket.id },
        }),
      );
    out.push(action("newPage", fr.palette.newPage, "new", { kind: "action", action: { kind: "newPage", projectId: project.id } }));
    if (project.folder)
      out.push(
        action("changes", fr.palette.openChanges(project.name), "changes", {
          kind: "target",
          target: { kind: "changes", projectId: project.id, worktree: null },
        }),
      );
  }
  out.push(action("newProject", fr.palette.newProject, "new", { kind: "action", action: { kind: "newProject" } }));
  out.push(action("theme", fr.palette.toggleTheme, "theme", { kind: "action", action: { kind: "toggleTheme" } }));
  return out;
}

export function buildItems(ctx: PaletteContext): PaletteItem[] {
  const all = [...targets(ctx), ...actions(ctx)];
  const byHash = new Map(
    all.flatMap((i) => (i.run.kind === "target" ? [[targetToHash(i.run.target), i] as const] : [])),
  );
  const recents = ctx.recents.flatMap((r) => {
    const item = byHash.get(targetToHash(r));
    return item ? [{ ...item, id: `recent:${item.id}`, group: "recents" as const }] : [];
  });
  return [...recents, ...all];
}

const ORDER: PaletteGroup[] = ["recents", "tickets", "pages", "projects", "actions"];

export function searchItems(items: PaletteItem[], query: string, filter: PaletteFilter): PaletteSection[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const visible = (group: PaletteGroup) =>
    filter === "all" ? (tokens.length > 0 ? group !== "recents" : group !== "tickets" && group !== "pages") : group === filter;
  const matched = items.filter((i) => visible(i.group) && tokens.every((t) => i.keywords.includes(t)));
  const needle = tokens.join(" ");
  const score = (i: PaletteItem) => (i.ticket && normalize(i.ticket.key) === needle ? 0 : i.keywords.startsWith(needle) ? 1 : 2);
  return ORDER.flatMap((group) => {
    const all = matched.filter((i) => i.group === group).sort((a, b) => score(a) - score(b));
    if (all.length === 0) return [];
    const capped = group === "tickets" && filter === "all" ? all.slice(0, TICKET_CAP) : all;
    const more = all.slice(capped.length).flatMap((i) => (i.ticket ? [i.ticket.key] : []));
    return [{ group, items: capped, more }];
  });
}
```

- [x] **Step 4: Implémenter le composant**

`packages/ui/src/palette/CommandPalette.tsx` :
```tsx
import type { TabTarget } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@kibo/sdk/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { FileText, FolderKanban, GitCommitHorizontal, Plus, SunMoon, Ticket } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { fr } from "../i18n/fr";
import { buildItems, FILTERS, type PaletteAction, type PaletteContext, type PaletteFilter, type PaletteItem, searchItems } from "./palette-items";

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
  newTab: boolean;
  context: PaletteContext;
  onOpenTarget(target: TabTarget, newTab: boolean): void;
  onOpenTicketSheet(projectId: string, ticketId: string): void;
  onAction(action: PaletteAction): void;
};

const ICONS = { ticket: Ticket, page: FileText, project: FolderKanban, changes: GitCommitHorizontal, new: Plus, theme: SunMoon };
const FILTER_LABEL: Record<PaletteFilter, string> = {
  all: fr.palette.all,
  tickets: fr.palette.tickets,
  pages: fr.palette.pages,
  projects: fr.palette.projects,
  actions: fr.palette.actions,
};

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}

function Row({ item }: { item: PaletteItem }) {
  const Icon = ICONS[item.icon];
  return (
    <>
      {item.statusId ? <StatusDot statusId={item.statusId} /> : <Icon aria-hidden className="size-4" />}
      <span className="truncate">{item.label}</span>
      {item.detail && <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>}
    </>
  );
}

export function CommandPalette({ open, onOpenChange, newTab, context, onOpenTarget, onOpenTicketSheet, onAction }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const [value, setValue] = useState("");
  const items = useMemo(() => buildItems(context), [context]);
  const sections = useMemo(() => searchItems(items, query, filter), [items, query, filter]);
  const byId = useMemo(() => new Map(sections.flatMap((s) => s.items).map((i) => [i.id, i])), [sections]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setFilter("all");
  }, [open]);

  const run = (item: PaletteItem, sheet: boolean) => {
    onOpenChange(false);
    if (item.run.kind === "action") onAction(item.run.action);
    else if (sheet && item.ticket) onOpenTicketSheet(item.ticket.projectId, item.ticket.ticketId);
    else onOpenTarget(item.run.target, newTab);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const step = e.shiftKey ? FILTERS.length - 1 : 1;
      setFilter((f) => FILTERS[(FILTERS.indexOf(f) + step) % FILTERS.length] ?? "all");
      return;
    }
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    const item = byId.get(value);
    if (!item?.ticket) return;
    e.preventDefault();
    run(item, true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogTitle className="sr-only">{fr.palette.label}</DialogTitle>
        <DialogDescription className="sr-only">{fr.palette.placeholder}</DialogDescription>
        <Command shouldFilter={false} value={value} onValueChange={setValue} onKeyDown={onKeyDown} label={fr.palette.label}>
          <div className="flex items-center gap-2 border-b pr-3">
            <CommandInput className="h-12" value={query} onValueChange={setQuery} placeholder={fr.palette.placeholder} />
            {filter !== "all" && (
              <span data-filter className="rounded border px-1.5 text-xs text-muted-foreground">
                {FILTER_LABEL[filter]}
              </span>
            )}
            <Kbd>{fr.palette.esc}</Kbd>
          </div>
          <CommandList className="max-h-[480px]">
            <CommandEmpty>{fr.palette.empty}</CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.group} heading={fr.palette[section.group]}>
                {section.items.map((item) => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => run(item, false)}>
                    <Row item={item} />
                  </CommandItem>
                ))}
                {section.more.length > 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {fr.palette.more(section.more.length, section.more.join(", "))}
                  </p>
                )}
              </CommandGroup>
            ))}
          </CommandList>
          <footer className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd>
              {fr.palette.hintNavigate}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {fr.palette.hintOpen}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>⌘↵</Kbd>
              {fr.palette.hintSheet}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>tab</Kbd>
              {fr.palette.hintFilter}
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```
Si `CommandInput` de shadcn n'accepte pas `className` sur la racine attendue, envelopper l'input dans le `div` fourni et laisser la classe par défaut ; la hauteur visée est 48 px (maquette).

- [x] **Step 5: Lancer les tests**

Run: `bun test packages/ui/src/palette packages/ui/src/theme.test.ts && bun run check`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/ui/src/palette packages/ui/src/theme.ts packages/ui/src/theme.test.ts
git commit -m "feat(ui): palette de commandes"
```

---

### Task 11: Liste des fichiers et diff

Écran 21 (PDF page 34), colonne gauche et centre en mode lecture : sections « INDEXÉS n » / « NON INDEXÉS n » repliables, case à cocher, lettre `M/A/D/R` colorée, nom et dossier, `+a −d` ; barre du diff (chemin cliquable, `+42 −8`, bascule Unifié / Côte à côte, bouton Édition, ouverture externe) ; blocs `@@` avec « Indexer le bloc ».

**Files:**
- Create: `packages/ui/src/code/diff-rows.ts`, `packages/ui/src/code/DiffView.tsx`, `packages/ui/src/code/DiffToolbar.tsx`, `packages/ui/src/code/FileList.tsx`, `packages/ui/src/code/diff.test.tsx`

**Interfaces:**
- Consumes: `FileDiff`, `Hunk`, `DiffLine`, `FileChange`, `ChangeArea` (tâche 1) ; `ToggleGroup`, `Toggle`, `Checkbox` (tâche 2) ; `fr.changes`.
- Produces :
  - `type SplitRow = { left: DiffLine | null; right: DiffLine | null }`, `splitRows(hunk: Hunk): SplitRow[]` ;
  - `type DiffMode = "unified" | "split"` ;
  - `DiffView(props: { diff: FileDiff; area: ChangeArea; mode: DiffMode; busy: boolean; onHunk(index: number, header: string): void })` ;
  - `DiffToolbar(props: { path: string; additions: number; deletions: number; mode: DiffMode; onModeChange(m: DiffMode): void; editing: boolean; onEditingChange(e: boolean): void; canEdit: boolean; onOpenFile(): void; onOpenExternal(): void })` ;
  - `type FileSelection = { path: string; area: ChangeArea }` ; `FileList(props: { files: FileChange[]; selected: FileSelection | null; busy: boolean; onSelect(f: FileChange): void; onToggle(f: FileChange): void })`.

- [x] **Step 1: Tests**

`packages/ui/src/code/diff.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import type { FileChange, FileDiff, Hunk } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { splitRows } from "./diff-rows";
import { DiffToolbar } from "./DiffToolbar";
import { DiffView } from "./DiffView";
import { FileList } from "./FileList";

const hunk: Hunk = {
  header: "@@ -38,3 +38,4 @@ export const TicketSchema",
  oldStart: 38,
  oldLines: 3,
  newStart: 38,
  newLines: 4,
  section: "export const TicketSchema",
  lines: [
    { kind: "context", text: "export const TicketSchema = z.object({", oldNo: 38, newNo: 38, noEol: false },
    { kind: "del", text: "  parentId: z.string().nullable(),", oldNo: 39, newNo: null, noEol: false },
    { kind: "add", text: "  key: z.string(),", oldNo: null, newNo: 39, noEol: false },
    { kind: "add", text: "  statusId: z.string(),", oldNo: null, newNo: 40, noEol: false },
    { kind: "context", text: "});", oldNo: 40, newNo: 41, noEol: false },
  ],
};
const diff: FileDiff = { path: "packages/core/ticket.ts", origPath: null, binary: false, hunkStaging: true, additions: 2, deletions: 1, hunks: [hunk] };

test("splitRows pairs deletions with additions and repeats context", () => {
  expect(splitRows(hunk).map((r) => [r.left?.oldNo ?? null, r.right?.newNo ?? null])).toEqual([
    [38, 38],
    [39, 39],
    [null, 40],
    [40, 41],
  ]);
});

test("the unified diff shows numbers and signs, the hunk button stages", async () => {
  const hunks: [number, string][] = [];
  render(<DiffView diff={diff} area="unstaged" mode="unified" busy={false} onHunk={(i, h) => hunks.push([i, h])} />);
  const section = screen.getByRole("region", { name: hunk.header });
  expect(within(section).getByText("  key: z.string(),")).toBeTruthy();
  await userEvent.click(within(section).getByRole("button", { name: "Indexer le bloc" }));
  expect(hunks).toEqual([[0, hunk.header]]);
});

test("staged diffs offer to unstage, binary files and whole-file-only diffs hide the hunk action", () => {
  const { rerender } = render(<DiffView diff={diff} area="staged" mode="split" busy={false} onHunk={() => {}} />);
  expect(screen.getByRole("button", { name: "Désindexer le bloc" })).toBeTruthy();
  rerender(<DiffView diff={{ ...diff, hunkStaging: false }} area="unstaged" mode="unified" busy={false} onHunk={() => {}} />);
  expect(screen.queryByRole("button", { name: "Indexer le bloc" })).toBeNull();
  rerender(<DiffView diff={{ ...diff, binary: true, hunks: [] }} area="unstaged" mode="unified" busy={false} onHunk={() => {}} />);
  expect(screen.getByText("Fichier binaire : aucun diff à afficher.")).toBeTruthy();
});

test("the toolbar switches modes, toggles editing and opens the file", async () => {
  const events: string[] = [];
  render(
    <DiffToolbar
      path="packages/core/ticket.ts"
      additions={42}
      deletions={8}
      mode="unified"
      onModeChange={(m) => events.push(m)}
      editing={false}
      onEditingChange={(e) => events.push(`edit:${e}`)}
      canEdit
      onOpenFile={() => events.push("file")}
      onOpenExternal={() => events.push("external")}
    />,
  );
  await userEvent.click(screen.getByRole("radio", { name: "Côte à côte" }));
  await userEvent.click(screen.getByRole("button", { name: "Édition" }));
  await userEvent.click(screen.getByRole("button", { name: "packages/core/ticket.ts" }));
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir dans l'éditeur externe" }));
  expect(events).toEqual(["split", "edit:true", "file", "external"]);
  expect(screen.getByText("+42")).toBeTruthy();
});

test("the file list groups by area and toggles staging per file", async () => {
  const files: FileChange[] = [
    { path: "packages/core/ticket.ts", origPath: null, area: "staged", kind: "modified", additions: 42, deletions: 8 },
    { path: "packages/core/tree.ts", origPath: null, area: "staged", kind: "added", additions: 120, deletions: 0 },
    { path: "packages/core/index.ts", origPath: null, area: "unstaged", kind: "modified", additions: 3, deletions: 1 },
    { path: "packages/core/legacy-tree.ts", origPath: null, area: "unstaged", kind: "deleted", additions: 0, deletions: 56 },
  ];
  const toggled: string[] = [];
  const selected: string[] = [];
  render(
    <FileList
      files={files}
      selected={{ path: "packages/core/ticket.ts", area: "staged" }}
      busy={false}
      onSelect={(f) => selected.push(`${f.area}:${f.path}`)}
      onToggle={(f) => toggled.push(`${f.area}:${f.path}`)}
    />,
  );
  const staged = screen.getByRole("group", { name: "Indexés" });
  expect(within(staged).getAllByRole("checkbox")).toHaveLength(2);
  expect(within(staged).getByRole("checkbox", { name: "Désindexer packages/core/ticket.ts" }).getAttribute("aria-checked")).toBe("true");
  await userEvent.click(screen.getByRole("checkbox", { name: "Indexer packages/core/index.ts" }));
  await userEvent.click(screen.getByRole("button", { name: /legacy-tree\.ts/ }));
  expect(toggled).toEqual(["unstaged:packages/core/index.ts"]);
  expect(selected).toEqual(["unstaged:packages/core/legacy-tree.ts"]);
  await userEvent.click(screen.getByRole("button", { name: /Indexés/ }));
  expect(within(staged).queryAllByRole("checkbox")).toHaveLength(0);
});
```

Run: `bun test packages/ui/src/code/diff.test.tsx`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter**

`packages/ui/src/code/diff-rows.ts` :
```ts
import type { DiffLine, Hunk } from "@kibo/schema";

export type SplitRow = { left: DiffLine | null; right: DiffLine | null };

export function splitRows(hunk: Hunk): SplitRow[] {
  const rows: SplitRow[] = [];
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ left: dels[i] ?? null, right: adds[i] ?? null });
    dels = [];
    adds = [];
  };
  for (const line of hunk.lines) {
    if (line.kind === "del") dels.push(line);
    else if (line.kind === "add") adds.push(line);
    else {
      flush();
      rows.push({ left: line, right: line });
    }
  }
  flush();
  return rows;
}
```

`packages/ui/src/code/DiffView.tsx` :
```tsx
import type { ChangeArea, DiffLine, FileDiff, Hunk } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "../i18n/fr";
import { splitRows } from "./diff-rows";

export type DiffMode = "unified" | "split";

const TONE: Record<DiffLine["kind"], string> = {
  add: "bg-green-500/10 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  del: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  context: "",
};
const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "-", context: "" };

const lineKey = (l: DiffLine) => `${l.kind}:${l.oldNo ?? ""}:${l.newNo ?? ""}`;

function UnifiedHunk({ hunk }: { hunk: Hunk }) {
  return (
    <div role="table">
      {hunk.lines.map((l) => (
        <div role="row" key={lineKey(l)} className={cn("grid grid-cols-[3.5rem_3.5rem_1.5rem_1fr]", TONE[l.kind])}>
          <span className="pr-3 text-right text-muted-foreground">{l.oldNo ?? ""}</span>
          <span className="pr-3 text-right text-muted-foreground">{l.newNo ?? ""}</span>
          <span aria-hidden>{SIGN[l.kind]}</span>
          <span className="whitespace-pre">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

function Half({ line, side }: { line: DiffLine | null; side: "old" | "new" }) {
  if (!line) return <div className="bg-muted/40" />;
  const no = side === "old" ? line.oldNo : line.newNo;
  return (
    <div className={cn("grid min-w-0 grid-cols-[3.5rem_1.5rem_1fr]", TONE[line.kind])}>
      <span className="pr-3 text-right text-muted-foreground">{no ?? ""}</span>
      <span aria-hidden>{SIGN[line.kind]}</span>
      <span className="overflow-hidden whitespace-pre">{line.text}</span>
    </div>
  );
}

function SplitHunk({ hunk }: { hunk: Hunk }) {
  return (
    <div role="table">
      {splitRows(hunk).map((r) => (
        <div role="row" key={`${r.left ? lineKey(r.left) : "-"}|${r.right ? lineKey(r.right) : "-"}`} className="grid grid-cols-2 divide-x">
          <Half line={r.left} side="old" />
          <Half line={r.right} side="new" />
        </div>
      ))}
    </div>
  );
}

type Props = { diff: FileDiff; area: ChangeArea; mode: DiffMode; busy: boolean; onHunk(index: number, header: string): void };

export function DiffView({ diff, area, mode, busy, onHunk }: Props) {
  if (diff.binary) return <p className="p-6 text-sm text-muted-foreground">{fr.changes.binary}</p>;
  const label = area === "unstaged" ? fr.changes.stageHunk : fr.changes.unstageHunk;
  return (
    <div className="min-w-0 flex-1 overflow-auto font-mono text-[13px] leading-6">
      {diff.hunks.map((hunk, index) => (
        <section key={hunk.header} aria-label={hunk.header}>
          <header className="sticky top-0 z-10 flex h-7 items-center justify-between gap-4 bg-muted px-4 text-xs text-muted-foreground">
            <span className="truncate">{hunk.header}</span>
            {diff.hunkStaging && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={busy} onClick={() => onHunk(index, hunk.header)}>
                {label}
              </Button>
            )}
          </header>
          {mode === "unified" ? <UnifiedHunk hunk={hunk} /> : <SplitHunk hunk={hunk} />}
        </section>
      ))}
    </div>
  );
}
```
(La clé `hunk.header` est unique dans un fichier : deux blocs ne commencent jamais aux mêmes lignes.)

`packages/ui/src/code/DiffToolbar.tsx` :
```tsx
import { Toggle } from "@kibo/sdk/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Button } from "@kibo/sdk/ui/button";
import { ExternalLink, FileCode, Pencil } from "lucide-react";
import { fr } from "../i18n/fr";
import type { DiffMode } from "./DiffView";

type Props = {
  path: string;
  additions: number;
  deletions: number;
  mode: DiffMode;
  onModeChange(mode: DiffMode): void;
  editing: boolean;
  onEditingChange(editing: boolean): void;
  canEdit: boolean;
  onOpenFile(): void;
  onOpenExternal(): void;
};

export function DiffToolbar(p: Props) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <FileCode aria-hidden className="size-4 text-sky-600 dark:text-sky-400" />
      <button type="button" className="truncate font-mono text-sm text-sky-700 hover:underline dark:text-sky-400" onClick={p.onOpenFile}>
        {p.path}
      </button>
      <span className="font-mono text-xs text-muted-foreground">
        <span>+{p.additions}</span> <span>−{p.deletions}</span>
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={fr.changes.viewMode}
        className="ml-auto"
        value={p.mode}
        onValueChange={(v) => {
          if (v === "unified" || v === "split") p.onModeChange(v);
        }}
      >
        <ToggleGroupItem value="unified">{fr.changes.unified}</ToggleGroupItem>
        <ToggleGroupItem value="split">{fr.changes.split}</ToggleGroupItem>
      </ToggleGroup>
      <Toggle
        size="sm"
        variant="outline"
        pressed={p.editing}
        disabled={!p.canEdit}
        onPressedChange={p.onEditingChange}
        className="data-[state=on]:border-orange-500 data-[state=on]:bg-orange-500/15 data-[state=on]:text-orange-700 dark:data-[state=on]:text-orange-300"
      >
        <Pencil />
        {fr.changes.edit}
      </Toggle>
      <Button variant="ghost" size="icon" aria-label={fr.changes.openExternal} title={fr.changes.openExternal} onClick={p.onOpenExternal}>
        <ExternalLink />
      </Button>
    </div>
  );
}
```
Le texte `+42` doit être un nœud à part (le test le cherche tel quel).

`packages/ui/src/code/FileList.tsx` :
```tsx
import type { ChangeArea, ChangeKind, FileChange } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";

export type FileSelection = { path: string; area: ChangeArea };
type Props = {
  files: FileChange[];
  selected: FileSelection | null;
  busy: boolean;
  onSelect(file: FileChange): void;
  onToggle(file: FileChange): void;
};

const KIND_TONE: Record<ChangeKind, string> = {
  modified: "text-amber-600 dark:text-amber-400",
  added: "text-green-700 dark:text-green-400",
  untracked: "text-green-700 dark:text-green-400",
  deleted: "text-red-600 dark:text-red-400",
  renamed: "text-sky-700 dark:text-sky-400",
  conflicted: "text-red-600 dark:text-red-400",
};

const split = (path: string) => {
  const slash = path.lastIndexOf("/");
  return { name: path.slice(slash + 1), dir: slash >= 0 ? path.slice(0, slash + 1) : "" };
};

function Row({ file, active, busy, onSelect, onToggle }: { file: FileChange; active: boolean; busy: boolean } & Pick<Props, "onSelect" | "onToggle">) {
  const { name, dir } = split(file.path);
  const staged = file.area === "staged";
  return (
    <li className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", active && "bg-accent")}>
      <Checkbox
        checked={staged}
        disabled={busy || file.kind === "conflicted"}
        aria-label={staged ? fr.changes.unstageFile(file.path) : fr.changes.stageFile(file.path)}
        onCheckedChange={() => onToggle(file)}
      />
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(file)}>
        <span aria-hidden className={cn("w-3 font-mono text-xs font-semibold", KIND_TONE[file.kind])}>
          {fr.changes.kind[file.kind]}
        </span>
        <span className="sr-only">{fr.changes.kindLabel[file.kind]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm">{name}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">{dir}</span>
        </span>
        <span className="font-mono text-xs">
          {file.additions ? <span className="text-green-700 dark:text-green-400">+{file.additions}</span> : null}{" "}
          {file.deletions ? <span className="text-red-600 dark:text-red-400">−{file.deletions}</span> : null}
        </span>
      </button>
    </li>
  );
}

function Section({ area, title, files, ...rest }: { area: ChangeArea; title: string; files: FileChange[] } & Omit<Props, "files">) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        <span id={id}>{title}</span>
        <span className="ml-auto">{files.length}</span>
      </button>
      {open && (
        <ul className="grid gap-0.5">
          {files.map((f) => (
            <Row
              key={`${area}:${f.path}`}
              file={f}
              active={rest.selected?.path === f.path && rest.selected.area === area}
              busy={rest.busy}
              onSelect={rest.onSelect}
              onToggle={rest.onToggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function FileList(props: Props) {
  const staged = props.files.filter((f) => f.area === "staged");
  const unstaged = props.files.filter((f) => f.area === "unstaged");
  return (
    <div className="grid gap-2">
      <Section area="staged" title={fr.changes.staged} {...props} files={staged} />
      <Section area="unstaged" title={fr.changes.unstaged} {...props} files={unstaged} />
    </div>
  );
}
```
Le groupe prend son nom du seul titre (`aria-labelledby` pointe vers le `span` du titre, pas vers le compteur).

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/ui/src/code/diff.test.tsx && bun run check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/ui/src/code/diff-rows.ts packages/ui/src/code/DiffView.tsx packages/ui/src/code/DiffToolbar.tsx packages/ui/src/code/FileList.tsx packages/ui/src/code/diff.test.tsx
git commit -m "feat(ui): diff unifié et côte à côte"
```

---

### Task 12: Liens de fichiers, aperçu (Shiki) et éditeur (CodeMirror)

Écran 23 (PDF page 36) : Sheet de la moitié de la largeur ; en-tête `packages/core/` + `ticket.ts`, boutons « Ouvrir dans un onglet », « Modifier », éditeur externe (icône terminal), fermer ; sous-ligne « Ouvert depuis KIB-12 · PostToolUse Edit » puis « worktree kib-12 · TypeScript · 112 lignes · modifié il y a 8 min · non commité » ; code numéroté, ligne visée surlignée ; pied « Ligne 43, col 3 » et « ⌘⇧O ouvrir dans l'éditeur externe · Esc fermer ».

**Files:**
- Create: `packages/sdk/src/file-link.tsx`, `packages/sdk/src/file-link.test.tsx`, `packages/ui/src/code/use-worktrees.ts`, `packages/ui/src/files/language.ts`, `packages/ui/src/files/highlight.ts`, `packages/ui/src/files/use-file-content.ts`, `packages/ui/src/files/CodeLines.tsx`, `packages/ui/src/files/CodeEditor.tsx`, `packages/ui/src/files/FilePreviewSheet.tsx`, `packages/ui/src/files/FileTabView.tsx`, `packages/ui/src/files/files.test.tsx`, `packages/ui/src/lib/relative-time.ts`, `packages/ui/src/lib/relative-time.test.ts`
- Modify: `packages/sdk/src/index.ts`, `packages/ui/src/index.css`

**Interfaces:**
- Consumes: `FileRef`, `FileContent`, `Worktree`, `client.code` (tâche 1) ; `Sheet*`, `Button` ; `fr.file`, `fr.time` ; `errorMessage`.
- Produces :
  - `@kibo/sdk` : `type FileRefText = { path: string; line: number | null; column: number | null }`, `type TextSegment = { kind: "text"; text: string; start: number } | { kind: "file"; text: string; start: number; ref: FileRefText }`, `linkifyPaths(text: string): TextSegment[]`, `parseFileRef(text: string): FileRefText | null`, `FileLink(props: { path: string; line?: number | null; label?: string; onOpen(ref: { path: string; line: number | null }): void; className?: string })`, `LinkifiedText(props: { text: string; onOpen(ref: { path: string; line: number | null }): void })` ;
  - `useWorktrees(projectId: string | null): { worktrees: Worktree[] | null; error: KiboError | null }`, `resolveWorktree(worktrees: Worktree[] | null, path: string | null): Worktree | null` ;
  - `languageOf(path: string): { id: string; label: string }` ; `type Token = { content: string; light: string | undefined; dark: string | undefined }` ; `highlightLines(code: string, lang: string): Promise<Token[][]>` ; `plainTokens(code: string): Token[][]` ;
  - `useFileContent(ref: FileRef): { worktree: Worktree | null; content: FileContent | null; tokens: Token[][] | null; error: string | null; setError(e: string | null): void; reload(): void; replaceContent(c: FileContent): void }` ;
  - `CodeLines(props: { tokens: Token[][]; highlightLine: number | null; label: string })` ;
  - `CodeEditor(props: { initial: string; original: string | null; path: string; layout: "single" | "unified" | "split"; label: string; onChange(value: string): void; onSave(): void })` ;
  - `FilePreviewSheet(props: { fileRef: FileRef; onClose(): void; onOpenInTab(edit: boolean): void })` ;
  - `FileTabView(props: { fileRef: FileRef; startEditing: boolean })` ;
  - `relativeTime(then: number, now?: number): string`.

- [x] **Step 1: Tests des liens (SDK)**

`packages/sdk/src/file-link.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkifiedText, linkifyPaths, parseFileRef } from "./file-link";

test("paths with or without line and column are recognised", () => {
  expect(parseFileRef("ticket.ts:42")).toEqual({ path: "ticket.ts", line: 42, column: null });
  expect(parseFileRef("packages/core/src/ticket.ts:43:3")).toEqual({ path: "packages/core/src/ticket.ts", line: 43, column: 3 });
  expect(parseFileRef("src/app/Makefile.d/rules")).toBeNull();
  expect(parseFileRef("kibo.dev")).toBeNull();
});

test("URLs, versions and e-mails are not links", () => {
  for (const text of ["https://github.com/kibo/a.ts", "version 1.2.3", "adam@example.test", "claude.com/claude-code"]) {
    expect(linkifyPaths(text).every((s) => s.kind === "text")).toBe(true);
  }
});

test("free text is split around file references", () => {
  expect(linkifyPaths("Edit packages/core/ticket.ts:42 puis README.md.").map((s) => [s.kind, s.text])).toEqual([
    ["text", "Edit "],
    ["file", "packages/core/ticket.ts:42"],
    ["text", " puis "],
    ["file", "README.md"],
    ["text", "."],
  ]);
});

test("LinkifiedText renders clickable references", async () => {
  const opened: unknown[] = [];
  render(<LinkifiedText text="voir ticket.ts:42" onOpen={(r) => opened.push(r)} />);
  await userEvent.click(screen.getByRole("button", { name: "ticket.ts:42" }));
  expect(opened).toEqual([{ path: "ticket.ts", line: 42 }]);
});
```

Run: `bun test packages/sdk/src/file-link.test.tsx`
Expected: FAIL, module introuvable.

- [x] **Step 2: Implémenter les liens**

`packages/sdk/src/file-link.tsx` :
```tsx
import { cn } from "./lib/utils";

export type FileRefText = { path: string; line: number | null; column: number | null };
export type TextSegment =
  | { kind: "text"; text: string; start: number }
  | { kind: "file"; text: string; start: number; ref: FileRefText };
type OpenRef = { path: string; line: number | null };

const KNOWN_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "css", "html", "rs", "toml", "yaml", "yml", "py", "go", "sql", "sh", "txt", "lock", "svg",
]);
const FILE_REF = /(?<![\w./:@-])((?:[\w@.-]+\/)*[\w.-]+\.([A-Za-z][A-Za-z0-9]{0,9}))(?::(\d+))?(?::(\d+))?(?![\w/])/g;

export function linkifyPaths(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let cursor = 0;
  for (const m of text.matchAll(FILE_REF)) {
    const [whole, path = "", ext = ""] = m;
    const start = m.index ?? 0;
    if (!path.includes("/") && !KNOWN_EXTENSIONS.has(ext.toLowerCase())) continue;
    if (start > cursor) out.push({ kind: "text", text: text.slice(cursor, start), start: cursor });
    out.push({
      kind: "file",
      text: whole,
      start,
      ref: { path, line: m[3] ? Number(m[3]) : null, column: m[4] ? Number(m[4]) : null },
    });
    cursor = start + whole.length;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor), start: cursor });
  return out;
}

export function parseFileRef(text: string): FileRefText | null {
  const [only, ...rest] = linkifyPaths(text.trim());
  return only?.kind === "file" && rest.length === 0 ? only.ref : null;
}

export function FileLink({
  path,
  line = null,
  label,
  onOpen,
  className,
}: { path: string; line?: number | null; label?: string; onOpen(ref: OpenRef): void; className?: string }) {
  return (
    <button
      type="button"
      className={cn("font-mono text-sky-700 underline-offset-2 hover:underline dark:text-sky-400", className)}
      onClick={() => onOpen({ path, line })}
    >
      {label ?? (line ? `${path}:${line}` : path)}
    </button>
  );
}

export function LinkifiedText({ text, onOpen }: { text: string; onOpen(ref: OpenRef): void }) {
  return (
    <>
      {linkifyPaths(text).map((s) =>
        s.kind === "text" ? (
          <span key={s.start}>{s.text}</span>
        ) : (
          <FileLink key={s.start} path={s.ref.path} line={s.ref.line} label={s.text} onOpen={onOpen} />
        ),
      )}
    </>
  );
}
```
`packages/sdk/src/index.ts` : ajouter `export * from "./file-link";`. Un composant l'utilise ainsi : `<LinkifiedText text={t.description} onOpen={(r) => sdk.openFile(r)} />`.

Run: `bun test packages/sdk/src/file-link.test.tsx`
Expected: PASS.

- [x] **Step 3: Tests de l'aperçu et de l'éditeur**

`packages/ui/src/lib/relative-time.test.ts` :
```ts
import { expect, test } from "bun:test";
import { relativeTime } from "./relative-time";

test("relative times are short and French", () => {
  const now = 1_000_000_000_000;
  expect(relativeTime(now - 20_000, now)).toBe("à l'instant");
  expect(relativeTime(now - 8 * 60_000, now)).toBe("il y a 8 min");
  expect(relativeTime(now - 3 * 3_600_000, now)).toBe("il y a 3 h");
  expect(relativeTime(now - 2 * 86_400_000, now)).toBe("il y a 2 j");
});
```

`packages/ui/src/files/files.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { type CodeRequest, type FileContent, KiboError } from "@kibo/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: CodeRequest[] = [];
let writeOutcome: () => Promise<unknown> = () => Promise.resolve({ hash: "b".repeat(40) });
const content: FileContent = {
  path: "packages/core/ticket.ts",
  revision: "worktree",
  content: 'import { z } from "zod";\n\nexport const TicketSchema = z.object({\n  id: z.string(),\n});\n',
  hash: "a".repeat(40),
  size: 90,
  binary: false,
  tooLarge: false,
  lines: 5,
  modifiedAt: Date.now() - 8 * 60_000,
  tracked: true,
  dirty: true,
};
mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => {
      calls.push(req);
      if (req.method === "worktrees")
        return Promise.resolve([{ path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true }]);
      if (req.method === "readFile") return Promise.resolve(content);
      if (req.method === "writeFile") return writeOutcome();
      return Promise.resolve(null);
    },
    subscribeCode: () => () => {},
  },
}));
const { FilePreviewSheet } = await import("./FilePreviewSheet");
const { FileTabView } = await import("./FileTabView");
const { languageOf, highlightLines } = await import("./highlight");

const ref = { projectId: "p1", worktree: null, path: "packages/core/ticket.ts", line: 4, origin: "KIB-12 · PostToolUse Edit" };

beforeEach(() => {
  calls.length = 0;
});

test("languages come from the extension, unknown ones are plain text", () => {
  expect(languageOf("a/ticket.ts")).toEqual({ id: "typescript", label: "TypeScript" });
  expect(languageOf("Makefile")).toEqual({ id: "text", label: "Texte brut" });
});

test("Shiki highlights TypeScript with light and dark colours", async () => {
  const lines = await highlightLines("const a = 1;", "typescript");
  expect(lines[0]?.map((t) => t.content).join("")).toBe("const a = 1;");
  expect(lines[0]?.some((t) => t.light && t.dark)).toBe(true);
});

test("the preview shows the header, metadata, highlighted line and footer", async () => {
  const events: string[] = [];
  render(<FilePreviewSheet fileRef={ref} onClose={() => events.push("close")} onOpenInTab={(edit) => events.push(`tab:${edit}`)} />);
  expect(await screen.findByText("Ouvert depuis KIB-12 · PostToolUse Edit")).toBeTruthy();
  expect(await screen.findByText(/worktree kib-12 · TypeScript · 5 lignes · modifié il y a 8 min · non commité/)).toBeTruthy();
  await waitFor(() => expect(document.querySelector('[data-line="4"]')?.getAttribute("aria-current")).toBe("location"));
  expect(screen.getByText("Ligne 4, col 3")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir dans un onglet" }));
  await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
  expect(events).toEqual(["tab:false", "tab:true"]);
  fireEvent.keyDown(window, { key: "O", metaKey: true, shiftKey: true });
  await waitFor(() => expect(calls.some((c) => c.method === "openInEditor")).toBe(true));
  expect(calls.find((c) => c.method === "openInEditor")).toEqual({
    method: "openInEditor",
    projectId: "p1",
    worktree: "/repo",
    path: "packages/core/ticket.ts",
    line: 4,
  });
});

test("saving a file changed on disk shows an alert and offers a reload", async () => {
  writeOutcome = () => Promise.reject(new KiboError("FILE_CHANGED", "hash mismatch"));
  render(<FileTabView fileRef={ref} startEditing />);
  const editor = await screen.findByRole("textbox", { name: "packages/core/ticket.ts" });
  fireEvent.keyDown(editor, { key: "s", metaKey: true });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Le fichier a changé sur le disque"),
  );
  expect(calls.find((c) => c.method === "writeFile")).toMatchObject({ baseHash: "a".repeat(40) });
  expect(screen.getByRole("button", { name: "Recharger" })).toBeTruthy();
});
```
(`CodeMirror` monte sous happy-dom ; si une API de mise en page manque, compléter `test/happydom.ts` par un polyfill minimal de `Range.getClientRects` / `getBoundingClientRect` renvoyant des rectangles vides, sans désactiver le test.)

Run: `bun test packages/ui/src/files packages/ui/src/lib/relative-time.test.ts`
Expected: FAIL, modules introuvables.

- [x] **Step 4: Implémenter les utilitaires**

`packages/ui/src/lib/relative-time.ts` :
```ts
import { fr } from "../i18n/fr";

export function relativeTime(then: number, now = Date.now()): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return fr.time.now;
  if (minutes < 60) return fr.time.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fr.time.hours(hours);
  return fr.time.days(Math.floor(hours / 24));
}
```

`packages/ui/src/files/language.ts` :
```ts
import { fr } from "../i18n/fr";

export type Language = { id: string; label: string };

const BY_EXTENSION: Record<string, Language> = {
  ts: { id: "typescript", label: "TypeScript" },
  mts: { id: "typescript", label: "TypeScript" },
  tsx: { id: "tsx", label: "TSX" },
  js: { id: "javascript", label: "JavaScript" },
  mjs: { id: "javascript", label: "JavaScript" },
  cjs: { id: "javascript", label: "JavaScript" },
  jsx: { id: "jsx", label: "JSX" },
  json: { id: "json", label: "JSON" },
  md: { id: "markdown", label: "Markdown" },
  css: { id: "css", label: "CSS" },
  html: { id: "html", label: "HTML" },
  rs: { id: "rust", label: "Rust" },
  toml: { id: "toml", label: "TOML" },
  yml: { id: "yaml", label: "YAML" },
  yaml: { id: "yaml", label: "YAML" },
  sh: { id: "shellscript", label: "Shell" },
  py: { id: "python", label: "Python" },
  go: { id: "go", label: "Go" },
  sql: { id: "sql", label: "SQL" },
};

export function languageOf(path: string): Language {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return BY_EXTENSION[ext] ?? { id: "text", label: fr.file.plainText };
}
```

`packages/ui/src/files/highlight.ts` :
```ts
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export { languageOf } from "./language";

export type Token = { content: string; light: string | undefined; dark: string | undefined };

export const MAX_HIGHLIGHT_LINES = 5000;

const LOADERS: Record<string, LanguageInput> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  markdown: () => import("@shikijs/langs/markdown"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  rust: () => import("@shikijs/langs/rust"),
  toml: () => import("@shikijs/langs/toml"),
  yaml: () => import("@shikijs/langs/yaml"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  sql: () => import("@shikijs/langs/sql"),
};

let highlighter: Promise<HighlighterCore> | null = null;
const getHighlighter = () =>
  (highlighter ??= createHighlighterCore({
    themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  }));

export const plainTokens = (code: string): Token[][] =>
  code.split("\n").map((content) => [{ content, light: undefined, dark: undefined }]);

export async function highlightLines(code: string, lang: string): Promise<Token[][]> {
  const loader = LOADERS[lang];
  if (!loader || code.split("\n").length > MAX_HIGHLIGHT_LINES) return plainTokens(code);
  const h = await getHighlighter();
  if (!h.getLoadedLanguages().includes(lang)) await h.loadLanguage(loader);
  return h
    .codeToTokensWithThemes(code, { lang, themes: { light: "github-light", dark: "github-dark" } })
    .map((line) => line.map((t) => ({ content: t.content, light: t.variants.light?.color, dark: t.variants.dark?.color })));
}
```

`packages/ui/src/code/use-worktrees.ts` :
```ts
import { KiboError, type Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function resolveWorktree(worktrees: Worktree[] | null, path: string | null): Worktree | null {
  if (!worktrees) return null;
  return path ? (worktrees.find((w) => w.path === path) ?? null) : (worktrees.find((w) => w.isMain) ?? null);
}

export function useWorktrees(projectId: string | null): { worktrees: Worktree[] | null; error: KiboError | null } {
  const [state, setState] = useState<{ worktrees: Worktree[] | null; error: KiboError | null }>({ worktrees: null, error: null });
  useEffect(() => {
    setState({ worktrees: null, error: null });
    if (!projectId) return;
    let alive = true;
    const load = () =>
      client.code({ method: "worktrees", projectId }).then(
        (worktrees) => alive && setState({ worktrees, error: null }),
        (e: unknown) => {
          if (!alive) return;
          setState({ worktrees: [], error: e instanceof KiboError ? e : new KiboError("INTERNAL", String(e)) });
        },
      );
    void load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  return state;
}
```

`packages/ui/src/files/use-file-content.ts` :
```ts
import type { FileContent, FileRef, Worktree } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { resolveWorktree, useWorktrees } from "../code/use-worktrees";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { highlightLines, plainTokens, type Token } from "./highlight";
import { languageOf } from "./language";

export type FileContentState = {
  worktree: Worktree | null;
  content: FileContent | null;
  tokens: Token[][] | null;
  error: string | null;
  setError(error: string | null): void;
  reload(): void;
  replaceContent(content: FileContent): void;
};

export function useFileContent(ref: FileRef): FileContentState {
  const { worktrees, error: worktreeError } = useWorktrees(ref.projectId);
  const worktree = resolveWorktree(worktrees, ref.worktree);
  const [content, setContent] = useState<FileContent | null>(null);
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const worktreePath = worktree?.path ?? null;

  const replaceContent = useCallback((next: FileContent) => {
    setContent(next);
    if (next.content === null) return;
    const source = next.content;
    highlightLines(source, languageOf(next.path).id).then(setTokens, () => {
      setTokens(plainTokens(source));
      setError(fr.file.languageFailed);
    });
  }, []);

  useEffect(() => {
    if (!worktreePath || version < 0) return;
    let alive = true;
    setContent(null);
    setTokens(null);
    client.code({ method: "readFile", projectId: ref.projectId, worktree: worktreePath, path: ref.path, revision: "worktree" }).then(
      (c) => alive && replaceContent(c),
      (e: unknown) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [ref.projectId, ref.path, worktreePath, version, replaceContent]);

  return {
    worktree,
    content,
    tokens,
    error: error ?? (worktreeError ? errorMessage(worktreeError) : null),
    setError,
    reload: () => {
      setError(null);
      setVersion((v) => v + 1);
    },
    replaceContent,
  };
}
```

- [x] **Step 5: Implémenter l'affichage, l'éditeur, l'aperçu et l'onglet**

`packages/ui/src/index.css` : ajouter à la fin
```css
.shiki-token {
  color: var(--shiki-light, inherit);
}
.dark .shiki-token {
  color: var(--shiki-dark, inherit);
}
```

`packages/ui/src/files/CodeLines.tsx` :
```tsx
import { cn } from "@kibo/sdk/lib/utils";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import type { Token } from "./highlight";

type CssVars = CSSProperties & Record<`--${string}`, string | undefined>;
type Props = { tokens: Token[][]; highlightLine: number | null; label: string };

export function CodeLines({ tokens, highlightLine, label }: Props) {
  const target = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      tokens.map((line, i) => {
        let offset = 0;
        const spans = line.map((t) => {
          const span = { key: offset, token: t };
          offset += t.content.length;
          return span;
        });
        return { n: i + 1, spans };
      }),
    [tokens],
  );
  useEffect(() => {
    if (highlightLine !== null) target.current?.scrollIntoView?.({ block: "center" });
  }, [highlightLine, rows]);
  return (
    <div role="region" aria-label={label} className="min-w-0 overflow-auto py-2 font-mono text-[13px] leading-6">
      {rows.map((row) => {
        const current = row.n === highlightLine;
        return (
          <div
            key={row.n}
            ref={current ? target : undefined}
            data-line={row.n}
            aria-current={current ? "location" : undefined}
            className={cn("grid grid-cols-[4rem_1fr]", current && "bg-sky-500/15 dark:bg-sky-400/15")}
          >
            <span className={cn("select-none pr-4 text-right text-muted-foreground", current && "text-foreground")}>{row.n}</span>
            <code className="whitespace-pre">
              {row.spans.map(({ key, token }) => {
                const style: CssVars = { "--shiki-light": token.light, "--shiki-dark": token.dark };
                return (
                  <span key={key} className="shiki-token" style={style}>
                    {token.content}
                  </span>
                );
              })}
            </code>
          </div>
        );
      })}
    </div>
  );
}
```

`packages/ui/src/files/CodeEditor.tsx` :
```tsx
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { fr } from "../i18n/fr";

export type EditorLayout = "single" | "unified" | "split";
type Props = {
  initial: string;
  original: string | null;
  path: string;
  layout: EditorLayout;
  label: string;
  onChange(value: string): void;
  onSave(): void;
};

const kiboTheme = EditorView.theme({
  "&": { backgroundColor: "var(--background)", color: "var(--foreground)", height: "100%" },
  ".cm-gutters": { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--accent) 60%, transparent)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono)" },
});

export function CodeEditor({ initial, original, path, layout, label, onChange, onSave }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onChange, onSave });
  handlers.current = { onChange, onSave };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const language = new Compartment();
    const editable: Extension[] = [
      basicSetup,
      kiboTheme,
      language.of([]),
      EditorView.contentAttributes.of({ "aria-label": label }),
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            handlers.current.onSave();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
      }),
    ];
    let view: EditorView;
    let destroy: () => void;
    if (layout === "split" && original !== null) {
      const merge = new MergeView({
        a: { doc: original, extensions: [basicSetup, kiboTheme, EditorState.readOnly.of(true), EditorView.editable.of(false)] },
        b: { doc: initial, extensions: editable },
        parent,
      });
      view = merge.b;
      destroy = () => merge.destroy();
    } else {
      const extensions =
        layout === "unified" && original !== null ? [...editable, unifiedMergeView({ original, mergeControls: false })] : editable;
      view = new EditorView({ parent, state: EditorState.create({ doc: initial, extensions }) });
      destroy = () => view.destroy();
    }
    const description = LanguageDescription.matchFilename(languages, path);
    if (description) {
      description.load().then(
        (support) => view.dispatch({ effects: language.reconfigure(support) }),
        () => setError(fr.file.languageFailed),
      );
    }
    return destroy;
  }, [initial, original, path, layout, label]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <p role="alert" className="px-4 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <div ref={host} className="min-h-0 flex-1 overflow-auto text-[13px]" />
    </div>
  );
}
```
Le contenu initial n'est relu qu'au montage : pour recharger un fichier, le parent change la `key` du composant.

`packages/ui/src/files/FilePreviewSheet.tsx` :
```tsx
import type { FileRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, ExternalLink, FileCode, Pencil, SquareTerminal, X } from "lucide-react";
import { useEffect } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { relativeTime } from "../lib/relative-time";
import { CodeLines } from "./CodeLines";
import { languageOf } from "./language";
import { useFileContent } from "./use-file-content";

type Props = { fileRef: FileRef; onClose(): void; onOpenInTab(edit: boolean): void };

export const splitPath = (path: string) => {
  const slash = path.lastIndexOf("/");
  return { dir: slash >= 0 ? path.slice(0, slash + 1) : "", name: path.slice(slash + 1) };
};

export function columnOf(text: string | null, line: number | null): number {
  if (!text || line === null) return 1;
  const index = (text.split("\n")[line - 1] ?? "").search(/\S/);
  return index < 0 ? 1 : index + 1;
}

export function useExternalOpen(fileRef: FileRef, worktree: string | null, onError: (message: string) => void) {
  return () => {
    if (!worktree) return;
    client
      .code({ method: "openInEditor", projectId: fileRef.projectId, worktree, path: fileRef.path, line: fileRef.line })
      .catch((e: unknown) => onError(errorMessage(e)));
  };
}

export function FilePreviewSheet({ fileRef, onClose, onOpenInTab }: Props) {
  const file = useFileContent(fileRef);
  const { dir, name } = splitPath(fileRef.path);
  const openExternal = useExternalOpen(fileRef, file.worktree?.path ?? null, file.setError);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openExternal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openExternal]);

  const c = file.content;
  const meta = [
    file.worktree?.branch ? fr.file.worktree(file.worktree.branch) : null,
    languageOf(fileRef.path).label,
    c ? fr.file.lines(c.lines) : null,
    c?.modifiedAt ? fr.file.modified(relativeTime(c.modifiedAt)) : null,
    c?.dirty ? fr.file.uncommitted : null,
  ].filter(Boolean);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent showCloseButton={false} className="flex w-[50vw] flex-col gap-0 p-0 sm:max-w-[1000px]">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <FileCode aria-hidden className="size-4 text-sky-600 dark:text-sky-400" />
          <SheetTitle className="min-w-0 truncate font-mono text-sm font-normal">
            <span className="text-muted-foreground">{dir}</span> {name}
          </SheetTitle>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onOpenInTab(false)}>
              <ExternalLink />
              {fr.file.openInTab}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenInTab(true)}>
              <Pencil />
              {fr.file.edit}
            </Button>
            <Button variant="ghost" size="icon" aria-label={fr.file.external} title={fr.file.external} onClick={openExternal}>
              <SquareTerminal />
            </Button>
            <Button variant="ghost" size="icon" aria-label={fr.file.close} onClick={onClose}>
              <X />
            </Button>
          </div>
        </header>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
            {fileRef.origin && (
              <span className="flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                <Bot aria-hidden className="size-3.5" />
                {fr.file.origin(fileRef.origin)}
              </span>
            )}
            <span>{meta.join(" · ")}</span>
          </div>
        </SheetDescription>
        {file.error && (
          <p role="alert" className="px-4 py-2 text-sm text-destructive">
            {file.error}
          </p>
        )}
        {c?.binary && <p className="p-6 text-sm text-muted-foreground">{fr.file.binary}</p>}
        {c?.tooLarge && <p className="p-6 text-sm text-muted-foreground">{fr.file.tooLarge}</p>}
        {file.tokens && <CodeLines tokens={file.tokens} highlightLine={fileRef.line} label={fileRef.path} />}
        <footer className="mt-auto flex items-center justify-between border-t px-4 py-2 font-mono text-xs text-muted-foreground">
          <span>{fr.file.position(fileRef.line ?? 1, columnOf(c?.content ?? null, fileRef.line))}</span>
          <span className="font-sans">{fr.file.hints}</span>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
```
L'icône de l'origine est bleue (hook d'agent) ; l'orange reste réservé à l'état des runs.

`packages/ui/src/files/FileTabView.tsx` :
```tsx
import { type FileRef, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { FileCode, Pencil, RotateCw, Save, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { CodeEditor } from "./CodeEditor";
import { CodeLines } from "./CodeLines";
import { splitPath, useExternalOpen } from "./FilePreviewSheet";
import { useFileContent } from "./use-file-content";

type Props = { fileRef: FileRef; startEditing: boolean };

export function FileTabView({ fileRef, startEditing }: Props) {
  const file = useFileContent(fileRef);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const { dir, name } = splitPath(fileRef.path);
  const openExternal = useExternalOpen(fileRef, file.worktree?.path ?? null, file.setError);
  const c = file.content;

  const save = () => {
    if (!c?.hash || !file.worktree || c.content === null) return;
    const next = draft ?? c.content;
    setSaving(true);
    client
      .code({
        method: "writeFile",
        projectId: fileRef.projectId,
        worktree: file.worktree.path,
        path: fileRef.path,
        content: next,
        baseHash: c.hash,
      })
      .then(
        ({ hash }) => {
          file.replaceContent({ ...c, content: next, hash, dirty: true, lines: next.split("\n").length });
          setDraft(null);
          file.setError(null);
        },
        (e: unknown) => {
          setStale(e instanceof KiboError && e.code === "FILE_CHANGED");
          file.setError(errorMessage(e));
        },
      )
      .finally(() => setSaving(false));
  };

  const reload = () => {
    setStale(false);
    setDraft(null);
    file.reload();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <FileCode aria-hidden className="size-4 text-sky-600 dark:text-sky-400" />
        <h1 className="min-w-0 truncate font-mono text-sm">
          <span className="text-muted-foreground">{dir}</span>
          {name}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <Button size="sm" disabled={saving || draft === null} onClick={save}>
              <Save />
              {saving ? fr.file.saving : fr.file.save}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!c || c.content === null}>
              <Pencil />
              {fr.file.edit}
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={fr.file.external} title={fr.file.external} onClick={openExternal}>
            <SquareTerminal />
          </Button>
        </div>
      </header>
      {file.error && (
        <div role="alert" className="flex items-center gap-3 px-4 py-2 text-sm text-destructive">
          {file.error}
          {stale && (
            <Button variant="outline" size="sm" onClick={reload}>
              <RotateCw />
              {fr.changes.reload}
            </Button>
          )}
        </div>
      )}
      {c?.binary && <p className="p-6 text-sm text-muted-foreground">{fr.file.binary}</p>}
      {c?.tooLarge && <p className="p-6 text-sm text-muted-foreground">{fr.file.tooLarge}</p>}
      {c?.content !== null && c && editing && (
        <CodeEditor
          key={c.hash}
          initial={c.content}
          original={null}
          path={fileRef.path}
          layout="single"
          label={fileRef.path}
          onChange={setDraft}
          onSave={save}
        />
      )}
      {!editing && file.tokens && <CodeLines tokens={file.tokens} highlightLine={fileRef.line} label={fileRef.path} />}
    </div>
  );
}
```
Le bouton « Recharger » est dans l'alerte, ce qui donne à l'utilisateur la seule action utile après un `FILE_CHANGED` (Review Focus 1). Dans le test, `startEditing` rend l'éditeur ; « Enregistrer » est désactivé sans brouillon, mais `⌘S` dans l'éditeur appelle `save()` avec le contenu courant.

- [x] **Step 6: Lancer les tests**

Run: `bun test packages/ui/src/files packages/ui/src/lib packages/sdk && bun run check && bun run typecheck`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add packages/sdk/src/file-link.tsx packages/sdk/src/file-link.test.tsx packages/sdk/src/index.ts packages/ui/src/code/use-worktrees.ts packages/ui/src/files packages/ui/src/lib/relative-time.ts packages/ui/src/lib/relative-time.test.ts packages/ui/src/index.css
git commit -m "feat(ui): aperçu et liens de fichiers"
```

---

### Task 13: Panneau Commit et commits non poussés

Écran 21 (PDF page 34), colonne droite : titre « Commit » et « n fichiers indexés », emplacement du bandeau d'agent, message pré-rempli (« Pré-rempli depuis le ticket · 0 token »), « Générer avec Claude » (désactivé, « Bientôt »), case « Modifier le dernier commit (non poussé) », bouton « Commit sur kib-12 ⌘↵ » ; section « Commits non poussés ↑n » : « Modifier » sur le plus récent, « Reformuler » et « Annuler » sur chacun, commit poussé grisé « Poussé · ne peut plus être modifié ».

**Files:**
- Create: `packages/ui/src/code/CommitPanel.tsx`, `packages/ui/src/code/UnpushedCommits.tsx`, `packages/ui/src/code/RewordDialog.tsx`, `packages/ui/src/code/UndoCommitDialog.tsx`, `packages/ui/src/code/commit.test.tsx`

**Interfaces:**
- Consumes: `CommitInfo` (tâche 1) ; `Checkbox`, `AlertDialog*` (tâche 2) ; `Dialog*`, `Textarea`, `Label`, `Tooltip*`, `Button` ; `fr.commit` ; `errorMessage`.
- Produces :
  - `CommitPanel(props: { branch: string | null; stagedCount: number; message: string; onMessageChange(m: string): void; prefilled: boolean; amend: boolean; onAmendChange(a: boolean): void; canAmend: boolean; busy: boolean; onCommit(): void; banner?: ReactNode; messageRef?: Ref<HTMLTextAreaElement> })` ;
  - `UnpushedCommits(props: { commits: CommitInfo[]; busy: boolean; onModify(c: CommitInfo): void; onReword(c: CommitInfo, message: string): Promise<void>; onUndo(c: CommitInfo): Promise<void> })` ;
  - `RewordDialog(props: { commit: CommitInfo; onClose(): void; onSubmit(message: string): Promise<void> })`, `UndoCommitDialog(props: { commit: CommitInfo; newer: number; onClose(): void; onConfirm(): Promise<void> })`.

- [x] **Step 1: Tests**

`packages/ui/src/code/commit.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { type CommitInfo, KiboError } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CommitPanel } from "./CommitPanel";
import { UnpushedCommits } from "./UnpushedCommits";

const commit = (sha: string, subject: string, pushed = false): CommitInfo => ({
  sha: sha.padEnd(40, "0"),
  shortSha: sha,
  subject,
  body: "",
  author: "Adam",
  time: 0,
  pushed,
});
const commits = [
  commit("a1f3c2e", "feat(core): opérations move / reparent"),
  commit("9bd02e1", "test(core): convergence fast-check"),
  commit("47ce0aa", "chore: monorepo Bun workspaces", true),
];

function Panel({ onCommit, stagedCount = 2, canAmend = true }: { onCommit(): void; stagedCount?: number; canAmend?: boolean }) {
  const [message, setMessage] = useState("feat: schéma Loro des tickets (KIB-12)");
  const [amend, setAmend] = useState(false);
  return (
    <CommitPanel
      branch="kib-12"
      stagedCount={stagedCount}
      message={message}
      onMessageChange={setMessage}
      prefilled
      amend={amend}
      onAmendChange={setAmend}
      canAmend={canAmend}
      busy={false}
      onCommit={onCommit}
    />
  );
}

test("the commit button names the branch and ⌘↵ commits", async () => {
  let commits = 0;
  render(<Panel onCommit={() => commits++} />);
  expect(screen.getByText("2 fichiers indexés")).toBeTruthy();
  expect(screen.getByText("Pré-rempli depuis le ticket · 0 token")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Générer avec Claude/ }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: /Commit sur kib-12/ }));
  await userEvent.click(screen.getByLabelText("Message"));
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  expect(commits).toBe(2);
});

test("nothing staged blocks a commit, amend unlocks it, a pushed head blocks amend", async () => {
  const { unmount } = render(<Panel onCommit={() => {}} stagedCount={0} />);
  expect(screen.getByRole("button", { name: /Commit sur kib-12/ }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" }));
  expect(screen.getByRole("button", { name: /Modifier le commit sur kib-12/ }).hasAttribute("disabled")).toBe(false);
  unmount();
  render(<Panel onCommit={() => {}} canAmend={false} />);
  expect(screen.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" }).hasAttribute("disabled")).toBe(true);
});

test("only the latest unpushed commit can be modified, pushed ones have no action", async () => {
  const modified: string[] = [];
  render(<UnpushedCommits commits={commits} busy={false} onModify={(c) => modified.push(c.shortSha)} onReword={async () => {}} onUndo={async () => {}} />);
  expect(screen.getByText("↑2")).toBeTruthy();
  const [latest, older, pushed] = screen.getAllByRole("listitem");
  if (!latest || !older || !pushed) throw new Error("three commits expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Modifier" }));
  expect(modified).toEqual(["a1f3c2e"]);
  expect(within(older).queryByRole("button", { name: "Modifier" })).toBeNull();
  expect(within(older).getByRole("button", { name: "Reformuler" })).toBeTruthy();
  expect(within(pushed).queryAllByRole("button")).toHaveLength(0);
  expect(within(pushed).getByText("Poussé · ne peut plus être modifié")).toBeTruthy();
});

test("reword submits the edited message, undo explains how many commits go back to the index", async () => {
  const reworded: string[] = [];
  const undone: string[] = [];
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={async (c, m) => {
        reworded.push(`${c.shortSha}:${m}`);
      }}
      onUndo={async (c) => {
        undone.push(c.shortSha);
      }}
    />,
  );
  const older = screen.getAllByRole("listitem")[1];
  if (!older) throw new Error("older commit expected");
  await userEvent.click(within(older).getByRole("button", { name: "Reformuler" }));
  const box = screen.getByRole("textbox", { name: "Message" });
  await userEvent.clear(box);
  await userEvent.type(box, "test(core): convergence");
  await userEvent.click(screen.getByRole("button", { name: "Reformuler", hidden: false }));
  expect(reworded).toEqual(["9bd02e1:test(core): convergence"]);
  await userEvent.click(within(older).getByRole("button", { name: "Annuler" }));
  expect(screen.getByText(/Le commit 9bd02e1 et 1 commit plus récent sont retirés de la branche/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Annuler les commits" }));
  expect(undone).toEqual(["9bd02e1"]);
});

test("a refused reword is shown in an alert and keeps the dialog open", async () => {
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={() => Promise.reject(new KiboError("GIT_PUSHED", "pushed"))}
      onUndo={async () => {}}
    />,
  );
  const latest = screen.getAllByRole("listitem")[0];
  if (!latest) throw new Error("latest commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Reformuler" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reformuler" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Ce commit est déjà poussé : il ne peut plus être modifié.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});
```
(Dans le quatrième test, le bouton « Reformuler » du dialogue est le seul accessible pendant que le dialogue modal est ouvert : Radix masque le reste avec `aria-hidden`.)

Run: `bun test packages/ui/src/code/commit.test.tsx`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter**

`packages/ui/src/code/CommitPanel.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Check, GitCommitHorizontal, Sparkles } from "lucide-react";
import { type ReactNode, type Ref, useId } from "react";
import { fr } from "../i18n/fr";

type Props = {
  branch: string | null;
  stagedCount: number;
  message: string;
  onMessageChange(message: string): void;
  prefilled: boolean;
  amend: boolean;
  onAmendChange(amend: boolean): void;
  canAmend: boolean;
  busy: boolean;
  onCommit(): void;
  banner?: ReactNode;
  messageRef?: Ref<HTMLTextAreaElement>;
};

export function CommitPanel(p: Props) {
  const id = useId();
  const branch = p.branch ?? fr.changes.detached;
  const canCommit = !p.busy && p.message.trim().length > 0 && (p.amend || p.stagedCount > 0);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold">
          <GitCommitHorizontal aria-hidden className="size-4" />
          {fr.commit.title}
        </h2>
        <span className="text-xs text-muted-foreground">{fr.commit.stagedCount(p.stagedCount)}</span>
      </header>
      {p.banner}
      <Label htmlFor={`${id}-message`}>{fr.commit.message}</Label>
      <Textarea
        id={`${id}-message`}
        ref={p.messageRef}
        className="min-h-32 font-mono text-sm"
        placeholder={fr.commit.placeholder}
        value={p.message}
        onChange={(e) => p.onMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || !canCommit) return;
          e.preventDefault();
          p.onCommit();
        }}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{p.prefilled ? fr.commit.prefilled : ""}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="ghost" size="sm" disabled>
                  <Sparkles />
                  {fr.commit.generate}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{fr.commit.generateSoon}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2" title={p.canAmend ? undefined : fr.commit.amendDisabled}>
        <Checkbox
          id={`${id}-amend`}
          checked={p.amend}
          disabled={!p.canAmend || p.busy}
          onCheckedChange={(v) => p.onAmendChange(v === true)}
        />
        <Label htmlFor={`${id}-amend`} className="font-normal">
          {fr.commit.amend}
        </Label>
      </div>
      <Button onClick={p.onCommit} disabled={!canCommit}>
        <Check />
        {p.amend ? fr.commit.submitAmend(branch) : fr.commit.submit(branch)}
        <kbd aria-hidden className="ml-1 text-xs opacity-60">
          ⌘↵
        </kbd>
      </Button>
      {p.stagedCount === 0 && !p.amend && <p className="text-xs text-muted-foreground">{fr.commit.nothingStaged}</p>}
    </section>
  );
}
```

`packages/ui/src/code/RewordDialog.tsx` :
```tsx
import type { CommitInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { commit: CommitInfo; onClose(): void; onSubmit(message: string): Promise<void> };

export function RewordDialog({ commit, onClose, onSubmit }: Props) {
  const id = useId();
  const [message, setMessage] = useState(commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    setBusy(true);
    onSubmit(message).then(onClose, (e: unknown) => {
      setError(errorMessage(e));
      setBusy(false);
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.commit.rewordTitle}</DialogTitle>
          <DialogDescription>{fr.commit.rewordHelp(commit.shortSha)}</DialogDescription>
        </DialogHeader>
        <Label htmlFor={id}>{fr.commit.message}</Label>
        <Textarea id={id} className="min-h-32 font-mono text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || message.trim().length === 0} onClick={submit}>
            {fr.commit.rewordSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`packages/ui/src/code/UndoCommitDialog.tsx` :
```tsx
import type { CommitInfo } from "@kibo/schema";
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
import { useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { commit: CommitInfo; newer: number; onClose(): void; onConfirm(): Promise<void> };

export function UndoCommitDialog({ commit, newer, onClose, onConfirm }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    onConfirm().then(onClose, (e: unknown) => {
      setError(errorMessage(e));
      setBusy(false);
    });
  };
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fr.commit.undoTitle}</AlertDialogTitle>
          <AlertDialogDescription>{fr.commit.undoHelp(commit.shortSha, newer)}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={confirm}>
            {fr.commit.undoSubmit}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```
(Un `Button` simple au lieu d'`AlertDialogAction`, qui fermerait le dialogue avant la fin de la requête et masquerait une erreur.)

`packages/ui/src/code/UnpushedCommits.tsx` :
```tsx
import type { CommitInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowUpFromLine, Pencil, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { RewordDialog } from "./RewordDialog";
import { UndoCommitDialog } from "./UndoCommitDialog";

type Props = {
  commits: CommitInfo[];
  busy: boolean;
  onModify(commit: CommitInfo): void;
  onReword(commit: CommitInfo, message: string): Promise<void>;
  onUndo(commit: CommitInfo): Promise<void>;
};

export function UnpushedCommits({ commits, busy, onModify, onReword, onUndo }: Props) {
  const id = useId();
  const unpushed = commits.filter((c) => !c.pushed);
  const pushed = commits.filter((c) => c.pushed);
  const [rewording, setRewording] = useState<CommitInfo | null>(null);
  const [undoing, setUndoing] = useState<CommitInfo | null>(null);
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <header className="flex items-center justify-between">
        <h3 id={id} className="text-sm font-semibold">
          {fr.commit.unpushed}
        </h3>
        <span className="font-mono text-xs text-orange-600 dark:text-orange-400">↑{unpushed.length}</span>
      </header>
      <ul className="grid gap-2">
        {unpushed.map((c, i) => (
          <li key={c.sha} className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-orange-500" />
              <span className="font-mono text-xs text-muted-foreground">{c.shortSha}</span>
              <span className="truncate">{c.subject}</span>
            </p>
            <div className="mt-2 flex gap-1">
              {i === 0 && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onModify(c)}>
                  <Pencil />
                  {fr.commit.modify}
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRewording(c)}>
                {fr.commit.reword}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setUndoing(c)}>
                <Undo2 />
                {fr.commit.undo}
              </Button>
            </div>
          </li>
        ))}
        {pushed.map((c) => (
          <li key={c.sha} className="rounded-lg border p-3 text-muted-foreground" title={fr.commit.pushed}>
            <p className="flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="font-mono text-xs">{c.shortSha}</span>
              <span className="truncate">{c.subject}</span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs">
              <ArrowUpFromLine aria-hidden className="size-3.5" />
              {fr.commit.pushed}
            </p>
          </li>
        ))}
      </ul>
      {rewording && (
        <RewordDialog commit={rewording} onClose={() => setRewording(null)} onSubmit={(m) => onReword(rewording, m)} />
      )}
      {undoing && (
        <UndoCommitDialog
          commit={undoing}
          newer={unpushed.findIndex((c) => c.sha === undoing.sha)}
          onClose={() => setUndoing(null)}
          onConfirm={() => onUndo(undoing)}
        />
      )}
    </section>
  );
}
```

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/ui/src/code/commit.test.tsx && bun run check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/ui/src/code/CommitPanel.tsx packages/ui/src/code/UnpushedCommits.tsx packages/ui/src/code/RewordDialog.tsx packages/ui/src/code/UndoCommitDialog.tsx packages/ui/src/code/commit.test.tsx
git commit -m "feat(ui): panneau de commit et amend"
```

---

### Task 14: Dialogue « Pousser et créer la PR »

Écran 22 (PDF page 35) : titre, sous-titre « kib-12 → main · 2 commits non poussés · 3 fichiers », Titre, Description (monospace), Branche de base (select) et Reviewers (champ avec icône), avertissement ambré « n fichiers indexés ne sont pas commités… » avec « Commiter d'abord », cases « Brouillon (draft) » et « Lier la PR à KIB-12 », emplacement pour les options d'agent, note de règle, aperçu de commande `git push -u origin kib-12 && gh pr create --draft`, « Annuler » et « Créer la PR ».

**Files:**
- Create: `packages/ui/src/code/pr-command.ts`, `packages/ui/src/code/PushPrDialog.tsx`, `packages/ui/src/code/pr.test.tsx`

**Interfaces:**
- Consumes: `GhLogin` (tâche 1) ; `Dialog*`, `Select*`, `Input`, `Textarea`, `Checkbox`, `Label`, `Button` ; `fr.pr` ; `errorMessage`.
- Produces :
  - `prCommandPreview(o: { remote: string; branch: string; draft: boolean }): string` ; `parseReviewers(input: string): { logins: string[]; invalid: string | null }` ;
  - `type PushPrInput = { title: string; body: string; base: string; draft: boolean; reviewers: string[]; link: boolean }` ;
  - `PushPrDialog(props: { open: boolean; onOpenChange(o: boolean): void; branch: string; remote: string; bases: string[]; base: string; onBaseChange(base: string): void; unpushedCount: number; fileCount: number; stagedCount: number; ticketKey: string | null; defaultTitle: string; defaultBody: string; onCommitFirst(): void; onSubmit(input: PushPrInput): Promise<void>; extraOptions?: ReactNode; ruleNote?: string | null })`.

- [x] **Step 1: Tests**

`packages/ui/src/code/pr.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseReviewers, prCommandPreview } from "./pr-command";
import { type PushPrInput, PushPrDialog } from "./PushPrDialog";

test("the command preview mirrors the options", () => {
  expect(prCommandPreview({ remote: "origin", branch: "kib-12", draft: true })).toBe(
    "git push -u origin kib-12 && gh pr create --draft",
  );
  expect(prCommandPreview({ remote: "origin", branch: "kib-12", draft: false })).toBe("git push -u origin kib-12 && gh pr create");
});

test("reviewers accept @logins separated by commas or spaces and flag invalid ones", () => {
  expect(parseReviewers("@adam, @kibo/core  lea")).toEqual({ logins: ["adam", "kibo/core", "lea"], invalid: null });
  expect(parseReviewers("@adam --admin")).toEqual({ logins: ["adam", "--admin"], invalid: "--admin" });
});

function renderDialog(overrides: Partial<Parameters<typeof PushPrDialog>[0]> = {}) {
  const submitted: PushPrInput[] = [];
  const events: string[] = [];
  render(
    <PushPrDialog
      open
      onOpenChange={() => events.push("close")}
      branch="kib-12"
      remote="origin"
      bases={["main", "develop"]}
      base="main"
      onBaseChange={(b) => events.push(`base:${b}`)}
      unpushedCount={2}
      fileCount={3}
      stagedCount={2}
      ticketKey="KIB-12"
      defaultTitle="feat: schéma Loro des tickets (KIB-12)"
      defaultBody="## Ticket\nKIB-12 · Schéma Loro des tickets"
      onCommitFirst={() => events.push("commitFirst")}
      onSubmit={async (input) => {
        submitted.push(input);
      }}
      {...overrides}
    />,
  );
  return { submitted, events };
}

test("the dialog shows the summary, the staged warning and submits the defaults", async () => {
  const { submitted, events } = renderDialog();
  expect(screen.getByText("kib-12 → main · 2 commits non poussés · 3 fichiers")).toBeTruthy();
  expect(screen.getByText("2 fichiers indexés ne sont pas commités : ils ne seront pas dans la PR.")).toBeTruthy();
  expect(screen.getByText("git push -u origin kib-12 && gh pr create --draft")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Commiter d'abord" }));
  expect(events).toEqual(["commitFirst"]);
  await userEvent.type(screen.getByLabelText("Reviewers"), "@adam");
  await userEvent.click(screen.getByRole("checkbox", { name: "Brouillon (draft)" }));
  expect(screen.getByText("git push -u origin kib-12 && gh pr create")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect(submitted).toEqual([
    {
      title: "feat: schéma Loro des tickets (KIB-12)",
      body: "## Ticket\nKIB-12 · Schéma Loro des tickets",
      base: "main",
      draft: false,
      reviewers: ["adam"],
      link: true,
    },
  ]);
});

test("an invalid reviewer blocks the submit, a GitHub failure is shown", async () => {
  renderDialog({ onSubmit: () => Promise.reject(new KiboError("GH_FAILED", "a pull request already exists")) });
  await userEvent.type(screen.getByLabelText("Reviewers"), "--admin");
  expect(screen.getByText("Login GitHub invalide : --admin")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Créer la PR" }).hasAttribute("disabled")).toBe(true);
  await userEvent.clear(screen.getByLabelText("Reviewers"));
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "GitHub a refusé la demande. (a pull request already exists)",
  );
});

test("without a ticket the link option is hidden", () => {
  renderDialog({ ticketKey: null, stagedCount: 0 });
  expect(screen.queryByRole("checkbox", { name: /Lier la PR/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Commiter d'abord" })).toBeNull();
});
```

Run: `bun test packages/ui/src/code/pr.test.tsx`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter**

`packages/ui/src/code/pr-command.ts` :
```ts
import { GhLogin } from "@kibo/schema";

export function prCommandPreview(o: { remote: string; branch: string; draft: boolean }): string {
  return `git push -u ${o.remote} ${o.branch} && gh pr create${o.draft ? " --draft" : ""}`;
}

export function parseReviewers(input: string): { logins: string[]; invalid: string | null } {
  const logins = input
    .split(/[\s,]+/)
    .map((s) => s.replace(/^@/, ""))
    .filter(Boolean);
  return { logins, invalid: logins.find((l) => !GhLogin.safeParse(l).success) ?? null };
}
```

`packages/ui/src/code/PushPrDialog.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { GitBranch, GitPullRequest, SquareTerminal, TriangleAlert, User } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { parseReviewers, prCommandPreview } from "./pr-command";

export type PushPrInput = { title: string; body: string; base: string; draft: boolean; reviewers: string[]; link: boolean };

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
  branch: string;
  remote: string;
  bases: string[];
  base: string;
  onBaseChange(base: string): void;
  unpushedCount: number;
  fileCount: number;
  stagedCount: number;
  ticketKey: string | null;
  defaultTitle: string;
  defaultBody: string;
  onCommitFirst(): void;
  onSubmit(input: PushPrInput): Promise<void>;
  extraOptions?: ReactNode;
  ruleNote?: string | null;
};

export function PushPrDialog(p: Props) {
  const id = useId();
  const [title, setTitle] = useState(p.defaultTitle);
  const [body, setBody] = useState(p.defaultBody);
  const [reviewers, setReviewers] = useState("");
  const [draft, setDraft] = useState(true);
  const [link, setLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseReviewers(reviewers);

  useEffect(() => {
    if (!p.open) return;
    setTitle(p.defaultTitle);
    setBody(p.defaultBody);
    setError(null);
  }, [p.open, p.defaultTitle, p.defaultBody]);

  const submit = () => {
    setBusy(true);
    setError(null);
    p.onSubmit({ title, body, base: p.base, draft, reviewers: parsed.logins, link: link && p.ticketKey !== null }).then(
      () => setBusy(false),
      (e: unknown) => {
        setError(errorMessage(e));
        setBusy(false);
      },
    );
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{fr.pr.title}</DialogTitle>
          <DialogDescription>{fr.pr.subtitle(p.branch, p.base, p.unpushedCount, p.fileCount)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-title`}>{fr.pr.prTitle}</Label>
          <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-body`}>{fr.pr.description}</Label>
          <Textarea id={`${id}-body`} className="min-h-64 font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-base`}>{fr.pr.base}</Label>
            <Select value={p.base} onValueChange={p.onBaseChange}>
              <SelectTrigger id={`${id}-base`} className="w-full">
                <GitBranch aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {p.bases.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-reviewers`}>{fr.pr.reviewers}</Label>
            <div className="relative">
              <User aria-hidden className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id={`${id}-reviewers`}
                className="pl-9"
                placeholder={fr.pr.reviewersPlaceholder}
                value={reviewers}
                onChange={(e) => setReviewers(e.target.value)}
                aria-invalid={parsed.invalid !== null}
              />
            </div>
            {parsed.invalid && <p className="text-xs text-destructive">{fr.pr.invalidReviewer(parsed.invalid)}</p>}
          </div>
        </div>
        {p.stagedCount > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{fr.pr.staged(p.stagedCount)}</span>
            <Button variant="outline" size="sm" onClick={p.onCommitFirst}>
              {fr.pr.commitFirst}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox id={`${id}-draft`} checked={draft} onCheckedChange={(v) => setDraft(v === true)} />
            <Label htmlFor={`${id}-draft`} className="font-normal">
              {fr.pr.draft}
            </Label>
          </div>
          {p.ticketKey && (
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-link`} checked={link} onCheckedChange={(v) => setLink(v === true)} />
              <Label htmlFor={`${id}-link`} className="font-normal">
                {fr.pr.link(p.ticketKey)}
              </Label>
            </div>
          )}
          {p.extraOptions}
        </div>
        {p.ruleNote && <p className="text-xs text-muted-foreground">{p.ruleNote}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <code className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            <SquareTerminal aria-hidden className="size-4 shrink-0" />
            {prCommandPreview({ remote: p.remote, branch: p.branch, draft })}
          </code>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => p.onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button disabled={busy || parsed.invalid !== null || title.trim().length === 0} onClick={submit}>
              <GitPullRequest />
              {busy ? fr.pr.creating : fr.pr.submit}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/ui/src/code/pr.test.tsx && bun run check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/ui/src/code/pr-command.ts packages/ui/src/code/PushPrDialog.tsx packages/ui/src/code/pr.test.tsx
git commit -m "feat(ui): dialogue de création de PR"
```

---

### Task 15: Lecture du dépôt (worktrees, état, diff, fichier)

**Files:**
- Create: `packages/daemon/src/code/repo.ts`, `packages/daemon/src/code/read.ts`, `packages/daemon/src/code/read.test.ts`

**Interfaces:**
- Consumes: `createGit`, `Env`, `firstLine`, `resolveInWorktree` (tâche 3) ; `parseStatus`, `parseNumstat`, `parseWorktrees`, `parseDiff`, `LOG_FORMAT`, `parseLog` (tâche 4) ; types de la tâche 1.
- Produces :
  - `type WorktreeHandle = { path: string; git: Git; gitDir: string; commonDir: string; env: Env }` ; `type Repo = { root: string; worktrees(): Promise<Worktree[]>; open(path: string): Promise<WorktreeHandle> }` ; `openRepo(folder: string | null, env?: Env): Promise<Repo>` ;
  - `MAX_FILE_BYTES = 1_000_000` ; `sha1(bytes: Uint8Array): string` ;
  - `hasHead(h): Promise<boolean>`, `isPushed(h, sha: string): Promise<boolean>`, `currentOperation(h): Promise<GitOperation | null>`, `currentBranch(h): Promise<string | null>`, `pushRemote(h, branch: string | null): Promise<string | null>` ;
  - `readStatus(h): Promise<RepoStatus>`, `readDiff(h, path: string, origPath: string | null, area: ChangeArea): Promise<FileDiff>`, `readFile(h, path: string, revision: FileRevision): Promise<FileContent>`, `remoteBranches(h): Promise<RemoteBranches>`, `compare(h, base: string): Promise<CompareResult>`, `headCommit(h): Promise<CommitInfo>`.

- [x] **Step 1: Tests**

`packages/daemon/src/code/read.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compare, currentOperation, readDiff, readFile, readStatus, remoteBranches, sha1 } from "./read";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "src/ticket.ts": lines(40), "src/legacy.ts": "old\n", "README.md": "# kibo\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

describe("openRepo", () => {
  test("a folder that is not a repository, or no folder, is refused", async () => {
    const plain = join(fx.dir, "plain");
    mkdirSync(plain);
    await expect(openRepo(plain, fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
    await expect(openRepo(null, fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
    await expect(openRepo(join(fx.dir, "missing"), fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
  });

  test("only registered worktrees can be opened", async () => {
    const wt = join(fx.dir, "wt-kib-12");
    fx.git("worktree", "add", "-q", "-b", "kib-12", wt);
    const repo = await openRepo(join(fx.repo, "src"), fx.env);
    expect(repo.root).toBe(fx.repo);
    expect((await repo.worktrees()).map((w) => [w.path, w.branch, w.isMain])).toEqual([
      [fx.repo, "main", true],
      [wt, "kib-12", false],
    ]);
    expect((await repo.open(wt)).gitDir).toBe(join(fx.repo, ".git/worktrees/wt-kib-12"));
    await expect(repo.open(fx.dir)).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
    await expect(repo.open(join(fx.repo, "src"))).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
});

describe("readStatus", () => {
  test("files are listed per area with line counts", async () => {
    fx.write("src/ticket.ts", lines(40).replace("line 1\n", "LINE 1\nnew\n"));
    fx.git("add", "src/ticket.ts");
    fx.write("README.md", "# kibo\nmore\n");
    fx.write("src/tree.ts", "a\nb\nc\n");
    rmSync(join(fx.repo, "src/legacy.ts"));
    const s = await readStatus(h);
    expect(s).toMatchObject({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, hasHead: true, operation: null });
    expect(s.files).toEqual([
      { path: "README.md", origPath: null, area: "unstaged", kind: "modified", additions: 1, deletions: 0 },
      { path: "src/legacy.ts", origPath: null, area: "unstaged", kind: "deleted", additions: 0, deletions: 1 },
      { path: "src/ticket.ts", origPath: null, area: "staged", kind: "modified", additions: 2, deletions: 1 },
      { path: "src/tree.ts", origPath: null, area: "unstaged", kind: "untracked", additions: 3, deletions: 0 },
    ]);
  });

  test("unpushed commits come first, then the last pushed one", async () => {
    const pushedHead = fx.git("rev-parse", "HEAD").trim();
    fx.commit("feat: opérations move", { "src/a.ts": "a\n" });
    fx.commit("test: convergence", { "src/b.ts": "b\n" });
    const s = await readStatus(h);
    expect(s.ahead).toBe(2);
    expect(s.commits.map((c) => [c.subject, c.pushed])).toEqual([
      ["test: convergence", false],
      ["feat: opérations move", false],
      ["chore: init", true],
    ]);
    expect(s.commits[2]?.sha).toBe(pushedHead);
  });

  test("an empty repository has no head and no commits", async () => {
    const empty = createGitFixture({ remote: false });
    empty.write("a.txt", "a\n");
    const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
    expect(await readStatus(eh)).toMatchObject({ hasHead: false, commits: [], ahead: 0, branch: "main" });
    empty.cleanup();
  });

  test("a merge conflict is reported as an operation with conflicted files", async () => {
    fx.git("checkout", "-q", "-b", "other");
    fx.commit("other", { "README.md": "# other\n" });
    fx.git("checkout", "-q", "main");
    fx.commit("main", { "README.md": "# main\n" });
    Bun.spawnSync(["git", "merge", "other"], { cwd: fx.repo, env: { ...process.env, ...fx.env } });
    expect(await currentOperation(h)).toBe("merge");
    expect((await readStatus(h)).files).toContainEqual({
      path: "README.md",
      origPath: null,
      area: "unstaged",
      kind: "conflicted",
      additions: null,
      deletions: null,
    });
  });
});

describe("readDiff", () => {
  test("staged, unstaged and untracked diffs", async () => {
    fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n"));
    fx.git("add", "src/ticket.ts");
    fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n").replace("line 39\n", "LINE 39\n"));
    fx.write("src/tree.ts", "a\nb\n");
    const staged = await readDiff(h, "src/ticket.ts", null, "staged");
    expect(staged.hunks.map((x) => x.header)).toEqual(["@@ -1,5 +1,5 @@"]);
    const unstaged = await readDiff(h, "src/ticket.ts", null, "unstaged");
    expect(unstaged).toMatchObject({ hunkStaging: true, additions: 1, deletions: 1 });
    expect(unstaged.hunks[0]?.header).toBe("@@ -36,5 +36,5 @@ line 35");
    const untracked = await readDiff(h, "src/tree.ts", null, "unstaged");
    expect(untracked).toMatchObject({ hunkStaging: false, additions: 2 });
  });

  test("paths outside the worktree are refused", async () => {
    await expect(readDiff(h, "../x", null, "unstaged")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
});

describe("readFile", () => {
  test("worktree, index and HEAD revisions with metadata", async () => {
    fx.write("README.md", "# kibo\nstaged\n");
    fx.git("add", "README.md");
    fx.write("README.md", "# kibo\nstaged\nworktree\n");
    const w = await readFile(h, "README.md", "worktree");
    expect(w).toMatchObject({ content: "# kibo\nstaged\nworktree\n", lines: 3, tracked: true, dirty: true, binary: false });
    expect(w.hash).toBe(sha1(new TextEncoder().encode("# kibo\nstaged\nworktree\n")));
    expect(w.modifiedAt).toBeGreaterThan(0);
    expect((await readFile(h, "README.md", "index")).content).toBe("# kibo\nstaged\n");
    expect((await readFile(h, "README.md", "head")).content).toBe("# kibo\n");
  });

  test("binary, too large, missing and forbidden files", async () => {
    writeFileSync(join(fx.repo, "logo.png"), new Uint8Array([137, 80, 78, 71, 0, 1, 2]));
    expect(await readFile(h, "logo.png", "worktree")).toMatchObject({ binary: true, content: null });
    writeFileSync(join(fx.repo, "big.txt"), "x".repeat(1_000_001));
    expect(await readFile(h, "big.txt", "worktree")).toMatchObject({ tooLarge: true, content: null, hash: null });
    expect((await readFile(h, "new.ts", "head")).content).toBe("");
    await expect(readFile(h, "missing.ts", "worktree")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFile(h, ".git/config", "worktree")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
});

test("remote branches and comparison with a base", async () => {
  fx.git("checkout", "-q", "-b", "kib-12");
  fx.commit("feat: a", { "src/a.ts": "a\n" });
  fx.commit("feat: b", { "src/b.ts": "b\n", "src/a.ts": "a2\n" });
  expect(await remoteBranches(h)).toEqual({ remote: "origin", branches: ["main"], defaultBase: "main" });
  const c = await compare(h, "main");
  expect(c.commits.map((x) => x.subject)).toEqual(["feat: b", "feat: a"]);
  expect(c.fileCount).toBe(2);
  await expect(compare(h, "--output=/tmp/x")).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
```

Run: `bun test packages/daemon/src/code/read.test.ts`
Expected: FAIL, modules introuvables.

- [x] **Step 2: Implémenter le dépôt**

`packages/daemon/src/code/repo.ts` :
```ts
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { KiboError, type Worktree } from "@kibo/schema";
import { parseWorktrees } from "./parse-status";
import { createGit, type Env, type Git } from "./run";

export type WorktreeHandle = { path: string; git: Git; gitDir: string; commonDir: string; env: Env };
export type Repo = { root: string; worktrees(): Promise<Worktree[]>; open(path: string): Promise<WorktreeHandle> };

const real = (path: string): string | null => (existsSync(path) ? realpathSync(path) : null);

export async function openRepo(folder: string | null, env: Env = {}): Promise<Repo> {
  if (!folder || !existsSync(folder)) throw new KiboError("NOT_A_REPO", `project folder ${folder ?? "(none)"} does not exist`);
  const top = await createGit(folder, env).run(["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) throw new KiboError("NOT_A_REPO", `${folder} is not a git repository`);
  const root = realpathSync(top.stdout.trim());
  const git = createGit(root, env);
  const worktrees = async () =>
    parseWorktrees(await git.ok(["worktree", "list", "--porcelain", "-z"])).map((w) => ({ ...w, path: real(w.path) ?? w.path }));
  return {
    root,
    worktrees,
    async open(path) {
      const wanted = real(path);
      const match = wanted ? (await worktrees()).find((w) => w.path === wanted) : undefined;
      if (!wanted || !match) throw new KiboError("PATH_OUTSIDE_PROJECT", `${path} is not a worktree of ${root}`);
      const wgit = createGit(wanted, env);
      const [gitDir = "", commonDir = ""] = (await wgit.ok(["rev-parse", "--absolute-git-dir", "--git-common-dir"])).trim().split("\n");
      return { path: wanted, git: wgit, gitDir, commonDir: resolve(wanted, commonDir), env };
    },
  };
}
```

- [x] **Step 3: Implémenter les lectures**

`packages/daemon/src/code/read.ts` :
```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  type ChangeArea,
  type CommitInfo,
  type CompareResult,
  type FileChange,
  type FileContent,
  type FileDiff,
  type FileRevision,
  type GitOperation,
  KiboError,
  type RemoteBranches,
  type RepoStatus,
} from "@kibo/schema";
import { parseDiff } from "./parse-diff";
import { LOG_FORMAT, parseLog } from "./parse-log";
import { type LineCounts, parseNumstat, parseStatus } from "./parse-status";
import type { WorktreeHandle } from "./repo";
import { firstLine } from "./run";
import { resolveInWorktree } from "./safe-path";

export const MAX_FILE_BYTES = 1_000_000;
const MAX_UNPUSHED = 50;
const NO_COUNTS: LineCounts = { additions: null, deletions: null };
const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "--no-textconv", "-U3"];
const REMOTE_NAME = /^[A-Za-z0-9._][A-Za-z0-9._-]*$/;

export const sha1 = (bytes: Uint8Array): string => new Bun.CryptoHasher("sha1").update(bytes).digest("hex");

export async function hasHead(h: WorktreeHandle): Promise<boolean> {
  return (await h.git.run(["rev-parse", "--verify", "-q", "HEAD"])).code === 0;
}

export async function isPushed(h: WorktreeHandle, sha: string): Promise<boolean> {
  return (await h.git.ok(["for-each-ref", "--contains", sha, "--format=%(refname)", "refs/remotes"])).trim().length > 0;
}

export async function currentOperation(h: WorktreeHandle): Promise<GitOperation | null> {
  const has = (name: string) => existsSync(join(h.gitDir, name));
  if (has("rebase-merge") || has("rebase-apply")) return "rebase";
  if (has("MERGE_HEAD")) return "merge";
  if (has("CHERRY_PICK_HEAD")) return "cherry-pick";
  if (has("REVERT_HEAD")) return "revert";
  return null;
}

export async function currentBranch(h: WorktreeHandle): Promise<string | null> {
  return (await h.git.run(["symbolic-ref", "--short", "-q", "HEAD"])).stdout.trim() || null;
}

export async function pushRemote(h: WorktreeHandle, branch: string | null): Promise<string | null> {
  const remotes = (await h.git.ok(["remote"])).split("\n").filter((r) => REMOTE_NAME.test(r));
  const configured = branch ? (await h.git.run(["config", "--get", `branch.${branch}.remote`])).stdout.trim() : "";
  if (remotes.includes(configured)) return configured;
  return remotes.includes("origin") ? "origin" : (remotes[0] ?? null);
}

async function unpushedList(h: WorktreeHandle): Promise<string[]> {
  if (!(await hasHead(h))) return [];
  return (await h.git.ok(["rev-list", `--max-count=${MAX_UNPUSHED}`, "HEAD", "--not", "--remotes"])).split("\n").filter(Boolean);
}

async function log(h: WorktreeHandle, args: string[], unpushed: Set<string>): Promise<CommitInfo[]> {
  return parseLog(await h.git.ok(["log", `--format=${LOG_FORMAT}`, ...args]), (sha) => !unpushed.has(sha));
}

export async function headCommit(h: WorktreeHandle): Promise<CommitInfo> {
  const [commit] = await log(h, ["-1", "HEAD"], new Set(await unpushedList(h)));
  if (!commit) throw new KiboError("GIT_FAILED", "HEAD has no commit");
  return commit;
}

async function numstat(h: WorktreeHandle, args: string[]): Promise<Map<string, LineCounts>> {
  return parseNumstat(await h.git.ok(args));
}

function untrackedCounts(root: string, path: string): LineCounts {
  const abs = join(root, path);
  if (!existsSync(abs) || statSync(abs).size > MAX_FILE_BYTES) return NO_COUNTS;
  const bytes = new Uint8Array(readFileSync(abs));
  if (bytes.subarray(0, 8000).includes(0)) return NO_COUNTS;
  const text = new TextDecoder().decode(bytes);
  return { additions: text.split("\n").length - (text.endsWith("\n") ? 1 : 0), deletions: 0 };
}

export async function readStatus(h: WorktreeHandle): Promise<RepoStatus> {
  const parsed = parseStatus(await h.git.ok(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"]));
  const head = parsed.head !== null;
  const [staged, unstaged] = await Promise.all([
    numstat(h, ["diff", "--cached", "--numstat", "-z", "-M"]),
    numstat(h, ["diff", "--numstat", "-z"]),
  ]);
  const files: FileChange[] = [];
  for (const e of parsed.entries) {
    if (e.staged) files.push({ path: e.path, origPath: e.origPath, area: "staged", kind: e.staged, ...(staged.get(e.path) ?? NO_COUNTS) });
    if (e.unstaged) {
      const counts =
        e.unstaged === "untracked"
          ? untrackedCounts(h.path, e.path)
          : e.unstaged === "conflicted"
            ? NO_COUNTS
            : (unstaged.get(e.path) ?? NO_COUNTS);
      files.push({ path: e.path, origPath: null, area: "unstaged", kind: e.unstaged, ...counts });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path) || a.area.localeCompare(b.area));
  const list = head ? await unpushedList(h) : [];
  const ahead = head ? Number((await h.git.ok(["rev-list", "--count", "HEAD", "--not", "--remotes"])).trim()) : 0;
  const commits = head ? await log(h, ["--first-parent", `--max-count=${list.length + 1}`, "HEAD"], new Set(list)) : [];
  return {
    worktree: h.path,
    branch: parsed.branch,
    upstream: parsed.upstream,
    ahead,
    behind: parsed.behind,
    hasHead: head,
    operation: await currentOperation(h),
    files,
    commits,
  };
}

export async function readDiff(h: WorktreeHandle, path: string, origPath: string | null, area: ChangeArea): Promise<FileDiff> {
  resolveInWorktree(h.path, path);
  if (origPath) resolveInWorktree(h.path, origPath);
  if (area === "staged") {
    const raw = await h.git.ok(["diff", "--cached", "-M", ...DIFF_FLAGS, "--", path, ...(origPath ? [origPath] : [])]);
    return parseDiff(raw, path, origPath);
  }
  if ((await h.git.run(["ls-files", "--error-unmatch", "--", path])).code === 0) {
    return parseDiff(await h.git.ok(["diff", ...DIFF_FLAGS, "--", path]), path, null);
  }
  const r = await h.git.run(["diff", "--no-index", ...DIFF_FLAGS, "--", "/dev/null", path]);
  if (r.code > 1) throw new KiboError("GIT_FAILED", `git diff: ${firstLine(r.stderr)}`);
  return { ...parseDiff(r.stdout, path, null), hunkStaging: false };
}

function describe(
  path: string,
  revision: FileRevision,
  bytes: Uint8Array,
  meta: { modifiedAt: number | null; tracked: boolean; dirty: boolean },
): FileContent {
  const binary = bytes.subarray(0, 8000).includes(0);
  const content = binary ? null : new TextDecoder().decode(bytes);
  const lines = content === null ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
  return { path, revision, content, hash: sha1(bytes), size: bytes.length, binary, tooLarge: false, lines, ...meta };
}

export async function readFile(h: WorktreeHandle, path: string, revision: FileRevision): Promise<FileContent> {
  const abs = resolveInWorktree(h.path, path);
  const tracked = (await h.git.run(["ls-files", "--error-unmatch", "--", path])).code === 0;
  const dirty = (await h.git.ok(["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", path])).length > 0;
  if (revision !== "worktree") {
    const r = await h.git.run(["show", revision === "index" ? `:${path}` : `HEAD:${path}`]);
    return describe(path, revision, r.code === 0 ? r.bytes : new Uint8Array(), { modifiedAt: null, tracked, dirty });
  }
  if (!existsSync(abs)) throw new KiboError("NOT_FOUND", `${path} does not exist`);
  const stat = statSync(abs);
  const modifiedAt = Math.round(stat.mtimeMs);
  if (stat.size > MAX_FILE_BYTES) {
    return { path, revision, content: null, hash: null, size: stat.size, binary: false, tooLarge: true, lines: 0, modifiedAt, tracked, dirty };
  }
  return describe(path, revision, new Uint8Array(readFileSync(abs)), { modifiedAt, tracked, dirty });
}

export async function remoteBranches(h: WorktreeHandle): Promise<RemoteBranches> {
  const remote = await pushRemote(h, await currentBranch(h));
  if (!remote) return { remote: null, branches: [], defaultBase: null };
  const branches = (await h.git.ok(["for-each-ref", "--format=%(refname:strip=3)", `refs/remotes/${remote}`]))
    .split("\n")
    .filter((b) => b && b !== "HEAD");
  const head = (await h.git.run(["symbolic-ref", "--short", "-q", `refs/remotes/${remote}/HEAD`])).stdout.trim().slice(remote.length + 1);
  const defaultBase = [head, "main", "master"].find((b) => branches.includes(b)) ?? branches[0] ?? null;
  return { remote, branches, defaultBase };
}

export async function compare(h: WorktreeHandle, base: string): Promise<CompareResult> {
  const { remote, branches } = await remoteBranches(h);
  if (!remote || !branches.includes(base)) throw new KiboError("INVALID_INPUT", `${base} is not a branch of the remote`);
  const ref = `refs/remotes/${remote}/${base}`;
  const commits = await log(h, ["--max-count=100", `${ref}..HEAD`], new Set(await unpushedList(h)));
  const files = (await h.git.ok(["diff", "--name-only", "-z", `${ref}...HEAD`])).split("\0").filter(Boolean);
  return { commits, fileCount: files.length };
}
```

- [x] **Step 4: Lancer les tests**

Run: `bun test packages/daemon/src/code/read.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/daemon/src/code/repo.ts packages/daemon/src/code/read.ts packages/daemon/src/code/read.test.ts
git commit -m "feat(daemon): lecture de l'état git"
```

---

### Task 16: Vue Changements (composition)

Écran 21 (PDF page 34) complet, en sombre et en clair : fil d'Ariane fourni par le shell ; colonne gauche (sélecteur de worktree `worktree kib-12 ▾ ↑2`, fichiers) ; centre (barre du diff, diff ou éditeur) ; droite (Commit, commits non poussés, « Pousser » et « Pousser et créer la PR » en bas). États : dépôt absent, worktree propre, opération en cours, erreur.

**Files:**
- Create: `packages/ui/src/code/use-code.ts`, `packages/ui/src/code/WorktreePicker.tsx`, `packages/ui/src/code/DiffEditorPane.tsx`, `packages/ui/src/code/ChangesView.tsx`, `packages/ui/src/code/changes.test.tsx`

**Interfaces:**
- Consumes: `client.code`, `client.subscribeCode` (tâche 1) ; `FileList`, `DiffView`, `DiffToolbar`, `DiffMode`, `FileSelection` (tâche 11) ; `CodeEditor`, `useWorktrees`, `resolveWorktree` (tâche 12) ; `CommitPanel`, `UnpushedCommits` (tâche 13) ; `PushPrDialog`, `PushPrInput` (tâche 14) ; `DropdownMenu*` ; `errorMessage`.
- Produces :
  - `useCodeStatus(projectId: string, worktree: string): { status: RepoStatus | null; error: string | null; reload(): void }` ;
  - `useFileDiff(projectId: string, worktree: string, selection: FileSelection | null, origPath: string | null, version: string): { diff: FileDiff | null; error: string | null; reload(): void }` ;
  - `useCommitDefaults(projectId: string, worktree: string, key: string): { defaults: CommitDefaults | null; error: string | null }` ;
  - `useRemoteInfo(projectId: string, worktree: string, branch: string | null): { remote: RemoteBranches | null; gh: GhStatus | null; pr: PrInfo | null; error: string | null; refresh(): void }` ;
  - `WorktreePicker(props: { worktrees: Worktree[]; current: Worktree; ahead: number; onChange(path: string): void })` ;
  - `DiffEditorPane(props: { projectId: string; worktree: string; path: string; layout: "unified" | "split"; onSaved(): void })` ;
  - `type ChangesSlots = { commitBanner?: ReactNode; prOptions?: ReactNode; prRuleNote?: string | null }` ;
  - `ChangesView(props: { project: ProjectSnapshot; worktree: string | null; onWorktreeChange(path: string): void; onOpenFile(ref: FileRef): void; slots?: ChangesSlots })`.

- [x] **Step 1: Tests**

`packages/ui/src/code/changes.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import {
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  type FileDiff,
  KiboError,
  type ProjectSnapshot,
  type RepoStatus,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: CodeRequest[] = [];
const listeners = new Set<(e: CodeEvent) => void>();
let status: RepoStatus;
let overrides: Partial<Record<CodeRequest["method"], () => Promise<unknown>>> = {};
const diff: FileDiff = {
  path: "packages/core/ticket.ts",
  origPath: null,
  binary: false,
  hunkStaging: true,
  additions: 1,
  deletions: 1,
  hunks: [
    {
      header: "@@ -1,2 +1,2 @@",
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      section: "",
      lines: [
        { kind: "del", text: "a", oldNo: 1, newNo: null, noEol: false },
        { kind: "add", text: "b", oldNo: null, newNo: 1, noEol: false },
        { kind: "context", text: "c", oldNo: 2, newNo: 2, noEol: false },
      ],
    },
  ],
};
const baseStatus: RepoStatus = {
  worktree: "/repo",
  branch: "kib-12",
  upstream: null,
  ahead: 1,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [
    { path: "packages/core/ticket.ts", origPath: null, area: "staged", kind: "modified", additions: 1, deletions: 1 },
    { path: "packages/core/index.ts", origPath: null, area: "unstaged", kind: "modified", additions: 3, deletions: 1 },
  ],
  commits: [
    { sha: "a".repeat(40), shortSha: "aaaaaaa", subject: "feat: move", body: "", author: "Adam", time: 0, pushed: false },
    { sha: "b".repeat(40), shortSha: "bbbbbbb", subject: "chore: init", body: "", author: "Adam", time: 0, pushed: true },
  ],
};
const responses: Record<string, () => unknown> = {
  worktrees: () => [{ path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true }],
  status: () => status,
  diff: () => diff,
  commitDefaults: () => ({
    ticketId: "12@1",
    ticketKey: "KIB-12",
    message: "feat: schéma Loro des tickets (KIB-12)",
    prTitle: "feat: schéma Loro des tickets (KIB-12)",
    prBody: "## Ticket\nKIB-12 · Schéma",
  }),
  remoteBranches: () => ({ remote: "origin", branches: ["main"], defaultBase: "main" }),
  ghStatus: () => ({ available: true, detail: null }),
  prForBranch: () => null,
  compare: () => ({ commits: [], fileCount: 3 }),
  createPr: () => ({ number: 7, url: "https://github.com/kibo/test/pull/7", state: "draft" }),
};
mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => {
      calls.push(req);
      const override = overrides[req.method];
      if (override) return override();
      return Promise.resolve(responses[req.method]?.() ?? null);
    },
    subscribeCode: (l: (e: CodeEvent) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));
const { ChangesView } = await import("./ChangesView");

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: "/repo", color: "#F97316" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  nextTicketKey: "KIB-1",
};
const count = (method: CodeRequest["method"]) => calls.filter((c) => c.method === method).length;

beforeEach(() => {
  calls.length = 0;
  overrides = {};
  status = baseStatus;
});

const renderView = () => render(<ChangesView project={project} worktree={null} onWorktreeChange={() => {}} onOpenFile={() => {}} />);

test("the first staged file is selected, its diff shown and the message pre-filled", async () => {
  renderView();
  expect(await screen.findByRole("region", { name: "@@ -1,2 +1,2 @@" })).toBeTruthy();
  expect(calls.find((c) => c.method === "diff")).toMatchObject({ path: "packages/core/ticket.ts", area: "staged" });
  expect(screen.getByLabelText("Message")).toHaveProperty("value", "feat: schéma Loro des tickets (KIB-12)");
  expect(screen.getByRole("button", { name: /worktree kib-12/ })).toBeTruthy();
});

test("a stale hunk shows an alert and reloads the diff", async () => {
  overrides = { stageHunk: () => Promise.reject(new KiboError("GIT_STALE", "changed")) };
  renderView();
  await userEvent.click(await screen.findByRole("button", { name: "Désindexer le bloc" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Le diff a changé entre-temps : il a été rechargé.");
  expect(calls.find((c) => c.method === "stageHunk")).toMatchObject({ index: 0, header: "@@ -1,2 +1,2 @@", area: "staged" });
  await waitFor(() => expect(count("diff")).toBeGreaterThanOrEqual(2));
});

test("committing sends the message, then clears it; Modifier loads the last commit into amend mode", async () => {
  renderView();
  await userEvent.click(await screen.findByRole("button", { name: /Commit sur kib-12/ }));
  expect(calls.find((c) => c.method === "commit")).toEqual({
    method: "commit",
    projectId: "p1",
    worktree: "/repo",
    message: "feat: schéma Loro des tickets (KIB-12)",
    amend: false,
  });
  const latest = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("feat: move"));
  if (!latest) throw new Error("unpushed commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Modifier" }));
  expect(screen.getByLabelText("Message")).toHaveProperty("value", "feat: move");
  expect(screen.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" }).getAttribute("aria-checked")).toBe("true");
});

test("a code event reloads the status", async () => {
  renderView();
  await screen.findByRole("region", { name: "@@ -1,2 +1,2 @@" });
  const before = count("status");
  act(() => {
    for (const l of listeners) l({ type: "code", projectId: "p1", worktree: "/repo" });
  });
  await waitFor(() => expect(count("status")).toBeGreaterThan(before));
});

test("push and PR creation link the ticket; gh missing disables the PR button", async () => {
  renderView();
  await userEvent.click(await screen.findByRole("button", { name: "Pousser" }));
  expect(count("push")).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "Pousser et créer la PR" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("kib-12 → main · 1 commit non poussé · 3 fichiers")).toBeTruthy();
  await userEvent.click(within(dialog).getByRole("button", { name: "Créer la PR" }));
  await waitFor(() => expect(count("createPr")).toBe(1));
  expect(calls.find((c) => c.method === "createPr")).toMatchObject({ base: "main", draft: true, ticketId: "12@1" });
  expect(await screen.findByText("PR #7 créée")).toBeTruthy();
});

test("without gh the PR button is disabled with an explanation, detached HEAD cannot push", async () => {
  overrides = { ghStatus: () => Promise.resolve({ available: false, detail: "gh: command not found" }) };
  status = { ...baseStatus, branch: null };
  renderView();
  const pr = await screen.findByRole("button", { name: "Pousser et créer la PR" });
  await waitFor(() => expect(pr.hasAttribute("disabled")).toBe(true));
  expect(pr.closest("[title]")?.getAttribute("title")).toBe("HEAD détachée : impossible de pousser.");
  expect(screen.getByRole("button", { name: "Pousser" }).hasAttribute("disabled")).toBe(true);
});

test("a project without repository explains how to link one", async () => {
  overrides = { worktrees: () => Promise.reject(new KiboError("NOT_A_REPO", "no folder")) };
  renderView();
  expect(await screen.findByText(/Ce projet n'est lié à aucun dépôt git/)).toBeTruthy();
});

test("an operation in progress shows a banner with an abort action", async () => {
  status = { ...baseStatus, operation: "merge" };
  renderView();
  expect(await screen.findByText(/Fusion en cours/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Abandonner" }));
  expect(count("abortOperation")).toBe(1);
});
```

Run: `bun test packages/ui/src/code/changes.test.tsx`
Expected: FAIL, `./ChangesView` introuvable.

- [x] **Step 2: Implémenter les hooks**

`packages/ui/src/code/use-code.ts` :
```ts
import type { ChangeArea, CommitDefaults, FileDiff, GhStatus, PrInfo, RemoteBranches, RepoStatus } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

function useCodeEvents(projectId: string, worktree: string, onEvent: () => void): void {
  useEffect(
    () =>
      client.subscribeCode((e) => {
        if (e.projectId === projectId && e.worktree === worktree) onEvent();
      }),
    [projectId, worktree, onEvent],
  );
}

export function useCodeStatus(projectId: string, worktree: string) {
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    client.code({ method: "status", projectId, worktree }).then(
      (s) => {
        setStatus(s);
        setError(null);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [projectId, worktree]);
  useEffect(reload, [reload]);
  useCodeEvents(projectId, worktree, reload);
  return { status, error, reload };
}

export function useFileDiff(
  projectId: string,
  worktree: string,
  selection: { path: string; area: ChangeArea } | null,
  origPath: string | null,
  version: string,
) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const path = selection?.path ?? null;
  const area = selection?.area ?? null;
  useEffect(() => {
    if (!path || !area || tick < 0 || !version) {
      setDiff(null);
      return;
    }
    let alive = true;
    client.code({ method: "diff", projectId, worktree, path, origPath, area }).then(
      (d) => {
        if (!alive) return;
        setDiff(d);
        setError(null);
      },
      (e: unknown) => {
        if (!alive) return;
        setDiff(null);
        setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, path, area, origPath, version, tick]);
  return { diff, error, reload: () => setTick((t) => t + 1) };
}

export function useCommitDefaults(projectId: string, worktree: string, key: string) {
  const [defaults, setDefaults] = useState<CommitDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    client.code({ method: "commitDefaults", projectId, worktree }).then(
      (d) => alive && setDefaults(d),
      (e: unknown) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, key]);
  return { defaults, error };
}

export function useRemoteInfo(projectId: string, worktree: string, branch: string | null) {
  const [remote, setRemote] = useState<RemoteBranches | null>(null);
  const [gh, setGh] = useState<GhStatus | null>(null);
  const [pr, setPr] = useState<PrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick < 0) return;
    let alive = true;
    const fail = (e: unknown) => alive && setError(errorMessage(e));
    client.code({ method: "remoteBranches", projectId, worktree }).then((r) => alive && setRemote(r), fail);
    client.code({ method: "ghStatus", projectId, worktree }).then((g) => {
      if (!alive) return;
      setGh(g);
      if (g.available && branch)
        client.code({ method: "prForBranch", projectId, worktree }).then((p) => alive && setPr(p), fail);
    }, fail);
    return () => {
      alive = false;
    };
  }, [projectId, worktree, branch, tick]);
  return { remote, gh, pr, error, refresh: () => setTick((t) => t + 1) };
}
```
Chaque hook expose son erreur ; la vue affiche la première dans son alerte. `gh` indisponible n'est pas une erreur : c'est un état (`available: false`) expliqué en infobulle du bouton.

- [x] **Step 3: Implémenter le sélecteur et l'éditeur de diff**

`packages/ui/src/code/WorktreePicker.tsx` :
```tsx
import type { Worktree } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Check, ChevronDown, GitBranch } from "lucide-react";
import { fr } from "../i18n/fr";

type Props = { worktrees: Worktree[]; current: Worktree; ahead: number; onChange(path: string): void };

const labelOf = (w: Worktree) => fr.changes.worktree(w.branch ?? fr.changes.detached);

export function WorktreePicker({ worktrees, current, ahead, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 font-mono text-sm">
          <GitBranch aria-hidden />
          <span className="truncate">{labelOf(current)}</span>
          <ChevronDown aria-hidden className="size-3.5" />
          {ahead > 0 && <span className="ml-auto text-orange-600 dark:text-orange-400">↑{ahead}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>{fr.changes.worktreePicker}</DropdownMenuLabel>
        {worktrees.map((w) => (
          <DropdownMenuItem key={w.path} onSelect={() => onChange(w.path)}>
            {w.path === current.path ? <Check /> : <span className="size-4" />}
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-sm">{labelOf(w)}</span>
              <span className="truncate text-xs text-muted-foreground">{w.path}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

`packages/ui/src/code/DiffEditorPane.tsx` :
```tsx
import { type FileContent, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { RotateCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { CodeEditor } from "../files/CodeEditor";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";

type Props = { projectId: string; worktree: string; path: string; layout: "unified" | "split"; onSaved(): void };

export function DiffEditorPane({ projectId, worktree, path, layout, onSaved }: Props) {
  const [files, setFiles] = useState<{ original: FileContent; current: FileContent } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (version < 0) return;
    let alive = true;
    const read = (revision: "index" | "worktree") => client.code({ method: "readFile", projectId, worktree, path, revision });
    Promise.all([read("index"), read("worktree")]).then(
      ([original, current]) => {
        if (!alive) return;
        setFiles({ original, current });
        setDraft(null);
      },
      (e: unknown) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, path, version]);

  const save = () => {
    const current = files?.current;
    if (!current?.hash || draft === null) return;
    setSaving(true);
    client
      .code({ method: "writeFile", projectId, worktree, path, content: draft, baseHash: current.hash })
      .then(
        () => {
          setError(null);
          setVersion((v) => v + 1);
          onSaved();
        },
        (e: unknown) => {
          setStale(e instanceof KiboError && e.code === "FILE_CHANGED");
          setError(errorMessage(e));
        },
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-4 py-1.5">
        {error && (
          <p role="alert" className="mr-auto flex items-center gap-2 text-sm text-destructive">
            {error}
            {stale && (
              <Button variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}>
                <RotateCw />
                {fr.changes.reload}
              </Button>
            )}
          </p>
        )}
        <Button size="sm" disabled={draft === null || saving} onClick={save}>
          <Save />
          {saving ? fr.changes.saving : fr.changes.save}
        </Button>
      </div>
      {files?.current.content != null && (
        <CodeEditor
          key={`${files.current.hash}:${layout}`}
          initial={files.current.content}
          original={files.original.content ?? ""}
          path={path}
          layout={layout}
          label={path}
          onChange={setDraft}
          onSave={save}
        />
      )}
    </div>
  );
}
```

- [x] **Step 4: Implémenter la vue**

`packages/ui/src/code/ChangesView.tsx` :
```tsx
import type { CommitInfo, FileChange, FileRef, ProjectSnapshot, Worktree } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowUpFromLine, GitPullRequest } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { CommitPanel } from "./CommitPanel";
import { DiffEditorPane } from "./DiffEditorPane";
import { DiffToolbar } from "./DiffToolbar";
import { type DiffMode, DiffView } from "./DiffView";
import { FileList, type FileSelection } from "./FileList";
import { PushPrDialog, type PushPrInput } from "./PushPrDialog";
import { UnpushedCommits } from "./UnpushedCommits";
import { useCodeStatus, useCommitDefaults, useFileDiff, useRemoteInfo } from "./use-code";
import { resolveWorktree, useWorktrees } from "./use-worktrees";
import { WorktreePicker } from "./WorktreePicker";

export type ChangesSlots = { commitBanner?: ReactNode; prOptions?: ReactNode; prRuleNote?: string | null };
type Props = {
  project: ProjectSnapshot;
  worktree: string | null;
  onWorktreeChange(path: string): void;
  onOpenFile(ref: FileRef): void;
  slots?: ChangesSlots;
};

export function ChangesView({ project, worktree, onWorktreeChange, onOpenFile, slots }: Props) {
  const { worktrees, error } = useWorktrees(project.meta.id);
  const current = resolveWorktree(worktrees, worktree);
  if (error?.code === "NOT_A_REPO") return <p className="p-8 text-sm text-muted-foreground">{fr.changes.notRepo}</p>;
  if (error)
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  if (!worktrees || !current) return null;
  return (
    <ChangesBody
      key={current.path}
      project={project}
      worktrees={worktrees}
      current={current}
      onWorktreeChange={onWorktreeChange}
      onOpenFile={onOpenFile}
      slots={slots ?? {}}
    />
  );
}

type BodyProps = {
  project: ProjectSnapshot;
  worktrees: Worktree[];
  current: Worktree;
  onWorktreeChange(path: string): void;
  onOpenFile(ref: FileRef): void;
  slots: ChangesSlots;
};

function ChangesBody({ project, worktrees, current, onWorktreeChange, onOpenFile, slots }: BodyProps) {
  const projectId = project.meta.id;
  const w = { projectId, worktree: current.path };
  const { status, error: statusError, reload } = useCodeStatus(projectId, current.path);
  const [selection, setSelection] = useState<FileSelection | null>(null);
  const [mode, setMode] = useState<DiffMode>("unified");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [amend, setAmend] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [base, setBase] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const files = status?.files ?? [];
  const selected = files.find((f) => f.path === selection?.path && f.area === selection.area) ?? files[0] ?? null;
  const statusKey = status ? JSON.stringify([status.files, status.commits.map((c) => c.sha)]) : "";
  const { diff, error: diffError, reload: reloadDiff } = useFileDiff(
    projectId,
    current.path,
    selected && { path: selected.path, area: selected.area },
    selected?.area === "staged" ? selected.origPath : null,
    statusKey,
  );
  const { defaults, error: defaultsError } = useCommitDefaults(
    projectId,
    current.path,
    status ? `${status.branch}:${status.commits[0]?.sha ?? ""}` : "",
  );
  const remote = useRemoteInfo(projectId, current.path, status?.branch ?? null);
  const baseBranch = base ?? remote.remote?.defaultBase ?? null;

  useEffect(() => {
    if (!defaults) return;
    setMessage(defaults.message);
    setPrefilled(defaults.message.length > 0);
  }, [defaults]);

  useEffect(() => {
    if (!prOpen || !baseBranch) return;
    client.code({ method: "compare", projectId, worktree: current.path, base: baseBranch }).then(
      (c) => setFileCount(c.fileCount),
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [prOpen, baseBranch, projectId, current.path]);

  const run = async (work: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      reloadDiff();
      return false;
    } finally {
      setBusy(false);
      reload();
    }
  };

  const toggle = (f: FileChange) => {
    const paths = f.origPath ? [f.path, f.origPath] : [f.path];
    void run(() => client.code({ method: f.area === "staged" ? "unstageFiles" : "stageFiles", ...w, paths }));
  };
  const hunk = (index: number, header: string) => {
    if (!selected) return;
    void run(() => client.code({ method: "stageHunk", ...w, path: selected.path, area: selected.area, index, header }));
  };
  const commit = () =>
    void run(() => client.code({ method: "commit", ...w, message, amend })).then((ok) => {
      if (!ok) return;
      setMessage("");
      setPrefilled(false);
      setAmend(false);
    });
  const modify = (c: CommitInfo) => {
    setMessage(c.body ? `${c.subject}\n\n${c.body}` : c.subject);
    setPrefilled(false);
    setAmend(true);
    messageRef.current?.focus();
  };
  const reword = async (c: CommitInfo, next: string) => {
    await client.code({ method: "reword", ...w, sha: c.sha, message: next });
    reload();
  };
  const undo = async (c: CommitInfo) => {
    await client.code({ method: "undoCommit", ...w, sha: c.sha });
    reload();
  };
  const createPr = async (input: PushPrInput) => {
    const pr = await client.code({
      method: "createPr",
      ...w,
      title: input.title,
      body: input.body,
      base: input.base,
      draft: input.draft,
      reviewers: input.reviewers,
      ticketId: input.link ? (defaults?.ticketId ?? null) : null,
    });
    setPrOpen(false);
    setNotice(fr.pr.created(pr.number));
    remote.refresh();
    reload();
  };

  const branch = status?.branch ?? null;
  const unpushed = status?.commits.filter((c) => !c.pushed) ?? [];
  const staged = files.filter((f) => f.area === "staged");
  const head = status?.commits[0];
  const prBlocked = !branch ? fr.commit.noBranch : remote.gh && !remote.gh.available ? fr.commit.ghUnavailable : null;
  const canEdit = selected?.area === "unstaged" && selected.kind !== "deleted" && diff?.binary === false;
  const shownError = error ?? statusError ?? diffError ?? defaultsError ?? remote.error;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status?.operation && (
        <div className="flex items-center gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          <span className="flex-1">{fr.changes.operation(fr.changes.operations[status.operation])}</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => client.code({ method: "abortOperation", ...w }))}>
            {fr.changes.abortOperation}
          </Button>
        </div>
      )}
      {shownError && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {shownError}
        </p>
      )}
      {notice && (
        <p role="status" className="border-b px-4 py-2 text-sm">
          {notice}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)_450px]">
        <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-r p-3">
          <WorktreePicker worktrees={worktrees} current={current} ahead={status?.ahead ?? 0} onChange={onWorktreeChange} />
          {status && files.length === 0 && <p className="px-2 text-sm text-muted-foreground">{fr.changes.clean}</p>}
          <FileList
            files={files}
            selected={selected && { path: selected.path, area: selected.area }}
            busy={busy}
            onSelect={(f) => {
              setSelection({ path: f.path, area: f.area });
              setEditing(false);
            }}
            onToggle={toggle}
          />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col">
          {selected && diff ? (
            <>
              <DiffToolbar
                path={selected.path}
                additions={diff.additions}
                deletions={diff.deletions}
                mode={mode}
                onModeChange={setMode}
                editing={editing && canEdit}
                onEditingChange={setEditing}
                canEdit={canEdit}
                onOpenFile={() => onOpenFile({ ...w, path: selected.path, line: diff.hunks[0]?.newStart ?? null, origin: null })}
                onOpenExternal={() =>
                  void run(() => client.code({ method: "openInEditor", ...w, path: selected.path, line: diff.hunks[0]?.newStart ?? null }))
                }
              />
              {editing && canEdit ? (
                <DiffEditorPane projectId={projectId} worktree={current.path} path={selected.path} layout={mode} onSaved={reload} />
              ) : (
                <DiffView diff={diff} area={selected.area} mode={mode} busy={busy} onHunk={hunk} />
              )}
            </>
          ) : (
            <p className="p-8 text-sm text-muted-foreground">{fr.changes.noSelection}</p>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-5 overflow-auto border-l p-4">
          <CommitPanel
            branch={branch}
            stagedCount={staged.length}
            message={message}
            onMessageChange={(m) => {
              setMessage(m);
              setPrefilled(false);
            }}
            prefilled={prefilled}
            amend={amend}
            onAmendChange={setAmend}
            canAmend={head !== undefined && !head.pushed}
            busy={busy}
            onCommit={commit}
            banner={slots.commitBanner}
            messageRef={messageRef}
          />
          <UnpushedCommits commits={status?.commits ?? []} busy={busy} onModify={modify} onReword={reword} onUndo={undo} />
          <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
            <Button
              variant="outline"
              disabled={busy || !branch}
              onClick={() => {
                setPushing(true);
                void run(() => client.code({ method: "push", ...w })).finally(() => setPushing(false));
              }}
            >
              <ArrowUpFromLine />
              {pushing ? fr.commit.pushing : fr.commit.push}
            </Button>
            {remote.pr ? (
              <Button asChild>
                <a href={remote.pr.url} target="_blank" rel="noreferrer">
                  <GitPullRequest />
                  {fr.commit.viewPr(remote.pr.number)}
                </a>
              </Button>
            ) : (
              <span title={prBlocked ?? undefined} className="grid">
                <Button disabled={busy || prBlocked !== null || !baseBranch} onClick={() => setPrOpen(true)}>
                  <GitPullRequest />
                  {fr.commit.pushAndPr}
                </Button>
              </span>
            )}
          </div>
        </aside>
      </div>
      {branch && baseBranch && (
        <PushPrDialog
          open={prOpen}
          onOpenChange={setPrOpen}
          branch={branch}
          remote={remote.remote?.remote ?? "origin"}
          bases={remote.remote?.branches ?? []}
          base={baseBranch}
          onBaseChange={setBase}
          unpushedCount={unpushed.length}
          fileCount={fileCount}
          stagedCount={staged.length}
          ticketKey={defaults?.ticketKey ?? null}
          defaultTitle={defaults?.prTitle ?? head?.subject ?? ""}
          defaultBody={defaults?.prBody ?? ""}
          onCommitFirst={() => {
            setPrOpen(false);
            messageRef.current?.focus();
          }}
          onSubmit={createPr}
          extraOptions={slots.prOptions}
          ruleNote={slots.prRuleNote ?? null}
        />
      )}
    </div>
  );
}
```
Si le fichier dépasse 300 lignes après formatage, extraire la barre d'actions du bas (Pousser, PR) dans `code/PushActions.tsx`, sans changer le rendu ni les noms accessibles.

- [x] **Step 5: Lancer les tests**

Run: `bun test packages/ui/src/code && bun run check && bun run typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/ui/src/code/use-code.ts packages/ui/src/code/WorktreePicker.tsx packages/ui/src/code/DiffEditorPane.tsx packages/ui/src/code/ChangesView.tsx packages/ui/src/code/changes.test.tsx
git commit -m "feat(ui): vue Changements"
```

---

### Task 17: Indexation et écriture de fichiers

**Files:**
- Create: `packages/daemon/src/code/index-ops.ts`, `packages/daemon/src/code/index-ops.test.ts`

**Interfaces:**
- Consumes: `WorktreeHandle`, `readDiff`, `hasHead`, `sha1` (tâche 15) ; `hunkPatch` (tâche 4) ; `resolveInWorktree`, `assertNotSymlink` (tâche 3).
- Produces : `stageFiles(h, paths: string[]): Promise<void>`, `unstageFiles(h, paths: string[]): Promise<void>`, `stageHunk(h, input: { path: string; area: ChangeArea; index: number; header: string }): Promise<void>`, `writeFile(h, path: string, content: string, baseHash: string): Promise<{ hash: string }>`.

- [ ] **Step 1: Tests**

`packages/daemon/src/code/index-ops.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stageFiles, stageHunk, unstageFiles, writeFile } from "./index-ops";
import { readDiff, readFile, readStatus } from "./read";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

beforeEach(async () => {
  fx = createGitFixture({ remote: false });
  fx.commit("chore: init", { "src/ticket.ts": lines(40), "src/legacy.ts": "old\n" });
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

const areas = async () => (await readStatus(h)).files.map((f) => `${f.area}:${f.kind}:${f.path}`);

test("files are staged and unstaged, including deletions and new files", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  await stageFiles(h, ["src/new.ts", "src/ticket.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual(["staged:deleted:src/legacy.ts", "staged:added:src/new.ts", "staged:modified:src/ticket.ts"]);
  await unstageFiles(h, ["src/new.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual([
    "unstaged:deleted:src/legacy.ts",
    "unstaged:untracked:src/new.ts",
    "staged:modified:src/ticket.ts",
  ]);
});

test("unstaging works before the first commit", async () => {
  const empty = createGitFixture({ remote: false });
  empty.write("a.txt", "a\n");
  const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
  await stageFiles(eh, ["a.txt"]);
  await unstageFiles(eh, ["a.txt"]);
  expect((await readStatus(eh)).files.map((f) => f.area)).toEqual(["unstaged"]);
  empty.cleanup();
});

test("a single hunk is staged, then unstaged, the other stays untouched", async () => {
  fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n").replace("line 39\n", "LINE 39\n"));
  const before = await readDiff(h, "src/ticket.ts", null, "unstaged");
  expect(before.hunks).toHaveLength(2);
  const second = before.hunks[1];
  if (!second) throw new Error("second hunk expected");
  await stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 1, header: second.header });
  expect(fx.git("diff", "--cached", "--", "src/ticket.ts")).toContain("+LINE 39");
  expect(fx.git("diff", "--cached", "--", "src/ticket.ts")).not.toContain("LINE 2");
  expect(fx.git("diff", "--", "src/ticket.ts")).toContain("+LINE 2");
  const staged = await readDiff(h, "src/ticket.ts", null, "staged");
  await stageHunk(h, { path: "src/ticket.ts", area: "staged", index: 0, header: staged.hunks[0]?.header ?? "" });
  expect(fx.git("diff", "--cached")).toBe("");
});

test("a hunk whose header changed on disk is refused and the index is untouched", async () => {
  fx.write("src/ticket.ts", lines(40).replace("line 39\n", "LINE 39\n"));
  const seen = await readDiff(h, "src/ticket.ts", null, "unstaged");
  fx.write("src/ticket.ts", `top\n${lines(40).replace("line 39\n", "LINE 39\n")}`);
  await expect(
    stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 0, header: seen.hunks[0]?.header ?? "" }),
  ).rejects.toMatchObject({ code: "GIT_STALE" });
  await expect(
    stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 5, header: "@@ -1 +1 @@" }),
  ).rejects.toMatchObject({ code: "GIT_STALE" });
  expect(fx.git("diff", "--cached")).toBe("");
});

test("whole-file-only diffs refuse hunk staging", async () => {
  fx.write("src/new.ts", "n\n");
  await expect(stageHunk(h, { path: "src/new.ts", area: "unstaged", index: 0, header: "@@ -0,0 +1 @@" })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});

test("writeFile replaces atomically, keeps the mode and returns the new hash", async () => {
  chmodSync(join(fx.repo, "src/ticket.ts"), 0o755);
  const read = await readFile(h, "src/ticket.ts", "worktree");
  const res = await writeFile(h, "src/ticket.ts", "edited\n", read.hash ?? "");
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe("edited\n");
  expect(statSync(join(fx.repo, "src/ticket.ts")).mode & 0o777).toBe(0o755);
  expect(res.hash).toBe((await readFile(h, "src/ticket.ts", "worktree")).hash ?? "");
  expect(fx.git("status", "--porcelain", "--untracked-files=all")).toBe(" M src/ticket.ts\n");
});

test("an edit based on an outdated read is refused and the agent's version stays on disk", async () => {
  const read = await readFile(h, "src/ticket.ts", "worktree");
  writeFileSync(join(fx.repo, "src/ticket.ts"), "written by the agent\n");
  await expect(writeFile(h, "src/ticket.ts", "written by the user\n", read.hash ?? "")).rejects.toMatchObject({
    code: "FILE_CHANGED",
  });
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe("written by the agent\n");
});

test("symlinks, missing files and paths outside the worktree are refused", async () => {
  symlinkSync(join(fx.repo, "src/ticket.ts"), join(fx.repo, "link.ts"));
  await expect(writeFile(h, "link.ts", "x", "0".repeat(40))).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  await expect(writeFile(h, "src/missing.ts", "x", "0".repeat(40))).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(writeFile(h, "../escape.ts", "x", "0".repeat(40))).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  await expect(stageFiles(h, ["../escape.ts"])).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
});
```
Run: `bun test packages/daemon/src/code/index-ops.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 2: Implémenter**

`packages/daemon/src/code/index-ops.ts` :
```ts
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ChangeArea, KiboError } from "@kibo/schema";
import { hunkPatch } from "./patch";
import { hasHead, readDiff, sha1 } from "./read";
import type { WorktreeHandle } from "./repo";
import { assertNotSymlink, resolveInWorktree } from "./safe-path";

const validate = (h: WorktreeHandle, paths: string[]) => {
  for (const p of paths) resolveInWorktree(h.path, p);
};

export async function stageFiles(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  await h.git.ok(["add", "-A", "--", ...paths]);
}

export async function unstageFiles(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  if (await hasHead(h)) await h.git.ok(["restore", "--staged", "--", ...paths]);
  else await h.git.ok(["rm", "--cached", "-r", "-q", "--", ...paths]);
}

export async function stageHunk(
  h: WorktreeHandle,
  input: { path: string; area: ChangeArea; index: number; header: string },
): Promise<void> {
  const diff = await readDiff(h, input.path, null, input.area);
  if (!diff.hunkStaging) throw new KiboError("INVALID_INPUT", `${input.path} can only be staged as a whole file`);
  const hunk = diff.hunks[input.index];
  if (!hunk || hunk.header !== input.header) throw new KiboError("GIT_STALE", `hunk ${input.index} of ${input.path} changed`);
  const reverse = input.area === "staged" ? ["--reverse"] : [];
  await h.git.ok(["apply", "--cached", "--whitespace=nowarn", ...reverse, "-"], { stdin: hunkPatch(diff, input.index) });
}

export async function writeFile(h: WorktreeHandle, path: string, content: string, baseHash: string): Promise<{ hash: string }> {
  const abs = resolveInWorktree(h.path, path);
  assertNotSymlink(abs);
  if (!existsSync(abs)) throw new KiboError("NOT_FOUND", `${path} does not exist`);
  if (sha1(new Uint8Array(readFileSync(abs))) !== baseHash) throw new KiboError("FILE_CHANGED", `${path} changed on disk`);
  const bytes = new TextEncoder().encode(content);
  const tmp = join(dirname(abs), `.${basename(abs)}.kibo-${crypto.randomUUID()}`);
  writeFileSync(tmp, bytes, { mode: statSync(abs).mode & 0o777 });
  renameSync(tmp, abs);
  return { hash: sha1(bytes) };
}
```

- [ ] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/index-ops.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/daemon/src/code/index-ops.ts packages/daemon/src/code/index-ops.test.ts
git commit -m "feat(daemon): indexation par bloc et écriture"
```

---

### Task 18: Commit, amend, reformulation et annulation

**Files:**
- Create: `packages/daemon/src/code/history-ops.ts`, `packages/daemon/src/code/history-ops.test.ts`

**Interfaces:**
- Consumes: `WorktreeHandle`, `isPushed`, `currentOperation`, `headCommit` (tâche 15) ; `firstLine`, `WRITE_TIMEOUT_MS` (tâche 3).
- Produces : `commit(h, message: string, amend: boolean): Promise<CommitInfo>`, `reword(h, sha: string, message: string): Promise<void>`, `undoCommit(h, sha: string): Promise<void>`, `abortOperation(h): Promise<void>`.

- [ ] **Step 1: Tests**

`packages/daemon/src/code/history-ops.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { abortOperation, commit, reword, undoCommit } from "./history-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const subjects = () => fx.git("log", "--format=%s").trim().split("\n");
const snapshot = () => ({
  staged: fx.git("diff", "--cached"),
  unstaged: fx.git("diff"),
  untracked: fx.git("ls-files", "--others", "--exclude-standard"),
  tree: fx.git("rev-parse", "HEAD^{tree}"),
});

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "a.txt": "a\n", "b.txt": "b\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.commit("feat: un", { "c.txt": "c\n" });
  fx.commit("feat: deux", { "d.txt": "d\n" });
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

describe("commit", () => {
  test("commits the index with the given message", async () => {
    fx.write("e.txt", "e\n");
    fx.git("add", "e.txt");
    const c = await commit(h, "feat: trois (KIB-12)\n\n- détail", false);
    expect(c).toMatchObject({ subject: "feat: trois (KIB-12)", body: "- détail", pushed: false });
    await expect(commit(h, "vide", false)).rejects.toMatchObject({ code: "GIT_FAILED" });
  });

  test("amend rewrites an unpushed head and refuses a pushed one", async () => {
    fx.write("c.txt", "c2\n");
    fx.git("add", "c.txt");
    await commit(h, "feat: deux, corrigé", true);
    expect(subjects()).toEqual(["feat: deux, corrigé", "feat: un", "chore: init"]);
    expect(fx.git("show", "--name-only", "--format=", "HEAD").trim().split("\n")).toEqual(["c.txt", "d.txt"]);
    fx.git("push", "-q", "origin", "main");
    const head = fx.git("rev-parse", "HEAD");
    await expect(commit(h, "trop tard", true)).rejects.toMatchObject({ code: "GIT_PUSHED" });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
  });
});

describe("reword", () => {
  test("rewording HEAD keeps the index", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    await reword(h, fx.git("rev-parse", "HEAD").trim(), "feat: deux reformulé");
    expect(subjects()[0]).toBe("feat: deux reformulé");
    expect(fx.git("diff", "--cached", "--name-only").trim()).toBe("a.txt");
  });

  test("rewording an older commit keeps content, index, worktree and untracked files exactly", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    fx.write("a.txt", "staged then edited\n");
    fx.write("b.txt", "unstaged\n");
    fx.write("new.txt", "untracked\n");
    const before = snapshot();
    await reword(h, fx.git("rev-parse", "HEAD~1").trim(), "feat: un reformulé\n\n- corps");
    expect(subjects()).toEqual(["feat: deux", "feat: un reformulé", "chore: init"]);
    expect(fx.git("log", "-1", "--skip=1", "--format=%b").trim()).toBe("- corps");
    expect(snapshot()).toEqual(before);
  });

  test("a pushed commit, a merge in range or an operation in progress are refused", async () => {
    const head = fx.git("rev-parse", "HEAD");
    await expect(reword(h, fx.git("rev-parse", "HEAD~2").trim(), "non")).rejects.toMatchObject({ code: "GIT_PUSHED" });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
    fx.git("checkout", "-q", "-b", "side", "HEAD~1");
    fx.commit("feat: côté", { "side.txt": "s\n" });
    fx.git("checkout", "-q", "main");
    fx.git("merge", "-q", "--no-ff", "-m", "merge side", "side");
    await expect(reword(h, fx.git("rev-parse", "HEAD~1").trim(), "non")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    mkdirSync(join(h.gitDir, "rebase-merge"));
    await expect(reword(h, fx.git("rev-parse", "HEAD").trim(), "non")).rejects.toMatchObject({ code: "GIT_BUSY" });
  });

  test("an unknown sha is reported", async () => {
    await expect(reword(h, "abcdef1", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("undoCommit", () => {
  test("undoing the head puts its changes back in the index", async () => {
    await undoCommit(h, fx.git("rev-parse", "HEAD").trim());
    expect(subjects()).toEqual(["feat: un", "chore: init"]);
    expect(fx.git("diff", "--cached", "--name-only").trim()).toBe("d.txt");
  });

  test("undoing an older commit also undoes the newer ones, nothing is lost", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    await undoCommit(h, fx.git("rev-parse", "HEAD~1").trim());
    expect(subjects()).toEqual(["chore: init"]);
    expect(fx.git("diff", "--cached", "--name-only").trim().split("\n")).toEqual(["a.txt", "c.txt", "d.txt"]);
  });

  test("a pushed commit cannot be undone", async () => {
    const head = fx.git("rev-parse", "HEAD");
    await expect(undoCommit(h, fx.git("rev-parse", "HEAD~2").trim())).rejects.toMatchObject({ code: "GIT_PUSHED" });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
  });

  test("undoing the root commit of an unpushed repository empties the branch", async () => {
    const solo = createGitFixture({ remote: false });
    const sha = solo.commit("chore: init", { "a.txt": "a\n" });
    const sh = await (await openRepo(solo.repo, solo.env)).open(solo.repo);
    await undoCommit(sh, sha);
    expect(Bun.spawnSync(["git", "rev-parse", "--verify", "-q", "HEAD"], { cwd: solo.repo }).exitCode).not.toBe(0);
    expect(solo.git("diff", "--cached", "--name-only").trim()).toBe("a.txt");
    solo.cleanup();
  });
});

test("abortOperation aborts a conflicting merge", async () => {
  fx.git("checkout", "-q", "-b", "other", "HEAD~1");
  fx.commit("other", { "d.txt": "other\n" });
  fx.git("checkout", "-q", "main");
  Bun.spawnSync(["git", "merge", "other"], { cwd: fx.repo, env: { ...process.env, ...fx.env } });
  await abortOperation(h);
  expect(fx.git("status", "--porcelain")).toBe("");
  await expect(abortOperation(h)).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
```

Run: `bun test packages/daemon/src/code/history-ops.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 2: Implémenter**

`packages/daemon/src/code/history-ops.ts` :
```ts
import { type CommitInfo, KiboError } from "@kibo/schema";
import { currentOperation, headCommit, isPushed } from "./read";
import type { WorktreeHandle } from "./repo";
import { firstLine, WRITE_TIMEOUT_MS } from "./run";

async function resolveCommit(h: WorktreeHandle, sha: string): Promise<string> {
  const r = await h.git.run(["rev-parse", "--verify", "-q", `${sha}^{commit}`]);
  if (r.code !== 0) throw new KiboError("NOT_FOUND", `commit ${sha} not found`);
  return r.stdout.trim();
}

async function assertUnpushed(h: WorktreeHandle, sha: string): Promise<void> {
  if (await isPushed(h, sha)) throw new KiboError("GIT_PUSHED", `${sha.slice(0, 7)} is already pushed`);
}

async function assertIdle(h: WorktreeHandle): Promise<void> {
  const op = await currentOperation(h);
  if (op) throw new KiboError("GIT_BUSY", `${op} in progress`);
}

async function assertInBranch(h: WorktreeHandle, sha: string): Promise<void> {
  if ((await h.git.run(["merge-base", "--is-ancestor", sha, "HEAD"])).code !== 0)
    throw new KiboError("INVALID_INPUT", `${sha.slice(0, 7)} is not in the current branch`);
}

async function parentOf(h: WorktreeHandle, sha: string): Promise<string | null> {
  const r = await h.git.run(["rev-parse", "--verify", "-q", `${sha}^`]);
  return r.code === 0 ? r.stdout.trim() : null;
}

export async function commit(h: WorktreeHandle, message: string, amend: boolean): Promise<CommitInfo> {
  if ((await currentOperation(h)) === "rebase") throw new KiboError("GIT_BUSY", "rebase in progress");
  if (amend) await assertUnpushed(h, await resolveCommit(h, "HEAD"));
  await h.git.ok(["commit", ...(amend ? ["--amend"] : []), "--cleanup=strip", "-F", "-"], {
    stdin: message,
    timeoutMs: WRITE_TIMEOUT_MS,
  });
  return headCommit(h);
}

export async function reword(h: WorktreeHandle, sha: string, message: string): Promise<void> {
  await assertIdle(h);
  const target = await resolveCommit(h, sha);
  await assertUnpushed(h, target);
  if (target === (await resolveCommit(h, "HEAD"))) {
    await h.git.ok(["commit", "--amend", "--only", "--cleanup=strip", "-F", "-"], { stdin: message, timeoutMs: WRITE_TIMEOUT_MS });
    return;
  }
  await assertInBranch(h, target);
  if ((await h.git.ok(["rev-list", "--merges", `${target}..HEAD`])).trim())
    throw new KiboError("INVALID_INPUT", "cannot reword across a merge commit");
  const subject = (await h.git.ok(["log", "-1", "--format=%s", target])).trim();
  const index = (await h.git.ok(["write-tree"])).trim();
  await h.git.ok(["commit", "--allow-empty", "--only", "--no-verify", "--cleanup=verbatim", "-F", "-"], {
    stdin: `amend! ${subject}\n\n${message.trim()}\n`,
  });
  const parent = await parentOf(h, target);
  const r = await h.git.run(["rebase", "-i", "--autosquash", "--autostash", ...(parent ? [parent] : ["--root"])], {
    env: { GIT_SEQUENCE_EDITOR: "true" },
    timeoutMs: WRITE_TIMEOUT_MS,
  });
  if (r.code !== 0) {
    await h.git.run(["rebase", "--abort"]);
    await h.git.ok(["reset", "--soft", "HEAD~1"]);
    await h.git.ok(["read-tree", index]);
    throw new KiboError("GIT_FAILED", `git rebase: ${firstLine(r.stderr) || firstLine(r.stdout)}`);
  }
  await h.git.ok(["read-tree", index]);
}

export async function undoCommit(h: WorktreeHandle, sha: string): Promise<void> {
  await assertIdle(h);
  const target = await resolveCommit(h, sha);
  await assertUnpushed(h, target);
  await assertInBranch(h, target);
  const parent = await parentOf(h, target);
  if (parent) await h.git.ok(["reset", "--soft", parent]);
  else await h.git.ok(["update-ref", "-d", "HEAD"]);
}

export async function abortOperation(h: WorktreeHandle): Promise<void> {
  const op = await currentOperation(h);
  if (!op) throw new KiboError("INVALID_INPUT", "no git operation in progress");
  await h.git.ok([op, "--abort"]);
}
```
Le `-i` est rendu non interactif par `GIT_SEQUENCE_EDITOR=true` (git lance lui-même cet éditeur, comme le demande la spec §7) ; le commit technique `amend!` est vide et sans crochets (`--no-verify`), la reformulation ne peut donc pas créer de conflit de contenu.

- [ ] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/history-ops.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/daemon/src/code/history-ops.ts packages/daemon/src/code/history-ops.test.ts
git commit -m "feat(daemon): amend et reformulation des commits"
```

---

### Task 19: Poussée, `gh` et création de PR

**Files:**
- Create: `packages/daemon/src/code/remote-ops.ts`, `packages/daemon/src/code/remote-ops.test.ts`

**Interfaces:**
- Consumes: `WorktreeHandle`, `currentBranch`, `pushRemote`, `remoteBranches` (tâche 15) ; `runGh`, `firstLine`, `NETWORK_TIMEOUT_MS`, `Env` (tâche 3) ; `installFakeGh`, `readFakeGhLog` (tâche 3) ; `PrInfo` (tâche 1).
- Produces : `push(h): Promise<void>`, `ghStatus(h): Promise<GhStatus>`, `prForBranch(h): Promise<PrInfo | null>`, `prState(url: string, cwd: string, env: Env): Promise<PrInfo>`, `createPr(h, input: { title: string; body: string; base: string; draft: boolean; reviewers: string[] }): Promise<PrInfo>`, `toPrInfo(raw: string): PrInfo`.

- [x] **Step 1: Tests**

`packages/daemon/src/code/remote-ops.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStatus } from "./read";
import { createPr, ghStatus, prForBranch, prState, push, toPrInfo } from "./remote-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture, installFakeGh, readFakeGhLog } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
let gh: Record<string, string>;

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "a.txt": "a\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.git("checkout", "-q", "-b", "kib-12");
  fx.commit("feat: schéma (KIB-12)", { "b.txt": "b\n" });
  gh = installFakeGh(fx.dir);
  h = await (await openRepo(fx.repo, { ...fx.env, ...gh })).open(fx.repo);
});
afterEach(() => fx.cleanup());

test("push publishes the branch with an upstream, never forcing", async () => {
  await push(h);
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).toContain(fx.git("rev-parse", "HEAD").trim());
  const s = await readStatus(h);
  expect(s.upstream).toBe("origin/kib-12");
  expect(s.commits.every((c) => c.pushed)).toBe(true);
  fx.git("commit", "-q", "--amend", "-m", "réécrit");
  await expect(push(h)).rejects.toMatchObject({ code: "GIT_FAILED" });
});

test("a detached HEAD cannot be pushed", async () => {
  fx.git("checkout", "-q", "--detach");
  await expect(push(h)).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("createPr pushes then calls gh with safe arguments and the body on stdin", async () => {
  const pr = await createPr(h, {
    title: "--title-like: x",
    body: "## Ticket\nKIB-12",
    base: "main",
    draft: true,
    reviewers: ["adam", "kibo/core"],
  });
  expect(pr).toEqual({ number: 1, url: "https://github.com/kibo/test/pull/1", state: "draft" });
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).not.toBe("");
  expect(readFakeGhLog(gh)).toContainEqual({
    args: ["pr", "create", "--head=kib-12", "--base=main", "--title=--title-like: x", "--body-file", "-", "--draft", "--reviewer=adam,kibo/core"],
    stdin: "## Ticket\nKIB-12",
  });
  expect(await prForBranch(h)).toEqual({ number: 1, url: "https://github.com/kibo/test/pull/1", state: "draft" });
});

test("an unknown base is refused before any push or gh call", async () => {
  await expect(createPr(h, { title: "x", body: "", base: "nope", draft: false, reviewers: [] })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(readFakeGhLog(gh)).toEqual([]);
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).toBe("");
});

test("gh failures and absence are reported", async () => {
  const failing = await (await openRepo(fx.repo, { ...fx.env, ...gh, FAKE_GH_FAIL: "1" })).open(fx.repo);
  await expect(createPr(failing, { title: "x", body: "", base: "main", draft: false, reviewers: [] })).rejects.toMatchObject({
    code: "GH_FAILED",
  });
  const missing = await (await openRepo(fx.repo, { ...fx.env, KIBO_GH: join(fx.dir, "no-gh") })).open(fx.repo);
  expect(await ghStatus(missing)).toMatchObject({ available: false });
  expect(await ghStatus(h)).toEqual({ available: true, detail: null });
  expect(await prForBranch(h)).toBeNull();
});

test("PR states map from gh JSON", async () => {
  await createPr(h, { title: "x", body: "", base: "main", draft: false, reviewers: [] });
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as { state: string }[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, state: "MERGED" }))));
  expect(await prState("https://github.com/kibo/test/pull/1", fx.repo, { ...fx.env, ...gh })).toMatchObject({ state: "merged" });
  expect(toPrInfo('{"number":2,"url":"https://github.com/a/b/pull/2","state":"OPEN","isDraft":true}').state).toBe("draft");
  expect(() => toPrInfo("not json")).toThrow(expect.objectContaining({ code: "GH_FAILED" }));
});
```

Run: `bun test packages/daemon/src/code/remote-ops.test.ts`
Expected: FAIL, module introuvable.

- [x] **Step 2: Implémenter**

`packages/daemon/src/code/remote-ops.ts` :
```ts
import { type GhStatus, KiboError, PrInfo } from "@kibo/schema";
import { currentBranch, pushRemote, remoteBranches } from "./read";
import type { WorktreeHandle } from "./repo";
import { type Env, firstLine, NETWORK_TIMEOUT_MS, runGh } from "./run";

const PR_FIELDS = ["--json", "number,url,state,isDraft"];
const field = (data: unknown, key: string): unknown =>
  typeof data === "object" && data !== null ? Reflect.get(data, key) : undefined;

export function toPrInfo(raw: string): PrInfo {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new KiboError("GH_FAILED", `gh returned invalid JSON: ${String(e)}`);
  }
  const state = field(data, "state");
  const parsed = PrInfo.safeParse({
    number: field(data, "number"),
    url: field(data, "url"),
    state: state === "MERGED" ? "merged" : state === "CLOSED" ? "closed" : field(data, "isDraft") === true ? "draft" : "open",
  });
  if (!parsed.success) throw new KiboError("GH_FAILED", "unexpected gh output");
  return parsed.data;
}

async function branchOf(h: WorktreeHandle): Promise<string> {
  const branch = await currentBranch(h);
  if (!branch) throw new KiboError("INVALID_INPUT", "HEAD is detached");
  return branch;
}

export async function push(h: WorktreeHandle): Promise<void> {
  const branch = await branchOf(h);
  const remote = await pushRemote(h, branch);
  if (!remote) throw new KiboError("GIT_FAILED", "no remote configured");
  await h.git.ok(["push", "--porcelain", "-u", remote, `refs/heads/${branch}:refs/heads/${branch}`], {
    timeoutMs: NETWORK_TIMEOUT_MS,
  });
}

export async function ghStatus(h: WorktreeHandle): Promise<GhStatus> {
  try {
    const r = await runGh(["auth", "status"], { cwd: h.path, env: h.env });
    return r.code === 0 ? { available: true, detail: null } : { available: false, detail: firstLine(r.stderr) || null };
  } catch (e) {
    if (e instanceof KiboError && e.code === "GH_UNAVAILABLE") return { available: false, detail: e.detail };
    throw e;
  }
}

export async function prForBranch(h: WorktreeHandle): Promise<PrInfo | null> {
  const branch = await currentBranch(h);
  if (!branch) return null;
  const r = await runGh(["pr", "view", branch, ...PR_FIELDS], { cwd: h.path, env: h.env });
  if (r.code === 0) return toPrInfo(r.stdout);
  if (/no (open )?pull requests? found/i.test(r.stderr)) return null;
  throw new KiboError("GH_FAILED", firstLine(r.stderr) || "gh pr view failed");
}

export async function prState(url: string, cwd: string, env: Env): Promise<PrInfo> {
  const r = await runGh(["pr", "view", url, ...PR_FIELDS], { cwd, env });
  if (r.code !== 0) throw new KiboError("GH_FAILED", firstLine(r.stderr) || "gh pr view failed");
  return toPrInfo(r.stdout);
}

export async function createPr(
  h: WorktreeHandle,
  input: { title: string; body: string; base: string; draft: boolean; reviewers: string[] },
): Promise<PrInfo> {
  const branch = await branchOf(h);
  const { branches } = await remoteBranches(h);
  if (!branches.includes(input.base)) throw new KiboError("INVALID_INPUT", `${input.base} is not a branch of the remote`);
  await push(h);
  const args = [
    "pr",
    "create",
    `--head=${branch}`,
    `--base=${input.base}`,
    `--title=${input.title}`,
    "--body-file",
    "-",
    ...(input.draft ? ["--draft"] : []),
    ...(input.reviewers.length ? [`--reviewer=${input.reviewers.join(",")}`] : []),
  ];
  const r = await runGh(args, { cwd: h.path, env: h.env, stdin: input.body });
  if (r.code !== 0) throw new KiboError("GH_FAILED", firstLine(r.stderr) || "gh pr create failed");
  const url = r.stdout.trim().split("\n").at(-1) ?? "";
  const m = /\/pull\/(\d+)$/.exec(url);
  if (!m) throw new KiboError("GH_FAILED", `unexpected gh output: ${url}`);
  return PrInfo.parse({ number: Number(m[1]), url, state: input.draft ? "draft" : "open" });
}
```

- [x] **Step 3: Lancer les tests**

Run: `bun test packages/daemon/src/code/remote-ops.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/daemon/src/code/remote-ops.ts packages/daemon/src/code/remote-ops.test.ts
git commit -m "feat(daemon): poussée et création de PR"
```

---

### Task 20: Intégration au shell (onglets, palette, vues, aperçu)

Relie les tâches 9 à 16 au shell : barre d'onglets au-dessus de la sidebar (écran 20), recherche `⌘K` dans la sidebar et palette (écran 18), entrée « Changements » avec son compteur sous les pages du projet (écran 21), fil d'Ariane « Kibo › Changements › kib-12 », onglets ticket et fichier, aperçu de fichier depuis n'importe quel lien (écran 23).

**Files:**
- Create: `packages/ui/src/tabs/use-hash-sync.ts`, `packages/ui/src/code/use-project-git.ts`, `packages/ui/src/shell/ContentView.tsx`, `packages/ui/src/shell/TicketDetail.tsx`, `packages/ui/src/pages/TicketTab.tsx`
- Modify: `packages/ui/src/route.ts`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/shell/AppSidebar.tsx`, `packages/ui/src/shell/Breadcrumb.tsx`, `packages/ui/src/shell/Host.tsx`, `packages/ui/src/shell/TicketSheet.tsx`, `packages/ui/src/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useTabs`, `TabBar`, `describeTarget`, `activeTarget`, `sameTarget`, `targetToHash`, `hashToTarget`, `useTabShortcuts` (tâche 9) ; `CommandPalette`, `PaletteAction`, `cycleTheme` (tâche 10) ; `FilePreviewSheet`, `FileTabView`, `LinkifiedText`, `useWorktrees`, `resolveWorktree` (tâche 12) ; `ChangesView` (tâche 16) ; `useSnapshots`, `Host.openFile` (tâche 1).
- Produces :
  - `route.ts` : `type Route = { projectId: string | null; pageId: string | null; target: TabTarget | null }`, `useRoute(): Route`, `navigate(projectId: string | null, pageId?: string | null): void` (inchangé pour les appelants), `navigateTo(target: TabTarget | null): void` ;
  - `useHashSync(tabs: TabsApi, routeTarget: TabTarget | null): void` ;
  - `useProjectGit(projectId: string | null, folder: string | null): { worktrees: Worktree[] | null; main: Worktree | null; changesCount: number | null; error: string | null }` ;
  - `Host` : `openTicket`, `openNewTicket`, `openFile`, `openTarget(target: TabTarget, opts?: { newTab?: boolean }): void` ;
  - `crumbsFor(target: TabTarget | null, ctx: { project: ProjectSnapshot | null; branch: string | null }): string[]`, `Breadcrumb({ crumbs }: { crumbs: string[] })` ;
  - `TicketDetail({ project, ticket, onOpenFile })`, `TicketTab({ project, ticketId, onOpenFile })`, `ContentView(props)`.

- [ ] **Step 1: Tests du shell**

Remplacer `packages/ui/src/shell/shell.test.tsx` par :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { type CodeRequest, DEFAULT_WORKFLOW, EMPTY_TABS, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
  tickets: [
    {
      id: "7@1",
      key: "KIB-7",
      title: "Schéma",
      description: "Voir src/a.ts:3",
      statusId: "todo",
      blockedReason: null,
      domainId: null,
      assignee: null,
      parentId: null,
      externalRefs: [{ kind: "github_pr", url: "https://github.com/kibo/test/pull/4", number: 4, state: "draft" }],
      progress: { done: 0, total: 0 },
      waitingOn: [],
    },
  ],
  links: [],
  instances: [],
  nextTicketKey: "KIB-8",
};
const saved: RpcRequest[] = [];
const code: CodeRequest[] = [];

mock.module("../state/use-projects", () => ({
  useProjects: () => [
    { ...project.meta, counts: { backlog: 0, todo: 1, in_progress: 0, in_review: 0, blocked: 0, done: 0 } },
  ],
  useProject: (id: string | null) => (id === "p1" ? project : null),
}));
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      if (req.method === "getProject") return Promise.resolve(project);
      saved.push(req);
      return Promise.resolve(null);
    },
    code: (req: CodeRequest) => {
      code.push(req);
      if (req.method === "worktrees") return Promise.resolve([{ path: "/repo", branch: "main", head: null, isMain: true }]);
      if (req.method === "readFile")
        return Promise.resolve({
          path: "src/a.ts",
          revision: "worktree",
          content: "a\nb\n  c\n",
          hash: "a".repeat(40),
          size: 7,
          binary: false,
          tooLarge: false,
          lines: 3,
          modifiedAt: null,
          tracked: true,
          dirty: false,
        });
      return Promise.resolve(null);
    },
    subscribe: () => () => {},
    subscribeCode: () => () => {},
  },
}));

const { Shell } = await import("./Shell");

const go = async (hash: string) =>
  act(async () => {
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 30));
  });

beforeEach(() => {
  saved.length = 0;
  code.length = 0;
  location.hash = "";
});

test("a page missing from the snapshot does not redirect to the first page", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/2%401");
  expect(location.hash).toBe("#/p/p1/2%401");
});

test("navigation opens a « Projet · Page » tab and the breadcrumb follows", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/1%401");
  const bar = await screen.findByRole("tablist", { name: "Onglets" });
  expect(within(bar).getByRole("tab", { name: "Kibo · Board" }).getAttribute("aria-selected")).toBe("true");
  const crumbs = within(screen.getByRole("navigation", { name: "Fil d'Ariane" }));
  expect(crumbs.getByText("Kibo")).toBeTruthy();
  expect(crumbs.getByText("Board").getAttribute("aria-current")).toBe("page");
  await waitFor(() => expect(saved.some((r) => r.method === "saveTabs")).toBe(true), { timeout: 1000 });
});

test("⌘K opens the palette, ⌘W closes the tab and returns home", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  fireEvent.keyDown(window, { key: "k", metaKey: true, ctrlKey: false });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true, metaKey: false });
  expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  fireEvent.keyDown(window, { key: "w", metaKey: true });
  fireEvent.keyDown(window, { key: "w", ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Kibo · Board" })).toBeNull());
  expect(location.hash).toBe("#/");
});

test("⌘-click in the sidebar opens a new tab instead of replacing the current one", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  const sidebar = screen.getByRole("button", { name: "Kibo" });
  fireEvent.click(sidebar, { metaKey: true, ctrlKey: true });
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
});

test("a ticket tab shows the detail, its PR and opens file links in the preview", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/t/7%401");
  expect(await screen.findByRole("tab", { name: "Kibo · KIB-7" })).toBeTruthy();
  expect(screen.getByText("#4")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "src/a.ts:3" }));
  expect(await screen.findByText("Ligne 3, col 3")).toBeTruthy();
  expect(code.find((c) => c.method === "readFile")).toMatchObject({ path: "src/a.ts", worktree: "/repo" });
});

test("a project without folder has no Changements entry", async () => {
  render(<Shell viewer="adam" />);
  await go("#/p/p1/1%401");
  await screen.findByRole("tab", { name: "Kibo · Board" });
  expect(screen.queryByRole("button", { name: /Changements/ })).toBeNull();
});
```
(Les raccourcis sont envoyés avec `⌘` puis `Ctrl` : un seul correspond à la plateforme simulée.)

Run: `bun test packages/ui/src/shell`
Expected: FAIL (pas de barre d'onglets, pas de palette).

- [ ] **Step 2: Route et synchronisation avec l'URL**

`packages/ui/src/route.ts` :
```ts
import type { TabTarget } from "@kibo/schema";
import { useSyncExternalStore } from "react";
import { hashToTarget, targetToHash } from "./tabs/target-hash";

export type Route = { projectId: string | null; pageId: string | null; target: TabTarget | null };

function parse(hash: string): Route {
  const target = hashToTarget(hash);
  return { target, projectId: target?.projectId ?? null, pageId: target?.kind === "page" ? target.pageId : null };
}

let lastHash = location.hash;
let current = parse(lastHash);
const subscribe = (cb: () => void) => {
  const on = () => {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    current = parse(lastHash);
    cb();
  };
  window.addEventListener("hashchange", on);
  return () => window.removeEventListener("hashchange", on);
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current);
}

export function navigateTo(target: TabTarget | null): void {
  location.hash = targetToHash(target);
}

export function navigate(projectId: string | null, pageId: string | null = null): void {
  navigateTo(projectId ? (pageId ? { kind: "page", projectId, pageId } : { kind: "project", projectId }) : null);
}
```

`packages/ui/src/tabs/use-hash-sync.ts` :
```ts
import type { TabTarget } from "@kibo/schema";
import { useEffect, useRef } from "react";
import { navigateTo } from "../route";
import { activeTarget } from "./tabs-model";
import { targetToHash } from "./target-hash";
import type { TabsApi } from "./use-tabs";

export function useHashSync(tabs: TabsApi, routeTarget: TabTarget | null): void {
  const active = activeTarget(tabs.state);
  const routeHash = targetToHash(routeTarget);
  const activeHash = targetToHash(active);
  const last = useRef<{ route: string; active: string } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { route: routeHash, active: activeHash };
    if (routeHash === activeHash) return;
    if (!prev) {
      if (routeTarget) tabs.open(routeTarget);
      else navigateTo(active);
      return;
    }
    if (routeHash !== prev.route) tabs.open(routeTarget);
    else if (activeHash !== prev.active) navigateTo(active);
  }, [routeHash, activeHash, routeTarget, active, tabs.open]);
}
```
Au chargement, une URL qui vise une cible l'emporte sur l'onglet actif enregistré ; une URL d'accueil rouvre l'onglet actif enregistré. Ensuite, un changement d'URL (retour arrière, `navigate`) ouvre la cible selon la règle d'ouverture, et un changement d'onglet met l'URL à jour.

- [ ] **Step 3: Git du projet actif**

`packages/ui/src/code/use-project-git.ts` :
```ts
import type { Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";
import { resolveWorktree, useWorktrees } from "./use-worktrees";

export function useProjectGit(projectId: string | null, folder: string | null) {
  const { worktrees, error: worktreesError } = useWorktrees(folder ? projectId : null);
  const main = resolveWorktree(worktrees, null);
  const mainPath = main?.path ?? null;
  const [changesCount, setChangesCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setChangesCount(null);
    if (!projectId || !mainPath) return;
    let alive = true;
    const load = () =>
      client.code({ method: "status", projectId, worktree: mainPath }).then(
        (s) => alive && setChangesCount(new Set(s.files.map((f) => f.path)).size),
        (e: unknown) => alive && setError(errorMessage(e)),
      );
    void load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId && e.worktree === mainPath) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId, mainPath]);
  const repoError = worktreesError && worktreesError.code !== "NOT_A_REPO" ? errorMessage(worktreesError) : null;
  return { worktrees: worktrees && worktrees.length > 0 ? worktrees : null, main, changesCount, error: repoError ?? error };
}
```
`NOT_A_REPO` n'est pas une erreur ici : le projet n'a simplement pas de dépôt. Toute autre erreur (git absent, dossier illisible) est affichée dans l'en-tête (`role="alert"`).

Un projet sans dossier ou hors dépôt n'a pas de worktree : l'entrée Changements est masquée (complément de spec §10). La pastille d'un onglet Changements n'est calculée que pour le worktree principal du projet actif.

- [ ] **Step 4: Hôte, fil d'Ariane, ticket**

`packages/ui/src/shell/Host.tsx` :
```tsx
import type { FileRef, TabTarget } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { createContext, type ReactNode, useContext } from "react";

export type Host = {
  openTicket(id: string): void;
  openNewTicket(d: NewTicketDefaults): void;
  openFile(ref: FileRef): void;
  openTarget(target: TabTarget, opts?: { newTab?: boolean }): void;
};
const HostContext = createContext<Host | null>(null);

export function HostProvider({ host, children }: { host: Host; children: ReactNode }) {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): Host {
  const host = useContext(HostContext);
  if (!host) throw new Error("useHost must be used inside <HostProvider>");
  return host;
}
```

`packages/ui/src/shell/Breadcrumb.tsx` :
```tsx
import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { ChevronRight } from "lucide-react";
import { fr } from "../i18n/fr";

export function crumbsFor(target: TabTarget | null, ctx: { project: ProjectSnapshot | null; branch: string | null }): string[] {
  const p = ctx.project;
  if (!target || !p) return [fr.nav.overview];
  const name = p.meta.name;
  switch (target.kind) {
    case "project":
      return [name];
    case "page":
      return [name, p.pages.find((x) => x.id === target.pageId)?.title ?? fr.tabs.missingPage];
    case "changes":
      return ctx.branch ? [name, fr.nav.changes, ctx.branch] : [name, fr.nav.changes];
    case "file":
      return [name, target.path];
    case "ticket":
      return [name, p.tickets.find((t) => t.id === target.ticketId)?.key ?? fr.tabs.missingTicket];
  }
}

export function Breadcrumb({ crumbs }: { crumbs: string[] }) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((label, i) => (
          <li key={`${i}:${label}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
            <span
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
              className={i === crumbs.length - 1 ? "truncate font-medium text-foreground" : "truncate"}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```
(La clé combine position et libellé : un fil d'Ariane est une suite ordonnée sans identifiant.)

`packages/ui/src/shell/TicketDetail.tsx` : déplacer ici le corps actuel de `TicketSheet` (liste `dl` des propriétés, description, sous-tickets), avec deux ajouts :
```tsx
import type { FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { LinkifiedText } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { GitPullRequest } from "lucide-react";
import { fr } from "../i18n/fr";

type Props = { project: ProjectSnapshot; ticket: TicketView; onOpenFile(ref: FileRef): void };

export function TicketDetail({ project, ticket: t, onOpenFile }: Props) {
  const status = project.workflow.find((s) => s.id === t.statusId)?.label ?? t.statusId;
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const prs = t.externalRefs.filter((r) => r.kind === "github_pr");
  const open = (r: { path: string; line: number | null }) =>
    onOpenFile({ projectId: project.meta.id, worktree: null, path: r.path, line: r.line, origin: t.key });
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-4 text-sm">
        <dt className="text-muted-foreground">{fr.ticket.status}</dt>
        <dd>{status}</dd>
        {t.blockedReason && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.blockedReason}</dt>
            <dd className="text-red-600 dark:text-red-400">{t.blockedReason}</dd>
          </>
        )}
        {t.waitingOn.length > 0 && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.waiting}</dt>
            <dd className="flex gap-1">
              {t.waitingOn.map((k) => (
                <Badge key={k} variant="outline">
                  {k}
                </Badge>
              ))}
            </dd>
          </>
        )}
        {prs.length > 0 && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.prs}</dt>
            <dd className="flex flex-wrap gap-1">
              {prs.map((pr) => (
                <Badge key={pr.url} variant="outline" asChild>
                  <a href={pr.url} target="_blank" rel="noreferrer" title={fr.ticket.prState[pr.state]}>
                    <GitPullRequest aria-hidden />
                    <span>#{pr.number}</span>
                  </a>
                </Badge>
              ))}
            </dd>
          </>
        )}
      </dl>
      <section className="grid gap-2 px-4 text-sm">
        <h3 className="font-medium">{fr.ticket.description}</h3>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {t.description ? <LinkifiedText text={t.description} onOpen={open} /> : "-"}
        </p>
      </section>
      {children.length > 0 && (
        <section className="grid gap-1 px-4 text-sm">
          <h3 className="font-medium">
            {fr.ticket.subtickets} {`${t.progress.done}/${t.progress.total}`}
          </h3>
          {children.map((c) => (
            <p key={c.id}>
              <span className="font-mono text-xs text-muted-foreground">{c.key}</span> {c.title}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
```

`packages/ui/src/shell/TicketSheet.tsx` :
```tsx
import type { FileRef, ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Maximize2 } from "lucide-react";
import { fr } from "../i18n/fr";
import { TicketDetail } from "./TicketDetail";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  onClose(): void;
  onOpenInTab(): void;
  onOpenFile(ref: FileRef): void;
};

export function TicketSheet({ project, ticketId, onClose, onOpenInTab, onOpenFile }: Props) {
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetDescription className="font-mono">{t.key}</SheetDescription>
          <SheetTitle>{t.title}</SheetTitle>
          <Button variant="outline" size="sm" className="w-fit" onClick={onOpenInTab}>
            <Maximize2 />
            {fr.ticket.openInTab}
          </Button>
        </SheetHeader>
        <TicketDetail project={project} ticket={t} onOpenFile={onOpenFile} />
      </SheetContent>
    </Sheet>
  );
}
```

`packages/ui/src/pages/TicketTab.tsx` :
```tsx
import type { FileRef, ProjectSnapshot } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { TicketDetail } from "../shell/TicketDetail";

type Props = { project: ProjectSnapshot; ticketId: string; onOpenFile(ref: FileRef): void };

export function TicketTab({ project, ticketId, onOpenFile }: Props) {
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingTicket}</p>;
  return (
    <article className="mx-auto grid max-w-3xl gap-4 py-8">
      <header className="grid gap-1 px-4">
        <p className="font-mono text-sm text-muted-foreground">{t.key}</p>
        <h1 className="text-xl font-semibold">{t.title}</h1>
      </header>
      <TicketDetail project={project} ticket={t} onOpenFile={onOpenFile} />
    </article>
  );
}
```

- [ ] **Step 5: Contenu, sidebar et shell**

`packages/ui/src/shell/ContentView.tsx` :
```tsx
import type { FileRef, ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import { ChangesView } from "../code/ChangesView";
import { FileTabView } from "../files/FileTabView";
import { fr } from "../i18n/fr";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { TicketTab } from "../pages/TicketTab";
import { targetToHash } from "../tabs/target-hash";
import { Overview } from "./Overview";

type Props = {
  target: TabTarget | null;
  viewer: string;
  projects: ProjectSummary[];
  project: ProjectSnapshot | null;
  startEditing: boolean;
  onNewProject(): void;
  onNewPage(): void;
  onOpen(target: TabTarget): void;
  onOpenFile(ref: FileRef): void;
};

export function ContentView(p: Props) {
  const t = p.target;
  if (!t) return <Overview viewer={p.viewer} projects={p.projects} onNewProject={p.onNewProject} />;
  if (!p.project) return null;
  switch (t.kind) {
    case "project":
      return <ProjectHome project={p.project} onNewPage={p.onNewPage} />;
    case "page": {
      const page = p.project.pages.find((x) => x.id === t.pageId);
      if (!page) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingPage}</p>;
      return <PageView key={page.id} project={p.project} page={page} viewer={p.viewer} />;
    }
    case "changes":
      return (
        <ChangesView
          project={p.project}
          worktree={t.worktree}
          onWorktreeChange={(worktree) => p.onOpen({ ...t, worktree })}
          onOpenFile={p.onOpenFile}
        />
      );
    case "file":
      return (
        <FileTabView
          key={targetToHash(t)}
          fileRef={{ projectId: t.projectId, worktree: t.worktree, path: t.path, line: t.line, origin: null }}
          startEditing={p.startEditing}
        />
      );
    case "ticket":
      return <TicketTab project={p.project} ticketId={t.ticketId} onOpenFile={p.onOpenFile} />;
  }
}
```

`packages/ui/src/shell/AppSidebar.tsx`, version complète :
```tsx
import type { Page, ProjectMeta, ProjectSnapshot, TabTarget } from "@kibo/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@kibo/sdk/ui/sidebar";
import { GitCommitHorizontal, Plus, Search } from "lucide-react";
import type { MouseEvent } from "react";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";
import { KiboLogo } from "./KiboLogo";

type Props = {
  className?: string;
  projects: ProjectMeta[];
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  changesCount: number | null;
  onOpen(target: TabTarget | null, newTab: boolean): void;
  onSearch(): void;
  onNewProject(): void;
  onNewPage(parentId: string | null): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

export function AppSidebar({ className, projects, active, activeTarget, changesCount, onOpen, onSearch, onNewProject, onNewPage }: Props) {
  const link = (target: TabTarget | null) => ({
    onClick: (e: MouseEvent) => onOpen(target, wantsNewTab(e)),
    onAuxClick: (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      onOpen(target, true);
    },
  });
  const children = (parentId: string | null): Page[] => active?.pages.filter((p) => p.parentId === parentId) ?? [];
  const renderPages = (projectId: string, parentId: string | null) =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, active?.instances ?? []);
      return (
        <SidebarMenuSubItem key={page.id}>
          <SidebarMenuSubButton
            isActive={activeTarget?.kind === "page" && activeTarget.pageId === page.id}
            {...link({ kind: "page", projectId, pageId: page.id })}
          >
            <Icon />
            <span>{page.title}</span>
          </SidebarMenuSubButton>
          {children(page.id).length > 0 && <SidebarMenuSub>{renderPages(projectId, page.id)}</SidebarMenuSub>}
        </SidebarMenuSubItem>
      );
    });

  return (
    <Sidebar className={className}>
      <SidebarHeader>
        <span className="flex items-center gap-2 px-2 py-1 text-sm font-semibold">
          <KiboLogo className="size-5" decorative />
          {fr.app.name}
        </span>
        <button
          type="button"
          onClick={onSearch}
          className="flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-sm text-muted-foreground"
        >
          <Search aria-hidden className="size-4" />
          <span className="flex-1 text-left">{fr.nav.search}</span>
          <kbd className="font-mono text-xs">⌘K</kbd>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activeTarget === null} {...link(null)}>
                {fr.nav.overview}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{fr.nav.projects}</SidebarGroupLabel>
          <SidebarGroupAction aria-label={fr.nav.newProject} onClick={onNewProject}>
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {projects.map((p) => {
              const current = active?.meta.id === p.id;
              return (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={activeTarget?.kind === "project" && activeTarget.projectId === p.id}
                    {...link({ kind: "project", projectId: p.id })}
                  >
                    <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
                    <span>{p.name}</span>
                  </SidebarMenuButton>
                  {current && (
                    <>
                      <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => onNewPage(null)}>
                        <Plus />
                      </SidebarMenuAction>
                      {(children(null).length > 0 || changesCount !== null) && (
                        <SidebarMenuSub>
                          {renderPages(p.id, null)}
                          {changesCount !== null && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                isActive={activeTarget?.kind === "changes" && activeTarget.projectId === p.id}
                                aria-label={`${fr.nav.changes} · ${fr.nav.changesCount(changesCount)}`}
                                {...link({ kind: "changes", projectId: p.id, worktree: null })}
                              >
                                <GitCommitHorizontal />
                                <span>{fr.nav.changes}</span>
                                {changesCount > 0 && (
                                  <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{changesCount}</span>
                                )}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      )}
                    </>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```
Comme au MVP, le sous-menu n'est pas rendu vide : il n'apparaît que si le projet a une page ou un dépôt.

`packages/ui/src/shell/Shell.tsx`, version complète :
```tsx
import type { FileRef, ProjectSummary, TabTarget } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { useMemo, useRef, useState } from "react";
import { resolveWorktree } from "../code/use-worktrees";
import { useProjectGit } from "../code/use-project-git";
import { NewPageDialog } from "../dialogs/NewPageDialog";
import { NewProjectDialog } from "../dialogs/NewProjectDialog";
import { NewTicketDialog } from "../dialogs/NewTicketDialog";
import { FilePreviewSheet } from "../files/FilePreviewSheet";
import { CommandPalette } from "../palette/CommandPalette";
import type { PaletteAction } from "../palette/palette-items";
import { useRoute } from "../route";
import { useProject, useProjects } from "../state/use-projects";
import { useSnapshots } from "../state/use-snapshots";
import { TabBar } from "../tabs/TabBar";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget } from "../tabs/tabs-model";
import { targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import { useTabShortcuts } from "../tabs/use-tab-shortcuts";
import { type TabsApi, useTabs } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { ContentView } from "./ContentView";
import { type Host, HostProvider } from "./Host";
import { TicketSheet } from "./TicketSheet";

export function Shell({ viewer }: { viewer: string }) {
  const projects = useProjects();
  const tabs = useTabs();
  if (!projects || !tabs) return null;
  return <Workspace viewer={viewer} projects={projects} tabs={tabs} />;
}

const inTauri = () => "__TAURI_INTERNALS__" in window;

function Workspace({ viewer, projects, tabs }: { viewer: string; projects: ProjectSummary[]; tabs: TabsApi }) {
  const route = useRoute();
  useHashSync(tabs, route.target);
  const active = activeTarget(tabs.state);
  const project = useProject(active?.projectId ?? null);
  const snapshots = useSnapshots(projects.map((p) => p.id));
  const git = useProjectGit(project?.meta.id ?? null, project?.meta.folder ?? null);
  const [palette, setPalette] = useState<{ newTab: boolean } | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [newPageParent, setNewPageParent] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<{ projectId: string; ticketId: string } | null>(null);
  const [newTicket, setNewTicket] = useState<NewTicketDefaults | null>(null);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const editRequests = useRef(new Set<string>());
  const activeProjectId = active?.projectId ?? null;
  const open = tabs.open;

  const host = useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) setSheet({ projectId: activeProjectId, ticketId });
      },
      openNewTicket: setNewTicket,
      openFile: setPreview,
      openTarget: (target, opts) => open(target, opts),
    }),
    [activeProjectId, open],
  );

  useTabShortcuts((s) => {
    if (s.kind === "palette") return setPalette({ newTab: false });
    if (s.kind === "newTab") return setPalette({ newTab: true });
    if (s.kind === "activate") return tabs.dispatch({ type: "activateIndex", index: s.index });
    const id = tabs.state.activeId;
    if (!id) return;
    if (s.kind === "close") tabs.dispatch({ type: "close", id });
    if (s.kind === "togglePin")
      tabs.dispatch({ type: "pin", id, pinned: !tabs.state.tabs.find((t) => t.id === id)?.pinned });
  });

  const onAction = (a: PaletteAction) => {
    if (a.kind === "newProject") return setNewProject(true);
    if (a.kind === "toggleTheme") return void cycleTheme();
    if (a.projectId !== activeProjectId) open({ kind: "project", projectId: a.projectId });
    if (a.kind === "newPage") setNewPageParent(null);
    if (a.kind === "newTicket") setNewTicket({ parentId: a.parentId });
  };
  const openFileTab = (ref: FileRef, edit: boolean) => {
    const target: TabTarget = { kind: "file", projectId: ref.projectId, worktree: ref.worktree, path: ref.path, line: ref.line };
    if (edit) editRequests.current.add(targetToHash(target));
    setPreview(null);
    open(target, { newTab: true });
  };

  const branch =
    active?.kind === "changes" ? (resolveWorktree(git.worktrees, active.worktree)?.branch ?? null) : null;
  const sheetProject = sheet ? snapshots.get(sheet.projectId) : undefined;
  const isDirty = (t: TabTarget) =>
    t.kind === "changes" &&
    t.projectId === project?.meta.id &&
    (t.worktree === null || t.worktree === git.main?.path) &&
    (git.changesCount ?? 0) > 0;

  return (
    <HostProvider host={host}>
      <div className="flex h-svh flex-col [--tabbar-h:2.75rem]">
        <TabBar
          state={tabs.state}
          describe={(t) => describeTarget(t, { projects, snapshots })}
          isDirty={isDirty}
          dispatch={tabs.dispatch}
          onNewTab={() => setPalette({ newTab: true })}
          onOpenWindow={
            inTauri() ? null : (t) => window.open(`${location.pathname}${targetToHash(t)}`, "_blank", "noopener")
          }
          error={tabs.error}
        />
        <SidebarProvider className="min-h-0 flex-1">
          <AppSidebar
            className="top-(--tabbar-h) h-[calc(100svh-var(--tabbar-h))]!"
            projects={projects}
            active={project}
            activeTarget={active}
            changesCount={git.worktrees ? git.changesCount : null}
            onOpen={(t, newTab) => open(t, { newTab })}
            onSearch={() => setPalette({ newTab: false })}
            onNewProject={() => setNewProject(true)}
            onNewPage={(parentId) => setNewPageParent(parentId)}
          />
          <SidebarInset className="min-h-0 min-w-0">
            <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <Breadcrumb crumbs={crumbsFor(active, { project, branch })} />
              {git.error && (
                <p role="alert" className="ml-auto text-xs text-destructive">
                  {git.error}
                </p>
              )}
            </header>
            <div className="min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
              <ContentView
                target={active}
                viewer={viewer}
                projects={projects}
                project={project}
                startEditing={active?.kind === "file" && editRequests.current.has(targetToHash(active))}
                onNewProject={() => setNewProject(true)}
                onNewPage={() => setNewPageParent(null)}
                onOpen={(t) => open(t)}
                onOpenFile={setPreview}
              />
            </div>
          </SidebarInset>
          <NewProjectDialog open={newProject} onOpenChange={setNewProject} count={projects.length} />
          {project && newPageParent !== undefined && (
            <NewPageDialog
              projectId={project.meta.id}
              projectName={project.meta.name}
              parentId={newPageParent}
              open
              onOpenChange={(o) => !o && setNewPageParent(undefined)}
            />
          )}
          {sheet && sheetProject && (
            <TicketSheet
              project={sheetProject}
              ticketId={sheet.ticketId}
              onClose={() => setSheet(null)}
              onOpenInTab={() => {
                setSheet(null);
                open({ kind: "ticket", projectId: sheet.projectId, ticketId: sheet.ticketId }, { newTab: true });
              }}
              onOpenFile={setPreview}
            />
          )}
          {project && newTicket && (
            <NewTicketDialog project={project} viewer={viewer} defaults={newTicket} onClose={() => setNewTicket(null)} />
          )}
          {preview && (
            <FilePreviewSheet fileRef={preview} onClose={() => setPreview(null)} onOpenInTab={(edit) => openFileTab(preview, edit)} />
          )}
          <CommandPalette
            open={palette !== null}
            onOpenChange={(o) => !o && setPalette(null)}
            newTab={palette?.newTab ?? false}
            context={{
              projects,
              snapshots,
              recents: tabs.state.recents,
              activeProjectId,
              activeTicketId: active?.kind === "ticket" ? active.ticketId : (sheet?.ticketId ?? null),
            }}
            onOpenTarget={(t, newTab) => open(t, { newTab })}
            onOpenTicketSheet={(projectId, ticketId) => setSheet({ projectId, ticketId })}
            onAction={onAction}
          />
        </SidebarProvider>
      </div>
    </HostProvider>
  );
}
```
`PageView` passe déjà `host.openFile` au SDK (tâche 1). Si le fichier dépasse 300 lignes, extraire les dialogues dans `shell/ShellDialogs.tsx`. Le `useMemo` du contexte de la palette est inutile : `buildItems` est mémoïsé dans la palette sur l'objet `context` ; si la review relève des recalculs, mémoïser `context` avec `useMemo([projects, snapshots, tabs.state.recents, activeProjectId, …])`.

- [ ] **Step 6: Lancer les tests et vérifier l'E2E du MVP**

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: PASS, y compris le parcours `e2e/mvp.spec.ts` inchangé (la navigation passe par les onglets).

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/route.ts packages/ui/src/tabs/use-hash-sync.ts packages/ui/src/code/use-project-git.ts packages/ui/src/shell packages/ui/src/pages/TicketTab.tsx
git commit -m "feat(ui): onglets et palette dans le shell"
```

---

### Task 21: Service `code` du démon, route `/api/code` et suivi des PR

**Files:**
- Create: `packages/daemon/src/code/code-service.ts`, `packages/daemon/src/code/code-service.test.ts`
- Modify: `packages/daemon/src/server.ts`, `packages/daemon/src/server.test.ts`, `packages/daemon/src/main.ts`

**Interfaces:**
- Consumes: tout `packages/daemon/src/code/*` (tâches 3, 4, 7, 8, 15, 17, 18, 19) ; `call`, `Service` (tâche 6) ; `commitDefaults` (tâche 5) ; `CodeRequest`, `CodeEvent` (tâche 1).
- Produces : `type CodeService = { handle(req: CodeRequest): Promise<unknown>; onChange(listener: (e: CodeEvent) => void): () => void; stop(): void }` ; `createCodeService(service: Service, opts?: { env?: Env; prPollMs?: number; idleMs?: number; platform?: NodeJS.Platform }): CodeService` ; `ServerOptions.code?: CodeService` ; route `POST /api/code` ; événements `{ type: "code", projectId, worktree }` publiés sur le sujet WebSocket `changes`.

- [ ] **Step 1: Tests du service**

`packages/daemon/src/code/code-service.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeEvent, ProjectMeta, Ticket } from "@kibo/schema";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type CodeService, createCodeService } from "./code-service";
import { createGitFixture, type GitFixture, installFakeGh } from "./testing/git-fixture";

let fx: GitFixture;
let home: string;
let store: Store;
let service: Service;
let code: CodeService;
let project: ProjectMeta;
let gh: Record<string, string>;
const events: CodeEvent[] = [];


beforeEach(() => {
  fx = createGitFixture();
  fx.commit("chore: init", { "README.md": "# kibo\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.git("checkout", "-q", "-b", "kib-1");
  gh = installFakeGh(fx.dir);
  home = mkdtempSync(join(tmpdir(), "kibo-code-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  project = call(service, { method: "createProject", name: "Kibo", key: "KIB", folder: fx.repo, color: "#F97316" });
  events.length = 0;
});
afterEach(() => {
  code.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  fx.cleanup();
});

const start = (prPollMs = 0) => {
  code = createCodeService(service, { env: { ...fx.env, ...gh }, prPollMs });
  code.onChange((e) => events.push(e));
};
const w = () => ({ projectId: project.id, worktree: fx.repo });

test("reads go through the registered worktree only", async () => {
  start();
  expect(await code.handle({ method: "worktrees", projectId: project.id })).toMatchObject([{ path: fx.repo, isMain: true }]);
  await expect(code.handle({ method: "status", projectId: project.id, worktree: fx.dir })).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  const bare = call(service, { method: "createProject", name: "Sans", key: "SNS", folder: null, color: "#F97316" });
  await expect(code.handle({ method: "worktrees", projectId: bare.id })).rejects.toMatchObject({ code: "NOT_A_REPO" });
});

test("a mutation emits an event at once, an external change emits one through the watcher", async () => {
  start();
  await code.handle({ method: "status", ...w() });
  fx.write("README.md", "# kibo\nedit\n");
  await Bun.sleep(600);
  expect(events).toContainEqual({ type: "code", projectId: project.id, worktree: fx.repo });
  events.length = 0;
  await code.handle({ method: "stageFiles", ...w(), paths: ["README.md"] });
  expect(events).toEqual([{ type: "code", projectId: project.id, worktree: fx.repo }]);
});

test("commit defaults come from the ticket named by the branch", async () => {
  start();
  call(service, { method: "command", projectId: project.id, command: { method: "createTicket", title: "Schéma Loro des tickets" } });
  expect(await code.handle({ method: "commitDefaults", ...w() })).toMatchObject({
    ticketKey: "KIB-1",
    message: "feat: schéma Loro des tickets (KIB-1)",
  });
});

test("createPr links the PR to the ticket, the poller follows its state", async () => {
  start(50);
  const ticket = call(service, { method: "command", projectId: project.id, command: { method: "createTicket", title: "Schéma" } }) as Ticket;
  fx.commit("feat: schéma (KIB-1)", { "a.txt": "a\n" });
  const pr = await code.handle({
    method: "createPr",
    ...w(),
    title: "feat: schéma (KIB-1)",
    body: "## Ticket",
    base: "main",
    draft: false,
    reviewers: [],
    ticketId: ticket.id,
  });
  expect(pr).toEqual({ number: 1, url: "https://github.com/kibo/test/pull/1", state: "open" });
  const refs = () => call(service, { method: "getProject", projectId: project.id }).tickets[0]?.externalRefs;
  expect(refs()).toEqual([{ kind: "github_pr", url: "https://github.com/kibo/test/pull/1", number: 1, state: "open" }]);
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as { state: string }[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, state: "MERGED" }))));
  await Bun.sleep(400);
  expect(refs()?.[0]?.state).toBe("merged");
});
```
(`as Ticket` lit le résultat de `command`, typé `unknown` par `RpcResult`, comme dans les tests existants du démon.)

Run: `bun test packages/daemon/src/code/code-service.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 2: Implémenter le service**

`packages/daemon/src/code/code-service.ts` :
```ts
import { commitDefaults } from "@kibo/core";
import type { CodeEvent, CodeRequest } from "@kibo/schema";
import { call, type Service } from "../service";
import { editorCommand, openInEditor } from "./editor";
import { abortOperation, commit, reword, undoCommit } from "./history-ops";
import { stageFiles, stageHunk, unstageFiles, writeFile } from "./index-ops";
import { compare, readDiff, readFile, readStatus, remoteBranches } from "./read";
import { createPr, ghStatus, prForBranch, prState, push } from "./remote-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import type { Env } from "./run";
import { resolveInWorktree } from "./safe-path";
import { type WatchHandle, watchPaths } from "./watcher";

export type CodeService = {
  handle(req: CodeRequest): Promise<unknown>;
  onChange(listener: (e: CodeEvent) => void): () => void;
  stop(): void;
};
export type CodeServiceOptions = { env?: Env; prPollMs?: number; idleMs?: number; platform?: NodeJS.Platform };
type Watched = { handle: WatchHandle; lastRead: number; signature: string };
type CreatePrRequest = Extract<CodeRequest, { method: "createPr" }>;

const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what}`, e);

export function createCodeService(service: Service, opts: CodeServiceOptions = {}): CodeService {
  const env = opts.env ?? {};
  const idleMs = opts.idleMs ?? 600_000;
  const listeners = new Set<(e: CodeEvent) => void>();
  const watched = new Map<string, Watched>();
  const emit = (e: CodeEvent) => {
    for (const l of listeners) l(e);
  };
  const folderOf = (projectId: string) => call(service, { method: "getProject", projectId }).meta.folder;
  const open = async (projectId: string, path: string) => (await openRepo(folderOf(projectId), env)).open(path);

  const signatureOf = async (h: WorktreeHandle) => {
    const [status, refs] = await Promise.all([
      h.git.run(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"]),
      h.git.run(["for-each-ref", "--format=%(objectname) %(refname)", "refs/heads", "refs/remotes"]),
    ]);
    return `${status.stdout}\n${refs.stdout}`;
  };
  const refresh = async (projectId: string, h: WorktreeHandle) => {
    const entry = watched.get(h.path);
    if (!entry) return;
    const signature = await signatureOf(h);
    if (signature === entry.signature) return;
    entry.signature = signature;
    emit({ type: "code", projectId, worktree: h.path });
  };
  const watch = async (projectId: string, h: WorktreeHandle) => {
    const current = watched.get(h.path);
    if (current) {
      current.lastRead = Date.now();
      return;
    }
    const handle = watchPaths(
      [
        { path: h.path, recursive: true },
        { path: h.gitDir, recursive: false },
        { path: h.commonDir, recursive: true },
      ],
      () => void refresh(projectId, h).catch(log(`git refresh failed for ${h.path}`)),
      { onError: log(`watcher failed for ${h.path}`) },
    );
    const entry: Watched = { handle, lastRead: Date.now(), signature: "" };
    watched.set(h.path, entry);
    entry.signature = await signatureOf(h);
  };
  const after = async <T>(projectId: string, h: WorktreeHandle, work: Promise<T>): Promise<T> => {
    const result = await work;
    const entry = watched.get(h.path);
    if (entry) entry.signature = await signatureOf(h);
    emit({ type: "code", projectId, worktree: h.path });
    return result;
  };
  const createPrAndLink = async (h: WorktreeHandle, req: CreatePrRequest) => {
    const pr = await createPr(h, req);
    if (req.ticketId)
      call(service, {
        method: "command",
        projectId: req.projectId,
        command: { method: "upsertExternalRef", ticketId: req.ticketId, ref: { kind: "github_pr", ...pr } },
      });
    return pr;
  };
  const pollPrs = async () => {
    for (const p of call(service, { method: "listProjects" })) {
      if (!p.folder) continue;
      for (const t of call(service, { method: "getProject", projectId: p.id }).tickets) {
        for (const ref of t.externalRefs) {
          if (ref.state === "merged" || ref.state === "closed") continue;
          const info = await prState(ref.url, p.folder, env).catch((e: unknown) => {
            log(`PR status failed for ${ref.url}`)(e);
            return null;
          });
          if (info && info.state !== ref.state)
            call(service, {
              method: "command",
              projectId: p.id,
              command: { method: "upsertExternalRef", ticketId: t.id, ref: { ...ref, state: info.state } },
            });
        }
      }
    }
  };
  const sweep = setInterval(() => {
    for (const [path, entry] of watched) {
      if (Date.now() - entry.lastRead < idleMs) continue;
      entry.handle.close();
      watched.delete(path);
    }
  }, 60_000);
  const poller = opts.prPollMs === 0 ? null : setInterval(() => void pollPrs().catch(log("PR poll failed")), opts.prPollMs ?? 60_000);

  return {
    async handle(req) {
      if (req.method === "worktrees") return (await openRepo(folderOf(req.projectId), env)).worktrees();
      const h = await open(req.projectId, req.worktree);
      const p = req.projectId;
      switch (req.method) {
        case "status":
          await watch(p, h);
          return readStatus(h);
        case "diff":
          return readDiff(h, req.path, req.origPath, req.area);
        case "readFile":
          return readFile(h, req.path, req.revision);
        case "remoteBranches":
          return remoteBranches(h);
        case "compare":
          return compare(h, req.base);
        case "ghStatus":
          return ghStatus(h);
        case "prForBranch":
          return prForBranch(h);
        case "commitDefaults": {
          const status = await readStatus(h);
          const subjects = status.commits.filter((c) => !c.pushed).map((c) => c.subject);
          return commitDefaults(call(service, { method: "getProject", projectId: p }), status.branch, subjects);
        }
        case "openInEditor":
          openInEditor(
            editorCommand(resolveInWorktree(h.path, req.path), req.line, { ...process.env, ...env }, opts.platform ?? process.platform),
            env,
          );
          return null;
        case "writeFile":
          return after(p, h, writeFile(h, req.path, req.content, req.baseHash));
        case "stageFiles":
          return after(p, h, stageFiles(h, req.paths).then(() => null));
        case "unstageFiles":
          return after(p, h, unstageFiles(h, req.paths).then(() => null));
        case "stageHunk":
          return after(p, h, stageHunk(h, req).then(() => null));
        case "commit":
          return after(p, h, commit(h, req.message, req.amend));
        case "reword":
          return after(p, h, reword(h, req.sha, req.message).then(() => null));
        case "undoCommit":
          return after(p, h, undoCommit(h, req.sha).then(() => null));
        case "abortOperation":
          return after(p, h, abortOperation(h).then(() => null));
        case "push":
          return after(p, h, push(h).then(() => null));
        case "createPr":
          return after(p, h, createPrAndLink(h, req));
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      clearInterval(sweep);
      if (poller) clearInterval(poller);
      for (const entry of watched.values()) entry.handle.close();
      watched.clear();
    },
  };
}
```
Le suivi des PR est une tâche de fond : un échec est journalisé et la PR suivante est tentée (la dernière erreur reste visible dans le journal du démon), sans bloquer les autres projets.

- [ ] **Step 3: Tests de la route**

Ajouter à `packages/daemon/src/server.test.ts` un bloc autonome :
```ts
describe("/api/code", () => {
  let fx: GitFixture;
  let codeHome: string;
  let codeStore: Store;
  let codeServer: ReturnType<typeof startServer>;
  let code: CodeService;
  let projectId: string;
  beforeEach(() => {
    fx = createGitFixture({ remote: false });
    fx.commit("chore: init", { "README.md": "# kibo\n" });
    codeHome = mkdtempSync(join(tmpdir(), "kibo-code-srv-"));
    codeStore = openStore(codeHome);
    const svc = createService(codeStore, { user: "adam" });
    code = createCodeService(svc, { env: fx.env, prPollMs: 0 });
    codeServer = startServer({ service: svc, code, token: TOKEN, port: 0, uiDir: null });
    projectId = (
      svc.handle({ method: "createProject", name: "Kibo", key: "KIB", folder: fx.repo, color: "#F97316" }) as { id: string }
    ).id;
  });
  afterEach(() => {
    codeServer.stop();
    code.stop();
    codeStore.close();
    rmSync(codeHome, { recursive: true, force: true });
    fx.cleanup();
  });
  const send = (body: unknown, headers: Record<string, string>) =>
    fetch(`${codeServer.url}/api/code`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: codeServer.url, ...headers },
      body: JSON.stringify(body),
    });
  const pairCode = async () => {
    const res = await fetch(`${codeServer.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: codeServer.url },
      body: JSON.stringify({ token: TOKEN }),
    });
    return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  };

  test("requires a session and a known origin, validates the body", async () => {
    expect((await send({ method: "worktrees", projectId }, {})).status).toBe(401);
    const cookie = await pairCode();
    expect((await send({ method: "worktrees", projectId }, { cookie, origin: "http://evil.test" })).status).toBe(403);
    expect((await send({ method: "status", projectId }, { cookie })).status).toBe(400);
    const ok = await send({ method: "status", projectId, worktree: fx.repo }, { cookie });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { result: { branch: string } }).result.branch).toBe("main");
  });

  test("paths outside the worktree are forbidden, stale edits conflict", async () => {
    const cookie = await pairCode();
    const outside = await send({ method: "readFile", projectId, worktree: fx.repo, path: ".git/config", revision: "worktree" }, { cookie });
    expect(outside.status).toBe(403);
    const stale = await send(
      { method: "writeFile", projectId, worktree: fx.repo, path: "README.md", content: "x", baseHash: "0".repeat(40) },
      { cookie },
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, error: { code: "FILE_CHANGED" } });
  });

  test("code events reach the WebSocket", async () => {
    const cookie = await pairCode();
    const ws = new WebSocket(codeServer.url.replace("http", "ws") + "/api/events", { headers: { origin: codeServer.url, cookie } });
    await new Promise((r) => {
      ws.onopen = r;
    });
    const message = new Promise<string>((r) => {
      ws.onmessage = (e) => r(String(e.data));
    });
    fx.write("README.md", "# edit\n");
    await send({ method: "stageFiles", projectId, worktree: fx.repo, paths: ["README.md"] }, { cookie });
    expect(JSON.parse(await message)).toEqual({ type: "code", projectId, worktree: fx.repo });
    ws.close();
  });
});
```
(Importer `createCodeService`, `CodeService` depuis `./code/code-service` et `createGitFixture`, `GitFixture` depuis `./code/testing/git-fixture` ; `as { id: string }` lit le résultat non typé de `handle`, comme ailleurs dans ce fichier.)

Run: `bun test packages/daemon/src/server.test.ts`
Expected: FAIL (`/api/code` renvoie 404).

- [ ] **Step 4: Brancher la route et le démarrage**

`packages/daemon/src/server.ts` :
- importer `CodeRequest` depuis `@kibo/schema` et `type CodeService` depuis `./code/code-service` ;
- ajouter `code?: CodeService;` à `ServerOptions` ;
- compléter la table des statuts :
```ts
const STATUS: Partial<Record<KiboErrorCode, number>> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PATH_OUTSIDE_PROJECT: 403,
  GIT_STALE: 409,
  GIT_PUSHED: 409,
  GIT_BUSY: 409,
  FILE_CHANGED: 409,
  GH_UNAVAILABLE: 502,
  GH_FAILED: 502,
};
```
- extraire la gestion d'erreur commune et ajouter la route, après la vérification de session :
```ts
const respond = async (work: () => unknown): Promise<Response> => {
  try {
    return json({ ok: true, result: (await work()) ?? null });
  } catch (e) {
    if (e instanceof KiboError) return fail(e.code, e.detail, STATUS[e.code] ?? 400);
    console.error("[kibo-daemon] request failed", e);
    return fail("INTERNAL", "internal error", 500);
  }
};
```
```ts
    if (url.pathname === "/api/rpc" && req.method === "POST") {
      const parsed = RpcRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      return respond(() => opts.service.handle(parsed.data));
    }
    if (url.pathname === "/api/code" && req.method === "POST" && opts.code) {
      const code = opts.code;
      const parsed = CodeRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      return respond(() => code.handle(parsed.data));
    }
```
(`respond` est défini au niveau du module, sous `fail`.)
- après l'abonnement existant aux changements de projet :
```ts
  const offCode = opts.code?.onChange((e) => {
    server.publish("changes", JSON.stringify(e));
  });
```
et dans `stop` : `offCode?.();` avant `server.stop(true)`.

`packages/daemon/src/main.ts` :
```ts
import { createCodeService } from "./code/code-service";
```
créer `const service = createService(store, { user: userInfo().username });` puis `const code = createCodeService(service);`, passer `service` et `code` à `startServer`, et appeler `code.stop();` dans `shutdown` avant `store.close()`.

Si la phase 2 a déjà changé la forme des messages WebSocket ou la gestion d'erreur de `/api/rpc`, garder sa version et n'ajouter que la route `/api/code`, les statuts et la publication des événements `code`.

- [ ] **Step 5: Lancer les tests**

Run: `bun test packages/daemon && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/daemon/src/code/code-service.ts packages/daemon/src/code/code-service.test.ts packages/daemon/src/server.ts packages/daemon/src/server.test.ts packages/daemon/src/main.ts
git commit -m "feat(daemon): route code et suivi des PR"
```

---

### Task 22: Parcours E2E modifier → commit → amend → PR

Sortie de la phase (feuille de route) : parcours Playwright sur un dépôt de test et un faux `gh`, en sombre et en clair, sur macOS et Linux.

**Files:**
- Create: `e2e/git-repo.ts`, `e2e/code.spec.ts`, `e2e/tabs.spec.ts`
- Modify: `e2e/serve.ts`

**Interfaces:**
- Consumes: l'application complète (tâches 1 à 21) ; `packages/daemon/src/code/testing/fake-gh.ts`.
- Produces : `createE2eRepo(key: string): { repo: string; branch: string; git(...args: string[]): string; write(path: string, content: string): void }` ; `FAKE_GH_DIR` (dossier fixe partagé entre `serve.ts` et les tests).

- [ ] **Step 1: Faux `gh` et identité git pour le démon d'E2E**

`e2e/git-repo.ts` :
```ts
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const FAKE_GH_DIR = join(tmpdir(), "kibo-e2e-gh");
export const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Adam",
  GIT_AUTHOR_EMAIL: "adam@example.test",
  GIT_COMMITTER_NAME: "Adam",
  GIT_COMMITTER_EMAIL: "adam@example.test",
};

export function createE2eRepo(key: string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `kibo-e2e-${key}-`)));
  const repo = join(dir, "repo");
  const remote = join(dir, "remote.git");
  mkdirSync(repo);
  const env = { ...process.env, ...GIT_IDENTITY };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  const branch = `${key.toLowerCase()}-1`;
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env });
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", remote);
  write("src/ticket.ts", Array.from({ length: 30 }, (_, i) => `export const line${i + 1} = ${i + 1};`).join("\n") + "\n");
  write("README.md", "# test\n");
  git("add", "-A");
  git("commit", "-q", "-m", "chore: init");
  git("push", "-q", "-u", "origin", "main");
  git("checkout", "-q", "-b", branch);
  return { repo, branch, git, write };
}
```

`e2e/serve.ts` : avant de lancer le démon, installer le faux `gh` dans `FAKE_GH_DIR` et passer l'identité git :
```ts
import { chmodSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { FAKE_GH_DIR, GIT_IDENTITY } from "./git-repo";

rmSync(FAKE_GH_DIR, { recursive: true, force: true });
mkdirSync(FAKE_GH_DIR, { recursive: true });
const gh = join(FAKE_GH_DIR, "gh");
copyFileSync(join(root, "packages/daemon/src/code/testing/fake-gh.ts"), gh);
chmodSync(gh, 0o755);
```
et dans l'environnement du démon : `{ ...process.env, ...GIT_IDENTITY, KIBO_HOME: home, KIBO_GH: gh, FAKE_GH_STATE: join(FAKE_GH_DIR, "state.json"), FAKE_GH_LOG: join(FAKE_GH_DIR, "log.jsonl") }` (fusionner avec les imports existants de `serve.ts`).

- [ ] **Step 2: Parcours du code**

`e2e/code.spec.ts` :
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type TestInfo, test } from "@playwright/test";
import { createE2eRepo, FAKE_GH_DIR } from "./git-repo";
import { E2E_TOKEN } from "./token";

const projectKey = (base: string, info: TestInfo) => `${base}${info.project.name === "light" ? "L" : "D"}`;

test("modifier → indexer un bloc → commit → amend → PR", async ({ page }, info) => {
  const key = projectKey("GIT", info);
  const repo = createE2eRepo(key);

  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await page.getByLabel("Nom").fill(`Code ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByLabel("Dossier du projet").fill(repo.repo);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("nouveau ticket");
  await palette.getByRole("option", { name: "Nouveau ticket" }).click();
  await page.getByLabel("Titre").fill("Schéma Loro des tickets (LoroTree)");
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  repo.write("src/ticket.ts", readFileSync(join(repo.repo, "src/ticket.ts"), "utf8").replace("line2 = 2", "line2 = 20").replace("line29 = 29", "line29 = 290"));
  const changes = page.getByRole("button", { name: /^Changements/ });
  await expect(changes).toBeVisible();
  await changes.click();
  await expect(page.getByRole("tab", { name: `Code ${key} · Changements` })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" }).getByText(repo.branch)).toBeVisible();

  await page.getByRole("button", { name: /ticket\.ts/ }).first().click();
  await page.getByRole("button", { name: "Indexer le bloc" }).first().click();
  await expect(page.getByRole("group", { name: "Indexés" }).getByText("ticket.ts")).toBeVisible();
  await expect(page.getByRole("group", { name: "Non indexés" }).getByText("ticket.ts")).toBeVisible();
  expect(repo.git("diff", "--cached")).toContain("line2 = 20");
  expect(repo.git("diff", "--cached")).not.toContain("line29 = 290");

  await page.getByRole("radio", { name: "Côte à côte" }).click();
  await page.getByRole("radio", { name: "Unifié" }).click();

  const message = page.getByLabel("Message");
  await expect(message).toHaveValue(`feat: schéma Loro des tickets (${key}-1)`);
  await page.getByRole("button", { name: `Commit sur ${repo.branch}` }).click();
  await expect(page.getByText("↑1").first()).toBeVisible();
  expect(repo.git("log", "-1", "--format=%s").trim()).toBe(`feat: schéma Loro des tickets (${key}-1)`);

  await page.getByRole("checkbox", { name: /Indexer src\/ticket\.ts/ }).click();
  const latest = page.getByRole("listitem").filter({ hasText: `(${key}-1)` });
  await latest.getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" })).toBeChecked();
  await message.fill(`feat: schéma Loro complet (${key}-1)`);
  await page.getByRole("button", { name: `Modifier le commit sur ${repo.branch}` }).click();
  await expect(page.getByText("Aucun changement dans ce worktree.")).toBeVisible();
  expect(repo.git("log", "--format=%s", "main..HEAD").trim()).toBe(`feat: schéma Loro complet (${key}-1)`);
  expect(repo.git("show", "HEAD", "--", "src/ticket.ts")).toContain("line29 = 290");

  await page.getByRole("button", { name: "Pousser et créer la PR" }).click();
  const dialog = page.getByRole("dialog", { name: "Pousser et créer la PR" });
  await expect(dialog.getByText(`${repo.branch} → main · 1 commit non poussé · 1 fichier`)).toBeVisible();
  await expect(dialog.getByLabel("Titre")).toHaveValue(`feat: schéma Loro des tickets (${key}-1)`);
  await dialog.getByRole("button", { name: "Créer la PR" }).click();
  await expect(page.getByText(/PR #\d+ créée/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Voir la PR #\d+/ })).toBeVisible();
  const calls = readFileSync(join(FAKE_GH_DIR, "log.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { args: string[]; stdin: string });
  const create = calls.find((c) => c.args[1] === "create" && c.args.includes(`--head=${repo.branch}`));
  expect(create?.args).toContain("--draft");
  expect(create?.stdin).toContain(`## Ticket\n${key}-1 · Schéma Loro des tickets (LoroTree)`);
  expect(repo.git("ls-remote", "origin", repo.branch).trim()).not.toBe("");

  await page.keyboard.press("ControlOrMeta+k");
  await palette.getByRole("combobox").fill(`${key}-1`);
  await page.keyboard.press("ControlOrMeta+Enter");
  const sheet = page.getByRole("dialog").filter({ hasText: "Schéma Loro des tickets" });
  await expect(sheet.getByRole("link", { name: /#\d+/ })).toBeVisible();
});
```

- [ ] **Step 3: Parcours des onglets, de la palette et de l'aperçu**

`e2e/tabs.spec.ts` :
```ts
import { expect, type TestInfo, test } from "@playwright/test";
import { createE2eRepo } from "./git-repo";
import { E2E_TOKEN } from "./token";

const projectKey = (base: string, info: TestInfo) => `${base}${info.project.name === "light" ? "L" : "D"}`;

test("onglets épinglés persistés, raccourcis, palette et aperçu de fichier", async ({ page }, info) => {
  const key = projectKey("TAB", info);
  const repo = createE2eRepo(key);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await page.getByLabel("Nom").fill(`Onglets ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByLabel("Dossier du projet").fill(repo.repo);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom").fill("Kanban");
  await page.getByRole("radio", { name: "Vue", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();

  const bar = page.getByRole("tablist", { name: "Onglets" });
  const kanban = bar.getByRole("tab", { name: `Onglets ${key} · Kanban` });
  await expect(kanban).toHaveAttribute("aria-selected", "true");
  await kanban.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toHaveText("");

  repo.write("README.md", "# test\nligne ajoutée\n");
  await page.getByRole("button", { name: /^Changements/ }).click({ modifiers: ["ControlOrMeta"] });
  const changesTab = bar.getByRole("tab", { name: `Onglets ${key} · Changements` });
  await expect(changesTab).toBeVisible();
  await changesTab.click();
  await page.getByRole("button", { name: "README.md" }).first().click();
  await page.getByRole("button", { name: "README.md", exact: true }).last().click();
  const preview = page.getByRole("dialog").filter({ hasText: "README.md" });
  await expect(preview.getByText(/Ligne \d+, col \d+/)).toBeVisible();
  await preview.getByRole("button", { name: "Ouvrir dans un onglet" }).click();
  await expect(bar.getByRole("tab", { name: "README.md" })).toHaveAttribute("aria-selected", "true");

  await page.reload();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await expect(bar.getByRole("tab", { name: "README.md" })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+1");
  await expect(bar.getByRole("tab", { name: "Accueil" })).toHaveAttribute("aria-selected", "true");
  await bar.getByRole("tab", { name: "README.md" }).click();
  await page.keyboard.press("ControlOrMeta+w");
  await expect(bar.getByRole("tab", { name: "README.md" })).toHaveCount(0);
  await changesTab.click({ button: "middle" });
  await expect(changesTab).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await expect(palette.getByText("Récents")).toBeVisible();
  await palette.getByRole("combobox").fill("kanban");
  await expect(palette.getByRole("option", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await page.keyboard.press("Escape");
});
```
Si un raccourci est intercepté par Chromium en headless (`⌘W`, `⌘T`), le déclencher par `page.dispatchEvent("body", "keydown", …)` n'est pas équivalent : conserver `page.keyboard.press` (CDP envoie l'événement à la page) et, en cas d'échec avéré en CI, le noter dans le rapport du jalon plutôt que de retirer l'étape.

- [ ] **Step 4: Lancer l'E2E**

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: les trois fichiers passent dans les projets `dark` et `light`.

- [ ] **Step 5: Commit**

```bash
git add e2e/git-repo.ts e2e/code.spec.ts e2e/tabs.spec.ts e2e/serve.ts
git commit -m "test(e2e): parcours code, PR et onglets"
```

---

### Task 23: Raccords avec la phase 2 (agents)

La phase 2 (`docs/superpowers/plans/2026-09-26-kibo-agents.md`) est exécutée avant cette phase. Cette tâche branche sur ses API les emplacements prévus par les tâches 10, 16 et 21, sans en changer les contrats. Lire d'abord le plan de phase 2 et le code livré pour trouver : la liste des runs et leur état (`queued`, `running`, `waiting_input`…), l'espace de travail d'un run (chemin du worktree), la réponse à un run, l'assignation d'un ticket à un agent, le moteur de règles et ses déclencheurs, la timeline des hooks.

**Files:**
- Create: `packages/ui/src/code/agent-slots.tsx`, `packages/ui/src/code/agent-slots.test.tsx`, `packages/ui/src/palette/agent-items.ts`, `packages/ui/src/palette/agent-items.test.ts`
- Modify: `packages/ui/src/shell/ContentView.tsx`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/palette/palette-items.ts`, `packages/ui/src/palette/CommandPalette.tsx`, `packages/daemon/src/code/code-service.ts`, `packages/daemon/src/code/code-service.test.ts`, et le composant de timeline des hooks livré par la phase 2

**Interfaces:**
- Consumes: `ChangesSlots` (tâche 16), `PaletteContext`, `PaletteItem` (tâche 10), `LinkifiedText` (tâche 12), `createCodeService` (tâche 21) ; API de runs, d'assignation et de règles de la phase 2 (noms exacts à relever dans son plan).
- Produces :
  - `useChangesSlots(project: ProjectSnapshot, worktree: string | null, ticketKey: string | null): ChangesSlots` : bandeau `fr.commit.agentWorking(agent)` (ambré, icône `TriangleAlert`, maquette 21) si un run `running` ou `waiting_input` a ce worktree pour espace de travail ; case « Lancer <profil de review> sur la PR » (`fr.pr.review`) si un profil de review existe, qui met un run en file (par la file, jamais en direct) après la création de la PR ; note `fr.pr.rule(key)` si une règle « PR ouverte → En review » est active ;
  - `agentItems(runs, tickets): PaletteItem[]` au groupe `"agents"` (`fr.palette.agents`) : « Répondre à <agent> (<clé>) » pour chaque run `waiting_input` (icône cloche orange, maquette 18), « Assigner <clé> à un agent… » pour le ticket actif ; `PaletteGroup` et `PaletteFilter` gagnent `"agents"` ; l'ordre des groupes devient `recents, tickets, actions, agents, pages, projects` (maquette 18 : Tickets, Actions, Agents) ;
  - déclencheurs du moteur de règles `pr_opened` (après `createPr` lié à un ticket) et `pr_merged` (quand le suivi passe une référence à `merged`), avec les règles par défaut de la spec §7 : PR ouverte → *En review*, PR mergée → *Terminé* ;
  - chemins cliquables dans la timeline des hooks : `LinkifiedText` avec `origin` = `"<KEY> · <hook> <outil>"` (maquette 23 : « Ouvert depuis KIB-12 · PostToolUse Edit »).

- [ ] **Step 1: Tests (après lecture du plan de phase 2)**

`packages/ui/src/code/agent-slots.test.tsx` : avec un faux client (même motif que `changes.test.tsx`) renvoyant un run `running` du profil `opus-dev-1` dont l'espace de travail est `/wt/kib-12`, vérifier que `ChangesView` rendu par `ContentView` pour ce worktree affiche « opus-dev-1 travaille dans ce worktree. Tes modifications peuvent entrer en conflit avec les siennes. », et qu'il ne l'affiche pas pour `/repo` ni quand le run est `done`. Vérifier que la case « Lancer sonnet-review sur la PR » n'apparaît que si un profil de review existe, et que cocher puis créer la PR appelle l'API de mise en file de la phase 2 avec le numéro de PR.

`packages/ui/src/palette/agent-items.test.ts` : deux runs (`waiting_input` sur KIB-14, `running` sur KIB-12) ⇒ un seul élément « Répondre à opus-dev-2 (KIB-14) » ; ticket actif KIB-12 ⇒ « Assigner KIB-12 à un agent… » ; `searchItems(…, "repondre", "all")` renvoie le groupe `agents`, et le filtre `Tab` passe par « Agents ».

Dans `packages/daemon/src/code/code-service.test.ts`, ajouter : après `createPr` lié à un ticket, le moteur de règles de la phase 2 reçoit `pr_opened` et le ticket passe *En review* ; après passage de l'état du faux `gh` à `MERGED`, le ticket passe *Terminé*.

Run: `bun test packages/ui/src/code/agent-slots.test.tsx packages/ui/src/palette packages/daemon/src/code/code-service.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implémenter**

- `agent-slots.tsx` : hook `useChangesSlots` qui lit les runs par l'API de la phase 2 (abonnement WebSocket compris) et construit `ChangesSlots` ; `ContentView` le passe à `ChangesView` (`slots={useChangesSlots(...)}` via un petit composant `ChangesTab` pour respecter les règles des hooks).
- `agent-items.ts` + ajout du groupe `agents` dans `palette-items.ts` et `CommandPalette.tsx` (icônes `Bell` en `text-orange-600 dark:text-orange-400` pour « Répondre », `Bot` pour « Assigner ») ; « Répondre » ouvre la réponse de la barre d'agents de la phase 2 ; « Assigner » ouvre son dialogue d'assignation (écran 27).
- `code-service.ts` : après `upsertExternalRef` d'une PR ouverte, puis dans `pollPrs` quand l'état devient `merged`, émettre les déclencheurs via l'API du moteur de règles (ajouter les deux types de déclencheurs et leurs règles par défaut dans le module de règles de la phase 2 s'ils n'existent pas, avec leurs tests).
- Timeline : remplacer l'affichage brut des chemins par `LinkifiedText`.

Tout run lancé ici passe par la file d'attente (CLAUDE.md) ; aucun appel direct au binaire `claude`.

- [ ] **Step 3: Vérifier et commiter**

Run: `bun test && bun run check && bun run typecheck`
Expected: PASS.

```bash
git add packages/ui/src/code/agent-slots.tsx packages/ui/src/code/agent-slots.test.tsx packages/ui/src/palette packages/ui/src/shell/ContentView.tsx packages/ui/src/shell/Shell.tsx packages/daemon/src/code/code-service.ts packages/daemon/src/code/code-service.test.ts
git commit -m "feat: raccords agents du code et de la palette"
```
(Ajouter explicitement au `git add` les fichiers de la phase 2 modifiés : module de règles, timeline.)

---

### Task 24: Conformité visuelle des écrans 18, 20 à 23

**Files:**
- Create: `e2e/screens.spec.ts`
- Modify: les composants des tâches 9 à 16 et 20 selon les écarts constatés

**Interfaces:**
- Consumes: l'application complète.
- Produces : captures `e2e/test-results/screens/{18,20,21,22,23}-{dark,light}.png` (non versionnées) et corrections.

- [ ] **Step 1: Captures reproductibles**

`e2e/screens.spec.ts` : un test par écran, qui prépare l'état de la maquette avec `createE2eRepo` (fichiers `packages/core/ticket.ts`, `tree.ts`, `index.ts`, `legacy-tree.ts` comme sur la page 34 ; deux commits non poussés, un poussé), fixe la fenêtre à 1440 × 940 (`page.setViewportSize`) et enregistre `page.screenshot({ path: info.outputPath("<n>-<thème>.png") })` : 18 palette ouverte sur « kib-1 » ; 20 menu contextuel d'un onglet ouvert, un onglet épinglé ; 21 Changements avec un fichier indexé sélectionné ; 22 dialogue PR avec fichiers indexés non commités ; 23 aperçu de `ticket.ts` ligne 43 ouvert depuis un ticket.

Run: `bun run --cwd e2e test screens.spec.ts`

- [ ] **Step 2: Comparer aux maquettes et corriger**

Comparer chaque capture à `design/pdf/kibo-design-sombre.pdf` et `kibo-design-clair.pdf` (pages 28, 33, 34, 35, 36). Points à vérifier au minimum :
- **20** : Accueil (logo) à gauche ; onglets épinglés compacts avec pastille de la couleur du projet ; trait séparateur ; onglet actif sur fond `background` ; croix visible ; `+` ; menu : Épingler l'onglet `⌘⇧P`, Dupliquer, Ouvrir dans une nouvelle fenêtre, séparateur, Fermer `⌘W`, Fermer les autres onglets, Fermer les onglets à droite ;
- **21** : colonnes 360 / flexible / 450 px ; lettres `M` ambre, `A` verte, `D` rouge ; `+42 −8` en vert / rouge ; en-têtes `@@` sur fond `muted` avec « Indexer le bloc » à droite ; lignes ajoutées et supprimées teintées sans saturer en clair ; bouton « Édition » orange quand actif ; `↑2` orange ; commits non poussés avec pastille orange, poussé grisé ; « Pousser » secondaire et « Pousser et créer la PR » principal (neutre, jamais orange) ;
- **22** : largeur ~860 px ; description monospace ; avertissement ambré avec « Commiter d'abord » ; cases à cocher alignées ; aperçu de commande en pied ;
- **23** : Sheet de moitié de largeur ; en-tête chemin grisé + nom ; puce d'origine bleue ; ligne visée surlignée en bleu ; pied « Ligne n, col m » et aide ;
- **18** : palette à ~18 % du haut, largeur ~760 px ; groupes en capitales ; pastilles de statut ; statut aligné à droite ; « + n autres » ; pied d'aide avec touches encadrées ;
- dans les deux thèmes : contrastes du texte secondaire (zinc-500 minimum en clair), aucun texte orange sur blanc hors orange-600/700.

Corriger chaque écart dans le composant concerné, relancer les tests unitaires et l'E2E. Un écart qui dépend d'un écran encore à dessiner (`design/revue-flows.md` §7 : conflit, push en échec, PR existante) est noté dans le rapport du jalon, pas inventé.

- [ ] **Step 3: Commit**

```bash
git add e2e/screens.spec.ts <fichiers corrigés, un par un>
git commit -m "fix(ui): conformité visuelle du code"
```

---

## Vagues d'exécution

Chaque vague démarre quand la précédente est intégrée dans `main`. Les tâches d'une même vague touchent des fichiers disjoints et peuvent être confiées en parallèle (worktrees `.claude/worktrees/p3-<n>`, branches `feat/p3-<n>`).

| Vague | Tâches parallèles | Fichiers touchés |
|---|---|---|
| 0 | T1 Contrats | `packages/schema/src/**`, `packages/core/src/{tickets,commands}.ts` + test, `packages/sdk/src/{types,sdk,mock,client}.ts` + tests, `packages/ui/src/{i18n/fr.ts,lib/error-message.ts,state/use-snapshots.ts,shell/Host.tsx,shell/Shell.tsx,pages/PageView.tsx}`, deux tests de composants |
| 0 | T2 Dépendances | `packages/sdk/src/ui/{context-menu,command,toggle,toggle-group,checkbox,alert-dialog}.tsx`, `packages/sdk/src/primitives.test.tsx`, `packages/{sdk,ui}/package.json`, `bun.lock` |
| 1 | T3 Exécuteur · T4 Parseurs · T5 Messages · T6 Onglets (démon) · T7 Watcher · T8 Éditeur | `daemon/src/code/{run,safe-path}.ts`, `daemon/src/code/testing/*` · `daemon/src/code/{parse-status,parse-diff,parse-log,patch}.ts` · `core/src/commit-message.ts`, `core/src/index.ts` · `daemon/src/{store,service}.ts` · `daemon/src/code/watcher.ts` · `daemon/src/code/editor.ts` |
| 1 | T9 Onglets (UI) · T10 Palette · T11 Diff · T12 Aperçu · T13 Commit · T14 PR | `ui/src/tabs/*` · `ui/src/palette/*`, `ui/src/theme.ts` · `ui/src/code/{diff-rows,DiffView,DiffToolbar,FileList}.*` · `sdk/src/file-link.tsx`, `sdk/src/index.ts`, `ui/src/files/*`, `ui/src/code/use-worktrees.ts`, `ui/src/lib/relative-time.ts`, `ui/src/index.css` · `ui/src/code/{CommitPanel,UnpushedCommits,RewordDialog,UndoCommitDialog}.tsx` · `ui/src/code/{pr-command.ts,PushPrDialog.tsx}` |
| 2 | T15 Lecture git · T16 Vue Changements | `daemon/src/code/{repo,read}.ts` · `ui/src/code/{use-code.ts,WorktreePicker.tsx,DiffEditorPane.tsx,ChangesView.tsx}` |
| 3 | T17 Index · T18 Historique · T19 Remote · T20 Shell | `daemon/src/code/index-ops.ts` · `daemon/src/code/history-ops.ts` · `daemon/src/code/remote-ops.ts` · `ui/src/{route.ts,tabs/use-hash-sync.ts,code/use-project-git.ts,shell/*,pages/TicketTab.tsx}` |
| 4 | T21 Service code | `daemon/src/code/code-service.ts`, `daemon/src/{server,main}.ts` + tests |
| 5 | T22 E2E · T23 Raccords phase 2 | `e2e/{git-repo,code.spec,tabs.spec,serve}.ts` · `ui/src/code/agent-slots.tsx`, `ui/src/palette/*`, `ui/src/shell/{ContentView,Shell}.tsx`, `daemon/src/code/code-service.ts`, fichiers de la phase 2 |
| 6 | T24 Conformité | `e2e/screens.spec.ts`, composants corrigés |

Chemin critique : T1 → T3/T4 → T15 → T17/T18/T19 → T21 → T22 → T24 (sept vagues). Les tâches UI de la vague 1 ne dépendent que de T1 et T2 : elles se testent avec un faux client.

## Jalon v0.3

- [ ] `main` verte en CI sur macOS et Linux : `bun test`, `bun run check`, `bun run typecheck`, build UI, E2E `mvp`, `code`, `tabs` en sombre et en clair, smoke Tauri.
- [ ] Sortie de la feuille de route : le parcours `e2e/code.spec.ts` (modifier → commit → amend → PR sur un dépôt de test et un faux `gh`) passe.
- [ ] Contrôle de conformité : captures de `e2e/screens.spec.ts` comparées aux pages 28, 33 à 36 des deux PDF ; écarts corrigés (T24) ou listés.
- [ ] Tag `v0.3` sur `main`, poussé.
- [ ] Rapport `docs/superpowers/rapports/2026-09-26-jalon-v0.3.md` : livré, écarts (dont les états de `revue-flows.md` §7 non dessinés, « Générer avec Claude » reporté, barre de titre Tauri native, pastille Changements limitée au worktree principal du projet actif), risques (voir ci-dessous).
- [ ] Mettre à jour la feuille de route (« Plan » de la phase 3) et enchaîner la phase 4 sans attendre (décision d'Adam, CLAUDE.md).

**Risques à suivre dans le rapport :**
- `fs.watch` récursif sous Linux (inotify, limites de descripteurs) : repli par sondage testé, à surveiller sur de gros dépôts.
- Délais `git`/`gh` : un `push` qui attend une passphrase SSH échoue au bout de 2 minutes (aucun terminal).
- Raccourcis `⌘T` / `⌘W` interceptés par les navigateurs : pleinement disponibles dans Tauri seulement.
- Deux fenêtres ouvertes sur le même workspace : l'état des onglets suit la dernière écriture.
- Dépendance à l'API de la phase 2 pour T23 : si elle diffère du plan de phase 2, T23 s'adapte sans changer les contrats de T10, T16 et T21.

