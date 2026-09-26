import { expect, mock, test } from "bun:test";
import type { Environment } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let env: Environment;
mock.module("../api", () => ({ client: { rpc: async () => env } }));
const { Welcome } = await import("./Welcome");

const base: Environment = {
  daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
  ai: {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
  },
  git: "2.51",
  gh: "2.80",
  capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
  github: { connected: false },
};

test("shows the five checks of screen 19", async () => {
  env = base;
  render(<Welcome onCreate={() => {}} onImport={() => {}} onConnectGithub={() => {}} />);
  expect(await screen.findByText("Bienvenue dans Kibo")).toBeTruthy();
  expect(await screen.findByText("claude détecté · connecté à ton abonnement")).toBeTruthy();
  expect(screen.getByText("git 2.51 · gh 2.80 détectés")).toBeTruthy();
  expect(screen.getByText("8 cœurs, 16 Go → 3 créneaux d'agents (modifiable)")).toBeTruthy();
  expect(screen.getByText("En marche sur 127.0.0.1:47831 · données dans ~/.kibo")).toBeTruthy();
});

test("explains a missing claude", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "missing", version: null, loggedIn: null } };
  render(<Welcome onCreate={() => {}} onImport={() => {}} onConnectGithub={() => {}} />);
  expect(
    await screen.findByText(
      "claude introuvable : l'assistant et la génération de composants sont désactivés",
    ),
  ).toBeTruthy();
});

test("explains a logged out claude", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "logged_out", loggedIn: false } };
  render(<Welcome onCreate={() => {}} onImport={() => {}} onConnectGithub={() => {}} />);
  expect(await screen.findByText("claude détecté · non connecté : lance claude puis /login")).toBeTruthy();
});

test("a connected GitHub hides the connect button", async () => {
  env = { ...base, github: { connected: true } };
  render(<Welcome onCreate={() => {}} onImport={() => {}} onConnectGithub={() => {}} />);
  expect(await screen.findByText("Connecté")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Connecter" })).toBeNull();
});

test("buttons call their handlers", async () => {
  env = base;
  const onCreate = mock(() => {});
  const onImport = mock(() => {});
  const onConnectGithub = mock(() => {});
  render(<Welcome onCreate={onCreate} onImport={onImport} onConnectGithub={onConnectGithub} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Connecter" }));
  await user.click(screen.getByRole("button", { name: "Importer un dossier existant" }));
  await user.click(screen.getByRole("button", { name: "Créer mon premier projet" }));
  expect([onConnectGithub.mock.calls.length, onImport.mock.calls.length, onCreate.mock.calls.length]).toEqual(
    [1, 1, 1],
  );
});
