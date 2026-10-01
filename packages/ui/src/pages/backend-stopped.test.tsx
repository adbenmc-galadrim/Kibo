import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentSummary,
  type Instance,
  KiboError,
  type Phase7Event,
  type RpcRequest,
  type SandboxStatus,
} from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";

const H = "d".repeat(64);
let components: ComponentSummary[] = [];
let sandbox: SandboxStatus;
const listeners = new Set<(e: Phase7Event) => void>();

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      if (req.method === "listComponents") return components;
      if (req.method === "listDrafts" || req.method === "listComponentDrafts") return [];
      if (req.method === "getRuntimeInfo")
        throw new KiboError("INVALID_INPUT", "runtime left to instance.test");
      if (req.method === "getSandboxStatus") return sandbox;
      return null;
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: (l: (e: Phase7Event) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));
const { InstanceFrame } = await import("./InstanceFrame");
const { HostProvider } = await import("../shell/Host");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const settings: unknown = Reflect.get(Reflect.get(window, "happyDOM"), "settings");
const iframeLoading: unknown = Reflect.get(Object(settings), "disableIframePageLoading");
Reflect.set(Object(settings), "disableIframePageLoading", true);
afterAll(() => Reflect.set(Object(settings), "disableIframePageLoading", iframeLoading));

const STOPPED = "Backend arrêté — isolation OS indisponible";
const missing: SandboxStatus = {
  kind: null,
  available: false,
  reason: "bubblewrap (bwrap) is not installed",
  fix: "sudo apt install bubblewrap",
  allowUnsandboxed: false,
};
const instance: Instance = {
  id: "i1",
  pageId: "pg",
  component: "pr-queue@0.3.0",
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: null,
};
const withVersion = (patch: Partial<ComponentSummary["versions"][number]>): ComponentSummary[] => [
  {
    id: "pr-queue",
    title: "PR en attente",
    builtin: false,
    versions: [
      {
        version: "0.3.0",
        hash: H,
        trust: "sandboxed",
        origin: "marketplace",
        active: true,
        tampered: false,
        manifest: null,
        usages: [],
        revoked: null,
        backend: true,
        ...patch,
      },
    ],
  },
];
const frame = () =>
  render(
    <HostProvider host={host}>
      <InstanceFrame projectId="p1" instance={instance} viewer="adam" surface="widget" format="large" />
    </HostProvider>,
  );

beforeEach(() => {
  sandbox = missing;
  listeners.clear();
});

test("a sandboxed backend stopped for lack of OS isolation replaces the widget, until the sandbox comes back", async () => {
  components = withVersion({});
  frame();
  expect((await screen.findByRole("status")).textContent).toContain(STOPPED);
  expect(
    screen.getByText(
      "L'interface reste utilisable. Les commandes d'installation sont sur la page Composants.",
    ),
  ).toBeTruthy();
  expect(screen.queryByTitle("PR en attente")).toBeNull();
  sandbox = { ...missing, kind: "bwrap", available: true, reason: null, fix: null };
  act(() => {
    for (const l of listeners) l({ type: "sandbox.changed" });
  });
  await waitFor(() => expect(screen.queryByText(STOPPED)).toBeNull());
});

test("the frame is reached, without the message, when there is no backend, for a trusted version or when unsandboxed runs are allowed", async () => {
  for (const [patch, status] of [
    [{ backend: false }, missing],
    [{ trust: "trusted" as const }, missing],
    [{}, { ...missing, allowUnsandboxed: true }],
    [{}, { ...missing, kind: "bwrap" as const, available: true, reason: null, fix: null }],
  ] as const) {
    components = withVersion(patch);
    sandbox = status;
    const { unmount } = frame();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(STOPPED)).toBeNull();
    unmount();
  }
});
