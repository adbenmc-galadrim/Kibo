import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, tmp } from "./fake-claude.test-helper";
import { bindPlaceholders } from "./fake-claude-mcp";
import { FakeScenario, scenarioPath, turnScenario } from "./fake-claude-scenario";

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

test("question messages route to the question scenarios, which parse", () => {
  const routes = scenarioPath("project-agent-routes");
  const remembered = scenarios("project-agent-batch.json");
  expect(turnScenario(routes, "# Message\nPeux-tu ranger les questions ?", remembered).turn).toBe(
    scenarioPath("project-agent-questions"),
  );
  expect(turnScenario(routes, "# Message\nRenomme la question transmise", remembered).turn).toBe(
    scenarioPath("project-agent-questions-invalid"),
  );
  for (const name of ["project-agent-questions", "project-agent-questions-invalid"] as const) {
    expect(FakeScenario.safeParse(JSON.parse(readFileSync(scenarioPath(name), "utf8"))).success).toBe(true);
  }
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
  expect(bindPlaceholders(input, calls)).toEqual({
    actions: [{ id: 1, type: "assignAgent", profileId: "p-1" }],
    summary: "s",
  });
  expect(() => bindPlaceholders(input, [])).toThrow("no list_profiles reply to resolve profile opus");
  expect(() => bindPlaceholders({ p: "{{profile:sonnet}}" }, calls)).toThrow("no profile named sonnet");
});

test("question placeholders resolve by title from the turn's list_questions reply", () => {
  const calls = [
    {
      tool: "list_questions",
      text: JSON.stringify([
        { id: "q-1", title: "Client - Couleur ?", state: "open" },
        { id: "q-2", title: "Client - Logo ?", state: "answered" },
      ]),
      isError: false,
    },
  ];
  const input = { actions: [{ type: "reopenQuestion", questionId: "{{question:Client - Logo ?}}" }] };
  expect(bindPlaceholders(input, calls)).toEqual({
    actions: [{ type: "reopenQuestion", questionId: "q-2" }],
  });
  expect(() => bindPlaceholders(input, [])).toThrow(
    "no list_questions reply to resolve question Client - Logo ?",
  );
  expect(() => bindPlaceholders({ q: "{{question:Autre}}" }, calls)).toThrow("no question titled Autre");
});

test("without list_questions, a question placeholder resolves from the open questions of the prompt", () => {
  const prompt = [
    "## Questions ouvertes",
    "- q-7 · SILO-51 · Un box réaffecté garde-t-il ses photos ? (bloquante)",
    "- q-8 · SILO-34 · Quota par client : 2 Go ou 5 Go ?",
  ].join("\n");
  const input = {
    q: "{{question:Un box réaffecté garde-t-il ses photos ?}}",
    r: "{{question:Quota par client : 2 Go ou 5 Go ?}}",
  };
  expect(bindPlaceholders(input, [], prompt)).toEqual({ q: "q-7", r: "q-8" });
  expect(() => bindPlaceholders({ q: "{{question:Autre}}" }, [], prompt)).toThrow(
    "no list_questions reply to resolve question Autre",
  );
});
