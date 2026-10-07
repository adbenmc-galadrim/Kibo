import { beforeEach, expect, mock, test } from "bun:test";
import { type IntegrationStatus, KiboError, type McpServerView, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let reply: (req: RpcRequest) => Promise<unknown> = async () => null;
mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return reply(req);
    },
  },
}));

const { GithubConnectDialog } = await import("./GithubConnectDialog");
const { FigmaConnectDialog } = await import("./FigmaConnectDialog");
const { PenpotConnectDialog } = await import("./PenpotConnectDialog");
const { McpServerDialog } = await import("./McpServerDialog");
const { McpServersDialog } = await import("./McpServersDialog");
const { INTEGRATION_DIALOGS } = await import("../../settings/integration-dialogs");

const server = (
  patch: Partial<Pick<McpServerView, "id" | "name" | "enabled" | "state" | "tools" | "error">> = {},
): McpServerView => ({
  transport: "stdio",
  id: "context7",
  name: "Context7",
  command: "npx",
  args: [],
  envNames: [],
  enabled: true,
  state: "connected",
  error: null,
  tools: [
    { name: "a", description: null, inputSchema: {} },
    { name: "b", description: null, inputSchema: {} },
  ],
  secretsSet: [],
  ...patch,
});

beforeEach(() => {
  calls.length = 0;
  reply = async (req) =>
    req.method === "getGithubConnectOptions" ? { ghAvailable: false, ghLogin: null, mode: null } : null;
});

test("the four dialogs are registered", () => {
  expect(Object.keys(INTEGRATION_DIALOGS).sort()).toEqual(["figma", "github", "mcp", "penpot"]);
});

test("github: gh is disabled when missing, a refused token is explained", async () => {
  reply = async (req) => {
    if (req.method === "getGithubConnectOptions") return { ghAvailable: false, ghLogin: null, mode: null };
    throw new KiboError("REMOTE_REJECTED", "401");
  };
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  expect(await screen.findByText("gh n'est pas installé ou pas connecté (gh auth login).")).toBeDefined();
  expect(screen.getByRole("radio", { name: "Utiliser gh" })).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("radio", { name: "Jeton personnel" }));
  const field = screen.getByLabelText("Jeton");
  expect(field.getAttribute("type")).toBe("password");
  const card = screen
    .getByRole("radio", { name: "Jeton personnel" })
    .closest<HTMLElement>("[data-slot=choice-panel]");
  if (!card) throw new Error("token card not found");
  expect(within(card).getByLabelText("Jeton")).toBe(field);
  expect(within(card).getByText(/^Portées requises/)).toBeDefined();
  await user.type(field, "ghp_wrong");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect((await within(card).findByRole("alert")).textContent).toBe("GitHub a refusé ce jeton.");
  expect(screen.queryByText(/ghp_wrong/)).toBeNull();
  expect(calls).toContainEqual({ method: "connectGithub", auth: { mode: "token", token: "ghp_wrong" } });
});

test("github: gh is preselected when connected", async () => {
  reply = async (req) => {
    if (req.method === "getGithubConnectOptions") return { ghAvailable: true, ghLogin: "adam", mode: null };
    return { login: "adam" };
  };
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(await screen.findByText("gh est connecté (adam)")).toBeDefined();
  expect(
    screen.getByText("PR, reviews et statuts CI de tes projets. Le jeton reste dans le trousseau système."),
  ).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({ method: "connectGithub", auth: { mode: "gh" } });
  expect(onDone).toHaveBeenCalledWith("Connecté en tant que adam");
});

test("github: a locked keychain is explained", async () => {
  reply = async (req) => {
    if (req.method === "getGithubConnectOptions") return { ghAvailable: false, ghLogin: null, mode: null };
    throw new KiboError("SECRET_STORE_UNAVAILABLE", "locked");
  };
  const user = userEvent.setup();
  render(<GithubConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  await user.type(await screen.findByLabelText("Jeton"), "ghp_x");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/^Trousseau système indisponible/);
});

const status = (patch: Partial<IntegrationStatus> & Pick<IntegrationStatus, "id">): IntegrationStatus => ({
  state: "connected",
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
  ...patch,
});

