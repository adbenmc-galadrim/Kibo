import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import { createIntegrationFetch, GITHUB_LOG_RULES, GITHUB_RULES, parseTestOrigins, secretFor } from "./net";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
});
afterEach(() => gh.stop());

const aliases = () => parseTestOrigins([`api.github.com=${gh.url}`, `${LOGS_HOST}=${gh.url}`]);

describe("addresses and test origins", () => {
  test("a public name resolving to a private address is refused, a public one reaches the pinned transport", async () => {
    const sent: string[] = [];
    const transport = async (url: string) => {
      sent.push(url);
      return new Response("{}", { status: 200 });
    };
    const privateNet = createIntegrationFetch({
      aliases: new Map(),
      resolve: async () => ["10.1.2.3"],
      transport,
    });
    await expect(privateNet("https://api.github.com/user", {}, GITHUB_RULES)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    const publicNet = createIntegrationFetch({
      aliases: new Map(),
      resolve: async () => ["140.82.112.5"],
      transport,
    });
    expect((await publicNet("https://api.github.com/user", {}, GITHUB_RULES)).status).toBe(200);
    expect(sent).toEqual(["https://140.82.112.5/user"]);
  });
  test("test origins must be loopback http origins", () => {
    expect(parseTestOrigins(["api.github.com=http://127.0.0.1:4391"]).get("api.github.com")?.port).toBe(
      "4391",
    );
    expect(() => parseTestOrigins(["api.github.com=http://10.0.0.1:80"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["api.github.com=http://127.0.0.1:1/x"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["nope"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["api.github.com=http://u:p@127.0.0.1:1"])).toThrow("INVALID_INPUT");
    expect(() => parseTestOrigins(["api.github.com=http://:p@127.0.0.1:1"])).toThrow("INVALID_INPUT");
  });
});

describe("integration fetch", () => {
  test("adds the bearer only to authorised hosts and strips it on redirect", async () => {
    gh.addRun("adam/kibo", {
      id: 1,
      headSha: "s",
      headBranch: "b",
      name: "ci",
      status: "completed",
      conclusion: "failure",
      jobs: [
        {
          id: 11,
          name: "build",
          status: "completed",
          conclusion: "failure",
          startedAt: null,
          completedAt: null,
          log: "log text",
        },
      ],
    });
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f(
      "https://api.github.com/repos/adam/kibo/actions/jobs/11/logs",
      { bearer: gh.token },
      GITHUB_LOG_RULES,
    );
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.body)).toBe("log text");
    const user = await f(
      "https://api.github.com/user",
      { bearer: gh.token, headers: { authorization: "Bearer forged", cookie: "x=1" } },
      GITHUB_RULES,
    );
    expect(user.status).toBe(200);
    expect(gh.requests.at(-1)?.auth).toBe(`Bearer ${gh.token}`);
  });

  test("a secret echoed by the remote is scrubbed from the body", async () => {
    gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES);
    const text = new TextDecoder().decode(res.body);
    expect(text).toContain("Bearer ***");
    expect(text).not.toContain(gh.token);
  });

  test("a secret cut by the size cap is masked too", async () => {
    gh.failNext("GET", /^\/user$/, 500, `{"message":"Bearer ${gh.token}"}`);
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f("https://api.github.com/user", { bearer: gh.token, maxBytes: 30 }, GITHUB_RULES);
    const text = new TextDecoder().decode(res.body);
    expect(text).toBe('{"message":"Bearer ***');
    expect(res.truncated).toBe(true);
  });

  test("only a response to a request carrying the token is observed", async () => {
    const seen: string[] = [];
    const f = createIntegrationFetch({ aliases: aliases(), observe: (host) => seen.push(host) });
    await f("https://api.github.com/user", {}, GITHUB_RULES);
    expect(seen).toEqual([]);
  });

  test("a request carrying the token asks for an uncompressed body", async () => {
    const sent: Record<string, string>[] = [];
    const transport = async (_url: string, init: { headers: Record<string, string> }) => {
      sent.push(init.headers);
      return new Response("{}", { status: 200 });
    };
    const f = createIntegrationFetch({
      aliases: new Map(),
      resolve: async () => ["140.82.112.5"],
      transport,
    });
    const headers = { "accept-encoding": "gzip" };
    await f("https://api.github.com/user", { bearer: gh.token, headers }, GITHUB_RULES);
    await f("https://api.github.com/user", { headers }, GITHUB_RULES);
    expect(sent.map((h) => h["accept-encoding"])).toEqual(["identity", "gzip"]);
  });

  test("a compressed response to a request carrying the token is refused", async () => {
    const transport = async () =>
      new Response(`Bearer ${gh.token}`, { status: 200, headers: { "content-encoding": "br" } });
    const f = createIntegrationFetch({
      aliases: new Map(),
      resolve: async () => ["140.82.112.5"],
      transport,
    });
    await expect(f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES)).rejects.toThrow(
      "REMOTE_REJECTED",
    );
    expect((await f("https://api.github.com/user", {}, GITHUB_RULES)).status).toBe(200);
  });

  test("a secret echoed in a response header is scrubbed", async () => {
    gh.failNext("GET", /^\/user$/, 500, "{}", { "x-echo": `Bearer ${gh.token}` });
    const f = createIntegrationFetch({ aliases: aliases() });
    const res = await f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES);
    expect(res.headers.get("x-echo")).toBe("Bearer ***");
  });

  test("refuses http, unknown hosts and redirects outside the rules", async () => {
    const f = createIntegrationFetch({ aliases: aliases(), resolve: async () => ["140.82.112.5"] });
    await expect(f("http://api.github.com/user", {}, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
    await expect(f("https://evil.example.com/", {}, GITHUB_RULES)).rejects.toThrow("PERMISSION_DENIED");
    gh.failNext("GET", /^\/user$/, 302, "", { location: "https://evil.example.com/steal" });
    await expect(f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });

  test("truncates large bodies and reports github rate headers", async () => {
    const seen: string[] = [];
    const f = createIntegrationFetch({ aliases: aliases(), observe: (host) => seen.push(host) });
    gh.failNext("GET", /^\/user$/, 200, "x".repeat(10_000));
    const res = await f("https://api.github.com/user", { bearer: gh.token, maxBytes: 1000 }, GITHUB_RULES);
    expect(res.body.length).toBe(1000);
    expect(res.truncated).toBe(true);
    expect(seen).toEqual(["api.github.com"]);
  });
});

test("a secret is resolved only for listed hosts covered by net", async () => {
  const secrets = [{ name: "github" as const, hosts: ["api.github.com"] }];
  const resolve = async () => "ghp_value_12345678";
  const covered = (u: URL) => u.hostname === "api.github.com";
  expect(await secretFor(new URL("https://api.github.com/user"), secrets, covered, resolve)).toBe(
    "ghp_value_12345678",
  );
  expect(await secretFor(new URL("https://uploads.github.com/x"), secrets, () => true, resolve)).toBeNull();
  expect(await secretFor(new URL("https://api.github.com/user"), secrets, () => false, resolve)).toBeNull();
});

test("the github secret never leaves the github api, even with a forged manifest (N45)", async () => {
  const forged = [{ name: "github" as const, hosts: ["evil.example.com", "uploads.github.com"] }];
  let resolved = 0;
  const resolve = async () => {
    resolved++;
    return "ghp_value_12345678";
  };
  await expect(secretFor(new URL("https://evil.example.com/x"), forged, () => true, resolve)).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  expect(resolved).toBe(0);
  expect(await secretFor(new URL("https://uploads.github.com/x"), forged, () => true, resolve)).toBe(
    "ghp_value_12345678",
  );
});
