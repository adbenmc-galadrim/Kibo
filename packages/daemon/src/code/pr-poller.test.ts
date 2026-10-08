import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GithubPrRef, ProjectMeta, RpcRequest, StatusId, Ticket, WorktreeSettings } from "@kibo/schema";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { type PrPoller, startPrPoller } from "./pr-poller";
import { installFakeGh, readFakeGhLog } from "./testing/git-fixture";

type FakePr = {
  number: number;
  state: "OPEN" | "MERGED" | "CLOSED";
  head: string;
  base?: string;
  isDraft?: boolean;
};

const DEV: WorktreeSettings = { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: null };

let dir: string;
let store: Store;
let service: Service;
let project: ProjectMeta;
let gh: Record<string, string>;
let poller: PrPoller | null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kibo-poller-"));
  gh = installFakeGh(dir);
  store = openStore(join(dir, "home"));
  service = createService(store, { user: "adam" });
  project = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: dir,
    color: "#F97316",
  });
  poller = null;
});
afterEach(() => {
  poller?.stop();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const withWorktree = (inner: Service, worktree: WorktreeSettings): Service => ({
  ...inner,
  handle(req: RpcRequest) {
    if (req.method !== "getProject") return inner.handle(req);
    const snapshot = call(inner, req);
    return { ...snapshot, meta: { ...snapshot.meta, worktree } };
  },
});

const urlOf = (n: number) => `https://github.com/kibo/test/pull/${n}`;
const setFakePrs = (prs: FakePr[]) =>
  writeFileSync(
    gh.FAKE_GH_STATE ?? "",
    JSON.stringify(prs.map((p) => ({ isDraft: false, ...p, url: urlOf(p.number) }))),
  );

const command = (cmd: Extract<RpcRequest, { method: "command" }>["command"]) =>
  call(service, { method: "command", projectId: project.id, command: cmd });

const reviewedTicket = (title: string, pr: { number: number; base: string | null; head: string | null }) => {
  const ticket = command({ method: "createTicket", title }) as Ticket;
  command({ method: "setStatus", ticketId: ticket.id, statusId: "in_review" });
  const ref: GithubPrRef = { kind: "github_pr", url: urlOf(pr.number), state: "open", ...pr };
  command({ method: "upsertExternalRef", ticketId: ticket.id, ref });
  return ticket.id;
};

const ticketOf = (id: string) =>
  call(service, { method: "getProject", projectId: project.id }).tickets.find((t) => t.id === id);
const prOf = (id: string) => ticketOf(id)?.externalRefs.find((r): r is GithubPrRef => r.kind === "github_pr");
const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await Bun.sleep(20);
  return check();
};
const start = (target: Service) => {
  poller = startPrPoller(target, gh, 50, () => () => undefined);
};

test("a stacked PR merged into its parent stays in review, the parent merge cascades", async () => {
  const child = reviewedTicket("Coquille", { number: 1, base: "feat/a", head: "feat/b" });
  const parent = reviewedTicket("Schéma", { number: 2, base: "dev", head: "feat/a" });
  setFakePrs([
    { number: 1, state: "MERGED", base: "feat/a", head: "feat/b" },
    { number: 2, state: "OPEN", base: "dev", head: "feat/a" },
  ]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => prOf(child)?.state === "merged")).toBe(true);
  await Bun.sleep(120);
  expect(ticketOf(child)?.statusId).toBe("in_review");
  expect(ticketOf(parent)?.statusId).toBe("in_review");
  setFakePrs([
    { number: 1, state: "MERGED", base: "feat/a", head: "feat/b" },
    { number: 2, state: "MERGED", base: "dev", head: "feat/a" },
  ]);
  expect(await waitFor(() => ticketOf(parent)?.statusId === "done")).toBe(true);
  expect(ticketOf(child)?.statusId).toBe("done");
});

test("a PR merged into another branch than the integration branch is not done", async () => {
  const id = reviewedTicket("Schéma", { number: 1, base: "main", head: "feat/a" });
  setFakePrs([{ number: 1, state: "MERGED", base: "main", head: "feat/a" }]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => prOf(id)?.state === "merged")).toBe(true);
  await Bun.sleep(120);
  expect(ticketOf(id)?.statusId).toBe("in_review");
});

test("a legacy PR without base is done as before", async () => {
  const id = reviewedTicket("Schéma", { number: 1, base: null, head: null });
  writeFileSync(
    gh.FAKE_GH_STATE ?? "",
    JSON.stringify([{ number: 1, url: urlOf(1), state: "MERGED", isDraft: false, head: "feat/a" }]),
  );
  start(withWorktree(service, DEV));
  expect(await waitFor(() => ticketOf(id)?.statusId === "done")).toBe(true);
  expect(prOf(id)).toMatchObject({ state: "merged", base: null, head: "feat/a" });
});

