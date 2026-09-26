import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { migrateIntegrations } from "../integrations/db";
import { unavailableSecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import type { GhRunner, IntegrationFetch, SecretStore } from "../integrations/types";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { githubFetch, githubStack } from "./github-test-kit";

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

const realFetch = () => githubFetch(gh);
const setup = (secrets?: SecretStore, fetch?: IntegrationFetch, ghRunner?: GhRunner) =>
  githubStack(gh, host, secrets, fetch, ghRunner);

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

describe("github connect options", () => {
  test("a gh token github rejects leaves the personal token option usable", async () => {
    host.ghReply = { code: 0, stdout: "gho_revoked_token_0000000000\n", stderr: "" };
    const { account } = setup();
    expect(await account.options()).toEqual({ ghAvailable: false, ghLogin: null, mode: null });
    expect(await account.connect({ mode: "token", token: gh.token })).toEqual({ login: "adam" });
    expect(await account.options()).toEqual({ ghAvailable: false, ghLogin: null, mode: "token" });
  });

  test("offline, gh is reported unavailable instead of failing the dialog", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const offline = createIntegrationFetch({
      aliases: parseTestOrigins(["api.github.com=http://127.0.0.1:1"]),
    });
    expect(await setup(undefined, offline).account.options()).toEqual({
      ghAvailable: false,
      ghLogin: null,
      mode: null,
    });
  });

  test("local failures still surface", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const broken: IntegrationFetch = async () => {
      throw new KiboError("INTERNAL", "boom");
    };
    await expect(setup(undefined, broken).account.options()).rejects.toThrow("INTERNAL");
  });
});

describe("github account races", () => {
  test("a verify in flight never overwrites the login of an account connected meanwhile", async () => {
    const real = realFetch();
    let hold: Promise<void> | null = null;
    let release: () => void = () => undefined;
    const fetch: IntegrationFetch = async (url, init, rules) => {
      if (hold !== null && init.bearer === gh.token) await hold;
      if (init.bearer === "ghp_other_account_1234567") {
        const body = new TextEncoder().encode('{"login":"bob"}');
        return { status: 200, headers: new Headers(), body, truncated: false, url };
      }
      return real(url, init, rules);
    };
    const { account } = setup(undefined, fetch);
    await account.connect({ mode: "token", token: gh.token });
    hold = new Promise<void>((r) => {
      release = r;
    });
    const verifying = account.verify();
    await account.connect({ mode: "token", token: "ghp_other_account_1234567" });
    release();
    expect(await verifying).toBe("adam");
    expect(account.login()).toBe("bob");
    expect(await account.token()).toBe("ghp_other_account_1234567");
  });

  test("a gh token read in flight during a disconnect is not cached", async () => {
    let release: (v: { code: number; stdout: string; stderr: string }) => void = () => undefined;
    const slow: GhRunner = (args) => {
      host.ghCalls.push(args);
      return new Promise((r) => {
        release = r;
      });
    };
    const { account } = setup(undefined, realFetch(), slow);
    const opening = account.options();
    await Bun.sleep(1);
    await account.disconnect();
    release({ code: 0, stdout: `${gh.token}\n`, stderr: "" });
    await opening;
    const calls = host.ghCalls.length;
    const again = account.options();
    await Bun.sleep(1);
    expect(host.ghCalls.length).toBe(calls + 1);
    release({ code: 1, stdout: "", stderr: "not logged in" });
    expect((await again).ghAvailable).toBe(false);
  });

  test("simultaneous gh token reads run gh once", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const { account } = setup();
    await account.connect({ mode: "gh" });
    host.clock.now += 11 * 60_000;
    const before = host.ghCalls.length;
    const tokens = await Promise.all([account.token(), account.token(), account.token()]);
    expect(tokens).toEqual([gh.token, gh.token, gh.token]);
    expect(host.ghCalls.length).toBe(before + 1);
  });

  test("a personal token connection forgets the cached gh token", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const { account } = setup();
    await account.options();
    const before = host.ghCalls.length;
    await account.connect({ mode: "token", token: gh.token });
    await account.options();
    expect(host.ghCalls.length).toBe(before + 1);
  });

  test("a 401 in gh mode forgets the cached gh token", async () => {
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const { account, api } = setup();
    await account.connect({ mode: "gh" });
    gh.token = "gho_ROTATED0000000000000000000000000000";
    host.ghReply = { code: 0, stdout: `${gh.token}\n`, stderr: "" };
    const User = z.object({ login: z.string() });
    await expect(api.rest("GET", "/user", User)).rejects.toThrow("REMOTE_REJECTED");
    expect(await api.rest("GET", "/user", User)).toEqual({ login: "adam" });
  });
});
