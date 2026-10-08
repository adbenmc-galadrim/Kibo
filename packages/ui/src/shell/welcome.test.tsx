import { expect, mock, test } from "bun:test";
import type { Environment, RpcRequest, SandboxStatus } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

let env: Environment;
const isolated: SandboxStatus = {
  kind: "bwrap",
  available: true,
  reason: null,
  fix: null,
  allowUnsandboxed: false,
};
let sandbox: SandboxStatus = isolated;
let environmentCalls = 0;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        if (req.method === "getSandboxStatus") return sandbox;
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
  app: { version: "1.5.0", platform: "darwin", arch: "arm64", home: "~/.kibo", daemonPid: 42, uptimeMs: 0 },
};

test("shows the seven checks of screen 19", async () => {
  env = base;
  render(<Welcome {...noop} />);
  expect(await screen.findByText("Bienvenue dans Kibo")).toBeTruthy();
  expect(await screen.findByText("claude détecté · connecté à ton abonnement")).toBeTruthy();
  expect(screen.getByText("git 2.51 détecté")).toBeTruthy();
  expect(screen.getByText("gh 2.80 · pour les PR et la CI depuis Kibo")).toBeTruthy();
  for (const title of [
    "Démon local",
    "Claude Code",
    "Git",
    "GitHub CLI",
    "Capacité machine",
    "Isolation des composants",
    "GitHub (optionnel)",
  ])
    expect(screen.getByText(title)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  expect(screen.getByText("8 cœurs, 16 Go → 3 places d'agents (modifiable)")).toBeTruthy();
  expect(screen.getByText("En marche sur 127.0.0.1:47831 · données dans ~/.kibo")).toBeTruthy();
});

test("explains a missing claude", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "missing", version: null, loggedIn: null } };
  render(<Welcome {...noop} />);
  expect(
    await screen.findByText("claude introuvable dans le PATH · les agents sont désactivés"),
  ).toBeTruthy();
  expect(screen.getByText("npm install -g @anthropic-ai/claude-code")).toBeTruthy();
});

test("explains a logged out claude", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "logged_out", loggedIn: false } };
  render(<Welcome {...noop} />);
  expect(await screen.findByText("claude détecté · non connecté")).toBeTruthy();
  expect(screen.getByText("Lance claude dans un terminal, puis tape /login :")).toBeTruthy();
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

test("the isolation row shows the active mechanism", async () => {
  env = base;
  sandbox = isolated;
  render(<Welcome {...noop} />);
  expect(await screen.findByText("bubblewrap actif")).toBeTruthy();
  expect(screen.getByText("Isolation des composants")).toBeTruthy();
});

test("warns when the OS isolation is unavailable, with the command to run", async () => {
  env = base;
  sandbox = {
    kind: "bwrap",
    available: false,
    reason: "bubblewrap (bwrap) is not installed",
    fix: "sudo apt install bubblewrap",
    allowUnsandboxed: false,
  };
  render(<Welcome {...noop} />);
  expect(
    await screen.findByText("⚠ bubblewrap introuvable · les backends sandboxés ne démarreront pas"),
  ).toBeTruthy();
  expect(screen.getByText("sudo apt install bubblewrap")).toBeTruthy();
  expect(
    screen.getByText(
      "Une vérification demande ton attention. Tu peux continuer : seuls les backends sandboxés sont arrêtés.",
    ),
  ).toBeTruthy();
  sandbox = isolated;
});

test("the failure subtitle appears when claude is missing", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "missing", version: null, loggedIn: null } };
  render(<Welcome {...noop} />);
  expect(
    await screen.findByText(
      "Une vérification a échoué. Tu peux continuer : tout fonctionne sauf les agents.",
    ),
  ).toBeTruthy();
});

test("Réessayer refetches the environment", async () => {
  env = { ...base, ai: { ...base.ai, available: false, reason: "missing", version: null, loggedIn: null } };
  environmentCalls = 0;
  render(<Welcome {...noop} />);
  const retry = await screen.findByRole("button", { name: "Réessayer" });
  env = base;
  await userEvent.setup().click(retry);
  expect(await screen.findByText("claude détecté · connecté à ton abonnement")).toBeTruthy();
  expect(environmentCalls).toBe(2);
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
});

test("the tutorial button calls onTutorial", async () => {
  env = base;
  const onTutorial = mock(() => {});
  render(<Welcome {...noop} onTutorial={onTutorial} />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Suivre le didacticiel (10 min)" }));
  expect(onTutorial).toHaveBeenCalledTimes(1);
});
