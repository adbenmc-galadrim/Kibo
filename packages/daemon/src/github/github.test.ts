import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GITHUB_GRAPHQL, KiboError } from "@kibo/schema";
import { z } from "zod";
import { migrateIntegrations } from "../integrations/db";
import { createMemorySecretStore, unavailableSecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import type { SecretStore } from "../integrations/types";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { createGithubApi } from "./api";
import { createGithubAccount } from "./auth";

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

function setup(secrets: SecretStore = createMemorySecretStore(createRedactor())) {
  const redactor = createRedactor();
  const fetch = createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`]) });
  const account = createGithubAccount({
    settings: createSettings(host.db),
    secrets,
    redactor,
    gh: host.gh,
    fetch,
    now: host.now,
  });
  const gate = createRateLimitGate(host.now);
  const api = createGithubApi({ fetch, token: () => account.token(), gate });
  return { account, api, secrets, redactor, gate };
}

describe("github account", () => {
  test("a personal token is verified, then stored in the keychain only", async () => {
    const { account, secrets } = setup();
    await expect(account.connect({ mode: "token", token: "ghp_wrong_000000" })).rejects.toThrow(
      "REMOTE_REJECTED",
    );
    expect(await secrets.has("github")).toBe(false);
    expect(await account.connect({ mode: "token", token: gh.token })).toEqual({ login: "adam" });
    expect(await secrets.get("github")).toBe(gh.token);
    expect(account.mode()).toBe("token");
    expect(account.login()).toBe("adam");
    expect(JSON.stringify(host.db.query("SELECT * FROM integration_settings").all())).not.toContain(gh.token);
    await account.disconnect();
    expect(await secrets.has("github")).toBe(false);
    expect(account.mode()).toBeNull();
  });

  test("a rejected token never appears in the error", async () => {
    const { account, redactor } = setup();
    const wrong = "ghp_wrong_0000000000000000000000000000";
    const error = await account.connect({ mode: "token", token: wrong }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KiboError);
    expect(String(error)).not.toContain(wrong);
    expect(redactor.redact(`x ${wrong}`)).toBe("x ***");
  });

  test("gh mode reads the token on demand, caches it 10 minutes, never stores it", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const { account, secrets, redactor } = setup();
    const options = await account.options();
    expect(options).toEqual({ ghAvailable: true, ghLogin: "adam", mode: null });
    expect(JSON.stringify(options)).not.toContain(gh.token);
    await account.connect({ mode: "gh" });
    expect(await secrets.has("github")).toBe(false);
    expect(JSON.stringify(host.db.query("SELECT * FROM integration_settings").all())).not.toContain(gh.token);
    expect(redactor.redact(gh.token)).toBe("***");
    const before = host.ghCalls.length;
    expect(await account.token()).toBe(gh.token);
    expect(host.ghCalls.length).toBe(before);
    host.clock.now += 11 * 60_000;
    await account.token();
    expect(host.ghCalls.length).toBe(before + 1);
    expect(host.ghCalls.at(-1)).toEqual(["auth", "token"]);
  });

  test("switching from a personal token to gh removes the keychain entry", async () => {
    const { account, secrets } = setup();
    await account.connect({ mode: "token", token: gh.token });
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    await account.connect({ mode: "gh" });
    expect(account.mode()).toBe("gh");
    expect(await secrets.has("github")).toBe(false);
  });

  test("gh missing: not available; keychain missing: explicit error", async () => {
    expect((await setup().account.options()).ghAvailable).toBe(false);
    const { account } = setup(unavailableSecretStore("locked"));
    await expect(account.connect({ mode: "token", token: gh.token })).rejects.toThrow(
      "SECRET_STORE_UNAVAILABLE",
    );
    expect(account.mode()).toBeNull();
  });

  test("gh that cannot start counts as not logged in, other failures surface", async () => {
    host.gh = async () => {
      throw new KiboError("GH_UNAVAILABLE", "gh not found");
    };
    expect(await setup().account.options()).toEqual({ ghAvailable: false, ghLogin: null, mode: null });
    await expect(setup().account.connect({ mode: "gh" })).rejects.toThrow("NOT_CONNECTED");
    host.gh = async () => {
      throw new KiboError("TOO_LARGE", "gh wrote too much");
    };
    await expect(setup().account.options()).rejects.toThrow("TOO_LARGE");
  });
});

describe("github api", () => {
  test("validates responses, paginates and refuses without a token", async () => {
    const { account, api } = setup();
    await expect(api.rest("GET", "/user", z.object({ login: z.string() }))).rejects.toThrow("NOT_CONNECTED");
    await account.connect({ mode: "token", token: gh.token });
    for (let i = 0; i < 3; i++) gh.addRepo(`adam/r${i}`);
    const repos = await api.paginate("/user/repos?per_page=2", z.object({ full_name: z.string() }), 5);
    expect(repos.map((r) => r.full_name)).toEqual(["adam/kibo", "adam/r0", "adam/r1", "adam/r2"]);
    await expect(api.rest("GET", "/user", z.object({ nope: z.string() }))).rejects.toThrow("REMOTE_REJECTED");
  });

  test("pagination stops at the page limit", async () => {
    const { account, api } = setup();
    await account.connect({ mode: "token", token: gh.token });
    for (let i = 0; i < 3; i++) gh.addRepo(`adam/r${i}`);
    const repos = await api.paginate("/user/repos?per_page=1", z.object({ full_name: z.string() }), 2);
    expect(repos.map((r) => r.full_name)).toEqual(["adam/kibo", "adam/r0"]);
  });

  test("graphql errors and unexpected data are remote rejections", async () => {
    const { account, api } = setup();
    await account.connect({ mode: "token", token: gh.token });
    const vars = { projectId: "PVT_x", itemId: "nope", fieldId: "F1", optionId: "O1" };
    await expect(api.graphql(GITHUB_GRAPHQL.setStatus, vars, z.unknown())).rejects.toThrow(
      "Could not resolve item",
    );
    await expect(
      api.graphql(
        GITHUB_GRAPHQL.listProjects,
        { owner: "adam", name: "kibo" },
        z.object({ nope: z.string() }),
      ),
    ).rejects.toThrow("REMOTE_REJECTED");
  });

  test("a paused gate refuses before calling github", async () => {
    const { account, api, gate } = setup();
    await account.connect({ mode: "token", token: gh.token });
    gate.observe(
      new Headers({
        "x-ratelimit-remaining": "1",
        "x-ratelimit-reset": String(Math.floor(host.now() / 1000) + 60),
      }),
    );
    const count = gh.requests.length;
    await expect(api.rest("GET", "/user", z.object({ login: z.string() }))).rejects.toThrow("RATE_LIMITED");
    expect(gh.requests.length).toBe(count);
  });
});
