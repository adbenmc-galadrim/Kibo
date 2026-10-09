import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createGithubApi } from "../github/api";
import { createEventLog } from "../integrations/events";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, type FakeRun, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { type CiStore, createCiStore } from "./ci-store";
import { errorLinesOf, MAX_LOG_BYTES, purgeCiLogs, readCiLog } from "./logs";
import { createCiPoller } from "./poller";

let gh: FakeGithub;
let host: FakeHost;
let store: CiStore;
let run: FakeRun;
let deps: Parameters<typeof readCiLog>[0];
beforeEach(async () => {
  gh = startFakeGithub();
  const repo = gh.addRepo("adam/kibo");
  repo.pulls.set(12, { headSha: "abc123", headRef: "b" });
  run = gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "b",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [
      {
        id: 70,
        name: "build",
        status: "completed",
        conclusion: "failure",
        startedAt: null,
        completedAt: null,
        log: "ok\n##[error]boom\nfin\n",
      },
    ],
  });
  host = createFakeHost();
  store = createCiStore(host.db);
  const redactor = createRedactor();
  redactor.add(gh.token);
  const fetch = createIntegrationFetch({
    aliases: parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]),
  });
  const api = createGithubApi({ fetch, token: async () => gh.token, gate: createRateLimitGate(host.now) });
  deps = { host, api, store, redact: redactor.redact };
  const user = { origin: "user" as const, instanceId: null };
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, user);
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
    user,
  );
  const events = createEventLog(host.db, redactor, host.now);
  await createCiPoller({ host, api, store, events, connected: () => true }).tick();
});
afterEach(() => {
  gh.stop();
  host.close();
});

const setLog = (log: string) => {
  const job = run.jobs[0];
  if (job) job.log = log;
};

test("error lines are detected", () => {
  expect(errorLinesOf("ok\n##[error]boom\nError: x\nall good\nFAILED tests\n")).toEqual([2, 3, 5]);
});

test("a log is downloaded once, without leaking the token to the log host, and cached 0600", async () => {
  const log = await readCiLog(deps, host.projectId, 900, 70);
  expect(log).toEqual({ text: "ok\n##[error]boom\nfin\n", truncated: false, errorLines: [2] });
  const logRequests = gh.requests.filter((r) => r.path === "/logs/70");
  expect(logRequests.map((r) => r.auth)).toEqual([null]);
  const path = store.job(host.projectId, 900, 70)?.logPath ?? "";
  expect(statSync(path).mode & 0o777).toBe(0o600);
  await readCiLog(deps, host.projectId, 900, 70);
  expect(gh.requests.filter((r) => r.path === "/logs/70")).toHaveLength(1);
});

test("a secret echoed in a log is redacted, on screen and on disk", async () => {
  setLog(`token ${gh.token}\n`);
  const log = await readCiLog(deps, host.projectId, 900, 70);
  expect(log.text).toBe("token ***\n");
  const path = store.job(host.projectId, 900, 70)?.logPath ?? "";
  expect(readFileSync(path, "utf8")).not.toContain(gh.token);
});

test("a log is capped at 20 MiB, cut on a whole line, and stays truncated from the cache", async () => {
  const line = `${"x".repeat(1023)}\n`;
  const kept = `${line.repeat(MAX_LOG_BYTES / line.length - 1)}${"y".repeat(1013)}\n`;
  setLog(`${kept}${gh.token}\n`);
  const first = await readCiLog(deps, host.projectId, 900, 70);
  expect(first.truncated).toBe(true);
  expect(first.text.length).toBe(MAX_LOG_BYTES - 10);
  expect(first.text).toBe(kept);
  const cached = await readCiLog(deps, host.projectId, 900, 70);
  expect(cached.truncated).toBe(true);
  expect(gh.requests.filter((r) => r.path === "/logs/70")).toHaveLength(1);
});

test("a job of another project is not found", async () => {
  await expect(readCiLog(deps, "other", 900, 70)).rejects.toThrow("NOT_FOUND");
  await expect(readCiLog(deps, host.projectId, 900, 71)).rejects.toThrow("NOT_FOUND");
});

test("logs older than 14 days are purged", async () => {
  await readCiLog(deps, host.projectId, 900, 70);
  const path = store.job(host.projectId, 900, 70)?.logPath ?? "";
  purgeCiLogs(deps, host.now() + 15 * 24 * 3_600_000);
  expect(existsSync(path)).toBe(false);
  expect(store.job(host.projectId, 900, 70)?.logPath).toBeNull();
});
