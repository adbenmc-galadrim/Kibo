import { afterEach, beforeEach, expect, test } from "bun:test";
import { parseTestOrigins } from "../integrations/net";
import { ECHO_AUTH, type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { proxyFetch } from "./net-proxy";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
});
afterEach(() => gh.stop());

const GET = { method: "GET" as const, headers: { authorization: "Bearer forged" } };
const SECRETS = [{ name: "github" as const, hosts: ["api.github.com"] }];
const hooks = (observed: string[] = []) => ({
  aliases: parseTestOrigins([`api.github.com=${gh.url}`]),
  observe: (host: string) => observed.push(host),
  secret: async () => gh.token,
});

test("a granted secret is injected for its host, never exposed to the component", async () => {
  const observed: string[] = [];
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, {
    hooks: hooks(observed),
    secrets: SECRETS,
  });
  expect(out.status).toBe(200);
  expect(gh.requests.at(-1)?.auth).toBe(`Bearer ${gh.token}`);
  expect(JSON.stringify(out)).not.toContain(gh.token);
  expect(observed).toEqual(["api.github.com"]);
});

test("without the secrets grant, no credential is sent", async () => {
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, {
    hooks: hooks(),
    secrets: [],
  });
  expect(out.status).toBe(401);
  expect(gh.requests.at(-1)?.auth).toBeNull();
});

test("a secret echoed in the response body is scrubbed", async () => {
  gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
  const out = await proxyFetch(["api.github.com"], "https://api.github.com/user", GET, {
    hooks: hooks(),
    secrets: SECRETS,
  });
  expect(out.body).toContain("Bearer ***");
  expect(out.body).not.toContain(gh.token);
});

test("an alias exists only through the test hooks", async () => {
  await expect(
    proxyFetch(["api.github.com"], "https://api.github.com/user", GET, {
      resolve: async () => ["127.0.0.1"],
    }),
  ).rejects.toThrow("PERMISSION_DENIED");
});
