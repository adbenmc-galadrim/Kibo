import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HookEventName } from "@kibo/schema";
import { z } from "zod";

export const FakeStep = z.union([
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
  z.object({ mcp: z.string().min(1), input: z.record(z.string(), z.unknown()).default({}) }),
]);
export type FakeStep = z.infer<typeof FakeStep>;

export const FakeTurn = z.object({
  steps: z.array(FakeStep),
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
});

export function scenarioFor(file: string, prompt: string, remembered: string | null): string {
  if (remembered) return remembered;
  const routes = FakeRoutes.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!routes.success) return file;
  const route = routes.data.routes.find((r) => prompt.includes(r.prompt));
  return resolve(dirname(file), route?.scenario ?? routes.data.fallback);
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
  | "project-agent-routes";

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
