import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture } from "../agents/fixtures";

const calls: RpcRequest[] = [];
const answer = async (req: RpcRequest): Promise<unknown> => {
  if (req.method === "config") return { name: "Maison", description: "Mes projets" };
  if (req.method === "setIcon") return { icon: req.icon ? "abc" : null };
  throw new Error(`unexpected ${req.method}`);
};
let rpcOutcome: (req: RpcRequest) => Promise<unknown> = answer;
mock.module("../api", () => ({
  client: {
    subscribe: () => () => {},
    subscribeTopic: () => () => {},
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return rpcOutcome(req);
    },
  },
}));
const { WorkspacePage } = await import("./WorkspacePage");

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", {
  type: "image/png",
});
beforeEach(() => {
  calls.length = 0;
  rpcOutcome = answer;
});

test("shows the identity card from the config, workspace first in the nav (screen 109)", () => {
  render(
    <WorkspacePage
      config={{ ...configFixture(), workspaceDescription: "Mes projets", workspaceIcon: "v1" }}
    />,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Workspace" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Paramètres" });
  expect(nav.querySelector("a")?.textContent).toBe("Workspace");
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Perso");
  expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Mes projets");
  expect(screen.getByRole("img", { name: "Image · Image" }).getAttribute("src")).toBe(
    "/icons/workspace?v=v1",
  );
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
});

test("saves only what changed: patch first, then the icon", async () => {
  const user = userEvent.setup();
  render(<WorkspacePage config={configFixture()} />);
  const name = screen.getByLabelText("Nom");
  await user.clear(name);
  await user.type(name, " Maison ");
  await user.type(screen.getByLabelText("Description"), "Mes projets");
  await user.upload(screen.getByLabelText("Choisir une image…"), PNG);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(screen.getByText("Enregistré")).toBeTruthy());
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "updateWorkspace", patch: { name: "Maison", description: "Mes projets" } },
    },
    { method: "setIcon", owner: { kind: "workspace" }, icon: { mime: "image/png", data: "iVBORw0KGgo=" } },
  ]);
});

test("removing the image and clearing the description send null", async () => {
  const user = userEvent.setup();
  render(
    <WorkspacePage
      config={{ ...configFixture(), workspaceDescription: "Mes projets", workspaceIcon: "v1" }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Retirer l'image" }));
  await user.clear(screen.getByLabelText("Description"));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls).toEqual([
    { method: "config", command: { method: "updateWorkspace", patch: { description: null } } },
    { method: "setIcon", owner: { kind: "workspace" }, icon: null },
  ]);
});

test("without config the form waits; a daemon error is shown", async () => {
  const { unmount } = render(<WorkspacePage config={null} />);
  expect(screen.getByLabelText("Nom").hasAttribute("disabled")).toBe(true);
  unmount();
  calls.length = 0;
  rpcOutcome = async () => {
    throw new Error("boom");
  };
  render(<WorkspacePage config={configFixture()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nom"), "2");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible d'enregistrer le workspace.");
});
