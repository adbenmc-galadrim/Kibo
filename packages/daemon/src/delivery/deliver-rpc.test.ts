import { expect, test } from "bun:test";
import { EMPTY_DELIVERY, INBOX_ID, KiboError } from "@kibo/schema";
import { testAgent } from "../agents/agents-port.test-helper";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import type { DeliverDeps } from "./deliver";
import { deliverRpc } from "./deliver-rpc";

function rig(writable: (projectId: string) => boolean) {
  const assigned: string[] = [];
  const asserted: string[] = [];
  const deps: DeliverDeps = {
    project: () => ({
      delivery: EMPTY_DELIVERY,
      tickets: [{ id: "15", key: "EMIS-15", title: "T", parentId: null, statusId: "todo", startable: true }],
      links: [],
      questions: [],
    }),
    agents: () => [testAgent({ id: "full-delivery", name: "full-delivery" })],
    orchestrator: {
      state: () => ({ runs: [] }),
      assign(input) {
        assigned.push(input.ticketId);
        return runView({ id: "r1", ticketId: input.ticketId });
      },
    },
  };
  const rpc = deliverRpc(deps, {
    assertWritable(projectId) {
      asserted.push(projectId);
      if (!writable(projectId)) throw new KiboError("FORBIDDEN", "read only");
    },
  });
  return { rpc, assigned, asserted };
}

const req = { method: "deliver", projectId: "p1", ticketId: "15" } as const;

test("an editor delivers a ticket through the RPC", async () => {
  const { rpc, assigned, asserted } = rig(() => true);
  expect(rpc.methods).toEqual(["deliver"]);
  expect(await rpc.handle(req, LOCAL_CONTEXT)).toMatchObject({ id: "r1", ticketId: "15" });
  expect(asserted).toEqual(["p1"]);
  expect(assigned).toEqual(["15"]);
});

test("a reader cannot deliver, not even to list the sub-tickets", async () => {
  const { rpc, assigned } = rig(() => false);
  await expect(rpc.handle(req, LOCAL_CONTEXT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(assigned).toEqual([]);
});

test("the inbox is never delivered", async () => {
  const { rpc, assigned } = rig(() => true);
  await expect(rpc.handle({ ...req, projectId: INBOX_ID }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(assigned).toEqual([]);
});
