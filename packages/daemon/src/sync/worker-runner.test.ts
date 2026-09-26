import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import type { AdapterInvoker } from "./builtin-adapter";
import { createWorkerRunner } from "./worker-runner";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const mapped = (bindingId: string) => ({
  remoteId: "1",
  updatedAt: "2026-09-26T10:00:00Z",
  fields: { title: "A", description: "", statusId: "todo", closed: false },
  labels: [],
  ref: {
    kind: "github_issue",
    bindingId,
    repo: "adam/kibo",
    number: 1,
    nodeId: "I_1",
    url: "https://github.com/adam/kibo/issues/1",
  },
});

test("pull and push go through the adapter actions of the binding", async () => {
  const seen: Parameters<AdapterInvoker>[0][] = [];
  const runner = createWorkerRunner(async (req) => {
    seen.push(req);
    return req.action === "adapter.pull"
      ? { items: [mapped("b1")], cursor: "c1", more: false }
      : mapped("b1");
  });
  expect((await runner.pull("p1", binding, null)).cursor).toBe("c1");
  const op = { kind: "update" as const, remoteId: "1", patch: { title: "A" } };
  expect((await runner.push("p1", binding, op)).remoteId).toBe("1");
  expect(seen.map((s) => [s.action, s.bindingId, s.input])).toEqual([
    ["adapter.pull", "b1", { cursor: null }],
    ["adapter.push", "b1", op],
  ]);
});

test("an adapter output is validated before the engine sees it", async () => {
  const bad = createWorkerRunner(async () => ({ items: [{ remoteId: 1 }], cursor: null, more: false }));
  await expect(bad.pull("p1", binding, null)).rejects.toThrow("INTERNAL");
  const unsafe = createWorkerRunner(async () => ({
    ...mapped("b1"),
    ref: { ...mapped("b1").ref, url: "javascript:alert(1)" },
  }));
  await expect(unsafe.push("p1", binding, { kind: "update", remoteId: "1", patch: {} })).rejects.toThrow(
    "INTERNAL",
  );
  const foreign = createWorkerRunner(async () => mapped("b2"));
  await expect(foreign.push("p1", binding, { kind: "update", remoteId: "1", patch: {} })).rejects.toThrow(
    "INTERNAL",
  );
  const foreignPage = createWorkerRunner(async () => ({ items: [mapped("b2")], cursor: null, more: false }));
  await expect(foreignPage.pull("p1", binding, null)).rejects.toThrow("INTERNAL");
});
