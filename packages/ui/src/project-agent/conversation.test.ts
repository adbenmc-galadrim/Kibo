import { expect, test } from "bun:test";
import type { RunLogEntry } from "@kibo/schema";
import { NOW } from "../agents/fixtures";
import { buildConversation, lastUserMessage, panelStatus } from "./conversation";
import { CONVERSATION_LOG, partialBatch, pendingBatch, projectRun } from "./fixtures";

const shape = (items: ReturnType<typeof buildConversation>) =>
  items.map((i) => {
    if (i.kind === "reading") return ["reading", i.tools];
    if (i.kind === "event") return ["event", i.tone, i.retry];
    if (i.kind === "batch") return ["batch", i.batch.id];
    return [i.kind, i.text];
  });

test("a real log becomes messages, grouped reads, the answer and a red retryable failure", () => {
  const items = buildConversation(CONVERSATION_LOG, [], projectRun({ state: "failed" }));
  expect(shape(items)).toEqual([
    ["user", "Où en est-on ?"],
    ["reading", ["list_tickets", "get_ticket EMIS-11"]],
    ["agent", "**EMIS-11** avance ; je propose de le passer en review."],
    ["user", "Et l'export ?"],
    ["event", "red", true],
  ]);
  const failed = items.at(-1);
  expect(failed?.kind === "event" && failed.text).toBe("Échec du tour : démon redémarré pendant le run");
});

test("batches come after the turn that produced them, in creation order", () => {
  const items = buildConversation(CONVERSATION_LOG, [pendingBatch(), partialBatch()], projectRun());
  expect(shape(items).map((s) => s[0])).toEqual([
    "batch",
    "user",
    "reading",
    "agent",
    "batch",
    "user",
    "event",
  ]);
  expect(items.filter((i) => i.kind === "batch").map((i) => i.kind === "batch" && i.batch.id)).toEqual([
    "b0",
    "b1",
  ]);
});

test("a batch proposed in the running turn stays at the end", () => {
  const running: RunLogEntry[] = [
    { id: 1, at: NOW - 3, event: { type: "answered", text: "Plan ?", rank: 0 } },
    { id: 2, at: NOW - 2, event: { type: "spawned", pid: 1, resume: false, workspace: "/w", guidelines: 0 } },
  ];
  const items = buildConversation(
    running,
    [pendingBatch({ createdAt: NOW - 1 })],
    projectRun({ state: "running" }),
  );
  expect(shape(items).map((s) => s[0])).toEqual(["user", "batch"]);
});

test("a fresh session after a missing transcript is said, a resumed one too", () => {
  const log: RunLogEntry[] = [
    { id: 1, at: 1, event: { type: "session", mode: "fresh", reason: "no_previous" } },
    { id: 2, at: 2, event: { type: "session", mode: "fresh", reason: "transcript_missing" } },
    { id: 3, at: 3, event: { type: "session", mode: "resumed", from: "pa1" } },
  ];
  const items = buildConversation(log, [], projectRun());
  expect(items.map((i) => i.kind === "event" && [i.text, i.tone])).toEqual([
    ["Session : nouvelle (transcript introuvable)", "muted"],
    ["Session reprise", "muted"],
  ]);
});

test("only the last failure of the current run offers a retry, and a retry is a muted line", () => {
  const log: RunLogEntry[] = [
    { id: 1, at: 1, event: { type: "answered", text: "A", rank: 0 } },
    { id: 2, at: 2, event: { type: "failed", error: "boom" } },
    { id: 3, at: 3, event: { type: "answered", text: "A", rank: 0 } },
    {
      id: 4,
      at: 4,
      event: { type: "exited", code: 1, isError: true, result: "crash", tokens: 0, costUsd: 0, denied: [] },
    },
  ];
  const items = buildConversation(log, [], projectRun({ state: "failed" }));
  expect(shape(items)).toEqual([
    ["user", "A"],
    ["event", "red", false],
    ["event", "muted", false],
    ["event", "red", true],
  ]);
  expect(
    buildConversation(log, [], projectRun({ state: "done" })).some((i) => i.kind === "event" && i.retry),
  ).toBe(false);
});

test("a question asked through ask_user is shown as an agent message", () => {
  const log: RunLogEntry[] = [
    {
      id: 1,
      at: 1,
      event: {
        type: "hook",
        payload: {
          event: "PostToolUse",
          sessionId: "s",
          transcriptPath: null,
          tool: "mcp__kibo__ask_user",
          detail: null,
          question: "Quel ticket d'abord ?",
          agentId: null,
          ask: null,
        },
      },
    },
  ];
  expect(shape(buildConversation(log, [], projectRun({ state: "waiting_input" })))).toEqual([
    ["agent", "Quel ticket d'abord ?"],
  ]);
});

test("lastUserMessage returns the latest message, or null", () => {
  expect(lastUserMessage(CONVERSATION_LOG)).toBe("Et l'export ?");
  expect(lastUserMessage([])).toBeNull();
});

test("panelStatus: ready without run, queued, thinking, and a pending batch first", () => {
  expect(panelStatus(null, null)).toBe("ready");
  expect(panelStatus(projectRun({ state: "queued" }), null)).toBe("queued");
  expect(panelStatus(projectRun({ state: "starting" }), null)).toBe("thinking");
  expect(panelStatus(projectRun({ state: "running" }), null)).toBe("thinking");
  expect(panelStatus(projectRun({ state: "done" }), null)).toBe("ready");
  expect(panelStatus(projectRun({ state: "running" }), pendingBatch())).toBe("batch");
});
