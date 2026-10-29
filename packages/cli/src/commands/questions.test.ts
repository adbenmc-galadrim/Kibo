import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectCommand, RpcRequest } from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";
import { fakeQuestion, QUESTIONS, RECIPIENTS } from "../questions/question-test-kit";
import { questionsCommand } from "./questions";
import { type FakeDaemonOptions, fakeDaemon } from "./tickets-test-kit";

const dir = mkdtempSync(join(tmpdir(), "kibo-questions-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const HUMAN = { kind: "human", ref: "u-me" };

function withQuestions(inner: DaemonClient): DaemonClient {
  return {
    ...inner,
    async rpc(req) {
      const sent: RpcRequest = req;
      if (sent.method !== "getProject") return inner.rpc(req);
      const snapshot = await inner.rpc(sent);
      return { ...snapshot, questions: QUESTIONS, questionRecipients: RECIPIENTS } as never;
    },
  };
}

async function questions(
  positional: string[],
  flags: Record<string, string | true | string[]>,
  options: FakeDaemonOptions = {},
) {
  const d = fakeDaemon(undefined, undefined, options);
  const client = withQuestions(d.client);
  const code = await questionsCommand(positional, flags, d.io, async () => client, dir);
  return { ...d, code };
}

describe("kibo questions list", () => {
  test("list prints the open questions of a ticket", async () => {
    const d = await questions(["list", "SILO-33"], {});
    expect(d.code).toBe(0);
    expect(d.out).toEqual(["#1 [open] Quel format ? → client (bloquante)", "    - A", "    - B"]);
  });

  test("--all adds the archived", async () => {
    const d = await questions(["list", "SILO-33"], { all: true });
    expect(d.out).toEqual([
      "#1 [open] Quel format ? → client (bloquante)",
      "    - A",
      "    - B",
      "#2 [archived] Ancienne question → moi",
    ]);
  });

  test("--json", async () => {
    const d = await questions(["list", "SILO-33"], { json: true });
    const [only] = JSON.parse(d.out.join("\n"));
    expect(only).toMatchObject({ id: "q1", number: 1, state: "open", recipient: { id: "r-client" } });
  });

  test("a ticket without questions says so", async () => {
    const d = await questions(["list", "SILO-50"], {});
    expect(d.code).toBe(0);
    expect(d.out).toEqual(["Aucune question sur SILO-50."]);
  });

  test("an unknown ticket exits 1", async () => {
    const d = await questions(["list", "SILO-99"], {});
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Ticket introuvable : SILO-99"]);
  });
});

describe("kibo questions add", () => {
  const numbered: FakeDaemonOptions = {
    onCommand: (command: ProjectCommand) =>
      command.method === "createQuestion"
        ? fakeQuestion({ id: "q3", number: 3, title: command.title, options: command.options })
        : {},
  };

  test("add sends createQuestion with the human actor and the options", async () => {
    const d = await questions(
      ["add", "SILO-33", "Quel format ?"],
      { option: ["A", "B"], recipient: "client", blocking: true },
      numbered,
    );
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      {
        method: "createQuestion",
        ticketId: "a",
        title: "Quel format ?",
        options: ["A", "B"],
        blocking: true,
        recipient: "r-client",
        createdBy: HUMAN,
        runId: null,
      },
    ] as ProjectCommand[]);
    expect(d.out).toEqual(["✓ Question #3 ajoutée sur SILO-33"]);
  });

  test("--json prints the created question", async () => {
    const d = await questions(["add", "SILO-33", "Quel format ?"], { option: "A", json: true }, numbered);
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "q3", number: 3, options: ["A"] });
  });

  test("add needs at least one --option", async () => {
    const d = await questions(["add", "SILO-33", "Quel format ?"], {});
    expect(d.code).toBe(2);
    expect(d.err.join("\n")).toContain("kibo questions add");
    expect(d.calls).toEqual([]);
  });

  test("--provisional must be an option", async () => {
    const d = await questions(["add", "SILO-33", "Quel format ?"], { option: ["A", "B"], provisional: "C" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Le choix provisoire doit être une des options."]);
    expect(d.commands()).toEqual([]);
  });

  test("--provisional among the options is sent", async () => {
    const d = await questions(["add", "SILO-33", "Q ?"], { option: ["A", "B"], provisional: "B" });
    expect(d.commands()[0]).toMatchObject({ provisional: "B", blocking: false });
  });

  test("an unknown recipient lists the known ones", async () => {
    const d = await questions(["add", "SILO-33", "Q ?"], { option: "A", recipient: "x" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Destinataire inconnu : x. Destinataires : moi, client"]);
    expect(d.commands()).toEqual([]);
  });

  test("--context @file", async () => {
    writeFileSync(join(dir, "contexte.md"), "Le client hésite.\n");
    const d = await questions(["add", "SILO-33", "Q ?"], { option: "A", context: "@contexte.md" });
    expect(d.code).toBe(0);
    expect(d.commands()[0]).toMatchObject({ context: "Le client hésite.\n" });
  });

  test("a valueless --option or a missing title is a usage error", async () => {
    expect((await questions(["add", "SILO-33", "Q ?"], { option: true })).code).toBe(2);
    expect((await questions(["add", "SILO-33"], { option: "A" })).code).toBe(2);
  });
});

describe("kibo questions answer", () => {
  test("answer by number picks the option kind when the text is an option", async () => {
    const d = await questions(["answer", "1", "A"], { project: "SILO" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      { method: "answerQuestion", questionId: "q1", answer: { kind: "option", option: "A" }, by: HUMAN },
    ] as ProjectCommand[]);
    expect(d.out).toEqual(["✓ Question #1 répondue : A"]);
  });

  test("answer with free text", async () => {
    const d = await questions(["answer", "q1", "Plutôt C"], { project: "SILO" });
    expect(d.commands()).toEqual([
      { method: "answerQuestion", questionId: "q1", answer: { kind: "text", text: "Plutôt C" }, by: HUMAN },
    ] as ProjectCommand[]);
    expect(d.out).toEqual(["✓ Question #1 répondue : Plutôt C"]);
  });

  test("--json prints the answered question", async () => {
    const answered = fakeQuestion({
      id: "q1",
      number: 1,
      options: ["A", "B"],
      answer: { kind: "option", option: "A", text: "" },
    });
    const d = await questions(
      ["answer", "1", "A"],
      { project: "SILO", json: true },
      { onCommand: () => answered },
    );
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "q1", answer: { option: "A" } });
  });

  test("an unknown question exits 1", async () => {
    const d = await questions(["answer", "7", "A"], { project: "SILO" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Question introuvable : 7"]);
    expect(d.commands()).toEqual([]);
  });

  test("answer needs --project", async () => {
    const d = await questions(["answer", "1", "A"], {});
    expect(d.code).toBe(2);
    expect(d.err.join("\n")).toContain("kibo questions answer");
    expect(d.calls).toEqual([]);
  });
});
