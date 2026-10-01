import { dirname, join } from "node:path";
import { KiboError, USED_MARKER, type ValidationReport } from "@kibo/schema";
import { type BunCommand, bunCommand } from "./bun-command";
import { FR_DEVKIT } from "./fr";
import { type OsSandbox, osSandbox } from "./os-sandbox";
import type { Toolchain } from "./toolchain";

export type TestRunOptions = {
  toolchain: Toolchain;
  bun?: BunCommand;
  sandbox?: OsSandbox;
  timeoutMs?: number;
  signal?: AbortSignal;
  testFile?: string;
};
export type TestRun = { report: ValidationReport["tests"]; used: string[] | null };

const OUTPUT_LIMIT = 8_000;
export const DEFAULT_TIMEOUT_MS = 120_000;

function countOf(xml: string, attr: string): number {
  const match = xml.match(new RegExp(`<testsuites[^>]*\\b${attr}="(\\d+)"`));
  return Number(match?.[1] ?? 0);
}

function markerPayload(line: string): unknown[] | null {
  const at = line.indexOf(USED_MARKER);
  if (at < 0) return null;
  try {
    const parsed: unknown = JSON.parse(line.slice(at + USED_MARKER.length));
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function usedPermissions(output: string): string[] | null {
  const used = new Set<string>();
  let sawMarker = false;
  for (const line of output.split("\n")) {
    const payload = markerPayload(line);
    if (payload === null) continue;
    sawMarker = true;
    for (const p of payload) if (typeof p === "string") used.add(p);
  }
  return sawMarker ? [...used].sort() : null;
}

async function readJunit(path: string): Promise<string> {
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : "";
}

export function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new KiboError("INTERNAL", "validation aborted");
}

async function sandboxReady(sandbox: OsSandbox): Promise<string | null> {
  try {
    await sandbox.ready();
    return null;
  } catch (e) {
    if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return e.detail;
    throw e;
  }
}

export async function runComponentTests(copy: string, opts: TestRunOptions): Promise<TestRun> {
  const sandbox = opts.sandbox ?? osSandbox();
  const unavailable = await sandboxReady(sandbox);
  if (unavailable !== null) {
    const output = FR_DEVKIT.sandboxUnavailable(unavailable);
    return { report: { ok: false, passed: 0, failed: 0, output }, used: null };
  }
  const bun = opts.bun ?? bunCommand();
  const base = dirname(copy);
  const junit = join(base, "junit.xml");
  const preload = (name: string) => Bun.resolveSync(`@kibo/devkit/preload/${name}`, opts.toolchain.root);
  const argv = [
    ...bun.argv,
    "test",
    "--preload",
    preload("happydom"),
    "--preload",
    preload("restrict"),
    "--reporter=junit",
    `--reporter-outfile=${junit}`,
    ...(opts.testFile === undefined ? [] : [opts.testFile]),
  ];
  assertNotAborted(opts.signal);
  const policy = { read: [opts.toolchain.root, base], write: [base], exec: bun.argv.slice(0, 1), cwd: copy };
  const proc = Bun.spawn(sandbox.wrap(argv, policy), {
    cwd: copy,
    env: { ...bun.env, PATH: process.env.PATH ?? "", HOME: base, TMPDIR: base, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const abort = () => proc.kill();
  opts.signal?.addEventListener("abort", abort, { once: true });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).finally(() => {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abort);
  });
  assertNotAborted(opts.signal);
  const output = `${stdout}\n${stderr}`;
  const xml = await readJunit(junit);
  const total = countOf(xml, "tests");
  const failures = countOf(xml, "failures") + countOf(xml, "errors");
  const shown = timedOut ? `${FR_DEVKIT.timeout(timeoutMs / 1000)}\n${output}` : output;
  return {
    report: {
      ok: !timedOut && code === 0 && total > 0 && failures === 0,
      passed: total - failures,
      failed: timedOut ? Math.max(1, failures) : failures,
      output: shown.slice(-OUTPUT_LIMIT),
    },
    used: usedPermissions(output),
  };
}
