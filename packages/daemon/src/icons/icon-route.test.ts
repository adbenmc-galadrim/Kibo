import { expect, test } from "bun:test";
import { parseIconPath, serveIcon } from "./icon-route";
import type { StoredIcon } from "./icon-store";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const stored: StoredIcon = { mime: "image/png", bytes: PNG, sha256: "abc" };
const deps = (paired = true) => ({
  icons: { get: (owner: string) => (owner === "project:p1" ? stored : null) },
  origins: () => ["http://127.0.0.1:4317"],
  hasSession: () => paired,
});
const get = (path: string, headers: Record<string, string> = {}) => {
  const url = new URL(`http://127.0.0.1:4317${path}`);
  return serveIcon(new Request(url.href, { headers }), url, deps());
};

test("parses the two owner paths and nothing else", () => {
  expect(parseIconPath("/icons/workspace")).toEqual({ kind: "workspace" });
  expect(parseIconPath("/icons/project/p1")).toEqual({ kind: "project", projectId: "p1" });
  expect(parseIconPath("/icons/project/p1/more")).toBeNull();
  expect(parseIconPath("/icons/project/")).toBeNull();
  expect(parseIconPath("/icons/project/..%2Fworkspace")).toBeNull();
  expect(parseIconPath("/icons/other")).toBeNull();
});

test("serves the stored bytes with the verified mime and an immutable private cache", async () => {
  const res = get("/icons/project/p1?v=abc");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
});

test("refuses without a session, from another site or origin, and 404s the rest", () => {
  const url = new URL("http://127.0.0.1:4317/icons/project/p1");
  const unpaired = serveIcon(new Request(url.href), url, deps(false));
  expect(unpaired.status).toBe(401);
  expect(unpaired.headers.get("cache-control")).toBe("no-store");
  expect(get("/icons/project/p1", { "sec-fetch-site": "cross-site" }).status).toBe(403);
  expect(get("/icons/project/p1", { "sec-fetch-site": "same-site" }).status).toBe(403);
  expect(get("/icons/project/p1", { origin: "https://evil.example" }).status).toBe(403);
  expect(get("/icons/project/p2").status).toBe(404);
  expect(get("/icons/workspace").status).toBe(404);
  expect(serveIcon(new Request(url.href, { method: "POST" }), url, deps()).status).toBe(404);
});
