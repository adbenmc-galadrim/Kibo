import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectDoc, executeProjectCommand } from "@kibo/core";
import { KiboError, Question, Ticket, WAKEUP_PREFIX } from "@kibo/schema";
import { projectWritable, startWakeup, type WakeupBootInput, type WakeupDocs } from "./bootstrap";
import { openWakeupStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-wakeup-boot-"));
  dirs.push(d);
  return d;
};

function docs(readOnly: readonly string[] = []): WakeupDocs {
  return {
    projectIds: () => ["p1", "p2"],
    today: () => "2026-10-16",
    project: () => {
      throw new Error("the snapshot is not read here");
    },
    assertWritable(projectId) {
      if (readOnly.includes(projectId)) throw new KiboError("PERMISSION_DENIED", "read only");
    },
  };
}

const unused = () => {
  throw new Error("not reached");
};
const input = (h: string, d: WakeupDocs): WakeupBootInput => ({
  home: h,
  docs: d,
  agent: () => ({ send: unused }),
});

test("a project is writable only when it exists and accepts writes, without ever throwing", () => {
  const writable = projectWritable(docs(["p2"]));
  expect(writable("p1")).toBe(true);
  expect(writable("p2")).toBe(false);
  expect(writable("p9")).toBe(false);
});

function questionsDoc() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
  const ticket = Ticket.parse(
    executeProjectCommand(doc, { method: "createTicket", title: "Quota", statusId: "todo" }),
  );
  const ask = (title: string) =>
    Question.parse(
      executeProjectCommand(doc, {
        method: "createQuestion",
        ticketId: ticket.id,
        title,
        createdBy: { kind: "agent", ref: "kibo-dev" },
      }),
    );
  const open = ask("Quota par client ?");
  const done = ask("Format ?");
  executeProjectCommand(doc, {
    method: "answerQuestion",
    questionId: done.id,
    answer: { kind: "text", text: "5 Go" },
    by: { kind: "human", ref: "adam" },
  });
  return { doc, open: open.id, done: done.id };
}

test("a wake-up left due by the previous daemon is sent to the project agent at start", () => {
  const { doc, done } = questionsDoc();
  const h = home();
  const store = openWakeupStore(h);
  store.queueAnswer("p1", done, 1);
  store.saveWakeup({ projectId: "p1", lastAt: 1, dueAt: 2 });
  store.close();
  const sent: string[] = [];
  const wakeup = startWakeup({
    ...input(h, { ...docs(), project: () => doc }),
    agent: () => ({
      send(projectId, text) {
        sent.push(`${projectId}:${text}`);
      },
    }),
  });
  wakeup.start();
  wakeup.stop();
  expect(sent).toHaveLength(1);
  expect(sent[0]?.startsWith(`p1:${WAKEUP_PREFIX}1 réponse`)).toBe(true);
});

test("an answer wakes the project agent with its quote, an open question wakes nothing", () => {
  const { doc, open, done } = questionsDoc();
  const sent: string[] = [];
  const wakeup = startWakeup({
    ...input(home(), { ...docs(), project: () => doc }),
    agent: () => ({ send: (_projectId, text) => sent.push(text) }),
    answerGrace: 0,
  });
  try {
    wakeup.wakeOnAnswer("p2", open);
    wakeup.wakeOnAnswer("p1", open);
    expect(sent).toEqual([]);
    wakeup.wakeOnAnswer("p2", done);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("- Q2 répondue : « 5 Go »");
  } finally {
    wakeup.stop();
  }
});

test("an answer that cannot be queued is logged and never breaks the command", () => {
  const errors = spyOn(console, "error").mockImplementation(() => undefined);
  const wakeup = startWakeup(input(home(), docs()));
  wakeup.stop();
  expect(() => wakeup.wakeOnAnswer("p1", "q1")).not.toThrow();
  expect(String(errors.mock.calls[0]?.[0])).toContain("q1");
  errors.mockRestore();
});
