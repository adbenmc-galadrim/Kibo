import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, tmp } from "./fake-claude.test-helper";
import { bindProfiles } from "./fake-claude-mcp";
import { scenarioPath, turnScenario } from "./fake-claude-scenario";

cleanFakeDirs();

const scenarios = (name: string) => join(scenarioPath("project-agent-routes"), "..", name);

test("per turn routes pick the scenario of the current prompt and keep the session on the fallback", () => {
  const routes = scenarioPath("project-agent-routes");
  expect(turnScenario(routes, "Où en est-on ?", null)).toEqual({
    turn: scenarios("project-agent-batch.json"),
    session: scenarios("project-agent-batch.json"),
  });
  const remembered = scenarios("project-agent-batch.json");
  expect(turnScenario(routes, "# Message\nlot invalide", remembered)).toEqual({
    turn: scenarios("project-agent-invalid.json"),
    session: remembered,
  });
  expect(turnScenario(routes, "# Message\nLot 2 refusé : trop tôt", remembered)).toEqual({
    turn: scenarios("project-agent-reject.json"),
    session: remembered,
  });
  expect(turnScenario(routes, "lot invalide", null).session).toBe(scenarios("project-agent-batch.json"));
  expect(turnScenario(routes, "# KIB-1 · Récepteur\n\n- Projet : Kibo\n- Domaine : aucun", null).turn).toBe(
    scenarios("done.json"),
  );
});

test("routes without perTurn stay sticky to the first chosen scenario", () => {
  const routes = scenarioPath("routes");
  const first = turnScenario(routes, "ask_question", null);
  expect(first.turn).toBe(first.session);
  expect(turnScenario(routes, "Récepteur de hooks", first.session)).toEqual(first);
});

test("a plain scenario file is used for every turn", () => {
  const file = join(tmp(), "plain.json");
  writeFileSync(file, JSON.stringify({ turns: [{ steps: [] }] }));
  expect(turnScenario(file, "x", null)).toEqual({ turn: file, session: file });
});

test("profile placeholders resolve by name from the turn's list_profiles reply", () => {
  const calls = [
    {
      tool: "list_profiles",
      text: JSON.stringify([{ id: "p-1", name: "opus", model: "opus" }]),
      isError: false,
    },
  ];
  const input = { actions: [{ id: 1, type: "assignAgent", profileId: "{{profile:opus}}" }], summary: "s" };
  expect(bindProfiles(input, calls)).toEqual({
    actions: [{ id: 1, type: "assignAgent", profileId: "p-1" }],
    summary: "s",
  });
  expect(() => bindProfiles(input, [])).toThrow("no list_profiles reply to resolve profile opus");
  expect(() => bindProfiles({ p: "{{profile:sonnet}}" }, calls)).toThrow("no profile named sonnet");
});
