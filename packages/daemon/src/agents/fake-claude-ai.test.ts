import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  AI_SCENARIOS_DIR,
  aiScenarioPath,
  denialReason,
  FIXTURES_DIR,
  fakeMeta,
  fakeWrites,
  fixturesDir,
  runWriteStep,
  type WriteLog,
} from "./fake-claude-ai";
import { FAKE_CLAUDE, FakeRoutes, FakeScenario, FakeStep, scenarioFor } from "./fake-claude-scenario";

const dirs: string[] = [];
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-fake-ai-")));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const DENY = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "reserved",
  },
});

type Sent = { event: string; extra: Record<string, unknown> };

type StepOptions = { bypassHooks?: boolean; deny?: string; fixtures?: string };

function step(write: string, fixture: string, opts: StepOptions = {}) {
  const cwd = tmp();
  const sent: Sent[] = [];
  const log: WriteLog[] = [];
  const hook = async (event: string, extra: Record<string, unknown>) => {
    sent.push({ event, extra });
    return event === "PreToolUse" ? (opts.deny ?? null) : null;
  };
  const run = runWriteStep(
    { write, fixture, bypassHooks: opts.bypassHooks ?? false },
    { cwd, hook, log: (e) => log.push(e), ...(opts.fixtures && { fixtures: opts.fixtures }) },
  );
  return { cwd, sent, log, run };
}

describe("runWriteStep", () => {
  test("asks PreToolUse, writes the fixture, then reports PostToolUse", async () => {
    const { cwd, sent, log, run } = step("ui.tsx", "burndown/ui.tsx.fixture");
    expect(await run).toEqual({ write: join(cwd, "ui.tsx") });
    expect(log).toEqual([{ write: join(cwd, "ui.tsx") }]);
    expect(readFileSync(join(cwd, "ui.tsx"), "utf8")).toContain("useEntities");
    expect(sent.map((s) => s.event)).toEqual(["PreToolUse", "PostToolUse"]);
    expect(sent[0]?.extra).toMatchObject({
      tool_name: "Write",
      tool_input: { file_path: join(cwd, "ui.tsx") },
    });
    expect(sent[1]?.extra).toMatchObject({ tool_name: "Write", tool_response: { success: true } });
  });

  test("does not write when the hook denies, and logs the denial", async () => {
    const { cwd, sent, log, run } = step("../evil.ts", "burndown/evil.ts.fixture", { deny: "reserved" });
    await run;
    expect(existsSync(join(cwd, "..", "evil.ts"))).toBe(false);
    expect(log).toEqual([{ denied: join(cwd, "..", "evil.ts"), reason: "reserved" }]);
    expect(sent.map((s) => s.event)).toEqual(["PreToolUse"]);
  });

  test("the hook sees the resolved absolute path, never the raw relative one", async () => {
    const { cwd, sent, run } = step("sub/../ui.tsx", "burndown/ui.tsx.fixture", { deny: "no" });
    await run;
    expect(sent[0]?.extra).toMatchObject({ tool_input: { file_path: join(cwd, "ui.tsx") } });
    expect(existsSync(join(cwd, "ui.tsx"))).toBe(false);
  });

  test("bypassHooks writes directly, like a tool that escaped the guard", async () => {
    const { cwd, sent, log, run } = step("kibo.component.json", "burndown/evil-manifest.json", {
      bypassHooks: true,
      deny: "reserved",
    });
    await run;
    expect(sent).toEqual([]);
    expect(readFileSync(join(cwd, "kibo.component.json"), "utf8")).toContain('"writes"');
    expect(log).toEqual([{ write: join(cwd, "kibo.component.json"), bypass: true }]);
  });

  test("an unknown fixture fails before any hook or write", async () => {
    const { cwd, sent, run } = step("ui.tsx", "burndown/missing.tsx");
    await expect(run).rejects.toThrow();
    expect(sent).toEqual([]);
    expect(existsSync(join(cwd, "ui.tsx"))).toBe(false);
  });

  test("a fixture outside the fixtures dir is refused", async () => {
    const { cwd, sent, run } = step("ui.tsx", "../../fake-claude-ai.ts");
    await expect(run).rejects.toThrow(/outside the fixtures dir/);
    expect(sent).toEqual([]);
    expect(existsSync(join(cwd, "ui.tsx"))).toBe(false);
  });

  test("the fixtures come from the given dir when one is set", async () => {
    const fixtures = tmp();
    await Bun.write(join(fixtures, "demo/notes.md.fixture"), "plan");
    const { cwd, run } = step("notes.md", "demo/notes.md.fixture", { fixtures });
    await run;
    expect(readFileSync(join(cwd, "notes.md"), "utf8")).toBe("plan");
  });
});

test("fixturesDir follows KIBO_FAKE_CLAUDE_FIXTURES, else the test fixtures", () => {
  expect(fixturesDir({ KIBO_FAKE_CLAUDE_FIXTURES: "/h/demo-agent/fixtures" })).toBe("/h/demo-agent/fixtures");
  expect(fixturesDir({})).toBe(FIXTURES_DIR);
});

