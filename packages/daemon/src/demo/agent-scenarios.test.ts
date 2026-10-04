import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeRoutes, FakeScenario } from "../agents/fake-claude-scenario";
import { demoAgentEnv } from "./agent-env";
import { DEMO_FIXTURES, DEMO_ROUTES, DEMO_SCENARIOS, ensureDemoAgentFiles } from "./agent-scenarios";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});
const tempHome = () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-demo-"));
  homes.push(home);
  return home;
};

test("the demo scenarios are valid FakeScenario objects that cost zero tokens", () => {
  for (const s of Object.values(DEMO_SCENARIOS)) {
    const parsed = FakeScenario.parse(s);
    for (const turn of parsed.turns) expect(turn.tokens).toBe(0);
  }
  expect(DEMO_SCENARIOS.ticket.turns).toHaveLength(2);
  expect(JSON.stringify(DEMO_SCENARIOS.ticket.turns[0])).toContain("mcp__kibo__ask_user");
  expect(DEMO_SCENARIOS.ticket.turns[1]?.result).toBe(
    "Terminé : j'ai relu le ticket et noté le plan dans notes-de-l-agent.md",
  );
  expect(DEMO_SCENARIOS.component.turns[0]?.steps.some((s) => "write" in s && s.write === "ui.tsx")).toBe(
    true,
  );
  expect(DEMO_ROUTES.fallback).toBe("ticket");
  expect(DEMO_ROUTES.routes).toEqual([
    { prompt: "Écris le composant Kibo", scenario: "component" },
    { prompt: "Modifie le composant Kibo", scenario: "component" },
  ]);
});

test("every fixture a demo scenario writes is shipped, and the chart is the devkit template", () => {
  for (const s of Object.values(DEMO_SCENARIOS))
    for (const turn of s.turns)
      for (const step of turn.steps) if ("write" in step) expect(DEMO_FIXTURES[step.fixture]).toBeString();
  expect(DEMO_FIXTURES["chart/ui.tsx.fixture"]).toContain("Graphique d'avancement");
  expect(DEMO_FIXTURES["chart/ui.tsx.fixture"]).toContain("useEntities");
});

test("ensureDemoAgentFiles writes routes, scenarios, fixtures and a state dir under <home>/demo-agent, mode 0600", () => {
  const home = tempHome();
  const files = ensureDemoAgentFiles(home);
  expect(files.scenario).toBe(join(home, "demo-agent/routes.json"));
  const routes = FakeRoutes.parse(JSON.parse(readFileSync(files.scenario, "utf8")));
  expect(routes.routes[0]?.scenario).toBe(join(home, "demo-agent/scenarios/component.json"));
  expect(routes.fallback).toBe(join(home, "demo-agent/scenarios/ticket.json"));
  expect(statSync(join(home, "demo-agent/scenarios/ticket.json")).mode & 0o777).toBe(0o600);
  expect(statSync(join(home, "demo-agent")).mode & 0o777).toBe(0o700);
  expect(existsSync(join(files.fixtures, "chart/ui.tsx.fixture"))).toBe(true);
  expect(statSync(join(files.fixtures, "chart/ui.tsx.fixture")).mode & 0o777).toBe(0o600);
  expect(statSync(files.state).isDirectory()).toBe(true);
  expect(ensureDemoAgentFiles(home)).toEqual(files);
});

test("a symbolic link planted in place of a demo file is replaced, never followed", () => {
  const home = tempHome();
  const outside = join(home, "outside.json");
  writeFileSync(outside, "intact");
  mkdirSync(join(home, "demo-agent/scenarios"), { recursive: true });
  symlinkSync(outside, join(home, "demo-agent/routes.json"));
  symlinkSync(outside, join(home, "demo-agent/scenarios/ticket.json"));
  ensureDemoAgentFiles(home);
  expect(readFileSync(outside, "utf8")).toBe("intact");
  expect(lstatSync(join(home, "demo-agent/routes.json")).isSymbolicLink()).toBe(false);
  expect(lstatSync(join(home, "demo-agent/scenarios/ticket.json")).isSymbolicLink()).toBe(false);
  expect(readdirSync(join(home, "demo-agent/scenarios")).sort()).toEqual(["component.json", "ticket.json"]);
});

test("the demo environment points the fake claude at the demo files", () => {
  expect(demoAgentEnv({ scenario: "/h/routes.json", state: "/h/state", fixtures: "/h/fixtures" })).toEqual({
    KIBO_FAKE_CLAUDE_SCENARIO: "/h/routes.json",
    KIBO_FAKE_CLAUDE_STATE: "/h/state",
    KIBO_FAKE_CLAUDE_FIXTURES: "/h/fixtures",
    KIBO_FAKE_CLAUDE_DEMO: "1",
  });
});
