import { afterEach, beforeEach, expect, test } from "bun:test";
import { createGithubApi, type GithubApi } from "../github/api";
import { createEventLog } from "../integrations/events";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { createCiStore } from "./ci-store";
import { type CiPoller, createCiPoller } from "./poller";

let gh: FakeGithub;
let host: FakeHost;
let poller: CiPoller;
const USER = { origin: "user" as const, instanceId: null };

beforeEach(() => {
  gh = startFakeGithub();
  const repo = gh.addRepo("adam/kibo");
  repo.pulls.set(12, { headSha: "abc123", headRef: "kib-1-arbre" });
  host = createFakeHost();
  const fetch = createIntegrationFetch({
    aliases: parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]),
  });
  const api = createGithubApi({ fetch, token: async () => gh.token, gate: createRateLimitGate(host.now) });
  poller = createCiPoller({
    host,
    api,
    store: createCiStore(host.db),
    events: createEventLog(host.db, createRedactor(), host.now),
    connected: () => true,
  });
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  host.command(
    host.projectId,
    {
      method: "upsertExternalRef",
      ticketId: t.id,
      ref: {
        kind: "github_pr",
        url: "https://github.com/adam/kibo/pull/12",
        number: 12,
        state: "open",
        base: null,
        head: null,
      },
    },
    USER,
  );
});
afterEach(() => {
  gh.stop();
  host.close();
});

const job = (id: number, conclusion: string | null) => ({
  id,
  name: "build",
  status: conclusion ? "completed" : "in_progress",
  conclusion,
  startedAt: "2026-09-26T10:00:00Z",
  completedAt: conclusion ? "2026-09-26T10:03:12Z" : null,
  log: "step 1\n##[error]Test failed: tree.test.ts\nstep 3\n",
});

test("reads the runs of the head of each linked PR, with the ticket key", async () => {
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "kib-1-arbre",
    name: "CI",
    status: "in_progress",
    conclusion: null,
    jobs: [job(70, null)],
  });
  gh.addRun("adam/kibo", {
    id: 901,
    headSha: "other",
    headBranch: "x",
    name: "CI",
    status: "completed",
    conclusion: "success",
    jobs: [],
  });
  await poller.tick();
  const runs = await poller.runs(host.projectId, null);
  expect(runs.map((r) => [r.runId, r.prNumber, r.ticketKey, r.workflow, r.status])).toEqual([
    [900, 12, "KIB-1", "CI", "in_progress"],
  ]);
  expect(runs[0]?.jobs).toEqual([
    {
      jobId: 70,
      name: "build",
      status: "in_progress",
      conclusion: null,
      startedAt: "2026-09-26T10:00:00Z",
      completedAt: null,
    },
  ]);
  expect(host.events).toContainEqual({ type: "ci", projectId: host.projectId });
});

test("runs are filtered by ticket", async () => {
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "b",
    name: "CI",
    status: "in_progress",
    conclusion: null,
    jobs: [],
  });
  await poller.tick();
  const other = host.command(host.projectId, { method: "createTicket", title: "Autre" }, USER);
  const [ticket] = host.snapshot(host.projectId).tickets;
  expect((await poller.runs(host.projectId, ticket?.id ?? "")).map((r) => r.runId)).toEqual([900]);
  expect(await poller.runs(host.projectId, other.id)).toEqual([]);
});

test("a failure raises ci.failed exactly once", async () => {
  const run = gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "b",
    name: "CI",
    status: "in_progress",
    conclusion: null,
    jobs: [job(70, null)],
  });
  await poller.tick();
  expect(host.notifications).toEqual([]);
  run.status = "completed";
  run.conclusion = "failure";
  run.updatedAt = gh.tick(30);
  run.jobs = [job(70, "failure")];
  host.clock.now += 60_000;
  await poller.tick();
  host.clock.now += 60_000;
  await poller.tick();
  expect(host.notifications.map(({ title, body }) => ({ title, body }))).toEqual([
    { title: "CI cassée sur KIB-1", body: "CI a échoué sur la PR #12." },
  ]);
});

test("an old failure seen for the first time does not notify", async () => {
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "b",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [job(70, "failure")],
  });
  host.clock.now += 60 * 60_000;
  await poller.tick();
  expect(host.notifications).toEqual([]);
});

test("polls every 60 s with an open ticket, every 15 min once all are done", async () => {
  await poller.tick();
  const count = () => gh.requests.filter((r) => r.path.startsWith("/repos/adam/kibo/pulls/12")).length;
  const first = count();
  host.clock.now += 61_000;
  await poller.tick();
  expect(count()).toBe(first + 1);
  const t = host.snapshot(host.projectId).tickets[0];
  host.command(host.projectId, { method: "setStatus", ticketId: t?.id ?? "", statusId: "done" }, USER);
  host.clock.now += 61_000;
  await poller.tick();
  expect(count()).toBe(first + 1);
  host.clock.now += 15 * 60_000;
  await poller.tick();
  expect(count()).toBe(first + 2);
});

test("nothing is polled while GitHub is not connected", async () => {
  const idle = createCiPoller({
    host,
    api: createGithubApi({
      fetch: createIntegrationFetch({ aliases: new Map() }),
      token: async () => null,
      gate: createRateLimitGate(host.now),
    }),
    store: createCiStore(host.db),
    events: createEventLog(host.db, createRedactor(), host.now),
    connected: () => false,
  });
  const before = gh.requests.length;
  await idle.tick();
  expect(gh.requests.length).toBe(before);
});

test("a failing repository is logged, not thrown", async () => {
  gh.failNext("GET", /\/pulls\/12$/, 500);
  const events = createEventLog(host.db, createRedactor(), host.now);
  await poller.tick();
  expect(events.recent("github-actions").map((e) => e.level)).toEqual(["error"]);
});

test("a tick during a pass joins it instead of starting another", async () => {
  const api = createGithubApi({
    fetch: createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`]) }),
    token: async () => gh.token,
    gate: createRateLimitGate(host.now),
  });
  const heads: string[] = [];
  const release = Promise.withResolvers<void>();
  const inFlight = Promise.withResolvers<void>();
  const gated: GithubApi = {
    ...api,
    async rest(method, path, schema, body) {
      if (path.endsWith("/pulls/12")) {
        heads.push(path);
        inFlight.resolve();
        await release.promise;
      }
      return api.rest(method, path, schema, body);
    },
  };
  const slow = createCiPoller({
    host,
    api: gated,
    store: createCiStore(host.db),
    events: createEventLog(host.db, createRedactor(), host.now),
    connected: () => true,
  });
  const first = slow.tick();
  await inFlight.promise;
  host.clock.now += 61_000;
  const second = slow.tick();
  release.resolve();
  await Promise.all([first, second]);
  expect(heads).toHaveLength(1);
});
