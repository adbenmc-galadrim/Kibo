import { expect, spyOn, test } from "bun:test";
import type { HookPayload, HookReply, RunView } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import { withTrace } from "./hooks";
import type { TraceService } from "./trace-service";

const PAYLOAD = { event: "PostToolUse", tool: "Read" } as HookPayload;
const REPLY: HookReply = { kind: "permission", decision: "allow", reason: "", additionalContext: null };
const RUN = { id: "run-1", transcriptPath: "/t/s.jsonl" } as RunView;

function fakes(onHook: TraceService["onHook"]) {
  const received: string[] = [];
  const sink: HookSink = {
    verify: (runId, token) => runId === "run-1" && token === "ok",
    receive(runId) {
      received.push(runId);
      return REPLY;
    },
  };
  const trace = { onHook } as TraceService;
  return { sink, trace, received };
}

test("the sink reply is returned without waiting for the pass", async () => {
  const seen: Array<[RunView, HookPayload]> = [];
  let finish = () => {};
  const { sink, trace, received } = fakes((run, payload) => {
    seen.push([run, payload]);
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const traced = withTrace(sink, { trace, run: () => RUN });
  expect(traced.receive("run-1", PAYLOAD, null)).toBe(REPLY);
  expect(received).toEqual(["run-1"]);
  await Bun.sleep(0);
  expect(seen).toEqual([[RUN, PAYLOAD]]);
  expect(traced.verify("run-1", "ok")).toBe(true);
  expect(traced.verify("run-1", "ko")).toBe(false);
  finish();
});

test("a failing pass is logged, never thrown to the hook", async () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const { sink, trace } = fakes(() => Promise.reject(new Error("boom")));
  const traced = withTrace(sink, { trace, run: () => RUN });
  expect(traced.receive("run-1", PAYLOAD, null)).toBe(REPLY);
  await Bun.sleep(0);
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});

test("an unknown run is not traced", () => {
  let calls = 0;
  const { sink, trace } = fakes(async () => {
    calls += 1;
  });
  const traced = withTrace(sink, { trace, run: () => null });
  expect(traced.receive("run-1", PAYLOAD, null)).toBe(REPLY);
  expect(calls).toBe(0);
});

test("a pass that throws synchronously is logged and the sink reply is kept", async () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const { sink, trace } = fakes(() => {
    throw new Error("SQLITE_BUSY");
  });
  const traced = withTrace(sink, { trace, run: () => RUN });
  expect(traced.receive("run-1", PAYLOAD, null)).toBe(REPLY);
  await Bun.sleep(0);
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});
