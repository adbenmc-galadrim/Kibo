import { expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "install.sh");
const TEMPLATE = readFileSync(join(import.meta.dir, "fixtures/SHA256SUMS.template"), "utf8");
const encode = (text: string) => new TextEncoder().encode(text);
const ASSETS: Record<string, Uint8Array<ArrayBuffer>> = {
  "Kibo_1.5.0_amd64.AppImage": encode("#!/bin/sh\necho kibo\n"),
  "Kibo_1.5.0_amd64.deb": encode("deb"),
  "Kibo-1.5.0-1.x86_64.rpm": encode("rpm"),
  "icon-512.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};
const sum = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

type Server = { port: number; requests: string[]; stop: () => void };

function serve(tampered: string[] = []): Server {
  const sums = Object.entries(ASSETS).reduce(
    (text, [name, bytes]) =>
      text.replace(`{{${name}}}`, tampered.includes(name) ? "0".repeat(64) : sum(bytes)),
    TEMPLATE,
  );
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const name = new URL(req.url).pathname.slice(1);
      requests.push(name);
      if (name === "SHA256SUMS") return new Response(sums);
      const bytes = ASSETS[name];
      return bytes ? new Response(bytes) : new Response("not found", { status: 404 });
    },
  });
  return { port: server.port ?? 0, requests, stop: () => server.stop() };
}

function tempHome() {
  return mkdtempSync(join(tmpdir(), "kibo-install-"));
}

