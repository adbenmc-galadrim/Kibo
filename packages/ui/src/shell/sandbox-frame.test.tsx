import { expect, mock, test } from "bun:test";
import type { FileRef, HostToFrame, RpcRequest } from "@kibo/schema";
import { act, render } from "@testing-library/react";
import type { Host } from "./Host";

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

function mount() {
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
        src="about:blank"
        title="Mine"
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
      window.dispatchEvent(new MessageEvent("message", { data, source: win }));
    });
  return { view, iframe, posted, opened, fromFrame };
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

test("the initial load keeps the frame in place", () => {
  const { iframe, view } = mount();
  act(() => {
    iframe.dispatchEvent(new Event("load"));
  });
  expect(view.container.querySelector("iframe")).toBe(iframe);
  expect(view.queryByRole("alert")).toBeNull();
  view.unmount();
});

test("a second load destroys the frame and offers to reload the page", () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    const { iframe, view, posted, fromFrame } = mount();
    act(() => {
      iframe.dispatchEvent(new Event("load"));
      iframe.dispatchEvent(new Event("load"));
    });
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.getByRole("alert").textContent).toContain("Recharge la page");
    expect(errors).toHaveLength(1);
    expect(String(errors[0]?.[0])).toContain("inst-1");
    fromFrame({ kibo: 1, type: "ready" });
    expect(posted).toHaveLength(0);
    expect(listeners.size).toBe(0);
    view.unmount();
  } finally {
    console.error = original;
  }
});
