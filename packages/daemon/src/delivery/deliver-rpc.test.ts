import { expect, test } from "bun:test";
import { EMPTY_DELIVERY, INBOX_ID, KiboError } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import type { DeliverDeps } from "./deliver";
import { deliverRpc } from "./deliver-rpc";

function rig(writable: (projectId: string) => boolean) {
  const asserted: string[] = [];
  const deps: DeliverDeps = {
    project: () => ({ delivery: EMPTY_DELIVERY, tickets: [], links: [], questions: [] }),
    agents: () => [],
    orchestrator: { state: () => ({ runs: [] }) },
  };
  const rpc = deliverRpc(deps, {
    assertWritable(projectId) {
      asserted.push(projectId);
      if (!writable(projectId)) throw new KiboError("FORBIDDEN", "read only");
    },
  });
  return { rpc, asserted };
}

const req = { method: "deliver", projectId: "p1", ticketId: "15" } as const;

test("an editor reaches the delivery through the RPC, which refuses it", async () => {
  const { rpc, asserted } = rig(() => true);
  expect(rpc.methods).toEqual(["deliver"]);
  await expect(rpc.handle(req, LOCAL_CONTEXT)).rejects.toMatchObject({ code: "AGENT_EXECUTION_REMOVED" });
  expect(asserted).toEqual(["p1"]);
});

test("a reader cannot deliver", async () => {
  const { rpc } = rig(() => false);
  await expect(rpc.handle(req, LOCAL_CONTEXT)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("the inbox is never delivered", async () => {
  const { rpc } = rig(() => true);
  await expect(rpc.handle({ ...req, projectId: INBOX_ID }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});
