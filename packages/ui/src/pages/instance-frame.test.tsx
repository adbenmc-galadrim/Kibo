import { beforeEach, expect, mock, test } from "bun:test";
import type { Instance, RpcRequest } from "@kibo/schema";
import { ALWAYS_VISIBLE, NO_FOCUS, NO_SELECTION } from "@kibo/sdk";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";
import type { InstanceApis } from "../lib/instance-capabilities";

const LOCAL = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "componentCall" && req.call.kind === "presence.list") return Promise.resolve([]);
        if (req.method === "componentCall" && req.call.kind === "sharing.get") return Promise.resolve(LOCAL);
        return Promise.resolve(null);
      },
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { InstanceFrame } = await import("./InstanceFrame");
const { HostProvider } = await import("../shell/Host");

const APIS: InstanceApis = {
  capabilities: [],
  focus: NO_FOCUS,
  visibility: ALWAYS_VISIBLE,
  selection: NO_SELECTION,
};
const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const inst = (component: string): Instance => ({
  id: "i1",
  pageId: "pg",
  component,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: null,
});
const frame = (component: string) => (
  <HostProvider host={host}>
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst(component)}
      viewer="adam"
      surface="widget"
      format="large"
      editable
    />
  </HostProvider>
);

beforeEach(() => {
  calls.length = 0;
});

test("InstanceFrame renders RetiredComponent for tickets, notes, github-issues, mcp-source, viewer-3d, snake, itch and a builtin for kanban", async () => {
  const retired = [
    "tickets@1.0.0",
    "notes@1.0.0",
    "github-issues@1.0.0",
    "mcp-source@1.0.0",
    "viewer-3d@1.0.0",
    "snake@1.0.0",
    "itch@1.0.0",
  ];
  for (const ref of retired) {
    render(frame(ref));
    expect(screen.getByText("Ce composant n'existe plus dans Kibo.")).toBeTruthy();
    expect(screen.getByText(ref)).toBeTruthy();
    cleanup();
  }
  expect(calls).toEqual([]);
  render(frame("kanban@1.0.0"));
  expect(screen.queryByText("Ce composant n'existe plus dans Kibo.")).toBeNull();
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
});
