import { beforeEach, expect, mock, test } from "bun:test";
import type { ConfigSchema, Instance, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));
const { InstanceSettingsDialog } = await import("./InstanceSettingsDialog");

const schema: ConfigSchema = {
  filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  compact: { type: "boolean", default: false },
  limit: { type: "number", nullable: true },
  label: { type: "string" },
};
const instance: Instance = {
  id: "i1",
  pageId: "pg",
  component: "kanban@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: { filter: "mine-and-agents", limit: 5, source: { bindingId: "b1" } },
  componentHash: null,
};
const show = () => {
  const onClose = mock(() => {});
  render(
    <InstanceSettingsDialog
      projectId="p1"
      instance={instance}
      title="Kanban"
      schema={schema}
      onClose={onClose}
    />,
  );
  return { onClose, user: userEvent.setup() };
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("the form is generated from the schema and saves the merged config", async () => {
  const { onClose, user } = show();
  expect(screen.getByRole("dialog", { name: "Réglages · Kanban" })).toBeTruthy();
  expect(screen.getByText("Ces réglages ne concernent que ce widget.")).toBeTruthy();
  screen.getByRole("combobox", { name: "Filtre" }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: "Tous" }));
  await user.click(screen.getByRole("switch", { name: "compact" }));
  const limit = screen.getByRole("textbox", { name: "limit" });
  expect((limit as HTMLInputElement).value).toBe("5");
  await user.clear(limit);
  await user.type(limit, "12");
  await user.type(screen.getByRole("textbox", { name: "label" }), "Sprint");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "setInstanceConfig",
        instanceId: "i1",
        config: { filter: "all", compact: true, limit: 12, label: "Sprint", source: { bindingId: "b1" } },
      },
    },
  ]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Aucune valeur sends null for a nullable field and disables its input", async () => {
  const { user } = show();
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  expect((screen.getByRole("textbox", { name: "limit" }) as HTMLInputElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const sent = calls[0];
  expect(
    sent?.method === "command" && sent.command.method === "setInstanceConfig" && sent.command.config.limit,
  ).toBeNull();
});

test("an invalid value is refused before any call", async () => {
  const { onClose, user } = show();
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  await user.click(screen.getByRole("checkbox", { name: "Aucune valeur" }));
  const limit = screen.getByRole("textbox", { name: "limit" });
  await user.clear(limit);
  await user.type(limit, "abc");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Réglages refusés : limit: expected number");
  expect(calls).toEqual([]);
  expect(onClose).not.toHaveBeenCalled();
});

test("a decimal number can be typed character by character", async () => {
  const { user } = show();
  const limit = screen.getByRole("textbox", { name: "limit" });
  await user.clear(limit);
  await user.type(limit, "1.5");
  expect((limit as HTMLInputElement).value).toBe("1.5");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const sent = calls[0];
  expect(
    sent?.method === "command" && sent.command.method === "setInstanceConfig" && sent.command.config.limit,
  ).toBe(1.5);
});
