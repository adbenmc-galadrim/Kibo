import { beforeEach, expect, mock, test } from "bun:test";
import {
  KiboError,
  type RemoteAccessStatus,
  type RpcRequest,
  type SandboxStatus,
  type SessionInfo,
} from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let remote: RemoteAccessStatus;
let sandbox: SandboxStatus;
let sessions: SessionInfo[];
let enableFails: KiboError | null = null;
let codeExpiresAt = 300_000;

const off: RemoteAccessStatus = {
  enabled: false,
  address: null,
  port: null,
  url: null,
  fingerprint: null,
  tls: null,
  interfaces: [
    { name: "lo0", address: "127.0.0.1" },
    { name: "lo0", address: "127.0.0.2" },
    { name: "lo0", address: "::1" },
    { name: "en0", address: "fe80::1" },
    { name: "en0", address: "192.168.1.20" },
  ],
  lastError: null,
};
const on: RemoteAccessStatus = {
  ...off,
  enabled: true,
  address: "192.168.1.20",
  port: 47832,
  url: "https://192.168.1.20:47832",
  fingerprint: "3F:A9:1C:7E:52:D0:8B:44:E6:19:C2:7A:0F:B3:95:6D",
  tls: "self-signed",
};
const DAY = 24 * 3600_000;

mock.module("../api", () => ({
  client: {
    subscribe: () => () => {},
    subscribeEvents: () => () => {},
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      switch (req.method) {
        case "getRemoteAccess":
          return remote;
        case "enableRemoteAccess":
          if (enableFails) throw enableFails;
          remote = on;
          return on;
        case "disableRemoteAccess":
          remote = off;
          return null;
        case "listSessions":
          return sessions;
        case "revokeSession":
          sessions = sessions.filter((s) => s.id !== req.id);
          return null;
        case "getSandboxStatus":
          return sandbox;
        case "setAllowUnsandboxed":
          sandbox = { ...sandbox, allowUnsandboxed: req.allow };
          return sandbox;
        case "createPairingCode":
          return { code: "K7Q4M2", expiresAt: codeExpiresAt };
        default:
          throw new Error(`unexpected ${req.method}`);
      }
    },
  },
}));
const { SecurityPage } = await import("./SecurityPage");

beforeEach(() => {
  calls.length = 0;
  remote = off;
  enableFails = null;
  codeExpiresAt = 300_000;
  sandbox = { kind: "bwrap", available: true, reason: null, fix: null, allowUnsandboxed: false };
  sessions = [
    {
      id: "a".repeat(64),
      deviceName: "Tauri · MacBook d'Adam",
      remote: false,
      createdAt: 0,
      lastSeenAt: 0,
      expiresAt: 30 * DAY,
      current: true,
    },
    {
      id: "b".repeat(64),
      deviceName: "Safari · iPad",
      remote: true,
      createdAt: 0,
      lastSeenAt: 0,
      expiresAt: 30 * DAY,
      current: false,
    },
  ];
});

const enableSwitch = () => screen.findByRole("switch", { name: "Activer l'accès distant" });

