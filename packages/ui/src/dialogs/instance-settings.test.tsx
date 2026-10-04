import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import type { ConfigSchema, Instance, ProjectAsset, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
let assetsOutcome: () => Promise<ProjectAsset[]> = () => Promise.resolve([]);
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return req.method === "listAssets" ? assetsOutcome() : outcome();
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
const show = (fields: ConfigSchema = schema, projectId = "p1", config = instance.config) => {
  const onClose = mock(() => {});
  render(
    <InstanceSettingsDialog
      projectId={projectId}
      instance={{ ...instance, config }}
      title="Kanban"
      schema={fields}
      onClose={onClose}
    />,
  );
  return { onClose, user: userEvent.setup() };
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
  assetsOutcome = () => Promise.resolve([]);
});

test("the form is generated from the schema and saves the merged config", async () => {
  const { onClose, user } = show();
  expect(screen.getByRole("dialog", { name: "Réglages · Kanban" })).toBeTruthy();
  expect(screen.getByText("Ces réglages ne concernent que ce widget.")).toBeTruthy();
  screen.getByRole("combobox", { name: "Filtre" }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: "Tous" }));
  await user.click(screen.getByRole("switch", { name: "compact" }));
  const limit = screen.getByRole("spinbutton", { name: "limit" });
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
  expect((screen.getByRole("spinbutton", { name: "limit" }) as HTMLInputElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const sent = calls[0];
  expect(
    sent?.method === "command" && sent.command.method === "setInstanceConfig" && sent.command.config.limit,
  ).toBeNull();
});

test("an invalid value is refused before any call", async () => {
  const { onClose, user } = show({ count: { type: "number", default: 3 } });
  await user.clear(screen.getByRole("spinbutton", { name: "count" }));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Réglages refusés : count: expected number");
  expect(calls).toEqual([]);
  expect(onClose).not.toHaveBeenCalled();
});

test("a decimal number can be typed character by character", async () => {
  const { user } = show();
  const limit = screen.getByRole("spinbutton", { name: "limit" });
  await user.clear(limit);
  await user.type(limit, "1.5");
  expect((limit as HTMLInputElement).value).toBe("1.5");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const sent = calls[0];
  expect(
    sent?.method === "command" && sent.command.method === "setInstanceConfig" && sent.command.config.limit,
  ).toBe(1.5);
});

const asset = (name: string, kind: ProjectAsset["kind"], mime: ProjectAsset["mime"]): ProjectAsset => ({
  name,
  mime,
  kind,
  size: 1024,
  mtime: 0,
});
const modelSchema: ConfigSchema = {
  model: {
    type: "string",
    nullable: true,
    default: null,
    asset: "model",
    label: "Modèle (.glb)",
    help: "Exporté de Blender",
  },
};
const sentConfig = () => {
  const sent = calls.find((c) => c.method === "command");
  return sent?.method === "command" && sent.command.method === "setInstanceConfig"
    ? sent.command.config
    : null;
};

test("an asset field lists the project files of its kind and saves the chosen name", async () => {
  assetsOutcome = () =>
    Promise.resolve([
      asset("robot.glb", "model", "model/gltf-binary"),
      asset("fond.png", "image", "image/png"),
    ]);
  const { user } = show(modelSchema);
  expect(screen.getByText("Exporté de Blender")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Aucune valeur" })).toBeNull();
  const trigger = screen.getByRole("combobox", { name: "Modèle (.glb)" });
  await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  expect(calls).toEqual([{ method: "listAssets", projectId: "p1" }]);
  trigger.focus();
  await user.keyboard("{Enter}");
  const options = await screen.findAllByRole("option");
  expect(options.map((o) => o.textContent)).toEqual(["Aucun", "robot.glb"]);
  await user.click(screen.getByRole("option", { name: "robot.glb" }));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(sentConfig()?.model).toBe("robot.glb");
});

test("a saved file missing on this device stays selectable and is marked as such", async () => {
  const { user } = show(modelSchema, "p1", { model: "ancien.glb" });
  const trigger = screen.getByRole("combobox", { name: "Modèle (.glb)" });
  await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  expect(trigger.textContent).toBe("ancien.glb (introuvable sur cet appareil)");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(sentConfig()?.model).toBe("ancien.glb");
});

test("a failed listing is shown instead of the field", async () => {
  assetsOutcome = () => Promise.reject(new Error("down"));
  const error = spyOn(console, "error").mockImplementation(() => {});
  show(modelSchema);
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de lister les fichiers du projet.");
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});

test("the Inbox has no project files: nothing is listed, only Aucun is offered", async () => {
  const { user } = show(modelSchema, "inbox");
  const trigger = screen.getByRole("combobox", { name: "Modèle (.glb)" });
  await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  trigger.focus();
  await user.keyboard("{Enter}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Aucun"]);
  expect(calls).toEqual([]);
});

test("number bounds reach the input and a value above max is refused before any call", async () => {
  const { user } = show({ speed: { type: "number", min: 0.5, max: 4, default: 1, label: "Vitesse" } });
  const speed = screen.getByRole("spinbutton", { name: "Vitesse" }) as HTMLInputElement;
  expect(speed.min).toBe("0.5");
  expect(speed.max).toBe("4");
  await user.clear(speed);
  await user.type(speed, "5");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Réglages refusés : speed: above 4");
  expect(calls).toEqual([]);
});
