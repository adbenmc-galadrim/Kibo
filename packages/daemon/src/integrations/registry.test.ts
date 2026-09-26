import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createIntegrationRpc } from "./registry";

const status = (id: "github" | "git") => async () => ({
  id,
  state: "connected" as const,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
});

test("dispatches to the registered handler and lists probes in screen order", async () => {
  const rpc = createIntegrationRpc({
    handlers: [{ getGithubConnectOptions: async () => ({ ghAvailable: true, ghLogin: "adam", mode: null }) }],
    probes: [
      { id: "github", status: status("github") },
      { id: "git", status: status("git") },
    ],
    stops: [],
  });
  expect(rpc.handles("getGithubConnectOptions")).toBe(true);
  expect(rpc.handles("listIntegrations")).toBe(true);
  expect(rpc.handles("getProject")).toBe(false);
  expect(await rpc.handle({ method: "getGithubConnectOptions" })).toEqual({
    ghAvailable: true,
    ghLogin: "adam",
    mode: null,
  });
  const list = (await rpc.handle({ method: "listIntegrations" })) as { id: string }[];
  expect(list.map((s) => s.id)).toEqual(["git", "github"]);
});

test("a failing probe becomes an error state, never a crash", async () => {
  const rpc = createIntegrationRpc({
    handlers: [],
    probes: [
      {
        id: "github",
        status: async () => {
          throw new KiboError("NOT_CONNECTED", "token revoked");
        },
      },
    ],
    stops: [],
  });
  const [s] = (await rpc.handle({ method: "listIntegrations" })) as {
    state: string;
    error: { code: string };
  }[];
  expect(s?.state).toBe("error");
  expect(s?.error.code).toBe("NOT_CONNECTED");
});

test("duplicate handlers and unknown methods are refused", async () => {
  const h = { listGithubRepos: async () => [] };
  expect(() => createIntegrationRpc({ handlers: [h, h], probes: [], stops: [] })).toThrow("duplicate");
  const rpc = createIntegrationRpc({ handlers: [], probes: [], stops: [] });
  await expect(rpc.handle({ method: "listGithubRepos", query: "" })).rejects.toThrow("NOT_FOUND");
  await expect(rpc.handle({ method: "testIntegration", id: "figma" })).rejects.toThrow("NOT_FOUND");
  await expect(rpc.handle({ method: "disconnectIntegration", id: "github" })).rejects.toThrow("NOT_FOUND");
});

test("a probe error message is redacted", async () => {
  const rpc = createIntegrationRpc({
    handlers: [],
    probes: [
      {
        id: "github",
        status: async () => {
          throw new KiboError("REMOTE_REJECTED", "github 401: Bearer ghp_TESTSECRET0123456789abcdefghijklmn");
        },
      },
    ],
    stops: [],
    redact: (text) => text.split("ghp_TESTSECRET0123456789abcdefghijklmn").join("***"),
  });
  const [s] = (await rpc.handle({ method: "listIntegrations" })) as { error: { message: string } }[];
  expect(s?.error.message).toBe("github 401: Bearer ***");
  const tested = (await rpc.handle({ method: "testIntegration", id: "github" })) as {
    error: { message: string };
  };
  expect(tested.error.message).toBe("github 401: Bearer ***");
});

test("a returned probe error message is redacted", async () => {
  const secret = "ghp_TESTSECRET0123456789abcdefghijklmn";
  const failed = async () => ({
    id: "github" as const,
    state: "error" as const,
    account: null,
    servers: [],
    error: { code: "REMOTE_REJECTED" as const, message: `github 401: Bearer ${secret}` },
    resumeAt: null,
  });
  const rpc = createIntegrationRpc({
    handlers: [],
    probes: [{ id: "github", status: failed, test: failed }],
    stops: [],
    redact: (text) => text.split(secret).join("***"),
  });
  const [s] = (await rpc.handle({ method: "listIntegrations" })) as { error: { message: string } }[];
  expect(s?.error.message).toBe("github 401: Bearer ***");
  const tested = (await rpc.handle({ method: "testIntegration", id: "github" })) as {
    error: { message: string };
  };
  expect(tested.error.message).toBe("github 401: Bearer ***");
});
