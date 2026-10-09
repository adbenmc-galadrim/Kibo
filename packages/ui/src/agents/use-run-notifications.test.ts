import { expect, test } from "bun:test";
import type { AgentsState, RunState } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import { agentsFixture, runFixture } from "./fixtures";
import { batchNotices, runNotices, useRunNotifications } from "./use-run-notifications";

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

test("a failed run names the cause of its failure", () => {
  const runs = [
    runFixture({
      id: "c",
      label: "opus-dev-3",
      ticketKey: "KIB-16",
      state: "failed",
      error: "PROJECT_FOLDER_NOT_FOUND: folder /x does not exist",
    }),
  ];
  expect(runNotices(new Map<string, RunState>([["c", "running"]]), runs)).toEqual([
    { title: "opus-dev-3 a échoué", body: "KIB-16 · dossier du projet introuvable" },
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

test("a question asked by a running agent is announced once, with its ticket", () => {
  withNotification("granted", (shown) => {
    const first = agentsFixture();
    const run = first.runs.find((r) => r.state === "running");
    if (!run) throw new Error("fixture has no running run");
    const asked = (open: number): AgentsState => ({
      ...first,
      questions: [{ runId: run.id, open, undelivered: 0, latestTitle: "Bloquer le dépôt ?" }],
    });
    const view = renderHook(({ state }) => useRunNotifications(state, true), {
      initialProps: { state: first },
    });
    view.rerender({ state: asked(1) });
    view.rerender({ state: asked(1) });
    view.rerender({ state: asked(0) });
    expect(shown).toEqual([`${run.label} a posé une question`]);
  });
});

const withBatch = (state: AgentsState, pendingBatchId: string | null): AgentsState => ({
  ...state,
  runs: [
    ...state.runs,
    runFixture({ id: "pa1", kind: "project", ticketKey: null, ticketTitle: "Agent de projet · Emis" }),
  ],
  projectAgents: [{ projectId: "emis", runId: "pa1", state: "done", pendingBatchId }],
});

test("a batch waiting for validation is announced once as « Lot à valider »", () => {
  const first = agentsFixture();
  expect(batchNotices(new Map(), withBatch(first, "b1"))).toEqual([
    { title: "Lot à valider", body: "Agent de projet · Emis" },
  ]);
  expect(batchNotices(new Map([["emis", "b1"]]), withBatch(first, "b1"))).toEqual([]);
  expect(batchNotices(new Map([["emis", "b1"]]), withBatch(first, null))).toEqual([]);
  withNotification("granted", (shown) => {
    const view = renderHook(({ state }) => useRunNotifications(state, true), {
      initialProps: { state: withBatch(first, null) },
    });
    view.rerender({ state: withBatch(first, "b1") });
    view.rerender({ state: withBatch(first, "b1") });
    view.rerender({ state: withBatch(first, "b2") });
    expect(shown).toEqual(["Lot à valider", "Lot à valider"]);
  });
});
