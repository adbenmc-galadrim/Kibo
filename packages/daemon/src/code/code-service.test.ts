import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CodeEvent,
  type CodeRequest,
  LOCAL_ONLY_CODE_METHODS,
  type ProjectMeta,
  type RepoStatus,
  type Ticket,
} from "@kibo/schema";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type CodeService, type CodeServiceOptions, createCodeService } from "./code-service";
import {
  createGitFixture,
  type GitFixture,
  gitSync,
  installFakeBin,
  installFakeGh,
  readFakeBinLog,
  readFakeGhLog,
} from "./testing/git-fixture";

let fx: GitFixture;
let home: string;
let store: Store;
let service: Service;
let code: CodeService | null;
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
  project = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: fx.repo,
    color: "#F97316",
  });
  events.length = 0;
  code = null;
});
afterEach(() => {
  code?.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  fx.cleanup();
});

const start = (opts: CodeServiceOptions = {}): CodeService => {
  const started = createCodeService(service, { env: { ...fx.env, ...gh }, prPollMs: 0, ...opts });
  started.onChange((e) => events.push(e));
  code = started;
  return started;
};
const w = () => ({ projectId: project.id, worktree: fx.repo });
const event = (): CodeEvent => ({ type: "code", projectId: project.id, worktree: fx.repo });
const createTicket = (title: string) =>
  call(service, {
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title },
  }) as Ticket;
const refs = () =>
  call(service, { method: "getProject", projectId: project.id }).tickets[0]?.externalRefs.filter(
    (r) => r.kind === "github_pr",
  );
const statusOf = () => call(service, { method: "getProject", projectId: project.id }).tickets[0]?.statusId;
const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await Bun.sleep(20);
  return check();
};

test("reads go through the registered worktree only", async () => {
  const c = start();
  expect(await c.handle({ method: "worktrees", projectId: project.id }, LOCAL_CONTEXT)).toMatchObject([
    { path: fx.repo, isMain: true },
  ]);
  await expect(
    c.handle({ method: "status", projectId: project.id, worktree: fx.dir }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  const bare = call(service, {
    method: "createProject",
    name: "Sans",
    key: "SNS",
    folder: null,
    color: "#F97316",
  });
  await expect(c.handle({ method: "worktrees", projectId: bare.id }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "NOT_A_REPO",
  });
});

test("a mutation emits an event at once, an external change emits one through the watcher", async () => {
  const c = start();
  await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT);
  fx.write("README.md", "# kibo\nedit\n");
  expect(await waitFor(() => events.length > 0)).toBe(true);
  expect(events).toContainEqual({ ...event(), paths: ["README.md"] });
  events.length = 0;
  fx.write("README.md", "# kibo\nedit again\n");
  expect(await waitFor(() => events.length > 0)).toBe(true);
  events.length = 0;
  await c.handle({ method: "stageFiles", ...w(), paths: ["README.md"] }, LOCAL_CONTEXT);
  expect(events).toEqual([event()]);
});

test("an idle worktree is no longer watched, stop releases everything", async () => {
  const c = start({ idleMs: 50 });
  await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT);
  await Bun.sleep(300);
  fx.write("README.md", "# kibo\nedit\n");
  await Bun.sleep(500);
  expect(events).toEqual([]);
  await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT);
  c.stop();
  fx.write("README.md", "# kibo\nafter stop\n");
  await Bun.sleep(500);
  expect(events).toEqual([]);
});

test("commit defaults come from the ticket named by the branch and the branch commits", async () => {
  const c = start();
  createTicket("Schéma Loro des tickets");
  fx.commit("feat: premier pas", { "a.txt": "a\n" });
  fx.git("push", "-q", "-u", "origin", "kib-1");
  expect(await c.handle({ method: "commitDefaults", ...w() }, LOCAL_CONTEXT)).toMatchObject({
    ticketKey: "KIB-1",
    message: "feat: schéma Loro des tickets (KIB-1)",
    prTitle: "feat: schéma Loro des tickets (KIB-1)",
    prBody: "## Ticket\nKIB-1 · Schéma Loro des tickets\n\n## Changements\n- feat: premier pas",
  });
});

