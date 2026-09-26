import { expect, test } from "bun:test";
import type { AgentsState, RunState } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import { agentsFixture, runFixture } from "./fixtures";
import { runNotices, useRunNotifications } from "./use-run-notifications";

test("only entries into waiting, done or failed are announced", () => {
  const previous = new Map<string, RunState>([
    ["a", "running"],
    ["b", "running"],
    ["c", "running"],
    ["d", "queued"],
    ["e", "done"],
  ]);
  const runs = [
    runFixture({
      id: "a",
      label: "opus-dev-2",
      ticketKey: "KIB-14",
      state: "waiting_input",
      question: "Quel port ?",
    }),
    runFixture({
      id: "b",
      label: "opus-dev-1",
      ticketKey: "KIB-12",
      ticketTitle: "Schéma Loro",
      state: "done",
    }),
    runFixture({
      id: "c",
      label: "opus-dev-3",
      ticketKey: "KIB-16",
      state: "failed",
      error: "WORKSPACE_FAILED: x",
    }),
    runFixture({ id: "d", state: "starting" }),
    runFixture({ id: "e", state: "done" }),
    runFixture({ id: "f", state: "done" }),
  ];
  expect(runNotices(previous, runs)).toEqual([
    { title: "opus-dev-2 attend une réponse", body: "KIB-14 · Quel port ?" },
    { title: "opus-dev-1 a terminé", body: "KIB-12 · Schéma Loro" },
    { title: "opus-dev-3 a échoué", body: "KIB-16 · espace de travail indisponible" },
  ]);
});

function withNotification(permission: NotificationPermission, run: (shown: string[]) => void) {
  const shown: string[] = [];
  const saved = globalThis.Notification;
  class FakeNotification {
    static permission = permission;
    onclick: (() => void) | null = null;
    constructor(title: string) {
      shown.push(title);
    }
  }
  Object.assign(globalThis, { Notification: FakeNotification });
  try {
    run(shown);
  } finally {
    Object.assign(globalThis, { Notification: saved });
  }
}

const finish = (state: AgentsState, runId: string): AgentsState => ({
  ...state,
  runs: state.runs.map((r) => (r.id === runId ? { ...r, state: "done" } : r)),
});

test("a granted, enabled browser shows the changes after the first state only", () => {
  withNotification("granted", (shown) => {
    const first = agentsFixture();
    const view = renderHook(({ state }) => useRunNotifications(state, true), {
      initialProps: { state: first },
    });
    expect(shown).toEqual([]);
    view.rerender({ state: finish(first, "r42") });
    expect(shown).toEqual(["opus-dev-1 a terminé"]);
  });
});

test("nothing is shown when disabled or not granted", () => {
  for (const [permission, enabled] of [
    ["granted", false],
    ["default", true],
  ] as const) {
    withNotification(permission, (shown) => {
      const first = agentsFixture();
      const view = renderHook(({ state }) => useRunNotifications(state, enabled), {
        initialProps: { state: first },
      });
      view.rerender({ state: finish(first, "r42") });
      expect(shown).toEqual([]);
    });
  }
});
