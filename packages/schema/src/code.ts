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

export const CompareResult = z.object({
  commits: z.array(CommitInfo),
  fileCount: z.number().int().nonnegative(),
});
export type CompareResult = z.infer<typeof CompareResult>;

export const PrInfo = z.object({
  number: z.number().int().positive(),
  url: z.string().url(),
  state: PrState,
});
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

export const MAX_EVENT_PATHS = 200;
export const CodeEvent = z.object({
  type: z.literal("code"),
  projectId: z.string(),
  worktree: z.string(),
  paths: z.array(z.string()).max(MAX_EVENT_PATHS).optional(),
});
export type CodeEvent = z.infer<typeof CodeEvent>;

export const eventTouches = (event: CodeEvent, path: string): boolean =>
  !event.paths || event.paths.some((p) => path === p || path.startsWith(`${p}/`));

const P = { projectId: z.string().min(1) };
const W = { ...P, worktree: z.string().min(1) };
const Message = z.string().trim().min(1).max(100_000);
const BranchName = z.string().min(1).max(255);

export const CodeRequest = z.discriminatedUnion("method", [
  z.object({ method: z.literal("worktrees"), ...P }),
  z.object({ method: z.literal("status"), ...W }),
  z.object({
    method: z.literal("diff"),
    ...W,
    path: RelPath,
    origPath: RelPath.nullable(),
    area: ChangeArea,
  }),
  z.object({ method: z.literal("readFile"), ...W, path: RelPath, revision: FileRevision }),
  z.object({
    method: z.literal("writeFile"),
    ...W,
    path: RelPath,
    content: z.string().max(1_000_000),
    baseHash: Hash,
  }),
  z.object({ method: z.literal("stageFiles"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({ method: z.literal("unstageFiles"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({ method: z.literal("discardChanges"), ...W, paths: z.array(RelPath).min(1).max(1000) }),
  z.object({ method: z.literal("stageAll"), ...W }),
  z.object({ method: z.literal("unstageAll"), ...W }),
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
  z.object({
    method: z.literal("openInEditor"),
    ...W,
    path: RelPath,
    line: z.number().int().positive().nullable(),
  }),
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
  discardChanges: null;
  stageAll: null;
  unstageAll: null;
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
