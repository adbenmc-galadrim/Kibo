import { expect, test } from "bun:test";
import { cacheName, networkFirst, shellFiles, staleCaches, strategyFor } from "./sw-policy";

const ORIGIN = "https://kibo.example";
const at = (path: string) => new URL(path, ORIGIN);

test("the api is never cached, navigations get the shell, files are revalidated", () => {
  expect(strategyFor(at("/api/phone/snapshot?projectId=_"), ORIGIN, "cors", "GET")).toBe("network");
  expect(strategyFor(at("/api"), ORIGIN, "cors", "GET")).toBe("network");
  expect(strategyFor(at("/api/phone/request"), ORIGIN, "cors", "POST")).toBe("network");
  expect(strategyFor(at("/assets/index-1.js"), "https://other.example", "cors", "GET")).toBe("network");
  expect(strategyFor(at("/"), ORIGIN, "navigate", "GET")).toBe("shell");
  expect(strategyFor(at("/assets/index-1.js"), ORIGIN, "cors", "GET")).toBe("asset");
});

test("the shell lists the entry, its css and static imports, never the service worker", () => {
  const manifest = {
    "index.html": {
      file: "assets/index-1.js",
      css: ["assets/index-2.css"],
      imports: ["_shared.js"],
      isEntry: true,
    },
    "_shared.js": { file: "assets/shared-3.js" },
    "src/sw.ts": { file: "sw.js", isEntry: true },
    "lazy.tsx": { file: "assets/lazy-4.js", isDynamicEntry: true },
  };
  expect(shellFiles(manifest).sort()).toEqual(
    [
      "/",
      "/assets/index-1.js",
      "/assets/index-2.css",
      "/assets/shared-3.js",
      "/index.html",
      "/manifest.webmanifest",
    ].sort(),
  );
});

test("the shell follows dynamic imports, so screens loaded on demand open offline", () => {
  const manifest = {
    "index.html": {
      file: "assets/index-1.js",
      dynamicImports: ["src/screens/agent/AgentScreen.tsx"],
      isEntry: true,
    },
    "src/screens/agent/AgentScreen.tsx": {
      file: "assets/AgentScreen-5.js",
      css: ["assets/AgentScreen-6.css"],
      imports: ["_floating.js"],
      dynamicImports: ["src/AgentMarkdown.tsx"],
      isDynamicEntry: true,
    },
    "_floating.js": { file: "assets/floating-7.js" },
    "src/AgentMarkdown.tsx": { file: "assets/AgentMarkdown-8.js", isDynamicEntry: true },
    "src/unused.tsx": { file: "assets/unused-9.js", isDynamicEntry: true },
  };
  expect(shellFiles(manifest).sort()).toEqual(
    [
      "/",
      "/assets/AgentMarkdown-8.js",
      "/assets/AgentScreen-5.js",
      "/assets/AgentScreen-6.css",
      "/assets/floating-7.js",
      "/assets/index-1.js",
      "/index.html",
      "/manifest.webmanifest",
    ].sort(),
  );
});

test("each build has its own cache and activation drops every other one", () => {
  expect(cacheName("lq3x9a")).toBe("kibo-phone-lq3x9a");
  expect(staleCaches(["kibo-phone-old", "kibo-phone-lq3x9a", "other"], "kibo-phone-lq3x9a")).toEqual([
    "kibo-phone-old",
    "other",
  ]);
});

const shellCache = () => {
  const stored = new Map<string, Response>();
  return {
    stored,
    match: async (request: Request) => stored.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      stored.set(request.url, response);
    },
  };
};
const page = (nonce: string) => new Response(`<meta property="csp-nonce" content="${nonce}">`);

test("the shell comes from the network with its fresh nonce, the cache only stands in offline", async () => {
  const cache = shellCache();
  const shell = new Request(`${ORIGIN}/index.html`);
  await cache.put(shell, page("b2xkLW5vbmNl"));
  const online = await networkFirst(shell, cache, async () => page("ZnJlc2gtbm9uY2U="));
  expect(await online.text()).toContain("ZnJlc2gtbm9uY2U=");
  const offline = await networkFirst(shell, cache, async () => {
    throw new TypeError("Failed to fetch");
  });
  expect(await offline.text()).toContain("ZnJlc2gtbm9uY2U=");
});

test("offline without a cached shell, the network failure surfaces", async () => {
  const shell = new Request(`${ORIGIN}/index.html`);
  await expect(
    networkFirst(shell, shellCache(), async () => {
      throw new TypeError("Failed to fetch");
    }),
  ).rejects.toThrow("Failed to fetch");
});

test("a failed answer during a redeploy serves the cached shell and never replaces it", async () => {
  const cache = shellCache();
  const shell = new Request(`${ORIGIN}/index.html`);
  await cache.put(shell, page("b2xkLW5vbmNl"));
  const answer = await networkFirst(shell, cache, async () => new Response("down", { status: 502 }));
  expect(answer.status).toBe(200);
  expect(await answer.text()).toContain("b2xkLW5vbmNl");
  expect(await cache.stored.get(shell.url)?.clone().text()).toContain("b2xkLW5vbmNl");
});

test("a failed answer without a cached shell is passed on", async () => {
  const shell = new Request(`${ORIGIN}/index.html`);
  const answer = await networkFirst(shell, shellCache(), async () => new Response("down", { status: 503 }));
  expect(answer.status).toBe(503);
});