test("the poller records base and head even when the state is unchanged", async () => {
  const id = reviewedTicket("Schéma", { number: 1, base: null, head: null });
  setFakePrs([{ number: 1, state: "OPEN", base: "dev", head: "feat/a" }]);
  start(service);
  expect(await waitFor(() => prOf(id)?.base === "dev")).toBe(true);
  expect(prOf(id)).toMatchObject({ state: "open", head: "feat/a" });
  expect(ticketOf(id)?.statusId).toBe("in_review");
});

const branchTicket = (title: string, branch: string, statusId: StatusId = "in_progress") => {
  const ticket = command({ method: "createTicket", title }) as Ticket;
  command({ method: "setStatus", ticketId: ticket.id, statusId });
  command({
    method: "upsertExternalRef",
    ticketId: ticket.id,
    ref: { kind: "git_branch", branch, base: null },
  });
  return ticket.id;
};
const listCalls = (branch: string) =>
  readFakeGhLog(gh).filter((c) => c.args[1] === "list" && c.args.includes(`--head=${branch}`)).length;

test("a draft PR opened outside Kibo moves the ticket to review, ready does not retrigger", async () => {
  const id = branchTicket("Stockage", "feat/stockage-fichiers");
  setFakePrs([{ number: 9, state: "OPEN", isDraft: true, base: "dev", head: "feat/stockage-fichiers" }]);
  const rules = spyOn(service, "triggerRules");
  start(withWorktree(service, DEV));
  expect(await waitFor(() => ticketOf(id)?.statusId === "in_review")).toBe(true);
  expect(prOf(id)).toEqual({
    kind: "github_pr",
    url: urlOf(9),
    number: 9,
    state: "draft",
    base: "dev",
    head: "feat/stockage-fichiers",
  });
  expect(listCalls("feat/stockage-fichiers")).toBe(1);
  setFakePrs([{ number: 9, state: "OPEN", base: "dev", head: "feat/stockage-fichiers" }]);
  expect(await waitFor(() => prOf(id)?.state === "open")).toBe(true);
  await Bun.sleep(150);
  expect(rules.mock.calls.map(([, t]) => t.kind)).toEqual(["pr_opened"]);
  expect(listCalls("feat/stockage-fichiers")).toBe(1);
});

test("an open PR opened outside Kibo moves the ticket to review", async () => {
  const id = branchTicket("Stockage", "feat/stockage-fichiers");
  setFakePrs([
    { number: 3, state: "CLOSED", base: "dev", head: "feat/stockage-fichiers" },
    { number: 9, state: "OPEN", base: "dev", head: "feat/stockage-fichiers" },
  ]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => ticketOf(id)?.statusId === "in_review")).toBe(true);
  expect(prOf(id)).toMatchObject({ number: 9, state: "open" });
});

test("a PR merged outside Kibo on the integration branch is done, with its stack", async () => {
  const parent = branchTicket("Schéma", "feat/a");
  const child = reviewedTicket("Coquille", { number: 1, base: "feat/a", head: "feat/b" });
  setFakePrs([
    { number: 1, state: "MERGED", base: "feat/a", head: "feat/b" },
    { number: 2, state: "MERGED", base: "dev", head: "feat/a" },
  ]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => ticketOf(parent)?.statusId === "done")).toBe(true);
  expect(await waitFor(() => ticketOf(child)?.statusId === "done")).toBe(true);
  expect(prOf(parent)).toMatchObject({ number: 2, state: "merged", base: "dev" });
});

test("a PR merged outside Kibo into a parent branch is attached, status unchanged", async () => {
  const id = branchTicket("Coquille", "feat/b");
  setFakePrs([{ number: 1, state: "MERGED", base: "feat/a", head: "feat/b" }]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => prOf(id)?.state === "merged")).toBe(true);
  await Bun.sleep(150);
  expect(ticketOf(id)?.statusId).toBe("in_progress");
});

test("discovery skips done tickets and tickets with a followed PR, and finds nothing without a PR", async () => {
  const done = branchTicket("Fini", "feat/fini", "done");
  const followed = reviewedTicket("Suivi", { number: 1, base: "dev", head: "feat/suivi" });
  command({
    method: "upsertExternalRef",
    ticketId: followed,
    ref: { kind: "git_branch", branch: "feat/suivi", base: null },
  });
  const alone = branchTicket("Seul", "feat/seul");
  setFakePrs([
    { number: 1, state: "OPEN", base: "dev", head: "feat/suivi" },
    { number: 2, state: "OPEN", base: "dev", head: "feat/fini" },
  ]);
  start(withWorktree(service, DEV));
  expect(await waitFor(() => listCalls("feat/seul") >= 2)).toBe(true);
  expect(listCalls("feat/fini")).toBe(0);
  expect(listCalls("feat/suivi")).toBe(0);
  expect(prOf(done)).toBeUndefined();
  expect(prOf(alone)).toBeUndefined();
  expect(ticketOf(alone)?.statusId).toBe("in_progress");
});
