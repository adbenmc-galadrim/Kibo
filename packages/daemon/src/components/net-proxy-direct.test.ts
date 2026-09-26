import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proxyFetch } from "./net-proxy";
import { createDirectTransport } from "./net-proxy-transport";

const PROXY_VARS = ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy", "ALL_PROXY", "all_proxy"];
const CHILD = join(import.meta.dir, "net-proxy-direct-child.ts");
const GET = { method: "GET" as const, headers: {} };
const counts = { proxy: 0, silent: 0 };

const fakeProxy = Bun.listen({
  hostname: "127.0.0.1",
  port: 0,
  socket: {
    open(socket) {
      counts.proxy += 1;
      socket.end();
    },
    data() {},
  },
});
const silent = Bun.listen({
  hostname: "127.0.0.1",
  port: 0,
  socket: {
    open() {
      counts.silent += 1;
    },
    data() {},
  },
});

const certDir = mkdtempSync(join(tmpdir(), "kibo-net-proxy-"));
const certPath = join(certDir, "cert.pem");
const keyPath = join(certDir, "key.pem");
const openssl = Bun.spawnSync([
  "openssl",
  "req",
  "-x509",
  "-newkey",
  "ec",
  "-pkeyopt",
  "ec_paramgen_curve:prime256v1",
  "-nodes",
  "-keyout",
  keyPath,
  "-out",
  certPath,
  "-days",
  "1",
  "-subj",
  "/CN=api.kibo.test",
  "-addext",
  "subjectAltName=DNS:api.kibo.test",
]);
if (openssl.exitCode !== 0) throw new Error(`openssl failed: ${openssl.stderr.toString()}`);
const ca = readFileSync(certPath, "utf8");

const tlsServer = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { cert: readFileSync(certPath, "utf8"), key: readFileSync(keyPath, "utf8") },
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/redirect") return Response.redirect("/echo", 302);
    return Response.json({ host: req.headers.get("host"), path: url.pathname });
  },
});

afterAll(() => {
  fakeProxy.stop(true);
  silent.stop(true);
  tlsServer.stop(true);
  rmSync(certDir, { recursive: true, force: true });
});

const local = { resolve: async () => ["127.0.0.1"], allowAddress: () => true };
const trusted = { ...local, transport: createDirectTransport({ ca }) };

describe("direct transport", () => {
  test("the proxy connects directly even when proxy variables are set", async () => {
    counts.proxy = 0;
    const env: Record<string, string | undefined> = { ...process.env, NO_PROXY: "", no_proxy: "" };
    for (const name of PROXY_VARS) env[name] = `http://127.0.0.1:${fakeProxy.port}`;
    const child = Bun.spawn(["bun", CHILD, String(tlsServer.port), certPath], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(JSON.parse(stdout)).toEqual({ globalFetch: "error", trusted: "ok", defaultTransport: "INTERNAL" });
    expect(counts.proxy).toBe(1);
  });
  test("the certificate is checked against the requested host, not the pinned address", async () => {
    await expect(
      proxyFetch(null, `https://other.kibo.test:${tlsServer.port}/echo`, GET, trusted),
    ).rejects.toThrow("INTERNAL");
  });
  test("a server that never answers times out", async () => {
    counts.silent = 0;
    counts.proxy = 0;
    const slow = { ...trusted, timeoutMs: 100 };
    await expect(proxyFetch(null, `https://api.kibo.test:${silent.port}/echo`, GET, slow)).rejects.toThrow(
      "TIMEOUT",
    );
    expect(counts.silent).toBe(1);
    expect(counts.proxy).toBe(0);
  });
});
