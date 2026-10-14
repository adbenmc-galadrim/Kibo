import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSubagentSources } from "./sources";
import { openSubagentStore } from "./store";
import { subagentTracePath } from "./trace";
import { createSubagentTracker } from "./tracker";
import { hook } from "./tracker.test-helper";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function daemon(home: string, root: string) {
  const store = openSubagentStore(home);
  const transcriptPath = join(root, "proj", "s1.jsonl");
  const tracker = createSubagentTracker({
    store,
    now: () => 7,
    transcriptOf: (_runId, agentId) => subagentTracePath({ transcriptPath, sessionId: "s1", agentId }),
    announce: () => undefined,
  });
  return { store, tracker, sources: createSubagentSources({ store, tracker, root, now: () => 7 }) };
}

test("the reading offset of a subagent is taken back after a restart", () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "kibo-sources-")));
  dirs.push(home);
  const root = join(home, "projects");
  mkdirSync(join(root, "proj"), { recursive: true });
  const first = daemon(home, root);
  first.tracker.onHook("r1", hook("SubagentStart"));
  const [source] = first.sources.sources("r1");
  if (source === undefined) throw new Error("no source");
  expect(source).toEqual({
    subagentId: "a1",
    path: join(root, "proj", "s1", "subagents", "agent-a1.jsonl"),
    offset: 0,
    ended: false,
  });
  expect(first.sources.read(source.path, 0, 1024)).toEqual({ lines: [], offset: 0, more: false });
  first.sources.advanced("r1", source, 120, false);
  first.store.close();
  const restarted = daemon(home, root);
  expect(restarted.sources.sources("r1")).toEqual([{ ...source, offset: 120 }]);
  restarted.sources.advanced("r1", source, 150, true);
  expect(restarted.sources.sources("r1")).toEqual([]);
  restarted.store.close();
});
