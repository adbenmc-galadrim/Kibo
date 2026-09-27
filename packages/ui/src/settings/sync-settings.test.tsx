import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { KiboError, type RpcRequest, type SyncStatus } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let results: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return (results[req.method] ?? (() => Promise.resolve(null)))();
    },
    subscribeEvents: () => () => undefined,
  },
}));

const { SyncSettingsPage } = await import("./SyncSettingsPage");
const { SyncIndicator } = await import("../shell/SyncIndicator");
const { groupByFour } = await import("../dialogs/AddDeviceDialog");

const NOW = Date.now();
const unconfigured: SyncStatus = {
  state: "unconfigured",
  serverUrl: null,
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [],
};
const online: SyncStatus = {
  state: "online",
  serverUrl: "wss://sync.kibo.test",
  user: { id: "u_7f3c9a", name: "Adam" },
  deviceId: "d1",
  retryAt: null,
  lastError: null,
  projects: [
    {
      projectId: "p1",
      name: "Kibo",
      role: "owner",
      lastSyncAt: NOW - 2_000,
      lastError: null,
      accessRevoked: false,
    },
    {
      projectId: "p2",
      name: "Portfolio",
      role: "editor",
      lastSyncAt: NOW - 180_000,
      lastError: null,
      accessRevoked: false,
    },
    {
      projectId: "p3",
      name: "Site Léa",
      role: "viewer",
      lastSyncAt: null,
      lastError: "ACCESS_REVOKED",
      accessRevoked: true,
    },
  ],
};
const devices = [
  { deviceId: "d1", name: "MacBook d'Adam", createdAt: NOW - 86_400_000, lastSeenAt: NOW, revokedAt: null },
  {
    deviceId: "d2",
    name: "iMac bureau",
    createdAt: NOW - 5 * 86_400_000,
    lastSeenAt: NOW - 2 * 3_600_000,
    revokedAt: null,
  },
  { deviceId: "d3", name: "Vieux PC", createdAt: NOW - 9 * 86_400_000, lastSeenAt: null, revokedAt: NOW },
];

const withProject = (lastError: string): SyncStatus => ({
  ...online,
  projects: [
    { projectId: "p1", name: "Kibo", role: "owner", lastSyncAt: NOW, lastError, accessRevoked: false },
  ],
});

beforeEach(() => {
  calls.length = 0;
  results = { getSyncStatus: () => Promise.resolve(online), listDevices: () => Promise.resolve(devices) };
});

async function openConnect() {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  await userEvent.click(await screen.findByRole("button", { name: "Se connecter à un serveur" }));
  return screen.getByRole("dialog");
}

