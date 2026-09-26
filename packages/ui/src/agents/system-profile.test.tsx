import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, configFixture, NOW, profilesFixture } from "./fixtures";
import { systemProfilesFixture } from "./system-profiles-fixture";

const calls: RpcRequest[] = [];
let respond: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return respond();
    },
  },
}));

const { AgentsPage } = await import("./AgentsPage");

beforeEach(() => {
  calls.length = 0;
  respond = () => Promise.resolve(null);
});

const config = () => ({ ...configFixture(), profiles: [...systemProfilesFixture, ...profilesFixture] });
const show = () => render(<AgentsPage state={agentsFixture()} config={config()} now={NOW} />);
const sheet = () => within(screen.getByRole("dialog"));

test("a system profile card carries the Système badge, a user profile does not", () => {
  show();
  expect(within(screen.getByRole("article", { name: "assistant" })).getByText("Système")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "opus-dev" })).queryByText("Système")).toBeNull();
});

test("a system profile sheet only offers the model and the enabled switch", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil assistant" }));
  expect(sheet().getByText("Profil assistant")).toBeTruthy();
  expect(sheet().getByText("Profil utilisé par Kibo pour l'IA dans le produit.")).toBeTruthy();
  expect(sheet().getByRole("combobox", { name: "Modèle" }).textContent).toBe("Claude Opus 5.5");
  expect(sheet().queryByText("Permissions")).toBeNull();
  expect(sheet().queryByLabelText("Nom")).toBeNull();
  expect(sheet().queryByRole("button", { name: "Supprimer le profil" })).toBeNull();
  const enabled = sheet().getByRole("switch", { name: "Activé" });
  expect(enabled.getAttribute("aria-checked")).toBe("true");
  await user.click(enabled);
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "updateProfile", profileId: "assistant", patch: { enabled: false } },
    },
  ]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a refused change is said and the switch goes back", async () => {
  respond = () => Promise.reject(new KiboError("INVALID_INPUT", "nope"));
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil generateur" }));
  const enabled = sheet().getByRole("switch", { name: "Activé" });
  await user.click(enabled);
  expect((await sheet().findByRole("alert")).textContent).toBe("Impossible d'enregistrer le profil.");
  expect(enabled.getAttribute("aria-checked")).toBe("true");
});

test("choosing Haiku saves only the model of the system profile", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil assistant" }));
  sheet().getByRole("combobox", { name: "Modèle" }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: "Claude Haiku 4.5" }));
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "updateProfile", profileId: "assistant", patch: { model: "haiku" } },
    },
  ]);
});

test("with only system profiles the page still invites to create a profile", () => {
  const onlySystem = { ...configFixture(), profiles: systemProfilesFixture };
  render(<AgentsPage state={agentsFixture()} config={onlySystem} now={NOW} />);
  expect(screen.getByText("Aucun profil : crées-en un pour assigner des tickets à un agent.")).toBeTruthy();
  expect(screen.getByRole("article", { name: "assistant" })).toBeTruthy();
});