test("figma: the personal token is the default and is never shown again", async () => {
  reply = async () => status({ id: "figma", account: "adam" });
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<FigmaConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(screen.getByRole("radio", { name: "Jeton personnel" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByText("Recommandé")).toBeDefined();
  const field = screen.getByLabelText("Jeton");
  expect(field.getAttribute("type")).toBe("password");
  expect(screen.getByRole("button", { name: "Connecter" })).toHaveProperty("disabled", true);
  await user.type(field, "figd_x");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({ method: "connectFigma", auth: { mode: "token", token: "figd_x" } });
  expect(onDone).toHaveBeenCalledWith("Connecté en tant que adam");
  expect(field).toHaveProperty("value", "");
  expect(document.body.innerHTML).not.toContain("figd_x");
});

test("figma: a refused token is explained on the field", async () => {
  reply = async () => {
    throw new KiboError("REMOTE_REJECTED", "figma 403");
  };
  const user = userEvent.setup();
  render(<FigmaConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  await user.type(screen.getByLabelText("Jeton"), "figd_wrong");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Jeton refusé")).toBeDefined();
  expect(screen.getByLabelText("Jeton").getAttribute("aria-invalid")).toBe("true");
  expect(document.body.innerHTML).not.toContain("figd_wrong");
});

test("figma: an unreachable api in token mode does not mention the mcp server", async () => {
  reply = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "down");
  };
  const user = userEvent.setup();
  render(<FigmaConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  await user.type(screen.getByLabelText("Jeton"), "figd_x");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Figma injoignable")).toBeDefined();
  expect(
    within(alert).getByText(
      "Impossible de joindre api.figma.com. Vérifie ta connexion internet, puis réessaie.",
    ),
  ).toBeDefined();
  expect(alert.textContent).not.toContain("serveur MCP");
  expect(screen.getByLabelText("Jeton").getAttribute("aria-invalid")).toBe("false");
});

test("figma: the mcp server mode sends the prefilled address", async () => {
  let state: IntegrationStatus["state"] = "error";
  reply = async () =>
    status({
      id: "figma",
      state,
      error: state === "error" ? { code: "MCP_UNAVAILABLE", message: "down" } : null,
    });
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<FigmaConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  await user.click(screen.getByRole("radio", { name: "Serveur MCP de l'application Figma" }));
  expect(screen.queryByLabelText("Jeton")).toBeNull();
  expect(screen.getByLabelText("Adresse du serveur")).toHaveProperty("value", "http://127.0.0.1:3845/mcp");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({
    method: "connectFigma",
    auth: { mode: "mcp", url: "http://127.0.0.1:3845/mcp" },
  });
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Serveur Figma injoignable")).toBeDefined();
  state = "connected";
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(onDone).toHaveBeenCalledWith("Serveur MCP connecté");
});

test("figma: missing tools are listed as a warning", async () => {
  reply = async () => {
    throw new KiboError("MCP_FAILED", "figma server lacks tools: get_screenshot");
  };
  const user = userEvent.setup();
  render(<FigmaConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  await user.click(screen.getByRole("radio", { name: "Serveur MCP de l'application Figma" }));
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Ce serveur n'expose pas les outils Figma attendus")).toBeDefined();
  expect(within(alert).getByText("Outils manquants : get_screenshot. Mets Figma à jour.")).toBeDefined();
  expect(alert.dataset.tone).toBe("warning");
});

test("penpot: the default instance and the token connect the account", async () => {
  reply = async () => status({ id: "penpot", account: "Adam" });
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<PenpotConnectDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(screen.getByLabelText("Adresse de l'instance")).toHaveProperty("value", "https://design.penpot.app");
  const field = screen.getByLabelText("Jeton d'accès");
  expect(field.getAttribute("type")).toBe("password");
  expect(screen.getByRole("button", { name: "Connecter" })).toHaveProperty("disabled", true);
  await user.type(field, "penpot-secret");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(calls).toContainEqual({
    method: "connectPenpot",
    url: "https://design.penpot.app",
    token: "penpot-secret",
  });
  expect(onDone).toHaveBeenCalledWith("Connecté en tant que Adam");
  expect(field).toHaveProperty("value", "");
  expect(document.body.innerHTML).not.toContain("penpot-secret");
});

test("penpot: an unreachable instance is explained and the token is cleared", async () => {
  reply = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "econnrefused");
  };
  const user = userEvent.setup();
  render(<PenpotConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  const url = screen.getByLabelText("Adresse de l'instance");
  await user.clear(url);
  await user.type(url, "http://localhost:9010");
  await user.type(screen.getByLabelText("Jeton d'accès"), "penpot-secret");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Instance injoignable")).toBeDefined();
  expect(within(alert).getByText(/localhost:9010/)).toBeDefined();
  expect(screen.getByLabelText("Jeton d'accès")).toHaveProperty("value", "");
  expect(document.body.innerHTML).not.toContain("penpot-secret");
});

test("penpot: the steps are listed and an ignored token names the flag", async () => {
  reply = async () => ({
    id: "penpot",
    state: "error",
    account: null,
    servers: [],
    resumeAt: null,
    error: { code: "TOKEN_IGNORED", message: "penpot ignored the access token" },
  });
  const user = userEvent.setup();
  render(<PenpotConnectDialog open onOpenChange={() => {}} onDone={() => {}} />);
  const steps = screen.getByRole("list", { name: "Comment faire" });
  expect(steps.textContent).toContain("Jetons d'accès");
  expect(steps.textContent).toContain("enable-access-tokens");
  expect(screen.getByRole("link", { name: "Documentation Penpot" }).getAttribute("href")).toBe(
    "https://help.penpot.app/technical-guide/configuration/",
  );
  const url = screen.getByLabelText("Adresse de l'instance");
  await user.clear(url);
  await user.type(url, "http://localhost:9010");
  await user.type(screen.getByLabelText("Jeton d'accès"), "penpot-secret");
  await user.click(screen.getByRole("button", { name: "Connecter" }));
  expect(await screen.findByText("Penpot a ignoré ce jeton")).toBeTruthy();
  expect(screen.getByText(/Ajoute enable-access-tokens à PENPOT_FLAGS, redémarre/)).toBeTruthy();
  expect(screen.getByLabelText("Jeton d'accès").getAttribute("aria-invalid")).toBe("true");
});

test("mcp: the exact command is shown and confirmed before adding", async () => {
  reply = async (req) => {
    if (req.method === "previewMcpServer") return { commandLine: "npx -y @upstash/context7-mcp" };
    return null;
  };
  const onAdded = mock(() => {});
  const user = userEvent.setup();
  render(<McpServerDialog open onOpenChange={() => {}} onAdded={onAdded} takenIds={[]} />);
  await user.type(screen.getByLabelText("Nom"), "Context7");
  await user.type(screen.getByLabelText("Commande"), "npx");
  await user.type(screen.getByLabelText("Arguments (un par ligne)"), "-y{Enter}@upstash/context7-mcp");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirmer la commande" });
  expect(within(dialog).getByText("npx -y @upstash/context7-mcp")).toBeDefined();
  expect(within(dialog).getByText("Étape 2 sur 2 · Kibo lancera exactement ceci, sans shell.")).toBeDefined();
  expect(
    within(dialog).getByText(
      "Environnement réduit : PATH, HOME et LANG. Aucune autre variable n'est transmise.",
    ),
  ).toBeDefined();
  const warning = within(dialog).getByRole("note");
  expect(within(warning).getByText("Ce processus aura les droits de ton utilisateur")).toBeDefined();
  expect(within(warning).getByText("N'ajoute qu'un serveur dont tu connais la source.")).toBeDefined();
  await user.click(within(dialog).getByRole("button", { name: "Ajouter et lancer" }));
  expect(calls.at(-1)).toEqual({
    method: "addMcpServer",
    server: {
      transport: "stdio",
      id: "context7",
      name: "Context7",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      envNames: [],
    },
    confirmedCommandLine: "npx -y @upstash/context7-mcp",
    secrets: {},
  });
  expect(onAdded).toHaveBeenCalled();
});

test("mcp: secret values are masked, a taken id or invalid field is refused", async () => {
  const user = userEvent.setup();
  render(<McpServerDialog open onOpenChange={() => {}} onAdded={() => {}} takenIds={["context7"]} />);
  await user.type(screen.getByLabelText("Nom"), "Context7");
  await user.click(screen.getByRole("button", { name: "Ajouter une variable" }));
  expect(screen.getByLabelText("Valeur").getAttribute("type")).toBe("password");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Identifiant déjà utilisé.");
  await user.clear(screen.getByLabelText("Identifiant"));
  await user.type(screen.getByLabelText("Identifiant"), "ctx");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Commande : valeur invalide.");
  expect(calls.some((c) => c.method === "previewMcpServer")).toBe(false);
});

test("mcp list: toggles, removes after confirmation, reports on close", async () => {
  let servers = [
    server(),
    server({ id: "linear", name: "Linear", enabled: false, state: "idle", tools: [] }),
  ];
  reply = async (req) => {
    if (req.method === "listMcpServers") return servers;
    if (req.method === "removeMcpServer") {
      servers = servers.filter((s) => s.id !== req.id);
      return null;
    }
    return null;
  };
  const onDone = mock((_message?: string) => {});
  const user = userEvent.setup();
  render(<McpServersDialog open onOpenChange={() => {}} onDone={onDone} />);
  expect(await screen.findByText("Commande locale (stdio) · 2 outils")).toBeDefined();
  expect(screen.getByText("Désactivé")).toBeDefined();
  expect(screen.getByText("Commande locale (stdio) · —")).toBeDefined();
  expect(screen.queryByText(/0 outil/)).toBeNull();
  await user.click(screen.getByRole("switch", { name: "Activé Linear" }));
  expect(calls).toContainEqual({ method: "setMcpServerEnabled", id: "linear", enabled: true });
  await user.click(screen.getAllByRole("button", { name: "Retirer" })[0] as HTMLElement);
  const confirm = await screen.findByRole("alertdialog");
  expect(within(confirm).getByText(/^Retirer Context7 \?/)).toBeDefined();
  await user.click(within(confirm).getByRole("button", { name: "Retirer" }));
  expect(calls).toContainEqual({ method: "removeMcpServer", id: "context7" });
  expect(await screen.findByText("Linear")).toBeDefined();
  expect(screen.queryByText("Context7")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Fermer" }));
  expect(onDone).toHaveBeenCalled();
});

test("mcp list: a failing server is explained in French", async () => {
  const failing = server({
    id: "sentry-staging",
    name: "Sentry staging",
    state: "error",
    error: "sentry-staging: Unable to connect. Is the computer able to access the url?",
  });
  reply = async (req) => (req.method === "listMcpServers" ? [failing] : null);
  render(<McpServersDialog open onOpenChange={() => {}} onDone={() => {}} />);
  expect(
    await screen.findByText("Connexion impossible : vérifie l'adresse ou la commande du serveur."),
  ).toBeDefined();
  expect(screen.queryByText(/Unable to connect/)).toBeNull();
});

test("mcp list: empty state and add flow", async () => {
  reply = async (req) => (req.method === "listMcpServers" ? [] : null);
  const user = userEvent.setup();
  render(<McpServersDialog open onOpenChange={() => {}} onDone={() => {}} />);
  expect(await screen.findByText("Aucun serveur MCP.")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Ajouter un serveur" }));
  expect(await screen.findByRole("dialog", { name: "Ajouter un serveur MCP" })).toBeDefined();
});

test("mcp: the reduced environment names the secret variables", async () => {
  const { fr } = await import("../../i18n/fr");
  const env = fr.integrations.mcpServer.environment;
  expect(env(["FS_TOKEN"])).toBe(
    "Environnement réduit : PATH, HOME, LANG et FS_TOKEN (lu dans le trousseau). Aucune autre variable n'est transmise.",
  );
  expect(env(["A", "B"])).toBe(
    "Environnement réduit : PATH, HOME, LANG, A et B (lues dans le trousseau). Aucune autre variable n'est transmise.",
  );
});
