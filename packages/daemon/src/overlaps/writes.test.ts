import { expect, test } from "bun:test";
import type { HookPayload } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import { withOverlapWrites } from "./writes";

const hook = (event: HookPayload["event"], tool: string, detail: string | null): HookPayload => ({
  event,
  sessionId: "s",
  transcriptPath: null,
  tool,
  detail,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
});

function setup(onWrite: (runId: string, path: string) => void | Promise<void>) {
  const log: string[] = [];
  const sink: HookSink = {
    verify: () => true,
    receive: () => {
      log.push("inner");
      return null;
    },
  };
  const wrapped = withOverlapWrites(sink, {
    onWrite: (runId, path) => {
      log.push(`write ${runId} ${path}`);
      return onWrite(runId, path);
    },
    log: (line) => log.push(line),
  });
  return { wrapped, log };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

test("a file written by a modifying tool is checked after the reply", async () => {
  const { wrapped, log } = setup(() => undefined);
  wrapped.receive("r1", hook("PostToolUse", "Edit", "/abs/src/a.ts"), null);
  log.push("replied");
  await settle();
  expect(log).toEqual(["inner", "replied", "write r1 /abs/src/a.ts"]);
});

test("a notebook edit is checked, a shell command or a pre tool use is not", async () => {
  const { wrapped, log } = setup(() => undefined);
  wrapped.receive("r1", hook("PostToolUse", "NotebookEdit", "/abs/n.ipynb"), null);
  wrapped.receive("r1", hook("PostToolUse", "Bash", "rm -rf src"), null);
  wrapped.receive("r1", hook("PreToolUse", "Write", "/abs/src/b.ts"), null);
  wrapped.receive("r1", hook("PostToolUse", "Write", null), null);
  await settle();
  expect(log.filter((l) => l.startsWith("write"))).toEqual(["write r1 /abs/n.ipynb"]);
});

test("a failing check never reaches the hook", async () => {
  const { wrapped, log } = setup(async () => {
    throw new Error("boom");
  });
  expect(wrapped.receive("r1", hook("PostToolUse", "Write", "/abs/src/a.ts"), null)).toBeNull();
  await settle();
  expect(log.at(-1)).toContain("boom");
});
