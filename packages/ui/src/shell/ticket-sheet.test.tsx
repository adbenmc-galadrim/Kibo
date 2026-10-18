import { afterEach, expect, mock, test } from "bun:test";
import type { ProjectEvent, RpcRequest, TicketView } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { emisFeatureProject, NOW } from "./feature/fixture";

const toasts: string[] = [];
const journal: ProjectEvent[] = [
  {
    id: 1,
    projectId: "emis",
    kind: "branch_created",
    ticketId: "e33",
    featureId: "f5",
    source: "git",
    data: { branch: "feat/envoi-hors-ligne" },
    at: NOW - 3_600_000,
  },
];

mock.module("sonner", () => ({ toast: (message: string) => toasts.push(message), Toaster: () => null }));
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        Promise.resolve(
          req.method === "listProjectEvents"
            ? { items: journal, nextBefore: null }
            : req.method === "listCiRuns" || req.method === "autoLinks.list"
              ? []
              : null,
        ),
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { TicketSheet } = await import("./TicketSheet");

afterEach(cleanup);

const noop = () => undefined;
const project = emisFeatureProject();

const open = (ticketId: string, patch: Partial<TicketView> = {}) =>
  render(
    <TicketSheet
      project={{ ...project, tickets: project.tickets.map((t) => (t.id === "e33" ? { ...t, ...patch } : t)) }}
      ticketId={ticketId}
      domains={[]}
      viewer="adam"
      onClose={noop}
      onAssign={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );

test("the sheet of a step leads with « F5 · S42 », its Suivi block and a « Fermer » button", () => {
  open("e33");
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector("[data-ticket-context]")?.textContent).toBe("F5 · S42");
  expect(within(dialog).getByRole("region", { name: "Suivi" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Fermer" })).toBeTruthy();
});

test("the sheet is found by the key of the ticket as well", () => {
  open("EMIS-33");
  expect(screen.getByRole("heading", { name: "Écran d'envoi hors ligne" })).toBeTruthy();
});

test("Domaine and Maquettes stay folded until asked for", async () => {
  open("e33");
  const more = screen.getByRole("button", { name: "Domaine et maquettes" });
  expect(more.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Maquettes")).toBeNull();
  await userEvent.setup().click(more);
  expect(more.getAttribute("aria-expanded")).toBe("true");
});

test("copying /full-delivery writes the command and says what it waits for", async () => {
  open("e33", { startable: false, waitingOn: ["EMIS-32"] });
  await userEvent.setup().click(screen.getByRole("button", { name: "Copier /full-delivery EMIS-33" }));
  await waitFor(() => expect(toasts.at(-1)).toBe("Copié · attend EMIS-32"));
  expect(await navigator.clipboard.readText()).toBe("/full-delivery EMIS-33");
});

test("the banner warns of requested changes on the PR of the step", () => {
  open("e33", {
    externalRefs: [
      {
        kind: "github_pr",
        url: "https://github.com/galadrim/emis/pull/20",
        number: 20,
        state: "open",
        base: "dev",
        head: null,
        review: "changes_requested",
        checks: "error",
      },
    ],
  });
  expect(screen.getByRole("status", { name: "État de la review et de la CI" }).textContent).toContain(
    "PR #20 · changements demandés · CI cassée",
  );
});

test("the Activité tab reads the journal of the ticket", async () => {
  open("e33");
  await userEvent.setup().click(screen.getByRole("tab", { name: "Activité" }));
  const journalRegion = await screen.findByRole("region", { name: "Journal du ticket" });
  expect(await within(journalRegion).findByText("Branche feat/envoi-hors-ligne créée")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Ancien/ })).toBeNull();
});
