import { beforeEach, expect, mock, test } from "bun:test";
import {
  type BackupInfo,
  type BackupStatus,
  KiboError,
  type Phase7Event,
  type RpcRequest,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const HOUR = 3_600_000;
const requests: RpcRequest[] = [];
const listeners = new Set<(e: Phase7Event) => void>();
let backups: BackupInfo[] = [];
let status: BackupStatus;
let answers: Partial<Record<RpcRequest["method"], (req: RpcRequest) => Promise<unknown>>> = {};

const backup = (id: string, createdAt: number, reason: BackupInfo["reason"]): BackupInfo => ({
  id,
  createdAt,
  reason,
  bytes: 12_400_000,
  appVersion: "1.5.0",
});

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      requests.push(req);
      const answer = answers[req.method];
      if (answer) return answer(req);
      if (req.method === "getBackups") return Promise.resolve({ status, backups });
      return Promise.resolve(null);
    },
    subscribeEvents: (listener: (e: Phase7Event) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));
const { BackupsCard } = await import("./BackupsCard");

const emit = (e: Phase7Event) => {
  for (const l of listeners) l(e);
};

beforeEach(() => {
  requests.length = 0;
  answers = {};
  const now = Date.now();
  backups = [
    backup("2026-10-04T14-05-00Z", now - 2 * HOUR, "auto"),
    backup("2026-10-03T09-00-00Z", now - 30 * HOUR, "manual"),
  ];
  status = {
    settings: { enabled: true, dir: null },
    dir: "/Users/adam/.kibo/backups",
    displayDir: "~/.kibo/backups",
    last: backups[0] ?? null,
    nextAt: now + 22 * HOUR,
    running: false,
  };
});

const sent = (method: RpcRequest["method"]) => requests.filter((r) => r.method === method);

