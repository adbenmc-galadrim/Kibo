import { expect, test } from "bun:test";
import type { ProgressInput, RunView } from "@kibo/schema";
import type { AgentMcpSink } from "../project-agent/types";
import { runView } from "../questions/questions.test-helper";
import { agentMcpSink } from "./agent-mcp";

const TICKET = runView({ id: "t1", kind: "ticket", state: "running" });
const PROJECT = runView({ id: "p1", kind: "project", ticketId: null, state: "running" });
const RUNS = new Map([TICKET, PROJECT].map((r) => [r.id, r]));

function setup() {
  const recorded: { run: string; input: ProgressInput }[] = [];
  const projectCalls: string[] = [];
  const signaled: string[] = [];
  const reviewed: string[] = [];
  const peeked: string[] = [];
  const project: AgentMcpSink = {
    verify: (runId) => {
      if (runId !== "p1") throw new Error("not a project run");
      return true;
    },
    run: () => null,
    call: async (run, tool) => {
      projectCalls.push(`${run.id}:${tool}`);
      return "projet";
    },
  };
  const sink = agentMcpSink({
    project,
    live: (runId, token) => token === `jeton-${runId}`,
    run: (runId) => RUNS.get(runId) ?? null,
    progress: {
      record: async (run: RunView, input: ProgressInput) => {
        recorded.push({ run: run.id, input });
        return "Plan enregistré.";
      },
    },
    signals: {
      record: async (run: RunView) => {
        signaled.push(run.id);
        return "Signal sig:1 enregistré.";
      },
    },
    reviews: {
      record: async (run: RunView) => {
        reviewed.push(run.id);
        return "1 review enregistrée";
      },
    },
    peek: {
      call: async (run: RunView) => {
        peeked.push(run.id);
        return "{}";
      },
    },
  });
  return { sink, recorded, projectCalls, signaled, reviewed, peeked };
}

test("a ticket run is verified by its live token, a project run by the project agent", () => {
  const { sink } = setup();
  expect(sink.verify("t1", "jeton-t1")).toBe(true);
  expect(sink.verify("t1", "jeton-p1")).toBe(false);
  expect(sink.verify("p1", "x")).toBe(true);
  expect(sink.verify("inconnu", "jeton-inconnu")).toBe(false);
  expect(sink.run("t1")).toBe(TICKET);
});

test("ticket_progress of a ticket run reaches the progress service, project tools the project agent", async () => {
  const { sink, recorded, projectCalls } = setup();
  expect(await sink.call(TICKET, "ticket_progress", { plan: [] })).toBe("Plan enregistré.");
  expect(recorded).toEqual([{ run: "t1", input: { plan: [] } }]);
  expect(await sink.call(PROJECT, "list_tickets", {})).toBe("projet");
  expect(projectCalls).toEqual(["p1:list_tickets"]);
});

test("signal_project of a ticket run reaches the signal service", async () => {
  const { sink, signaled, projectCalls } = setup();
  expect(await sink.call(TICKET, "signal_project", { kind: "ticket", title: "Tests" })).toBe(
    "Signal sig:1 enregistré.",
  );
  expect(signaled).toEqual(["t1"]);
  expect(projectCalls).toEqual([]);
});

test("an invalid progress input is an INVALID_INPUT error, nothing is recorded", async () => {
  const { sink, recorded } = setup();
  await expect(sink.call(TICKET, "ticket_progress", {})).rejects.toThrow("INVALID_INPUT");
  expect(recorded).toEqual([]);
});

test("skill_review of a ticket run and of a project run reaches the skill reviews", async () => {
  const { sink, reviewed, projectCalls } = setup();
  const input = { reviews: [{ skill: "a", verdict: "ok", note: "Bien." }] };
  expect(await sink.call(TICKET, "skill_review", input)).toBe("1 review enregistrée");
  expect(await sink.call(PROJECT, "skill_review", input)).toBe("1 review enregistrée");
  expect(reviewed).toEqual(["t1", "p1"]);
  expect(projectCalls).toEqual([]);
});

test("peek_work of a ticket run reaches the peek service", async () => {
  const { sink, peeked, projectCalls } = setup();
  expect(await sink.call(TICKET, "peek_work", { run: "BOU-12" })).toBe("{}");
  expect(peeked).toEqual(["t1"]);
  expect(projectCalls).toEqual([]);
});
