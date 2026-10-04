import { afterEach, expect, test } from "bun:test";
import { ComponentManifest, type FrameToHost, type HostToFrame, KiboError } from "@kibo/schema";
import { act, screen, waitFor } from "@testing-library/react";
import { useEntities, useSdk } from "./react";
import { comboOf, createFrameSdk, type FramePort, mountSandboxed, windowPort } from "./sandbox";

function fakePort() {
  const sent: FrameToHost[] = [];
  const listeners = new Set<(m: HostToFrame) => void>();
  const port: FramePort = {
    post: (m) => sent.push(m),
    listen: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
  const deliver = (m: HostToFrame) => {
    act(() => {
      for (const listener of [...listeners]) listener(m);
    });
  };
  return { port, sent, deliver, listeners };
}

const manifest = {
  id: "probe",
  version: "0.1.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket"],
  writes: [],
};
const init = {
  kibo: 1,
  type: "init",
  instanceId: "i1",
  config: {},
  viewer: "adam",
  theme: "light",
  surface: "view",
} as const;

const mounts: Array<() => void> = [];
const mount = (port: FramePort) => mounts.push(mountSandboxed(manifest, Probe, port));

afterEach(() => {
  for (const unmount of mounts.splice(0)) unmount();
});

function Probe() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <button type="button" onClick={() => sdk.openTicket("t1")}>
      {sdk.viewer} {tickets.data.length} {tickets.error?.code ?? ""}
    </button>
  );
}

test("the frame says ready, mounts on init and calls the host for data", async () => {
  const { port, sent, deliver } = fakePort();
  mount(port);
  expect(sent[0]).toEqual({ kibo: 1, type: "ready" });
  deliver({ ...init, theme: "dark", surface: "widget" });
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await waitFor(() => expect(sent.some((m) => m.type === "call")).toBe(true));
  const call = sent.find((m) => m.type === "call");
  expect(call?.type === "call" && call.call).toEqual({ kind: "list", entity: "ticket" });
  deliver({
    kibo: 1,
    type: "reply",
    id: call?.type === "call" ? call.id : 0,
    ok: true,
    result: [{ id: "a" }, { id: "b" }],
  });
  expect(await screen.findByText(/adam 2/)).toBeTruthy();
  screen.getByRole("button").click();
  expect(sent.at(-1)).toEqual({ kibo: 1, type: "openTicket", ticketId: "t1" });
  deliver({ kibo: 1, type: "theme", theme: "light" });
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("error replies become KiboErrors and changes trigger a reload", async () => {
  const { port, sent, deliver } = fakePort();
  mount(port);
  deliver(init);
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(1));
  const first = sent.find((m) => m.type === "call");
  deliver({
    kibo: 1,
    type: "reply",
    id: first?.type === "call" ? first.id : 0,
    ok: false,
    error: { code: "TRUST_REQUIRED", message: "x" },
  });
  expect(await screen.findByText(/TRUST_REQUIRED/)).toBeTruthy();
  deliver({ kibo: 1, type: "changed" });
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(2));
});

test("a second init is ignored", async () => {
  const { port, sent, deliver } = fakePort();
  mount(port);
  deliver(init);
  deliver({ ...init, instanceId: "other", viewer: "mallory" });
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(1));
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByText(/mallory/)).toBeNull();
});

test("shortcuts are relayed to the host", () => {
  const { port, sent, deliver } = fakePort();
  mount(port);
  deliver(init);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "q", metaKey: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(sent.filter((m) => m.type === "key")).toEqual([
    { kibo: 1, type: "key", combo: "mod+k" },
    { kibo: 1, type: "key", combo: "escape" },
  ]);
});

const pressBackspace = (target: EventTarget, key = "Backspace"): boolean => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

test("Backspace and Delete are neutralized in the frame outside editable fields", () => {
  const { port, deliver } = fakePort();
  const unmount = mountSandboxed(manifest, Probe, port);
  deliver(init);
  const field = document.body.appendChild(document.createElement("input"));
  expect(pressBackspace(document.body)).toBe(true);
  expect(pressBackspace(document.body, "Delete")).toBe(true);
  expect(pressBackspace(field)).toBe(false);
  act(() => unmount());
  expect(pressBackspace(document.body)).toBe(false);
  field.remove();
});

test("unmounting releases every listener and the rendered tree", async () => {
  const { port, sent, deliver, listeners } = fakePort();
  const unmount = mountSandboxed(manifest, Probe, port);
  deliver(init);
  await waitFor(() => expect(sent.filter((m) => m.type === "call")).toHaveLength(1));
  act(() => unmount());
  expect(listeners.size).toBe(0);
  expect(screen.queryByRole("button")).toBeNull();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(sent.some((m) => m.type === "key")).toBe(false);
});

