import { expect, test } from "bun:test";
import type { RpcRequest } from "../packages/schema/src/index";
import { SILO_LAST_FACTS } from "./fixtures/silo-suivi";
import { verifySiloJournal, waitForMerge } from "./seed-silo-journal";

const FAST = { timeoutMs: 100, pollMs: 1 };
type Item = { kind: string; ticketId: string | null; data: Record<string, unknown> };

function fakeDaemon(pages: Item[][]) {
  let reads = 0;
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    if (req.method === "getProject")
      return { tickets: ["SILO-21", "SILO-32", "SILO-33"].map((key) => ({ id: key.toLowerCase(), key })) };
    const page = pages[Math.min(reads, pages.length - 1)] ?? [];
    reads += 1;
    return { items: page, nextBefore: null };
  };
  return { rpc };
}

const fact = (kind: string, key: string | null, data: Record<string, unknown>): Item => ({
  kind,
  ticketId: key === null ? null : key.toLowerCase(),
  data,
});
const merged = fact("pr_merged", "SILO-21", { number: 18, state: "merged", delivered: "F3" });
const lastFour = [
  fact("pr_opened", "SILO-32", { number: 22, state: "open" }),
  fact("step_set", "SILO-33", { step: 7, note: "" }),
  fact("batch_proposed", null, { seq: 7, actions: 3 }),
  merged,
];

test("the seed waits until the poller has merged the pull request", async () => {
  const daemon = fakeDaemon([[], [fact("pr_opened", "SILO-32", { number: 18 })], [merged]]);
  await waitForMerge(daemon.rpc, "p1", 18, FAST);
});

test("a merge that never comes is reported with its number", async () => {
  const daemon = fakeDaemon([[]]);
  await expect(waitForMerge(daemon.rpc, "p1", 18, FAST)).rejects.toThrow(
    "the PR poller did not merge #18 within 100 ms",
  );
});

test("the journal ends with the four facts of the mockup", async () => {
  expect(SILO_LAST_FACTS.map((f) => f.kind)).toEqual([
    "pr_merged",
    "batch_proposed",
    "step_set",
    "pr_opened",
  ]);
  await verifySiloJournal(fakeDaemon([lastFour]).rpc, "p1");
});

test("a journal in another order stops the seed", async () => {
  const swapped = [lastFour[1], lastFour[0], lastFour[2], lastFour[3]].filter((f) => f !== undefined);
  await expect(verifySiloJournal(fakeDaemon([swapped]).rpc, "p1")).rejects.toThrow("the journal ends with");
});

test("a merge without the delivered feature stops the seed", async () => {
  const plain = [...lastFour.slice(0, 3), fact("pr_merged", "SILO-21", { number: 18 })];
  await expect(verifySiloJournal(fakeDaemon([plain]).rpc, "p1")).rejects.toThrow("pr_merged SILO-21");
});
