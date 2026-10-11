import { expect, test } from "bun:test";
import type { RunLogEntry } from "@kibo/schema";
import { NOW, runFixture } from "../fixtures";
import { hook } from "../run-log-fixture";
import { exchangeOf } from "./exchange";

const at = (minutes: number) => NOW - minutes * 60_000;

test("the exchange keeps the question, the human replies and the session lines, in order", () => {
  const log: RunLogEntry[] = [
    { id: 1, at: at(9), event: { type: "spawned", pid: 1, resume: false, workspace: "repo", guidelines: 0 } },
    {
      id: 2,
      at: at(8),
      event: { type: "hook", payload: hook("PostToolUse", { tool: "Read", detail: "a.ts" }) },
    },
    { id: 3, at: at(7), event: { type: "hook", payload: hook("Notification", { question: "Quel port ?" }) } },
    { id: 4, at: at(6), event: { type: "answered", text: "4747,\npar défaut.", rank: 0 } },
    { id: 5, at: at(5), event: { type: "session", mode: "resumed", from: "r40" } },
    { id: 6, at: at(4), event: { type: "spawned", pid: 2, resume: true, workspace: "repo", guidelines: 0 } },
  ];
  const runs = [runFixture({ id: "r40", label: "repo-dev-1", turns: 1 })];
  expect(exchangeOf(log, runs)).toEqual([
    { key: "3-Notification", at: at(7), kind: "question", text: "Quel port ?" },
    { key: "4-answered", at: at(6), kind: "human", text: "4747,\npar défaut." },
    { key: "5-session", at: at(5), kind: "system", text: "Session : reprise du run repo-dev-1 (1 tour)" },
    { key: "6-SessionStart", at: at(4), kind: "system", text: "reprise de la session" },
  ]);
});

test("without a log there is no exchange", () => {
  expect(exchangeOf(null, [])).toEqual([]);
});
