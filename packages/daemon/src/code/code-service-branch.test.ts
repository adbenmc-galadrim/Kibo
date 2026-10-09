import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BranchChanges,
  FileDiff,
  type ProjectMeta,
  type RpcRequest,
  type Ticket,
  type WorktreeSettings,
} from "@kibo/schema";
import type { RpcContext } from "../rpc-extensions";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type CodeService, createCodeService } from "./code-service";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

let fx: GitFixture;
let home: string;
let store: Store;
let service: Service;
let project: ProjectMeta;
let code: CodeService | null;

beforeEach(() => {
  fx = createGitFixture();
  fx.commit("chore: init", { "README.md": "# emis\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.git("checkout", "-q", "-b", "dev");
  fx.commit("feat: dev", { "dev.txt": "dev\n" });
  fx.git("push", "-q", "-u", "origin", "dev");
  fx.git("checkout", "-q", "-b", "feat/parent");
  fx.commit("feat: parent", { "parent.txt": "parent\n" });
  fx.git("checkout", "-q", "-b", "feat/stockage");
  fx.commit("feat: stockage", { "stockage.txt": "s\n" });
  home = mkdtempSync(join(tmpdir(), "kibo-code-branch-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  project = call(service, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: fx.repo,
    color: "#F97316",
  });
  code = null;
});
afterEach(() => {
  code?.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  fx.cleanup();
});

const withWorktree = (inner: Service, worktree: WorktreeSettings): Service => ({
  ...inner,
  handle(req: RpcRequest) {
    if (req.method !== "getProject") return inner.handle(req);
    const snapshot = call(inner, req);
    return { ...snapshot, meta: { ...snapshot.meta, worktree } };
  },
});
const start = (s: Service = service) => {
  code = createCodeService(s, { env: fx.env, prPollMs: 0 });
  return code;
};
const w = () => ({ projectId: project.id, worktree: fx.repo });
const changes = async (c: CodeService, ctx?: RpcContext) =>
  BranchChanges.parse(await c.handle({ method: "branchChanges", ...w() }, ctx ?? REMOTE));
const linkBranch = (base: string | null) => {
  const ticket = call(service, {
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Stockage" },
  }) as Ticket;
  call(service, {
    method: "command",
    projectId: project.id,
    command: {
      method: "upsertExternalRef",
      ticketId: ticket.id,
      ref: { kind: "git_branch", branch: "feat/stockage", base },
    },
  });
};
const DEV: WorktreeSettings = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: null };

test("without ticket nor settings, the branch is compared with the default branch of the remote", async () => {
  const result = await changes(start());
  expect(result.base).toBe("origin/main");
  expect(result.files.map((f) => f.path)).toEqual(["dev.txt", "parent.txt", "stockage.txt"]);
});

test("the worktree settings of the project give the base", async () => {
  const result = await changes(start(withWorktree(service, DEV)));
  expect(result.base).toBe("origin/dev");
  expect(result.commits.map((c) => [c.subject, c.pushed])).toEqual([
    ["feat: stockage", false],
    ["feat: parent", false],
  ]);
});

test("the base of the ticket's branch wins over the settings, and its diff is readable remotely", async () => {
  linkBranch("feat/parent");
  const c = start(withWorktree(service, DEV));
  const result = await changes(c);
  expect(result.base).toBe("feat/parent");
  expect(result.files.map((f) => f.path)).toEqual(["stockage.txt"]);
  const diff = FileDiff.parse(
    await c.handle({ method: "branchDiff", ...w(), path: "stockage.txt", origPath: null }, REMOTE),
  );
  expect([diff.additions, diff.hunkStaging]).toEqual([1, false]);
});

test("a ticket's branch without base falls back to the settings", async () => {
  linkBranch(null);
  expect((await changes(start(withWorktree(service, DEV)))).base).toBe("origin/dev");
});
