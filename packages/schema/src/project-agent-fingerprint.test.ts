import { expect, test } from "bun:test";
import { type ProjectFingerprint, ProjectFingerprintSchema } from "./project-agent-fingerprint";

test("the fingerprint schema reads its own JSON back and refuses garbage", () => {
  const fp: ProjectFingerprint = {
    tickets: {
      t1: {
        key: "EMIS-1",
        title: "Un",
        statusId: "todo",
        labels: ["ui"],
        parentId: null,
        assignee: "opus",
        branch: null,
        pr: "#12 (open)",
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
