import { expect, test } from "bun:test";
import {
  type ProjectFingerprint,
  ProjectFingerprintSchema,
  QuestionPrintSchema,
  TicketPrintSchema,
} from "./project-agent-fingerprint";

test("the fingerprint schema reads its own JSON back and refuses garbage", () => {
  const fp: ProjectFingerprint = {
    tickets: {
      t1: {
        key: "SILO-1",
        title: "Un",
        statusId: "todo",
        labels: ["ui"],
        parentId: null,
        assignee: "opus",
        branch: null,
        pr: "#12 (open)",
        blockedBy: ["SILO-3"],
      },
    },
    questions: { q1: "answered" },
    runs: { r1: "running" },
    notes: { "a.md": "h1" },
  };
  expect(ProjectFingerprintSchema.parse(JSON.parse(JSON.stringify(fp)))).toEqual(fp);
  expect(ProjectFingerprintSchema.safeParse({ tickets: 1 }).success).toBe(false);
  expect(ProjectFingerprintSchema.safeParse({ ...fp, runs: { r1: "nope" } }).success).toBe(false);
});

test("a ticket fingerprint without blockers reads as blocked by nobody", () => {
  const print = { key: "BOU-15", title: "Suivi", statusId: "todo", labels: [], parentId: null };
  const parsed = TicketPrintSchema.parse({ ...print, assignee: null, branch: null, pr: null });
  expect(parsed.blockedBy).toEqual([]);
  expect(
    TicketPrintSchema.parse({ ...print, assignee: null, branch: null, pr: null, blockedBy: ["BOU-12"] })
      .blockedBy,
  ).toEqual(["BOU-12"]);
});

test("a question fingerprint is either an old state or a state with title and recipient", () => {
  expect(QuestionPrintSchema.parse("open")).toBe("open");
  const print = { state: "archived", title: "t", recipient: "me" } as const;
  expect(QuestionPrintSchema.parse(print)).toEqual(print);
  expect(QuestionPrintSchema.safeParse({ state: "gone", title: "t", recipient: "me" }).success).toBe(false);
});