function FormatProbe() {
  return <p>format {useSdk().format}</p>;
}

test("the frame reads the format from init, or falls back to the manifest's default", async () => {
  const withFormat = fakePort();
  mounts.push(mountSandboxed(manifest, FormatProbe, withFormat.port));
  withFormat.deliver({ ...init, format: "large" });
  expect(await screen.findByText("format large")).toBeTruthy();
  for (const unmount of mounts.splice(0)) unmount();
  const legacy = fakePort();
  mounts.push(mountSandboxed(manifest, FormatProbe, legacy.port));
  legacy.deliver(init);
  expect(await screen.findByText("format medium")).toBeTruthy();
});

test("comboOf maps only the relayed shortcuts", () => {
  expect(comboOf(new KeyboardEvent("keydown", { key: "3", ctrlKey: true }))).toBe("mod+3");
  expect(comboOf(new KeyboardEvent("keydown", { key: "T", metaKey: true }))).toBe("mod+t");
  expect(comboOf(new KeyboardEvent("keydown", { key: "k" }))).toBeNull();
  expect(comboOf(new KeyboardEvent("keydown", { key: "0", metaKey: true }))).toBeNull();
});

test("the frame sdk ignores unknown reply ids and rejects pending calls on dispose", async () => {
  const { port, sent, deliver } = fakePort();
  const frame = createFrameSdk(ComponentManifest.parse(manifest), init, port);
  const listing = frame.sdk.list("ticket");
  deliver({ kibo: 1, type: "reply", id: 999, ok: true, result: [] });
  frame.dispose();
  await expect(listing).rejects.toBeInstanceOf(KiboError);
  expect(sent).toHaveLength(1);
});

test("unknown error codes from the host become INTERNAL", async () => {
  const { port, sent, deliver } = fakePort();
  const frame = createFrameSdk(ComponentManifest.parse(manifest), init, port);
  const listing = frame.sdk.list("ticket");
  const call = sent[0];
  deliver({
    kibo: 1,
    type: "reply",
    id: call?.type === "call" ? call.id : 0,
    ok: false,
    error: { code: "NOPE", message: "x" },
  });
  const error = await listing.catch((e: unknown) => e);
  expect(error instanceof KiboError && error.code).toBe("INTERNAL");
  frame.dispose();
});

test("host helpers post typed messages; the host fixes the surface and origin", () => {
  const { port, sent } = fakePort();
  const frame = createFrameSdk(ComponentManifest.parse(manifest), init, port);
  frame.sdk.openFile({ path: "src/a.ts", line: null, origin: "evil" });
  frame.sdk.openFile({ path: "src/a.ts", line: 12, origin: null });
  frame.sdk.openNewTicket({ statusId: "todo" });
  frame.sdk.openView("graph");
  expect(sent).toEqual([
    { kibo: 1, type: "openFile", path: "src/a.ts" },
    { kibo: 1, type: "openFile", path: "src/a.ts", line: 12 },
    { kibo: 1, type: "openNewTicket", defaults: { statusId: "todo" } },
    { kibo: 1, type: "openView", componentId: "graph" },
  ]);
  expect(frame.sdk.surface).toBe("view");
  frame.dispose();
});

test("the sandboxed sdk still refuses undeclared writes locally", async () => {
  const { port, sent } = fakePort();
  const frame = createFrameSdk(ComponentManifest.parse(manifest), init, port);
  const error = await frame.sdk.run({ method: "deleteTicket", ticketId: "t1" }).catch((e: unknown) => e);
  expect(error instanceof KiboError && error.code).toBe("PERMISSION_DENIED");
  expect(sent).toHaveLength(0);
  frame.dispose();
});

test("the window port ignores other senders and invalid messages", () => {
  const seen: HostToFrame[] = [];
  const off = windowPort(window).listen((m) => seen.push(m));
  window.dispatchEvent(new MessageEvent("message", { data: { kibo: 1, type: "changed" }, source: null }));
  window.dispatchEvent(new MessageEvent("message", { data: { nope: true }, source: window.parent }));
  window.dispatchEvent(
    new MessageEvent("message", { data: { kibo: 1, type: "changed" }, source: window.parent }),
  );
  off();
  window.dispatchEvent(
    new MessageEvent("message", { data: { kibo: 1, type: "changed" }, source: window.parent }),
  );
  expect(seen).toEqual([{ kibo: 1, type: "changed" }]);
});
