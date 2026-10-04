import { expect, mock, test } from "bun:test";
import type { Instance, Page, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) =>
      Promise.resolve(req.method === "listComponents" || req.method === "listDrafts" ? [] : null),
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");
const { PageActionsProvider } = await import("../shell/page-actions");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const page: Page = { id: "pg", title: "Jeux", kind: "dashboard", parentId: null };
const snake: Instance = {
  id: "s1",
  pageId: "pg",
  component: "snake@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 4 },
  config: {},
  componentHash: null,
};
const project = (): ProjectSnapshot => ({ ...kiboProject(), pages: [page], instances: [snake] });
const key = (code: string, key = code) =>
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code, key })));

test("the snake keeps its board in fullscreen, entered by the host button or by F", async () => {
  const view = render(
    <HostProvider host={host}>
      <PageActionsProvider>
        <PageView project={project()} page={page} viewer="adam" />
      </PageActionsProvider>
    </HostProvider>,
  );
  const board = await screen.findByRole("img", { name: /Plateau du serpent/ }, { timeout: 10_000 });
  const card = view.container.querySelector<HTMLElement>('[data-instance="s1"] > div');
  expect(await screen.findAllByRole("button", { name: "Plein écran" })).toHaveLength(1);
  await userEvent.setup().click(screen.getByRole("button", { name: "Plein écran" }));
  expect(card).toBe(screen.getByRole("dialog", { name: "Serpent" }));
  expect(screen.getByRole("img", { name: /Plateau du serpent/ })).toBe(board);
  await waitFor(() => expect(document.activeElement?.textContent).toBe("Quitter le plein écran (Échap)"));
  key("Escape");
  expect(screen.queryByRole("dialog")).toBeNull();
  key("KeyF", "f");
  expect(card).toBe(screen.getByRole("dialog", { name: "Serpent" }));
  key("KeyF", "f");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("img", { name: /Plateau du serpent/ })).toBe(board);
  view.unmount();
});
