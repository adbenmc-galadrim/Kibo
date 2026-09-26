import { expect, mock, test } from "bun:test";
import type { FileRef, HostToFrame, RpcRequest } from "@kibo/schema";
import { act, render } from "@testing-library/react";
import type { Host } from "./Host";

const DEADLINE = 30;
const requests: RpcRequest[] = [];
const listeners = new Set<(projectId: string | null) => void>();

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      requests.push(req);
      return Promise.resolve(["t1"]);
    },
    subscribe: (listener: (projectId: string | null) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));

const unmockedModule = "./SandboxFrame?unmocked";
const { SandboxFrame }: typeof import("./SandboxFrame") = await import(unmockedModule);
const { HostProvider }: typeof import("./Host") = await import("./Host");

function mount(src = "about:blank") {
  const opened: FileRef[] = [];
  const host: Host = {
    openTicket: () => {},
    openNewTicket: () => {},
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
        src={src}
        title="Mine"
        readyTimeoutMs={DEADLINE}
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
          src={nextSrc}
          title="Mine"
          readyTimeoutMs={DEADLINE}
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
  return { view, iframe, posted, opened, fromFrame, loaded, navigate, changeSrc };
}

test("the iframe is sandboxed without same-origin and sends no referrer", () => {
  const { iframe, view } = mount();
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
  view.unmount();
});

test("the frame is initialised, its calls reach the daemon for its own instance", async () => {
  const { posted, fromFrame, view } = mount();
  fromFrame({ kibo: 1, type: "ready" });
  fromFrame({ kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(posted[0]).toMatchObject({ type: "init", instanceId: "inst-1", viewer: "adam", surface: "widget" });
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