test("commit writes exactly the message received", async () => {
  const c = start();
  fx.write("a.txt", "a\n");
  await c.handle({ method: "stageFiles", ...w(), paths: ["a.txt"] }, LOCAL_CONTEXT);
  await c.handle({ method: "commit", ...w(), message: "feat: a (KIB-1)", amend: false }, LOCAL_CONTEXT);
  expect(fx.git("log", "-1", "--format=%B").trim()).toBe("feat: a (KIB-1)");
});

test("the editor opens a path resolved in the worktree, never outside", async () => {
  const editor = installFakeBin(fx.dir, "code");
  const c = start({ env: { ...fx.env, VISUAL: editor.path, FAKE_BIN_LOG: editor.log } });
  await expect(
    c.handle({ method: "openInEditor", ...w(), path: ".git/config", line: null }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  expect(
    await c.handle({ method: "openInEditor", ...w(), path: "README.md", line: 3 }, LOCAL_CONTEXT),
  ).toBeNull();
  expect(await waitFor(() => readFakeBinLog(editor.log).length > 0)).toBe(true);
  expect(readFakeBinLog(editor.log)).toEqual([["--goto", `${join(fx.repo, "README.md")}:3`]]);
});

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
    {
      method: "createPr",
      ...w(),
      title: "x",
      body: "",
      base: "main",
      draft: false,
      reviewers: [],
      ticketId: null,
    },
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
  expect(
    await c.handle({ method: "readFile", ...w(), path: "README.md", revision: "worktree" }, REMOTE),
  ).toMatchObject({
    content: "# changed\n",
  });
  expect(await c.handle({ method: "remoteBranches", ...w() }, REMOTE)).toMatchObject({ remote: "origin" });
  expect(await c.handle({ method: "commitDefaults", ...w() }, REMOTE)).toMatchObject({
    message: expect.any(String),
  });
  expect(await c.handle({ method: "ghStatus", ...w() }, REMOTE)).toMatchObject({
    available: expect.any(Boolean),
  });
});

test("a rejected push reports git's own message", async () => {
  const c = start();
  const other = join(fx.dir, "other");
  gitSync(fx.dir, ["clone", "-q", "-b", "main", fx.remote, other], fx.env);
  gitSync(other, ["checkout", "-q", "-b", "kib-1"], fx.env);
  gitSync(other, ["commit", "-q", "--allow-empty", "-m", "ailleurs"], fx.env);
  gitSync(other, ["push", "-q", "origin", "kib-1"], fx.env);
  fx.commit("feat: ici", { "a.txt": "a\n" });
  await expect(c.handle({ method: "push", ...w() }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: expect.stringContaining("failed to push"),
  });
});

test("createPr links the PR to the ticket, the poller follows its state", async () => {
  const c = start({ prPollMs: 50 });
  const ticket = createTicket("Schéma");
  fx.commit("feat: schéma (KIB-1)", { "a.txt": "a\n" });
  const pr = await c.handle(
    {
      method: "createPr",
      ...w(),
      title: "feat: schéma (KIB-1)",
      body: "## Ticket",
      base: "main",
      draft: false,
      reviewers: [],
      ticketId: ticket.id,
    },
    LOCAL_CONTEXT,
  );
  expect(pr).toEqual({
    number: 1,
    url: "https://github.com/kibo/test/pull/1",
    state: "open",
    base: null,
    head: null,
  });
  expect(refs()).toEqual([
    {
      kind: "github_pr",
      url: "https://github.com/kibo/test/pull/1",
      number: 1,
      state: "open",
      base: null,
      head: null,
    },
  ]);
  expect(events).toContainEqual(event());
  expect(statusOf()).toBe("in_review");
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as { state: string }[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, state: "MERGED" }))));
  expect(await waitFor(() => refs()?.[0]?.state === "merged")).toBe(true);
  expect(statusOf()).toBe("done");
});