test("denialReason reads the PreToolUse decision printed by kibo-hook", () => {
  expect(denialReason(["", DENY])).toBe("reserved");
  expect(denialReason([JSON.stringify({ hookSpecificOutput: { permissionDecision: "allow" } })])).toBeNull();
  expect(denialReason([""])).toBeNull();
  expect(denialReason(["{not json", "plain text"])).toBeNull();
  expect(denialReason([JSON.stringify({ hookSpecificOutput: { permissionDecision: "deny" } })])).toBe(
    "denied",
  );
});

test("fakeMeta answers --version, --help and auth status", () => {
  expect(fakeMeta(["--version"], {})).toBe("2.1.283 (Claude Code)\n");
  expect(fakeMeta(["--help"], {})).toContain("--json-schema");
  expect(fakeMeta(["--help"], { KIBO_FAKE_CLAUDE_HELP: "legacy" })).not.toContain("--json-schema");
  expect(fakeMeta(["auth", "status", "--json"], {})).toBe('{"loggedIn":true,"authMethod":"claude.ai"}\n');
  expect(fakeMeta(["auth", "status", "--json"], { KIBO_FAKE_CLAUDE_LOGGED_OUT: "1" })).toBe(
    '{"loggedIn":false}\n',
  );
  expect(fakeMeta(["-p", "--output-format", "stream-json"], {})).toBeNull();
});

test("a write step defaults to going through the hooks", () => {
  expect(FakeStep.parse({ write: "ui.tsx", fixture: "burndown/ui.tsx.fixture" })).toEqual({
    write: "ui.tsx",
    fixture: "burndown/ui.tsx.fixture",
    bypassHooks: false,
  });
  expect(FakeStep.safeParse({ write: "", fixture: "x" }).success).toBe(false);
});

test("every AI scenario parses and every fixture or route target exists", () => {
  const files = readdirSync(AI_SCENARIOS_DIR).filter((f) => f.endsWith(".json"));
  expect(files.sort()).toEqual(
    [
      "creations-routes",
      "e2e-routes",
      "generate-3d",
      "generate-fail-3",
      "generate-fetch",
      "generate-fetch-dynamic",
      "generate-fixed-width",
      "generate-guard",
      "generate-ok",
      "generate-retry",
      "generate-revise",
      "modify-ok",
      "modify-routes",
      "onboarding-invalid",
      "onboarding-ok",
      "onboarding-slow",
      "onboarding-unknown",
    ]
      .map((n) => `${n}.json`)
      .sort(),
  );
  for (const file of files) {
    const raw: unknown = JSON.parse(readFileSync(aiScenarioPath(file), "utf8"));
    const routes = FakeRoutes.safeParse(raw);
    if (routes.success) {
      for (const target of [...routes.data.routes.map((r) => r.scenario), routes.data.fallback])
        expect(existsSync(aiScenarioPath(target))).toBe(true);
      continue;
    }
    for (const turn of FakeScenario.parse(raw).turns)
      for (const step of turn.steps)
        if ("write" in step) expect(existsSync(join(FIXTURES_DIR, step.fixture))).toBe(true);
  }
});

test("the creations routes send a title ending in large to the fixed width scenario", () => {
  const routes = aiScenarioPath("creations-routes.json");
  const prompt = (title: string) =>
    `Écris le composant Kibo « ${title} » (id x, widget) dans le dossier courant.\nFormats à prendre en charge : large (Large, 6 × 6 cellules).`;
  expect(scenarioFor(routes, prompt("Compteur large"), null)).toBe(
    aiScenarioPath("generate-fixed-width.json"),
  );
  expect(scenarioFor(routes, prompt("Burndown du sprint"), null)).toBe(
    aiScenarioPath("generate-revise.json"),
  );
});

test("the e2e routes send the viewer to the 3D scenario and other creations to the burndown", () => {
  const routes = aiScenarioPath("e2e-routes.json");
  const prompt = (title: string) =>
    `Écris le composant Kibo « ${title} » (id x, widget) dans le dossier courant.`;
  expect(scenarioFor(routes, prompt("Visionneuse"), null)).toBe(aiScenarioPath("generate-3d.json"));
  expect(scenarioFor(routes, prompt("Burndown"), null)).toBe(aiScenarioPath("generate-ok.json"));
});

