import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { readDaemonInfo } from "./components/daemon-info";

async function readLines(proc: { stdout: ReadableStream<Uint8Array> }, n: number): Promise<string> {
  const reader = proc.stdout.getReader();
  let out = "";
  while (out.split("\n").length <= n) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  return out;
}

test("announces readiness with the pairing link, then the sandbox origin, on stdout only", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0"], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await readLines(proc, 2);
  const info = readDaemonInfo(home);
  proc.kill("SIGTERM");
  const code = await proc.exited;
  const err = await new Response(proc.stderr).text();
  const token = readFileSync(join(home, "token"), "utf8").trim();
  rmSync(home, { recursive: true, force: true });
  expect(out).toBe(
    `KIBO_READY http://127.0.0.1:${info?.port}/#pair=${token}\nKIBO_SANDBOX http://127.0.0.1:${info?.sandboxPort}\n`,
  );
  expect(err).not.toContain("KIBO_READY");
  expect(code).toBe(0);
});

test("a second main on the same home announces the first one and exits 3", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const first = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0"], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    const ready = await readLines(first, 2);
    const second = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0"], {
      env: { ...process.env, KIBO_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(second.stdout).text();
    expect(await second.exited).toBe(3);
    expect(out).toBe(`KIBO_REUSED\n${ready}`);
    expect(readDaemonInfo(home)?.pid).toBe(first.pid);
  } finally {
    first.kill("SIGTERM");
    await first.exited;
    rmSync(home, { recursive: true, force: true });
  }
}, 30_000);

test("a start failure is announced on stdout as KIBO_FATAL before exiting 1", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const mute = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Promise<Response>(() => {}) });
  try {
    writeFileSync(
      join(home, "daemon.json"),
      JSON.stringify({ port: mute.port, sandboxPort: 0, pid: 99_999 }),
    );
    const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0"], {
      env: { ...process.env, KIBO_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(1);
    expect(out).toMatch(
      /^KIBO_FATAL DAEMON_RUNNING another daemon \(pid 99999\) holds .* and does not answer\n$/,
    );
    expect(err).toContain("[kibo-daemon] cannot start: another daemon (pid 99999)");
  } finally {
    mute.stop(true);
    rmSync(home, { recursive: true, force: true });
  }
}, 30_000);

test("stops when its parent process disappears", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const parentScript = `
    const daemon = Bun.spawn(["bun", ${JSON.stringify(join(import.meta.dir, "main.ts"))}, "--port", "0"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const reader = daemon.stdout.getReader();
    let out = "";
    while (!out.includes("\\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      out += new TextDecoder().decode(value);
    }
    process.stdout.write(String(daemon.pid));
    process.exit(0);
  `;
  const parent = Bun.spawn(["bun", "-e", parentScript], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
  });
  const pid = Number(await new Response(parent.stdout).text());
  await parent.exited;
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const deadline = Date.now() + 5000;
  while (alive() && Date.now() < deadline) await Bun.sleep(100);
  const stillAlive = alive();
  if (stillAlive) process.kill(pid, "SIGKILL");
  rmSync(home, { recursive: true, force: true });
  expect(pid).toBeGreaterThan(0);
  expect(stillAlive).toBe(false);
}, 10000);

test("tells the ui to leave notifications to the desktop shell", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const proc = Bun.spawn(
    ["bun", join(import.meta.dir, "main.ts"), "--port", "0", "--claude-bin", "/nonexistent/claude"],
    { env: { ...process.env, KIBO_HOME: home, KIBO_NATIVE_NOTIFY: "1" }, stdout: "pipe", stderr: "pipe" },
  );
  const reader = proc.stdout.getReader();
  let out = "";
  while (!out.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  const [, origin = "", token = ""] = /^KIBO_READY (\S+)\/#pair=(\w+)\n/.exec(out) ?? [];
  const headers = { "content-type": "application/json", origin };
  const paired = await fetch(`${origin}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res = await fetch(`${origin}/api/rpc`, {
    method: "POST",
    headers: { ...headers, cookie },
    body: JSON.stringify({ method: "getSession" }),
  });
  const session = await res.json();
  proc.kill("SIGTERM");
  const code = await proc.exited;
  rmSync(home, { recursive: true, force: true });
  expect(session).toMatchObject({ ok: true, result: { notifications: "native" } });
  expect(code).toBe(0);
});

test("accepts the sandbox port and toolchain options", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const args = ["--port", "0", "--sandbox-port", "0", "--toolchain", DEV_TOOLCHAIN.root];
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), ...args], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = proc.stdout.getReader();
  let out = "";
  while (!out.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  const info = readDaemonInfo(home);
  proc.kill("SIGTERM");
  const code = await proc.exited;
  const left = readDaemonInfo(home);
  rmSync(home, { recursive: true, force: true });
  expect(out).toStartWith(`KIBO_READY http://127.0.0.1:${info?.port}/`);
  expect(info?.sandboxPort).toBeGreaterThan(0);
  expect(info?.pid).toBe(proc.pid);
  expect(left).toBeNull();
  expect(code).toBe(0);
});

test("an invalid toolchain stops the start with a clear message", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const missing = join(home, "no-toolchain");
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0", "--toolchain", missing], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const info = readDaemonInfo(home);
  rmSync(home, { recursive: true, force: true });
  expect(code).not.toBe(0);
  expect(out).not.toContain("KIBO_READY");
  expect(out).toMatch(/^KIBO_FATAL NOT_FOUND toolchain not found in /);
  expect(err).toContain(`[kibo-daemon] cannot start: toolchain not found in ${missing}`);
  expect(info).toBeNull();
});

test("refuses in-memory secrets outside test mode", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0", "--memory-secrets"], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  const err = await new Response(proc.stderr).text();
  rmSync(home, { recursive: true, force: true });
  expect(code).toBe(1);
  expect(err).toContain("--memory-secrets requires --test-origins");
});

test("refuses test origins without in-memory secrets", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const args = ["--port", "0", "--test-origins", "api.github.com=http://127.0.0.1:4391"];
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), ...args], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  const err = await new Response(proc.stderr).text();
  rmSync(home, { recursive: true, force: true });
  expect(code).toBe(1);
  expect(err).toContain("--test-origins requires --memory-secrets");
});
