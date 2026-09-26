import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type ProjectSummary, type TicketView } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, runFixture } from "../agents/fixtures";
import { CommandPalette } from "./CommandPalette";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const ticket = (n: number, title: string, statusId: TicketView["statusId"] = "in_progress"): TicketView => ({
  id: `${n}@1`,
  key: `KIB-${n}`,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});
const summary: ProjectSummary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const snapshot: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@9", title: "Kanban", kind: "view", parentId: null }],
  tickets: [
    ticket(12, "Schéma Loro des tickets (LoroTree)"),
    ticket(14, "Récepteur de hooks Claude Code"),
    ticket(16, "Moteur de règles déclaratif"),
    ticket(18, "Adaptateur GitHub Issues", "todo"),
    ticket(10, "Watcher git et gh"),
    ticket(11, "Démon : auth par jeton local", "in_review"),
    ticket(2, "Graphe"),
  ],
  links: [],
  instances: [],
  rules: [],
  nextTicketKey: "KIB-19",
};
const context: PaletteContext = {
  projects: [summary],
  snapshots: new Map([["p1", snapshot]]),
  recents: [{ kind: "page", projectId: "p1", pageId: "1@9" }],
  activeProjectId: "p1",
  activeTicketId: "12@1",
  agents: {
    ...agentsFixture(),
    runs: [
      runFixture({
        id: "r14",
        projectId: "p1",
        ticketId: "14@1",
        ticketKey: "KIB-14",
        label: "opus-dev-2",
        state: "waiting_input",
      }),
      runFixture({
        id: "r18",
        projectId: "p1",
        ticketId: "18@1",
        ticketKey: "KIB-18",
        label: "opus-dev",
        state: "queued",
      }),
    ],
    queue: [{ runId: "r18", position: 2, reason: null }],
  },
};

test("tickets are capped at four with a summary of the others", () => {
  const sections = searchItems(buildItems(context), "kib-1", "all");
  const tickets = sections.find((s) => s.group === "tickets");
  expect(tickets?.items.map((i) => i.label)).toEqual([
    "KIB-12 · Schéma Loro des tickets (LoroTree)",
    "KIB-14 · Récepteur de hooks Claude Code",
    "KIB-16 · Moteur de règles déclaratif",
    "KIB-18 · Adaptateur GitHub Issues",
  ]);
  expect(tickets?.more).toEqual(["KIB-10", "KIB-11"]);
  expect(tickets?.items[3]?.detail).toBe("En file #2");
  expect(tickets?.items[0]?.detail).toBe("En cours");
});

test("search ignores accents, the filter narrows groups and lifts the cap", () => {
  expect(
    searchItems(buildItems(context), "recepteur", "all").find((s) => s.group === "tickets")?.items,
  ).toHaveLength(1);
  const onlyTickets = searchItems(buildItems(context), "kib-1", "tickets");
  expect(onlyTickets.map((s) => s.group)).toEqual(["tickets"]);
  expect(onlyTickets[0]?.items).toHaveLength(6);
  expect(searchItems(buildItems(context), "kanban", "all").map((s) => s.group)).toEqual(["pages"]);
});

test("an empty query shows recents, projects and contextual actions", () => {
  const sections = searchItems(buildItems(context), "", "all");
  expect(sections.map((s) => s.group)).toEqual(["recents", "actions", "projects"]);
  expect(sections[0]?.items[0]?.label).toBe("Kibo · Kanban");
  expect(sections[1]?.items.map((i) => i.label)).toEqual([
    "Nouveau ticket",
    "Créer un sous-ticket de KIB-12",
    "Nouvelle page",
    "Voir les changements de Kibo",
    "Nouveau projet",
    "Basculer le thème (système / clair / sombre)",
  ]);
});

test("Enter opens a target, ⌘Enter opens the ticket sheet, Tab cycles the filter", async () => {
  const opened: unknown[] = [];
  const sheets: string[] = [];
  const actions: unknown[] = [];
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={(t, newTab) => opened.push({ t, newTab })}
      onOpenTicketSheet={(_, id) => sheets.push(id)}
      onAction={(a) => actions.push(a)}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Palette de commandes" });
  const input = within(dialog).getByRole("combobox");
  await userEvent.type(input, "kib-12");
  await userEvent.keyboard("{Enter}");
  expect(opened).toEqual([{ t: { kind: "ticket", projectId: "p1", ticketId: "12@1" }, newTab: false }]);
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  expect(sheets).toEqual(["12@1"]);
  await userEvent.clear(input);
  await userEvent.keyboard("{Tab}");
  expect(within(dialog).getByText("Tickets", { selector: "[data-filter]" })).toBeTruthy();
});

test("the agents group answers a waiting run and assigns the active ticket, Tab reaches it", async () => {
  const actions: unknown[] = [];
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={() => {}}
      onOpenTicketSheet={() => {}}
      onAction={(a) => actions.push(a)}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Palette de commandes" });
  const agents = within(dialog).getByRole("group", { name: "Agents" });
  expect(
    within(agents)
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual(["Répondre à opus-dev-2 (KIB-14)", "Assigner KIB-12 à un agent…"]);
  await userEvent.click(within(agents).getByRole("option", { name: "Répondre à opus-dev-2 (KIB-14)" }));
  await userEvent.click(within(agents).getByRole("option", { name: "Assigner KIB-12 à un agent…" }));
  expect(actions).toEqual([
    { kind: "reply", runId: "r14" },
    { kind: "assign", projectId: "p1", ticketId: "12@1" },
  ]);
  const input = within(dialog).getByRole("combobox");
  await userEvent.click(input);
  for (let i = 0; i < 5; i++) await userEvent.keyboard("{Tab}");
  expect(within(dialog).getByText("Agents", { selector: "[data-filter]" })).toBeTruthy();
});