test("shows the state, the last backup and the list newest first", async () => {
  render(<BackupsCard desktop={false} />);
  expect(screen.getByText("Sauvegardes")).toBeTruthy();
  expect(await screen.findByText("Dernière sauvegarde il y a 2 h · 12,4 Mo · automatique")).toBeTruthy();
  expect(
    screen.getByRole("switch", { name: "Sauvegarde automatique quotidienne" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText(/^Prochaine : /)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "2 sauvegardes" }));
  const rows = within(screen.getByRole("list", { name: "Liste des sauvegardes" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toContain("automatique");
  expect(rows[1]).toContain("manuelle");
});

test("Sauvegarder maintenant calls createBackup { reason: 'manual' } and shows the busy state until the event", async () => {
  let finish: () => void = () => {};
  answers.createBackup = () =>
    new Promise((resolve) => {
      finish = () => resolve(backup("2026-10-04T16-00-00Z", Date.now(), "manual"));
    });
  render(<BackupsCard desktop={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sauvegarder maintenant" }));
  expect(sent("createBackup")).toEqual([{ method: "createBackup", reason: "manual" }]);
  const busy = await screen.findByRole("button", { name: "Sauvegarde en cours…" });
  expect(busy.hasAttribute("disabled")).toBe(true);
  status = { ...status, running: true };
  act(() => emit({ type: "backups.changed" }));
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Sauvegarde en cours…" })).toBeTruthy();
  const made = backup("2026-10-04T16-00-00Z", Date.now(), "manual");
  backups = [made, ...backups];
  status = { ...status, running: false, last: made };
  act(() => emit({ type: "backups.changed" }));
  expect(await screen.findByText("Dernière sauvegarde à l'instant · 12,4 Mo · manuelle")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sauvegarder maintenant" }).hasAttribute("disabled")).toBe(false);
});

test("a refused backup is explained in French", async () => {
  answers.createBackup = () => Promise.reject(new KiboError("CONFLICT", "a backup is already running"));
  render(<BackupsCard desktop={false} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Sauvegarder maintenant" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Une sauvegarde est déjà en cours : attends sa fin.",
  );
});

test("the switch calls setBackupSettings { patch: { enabled: false } } and explains that update backups remain", async () => {
  answers.setBackupSettings = () => {
    status = { ...status, settings: { ...status.settings, enabled: false }, nextAt: null };
    return Promise.resolve(status);
  };
  render(<BackupsCard desktop={false} />);
  await screen.findByText(/^Dernière sauvegarde/);
  await userEvent.setup().click(screen.getByRole("switch", { name: "Sauvegarde automatique quotidienne" }));
  expect(sent("setBackupSettings")).toEqual([{ method: "setBackupSettings", patch: { enabled: false } }]);
  act(() => emit({ type: "backups.changed" }));
  expect(
    await screen.findByText(
      "Sauvegarde automatique désactivée : la sauvegarde avant chaque mise à jour reste active.",
    ),
  ).toBeTruthy();
});

test("Supprimer on a row asks confirmation then calls deleteBackup", async () => {
  render(<BackupsCard desktop={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "2 sauvegardes" }));
  const [first] = within(screen.getByRole("list", { name: "Liste des sauvegardes" })).getAllByRole(
    "listitem",
  );
  if (!first) throw new Error("no backup row");
  await user.click(within(first).getByRole("button", { name: "Supprimer" }));
  expect(sent("deleteBackup")).toEqual([]);
  const dialog = await screen.findByRole("alertdialog", { name: "Supprimer cette sauvegarde ?" });
  await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(sent("deleteBackup")).toEqual([{ method: "deleteBackup", id: "2026-10-04T14-05-00Z" }]),
  );
});

test("outside Tauri the folder is shown as text with no Choisir ni Ouvrir buttons", async () => {
  render(<BackupsCard desktop={false} />);
  expect(await screen.findByText("~/.kibo/backups")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ouvrir le dossier" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Choisir le dossier…" })).toBeNull();
});

test("in Tauri Choisir le dossier… uses pickFolder and sends the path; a refused folder is shown in French", async () => {
  const picked: (string | null)[] = [];
  const revealed: string[] = [];
  answers.setBackupSettings = () =>
    Promise.reject(new KiboError("INVALID_INPUT", "the backup folder cannot be inside the Kibo folder"));
  render(
    <BackupsCard
      desktop
      pick={async (from) => {
        picked.push(from);
        return "/Users/adam/.kibo/inside";
      }}
      reveal={async (path) => {
        revealed.push(path);
      }}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ouvrir le dossier" }));
  expect(revealed).toEqual(["/Users/adam/.kibo/backups"]);
  await user.click(screen.getByRole("button", { name: "Choisir le dossier…" }));
  expect(picked).toEqual(["/Users/adam/.kibo/backups"]);
  expect(sent("setBackupSettings")).toEqual([
    { method: "setBackupSettings", patch: { dir: "/Users/adam/.kibo/inside" } },
  ]);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Ce dossier ne convient pas : choisis un dossier existant, en dehors du dossier de Kibo.",
  );
});

test("a chosen folder can go back to the default one", async () => {
  status = {
    ...status,
    settings: { enabled: true, dir: "/Volumes/Sauvegardes" },
    dir: "/Volumes/Sauvegardes",
  };
  render(<BackupsCard desktop pick={async () => null} reveal={async () => {}} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Dossier par défaut" }));
  expect(sent("setBackupSettings")).toEqual([{ method: "setBackupSettings", patch: { dir: null } }]);
});

test("the card says that files/ (project files) are not included", async () => {
  render(<BackupsCard desktop={false} />);
  expect(
    await screen.findByText("Les fichiers de projet (files/) et les secrets ne sont pas inclus."),
  ).toBeTruthy();
  expect(screen.getByText(/^Restaurer : quitte Kibo/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Guide d'installation" }).getAttribute("href")).toContain(
    "docs/installation.md",
  );
});
