import { expect, test } from "bun:test";
import { BackendToDaemon, DaemonToBackend, FrameToHost, HostToFrame } from "./index";

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
