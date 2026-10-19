import { expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { denialNotice, withDenialQuestions } from "./denial-turn";

const run = runView({ id: "r1", ticketKey: "SILO-15", state: "done" });

test("the denial question is asked after the trace of the turn, even when the turn end failed", async () => {
  const calls: string[] = [];
  const lifecycle = withDenialQuestions(
    {
      onTurnEnd: async (r: RunView) => {
        calls.push(`trace:${r.id}`);
        throw new Error("trace failed");
      },
    },
    (r) => {
      calls.push(`ask:${r.id}`);
      return null;
    },
    (line) => calls.push(line),
  );
  await expect(lifecycle.onTurnEnd(run)).rejects.toThrow("trace failed");
  expect(calls).toEqual(["trace:r1", "ask:r1"]);
});

test("a failing denial question is journaled and never breaks the turn end", async () => {
  const logs: string[] = [];
  const lifecycle = withDenialQuestions(
    { onTurnEnd: async (_r: RunView) => {} },
    () => {
      throw new Error("quota");
    },
    (line) => logs.push(line),
  );
  await lifecycle.onTurnEnd(run);
  expect(logs).toEqual(["denial question of run r1 failed: quota"]);
});

test("the notice names the ticket and the number of refused actions", () => {
  expect(denialNotice(run, 7)).toEqual({
    title: "SILO-15 : 7 actions refusées",
    body: "Kibo propose des règles",
  });
  expect(denialNotice({ ...run, ticketKey: null, label: "silo · livraison" }, 1)).toEqual({
    title: "silo · livraison : 1 action refusée",
    body: "Kibo propose des règles",
  });
});
