import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import {
  type ComponentSummary,
  type ComponentVersionSummary,
  compareSemver,
  grantedOf,
  type IntegrationStatus,
  NO_PERMISSIONS,
  type PublishUsage,
  type RunView,
} from "@kibo/schema";
import type { TaskInput, ToolGuard } from "../agents/orchestrator-types";
import { BUILTIN_STARTERS } from "./builtin-starters";
import type {
  AgentRuns,
  CatalogEntry,
  Clock,
  Exec,
  Guard,
  PublishedComponent,
  RunEnd,
  RunState,
} from "./ports";

export type RunLike = Pick<RunView, "id" | "state" | "sessionId" | "output" | "error">;
export type RunSource = {
  submit(task: TaskInput): { id: string };
  cancel(runId: string): unknown;
  state(): { runs: RunLike[] };
  onRunState(listener: (run: RunLike) => void): () => void;
};

const CLI_ENTRY = join(import.meta.dir, "..", "..", "..", "cli", "src", "bin.ts");
const TERMINAL = new Set<RunState>(["done", "failed", "cancelled"]);

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

function resolveBin(bin: string, env: Record<string, string | undefined>): string | null {
  if (bin.includes("/")) return existsSync(bin) ? bin : null;
  return Bun.which(bin, { PATH: env.PATH ?? "" });
}

const LAUNCH_REFUSED = new Set(["ENOENT", "EACCES"]);

const isLaunchRefused = (e: unknown): boolean =>
  e instanceof Error && "code" in e && typeof e.code === "string" && LAUNCH_REFUSED.has(e.code);

function spawnOrNull(argv: string[], env: Record<string, string | undefined>) {
  try {
    return Bun.spawn(argv, {
      env: { ...env, NO_COLOR: "1" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (e) {
    if (isLaunchRefused(e)) return null;
    throw e;
  }
}

export function createExecPort(env: Record<string, string | undefined>): Exec {
  return async (argv, timeoutMs) => {
    const [bin, ...args] = argv;
    const resolved = bin ? resolveBin(bin, env) : null;
    const proc = resolved ? spawnOrNull([resolved, ...args], env) : null;
    if (!proc) return null;
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { code, stdout, stderr };
    } finally {
      clearTimeout(timer);
    }
  };
}

const toolGuard =
  (guard: Guard): ToolGuard =>
  ({ tool, input }) => {
    const d = guard({ toolName: tool, toolInput: input });
    return d.decision === "allow" ? { decision: "allow", reason: "" } : d;
  };

const toEnd = (run: RunLike): RunEnd => ({
  state: run.state === "done" ? "done" : run.state === "cancelled" ? "cancelled" : "failed",
  sessionId: run.sessionId,
  stdout: run.output ?? "",
  error: run.error,
});

export function runsFromOrchestrator(o: RunSource): AgentRuns {
  const find = (runId: string) => o.state().runs.find((r) => r.id === runId) ?? null;
  return {
    enqueue: (req) =>
      o.submit({
        profileId: req.profileId,
        projectId: null,
        title: req.label,
        cwd: req.cwd,
        prompt: req.prompt,
        extraArgs: req.args,
        env: req.env,
        ...(req.resumeSessionId !== null && { resumeSessionId: req.resumeSessionId }),
        guard: toolGuard(req.guard),
      }).id,
    cancel(runId) {
      const run = find(runId);
      if (run && !TERMINAL.has(run.state)) o.cancel(runId);
    },
    state: (runId) => find(runId)?.state ?? null,
    onState: (runId, listener) =>
      o.onRunState((run) => {
        if (run.id === runId) listener(run.state);
      }),
    onEnd(runId, listener) {
      const now = find(runId);
      if (now && TERMINAL.has(now.state)) {
        listener(toEnd(now));
        return () => {};
      }
      let fired = false;
      const off = o.onRunState((run) => {
        if (fired || run.id !== runId || !TERMINAL.has(run.state)) return;
        fired = true;
        off();
        listener(toEnd(run));
      });
      return off;
    },
  };
}

export function kiboShimArgv(opts: { compiled?: boolean; execPath?: string } = {}): string[] {
  const execPath = opts.execPath ?? process.execPath;
  return (opts.compiled ?? isCompiled()) ? [execPath] : [execPath, CLI_ENTRY];
}

export function writeKiboShim(binDir: string, argv: string[]): string {
  mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const quoted = argv.map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  writeFileSync(join(binDir, "kibo"), `#!/bin/sh\nexec ${quoted} "$@"\n`, { mode: 0o700 });
  return binDir;
}

const highest = (versions: ComponentVersionSummary[]) =>
  [...versions].sort((a, b) => compareSemver(b.version, a.version))[0] ?? null;

export function catalogEntries(list: ComponentSummary[]): CatalogEntry[] {
  const installed = list.flatMap((c) => {
    if (c.builtin) return [];
    const m = highest(c.versions.filter((v) => v.active && v.manifest !== null))?.manifest ?? null;
    if (!m || m.kind === "adapter") return [];
    return [{ id: c.id, title: m.title, description: m.description ?? "", kind: m.kind }];
  });
  return [...BUILTIN_STARTERS, ...installed];
}

export function latestPublished(list: ComponentSummary[], id: string): PublishedComponent | null {
  const summary = list.find((c) => c.id === id && !c.builtin);
  const v = summary ? highest(summary.versions.filter((x) => x.manifest !== null && x.hash !== null)) : null;
  if (!v?.manifest || v.hash === null) return null;
  return {
    version: v.version,
    manifest: v.manifest,
    granted: v.active ? grantedOf(v.manifest) : NO_PERMISSIONS,
    origin: v.origin,
    hash: v.hash,
  };
}

export function usagesOf(list: ComponentSummary[], id: string): PublishUsage[] {
  return list
    .filter((c) => c.id === id)
    .flatMap((c) => c.versions.flatMap((v) => v.usages.map((u) => ({ ...u, version: v.version }))));
}

export function githubConnected(statuses: IntegrationStatus[]): boolean {
  return statuses.some((s) => s.id === "github" && s.state === "connected");
}
