import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MomentData, RunView } from "@kibo/schema";
import { fakeAgentsPort } from "../agents-port.test-helper";
import { openMomentStore } from "../moments/store";
import { NOW, ticketRun } from "../overlaps/peek-fakes.test-helper";
import { type Subagents, startSubagents } from "./bootstrap";
import { hook, LAUNCH } from "./tracker.test-helper";

const opened: { home: string; subagents: Subagents; close(): void }[] = [];
afterEach(() => {
  for (const each of opened.splice(0)) {
    each.subagents.close();
    each.close();
    rmSync(each.home, { recursive: true, force: true });
  }
});

function boot(runs: RunView[]) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "kibo-subagents-boot-")));
  const moments = openMomentStore(home);
  const marked: MomentData[] = [];
  const changed: string[] = [];
  const subagents = startSubagents({
    home,
    root: join(home, "projects"),
    moments,
    traces: () => ({
      mark: (_runId, data) => marked.push(data),
      subagentPage: (runId, subagentId) => ({
        moments: moments.listSubagent(runId, subagentId),
        internalPlan: null,
        partial: null,
        source: "transcript",
      }),
    }),
    runs: (runId) => runs.find((r) => r.id === runId) ?? null,
    now: () => NOW,
    changed: (runId) => changed.push(runId),
  });
  opened.push({ home, subagents, close: () => moments.close() });
  return { subagents, marked, changed };
}

test("the agents state lists the active subagents of active runs only", () => {
  const active = ticketRun("r1", "BOU-1", { transcriptPath: "/h/projects/p/s1.jsonl", sessionId: "s1" });
  const ended = ticketRun("r2", "BOU-2", { state: "done" });
  const { subagents, changed } = boot([active, ended]);
  subagents.hooks.onHook("r1", hook("SubagentStart", "a1"));
  subagents.hooks.onHook("r1", hook("SubagentStart", "a2"));
  subagents.hooks.onHook("r1", hook("SubagentStop", "a2"));
  subagents.hooks.onHook("r2", hook("SubagentStart", "a3"));
  const state = subagents.agents(fakeAgentsPort([active, ended])).state();
  expect(state.subagents).toEqual([
    { runId: "r1", id: "a1", type: "ecc:code-reviewer", description: "", state: "running", startedAt: NOW },
  ]);
  expect(changed).toContain("r1");
});

test("the subagent RPC reads what the tracker recorded", async () => {
  const run = ticketRun("r1", "BOU-1", { transcriptPath: "/h/projects/p/s1.jsonl", sessionId: "s1" });
  const { subagents } = boot([run]);
  subagents.hooks.onHook("r1", hook("SubagentStart", "a1"));
  const listed = await subagents.rpc.handle(
    { method: "runs.subagents", runId: "r1" },
    { sessionHash: "x", remote: true },
  );
  expect(listed).toEqual([
    expect.objectContaining({ id: "a1", transcriptPath: "/h/projects/p/s1/subagents/agent-a1.jsonl" }),
  ]);
  expect(subagents.rpc.methods).toEqual(["runs.subagents", "runs.subagentMoments"]);
});

test("a launch never linked becomes its own line when the run ends", () => {
  const run = ticketRun("r1", "BOU-1");
  const { subagents, marked } = boot([run]);
  subagents.port.onLines("r1", null, [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: LAUNCH.toolUseId, name: "Agent", input: { subagent_type: "Explore" } },
        ],
      },
    }),
  ]);
  subagents.onRunEnded("r1");
  expect(marked).toEqual([
    { kind: "subagent", subagentId: LAUNCH.toolUseId, type: "Explore", description: "" },
  ]);
});
