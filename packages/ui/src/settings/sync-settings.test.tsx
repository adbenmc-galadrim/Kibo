import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { KiboError, type RpcRequest, type SyncStatus } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let results: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return (results[req.method] ?? (() => Promise.resolve(null)))();
      },
      subscribeEvents: () => () => undefined,
    },
  }),
);

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

function page(remote = false) {
  return render(
    <SyncSettingsPage
      viewer="Adam"
      projects={[]}
      remote={remote}
      onOpen={() => {}}
      onShare={() => {}}
      onDeleteProject={() => {}}
    />,
  );
}

beforeEach(() => {
  calls.length = 0;
  results = { getSyncStatus: () => Promise.resolve(online), listDevices: () => Promise.resolve(devices) };
});

async function openConnect() {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  page();
  await userEvent.click(await screen.findByRole("button", { name: "Se connecter" }));
  return screen.getByRole("dialog");
}

async function submitConnect(dialog: HTMLElement, url: string) {
  await userEvent.type(within(dialog).getByLabelText("Adresse du serveur"), url);
  await userEvent.type(within(dialog).getByLabelText("Code"), "ABCD");
  await userEvent.click(within(dialog).getByRole("button", { name: "Se connecter" }));
}

test("screen 119: the empty state explains, links to the docs, and offers both paths", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  page();
  expect(await screen.findByRole("heading", { level: 1, name: "Synchronisation" })).toBeTruthy();
  expect(screen.getByText(/Partage tes projets entre tes appareils/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Comment en installer un" }).getAttribute("href")).toContain(
    "kibo-sync",
  );
  expect(screen.getByRole("link", { name: "Synchronisation" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Entrer le code" }));
  const dialog = screen.getByRole("dialog", { name: "Se connecter à un serveur" });
  expect(within(dialog).getByText(/Ajouter un appareil/)).toBeTruthy();
  expect(within(dialog).queryByLabelText(/Certificat/)).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Options avancées" }));
  expect(within(dialog).getByLabelText(/Certificat racine/)).toBeTruthy();
  expect(within(dialog).getByText(/commence par wss:\/\//)).toBeTruthy();
});

test("connecting with an invitation explains both kinds of code", async () => {
  const dialog = await openConnect();
  expect(within(dialog).getByText("Code d'invitation (48 h) ou code d'appareil (15 min).")).toBeTruthy();
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
  page();
  expect(await screen.findByText("sync.kibo.test")).toBeTruthy();
  expect(screen.getByText("Connecté")).toBeTruthy();
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
  page();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Impossible de lire l'état de la sync.");
});

test("the server and account cards fold the raw url and id under Détails", async () => {
  page();
  expect(await screen.findByText("sync.kibo.test")).toBeTruthy();
  expect(screen.getByText("Adam")).toBeTruthy();
  expect(screen.queryByText("wss://sync.kibo.test")).toBeNull();
  expect(screen.queryByText("u_7f3c9a")).toBeNull();
  for (const button of screen.getAllByRole("button", { name: "Détails" })) fireEvent.click(button);
  expect(screen.getByText("wss://sync.kibo.test")).toBeTruthy();
  expect(screen.getByText("u_7f3c9a")).toBeTruthy();
});

async function revokeDialogFor(name: string) {
  const table = await screen.findByRole("table", { name: "Appareils" });
  const row = (await within(table).findByText(name)).closest("tr");
  if (!row) throw new Error("no row");
  await userEvent.click(within(row).getByRole("button", { name: "Révoquer…" }));
  return screen.getByRole("alertdialog", { name: `Révoquer ${name} ?` });
}

test("revoking another device asks for confirmation, then calls the daemon", async () => {
  page();
  let dialog = await revokeDialogFor("iMac bureau");
  expect(within(dialog).getByText("Cet appareil ne pourra plus se connecter.")).toBeTruthy();
  await userEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
  expect(calls.some((c) => c.method === "revokeDevice")).toBe(false);
  dialog = await revokeDialogFor("iMac bureau");
  await userEvent.click(within(dialog).getByRole("button", { name: "Révoquer" }));
  await waitFor(() =>
    expect(calls.some((c) => c.method === "revokeDevice" && c.deviceId === "d2")).toBe(true),
  );
});

test("a failed revocation stays in the confirmation with a readable message", async () => {
  results.revokeDevice = () => Promise.reject(new KiboError("SYNC_OFFLINE", "socket closed"));
  page();
  const dialog = await revokeDialogFor("iMac bureau");
  await userEvent.click(within(dialog).getByRole("button", { name: "Révoquer" }));
  expect(await within(dialog).findByText("Serveur injoignable : réessaie une fois reconnecté.")).toBeTruthy();
  expect(dialog.textContent).not.toContain("socket closed");
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
  page();
  await userEvent.click(await screen.findByRole("button", { name: "Ajouter un appareil" }));
  const dialog = screen.getByRole("dialog");
  expect(await within(dialog).findByText("K7QD 9XMP 2RTA HW4C 8NEV B3YF QZ")).toBeTruthy();
  expect(within(dialog).getByText("sync.kibo.test")).toBeTruthy();
  expect(within(dialog).getAllByRole("button", { name: "Copier" })).toHaveLength(2);
  const steps = within(dialog)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(steps).toEqual([
    "Sur l'autre appareil, ouvre Paramètres › Synchronisation.",
    "Choisis « C'est mon autre appareil ».",
    "Saisis l'adresse et ce code (15 minutes).",
  ]);
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
  page(true);
  const table = await screen.findByRole("table", { name: "Appareils" });
  expect(await within(table).findByText("iMac bureau")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Se déconnecter" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Ajouter un appareil" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(within(table).queryByRole("button", { name: "Révoquer…" })).toBeNull();
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("from a remote session, the empty state offers no connection", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  page(true);
  expect(
    await screen.findByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Se connecter" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Entrer le code" })).toBeNull();
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
    const { unmount } = page();
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
    const { unmount } = page();
    expect(await screen.findByText(text)).toBeTruthy();
    unmount();
  }
});

test("the agent bar indicator follows the daemon and the connection", async () => {
  const cases: [SyncStatus, boolean, string][] = [
    [unconfigured, true, "Kibo · connecté"],
    [unconfigured, false, "Kibo · hors ligne"],
    [online, true, "Kibo · synchronisé"],
    [{ ...online, state: "connecting" }, true, "Kibo · synchronisation…"],
    [{ ...online, state: "offline", retryAt: NOW + 12_000 }, true, "Kibo · sync hors ligne"],
    [{ ...online, state: "offline", lastError: "DEVICE_REVOKED" }, true, "Kibo · erreur de sync"],
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
  page();
  expect(await screen.findByText(/Reconnexion dans 1[23] s/)).toBeTruthy();
});

test("offline without a device list, the table is replaced by an explanation", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "offline", retryAt: null });
  results.listDevices = () => Promise.reject(new KiboError("SYNC_OFFLINE", "not connected"));
  page();
  expect(await screen.findByText("Liste des appareils disponible une fois connecté.")).toBeTruthy();
  expect(screen.queryByRole("table", { name: "Appareils" })).toBeNull();
});

test("shared projects offer Ouvrir, Gérer le partage, and Arrêter / Quitter according to the role", async () => {
  const opened: string[] = [];
  const shared: string[] = [];
  const deleted: string[] = [];
  render(
    <SyncSettingsPage
      viewer="Adam"
      projects={[]}
      remote={false}
      onOpen={(id) => opened.push(id)}
      onShare={(id) => shared.push(id)}
      onDeleteProject={(id) => deleted.push(id)}
    />,
  );
  const kibo = await screen.findByRole("row", { name: /Kibo/ });
  await userEvent.click(within(kibo).getByRole("button", { name: "Actions pour Kibo" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "Ouvrir",
    "Gérer le partage…",
    "Arrêter le partage…",
  ]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Arrêter le partage…" }));
  expect(shared).toEqual(["p1"]);
  const portfolio = screen.getByRole("row", { name: /Portfolio/ });
  await userEvent.click(within(portfolio).getByRole("button", { name: "Actions pour Portfolio" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "Ouvrir",
    "Gérer le partage…",
    "Quitter…",
  ]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Quitter…" }));
  expect(deleted).toEqual(["p2"]);
  await userEvent.click(within(portfolio).getByRole("button", { name: "Actions pour Portfolio" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Ouvrir" }));
  await userEvent.click(within(kibo).getByRole("button", { name: "Actions pour Kibo" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Gérer le partage…" }));
  expect([opened, shared]).toEqual([["p2"], ["p1", "p1"]]);
});