async function submitConnect(dialog: HTMLElement, url: string) {
  await userEvent.type(within(dialog).getByLabelText("Adresse du serveur"), url);
  await userEvent.type(within(dialog).getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(within(dialog).getByRole("button", { name: "Se connecter" }));
}

test("unconfigured shows the empty state and the connect button", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  expect(await screen.findByText("Aucun serveur de sync configuré.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Se connecter à un serveur" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sync" }).getAttribute("aria-current")).toBe("page");
});

test("the connect dialog sends the form and maps server errors", async () => {
  results.connectSyncServer = () => Promise.reject(new KiboError("INVITE_INVALID", "bad code"));
  const dialog = await openConnect();
  expect((within(dialog).getByLabelText("Nom de cet appareil") as HTMLInputElement).value).toBe(
    "Ordinateur de Adam",
  );
  await submitConnect(dialog, "wss://sync.kibo.test");
  expect(await within(dialog).findByText("Code invalide ou expiré")).toBeTruthy();
  expect(calls.find((c) => c.method === "connectSyncServer")).toEqual({
    method: "connectSyncServer",
    serverUrl: "wss://sync.kibo.test",
    code: "ABCD",
    deviceName: "Ordinateur de Adam",
    caFile: null,
  });
});

test("an unencrypted address is explained", async () => {
  results.connectSyncServer = () => Promise.reject(new KiboError("TLS_REQUIRED", "ws"));
  const dialog = await openConnect();
  await submitConnect(dialog, "ws://10.0.0.2");
  expect(await within(dialog).findByText("Adresse non chiffrée : utilise wss://")).toBeTruthy();
});

test("an unknown connect failure never shows the raw daemon message", async () => {
  results.connectSyncServer = () => Promise.reject(new KiboError("GIT_FAILED", "stack at /tmp/x"));
  const dialog = await openConnect();
  await submitConnect(dialog, "wss://sync.kibo.test");
  expect(await within(dialog).findByText("Connexion impossible")).toBeTruthy();
  expect(dialog.textContent).not.toContain("/tmp/x");
});

test("connected shows server, account, devices and shared projects", async () => {
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  expect(await screen.findByText("wss://sync.kibo.test")).toBeTruthy();
  expect(screen.getByText("Connecté")).toBeTruthy();
  expect(screen.getByText("u_7f3c9a")).toBeTruthy();
  const table = await screen.findByRole("table", { name: "Appareils" });
  expect(await within(table).findByText("Cet appareil")).toBeTruthy();
  expect(within(table).getByText("il y a 2 h")).toBeTruthy();
  expect(within(table).queryByText("Vieux PC")).toBeNull();
  const projects = screen.getByRole("table", { name: "Projets partagés" });
  expect(within(projects).getByText("Propriétaire")).toBeTruthy();
  expect(within(projects).getAllByText("Synchronisé")).toHaveLength(2);
  expect(within(projects).getByText("Accès retiré")).toBeTruthy();
});

test("a status that cannot be read is reported without technical details", async () => {
  results.getSyncStatus = () => Promise.reject(new KiboError("INTERNAL", "boom"));
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Impossible de lire l'état de la sync.");
});

test("revoking another device calls the daemon", async () => {
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  const table = await screen.findByRole("table", { name: "Appareils" });
  const row = (await within(table).findByText("iMac bureau")).closest("tr");
  if (!row) throw new Error("no row");
  await userEvent.click(within(row).getByRole("button", { name: "Révoquer" }));
  await waitFor(() =>
    expect(calls.some((c) => c.method === "revokeDevice" && c.deviceId === "d2")).toBe(true),
  );
});

test("adding a device shows the code once, grouped by four, and never logs it", async () => {
  const code = "K7QD9XMP2RTAHW4C8NEVB3YFQZ";
  const logs = [
    spyOn(console, "log"),
    spyOn(console, "error"),
    spyOn(console, "warn"),
    spyOn(console, "info"),
  ];
  results.addDevice = () => Promise.resolve({ code, expiresAt: NOW + 900_000 });
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  await userEvent.click(await screen.findByRole("button", { name: "Ajouter un appareil" }));
  const dialog = screen.getByRole("dialog");
  expect(await within(dialog).findByText("K7QD 9XMP 2RTA HW4C 8NEV B3YF QZ")).toBeTruthy();
  expect(
    within(dialog).getByText("Saisis ce code sur l'autre appareil dans Paramètres › Sync."),
  ).toBeTruthy();
  expect(within(dialog).getByText("Valable 15 minutes. Montré une seule fois.")).toBeTruthy();
  expect(globalThis.location.href).not.toContain(code);
  for (const spy of logs) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(code);
    spy.mockRestore();
  }
  await userEvent.click(within(dialog).getByRole("button", { name: "Terminé" }));
  await waitFor(() => expect(screen.queryByText("K7QD 9XMP 2RTA HW4C 8NEV B3YF QZ")).toBeNull());
});

test("groupByFour splits a code in blocks of four", () => {
  expect(groupByFour("4F7Q2MZK9RDA")).toBe("4F7Q 2MZK 9RDA");
  expect(groupByFour("ABCDE")).toBe("ABCD E");
});

test("from a remote session, sensitive actions are disabled but devices stay visible", async () => {
  render(<SyncSettingsPage viewer="Adam" remote />);
  const table = await screen.findByRole("table", { name: "Appareils" });
  expect(await within(table).findByText("iMac bureau")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Se déconnecter" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Ajouter un appareil" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(within(table).queryByRole("button", { name: "Révoquer" })).toBeNull();
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("from a remote session, connecting is disabled", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  render(<SyncSettingsPage viewer="Adam" remote />);
  const button = await screen.findByRole("button", { name: "Se connecter à un serveur" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("project errors are translated and a suspended project is explained", async () => {
  const cases: [string, string, string | null][] = [
    ["UPDATE_REJECTED", "Modifications refusées et perdues", "resynchronisé"],
    ["TOO_LARGE", "Sync suspendue : données trop volumineuses", "plus synchronisé"],
    ["INVALID_INPUT", "Sync suspendue : données illisibles", "plus synchronisé"],
    ["INTERNAL", "Sync suspendue : erreur interne", "plus synchronisé"],
    ["WHATEVER", "Erreur de sync", null],
  ];
  for (const [code, label, hint] of cases) {
    results.getSyncStatus = () => Promise.resolve(withProject(code));
    const { unmount } = render(<SyncSettingsPage viewer="Adam" remote={false} />);
    const projects = await screen.findByRole("table", { name: "Projets partagés" });
    expect(within(projects).getByText(label)).toBeTruthy();
    if (hint) expect(projects.textContent).toContain(hint);
    expect(projects.textContent).not.toContain(code);
    unmount();
  }
});

test("connection errors are translated in the server card", async () => {
  const cases: [string, string][] = [
    ["SYNC_OFFLINE", "Serveur injoignable"],
    [
      "DEVICE_REVOKED",
      "Cet appareil a été révoqué : déconnecte-toi puis reconnecte-le avec un nouveau code.",
    ],
    ["TLS_REQUIRED", "Adresse non chiffrée : utilise wss://"],
  ];
  for (const [code, text] of cases) {
    results.getSyncStatus = () => Promise.resolve({ ...online, state: "offline", lastError: code });
    const { unmount } = render(<SyncSettingsPage viewer="Adam" remote={false} />);
    expect(await screen.findByText(text)).toBeTruthy();
    unmount();
  }
});

test("the agent bar indicator follows the daemon and the connection", async () => {
  const cases: [SyncStatus, boolean, string][] = [
    [unconfigured, true, "Démon local"],
    [unconfigured, false, "Démon injoignable"],
    [online, true, "Démon local · synchronisé"],
    [{ ...online, state: "connecting" }, true, "Démon local · synchronisation…"],
    [{ ...online, state: "offline", retryAt: NOW + 12_000 }, true, "Démon local · hors ligne"],
    [{ ...online, state: "offline", lastError: "DEVICE_REVOKED" }, true, "Démon local · erreur de sync"],
  ];
  for (const [status, daemonOnline, label] of cases) {
    results.getSyncStatus = () => Promise.resolve(status);
    const { unmount } = render(<SyncIndicator online={daemonOnline} />);
    expect(await screen.findByText(label)).toBeTruthy();
    unmount();
  }
});

test("a reconnection countdown is shown in settings", async () => {
  results.getSyncStatus = () =>
    Promise.resolve({ ...online, state: "offline", retryAt: Date.now() + 12_400 });
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  expect(await screen.findByText(/Reconnexion dans 1[23] s/)).toBeTruthy();
});

test("offline without a device list, the table is replaced by an explanation", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "offline", retryAt: null });
  results.listDevices = () => Promise.reject(new KiboError("SYNC_OFFLINE", "not connected"));
  render(<SyncSettingsPage viewer="Adam" remote={false} />);
  expect(await screen.findByText("Liste des appareils disponible une fois connecté.")).toBeTruthy();
  expect(screen.queryByRole("table", { name: "Appareils" })).toBeNull();
});
