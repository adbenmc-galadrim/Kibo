import { beforeEach, expect, mock, test } from "bun:test";
import { type IntegrationStatus, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let statuses: IntegrationStatus[] = [];
let listError: KiboError | null = null;
let testError: KiboError | null = null;
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

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "listIntegrations") {
          if (listError) throw listError;
          return statuses;
        }
        if (req.method === "testIntegration") {
          if (testError) throw testError;
          return status(req.id, "connected");
        }
        if (req.method === "getGithubConnectOptions")
          return { ghAvailable: true, ghLogin: "adam", mode: "gh" };
        return null;
      },
      subscribeIntegrations: () => () => undefined,
    },
  }),
);

const { IntegrationsPage } = await import("./IntegrationsPage");

beforeEach(() => {
  calls.length = 0;
  listError = null;
  testError = null;
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
  expect((await screen.findByRole("alert")).textContent).toMatch(
    /Trousseau système indisponible : déverrouille/,
  );
});

test("a failed listing shows its error without the keychain banner", async () => {
  listError = new KiboError("INTERNAL", "daemon unreachable");
  render(<IntegrationsPage />);
  expect((await screen.findByRole("alert")).textContent).toBe("Une erreur est survenue.");
  expect(screen.queryByText(/Trousseau système indisponible/)).toBeNull();
});

test("a keychain failure of the listing shows only the banner", async () => {
  listError = new KiboError("SECRET_STORE_UNAVAILABLE", "locked");
  render(<IntegrationsPage />);
  expect((await screen.findByRole("alert")).textContent).toMatch(/Trousseau système indisponible/);
  expect(screen.queryByText("locked")).toBeNull();
});

test("a failed connection test is explained in French", async () => {
  testError = new KiboError("NOT_CONNECTED", "github account not connected");
  const user = userEvent.setup();
  render(<IntegrationsPage />);
  await user.click(await screen.findByRole("button", { name: "Actions pour GitHub" }));
  await user.click(await screen.findByRole("menuitem", { name: "Tester la connexion" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Compte GitHub non connecté : reconnecte ton compte",
  );
  expect(screen.queryByText(/account not connected/)).toBeNull();
});

test("a token lost after a restart turns the github row into Reconnecter", async () => {
  statuses = [
    status("github", "error", {
      account: "adam",
      error: { code: "NOT_CONNECTED", message: "github token missing from the keychain" },
    }),
  ];
  render(<IntegrationsPage />);
  expect(await screen.findByText("Compte GitHub non connecté : reconnecte ton compte")).toBeDefined();
  expect(screen.queryByText("Connecté")).toBeNull();
  expect(screen.getByRole("button", { name: "Reconnecter" })).toBeDefined();
});

test("a failing mcp row offers Réessayer and Déconnecter, after confirmation", async () => {
  statuses = [
    status("mcp", "error", {
      servers: ["sentry-staging"],
      error: { code: "MCP_UNAVAILABLE", message: "sentry-staging" },
    }),
  ];
  const user = userEvent.setup();
  render(<IntegrationsPage />);
  expect(await screen.findByText("Serveur sentry-staging injoignable")).toBeDefined();
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Actions pour Serveurs MCP" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déconnecter" }));
  const dialog = await screen.findByRole("dialog", { name: "Déconnecter Serveurs MCP ?" });
  await user.click(within(dialog).getByRole("button", { name: "Déconnecter" }));
  expect(calls).toContainEqual({ method: "disconnectIntegration", id: "mcp" });
});

test("penpot disconnects after confirmation, keeping the links and the cache", async () => {
  statuses = [status("penpot", "connected", { account: "Adam · design.penpot.app" })];
  const user = userEvent.setup();
  render(<IntegrationsPage />);
  expect(
    await screen.findByText("Cadres liés aux tickets et widgets Maquette · Adam · design.penpot.app"),
  ).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Actions pour Penpot" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déconnecter" }));
  const dialog = await screen.findByRole("dialog", { name: "Déconnecter Penpot ?" });
  expect(
    within(dialog).getByText(
      "Le jeton est supprimé du trousseau. Les liens vers les cadres restent, les aperçus en cache aussi.",
    ),
  ).toBeDefined();
  await user.click(within(dialog).getByRole("button", { name: "Déconnecter" }));
  expect(calls).toContainEqual({ method: "disconnectIntegration", id: "penpot" });
});
