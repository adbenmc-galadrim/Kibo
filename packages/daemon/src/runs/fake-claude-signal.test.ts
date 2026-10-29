import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ProposeBatchInput, SignalInput } from "@kibo/schema";
import { FakeRoutes, FakeScenario, type FakeStep, scenarioPath, turnScenario } from "./fake-claude-scenario";

const scenario = (name: "signal" | "signal-spam" | "project-agent-wakeup") =>
  FakeScenario.parse(JSON.parse(readFileSync(scenarioPath(name), "utf8")));
const calls = (steps: readonly FakeStep[], tool: string) =>
  steps.flatMap((step) => ("mcp" in step && step.mcp === tool ? [step.input] : []));

test("the signal run sends a ticket, a blocker on KIB-16 and a context, between its plan and its report", () => {
  const steps = scenario("signal").turns[0]?.steps ?? [];
  const signals = calls(steps, "signal_project").map((input) => SignalInput.parse(input));
  expect(signals.map((s) => [s.kind, s.ticket ?? null])).toEqual([
    ["ticket", null],
    ["blocker", "KIB-16"],
    ["context", null],
  ]);
  expect(calls(steps, "ticket_progress")).toHaveLength(2);
});

test("the spam run tries twenty-two distinct ticket signals", () => {
  const steps = scenario("signal-spam").turns[0]?.steps ?? [];
  const titles = calls(steps, "signal_project").map((input) => SignalInput.parse(input).title);
  expect(new Set(titles).size).toBe(22);
});

test("the wake-up turn reads the signals and proposes a batch that cites sig:1, sig:2 and dismisses sig:3", () => {
  const steps = scenario("project-agent-wakeup").turns[0]?.steps ?? [];
  expect(calls(steps, "list_signals")).toEqual([{}]);
  const [batch] = calls(steps, "propose_batch").map((input) => ProposeBatchInput.parse(input));
  expect(
    batch?.actions.map((a) => (a.type === "dismissSignal" ? [a.type, a.signal] : [a.type, a.signals])),
  ).toEqual([
    ["createTicket", ["sig:1"]],
    ["setStatus", ["sig:2"]],
    ["dismissSignal", "sig:3"],
  ]);
});

test("the signal routes send the wake-up before any ticket key and each ticket brief to its scenario", () => {
  const file = scenarioPath("signal-routes");
  const routes = FakeRoutes.parse(JSON.parse(readFileSync(file, "utf8")));
  expect(routes).toMatchObject({ fallback: "project-agent-batch.json", perTurn: true });
  const turn = (prompt: string) => turnScenario(file, prompt, null).turn.split("/").at(-1);
  expect(turn("# KIB-14 · Récepteur de hooks\n\nBrief")).toBe("signal.json");
  expect(turn("# KIB-16 · Moteur de règles\n\nBrief")).toBe("signal.json");
  expect(turn("# KIB-15 · Bavard\n\nBrief")).toBe("signal-spam.json");
  expect(turn("# KIB-13 · Long\n\nBrief")).toBe("signal-hold.json");
  expect(turn("# Projet\n\n- KIB-13 · Long\n\n# Message\n\nTiens la ligne.")).toBe("signal-hold.json");
  expect(turn("# KIB-1 · Récepteur\n\nBrief")).toBe("project-agent-batch.json");
  expect(turn("# Projet\n\n- KIB-14 · Récepteur\n\n# Message\n\nRéveil automatique : 2 signaux")).toBe(
    "project-agent-wakeup.json",
  );
  expect(turn("# Projet\n\n- KIB-14 · Récepteur\n\n# Message\n\nRange le projet.")).toBe(
    "project-agent-batch.json",
  );
});
