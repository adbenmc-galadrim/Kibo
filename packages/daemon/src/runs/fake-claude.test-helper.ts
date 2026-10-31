import { afterEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAKE_CLAUDE } from "./fake-claude-scenario";

const dirs: string[] = [];

export const cleanFakeDirs = () =>
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

export const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-fake-"));
  dirs.push(d);
  return d;
};

const EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "StopFailure", "SessionEnd"];

export function settings(file: string): string {
  const command = `cat >> '${file}'; echo >> '${file}'`;
  const hooks = Object.fromEntries(
    EVENTS.map((e) => [
      e,
      [{ ...(e.endsWith("ToolUse") ? { matcher: "*" } : {}), hooks: [{ type: "command", command }] }],
    ]),
  );
  return JSON.stringify({ hooks });
}

export function start(args: string[], env: Record<string, string>, prompt = "Lis le brief.") {
  return Bun.spawn([FAKE_CLAUDE, "-p", "--output-format", "stream-json", "--verbose", ...args], {
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode(prompt),
    stdout: "pipe",
    stderr: "pipe",
  });
}

export async function finish(proc: ReturnType<typeof start>) {
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const lines = out
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { lines, err, code };
}

export const readHooks = (file: string) =>
  readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
