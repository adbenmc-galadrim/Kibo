import { afterEach, expect, mock, test } from "bun:test";
import type { ProjectEvent, RpcRequest, TicketView } from "@kibo/schema";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { NOW, siloFeatureProject } from "./feature/fixture";

const journal: ProjectEvent[] = [
  {
    id: 1,
    projectId: "silo",
    kind: "branch_created",
    ticketId: "e33",
    featureId: "f5",
    source: "git",
    data: { branch: "feat/envoi-hors-ligne" },
    at: NOW - 3_600_000,
  },
];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        Promise.resolve(
          req.method === "listProjectEvents"
            ? { items: journal, nextBefore: null }
            : req.method === "listCiRuns"
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
const { Toaster } = await import("@kibo/sdk/ui/sonner");
const { TICKET_TAB_KEY } = await import("../ticket/activity/TicketTabs");

afterEach(() => {
  cleanup();
  sessionStorage.removeItem(TICKET_TAB_KEY);
});

const noop = () => undefined;
const project = siloFeatureProject();

const open = async (ticketId: string, patch: Partial<TicketView> = {}) => {
  const result = render(
    <TicketSheet
      project={{ ...project, tickets: project.tickets.map((t) => (t.id === "e33" ? { ...t, ...patch } : t)) }}
      ticketId={ticketId}
      domains={[]}
      viewer="adam"
      onClose={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );
  await act(async () => {});
  return result;
};

test("one Escape closes the sheet, and the key tooltip still shows on Tab", async () => {
  const onClose = mock(noop);
  render(
    <TicketSheet
      project={project}
      ticketId="e33"
      domains={[]}
      viewer="adam"
      onClose={onClose}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );
  await act(async () => {});
  expect(screen.queryByRole("tooltip")).toBeNull();
  const user = userEvent.setup();
  await user.tab();
  expect((await screen.findByRole("tooltip")).textContent).toContain("Copier");
  await user.tab({ shift: true });
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the sheet of a step leads with « F5 · S42 », its Suivi block and a « Fermer » button", async () => {
  await open("e33");
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector("[data-ticket-context]")?.textContent).toBe("F5 · S42");
  expect(within(dialog).getByRole("region", { name: "Suivi" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Fermer" })).toBeTruthy();
});

test("the sheet is found by the key of the ticket as well", async () => {
  await open("SILO-33");
  expect(screen.getByRole("heading", { name: "Écran d'envoi hors ligne" })).toBeTruthy();
});

test("Domaine and Maquettes stay folded until asked for", async () => {
  await open("e33");
  const domain = screen.getByRole("button", { name: /^Domaine/ });
  const mockups = screen.getByRole("button", { name: /^Maquettes/ });
  expect([domain, mockups].map((b) => b.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
  await userEvent.setup().click(mockups);
  expect(mockups.getAttribute("aria-expanded")).toBe("true");
});

test("copying /full-delivery writes the command and says what it waits for", async () => {
  render(<Toaster />);
  await open("e33", { startable: false, waitingOn: ["SILO-32"] });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions SILO-33" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copier /full-delivery SILO-33" }));
  expect(await screen.findByText("Copié · attend SILO-32")).toBeTruthy();
  expect(await navigator.clipboard.readText()).toBe("/full-delivery SILO-33");
});

test("requested changes are told once, by the PR row of the tracking block", async () => {
  await open("e33", {
    externalRefs: [
      {
        kind: "github_pr",
        url: "https://github.com/silo-labs/silo-location/pull/20",
        number: 20,
        state: "open",
        base: "dev",
        head: null,
        review: "changes_requested",
        checks: "error",
      },
    ],
  });
  expect(screen.queryByRole("status", { name: "État de la review et de la CI" })).toBeNull();
  expect(screen.queryByText("PR #20")).toBeNull();
  expect(screen.getAllByText("changements demandés")).toHaveLength(1);
});

test("the Activité tab reads the journal of the ticket", async () => {
  await open("e33");
  await userEvent.setup().click(screen.getByRole("tab", { name: "Activité" }));
  const journalRegion = await screen.findByRole("region", { name: "Chronologie" });
  expect(await within(journalRegion).findByText("Branche feat/envoi-hors-ligne poussée")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Ancien/ })).toBeNull();
});

test("status and assignee are pills under the title; a step toggles « facultative », a lone ticket picks its sprint", async () => {
  const view = await open("e33");
  expect(screen.getByRole("combobox", { name: "Statut" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Assigné" })).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Requise pour livrer" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Sprint" })).toBeNull();
  view.unmount();
  await open("e33", { parentId: null });
  expect(screen.queryByRole("switch", { name: "Requise pour livrer" })).toBeNull();
  expect(screen.getByRole("combobox", { name: "Sprint" })).toBeTruthy();
});

test("the top bar names the key and holds Lancer dans T3, the link and Fermer", async () => {
  await open("e33");
  const close = screen.getByRole("button", { name: "Fermer" });
  expect(close.textContent).toBe("Fermer");
  const bar = close.parentElement?.parentElement;
  expect(bar?.textContent).toContain("SILO-33");
  expect(bar?.textContent).toContain("Lancer dans T3");
  expect(screen.getByRole("button", { name: "Copier le lien du ticket" })).toBeTruthy();
});

test("a client demo step is titled « Démo · F5 », its edit keeps the stored title", async () => {
  await open("e35");
  const heading = screen.getByRole("heading", { name: "Démo · F5" });
  await userEvent.setup().click(within(heading).getByRole("button"));
  expect(screen.getByRole("textbox", { name: "Titre" })).toHaveProperty("value", "Démo client");
});
