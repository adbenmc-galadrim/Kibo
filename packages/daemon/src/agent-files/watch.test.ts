import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { WatchTarget } from "../code/watcher";
import { makeTestHome, PROJECT_ID } from "./test-home.test-helper";
import { agentWatchTargets, type WatchPathsFn, watchAgentRoots } from "./watch";

const fakeWatch = () => {
  const calls: { targets: WatchTarget[]; fire: () => void; closed: boolean }[] = [];
  const watch: WatchPathsFn = (targets, onChange) => {
    const call = { targets, fire: () => onChange(null), closed: false };
    calls.push(call);
    return {
      mode: () => "watch",
      close: () => {
        call.closed = true;
      },
    };
  };
  return { calls, watch };
};

test("only existing agent folders are watched", () => {
  const h = makeTestHome();
  const projects = [{ id: PROJECT_ID, folder: h.projectFolder }];
  expect(agentWatchTargets(h.roots, projects)).toEqual([]);
  mkdirSync(join(h.projectFolder, ".claude", "agents"), { recursive: true });
  expect(agentWatchTargets(h.roots, projects)).toEqual([join(h.projectFolder, ".claude", "agents")]);
});

test("a change calls back and close stops the watcher", () => {
  const h = makeTestHome();
  mkdirSync(join(h.claudeHome, "agents"), { recursive: true });
  const { calls, watch } = fakeWatch();
  let changes = 0;
  const w = watchAgentRoots(h.roots, [], () => changes++, { watch });
  expect(calls[0]?.targets).toEqual([{ path: join(h.claudeHome, "agents"), recursive: false }]);
  calls[0]?.fire();
  expect(changes).toBe(1);
  w.close();
  expect(calls[0]?.closed).toBe(true);
});

test("beyond the limit the watch is partial", () => {
  const h = makeTestHome();
  const projects = Array.from({ length: 3 }, (_, i) => {
    const folder = join(h.root, `p${i}`);
    mkdirSync(join(folder, ".claude", "agents"), { recursive: true });
    return { id: `p${i}`, folder };
  });
  const { calls, watch } = fakeWatch();
  const w = watchAgentRoots(h.roots, projects, () => undefined, { watch, limit: 2 });
  expect(w.partial).toBe(true);
  expect(calls[0]?.targets).toHaveLength(2);
});
