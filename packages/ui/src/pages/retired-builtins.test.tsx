import { expect, mock, test } from "bun:test";
import type { Instance, Page, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { kiboProject } from "../lib/fixtures";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(
          req.method === "listComponents" || req.method === "listDrafts" || req.method === "listMarketSources"
            ? []
            : null,
        );
      },
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");
const { PageActionsProvider } = await import("../shell/page-actions");

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const page: Page = { id: "pg", title: "Jeux", kind: "dashboard", parentId: null };
const placed = (id: string, component: string, x: number): Instance => ({
  id,
  pageId: "pg",
  component,
  layout: { x, y: 0, w: 6, h: 4 },
  config: { embed: "https://itch.io/embed-upload/1" },
  componentHash: null,
});
const project = (): ProjectSnapshot => ({
  ...kiboProject(),
  pages: [page],
  instances: [placed("g1", "itch@1.0.0", 0), placed("s1", "snake@1.0.0", 6)],
});

test("a retired game or snake widget shows as a missing component that can be removed", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    render(
      <HostProvider host={host}>
        <PageActionsProvider>
          <PageView project={project()} page={page} viewer="adam" />
        </PageActionsProvider>
      </HostProvider>,
    );
    expect(await screen.findByText("Composant absent : itch@1.0.0", {}, { timeout: 10_000 })).toBeTruthy();
    expect(await screen.findByText("Composant absent : snake@1.0.0")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions itch@1.0.0" }));
    await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page…" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Retirer itch@1.0.0 de la page ?" });
    await user.click(within(confirm).getByRole("button", { name: "Retirer" }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: "command",
          command: { method: "removeInstance", instanceId: "g1" },
        }),
      ),
    );
    const ours = errors.filter(
      (args) => !(Array.isArray(args) && typeof args[0] === "string" && args[0].startsWith("[kibo-daemon]")),
    );
    expect(ours).toEqual([]);
  } finally {
    console.error = original;
  }
});
