import { expect, test } from "bun:test";
import { type RunLogEntry, WAKEUP_PREFIX } from "@kibo/schema";
import fc from "fast-check";
import { NOW } from "../lib/fixtures";
import { buildConversation, type ConversationItem, lastUserMessage, panelStatus } from "./conversation";
import { CONVERSATION_LOG, hook, partialBatch, pendingBatch, projectRun } from "./fixtures";

const MIN = 60_000;

const shape = (items: ReturnType<typeof buildConversation>) =>
  items.map((i) => {
    if (i.kind === "reading") return ["reading", i.tools];
    if (i.kind === "event") return ["event", i.tone, i.retry];
    if (i.kind === "batch") return ["batch", i.batch.id];
    if (i.kind === "agent") return ["agent", i.text, i.read];
    return [i.kind, i.text];
  });

test("a real log becomes messages, grouped reads, the answer and a red retryable failure", () => {
  const items = buildConversation(CONVERSATION_LOG, [], projectRun({ state: "failed" }));
  expect(shape(items)).toEqual([
    ["user", "Où en est-on ?"],
    [
      "agent",
      "**SILO-11** avance ; je propose de le passer en review.",
      ["list_tickets", "get_ticket SILO-11"],
    ],
    ["user", "Et l'export ?"],
    ["event", "red", true],
  ]);
  const failed = items.at(-1);
  expect(failed?.kind === "event" && failed.text).toBe("Échec du tour : démon redémarré pendant le run");
});

test("batches come after the turn that produced them, in creation order", () => {
  const items = buildConversation(CONVERSATION_LOG, [pendingBatch(), partialBatch()], projectRun());
  expect(shape(items).map((s) => s[0])).toEqual(["batch", "user", "agent", "batch", "user", "event"]);
  expect(items.filter((i) => i.kind === "batch").map((i) => i.kind === "batch" && i.batch.id)).toEqual([
    "b0",
    "b1",
  ]);
});

test("reads before any answer stay a reading line", () => {
  const log: RunLogEntry[] = [
    { id: 1, at: 1, event: { type: "answered", text: "Plan ?", rank: 0 } },
    {
      id: 2,
      at: 2,
      event: { type: "hook", payload: hook("PostToolUse", "mcp__kibo__project_overview", null) },
    },
  ];
  const items = buildConversation(log, [], projectRun({ state: "running" }));
  expect(shape(items)).toEqual([
    ["user", "Plan ?"],
    ["reading", ["project_overview"]],
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
          toolUseId: null,
          ask: null,
          todos: null,
          stopHookActive: false,
        },
      },
    },
  ];
  expect(shape(buildConversation(log, [], projectRun({ state: "waiting_input" })))).toEqual([
    ["agent", "Quel ticket d'abord ?", []],
  ]);
});

test("lastUserMessage returns the latest message, or null", () => {
  expect(lastUserMessage(CONVERSATION_LOG)).toBe("Et l'export ?");
  expect(lastUserMessage([])).toBeNull();
});

test("panelStatus: ready without run, queued, thinking", () => {
  expect(panelStatus(null)).toBe("ready");
  expect(panelStatus(projectRun({ state: "queued" }))).toBe("queued");
  expect(panelStatus(projectRun({ state: "starting" }))).toBe("thinking");
  expect(panelStatus(projectRun({ state: "running" }))).toBe("thinking");
  expect(panelStatus(projectRun({ state: "done" }))).toBe("ready");
});

const WAKEUP =
  "Réveil automatique : 2 signaux à traiter (1 ticket à créer, 1 blocage). Lis « Signaux à traiter » et propose un lot.";

const wakeLog: RunLogEntry[] = [
  { id: 1, at: 10, event: { type: "answered", text: "Où en est-on ?", rank: 0 } },
  exitedAt(2, 20),
  { id: 3, at: 30, event: { type: "answered", text: WAKEUP, rank: 0 } },
  exitedAt(4, 40),
];

function exitedAt(id: number, at: number): RunLogEntry {
  return {
    id,
    at,
    event: { type: "exited", code: 0, isError: false, result: "", tokens: 0, costUsd: 0, denied: [] },
  };
}

const wakeShape = (items: ConversationItem[]) =>
  items.map((i) => (i.kind === "wakeup" ? [i.kind, i.text] : [i.kind]));

test("a wakeup message is a wakeup line, never a message from Adam", () => {
  const items = buildConversation(wakeLog, [], projectRun());
  expect(wakeShape(items)).toEqual([["user"], ["wakeup", "Réveil automatique · 2 signaux"]]);
});

