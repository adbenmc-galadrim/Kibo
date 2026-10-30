import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GLB, PNG } from "../files/files.test-helper";
import { type FileOpener, sandboxHeaders, startSandboxServer } from "./sandbox-server";

const H = "c".repeat(64);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
  "connect-src 'none'; frame-ancestors http://127.0.0.1:4317 http://localhost:4317; base-uri 'none'; form-action 'none'";
const servers: { stop(): void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
});
function start(extraAncestors?: string[], files?: FileOpener) {
  const s = startSandboxServer({
    port: 0,
    uiPort: 4317,
    ...(extraAncestors && { extraAncestors }),
    ...(files && { files }),
  });
  servers.push(s);
  return s;
}
const get = (s: { port: number }, path: string, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${s.port}${path}`, { headers: { host: `127.0.0.1:${s.port}`, ...headers } });

describe("sandbox server", () => {
  test("listens on loopback only", () => {
    const s = start();
    expect(s.url).toBe(`http://127.0.0.1:${s.port}`);
  });

  test("component bundles are no longer served: every other path is a 404 with the strict csp", async () => {
    const s = start();
    for (const path of [
      `/c/pr-queue/0.3.0/${H}/index.html`,
      `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`,
      `/components/pr-queue/0.3.0/${H}/ui.trusted.js`,
      "/api/rpc",
      "/",
    ]) {
      const res = await get(s, path, { cookie: "kibo_session=x" });
      expect(res.status).toBe(404);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(res.headers.get("content-security-policy")).toBe(CSP);
    }
  });

  test("a wrong Host is refused", async () => {
    const s = start();
    expect((await get(s, "/", { host: "evil.test" })).status).toBe(403);
    expect((await get(s, "/", { host: "localhost:4317" })).status).toBe(403);
  });

  test("in dev, the Vite origin may frame the sandbox too", async () => {
    const s = start(["http://localhost:5173"]);
    const res = await get(s, "/");
    expect(res.headers.get("content-security-policy")).toEndWith(
      "frame-ancestors http://127.0.0.1:4317 http://localhost:4317 http://localhost:5173; base-uri 'none'; form-action 'none'",
    );
  });

  test("the csp widens only for the capabilities it is given", () => {
    expect(sandboxHeaders(4317)["content-security-policy"]).toBe(CSP);
    expect(sandboxHeaders(4317, [], ["webgl", "gamepad", "fullscreen"])["content-security-policy"]).toBe(CSP);
    expect(sandboxHeaders(4317, [], ["audio"])["content-security-policy"]).toContain(
      "media-src 'self' blob: data:; connect-src 'none'",
    );
    expect(sandboxHeaders(4317, [], ["assets"])["content-security-policy"]).not.toContain("media-src");
  });
});

describe("project files", () => {
  const T = "a".repeat(64);
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  function served(
    write: (dir: string) => void,
    opened: { name?: string; size?: number; file?: string } = {},
  ) {
    const dir = mkdtempSync(join(tmpdir(), "kibo-files-"));
    dirs.push(dir);
    write(dir);
    const files: FileOpener = {
      open: async (token) =>
        token === T
          ? {
              path: join(dir, opened.file ?? "robot.glb"),
              name: opened.name ?? "robot.glb",
              mime: "model/gltf-binary",
              size: opened.size ?? GLB.byteLength,
            }
          : null,
    };
    return start(undefined, files);
  }
  const glb = (dir: string) => writeFileSync(join(dir, "robot.glb"), GLB);

  test("project files are served by token with a strict content type", async () => {
    const s = served(glb);
    const ok = await get(s, `/f/${T}/robot.glb`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("model/gltf-binary");
    expect(ok.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("access-control-allow-origin")).toBe("*");
    expect(ok.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(ok.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(ok.headers.get("cache-control")).toBe("private, max-age=900");
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
    expect(ok.headers.get("accept-ranges")).toBe("none");
    expect(ok.headers.get("set-cookie")).toBeNull();
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(GLB);
    for (const bad of [
      `/f/${T}/other.glb`,
      `/f/${"0".repeat(64)}/robot.glb`,
      `/f/${T}/robot.glb/x`,
      `/f/${T}`,
      "/f/short/robot.glb",
    ])
      expect((await get(s, bad)).status).toBe(404);
  });

  test("only GET and HEAD from the loopback host are answered", async () => {
    const s = served(glb);
    const head = await fetch(`http://127.0.0.1:${s.port}/f/${T}/robot.glb`, {
      method: "HEAD",
      headers: { host: `127.0.0.1:${s.port}` },
    });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect((await head.arrayBuffer()).byteLength).toBe(0);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"])
      expect(
        (
          await fetch(`http://127.0.0.1:${s.port}/f/${T}/robot.glb`, {
            method,
            headers: { host: `127.0.0.1:${s.port}` },
          })
        ).status,
      ).toBe(405);
    expect((await get(s, `/f/${T}/robot.glb`, { host: "evil.test" })).status).toBe(403);
  });

  test("the name in the url must be the one the token was minted for", async () => {
    const s = served(glb, { name: "other.glb" });
    expect((await get(s, `/f/${T}/robot.glb`)).status).toBe(404);
    expect((await get(s, `/f/${T}/other.glb`)).status).toBe(200);
  });

  test("the length comes from the opened file, not from the lookup", async () => {
    const s = served(glb, { size: 9999 });
    const ok = await get(s, `/f/${T}/robot.glb`);
    expect(ok.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(GLB);
  });

  test("a symbolic link, a missing file or a lying signature is a 404, never a 500", async () => {
    const link = served((dir) => {
      writeFileSync(join(dir, "real.glb"), GLB);
      symlinkSync(join(dir, "real.glb"), join(dir, "robot.glb"));
    });
    expect((await get(link, `/f/${T}/robot.glb`)).status).toBe(404);
    const missing = served(() => {});
    expect((await get(missing, `/f/${T}/robot.glb`)).status).toBe(404);
    const lying = served((dir) => writeFileSync(join(dir, "robot.glb"), PNG));
    expect((await get(lying, `/f/${T}/robot.glb`)).status).toBe(404);
    const folder = served(() => {}, { file: "." });
    expect((await get(folder, `/f/${T}/robot.glb`)).status).toBe(404);
  });

  test("a failing lookup is a 404 and is logged without the request", async () => {
    const logged: unknown[][] = [];
    const spy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    try {
      const s = start(undefined, {
        open: async () => {
          throw new Error("disk gone");
        },
      });
      const res = await get(s, `/f/${T}/robot.glb`, { cookie: "kibo_session=secret-cookie" });
      expect(res.status).toBe(404);
      expect(JSON.stringify(logged.map((args) => args.map(String)))).toContain("disk gone");
      expect(JSON.stringify(logged.map((args) => args.map(String)))).not.toContain("secret-cookie");
    } finally {
      spy.mockRestore();
    }
  });

  test("without a file opener every token is a 404", async () => {
    expect((await get(start(), `/f/${T}/robot.glb`)).status).toBe(404);
  });
});
