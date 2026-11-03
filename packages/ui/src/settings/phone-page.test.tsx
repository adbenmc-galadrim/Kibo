import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { createFakeRemote, ENABLED } from "./phone-fixtures";

let remote = createFakeRemote();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => remote.rpc(req),
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);
const { PhonePage } = await import("./PhonePage");

beforeEach(() => {
  remote = createFakeRemote();
});

const methods = () => remote.calls.map((c) => c.method);

test('PhonePage shows "Désactivé" and the enable form (server URL prefilled with https://kibo.shinseo.fr, setup code field)', async () => {
  render(<PhonePage />);
  expect(screen.getByRole("heading", { level: 1, name: "Téléphone" })).toBeTruthy();
  expect(screen.getByText("Kibo sur ton téléphone, via kibo.shinseo.fr")).toBeTruthy();
  expect(await screen.findByText("Désactivé")).toBeTruthy();
  const url = screen.getByRole("textbox", { name: "Adresse du serveur" });
  expect(url instanceof HTMLInputElement && url.value).toBe("https://kibo.shinseo.fr");
  expect(screen.getByLabelText("Code d'installation")).toBeTruthy();
  expect(screen.queryByText("Projets envoyés au téléphone")).toBeNull();
  expect(screen.queryByRole("button", { name: "Appairer un téléphone" })).toBeNull();
});

test("enabling calls remote.enable then shows the connected state", async () => {
  render(<PhonePage />);
  await userEvent.type(await screen.findByLabelText("Code d'installation"), "silo-setup-2026");
  await userEvent.click(screen.getByRole("button", { name: "Activer l'accès" }));
  expect(await screen.findByText("Connecté · dernier envoi il y a 12 s")).toBeTruthy();
  expect(remote.calls).toContainEqual({
    method: "remote.enable",
    serverUrl: "https://kibo.shinseo.fr",
    setupCode: "silo-setup-2026",
  });
  expect(screen.queryByText("Désactivé")).toBeNull();
});

test("a refused setup code keeps the form and says why", async () => {
  remote.rpc = async (req) => {
    remote.calls.push(req);
    if (req.method === "remote.enable") throw new Error("setup code refused");
    return remote.status;
  };
  render(<PhonePage />);
  await userEvent.type(await screen.findByLabelText("Code d'installation"), "mauvais-code");
  await userEvent.click(screen.getByRole("button", { name: "Activer l'accès" }));
  expect((await screen.findByRole("alert")).textContent).toContain("L'activation a échoué");
  expect(screen.getByText("Désactivé")).toBeTruthy();
});

test("an enabled Mac without connection reads offline and reconnecting", async () => {
  remote.status = { ...ENABLED, connected: false };
  render(<PhonePage />);
  expect(await screen.findByText("Hors ligne · reconnexion…")).toBeTruthy();
});

test("every project is unchecked by default and checking one calls remote.setProjects", async () => {
  remote.status = ENABLED;
  render(<PhonePage />);
  const card = within(await screen.findByRole("region", { name: "Projets envoyés au téléphone" }));
  expect(card.getByText("Tous les projets sont désactivés au départ")).toBeTruthy();
  const boxes = await card.findAllByRole("checkbox");
  expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
  await userEvent.click(card.getByRole("checkbox", { name: "Silo" }));
  expect(remote.calls).toContainEqual({ method: "remote.setProjects", projectIds: ["silo"] });
  await waitFor(() =>
    expect(card.getByRole("checkbox", { name: "Silo" }).getAttribute("aria-checked")).toBe("true"),
  );
  await userEvent.click(card.getByRole("checkbox", { name: "Atlas" }));
  expect(remote.calls).toContainEqual({ method: "remote.setProjects", projectIds: ["silo", "atlas"] });
});

test('"Révoquer le téléphone" asks confirmation then calls remote.revokePhone', async () => {
  remote.status = { ...ENABLED, phonePaired: true };
  render(<PhonePage />);
  await userEvent.click(await screen.findByRole("button", { name: "Révoquer le téléphone" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(methods()).not.toContain("remote.revokePhone");
  await userEvent.click(dialog.getByRole("button", { name: "Révoquer" }));
  await waitFor(() => expect(methods()).toContain("remote.revokePhone"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Révoquer le téléphone" })).toBeNull());
});

test("disabling asks confirmation then calls remote.disable", async () => {
  remote.status = ENABLED;
  render(<PhonePage />);
  await userEvent.click(await screen.findByRole("button", { name: "Désactiver l'accès" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(methods()).not.toContain("remote.disable");
  await userEvent.click(dialog.getByRole("button", { name: "Désactiver" }));
  await waitFor(() => expect(methods()).toContain("remote.disable"));
  expect(await screen.findByText("Désactivé")).toBeTruthy();
});