test("the page follows screen 71: title, subtitle, remote access off by default", async () => {
  render(<SecurityPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Sécurité" })).toBeTruthy();
  expect(screen.getByText("Accès au démon, sessions et isolation des composants.")).toBeTruthy();
  expect(await screen.findByText(/L'accès distant ouvre un second port, chiffré/)).toBeTruthy();
  expect((await enableSwitch()).getAttribute("aria-checked")).toBe("false");
});

test("enabling needs an interface and the explicit consent", async () => {
  render(<SecurityPage />);
  await userEvent.click(await enableSwitch());
  const dialog = await screen.findByRole("dialog");
  const submit = within(dialog).getByRole("button", { name: "Activer" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(within(dialog).getByRole("combobox", { name: "Interface" }).textContent).toBe("en0 · 192.168.1.20");
  expect(screen.queryAllByText(/^lo0/)).toHaveLength(0);
  expect((within(dialog).getByLabelText("Port") as HTMLInputElement).value).toBe("47832");
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /Je comprends/ }));
  await userEvent.click(submit);
  expect(calls).toContainEqual({
    method: "enableRemoteAccess",
    address: "192.168.1.20",
    port: 47832,
    tls: { kind: "self-signed" },
  });
  expect(await screen.findByText("https://192.168.1.20:47832")).toBeTruthy();
  expect(screen.getByText(on.fingerprint ?? "")).toBeTruthy();
  expect(
    screen.getByText("Vérifie cette empreinte dans ton navigateur à la première connexion."),
  ).toBeTruthy();
});

test("a refused activation explains the error code, never the raw message", async () => {
  enableFails = new KiboError("INVALID_INPUT", "cannot listen on 192.168.1.20:47832: EADDRINUSE");
  render(<SecurityPage />);
  await userEvent.click(await enableSwitch());
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /Je comprends/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Activer" }));
  expect(
    await within(dialog).findByText(
      "Impossible d'activer l'accès distant : vérifie l'interface, le port (déjà pris ?) et les fichiers du certificat.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/EADDRINUSE/)).toBeNull();
});

test("a remote access that could not resume shows its translated code", async () => {
  remote = { ...off, lastError: "INVALID_INPUT" };
  render(<SecurityPage />);
  expect(
    await screen.findByText(
      "L'accès distant n'a pas pu reprendre : vérifie l'interface, le port (déjà pris ?) et les fichiers du certificat.",
    ),
  ).toBeTruthy();
});

test("sessions list marks the current one and can revoke another", async () => {
  render(<SecurityPage />);
  const row = (await screen.findByText("Safari · iPad")).closest("tr") as HTMLElement;
  expect(within(row).getByText("Distant")).toBeTruthy();
  expect(screen.getByText("Cette session")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Révoquer" })).toHaveLength(1);
  await userEvent.click(within(row).getByRole("button", { name: "Révoquer" }));
  expect(calls).toContainEqual({ method: "revokeSession", id: "b".repeat(64) });
  expect(screen.getByText("Une session expire après 30 jours sans activité.")).toBeTruthy();
});

test("isolation available shows the active mechanism", async () => {
  render(<SecurityPage />);
  expect(await screen.findByText("bubblewrap actif")).toBeTruthy();
});

test("isolation unavailable shows the problem, the fix, and asks before allowing", async () => {
  sandbox = {
    kind: "bwrap",
    available: false,
    reason: "sandbox probe exited with 1: bwrap: setting up uid map: Permission denied",
    fix: "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0",
    allowUnsandboxed: false,
  };
  render(<SecurityPage />);
  expect(await screen.findByText("Indisponible : espaces de noms utilisateur interdits")).toBeTruthy();
  expect(screen.getByText("sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("switch", { name: "Autoriser les backends sandboxés sans isolation OS" }),
  );
  const confirm = await screen.findByRole("alertdialog");
  expect(within(confirm).getByText(/Ne l'active que si tu fais confiance/)).toBeTruthy();
  expect(calls.some((c) => c.method === "setAllowUnsandboxed")).toBe(false);
  await userEvent.click(within(confirm).getByRole("button", { name: "Autoriser quand même" }));
  expect(calls).toContainEqual({ method: "setAllowUnsandboxed", allow: true });
});

test("disabling asks for confirmation", async () => {
  remote = on;
  render(<SecurityPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
  const confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: "Désactiver" }));
  expect(calls).toContainEqual({ method: "disableRemoteAccess" });
});

test("the pairing code dialog shows the code and its countdown", async () => {
  const { PairingCodeDialog } = await import("./PairingCodeDialog");
  render(<PairingCodeDialog open onOpenChange={() => {}} now={() => 1_000} />);
  expect(await screen.findByText("K7Q-4M2")).toBeTruthy();
  expect(screen.getByText("Expire dans 4:59")).toBeTruthy();
});

test("an expired pairing code offers a new one", async () => {
  const { PairingCodeDialog } = await import("./PairingCodeDialog");
  render(<PairingCodeDialog open onOpenChange={() => {}} now={() => 400_000} />);
  expect(await screen.findByText("Code expiré.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Générer un nouveau code" }));
  expect(calls.filter((c) => c.method === "createPairingCode")).toHaveLength(2);
});

test("web access sits in security before sessions and generates a pairing code (screen 110)", async () => {
  codeExpiresAt = Date.now() + 300_000;
  render(<SecurityPage />);
  const webAccess = screen.getByText("Accès web");
  const follows = (a: Node, b: Node) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  expect(follows(screen.getByText("Accès distant"), webAccess)).toBe(true);
  expect(follows(webAccess, screen.getByText("Sessions"))).toBe(true);
  expect(
    screen.getByText(
      "Appaire un navigateur de cet ordinateur ou du réseau local avec un code à usage unique.",
    ),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Générer un code" }));
  expect(await screen.findByText("K7Q-4M2")).toBeTruthy();
});
