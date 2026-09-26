import { KiboError } from "@kibo/schema";
import { signalGroup } from "../process-group";

export type Env = Record<string, string>;
export type RunResult = { code: number; stdout: string; bytes: Uint8Array; stderr: string };
type FailCode = "GIT_FAILED" | "GH_UNAVAILABLE";
export type RunOptions = {
  cwd: string;
  stdin?: string;
  env?: Env;
  timeoutMs?: number;
  failCode?: FailCode;
};
export type GitRunOptions = { stdin?: string; env?: Env; timeoutMs?: number };
export type Git = {
  root: string;
  env: Env;
  run(args: string[], opts?: GitRunOptions): Promise<RunResult>;
  ok(args: string[], opts?: GitRunOptions): Promise<string>;
};

export const READ_TIMEOUT_MS = 30_000;
export const WRITE_TIMEOUT_MS = 300_000;
export const NETWORK_TIMEOUT_MS = 120_000;
export const MAX_STDOUT_BYTES = 50_000_000;
export const MAX_STDERR_BYTES = 1_000_000;

const DEFAULT_ENV: Env = {
  GIT_EDITOR: "true",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  NO_COLOR: "1",
};

const NO_PROMPT_ENV: Env = {
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  GH_PROMPT_DISABLED: "1",
};

const INHERITED_REPOSITORY_VARS = new Set([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
]);

export function firstLine(text: string): string {
  return text.trim().split("\n")[0]?.trim() ?? "";
}

function inheritedEnv(): Env {
  const env: Env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !INHERITED_REPOSITORY_VARS.has(key)) env[key] = value;
  }
  return env;
}

function spawn(cmd: string[], opts: RunOptions) {
  return Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...inheritedEnv(), ...DEFAULT_ENV, ...opts.env, ...NO_PROMPT_ENV },
    stdin: opts.stdin === undefined ? "ignore" : new TextEncoder().encode(opts.stdin),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
}

function start(cmd: string[], opts: RunOptions, failCode: FailCode) {
  try {
    return spawn(cmd, opts);
  } catch (e) {
    throw new KiboError(failCode, `cannot start ${cmd[0]}: ${String(e)}`);
  }
}

async function readCapped(
  stream: ReadableStream<Uint8Array>,
  max: number,
  onOverflow: (size: number) => KiboError,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > max) throw onOverflow(size);
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export async function run(cmd: string[], opts: RunOptions): Promise<RunResult> {
  const failCode = opts.failCode ?? "GIT_FAILED";
  const proc = start(cmd, opts, failCode);
  const label = `${cmd[0]} ${cmd[1] ?? ""}`.trim();
  const killAll = () => signalGroup(proc.pid, "SIGKILL");
  const overflow = (name: string, max: number) => (size: number) => {
    killAll();
    return new KiboError("TOO_LARGE", `${label} wrote more than ${max} bytes on ${name} (${size} read)`);
  };
  const collected = Promise.all([
    readCapped(proc.stdout, MAX_STDOUT_BYTES, overflow("stdout", MAX_STDOUT_BYTES)),
    readCapped(proc.stderr, MAX_STDERR_BYTES, overflow("stderr", MAX_STDERR_BYTES)),
    proc.exited,
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      killAll();
      reject(new KiboError(failCode, `${label} timed out`));
    }, opts.timeoutMs ?? READ_TIMEOUT_MS);
  });
  try {
    const [bytes, stderr, code] = await Promise.race([collected, timeout]);
    const decoder = new TextDecoder();
    return { code, stdout: decoder.decode(bytes), bytes, stderr: decoder.decode(stderr) };
  } finally {
    clearTimeout(timer);
  }
}

export function createGit(root: string, env: Env = {}): Git {
  const binary = env.KIBO_GIT ?? process.env.KIBO_GIT ?? "git";
  const exec = (args: string[], opts: GitRunOptions = {}) =>
    run([binary, ...args], {
      cwd: root,
      env: { ...env, ...opts.env },
      stdin: opts.stdin,
      timeoutMs: opts.timeoutMs,
    });
  return {
    root,
    env,
    run: exec,
    async ok(args, opts) {
      const r = await exec(args, opts);
      if (r.code !== 0)
        throw new KiboError("GIT_FAILED", `git ${args[0]}: ${firstLine(r.stderr) || `exit ${r.code}`}`);
      return r.stdout;
    },
  };
}

export function runGh(args: string[], opts: { cwd: string; env: Env; stdin?: string }): Promise<RunResult> {
  const binary = opts.env.KIBO_GH ?? process.env.KIBO_GH ?? "gh";
  return run([binary, ...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdin: opts.stdin,
    timeoutMs: NETWORK_TIMEOUT_MS,
    failCode: "GH_UNAVAILABLE",
  });
}
