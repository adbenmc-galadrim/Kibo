import { afterEach, beforeEach, expect, test } from "bun:test";
import { migrateIntegrations } from "../integrations/db";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createIntegrationRpc } from "../integrations/registry";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import type { SecretStore } from "../integrations/types";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { createGithubApi } from "./api";
import { createGithubAccount } from "./auth";
import { githubModule } from "./handlers";

let gh: FakeGithub;
let host: FakeHost;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  host = createFakeHost();
  migrateIntegrations(host.db);
});
afterEach(() => {
  gh.stop();
  host.close();
});

function rpc(wrap: (s: SecretStore) => SecretStore = (s) => s) {
  const redactor = createRedactor();
  const aliases = parseTestOrigins([`api.github.com=${gh.url}`]);
  const gate = createRateLimitGate(host.now);
  const fetch = createIntegrationFetch({ aliases });
  const secrets = wrap(createMemorySecretStore(redactor));
  const settings = createSettings(host.db);
  const account = createGithubAccount({ settings, secrets, redactor, gh: host.gh, fetch, now: host.now });
  const api = createGithubApi({
    fetch,
    token: () => account.token(),
    gate,
    onUnauthorized: () => account.forgetGhToken(),
  });
  const kit = {
    host,
    flags: { testOrigins: [], memorySecrets: true },
    redactor,
    events: createEventLog(host.db, redactor, host.now),
    settings,
    secrets,
    hooks: { aliases, observe: () => undefined, secret: async () => null, mcp: null, ciRuns: null },
    net: { fetch, gate, aliases },
    github: { account, api },
  };
  const m = githubModule(kit, kit.github);
  return createIntegrationRpc({
    handlers: m.handlers ? [m.handlers] : [],
    probes: m.probes ?? [],
    stops: [],
  });
}

type Row = { id: string; state: string; account: string | null };

test("connect, statuses of the three github rows, repos and projects", async () => {
  const r = rpc();
  const statusOf = async (id: string) =>
    ((await r.handle({ method: "listIntegrations" })) as Row[]).find((s) => s.id === id);
  expect((await statusOf("github"))?.state).toBe("disconnected");
  await r.handle({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  expect(await statusOf("github")).toMatchObject({ state: "connected", account: "adam" });
  expect((await statusOf("github-issues"))?.state).toBe("connected");
  expect((await statusOf("github-actions"))?.state).toBe("connected");
  host.remoteUrl = null;
  expect((await statusOf("github-actions"))?.state).toBe("disconnected");
  expect(host.events).toContainEqual({ type: "integrations" });
  gh.addRepo("adam/other");
  expect(await r.handle({ method: "listGithubRepos", query: "OTH" })).toEqual([
    { fullName: "adam/other", private: false, description: null },
  ]);
  gh.setProject({
    nodeId: "PVT_1",
    owner: "adam",
    number: 3,
    title: "Roadmap",
    repo: "adam/kibo",
    fieldId: "F1",
    options: [{ id: "O1", name: "Todo" }],
  });
  expect(await r.handle({ method: "listGithubProjects", repo: "adam/kibo" })).toEqual([
    {
      owner: "adam",
      number: 3,
      nodeId: "PVT_1",
      title: "Roadmap",
      statusField: { id: "F1", options: [{ id: "O1", name: "Todo" }] },
    },
  ]);
  await r.handle({ method: "disconnectIntegration", id: "github" });
  expect((await statusOf("github"))?.state).toBe("disconnected");
});

test("the gh token never reaches the UI, the event log or the statuses", async () => {
  host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
  const r = rpc();
  const answers = [
    await r.handle({ method: "getGithubConnectOptions" }),
    await r.handle({ method: "connectGithub", auth: { mode: "gh" } }),
    await r.handle({ method: "listIntegrations" }),
    await r.handle({ method: "testIntegration", id: "github" }),
  ];
  expect(answers[0]).toEqual({ ghAvailable: true, ghLogin: "adam", mode: null });
  expect(answers[1]).toEqual({ login: "adam" });
  const events = host.db.query("SELECT message FROM integration_events").all();
  expect(JSON.stringify(events)).toContain("connected as adam (gh)");
  expect(JSON.stringify([...answers, events])).not.toContain(gh.token);
});

test("github rows report a disconnected account without calling github", async () => {
  const r = rpc();
  const rows = (await r.handle({ method: "listIntegrations" })) as Row[];
  expect(rows.map((s) => [s.id, s.state])).toEqual([
    ["github", "disconnected"],
    ["github-issues", "disconnected"],
    ["github-actions", "disconnected"],
  ]);
  await expect(r.handle({ method: "listGithubRepos", query: "" })).rejects.toThrow("NOT_CONNECTED");
  expect(gh.requests).toEqual([]);
});

test("in token mode, an unavailable keychain turns the github row into an error (N46)", async () => {
  let locked = false;
  const r = rpc((s) => ({
    ...s,
    availability: async () => (locked ? { ok: false, reason: "keychain busy" } : s.availability()),
  }));
  await r.handle({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  locked = true;
  const rows = (await r.handle({ method: "listIntegrations" })) as (Row & { error: unknown })[];
  expect(rows.find((s) => s.id === "github")).toMatchObject({
    state: "error",
    error: { code: "SECRET_STORE_UNAVAILABLE", message: "keychain busy" },
  });
});

test("issues and actions rows follow an erroneous github row", async () => {
  let locked = false;
  const r = rpc((s) => ({
    ...s,
    availability: async () => (locked ? { ok: false, reason: "keychain busy" } : s.availability()),
  }));
  await r.handle({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  locked = true;
  const rows = (await r.handle({ method: "listIntegrations" })) as (Row & { error: unknown })[];
  for (const id of ["github-issues", "github-actions"]) {
    expect(rows.find((s) => s.id === id)).toMatchObject({
      state: "error",
      error: { code: "SECRET_STORE_UNAVAILABLE", message: "keychain busy" },
    });
  }
  locked = false;
  const healed = (await r.handle({ method: "listIntegrations" })) as Row[];
  expect(healed.map((s) => [s.id, s.state])).toEqual([
    ["github", "connected"],
    ["github-issues", "connected"],
    ["github-actions", "connected"],
  ]);
});

test("in token mode, a token missing from the keychain turns the github rows into an error", async () => {
  const stores: SecretStore[] = [];
  const r = rpc((s) => {
    stores.push(s);
    return s;
  });
  await r.handle({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  for (const store of stores) await store.delete("github");
  const rows = (await r.handle({ method: "listIntegrations" })) as (Row & { error: unknown })[];
  expect(rows.find((s) => s.id === "github")).toMatchObject({
    state: "error",
    account: "adam",
    error: { code: "NOT_CONNECTED" },
  });
  expect(rows.find((s) => s.id === "github-issues")).toMatchObject({
    state: "error",
    error: { code: "NOT_CONNECTED" },
  });
});