test("a PR without a ticket, or closed without merging, moves no ticket", async () => {
  const c = start({ prPollMs: 50 });
  const ticket = createTicket("Schéma");
  fx.commit("feat: schéma", { "a.txt": "a\n" });
  await c.handle(
    {
      method: "createPr",
      ...w(),
      title: "feat: schéma",
      body: "",
      base: "main",
      draft: false,
      reviewers: [],
      ticketId: null,
    },
    LOCAL_CONTEXT,
  );
  expect(statusOf()).toBe(ticket.statusId);
  call(service, {
    method: "command",
    projectId: project.id,
    command: {
      method: "upsertExternalRef",
      ticketId: ticket.id,
      ref: {
        kind: "github_pr",
        url: "https://github.com/kibo/test/pull/1",
        number: 1,
        state: "open",
        base: null,
        head: null,
      },
    },
  });
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as { state: string }[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, state: "CLOSED" }))));
  expect(await waitFor(() => refs()?.[0]?.state === "closed")).toBe(true);
  expect(statusOf()).toBe(ticket.statusId);
});

const createLinkedPr = (c: CodeService, ticketId: string, draft: boolean) => {
  fx.commit("feat: schéma (KIB-1)", { "a.txt": "a\n" });
  return c.handle(
    {
      method: "createPr",
      ...w(),
      title: "feat: schéma (KIB-1)",
      body: "",
      base: "main",
      draft,
      reviewers: [],
      ticketId,
    },
    LOCAL_CONTEXT,
  );
};
const setFakePrs = (patch: Record<string, unknown>) => {
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as Record<string, unknown>[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, ...patch }))));
};

test("a draft PR moves the ticket only once it is marked ready", async () => {
  const c = start({ prPollMs: 50 });
  const ticket = createTicket("Schéma");
  await createLinkedPr(c, ticket.id, true);
  expect(refs()?.[0]?.state).toBe("draft");
  expect(statusOf()).toBe(ticket.statusId);
  setFakePrs({ isDraft: false });
  expect(await waitFor(() => refs()?.[0]?.state === "open")).toBe(true);
  expect(statusOf()).toBe("in_review");
});

test("a failing rule is logged, the PR is still created and followed", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  const rules = spyOn(service, "triggerRules").mockImplementation(() => {
    throw new Error("rules broken");
  });
  try {
    const c = start({ prPollMs: 50 });
    const ticket = createTicket("Schéma");
    expect(await createLinkedPr(c, ticket.id, false)).toMatchObject({ number: 1, state: "open" });
    expect(refs()?.[0]?.state).toBe("open");
    setFakePrs({ state: "MERGED" });
    expect(await waitFor(() => refs()?.[0]?.state === "merged")).toBe(true);
    const logged = errors.mock.calls.map(([m]) => String(m));
    expect(logged.filter((m) => m.startsWith("[kibo-daemon] rules")).length).toBe(2);
    expect(rules.mock.calls.map(([, t]) => t.kind)).toEqual(["pr_opened", "pr_merged"]);
  } finally {
    rules.mockRestore();
    errors.mockRestore();
  }
});

test("a failing PR lookup is logged and does not stop the others", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const ticket = createTicket("Schéma");
    const upsert = (url: string, number: number) =>
      call(service, {
        method: "command",
        projectId: project.id,
        command: {
          method: "upsertExternalRef",
          ticketId: ticket.id,
          ref: { kind: "github_pr", url, number, state: "open", base: null, head: null },
        },
      });
    upsert("https://example.test/not-a-pr", 7);
    writeFileSync(
      gh.FAKE_GH_STATE ?? "",
      JSON.stringify([
        { number: 1, url: "https://github.com/kibo/test/pull/1", state: "CLOSED", isDraft: false, head: "x" },
      ]),
    );
    upsert("https://github.com/kibo/test/pull/1", 1);
    start({ prPollMs: 50 });
    expect(await waitFor(() => refs()?.some((r) => r.state === "closed") ?? false)).toBe(true);
    expect(
      errors.mock.calls.some(([message]) => String(message).includes("https://example.test/not-a-pr")),
    ).toBe(true);
  } finally {
    errors.mockRestore();
  }
});
