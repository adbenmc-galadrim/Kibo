import { expect, test } from "bun:test";
import { initRun } from "@kibo/core/run-machine";
import type { RunState, RunView } from "@kibo/schema";
import { cancelRun } from "./run-cancel";

const view = (state: RunState): RunView => ({
  ...initRun(
    {
      id: "r1",
      kind: "ticket",
      seq: 1,
      projectId: "p1",
      ticketId: "t1",
      ticketKey: "KIB-1",
      ticketTitle: "Fil",
      profileId: "global:opus",
      profileName: "opus",
      agentScope: "global",
      projectKey: null,
      sessionId: "s1",
      brief: "",
      createdAt: 0,
      resumedFrom: null,
    },
    0,
    0,
  ),
  state,
});

function harness(state: RunState) {
  let current = view(state);
  const calls: string[] = [];
  const deps = {
    registry: {
      get: () => current,
      apply: () => {
        current = { ...current, state: "cancelled" as const };
        return current;
      },
    },
    live: new Map([
      [
        "r1",
        { hash: "h", proc: { pid: 1, kill: () => calls.push("kill"), exited: new Promise<never>(() => {}) } },
      ],
    ]),
    tick: () => calls.push("tick"),
    onEndedWithoutTurn: async (r: RunView) => {
      calls.push(`ended:${r.state}`);
    },
  };
  return { deps, calls };
}

test("cancelling an idle run tells the lifecycle it ended without a turn", async () => {
  for (const state of ["queued", "waiting_input"] as const) {
    const { deps, calls } = harness(state);
    expect(cancelRun(deps, "r1").state).toBe("cancelled");
    await Bun.sleep(0);
    expect(calls).toEqual(["kill", "tick", "ended:cancelled"]);
  }
});

test("cancelling a starting or running run leaves the end to its launcher", async () => {
  for (const state of ["starting", "running"] as const) {
    const { deps, calls } = harness(state);
    cancelRun(deps, "r1");
    await Bun.sleep(0);
    expect(calls).toEqual(["kill", "tick"]);
  }
});
