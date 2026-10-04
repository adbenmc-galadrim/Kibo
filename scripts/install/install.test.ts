import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "install.sh");
const TEMPLATE = readFileSync(join(import.meta.dir, "fixtures/SHA256SUMS.template"), "utf8");
const APPIMAGE_NAME = "Kibo_1.5.0_amd64.AppImage";
const appimage = new TextEncoder().encode("#!/bin/sh\necho kibo\n");
const icon = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sum = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

function serve(tamper = false) {
  const sums = TEMPLATE.replace("{{APPIMAGE}}", tamper ? "0".repeat(64) : sum(appimage)).replace(
    "{{ICON}}",
    sum(icon),
  );
  return Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/SHA256SUMS") return new Response(sums);
      if (path === `/${APPIMAGE_NAME}`) return new Response(appimage);
      if (path === "/icon-512.png") return new Response(icon);
      return new Response("not found", { status: 404 });
    },
  });
}

function tempHome() {
  return mkdtempSync(join(tmpdir(), "kibo-install-"));
}

async function run(server: ReturnType<typeof serve>, home: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(["bash", SCRIPT], {
    env: {
      ...process.env,
      TMPDIR: home,
      KIBO_INSTALL_BASE_URL: `http://127.0.0.1:${server.port}`,
      KIBO_INSTALL_HOME: home,
      KIBO_INSTALL_FORMAT: "appimage",
      KIBO_INSTALL_ARCH: "x86_64",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out, err };
}

test("installs the AppImage, a desktop file and an icon when the checksum matches", async () => {
  const server = serve();
  const home = tempHome();
  const r = await run(server, home);
  server.stop();
  expect(r.code).toBe(0);
  const bin = join(home, ".local/bin/kibo");
  expect(statSync(bin).mode & 0o111).not.toBe(0);
  expect(readFileSync(bin)).toEqual(Buffer.from(appimage));
  expect(readFileSync(join(home, ".local/share/applications/kibo.desktop"), "utf8")).toContain(`Exec=${bin}`);
  expect(existsSync(join(home, ".local/share/icons/hicolor/512x512/apps/kibo.png"))).toBe(true);
  expect(r.out).toContain("Kibo 1.5.0 installé");
});

test("refuses a tampered checksum and installs nothing", async () => {
  const server = serve(true);
  const home = tempHome();
  const r = await run(server, home);
  server.stop();
  expect(r.code).toBe(1);
  expect(r.err).toContain("La somme de contrôle ne correspond pas");
  expect(existsSync(join(home, ".local/bin/kibo"))).toBe(false);
  expect(existsSync(join(home, ".local/share/applications"))).toBe(false);
});

test("refuses an unsupported architecture before downloading", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch() {
      requests++;
      return new Response("not found", { status: 404 });
    },
  });
  const home = tempHome();
  const r = await run(server, home, { KIBO_INSTALL_ARCH: "aarch64" });
  server.stop();
  expect(r.code).toBe(1);
  expect(r.err).toContain("aarch64");
  expect(requests).toBe(0);
});
