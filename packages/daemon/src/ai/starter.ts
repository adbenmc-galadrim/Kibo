import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type Role, StarterComponent, StarterPage, StarterPlan } from "@kibo/schema";
import { denyAllGuard } from "./draft-guard";
import type { AgentRuns, AiAvailability, AiEvents, CatalogEntry, Clock, RunState } from "./ports";

export const STARTER_TIMEOUT_MS = 60_000;
const MAX_PAGES = 8;
const MAX_TITLE = 40;
const FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/;

export type StarterDeps = {
  runs: AgentRuns;
  ai: AiAvailability;
  catalog: () => CatalogEntry[];
  events: AiEvents;
  clock: Clock;
  workRoot: string;
  prompt: (input: { role: Role; text: string; catalog: CatalogEntry[] }) => string;
  args: () => string[];
  timeoutMs?: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const unfence = (text: string) => FENCE.exec(text.trim())?.[1] ?? text.trim();

function extract(stdout: string): unknown {
  const envelope = parseJson(stdout.trim());
  if (isRecord(envelope)) {
    if (envelope.is_error === true) return undefined;
    if (isRecord(envelope.structured_output)) return envelope.structured_output;
    if (typeof envelope.result === "string") return parseJson(unfence(envelope.result));
    return envelope;
  }
  return parseJson(unfence(stdout));
}

export function parseStarterOutput(stdout: string, known: ReadonlySet<string>): StarterPlan | null {
  const raw = extract(stdout);
  if (!isRecord(raw) || !Array.isArray(raw.pages)) return null;
  const pages: StarterPage[] = [];
  for (const p of raw.pages) {
    if (pages.length === MAX_PAGES) break;
    if (!isRecord(p)) continue;
    const components: StarterComponent[] = [];
    for (const c of Array.isArray(p.components) ? p.components : []) {
      const parsed = StarterComponent.safeParse(c);
      if (parsed.success && known.has(parsed.data.id)) components.push(parsed.data);
    }
    const page = StarterPage.safeParse({
      title: typeof p.title === "string" ? p.title.trim().slice(0, MAX_TITLE) : "",
      kind: p.kind,
      components: p.kind === "view" ? components.slice(0, 1) : components,
    });
    if (page.success) pages.push(page.data);
  }
  const plan = StarterPlan.safeParse({ pages });
  return plan.success ? plan.data : null;
}

export function createStarterService(deps: StarterDeps): {
  suggest(input: { role: Role; text: string }): { runId: string };
} {
  const timeoutMs = deps.timeoutMs ?? STARTER_TIMEOUT_MS;
  return {
    suggest({ role, text }) {
      const status = deps.ai.status();
      if (!status.available)
        throw new KiboError("AI_UNAVAILABLE", `claude unavailable: ${status.reason ?? "unknown"}`);
      if (!status.profiles.assistant) throw new KiboError("AI_UNAVAILABLE", "assistant profile is disabled");
      mkdirSync(deps.workRoot, { recursive: true, mode: 0o700 });
      const cwd = mkdtempSync(join(deps.workRoot, "assistant-"));
      const catalog = deps.catalog();
      const known = new Set(catalog.map((c) => c.id));
      let runId: string;
      try {
        runId = deps.runs.enqueue({
          profileId: "assistant",
          label: "Suggestion de pages",
          cwd,
          prompt: deps.prompt({ role, text, catalog }),
          args: deps.args(),
          env: {},
          resumeSessionId: null,
          guard: denyAllGuard,
        });
      } catch (error) {
        rmSync(cwd, { recursive: true, force: true });
        throw error;
      }
      let stopTimer: (() => void) | null = null;
      const startTimer = (state: RunState | null) => {
        if (state === "running" && stopTimer === null)
          stopTimer = deps.clock.setTimeout(() => deps.runs.cancel(runId), timeoutMs);
      };
      const offState = deps.runs.onState(runId, startTimer);
      startTimer(deps.runs.state(runId));
      deps.runs.onEnd(runId, (end) => {
        offState();
        stopTimer?.();
        rmSync(cwd, { recursive: true, force: true });
        const plan = end.state === "done" ? parseStarterOutput(end.stdout, known) : null;
        deps.events.publish({ type: "starter.ready", runId, plan });
      });
      return { runId };
    },
  };
}
