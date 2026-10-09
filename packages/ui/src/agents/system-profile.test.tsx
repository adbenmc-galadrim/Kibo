import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, configFixture, NOW, profilesFixture, projectsFixture } from "./fixtures";
import { systemProfilesFixture } from "./system-profiles-fixture";

const calls: RpcRequest[] = [];
let respond: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return respond();
      },
    },
  }),
);

const { AgentsPage } = await import("./AgentsPage");

beforeEach(() => {
  calls.length = 0;
  respond = () => Promise.resolve(null);
});

const config = () => ({ ...configFixture(), profiles: [...systemProfilesFixture, ...profilesFixture] });
const show = () =>
  render(
    <AgentsPage
      state={agentsFixture()}
      config={config()}
      projects={projectsFixture}
      now={NOW}
      onOpenRun={() => {}}
    />,
  );
const sheet = () => within(screen.getByRole("dialog"));

test("a system profile card carries the Système badge, a user profile does not", () => {
  show();
  expect(within(screen.getByRole("article", { name: "assistant" })).getByText("Système")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "opus-dev" })).queryByText("Système")).toBeNull();
});

test("a system profile sheet only offers the model, the parallel runs and the enabled switch", async () => {
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

test("a system profile runs 1 to 4 in parallel; the choice is saved and a refusal is said", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil generateur" }));
  const parallel = sheet().getByRole("combobox", { name: "Runs en parallèle (profil)" });
  expect(parallel.textContent).toBe("1");
  parallel.focus();
  await user.keyboard("{Enter}");
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["1", "2", "3", "4"]);
  await user.click(screen.getByRole("option", { name: "2" }));
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "updateProfile", profileId: "generateur", patch: { maxParallel: 2 } },
    },
  ]);
});

test("a parallel count refused by the daemon is said and goes back", async () => {
  respond = () => Promise.reject(new KiboError("INVALID_INPUT", "maxParallel"));
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil generateur" }));
  const parallel = sheet().getByRole("combobox", { name: "Runs en parallèle (profil)" });
  parallel.focus();
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("option", { name: "3" }));
  expect((await sheet().findByRole("alert")).textContent).toBe("Impossible d'enregistrer le profil.");
  expect(parallel.textContent).toBe("1");
});

test("with only system profiles the page still invites to create a profile", () => {
  const onlySystem = { ...configFixture(), profiles: systemProfilesFixture };
  render(
    <AgentsPage
      state={agentsFixture()}
      config={onlySystem}
      projects={projectsFixture}
      now={NOW}
      onOpenRun={() => {}}
    />,
  );
  expect(
    screen.getByText("Aucun profil à toi : crée-en un pour assigner des tickets à un agent."),
  ).toBeTruthy();
  expect(screen.getByRole("article", { name: "assistant" })).toBeTruthy();
});

test("the demo profile shows as Agent de démonstration, spends no token and has no parallel choice", async () => {
  show();
  const card = within(screen.getByRole("article", { name: "Agent de démonstration" }));
  expect(card.getByText("aucun token consommé")).toBeTruthy();
  expect(card.getByText("Système")).toBeTruthy();
  expect(
    within(screen.getByRole("article", { name: "generateur" })).queryByText("aucun token consommé"),
  ).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil Agent de démonstration" }));
  expect(sheet().getByText("Profil Agent de démonstration")).toBeTruthy();
  expect(sheet().queryByRole("combobox", { name: "Runs en parallèle (profil)" })).toBeNull();
  expect(sheet().getByText("Un ticket à la fois")).toBeTruthy();
  expect(sheet().getByRole("combobox", { name: "Modèle" })).toBeTruthy();
  expect(sheet().getByText(/^Sans effet/)).toBeTruthy();
});

test("the generateur sheet keeps its parallel choice and no demo mention", async () => {
  show();
  await userEvent.setup().click(screen.getByRole("button", { name: "Modifier le profil generateur" }));
  expect(sheet().getByRole("combobox", { name: "Runs en parallèle (profil)" })).toBeTruthy();
  expect(sheet().queryByText(/^Sans effet/)).toBeNull();
});
