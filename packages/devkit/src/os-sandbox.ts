import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { bunCommand } from "./bun-command";

export type SandboxPolicy = { read: string[]; write: string[]; exec: string[]; cwd: string };
export type SandboxKind = "bwrap" | "sandbox-exec";
export type SandboxDiagnosis = {
  kind: SandboxKind | null;
  available: boolean;
  reason: string | null;
  fix: string | null;
};
export type SandboxProbeRun = (
  argv: string[],
  opts: { cwd: string; env: Record<string, string> },
) => Promise<{ code: number; stderr: string }>;
export type OsSandbox = {
  ready(): Promise<void>;
  diagnose(): Promise<SandboxDiagnosis>;
  wrap(argv: string[], policy: SandboxPolicy): string[];
};
export type OsSandboxOptions = {
  platform?: NodeJS.Platform;
  which?: (bin: string) => string | null;
  exists?: (path: string) => boolean;
  run?: SandboxProbeRun;
};

export const BWRAP_FIX_INSTALL = "sudo apt install bubblewrap";
export const BWRAP_FIX_USERNS = "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0";
const USERNS_REFUSED = /namespace|uid map|Operation not permitted|Permission denied/i;

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const MACOS_SYSTEM = [
  "/usr/lib",
  "/usr/share/zoneinfo",
  "/System/Library",
  "/private/var/db/dyld",
  "/private/var/db/timezone",
];
const MACOS_LITERALS = ["/", "/dev/null", "/dev/random", "/dev/urandom", "/private/etc/localtime"];
const LINUX_SYSTEM = ["/usr/lib", "/usr/lib64", "/lib", "/lib64", "/usr/share/zoneinfo", "/etc/localtime"];

const real = (path: string): string => (existsSync(path) ? realpathSync(path) : path);
const unique = (paths: string[]): string[] => [...new Set(paths)];
const execDirs = (policy: SandboxPolicy): string[] => policy.exec.map((p) => dirname(real(p)));

function sbpl(path: string): string {
  if (/["\\\n]/.test(path)) throw new KiboError("INTERNAL", `path not allowed in a sandbox profile: ${path}`);
  return `"${path}"`;
}

export function macosProfile(policy: SandboxPolicy): string {
  const literal = (paths: string[]) => paths.map((p) => `(literal ${sbpl(p)})`).join(" ");
  const subpath = (paths: string[]) =>
    unique(paths.map(real))
      .map((p) => `(subpath ${sbpl(p)})`)
      .join(" ");
  const exec = unique(policy.exec.flatMap((p) => [p, real(p)]));
  return [
    "(version 1)",
    "(deny default)",
    `(allow process-exec ${literal(exec)})`,
    `(allow file-read* ${literal(MACOS_LITERALS)} ${subpath([...MACOS_SYSTEM, ...execDirs(policy), ...policy.read, ...policy.write])})`,
    "(allow file-read-metadata)",
    `(allow file-write* (literal "/dev/null") ${subpath(policy.write)})`,
    "(allow sysctl-read)",
    "(deny network*)",
  ].join("\n");
}

export function bwrapArgv(bwrap: string, policy: SandboxPolicy, argv: string[]): string[] {
  const bind = (flag: string, paths: string[]) => unique(paths).flatMap((p) => [flag, p, p]);
  return [
    bwrap,
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    ...bind("--ro-bind-try", LINUX_SYSTEM),
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    ...bind("--ro-bind", [...policy.exec, ...policy.read].map(real)),
    ...bind("--bind", policy.write.map(real)),
    "--chdir",
    real(policy.cwd),
    "--",
    ...argv,
  ];
}

const spawnProbe: SandboxProbeRun = async (argv, { cwd, env }) => {
  const proc = Bun.spawn(argv, { cwd, env, stdout: "ignore", stderr: "pipe" });
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  return { code, stderr };
};

const kindOf = (platform: NodeJS.Platform): SandboxKind | null =>
  platform === "darwin" ? "sandbox-exec" : platform === "linux" ? "bwrap" : null;

function fixFor(kind: SandboxKind, reason: string): string | null {
  if (kind !== "bwrap") return null;
  if (reason.includes("not installed")) return BWRAP_FIX_INSTALL;
  return USERNS_REFUSED.test(reason) ? BWRAP_FIX_USERNS : null;
}

function missingReason(platform: NodeJS.Platform): string {
  if (platform === "darwin") return "sandbox-exec is missing";
  if (platform === "linux") return "bubblewrap (bwrap) is not installed";
  return `no OS sandbox on ${platform}`;
}

export function createOsSandbox(opts: OsSandboxOptions = {}): OsSandbox {
  const platform = opts.platform ?? process.platform;
  const which = opts.which ?? Bun.which;
  const exists = opts.exists ?? existsSync;
  const run = opts.run ?? spawnProbe;
  let probe: Promise<void> | null = null;

  const wrap = (argv: string[], policy: SandboxPolicy): string[] => {
    const [head, ...rest] = argv;
    if (!head) throw new KiboError("INTERNAL", "empty sandboxed command");
    const command = [real(head), ...rest];
    if (platform === "darwin" && exists(SANDBOX_EXEC))
      return [SANDBOX_EXEC, "-p", macosProfile(policy), ...command];
    const bwrap = platform === "linux" ? which("bwrap") : null;
    if (bwrap) return bwrapArgv(bwrap, policy, command);
    throw new KiboError("SANDBOX_UNAVAILABLE", missingReason(platform));
  };

  const check = async (): Promise<void> => {
    const bun = bunCommand();
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "kibo-sandbox-probe-")));
    try {
      const argv = wrap([...bun.argv, "--version"], {
        read: [],
        write: [cwd],
        exec: bun.argv.slice(0, 1),
        cwd,
      });
      const { code, stderr } = await run(argv, { cwd, env: bun.env });
      if (code !== 0)
        throw new KiboError(
          "SANDBOX_UNAVAILABLE",
          `sandbox probe exited with ${code}: ${stderr.slice(0, 500)}`,
        );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  const ready = (): Promise<void> => {
    probe ??= check().catch((e: unknown) => {
      probe = null;
      throw e;
    });
    return probe;
  };

  const diagnose = async (): Promise<SandboxDiagnosis> => {
    const kind = kindOf(platform);
    if (kind === null) return { kind, available: false, reason: missingReason(platform), fix: null };
    try {
      await ready();
      return { kind, available: true, reason: null, fix: null };
    } catch (e) {
      if (!(e instanceof KiboError) || e.code !== "SANDBOX_UNAVAILABLE") throw e;
      return { kind, available: false, reason: e.detail, fix: fixFor(kind, e.detail) };
    }
  };

  return { wrap, ready, diagnose };
}

let shared: OsSandbox | null = null;

export function osSandbox(): OsSandbox {
  shared ??= createOsSandbox();
  return shared;
}
