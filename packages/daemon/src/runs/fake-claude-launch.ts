import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const FakeAgent = z
  .object({
    description: z.string().min(1),
    prompt: z.string(),
    tools: z.array(z.string()).optional(),
    model: z.string().optional(),
  })
  .strict();
export const FakeAgents = z.record(z.string().min(1), FakeAgent);

export const FakeLaunch = z.object({
  agents: FakeAgents.nullable(),
  tools: z.array(z.string()).nullable(),
  disallowedTools: z.array(z.string()).nullable(),
  model: z.string().nullable(),
  name: z.string().nullable(),
  systemPromptSnapshot: z.string().nullable(),
});
export type FakeLaunch = z.infer<typeof FakeLaunch>;

const flag = (argv: readonly string[], name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};

const list = (value: string | null): string[] | null =>
  value === null ? null : value.split(/[\s,]+/).filter((tool) => tool.length > 0);

function readAgents(path: string | null): FakeLaunch["agents"] {
  if (path === null) return null;
  const text = path.trim().startsWith("{") ? path : readFileSync(path, "utf8");
  try {
    return FakeAgents.parse(JSON.parse(text));
  } catch (e) {
    throw new Error(`invalid agents: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function launchOf(argv: readonly string[]): FakeLaunch {
  return {
    agents: readAgents(flag(argv, "--agents")),
    tools: list(flag(argv, "--tools")),
    disallowedTools: list(flag(argv, "--disallowedTools")),
    model: flag(argv, "--model"),
    name: flag(argv, "--name") ?? flag(argv, "-n"),
    systemPromptSnapshot: flag(argv, "--system-prompt-snapshot"),
  };
}

const launchFile = (stateDir: string, sessionId: string): string =>
  join(stateDir, `${sessionId}.launch.json`);

export function writeLaunch(stateDir: string, sessionId: string, launch: FakeLaunch): void {
  writeFileSync(launchFile(stateDir, sessionId), `${JSON.stringify(launch, null, 2)}\n`);
}

export function fakeLaunch(stateDir: string, sessionId: string): FakeLaunch | null {
  const file = launchFile(stateDir, sessionId);
  return existsSync(file) ? FakeLaunch.parse(JSON.parse(readFileSync(file, "utf8"))) : null;
}
