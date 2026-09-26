#!/usr/bin/env bun
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { appendWrite, denialReason, fakeMeta, runWriteStep } from "./fake-claude-ai";
import { FakeScenario, type FakeStep, scenarioFor } from "./fake-claude-scenario";

const Settings = z.object({
  hooks: z
    .record(
      z.string(),
      z.array(
        z.object({
          matcher: z.string().optional(),
          hooks: z.array(z.object({ type: z.string(), command: z.string().optional() })),
        }),
      ),
    )
    .optional(),
});

const Decision = z.object({
  hookSpecificOutput: z.object({ permissionDecision: z.enum(["allow", "deny", "ask"]) }),
});

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    process.stderr.write(`fake-claude: hook output is not JSON: ${String(error)}\n`);
    return null;
  }
};

const decisionOf = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  const parsed = Decision.safeParse(parseJson(trimmed));
  return parsed.success ? parsed.data.hookSpecificOutput.permissionDecision : null;
};

const flag = (argv: string[], name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};

const fail = (message: string, code: number) => {
  process.stderr.write(`fake-claude: ${message}\n`);
  return code;
};

const matches = (matcher: string | undefined, tool: string) =>
  matcher === undefined || matcher === "" || matcher === "*" || new RegExp(`^(${matcher})$`).test(tool);

type HookRun = { code: number; stdout: string };

