import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { KiboError } from "@kibo/schema";
import { runBounded } from "./bounded-process";

type GitRunner = (
  args: string[],
  cwd: string,
  timeoutMs?: number,
) => Promise<{ code: number; stdout: string; stderr: string }>;

const gitEnv = (): Record<string, string | undefined> => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  SSH_ASKPASS: "",
  SSH_ASKPASS_REQUIRE: "never",
  GIT_SSH_COMMAND: `${process.env.GIT_SSH_COMMAND ?? "ssh"} -o BatchMode=yes`,
});

export const runGit: GitRunner = async (args, cwd, timeoutMs) => {
  const res = await runBounded(["git", ...args], { cwd, env: gitEnv(), timeoutMs });
  if (!res.timedOut) return { code: res.code, stdout: res.stdout, stderr: res.stderr };
  const code = res.code === 0 ? 1 : res.code;
  return {
    code,
    stdout: res.stdout,
    stderr: `git ${args[0]} timed out after ${(timeoutMs ?? 0) / 1000}s\n${res.stderr}`,
  };
};

const failed = (detail: string) => new KiboError("WORKSPACE_FAILED", detail);

export function writeRunContext(
  runDir: string,
  files: { path: string; content: string }[],
): { systemPromptFile: string; briefFile: string } {
  const root = resolve(runDir);
  const targets = files.map((f) => ({ file: resolve(root, f.path), content: f.content }));
  if (targets.some((t) => !t.file.startsWith(root + sep)))
    throw failed("context file outside the run folder");
  const systemPromptFile = join(root, "CLAUDE.md");
  const briefFile = join(root, "brief.md");
  const names = new Set(targets.map((t) => t.file));
  if (!names.has(systemPromptFile) || !names.has(briefFile))
    throw failed("CLAUDE.md and brief.md are required");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const t of targets) {
    mkdirSync(dirname(t.file), { recursive: true, mode: 0o700 });
    writeFileSync(t.file, t.content, { mode: 0o600 });
  }
  return { systemPromptFile, briefFile };
}
