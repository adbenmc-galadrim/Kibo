import { expect, mock, test } from "bun:test";
import type { Page, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";

const LOCAL = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "listComponents") return Promise.resolve([]);
      if (req.method === "componentCall" && req.call.kind === "presence.list") return Promise.resolve([]);
      if (req.method === "componentCall" && req.call.kind === "sharing.get") return Promise.resolve(LOCAL);
      return Promise.resolve(null);
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const page: Page = { id: "pg", title: "Tableau de bord", kind: "dashboard", parentId: null };
const withAccess = (access: "write" | "read-only" | "revoked"): ProjectSnapshot => {
  const base = kiboProject();
  return {
    ...base,
    pages: [page],
    instances: [
      {
        id: "i1",
        pageId: "pg",
        component: "kanban@1.0.0",
        layout: { x: 0, y: 0, w: 6, h: 6 },
        config: {},
        componentHash: null,
      },
    ],
    sync: { ...base.sync, shared: true, access },
  };
};
const show = (project: ProjectSnapshot) =>
  render(
    <HostProvider host={host}>
      <PageView project={project} page={page} viewer="adam" />
    </HostProvider>,
  );

test("an editable project offers the widget menu", async () => {
  show(withAccess("write"));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Actions Kanban" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Réglages…",
    "Retirer de la page…",
  ]);
});

test("a read-only or revoked project shows no widget menu", async () => {
  for (const access of ["read-only", "revoked"] as const) {
    const view = show(withAccess(access));
    expect(await screen.findByText("Kanban")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actions Kanban" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Réglages…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Retirer de la page…" })).toBeNull();
    view.unmount();
  }
});
