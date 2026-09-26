import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bwrapArgv, createOsSandbox, macosProfile } from "./os-sandbox";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
};

const policy = {
  read: ["/opt/kibo/toolchain"],
  write: ["/tmp/kibo-work"],
  exec: ["/opt/kibo/bin/kibo-daemon"],
  cwd: "/tmp/kibo-work",
};

describe("profiles", () => {
  test("macOS denies by default, denies the network and only writes the work folder", () => {
    const profile = macosProfile(policy);
    expect(profile).toContain("(deny default)");
    expect(profile).toContain("(deny network*)");
    expect(profile).toContain('(allow process-exec (literal "/opt/kibo/bin/kibo-daemon"))');
    expect(profile).toContain('(subpath "/opt/kibo/toolchain")');
    expect(profile).toContain('(allow file-write* (literal "/dev/null") (subpath "/tmp/kibo-work"))');
    expect(profile).not.toContain(process.env.HOME ?? "/nonexistent-home");
  });
  test("a quote in a path is refused rather than escaped", () => {
    expect(() => macosProfile({ ...policy, read: ['/tmp/a"b'] })).toThrow("INTERNAL");
  });
  test("bubblewrap unshares everything and binds only the policy", () => {
    const argv = bwrapArgv("/usr/bin/bwrap", policy, ["/opt/kibo/bin/kibo-daemon", "component-runtime"]);
    expect(argv.slice(0, 2)).toEqual(["/usr/bin/bwrap", "--unshare-all"]);
    expect(argv).toContain("--die-with-parent");
    expect(argv.join(" ")).toContain("--ro-bind /opt/kibo/toolchain /opt/kibo/toolchain");
    expect(argv.join(" ")).toContain("--ro-bind /opt/kibo/bin/kibo-daemon /opt/kibo/bin/kibo-daemon");
    expect(argv.join(" ")).not.toContain("/opt/kibo/bin /opt/kibo/bin");
    expect(argv.join(" ")).not.toMatch(/--ro-bind(-try)? \/usr \/usr /);
    expect(argv.join(" ")).toContain("--bind /tmp/kibo-work /tmp/kibo-work");
    expect(argv.slice(-3)).toEqual(["--", "/opt/kibo/bin/kibo-daemon", "component-runtime"]);
  });
  test("no sandbox on the platform means SANDBOX_UNAVAILABLE, never an unsandboxed command", () => {
    expect(() =>
      createOsSandbox({ platform: "linux", which: () => null }).wrap(["/bin/true"], policy),
    ).toThrow("SANDBOX_UNAVAILABLE");
    expect(() => createOsSandbox({ platform: "win32" }).wrap(["/bin/true"], policy)).toThrow(
      "SANDBOX_UNAVAILABLE",
    );
  });
});

test("on this machine the sandbox blocks reads, writes, processes and the network outside the policy", async () => {
  const sandbox = createOsSandbox();
  await sandbox.ready();
  const secret = temp("kibo-secret-");
  writeFileSync(join(secret, "token"), "s3cret");
  const work = temp("kibo-work-");
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("open") });
  const script = `
const load = (() => 0).constructor("s", "return import(s)");
const out = {};
const attempt = async (name, fn) => { try { await fn(); out[name] = "open"; } catch (e) { out[name] = "blocked"; } };
const fs = await load("node:fs");
await attempt("read", () => fs.readFileSync(${JSON.stringify(join(secret, "token"))}, "utf8"));
await attempt("write", () => fs.writeFileSync(${JSON.stringify(join(secret, "pwned"))}, "x"));
const cp = await load("node:child_process");
await attempt("spawn", () => cp.execFileSync("/bin/echo", ["x"]));
await attempt("spawnUsr", () => cp.execFileSync("/usr/bin/echo", ["x"]));
await attempt("child", () => cp.execFileSync(process.execPath, ["-e", ${JSON.stringify(`require("node:fs").readFileSync(${JSON.stringify(join(secret, "token"))})`)}], { stdio: "ignore" }));
await attempt("connect", () => fetch("http://127.0.0.1:${listener.port}/"));
await attempt("inside", () => fs.writeFileSync("inside", "x"));
console.log(JSON.stringify(out));
`;
  try {
    const argv = sandbox.wrap([process.execPath, "-e", script], {
      read: [],
      write: [work],
      exec: [process.execPath],
      cwd: work,
    });
    const proc = Bun.spawn(argv, { cwd: work, env: {}, stdout: "pipe", stderr: "pipe" });
    const out: unknown = JSON.parse((await new Response(proc.stdout).text()).trim());
    expect(out).toEqual({
      read: "blocked",
      write: "blocked",
      spawn: "blocked",
      spawnUsr: "blocked",
      child: "blocked",
      connect: "blocked",
      inside: "open",
    });
    expect(existsSync(join(secret, "pwned"))).toBe(false);
  } finally {
    listener.stop(true);
  }
}, 30_000);
