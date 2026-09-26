import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type KiboErrorCode, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PATH = "/Users/adam/.local/bin/kibo";
let installed = false;
let install: () => Promise<unknown> = async () => {
  installed = true;
  return { path: PATH };
};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) =>
      req.method === "cliStatus" ? Promise.resolve({ path: PATH, installed }) : install(),
    subscribe: () => () => undefined,
  },
}));
const { CliInstallCard } = await import("./CliInstallCard");

beforeEach(() => {
  installed = false;
});

const failWith = (code: KiboErrorCode) => {
  install = async () => {
    throw new KiboError(code, "test");
  };
};

test("D8: the card shows the status, then installs the kibo command", async () => {
  install = async () => {
    installed = true;
    return { path: PATH };
  };
  render(<CliInstallCard />);
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  expect(await screen.findByText("Non installée")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Installer la commande kibo" }));
  expect(await screen.findByText("Installée : ~/.local/bin/kibo")).toBeTruthy();
  expect(screen.queryByText("Non installée")).toBeNull();
});

test("D8: an installed command is reported on mount", async () => {
  installed = true;
  render(<CliInstallCard />);
  expect(await screen.findByText("Installée : ~/.local/bin/kibo")).toBeTruthy();
});

const causes: [KiboErrorCode, string][] = [
  [
    "PERMISSION_DENIED",
    "~/.local/bin n'est pas accessible en écriture. Crée le dossier ou corrige ses droits, puis réessaie.",
  ],
  ["CONFLICT", "~/.local/bin/kibo existe déjà et n'appartient pas à Kibo. Supprime-le, puis réessaie."],
  ["INVALID_INPUT", "La commande s'installe depuis l'application Kibo installée."],
  ["INTERNAL", "Réessaie ; si l'échec persiste, consulte le journal du démon."],
];

for (const [code, cause] of causes) {
  test(`D8: a ${code} failure names its cause`, async () => {
    failWith(code);
    render(<CliInstallCard />);
    await screen.findByText("Non installée");
    await userEvent.setup().click(screen.getByRole("button", { name: "Installer la commande kibo" }));
    const alert = within(await screen.findByRole("alert"));
    expect(alert.getByText("Impossible d'installer la commande kibo")).toBeTruthy();
    expect(alert.getByText(cause)).toBeTruthy();
  });
}

test("D8: an unexpected failure is logged and explained", async () => {
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (e: unknown) => {
    logged.push(e);
  };
  install = async () => {
    throw new TypeError("boom");
  };
  try {
    render(<CliInstallCard />);
    await screen.findByText("Non installée");
    await userEvent.setup().click(screen.getByRole("button", { name: "Installer la commande kibo" }));
    const alert = within(await screen.findByRole("alert"));
    expect(alert.getByText("Réessaie ; si l'échec persiste, consulte le journal du démon.")).toBeTruthy();
    expect(logged).toHaveLength(1);
  } finally {
    console.error = original;
  }
});
