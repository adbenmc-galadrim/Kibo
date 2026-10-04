import { expect, mock, test } from "bun:test";
import type { Capability, FileRef, HostToFrame, Phase7Event, RpcRequest, Selection } from "@kibo/schema";
import { createSignal, focusApi, type NewTicketDefaults, selectionApi, visibilityApi } from "@kibo/sdk";
import { act, render } from "@testing-library/react";
import type { InstanceApis } from "../lib/instance-capabilities";
import type { Host } from "./Host";

const DEADLINE = 30;
const requests: RpcRequest[] = [];
let refusalFailure: Error | null = null;
const listeners = new Set<(projectId: string | null) => void>();
const eventListeners = new Set<(event: Phase7Event) => void>();

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      requests.push(req);
      if (req.method === "reportComponentRefusal" && refusalFailure) return Promise.reject(refusalFailure);
      return Promise.resolve(["t1"]);
    },
    subscribe: (listener: (projectId: string | null) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeEvents: (listener: (event: Phase7Event) => void) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  },
}));

const unmockedModule = "./SandboxFrame?unmocked";
const { SandboxFrame }: typeof import("./SandboxFrame") = await import(unmockedModule);
const { HostProvider }: typeof import("./Host") = await import("./Host");

function testApis(capabilities: readonly Capability[] = []) {
  const focus = createSignal(false);
  const visible = createSignal(true);
  const selection = createSignal<Selection | null>(null);
  const focusAsked: boolean[] = [];
  const apis: InstanceApis = {
    capabilities,
    focus: focusApi(focus, (on) => focusAsked.push(on)),
    visibility: visibilityApi(visible),
    selection: selectionApi(selection),
  };
  return { apis, focus, visible, selection, focusAsked };
}

function mount(src = "about:blank", apis: InstanceApis = testApis().apis) {
  const opened: FileRef[] = [];
  const newTickets: NewTicketDefaults[] = [];
  const host: Host = {
    openTicket: () => {},
    openNewTicket: (d) => newTickets.push(d),
    openAssign: () => {},
    openFile: (ref) => opened.push(ref),
    openView: () => {},
    openTarget: () => {},
  };
  const view = render(
    <HostProvider host={host}>
      <SandboxFrame
        projectId="p1"
        instanceId="inst-1"
        config={{ filter: "all" }}
        viewer="adam"
        surface="widget"
        format="large"
        src={src}
        title="Mine"
        readyTimeoutMs={DEADLINE}
        apis={apis}
      />
    </HostProvider>,
  );
  const iframe = view.container.querySelector("iframe");
  const win = iframe?.contentWindow;
  if (!iframe || !win) throw new Error("iframe missing");
  const posted: HostToFrame[] = [];
  win.postMessage = (msg: HostToFrame) => {
    posted.push(msg);
  };
  const fromFrame = (data: unknown) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, source: iframe.contentWindow }));
    });
  const navigate = () =>
    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });
  const nextLoad = () => new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
  const firstLoad = nextLoad();
  const loaded = () =>
    act(async () => {
      await firstLoad;
    });
  const rerender = (nextSrc: string) =>
    view.rerender(
      <HostProvider host={host}>
        <SandboxFrame
          projectId="p1"
          instanceId="inst-1"
          config={{ filter: "all" }}
          viewer="adam"
          surface="widget"
          format="large"
          src={nextSrc}
          title="Mine"
          readyTimeoutMs={DEADLINE}
          apis={apis}
        />
      </HostProvider>,
    );
  const changeSrc = async (nextSrc: string) => {
    const load = nextLoad();
    rerender(nextSrc);
    await act(async () => {
      await load;
    });
  };
  return { view, iframe, posted, opened, newTickets, fromFrame, loaded, navigate, changeSrc };
}

test("a new ticket asked by the frame carries the instance fixed by the host", () => {
  const { newTickets, fromFrame, view } = mount();
  fromFrame({ kibo: 1, type: "openNewTicket", defaults: { statusId: "todo" } });
  expect(newTickets).toEqual([{ statusId: "todo", instanceId: "inst-1" }]);
  view.unmount();
});

test("the iframe is sandboxed without same-origin and sends no referrer", () => {
  const { iframe, view } = mount();
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
  view.unmount();
});