const ANSWER_WAKEUP = `${WAKEUP_PREFIX}1 réponse à lire.\n- Q16 répondue : « 5 Go »\nLis chaque réponse.`;
const MIXED_WAKEUP = `${WAKEUP_PREFIX}2 signaux à traiter (1 ticket à créer, 1 blocage) et 2 réponses à lire.\n- Q16 répondue : « 5 Go »\n- Q17 répondue : « Oui »\nLis « Signaux à traiter ».`;

function answerLog(text: string): RunLogEntry[] {
  return [
    { id: 1, at: 10, event: { type: "answered", text: "Où en est-on ?", rank: 0 } },
    exitedAt(2, 20),
    { id: 3, at: 30, event: { type: "answered", text, rank: 0 } },
    exitedAt(4, 40),
  ];
}

test("a wakeup on an answer is one line per answer", () => {
  expect(wakeShape(buildConversation(answerLog(ANSWER_WAKEUP), [], projectRun()))).toEqual([
    ["user"],
    ["wakeup", "Q16 répondue : « 5 Go »"],
  ]);
});

test("a mixed wakeup lists the answers then the signals, with distinct ids", () => {
  const items = buildConversation(answerLog(MIXED_WAKEUP), [], projectRun());
  expect(wakeShape(items)).toEqual([
    ["user"],
    ["wakeup", "Q16 répondue : « 5 Go »"],
    ["wakeup", "Q17 répondue : « Oui »"],
    ["wakeup", "Réveil automatique · 2 signaux"],
  ]);
  expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
});

test("the batch after a wakeup on an answer says so, and Réessayer ignores the wakeup", () => {
  const log = answerLog(ANSWER_WAKEUP);
  const items = buildConversation(log, [pendingBatch({ id: "b-wake", createdAt: 35 })], projectRun());
  expect(items.flatMap((i) => (i.kind === "batch" ? [[i.batch.id, i.afterWakeup]] : []))).toEqual([
    ["b-wake", true],
  ]);
  expect(lastUserMessage(log)).toBe("Où en est-on ?");
});

test("the batch proposed after a wakeup says so, not the one after a message from Adam", () => {
  const batches = [
    pendingBatch({ id: "b-adam", createdAt: 15 }),
    pendingBatch({ id: "b-wake", createdAt: 35 }),
  ];
  const items = buildConversation(wakeLog, batches, projectRun());
  expect(items.flatMap((i) => (i.kind === "batch" ? [[i.batch.id, i.afterWakeup]] : []))).toEqual([
    ["b-adam", false],
    ["b-wake", true],
  ]);
});

test("lastUserMessage skips wakeups: Réessayer never replays one", () => {
  expect(lastUserMessage(wakeLog)).toBe("Où en est-on ?");
  expect(lastUserMessage(wakeLog.slice(2))).toBeNull();
});

test("superseded batches are left out of the conversation", () => {
  const batches = [
    pendingBatch({ id: "b-old", createdAt: 15, status: "superseded" }),
    pendingBatch({ id: "b-new", createdAt: 35 }),
  ];
  const ids = (items: ConversationItem[]) => items.flatMap((i) => (i.kind === "batch" ? [i.batch.id] : []));
  expect(ids(buildConversation(wakeLog, batches, projectRun()))).toEqual(["b-new"]);
});

test("every message from Adam in the log is a user item, even one sent while the run is queued", () => {
  const log: RunLogEntry[] = [
    { id: 1, at: NOW - 3 * MIN, event: { type: "answered", text: "Fais le point", rank: 0 } },
    { id: 2, at: NOW - 2 * MIN, event: { type: "answered", text: "Et F5 ?", rank: 0 } },
  ];
  const items = buildConversation(log, [], projectRun({ state: "queued" }));
  expect(items.filter((i) => i.kind === "user").map((i) => i.text)).toEqual(["Fais le point", "Et F5 ?"]);
  fc.assert(
    fc.property(
      fc.array(
        fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim() !== ""),
        { maxLength: 8 },
      ),
      (texts) => {
        const entries = texts.map(
          (text, k): RunLogEntry => ({ id: k + 1, at: NOW + k, event: { type: "answered", text, rank: 0 } }),
        );
        expect(buildConversation(entries, [], null).filter((i) => i.kind === "user")).toHaveLength(
          texts.length,
        );
      },
    ),
  );
});
