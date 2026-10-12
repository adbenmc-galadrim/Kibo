import { expect, test } from "bun:test";
import type { Actor, ProjectCommand } from "@kibo/schema";
import { actAs } from "./mock-actor";

const AGENT: Actor = { kind: "agent", ref: "opus-dev-1" };
const IMPORT: Actor = { kind: "import", ref: "plan" };
const questionId = "q1";

const edits: ProjectCommand[] = [
  { method: "updateQuestion", questionId, by: AGENT, title: "Nouveau titre" },
  { method: "updateAnswer", questionId, by: AGENT, answer: { kind: "text", text: "Non" } },
  { method: "reopenQuestion", questionId, by: AGENT },
  { method: "archiveQuestion", questionId, by: AGENT },
  { method: "restoreQuestion", questionId, by: AGENT },
];

test("the five question edits are signed by the viewer", () => {
  for (const cmd of edits) expect(actAs(cmd, "adam")).toMatchObject({ by: { kind: "human", ref: "adam" } });
});

test("an import keeps its actor on an edit", () => {
  expect(actAs({ method: "reopenQuestion", questionId, by: IMPORT }, "adam")).toMatchObject({ by: IMPORT });
});