test("the allow attribute is strict by default and opens only granted capabilities", () => {
  const strict = mount();
  expect(strict.iframe.getAttribute("allow")).toBe(
    "autoplay 'none'; gamepad 'none'; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
  );
  expect(strict.iframe.hasAttribute("allowfullscreen")).toBe(false);
  strict.view.unmount();
  const pad = mount("about:blank", testApis(["gamepad", "fullscreen"]).apis);
  expect(pad.iframe.getAttribute("allow")).toBe(
    "autoplay 'none'; gamepad *; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
  );
  expect(pad.iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(pad.iframe.hasAttribute("allowfullscreen")).toBe(false);
  pad.view.unmount();
});

test("init carries capabilities, focus, visibility and selection, then each change follows", () => {
  const t = testApis(["fullscreen"]);
  t.visible.set(false);
  t.selection.set({ kind: "ticket", ids: ["t1"] });
  const { posted, fromFrame, view } = mount("about:blank", t.apis);
  fromFrame({ kibo: 1, type: "ready" });
  expect(posted[0]).toMatchObject({
    type: "init",
    capabilities: ["fullscreen"],
    focus: false,
    visible: false,
    selection: { kind: "ticket", ids: ["t1"] },
  });
  act(() => {
    t.focus.set(true);
    t.visible.set(true);
    t.selection.set(null);
  });
  expect(posted.slice(1)).toEqual([
    { kibo: 1, type: "focus", active: true },
    { kibo: 1, type: "visibility", visible: true },
    { kibo: 1, type: "selection", selection: null },
  ]);
  view.unmount();
  act(() => t.visible.set(false));
  expect(posted).toHaveLength(4);
});

test("focus and selection asked by the frame go to the instance apis", () => {
  const t = testApis(["fullscreen"]);
  const { fromFrame, view } = mount("about:blank", t.apis);
  fromFrame({ kibo: 1, type: "focus", on: true });
  fromFrame({ kibo: 1, type: "focus", on: false });
  fromFrame({ kibo: 1, type: "selection", selection: { kind: "ticket", ids: ["t3"] } });
  expect(t.focusAsked).toEqual([true, false]);
  expect(t.selection.get()).toEqual({ kind: "ticket", ids: ["t3"] });
  view.unmount();
});

test("the frame is initialised, its calls reach the daemon for its own instance", async () => {
  const { posted, fromFrame, view } = mount();
  fromFrame({ kibo: 1, type: "ready" });
  fromFrame({ kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(posted[0]).toMatchObject({
    type: "init",
    instanceId: "inst-1",
    viewer: "adam",
    surface: "widget",
    format: "large",
  });
  expect(requests).toContainEqual({
    method: "componentCall",
    projectId: "p1",
    instanceId: "inst-1",
    call: { kind: "data.keys" },
  });
  expect(posted[1]).toEqual({ kibo: 1, type: "reply", id: 1, ok: true, result: ["t1"] });
  view.unmount();
});

test("resize, files and change notifications go through the host", () => {
  const { iframe, posted, opened, fromFrame, view } = mount();
  fromFrame({ kibo: 1, type: "resize", height: 240 });
  fromFrame({ kibo: 1, type: "openFile", path: "src/a.ts", line: 4 });
  act(() => {
    for (const l of listeners) l("p2");
    for (const l of listeners) l("p1");
  });
  expect(iframe.style.height).toBe("240px");
  expect(opened).toEqual([{ projectId: "p1", worktree: null, path: "src/a.ts", line: 4, origin: null }]);
  expect(posted.filter((m) => m.type === "changed")).toHaveLength(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});

test("only the presence of the frame's own project reaches it", () => {
  const { posted, view } = mount();
  act(() => {
    for (const l of eventListeners) l({ type: "presence.changed", projectId: "p2" });
    for (const l of eventListeners) l({ type: "market.changed" });
  });
  expect(posted.filter((m) => m.type === "changed")).toHaveLength(0);
  act(() => {
    for (const l of eventListeners) l({ type: "presence.changed", projectId: "p1" });
  });
  expect(posted.filter((m) => m.type === "changed")).toHaveLength(1);
  view.unmount();
  expect(eventListeners.size).toBe(0);
});

const pastDeadline = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, DEADLINE * 2));
  });

function captureErrors() {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  const restore = () => {
    console.error = original;
  };
  return { errors, restore };
}

