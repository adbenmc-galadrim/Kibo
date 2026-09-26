import { expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let answer: () => Promise<unknown> = async () => ({ path: "/Users/adam/.local/bin/kibo" });
mock.module("../api", () => ({
  client: { rpc: (_: RpcRequest) => answer(), subscribe: () => () => undefined },
}));
const { CliInstallCard } = await import("./CliInstallCard");

test("D8: install the kibo command, or explain why not", async () => {
  render(<CliInstallCard />);
  const user = userEvent.setup();
  expect(screen.getByText("Commande kibo")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Installer la commande kibo" }));
  expect(await screen.findByText("Installée : ~/.local/bin/kibo")).toBeTruthy();
  answer = async () => {
    throw new KiboError("INVALID_INPUT", "dev");
  };
  await user.click(screen.getByRole("button", { name: "Installer la commande kibo" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'installer la commande.");
});
