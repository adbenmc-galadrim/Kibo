import { expect, test } from "bun:test";
import type { ProgressInput, RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { handleTicketTool, type TicketToolServices } from "./mcp";

const RUN = runView({ id: "r1", state: "running" });
const step = (i: number) => ({ id: `s${i}`, title: `Étape ${i}`, status: "todo" as const });

function fakeService() {
  const recorded: { run: RunView; input: ProgressInput }[] = [];
  const signaled: { run: RunView; input: unknown }[] = [];
  const reviewed: { run: RunView; input: unknown }[] = [];
  const peeked: { run: RunView; input: unknown }[] = [];
  const service: TicketToolServices = {
    progress: {
      record: async (run, input) => {
        recorded.push({ run, input });
        return "Plan enregistré.";
      },
    },
    signals: {
      record: async (run, input) => {
        signaled.push({ run, input });
        return "Signal sig:1 enregistré.";
      },
    },
    reviews: {
      record: async (run, input) => {
        reviewed.push({ run, input });
        return "1 review enregistrée";
      },
    },
    peek: {
      call: async (run, input) => {
        peeked.push({ run, input });
        return '{"run":{"id":"r12"}}';
      },
    },
  };
  return { service, recorded, signaled, reviewed, peeked };
}

test("a valid call is recorded for the run and its reply comes back", async () => {
  const { service, recorded } = fakeService();
  const input = { plan: [step(1)], projectId: "other", ticketId: "0@0" };
  expect(await handleTicketTool(service, RUN, "ticket_progress", input)).toBe("Plan enregistré.");
  expect(recorded).toEqual([{ run: RUN, input: { plan: [{ ...step(1), note: null }] } }]);
});

test("an invalid input names the field and records nothing", async () => {
  const { service, recorded } = fakeService();
  const refused = async (input: unknown, field: string) => {
    const call = handleTicketTool(service, RUN, "ticket_progress", input);
    await expect(call).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(call).rejects.toThrow(field);
  };
  await refused({ plan: Array.from({ length: 31 }, (_, i) => step(i)) }, "plan");
  await refused({ plan: [step(1), step(1)] }, "step ids must be unique");
  await refused({ plan: [{ ...step(1), title: "x".repeat(161) }] }, "plan.0.title");
  await refused({ report: { done: "ok", decisions: Array(11).fill("d") } }, "report.decisions");
  await refused({ report: { done: "ok", files: Array(101).fill("f") } }, "report.files");
  await refused({}, "plan or report required");
  await refused("plan", "Expected object");
  expect(recorded).toEqual([]);
});

test("signal_project goes to the signal service with its raw input", async () => {
  const { service, recorded, signaled } = fakeService();
  const input = { kind: "ticket", title: "Tests" };
  expect(await handleTicketTool(service, RUN, "signal_project", input)).toBe("Signal sig:1 enregistré.");
  expect(signaled).toEqual([{ run: RUN, input }]);
  expect(recorded).toEqual([]);
});

test("skill_review goes to the skill reviews with its raw input", async () => {
  const { service, reviewed, recorded } = fakeService();
  const input = { reviews: [{ skill: "a", verdict: "ok", note: "Bien." }] };
  expect(await handleTicketTool(service, RUN, "skill_review", input)).toBe("1 review enregistrée");
  expect(reviewed).toEqual([{ run: RUN, input }]);
  expect(recorded).toEqual([]);
});

test("any other tool is unknown", async () => {
  const { service, signaled } = fakeService();
  await expect(handleTicketTool(service, RUN, "list_tickets", {})).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(signaled).toEqual([]);
});

test("peek_work goes to the peek service with its raw input", async () => {
  const { service, peeked, signaled } = fakeService();
  const input = { run: "BOU-12", path: "src/lib/format.ts" };
  expect(await handleTicketTool(service, RUN, "peek_work", input)).toBe('{"run":{"id":"r12"}}');
  expect(peeked).toEqual([{ run: RUN, input }]);
  expect(signaled).toEqual([]);
});
