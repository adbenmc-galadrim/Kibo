import { expect, test } from "bun:test";
import { BackendToDaemon, DaemonToBackend, FrameToHost, HostToFrame, Spotlight } from "./index";

test("frame messages are validated and never carry an instance id", () => {
  const call = FrameToHost.parse({
    kibo: 1,
    type: "call",
    id: 1,
    call: { kind: "list", entity: "ticket" },
    instanceId: "someone-else",
  });
  expect("instanceId" in call).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 2, type: "ready" }).success).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 1, type: "key", combo: "mod+q" }).success).toBe(false);
  expect(FrameToHost.safeParse({ kibo: 1, type: "resize", height: -1 }).success).toBe(false);
});

test("host messages include init with surface and theme", () => {
  const init = HostToFrame.parse({
    kibo: 1,
    type: "init",
    instanceId: "i",
    config: {},
    viewer: "adam",
    theme: "dark",
    surface: "widget",
  });
  expect(init.type).toBe("init");
  expect(
    HostToFrame.safeParse({ kibo: 1, type: "reply", id: 1, ok: false, error: { code: "X", message: "m" } })
      .success,
  ).toBe(true);
});

test("backend messages carry invocations and calls", () => {
  expect(
    DaemonToBackend.safeParse({
      type: "invoke",
      id: 1,
      instanceId: "i",
      config: {},
      target: { migrate: { from: 0, to: 1, config: {}, data: {} } },
      input: null,
    }).success,
  ).toBe(true);
  expect(
    BackendToDaemon.safeParse({ type: "call", id: 3, invocation: 1, call: { kind: "data.keys" } }).success,
  ).toBe(true);
  expect(BackendToDaemon.safeParse({ type: "call", id: 3, call: { kind: "data.keys" } }).success).toBe(false);
  expect(
    BackendToDaemon.safeParse({ type: "ready", actions: ["ping"], jobs: [{ name: "sync", everyMinutes: 0 }] })
      .success,
  ).toBe(false);
});

test("init carries capabilities, focus, visibility and selection, all optional on the wire", () => {
  const legacy = {
    kibo: 1,
    type: "init",
    instanceId: "i",
    config: {},
    viewer: "adam",
    theme: "dark",
    surface: "widget",
  };
  expect(HostToFrame.safeParse(legacy).success).toBe(true);
  const rich = {
    ...legacy,
    capabilities: ["webgl"],
    focus: false,
    visible: true,
    selection: { kind: "ticket", ids: ["t1"] },
  };
  expect(HostToFrame.safeParse(rich).success).toBe(true);
  expect(HostToFrame.safeParse({ kibo: 1, type: "focus", active: true }).success).toBe(true);
  expect(HostToFrame.safeParse({ kibo: 1, type: "visibility", visible: false }).success).toBe(true);
  expect(HostToFrame.safeParse({ kibo: 1, type: "selection", selection: null }).success).toBe(true);
  expect(FrameToHost.safeParse({ kibo: 1, type: "focus", on: true }).success).toBe(true);
  expect(
    FrameToHost.safeParse({ kibo: 1, type: "selection", selection: { kind: "ticket", ids: [] } }).success,
  ).toBe(false);
});

test("openView may name a question, the host sends the spotlight", () => {
  const open = { kibo: 1, type: "openView", componentId: "questions" };
  expect(FrameToHost.parse({ ...open, question: "q1" })).toMatchObject({ question: "q1" });
  expect(FrameToHost.safeParse(open).success).toBe(true);
  expect(FrameToHost.safeParse({ ...open, question: "" }).success).toBe(false);
  const spotlight = { kind: "question", id: "q1" };
  expect(HostToFrame.safeParse({ kibo: 1, type: "spotlight", spotlight }).success).toBe(true);
  expect(HostToFrame.safeParse({ kibo: 1, type: "spotlight", spotlight: null }).success).toBe(true);
  expect(
    HostToFrame.safeParse({ kibo: 1, type: "spotlight", spotlight: { kind: "ticket", id: "t" } }).success,
  ).toBe(false);
  expect(Spotlight.safeParse({ kind: "question", id: "" }).success).toBe(false);
});

test("a frame may ask the host to open a sprint", () => {
  expect(FrameToHost.parse({ kibo: 1, type: "openSprint", sprintId: "s42" })).toEqual({
    kibo: 1,
    type: "openSprint",
    sprintId: "s42",
  });
  expect(FrameToHost.safeParse({ kibo: 1, type: "openSprint", sprintId: "" }).success).toBe(false);
});

test("a spotlight may ask for a new question on a ticket, or for a new feature", () => {
  expect(Spotlight.parse({ kind: "newQuestion", ticketId: "f5" })).toEqual({
    kind: "newQuestion",
    ticketId: "f5",
  });
  expect(Spotlight.parse({ kind: "newFeature" })).toEqual({ kind: "newFeature" });
  expect(Spotlight.safeParse({ kind: "newQuestion" }).success).toBe(false);
  const open = { kibo: 1, type: "openView", componentId: "questions" };
  expect(FrameToHost.safeParse({ ...open, intent: { kind: "newQuestion", ticketId: "t1" } }).success).toBe(
    true,
  );
  expect(FrameToHost.safeParse({ ...open, intent: { kind: "ticket" } }).success).toBe(false);
});