const ready = { kibo: 1, type: "ready" };

test("ready before the first load keeps the frame", async () => {
  const { iframe, view, fromFrame, loaded } = mount();
  fromFrame(ready);
  await loaded();
  await pastDeadline();
  expect(view.container.querySelector("iframe")).toBe(iframe);
  expect(view.queryByRole("alert")).toBeNull();
  view.unmount();
});

test("ready after the first load, within the deadline, keeps the frame", async () => {
  const { iframe, view, fromFrame, loaded } = mount();
  await loaded();
  fromFrame(ready);
  await pastDeadline();
  expect(view.container.querySelector("iframe")).toBe(iframe);
  expect(view.queryByRole("alert")).toBeNull();
  view.unmount();
});

test("a navigation before the first load is caught when ready never comes", async () => {
  const capture = captureErrors();
  try {
    const { view, posted, fromFrame, loaded } = mount();
    await loaded();
    expect(view.queryByRole("alert")).toBeNull();
    await pastDeadline();
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.getByRole("alert").textContent).toContain("Recharge la page");
    expect(capture.errors).toHaveLength(1);
    expect(String(capture.errors[0]?.[0])).toContain("inst-1");
    fromFrame(ready);
    expect(posted).toHaveLength(0);
    expect(listeners.size).toBe(0);
    view.unmount();
  } finally {
    capture.restore();
  }
});

test("a second load destroys the frame and offers to reload the page", async () => {
  const capture = captureErrors();
  try {
    const { view, posted, fromFrame, loaded, navigate } = mount();
    fromFrame(ready);
    await loaded();
    navigate();
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.getByRole("alert").textContent).toContain("Recharge la page");
    expect(capture.errors).toHaveLength(1);
    fromFrame(ready);
    expect(posted).toHaveLength(1);
    expect(listeners.size).toBe(0);
    view.unmount();
  } finally {
    capture.restore();
  }
});

test("a new src gets its own first load, with its own ready", async () => {
  const capture = captureErrors();
  try {
    const { iframe, view, fromFrame, loaded, changeSrc } = mount("about:blank#a");
    fromFrame(ready);
    await loaded();
    await changeSrc("about:blank#b");
    fromFrame(ready);
    await pastDeadline();
    expect(view.container.querySelector("iframe")).toBe(iframe);
    await changeSrc("about:blank#c");
    await pastDeadline();
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(capture.errors).toHaveLength(1);
    view.unmount();
  } finally {
    capture.restore();
  }
});

test("unmounting while waiting for ready leaves no timer behind", async () => {
  const capture = captureErrors();
  try {
    const { view, loaded } = mount();
    await loaded();
    view.unmount();
    await pastDeadline();
    expect(capture.errors).toHaveLength(0);
  } finally {
    capture.restore();
  }
});

const refusals = () => requests.filter((r) => r.method === "reportComponentRefusal");
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

test("a destroyed frame is reported to the daemon as a navigation refusal", async () => {
  const capture = captureErrors();
  requests.length = 0;
  try {
    const { view, fromFrame, loaded, navigate } = mount();
    fromFrame(ready);
    await loaded();
    navigate();
    await settle();
    expect(refusals()).toEqual([
      { method: "reportComponentRefusal", projectId: "p1", instanceId: "inst-1", kind: "navigate" },
    ]);
    expect(capture.errors).toHaveLength(1);
    view.unmount();
  } finally {
    capture.restore();
  }
});

test("a navigation caught by the missing ready is reported too", async () => {
  const capture = captureErrors();
  requests.length = 0;
  try {
    const { view, loaded } = mount();
    await loaded();
    await pastDeadline();
    await settle();
    expect(refusals()).toHaveLength(1);
    view.unmount();
  } finally {
    capture.restore();
  }
});

test("a refusal the daemon cannot record is logged, never swallowed", async () => {
  const capture = captureErrors();
  refusalFailure = new Error("daemon down");
  try {
    const { view, fromFrame, loaded, navigate } = mount();
    fromFrame(ready);
    await loaded();
    navigate();
    await settle();
    expect(capture.errors).toHaveLength(2);
    expect(capture.errors[1]).toContain(refusalFailure);
    view.unmount();
  } finally {
    refusalFailure = null;
    capture.restore();
  }
});
