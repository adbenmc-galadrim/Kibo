import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HookEventName, WORK_SECTION_TITLE } from "@kibo/schema";
import { z } from "zod";

const BASE_STEPS = [
  z.object({
    hook: HookEventName,
    tool: z.string().optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ sleepMs: z.number().int().nonnegative() }),
  z.object({ hold: z.literal(true) }),
  z.object({ stderr: z.string() }),
  z.object({ write: z.string().min(1), fixture: z.string().min(1), bypassHooks: z.boolean().default(false) }),
  z.object({
    write: z.string().min(1),
    content: z.string(),
    binary: z.literal(true).optional(),
    bypassHooks: z.boolean().default(false),
  }),
  z.object({ delete: z.string().min(1), bypassHooks: z.boolean().default(false) }),
  z.object({ mcp: z.string().min(1), input: z.record(z.string(), z.unknown()).default({}) }),
  z.object({ say: z.string() }),
  z.object({ bash: z.string().min(1) }),
  z.object({ think: z.string() }),
  z.object({ raw: z.string() }),
  z.object({ skill: z.string().min(1), args: z.string().optional(), denied: z.boolean().default(false) }),
  z.object({
    deny: z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()).default({}) }),
  }),
  z.object({
    subagent: z.object({
      type: z.string().min(1),
      description: z.string().default(""),
      prompt: z.string().default(""),
      model: z.string().optional(),
      actions: z.array(z.object({ bash: z.string().min(1) })).default([]),
      result: z.string().default("ok"),
      hold: z.boolean().default(false),
    }),
  }),
] as const;
const BaseStep = z.union(BASE_STEPS);
export type FakeStep = z.infer<typeof BaseStep> | { subagent: string; steps: FakeStep[] };
export const FakeStep: z.ZodType<FakeStep, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([...BASE_STEPS, z.object({ subagent: z.string().min(1), steps: z.array(FakeStep) })]),
);

export const FakeTurn = z.object({
  steps: z.array(FakeStep),
  onStopBlock: z.array(FakeStep).optional(),
  result: z.string().default("ok"),
  isError: z.boolean().default(false),
  exitCode: z.number().int().default(0),
  tokens: z.number().int().nonnegative().default(1000),
  structuredOutput: z.record(z.string(), z.unknown()).optional(),
});
export const FakeScenario = z.object({ turns: z.array(FakeTurn).min(1) });
export type FakeScenario = z.infer<typeof FakeScenario>;

export const FakeRoutes = z.object({
  routes: z.array(z.object({ prompt: z.string().min(1), scenario: z.string().min(1) })),
  fallback: z.string().min(1),
  perTurn: z.boolean().default(false),
});
type FakeRoutes = z.infer<typeof FakeRoutes>;

const NEXT_HEADING = /\n#{1,2} /;

export function withoutWorkSection(prompt: string): string {
  const start = prompt.indexOf(WORK_SECTION_TITLE);
  if (start < 0) return prompt;
  const rest = prompt.slice(start + WORK_SECTION_TITLE.length);
  const next = rest.search(NEXT_HEADING);
  return prompt.slice(0, start) + (next < 0 ? "" : rest.slice(next + 1));
}

const routeOf = (routes: FakeRoutes["routes"], prompt: string) => {
  const routable = withoutWorkSection(prompt);
  return routes.find((r) => routable.includes(r.prompt));
};

export function scenarioFor(file: string, prompt: string, remembered: string | null): string {
  if (remembered) return remembered;
  const routes = FakeRoutes.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!routes.success) return file;
  const route = routeOf(routes.data.routes, prompt);
  return resolve(dirname(file), route?.scenario ?? routes.data.fallback);
}

export function turnScenario(
  file: string,
  prompt: string,
  remembered: string | null,
): { turn: string; session: string } {
  const routes = FakeRoutes.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!routes.success || !routes.data.perTurn) {
    const chosen = scenarioFor(file, prompt, remembered);
    return { turn: chosen, session: chosen };
  }
  const session = remembered ?? resolve(dirname(file), routes.data.fallback);
  const route = routeOf(routes.data.routes, prompt);
  return { turn: route ? resolve(dirname(file), route.scenario) : session, session };
}

export const FakeCall = z.object({
  argv: z.array(z.string()),
  cwd: z.string(),
  prompt: z.string(),
  hasToken: z.boolean(),
  hookUrl: z.string().nullable(),
  mcp: z.array(z.object({ tool: z.string(), text: z.string(), isError: z.boolean() })).default([]),
});
export type FakeCall = z.infer<typeof FakeCall>;

export const FAKE_CLAUDE = join(import.meta.dir, "fake-claude.ts");

export type FakeScenarioName =
  | "done"
  | "question"
  | "hold"
  | "fail"
  | "guard"
  | "routes"
  | "project-agent-routes"
  | "project-agent-questions"
  | "project-agent-questions-invalid"
  | "progress"
  | "progress-hold"
  | "progress-no-plan"
  | "progress-routes"
  | "signal"
  | "signal-spam"
  | "project-agent-wakeup"
  | "signal-routes"
  | "skills-review"
  | "skills-no-review"
  | "skills-denied"
  | "skills-routes"
  | "overlap-owner"
  | "overlap-other"
  | "overlap-bash"
  | "overlap-keep"
  | "overlap-import"
  | "overlap-twin"
  | "overlap-routes"
  | "delivery-denied"
  | "delivery-validation"
  | "delivery-subagents"
  | "delivery-steps"
  | "delivery-routes";

export function scenarioPath(name: FakeScenarioName): string {
  return join(import.meta.dir, "scenarios", `${name}.json`);
}

export function fakeCalls(stateDir: string, sessionId: string): FakeCall[] {
  const file = join(stateDir, `${sessionId}.calls.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => FakeCall.parse(JSON.parse(line)));
}

export function releaseFakeRun(stateDir: string, sessionId: string): void {
  writeFileSync(join(stateDir, `${sessionId}.release`), "");
}
