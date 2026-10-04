import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GLB, PNG } from "../files/files.test-helper";
import { type FileOpener, startSandboxServer } from "./sandbox-server";

const GOOD = "b".repeat(64);
const servers: { stop(): void }[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function served(body: Uint8Array, extra: { files?: FileOpener } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kibo-design-"));
  dirs.push(dir);
  const path = join(dir, "frame.png");
  writeFileSync(path, body);
  const designs: FileOpener = {
    open: async (token) =>
      token === GOOD ? { path, name: "frame.png", mime: "image/png", size: body.byteLength } : null,
  };
  const s = startSandboxServer({ port: 0, uiPort: 4317, assets: () => null, designs, ...extra });
  servers.push(s);
  return s;
}
const request = (s: { port: number }, path: string, method = "GET") =>
  fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { host: `127.0.0.1:${s.port}` } });

describe("design frames", () => {
  test("design frames are served by token", async () => {
    const s = served(PNG);
    const ok = await request(s, `/d/${GOOD}/frame.png`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("cache-control")).toBe("private, max-age=900");
    expect(ok.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);
    const head = await request(s, `/d/${GOOD}/frame.png`, "HEAD");
    expect(head.status).toBe(200);
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });

  test("a wrong name, an unknown token or another method is refused", async () => {
    const s = served(PNG);
    expect((await request(s, `/d/${GOOD}/frame.webp`)).status).toBe(404);
    expect((await request(s, `/d/${"0".repeat(64)}/frame.png`)).status).toBe(404);
    expect((await request(s, `/d/${GOOD}/frame.svg`)).status).toBe(404);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"])
      expect((await request(s, `/d/${GOOD}/frame.png`, method)).status).toBe(405);
  });

  test("a cached file that is not the announced image is a 404", async () => {
    expect((await request(served(GLB), `/d/${GOOD}/frame.png`)).status).toBe(404);
  });

  test("design tokens and project file tokens never cross", async () => {
    const s = served(PNG);
    expect((await request(s, `/f/${GOOD}/frame.png`)).status).toBe(404);
    const onlyFiles = startSandboxServer({
      port: 0,
      uiPort: 4317,
      assets: () => null,
      files: { open: async () => ({ path: "/nonexistent", name: "frame.png", mime: "image/png", size: 1 }) },
    });
    servers.push(onlyFiles);
    expect((await request(onlyFiles, `/d/${GOOD}/frame.png`)).status).toBe(404);
  });
});
