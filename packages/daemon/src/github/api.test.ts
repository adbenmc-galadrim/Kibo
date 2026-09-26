import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GITHUB_GRAPHQL } from "@kibo/schema";
import { z } from "zod";
import { migrateIntegrations } from "../integrations/db";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { githubStack } from "./github-test-kit";

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

const setup = () => githubStack(gh, host);

describe("github api", () => {
  test("paths must stay on the github api", async () => {
    const { account, api } = setup();
    await account.connect({ mode: "token", token: gh.token });
    const count = gh.requests.length;
    await expect(api.rest("GET", "@evil.example.com/x", z.unknown())).rejects.toThrow("INVALID_INPUT");
    await expect(api.raw("user", [], 100)).rejects.toThrow("INVALID_INPUT");
    expect(gh.requests.length).toBe(count);
  });

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
