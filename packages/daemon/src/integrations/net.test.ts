import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
import {
  createIntegrationFetch,
  FIGMA_AUTH,
  FIGMA_RULES,
  GITHUB_LOG_RULES,
  GITHUB_RULES,
  isLoopbackHost,
  PENPOT_AUTH,
  parseTestOrigins,
  penpotRules,
  secretFor,
} from "./net";

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

  test("refuses a target carrying credentials, first or after a redirect", async () => {
    const f = createIntegrationFetch({ aliases: aliases(), resolve: async () => ["140.82.112.5"] });
    await expect(f("https://u:p@api.github.com/user", {}, GITHUB_RULES)).rejects.toThrow(
      "credentials in url are not allowed",
    );
    gh.failNext("GET", /^\/user$/, 302, "", { location: "https://u:p@api.github.com/user" });
    await expect(f("https://api.github.com/user", { bearer: gh.token }, GITHUB_RULES)).rejects.toThrow(
      "credentials in url are not allowed",
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

describe("design providers", () => {
  test("the auth header and prefix are configurable, the secret still scrubbed", async () => {
    const seen: Record<string, string | null>[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        seen.push({ figma: req.headers.get("x-figma-token"), auth: req.headers.get("authorization") });
        return new Response(`token=${req.headers.get("x-figma-token") ?? req.headers.get("authorization")}`);
      },
    });
    const origin = new URL(`http://127.0.0.1:${server.port}/`);
    const fetchIt = createIntegrationFetch({
      aliases: new Map([
        ["api.figma.com", origin],
        ["penpot.test", origin],
      ]),
    });
    const figma = await fetchIt(
      "https://api.figma.com/v1/me",
      { bearer: "figd_SECRET", auth: FIGMA_AUTH, headers: { "x-figma-token": "forged" } },
      FIGMA_RULES,
    );
    expect(seen[0]).toEqual({ figma: "figd_SECRET", auth: null });
    expect(new TextDecoder().decode(figma.body)).toBe("token=***");
    const penpot = await fetchIt(
      "https://penpot.test/api/rpc/command/get-profile",
      { method: "POST", bearer: "penpot-SECRET", auth: PENPOT_AUTH },
      penpotRules(new URL("https://penpot.test")),
    );
    expect(seen[1]).toEqual({ figma: null, auth: "Token penpot-SECRET" });
    expect(new TextDecoder().decode(penpot.body)).toBe("token=Token ***");
    server.stop(true);
  });

  test("http is accepted on loopback only for a rule that says so, without pinning", async () => {
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("local") });
    const fetchIt = createIntegrationFetch({ aliases: new Map() });
    const instance = new URL(`http://127.0.0.1:${server.port}`);
    const res = await fetchIt(
      `${instance.origin}/api/rpc/command/get-profile`,
      { bearer: "t", auth: PENPOT_AUTH },
      penpotRules(instance),
    );
    expect(new TextDecoder().decode(res.body)).toBe("local");
    await expect(
      fetchIt(`http://127.0.0.1:${server.port}/x`, {}, [{ host: "127.0.0.1", suffix: false, auth: false }]),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      fetchIt("http://192.168.1.10:9010/x", {}, [
        { host: "192.168.1.10", suffix: false, auth: true, insecureLoopback: true },
      ]),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      fetchIt("http://design.penpot.app/x", {}, penpotRules(new URL("https://design.penpot.app"))),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      fetchIt("ftp://127.0.0.1/x", {}, penpotRules(new URL("http://127.0.0.1:9010"))),
    ).rejects.toThrow("PERMISSION_DENIED");
    server.stop(true);
  });

  test("localhost must resolve to a loopback address", async () => {
    const fetchIt = createIntegrationFetch({ aliases: new Map(), resolve: async () => ["10.0.0.5"] });
    const instance = new URL("http://localhost:9010");
    await expect(fetchIt(`${instance.origin}/x`, {}, penpotRules(instance))).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });

  test("a loopback instance never follows a redirect off its host", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response(null, { status: 307, headers: { location: "https://evil.test/x" } }),
    });
    const instance = new URL(`http://localhost:${server.port}`);
    const fetchIt = createIntegrationFetch({ aliases: new Map() });
    await expect(fetchIt(`${instance.origin}/assets/by-id/1`, {}, penpotRules(instance))).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    server.stop(true);
  });

  test("a loopback instance never follows a redirect to another origin, even an allowed one", async () => {
    const hits: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => {
        hits.push(new URL(req.url).pathname);
        return new Response(null, {
          status: 307,
          headers: { location: "https://bucket.s3.amazonaws.com/x" },
        });
      },
    });
    const instance = new URL(`http://127.0.0.1:${server.port}`);
    const transport = async () => new Response("s3");
    const fetchIt = createIntegrationFetch({
      aliases: new Map(),
      resolve: async () => ["52.216.1.1"],
      transport,
    });
    await expect(
      fetchIt(`${instance.origin}/assets/by-id/1`, { bearer: "t", auth: PENPOT_AUTH }, penpotRules(instance)),
    ).rejects.toThrow("PERMISSION_DENIED");
    expect(hits).toEqual(["/assets/by-id/1"]);
    server.stop(true);
  });

  test("figma rules carry the token to api.figma.com only", () => {
    expect(FIGMA_RULES).toEqual([
      { host: "api.figma.com", suffix: false, auth: true },
      { host: "figma.com", suffix: true, auth: false },
      { host: "amazonaws.com", suffix: true, auth: false },
    ]);
    expect(penpotRules(new URL("https://design.penpot.app"))).toEqual([
      { host: "design.penpot.app", suffix: false, auth: true },
      { host: "amazonaws.com", suffix: true, auth: false },
    ]);
    expect(penpotRules(new URL("http://localhost:9010"))[0]).toEqual({
      host: "localhost",
      suffix: false,
      auth: true,
      insecureLoopback: true,
    });
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("10.0.0.1")).toBe(false);
  });
});
