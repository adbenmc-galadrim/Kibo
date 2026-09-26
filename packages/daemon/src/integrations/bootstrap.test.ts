import { expect, test } from "bun:test";
import { startFakeGithub } from "../testing/fake-github";
import { parseIntegrationFlags, startIntegrations } from "./bootstrap";
import { createRedactor } from "./redact";
import { createFakeHost } from "./testing/fake-host";

const ORIGIN = "api.github.com=http://127.0.0.1:4391";

test("test origins and memory secrets go together", () => {
  expect(parseIntegrationFlags({})).toEqual({ testOrigins: [], memorySecrets: false });
  expect(parseIntegrationFlags({ "test-origins": ORIGIN, "memory-secrets": true })).toEqual({
    testOrigins: [ORIGIN],
    memorySecrets: true,
  });
  expect(() => parseIntegrationFlags({ "memory-secrets": true })).toThrow("INVALID_INPUT");
  expect(() => parseIntegrationFlags({ "test-origins": ORIGIN })).toThrow("INVALID_INPUT");
});

test("a malformed test origin stops the daemon at startup", () => {
  expect(() =>
    parseIntegrationFlags({
      "test-origins": "api.github.com=https://api.github.com",
      "memory-secrets": true,
    }),
  ).toThrow("INVALID_INPUT");
  expect(() => parseIntegrationFlags({ "test-origins": "nope", "memory-secrets": true })).toThrow(
    "INVALID_INPUT",
  );
});

test("the github secret of components resolves through the account", async () => {
  const gh = startFakeGithub();
  const host = createFakeHost();
  try {
    const flags = parseIntegrationFlags({
      "test-origins": `api.github.com=${gh.url}`,
      "memory-secrets": true,
    });
    const rpc = startIntegrations(host, flags, createRedactor());
    expect(await rpc.hooks.secret("github")).toBeNull();
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    await rpc.handle({ method: "connectGithub", auth: { mode: "gh" } });
    expect(await rpc.hooks.secret("github")).toBe(gh.token);
    await rpc.handle({ method: "disconnectIntegration", id: "github" });
    expect(await rpc.hooks.secret("github")).toBeNull();
    rpc.stop();
  } finally {
    gh.stop();
    host.close();
  }
});

test("the ci runs are served to the UI and to components", async () => {
  const gh = startFakeGithub();
  const host = createFakeHost();
  try {
    const flags = parseIntegrationFlags({
      "test-origins": `api.github.com=${gh.url}`,
      "memory-secrets": true,
    });
    const rpc = startIntegrations(host, flags, createRedactor());
    expect(rpc.handles("listCiRuns")).toBe(true);
    expect(rpc.handles("getCiLog")).toBe(true);
    expect(await rpc.handle({ method: "listCiRuns", projectId: host.projectId, ticketId: null })).toEqual([]);
    expect(await rpc.hooks.ciRuns?.(host.projectId)).toEqual([]);
    await expect(
      rpc.handle({ method: "getCiLog", projectId: host.projectId, runId: 1, jobId: 2 }),
    ).rejects.toThrow("NOT_FOUND");
    rpc.stop();
  } finally {
    gh.stop();
    host.close();
  }
});
