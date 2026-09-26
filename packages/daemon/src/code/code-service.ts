import { commitDefaults } from "@kibo/core";
import type { CodeEvent, CodeRequest, CommitDefaults } from "@kibo/schema";
import { call, type Service } from "../service";
import { editorCommand, openInEditor } from "./editor";
import { abortOperation, commit, reword, undoCommit } from "./history-ops";
import { stageFiles, stageHunk, unstageFiles, writeFile } from "./index-ops";
import { type PrPoller, startPrPoller, triggerRules } from "./pr-poller";
import { compare, readDiff, readFile, readStatus, remoteBranches } from "./read";
import { createPr, ghStatus, prForBranch, push } from "./remote-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import type { Env } from "./run";
import { resolveInWorktree } from "./safe-path";
import { createWorktreeWatch } from "./worktree-watch";

export type CodeService = {
  handle(req: CodeRequest): Promise<unknown>;
  onChange(listener: (e: CodeEvent) => void): () => void;
  stop(): void;
};
export type CodeServiceOptions = {
  env?: Env;
  prPollMs?: number;
  idleMs?: number;
  platform?: NodeJS.Platform;
};
type WorktreeRequest = Exclude<CodeRequest, { method: "worktrees" }>;
const MUTATION_METHODS = [
  "writeFile",
  "stageFiles",
  "unstageFiles",
  "stageHunk",
  "commit",
  "reword",
  "undoCommit",
  "abortOperation",
  "push",
  "createPr",
] as const;
type Mutation = Extract<WorktreeRequest, { method: (typeof MUTATION_METHODS)[number] }>;
type Read = Exclude<WorktreeRequest, Mutation>;

const PR_POLL_MS = 60_000;
const IDLE_MS = 600_000;
const MUTATIONS = new Set<string>(MUTATION_METHODS);
const isMutation = (req: WorktreeRequest): req is Mutation => MUTATIONS.has(req.method);
const log = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what}`, e);

export function createCodeService(service: Service, opts: CodeServiceOptions = {}): CodeService {
  const env = opts.env ?? {};
  const listeners = new Set<(e: CodeEvent) => void>();
  const locks = new Map<string, Promise<unknown>>();
  const emit = (projectId: string, worktree: string, paths?: string[]) => {
    const event: CodeEvent = { type: "code", projectId, worktree, ...(paths ? { paths } : {}) };
    for (const l of listeners) l(event);
  };
  const watch = createWorktreeWatch({ idleMs: opts.idleMs ?? IDLE_MS, onChange: emit, log });
  const pollMs = opts.prPollMs ?? PR_POLL_MS;
  const poller: PrPoller | null = pollMs > 0 ? startPrPoller(service, env, pollMs, log) : null;
  const project = (projectId: string) => call(service, { method: "getProject", projectId });
  const repoOf = (projectId: string) => openRepo(project(projectId).meta.folder, env);

  const serialized = <T>(path: string, work: () => Promise<T>): Promise<T> => {
    const previous = locks.get(path) ?? Promise.resolve();
    const next = previous.then(work, work);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    locks.set(path, settled);
    void settled.then(() => {
      if (locks.get(path) === settled) locks.delete(path);
    });
    return next;
  };

  const defaults = async (projectId: string, h: WorktreeHandle): Promise<CommitDefaults> => {
    const status = await readStatus(h);
    const { defaultBase } = await remoteBranches(h);
    const commits =
      status.hasHead && defaultBase
        ? (await compare(h, defaultBase)).commits
        : status.commits.filter((c) => !c.pushed);
    return commitDefaults(
      project(projectId),
      status.branch,
      commits.map((c) => c.subject),
    );
  };

  const read = async (h: WorktreeHandle, req: Read): Promise<unknown> => {
    switch (req.method) {
      case "status":
        await watch.touch(req.projectId, h);
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
      case "commitDefaults":
        return defaults(req.projectId, h);
      case "openInEditor": {
        const file = resolveInWorktree(h.path, req.path);
        const editorEnv = { ...process.env, ...env };
        openInEditor(editorCommand(file, req.line, editorEnv, opts.platform ?? process.platform), env);
        return null;
      }
    }
  };

  const linkPr = async (h: WorktreeHandle, req: Extract<Mutation, { method: "createPr" }>) => {
    const pr = await createPr(h, req);
    if (req.ticketId) {
      call(service, {
        method: "command",
        projectId: req.projectId,
        command: { method: "upsertExternalRef", ticketId: req.ticketId, ref: { kind: "github_pr", ...pr } },
      });
      if (pr.state === "open")
        triggerRules(service, req.projectId, { kind: "pr_opened", ticketId: req.ticketId });
    }
    return pr;
  };

  const mutate = async (h: WorktreeHandle, req: Mutation): Promise<unknown> => {
    switch (req.method) {
      case "writeFile":
        return writeFile(h, req.path, req.content, req.baseHash);
      case "stageFiles":
        return stageFiles(h, req.paths).then(() => null);
      case "unstageFiles":
        return unstageFiles(h, req.paths).then(() => null);
      case "stageHunk":
        return stageHunk(h, req).then(() => null);
      case "commit":
        return commit(h, req.message, req.amend);
      case "reword":
        return reword(h, req.sha, req.message).then(() => null);
      case "undoCommit":
        return undoCommit(h, req.sha).then(() => null);
      case "abortOperation":
        return abortOperation(h).then(() => null);
      case "push":
        return push(h).then(() => null);
      case "createPr":
        return linkPr(h, req);
    }
  };

  const mutateAndNotify = (h: WorktreeHandle, req: Mutation) =>
    serialized(h.path, async () => {
      try {
        return await mutate(h, req);
      } finally {
        await watch.settle(req.projectId, h).catch(log(`git refresh failed for ${h.path}`));
        emit(req.projectId, h.path);
      }
    });

  return {
    async handle(req) {
      if (req.method === "worktrees") return (await repoOf(req.projectId)).worktrees();
      const h = await (await repoOf(req.projectId)).open(req.worktree);
      return isMutation(req) ? mutateAndNotify(h, req) : read(h, req);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      poller?.stop();
      watch.stop();
      listeners.clear();
    },
  };
}
