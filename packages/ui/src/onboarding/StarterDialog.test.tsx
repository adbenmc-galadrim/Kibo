import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
const ok = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return ok;
      if (req.method === "listComponents" || req.method === "listDrafts") return [];
      if (req.method === "command" && req.command.method === "addPage") {
        if (req.command.title === "Tickets") throw new Error("boom");
        return {
          id: `pg-${req.command.title}`,
          title: req.command.title,
          kind: req.command.kind,
          parentId: null,
        };
      }
      return { id: "i1" };
    },
    subscribe: () => () => {},
    subscribeAi: () => () => {},
    onRunChanged: () => () => {},
    onConnection: () => () => {},
    online: () => true,
  },
}));

const { StarterDialog } = await import("./StarterDialog");

const addedPages = () =>
  calls.flatMap((c) => (c.method === "command" && c.command.method === "addPage" ? [c.command.title] : []));

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("StarterDialog adds the checked pages to the project", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<StarterDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Designer" }));
  await user.click(screen.getByRole("button", { name: "Ajouter 3 pages" }));
  expect(addedPages()).toEqual(["Tableau de bord", "Kanban", "Notes"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("StarterDialog reports a partial addition in the dialog", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<StarterDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter 5 pages" }));
  expect(await screen.findByText("Pages créées en partie, échec pour : Tickets.")).toBeTruthy();
  expect(screen.queryByText(/Projet créé/)).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
});