const launcher = process.ppid;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const meta = fakeMeta(argv, process.env);
  if (meta !== null) {
    process.stdout.write(meta);
    return 0;
  }
  const mode = flag(argv, "--permission-mode") ?? "default";
  if (argv.includes("--dangerously-skip-permissions") || mode === "bypassPermissions") {
    return fail("refusing to bypass permissions", 3);
  }
  if (!argv.includes("-p") && !argv.includes("--print")) return fail("only --print mode is supported", 2);
  if (flag(argv, "--output-format") === "stream-json" && !argv.includes("--verbose")) {
    return fail("When using --print, --output-format=stream-json requires --verbose", 1);
  }
  const resumeId = flag(argv, "--resume");
  const sessionId = resumeId ?? flag(argv, "--session-id");
  if (!sessionId) return fail("--session-id or --resume is required", 2);
  const scenarioFile = process.env.KIBO_FAKE_CLAUDE_SCENARIO;
  if (!scenarioFile) return fail("KIBO_FAKE_CLAUDE_SCENARIO is required", 2);
  const stateDir = process.env.KIBO_FAKE_CLAUDE_STATE ?? join(tmpdir(), "kibo-fake-claude");
  mkdirSync(stateDir, { recursive: true });

  const callsFile = join(stateDir, `${sessionId}.calls.jsonl`);
  if (resumeId && !existsSync(callsFile))
    return fail(`No conversation found with session ID: ${resumeId}`, 1);
  const prompt = await Bun.stdin.text();
  const call = {
    argv,
    cwd: process.cwd(),
    prompt,
    hasToken: Boolean(process.env.KIBO_RUN_TOKEN),
    hookUrl: process.env.KIBO_HOOK_URL ?? null,
  };
  appendFileSync(callsFile, `${JSON.stringify(call)}\n`);
  const turnIndex = readFileSync(callsFile, "utf8").trim().split("\n").length - 1;
  const chosenFile = join(stateDir, `${sessionId}.scenario`);
  const chosen = scenarioFor(
    scenarioFile,
    prompt,
    existsSync(chosenFile) ? readFileSync(chosenFile, "utf8") : null,
  );
  writeFileSync(chosenFile, chosen);
  const scenario = FakeScenario.parse(JSON.parse(readFileSync(chosen, "utf8")));
  const turn = scenario.turns[Math.min(turnIndex, scenario.turns.length - 1)];
  if (!turn) return fail("empty scenario", 2);

  const settingsArg = flag(argv, "--settings");
  const settingsJson = settingsArg?.trim().startsWith("{")
    ? settingsArg
    : settingsArg && readFileSync(settingsArg, "utf8");
  const settings = Settings.parse(settingsJson ? JSON.parse(settingsJson) : {});
  const transcriptPath = join(stateDir, `${sessionId}.jsonl`);
  const common = {
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd: process.cwd(),
    permission_mode: mode,
  };

  const runHooks = async (event: string, extra: Record<string, unknown>): Promise<HookRun[]> => {
    const tool = typeof extra.tool_name === "string" ? extra.tool_name : "";
    const runs: HookRun[] = [];
    for (const group of settings.hooks?.[event] ?? []) {
      if (!matches(group.matcher, tool)) continue;
      for (const h of group.hooks) {
        if (h.type !== "command" || !h.command) continue;
        const input = JSON.stringify({ ...common, hook_event_name: event, ...extra });
        const proc = Bun.spawn(["sh", "-c", h.command], {
          stdin: new TextEncoder().encode(input),
          stdout: "pipe",
          stderr: "inherit",
        });
        const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
        if (code !== 0) process.stderr.write(`fake-claude: ${event} hook exited with ${code}\n`);
        runs.push({ code, stdout });
      }
    }
    return runs;
  };
  const denied = (runs: HookRun[]) =>
    runs.some((r) => r.code === 2 || (r.code === 0 && decisionOf(r.stdout) === "deny"));

  const denials: string[] = [];
  const play = async (step: FakeStep) => {
    if ("hook" in step) {
      const tool = step.tool ? { tool_name: step.tool } : {};
      const input = step.input ? { tool_input: step.input } : {};
      const runs = await runHooks(step.hook, { ...tool, ...input, ...step.extra });
      if (step.hook === "PreToolUse" && denied(runs)) denials.push(step.tool ?? "?");
      return;
    }
    if ("write" in step) {
      const entry = await runWriteStep(step, {
        cwd: process.cwd(),
        hook: async (event, extra) => {
          const runs = await runHooks(event, extra);
          return event === "PreToolUse" && denied(runs)
            ? (denialReason(runs.map((r) => r.stdout)) ?? "denied")
            : null;
        },
        log: (logged) => appendWrite(stateDir, sessionId, logged),
      });
      if ("denied" in entry) denials.push("Write");
      return;
    }
    if ("sleepMs" in step) {
      await Bun.sleep(step.sleepMs);
      return;
    }
    if ("hold" in step) {
      const release = join(stateDir, `${sessionId}.release`);
      while (!existsSync(release)) {
        if (process.ppid !== launcher) process.exit(1);
        await Bun.sleep(25);
      }
      rmSync(release);
      return;
    }
    process.stderr.write(`${step.stderr}\n`);
  };
  const print = (line: unknown) => process.stdout.write(`${JSON.stringify(line)}\n`);

  print({ type: "system", subtype: "init", session_id: sessionId, cwd: process.cwd(), permissionMode: mode });
  await runHooks("SessionStart", { source: resumeId ? "resume" : "startup" });
  appendFileSync(
    transcriptPath,
    `${JSON.stringify({ type: "user", sessionId, message: { role: "user", content: prompt } })}\n`,
  );
  for (const step of turn.steps) await play(step);
  const input = Math.floor(turn.tokens / 2);
  const usage = {
    input_tokens: input,
    output_tokens: turn.tokens - input,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  const assistant = { role: "assistant", content: [{ type: "text", text: turn.result }], usage };
  appendFileSync(transcriptPath, `${JSON.stringify({ type: "assistant", sessionId, message: assistant })}\n`);
  if (turn.isError)
    await runHooks("StopFailure", { error: turn.result, last_assistant_message: turn.result });
  else await runHooks("Stop", { stop_hook_active: false, last_assistant_message: turn.result });
  await runHooks("SessionEnd", { reason: "other" });
  print({
    type: "result",
    subtype: "success",
    is_error: turn.isError,
    result: turn.result,
    session_id: sessionId,
    num_turns: 1,
    total_cost_usd: turn.tokens / 1_000_000,
    usage,
    permission_denials: denials.map((tool_name) => ({ tool_name })),
    ...(turn.structuredOutput ? { structured_output: turn.structuredOutput } : {}),
  });
  return turn.exitCode;
}

process.exit(await main());
