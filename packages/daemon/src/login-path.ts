import { userInfo } from "node:os";
import { runBounded } from "./agents/bounded-process";

export const LOGIN_PATH_TIMEOUT_MS = 3000;
export const LOGIN_PATH_MARKERS = { start: "__KIBO_PATH_START__", end: "__KIBO_PATH_END__" };
const LAUNCHD_DIRS = new Set(["/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
const SCRIPT = `printf '%s%s%s' '${LOGIN_PATH_MARKERS.start}' "$PATH" '${LOGIN_PATH_MARKERS.end}'`;

export type LoginShellRun = { shell: string; args: string[]; script: string; timeoutMs: number };
export type LoginShellRunner = (
  run: LoginShellRun,
) => Promise<{ code: number; stdout: string; timedOut: boolean }>;
export type LoginPathOptions = {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  run: LoginShellRunner;
  log: (line: string) => void;
  userShell?: string | null;
};

const entries = (path: string) => path.split(":").filter((dir) => dir.length > 0);

export function looksLikeLaunchdPath(path: string | undefined): boolean {
  return entries(path ?? "").every((dir) => LAUNCHD_DIRS.has(dir));
}

export function mergePaths(front: string, current: string): string {
  return [...new Set([...entries(front), ...entries(current)])].join(":");
}

function between(output: string): string | null {
  const from = output.lastIndexOf(LOGIN_PATH_MARKERS.start);
  const to = output.lastIndexOf(LOGIN_PATH_MARKERS.end);
  if (from < 0 || to < from) return null;
  const path = output.slice(from + LOGIN_PATH_MARKERS.start.length, to).trim();
  return path.length > 0 ? path : null;
}

function defaultUserShell(): string | null {
  try {
    return userInfo().shell;
  } catch {
    return null;
  }
}

export const runLoginShell: LoginShellRunner = async ({ shell, args, timeoutMs }) => {
  const res = await runBounded([shell, ...args], { cwd: userInfo().homedir, env: process.env, timeoutMs });
  return { code: res.code, stdout: res.stdout, timedOut: res.timedOut };
};

async function readLoginPath(opts: LoginPathOptions, shell: string): Promise<string> {
  const run = { shell, args: ["-ilc", SCRIPT], script: SCRIPT, timeoutMs: LOGIN_PATH_TIMEOUT_MS };
  const res = await opts.run(run);
  if (res.timedOut) throw new Error(`${shell} took more than ${LOGIN_PATH_TIMEOUT_MS / 1000}s`);
  const path = between(res.stdout);
  if (path !== null) return path;
  throw new Error(res.code === 0 ? `${shell} printed no PATH` : `${shell} exited with ${res.code}`);
}

export async function loginShellPath(opts: LoginPathOptions): Promise<string | null> {
  const current = opts.env.PATH;
  if (opts.platform !== "darwin" || !looksLikeLaunchdPath(current)) return null;
  const shell = opts.env.SHELL || (opts.userShell === undefined ? defaultUserShell() : opts.userShell);
  try {
    if (!shell?.startsWith("/")) throw new Error("no login shell");
    const merged = mergePaths(await readLoginPath(opts, shell), current ?? "");
    opts.log(`[kibo-daemon] PATH completed from the login shell: ${merged}`);
    return merged;
  } catch (e) {
    opts.log(
      `[kibo-daemon] login shell PATH unavailable, keeping ${current ?? "(none)"}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
