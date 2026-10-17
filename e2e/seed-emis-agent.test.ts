import { expect, test } from "bun:test";
import type { RpcRequest } from "../packages/schema/src/index";
import { EMIS_AGENT_PROMPT } from "./fixtures/emis-suivi";
import { seedEmisAgent } from "./seed-emis-agent";

const FAST = { timeoutMs: 200, pollMs: 1 };
const batch = (seq: number, status: string) => ({ seq, status });
type View = { run: { id?: string; state: string } | null; batches: { seq: number; status: string }[] };

function fakeAgent(views: View[]) {
  const sent: RpcRequest[] = [];
  let polls = 0;
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    if (req.method === "sendProjectAgentMessage") {
      sent.push(req);
      return { id: "run-2", state: "queued" };
    }
    const view = views[Math.min(polls, views.length - 1)];
    polls += 1;
    return view;
  };
  return { rpc, sent };
}

const idle: View = { run: null, batches: [] };
const running: View = {
  run: { id: "run-2", state: "running" },
  batches: [batch(6, "superseded"), batch(7, "pending")],
};
const proposed: View = {
  run: { id: "run-2", state: "done" },
  batches: [batch(6, "superseded"), batch(7, "pending")],
};

test("asks for the point of the day once and waits for the end of the turn with batch 7", async () => {
  const agent = fakeAgent([idle, { run: { state: "queued" }, batches: [] }, running, proposed]);
  expect(await seedEmisAgent(agent.rpc, "p1", FAST)).toBe(true);
  expect(agent.sent).toEqual([
    { method: "sendProjectAgentMessage", projectId: "p1", text: EMIS_AGENT_PROMPT },
  ]);
});

test("a second seeding sends nothing when batch 7 is already pending", async () => {
  const agent = fakeAgent([proposed]);
  expect(await seedEmisAgent(agent.rpc, "p1", FAST)).toBe(false);
  expect(agent.sent).toEqual([]);
});

test("a failed turn stops the seed", async () => {
  const agent = fakeAgent([idle, { run: { id: "run-2", state: "failed" }, batches: [] }]);
  await expect(seedEmisAgent(agent.rpc, "p1", FAST)).rejects.toThrow("the project agent turn ended failed");
});

test("a turn that ends without batch 7 stops the seed", async () => {
  const agent = fakeAgent([idle, { run: { id: "run-2", state: "done" }, batches: [batch(6, "pending")] }]);
  await expect(seedEmisAgent(agent.rpc, "p1", FAST)).rejects.toThrow("ended without batch 7");
});

test("a turn that never ends is reported", async () => {
  const agent = fakeAgent([idle, running]);
  await expect(seedEmisAgent(agent.rpc, "p1", FAST)).rejects.toThrow(
    "batch 7 was not proposed within 200 ms",
  );
});

test("a previous run already done is not read as the end of the new turn", async () => {
  const previous: View = { run: { id: "run-1", state: "done" }, batches: [batch(6, "pending")] };
  const agent = fakeAgent([previous, previous, running, proposed]);
  expect(await seedEmisAgent(agent.rpc, "p1", FAST)).toBe(true);
});
