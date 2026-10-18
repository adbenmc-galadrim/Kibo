import { expect, mock, test } from "bun:test";
import type { Environment, RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

let env: Environment;
let environmentCalls = 0;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (_req: RpcRequest) => {
        environmentCalls += 1;
        return env;
      },
      subscribeEvents: () => () => {},
    },
  }),
);
const { Welcome } = await import("./Welcome");

const noop = { onCreate() {}, onImport() {}, onConnectGithub() {}, onTutorial() {} };

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
  app: {
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    userHome: null,
    daemonPid: 42,
    uptimeMs: 0,
    fixedNow: null,
  },
};

test("presents tracking: the value sentence and four checks, no agent slots nor isolation", async () => {
  env = base;
  render(<Welcome {...noop} />);
  expect(await screen.findByText("Bienvenue dans Kibo")).toBeTruthy();
  expect(
    screen.getByText(
      "Kibo suit tes projets : sprints, fonctionnalités, branches, PR et CI, mis à jour depuis git et GitHub.",
    ),
  ).toBeTruthy();
  expect(await screen.findByText("git 2.51 détecté")).toBeTruthy();
  expect(screen.getByText("gh 2.80 · remonte les PR, leur review et la CI")).toBeTruthy();
  for (const title of ["Git", "GitHub CLI", "Claude Code · pour l'agent de projet", "Compte GitHub"])
    expect(screen.getByText(title)).toBeTruthy();
  for (const gone of ["Démon local", "Capacité machine", "Isolation des composants"])
    expect(screen.queryByText(gone)).toBeNull();
  expect(screen.queryByText(/places d'agents/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
});

test("a missing gh says what is lost and how to install it", async () => {
  env = { ...base, gh: null };
  render(<Welcome {...noop} />);
  expect(
    await screen.findByText("gh introuvable · sans lui, ni PR, ni review, ni CI dans Kibo"),
  ).toBeTruthy();
  expect(screen.getByText("brew install gh")).toBeTruthy();
  expect(screen.queryByText(/facultatif/)).toBeNull();
});

test("a missing claude only disables the project agent", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "missing", version: null, loggedIn: null } };
  render(<Welcome {...noop} />);
  expect(await screen.findByText("claude introuvable · l'agent de projet n'est pas disponible")).toBeTruthy();
  expect(screen.getByText("npm install -g @anthropic-ai/claude-code")).toBeTruthy();
});

test("a connected GitHub hides the connect button", async () => {
  env = { ...base, github: { connected: true } };
  render(<Welcome {...noop} />);
  expect(await screen.findByText("Connecté")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Connecter" })).toBeNull();
});

test("buttons call their handlers", async () => {
  env = base;
  const onCreate = mock(() => {});
  const onImport = mock(() => {});
  const onConnectGithub = mock(() => {});
  render(<Welcome {...noop} onCreate={onCreate} onImport={onImport} onConnectGithub={onConnectGithub} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Connecter" }));
  await user.click(screen.getByRole("button", { name: "Importer un dossier existant" }));
  await user.click(screen.getByRole("button", { name: "Créer mon premier projet" }));
  expect([onConnectGithub.mock.calls.length, onImport.mock.calls.length, onCreate.mock.calls.length]).toEqual(
    [1, 1, 1],
  );
});

test("Réessayer refetches the environment", async () => {
  env = { ...base, git: null };
  environmentCalls = 0;
  render(<Welcome {...noop} />);
  const retry = await screen.findByRole("button", { name: "Réessayer" });
  env = base;
  await userEvent.setup().click(retry);
  expect(await screen.findByText("git 2.51 détecté")).toBeTruthy();
  expect(environmentCalls).toBe(2);
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
});

test("the tutorial button calls onTutorial", async () => {
  env = base;
  const onTutorial = mock(() => {});
  render(<Welcome {...noop} onTutorial={onTutorial} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Suivre le didacticiel (5 min)" }));
  expect(onTutorial).toHaveBeenCalledTimes(1);
});