async function spawnFake(argv: string[], env: Record<string, string>, stdin = "") {
  const proc = Bun.spawn([FAKE_CLAUDE, ...argv], {
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return { out, code };
}

test("the fake claude binary answers the probes without a scenario", async () => {
  expect(await spawnFake(["--version"], {})).toEqual({ out: "2.1.283 (Claude Code)\n", code: 0 });
  const auth = await spawnFake(["auth", "status", "--json"], { KIBO_FAKE_CLAUDE_LOGGED_OUT: "1" });
  expect(auth).toEqual({ out: '{"loggedIn":false}\n', code: 0 });
  const legacy = await spawnFake(["--help"], { KIBO_FAKE_CLAUDE_HELP: "legacy" });
  expect(legacy.out).toContain('"default"');
  expect(legacy.out).not.toContain("--tools");
});

async function play(scenario: string, hookCommand: string) {
  const state = tmp();
  const cwd = tmp();
  const sessionId = crypto.randomUUID();
  const hook = [{ matcher: "*", hooks: [{ type: "command", command: hookCommand }] }];
  const settings = JSON.stringify({ hooks: { PreToolUse: hook, PostToolUse: hook } });
  const argv = ["-p", "--output-format", "stream-json", "--verbose", "--settings", settings];
  const proc = Bun.spawn([FAKE_CLAUDE, ...argv, "--session-id", sessionId], {
    cwd,
    env: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: aiScenarioPath(scenario),
      KIBO_FAKE_CLAUDE_STATE: state,
    },
    stdin: new TextEncoder().encode("Écris le composant Kibo « Burndown »"),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  const lines = out
    .trim()
    .split("\n")
    .map((l) => z.record(z.string(), z.unknown()).parse(JSON.parse(l)));
  return { cwd, state, code, result: lines.at(-1), writes: fakeWrites(state, sessionId) };
}

test("the fake claude plays write steps through the real hooks", async () => {
  const allowed = await play("generate-ok.json", "cat > /dev/null");
  expect(allowed.code).toBe(0);
  expect(readFileSync(join(allowed.cwd, "ui.tsx"), "utf8")).toContain("tickets restants");
  expect(allowed.writes).toEqual([{ write: join(allowed.cwd, "ui.tsx") }]);
  const denied = await play("generate-ok.json", `cat > /dev/null; echo '${DENY}'`);
  expect(existsSync(join(denied.cwd, "ui.tsx"))).toBe(false);
  expect(denied.writes).toEqual([{ denied: join(denied.cwd, "ui.tsx"), reason: "reserved" }]);
  expect(denied.result).toMatchObject({
    permission_denials: expect.arrayContaining([{ tool_name: "Write" }]),
  });
});

test("a hook exiting with 2 blocks the write", async () => {
  const run = await play("generate-ok.json", "cat > /dev/null; exit 2");
  expect(existsSync(join(run.cwd, "ui.tsx"))).toBe(false);
  expect(run.writes).toEqual([{ denied: join(run.cwd, "ui.tsx"), reason: "denied" }]);
});

const HookLine = z.object({ hook_event_name: z.string(), tool_name: z.string().optional() });
const writeEvents = (log: string) =>
  readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((l) => HookLine.parse(JSON.parse(l)))
    .filter((h) => h.tool_name === "Write")
    .map((h) => h.hook_event_name);

test("PostToolUse is sent only for a write the hooks allowed", async () => {
  const logs = tmp();
  const allowedLog = join(logs, "allowed.jsonl");
  const allowed = await play("generate-ok.json", `{ cat; echo; } >> '${allowedLog}'`);
  expect(existsSync(join(allowed.cwd, "ui.tsx"))).toBe(true);
  expect(writeEvents(allowedLog)).toEqual(["PreToolUse", "PostToolUse"]);
  const deniedLog = join(logs, "denied.jsonl");
  await play("generate-ok.json", `{ cat; echo; } >> '${deniedLog}'; echo '${DENY}'`);
  expect(writeEvents(deniedLog)).toEqual(["PreToolUse"]);
});

test("the guard scenario only lands the writes that bypass a denying hook", async () => {
  const run = await play("generate-guard.json", `cat > /dev/null; echo '${DENY}'`);
  expect(run.code).toBe(0);
  expect(existsSync(join(run.cwd, "..", "evil.ts"))).toBe(false);
  expect(existsSync(join(run.cwd, "ui.tsx"))).toBe(false);
  expect(readFileSync(join(run.cwd, "kibo.component.json"), "utf8")).toContain("evil.example.com");
  expect(existsSync(join(run.cwd, "evil.ts"))).toBe(true);
  expect(run.writes).toEqual([
    { denied: join(run.cwd, "kibo.component.json"), reason: "reserved" },
    { denied: join(run.cwd, "..", "evil.ts"), reason: "reserved" },
    { denied: join(run.cwd, "ui.tsx"), reason: "reserved" },
    { write: join(run.cwd, "kibo.component.json"), bypass: true },
    { write: join(run.cwd, "evil.ts"), bypass: true },
  ]);
  expect(run.result).toMatchObject({
    permission_denials: [
      { tool_name: "Write" },
      { tool_name: "Write" },
      { tool_name: "Bash" },
      { tool_name: "Write" },
    ],
  });
});

test("structuredOutput is copied into the result line", async () => {
  const { result } = await play("onboarding-ok.json", "cat > /dev/null");
  expect(result).toMatchObject({
    type: "result",
    structured_output: { pages: [{ title: "Suivi clients" }, { title: "Tickets" }] },
  });
  const plain = await play("onboarding-invalid.json", "cat > /dev/null");
  expect(plain.result).not.toHaveProperty("structured_output");
});
