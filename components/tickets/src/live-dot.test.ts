import { expect, test } from "bun:test";
import { liveDot } from "./live-dot";

const session = { tool: "T3 Code", startedAt: 0 };
const run = { ticketId: "1", runId: "r1", label: "opus-dev", state: "running" as const, position: null };

test("a T3 Code session lights the orange dot whatever the execution setting", () => {
  expect(liveDot({ session }, null, "hidden")).toEqual({ kind: "session", tool: "T3 Code" });
  expect(liveDot({ session }, run, "shown")).toEqual({ kind: "session", tool: "T3 Code" });
});

test("a live run lights it only when the execution is shown", () => {
  expect(liveDot({ session: null }, run, "shown")).toEqual({ kind: "run" });
  expect(liveDot({ session: null }, run, "hidden")).toBeNull();
  expect(liveDot({ session: null }, { ...run, state: "done" }, "shown")).toBeNull();
  expect(liveDot({ session: null }, null, "shown")).toBeNull();
});
