import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentsState, RunView } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { AgentsPort } from "../agents-rpc";
import { NOW, ticketRun } from "../overlaps/peek-fakes.test-helper";
import { LOCAL_CONTEXT as LOCAL } from "../rpc-extensions";
import { hook as subagentHook } from "../subagents/tracker.test-helper";
import { startVisibility, type Visibility } from "./bootstrap";
import { hook } from "./trace.test-helper";

const opened: { home: string; visibility: Visibility }[] = [];

afterEach(() => {
  for (const { home, visibility } of opened.splice(0)) {
    visibility.close();
    rmSync(home, { recursive: true, force: true });
  }
});

function boot(run: RunView) {
  const home = mkdtempSync(join(tmpdir(), "kibo-visibility-boot-"));
  const state = { runs: [run], signals: [] } as unknown as AgentsState;
  const visibility = startVisibility(
    { home, transcriptRoot: join(home, "projects") },
    {
      emit: () => undefined,
      run: () => null,
      project: () => {
        throw new Error("no project in this test");
      },
      projectIds: () => [],
    },
    () => ({ state: () => state, hooks: { verify: () => true, receive: () => null } }),
  );
  opened.push({ home, visibility });
  return visibility;
}

test("a run failed before its start is forgotten and its trace closed, without any turn end", async () => {
  const run = ticketRun("r1", "BOU-12", { transcriptPath: null });
  const visibility = boot(run);
  const inner: HookSink = { verify: () => true, receive: () => null };
  const sink = visibility.hooks(inner);
  const stop = () => sink.receive(run.id, hook("Stop"), null);
  expect(stop()).not.toBeNull();
  expect(stop()).toBeNull();
  await visibility.lifecycle.onEndedWithoutTurn({ ...run, state: "failed", endedAt: NOW });
  expect(visibility.trace.trace(run.id)?.closedAt).not.toBeNull();
  expect(stop()).not.toBeNull();
});

test("subagent hooks reach the tracker, the agents state and the subagent RPC until the run ends", async () => {
  const run = ticketRun("r1", "BOU-12", { transcriptPath: null, sessionId: "s1" });
  const visibility = boot(run);
  const sink = visibility.hooks({ verify: () => true, receive: () => null });
  sink.receive(run.id, subagentHook("SubagentStart", "a1"), null);
  const port = { state: () => ({ runs: [run] }) as unknown as AgentsState } as unknown as AgentsPort;
  expect(visibility.agents(port).state().subagents).toEqual([expect.objectContaining({ id: "a1" })]);
  const listed = await visibility.subagentRpc.handle(
    { method: "runs.subagents", runId: run.id },
    { sessionHash: "x", remote: false },
  );
  expect(listed).toEqual([expect.objectContaining({ id: "a1", state: "running" })]);
  await visibility.lifecycle.onEndedWithoutTurn({ ...run, state: "cancelled", endedAt: NOW });
  sink.receive(run.id, subagentHook("SubagentStart", "a1"), null);
  expect(
    await visibility.subagentRpc.handle({ method: "runs.subagents", runId: run.id }, LOCAL),
  ).toHaveLength(1);
});
