import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../App";
import { phoneFixture } from "../../app-test-kit";
import type { Connectivity } from "../../remote-client";
import { HOLD_REASON, sealTicket } from "./ticket-kit";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#/p/silo/t/t45";
});
afterEach(cleanup);

async function mountTicket(connectivity: Connectivity = { macOnline: true, phoneOnline: true }) {
  const fixture = await phoneFixture({ connectivity });
  await sealTicket(fixture);
  render(<App runtime={fixture.runtime} />);
  const fiche = await screen.findByRole("article", { name: "SILO-45" });
  await act(async () => {});
  return { ...fixture, fiche, user: userEvent.setup() };
}

test("TicketScreen shows TicketDetail full screen with status, sprint, assignee, domain, optional, description, labels, links, hold, questions, activity (listProjectEvents from the events blob), PR state, T3 state", async () => {
  const { fiche, user } = await mountTicket();
  const page = within(fiche);
  expect(page.getByRole("heading", { level: 1 }).textContent).toContain("Conflits de saisie");
  expect(page.getByRole("combobox", { name: /Statut/ }).textContent).toContain("En review");
  expect(page.getByText(/S42/)).toBeTruthy();
  expect(page.getByText("Moi")).toBeTruthy();
  expect(page.getByText(/requise pour livrer F4/)).toBeTruthy();
  expect(page.getByText("Saisie terrain")).toBeTruthy();
  expect(page.getByText(/Deux saisies hors ligne du même constat/)).toBeTruthy();
  expect(page.getByText("hors-ligne")).toBeTruthy();
  expect(page.getByText("SILO-46")).toBeTruthy();
  expect(page.getByRole("status", { name: /attente/i }).textContent).toContain(HOLD_REASON);
  expect(page.getByText("La règle de fusion vaut-elle pour les photos ?")).toBeTruthy();
  expect(page.getAllByText(/changements demandés/).length).toBeGreaterThan(0);
  expect(page.getByText("T3 · attend ta réponse")).toBeTruthy();
  await user.click(page.getByRole("tab", { name: "Activité" }));
  await waitFor(() => expect(page.getByText(`Mise en attente · ${HOLD_REASON}`)).toBeTruthy());
});

test('the "Ouvrir dans T3" and "Ouvrir le fichier" actions are absent', async () => {
  const { fiche } = await mountTicket();
  expect(within(fiche).queryByRole("link", { name: "Ouvrir dans T3" })).toBeNull();
  expect(document.querySelector('a[href^="t3-thread://"]')).toBeNull();
  expect(within(fiche).queryByRole("button", { name: "src/sync/merge.ts" })).toBeNull();
  expect(within(fiche).getByText(/src\/sync\/merge\.ts/)).toBeTruthy();
});

test('"Lancer dans T3" opens the confirmation and relays t3.launch', async () => {
  const fixture = await phoneFixture();
  await sealTicket(fixture);
  const reply = fixture.api;
  reply.reply = (req) => {
    const method = typeof req === "object" && req !== null && "method" in req ? req.method : null;
    if (method === "t3.preview")
      return {
        ok: true,
        result: { argv: [], command: "/full-delivery SILO-46", folder: "/Users/adam/silo", warning: null },
      };
    if (method === "t3.threadOf") return { ok: true, result: null };
    return {
      ok: true,
      result: {
        thread: {
          threadId: "th-46",
          link: "",
          title: "SILO-46",
          status: "running",
          startedAt: 1,
          checkedAt: 1,
        },
        command: "",
      },
    };
  };
  window.location.hash = "#/p/silo/t/t46";
  render(<App runtime={fixture.runtime} />);
  const fiche = await screen.findByRole("article", { name: "SILO-46" });
  const user = userEvent.setup();
  await user.click(await within(fiche).findByRole("button", { name: "Lancer dans T3" }));
  const dialog = await screen.findByRole("dialog", { name: "Lancer SILO-46 dans T3" });
  await user.click(await within(dialog).findByRole("button", { name: "Lancer" }));
  await waitFor(() =>
    expect(fixture.api.requests).toContainEqual({
      method: "t3.launch",
      projectId: "silo",
      ticketKey: "SILO-46",
    }),
  );
});

test('the CI log sheet says "Disponible quand le Mac est allumé" when offline and loads through getCiLog when online', async () => {
  const off = await mountTicket({ macOnline: false, phoneOnline: true });
  await off.user.click(await within(off.fiche).findByRole("button", { name: "Voir les logs" }));
  expect(await screen.findByText("Disponible quand le Mac est allumé")).toBeTruthy();
  expect(off.api.calls.filter((c) => c === "request")).toEqual([]);
  cleanup();

  const on = await mountTicket();
  on.api.reply = () => ({
    ok: true,
    result: { text: "npm test\n1 failed", truncated: false, errorLines: [2] },
  });
  await on.user.click(await within(on.fiche).findByRole("button", { name: "Voir les logs" }));
  expect(await screen.findByText("1 failed")).toBeTruthy();
  expect(on.api.requests).toContainEqual({ method: "getCiLog", projectId: "silo", runId: 9, jobId: 31 });
});

test("design sections are absent (inventory exclusion)", async () => {
  const { fiche } = await mountTicket();
  expect(within(fiche).queryByText("Maquettes")).toBeNull();
  expect(within(fiche).queryByRole("textbox", { name: "Lier" })).toBeNull();
});

test("with the Mac off the fields are read-only and the launch says it is unavailable", async () => {
  const { fiche } = await mountTicket({ macOnline: false, phoneOnline: true });
  const launch = within(fiche).getByRole("button", { name: "Lancer dans T3 · indisponible, Mac éteint" });
  expect(launch.hasAttribute("disabled")).toBe(true);
  expect(within(fiche).queryByRole("button", { name: "Reprendre" })).toBeNull();
  expect(within(fiche).queryByRole("button", { name: "Modifier" })).toBeNull();
});
