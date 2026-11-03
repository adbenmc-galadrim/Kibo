import { beforeEach, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../App";
import { relayedCommands, siloFixture } from "../../screen-fixture";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/planning";
});

test("PlanningScreen shows the sprint columns snapping on the phone", async () => {
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  const s42 = await screen.findByRole("region", { name: /^S42 Saisie hors ligne/ });
  expect(s42.className.split(" ")).toContain("@max-xl:w-[85%]");
  expect(within(s42).getAllByRole("button", { name: /Réaffecter un box/ }).length).toBeGreaterThan(0);
});

test("PlanningScreen creates a feature through the relayed command", async () => {
  const { runtime, api } = await siloFixture();
  api.reply = (req) => ({ ok: true, result: { id: `new-${JSON.stringify(req).length}` } });
  render(<App runtime={runtime} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Fonctionnalité" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nom"), "Signer un PV");
  await user.click(within(dialog).getByRole("button", { name: "Créer la fonctionnalité" }));
  await waitFor(() =>
    expect(relayedCommands(api.requests)).toContainEqual(
      expect.objectContaining({ method: "createTicket", title: "Signer un PV" }),
    ),
  );
});

test("on the phone the En attente band starts folded, and stays as the user leaves it", async () => {
  const { runtime } = await siloFixture();
  const first = render(<App runtime={runtime} />);
  const band = await screen.findByRole("region", { name: "En attente (1)" });
  expect(within(band).getByRole("button", { name: /Déplier/ })).toBeTruthy();
  expect(within(band).queryByText("Reprise des envois")).toBeNull();
  await userEvent.setup().click(within(band).getByRole("button", { name: /Déplier/ }));
  first.unmount();
  render(<App runtime={runtime} />);
  const again = await screen.findByRole("region", { name: "En attente (1)" });
  expect(within(again).getByRole("button", { name: /Replier/ })).toBeTruthy();
});
