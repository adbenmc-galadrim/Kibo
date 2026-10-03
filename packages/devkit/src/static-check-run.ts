import { dirname } from "node:path";
import { KiboError } from "@kibo/schema";
import { type BunCommand, bunCommand } from "./bun-command";
import { FR_DEVKIT } from "./fr";
import { issueAt } from "./issues";
import { StaticCheck, StaticCheckStep } from "./static-check";
import type { Toolchain } from "./toolchain";
import { assertNotAborted, DEFAULT_TIMEOUT_MS } from "./validate-tests";

export type StaticCheckOptions = {
  toolchain: Toolchain;
  bun?: BunCommand;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const STDERR_LIMIT = 2_000;

const SKIPPED_INFERENCE = { used: [], issues: [issueAt("kibo.component.json", 0, "inference-skipped", "")] };

function parseStep(line: string, lenient: boolean): StaticCheckStep | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    if (lenient) return null;
  }
  const parsed = StaticCheckStep.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (lenient) return null;
  throw new KiboError("INTERNAL", "static check returned an invalid report");
}

function collectSteps(stdout: string, lenient: boolean): StaticCheckStep {
  const steps: StaticCheckStep = {};
  for (const line of stdout.split("\n").filter((l) => l.trim() !== ""))
    Object.assign(steps, parseStep(line, lenient));
  return steps;
}

const completeReport = (stdout: string, timeoutMs: number): StaticCheck => {
  const steps = collectSteps(stdout, true);
  return {
    imports: steps.imports ?? [],
    typecheck: steps.typecheck ?? [FR_DEVKIT.typecheckTimeout(timeoutMs / 1000)],
    inference: steps.inference ?? SKIPPED_INFERENCE,
  };
};

function fullReport(stdout: string): StaticCheck {
  const parsed = StaticCheck.safeParse(collectSteps(stdout, false));
  if (!parsed.success) throw new KiboError("INTERNAL", "static check returned an invalid report");
  return parsed.data;
}

export async function runStaticCheck(
  copy: string,
  files: string[],
  opts: StaticCheckOptions,
): Promise<StaticCheck> {
  assertNotAborted(opts.signal);
  const bun = opts.bun ?? bunCommand();
  const base = dirname(copy);
  const script = Bun.resolveSync("@kibo/devkit/static-check", opts.toolchain.root);
  const proc = Bun.spawn([...bun.argv, script, opts.toolchain.root, copy], {
    cwd: base,
    env: { ...bun.env, PATH: process.env.PATH ?? "", HOME: base, TMPDIR: base, NO_COLOR: "1" },
    stdin: new Blob([JSON.stringify(files)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stop = () => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    stop();
  }, timeoutMs);
  opts.signal?.addEventListener("abort", stop, { once: true });
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    assertNotAborted(opts.signal);
    if (expired) return completeReport(stdout, timeoutMs);
    if (code !== 0)
      throw new KiboError("INTERNAL", `static check exited with ${code}: ${stderr.slice(-STDERR_LIMIT)}`);
    return fullReport(stdout);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", stop);
    stop();
  }
}
