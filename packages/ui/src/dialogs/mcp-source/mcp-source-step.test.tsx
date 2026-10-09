import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";

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
let servers: unknown[] = [context7];
mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => (req.method === "listMcpServers" ? servers : null),
    },
  }),
);
const { McpSourceStep } = await import("./McpSourceStep");

beforeEach(() => {
  servers = [context7, { ...context7, id: "off", name: "Éteint", enabled: false }];
});

test("server and tool come from the configured MCP servers; bad JSON args are refused", async () => {
  const onChange = mock((_: unknown) => {});
  render(<McpSourceStep value={null} onChange={onChange} />);
  expect(await screen.findByText("Context7 (ctx)")).toBeDefined();
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ server: "ctx", mode: "tool", tool: "list_items" }),
  );
  const user = userEvent.setup();
  const args = screen.getByLabelText("Arguments (JSON)");
  await user.clear(args);
  await user.type(args, "{{pas du json");
  expect(screen.getByText("Arguments : JSON invalide.")).toBeDefined();
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test("resource mode needs a uri; a disabled server is not offered", async () => {
  const onChange = mock((_: unknown) => {});
  render(<McpSourceStep value={null} onChange={onChange} />);
  expect(await screen.findByText("Context7 (ctx)")).toBeDefined();
  expect(screen.queryByText("Éteint (off)")).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Ressource" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
  await user.type(screen.getByLabelText("URI de la ressource"), "fake://items");
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ server: "ctx", mode: "resource", uri: "fake://items" }),
  );
  expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("tool");
});

test("without an enabled server, the step says where to add one", async () => {
  servers = [];
  const onChange = mock((_: unknown) => {});
  render(<McpSourceStep value={null} onChange={onChange} />);
  expect(
    await screen.findByText("Aucun serveur MCP configuré : ajoute-en un dans Paramètres › Intégrations."),
  ).toBeDefined();
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test("the widget title defaults to Source MCP and can be renamed", async () => {
  const onChange = mock((_: unknown) => {});
  render(<McpSourceStep value={null} onChange={onChange} />);
  const title = await screen.findByLabelText("Titre du widget");
  expect(title).toHaveProperty("value", "Source MCP");
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Source MCP" }));
  const user = userEvent.setup();
  await user.clear(title);
  await user.type(title, "Erreurs Sentry");
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Erreurs Sentry" }));
  await user.clear(title);
  expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("title");
});
