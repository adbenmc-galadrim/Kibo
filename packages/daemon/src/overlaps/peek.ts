import {
  DUPLICATION_LIMITS,
  isTerminal,
  KiboError,
  maskSecrets,
  maskSecretsWithin,
  type PeekFileResult,
  PeekWorkInput,
  type PeekWorkResult,
  type RunView,
} from "@kibo/schema";
import { readPeekFile, resolvePeekPath } from "./peek-path";
import { isPeerOf, type PeekServices, startOf, type WorkspaceRef } from "./work-view";

type Target = { run: RunView; ws: WorkspaceRef };

const masked = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => (typeof v === "string" ? maskSecrets(v) : v));

const notFound = (ref: string) => new KiboError("NOT_FOUND", `run ${ref} not found in this project`);

export function createPeek(services: PeekServices) {
  const calls = new Map<string, number>();

  function countCall(runId: string): void {
    const count = calls.get(runId) ?? 0;
    if (count >= DUPLICATION_LIMITS.peekCallsPerTurn) {
      throw new KiboError(
        "QUOTA_EXCEEDED",
        `peek_work is limited to ${DUPLICATION_LIMITS.peekCallsPerTurn} calls per turn`,
      );
    }
    calls.set(runId, count + 1);
  }

  const recent = (run: RunView): boolean =>
    !isTerminal(run.state) ||
    (run.endedAt !== null && services.now() - run.endedAt < DUPLICATION_LIMITS.peekRecentMs);

  async function resolveTarget(caller: RunView, ref: string): Promise<Target> {
    const key = ref.toUpperCase();
    const candidates = services
      .runs()
      .filter((r) => (r.id === caller.id || isPeerOf(caller, r)) && r.kind === "ticket" && recent(r))
      .filter((r) => r.id === ref || r.ticketKey?.toUpperCase() === key)
      .sort((a, b) => b.createdAt - a.createdAt);
    const [run] = candidates;
    if (run === undefined) throw notFound(ref);
    const ws = await services.workspaceOf(run);
    if (ws === null) throw notFound(ref);
    return { run, ws };
  }

  async function summary(caller: RunView, { run, ws }: Target): Promise<PeekWorkResult> {
    const index = await services.indexOf(ws, [run.id]);
    const files = index?.files ?? [];
    const shown = files.slice(0, DUPLICATION_LIMITS.peekFiles);
    return {
      run: {
        id: run.id,
        name: services.runName(run),
        ticketKey: run.ticketKey ?? "",
        ticketTitle: run.ticketTitle ?? "",
        state: run.state,
        startedAt: startOf(run),
        workspace: ws.kind,
      },
      plan: run.projectId && run.ticketId ? services.planOf(run.projectId, run.ticketId) : null,
      files: shown.map((f) => ({
        path: f.path,
        status: f.status,
        added: f.added,
        removed: f.removed,
        exports: f.exports,
      })),
      truncated: (index?.truncated ?? false) || files.length > shown.length,
      overlaps: services.overlapsBetween(caller.id, run.id).filter((o) => o.status === "open"),
    };
  }

  async function gitOut(ws: WorkspaceRef, args: string[]): Promise<string> {
    const result = await services.git(args, ws.key, DUPLICATION_LIMITS.gitTimeoutMs);
    if (result.code !== 0) {
      throw new KiboError("INVALID_INPUT", `git ${args[0]} failed in the workspace: ${result.stderr.trim()}`);
    }
    return result.stdout;
  }

  const addedDiff = (path: string, content: string): string =>
    [
      `--- /dev/null`,
      `+++ b/${path}`,
      ...content
        .replace(/\n$/, "")
        .split("\n")
        .map((l) => `+${l}`),
      "",
    ].join("\n");

  async function file(target: Target, path: string): Promise<PeekFileResult> {
    const { ws } = target;
    const abs = resolvePeekPath(ws.key, path, services.screen);
    const content = await readPeekFile(services.fs, abs, path);
    const index = await services.indexOf(ws, [target.run.id]);
    const indexed = index?.files.find((f) => f.path === path);
    if (content === null && indexed === undefined)
      throw new KiboError("INVALID_INPUT", `${path} : fichier introuvable`);
    const untracked =
      content !== null &&
      (await gitOut(ws, ["ls-files", "--others", "--exclude-standard", "--", path])).trim() !== "";
    const diff = untracked
      ? addedDiff(path, content ?? "")
      : await gitOut(ws, ["diff", "--no-color", "--no-ext-diff", ws.baseHead, "--", path]);
    const cut = maskSecretsWithin(diff, DUPLICATION_LIMITS.peekDiffBytes);
    return {
      path,
      status: indexed?.status ?? (untracked ? "added" : "modified"),
      content: maskSecrets(content ?? ""),
      diff: cut,
      truncated: cut.length < maskSecrets(diff).length,
    };
  }

  async function call(caller: RunView, input: unknown): Promise<string> {
    countCall(caller.id);
    const parsed = PeekWorkInput.safeParse(input);
    if (!parsed.success) {
      throw new KiboError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const target = await resolveTarget(caller, parsed.data.run);
    const result =
      parsed.data.path === undefined ? await summary(caller, target) : await file(target, parsed.data.path);
    return masked(result);
  }

  return {
    call,
    resetQuota(runId: string): void {
      calls.delete(runId);
    },
  };
}
