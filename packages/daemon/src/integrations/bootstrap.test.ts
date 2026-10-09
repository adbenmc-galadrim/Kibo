import { expect, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import { startFakeGithub } from "../testing/fake-github";
import { startFakeItch } from "../testing/fake-itch";
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
    await rpc.stop();
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

test("the daemon secret store is exposed for system secrets", async () => {
  const host = createFakeHost();
  try {
    const flags = parseIntegrationFlags({ "test-origins": ORIGIN, "memory-secrets": true });
    const rpc = startIntegrations(host, flags, createRedactor());
    await rpc.secrets.set("remote:tls", "key material");
    expect(await rpc.secrets.get("remote:tls")).toBe("key material");
    await rpc.stop();
  } finally {
    host.close();
  }
});

test("embedded frames are checked against the aliased site and relayed with its origin", async () => {
  const itch = startFakeItch();
  const host = createFakeHost();
  try {
    const flags = parseIntegrationFlags({ "test-origins": `itch.io=${itch.url}`, "memory-secrets": true });
    const rpc = startIntegrations(
      host,
      { ...flags, devOrigins: ["http://localhost:5173"] },
      createRedactor(),
    );
    const manifest = ComponentManifest.parse({
      id: "itch",
      version: "1.0.0",
      kind: "both",
      title: "Jeu itch.io",
      reads: [],
      writes: [],
      capabilities: ["embed"],
      embeds: ["itch.io"],
    });
    const ctx = { projectId: host.projectId, instanceId: "w1", manifest };
    const view = await rpc.hooks.embed?.open(ctx, "https://itch.io/embed-upload/1?color=333");
    expect(view?.url).toStartWith("http://127.0.0.1:4999/e/");
    expect(itch.requests).toEqual([{ method: "GET", path: "/embed-upload/1" }]);
    const relay = rpc.relay(view?.url.split("/e/")[1] ?? "");
    expect(relay?.html).toContain(`src="${itch.url}/embed-upload/1?color=333"`);
    expect(relay?.headers["content-security-policy"]).toContain(`frame-src ${itch.url};`);
    expect(relay?.headers["content-security-policy"]).toContain("'self' http://localhost:5173;");
    await expect(rpc.hooks.embed?.open(ctx, "https://itch.io/embed-upload/2")).rejects.toThrow(
      "EMBED_REFUSED",
    );
    expect(rpc.relay("0".repeat(64))).toBeNull();
    await rpc.stop();
  } finally {
    itch.stop();
    host.close();
  }
});