async function run(server: Server, home: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(["bash", SCRIPT], {
    env: {
      ...process.env,
      TMPDIR: home,
      KIBO_INSTALL_BASE_URL: `http://127.0.0.1:${server.port}`,
      KIBO_INSTALL_ALLOW_HTTP: "1",
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

function fakeTools(home: string) {
  const bin = join(home, "fake-bin");
  const log = join(home, "calls.log");
  mkdirSync(bin);
  const tools = {
    sudo: `echo "sudo $*" >> "${log}"\n"$@"`,
    "apt-get": `echo "apt-get $*" >> "${log}"`,
    dpkg: "exit 0",
    dnf: `echo "dnf $*" >> "${log}"`,
  };
  for (const [name, body] of Object.entries(tools)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const calls = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
  return { path: `${bin}:${process.env.PATH}`, calls };
}

test("installs the AppImage, a desktop file and an icon when the checksum matches", async () => {
  const server = serve();
  const home = tempHome();
  const r = await run(server, home);
  server.stop();
  expect(r.code).toBe(0);
  const bin = join(home, ".local/bin/kibo");
  expect(statSync(bin).mode & 0o111).not.toBe(0);
  expect(readFileSync(bin)).toEqual(Buffer.from(ASSETS["Kibo_1.5.0_amd64.AppImage"] ?? []));
  expect(readFileSync(join(home, ".local/share/applications/kibo.desktop"), "utf8")).toContain(`Exec=${bin}`);
  expect(existsSync(join(home, ".local/share/icons/hicolor/512x512/apps/kibo.png"))).toBe(true);
  expect(r.out).toContain("Kibo 1.5.0 installé");
});

test("refuses a tampered checksum and installs nothing", async () => {
  const server = serve(["Kibo_1.5.0_amd64.AppImage"]);
  const home = tempHome();
  const r = await run(server, home);
  server.stop();
  expect(r.code).toBe(1);
  expect(r.err).toContain("La somme de contrôle ne correspond pas");
  expect(existsSync(join(home, ".local/bin/kibo"))).toBe(false);
  expect(existsSync(join(home, ".local/share/applications"))).toBe(false);
});

test("refuses an unsupported architecture before downloading", async () => {
  const server = serve();
  const r = await run(server, tempHome(), { KIBO_INSTALL_ARCH: "aarch64" });
  server.stop();
  expect(r.code).toBe(1);
  expect(r.err).toContain("aarch64");
  expect(server.requests).toEqual([]);
});

test("refuses a plain http base url unless explicitly allowed for a local host", async () => {
  const server = serve();
  const home = tempHome();
  const denied = await run(server, home, { KIBO_INSTALL_ALLOW_HTTP: "" });
  const remote = await run(server, home, { KIBO_INSTALL_BASE_URL: "http://example.com/kibo" });
  const disguised = await run(server, home, {
    KIBO_INSTALL_BASE_URL: "http://127.0.0.1:80@example.com/kibo",
  });
  server.stop();
  expect(disguised.code).toBe(1);
  expect(disguised.err).toContain("https://");
  expect(denied.code).toBe(1);
  expect(denied.err).toContain("https://");
  expect(remote.code).toBe(1);
  expect(remote.err).toContain("https://");
  expect(server.requests).toEqual([]);
});

test("rejects a version that is not a plain version number", async () => {
  const server = serve();
  const home = tempHome();
  const traversal = await run(server, home, { KIBO_INSTALL_VERSION: "../1.5.0" });
  const dots = await run(server, home, { KIBO_INSTALL_VERSION: "1..5" });
  server.stop();
  expect(traversal.code).toBe(1);
  expect(traversal.err).toContain("version invalide");
  expect(dots.code).toBe(1);
  expect(dots.err).toContain("version invalide");
  expect(server.requests).toEqual([]);
});

test("installs the detected deb through an announced sudo apt-get", async () => {
  const server = serve();
  const home = tempHome();
  const tools = fakeTools(home);
  const r = await run(server, home, { PATH: tools.path, KIBO_INSTALL_FORMAT: "" });
  server.stop();
  expect(r.code).toBe(0);
  expect(r.err).toContain("sudo apt-get install");
  expect(tools.calls()).toMatch(
    /^sudo apt-get install -y \/.*\/Kibo_1\.5\.0_amd64\.deb\napt-get install -y /,
  );
  expect(r.out).toContain("Kibo 1.5.0 installé (deb)");
});

test("never calls sudo when the rpm checksum does not match", async () => {
  const server = serve(["Kibo-1.5.0-1.x86_64.rpm"]);
  const home = tempHome();
  const tools = fakeTools(home);
  const r = await run(server, home, { PATH: tools.path, KIBO_INSTALL_FORMAT: "rpm" });
  server.stop();
  expect(r.code).toBe(1);
  expect(r.err).toContain("La somme de contrôle ne correspond pas");
  expect(tools.calls()).toBe("");
});

function serveAlpha(version: string): Server {
  const assets: Record<string, Uint8Array<ArrayBuffer>> = {
    [`Kibo_${version}_amd64.AppImage`]: encode("#!/bin/sh\necho kibo alpha\n"),
    [`Kibo_${version}_amd64.deb`]: encode("deb alpha"),
    [`Kibo-${version}-1.x86_64.rpm`]: encode("rpm alpha"),
    "icon-512.png": encode("png"),
  };
  const sums = Object.entries(assets)
    .map(([name, bytes]) => `${sum(bytes)}  ${name}`)
    .join("\n");
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const name = new URL(req.url).pathname.slice(1);
      requests.push(name);
      if (name === "SHA256SUMS") return new Response(`${sums}\n`);
      const bytes = assets[name];
      return bytes ? new Response(bytes) : new Response("not found", { status: 404 });
    },
  });
  return { port: server.port ?? 0, requests, stop: () => server.stop() };
}

test("installs an alpha AppImage found in SHA256SUMS", async () => {
  const server = serveAlpha("0.16.0-alpha.1");
  const home = tempHome();
  const r = await run(server, home);
  server.stop();
  expect(r.code).toBe(0);
  expect(server.requests).toContain("Kibo_0.16.0-alpha.1_amd64.AppImage");
  expect(r.out).toContain("Kibo 0.16.0-alpha.1 installé (appimage)");
});

test("installs a requested alpha rpm and refuses any other suffix", async () => {
  const server = serveAlpha("0.16.0-alpha.2");
  const home = tempHome();
  const tools = fakeTools(home);
  const rpm = await run(server, home, {
    PATH: tools.path,
    KIBO_INSTALL_FORMAT: "rpm",
    KIBO_INSTALL_VERSION: "0.16.0-alpha.2",
  });
  const beta = await run(server, home, { KIBO_INSTALL_VERSION: "0.16.0-beta.1" });
  server.stop();
  expect(rpm.code).toBe(0);
  expect(tools.calls()).toContain("Kibo-0.16.0-alpha.2-1.x86_64.rpm");
  expect(beta.code).toBe(1);
  expect(beta.err).toContain("version invalide");
});

test("downloads from the alpha release by default", () => {
  expect(readFileSync(SCRIPT, "utf8")).toContain(
    "KIBO_INSTALL_BASE_URL:-https://github.com/adbenmc-galadrim/Kibo/releases/download/alpha}",
  );
});
