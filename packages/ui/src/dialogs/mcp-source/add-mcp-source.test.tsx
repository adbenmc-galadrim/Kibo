import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
const context7 = {
  transport: "stdio",
  id: "ctx",
  name: "Context7",
  command: "npx",
  args: [],
  envNames: [],
  enabled: true,
  state: "connected",
  error: null,
  tools: [{ name: "list_items", description: null, inputSchema: {} }],
  secretsSet: [],
};
const replies: Record<string, unknown> = {
  listComponents: [],
  listDrafts: [],
  listMcpServers: [context7],
  command: null,
};

mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return replies[req.method] ?? null;
    },
    subscribe: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
  },
}));
const { AddComponentDialog } = await import("../AddComponentDialog");

const page = { id: "pg1", title: "Tableau de bord", kind: "dashboard", parentId: null } as const;

beforeEach(() => {
  calls.length = 0;
});

test("the MCP source is added with its flat configuration, never as a synced source", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Source MCP" }));
  expect(await screen.findByText("Context7 (ctx)")).toBeDefined();
  expect(screen.queryByRole("radio", { name: "Synchronisée · GitHub Issues" })).toBeNull();
  const submit = screen.getByRole("button", { name: "Ajouter à la page" });
  const args = screen.getByLabelText("Arguments (JSON)");
  await user.clear(args);
  await user.type(args, "[1]");
  expect(submit.hasAttribute("disabled")).toBe(true);
  await user.clear(args);
  await user.type(args, '{{"limit":5}');
  await waitFor(() => expect(submit.hasAttribute("disabled")).toBe(false));
  await user.click(submit);
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: {
      method: "addInstance",
      pageId: "pg1",
      component: "mcp-source@1.0.0",
      layout: { x: 0, y: 0, w: 6, h: 6 },
      config: {
        server: "ctx",
        mode: "tool",
        tool: "list_items",
        args: '{"limit":5}',
        refreshMinutes: 15,
        itemsPointer: "/items",
        idPointer: "/id",
        titlePointer: "/name",
        subtitlePointer: "/detail",
        urlPointer: "/link",
      },
    },
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
