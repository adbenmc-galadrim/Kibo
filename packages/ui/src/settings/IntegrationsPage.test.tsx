import { beforeEach, expect, mock, test } from "bun:test";
import { type IntegrationStatus, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let statuses: IntegrationStatus[] = [];
let listError: KiboError | null = null;
const status = (
  id: IntegrationStatus["id"],
  state: IntegrationStatus["state"],
  patch: Partial<IntegrationStatus> = {},
): IntegrationStatus => ({
  id,
  state,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
  ...patch,
});

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listIntegrations") {
        if (listError) throw listError;
        return statuses;
      }
      if (req.method === "testIntegration") return status(req.id, "connected");
      if (req.method === "getGithubConnectOptions") return { ghAvailable: true, ghLogin: "adam", mode: "gh" };
      return null;
    },
    subscribeIntegrations: () => () => undefined,
  },
}));

const { IntegrationsPage } = await import("./IntegrationsPage");

beforeEach(() => {
  calls.length = 0;
  listError = null;
  statuses = [
    status("git", "active"),
    status("github", "connected", { account: "adam" }),
    status("figma", "disconnected"),
    status("mcp", "connected", { servers: ["context7", "filesystem"] }),
  ];
});

test("renders one row per integration with the screen 16 texts", async () => {
  render(<IntegrationsPage />);
  expect(await screen.findByText("PR, reviews, statuts CI · compte adam")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Intégrations" })).toBeDefined();
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Intégrations" }).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", { name: "Domaines & guidelines" }).getAttribute("href")).toBe(
    "#/settings/domains",
  );
  expect(
    screen.getByText(
      "Les secrets sont stockés dans le trousseau système, jamais dans les données du projet.",
    ),
  ).toBeDefined();
  expect(screen.getByText("Connecteur générique · 2 serveurs (context7, filesystem)")).toBeDefined();
  expect(screen.getAllByText("Connecté")).toHaveLength(2);
  expect(screen.getByText("Actif")).toBeDefined();
});

test("tests and disconnects through the row menu, after confirmation", async () => {
  const user = userEvent.setup();
  render(<IntegrationsPage />);
  await user.click(await screen.findByRole("button", { name: "Actions pour GitHub" }));
  await user.click(await screen.findByRole("menuitem", { name: "Tester la connexion" }));
  expect(calls).toContainEqual({ method: "testIntegration", id: "github" });
  expect((await screen.findByRole("status")).textContent).toBe("Connexion vérifiée");
  await user.click(screen.getByRole("button", { name: "Actions pour GitHub" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déconnecter" }));
  const dialog = await screen.findByRole("dialog", { name: "Déconnecter GitHub ?" });
  expect(within(dialog).getByText(/Kibo cesse d'utiliser ton compte gh/)).toBeDefined();
  await user.click(within(dialog).getByRole("button", { name: "Déconnecter" }));
  expect(calls).toContainEqual({ method: "disconnectIntegration", id: "github" });
});

test("a keychain failure shows the banner", async () => {
  statuses = [status("github", "error", { error: { code: "SECRET_STORE_UNAVAILABLE", message: "locked" } })];
  render(<IntegrationsPage />);
  expect(await screen.findByText(/Trousseau système indisponible/)).toBeDefined();
});

test("a failed listing shows its error without the keychain banner", async () => {
  listError = new KiboError("INTERNAL", "daemon unreachable");
  render(<IntegrationsPage />);
  expect((await screen.findByRole("alert")).textContent).toBe("daemon unreachable");
  expect(screen.queryByText(/Trousseau système indisponible/)).toBeNull();
});

test("a keychain failure of the listing shows only the banner", async () => {
  listError = new KiboError("SECRET_STORE_UNAVAILABLE", "locked");
  render(<IntegrationsPage />);
  expect((await screen.findByRole("alert")).textContent).toMatch(/Trousseau système indisponible/);
  expect(screen.queryByText("locked")).toBeNull();
});
