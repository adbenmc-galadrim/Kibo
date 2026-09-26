import { expect, mock, test } from "bun:test";
import { type ComponentCall, type HostToFrame, KiboError, type Surface } from "@kibo/schema";
import type { FileOpenRequest } from "@kibo/sdk";
import { createFrameBridge, dispatchCombo, MAX_IN_FLIGHT } from "./frame-bridge";

type Options = { call?: (c: ComponentCall) => Promise<unknown>; surface?: Surface };

function setup({ call = async () => ["ok"], surface = "widget" }: Options = {}) {
  const posted: { msg: HostToFrame; origin: string }[] = [];
  const frame = {
    postMessage: (msg: HostToFrame, origin: string) => posted.push({ msg, origin }),
  } as unknown as Window;
  const other = {} as Window;
  const logs: string[] = [];
  const calls: ComponentCall[] = [];
  const handlers = {
    onOpenTicket: mock((_: string) => {}),
    onOpenNewTicket: mock(() => {}),
    onOpenFile: mock((_: FileOpenRequest) => {}),
    onOpenView: mock((_: string) => {}),
    onKey: mock(() => {}),
    onResize: mock((_: number) => {}),
  };
  const bridge = createFrameBridge({
    frame: () => frame,
    init: () => ({ instanceId: "inst-1", config: { filter: "all" }, viewer: "adam", theme: "dark", surface }),
    call: (c) => {
      calls.push(c);
      return call(c);
    },
    ...handlers,
    log: (l) => logs.push(l),
  });
  const from = (source: Window, data: unknown) =>
    bridge.handle(new MessageEvent("message", { data, source: source as MessageEventSource }));
  const messages = () => posted.map((p) => p.msg);
  return { bridge, posted, messages, frame, other, logs, calls, handlers, from };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("ready gets the init message, bound to the frame's own instance, posted to any origin", () => {
  const { posted, frame, from } = setup();
  from(frame, { kibo: 1, type: "ready" });
  expect(posted).toEqual([
    {
      msg: {
        kibo: 1,
        type: "init",
        instanceId: "inst-1",
        config: { filter: "all" },
        viewer: "adam",
        theme: "dark",
        surface: "widget",
      },
      origin: "*",
    },
  ]);
});

test("calls are forwarded without any instanceId read from the message, errors keep their code", async () => {
  const { messages, frame, calls, from } = setup({
    call: async (c) => {
      if (c.kind === "data.keys") throw new KiboError("PERMISSION_DENIED", "no data");
      return [1];
    },
  });
  from(frame, {
    kibo: 1,
    type: "call",
    id: 1,
    call: { kind: "list", entity: "ticket" },
    instanceId: "someone-else",
  });
  from(frame, { kibo: 1, type: "call", id: 2, call: { kind: "data.keys" } });
  await flush();
  expect(calls).toEqual([{ kind: "list", entity: "ticket" }, { kind: "data.keys" }]);
  expect(messages()).toEqual([
    { kibo: 1, type: "reply", id: 1, ok: true, result: [1] },
    { kibo: 1, type: "reply", id: 2, ok: false, error: { code: "PERMISSION_DENIED", message: "no data" } },
  ]);
});

test("an unexpected failure is reported and answered as INTERNAL", async () => {
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const { messages, frame, from } = setup({ call: () => Promise.reject(new Error("boom")) });
    from(frame, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
    await flush();
    expect(messages()).toEqual([
      { kibo: 1, type: "reply", id: 1, ok: false, error: { code: "INTERNAL", message: "internal error" } },
    ]);
    expect(errors).toHaveLength(1);
  } finally {
    console.error = log;
  }
});

test("messages from another window or with a bad shape are ignored and logged", () => {
  const { posted, other, frame, logs, calls, from } = setup();
  from(other, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  from(frame, { kibo: 1, type: "call", id: "x" });
  from(frame, { kibo: 2, type: "ready" });
  expect(calls).toEqual([]);
  expect(posted).toEqual([]);
  expect(logs).toHaveLength(3);
});

test("the 65th call in flight is answered with TIMEOUT", async () => {
  const pending: ((v: unknown) => void)[] = [];
  const { messages, frame, from } = setup({ call: () => new Promise((resolve) => pending.push(resolve)) });
  for (let id = 1; id <= MAX_IN_FLIGHT + 1; id += 1) {
    from(frame, { kibo: 1, type: "call", id, call: { kind: "data.keys" } });
  }
  expect(messages()).toEqual([
    {
      kibo: 1,
      type: "reply",
      id: 65,
      ok: false,
      error: { code: "TIMEOUT", message: "too many calls in flight" },
    },
  ]);
  pending[0]?.(null);
  await flush();
  from(frame, { kibo: 1, type: "call", id: 66, call: { kind: "data.keys" } });
  expect(messages().filter((m) => m.type === "reply" && m.id === 66)).toEqual([]);
  expect(pending).toHaveLength(65);
});

test("an id already in flight is refused, so each id gets a single reply", async () => {
  const pending: ((v: unknown) => void)[] = [];
  const { messages, frame, calls, logs, from } = setup({
    call: () => new Promise((resolve) => pending.push(resolve)),
  });
  from(frame, { kibo: 1, type: "call", id: 7, call: { kind: "data.keys" } });
  from(frame, { kibo: 1, type: "call", id: 7, call: { kind: "data.keys" } });
  pending[0]?.(["a"]);
  await flush();
  expect(calls).toHaveLength(1);
  expect(logs).toHaveLength(1);
  expect(messages()).toEqual([{ kibo: 1, type: "reply", id: 7, ok: true, result: ["a"] }]);
});

test("navigation, shortcuts, resize, theme and change notifications", () => {
  const { bridge, messages, frame, handlers, from } = setup();
  from(frame, { kibo: 1, type: "openTicket", ticketId: "t1" });
  from(frame, { kibo: 1, type: "openNewTicket", defaults: { parentId: "t1" } });
  from(frame, { kibo: 1, type: "openView", componentId: "graph" });
  from(frame, { kibo: 1, type: "openFile", path: "src/a.ts", line: 3 });
  from(frame, { kibo: 1, type: "openFile", path: "src/b.ts" });
  from(frame, { kibo: 1, type: "key", combo: "mod+k" });
  from(frame, { kibo: 1, type: "resize", height: 240 });
  from(frame, { kibo: 1, type: "resize", height: 10_001 });
  expect(handlers.onOpenTicket).toHaveBeenCalledWith("t1");
  expect(handlers.onOpenNewTicket).toHaveBeenCalledWith({ parentId: "t1" });
  expect(handlers.onOpenView).toHaveBeenCalledWith("graph");
  expect(handlers.onOpenFile.mock.calls).toEqual([
    [{ path: "src/a.ts", line: 3, origin: null }],
    [{ path: "src/b.ts", line: null, origin: null }],
  ]);
  expect(handlers.onKey).toHaveBeenCalledWith("mod+k");
  expect(handlers.onResize.mock.calls).toEqual([[240]]);
  bridge.theme("light");
  bridge.changed();
  expect(messages()).toEqual([
    { kibo: 1, type: "theme", theme: "light" },
    { kibo: 1, type: "changed" },
  ]);
});

test("a view ignores resize requests", () => {
  const { frame, handlers, logs, from } = setup({ surface: "view" });
  from(frame, { kibo: 1, type: "resize", height: 240 });
  expect(handlers.onResize).not.toHaveBeenCalled();
  expect(logs).toHaveLength(1);
});

test("dispose answers nothing more", async () => {
  const pending: ((v: unknown) => void)[] = [];
  const { bridge, posted, frame, from } = setup({
    call: () => new Promise((resolve) => pending.push(resolve)),
  });
  from(frame, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  bridge.dispose();
  pending[0]?.(null);
  bridge.theme("light");
  await flush();
  expect(posted).toEqual([]);
});

test("dispatchCombo replays the shortcut as a keydown in the app", () => {
  const seen: string[] = [];
  const target = new EventTarget();
  target.addEventListener("keydown", (e) => {
    if (!(e instanceof KeyboardEvent)) return;
    seen.push(`${e.metaKey || e.ctrlKey ? "mod+" : ""}${e.key}`);
  });
  dispatchCombo("mod+k", target);
  dispatchCombo("mod+3", target);
  dispatchCombo("escape", target);
  expect(seen).toEqual(["mod+k", "mod+3", "Escape"]);
});

test("dispatchCombo reaches the window listeners by default", () => {
  const seen: string[] = [];
  const listener = (e: KeyboardEvent) => seen.push(e.key);
  window.addEventListener("keydown", listener);
  try {
    dispatchCombo("mod+t");
  } finally {
    window.removeEventListener("keydown", listener);
  }
  expect(seen).toEqual(["t"]);
});
