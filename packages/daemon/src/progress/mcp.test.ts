import { expect, test } from "bun:test";
import type { ProgressInput, RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { handleTicketTool } from "./mcp";
import type { ProgressService } from "./service";

const RUN = runView({ id: "r1", state: "running" });
const step = (i: number) => ({ id: `s${i}`, title: `Étape ${i}`, status: "todo" as const });

function fakeService() {
  const recorded: { run: RunView; input: ProgressInput }[] = [];
  const service: Pick<ProgressService, "record"> = {
    record: async (run, input) => {
      recorded.push({ run, input });
      return "Plan enregistré.";
    },
  };
  return { service, recorded };
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

test("any other tool is unknown", async () => {
  const { service } = fakeService();
  await expect(handleTicketTool(service, RUN, "list_tickets", {})).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
